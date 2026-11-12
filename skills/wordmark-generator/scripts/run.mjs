#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
const candidates = [
  ...(process.env.WORDMARK_GENERATOR_HOME ? [path.join(process.env.WORDMARK_GENERATOR_HOME, 'bin/wordmark.mjs')] : []),
  fileURLToPath(new URL('../assets/runtime/bin/wordmark.mjs', import.meta.url)),
  fileURLToPath(new URL('../../../bin/wordmark.mjs', import.meta.url))
];
const entry = candidates.find(existsSync);
if (!entry) { console.error('Runtime missing. Install the complete skill using npm run install:skill in the Wordmark Generator repository.'); process.exit(1); }
const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('error', e => { console.error(e.message); process.exitCode = 1; });
child.on('exit', code => process.exitCode = code ?? 1);
