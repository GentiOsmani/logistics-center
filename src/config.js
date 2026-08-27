import { join } from 'node:path';
import process from 'node:process';

const root = join(import.meta.dirname, '..');

export const config = {
  root,
  publicDir: join(root, 'public'),
  dataDir: join(root, 'data'),
  uploadDir: join(root, 'data', 'uploads'),
  dbFile: process.env.DB_FILE || join(root, 'data', 'app.db'),

  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3000),

  /** Secret used to sign cookies. MUST be set in production. */
  secret: process.env.APP_SECRET || 'dev-only-insecure-secret-change-me',

  /** Trust X-Forwarded-* headers (set to 1 behind nginx/Caddy). */
  trustProxy: process.env.TRUST_PROXY === '1',

  isProd: process.env.NODE_ENV === 'production',

  company: {
    name: 'Logistics Center',
    legal: 'Logistics Center SH.P.K.',
    tagline: 'Industrial Supply & Technical Services',
    email: 'info@logisticscenter.com',
    sales: 'shitje@logisticscenter.com',
    support: 'support@logisticscenter.com',
    phone: '+383 44 000 000',
    phoneAl: '+355 69 000 0000',
    whatsapp: '+383 44 000 000',
    addressXK: 'Zona Industriale, Rr. B, nr. 12, 10000 Prishtinë, Kosovë',
    addressAL: 'Rr. e Kavajës, Njësia 7, 1001 Tiranë, Shqipëri',
    hours: '08:00 – 17:00',
    vat: 'NUI 8110000000',
  },

  limits: {
    bodyBytes: 256 * 1024,      // 256 KB for normal forms
    uploadBytes: 12 * 1024 * 1024, // 12 MB for datasheets
    pageSize: 24,
  },
};

export const LOCALES = ['sq', 'en'];
export const DEFAULT_LOCALE = 'sq';
