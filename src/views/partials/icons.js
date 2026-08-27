import { raw } from '../../core/html.js';

/**
 * Inline stroke icons on a 24×24 grid. Inlining avoids a sprite request and
 * lets icons inherit `currentColor`; each path is a few dozen bytes.
 */
const PATHS = {
  // categories
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3"/>',
  bolt: '<path d="M13.5 2.5 4.5 13.5h6l-1 8 9-11h-6z"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="1"/><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M10 1.8v1.7M14 1.8v1.7M10 20.5v1.7M14 20.5v1.7M1.8 10h1.7M1.8 14h1.7M20.5 10h1.7M20.5 14h1.7"/>',
  cylinder: '<rect x="2.5" y="8" width="12" height="8" rx="1"/><path d="M14.5 12h3M17.5 9.5h1.5v5h-1.5zM19 12h2.5M5.5 8v8"/>',
  droplet: '<path d="M12 2.8s6 6.2 6 10.2a6 6 0 0 1-12 0c0-4 6-10.2 6-10.2z"/><path d="M9 13.4a3 3 0 0 0 2.4 2.9"/>',
  radar: '<path d="M12 12 19 5"/><circle cx="12" cy="12" r="1.6"/><path d="M16.2 7.8a6 6 0 1 0 1.6 3"/><path d="M19.7 4.3a11 11 0 1 0 2.2 4.2"/>',
  motor: '<rect x="2.5" y="7" width="12" height="10" rx="1.5"/><path d="M14.5 10h3v4h-3zM17.5 12H21M5.5 4.5h6M6 17v2.5M11 17v2.5"/>',
  cable: '<path d="M4 3v6a4 4 0 0 0 4 4h8a4 4 0 0 1 4 4v4"/><rect x="2" y="1.5" width="4" height="3" rx="1"/><rect x="18" y="19.5" width="4" height="3" rx="1"/>',
  cabinet: '<rect x="3.5" y="2.5" width="17" height="19" rx="1.5"/><path d="M12 2.5v19M9 11h.8M15 11h.8"/>',
  drum: '<ellipse cx="12" cy="5.5" rx="7" ry="2.8"/><path d="M5 5.5v13c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-13M5 11c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/>',
  cube: '<path d="m12 2.5 8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3zM12 12l8.5-4.7M12 12v9.5M12 12 3.5 7.3"/>',

  // services
  wrench: '<path d="M15.5 3.3a5.5 5.5 0 0 0-6.1 8.4l-6 6a2 2 0 0 0 2.9 2.9l6-6a5.5 5.5 0 0 0 8.4-6.1l-3.2 3.2-3-.8-.8-3z"/>',
  panel: '<rect x="2.5" y="4" width="19" height="16" rx="1.5"/><path d="M2.5 9h19M6 13h5M6 16.5h3M15 13h3.5v3.5H15z"/>',
  shield: '<path d="M12 2.5 4.5 5.6v5.7c0 4.6 3.1 8.5 7.5 10.2 4.4-1.7 7.5-5.6 7.5-10.2V5.6z"/><path d="m8.8 11.8 2.2 2.3 4.2-4.4"/>',
  upgrade: '<path d="M12 20.5V6.2M6.5 11.5 12 5.8l5.5 5.7M4 2.6h16"/>',
  boxes: '<rect x="2.5" y="12.5" width="8" height="8" rx="1"/><rect x="13.5" y="12.5" width="8" height="8" rx="1"/><rect x="8" y="3.5" width="8" height="8" rx="1"/>',

  // interface
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
  arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5L15.5 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 6.7a2 2 0 0 1 2-2.2z"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="m3 6.5 9 6.2 9-6.2"/>',
  pin: '<path d="M12 21.5s7-6.4 7-11.4a7 7 0 1 0-14 0c0 5 7 11.4 7 11.4z"/><circle cx="12" cy="10" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l3.5 2.2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  menu: '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
  close: '<path d="m5.5 5.5 13 13M18.5 5.5l-13 13"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  alert: '<path d="M12 3.5 2.5 20h19zM12 9.5v4.5M12 17h.01"/>',
  pdf: '<path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5M8.5 13h7M8.5 16.5h4"/>',
  download: '<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4 19.5h16"/>',
  trash: '<path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5 7.5 21h9l1-14.5M10 10.5v6M14 10.5v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="m14.5 7.5 3 3"/>',
  logout: '<path d="M9.5 3.5H5a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 5 20.5h4.5M15 8l4 4-4 4M19 12H9"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/>',
  inbox: '<path d="M2.5 13.5h5l1.5 3h6l1.5-3h5"/><path d="M4.8 4.5h14.4l2.3 9v5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5v-5z"/>',
  tag: '<path d="M2.5 11.6V3.5h8.1l10.4 10.4a1.5 1.5 0 0 1 0 2.1l-6 6a1.5 1.5 0 0 1-2.1 0z"/><circle cx="7" cy="8" r="1.4"/>',
  building: '<path d="M3.5 21.5h17M5.5 21.5V4.5l7-2.5 6 2.5v17M9 8h.8M9 12h.8M9 16h.8M14 8h.8M14 12h.8M14 16h.8"/>',
  external: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 13.5v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h5"/>',
  spark: '<path d="M12 2.5 14 9l6.5 2-6.5 2-2 6.5-2-6.5L3.5 11 10 9z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5a6.5 6.5 0 0 1 13 0M17 5.2a3.5 3.5 0 0 1 0 5.6M18.5 20.5a6.6 6.6 0 0 0-2.2-4.9"/>',
};

/**
 * @param {string} name  key from PATHS
 * @param {object} [opts] { size, cls, stroke }
 */
export function icon(name, opts = {}) {
  const body = PATHS[name] || PATHS.cube;
  const size = opts.size || 24;
  const cls = opts.cls ? ` class="${opts.cls}"` : '';
  return raw(
    `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="${opts.stroke || 1.6}" ` +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    body + '</svg>',
  );
}

export const iconNames = Object.keys(PATHS);
