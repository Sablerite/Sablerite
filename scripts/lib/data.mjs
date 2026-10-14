// Collects public activity for the configured accounts.
// With GITHUB_TOKEN (as in Actions) it uses the API; without one it reads the
// public contribution calendar. A failed fetch falls back to the last snapshot.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const UA = { 'User-Agent': 'sablerite-profile-builder' };
const api = (path) =>
  fetch(`https://api.github.com${path}`, {
    headers: { ...UA, Accept: 'application/vnd.github+json', ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }) },
  }).then((r) => {
    if (!r.ok) throw new Error(`GET ${path}: ${r.status}`);
    return r.json();
  });

async function calendarViaGraphQL(login) {
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...UA, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login } }),
  });
  const j = await r.json();
  const weeks = j?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks) throw new Error(`GraphQL calendar for ${login}: ${JSON.stringify(j.errors || j).slice(0, 200)}`);
  return weeks.flatMap((w) => w.contributionDays.map((d) => [d.date, d.contributionCount]));
}

async function calendarViaPage(login) {
  const r = await fetch(`https://github.com/users/${login}/contributions`, { headers: UA });
  if (!r.ok) throw new Error(`calendar page for ${login}: ${r.status}`);
  const html = await r.text();
  const tips = new Map([...html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)].map((m) => [m[1], m[2]]));
  const days = [...html.matchAll(/<td[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*id="([^"]+)"/g)].map(([, date, id]) => {
    const m = (tips.get(id) || '').match(/^(\d+)/);
    return [date, m ? Number(m[1]) : 0];
  });
  if (!days.length) throw new Error(`calendar page for ${login} had no days`);
  return days;
}

async function reposFor(login, exclude) {
  const repos = await api(`/users/${login}/repos?per_page=100&type=owner&sort=pushed`);
  const out = [];
  for (const r of repos) {
    if (r.fork || r.archived || exclude.includes(r.full_name)) continue;
    let languages = {};
    try {
      languages = await api(`/repos/${r.full_name}/languages`);
    } catch {}
    out.push({
      name: r.full_name,
      created: r.created_at,
      pushed: r.pushed_at,
      stars: r.stargazers_count,
      languages,
    });
  }
  return out;
}

export async function collect(cfg, snapshotPath) {
  let previous = null;
  try {
    previous = JSON.parse(await readFile(snapshotPath, 'utf8'));
  } catch {}

  try {
    const calendar = new Map();
    const repos = [];
    for (const login of cfg.accounts) {
      let days;
      try {
        days = TOKEN ? await calendarViaGraphQL(login) : await calendarViaPage(login);
      } catch (e) {
        if (!TOKEN) throw e;
        console.warn(`  ${e.message}; trying the public page`);
        days = await calendarViaPage(login);
      }
      for (const [date, n] of days) calendar.set(date, (calendar.get(date) || 0) + n);
      repos.push(...(await reposFor(login, cfg.exclude || [])));
    }
    const data = {
      fetched: new Date().toISOString(),
      accounts: cfg.accounts,
      days: [...calendar.entries()].sort(([a], [b]) => a.localeCompare(b)),
      repos,
    };
    // Only rewrite the snapshot when something besides the timestamp changed.
    const same = (a, b) => JSON.stringify({ ...a, fetched: 0 }) === JSON.stringify({ ...b, fetched: 0 });
    if (!previous || !same(previous, data)) {
      await mkdir(dirname(snapshotPath), { recursive: true });
      await writeFile(snapshotPath, JSON.stringify(data, null, 1));
    }
    return data;
  } catch (e) {
    if (!previous) throw e;
    console.warn(`  fetch failed (${e.message}); using snapshot from ${previous.fetched}`);
    return previous;
  }
}

// ---- derived numbers ------------------------------------------------------

// Build-system and glue languages that say little about what was written.
const NOISE = new Set(['CMake', 'Makefile', 'Batchfile', 'Shell', 'PowerShell', 'Dockerfile', 'Objective-C', 'Procfile']);

// Each repository gets one equal vote, split by its language bytes, so a
// vendored library in one repo can't drown out everything else.
export function languageShares(repos) {
  const total = new Map();
  let voters = 0;
  for (const r of repos) {
    const entries = Object.entries(r.languages).filter(([l]) => !NOISE.has(l));
    const sum = entries.reduce((s, [, b]) => s + b, 0);
    if (!sum) continue;
    voters++;
    for (const [l, b] of entries) total.set(l, (total.get(l) || 0) + b / sum);
  }
  return {
    voters,
    shares: [...total.entries()].map(([lang, v]) => ({ lang, share: v / voters })).sort((a, b) => b.share - a.share),
  };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// One band per year of repositories, or per month while everything still
// falls inside a single year.
export function growthZones(repos) {
  const monthly = new Set(repos.map((r) => r.created.slice(0, 4))).size < 2;
  const zones = new Map();
  for (const r of repos) {
    const key = monthly ? r.created.slice(0, 7) : r.created.slice(0, 4);
    const z = zones.get(key) || { key, count: 0, langs: new Map() };
    z.count++;
    for (const l of Object.keys(r.languages)) if (!NOISE.has(l)) z.langs.set(l, (z.langs.get(l) || 0) + 1);
    zones.set(key, z);
  }
  return {
    unit: monthly ? 'month' : 'year',
    bands: [...zones.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((z) => {
        const [y, m] = z.key.split('-');
        return {
          key: z.key,
          short: monthly ? MONTH_NAMES[m - 1].slice(0, 3) : y,
          label: monthly ? `${MONTH_NAMES[m - 1]} ${y}` : y,
          count: z.count,
          langs: [...z.langs.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l),
        };
      }),
  };
}

export function activity(days) {
  const last = days.slice(-371);
  const weeks = [];
  // Align to calendar weeks starting Sunday.
  for (const [date, n] of last) {
    const d = new Date(date + 'T00:00:00Z');
    if (!weeks.length || d.getUTCDay() === 0) weeks.push({ start: date, total: 0 });
    weeks.at(-1).total += n;
  }
  const year = days.slice(-365);
  const total = year.reduce((s, [, n]) => s + n, 0);
  let longest = 0, run = 0;
  for (const [, n] of year) {
    run = n > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  for (const [date, n] of year) weekday[new Date(date + 'T00:00:00Z').getUTCDay()] += n;
  const busiest = weekday.indexOf(Math.max(...weekday));
  const activeDays = year.filter(([, n]) => n > 0).length;
  // A young account starts its cross-section at its first contribution
  // instead of showing months of empty ground.
  let shown = weeks.slice(-53);
  const first = shown.findIndex((w) => w.total > 0);
  const start = first > 1 ? Math.min(first - 1, shown.length - 12) : 0;
  const since = start > 0 ? shown[first].start : null;
  if (start > 0) shown = shown.slice(start);
  return { weeks: shown, since, total, longest, busiest, activeDays };
}
