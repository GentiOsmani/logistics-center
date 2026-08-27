// Ported from src/db/repo/products.js. Every export gains a leading `db`
// parameter (the per-request D1 adapter from worker/db.js) and becomes async.
// Dropped: `reindexProduct`/`reindexAll` and the FTS5 tier of
// `searchProductIds` — the `product_search` virtual table doesn't exist in
// the D1 schema (worker/db/schema.sql) because full catalogue search now runs
// client-side on the static build (see public/assets/js/catalogue.js) against
// the export from GET /api/export. `searchProductIds` here still exists
// because the admin panel's own product list filter (GET /admin/products?q=)
// needs *some* server-side lookup — it keeps the exact/prefix tiers, which
// are plenty for an internal tool over a catalogue this size.
import { normalizePart } from '../db.js';

const SELECT_CARD = `
  SELECT p.id, p.slug, p.part_number, p.name_sq, p.name_en, p.summary_sq, p.summary_en,
         p.availability, p.lead_time_days, p.price_eur, p.unit, p.is_featured,
         b.name AS brand_name, b.slug AS brand_slug,
         c.name_sq AS category_name_sq, c.name_en AS category_name_en, c.slug AS category_slug,
         (SELECT COUNT(*) FROM datasheets d WHERE d.product_id = p.id) AS datasheet_count
    FROM products p
    LEFT JOIN brands b ON b.id = p.brand_id
    LEFT JOIN categories c ON c.id = p.category_id`;

/* --------------------------------------------------------------------- reading */

export const getProductBySlug = (db, slug) =>
  db.get(`${SELECT_CARD} WHERE p.slug = ? AND p.is_active = 1`, slug);

export const getProductFull = (db, id) =>
  db.get('SELECT * FROM products WHERE id = ?', id);

export const getProductSpecs = (db, id) =>
  db.all('SELECT * FROM product_specs WHERE product_id = ? ORDER BY sort, id', id);

export const getProductRefs = (db, id) =>
  db.all('SELECT * FROM product_refs WHERE product_id = ? ORDER BY id', id);

export const getProductDatasheets = (db, id) =>
  db.all('SELECT * FROM datasheets WHERE product_id = ? ORDER BY id', id);

export const listFeaturedProducts = (db, limit = 6) =>
  db.all(`${SELECT_CARD} WHERE p.is_active = 1 AND p.is_featured = 1 ORDER BY p.id DESC LIMIT ?`, limit);

export const listRelatedProducts = (db, product, limit = 4) => db.all(
  `${SELECT_CARD}
    WHERE p.is_active = 1 AND p.id <> ? AND (p.category_id = (SELECT category_id FROM products WHERE id = ?))
    ORDER BY p.is_featured DESC, p.id DESC LIMIT ?`,
  product.id, product.id, limit,
);

export const countActiveProducts = async (db) =>
  (await db.get('SELECT COUNT(*) AS n FROM products WHERE is_active = 1')).n;

/** Every active product's full detail rows, for GET /api/export. */
export async function listAllForExport(db) {
  const products = await db.all(
    `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug,
            c.name_sq AS category_name_sq, c.name_en AS category_name_en, c.slug AS category_slug
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = 1 ORDER BY p.id`,
  );
  const specs = await db.all('SELECT * FROM product_specs ORDER BY product_id, sort, id');
  const refs = await db.all('SELECT * FROM product_refs ORDER BY product_id, id');
  const datasheets = await db.all('SELECT * FROM datasheets ORDER BY product_id, id');
  return { products, specs, refs, datasheets };
}

/* -------------------------------------------------------------------- listings */

const SORTS = {
  relevance: 'p.is_featured DESC, p.id DESC',
  newest: 'p.id DESC',
  part: 'p.part_number COLLATE NOCASE ASC',
  name_sq: 'p.name_sq COLLATE NOCASE ASC',
  name_en: 'p.name_en COLLATE NOCASE ASC',
};

export async function listProducts(db, filters = {}) {
  const where = ['p.is_active = 1'];
  const params = [];

  if (filters.categoryId) { where.push('p.category_id = ?'); params.push(filters.categoryId); }
  if (filters.brandId) { where.push('p.brand_id = ?'); params.push(filters.brandId); }
  if (filters.availability) { where.push('p.availability = ?'); params.push(filters.availability); }
  if (filters.ids?.length) {
    where.push(`p.id IN (${filters.ids.map(() => '?').join(',')})`);
    params.push(...filters.ids);
  }

  const clause = where.join(' AND ');
  const order = SORTS[filters.sort] || SORTS.relevance;
  const limit = filters.limit ?? 24;
  const offset = filters.offset ?? 0;

  const items = await db.all(`${SELECT_CARD} WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params, limit, offset);
  const total = (await db.get(`SELECT COUNT(*) AS n FROM products p WHERE ${clause}`, ...params)).n;
  return { items, total };
}

/* ---------------------------------------------------------------------- search */

/**
 * Part-number-first search for the admin product list. Ranked in tiers:
 *   0 exact part number · 1 exact cross-reference · 2 part-number prefix · 3 cross-reference prefix
 * (the free-text/FTS tier from the original is dropped — see file header.)
 */
export async function searchProductIds(db, query, limit = 60) {
  const norm = normalizePart(query);
  if (norm.length < 2) return [];
  const seen = new Set();
  const ranked = [];

  const push = (rows) => {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      ranked.push(row.id);
    }
  };

  push(await db.all('SELECT id FROM products WHERE part_norm = ? AND is_active = 1 LIMIT ?', norm, limit));
  push(await db.all(
    `SELECT p.id FROM product_refs r JOIN products p ON p.id = r.product_id
      WHERE r.number_norm = ? AND p.is_active = 1 LIMIT ?`, norm, limit));
  if (ranked.length < limit) {
    push(await db.all(
      `SELECT id FROM products WHERE part_norm LIKE ? AND is_active = 1
        ORDER BY LENGTH(part_norm), part_norm LIMIT ?`, `${norm}%`, limit));
  }
  if (ranked.length < limit) {
    push(await db.all(
      `SELECT p.id FROM product_refs r JOIN products p ON p.id = r.product_id
        WHERE r.number_norm LIKE ? AND p.is_active = 1 LIMIT ?`, `${norm}%`, limit));
  }
  return ranked.slice(0, limit);
}

export async function searchProducts(db, query, { limit = 24, offset = 0 } = {}) {
  const ids = await searchProductIds(db, query, 200);
  const total = ids.length;
  const page = ids.slice(offset, offset + limit);
  if (!page.length) return { items: [], total };
  const rows = await db.all(`${SELECT_CARD} WHERE p.id IN (${page.map(() => '?').join(',')})`, ...page);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return { items: page.map((id) => byId.get(id)).filter(Boolean), total };
}

/** Resolve a bare part number to a product, for quote-submission line matching. */
export async function findByPartNumber(db, partNumber) {
  const norm = normalizePart(partNumber);
  if (!norm) return undefined;
  return (await db.get('SELECT * FROM products WHERE part_norm = ? AND is_active = 1', norm))
    || (await db.get(`SELECT p.* FROM product_refs r JOIN products p ON p.id = r.product_id
             WHERE r.number_norm = ? AND p.is_active = 1`, norm));
}

/* -------------------------------------------------------------------- writing */

const FIELDS = [
  'part_number', 'slug', 'brand_id', 'category_id', 'name_sq', 'name_en',
  'summary_sq', 'summary_en', 'body_sq', 'body_en', 'unit', 'availability',
  'lead_time_days', 'price_eur', 'is_featured', 'is_active',
];

export async function createProduct(db, data, { specs = [], refs = [] } = {}) {
  const inserted = await db.run(
    `INSERT INTO products (part_norm, ${FIELDS.join(', ')})
     VALUES (${new Array(FIELDS.length + 1).fill('?').join(', ')})`,
    normalizePart(data.part_number), ...FIELDS.map((f) => data[f] ?? null),
  );
  const id = inserted.lastInsertRowid;
  await writeSpecs(db, id, specs);
  await writeRefs(db, id, refs);
  return id;
}

export async function updateProduct(db, id, data, { specs = null, refs = null } = {}) {
  await db.run(
    `UPDATE products SET part_norm = ?, ${FIELDS.map((f) => `${f} = ?`).join(', ')},
            updated_at = datetime('now')
      WHERE id = ?`,
    normalizePart(data.part_number), ...FIELDS.map((f) => data[f] ?? null), id,
  );
  if (specs) await writeSpecs(db, id, specs);
  if (refs) await writeRefs(db, id, refs);
}

export const deleteProduct = (db, id) => db.run('DELETE FROM products WHERE id = ?', id);

async function writeSpecs(db, productId, specs) {
  await db.run('DELETE FROM product_specs WHERE product_id = ?', productId);
  let index = 0;
  for (const spec of specs) {
    if (!spec.label_en && !spec.label_sq) continue;
    await db.run(
      `INSERT INTO product_specs (product_id, sort, label_sq, label_en, value_sq, value_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
      productId, index++,
      spec.label_sq || spec.label_en, spec.label_en || spec.label_sq,
      spec.value_sq || spec.value_en, spec.value_en || spec.value_sq,
    );
  }
}

async function writeRefs(db, productId, refs) {
  await db.run('DELETE FROM product_refs WHERE product_id = ?', productId);
  for (const ref of refs) {
    const number = String(ref.number || '').trim();
    if (!number) continue;
    await db.run(
      `INSERT INTO product_refs (product_id, number, number_norm, kind, note)
       VALUES (?, ?, ?, ?, ?)`,
      productId, number, normalizePart(number), ref.kind || 'equivalent', ref.note || '',
    );
  }
}

/* ------------------------------------------------------------------ datasheets */

export async function addDatasheet(db, data) {
  const result = await db.run(
    `INSERT INTO datasheets (product_id, title, filename, mime, size_bytes, lang)
     VALUES (?, ?, ?, ?, ?, ?)`,
    data.product_id, data.title, data.filename, data.mime, data.size_bytes, data.lang,
  );
  return result.lastInsertRowid;
}

export const getDatasheet = (db, id) => db.get('SELECT * FROM datasheets WHERE id = ?', id);
export const deleteDatasheet = (db, id) => db.run('DELETE FROM datasheets WHERE id = ?', id);
export const listDatasheets = (db) => db.all(
  `SELECT d.*, p.part_number, p.slug FROM datasheets d
     LEFT JOIN products p ON p.id = d.product_id ORDER BY d.id DESC`,
);
