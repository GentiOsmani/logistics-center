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

/** Ensure uniqueness against an existence predicate. */
export function uniqueSlug(base, exists) {
  let slug = slugify(base) || 'item';
  let n = 2;
  while (exists(slug)) slug = `${slugify(base)}-${n++}`;
  return slug;
}
