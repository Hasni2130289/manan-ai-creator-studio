import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LINKS } from '../lib/tools';
import { useAuth } from '../lib/auth';

const NAV = [
  { label: 'Dashboard', to: '/', icon: '🏠', end: true },
  { label: 'Viral Research', to: '/tools/research', icon: '🔍' },
  { label: 'Thumbnail Maker', to: '/tools/thumbnails', icon: '🖼️' },
  { label: 'Video-to-Script AI', to: '/tools/scripts', icon: '📝' },
  { label: 'Clipping Tool', to: '/tools/clipping', icon: '✂️' },
  { label: 'Faceless Video Maker', to: '/tools/faceless', icon: '🎬' },
  { label: 'Post Maker', to: '/tools/posts', icon: '📣' },
  { label: 'My Projects', to: '/projects', icon: '📁' },
  { label: 'Settings', to: '/settings', icon: '⚙️' },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('macs_theme') || 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('macs_theme', theme); } catch { /* ignore */ }
  }, [theme]);
  return (
    <button
      className="icon-btn"
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

export default function Layout({ onSearch }: { onSearch?: (q: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const submitSearch = (q: string) => {
    setQuery(q);
    if (onSearch) onSearch(q);
    navigate('/');
  };

  return (
    <div className="app-bg">
      <div className="layout">
        <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
          <Link className="brand" to="/" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark">M</span>
            <span>
              <span className="brand-name">Manan AI Creator Studio</span>
              <br />
              <span className="brand-sub">by Manan Automation</span>
            </span>
          </Link>
          <div className="nav-label">Tools</div>
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={() => setMenuOpen(false)}>
              <span className="nav-ico">{item.icon}</span>{item.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={() => setMenuOpen(false)}>
              <span className="nav-ico">🛡️</span>Admin Panel
            </NavLink>
          )}
          <div className="sidebar-foot">
            <div>Need help? WhatsApp support</div>
            <a href={LINKS.whatsapp} target="_blank" rel="noreferrer">{LINKS.phoneDisplay}</a>
            <div style={{ marginTop: 8 }}>
              <a href={LINKS.smm} target="_blank" rel="noreferrer">manansmm.com</a>
              {' · '}
              <a href={LINKS.store} target="_blank" rel="noreferrer">Digital Store</a>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="menu-btn" type="button" aria-label="Open menu" onClick={() => setMenuOpen(v => !v)}>☰</button>
            <div className="topbar-search">
              <span aria-hidden="true">🔍</span>
              <input
                value={query}
                onChange={e => submitSearch(e.target.value)}
                placeholder="Search tools: research, thumbnails, scripts…"
                aria-label="Search tools"
              />
            </div>
            <div className="topbar-right">
              <ThemeToggle />
              <a className="btn btn-green btn-sm" href={LINKS.whatsapp} target="_blank" rel="noreferrer">💬 WhatsApp</a>
              {user ? (
                <div style={{ position: 'relative' }}>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAccountOpen(v => !v)}>
                    👤 {user.name} ▾
                  </button>
                  {accountOpen && (
                    <div className="card" style={{ position: 'absolute', right: 0, top: 44, minWidth: 220, zIndex: 30, padding: 12 }}>
                      <div style={{ padding: '6px 8px', fontSize: 13.5, lineHeight: 1.6 }}>
                        <b>{user.name}</b><br /><span className="muted">{user.email}</span>
                        {user.role && <><br /><span className="tag">{user.role}</span></>}
                      </div>
                      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                        <Link className="btn btn-ghost btn-sm" to="/projects" onClick={() => setAccountOpen(false)}>My Projects</Link>
                        <Link className="btn btn-ghost btn-sm" to="/settings" onClick={() => setAccountOpen(false)}>Settings</Link>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setAccountOpen(false); logout(); navigate('/'); }}>Log out</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link className="btn btn-sm" to="/login">Log in</Link>
              )}
            </div>
          </header>

          <main className="content">
            <div className="topbar-search mobile">
              <span aria-hidden="true">🔍</span>
              <input
                value={query}
                onChange={e => submitSearch(e.target.value)}
                placeholder="Search tools…"
                aria-label="Search tools"
              />
            </div>
            <Outlet />
            <footer className="footer">
              <div className="footer-links">
                <a href={LINKS.whatsappChannel} target="_blank" rel="noreferrer">WhatsApp Channel</a>
                <a href={LINKS.whatsappGroup} target="_blank" rel="noreferrer">WhatsApp Group</a>
                <a href={LINKS.facebook} target="_blank" rel="noreferrer">Facebook</a>
                <a href={LINKS.tiktok} target="_blank" rel="noreferrer">TikTok</a>
                <a href={LINKS.instagram} target="_blank" rel="noreferrer">Instagram</a>
                <a href={LINKS.youtube} target="_blank" rel="noreferrer">YouTube</a>
                <a href={LINKS.smm} target="_blank" rel="noreferrer">manansmm.com</a>
                <a href={LINKS.store} target="_blank" rel="noreferrer">Online Store</a>
              </div>
              <p>
                Manan AI Creator Studio by Manan Automation — All Your Creator Tools in One Place.
                WhatsApp support {LINKS.phoneDisplay}. Some tools need a provider key configured by the
                studio owner; the Settings page shows exactly what is set up and what is still missing.
              </p>
            </footer>
          </main>
        </div>
      </div>
      <a className="wa-float" href={LINKS.whatsapp} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" title="Chat on WhatsApp">
        <span aria-hidden="true">💬</span>
      </a>
    </div>
  );
}
