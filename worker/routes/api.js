// New: replaces the form-submission and lookup parts of src/routes/public.js
// that need a live server. Everything that was pure DB-read (home, catalogue
// listing, product/brand/service pages, /api/suggest) is NOT here — it moved
// to the static build (build/generate.js) and client-side search
// (public/assets/js/catalogue.js). What's left is what genuinely needs a
// server: writing inquiries, and exporting the catalogue for the static build
// to consume.
//
// The quote basket itself is no longer server state (see
// public/assets/js/cart.js — localStorage) — POST /api/quote receives the
// already-resolved item list from the client in one shot instead of reading
// a server-side cart cookie.

import { createDb } from '../db.js';
import { json } from '../lib/respond.js';
import { validate, oneOf, parsePartLines } from '../lib/validate.js';
import { checkRateLimit, clientIp } from '../lib/rate-limit.js';
import { createInquiry } from '../repo/inquiries.js';
import { findByPartNumber, listAllForExport } from '../repo/products.js';
import * as taxonomy from '../repo/taxonomy.js';

const CONTACT_SPEC = {
  name: { required: true, max: 120 },
  company: { max: 120 },
  email: { required: true, email: true, max: 160 },
  phone: { max: 40 },
  city: { max: 80 },
  subject: { max: 180 },
  message: { required: true, kind: 'text', max: 4000 },
};

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function fieldFor(row, name, locale) {
  return row?.[`${name}_${locale}`] || row?.[`${name}_sq`] || row?.[`${name}_en`] || '';
}

/* ----------------------------------------------------------------- quote */

async function handleQuote(request, env) {
  const db = createDb(env.DB);
  const body = await readJson(request);
  if (body.website) return json({ ok: true }); // honeypot: silently pretend success

  const allowed = await checkRateLimit(db, `quote:${clientIp(request)}`, { limit: 8, windowMs: 10 * 60_000 });
  if (!allowed) return json({ ok: false, errors: { name: 'err_rate' } }, { status: 429 });

  const { values, errors } = validate(body, { ...CONTACT_SPEC, phone: { required: true, max: 40 }, message: { kind: 'text', max: 2000 } });
  const cartItems = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  const manual = parsePartLines(body.manual);
  if (!cartItems.length && !manual.length) errors.manual = 'err_required';
  if (Object.keys(errors).length) return json({ ok: false, errors }, { status: 422 });

  const locale = body.locale === 'en' ? 'en' : 'sq';
  const lines = [];
  for (const item of cartItems) {
    const partNumber = String(item.part_number || '').trim().slice(0, 64);
    if (!partNumber) continue;
    lines.push({
      product_id: item.product_id ?? null,
      part_number: partNumber,
      title: String(item.title || '').slice(0, 200),
      qty: Math.min(Math.max(Number(item.qty) || 1, 1), 9999),
    });
  }
  for (const entry of manual) {
    const product = await findByPartNumber(db, entry.part_number);
    lines.push({
      product_id: product?.id ?? null,
      part_number: entry.part_number,
      title: product ? fieldFor(product, 'name', locale) : '',
      qty: entry.qty,
    });
  }

  const { ref } = await createInquiry(db, {
    kind: 'quote', ...values,
    country: oneOf(body.country, ['XK', 'AL', 'XX'], 'XK'),
    locale,
  }, lines);

  return json({ ok: true, ref });
}

/* --------------------------------------------------------------- support */

async function handleSupport(request, env) {
  const db = createDb(env.DB);
  const body = await readJson(request);
  if (body.website) return json({ ok: true });

  const allowed = await checkRateLimit(db, `support:${clientIp(request)}`, { limit: 8, windowMs: 10 * 60_000 });
  if (!allowed) return json({ ok: false, errors: { message: 'err_rate' } }, { status: 429 });

  const { values, errors } = validate(body, { ...CONTACT_SPEC, phone: { required: true, max: 40 }, machine: { max: 180 } });
  if (Object.keys(errors).length) return json({ ok: false, errors }, { status: 422 });

  const { ref } = await createInquiry(db, {
    kind: 'support', ...values,
    country: oneOf(body.country, ['XK', 'AL', 'XX'], 'XK'),
    urgency: oneOf(body.urgency, ['normal', 'urgent', 'line_down'], 'normal'),
    locale: body.locale === 'en' ? 'en' : 'sq',
  });

  return json({ ok: true, ref });
}

/* --------------------------------------------------------------- contact */

async function handleContact(request, env) {
  const db = createDb(env.DB);
  const body = await readJson(request);
  if (body.website) return json({ ok: true });

  const allowed = await checkRateLimit(db, `contact:${clientIp(request)}`, { limit: 8, windowMs: 10 * 60_000 });
  if (!allowed) return json({ ok: false, errors: { message: 'err_rate' } }, { status: 429 });

  const { values, errors } = validate(body, CONTACT_SPEC);
  if (Object.keys(errors).length) return json({ ok: false, errors }, { status: 422 });

  const { ref } = await createInquiry(db, {
    kind: 'contact', ...values,
    country: oneOf(body.country, ['XK', 'AL', 'XX'], 'XK'),
    locale: body.locale === 'en' ? 'en' : 'sq',
  });

  return json({ ok: true, ref });
}

/* ---------------------------------------------------------------- export */

/** Full catalogue snapshot for build/generate.js — not called by the live site. */
async function handleExport(request, env) {
  const db = createDb(env.DB);
  const [catalogue, categories, brands, services] = await Promise.all([
    listAllForExport(db),
    taxonomy.listCategories(db),
    taxonomy.listBrands(db),
    taxonomy.listServices(db),
  ]);
  const servicesWithPoints = await Promise.all(services.map(async (s) => ({
    ...s, points: await taxonomy.listServicePoints(db, s.id),
  })));
  return json({ ...catalogue, categories, brands, services: servicesWithPoints, generatedAt: new Date().toISOString() });
}

/* --------------------------------------------------------------- routing */

// Datasheet files are NOT served from here — R2 needs a card-verified
// Cloudflare account, unavailable in this deployment (see deploy/README.md).
// PDFs are committed to data/datasheets/ in the repo and copied into
// dist/files/ by build/generate.js, so GitHub Pages serves them directly.

export async function dispatchApi(request, env, url) {
  const { pathname } = url;
  if (pathname === '/api/quote' && request.method === 'POST') return handleQuote(request, env);
  if (pathname === '/api/support' && request.method === 'POST') return handleSupport(request, env);
  if (pathname === '/api/contact' && request.method === 'POST') return handleContact(request, env);
  if (pathname === '/api/export' && request.method === 'GET') return handleExport(request, env);
  return null;
}
