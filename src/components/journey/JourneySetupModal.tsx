import React, { useState, useEffect, useRef } from 'react';
import {
  Bike,
  Car,
  Check,
  Footprints,
  Loader2,
  MapPin,
  Navigation,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EmergencyContact } from '../../types/models';
import { defaultGeocodingProvider, type GeocodedPlace } from '../../services/providers/geocodingProvider';
import { defaultRoutingProvider, type RouteResult, type TransportMode } from '../../services/providers/routingProvider';
import { defaultLocationProvider } from '../../services/providers/locationProvider';

/**
 * Formats a duration in seconds to a human-readable string.
 * - < 60 min  → "X min"
 * - >= 60 min → "Xhr Ymin"  (e.g. 71 min = "1hr 11min")
 */
function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hours}hr` : `${hours}hr ${mins}min`;
}

interface JourneySetupModalProps {
  contacts: EmergencyContact[];
  close: () => void;
  startJourney: (
    destination: string,
    destinationCoords: [number, number],
    selectedContactIds: (string | number)[],
    mode: TransportMode,
    route?: RouteResult | null
  ) => void;
}

export const JourneySetupModal: React.FC<JourneySetupModalProps> = ({
  contacts,
  close,
  startJourney,
}) => {
  const [destination, setDestination] = useState('');
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodedPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentLoc, setCurrentLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>('walking');
  const [routePreview, setRoutePreview] = useState<RouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const searchTimeout = useRef<number | null>(null);
  // Tracks whether the input value change came from the user typing vs a programmatic update
  // (e.g. when we call setDestination(place.name) after selecting a suggestion).
  // Without this, selecting a suggestion re-opens the dropdown immediately.
  const isUserTyping = useRef(false);
  const { i18n } = useTranslation();

  const [selectedIds, setSelectedIds] = useState<(string | number)[]>(
    contacts.map((c) => c.id)
  );

  // Fetch initial location for bias and routing
  useEffect(() => {
    defaultLocationProvider.getCurrentPosition()
      .then((pos) => {
        setCurrentLoc({ latitude: pos.latitude, longitude: pos.longitude });
      })
      .catch((err) => {
        console.warn('[JourneySetup] Geolocation not immediately available:', err);
      });
  }, []);

  // Debounced geocoding search using GeocodingProvider (Photon implementation)
  useEffect(() => {
    if (!destination.trim() || destination.trim().length < 3 || !showDropdown) {
      setSuggestions([]);
      return;
    }

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = window.setTimeout(async () => {
      setIsSearching(true);
      setErrorMsg('');
      try {
        const results = await defaultGeocodingProvider.search(destination, currentLoc);
        setSuggestions(results);
      } catch (err) {
        console.error('Failed to search locations:', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [destination, showDropdown, currentLoc]);

  // When place is selected, compute real route preview
  const handleSelectSuggestion = async (place: GeocodedPlace) => {
    // Mark as programmatic update BEFORE calling setDestination so onChange doesn't re-open dropdown
    isUserTyping.current = false;
    setDestination(place.name);
    setSelectedCoords([place.latitude, place.longitude]);
    setShowDropdown(false);
    setSuggestions([]);
    setErrorMsg('');

    if (currentLoc) {
      setLoadingRoute(true);
      try {
        const route = await defaultRoutingProvider.calculateRoute(
          [currentLoc.latitude, currentLoc.longitude],
          [place.latitude, place.longitude],
          transportMode
        );
        setRoutePreview(route);
      } catch (err) {
        console.warn('Failed to calculate preview route:', err);
      } finally {
        setLoadingRoute(false);
      }
    }
  };

  // Re-calculate route when transport mode toggles
  const handleModeChange = async (mode: TransportMode) => {
    setTransportMode(mode);
    if (currentLoc && selectedCoords) {
      setLoadingRoute(true);
      try {
        const route = await defaultRoutingProvider.calculateRoute(
          [currentLoc.latitude, currentLoc.longitude],
          selectedCoords,
          mode
        );
        setRoutePreview(route);
      } catch (err) {
        console.warn('Failed to calculate preview route for mode:', err);
      } finally {
        setLoadingRoute(false);
      }
    }
  };

  const toggleContact = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setErrorMsg('Please enter a destination.');
      return;
    }

    if (!selectedCoords) {
      // Fallback: If user entered free text without clicking suggestion, use default offset or search top result
      if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
        return;
      }
      setErrorMsg('Please select a verified location from the suggestions.');
      return;
    }

    startJourney(
      destination.trim(),
      selectedCoords,
      selectedIds,
      transportMode,
      routePreview
    );
  };

  return (
    <div className="modal-backdrop">
      <form className="sheet journey-sheet" onSubmit={handleSubmit}>
        <div className="sheet-handle" />
        <div className="sheet-title">
          <div>
            <p>Personal Safety Tracking</p>
            <h2>Start Safe Journey</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close">
            <X />
          </button>
        </div>

        {errorMsg && (
          <div className="journey-error-banner" style={{ color: '#dc2626', background: '#fee2e2', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '10px' }}>
            {errorMsg}
          </div>
        )}

        {/* ── Destination Input ── */}
        <label>
          Destination Name
          <div className="input-with-icon" style={{ position: 'relative' }}>
            <input
              value={destination}
              onInput={() => { isUserTyping.current = true; }}
              onChange={(e) => {
                setDestination(e.target.value);
                // Only open dropdown when the user is actively typing,
                // not when we programmatically set the value after selection.
                if (isUserTyping.current) {
                  setShowDropdown(true);
                  setSelectedCoords(null); // Clear coords when user edits manually
                }
              }}
              onFocus={() => {
                if (destination.trim() && !selectedCoords) setShowDropdown(true);
              }}
              placeholder="e.g. Indiranagar, Tech Park, Metro Station"
              autoComplete="off"
            />
            {isSearching && (
              <span className="input-icon-right" style={{ right: '12px' }}>
                <Loader2 className="animate-spin" size={16} />
              </span>
            )}

            {/* Suggestions Dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <ul className="journey-search-suggestions">
                {suggestions.map((item) => (
                  <li
                    key={item.id}
                    onClick={() => handleSelectSuggestion(item)}
                    className="suggestion-item"
                  >
                    <MapPin size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#6366f1' }} />
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.displayName}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>

        {/* ── Transport Mode Picker ── */}
        <div className="journey-mode-picker-container" style={{ marginTop: '12px', marginBottom: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim, #64748b)', display: 'block', marginBottom: '6px' }}>
            Travel Mode
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleModeChange('walking')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '8px',
                border: transportMode === 'walking' ? '1.5px solid #6366f1' : '1px solid var(--border-subtle, #e2e8f0)',
                background: transportMode === 'walking' ? '#ede9fe' : 'transparent',
                color: transportMode === 'walking' ? '#6366f1' : 'inherit',
                fontSize: '12px',
                fontWeight: transportMode === 'walking' ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Footprints size={15} /> Walking
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('driving')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '8px',
                border: transportMode === 'driving' ? '1.5px solid #6366f1' : '1px solid var(--border-subtle, #e2e8f0)',
                background: transportMode === 'driving' ? '#ede9fe' : 'transparent',
                color: transportMode === 'driving' ? '#6366f1' : 'inherit',
                fontSize: '12px',
                fontWeight: transportMode === 'driving' ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Car size={15} /> Driving
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('cycling')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '8px',
                border: transportMode === 'cycling' ? '1.5px solid #6366f1' : '1px solid var(--border-subtle, #e2e8f0)',
                background: transportMode === 'cycling' ? '#ede9fe' : 'transparent',
                color: transportMode === 'cycling' ? '#6366f1' : 'inherit',
                fontSize: '12px',
                fontWeight: transportMode === 'cycling' ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Bike size={15} /> Cycling
            </button>
          </div>
        </div>

        {/* ── Route Preview (ETA & Distance) ── */}
        {loadingRoute && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: '#6366f1', margin: '8px 0' }}>
            <Loader2 className="animate-spin" size={14} />
            <span>Calculating optimal road route...</span>
          </div>
        )}

        {routePreview && !loadingRoute && (
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#6366f1' }}>
                {formatDuration(routePreview.durationSeconds)}
              </div>
              <small style={{ fontSize: '10px', color: '#64748b' }}>Estimated ETA</small>
            </div>
            <div style={{ width: '1px', background: '#ddd6fe' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#6366f1' }}>
                {(routePreview.distanceMeters / 1000).toFixed(1)} km
              </div>
              <small style={{ fontSize: '10px', color: '#64748b' }}>Road Distance</small>
            </div>
          </div>
        )}

        {/* ── Emergency Contacts Multi-select ── */}
        <p className="field-label" style={{ marginTop: '10px', marginBottom: '6px' }}>
          Share Live Tracking With:
        </p>
        <div className="contact-checkbox-list" style={{ maxHeight: '160px', overflowY: 'auto' }}>
          {contacts.length === 0 ? (
            <p className="empty-hint" style={{ fontSize: '12px', color: 'var(--text-dim, #64748b)' }}>
              No emergency contacts added yet. You can still start your tracked journey.
            </p>
          ) : (
            contacts.map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <div
                  key={c.id}
                  className={`contact-check-item ${checked ? 'selected' : ''}`}
                  onClick={() => toggleContact(c.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', marginBottom: '6px', background: checked ? 'var(--bg-card, #f8fafc)' : 'transparent', border: checked ? '1px solid #c4b5fd' : '1px solid var(--border-subtle, #e2e8f0)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                      {c.initials || c.name[0]}
                    </div>
                    <div>
                      <b style={{ fontSize: '12px', display: 'block' }}>{c.name}</b>
                      <small style={{ fontSize: '10px', color: 'var(--text-dim, #64748b)' }}>{c.relation || 'Contact'}</small>
                    </div>
                  </div>
                  <div
                    className={`checkbox-circle ${checked ? 'checked' : ''}`}
                    style={{ width: '18px', height: '18px', borderRadius: '50%', border: checked ? 'none' : '1.5px solid #cbd5e1', background: checked ? '#6366f1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                  >
                    {checked && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Submit Action ── */}
        <div className="sheet-actions" style={{ marginTop: '16px' }}>
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Navigation size={17} /> Start Safe Journey
          </button>
        </div>
      </form>
    </div>
  );
};
