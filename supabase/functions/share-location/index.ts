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

async function sendMetaWhatsAppMessage(phoneE164: string, message: string) {
  const accessToken = Deno.env.get('META_WA_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('META_WA_PHONE_NUMBER_ID')

  if (!accessToken || !phoneNumberId) {
    return false
  }

  let cleanNumber = phoneE164.replace(/[^0-9]/g, '')
  if (cleanNumber.length === 10) cleanNumber = `91${cleanNumber}`

  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'text',
        text: { preview_url: true, body: message },
      }),
    })
    return res.ok
  } catch (e) {
    console.error('Meta WhatsApp send error:', e)
    return false
  }
}

async function sendMsg91Sms(phoneE164: string, message: string) {
  const authKey = Deno.env.get('MSG91_AUTH_KEY')
  const senderId = Deno.env.get('MSG91_SENDER_ID') || 'RAKSHA'

  if (!authKey) return false

  let cleanNumber = phoneE164.replace(/[^0-9]/g, '')
  if (cleanNumber.length === 10) cleanNumber = `91${cleanNumber}`

  try {
    const url = `https://control.msg91.com/api/v5/flow/?authkey=${authKey}&mobiles=${cleanNumber}&message=${encodeURIComponent(message)}&sender=${senderId}&route=4`
    const res = await fetch(url, { method: 'POST' })
    return res.ok
  } catch (e) {
    console.error('MSG91 send error:', e)
    return false
  }
}


async function sendLocationEmail(to: string, trackingLink: string, userName: string, senderEmail: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  let from = Deno.env.get('RESEND_FROM_EMAIL') ?? Deno.env.get('CONFIRMATION_FROM_EMAIL') ?? 'safety@rakshasutra.in'
  if (from.includes('rakshasutra.com')) from = from.replace('rakshasutra.com', 'rakshasutra.in')
  if (!apiKey) {
    console.warn('[Share Location] RESEND_API_KEY not set. Skipping email to', to)
    return false
  }

  const html = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
        <img src="https://rakshasutra.in/logo.png" alt="Rakshasutra Logo" style="height: 80px; width: auto; margin-bottom: 10px;" />
        <h1 style="color: #1e293b; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Rakshasutra</h1>
      </div>
      <h2 style="color: #0f172a; margin-top: 0;">📍 Current Location Shared</h2>
      <p style="font-size: 16px; color: #334155; line-height: 1.5;"><strong>${senderEmail} (${userName})</strong> has shared their current location with you via Rakshasutra.</p>
      <p style="font-size: 16px; color: #334155; margin-bottom: 24px;">Click the button below to view their location on Google Maps:</p>
      <div style="text-align: center;">
        <a href="${trackingLink}" style="display:inline-block; padding:14px 28px; background:#16a34a; color:#fff; text-decoration:none; border-radius:8px; font-weight:bold; font-size: 16px; box-shadow: 0 4px 6px rgba(22,163,74,0.2);">View Location</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; text-align: center;">This message was sent automatically by Rakshasutra Safety Platform.</p>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `📍 ${userName} shared their live location with you`,
        html,
      }),
    })
    if (!res.ok) {
      console.error('[Share Location] Email failed:', res.status, await res.text())
      return false
    }
    console.log('[Share Location] Email sent to', to)
    return true
  } catch (e) {
    console.error('[Share Location] Email network error:', e)
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

  // Fetch all emergency contacts for this user securely (phone + email)
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: contacts, error: contactError } = await admin
    .from('emergency_contacts')
    .select('phone_e164, email')
    .eq('user_id', user.id)

  if (contactError) return json({ error: 'Failed to retrieve contacts' }, 500)
  
  if (!contacts || contacts.length === 0) {
    return json({ message: 'No emergency contacts found' }, 200)
  }

  const message = `📍 *CURRENT LOCATION SHARED*\n\n*${userName}* has shared their current location with you.\n\nView their location here: ${trackingLink}`

  // Fire and forget sending to not block response
  const sendAlerts = async () => {
    try {
      const sentEmails = new Set<string>()
      const promises = contacts.map(async (contact: any) => {
        // 1. Send email FIRST (highest deliverability, works without phone number)
        if (contact.email && !sentEmails.has(contact.email)) {
          sentEmails.add(contact.email)
          await sendLocationEmail(contact.email, trackingLink, userName, user.email ?? '')
        }

        // 2. Then send WhatsApp/SMS for contacts with a phone number
        if (!contact.phone_e164) return;

        // Try Meta WhatsApp Cloud API
        let sent = await sendMetaWhatsAppMessage(contact.phone_e164, message)

        // Fallback to MSG91 Indian SMS
        if (!sent) {
          console.log(`[Share Location] WhatsApp not available for ${contact.phone_e164}. Attempting MSG91 SMS fallback...`)
          await sendMsg91Sms(contact.phone_e164, message)
        }
      });
      await Promise.allSettled(promises);
    } catch (e) {
      console.error('Fatal error in sendAlerts background worker:', e)
    }
  }

  await sendAlerts() // wait for completion

  return json({
    message: 'Location share dispatched successfully',
    contactsTargeted: contacts.length
  })
})
