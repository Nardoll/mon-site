import { db } from '../firebase-config.js';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Constantes ─────────────────────────────────────────
const COLL = 'jdr_projets';

const PRESETS = {
  type:         ['Campagne', 'Mini Campagne', 'One shot'],
  avancement:   ['Idée', 'En préparation', 'Prêt', 'En cours', 'Arrêté', 'Terminé'],
  createur:     ['Tom/Nardoll', 'Thomas Laversin', 'FibreTigre', 'Simon Stålenhag'],
  emplacement:  ['PDF', 'Livre', 'Notion', 'Drive', 'LegendKeeper', 'Obsidian', 'Canva', 'Word'],
  systeme:      ['Custom', '2d6+bullshit', 'Aria', 'Mundaris', 'Appel de Cthulhu', '2d6 + 10 comp.', '2d6 + 8 comp.', 'Tales from the loop', 'Cthulhu Simplified', 'Aucun'],
  univers:      [],
  participants: [],
};

const AVANC_COLOR = {
  'Idée':           '#5a5a6a',
  'En préparation': '#4a6fa5',
  'Prêt':           '#2d7d9a',
  'En cours':       '#c87a00',
  'Arrêté':         '#8b3535',
  'Terminé':        '#3a6e48',
};

// ── État ───────────────────────────────────────────────
let allProjets = [];
let discovered = {};
let currentSort  = { field: 'cree_le', dir: 'desc' };
let filterSearch = '';
let filterAvancement = '';
let filterType   = '';
let currentView  = 'cards';
let editId       = null;
let currentDetailId = null;
let formDates    = [];
let msRefs       = {};

// ── Utilitaires ────────────────────────────────────────
function escH(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tsToStr(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tsToInput(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateInputToTs(val) {
  if (!val) return null;
  const [y, m, d] = val.split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d));
}

function starsHTML(n) {
  let h = '';
  for (let i = 1; i <= 5; i++) h += `<span class="star${i <= n ? ' filled' : ''}">★</span>`;
  return h;
}

// ── Firestore ──────────────────────────────────────────
async function getProjets() {
  const snap = await getDocs(collection(db, COLL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function saveProjet(id, data) {
  if (id) {
    await updateDoc(doc(db, COLL, id), { ...data, mis_a_jour: serverTimestamp() });
  } else {
    await addDoc(collection(db, COLL), { ...data, cree_le: serverTimestamp(), mis_a_jour: serverTimestamp() });
  }
}

async function removeProjet(id) {
  await deleteDoc(doc(db, COLL, id));
}

// ── Options découvertes depuis la base ─────────────────
function updateDiscovered() {
  const fields = ['type', 'avancement', 'createur', 'emplacement', 'systeme', 'univers', 'participants'];
  for (const f of fields) {
    const fromDB = allProjets.flatMap(p => p[f] || []);
    discovered[f] = [...new Set([...(PRESETS[f] || []), ...fromDB])];
  }
}

// ── Init ───────────────────────────────────────────────
export async function initArchives() {
  setupListeners();
  await loadData();
}

async function loadData() {
  allProjets = await getProjets();
  updateDiscovered();
  render();
}

// ── Listeners ──────────────────────────────────────────
function setupListeners() {
  document.getElementById('filter-search').addEventListener('input', e => {
    filterSearch = e.target.value.toLowerCase();
    render();
  });
  document.getElementById('filter-avancement').addEventListener('change', e => {
    filterAvancement = e.target.value;
    render();
  });
  document.getElementById('filter-type').addEventListener('change', e => {
    filterType = e.target.value;
    render();
  });
  document.getElementById('sort-select').addEventListener('change', e => {
    const [field, dir] = e.target.value.split(':');
    currentSort = { field, dir };
    render();
  });

  document.getElementById('btn-view-cards').addEventListener('click', () => switchView('cards'));
  document.getElementById('btn-view-table').addEventListener('click', () => switchView('table'));
  document.getElementById('btn-add').addEventListener('click', () => openForm(null));

  document.getElementById('detail-overlay').addEventListener('click', e => {
    if (e.target.id === 'detail-overlay') closeDetail();
  });
  document.getElementById('form-overlay').addEventListener('click', e => {
    if (e.target.id === 'form-overlay') closeForm();
  });

  document.getElementById('view-table').querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.field;
      const dir = currentSort.field === field && currentSort.dir === 'asc' ? 'desc' : 'asc';
      currentSort = { field, dir };
      render();
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.cell-pop.open').forEach(p => p.classList.remove('open'));
  });
}

function switchView(view) {
  currentView = view;
  document.getElementById('btn-view-cards').classList.toggle('active', view === 'cards');
  document.getElementById('btn-view-table').classList.toggle('active', view === 'table');
  document.getElementById('view-cards').classList.toggle('hidden', view !== 'cards');
  document.getElementById('view-table').classList.toggle('hidden', view !== 'table');
  render();
}

// ── Filtres & tri ──────────────────────────────────────
function filteredSorted() {
  let list = [...allProjets];

  if (filterSearch) {
    const q = filterSearch;
    list = list.filter(p => {
      const tokens = [
        p.nom,
        ...(p.type || []),
        ...(p.avancement || []),
        ...(p.createur || []),
        ...(p.univers || []),
        ...(p.systeme || []),
        ...(p.emplacement || []),
        ...(p.participants || []),
        p.irl    ? 'irl'    : '',
        p.irl    ? 'présentiel' : '',
        p.online ? 'online' : '',
        p.nb_seances_mj != null ? String(p.nb_seances_mj) : '',
        ...(p.dates_seances || []).map(ts => tsToStr(ts)),
        p.commentaires,
      ];
      return tokens.some(t => (t || '').toLowerCase().includes(q));
    });
  }
  if (filterAvancement) list = list.filter(p => (p.avancement || []).includes(filterAvancement));
  if (filterType) list = list.filter(p => (p.type || []).includes(filterType));

  const { field, dir } = currentSort;
  list.sort((a, b) => {
    let va = a[field], vb = b[field];
    if (field === 'nom') { va = (va || '').toLowerCase(); vb = (vb || '').toLowerCase(); }
    else if (field === 'date_debut' || field === 'cree_le') { va = va?.seconds || 0; vb = vb?.seconds || 0; }
    else if (field === 'satisfaction') { va = va ?? -1; vb = vb ?? -1; }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return list;
}

// ── Rendu ──────────────────────────────────────────────
function render() {
  const list = filteredSorted();
  document.getElementById('proj-count').textContent = `${list.length} projet${list.length !== 1 ? 's' : ''}`;
  if (currentView === 'cards') renderCards(list);
  else renderTable(list);
}

function renderCards(list) {
  const grid = document.getElementById('view-cards');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎲</div><p>Aucun projet ne correspond aux filtres.</p></div>`;
    return;
  }
  grid.innerHTML = list.map(projCardHTML).join('');
  grid.querySelectorAll('.proj-card').forEach(el =>
    el.addEventListener('click', () => openDetail(el.dataset.id))
  );
}

function projCardHTML(p) {
  const avancBadges = (p.avancement || []).map(a =>
    `<span class="badge-avanc" style="background:${AVANC_COLOR[a] || '#5a5a6a'}">${escH(a)}</span>`
  ).join('');
  const typeBadges = (p.type || []).map(t => `<span class="badge-type">${escH(t)}</span>`).join('');
  const ytBadge = p.youtube ? `<span class="badge-yt">▶ YT</span>` : '';
  const stars = p.deja_joue && p.satisfaction != null && p.satisfaction > 0
    ? `<div class="proj-card-stars">${starsHTML(p.satisfaction)}</div>` : '';
  const createurs = (p.createur || []).join(', ');
  const univers = (p.univers || []).join(', ');

  return `
    <div class="proj-card" data-id="${escH(p.id)}">
      <div class="proj-card-top">${avancBadges}${ytBadge}</div>
      <div class="proj-card-title">${escH(p.nom || 'Sans titre')}</div>
      ${typeBadges ? `<div class="proj-card-types">${typeBadges}</div>` : ''}
      ${createurs ? `<div class="proj-card-meta">👤 ${escH(createurs)}</div>` : ''}
      ${univers ? `<div class="proj-card-meta">🌍 ${escH(univers)}</div>` : ''}
      ${stars}
    </div>`;
}

function datesCell(p) {
  const dates = (p.dates_seances || []).map(ts => tsToStr(ts)).filter(Boolean);
  if (!dates.length) return '—';
  if (dates.length === 1) return escH(dates[0]);
  const rest = dates.slice(1);
  return `<span class="cell-expand" data-list="${escH(JSON.stringify(rest))}">${escH(dates[0])}<span class="cell-more"> +${rest.length}</span></span>`;
}

function participantsCell(p) {
  const parts = p.participants || [];
  if (!parts.length) return '—';
  const MAX = 2;
  if (parts.length <= MAX) return escH(parts.join(', '));
  const shown = parts.slice(0, MAX).join(', ');
  return `<span class="cell-expand" data-list="${escH(JSON.stringify(parts))}">${escH(shown)}<span class="cell-more">…</span></span>`;
}

function renderTable(list) {
  const tbody = document.getElementById('table-body');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-empty">Aucun projet</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => {
    const fmt = [p.irl && 'IRL', p.online && 'Online'].filter(Boolean).join('+') || '—';
    return `
    <tr class="table-row" data-id="${escH(p.id)}">
      <td class="td-nom">${escH(p.nom || '—')}</td>
      <td>${(p.type||[]).map(t=>`<span class="badge-type">${escH(t)}</span>`).join(' ') || '—'}</td>
      <td>${(p.avancement||[]).map(a=>`<span class="badge-avanc" style="background:${AVANC_COLOR[a]||'#5a5a6a'}">${escH(a)}</span>`).join(' ') || '—'}</td>
      <td>${escH((p.createur||[]).join(', ')) || '—'}</td>
      <td>${escH((p.univers||[]).join(', ')) || '—'}</td>
      <td class="td-c">${p.deja_joue && p.nb_seances_mj != null ? p.nb_seances_mj : '—'}</td>
      <td class="td-c">${p.deja_joue ? fmt : '—'}</td>
      <td>${p.deja_joue ? participantsCell(p) : '—'}</td>
      <td>${p.deja_joue ? datesCell(p) : '—'}</td>
      <td class="td-c">${p.youtube ? '▶' : '—'}</td>
      <td class="td-c">${p.deja_joue && p.satisfaction ? starsHTML(p.satisfaction) : '—'}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.table-row').forEach(row =>
    row.addEventListener('click', () => openDetail(row.dataset.id))
  );

  tbody.querySelectorAll('.cell-expand').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelectorAll('.cell-pop.open').forEach(p => { if (p.parentElement !== el) p.classList.remove('open'); });
      let pop = el.querySelector('.cell-pop');
      if (!pop) {
        const data = JSON.parse(el.dataset.list || '[]');
        pop = document.createElement('div');
        pop.className = 'cell-pop';
        pop.innerHTML = data.map(s => `<div class="cell-pop-item">${escH(s)}</div>`).join('');
        el.appendChild(pop);
      }
      pop.classList.toggle('open');
    });
  });
}

// ── Modal détail ───────────────────────────────────────
function openDetail(id) {
  currentDetailId = id;
  const p = allProjets.find(x => x.id === id);
  if (!p) return;

  document.getElementById('detail-title').textContent = p.nom || 'Sans titre';
  document.getElementById('detail-body').innerHTML = detailHTML(p);
  document.getElementById('detail-close-btn').onclick = closeDetail;
  document.getElementById('detail-edit-btn').onclick = () => { closeDetail(); openForm(id); };
  document.getElementById('detail-overlay').classList.remove('hidden');
}

function closeDetail() {
  document.getElementById('detail-overlay').classList.add('hidden');
  currentDetailId = null;
}

function detailHTML(p) {
  function row(label, val) {
    if (!val && val !== 0) return '';
    return `<div class="detail-row"><span class="detail-label">${escH(label)}</span><span class="detail-val">${val}</span></div>`;
  }
  function chips(arr) {
    return (arr || []).length ? (arr).map(a => `<span class="badge-type">${escH(a)}</span>`).join(' ') : '—';
  }
  function avancChips(arr) {
    return (arr || []).length ? (arr).map(a => `<span class="badge-avanc" style="background:${AVANC_COLOR[a]||'#5a5a6a'}">${escH(a)}</span>`).join(' ') : '—';
  }

  let html = `<div class="detail-section"><div class="detail-section-title">Infos générales</div>`;
  html += row('Type', chips(p.type));
  html += row('Avancement', avancChips(p.avancement));
  html += row('Date de début', tsToStr(p.date_debut));
  html += row('Créateur', chips(p.createur));
  html += row('Système de jeu', chips(p.systeme));
  html += row('Univers', chips(p.univers));
  html += row('Emplacement', chips(p.emplacement));
  if (p.youtube) html += row('YouTube', '▶ Session enregistrée');
  html += `</div>`;

  if (p.deja_joue) {
    html += `<div class="detail-section"><div class="detail-section-title">Partie jouée</div>`;
    if (p.satisfaction != null && p.satisfaction > 0)
      html += row('Satisfaction', starsHTML(p.satisfaction));
    if (p.nb_seances_mj != null) html += row('Séances (MJ)', escH(String(p.nb_seances_mj)));
    if (p.nb_seances_joueurs != null) html += row('Séances (joueurs)', escH(String(p.nb_seances_joueurs)));
    html += row('Participants', chips(p.participants));
    const fmt = [p.irl && 'IRL', p.online && 'Online'].filter(Boolean).join(' + ');
    if (fmt) html += row('Format', escH(fmt));
    if ((p.dates_seances || []).length) {
      html += row('Dates des séances', p.dates_seances.map(d => tsToStr(d)).join('<br>'));
    }
    html += `</div>`;
  }

  if (p.commentaires) {
    html += `<div class="detail-section"><div class="detail-section-title">Commentaires</div>`;
    html += `<p style="white-space:pre-wrap;margin:0;line-height:1.6">${escH(p.commentaires)}</p>`;
    html += `</div>`;
  }

  return html;
}

// ── Formulaire ─────────────────────────────────────────
function openForm(id) {
  editId = id;
  const p = id ? allProjets.find(x => x.id === id) : null;
  formDates = (p?.dates_seances || []).map(ts => tsToInput(ts));

  document.getElementById('form-title').textContent = id ? 'Modifier le projet' : 'Nouveau projet';
  document.getElementById('form-body').innerHTML = buildFormHTML(p);

  // Multi-selects
  msRefs = {};
  initMs('ms-type',         discovered.type,         p?.type || []);
  initMs('ms-avancement',   discovered.avancement,   p?.avancement || []);
  initMs('ms-createur',     discovered.createur,     p?.createur || []);
  initMs('ms-systeme',      discovered.systeme,      p?.systeme || []);
  initMs('ms-univers',      discovered.univers,      p?.univers || []);
  initMs('ms-emplacement',  discovered.emplacement,  p?.emplacement || []);
  initMs('ms-participants', discovered.participants, p?.participants || []);

  // Stars
  initStarInput(p?.satisfaction ?? 0);

  // Dates
  renderDates();

  // Toggle déjà joué
  document.getElementById('f-deja-joue').addEventListener('change', e => {
    document.getElementById('f-joue-section').classList.toggle('hidden', !e.target.checked);
  });

  document.getElementById('f-add-date').addEventListener('click', () => {
    formDates.push('');
    renderDates();
  });

  document.getElementById('proj-form').addEventListener('submit', async e => {
    e.preventDefault();
    await handleSave();
  });

  document.getElementById('form-close').onclick = closeForm;
  document.getElementById('form-cancel').onclick = closeForm;

  if (id) {
    document.getElementById('form-delete').addEventListener('click', async () => {
      if (!confirm('Supprimer ce projet définitivement ?')) return;
      await removeProjet(id);
      closeForm();
      await loadData();
    });
  }

  document.getElementById('form-overlay').classList.remove('hidden');
}

function buildFormHTML(p) {
  const deja = p?.deja_joue || false;
  return `
    <form id="proj-form">
      <div class="form-section">
        <div class="form-section-title">Infos générales</div>

        <div class="form-row">
          <label class="form-label">Nom *</label>
          <input type="text" id="f-nom" class="form-input" value="${escH(p?.nom || '')}" required placeholder="Titre du projet">
        </div>

        <div class="form-row">
          <label class="form-label">Type</label>
          <div id="ms-type" class="ms-wrap"></div>
        </div>

        <div class="form-row">
          <label class="form-label">Avancement</label>
          <div id="ms-avancement" class="ms-wrap"></div>
        </div>

        <div class="form-grid-2">
          <div class="form-row">
            <label class="form-label">Date de début</label>
            <input type="date" id="f-date-debut" class="form-input" value="${tsToInput(p?.date_debut)}">
          </div>
          <div class="form-row">
            <label class="form-label">YouTube</label>
            <label class="check-label" style="margin-top:.4rem">
              <input type="checkbox" id="f-youtube" ${p?.youtube ? 'checked' : ''}>
              Session enregistrée
            </label>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">Créateur</label>
          <div id="ms-createur" class="ms-wrap"></div>
        </div>

        <div class="form-row">
          <label class="form-label">Système de jeu</label>
          <div id="ms-systeme" class="ms-wrap"></div>
        </div>

        <div class="form-row">
          <label class="form-label">Univers</label>
          <div id="ms-univers" class="ms-wrap"></div>
        </div>

        <div class="form-row">
          <label class="form-label">Emplacement du scénario</label>
          <div id="ms-emplacement" class="ms-wrap"></div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">
          <label class="check-label" style="font-size:.8rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--accent); cursor:pointer;">
            <input type="checkbox" id="f-deja-joue" ${deja ? 'checked' : ''}>
            Déjà joué ?
          </label>
        </div>

        <div id="f-joue-section" class="${deja ? '' : 'hidden'}">

          <div class="form-row">
            <label class="form-label">Satisfaction</label>
            <div class="star-input" id="f-satisfaction-wrap"></div>
          </div>

          <div class="form-grid-2">
            <div class="form-row">
              <label class="form-label">Séances (MJ)</label>
              <input type="number" id="f-seances-mj" class="form-input" min="0" value="${p?.nb_seances_mj ?? ''}">
            </div>
            <div class="form-row">
              <label class="form-label">Séances (joueurs)</label>
              <input type="number" id="f-seances-joueurs" class="form-input" min="0" value="${p?.nb_seances_joueurs ?? ''}">
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Participants</label>
            <div id="ms-participants" class="ms-wrap"></div>
          </div>

          <div class="form-row">
            <label class="form-label">Format</label>
            <div class="checkbox-group">
              <label class="check-label"><input type="checkbox" id="f-irl" ${p?.irl ? 'checked' : ''}> IRL</label>
              <label class="check-label"><input type="checkbox" id="f-online" ${p?.online ? 'checked' : ''}> Online</label>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Dates des séances</label>
            <div id="f-dates-list"></div>
            <button type="button" id="f-add-date" class="btn-add-date">+ Ajouter une date</button>
          </div>

        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">Commentaires</div>
        <div class="form-row">
          <textarea id="f-commentaires" class="form-input" rows="5" placeholder="Remarques libres sur ce projet…" style="resize:vertical">${escH(p?.commentaires || '')}</textarea>
        </div>
      </div>

      <div class="form-actions">
        ${editId ? `<button type="button" id="form-delete" class="btn-danger">🗑 Supprimer</button>` : ''}
        <div style="flex:1"></div>
        <button type="button" id="form-cancel" class="btn-ghost">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>`;
}

function closeForm() {
  document.getElementById('form-overlay').classList.add('hidden');
  editId = null;
  msRefs = {};
  formDates = [];
}

async function handleSave() {
  const nom = document.getElementById('f-nom').value.trim();
  if (!nom) return;

  const dejaJoue = document.getElementById('f-deja-joue').checked;
  const satWrap  = document.getElementById('f-satisfaction-wrap');
  const satisfaction = satWrap?.dataset?.val ? parseInt(satWrap.dataset.val) : null;

  const data = {
    nom,
    type:        msRefs['ms-type']?.getValue()        || [],
    avancement:  msRefs['ms-avancement']?.getValue()  || [],
    createur:    msRefs['ms-createur']?.getValue()    || [],
    systeme:     msRefs['ms-systeme']?.getValue()     || [],
    univers:     msRefs['ms-univers']?.getValue()     || [],
    emplacement: msRefs['ms-emplacement']?.getValue() || [],
    youtube:      document.getElementById('f-youtube').checked,
    deja_joue:    dejaJoue,
    date_debut:   dateInputToTs(document.getElementById('f-date-debut').value),
    commentaires: document.getElementById('f-commentaires').value.trim(),
  };

  if (dejaJoue) {
    data.satisfaction        = satisfaction;
    data.nb_seances_mj       = parseInt(document.getElementById('f-seances-mj').value) || null;
    data.nb_seances_joueurs  = parseInt(document.getElementById('f-seances-joueurs').value) || null;
    data.participants        = msRefs['ms-participants']?.getValue() || [];
    data.irl                 = document.getElementById('f-irl').checked;
    data.online              = document.getElementById('f-online').checked;
    data.dates_seances       = formDates.filter(d => d).map(d => dateInputToTs(d));
  } else {
    data.satisfaction = null; data.nb_seances_mj = null;
    data.nb_seances_joueurs = null; data.participants = [];
    data.irl = false; data.online = false; data.dates_seances = [];
  }

  await saveProjet(editId, data);
  closeForm();
  await loadData();
}

// ── Multi-select init helper ───────────────────────────
function initMs(elId, opts, current) {
  const el = document.getElementById(elId);
  if (!el) return;
  msRefs[elId] = MultiSelect(el, opts, current);
}

// ── Star input interactif ──────────────────────────────
function initStarInput(initialVal) {
  const wrap = document.getElementById('f-satisfaction-wrap');
  if (!wrap) return;
  let val = initialVal || 0;
  wrap.dataset.val = val;

  function drawStars() {
    wrap.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement('span');
      s.className = 'star star-btn' + (i <= val ? ' filled' : '');
      s.textContent = '★';
      s.addEventListener('mouseenter', () => {
        wrap.querySelectorAll('.star').forEach((st, j) => st.classList.toggle('filled', j < i));
      });
      s.addEventListener('mouseleave', () => {
        wrap.querySelectorAll('.star').forEach((st, j) => st.classList.toggle('filled', j < val));
      });
      s.addEventListener('click', () => {
        val = (val === i) ? 0 : i;
        wrap.dataset.val = val;
        drawStars();
      });
      wrap.appendChild(s);
    }
  }
  drawStars();
}

// ── Liste de dates dynamique ───────────────────────────
function renderDates() {
  const list = document.getElementById('f-dates-list');
  if (!list) return;
  list.innerHTML = '';
  formDates.forEach((d, i) => {
    const row = document.createElement('div');
    row.className = 'date-row';
    row.innerHTML = `
      <input type="date" class="form-input date-input" value="${escH(d)}">
      <button type="button" class="btn-rm-date">×</button>`;
    row.querySelector('.date-input').addEventListener('change', e => { formDates[i] = e.target.value; });
    row.querySelector('.btn-rm-date').addEventListener('click', () => { formDates.splice(i, 1); renderDates(); });
    list.appendChild(row);
  });
}

// ── Composant MultiSelect ──────────────────────────────
function MultiSelect(container, opts, current) {
  let selected = [...current];
  let options  = [...new Set(opts)];
  let open     = false;

  function h(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Structure initiale — créée une seule fois pour ne jamais détruire l'input
  container.innerHTML = `<div class="ms-field"><span class="ms-chips"></span><input class="ms-input" type="text" placeholder="Ajouter…"></div>`;

  const field    = container.querySelector('.ms-field');
  const chipsEl  = container.querySelector('.ms-chips');
  const input    = container.querySelector('.ms-input');

  function drawChips() {
    chipsEl.innerHTML = selected.map(s =>
      `<span class="ms-chip">${h(s)}<button type="button" class="ms-rm" data-v="${h(s)}">×</button></span>`
    ).join('');
    input.placeholder = selected.length ? '' : 'Ajouter…';
    chipsEl.querySelectorAll('.ms-rm').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        selected = selected.filter(s => s !== btn.dataset.v);
        drawChips();
      });
    });
  }

  function drawDropdown() {
    container.querySelector('.ms-dropdown')?.remove();
    if (!open) return;

    const query    = input.value;
    const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));
    const canCreate = query.trim() && !options.some(o => o.toLowerCase() === query.trim().toLowerCase());

    const drop = document.createElement('div');
    drop.className = 'ms-dropdown';
    drop.innerHTML = `
      ${filtered.map(o => `
        <div class="ms-opt${selected.includes(o) ? ' ms-sel' : ''}" data-o="${h(o)}">
          <span>${h(o)}</span>${selected.includes(o) ? '<span class="ms-check">✓</span>' : ''}
        </div>`).join('')}
      ${canCreate ? `<div class="ms-opt ms-create" data-create="${h(query.trim())}">+ Créer « ${h(query.trim())} »</div>` : ''}
      ${!filtered.length && !canCreate ? `<div class="ms-empty">Aucune option</div>` : ''}`;

    drop.addEventListener('mousedown', e => e.preventDefault());

    drop.querySelectorAll('.ms-opt[data-o]').forEach(opt => {
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        const v = opt.dataset.o;
        selected = selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v];
        input.value = '';
        drawChips();
        drawDropdown();
      });
    });

    drop.querySelectorAll('.ms-create').forEach(opt => {
      opt.addEventListener('mousedown', e => {
        e.preventDefault();
        const v = opt.dataset.create;
        if (!options.includes(v)) options.push(v);
        if (!selected.includes(v)) selected.push(v);
        input.value = '';
        drawChips();
        drawDropdown();
      });
    });

    container.appendChild(drop);
  }

  // Listeners sur l'input — attachés une seule fois
  field.addEventListener('mousedown', e => {
    if (e.target !== input) { e.preventDefault(); input.focus(); }
  });

  input.addEventListener('focus', () => { open = true; drawDropdown(); });
  input.addEventListener('blur',  () => setTimeout(() => { open = false; drawDropdown(); }, 200));
  input.addEventListener('input', () => drawDropdown());
  input.addEventListener('keydown', e => {
    const query = input.value;
    if (e.key === 'Backspace' && !query && selected.length) {
      selected.pop(); drawChips(); return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      if (!options.some(o => o.toLowerCase() === q.toLowerCase())) options.push(q);
      const actual = options.find(o => o.toLowerCase() === q.toLowerCase());
      if (actual && !selected.includes(actual)) selected.push(actual);
      input.value = '';
      drawChips();
      drawDropdown();
    }
  });

  drawChips();
  return { getValue: () => [...selected], getOpts: () => [...options] };
}
