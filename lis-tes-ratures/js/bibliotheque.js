import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import {
  getLivres, getMembres, addLivre, getVotes,
  getStatutsForLivre, updateLivreInfos, getReunions,
} from "./db.js";
import { formatDate, formatMois, showToast } from "./utils.js";
import { hydrateCover, coversOn, isAutoUrl, invalidateCoverCache } from "./covers.js";

await requireAuth();
initNav("bibliotheque");

// ── Constantes ────────────────────────────────────────────────────
const TINTS = [
  ['#3f5340','#273829'],['#7a3b2e','#56281f'],['#39505c','#25363d'],
  ['#8a6a2f','#5b4420'],['#5a4636','#382a20'],['#4a4038','#2f2822'],
  ['#6b4a52','#432d36'],['#4a5a6b','#2d3842'],['#6b5a3e','#433822'],
  ['#3f4a3f','#262f26'],['#6b3f4a','#42262d'],['#5a6b4a','#37422e'],
];
const ICON_AI      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>';
const ICON_WARN    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 4.3 1.8 19a1 1 0 0 0 .9 1.5h18.6a1 1 0 0 0 .9-1.5L13.7 4.3a1 1 0 0 0-1.7 0z"/><path d="M12 9v4M12 17h.01"/></svg>';
const ICON_EDIT    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const ICON_CLOCK   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const ICON_NOTE    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 10h7M8 14h5"/></svg>';
const ICON_USERS   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.7-4.7"/></svg>';
const ICON_CHECK   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const ICON_COMMENT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z"/></svg>';
const ICON_COPY    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>';

// ── State ─────────────────────────────────────────────────────────
let livres = [], membres = [], votes = [], reunions = [];
let eluSortMode = "chron";
let currentFicheId = null;
let dbSort = { key: "date_proposition", dir: -1 };

const params = new URLSearchParams(window.location.search);

// ── Utilitaires ───────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function bookTint(id = '') {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

function memNom(id) {
  return membres.find(m => m.id === id)?.nom ?? id ?? '—';
}

function toDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}

function unitAbbr(u) {
  if (u === 'chapitres') return 'ch.';
  if (u === 'parties')   return 'par.';
  return 'p.';
}

function detectScale(resultats) {
  const all = (resultats || []).flatMap(r => Object.values(r.notes || {})).map(Number).filter(n => !isNaN(n));
  return all.length && Math.max(...all) <= 5 ? 5 : 10;
}

function computeNoteFinale(reunion) {
  if (!reunion?.notes_finales) return null;
  const vals = Object.values(reunion.notes_finales).map(Number).filter(n => !isNaN(n) && n > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function findVoteElim(livreId) {
  return [...votes].sort((a, b) => b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois)
    .find(v => (v.resultats || []).some(r => r.livre_id === livreId && r.moyenne !== null && r.moyenne <= 2.5));
}

function notesFinalesMap() {
  const map = {};
  reunions.forEach(r => {
    if (!r.livre_id || !r.notes_finales) return;
    const vals = Object.values(r.notes_finales).map(Number).filter(n => !isNaN(n) && n > 0);
    if (vals.length) map[r.livre_id] = vals.reduce((a, b) => a + b, 0) / vals.length;
  });
  return map;
}

// ── Ouverture des livres au survol : toujours active ──────────────
document.getElementById("prop-grid").classList.add("infos-on");

// ── Vue bib ↔ DB ──────────────────────────────────────────────────
document.getElementById("open-db").addEventListener("click", e => { e.preventDefault(); showDbView(); });
document.getElementById("db-back").addEventListener("click", e => { e.preventDefault(); showBibView(); });

function showBibView() {
  document.getElementById("bib-view").classList.remove("hidden");
  document.getElementById("db-view").classList.add("hidden");
  window.scrollTo(0, 0);
}

function showDbView() {
  document.getElementById("bib-view").classList.add("hidden");
  document.getElementById("db-view").classList.remove("hidden");
  dbPopulateFilters();
  renderDB();
  window.scrollTo(0, 0);
}

// ── Rendu propositions ────────────────────────────────────────────
function renderProps() {
  const props = livres.filter(l => l.statut === "en_proposition");
  const grid = document.getElementById("prop-grid");
  if (!props.length) {
    grid.innerHTML = '<p style="color:var(--muted);font-size:.85rem">Aucun livre en proposition.</p>';
    return;
  }
  grid.innerHTML = props.map(l => {
    const [g1, g2] = bookTint(l.id);
    const d = toDate(l.date_proposition);
    const dateStr = d ? d.toLocaleDateString('fr-FR') : '—';
    return `<div class="bk" data-id="${l.id}" style="--g1:${g1};--g2:${g2}">
      <div class="bk-page">
        <div class="bk-page-title">${esc(l.titre)}</div>
        <div class="bk-meta">
          <div class="bk-meta-row"><span class="bk-meta-k">Auteur</span><span class="bk-meta-v">${esc(l.auteur || '—')}</span></div>
          <div class="bk-meta-row"><span class="bk-meta-k">Genre</span><span class="bk-meta-v">${esc(l.genre || '—')}</span></div>
          <div class="bk-meta-row"><span class="bk-meta-k">Pages</span><span class="bk-meta-v">${l.nb_pages ? l.nb_pages + ' p.' : '—'}</span></div>
          <div class="bk-meta-row"><span class="bk-meta-k">Proposé par</span><span class="bk-meta-v">${esc(memNom(l.propose_par))}</span></div>
        </div>
        ${l.description_3_mots ? `<div class="bk-desc">« ${esc(l.description_3_mots)} »</div>` : ''}
        <div class="bk-ai">${ICON_AI} généré par IA · peut être inexact</div>
      </div>
      <div class="bk-cover">
        <div class="bk-face">
          <div class="bk-face-title">${esc(l.titre)}</div>
          <div class="bk-face-author">${esc(l.auteur || '')}</div>
          <div class="bk-face-foot"><span>${esc(memNom(l.propose_par))}</span><span>${dateStr}</span></div>
        </div>
        <div class="bk-back"></div>
      </div>
    </div>`;
  }).join('');

  if (coversOn()) grid.querySelectorAll(".bk[data-id]").forEach(bk => {
    hydrateCover(bk.querySelector(".bk-face"), livres.find(l => l.id === bk.dataset.id));
  });
}

// ── Rendu élus ────────────────────────────────────────────────────
function renderElusList() {
  const nfMap = notesFinalesMap();
  const elusVotes = votes.filter(v => v.livre_elu);
  let sorted;
  if (eluSortMode === "note") {
    const avecNote = elusVotes.filter(v => nfMap[v.livre_elu] !== undefined)
      .sort((a, b) => nfMap[b.livre_elu] - nfMap[a.livre_elu]);
    const sansNote = elusVotes.filter(v => nfMap[v.livre_elu] === undefined)
      .sort((a, b) => b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois);
    sorted = [...avecNote, ...sansNote];
  } else {
    sorted = [...elusVotes].sort((a, b) => b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois);
  }
  const list = document.getElementById("elus-list");
  if (!sorted.length) {
    list.innerHTML = '<p style="color:var(--muted);font-size:.85rem">Aucun livre élu pour l\'instant.</p>';
    return;
  }
  list.innerHTML = sorted.map(v => {
    const r = (v.resultats || []).find(x => x.livre_id === v.livre_elu);
    const scale = detectScale(v.resultats);
    const moy = r?.moyenne ?? null;
    const nf = nfMap[v.livre_elu] ?? null;
    const livre = livres.find(l => l.id === v.livre_elu);
    const [eg1, eg2] = bookTint(v.livre_elu);
    return `<div class="bib-elu-item" data-id="${v.livre_elu}">
      <div class="bib-elu-month">${esc(formatMois(v.mois, v.annee))}</div>
      ${coversOn() ? `<div class="bib-elu-cover" style="--g1:${eg1};--g2:${eg2}"></div>` : ''}
      <div class="bib-elu-info">
        <div class="bib-elu-title">${esc(r?.titre ?? livre?.titre ?? v.livre_elu)}</div>
        <div class="bib-elu-author">${esc(r?.auteur ?? livre?.auteur ?? '')}</div>
        ${livre?.genre ? `<div class="bib-elu-genre">${esc(livre.genre)}</div>` : ''}
      </div>
      <div class="bib-elu-scores">
        ${nf !== null
          ? `<div class="bib-elu-note-finale">${nf.toFixed(1)}<span class="bib-elu-note-label"> /10</span></div>`
          : `<div class="bib-elu-no-note">Non noté</div>`}
        ${moy !== null ? `<div class="bib-elu-score-vote">Sélection : ${Number(moy).toFixed(1)}/${scale}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  if (coversOn()) list.querySelectorAll(".bib-elu-item[data-id]").forEach(item => {
    hydrateCover(item.querySelector(".bib-elu-cover"), livres.find(l => l.id === item.dataset.id));
  });
}

// ── Rendu éliminés ────────────────────────────────────────────────
function renderElim() {
  const refuses = livres.filter(l => l.statut === "refuse");
  const grid = document.getElementById("elim-grid");
  if (!refuses.length) {
    grid.innerHTML = '<p style="color:var(--muted);font-size:.85rem">Aucun livre éliminé pour l\'instant.</p>';
    return;
  }
  grid.innerHTML = refuses.map(l => {
    const v = findVoteElim(l.id);
    const r = v ? (v.resultats || []).find(x => x.livre_id === l.id) : null;
    const scale = v ? detectScale(v.resultats) : 5;
    const moy = r?.moyenne ?? null;
    return `<div class="elim-card" data-id="${l.id}" style="background:linear-gradient(158deg,#2c2418,#1a140d)">
      <div class="elim-card-title">${esc(l.titre)}</div>
      <div class="elim-card-author">${esc(l.auteur || '')}</div>
      ${l.genre ? `<div class="prop-card-genre">${esc(l.genre)}</div>` : ''}
      <div class="elim-card-footer">
        <span>${v ? esc(formatMois(v.mois, v.annee)) : '—'}</span>
        ${moy !== null ? `<span class="elim-score">${Number(moy).toFixed(1)}/${scale}</span>` : ''}
      </div>
    </div>`;
  }).join('');

  if (coversOn()) grid.querySelectorAll(".elim-card[data-id]").forEach(card => {
    hydrateCover(card, livres.find(l => l.id === card.dataset.id));
  });
}

function renderVisual() {
  renderProps();
  renderElusList();
  renderElim();
}

// Basculement du toggle « vraies couvertures » (sidebar) → re-render
document.addEventListener("ltr-covers-change", () => {
  renderVisual();
  if (currentFicheId && !document.getElementById("fiche-overlay").classList.contains("hidden")) {
    openFiche(currentFicheId);
  }
});

// ── Sort toggle élus ──────────────────────────────────────────────
function updateTriBtns() {
  document.querySelectorAll("#elus-tri .seg").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.sort === eluSortMode);
  });
}

document.getElementById("elus-tri").addEventListener("click", e => {
  const btn = e.target.closest(".seg[data-sort]");
  if (!btn) return;
  eluSortMode = btn.dataset.sort;
  updateTriBtns();
  renderElusList();
});

// ── Fiche overlay ─────────────────────────────────────────────────
async function openFiche(id) {
  currentFicheId = id;
  const livre = livres.find(l => l.id === id);
  if (!livre) return;

  const [g1, g2] = bookTint(id);
  const fiche = document.getElementById("fiche");
  fiche.innerHTML = `<div style="padding:2rem;text-align:center;color:#8a7560">Chargement…</div>`;
  document.getElementById("fiche-overlay").classList.remove("hidden");
  document.querySelector(".fiche-paper").scrollTop = 0;

  const statuts = livre.statut === "elu" ? await getStatutsForLivre(id) : [];
  const votesDuLivre = votes
    .filter(v => (v.resultats || []).some(r => r.livre_id === id))
    .sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);

  const allNotes = votesDuLivre.flatMap(v =>
    (v.resultats || []).filter(r => r.livre_id === id).flatMap(r => Object.values(r.notes || {}))
  ).map(Number).filter(n => !isNaN(n));
  const scale = allNotes.length && Math.max(...allNotes) <= 5 ? 5 : 10;

  const SM = { en_proposition:['prop','En proposition'], elu:['elu','Élu'], refuse:['elim','Éliminé'] }[livre.statut] ?? ['prop','En proposition'];

  // Infos IA
  const hasAI = livre.genre || livre.nb_pages || livre.description_3_mots;
  const iaHTML = (livre.statut === 'en_proposition' && hasAI) ? `
    <details class="fiche-ia">
      <summary><span class="chev">▶</span>${ICON_AI} Infos complémentaires (IA)</summary>
      <div class="fiche-ia-body">
        <dl class="fiche-dl">
          ${livre.nb_pages ? `<dt>Pages</dt><dd>${livre.nb_pages} p.</dd>` : ''}
          ${livre.genre ? `<dt>Genre</dt><dd>${esc(livre.genre)}</dd>` : ''}
          ${livre.description_3_mots ? `<dt>En 3 mots</dt><dd>« ${esc(livre.description_3_mots)} »</dd>` : ''}
        </dl>
        <div class="fiche-ia-warn">${ICON_WARN} Pages, genre et description fournis par IA — à vérifier.</div>
      </div>
    </details>` : '';

  // Avancements (élus)
  let avHtml = '';
  if (livre.statut === 'elu' && membres.length) {
    const reunionDuLivre = reunions.find(r => r.livre_id === id);
    avHtml = `<div class="fiche-divider"></div>
      <div class="fiche-sec-title">${ICON_USERS} Avancements membres</div>
      <div class="fiche-av">${membres.map(m => {
        const s = statuts.find(x => x.membre_id === m.id);
        const hasReunionNote = reunionDuLivre?.notes_finales?.[m.id] != null;
        const label = (hasReunionNote || s?.statut === 'termine')
          ? `<span class="fiche-av-done">${ICON_CHECK} Terminé</span>`
          : !s ? `<span class="fiche-av-none">—</span>`
          : s.statut === 'en_cours' ? `<span style="color:#a8501f;font-weight:600">En cours${s.page_actuelle ? ` · ${s.page_actuelle} ${unitAbbr(livre.progression_unite)}` : ''}</span>`
          : `<span class="fiche-av-none">—</span>`;
        return `<div class="fiche-av-row"><span>${esc(m.nom)}</span>${label}</div>`;
      }).join('')}</div>`;
  }

  // Historique
  const hist = [];
  const d = toDate(livre.date_proposition);
  hist.push({ label: `Proposé le ${d ? d.toLocaleDateString('fr-FR') : '—'}`, sub: `par ${esc(memNom(livre.propose_par))}` });
  for (const v of votesDuLivre) {
    const r = (v.resultats || []).find(x => x.livre_id === id);
    if (!r) continue;
    const moy = r.moyenne != null ? Number(r.moyenne).toFixed(2) : '—';
    const isElu = v.livre_elu === id;
    const isElim = !isElu && r.moyenne != null && r.moyenne <= 2.5;
    hist.push({ label: `Vote de ${formatMois(v.mois, v.annee)}`, sub: `Note moyenne : ${moy} / ${scale}`, kind: isElu ? 'elu' : isElim ? 'elim' : null });
  }
  if (livre.statut === 'elu') {
    const vElu = votesDuLivre.find(v => v.livre_elu === id);
    hist.push({ label: `Élu${vElu ? ` en ${formatMois(vElu.mois, vElu.annee)}` : ''}`, kind: 'elu' });
  } else if (livre.statut === 'refuse') {
    const vElim = findVoteElim(id);
    hist.push({ label: `Éliminé${vElim ? ` en ${formatMois(vElim.mois, vElim.annee)}` : ''}`, kind: 'elim' });
  }
  const histHtml = `<div class="fiche-divider"></div>
    <div class="fiche-sec-title">${ICON_CLOCK} Historique</div>
    <div class="fiche-tl">${hist.map(h => `
      <div class="fiche-tl-item${h.kind ? ' is-' + h.kind : ''}">
        <div class="fiche-tl-label${h.kind ? ' is-' + h.kind : ''}">${h.label}</div>
        ${h.sub ? `<div class="fiche-tl-sub">${h.sub}</div>` : ''}
      </div>`).join('')}</div>`;

  // Réunion
  const reunion = reunions.find(r => r.livre_id === id);
  let reunionHtml = '';
  if (reunion) {
    const nf = computeNoteFinale(reunion);
    const participants = reunion.participant_ids || [];
    const membresNotes = Object.entries(reunion.notes_finales || {})
      .filter(([, n]) => Number(n) > 0)
      .map(([memId, note]) => {
        const absent = !participants.includes(memId);
        return `${esc(memNom(memId))}${absent ? ` <span class="fiche-reunion-abs">absent</span>` : ''} <b>${Number(note).toFixed(1)}</b>`;
      }).join(' · ');
    reunionHtml = `<div class="fiche-divider"></div>
      <div class="fiche-sec-title">${ICON_NOTE} Réunion</div>
      <div class="fiche-reunion-head">
        <span class="fiche-reunion-meta">${reunion.date ? toDate(reunion.date)?.toLocaleDateString('fr-FR') : '—'} · ${participants.length} participant${participants.length > 1 ? 's' : ''}</span>
        ${nf !== null ? `<span class="fiche-reunion-note">${nf.toFixed(1)}/10</span>` : ''}
      </div>
      ${membresNotes ? `<div class="fiche-reunion-notes">${membresNotes}</div>` : ''}
      <div class="fiche-reunion-cta">
        <a href="reunions.html?open=${reunion.id}" class="fiche-btn">${ICON_NOTE} Voir la fiche réunion →</a>
      </div>`;
  }

  fiche.innerHTML = `
    <div class="fiche-top">
      <button class="fiche-modif" id="fiche-modif">${ICON_EDIT} Modifier</button>
      <button class="fiche-close" id="fiche-close-btn">✕</button>
    </div>
    <div class="fiche-head">
      <div class="fiche-cover" style="--g1:${g1};--g2:${g2}"><span>${esc(livre.titre)}</span></div>
      <div class="fiche-htext">
        <div class="fiche-title">${esc(livre.titre)}</div>
        <div class="fiche-author">${esc(livre.auteur || '')}</div>
      </div>
    </div>
    <dl class="fiche-dl">
      ${livre.auteur ? `<dt>Auteur</dt><dd>${esc(livre.auteur)}</dd>` : ''}
      ${livre.annee ? `<dt>Année</dt><dd>${livre.annee}</dd>` : ''}
      <dt>Proposé par</dt><dd>${esc(memNom(livre.propose_par))}</dd>
      <dt>Date</dt><dd>${d ? d.toLocaleDateString('fr-FR') : '—'}</dd>
      <dt>Statut</dt><dd><span class="fiche-badge ${SM[0]}">${SM[1]}</span></dd>
    </dl>
    ${iaHTML}
    ${avHtml}
    ${histHtml}
    ${reunionHtml}
    <div class="fiche-actions">
      <a href="commentaires.html?livre=${id}" class="fiche-btn">${ICON_COMMENT} Commentaires de lecture</a>
    </div>`;

  document.getElementById("fiche-close-btn").addEventListener("click", closeFiche);
  document.getElementById("fiche-modif").addEventListener("click", () => showFicheEditForm(livre));
  hydrateCover(fiche.querySelector(".fiche-cover"), livre);

  fiche.querySelectorAll(".fiche-ia summary").forEach(s => {
    s.addEventListener("click", () => {
      const det = s.closest("details");
      setTimeout(() => { s.querySelector(".chev").textContent = det.open ? '▼' : '▶'; }, 0);
    });
  });
}

function closeFiche() {
  document.getElementById("fiche-overlay").classList.add("hidden");
}

document.getElementById("fiche-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeFiche();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
});

// ── Modifier fiche ────────────────────────────────────────────────
function showFicheEditForm(livre) {
  const fiche = document.getElementById("fiche");
  const d = toDate(livre.date_proposition);
  const dateVal = d ? d.toISOString().split("T")[0] : '';
  const inputStyle = 'background:rgba(255,255,255,.55);border:1px solid rgba(120,90,50,.28);color:#3a2b1c;border-radius:6px;width:100%;padding:.55rem .8rem;font-family:inherit;font-size:.9rem;box-sizing:border-box';
  const labelStyle = 'display:block;color:#a07c4e;font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.3rem';
  const memOptions = '<option value="">— Choisir —</option>' + membres.map(m => `<option value="${m.id}"${m.id === livre.propose_par ? ' selected' : ''}>${esc(m.nom)}</option>`).join('');

  fiche.innerHTML = `
    <div class="fiche-top"><button class="fiche-close" id="fiche-close-btn">✕</button></div>
    <div style="font-family:var(--serif);font-size:1.4rem;font-weight:600;color:#2c2015;margin-bottom:1.2rem;padding-right:3rem">Modifier le livre</div>
    <div style="margin-bottom:.85rem"><label style="${labelStyle}">Titre *</label><input type="text" id="el-titre" value="${esc(livre.titre)}" style="${inputStyle}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:.85rem">
      <div><label style="${labelStyle}">Auteur</label><input type="text" id="el-auteur" value="${esc(livre.auteur || '')}" style="${inputStyle}"></div>
      <div><label style="${labelStyle}">Année</label><input type="number" id="el-annee" value="${livre.annee || ''}" style="${inputStyle}"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:.85rem">
      <div><label style="${labelStyle}">Proposé par</label><select id="el-membre" style="${inputStyle}">${memOptions}</select></div>
      <div><label style="${labelStyle}">Date</label><input type="date" id="el-date" value="${dateVal}" style="${inputStyle}"></div>
    </div>
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#a07c4e;margin:1.2rem 0 .8rem;display:flex;align-items:center;gap:.6rem">
      Infos complémentaires <span style="flex:1;height:1px;background:rgba(120,90,50,.22);display:block"></span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:.85rem">
      <div><label style="${labelStyle}">Genre</label><input type="text" id="el-genre" value="${esc(livre.genre || '')}" placeholder="ex : Roman" style="${inputStyle}"></div>
      <div><label style="${labelStyle}">Pages</label><input type="number" id="el-pages" value="${livre.nb_pages || ''}" placeholder="ex : 320" style="${inputStyle}"></div>
    </div>
    <div style="margin-bottom:.85rem"><label style="${labelStyle}">Description en 3 mots</label><input type="text" id="el-desc" value="${esc(livre.description_3_mots || '')}" placeholder="ex : amour, guerre, trahison" style="${inputStyle}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:1.2rem">
      <div><label style="${labelStyle}">ISBN-13</label><input type="text" id="el-isbn" value="${esc(livre.isbn13 || '')}" placeholder="ex : 9782070413119" style="${inputStyle}"></div>
      <div><label style="${labelStyle}">URL de couverture (manuel)</label><input type="text" id="el-cover" value="${esc(isAutoUrl(livre.couverture_url) ? '' : (livre.couverture_url || ''))}" placeholder="vide = auto (ISBN puis recherche)" style="${inputStyle}"></div>
    </div>
    <div style="border-top:1px solid rgba(120,90,50,.2);padding-top:1rem;display:flex;justify-content:flex-end;gap:.7rem">
      <button id="el-cancel" style="background:transparent;border:1px solid rgba(120,90,50,.32);border-radius:8px;padding:.45rem 1rem;font-size:.82rem;color:#6a513a;cursor:pointer;font-family:inherit">Annuler</button>
      <button id="el-save" style="background:#b5572d;border:none;border-radius:8px;padding:.45rem 1.1rem;font-size:.82rem;color:#fff;cursor:pointer;font-family:inherit;font-weight:600">Enregistrer</button>
    </div>`;

  document.getElementById("fiche-close-btn").addEventListener("click", closeFiche);
  document.getElementById("el-cancel").addEventListener("click", () => openFiche(currentFicheId));
  document.getElementById("el-save").addEventListener("click", async () => {
    const titre = document.getElementById("el-titre").value.trim();
    if (!titre) { showToast("Le titre est obligatoire.", "error"); return; }
    try {
      await updateLivreInfos(currentFicheId, {
        titre,
        auteur: document.getElementById("el-auteur").value.trim(),
        annee: document.getElementById("el-annee").value,
        propose_par: document.getElementById("el-membre").value,
        date_proposition: document.getElementById("el-date").value,
        nb_pages: document.getElementById("el-pages").value,
        genre: document.getElementById("el-genre").value.trim(),
        description_3_mots: document.getElementById("el-desc").value.trim(),
        couverture_url: document.getElementById("el-cover").value.trim(),
        isbn13: document.getElementById("el-isbn").value.trim(),
      });
      invalidateCoverCache(currentFicheId); // oublie l'ancienne couverture en mémoire
      showToast("Livre modifié !", "success");
      livres = await getLivres();
      renderVisual();
      openFiche(currentFicheId);
    } catch (e) { showToast("Erreur : " + e.message, "error"); }
  });
}

// ── Base de données ───────────────────────────────────────────────
function dbPopulateFilters() {
  const genres = [...new Set(livres.map(l => l.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const gSel = document.getElementById("db-genre");
  const mSel = document.getElementById("db-member");
  const gv = gSel.value, mv = mSel.value;
  gSel.innerHTML = '<option value="all">Tous les genres</option>' + genres.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
  mSel.innerHTML = '<option value="all">Tous les membres</option>' + membres.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('');
  if ([...gSel.options].some(o => o.value === gv)) gSel.value = gv;
  if ([...mSel.options].some(o => o.value === mv)) mSel.value = mv;
}

function dbGetRows() {
  const q = (document.getElementById("db-search").value || '').toLowerCase().trim();
  const fS = document.getElementById("db-filter").value;
  const fG = document.getElementById("db-genre").value;
  const fM = document.getElementById("db-member").value;
  const statutMap = { proposition: 'en_proposition', elu: 'elu', elim: 'refuse' };

  let rows = livres.filter(l => {
    if (fS !== 'all' && l.statut !== statutMap[fS]) return false;
    if (fG !== 'all' && l.genre !== fG) return false;
    if (fM !== 'all' && l.propose_par !== fM) return false;
    if (q && !((l.titre || '') + ' ' + (l.auteur || '')).toLowerCase().includes(q)) return false;
    return true;
  });

  rows.sort((a, b) => {
    let va, vb;
    if (dbSort.key === 'date_proposition') {
      va = toDate(a.date_proposition)?.getTime() ?? 0;
      vb = toDate(b.date_proposition)?.getTime() ?? 0;
    } else if (dbSort.key === 'annee' || dbSort.key === 'nb_pages') {
      va = Number(a[dbSort.key] ?? 0); vb = Number(b[dbSort.key] ?? 0);
    } else {
      va = (a[dbSort.key] ?? '').toString().toLowerCase();
      vb = (b[dbSort.key] ?? '').toString().toLowerCase();
    }
    if (va < vb) return dbSort.dir;
    if (va > vb) return -dbSort.dir;
    return 0;
  });
  return rows;
}

function renderDB() {
  const rows = dbGetRows();
  const ind = dbSort.dir === 1 ? '▲' : '▼';
  const COLS = [
    { key:'titre',            label:'Titre' },
    { key:'auteur',           label:'Auteur' },
    { key:'annee',            label:'Année',       num:true },
    { key:'genre',            label:'Genre' },
    { key:'nb_pages',         label:'Pages',       num:true },
    { key:'propose_par',      label:'Proposé par' },
    { key:'date_proposition', label:'Date' },
    { key:'statut',           label:'Statut' },
  ];
  const statLabel = { en_proposition:'En proposition', elu:'Élu', refuse:'Éliminé' };
  const statCls   = { en_proposition:'proposition',    elu:'elu', refuse:'elim' };

  const thead = `<thead><tr>${COLS.map(c =>
    `<th data-key="${c.key}" class="${c.num?'num ':''}${c.key===dbSort.key?'sorted':''}">${c.label}<span class="sort-ind">${c.key===dbSort.key?ind:''}</span></th>`
  ).join('')}</tr></thead>`;

  const cell = v => (v != null && v !== '') ? v : '<span class="none">—</span>';
  const tbody = `<tbody>${rows.map(l => {
    const d = toDate(l.date_proposition);
    return `<tr data-id="${l.id}">
      <td class="col-title">${esc(l.titre)}</td>
      <td class="col-author">${esc(l.auteur || '—')}</td>
      <td class="num">${cell(l.annee)}</td>
      <td class="col-genre"><span class="${l.genre?'':'none'}">${l.genre ? esc(l.genre) : '—'}</span></td>
      <td class="num col-pages"><span class="${l.nb_pages?'':'none'}">${l.nb_pages ? l.nb_pages+' p.' : '—'}</span></td>
      <td>${esc(memNom(l.propose_par))}</td>
      <td class="num">${d ? d.toLocaleDateString('fr-FR') : '—'}</td>
      <td><span class="db-badge ${statCls[l.statut]??'proposition'}">${statLabel[l.statut]??l.statut}</span></td>
    </tr>`;
  }).join('')}</tbody>`;

  const table = document.getElementById("db-table");
  table.innerHTML = thead + tbody;

  const tw = table.closest(".db-tablewrap");
  let empty = document.getElementById("db-empty");
  if (!rows.length) {
    if (!empty) { empty = document.createElement("div"); empty.id = "db-empty"; empty.className = "db-empty"; tw.after(empty); }
    empty.textContent = "Aucun livre ne correspond à votre recherche.";
  } else if (empty) empty.remove();
  document.getElementById("db-count").textContent = `${rows.length} livre${rows.length > 1 ? 's' : ''}`;

  table.querySelectorAll("th[data-key]").forEach(th => {
    th.addEventListener("click", () => {
      const k = th.dataset.key;
      dbSort = dbSort.key === k ? { key: k, dir: -dbSort.dir } : { key: k, dir: 1 };
      renderDB();
    });
  });
  table.querySelectorAll("tr[data-id]").forEach(tr => {
    tr.addEventListener("click", () => openFiche(tr.dataset.id));
  });
}

document.getElementById("db-search").addEventListener("input", renderDB);
["db-filter","db-genre","db-member"].forEach(id => document.getElementById(id).addEventListener("change", renderDB));

// ── Proposer un livre ─────────────────────────────────────────────
function openProposeModal() {
  const sel = document.getElementById("pf-par");
  sel.innerHTML = '<option value="">— Choisir —</option>' + membres.map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('');
  document.getElementById("propose-overlay").classList.remove("hidden");
  setTimeout(() => document.getElementById("pf-titre").focus(), 50);
}

function closeProposeModal() {
  document.getElementById("propose-overlay").classList.add("hidden");
  ["pf-titre","pf-auteur","pf-annee"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

// Délégation permanente sur les conteneurs (une seule fois, résiste aux re-renders)
document.getElementById("prop-grid").addEventListener("click", e => {
  const bk = e.target.closest(".bk[data-id]");
  if (bk) openFiche(bk.dataset.id);
});
document.getElementById("elus-list").addEventListener("click", e => {
  const item = e.target.closest(".bib-elu-item[data-id]");
  if (item) openFiche(item.dataset.id);
});
document.getElementById("elim-grid").addEventListener("click", e => {
  const card = e.target.closest(".elim-card[data-id]");
  if (card) openFiche(card.dataset.id);
});

document.getElementById("open-propose").addEventListener("click", openProposeModal);
document.getElementById("open-propose-2").addEventListener("click", openProposeModal);
document.getElementById("pf-close").addEventListener("click", closeProposeModal);
document.getElementById("pf-cancel").addEventListener("click", closeProposeModal);
document.getElementById("propose-overlay").addEventListener("click", e => { if (e.target === e.currentTarget) closeProposeModal(); });

// Enrichissement IA via la Cloudflare Function (/api/enrich). Renvoie un objet
// { trouve, titre_exact, auteur_exact, genre, nb_pages, description_3_mots, annee, isbn13 } ou null.
async function fetchEnrichment(titre, auteur) {
  try {
    const r = await fetch(`/api/enrich?titre=${encodeURIComponent(titre)}&auteur=${encodeURIComponent(auteur || "")}`);
    const d = await r.json().catch(() => null);
    if (!r.ok || !d || d.error) return null;
    return d;
  } catch { return null; }
}

// Garde-fou : on n'écrit les infos QUE si le livre identifié par l'IA correspond
// vraiment (un mot du titre OU de l'auteur en commun). Évite d'écraser « 1984 »
// avec les infos de « Fondation » si l'IA se trompe de livre.
function normWords(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
}
function plausibleMatch(titre, auteur, enr) {
  if (!enr || !enr.trouve) return false;
  const exTitle = normWords(enr.titre_exact);
  const exAuthor = normWords(enr.auteur_exact);
  if (!exTitle.length && !exAuthor.length) return false;
  const inTitle = normWords(titre).filter(w => w.length >= 3 || /^[0-9]+$/.test(w));
  const inAuthor = normWords(auteur).filter(w => w.length >= 3);
  const titleOk = inTitle.some(w => exTitle.includes(w));
  const authorOk = inAuthor.some(w => exAuthor.includes(w));
  return titleOk || authorOk;
}

document.getElementById("pf-submit").addEventListener("click", async () => {
  const titre = document.getElementById("pf-titre").value.trim();
  if (!titre) { showToast("Le titre est obligatoire.", "error"); return; }
  const propose_par = document.getElementById("pf-par").value;
  if (!propose_par) { showToast("Choisissez un membre.", "error"); return; }
  const auteur = document.getElementById("pf-auteur").value.trim();

  const btn = document.getElementById("pf-submit");
  const oldLabel = btn.textContent;
  btn.disabled = true; btn.textContent = "Enrichissement…";

  let annee = document.getElementById("pf-annee").value;
  let genre = null, nb_pages = null, description_3_mots = null, isbn13 = null;

  try {
    // Genre / pages / description / ISBN sont toujours fournis par l'IA
    const enr = await fetchEnrichment(titre, auteur);
    if (enr && plausibleMatch(titre, auteur, enr)) {
      genre = enr.genre || null;
      nb_pages = enr.nb_pages || null;
      description_3_mots = enr.description_3_mots || null;
      isbn13 = enr.isbn13 || null;
      if (!annee && enr.annee) annee = enr.annee;
    }

    await addLivre({
      titre, auteur, annee, propose_par,
      date_proposition: new Date().toISOString().split("T")[0],
      genre, nb_pages, description_3_mots, isbn13,
    });
    showToast("Livre proposé !", "success");
    closeProposeModal();
    livres = await getLivres();
    renderVisual();
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  } finally {
    btn.disabled = false; btn.textContent = oldLabel;
  }
});

// ── Copier la liste des propositions ──────────────────────────────
document.getElementById("btn-copy").addEventListener("click", () => {
  const props = livres.filter(l => l.statut === "en_proposition");
  if (!props.length) { showToast("Aucune proposition à copier.", "error"); return; }
  const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const lines = props.map(l => {
    let line = `- ${l.titre}`;
    if (l.auteur) line += ` de ${l.auteur}`;
    if (l.annee) line += ` (${l.annee})`;
    const d = toDate(l.date_proposition);
    if (d) line += ` - depuis ${MOIS[d.getMonth()]}`;
    return line;
  });
  navigator.clipboard.writeText(`Propositions de livres :\n${lines.join('\n')}`)
    .then(() => showToast("Liste copiée !", "success"))
    .catch(() => showToast("Impossible de copier.", "error"));
});

// ── Init ──────────────────────────────────────────────────────────
async function init() {
  [livres, membres, votes, reunions] = await Promise.all([getLivres(), getMembres(), getVotes(), getReunions()]);
  renderVisual();
  const openId = params.get("open");
  if (openId) openFiche(openId);
}

init().catch(console.error);
