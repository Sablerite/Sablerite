// The header: the rotating crystal on the left, and a terminal on the right
// that types itself out with who I am, what I'm building and my latest commits.

import { svgDoc, esc, f, MONO, MOTION_CSS, FLASH } from './util.mjs';
import { makeCrystal, renderAnimated, renderStill, renderOrbit, bestAngle } from './crystal.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const clip = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);
const repoName = (full) => full.split('/').pop();

// Terminal colours. The window is always dark, like the crystal.
const TERM = {
  dark: { bg: '#0b0f15', bar: '#161b22', border: '#30363d', title: '#7d8590' },
  light: { bg: '#0f141b', bar: '#1b2129', border: '#d0d7de', title: '#8b949e' },
};
const C = { text: '#e6edf3', dim: '#7d8590', prompt: FLASH[1], accent: '#a48bff', num: '#e7b54a', path: FLASH[2] };

const FS = 13.5; // font size
const CW = 8.1; // character cell width; every run is forced to it with textLength
const LEAD = 21;
const GAP = 9;

export function renderHero(cfg, theme, { repos = [], commits = [], act }) {
  const W = 1000, H = 430;
  const t = theme;
  const tc = TERM[t.name];

  // ---- crystal (unchanged from the original plate) ----
  const crystal = makeCrystal(cfg.crystal);
  const cx = 205, cy = 205, scale = 88;
  const view = { cx, cy, scale, tiltX: 0.27, tiltZ: 0.15, edge: t.edge, flash: FLASH };
  const anim = renderAnimated(crystal, { ...view, frames: 72, dur: 40, id: 'h' });
  const still = renderStill(crystal, { ...view, phi: bestAngle(crystal, view), id: 'hs' });
  const orbit = renderOrbit({ cx, cy, radius: scale * 1.7, colors: ['#9fe7df', '#a9c5ff', '#f0d48a', '#c5b5ff'], seed: 11 });

  // ---- terminal content ----
  const term = cfg.terminal;
  const tx = 400, tw = 580;
  const cols = Math.floor((tw - 44) / CW);
  const rows = []; // { kind: 'cmd' | 'out' | 'gap', segs, cmd }
  const cmd = (text) => rows.push({ kind: 'cmd', cmd: text });
  const out = (...segs) => rows.push({ kind: 'out', segs });
  const gap = () => rows.push({ kind: 'gap' });

  cmd('whoami');
  out([term.name, C.text, { bold: true }], [` — ${term.role}`, C.text]);
  out([term.about, C.dim]);
  gap();

  cmd('cat ~/status');
  const latest = [...repos].sort((a, b) => b.pushed.localeCompare(a.pushed))[0];
  if (latest) out(['building', C.dim], [clip(repoName(latest.name), cols - 20), C.accent, { at: 10 }], [` · ${shortDate(latest.pushed)}`, C.dim]);
  out(['stack', C.dim], [clip(term.stack, cols - 10), C.text, { at: 10 }]);
  if (act) {
    const streak = act.longest ? ` · ${act.longest}-day best streak` : '';
    out(['activity', C.dim], [String(act.total), C.num, { at: 10 }], [` contributions this year${streak}`, C.text]);
  }
  gap();

  const log = commits.slice(0, term.commits ?? 3);
  if (log.length) {
    cmd(`git log --oneline -${log.length}`);
    for (const c of log) {
      const repo = clip(repoName(c.repo), 16);
      const date = shortDate(c.date);
      const room = cols - (7 + 1 + repo.length + 1) - (date.length + 2);
      out([c.sha, C.num], [` ${repo}`, C.accent], [` ${clip(c.message, room)}`, C.text], [date, C.dim, { at: cols - date.length }]);
    }
    gap();
  }
  cmd('');

  // ---- layout ----
  const bar = 32, padTop = 28, padBottom = 18;
  const th = bar + padTop + rows.reduce((s, r) => s + (r.kind === 'gap' ? GAP : LEAD), 0) - LEAD + padBottom + 6;
  const ty = Math.round((H - th) / 2);
  const x0 = tx + 22;
  let y = ty + bar + padTop;
  for (const r of rows) {
    r.y = y;
    y += r.kind === 'gap' ? GAP : LEAD;
  }

  // One <text> per run, pinned to its column so everything lines up whatever
  // monospace font the viewer has.
  const run = (text, col, yy, color, bold) => {
    const lead = text.length - text.trimStart().length;
    const body = text.trim();
    if (!body) return '';
    const x = x0 + (col + lead) * CW;
    return `<text x="${f(x)}" y="${yy}" textLength="${f(body.length * CW)}" lengthAdjust="spacing" font-family="${MONO}" font-size="${FS}"${bold ? ' font-weight="700"' : ''} fill="${color}">${esc(body)}</text>`;
  };
  const PROMPT = '~ $';
  const promptRun = (yy) => run(PROMPT, 0, yy, C.prompt, true);
  const cmdCol = PROMPT.length + 1;
  const outRuns = (r) => {
    let col = 0;
    return r.segs
      .map(([text, color, o = {}]) => {
        if (o.at != null) col = o.at;
        const s = run(text, col, r.y, color, o.bold);
        col += text.length;
        return s;
      })
      .join('');
  };

  // ---- animated version ----
  const TYPE = 0.055, AFTER_TYPE = 0.3, OUT_STEP = 0.07, AFTER_OUT = 0.35;
  let time = 0.7;
  const cursorKeys = []; // [time, x, y]
  const anim2 = [];
  const show = (inner, at) => `<g opacity="0"><set attributeName="opacity" to="1" begin="${f(at, 2)}s" fill="freeze"/>${inner}</g>`;
  const cursorY = (r) => r.y - FS + 2;
  rows.forEach((r, i) => {
    if (r.kind === 'gap') return;
    if (r.kind === 'cmd') {
      anim2.push(show(promptRun(r.y), time));
      cursorKeys.push([time, x0 + cmdCol * CW, cursorY(r)]);
      if (r.cmd) {
        const n = r.cmd.length;
        const start = time + 0.25;
        const id = `type${i}`;
        const widths = [0];
        const keys = [0];
        for (let k = 1; k <= n; k++) {
          widths.push(f(k * CW));
          keys.push(f(k / (n + 1), 3));
          cursorKeys.push([start + k * TYPE, x0 + (cmdCol + k) * CW, cursorY(r)]);
        }
        anim2.push(
          `<clipPath id="${id}"><rect x="${f(x0 + cmdCol * CW - 1)}" y="${f(r.y - FS - 2)}" height="${FS + 8}" width="0"><animate attributeName="width" begin="${f(start, 2)}s" dur="${f((n + 1) * TYPE, 3)}s" fill="freeze" calcMode="discrete" keyTimes="${keys.join(';')}" values="${widths.join(';')}"/></rect></clipPath>` +
            `<g clip-path="url(#${id})">${run(r.cmd, cmdCol, r.y, C.text)}</g>`,
        );
        time = start + n * TYPE + AFTER_TYPE;
      }
    } else {
      anim2.push(show(outRuns(r), time));
      time += OUT_STEP;
      const next = rows.slice(i + 1).find((x) => x.kind !== 'gap');
      if (!next || next.kind === 'cmd') time += AFTER_OUT;
    }
  });
  const end = time;
  const kt = cursorKeys.map(([s]) => f(s / end, 4));
  kt[0] = '0';
  const cursorAnim =
    `<rect x="${f(cursorKeys[0][1])}" y="${f(cursorKeys[0][2])}" width="${f(CW)}" height="${FS + 3}" fill="${C.text}" opacity="0">` +
    `<set attributeName="opacity" to="0.85" begin="${f(cursorKeys[0][0], 2)}s" fill="freeze"/>` +
    `<animate attributeName="x" dur="${f(end, 2)}s" fill="freeze" calcMode="discrete" keyTimes="${kt.join(';')}" values="${cursorKeys.map((k) => f(k[1])).join(';')}"/>` +
    `<animate attributeName="y" dur="${f(end, 2)}s" fill="freeze" calcMode="discrete" keyTimes="${kt.join(';')}" values="${cursorKeys.map((k) => f(k[2])).join(';')}"/>` +
    `</rect>`;

  // ---- still version (reduced motion) ----
  const stillText = rows
    .map((r) => (r.kind === 'gap' ? '' : r.kind === 'cmd' ? promptRun(r.y) + run(r.cmd, cmdCol, r.y, C.text) : outRuns(r)))
    .join('');
  const last = rows.at(-1);
  const stillCursor = `<rect x="${f(x0 + cmdCol * CW)}" y="${f(cursorY(last))}" width="${f(CW)}" height="${FS + 3}" fill="${C.text}" opacity="0.85"/>`;

  const window = `
<g filter="url(#lift)">
  <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="10" fill="${tc.bg}" stroke="${tc.border}"/>
</g>
<g clip-path="url(#win)">
  <rect x="${tx}" y="${ty}" width="${tw}" height="${bar}" fill="${tc.bar}"/>
  <line x1="${tx}" y1="${ty + bar}" x2="${tx + tw}" y2="${ty + bar}" stroke="${tc.border}"/>
</g>
<rect x="${tx + 0.5}" y="${ty + 0.5}" width="${tw - 1}" height="${th - 1}" rx="9.5" stroke="${tc.border}"/>
<circle cx="${tx + 18}" cy="${ty + bar / 2}" r="5.5" fill="#ff5f57" opacity="0.85"/>
<circle cx="${tx + 36}" cy="${ty + bar / 2}" r="5.5" fill="#febc2e" opacity="0.85"/>
<circle cx="${tx + 54}" cy="${ty + bar / 2}" r="5.5" fill="#28c840" opacity="0.85"/>
<text x="${tx + tw / 2}" y="${ty + bar / 2 + 4}" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${tc.title}">${esc(term.host)}: ~</text>`;

  const defs = `
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${t.glow}" stop-opacity="${t.name === 'dark' ? 0.28 : 0.16}"/><stop offset="0.55" stop-color="${t.glow}" stop-opacity="${t.name === 'dark' ? 0.08 : 0.05}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="shadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity="${t.shadow}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<clipPath id="win"><rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="10"/></clipPath>
<filter id="lift" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="${t.name === 'dark' ? 0.45 : 0.18}"/></filter>
${anim.defs}
${still.defs}`;

  const style = `
${MOTION_CSS}
.bob{animation:bob 8s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-7px)}}
.shade{transform-box:fill-box;transform-origin:center;animation:breathe 8s ease-in-out infinite}
@keyframes breathe{50%{transform:scaleX(.9);opacity:.75}}
.blink{animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}`;

  const body = `
<circle cx="${cx}" cy="${cy}" r="210" fill="url(#glow)"/>
<ellipse class="shade" cx="${cx}" cy="${cy + 192}" rx="100" ry="11" fill="url(#shadow)"/>
<g class="motion"><g class="bob">${orbit.back}${anim.body}${orbit.front}</g></g>
<g class="still">${still.body}</g>
${window}
<g class="motion">${anim2.join('\n')}<g class="blink">${cursorAnim}</g></g>
<g class="still">${stillText}${stillCursor}</g>`;

  const plain = rows
    .filter((r) => r.kind !== 'gap')
    .map((r) => (r.kind === 'cmd' ? `$ ${r.cmd}` : r.segs.map((s) => s[0].replace(/^ — /, ', ').trim()).join(' ').replace(/ ,/g, ',')))
    .filter((s) => s !== '$ ')
    .join('\n');

  return {
    svg: svgDoc({ w: W, h: H, title: `${term.name}, ${term.role}`, desc: plain, defs, style, body }),
    alt: plain.replace(/\n/g, ' · '),
  };
}
