// Ported from src/db/repo/taxonomy.js — same SQL, `db` passed explicitly and
// every call awaited (see worker/db.js header for why).

/* ------------------------------------------------------------------ categories */

export const listCategories = (db, includeHidden = false) => db.all(
  `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
     FROM categories c
    WHERE (? = 1 OR c.is_active = 1)
    ORDER BY c.sort, c.name_en`,
  includeHidden ? 1 : 0,
);

export const getCategory = (db, id) => db.get('SELECT * FROM categories WHERE id = ?', id);

export async function createCategory(db, data) {
  const result = await db.run(
    `INSERT INTO categories (slug, name_sq, name_en, summary_sq, summary_en, icon, sort, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    data.slug, data.name_sq, data.name_en, data.summary_sq, data.summary_en,
    data.icon, data.sort, data.is_active,
  );
  return result.lastInsertRowid;
}

export const updateCategory = (db, id, data) => db.run(
  `UPDATE categories SET slug = ?, name_sq = ?, name_en = ?, summary_sq = ?,
          summary_en = ?, icon = ?, sort = ?, is_active = ?
    WHERE id = ?`,
  data.slug, data.name_sq, data.name_en, data.summary_sq, data.summary_en,
  data.icon, data.sort, data.is_active, id,
);

export const deleteCategory = (db, id) => db.run('DELETE FROM categories WHERE id = ?', id);

/* ---------------------------------------------------------------------- brands */

export const listBrands = (db, includeHidden = false) => db.all(
  `SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id AND p.is_active = 1) AS product_count
     FROM brands b
    WHERE (? = 1 OR b.is_active = 1)
    ORDER BY b.sort, b.name`,
  includeHidden ? 1 : 0,
);

export const listFeaturedBrands = (db) => db.all(
  'SELECT * FROM brands WHERE is_active = 1 AND is_featured = 1 ORDER BY sort, name',
);

export const getBrandBySlug = (db, slug) => db.get(
  'SELECT * FROM brands WHERE slug = ? AND is_active = 1', slug,
);

export const getBrand = (db, id) => db.get('SELECT * FROM brands WHERE id = ?', id);

export async function createBrand(db, data) {
  const result = await db.run(
    `INSERT INTO brands (slug, name, country, summary_sq, summary_en, website, is_featured, sort, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.slug, data.name, data.country, data.summary_sq, data.summary_en,
    data.website, data.is_featured, data.sort, data.is_active,
  );
  return result.lastInsertRowid;
}

export const updateBrand = (db, id, data) => db.run(
  `UPDATE brands SET slug = ?, name = ?, country = ?, summary_sq = ?, summary_en = ?,
          website = ?, is_featured = ?, sort = ?, is_active = ?
    WHERE id = ?`,
  data.slug, data.name, data.country, data.summary_sq, data.summary_en,
  data.website, data.is_featured, data.sort, data.is_active, id,
);

export const deleteBrand = (db, id) => db.run('DELETE FROM brands WHERE id = ?', id);

/* -------------------------------------------------------------------- services */

export const listServices = (db, includeHidden = false) => db.all(
  'SELECT * FROM services WHERE (? = 1 OR is_active = 1) ORDER BY sort, id',
  includeHidden ? 1 : 0,
);

export const getServiceBySlug = (db, slug) => db.get(
  'SELECT * FROM services WHERE slug = ? AND is_active = 1', slug,
);

export const listServicePoints = (db, serviceId) =>
  db.all('SELECT * FROM service_points WHERE service_id = ? ORDER BY sort, id', serviceId);
