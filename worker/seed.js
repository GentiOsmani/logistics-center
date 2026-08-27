// Generates a SQL file to bulk-load D1 with the same catalogue data
// src/db/seed/index.js seeds the Node/SQLite version with — reusing those
// data files directly, since they're plain arrays with no Node-specific code.
// D1 doesn't have an "INSERT from a JS callback" path the way node:sqlite
// does, so this writes a .sql script instead of executing anything itself:
//
//   node worker/seed.js > worker/seed.sql
//   npx wrangler d1 execute logistics-center --remote --file=worker/seed.sql
//
// Run ADMIN_EMAIL=... ADMIN_PASSWORD=... node worker/seed.js to control the
// seeded admin login; otherwise it falls back to the same defaults as the
// Node version (change the password immediately after first login either way).
import { categories, brands } from '../src/db/seed/taxonomy-data.js';
import { products } from '../src/db/seed/product-data.js';
import { services } from '../src/db/seed/service-data.js';
import { slugify } from './lib/slug.js';
import { hashPassword } from './lib/crypto.js';

function sqlStr(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function sqlNum(value) {
  return value === null || value === undefined || value === '' ? 'NULL' : Number(value);
}

function normalizePart(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function main() {
  // D1's `wrangler d1 execute --file` rejects explicit BEGIN/SAVEPOINT — it
  // manages atomicity itself, so this is just a plain statement list.
  const lines = [];

  categories.forEach((c, i) => {
    lines.push(`INSERT INTO categories (id, slug, name_sq, name_en, summary_sq, summary_en, icon, sort)
      VALUES (${i + 1}, ${sqlStr(c.slug)}, ${sqlStr(c.name_sq)}, ${sqlStr(c.name_en)}, ${sqlStr(c.summary_sq)}, ${sqlStr(c.summary_en)}, ${sqlStr(c.icon)}, ${sqlNum(c.sort)});`);
  });
  const categoryIds = new Map(categories.map((c, i) => [c.slug, i + 1]));

  brands.forEach((b, i) => {
    lines.push(`INSERT INTO brands (id, slug, name, country, summary_sq, summary_en, is_featured, sort)
      VALUES (${i + 1}, ${sqlStr(b.slug)}, ${sqlStr(b.name)}, ${sqlStr(b.country)}, ${sqlStr(b.summary_sq)}, ${sqlStr(b.summary_en)}, ${sqlNum(b.is_featured || 0)}, ${sqlNum(b.sort)});`);
  });
  const brandIds = new Map(brands.map((b, i) => [b.slug, i + 1]));

  services.forEach((s, i) => {
    const id = i + 1;
    lines.push(`INSERT INTO services (id, slug, icon, title_sq, title_en, summary_sq, summary_en, body_sq, body_en, sort)
      VALUES (${id}, ${sqlStr(s.slug)}, ${sqlStr(s.icon)}, ${sqlStr(s.title_sq)}, ${sqlStr(s.title_en)}, ${sqlStr(s.summary_sq)}, ${sqlStr(s.summary_en)}, ${sqlStr(s.body_sq)}, ${sqlStr(s.body_en)}, ${sqlNum(s.sort)});`);
    (s.points || []).forEach(([sq, en], index) => {
      lines.push(`INSERT INTO service_points (service_id, sort, text_sq, text_en) VALUES (${id}, ${index}, ${sqlStr(sq)}, ${sqlStr(en)});`);
    });
  });

  products.forEach((p, i) => {
    const id = i + 1;
    const slug = slugify(`${p.part_number}-${p.name_en}`);
    const partNorm = normalizePart(p.part_number);
    lines.push(`INSERT INTO products (id, part_number, part_norm, slug, brand_id, category_id,
        name_sq, name_en, summary_sq, summary_en, body_sq, body_en, unit, availability,
        lead_time_days, price_eur, is_featured, is_active)
      VALUES (${id}, ${sqlStr(p.part_number)}, ${sqlStr(partNorm)}, ${sqlStr(slug)},
        ${sqlNum(brandIds.get(p.brand) ?? null)}, ${sqlNum(categoryIds.get(p.category) ?? null)},
        ${sqlStr(p.name_sq)}, ${sqlStr(p.name_en)}, ${sqlStr(p.summary_sq || '')}, ${sqlStr(p.summary_en || '')},
        ${sqlStr(p.body_sq || '')}, ${sqlStr(p.body_en || '')}, ${sqlStr(p.unit || 'pcs')},
        ${sqlStr(p.availability || 'on_request')}, ${sqlNum(p.lead_time_days || 0)},
        ${sqlNum(p.price_eur ?? null)}, ${sqlNum(p.is_featured || 0)}, 1);`);

    (p.specs || []).forEach(([label_sq, label_en, value_sq, value_en], index) => {
      lines.push(`INSERT INTO product_specs (product_id, sort, label_sq, label_en, value_sq, value_en)
        VALUES (${id}, ${index}, ${sqlStr(label_sq)}, ${sqlStr(label_en)}, ${sqlStr(value_sq)}, ${sqlStr(value_en)});`);
    });
    (p.refs || []).forEach((ref) => {
      lines.push(`INSERT INTO product_refs (product_id, number, number_norm, kind, note)
        VALUES (${id}, ${sqlStr(ref.number)}, ${sqlStr(normalizePart(ref.number))}, ${sqlStr(ref.kind || 'equivalent')}, ${sqlStr(ref.note || '')});`);
    });
  });

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@logisticscenter.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ndrysho-fjalekalimin';
  const hash = await hashPassword(adminPassword);
  lines.push(`INSERT INTO users (email, name, password_hash, role) VALUES (${sqlStr(adminEmail)}, 'Administrator', ${sqlStr(hash)}, 'admin');`);

  process.stdout.write(lines.join('\n') + '\n');
  process.stderr.write(`-- Seeded ${categories.length} categories, ${brands.length} brands, ${services.length} services, ${products.length} products.\n-- Admin login: ${adminEmail} / ${adminPassword === 'ndrysho-fjalekalimin' ? '(default — change it!)' : '(from ADMIN_PASSWORD)'}\n`);
}

main();
