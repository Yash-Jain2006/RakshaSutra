import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2 } from 'lucide-react';
import { BackHeader } from '../layout/BackHeader.tsx';
import { updateMyProfile } from '../../services/profileService.ts';
import { isSupabaseConfigured } from '../../lib/supabase.ts';

interface EditProfilePageProps {
  nav: (page: string) => void;
  displayName: string;
  email: string;
  onProfileUpdated: (newName: string) => void;
  notify: (msg: string) => void;
}

export const EditProfilePage: React.FC<EditProfilePageProps> = ({
  nav,
  displayName,
  email,
  onProfileUpdated,
  notify,
}) => {
  const [name, setName] = useState(displayName);
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    () => localStorage.getItem('profile_avatar') || null
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved phone from database and fallback to localStorage
  useEffect(() => {
    let active = true;
    const fetchProfilePhone = async () => {
      const savedPhone = localStorage.getItem('profile_phone') || '';
      if (savedPhone) setPhone(savedPhone);

      if (isSupabaseConfigured) {
        try {
          const prof = await getMyProfile();
          if (active && prof.phone) {
            setPhone(prof.phone);
            localStorage.setItem('profile_phone', prof.phone);
          }
        } catch (e) {
          console.error('Failed to load profile phone', e);
        }
      }
    };
    fetchProfilePhone();
    return () => { active = false; };
  }, []);

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('Image must be under 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      localStorage.setItem('profile_avatar', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      notify('Name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const trimmedPhone = phone.trim();
      if (isSupabaseConfigured) {
        await updateMyProfile(name.trim(), trimmedPhone);
      }
      localStorage.setItem('profile_phone', trimmedPhone);
      onProfileUpdated(name.trim());
      setSaved(true);
      notify('Profile updated successfully');
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      notify(err?.message || 'Could not save profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="screen settings-screen">
      <BackHeader title="Edit Profile" nav={nav} />

      {/* Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 16px' }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(124, 58, 237, 0.3)',
            overflow: 'hidden',
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '28px' }}>{initials}</span>
          )}
          {/* Camera overlay */}
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.2s',
          }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
          >
            <Camera size={22} color="white" />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAvatarChange}
        />
        <p style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-dim)' }}>
          Tap to change photo
        </p>
      </div>

      {/* Form */}
      <div className="settings-group" style={{ marginTop: '8px' }}>
        {/* Display Name */}
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', padding: '14px' }}>
          <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
            DISPLAY NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            style={{
              width: '100%',
              padding: '8px 0',
              border: 'none',
              borderBottom: '1.5px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 600,
              outline: 'none',
            }}
          />
        </div>

        {/* Phone */}
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', padding: '14px' }}>
          <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
            PHONE NUMBER
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            style={{
              width: '100%',
              padding: '8px 0',
              border: 'none',
              borderBottom: '1.5px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 600,
              outline: 'none',
            }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
            Used for automated WhatsApp & SMS alerts, SOS notifications, and login.
          </span>
        </div>

        {/* Email — read-only */}
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', padding: '14px' }}>
          <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
            EMAIL ADDRESS
          </label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-dim)' }}>{email}</span>
            <span style={{
              fontSize: '9px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
              borderRadius: '4px', padding: '2px 6px', color: 'var(--text-dim)', whiteSpace: 'nowrap'
            }}>
              Cannot change
            </span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          margin: '20px 0',
          width: '100%',
          padding: '14px',
          borderRadius: '12px',
          background: saved ? '#10b981' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '14px',
          border: 'none',
          cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'background 0.3s',
          opacity: saving ? 0.8 : 1,
        }}
      >
        {saving ? (
          <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
        ) : saved ? (
          <><Check size={16} /> Saved!</>
        ) : (
          'Save Changes'
        )}
      </button>
    </section>
  );
};
