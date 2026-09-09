import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
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

async function sha256Hex(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const payload = await request.json().catch(() => null)
  const { trackingId, token } = payload || {}
  const bearerToken = token || trackingId

  if (!bearerToken) return json({ error: 'Missing tracking identifier' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const secretKey = readPlatformKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !secretKey) return json({ error: 'Server is not configured' }, 500)

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Try SOS Event first (if trackingId is an sos_events UUID)
  const { data: sosData } = await admin
    .from('sos_events')
    .select('id, status, latitude, longitude, profiles!inner(display_name)')
    .eq('id', bearerToken)
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

  // 2. Journey Bearer Token Authentication
  // Hash the token and look up by token_hash
  const hashedToken = await sha256Hex(bearerToken)

  let { data: journeyData } = await admin
    .from('journeys')
    .select(
      'id, status, destination_latitude, destination_longitude, destination_name, transport_mode, last_latitude, last_longitude, last_speed, last_heading, last_location_at, eta_seconds, remaining_distance_meters, route_geojson, expires_at, revoked_at, profiles!inner(display_name)'
    )
    .eq('token_hash', hashedToken)
    .maybeSingle()

  // Fallback: Support legacy user_id or id lookups for backwards compatibility
  if (!journeyData) {
    const { data: fallbackJourney } = await admin
      .from('journeys')
      .select(
        'id, status, destination_latitude, destination_longitude, destination_name, transport_mode, last_latitude, last_longitude, last_speed, last_heading, last_location_at, eta_seconds, remaining_distance_meters, route_geojson, expires_at, revoked_at, profiles!inner(display_name)'
      )
      .or(`user_id.eq.${bearerToken},id.eq.${bearerToken}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    journeyData = fallbackJourney
  }

  if (journeyData) {
    // ENFORCE REVOCATION AND EXPIRATION (LEAK-PROOF)
    if (journeyData.revoked_at) {
      return json(
        { error: 'revoked', message: 'This tracking link is no longer available.' },
        403
      )
    }

    if (journeyData.expires_at && new Date(journeyData.expires_at).getTime() < Date.now()) {
      return json(
        { error: 'expired', message: 'This tracking link is no longer available.' },
        403
      )
    }

    // Fetch latest location point if last_latitude is not on journeys table
    let currentLat = journeyData.last_latitude
    let currentLng = journeyData.last_longitude
    let accuracyMeters: number | null = null
    let speed = journeyData.last_speed
    let heading = journeyData.last_heading
    let lastLocationAt = journeyData.last_location_at

    if (!currentLat || !currentLng) {
      const { data: pointData } = await admin
        .from('journey_location_points')
        .select('latitude, longitude, accuracy_meters, captured_at')
        .eq('journey_id', journeyData.id)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pointData) {
        currentLat = pointData.latitude
        currentLng = pointData.longitude
        accuracyMeters = pointData.accuracy_meters
        lastLocationAt = pointData.captured_at
      }
    }

    return json({
      type: 'journey',
      status: journeyData.status,
      latitude: currentLat,
      longitude: currentLng,
      accuracy_meters: accuracyMeters,
      speed,
      heading,
      last_location_at: lastLocationAt,
      destination_latitude: journeyData.destination_latitude,
      destination_longitude: journeyData.destination_longitude,
      destination_name: journeyData.destination_name,
      transport_mode: journeyData.transport_mode || 'walking',
      eta_seconds: journeyData.eta_seconds,
      remaining_distance_meters: journeyData.remaining_distance_meters,
      route_geojson: journeyData.route_geojson,
      userName: journeyData.profiles?.display_name || 'A user',
    })
  }

  // Not found
  return json({ error: 'Tracking event not found', message: 'This tracking link is no longer available.' }, 404)
})
