import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsApi, ApiError } from '../lib/api';
import type { Project } from '../lib/api';
import { loadGuestProjects, updateGuestProject, deleteGuestProject } from '../lib/guestProjects';
import { useAuth } from '../lib/auth';
import { TOOLS } from '../lib/tools';

const TYPE_LABEL: Record<string, string> = {
  research: 'Research', thumbnail: 'Thumbnail', script: 'Script',
  posts: 'Posts', video: 'Faceless video', clipping: 'Clipping',
};

function toolRouteFor(type: string): string {
  const map: Record<string, string> = {
    research: '/tools/research', thumbnail: '/tools/thumbnails', script: '/tools/scripts',
    posts: '/tools/posts', video: '/tools/faceless', clipping: '/tools/clipping',
  };
  return map[type] || '/';
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true); setError('');
    if (user) {
      projectsApi.list()
        .then(setProjects)
        .catch(e => { setError(e instanceof ApiError ? e.message : 'Could not load projects.'); setProjects(loadGuestProjects()); })
        .finally(() => setLoading(false));
    } else {
      setProjects(loadGuestProjects());
      setLoading(false);
    }
  };
  useEffect(load, [user]);

  const types = useMemo(() => [...new Set(projects.map(p => p.type))], [projects]);
  const visible = projects.filter(p =>
    (typeFilter === 'all' || p.type === typeFilter) &&
    (!query.trim() || p.title.toLowerCase().includes(query.toLowerCase())));

  const doRename = async (p: Project) => {
    if (!renameValue.trim()) return;
    try {
      if (user) {
        const updated = await projectsApi.update(p.id, { title: renameValue.trim() });
        setProjects(prev => prev.map(x => x.id === p.id ? updated : x));
      } else {
        const updated = updateGuestProject(p.id, { title: renameValue.trim() });
        if (updated) setProjects(prev => prev.map(x => x.id === p.id ? updated : x));
      }
      setRenaming(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not rename the project.');
    }
  };

  const doDelete = async (p: Project) => {
    try {
      if (user) await projectsApi.remove(p.id);
      else deleteGuestProject(p.id);
      setProjects(prev => prev.filter(x => x.id !== p.id));
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete the project.');
    }
  };

  const reopen = (p: Project) => {
    try { sessionStorage.setItem('macs_reopen_project', JSON.stringify(p)); } catch { /* ignore */ }
    navigate(toolRouteFor(p.type));
  };

  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>My Projects</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>
        {user
          ? `Projects saved to your account (${user.name}).`
          : 'Guest library — saved on this device only. Log in to save projects to your account and open them anywhere.'}
      </p>
      {!user && (
        <div className="notice"><b>Guest library</b>These projects live in this browser only (localStorage). <Link to="/login" style={{ color: 'var(--accent-1)', fontWeight: 700 }}>Log in</Link> or <Link to="/register" style={{ color: 'var(--accent-1)', fontWeight: 700 }}>create an account</Link> to sync them.</div>
      )}
      {error && <div className="notice notice-err">{error}</div>}

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="row">
          <div style={{ flex: 2 }}><input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects…" aria-label="Search projects" /></div>
          <div>
            <select className="select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by type">
              <option value="all">All types</option>
              {types.map(t => <option key={t} value={t}>{TYPE_LABEL[t] || t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="section">
        {loading ? (
          <div className="panel empty">Loading projects…</div>
        ) : visible.length === 0 ? (
          <div className="panel empty">
            {projects.length === 0
              ? 'No projects yet. Open a tool, create something, and save it — it will appear here.'
              : 'No projects match the current search or filter.'}
          </div>
        ) : (
          <div className="grid">
            {visible.map(p => (
              <div className="card" key={p.id}>
                <div className="tool-meta"><span className="tag">{TYPE_LABEL[p.type] || p.type}</span></div>
                {renaming === p.id ? (
                  <div className="row" style={{ marginBottom: 10 }}>
                    <input className="input" value={renameValue} onChange={e => setRenameValue(e.target.value)} aria-label="New project name" />
                    <button className="btn btn-sm" type="button" onClick={() => doRename(p)}>Save</button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setRenaming(null)}>Cancel</button>
                  </div>
                ) : (
                  <h3>{p.title}</h3>
                )}
                <p className="small muted">Updated {new Date(p.updatedAt).toLocaleString()}<br />Created {new Date(p.createdAt).toLocaleDateString()}</p>
                <div className="btn-row">
                  <button className="btn btn-sm" type="button" onClick={() => reopen(p)}>Reopen in tool →</button>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setRenaming(p.id); setRenameValue(p.title); }}>Rename</button>
                  {confirmDelete === p.id ? (
                    <>
                      <button className="btn btn-sm" type="button" onClick={() => doDelete(p)} style={{ background: 'var(--red)', color: '#fff', boxShadow: 'none' }}>Confirm delete</button>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirmDelete(null)}>Keep</button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirmDelete(p.id)}>Delete</button>
                  )}
                </div>
                <p className="small muted" style={{ marginTop: 10 }}>Opens in: {TOOLS.find(t => t.route === toolRouteFor(p.type))?.name || 'its tool'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
