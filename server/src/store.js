// Storage abstraction: file-based JSON store by default, PostgreSQL when
// DATABASE_URL is set AND the `pg` package is installed. Falls back to
// JSON with a startup warning if the DB connection fails.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { info, warn } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR =
  process.env.DATA_DIR || path.resolve(__dirname, '..', 'data');

function atomicWrite(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

class JsonStore {
  constructor(dir) {
    this.dir = dir;
    this.backend = 'json';
    this.users = loadJson(path.join(dir, 'users.json'), []);
    this.projects = loadJson(path.join(dir, 'projects.json'), []);
    this.jobs = loadJson(path.join(dir, 'jobs.json'), []);
    this.settings = loadJson(path.join(dir, 'settings.json'), {
      tools: {},
    });
  }
  persist(collection) {
    atomicWrite(path.join(this.dir, `${collection}.json`), this[collection]);
  }
  async init() {
    fs.mkdirSync(this.dir, { recursive: true });
    for (const c of ['users', 'projects', 'jobs', 'settings']) {
      const f = path.join(this.dir, `${c}.json`);
      if (!fs.existsSync(f)) this.persist(c);
    }
  }
  // users
  async findUserByEmail(email) {
    return this.users.find((u) => u.email === email.toLowerCase()) || null;
  }
  async findUserById(id) {
    return this.users.find((u) => u.id === id) || null;
  }
  async listUsers() {
    return [...this.users];
  }
  async createUser(user) {
    this.users.push(user);
    this.persist('users');
    return user;
  }
  async updateUser(id, patch) {
    const u = this.users.find((x) => x.id === id);
    if (!u) return null;
    Object.assign(u, patch);
    this.persist('users');
    return u;
  }
  // projects
  async listProjectsByUser(userId) {
    return this.projects.filter((p) => p.user_id === userId);
  }
  async getProject(id) {
    return this.projects.find((p) => p.id === id) || null;
  }
  async createProject(project) {
    this.projects.push(project);
    this.persist('projects');
    return project;
  }
  async updateProject(id, patch) {
    const p = this.projects.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, patch, { updated_at: new Date().toISOString() });
    this.persist('projects');
    return p;
  }
  async deleteProject(id) {
    const i = this.projects.findIndex((x) => x.id === id);
    if (i === -1) return false;
    this.projects.splice(i, 1);
    this.persist('projects');
    return true;
  }
  // jobs
  async createJob(job) {
    this.jobs.push(job);
    this.persist('jobs');
    return job;
  }
  async listJobsByUser(userId) {
    return this.jobs.filter((j) => j.user_id === userId);
  }
  async listAllJobs() {
    return [...this.jobs];
  }
  async getJob(id) {
    return this.jobs.find((j) => j.id === id) || null;
  }
  async updateJob(id, patch) {
    const j = this.jobs.find((x) => x.id === id);
    if (!j) return null;
    Object.assign(j, patch);
    this.persist('jobs');
    return j;
  }
  // settings
  async getSettings() {
    return this.settings;
  }
  async setToolEnabled(id, enabled) {
    this.settings.tools[id] = { enabled: !!enabled };
    this.persist('settings');
    return this.settings.tools[id];
  }
  async isToolEnabled(id) {
    const entry = this.settings.tools[id];
    return entry ? entry.enabled !== false : true;
  }
}

class PgStore {
  constructor(pool) {
    this.pool = pool;
    this.backend = 'postgres';
    this.settings = loadJson(path.join(DATA_DIR, 'settings.json'), {
      tools: {},
    });
  }
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        disabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        script TEXT NOT NULL DEFAULT '',
        format TEXT NOT NULL DEFAULT 'vertical',
        language TEXT NOT NULL DEFAULT 'en',
        voice TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        progress INT NOT NULL DEFAULT 0,
        missing JSONB,
        message TEXT,
        error TEXT,
        output_path TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }
  rowToUser(r) {
    return r
      ? {
          id: r.id,
          name: r.name,
          email: r.email,
          password_hash: r.password_hash,
          role: r.role,
          disabled: !!r.disabled,
          created_at:
            r.created_at instanceof Date
              ? r.created_at.toISOString()
              : r.created_at,
        }
      : null;
  }
  rowToProject(r) {
    return r
      ? {
          id: r.id,
          user_id: r.user_id,
          type: r.type,
          title: r.title,
          data: r.data,
          created_at:
            r.created_at instanceof Date
              ? r.created_at.toISOString()
              : r.created_at,
          updated_at:
            r.updated_at instanceof Date
              ? r.updated_at.toISOString()
              : r.updated_at,
        }
      : null;
  }
  rowToJob(r) {
    if (!r) return null;
    const j = { ...r };
    for (const k of ['created_at', 'updated_at']) {
      if (j[k] instanceof Date) j[k] = j[k].toISOString();
    }
    return j;
  }
  async findUserByEmail(email) {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()],
    );
    return this.rowToUser(rows[0]);
  }
  async findUserById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id],
    );
    return this.rowToUser(rows[0]);
  }
  async listUsers() {
    const { rows } = await this.pool.query(
      'SELECT * FROM users ORDER BY created_at ASC',
    );
    return rows.map((r) => this.rowToUser(r));
  }
  async createUser(u) {
    await this.pool.query(
      'INSERT INTO users (id,name,email,password_hash,role,disabled,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [u.id, u.name, u.email, u.password_hash, u.role, !!u.disabled, u.created_at],
    );
    return u;
  }
  async updateUser(id, patch) {
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(patch)) {
      if (['role', 'disabled', 'name'].includes(k)) {
        vals.push(v);
        sets.push(`${k} = $${vals.length}`);
      }
    }
    if (!sets.length) return this.findUserById(id);
    vals.push(id);
    await this.pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length}`,
      vals,
    );
    return this.findUserById(id);
  }
  async listProjectsByUser(userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return rows.map((r) => this.rowToProject(r));
  }
  async getProject(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id],
    );
    return this.rowToProject(rows[0]);
  }
  async createProject(p) {
    await this.pool.query(
      'INSERT INTO projects (id,user_id,type,title,data,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [p.id, p.user_id, p.type, p.title, JSON.stringify(p.data || {}), p.created_at, p.updated_at],
    );
    return p;
  }
  async updateProject(id, patch) {
    const p = await this.getProject(id);
    if (!p) return null;
    const next = {
      ...p,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    await this.pool.query(
      'UPDATE projects SET title=$1, data=$2, updated_at=$3 WHERE id=$4',
      [next.title, JSON.stringify(next.data || {}), next.updated_at, id],
    );
    return next;
  }
  async deleteProject(id) {
    const { rowCount } = await this.pool.query(
      'DELETE FROM projects WHERE id = $1',
      [id],
    );
    return rowCount > 0;
  }
  async createJob(j) {
    await this.pool.query(
      `INSERT INTO jobs (id,user_id,title,script,format,language,voice,status,progress,missing,message,error,output_path,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [j.id, j.user_id, j.title, j.script || '', j.format, j.language || 'en', j.voice || null, j.status, j.progress || 0, j.missing ? JSON.stringify(j.missing) : null, j.message || null, j.error || null, j.output_path || null, j.created_at, j.updated_at || j.created_at],
    );
    return j;
  }
  async listJobsByUser(userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return rows.map((r) => this.rowToJob(r));
  }
  async listAllJobs() {
    const { rows } = await this.pool.query(
      'SELECT * FROM jobs ORDER BY created_at DESC',
    );
    return rows.map((r) => this.rowToJob(r));
  }
  async getJob(id) {
    const { rows } = await this.pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
    return this.rowToJob(rows[0]);
  }
  async updateJob(id, patch) {
    const j = await this.getJob(id);
    if (!j) return null;
    const next = { ...j, ...patch, updated_at: new Date().toISOString() };
    await this.pool.query(
      `UPDATE jobs SET title=$1, script=$2, format=$3, language=$4, voice=$5,
        status=$6, progress=$7, missing=$8, message=$9, error=$10, output_path=$11, updated_at=$12 WHERE id=$13`,
      [next.title, next.script || '', next.format, next.language || 'en', next.voice || null, next.status, next.progress || 0, next.missing ? JSON.stringify(next.missing) : null, next.message || null, next.error || null, next.output_path || null, next.updated_at, id],
    );
    return next;
  }
  async getSettings() {
    return this.settings;
  }
  async setToolEnabled(id, enabled) {
    this.settings.tools[id] = { enabled: !!enabled };
    atomicWrite(path.join(DATA_DIR, 'settings.json'), this.settings);
    return this.settings.tools[id];
  }
  async isToolEnabled(id) {
    const entry = this.settings.tools[id];
    return entry ? entry.enabled !== false : true;
  }
}

export async function createStore() {
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query('SELECT 1');
      const store = new PgStore(pool);
      await store.init();
      info('storage backend: postgres');
      return store;
    } catch (err) {
      warn('postgres unavailable, falling back to JSON store', {
        error: String(err?.message || err),
      });
    }
  }
  const store = new JsonStore(DATA_DIR);
  await store.init();
  info('storage backend: json', { dir: DATA_DIR });
  return store;
}

export function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}
