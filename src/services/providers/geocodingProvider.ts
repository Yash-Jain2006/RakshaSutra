export interface GeocodedPlace {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
}

export interface GeocodingProvider {
  search(
    query: string,
    userLocation?: { latitude: number; longitude: number } | null
  ): Promise<GeocodedPlace[]>;
  reverse(latitude: number, longitude: number): Promise<GeocodedPlace | null>;
}

/**
 * PhotonGeocodingProvider
 *
 * Current MVP implementation of GeocodingProvider using Komoot's Photon geocoder
 * (open-source, powered by OSM data, self-hostable).
 *
 * IMPORTANT: Photon is the *current implementation*, NOT a contractual production dependency.
 * The GeocodingProvider interface is the stable API boundary used by Journey Mode.
 * If Photon becomes unreliable, rate-limited, or is replaced, you can swap this class
 * for any other implementation (self-hosted Nominatim, Pelias, MapTiler Geocoding, etc.)
 * without changing a single line of JourneyScreen, JourneySetupModal, or journeyEngine.
 *
 * Security note: All requests go directly from the browser to photon.komoot.io.
 * For production with stricter origin policies, route through a server-side proxy Edge Function.
 */
export class PhotonGeocodingProvider implements GeocodingProvider {
  private cache = new Map<string, GeocodedPlace[]>();
  private maxCacheSize = 50;

  async search(
    query: string,
    userLocation?: { latitude: number; longitude: number } | null
  ): Promise<GeocodedPlace[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];

    const cacheKey = `${trimmed.toLowerCase()}_${userLocation?.latitude?.toFixed(2)}_${userLocation?.longitude?.toFixed(2)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6`;
      if (userLocation) {
        url += `&lat=${userLocation.latitude}&lon=${userLocation.longitude}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Geocoding failed with status ${res.status}`);
      }

      const data = await res.json();
      const features = data.features || [];

      const places: GeocodedPlace[] = features.map((f: any, idx: number) => {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0];
        const [lon, lat] = coords;

        const parts: string[] = [
          props.name || props.street || '',
          props.district || props.suburb || props.locality || '',
          props.city || '',
          props.state || '',
        ].filter(Boolean);

        const displayName = parts.join(', ') || props.name || 'Unknown Location';

        return {
          id: `${props.osm_id || idx}-${lat}-${lon}`,
          name: props.name || parts[0] || 'Selected Place',
          displayName,
          latitude: lat,
          longitude: lon,
          city: props.city,
          state: props.state,
        };
      });

      // Maintain simple LRU cache
      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, places);

      return places;
    } catch (err) {
      console.warn('[GeocodingProvider] Search failed, falling back gracefully:', err);
      return [];
    }
  }

  async reverse(latitude: number, longitude: number): Promise<GeocodedPlace | null> {
    try {
      const url = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) return null;

      const props = feature.properties || {};
      const parts = [props.name, props.street, props.city, props.state].filter(Boolean);

      return {
        id: `rev-${latitude}-${longitude}`,
        name: props.name || props.street || 'Current Location',
        displayName: parts.join(', ') || 'Current Location',
        latitude,
        longitude,
        city: props.city,
        state: props.state,
      };
    } catch {
      return null;
    }
  }
}

export const defaultGeocodingProvider = new PhotonGeocodingProvider();
