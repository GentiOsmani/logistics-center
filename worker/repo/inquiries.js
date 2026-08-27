// Ported from src/db/repo/inquiries.js. `createInquiry`'s original `tx()` (an
// interactive BEGIN/COMMIT around a variable-length loop) doesn't map onto
// D1's batch API directly (see worker/db.js header) — `nextRef` still reads
// before the write, then the inquiry insert + all item inserts run as a
// single db.batch() call, atomic as a group even though they're not wrapped
// with the ref-generation read.

const PREFIX = { quote: 'KUO', support: 'SUP', contact: 'KON' };

async function nextRef(db, kind) {
  const year = new Date().getFullYear();
  const prefix = `${PREFIX[kind] || 'REQ'}-${year}-`;
  const last = await db.get(
    'SELECT ref FROM inquiries WHERE ref LIKE ? ORDER BY id DESC LIMIT 1', `${prefix}%`,
  );
  const seq = last ? Number(last.ref.slice(prefix.length)) + 1 : 1;
  return prefix + String(seq).padStart(4, '0');
}

export async function createInquiry(db, data, items = []) {
  const ref = await nextRef(db, data.kind);
  const inserted = await db.run(
    `INSERT INTO inquiries (ref, kind, name, company, email, phone, city, country,
                            subject, message, machine, urgency, locale)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ref, data.kind, data.name, data.company || '', data.email, data.phone || '',
    data.city || '', data.country || 'XK', data.subject || '', data.message || '',
    data.machine || '', data.urgency || 'normal', data.locale || 'sq',
  );
  const id = inserted.lastInsertRowid;

  if (items.length) {
    await db.batch(items.map((item) => ({
      sql: `INSERT INTO inquiry_items (inquiry_id, product_id, part_number, title, qty, note)
            VALUES (?, ?, ?, ?, ?, ?)`,
      params: [id, item.product_id ?? null, item.part_number, item.title || '', item.qty || 1, item.note || ''],
    })));
  }
  return { id, ref };
}

export async function listInquiries(db, { status = '', kind = '', limit = 40, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (kind) { where.push('kind = ?'); params.push(kind); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const items = await db.all(
    `SELECT i.*, (SELECT COUNT(*) FROM inquiry_items t WHERE t.inquiry_id = i.id) AS item_count
       FROM inquiries i ${clause} ORDER BY i.id DESC LIMIT ? OFFSET ?`,
    ...params, limit, offset,
  );
  const total = (await db.get(`SELECT COUNT(*) AS n FROM inquiries ${clause}`, ...params)).n;
  return { items, total };
}

export const getInquiry = (db, id) => db.get('SELECT * FROM inquiries WHERE id = ?', id);

export const getInquiryItems = (db, id) =>
  db.all(`SELECT t.*, p.slug FROM inquiry_items t
         LEFT JOIN products p ON p.id = t.product_id
        WHERE t.inquiry_id = ? ORDER BY t.id`, id);

export const updateInquiry = (db, id, { status, internal_note }) => db.run(
  `UPDATE inquiries
      SET status = ?, internal_note = ?,
          handled_at = CASE WHEN ? IN ('answered','closed') AND handled_at IS NULL
                            THEN datetime('now') ELSE handled_at END
    WHERE id = ?`,
  status, internal_note, status, id,
);

export const deleteInquiry = (db, id) => db.run('DELETE FROM inquiries WHERE id = ?', id);

export async function inquiryStats(db) {
  const [total, open, urgent, today] = await Promise.all([
    db.get('SELECT COUNT(*) AS n FROM inquiries'),
    db.get("SELECT COUNT(*) AS n FROM inquiries WHERE status IN ('new','in_progress')"),
    db.get("SELECT COUNT(*) AS n FROM inquiries WHERE urgency = 'line_down' AND status <> 'closed'"),
    db.get("SELECT COUNT(*) AS n FROM inquiries WHERE date(created_at) = date('now')"),
  ]);
  return { total: total.n, open: open.n, urgent: urgent.n, today: today.n };
}
