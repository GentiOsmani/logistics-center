-- Logistics Center — D1 schema
-- Ported from src/db/schema.sql. Dropped vs. the original: `carts`/`cart_items`
-- (the quote basket now lives in the browser's localStorage — see
-- public/assets/js/cart.js) and the `product_search` FTS5 table (catalogue
-- search now runs client-side over the static build's bundled product index —
-- see public/assets/js/catalogue.js). Added: `rate_limits`, a D1-backed
-- replacement for the in-memory RateLimiter, since a Worker isolate isn't a
-- persistent process to hold that state in memory across requests.

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY,
  slug        TEXT    NOT NULL UNIQUE,
  parent_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name_sq     TEXT    NOT NULL,
  name_en     TEXT    NOT NULL,
  summary_sq  TEXT    NOT NULL DEFAULT '',
  summary_en  TEXT    NOT NULL DEFAULT '',
  icon        TEXT    NOT NULL DEFAULT 'cube',
  sort        INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id, sort);

CREATE TABLE IF NOT EXISTS brands (
  id          INTEGER PRIMARY KEY,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  country     TEXT    NOT NULL DEFAULT '',
  summary_sq  TEXT    NOT NULL DEFAULT '',
  summary_en  TEXT    NOT NULL DEFAULT '',
  website     TEXT    NOT NULL DEFAULT '',
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort        INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_brands_featured ON brands(is_featured, sort);

CREATE TABLE IF NOT EXISTS products (
  id             INTEGER PRIMARY KEY,
  part_number    TEXT    NOT NULL,
  part_norm      TEXT    NOT NULL,          -- uppercase, alphanumeric only
  slug           TEXT    NOT NULL UNIQUE,
  brand_id       INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name_sq        TEXT    NOT NULL,
  name_en        TEXT    NOT NULL,
  summary_sq     TEXT    NOT NULL DEFAULT '',
  summary_en     TEXT    NOT NULL DEFAULT '',
  body_sq        TEXT    NOT NULL DEFAULT '',
  body_en        TEXT    NOT NULL DEFAULT '',
  unit           TEXT    NOT NULL DEFAULT 'pcs',
  availability   TEXT    NOT NULL DEFAULT 'on_request', -- in_stock | on_request | lead_time
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  price_eur      REAL,                       -- NULL => "price on request"
  is_featured    INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_part_norm ON products(part_norm);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id, is_active, id DESC);
CREATE INDEX IF NOT EXISTS idx_products_brand     ON products(brand_id, is_active, id DESC);
CREATE INDEX IF NOT EXISTS idx_products_featured  ON products(is_featured, is_active, id DESC);

CREATE TABLE IF NOT EXISTS product_refs (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  number      TEXT    NOT NULL,
  number_norm TEXT    NOT NULL,
  kind        TEXT    NOT NULL DEFAULT 'equivalent', -- equivalent | oem | superseded
  note        TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_refs_norm    ON product_refs(number_norm);
CREATE INDEX IF NOT EXISTS idx_refs_product ON product_refs(product_id);

CREATE TABLE IF NOT EXISTS product_specs (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort       INTEGER NOT NULL DEFAULT 0,
  label_sq   TEXT    NOT NULL,
  label_en   TEXT    NOT NULL,
  value_sq   TEXT    NOT NULL,
  value_en   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_specs_product ON product_specs(product_id, sort);

CREATE TABLE IF NOT EXISTS datasheets (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER REFERENCES products(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  filename    TEXT    NOT NULL,
  mime        TEXT    NOT NULL DEFAULT 'application/pdf',
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  lang        TEXT    NOT NULL DEFAULT 'en',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_datasheets_product ON datasheets(product_id);

CREATE TABLE IF NOT EXISTS services (
  id         INTEGER PRIMARY KEY,
  slug       TEXT    NOT NULL UNIQUE,
  icon       TEXT    NOT NULL DEFAULT 'wrench',
  title_sq   TEXT    NOT NULL,
  title_en   TEXT    NOT NULL,
  summary_sq TEXT    NOT NULL DEFAULT '',
  summary_en TEXT    NOT NULL DEFAULT '',
  body_sq    TEXT    NOT NULL DEFAULT '',
  body_en    TEXT    NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS service_points (
  id         INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  sort       INTEGER NOT NULL DEFAULT 0,
  text_sq    TEXT    NOT NULL,
  text_en    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_points_service ON service_points(service_id, sort);

CREATE TABLE IF NOT EXISTS inquiries (
  id          INTEGER PRIMARY KEY,
  ref         TEXT    NOT NULL UNIQUE,
  kind        TEXT    NOT NULL,             -- quote | support | contact
  status      TEXT    NOT NULL DEFAULT 'new', -- new | in_progress | answered | closed
  name        TEXT    NOT NULL,
  company     TEXT    NOT NULL DEFAULT '',
  email       TEXT    NOT NULL,
  phone       TEXT    NOT NULL DEFAULT '',
  city        TEXT    NOT NULL DEFAULT '',
  country     TEXT    NOT NULL DEFAULT 'XK',
  subject     TEXT    NOT NULL DEFAULT '',
  message     TEXT    NOT NULL DEFAULT '',
  machine     TEXT    NOT NULL DEFAULT '',  -- machine / line description (support)
  urgency     TEXT    NOT NULL DEFAULT 'normal', -- normal | urgent | line_down
  locale      TEXT    NOT NULL DEFAULT 'sq',
  internal_note TEXT  NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  handled_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_kind   ON inquiries(kind, id DESC);

CREATE TABLE IF NOT EXISTS inquiry_items (
  id          INTEGER PRIMARY KEY,
  inquiry_id  INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  part_number TEXT    NOT NULL,
  title       TEXT    NOT NULL DEFAULT '',
  qty         INTEGER NOT NULL DEFAULT 1,
  note        TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_items_inquiry ON inquiry_items(inquiry_id);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'editor', -- admin | editor
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf       TEXT    NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

-- Fixed-window request counter backing worker/lib/rate-limit.js. `key` is
-- typically "<bucket>:<ip>" (e.g. "quote:203.0.113.4"); rows outside the
-- current window are lazily deleted on access, same spirit as the original
-- in-memory sweep.
CREATE TABLE IF NOT EXISTS rate_limits (
  key         TEXT    PRIMARY KEY,
  count       INTEGER NOT NULL DEFAULT 0,
  reset_at    INTEGER NOT NULL
);
