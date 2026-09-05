import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHeader } from '../layout/BackHeader';

interface FakeCallConfigPageProps {
  nav: (page: string) => void;
  callerName: string;
  setCallerName: (name: string) => void;
  callerRelation: string;
  setCallerRelation: (relation: string) => void;
  ringtone: string;
  setRingtone: (ringtone: string) => void;
  notify: (msg: string) => void;
}

export const FakeCallConfigPage: React.FC<FakeCallConfigPageProps> = ({
  nav,
  callerName,
  setCallerName,
  callerRelation,
  setCallerRelation,
  ringtone,
  setRingtone,
  notify,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(callerName);
  const [relation, setRelation] = useState(callerRelation);
  const [selectedRingtone, setSelectedRingtone] = useState(ringtone);
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioName, setCustomAudioName] = useState(() => localStorage.getItem('fakeCallCustomAudioName') || '');

  const handleSave = () => {
    setCallerName(name);
    setCallerRelation(relation);
    setRingtone(selectedRingtone);

    if (selectedRingtone === 'custom' && customAudioFile) {
      if (customAudioFile.size > 3 * 1024 * 1024) {
        notify('Audio file is too large (max 3MB).');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Str = e.target?.result as string;
        try {
          localStorage.setItem('fakeCallCustomAudio', base64Str);
          localStorage.setItem('fakeCallCustomAudioName', customAudioFile.name);
          notify(t('settings.fake_call_saved', 'Fake call configuration saved'));
          nav('settings');
        } catch (err) {
          notify('Failed to save audio. File might be too large.');
        }
      };
      reader.readAsDataURL(customAudioFile);
      return; // wait for reader
    }

    notify(t('settings.fake_call_saved', 'Fake call configuration saved'));
    nav('settings');
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        notify('Please select an audio file (e.g., mp3, wav, m4a).');
        return;
      }
      setCustomAudioFile(file);
      setCustomAudioName(file.name);
    }
  };

  return (
    <section className="screen">
      <BackHeader title={t('settings.fake_call_config', 'Fake Call Setup')} nav={nav} />
      
      <div style={{ padding: '20px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          {t('settings.fake_call_desc', 'Customize the caller details that appear when you activate a Fake Call.')}
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
            {t('settings.caller_name', 'Caller Name')}
          </label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Meera Iyer"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
            {t('settings.caller_relation', 'Caller Description')}
          </label>
          <input 
            type="text" 
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            placeholder="e.g. Sister · mobile"
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
            {t('settings.ringtone', 'Ringtone')}
          </label>
          <select 
            value={selectedRingtone}
            onChange={(e) => setSelectedRingtone(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', appearance: 'none' }}
          >
            <option value="default">{t('settings.ringtone_default', 'Default (Continuous)')}</option>
            <option value="classic">{t('settings.ringtone_classic', 'Classic Telephone')}</option>
            <option value="modern">{t('settings.ringtone_modern', 'Modern Digital')}</option>
            <option value="custom">{t('settings.ringtone_custom', 'Custom (Upload)')}</option>
            <option value="vibrate">{t('settings.ringtone_vibrate', 'Vibrate Only (No Sound)')}</option>
          </select>

          {selectedRingtone === 'custom' && (
            <div style={{ marginTop: '12px' }}>
              <input 
                type="file" 
                accept="audio/*" 
                id="custom-audio-upload"
                style={{ display: 'none' }}
                onChange={handleAudioUpload}
              />
              <label 
                htmlFor="custom-audio-upload"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px dashed var(--primary)',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {customAudioName ? `Selected: ${customAudioName}` : 'Select Audio File (Max 3MB)'}
              </label>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                For best results, use a short MP3 or WAV file.
              </p>
            </div>
          )}
        </div>

        <div 
          style={{ 
            position: 'sticky', 
            bottom: '20px', 
            marginTop: '40px',
            background: 'var(--bg-app)',
            padding: '10px 0'
          }}
        >
          <button 
            onClick={handleSave}
            style={{ 
              width: '100%', 
              padding: '14px', 
              borderRadius: '8px', 
              background: 'var(--text-primary)', 
              color: 'var(--text-inverse)', 
              fontWeight: 700, 
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            {t('common.save', 'Save Changes')}
          </button>
        </div>
      </div>
    </section>
  );
};
