// Replaces src/core/body.js. Workers' Fetch API `Request.formData()` parses
// both `application/x-www-form-urlencoded` and `multipart/form-data` bodies
// natively, so there's no need to hand-roll a multipart parser here — the
// original's parseForm/parseMultipart split collapses into one function.
//
// A body can only be read once; each request is parsed exactly once in
// worker/routes/admin.js's dispatch() and the result threaded through to the
// handler, mirroring how the original cached `req._parsedForm`.

/** @returns {Promise<{fields: object, files: object}>} */
export async function readForm(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.startsWith('application/x-www-form-urlencoded') && !type.startsWith('multipart/form-data')) {
    return { fields: Object.create(null), files: Object.create(null) };
  }

  const formData = await request.formData();
  const fields = Object.create(null);
  const files = Object.create(null);

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size > 0) files[key] = value;
      continue;
    }
    if (key.endsWith('[]')) {
      const k = key.slice(0, -2);
      (fields[k] ||= []).push(value);
    } else {
      fields[key] = value;
    }
  }
  return { fields, files };
}
