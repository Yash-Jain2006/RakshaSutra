import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Check, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { BackHeader } from '../layout/BackHeader';

interface RakshakApplicationProps {
  close: () => void;
  finish: () => void;
  userId?: string;
  nav?: (page: string) => void;
  notify?: (msg: string) => void;
}

export const RakshakApplication: React.FC<RakshakApplicationProps> = ({ close, finish, userId, nav, notify }) => {
  const { t, i18n } = useTranslation();
  const [docType, setDocType] = useState<'Aadhaar' | 'PAN Card' | 'Driving Licence'>('Aadhaar');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appLoc, setAppLoc] = useState<{ lat: number, lng: number } | null>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setAppLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log('Rakshak App Location denied', err)
      );
    }
  }, []);

  useEffect(() => {
    if (!area.trim() || !showDropdown) {
      setSuggestions([]);
      return;
    }
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const currentLang = i18n.language || 'en';
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(area)}&format=json&addressdetails=1&limit=5&accept-language=${currentLang}`;
        if (appLoc) {
          const minLon = appLoc.lng - 0.5;
          const maxLon = appLoc.lng + 0.5;
          const minLat = appLoc.lat - 0.5;
          const maxLat = appLoc.lat + 0.5;
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
  }, [area, showDropdown, appLoc]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (supabase && userId) {
        const documentType = docType === 'Aadhaar' ? 'aadhaar' : docType === 'PAN Card' ? 'pan' : 'driving_licence';
        const { data, error } = await supabase
          .from('rakshak_applications')
          .upsert({ 
            user_id: userId, 
            document_type: documentType, 
            full_name_as_id: fullName, 
            coverage_area: area, 
            status: 'pending', 
            submitted_at: new Date().toISOString()
          }, { onConflict: 'user_id' })
          .select('id')
          .single();
        if (error) throw error;

        for (const [side, file] of [['front', frontFile], ['back', backFile]] as const) {
          if (!file || !data) continue;
          const storagePath = `${userId}/${side}_${Date.now()}_${file.name}`;
          const upload = await supabase.storage.from('identity-documents').upload(storagePath, file);
          if (upload.error) throw upload.error;
          await supabase.from('rakshak_documents').insert({ application_id: data.id, side, storage_path: storagePath, mime_type: file.type || 'image/jpeg' });
        }
        notify?.('✅ Application submitted! Our team will review it shortly.');
      }
      finish();
    } catch (err: any) {
      console.error('Rakshak application error:', err);
      const msg = err?.message || err?.details || err?.hint || 'Unknown error';
      notify?.(`❌ Submission failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const UploadTile = ({ side, file, setFile }: { side: 'front' | 'back'; file: File | null; setFile: (file: File | null) => void }) => (
    <label className={`ref-upload-tile ${file ? 'is-ready' : ''}`}>
      {file ? <Check size={22} /> : <Upload size={22} />}
      <span>{file ? `${side === 'front' ? t('rakshak.upload_front', 'Front') : t('rakshak.upload_back', 'Back')} uploaded` : side === 'front' ? t('rakshak.upload_front', 'Upload Front Side') : t('rakshak.upload_back', 'Upload Back Side')}</span>
      <input type="file" accept="image/*,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
    </label>
  );

  return (
    <section className="screen rakshak-apply-screen">
      <BackHeader title={t('rakshak.title', 'Become a Rakshak')} nav={() => close()} />
      <div className="ref-rakshak-content" style={{ padding: '0 16px 24px', overflowY: 'auto', flex: 1, height: '100%' }}>
        <p className="ref-rakshak-lead" style={{ marginTop: '8px' }}>{t('rakshak.subtitle', 'Join the community of verified volunteers to help make our streets safer.')}</p>

        <form className="ref-rakshak-form" onSubmit={submit}>
          <fieldset className="ref-document-choice">
            <legend>{t('rakshak.doc_type', 'Select ID Document')}</legend>
            <div>
              {(['Aadhaar', 'PAN Card', 'Driving Licence'] as const).map((document) => (
                <button key={document} className={docType === document ? 'is-selected' : ''} onClick={() => setDocType(document)} type="button">
                  {document === 'Aadhaar' ? t('rakshak.aadhaar', 'Aadhaar') : document === 'PAN Card' ? t('rakshak.pan', 'PAN Card') : t('rakshak.driving_licence', 'Driving Licence')}
                </button>
              ))}
            </div>
            <small>{t('rakshak.pick_doc', 'Pick a document type above to continue.')}</small>
          </fieldset>

          <label className="ref-rakshak-field">
            <span>{t('rakshak.full_name', 'Full Name')}</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder={t('rakshak.full_name_id', 'Full name as printed on ID')} required />
          </label>
          <label className="ref-rakshak-field">
            <span>{t('rakshak.phone', 'Phone Number')}</span>
            <span className="ref-rakshak-phone-row">
              <select aria-label="Country calling code" defaultValue="+91"><option>+91</option></select>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" aria-label="Phone number" />
            </span>
          </label>
          <label className="ref-rakshak-field">
            <span>{t('rakshak.coverage_area', 'Coverage Area')}</span>
            <div style={{ position: 'relative' }}>
              <input 
                value={area} 
                onChange={(event) => { setArea(event.target.value); setShowDropdown(true); }} 
                placeholder={t('rakshak.eg_area', 'e.g. HSR Layout, Bengaluru')} 
                required 
                style={{ width: '100%' }}
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
                        setArea(s.display_name);
                        setAppLoc({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
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

          <div className="ref-upload-grid">
            <UploadTile side="front" file={frontFile} setFile={setFrontFile} />
            <UploadTile side="back" file={backFile} setFile={setBackFile} />
          </div>
          <div className="ref-rakshak-terms" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', marginBottom: '24px' }}>
            <input id="terms-checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} type="checkbox" style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }} />
            <label htmlFor="terms-checkbox" style={{ fontSize: '13px', color: '#64748b', cursor: 'pointer' }}>
              I agree to{' '}
              <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); nav?.('terms'); }} 
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Terms
              </button>
              {' '}&amp;{' '}
              <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); nav?.('privacy'); }} 
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Privacy Policy
              </button>
            </label>
          </div>
          <button className="ref-rakshak-submit" type="submit" disabled={submitting}>
            {submitting 
              ? (userId ? 'Submitting…' : t('rakshak.uploading', 'Submitting…'))
              : (userId ? 'Submit Application' : t('rakshak.next', 'Next'))
            }
          </button>
        </form>
        <p className="ref-rakshak-footnote">{t('rakshak.upload_req', 'Clear photos of original documents are required.')}</p>
      </div>
    </section>
  );
};
