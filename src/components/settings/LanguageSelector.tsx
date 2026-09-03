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
  const { t, i18n } = useTranslation();
  const [tempLang, setTempLang] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) setTempLang(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentLang = tempLang || i18n.language || 'en';

  const handleSelect = (code: string) => {
    setTempLang(code);
  };

  const handleConfirm = () => {
    if (tempLang) {
      i18n.changeLanguage(tempLang);
      localStorage.setItem('language', tempLang);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-app)',
          borderRadius: '16px',
          padding: '20px 20px 24px',
          width: '90%',
          maxWidth: '340px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
          {t('language.select', 'Select Language')}
        </h3>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px',
          overflowY: 'auto',
          paddingRight: '4px',
          flex: 1,
          minHeight: 0
        }}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: currentLang === lang.code ? 'var(--bg-elevated)' : 'transparent',
                border: '1px solid',
                borderColor: currentLang === lang.code ? 'var(--border-strong)' : 'var(--border)',
                borderRadius: '12px',
                fontSize: '15px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: currentLang === lang.code ? 600 : 400,
                transition: 'all 0.2s ease',
              }}
            >
              {lang.label}
              {currentLang === lang.code && <span style={{ color: '#6255ec' }}>✓</span>}
            </button>
          ))}
        </div>

        <div style={{ marginTop: '20px', display: 'flex', flexShrink: 0, minHeight: '48px' }}>
          <button 
            onClick={handleConfirm}
            style={{ 
              flex: 1, 
              padding: '12px', 
              borderRadius: '12px', 
              background: '#6255ec', 
              border: 'none', 
              color: '#fff',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(98, 85, 236, 0.3)'
            }}
          >
            {t('language.confirm', 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
