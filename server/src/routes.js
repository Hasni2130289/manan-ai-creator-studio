// All API routes. `store` is injected so tests can use an isolated store.
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import { hashPassword, verifyPassword, signToken, requireAuth, requireActiveUser, requireAdmin } from './auth.js';
import { publicUser } from './store.js';
import { checkClippingTool, providerConfigured, providersStatus, toolsStatus, CLIPPING_TOOL_URL } from './providers.js';
import { badRequest, reqString, reqEnum, reqStringArray, isValidEmail } from './validate.js';
import { errorLog, recordError } from './logger.js';
import {
  templateIdeas, templateScript, templatePosts, thumbnailPrompt, THUMBNAIL_STYLES,
} from './generators.js';
import {
  aiChat, parseIdeasJson, youtubeSearch, generateImage, removeBg, fetchYouTubeTranscript,
} from './providersApi.js';
import { ffmpegAvailable, renderVideo, renderOutputPath } from './videoRender.js';

const PROJECT_TYPES = ['research', 'script', 'thumbnail', 'video', 'post', 'other'];
const PLATFORMS = ['youtube', 'shorts', 'facebook', 'instagram', 'tiktok'];
const LANGUAGES = ['en', 'ur', 'roman-ur'];
const TONES = ['casual', 'professional', 'funny', 'inspirational'];

function setupRequired(res, provider, envVar, message) {
  return res.status(200).json({ setupRequired: true, provider, envVar, message });
}

export function createApiRouter(store) {
  const router = express.Router();
  const auth = [requireAuth, requireActiveUser(store)];

  // ---- Health / providers / tools (public) ----
  router.get('/health', async (req, res) => {
    const clipping = await checkClippingTool();
    res.json({
      status: 'ok',
      version: '1.0.0',
      clippingTool: { status: clipping, url: CLIPPING_TOOL_URL },
      providers: providerConfigured(),
    });
  });

  router.get('/providers/status', (req, res) => {
    res.json({ providers: providersStatus() });
  });

  router.get('/tools', async (req, res) => {
    res.json({ tools: await toolsStatus(store) });
  });

  // ---- Auth ----
  router.post('/auth/register', async (req, res, next) => {
    try {
      const { value: name, error: nameErr } = reqString(req.body?.name, { max: 100, field: 'name' });
      if (nameErr) return badRequest(res, nameErr);
      const { value: email, error: emailErr } = reqString(req.body?.email, { max: 200, field: 'email' });
      if (emailErr) return badRequest(res, emailErr);
      if (!isValidEmail(email)) return badRequest(res, 'email must be a valid email address');
      const { value: password, error: pwErr } = reqString(req.body?.password, { max: 200, field: 'password' });
      if (pwErr) return badRequest(res, pwErr);
      if (password.length < 8) return badRequest(res, 'password must be at least 8 characters');
      const existing = await store.findUserByEmail(email.toLowerCase());
      if (existing) return res.status(409).json({ error: 'conflict', message: 'An account with this email already exists' });
      const users = await store.listUsers();
      const role =
        users.length === 0 && process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
          ? 'admin'
          : 'user';
      const user = {
        id: crypto.randomUUID(),
        name,
        email: email.toLowerCase(),
        password_hash: await hashPassword(password),
        role,
        disabled: false,
        created_at: new Date().toISOString(),
      };
      await store.createUser(user);
      res.status(201).json({ token: signToken(user), user: publicUser(user) });
    } catch (err) { next(err); }
  });

  router.post('/auth/login', async (req, res, next) => {
    try {
      const { value: email, error: emailErr } = reqString(req.body?.email, { max: 200, field: 'email' });
      if (emailErr) return badRequest(res, emailErr);
      const { value: password, error: pwErr } = reqString(req.body?.password, { max: 200, field: 'password' });
      if (pwErr) return badRequest(res, pwErr);
      const user = await store.findUserByEmail(email.toLowerCase());
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return res.status(401).json({ error: 'unauthorized', message: 'Invalid email or password' });
      }
      if (user.disabled) return res.status(403).json({ error: 'forbidden', message: 'Account is disabled' });
      res.json({ token: signToken(user), user: publicUser(user) });
    } catch (err) { next(err); }
  });

  router.get('/auth/me', ...auth, (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  router.post('/auth/setup-admin', async (req, res, next) => {
    try {
      const setupToken = process.env.ADMIN_SETUP_TOKEN;
      if (!setupToken) return res.status(404).json({ error: 'not_found', message: 'Route not found' });
      if (req.body?.setupToken !== setupToken) {
        return res.status(403).json({ error: 'forbidden', message: 'Invalid setup token' });
      }
      const { value: name, error: nameErr } = reqString(req.body?.name, { max: 100, field: 'name' });
      if (nameErr) return badRequest(res, nameErr);
      const { value: email, error: emailErr } = reqString(req.body?.email, { max: 200, field: 'email' });
      if (emailErr) return badRequest(res, emailErr);
      if (!isValidEmail(email)) return badRequest(res, 'email must be a valid email address');
      const { value: password, error: pwErr } = reqString(req.body?.password, { max: 200, field: 'password' });
      if (pwErr) return badRequest(res, pwErr);
      if (password.length < 8) return badRequest(res, 'password must be at least 8 characters');
      const existing = await store.findUserByEmail(email.toLowerCase());
      if (existing) return res.status(409).json({ error: 'conflict', message: 'An account with this email already exists' });
      const user = {
        id: crypto.randomUUID(),
        name,
        email: email.toLowerCase(),
        password_hash: await hashPassword(password),
        role: 'admin',
        disabled: false,
        created_at: new Date().toISOString(),
      };
      await store.createUser(user);
      res.status(201).json({ token: signToken(user), user: publicUser(user) });
    } catch (err) { next(err); }
  });

  // ---- Projects (auth, owner-scoped) ----
  router.get('/projects', ...auth, async (req, res, next) => {
    try {
      res.json({ projects: await store.listProjectsByUser(req.user.id) });
    } catch (err) { next(err); }
  });

  router.post('/projects', ...auth, async (req, res, next) => {
    try {
      const { value: type, error: typeErr } = reqEnum(req.body?.type, PROJECT_TYPES, { field: 'type' });
      if (typeErr) return badRequest(res, typeErr);
      const { value: title, error: titleErr } = reqString(req.body?.title, { max: 300, field: 'title' });
      if (titleErr) return badRequest(res, titleErr);
      const data = req.body?.data === undefined ? {} : req.body.data;
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return badRequest(res, 'data must be an object');
      }
      if (JSON.stringify(data).length > 1_000_000) return badRequest(res, 'data is too large');
      const now = new Date().toISOString();
      const project = { id: crypto.randomUUID(), user_id: req.user.id, type, title, data, created_at: now, updated_at: now };
      await store.createProject(project);
      res.status(201).json({ project });
    } catch (err) { next(err); }
  });

  function loadOwnedProject(req, res, next) {
    store.getProject(req.params.id)
      .then((p) => {
        if (!p || p.user_id !== req.user.id) {
          return res.status(404).json({ error: 'not_found', message: 'Project not found' });
        }
        req.project = p;
        next();
      })
      .catch(next);
  }

  router.get('/projects/:id', ...auth, loadOwnedProject, (req, res) => {
    res.json({ project: req.project });
  });

  router.patch('/projects/:id', ...auth, loadOwnedProject, async (req, res, next) => {
    try {
      const patch = {};
      if (req.body?.title !== undefined) {
        const { value, error } = reqString(req.body.title, { max: 300, field: 'title' });
        if (error) return badRequest(res, error);
        patch.title = value;
      }
      if (req.body?.data !== undefined) {
        if (typeof req.body.data !== 'object' || req.body.data === null || Array.isArray(req.body.data)) {
          return badRequest(res, 'data must be an object');
        }
        patch.data = req.body.data;
      }
      if (req.body?.type !== undefined) {
        const { value, error } = reqEnum(req.body.type, PROJECT_TYPES, { field: 'type' });
        if (error) return badRequest(res, error);
        patch.type = value;
      }
      const updated = await store.updateProject(req.project.id, patch);
      res.json({ project: updated });
    } catch (err) { next(err); }
  });

  router.delete('/projects/:id', ...auth, loadOwnedProject, async (req, res, next) => {
    try {
      await store.deleteProject(req.project.id);
      res.json({ deleted: true });
    } catch (err) { next(err); }
  });

  // ---- Research ----
  router.post('/research/search', ...auth, async (req, res, next) => {
    try {
      const { value: query, error: qErr } = reqString(req.body?.query, { max: 500, field: 'query' });
      if (qErr) return badRequest(res, qErr);
      const maxResults = req.body?.maxResults === undefined ? 5 : req.body.maxResults;
      if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 25) {
        return badRequest(res, 'maxResults must be an integer between 1 and 25');
      }
      if (!process.env.YOUTUBE_API_KEY) {
        return setupRequired(res, 'youtube', 'YOUTUBE_API_KEY',
          'YouTube search needs a YouTube Data API v3 key. Set YOUTUBE_API_KEY to enable real search results.');
      }
      try {
        const results = await youtubeSearch(query, maxResults);
        res.json({ source: 'youtube_api', results });
      } catch (err) {
        recordError(err, { route: 'POST /api/research/search' });
        res.status(502).json({ error: 'provider_error', message: 'YouTube API request failed. Check the API key and try again.' });
      }
    } catch (err) { next(err); }
  });

  router.post('/research/ideas', ...auth, async (req, res, next) => {
    try {
      const { value: topic, error: tErr } = reqString(req.body?.topic, { max: 500, field: 'topic' });
      if (tErr) return badRequest(res, tErr);
      try {
        const text = await aiChat([
          { role: 'system', content: 'You generate YouTube video title and hook ideas. Reply with JSON only: {"ideas":[{"title":"...","hook":"..."}]} — 5 ideas.' },
          { role: 'user', content: `Topic: ${topic}` },
        ]);
        const ideas = parseIdeasJson(text, topic);
        if (ideas.length) return res.json({ source: 'ai', ideas });
      } catch (err) {
        recordError(err, { route: 'POST /api/research/ideas' });
        // Fall through to honest template fallback rather than failing.
      }
      res.json({ source: 'template', ideas: templateIdeas(topic) });
    } catch (err) { next(err); }
  });

  // ---- Scripts ----
  router.post('/scripts/generate', ...auth, async (req, res, next) => {
    try {
      const { value: inputType, error: itErr } = reqEnum(req.body?.inputType, ['transcript', 'url'], { field: 'inputType' });
      if (itErr) return badRequest(res, itErr);
      const { value: language, error: langErr } = reqEnum(req.body?.language, LANGUAGES, { field: 'language' });
      if (langErr) return badRequest(res, langErr);
      const { value: length, error: lenErr } = reqEnum(req.body?.length, ['short', 'medium', 'long'], { field: 'length' });
      if (lenErr) return badRequest(res, lenErr);

      let transcript = null;
      if (inputType === 'transcript') {
        const { value, error } = reqString(req.body?.transcript, { max: 100000, field: 'transcript' });
        if (error) return badRequest(res, error);
        transcript = value;
      } else {
        const { value: url, error: urlErr } = reqString(req.body?.url, { max: 2000, field: 'url' });
        if (urlErr) return badRequest(res, urlErr);
        let parsed;
        try { parsed = new URL(url); } catch { return badRequest(res, 'url must be a valid URL'); }
        if (!['http:', 'https:'].includes(parsed.protocol)) return badRequest(res, 'url must be http or https');
        try {
          transcript = await fetchYouTubeTranscript(url);
        } catch (err) {
          recordError(err, { route: 'POST /api/scripts/generate' });
          transcript = null;
        }
        if (!transcript) {
          return res.status(422).json({
            error: 'transcript_unavailable',
            message: 'Could not obtain a transcript for this video. Only videos with public captions can be analysed; paste the transcript text instead.',
          });
        }
      }

      try {
        const text = await aiChat([
          { role: 'system', content: `You write video scripts. Reply with JSON only: {"summary":"...","keyPoints":["..."],"script":"...","hooks":["..."],"ctas":["..."]}. Language: ${language}. Length: ${length}.` },
          { role: 'user', content: transcript.slice(0, 12000) },
        ]);
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.script === 'string') {
          return res.json({
            source: 'ai',
            summary: parsed.summary || '',
            keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
            script: parsed.script,
            hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
            ctas: Array.isArray(parsed.ctas) ? parsed.ctas : [],
          });
        }
      } catch (err) {
        recordError(err, { route: 'POST /api/scripts/generate' });
      }
      res.json(templateScript(transcript, language, length));
    } catch (err) { next(err); }
  });

  // ---- Posts ----
  router.post('/posts/generate', ...auth, async (req, res, next) => {
    try {
      const { value: topic, error: tErr } = reqString(req.body?.topic, { max: 500, field: 'topic' });
      if (tErr) return badRequest(res, tErr);
      const { value: platforms, error: pErr } = reqStringArray(req.body?.platforms, { required: true, allowed: PLATFORMS, field: 'platforms' });
      if (pErr) return badRequest(res, pErr);
      const { value: language, error: langErr } = reqEnum(req.body?.language, LANGUAGES, { required: false, field: 'language' });
      if (langErr) return badRequest(res, langErr);
      const { value: tone, error: toneErr } = reqEnum(req.body?.tone, TONES, { required: false, field: 'tone' });
      if (toneErr) return badRequest(res, toneErr);
      const lang = language || 'en';
      const toneVal = tone || 'casual';

      try {
        const text = await aiChat([
          { role: 'system', content: `You write social media posts. Reply with JSON only: {"variations":[{"platform":"...","title":"...","caption":"...","hashtags":["..."],"hooks":["..."]}]}. 2-3 variations per platform.` },
          { role: 'user', content: `Topic: ${topic}. Platforms: ${platforms.join(', ')}. Language: ${lang}. Tone: ${toneVal}.` },
        ]);
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.variations) && parsed.variations.length) {
          const variations = parsed.variations.filter((v) => platforms.includes(v.platform) && typeof v.caption === 'string');
          if (variations.length) return res.json({ source: 'ai', variations });
        }
      } catch (err) {
        recordError(err, { route: 'POST /api/posts/generate' });
      }
      res.json(templatePosts(topic, platforms, lang, toneVal));
    } catch (err) { next(err); }
  });

  // ---- Thumbnails ----
  router.post('/thumbnails/prompt', ...auth, async (req, res, next) => {
    try {
      const { value: topic, error: tErr } = reqString(req.body?.topic, { max: 500, field: 'topic' });
      if (tErr) return badRequest(res, tErr);
      const { value: title } = reqString(req.body?.title, { required: false, max: 300, field: 'title' });
      const { value: style, error: sErr } = reqEnum(req.body?.style, Object.keys(THUMBNAIL_STYLES), { required: false, field: 'style' });
      if (sErr) return badRequest(res, sErr);
      res.json(thumbnailPrompt(topic, title || '', style || 'storytelling'));
    } catch (err) { next(err); }
  });

  router.post('/thumbnails/generate', ...auth, async (req, res, next) => {
    try {
      const { value: prompt, error: pErr } = reqString(req.body?.prompt, { max: 4000, field: 'prompt' });
      if (pErr) return badRequest(res, pErr);
      const { value: style, error: sErr } = reqEnum(req.body?.style, Object.keys(THUMBNAIL_STYLES), { required: false, field: 'style' });
      if (sErr) return badRequest(res, sErr);
      try {
        const result = await generateImage(prompt);
        res.json({ source: 'ai', style: style || undefined, ...result });
      } catch (err) {
        recordError(err, { route: 'POST /api/thumbnails/generate' });
        res.status(502).json({ error: 'provider_error', message: 'Image generation failed. Please try again.' });
      }
    } catch (err) { next(err); }
  });

  router.post('/thumbnails/remove-bg', ...auth, async (req, res, next) => {
    try {
      const { value: imageDataUrl, error } = reqString(req.body?.imageDataUrl, { max: 10_000_000, field: 'imageDataUrl' });
      if (error) return badRequest(res, error);
      if (!imageDataUrl.startsWith('data:image/')) return badRequest(res, 'imageDataUrl must be a data:image/... URL');
      if (!process.env.BGREMOVE_API_KEY) {
        return setupRequired(res, 'bgremove', 'BGREMOVE_API_KEY',
          'Background removal needs a remove.bg API key. Set BGREMOVE_API_KEY to enable it.');
      }
      try {
        const result = await removeBg(imageDataUrl);
        res.json({ source: 'ai', ...result });
      } catch (err) {
        recordError(err, { route: 'POST /api/thumbnails/remove-bg' });
        res.status(502).json({ error: 'provider_error', message: 'Background removal failed. Check the API key and try again.' });
      }
    } catch (err) { next(err); }
  });

  // ---- Faceless videos ----
  async function processVideoJob(job) {
    try {
      await store.updateJob(job.id, { status: 'rendering', progress: 5 });
      const outPath = await renderVideo(job, async (p) => {
        await store.updateJob(job.id, { progress: p }).catch(() => {});
      });
      await store.updateJob(job.id, { status: 'done', progress: 100, output_path: outPath });
    } catch (err) {
      recordError(err, { route: 'video job', jobId: job.id });
      await store.updateJob(job.id, { status: 'failed', error: String(err?.message || err) }).catch(() => {});
    }
  }

  router.post('/videos/jobs', ...auth, async (req, res, next) => {
    try {
      const { value: title, error: tErr } = reqString(req.body?.title, { max: 300, field: 'title' });
      if (tErr) return badRequest(res, tErr);
      const { value: script, error: sErr } = reqString(req.body?.script, { max: 50000, field: 'script' });
      if (sErr) return badRequest(res, sErr);
      const { value: format, error: fErr } = reqEnum(req.body?.format, ['vertical', 'horizontal'], { field: 'format' });
      if (fErr) return badRequest(res, fErr);
      const { value: language, error: lErr } = reqEnum(req.body?.language, LANGUAGES, { required: false, field: 'language' });
      if (lErr) return badRequest(res, lErr);
      const { value: voice } = reqString(req.body?.voice, { required: false, max: 100, field: 'voice' });

      const now = new Date().toISOString();
      const missing = [];
      const hasFfmpeg = await ffmpegAvailable();
      if (!hasFfmpeg) missing.push('ffmpeg');
      const job = {
        id: crypto.randomUUID(),
        user_id: req.user.id,
        title,
        script,
        format,
        language: language || 'en',
        voice: voice || null,
        status: missing.length ? 'needs_setup' : 'queued',
        progress: 0,
        missing: missing.length ? missing : null,
        message: missing.length
          ? `Cannot render yet — missing: ${missing.join(', ')}. Install ffmpeg on the server.`
          : null,
        created_at: now,
        updated_at: now,
      };
      await store.createJob(job);
      if (!missing.length) {
        // In-process async queue: fire and forget.
        processVideoJob(job);
      }
      res.status(201).json({ job: publicJob(job) });
    } catch (err) { next(err); }
  });

  router.get('/videos/jobs', ...auth, async (req, res, next) => {
    try {
      const jobs = await store.listJobsByUser(req.user.id);
      res.json({ jobs: jobs.map(publicJob) });
    } catch (err) { next(err); }
  });

  router.get('/videos/jobs/:id', ...auth, async (req, res, next) => {
    try {
      const job = await store.getJob(req.params.id);
      if (!job || job.user_id !== req.user.id) {
        return res.status(404).json({ error: 'not_found', message: 'Job not found' });
      }
      res.json({ job: publicJob(job) });
    } catch (err) { next(err); }
  });

  router.get('/videos/jobs/:id/download', ...auth, async (req, res, next) => {
    try {
      const job = await store.getJob(req.params.id);
      if (!job || job.user_id !== req.user.id) {
        return res.status(404).json({ error: 'not_found', message: 'Job not found' });
      }
      if (job.status !== 'done') {
        return res.status(404).json({ error: 'not_found', message: 'Video is not ready yet' });
      }
      const file = job.output_path || renderOutputPath(job.id);
      if (!fs.existsSync(file)) {
        return res.status(404).json({ error: 'not_found', message: 'Rendered file not found' });
      }
      res.download(file, `${job.id}.mp4`);
    } catch (err) { next(err); }
  });

  // ---- Admin ----
  const admin = [...auth, requireAdmin];
  router.get('/admin/users', ...admin, async (req, res, next) => {
    try {
      const users = await store.listUsers();
      res.json({ users: users.map(publicUser) });
    } catch (err) { next(err); }
  });

  router.patch('/admin/users/:id', ...admin, async (req, res, next) => {
    try {
      const patch = {};
      if (req.body?.role !== undefined) {
        const { value, error } = reqEnum(req.body.role, ['user', 'admin'], { field: 'role' });
        if (error) return badRequest(res, error);
        patch.role = value;
      }
      if (req.body?.disabled !== undefined) {
        if (typeof req.body.disabled !== 'boolean') return badRequest(res, 'disabled must be a boolean');
        patch.disabled = req.body.disabled;
      }
      if (req.body?.status !== undefined) {
        const { value, error } = reqEnum(req.body.status, ['active', 'disabled'], { field: 'status' });
        if (error) return badRequest(res, error);
        patch.disabled = value === 'disabled';
      }
      if (!Object.keys(patch).length) return badRequest(res, 'Nothing to update');
      const updated = await store.updateUser(req.params.id, patch);
      if (!updated) return res.status(404).json({ error: 'not_found', message: 'User not found' });
      res.json({ user: publicUser(updated) });
    } catch (err) { next(err); }
  });

  router.get('/admin/jobs', ...admin, async (req, res, next) => {
    try {
      const jobs = await store.listAllJobs();
      res.json({ jobs: jobs.map(publicJob) });
    } catch (err) { next(err); }
  });

  router.get('/admin/errors', ...admin, (req, res) => {
    res.json({ errors: [...errorLog].reverse() });
  });

  router.get('/admin/tools', ...admin, async (req, res, next) => {
    try {
      res.json({ tools: await toolsStatus(store) });
    } catch (err) { next(err); }
  });

  router.put('/admin/tools/:id', ...admin, async (req, res, next) => {
    try {
      const known = ['research', 'script', 'thumbnail', 'video', 'posts', 'clipping'];
      const id = req.params.id;
      if (!known.includes(id)) return res.status(404).json({ error: 'not_found', message: 'Unknown tool' });
      let enabled;
      if (req.body?.enabled !== undefined) {
        if (typeof req.body.enabled !== 'boolean') return badRequest(res, 'enabled must be a boolean');
        enabled = req.body.enabled;
      } else if (req.body?.status !== undefined) {
        const { value, error } = reqEnum(req.body.status, ['live', 'disabled', 'setup_required'], { field: 'status' });
        if (error) return badRequest(res, error);
        enabled = value !== 'disabled';
      } else {
        return badRequest(res, 'enabled or status is required');
      }
      await store.setToolEnabled(id, enabled);
      const tools = await toolsStatus(store);
      const tool = tools.find((t) => t.id === id);
      if (!tool) return res.status(404).json({ error: 'not_found', message: 'Unknown tool' });
      res.json(tool);
    } catch (err) { next(err); }
  });

  router.put('/admin/tools', ...admin, async (req, res, next) => {
    try {
      const { value: id, error: idErr } = reqString(req.body?.id, { max: 100, field: 'id' });
      if (idErr) return badRequest(res, idErr);
      if (typeof req.body?.enabled !== 'boolean') return badRequest(res, 'enabled must be a boolean');
      const known = ['research', 'script', 'thumbnail', 'video', 'posts', 'clipping'];
      if (!known.includes(id)) return res.status(404).json({ error: 'not_found', message: 'Unknown tool' });
      await store.setToolEnabled(id, req.body.enabled);
      res.json({ tools: await toolsStatus(store) });
    } catch (err) { next(err); }
  });

  return router;
}

function publicJob(job) {
  if (!job) return null;
  const { output_path, ...rest } = job;
  return rest;
}
