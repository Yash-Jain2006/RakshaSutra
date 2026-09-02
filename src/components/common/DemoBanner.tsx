import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

interface DemoBannerProps {
  type?: 'demo' | 'pilot' | 'offline';
  message?: string;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ type = 'pilot', message }) => {
  const defaultText =
    type === 'offline'
      ? '⚠️ Offline Mode — SOS saved locally. Call 112 directly in an emergency.'
      : type === 'demo'
        ? 'ℹ️ Prototype Mode — Running on local mock state.'
        : '⚠️ Pilot Mode — Emergency notifications are queued; external delivery is not connected.';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`demo-banner ${type}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        fontSize: '11px',
        fontWeight: 600,
        background: type === 'offline' ? '#fef2f2' : type === 'demo' ? '#f5f3ff' : '#fffbe6',
        color: type === 'offline' ? '#b91c1c' : type === 'demo' ? '#4338ca' : '#b45309',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {type === 'offline' || type === 'pilot' ? <AlertTriangle size={14} /> : <Info size={14} />}
      <span>{message || defaultText}</span>
    </div>
  );
};
