// Ported from src/lib/slug.js. `uniqueSlug`'s existence check becomes async
// since it now runs a D1 query instead of a sync node:sqlite lookup.

const COMBINING = /[̀-ͯ]/g;

/** URL-safe slug with Albanian character folding (ë → e, ç → c). */
export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ë/g, 'e')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(COMBINING, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

/** Ensure uniqueness against an async existence predicate. */
export async function uniqueSlug(base, exists) {
  let slug = slugify(base) || 'item';
  let n = 2;
  while (await exists(slug)) slug = `${slugify(base)}-${n++}`;
  return slug;
}
