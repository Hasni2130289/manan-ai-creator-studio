// Structured JSON logging. Never log secrets: callers must never pass
// keys, tokens or passwords here.
export function log(level, msg, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, msg, ...meta };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
export const info = (msg, meta) => log('info', msg, meta);
export const warn = (msg, meta) => log('warn', msg, meta);
export const error = (msg, meta) => log('error', msg, meta);

// In-memory ring buffer of recent errors, exposed via GET /api/admin/errors.
const MAX_ERRORS = 100;
export const errorLog = [];
export function recordError(err, context = {}) {
  const entry = {
    ts: new Date().toISOString(),
    message: String(err?.message || err),
    ...context,
  };
  errorLog.push(entry);
  if (errorLog.length > MAX_ERRORS) errorLog.shift();
  return entry;
}
