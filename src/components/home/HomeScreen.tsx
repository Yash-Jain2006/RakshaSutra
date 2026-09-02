import React from 'react';
import {
  AlertTriangle,
  Bell,
  CircleHelp,
  Coffee,
  Fuel,
  HeartHandshake,
  Hospital,
  Map as MapIcon,
  MapPin,
  Navigation,
  Phone,
  Settings,
  Shield,
  Zap,
} from 'lucide-react';
import type { EmergencyContact } from '../../types/models';
import { SectionTitle } from '../common/SectionTitle';
import { JourneyBanner } from '../journey/JourneyBanner';

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
  locationState: string;
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
  locationState,
  nav,
  notify,
  onStartFakeCall,
}) => {
  return (
    <section className="screen home-screen">
      <header className="home-header">
        <div>
          <p>
            Good evening <span>👋</span>
          </p>
          <h1>{displayName}</h1>
          <span className="location">
            <MapPin size={12} /> Bengaluru, KA
          </span>
        </div>
        <div className="header-actions">
          <button onClick={() => notify('No new alerts')} aria-label="Notifications">
            <Bell size={20} />
            <i />
          </button>
          <button onClick={() => nav('settings')} aria-label="Settings">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Ad Banner Card */}
      <div className="ad-card">
        <div className="ad-icon">🛒</div>
        <div>
          <span>SPONSORED</span>
          <b>SafeStep Shoes</b>
          <p>Grip-tech footwear for city commutes</p>
        </div>
        <button onClick={() => notify('Opening sponsored offer...')}>View</button>
      </div>
      <div className="ad-dots" aria-hidden="true">
        <b />
        <i />
        <i />
      </div>

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
            <span>{sosPressing ? 'KEEP HOLDING…' : 'HOLD FOR HELP'}</span>
          </button>
        </div>
        <p>
          {sosPressing
            ? 'Keep holding — SOS will send in 3 seconds'
            : 'Press and hold 3 seconds to alert your Rakshak network'}
        </p>
      </div>

      {/* Send My Location Button */}
      <button className="location-button" onClick={requestLocation}>
        <Navigation size={18} />
        {locationState === 'locating'
          ? 'Locating you…'
          : locationState === 'shared'
            ? 'Location Shared'
            : 'Send My Location'}
      </button>

      {/* Safety Action Tiles */}
      <div className="safety-actions">
        <button className="unsafe" onClick={() => nav('community')}>
          <AlertTriangle size={19} />
          <span>Feeling Unsafe</span>
        </button>
        <button className="assist" onClick={() => nav('support')}>
          <CircleHelp size={19} />
          <span>
            Need
            <br />
            Assistance
          </span>
        </button>
        <button className="danger" onClick={sendSOS}>
          <Zap size={19} />
          <span>
            Immediate
            <br />
            Danger
          </span>
        </button>
      </div>

      {/* Safety Toolkit Shortcuts */}
      <SectionTitle title="Safety toolkit" action="See all" onClick={() => nav('map')} />
      <div className="toolkit">
        <button onClick={() => nav('map')}>
          <MapIcon />
          <span>Safe routes</span>
        </button>
        <button onClick={() => nav('community')}>
          <HeartHandshake />
          <span>Community</span>
        </button>
        <button onClick={onStartFakeCall}>
          <Phone />
          <span>Fake call</span>
        </button>
      </div>

      {/* Emergency Contacts Preview */}
      <SectionTitle title="Emergency contacts" action="Manage" onClick={() => nav('contacts')} />
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
