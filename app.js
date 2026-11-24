// Dicionário Warao ⇄ Português — protótipo. Sem dependências externas.
'use strict';
const DATA = window.DADOS || [];
const $ = s => document.querySelector(s);
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¿?¡!.,;:"()]/g, '').replace(/\s+/g, ' ').trim();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SRC_SHORT = f => f.startsWith('Glossário') ? 'Glossário UNICEF 2022' : f.startsWith('Cartilha') ? 'Cartilha UFRN 2023' : f;
const PAGE = 60;

// Índice de busca: o campo warao inclui as formas variantes, para achar "Muabasi" quando a entrada é "Mojabasi".
DATA.forEach(e => {
  e._w = norm(e.warao);
  e._v = (e.variantes || []).flatMap(v => v.formas).map(norm).filter(f => f && f !== e._w);
  e._p = norm(e.pt);
  e._e = norm(e.es);
});

const state = { q: '', dir: 'all', status: '', cat: '', fonte: '', limit: PAGE };
try { const s = JSON.parse(localStorage.getItem('warao-ui') || '{}'); if (s.dir) state.dir = s.dir; } catch (_) {}
const saveUI = () => { try { localStorage.setItem('warao-ui', JSON.stringify({ dir: state.dir })); } catch (_) {} };

// ---------- Gravações (IndexedDB) ----------
const DB = { db: null };
function openDB() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('sem IndexedDB'));
    const r = indexedDB.open('warao-dicionario', 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore('gravacoes', { keyPath: 'key', autoIncrement: true }); s.createIndex('entryId', 'entryId'); };
    r.onsuccess = () => res(DB.db = r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = (mode, fn) => new Promise((res, rej) => {
  if (!DB.db) return res(mode === 'readonly' ? [] : null);
  const t = DB.db.transaction('gravacoes', mode); const st = t.objectStore('gravacoes');
  const out = fn(st); t.oncomplete = () => res(out && 'result' in out ? out.result : out); t.onerror = () => rej(t.error);
});
const allRecs = () => tx('readonly', s => s.getAll());
const recsFor = id => tx('readonly', s => s.index('entryId').getAll(id));
const addRec = rec => tx('readwrite', s => s.add(rec));
const delRec = key => tx('readwrite', s => s.delete(key));

let recCount = new Map();        // entryId -> nº de gravações no aparelho
let repoAudio = {};              // entryId -> [arquivos em audio/]
async function refreshCounts() {
  recCount = new Map();
  try { (await allRecs()).forEach(r => recCount.set(r.entryId, (recCount.get(r.entryId) || 0) + 1)); } catch (_) {}
}
async function loadRepoAudio() {
  try { const r = await fetch('audio/index.json', { cache: 'no-cache' }); if (r.ok) repoAudio = await r.json(); } catch (_) {}
}
const hasAudio = e => recCount.has(e.id) || (repoAudio[e.id] && repoAudio[e.id].length);

// ---------- Filtros ----------
const STATUS = [
  ['', 'Todas'],
  ['revisar_falante', 'Revisar com falante'],
  ['variantes', 'Com variantes'],
  ['audio', 'Com gravação'],
];
function buildFilters() {
  const st = $('#status');
  st.innerHTML = STATUS.map(([k, l]) => `<button class="chip" data-s="${k}" aria-pressed="${k === state.status}">${l}${k === 'revisar_falante' ? ' (' + DATA.filter(e => e.status === k).length + ')' : ''}</button>`).join('');
  st.onclick = ev => { const b = ev.target.closest('.chip'); if (!b) return; state.status = b.dataset.s; state.limit = PAGE; st.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b)); render(); };
  const cats = [...new Set(DATA.map(e => e.categoria))].sort((a, b) => a.localeCompare(b, 'pt'));
  $('#cat').innerHTML = '<option value="">Todas as categorias</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
  const fontes = [...new Set(DATA.map(e => e.fonte))];
  $('#fonte').innerHTML = '<option value="">Todas as fontes</option>' + fontes.map(f => `<option value="${esc(f)}">${esc(SRC_SHORT(f))}</option>`).join('');
  $('#cat').onchange = ev => { state.cat = ev.target.value; state.limit = PAGE; render(); };
  $('#fonte').onchange = ev => { state.fonte = ev.target.value; state.limit = PAGE; render(); };
  $('#nG').textContent = '(' + DATA.filter(e => e.fonte.startsWith('Glossário')).length + ' entradas)';
  $('#nC').textContent = '(' + DATA.filter(e => e.fonte.startsWith('Cartilha')).length + ' entradas)';
}
function syncDir() {
  document.querySelectorAll('.dir button').forEach(b => b.setAttribute('aria-pressed', b.dataset.dir === state.dir));
  $('#q').placeholder = state.dir === 'wp' ? 'Digite em Warao…' : state.dir === 'pw' ? 'Digite em português…' : 'Buscar em Warao ou português…';
}

// ---------- Busca ----------
function matchScore(f, q) {
  if (!f) return -1;
  if (f === q) return 0;
  if (f.startsWith(q)) return 1;
  if (f.split(/[\s\/,-]+/).some(t => t.startsWith(q))) return 2;
  if (f.includes(q)) return 3;
  return -1;
}
function score(e, q) {
  let fields;
  if (state.dir === 'wp') fields = [[e._w, 0], ...e._v.map(v => [v, 1])];
  else if (state.dir === 'pw') fields = [[e._p, 0]];
  else fields = [[e._w, 0], [e._p, 0], ...e._v.map(v => [v, 1]), [e._e, 1]];
  let best = -1;
  for (const [f, pen] of fields) {
    const s = matchScore(f, q);
    if (s >= 0) { const v = s * 2 + pen; if (best < 0 || v < best) best = v; }
  }
  return best;
}
function hl(text, q) {
  if (!q) return esc(text);
  const map = []; let acc = '';
  for (let k = 0; k < text.length; k++) { const n = norm(text[k]) || (text[k] === ' ' ? ' ' : ''); for (let j = 0; j < n.length; j++) map.push(k); acc += n; }
  const j = acc.indexOf(q); if (j < 0) return esc(text);
  const s = map[j], e = map[j + q.length - 1] + 1;
  return esc(text.slice(0, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>' + esc(text.slice(e));
}
function filtered() {
  const q = norm(state.q);
  let rows = DATA.filter(e =>
    (!state.cat || e.categoria === state.cat) &&
    (!state.fonte || e.fonte === state.fonte) &&
    (!state.status || (state.status === 'revisar_falante' ? e.status === 'revisar_falante' : state.status === 'variantes' ? e.variantes.length : hasAudio(e))));
  if (q) return rows.map(e => [e, score(e, q)]).filter(x => x[1] >= 0).sort((a, b) => a[1] - b[1] || a[0]._w.localeCompare(b[0]._w)).map(x => x[0]);
  return rows.slice().sort((a, b) => state.dir === 'pw' ? a._p.localeCompare(b._p) : a._w.localeCompare(b._w));
}

// ---------- Lista ----------
function card(e, q) {
  const pw = state.dir === 'pw';
  const W = `<span class="w" lang="wba">${hl(e.warao, q)}</span>`, P = `<span class="p">${hl(e.pt, q)}</span>`;
  const n = (recCount.get(e.id) || 0) + ((repoAudio[e.id] || []).length);
  const varMatch = q && e._v.some(v => v.includes(q)) && !e._w.includes(q);
  const tags = [
    e.status === 'revisar_falante' ? '<span class="badge warn">Revisar com falante</span>' : '',
    e.variantes.length ? '<span class="badge">Variante</span>' : '',
    n ? `<span class="badge ok">🔊 ${n}</span>` : '',
    `<span class="badge src">${esc(SRC_SHORT(e.fonte))}</span>`,
  ].join('');
  const vars = e.variantes.map(v => `<div class="var"><strong>${esc(v.conceito)}:</strong> ${v.formas.length ? 'também ' + v.formas.map(f => `<span lang="wba">${hl(f, q)}</span>`).join(', ') : 'mesma palavra com tradução diferente entre as fontes'}${v.comentario ? '. ' + esc(v.comentario) : ''}</div>`).join('');
  return `<li class="card${e.status === 'revisar_falante' ? ' warn' : ''}" data-id="${e.id}">
    <button class="head" aria-expanded="false"><div class="row">${pw ? P : W}<span class="arrow">→</span>${pw ? W : P}</div>
    <div class="tags">${tags}${varMatch ? '<span class="badge">achado pela variante</span>' : ''}</div></button>
    <div class="meta">
      <dl>
        <dt>Warao</dt><dd lang="wba">${esc(e.warao)}</dd>
        <dt>Português</dt><dd>${esc(e.pt)}</dd>
        <dt>Espanhol</dt><dd lang="es">${hl(e.es, state.dir === 'all' ? q : '')}</dd>
        <dt>Categoria</dt><dd>${esc(e.categoria)}</dd>
        <dt>Fonte</dt><dd>${esc(e.fonte)}, p. ${esc(e.pagina)}</dd>
        <dt>Situação</dt><dd>${e.status === 'revisar_falante' ? '<span class="badge warn">Revisar com falante</span>' : '<span class="badge">Provisória</span>'}</dd>
      </dl>
      ${e.nota ? `<div class="note">${esc(e.nota)}</div>` : ''}
      ${vars}
      <div class="actions"><button class="btn primary" data-rec="${e.id}">🎙 Gravar pronúncia</button>${n ? `<button class="btn" data-play="${e.id}">▶ Ouvir (${n})</button>` : ''}</div>
    </div></li>`;
}
function render() {
  const q = norm(state.q);
  const rows = filtered();
  $('#count').textContent = rows.length + (rows.length === 1 ? ' entrada' : ' entradas');
  const list = $('#list');
  if (!rows.length) { list.innerHTML = '<li class="empty">Nenhuma palavra encontrada.<br>Tente outra grafia, sem acentos, ou mude o sentido da busca.</li>'; $('#more').hidden = true; return; }
  list.innerHTML = rows.slice(0, state.limit).map(e => card(e, q)).join('');
  $('#more').hidden = rows.length <= state.limit;
}
$('#more').onclick = () => { state.limit += PAGE; render(); };
$('#list').addEventListener('click', ev => {
  const r = ev.target.closest('[data-rec]'); if (r) return openRec(+r.dataset.rec);
  const p = ev.target.closest('[data-play]'); if (p) return openRec(+p.dataset.play);
  const h = ev.target.closest('.head'); if (!h) return;
  const c = h.parentElement; h.setAttribute('aria-expanded', c.classList.toggle('open'));
});
document.querySelectorAll('.dir button').forEach(b => b.onclick = () => { state.dir = b.dataset.dir; saveUI(); syncDir(); render(); });
let tmr; $('#q').addEventListener('input', ev => { clearTimeout(tmr); tmr = setTimeout(() => { state.q = ev.target.value; state.limit = PAGE; render(); }, 80); });

// ---------- Gravador ----------
const R = { entry: null, mr: null, chunks: [], t0: 0, tick: null, stream: null, urls: [] };
function pickMime() {
  if (!window.MediaRecorder) return '';
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
  return '';
}
const extOf = mime => /mp4|m4a|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
async function openRec(id) {
  const e = DATA.find(x => x.id === id); R.entry = e;
  $('#recTitle').textContent = e.warao;
  $('#recSub').textContent = e.pt + ' · ' + SRC_SHORT(e.fonte);
  $('#recMsg').textContent = window.MediaRecorder && navigator.mediaDevices ? 'Toque no botão vermelho para gravar e toque de novo para parar.' : 'Este navegador não permite gravar áudio. Tente o Chrome no Android ou o Safari atualizado no iPhone.';
  try { $('#recWho').value = localStorage.getItem('warao-who') || ''; } catch (_) {}
  await renderTakes();
  $('#rec').showModal();
}
async function renderTakes() {
  R.urls.forEach(URL.revokeObjectURL); R.urls = [];
  const id = R.entry.id;
  const local = await recsFor(id).catch(() => []);
  const repo = repoAudio[id] || [];
  const parts = [];
  repo.forEach(f => parts.push(`<div class="take"><audio controls preload="none" src="audio/${esc(f)}"></audio><span class="who">No repositório: ${esc(f)}</span></div>`));
  local.forEach(r => { const u = URL.createObjectURL(r.blob); R.urls.push(u);
    parts.push(`<div class="take"><audio controls preload="metadata" src="${u}"></audio><button class="btn" data-del="${r.key}">Apagar</button><span class="who">Gravado neste aparelho em ${new Date(r.created).toLocaleString('pt-BR')}${r.who ? ' · ' + esc(r.who) : ''}</span></div>`); });
  $('#recList').innerHTML = parts.join('') || '';
}
$('#recList').addEventListener('click', async ev => {
  const d = ev.target.closest('[data-del]'); if (!d) return;
  await delRec(+d.dataset.del); await refreshCounts(); await renderTakes(); render();
});
function stopTracks() { if (R.stream) R.stream.getTracks().forEach(t => t.stop()); R.stream = null; }
$('#recBtn').onclick = async () => {
  const btn = $('#recBtn');
  if (R.mr && R.mr.state === 'recording') { R.mr.stop(); return; }
  if (!DB.db) { $('#recMsg').textContent = 'Não foi possível abrir o armazenamento do navegador; a gravação não seria guardada.'; return; }
  try {
    R.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
  } catch (err) { $('#recMsg').textContent = 'Sem acesso ao microfone. Libere o microfone para este site nas configurações do navegador.'; return; }
  const mime = pickMime();
  R.mr = mime ? new MediaRecorder(R.stream, { mimeType: mime }) : new MediaRecorder(R.stream);
  R.chunks = [];
  R.mr.ondataavailable = ev => { if (ev.data && ev.data.size) R.chunks.push(ev.data); };
  R.mr.onstop = async () => {
    clearInterval(R.tick); btn.classList.remove('on'); btn.setAttribute('aria-label', 'Começar a gravar'); stopTracks();
    const type = R.mr.mimeType || mime || 'audio/webm';
    const blob = new Blob(R.chunks, { type });
    if (blob.size < 500) { $('#recMsg').textContent = 'A gravação ficou vazia. Tente de novo.'; return; }
    const who = $('#recWho').value.trim(); try { localStorage.setItem('warao-who', who); } catch (_) {}
    await addRec({ entryId: R.entry.id, warao: R.entry.warao, pt: R.entry.pt, blob, mime: type, who, created: Date.now() });
    await refreshCounts(); await renderTakes(); render();
    $('#recMsg').textContent = 'Gravação guardada neste aparelho. Lembre de exportar os áudios depois.';
  };
  R.mr.start(); R.t0 = Date.now(); btn.classList.add('on'); btn.setAttribute('aria-label', 'Parar gravação');
  $('#recMsg').textContent = 'Gravando… toque de novo para parar.';
  R.tick = setInterval(() => { const s = Math.floor((Date.now() - R.t0) / 1000); $('#recTime').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }, 250);
};
$('#rec').addEventListener('close', () => { if (R.mr && R.mr.state === 'recording') R.mr.stop(); stopTracks(); $('#recTime').textContent = '00:00'; document.querySelectorAll('#recList audio').forEach(a => a.pause()); });

// ---------- Exportação (.zip com a pasta audio/) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) { // [{name, data:Uint8Array}] — sem compressão (áudio já é comprimido)
  const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + sz;
  }
  const csz = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'entrada';
$('#exportBtn').onclick = async () => {
  const recs = await allRecs().catch(() => []);
  if (!recs.length) { alertBox('Ainda não há gravações neste aparelho.'); return; }
  const index = JSON.parse(JSON.stringify(repoAudio)); const files = []; const csv = [['arquivo', 'id', 'warao', 'portugues', 'falante', 'gravado_em'].join(',')];
  const enc = new TextEncoder();
  for (const r of recs) {
    const name = `${r.entryId}-${slug(r.warao)}-${r.key}.${extOf(r.mime)}`;
    files.push({ name: 'audio/' + name, data: new Uint8Array(await r.blob.arrayBuffer()) });
    (index[r.entryId] = index[r.entryId] || []).includes(name) || index[r.entryId].push(name);
    csv.push([name, r.entryId, r.warao, r.pt, r.who || '', new Date(r.created).toISOString()].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
  }
  files.push({ name: 'audio/index.json', data: enc.encode(JSON.stringify(index, null, 1)) });
  files.push({ name: 'audio/gravacoes.csv', data: enc.encode('﻿' + csv.join('\n')) });
  const blob = zip(files);
  const fname = 'audios-warao-' + new Date().toISOString().slice(0, 10) + '.zip';
  const file = new File([blob], fname, { type: 'application/zip' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: fname }); return; } catch (_) {}
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
};
function alertBox(msg) { $('#net').textContent = msg; setTimeout(updateNet, 4000); }

// ---------- Diálogos, rede e modo offline ----------
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
$('#aboutBtn').onclick = () => $('#about').showModal();
let swReady = false;
function updateNet() { $('#net').textContent = !navigator.onLine ? 'Sem internet (cópia local)' : swReady ? 'Offline ativo' : DATA.length + ' entradas'; }
addEventListener('online', updateNet); addEventListener('offline', updateNet);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then(r => navigator.serviceWorker.ready).then(() => { swReady = true; updateNet(); }).catch(() => {});
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

(async () => {
  buildFilters(); syncDir(); render(); updateNet();
  try { await openDB(); } catch (_) {}
  await Promise.all([refreshCounts(), loadRepoAudio()]);
  render();
})();
