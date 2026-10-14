// The opening plate: a rotating specimen, a cut-glass logotype, and a
// dictionary entry for the word.

import { svgDoc, esc, f, wrap, SERIF, MOTION_CSS, FLASH } from './util.mjs';
import { makeCrystal, renderAnimated, renderStill, renderOrbit, bestAngle } from './crystal.mjs';

// Faceted capitals on a 56-unit cap height. Every corner is cut at 45°,
// the way a stone is faceted, so the word reads as cut rather than set.
const GLYPHS = {
  S: { w: 40, d: 'M40,7 L33,0 L8,0 L0,8 L0,20 L8,28 L32,28 L40,36 L40,48 L32,56 L7,56 L0,49' },
  A: { w: 42, d: 'M0,56 L0,15 L15,0 L27,0 L42,15 L42,56 M0,33 L42,33' },
  B: { w: 40, d: 'M29,28 L37,20 L37,8 L29,0 L7,0 L0,7 L0,49 L7,56 L32,56 L40,48 L40,36 L32,28 L0,28' },
  L: { w: 36, d: 'M0,0 L0,49 L7,56 L36,56' },
  E: { w: 36, d: 'M36,0 L7,0 L0,7 L0,49 L7,56 L36,56 M0,28 L28,28' },
  R: { w: 40, d: 'M0,56 L0,7 L7,0 L30,0 L40,10 L40,18 L30,28 L0,28 M22,28 L40,56' },
  I: { w: 4, d: 'M2,0 L2,56' },
  T: { w: 40, d: 'M0,0 L40,0 M20,0 L20,56' },
};

function logotype(word, { x, y, scale, tracking }) {
  let cursor = 0;
  const paths = [];
  [...word].forEach((ch, i) => {
    const g = GLYPHS[ch];
    paths.push({ d: g.d, dx: cursor, i });
    cursor += g.w + tracking;
  });
  const width = (cursor - tracking) * scale;
  const mk = (stroke, sw) =>
    paths
      .map(
        (p) =>
          `<path class="draw" style="animation-delay:${f(0.15 + p.i * 0.09, 2)}s" pathLength="1" transform="translate(${f(x + p.dx * scale)} ${f(y)}) scale(${scale})" d="${p.d}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter" stroke-miterlimit="4" vector-effect="none"/>`,
      )
      .join('');
  return { width, outer: mk('#fff', 7.4), inner: mk('#000', 1.5) };
}

export function renderHero(cfg, theme) {
  const W = 1000, H = 430;
  const t = theme;
  const crystal = makeCrystal(cfg.hero.crystal);
  const cx = 215, cy = 200, scale = 88;
  const view = { cx, cy, scale, tiltX: 0.27, tiltZ: 0.15, edge: t.edge, flash: FLASH };

  const anim = renderAnimated(crystal, { ...view, frames: 72, dur: 40, id: 'h' });
  const still = renderStill(crystal, { ...view, phi: bestAngle(crystal, view), id: 'hs' });
  const orbit = renderOrbit({ cx, cy, radius: scale * 1.7, colors: ['#9fe7df', '#a9c5ff', '#f0d48a', '#c5b5ff'], seed: 11 });

  const logo = logotype('SABLERITE', { x: 440, y: 78, scale: 1.1, tracking: 20 });
  const lx = 440;

  // Dictionary entry under the word.
  const fs = 19.5, lead = 29;
  let ty = 196;
  const entry = [];
  entry.push(
    `<text x="${lx}" y="${ty}" font-family="${SERIF}" font-size="20" font-style="italic" fill="${t.muted}">${esc(cfg.hero.pronunciation)}<tspan dx="14" font-style="italic" fill="${t.soft}">${esc(cfg.hero.partOfSpeech)}</tspan></text>`,
  );
  ty += 44;
  cfg.hero.senses.forEach((sense, i) => {
    const lines = wrap(sense, 500, fs, 0.47);
    entry.push(`<text x="${lx}" y="${ty}" font-family="${SERIF}" font-size="${fs}" font-weight="700" fill="${t.ink}">${i + 1}</text>`);
    lines.forEach((line, j) => {
      entry.push(`<text x="${lx + 24}" y="${ty + j * lead}" font-family="${SERIF}" font-size="${fs}" fill="${t.ink}">${esc(line)}</text>`);
    });
    ty += lines.length * lead + 14;
  });

  const defs = `
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${t.glow}" stop-opacity="${t.name === 'dark' ? 0.28 : 0.16}"/><stop offset="0.55" stop-color="${t.glow}" stop-opacity="${t.name === 'dark' ? 0.08 : 0.05}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="shadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity="${t.shadow}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="sheen" gradientUnits="userSpaceOnUse" x1="${lx}" y1="0" x2="${f(lx + logo.width)}" y2="0">
  <stop offset="0" stop-color="${t.ink}"/><stop offset="0.38" stop-color="${t.ink}"/>
  <stop offset="0.45" stop-color="${FLASH[2]}"/><stop offset="0.5" stop-color="${FLASH[3]}"/><stop offset="0.55" stop-color="${FLASH[4]}"/>
  <stop offset="0.62" stop-color="${t.ink}"/><stop offset="1" stop-color="${t.ink}"/>
  <animateTransform attributeName="gradientTransform" type="translate" values="${f(-logo.width * 1.1)} 0;${f(logo.width * 1.1)} 0" begin="1.3s" dur="2.6s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.25 1"/>
</linearGradient>
<mask id="word" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${logo.outer}${logo.inner}</mask>
${anim.defs}
${still.defs}`;

  const style = `
${MOTION_CSS}
.draw{stroke-dasharray:1 1;stroke-dashoffset:0;animation:draw 1.15s cubic-bezier(.65,0,.25,1) backwards}
@keyframes draw{from{stroke-dashoffset:1}}
.bob{animation:bob 8s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-7px)}}
.shade{transform-box:fill-box;transform-origin:center;animation:breathe 8s ease-in-out infinite}
@keyframes breathe{50%{transform:scaleX(.9);opacity:.75}}`;

  const body = `
<circle cx="${cx}" cy="${cy}" r="210" fill="url(#glow)"/>
<ellipse class="shade" cx="${cx}" cy="${cy + 192}" rx="100" ry="11" fill="url(#shadow)"/>
<g class="motion"><g class="bob">${orbit.back}${anim.body}${orbit.front}</g></g>
<g class="still">${still.body}</g>
<text x="${cx}" y="${H - 14}" text-anchor="middle" font-family="${SERIF}" font-size="14.5" font-style="italic" fill="${t.muted}">${esc(cfg.hero.caption)}</text>
<rect x="${lx - 10}" y="60" width="${f(logo.width + 20)}" height="100" fill="url(#sheen)" mask="url(#word)"/>
${entry.join('\n')}`;

  return svgDoc({
    w: W,
    h: H,
    title: 'Sablerite',
    desc: `${cfg.hero.pronunciation} ${cfg.hero.partOfSpeech}. ${cfg.hero.senses.map((s, i) => `${i + 1}. ${s}`).join(' ')}`,
    defs,
    style,
    body,
  });
}
