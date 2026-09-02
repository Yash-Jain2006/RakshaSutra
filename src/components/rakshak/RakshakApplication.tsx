import React, { useState } from 'react';
import { ArrowLeft, Check, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RakshakApplicationProps {
  close: () => void;
  finish: () => void;
  userId?: string;
}

export const RakshakApplication: React.FC<RakshakApplicationProps> = ({ close, finish, userId }) => {
  const [docType, setDocType] = useState<'Aadhaar' | 'PAN Card' | 'Driving Licence'>('Aadhaar');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (supabase && userId) {
        const documentType = docType === 'Aadhaar' ? 'aadhaar' : docType === 'PAN Card' ? 'pan' : 'driving_licence';
        const { data, error } = await supabase
          .from('rakshak_applications')
          .upsert({ user_id: userId, document_type: documentType, full_name_as_id: fullName, coverage_area: area, status: 'pending', submitted_at: new Date().toISOString() })
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
      }
      finish();
    } catch {
      finish();
    } finally {
      setSubmitting(false);
    }
  };

  const UploadTile = ({ side, file, setFile }: { side: 'front' | 'back'; file: File | null; setFile: (file: File | null) => void }) => (
    <label className={`ref-upload-tile ${file ? 'is-ready' : ''}`}>
      {file ? <Check size={22} /> : <Upload size={22} />}
      <span>{file ? `${side === 'front' ? 'Front' : 'Back'} uploaded` : `Upload ${side === 'front' ? 'Front' : 'Back'} Side`}</span>
      <input type="file" accept="image/*,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
    </label>
  );

  return (
    <div className="reference-flow-root ref-rakshak-root">
      <main className="reference-phone ref-rakshak-screen">
        <button className="ref-back-button" type="button" onClick={close} aria-label="Back to welcome screen"><ArrowLeft size={20} strokeWidth={2.7} /></button>
        <section className="ref-rakshak-content">
          <h1>Become a Rakshak</h1>
          <p className="ref-rakshak-lead">Join the community of verified volunteers to help make our streets safer.</p>

          <form className="ref-rakshak-form" onSubmit={submit}>
            <fieldset className="ref-document-choice">
              <legend>Select ID Document</legend>
              <div>
                {(['Aadhaar', 'PAN Card', 'Driving Licence'] as const).map((document) => (
                  <button key={document} className={docType === document ? 'is-selected' : ''} onClick={() => setDocType(document)} type="button">{document}</button>
                ))}
              </div>
              <small>Pick a document type above to continue.</small>
            </fieldset>

            <label className="ref-rakshak-field">
              <span>Full Name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name as printed on ID" required />
            </label>
            <label className="ref-rakshak-field">
              <span>Phone Number</span>
              <span className="ref-rakshak-phone-row">
                <select aria-label="Country calling code" defaultValue="+91"><option>+91</option></select>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" aria-label="Phone number" />
              </span>
            </label>
            <label className="ref-rakshak-field">
              <span>Coverage Area</span>
              <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="e.g. HSR Layout, Bengaluru" required />
            </label>

            <div className="ref-upload-grid">
              <UploadTile side="front" file={frontFile} setFile={setFrontFile} />
              <UploadTile side="back" file={backFile} setFile={setBackFile} />
            </div>
            <label className="ref-rakshak-terms">
              <input checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} type="checkbox" />
              <span>I agree to <button type="button">Terms</button> &amp; <button type="button">Privacy Policy</button></span>
            </label>
            <button className="ref-rakshak-submit" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Next'}</button>
          </form>
          <p className="ref-rakshak-footnote">Clear photos of original documents are required.</p>
        </section>
      </main>
    </div>
  );
};
