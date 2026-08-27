import { writeFile, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';

import { Router } from '../core/router.js';
import { parseForm, parseMultipart } from '../core/body.js';
import { sendHtml, redirect, sendText } from '../core/respond.js';
import { serializeCookie } from '../core/cookies.js';
import { token } from '../core/crypto.js';
import { config } from '../config.js';

import * as taxonomy from '../db/repo/taxonomy.js';
import * as catalogue from '../db/repo/products.js';
import * as inquiries from '../db/repo/inquiries.js';
import * as users from '../db/repo/users.js';
import { get } from '../db/db.js';

import { slugify, uniqueSlug } from '../lib/slug.js';
import { str, text, int, decimal, bool, oneOf } from '../lib/validate.js';
import { RateLimiter, clientIp } from '../lib/rate-limit.js';

import { loginPage } from '../views/admin/shell.js';
import { confirmPage } from '../views/admin/confirm.js';
import {
  dashboardPage, productListPage, productFormPage,
  categoriesPage, brandsPage, inquiriesPage, inquiryPage, datasheetsPage,
} from '../views/admin/pages.js';

const SESSION_COOKIE = 'bg_admin';
const PAGE_SIZE = 30;
const loginLimiter = new RateLimiter({ limit: 8, windowMs: 15 * 60_000 });

const router = new Router();

/* ------------------------------------------------------------------ auth */

router.get('/admin/login', async (actx, req, res) => {
  if (actx.session) return redirect(res, '/admin');
  await sendHtml(req, res, loginPage(actx), { cache: 'no-store' });
});

router.post('/admin/login', async (actx, req, res) => {
  const form = await parseForm(req);
  const email = str(form.email, 160);

  if (!loginLimiter.check(clientIp(req, config.trustProxy))) {
    return sendHtml(req, res, loginPage(actx, {
      error: 'Too many attempts. Please wait a few minutes.', email,
    }), { status: 429, cache: 'no-store' });
  }

  const user = users.authenticate(email, String(form.password || ''));
  if (!user) {
    return sendHtml(req, res, loginPage(actx, {
      error: 'Incorrect email or password.', email,
    }), { status: 401, cache: 'no-store' });
  }

  const session = users.createSession(user.id);
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, session.id, {
    maxAge: 8 * 3600,
    secure: actx.secure,
    sameSite: 'Strict',
  }));
  redirect(res, '/admin');
});

router.post('/admin/logout', async (actx, req, res) => {
  if (actx.session) users.destroySession(actx.session.id);
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE, '', {
    maxAge: 0, secure: actx.secure, sameSite: 'Strict',
  }));
  redirect(res, '/admin/login');
});

/* ------------------------------------------------------------- dashboard */

router.get('/admin', async (actx, req, res) => {
  const stats = inquiries.inquiryStats();
  stats.products = catalogue.countActiveProducts();

  await sendHtml(req, res, dashboardPage(actx, {
    stats,
    recent: inquiries.listInquiries({ limit: 10 }).items,
    lowInfo: [
      ['Products', catalogue.countActiveProducts()],
      ['Categories', taxonomy.listCategories(true).length],
      ['Brands', taxonomy.listBrands(true).length],
      ['Services', taxonomy.listServices(true).length],
      ['Datasheets', catalogue.listDatasheets().length],
      ['Total inquiries', stats.total],
    ],
  }), { cache: 'no-store' });
});

/* -------------------------------------------------------------- products */

router.get('/admin/products', async (actx, req, res, { query }) => {
  const q = str(query.get('q') || '', 80);
  const pageNum = int(query.get('page'), { min: 1, max: 999, fallback: 1 });
  const offset = (pageNum - 1) * PAGE_SIZE;

  let result;
  if (q) {
    const ids = catalogue.searchProductIds(q, 400);
    result = ids.length
      ? catalogue.listProducts({ ids, limit: PAGE_SIZE, offset, sort: 'part' })
      : { items: [], total: 0 };
  } else {
    result = catalogue.listProducts({ limit: PAGE_SIZE, offset, sort: 'part' });
  }

  await sendHtml(req, res, productListPage(actx, {
    items: result.items, total: result.total, pageNum, pageSize: PAGE_SIZE, q,
  }), { cache: 'no-store' });
});

router.get('/admin/products/new', async (actx, req, res) => {
  await sendHtml(req, res, productFormPage(actx, {
    product: { availability: 'on_request', unit: 'pcs', lead_time_days: 0 },
    specs: [], refs: [], datasheets: [],
    categories: taxonomy.listCategories(true),
    brands: taxonomy.listBrands(true),
  }), { cache: 'no-store' });
});

router.post('/admin/products/new', async (actx, req, res) => {
  const form = await parseForm(req);
  const data = readProductForm(form, null);
  const id = catalogue.createProduct(data, {
    specs: readSpecs(form), refs: readRefs(form),
  });
  redirect(res, `/admin/products/${id}`);
});

router.get('/admin/products/:id', async (actx, req, res, { params }) => {
  const product = catalogue.getProductFull(Number(params.id));
  if (!product) return false;
  await sendHtml(req, res, productFormPage(actx, {
    product,
    specs: catalogue.getProductSpecs(product.id),
    refs: catalogue.getProductRefs(product.id),
    datasheets: catalogue.getProductDatasheets(product.id),
    categories: taxonomy.listCategories(true),
    brands: taxonomy.listBrands(true),
  }), { cache: 'no-store' });
  return true;
});

router.post('/admin/products/:id', async (actx, req, res, { params }) => {
  const id = Number(params.id);
  const existing = catalogue.getProductFull(id);
  if (!existing) return false;
  const form = await parseForm(req);
  catalogue.updateProduct(id, readProductForm(form, existing), {
    specs: readSpecs(form), refs: readRefs(form),
  });
  actx.flash = { kind: 'ok', text: 'Product saved.' };
  redirect(res, `/admin/products/${id}`);
  return true;
});

router.get('/admin/products/:id/delete', async (actx, req, res, { params }) => {
  const product = catalogue.getProductFull(Number(params.id));
  if (!product) return false;
  await sendHtml(req, res, confirmPage(actx, {
    title: 'Delete product',
    what: `${product.part_number} — ${product.name_en}`,
    detail: 'Specifications, cross-references and datasheet records will be removed too.',
    action: `/admin/products/${product.id}/delete`,
    cancel: `/admin/products/${product.id}`,
  }), { cache: 'no-store' });
  return true;
});

router.post('/admin/products/:id/delete', async (actx, req, res, { params }) => {
  catalogue.deleteProduct(Number(params.id));
  redirect(res, '/admin/products');
});

/* ------------------------------------------------------------ categories */

router.get('/admin/categories', async (actx, req, res, { query }) => {
  const editId = Number(query.get('edit'));
  await sendHtml(req, res, categoriesPage(actx, {
    categories: taxonomy.listCategories(true),
    editing: editId ? taxonomy.getCategory(editId) : null,
  }), { cache: 'no-store' });
});

router.post('/admin/categories', async (actx, req, res) => {
  const form = await parseForm(req);
  taxonomy.createCategory(readCategoryForm(form, null));
  redirect(res, '/admin/categories');
});

router.post('/admin/categories/:id', async (actx, req, res, { params }) => {
  const id = Number(params.id);
  const existing = taxonomy.getCategory(id);
  if (!existing) return false;
  const form = await parseForm(req);
  taxonomy.updateCategory(id, readCategoryForm(form, existing));
  redirect(res, '/admin/categories');
  return true;
});

router.get('/admin/categories/:id/delete', async (actx, req, res, { params }) => {
  const category = taxonomy.getCategory(Number(params.id));
  if (!category) return false;
  await sendHtml(req, res, confirmPage(actx, {
    title: 'Delete category',
    what: category.name_en,
    detail: 'Products in this category are kept but become uncategorised.',
    action: `/admin/categories/${category.id}/delete`,
    cancel: '/admin/categories',
  }), { cache: 'no-store' });
  return true;
});

router.post('/admin/categories/:id/delete', async (actx, req, res, { params }) => {
  taxonomy.deleteCategory(Number(params.id));
  redirect(res, '/admin/categories');
});

/* ---------------------------------------------------------------- brands */

router.get('/admin/brands', async (actx, req, res, { query }) => {
  const editId = Number(query.get('edit'));
  await sendHtml(req, res, brandsPage(actx, {
    brands: taxonomy.listBrands(true),
    editing: editId ? taxonomy.getBrand(editId) : null,
  }), { cache: 'no-store' });
});

router.post('/admin/brands', async (actx, req, res) => {
  const form = await parseForm(req);
  taxonomy.createBrand(readBrandForm(form, null));
  redirect(res, '/admin/brands');
});

router.post('/admin/brands/:id', async (actx, req, res, { params }) => {
  const id = Number(params.id);
  const existing = taxonomy.getBrand(id);
  if (!existing) return false;
  const form = await parseForm(req);
  taxonomy.updateBrand(id, readBrandForm(form, existing));
  redirect(res, '/admin/brands');
  return true;
});

router.get('/admin/brands/:id/delete', async (actx, req, res, { params }) => {
  const brand = taxonomy.getBrand(Number(params.id));
  if (!brand) return false;
  await sendHtml(req, res, confirmPage(actx, {
    title: 'Delete brand',
    what: brand.name,
    detail: 'Products from this brand are kept but lose their brand link.',
    action: `/admin/brands/${brand.id}/delete`,
    cancel: '/admin/brands',
  }), { cache: 'no-store' });
  return true;
});

router.post('/admin/brands/:id/delete', async (actx, req, res, { params }) => {
  taxonomy.deleteBrand(Number(params.id));
  redirect(res, '/admin/brands');
});

/* ------------------------------------------------------------- inquiries */

router.get('/admin/inquiries', async (actx, req, res, { query }) => {
  const filter = {
    status: oneOf(query.get('status'), ['new', 'in_progress', 'answered', 'closed'], ''),
    kind: oneOf(query.get('kind'), ['quote', 'support', 'contact'], ''),
  };
  const pageNum = int(query.get('page'), { min: 1, max: 999, fallback: 1 });
  const { items, total } = inquiries.listInquiries({
    ...filter, limit: PAGE_SIZE, offset: (pageNum - 1) * PAGE_SIZE,
  });
  await sendHtml(req, res, inquiriesPage(actx, {
    items, total, filter, pageNum, pageSize: PAGE_SIZE,
  }), { cache: 'no-store' });
});

router.get('/admin/inquiries/:id', async (actx, req, res, { params }) => {
  const inquiry = inquiries.getInquiry(Number(params.id));
  if (!inquiry) return false;
  await sendHtml(req, res, inquiryPage(actx, {
    inquiry, items: inquiries.getInquiryItems(inquiry.id),
  }), { cache: 'no-store' });
  return true;
});

router.post('/admin/inquiries/:id', async (actx, req, res, { params }) => {
  const form = await parseForm(req);
  inquiries.updateInquiry(Number(params.id), {
    status: oneOf(form.status, ['new', 'in_progress', 'answered', 'closed'], 'new'),
    internal_note: text(form.internal_note, 4000),
  });
  redirect(res, `/admin/inquiries/${params.id}`);
});

router.get('/admin/inquiries/:id/delete', async (actx, req, res, { params }) => {
  const inquiry = inquiries.getInquiry(Number(params.id));
  if (!inquiry) return false;
  await sendHtml(req, res, confirmPage(actx, {
    title: 'Delete inquiry',
    what: `${inquiry.ref} — ${inquiry.name}`,
    action: `/admin/inquiries/${inquiry.id}/delete`,
    cancel: `/admin/inquiries/${inquiry.id}`,
  }), { cache: 'no-store' });
  return true;
});

router.post('/admin/inquiries/:id/delete', async (actx, req, res, { params }) => {
  inquiries.deleteInquiry(Number(params.id));
  redirect(res, '/admin/inquiries');
});

/* ------------------------------------------------------------ datasheets */

router.get('/admin/datasheets', async (actx, req, res) => {
  await sendHtml(req, res, datasheetsPage(actx, {
    datasheets: catalogue.listDatasheets(),
  }), { cache: 'no-store' });
});

router.post('/admin/datasheets', async (actx, req, res) => {
  const { fields, files } = await parseMultipart(req);
  if (!verifyCsrf(actx, fields._csrf)) return sendText(req, res, 'Invalid token', { status: 403 });

  const productId = Number(fields.product_id) || null;
  const file = files.file;
  if (file && file.data.length) {
    const ext = oneOf(extname(file.filename).toLowerCase(), ['.pdf', '.png', '.jpg', '.jpeg'], '.pdf');
    const filename = `${slugify(fields.title || file.filename) || 'datasheet'}-${token(6)}${ext}`;
    await writeFile(join(config.uploadDir, filename), file.data);
    catalogue.addDatasheet({
      product_id: productId,
      title: str(fields.title, 140) || file.filename,
      filename,
      mime: file.mime,
      size_bytes: file.data.length,
      lang: oneOf(fields.lang, ['en', 'sq', 'de'], 'en'),
    });
  }
  redirect(res, productId ? `/admin/products/${productId}` : '/admin/datasheets');
});

router.get('/admin/datasheets/:id/delete', async (actx, req, res, { params }) => {
  const sheet = catalogue.getDatasheet(Number(params.id));
  if (!sheet) return false;
  await sendHtml(req, res, confirmPage(actx, {
    title: 'Delete datasheet',
    what: sheet.title,
    detail: sheet.filename,
    action: `/admin/datasheets/${sheet.id}/delete`,
    cancel: sheet.product_id ? `/admin/products/${sheet.product_id}` : '/admin/datasheets',
  }), { cache: 'no-store' });
  return true;
});

router.post('/admin/datasheets/:id/delete', async (actx, req, res, { params }) => {
  const sheet = catalogue.getDatasheet(Number(params.id));
  if (sheet) {
    catalogue.deleteDatasheet(sheet.id);
    try { await unlink(join(config.uploadDir, sheet.filename)); } catch { /* already gone */ }
  }
  redirect(res, '/admin/datasheets');
});

/* --------------------------------------------------------- form readers */

function readProductForm(form, existing) {
  const partNumber = str(form.part_number, 64);
  const wanted = str(form.slug, 90) || `${partNumber}-${str(form.name_en, 60)}`;
  const slug = existing && slugify(wanted) === existing.slug
    ? existing.slug
    : uniqueSlug(wanted, (candidate) => {
        const row = get('SELECT id FROM products WHERE slug = ?', candidate);
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
    out.push({
      label_sq, label_en,
      value_sq: str(valuesSq[i], 160),
      value_en: str(valuesEn[i], 160),
    });
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
    out.push({
      number,
      kind: oneOf(kinds[i], ['equivalent', 'oem', 'superseded'], 'equivalent'),
      note: str(notes[i], 120),
    });
  }
  return out;
}

function readCategoryForm(form, existing) {
  const name = str(form.name_en, 80);
  return {
    slug: str(form.slug, 80) || existing?.slug || uniqueSlug(name, (c) =>
      Boolean(get('SELECT id FROM categories WHERE slug = ? AND id <> ?', c, existing?.id ?? 0))),
    name_sq: str(form.name_sq, 80),
    name_en: name,
    summary_sq: str(form.summary_sq, 300),
    summary_en: str(form.summary_en, 300),
    icon: str(form.icon, 30) || 'cube',
    sort: int(form.sort, { min: -999, max: 9999, fallback: 0 }),
    is_active: bool(form.is_active),
  };
}

function readBrandForm(form, existing) {
  const name = str(form.name, 80);
  return {
    slug: str(form.slug, 80) || existing?.slug || uniqueSlug(name, (c) =>
      Boolean(get('SELECT id FROM brands WHERE slug = ? AND id <> ?', c, existing?.id ?? 0))),
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
 */
export const adminRoutes = {
  async dispatch(req, res, { url, pathname, cookies, assets }) {
    const session = users.getSession(cookies[SESSION_COOKIE]);
    const secure = config.trustProxy
      ? (req.headers['x-forwarded-proto'] || '').includes('https')
      : Boolean(req.socket.encrypted);

    const actx = {
      pathname,
      session,
      secure,
      user: session ? { name: session.name, email: session.email, role: session.role } : null,
      csrf: session?.csrf || '',
      counts: { openInquiries: session ? inquiries.inquiryStats().open : 0 },
      flash: null,
      asset: (path) => assets.url(path),
    };

    const isLoginRoute = pathname === '/admin/login';
    if (!session && !isLoginRoute) return redirect(res, '/admin/login', 302);

    // Every mutating admin request must carry the session's CSRF token. The
    // check runs regardless of Content-Type: a request that sends no parsable
    // body yields no token and is rejected, rather than slipping through.
    // The multipart upload endpoint is the sole exception — its token can only
    // be read once the body has been parsed, so it verifies inside the handler.
    if (req.method === 'POST' && session && pathname !== '/admin/datasheets') {
      const form = await parseForm(req);
      if (!verifyCsrf(actx, form._csrf)) {
        return sendText(req, res, 'Invalid or expired form token. Reload and try again.',
          { status: 403 });
      }
    }

    const match = router.match(req.method, pathname);
    if (!match) return sendText(req, res, 'Not found', { status: 404 });

    const result = await match.handler(actx, req, res, {
      params: match.params,
      query: url.searchParams,
    });
    if (result === false) return sendText(req, res, 'Not found', { status: 404 });
    return undefined;
  },
};
