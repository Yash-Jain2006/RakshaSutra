import React, { useState } from 'react';
import { AlertTriangle, LockKeyhole, MapPin, ShieldCheck, X } from 'lucide-react';
import { rakshaks } from '../../data';
import { BackHeader } from '../layout/BackHeader';
import { RakshakApplication } from './RakshakApplication';

interface RakshakComplaintFormProps {
  close: () => void;
  submit: (complaint: { rakshakId: string; description: string }) => void;
}

export const RakshakComplaintForm: React.FC<RakshakComplaintFormProps> = ({ close, submit }) => {
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
}

export const RakshakPage: React.FC<RakshakPageProps> = ({ nav, notify, onComplaint, userId }) => {
  const [apply, setApply] = useState(false);
  const [complaint, setComplaint] = useState(false);

  return (
    <section className="screen rakshak-screen">
      <BackHeader title="Rakshaks" nav={nav} />
      <div className="rakshak-banner">
        <span>
          <ShieldCheck size={32} />
        </span>
        <h2>Your trusted local safety network</h2>
        <p>
          Verified volunteers who can be alerted in an emergency — never asked to intervene beyond their safety or training.
        </p>
        <button className="primary" onClick={() => setApply(true)}>
          Become a Rakshak →
        </button>
      </div>

      <div className="section-title">
        <h2>Meet the Rakshaks</h2>
      </div>

      <div className="rakshak-list">
        {rakshaks.map((helper) => (
          <article key={helper.id}>
            <span className="avatar">{helper.initials}</span>
            <div>
              <b>
                {helper.name}{' '}
                <i title="Identity Verified">
                  <ShieldCheck size={14} />
                </i>
              </b>
              <small>
                <MapPin size={12} />
                {helper.area} · ★ {helper.rating}
              </small>
            </div>
            <span className="online">{helper.eta}</span>
          </article>
        ))}
      </div>

      <div className="rakshak-note">
        <LockKeyhole size={18} />
        <p>All Rakshaks are identity-verified and managed by our safety team.</p>
      </div>

      <button className="complaint-action" onClick={() => setComplaint(true)}>
        <AlertTriangle size={16} /> Report a concern about a Rakshak
      </button>

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
        />
      )}
    </section>
  );
};
