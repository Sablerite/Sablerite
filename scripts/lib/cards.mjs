// Specimen trays for "In the collection": a chamfered tray, a crystal grown
// from the project's seed, and a short description.

import { svgDoc, esc, f, wrap, SERIF, MONO, mixHex, mulberry32 } from './util.mjs';
import { makeCrystal, renderStill, bestAngle } from './crystal.mjs';

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const W = 480;
const BLURB = { size: 15, lead: 21, width: 286 };

export const blurbLines = (card) => wrap(card.blurb, BLURB.width, BLURB.size, 0.47);
export const cardHeight = (cards) => 158 + Math.max(...cards.map((c) => blurbLines(c).length)) * BLURB.lead;

export function renderCard(card, theme, { height, stars = 0, year }) {
  const t = theme;
  const H = height;
  const c = 14;
  const tray = `M${c},0.5 H${W - c} L${W - 0.5},${c} V${H - c} L${W - c},${H - 0.5} H${c} L0.5,${H - c} V${c} Z`;

  // Each project grows its own habit from its seed.
  const rnd = mulberry32(card.seed);
  const habit = {
    seed: card.seed,
    sides: [4, 6, 6, 8][Math.floor(rnd() * 4)],
    prism: 1.3 + rnd() * 1.1,
    top: 0.7 + rnd() * 0.5,
    bottom: 0.45 + rnd() * 0.4,
    taper: 0.82 + rnd() * 0.14,
  };
  const crystal = makeCrystal(habit);
  const flash = [mixHex(card.tint, '#000000', 0.35), card.tint, mixHex(card.tint, '#ffffff', 0.55)];
  const scale = 30;
  // Centre the crystal's full height (cap to tip) in the tray.
  const span = habit.prism + habit.top + habit.bottom;
  const cy = H / 2 + ((habit.top - habit.bottom) / 2) * scale;
  const floor = cy + (habit.prism / 2 + habit.bottom) * scale * 0.97;
  const view = { cx: 80, cy, scale, tiltX: 0.3, tiltZ: -0.12 + rnd() * 0.3, edge: t.edge, flash, id: 'k' };
  const still = renderStill(crystal, { ...view, phi: bestAngle(crystal, view) });

  const tx = 160;
  const lines = blurbLines(card);
  // Monospace at 12px is ~7.2px a character; drop the owner if the path won't fit.
  const fits = (s) => s.length * 7.2 <= W - tx - 22;
  const name = card.repo.split('/')[1];
  const path = fits(card.repo) ? card.repo : fits(name) ? name : name.slice(0, Math.floor((W - tx - 22) / 7.2) - 1) + '…';
  const text = [
    `<text x="${tx}" y="44" font-family="${SERIF}" font-size="24" fill="${t.ink}">${esc(card.title)}</text>`,
    `<text x="${tx}" y="68" font-family="${MONO}" font-size="12" fill="${t.muted}">${esc(path)}</text>`,
    ...lines.map((l, i) => `<text x="${tx}" y="${f(100 + i * BLURB.lead)}" font-family="${SERIF}" font-size="${BLURB.size}" fill="${t.soft}">${esc(l)}</text>`),
    `<text x="${tx}" y="${H - 24}" font-family="${SERIF}" font-size="14.5" font-style="italic" fill="${t.muted}">${esc(card.stack)}</text>`,
  ];
  const meta = [year && `${year}`, stars > 0 && `★ ${stars}`].filter(Boolean).join('   ');
  if (meta) text.push(`<text x="${W - 22}" y="${H - 24}" text-anchor="end" font-family="${SERIF}" font-size="14" fill="${t.muted}">${esc(meta)}</text>`);

  const defs = `${still.defs}<radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${card.tint}" stop-opacity="${t.name === 'dark' ? 0.2 : 0.14}"/><stop offset="1" stop-color="${card.tint}" stop-opacity="0"/></radialGradient>`;
  return svgDoc({
    w: W,
    h: H,
    title: card.title,
    desc: `${card.title} (${card.repo}). ${card.blurb} Built with ${card.stack}.`,
    defs,
    body: `<path d="${tray}" fill="${t.name === 'dark' ? '#161b22' : '#f6f8fa'}" stroke="${t.faint}"/>
<circle cx="${view.cx}" cy="${f(H / 2)}" r="${f(span * scale * 0.62)}" fill="url(#g)"/>
<ellipse cx="${view.cx}" cy="${f(floor)}" rx="30" ry="4" fill="#000" fill-opacity="${t.name === 'dark' ? 0.45 : 0.14}"/>
${still.body}
${text.join('\n')}`,
  });
}
