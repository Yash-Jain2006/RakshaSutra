import React, { useEffect, useRef } from 'react';
import { AlertOctagon, MapPin, X, Navigation, Navigation2 } from 'lucide-react';
import L from 'leaflet';
import { createMapTileLayer } from '../../services/providers/mapProvider';

interface IncomingSosModalProps {
  sosData: any;
  onAccept: () => void;
  onDecline: () => void;
  isAccepting: boolean;
}

export const IncomingSosModal: React.FC<IncomingSosModalProps> = ({ sosData, onAccept, onDecline, isAccepting }) => {
  if (!sosData) return null;

  const lat = sosData.latitude;
  const lon = sosData.longitude;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      // Initialize Leaflet map with no attribution and no default controls for a clean look
      const map = L.map(mapContainerRef.current, {
        attributionControl: false,
        zoomControl: false,
      }).setView([lat, lon], 15);

      createMapTileLayer().addTo(map);

      // Create a pulsing emergency beacon marker
      const pulsingIcon = L.divIcon({
        className: 'user-beacon-wrapper',
        html: `
          <div style="position: relative; width: 26px; height: 26px;">
            <div style="position: absolute; inset: -4px; border-radius: 50%; background: #ef4444; opacity: 0.3; animation: ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #ef4444; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.25);"></div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      markerRef.current = L.marker([lat, lon], { icon: pulsingIcon }).addTo(map);
      leafletMapRef.current = map;
    } else {
      // Update map center and marker if coordinates change
      leafletMapRef.current.setView([lat, lon]);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
      }
    }
  }, [lat, lon]);

  const handleRecenter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([lat, lon], 15);
    }
  };

  const userName = sosData.profiles?.display_name || 'Someone';

  return (
    <div className="modal-backdrop" style={{ zIndex: 100000, background: 'rgba(0,0,0,0.85)' }}>
      <div className="sheet" style={{ 
        padding: '24px', borderRadius: '24px', maxWidth: '400px', width: '90%', 
        background: '#fff', maxHeight: '90vh', overflowY: 'auto' 
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: '#fee2e2', color: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>
            <AlertOctagon size={36} strokeWidth={2.5} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
            URGENT: SOS Alert!
          </h2>
          <p style={{ margin: 0, fontSize: '15px', color: '#475569', lineHeight: 1.5 }}>
            <strong style={{ color: '#0f172a' }}>{userName}</strong> has triggered an emergency SOS nearby and needs your help immediately.
          </p>
        </div>

        <div style={{ 
          background: '#f8fafc', borderRadius: '16px', overflow: 'hidden', 
          border: '1px solid #e2e8f0', marginBottom: '24px' 
        }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0' }}>
            <MapPin size={18} color="#dc2626" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>User's Live Location</span>
          </div>
          
          <div style={{ width: '100%', height: '210px', position: 'relative' }}>
            {/* Native Leaflet Map - Replaces iframe to prevent cut-off elements */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#f1f5f9' }} />

            {/* Custom Center Arrow Button */}
            <button
              type="button"
              onClick={handleRecenter}
              title="Re-center map"
              aria-label="Re-center map"
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#ffffff',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 1000,
                color: '#2563eb',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.25)';
              }}
            >
              <Navigation2 size={18} fill="#2563eb" color="#2563eb" />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={onAccept}
            disabled={isAccepting}
            style={{
              width: '100%', padding: '16px', borderRadius: '14px',
              background: isAccepting ? '#b91c1c' : '#dc2626', color: '#fff', border: 'none', 
              fontWeight: 800, fontSize: '16px', cursor: isAccepting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
              opacity: isAccepting ? 0.7 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            {isAccepting ? (
              <>
                <div style={{ width: 20, height: 20, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Accepting...
              </>
            ) : (
              <>
                <Navigation size={20} strokeWidth={3} />
                ACCEPT &amp; NAVIGATE
              </>
            )}
          </button>
          
          <button
            onClick={onDecline}
            disabled={isAccepting}
            style={{
              width: '100%', padding: '14px', borderRadius: '14px',
              background: '#f1f5f9', color: '#64748b', border: 'none', 
              fontWeight: 700, fontSize: '15px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <X size={18} strokeWidth={2.5} /> Decline
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
