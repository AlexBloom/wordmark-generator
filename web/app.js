const $ = s => document.querySelector(s);
const quantities = [10, 50, 100, 250];
let fontFiles = [], job = null, selection = new Set(), selectionSvg = '';
const message = text => { $('#error').hidden = !text; $('#error').textContent = text || ''; };
async function api(url, data) {
  const res = await fetch(url, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await res.json(); if (!res.ok) { const err = new Error(result.error || 'Request failed.'); err.result = result; throw err; } return result;
}
function request() {
  const names = $('#names').value.split('\n').map(n => n.trim()).filter(Boolean);
  const data = { names, count: quantities[+$('#quantity').value], combine: $('#combine').checked, seed: Number($('#seed').value) };
  if ($('#source').value === 'directory') { if (!$('#directory').value.trim()) throw new Error('Enter a font directory path.'); data.fontDirectory = $('#directory').value.trim(); }
  if ($('#source').value === 'upload') { if (!fontFiles.length) throw new Error('Drop or choose font files first.'); data.fontFiles = fontFiles; }
  const chosen = [...document.querySelectorAll('#font-list input:checked')].map(el => el.value); if (chosen.length) data.fonts = chosen;
  return data;
}
function resetFontChoices() { $('#font-list').replaceChildren(); $('#font-info').textContent = 'Leave unselected to explore all compatible families.'; }
$('#source').onchange = () => { $('#directory-source').hidden = $('#source').value !== 'directory'; $('#upload-source').hidden = $('#source').value !== 'upload'; resetFontChoices(); };
$('#directory').onchange = resetFontChoices;
$('#quantity').oninput = () => $('#quantity-label').textContent = quantities[+$('#quantity').value];
async function upload(files) {
  const fonts = [...files].filter(f => /\.(ttf|otf|ttc|otc|dfont)$/i.test(f.name));
  if (!fonts.length) return message('No supported font files found. Choose TTF, OTF, TTC, OTC, or DFONT.');
  $('#upload-info').textContent = `Loading ${fonts.length} files…`; message(''); fontFiles = []; resetFontChoices();
  try {
    // Upload bounded batches so large font directories do not overflow one request.
    for (let i = 0; i < fonts.length; i += 10) {
      const batch = await Promise.all(fonts.slice(i, i + 10).map(async f => ({ name: f.name, data: await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = reject; r.readAsDataURL(f); }) })));
      const result = await api('/api/upload', { files: batch }); fontFiles.push(...result.fontFiles);
    }
    $('#upload-info').textContent = `${fontFiles.length} font files loaded. Ready to explore.`;
  } catch (e) { fontFiles = []; message(e.message); $('#upload-info').textContent = 'Upload failed. Please try fewer or smaller files.'; }
}
$('#files').onchange = e => upload(e.target.files); $('#folder').onchange = e => upload(e.target.files);
$('#choose-files').onclick = () => $('#files').click(); $('#choose-folder').onclick = () => $('#folder').click();
$('#dropzone').onclick = () => $('#files').click(); $('#dropzone').onkeydown = e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); $('#files').click(); } };
for (const name of ['dragenter', 'dragover']) $('#dropzone').addEventListener(name, e => { e.preventDefault(); $('#dropzone').classList.add('drag'); });
$('#dropzone').ondragleave = () => $('#dropzone').classList.remove('drag');
async function entryFiles(entry) {
  if (entry.isFile) return [await new Promise((resolve, reject) => entry.file(resolve, reject))];
  const reader = entry.createReader(); const files = [];
  for (;;) { const entries = await new Promise((resolve, reject) => reader.readEntries(resolve, reject)); if (!entries.length) break; for (const child of entries) files.push(...await entryFiles(child)); } return files;
}
$('#dropzone').ondrop = async e => {
  e.preventDefault(); $('#dropzone').classList.remove('drag');
  const entries = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
  try { const files = entries.length ? (await Promise.all(entries.map(entryFiles))).flat() : [...e.dataTransfer.files]; await upload(files); } catch (error) { message(error.message); }
};
$('#load-fonts').onclick = async () => {
  const button = $('#load-fonts'); button.disabled = true; button.textContent = 'Finding fonts…'; message('');
  try {
    const data = request(); delete data.fonts; const { fonts } = await api('/api/fonts', data); $('#font-list').replaceChildren();
    for (const f of fonts) { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.value = f.id; label.append(input, document.createTextNode(f.family)); label.dataset.family = f.family.toLowerCase(); $('#font-list').append(label); }
    $('#font-info').textContent = `${fonts.length} compatible families. Leave unselected to use all.`;
  } catch (e) { message(e.message); } finally { button.disabled = false; button.textContent = 'Find compatible fonts'; }
};
$('#font-search').oninput = e => document.querySelectorAll('#font-list label').forEach(l => l.hidden = !l.dataset.family.includes(e.target.value.toLowerCase()));
function updateSelection() { $('#selected-count').textContent = `${selection.size} selected`; document.querySelectorAll('.card').forEach(el => { const yes = selection.has(+el.dataset.number); el.classList.toggle('selected', yes); el.querySelector('input').checked = yes; }); }
function showResults(result) {
  job = result; selection = new Set(); $('#results').replaceChildren(); $('#toolbar').hidden = false; $('#bottom').hidden = false;
  $('#results-title').textContent = result.names.join(' / '); $('#results-info').textContent = `${result.count} lockups · ${result.uniqueFamilies} unique font families · Seed ${result.seed}`;
  for (const v of result.variants) {
    const card = document.createElement('article'); card.className = 'card'; card.dataset.number = v.number;
    const head = document.createElement('header'); const check = document.createElement('input'); check.type = 'checkbox'; check.setAttribute('aria-label', `Select lockup ${v.number}`); const toggle = () => { selection.has(v.number) ? selection.delete(v.number) : selection.add(v.number); updateSelection(); }; check.onchange = toggle;
    head.append(check, document.createTextNode(`${String(v.number).padStart(3, '0')} / ${v.family}`));
    const img = document.createElement('img'); img.loading = 'lazy'; img.src = result.baseUrl + v.svg; img.alt = v.names.join(' / '); img.onclick = toggle;
    const footer = document.createElement('footer'); footer.append(document.createTextNode(v.treatment)); const links = document.createElement('span'); for (const ext of ['svg', 'png']) { const a = document.createElement('a'); a.textContent = ext.toUpperCase() + ' ↓'; a.href = result.baseUrl + v[ext] + '?download'; a.download = v[ext]; links.append(a); } footer.append(links); card.append(head, img, footer); $('#results').append(card);
  }
  $('#zip').href = result.archiveUrl; $('#preview').href = result.previewUrl; $('#boards').replaceChildren();
  for (const [i, board] of result.boards.entries()) { const a = document.createElement('a'); a.href = result.baseUrl + board; a.target = '_blank'; a.textContent = `Rendered board ${i + 1} ↗`; $('#boards').append(a); } updateSelection();
}
$('#form').onsubmit = async e => {
  e.preventDefault(); message(''); const button = $('#generate'); button.disabled = true; document.body.classList.add('loading'); $('#status').textContent = 'Rendering…';
  try {
    const pending = await api('/api/generate', request());
    for (;;) { await new Promise(r => setTimeout(r, 1200)); const result = await api(pending.statusUrl); if (result.status === 'failed') throw new Error(result.error); if (result.status === 'complete') { showResults(result); break; } }
    $('#status').textContent = 'Ready to shortlist';
  } catch (error) { message(error.message); $('#status').textContent = 'Needs attention'; } finally { button.disabled = false; document.body.classList.remove('loading'); }
};
$('#select-all').onclick = () => { selection = new Set(job.variants.map(v => v.number)); updateSelection(); }; $('#clear').onclick = () => { selection.clear(); updateSelection(); };
async function exportSelection(endpoint = '/api/export') {
  message(''); if (!selection.size) throw new Error('Select one or more lockups first.'); return api(endpoint, { id: job.id, numbers: [...selection] });
}
$('#export').onclick = async () => { try { const { url } = await exportSelection(); const a = document.createElement('a'); a.href = url; a.download = 'wordmark-selection.svg'; a.click(); } catch (e) { message(e.message); } };
$('#figma').onclick = async () => { try { const { url } = await exportSelection(); $('#handoff-download').href = url; selectionSvg = await (await fetch(url)).text(); $('#copy-info').textContent = 'For reliable import, drag the downloaded SVG onto your Figma canvas or use the included plugin.'; $('#handoff').showModal(); } catch (e) { message(e.message); } };
$('#illustrator').onclick = async () => { try { await exportSelection('/api/illustrator'); $('#status').textContent = 'Sent to Illustrator'; } catch (e) { message(e.message); } };
$('#close-dialog').onclick = () => $('#handoff').close();
$('#copy-svg').onclick = async () => { try { await navigator.clipboard.writeText(selectionSvg); $('#copy-info').textContent = 'SVG markup copied. If your design app pastes it as text, drag in the downloaded SVG instead.'; } catch { $('#copy-info').textContent = 'Clipboard unavailable. Use Download selection SVG.'; } };
