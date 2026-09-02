import React, { useState } from 'react';
import {
  Bell,
  Camera,
  ChevronRight,
  Clock3,
  HeartHandshake,
  LockKeyhole,
  MessageCircle,
  Moon,
  Settings,
  ShieldCheck,
  UsersRound,
  UserPen,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BackHeader } from '../layout/BackHeader.tsx';
import { LanguageSelector } from './LanguageSelector.tsx';

interface SettingsPageProps {
  nav: (page: string) => void;
  dark: boolean;
  setDark: (dark: boolean) => void;
  notifications: boolean;
  setNotifications: (v: boolean) => void;
  record: boolean;
  setRecord: (v: boolean) => void;
  displayName?: string;
  email?: string;
  onSignOut?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  nav,
  dark,
  setDark,
  notifications,
  setNotifications,
  record,
  setRecord,
  displayName = 'Ananya Sharma',
  email = 'ananya.s@email.com',
  onSignOut,
}) => {
  const { t, i18n } = useTranslation();
  const [langModalOpen, setLangModalOpen] = useState(false);

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const getLanguageLabel = (code: string) => {
    const map: Record<string, string> = {
      en: 'English',
      as: 'অসমীয়া — Assamese',
      bn: 'বাংলা — Bengali',
      brx: 'बड़ो — Bodo',
      doi: 'डोगरी — Dogri',
      gu: 'ગુજરાતી — Gujarati',
      hi: 'हिन्दी — Hindi',
      kn: 'ಕನ್ನಡ — Kannada',
      ks: 'کٲشُر — Kashmiri',
      kok: 'कोंकणी — Konkani',
      mai: 'मैथिली — Maithili',
      ml: 'മലയാളം — Malayalam',
      mni: 'মৈতৈলোন্ — Manipuri',
      mr: 'मराठी — Marathi',
      ne: 'नेपाली — Nepali',
      or: 'ଓଡ଼ିଆ — Odia',
      pa: 'ਪੰਜਾਬੀ — Punjabi',
      sa: 'संस्कृतम् — Sanskrit',
      sat: 'ᱥᱟᱱᱛᱟᱲᱤ — Santali',
      sd: 'सिन्धी — Sindhi',
      ta: 'தமிழ் — Tamil',
      te: 'తెలుగు — Telugu',
      ur: 'اردو — Urdu',
    };
    return map[code] || 'English';
  };

  return (
    <section className="screen settings-screen">
      <BackHeader title={t('settings.title', 'Settings')} nav={nav} />

      <div className="profile-card">
        <span style={{ flexShrink: 0 }}>{initials}</span>
        <div>
          <b>{displayName}</b>
          <small>{email}</small>
        </div>
        {onSignOut && (
          <button onClick={onSignOut} style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700, border: '1px solid #fee2e2', borderRadius: '6px', padding: '4px 8px', background: 'transparent' }}>
            {t('settings.sign_out', 'Sign Out')}
          </button>
        )}
      </div>

      <div className="settings-group" style={{ marginTop: '16px', marginBottom: '16px' }}>
        <button className="setting-row" onClick={() => nav('edit-profile')}>
          <span><UserPen size={18} /></span>
          <b>{t('settings.edit_profile', 'Edit Profile')}</b>
          <ChevronRight size={16} />
        </button>
      </div>

      <p className="settings-label">{t('settings.preferences', 'PREFERENCES')}</p>
      <div className="settings-group">
        <button className="setting-row" onClick={() => setDark(!dark)}>
          <span><Moon size={18} /></span>
          <b>{t('settings.dark_mode', 'Dark Mode')}</b>
          <i className={`switch ${dark ? 'on' : ''}`}><em /></i>
        </button>

        <button className="setting-row" onClick={() => setLangModalOpen(true)}>
          <span><MessageCircle size={18} /></span>
          <b>{t('settings.language', 'Language')}</b>
          <small>{getLanguageLabel(i18n.language)}</small>
          <ChevronRight size={16} />
        </button>

        <button className="setting-row" onClick={() => setNotifications(!notifications)}>
          <span><Bell size={18} /></span>
          <b>{t('settings.notifications', 'Notifications')}</b>
          <i className={`switch ${notifications ? 'on' : ''}`}><em /></i>
        </button>
      </div>

      <p className="settings-label">{t('settings.safety', 'SAFETY')}</p>
      <div className="settings-group">
        <button className="setting-row" onClick={() => nav('contacts')}>
          <span><UsersRound size={18} /></span>
          <b>{t('settings.emergency_contacts', 'Emergency Contacts')}</b>
          <ChevronRight size={16} />
        </button>

        <button className="setting-row" onClick={() => nav('activity-history')}>
          <span><Clock3 size={18} /></span>
          <b>{t('settings.activity_history', 'Activity History')}</b>
          <ChevronRight size={16} />
        </button>

        <button className="setting-row" onClick={() => nav('privacy-data')}>
          <span><LockKeyhole size={18} /></span>
          <b>{t('settings.privacy', 'Privacy & Data')}</b>
          <ChevronRight size={16} />
        </button>

        <button className="setting-row" onClick={() => setRecord(!record)}>
          <span><Camera size={18} /></span>
          <b>{t('settings.auto_audio_video', 'Auto audio/video on SOS')}</b>
          <i className={`switch ${record ? 'on' : ''}`}><em /></i>
        </button>
      </div>

      <p className="settings-label">{t('settings.community', 'COMMUNITY')}</p>
      <div className="settings-group">
        <button className="setting-row" onClick={() => nav('rakshak')}>
          <span><ShieldCheck size={18} /></span>
          <b>{t('settings.rakshak_network', 'Rakshak Network')}</b>
          <ChevronRight size={16} />
        </button>

        <button className="setting-row" onClick={() => nav('support')}>
          <span><HeartHandshake size={18} /></span>
          <b>{t('settings.supports_helplines', 'Our Supports & Helplines')}</b>
          <ChevronRight size={16} />
        </button>
      </div>

      <LanguageSelector isOpen={langModalOpen} onClose={() => setLangModalOpen(false)} />
    </section>
  );
};
