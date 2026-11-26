import type { Project } from './api';

const KEY = 'macs_guest_projects';
const FAV_KEY = 'macs_favourites';

export function loadGuestProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch { return []; }
}
export function saveGuestProject(p: { type: string; title: string; data: unknown }): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: p.type, title: p.title, data: p.data, createdAt: now, updatedAt: now,
  };
  const all = loadGuestProjects();
  all.unshift(project);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage full/unavailable */ }
  return project;
}
export function updateGuestProject(id: string, patch: { title?: string; data?: unknown }): Project | null {
  const all = loadGuestProjects();
  const idx = all.findIndex(p => p.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return all[idx];
}
export function deleteGuestProject(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify(loadGuestProjects().filter(p => p.id !== id))); } catch { /* ignore */ }
}
export function loadFavourites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') as string[]; } catch { return []; }
}
export function toggleFavourite(id: string): string[] {
  const favs = loadFavourites();
  const next = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
  try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}
