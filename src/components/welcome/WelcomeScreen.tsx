import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en',  label: 'English' },
  { code: 'hi',  label: 'हिन्दी — Hindi' },
  { code: 'bn',  label: 'বাংলা — Bengali' },
  { code: 'ta',  label: 'தமிழ் — Tamil' },
  { code: 'te',  label: 'తెలుగు — Telugu' },
  { code: 'mr',  label: 'मराठी — Marathi' },
  { code: 'gu',  label: 'ગુજરાતી — Gujarati' },
  { code: 'kn',  label: 'ಕನ್ನಡ — Kannada' },
  { code: 'ml',  label: 'മലയാളം — Malayalam' },
  { code: 'pa',  label: 'ਪੰਜਾਬੀ — Punjabi' },
  { code: 'or',  label: 'ଓଡ଼ିଆ — Odia' },
  { code: 'ur',  label: 'اردو — Urdu' },
  { code: 'ne',  label: 'नेपाली — Nepali' },
  { code: 'sa',  label: 'संस्कृतम् — Sanskrit' },
  { code: 'zh',  label: '中文 — Chinese' },
  { code: 'fr',  label: 'Français — French' },
  { code: 'de',  label: 'Deutsch — German' },
  { code: 'ja',  label: '日本語 — Japanese' },
];

interface WelcomeScreenProps {
  onStart: () => void;
  onRakshak: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onRakshak }) => {
  const { i18n } = useTranslation();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState(i18n.language || 'en');

  const handleSelectLang = (code: string) => {
    setSelectedLang(code);
    i18n.changeLanguage(code);
    setLanguageOpen(false);
  };

  return (
    <div className="welcome-artwork-root">
      <main className="welcome-artwork-frame" aria-label="Raksha Sutra welcome screen">
        <img
          className="welcome-artwork-image"
          src="/welcome-reference.jpeg"
          alt="Raksha Sutra safety network illustration"
        />

        <div className="welcome-language-control">
          <button
            className="welcome-lang-btn"
            type="button"
            onClick={() => setLanguageOpen((open) => !open)}
            aria-expanded={languageOpen}
            aria-label="Choose language"
          >
            <img src="/language-icon.png" alt="" />
          </button>
          {languageOpen && (
            <div className="welcome-language-menu" role="menu" aria-label="Choose language">
              <div className="welcome-language-menu-header">Select Language</div>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  role="menuitem"
                  className={selectedLang === lang.code ? 'active' : ''}
                  onClick={() => handleSelectLang(lang.code)}
                >
                  {lang.label}
                  {selectedLang === lang.code && <span className="lang-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="welcome-artwork-cta welcome-artwork-start" type="button" onClick={onStart}>
          <span className="welcome-artwork-cta-text">Get Started</span>
        </button>
        <button className="welcome-artwork-cta welcome-artwork-rakshak" type="button" onClick={onRakshak}>
          <span className="welcome-artwork-cta-text">Become a Rakshak</span>
        </button>
        <div className="welcome-footer-links" aria-label="Legal links">
          <button type="button">Terms</button>
          <span>•</span>
          <button type="button">Privacy Policy</button>
        </div>
        <div className="welcome-artwork-hide-bar" aria-hidden="true" />
      </main>
    </div>
  );
};
