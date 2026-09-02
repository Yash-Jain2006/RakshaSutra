import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Coffee,
  ExternalLink,
  Fuel,
  Hospital,
  Loader2,
  RotateCcw,
  Search,
  Shield,
} from 'lucide-react';
import { BackHeader } from '../layout/BackHeader';
import { SectionTitle } from '../common/SectionTitle';

// Fix Leaflet default icon path issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Place {
  id: number;
  name: string;
  type: 'Police' | 'Hospital' | 'Fuel Station' | 'Cafe';
  lat: number;
  lng: number;
  distanceM: number;
}

interface MapPageProps {
  nav: (page: string) => void;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const CACHE_KEY = 'map_poi_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const TYPE_COLORS: Record<string, string> = {
  Police: '#4f46e5',
  Hospital: '#dc2626',
  'Fuel Station': '#d97706',
  Cafe: '#16a34a',
};

const TYPE_EMOJI: Record<string, string> = {
  Police: '🛡️',
  Hospital: '🏥',
  'Fuel Station': '⛽',
  Cafe: '☕',
};

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// Single Overpass query that fetches ALL types at once
function buildAllQuery(lat: number, lng: number, radius = 3000): string {
  return `[out:json][timeout:20];(
    node[amenity=police](around:${radius},${lat},${lng});
    way[amenity=police](around:${radius},${lat},${lng});
    node[amenity=hospital](around:${radius},${lat},${lng});
    way[amenity=hospital](around:${radius},${lat},${lng});
    node[amenity=clinic](around:${radius},${lat},${lng});
    way[amenity=clinic](around:${radius},${lat},${lng});
    node[amenity=fuel](around:${radius},${lat},${lng});
    way[amenity=fuel](around:${radius},${lat},${lng});
    node[amenity=cafe](around:${radius},${lat},${lng});
  );out center 40;`;
}

function parseElement(el: any, userLat: number, userLng: number, idx: number): Place | null {
  const elLat = el.lat ?? el.center?.lat;
  const elLng = el.lon ?? el.center?.lon;
  if (!elLat || !elLng) return null;
  const tags = el.tags || {};
  const name =
    tags.name || tags['name:en'] || tags['name:hi'] ||
    (tags.amenity === 'police' ? 'Police Station'
      : tags.amenity === 'hospital' ? 'Hospital'
      : tags.amenity === 'clinic' ? 'Clinic'
      : tags.amenity === 'fuel' ? 'Fuel Station'
      : 'Cafe');
  let type: Place['type'] = 'Cafe';
  if (tags.amenity === 'police') type = 'Police';
  else if (tags.amenity === 'hospital' || tags.amenity === 'clinic') type = 'Hospital';
  else if (tags.amenity === 'fuel') type = 'Fuel Station';
  return { id: el.id || idx, name, type, lat: elLat, lng: elLng, distanceM: haversineM(userLat, userLng, elLat, elLng) };
}

const IconByType: React.FC<{ type: string; size?: number }> = ({ type, size = 18 }) => {
  const props = { size, strokeWidth: 2.15 };
  if (type === 'Police') return <Shield {...props} />;
  if (type === 'Hospital') return <Hospital {...props} />;
  if (type === 'Cafe') return <Coffee {...props} />;
  return <Fuel {...props} />;
};

const FILTERS = ['All', 'Police', 'Hospital', 'Fuel Station', 'Cafe'];

export const MapPage: React.FC<MapPageProps> = ({ nav }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const userMarker = useRef<L.Marker | null>(null);
  const poiMarkers = useRef<L.LayerGroup | null>(null);

  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [allPlaces, setAllPlaces] = useState<Place[]>([]); // full unfiltered data
  const [loading, setLoading] = useState(false);
  const [locError, setLocError] = useState('');
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  // Derived: filter + search applied client-side — no extra network call
  const visiblePlaces = allPlaces
    .filter((p) => filter === 'All' || p.type === filter)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  // Update map markers for visible places
  const updateMarkers = useCallback((results: Place[]) => {
    if (!leafletMap.current) return;
    poiMarkers.current?.clearLayers();
    results.forEach((place) => {
      const color = TYPE_COLORS[place.type] || '#6255ec';
      const emoji = TYPE_EMOJI[place.type] || '📍';
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #fff;">${emoji}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = L.marker([place.lat, place.lng], { icon });
      marker.bindPopup(`<b>${place.name}</b><br/>${place.type} · ${formatDist(place.distanceM)} away`);
      poiMarkers.current?.addLayer(marker);
    });
  }, []);

  // Update markers whenever filter/search changes — pure client side
  useEffect(() => {
    updateMarkers(visiblePlaces);
  }, [filter, search, allPlaces]);

  // Fetch ALL places in one shot (cached for 5 min)
  const fetchAllPOIs = useCallback(async (lat: number, lng: number, force = false) => {
    // Check cache first
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { ts, lat: cLat, lng: cLng, data } = JSON.parse(cached);
          const tooOld = Date.now() - ts > CACHE_TTL_MS;
          const tooFar = haversineM(lat, lng, cLat, cLng) > 500; // >500m moved
          if (!tooOld && !tooFar) {
            // Recalculate distances for current position
            const refreshed: Place[] = data.map((p: Place) => ({ ...p, distanceM: haversineM(lat, lng, p.lat, p.lng) }));
            setAllPlaces(refreshed.sort((a, b) => a.distanceM - b.distanceM));
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    setLoading(true);
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(buildAllQuery(lat, lng))}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const json = await res.json();
      const results: Place[] = (json.elements || [])
        .map((el: any, i: number) => parseElement(el, lat, lng, i))
        .filter(Boolean)
        .sort((a: Place, b: Place) => a.distanceM - b.distanceM);

      setAllPlaces(results);
      // Cache result
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), lat, lng, data: results }));
      } catch {}
    } catch {
      setAllPlaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Init map + locate user
  const locateUser = useCallback((force = false) => {
    setLocError('');
    // Use maximumAge=30s for fast response, fallback to fresh
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserPos({ lat, lng });

        if (!leafletMap.current && mapRef.current) {
          const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([lat, lng], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
          poiMarkers.current = L.layerGroup().addTo(map);
          const youIcon = L.divIcon({
            className: '',
            html: `<div style="background:#6255ec;color:#fff;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 0 6px rgba(98,85,236,0.22);border:3px solid #fff;">📍</div>`,
            iconSize: [34, 34], iconAnchor: [17, 17],
          });
          userMarker.current = L.marker([lat, lng], { icon: youIcon }).addTo(map).bindPopup('<b>You are here</b>');
          leafletMap.current = map;
        } else if (leafletMap.current) {
          leafletMap.current.setView([lat, lng], 15);
          userMarker.current?.setLatLng([lat, lng]);
        }

        fetchAllPOIs(lat, lng, force);
      },
      () => {
        setLoading(false);
        setLocError('Location permission denied. Please allow location access and try again.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, [fetchAllPOIs]);

  useEffect(() => {
    locateUser(false);
    return () => {
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
    };
  }, []);

  const openInMaps = (place: Place) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`, '_blank');
  };

  return (
    <section className="screen map-screen" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <BackHeader
        title="Safe places near you"
        nav={nav}
        extra={
          <button
            onClick={() => locateUser(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#6255ec', background: 'none', border: 'none', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
            disabled={loading}
          >
            <RotateCcw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        }
      />

      {/* Search */}
      <div className="search">
        <Search size={18} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search nearby places…" />
      </div>

      {/* Filter tabs — instant, no network call */}
      <div className="filters" style={{ overflowX: 'auto', flexShrink: 0 }}>
        {FILTERS.map((item) => (
          <button className={filter === item ? 'selected' : ''} key={item} onClick={() => setFilter(item)}>
            {item !== 'All' && <IconByType type={item} size={14} />} {item}
          </button>
        ))}
      </div>

      {/* Real Leaflet Map */}
      <div style={{ position: 'relative', flexShrink: 0, height: '220px', borderRadius: '12px', overflow: 'hidden', margin: '0 0 4px' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.65)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1000, gap: '8px' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#6255ec' }} />
            <span style={{ fontSize: '11px', color: '#6255ec', fontWeight: 600 }}>Fetching nearby places…</span>
          </div>
        )}
      </div>

      {/* Error */}
      {locError && (
        <div style={{ margin: '0 0 8px', padding: '10px 14px', background: '#fff1f2', borderRadius: '10px', color: '#dc2626', fontSize: '12px', fontWeight: 600 }}>
          {locError}
          <button onClick={() => locateUser(true)} style={{ display: 'block', marginTop: '6px', color: '#6255ec', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      )}

      {/* Places list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <SectionTitle title={`Nearby safe places${allPlaces.length > 0 ? ` (${visiblePlaces.length})` : ''}`} />
        <div className="places-list">
          {visiblePlaces.map((place) => (
            <div className="place-row" key={place.id} style={{ cursor: 'pointer' }} onClick={() => openInMaps(place)}>
              <span className={`place-type ${place.type.replace(' ', '-').toLowerCase()}`}>
                <IconByType type={place.type} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: '13px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.name}</b>
                <small>{place.type} · {formatDist(place.distanceM)} away</small>
              </div>
              <ExternalLink size={15} style={{ flexShrink: 0, color: 'var(--text-dim)' }} />
            </div>
          ))}
          {!loading && visiblePlaces.length === 0 && !locError && (
            <p className="empty-state">{userPos ? 'No places found. Try a different filter.' : 'Waiting for your location…'}</p>
          )}
        </div>
      </div>
    </section>
  );
};
