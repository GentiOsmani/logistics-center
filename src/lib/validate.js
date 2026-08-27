const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function str(value, max = 255) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

/** Multiline text: collapse runs of blank lines but keep paragraph breaks. */
export function text(value, max = 4000) {
  return String(value ?? '').trim().replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, max);
}

export function int(value, { min = 0, max = 1e9, fallback = 0 } = {}) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function decimal(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export const bool = (value) => (value === '1' || value === 'on' || value === 'true' ? 1 : 0);

export const oneOf = (value, allowed, fallback) =>
  (allowed.includes(value) ? value : fallback);

export const isEmail = (value) => EMAIL.test(String(value || '').trim());

/**
 * Validate a contact-style payload.
 * `spec` maps field -> { required, email, max, kind }.
 * Returns { values, errors } where errors map field -> i18n key.
 */
export function validate(input, spec) {
  const values = {};
  const errors = {};
  for (const [name, rule] of Object.entries(spec)) {
    const raw = input[name];
    const value = rule.kind === 'text' ? text(raw, rule.max || 4000) : str(raw, rule.max || 255);
    values[name] = value;
    if (rule.required && !value) { errors[name] = 'err_required'; continue; }
    if (rule.email && value && !isEmail(value)) { errors[name] = 'err_email'; }
  }
  return { values, errors };
}

/**
 * Parse a manual part-number block: one entry per line, optional ", qty".
 *   6205-2RSH, 4
 *   3RT2026-1BB40
 */
export function parsePartLines(input, limit = 40) {
  const out = [];
  for (const line of String(input || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = /^(.*?)(?:[,;x×]\s*(\d{1,5}))?$/.exec(trimmed);
    const part = str(match?.[1] || trimmed, 64);
    if (!part) continue;
    out.push({ part_number: part, qty: int(match?.[2] || 1, { min: 1, max: 9999, fallback: 1 }) });
    if (out.length >= limit) break;
  }
  return out;
}
