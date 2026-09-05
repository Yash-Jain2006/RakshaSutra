import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  onBack: () => void;
}

export function PrivacyPage({ onBack }: Props) {
  const { t } = useTranslation();

  return (
    <div className="screen" style={{ background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      <header className="sub-header">
        <button onClick={onBack} aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
        <h1>{t('auth.privacy', 'Privacy Policy')}</h1>
        <span />
      </header>

      <div className="scrollable" style={{ padding: '24px', flex: 1, paddingBottom: '48px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>1. Data Collection</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          We collect information to provide better services to our users, specifically location data during SOS events or Live Journeys, and audio recordings when explicitly triggered.
        </p>
        
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>2. Location Tracking</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          Your precise location is only shared when you actively initiate an SOS or Live Tracking session. Location data is heavily encrypted (AES-256) and strictly shared only with your emergency contacts and verified Rakshaks.
        </p>
        
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>3. Data Security</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          We deploy advanced security measures to protect against unauthorized access, alteration, disclosure, or destruction of your personal information and data.
        </p>
        
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>4. Third-Party Sharing</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          We do not sell your personal information. Data is only shared with trusted third-party services necessary for the app to function (e.g. Supabase for real-time syncing).
        </p>
      </div>
    </div>
  );
}
