import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ShieldCheck } from 'lucide-react';

const LANGUAGES = [
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
  { code: 'zh', label: '中文 — Chinese' },
  { code: 'fr', label: 'Français — French' },
  { code: 'de', label: 'Deutsch — German' },
  { code: 'ja', label: '日本語 — Japanese' },
];

interface WelcomeScreenProps {
  onStart: () => void;
  onRakshak: () => void;
  onTerms: () => void;
  onPrivacy: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onRakshak, onTerms, onPrivacy }) => {
  const { t, i18n } = useTranslation();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [tempLang, setTempLang] = useState<string | null>(null);

  const currentLang = tempLang || i18n.language || 'en';

  const handleToggleMenu = () => {
    setLanguageOpen((open) => {
      if (!open) {
        setTempLang(null); // Reset when opening
      }
      return !open;
    });
  };

  const handleSelectLang = (code: string) => {
    setTempLang(code);
  };

  const handleConfirmLang = () => {
    if (tempLang) {
      i18n.changeLanguage(tempLang);
      localStorage.setItem('language', tempLang);
    }
    setLanguageOpen(false);
  };

  return (
    <div className="welcome-artwork-root">
      <main className="welcome-artwork-frame" aria-label="Raksha Sutra welcome screen">
        <img
          className="welcome-artwork-image"
          src="/welcome-artwork.png"
          alt="Raksha Sutra safety network illustration"
        />

        <div className="welcome-language-control">
          <button
            className="welcome-lang-btn"
            type="button"
            onClick={handleToggleMenu}
            aria-expanded={languageOpen}
            aria-label="Choose language"
          >
            <img src="/language-icon.png" alt="" />
          </button>
          {languageOpen && (
            <div className="welcome-language-menu" role="menu" aria-label="Choose language" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="welcome-language-menu-header">{t('language.select', 'Select Language')}</div>
              <div style={{ overflowY: 'auto', maxHeight: '400px', paddingBottom: '8px' }}>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    role="menuitem"
                    className={currentLang === lang.code ? 'active' : ''}
                    onClick={() => handleSelectLang(lang.code)}
                  >
                    {lang.label}
                    {currentLang === lang.code && <span className="lang-check">✓</span>}
                  </button>
                ))}
              </div>
              <div style={{ padding: '8px', borderTop: '1px solid #e2e8f0', background: '#fff', borderRadius: '0 0 16px 16px' }}>
                <button
                  type="button"
                  onClick={handleConfirmLang}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    background: '#8b5cf6',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  {t('language.confirm', 'Confirm')}
                </button>
              </div>
            </div>
          )}
        </div>

        <button className="welcome-artwork-cta welcome-artwork-start" type="button" onClick={onStart} aria-label={t('welcome.get_started', 'Get Started')}>
          <span className="welcome-artwork-cta-text">{t('welcome.get_started', 'Get Started')}</span>
        </button>
        <button className="welcome-artwork-cta welcome-artwork-rakshak" type="button" onClick={onRakshak} aria-label={t('welcome.become_rakshak', 'Become a Rakshak')}>
          <span className="welcome-artwork-cta-text">{t('welcome.become_rakshak', 'Become a Rakshak')}</span>
        </button>
        <div className="welcome-footer-links" aria-label="Legal links">
          <button type="button" onClick={onTerms}>{t('auth.terms', 'Terms')}</button>
          <span>•</span>
          <button type="button" onClick={onPrivacy}>{t('auth.privacy', 'Privacy Policy')}</button>
        </div>
        <div className="welcome-artwork-hide-bar" aria-hidden="true" />
      </main>
    </div>
  );
};
