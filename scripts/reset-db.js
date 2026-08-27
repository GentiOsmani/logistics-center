import { rmSync } from 'node:fs';
import { config } from '../src/config.js';

for (const suffix of ['', '-wal', '-shm']) {
  try { rmSync(config.dbFile + suffix, { force: true }); } catch { /* ignore */ }
}
console.log('Removed', config.dbFile);
