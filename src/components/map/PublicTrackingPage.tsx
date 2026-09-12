import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import {
  AlertTriangle,
  Bike,
  Car,
  CheckCircle2,
  Footprints,
  Info,
  Loader2,
  MapPin,
  Navigation,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Brand } from '../layout/Brand';
import { createMapTileLayer } from '../../services/providers/mapProvider';
import { getLocationFreshness, type FreshnessState } from '../../utils/freshness';
import { defaultRoutingProvider, type RouteResult } from '../../services/providers/routingProvider';

// Fix Leaflet default icon path issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface TrackingData {
  type: 'sos' | 'journey';
  status: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters?: number | null;
  speed?: number | null;
  heading?: number | null;
  last_location_at?: string | null;
  destination_latitude?: number;
  destination_longitude?: number;
  destination_name?: string;
  transport_mode?: string;
  eta_seconds?: number | null;
  remaining_distance_meters?: number | null;
  route_geojson?: any;
  userName: string;
}

export function PublicTrackingPage({ trackingId }: { trackingId: string }) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokedOrEnded, setRevokedOrEnded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewerLocation, setViewerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [calculatedRoute, setCalculatedRoute] = useState<RouteResult | null>(null);
  const routeCalculatedRef = useRef(false);
  const hasFittedBoundsRef = useRef(false);

  // Freshness is computed from data.last_location_at and drives adaptive polling.
  // Both JourneyScreen (tracker) and PublicTrackingPage (viewer) use the same
  // getLocationFreshness() function from utils/freshness.ts — a shared source of truth.
  //
  // PRIVACY CONTRACT (Change #6):
  // This page receives only a point-in-time snapshot from the Edge Function:
  //   ✅ current location, destination, route, ETA, distance, status, last_updated
  //   ❌ historical breadcrumb trail — NOT requested, NOT rendered.
  // The location history stored in journey_location_points is NOT exposed to viewers.

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const viewerMarkerRef = useRef<L.Marker | null>(null);

  // Poll interval timer reference
  const pollTimerRef = useRef<number | null>(null);

  // Optional: emergency contact viewer location
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setViewerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log('Viewer location unavailable:', err.message),
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Adaptive polling loop with leak-proof revocation enforcement
  useEffect(() => {
    let isCancelled = false;

    const fetchTracking = async () => {
      try {
        if (!supabase) {
          throw new Error('Supabase client is not configured.');
        }

        const { data: responseData, error: funcError } = await supabase.functions.invoke(
          'public-tracking',
          {
            body: { trackingId, token: trackingId },
          }
        );

        if (isCancelled) return;

        // If revoked or expired: immediately stop polling, clear coordinates, and unmount markers
        if (funcError || responseData?.error === 'revoked' || responseData?.error === 'expired') {
          setRevokedOrEnded(true);
          setData(null);
          if (leafletMapRef.current) {
            if (userMarkerRef.current) leafletMapRef.current.removeLayer(userMarkerRef.current);
            if (destMarkerRef.current) leafletMapRef.current.removeLayer(destMarkerRef.current);
            if (routePolylineRef.current) leafletMapRef.current.removeLayer(routePolylineRef.current);
          }
          return;
        }

        if (responseData?.error) {
          setRevokedOrEnded(true);
          return;
        }

        setData(responseData);
        setErrorMessage(null);

        // ── Adaptive polling (Change #8) ─────────────────────────────────────
        // Schedule next poll adaptively based on:
        //   1. Terminal status     → stop polling entirely
        //   2. Tab hidden          → 30s (save battery & Edge Function traffic)
        //   3. Stale freshness     → 30-60s (location hasn't updated in >5min)
        //   4. Active + visible    → 5s
        //
        // At scale: 1,000 viewers × 5s = 12,000 req/min.
        // Stale slowdown reduces that significantly for idle/arrived journeys.
        // ─────────────────────────────────────────────────────────────────────
        const isArrived = responseData.status === 'arrived' || responseData.status === 'cancelled';
        if (isArrived) {
          // Terminal: stop continuous polling
          return;
        }

        let nextInterval = 5000; // default 5s active + visible

        if (document.visibilityState === 'hidden') {
          nextInterval = 30000; // 30s when tab is backgrounded
        } else {
          // Compute freshness to decide whether to slow down even while visible
          const freshness = getLocationFreshness(responseData.last_location_at);
          if (freshness.level === 'stale') {
            // Location hasn't updated in >5 minutes — poll every 60s
            nextInterval = 60000;
          } else if (freshness.level === 'delayed') {
            // Location delayed 1-5 minutes — poll every 30s
            nextInterval = 30000;
          }
        }

        if (!isCancelled) {
          pollTimerRef.current = window.setTimeout(fetchTracking, nextInterval);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('Tracking fetch error:', err);
          setErrorMessage('Unable to connect to live tracking server.');
          pollTimerRef.current = window.setTimeout(fetchTracking, 10000);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchTracking();

    return () => {
      isCancelled = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [trackingId]);

  // Dynamic road route resolution if route_geojson was missing from database
  useEffect(() => {
    if (!data || !data.latitude || !data.longitude) return;

    const isSos = data.status === 'sos' || data.type === 'sos';

    if (!isSos) {
      if (
        (!data.route_geojson || !data.route_geojson.coordinates || data.route_geojson.coordinates.length < 2) &&
        data.destination_latitude &&
        data.destination_longitude &&
        !routeCalculatedRef.current
      ) {
        routeCalculatedRef.current = true;
        defaultRoutingProvider
          .calculateRoute(
            [data.latitude, data.longitude],
            [data.destination_latitude, data.destination_longitude],
            (data.transport_mode as any) || 'walking'
          )
          .then((res) => {
            setCalculatedRoute(res);
          })
          .catch((err) => {
            console.warn('[PublicTracking] Road route calculation fallback error:', err);
          });
      }
    } else if (isSos && viewerLocation && !routeCalculatedRef.current) {
      routeCalculatedRef.current = true;
      defaultRoutingProvider
        .calculateRoute(
          [viewerLocation.lat, viewerLocation.lng],
          [data.latitude, data.longitude],
          'driving'
        )
        .then((res) => {
          setCalculatedRoute(res);
        })
        .catch((err) => {
          console.warn('[PublicTracking] Viewer to SOS victim route error:', err);
        });
    }
  }, [
    data?.destination_latitude,
    data?.destination_longitude,
    data?.latitude,
    data?.longitude,
    data?.transport_mode,
    data?.route_geojson,
    data?.status,
    data?.type,
    viewerLocation
  ]);

  // Leaflet map setup and marker synchronisation
  useEffect(() => {
    if (!mapRef.current || !data?.latitude || !data?.longitude) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapRef.current, {
        attributionControl: false,
        zoomControl: false,
      }).setView([data.latitude, data.longitude], 15);

      createMapTileLayer().addTo(map);
      leafletMapRef.current = map;
    }

    const map = leafletMapRef.current;

    // 1. User marker (blue pulsing beacon or red if SOS)
    const isSos = data.status === 'sos' || data.type === 'sos';
    const userIcon = L.divIcon({
      className: 'public-user-marker',
      html: `
        <div style="position: relative; width: 26px; height: 26px;">
          <div style="position: absolute; inset: -4px; border-radius: 50%; background: ${isSos ? '#ef4444' : '#6366f1'}; opacity: 0.3; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="width: 26px; height: 26px; border-radius: 50%; background: ${isSos ? '#ef4444' : '#6366f1'}; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.25);"></div>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([data.latitude, data.longitude], { icon: userIcon }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([data.latitude, data.longitude]);
      userMarkerRef.current.setIcon(userIcon);
    }

    // 2. Destination Marker
    if (data.destination_latitude && data.destination_longitude) {
      const destIcon = L.divIcon({
        className: 'public-dest-marker',
        html: `
          <div style="display: flex; align-items: center; justify-content: center; width: 30px; height: 30px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#10b981" stroke="#ffffff" stroke-width="2">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
            </svg>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker(
          [data.destination_latitude, data.destination_longitude],
          { icon: destIcon }
        ).addTo(map);
      } else {
        destMarkerRef.current.setLatLng([data.destination_latitude, data.destination_longitude]);
      }
    }

    // 3. Road Route Polyline (Following actual streets/roads)
    const activeRouteCoordinates: [number, number][] =
      data.route_geojson && data.route_geojson.coordinates && data.route_geojson.coordinates.length > 1
        ? data.route_geojson.coordinates.map(([lon, lat]: [number, number]) => [lat, lon])
        : calculatedRoute && calculatedRoute.coordinates && calculatedRoute.coordinates.length > 1
        ? calculatedRoute.coordinates
        : [];

    if (activeRouteCoordinates.length > 0) {
      if (!routePolylineRef.current) {
        routePolylineRef.current = L.polyline(activeRouteCoordinates, {
          color: isSos ? '#ef4444' : '#6366f1',
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 8',
        }).addTo(map);
      } else {
        routePolylineRef.current.setStyle({ color: isSos ? '#ef4444' : '#6366f1' });
        routePolylineRef.current.setLatLngs(activeRouteCoordinates);
      }
    } else if (!isSos && data.destination_latitude && data.destination_longitude) {
      // Fallback straight-line only if road calculation hasn't finished yet
      const lineCoords: [number, number][] = [
        [data.latitude, data.longitude],
        [data.destination_latitude, data.destination_longitude],
      ];
      if (!routePolylineRef.current) {
        routePolylineRef.current = L.polyline(lineCoords, {
          color: '#6366f1',
          weight: 3,
          dashArray: '5, 8',
        }).addTo(map);
      } else {
        routePolylineRef.current.setLatLngs(lineCoords);
      }
    } else if (isSos && viewerLocation) {
      const lineCoords: [number, number][] = [
        [viewerLocation.lat, viewerLocation.lng],
        [data.latitude, data.longitude],
      ];
      if (!routePolylineRef.current) {
        routePolylineRef.current = L.polyline(lineCoords, {
          color: '#ef4444',
          weight: 3,
          dashArray: '5, 8',
        }).addTo(map);
      } else {
        routePolylineRef.current.setLatLngs(lineCoords);
      }
    }

    // Auto fit bounds to see both user and destination with road route
    if (!hasFittedBoundsRef.current) {
      let boundsToFit: L.LatLngBounds | null = null;
      if (!isSos && data.destination_latitude && data.destination_longitude) {
        boundsToFit = L.latLngBounds([
          [data.latitude, data.longitude],
          [data.destination_latitude, data.destination_longitude],
        ]);
      } else if (isSos && viewerLocation) {
        boundsToFit = L.latLngBounds([
          [viewerLocation.lat, viewerLocation.lng],
          [data.latitude, data.longitude],
        ]);
      }

      if (boundsToFit) {
        hasFittedBoundsRef.current = true;
        map.fitBounds(boundsToFit, { padding: [50, 50], maxZoom: 16 });
      }
    }

    // 4. Viewer Location Marker
    if (viewerLocation) {
      const viewerIcon = L.divIcon({
        className: 'viewer-marker',
        html: `<div style="background-color: #64748b; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      if (!viewerMarkerRef.current) {
        viewerMarkerRef.current = L.marker([viewerLocation.lat, viewerLocation.lng], {
          icon: viewerIcon,
        }).addTo(map);
      } else {
        viewerMarkerRef.current.setLatLng([viewerLocation.lat, viewerLocation.lng]);
      }
    }
  }, [data, viewerLocation]);

  // If link was revoked or expired, render the leak-proof message
  if (revokedOrEnded) {
    return (
      <div className="public-tracking-container" style={{ padding: '24px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <ShieldAlert size={32} color="#64748b" />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
          This tracking link is no longer available.
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '320px', lineHeight: 1.5 }}>
          Access to this live tracking session has ended or been revoked by the user.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="public-tracking-loading" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <Loader2 className="animate-spin" size={32} color="#6366f1" />
        <p style={{ color: '#64748b', fontSize: '13px' }}>Connecting to secure live tracking...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="public-tracking-container" style={{ padding: '24px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontSize: '14px' }}>This tracking link is no longer available.</p>
      </div>
    );
  }

  const freshness: FreshnessState = getLocationFreshness(data.last_location_at);
  const formatEtaDuration = (seconds: number | null | undefined): string => {
    if (!seconds || seconds <= 0) return '—';
    const totalMins = Math.max(1, Math.round(seconds / 60));
    if (totalMins < 60) return `${totalMins} min`;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `${hrs}hr ${mins}min` : `${hrs}hr`;
  };

  const isSos = data.status === 'sos' || data.type === 'sos';
  const isArrived = data.status === 'arrived';
  // If SOS, we want the distance/ETA between Viewer and User, NOT the User's Journey ETA
  const effectiveEtaSeconds = isSos 
    ? (calculatedRoute?.durationSeconds ?? null)
    : (data.eta_seconds ?? calculatedRoute?.durationSeconds ?? null);

  let effectiveDistanceMeters = isSos
    ? (calculatedRoute?.distanceMeters ?? null)
    : (data.remaining_distance_meters ?? calculatedRoute?.distanceMeters ?? null);

  // Fallback to live straight-line distance for SOS if OSRM route is missing/pending
  if (isSos && viewerLocation && !effectiveDistanceMeters) {
    const R = 6371e3; // metres
    const lat1 = viewerLocation.lat * Math.PI/180;
    const lat2 = data.latitude * Math.PI/180;
    const dLat = (data.latitude - viewerLocation.lat) * Math.PI/180;
    const dLon = (data.longitude - viewerLocation.lng) * Math.PI/180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    effectiveDistanceMeters = R * c;
  }

  const distKm = effectiveDistanceMeters ? (effectiveDistanceMeters / 1000).toFixed(1) : null;

  return (
    <div className="public-tracking-container" style={{ position: 'relative', height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* ── Top Floating Header ── */}
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 1000, background: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(10px)', borderRadius: '14px', padding: '12px 14px', boxShadow: '0 4px 18px rgba(0,0,0,0.08)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Live Safety Tracking
          </span>

          {/* Unified Freshness Badge */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: freshness.bg, color: freshness.color }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: freshness.dotColor }}></span>
            {freshness.badgeText}
          </span>
        </div>

        <h1 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{data.userName}&apos;s Journey</span>
          {isArrived && <CheckCircle2 size={16} color="#16a34a" />}
        </h1>

        {data.destination_name && (
          <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
            <MapPin size={13} color="#10b981" />
            <span>Heading to <strong>{data.destination_name}</strong></span>
          </div>
        )}
      </div>

      {/* ── Emergency SOS Alert Banner if Active ── */}
      {isSos && (
        <div style={{ position: 'absolute', top: 96, left: 12, right: 12, zIndex: 1000, background: '#fee2e2', border: '1.5px solid #ef4444', borderRadius: '12px', padding: '12px 14px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.2)' }}>
          <ShieldAlert size={24} style={{ flexShrink: 0 }} />
          <div>
            <b style={{ fontSize: '13px', display: 'block' }}>EMERGENCY SOS TRIGGERED</b>
            <small style={{ fontSize: '11px' }}>The user triggered an urgent safety alert from this journey.</small>
          </div>
        </div>
      )}

      {/* ── Live Leaflet Map ── */}
      <div ref={mapRef} style={{ flex: 1, width: '100%', height: '100%' }} />

      {/* ── Bottom Floating Statistics Sheet ── */}
      <div style={{ position: 'absolute', bottom: 16, left: 12, right: 12, zIndex: 1000, background: '#ffffff', borderRadius: '16px', padding: '14px 16px', boxShadow: '0 6px 24px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0' }}>
        {/* Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '6px 10px', borderRadius: '20px', background: isSos ? '#fee2e2' : isArrived ? '#dcfce7' : '#f5f3ff', color: isSos ? '#b91c1c' : isArrived ? '#15803d' : '#6366f1', fontSize: '12px', fontWeight: 700, width: 'fit-content' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSos ? '#ef4444' : isArrived ? '#22c55e' : '#6366f1' }}></span>
          <span>
            {isSos
              ? 'Emergency Alert Active'
              : isArrived
              ? 'Arrived safely at destination'
              : 'Journey in progress · Safe so far'}
          </span>
        </div>

        {/* 3 Metric Columns */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
          <div>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1', display: 'block' }}>
              {formatEtaDuration(effectiveEtaSeconds)}
            </span>
            <small style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>ETA</small>
          </div>

          <div style={{ width: '1px', height: '28px', background: '#f1f5f9' }} />

          <div>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#6366f1', display: 'block' }}>
              {distKm ? `${distKm} km` : '—'}
            </span>
            <small style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Distance</small>
          </div>

          <div style={{ width: '1px', height: '28px', background: '#f1f5f9' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                {data.transport_mode === 'driving' ? 'Driving' : data.transport_mode === 'cycling' ? 'Cycling' : 'Walking'}
              </span>
              {data.transport_mode === 'driving' ? <Car size={15} color="#64748b" /> : data.transport_mode === 'cycling' ? <Bike size={15} color="#64748b" /> : <Footprints size={15} color="#64748b" />}
            </div>
            <small style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Mode</small>
          </div>
        </div>

        {/* Freshness Subtitle */}
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px', textAlign: 'right', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
             <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isSos ? '#ef4444' : '#6366f1' }}></div> User
             </span>
             {viewerLocation && (
               <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                 <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b' }}></div> You
               </span>
             )}
          </div>
          <span>{freshness.label}</span>
        </div>
      </div>
    </div>
  );
}
