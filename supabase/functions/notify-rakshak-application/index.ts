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

async function sendMetaWhatsAppMessage(phoneE164: string, message: string) {
  const accessToken = Deno.env.get('META_WA_ACCESS_TOKEN')
  const phoneNumberId = Deno.env.get('META_WA_PHONE_NUMBER_ID')
  if (!accessToken || !phoneNumberId) return false

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
    console.error('Meta WhatsApp admin error:', e)
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
    console.error('MSG91 admin error:', e)
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
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? 'rakshaasutra@gmail.com'

  if (!supabaseUrl || !publishableKey || !secretKey) return json({ error: 'Server is not configured' }, 500)
  if (!resendApiKey) return json({ error: 'Email service not configured' }, 500)

  // Verify caller is authenticated
  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthenticated' }, 401)

  // Parse request body
  const payload = await request.json().catch(() => null)
  const { applicantName, docType, coverageArea, applicationId } = payload ?? {}

  if (!applicantName || !applicationId) {
    return json({ error: 'applicantName and applicationId are required' }, 400)
  }

  // Build admin panel URL
  const adminPanelUrl = `${Deno.env.get('SITE_URL') ?? 'http://127.0.0.1:5173'}/#admin`

  // Send email via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Raksha Sutra <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `🛡️ New Rakshak Application — ${applicantName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px; border-radius: 16px;">
          
          <div style="background: linear-gradient(135deg, #6255ec, #8b5cf6); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: #fff; margin: 0; font-size: 22px;">🛡️ Raksha Sutra</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0 0; font-size: 13px;">New Rakshak Application Received</p>
          </div>

          <div style="background: #fff; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
            <h2 style="margin: 0 0 16px 0; font-size: 16px; color: #1e293b;">Application Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 40%;">Applicant Name</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 13px; font-weight: 600;">${applicantName}</td>
              </tr>
              <tr style="border-top: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Document Type</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 13px;">${docType ?? 'N/A'}</td>
              </tr>
              <tr style="border-top: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Coverage Area</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 13px;">${coverageArea ?? 'N/A'}</td>
              </tr>
              <tr style="border-top: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Application ID</td>
                <td style="padding: 8px 0; color: #94a3b8; font-size: 11px; font-family: monospace;">${applicationId}</td>
              </tr>
              <tr style="border-top: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Submitted At</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 13px;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin-bottom: 16px;">
            <a href="${adminPanelUrl}" style="display: inline-block; background: linear-gradient(135deg, #6255ec, #8b5cf6); color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px;">
              Review in Admin Panel →
            </a>
          </div>

          <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 16px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #92400e;">
              ⚠️ The applicant's uploaded identity documents are available for review in the Admin Panel. They will be automatically deleted after your approval or rejection.
            </p>
          </div>

          <p style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 16px;">
            Raksha Sutra — Protecting Communities Together
          </p>
        </div>
      `,
    }),
  })

  let emailSuccess = true;
  if (!emailRes.ok) {
    const errBody = await emailRes.text()
    console.error('[notify-rakshak-application] Resend error:', errBody)
    emailSuccess = false;
  }

  // Dispatch alert to Admin's updated profile phone number via WhatsApp / SMS
  const adminClient = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: adminProfiles } = await adminClient
    .from('profiles')
    .select('id, phone')
    .eq('role', 'admin')

  let adminPhone = adminProfiles?.find((p: any) => p.phone)?.phone || null
  if (!adminPhone && adminProfiles && adminProfiles.length > 0) {
    const { data: adminUser } = await adminClient.auth.admin.getUserById(adminProfiles[0].id).catch(() => ({ data: null }))
    adminPhone = adminUser?.user?.phone || adminUser?.user?.user_metadata?.phone || null
  }

  if (adminPhone) {
    const adminMsg = `🛡️ *NEW RAKSHAK APPLICATION*\n\nApplicant: *${applicantName}*\nCoverage Area: ${coverageArea || 'N/A'}\nDoc Type: ${docType || 'N/A'}\n\nReview now in Admin Panel: ${adminPanelUrl}`
    
    // 1. Try Meta WhatsApp first
    let waSuccess = await sendMetaWhatsAppMessage(adminPhone, adminMsg)
    if (!waSuccess) {
      console.log(`[notify-rakshak-application] WhatsApp not sent to admin (${adminPhone}), falling back to MSG91 SMS...`)
      await sendMsg91Sms(adminPhone, adminMsg)
    }
  }

  return json({ sent: true })
})
