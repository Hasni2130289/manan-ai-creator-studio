import { useState } from 'react';
import { researchApi, ApiError, downloadFile, toCsv, formatViews } from '../lib/api';
import type { ResearchResult, Idea } from '../lib/api';
import { projectsApi } from '../lib/api';
import { saveGuestProject } from '../lib/guestProjects';
import { useAuth } from '../lib/auth';

type SortKey = 'views' | 'date' | 'title';

export default function Research() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [setup, setSetup] = useState<{ provider?: string; envVar?: string; message?: string } | null>(null);
  const [sort, setSort] = useState<SortKey>('views');
  const [minViews, setMinViews] = useState('');
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasSource, setIdeasSource] = useState('');
  const [ideasLoading, setIdeasLoading] = useState(false);
  const { user } = useAuth();

  const search = async () => {
    if (!query.trim()) { setError('Enter a topic, keyword or YouTube URL first.'); return; }
    setLoading(true); setError(''); setSetup(null);
    try {
      const res = await researchApi.search(query.trim());
      if (res.setupRequired) {
        setSetup({ provider: res.provider, envVar: res.envVar, message: res.message });
        setResults([]);
      } else {
        setResults(res.results || []);
        if (!res.results?.length) setError('No results returned for that search.');
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('Please log in first — search needs an account. Go to Login, sign in, then try again.');
      } else {
        setError(e instanceof ApiError ? e.message : 'Search failed. Please try again.');
      }
    } finally { setLoading(false); }
  };

  const visible = [...results]
    .filter(r => !minViews || r.views >= Number(minViews))
    .sort((a, b) => sort === 'views' ? b.views - a.views : sort === 'date' ? +new Date(b.publishedAt) - +new Date(a.publishedAt) : a.title.localeCompare(b.title));

  const saveResult = async (r: ResearchResult) => {
    const data = { videoId: r.videoId, title: r.title, channelTitle: r.channelTitle, url: r.url, views: r.views, publishedAt: r.publishedAt };
    try {
      if (user) await projectsApi.create({ type: 'research', title: r.title, data });
      else saveGuestProject({ type: 'research', title: r.title, data });
      setSaved(prev => new Set(prev).add(r.videoId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that result.');
    }
  };

  const exportCsv = () => downloadFile('viral-research.csv', toCsv(visible.map(r => ({ title: r.title, channel: r.channelTitle, views: r.views, published: r.publishedAt, url: r.url }))), 'text/csv');
  const exportJson = () => downloadFile('viral-research.json', JSON.stringify(visible, null, 2), 'application/json');

  const generateIdeas = async () => {
    if (!topic.trim()) return;
    setIdeasLoading(true);
    try {
      const res = await researchApi.ideas(topic.trim());
      setIdeas(res.ideas || []);
      setIdeasSource(res.source);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not generate ideas.');
    } finally { setIdeasLoading(false); }
  };

  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>Manan Viral Research</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>Search any topic, keyword or YouTube URL to find trending videos and what makes them work.</p>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="row">
          <div style={{ flex: 3 }}>
            <div className="field">
              <label htmlFor="rq">Topic, keyword or YouTube URL</label>
              <input id="rq" className="input" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(); }} placeholder="e.g. GTA 6 map guide, or paste a YouTube link" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn" type="button" onClick={search} disabled={loading}>{loading ? 'Searching…' : 'Search →'}</button>
          </div>
        </div>
        {error && <div className="notice notice-err"><b>Search failed</b>{error}</div>}
        {setup && (
          <div className="notice notice-warn">
            <b>Setup required — no results yet</b>
            {setup.message || 'Viral Research needs a provider key before it can search YouTube.'}
            {setup.provider && <><br />Provider: {setup.provider}</>}
            {setup.envVar && <><br />Environment variable: <code>{setup.envVar}</code></>}
            <br />Ask the studio owner to configure it — see the <a href="/settings" style={{ color: 'var(--accent-1)', fontWeight: 700 }}>Settings page</a> for setup instructions. Nothing here is made up: no results are shown until the provider is connected.
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="section">
          <div className="section-head">
            <div><h2>Results ({visible.length})</h2><p>Sorted by {sort === 'views' ? 'most views' : sort === 'date' ? 'newest' : 'title'}.</p></div>
            <div className="btn-row">
              <button className="btn btn-ghost btn-sm" type="button" onClick={exportCsv}>Export CSV</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={exportJson}>Export JSON</button>
            </div>
          </div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="sort">Sort by</label>
                <select id="sort" className="select" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                  <option value="views">Most views</option>
                  <option value="date">Newest</option>
                  <option value="title">Title A–Z</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="minv">Minimum views</label>
                <input id="minv" className="input" type="number" min={0} value={minViews} onChange={e => setMinViews(e.target.value)} placeholder="e.g. 10000" />
              </div>
            </div>
          </div>
          <div className="panel" style={{ padding: '6px 22px' }}>
            {visible.map(r => (
              <div className="list-item" key={r.videoId}>
                {r.thumbnail && <img className="thumb" src={r.thumbnail} alt="" loading="lazy" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a></h4>
                  <div className="meta">{r.channelTitle} · {formatViews(r.views)} · {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : ''}</div>
                </div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => saveResult(r)} disabled={saved.has(r.videoId)}>
                  {saved.has(r.videoId) ? '✓ Saved' : 'Save to board'}
                </button>
              </div>
            ))}
            {visible.length === 0 && <div className="empty">No results match the current filter.</div>}
          </div>
        </div>
      )}

      <div className="section panel">
        <h3>Title &amp; Hook Idea Generator</h3>
        <p className="hint">Get title and hook ideas for a topic. Ideas come from the AI provider when configured, otherwise from built-in templates — the source is always labelled.</p>
        <div className="row">
          <div style={{ flex: 3 }}>
            <input className="input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. best GTA 6 cars" aria-label="Topic for ideas" />
          </div>
          <button className="btn" type="button" onClick={generateIdeas} disabled={ideasLoading || !topic.trim()}>{ideasLoading ? 'Generating…' : 'Generate ideas'}</button>
        </div>
        {ideas.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p className="small muted">Source: <b>{ideasSource === 'ai' ? 'AI provider' : 'Built-in templates'}</b></p>
            {ideas.map((idea, i) => (
              <div className="list-item" key={i}>
                <span style={{ fontSize: 20 }}>💡</span>
                <div style={{ flex: 1 }}>
                  <h4>{idea.title}</h4>
                  <div className="meta">Hook: {idea.hook}</div>
                </div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(`${idea.title} — ${idea.hook}`)}>Copy</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
