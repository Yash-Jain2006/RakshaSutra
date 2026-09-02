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
}

export const ReportComposer: React.FC<ComposerProps> = ({ close, submit }) => {
  const [place, setPlace] = useState('');
  const [text, setText] = useState('');
  const [unsafe, setUnsafe] = useState(true);
  const [anonymous, setAnonymous] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!place.trim() || !text.trim()) return;

    submit({
      place: place.trim(),
      text: text.trim(),
      rating: unsafe ? 'Unsafe' : 'Safe',
      anonymous,
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
            onChange={(e) => setPlace(e.target.value)}
            placeholder="e.g. Silk Board Underpass"
            required
          />
        </label>
        <label>
          Describe the situation
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share useful, factual details…"
            required
          />
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
        <button type="button" className="photo-upload">
          <Camera size={18} /> Add a photo <small>Optional</small>
        </button>
        <label className="check-label">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
          />
          <span />
          Post anonymously
        </label>
        <button className="primary" type="submit">
          Submit report
        </button>
      </form>
    </div>
  );
};
