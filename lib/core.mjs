import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
const exec = promisify(execFile);
export const root = fileURLToPath(new URL('../', import.meta.url));
export const dataRoot = path.resolve(process.env.WORDMARK_DATA_DIR || path.join(root, '.wordmark'));
const engine = path.join(root, '.cache', 'renderer');
let building;
export function validate(input = {}) {
  if (!Array.isArray(input.names) || !input.names.length || input.names.length > 8 || input.names.some(n => typeof n !== 'string' || !n.trim() || n.length > 100 || /[\x00-\x1f]/.test(n))) throw new Error('Enter 1–8 nonempty brand names, up to 100 characters each.');
  const count = Number(input.count ?? 50);
  if (![10, 50, 100, 250].includes(count)) throw new Error('Count must be 10, 50, 100, or 250.');
  if (input.seed !== undefined && (!Number.isSafeInteger(input.seed) || Math.abs(input.seed) > 2147483647)) throw new Error('Seed must be a 32-bit integer.');
  for (const key of ['fonts', 'fontFiles', 'excludeFamilies']) if (input[key] !== undefined && (!Array.isArray(input[key]) || input[key].some(s => typeof s !== 'string'))) throw new Error(`${key} must be an array of strings.`);
  if (input.fontDirectory !== undefined && (typeof input.fontDirectory !== 'string' || !input.fontDirectory.trim())) throw new Error('Font directory must be a path.');
  return { names: input.names.map(n => n.trim()), count, combine: Boolean(input.combine), seed: input.seed ?? 9000, ...(input.fontDirectory ? { fontDirectory: path.resolve(input.fontDirectory) } : {}), ...(input.fontFiles ? { fontFiles: input.fontFiles.map(p => path.resolve(p)) } : {}), ...(input.fonts ? { fonts: input.fonts } : {}), ...(input.excludeFamilies ? { excludeFamilies: input.excludeFamilies } : {}) };
}
export async function build() {
  if (process.platform !== 'darwin') throw new Error('Rendering requires macOS, Swift, and Apple CoreText. The API and skill run on the same Mac.');
  if (building) return building;
  building = (async () => {
    await fs.mkdir(path.dirname(engine), { recursive: true });
    const source = path.join(root, 'engine/Renderer.swift');
    const compiled = await fs.stat(engine).catch(() => null);
    if (!compiled || compiled.mtimeMs < (await fs.stat(source)).mtimeMs) {
      await exec('swiftc', ['-O', '-module-cache-path', path.join(root, '.cache/modules'), source, '-o', engine], { maxBuffer: 10 * 1024 * 1024 });
    }
    return engine;
  })();
  try { return await building; } finally { building = null; }
}
export async function renderRequest(input) {
  await fs.mkdir(dataRoot, { recursive: true });
  const file = path.join(dataRoot, `${randomUUID()}.json`);
  await fs.writeFile(file, JSON.stringify(input));
  try {
    const { stdout } = await exec(await build(), [file], { maxBuffer: 32 * 1024 * 1024, timeout: 300_000 });
    return JSON.parse(stdout);
  } catch (e) { throw new Error(e.stderr?.trim() || e.message); }
  finally { await fs.rm(file, { force: true }); }
}
export async function listFonts(input = {}) {
  const req = validate({ names: input.names?.length ? input.names : ['Brand'], ...input, count: 10 });
  return renderRequest({ ...req, action: 'fonts' });
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export async function generate(input, output) {
  const req = validate(input);
  const dir = path.resolve(output || path.join(dataRoot, 'outputs', randomUUID()));
  await fs.mkdir(path.dirname(dir), { recursive: true });
  await fs.mkdir(dir); // Never replace a previous generation.
  try {
    const manifest = await renderRequest({ ...req, output: dir });
    const cards = manifest.variants.map(v => `<article data-search="${esc(`${v.number} ${v.family} ${v.treatment}`.toLowerCase())}"><header>${v.number} · ${esc(v.family)}</header><a href="${v.svg}"><img loading="lazy" src="${v.svg}" alt="${esc(v.names.join(' / '))}"></a><footer><a download href="${v.svg}">SVG</a> <a download href="${v.png}">PNG</a> · ${esc(v.treatment)}</footer></article>`).join('');
    await fs.writeFile(path.join(dir, 'preview.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(req.names.join(' / '))} — Wordmark Generator</title><style>body{margin:0;font:15px system-ui;background:#eee;color:#111}nav{padding:24px;background:white;position:sticky;top:0;border-bottom:1px solid}h1{margin:0 0 10px}input{padding:10px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1px;background:#bbb}article{background:white}article[hidden]{display:none}img{width:100%}header,footer{padding:15px}a{color:inherit}</style><nav><h1>${esc(req.names.join(' / '))}</h1><p>${req.count} lockups · ${manifest.uniqueFamilies} font families · Users are responsible for their own font licensing.</p><input aria-label="Search" placeholder="Find a font or number" oninput="document.querySelectorAll('article').forEach(a=>a.hidden=!a.dataset.search.includes(this.value.toLowerCase()))"></nav><main>${cards}</main></html>`);
    await fs.writeFile(path.join(dir, 'font-index.csv'), 'number,names,family,font,treatment\n' + manifest.variants.map(v => [v.number, v.names.join(' / '), v.family, v.font, v.treatment].map(x => `"${String(x).replaceAll('"', '""')}"`).join(',')).join('\n'));
    await fs.writeFile(path.join(dir, 'FONT-LICENSING.txt'), 'Users are responsible for their own font licensing. Font files are not bundled with exports. Outlining a font does not change its license requirements.\n');
    await exec('ditto', ['-c', '-k', '--keepParent', dir, `${dir}.zip`]);
    return { ...manifest, output: dir, preview: path.join(dir, 'preview.html'), archive: `${dir}.zip` };
  } catch (e) { await fs.writeFile(path.join(dir, 'error.txt'), e.message); throw e; }
}
