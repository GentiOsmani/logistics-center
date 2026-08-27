import process from 'node:process';
import { seed } from '../src/db/seed/index.js';
import { closeDb } from '../src/db/db.js';

const force = process.argv.includes('--force');
const result = seed({ force });

if (result.skipped) {
  console.log('Database already contains products — nothing to do. Use --force to reseed.');
} else {
  console.log('Seeded:',
    `${result.categories} categories,`,
    `${result.brands} brands,`,
    `${result.services} services,`,
    `${result.products} products.`);
  console.log('Admin login:', process.env.ADMIN_EMAIL || 'admin@logisticscenter.com');
}
closeDb();
