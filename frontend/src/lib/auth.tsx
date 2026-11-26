import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi, ApiError } from './api';
import type { User } from './api';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('macs_user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem('macs_token'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const persist = (t: string, u: User) => {
    try {
      localStorage.setItem('macs_token', t);
      localStorage.setItem('macs_user', JSON.stringify(u));
    } catch { /* storage unavailable */ }
    setToken(t);
    setUser(u);
  };

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      persist(res.token, res.user);
    } finally { setLoading(false); }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const res = await authApi.register(name, email, password);
      persist(res.token, res.user);
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('macs_token');
      localStorage.removeItem('macs_user');
    } catch { /* ignore */ }
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const me = await authApi.me();
      setUser(me);
      try { localStorage.setItem('macs_user', JSON.stringify(me)); } catch { /* ignore */ }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logout();
    }
  }, [token, logout]);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({ user, token, loading, login, register, logout, refresh }), [user, token, loading, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
