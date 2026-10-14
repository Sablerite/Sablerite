// An emission spectrum of the code: every language owns one spectral line,
// as an element would, and shines in proportion to its share.

import { svgDoc, esc, f, SERIF, wavelengthRgb, rgbToHex, hashStr } from './util.mjs';

// Fixed lines for common languages, chosen near their usual GitHub colours.
const LINES = {
  CSS: 425, Lua: 438, C: 462, TypeScript: 452, Python: 478, Dart: 492, 'C#': 508,
  GLSL: 522, Kotlin: 540, Go: 500, Rust: 594, JavaScript: 576, Swift: 602, 'C++': 616,
  HTML: 630, Java: 646, Ruby: 660, PHP: 444, Shell: 556, 'Objective-C': 668,
};

const NM0 = 400, NM1 = 700;

function assign(langs) {
  const used = [];
  return langs.map((l) => {
    let nm = LINES[l.lang] ?? NM0 + 12 + (hashStr(l.lang) % (NM1 - NM0 - 24));
    // Keep lines at least 7 nm apart.
    for (let tries = 0; tries < 40 && used.some((u) => Math.abs(u - nm) < 7); tries++) nm += tries % 2 ? -(tries * 3) : tries * 3;
    used.push(nm);
    return { ...l, nm };
  });
}

export function renderSpectrum(theme, { shares, voters }) {
  const t = theme;
  const W = 1000, H = 252;
  const band = { x: 0, y: 64, w: W, h: 96 };
  const xOf = (nm) => band.x + ((nm - NM0) / (NM1 - NM0)) * band.w;
  const top = shares.filter((s) => s.share > 0.001);
  const max = top[0]?.share || 1;
  const lines = assign(top);

  const stops = [];
  for (let nm = NM0; nm <= NM1; nm += 20) stops.push(`<stop offset="${f((nm - NM0) / (NM1 - NM0), 3)}" stop-color="${rgbToHex(wavelengthRgb(nm))}"/>`);

  const marks = [], labels = [];
  // Draw faint lines first so bright ones sit on top.
  for (const l of [...lines].sort((a, b) => a.share - b.share)) {
    const x = xOf(l.nm);
    const k = Math.sqrt(l.share / max);
    const col = rgbToHex(wavelengthRgb(l.nm).map((v) => v * 0.45 + 255 * 0.55 * k));
    const core = rgbToHex(wavelengthRgb(l.nm));
    marks.push(
      `<rect x="${f(x - 9 * k - 3)}" y="${band.y}" width="${f(18 * k + 6)}" height="${band.h}" fill="${core}" opacity="${f(0.22 * k + 0.06, 2)}" filter="url(#bloom)"/>` +
        `<rect x="${f(x - 1.2 - 1.6 * k)}" y="${band.y}" width="${f(2.4 + 3.2 * k)}" height="${band.h}" fill="${col}" opacity="${f(0.45 + 0.55 * k, 2)}"/>`,
    );
  }
  // Labels above the band; push a label up a row when it would collide.
  const rowsEnd = [-Infinity, -Infinity];
  for (const l of [...lines].sort((a, b) => a.nm - b.nm)) {
    if (l.share < 0.02) continue;
    const x = xOf(l.nm);
    const pct = l.share >= 0.095 ? Math.round(l.share * 100) : (l.share * 100).toFixed(1);
    const label = `${l.lang} ${pct}%`;
    const half = label.length * 4.2;
    const row = x - half > rowsEnd[0] + 10 ? 0 : 1;
    rowsEnd[row] = x + half;
    const ly = row === 0 ? band.y - 12 : band.y - 34;
    labels.push(
      `<line x1="${f(x)}" y1="${ly + 4}" x2="${f(x)}" y2="${band.y - 2}" stroke="${t.muted}" stroke-opacity="0.6" stroke-width="0.8"/>` +
        `<text x="${f(x)}" y="${ly}" text-anchor="middle" font-family="${SERIF}" font-size="15" fill="${t.ink}">${esc(l.lang)}<tspan dx="5" fill="${t.muted}" font-style="italic">${pct}%</tspan></text>`,
    );
  }

  const ticks = [];
  for (let nm = NM0; nm <= NM1; nm += 50) {
    const x = Math.min(W - 1, Math.max(1, xOf(nm)));
    const anchor = nm === NM0 ? 'start' : nm === NM1 ? 'end' : 'middle';
    ticks.push(
      `<line x1="${f(x)}" y1="${band.y + band.h}" x2="${f(x)}" y2="${band.y + band.h + 7}" stroke="${t.muted}" stroke-width="1"/>` +
        `<text x="${f(x)}" y="${band.y + band.h + 24}" text-anchor="${anchor}" font-family="${SERIF}" font-size="13" font-style="italic" fill="${t.muted}">${nm} nm</text>`,
    );
  }
  for (let nm = NM0 + 10; nm < NM1; nm += 10) {
    if (nm % 50) ticks.push(`<line x1="${f(xOf(nm))}" y1="${band.y + band.h}" x2="${f(xOf(nm))}" y2="${band.y + band.h + 3.5}" stroke="${t.muted}" stroke-opacity="0.6" stroke-width="0.8"/>`);
  }

  const traces = lines.filter((l) => l.share < 0.02).map((l) => l.lang);
  const caption =
    `Fig. 3. Emission spectrum of ${voters} public repositories, each weighted equally.` +
    (traces.length ? ` Traces of ${traces.slice(0, -1).join(', ')}${traces.length > 1 ? ' and ' : ''}${traces.at(-1)}.` : '');

  return svgDoc({
    w: W,
    h: H,
    title: 'Language spectrum',
    desc: `Language composition across ${voters} public repositories: ` + top.map((l) => `${l.lang} ${(l.share * 100).toFixed(1)}%`).join(', ') + '.',
    defs: `<linearGradient id="cont" x1="0" x2="1">${stops.join('')}</linearGradient>
<filter id="bloom" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
<clipPath id="bandclip"><rect x="${band.x}" y="${band.y}" width="${band.w}" height="${band.h}" rx="3"/></clipPath>
<linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></linearGradient>`,
    body: `<g clip-path="url(#bandclip)">
<rect x="${band.x}" y="${band.y}" width="${band.w}" height="${band.h}" fill="${t.plate}"/>
<rect x="${band.x}" y="${band.y}" width="${band.w}" height="${band.h}" fill="url(#cont)" opacity="0.07"/>
${marks.join('\n')}
<rect x="${band.x}" y="${band.y}" width="${band.w}" height="${band.h}" fill="url(#vignette)"/>
</g>
${ticks.join('\n')}
${labels.join('\n')}
<text x="0" y="${H - 8}" font-family="${SERIF}" font-size="14" font-style="italic" fill="${t.muted}">${esc(caption)}</text>`,
  });
}
