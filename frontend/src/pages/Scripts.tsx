import { useRef, useState } from 'react';
import { scriptsApi, ApiError, projectsApi, downloadFile } from '../lib/api';
import type { ScriptResult } from '../lib/api';
import { saveGuestProject } from '../lib/guestProjects';
import { useAuth } from '../lib/auth';

export default function Scripts() {
  const [inputType, setInputType] = useState<'transcript' | 'url'>('url');
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('en');
  const [length, setLength] = useState('medium');
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [editedScript, setEditedScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const generate = async () => {
    setError(''); setNotice(''); setResult(null);
    if (inputType === 'url' && !url.trim()) { setError('Paste a video URL first.'); return; }
    if (inputType === 'transcript' && !transcript.trim()) { setError('Paste a transcript first, or upload a transcript file.'); return; }
    setLoading(true);
    try {
      const res = await scriptsApi.generate({ inputType, url: url.trim() || undefined, transcript: transcript.trim() || undefined, language, length });
      if ('error' in res) {
        setError(res.message || 'That video could not be analysed.');
      } else {
        setResult(res);
        setEditedScript(res.script);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Script generation failed.');
    } finally { setLoading(false); }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setTranscript(text);
    setInputType('transcript');
    setNotice(`Loaded transcript file “${file.name}” (${text.length.toLocaleString()} characters). Review it below, then generate.`);
  };

  const saveProject = async () => {
    if (!result) return;
    const data = { inputType, url, language, length, summary: result.summary, keyPoints: result.keyPoints, script: editedScript, hooks: result.hooks, ctas: result.ctas };
    try {
      if (user) await projectsApi.create({ type: 'script', title: `Script — ${url || 'pasted transcript'}`, data });
      else saveGuestProject({ type: 'script', title: `Script — ${url || 'pasted transcript'}`, data });
      setNotice(user ? 'Saved to My Projects.' : 'Saved on this device (guest library). Log in to sync it to your account.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the script.');
    }
  };

  const exportTxt = () => {
    if (!result) return;
    const body = [
      `SUMMARY\n${result.summary}`,
      `KEY POINTS\n${result.keyPoints.map(k => `• ${k}`).join('\n')}`,
      `SCRIPT\n${editedScript}`,
      `HOOKS\n${result.hooks.map(h => `• ${h}`).join('\n')}`,
      `CTAS\n${result.ctas.map(c => `• ${c}`).join('\n')}`,
    ].join('\n\n');
    downloadFile('script.txt', body);
  };

  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>Manan Video-to-Script AI</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>Turn a video into a summary, key points, a full script, hooks and CTAs. If a video cannot be reached, the tool says so — it never pretends to have watched it.</p>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="field">
          <label>Input type</label>
          <div className="pill-select">
            <button type="button" className={`pill${inputType === 'url' ? ' active' : ''}`} onClick={() => setInputType('url')}>Video URL</button>
            <button type="button" className={`pill${inputType === 'transcript' ? ' active' : ''}`} onClick={() => setInputType('transcript')}>Pasted transcript / file</button>
          </div>
        </div>
        {inputType === 'url' ? (
          <div className="field">
            <label htmlFor="sc-url">Video URL</label>
            <input id="sc-url" className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
            <p className="small muted" style={{ marginTop: 6 }}>The backend fetches the video&apos;s transcript. If the video has no public transcript, or it cannot be reached, you will see the exact error — not a made-up script.</p>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="sc-file">Upload a transcript file (.txt / .srt / .vtt)</label>
              <input id="sc-file" ref={fileRef} type="file" accept=".txt,.srt,.vtt" onChange={e => onFile(e.target.files?.[0])} />
            </div>
            <div className="field">
              <label htmlFor="sc-transcript">Or paste the transcript</label>
              <textarea id="sc-transcript" className="textarea" style={{ minHeight: 160 }} value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Paste the video transcript here…" />
            </div>
          </>
        )}
        <div className="row">
          <div className="field">
            <label htmlFor="sc-lang">Language</label>
            <select id="sc-lang" className="select" value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="en">English</option><option value="ur">Urdu</option><option value="roman-ur">Roman Urdu</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sc-len">Script length</label>
            <select id="sc-len" className="select" value={length} onChange={e => setLength(e.target.value)}>
              <option value="short">Short (~2 min)</option>
              <option value="medium">Medium (~5 min)</option>
              <option value="long">Long (~10 min)</option>
            </select>
          </div>
        </div>
        <button className="btn" type="button" onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate script →'}</button>
        {error && <div className="notice notice-err"><b>Could not analyse this video</b>{error}</div>}
        {notice && <div className="notice notice-ok">{notice}</div>}
      </div>

      {result && (
        <div className="section">
          <div className="panel" style={{ marginBottom: 16 }}>
            <h3>Summary</h3>
            <p style={{ lineHeight: 1.65 }}>{result.summary}</p>
            <h3 style={{ marginTop: 18 }}>Key points</h3>
            <ul style={{ lineHeight: 1.7, paddingLeft: 20 }}>{result.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
          </div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <h3>Script <span className="small muted">(editable)</span></h3>
            <textarea className="textarea" style={{ minHeight: 260 }} value={editedScript} onChange={e => setEditedScript(e.target.value)} aria-label="Generated script, editable" />
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(editedScript)}>Copy script</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={exportTxt}>Export TXT</button>
              <button className="btn btn-sm" type="button" onClick={saveProject}>Save to My Projects</button>
            </div>
          </div>
          <div className="grid">
            <div className="panel">
              <h3>Hooks</h3>
              <ul style={{ lineHeight: 1.7, paddingLeft: 20 }}>{result.hooks.map((h, i) => <li key={i}>{h}</li>)}</ul>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(result.hooks.join('\n'))}>Copy hooks</button>
            </div>
            <div className="panel">
              <h3>Calls to action</h3>
              <ul style={{ lineHeight: 1.7, paddingLeft: 20 }}>{result.ctas.map((c, i) => <li key={i}>{c}</li>)}</ul>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(result.ctas.join('\n'))}>Copy CTAs</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
