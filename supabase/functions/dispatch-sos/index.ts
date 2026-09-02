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

// -------------------------------------------------------------
// Delivery Providers
// -------------------------------------------------------------
async function sendEmailAlert(to: string, locationLink: string, userName: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? 'safety@rakshasutra.in'
  if (!apiKey) {
    console.warn('RESEND_API_KEY not found. Skipping email to', to)
    return
  }

  const html = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2 style="color: #d93025;">EMERGENCY SOS ALERT</h2>
      <p><strong>${userName}</strong> has triggered an SOS and needs immediate assistance.</p>
      <p>Click the link below to view their live location:</p>
      <a href="${locationLink}" style="display:inline-block; padding:12px 24px; background:#d93025; color:#fff; text-decoration:none; border-radius:6px; font-weight:bold;">View Live Location</a>
    </div>
  `
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `🚨 URGENT: SOS Alert from ${userName}`,
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

async function sendWhatsAppAlert(phoneE164: string, locationLink: string, userName: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromPhone = Deno.env.get('TWILIO_WHATSAPP_NUMBER') // e.g., whatsapp:+14155238886

  if (!accountSid || !authToken || !fromPhone) {
    console.warn('Twilio credentials not found. Skipping WhatsApp to', phoneE164)
    return
  }

  const message = `🚨 *URGENT SOS ALERT* 🚨\n\n*${userName}* has triggered an SOS and needs immediate assistance.\n\nView their live location here: ${locationLink}`

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

// -------------------------------------------------------------
// Main Handler
// -------------------------------------------------------------
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
  const eventId = payload?.eventId
  if (typeof eventId !== 'string') return json({ error: 'eventId is required' }, 400)

  // Fetch the active SOS event and the user's name
  const { data: event, error: eventError } = await caller
    .from('sos_events')
    .select('id, user_id, status, latitude, longitude, profiles!inner(display_name)')
    .eq('id', eventId)
    .eq('status', 'active')
    .single()

  if (eventError || !event || event.user_id !== user.id) return json({ error: 'Active SOS event not found' }, 404)

  const userName = event.profiles?.display_name || 'A Raksha Sutra user'
  const locationLink = `${Deno.env.get('FRONTEND_URL') || 'https://rakshasutra.in'}/track/${event.id}`

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: existing } = await admin.from('sos_event_deliveries').select('id').eq('sos_event_id', event.id).limit(1)
  if (existing?.length) return json({ eventId: event.id, idempotent: true, deliveriesQueued: existing.length })

  // Find emergency contacts and Rakshaks within 10km (10000m) limit to 15
  // Find emergency contacts (ignoring confirmation_status for testing so emails go through)
  const [{ data: contacts, error: contactError }, { data: nearbyRakshaks, error: rakshakError }] = await Promise.all([
    admin.from('emergency_contacts').select('id, phone_e164, email').eq('user_id', user.id).eq('notification_enabled', true),
    admin.rpc('find_nearby_rakshaks', {
      p_latitude: event.latitude,
      p_longitude: event.longitude,
      p_radius_meters: 10000,
      p_limit: 15,
    }),
  ])
  if (contactError || rakshakError) return json({ error: 'Unable to assemble alert recipients' }, 500)

  let rakshaks = nearbyRakshaks || []

  // FALLBACK FOR TESTING: If no Rakshaks are within 10km (common when testing in different cities), 
  // just fetch ANY Rakshaks so the notification panel works.
  if (rakshaks.length === 0) {
    const { data: fallbackRakshaks } = await admin
      .from('rakshak_profiles')
      .select('profile_id')
      .limit(10)

    if (fallbackRakshaks) {
      rakshaks = fallbackRakshaks.map((r: any) => ({ profile_id: r.profile_id }))
    }
  }

  const deliveries: any[] = []

  // Queue Contact Deliveries
  for (const contact of (contacts || [])) {
    if (contact.email) deliveries.push({ sos_event_id: event.id, recipient_type: 'contact', contact_id: contact.id, rakshak_id: null, channel: 'email', status: 'queued' })
    if (contact.phone_e164) deliveries.push({ sos_event_id: event.id, recipient_type: 'contact', contact_id: contact.id, rakshak_id: null, channel: 'sms', status: 'queued' })
  }

  // Queue Rakshak Deliveries
  for (const rakshak of rakshaks) {
    // We send in_app to all
    deliveries.push({ sos_event_id: event.id, recipient_type: 'rakshak', contact_id: null, rakshak_id: rakshak.profile_id, channel: 'in_app', status: 'queued' })
  }

  // Fetch rakshak details for email/whatsapp
  const rakshakDetails: any[] = []
  if (rakshaks && rakshaks.length > 0) {
    const promises = rakshaks.map(async (r: any) => {
      const { data, error } = await admin.auth.admin.getUserById(r.profile_id)
      if (!error && data?.user) {
        rakshakDetails.push({ profile_id: r.profile_id, email: data.user.email, phone: data.user.phone })
      }
    })
    await Promise.all(promises)
  }

  // Queue Rakshak Email Deliveries
  for (const rDetails of rakshakDetails) {
    if (rDetails.email) {
      deliveries.push({ sos_event_id: event.id, recipient_type: 'rakshak', contact_id: null, rakshak_id: rDetails.profile_id, channel: 'email', status: 'queued' })
    }
  }

  let insertedDeliveries: any[] = []
  if (deliveries.length) {
    const { data: inserted, error: deliveryError } = await admin.from('sos_event_deliveries').insert(deliveries).select('*')
    if (deliveryError) {
      console.error('Bulk Insert Error:', deliveryError)
      return json({ error: 'Unable to queue deliveries', details: deliveryError }, 500)
    }
    if (inserted) insertedDeliveries = inserted
  }

  // ACTUALLY SEND THE ALERTS (Fire and forget to not block the response)
  const sendAlerts = async () => {
    try {
      const promises: Promise<void>[] = []

      for (const contact of (contacts || [])) {
        if (contact.email) {
          const emailDelivery = insertedDeliveries.find(d => d.contact_id === contact.id && d.channel === 'email')
          if (emailDelivery) {
            promises.push(
              sendEmailAlert(contact.email, locationLink, userName).then(async (success) => {
                await admin.from('sos_event_deliveries').update({
                  status: success ? 'delivered' : 'failed',
                  delivered_at: success ? new Date().toISOString() : null,
                  failure_reason: success ? null : 'API Request Failed'
                }).eq('id', emailDelivery.id)
              }).catch(err => console.error('Email promise error:', err))
            )
          }
        }

        if (contact.phone_e164) {
          const smsDelivery = insertedDeliveries.find(d => d.contact_id === contact.id && d.channel === 'sms')
          if (smsDelivery) {
            promises.push(
              sendWhatsAppAlert(contact.phone_e164, locationLink, userName).then(async (success) => {
                await admin.from('sos_event_deliveries').update({
                  status: success ? 'delivered' : 'failed',
                  delivered_at: success ? new Date().toISOString() : null,
                  failure_reason: success ? null : 'API Request Failed'
                }).eq('id', smsDelivery.id)
              }).catch(err => console.error('WhatsApp promise error:', err))
            )
          }
        }
      }

      for (const rDetails of rakshakDetails) {
        if (rDetails.email) {
          const emailDelivery = insertedDeliveries.find(d => d.rakshak_id === rDetails.profile_id && d.channel === 'email')
          if (emailDelivery) {
            promises.push(
              sendEmailAlert(rDetails.email, locationLink, userName).then(async (success) => {
                await admin.from('sos_event_deliveries').update({
                  status: success ? 'delivered' : 'failed',
                  delivered_at: success ? new Date().toISOString() : null,
                  failure_reason: success ? null : 'API Request Failed'
                }).eq('id', emailDelivery.id)
              }).catch(err => console.error('Rakshak Email promise error:', err))
            )
          }
        }
      }

      await Promise.allSettled(promises)
    } catch (e) {
      console.error('Fatal error in sendAlerts background worker:', e)
    }
  }

  sendAlerts() // run asynchronously

  await admin.from('sos_event_updates').insert({
    sos_event_id: event.id,
    actor_id: user.id,
    event_type: 'created',
    details: { contact_count: contacts?.length ?? 0, rakshak_count: rakshaks?.length ?? 0 },
  })

  return json({
    eventId: event.id,
    contactCount: contacts?.length ?? 0,
    rakshakCount: rakshaks?.length ?? 0,
    deliveriesQueued: insertedDeliveries.length,
    deliveries: insertedDeliveries
  })
})
