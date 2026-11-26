// Express app factory (async: store init may try Postgres first).
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';
import { createApiRouter } from './routes.js';
import { info, error as logError, recordError } from './logger.js';
import { logStartupProviders } from './providers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createApp() {
  const store = await createStore();
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Too many requests, please try again later.' },
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'rate_limited', message: 'Too many auth attempts, please try again later.' },
  });
  app.use('/api/', generalLimiter);
  app.use('/api/auth/', authLimiter);

  // Request logging (method/path/status/duration only — never bodies).
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      info('request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - start,
      });
    });
    next();
  });

  app.use('/api', createApiRouter(store));

  // Unknown /api routes -> JSON 404.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'not_found', message: 'API route not found' });
  });

  // Static frontend build in production, if present.
  const distDir = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
    info('serving frontend build', { dir: distDir });
  } else {
    app.get('/', (req, res) => {
      res.json({ status: 'ok', service: 'manan-ai-creator-studio', version: '1.0.0' });
    });
  }

  // Central error handler -> {error, message} JSON.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    recordError(err, { route: `${req.method} ${req.path}` });
    logError('unhandled error', { message: String(err?.message || err) });
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'payload_too_large', message: 'Request body exceeds the 10 MB limit' });
    }
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid JSON body' });
    }
    res.status(err?.status || 500).json({
      error: 'internal_error',
      message: 'Something went wrong. Please try again.',
    });
  });

  logStartupProviders();
  return { app, store };
}
