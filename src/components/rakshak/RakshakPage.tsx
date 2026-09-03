import React, { useState } from 'react';
import { AlertTriangle, LockKeyhole, MapPin, ShieldCheck, X, Check } from 'lucide-react';
import { BackHeader } from '../layout/BackHeader';
import { RakshakApplication } from './RakshakApplication';

interface RakshakComplaintFormProps {
  close: () => void;
  submit: (complaint: { rakshakId: string; description: string }) => void;
  rakshaks: any[];
}

export const RakshakComplaintForm: React.FC<RakshakComplaintFormProps> = ({ close, submit, rakshaks }) => {
  const [rakshakId, setRakshakId] = useState(String(rakshaks[0]?.id || '1'));
  const [description, setDescription] = useState('');

  return (
    <div className="modal-backdrop">
      <form
        className="sheet complaint-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit({ rakshakId, description });
          close();
        }}
      >
        <div className="sheet-handle" />
        <div className="sheet-title">
          <div>
            <p>Safety concern</p>
            <h2>Report a Rakshak</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close complaint form">
            <X />
          </button>
        </div>
        <p className="form-intro">
          Share factual details only. Your report goes to the safety team for investigation and is not public.
        </p>
        <label>
          Rakshak
          <select
            value={rakshakId}
            onChange={(event) => setRakshakId(event.target.value)}
          >
            {rakshaks.map((helper) => (
              <option value={helper.id} key={helper.id}>
                {helper.name} · {helper.area}
              </option>
            ))}
          </select>
        </label>
        <label>
          What happened?
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe what you personally experienced or observed…"
            minLength={20}
            required
          />
        </label>
        <p className="contact-consent">
          Confirmed serious misconduct results in permanent removal. Until then, the safety team investigates.
        </p>
        <button className="primary" type="submit">
          Send to safety team
        </button>
      </form>
    </div>
  );
};

interface RakshakPageProps {
  nav: (page: string) => void;
  notify: (msg: string) => void;
  onComplaint: (complaint: { rakshakId: string; description: string }) => void;
  userId?: string;
  rakshaks: any[];
}

import { calculateDistanceKm } from '../../utils/locationMath';
import { notifySpecificRakshak, updateRakshakArea } from '../../services/safetyService';
import { useEffect, useMemo, useRef } from 'react';

// ... (keep RakshakComplaintForm as is)

export const RakshakPage: React.FC<RakshakPageProps> = ({ nav, notify, onComplaint, userId, rakshaks }) => {
  const [apply, setApply] = useState(false);
  const [complaint, setComplaint] = useState(false);
  const [editArea, setEditArea] = useState(false);
  const [newArea, setNewArea] = useState('');
  const [isUpdatingArea, setIsUpdatingArea] = useState(false);
  
  const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const currentUserRakshak = useMemo(() => {
    return userId ? rakshaks.find(r => r.id === userId) : null;
  }, [rakshaks, userId]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log('Location access denied or failed for nearby rakshaks', err)
      );
    }
  }, []);

  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (!newArea.trim() || !showDropdown) {
      setSuggestions([]);
      return;
    }
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(newArea)}&format=json&addressdetails=1&limit=5`;
        if (userLoc) {
          const minLon = userLoc.lng - 0.5;
          const maxLon = userLoc.lng + 0.5;
          const minLat = userLoc.lat - 0.5;
          const maxLat = userLoc.lat + 0.5;
          url += `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=1`;
        }
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data);
      } catch (err) {
        console.error('Failed to fetch locations', err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [newArea, showDropdown, userLoc]);

  const handleUpdateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !newArea.trim()) return;
    setIsUpdatingArea(true);
    try {
      await updateRakshakArea(userId, newArea, userLoc?.lat ?? null, userLoc?.lng ?? null);
      notify('Coverage area updated successfully! Please reload to see changes.');
      setEditArea(false);
    } catch (err) {
      console.error(err);
      notify('Failed to update area. Please try again.');
    } finally {
      setIsUpdatingArea(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const handleRequestHelp = async (helper: any) => {
    try {
      notify(`Contacting ${helper.name}...`);
      const response = await notifySpecificRakshak(helper.id, userLoc);
      
      if (response && response.channel === 'sms') {
        notify(`Alert sent to ${helper.name} via SMS Fallback!`);
      } else {
        notify(`Alert sent to ${helper.name} via WhatsApp!`);
      }
    } catch (err) {
      console.error(err);
      notify(`Failed to notify ${helper.name}. They might be offline.`);
    }
  };

  const sortedRakshaks = useMemo(() => {
    let rakshaksList = [...rakshaks];
    if (userLoc) {
      rakshaksList = rakshaksList.map(r => {
        let distance = 9999;
        // Fallback to Rau/Indore coordinates if missing in DB for testing
        const lat = r.latitude || (r.area?.toLowerCase().includes('indore') || r.area?.toLowerCase().includes('rau') ? 22.6366 : null);
        const lng = r.longitude || (r.area?.toLowerCase().includes('indore') || r.area?.toLowerCase().includes('rau') ? 75.8118 : null);
        
        if (lat && lng) {
          distance = calculateDistanceKm(userLoc.lat, userLoc.lng, lat, lng);
        }
        return { ...r, distance };
      });
      rakshaksList.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
    }
    
    if (!showAll && userLoc) {
      rakshaksList = rakshaksList.filter(r => r.distance !== undefined && r.distance <= 10);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rakshaksList = rakshaksList.filter(r => 
        r.name.toLowerCase().includes(q) || 
        r.area.toLowerCase().includes(q)
      );
    }

    return rakshaksList;
  }, [rakshaks, userLoc, showAll, searchQuery]);

  return (
    <section className="screen rakshak-screen" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <BackHeader title="Rakshaks" nav={nav} />
      
      {currentUserRakshak ? (
        <div style={{ background: '#16a34a', padding: '20px', borderRadius: '16px', color: 'white', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 4px 6px rgba(22, 163, 74, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '8px', borderRadius: '12px', display: 'flex' }}>
              <ShieldCheck size={24} color="#ffffff" />
            </span>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, opacity: 0.9 }}>
                Your Status
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                Verified Rakshak <Check size={18} strokeWidth={4} />
              </div>
            </div>
          </div>
          
          <p style={{ fontSize: '13px', lineHeight: 1.4, margin: 0, opacity: 0.95 }}>
            Thank you for keeping your community safe. You will be alerted when someone nearby needs help.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '12px 8px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>-</div>
              <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>Responses</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '12px 8px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{currentUserRakshak.rating > 0 ? currentUserRakshak.rating : '-'}</div>
              <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>Rating</div>
            </div>
            <div 
              style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '12px 8px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}
              onClick={() => { setNewArea(currentUserRakshak.area); setEditArea(true); }}
            >
              <div style={{ fontSize: '18px', fontWeight: 700, display: 'flex', justifyContent: 'center' }}><Check size={20} strokeWidth={3} /></div>
              <div style={{ fontSize: '10px', opacity: 0.9, marginTop: '2px' }}>Edit Area</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rakshak-banner" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              display: 'flex', 
              background: '#fff', 
              padding: '6px', 
              borderRadius: '8px', 
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              margin: 0
            }}>
              <ShieldCheck size={16} color="#0f172a" />
            </span>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
              Your trusted local safety network
            </h2>
          </div>
          <p style={{ fontSize: '11px', letterSpacing: '-0.2px', color: '#64748b', lineHeight: 1.3, margin: 0 }}>
            Verified volunteers who can be alerted in an emergency — never asked to intervene beyond their training.
          </p>
          <button className="primary" onClick={() => setApply(true)} style={{ marginTop: '2px', width: '100%', padding: '10px', borderRadius: '10px', background: '#1e293b', color: '#fff', border: 'none', fontWeight: 700, fontSize: '13px' }}>
            Become a Rakshak →
          </button>
        </div>
      )}

      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0, margin: '16px 0' }}>
        <h2>Meet the Rakshaks</h2>
        <button 
          onClick={() => setShowAll(!showAll)} 
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
        >
          {showAll ? 'Show nearest' : 'Show all'}
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', color: '#94a3b8' }}>
          <MapPin size={18} style={{ marginRight: '8px' }} />
          <input 
            type="text" 
            placeholder="Search by name or location..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', width: '100%', fontSize: '14px', color: '#0f172a' }}
          />
        </div>
      </div>

      <div style={{ paddingBottom: '32px' }}>
        {sortedRakshaks.map((helper) => (
          <div key={helper.id} style={{ display: 'flex', flexDirection: 'column', padding: '12px', marginBottom: '12px', background: '#fff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ marginRight: '12px' }}>
                {helper.avatarUrl ? (
                  <img src={helper.avatarUrl} alt={helper.name} style={{ width: '40px', height: '40px', borderRadius: '20px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '20px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
                    {helper.initials}
                  </div>
                )}
              </div>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <b style={{ fontSize: '15px', color: '#0f172a', margin: 0 }}>{helper.name}</b>
                  <span style={{ fontSize: '10px', color: '#16a34a', background: '#f0fdf4', padding: '2px 6px', borderRadius: '8px', border: '1px solid #bbf7d0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Verified <Check size={10} strokeWidth={3} />
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', color: '#475569', fontSize: '12px', gap: '6px' }}>
                  <span style={{ color: '#0f172a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ★ {helper.rating}
                  </span>
                  <span>·</span>
                  <span>{helper.distance !== undefined && helper.distance < 9999 ? `${helper.distance.toFixed(1)} km` : '-'}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', color: '#64748b', fontSize: '12px', lineHeight: 1.3, marginTop: '8px' }}>
              <MapPin size={12} style={{ marginTop: '2px', marginRight: '6px', flexShrink: 0 }} />
              <span>{helper.area}</span>
            </div>

            <button 
              onClick={() => handleRequestHelp(helper)}
              style={{ marginTop: '12px', width: '100%', padding: '10px', borderRadius: '12px', background: '#8b5cf6', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(139, 92, 246, 0.25)' }}
            >
              Request Help
            </button>
            
          </div>
        ))}
        {sortedRakshaks.length === 0 && (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '20px 0' }}>No Rakshaks found.</p>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingBottom: '0px' }}>
        <button className="complaint-action" onClick={() => setComplaint(true)}>
          <AlertTriangle size={16} /> Report a concern about a Rakshak
        </button>
      </div>

      {editArea && (
        <div className="modal-backdrop">
          <form
            className="sheet complaint-form"
            onSubmit={handleUpdateArea}
          >
            <div className="sheet-handle" />
            <div className="sheet-title">
              <div>
                <p>Rakshak Profile</p>
                <h2>Edit Coverage Area</h2>
              </div>
              <button type="button" onClick={() => setEditArea(false)} aria-label="Close edit form">
                <X />
              </button>
            </div>
            <p className="form-intro">
              Update the primary area or neighborhood where you can quickly respond to nearby emergencies.
            </p>
            <label>
              Coverage Area
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={newArea}
                  onChange={(event) => {
                    setNewArea(event.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => {
                    if (newArea.trim()) setShowDropdown(true);
                  }}
                  placeholder="e.g. Rau, Indore"
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', marginTop: '8px', fontSize: '15px' }}
                />
                {isSearching && (
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#64748b' }}>
                    Searching...
                  </div>
                )}
                {showDropdown && suggestions.length > 0 && (
                  <ul style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    listStyle: 'none',
                    padding: '4px 0',
                    margin: 0,
                    zIndex: 10,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {suggestions.map((s, idx) => (
                      <li
                        key={idx}
                        onClick={() => {
                          setNewArea(s.display_name);
                          setUserLoc({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                          setShowDropdown(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          borderBottom: idx < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#0f172a'
                        }}
                      >
                        {s.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </label>
            <button className="primary" type="submit" disabled={isUpdatingArea} style={{ marginTop: '24px' }}>
              {isUpdatingArea ? 'Updating...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {apply && (
        <RakshakApplication
          userId={userId}
          close={() => setApply(false)}
          finish={() => {
            setApply(false);
            notify('Application submitted for admin review.');
          }}
        />
      )}

      {complaint && (
        <RakshakComplaintForm
          close={() => setComplaint(false)}
          submit={onComplaint}
          rakshaks={rakshaks}
        />
      )}
    </section>
  );
};

