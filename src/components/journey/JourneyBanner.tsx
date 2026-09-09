import React, { useState } from 'react';
import { CheckCircle2, Pause, Play, Navigation } from 'lucide-react';
import type { EmergencyContact } from '../../types/models';
import { useTranslation } from 'react-i18next';

interface JourneyBannerProps {
  active: boolean;
  destination?: string;
  viewers?: EmergencyContact[];
  onOpenSetup: () => void;
  onPauseJourney: () => void;
  onResumeJourney: () => void;
  onEndJourney: () => void;
  onOpenActiveScreen?: () => void;
}

export const JourneyBanner: React.FC<JourneyBannerProps> = ({
  active,
  destination,
  viewers = [],
  onOpenSetup,
  onPauseJourney,
  onResumeJourney,
  onEndJourney,
  onOpenActiveScreen,
}) => {
  const { t } = useTranslation();
  const [isPaused, setIsPaused] = useState(false);

  const handleTogglePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPaused) {
      setIsPaused(false);
      onResumeJourney();
    } else {
      setIsPaused(true);
      onPauseJourney();
    }
  };

  const handleSafeArrival = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPaused(false);
    onEndJourney();
  };

  if (!active) {
    return (
      <button className="journey-banner" onClick={onOpenSetup} aria-label="Start Journey Mode">
        <span className="live-dot" style={{ background: '#94a3b8' }} />
        <span>
          <b>{t('home.journey_off', 'Journey Mode off')}</b>
          <small> — {t('home.journey_desc', 'Tap to set destination & share live tracking')}</small>
        </span>
        <span className="toggle">
          <i />
        </span>
      </button>
    );
  }

  return (
    <div
      className={`journey-banner active ${isPaused ? 'paused' : ''}`}
      onClick={onOpenActiveScreen}
      style={{ cursor: onOpenActiveScreen ? 'pointer' : 'default' }}
      title="Tap to view live Journey Mode screen"
    >
      <span className="live-dot" style={{ background: isPaused ? '#f59e0b' : '#22c55e' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{isPaused ? 'Journey Paused' : 'Live Journey Active'}</b>
        <small style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {destination ? `To: ${destination.split(',')[0].trim()}` : 'Tracking active'} · {viewers.length} contacts watching
        </small>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Pause / Resume toggle — clearly visible in both states */}
        <button
          type="button"
          onClick={handleTogglePause}
          title={isPaused ? 'Resume Journey' : 'Pause Journey (Notifies contacts)'}
          style={{
            padding: '6px 12px',
            borderRadius: '20px',
            border: 'none',
            background: isPaused
              ? 'linear-gradient(135deg, #f59e0b, #d97706)'  /* amber — easy to spot when paused */
              : 'rgba(0,0,0,0.10)',
            color: isPaused ? '#ffffff' : '#374151',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: isPaused ? '0 2px 8px rgba(245,158,11,0.45)' : 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isPaused ? <Play size={13} /> : <Pause size={13} />}
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          type="button"
          onClick={handleSafeArrival}
          title="I've Arrived Safely"
          style={{
            padding: '6px 12px',
            borderRadius: '20px',
            border: 'none',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 2px 8px rgba(34,197,94,0.40)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <CheckCircle2 size={13} />
          Arrived
        </button>
      </div>
    </div>
  );
};
