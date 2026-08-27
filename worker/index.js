// Worker entry point. Static files under public/ (main.css, admin.css, ...)
// are served automatically by the [assets] binding in wrangler.toml before
// this handler ever runs — only /admin* and /api/* reach here. (Datasheet
// files are served by GitHub Pages, not this Worker — see routes/api.js.)

import { dispatchAdmin } from './routes/admin.js';
import { dispatchApi } from './routes/api.js';
import { text, withCors } from './lib/respond.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        return await dispatchAdmin(request, env, url, ctx.waitUntil.bind(ctx));
      }

      if (pathname.startsWith('/api/')) {
        if (request.method === 'OPTIONS') {
          return withCors(new Response(null, { status: 204 }), env.PAGES_ORIGIN);
        }
        const response = await dispatchApi(request, env, url);
        if (!response) return text('Not found', { status: 404 });
        return withCors(response, env.PAGES_ORIGIN);
      }

      if (pathname === '/healthz') return text('ok', { cache: 'no-store' });

      return text('Not found', { status: 404 });
    } catch (error) {
      console.error(`[${request.method} ${pathname}]`, error);
      return text('Internal error', { status: 500, cache: 'no-store' });
    }
  },
};
