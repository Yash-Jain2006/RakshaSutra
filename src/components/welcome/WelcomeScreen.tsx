import React, { useState } from 'react';

interface WelcomeScreenProps {
  onStart: () => void;
  onRakshak: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onRakshak }) => {
  const [languageOpen, setLanguageOpen] = useState(false);

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
              <button type="button" role="menuitem" onClick={() => setLanguageOpen(false)}>English</button>
              <button type="button" role="menuitem" onClick={() => setLanguageOpen(false)}>हिन्दी</button>
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
