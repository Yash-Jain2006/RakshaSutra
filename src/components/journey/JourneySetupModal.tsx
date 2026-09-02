import React, { useState } from 'react';
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
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>(
    contacts.map((c) => c.id)
  );

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
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Home, Indiranagar Office, Koramangala 5th Block"
              required
            />
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
