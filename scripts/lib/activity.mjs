// Activity panel: headline numbers, weekly contributions as bars, and the
// language mix as one stacked bar. Rebuilt every day from public data.

import { svgDoc, esc, f, MONO, MOTION_CSS, hashStr } from './util.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// GitHub's own language colours, so the bar reads the same as the repo pages.
const LANG = {
  Rust: '#dea584', 'C++': '#f34b7d', C: '#555555', Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6',
  Go: '#00ADD8', Java: '#b07219', Kotlin: '#A97BFF', 'C#': '#178600', HTML: '#e34c26', CSS: '#663399', Lua: '#000080',
  Shell: '#89e051', Just: '#384d54', Zig: '#ec915c', Swift: '#F05138', Dart: '#00B4AB', GLSL: '#5686a5', Assembly: '#6E4C13',
};
const FALLBACK = ['#8b949e', '#6e7681', '#a5d6ff', '#d2a8ff', '#ffa657', '#7ee787'];
const langColor = (l) => LANG[l] ?? FALLBACK[hashStr(l) % FALLBACK.length];

const ACCENT = '#8f6bff';

export function renderActivity(theme, act, { shares }) {
  const t = theme;
  const W = 1000, H = 318;
  const label = (x, y, text, anchor = 'start') =>
    `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-family="${MONO}" font-size="11.5" letter-spacing="1.2" fill="${t.muted}">${esc(text.toUpperCase())}</text>`;

  // ---- headline numbers ----
  const stats = [
    [String(act.total), act.since ? `contributions since ${MONTHS[+act.since.slice(5, 7) - 1]}` : 'contributions, last year'],
    [`${act.longest}d`, 'longest streak'],
    [String(act.activeDays), 'active days'],
    [DAYS[act.busiest].slice(0, 3), 'busiest day'],
  ];
  const colW = W / stats.length;
  const head = stats
    .map(
      ([v, l], i) =>
        `<text x="${f(i * colW)}" y="34" font-family="${MONO}" font-size="28" font-weight="700" fill="${t.ink}">${esc(v)}</text>` +
        label(i * colW, 56, l),
    )
    .join('');

  // ---- weekly bars ----
  const weeks = act.weeks;
  const n = weeks.length;
  const top = 92, base = 196;
  const max = Math.max(1, ...weeks.map((w) => w.total));
  const slot = W / n;
  const bw = Math.max(3, slot * 0.68);
  const bars = weeks
    .map((w, i) => {
      const x = i * slot + (slot - bw) / 2;
      if (!w.total) return `<rect x="${f(x)}" y="${base - 2}" width="${f(bw)}" height="2" rx="1" fill="${t.faint}"/>`;
      const hgt = Math.max(5, (w.total / max) * (base - top));
      const o = 0.45 + 0.55 * (w.total / max);
      return `<rect class="bar" style="animation-delay:${f(0.2 + i * 0.018, 3)}s" x="${f(x)}" y="${f(base - hgt)}" width="${f(bw)}" height="${f(hgt)}" rx="${f(Math.min(3, bw / 2))}" fill="${ACCENT}" fill-opacity="${f(o, 2)}"/>`;
    })
    .join('');
  const peak = weeks.reduce((b, w, i) => (w.total > weeks[b].total ? i : b), 0);
  const peakX = peak * slot + slot / 2;
  const peakNote = weeks[peak].total
    ? `<text x="${f(Math.min(W - 4, Math.max(4, peakX)))}" y="${f(base - (weeks[peak].total / max) * (base - top) - 8)}" text-anchor="${peakX > W - 60 ? 'end' : peakX < 60 ? 'start' : 'middle'}" font-family="${MONO}" font-size="11.5" fill="${t.soft}">${weeks[peak].total}</text>`
    : '';
  const months = [];
  weeks.forEach((w, i) => {
    const m = +w.start.slice(5, 7) - 1;
    const prev = i ? +weeks[i - 1].start.slice(5, 7) - 1 : -1;
    if (m !== prev && i * slot < W - 40) months.push(`<text x="${f(i * slot + 1)}" y="${base + 20}" font-family="${MONO}" font-size="11.5" fill="${t.muted}">${MONTHS[m]}</text>`);
  });

  // ---- language bar ----
  const lyTop = 266;
  const top6 = shares.filter((s) => s.share >= 0.01).slice(0, 6);
  const rest = 1 - top6.reduce((s, l) => s + l.share, 0);
  const parts = rest > 0.005 ? [...top6, { lang: 'Other', share: rest }] : top6;
  let x = 0;
  const segs = parts
    .map((p) => {
      const w = p.share * W;
      const s = `<rect x="${f(x)}" y="${lyTop}" width="${f(Math.max(0, w - 2))}" height="8" fill="${p.lang === 'Other' ? t.faint : langColor(p.lang)}"/>`;
      x += w;
      return s;
    })
    .join('');
  let lx = 0;
  const legend = parts
    .map((p) => {
      const pct = `${Math.round(p.share * 100)}%`;
      const s =
        `<circle cx="${f(lx + 5)}" cy="${lyTop + 31}" r="5" fill="${p.lang === 'Other' ? t.faint : langColor(p.lang)}"/>` +
        `<text x="${f(lx + 16)}" y="${lyTop + 35}" font-family="${MONO}" font-size="12.5" fill="${t.ink}">${esc(p.lang)}<tspan dx="6" fill="${t.muted}">${pct}</tspan></text>`;
      lx += (p.lang.length + pct.length + 1) * 7.6 + 40;
      return s;
    })
    .join('');

  const style = `
${MOTION_CSS}
.bar{transform-box:fill-box;transform-origin:50% 100%;animation:grow .8s cubic-bezier(.2,.75,.2,1) backwards}
@keyframes grow{from{transform:scaleY(0)}}`;

  const desc =
    `${act.total} contributions in the last year, longest streak ${act.longest} days, ${act.activeDays} active days, busiest on ${DAYS[act.busiest]}s. ` +
    'Languages: ' + parts.map((p) => `${p.lang} ${Math.round(p.share * 100)}%`).join(', ') + '.';

  return {
    svg: svgDoc({
      w: W,
      h: H,
      title: 'GitHub activity',
      desc,
      defs: `<clipPath id="lbar"><rect x="0" y="${lyTop}" width="${W}" height="8" rx="4"/></clipPath>`,
      style,
      body: `${head}
<line x1="0" y1="76" x2="${W}" y2="76" stroke="${t.hair}"/>
${bars}
${peakNote}
${months.join('')}
${label(0, lyTop - 14, 'languages')}
<g clip-path="url(#lbar)">${segs}</g>
${legend}`,
    }),
    alt: desc,
  };
}
