// Static site generator. Renders every public page to dist/ using the exact
// same view functions the Node server used (src/views/**) — those are pure
// functions of (ctx, data) with no DB or HTTP coupling, so nothing about them
// needed to change; only the data source and the per-request ctx did (see
// build/context.js).
//
// Usage:
//   node build/generate.js --local                         (seed data, no Worker needed)
//   WORKER_ORIGIN=https://x.workers.dev node build/generate.js   (real data via GET /api/export)
//
// Env vars (see deploy/README.md for where these come from):
//   SITE_ORIGIN   e.g. https://yourname.github.io   (no trailing slash)
//   BASE_PATH     e.g. /your-repo-name              (empty string for a user/org page)
//   WORKER_ORIGIN e.g. https://logistics-center-api.yourname.workers.dev

import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOCALES, DEFAULT_LOCALE } from '../src/config.js';
import { buildContext } from './context.js';
import { loadLocalExport } from './local-data.js';

import { homePage } from '../src/views/pages/home.js';
import { productsPage } from '../src/views/pages/products.js';
import { productPage } from '../src/views/pages/product.js';
import { brandsPage, brandPage } from '../src/views/pages/brands.js';
import { servicesPage, servicePage } from '../src/views/pages/services.js';
import { supportPage } from '../src/views/pages/support.js';
import { quotePage } from '../src/views/pages/quote.js';
import { contactPage, aboutPage, errorPage } from '../src/views/pages/misc.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(ROOT, '..');
const DIST = join(REPO_ROOT, 'dist');

const site = {
  origin: (process.env.SITE_ORIGIN || 'http://localhost:8080').replace(/\/$/, ''),
  basePath: (process.env.BASE_PATH || '').replace(/\/$/, ''),
  workerOrigin: (process.env.WORKER_ORIGIN || '').replace(/\/$/, ''),
};
const useLocal = process.argv.includes('--local') || !process.env.WORKER_ORIGIN;

async function loadData() {
  if (useLocal) return loadLocalExport();
  const res = await fetch(`${site.workerOrigin}/api/export`);
  if (!res.ok) throw new Error(`GET /api/export failed: ${res.status}`);
  return res.json();
}

const RUNTIME_TAGS = `
<script>window.__SITE__=${JSON.stringify({ basePath: site.basePath, workerOrigin: site.workerOrigin })};</script>
<script defer src="${site.basePath}/assets/js/cart.js"></script>
<script defer src="${site.basePath}/assets/js/catalogue.js"></script>
<script defer src="${site.basePath}/assets/js/forms.js"></script>
</body>`;

function write(path, raw) {
  const full = join(DIST, path);
  let content = String(raw);
  // Every generated page needs cart.js (nav badge + "add to quote"
  // interception) and forms.js (support/contact submission) — they weren't
  // wired through the per-page `script` param (see layout.js's page()) since
  // that would also affect the Node server's own rendering; injecting here
  // keeps that server's output completely unchanged.
  if (path.endsWith('.html')) content = content.replace('</body>', RUNTIME_TAGS);
  return mkdir(dirname(full), { recursive: true }).then(() => writeFile(full, content));
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  const data = await loadData();
  const specsByProduct = groupBy(data.specs, 'product_id');
  const refsByProduct = groupBy(data.refs, 'product_id');
  const datasheetsByProduct = groupBy(data.datasheets, 'product_id');
  const categoryById = new Map(data.categories.map((c) => [c.id, c]));
  const brandById = new Map(data.brands.map((b) => [b.id, b]));

  const catalogueIndex = data.products.map((p) => ({
    id: p.id, slug: p.slug, part_number: p.part_number, part_norm: p.part_norm,
    name_sq: p.name_sq, name_en: p.name_en, summary_sq: p.summary_sq, summary_en: p.summary_en,
    brand_name: p.brand_name, brand_slug: p.brand_slug,
    category_slug: p.category_slug, category_name_sq: p.category_name_sq, category_name_en: p.category_name_en,
    availability: p.availability, lead_time_days: p.lead_time_days, price_eur: p.price_eur,
    unit: p.unit, is_featured: p.is_featured,
    refs: (refsByProduct[p.id] || []).map((r) => r.number_norm),
  }));
  await write('catalog-index.json', JSON.stringify(catalogueIndex));

  for (const locale of LOCALES) {
    const ctx = (path, search = '') => buildContext({ locale, path: `/${locale}${path}`, search, categories: data.categories, site });

    // ---- home
    await write(`${locale}.html`, homePage(ctx(''), {
      categories: data.categories,
      services: data.services,
      brands: data.brands.filter((b) => b.is_featured),
      featured: data.products.filter((p) => p.is_featured).slice(0, 8),
      productCount: data.products.length,
    }));

    // ---- catalogue (unfiltered — client-side search/filter takes it from here)
    const filters = { q: '', category: '', brand: '', availability: '', sort: 'relevance' };
    await write(`${locale}/products.html`, productsPage(ctx('/products'), {
      items: data.products, total: data.products.length,
      categories: data.categories, brands: data.brands,
      filters, pageNum: 1, pageSize: Math.max(data.products.length, 1),
    }));

    // ---- product detail
    for (const product of data.products) {
      const related = data.products
        .filter((p) => p.id !== product.id && p.category_id === product.category_id)
        .sort((a, b) => (b.is_featured - a.is_featured) || (b.id - a.id))
        .slice(0, 4);
      await write(`${locale}/products/${product.slug}.html`, productPage(ctx(`/products/${product.slug}`), {
        product,
        specs: specsByProduct[product.id] || [],
        refs: refsByProduct[product.id] || [],
        datasheets: datasheetsByProduct[product.id] || [],
        related,
        category: categoryById.get(product.category_id) || null,
        brand: brandById.get(product.brand_id) || null,
        added: false,
      }));
    }

    // ---- brands
    await write(`${locale}/brands.html`, brandsPage(ctx('/brands'), { brands: data.brands }));
    for (const brand of data.brands) {
      const items = data.products.filter((p) => p.brand_id === brand.id);
      await write(`${locale}/brands/${brand.slug}.html`, brandPage(ctx(`/brands/${brand.slug}`), {
        brand, items, total: items.length, pageNum: 1, pageSize: Math.max(items.length, 1),
      }));
    }

    // ---- services
    await write(`${locale}/services.html`, servicesPage(ctx('/services'), { services: data.services }));
    for (const service of data.services) {
      await write(`${locale}/services/${service.slug}.html`, servicePage(ctx(`/services/${service.slug}`), {
        service,
        points: service.points || [],
        others: data.services.filter((s) => s.id !== service.id),
      }));
    }

    // ---- about / contact / support / quote (form shells — client JS owns submission)
    await write(`${locale}/about.html`, aboutPage(ctx('/about'), {
      categories: data.categories, services: data.services,
      productCount: data.products.length, brandCount: data.brands.length,
    }));
    await write(`${locale}/contact.html`, contactPage(ctx('/contact'), {}));
    await write(`${locale}/support.html`, supportPage(ctx('/support'), { services: data.services }));
    await write(`${locale}/quote.html`, quotePage(ctx('/quote'), { items: [] }));
  }

  // ---- 404 (GitHub Pages serves this for any unmatched path, site-wide)
  const errCtx = buildContext({ locale: DEFAULT_LOCALE, path: '/404', categories: data.categories, site });
  await write('404.html', errorPage(errCtx, 404));

  // ---- root redirect (no server-side Accept-Language negotiation on a static host)
  await write('index.html', rootRedirect());

  await write('robots.txt', robotsTxt());
  await write('sitemap.xml', sitemapXml(data, catalogueIndex));

  // ---- static assets (CSS + client JS)
  await cp(join(REPO_ROOT, 'public', 'assets'), join(DIST, 'assets'), { recursive: true });

  // ---- datasheet PDFs (data/datasheets/*, committed to the repo — no R2, see deploy/README.md)
  await cp(join(REPO_ROOT, 'data', 'datasheets'), join(DIST, 'files'), { recursive: true, force: true })
    .catch((error) => { if (error.code !== 'ENOENT') throw error; });

  console.log(`Built ${data.products.length} products × ${LOCALES.length} locales → ${DIST}`);
}

function groupBy(rows, key) {
  const out = {};
  for (const row of rows || []) (out[row[key]] ||= []).push(row);
  return out;
}

function rootRedirect() {
  const target = `${site.basePath}/${DEFAULT_LOCALE}`;
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${target}">
<script>
  var m = /^[a-z]{2}/i.exec(navigator.language || '');
  var lang = m && m[0].toLowerCase() === 'en' ? 'en' : '${DEFAULT_LOCALE}';
  location.replace('${site.basePath}/' + lang);
</script>
</head><body><p>Redirecting… <a href="${target}">Continue</a></p></body></html>`;
}

function robotsTxt() {
  return `User-agent: *\nDisallow: /*/quote\nAllow: /\n\nSitemap: ${site.origin}${site.basePath}/sitemap.xml\n`;
}

function sitemapXml(data, index) {
  const paths = ['', '/products', '/brands', '/services', '/support', '/about', '/contact'];
  for (const c of data.categories) paths.push(`/products?category=${c.slug}`);
  for (const b of data.brands) paths.push(`/brands/${b.slug}`);
  for (const s of data.services) paths.push(`/services/${s.slug}`);
  for (const p of index) paths.push(`/products/${p.slug}`);

  const entries = paths.flatMap((path) => LOCALES.map((locale) => {
    const loc = `${site.origin}${site.basePath}/${locale}${path}`.replace(/&/g, '&amp;');
    const alternates = LOCALES.map((code) =>
      `<xhtml:link rel="alternate" hreflang="${code}" href="${
        `${site.origin}${site.basePath}/${code}${path}`.replace(/&/g, '&amp;')}"/>`).join('');
    return `<url><loc>${loc}</loc>${alternates}</url>`;
  }));

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    + entries.join('') + '</urlset>';
}

main().catch((error) => { console.error(error); process.exit(1); });
