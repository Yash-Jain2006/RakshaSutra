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

async function sendAlertEmail(
  toEmail: string,
  rakshakName: string,
  requesterName: string,
  requesterEmail: string,
  mapsLink: string,
) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  let from = Deno.env.get('RESEND_FROM_EMAIL') ?? Deno.env.get('CONFIRMATION_FROM_EMAIL') ?? 'safety@rakshasutra.in'
  if (from.includes('rakshasutra.com')) from = from.replace('rakshasutra.com', 'rakshasutra.in')

  if (!apiKey) {
    console.warn('[Notify Rakshak] RESEND_API_KEY not set. Skipping email.')
    return false
  }

  const html = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
        <img src="https://rakshasutra.in/logo.png" alt="Rakshasutra Logo" style="height: 80px; width: auto; margin-bottom: 10px;" />
        <h1 style="color: #1e293b; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Rakshasutra</h1>
      </div>

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h2 style="color: #dc2626; margin: 0 0 8px; font-size: 20px;">🚨 Help Requested, ${rakshakName}!</h2>
        <p style="color: #7f1d1d; margin: 0; font-size: 15px;">
          <strong>${requesterName}</strong> (${requesterEmail}) has specifically requested your help via the Rakshasutra app.
        </p>
      </div>

      <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
        They are at the location shown below. Please check on them if you are safely able to do so.
      </p>

      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${mapsLink}" style="display:inline-block; padding:14px 28px; background:#dc2626; color:#fff; text-decoration:none; border-radius:8px; font-weight:bold; font-size: 16px; box-shadow: 0 4px 6px rgba(220,38,38,0.2);">
          📍 View Their Location
        </a>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        You are receiving this because you are a verified <strong>Rakshak</strong> on Rakshasutra. You are never expected to put yourself in danger. Only respond if it is safe to do so.
      </p>

      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; text-align: center;">
        This message was sent automatically by the Rakshasutra Safety Platform.
      </p>
    </div>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: toEmail,
        subject: `🚨 ${requesterName} needs your help — Rakshasutra Alert`,
        html,
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error('[Notify Rakshak] Email failed:', res.status, errText)
      return false
    }
    console.log('[Notify Rakshak] Alert email sent to', toEmail)
    return true
  } catch (e) {
    console.error('[Notify Rakshak] Email network error:', e)
    return false
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Missing authorization' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const publishableKey = readPlatformKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const secretKey = readPlatformKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error('[Notify Rakshak] Missing env vars')
      return json({ error: 'Server not configured' }, 500)
    }

    // Authenticate the caller
    const caller = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: { user }, error: authError } = await caller.auth.getUser()
    if (authError || !user) {
      console.error('[Notify Rakshak] Auth failed:', authError)
      return json({ error: 'Unauthenticated' }, 401)
    }

    const payload = await request.json().catch(() => null)
    const { rakshakId, location } = payload || {}
    if (!rakshakId) return json({ error: 'Missing rakshakId' }, 400)

    console.log(`[Notify Rakshak] User ${user.email} requesting help from rakshak ${rakshakId}`)

    // Use service key to fetch Rakshak's profile (bypasses RLS)
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

    // Get the Rakshak's profile with joined profiles table
    const { data: rakshakProfile, error: rakshakError } = await admin
      .from('rakshak_profiles')
      .select('profile_id, coverage_area, profiles!rakshak_profiles_profile_id_fkey(display_name, id)')
      .eq('profile_id', rakshakId)
      .single()

    if (rakshakError || !rakshakProfile) {
      console.error('[Notify Rakshak] Rakshak profile not found:', rakshakError)
      return json({ error: 'Rakshak not found', details: rakshakError?.message }, 404)
    }

    console.log('[Notify Rakshak] Found rakshak profile:', JSON.stringify(rakshakProfile))

    // Get the Rakshak's email from auth.users using the REST API directly
    // (admin.auth.admin.getUserById can have issues with response shape)
    let rakshakEmail = ''
    try {
      const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${rakshakId}`, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          apikey: secretKey,
        },
      })
      if (authRes.ok) {
        const authUser = await authRes.json()
        rakshakEmail = authUser.email || ''
        console.log('[Notify Rakshak] Got email via REST:', rakshakEmail)
      } else {
        console.error('[Notify Rakshak] Auth REST failed:', authRes.status, await authRes.text())
      }
    } catch (e) {
      console.error('[Notify Rakshak] Auth REST error:', e)
    }

    if (!rakshakEmail) {
      console.error('[Notify Rakshak] No email found for rakshak')
      return json({ error: 'Could not retrieve Rakshak contact details' }, 500)
    }

    // Get the requester's profile
    const { data: requesterProfile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    const rakshakName = (rakshakProfile.profiles as any)?.display_name || 'Rakshak'
    const requesterName = requesterProfile?.display_name || 'A user'
    const mapsLink = location
      ? `https://maps.google.com/?q=${location.lat},${location.lng}`
      : 'https://maps.google.com'

    console.log(`[Notify Rakshak] Sending email to ${rakshakEmail} from ${requesterName}`)

    // Send alert email
    const emailSent = await sendAlertEmail(
      rakshakEmail,
      rakshakName,
      requesterName,
      user.email ?? '',
      mapsLink,
    )

    if (!emailSent) {
      return json({ error: 'Failed to deliver alert email' }, 500)
    }

    return json({
      success: true,
      channel: 'email',
      message: `Alert sent to ${rakshakName}`,
    })
  } catch (e) {
    console.error('[Notify Rakshak] Unhandled error:', e)
    return json({ error: 'Internal server error' }, 500)
  }
})
