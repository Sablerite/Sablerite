// A geological cross-section of the last year: the ground surface follows
// weekly contributions, older sediment flattens out below it, and the
// busiest weeks have grown crystals.

import { svgDoc, esc, f, SERIF } from './util.mjs';
import { makeCrystal, renderStill, bestAngle } from './crystal.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Catmull-Rom through the points, written as cubic Béziers.
function smoothPath(ps) {
  let d = `M${f(ps[0][0])},${f(ps[0][1])}`;
  for (let i = 0; i < ps.length - 1; i++) {
    const p0 = ps[i - 1] || ps[i], p1 = ps[i], p2 = ps[i + 1], p3 = ps[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}
const reversePts = (ps) => [...ps].reverse();

export function renderStrata(theme, act, accounts) {
  const t = theme;
  const W = 1000, H = 366;
  const base = 216, peak = 116, floor = 300, depth = 4;
  const weeks = act.weeks;
  const n = weeks.length;
  const xOf = (i) => (i / (n - 1)) * W;

  const max = Math.max(1, ...weeks.map((w) => w.total));
  const raw = weeks.map((w) => Math.sqrt(w.total / max));
  const h = raw.map((v, i) => (0.2 * (raw[i - 1] ?? v) + 0.6 * v + 0.2 * (raw[i + 1] ?? v)) * peak);

  // Boundary k: the surface at k = 0, flattening with depth.
  const boundary = (k) => weeks.map((_, i) => [xOf(i), base + k * 21 - h[i] * Math.pow(1 - k / (depth + 1.5), 1.6)]);
  const layers = [];
  for (let k = 0; k <= depth; k++) {
    const upper = boundary(k);
    const lower = k < depth ? boundary(k + 1) : weeks.map((_, i) => [xOf(i), floor]);
    const d = smoothPath(upper) + ' L' + smoothPath(reversePts(lower)).slice(1) + ' Z';
    layers.push(`<path d="${d}" fill="${t.strata[k]}"/>`);
    // Fine lamination inside each layer.
    const mid = upper.map((p, i) => [p[0], (p[1] + lower[i][1]) / 2]);
    layers.push(`<path d="${smoothPath(mid)}" stroke="${t.name === 'dark' ? '#ffffff' : '#000000'}" stroke-opacity="0.07" stroke-width="1" stroke-dasharray="${k % 2 ? '2 5' : '9 6'}"/>`);
  }
  const surface = boundary(0);
  layers.push(`<path d="${smoothPath(surface)}" stroke="${t.ink}" stroke-opacity="0.75" stroke-width="1.4"/>`);

  // Crystals at the three busiest weeks, tallest at the busiest.
  const ranked = weeks
    .map((w, i) => ({ ...w, i }))
    .filter((w) => w.total > 0 && w.i >= 2 && w.i <= n - 3)
    .sort((a, b) => b.total - a.total);
  const chosen = [];
  for (const w of ranked) {
    if (chosen.length === 3) break;
    // Far enough apart that their labels never touch.
    if (chosen.every((c) => Math.abs(xOf(c.i) - xOf(w.i)) > 210)) chosen.push(w);
  }
  const crystals = [], notes = [], defs = [];
  chosen.forEach((w, rank) => {
    const x = xOf(w.i);
    const sy = surface[w.i][1];
    const scale = 17 - rank * 2.5;
    const habit = { seed: 900 + w.i, sides: 6, prism: 1.8, top: 0.85, bottom: 0.5, taper: 0.9 };
    const c = makeCrystal(habit);
    // Partly buried: the ground is drawn over the lower half.
    const cy = sy - habit.prism * 0.25 * scale;
    const view = { cx: x, cy, scale, tiltX: 0.25, tiltZ: (rank - 1) * 0.18, edge: t.edge, id: `p${rank}` };
    const still = renderStill(c, { ...view, phi: bestAngle(c, view), striations: false });
    defs.push(still.defs);
    crystals.push(still.body);
    const d = new Date(w.start + 'T00:00:00Z');
    const top = cy - (habit.prism / 2 + habit.top) * scale - 12;
    const label = `in the week of ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
    const half = ((String(w.total).length + label.length + 1) * 14 * 0.46) / 2;
    const lx = Math.min(W - half, Math.max(half, x));
    notes.push(
      `<text x="${f(lx)}" y="${f(top)}" text-anchor="middle" font-family="${SERIF}" font-size="14" fill="${t.ink}">${w.total}<tspan dx="4" font-style="italic" fill="${t.muted}">${label}</tspan></text>`,
    );
  });

  // Month ticks along the bottom; the year is written at January.
  const months = [];
  weeks.forEach((w, i) => {
    const d = new Date(w.start + 'T00:00:00Z');
    const prev = i ? new Date(weeks[i - 1].start + 'T00:00:00Z') : null;
    if (prev && d.getUTCMonth() !== prev.getUTCMonth()) {
      const x = xOf(i);
      const label = d.getUTCMonth() === 0 ? `${MONTHS[0]} ${d.getUTCFullYear()}` : MONTHS[d.getUTCMonth()];
      months.push(
        `<line x1="${f(x)}" y1="${floor + 2}" x2="${f(x)}" y2="${floor + 8}" stroke="${t.muted}" stroke-width="1"/>` +
          (x < W - 30 ? `<text x="${f(x + 4)}" y="${floor + 22}" font-family="${SERIF}" font-size="13" font-style="italic" fill="${t.muted}">${label}</text>` : ''),
      );
    }
  });

  const who = accounts.map((a) => '@' + a);
  const across = who.length > 1 ? ` across ${who.slice(0, -1).join(', ')} and ${who.at(-1)}` : '';
  const since = act.since ? new Date(act.since + 'T00:00:00Z') : null;
  const span = since ? `since ${MONTHS[since.getUTCMonth()]} ${since.getUTCFullYear()}` : 'in the last year';
  const stats = `${act.total} contributions ${span}${across}. Longest streak ${act.longest} ${act.longest === 1 ? 'day' : 'days'}; busiest on ${DAYS[act.busiest]}s.`;

  return svgDoc({
    w: W,
    h: H,
    title: 'Activity cross-section',
    desc: stats + ' ' + chosen.map((w) => `${w.total} contributions in the week of ${w.start}`).join('; ') + '.',
    defs: defs.join(''),
    body: `<text x="0" y="22" font-family="${SERIF}" font-size="17" fill="${t.ink}">${esc(stats)}</text>
${crystals.join('\n')}
${layers.join('\n')}
${notes.join('\n')}
${months.join('\n')}
<text x="0" y="${H - 6}" font-family="${SERIF}" font-size="14" font-style="italic" fill="${t.muted}">Fig. 4. Cross-section of the last ${n} weeks. The ground rises with each week’s contributions.</text>`,
  });
}
