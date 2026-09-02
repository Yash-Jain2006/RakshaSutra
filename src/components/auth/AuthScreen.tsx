import React, { useState } from 'react';
import { ArrowLeft, CalendarDays, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { signInWithEmailPassword, signInWithGoogle, signUpWithPassword } from '../../services/authService.ts';

interface AuthScreenProps {
  onBack?: () => void;
}

type AuthMode = 'login' | 'signup';

const GoogleMark = () => (
  <svg className="ref-google-mark" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.35 12.27c0-.78-.07-1.53-.2-2.24H12v4.24h5.23a4.47 4.47 0 0 1-1.94 2.93v2.75h3.15c1.84-1.7 2.91-4.2 2.91-7.18Z" />
    <path fill="#34A853" d="M12 21.82c2.64 0 4.85-.88 6.47-2.38l-3.15-2.75c-.87.59-1.99.94-3.32.94-2.55 0-4.7-1.72-5.48-4.04H3.26v2.84A9.78 9.78 0 0 0 12 21.82Z" />
    <path fill="#FBBC05" d="M6.52 13.59A5.88 5.88 0 0 1 6.21 12c0-.55.1-1.07.31-1.59V7.57H3.26A9.78 9.78 0 0 0 2.22 12c0 1.58.38 3.08 1.04 4.43l3.26-2.84Z" />
    <path fill="#EA4335" d="M12 6.37c1.44 0 2.74.5 3.76 1.48l2.82-2.82C16.84 3.4 14.63 2.18 12 2.18a9.78 9.78 0 0 0-8.74 5.39l3.26 2.84C7.3 8.09 9.45 6.37 12 6.37Z" />
  </svg>
);

export const LoadingScreen: React.FC = () => (
  <div className="reference-flow-root">
    <main className="reference-phone reference-loading-phone">
      <span className="reference-loading-spinner" />
      <p>Securing your session…</p>
    </main>
  </div>
);

export const AuthScreen: React.FC<AuthScreenProps> = ({ onBack }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage('');
    setPassword('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmailPassword({ email, password });
      } else {
        if (!acceptedTerms) {
          setMessage('Please accept the Terms & Privacy Policy to continue.');
          return;
        }
        const fullPhone = phone ? `${phoneCode}${phone}` : '';
        await signUpWithPassword({ email, password, displayName: name, age, phone: fullPhone });
        setMessage('Account created. Check your email to confirm your account.');
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'We could not complete your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const useGoogle = async () => {
    setMessage('');
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Google sign-in is unavailable right now.');
    }
  };

  const isLogin = mode === 'login';

  return (
    <div className="reference-flow-root">
      <main className={`reference-phone ref-auth-screen ${isLogin ? 'ref-auth-screen--login' : 'ref-auth-screen--signup'}`}>
        <button className="ref-back-button" type="button" onClick={onBack} aria-label="Back to welcome screen">
          <ArrowLeft size={20} strokeWidth={2.7} />
        </button>

        <section className="ref-auth-content">
          <h1>{isLogin ? 'Welcome back' : 'Create account'}</h1>
          <p className="ref-auth-lead">
            {isLogin
              ? 'Sign in securely using your email and password.'
              : 'Join Raksha Sutra to access personalized safety features.'}
          </p>

          <form className="ref-auth-form" onSubmit={submit}>
            {isLogin ? (
              <>
                <label className="ref-field">
                  <span>Email address or phone no.</span>
                  <span className="ref-input-shell">
                    <Mail size={18} aria-hidden="true" />
                    <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com or +91..." autoComplete="email" required />
                  </span>
                </label>
                <label className="ref-field">
                  <span>Password</span>
                  <span className="ref-input-shell">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" type="password" autoComplete="current-password" required />
                  </span>
                </label>
              </>
            ) : (
              <>
                <div className="ref-inline-fields">
                  <label className="ref-field ref-name-field">
                    <span>Full Name</span>
                    <span className="ref-input-shell">
                      <UserRound size={17} aria-hidden="true" />
                      <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
                    </span>
                  </label>
                  <label className="ref-field ref-age-field">
                    <span>Age</span>
                    <span className="ref-input-shell">
                      <CalendarDays size={17} aria-hidden="true" />
                      <input value={age} onChange={(event) => setAge(event.target.value)} inputMode="numeric" aria-label="Age" required />
                    </span>
                  </label>
                </div>
                <label className="ref-field">
                  <span>Phone Number</span>
                  <span className="ref-phone-row">
                    <select aria-label="Country calling code" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)}>
                      <option value="+1">+1 (US/CA)</option>
                      <option value="+44">+44 (UK)</option>
                      <option value="+61">+61 (AU)</option>
                      <option value="+91">+91 (IN)</option>
                      <option value="+971">+971 (AE)</option>
                    </select>
                    <span className="ref-input-shell">
                      <Phone size={17} aria-hidden="true" />
                      <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" aria-label="Phone number" />
                    </span>
                  </span>
                </label>
                <label className="ref-field">
                  <span>Email address or phone no.</span>
                  <span className="ref-input-shell">
                    <Mail size={18} aria-hidden="true" />
                    <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required />
                  </span>
                </label>
                <label className="ref-field">
                  <span>Password</span>
                  <span className="ref-input-shell">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" type="password" autoComplete="new-password" minLength={6} required />
                  </span>
                </label>
                <label className="ref-terms">
                  <input checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} type="checkbox" />
                  <span>I agree to <button type="button">Terms</button> &amp; <button type="button">Privacy Policy</button></span>
                </label>
              </>
            )}

            {message && <p className="ref-auth-message" role="status">{message}</p>}
            <button className="ref-submit-button" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="ref-auth-divider"><span>or continue with</span></div>
          <button className="ref-google-button" type="button" onClick={useGoogle}><GoogleMark />Continue with Google</button>
          <p className="ref-auth-switch">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={() => switchMode(isLogin ? 'signup' : 'login')}>{isLogin ? 'Create one.' : 'Sign in.'}</button>
          </p>
        </section>

        {isLogin && <p className="ref-auth-legal">By continuing you agree to our <button type="button">Terms</button> &amp; <button type="button">Privacy Policy</button></p>}
      </main>
    </div>
  );
};
