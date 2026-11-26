import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolCard from '../components/ToolCard';
import { CATEGORIES, LINKS, TOOLS } from '../lib/tools';
import { loadFavourites } from '../lib/guestProjects';
import { loadGuestProjects } from '../lib/guestProjects';
import { projectsApi, ApiError } from '../lib/api';
import type { Project } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Dashboard({ searchQuery }: { searchQuery: string }) {
  const [category, setCategory] = useState<string>('All');
  const [localQuery, setLocalQuery] = useState('');
  const [recent, setRecent] = useState<Project[]>([]);
  const [recentSource, setRecentSource] = useState<'account' | 'device'>('device');
  const { user } = useAuth();
  const query = (searchQuery || localQuery).trim().toLowerCase();

  useEffect(() => {
    let cancelled = false;
    if (user) {
      projectsApi.list()
        .then(list => { if (!cancelled) { setRecent(list.slice(0, 5)); setRecentSource('account'); } })
        .catch(() => { if (!cancelled) { setRecent(loadGuestProjects().slice(0, 5)); setRecentSource('device'); } });
    } else {
      setRecent(loadGuestProjects().slice(0, 5));
      setRecentSource('device');
    }
    return () => { cancelled = true; };
  }, [user]);

  const filtered = useMemo(() => {
    let list = TOOLS;
    if (category !== 'All') {
      if (category === 'My Projects') return list;
      if (category === 'Account & Settings') return list;
      list = list.filter(t => t.category === category);
    }
    if (query) {
      list = list.filter(t =>
        `${t.name} ${t.description} ${t.category} ${t.short}`.toLowerCase().includes(query));
    }
    return list;
  }, [category, query]);

  const featured = useMemo(() => {
    const favs = loadFavourites();
    const favTools = TOOLS.filter(t => favs.includes(t.id));
    const rest = TOOLS.filter(t => !favs.includes(t.id));
    return [...favTools, ...rest].slice(0, 3);
  }, []);

  const goCategory = (c: string) => {
    if (c === 'My Projects') { window.location.hash = ''; document.getElementById('all-tools')?.scrollIntoView(); }
    setCategory(c);
  };

  return (
    <div>
      <section className="hero">
        <h1>Create More.<br /><span className="grad">Grow Faster.</span></h1>
        <p>AI-powered tools for research, thumbnails, scripts, videos and social media — all in one place, by Manan Automation.</p>
        <div className="hero-actions">
          <Link className="btn" to="/tools/research">Start Researching →</Link>
          <Link className="btn btn-ghost" to="/tools/thumbnails">Make a Thumbnail</Link>
          <a className="btn btn-green" href={LINKS.whatsapp} target="_blank" rel="noreferrer">💬 WhatsApp Support</a>
        </div>
        <div className="chips" role="tablist" aria-label="Filter tools by category">
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              className={`chip${category === c ? ' active' : ''}`}
              onClick={() => {
                if (c === 'My Projects') window.location.href = '/projects';
                else if (c === 'Account & Settings') window.location.href = '/settings';
                else goCategory(c);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div><h2>Featured Tools</h2><p>Your favourites first — tap the star on any tool to pin it here.</p></div>
        </div>
        <div className="grid">
          {featured.map(t => <ToolCard key={t.id} tool={t} />)}
        </div>
      </section>

      <section className="section" id="all-tools">
        <div className="section-head">
          <div>
            <h2>{category === 'All' ? 'All Tools' : category}</h2>
            <p>{filtered.length} tool{filtered.length === 1 ? '' : 's'}{query ? ` matching “${query}”` : ''}</p>
          </div>
          <input
            className="input"
            style={{ maxWidth: 260 }}
            value={localQuery}
            onChange={e => setLocalQuery(e.target.value)}
            placeholder="Filter tools…"
            aria-label="Filter tools"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="panel empty">No tools match that search. Try another keyword, or clear the category filter.</div>
        ) : (
          <div className="grid">
            {filtered.map(t => <ToolCard key={t.id} tool={t} />)}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Recent Projects</h2>
            <p>{recentSource === 'account' ? 'From your account.' : 'Saved on this device (log in to sync projects to your account).'}</p>
          </div>
          <Link className="btn btn-ghost btn-sm" to="/projects">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="panel empty">No projects yet. Open any tool and save your first project — it will show up here.</div>
        ) : (
          <div className="panel" style={{ padding: '6px 22px' }}>
            {recent.map(p => (
              <div className="list-item" key={p.id}>
                <span style={{ fontSize: 22 }}>📁</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4><Link to="/projects">{p.title}</Link></h4>
                  <div className="meta">{p.type} · {new Date(p.updatedAt).toLocaleString()}</div>
                </div>
                <Link className="btn btn-ghost btn-sm" to="/projects">Open</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><div><h2>Quick Start</h2><p>New here? Do this in order.</p></div></div>
        <div className="grid">
          <div className="card"><h3>1 · Research a topic</h3><p className="muted">Find what is already working before you create anything.</p><Link className="btn btn-ghost btn-sm" to="/tools/research">Open Research →</Link></div>
          <div className="card"><h3>2 · Write the script</h3><p className="muted">Turn a video or transcript into a script with hooks and CTAs.</p><Link className="btn btn-ghost btn-sm" to="/tools/scripts">Open Scripts →</Link></div>
          <div className="card"><h3>3 · Design the thumbnail</h3><p className="muted">Make the thumbnail that earns the click, then export it as PNG.</p><Link className="btn btn-ghost btn-sm" to="/tools/thumbnails">Open Thumbnails →</Link></div>
          <div className="card"><h3>4 · Clip &amp; post everywhere</h3><p className="muted">Clip the long video, then generate a post for every platform.</p><Link className="btn btn-ghost btn-sm" to="/tools/posts">Open Post Maker →</Link></div>
        </div>
      </section>
    </div>
  );
}
