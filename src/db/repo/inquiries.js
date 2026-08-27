import { all, get, run, tx } from '../db.js';

const PREFIX = { quote: 'KUO', support: 'SUP', contact: 'KON' };

function nextRef(kind) {
  const year = new Date().getFullYear();
  const prefix = `${PREFIX[kind] || 'REQ'}-${year}-`;
  const last = get(
    'SELECT ref FROM inquiries WHERE ref LIKE ? ORDER BY id DESC LIMIT 1', `${prefix}%`,
  );
  const seq = last ? Number(last.ref.slice(prefix.length)) + 1 : 1;
  return prefix + String(seq).padStart(4, '0');
}

export function createInquiry(data, items = []) {
  return tx(() => {
    const ref = nextRef(data.kind);
    const id = run(
      `INSERT INTO inquiries (ref, kind, name, company, email, phone, city, country,
                              subject, message, machine, urgency, locale)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ref, data.kind, data.name, data.company || '', data.email, data.phone || '',
      data.city || '', data.country || 'XK', data.subject || '', data.message || '',
      data.machine || '', data.urgency || 'normal', data.locale || 'sq',
    ).lastInsertRowid;

    for (const item of items) {
      run(
        `INSERT INTO inquiry_items (inquiry_id, product_id, part_number, title, qty, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        id, item.product_id ?? null, item.part_number, item.title || '',
        item.qty || 1, item.note || '',
      );
    }
    return { id, ref };
  });
}

export function listInquiries({ status = '', kind = '', limit = 40, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (kind) { where.push('kind = ?'); params.push(kind); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const items = all(
    `SELECT i.*, (SELECT COUNT(*) FROM inquiry_items t WHERE t.inquiry_id = i.id) AS item_count
       FROM inquiries i ${clause} ORDER BY i.id DESC LIMIT ? OFFSET ?`,
    ...params, limit, offset,
  );
  const total = get(`SELECT COUNT(*) AS n FROM inquiries ${clause}`, ...params).n;
  return { items, total };
}

export const getInquiry = (id) => get('SELECT * FROM inquiries WHERE id = ?', id);

export const getInquiryItems = (id) =>
  all(`SELECT t.*, p.slug FROM inquiry_items t
         LEFT JOIN products p ON p.id = t.product_id
        WHERE t.inquiry_id = ? ORDER BY t.id`, id);

export function updateInquiry(id, { status, internal_note }) {
  run(
    `UPDATE inquiries
        SET status = ?, internal_note = ?,
            handled_at = CASE WHEN ? IN ('answered','closed') AND handled_at IS NULL
                              THEN datetime('now') ELSE handled_at END
      WHERE id = ?`,
    status, internal_note, status, id,
  );
}

export const deleteInquiry = (id) => run('DELETE FROM inquiries WHERE id = ?', id);

export const inquiryStats = () => ({
  total: get('SELECT COUNT(*) AS n FROM inquiries').n,
  open: get("SELECT COUNT(*) AS n FROM inquiries WHERE status IN ('new','in_progress')").n,
  urgent: get("SELECT COUNT(*) AS n FROM inquiries WHERE urgency = 'line_down' AND status <> 'closed'").n,
  today: get("SELECT COUNT(*) AS n FROM inquiries WHERE date(created_at) = date('now')").n,
});
