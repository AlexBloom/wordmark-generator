import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generate, listFonts, validate, root } from '../lib/core.mjs';
import { sameOrigin, serve } from '../lib/server.mjs';
const exec = promisify(execFile);
test('request validation and name combination preserve user input', () => {
  assert.deepEqual(validate({ names: [' Acme & Co ', 'Studio'], combine: true, count: 10 }).names, ['Acme & Co', 'Studio']);
  for (const input of [{ names: [] }, { names: [' '] }, { names: ['A'], count: 11 }, { names: ['A'], seed: 1.5 }, { names: ['A'], fontFiles: [42] }]) assert.throws(() => validate(input));
});
test('local server rejects foreign origins and host-header requests', () => {
  assert.equal(sameOrigin({ headers: { host: '127.0.0.1:9000', origin: 'http://127.0.0.1:9000' } }, 9000), true);
  assert.equal(sameOrigin({ headers: { host: '127.0.0.1:9000', origin: 'https://evil.example' } }, 9000), false);
  assert.equal(sameOrigin({ headers: { host: 'evil.example:9000' } }, 9000), false);
});
test('all supported scales produce real outlined SVG, PNG, boards and ZIP without overwriting', { skip: process.platform !== 'darwin', timeout: 180000 }, async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'wordmark-test-'));
  try {
    const fonts = await listFonts({ names: ['Acme', 'Studio'] }); assert.ok(fonts.length > 0);
    for (const count of [10, 50, 100, 250]) {
      const result = await generate({ names: ['Acme', 'Studio'], combine: true, count, seed: 42, fonts: [fonts[0].id] }, path.join(temp, String(count)));
      assert.equal(result.variants.length, count); assert.equal(result.uniqueFamilies, 1); assert.equal(result.boards.length, Math.ceil(count / 20));
      assert.deepEqual(result.variants[0].names, ['Acme', 'Studio']);
      for (const v of [result.variants[0], result.variants.at(-1)]) {
        const svg = await fs.readFile(path.join(result.output, v.svg), 'utf8'); assert.match(svg, /<path/); assert.doesNotMatch(svg, /<text/); assert.doesNotMatch(svg, /NaN|Infinity/);
        const png = await fs.readFile(path.join(result.output, v.png)); assert.equal(png.subarray(1, 4).toString(), 'PNG');
      }
      assert.ok((await fs.stat(result.archive)).size > 1000);
      await assert.rejects(() => generate({ names: ['A'], count: 10 }, result.output), /EEXIST/);
    }
    const first = JSON.parse(await fs.readFile(path.join(temp, '10/manifest.json'), 'utf8'));
    const repeat = await generate({ names: ['Acme', 'Studio'], combine: true, count: 10, seed: 42, fonts: [fonts[0].id] }, path.join(temp, 'repeat'));
    assert.deepEqual(repeat.variants, first.variants);
    await assert.rejects(() => listFonts({ names: ['A'], fontDirectory: path.join(temp, 'missing') }), /does not exist/);
    const installed = path.join(temp, 'skill');
    await exec(process.execPath, ['scripts/install-skill.mjs', installed], { cwd: root });
    const { stdout } = await exec(process.execPath, [path.join(installed, 'scripts/run.mjs'), '--help']); assert.match(stdout, /9000x faster/);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
test('HTTP uploads, font directory, generation, polling, selection export and missing-file errors', { skip: process.platform !== 'darwin', timeout: 90000 }, async () => {
  const port = 19000 + Math.floor(Math.random() * 5000); const server = await serve(port); const base = `http://127.0.0.1:${port}`;
  const post = (url, data) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  try {
    assert.equal((await fetch(base + '/')).status, 200);
    assert.equal((await fetch(base + '/api/health', { headers: { Origin: 'https://evil.example' } })).status, 403);
    const empty = await post('/api/generate', { names: [], count: 10 }); assert.equal(empty.status, 400);
    // Use a real system font file and a source directory, not a fake font fixture.
    const fontPath = '/System/Library/Fonts/Supplemental/Arial.ttf'; const font = await fs.readFile(fontPath);
    const upload = await (await post('/api/upload', { files: [{ name: 'Arial.ttf', data: font.toString('base64') }] })).json(); assert.equal(upload.count, 1);
    const discovered = await (await post('/api/fonts', { names: ['Acme'], fontFiles: upload.fontFiles })).json(); assert.ok(discovered.fonts.length);
    const pending = await (await post('/api/generate', { names: ['Acme & Co'], count: 10, fontFiles: upload.fontFiles })).json(); assert.ok(pending.id);
    let result;
    for (let i = 0; i < 100; i++) { result = await (await fetch(base + pending.statusUrl)).json(); if (result.status !== 'running') break; await new Promise(r => setTimeout(r, 100)); }
    assert.equal(result.status, 'complete', result.error); assert.equal(result.count, 10);
    const exported = await (await post('/api/export', { id: result.id, numbers: [1, 2] })).json(); assert.match(exported.url, /selection-/);
    assert.equal((await fetch(base + exported.url)).status, 200);
    assert.equal((await fetch(base + result.baseUrl + 'missing.png')).status, 404);
    const source = await listFonts({ names: ['Acme'], fontDirectory: path.dirname(upload.fontFiles[0]) }); assert.ok(source.length);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('MCP stdio discovery is machine-readable and keeps stdout clean', async () => {
  const { spawn } = await import('node:child_process'); const child = spawn(process.execPath, ['bin/wordmark.mjs', 'mcp'], { cwd: root }); let output = '';
  child.stdout.on('data', chunk => output += chunk);
  child.stdin.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } }) + '\n' + JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
  await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => code ? reject(new Error(`MCP exited ${code}`)) : resolve()); });
  const messages = output.trim().split('\n').map(JSON.parse); assert.equal(messages[0].result.serverInfo.name, 'wordmark-generator'); assert.equal(messages[1].result.tools.length, 2);
});
