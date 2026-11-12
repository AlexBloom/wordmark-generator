import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from '../lib/core.mjs';
const id = process.argv[2];
if (!id || !/^\d+$/.test(id)) { console.error('Usage: node scripts/configure-figma.mjs YOUR_FIGMA_ASSIGNED_PLUGIN_ID'); process.exit(1); }
const template = JSON.parse(await fs.readFile(path.join(root, 'figma-plugin/manifest.template.json'), 'utf8'));
await fs.writeFile(path.join(root, 'figma-plugin/manifest.local.json'), JSON.stringify({ ...template, id }, null, 2) + '\n', { flag: 'wx' });
console.log('Import figma-plugin/manifest.local.json in Figma desktop.');
