import { all, get, run } from '../db.js';
import { token } from '../../core/crypto.js';

const MAX_ITEMS = 50;
const MAX_QTY = 99999;

export function createCart() {
  const id = token(16);
  run('INSERT INTO carts (id, updated_at) VALUES (?, ?)', id, Date.now());
  return id;
}

export const cartExists = (id) => !!(id && get('SELECT 1 AS x FROM carts WHERE id = ?', id));

export function listCartItems(cartId) {
  if (!cartId) return [];
  return all(
    `SELECT i.part_number, i.title, i.qty, i.product_id, p.slug,
            p.name_sq, p.name_en, p.unit, p.availability, p.price_eur,
            b.name AS brand_name
       FROM cart_items i
       LEFT JOIN products p ON p.id = i.product_id
       LEFT JOIN brands b ON b.id = p.brand_id
      WHERE i.cart_id = ?
      ORDER BY i.added_at`, cartId);
}

export function cartCount(cartId) {
  if (!cartId) return 0;
  return get('SELECT COUNT(*) AS n FROM cart_items WHERE cart_id = ?', cartId).n;
}

export function addToCart(cartId, { part_number, product_id = null, title = '', qty = 1 }) {
  const part = String(part_number || '').trim().slice(0, 64);
  if (!part) return false;
  if (cartCount(cartId) >= MAX_ITEMS
      && !get('SELECT 1 AS x FROM cart_items WHERE cart_id = ? AND part_number = ?', cartId, part)) {
    return false;
  }
  const quantity = clampQty(qty);
  run(
    `INSERT INTO cart_items (cart_id, part_number, product_id, title, qty, added_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(cart_id, part_number)
     DO UPDATE SET qty = MIN(?, cart_items.qty + excluded.qty)`,
    cartId, part, product_id, String(title).slice(0, 180), quantity, Date.now(), MAX_QTY,
  );
  touch(cartId);
  return true;
}

export function setQty(cartId, partNumber, qty) {
  const quantity = clampQty(qty);
  if (quantity <= 0) return removeFromCart(cartId, partNumber);
  run('UPDATE cart_items SET qty = ? WHERE cart_id = ? AND part_number = ?',
    quantity, cartId, partNumber);
  touch(cartId);
}

export function removeFromCart(cartId, partNumber) {
  run('DELETE FROM cart_items WHERE cart_id = ? AND part_number = ?', cartId, partNumber);
  touch(cartId);
}

export function clearCart(cartId) {
  run('DELETE FROM cart_items WHERE cart_id = ?', cartId);
  touch(cartId);
}

/** Remove baskets untouched for 30 days. Called from the periodic sweep. */
export const purgeStaleCarts = () =>
  run('DELETE FROM carts WHERE updated_at < ?', Date.now() - 30 * 864e5);

function clampQty(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_QTY) : 1;
}

function touch(cartId) {
  run('UPDATE carts SET updated_at = ? WHERE id = ?', Date.now(), cartId);
}
