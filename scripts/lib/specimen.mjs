// The specimen label: field notes on the left, and on the right a cross-section
// through the crystal showing one growth band per year (or month) of repositories.

import { svgDoc, esc, f, wrap, formulaTspans, SERIF, hexToRgb, rgbToHex, mixHex, ramp, mulberry32, FLASH } from './util.mjs';

const hexagon = (cx, cy, r, rot = 0) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = rot + (i * Math.PI) / 3;
    return `${f(cx + Math.cos(a) * r)},${f(cy + Math.sin(a) * r)}`;
  }).join(' ');

// WCAG relative luminance, used to pick legible text on each band.
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const textOn = (hex) => {
  const l = luminance(hex);
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? '#0f141b' : '#eef2f6';
};

export function renderSpecimen(cfg, theme, zoning) {
  const zones = zoning.bands;
  const t = theme;
  const W = 1000;
  const fs = 17.5, lead = 25.5, labelW = 168, valueW = 390;
  const rows = [];
  let y = 34;

  for (const field of cfg.specimen.fields) {
    rows.push(`<text x="0" y="${f(y)}" font-family="${SERIF}" font-size="16" font-style="italic" fill="${t.muted}">${esc(field.label)}</text>`);
    if (field.formula) {
      rows.push(`<text x="${labelW}" y="${f(y)}" font-family="${SERIF}" font-size="19" fill="${t.ink}">${formulaTspans(field.formula, 19)}</text>`);
      y += lead;
      if (field.note) {
        rows.push(`<text x="${labelW}" y="${f(y - 2)}" font-family="${SERIF}" font-size="14.5" font-style="italic" fill="${t.muted}">${esc(field.note)}</text>`);
        y += lead - 6;
      }
    } else {
      const lines = wrap(field.value, valueW, fs, 0.46);
      lines.forEach((line, i) =>
        rows.push(`<text x="${labelW}" y="${f(y + i * lead)}" font-family="${SERIF}" font-size="${fs}" fill="${field.emphasis ? t.ink : t.soft}"${field.emphasis ? ' font-style="italic"' : ''}>${esc(line)}</text>`),
      );
      y += lines.length * lead;
    }
    y += 13;
  }
  const leftH = y;

  // ---- growth zoning -------------------------------------------------------
  const cx = 805, cy = 175, R = 148, rot = Math.PI / 6 + 0.12;
  const total = zones.reduce((s, z) => s + z.count, 0) || 1;
  let cum = 0;
  // A sable core, then each later band grows out in labradorite colours.
  const zoneColor = (i) => {
    if (i === 0) return t.name === 'dark' ? '#1a1f29' : '#161b24';
    const tt = zones.length > 2 ? (i - 1) / (zones.length - 2) : 0.5;
    const tint = rgbToHex(ramp(FLASH.slice(1), 0.1 + 0.8 * tt));
    return t.name === 'dark' ? mixHex(tint, '#0d1117', 0.58) : mixHex(tint, '#4a515c', 0.5);
  };
  const bands = zones.map((z, i) => {
    cum += z.count;
    // Hexagon area grows with r², so band area is proportional to repo count.
    return { ...z, r: R * Math.sqrt(cum / total), color: zoneColor(i) };
  });
  const rnd = mulberry32(42);
  const zoneSvg = [];
  for (let i = bands.length - 1; i >= 0; i--) {
    const b = bands[i];
    zoneSvg.push(`<polygon points="${hexagon(cx, cy, b.r, rot)}" fill="${b.color}" stroke="${t.name === 'dark' ? '#8fb3d9' : '#ffffff'}" stroke-opacity="${t.name === 'dark' ? 0.3 : 0.6}" stroke-width="1"/>`);
  }
  // Fine growth lamellae inside each band.
  bands.forEach((b, i) => {
    const inner = i ? bands[i - 1].r : 0;
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const r = inner + (b.r - inner) * (0.2 + 0.7 * rnd());
      if (r < 6) continue;
      zoneSvg.push(`<polygon points="${hexagon(cx, cy, r, rot)}" stroke="#ffffff" stroke-opacity="${f(0.05 + rnd() * 0.07, 2)}" stroke-width="0.8"/>`);
    }
  });
  // Band labels sit inside their band, stepped along one radius.
  bands.forEach((b, i) => {
    const inner = i ? bands[i - 1].r : 0;
    const mid = i ? (inner + b.r) / 2 : 0;
    const a = -Math.PI / 2 + 0.55;
    const x = cx + Math.cos(a) * mid, yy = cy + Math.sin(a) * mid + 5;
    const fill = textOn(b.color);
    zoneSvg.push(`<text x="${f(x)}" y="${f(yy)}" text-anchor="middle" font-family="${SERIF}" font-size="14" font-style="italic" fill="${fill}" fill-opacity="0.92">${esc(b.short)}</text>`);
  });

  // Legend, newest band first.
  let ly = cy + R + 54;
  const legend = [];
  legend.push(`<text x="${cx}" y="${f(cy + R + 26)}" text-anchor="middle" font-family="${SERIF}" font-size="14" font-style="italic" fill="${t.muted}">Fig. 2. Growth zoning, one band per ${zoning.unit}.</text>`);
  const lx = cx - 150;
  for (const b of [...bands].reverse()) {
    const note = cfg.specimen.zoneNotes?.[b.key] || b.langs.slice(0, 4).join(', ');
    legend.push(`<polygon points="${hexagon(lx + 7, ly - 5, 7, rot)}" fill="${b.color}" stroke="${t.muted}" stroke-opacity="0.5" stroke-width="0.8"/>`);
    legend.push(
      `<text x="${lx + 24}" y="${ly}" font-family="${SERIF}" font-size="16" fill="${t.ink}"><tspan font-weight="700">${esc(b.label)}</tspan><tspan dx="10" font-style="italic" fill="${t.muted}">${b.count} ${b.count === 1 ? 'repository' : 'repositories'}</tspan></text>`,
    );
    legend.push(`<text x="${lx + 24}" y="${ly + 21}" font-family="${SERIF}" font-size="15" fill="${t.soft}">${esc(note)}</text>`);
    ly += 52;
  }
  const H = Math.ceil(Math.max(leftH, ly - 20) + 10);

  return svgDoc({
    w: W,
    h: H,
    title: 'Specimen data',
    desc:
      cfg.specimen.fields.map((x) => `${x.label}: ${x.formula ? x.formula.replace(/_/g, '') : x.value}`).join(' ') +
      ' Growth zoning: ' +
      bands.map((b) => `${b.label}, ${b.count} repositories`).join('; ') +
      '.',
    body: `<line x1="${labelW - 18}" y1="16" x2="${labelW - 18}" y2="${leftH - 14}" stroke="${t.faint}" stroke-width="1"/>\n${rows.join('\n')}\n${zoneSvg.join('\n')}\n${legend.join('\n')}`,
  });
}
