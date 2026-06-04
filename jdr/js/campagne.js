import { db } from '../firebase-config.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, getDoc, serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Helpers ──────────────────────────────────────────────
function escH(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'ok') {
  const t = document.getElementById('camp-toast');
  t.textContent = msg;
  t.className = `camp-toast camp-toast-${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

// ── State ────────────────────────────────────────────────
const CAMP_ID = new URLSearchParams(window.location.search).get('id');

let campagne    = null;
let wikiPages   = [];
let carteDoc    = null;   // { id?, campagne_id, image_url, annotations[], markers[] }
let chronoArcs  = [];

let editWikiId       = null;
let editArcId        = null;
let editMarkerId     = null;
let pendingMarkerPos = null;
let arcScenarios     = [];

// Canvas
let activeTool    = 'select';
let isDrawing     = false;
let currentStroke = null;
let drawCanvas, drawCtx;

// ── INIT ─────────────────────────────────────────────────
export async function initCampagne() {
  if (!CAMP_ID) {
    document.getElementById('main-content').innerHTML =
      '<p style="padding:2rem;color:var(--muted)">Identifiant de projet manquant.</p>';
    return;
  }
  try {
    const campRef = await getDoc(doc(db, 'jdr_campagnes', CAMP_ID));
    if (!campRef.exists()) {
      document.getElementById('main-content').innerHTML =
        '<p style="padding:2rem;color:var(--muted)">Projet introuvable.</p>';
      return;
    }
    campagne = { id: campRef.id, ...campRef.data() };
    document.title = `${campagne.emoji || '🎲'} ${campagne.nom} — JDR`;
    document.getElementById('camp-emoji-display').textContent = campagne.emoji || '🎲';
    document.getElementById('camp-nom-display').textContent = campagne.nom;

    const [wSnap, cSnap, chSnap] = await Promise.all([
      getDocs(query(collection(db, 'jdr_camp_wiki'),  where('campagne_id', '==', CAMP_ID))),
      getDocs(query(collection(db, 'jdr_camp_carte'), where('campagne_id', '==', CAMP_ID))),
      getDocs(query(collection(db, 'jdr_camp_chrono'), where('campagne_id', '==', CAMP_ID))),
    ]);

    wikiPages = [];
    wSnap.forEach(d => wikiPages.push({ id: d.id, ...d.data() }));
    wikiPages.sort((a, b) => (a.titre || '').localeCompare(b.titre || ''));

    if (!cSnap.empty) {
      const cd = cSnap.docs[0];
      carteDoc = { id: cd.id, ...cd.data() };
    }

    chronoArcs = [];
    chSnap.forEach(d => chronoArcs.push({ id: d.id, ...d.data() }));
    chronoArcs.sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99));

    setupTabs();
    setupWiki();
    setupCarte();
    setupChrono();
    setupWikiModal();
    setupMapModal();
    setupMarkerModal();
    setupArcModal();

    renderWiki();
    renderCarte();
    renderChrono();

  } catch(e) {
    console.error(e);
    showToast('Erreur de chargement', 'err');
  }
}

// ── TABS ─────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.camp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.camp-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.camp-tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
      if (btn.dataset.tab === 'carte') setTimeout(initCanvas, 60);
    });
  });
}

// ── WIKI ─────────────────────────────────────────────────
const CAT_LABEL = {
  lieu: '📍 Lieu', personnage: '👤 Personnage',
  piste: '🔍 Piste', quete: '⚔️ Quête',
};

const CAT_FIELDS = {
  lieu: [
    { id: 'f_type',      label: 'Type de lieu',      ph: 'Ville, village, donjon, ruines…' },
    { id: 'f_habitants', label: 'Habitants notables', ph: 'Noms, rôles, factions…' },
  ],
  personnage: [
    { id: 'f_role',    label: 'Rôle',    ph: 'Allié, antagoniste, neutre…' },
    { id: 'f_faction', label: 'Faction', ph: 'Appartenance, allégeance…' },
    { id: 'f_secrets', label: 'Secrets', ph: 'Ce que les joueurs ne savent pas encore…', rows: 3 },
  ],
  piste: [
    { id: 'f_liee',    label: 'Liée à (lieu / personnage)', ph: 'Ex: Tour Noire, Karrak…' },
    { id: 'f_indices', label: 'Indices', ph: 'Liste des indices, comment les découvrir…', rows: 3 },
  ],
  quete: [
    { id: 'f_objectif',   label: 'Objectif',   ph: 'Ce que les joueurs doivent accomplir…' },
    { id: 'f_recompense', label: 'Récompense', ph: 'XP, objet, information…' },
    { id: 'f_qstatut',    label: 'Statut', type: 'select',
      opts: ['À faire', 'En cours', 'Terminée', 'Abandonnée'] },
  ],
};

let wikiCat = '';

function setupWiki() {
  document.querySelectorAll('.wiki-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wiki-cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      wikiCat = btn.dataset.cat;
      renderWiki();
    });
  });
  document.getElementById('btn-new-page').addEventListener('click', () => openWikiModal());
}

function renderWiki() {
  const list  = document.getElementById('wiki-list');
  const pages = wikiCat ? wikiPages.filter(p => p.categorie === wikiCat) : wikiPages;

  if (pages.length === 0) {
    list.innerHTML = `<div class="camp-empty-state" style="padding:2.5rem 0">
      <div class="camp-empty-icon">📖</div>
      <div class="camp-empty-text">Aucune page${wikiCat ? ' dans cette catégorie' : ''}.</div>
    </div>`;
    return;
  }

  if (wikiCat) {
    list.innerHTML = `<div class="wiki-group">${pages.map(wikiCardHTML).join('')}</div>`;
  } else {
    const groups = {};
    pages.forEach(p => { (groups[p.categorie] ??= []).push(p); });
    list.innerHTML = Object.entries(groups).map(([cat, ps]) => `
      <div class="wiki-group">
        <div class="wiki-group-title">${CAT_LABEL[cat] || cat}</div>
        ${ps.map(wikiCardHTML).join('')}
      </div>`).join('');
  }
  list.querySelectorAll('.wiki-card').forEach(el =>
    el.addEventListener('click', () => openWikiModal(el.dataset.id)));
}

function wikiCardHTML(p) {
  const preview = (p.contenu || '').slice(0, 90).replace(/\n/g, ' ');
  return `<div class="wiki-card" data-id="${p.id}">
    <div class="wiki-card-title">${escH(p.titre)}</div>
    ${preview ? `<div class="wiki-card-preview">${escH(preview)}${(p.contenu?.length ?? 0) > 90 ? '…' : ''}</div>` : ''}
  </div>`;
}

function setupWikiModal() {
  document.getElementById('wiki-close').addEventListener('click', closeWikiModal);
  document.getElementById('wiki-cancel').addEventListener('click', closeWikiModal);
  document.getElementById('wiki-overlay').addEventListener('click', e => {
    if (e.target.id === 'wiki-overlay') closeWikiModal();
  });
  document.getElementById('wiki-save').addEventListener('click', saveWikiPage);
  document.getElementById('wiki-delete').addEventListener('click', deleteWikiPage);
  document.getElementById('wiki-cat').addEventListener('change', e => renderDynFields(e.target.value));
}

function openWikiModal(id = null) {
  editWikiId = id;
  const p = id ? wikiPages.find(x => x.id === id) : null;

  document.getElementById('wiki-modal-title').textContent = id ? 'Modifier la page' : 'Nouvelle page';
  document.getElementById('wiki-titre').value   = p?.titre   || '';
  document.getElementById('wiki-contenu').value = p?.contenu || '';
  document.getElementById('wiki-error').textContent = '';
  document.getElementById('wiki-delete').classList.toggle('hidden', !id);

  const catSel = document.getElementById('wiki-cat');
  catSel.value = p?.categorie || wikiCat || 'lieu';
  renderDynFields(catSel.value, p?.fields);

  document.getElementById('wiki-overlay').classList.remove('hidden');
  document.getElementById('wiki-titre').focus();
}

function renderDynFields(cat, existing = {}) {
  const fields = CAT_FIELDS[cat] || [];
  document.getElementById('wiki-dyn-fields').innerHTML = fields.map(f => {
    const val = existing?.[f.id] || '';
    if (f.type === 'select') {
      return `<div class="form-row">
        <label class="form-label">${escH(f.label)}</label>
        <select id="${f.id}" class="filter-select" style="width:100%">
          ${f.opts.map(o => `<option${o === val ? ' selected' : ''}>${escH(o)}</option>`).join('')}
        </select></div>`;
    }
    if (f.rows) {
      return `<div class="form-row">
        <label class="form-label">${escH(f.label)}</label>
        <textarea id="${f.id}" class="form-input" rows="${f.rows}"
                  placeholder="${escH(f.ph || '')}" style="resize:vertical">${escH(val)}</textarea></div>`;
    }
    return `<div class="form-row">
      <label class="form-label">${escH(f.label)}</label>
      <input type="text" id="${f.id}" class="form-input"
             value="${escH(val)}" placeholder="${escH(f.ph || '')}"></div>`;
  }).join('');
}

function getFieldValues(cat) {
  const out = {};
  (CAT_FIELDS[cat] || []).forEach(f => {
    const el = document.getElementById(f.id);
    if (el) out[f.id] = el.value.trim();
  });
  return out;
}

function closeWikiModal() {
  document.getElementById('wiki-overlay').classList.add('hidden');
  editWikiId = null;
}

async function saveWikiPage() {
  const titre     = document.getElementById('wiki-titre').value.trim();
  const contenu   = document.getElementById('wiki-contenu').value.trim();
  const categorie = document.getElementById('wiki-cat').value;
  const fields    = getFieldValues(categorie);
  const errEl     = document.getElementById('wiki-error');

  if (!titre) { errEl.textContent = 'Le titre est requis.'; return; }

  const btn = document.getElementById('wiki-save');
  btn.disabled = true;
  try {
    const data = { campagne_id: CAMP_ID, titre, categorie, contenu, fields, mis_a_jour: serverTimestamp() };
    if (editWikiId) {
      await updateDoc(doc(db, 'jdr_camp_wiki', editWikiId), data);
      const i = wikiPages.findIndex(p => p.id === editWikiId);
      if (i >= 0) wikiPages[i] = { ...wikiPages[i], ...data };
    } else {
      data.cree_le = serverTimestamp();
      const ref = await addDoc(collection(db, 'jdr_camp_wiki'), data);
      wikiPages.push({ id: ref.id, ...data });
      wikiPages.sort((a, b) => (a.titre || '').localeCompare(b.titre || ''));
    }
    closeWikiModal();
    renderWiki();
    showToast(editWikiId ? 'Page modifiée' : 'Page créée');
  } catch(e) {
    errEl.textContent = 'Erreur : ' + e.message;
  } finally { btn.disabled = false; }
}

async function deleteWikiPage() {
  if (!editWikiId || !confirm('Supprimer cette page ?')) return;
  try {
    await deleteDoc(doc(db, 'jdr_camp_wiki', editWikiId));
    wikiPages = wikiPages.filter(p => p.id !== editWikiId);
    closeWikiModal();
    renderWiki();
    showToast('Page supprimée');
  } catch(e) { showToast('Erreur : ' + e.message, 'err'); }
}

// ── CARTE ────────────────────────────────────────────────
function setupCarte() {
  document.getElementById('btn-set-map').addEventListener('click', openMapModal);
  document.getElementById('btn-add-map').addEventListener('click', openMapModal);
  document.getElementById('btn-save-carte').addEventListener('click', saveCarte);
  document.getElementById('btn-clear-draw').addEventListener('click', () => {
    if (!confirm('Effacer tous les dessins ?')) return;
    if (carteDoc) carteDoc.annotations = [];
    redrawAnnotations();
  });

  document.querySelectorAll('.carte-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTool = btn.dataset.tool;
      document.querySelectorAll('.carte-tool').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const showDraw = activeTool === 'draw' || activeTool === 'erase';
      document.getElementById('carte-draw-opts').classList.toggle('hidden', !showDraw);
      if (drawCanvas) {
        drawCanvas.style.cursor =
          activeTool === 'draw'   ? 'crosshair' :
          activeTool === 'erase'  ? 'cell' :
          activeTool === 'marker' ? 'copy' : 'default';
      }
    });
  });

  const canvas = document.getElementById('carte-canvas');
  canvas.addEventListener('mousedown', onCanvasDown);
  canvas.addEventListener('mousemove', onCanvasMove);
  canvas.addEventListener('mouseup',   onCanvasUp);
  canvas.addEventListener('mouseleave', onCanvasUp);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); onCanvasDown(e.touches[0]); }, { passive: false });
  canvas.addEventListener('touchmove',  e => { e.preventDefault(); onCanvasMove(e.touches[0]); }, { passive: false });
  canvas.addEventListener('touchend',   e => { e.preventDefault(); onCanvasUp(); }, { passive: false });

  window.addEventListener('resize', () => {
    if (!document.getElementById('tab-carte').classList.contains('hidden')) initCanvas();
  });
}

function renderCarte() {
  if (carteDoc?.image_url) showMap(carteDoc.image_url);
}

function showMap(url) {
  document.getElementById('carte-empty').classList.add('hidden');
  document.getElementById('carte-wrap').classList.remove('hidden');
  const img = document.getElementById('carte-img');
  img.src = url;
  img.onload  = () => { initCanvas(); renderMarkers(); };
  img.onerror = () => showToast("Impossible de charger l'image — vérifiez l'URL.", 'err');
}

function initCanvas() {
  const img = document.getElementById('carte-img');
  const w = img.offsetWidth;
  const h = img.offsetHeight;
  if (!w || !h) return;
  drawCanvas = document.getElementById('carte-canvas');
  drawCanvas.width  = w;
  drawCanvas.height = h;
  drawCtx = drawCanvas.getContext('2d');
  redrawAnnotations();
}

function redrawAnnotations() {
  if (!drawCtx || !drawCanvas) return;
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  for (const stroke of (carteDoc?.annotations || [])) {
    if (!stroke.points?.length) continue;
    drawCtx.beginPath();
    drawCtx.strokeStyle = stroke.color || '#e74c3c';
    drawCtx.lineWidth   = stroke.width || 4;
    drawCtx.lineCap     = 'round';
    drawCtx.lineJoin    = 'round';
    stroke.points.forEach(({ px, py }, i) => {
      const x = px * drawCanvas.width;
      const y = py * drawCanvas.height;
      i === 0 ? drawCtx.moveTo(x, y) : drawCtx.lineTo(x, y);
    });
    drawCtx.stroke();
  }
}

function canvasPos(e) {
  const r = drawCanvas.getBoundingClientRect();
  return { px: (e.clientX - r.left) / r.width, py: (e.clientY - r.top) / r.height };
}

function onCanvasDown(e) {
  if (!drawCanvas) return;
  if (activeTool === 'marker') { openMarkerModal(null, canvasPos(e)); return; }
  if (activeTool !== 'draw' && activeTool !== 'erase') return;
  isDrawing = true;
  const pos = canvasPos(e);
  currentStroke = {
    id: Date.now().toString(),
    points: [pos],
    color: activeTool === 'erase' ? null : document.getElementById('draw-color').value,
    width: activeTool === 'erase' ? 20 : parseInt(document.getElementById('draw-width').value),
    isErase: activeTool === 'erase',
  };
}

function onCanvasMove(e) {
  if (!isDrawing || !currentStroke) return;
  const pos  = canvasPos(e);
  const prev = currentStroke.points[currentStroke.points.length - 1];
  currentStroke.points.push(pos);

  if (currentStroke.isErase) {
    eraseAt(pos);
  } else {
    drawCtx.beginPath();
    drawCtx.strokeStyle = currentStroke.color;
    drawCtx.lineWidth   = currentStroke.width;
    drawCtx.lineCap     = 'round';
    drawCtx.lineJoin    = 'round';
    drawCtx.moveTo(prev.px * drawCanvas.width, prev.py * drawCanvas.height);
    drawCtx.lineTo(pos.px  * drawCanvas.width, pos.py  * drawCanvas.height);
    drawCtx.stroke();
  }
}

function onCanvasUp() {
  if (!isDrawing) return;
  isDrawing = false;
  if (!currentStroke) return;
  if (!currentStroke.isErase && currentStroke.points.length > 1) {
    if (!carteDoc) carteDoc = { campagne_id: CAMP_ID, annotations: [], markers: [] };
    (carteDoc.annotations ??= []).push(currentStroke);
  }
  currentStroke = null;
}

function eraseAt(pos) {
  if (!carteDoc?.annotations) return;
  const T = 0.025;
  const before = carteDoc.annotations.length;
  carteDoc.annotations = carteDoc.annotations.filter(s =>
    !s.points?.some(pt => Math.hypot(pt.px - pos.px, pt.py - pos.py) < T)
  );
  if (carteDoc.annotations.length !== before) redrawAnnotations();
}

async function saveCarte() {
  if (!carteDoc) return;
  const btn = document.getElementById('btn-save-carte');
  btn.disabled = true;
  try {
    const data = {
      campagne_id: CAMP_ID,
      image_url:   carteDoc.image_url   || null,
      annotations: carteDoc.annotations || [],
      markers:     carteDoc.markers     || [],
      mis_a_jour:  serverTimestamp(),
    };
    if (carteDoc.id) {
      await updateDoc(doc(db, 'jdr_camp_carte', carteDoc.id), data);
    } else {
      const ref = await addDoc(collection(db, 'jdr_camp_carte'), data);
      carteDoc.id = ref.id;
    }
    showToast('Carte sauvegardée ✓');
  } catch(e) {
    showToast('Erreur : ' + e.message, 'err');
  } finally { btn.disabled = false; }
}

// Map URL modal
function setupMapModal() {
  document.getElementById('map-close').addEventListener('click', closeMapModal);
  document.getElementById('map-cancel').addEventListener('click', closeMapModal);
  document.getElementById('map-apply').addEventListener('click', applyMapUrl);
  document.getElementById('map-overlay').addEventListener('click', e => {
    if (e.target.id === 'map-overlay') closeMapModal();
  });
}

function openMapModal() {
  document.getElementById('map-url').value = carteDoc?.image_url || '';
  document.getElementById('map-error').textContent = '';
  document.getElementById('map-overlay').classList.remove('hidden');
  document.getElementById('map-url').focus();
}

function closeMapModal() {
  document.getElementById('map-overlay').classList.add('hidden');
}

async function applyMapUrl() {
  const url   = document.getElementById('map-url').value.trim();
  const errEl = document.getElementById('map-error');
  if (!url) { errEl.textContent = 'URL requise.'; return; }
  if (!carteDoc) carteDoc = { campagne_id: CAMP_ID, annotations: [], markers: [] };
  carteDoc.image_url = url;
  closeMapModal();
  showMap(url);
  await saveCarte();
}

// Markers
function renderMarkers() {
  const container = document.getElementById('carte-markers');
  if (!container) return;
  container.innerHTML = '';
  (carteDoc?.markers || []).forEach(m => {
    const el = document.createElement('div');
    el.className = 'carte-marker';
    el.style.cssText = `left:${m.px * 100}%;top:${m.py * 100}%`;
    el.dataset.color = m.color || '#e74c3c';

    const pin = document.createElement('div');
    pin.className = 'marker-pin';
    pin.style.background = m.color || '#e74c3c';
    pin.innerHTML = `<span>${m.label ? escH(m.label[0].toUpperCase()) : '?'}</span>`;
    el.appendChild(pin);

    if (m.label) {
      const tip = document.createElement('div');
      tip.className = 'marker-tooltip';
      tip.textContent = m.label;
      el.appendChild(tip);
    }
    el.addEventListener('click', e => { e.stopPropagation(); openMarkerModal(m.id); });
    container.appendChild(el);
  });
}

function setupMarkerModal() {
  document.getElementById('marker-close').addEventListener('click', closeMarkerModal);
  document.getElementById('marker-cancel').addEventListener('click', closeMarkerModal);
  document.getElementById('marker-save').addEventListener('click', saveMarker);
  document.getElementById('marker-delete').addEventListener('click', deleteMarker);
  document.getElementById('marker-overlay').addEventListener('click', e => {
    if (e.target.id === 'marker-overlay') closeMarkerModal();
  });
}

function openMarkerModal(id = null, pos = null) {
  editMarkerId     = id;
  pendingMarkerPos = pos;
  const m = id ? (carteDoc?.markers || []).find(x => x.id === id) : null;

  document.getElementById('marker-modal-title').textContent = id ? 'Modifier le marqueur' : 'Nouveau marqueur';
  document.getElementById('marker-label').value = m?.label || '';
  document.getElementById('marker-color').value = m?.color || '#e74c3c';
  document.getElementById('marker-error').textContent = '';
  document.getElementById('marker-delete').classList.toggle('hidden', !id);

  const sel = document.getElementById('marker-wiki');
  sel.innerHTML = '<option value="">— Aucune —</option>' +
    wikiPages.map(p => `<option value="${p.id}"${m?.wiki_id === p.id ? ' selected' : ''}>${escH(p.titre)}</option>`).join('');

  document.getElementById('marker-overlay').classList.remove('hidden');
  document.getElementById('marker-label').focus();
}

function closeMarkerModal() {
  document.getElementById('marker-overlay').classList.add('hidden');
  editMarkerId = null; pendingMarkerPos = null;
}

function saveMarker() {
  const label   = document.getElementById('marker-label').value.trim();
  const color   = document.getElementById('marker-color').value;
  const wiki_id = document.getElementById('marker-wiki').value;
  const errEl   = document.getElementById('marker-error');

  if (!label) { errEl.textContent = 'Le label est requis.'; return; }

  if (!carteDoc) carteDoc = { campagne_id: CAMP_ID, annotations: [], markers: [] };
  carteDoc.markers ??= [];

  if (editMarkerId) {
    const m = carteDoc.markers.find(x => x.id === editMarkerId);
    if (m) Object.assign(m, { label, color, wiki_id: wiki_id || null });
  } else if (pendingMarkerPos) {
    carteDoc.markers.push({
      id: Date.now().toString(),
      px: pendingMarkerPos.px, py: pendingMarkerPos.py,
      label, color, wiki_id: wiki_id || null,
    });
  }
  closeMarkerModal();
  renderMarkers();
  saveCarte();
}

function deleteMarker() {
  if (!editMarkerId || !carteDoc?.markers) return;
  carteDoc.markers = carteDoc.markers.filter(m => m.id !== editMarkerId);
  closeMarkerModal();
  renderMarkers();
  saveCarte();
}

// ── CHRONOLOGIE ──────────────────────────────────────────
const ARC_TYPE_LBL = {
  prelude: '🌅 Prélude', arc: '⚔️ Arc', interlude: '💫 Interlude', epilogue: '🏁 Épilogue',
};
const ARC_STATUT_LBL = {
  planifie: '📋 Planifié', en_cours: '▶️ En cours', termine: '✅ Terminé',
};

function setupChrono() {
  document.getElementById('btn-new-arc').addEventListener('click', () => openArcModal());
}

function renderChrono() {
  const list = document.getElementById('chrono-list');
  if (chronoArcs.length === 0) {
    list.innerHTML = `<div class="camp-empty-state" style="padding:2.5rem 0">
      <div class="camp-empty-icon">📅</div>
      <div class="camp-empty-text">Aucun arc planifié — commencez par en créer un !</div>
    </div>`;
    return;
  }
  list.innerHTML = chronoArcs.map((arc, idx) => {
    const scenarios = (arc.scenarios || []).filter(s => s.titre);
    return `<div class="arc-card arc-card-${arc.statut || 'planifie'}">
      <div class="arc-card-header">
        <div class="arc-card-badges">
          <span class="arc-type-badge">${ARC_TYPE_LBL[arc.type] || arc.type}</span>
          <span class="arc-statut-badge arc-statut-${arc.statut || 'planifie'}">${ARC_STATUT_LBL[arc.statut] || arc.statut}</span>
        </div>
        <div class="arc-card-actions">
          <button class="arc-move btn-ghost btn-sm" data-id="${arc.id}" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="arc-move btn-ghost btn-sm" data-id="${arc.id}" data-dir="1"  ${idx === chronoArcs.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="arc-edit btn-ghost btn-sm" data-id="${arc.id}">✏️</button>
        </div>
      </div>
      <div class="arc-card-titre">${escH(arc.titre)}</div>
      ${arc.description ? `<div class="arc-card-desc">${escH(arc.description)}</div>` : ''}
      ${scenarios.length ? `<div class="arc-scenarios">
        ${scenarios.map(s => `<div class="arc-scenario">
          <span class="arc-s-dot arc-s-${s.statut || 'planifie'}">●</span>
          <span>${escH(s.titre)}</span>
        </div>`).join('')}
      </div>` : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('.arc-edit').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); openArcModal(btn.dataset.id); }));
  list.querySelectorAll('.arc-move').forEach(btn =>
    btn.addEventListener('click', () => moveArc(btn.dataset.id, parseInt(btn.dataset.dir))));
}

async function moveArc(id, dir) {
  const idx    = chronoArcs.findIndex(a => a.id === id);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= chronoArcs.length) return;
  [chronoArcs[idx], chronoArcs[newIdx]] = [chronoArcs[newIdx], chronoArcs[idx]];
  chronoArcs.forEach((a, i) => a.ordre = i);
  renderChrono();
  try {
    await Promise.all([
      updateDoc(doc(db, 'jdr_camp_chrono', chronoArcs[idx].id),    { ordre: idx }),
      updateDoc(doc(db, 'jdr_camp_chrono', chronoArcs[newIdx].id), { ordre: newIdx }),
    ]);
  } catch(e) { /* silent */ }
}

function setupArcModal() {
  document.getElementById('arc-close').addEventListener('click', closeArcModal);
  document.getElementById('arc-cancel').addEventListener('click', closeArcModal);
  document.getElementById('arc-save').addEventListener('click', saveArc);
  document.getElementById('arc-delete').addEventListener('click', deleteArc);
  document.getElementById('btn-add-scenario').addEventListener('click', () => {
    arcScenarios.push({ titre: '', statut: 'planifie' });
    renderArcScenarios();
  });
  document.getElementById('arc-overlay').addEventListener('click', e => {
    if (e.target.id === 'arc-overlay') closeArcModal();
  });
}

function openArcModal(id = null) {
  editArcId = id;
  const arc = id ? chronoArcs.find(a => a.id === id) : null;

  document.getElementById('arc-modal-title').textContent = id ? "Modifier l'arc" : 'Nouvel arc';
  document.getElementById('arc-titre').value  = arc?.titre || '';
  document.getElementById('arc-type').value   = arc?.type  || 'arc';
  document.getElementById('arc-statut').value = arc?.statut || 'planifie';
  document.getElementById('arc-desc').value   = arc?.description || '';
  document.getElementById('arc-error').textContent = '';
  document.getElementById('arc-delete').classList.toggle('hidden', !id);

  arcScenarios = arc?.scenarios ? JSON.parse(JSON.stringify(arc.scenarios)) : [];
  renderArcScenarios();

  document.getElementById('arc-overlay').classList.remove('hidden');
  document.getElementById('arc-titre').focus();
}

function closeArcModal() {
  document.getElementById('arc-overlay').classList.add('hidden');
  editArcId = null; arcScenarios = [];
}

function renderArcScenarios() {
  const list = document.getElementById('arc-scenarios-list');
  list.innerHTML = arcScenarios.map((s, i) => `
    <div class="arc-s-row">
      <input type="text" class="form-input arc-s-input" data-i="${i}"
             value="${escH(s.titre)}" placeholder="Titre du scénario">
      <select class="filter-select arc-s-statut" data-i="${i}" style="width:150px">
        <option value="planifie" ${s.statut==='planifie' ?'selected':''}>📋 Planifié</option>
        <option value="en_cours" ${s.statut==='en_cours' ?'selected':''}>▶️ En cours</option>
        <option value="termine"  ${s.statut==='termine'  ?'selected':''}>✅ Terminé</option>
      </select>
      <button class="arc-s-del btn-ghost btn-sm" data-i="${i}">✕</button>
    </div>`).join('');

  list.querySelectorAll('.arc-s-input').forEach(el =>
    el.addEventListener('input', () => { arcScenarios[+el.dataset.i].titre = el.value; }));
  list.querySelectorAll('.arc-s-statut').forEach(el =>
    el.addEventListener('change', () => { arcScenarios[+el.dataset.i].statut = el.value; }));
  list.querySelectorAll('.arc-s-del').forEach(el =>
    el.addEventListener('click', () => { arcScenarios.splice(+el.dataset.i, 1); renderArcScenarios(); }));
}

async function saveArc() {
  const titre = document.getElementById('arc-titre').value.trim();
  const errEl = document.getElementById('arc-error');
  if (!titre) { errEl.textContent = 'Le titre est requis.'; return; }

  const btn = document.getElementById('arc-save');
  btn.disabled = true;
  try {
    const data = {
      campagne_id: CAMP_ID,
      titre,
      type:        document.getElementById('arc-type').value,
      statut:      document.getElementById('arc-statut').value,
      description: document.getElementById('arc-desc').value.trim(),
      scenarios:   arcScenarios.filter(s => s.titre.trim()),
      ordre:       editArcId ? (chronoArcs.find(a => a.id === editArcId)?.ordre ?? 99) : chronoArcs.length,
      mis_a_jour:  serverTimestamp(),
    };
    if (editArcId) {
      await updateDoc(doc(db, 'jdr_camp_chrono', editArcId), data);
      const i = chronoArcs.findIndex(a => a.id === editArcId);
      if (i >= 0) chronoArcs[i] = { ...chronoArcs[i], ...data };
    } else {
      data.cree_le = serverTimestamp();
      const ref = await addDoc(collection(db, 'jdr_camp_chrono'), data);
      chronoArcs.push({ id: ref.id, ...data });
    }
    closeArcModal();
    renderChrono();
    showToast(editArcId ? 'Arc modifié' : 'Arc créé');
  } catch(e) {
    errEl.textContent = 'Erreur : ' + e.message;
  } finally { btn.disabled = false; }
}

async function deleteArc() {
  if (!editArcId || !confirm('Supprimer cet arc ?')) return;
  try {
    await deleteDoc(doc(db, 'jdr_camp_chrono', editArcId));
    chronoArcs = chronoArcs.filter(a => a.id !== editArcId);
    closeArcModal();
    renderChrono();
    showToast('Arc supprimé');
  } catch(e) { showToast('Erreur : ' + e.message, 'err'); }
}
