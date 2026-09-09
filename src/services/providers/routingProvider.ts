export type TransportMode = 'walking' | 'driving' | 'cycling' | 'transit';

export interface RouteResult {
  coordinates: [number, number][]; // [lat, lng] array
  distanceMeters: number;
  durationSeconds: number;
  isEstimate: boolean;
  provider: string;
}

export interface RoutingProvider {
  calculateRoute(
    start: [number, number], // [lat, lng]
    destination: [number, number], // [lat, lng]
    mode?: TransportMode
  ): Promise<RouteResult>;
}

// Configurable base URL: allows pointing to self-hosted OSRM or custom routing proxy without code changes
export const OSRM_ROUTER_BASE_URL =
  (import.meta as any).env?.VITE_OSRM_ROUTER_URL || 'https://router.project-osrm.org';

// OpenRouteService base URL and API Key
export const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions';
export const ORS_API_KEY = (import.meta as any).env?.VITE_ORS_API_KEY || '';

/**
 * Calculates straight-line distance in meters between two lat/lng coordinates (Haversine formula).
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates perpendicular cross-track distance in meters from a point to a line segment.
 */
export function crossTrackDistanceMeters(
  point: [number, number],
  segStart: [number, number],
  segEnd: [number, number]
): number {
  const [lat, lon] = point;
  const [lat1, lon1] = segStart;
  const [lat2, lon2] = segEnd;

  const d13 = haversineDistanceMeters(lat1, lon1, lat, lon);
  if (d13 === 0) return 0;

  const d12 = haversineDistanceMeters(lat1, lon1, lat2, lon2);
  if (d12 === 0) return d13;

  // Bearing from start to end
  const y12 = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x12 =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const theta12 = Math.atan2(y12, x12);

  // Bearing from start to point
  const y13 = Math.sin(((lon - lon1) * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180);
  const x13 =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.cos(((lon - lon1) * Math.PI) / 180);
  const theta13 = Math.atan2(y13, x13);

  const deltaTheta = theta13 - theta12;
  const R = 6371e3;
  const dxt = Math.asin(Math.sin(d13 / R) * Math.sin(deltaTheta)) * R;
  return Math.abs(dxt);
}

/**
 * Finds minimum cross-track distance from a point to an entire polyline.
 */
export function minDistanceToPolyline(
  point: [number, number],
  polyline: [number, number][]
): number {
  if (!polyline || polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    return haversineDistanceMeters(point[0], point[1], polyline[0][0], polyline[0][1]);
  }

  let minDistance = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = crossTrackDistanceMeters(point, polyline[i], polyline[i + 1]);
    if (d < minDistance) {
      minDistance = d;
    }
  }
  return minDistance;
}

/**
 * Real-world average speeds used for ETA calculation.
 *
 * Why we recompute duration from distance instead of using OSRM's duration directly:
 * The public OSRM demo server (router.project-osrm.org) only has reliable routing for
 * the 'car' profile. The 'foot' and 'bike' profiles on the demo server often return
 * car-speed durations, making all modes show the same ETA.
 *
 * Solution: Use OSRM's road distance (accurate — it follows actual roads), but compute
 * duration using realistic mode-specific average speeds. This gives correct, differentiated
 * ETAs for all three modes.
 */
const MODE_SPEEDS_MPS: Record<TransportMode, number> = {
  walking: 5000 / 3600,   // 5 km/h — brisk walking speed
  cycling: 15000 / 3600,  // 15 km/h — average urban cycling
  driving: 40000 / 3600,  // 40 km/h — urban driving with traffic lights
  transit: 25000 / 3600,  // 25 km/h — bus/metro average including stops
};

export class OSRMRoutingProvider implements RoutingProvider {
  private baseUrl: string;

  constructor(baseUrl: string = OSRM_ROUTER_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async calculateRoute(
    start: [number, number],
    destination: [number, number],
    mode: TransportMode = 'walking'
  ): Promise<RouteResult> {
    // Always use 'car' profile for road geometry — the public OSRM demo only
    // has reliable road-network routing for car. We apply the correct speed ourselves.
    const profile = 'car';

    // Format: lon,lat;lon,lat
    const coordinates = `${start[1]},${start[0]};${destination[1]},${destination[0]}`;
    const url = `${this.baseUrl}/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson&steps=false`;

    const speedMps = MODE_SPEEDS_MPS[mode];

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Routing request returned status ${response.status}`);
        }

        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          // Convert GeoJSON [lon, lat] coordinates to Leaflet [lat, lng]
          const latLngs: [number, number][] = route.geometry.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon]
          );

          const roadDistanceMeters = Math.round(route.distance);
          // Compute duration from road distance using mode-specific speed (not OSRM's duration)
          const realisticDurationSeconds = Math.round(roadDistanceMeters / speedMps);

          return {
            coordinates: latLngs,
            distanceMeters: roadDistanceMeters,
            durationSeconds: realisticDurationSeconds,
            isEstimate: false,
            provider: 'OSRM',
          };
        }
      } catch (err) {
        if (attempt === maxRetries) {
          console.warn(`[RoutingProvider] Route calculation failed after ${maxRetries} attempts, using straight-line fallback:`, err);
        } else {
          // Short exponential backoff
          await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
        }
      }
    }

    // Graceful fallback: straight line distance with mode-specific speed
    const straightDist = haversineDistanceMeters(start[0], start[1], destination[0], destination[1]);
    // Road distance is ~1.35× straight-line on average in urban areas
    const estimatedRoadDist = Math.round(straightDist * 1.35);
    const estimatedDuration = Math.round(estimatedRoadDist / speedMps);

    return {
      coordinates: [start, destination],
      distanceMeters: estimatedRoadDist,
      durationSeconds: estimatedDuration,
      isEstimate: true,
      provider: 'Straight-line Fallback',
    };
  }
}


/**
 * OpenRouteService implementation of RoutingProvider.
 * Provides excellent native routing for walking, cycling, and driving.
 * Requires an API key (VITE_ORS_API_KEY in .env).
 */
export class OpenRouteServiceProvider implements RoutingProvider {
  private baseUrl: string;
  private apiKey: string;
  private fallbackProvider: RoutingProvider;

  constructor(apiKey: string = ORS_API_KEY, baseUrl: string = ORS_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fallbackProvider = new OSRMRoutingProvider();
  }

  async calculateRoute(
    start: [number, number],
    destination: [number, number],
    mode: TransportMode = 'walking'
  ): Promise<RouteResult> {
    // If no API key is provided, gracefully fall back to the OSRM implementation
    if (!this.apiKey) {
      console.warn('[RoutingProvider] No ORS API key found. Falling back to OSRM demo server.');
      return this.fallbackProvider.calculateRoute(start, destination, mode);
    }

    // Map transport mode to ORS profile
    let profile = 'foot-walking';
    if (mode === 'driving' || mode === 'transit') profile = 'driving-car';
    if (mode === 'cycling') profile = 'cycling-regular';

    // Format: lon,lat
    const startStr = `${start[1]},${start[0]}`;
    const endStr = `${destination[1]},${destination[0]}`;
    
    // ORS GET endpoint format
    const url = `${this.baseUrl}/${profile}?api_key=${this.apiKey}&start=${startStr}&end=${endStr}`;

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`ORS Routing request returned status ${response.status}`);
        }

        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const route = data.features[0];
          // Convert GeoJSON [lon, lat] coordinates to Leaflet [lat, lng]
          const latLngs: [number, number][] = route.geometry.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon]
          );

          return {
            coordinates: latLngs,
            distanceMeters: Math.round(route.properties.summary.distance),
            durationSeconds: Math.round(route.properties.summary.duration),
            isEstimate: false,
            provider: 'OpenRouteService',
          };
        }
      } catch (err) {
        if (attempt === maxRetries) {
          console.warn(`[RoutingProvider] ORS calculation failed after ${maxRetries} attempts, falling back to OSRM:`, err);
        } else {
          // Short exponential backoff
          await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
        }
      }
    }

    // If ORS completely fails, fallback to OSRM
    return this.fallbackProvider.calculateRoute(start, destination, mode);
  }
}

// Default export uses ORS (it will automatically fallback to OSRM if VITE_ORS_API_KEY is missing)
export const defaultRoutingProvider = new OpenRouteServiceProvider();
