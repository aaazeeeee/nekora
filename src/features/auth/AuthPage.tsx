import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Layers3, LockKeyhole } from 'lucide-react';
import { authService } from './auth.service';
import { isConfigured } from '../../lib/supabase/client';
import { errorMessage } from '../../lib/errors';
import { Button } from '../../components/ui/button';
export function AuthPage() {
  const [signup, setSignup] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (confirmationEmail) {
        await authService.confirmEmail(
          confirmationEmail,
          String(form.get('code')),
        );
        return;
      }
      const email = String(form.get('email')).trim();
      const password = String(form.get('password'));
      if (signup) {
        const immediate = await authService.signUp(
          email,
          password,
          String(form.get('name')),
        );
        if (!immediate) {
          setConfirmationEmail(email);
          setNotice('Enter the confirmation code sent to your email.');
        }
      } else await authService.signIn(email, password);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function resendCode() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await authService.resendConfirmation(confirmationEmail);
      setNotice('A new confirmation code has been sent.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Layers3 size={18} />
          </span>
          Nekora
        </a>
        <form onSubmit={submit} className="auth-form">
          <h1>
            {confirmationEmail
              ? 'Confirm your email.'
              : signup
                ? 'Create your account.'
                : 'Welcome back.'}
          </h1>
          <p className="auth-lede">
            {confirmationEmail
              ? `Enter the code sent to ${confirmationEmail}.`
              : signup
                ? 'A quiet place to write, organize and share.'
                : 'Sign in and pick up where you left off.'}
          </p>
          {!isConfigured && (
            <div className="setup-notice">
              <strong>Connect your workspace</strong>
              <p>
                Add your Supabase URL and publishable key to <code>.env</code>,
                apply the database migration, then restart the app. See
                README.md for setup.
              </p>
            </div>
          )}
          {confirmationEmail ? (
            <label>
              Confirmation code
              <input
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                minLength={6}
                maxLength={10}
                required
                autoFocus
              />
            </label>
          ) : (
            <>
              {signup && (
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    maxLength={100}
                    required
                    placeholder="Alex Morgan"
                  />
                </label>
              )}
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  minLength={signup ? 10 : 1}
                  required
                  placeholder={
                    signup ? 'At least 10 characters' : 'Enter your password'
                  }
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="success">
              {notice}
            </p>
          )}
          <Button disabled={busy || !isConfigured} type="submit">
            {busy
              ? 'Please wait…'
              : confirmationEmail
                ? 'Confirm email'
                : signup
                  ? 'Create account'
                  : 'Sign in'}
            <ArrowRight size={17} />
          </Button>
          {confirmationEmail && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void resendCode()}
            >
              Resend code
            </Button>
          )}
          <p className="auth-switch">
            {confirmationEmail
              ? 'Use a different email?'
              : signup
                ? 'Already have an account?'
                : 'New to Nekora?'}{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirmationEmail) setConfirmationEmail('');
                else setSignup(!signup);
                setError('');
                setNotice('');
              }}
            >
              {confirmationEmail
                ? 'Back to signup'
                : signup
                  ? 'Sign in'
                  : 'Create an account'}
            </button>
          </p>
        </form>
        <p className="private-note">
          <LockKeyhole size={12} />
          Your documents are private by default.
        </p>
      </section>
    </main>
  );
}
