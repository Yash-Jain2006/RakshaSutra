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
}

export const JourneyBanner: React.FC<JourneyBannerProps> = ({
  active,
  destination,
  viewers = [],
  onOpenSetup,
  onPauseJourney,
  onResumeJourney,
  onEndJourney,
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
    <div className={`journey-banner active ${isPaused ? 'paused' : ''}`}>
      <span className="live-dot" style={{ background: isPaused ? '#f59e0b' : '#22c55e' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{isPaused ? 'Journey Paused' : 'Live Journey Active'}</b>
        <small style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {destination ? `To: ${destination.split(',')[0].trim()}` : 'Tracking active'} · {viewers.length} contacts watching
        </small>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          onClick={handleTogglePause}
          title={isPaused ? 'Resume Journey' : 'Pause Journey (Notifies contacts)'}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            background: isPaused ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
            color: isPaused ? '#fff' : '#0f172a',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          type="button"
          onClick={handleSafeArrival}
          title="I've Arrived Safely"
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            background: '#22c55e',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <CheckCircle2 size={14} />
          Arrived
        </button>
      </div>
    </div>
  );
};
