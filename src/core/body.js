import { config } from '../config.js';

class BodyTooLarge extends Error {
  constructor() { super('Body too large'); this.status = 413; }
}

function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new BodyTooLarge()); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks, size)));
    req.on('error', reject);
  });
}

/** Parse application/x-www-form-urlencoded into a null-prototype object. */
export async function parseForm(req) {
  // The body stream can only be read once; cache it so that middleware and the
  // route handler can both consume the same parsed form.
  if (req._parsedForm) return req._parsedForm;
  const type = req.headers['content-type'] || '';
  if (!type.startsWith('application/x-www-form-urlencoded')) return Object.create(null);
  const buf = await readRaw(req, config.limits.bodyBytes);
  const params = new URLSearchParams(buf.toString('utf8'));
  const out = Object.create(null);
  for (const [key, value] of params) {
    if (key.endsWith('[]')) {
      const k = key.slice(0, -2);
      (out[k] ||= []).push(value);
    } else {
      out[key] = value;
    }
  }
  req._parsedForm = out;
  return out;
}

/**
 * Minimal multipart/form-data parser — sized for CMS uploads (a handful of
 * small parts), not for streaming large media. Returns { fields, files }.
 */
export async function parseMultipart(req) {
  const type = req.headers['content-type'] || '';
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
  if (!type.startsWith('multipart/form-data') || !match) {
    return { fields: await parseForm(req), files: Object.create(null) };
  }
  const boundary = Buffer.from('--' + (match[1] || match[2]).trim());
  const buf = await readRaw(req, config.limits.uploadBytes);
  const fields = Object.create(null);
  const files = Object.create(null);

  let pos = buf.indexOf(boundary);
  while (pos !== -1) {
    let start = pos + boundary.length;
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break; // closing "--"
    start += 2; // skip CRLF
    const headerEnd = buf.indexOf('\r\n\r\n', start, 'latin1');
    if (headerEnd === -1) break;
    const headers = buf.toString('latin1', start, headerEnd);
    const next = buf.indexOf(boundary, headerEnd);
    if (next === -1) break;
    const body = buf.subarray(headerEnd + 4, next - 2); // drop trailing CRLF

    const name = /name="([^"]*)"/i.exec(headers)?.[1];
    const filename = /filename="([^"]*)"/i.exec(headers)?.[1];
    const mime = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1];

    if (name) {
      if (filename !== undefined) {
        if (filename) {
          files[name] = {
            filename,
            mime: (mime || 'application/octet-stream').trim(),
            data: Buffer.from(body),
          };
        }
      } else {
        const value = body.toString('utf8');
        if (name.endsWith('[]')) (fields[name.slice(0, -2)] ||= []).push(value);
        else fields[name] = value;
      }
    }
    pos = next;
  }
  return { fields, files };
}
