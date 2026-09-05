import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  onBack: () => void;
}

export function TermsPage({ onBack }: Props) {
  const { t } = useTranslation();

  return (
    <div className="screen" style={{ background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      <header className="sub-header">
        <button onClick={onBack} aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
        <h1>{t('auth.terms', 'Terms of Service')}</h1>
        <span />
      </header>

      <div className="scrollable" style={{ padding: '24px', flex: 1, paddingBottom: '48px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>1. Acceptance of Terms</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          By accessing and using Rakshasutra, you accept and agree to be bound by the terms and provision of this agreement.
        </p>
        
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>2. User Responsibilities</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          You agree to use this application for legitimate safety and emergency purposes only. Misuse of the SOS and live tracking features is strictly prohibited.
        </p>
        
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>3. Privacy and Data</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          Your location data and personal information are processed in accordance with our Privacy Policy. We prioritize your privacy and data security.
        </p>
        
        <h2 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-main)' }}>4. Limitations of Liability</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          Rakshasutra is designed as an assistive safety tool. It does not guarantee immediate rescue or replace emergency services provided by law enforcement.
        </p>
      </div>
    </div>
  );
}
