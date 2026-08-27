import { all, get, run } from '../db.js';

/* ------------------------------------------------------------------ categories */

export const listCategories = (includeHidden = false) => all(
  `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
     FROM categories c
    WHERE (? = 1 OR c.is_active = 1)
    ORDER BY c.sort, c.name_en`,
  includeHidden ? 1 : 0,
);

export const getCategory = (id) => get('SELECT * FROM categories WHERE id = ?', id);

export function createCategory(data) {
  return run(
    `INSERT INTO categories (slug, name_sq, name_en, summary_sq, summary_en, icon, sort, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    data.slug, data.name_sq, data.name_en, data.summary_sq, data.summary_en,
    data.icon, data.sort, data.is_active,
  ).lastInsertRowid;
}

export function updateCategory(id, data) {
  run(
    `UPDATE categories SET slug = ?, name_sq = ?, name_en = ?, summary_sq = ?,
            summary_en = ?, icon = ?, sort = ?, is_active = ?
      WHERE id = ?`,
    data.slug, data.name_sq, data.name_en, data.summary_sq, data.summary_en,
    data.icon, data.sort, data.is_active, id,
  );
}

export const deleteCategory = (id) => run('DELETE FROM categories WHERE id = ?', id);

/* ---------------------------------------------------------------------- brands */

export const listBrands = (includeHidden = false) => all(
  `SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id AND p.is_active = 1) AS product_count
     FROM brands b
    WHERE (? = 1 OR b.is_active = 1)
    ORDER BY b.sort, b.name`,
  includeHidden ? 1 : 0,
);

export const listFeaturedBrands = () => all(
  'SELECT * FROM brands WHERE is_active = 1 AND is_featured = 1 ORDER BY sort, name',
);

export const getBrandBySlug = (slug) => get(
  'SELECT * FROM brands WHERE slug = ? AND is_active = 1', slug,
);

export const getBrand = (id) => get('SELECT * FROM brands WHERE id = ?', id);

export function createBrand(data) {
  return run(
    `INSERT INTO brands (slug, name, country, summary_sq, summary_en, website, is_featured, sort, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.slug, data.name, data.country, data.summary_sq, data.summary_en,
    data.website, data.is_featured, data.sort, data.is_active,
  ).lastInsertRowid;
}

export function updateBrand(id, data) {
  run(
    `UPDATE brands SET slug = ?, name = ?, country = ?, summary_sq = ?, summary_en = ?,
            website = ?, is_featured = ?, sort = ?, is_active = ?
      WHERE id = ?`,
    data.slug, data.name, data.country, data.summary_sq, data.summary_en,
    data.website, data.is_featured, data.sort, data.is_active, id,
  );
}

export const deleteBrand = (id) => run('DELETE FROM brands WHERE id = ?', id);

/* -------------------------------------------------------------------- services */

export const listServices = (includeHidden = false) => all(
  `SELECT * FROM services WHERE (? = 1 OR is_active = 1) ORDER BY sort, id`,
  includeHidden ? 1 : 0,
);

export const getServiceBySlug = (slug) => get(
  'SELECT * FROM services WHERE slug = ? AND is_active = 1', slug,
);

export const listServicePoints = (serviceId) => all(
  'SELECT * FROM service_points WHERE service_id = ? ORDER BY sort, id', serviceId,
);
