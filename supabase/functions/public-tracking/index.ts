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

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const payload = await request.json().catch(() => null)
  const { trackingId } = payload || {}

  if (!trackingId) return json({ error: 'Missing trackingId' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const secretKey = readPlatformKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !secretKey) return json({ error: 'Server is not configured' }, 500)

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1. Try SOS Event (trackingId is the sos_events.id)
  const { data: sosData } = await admin
    .from('sos_events')
    .select('id, status, latitude, longitude, profiles!inner(display_name)')
    .eq('id', trackingId)
    .maybeSingle()

  if (sosData) {
    return json({
      type: 'sos',
      status: sosData.status,
      latitude: sosData.latitude,
      longitude: sosData.longitude,
      userName: sosData.profiles?.display_name || 'A user',
    })
  }

  // 2. Try Journey (trackingId is the user_id in the URL)
  const { data: journeyData } = await admin
    .from('journeys')
    .select('id, status, destination_latitude, destination_longitude, destination_name, profiles!inner(display_name)')
    .eq('user_id', trackingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (journeyData) {
    // Fetch latest location point
    const { data: pointData } = await admin
      .from('journey_location_points')
      .select('latitude, longitude')
      .eq('journey_id', journeyData.id)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return json({
      type: 'journey',
      status: journeyData.status,
      latitude: pointData?.latitude || null,
      longitude: pointData?.longitude || null,
      destination_latitude: journeyData.destination_latitude,
      destination_longitude: journeyData.destination_longitude,
      destination_name: journeyData.destination_name,
      userName: journeyData.profiles?.display_name || 'A user',
    })
  }

  // Not found
  return json({ error: 'Tracking event not found' }, 404)
})
