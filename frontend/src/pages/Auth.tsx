import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Check your email and password.');
    }
  };

  return (
    <div className="auth-wrap">
      <div className="panel">
        <img className="auth-logo" src="/logo.jpg" alt="Manan Automation logo" />
        <h1>Welcome back</h1>
        <p className="muted" style={{ lineHeight: 1.6 }}>Log in to Manan AI Creator Studio to sync your projects.</p>
        <form onSubmit={submit} style={{ marginTop: 20 }}>
          <div className="field"><label htmlFor="li-email">Email</label>
            <input id="li-email" className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="field"><label htmlFor="li-pass">Password</label>
            <input id="li-pass" className="input" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
          </div>
          {error && <div className="notice notice-err">{error}</div>}
          <button className="btn btn-block" type="submit" disabled={loading}>{loading ? 'Logging in…' : 'Log in →'}</button>
        </form>
        <p className="small muted" style={{ marginTop: 16, textAlign: 'center' }}>
          No account yet? <Link to="/register" style={{ color: 'var(--accent-1)', fontWeight: 700 }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Try a different email.');
    }
  };

  return (
    <div className="auth-wrap">
      <div className="panel">
        <img className="auth-logo" src="/logo.jpg" alt="Manan Automation logo" />
        <h1>Create your account</h1>
        <p className="muted" style={{ lineHeight: 1.6 }}>One account for all Manan AI Creator Studio tools.</p>
        <form onSubmit={submit} style={{ marginTop: 20 }}>
          <div className="field"><label htmlFor="rg-name">Name</label>
            <input id="rg-name" className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
          </div>
          <div className="field"><label htmlFor="rg-email">Email</label>
            <input id="rg-email" className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="field"><label htmlFor="rg-pass">Password</label>
            <input id="rg-pass" className="input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
          </div>
          {error && <div className="notice notice-err">{error}</div>}
          <button className="btn btn-block" type="submit" disabled={loading}>{loading ? 'Creating account…' : 'Create account →'}</button>
        </form>
        <p className="small muted" style={{ marginTop: 16, textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent-1)', fontWeight: 700 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
