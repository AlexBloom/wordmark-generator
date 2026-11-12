import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { root, dataRoot, generate, listFonts, validate } from './core.mjs';
const exec = promisify(execFile);
const jobs = new Map();
const uuid = /^[a-f0-9-]{36}$/;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.csv': 'text/csv', '.zip': 'application/zip' };
export async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 48 * 1024 * 1024) throw new Error('Upload limit is 48 MB per request.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}
export function sameOrigin(req, port) {
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  return hosts.includes(req.headers.host) && (!req.headers.origin || hosts.map(h => `http://${h}`).includes(req.headers.origin));
}
async function file(res, filename, download = false) {
  const data = await fs.readFile(filename);
  res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store', ...(download ? { 'Content-Disposition': `attachment; filename="${path.basename(filename)}"` } : {}) }); res.end(data);
}
export async function selectedExport(id, numbers) {
  if (!uuid.test(id) || !Array.isArray(numbers) || !numbers.length || numbers.some(n => !Number.isInteger(n))) throw new Error('Select at least one generated lockup.');
  const dir = path.join(dataRoot, 'outputs', id);
  const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
  const selected = manifest.variants.filter(v => numbers.includes(v.number));
  if (selected.length !== new Set(numbers).size) throw new Error('Invalid lockup selection.');
  const cols = Math.min(4, selected.length); const rows = Math.ceil(selected.length / cols);
  const parts = await Promise.all(selected.map(async (v, i) => {
    const svg = await fs.readFile(path.join(dir, v.svg), 'utf8');
    return `<g transform="translate(${(i % cols) * 900},${Math.floor(i / cols) * 600})">${svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>`;
  }));
  const filename = `selection-${randomUUID()}.svg`;
  await fs.writeFile(path.join(dir, filename), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * 900} ${rows * 600}">${parts.join('')}</svg>`);
  return { filename, path: path.join(dir, filename), url: `/outputs/${id}/${filename}` };
}
export async function serve(port = 9000) {
  await fs.mkdir(path.join(dataRoot, 'outputs'), { recursive: true });
  const server = http.createServer(async (req, res) => {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    try {
      if (!sameOrigin(req, port)) return json(403, { error: 'Local requests only. Open the app on localhost.' });
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      const url = new URL(req.url, `http://127.0.0.1:${port}`); const p = url.pathname;
      if (req.method === 'GET' && p === '/api/health') return json(200, { ok: true, platform: process.platform, version: '1.0.0' });
      if (req.method === 'POST' && p === '/api/fonts') return json(200, { fonts: await listFonts(await body(req)) });
      if (req.method === 'POST' && p === '/api/upload') {
        const { files } = await body(req);
        if (!Array.isArray(files) || !files.length || files.length > 100) throw new Error('Drop 1–100 font files per upload.');
        const dir = path.join(dataRoot, 'uploads', randomUUID()); await fs.mkdir(dir, { recursive: true }); const paths = [];
        for (const f of files) {
          if (typeof f.name !== 'string' || !/\.(ttf|otf|ttc|otc|dfont)$/i.test(f.name) || typeof f.data !== 'string' || !/^[A-Za-z0-9+/=]*$/.test(f.data)) throw new Error('Use TTF, OTF, TTC, OTC, or DFONT files.');
          const dest = path.join(dir, `${randomUUID()}-${path.basename(f.name).replace(/[^\w.-]/g, '_')}`); await fs.writeFile(dest, Buffer.from(f.data, 'base64')); paths.push(dest);
        }
        return json(200, { fontFiles: paths, count: paths.length });
      }
      if (req.method === 'POST' && p === '/api/generate') {
        const request = validate(await body(req));
        if ([...jobs.values()].some(j => j.status === 'running')) return json(409, { error: 'A generation is already running. Please wait for it to finish.' });
        const id = randomUUID(); jobs.set(id, { id, status: 'running', count: request.count });
        generate(request, path.join(dataRoot, 'outputs', id)).then(result => jobs.set(id, { id, status: 'complete', ...result, baseUrl: `/outputs/${id}/`, previewUrl: `/outputs/${id}/preview.html`, archiveUrl: `/outputs/${id}.zip` })).catch(e => jobs.set(id, { id, status: 'failed', error: e.message }));
        return json(202, { id, status: 'running', statusUrl: `/api/jobs/${id}` });
      }
      if (req.method === 'GET' && p.startsWith('/api/jobs/')) { const id = p.split('/').pop(); const job = jobs.get(id); return json(job ? 200 : 404, job || { error: 'Job not found in this app session.' }); }
      if (req.method === 'POST' && (p === '/api/export' || p === '/api/illustrator')) {
        const { id, numbers } = await body(req); const result = await selectedExport(id, numbers);
        if (p === '/api/illustrator') { try { await exec('open', ['-a', 'Adobe Illustrator', result.path]); } catch { return json(409, { error: 'Illustrator could not be opened. Download the SVG and open it in your installed version of Illustrator.', url: result.url }); } }
        return json(200, result);
      }
      if (req.method === 'GET' && p.startsWith('/outputs/')) {
        const bits = p.slice(9).split('/');
        if (bits.length === 1 && /^[a-f0-9-]{36}\.zip$/.test(bits[0])) return await file(res, path.join(dataRoot, 'outputs', bits[0]), true);
        if (bits.length !== 2 || !uuid.test(bits[0]) || !/^[A-Za-z0-9_.-]+$/.test(bits[1]) || bits[1].startsWith('.')) return json(404, { error: 'File not found.' });
        return await file(res, path.join(dataRoot, 'outputs', ...bits), url.searchParams.has('download'));
      }
      if (req.method === 'GET' && ['/', '/app.js', '/style.css'].includes(p)) return await file(res, path.join(root, 'web', p === '/' ? 'index.html' : p.slice(1)));
      return json(404, { error: 'Not found.' });
    } catch (e) { if (!res.headersSent) json(e.code === 'ENOENT' ? 404 : 400, { error: e.message }); else res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  console.error(`Wordmark Generator → http://127.0.0.1:${port}`);
  return server;
}
