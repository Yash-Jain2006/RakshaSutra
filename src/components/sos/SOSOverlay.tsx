import React, { useState } from 'react';
import { Camera, Check, Phone, ShieldCheck, Users, Volume2, X } from 'lucide-react';
import type { EmergencyContact, SosDelivery } from '../../types/models';
import { DemoBanner } from '../common/DemoBanner';

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
    cancel();
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

      <DemoBanner type={isOffline ? 'offline' : 'pilot'} />

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
          <button aria-label="Toggle Audio capture mock">
            <Volume2 size={15} /> Audio Mock
          </button>
          <button aria-label="Toggle Video capture mock">
            <Camera size={15} /> Video Mock
          </button>
          <button aria-label="GPS Status" disabled>
            GPS Live
          </button>
        </div>
      </div>

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
          <span className="status-tag queued">
            {isOffline ? 'Pending (Offline)' : 'Queued'}
          </span>
        </div>

        {/* Rakshak Matching Status */}
        {rakshakDeliveries.length > 0 ? (
          rakshakDeliveries.map((delivery) => (
            <div className="sos-item" key={delivery.id}>
              <span>
                <ShieldCheck size={18} />
              </span>
              <div>
                <b>{delivery.recipient_name || 'Nearby Rakshak'}</b>
                <small>{delivery.recipient_sub || 'Verified Volunteer'}</small>
              </div>
              <span className={`status-tag ${delivery.status}`}>
                {delivery.status === 'acknowledged'
                  ? 'Accepted'
                  : delivery.status === 'sent'
                    ? 'Alert Sent'
                    : 'Queued'}
              </span>
            </div>
          ))
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
            <span className="status-tag queued">Searching</span>
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
