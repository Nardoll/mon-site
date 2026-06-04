import { db } from '../firebase-config.js';
import {
  collection, getDocs, doc, getDoc, updateDoc, serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Helpers ──────────────────────────────────────────────
function escH(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'ok') {
  const t = document.getElementById('wp-toast');
  t.textContent = msg;
  t.className = `camp-toast camp-toast-${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

// ── Params URL ───────────────────────────────────────────
const params   = new URLSearchParams(window.location.search);
const CAMP_ID  = params.get('camp');
const DOC_TYPE = params.get('type') || 'wiki';  // 'wiki' | 'quete'
const DOC_ID   = params.get('id');
const COLL     = DOC_TYPE === 'quete' ? 'jdr_camp_quetes' : 'jdr_camp_wiki';

// ── Labels catégories ────────────────────────────────────
const CAT_LABEL = {
  personnage: '👤 Personnage',
  lieu:       '📍 Lieu',
  objet:      '📦 Objet',
  creature:   '🐉 Créature',
  faction:    '⚜️ Faction',
  legende:    '📜 Légende',
  principale:  '⭐ Quête principale',
  secondaire:  '📌 Quête secondaire',
  importante:  '🔑 Quête importante',
};

// Champs rapides par catégorie wiki
const CAT_FIELDS = {
  personnage: [
    { id: 'f_role',    label: 'Rôle',    ph: 'Allié, antagoniste, neutre…' },
    { id: 'f_faction', label: 'Faction', ph: 'Appartenance, allégeance…' },
  ],
  lieu: [
    { id: 'f_type',   label: 'Type de lieu', ph: 'Ville, village, donjon, ruines…' },
    { id: 'f_region', label: 'Région',        ph: 'Zone géographique…' },
  ],
  objet: [
    { id: 'f_type',    label: 'Type',          ph: 'Arme, artefact, relique…' },
    { id: 'f_porteur', label: 'Porteur actuel', ph: 'Qui le détient…' },
  ],
  creature: [
    { id: 'f_type',    label: 'Type',    ph: 'Bête, mort-vivant, démon…' },
    { id: 'f_habitat', label: 'Habitat', ph: 'Où vit-elle…' },
  ],
  faction: [
    { id: 'f_role',     label: 'Rôle',     ph: 'Allié, ennemi, neutre…' },
    { id: 'f_leader',   label: 'Chef',     ph: 'Dirigeant actuel…' },
    { id: 'f_objectif', label: 'Objectif', ph: 'But de la faction…' },
  ],
  legende: [
    { id: 'f_origine',  label: 'Origine',  ph: "D'où vient cette légende…" },
    { id: 'f_veracite', label: 'Véracité', ph: 'Vraie, fausse, partielle…' },
  ],
};

// ── State ────────────────────────────────────────────────
let pageData  = null;
let sections  = [];
let unsaved   = false;
let arcs      = [];
let wikiPages = [];

// ── Init ─────────────────────────────────────────────────
export async function initWikiPage() {
  if (!CAMP_ID || !DOC_ID) {
    document.getElementById('main-content').innerHTML =
      '<p style="padding:2rem;color:var(--muted)">Page introuvable.</p>';
    return;
  }

  try {
    const [campRef, docRef] = await Promise.all([
      getDoc(doc(db, 'jdr_campagnes', CAMP_ID)),
      getDoc(doc(db, COLL, DOC_ID)),
    ]);

    if (!campRef.exists() || !docRef.exists()) {
      document.getElementById('main-content').innerHTML =
        '<p style="padding:2rem;color:var(--muted)">Page introuvable.</p>';
      return;
    }

    const campagne = campRef.data();
    pageData = { id: docRef.id, ...docRef.data() };
    sections = pageData.sections ? JSON.parse(JSON.stringify(pageData.sections)) : [];

    // Breadcrumb
    document.getElementById('wp-back-link').href = `/jdr/campagne.html?id=${CAMP_ID}`;
    document.getElementById('wp-back-label').textContent = campagne.nom || 'Projet';

    // Titre
    const titreInput = document.getElementById('wp-titre');
    titreInput.value = pageData.titre || '';
    document.title = `${pageData.titre || 'Page'} — JDR`;
    titreInput.addEventListener('input', markUnsaved);

    // Badge catégorie
    const cat = DOC_TYPE === 'quete' ? pageData.type_quete : pageData.categorie;
    const badge = document.getElementById('wp-cat-badge');
    badge.textContent = CAT_LABEL[cat] || cat || '—';
    badge.dataset.cat = cat || '';

    // Champs rapides (wiki)
    if (DOC_TYPE === 'wiki') renderQuickInfo();

    // Associations (quêtes)
    if (DOC_TYPE === 'quete') {
      const [arcsSnap, wikiSnap] = await Promise.all([
        getDocs(query(collection(db, 'jdr_camp_chrono'), where('campagne_id', '==', CAMP_ID))),
        getDocs(query(collection(db, 'jdr_camp_wiki'),   where('campagne_id', '==', CAMP_ID))),
      ]);
      arcs = [];
      arcsSnap.forEach(d => arcs.push({ id: d.id, ...d.data() }));
      arcs.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
      wikiPages = [];
      wikiSnap.forEach(d => wikiPages.push({ id: d.id, ...d.data() }));
      renderAssociations();
    }

    // Sections
    renderSections();

    // Boutons
    document.getElementById('wp-save-btn').addEventListener('click', savePage);
    document.getElementById('wp-add-section').addEventListener('click', addSection);

    // Raccourci clavier Ctrl+S
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); savePage(); }
    });

    updateSaveStatus();

  } catch(e) {
    console.error(e);
    showToast('Erreur de chargement', 'err');
  }
}

// ── Champs rapides ───────────────────────────────────────
function renderQuickInfo() {
  const fields = CAT_FIELDS[pageData.categorie] || [];
  if (!fields.length) return;

  const container = document.getElementById('wp-quick-info');
  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="wp-qi-header">Infos rapides</div>
    <div class="wp-qi-grid">
      ${fields.map(f => `
        <div class="wp-qi-row">
          <label class="wp-qi-label">${escH(f.label)}</label>
          <input type="text" class="form-input wp-qi-input" data-field="${f.id}"
                 value="${escH(pageData.fields?.[f.id] || '')}"
                 placeholder="${escH(f.ph || '—')}">
        </div>`).join('')}
    </div>`;

  container.querySelectorAll('.wp-qi-input').forEach(el =>
    el.addEventListener('input', markUnsaved));
}

// ── Associations (quêtes) ────────────────────────────────
function renderAssociations() {
  const container = document.getElementById('wp-associations');
  container.classList.remove('hidden');

  const arcIds  = pageData.arc_ids  || [];
  const lieuIds = pageData.lieu_ids || [];
  const lieux   = wikiPages.filter(p => p.categorie === 'lieu');

  container.innerHTML = `
    <div class="wp-assoc-row">
      <div class="wp-assoc-block">
        <div class="wp-assoc-title">⚔️ Arcs associés</div>
        <div class="wp-assoc-list" id="assoc-arcs">
          ${arcs.length ? arcs.map(a => `
            <label class="wp-assoc-item">
              <input type="checkbox" value="${a.id}" ${arcIds.includes(a.id) ? 'checked' : ''}>
              <span>${escH(a.titre)}</span>
            </label>`).join('') : '<span class="wp-assoc-empty">Aucun arc créé</span>'}
        </div>
      </div>
      <div class="wp-assoc-block">
        <div class="wp-assoc-title">📍 Lieux associés</div>
        <div class="wp-assoc-list" id="assoc-lieux">
          ${lieux.length ? lieux.map(p => `
            <label class="wp-assoc-item">
              <input type="checkbox" value="${p.id}" ${lieuIds.includes(p.id) ? 'checked' : ''}>
              <span>${escH(p.titre)}</span>
            </label>`).join('') : '<span class="wp-assoc-empty">Aucun lieu créé</span>'}
        </div>
      </div>
    </div>`;

  container.querySelectorAll('input[type=checkbox]').forEach(cb =>
    cb.addEventListener('change', markUnsaved));
}

// ── Palette de couleurs de fond ───────────────────────────
const PALETTE = [
  { key: '',       label: 'Aucune',  dot: '' },
  { key: 'green',  label: 'Vert',    dot: 'rgba(78,138,92,.7)' },
  { key: 'yellow', label: 'Jaune',   dot: 'rgba(200,170,0,.75)' },
  { key: 'blue',   label: 'Bleu',    dot: 'rgba(65,130,200,.7)' },
  { key: 'purple', label: 'Violet',  dot: 'rgba(140,90,200,.7)' },
  { key: 'red',    label: 'Rouge',   dot: 'rgba(185,80,80,.7)' },
  { key: 'teal',   label: 'Cyan',    dot: 'rgba(20,184,166,.7)' },
  { key: 'orange', label: 'Orange',  dot: 'rgba(220,120,30,.7)' },
];

function paletteDots(currentColor, i) {
  return PALETTE.map(p => `
    <button class="wp-col-dot${(currentColor || '') === p.key ? ' wp-col-active' : ''}"
            data-color="${p.key}" data-i="${i}" title="${p.label}"
            ${p.dot ? `style="background:${p.dot}"` : 'style="background:none"'}></button>
  `).join('');
}

// ── Sections ─────────────────────────────────────────────
function renderSections() {
  const list = document.getElementById('wp-sections-list');

  if (sections.length === 0) {
    list.innerHTML = `<div class="wp-sections-empty">
      Aucune section pour l'instant — cliquez sur "<strong>+ Ajouter une section</strong>" pour commencer à rédiger.
    </div>`;
    return;
  }

  list.innerHTML = sections.map((s, i) => `
    <div class="wp-section" data-i="${i}"${s.color ? ` data-color="${s.color}"` : ''}>
      <div class="wp-section-bar">
        <input type="text" class="wp-section-title" data-i="${i}"
               value="${escH(s.titre)}" placeholder="Titre de la section (optionnel)">
        <div class="wp-section-palette">${paletteDots(s.color, i)}</div>
        <div class="wp-section-btns">
          <button class="btn-ghost btn-sm wp-sec-up"   data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-ghost btn-sm wp-sec-down" data-i="${i}" ${i === sections.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn-danger btn-sm wp-sec-del" data-i="${i}">🗑️</button>
        </div>
      </div>
      <textarea class="form-input wp-section-body" data-i="${i}"
                rows="6" placeholder="Rédigez ici…" style="resize:vertical">${escH(s.contenu || '')}</textarea>
    </div>`).join('');

  list.querySelectorAll('.wp-section-title').forEach(el =>
    el.addEventListener('input', () => { sections[+el.dataset.i].titre = el.value; markUnsaved(); }));
  list.querySelectorAll('.wp-section-body').forEach(el =>
    el.addEventListener('input', () => { sections[+el.dataset.i].contenu = el.value; markUnsaved(); }));
  list.querySelectorAll('.wp-sec-up').forEach(btn =>
    btn.addEventListener('click', () => moveSection(+btn.dataset.i, -1)));
  list.querySelectorAll('.wp-sec-down').forEach(btn =>
    btn.addEventListener('click', () => moveSection(+btn.dataset.i, 1)));
  list.querySelectorAll('.wp-sec-del').forEach(btn =>
    btn.addEventListener('click', () => { sections.splice(+btn.dataset.i, 1); markUnsaved(); renderSections(); }));

  // Palette : changement de couleur sans re-render complet
  list.querySelectorAll('.wp-col-dot').forEach(btn =>
    btn.addEventListener('click', () => {
      const i     = +btn.dataset.i;
      const color = btn.dataset.color;
      sections[i].color = color;
      markUnsaved();
      // Applique sans re-render
      const sectionEl = btn.closest('.wp-section');
      if (color) sectionEl.dataset.color = color;
      else delete sectionEl.dataset.color;
      sectionEl.querySelectorAll('.wp-col-dot').forEach(b => b.classList.remove('wp-col-active'));
      btn.classList.add('wp-col-active');
    }));
}

function moveSection(i, dir) {
  const ni = i + dir;
  if (ni < 0 || ni >= sections.length) return;
  [sections[i], sections[ni]] = [sections[ni], sections[i]];
  markUnsaved();
  renderSections();
}

function addSection() {
  sections.push({ id: Date.now().toString(), titre: '', contenu: '', color: '' });
  markUnsaved();
  renderSections();
  // Scroll vers la nouvelle section
  document.getElementById('wp-sections-list').lastElementChild
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Focus sur son titre
  setTimeout(() => {
    const inputs = document.querySelectorAll('.wp-section-title');
    inputs[inputs.length - 1]?.focus();
  }, 80);
}

// ── État "non sauvegardé" ────────────────────────────────
function markUnsaved() {
  if (!unsaved) { unsaved = true; updateSaveStatus(); }
}

function updateSaveStatus() {
  const el = document.getElementById('wp-save-status');
  if (unsaved) {
    el.textContent = '● Modifications non sauvegardées';
    el.className = 'wp-save-status wp-unsaved';
  } else {
    el.textContent = '✓ Sauvegardé';
    el.className = 'wp-save-status wp-saved';
  }
}

// ── Sauvegarde ───────────────────────────────────────────
async function savePage() {
  const btn = document.getElementById('wp-save-btn');
  btn.disabled = true;

  try {
    const titre = document.getElementById('wp-titre').value.trim() || pageData.titre || '';
    document.title = `${titre} — JDR`;

    const data = { titre, sections, mis_a_jour: serverTimestamp() };

    // Champs rapides (wiki)
    if (DOC_TYPE === 'wiki') {
      const fields = {};
      document.querySelectorAll('.wp-qi-input').forEach(el => {
        fields[el.dataset.field] = el.value.trim();
      });
      data.fields = fields;
    }

    // Associations (quêtes)
    if (DOC_TYPE === 'quete') {
      data.arc_ids  = [...document.querySelectorAll('#assoc-arcs  input:checked')].map(cb => cb.value);
      data.lieu_ids = [...document.querySelectorAll('#assoc-lieux input:checked')].map(cb => cb.value);
    }

    await updateDoc(doc(db, COLL, DOC_ID), data);
    Object.assign(pageData, data);
    unsaved = false;
    updateSaveStatus();
    showToast('Sauvegardé ✓');
  } catch(e) {
    showToast('Erreur : ' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}
