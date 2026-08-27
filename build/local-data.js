// Builds the same shape GET /api/export returns (see worker/routes/api.js),
// but directly from the seed data files — no Worker/D1 needed. Used by
// `npm run build:local` for previewing the static site without a deployment.
import { categories as categoryData, brands as brandData } from '../src/db/seed/taxonomy-data.js';
import { products as productData } from '../src/db/seed/product-data.js';
import { services as serviceData } from '../src/db/seed/service-data.js';
import { slugify } from '../worker/lib/slug.js';

function normalizePart(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function loadLocalExport() {
  const categories = categoryData.map((c, i) => ({ ...c, id: i + 1, is_active: 1 }));
  const brands = brandData.map((b, i) => ({ ...b, id: i + 1, website: b.website || '', is_active: 1 }));
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const brandBySlug = new Map(brands.map((b) => [b.slug, b]));

  const products = [];
  const specs = [];
  const refs = [];
  const datasheets = [];

  productData.forEach((p, i) => {
    const id = i + 1;
    const brand = brandBySlug.get(p.brand);
    const category = categoryBySlug.get(p.category);
    products.push({
      id,
      part_number: p.part_number,
      part_norm: normalizePart(p.part_number),
      slug: slugify(`${p.part_number}-${p.name_en}`),
      brand_id: brand?.id ?? null,
      category_id: category?.id ?? null,
      brand_name: brand?.name || '',
      brand_slug: brand?.slug || '',
      category_name_sq: category?.name_sq || '',
      category_name_en: category?.name_en || '',
      category_slug: category?.slug || '',
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
    });
    (p.specs || []).forEach(([label_sq, label_en, value_sq, value_en], sort) => {
      specs.push({ product_id: id, sort, label_sq, label_en, value_sq, value_en });
    });
    (p.refs || []).forEach((ref) => {
      refs.push({
        product_id: id, number: ref.number, number_norm: normalizePart(ref.number),
        kind: ref.kind || 'equivalent', note: ref.note || '',
      });
    });
  });

  for (const c of categories) {
    c.product_count = products.filter((p) => p.category_id === c.id && p.is_active).length;
  }
  for (const b of brands) {
    b.product_count = products.filter((p) => p.brand_id === b.id && p.is_active).length;
  }

  const services = serviceData.map((s, i) => ({
    ...s, id: i + 1, is_active: 1,
    points: (s.points || []).map(([text_sq, text_en], sort) => ({ sort, text_sq, text_en })),
  }));

  return { products, specs, refs, datasheets, categories, brands, services, generatedAt: new Date().toISOString() };
}
