import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Mail, ShieldCheck, User } from 'lucide-react';
import { sendMagicLink } from '../../services/authService.ts';
import { Brand } from '../layout/Brand';

interface AuthScreenProps {
  onBack?: () => void;
}

export const LoadingScreen: React.FC = () => {
  return (
    <div className="app auth-page">
      <main className="welcome-phone auth-phone loading-screen">
        <Brand />
        <div className="auth-loading">
          <span className="loading-shield">
            <ShieldCheck size={36} />
          </span>
          <h1>Securing your session</h1>
          <p>Checking your Raksha Sutra account…</p>
        </div>
      </main>
    </div>
  );
};

export const AuthScreen: React.FC<AuthScreenProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('sending');
    setError('');
    try {
      await sendMagicLink({ email, displayName: name });
      setStatus('sent');
    } catch (authError: unknown) {
      const msg = authError instanceof Error ? authError.message : 'We could not send your secure sign-in link.';
      setError(msg);
      setStatus('idle');
    }
  };

  return (
    <div className="app auth-page">
      <main className="welcome-phone auth-phone">
        {/* Header with Back button and Brand */}
        <header className="auth-header">
          {onBack ? (
            <button className="auth-back-btn" onClick={onBack} aria-label="Go back to welcome screen">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="auth-back-placeholder" />
          )}
          <Brand />
          <div className="auth-back-placeholder" />
        </header>

        {/* Hero Lock & Copy */}
        <div className="auth-copy">
          <div className="auth-icon-wrap">
            <span className="auth-icon">
              <LockKeyhole size={28} />
            </span>
            <span className="auth-badge">Private by default</span>
          </div>
          <h1>Sign in <em>securely</em></h1>
          <p className="auth-subtitle">
            We’ll send a passwordless one-time link directly to your inbox.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="magic-sent">
            <div className="sent-icon">
              <Check size={32} />
            </div>
            <h2>Check your inbox</h2>
            <p>
              We sent a secure sign-in link to <b>{email}</b>. Tap the link in your email to access Raksha Sutra.
            </p>
            <button className="secondary" onClick={() => setStatus('idle')}>
              Use a different email address
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <div className="input-group">
              <label htmlFor="auth-name">
                <span>Your name</span>
                <small>Optional</small>
              </label>
              <div className="input-field">
                <User size={18} className="input-icon" />
                <input
                  id="auth-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Ananya Sharma"
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="auth-email">
                <span>Email address</span>
              </label>
              <div className="input-field">
                <Mail size={18} className="input-icon" />
                <input
                  id="auth-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button
              className="primary auth-submit-btn"
              type="submit"
              disabled={status === 'sending'}
            >
              <span>{status === 'sending' ? 'Sending secure link…' : 'Send secure sign-in link'}</span>
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        <div className="auth-privacy-pill">
          <ShieldCheck size={16} />
          <span>Your personal safety data is protected with 256-bit encryption.</span>
        </div>
      </main>
    </div>
  );
};
