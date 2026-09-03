import React, { useState, useEffect, useRef } from 'react';
import { Check, MapPin, Navigation, X } from 'lucide-react';
import type { EmergencyContact } from '../../types/models';

interface JourneySetupModalProps {
  contacts: EmergencyContact[];
  close: () => void;
  startJourney: (destination: string, selectedContactIds: (string | number)[]) => void;
}

export const JourneySetupModal: React.FC<JourneySetupModalProps> = ({
  contacts,
  close,
  startJourney,
}) => {
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentLoc, setCurrentLoc] = useState<{lat: number, lon: number} | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      }, () => {
        // ignore
      }, { timeout: 5000, maximumAge: 60000 });
    }
  }, []);

  const [selectedIds, setSelectedIds] = useState<(string | number)[]>(
    contacts.map((c) => c.id)
  );

  useEffect(() => {
    if (!destination.trim() || !showDropdown) {
      setSuggestions([]);
      return;
    }

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&addressdetails=1&limit=5`;
        if (currentLoc) {
          // Create a ~50km viewbox around the user's location (0.5 degrees)
          // viewbox format: <left>,<top>,<right>,<bottom> -> min_lon, max_lat, max_lon, min_lat
          const minLon = currentLoc.lon - 0.5;
          const maxLon = currentLoc.lon + 0.5;
          const minLat = currentLoc.lat - 0.5;
          const maxLat = currentLoc.lat + 0.5;
          url += `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=1`;
        }
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data);
      } catch (err) {
        console.error('Failed to fetch locations', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [destination, showDropdown]);

  const handleSelectSuggestion = (placeName: string) => {
    setDestination(placeName);
    setShowDropdown(false);
  };

  const toggleContact = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;
    startJourney(destination.trim(), selectedIds);
  };

  return (
    <div className="modal-backdrop">
      <form className="sheet journey-sheet" onSubmit={handleSubmit}>
        <div className="sheet-handle" />
        <div className="sheet-title">
          <div>
            <p>Journey Tracking</p>
            <h2>Start a Journey</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close">
            <X />
          </button>
        </div>

        <label>
          Destination Name
          <div className="input-with-icon" style={{ position: 'relative' }}>
            <input
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                if (destination.trim()) setShowDropdown(true);
              }}
              placeholder="e.g. Home, Indiranagar Office, Koramangala 5th Block"
              required
            />
            {isSearching && (
              <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#64748b' }}>
                Searching...
              </div>
            )}
            
            {showDropdown && suggestions.length > 0 && (
              <ul style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                listStyle: 'none',
                padding: '4px 0',
                margin: 0,
                zIndex: 10,
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {suggestions.map((s, idx) => (
                  <li 
                    key={idx}
                    onClick={() => handleSelectSuggestion(s.display_name)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                      fontSize: '13px',
                      lineHeight: '1.4',
                      color: '#334155'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                  >
                    <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '2px' }}>
                      {s.name || s.display_name.split(',')[0]}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.display_name}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>

        <div className="viewers-selection">
          <p className="field-label" style={{ fontSize: '12px', fontWeight: 700, margin: '12px 0 6px' }}>
            Who can watch this journey?
          </p>
          <div className="contact-picker-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {contacts.map((contact) => {
              const isSelected = selectedIds.includes(contact.id);
              return (
                <button
                  type="button"
                  key={contact.id}
                  className={`contact-pick-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleContact(contact.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid #6c63f2' : '1px solid #e2e8f0',
                    background: isSelected ? '#f0eeff' : '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: contact.color,
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {contact.initials}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{contact.name}</span>
                  </div>
                  {isSelected && <Check size={16} color="#6c63f2" />}
                </button>
              );
            })}
          </div>
        </div>

        <p className="form-foot" style={{ margin: '14px 0', fontSize: '11px', color: '#64748b' }}>
          🔒 Selected contacts receive a secure live tracking link. Pause or end your journey anytime.
        </p>

        <button className="primary" type="submit" disabled={!destination.trim()}>
          <Navigation size={16} /> Start Sharing Journey
        </button>
      </form>
    </div>
  );
};
