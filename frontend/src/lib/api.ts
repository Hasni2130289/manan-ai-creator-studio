const BASE: string = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function getToken(): string | null {
  try { return localStorage.getItem('macs_token'); } catch { return null; }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.headers) {
    Object.entries(options.headers as Record<string, string>).forEach(([k, v]) => { headers[k] = v; });
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch (e) {
    throw new ApiError(0, 'Could not reach the server. Is the backend running?');
  }
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data as { message?: string; error?: string } | null)?.message
      || (data as { message?: string; error?: string } | null)?.error
      || `Request failed (${res.status})`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  downloadUrl: (path: string) => `${BASE}${path}`,
  base: BASE,
};

/* ---------- Types ---------- */
export interface User { id: string; name: string; email: string; role?: string; createdAt?: string; }
export interface AuthResponse { token: string; user: User; }
export interface ProviderStatus { id: string; name: string; configured: boolean; envVar: string; instructions: string; }
export interface HealthResponse {
  status: string; version?: string;
  clippingTool?: { status: string; url: string };
  providers?: Record<string, { configured: boolean }>;
}
export interface Project { id: string; type: string; title: string; data: unknown; createdAt: string; updatedAt: string; }
export interface ResearchResult { videoId: string; title: string; channelTitle: string; thumbnail: string; views: number; publishedAt: string; url: string; }
export interface ResearchSearchResponse { results?: ResearchResult[]; setupRequired?: boolean; provider?: string; envVar?: string; message?: string; }
export interface Idea { title: string; hook: string; }
export interface ScriptResult { summary: string; keyPoints: string[]; script: string; hooks: string[]; ctas: string[]; }
export interface PostVariation { platform: string; title?: string; caption: string; hashtags: string[]; hooks?: string[]; }
export interface ToolInfo { id: string; name: string; category: string; status: string; description: string; url?: string; }
export interface VideoJob { id: string; title?: string; status: string; progress?: number; downloadUrl?: string; error?: string; message?: string; createdAt?: string; }
export interface AdminUser extends User { status?: string; }
export interface AdminJob { id: string; type?: string; status: string; progress?: number; createdAt?: string; }
export interface AdminError { id?: string; message: string; tool?: string; createdAt?: string; }

/* ---------- Auth ---------- */
export const authApi = {
  register: (name: string, email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { name, email, password }),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  me: async () => (await api.get<{ user: User }>('/auth/me')).user,
};

/* ---------- Providers / health / tools ---------- */
export const metaApi = {
  health: () => api.get<HealthResponse>('/health'),
  providers: () => api.get<{ providers: ProviderStatus[] }>('/providers/status'),
  tools: async () => (await api.get<{ tools: ToolInfo[] }>('/tools')).tools,
};

/* ---------- Projects ---------- */
export const projectsApi = {
  list: async () => (await api.get<{ projects: Project[] }>('/projects')).projects,
  create: async (project: { type: string; title: string; data: unknown }) => (await api.post<{ project: Project }>('/projects', project)).project,
  update: async (id: string, patch: { title?: string; data?: unknown }) => (await api.patch<{ project: Project }>(`/projects/${id}`, patch)).project,
  remove: (id: string) => api.del<void>(`/projects/${id}`),
};

/* ---------- Tools ---------- */
export const researchApi = {
  search: (query: string) => api.post<ResearchSearchResponse>('/research/search', { query }),
  ideas: (topic: string) => api.post<{ source: 'ai' | 'template'; ideas: Idea[] }>('/research/ideas', { topic }),
};
export const scriptsApi = {
  generate: (body: { inputType: 'transcript' | 'url'; transcript?: string; url?: string; language: string; length: string }) =>
    api.post<ScriptResult | { error: string; message: string }>('/scripts/generate', body),
};
export const postsApi = {
  generate: (body: { topic: string; platforms: string[]; language: string; tone: string }) =>
    api.post<{ variations: PostVariation[] }>('/posts/generate', body),
};
export const thumbnailsApi = {
  prompt: (body: { topic: string; title: string; style: string }) =>
    api.post<{ prompt: string; styleNotes?: string }>('/thumbnails/prompt', body),
  generate: (body: { prompt: string; style: string }) =>
    api.post<{ imageUrl?: string; setupRequired?: boolean; provider?: string; envVar?: string; message?: string }>('/thumbnails/generate', body),
};
export const videosApi = {
  createJob: async (body: { title: string; script: string; format: string; language: string; voice: string }) =>
    (await api.post<{ job: VideoJob }>('/videos/jobs', body)).job,
  listJobs: async () => (await api.get<{ jobs: VideoJob[] }>('/videos/jobs')).jobs,
  getJob: async (id: string) => (await api.get<{ job: VideoJob }>(`/videos/jobs/${id}`)).job,
};
function withUserStatus(u: AdminUser & { disabled?: boolean }): AdminUser {
  return { ...u, status: u.disabled ? 'disabled' : 'active' };
}
export const adminApi = {
  users: async () => (await api.get<{ users: AdminUser[] }>('/admin/users')).users.map(withUserStatus),
  updateUser: async (id: string, patch: Record<string, unknown>) =>
    withUserStatus((await api.patch<{ user: AdminUser }>(`/admin/users/${id}`, patch)).user),
  jobs: async () => (await api.get<{ jobs: AdminJob[] }>('/admin/jobs')).jobs,
  errors: async () => (await api.get<{ errors: AdminError[] }>('/admin/errors')).errors,
  tools: async () => (await api.get<{ tools: ToolInfo[] }>('/admin/tools')).tools,
  updateTool: (id: string, patch: Record<string, unknown>) => api.put<ToolInfo>(`/admin/tools/${id}`, patch),
};

/* ---------- Helpers ---------- */
export function downloadFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}
export function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}
