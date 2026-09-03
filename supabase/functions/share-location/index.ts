import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

function readPlatformKey(keysVariable: string, legacyVariable: string) {
  try {
    const keys = Deno.env.get(keysVariable)
    if (keys) {
      const parsed = JSON.parse(keys)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].value as string
      if (parsed.default) return parsed.default as string
    }
  } catch (e) {
    console.error(`Failed to parse ${keysVariable}`, e)
  }
  return Deno.env.get(legacyVariable) ?? ''
}

async function sendTwilioMessage(phoneE164: string, message: string, useWhatsApp: boolean) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromPhone = Deno.env.get('TWILIO_WHATSAPP_NUMBER')

  if (!accountSid || !authToken || !fromPhone) {
    console.warn('Twilio credentials not found.')
    return false
  }

  // To fallback to SMS, we strip the 'whatsapp:' prefix if it exists
  const actualFromPhone = useWhatsApp ? fromPhone : fromPhone.replace('whatsapp:', '')
  const toPhone = useWhatsApp ? `whatsapp:${phoneE164}` : phoneE164

  const formData = new URLSearchParams()
  formData.append('To', toPhone)
  formData.append('From', actualFromPhone)
  formData.append('Body', message)

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`
      },
      body: formData.toString()
    })
    
    if (!res.ok) {
      console.error(`Twilio send failed (${useWhatsApp ? 'WhatsApp' : 'SMS'}) to ${phoneE164}:`, await res.text())
      return false
    } else {
      console.log(`Twilio sent successfully (${useWhatsApp ? 'WhatsApp' : 'SMS'}) to ${phoneE164}`)
      return true
    }
  } catch (e) {
    console.error(`Twilio network error (${useWhatsApp ? 'WhatsApp' : 'SMS'}):`, e)
    return false
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'Missing authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const publishableKey = readPlatformKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  const secretKey = readPlatformKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !publishableKey || !secretKey) return json({ error: 'Server is not configured' }, 500)

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthenticated' }, 401)

  const payload = await request.json().catch(() => null)
  const { trackingLink } = payload || {}
  
  if (!trackingLink) {
    return json({ error: 'Missing required field: trackingLink' }, 400)
  }

  // Fetch the user's name
  const { data: profile } = await caller
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const userName = profile?.display_name || 'A Raksha Sutra user'

  // Fetch all emergency contacts for this user securely
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: contacts, error: contactError } = await admin
    .from('emergency_contacts')
    .select('phone_e164')
    .eq('user_id', user.id)
    .not('phone_e164', 'is', null)

  if (contactError) return json({ error: 'Failed to retrieve contacts' }, 500)
  
  if (!contacts || contacts.length === 0) {
    return json({ message: 'No emergency contacts found with a phone number' }, 200)
  }

  const message = `📍 *LIVE LOCATION SHARED*\n\n*${userName}* has shared their live location with you.\n\nTrack their real-time location here: ${trackingLink}`

  // Fire and forget sending to not block response
  const sendAlerts = async () => {
    try {
      for (const contact of contacts) {
        if (!contact.phone_e164) continue;
        
        // Try WhatsApp first
        const whatsappSuccess = await sendTwilioMessage(contact.phone_e164, message, true)
        
        // SMS Fallback
        if (!whatsappSuccess) {
          console.log(`WhatsApp failed for ${contact.phone_e164}. Attempting SMS fallback...`)
          await sendTwilioMessage(contact.phone_e164, message, false)
        }
      }
    } catch (e) {
      console.error('Fatal error in sendAlerts background worker:', e)
    }
  }

  sendAlerts() // run asynchronously

  return json({
    message: 'Location share dispatched successfully',
    contactsTargeted: contacts.length
  })
})
