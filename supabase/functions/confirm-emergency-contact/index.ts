import { createClient } from 'npm:@supabase/supabase-js@2'

function readPlatformKey(keysVariable: string, legacyVariable: string) {
  const keys = Deno.env.get(keysVariable)
  if (keys) return JSON.parse(keys).default as string
  return Deno.env.get(legacyVariable) ?? ''
}

function page(title: string, message: string, success = false) {
  return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>body{margin:0;display:grid;min-height:100vh;place-items:center;background:#f4f3ff;color:#202537;font-family:Arial,sans-serif}.card{max-width:360px;margin:24px;padding:28px;border-radius:20px;background:#fff;box-shadow:0 16px 40px #3d357422}h1{font-size:24px;margin:0 0 12px;color:#614de4}p{line-height:1.55;color:#62697a}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:${success ? '#eafaf1' : '#fff2f2'};color:${success ? '#24945a' : '#c13f48'};font-size:22px;margin-bottom:16px}</style></head><body><main class="card"><div class="mark">${success ? '✓' : '!'}</div><h1>${title}</h1><p>${message}</p></main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

Deno.serve(async (request) => {
  const token = new URL(request.url).searchParams.get('token')
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return page('Invalid confirmation link', 'This emergency-contact confirmation link is invalid or has expired.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const secretKey = readPlatformKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !secretKey) return page('Service unavailable', 'Raksha Sutra could not complete your confirmation right now. Please try again later.')

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: contact } = await admin.from('emergency_contacts').select('id, confirmation_status').eq('confirmation_token', token).single()
  if (!contact) return page('Confirmation link expired', 'This link is no longer valid. Please ask the Raksha Sutra user to add you again.')
  if (contact.confirmation_status === 'confirmed') return page('Already confirmed', 'You are already an approved Raksha Sutra emergency contact.', true)

  const { error } = await admin.from('emergency_contacts').update({
    confirmation_status: 'confirmed',
    confirmation_confirmed_at: new Date().toISOString(),
    confirmation_token: crypto.randomUUID(),
    notification_enabled: true,
  }).eq('id', contact.id)
  if (error) return page('Service unavailable', 'Raksha Sutra could not complete your confirmation right now. Please try again later.')
  return page('You are confirmed', 'You may receive a secure location link if this person triggers an emergency SOS. Your own location is never shared.', true)
})
