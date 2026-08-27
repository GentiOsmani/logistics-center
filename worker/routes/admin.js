// Ported from src/routes/admin.js. Route handler signature changes from
// (actx, req, res, extra) writing to a Node `res` to (actx, request, extra)
// returning a Fetch `Response` — everything else (session/CSRF gate, the
// route table, the CRUD logic, the form readers) is the same shape.
//
// Two behavioral additions vs. the original: datasheet storage moves from a
// local `data/uploads` directory to the `DATASHEETS` R2 bucket, and every
// successful mutating request fires `triggerRebuild()` so the static site
// picks up the change (see worker/lib/rebuild.js).

import { Router } from '../../src/core/router.js';
import { loginPage } from '../../src/views/admin/shell.js';
import { confirmPage } from '../../src/views/admin/confirm.js';
import {
  dashboardPage, productListPage, productFormPage,
  categoriesPage, brandsPage, inquiriesPage, inquiryPage, datasheetsPage,
} from '../../src/views/admin/pages.js';

import * as taxonomy from '../repo/taxonomy.js';
import * as catalogue from '../repo/products.js';
import * as inquiries from '../repo/inquiries.js';
import * as users from '../repo/users.js';

import { slugify, uniqueSlug } from '../lib/slug.js';
import { str, text, int, decimal, bool, oneOf } from '../lib/validate.js';
import { checkRateLimit, clientIp } from '../lib/rate-limit.js';
import { serializeCookie } from '../lib/cookies.js';
import { readForm } from '../lib/body.js';
import { html, redirect, text as textResponse } from '../lib/respond.js';
import { triggerRebuild } from '../lib/rebuild.js';
import { createDb } from '../db.js';

const SESSION_COOKIE = 'bg_admin';
const PAGE_SIZE = 30;

const router = new Router();

const extname = (filename) => {
  const i = filename.lastIndexOf('.');
  return i === -1 ? '' : filename.slice(i).toLowerCase();
};

/* ------------------------------------------------------------------ auth */

router.get('/admin/login', async (actx) => {
  if (actx.session) return redirect('/admin');
  return html(loginPage(actx), { cache: 'no-store' });
});

router.post('/admin/login', async (actx, request, { form }) => {
  const email = str(form.email, 160);

  const allowed = await checkRateLimit(actx.db, `login:${clientIp(request)}`, { limit: 8, windowMs: 15 * 60_000 });
  if (!allowed) {
    return html(loginPage(actx, { error: 'Too many attempts. Please wait a few minutes.', email }),
      { status: 429, cache: 'no-store' });
  }

  const user = await users.authenticate(actx.db, email, String(form.password || ''));
  if (!user) {
    return html(loginPage(actx, { error: 'Incorrect email or password.', email }),
      { status: 401, cache: 'no-store' });
  }

  const session = await users.createSession(actx.db, user.id);
  return redirect('/admin', 302, {
    'Set-Cookie': serializeCookie(SESSION_COOKIE, session.id, {
      maxAge: 8 * 3600, secure: actx.secure, sameSite: 'Strict',
    }),
  });
});

router.post('/admin/logout', async (actx) => {
  if (actx.session) await users.destroySession(actx.db, actx.session.id);
  return redirect('/admin/login', 302, {
    'Set-Cookie': serializeCookie(SESSION_COOKIE, '', { maxAge: 0, secure: actx.secure, sameSite: 'Strict' }),
  });
});

/* ------------------------------------------------------------- dashboard */

router.get('/admin', async (actx) => {
  const stats = await inquiries.inquiryStats(actx.db);
  stats.products = await catalogue.countActiveProducts(actx.db);

  const [recent, categories, brands, services, datasheets] = await Promise.all([
    inquiries.listInquiries(actx.db, { limit: 10 }),
    taxonomy.listCategories(actx.db, true),
    taxonomy.listBrands(actx.db, true),
    taxonomy.listServices(actx.db, true),
    catalogue.listDatasheets(actx.db),
  ]);

  return html(dashboardPage(actx, {
    stats,
    recent: recent.items,
    lowInfo: [
      ['Products', stats.products],
      ['Categories', categories.length],
      ['Brands', brands.length],
      ['Services', services.length],
      ['Datasheets', datasheets.length],
      ['Total inquiries', stats.total],
    ],
  }), { cache: 'no-store' });
});

/* -------------------------------------------------------------- products */

router.get('/admin/products', async (actx, request, { query }) => {
  const q = str(query.get('q') || '', 80);
  const pageNum = int(query.get('page'), { min: 1, max: 999, fallback: 1 });
  const offset = (pageNum - 1) * PAGE_SIZE;

  let result;
  if (q) {
    const ids = await catalogue.searchProductIds(actx.db, q, 400);
    result = ids.length
      ? await catalogue.listProducts(actx.db, { ids, limit: PAGE_SIZE, offset, sort: 'part' })
      : { items: [], total: 0 };
  } else {
    result = await catalogue.listProducts(actx.db, { limit: PAGE_SIZE, offset, sort: 'part' });
  }

  return html(productListPage(actx, {
    items: result.items, total: result.total, pageNum, pageSize: PAGE_SIZE, q,
  }), { cache: 'no-store' });
});

router.get('/admin/products/new', async (actx) => {
  const [categories, brands] = await Promise.all([
    taxonomy.listCategories(actx.db, true),
    taxonomy.listBrands(actx.db, true),
  ]);
  return html(productFormPage(actx, {
    product: { availability: 'on_request', unit: 'pcs', lead_time_days: 0 },
    specs: [], refs: [], datasheets: [], categories, brands,
  }), { cache: 'no-store' });
});

router.post('/admin/products/new', async (actx, request, { form }) => {
  const data = await readProductForm(actx.db, form, null);
  const id = await catalogue.createProduct(actx.db, data, {
    specs: readSpecs(form), refs: readRefs(form),
  });
  actx.rebuild = true;
  return redirect(`/admin/products/${id}`);
});

router.get('/admin/products/:id', async (actx, request, { params }) => {
  const product = await catalogue.getProductFull(actx.db, Number(params.id));
  if (!product) return null;
  const [specs, refs, datasheets, categories, brands] = await Promise.all([
    catalogue.getProductSpecs(actx.db, product.id),
    catalogue.getProductRefs(actx.db, product.id),
    catalogue.getProductDatasheets(actx.db, product.id),
    taxonomy.listCategories(actx.db, true),
    taxonomy.listBrands(actx.db, true),
  ]);
  return html(productFormPage(actx, { product, specs, refs, datasheets, categories, brands }), { cache: 'no-store' });
});

router.post('/admin/products/:id', async (actx, request, { params, form }) => {
  const id = Number(params.id);
  const existing = await catalogue.getProductFull(actx.db, id);
  if (!existing) return null;
  await catalogue.updateProduct(actx.db, id, await readProductForm(actx.db, form, existing), {
    specs: readSpecs(form), refs: readRefs(form),
  });
  actx.flash = { kind: 'ok', text: 'Product saved.' };
  actx.rebuild = true;
  return redirect(`/admin/products/${id}`);
});

router.get('/admin/products/:id/delete', async (actx, request, { params }) => {
  const product = await catalogue.getProductFull(actx.db, Number(params.id));
  if (!product) return null;
  return html(confirmPage(actx, {
    title: 'Delete product',
    what: `${product.part_number} — ${product.name_en}`,
    detail: 'Specifications, cross-references and datasheet records will be removed too.',
    action: `/admin/products/${product.id}/delete`,
    cancel: `/admin/products/${product.id}`,
  }), { cache: 'no-store' });
});

router.post('/admin/products/:id/delete', async (actx, request, { params }) => {
  await catalogue.deleteProduct(actx.db, Number(params.id));
  actx.rebuild = true;
  return redirect('/admin/products');
});

/* ------------------------------------------------------------ categories */

router.get('/admin/categories', async (actx, request, { query }) => {
  const editId = Number(query.get('edit'));
  const categories = await taxonomy.listCategories(actx.db, true);
  return html(categoriesPage(actx, {
    categories,
    editing: editId ? await taxonomy.getCategory(actx.db, editId) : null,
  }), { cache: 'no-store' });
});

router.post('/admin/categories', async (actx, request, { form }) => {
  await taxonomy.createCategory(actx.db, await readCategoryForm(actx.db, form, null));
  actx.rebuild = true;
  return redirect('/admin/categories');
});

router.post('/admin/categories/:id', async (actx, request, { params, form }) => {
  const id = Number(params.id);
  const existing = await taxonomy.getCategory(actx.db, id);
  if (!existing) return null;
  await taxonomy.updateCategory(actx.db, id, await readCategoryForm(actx.db, form, existing));
  actx.rebuild = true;
  return redirect('/admin/categories');
});

router.get('/admin/categories/:id/delete', async (actx, request, { params }) => {
  const category = await taxonomy.getCategory(actx.db, Number(params.id));
  if (!category) return null;
  return html(confirmPage(actx, {
    title: 'Delete category',
    what: category.name_en,
    detail: 'Products in this category are kept but become uncategorised.',
    action: `/admin/categories/${category.id}/delete`,
    cancel: '/admin/categories',
  }), { cache: 'no-store' });
});

router.post('/admin/categories/:id/delete', async (actx, request, { params }) => {
  await taxonomy.deleteCategory(actx.db, Number(params.id));
  actx.rebuild = true;
  return redirect('/admin/categories');
});

/* ---------------------------------------------------------------- brands */

router.get('/admin/brands', async (actx, request, { query }) => {
  const editId = Number(query.get('edit'));
  const brands = await taxonomy.listBrands(actx.db, true);
  return html(brandsPage(actx, {
    brands,
    editing: editId ? await taxonomy.getBrand(actx.db, editId) : null,
  }), { cache: 'no-store' });
});

router.post('/admin/brands', async (actx, request, { form }) => {
  await taxonomy.createBrand(actx.db, await readBrandForm(actx.db, form, null));
  actx.rebuild = true;
  return redirect('/admin/brands');
});

router.post('/admin/brands/:id', async (actx, request, { params, form }) => {
  const id = Number(params.id);
  const existing = await taxonomy.getBrand(actx.db, id);
  if (!existing) return null;
  await taxonomy.updateBrand(actx.db, id, await readBrandForm(actx.db, form, existing));
  actx.rebuild = true;
  return redirect('/admin/brands');
});

router.get('/admin/brands/:id/delete', async (actx, request, { params }) => {
  const brand = await taxonomy.getBrand(actx.db, Number(params.id));
  if (!brand) return null;
  return html(confirmPage(actx, {
    title: 'Delete brand',
    what: brand.name,
    detail: 'Products from this brand are kept but lose their brand link.',
    action: `/admin/brands/${brand.id}/delete`,
    cancel: '/admin/brands',
  }), { cache: 'no-store' });
});

router.post('/admin/brands/:id/delete', async (actx, request, { params }) => {
  await taxonomy.deleteBrand(actx.db, Number(params.id));
  actx.rebuild = true;
  return redirect('/admin/brands');
});

/* ------------------------------------------------------------- inquiries */

router.get('/admin/inquiries', async (actx, request, { query }) => {
  const filter = {
    status: oneOf(query.get('status'), ['new', 'in_progress', 'answered', 'closed'], ''),
    kind: oneOf(query.get('kind'), ['quote', 'support', 'contact'], ''),
  };
  const pageNum = int(query.get('page'), { min: 1, max: 999, fallback: 1 });
  const { items, total } = await inquiries.listInquiries(actx.db, {
    ...filter, limit: PAGE_SIZE, offset: (pageNum - 1) * PAGE_SIZE,
  });
  return html(inquiriesPage(actx, { items, total, filter, pageNum, pageSize: PAGE_SIZE }), { cache: 'no-store' });
});

router.get('/admin/inquiries/:id', async (actx, request, { params }) => {
  const inquiry = await inquiries.getInquiry(actx.db, Number(params.id));
  if (!inquiry) return null;
  const items = await inquiries.getInquiryItems(actx.db, inquiry.id);
  return html(inquiryPage(actx, { inquiry, items }), { cache: 'no-store' });
});

router.post('/admin/inquiries/:id', async (actx, request, { params, form }) => {
  await inquiries.updateInquiry(actx.db, Number(params.id), {
    status: oneOf(form.status, ['new', 'in_progress', 'answered', 'closed'], 'new'),
    internal_note: text(form.internal_note, 4000),
  });
  return redirect(`/admin/inquiries/${params.id}`);
});

router.get('/admin/inquiries/:id/delete', async (actx, request, { params }) => {
  const inquiry = await inquiries.getInquiry(actx.db, Number(params.id));
  if (!inquiry) return null;
  return html(confirmPage(actx, {
    title: 'Delete inquiry',
    what: `${inquiry.ref} — ${inquiry.name}`,
    action: `/admin/inquiries/${inquiry.id}/delete`,
    cancel: `/admin/inquiries/${inquiry.id}`,
  }), { cache: 'no-store' });
});

router.post('/admin/inquiries/:id/delete', async (actx, request, { params }) => {
  await inquiries.deleteInquiry(actx.db, Number(params.id));
  return redirect('/admin/inquiries');
});

/* ------------------------------------------------------------ datasheets */

router.get('/admin/datasheets', async (actx) => {
  const datasheets = await catalogue.listDatasheets(actx.db);
  return html(datasheetsPage(actx, { datasheets }), { cache: 'no-store' });
});

// No live file storage: R2 needs a card-verified Cloudflare account, which
// wasn't available here (see deploy/README.md). Datasheet PDFs are instead
// committed straight into the repo under data/datasheets/ and copied into
// dist/files/ at build time (build/generate.js); this route just registers
// the metadata row pointing at that filename.
router.post('/admin/datasheets', async (actx, request, { form }) => {
  const productId = Number(form.product_id) || null;
  const filename = str(form.filename, 140);
  if (filename) {
    const ext = extname(filename);
    await catalogue.addDatasheet(actx.db, {
      product_id: productId,
      title: str(form.title, 140) || filename,
      filename,
      mime: ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'application/pdf',
      size_bytes: 0,
      lang: oneOf(form.lang, ['en', 'sq', 'de'], 'en'),
    });
    actx.rebuild = true;
  }
  return redirect(productId ? `/admin/products/${productId}` : '/admin/datasheets');
});

router.get('/admin/datasheets/:id/delete', async (actx, request, { params }) => {
  const sheet = await catalogue.getDatasheet(actx.db, Number(params.id));
  if (!sheet) return null;
  return html(confirmPage(actx, {
    title: 'Delete datasheet',
    what: sheet.title,
    detail: sheet.filename,
    action: `/admin/datasheets/${sheet.id}/delete`,
    cancel: sheet.product_id ? `/admin/products/${sheet.product_id}` : '/admin/datasheets',
  }), { cache: 'no-store' });
});

router.post('/admin/datasheets/:id/delete', async (actx, request, { params }) => {
  const sheet = await catalogue.getDatasheet(actx.db, Number(params.id));
  if (sheet) {
    // Only removes the metadata row — the PDF itself lives in the repo under
    // data/datasheets/ and is removed with a separate commit if desired.
    await catalogue.deleteDatasheet(actx.db, sheet.id);
    actx.rebuild = true;
  }
  return redirect('/admin/datasheets');
});

/* --------------------------------------------------------- form readers */

async function readProductForm(db, form, existing) {
  const partNumber = str(form.part_number, 64);
  const wanted = str(form.slug, 90) || `${partNumber}-${str(form.name_en, 60)}`;
  const slug = existing && slugify(wanted) === existing.slug
    ? existing.slug
    : await uniqueSlug(wanted, async (candidate) => {
        const row = await db.get('SELECT id FROM products WHERE slug = ?', candidate);
        return Boolean(row) && row.id !== existing?.id;
      });

  return {
    part_number: partNumber,
    slug,
    brand_id: Number(form.brand_id) || null,
    category_id: Number(form.category_id) || null,
    name_sq: str(form.name_sq, 200),
    name_en: str(form.name_en, 200),
    summary_sq: str(form.summary_sq, 400),
    summary_en: str(form.summary_en, 400),
    body_sq: text(form.body_sq, 4000),
    body_en: text(form.body_en, 4000),
    unit: str(form.unit, 12) || 'pcs',
    availability: oneOf(form.availability, ['in_stock', 'lead_time', 'on_request'], 'on_request'),
    lead_time_days: int(form.lead_time_days, { min: 0, max: 365, fallback: 0 }),
    price_eur: decimal(form.price_eur, null),
    is_featured: bool(form.is_featured),
    is_active: bool(form.is_active),
  };
}

function readSpecs(form) {
  const labelsSq = toArray(form.spec_label_sq);
  const labelsEn = toArray(form.spec_label_en);
  const valuesSq = toArray(form.spec_value_sq);
  const valuesEn = toArray(form.spec_value_en);
  const out = [];
  for (let i = 0; i < labelsEn.length; i++) {
    const label_en = str(labelsEn[i], 80);
    const label_sq = str(labelsSq[i], 80);
    if (!label_en && !label_sq) continue;
    out.push({ label_sq, label_en, value_sq: str(valuesSq[i], 160), value_en: str(valuesEn[i], 160) });
  }
  return out;
}

function readRefs(form) {
  const numbers = toArray(form.ref_number);
  const kinds = toArray(form.ref_kind);
  const notes = toArray(form.ref_note);
  const out = [];
  for (let i = 0; i < numbers.length; i++) {
    const number = str(numbers[i], 64);
    if (!number) continue;
    out.push({ number, kind: oneOf(kinds[i], ['equivalent', 'oem', 'superseded'], 'equivalent'), note: str(notes[i], 120) });
  }
  return out;
}

async function readCategoryForm(db, form, existing) {
  const name = str(form.name_en, 80);
  const slug = str(form.slug, 80) || existing?.slug || await uniqueSlug(name, async (c) =>
    Boolean(await db.get('SELECT id FROM categories WHERE slug = ? AND id <> ?', c, existing?.id ?? 0)));
  return {
    slug,
    name_sq: str(form.name_sq, 80),
    name_en: name,
    summary_sq: str(form.summary_sq, 300),
    summary_en: str(form.summary_en, 300),
    icon: str(form.icon, 30) || 'cube',
    sort: int(form.sort, { min: -999, max: 9999, fallback: 0 }),
    is_active: bool(form.is_active),
  };
}

async function readBrandForm(db, form, existing) {
  const name = str(form.name, 80);
  const slug = str(form.slug, 80) || existing?.slug || await uniqueSlug(name, async (c) =>
    Boolean(await db.get('SELECT id FROM brands WHERE slug = ? AND id <> ?', c, existing?.id ?? 0)));
  return {
    slug,
    name,
    country: str(form.country, 4).toUpperCase(),
    summary_sq: str(form.summary_sq, 300),
    summary_en: str(form.summary_en, 300),
    website: str(form.website, 200),
    is_featured: bool(form.is_featured),
    sort: int(form.sort, { min: -999, max: 9999, fallback: 0 }),
    is_active: bool(form.is_active),
  };
}

const toArray = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

/* -------------------------------------------------------------- dispatch */

function verifyCsrf(actx, submitted) {
  return Boolean(actx.csrf) && submitted === actx.csrf;
}

/**
 * Admin entry point. Handles session lookup, CSRF for state-changing requests
 * and the login gate before delegating to the router above.
 *
 * @param {Request} request
 * @param {object} env — the Worker's bindings (DB, DATASHEETS, secrets)
 * @param {URL} url
 * @param {(p: Promise) => void} waitUntil — extends the Worker's lifetime for
 *   the fire-and-forget rebuild trigger past the point the response is sent
 */
export async function dispatchAdmin(request, env, url, waitUntil) {
  const db = createDb(env.DB);
  const cookies = parseCookiesHeader(request.headers.get('cookie'));
  const session = await users.getSession(db, cookies[SESSION_COOKIE]);
  const pathname = url.pathname;

  const actx = {
    pathname,
    session,
    secure: true,
    user: session ? { name: session.name, email: session.email, role: session.role } : null,
    csrf: session?.csrf || '',
    counts: { openInquiries: session ? (await inquiries.inquiryStats(db)).open : 0 },
    flash: null,
    rebuild: false,
    asset: (path) => path,
    filesOrigin: env.PAGES_ORIGIN || '',
    db,
    env,
  };

  const isLoginRoute = pathname === '/admin/login';
  if (!session && !isLoginRoute) return redirect('/admin/login', 302);

  let form = Object.create(null);
  if (request.method === 'POST') {
    form = (await readForm(request)).fields;
    if (session && !verifyCsrf(actx, form._csrf)) {
      return textResponse('Invalid or expired form token. Reload and try again.', { status: 403 });
    }
  }

  const match = router.match(request.method, pathname);
  if (!match) return textResponse('Not found', { status: 404 });

  const result = await match.handler(actx, request, { params: match.params, query: url.searchParams, form });
  if (result === null) return textResponse('Not found', { status: 404 });

  if (actx.rebuild) waitUntil(triggerRebuild(env).catch(() => {}));
  return result;
}

function parseCookiesHeader(header) {
  const out = Object.create(null);
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}
