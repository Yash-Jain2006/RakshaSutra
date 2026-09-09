import { supabase } from '../lib/supabase';
import type { JourneyStatus } from '../types/enums';
import { generateSecureBearerToken, sha256Hex } from './journeySecurity';
import { activeJourneyEngine } from './journeyEngine';
import type { RouteResult, TransportMode } from './providers/routingProvider';

export interface LiveJourney {
  id: string;
  destination: string;
  destinationCoords?: [number, number];
  status: JourneyStatus;
  shareToken?: string;
  shareUrl?: string;
  transportMode?: TransportMode;
}

function configuredClient() {
  if (!supabase) throw new Error('Raksha Sutra is not connected to its live service.');
  return supabase;
}

export async function getCurrentJourney(userId: string): Promise<LiveJourney | null> {
  const { data, error } = await configuredClient()
    .from('journeys')
    .select('id, destination_name, destination_latitude, destination_longitude, status, transport_mode')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    destination: data.destination_name,
    destinationCoords: [data.destination_latitude, data.destination_longitude],
    status: data.status as JourneyStatus,
    transportMode: (data.transport_mode as TransportMode) || 'walking',
  };
}

export async function startLiveJourney(
  userId: string,
  destination: string,
  destinationCoords: [number, number],
  contactIds: Array<string | number>,
  transportMode: TransportMode = 'walking',
  initialRoute?: RouteResult | null,
  startLocation?: { latitude: number; longitude: number } | null
): Promise<LiveJourney> {
  const client = configuredClient();

  // 1. Generate 128-bit cryptographically secure bearer token
  const bearerToken = generateSecureBearerToken();
  const tokenHash = await sha256Hex(bearerToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24-hour expiry

  const routeGeojson =
    initialRoute && initialRoute.coordinates && initialRoute.coordinates.length > 0
      ? {
          type: 'LineString',
          coordinates: initialRoute.coordinates.map(([lat, lng]) => [lng, lat]),
        }
      : null;

  const startLat = startLocation?.latitude ?? initialRoute?.coordinates?.[0]?.[0] ?? null;
  const startLng = startLocation?.longitude ?? initialRoute?.coordinates?.[0]?.[1] ?? null;

  // 2. Insert journey record with destination coords, transport mode, token hash, route_geojson, eta, distance
  let journeyId = '';
  try {
    const { data, error } = await client
      .from('journeys')
      .insert({
        user_id: userId,
        destination_name: destination,
        destination_latitude: destinationCoords[0],
        destination_longitude: destinationCoords[1],
        last_latitude: startLat,
        last_longitude: startLng,
        last_location_at: new Date().toISOString(),
        status: 'active',
        transport_mode: transportMode,
        token_hash: tokenHash,
        expires_at: expiresAt,
        started_at: new Date().toISOString(),
        route_geojson: routeGeojson,
        eta_seconds: initialRoute?.durationSeconds ?? null,
        remaining_distance_meters: initialRoute?.distanceMeters ?? null,
      })
      .select('id, destination_name, status')
      .single();

    if (error) throw error;
    journeyId = data.id;
  } catch (err: any) {
    console.warn('[JourneyService] Primary insert with extended columns failed, falling back to core schema:', err);
    const { data: fallbackData, error: fallbackError } = await client
      .from('journeys')
      .insert({
        user_id: userId,
        destination_name: destination,
        destination_latitude: destinationCoords[0],
        destination_longitude: destinationCoords[1],
        last_latitude: startLat,
        last_longitude: startLng,
        last_location_at: new Date().toISOString(),
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select('id, destination_name, status')
      .single();

    if (fallbackError) throw fallbackError;
    journeyId = fallbackData.id;
  }

  // 3. Associate viewers
  const viewerIds = contactIds.filter((id): id is string => typeof id === 'string');
  if (viewerIds.length && journeyId) {
    try {
      await client
        .from('journey_viewers')
        .insert(viewerIds.map((contact_id) => ({ journey_id: journeyId, contact_id })));
    } catch (viewersError) {
      console.warn('[JourneyService] Optional journey_viewers insert note:', viewersError);
    }
  }

  // 4. Attach location upload handler to singleton JourneyEngine
  activeJourneyEngine.setUploadHandler(async (jId, point) => {
    await uploadJourneyLocationAtomic(jId, point);
  });

  const shareUrl = `${window.location.origin}/track/${bearerToken}`;

  return {
    id: journeyId,
    destination,
    destinationCoords,
    status: 'active',
    shareToken: bearerToken,
    shareUrl,
    transportMode,
  };
}

/**
 * Atomically updates the journey's latest location and records a point in journey_location_points.
 *
 * ARCHITECTURE (Change #3):
 * This function MUST NOT independently INSERT a location point and then UPDATE the journey row,
 * because those two operations can get out of sync (e.g. point inserted but journey update fails,
 * or race conditions with concurrent uploads).
 *
 * Instead, it calls the server-side RPC `update_journey_location` which atomically:
 *   1. Validates journey ownership and active status
 *   2. Inserts into journey_location_points (idempotent on sequence_number + journey_id)
 *   3. Updates the denormalized last_* fields on the journeys row
 *
 * If the RPC is not yet deployed (e.g. migration pending), it falls back gracefully to the
 * two-step approach with a console warning. Remove the fallback once the RPC is confirmed live.
 */
export async function uploadJourneyLocationAtomic(
  journeyId: string,
  point: {
    sequence_number: number;
    client_timestamp: string;
    latitude: number;
    longitude: number;
    accuracy_meters: number | null;
    speed: number | null;
    heading: number | null;
    eta_seconds: number;
    remaining_distance_meters: number;
  }
) {
  const client = configuredClient();

  // ── Primary path: single atomic RPC (preferred) ──────────────────────────────
  try {
    const { error: rpcError } = await client.rpc('update_journey_location', {
      p_journey_id: journeyId,
      p_sequence_number: point.sequence_number,
      p_client_timestamp: point.client_timestamp,
      p_latitude: point.latitude,
      p_longitude: point.longitude,
      p_accuracy_meters: point.accuracy_meters,
      p_speed: point.speed,
      p_heading: point.heading,
      p_eta_seconds: point.eta_seconds,
      p_remaining_distance_meters: point.remaining_distance_meters,
    });

    if (!rpcError) {
      // Atomic update succeeded — done.
      return;
    }

    // If the RPC does not exist yet (code 42883 = undefined_function in Postgres),
    // fall through to the two-step fallback.
    if ((rpcError as any).code !== '42883') {
      // Real error (permissions, constraint, etc.) — propagate
      throw rpcError;
    }

    console.warn(
      '[JourneyService] update_journey_location RPC not found (migration pending?). ' +
      'Falling back to two-step insert+update. Deploy the migration to enable atomic updates.'
    );
  } catch (rpcErr: any) {
    // Only fall through for "function not found" — rethrow other errors
    if (rpcErr?.code !== '42883') throw rpcErr;
    console.warn('[JourneyService] RPC fallback activated:', rpcErr.message);
  }

  // ── Fallback path: two-step insert + update (used until RPC migration is deployed) ──
  const pointPayload: Record<string, any> = {
    journey_id: journeyId,
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy_meters: point.accuracy_meters,
    captured_at: point.client_timestamp,
    sequence_number: point.sequence_number,
    speed: point.speed,
    heading: point.heading,
  };

  const { error: pointError } = await client
    .from('journey_location_points')
    .insert(pointPayload);

  if (pointError) {
    // Last resort: insert with only base columns if extended columns are missing
    await client.from('journey_location_points').insert({
      journey_id: journeyId,
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy_meters: point.accuracy_meters,
    });
  }

  // Update denormalized journey summary row (best effort)
  try {
    await client
      .from('journeys')
      .update({
        last_latitude: point.latitude,
        last_longitude: point.longitude,
        last_location_at: point.client_timestamp,
        last_speed: point.speed,
        last_heading: point.heading,
        eta_seconds: point.eta_seconds,
        remaining_distance_meters: point.remaining_distance_meters,
      })
      .eq('id', journeyId);
  } catch (updateErr) {
    console.debug('[JourneyService] Journey summary update note (non-fatal):', updateErr);
  }
}


export async function updateLiveJourney(id: string, status: JourneyStatus) {
  const terminal = status === 'arrived' || status === 'cancelled' || status === 'expired';
  const { error } = await configuredClient()
    .from('journeys')
    .update({
      status,
      ended_at: terminal ? new Date().toISOString() : null,
      // If terminal, immediately revoke the link so no further location updates can be accessed
      revoked_at: terminal ? new Date().toISOString() : null,
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Backwards-compatible helper for updating journey location.
 */
export async function updateLiveJourneyLocation(
  journeyId: string,
  latitude: number,
  longitude: number,
  accuracyMeters: number | null
) {
  return uploadJourneyLocationAtomic(journeyId, {
    sequence_number: 1,
    client_timestamp: new Date().toISOString(),
    latitude,
    longitude,
    accuracy_meters: accuracyMeters,
    speed: null,
    heading: null,
    eta_seconds: 0,
    remaining_distance_meters: 0,
  });
}

/**
 * Revokes a sharing token immediately, terminating viewer sessions.
 */
export async function revokeShareToken(journeyId: string) {
  const { error } = await configuredClient()
    .from('journeys')
    .update({
      revoked_at: new Date().toISOString(),
    })
    .eq('id', journeyId);

  if (error) throw error;
}
