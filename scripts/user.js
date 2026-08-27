/**
 * Admin user management.
 *   node scripts/user.js list
 *   node scripts/user.js add <email> <name> <password> [admin|editor]
 *   node scripts/user.js password <email> <newPassword>
 *   node scripts/user.js disable <email>
 */
import process from 'node:process';
import {
  listUsers, createUser, setPassword, getUserByEmail,
} from '../src/db/repo/users.js';
import { run, closeDb } from '../src/db/db.js';

const [command, ...args] = process.argv.slice(2);

function usage() {
  console.log(`
  Usage:
    node scripts/user.js list
    node scripts/user.js add <email> <name> <password> [admin|editor]
    node scripts/user.js password <email> <newPassword>
    node scripts/user.js disable <email>
`);
}

try {
  switch (command) {
    case 'list': {
      const users = listUsers();
      if (!users.length) { console.log('  No users.'); break; }
      console.log('\n  id  role    active  email                          last login');
      console.log('  ' + '-'.repeat(70));
      for (const u of users) {
        console.log(
          `  ${String(u.id).padEnd(4)}${u.role.padEnd(8)}${(u.is_active ? 'yes' : 'no').padEnd(8)}`
          + `${u.email.padEnd(31)}${u.last_login_at || '—'}`,
        );
      }
      console.log();
      break;
    }

    case 'add': {
      const [email, name, password, role = 'editor'] = args;
      if (!email || !name || !password) { usage(); break; }
      if (password.length < 10) throw new Error('Password must be at least 10 characters.');
      if (getUserByEmail(email)) throw new Error(`User ${email} already exists.`);
      createUser({ email, name, password, role: role === 'admin' ? 'admin' : 'editor' });
      console.log(`  Created ${role}: ${email}`);
      break;
    }

    case 'password': {
      const [email, password] = args;
      if (!email || !password) { usage(); break; }
      if (password.length < 10) throw new Error('Password must be at least 10 characters.');
      const user = getUserByEmail(email);
      if (!user) throw new Error(`No user ${email}.`);
      setPassword(user.id, password);
      run('DELETE FROM sessions WHERE user_id = ?', user.id); // force re-login everywhere
      console.log(`  Password updated for ${email}; existing sessions revoked.`);
      break;
    }

    case 'disable': {
      const [email] = args;
      const user = email && getUserByEmail(email);
      if (!user) throw new Error(`No user ${email}.`);
      run('UPDATE users SET is_active = 0 WHERE id = ?', user.id);
      run('DELETE FROM sessions WHERE user_id = ?', user.id);
      console.log(`  Disabled ${email}.`);
      break;
    }

    default:
      usage();
  }
} catch (error) {
  console.error(`  Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  closeDb();
}
