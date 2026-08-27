import { all, get, run, tx, normalizePart } from '../db.js';

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

export function getProductBySlug(slug) {
  return get(`${SELECT_CARD} WHERE p.slug = ? AND p.is_active = 1`, slug);
}

export function getProductFull(id) {
  return get('SELECT * FROM products WHERE id = ?', id);
}

export const getProductSpecs = (id) =>
  all('SELECT * FROM product_specs WHERE product_id = ? ORDER BY sort, id', id);

export const getProductRefs = (id) =>
  all('SELECT * FROM product_refs WHERE product_id = ? ORDER BY id', id);

export const getProductDatasheets = (id) =>
  all('SELECT * FROM datasheets WHERE product_id = ? ORDER BY id', id);

export const listFeaturedProducts = (limit = 6) =>
  all(`${SELECT_CARD} WHERE p.is_active = 1 AND p.is_featured = 1 ORDER BY p.id DESC LIMIT ?`, limit);

export const listRelatedProducts = (product, limit = 4) => all(
  `${SELECT_CARD}
    WHERE p.is_active = 1 AND p.id <> ? AND (p.category_id = (SELECT category_id FROM products WHERE id = ?))
    ORDER BY p.is_featured DESC, p.id DESC LIMIT ?`,
  product.id, product.id, limit,
);

export const countActiveProducts = () =>
  get('SELECT COUNT(*) AS n FROM products WHERE is_active = 1').n;

/* -------------------------------------------------------------------- listings */

const SORTS = {
  relevance: 'p.is_featured DESC, p.id DESC',
  newest: 'p.id DESC',
  part: 'p.part_number COLLATE NOCASE ASC',
  name_sq: 'p.name_sq COLLATE NOCASE ASC',
  name_en: 'p.name_en COLLATE NOCASE ASC',
};

/**
 * Filtered catalogue listing. The SQL string is deterministic per filter shape,
 * so the prepared-statement cache keeps re-use high without dynamic re-parsing.
 */
export function listProducts(filters = {}) {
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

  const items = all(`${SELECT_CARD} WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params, limit, offset);
  const total = get(`SELECT COUNT(*) AS n FROM products p WHERE ${clause}`, ...params).n;
  return { items, total };
}

/* ---------------------------------------------------------------------- search */

/** Turn free text into a safe FTS5 prefix query. */
function ftsQuery(input) {
  const tokens = String(input)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .slice(0, 8);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t.replace(/"/g, '')}"*`).join(' ');
}

/**
 * Part-number-first search. Ranked in tiers so an exact catalogue number always
 * beats a fuzzy title hit, which is what a maintenance engineer expects.
 *   0 exact part number · 1 exact cross-reference · 2 part-number prefix · 3 text
 */
export function searchProductIds(query, limit = 60) {
  const norm = normalizePart(query);
  const seen = new Set();
  const ranked = [];

  const push = (rows) => {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      ranked.push(row.id);
    }
  };

  if (norm.length >= 2) {
    push(all('SELECT id FROM products WHERE part_norm = ? AND is_active = 1 LIMIT ?', norm, limit));
    push(all(
      `SELECT p.id FROM product_refs r JOIN products p ON p.id = r.product_id
        WHERE r.number_norm = ? AND p.is_active = 1 LIMIT ?`, norm, limit));
    if (ranked.length < limit) {
      push(all(
        `SELECT id FROM products WHERE part_norm LIKE ? AND is_active = 1
          ORDER BY LENGTH(part_norm), part_norm LIMIT ?`, `${norm}%`, limit));
    }
    if (ranked.length < limit) {
      push(all(
        `SELECT p.id FROM product_refs r JOIN products p ON p.id = r.product_id
          WHERE r.number_norm LIKE ? AND p.is_active = 1 LIMIT ?`, `${norm}%`, limit));
    }
  }

  if (ranked.length < limit) {
    const fts = ftsQuery(query);
    if (fts) {
      try {
        push(all(
          `SELECT s.rowid AS id FROM product_search s
             JOIN products p ON p.id = s.rowid
            WHERE product_search MATCH ? AND p.is_active = 1
            ORDER BY bm25(product_search, 10.0, 8.0, 3.0, 1.0, 1.0) LIMIT ?`,
          fts, limit));
      } catch { /* malformed FTS expression — fall through to what we have */ }
    }
  }
  return ranked.slice(0, limit);
}

/** Ordered search results (keeps the tier ranking from searchProductIds). */
export function searchProducts(query, { limit = 24, offset = 0 } = {}) {
  const ids = searchProductIds(query, 200);
  const total = ids.length;
  const page = ids.slice(offset, offset + limit);
  if (!page.length) return { items: [], total };
  const rows = all(`${SELECT_CARD} WHERE p.id IN (${page.map(() => '?').join(',')})`, ...page);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return { items: page.map((id) => byId.get(id)).filter(Boolean), total };
}

/** Compact suggestions for the part-number quick lookup. */
export function suggestProducts(query, limit = 8) {
  const ids = searchProductIds(query, limit);
  if (!ids.length) return [];
  const rows = all(
    `SELECT p.id, p.slug, p.part_number, p.name_sq, p.name_en, b.name AS brand_name
       FROM products p LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.id IN (${ids.map(() => '?').join(',')})`, ...ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/** Resolve a bare part number to a product, for quote-basket entries. */
export function findByPartNumber(partNumber) {
  const norm = normalizePart(partNumber);
  if (!norm) return undefined;
  return get('SELECT * FROM products WHERE part_norm = ? AND is_active = 1', norm)
    || get(`SELECT p.* FROM product_refs r JOIN products p ON p.id = r.product_id
             WHERE r.number_norm = ? AND p.is_active = 1`, norm);
}

/* -------------------------------------------------------------------- indexing */

/** Rebuild the FTS row for one product. Called after every write. */
export function reindexProduct(id) {
  run('DELETE FROM product_search WHERE rowid = ?', id);
  const row = get(
    `SELECT p.id, p.part_number, p.name_sq, p.name_en, p.summary_sq, p.summary_en,
            b.name AS brand, c.name_sq AS cat_sq, c.name_en AS cat_en
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?`, id);
  if (!row) return;
  const refs = all('SELECT number FROM product_refs WHERE product_id = ?', id)
    .map((r) => r.number).join(' ');
  run(
    `INSERT INTO product_search (rowid, part_number, refs, title, brand, category)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id, row.part_number, refs,
    `${row.name_sq} ${row.name_en} ${row.summary_sq} ${row.summary_en}`,
    row.brand || '', `${row.cat_sq || ''} ${row.cat_en || ''}`,
  );
}

export function reindexAll() {
  run('DELETE FROM product_search');
  for (const { id } of all('SELECT id FROM products')) reindexProduct(id);
}

/* -------------------------------------------------------------------- writing */

const FIELDS = [
  'part_number', 'slug', 'brand_id', 'category_id', 'name_sq', 'name_en',
  'summary_sq', 'summary_en', 'body_sq', 'body_en', 'unit', 'availability',
  'lead_time_days', 'price_eur', 'is_featured', 'is_active',
];

export function createProduct(data, { specs = [], refs = [] } = {}) {
  return tx(() => {
    const id = run(
      `INSERT INTO products (part_norm, ${FIELDS.join(', ')})
       VALUES (${new Array(FIELDS.length + 1).fill('?').join(', ')})`,
      normalizePart(data.part_number), ...FIELDS.map((f) => data[f] ?? null),
    ).lastInsertRowid;
    writeSpecs(id, specs);
    writeRefs(id, refs);
    reindexProduct(id);
    return id;
  });
}

export function updateProduct(id, data, { specs = null, refs = null } = {}) {
  tx(() => {
    run(
      `UPDATE products SET part_norm = ?, ${FIELDS.map((f) => `${f} = ?`).join(', ')},
              updated_at = datetime('now')
        WHERE id = ?`,
      normalizePart(data.part_number), ...FIELDS.map((f) => data[f] ?? null), id,
    );
    if (specs) writeSpecs(id, specs);
    if (refs) writeRefs(id, refs);
    reindexProduct(id);
  });
}

export function deleteProduct(id) {
  tx(() => {
    run('DELETE FROM product_search WHERE rowid = ?', id);
    run('DELETE FROM products WHERE id = ?', id);
  });
}

function writeSpecs(productId, specs) {
  run('DELETE FROM product_specs WHERE product_id = ?', productId);
  specs.forEach((spec, index) => {
    if (!spec.label_en && !spec.label_sq) return;
    run(
      `INSERT INTO product_specs (product_id, sort, label_sq, label_en, value_sq, value_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
      productId, index,
      spec.label_sq || spec.label_en, spec.label_en || spec.label_sq,
      spec.value_sq || spec.value_en, spec.value_en || spec.value_sq,
    );
  });
}

function writeRefs(productId, refs) {
  run('DELETE FROM product_refs WHERE product_id = ?', productId);
  for (const ref of refs) {
    const number = String(ref.number || '').trim();
    if (!number) continue;
    run(
      `INSERT INTO product_refs (product_id, number, number_norm, kind, note)
       VALUES (?, ?, ?, ?, ?)`,
      productId, number, normalizePart(number), ref.kind || 'equivalent', ref.note || '',
    );
  }
}

/* ------------------------------------------------------------------ datasheets */

export function addDatasheet(data) {
  return run(
    `INSERT INTO datasheets (product_id, title, filename, mime, size_bytes, lang)
     VALUES (?, ?, ?, ?, ?, ?)`,
    data.product_id, data.title, data.filename, data.mime, data.size_bytes, data.lang,
  ).lastInsertRowid;
}

export const getDatasheet = (id) => get('SELECT * FROM datasheets WHERE id = ?', id);
export const deleteDatasheet = (id) => run('DELETE FROM datasheets WHERE id = ?', id);
export const listDatasheets = () => all(
  `SELECT d.*, p.part_number, p.slug FROM datasheets d
     LEFT JOIN products p ON p.id = d.product_id ORDER BY d.id DESC`,
);
