import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config.js';

mkdirSync(config.dataDir, { recursive: true });
mkdirSync(config.uploadDir, { recursive: true });

export const db = new DatabaseSync(config.dbFile);

// Durability/throughput settings appropriate for a read-heavy catalogue site.
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA temp_store = MEMORY;
  PRAGMA cache_size = -16000;
  PRAGMA busy_timeout = 5000;
`);

db.exec(readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8'));

/**
 * Prepared statements are compiled lazily and cached for the process lifetime —
 * every query in the app goes through here, so nothing re-parses SQL per request.
 */
const cache = new Map();
export function q(sql) {
  let stmt = cache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    cache.set(sql, stmt);
  }
  return stmt;
}

export const all = (sql, ...params) => q(sql).all(...params);
export const get = (sql, ...params) => q(sql).get(...params);
export const run = (sql, ...params) => q(sql).run(...params);

/** Run `fn` inside an IMMEDIATE transaction. */
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Normalised form used for part-number lookups: uppercase alphanumerics only. */
export function normalizePart(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function closeDb() {
  try { db.exec('PRAGMA optimize'); } catch { /* ignore */ }
  db.close();
}
