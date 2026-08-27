import sq from './sq.js';
import en from './en.js';
import { LOCALES, DEFAULT_LOCALE } from '../config.js';

const DICTS = { sq, en };

export { LOCALES, DEFAULT_LOCALE };

export function isLocale(value) {
  return LOCALES.includes(value);
}

/**
 * Translator bound to a locale. Missing keys fall back to the default locale,
 * then to the key itself, so a partially translated dictionary never breaks a page.
 */
export function translator(locale) {
  const dict = DICTS[locale] || DICTS[DEFAULT_LOCALE];
  const fallback = DICTS[DEFAULT_LOCALE];
  return (key) => dict[key] ?? fallback[key] ?? key;
}

/** Pick the locale-specific column of a database row: field(row, 'name', 'sq'). */
export function field(row, name, locale) {
  if (!row) return '';
  return row[`${name}_${locale}`] || row[`${name}_${DEFAULT_LOCALE}`] || row[`${name}_en`] || '';
}

/** Negotiate a locale from the Accept-Language header. */
export function negotiate(header) {
  if (!header) return DEFAULT_LOCALE;
  const parts = header.toLowerCase().split(',');
  for (const part of parts) {
    const tag = part.split(';')[0].trim().slice(0, 2);
    if (tag === 'sq' || tag === 'al') return 'sq';
    if (tag === 'en') return 'en';
  }
  return DEFAULT_LOCALE;
}
