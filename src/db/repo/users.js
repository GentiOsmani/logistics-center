import { all, get, run } from '../db.js';
import { hashPassword, token, verifyPassword } from '../../core/crypto.js';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export const listUsers = () =>
  all('SELECT id, email, name, role, is_active, created_at, last_login_at FROM users ORDER BY id');

export const getUserByEmail = (email) =>
  get('SELECT * FROM users WHERE lower(email) = lower(?)', email);

export const countUsers = () => get('SELECT COUNT(*) AS n FROM users').n;

export function createUser({ email, name, password, role = 'editor' }) {
  return run(
    'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
    email, name, hashPassword(password), role,
  ).lastInsertRowid;
}

export function setPassword(userId, password) {
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), userId);
}

/** Returns the user on success, or null. */
export function authenticate(email, password) {
  const user = getUserByEmail(email);
  if (!user || !user.is_active) {
    // Constant-ish work on a miss so timing does not reveal account existence.
    verifyPassword(password, 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
    return null;
  }
  if (!verifyPassword(password, user.password_hash)) return null;
  run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", user.id);
  return user;
}

/* ------------------------------------------------------------------- sessions */

export function createSession(userId) {
  const id = token(24);
  const csrf = token(18);
  run('INSERT INTO sessions (id, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)',
    id, userId, csrf, Date.now() + SESSION_TTL_MS);
  return { id, csrf };
}

export function getSession(id) {
  if (!id) return null;
  const row = get(
    `SELECT s.id, s.csrf, s.expires_at, u.id AS user_id, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND u.is_active = 1`, id);
  if (!row) return null;
  if (row.expires_at < Date.now()) { destroySession(id); return null; }
  return row;
}

export const destroySession = (id) => run('DELETE FROM sessions WHERE id = ?', id);

export const purgeExpiredSessions = () =>
  run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
