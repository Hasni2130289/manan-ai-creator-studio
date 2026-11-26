import { useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './lib/auth';
import Dashboard from './pages/Dashboard';
import Research from './pages/Research';
import Thumbnails from './pages/Thumbnails';
import Scripts from './pages/Scripts';
import Clipping from './pages/Clipping';
import Faceless from './pages/Faceless';
import Posts from './pages/Posts';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import { Login, Register } from './pages/Auth';

function NotFound() {
  return (
    <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Page not found</h1>
      <p className="muted">That page doesn&apos;t exist in the studio.</p>
      <a className="btn" href="/">← Back to Dashboard</a>
    </div>
  );
}

function RequireAuth() {
  const { token, user } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout onSearch={setSearchQuery} />}>
            <Route element={<RequireAuth />}>
              <Route index element={<Dashboard searchQuery={searchQuery} />} />
              <Route path="tools/research" element={<Research />} />
              <Route path="tools/thumbnails" element={<Thumbnails />} />
              <Route path="tools/scripts" element={<Scripts />} />
              <Route path="tools/clipping" element={<Clipping />} />
              <Route path="tools/faceless" element={<Faceless />} />
              <Route path="tools/posts" element={<Posts />} />
              <Route path="projects" element={<Projects />} />
              <Route path="settings" element={<Settings />} />
              <Route path="admin" element={<Admin />} />
            </Route>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
