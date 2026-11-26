import { useState } from 'react';
import { postsApi, ApiError, projectsApi, downloadFile, toCsv } from '../lib/api';
import type { PostVariation } from '../lib/api';
import { saveGuestProject } from '../lib/guestProjects';
import { useAuth } from '../lib/auth';

const PLATFORMS = ['YouTube', 'Shorts', 'Facebook', 'Instagram', 'TikTok'] as const;
type DraftStatus = 'draft' | 'planned' | 'published';

export default function Posts() {
  const [topic, setTopic] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['YouTube', 'TikTok']);
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState('exciting');
  const [variations, setVariations] = useState<PostVariation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [statuses, setStatuses] = useState<Record<string, DraftStatus>>({});
  const [edited, setEdited] = useState<Record<string, string>>({});
  const { user } = useAuth();

  const togglePlatform = (p: string) =>
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const generate = async () => {
    if (!topic.trim()) { setError('Enter a topic first.'); return; }
    if (!platforms.length) { setError('Select at least one platform.'); return; }
    setLoading(true); setError(''); setNotice(''); setVariations([]);
    try {
      const res = await postsApi.generate({ topic: topic.trim(), platforms, language, tone });
      setVariations(res.variations || []);
      if (!res.variations?.length) setError('No variations were returned.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not generate posts.');
    } finally { setLoading(false); }
  };

  const captionOf = (v: PostVariation, i: number) => edited[`${v.platform}-${i}`] ?? v.caption;

  const saveAll = async () => {
    if (!variations.length) return;
    const data = { topic, platforms, language, tone, variations: variations.map((v, i) => ({ ...v, caption: captionOf(v, i), status: statuses[`${v.platform}-${i}`] || 'draft' })) };
    try {
      if (user) await projectsApi.create({ type: 'posts', title: `Posts — ${topic}`, data });
      else saveGuestProject({ type: 'posts', title: `Posts — ${topic}`, data });
      setNotice(user ? 'Saved to My Projects.' : 'Saved on this device (guest library). Log in to sync it to your account.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the posts.');
    }
  };

  const exportTxt = () => {
    const body = variations.map((v, i) => {
      const s = statuses[`${v.platform}-${i}`] || 'draft';
      return `--- ${v.platform} [${s}] ---\n${v.title ? `Title: ${v.title}\n` : ''}${captionOf(v, i)}\n${v.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`;
    }).join('\n\n');
    downloadFile('posts.txt', body);
  };
  const exportCsv = () => {
    downloadFile('posts.csv', toCsv(variations.map((v, i) => ({
      platform: v.platform, title: v.title || '', caption: captionOf(v, i),
      hashtags: v.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' '),
      status: statuses[`${v.platform}-${i}`] || 'draft',
    }))), 'text/csv');
  };

  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>Manan Multi-Platform Post Maker</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>One topic, tailored posts for every platform. This tool drafts content only — it does not publish anywhere. Publishing needs an authorized integration, which is not connected.</p>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="field"><label htmlFor="pm-topic">Topic</label>
          <input id="pm-topic" className="input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. GTA 6 map guide — 5 places to visit first" />
        </div>
        <div className="field"><label>Platforms</label>
          <div className="pill-select">
            {PLATFORMS.map(p => (
              <button key={p} type="button" className={`pill${platforms.includes(p) ? ' active' : ''}`} onClick={() => togglePlatform(p)}>{p}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="pm-lang">Language</label>
            <select id="pm-lang" className="select" value={language} onChange={e => setLanguage(e.target.value)}>
              <option>English</option><option>Urdu</option><option>Roman Urdu</option>
            </select>
          </div>
          <div className="field"><label htmlFor="pm-tone">Tone</label>
            <select id="pm-tone" className="select" value={tone} onChange={e => setTone(e.target.value)}>
              <option value="exciting">Exciting</option>
              <option value="informative">Informative</option>
              <option value="funny">Funny</option>
              <option value="curious">Curious / click-worthy</option>
              <option value="calm">Calm</option>
            </select>
          </div>
        </div>
        <button className="btn" type="button" onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate posts →'}</button>
        {error && <div className="notice notice-err">{error}</div>}
        {notice && <div className="notice notice-ok">{notice}</div>}
      </div>

      {variations.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div><h2>Variations ({variations.length})</h2><p>Edit any caption, set its status, then save or export.</p></div>
            <div className="btn-row">
              <button className="btn btn-ghost btn-sm" type="button" onClick={exportTxt}>Export TXT</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={exportCsv}>Export CSV</button>
              <button className="btn btn-sm" type="button" onClick={saveAll}>Save to My Projects</button>
            </div>
          </div>
          <div className="grid">
            {variations.map((v, i) => {
              const key = `${v.platform}-${i}`;
              return (
                <div className="card" key={key}>
                  <div className="tool-meta"><span className="tag">{v.platform}</span>
                    <select className="select" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} value={statuses[key] || 'draft'} onChange={e => setStatuses(prev => ({ ...prev, [key]: e.target.value as DraftStatus }))} aria-label={`Status for ${v.platform} post`}>
                      <option value="draft">Draft</option>
                      <option value="planned">Planned</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                  {v.title && <h3 style={{ marginBottom: 8 }}>{v.title}</h3>}
                  {v.hooks && v.hooks.length > 0 && <p className="small muted">Hook: {v.hooks[0]}</p>}
                  <textarea className="textarea" style={{ minHeight: 130 }} value={captionOf(v, i)} onChange={e => setEdited(prev => ({ ...prev, [key]: e.target.value }))} aria-label={`Caption for ${v.platform}`} />
                  <p className="small" style={{ color: 'var(--accent-1)', margin: '10px 0' }}>{v.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}</p>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(`${v.title ? v.title + '\n' : ''}${captionOf(v, i)}\n${v.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`)}>Copy post</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
