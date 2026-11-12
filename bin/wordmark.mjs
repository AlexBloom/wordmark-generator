#!/usr/bin/env node
import fs from 'node:fs/promises';
import { build, generate, listFonts } from '../lib/core.mjs';
const [command = 'serve', ...args] = process.argv.slice(2);
const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
try {
  if (command === 'build') { console.log(JSON.stringify({ engine: await build() })); }
  else if (command === 'serve') { const { serve } = await import('../lib/server.mjs'); await serve(Number(value('--port') || 9000)); }
  else if (command === 'mcp') { const { mcp } = await import('../lib/mcp.mjs'); await mcp(); }
  else if (command === 'generate' || command === 'fonts') {
    let request = {};
    if (value('--request')) request = JSON.parse(await fs.readFile(value('--request'), 'utf8'));
    if (args.includes('--stdin')) { let data = ''; for await (const chunk of process.stdin) data += chunk; request = JSON.parse(data); }
    const names = args.flatMap((a, i) => a === '--name' ? [args[i + 1]] : []);
    if (names.length) request.names = names;
    if (value('--count')) request.count = Number(value('--count'));
    if (value('--font-dir')) request.fontDirectory = value('--font-dir');
    if (value('--seed')) request.seed = Number(value('--seed'));
    if (args.includes('--combine')) request.combine = true;
    console.log(JSON.stringify(command === 'fonts' ? await listFonts(request) : await generate(request, value('--out')), null, 2));
  } else if (command === '--help' || command === 'help') console.log('Wordmark Generator — the v1 of your wordmark 9000x faster\n\nserve [--port 9000]\ngenerate --name "Brand" [--name "Studio"] [--combine] --count 10|50|100|250 [--font-dir PATH] [--out NEW_DIR] [--seed 9000]\ngenerate --request request.json | --stdin\nfonts [--font-dir PATH] [--name "Brand"]\nbuild\nmcp\n\nmacOS + Node 22+ + Xcode Command Line Tools. Users are responsible for their own font licensing.');
  else throw new Error(`Unknown command: ${command}. Run --help.`);
} catch (e) { console.error(JSON.stringify({ error: e.message })); process.exitCode = 1; }
