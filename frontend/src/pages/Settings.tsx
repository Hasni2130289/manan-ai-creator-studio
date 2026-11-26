import { useEffect, useState } from 'react';
import { metaApi, ApiError } from '../lib/api';
import type { ProviderStatus, HealthResponse } from '../lib/api';
import { LINKS } from '../lib/tools';
import { useAuth } from '../lib/auth';

export default function Settings() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([metaApi.providers(), metaApi.health()])
      .then(([p, h]) => {
        if (cancelled) return;
        if (p.status === 'fulfilled') setProviders(p.value.providers || []);
        else setError(p.reason instanceof ApiError ? p.reason.message : 'Could not load provider status.');
        if (h.status === 'fulfilled') setHealth(h.value);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>Account &amp; Settings</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>Which providers are connected, and what is still missing. Secrets are never shown here — only whether each key is configured.</p>

      <div className="section panel">
        <h3>Your account</h3>
        {user ? (
          <>
            <div className="kv"><span>Name</span><b>{user.name}</b></div>
            <div className="kv"><span>Email</span><b>{user.email}</b></div>
            {user.role && <div className="kv"><span>Role</span><b>{user.role}</b></div>}
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm" type="button" onClick={logout}>Log out</button>
            </div>
          </>
        ) : (
          <p className="muted">You are browsing as a guest. Projects save on this device only. <a href="/login" style={{ color: 'var(--accent-1)', fontWeight: 700 }}>Log in</a> or <a href="/register" style={{ color: 'var(--accent-1)', fontWeight: 700 }}>create an account</a>.</p>
        )}
      </div>

      <div className="section panel">
        <h3>Service health</h3>
        {loading ? <p className="muted">Checking…</p> : health ? (
          <>
            <div className="kv"><span>Studio API</span><b><span className="dot dot-on" />{health.status}</b></div>
            {health.version && <div className="kv"><span>Version</span><b>{health.version}</b></div>}
            {health.clippingTool && (
              <div className="kv"><span>Clipping Tool</span><b><span className={`dot ${health.clippingTool.status === 'ok' || health.clippingTool.status === 'online' ? 'dot-on' : 'dot-off'}`} />{health.clippingTool.status} — <a href={health.clippingTool.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-1)' }}>open ↗</a></b></div>
            )}
          </>
        ) : (
          <div className="notice notice-err">The studio server could not be reached. Tools that need the server will show their own errors; the Thumbnail canvas still works offline.</div>
        )}
        {error && <div className="notice notice-err">{error}</div>}
      </div>

      <div className="section">
        <div className="section-head"><div><h2>Providers</h2><p>Each row shows the exact environment variable the server needs. Set it on the server — never paste a key into this page.</p></div></div>
        {loading ? (
          <div className="panel empty">Loading provider status…</div>
        ) : providers.length === 0 ? (
          <div className="panel empty">No provider information was returned by the server.</div>
        ) : (
          <div className="grid">
            {providers.map(p => (
              <div className="card" key={p.id}>
                <div className="tool-meta">
                  <span className={`status ${p.configured ? 'status-live' : 'status-setup'}`}>
                    {p.configured ? '● Configured' : '○ Not configured'}
                  </span>
                </div>
                <h3>{p.name}</h3>
                <p className="small muted" style={{ lineHeight: 1.6 }}>
                  Environment variable: <code style={{ color: 'var(--text)' }}>{p.envVar}</code>
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}>{p.instructions}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section panel">
        <h3>Support</h3>
        <p className="muted" style={{ lineHeight: 1.7 }}>
          WhatsApp support: <a href={LINKS.whatsapp} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-1)', fontWeight: 700 }}>{LINKS.phoneDisplay}</a><br />
          <a href={LINKS.whatsappChannel} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-1)' }}>WhatsApp Channel</a> ·{' '}
          <a href={LINKS.whatsappGroup} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-1)' }}>WhatsApp Group</a> ·{' '}
          <a href={LINKS.smm} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-1)' }}>manansmm.com</a> ·{' '}
          <a href={LINKS.store} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-1)' }}>Online Store</a>
        </p>
      </div>
    </div>
  );
}
