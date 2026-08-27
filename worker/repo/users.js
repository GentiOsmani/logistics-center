// Ported from src/db/repo/users.js against worker/lib/crypto.js (PBKDF2
// instead of scrypt — see that file's header) instead of src/core/crypto.js.

import { hashPassword, token, verifyPassword } from '../lib/crypto.js';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// A syntactically valid but unreachable PBKDF2 hash, used to keep a login
// miss doing the same amount of work as a hit (timing shouldn't reveal
// whether an account exists).
const DUMMY_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export const listUsers = (db) =>
  db.all('SELECT id, email, name, role, is_active, created_at, last_login_at FROM users ORDER BY id');

export const getUserByEmail = (db, email) =>
  db.get('SELECT * FROM users WHERE lower(email) = lower(?)', email);

export const countUsers = async (db) => (await db.get('SELECT COUNT(*) AS n FROM users')).n;

export async function createUser(db, { email, name, password, role = 'editor' }) {
  const result = await db.run(
    'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)',
    email, name, await hashPassword(password), role,
  );
  return result.lastInsertRowid;
}

export const setPassword = async (db, userId, password) =>
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(password), userId);

/** Returns the user on success, or null. */
export async function authenticate(db, email, password) {
  const user = await getUserByEmail(db, email);
  if (!user || !user.is_active) {
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }
  if (!(await verifyPassword(password, user.password_hash))) return null;
  await db.run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", user.id);
  return user;
}

/* ------------------------------------------------------------------- sessions */

export async function createSession(db, userId) {
  const id = token(24);
  const csrf = token(18);
  await db.run('INSERT INTO sessions (id, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)',
    id, userId, csrf, Date.now() + SESSION_TTL_MS);
  return { id, csrf };
}

export async function getSession(db, id) {
  if (!id) return null;
  const row = await db.get(
    `SELECT s.id, s.csrf, s.expires_at, u.id AS user_id, u.email, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND u.is_active = 1`, id);
  if (!row) return null;
  if (row.expires_at < Date.now()) { await destroySession(db, id); return null; }
  return row;
}

export const destroySession = (db, id) => db.run('DELETE FROM sessions WHERE id = ?', id);

export const purgeExpiredSessions = (db) =>
  db.run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
