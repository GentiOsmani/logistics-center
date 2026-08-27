/**
 * Minimal, allocation-conscious HTML templating.
 * Everything interpolated into html`` is escaped unless wrapped in raw().
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const ESCAPE_RE = /[&<>"']/g;

export function esc(value) {
  const s = typeof value === 'string' ? value : String(value);
  return ESCAPE_RE.test(s) ? s.replace(ESCAPE_RE, (c) => ESCAPES[c]) : s;
}

class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

export function raw(value) { return new Raw(value); }

function render(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) {
    let out = '';
    for (let i = 0; i < value.length; i++) out += render(value[i]);
    return out;
  }
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new Raw(out);
}

/** Serialise a query string, dropping empty values. */
export function qs(params) {
  const sp = new URLSearchParams();
  for (const key in params) {
    const v = params[key];
    if (v === undefined || v === null || v === '' ) continue;
    sp.set(key, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
