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

async function sendEmailAlert(to: string, locationLink: string, userName: string, destination: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'safety@rakshasutra.in'
  if (!apiKey) {
    console.warn('RESEND_API_KEY not found. Skipping email to', to)
    return
  }

  const html = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2 style="color: #22c55e;">LIVE JOURNEY TRACKING</h2>
      <p><strong>${userName}</strong> has started a journey to <strong>${destination}</strong>.</p>
      <p>They have chosen to share their live location with you to ensure they reach their destination safely.</p>
      <a href="${locationLink}" style="display:inline-block; margin-top: 10px; padding:12px 24px; background:#22c55e; color:#fff; text-decoration:none; border-radius:6px; font-weight:bold;">Track Live Location</a>
    </div>
  `
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `📍 Journey Tracking: ${userName} is on the move`,
        html,
      }),
    })
    if (!res.ok) {
      console.error('Email send failed with status:', res.status, await res.text())
      return false
    } else {
      console.log('Email sent successfully to', to)
      return true
    }
  } catch (e) {
    console.error('Email send network error:', e)
    return false
  }
}

async function sendWhatsAppAlert(phoneE164: string, locationLink: string, userName: string, destination: string, status: 'started' | 'arrived') {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromPhone = Deno.env.get('TWILIO_WHATSAPP_NUMBER')

  if (!accountSid || !authToken || !fromPhone) {
    console.warn('Twilio credentials not found. Skipping WhatsApp to', phoneE164)
    return
  }

  let message = '';
  if (status === 'started') {
    message = `📍 *LIVE JOURNEY TRACKING*\n\n*${userName}* has started a journey to *${destination}*.\n\nTrack their live location here: ${locationLink}`;
  } else {
    message = `✅ *SAFE ARRIVAL*\n\nGreat news! *${userName}* has safely arrived at *${destination}*. Tracking has been stopped.`;
  }

  const formData = new URLSearchParams()
  formData.append('To', `whatsapp:${phoneE164}`)
  formData.append('From', fromPhone)
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
      console.error('WhatsApp send failed with status:', res.status, await res.text())
      return false
    } else {
      console.log('WhatsApp sent successfully to', phoneE164)
      return true
    }
  } catch (e) {
    console.error('WhatsApp send network error:', e)
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
  const { destination, contactIds, trackingLink, status = 'started' } = payload || {}
  
  if (!destination || !Array.isArray(contactIds) || !trackingLink) {
    return json({ error: 'Missing required fields' }, 400)
  }

  // Fetch the user's name
  const { data: profile } = await caller
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const userName = profile?.display_name || 'A Raksha Sutra user'

  // We use the service role key to securely fetch the contacts that match the provided IDs
  // AND belong to this user
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: contacts, error: contactError } = await admin
    .from('emergency_contacts')
    .select('email, phone_e164')
    .eq('user_id', user.id)
    .in('id', contactIds)

  if (contactError) return json({ error: 'Failed to retrieve contacts' }, 500)
  
  if (!contacts || contacts.length === 0) {
    return json({ message: 'No valid contacts found for the selected IDs' }, 200)
  }

  // Fire and forget email and WhatsApp sending to not block response
  const sendAlerts = async () => {
    try {
      const promises: Promise<any>[] = []
      
      for (const contact of contacts) {
        // Send email only when journey starts
        if (contact.email && status === 'started') {
          promises.push(sendEmailAlert(contact.email, trackingLink, userName, destination))
        }
        
        // Send WhatsApp for both start and arrival
        if (contact.phone_e164) {
          promises.push(sendWhatsAppAlert(contact.phone_e164, trackingLink, userName, destination, status as 'started' | 'arrived'))
        }
      }
      
      await Promise.allSettled(promises)
    } catch (e) {
      console.error('Fatal error in sendAlerts background worker:', e)
    }
  }

  sendAlerts() // run asynchronously

  return json({
    message: 'Journey dispatch successful',
    contactsTargeted: contacts.length
  })
})
