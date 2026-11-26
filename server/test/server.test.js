// Backend tests — run with `npm test` (node:test, no extra deps).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated store + deterministic env for the suite.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-studio-test-'));
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
delete process.env.YOUTUBE_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.ELEVENLABS_API_KEY;
delete process.env.IMAGE_API_KEY;
delete process.env.BGREMOVE_API_KEY;
delete process.env.ADMIN_SETUP_TOKEN;
delete process.env.DATABASE_URL;

const { createApp } = await import('../src/app.js');

let server;
let base;

before(async () => {
  const { app } = await createApp();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function req(method, p, { token, body } = {}) {
  const res = await fetch(`${base}${p}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { res, data };
}

async function register(email, name = 'Test User') {
  const { res, data } = await req('POST', '/api/auth/register', {
    body: { name, email, password: 'password123' },
  });
  assert.equal(res.status, 201, `register ${email}: ${JSON.stringify(data)}`);
  assert.ok(data.token);
  assert.equal(data.user.email, email);
  assert.equal(data.user.role, 'user');
  assert.equal(data.user.password_hash, undefined);
  return data;
}

test('health endpoint returns 200 with the contracted shape', async () => {
  const { res, data } = await req('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(data.status, 'ok');
  assert.equal(data.version, '1.0.0');
  assert.ok(['ok', 'down'].includes(data.clippingTool.status));
  assert.equal(data.clippingTool.url, 'https://manan-clipping-tool-production.up.railway.app/');
  assert.equal(typeof data.providers.youtube.configured, 'boolean');
  assert.equal(typeof data.providers.openai.configured, 'boolean');
  assert.equal(data.providers.youtube.configured, false);
});

test('providers status never returns secret values', async () => {
  const { res, data } = await req('GET', '/api/providers/status');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(data.providers));
  assert.ok(data.providers.length >= 6);
  for (const p of data.providers) {
    assert.equal(typeof p.configured, 'boolean');
    assert.ok(p.envVar);
    assert.ok(p.instructions);
    assert.equal(JSON.stringify(data).includes('test-secret'), false);
  }
});

test('tools list has six tools including the clipping tool', async () => {
  const { res, data } = await req('GET', '/api/tools');
  assert.equal(res.status, 200);
  assert.equal(data.tools.length, 6);
  const clipping = data.tools.find((t) => t.id === 'clipping');
  assert.equal(clipping.url, 'https://manan-clipping-tool-production.up.railway.app/');
  assert.ok(['live', 'down'].includes(clipping.status));
});

test('auth register/login/me flow', async () => {
  const reg = await register('alice@example.com', 'Alice');
  const { res, data } = await req('POST', '/api/auth/login', {
    body: { email: 'alice@example.com', password: 'password123' },
  });
  assert.equal(res.status, 200);
  assert.ok(data.token);
  assert.equal(data.user.name, 'Alice');

  const bad = await req('POST', '/api/auth/login', {
    body: { email: 'alice@example.com', password: 'wrong-password' },
  });
  assert.equal(bad.res.status, 401);

  const me = await req('GET', '/api/auth/me', { token: reg.token });
  assert.equal(me.res.status, 200);
  assert.equal(me.data.user.email, 'alice@example.com');

  const noAuth = await req('GET', '/api/auth/me');
  assert.equal(noAuth.res.status, 401);

  const dup = await req('POST', '/api/auth/register', {
    body: { name: 'Alice 2', email: 'alice@example.com', password: 'password123' },
  });
  assert.equal(dup.res.status, 409);

  const shortPw = await req('POST', '/api/auth/register', {
    body: { name: 'Bob', email: 'bob-short@example.com', password: 'short' },
  });
  assert.equal(shortPw.res.status, 400);
});

test('projects CRUD + ownership isolation', async () => {
  const alice = await register('alice2@example.com', 'Alice 2');
  const bob = await register('bob@example.com', 'Bob');

  const created = await req('POST', '/api/projects', {
    token: alice.token,
    body: { type: 'script', title: 'My script', data: { topic: 'GTA 6' } },
  });
  assert.equal(created.res.status, 201);
  const id = created.data.project.id;

  const badType = await req('POST', '/api/projects', {
    token: alice.token,
    body: { type: 'nope', title: 'x' },
  });
  assert.equal(badType.res.status, 400);

  // Bob cannot see, read, update or delete Alice's project.
  const bobList = await req('GET', '/api/projects', { token: bob.token });
  assert.equal(bobList.data.projects.length, 0);
  const bobGet = await req('GET', `/api/projects/${id}`, { token: bob.token });
  assert.equal(bobGet.res.status, 404);
  const bobPatch = await req('PATCH', `/api/projects/${id}`, { token: bob.token, body: { title: 'hijack' } });
  assert.equal(bobPatch.res.status, 404);
  const bobDel = await req('DELETE', `/api/projects/${id}`, { token: bob.token });
  assert.equal(bobDel.res.status, 404);

  const aliceGet = await req('GET', `/api/projects/${id}`, { token: alice.token });
  assert.equal(aliceGet.res.status, 200);
  const patched = await req('PATCH', `/api/projects/${id}`, {
    token: alice.token,
    body: { title: 'Updated title' },
  });
  assert.equal(patched.res.status, 200);
  assert.equal(patched.data.project.title, 'Updated title');

  const deleted = await req('DELETE', `/api/projects/${id}`, { token: alice.token });
  assert.equal(deleted.res.status, 200);
  const gone = await req('GET', `/api/projects/${id}`, { token: alice.token });
  assert.equal(gone.res.status, 404);
});

test('research search returns setupRequired when no YouTube key is set', async () => {
  const user = await register('researcher@example.com');
  const { res, data } = await req('POST', '/api/research/search', {
    token: user.token,
    body: { query: 'GTA 6 trailer' },
  });
  assert.equal(res.status, 200);
  assert.equal(data.setupRequired, true);
  assert.equal(data.provider, 'youtube');
  assert.equal(data.envVar, 'YOUTUBE_API_KEY');
  assert.equal(data.results, undefined);
});

test('research ideas work without an AI key (free AI or labelled templates)', async () => {
  const user = await register('ideas@example.com');
  const { res, data } = await req('POST', '/api/research/ideas', {
    token: user.token,
    body: { topic: 'GTA 6 map' },
  });
  assert.equal(res.status, 200);
  assert.ok(['ai', 'template'].includes(data.source));
  assert.ok(data.ideas.length >= 3);
  assert.ok(data.ideas[0].title);
  assert.ok(data.ideas[0].hook);
});

test('posts generator returns 2-3 variations per platform', async () => {
  const user = await register('poster@example.com');
  const { res, data } = await req('POST', '/api/posts/generate', {
    token: user.token,
    body: { topic: 'GTA 6 map guide', platforms: ['youtube', 'tiktok'], language: 'en', tone: 'casual' },
  });
  assert.equal(res.status, 200);
  assert.equal(data.source, 'template');
  assert.ok(Array.isArray(data.variations));
  for (const platform of ['youtube', 'tiktok']) {
    const per = data.variations.filter((v) => v.platform === platform);
    assert.ok(per.length >= 2 && per.length <= 3, `${platform}: ${per.length}`);
    for (const v of per) {
      assert.ok(v.caption);
      assert.ok(Array.isArray(v.hashtags) && v.hashtags.length > 0);
    }
  }
  const yt = data.variations.find((v) => v.platform === 'youtube');
  assert.ok(yt.title);
});

test('scripts generate works from a transcript via the template fallback', async () => {
  const user = await register('scripter@example.com');
  const { res, data } = await req('POST', '/api/scripts/generate', {
    token: user.token,
    body: {
      inputType: 'transcript',
      transcript: 'The city is quiet tonight. The streets are empty. Something moves in the dark. The old house waits at the end of the road.',
      language: 'en',
      length: 'short',
    },
  });
  assert.equal(res.status, 200);
  assert.equal(data.source, 'template');
  assert.ok(data.summary);
  assert.ok(Array.isArray(data.keyPoints));
  assert.ok(data.script);
  assert.ok(Array.isArray(data.hooks) && data.hooks.length > 0);
  assert.ok(Array.isArray(data.ctas) && data.ctas.length > 0);
});

test('scripts generate with a URL returns 422 when no transcript is obtainable', async () => {
  const user = await register('urlscripter@example.com');
  const { res, data } = await req('POST', '/api/scripts/generate', {
    token: user.token,
    body: { inputType: 'url', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', language: 'en', length: 'short' },
  });
  // Either the captions are reachable (200 with a real script) or not (422).
  // It must never claim success with a fabricated transcript.
  assert.ok([200, 422].includes(res.status));
  if (res.status === 422) assert.equal(data.error, 'transcript_unavailable');
});

test('thumbnail prompt works without keys; generate uses the free provider', async () => {
  const user = await register('thumb@example.com');
  const prompt = await req('POST', '/api/thumbnails/prompt', {
    token: user.token,
    body: { topic: 'Haunted forest', title: 'The Whispering Woods', style: 'storytelling' },
  });
  assert.equal(prompt.res.status, 200);
  assert.ok(prompt.data.prompt.includes('Haunted forest'));
  assert.ok(prompt.data.styleNotes);

  const gen = await req('POST', '/api/thumbnails/generate', {
    token: user.token,
    body: { prompt: 'a haunted forest', style: 'storytelling' },
  });
  assert.equal(gen.res.status, 200);
  assert.equal(gen.data.source, 'ai');
  assert.ok(String(gen.data.imageUrl || '').startsWith('data:image/'));
});

test('video job queues without keys (free TTS built in)', async () => {
  const user = await register('video@example.com');
  const { res, data } = await req('POST', '/api/videos/jobs', {
    token: user.token,
    body: {
      title: 'Test video',
      script: 'Hello world. This is a test script.',
      format: 'vertical',
      language: 'en',
      voice: 'alloy',
    },
  });
  assert.equal(res.status, 201);
  // The render starts in-process right after creation, so by the time the
  // response is serialised the job may already read 'rendering'.
  assert.ok(['queued', 'rendering'].includes(data.job.status));
  assert.equal(data.job.missing, null);
  assert.equal(data.job.message, null);

  const list = await req('GET', '/api/videos/jobs', { token: user.token });
  assert.equal(list.data.jobs.length, 1);

  const dl = await req('GET', `/api/videos/jobs/${data.job.id}/download`, { token: user.token });
  assert.equal(dl.res.status, 404);
});

test('admin routes reject non-admins; setup-admin 404s when no token is configured', async () => {
  const user = await register('plain@example.com');
  const users = await req('GET', '/api/admin/users', { token: user.token });
  assert.equal(users.res.status, 403);
  const setup = await req('POST', '/api/auth/setup-admin', {
    body: { setupToken: 'anything', name: 'Admin', email: 'admin@example.com', password: 'password123' },
  });
  assert.equal(setup.res.status, 404);
});

test('unknown /api route returns JSON 404', async () => {
  const { res, data } = await req('GET', '/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(data.error, 'not_found');
});
