import { Router } from '../core/router.js';
import { parseForm } from '../core/body.js';
import { sendHtml, sendJson, redirect, isSameOrigin } from '../core/respond.js';
import { serializeCookie } from '../core/cookies.js';
import { sign } from '../core/crypto.js';
import { CART_COOKIE } from '../core/context.js';
import { config } from '../config.js';
import { L } from '../views/layout.js';

import * as taxonomy from '../db/repo/taxonomy.js';
import * as catalogue from '../db/repo/products.js';
import * as cart from '../db/repo/cart.js';
import { createInquiry } from '../db/repo/inquiries.js';

import { validate, oneOf, int, parsePartLines } from '../lib/validate.js';
import { RateLimiter, clientIp } from '../lib/rate-limit.js';

import { homePage } from '../views/pages/home.js';
import { productsPage } from '../views/pages/products.js';
import { productPage } from '../views/pages/product.js';
import { brandsPage, brandPage } from '../views/pages/brands.js';
import { servicesPage, servicePage } from '../views/pages/services.js';
import { supportPage } from '../views/pages/support.js';
import { quotePage } from '../views/pages/quote.js';
import { contactPage, aboutPage } from '../views/pages/misc.js';

const PAGE_SIZE = config.limits.pageSize;
const formLimiter = new RateLimiter({ limit: 8, windowMs: 10 * 60_000 });
const suggestLimiter = new RateLimiter({ limit: 120, windowMs: 60_000 });

const CONTACT_SPEC = {
  name: { required: true, max: 120 },
  company: { max: 120 },
  email: { required: true, email: true, max: 160 },
  phone: { max: 40 },
  city: { max: 80 },
  subject: { max: 180 },
  message: { required: true, kind: 'text', max: 4000 },
};

export const publicRoutes = new Router();

/* ------------------------------------------------------------------ home */

publicRoutes.get('/:locale', async (ctx, req, res) => {
  const categories = ctx.categories;
  const services = taxonomy.listServices();
  const brands = taxonomy.listFeaturedBrands();
  const featured = catalogue.listFeaturedProducts(8);
  const productCount = catalogue.countActiveProducts();

  await sendHtml(req, res, homePage(ctx, {
    categories, services, brands, featured, productCount,
  }), { cache: 'public, max-age=0, s-maxage=300' });
});

/* -------------------------------------------------------------- products */

publicRoutes.get('/:locale/products', async (ctx, req, res, { query }) => {
  const filters = {
    q: (query.get('q') || '').trim().slice(0, 80),
    category: (query.get('category') || '').slice(0, 80),
    brand: (query.get('brand') || '').slice(0, 80),
    availability: oneOf(query.get('availability'), ['in_stock', 'lead_time', 'on_request'], ''),
    sort: oneOf(query.get('sort'),
      ['relevance', 'newest', 'part', 'name_sq', 'name_en'], 'relevance'),
  };
  const pageNum = int(query.get('page'), { min: 1, max: 500, fallback: 1 });
  const offset = (pageNum - 1) * PAGE_SIZE;

  const categories = ctx.categories;
  const brands = taxonomy.listBrands();

  let result;
  if (filters.q) {
    result = catalogue.searchProducts(filters.q, { limit: PAGE_SIZE, offset });
    // Narrow a text search by the sidebar facets without a second query path.
    if (filters.category || filters.brand) {
      const categoryId = categories.find((c) => c.slug === filters.category)?.id;
      const brandId = brands.find((b) => b.slug === filters.brand)?.id;
      const ids = catalogue.searchProductIds(filters.q, 400);
      const filtered = ids.length
        ? catalogue.listProducts({
            ids, categoryId, brandId, availability: filters.availability,
            sort: filters.sort, limit: PAGE_SIZE, offset,
          })
        : { items: [], total: 0 };
      result = filtered;
    }
  } else {
    result = catalogue.listProducts({
      categoryId: categories.find((c) => c.slug === filters.category)?.id,
      brandId: brands.find((b) => b.slug === filters.brand)?.id,
      availability: filters.availability,
      sort: filters.sort,
      limit: PAGE_SIZE,
      offset,
    });
  }

  await sendHtml(req, res, productsPage(ctx, {
    items: result.items,
    total: result.total,
    categories,
    brands,
    filters,
    pageNum,
    pageSize: PAGE_SIZE,
  }));
});

publicRoutes.get('/:locale/products/:slug', async (ctx, req, res, { params, query }) => {
  const product = catalogue.getProductBySlug(params.slug);
  if (!product) return false;

  const full = catalogue.getProductFull(product.id);
  await sendHtml(req, res, productPage(ctx, {
    product: { ...full, ...product },
    specs: catalogue.getProductSpecs(product.id),
    refs: catalogue.getProductRefs(product.id),
    datasheets: catalogue.getProductDatasheets(product.id),
    related: catalogue.listRelatedProducts(product, 4),
    category: full.category_id ? taxonomy.getCategory(full.category_id) : null,
    brand: full.brand_id ? taxonomy.getBrand(full.brand_id) : null,
    added: query.get('added') === '1',
  }), { cache: 'public, max-age=0, s-maxage=600' });
  return true;
});

/* ---------------------------------------------------------------- brands */

publicRoutes.get('/:locale/brands', async (ctx, req, res) => {
  await sendHtml(req, res, brandsPage(ctx, { brands: taxonomy.listBrands() }),
    { cache: 'public, max-age=0, s-maxage=600' });
});

publicRoutes.get('/:locale/brands/:slug', async (ctx, req, res, { params, query }) => {
  const brand = taxonomy.getBrandBySlug(params.slug);
  if (!brand) return false;
  const pageNum = int(query.get('page'), { min: 1, max: 500, fallback: 1 });
  const { items, total } = catalogue.listProducts({
    brandId: brand.id, limit: PAGE_SIZE, offset: (pageNum - 1) * PAGE_SIZE,
  });
  await sendHtml(req, res, brandPage(ctx, {
    brand, items, total, pageNum, pageSize: PAGE_SIZE,
  }), { cache: 'public, max-age=0, s-maxage=600' });
  return true;
});

/* -------------------------------------------------------------- services */

publicRoutes.get('/:locale/services', async (ctx, req, res) => {
  await sendHtml(req, res, servicesPage(ctx, { services: taxonomy.listServices() }),
    { cache: 'public, max-age=0, s-maxage=900' });
});

publicRoutes.get('/:locale/services/:slug', async (ctx, req, res, { params }) => {
  const service = taxonomy.getServiceBySlug(params.slug);
  if (!service) return false;
  const all = taxonomy.listServices();
  await sendHtml(req, res, servicePage(ctx, {
    service,
    points: taxonomy.listServicePoints(service.id),
    others: all.filter((s) => s.id !== service.id),
  }), { cache: 'public, max-age=0, s-maxage=900' });
  return true;
});

/* --------------------------------------------------------------- support */

publicRoutes.get('/:locale/support', async (ctx, req, res, { query }) => {
  const services = taxonomy.listServices();
  const preselected = services.find((s) => s.slug === query.get('service'));
  await sendHtml(req, res, supportPage(ctx, {
    services,
    values: preselected ? { subject: ctx.f(preselected, 'title') } : {},
  }));
});

publicRoutes.post('/:locale/support', async (ctx, req, res) => {
  const services = taxonomy.listServices();
  const form = await parseForm(req);

  if (!isSameOrigin(req) || form.website) return redirect(res, L(ctx, '/support'));
  if (!formLimiter.check(clientIp(req, config.trustProxy))) {
    return sendHtml(req, res, supportPage(ctx, {
      services, values: form, errors: { message: 'err_rate' },
    }), { status: 429 });
  }

  const { values, errors } = validate(form, {
    ...CONTACT_SPEC,
    phone: { required: true, max: 40 },
    machine: { max: 180 },
  });
  if (Object.keys(errors).length) {
    return sendHtml(req, res, supportPage(ctx, { services, values, errors }), { status: 422 });
  }

  const { ref } = createInquiry({
    kind: 'support',
    ...values,
    country: oneOf(form.country, ['XK', 'AL', 'XX'], 'XK'),
    urgency: oneOf(form.urgency, ['normal', 'urgent', 'line_down'], 'normal'),
    locale: ctx.locale,
  });

  await sendHtml(req, res, supportPage(ctx, { services, sent: ref }));
});

/* ----------------------------------------------------------------- quote */

publicRoutes.get('/:locale/quote', async (ctx, req, res) => {
  await sendHtml(req, res, quotePage(ctx, {
    items: cart.listCartItems(ctx.cartId),
  }), { cache: 'no-store' });
});

publicRoutes.post('/:locale/quote/add', async (ctx, req, res) => {
  const form = await parseForm(req);
  if (!isSameOrigin(req)) return redirect(res, L(ctx, '/products'));

  const cartId = ensureCart(ctx, res);
  const partNumber = String(form.part_number || '').trim().slice(0, 64);
  if (partNumber) {
    const product = catalogue.findByPartNumber(partNumber);
    cart.addToCart(cartId, {
      part_number: product ? product.part_number : partNumber,
      product_id: product?.id ?? null,
      title: product ? ctx.f(product, 'name') : '',
      qty: int(form.qty, { min: 1, max: 9999, fallback: 1 }),
    });
  }
  redirect(res, safeRedirect(ctx, form.redirect, '/quote'));
});

publicRoutes.post('/:locale/quote/update', async (ctx, req, res) => {
  const form = await parseForm(req);
  if (isSameOrigin(req) && ctx.cartId) {
    cart.setQty(ctx.cartId, String(form.part_number || ''),
      int(form.qty, { min: 0, max: 9999, fallback: 1 }));
  }
  redirect(res, L(ctx, '/quote'));
});

publicRoutes.post('/:locale/quote/remove', async (ctx, req, res) => {
  const form = await parseForm(req);
  if (isSameOrigin(req) && ctx.cartId) {
    cart.removeFromCart(ctx.cartId, String(form.part_number || ''));
  }
  redirect(res, L(ctx, '/quote'));
});

publicRoutes.post('/:locale/quote/clear', async (ctx, req, res) => {
  if (isSameOrigin(req) && ctx.cartId) cart.clearCart(ctx.cartId);
  redirect(res, L(ctx, '/quote'));
});

publicRoutes.post('/:locale/quote', async (ctx, req, res) => {
  const form = await parseForm(req);
  const items = cart.listCartItems(ctx.cartId);

  if (!isSameOrigin(req) || form.website) return redirect(res, L(ctx, '/quote'));
  if (!formLimiter.check(clientIp(req, config.trustProxy))) {
    return sendHtml(req, res, quotePage(ctx, {
      items, values: form, errors: { name: 'err_rate' },
    }), { status: 429 });
  }

  const { values, errors } = validate(form, {
    ...CONTACT_SPEC,
    phone: { required: true, max: 40 },
    message: { kind: 'text', max: 2000 },
  });

  const manual = parsePartLines(form.manual);
  if (!items.length && !manual.length) errors.manual = 'err_required';
  if (Object.keys(errors).length) {
    return sendHtml(req, res, quotePage(ctx, {
      items, values: { ...values, manual: form.manual }, errors,
    }), { status: 422 });
  }

  const lines = [
    ...items.map((item) => ({
      product_id: item.product_id,
      part_number: item.part_number,
      title: item.product_id ? ctx.f(item, 'name') : item.title,
      qty: item.qty,
    })),
    ...manual.map((entry) => {
      const product = catalogue.findByPartNumber(entry.part_number);
      return {
        product_id: product?.id ?? null,
        part_number: entry.part_number,
        title: product ? ctx.f(product, 'name') : '',
        qty: entry.qty,
      };
    }),
  ];

  const { ref } = createInquiry({
    kind: 'quote',
    ...values,
    country: oneOf(form.country, ['XK', 'AL', 'XX'], 'XK'),
    locale: ctx.locale,
  }, lines);

  if (ctx.cartId) cart.clearCart(ctx.cartId);
  ctx.quoteCount = 0;
  await sendHtml(req, res, quotePage(ctx, { items: [], sent: ref }), { cache: 'no-store' });
});

/* --------------------------------------------------------- contact/about */

publicRoutes.get('/:locale/contact', async (ctx, req, res) => {
  await sendHtml(req, res, contactPage(ctx, {}));
});

publicRoutes.post('/:locale/contact', async (ctx, req, res) => {
  const form = await parseForm(req);
  if (!isSameOrigin(req) || form.website) return redirect(res, L(ctx, '/contact'));
  if (!formLimiter.check(clientIp(req, config.trustProxy))) {
    return sendHtml(req, res, contactPage(ctx, {
      values: form, errors: { message: 'err_rate' },
    }), { status: 429 });
  }

  const { values, errors } = validate(form, CONTACT_SPEC);
  if (Object.keys(errors).length) {
    return sendHtml(req, res, contactPage(ctx, { values, errors }), { status: 422 });
  }

  createInquiry({
    kind: 'contact',
    ...values,
    country: oneOf(form.country, ['XK', 'AL', 'XX'], 'XK'),
    locale: ctx.locale,
  });
  await sendHtml(req, res, contactPage(ctx, { sent: true }));
});

publicRoutes.get('/:locale/about', async (ctx, req, res) => {
  await sendHtml(req, res, aboutPage(ctx, {
    categories: ctx.categories,
    services: taxonomy.listServices(),
    productCount: catalogue.countActiveProducts(),
    brandCount: taxonomy.listBrands().length,
  }), { cache: 'public, max-age=0, s-maxage=900' });
});

/* ------------------------------------------------------------------- api */

publicRoutes.get('/:locale/api/suggest', async (ctx, req, res, { query }) => {
  if (!suggestLimiter.check(clientIp(req, config.trustProxy))) {
    return sendJson(req, res, [], 429);
  }
  const q = (query.get('q') || '').trim().slice(0, 60);
  if (q.length < 2) return sendJson(req, res, []);

  const items = catalogue.suggestProducts(q, 8).map((p) => ({
    pn: p.part_number,
    name: [p.brand_name, ctx.f(p, 'name')].filter(Boolean).join(' · '),
    url: L(ctx, `/products/${p.slug}`),
  }));
  sendJson(req, res, items);
});

/* --------------------------------------------------------------- helpers */

function ensureCart(ctx, res) {
  if (ctx.cartId && cart.cartExists(ctx.cartId)) return ctx.cartId;
  const id = cart.createCart();
  ctx.cartId = id;
  res.setHeader('Set-Cookie', serializeCookie(CART_COOKIE, sign(id), {
    maxAge: 30 * 86400,
    secure: ctx.origin.startsWith('https'),
  }));
  return id;
}

/** Only allow redirects back into this site's own locale-prefixed paths. */
function safeRedirect(ctx, value, fallback) {
  const target = String(value || '');
  if (target.startsWith('/') && !target.startsWith('//')) return target;
  return L(ctx, fallback);
}
