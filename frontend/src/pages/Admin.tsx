import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, metaApi, ApiError } from '../lib/api';
import type { AdminUser, AdminJob, AdminError, ToolInfo, ProviderStatus } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [errors, setErrors] = useState<AdminError[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      adminApi.users(), adminApi.jobs(), adminApi.errors(), adminApi.tools(), metaApi.providers(),
    ]).then(([u, j, e, t, p]) => {
      if (cancelled) return;
      if (u.status === 'fulfilled') setUsers(u.value);
      if (j.status === 'fulfilled') setJobs(j.value);
      if (e.status === 'fulfilled') setErrors(e.value);
      if (t.status === 'fulfilled') setTools(t.value);
      if (p.status === 'fulfilled') setProviders(p.value.providers || []);
      const failed = [u, j, e, t, p].find(r => r.status === 'rejected');
      if (failed && failed.status === 'rejected') {
        const reason = failed.reason as unknown;
        setError(reason instanceof ApiError ? reason.message : 'Some admin data could not be loaded.');
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (user && user.role !== 'admin') {
    return (
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 900 }}>Admin Panel</h1>
        <div className="notice notice-err" style={{ marginTop: 20 }}><b>Admin access only</b>Your account ({user.email}) does not have the admin role. If this is wrong, ask the studio owner to update your role.</div>
        <Link className="btn btn-ghost" to="/">← Back to Dashboard</Link>
      </div>
    );
  }
  if (!user) {
    return (
      <div>
        <h1 style={{ fontSize: 30, fontWeight: 900 }}>Admin Panel</h1>
        <div className="notice" style={{ marginTop: 20 }}><b>Log in first</b>The admin panel is only available to logged-in admin accounts.</div>
        <Link className="btn" to="/login">Log in →</Link>
      </div>
    );
  }

  const toggleTool = async (tool: ToolInfo) => {
    const next = tool.status === 'disabled' ? 'live' : 'disabled';
    try {
      const updated = await adminApi.updateTool(tool.id, { status: next });
      setTools(prev => prev.map(t => t.id === tool.id ? updated : t));
      setNotice(`${tool.name} is now ${next}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the tool.');
    }
  };

  const toggleUser = async (u: AdminUser) => {
    const next = u.status === 'disabled' ? 'active' : 'disabled';
    try {
      const updated = await adminApi.updateUser(u.id, { status: next });
      setUsers(prev => prev.map(x => x.id === u.id ? updated : x));
      setNotice(`${u.email} is now ${next}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update the user.');
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 900 }}>Admin Panel</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>Signed in as <b style={{ color: 'var(--text)' }}>{user.name}</b> ({user.email}).</p>
      {error && <div className="notice notice-err">{error}</div>}
      {notice && <div className="notice notice-ok">{notice}</div>}
      {loading && <div className="panel empty">Loading admin data…</div>}

      <div className="section panel">
        <h3>Users ({users.length})</h3>
        {users.length === 0 ? <p className="muted">No users returned.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.name}</td><td>{u.email}</td><td>{u.role || 'user'}</td>
                    <td>{u.status || 'active'}</td>
                    <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                    <td><button className="btn btn-ghost btn-sm" type="button" onClick={() => toggleUser(u)}>{u.status === 'disabled' ? 'Enable' : 'Disable'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section panel">
        <h3>Render jobs ({jobs.length})</h3>
        {jobs.length === 0 ? <p className="muted">No jobs returned.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Job</th><th>Type</th><th>Status</th><th>Progress</th><th>Created</th></tr></thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id}><td>{j.id}</td><td>{j.type || 'video'}</td><td>{j.status}</td><td>{typeof j.progress === 'number' ? `${j.progress}%` : '—'}</td><td>{j.createdAt ? new Date(j.createdAt).toLocaleString() : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section panel">
        <h3>Recent errors ({errors.length})</h3>
        {errors.length === 0 ? <p className="muted">No errors reported.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Error</th><th>Tool</th><th>When</th></tr></thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr key={e.id || i}><td>{e.message}</td><td>{e.tool || '—'}</td><td>{e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section panel">
        <h3>Tools — enable / disable</h3>
        {tools.length === 0 ? <p className="muted">No tools returned.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Tool</th><th>Category</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {tools.map(t => (
                  <tr key={t.id}>
                    <td>{t.name}</td><td>{t.category}</td>
                    <td><span className={`status ${t.status === 'live' ? 'status-live' : 'status-setup'}`}>{t.status}</span></td>
                    <td><button className="btn btn-ghost btn-sm" type="button" onClick={() => toggleTool(t)}>{t.status === 'disabled' ? 'Enable' : 'Disable'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section panel">
        <h3>Providers</h3>
        {providers.length === 0 ? <p className="muted">No provider information returned.</p> : (
          providers.map(p => (
            <div className="kv" key={p.id}>
              <span>{p.name} <span className="small muted">({p.envVar})</span></span>
              <b><span className={`dot ${p.configured ? 'dot-on' : 'dot-off'}`} />{p.configured ? 'Configured' : 'Not configured'}</b>
            </div>
          ))
        )}
        <p className="small muted" style={{ marginTop: 12 }}>Usage limits and provider keys are managed on the server. This panel never shows secrets.</p>
      </div>
    </div>
  );
}
