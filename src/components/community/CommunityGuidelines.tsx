import React, { useState } from 'react';
import { AlertTriangle, Camera, FileText, HeartHandshake, MapPin, Plus, ShieldCheck, Star, X } from 'lucide-react';
import type { IncidentReport } from '../../types/models';
import { BackHeader } from '../layout/BackHeader';

interface GuidelinesProps {
  close: () => void;
}

export const CommunityGuidelines: React.FC<GuidelinesProps> = ({ close }) => {
  return (
    <div className="modal-backdrop">
      <section className="sheet guidelines-sheet" role="dialog" aria-label="Community Guidelines">
        <div className="sheet-handle" />
        <div className="sheet-title">
          <div>
            <p>Community reporting</p>
            <h2>Report the place, not the person.</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close guidelines">
            <X />
          </button>
        </div>
        <p>
          Community reports help everyone make safer choices about where they go. Keep reports factual, specific, and fair.
        </p>
        <h3 className="guideline-good">What you can report</h3>
        <ul>
          <li>Poor lighting, isolated public areas, broken CCTV, or missing security.</li>
          <li>Safety patterns you personally noticed, such as an area being deserted after dark.</li>
          <li>A safety incident you witnessed or experienced, described by location and situation only.</li>
        </ul>
        <h3 className="guideline-stop">What you cannot report</h3>
        <ul>
          <li>Names, accusations, personal disputes, rumours, or unverified claims about a person.</li>
          <li>Hate speech, discrimination, exaggeration, or fabricated reports.</li>
        </ul>
        <p className="guideline-note">
          Anonymous reports receive the same review. Your identity is never shown publicly.
        </p>
        <button className="primary" onClick={close}>
          I understand
        </button>
      </section>
    </div>
  );
};

interface ComposerProps {
  close: () => void;
  submit: (report: Partial<IncidentReport>) => void;
  submitting?: boolean;
  error?: string;
}

export const ReportComposer: React.FC<ComposerProps> = ({ close, submit, submitting = false, error = '' }) => {
  const [place, setPlace] = useState('');
  const [text, setText] = useState('');
  const [unsafe, setUnsafe] = useState(true);
  const [anonymous, setAnonymous] = useState(true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');

  const handlePhotoChange = (file: File | null) => {
    setPhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!place.trim()) {
      setLocalError('Please enter a location.');
      return;
    }
    if (text.trim().length < 10) {
      setLocalError(`Please describe the situation with at least 10 characters (currently ${text.trim().length}).`);
      return;
    }
    setLocalError('');

    submit({
      place: place.trim(),
      text: text.trim(),
      rating: unsafe ? 'Unsafe' : 'Safe',
      anonymous,
      photo,
    });
  };

  return (
    <div className="modal-backdrop">
      <form className="sheet report-form" onSubmit={handleSubmit}>
        <div className="sheet-handle" />
        <div className="sheet-title">
          <div>
            <p>Community report</p>
            <h2>What did you notice?</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close composer">
            <X />
          </button>
        </div>
        <label>
          Location
          <input
            value={place}
            onChange={(e) => {
              setPlace(e.target.value);
              if (localError) setLocalError('');
            }}
            placeholder="e.g. Silk Board Underpass"
            required
          />
        </label>
        <label>
          Describe the situation
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (localError) setLocalError('');
            }}
            placeholder="Share useful, factual details (minimum 10 characters)…"
            minLength={10}
            maxLength={2500}
            required
          />
          <small style={{
            color: text.trim().length > 0 && text.trim().length < 10 ? '#dc2626' : '#64748b',
            fontSize: '11px',
            marginTop: '3px',
            display: 'block'
          }}>
            {text.trim().length < 10
              ? `Please enter at least 10 characters (${text.trim().length}/10)`
              : `${text.trim().length}/2500 characters`}
          </small>
        </label>
        <div className="report-choices">
          <button
            className={unsafe ? 'selected unsafe' : ''}
            type="button"
            onClick={() => setUnsafe(true)}
          >
            <AlertTriangle /> Needs attention
          </button>
          <button
            className={!unsafe ? 'selected safe' : ''}
            type="button"
            onClick={() => setUnsafe(false)}
          >
            <ShieldCheck /> Feels safe
          </button>
        </div>
        <div style={{ marginBottom: '2px' }}>
          <label className="photo-upload">
            <Camera size={18} />
            {photo ? photo.name : 'Add a photo'} <small>Optional</small>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
            />
          </label>
          {photoPreview && (
            <div style={{ position: 'relative', marginTop: '8px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <img
                src={photoPreview}
                alt="Preview"
                style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }}
              />
              <button
                type="button"
                onClick={() => handlePhotoChange(null)}
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  lineHeight: 1,
                }}
                aria-label="Remove photo"
              >✕</button>
            </div>
          )}
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
          />
          <span />
          Post anonymously
        </label>
        {(localError || error) && (
          <p style={{ color: '#dc2626', fontSize: '12px', fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>
            {localError || error}
          </p>
        )}
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </div>
  );
};
