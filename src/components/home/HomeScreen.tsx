import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertTriangle,
  Bell,
  CircleHelp,
  HeartHandshake,
  Map as MapIcon,
  MapPin,
  Navigation,
  Phone,
  Zap,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { EmergencyContact } from '../../types/models';
import { SectionTitle } from '../common/SectionTitle';
import { JourneyBanner } from '../journey/JourneyBanner';
import { AdCarousel } from './AdCarousel';

interface HomeScreenProps {
  displayName: string;
  contacts: EmergencyContact[];
  journey: boolean;
  journeyDestination?: string;
  onOpenJourneySetup: () => void;
  onPauseJourney: () => void;
  onResumeJourney: () => void;
  onEndJourney: () => void;
  sendSOS: () => void;
  startSOSHold: () => void;
  cancelSOSHold: () => void;
  sosPressing: boolean;
  requestLocation: () => void;
  shareLocation: () => void;
  locationState: string;
  cityLabel: string;
  isRakshak: boolean;
  nav: (page: string) => void;
  notify: (msg: string) => void;
  onStartFakeCall: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  displayName,
  contacts,
  journey,
  journeyDestination,
  onOpenJourneySetup,
  onPauseJourney,
  onResumeJourney,
  onEndJourney,
  sendSOS,
  startSOSHold,
  cancelSOSHold,
  sosPressing,
  requestLocation,
  shareLocation,
  locationState,
  cityLabel,
  isRakshak,
  nav,
  notify,
  onStartFakeCall,
}) => {
  const { t } = useTranslation();
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showNotif) return;
    const handleClick = (e: MouseEvent) => {
      if (
        notifRef.current && !notifRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotif]);

  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Welcome to Raksha Sutra!', time: 'Just now', unread: true },
    { id: 2, title: 'Your profile is incomplete. Please add emergency contacts.', time: '2 hours ago', unread: true }
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };

  const deleteNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 12) return { text: t('home.good_morning', 'Good morning'), emoji: '🌅' };
    if (hour >= 12 && hour < 18) return { text: t('home.good_afternoon', 'Good afternoon'), emoji: '☀️' };
    return { text: t('home.good_evening', 'Good evening'), emoji: '🌆' };
  }, [t]);

  return (
    <section className="screen home-screen">
      <header className="home-header">
        <div>
          <p>
            {greeting.text} <span>{greeting.emoji}</span>
          </p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {displayName}
            {isRakshak && (
              <span 
                title="Verified Rakshak" 
                style={{ 
                  color: '#16a34a', 
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#dcfce7',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600
                }}
              >
                <ShieldCheck size={14} /> {t('rakshak.verified', 'Verified')}
              </span>
            )}
          </h1>
          <span className="location">
            <MapPin size={12} />
            {cityLabel || t('home.locating', 'Locating…')}
          </span>
        </div>
        <div className="header-actions">
          <button ref={bellRef} onClick={() => setShowNotif(!showNotif)} aria-label="Notifications">
            <Bell size={20} />
            {unreadCount > 0 && <i />}
          </button>
        </div>
      </header>

      {/* Notification Panel */}
      {showNotif && (
        <div className="notification-panel" ref={notifRef}>
          <div className="notif-header">
            <b>Notifications ({unreadCount})</b>
            {unreadCount > 0 && (
              <button onClick={markAllRead}>Mark all as read</button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">{t('home.no_alerts', 'No new alerts')}</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                  <div className="notif-icon">
                    <Info size={16} />
                  </div>
                  <div className="notif-content">
                    <p>{n.title}</p>
                    <span>{n.time}</span>
                  </div>
                  <button className="notif-delete" onClick={() => deleteNotification(n.id)} aria-label="Delete notification">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Ad Carousel */}
      <AdCarousel notify={notify} />

      {/* Journey Banner with Pause/Arrived controls */}
      <JourneyBanner
        active={journey}
        destination={journeyDestination}
        viewers={contacts}
        onOpenSetup={onOpenJourneySetup}
        onPauseJourney={onPauseJourney}
        onResumeJourney={onResumeJourney}
        onEndJourney={onEndJourney}
      />

      {/* Protected SOS Hold Control */}
      <div className="sos-wrap">
        <div className="sos-rings">
          <button
            className={`sos-button ${sosPressing ? 'pressing' : ''}`}
            onPointerDown={startSOSHold}
            onPointerUp={cancelSOSHold}
            onPointerLeave={cancelSOSHold}
            onPointerCancel={cancelSOSHold}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
                startSOSHold();
              }
            }}
            onKeyUp={(event) => {
              if (event.key === 'Enter' || event.key === ' ') cancelSOSHold();
            }}
            aria-label="Press and hold 3 seconds to trigger Emergency SOS"
          >
            <AlertTriangle size={36} />
            <b>SOS</b>
            <span>{sosPressing ? t('home.sos_keep_holding', 'KEEP HOLDING…') : t('home.sos_hold_help', 'HOLD FOR HELP')}</span>
          </button>
        </div>
        <p>
          {sosPressing
            ? t('home.sos_desc_holding', 'Keep holding — SOS will send in 3 seconds')
            : t('home.sos_desc', 'Press and hold 3 seconds to alert your Rakshak network')}
        </p>
      </div>

      {/* Send My Location Button */}
      <button className="location-button" onClick={shareLocation}>
        <Navigation size={18} />
        {locationState === 'locating'
          ? t('home.locating', 'Locating you…')
          : locationState === 'shared'
            ? t('home.location_shared', 'Location Broadcasted')
            : t('home.send_location', 'Send My Location')}
      </button>

      {/* Safety Action Tiles */}
      <div className="safety-actions">
        <button className="unsafe" onClick={() => nav('rakshak')}>
          <AlertTriangle size={19} />
          <span>{t('home.feeling_unsafe', 'Feeling Unsafe')}</span>
        </button>
        <button className="assist" onClick={() => nav('support')}>
          <CircleHelp size={19} />
          <span>{t('home.need_assistance', 'Need Assistance')}</span>
        </button>
        <button className="danger" onClick={sendSOS}>
          <Zap size={19} />
          <span>{t('home.immediate_danger', 'Immediate Danger')}</span>
        </button>
      </div>

      {/* Safety Toolkit Shortcuts */}
      <SectionTitle title={t('home.safety_toolkit', 'Safety toolkit')} action={t('home.see_all', 'See all')} onClick={() => nav('helplines')} />
      <div className="toolkit">
        <button onClick={() => nav('map')}>
          <MapIcon />
          <span>{t('home.safe_routes', 'Safe routes')}</span>
        </button>
        <button onClick={() => nav('community')}>
          <HeartHandshake />
          <span>{t('home.community', 'Community')}</span>
        </button>
        <button onClick={onStartFakeCall}>
          <Phone />
          <span>{t('home.fake_call', 'Fake call')}</span>
        </button>
      </div>

      {/* Emergency Contacts Preview */}
      <SectionTitle title={t('home.emergency_contacts', 'Emergency contacts')} action={t('home.manage', 'Manage')} onClick={() => nav('contacts')} />
      <div className="contact-preview">
        {contacts.slice(0, 2).map((contact) => (
          <div className="contact-row" key={contact.id}>
            <span style={{ background: contact.color }}>{contact.initials}</span>
            <div>
              <b>{contact.name}</b>
              <small>{contact.relation}</small>
            </div>
            <a href={contact.phone ? `tel:${contact.phone}` : '#'} aria-label={`Call ${contact.name}`}>
              <Phone size={16} />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
};
