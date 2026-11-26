import { useEffect, useState } from 'react';
import { metaApi, ApiError } from '../lib/api';
import type { HealthResponse } from '../lib/api';
import { LINKS } from '../lib/tools';

export default function Clipping() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    metaApi.health()
      .then(h => { if (!cancelled) setHealth(h); })
      .catch(e => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not reach the studio server.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const clipStatus = health?.clippingTool?.status || 'unknown';
  const clipUrl = health?.clippingTool?.url || LINKS.clippingTool;

  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>Manan Clipping Tool</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>
        This is the existing live Manan Clipping Tool — it is <b style={{ color: 'var(--text)' }}>not rebuilt here</b>.
        It opens in a new tab, in its own app, with its own login. This studio never asks for or stores its password.
      </p>

      <div className="panel" style={{ marginTop: 20, textAlign: 'center', padding: '34px 22px' }}>
        <div style={{ fontSize: 52 }} aria-hidden="true">✂️</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>Clip long videos into viral Shorts</h2>
        <p className="muted" style={{ maxWidth: 560, margin: '10px auto 0', lineHeight: 1.65 }}>
          Upload or paste a video link, pick how many clips and how long each one should be,
          and get captioned vertical clips ready for TikTok, Shorts and Reels.
        </p>
        <div style={{ margin: '18px 0' }}>
          {loading ? (
            <span className="tag">Checking live status…</span>
          ) : error ? (
            <span className="status status-setup">Status unknown — studio server unreachable</span>
          ) : (
            <span className={`status ${clipStatus === 'ok' || clipStatus === 'online' || clipStatus === 'live' ? 'status-live' : 'status-setup'}`}>
              {clipStatus === 'ok' || clipStatus === 'online' || clipStatus === 'live' ? '● Live' : `● ${clipStatus}`}
            </span>
          )}
          {health?.version && <span className="tag" style={{ marginLeft: 8 }}>Studio v{health.version}</span>}
        </div>
        {error && <div className="notice notice-err" style={{ textAlign: 'left' }}><b>Could not check status</b>{error} The tool link below still works — it opens the live tool directly.</div>}
        <a className="btn" href={clipUrl} target="_blank" rel="noreferrer" style={{ fontSize: 16, padding: '15px 30px' }}>
          Open Clipping Tool ↗
        </a>
        <p className="small muted" style={{ marginTop: 12 }}>Opens in a new tab: {clipUrl}</p>
      </div>

      <div className="section grid">
        <div className="card"><h3>How it works</h3><p className="muted">1 · Open the tool in a new tab.<br />2 · Log in with the Clipping Tool password.<br />3 · Upload a video or paste a link, choose clip count and length, and download your clips.</p></div>
        <div className="card"><h3>What it does</h3><p className="muted">Auto-clips long videos, adds captions, and exports vertical clips sized for TikTok, YouTube Shorts and Facebook Reels.</p></div>
        <div className="card"><h3>Need help?</h3><p className="muted">Message Manan Automation on WhatsApp and mention “Clipping Tool”.</p><a className="btn btn-green btn-sm" href={LINKS.whatsapp} target="_blank" rel="noreferrer">💬 WhatsApp {LINKS.phoneDisplay}</a></div>
      </div>
    </div>
  );
}
