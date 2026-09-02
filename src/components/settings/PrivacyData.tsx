import React from 'react';
import { Database, Lock, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BackHeader } from '../layout/BackHeader';

interface PrivacyDataProps {
  nav: (page: string) => void;
}

export const PrivacyData: React.FC<PrivacyDataProps> = ({ nav }) => {
  const { t } = useTranslation();

  return (
    <section className="screen">
      <BackHeader title={t('settings.privacy', 'Privacy & Data')} nav={() => nav('settings')} />
      
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{
          padding: '16px',
          background: 'var(--bg-elevated)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--bg-input)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--text-primary)',
            flexShrink: 0
          }}>
            <Lock size={20} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              End-to-End Encryption
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Your emergency contacts, alerts, and live locations are encrypted. We cannot read your personal safety data.
            </p>
          </div>
        </div>

        <div style={{
          padding: '16px',
          background: 'var(--bg-elevated)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--bg-input)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--text-primary)',
            flexShrink: 0
          }}>
            <Database size={20} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Location Data
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Location is only shared when you activate an SOS or start a Live Journey. We do not track you in the background otherwise.
            </p>
          </div>
        </div>

        <div style={{
          padding: '16px',
          background: 'var(--bg-elevated)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--bg-input)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--accent-danger)',
            flexShrink: 0
          }}>
            <Trash2 size={20} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Account Deletion
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              You can permanently delete your account and all associated data from our servers.
            </p>
            <button style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-danger)',
              fontWeight: 600,
              fontSize: '13px',
              padding: 0,
              cursor: 'pointer'
            }}>
              Request Data Deletion
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
