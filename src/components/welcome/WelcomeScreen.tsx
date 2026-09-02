import React, { useState } from 'react';
import { Bell, ChevronRight, Navigation, Shield, ShieldCheck, MapPin, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brand } from '../layout/Brand';

interface WelcomeScreenProps {
  onStart: () => void;
  onRakshak: () => void;
}

const slides = [
  {
    id: 0,
    title: {
      en: <><span style={{color: '#0f172a', fontWeight: 900}}>Your Safety.</span><br /><span style={{color: '#7c3aed', fontWeight: 900}}>Your Power.</span></>,
      hi: <><span style={{color: '#0f172a', fontWeight: 900}}>आपकी सुरक्षा।</span><br /><span style={{color: '#7c3aed', fontWeight: 900}}>आपकी शक्ति।</span></>
    },
    subtitle: {
      en: <span style={{color: '#7c3aed', fontStyle: 'italic', fontWeight: 600}}>। हमेशा आपके साथ, एक धागे की तरह ।।</span>,
      hi: <span style={{color: '#7c3aed', fontStyle: 'italic', fontWeight: 600}}>हमेशा आपके साथ, एक धागे की तरह।</span>
    },
    description: {
      en: <span style={{color: '#1e293b', fontWeight: 500}}>One tap can save a life. Instant SOS, live tracking, and a trusted community — always within reach.</span>,
      hi: <span style={{color: '#1e293b', fontWeight: 500}}>एक टैप से जान बच सकती है। तुरंत SOS, लाइव ट्रैकिंग और विश्वसनीय समुदाय — हमेशा पहुंच में।</span>
    },
    icon: <ShieldCheck size={77} color="#ffffff" />
  },
  {
    id: 1,
    title: {
      en: <><span style={{color: '#0f172a', fontWeight: 900}}>Live Location</span><br /><span style={{color: '#7c3aed', fontWeight: 900}}>Tracking.</span></>,
      hi: <><span style={{color: '#0f172a', fontWeight: 900}}>लाइव लोकेशन</span><br /><span style={{color: '#7c3aed', fontWeight: 900}}>ट्रैकिंग।</span></>
    },
    subtitle: {
      en: <span style={{color: '#7c3aed', fontStyle: 'italic', fontWeight: 600}}>Stay connected with your loved ones.</span>,
      hi: <span style={{color: '#7c3aed', fontStyle: 'italic', fontWeight: 600}}>अपनों से जुड़े रहें।</span>
    },
    description: {
      en: <span style={{color: '#1e293b', fontWeight: 500}}>Share your real-time location with trusted contacts seamlessly during your journey.</span>,
      hi: <span style={{color: '#1e293b', fontWeight: 500}}>यात्रा के दौरान अपने विश्वसनीय संपर्कों के साथ अपनी लाइव लोकेशन आसानी से साझा करें।</span>
    },
    icon: <MapPin size={77} color="#ffffff" />
  },
  {
    id: 2,
    title: {
      en: <><span style={{color: '#0f172a', fontWeight: 900}}>Community</span><br /><span style={{color: '#7c3aed', fontWeight: 900}}>Verified.</span></>,
      hi: <><span style={{color: '#0f172a', fontWeight: 900}}>समुदाय</span><br /><span style={{color: '#7c3aed', fontWeight: 900}}>सत्यापित।</span></>
    },
    subtitle: {
      en: <span style={{color: '#7c3aed', fontStyle: 'italic', fontWeight: 600}}>Join the Rakshak Network.</span>,
      hi: <span style={{color: '#7c3aed', fontStyle: 'italic', fontWeight: 600}}>रक्षक नेटवर्क से जुड़ें।</span>
    },
    description: {
      en: <span style={{color: '#1e293b', fontWeight: 500}}>A dedicated community of verified volunteers ready to respond and help nearby in emergencies.</span>,
      hi: <span style={{color: '#1e293b', fontWeight: 500}}>आपात स्थिति में आस-पास मदद और प्रतिक्रिया देने के लिए तैयार सत्यापित स्वयंसेवकों का एक समर्पित समुदाय।</span>
    },
    icon: <Users size={77} color="#ffffff" />
  }
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onRakshak }) => {
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [langOpen, setLangOpen] = useState(false);

  const languages = [
    { code: 'en' as const, label: 'English', native: 'English' },
    { code: 'hi' as const, label: 'Hindi', native: 'हिन्दी' },
  ];

  const currentSlide = slides[step];

  return (
    <div className="app welcome-page" style={{ background: '#000000' }}>
      <main className="welcome-phone" role="main" style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(175deg, #ffffff 0%, #f9f7ff 20%, #f0eeff 45%, #e8e0fe 70%, #ddd6fe 100%)' }}>
        <div className="statusbar" aria-hidden="true" style={{ position: 'relative', zIndex: 20, color: '#000' }}>
          <span>9:41</span>
          <span className="status-icons">▮▮▮ ◒</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 28px 0', position: 'relative', zIndex: 40 }}>
          <div><Brand /></div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setLangOpen(!langOpen)} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', outline: 'none', padding: 0 }}>
              <img src="/language-icon.png" alt="Language" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
            </button>
            {langOpen && (
              <>
                <div onClick={() => setLangOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 49 }} />
                <div style={{ position: 'absolute', top: '52px', right: 0, background: '#fff', borderRadius: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', overflow: 'hidden', zIndex: 50, minWidth: '160px' }}>
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => { setLang(l.code); setLangOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', border: 'none', background: lang === l.code ? '#f0eeff' : 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: lang === l.code ? 700 : 500, color: lang === l.code ? '#7c3aed' : '#334155', transition: 'background 0.2s' }}
                    >
                      <span>{l.native}</span>
                      {lang === l.code && <span style={{ color: '#7c3aed', fontSize: '16px' }}>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="hero-orbit" style={{ position: 'relative', zIndex: 10, marginTop: '20px' }}>
          <div className="orbit orbit-one" style={{ borderColor: 'rgba(124, 58, 237, 0.1)' }} />
          <div className="orbit orbit-two" style={{ borderColor: 'rgba(124, 58, 237, 0.1)' }} />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.4 }}
              className="hero-shield"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4c1d95)', boxShadow: '0 10px 30px rgba(124,58,237,0.4)', borderRadius: '50%', width: '120px', height: '120px', display: 'grid', placeItems: 'center', margin: '0 auto' }}
            >
              {currentSlide.icon}
            </motion.div>
          </AnimatePresence>

          {/* Orbiting Tags - Inner Ring (smaller radius to stay within frame) */}
          <div className="orbit-wrapper" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, animation: 'orbit-spin 20s linear infinite' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'rotate(330deg) translateX(90px) rotate(-330deg)' }}>
               <div style={{ animation: 'orbit-spin-reverse 20s linear infinite' }}>
                 <span className="hero-tag glass-tag" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', margin: '-16px 0 0 -45px', background: '#fff', color: '#334155', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', whiteSpace: 'nowrap' }}>
                   <Navigation size={12} color="#6366f1" /> GPS Locked
                 </span>
               </div>
            </div>
            
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'rotate(180deg) translateX(90px) rotate(-180deg)' }}>
               <div style={{ animation: 'orbit-spin-reverse 20s linear infinite' }}>
                 <span className="hero-tag glass-tag" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', margin: '-16px 0 0 -40px', background: '#fff', color: '#334155', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', whiteSpace: 'nowrap' }}>
                   <Bell size={12} color="#8b5cf6" /> Live Alert
                 </span>
               </div>
            </div>
          </div>

          {/* Orbiting Tags - Outer Ring */}
          <div className="orbit-wrapper" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, animation: 'orbit-spin 25s linear reverse infinite' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'rotate(90deg) translateX(110px) rotate(-90deg)' }}>
               <div style={{ animation: 'orbit-spin 25s linear infinite' }}>
                 <span className="hero-tag glass-tag" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', margin: '-16px 0 0 -40px', background: '#fff', color: '#334155', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', whiteSpace: 'nowrap' }}>
                   <Shield size={12} color="#10b981" /> Protected
                 </span>
               </div>
            </div>
          </div>
        </div>

        <div className="welcome-copy" style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 30px', marginTop: '30px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`copy-${currentSlide.id}-${lang}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <h1 style={{ fontSize: '32px', lineHeight: '1.2', marginBottom: '12px' }}>{currentSlide.title[lang]}</h1>
              <p className="hindi" style={lang === 'hi' ? { fontSize: '15px', marginBottom: '16px' } : { marginBottom: '16px' }}>{currentSlide.subtitle[lang]}</p>
              <p style={{ fontSize: '14px', lineHeight: '1.5' }}>{currentSlide.description[lang]}</p>
            </motion.div>
          </AnimatePresence>

          <div className="pager premium-pager" aria-hidden="true" style={{ marginTop: '20px' }}>
            {slides.map((s) => (
              <button
                key={s.id}
                className={step === s.id ? 'active' : ''}
                onClick={() => setStep(s.id)}
                aria-label={`Go to slide ${s.id + 1}`}
                style={{ width: step === s.id ? '20px' : '8px', height: '8px', borderRadius: '4px', background: step === s.id ? '#7c3aed' : '#cbd5e1', border: 'none', margin: '0 4px', transition: 'all 0.3s' }}
              />
            ))}
          </div>
        </div>

        {/* Bottom Art Layer (Waves & Skyline & Floating Icons) */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '250px', zIndex: 1, pointerEvents: 'none' }}>
          
          {/* Skyline Silhouette */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', bottom: '60px', width: '100%', height: '120px', fill: '#1e293b', opacity: 0.8 }}>
            <path d="M0,100 L0,60 L8,60 L8,40 L18,40 L18,70 L25,70 L25,30 L40,30 L40,65 L50,65 L50,20 L60,20 L60,50 L75,50 L75,10 L88,10 L88,60 L95,60 L95,45 L100,45 L100,100 Z" />
          </svg>

          {/* Dashed Route */}
          <svg viewBox="0 0 200 50" style={{ position: 'absolute', bottom: '110px', width: '100%', height: '50px', overflow: 'visible' }}>
             <path d="M40,25 Q100,65 170,20" fill="none" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="2" strokeDasharray="4 4" />
          </svg>

          {/* Waves */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, width: '100%', height: '140px', opacity: 0.9 }}>
            <path d="M0,40 Q25,10 50,40 T100,30 L100,100 L0,100 Z" fill="#8b5cf6" />
          </svg>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, width: '100%', height: '110px' }}>
            <path d="M0,60 Q40,40 70,70 T100,60 L100,100 L0,100 Z" fill="#4c1d95" />
          </svg>
        </div>

        {/* Floating Widgets Layer (above buttons) */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '250px', zIndex: 30, pointerEvents: 'none' }}>
          {/* Location Pin Widget */}
          <div style={{ position: 'absolute', bottom: '130px', left: '30px', width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.4)', display: 'grid', placeItems: 'center', pointerEvents: 'auto', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
             <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#7c3aed', display: 'grid', placeItems: 'center' }}>
                <MapPin size={14} color="white" />
             </div>
          </div>

          {/* Community Shield Widget */}
          <div style={{ position: 'absolute', bottom: '135px', right: '30px', width: '56px', height: '62px', display: 'grid', placeItems: 'center', pointerEvents: 'auto', filter: 'drop-shadow(0 8px 16px rgba(225, 29, 72, 0.4))' }}>
             <svg width="56" height="62" viewBox="0 0 56 62" fill="none" style={{ position: 'absolute', top: 0, left: 0 }}>
               <path d="M28 0L56 12.4V31C56 46.5 44 58.9 28 62C12 58.9 0 46.5 0 31V12.4L28 0Z" fill="url(#shield-grad)" />
               <defs>
                 <linearGradient id="shield-grad" x1="0" y1="0" x2="56" y2="62" gradientUnits="userSpaceOnUse">
                   <stop stopColor="#fb7185" />
                   <stop offset="1" stopColor="#e11d48" />
                 </linearGradient>
               </defs>
             </svg>
             <Users size={24} color="white" style={{ position: 'relative', zIndex: 2 }} />
          </div>
        </div>

        <div className="welcome-actions" style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 20, padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="primary" onClick={onStart} style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)', border: 'none', color: '#fff', height: '52px', borderRadius: '14px', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', cursor: 'pointer', boxShadow: '0 8px 20px rgba(124,58,237,0.3)' }}>
            Get Started <ChevronRight size={20} />
          </button>

          <button
            className="secondary"
            onClick={onRakshak}
            style={{ background: '#0f172a', border: 'none', color: '#fff', height: '52px', borderRadius: '14px', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', cursor: 'pointer', boxShadow: '0 8px 20px rgba(15,23,42,0.3)' }}
          >
            <ShieldCheck size={18} /> Become a Rakshak
          </button>

          <small style={{ color: 'rgba(255,255,255,0.6)', marginTop: '4px', textAlign: 'center', display: 'block', fontSize: '10px', letterSpacing: '0.3px' }}>
            256-bit Encrypted &nbsp; • &nbsp; 24/7 Response &nbsp; • &nbsp; Verified Network
          </small>

          {/* Home Indicator */}
          <div style={{ width: '134px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.3)', margin: '4px auto 0' }} />
        </div>
      </main>
    </div>
  );
};
