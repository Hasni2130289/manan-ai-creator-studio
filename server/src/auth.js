// Auth helpers: bcrypt passwords, JWT, auth/admin middleware.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { warn } from './logger.js';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex');
  warn(
    'JWT_SECRET is not set — generated a random secret; sessions will NOT survive restarts. Set JWT_SECRET in the environment.',
  );
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: '30d' },
  );
}
export function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' });
  }
  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
  }
  req.user = { id: payload.sub, email: payload.email, role: payload.role };
  return next();
}

// Loads the full user record (for disabled checks) after requireAuth.
export function requireActiveUser(store) {
  return async (req, res, next) => {
    const user = await store.findUserById(req.user.id);
    if (!user) return res.status(401).json({ error: 'unauthorized', message: 'User not found' });
    if (user.disabled) return res.status(403).json({ error: 'forbidden', message: 'Account is disabled' });
    req.user = user;
    return next();
  };
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden', message: 'Admin role required' });
  }
  return next();
}
