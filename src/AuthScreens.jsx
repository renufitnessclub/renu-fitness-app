import React, { useState } from 'react';
import { signIn, signUp } from './lib/supabase';

export function LoginScreen({ onSwitch, onSuccess, showToast }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: authErr } = await signIn(email, password);
      if (authErr) throw authErr;
      showToast('Welcome back!');
      onSuccess();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">RENU</div>
        <div className="auth-subtitle">Fitness Club · Fort McMurray</div>
        <div className="auth-title">Welcome Back</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-switch">
          New to Renu?{' '}
          <button className="auth-switch-btn" onClick={onSwitch}>
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}

export function SignupScreen({ onSwitch, onSuccess, showToast }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: authErr } = await signUp(email, password, fullName);
      if (authErr) throw authErr;
      setSuccess(true);
      showToast('Account created!');
    } catch (err) {
      setError(err.message || 'Sign-up failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">RENU</div>
          <div className="auth-title" style={{ marginTop: 20 }}>Check Your Email</div>
          <p className="auth-body">
            We sent a confirmation link to <strong>{email}</strong>. Click the link
            to activate your account, then come back here to sign in.
          </p>
          <button className="auth-btn" onClick={onSwitch}>
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">RENU</div>
        <div className="auth-subtitle">Fitness Club · Fort McMurray</div>
        <div className="auth-title">Create Account</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSignup}>
          <div className="auth-field">
            <label className="auth-label">Full Name</label>
            <input
              className="auth-input"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          Already a member?{' '}
          <button className="auth-switch-btn" onClick={onSwitch}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
