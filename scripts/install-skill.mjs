import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { root } from '../lib/core.mjs';
const dest = path.resolve(process.argv[2] || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills/wordmark-generator'));
try {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.mkdir(dest); // Refuse to overwrite an existing installed skill.
  await fs.cp(path.join(root, 'skills/wordmark-generator'), dest, { recursive: true });
  const runtime = path.join(dest, 'assets/runtime'); await fs.mkdir(runtime, { recursive: true });
  for (const item of ['bin', 'lib', 'engine', 'web', 'package.json', 'LICENSE']) await fs.cp(path.join(root, item), path.join(runtime, item), { recursive: true });
  console.log(JSON.stringify({ installed: dest, invocation: '$wordmark-generator', selfContained: true }));
} catch (e) { console.error(e.code === 'EEXIST' ? 'Skill already exists. Choose another destination; existing skills are never overwritten.' : e.message); process.exitCode = 1; }
