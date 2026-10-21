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

function isUuid(val: any): boolean {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
}

function runBackground(task: Promise<any>) {
  // @ts-ignore
  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
    // @ts-ignore
    EdgeRuntime.waitUntil(task)
  } else {
    task.catch(err => console.error('[Background SOS Alert Error]:', err))
  }
}

// -------------------------------------------------------------
// Delivery Providers: Email (Resend)
// -------------------------------------------------------------
async function sendEmailAlert(to: string, locationLink: string, userName: string, userEmail: string) {
  const apiKey = (Deno.env.get('RESEND_API_KEY') || '').replace(/^["']|["']$/g, '').trim()
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured in environment. Skipping email alert to', to)
    return false
  }
  let from = 'Rakshasutra <safety@rakshasutra.in>'

  const html = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
        <img src="https://rakshasutra.in/logo.png" alt="Rakshasutra Logo" style="height: 80px; width: auto; margin-bottom: 10px;" />
        <h1 style="color: #1e293b; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Rakshasutra</h1>
      </div>
      <h2 style="color: #d93025; margin-top: 0;">🚨 EMERGENCY SOS ALERT</h2>
      <p style="font-size: 16px; color: #334155; line-height: 1.5;"><strong>${userEmail} (${userName})</strong> has triggered an SOS and needs immediate assistance.</p>
      <p style="font-size: 16px; color: #334155; margin-bottom: 24px;">Click the button below to view their live location and track their movement in real-time:</p>
      <div style="text-align: center;">
        <a href="${locationLink}" style="display:inline-block; padding:14px 28px; background:#d93025; color:#fff; text-decoration:none; border-radius:8px; font-weight:bold; font-size: 16px; box-shadow: 0 4px 6px rgba(217, 48, 37, 0.2);">View Live Location</a>
      </div>
    </div>
  `
  console.log(`[Email] Dispatching to "${to}" from "${from}"`)
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: `🚨 URGENT: SOS Alert from ${userEmail} (${userName})`,
        html,
      }),
      signal: AbortSignal.timeout(6000), // Max 6s timeout
    })
    const resBody = await res.text()
    if (!res.ok) {
      console.error(`[Email] FAILED to send to ${to}. Status: ${res.status}. Response: ${resBody}`)
      return false
    } else {
      console.log(`[Email] SUCCESS sent to ${to}. Response: ${resBody}`)
      return true
    }
  } catch (e) {
    console.error('[Email] Network error sending to', to, ':', e)
    return false
  }
}

// -------------------------------------------------------------
// Meta WhatsApp Cloud API (With 3s Abort Timeout)
// -------------------------------------------------------------
async function sendMetaWhatsAppMessage(phoneE164: string, userName: string, locationLink: string) {
  const accessToken = Deno.env.get('META_WA_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('META_WA_PHONE_NUMBER_ID')
  const templateName = Deno.env.get('META_WA_TEMPLATE_NAME')

  if (!accessToken || !phoneNumberId) return false

  let cleanNumber = phoneE164.replace(/[^0-9]/g, '')
  if (cleanNumber.length === 10) cleanNumber = `91${cleanNumber}`

  const endpoint = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`
  let payload: any
  if (templateName) {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanNumber,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: userName },
              { type: 'text', text: locationLink },
            ],
          },
        ],
      },
    }
  } else {
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanNumber,
      type: 'text',
      text: {
        preview_url: true,
        body: `🚨 *URGENT SOS ALERT - RAKSHA SUTRA* 🚨\n\n*${userName}* has triggered an emergency SOS and needs your immediate help!\n\n📍 Live Tracking Link:\n${locationLink}\n\nPlease respond or contact authorities immediately.`,
      },
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
  } catch {
    return false
  }
}

// -------------------------------------------------------------
// MSG91 Automated Indian SMS Dispatch (With 3s Abort Timeout)
// -------------------------------------------------------------
async function sendMsg91Sms(phoneE164: string, userName: string, locationLink: string) {
  const authKey = Deno.env.get('MSG91_AUTH_KEY')
  const flowId = Deno.env.get('MSG91_FLOW_ID')
  const senderId = Deno.env.get('MSG91_SENDER_ID') || 'RAKSHA'

  if (!authKey) return false

  let cleanNumber = phoneE164.replace(/[^0-9]/g, '')
  if (cleanNumber.length === 10) cleanNumber = `91${cleanNumber}`

  try {
    let res: Response
    if (flowId) {
      res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { authkey: authKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: flowId,
          sender: senderId,
          short_url: '0',
          recipients: [{ mobiles: cleanNumber, user_name: userName, location_link: locationLink }],
        }),
        signal: AbortSignal.timeout(3000),
      })
    } else {
      const message = `URGENT SOS: ${userName} triggered an emergency alert on Raksha Sutra. Track live: ${locationLink}`
      const url = `https://control.msg91.com/api/v5/flow/?authkey=${authKey}&mobiles=${cleanNumber}&message=${encodeURIComponent(message)}&sender=${senderId}&route=4`
      res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(3000) })
    }
    return res.ok
  } catch {
    return false
  }
}

// -------------------------------------------------------------
// Main Handler
// -------------------------------------------------------------
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authorization = request.headers.get('Authorization') || request.headers.get('apikey') || ''

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') || readPlatformKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || readPlatformKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !publishableKey || !secretKey) return json({ error: 'Server is not configured' }, 500)

    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const payload = await request.json().catch(() => null)
    const eventId = payload?.eventId
    const frontendUrl = payload?.frontendUrl
    if (typeof eventId !== 'string') return json({ error: 'eventId is required' }, 400)

    // Authenticate caller (multiple failsafe strategies)
    let user: any = null
    try {
      const caller = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: authorization } },
      })
      const { data: callerUserData } = await caller.auth.getUser()
      if (callerUserData?.user) user = callerUserData.user
    } catch (e) {
      console.warn('[SOS Dispatch] caller.auth.getUser warning:', e)
    }

    if (!user) {
      try {
        const token = authorization.replace(/^Bearer\s+/i, '')
        const { data: adminUserData } = await admin.auth.getUser(token)
        if (adminUserData?.user) user = adminUserData.user
      } catch (e) {
        console.warn('[SOS Dispatch] admin.auth.getUser warning:', e)
      }
    }

    // Fetch the active SOS event directly using admin (bypasses RLS)
    const { data: event, error: eventError } = await admin
      .from('sos_events')
      .select('id, user_id, status, latitude, longitude')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      console.error(`[SOS Dispatch] Active SOS event ${eventId} not found:`, eventError)
      return json({ error: 'Active SOS event not found', details: eventError?.message }, 404)
    }

    // Emergency Failsafe: if client token was expired or missing, trust event owner from DB
    if (!user && event.user_id) {
      const { data: ownerUser } = await admin.auth.admin.getUserById(event.user_id).catch(() => ({ data: null }))
      if (ownerUser?.user) {
        user = ownerUser.user
        console.log(`[SOS Dispatch] Authenticated via event owner fallback: ${user.id} (${user.email})`)
      }
    }

    if (!user || (event.user_id !== user.id && user.role !== 'service_role')) {
      return json({ error: 'Unauthorized for this SOS event' }, 403)
    }

    console.log(`[SOS Dispatch] Starting dispatch for event ${eventId} from user ${user.id} (${user.email})`)

    // Fetch caller's profile and emergency contacts in parallel
    const [{ data: userProfile }, { data: contacts }] = await Promise.all([
      admin.from('profiles').select('display_name, phone').eq('id', user.id).maybeSingle(),
      admin.from('emergency_contacts').select('id, name, phone_e164, email').eq('user_id', user.id),
    ])

    const userName = userProfile?.display_name || user.user_metadata?.display_name || (user.email ? user.email.split('@')[0] : 'A Raksha Sutra user')
    const userEmail = user.email || ''
    const locationLink = `${frontendUrl || Deno.env.get('FRONTEND_URL') || 'https://rakshasutra.in'}/track/${event.id}`

    const allContacts = contacts ? [...contacts] : []

    // -------------------------------------------------------------
    // ⚡ 1. ZERO-LATENCY PARALLEL EMAIL DISPATCH (FIRES IN FIRST 50MS!)
    // Must execute immediately — no waiting for Rakshak DB discovery or inserts!
    // -------------------------------------------------------------
    const emailTargets = new Set<string>()
    const emailDispatchList: Array<{ to: string; label: string }> = []

    // Ensure caller NEVER receives distress email
    const callerEmail = userEmail ? userEmail.trim().toLowerCase() : ''
    if (callerEmail) {
      emailTargets.add(callerEmail)
    }

    // High Priority 1: Designated Responder (yash02arcade@gmail.com)
    if (!emailTargets.has('yash02arcade@gmail.com')) {
      emailTargets.add('yash02arcade@gmail.com')
      emailDispatchList.push({ to: 'yash02arcade@gmail.com', label: 'DesignatedRakshak' })
    }

    // High Priority 2: All Emergency Contacts with email (skipping caller's own email)
    for (const c of allContacts) {
      if (c.email) {
        const cEmail = c.email.trim().toLowerCase()
        if (!emailTargets.has(cEmail)) {
          emailTargets.add(cEmail)
          emailDispatchList.push({ to: c.email.trim(), label: 'Contact' })
        }
      }
    }

    // Priority 3: Monitoring Inbox
    if (!emailTargets.has('rakshaasutra@gmail.com')) {
      emailTargets.add('rakshaasutra@gmail.com')
      emailDispatchList.push({ to: 'rakshaasutra@gmail.com', label: 'Monitor' })
    }

    console.log(`[SOS Dispatch] ⚡ Firing ${emailDispatchList.length} instant parallel emails to:`, emailDispatchList.map(e => e.to))

    // Launch email dispatches immediately in parallel
    const emailSendPromise = Promise.allSettled(
      emailDispatchList.map(async ({ to, label }) => {
        try {
          const ok = await sendEmailAlert(to, locationLink, userName, userEmail)
          return { to, ok }
        } catch (err: any) {
          console.error(`[Email:${label}] Error sending to ${to}:`, err)
          return { to, ok: false, error: err.message }
        }
      })
    )

    // -------------------------------------------------------------
    // 2. Discover nearby Rakshaks and register deliveries
    // -------------------------------------------------------------
    const { data: nearbyRakshaks } = await admin.rpc('find_nearby_rakshaks', {
      p_latitude: event.latitude,
      p_longitude: event.longitude,
      p_radius_meters: 15000,
      p_limit: 15,
    }).catch(() => ({ data: [] }))

    let rakshaks: Array<{ profile_id: string }> = []
    if (nearbyRakshaks && nearbyRakshaks.length > 0) {
      for (const r of nearbyRakshaks) {
        if (r.profile_id) {
          rakshaks.push({ profile_id: r.profile_id })
        }
      }
    }

    // Fallback: Query registered Rakshaks in rakshak_profiles
    const { data: registeredRakshaks } = await admin
      .from('rakshak_profiles')
      .select('profile_id, status')
      .limit(30)

    if (registeredRakshaks && registeredRakshaks.length > 0) {
      for (const r of registeredRakshaks) {
        if (r.profile_id && !rakshaks.some(existing => existing.profile_id === r.profile_id)) {
          rakshaks.push({ profile_id: r.profile_id })
        }
      }
    }

    // Also look up Supabase auth users for designated email recipients
    // so they get in-app delivery rows for the Realtime popup notification
    const designatedEmails = emailDispatchList
      .map(e => e.to.trim().toLowerCase())
      .filter(e => e !== callerEmail) // exclude caller
    
    let allAuthUsers: any[] = []
    try {
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 })
      if (usersData?.users) allAuthUsers = usersData.users
    } catch (lookupErr) {
      console.warn('[SOS Dispatch] Could not list auth users:', lookupErr)
    }

    for (const email of designatedEmails) {
      const matchedUser = allAuthUsers.find(
        (u: any) => u.email?.toLowerCase() === email
      )
      if (matchedUser && !rakshaks.some(existing => existing.profile_id === matchedUser.id)) {
        rakshaks.push({ profile_id: matchedUser.id })
        console.log(`[SOS Dispatch] Added email recipient ${email} (${matchedUser.id}) for in-app alert`)
      }
    }

    // Ensure the testing session user receives the in-app alert delivery so the popup and siren trigger
    if (user?.id && !rakshaks.some(existing => existing.profile_id === user.id)) {
      rakshaks.push({ profile_id: user.id })
    }

    // Fetch Rakshak profile details (names and phones)
    const rakshakIds = rakshaks.map(r => r.profile_id)
    const rakshakDetails: Array<{ profile_id: string; displayName: string; phone: string | null }> = []

    if (rakshakIds.length > 0) {
      const { data: rProfiles } = await admin
        .from('profiles')
        .select('id, display_name, phone')
        .in('id', rakshakIds)

      for (const p of rProfiles || []) {
        rakshakDetails.push({
          profile_id: p.id,
          displayName: p.display_name || 'Verified Volunteer',
          phone: p.phone || null,
        })
      }
    }

    // Await email results
    const settledEmails = await emailSendPromise
    const emailResults = settledEmails.map(r => r.status === 'fulfilled' ? r.value : { to: 'unknown', ok: false })
    const successfulEmails = new Set(emailResults.filter(r => r.ok).map(r => r.to.toLowerCase()))

    // -------------------------------------------------------------
    // 3. Build & Insert delivery records
    // -------------------------------------------------------------
    const deliveriesToInsert: any[] = []

    // Contact deliveries (skip caller)
    for (const contact of allContacts) {
      const contactEmail = contact.email ? contact.email.trim().toLowerCase() : ''
      if (callerEmail && contactEmail === callerEmail) {
        continue // Skip caller
      }
      if (contact.id && isUuid(contact.id)) {
        if (contact.email) {
          deliveriesToInsert.push({
            sos_event_id: event.id,
            recipient_type: 'contact',
            contact_id: contact.id,
            rakshak_id: null,
            channel: 'email',
            status: successfulEmails.has(contactEmail) ? 'delivered' : 'queued',
            delivered_at: successfulEmails.has(contactEmail) ? new Date().toISOString() : null,
          })
        }
        if (contact.phone_e164) {
          deliveriesToInsert.push({
            sos_event_id: event.id,
            recipient_type: 'contact',
            contact_id: contact.id,
            rakshak_id: null,
            channel: 'sms',
            status: 'queued',
          })
        }
      }
    }

    // Rakshak deliveries: channel 'push' with status 'queued' triggers in-app Realtime notification in App.tsx
    for (const r of rakshaks) {
      deliveriesToInsert.push({
        sos_event_id: event.id,
        recipient_type: 'rakshak',
        contact_id: null,
        rakshak_id: r.profile_id,
        channel: 'push',
        status: 'queued',
        delivered_at: new Date().toISOString(),
      })
    }

    // Insert deliveries into DB
    let insertedDeliveries: any[] = []
    if (deliveriesToInsert.length > 0) {
      const { data: inserted, error: insErr } = await admin
        .from('sos_event_deliveries')
        .insert(deliveriesToInsert)
        .select('*')

      if (!insErr && inserted) {
        insertedDeliveries = inserted
      } else {
        console.warn('[SOS Dispatch] Delivery insert warning:', insErr?.message)
        insertedDeliveries = deliveriesToInsert.map((d, i) => ({ ...d, id: `deliv-${i}` }))
      }
    }

    // 4. Background WhatsApp & SMS Dispatch
    const phonePromises: Promise<any>[] = []
    const sentPhones = new Set<string>()

    for (const contact of allContacts) {
      if (contact.phone_e164 && !sentPhones.has(contact.phone_e164)) {
        sentPhones.add(contact.phone_e164)
        phonePromises.push(
          (async () => {
            let ok = await sendMetaWhatsAppMessage(contact.phone_e164!, userName, locationLink)
            if (!ok) ok = await sendMsg91Sms(contact.phone_e164!, userName, locationLink)
            return ok
          })()
        )
      }
    }

    if (phonePromises.length > 0) {
      runBackground(Promise.allSettled(phonePromises))
    }

    // Enrich deliveries for frontend
    const enrichedDeliveries = insertedDeliveries.map((d: any) => {
      if (d.recipient_type === 'rakshak') {
        const rInfo = rakshakDetails.find(r => r.profile_id === d.rakshak_id)
        return {
          ...d,
          recipient_name: rInfo?.displayName || 'Verified Volunteer',
          recipient_sub: 'Verified Volunteer',
        }
      }
      if (d.recipient_type === 'contact') {
        const cInfo = allContacts.find(c => c.id === d.contact_id)
        return {
          ...d,
          recipient_name: cInfo?.name || 'Emergency Contact',
          recipient_sub: 'Emergency Contact',
        }
      }
      return d
    })

    console.log(`[SOS Dispatch] SUCCESS. ${enrichedDeliveries.length} deliveries, ${emailResults.length} emails dispatched`)
    return json({
      eventId: event.id,
      contactCount: allContacts.length,
      rakshakCount: rakshakDetails.length,
      deliveriesQueued: enrichedDeliveries.length,
      deliveries: enrichedDeliveries,
      _debug_emails: emailResults,
    })
  } catch (err: any) {
    console.error('[SOS Dispatch FATAL ERROR]:', err)
    return json({ error: err.message || 'Internal Server Error' }, 500)
  }
})
