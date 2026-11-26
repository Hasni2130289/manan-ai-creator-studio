import { useEffect, useRef, useState } from 'react';
import { thumbnailsApi, ApiError, projectsApi } from '../lib/api';
import { saveGuestProject } from '../lib/guestProjects';
import { useAuth } from '../lib/auth';

const STYLES = ['gaming', 'storytelling', 'documentary', 'education'] as const;
const BG_COLORS: Record<string, string> = {
  gaming: '#1a0b2e', storytelling: '#0b1a2e', documentary: '#1a1a1a', education: '#0b2e1a',
};

export default function Thumbnails() {
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState<string>('gaming');
  const [text, setText] = useState('YOUR TITLE HERE');
  const [fontSize, setFontSize] = useState(72);
  const [textColor, setTextColor] = useState('#ffffff');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [posY, setPosY] = useState(50);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgName, setBgName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [styleNotes, setStyleNotes] = useState('');
  const [genImage, setGenImage] = useState('');
  const [setup, setSetup] = useState<{ provider?: string; envVar?: string; message?: string } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useAuth();

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 1280; canvas.height = 720;
    if (bgImage) {
      const scale = Math.max(canvas.width / bgImage.width, canvas.height / bgImage.height);
      const w = bgImage.width * scale, h = bgImage.height * scale;
      ctx.drawImage(bgImage, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, BG_COLORS[style] || '#1a0b2e');
      grad.addColorStop(1, '#0a0a0b');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = 'rgba(255,122,0,0.18)';
      ctx.beginPath(); ctx.arc(1080, 120, 180, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = `900 ${fontSize}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(6, fontSize / 9);
    ctx.strokeStyle = strokeColor;
    const lines = text.split('\n');
    const lineHeight = fontSize * 1.08;
    const startY = (posY / 100) * 720 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      ctx.strokeText(line, 640, y);
      ctx.fillStyle = textColor;
      ctx.fillText(line, 640, y);
    });
  };

  useEffect(() => { draw(); });

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setBgImage(img); setBgName(file.name); };
    img.onerror = () => setError('That image could not be loaded. Try a JPG or PNG file.');
    img.src = url;
  };

  const exportImage = (format: 'png' | 'jpeg') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    draw();
    const url = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thumbnail-${style}.${format === 'png' ? 'png' : 'jpg'}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const generatePrompt = async () => {
    if (!topic.trim() && !title.trim()) { setError('Enter a topic or a title first.'); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const res = await thumbnailsApi.prompt({ topic: topic.trim(), title: title.trim() || text, style });
      setPrompt(res.prompt);
      setStyleNotes(res.styleNotes || '');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not generate a prompt.');
    } finally { setLoading(false); }
  };

  const generateImage = async () => {
    if (!prompt) { setError('Generate a prompt first, then try image generation.'); return; }
    setLoading(true); setError(''); setSetup(null);
    try {
      const res = await thumbnailsApi.generate({ prompt, style });
      if (res.setupRequired) {
        setSetup({ provider: res.provider, envVar: res.envVar, message: res.message });
      } else if (res.imageUrl) {
        setGenImage(res.imageUrl);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setBgImage(img);
        img.src = res.imageUrl;
      } else {
        setError('The image service returned no image.');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Image generation failed.');
    } finally { setLoading(false); }
  };

  const saveProject = async () => {
    const data = { topic, title: title || text, style, text, fontSize, textColor, prompt };
    try {
      if (user) await projectsApi.create({ type: 'thumbnail', title: title || text || 'Untitled thumbnail', data });
      else saveGuestProject({ type: 'thumbnail', title: title || text || 'Untitled thumbnail', data });
      setNotice(user ? 'Saved to My Projects.' : 'Saved on this device (guest library). Log in to sync it to your account.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the thumbnail project.');
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>Manan AI Thumbnail Maker</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>Design the thumbnail on the canvas — it works fully offline. Prompt generation always works; AI image generation needs a provider key (see Settings).</p>

      <div className="section panel">
        <h3>1 · Topic &amp; style</h3>
        <div className="row">
          <div className="field"><label htmlFor="tt-topic">Topic</label><input id="tt-topic" className="input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. GTA 6 map guide" /></div>
          <div className="field"><label htmlFor="tt-title">Video title</label><input id="tt-title" className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. GTA 6 Map Guide" /></div>
        </div>
        <div className="field">
          <label>Style preset</label>
          <div className="pill-select">
            {STYLES.map(s => (
              <button key={s} type="button" className={`pill${style === s ? ' active' : ''}`} onClick={() => setStyle(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
        </div>
        <div className="btn-row">
          <button className="btn" type="button" onClick={generatePrompt} disabled={loading}>{loading ? 'Working…' : 'Generate prompt'}</button>
          <button className="btn btn-ghost" type="button" onClick={generateImage} disabled={loading || !prompt}>Generate image with AI</button>
        </div>
        {prompt && (
          <div style={{ marginTop: 16 }}>
            <div className="field"><label>Generated prompt</label><textarea className="textarea" readOnly value={prompt} /></div>
            {styleNotes && <p className="small muted">{styleNotes}</p>}
            <div className="btn-row"><button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(prompt)}>Copy prompt</button></div>
          </div>
        )}
        {setup && (
          <div className="notice notice-warn">
            <b>Image generation needs setup</b>
            {setup.message || 'No image provider is configured yet.'}
            {setup.provider && <><br />Provider: {setup.provider}</>}
            {setup.envVar && <><br />Environment variable: <code>{setup.envVar}</code></>}
            <br />Prompt generation above still works — paste the prompt into any image tool. See <a href="/settings" style={{ color: 'var(--accent-1)', fontWeight: 700 }}>Settings</a> for setup instructions.
          </div>
        )}
        {genImage && <p className="small muted" style={{ marginTop: 12 }}>AI image loaded onto the canvas: <a href={genImage} target="_blank" rel="noreferrer">view original</a></p>}
      </div>

      <div className="section panel">
        <h3>2 · Canvas editor</h3>
        <p className="hint">Upload a background image, type your thumbnail text, and adjust size, colours and position. Preview updates live; export downloads a real 1280×720 file.</p>
        {error && <div className="notice notice-err">{error}</div>}
        {notice && <div className="notice notice-ok">{notice}</div>}
        <div className="canvas-wrap">
          <div style={{ flex: '1 1 520px', minWidth: 280 }}>
            <canvas ref={canvasRef} className="thumb-canvas" width={1280} height={720} aria-label="Thumbnail preview canvas" />
            <p className="small muted" style={{ marginTop: 8 }}>{bgName ? `Background: ${bgName}` : 'Background: style gradient (upload an image to replace it).'}</p>
          </div>
          <div style={{ flex: '1 1 260px', minWidth: 240 }}>
            <div className="field">
              <label htmlFor="tt-bg">Background image</label>
              <input id="tt-bg" type="file" accept="image/*" onChange={e => onUpload(e.target.files?.[0])} />
            </div>
            <div className="field">
              <label htmlFor="tt-text">Thumbnail text (one line per row)</label>
              <textarea id="tt-text" className="textarea" style={{ minHeight: 80 }} value={text} onChange={e => setText(e.target.value)} />
            </div>
            <div className="field"><label htmlFor="tt-size">Text size: {fontSize}px</label>
              <input id="tt-size" type="range" min={28} max={140} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div className="row">
              <div className="field"><label htmlFor="tt-col">Text colour</label><input id="tt-col" type="color" value={textColor} onChange={e => setTextColor(e.target.value)} style={{ width: '100%', height: 42, background: 'var(--bg-soft)', border: '1px solid var(--border-strong)', borderRadius: 10 }} /></div>
              <div className="field"><label htmlFor="tt-stroke">Outline colour</label><input id="tt-stroke" type="color" value={strokeColor} onChange={e => setStrokeColor(e.target.value)} style={{ width: '100%', height: 42, background: 'var(--bg-soft)', border: '1px solid var(--border-strong)', borderRadius: 10 }} /></div>
            </div>
            <div className="field"><label htmlFor="tt-pos">Vertical position: {posY}%</label>
              <input id="tt-pos" type="range" min={10} max={90} value={posY} onChange={e => setPosY(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div className="btn-row">
              <button className="btn btn-sm" type="button" onClick={() => exportImage('png')}>Export PNG</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => exportImage('jpeg')}>Export JPEG</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={saveProject}>Save to My Projects</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
