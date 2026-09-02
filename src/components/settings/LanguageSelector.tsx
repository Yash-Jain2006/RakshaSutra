import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const languages = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी — Hindi' },
  { code: 'bn', label: 'বাংলা — Bengali' },
  { code: 'ta', label: 'தமிழ் — Tamil' },
  { code: 'te', label: 'తెలుగు — Telugu' },
  { code: 'mr', label: 'मराठी — Marathi' },
  { code: 'gu', label: 'ગુજરાતી — Gujarati' },
  { code: 'kn', label: 'ಕನ್ನಡ — Kannada' },
  { code: 'ml', label: 'മലയാളം — Malayalam' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ — Punjabi' },
  { code: 'or', label: 'ଓଡ଼ିଆ — Odia' },
  { code: 'ur', label: 'اردو — Urdu' },
  { code: 'ne', label: 'नेपाली — Nepali' },
  { code: 'sa', label: 'संस्कृतम् — Sanskrit' },
];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ isOpen, onClose }) => {
  const { i18n } = useTranslation();

  if (!isOpen) return null;

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-app)',
          borderRadius: '16px',
          padding: '20px',
          width: '90%',
          maxWidth: '340px',
          maxHeight: '70vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
          Select Language
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: i18n.language === lang.code ? 'var(--bg-elevated)' : 'transparent',
                border: '1px solid',
                borderColor: i18n.language === lang.code ? 'var(--border-strong)' : 'transparent',
                borderRadius: '10px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: i18n.language === lang.code ? 600 : 400,
              }}
            >
              {lang.label}
              {i18n.language === lang.code && <span>✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
