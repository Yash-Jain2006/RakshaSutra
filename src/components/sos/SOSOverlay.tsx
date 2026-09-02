import React, { useState, useEffect, useRef } from 'react';
import { Camera, Check, Phone, ShieldCheck, Users, Volume2, X, StopCircle } from 'lucide-react';
import type { EmergencyContact, SosDelivery } from '../../types/models';

interface SOSOverlayProps {
  contacts: EmergencyContact[];
  elapsed: number;
  cancel: () => void;
  deliveries?: SosDelivery[];
  isDemo?: boolean;
  isOffline?: boolean;
}

export const SOSOverlay: React.FC<SOSOverlayProps> = ({
  contacts,
  elapsed,
  cancel,
  deliveries = [],
  isDemo = false,
  isOffline = false,
}) => {
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const formattedTime = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  // Filter deliveries by type
  const rakshakDeliveries = deliveries.filter((d) => d.recipient_type === 'rakshak');

  const handleCancelClick = () => {
    setShowConfirmCancel(true);
  };

  const handleConfirmCancel = () => {
    setShowConfirmCancel(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    cancel();
  };

  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const [perms, setPerms] = useState({
    audio: false,
    video: false,
    gps: false
  });

  useEffect(() => {
    // Check GPS permission
    try {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((p) => {
        setPerms(prev => ({ ...prev, gps: p.state === 'granted' }));
        p.onchange = () => setPerms(prev => ({ ...prev, gps: p.state === 'granted' }));
      }).catch(() => {});
    } catch(e) {}

    // Check Camera & Mic using Permissions API
    try {
      navigator.permissions.query({ name: 'camera' as PermissionName }).then((p) => {
        setPerms(prev => ({ ...prev, video: p.state === 'granted' }));
        p.onchange = () => setPerms(prev => ({ ...prev, video: p.state === 'granted' }));
      }).catch(() => {});
    } catch(e) {}
    
    try {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((p) => {
        setPerms(prev => ({ ...prev, audio: p.state === 'granted' }));
        p.onchange = () => setPerms(prev => ({ ...prev, audio: p.state === 'granted' }));
      }).catch(() => {});
    } catch(e) {}

    const shouldRecord = localStorage.getItem('auto_av_sos') === 'true';
    if (shouldRecord) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true })
        .then((s) => {
          setStream(s);
          setPerms(prev => ({ ...prev, audio: true, video: true }));

          // Start Recording to save on device
          try {
            const preferredMime = MediaRecorder.isTypeSupported('video/mp4') 
              ? 'video/mp4' 
              : 'video/webm';
            const mr = new MediaRecorder(s, { mimeType: preferredMime });
            mediaRecorderRef.current = mr;
            
            mr.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mr.onstop = () => {
              if (chunksRef.current.length === 0) return;
              const ext = preferredMime === 'video/mp4' ? 'mp4' : 'webm';
              const blob = new Blob(chunksRef.current, { type: preferredMime });
              chunksRef.current = []; // Clear for next recording
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = `rakshasutra-sos-${new Date().getTime()}.${ext}`;
              document.body.appendChild(a);
              a.click();
              setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }, 100);
            };

            mr.start(1000); // chunk every 1 second
          } catch (err) {
            console.error('MediaRecorder failed:', err);
          }
        })
        .catch((e) => console.error('Failed to auto-record on SOS:', e));
    }

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className="sos-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Active emergency SOS alert"
    >
      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="assertive">
        Emergency SOS is active. Timer: {formattedTime}. High accuracy location sharing in progress.
      </div>

      <div className="sos-top">
        <span className="sos-badge-active">
          <i className="pulse-dot" /> SOS ACTIVE
        </span>
        <button onClick={handleCancelClick} aria-label="Cancel SOS">
          <X size={20} />
        </button>
      </div>

      <div className="sos-main">
        <strong className="sos-timer">{formattedTime}</strong>
        <p className="sos-subhead">ALERT NETWORK NOTIFIED</p>
        <h2>Help is on the way</h2>

        <p className="sos-description">
          Live location shared with <b>{contacts.length} emergency contacts</b>. Stay on this screen.
        </p>

        {/* Persistent Call 112 direct emergency button */}
        <a href="tel:112" className="call-112-btn" aria-label="Call 112 Emergency Services immediately">
          <Phone size={18} />
          <span>Call 112 (National Emergency)</span>
        </a>

        <div className="sos-controls" role="toolbar" aria-label="Emergency media controls">
          <button aria-label="Audio status" disabled>
            <span className={`perm-dot ${perms.audio ? 'granted' : 'denied'}`} />
            <Volume2 size={15} /> Audio
          </button>
          <button aria-label="Video status" disabled>
            <span className={`perm-dot ${perms.video ? 'granted' : 'denied'}`} />
            <Camera size={15} /> Video
          </button>
          <button aria-label="GPS Status" disabled>
            <span className={`perm-dot ${perms.gps ? 'granted' : 'denied'}`} />
            GPS Live
          </button>
        </div>
      </div>

      {stream && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
          title="Tap to flip camera"
          style={{
            position: 'absolute',
            top: 64,
            left: 20,
            width: 72,
            height: 72,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '3px solid #ff4444',
            boxShadow: '0 4px 12px rgba(255,68,68,0.3)',
            zIndex: 100,
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        />
      )}

      {/* Real-time Delivery Status Feed */}
      <div className="sos-status" role="region" aria-label="Alert Delivery Status">
        {/* Contact Notifications Status */}
        <div className="sos-item">
          <span>
            <Users size={18} />
          </span>
          <div>
            <b>{contacts.length} Emergency Contacts Notified</b>
            <small>
              {contacts.length > 0
                ? contacts.map((c) => c.name).join(' · ')
                : 'No contacts added yet. Add contacts in settings.'}
            </small>
          </div>
          <i className="queued">
            {isOffline ? 'Pending (Offline)' : 'Queued'}
          </i>
        </div>

        {/* Rakshak Matching Status */}
        {rakshakDeliveries.length > 0 ? (
          (() => {
            const named = rakshakDeliveries.filter((d) => d.recipient_name);
            const unnamed = rakshakDeliveries.filter((d) => !d.recipient_name);
            return (
              <>
                {named.map((delivery) => (
                  <div className="sos-item" key={delivery.id}>
                    <span>
                      <ShieldCheck size={18} />
                    </span>
                    <div>
                      <b>{delivery.recipient_name}</b>
                      <small>{delivery.recipient_sub || 'Verified Volunteer'}</small>
                    </div>
                    <i className={delivery.status}>
                      {delivery.status === 'acknowledged'
                        ? 'Accepted'
                        : delivery.status === 'sent'
                          ? 'Alert Sent'
                          : 'Queued'}
                    </i>
                  </div>
                ))}
                {unnamed.length > 0 && (
                  <div className="sos-item">
                    <span>
                      <ShieldCheck size={18} />
                    </span>
                    <div>
                      <b>{unnamed.length} Nearby Rakshak{unnamed.length > 1 ? 's' : ''}</b>
                      <small>Searching verified volunteers nearby...</small>
                    </div>
                    <i className="queued">Searching</i>
                  </div>
                )}
              </>
            );
          })()
        ) : (
          <div className="sos-item no-rakshaks">
            <span>
              <ShieldCheck size={18} />
            </span>
            <div>
              <b>Rakshak Match Status</b>
              <small>
                {isDemo
                  ? '6 local Rakshaks queued in demo network'
                  : 'Searching nearest verified Rakshaks within 2.5 km...'}
              </small>
            </div>
            <i className="queued">Searching</i>
          </div>
        )}
      </div>

      {/* Safe Now Cancellation Action */}
      <button className="safe-now" onClick={handleCancelClick}>
        I'm Safe Now — Cancel SOS
      </button>

      {/* Intentional Cancellation Modal */}
      {showConfirmCancel && (
        <div className="modal-backdrop">
          <div className="sheet confirmation-sheet" role="alertdialog" aria-labelledby="cancel-title">
            <div className="sheet-handle" />
            <div className="sheet-title">
              <h2 id="cancel-title">Are you sure you are safe?</h2>
              <button onClick={() => setShowConfirmCancel(false)} aria-label="Close dialog">
                <X />
              </button>
            </div>
            <p>
              This will cancel the active SOS event and notify all your emergency contacts and nearby
              Rakshaks that you are safe.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              <button className="primary" onClick={handleConfirmCancel}>
                <Check size={18} /> Yes, I am Safe
              </button>

              <button className="secondary" onClick={() => setShowConfirmCancel(false)}>
                Keep SOS Active
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
