import { db, get, run, tx } from '../db.js';
import { createProduct, reindexAll } from '../repo/products.js';
import { countUsers, createUser } from '../repo/users.js';
import { slugify } from '../../lib/slug.js';
import { categories, brands } from './taxonomy-data.js';
import { products } from './product-data.js';
import { services } from './service-data.js';

/** Idempotent: safe to run against an existing database. */
export function seed({ force = false } = {}) {
  const already = get('SELECT COUNT(*) AS n FROM products').n;
  if (already > 0 && !force) return { skipped: true };

  if (force) {
    tx(() => {
      for (const table of ['product_search', 'product_specs', 'product_refs', 'datasheets',
        'products', 'service_points', 'services', 'brands', 'categories']) {
        db.exec(`DELETE FROM ${table}`);
      }
    });
  }

  const categoryIds = new Map();
  const brandIds = new Map();

  tx(() => {
    for (const c of categories) {
      const id = run(
        `INSERT INTO categories (slug, name_sq, name_en, summary_sq, summary_en, icon, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        c.slug, c.name_sq, c.name_en, c.summary_sq, c.summary_en, c.icon, c.sort,
      ).lastInsertRowid;
      categoryIds.set(c.slug, id);
    }

    for (const b of brands) {
      const id = run(
        `INSERT INTO brands (slug, name, country, summary_sq, summary_en, is_featured, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        b.slug, b.name, b.country, b.summary_sq, b.summary_en, b.is_featured, b.sort,
      ).lastInsertRowid;
      brandIds.set(b.slug, id);
    }

    for (const s of services) {
      const id = run(
        `INSERT INTO services (slug, icon, title_sq, title_en, summary_sq, summary_en, body_sq, body_en, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s.slug, s.icon, s.title_sq, s.title_en, s.summary_sq, s.summary_en,
        s.body_sq, s.body_en, s.sort,
      ).lastInsertRowid;
      s.points.forEach(([sq, en], index) => {
        run('INSERT INTO service_points (service_id, sort, text_sq, text_en) VALUES (?, ?, ?, ?)',
          id, index, sq, en);
      });
    }
  });

  for (const p of products) {
    createProduct({
      part_number: p.part_number,
      slug: slugify(`${p.part_number}-${p.name_en}`),
      brand_id: brandIds.get(p.brand) ?? null,
      category_id: categoryIds.get(p.category) ?? null,
      name_sq: p.name_sq,
      name_en: p.name_en,
      summary_sq: p.summary_sq || '',
      summary_en: p.summary_en || '',
      body_sq: p.body_sq || '',
      body_en: p.body_en || '',
      unit: p.unit || 'pcs',
      availability: p.availability || 'on_request',
      lead_time_days: p.lead_time_days || 0,
      price_eur: p.price_eur ?? null,
      is_featured: p.is_featured || 0,
      is_active: 1,
    }, {
      specs: (p.specs || []).map(([label_sq, label_en, value_sq, value_en]) =>
        ({ label_sq, label_en, value_sq, value_en })),
      refs: p.refs || [],
    });
  }

  reindexAll();

  if (countUsers() === 0) {
    createUser({
      email: process.env.ADMIN_EMAIL || 'admin@logisticscenter.com',
      name: 'Administrator',
      password: process.env.ADMIN_PASSWORD || 'ndrysho-fjalekalimin',
      role: 'admin',
    });
  }

  return {
    skipped: false,
    categories: categories.length,
    brands: brands.length,
    services: services.length,
    products: products.length,
  };
}
