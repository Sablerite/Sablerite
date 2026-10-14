// Local preview of the profile, rendered roughly the way GitHub does it.
//   node scripts/preview.mjs        then open http://localhost:4173
//   ?theme=dark or ?theme=light forces a theme; /gallery shows every asset.

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT || 4173);
const TYPES = { '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.json': 'application/json', '.html': 'text/html; charset=utf-8' };
const CSS = (t) => `https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown${t ? '-' + t : ''}.min.css`;

const page = (theme) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Profile preview</title><link rel="stylesheet" href="${CSS(theme)}">
<style>
:root{color-scheme:${theme || 'light dark'}}
body{margin:0;background:${theme === 'dark' ? '#0d1117' : theme === 'light' ? '#fff' : 'Canvas'}}
@media (prefers-color-scheme: dark){body{background:${theme === 'light' ? '#fff' : '#0d1117'}}}
.box{max-width:880px;margin:32px auto;border:1px solid #30363d55;border-radius:6px;padding:24px}
.markdown-body{background:transparent}
@media (max-width:600px){.box{margin:0;border:0;padding:16px}}
</style></head><body><div class="box"><article class="markdown-body" id="md"></article></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<script>
fetch('/README.md').then(r=>r.text()).then(md=>{
  const el=document.getElementById('md'); el.innerHTML=marked.parse(md);
  const theme=${JSON.stringify(theme || '')};
  if(theme) for(const p of el.querySelectorAll('picture')){
    const src=p.querySelector('source'); const img=p.querySelector('img');
    if(theme==='dark'&&src) img.src=src.srcset; src&&src.remove();
  }
});
</script></body></html>`;

const gallery = async () => {
  const files = (await readdir(join(ROOT, 'assets'))).filter((f) => f.endsWith('.svg')).sort();
  const cell = (f, bg) => `<figure style="margin:0 0 24px;background:${bg};padding:24px;border-radius:6px"><img src="/assets/${f}" style="width:100%;max-width:880px;display:block;margin:auto"><figcaption style="font:12px monospace;color:#888;margin-top:8px">${f}</figcaption></figure>`;
  return `<!doctype html><meta charset="utf-8"><title>Assets</title><body style="margin:24px;font-family:system-ui;background:#888">
${files.map((f) => cell(f, f.includes('-dark') ? '#0d1117' : '#ffffff')).join('')}</body>`;
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': TYPES['.html'] });
      return res.end(page(url.searchParams.get('theme')));
    }
    if (url.pathname === '/gallery') {
      res.writeHead(200, { 'Content-Type': TYPES['.html'] });
      return res.end(await gallery());
    }
    const file = resolve(ROOT, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) throw new Error('outside root');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log(`preview on http://localhost:${PORT}`));
