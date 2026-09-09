import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Footprints,
  Car,
  Bike,
  Navigation,
  PhoneCall,
  RotateCcw,
  Share2,
  Shield,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { activeJourneyEngine, type JourneyEngineState } from '../../services/journeyEngine';
import { createMapTileLayer } from '../../services/providers/mapProvider';
import { updateLiveJourney, revokeShareToken } from '../../services/journeyService';
import { createSosEvent, dispatchSos } from '../../services/safetyService';
import type { EmergencyContact } from '../../types/models';

interface JourneyScreenProps {
  nav: (page: string) => void;
  contacts: EmergencyContact[];
  userId?: string;
  onTriggerFakeCall: () => void;
  onTriggerSos?: () => void;
  onEndJourney: () => void;
  shareUrl?: string;
}

export const JourneyScreen: React.FC<JourneyScreenProps> = ({
  nav,
  contacts,
  userId,
  onTriggerFakeCall,
  onTriggerSos,
  onEndJourney,
  shareUrl,
}) => {
  const [engineState, setEngineState] = useState<JourneyEngineState>(activeJourneyEngine.getState());
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [sosStatusMessage, setSosStatusMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const isUserPanningRef = useRef(false);

  // Subscribe to singleton JourneyEngine
  useEffect(() => {
    const unsubscribe = activeJourneyEngine.subscribe((state) => {
      setEngineState(state);
    });
    return () => unsubscribe();
  }, []);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const initialLat = engineState.currentLocation?.latitude || 12.9716;
      const initialLng = engineState.currentLocation?.longitude || 77.5946;

      const map = L.map(mapContainerRef.current, {
        attributionControl: false,
        zoomControl: false,
      }).setView([initialLat, initialLng], 15);

      createMapTileLayer().addTo(map);

      // Detect user manual interaction so we don't aggressively yank camera
      map.on('dragstart', () => {
        isUserPanningRef.current = true;
      });

      leafletMapRef.current = map;
    }

    const map = leafletMapRef.current;

    // 1. Update User Marker & Pulsing beacon
    if (engineState.currentLocation) {
      const userLatLng: [number, number] = [
        engineState.currentLocation.latitude,
        engineState.currentLocation.longitude,
      ];

      const pulsingIcon = L.divIcon({
        className: 'user-beacon-wrapper',
        html: `
          <div class="user-pulse-beacon">
            <div class="user-pulse-ring"></div>
            <div class="user-pulse-dot"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(userLatLng, { icon: pulsingIcon }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng(userLatLng);
      }

      // Accuracy ring
      const accuracy = engineState.currentLocation.accuracy || 20;
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle(userLatLng, {
          radius: Math.min(accuracy, 100),
          color: '#3b82f6',
          fillColor: '#60a5fa',
          fillOpacity: 0.12,
          weight: 1,
        }).addTo(map);
      } else {
        accuracyCircleRef.current.setLatLng(userLatLng);
        accuracyCircleRef.current.setRadius(Math.min(accuracy, 100));
      }

      if (!isUserPanningRef.current) {
        map.panTo(userLatLng, { animate: true, duration: 0.8 });
      }
    }

    // 2. Destination Marker (Purple Map Pin matching visual reference)
    if (engineState.destinationCoords) {
      const destLatLng: [number, number] = engineState.destinationCoords;

      const destIcon = L.divIcon({
        className: 'dest-pin-wrapper',
        html: `
          <div class="dest-purple-pin">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#6366f1" stroke="#ffffff" stroke-width="2">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5" fill="#ffffff"/>
            </svg>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker(destLatLng, { icon: destIcon }).addTo(map);
      } else {
        destMarkerRef.current.setLatLng(destLatLng);
      }
    }

    // 3. Dashed Purple Route Polyline (Matching visual reference screenshot)
    if (engineState.route && engineState.route.coordinates.length > 0) {
      if (!routePolylineRef.current) {
        routePolylineRef.current = L.polyline(engineState.route.coordinates, {
          color: '#6366f1',
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 8', // Dashed line per reference screenshot
          lineCap: 'round',
        }).addTo(map);
      } else {
        routePolylineRef.current.setLatLngs(engineState.route.coordinates);
      }
    }

    // Cleanup on unmount
    return () => {
      // Keep map reference alive if component re-renders
    };
  }, [engineState.currentLocation, engineState.destinationCoords, engineState.route]);

  const handleRecenter = () => {
    isUserPanningRef.current = false;
    if (leafletMapRef.current && engineState.currentLocation) {
      leafletMapRef.current.setView(
        [engineState.currentLocation.latitude, engineState.currentLocation.longitude],
        16,
        { animate: true }
      );
    }
  };

  const handleEndJourneyConfirmed = async () => {
    if (engineState.journeyId) {
      try {
        await updateLiveJourney(engineState.journeyId, 'arrived');
      } catch (err) {
        console.warn('Error updating journey on end:', err);
      }
    }
    activeJourneyEngine.endJourney('arrived');
    setShowEndConfirm(false);
    onEndJourney();
    nav('home');
  };

  const handleTriggerSos = async () => {
    setShowSosConfirm(false);
    activeJourneyEngine.setSosState();
    if (onTriggerSos) {
      onTriggerSos();
      return;
    }

    // Step 1: Immediate UI feedback — show "Activating SOS..." before ANY async work
    setSosStatusMessage('Activating SOS...');

    // Step 2: Persist SOS intent to localStorage BEFORE attempting server submission.
    // This ensures the intent survives a page refresh or crash even if the server call fails.
    const sosIntent = {
      journeyId: engineState.journeyId,
      userId,
      latitude: engineState.currentLocation?.latitude ?? null,
      longitude: engineState.currentLocation?.longitude ?? null,
      accuracy: engineState.currentLocation?.accuracy ?? null,
      pendingAt: new Date().toISOString(),
    };
    localStorage.setItem('raksha_pending_sos', JSON.stringify(sosIntent));

    // Step 3: Cancel active journey tracking server-side (best-effort)
    if (engineState.journeyId) {
      try {
        await updateLiveJourney(engineState.journeyId, 'cancelled');
      } catch {
        // Best effort — SOS is more important than clean journey termination
      }
    }

    // Step 4: If offline, show "Waiting for connection..." immediately and schedule retry
    if (!navigator.onLine) {
      setSosStatusMessage('Waiting for connection... SOS will send automatically when back online.');

      // Auto-retry when network comes back
      const retryOnline = async () => {
        window.removeEventListener('online', retryOnline);
        setSosStatusMessage('Connection restored. Sending SOS...');
        await attemptSosServerDispatch();
      };
      window.addEventListener('online', retryOnline);
      return;
    }

    // Step 5: Online — attempt server submission now
    await attemptSosServerDispatch();
  };

  const attemptSosServerDispatch = async () => {
    const sosIntentStr = localStorage.getItem('raksha_pending_sos');
    const intent = sosIntentStr ? JSON.parse(sosIntentStr) : null;

    const lat = intent?.latitude ?? engineState.currentLocation?.latitude;
    const lng = intent?.longitude ?? engineState.currentLocation?.longitude;
    const acc = intent?.accuracy ?? engineState.currentLocation?.accuracy;
    const uid = intent?.userId ?? userId;

    if (!uid || lat == null || lng == null) {
      setSosStatusMessage('Emergency alert active locally.');
      return;
    }

    try {
      const event = await createSosEvent({
        userId: uid,
        latitude: lat,
        longitude: lng,
        accuracyMeters: acc,
        locationSource: 'precise',
      });

      if (event?.id) {
        await dispatchSos(event.id);
        // Step 6: ONLY say "contacts notified" once server confirms
        setSosStatusMessage('Emergency contacts notified');
        localStorage.removeItem('raksha_pending_sos'); // Clear persisted intent
      } else {
        setSosStatusMessage('Waiting for connection... SOS will send automatically when back online.');
      }
    } catch (err) {
      console.warn('[JourneyScreen] SOS server dispatch failed:', err);
      // NEVER claim contacts were notified on failure
      setSosStatusMessage('Waiting for connection... SOS will send automatically when back online.');

      // Schedule retry when network returns
      const retryOnline = async () => {
        window.removeEventListener('online', retryOnline);
        setSosStatusMessage('Connection restored. Sending SOS...');
        await attemptSosServerDispatch();
      };
      window.addEventListener('online', retryOnline);
    }
  };


  const handleRevokeSharing = async () => {
    if (!engineState.journeyId) return;
    try {
      await revokeShareToken(engineState.journeyId);
      activeJourneyEngine.setViewersCount(0);
      alert('Tracking link revoked. Previous viewers can no longer see your location.');
    } catch (err) {
      console.error('Failed to revoke share link:', err);
    }
  };

  const copyShareLink = () => {
    const link = shareUrl || `${window.location.origin}/track/${engineState.journeyId || ''}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Format statistics
  const formatDuration = (seconds: number): string => {
    const totalMinutes = Math.max(1, Math.round(seconds / 60));
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins === 0 ? `${hours}hr` : `${hours}hr ${mins}min`;
  };
  const distanceKm = (engineState.remainingDistanceMeters / 1000).toFixed(1);

  // Status Pill styling
  const renderStatusPill = () => {
    if (engineState.status === 'sos') {
      return (
        <div className="journey-status-pill sos">
          <span className="pill-dot red"></span>
          <span>{sosStatusMessage || 'Emergency SOS Active'}</span>
        </div>
      );
    }
    if (engineState.status === 'arrived') {
      return (
        <div className="journey-status-pill arrived">
          <span className="pill-dot green"></span>
          <span>Arrived safely 🎉</span>
        </div>
      );
    }
    if (engineState.status === 'approaching') {
      return (
        <div className="journey-status-pill approaching">
          <span className="pill-dot blue"></span>
          <span>Approaching destination · Safe so far</span>
        </div>
      );
    }
    if (engineState.isOffline) {
      return (
        <div className="journey-status-pill offline">
          <span className="pill-dot slate"></span>
          <span>Offline · Tracking locally</span>
        </div>
      );
    }
    if (engineState.status === 'gps_unavailable') {
      return (
        <div className="journey-status-pill warning">
          <span className="pill-dot amber"></span>
          <span>Location unavailable · Searching GPS</span>
        </div>
      );
    }
    return (
      <div className="journey-status-pill active">
        <span className="pill-dot green"></span>
        <span>Journey in progress · Safe so far</span>
      </div>
    );
  };

  return (
    <section className="screen journey-screen-container">
      {/* ── Top Header ── */}
      <header className="journey-header">
        <button
          type="button"
          className="journey-back-btn"
          onClick={() => setShowEndConfirm(true)}
          aria-label="End or minimize journey"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="journey-title-group">
          <span className="journey-subtitle">Journey Mode</span>
          <h1 className="journey-main-title">
            Home → {engineState.destinationName || 'Destination'}
          </h1>
        </div>
      </header>

      {/* ── Background Warning Banner if Minimized ── */}
      {engineState.backgroundNotice && (
        <div className="journey-bg-notice">
          <AlertTriangle size={14} />
          <span>{engineState.backgroundNotice}</span>
        </div>
      )}

      {/* ── Live Map Section ── */}
      <div className="journey-map-wrapper">
        <div ref={mapContainerRef} className="journey-leaflet-map" />

        {/* Floating Re-center Button */}
        <button
          type="button"
          className="journey-map-recenter-btn"
          onClick={handleRecenter}
          aria-label="Re-center location"
        >
          <Navigation size={18} />
        </button>
      </div>

      {/* ── Dynamic Status Pill ── */}
      <div className="journey-status-pill-container">
        {renderStatusPill()}
      </div>

      {/* ── Journey Statistics Card (ETA / Distance / Watching) ── */}
      <div className="journey-stats-card">
        <div className="stats-col">
          <span className="stats-val">{formatDuration(engineState.etaSeconds)}</span>
          <span className="stats-lbl">ETA</span>
        </div>

        <div className="stats-col">
          <span className="stats-val">{distanceKm} km</span>
          <span className="stats-lbl">Distance</span>
        </div>

        <div
          className="stats-col interactive"
          onClick={() => setShowViewersModal(true)}
          title="Manage tracking viewers"
        >
          <div className="stats-watching-row">
            <span className="stats-val">{Math.max(1, engineState.activeViewersCount || contacts.length)}</span>
            <span className="stats-mode-icon">
              {engineState.transportMode === 'driving' ? (
                <Car size={14} />
              ) : engineState.transportMode === 'cycling' ? (
                <Bike size={14} />
              ) : (
                <Footprints size={14} />
              )}
            </span>
          </div>
          <span className="stats-lbl">Watching</span>
        </div>
      </div>

      {/* ── Vertical Milestone Timeline ── */}
      <div className="journey-timeline">
        {engineState.timeline.map((step, idx) => {
          const isCompleted = step.completed;
          return (
            <div className={`timeline-item ${isCompleted ? 'completed' : 'pending'}`} key={step.id}>
              <div className="timeline-rail">
                <span className={`timeline-dot ${isCompleted ? 'solid' : 'hollow'}`} />
                {idx < engineState.timeline.length - 1 && (
                  <span className={`timeline-line ${isCompleted ? 'solid' : 'dashed'}`} />
                )}
              </div>
              <div className="timeline-content">
                <span className="timeline-title">{step.title}</span>
                <span className="timeline-subtext">
                  {step.id === 'checkpoint'
                    ? `Current location, ${step.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : step.id === 'approaching' && step.time
                    ? `Estimated ${step.time}`
                    : step.subtext}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Bottom Action Buttons (Fake Call & SOS) ── */}
      <div className="journey-action-bar">
        <button
          type="button"
          className="journey-btn-fakecall"
          onClick={onTriggerFakeCall}
        >
          <PhoneCall size={18} color="#4f46e5" />
          <span>Fake Call</span>
        </button>

        <button
          type="button"
          className="journey-btn-sos"
          onClick={() => {
            if (onTriggerSos) {
              activeJourneyEngine.setSosState();
              onTriggerSos();
            } else {
              setShowSosConfirm(true);
            }
          }}
        >
          <ShieldAlert size={18} color="#ffffff" />
          <span>SOS</span>
        </button>
      </div>

      {/* ── Active Viewers & Sharing Modal ── */}
      {showViewersModal && (
        <div className="modal-backdrop" onClick={() => setShowViewersModal(false)}>
          <div className="sheet viewers-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">
              <div>
                <h2>Live Tracking Viewers</h2>
                <p>Contacts watching your live journey</p>
              </div>
              <button type="button" onClick={() => setShowViewersModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="viewers-list">
              {contacts.map((contact) => (
                <div className="viewer-item" key={contact.id}>
                  <div className="viewer-avatar">{contact.name[0] || 'C'}</div>
                  <div className="viewer-info">
                    <b>{contact.name}</b>
                    <small>{contact.relation || 'Emergency Contact'}</small>
                  </div>
                  <span className="viewer-badge-watching">Watching</span>
                </div>
              ))}
            </div>

            <div className="viewer-share-actions">
              <button type="button" className="btn-secondary" onClick={copyShareLink}>
                {copiedLink ? <CheckCircle2 size={16} color="#16a34a" /> : <Copy size={16} />}
                {copiedLink ? 'Link Copied!' : 'Copy Secure Link'}
              </button>

              <button type="button" className="btn-danger-outline" onClick={handleRevokeSharing}>
                <ShieldAlert size={16} />
                Revoke Link Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SOS Confirmation Dialog ── */}
      {showSosConfirm && (
        <div className="modal-backdrop" onClick={() => setShowSosConfirm(false)}>
          <div className="sheet sos-confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sos-confirm-header">
              <ShieldAlert size={36} color="#dc2626" />
              <h2>Trigger Emergency SOS?</h2>
              <p>This will immediately alert your emergency contacts and share your live coordinates.</p>
            </div>

            <div className="sos-confirm-actions">
              <button
                type="button"
                className="btn-danger-large"
                onClick={handleTriggerSos}
              >
                Yes, Send SOS Alert
              </button>
              <button
                type="button"
                className="btn-secondary-large"
                onClick={() => setShowSosConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── End Journey Confirmation Dialog ── */}
      {showEndConfirm && (
        <div className="modal-backdrop" onClick={() => setShowEndConfirm(false)}>
          <div className="sheet end-confirm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="end-confirm-header">
              <div className="end-confirm-icon-box">
                <AlertTriangle size={26} color="#dc2626" />
              </div>
              <h2>End Safe Journey?</h2>
              <p>
                Live safety tracking and sharing will be stopped for your emergency contacts.
              </p>
              {engineState.destinationName ? (
                <div className="end-confirm-dest-badge">
                  <Navigation size={13} color="#6366f1" />
                  <span>Destination: <strong>{engineState.destinationName}</strong></span>
                </div>
              ) : null}
            </div>

            <div className="end-confirm-actions">
              <button
                type="button"
                className="end-confirm-btn-danger"
                onClick={handleEndJourneyConfirmed}
              >
                End Journey Now
              </button>
              <button
                type="button"
                className="end-confirm-btn-primary"
                onClick={() => {
                  setShowEndConfirm(false);
                  nav('home');
                }}
              >
                Keep Tracking in Background
              </button>
              <button
                type="button"
                className="end-confirm-btn-cancel"
                onClick={() => setShowEndConfirm(false)}
              >
                Continue Tracking (Stay on Map)
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
