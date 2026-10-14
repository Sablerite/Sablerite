// Small, dependency-free helpers shared by every renderer.

export const SERIF = `'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,'Times New Roman',serif`;
export const MONO = `ui-monospace,'Cascadia Mono','SF Mono',Menlo,Consolas,monospace`;

// Two palettes, one per GitHub theme. The crystal itself is always dark:
// sablerite is a black mineral, so only the ink around it changes.
export const THEMES = {
  dark: {
    name: 'dark',
    ink: '#e6edf3',
    soft: '#c3ccd6',
    muted: '#848d97',
    faint: '#30363d',
    hair: '#21262d',
    plate: '#0b0f15',
    glow: '#3b6fd6',
    edge: 'rgba(190,215,255,0.22)',
    shadow: 0.55,
    strata: ['#2a3442', '#212a36', '#1a212b', '#141a22', '#10151c'],
  },
  light: {
    name: 'light',
    ink: '#1f2328',
    soft: '#3d444d',
    muted: '#656d76',
    faint: '#d0d7de',
    hair: '#e4e8ec',
    plate: '#0f141b',
    glow: '#7aa2ff',
    edge: 'rgba(210,225,255,0.20)',
    shadow: 0.22,
    strata: ['#e3e7ec', '#d4dae1', '#c4ccd5', '#b2bcc7', '#9fabb8'],
  },
};

// Labradorite flash ramp: gold at the edge of a flash, blue at its heart.
export const FLASH = ['#c99a3e', '#3fd0b8', '#38b6e8', '#3f7dff', '#8f6bff'];

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Compact number formatting for SVG coordinates.
export const f = (n, d = 1) => {
  const v = Number(n.toFixed(d));
  return Object.is(v, -0) ? '0' : String(v);
};

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---- colour -------------------------------------------------------------

export const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (c) =>
  '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export const mixRgb = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
export const mixHex = (a, b, t) => rgbToHex(mixRgb(hexToRgb(a), hexToRgb(b), t));
export const screen = (a, b) => a.map((v, i) => 255 - ((255 - v) * (255 - b[i])) / 255);

export function ramp(stops, t) {
  const cols = stops.map(hexToRgb);
  const x = clamp(t) * (cols.length - 1);
  const i = Math.min(cols.length - 2, Math.floor(x));
  return mixRgb(cols[i], cols[i + 1], x - i);
}

// Visible-spectrum colour for a wavelength in nm (after Dan Bruton's approximation).
export function wavelengthRgb(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) { r = 1; }
  let k = 1;
  if (nm > 700) k = 0.3 + (0.7 * (780 - nm)) / 80;
  else if (nm < 420) k = 0.3 + (0.7 * (nm - 380)) / 40;
  return [r, g, b].map((v) => 255 * Math.pow(v * k, 0.8));
}

// ---- text ---------------------------------------------------------------

// Greedy word wrap by an approximate glyph width (em fraction per char).
export function wrap(text, maxWidth, fontSize, em = 0.5) {
  const limit = maxWidth / (fontSize * em);
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const next = line ? line + ' ' + word : word;
    if (next.length > limit && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// Turns "C_4 (C++)_3" into tspans with real subscripts.
export function formulaTspans(src, fontSize) {
  const drop = fontSize * 0.28;
  return src
    .split(/(_\d+)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('_')
        ? `<tspan dy="${f(drop)}" font-size="${f(fontSize * 0.68)}">${esc(part.slice(1))}</tspan><tspan dy="${f(-drop)}"> </tspan>`
        : esc(part),
    )
    .join('');
}

// ---- document -----------------------------------------------------------

export function svgDoc({ w, h, title, desc, defs = '', style = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d" fill="none">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
${style ? `<style>${style.trim().replace(/\n\s*/g, ' ')}</style>` : ''}
${defs ? `<defs>${defs}</defs>` : ''}
${body}
</svg>
`;
}

// Shared CSS: still frames replace motion for people who ask for less of it.
export const MOTION_CSS = `
.still{display:none}
@media (prefers-reduced-motion: reduce){.motion{display:none}.still{display:inline}*{animation:none!important}}
`;
