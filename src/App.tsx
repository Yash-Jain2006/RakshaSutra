import React, { useEffect, useRef, useState } from 'react';
import { Check, Phone, ShieldCheck, UsersRound } from 'lucide-react';
import { initialContacts } from './data.ts';

import { getCurrentSession, onAuthStateChange, signOut } from './services/authService.ts';
import {
  createEmergencyContact,
  createSosEvent,
  deleteEmergencyContact,
  dispatchSos,
  dispatchJourney,
  dispatchLocationShare,
  listActiveRakshaks,
  listEmergencyContacts,
  markSosSafe,
  submitRakshakComplaint,
  updateSosLocation,
} from './services/safetyService.ts';
import type { EmergencyContact, IncidentReport, LocationPayload, SosDelivery } from './types/models';

import { AdminPanel } from './components/admin/AdminPanel';
import { AuthScreen, LoadingScreen } from './components/auth/AuthScreen';
import { CommunityPage } from './components/community/CommunityPage';
import { ContactsScreen } from './components/contacts/ContactsScreen';
import { FakeCall } from './components/fake-call/FakeCall';
import { HomeScreen } from './components/home/HomeScreen';
import { JourneySetupModal } from './components/journey/JourneySetupModal';
import { BottomNav } from './components/layout/BottomNav';
import { Brand } from './components/layout/Brand';
import { MapPage } from './components/map/MapPage';
import { RakshakPage } from './components/rakshak/RakshakPage';
import { RakshakApplication } from './components/rakshak/RakshakApplication';
import { EditProfilePage } from './components/settings/EditProfilePage';
import { SettingsPage } from './components/settings/SettingsPage';
import { SOSOverlay } from './components/sos/SOSOverlay';
import { SupportPage } from './components/support/SupportPage';
import { PrivacyData } from './components/settings/PrivacyData';
import { ActivityHistoryPage } from './components/settings/ActivityHistoryPage';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { NotFoundPage } from './components/layout/NotFoundPage';


export function App() {
  const [started, setStarted] = useState(false);
  const [entryScreen, setEntryScreen] = useState<'welcome' | 'auth' | 'rakshak'>('welcome');
  const [page, setPage] = useState('home');
  const [contacts, setContacts] = useState<EmergencyContact[]>(initialContacts as EmergencyContact[]);
  const [rakshaks, setRakshaks] = useState<any[]>([]);
  const [journey, setJourney] = useState(false);
  const [journeyDestination, setJourneyDestination] = useState('');
  const [activeJourneyContactIds, setActiveJourneyContactIds] = useState<(string | number)[]>([]);
  const [showJourneySetup, setShowJourneySetup] = useState(false);
  const [sos, setSos] = useState(false);
  const [sosTime, setSosTime] = useState(0);
  const [toast, setToast] = useState('');
  const [fakeCall, setFakeCall] = useState(false);
  const [locationState, setLocationState] = useState<'ready' | 'locating' | 'shared' | 'fallback'>('ready');

  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [sosPressing, setSosPressing] = useState(false);
  const [authStatus, setAuthStatus] = useState<'checking' | 'signed-in' | 'signed-out'>('checking');
  const [user, setUser] = useState<{ id: string; email?: string; user_metadata?: { display_name?: string } } | null>(null);
  const [activeSosEventId, setActiveSosEventId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<SosDelivery[]>([]);
  const [notifications, setNotifications] = useState(() => localStorage.getItem('notifications') !== 'false');
  const [record, setRecord] = useState(() => localStorage.getItem('record') === 'true');
  const sosHoldRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const wakeLockRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cityLabel, setCityLabel] = useState('');
  const [profileDisplayName, setProfileDisplayName] = useState('');

  const isAdmin = user?.email === 'rakshaasutra@gmail.com';

  // Dark Mode Sync
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [dark]);

  // Notifications Sync
  useEffect(() => {
    localStorage.setItem('notifications', notifications ? 'true' : 'false');
    if (notifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [notifications]);

  // Auto Record Sync
  useEffect(() => {
    localStorage.setItem('record', record ? 'true' : 'false');
  }, [record]);

  // SOS Timer
  useEffect(() => {
    if (!sos) return;
    const interval = window.setInterval(() => setSosTime((t) => t + 1), 1000);
    return () => window.clearInterval(interval);
  }, [sos]);
  // Screen Wake Lock Resiliency on Visibility Change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && sos) {
        if ('wakeLock' in navigator) {
          try {
            if (wakeLockRef.current) {
              wakeLockRef.current.release().catch(() => {});
            }
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            console.log("Wake Lock re-acquired");
          } catch (err) {
            console.error('Wake lock re-acquire failed:', err);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sos]);

  // Phase 3: Continuous Background Location Polling during SOS
  useEffect(() => {
    if (!sos || !navigator.geolocation || !activeSosEventId) return;
    
    // Start real-time tracking when SOS is active
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        // Aggressively cache valid locations as fallback
        localStorage.setItem('lastLocationLat', lat.toString());
        localStorage.setItem('lastLocationLng', lng.toString());

        // Sync with backend
        updateSosLocation(activeSosEventId, lat, lng, accuracy, 'precise').catch(() => {});
      },
      (error) => console.error("SOS Location tracking error", error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    // Stop tracking immediately when SOS is cancelled
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        console.log("SOS cancelled - background location tracking stopped.");
      }
    };
  }, [sos, activeSosEventId]);

  // Toast Auto-hide
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // Admin Route Protection
  useEffect(() => {
    if (page === 'admin' && !isAdmin && authStatus !== 'checking') {
      setPage('home');
    }
  }, [page, isAdmin, authStatus]);

  // Auth State Listener
  useEffect(() => {

    let mounted = true;

    getCurrentSession()
      .then((session) => {
        if (!mounted) return;
        setUser(session?.user ? { id: session.user.id, email: session.user.email, user_metadata: session.user.user_metadata } : null);
        setAuthStatus(session ? 'signed-in' : 'signed-out');
        if (session?.user?.email === 'rakshaasutra@gmail.com') {
          setPage('admin');
        }
      })
      .catch(() => mounted && setAuthStatus('signed-out'));

    const { data: { subscription } } = onAuthStateChange((session, event) => {
      if (!mounted) return;
      setUser(session?.user ? { id: session.user.id, email: session.user.email, user_metadata: session.user.user_metadata } : null);
      setAuthStatus(session ? 'signed-in' : 'signed-out');
      if (event === 'SIGNED_IN' && session?.user?.email === 'rakshaasutra@gmail.com') {
        setPage('admin');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch Emergency Contacts when signed in
  useEffect(() => {
    if (!user) return;
    let mounted = true;

    listEmergencyContacts()
      .then((remoteContacts) => mounted && setContacts(remoteContacts as EmergencyContact[]))
      .catch(() => mounted && notify('Could not load saved contacts. Showing local data.'));
      
    return () => {
      mounted = false;
    };
  }, [user]);

  // Fetch rakshaks on mount and whenever returning to home/rakshak page
  useEffect(() => {
    let mounted = true;
    if (page === 'home' || page === 'rakshak') {
      listActiveRakshaks()
        .then((realRakshaks) => mounted && setRakshaks(realRakshaks))
        .catch(console.error);
    }
    return () => {
      mounted = false;
    };
  }, [page]);

  const notify = (message: string) => setToast(message);

  const requestLocation = (): Promise<LocationPayload> =>
    new Promise((resolve) => {
      setLocationState('locating');
      if (!navigator.geolocation) {
        window.setTimeout(() => {
          setLocationState('fallback');
          notify('Using Bengaluru fallback location');
          resolve({
            latitude: 12.9716,
            longitude: 77.5946,
            accuracyMeters: null,
            source: 'fallback',
          });
        }, 800);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationState('shared');
          notify('Live location shared with your contacts');
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            source: 'precise',
          });
        },
        () => {
          setLocationState('fallback');
          notify('Location unavailable — using Bengaluru fallback');
          resolve({
            latitude: 12.9716,
            longitude: 77.5946,
            accuracyMeters: null,
            source: 'fallback',
          });
        },
        { enableHighAccuracy: true, timeout: 7000 }
      );
    });

  const shareLocation = async () => {
    await requestLocation();
    
    if (!user) {
      notify('You must be signed in to share location.');
      return;
    }
    
    const trackingLink = `https://rakshasutra.in/track?session=${user.id}`;
    
    try {
      await dispatchLocationShare(trackingLink);
      notify('Live location sent via WhatsApp/SMS to all contacts!');
    } catch (err) {
      console.error('Failed to share location', err);
      notify('Failed to broadcast location.');
    }
  };

  const sendSOS = async () => {
    setSosTime(0);
    setSos(true);

    // Phase 3: Request Screen Wake Lock to prevent sleeping
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log("Wake Lock acquired on SOS start");
      } catch (err) {
        console.error('Wake Lock error:', err);
      }
    }

    // Browser notification
    if (notifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 SOS Activated', { body: 'Your emergency contacts are being notified.', icon: '/favicon.ico' });
    }

    // Auto audio/video recording is now handled by SOSOverlay to support camera switching

    const location = await requestLocation();

    if (!user) {
      notify('You must be signed in to trigger SOS.');
      return;
    }

    try {
      const event = await createSosEvent({
        userId: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMeters: location.accuracyMeters,
        locationSource: location.source,
      });
      setActiveSosEventId(event.id);
      const dispatchResult = await dispatchSos(event.id);
      if (dispatchResult?.deliveries) {
        setDeliveries(dispatchResult.deliveries as SosDelivery[]);
      }
    } catch {
      notify('SOS is active, but delivery is pending. Keep this screen open.');
    }
  };

  const startSOSHold = () => {
    if (sos || sosHoldRef.current) return;
    setSosPressing(true);
    sosHoldRef.current = window.setTimeout(() => {
      sosHoldRef.current = null;
      setSosPressing(false);
      sendSOS();
    }, 3000);
  };

  const cancelSOSHold = () => {
    if (!sosHoldRef.current) return;
    window.clearTimeout(sosHoldRef.current);
    sosHoldRef.current = null;
    setSosPressing(false);
  };

  const cancelSOS = () => {
    setSos(false);

    // Release Wake Lock
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(console.error);
      wakeLockRef.current = null;
      console.log("Wake Lock released on SOS cancel");
    }

    // Media recording is now handled by SOSOverlay completely

    // Browser notification for cancellation
    if (notifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('✅ SOS Cancelled', { body: 'You marked yourself safe. Your contacts have been notified.' });
    }

    if (activeSosEventId) {
      markSosSafe(activeSosEventId).catch(() =>
        notify('SOS cancelled locally; delivery update is pending.')
      );
    }
    setActiveSosEventId(null);
    notify("SOS cancelled. Your contacts have been notified that you are safe.");
  };

  const addContact = async (contact: Partial<EmergencyContact>) => {
    const isDuplicate = contacts.some(
      (c) =>
        (contact.phone && c.phone === contact.phone) ||
        (contact.email && c.email === contact.email)
    );

    if (isDuplicate) {
      notify('This contact is already in your emergency contacts.');
      return;
    }
    const newContact: EmergencyContact = {
      id: Date.now(),
      name: contact.name || '',
      relation: contact.relation || '',
      phone: contact.phone || '',
      email: contact.email || '',
      confirmationStatus: 'pending',
      initials: (contact.name || '')
        .split(' ')
        .map((v) => v[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      color: '#6255ec',
    };

    if (!user) {
      notify('You must be signed in to add contacts.');
      return;
    }

    try {
      const saved = await createEmergencyContact({
        userId: user.id,
        name: contact.name || '',
        relationship: contact.relation || '',
        phone: contact.phone || undefined,
        email: contact.email || undefined,
      });
      setContacts([...contacts, saved as EmergencyContact]);
      notify('Confirmation link sent to contact.');
    } catch (err: any) {
      console.error('Error saving contact:', err);
      const msg = err?.message || (typeof err === 'string' ? err : 'Could not save the contact.');
      notify(msg);
    }
  };

  const removeContact = async (contactId: string | number) => {
    const previousContacts = contacts;
    setContacts(contacts.filter((c) => c.id !== contactId));

    if (!user) return;
    if (String(contactId).startsWith('seed-')) return;

    try {
      await deleteEmergencyContact(contactId as string);
    } catch (err: any) {
      console.error('Error removing contact:', err);
      setContacts(previousContacts);
      const msg = err?.message || err?.details || err?.hint || 'Could not remove the contact. Please try again.';
      notify(msg);
    }
  };

  const reportRakshak = async (complaint: { rakshakId: string; description: string }) => {
    if (!user) {
      notify('You must be signed in to report a Rakshak.');
      return;
    }
    try {
      await submitRakshakComplaint(complaint);
      notify('Your concern has been sent to the safety team for investigation.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'We could not submit your concern.';
      notify(msg);
    }
  };

  const handleSignOut = async () => {
    try {
      if (authStatus === 'signed-in') await signOut();
    } catch (e) {
      console.warn('Error signing out', e);
    }
    setUser(null);
    setAuthStatus('signed-out');
    notify('Signed out successfully');
  };

  const nav = (next: string) => setPage(next);

  // Reverse-geocode user location to get city name
  useEffect(() => {
    if (!navigator.geolocation) {
      setCityLabel('India');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const json = await res.json();
          const address = json.address || {};
          const area = address.suburb || address.neighbourhood || address.village || address.residential || address.hamlet;
          const city = address.city || address.town || address.municipality || address.state_district;
          const state = address.state || address.state_code;
          
          const parts = [];
          if (area) parts.push(area);
          if (city && city !== area) parts.push(city);
          if (state && state !== city && state !== area) parts.push(state);

          setCityLabel(parts.length > 0 ? parts.join(', ') : 'Unknown');
        } catch {
          setCityLabel('India');
        }
      },
      () => setCityLabel('India')
    );
  }, []);

  const displayName =
    profileDisplayName ||
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    'Ananya Sharma';

  // Render Onboarding / Auth flow if not started or signed out
  if (entryScreen === 'welcome') {
    return (
      <WelcomeScreen
        onStart={() => { setStarted(true); setEntryScreen('auth'); }}
        onRakshak={() => setEntryScreen('rakshak')}
      />
    );
  }

  if (entryScreen === 'rakshak') {
    return (
      <RakshakApplication
        close={() => setEntryScreen('welcome')}
        finish={() => setEntryScreen('auth')}
        userId={user?.id}
      />
    );
  }

  if (authStatus === 'checking') return <LoadingScreen />;
  if (authStatus === 'signed-out') return <AuthScreen onBack={() => { setStarted(false); setEntryScreen('welcome'); }} />;

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <div className="desktop-shell">
        <aside className="desktop-rail" aria-label="Desktop context rail">
          <Brand />
          <p>Personal safety, within reach.</p>
          <div className="rail-card">
            <ShieldCheck size={22} />
            <span>Encrypted alert network</span>
          </div>
          <div className="rail-card">
            <UsersRound size={22} />
            <span>{rakshaks.length} verified Rakshaks nearby</span>
          </div>
          <small>Raksha Sutra · Pilot Interface</small>
        </aside>

        <main className="phone" role="main">
          <div className="statusbar" aria-hidden="true">
            <span>9:41</span>
            <span className="status-icons">
              <span>▮▮▮</span>
              <span>◒</span>
            </span>
          </div>

          {page === 'home' && (
            <HomeScreen
              displayName={displayName}
              contacts={contacts}
              journey={journey}
              journeyDestination={journeyDestination}
              onOpenJourneySetup={() => setShowJourneySetup(true)}
              onPauseJourney={() => notify('Journey paused — viewers notified.')}
              onResumeJourney={() => notify('Journey resumed — live tracking active.')}
              onEndJourney={() => {
                setJourney(false);
                const trackingLink = `https://rakshasutra.in/track?session=${user?.id || 'demo'}`;
                if (journeyDestination) {
                  dispatchJourney(journeyDestination, activeJourneyContactIds, trackingLink, 'arrived').catch(err => {
                    console.error("Failed to dispatch arrival notifications:", err);
                  });
                }
                setJourneyDestination('');
                setActiveJourneyContactIds([]);
                notify('You have arrived safely. Tracking stopped.');
              }}
              isRakshak={rakshaks.some((r) => r.id === user?.id)}
              sendSOS={sendSOS}
              startSOSHold={startSOSHold}
              cancelSOSHold={cancelSOSHold}
              sosPressing={sosPressing}
              requestLocation={requestLocation}
              shareLocation={shareLocation}
              locationState={locationState}
              cityLabel={cityLabel}
              nav={nav}
              notify={notify}
              onStartFakeCall={() => setFakeCall(true)}
            />
          )}

          {page === 'map' && <MapPage nav={nav} />}

          {page === 'community' && (
            <CommunityPage nav={nav} />
          )}

          {page === 'rakshak' && (
            <RakshakPage
              nav={nav}
              notify={notify}
              onComplaint={reportRakshak}
              userId={user?.id}
              rakshaks={rakshaks}
            />
          )}

          {page === 'contacts' && (
            <ContactsScreen
              nav={nav}
              contacts={contacts}
              addContact={addContact}
              removeContact={removeContact}
            />
          )}

          {page === 'settings' && (
            <SettingsPage
              nav={nav}
              dark={dark}
              setDark={setDark}
              notifications={notifications}
              setNotifications={setNotifications}
              record={record}
              setRecord={setRecord}
              displayName={displayName}
              email={user?.email || ''}
              onSignOut={handleSignOut}
              notify={notify}
            />
          )}

          {page === 'edit-profile' && (
            <EditProfilePage
              nav={nav}
              displayName={displayName}
              email={user?.email || ''}
              onProfileUpdated={(newName) => setProfileDisplayName(newName)}
              notify={notify}
            />
          )}

          {page === 'activity-history' && (
            <ActivityHistoryPage nav={nav} userId={user?.id} />
          )}

          {page === 'privacy-data' && (
            <PrivacyData nav={nav} />
          )}

          {page === 'support' && (
            <SupportPage nav={nav} />
          )}



          {page === 'admin' && isAdmin && (
            <AdminPanel nav={nav} notify={notify} />
          )}

          {!['home', 'map', 'rakshak', 'community', 'settings', 'admin', 'privacy', 'support'].includes(page) && (
            <NotFoundPage nav={nav} />
          )}

          {['home', 'map', 'rakshak', 'settings', 'admin'].includes(page) && (
            <BottomNav page={page} nav={nav} isAdmin={isAdmin} />
          )}
        </main>
      </div>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <Check size={16} />
          {toast}
        </div>
      )}

      {sos && (
        <SOSOverlay
          contacts={contacts}
          elapsed={sosTime}
          cancel={cancelSOS}
          deliveries={deliveries}

          isOffline={!navigator.onLine}
        />
      )}

      {fakeCall && <FakeCall close={() => setFakeCall(false)} />}

      {showJourneySetup && (
        <JourneySetupModal
          contacts={contacts}
          close={() => setShowJourneySetup(false)}
          startJourney={(dest, selectedContactIds) => {
            setJourneyDestination(dest);
            setActiveJourneyContactIds(selectedContactIds);
            setJourney(true);
            setShowJourneySetup(false);

            const trackingLink = `https://rakshasutra.in/track?session=${user?.id || 'demo'}`;
            
            dispatchJourney(dest, selectedContactIds, trackingLink, 'started').catch(err => {
              console.error("Failed to dispatch journey emails:", err);
            });

            if (activeSosEventId) {
              markSosSafe(activeSosEventId).catch(err => console.error(err));
              setActiveSosEventId(null);
            }

            const selectedContacts = contacts.filter((c) => selectedContactIds.includes(c.id));
            const notifiedCount = selectedContacts.length;
            const shortDest = dest.split(',')[0].trim();

            notify(`Journey to ${shortDest} started. Link sent to ${notifiedCount} contact${notifiedCount === 1 ? '' : 's'}.`);
          }}
        />
      )}

    </div>
  );
}

export default App;
