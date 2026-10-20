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
async function sendEmailAlert(to: string, locationLink: string, userName: string, userEmail: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  let from = Deno.env.get('RESEND_FROM_EMAIL') ?? Deno.env.get('CONFIRMATION_FROM_EMAIL') ?? 'safety@rakshasutra.in'
  if (from.includes('rakshasutra.com')) from = from.replace('rakshasutra.com', 'rakshasutra.in')
  if (!apiKey) {
    console.warn('RESEND_API_KEY not found. Skipping email to', to)
    return false
  }

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
  console.log(`[Email] Attempting to send SOS email from="${from}" to="${to}" subject="SOS Alert from ${userEmail}"`)
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
// Meta WhatsApp Cloud API (Automated Server Dispatch)
// -------------------------------------------------------------
async function sendMetaWhatsAppMessage(phoneE164: string, userName: string, locationLink: string) {
  const accessToken = Deno.env.get('META_WA_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('META_WA_PHONE_NUMBER_ID')
  const templateName = Deno.env.get('META_WA_TEMPLATE_NAME')

  if (!accessToken || !phoneNumberId) {
    console.warn('[Meta WhatsApp] Missing META_WA_ACCESS_TOKEN or META_WA_PHONE_NUMBER_ID. Skipping WhatsApp to', phoneE164)
    return false
  }

  // Format phone number: Remove '+', spaces, dashes. India default prefix is 91.
  let cleanNumber = phoneE164.replace(/[^0-9]/g, '')
  if (cleanNumber.length === 10) {
    cleanNumber = `91${cleanNumber}`
  }

  const endpoint = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

  // If a template is configured in Meta Business Manager, use template format (Required for business-initiated alerts)
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
    // Session / Test mode text message
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
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[Meta WhatsApp] Send failed with status:', res.status, errText)
      return false
    }

    const data = await res.json()
    console.log('[Meta WhatsApp] Successfully dispatched to', cleanNumber, 'Message ID:', data?.messages?.[0]?.id)
    return true
  } catch (e) {
    console.error('[Meta WhatsApp] Network error:', e)
    return false
  }
}

// -------------------------------------------------------------
// MSG91 Automated Indian SMS Dispatch
// -------------------------------------------------------------
async function sendMsg91Sms(phoneE164: string, userName: string, locationLink: string) {
  const authKey = Deno.env.get('MSG91_AUTH_KEY')
  const flowId = Deno.env.get('MSG91_FLOW_ID') // Template / Flow ID approved on DLT
  const senderId = Deno.env.get('MSG91_SENDER_ID') || 'RAKSHA'

  if (!authKey) {
    console.warn('[MSG91 SMS] Missing MSG91_AUTH_KEY. Skipping SMS to', phoneE164)
    return false
  }

  let cleanNumber = phoneE164.replace(/[^0-9]/g, '')
  if (cleanNumber.length === 10) {
    cleanNumber = `91${cleanNumber}`
  }

  try {
    let res: Response
    if (flowId) {
      // Flow API (DLT-compliant template dispatch)
      res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          authkey: authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: flowId,
          sender: senderId,
          short_url: '0',
          recipients: [
            {
              mobiles: cleanNumber,
              user_name: userName,
              location_link: locationLink,
            },
          ],
        }),
      })
    } else {
      // Quick SMS API (for testing without pre-configured flow)
      const message = `URGENT SOS: ${userName} triggered an emergency alert on Raksha Sutra. Track live: ${locationLink}`
      const url = `https://control.msg91.com/api/v5/flow/?authkey=${authKey}&mobiles=${cleanNumber}&message=${encodeURIComponent(message)}&sender=${senderId}&route=4`
      res = await fetch(url, { method: 'POST' })
    }

    if (!res.ok) {
      const errText = await res.text()
      console.error('[MSG91 SMS] Send failed with status:', res.status, errText)
      return false
    }

    const data = await res.json().catch(() => ({}))
    console.log('[MSG91 SMS] Successfully dispatched SMS to', cleanNumber, data)
    return true
  } catch (e) {
    console.error('[MSG91 SMS] Network error:', e)
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
  const frontendUrl = payload?.frontendUrl
  if (typeof eventId !== 'string') return json({ error: 'eventId is required' }, 400)

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

  console.log(`[SOS Dispatch] Incoming dispatch request for event ${eventId} from authenticated user ${user.id} (${user.email})`)

  // Fetch the active SOS event directly using admin (bypasses RLS & avoids join naming failures)
  const { data: event, error: eventError } = await admin
    .from('sos_events')
    .select('id, user_id, status, latitude, longitude')
    .eq('id', eventId)
    .single()

  if (eventError || !event) {
    console.error(`[SOS Dispatch] Active SOS event ${eventId} not found:`, eventError)
    return json({ error: 'Active SOS event not found', details: eventError?.message }, 404)
  }

  // Security check: Verify caller owns this SOS event
  if (event.user_id !== user.id) {
    console.error(`[SOS Dispatch] User ${user.id} is not owner of event ${eventId} (owner=${event.user_id})`)
    return json({ error: 'Unauthorized for this SOS event' }, 403)
  }

  // Fetch the user's profile
  const { data: userProfile } = await admin
    .from('profiles')
    .select('display_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  const userName = userProfile?.display_name || user.user_metadata?.display_name || (user.email ? user.email.split('@')[0] : 'A Raksha Sutra user')
  const userPhone = userProfile?.phone || user.phone || ''
  const userEmail = user.email || ''
  const locationLink = `${frontendUrl || Deno.env.get('FRONTEND_URL') || 'https://rakshasutra.in'}/track/${event.id}`

  // Idempotency check: only skip if there are deliveries that were actually sent (not all failed)
  const { data: existing } = await admin.from('sos_event_deliveries').select('id, status, recipient_type, channel, recipient_name').eq('sos_event_id', event.id)
  if (existing?.length) {
    const hasAnySuccess = existing.some((d: any) => d.status === 'delivered' || d.status === 'queued')
    if (hasAnySuccess) {
      console.log(`[SOS Dispatch] Idempotency: ${existing.length} deliveries already exist with at least one success/queued. Returning existing.`)
      return json({ eventId: event.id, idempotent: true, deliveriesQueued: existing.length, deliveries: existing })
    }
    // All previous deliveries failed — delete them and retry
    console.log(`[SOS Dispatch] All ${existing.length} previous deliveries failed. Deleting and retrying...`)
    await admin.from('sos_event_deliveries').delete().eq('sos_event_id', event.id)
  }

  // 1. Fetch ALL emergency contacts for this user (not filtering by notification_enabled so pending/unconfirmed contacts also receive emergency alerts)
  const [{ data: contacts, error: contactError }, { data: nearbyRakshaks, error: rakshakError }] = await Promise.all([
    admin.from('emergency_contacts').select('id, name, phone_e164, email').eq('user_id', user.id),
    admin.rpc('find_nearby_rakshaks', {
      p_latitude: event.latitude,
      p_longitude: event.longitude,
      p_radius_meters: 15000,
      p_limit: 15,
    }).catch((e: any) => {
      console.warn('find_nearby_rakshaks error:', e);
      return { data: [] };
    }),
  ])
  if (contactError) {
    console.error('Error querying emergency_contacts:', contactError)
  }

  const allContacts: Array<{ id?: string | null; name?: string; phone_e164?: string | null; email?: string | null }> = contacts ? [...contacts] : []

  // Ensure default RakshaSutra monitoring contact is present in emergency_contacts for this user
  let defaultContact = allContacts.find(c => c.email?.toLowerCase() === 'rakshaasutra@gmail.com')
  if (!defaultContact) {
    try {
      const { data: insertedDefault, error: insErr } = await admin
        .from('emergency_contacts')
        .insert({
          user_id: user.id,
          name: 'RakshaSutra',
          relationship: 'Emergency Support',
          phone_e164: '+919343899579',
          email: 'rakshaasutra@gmail.com',
        })
        .select('id, name, phone_e164, email')
        .maybeSingle()

      if (!insErr && insertedDefault) {
        allContacts.push(insertedDefault)
      } else {
        console.warn('Could not insert default emergency contact:', insErr)
        allContacts.push({
          id: null,
          name: 'RakshaSutra',
          phone_e164: '+919343899579',
          email: 'rakshaasutra@gmail.com',
        })
      }
    } catch (e) {
      console.warn('Error inserting default contact:', e)
      allContacts.push({
        id: null,
        name: 'RakshaSutra',
        phone_e164: '+919343899579',
        email: 'rakshaasutra@gmail.com',
      })
    }
  }

  // 2. Discover Rakshaks: fetch nearby Rakshaks and all verified Rakshaks across the city/system (excluding caller)
  const { data: allVerifiedRakshaks, error: verifiedError } = await admin
    .from('rakshak_profiles')
    .select('profile_id')
    .eq('status', 'verified')
    .neq('profile_id', user.id)
    .limit(30)

  if (verifiedError) {
    console.error('Error fetching verified Rakshaks:', verifiedError)
  }

  // Merge nearby Rakshaks with verified Rakshaks so NO verified responder is missed
  const rakshakIdSet = new Set<string>()
  for (const r of (nearbyRakshaks || [])) {
    if (r.profile_id && r.profile_id !== user.id) rakshakIdSet.add(r.profile_id)
  }
  for (const r of (allVerifiedRakshaks || [])) {
    if (r.profile_id && r.profile_id !== user.id) rakshakIdSet.add(r.profile_id)
  }

  const callerEmail = userEmail ? userEmail.trim().toLowerCase() : ''
  const filteredContacts = allContacts.filter(c => {
    if (callerEmail && c.email && c.email.trim().toLowerCase() === callerEmail) {
      console.log(`[SOS Dispatch] Skipping caller's own email from alert contacts: ${c.email}`)
      return false
    }
    return true
  })

  let rakshaks = Array.from(rakshakIdSet).map(id => ({ profile_id: id }))
  console.log(`[SOS Dispatch] Found ${filteredContacts.length} contacts and ${rakshaks.length} verified responder Rakshaks`)
  console.log(`[SOS Dispatch] Contact emails: ${filteredContacts.map(c => c.email).filter(Boolean).join(', ')}`)
  console.log(`[SOS Dispatch] Contact phones: ${filteredContacts.map(c => c.phone_e164).filter(Boolean).join(', ')}`)

  const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  const deliveries: any[] = []

  // Queue Contact Deliveries - only push to DB deliveries if valid contact ID exists (to respect DB foreign key & non-null check constraints)
  for (const contact of filteredContacts) {
    if (!contact.id || !isUuid(contact.id)) {
      console.log(`[SOS Dispatch] Contact ${contact.email || contact.phone_e164} does not have DB UUID id, will dispatch directly without DB queue row`)
      continue
    }
    if (contact.email) {
      deliveries.push({
        sos_event_id: event.id,
        recipient_type: 'contact',
        contact_id: contact.id,
        rakshak_id: null,
        channel: 'email',
        status: 'queued',
      })
    }
    if (contact.phone_e164) {
      deliveries.push({
        sos_event_id: event.id,
        recipient_type: 'contact',
        contact_id: contact.id,
        rakshak_id: null,
        channel: 'sms',
        status: 'queued',
      })
    }
  }

  // Queue Rakshak Deliveries
  for (const rakshak of rakshaks) {
    // In-app real-time alert for all verified Rakshaks
    deliveries.push({
      sos_event_id: event.id,
      recipient_type: 'rakshak',
      contact_id: null,
      rakshak_id: rakshak.profile_id,
      channel: 'in_app',
      status: 'queued',
    })
  }

  // Fetch rakshak details using Auth REST API & profiles table to guarantee real email & phone
  const rakshakDetails: any[] = []
  if (rakshaks && rakshaks.length > 0) {
    const promises = rakshaks.map(async (r: any) => {
      try {
        const { data: rProfile } = await admin
          .from('profiles')
          .select('phone, display_name')
          .eq('id', r.profile_id)
          .maybeSingle()

        let email = ''
        let phone = rProfile?.phone || null
        let displayName = rProfile?.display_name || 'Verified Rakshak'

        // Directly query Supabase Auth Admin REST API for the user's authentic email
        try {
          const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${r.profile_id}`, {
            headers: {
              Authorization: `Bearer ${secretKey}`,
              apikey: secretKey,
            },
          })
          if (authRes.ok) {
            const authUser = await authRes.json()
            email = authUser.email || ''
            phone = phone || authUser.phone || authUser.user_metadata?.phone || null
            if (displayName === 'Verified Rakshak' && authUser.user_metadata?.display_name) {
              displayName = authUser.user_metadata.display_name
            }
            console.log(`[Rakshak Lookup] Successfully retrieved email=${email} for Rakshak ID ${r.profile_id}`)
          } else {
            console.warn(`[Rakshak Lookup] Auth REST returned status ${authRes.status} for ${r.profile_id}`)
          }
        } catch (restErr) {
          console.error(`[Rakshak Lookup] REST fetch failed for ${r.profile_id}:`, restErr)
        }

        // Fallback to getUserById if REST was empty
        if (!email) {
          try {
            const userRes = await admin.auth.admin.getUserById(r.profile_id)
            email = userRes?.data?.user?.email || ''
            phone = phone || userRes?.data?.user?.phone || null
          } catch { }
        }

        rakshakDetails.push({ profile_id: r.profile_id, email, phone, displayName })
      } catch (err) {
        console.error(`Error loading Rakshak ${r.profile_id} contact details:`, err)
      }
    })
    await Promise.all(promises)
  }

  // Queue Rakshak Phone & Email Deliveries
  for (const rDetails of rakshakDetails) {
    if (rDetails.phone) {
      deliveries.push({
        sos_event_id: event.id,
        recipient_type: 'rakshak',
        contact_id: null,
        rakshak_id: rDetails.profile_id,
        channel: 'sms',
        status: 'queued',
      })
    }
    if (rDetails.email) {
      deliveries.push({
        sos_event_id: event.id,
        recipient_type: 'rakshak',
        contact_id: null,
        rakshak_id: rDetails.profile_id,
        channel: 'email',
        status: 'queued',
      })
    }
  }

  let insertedDeliveries: any[] = []
  if (deliveries.length) {
    const { data: inserted, error: deliveryError } = await admin.from('sos_event_deliveries').insert(deliveries).select('*')
    if (deliveryError) {
      console.error('[SOS Dispatch] Bulk Insert Error into sos_event_deliveries:', deliveryError)
      // CRITICAL: DO NOT abort with 500! A database logging issue must NEVER prevent emergency alerts from going out!
    } else if (inserted) {
      insertedDeliveries = inserted
    }
  }

  // ACTUALLY SEND THE ALERTS (Fire and forget to not block the response)
  const sendAlerts = async () => {
    try {
      const promises: Promise<void>[] = []

      const sentPhones = new Set<string>()
      const sentEmails = new Set<string>()
      if (callerEmail) {
        sentEmails.add(callerEmail)
      }

      for (const contact of filteredContacts) {
        const phoneSuffix = userPhone ? `\n\n📞 Caller Phone: ${userPhone}` : ''
        const message = `🚨 *URGENT SOS ALERT* 🚨\n\n*${userName}* has triggered an SOS and needs immediate assistance.${phoneSuffix}\n\nView their live location here: ${locationLink}`

        let phonePromise = Promise.resolve(false)
        if (contact.phone_e164) {
          const smsDelivery = insertedDeliveries.find(d =>
            d.recipient_type === 'contact' &&
            d.channel === 'sms' &&
            contact.id && d.contact_id === contact.id
          )
          const p = (async () => {
            if (sentPhones.has(contact.phone_e164!)) {
              if (smsDelivery) {
                await admin.from('sos_event_deliveries').update({
                  status: 'delivered',
                  delivered_at: new Date().toISOString(),
                  failure_reason: null
                }).eq('id', smsDelivery.id).catch(e => console.warn('Delivery update err:', e))
              }
              return true;
            }
            sentPhones.add(contact.phone_e164!);

            // 1. Primary: Meta WhatsApp Cloud API (Automated, ~₹0.115)
            let success = await sendMetaWhatsAppMessage(contact.phone_e164!, userName, locationLink)

            // 2. Fallback: MSG91 Indian SMS (Automated, ~₹0.18)
            if (!success) {
              console.log(`[Alert Dispatch] WhatsApp did not succeed for ${contact.phone_e164}. Falling back to MSG91 SMS...`)
              success = await sendMsg91Sms(contact.phone_e164!, userName, locationLink)
            }

            if (smsDelivery) {
              await admin.from('sos_event_deliveries').update({
                status: success ? 'delivered' : 'failed',
                delivered_at: success ? new Date().toISOString() : null,
                failure_reason: success ? null : 'WhatsApp & SMS delivery failed'
              }).eq('id', smsDelivery.id).catch(e => console.warn('Delivery update err:', e))
            }
            return success
          })()
          phonePromise = p
          promises.push(p.then(() => { }))
        }

        if (contact.email) {
          const emailDelivery = insertedDeliveries.find(d =>
            d.recipient_type === 'contact' &&
            d.channel === 'email' &&
            contact.id && d.contact_id === contact.id
          )
          promises.push(
            (async () => {
              let success = false;
              if (sentEmails.has(contact.email!)) {
                success = true;
              } else {
                sentEmails.add(contact.email!);
                console.log(`[Contact Email] Dispatching to contact ${contact.email}...`)
                success = await sendEmailAlert(contact.email!, locationLink, userName, userEmail)
                console.log(`[Contact Email] Result for ${contact.email}: ${success}`)
              }

              if (!success && contact.phone_e164) {
                // Only try SMS fallback if both Email and WhatsApp failed
                const phoneSuccess = await phonePromise
                if (!phoneSuccess) {
                  console.log(`Email failed for ${contact.email}, trying MSG91 SMS fallback...`)
                  success = await sendMsg91Sms(contact.phone_e164!, userName, locationLink)
                }
              }
              if (emailDelivery) {
                await admin.from('sos_event_deliveries').update({
                  status: success ? 'delivered' : 'failed',
                  delivered_at: success ? new Date().toISOString() : null,
                  failure_reason: success ? null : 'Email delivery failed'
                }).eq('id', emailDelivery.id).catch(e => console.warn('Delivery update err:', e))
              }
            })()
          )
        }
      }

      console.log(`[SOS Dispatch] Dispatching to ${rakshakDetails.length} Rakshaks. Details: ${JSON.stringify(rakshakDetails.map(r => ({ id: r.profile_id, email: r.email, phone: r.phone, name: r.displayName })))}`)

      for (const rDetails of rakshakDetails) {
        // Dispatch to Rakshak's updated profile phone number via WhatsApp / SMS
        if (rDetails.phone) {
          const phoneDelivery = insertedDeliveries.find(d => d.rakshak_id === rDetails.profile_id && d.channel === 'sms')
          if (phoneDelivery) {
            promises.push(
              (async () => {
                if (sentPhones.has(rDetails.phone)) {
                  await admin.from('sos_event_deliveries').update({
                    status: 'delivered',
                    delivered_at: new Date().toISOString(),
                    failure_reason: null
                  }).eq('id', phoneDelivery.id)
                  return;
                }
                sentPhones.add(rDetails.phone);

                let success = await sendMetaWhatsAppMessage(rDetails.phone, userName, locationLink)
                if (!success) {
                  console.log(`[Rakshak Dispatch] WhatsApp failed for ${rDetails.phone}, trying MSG91 SMS...`)
                  success = await sendMsg91Sms(rDetails.phone, userName, locationLink)
                }
                await admin.from('sos_event_deliveries').update({
                  status: success ? 'delivered' : 'failed',
                  delivered_at: success ? new Date().toISOString() : null,
                  failure_reason: success ? null : 'Rakshak phone delivery failed'
                }).eq('id', phoneDelivery.id)
              })().catch(err => console.error('Rakshak phone dispatch error:', err))
            )
          }
        }

        if (rDetails.email) {
          console.log(`[Rakshak Email] Preparing to send SOS email to Rakshak "${rDetails.displayName}" at ${rDetails.email}`)
          const emailDelivery = insertedDeliveries.find(d => d.rakshak_id === rDetails.profile_id && d.channel === 'email')
          promises.push(
            (async () => {
              let success = false;
              if (sentEmails.has(rDetails.email)) {
                console.log(`[Rakshak Email] Already sent to ${rDetails.email}, marking as delivered`)
                success = true;
              } else {
                sentEmails.add(rDetails.email);
                console.log(`[Rakshak Email] Calling sendEmailAlert for ${rDetails.email}...`)
                const result = await sendEmailAlert(rDetails.email, locationLink, userName, userEmail);
                success = result === true;
                console.log(`[Rakshak Email] sendEmailAlert returned ${result} for ${rDetails.email}, success=${success}`)
              }
              if (emailDelivery) {
                await admin.from('sos_event_deliveries').update({
                  status: success ? 'delivered' : 'failed',
                  delivered_at: success ? new Date().toISOString() : null,
                  failure_reason: success ? null : 'Email delivery failed'
                }).eq('id', emailDelivery.id).catch(err => console.warn('Delivery update err:', err))
              }
            })().catch(err => console.error('Rakshak Email promise error:', err))
          )
        }
      }

      await Promise.allSettled(promises)
    } catch (e) {
      console.error('Fatal error in sendAlerts background worker:', e)
    }
  }

  await sendAlerts() // wait for completion

  await admin.from('sos_event_updates').insert({
    sos_event_id: event.id,
    actor_id: user.id,
    event_type: 'created',
    details: { contact_count: contacts?.length ?? 0, rakshak_count: rakshaks?.length ?? 0 },
  })

  // Enrich deliveries with friendly names and subheads for frontend display
  const enrichedDeliveries = insertedDeliveries.map((d: any) => {
    if (d.recipient_type === 'rakshak') {
      const rInfo = rakshakDetails.find(r => r.profile_id === d.rakshak_id);
      return {
        ...d,
        recipient_name: rInfo?.displayName || 'Verified Volunteer',
        recipient_sub: 'Verified Volunteer',
      };
    }
    if (d.recipient_type === 'contact') {
      const cInfo = allContacts.find(c => (c.id && c.id === d.contact_id) || (!d.contact_id && c.email === 'rakshaasutra@gmail.com'));
      return {
        ...d,
        recipient_name: (cInfo as any)?.name || (cInfo?.email === 'rakshaasutra@gmail.com' ? 'RakshaSutra' : 'Emergency Contact'),
        recipient_sub: 'Emergency Contact',
      };
    }
    return d;
  });

  return json({
    eventId: event.id,
    contactCount: contacts?.length ?? 0,
    rakshakCount: rakshaks?.length ?? 0,
    deliveriesQueued: enrichedDeliveries.length,
    deliveries: enrichedDeliveries
  })
})
