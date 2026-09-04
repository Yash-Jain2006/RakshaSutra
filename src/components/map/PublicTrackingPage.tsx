import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { Loader2, ShieldAlert, Navigation, Info } from 'lucide-react';
import { Brand } from '../layout/Brand';

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
  destination_latitude?: number;
  destination_longitude?: number;
  destination_name?: string;
  userName: string;
}

export function PublicTrackingPage({ trackingId }: { trackingId: string }) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('public-tracking', {
          body: { trackingId }
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setData(data);
        setError(null);
      } catch (err: any) {
        console.error('Tracking fetch error:', err);
        setError('Unable to fetch live tracking data. The link might be invalid or the tracking has ended.');
      } finally {
        setLoading(false);
      }
    };

    fetchTracking();
    const interval = setInterval(fetchTracking, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [trackingId]);

  useEffect(() => {
    if (!mapRef.current || !data?.latitude || !data?.longitude) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapRef.current, { attributionControl: false }).setView([data.latitude, data.longitude], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      leafletMapRef.current = map;
      
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${data.type === 'sos' ? '#ef4444' : '#3b82f6'}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      markerRef.current = L.marker([data.latitude, data.longitude], { icon: customIcon }).addTo(map);
      
      if (data.destination_latitude && data.destination_longitude) {
         const destIcon = L.divIcon({
           className: 'custom-dest-icon',
           html: `<div style="background-color: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
           iconSize: [20, 20],
           iconAnchor: [10, 10]
         });
         destMarkerRef.current = L.marker([data.destination_latitude, data.destination_longitude], { icon: destIcon }).addTo(map);
      }
    } else {
      leafletMapRef.current.setView([data.latitude, data.longitude]);
      if (markerRef.current) {
        markerRef.current.setLatLng([data.latitude, data.longitude]);
      }
    }
  }, [data]);

  if (loading) {
    return (
      <div className="public-tracking-loading">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" style={{ marginBottom: '16px' }} />
        <p className="font-medium text-lg">Locating User...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="public-tracking-error">
        <div className="public-tracking-error-icon">
          <Info className="w-8 h-8" />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px 0' }}>Tracking Unavailable</h2>
        <p>{error || 'Event not found'}</p>
      </div>
    );
  }

  const isSos = data.type === 'sos';
  const isActive = data.status === 'active' || data.status === 'started';

  return (
    <div className="public-tracking-container">
      <div className="public-tracking-header">
        <Brand />
        <div className="public-tracking-badge">
          Live Tracking
        </div>
      </div>
      
      <div className={`public-tracking-status ${isSos ? 'public-tracking-status-sos' : 'public-tracking-status-journey'}`}>
        {isSos ? <ShieldAlert size={32} style={{ flexShrink: 0 }} /> : <Navigation size={32} style={{ flexShrink: 0 }} />}
        <div>
          <h1>
            {data.userName} {isSos ? 'triggered an SOS' : 'is sharing their journey'}
          </h1>
          <p>
            {!isActive ? (
              <span className="public-tracking-pill">
                {isSos ? 'SOS RESOLVED' : 'JOURNEY ENDED'}
              </span>
            ) : (
              data.type === 'journey' && data.destination_name ? (
                `Heading to: ${data.destination_name}`
              ) : (
                'Live location updating automatically...'
              )
            )}
          </p>
          {isActive && data.latitude && data.longitude && (
            <a 
              href={`https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="public-tracking-pill"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', background: 'white', color: isSos ? '#ef4444' : '#3b82f6', textDecoration: 'none', padding: '6px 12px', borderRadius: '16px', fontWeight: 'bold' }}
            >
              <Navigation size={14} /> Get Directions
            </a>
          )}
        </div>
      </div>

      <div className="public-tracking-map-container">
        {!data.latitude || !data.longitude ? (
           <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', color: '#6b7280', zIndex: 20 }}>
             <p>Waiting for GPS signal...</p>
           </div>
        ) : null}
        <div ref={mapRef} style={{ width: '100%', height: '100%', filter: !isActive ? 'grayscale(1)' : 'none' }} />
        
        {!isActive && (
          <div className="public-tracking-overlay">
            <div className="public-tracking-card">
              <div className="public-tracking-card-icon">
                <Info size={32} />
              </div>
              <h3>Tracking Stopped</h3>
              <p>
                {isSos ? `${data.userName} has marked themselves as safe.` : `${data.userName} has ended their journey.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
