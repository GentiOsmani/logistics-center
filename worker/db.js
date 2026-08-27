// D1 adapter. Mirrors src/db/db.js's all()/get()/run() call shape so the
// ported repo modules read almost the same as the originals — the differences
// forced by the Workers runtime:
//
//   1. Every call is async (D1's API is Promise-based; node:sqlite's is sync).
//   2. There is no module-level singleton `db` — a D1 binding only exists
//      inside a request's `env`, so callers build one `db` per request via
//      `createDb(env.DB)` and thread it through repo calls as the first
//      argument (e.g. `products.getProductBySlug(db, slug)`).
//   3. D1 has no true interactive transaction (arbitrary JS between statements
//      inside one atomic BEGIN/COMMIT, which node:sqlite's `tx()` relied on).
//      `batch()` runs a fixed list of prepared statements atomically — use it
//      for the delete-then-reinsert child-row patterns (writeSpecs/writeRefs)
//      where every statement is known upfront. Where a later statement needs
//      an id produced by an earlier one (e.g. insert product, then insert its
//      spec rows), run the parent insert first to get `last_row_id`, then
//      batch the children — not a single atomic unit across parent+children,
//      but acceptable here: writes are low-volume and admin-only.

export function createDb(d1) {
  const bind = (sql, params) => d1.prepare(sql).bind(...params);

  return {
    async all(sql, ...params) {
      const { results } = await bind(sql, params).all();
      return results;
    },
    async get(sql, ...params) {
      return (await bind(sql, params).first()) ?? undefined;
    },
    async run(sql, ...params) {
      const result = await bind(sql, params).run();
      return {
        changes: result.meta.changes,
        lastInsertRowid: result.meta.last_row_id,
      };
    },
    /** Run a fixed list of {sql, params} statements as one atomic batch. */
    async batch(statements) {
      if (statements.length === 0) return [];
      return d1.batch(statements.map((s) => bind(s.sql, s.params || [])));
    },
  };
}

/** Normalised form used for part-number lookups: uppercase alphanumerics only. */
export function normalizePart(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
