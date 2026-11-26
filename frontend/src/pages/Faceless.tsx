import { useEffect, useRef, useState } from 'react';
import { videosApi, ApiError, api } from '../lib/api';
import type { VideoJob } from '../lib/api';

const STEPS = ['Topic & script', 'Format', 'Language & voice', 'Narration', 'Visuals', 'Captions', 'Storyboard', 'Render', 'Download'];

export default function Faceless() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [format, setFormat] = useState<'vertical' | 'horizontal'>('vertical');
  const [language, setLanguage] = useState('English');
  const [voice, setVoice] = useState('default');
  const [narration, setNarration] = useState('');
  const [visuals, setVisuals] = useState('');
  const [captions, setCaptions] = useState(true);
  const [job, setJob] = useState<VideoJob | null>(null);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    videosApi.listJobs().then(setJobs).catch(() => { /* jobs list is optional */ });
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, []);

  const startPolling = (id: string) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const updated = await videosApi.getJob(id);
        setJob(updated);
        if (updated.status === 'done' || updated.status === 'failed' || updated.status === 'error') {
          if (pollRef.current) window.clearInterval(pollRef.current);
        }
      } catch { /* keep polling until the next tick; a failed poll is not a failed job */ }
    }, 3000);
  };

  const render = async () => {
    if (!title.trim() || !script.trim()) { setError('Add a title and a script first (step 1).'); setStep(0); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const created = await videosApi.createJob({ title: title.trim(), script, format, language, voice });
      setJob(created);
      setJobs(prev => [created, ...prev]);
      setStep(7);
      startPolling(created.id);
      setNotice('Render job started. Progress updates below — the download button appears only when the server reports the video as done.');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not start the render job.';
      setError(msg);
      if (e instanceof ApiError && e.payload && typeof e.payload === 'object') {
        const p = e.payload as Record<string, unknown>;
        if (p.message) setError(String(p.message));
      }
    } finally { setLoading(false); }
  };

  const resumeJob = (j: VideoJob) => {
    setJob(j);
    setTitle(j.title || title);
    if (j.status !== 'done' && j.status !== 'failed' && j.status !== 'error') startPolling(j.id);
    setStep(7);
  };

  const progress = job?.progress ?? 0;
  const done = job?.status === 'done';
  const failed = job?.status === 'failed' || job?.status === 'error';
  const downloadHref = job ? api.downloadUrl(`/videos/jobs/${job.id}/download`) : '';

  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>Manan Faceless Video Maker</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>Build a faceless video step by step. Nothing is faked: the download button only appears when the server reports a finished video file.</p>

      <div className="steps" style={{ marginTop: 20 }}>
        {STEPS.map((s, i) => (
          <button key={s} type="button" className={`step${i === step ? ' on' : ''}${i < step ? ' done' : ''}`} onClick={() => setStep(i)}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {error && <div className="notice notice-err"><b>Render could not start</b>{error}</div>}
      {notice && <div className="notice notice-ok">{notice}</div>}

      {step === 0 && (
        <div className="panel">
          <h3>Step 1 · Topic &amp; script</h3>
          <div className="field"><label htmlFor="fv-title">Video title / topic</label><input id="fv-title" className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. The forest that whispers at night" /></div>
          <div className="field"><label htmlFor="fv-script">Script</label><textarea id="fv-script" className="textarea" style={{ minHeight: 200 }} value={script} onChange={e => setScript(e.target.value)} placeholder="Write or paste the narration script here…" /></div>
          <button className="btn" type="button" onClick={() => setStep(1)} disabled={!title.trim() || !script.trim()}>Next: Format →</button>
        </div>
      )}
      {step === 1 && (
        <div className="panel">
          <h3>Step 2 · Format</h3>
          <div className="pill-select">
            <button type="button" className={`pill${format === 'vertical' ? ' active' : ''}`} onClick={() => setFormat('vertical')}>📱 Vertical 9:16 — Shorts / Reels / TikTok</button>
            <button type="button" className={`pill${format === 'horizontal' ? ' active' : ''}`} onClick={() => setFormat('horizontal')}>🖥️ Horizontal 16:9 — YouTube</button>
          </div>
          <div className="btn-row" style={{ marginTop: 18 }}>
            <button className="btn btn-ghost" type="button" onClick={() => setStep(0)}>← Back</button>
            <button className="btn" type="button" onClick={() => setStep(2)}>Next: Language &amp; voice →</button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="panel">
          <h3>Step 3 · Language &amp; voice</h3>
          <div className="row">
            <div className="field"><label htmlFor="fv-lang">Language</label>
              <select id="fv-lang" className="select" value={language} onChange={e => setLanguage(e.target.value)}>
                <option>English</option><option>Urdu</option><option>Roman Urdu</option>
              </select>
            </div>
            <div className="field"><label htmlFor="fv-voice">Voice</label>
              <select id="fv-voice" className="select" value={voice} onChange={e => setVoice(e.target.value)}>
                <option value="default">Default narrator</option>
                <option value="male-deep">Male — deep</option>
                <option value="female-warm">Female — warm</option>
                <option value="male-energetic">Male — energetic</option>
              </select>
            </div>
          </div>
          <p className="small muted">The exact voices available depend on the narration provider configured on the server (see Settings). If none is configured, the render job will report the missing requirement instead of producing audio.</p>
          <div className="btn-row">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>← Back</button>
            <button className="btn" type="button" onClick={() => setStep(3)}>Next: Narration →</button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="panel">
          <h3>Step 4 · Narration</h3>
          <div className="field"><label htmlFor="fv-narr">Narration notes (optional)</label><textarea id="fv-narr" className="textarea" value={narration} onChange={e => setNarration(e.target.value)} placeholder="e.g. Slow, calm bedtime-story pace. Pause after each scene." /></div>
          <p className="small muted">Narration is generated from your script in step 1, in the language and voice chosen in step 3.</p>
          <div className="btn-row">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(2)}>← Back</button>
            <button className="btn" type="button" onClick={() => setStep(4)}>Next: Visuals →</button>
          </div>
        </div>
      )}
      {step === 4 && (
        <div className="panel">
          <h3>Step 5 · Visuals</h3>
          <div className="field"><label htmlFor="fv-vis">Visual style / scene notes (optional)</label><textarea id="fv-vis" className="textarea" value={visuals} onChange={e => setVisuals(e.target.value)} placeholder="e.g. Dark pine forest at night, fog, a single lantern, cinematic." /></div>
          <div className="btn-row">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(3)}>← Back</button>
            <button className="btn" type="button" onClick={() => setStep(5)}>Next: Captions →</button>
          </div>
        </div>
      )}
      {step === 5 && (
        <div className="panel">
          <h3>Step 6 · Captions</h3>
          <div className="field">
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text)' }}>
              <input type="checkbox" checked={captions} onChange={e => setCaptions(e.target.checked)} style={{ width: 20, height: 20 }} />
              Burn captions into the video
            </label>
          </div>
          <div className="btn-row">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(4)}>← Back</button>
            <button className="btn" type="button" onClick={() => setStep(6)}>Next: Storyboard →</button>
          </div>
        </div>
      )}
      {step === 6 && (
        <div className="panel">
          <h3>Step 7 · Storyboard preview</h3>
          <div className="kv"><span>Title</span><b>{title || '—'}</b></div>
          <div className="kv"><span>Format</span><b>{format === 'vertical' ? 'Vertical 9:16' : 'Horizontal 16:9'}</b></div>
          <div className="kv"><span>Language</span><b>{language}</b></div>
          <div className="kv"><span>Voice</span><b>{voice}</b></div>
          <div className="kv"><span>Captions</span><b>{captions ? 'On' : 'Off'}</b></div>
          <div className="kv"><span>Script</span><b>{script.length.toLocaleString()} characters</b></div>
          <p className="muted" style={{ lineHeight: 1.6, marginTop: 14 }}>{script.slice(0, 400)}{script.length > 400 ? '…' : ''}</p>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" type="button" onClick={() => setStep(5)}>← Back</button>
            <button className="btn" type="button" onClick={render} disabled={loading}>{loading ? 'Starting render…' : '🎬 Start render'}</button>
          </div>
        </div>
      )}
      {step >= 7 && (
        <div className="panel">
          <h3>Step 8 · Render progress</h3>
          {job ? (
            <>
              <p style={{ lineHeight: 1.6 }}>Job <b>{job.id}</b> — status: <b>{job.status}</b>{job.message ? ` — ${job.message}` : ''}{job.error ? ` — ${job.error}` : ''}</p>
              <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>{progress}% — updates every few seconds while rendering.</p>
              {done && (
                <div className="notice notice-ok"><b>Video ready</b>The server reports this job as done with a real file.</div>
              )}
              {failed && (
                <div className="notice notice-err"><b>Render failed</b>{job.error || job.message || 'The server reported a failure. Check Settings for the missing provider or dependency.'}</div>
              )}
              <div className="btn-row" style={{ marginTop: 14 }}>
                {done ? (
                  <a className="btn" href={downloadHref}>⬇ Download video</a>
                ) : (
                  <button className="btn" type="button" disabled>{failed ? 'No video to download' : 'Rendering… download appears when done'}</button>
                )}
                <button className="btn btn-ghost" type="button" onClick={() => { setJob(null); setStep(0); }}>Start a new video</button>
              </div>
            </>
          ) : (
            <p className="muted">No render job yet. Go back to the storyboard and start a render.</p>
          )}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="section panel">
          <h3>Your render jobs</h3>
          {jobs.map(j => (
            <div className="list-item" key={j.id}>
              <span style={{ fontSize: 20 }}>🎬</span>
              <div style={{ flex: 1 }}>
                <h4>{j.title || j.id}</h4>
                <div className="meta">Status: {j.status}{typeof j.progress === 'number' ? ` · ${j.progress}%` : ''}</div>
              </div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => resumeJob(j)}>View</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
