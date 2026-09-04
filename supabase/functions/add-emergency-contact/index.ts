// @ts-nocheck
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
  const keys = Deno.env.get(keysVariable)
  if (keys) return JSON.parse(keys).default as string
  return Deno.env.get(legacyVariable) ?? ''
}

async function sendConfirmationEmail({ to, contactName, ownerName, confirmationUrl }: { to: string, contactName: string, ownerName: string, confirmationUrl: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  let from = Deno.env.get('CONFIRMATION_FROM_EMAIL')
  
  if (from && from.includes('rakshasutra.com')) {
    from = from.replace('rakshasutra.com', 'rakshasutra.in')
  } else if (!from) {
    from = 'safety@rakshasutra.in'
  }

  if (!apiKey) {
    console.warn('Email confirmation is not configured')
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: 'Confirm your Raksha Sutra emergency-contact role',
        html: `<p>Hello ${contactName},</p><p>${ownerName} has added you as an emergency contact on Raksha Sutra. In an emergency, you may receive a secure location link.</p><p><a href="${confirmationUrl}">Confirm emergency-contact role</a></p><p>If you do not recognise this request, do not confirm it.</p>`,
      }),
    })
    
    if (!response.ok) {
      console.error('Resend API error:', await response.text())
      return false
    }
    return true
  } catch (e) {
    console.error('Resend network error:', e)
    return false
  }
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

async function sendTwilioMessage(phoneE164: string, message: string, useWhatsApp: boolean) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromPhone = Deno.env.get('TWILIO_WHATSAPP_NUMBER')

  if (!accountSid || !authToken || !fromPhone) {
    return false
  }

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
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
      body: formData.toString(),
    })
    return res.ok
  } catch (e) {
    return false
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'Missing authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const publishableKey = readPlatformKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  const secretKey = readPlatformKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !publishableKey || !secretKey) return json({ error: 'Server is not configured' }, 500)

  const caller = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthenticated' }, 401)

  const payload = await request.json().catch(() => null)
  const name = payload?.name?.trim()
  const relationship = payload?.relationship?.trim()
  const email = payload?.email?.trim()?.toLowerCase() || null
  const phone = payload?.phone?.trim() || null
  if (!name || !relationship || (!email && !phone)) return json({ error: 'Name, relationship, and either an email or phone number are required' }, 400)
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) return json({ error: 'Phone number must use international format, e.g. +919876543210' }, 400)

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let { data: profile } = await admin.from('profiles').select('display_name, account_status').eq('id', user.id).single()
  
  // Self-heal: If profile doesn't exist, create it automatically
  if (!profile) {
    const { data: newProfile } = await admin.from('profiles').insert({
      id: user.id,
      display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || '',
      role: 'user',
      account_status: 'active'
    }).select('display_name, account_status').single()
    profile = newProfile
  }

  if (!profile || profile.account_status !== 'active') return json({ error: 'This account cannot add emergency contacts' }, 403)

  const token = crypto.randomUUID()
  const { data: contact, error: insertError } = await admin
    .from('emergency_contacts')
    .insert({
      user_id: user.id,
      name,
      relationship,
      phone_e164: phone,
      email,
      notification_enabled: false,
      confirmation_status: 'pending',
      confirmation_token: token,
      confirmation_sent_at: new Date().toISOString(),
    })
    .select('id, name, relationship, phone_e164, email, notification_enabled, confirmation_status')
    .single()
  if (insertError || !contact) return json({ error: 'Could not create emergency contact' }, 500)

  try {
    const confirmationUrl = `${supabaseUrl}/functions/v1/confirm-emergency-contact?token=${token}`
    const ownerNameStr = profile.display_name || 'A Raksha Sutra user'
    let anySuccess = false;
    let phoneSuccess = false;
    
    if (phone) {
      const message = `${ownerNameStr} added you as an emergency contact on Raksha Sutra. Confirm here: ${confirmationUrl}`
      let success = await sendMetaWhatsAppMessage(phone, message)
      if (!success) {
        console.log(`[Emergency Contact] WhatsApp not sent for ${phone}, trying MSG91 SMS...`)
        success = await sendMsg91Sms(phone, message)
      }
      if (!success) {
        success = await sendTwilioMessage(phone, message, false)
      }
      phoneSuccess = success
      if (success) anySuccess = true
    }

    if (email) {
      let emailSuccess = await sendConfirmationEmail({ to: email, contactName: name, ownerName: ownerNameStr, confirmationUrl })
      if (!emailSuccess && phone && !phoneSuccess) {
        console.log(`Email failed for ${email}, trying SMS fallback...`)
        const message = `${ownerNameStr} added you as an emergency contact on Raksha Sutra. Confirm here: ${confirmationUrl}`
        emailSuccess = await sendMsg91Sms(phone, message)
        if (!emailSuccess) {
          emailSuccess = await sendTwilioMessage(phone, message, false)
        }
      }
      if (emailSuccess) anySuccess = true
    }
    
    if (!anySuccess) {
      throw new Error('All notification methods failed')
    }
  } catch (error) {
    console.error('Notification failed:', error);
    // Return the contact so it stays in pending, but include a warning
    return json({ contact, warning: error instanceof Error ? error.message : 'Confirmation could not be sent' }, 201)
  }

  return json({ contact }, 201)
})
