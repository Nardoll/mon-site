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

let campagne   = null;
let wikiPages  = [];
let carteDoc   = null;
let chronoArcs = [];
let quetes     = [];
let idees      = [];

let devJournal   = [];

let editArcId    = null;
let editMarkerId = null;
let pendingMarkerPos = null;
let pendingQueteArcId = null;

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

    const [wSnap, cSnap, chSnap, qSnap, iSnap, dSnap] = await Promise.all([
      getDocs(query(collection(db, 'jdr_camp_wiki'),        where('campagne_id', '==', CAMP_ID))),
      getDocs(query(collection(db, 'jdr_camp_carte'),       where('campagne_id', '==', CAMP_ID))),
      getDocs(query(collection(db, 'jdr_camp_chrono'),      where('campagne_id', '==', CAMP_ID))),
      getDocs(query(collection(db, 'jdr_camp_quetes'),      where('campagne_id', '==', CAMP_ID))),
      getDocs(query(collection(db, 'jdr_camp_idees'),       where('campagne_id', '==', CAMP_ID))),
      getDocs(query(collection(db, 'jdr_camp_dev_journal'), where('campagne_id', '==', CAMP_ID))),
    ]);

    wikiPages = [];
    wSnap.forEach(d => wikiPages.push({ id: d.id, ...d.data() }));
    wikiPages.sort((a, b) => (a.titre || '').localeCompare(b.titre || ''));

    carteDoc = cSnap.empty ? null : { id: cSnap.docs[0].id, ...cSnap.docs[0].data() };

    chronoArcs = [];
    chSnap.forEach(d => chronoArcs.push({ id: d.id, ...d.data() }));
    chronoArcs.sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99));

    quetes = [];
    qSnap.forEach(d => quetes.push({ id: d.id, ...d.data() }));
    quetes.sort((a, b) => (a.ordre ?? 99) - (b.ordre ?? 99));

    idees = [];
    iSnap.forEach(d => idees.push({ id: d.id, ...d.data() }));
    idees.sort((a, b) => (b.cree_le?.seconds ?? 0) - (a.cree_le?.seconds ?? 0));

    devJournal = [];
    dSnap.forEach(d => devJournal.push({ id: d.id, ...d.data() }));
    devJournal.sort((a, b) => (a.date_str || '').localeCompare(b.date_str || ''));

    setupRenommerProjet();
    setupTabs();
    setupWiki();
    setupCarte();
    setupChrono();
    setupPresentation();
    setupDev();
    setupIdees();
    setupWikiModal();
    setupMapModal();
    setupMarkerModal();
    setupArcModal();
    setupQueteModal();

    renderWiki();
    renderCarte();
    renderChrono();
    renderPresentation();
    renderDev();
    renderIdees();

  } catch(e) {
    console.error(e);
    showToast('Erreur de chargement', 'err');
  }
}

// ── RENOMMER ─────────────────────────────────────────────
function setupRenommerProjet() {
  const display = document.getElementById('camp-nom-display');
  const input   = document.getElementById('camp-nom-input');

  // Emoji
  const emojiDisplay = document.getElementById('camp-emoji-display');
  const emojiInput   = document.getElementById('camp-emoji-input');

  emojiDisplay.addEventListener('click', () => {
    emojiInput.value = campagne.emoji || '';
    emojiDisplay.classList.add('hidden');
    emojiInput.classList.remove('hidden');
    emojiInput.focus();
    emojiInput.select();
  });

  async function confirmEmoji() {
    const nouvel = [...(emojiInput.value.trim())][0] || campagne.emoji || '🎲';
    emojiInput.classList.add('hidden');
    emojiDisplay.classList.remove('hidden');
    if (nouvel === campagne.emoji) return;
    try {
      await updateDoc(doc(db, 'jdr_campagnes', CAMP_ID), { emoji: nouvel });
      campagne.emoji = nouvel;
      emojiDisplay.textContent = nouvel;
      document.title = `${nouvel} ${campagne.nom} — JDR`;
      showToast('Émoji mis à jour ✓');
    } catch(e) {
      emojiDisplay.textContent = campagne.emoji;
      showToast('Erreur : ' + e.message, 'err');
    }
  }

  emojiInput.addEventListener('blur', confirmEmoji);
  emojiInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); emojiInput.blur(); }
    if (e.key === 'Escape') { emojiInput.value = campagne.emoji; emojiInput.blur(); }
  });

  // Nom
  display.addEventListener('click', () => {
    input.value = campagne.nom || '';
    display.classList.add('hidden');
    input.classList.remove('hidden');
    input.focus();
    input.select();
  });

  async function confirmRename() {
    const nouveau = input.value.trim();
    input.classList.add('hidden');
    display.classList.remove('hidden');
    if (!nouveau || nouveau === campagne.nom) return;
    try {
      await updateDoc(doc(db, 'jdr_campagnes', CAMP_ID), { nom: nouveau });
      campagne.nom = nouveau;
      display.textContent = nouveau;
      document.title = `${campagne.emoji || '🎲'} ${nouveau} — JDR`;
      showToast('Projet renommé ✓');
    } catch(e) {
      display.textContent = campagne.nom;
      showToast('Erreur : ' + e.message, 'err');
    }
  }

  input.addEventListener('blur', confirmRename);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = campagne.nom; input.blur(); }
  });
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
      if (btn.dataset.tab === 'dev')   setTimeout(renderDevCharts, 60);
    });
  });
}

// ── WIKI ─────────────────────────────────────────────────
const CAT_LABEL = {
  personnage: '👤 Personnage', lieu: '📍 Lieu',    objet:   '📦 Objet',
  creature:   '🐉 Créature',  faction: '⚜️ Faction', legende: '📜 Légende',
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
    el.addEventListener('click', () => {
      window.location.href = `/jdr/wiki-page.html?camp=${CAMP_ID}&type=wiki&id=${el.dataset.id}`;
    }));
}

function wikiCardHTML(p) {
  // Cherche un résumé dans les sections
  const firstSection = p.sections?.[0]?.contenu || '';
  const preview = firstSection.slice(0, 90).replace(/\n/g, ' ');
  return `<div class="wiki-card" data-id="${p.id}">
    <div class="wiki-card-title">${escH(p.titre)}</div>
    ${preview ? `<div class="wiki-card-preview">${escH(preview)}${firstSection.length > 90 ? '…' : ''}</div>` : ''}
  </div>`;
}

function setupWikiModal() {
  document.getElementById('wiki-close').addEventListener('click', closeWikiModal);
  document.getElementById('wiki-cancel').addEventListener('click', closeWikiModal);
  document.getElementById('wiki-overlay').addEventListener('click', e => {
    if (e.target.id === 'wiki-overlay') closeWikiModal();
  });
  document.getElementById('wiki-save').addEventListener('click', saveNewWikiPage);
}

function openWikiModal() {
  document.getElementById('wiki-titre').value = '';
  document.getElementById('wiki-error').textContent = '';
  document.getElementById('wiki-cat').value = wikiCat || 'personnage';
  document.getElementById('wiki-overlay').classList.remove('hidden');
  document.getElementById('wiki-titre').focus();
}

function closeWikiModal() {
  document.getElementById('wiki-overlay').classList.add('hidden');
}

async function saveNewWikiPage() {
  const titre     = document.getElementById('wiki-titre').value.trim();
  const categorie = document.getElementById('wiki-cat').value;
  const errEl     = document.getElementById('wiki-error');

  if (!titre) { errEl.textContent = 'Le titre est requis.'; return; }

  const btn = document.getElementById('wiki-save');
  btn.disabled = true;
  try {
    const ref = await addDoc(collection(db, 'jdr_camp_wiki'), {
      campagne_id: CAMP_ID, titre, categorie,
      fields: {}, sections: [],
      cree_le: serverTimestamp(), mis_a_jour: serverTimestamp(),
    });
    closeWikiModal();
    window.location.href = `/jdr/wiki-page.html?camp=${CAMP_ID}&type=wiki&id=${ref.id}`;
  } catch(e) {
    errEl.textContent = 'Erreur : ' + e.message;
    btn.disabled = false;
  }
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

function renderCarte() { if (carteDoc?.image_url) showMap(carteDoc.image_url); }

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
  const w = img.offsetWidth, h = img.offsetHeight;
  if (!w || !h) return;
  drawCanvas = document.getElementById('carte-canvas');
  drawCanvas.width = w; drawCanvas.height = h;
  drawCtx = drawCanvas.getContext('2d');
  redrawAnnotations();
}

function redrawAnnotations() {
  if (!drawCtx || !drawCanvas) return;
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  for (const s of (carteDoc?.annotations || [])) {
    if (!s.points?.length) continue;
    drawCtx.beginPath();
    drawCtx.strokeStyle = s.color || '#e74c3c';
    drawCtx.lineWidth   = s.width || 4;
    drawCtx.lineCap = drawCtx.lineJoin = 'round';
    s.points.forEach(({ px, py }, i) => {
      const x = px * drawCanvas.width, y = py * drawCanvas.height;
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
    id: Date.now().toString(), points: [pos],
    color: activeTool === 'erase' ? null : document.getElementById('draw-color').value,
    width: activeTool === 'erase' ? 20 : parseInt(document.getElementById('draw-width').value),
    isErase: activeTool === 'erase',
  };
}

function onCanvasMove(e) {
  if (!isDrawing || !currentStroke) return;
  const prev = currentStroke.points[currentStroke.points.length - 1];
  const pos  = canvasPos(e);
  currentStroke.points.push(pos);
  if (currentStroke.isErase) { eraseAt(pos); return; }
  drawCtx.beginPath();
  drawCtx.strokeStyle = currentStroke.color;
  drawCtx.lineWidth   = currentStroke.width;
  drawCtx.lineCap = drawCtx.lineJoin = 'round';
  drawCtx.moveTo(prev.px * drawCanvas.width, prev.py * drawCanvas.height);
  drawCtx.lineTo(pos.px  * drawCanvas.width, pos.py  * drawCanvas.height);
  drawCtx.stroke();
}

function onCanvasUp() {
  if (!isDrawing) return;
  isDrawing = false;
  if (!currentStroke?.isErase && currentStroke?.points.length > 1) {
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
    !s.points?.some(pt => Math.hypot(pt.px - pos.px, pt.py - pos.py) < T));
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
    if (carteDoc.id) await updateDoc(doc(db, 'jdr_camp_carte', carteDoc.id), data);
    else { const r = await addDoc(collection(db, 'jdr_camp_carte'), data); carteDoc.id = r.id; }
    showToast('Carte sauvegardée ✓');
  } catch(e) { showToast('Erreur : ' + e.message, 'err'); }
  finally { btn.disabled = false; }
}

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
function closeMapModal() { document.getElementById('map-overlay').classList.add('hidden'); }
async function applyMapUrl() {
  const url = document.getElementById('map-url').value.trim();
  if (!url) { document.getElementById('map-error').textContent = 'URL requise.'; return; }
  if (!carteDoc) carteDoc = { campagne_id: CAMP_ID, annotations: [], markers: [] };
  carteDoc.image_url = url;
  closeMapModal(); showMap(url); await saveCarte();
}

function renderMarkers() {
  const container = document.getElementById('carte-markers');
  if (!container) return;
  container.innerHTML = '';
  (carteDoc?.markers || []).forEach(m => {
    const el  = document.createElement('div');
    el.className = 'carte-marker';
    el.style.cssText = `left:${m.px * 100}%;top:${m.py * 100}%`;
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
  editMarkerId = id; pendingMarkerPos = pos;
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
  if (!label) { document.getElementById('marker-error').textContent = 'Label requis.'; return; }
  if (!carteDoc) carteDoc = { campagne_id: CAMP_ID, annotations: [], markers: [] };
  carteDoc.markers ??= [];
  if (editMarkerId) {
    const m = carteDoc.markers.find(x => x.id === editMarkerId);
    if (m) Object.assign(m, { label, color, wiki_id: wiki_id || null });
  } else if (pendingMarkerPos) {
    carteDoc.markers.push({ id: Date.now().toString(), px: pendingMarkerPos.px, py: pendingMarkerPos.py,
      label, color, wiki_id: wiki_id || null });
  }
  closeMarkerModal(); renderMarkers(); saveCarte();
}

function deleteMarker() {
  if (!editMarkerId || !carteDoc?.markers) return;
  carteDoc.markers = carteDoc.markers.filter(m => m.id !== editMarkerId);
  closeMarkerModal(); renderMarkers(); saveCarte();
}

// ── CHRONOLOGIE ──────────────────────────────────────────
const ARC_TYPE_LBL   = { prelude:'🌅 Prélude', arc:'⚔️ Arc', interlude:'💫 Interlude', epilogue:'🏁 Épilogue' };
const ARC_STATUT_LBL = { planifie:'📋 Planifié', en_cours:'▶️ En cours', termine:'✅ Terminé' };
const QUETE_TYPE_LBL = { principale:'⭐ Principale', importante:'🔑 Importante', secondaire:'📌 Secondaire' };

function setupChrono() {
  document.getElementById('btn-new-arc').addEventListener('click', () => openArcModal());
}

function renderChrono() {
  const list = document.getElementById('chrono-list');
  if (chronoArcs.length === 0) {
    list.innerHTML = `<div class="camp-empty-state" style="padding:2.5rem 0">
      <div class="camp-empty-icon">📅</div>
      <div class="camp-empty-text">Aucun arc — commencez par en créer un !</div>
    </div>`;
    return;
  }

  list.innerHTML = chronoArcs.map((arc, idx) => {
    const arcQuetes = quetes.filter(q => (q.arc_ids || []).includes(arc.id));
    return `<div class="arc-card arc-card-${arc.statut || 'planifie'}">
      <div class="arc-card-header">
        <div class="arc-card-badges">
          <span class="arc-type-badge">${ARC_TYPE_LBL[arc.type] || arc.type}</span>
          <span class="arc-statut-badge arc-statut-${arc.statut || 'planifie'}">${ARC_STATUT_LBL[arc.statut] || arc.statut}</span>
        </div>
        <div class="arc-card-actions">
          <button class="arc-move btn-ghost btn-sm" data-id="${arc.id}" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="arc-move btn-ghost btn-sm" data-id="${arc.id}" data-dir="1" ${idx === chronoArcs.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="arc-edit btn-ghost btn-sm" data-id="${arc.id}">✏️</button>
        </div>
      </div>
      <div class="arc-card-titre">${escH(arc.titre)}</div>
      ${arc.description ? `<div class="arc-card-desc">${escH(arc.description)}</div>` : ''}
      ${arcQuetes.length || true ? `
        <div class="arc-quetes">
          ${arcQuetes.map(q => `
            <a href="/jdr/wiki-page.html?camp=${CAMP_ID}&type=quete&id=${q.id}" class="arc-quete-link">
              <span class="quete-type-badge quete-${q.type_quete || 'secondaire'}">${QUETE_TYPE_LBL[q.type_quete] || q.type_quete}</span>
              <span class="arc-quete-titre">${escH(q.titre)}</span>
            </a>`).join('')}
          <button class="arc-add-quete btn-ghost btn-sm" data-arc="${arc.id}">+ Quête</button>
        </div>` : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('.arc-edit').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); openArcModal(btn.dataset.id); }));
  list.querySelectorAll('.arc-move').forEach(btn =>
    btn.addEventListener('click', () => moveArc(btn.dataset.id, parseInt(btn.dataset.dir))));
  list.querySelectorAll('.arc-add-quete').forEach(btn =>
    btn.addEventListener('click', () => openQueteModal(btn.dataset.arc)));
}

async function moveArc(id, dir) {
  const idx = chronoArcs.findIndex(a => a.id === id);
  const ni  = idx + dir;
  if (ni < 0 || ni >= chronoArcs.length) return;
  [chronoArcs[idx], chronoArcs[ni]] = [chronoArcs[ni], chronoArcs[idx]];
  chronoArcs.forEach((a, i) => a.ordre = i);
  renderChrono();
  try {
    await Promise.all([
      updateDoc(doc(db, 'jdr_camp_chrono', chronoArcs[idx].id), { ordre: idx }),
      updateDoc(doc(db, 'jdr_camp_chrono', chronoArcs[ni].id),  { ordre: ni }),
    ]);
  } catch(e) { /* silent */ }
}

function setupArcModal() {
  document.getElementById('arc-close').addEventListener('click', closeArcModal);
  document.getElementById('arc-cancel').addEventListener('click', closeArcModal);
  document.getElementById('arc-save').addEventListener('click', saveArc);
  document.getElementById('arc-delete').addEventListener('click', deleteArc);
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
  document.getElementById('arc-overlay').classList.remove('hidden');
  document.getElementById('arc-titre').focus();
}

function closeArcModal() {
  document.getElementById('arc-overlay').classList.add('hidden');
  editArcId = null;
}

async function saveArc() {
  const titre = document.getElementById('arc-titre').value.trim();
  if (!titre) { document.getElementById('arc-error').textContent = 'Le titre est requis.'; return; }

  const btn = document.getElementById('arc-save');
  btn.disabled = true;
  try {
    const data = {
      campagne_id: CAMP_ID, titre,
      type:        document.getElementById('arc-type').value,
      statut:      document.getElementById('arc-statut').value,
      description: document.getElementById('arc-desc').value.trim(),
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
    closeArcModal(); renderChrono();
    showToast(editArcId ? 'Arc modifié' : 'Arc créé');
  } catch(e) {
    document.getElementById('arc-error').textContent = 'Erreur : ' + e.message;
  } finally { btn.disabled = false; }
}

async function deleteArc() {
  if (!editArcId || !confirm('Supprimer cet arc ?')) return;
  try {
    await deleteDoc(doc(db, 'jdr_camp_chrono', editArcId));
    chronoArcs = chronoArcs.filter(a => a.id !== editArcId);
    closeArcModal(); renderChrono(); showToast('Arc supprimé');
  } catch(e) { showToast('Erreur : ' + e.message, 'err'); }
}

// ── QUÊTES ───────────────────────────────────────────────
function setupQueteModal() {
  document.getElementById('quete-close').addEventListener('click', closeQueteModal);
  document.getElementById('quete-cancel').addEventListener('click', closeQueteModal);
  document.getElementById('quete-save').addEventListener('click', saveNewQuete);
  document.getElementById('quete-overlay').addEventListener('click', e => {
    if (e.target.id === 'quete-overlay') closeQueteModal();
  });
}

function openQueteModal(arcId) {
  pendingQueteArcId = arcId;
  document.getElementById('quete-titre').value = '';
  document.getElementById('quete-type').value  = 'principale';
  document.getElementById('quete-error').textContent = '';
  document.getElementById('quete-overlay').classList.remove('hidden');
  document.getElementById('quete-titre').focus();
}

function closeQueteModal() {
  document.getElementById('quete-overlay').classList.add('hidden');
  pendingQueteArcId = null;
}

async function saveNewQuete() {
  const titre     = document.getElementById('quete-titre').value.trim();
  const type_quete = document.getElementById('quete-type').value;
  if (!titre) { document.getElementById('quete-error').textContent = 'Le titre est requis.'; return; }

  const btn = document.getElementById('quete-save');
  btn.disabled = true;
  try {
    const ref = await addDoc(collection(db, 'jdr_camp_quetes'), {
      campagne_id: CAMP_ID, titre, type_quete,
      arc_ids:  pendingQueteArcId ? [pendingQueteArcId] : [],
      lieu_ids: [], sections: [], statut: 'a_faire',
      ordre: quetes.length,
      cree_le: serverTimestamp(), mis_a_jour: serverTimestamp(),
    });
    closeQueteModal();
    window.location.href = `/jdr/wiki-page.html?camp=${CAMP_ID}&type=quete&id=${ref.id}`;
  } catch(e) {
    document.getElementById('quete-error').textContent = 'Erreur : ' + e.message;
    btn.disabled = false;
  }
}

// ── BOÎTE À IDÉES ────────────────────────────────────────
function setupIdees() {
  document.getElementById('btn-save-idee').addEventListener('click', saveIdee);
  document.getElementById('idee-contenu').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') saveIdee();
  });
}

function renderIdees() {
  const list = document.getElementById('idees-list');
  if (idees.length === 0) {
    list.innerHTML = `<div class="camp-empty-state" style="padding:2rem 0">
      <div class="camp-empty-icon">💡</div>
      <div class="camp-empty-text">Aucune idée pour l'instant.<br>Notez tout ce qui vous passe par la tête !</div>
    </div>`;
    return;
  }
  list.innerHTML = idees.map(idee => {
    const date = idee.cree_le?.toDate
      ? idee.cree_le.toDate().toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' })
      : '';
    const utilisee = !!idee.utilisee;
    return `<div class="idee-card${utilisee ? ' idee-utilisee' : ''}">
      <div class="idee-card-header">
        <label class="idee-check-label" title="${utilisee ? 'Marquer comme non utilisée' : 'Marquer comme utilisée'}">
          <input type="checkbox" class="idee-check" data-id="${idee.id}" ${utilisee ? 'checked' : ''}>
          <span class="idee-check-box">${utilisee ? '✓' : ''}</span>
        </label>
        ${idee.titre ? `<div class="idee-card-titre">${escH(idee.titre)}</div>` : ''}
        <div class="idee-card-meta">${date}</div>
        <button class="idee-delete btn-ghost btn-sm" data-id="${idee.id}" title="Supprimer">🗑️</button>
      </div>
      ${idee.contenu ? `<div class="idee-card-contenu">${escH(idee.contenu)}</div>` : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('.idee-check').forEach(cb =>
    cb.addEventListener('change', () => toggleIdeeUtilisee(cb.dataset.id, cb.checked)));
  list.querySelectorAll('.idee-delete').forEach(btn =>
    btn.addEventListener('click', () => deleteIdee(btn.dataset.id)));
}

async function saveIdee() {
  const titre   = document.getElementById('idee-titre').value.trim();
  const contenu = document.getElementById('idee-contenu').value.trim();
  if (!titre && !contenu) return;

  const btn = document.getElementById('btn-save-idee');
  btn.disabled = true;
  try {
    const ref = await addDoc(collection(db, 'jdr_camp_idees'), {
      campagne_id: CAMP_ID, titre, contenu, cree_le: serverTimestamp(),
    });
    idees.unshift({ id: ref.id, campagne_id: CAMP_ID, titre, contenu,
                    cree_le: { seconds: Date.now() / 1000 } });
    document.getElementById('idee-titre').value   = '';
    document.getElementById('idee-contenu').value = '';
    renderIdees();
    showToast('Idée ajoutée');
  } catch(e) { showToast('Erreur : ' + e.message, 'err'); }
  finally { btn.disabled = false; }
}

async function toggleIdeeUtilisee(id, utilisee) {
  const idee = idees.find(i => i.id === id);
  if (!idee) return;
  idee.utilisee = utilisee;
  const card = document.querySelector(`.idee-check[data-id="${id}"]`)?.closest('.idee-card');
  if (card) {
    card.classList.toggle('idee-utilisee', utilisee);
    const box = card.querySelector('.idee-check-box');
    if (box) box.textContent = utilisee ? '✓' : '';
    const label = card.querySelector('.idee-check-label');
    if (label) label.title = utilisee ? 'Marquer comme non utilisée' : 'Marquer comme utilisée';
  }
  try {
    await updateDoc(doc(db, 'jdr_camp_idees', id), { utilisee });
  } catch(e) { showToast('Erreur : ' + e.message, 'err'); }
}

async function deleteIdee(id) {
  if (!confirm('Supprimer cette idée ?')) return;
  try {
    await deleteDoc(doc(db, 'jdr_camp_idees', id));
    idees = idees.filter(i => i.id !== id);
    renderIdees();
  } catch(e) { showToast('Erreur : ' + e.message, 'err'); }
}

// ── DÉVELOPPEMENT ────────────────────────────────────────

let _devChartDaily = null;
let _devChartCumul = null;

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function totalWordsInProject() {
  let total = 0;
  const addSections = secs => (secs || []).forEach(s => {
    total += countWords(s.contenu) + countWords(s.titre);
  });
  wikiPages.forEach(p => {
    addSections(p.sections);
    Object.values(p.fields || {}).forEach(v => total += countWords(v));
  });
  quetes.forEach(q => addSections(q.sections));
  addSections(presSections);
  return total;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function setupDev() {
  const objInput = document.getElementById('dev-objectif-input');
  objInput.value = campagne.objectif_mots_par_jour || 500;
  let objTimer;
  objInput.addEventListener('input', () => {
    clearTimeout(objTimer);
    objTimer = setTimeout(async () => {
      const val = parseInt(objInput.value) || 500;
      try {
        await updateDoc(doc(db, 'jdr_campagnes', CAMP_ID), { objectif_mots_par_jour: val });
        campagne.objectif_mots_par_jour = val;
        renderDevCharts();
      } catch(e) { /* silent */ }
    }, 800);
  });
}

async function snapshotToday() {
  const dateStr   = todayStr();
  const totalMots = totalWordsInProject();
  const existing  = devJournal.find(e => e.date_str === dateStr);

  try {
    if (existing) {
      if (existing.mots_total === totalMots) return; // rien de changé
      await updateDoc(doc(db, 'jdr_camp_dev_journal', existing.id), { mots_total: totalMots });
      existing.mots_total = totalMots;
    } else {
      const ref = await addDoc(collection(db, 'jdr_camp_dev_journal'), {
        campagne_id: CAMP_ID, date_str: dateStr, mots_total: totalMots, cree_le: serverTimestamp(),
      });
      devJournal.push({ id: ref.id, campagne_id: CAMP_ID, date_str: dateStr, mots_total: totalMots });
      devJournal.sort((a, b) => a.date_str.localeCompare(b.date_str));
    }
  } catch(e) { /* silent — pas bloquant */ }
}

function getDelta(dateStr) {
  const idx  = devJournal.findIndex(e => e.date_str === dateStr);
  if (idx < 0) return null;
  const curr = devJournal[idx].mots_total ?? 0;
  const prev = idx > 0 ? (devJournal[idx - 1].mots_total ?? 0) : 0;
  return Math.max(0, curr - prev);
}

function renderDev() {
  const totalMots = totalWordsInProject();
  const pages     = Math.round(totalMots / 250);
  const delta     = getDelta(todayStr());

  document.getElementById('dev-kpi-mots').textContent  = totalMots.toLocaleString('fr-FR');
  document.getElementById('dev-kpi-pages').textContent = pages || '—';
  document.getElementById('dev-kpi-delta').textContent = delta !== null
    ? (delta > 0 ? '+' + delta.toLocaleString('fr-FR') : '0')
    : '—';

  // Titre aujourd'hui
  const today = new Date();
  document.getElementById('dev-today-title').textContent =
    'Aujourd\'hui — ' + today.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });

  // Message delta
  const objectif = parseInt(document.getElementById('dev-objectif-input').value) || 500;
  const deltaEl  = document.getElementById('dev-today-delta');
  const statusEl = document.getElementById('dev-today-status');

  if (delta === null || (delta === 0 && devJournal.length === 0)) {
    deltaEl.textContent  = 'Aucune donnée pour aujourd\'hui.';
    statusEl.textContent = 'Écris quelque chose et reviens ici — le delta se calculera automatiquement.';
    statusEl.className   = 'dev-today-status dev-status-neutral';
  } else {
    deltaEl.innerHTML = `<span class="dev-delta-num">+${delta.toLocaleString('fr-FR')}</span> mots écrits aujourd'hui`;
    if (delta >= objectif) {
      statusEl.textContent = '🎯 Objectif atteint !';
      statusEl.className   = 'dev-today-status dev-status-ok';
    } else if (delta > 0) {
      const manquants = objectif - delta;
      statusEl.textContent = `${manquants.toLocaleString('fr-FR')} mots pour atteindre l'objectif`;
      statusEl.className   = 'dev-today-status dev-status-progress';
    } else {
      statusEl.textContent = `Objectif du jour : ${objectif.toLocaleString('fr-FR')} mots`;
      statusEl.className   = 'dev-today-status dev-status-neutral';
    }
  }

  renderDevCharts();

  // Snapshot silencieux
  snapshotToday();
}

function renderDevCharts() {
  if (typeof Chart === 'undefined') return;

  const objectif = parseInt(document.getElementById('dev-objectif-input').value) || 500;

  // 30 derniers jours
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const labels = days.map(d => {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  });

  // Deltas quotidiens
  const dailyDeltas = days.map(d => getDelta(d) ?? 0);

  const accent    = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4e8a5c';
  const accentDim = accent + '55';
  const barColors = dailyDeltas.map(v => v >= objectif ? accent : accentDim);

  const scaleOpts = {
    x: { ticks: { color: '#888', font: { size: 11 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,.05)' } },
    y: { ticks: { color: '#888', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,.07)' }, beginAtZero: true },
  };

  // ── Bar chart deltas ──
  if (_devChartDaily) _devChartDaily.destroy();
  _devChartDaily = new Chart(document.getElementById('dev-chart-daily'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Mots/jour', data: dailyDeltas, backgroundColor: barColors, borderRadius: 4, borderSkipped: false },
        { label: 'Objectif', data: days.map(() => objectif), type: 'line',
          borderColor: '#e05555', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx =>
        ctx.datasetIndex === 1
          ? ` Objectif : ${objectif.toLocaleString('fr-FR')} mots`
          : ` +${ctx.parsed.y.toLocaleString('fr-FR')} mots`,
      }}},
      scales: scaleOpts,
    },
  });

  // ── Line chart total cumulé (snapshots réels) ──
  const snapDays  = devJournal.map(e => e.date_str);
  const snapVals  = devJournal.map(e => e.mots_total ?? 0);
  const snapLabels = snapDays.map(d => {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  });

  if (_devChartCumul) _devChartCumul.destroy();

  if (snapVals.length === 0) {
    document.getElementById('dev-chart-cumul').getContext('2d').clearRect(0, 0, 9999, 9999);
    _devChartCumul = null;
    return;
  }

  _devChartCumul = new Chart(document.getElementById('dev-chart-cumul'), {
    type: 'line',
    data: {
      labels: snapLabels,
      datasets: [{
        label: 'Total mots',
        data: snapVals,
        borderColor: accent,
        backgroundColor: accent + '22',
        borderWidth: 2,
        pointRadius: snapVals.length < 20 ? 4 : 2,
        pointBackgroundColor: accent,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => ` ${ctx.parsed.y.toLocaleString('fr-FR')} mots au total`,
      }}},
      scales: scaleOpts,
    },
  });
}

// ── PRÉSENTATION GÉNÉRALE ────────────────────────────────

const PRES_PALETTE = [
  { key: '',       label: 'Aucune',  dot: '' },
  { key: 'green',  label: 'Vert',    dot: 'rgba(78,138,92,.7)' },
  { key: 'yellow', label: 'Jaune',   dot: 'rgba(200,170,0,.75)' },
  { key: 'blue',   label: 'Bleu',    dot: 'rgba(65,130,200,.7)' },
  { key: 'purple', label: 'Violet',  dot: 'rgba(140,90,200,.7)' },
  { key: 'red',    label: 'Rouge',   dot: 'rgba(185,80,80,.7)' },
  { key: 'teal',   label: 'Cyan',    dot: 'rgba(20,184,166,.7)' },
  { key: 'orange', label: 'Orange',  dot: 'rgba(220,120,30,.7)' },
];

let presSections     = [];
let presUnsaved      = false;
let presEditingSections = new Set();

function setupPresentation() {
  presSections = campagne.sections_presentation
    ? JSON.parse(JSON.stringify(campagne.sections_presentation))
    : [];
  document.getElementById('pres-save-btn').addEventListener('click', savePresentation);
  document.getElementById('pres-add-section').addEventListener('click', presAddSection);
  updatePresSaveStatus();
}

// ── Rendu sections ────────────────────────────────────────
function renderPresentation() {
  renderPresSections();
  renderPresBilan();
}

function renderPresSections() {
  const list = document.getElementById('pres-sections-list');

  if (presSections.length === 0) {
    list.innerHTML = `<div class="wp-sections-empty">
      Aucune section — cliquez sur "<strong>+ Ajouter une section</strong>" pour commencer à rédiger le pitch de votre campagne.
    </div>`;
    return;
  }

  list.innerHTML = presSections.map((s, i) =>
    presEditingSections.has(i) ? presBuiltSectionEdit(s, i) : presBuiltSectionView(s, i)
  ).join('');

  // Mode lecture — bouton Modifier
  list.querySelectorAll('.wp-sec-edit-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      presEditingSections.add(+btn.dataset.i);
      renderPresSections();
      setTimeout(() => {
        const ta = list.querySelector(`.wp-section-body[data-i="${btn.dataset.i}"]`);
        if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      }, 40);
    }));

  // Titre + contenu
  list.querySelectorAll('.wp-section-title').forEach(el =>
    el.addEventListener('input', () => { presSections[+el.dataset.i].titre = el.value; presMarkUnsaved(); }));
  list.querySelectorAll('.wp-section-body').forEach(el =>
    el.addEventListener('input', () => { presSections[+el.dataset.i].contenu = el.value; presMarkUnsaved(); }));

  // Valider
  list.querySelectorAll('.wp-sec-validate').forEach(btn =>
    btn.addEventListener('click', () => presValidateSection(+btn.dataset.i)));

  // ↑ ↓ 🗑️
  list.querySelectorAll('.wp-sec-up').forEach(btn =>
    btn.addEventListener('click', () => presMoveSection(+btn.dataset.i, -1)));
  list.querySelectorAll('.wp-sec-down').forEach(btn =>
    btn.addEventListener('click', () => presMoveSection(+btn.dataset.i, 1)));
  list.querySelectorAll('.wp-sec-del').forEach(btn =>
    btn.addEventListener('click', () => {
      const i = +btn.dataset.i;
      presEditingSections.delete(i);
      const rebuilt = new Set();
      presEditingSections.forEach(idx => { rebuilt.add(idx > i ? idx - 1 : idx); });
      presEditingSections = rebuilt;
      presSections.splice(i, 1);
      presMarkUnsaved();
      renderPresSections();
    }));

  // Palette couleur
  list.querySelectorAll('.wp-col-dot').forEach(btn =>
    btn.addEventListener('click', () => {
      const i = +btn.dataset.i, color = btn.dataset.color;
      presSections[i].color = color;
      presMarkUnsaved();
      const el = btn.closest('.wp-section');
      if (color) el.dataset.color = color; else delete el.dataset.color;
      el.querySelectorAll('.wp-col-dot').forEach(b => b.classList.remove('wp-col-active'));
      btn.classList.add('wp-col-active');
    }));
}

function presBuiltSectionView(s, i) {
  const attr = s.color ? ` data-color="${s.color}"` : '';
  return `<div class="wp-section wp-section-view" data-i="${i}"${attr}>
    <button class="wp-sec-edit-btn" data-i="${i}" title="Modifier cette section">✏️ Modifier</button>
    ${s.titre ? `<div class="wp-section-view-title">${escH(s.titre)}</div>` : ''}
    <div class="wp-section-view-content">${s.contenu
      ? escH(s.contenu)
      : '<span class="wp-view-empty">Section vide — survolez pour modifier</span>'
    }</div>
  </div>`;
}

function presBuiltSectionEdit(s, i) {
  const attr = s.color ? ` data-color="${s.color}"` : '';
  const dots = PRES_PALETTE.map(p => `
    <button class="wp-col-dot${(s.color || '') === p.key ? ' wp-col-active' : ''}"
            data-color="${p.key}" data-i="${i}" title="${p.label}"
            ${p.dot ? `style="background:${p.dot}"` : 'style="background:none"'}></button>
  `).join('');
  return `<div class="wp-section wp-section-edit" data-i="${i}"${attr}>
    <div class="wp-section-bar">
      <input type="text" class="wp-section-title" data-i="${i}"
             value="${escH(s.titre)}" placeholder="Titre de la section (optionnel)">
      <div class="wp-section-palette">${dots}</div>
      <div class="wp-section-btns">
        <button class="btn-ghost btn-sm wp-sec-up"       data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-ghost btn-sm wp-sec-down"     data-i="${i}" ${i === presSections.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn-danger btn-sm wp-sec-del"     data-i="${i}">🗑️</button>
        <button class="btn-primary btn-sm wp-sec-validate" data-i="${i}">✓ Valider</button>
      </div>
    </div>
    <textarea class="form-input wp-section-body" data-i="${i}"
              rows="6" placeholder="Rédigez ici…" style="resize:vertical">${escH(s.contenu || '')}</textarea>
  </div>`;
}

function presValidateSection(i) {
  const titleEl = document.querySelector(`#pres-sections-list .wp-section-title[data-i="${i}"]`);
  const bodyEl  = document.querySelector(`#pres-sections-list .wp-section-body[data-i="${i}"]`);
  if (titleEl) presSections[i].titre   = titleEl.value;
  if (bodyEl)  presSections[i].contenu = bodyEl.value;
  presEditingSections.delete(i);
  renderPresSections();
  savePresentation();
}

function presMoveSection(i, dir) {
  const ni = i + dir;
  if (ni < 0 || ni >= presSections.length) return;
  [presSections[i], presSections[ni]] = [presSections[ni], presSections[i]];
  const iEd = presEditingSections.has(i), niEd = presEditingSections.has(ni);
  if (iEd)  presEditingSections.add(ni); else presEditingSections.delete(ni);
  if (niEd) presEditingSections.add(i);  else presEditingSections.delete(i);
  presMarkUnsaved();
  renderPresSections();
}

function presAddSection() {
  const newIdx = presSections.length;
  presSections.push({ id: Date.now().toString(), titre: '', contenu: '', color: '' });
  presEditingSections.add(newIdx);
  presMarkUnsaved();
  renderPresSections();
  setTimeout(() => {
    const list = document.getElementById('pres-sections-list');
    list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    list.querySelector(`.wp-section-body[data-i="${newIdx}"]`)?.focus();
  }, 60);
}

function presMarkUnsaved() {
  if (!presUnsaved) { presUnsaved = true; updatePresSaveStatus(); }
}

function updatePresSaveStatus() {
  const el = document.getElementById('pres-save-status');
  if (!el) return;
  if (presUnsaved) {
    el.textContent = '● Modifications non sauvegardées';
    el.className = 'wp-save-status wp-unsaved';
  } else {
    el.textContent = '✓ Sauvegardé';
    el.className = 'wp-save-status wp-saved';
  }
}

async function savePresentation() {
  const btn = document.getElementById('pres-save-btn');
  btn.disabled = true;
  try {
    await updateDoc(doc(db, 'jdr_campagnes', CAMP_ID), {
      sections_presentation: presSections,
      mis_a_jour: serverTimestamp(),
    });
    campagne.sections_presentation = JSON.parse(JSON.stringify(presSections));
    presUnsaved = false;
    updatePresSaveStatus();
    showToast('Sauvegardé ✓');
  } catch(e) {
    showToast('Erreur : ' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

// ── Bilan automatique des quêtes principales ─────────────
function renderPresBilan() {
  const container = document.getElementById('pres-bilan');

  const principales = quetes.filter(q => q.type_quete === 'principale');

  if (principales.length === 0) {
    container.innerHTML = `<div class="pres-bilan-empty">
      Aucune quête principale pour l'instant.<br>
      Créez des quêtes de type <strong>⭐ Principale</strong> dans l'onglet Chronologie pour les voir apparaître ici.
    </div>`;
    return;
  }

  // Groupe par arc (dans l'ordre des arcs), puis sans arc
  const rows = [];

  chronoArcs.forEach(arc => {
    const arcQ = principales.filter(q => (q.arc_ids || []).includes(arc.id));
    if (arcQ.length === 0) return;
    rows.push({ arc, quetes: arcQ });
  });

  const sansArc = principales.filter(q => !q.arc_ids?.length ||
    !q.arc_ids.some(aid => chronoArcs.find(a => a.id === aid)));
  if (sansArc.length) rows.push({ arc: null, quetes: sansArc });

  container.innerHTML = rows.map(({ arc, quetes: qs }) => `
    <div class="pres-bilan-arc">
      <div class="pres-bilan-arc-title">
        ${arc
          ? `<span class="arc-type-badge">${ARC_TYPE_LBL[arc.type] || arc.type}</span>
             <span>${escH(arc.titre)}</span>`
          : '<span class="pres-bilan-no-arc">Sans arc</span>'
        }
      </div>
      <div class="pres-bilan-quetes">
        ${qs.map(q => `
          <a href="/jdr/wiki-page.html?camp=${CAMP_ID}&type=quete&id=${q.id}"
             class="pres-bilan-quete">
            <span class="pres-bilan-quete-icon">⭐</span>
            <span class="pres-bilan-quete-titre">${escH(q.titre)}</span>
            <span class="pres-bilan-quete-arrow">→</span>
          </a>`).join('')}
      </div>
    </div>`).join('');
}
