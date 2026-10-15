import React, { useState, useEffect, useRef } from 'react';
import { Camera, Check, Download, Phone, ShieldCheck, Users, Volume2, X, StopCircle } from 'lucide-react';
import type { EmergencyContact, SosDelivery } from '../../types/models';
import { saveSosEvidenceToLocal, triggerBlobDownload } from '../../utils/sosEvidenceStorage';

interface SOSOverlayProps {
  contacts: EmergencyContact[];
  elapsed: number;
  cancel: () => void;
  deliveries?: SosDelivery[];
  isOffline?: boolean;
}

export const SOSOverlay: React.FC<SOSOverlayProps> = ({
  contacts,
  elapsed,
  cancel,
  deliveries = [],
  isOffline = false,
}) => {
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const formattedTime = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  // Filter deliveries by type
  const rakshakDeliveries = deliveries.filter((d) => d.recipient_type === 'rakshak');

  const handleCancelClick = () => {
    setShowConfirmCancel(true);
  };

  const handleConfirmCancel = () => {
    setShowConfirmCancel(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping recorder:', err);
      }
    }
    // Allow MediaRecorder onstop to finish writing the file and IndexedDB record
    setTimeout(() => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      cancel();
    }, 600);
  };

  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
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

    let isCancelled = false;
    let localStream: MediaStream | null = null;
    let localMr: MediaRecorder | null = null;

    // Default to enabled for safety unless user explicitly turned it off in settings
    const shouldRecord = localStorage.getItem('auto_av_sos') !== 'false';
    if (shouldRecord && navigator.mediaDevices?.getUserMedia) {
      // Try back camera first; fall back to front, video+audio, video-only, audio-only
      const tryGetMedia = async (): Promise<MediaStream> => {
        try {
          return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
        } catch {
          try {
            return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
          } catch {
            try {
              return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            } catch {
              try {
                // If microphone is blocked or missing, still record video!
                return await navigator.mediaDevices.getUserMedia({ video: true });
              } catch {
                // If camera is blocked or missing, record audio evidence!
                return await navigator.mediaDevices.getUserMedia({ audio: true });
              }
            }
          }
        }
      };

      tryGetMedia()
        .then((s) => {
          if (isCancelled) {
            s.getTracks().forEach(t => t.stop());
            return;
          }
          localStream = s;
          setStream(s);

          const hasAudio = s.getAudioTracks().length > 0;
          const hasVideo = s.getVideoTracks().length > 0;
          setPerms(prev => ({
            ...prev,
            audio: hasAudio,
            video: hasVideo
          }));

          // Start Recording to save on device
          try {
            let mimeType = '';
            if (hasVideo) {
              if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                mimeType = 'video/webm;codecs=vp8,opus';
              } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                mimeType = 'video/mp4';
              } else if (MediaRecorder.isTypeSupported('video/webm')) {
                mimeType = 'video/webm';
              }
            } else if (hasAudio) {
              if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm';
              } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
              }
            }

            const options = mimeType ? { mimeType } : undefined;
            const mr = new MediaRecorder(s, options);
            localMr = mr;
            mediaRecorderRef.current = mr;
            
            mr.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };

            mr.onstop = async () => {
              if (chunksRef.current.length === 0) return;
              const isVideo = hasVideo;
              const resolvedMime = mimeType || (isVideo ? 'video/webm' : 'audio/webm');
              const blob = new Blob(chunksRef.current, { type: resolvedMime });
              chunksRef.current = []; // Clear for next recording

              try {
                await saveSosEvidenceToLocal(blob, resolvedMime);
                setSavedLocally(true);
              } catch (saveErr) {
                console.error('[SOS Recording] Error saving evidence:', saveErr);
              }
            };

            mr.start(1000); // chunk every 1 second
          } catch (err) {
            console.error('MediaRecorder start failed:', err);
          }
        })
        .catch((e) => console.error('Failed to get media for SOS recording:', e));
    }

    return () => {
      isCancelled = true;
      if (localMr && localMr.state !== 'inactive') {
        try { localMr.stop(); } catch {}
      }
      setTimeout(() => {
        if (localStream) {
          localStream.getTracks().forEach((t) => t.stop());
        }
      }, 500);
    };
  }, [facingMode]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleSaveRecordingNow = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.requestData();
      } catch {}
    }
    setTimeout(() => {
      if (chunksRef.current.length > 0) {
        const isVideo = perms.video;
        const mimeType = isVideo ? 'video/webm' : 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        triggerBlobDownload(blob, mimeType);
        saveSosEvidenceToLocal(blob, mimeType);
        setSavedLocally(true);
      }
    }, 150);
  };

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
          <button
            type="button"
            aria-label="Save evidence locally"
            onClick={handleSaveRecordingNow}
            style={{ cursor: 'pointer', background: savedLocally ? 'rgba(34, 197, 94, 0.2)' : undefined }}
            title="Save / download recording to device"
          >
            {savedLocally ? <Check size={15} color="#22c55e" /> : <Download size={15} />}
            {savedLocally ? 'Saved' : 'Save Video'}
          </button>
        </div>
      </div>

      {stream && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ display: 'none' }}
          aria-hidden="true"
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
          <i className={deliveries.some((d) => d.recipient_type === 'contact' && (d.status === 'delivered' || d.status === 'sent')) ? 'delivered' : 'queued'}>
            {isOffline
              ? 'Pending (Offline)'
              : deliveries.some((d) => d.recipient_type === 'contact' && (d.status === 'delivered' || d.status === 'sent'))
                ? 'Alert Sent'
                : 'Queued'}
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
                Searching nearest verified Rakshaks within 2.5 km...
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
