import { readdir, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';
import { extname, join, relative, sep } from 'node:path';
import { config } from '../config.js';

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const COMPRESSIBLE = /^(text\/|image\/svg|application\/(javascript|json|xml|manifest))/;
const FINGERPRINTED = /\.[0-9a-f]{8}\.[a-z0-9]+$/;

export function mimeFor(path) {
  return MIME[extname(path).toLowerCase()] || 'application/octet-stream';
}

/**
 * Static assets are read, hashed and pre-compressed once at boot, then served
 * from memory. Fingerprinted URLs get immutable caching; the plain path stays
 * available as a fallback with a short TTL.
 */
export class AssetStore {
  #byUrl = new Map();
  #bySource = new Map();

  async load() {
    const dir = config.publicDir;
    for await (const file of walk(dir)) {
      const rel = '/' + relative(dir, file).split(sep).join('/');
      const data = await readFile(file);
      const mime = mimeFor(file);
      const hash = createHash('sha1').update(data).digest('hex').slice(0, 8);
      const dot = rel.lastIndexOf('.');
      const url = rel.slice(0, dot) + '.' + hash + rel.slice(dot);

      const asset = { data, mime, etag: '"' + hash + '"', encodings: new Map() };
      if (COMPRESSIBLE.test(mime) && data.length > 512) {
        asset.encodings.set('br', brotliCompressSync(data, {
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
            [zlibConstants.BROTLI_PARAM_SIZE_HINT]: data.length,
          },
        }));
        asset.encodings.set('gzip', gzipSync(data, { level: 9 }));
      }
      this.#byUrl.set(url, asset);
      this.#byUrl.set(rel, asset);
      this.#bySource.set(rel, url);
    }
    return this;
  }

  /** Map a source path (/assets/css/main.css) to its fingerprinted URL. */
  url(sourcePath) {
    return this.#bySource.get(sourcePath) || sourcePath;
  }

  send(req, res, url) {
    const asset = this.#byUrl.get(url);
    if (!asset) return false;

    res.setHeader('Content-Type', asset.mime);
    res.setHeader('ETag', asset.etag);
    res.setHeader('Cache-Control', FINGERPRINTED.test(url)
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600');

    if (req.headers['if-none-match'] === asset.etag) {
      res.writeHead(304).end();
      return true;
    }

    const accept = req.headers['accept-encoding'] || '';
    let payload = asset.data;
    if (asset.encodings.size) {
      res.setHeader('Vary', 'Accept-Encoding');
      if (accept.includes('br')) {
        payload = asset.encodings.get('br');
        res.setHeader('Content-Encoding', 'br');
      } else if (accept.includes('gzip')) {
        payload = asset.encodings.get('gzip');
        res.setHeader('Content-Encoding', 'gzip');
      }
    }
    res.setHeader('Content-Length', payload.length);
    if (req.method === 'HEAD') { res.writeHead(200).end(); return true; }
    res.writeHead(200).end(payload);
    return true;
  }
}

/** Stream a CMS-uploaded file (datasheet, image) straight from disk. */
export async function sendUpload(req, res, filename) {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes('..')) return false;
  const path = join(config.uploadDir, filename);
  let info;
  try { info = await stat(path); } catch { return false; }
  if (!info.isFile()) return false;

  const etag = '"' + info.size.toString(16) + '-' + Math.floor(info.mtimeMs).toString(16) + '"';
  res.setHeader('Content-Type', mimeFor(path));
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.setHeader('Content-Disposition', 'inline; filename="' + filename.replace(/"/g, '') + '"');
  if (req.headers['if-none-match'] === etag) { res.writeHead(304).end(); return true; }
  res.setHeader('Content-Length', info.size);
  if (req.method === 'HEAD') { res.writeHead(200).end(); return true; }
  res.writeHead(200);
  createReadStream(path).pipe(res);
  return true;
}

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}
