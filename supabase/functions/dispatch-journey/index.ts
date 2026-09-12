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

function formatEta(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null
  const totalMins = Math.max(1, Math.round(seconds / 60))
  if (totalMins < 60) return `${totalMins} mins`
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  return mins > 0 ? `${hrs} hr ${mins} mins` : `${hrs} hr`
}

function formatDistance(meters: number | null | undefined): string | null {
  if (!meters || meters <= 0) return null
  return (meters / 1000).toFixed(1) + ' km'
}

async function sendMetaWhatsAppMessage(phoneE164: string, message: string): Promise<boolean> {
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

async function sendMsg91Sms(phoneE164: string, message: string): Promise<boolean> {
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

async function sendEmailAlert(
  to: string,
  locationLink: string,
  userName: string,
  destination: string,
  userEmail: string,
  etaFormatted: string | null,
  distanceFormatted: string | null,
  transportMode?: string
) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  let from = Deno.env.get('RESEND_FROM_EMAIL') ?? Deno.env.get('CONFIRMATION_FROM_EMAIL') ?? 'safety@rakshasutra.in'
  if (from.includes('rakshasutra.com')) from = from.replace('rakshasutra.com', 'rakshasutra.in')
  if (!apiKey) {
    console.warn('RESEND_API_KEY not found. Skipping email to', to)
    return false
  }

  const modeLabel = transportMode ? transportMode.charAt(0).toUpperCase() + transportMode.slice(1) : ''

  const html = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
        <img src="https://rakshasutra.in/logo.png" alt="Rakshasutra Logo" style="height: 60px; width: auto; margin-bottom: 8px;" />
        <h1 style="color: #1e293b; margin: 0; font-size: 22px; font-weight: 800;">Rakshasutra</h1>
      </div>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h2 style="color: #16a34a; margin: 0 0 6px; font-size: 18px;">📍 Live Journey Tracking</h2>
        <p style="color: #166534; margin: 0; font-size: 14px;">
          <strong>${userName}</strong> (${userEmail}) has started a journey to <strong>${destination}</strong>.
        </p>
      </div>

      ${etaFormatted ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
        <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
          Estimated Travel Time (ETA)
        </div>
        <div style="font-size: 26px; font-weight: 800; color: #16a34a; margin: 4px 0;">
          ~${etaFormatted}
        </div>
        <div style="font-size: 13px; color: #475569; margin-top: 4px;">
          ${distanceFormatted ? `Distance: <strong>${distanceFormatted}</strong>` : ''}
          ${modeLabel ? `${distanceFormatted ? ' &bull; ' : ''}Mode: <strong>${modeLabel}</strong>` : ''}
        </div>
      </div>` : ''}

      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
        They have shared their live tracking link with you so you can follow their journey in real time until they arrive safely.
      </p>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${locationLink}" style="display:inline-block; padding:14px 28px; background:#16a34a; color:#fff; text-decoration:none; border-radius:8px; font-weight:bold; font-size: 16px; box-shadow: 0 4px 10px rgba(22,163,74,0.25);">
          Track Live Journey
        </a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px;">
        This automated notification was sent by the Rakshasutra Safety Network.
      </p>
    </div>
  `
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `📍 Journey Tracking: ${userName} is heading to ${destination}${etaFormatted ? ` (ETA: ~${etaFormatted})` : ''}`,
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
  const {
    destination,
    contactIds,
    trackingLink,
    status = 'started',
    etaSeconds,
    distanceMeters,
    transportMode,
  } = payload || {}

  if (!destination || !Array.isArray(contactIds) || !trackingLink) {
    return json({ error: 'Missing required fields' }, 400)
  }

  // Format ETA and distance
  const etaFormatted = formatEta(etaSeconds)
  const distanceFormatted = formatDistance(distanceMeters)

  // Fetch the user's name
  const { data: profile } = await caller
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const userName = profile?.display_name || 'A Raksha Sutra user'
  const userEmail = user.email || ''

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
        let message = ''
        if (status === 'started') {
          const modeStr = transportMode ? ` (${transportMode})` : ''
          const etaLine = etaFormatted
            ? `\n⏱️ *Estimated Arrival:* ~${etaFormatted}${distanceFormatted ? ` (${distanceFormatted})` : ''}`
            : ''
          message = `📍 *LIVE JOURNEY TRACKING*\n\n*${userName}* has started a journey to *${destination}*${modeStr}.${etaLine}\n\nTrack their live location here: ${trackingLink}`
        } else {
          message = `✅ *SAFE ARRIVAL*\n\nGreat news! *${userName}* has safely arrived at *${destination}*. Tracking has ended.`
        }

        // Send WhatsApp/SMS for both start and arrival
        if (contact.phone_e164) {
          promises.push((async () => {
            // 1. Try Meta WhatsApp first
            const success = await sendMetaWhatsAppMessage(contact.phone_e164, message)
            // 2. Fallback to MSG91 SMS
            if (!success) {
              console.log(`WhatsApp failed for ${contact.phone_e164}, trying MSG91 SMS...`)
              await sendMsg91Sms(contact.phone_e164, message)
            }
          })())
        }

        // Send email only when journey starts
        if (contact.email && status === 'started') {
          promises.push(
            sendEmailAlert(
              contact.email,
              trackingLink,
              userName,
              destination,
              userEmail,
              etaFormatted,
              distanceFormatted,
              transportMode
            )
          )
        }
      }

      await Promise.allSettled(promises)
    } catch (e) {
      console.error('Fatal error in sendAlerts background worker:', e)
    }
  }

  await sendAlerts() // wait for completion

  return json({
    message: 'Journey dispatch successful',
    contactsTargeted: contacts.length,
    etaFormatted,
    distanceFormatted,
  })
})
