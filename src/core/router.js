/**
 * Tiny router: each pattern is compiled once to a RegExp at startup.
 * Supports `/products/:slug` parameters and a trailing `*` wildcard.
 */

const ESCAPE = /[.+?^${}()|[\]\\]/g;

function compile(pattern) {
  const keys = [];
  const source = pattern
    .replace(ESCAPE, '\\$&')
    .replace(/\\\*/g, () => { keys.push('wildcard'); return '(.*)'; })
    .replace(/:(\w+)/g, (_, key) => { keys.push(key); return '([^/]+)'; });
  return { regex: new RegExp('^' + source + '$'), keys };
}

export class Router {
  #routes = [];

  add(method, pattern, handler) {
    const { regex, keys } = compile(pattern);
    this.#routes.push({ method, regex, keys, handler, pattern });
    return this;
  }

  get(pattern, handler) { return this.add('GET', pattern, handler); }
  post(pattern, handler) { return this.add('POST', pattern, handler); }

  /** @returns {{handler: Function, params: object}|null} */
  match(method, pathname) {
    for (const route of this.#routes) {
      if (route.method !== method && !(method === 'HEAD' && route.method === 'GET')) continue;
      const m = route.regex.exec(pathname);
      if (!m) continue;
      const params = Object.create(null);
      for (let i = 0; i < route.keys.length; i++) {
        try { params[route.keys[i]] = decodeURIComponent(m[i + 1]); }
        catch { params[route.keys[i]] = m[i + 1]; }
      }
      return { handler: route.handler, params };
    }
    return null;
  }
}
