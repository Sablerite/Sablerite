// A tiny software renderer for convex crystals.
//
// SVG has no 3D, so every frame of the rotation is solved here: vertices are
// rotated and projected, back faces culled, and each face lit. The result is
// written out as SMIL keyframes, so GitHub's image proxy just plays a loop.
// Because the solid is convex, front faces never overlap and need no sorting.

import { mulberry32, clamp, smoothstep, hexToRgb, rgbToHex, mixRgb, screen, ramp, FLASH, f } from './util.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const centroid = (ps) => ps.reduce((s, p) => [s[0] + p[0] / ps.length, s[1] + p[1] / ps.length, s[2] + p[2] / ps.length], [0, 0, 0]);

const rotY = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
const rotX = (p, a) => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];
const rotZ = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];

// A doubly terminated prism: a slightly irregular n-gon ring, tapered toward
// the top, capped with two off-centre pyramids. Every face stays planar.
export function makeCrystal({
  seed = 7,
  sides = 6,
  prism = 1.7,
  top = 0.95,
  bottom = 0.7,
  taper = 0.9,
  jitter = 0.14,
  apexShift = 0.18,
} = {}) {
  const rnd = mulberry32(seed);
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + (rnd() - 0.5) * jitter * ((Math.PI * 2) / sides);
    const r = 1 + (rnd() - 0.5) * jitter * 1.4;
    ring.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const yB = -prism / 2, yT = prism / 2;
  const verts = [];
  for (const [x, z] of ring) verts.push([x, yB, z]);
  for (const [x, z] of ring) verts.push([x * taper, yT, z * taper]);
  const topApex = verts.push([(rnd() - 0.5) * apexShift, yT + top, (rnd() - 0.5) * apexShift]) - 1;
  const botApex = verts.push([(rnd() - 0.5) * apexShift, yB - bottom, (rnd() - 0.5) * apexShift]) - 1;

  const faces = [];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    // Horizontal growth striations, as on real quartz prism faces.
    const lines = [];
    const count = 3 + Math.floor(rnd() * 4);
    for (let s = 0; s < count; s++) {
      const t = 0.08 + rnd() * 0.84;
      lines.push({ a: [i, sides + i, t], b: [j, sides + j, t], o: 0.1 + rnd() * 0.16 });
    }
    faces.push({ v: [i, j, sides + j, sides + i], kind: 'prism', seed: rnd(), lines });
    faces.push({ v: [sides + i, sides + j, topApex], kind: 'top', seed: rnd(), lines: [] });
    faces.push({ v: [j, i, botApex], kind: 'bottom', seed: rnd(), lines: [] });
  }
  // Wind every face so its normal points outward.
  const c = centroid(verts);
  for (const face of faces) {
    const p = face.v.map((k) => verts[k]);
    const n = cross(sub(p[1], p[0]), sub(p[2], p[0]));
    if (dot(n, sub(centroid(p), c)) < 0) face.v.reverse();
  }
  return { verts, faces, topApex, botApex };
}

// Solve one frame: rotated, projected vertices plus per-face normal/visibility.
export function solve(crystal, { phi, tiltX = 0.26, tiltZ = 0.16, scale = 80, cx = 0, cy = 0, camera = 1600 }) {
  const world = crystal.verts.map((v) => {
    const p = rotZ(rotX(rotY(v, phi), tiltX), tiltZ);
    return [p[0] * scale, p[1] * scale, p[2] * scale];
  });
  const project = ([x, y, z]) => {
    const k = camera / (camera - z);
    return [cx + x * k, cy - y * k];
  };
  const screenPts = world.map(project);
  const along = ([u, v, t]) => project(world[u].map((c, i) => c + (world[v][i] - c) * t));
  const faces = crystal.faces.map((face) => {
    const p = face.v.map((k) => world[k]);
    const n = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    const view = sub([0, 0, camera], centroid(p));
    return {
      n,
      visible: dot(n, view) > 0,
      pts: face.v.map((k) => screenPts[k]),
      lines: face.lines.map((l) => [along(l.a), along(l.b)]),
    };
  });
  return { faces, screenPts, world };
}

const KEY = norm([-0.55, 0.72, 0.5]);
// The main flash catches prism faces as they turn past the viewer; a second,
// rarer one catches the cap from above in gold.
const FLASH_DIR = norm([0.36, -0.1, 0.93]);
const CAP_DIR = norm([-0.35, 0.62, 0.7]);
const GOLD = ['#7a5a1c', '#e9b949', '#fff1c4'];
const DEEP = hexToRgb('#07090e');
const LIT = hexToRgb('#414a5e');
const RIM = hexToRgb('#4f6f9c');

// Sable body, a cool rim, and a labradorescent flash when a face
// swings through the right angle to the light.
export function shade(n, faceSeed, flashStops = FLASH) {
  const diffuse = Math.max(0, dot(n, KEY));
  const rim = Math.pow(1 - clamp(n[2]), 2.2);
  let col = mixRgb(DEEP, LIT, Math.pow(diffuse, 1.5) * 0.9);
  col = col.map((v, i) => v + RIM[i] * rim * 0.3);
  const d = dot(n, FLASH_DIR) + (faceSeed - 0.5) * 0.05;
  const flash = smoothstep(0.86, 0.992, d);
  if (flash > 0) {
    const t = clamp((d - 0.86) / 0.13 + (faceSeed - 0.5) * 0.3);
    col = screen(col, ramp(flashStops, t).map((v) => v * flash));
  }
  const g = smoothstep(0.93, 0.995, dot(n, CAP_DIR));
  if (g > 0) col = screen(col, ramp(GOLD, g).map((v) => v * g * 0.85));
  return { rgb: col, flash: Math.max(flash, g) };
}

const pts = (ps) => ps.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');

// Per-face light falloff, shared by every face through objectBoundingBox units.
export const facetGradient = (id) =>
  `<linearGradient id="${id}" x1="0.2" y1="0" x2="0.8" y2="1">` +
  `<stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0.02"/>` +
  `<stop offset="1" stop-color="#000000" stop-opacity="0.32"/></linearGradient>`;

const STRIA = '#dbe8ff';

// The full rotating crystal as SMIL keyframes. Each face is a group: its
// geometry lives once in <defs> and is drawn twice (lit colour, then the
// gradient overlay), with striations on top. Culling toggles the group.
export function renderAnimated(crystal, o) {
  const { frames = 72, dur = 36, phi0 = 0, edge, flash = FLASH, id = 'c' } = o;
  const step = (Math.PI * 2) / frames;
  const solved = [];
  const mid = [];
  for (let k = 0; k <= frames; k++) {
    solved.push(solve(crystal, { ...o, phi: phi0 + k * step }));
    if (k < frames) mid.push(solve(crystal, { ...o, phi: phi0 + (k + 0.5) * step }));
  }
  const keyTimes = Array.from({ length: frames + 1 }, (_, k) => f(k / frames, 4)).join(';');
  const loop = `dur="${dur}s" repeatCount="indefinite"`;
  const defs = [facetGradient(`${id}-facet`)];
  const out = [];
  crystal.faces.forEach((face, i) => {
    const pv = solved.map((s) => pts(s.faces[i].pts)).join(';');
    const fv = solved.map((s) => rgbToHex(shade(s.faces[i].n, face.seed, flash).rgb)).join(';');
    // Visibility is judged mid-interval and held for the whole interval.
    const vis = mid.map((s) => (s.faces[i].visible ? 1 : 0));
    vis.push(vis[0]);
    defs.push(`<polygon id="${id}-f${i}" points="${pts(solved[0].faces[i].pts)}"><animate attributeName="points" ${loop} values="${pv}"/></polygon>`);
    const lines = face.lines
      .map((l, li) => {
        const lv = solved.map((s) => pts(s.faces[i].lines[li])).join(';');
        return `<polyline points="${pts(solved[0].faces[i].lines[li])}" stroke="${STRIA}" stroke-opacity="${f(l.o, 2)}" stroke-width="0.8"><animate attributeName="points" ${loop} values="${lv}"/></polyline>`;
      })
      .join('');
    out.push(
      `<g opacity="${vis[0]}"><animate attributeName="opacity" ${loop} calcMode="discrete" keyTimes="${keyTimes}" values="${vis.join(';')}"/>` +
        `<use href="#${id}-f${i}" fill="${rgbToHex(shade(solved[0].faces[i].n, face.seed, flash).rgb)}"><animate attributeName="fill" ${loop} values="${fv}"/></use>` +
        `<use href="#${id}-f${i}" fill="url(#${id}-facet)" stroke="${edge}" stroke-width="1" stroke-linejoin="round"/>` +
        lines +
        `</g>`,
    );
  });

  // One glint, riding the upper corner of whichever face flashes hardest.
  // It is only bright near a peak, so it never visibly slides between faces.
  const glint = solved.map((s) => {
    let best = -1, m = 0;
    s.faces.forEach((sf, i) => {
      if (!sf.visible) return;
      const fl = shade(sf.n, crystal.faces[i].seed, flash).flash;
      if (fl > m) { m = fl; best = i; }
    });
    if (best < 0) return { p: s.screenPts[crystal.topApex], o: 0 };
    const corner = s.faces[best].pts.reduce((a, b) => (b[1] - 0.6 * b[0] < a[1] - 0.6 * a[0] ? b : a));
    return { p: corner, o: Math.pow(m, 2.2) };
  });
  out.push(
    `<g opacity="0"><animate attributeName="opacity" ${loop} values="${glint.map((g) => f(g.o, 2)).join(';')}"/>` +
      `<animateTransform attributeName="transform" type="translate" ${loop} values="${glint.map((g) => `${f(g.p[0])},${f(g.p[1])}`).join(';')}"/>` +
      `<path d="M0,-16 L1.5,-1.5 L16,0 L1.5,1.5 L0,16 L-1.5,1.5 L-16,0 L-1.5,-1.5Z" fill="#f4f8ff"/>` +
      `<circle r="3" fill="#ffffff"/></g>`,
  );
  return { defs: defs.join('\n'), body: out.join('\n') };
}

// One frame, for thumbnails and for reduced-motion viewers.
export function renderStill(crystal, o) {
  const { edge, flash = FLASH, edgeWidth = 1, id = 's', striations = true } = o;
  const s = solve(crystal, o);
  const body = crystal.faces
    .map((face, i) => {
      const sf = s.faces[i];
      if (!sf.visible) return '';
      const p = pts(sf.pts);
      const lines = striations
        ? face.lines.map((l, li) => `<polyline points="${pts(sf.lines[li])}" stroke="${STRIA}" stroke-opacity="${f(l.o, 2)}" stroke-width="0.8"/>`).join('')
        : '';
      return (
        `<polygon points="${p}" fill="${rgbToHex(shade(sf.n, face.seed, flash).rgb)}"/>` +
        `<polygon points="${p}" fill="url(#${id}-facet)" stroke="${edge}" stroke-width="${edgeWidth}" stroke-linejoin="round"/>` +
        lines
      );
    })
    .join('');
  return { defs: facetGradient(`${id}-facet`), body };
}

// Find the angle in a full turn where the crystal flashes most, for stills.
export function bestAngle(crystal, o, samples = 120) {
  let best = 0, bestScore = -1;
  for (let k = 0; k < samples; k++) {
    const phi = (k / samples) * Math.PI * 2;
    const s = solve(crystal, { ...o, phi });
    const flashes = s.faces
      .map((sf, i) => (sf.visible ? shade(sf.n, crystal.faces[i].seed, o.flash).flash : 0))
      .sort((a, b) => b - a);
    // One strong flash plus some supporting faces reads best.
    const score = flashes[0] + 0.35 * flashes[1] + 0.15 * flashes[2];
    if (score > bestScore) { bestScore = score; best = phi; }
  }
  return best;
}

// Small particles orbiting the specimen, split into a back and front layer
// so they pass behind and in front of the crystal.
export function renderOrbit({ count = 9, seed = 3, cx, cy, radius, frames = 60, dur = 26, tiltX = 0.38, tiltZ = 0.16, camera = 1600, colors }) {
  const rnd = mulberry32(seed);
  const back = [], front = [];
  const keyTimes = Array.from({ length: frames + 1 }, (_, k) => f(k / frames, 4)).join(';');
  for (let p = 0; p < count; p++) {
    const phase = (p / count) * Math.PI * 2 + rnd() * 0.5;
    const r = radius * (0.88 + rnd() * 0.3);
    const yOff = (rnd() - 0.5) * radius * 0.22;
    const size = 1.3 + rnd() * 1.6;
    const color = colors[p % colors.length];
    const xs = [], ys = [], zs = [];
    for (let k = 0; k <= frames; k++) {
      const a = phase + (k / frames) * Math.PI * 2;
      const q = rotZ(rotX([Math.cos(a) * r, yOff, Math.sin(a) * r], tiltX), tiltZ);
      const kk = camera / (camera - q[2]);
      xs.push(f(cx + q[0] * kk));
      ys.push(f(cy - q[1] * kk));
      zs.push(q[2]);
    }
    const anim = `<animate attributeName="cx" dur="${dur}s" repeatCount="indefinite" values="${xs.join(';')}"/><animate attributeName="cy" dur="${dur}s" repeatCount="indefinite" values="${ys.join(';')}"/>`;
    const visFront = zs.map((z, k) => (k < frames ? ((z + zs[k + 1]) / 2 >= 0 ? 1 : 0) : null));
    visFront[frames] = visFront[0];
    const visBack = visFront.map((v) => 1 - v);
    const disc = (vals) => `<animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes}" values="${vals.join(';')}"/>`;
    const dot = (op, vals) => `<circle cx="${xs[0]}" cy="${ys[0]}" r="${f(size)}" fill="${color}" fill-opacity="${op}">${anim}${disc(vals)}</circle>`;
    back.push(dot(0.35, visBack));
    front.push(dot(0.9, visFront));
  }
  return { back: back.join(''), front: front.join('') };
}
