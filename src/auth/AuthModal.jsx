import React, { useCallback, useEffect, useState } from 'react';
import { SparklesIcon } from '../icons';
import { useAuth } from './useAuth';
import TurnstileWidget from './TurnstileWidget';

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  otp: '',
  newPassword: '',
  confirmNewPassword: ''
};

export default function AuthModal({ isOpen, mode, onModeChange, onClose, onAuthenticated, requestedLabel, resetEmail }) {
  const {
    authError,
    clearAuthError,
    confirmPasswordReset,
    continueWithGoogle,
    login,
    requestPasswordReset,
    verifyPasswordResetOtp,
    signup
  } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetStep, setResetStep] = useState('auth');
  const [loginFailedAttempts, setLoginFailedAttempts] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setForm(initialForm);
      setError('');
      setMessage('');
      setLoading(false);
      setResetStep(resetEmail ? 'request' : 'auth');
      setLoginFailedAttempts(0);
      setTurnstileToken('');
      setTurnstileResetKey((prev) => prev + 1);
      if (resetEmail) {
        setForm((prev) => ({
          ...prev,
          email: resetEmail
        }));
      }
    }
  }, [isOpen, mode, resetEmail]);

  useEffect(() => {
    if (isOpen && authError) {
      setError(authError);
      clearAuthError();
    }
  }, [authError, clearAuthError, isOpen]);

  const handleTurnstileTokenChange = useCallback((token) => {
    setTurnstileToken(token);
    setError((currentError) => token && currentError === 'Complete CAPTCHA verification.' ? '' : currentError);
  }, []);

  if (!isOpen) return null;

  const isSignup = mode === 'signup';
  const isPasswordReset = resetStep !== 'auth';
  const isLoginCaptchaRequired = !isSignup && resetStep === 'auth' && loginFailedAttempts >= 3;
  const isPasswordResetCaptchaRequired = resetStep === 'request';
  const isCaptchaRequired = (isSignup && resetStep === 'auth') || isPasswordResetCaptchaRequired || isLoginCaptchaRequired;
  const canResendOtp = resetStep === 'verify';

  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileResetKey((prev) => prev + 1);
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
    if (message) setMessage('');
  };

  const validate = () => {
    if (resetStep === 'request') {
      if (!form.email.trim()) {
        return 'Email is required.';
      }
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
        return 'Enter a valid email address.';
      }
      if (!turnstileToken) {
        return 'Complete CAPTCHA verification.';
      }
      return '';
    }
    if (resetStep === 'verify') {
      if (!/^\d{6}$/.test(form.otp.trim())) {
        return 'Enter the 6-digit OTP.';
      }
      return '';
    }
    if (resetStep === 'new-password') {
      if (!form.newPassword) {
        return 'New password is required.';
      }
      if (form.newPassword.length < 8) {
        return 'Password must be at least 8 characters.';
      }
      if (form.newPassword !== form.confirmNewPassword) {
        return 'Passwords do not match.';
      }
      return '';
    }
    if (isSignup && !form.fullName.trim()) {
      return 'Full name is required.';
    }
    if (!form.email.trim()) {
      return 'Email is required.';
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      return 'Enter a valid email address.';
    }
    if (!form.password) {
      return 'Password is required.';
    }
    if (isSignup && form.password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (isSignup && form.password !== form.confirmPassword) {
      return 'Passwords do not match.';
    }
    if (isCaptchaRequired && !turnstileToken) {
      return 'Complete CAPTCHA verification.';
    }
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      if (resetStep === 'request') {
        await requestPasswordReset({ email: form.email, turnstileToken });
        setResetStep('verify');
        setMessage('OTP sent. Check your email.');
        resetTurnstile();
        return;
      } else if (resetStep === 'verify') {
        await verifyPasswordResetOtp({ email: form.email, otp: form.otp });
        setError('');
        setMessage('');
        setResetStep('new-password');
        return;
      } else if (resetStep === 'new-password') {
        const data = await confirmPasswordReset({
          email: form.email,
          otp: form.otp,
          password: form.newPassword
        });
        setMessage(data.message || 'Password reset successfully.');
        setResetStep('auth');
        onModeChange('login');
        setForm((prev) => ({
          ...initialForm,
          email: prev.email
        }));
        return;
      } else if (isSignup) {
        const authenticatedUser = await signup({ ...form, turnstileToken });
        setLoginFailedAttempts(0);
        onAuthenticated?.(authenticatedUser);
        return;
      } else {
        const authenticatedUser = await login({ ...form, turnstileToken });
        setLoginFailedAttempts(0);
        onAuthenticated?.(authenticatedUser);
        return;
      }
    } catch (err) {
      const errorMessage = err.message || 'Authentication failed.';
      setError(errorMessage);
      if (!isSignup && resetStep === 'auth') {
        setLoginFailedAttempts((prev) => errorMessage.includes('CAPTCHA') ? 3 : prev + 1);
      }
      if (isCaptchaRequired) {
        resetTurnstile();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    setLoading(true);
    setError('');
    continueWithGoogle();
  };

  const handleForgotPassword = () => {
    setError('');
    setMessage('');
    setResetStep('request');
    resetTurnstile();
    onModeChange('login');
  };

  const handleBackToSignIn = () => {
    setError('');
    setMessage('');
    setResetStep('auth');
    resetTurnstile();
    onModeChange('login');
  };

  const handleResendOtp = async () => {
    const validationError = !form.email.trim()
      ? 'Email is required.'
      : !/^\S+@\S+\.\S+$/.test(form.email.trim())
        ? 'Enter a valid email address.'
        : '';
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!turnstileToken) {
      setError('Complete CAPTCHA verification.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await requestPasswordReset({ email: form.email, turnstileToken });
      setMessage('A new OTP has been sent.');
      resetTurnstile();
    } catch (err) {
      setError(err.message || 'Could not resend OTP.');
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="auth-modal glass-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="auth-close-btn" type="button" onClick={onClose} aria-label="Close authentication form">
          ×
        </button>

        <div className="auth-brand">
          <SparklesIcon className="auth-logo-icon" />
          <div>
            <h2 id="auth-title">
              {resetStep === 'request'
                ? 'Reset your password'
                : resetStep === 'verify'
                  ? 'Enter your OTP'
                  : resetStep === 'new-password'
                    ? 'Create a new password'
                    : isSignup
                      ? 'Create your PROJEX account'
                      : 'Sign in to PROJEX'}
            </h2>
            <p>
              {isPasswordReset
                ? resetStep === 'verify'
                  ? 'Enter the OTP sent to your email.'
                  : 'Use the verified OTP to create a new password.'
                : requestedLabel
                ? `Access ${requestedLabel} and protected dashboard records.`
                : 'Access protected dashboard records and PROJEX AI.'}
            </p>
          </div>
        </div>

        {!isPasswordReset && (
          <>
            <div className="auth-segmented">
              <button
                type="button"
                className={`auth-segment ${!isSignup ? 'active' : ''}`}
                onClick={() => onModeChange('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`auth-segment ${isSignup ? 'active' : ''}`}
                onClick={() => onModeChange('signup')}
              >
                Create account
              </button>
            </div>

            <button className="auth-google-btn" type="button" onClick={handleGoogleAuth} disabled={loading}>
              <span className="auth-google-mark" aria-hidden="true">G</span>
              {isSignup ? 'Sign up with Google' : 'Sign in with Google'}
            </button>

            <div className="auth-divider">
              <span>or</span>
            </div>
          </>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && !isPasswordReset && (
            <label className="auth-field">
              <span>Full name</span>
              <input
                type="text"
                value={form.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                autoComplete="name"
                placeholder="Sara Alharbi"
              />
            </label>
          )}

          {(resetStep === 'auth' || resetStep === 'request') && (
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                autoComplete="email"
                placeholder="name@company.sa"
              />
            </label>
          )}

          {resetStep === 'auth' && (
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder={isSignup ? 'Minimum 8 characters' : 'Enter password'}
              />
            </label>
          )}

          {resetStep === 'verify' && (
            <>
              <label className="auth-field">
                <span>OTP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  value={form.otp}
                  onChange={(event) => updateField('otp', event.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                />
              </label>
            </>
          )}

          {resetStep === 'new-password' && (
            <>
              <label className="auth-field">
                <span>New password</span>
                <input
                  type="password"
                  value={form.newPassword}
                  onChange={(event) => updateField('newPassword', event.target.value)}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                />
              </label>

              <label className="auth-field">
                <span>Confirm new password</span>
                <input
                  type="password"
                  value={form.confirmNewPassword}
                  onChange={(event) => updateField('confirmNewPassword', event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                />
              </label>
            </>
          )}

          {isSignup && resetStep === 'auth' && (
            <label className="auth-field">
              <span>Confirm password</span>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                autoComplete="new-password"
                placeholder="Repeat password"
              />
            </label>
          )}

          {message && <div className="auth-success">{message}</div>}
          {error && <div className="auth-error">{error}</div>}

          {(isCaptchaRequired || canResendOtp) && (
            <TurnstileWidget
              action={
                isSignup
                  ? 'signup'
                  : resetStep === 'auth'
                    ? 'login'
                    : 'password-reset'
              }
              resetKey={turnstileResetKey}
              onTokenChange={handleTurnstileTokenChange}
            />
          )}

          {!isSignup && resetStep === 'auth' && (
            <button className="auth-link-btn" type="button" onClick={handleForgotPassword}>
              Forgot password?
            </button>
          )}

          {resetStep === 'verify' && (
            <button className="auth-link-btn" type="button" onClick={handleResendOtp} disabled={loading}>
              Resend OTP
            </button>
          )}

          <button className="auth-submit-btn" type="submit" disabled={loading}>
            {loading
              ? 'Please wait...'
              : resetStep === 'request'
                ? 'Send OTP'
                : resetStep === 'verify'
                  ? 'Verify OTP'
                  : resetStep === 'new-password'
                    ? 'Reset password'
                  : isSignup
                    ? 'Create account'
                    : 'Sign in'}
          </button>

          {isPasswordReset && (
            <button className="auth-secondary-link" type="button" onClick={handleBackToSignIn}>
              Back to sign in
            </button>
          )}
        </form>
      </section>
    </div>
  );
}
