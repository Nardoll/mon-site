import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import {
  getMembres, getLivres, getVotes, getReunions, getVoteActif,
  getStatutsForLivre, upsertStatutLecture, getLivreById,
  updateLivre, addProgressionPoint, getProgressionForLivre,
  updateReunion,
} from "./db.js";
import { formatMois, MOIS_NOMS, showToast } from "./utils.js";
import { hydrateCover } from "./covers.js";
import { buildSeries, buildChartSVG, buildSparkSVG, buildLegendHTML, wireHighlight, wireTooltip } from "./progression-chart.js";

await requireAuth();
initNav("accueil");

// ── Icônes SVG ────────────────────────────────────────────────────
const ICON_CHECK  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const ICON_PEN    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const ICON_CLOCK  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const ICON_NOTE   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 10h7M8 14h5"/></svg>';
const ICON_USER   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>';
const ICON_USERS  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.7-4.7"/></svg>';
const ICON_TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>';
const ICON_VOTE   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 13 2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg>';
const ICON_LAYERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>';
const ICON_GEAR   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
const ICON_COMMENT= '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z"/></svg>';
const ICON_OWNED  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H18a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z"/><path d="M6 20a2 2 0 0 1-2-2 1.5 1.5 0 0 1 1.5-1.5H20"/></svg>';

const MFR_SHORT = ['JANV','FÉVR','MARS','AVR','MAI','JUIN','JUIL','AOÛT','SEPT','OCT','NOV','DÉC'];
const MFR_FULL  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// ── Palettes couleurs ─────────────────────────────────────────────
const PALETTE = ['#b5572d','#1a8a55','#3f6cc4','#8a5cc4','#c4923f','#c44d6a','#2f9e9e','#6b7b3a','#9c4dab','#4f6b8a'];
const TINTS = [
  ['#3f5340','#273829'],['#7a3b2e','#56281f'],['#39505c','#25363d'],
  ['#8a6a2f','#5b4420'],['#5a4636','#382a20'],['#4a4038','#2f2822'],
  ['#6b4a52','#432d36'],['#4a5a6b','#2d3842'],['#6b5a3e','#433822'],
  ['#3f4a3f','#262f26'],['#6b3f4a','#42262d'],['#5a6b4a','#37422e'],
];

function bookTint(id = '') {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

// ── State ─────────────────────────────────────────────────────────
let allVotes = [], allMembres = [], allLivres = [], allReunions = [];
let currentLivre = null, currentLivreId = null, currentVote = null, voteActif = null;
let statutByMembre = {}, progressionData = [];
let friseVariant = 'fil';
let editMembreId = null;

// ── Helpers ───────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}

function memColor(id) {
  const idx = allMembres.findIndex(m => m.id === id);
  return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
}

function memNom(id) {
  return allMembres.find(m => m.id === id)?.nom ?? '—';
}

function isHierarchique() {
  return currentLivre?.progression_mode === 'hierarchique' && currentLivre?.progression_parties?.length > 0;
}

function totalChapitres(parties = []) {
  return parties.reduce((s, n) => s + n, 0);
}

function toAbsolute(partie, chapitre, parties) {
  let abs = 0;
  for (let i = 0; i < partie - 1; i++) abs += parties[i];
  return abs + chapitre;
}

function fromAbsolute(pos, parties) {
  let rem = pos;
  for (let i = 0; i < parties.length; i++) {
    if (rem <= parties[i]) return { partie: i + 1, chapitre: rem };
    rem -= parties[i];
  }
  return { partie: parties.length, chapitre: parties[parties.length - 1] };
}

function pctFromStatut(s) {
  if (!s) return 0;
  if (s.statut === 'termine') return 100;
  if (!s.page_actuelle || !s.pages_totales) return 0;
  return Math.min(100, Math.round(s.page_actuelle / s.pages_totales * 100));
}

function barState(s) {
  if (!s || s.statut === 'pas_commence') return { cls: 'none', html: 'Pas commencé' };
  if (s.statut === 'achete') return { cls: 'owned', html: `${ICON_OWNED} Livre possédé` };
  if (s.statut === 'termine') return { cls: 'done', html: `${ICON_CHECK} Terminé` };
  const pct = pctFromStatut(s);
  if (isHierarchique() && s.page_actuelle) {
    const { partie, chapitre } = fromAbsolute(Number(s.page_actuelle), currentLivre.progression_parties);
    return { cls: 'prog', html: `P${partie} · Ch.${chapitre} · <b>${pct}%</b>` };
  }
  const unite = currentLivre?.progression_unite || '';
  if (s.page_actuelle && s.pages_totales) {
    return { cls: 'prog', html: `${s.page_actuelle}/${s.pages_totales}${unite ? ' ' + unite : ''} · <b>${pct}%</b>` };
  }
  return { cls: 'prog', html: `En cours · <b>${pct}%</b>` };
}

function progressionLabelText(livre) {
  if (!livre) return '';
  if (livre.progression_mode === 'hierarchique' && livre.progression_parties?.length) {
    const parties = livre.progression_parties;
    return `Suivi hiérarchique · ${parties.length} partie${parties.length > 1 ? 's' : ''} · ${totalChapitres(parties)} chapitres`;
  }
  const u = livre.progression_unite, t = livre.progression_total;
  if (u && t) return `Suivi en ${u} · total ${t}`;
  if (u) return `Suivi en ${u}`;
  return 'Aucun suivi configuré';
}

function computeNoteFinale(reunion) {
  if (!reunion?.notes_finales) return null;
  const notes = Object.values(reunion.notes_finales).map(Number).filter(n => !isNaN(n) && n > 0);
  return notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null;
}

// ── Graphique SVG (module partagé progression-chart.js) ───────────
// 1er jour du mois de lecture du livre du mois (sert d'axe X au graphe).
function currentMonthStart() {
  const now = new Date();
  return currentVote
    ? new Date(currentVote.annee, currentVote.mois - 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
}

async function buildProgressionSeries() {
  if (!currentLivreId) return [];
  const points = await getProgressionForLivre(currentLivreId);
  progressionData = points;
  return buildSeries(points, allMembres, currentMonthStart());
}

// ── En-tête hero ──────────────────────────────────────────────────
function renderHero() {
  const now = new Date();
  const f = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  document.getElementById('home-date').textContent = f.charAt(0).toUpperCase() + f.slice(1);

  const latestVote = [...allVotes].filter(v => v.livre_elu).sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois).at(-1);
  if (latestVote && currentLivre) {
    const termines = Object.values(statutByMembre).filter(s => s.statut === 'termine').length;
    const total = allMembres.length;
    document.getElementById('home-sub').innerHTML =
      `Ce mois-ci, le club lit <em>${esc(currentLivre.titre)}</em> de ${esc(currentLivre.auteur || '—')} — ${termines} membre${termines > 1 ? 's' : ''} sur ${total} l'ont déjà terminé.`;
  } else {
    document.getElementById('home-sub').textContent = 'Bienvenue dans le club de lecture.';
  }

  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const left = Math.max(0, Math.ceil((endMonth - now) / 86400000));
  const nextMonth = MFR_FULL[(now.getMonth() + 1) % 12];
  const nomLivre = currentLivre?.titre ? esc(currentLivre.titre) : 'le livre';
  document.getElementById('home-deadline').innerHTML =
    `<div class="dl-num"><b>${left}</b><small>jour${left > 1 ? 's' : ''}</small></div>
     <div class="dl-txt">pour terminer <em>${nomLivre}</em> et proposer le livre de <b>${nextMonth}</b> avant la fin du mois.</div>`;
}

// ── Livre du mois ─────────────────────────────────────────────────
async function renderLivreMois() {
  const mount = document.getElementById('lm-mount');
  const elus = allVotes.filter(v => v.livre_elu).sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);

  if (!elus.length) {
    mount.innerHTML = `<p style="color:var(--muted);font-size:.9rem;padding:1rem 0">Aucun livre élu pour l'instant.</p>`;
    return;
  }

  currentVote = elus.at(-1);
  currentLivreId = currentVote.livre_elu;
  currentLivre = await getLivreById(currentLivreId);
  const statuts = await getStatutsForLivre(currentLivreId);
  statutByMembre = {};
  statuts.forEach(s => { statutByMembre[s.membre_id] = s; });

  const [g1, g2] = bookTint(currentLivreId);
  const r = (currentVote.resultats || []).find(x => x.livre_id === currentLivreId);
  const noteVote = r?.moyenne != null ? `Sélection ${Number(r.moyenne).toFixed(1)}/5` : null;
  const moisLabel = formatMois(currentVote.mois, currentVote.annee);

  const hier = isHierarchique();
  const trackLabel = progressionLabelText(currentLivre);

  // Tous les membres ayant une entrée de suivi (y compris pas_commence)
  const membresAvecSuivi = allMembres.filter(m => !!statutByMembre[m.id]).sort((a, b) => {
    const sa = statutByMembre[a.id], sb = statutByMembre[b.id];
    const order = { termine: 3, en_cours: 2, achete: 1, pas_commence: 0 };
    const diff = (order[sb.statut] || 0) - (order[sa.statut] || 0);
    if (diff !== 0) return diff;
    return pctFromStatut(sb) - pctFromStatut(sa);
  });

  const series = await buildProgressionSeries();

  const bars = membresAvecSuivi.map(m => {
    const s = statutByMembre[m.id];
    const pct = pctFromStatut(s);
    const st = barState(s);
    const col = memColor(m.id);
    return `<div class="mrow" data-id="${m.id}">
      <div class="ava" style="background:${s.statut === 'pas_commence' ? '#b9a88f' : col}">${esc(m.nom[0])}</div>
      <div class="mname">${esc(m.nom)}</div>
      <div class="track"><div class="fill${s.statut === 'termine' ? ' done' : ''}" style="width:${pct}%;background:${s.statut === 'pas_commence' ? 'transparent' : col}"></div></div>
      <div class="mstate-wrap"><span class="bar-state ${st.cls}">${st.html}</span><span class="mpen">${ICON_PEN}</span></div>
    </div>`;
  }).join('');

  mount.innerHTML = `
    <div class="lm">
      <div class="lm-hero-cover">
        <div class="lm-cover" id="lm-cover" style="--g1:${g1};--g2:${g2}">
          <div class="c-kicker">Lecture en cours</div>
          <div class="c-title">${esc(currentLivre?.titre || '—')}</div>
          <div class="c-author">${esc(currentLivre?.auteur || '')}</div>
          <div class="c-foot">
            <span>${currentLivre?.annee || ''}</span>
            ${currentLivre?.nb_pages ? `<span>${currentLivre.nb_pages} p.</span>` : ''}
          </div>
        </div>
      </div>
      <div class="lm-panel">
        <div class="lm-eyebrow">Élu pour ${esc(moisLabel)}</div>
        <div class="lm-title">${esc(currentLivre?.titre || '—')}</div>
        <div class="lm-author">${esc(currentLivre?.auteur || '')}</div>
        <div class="lm-meta">
          ${currentLivre?.genre ? `<span class="lm-chip">${esc(currentLivre.genre)}</span>` : ''}
          ${currentLivre?.nb_pages ? `<span class="lm-chip">${currentLivre.nb_pages} p.</span>` : ''}
          ${noteVote ? `<span class="lm-chip accent">${esc(noteVote)}</span>` : ''}
        </div>
        <div class="lm-track-head">
          <span class="lm-track-meta">${ICON_LAYERS}<span>${esc(trackLabel)}</span></span>
          <button class="cfg-btn" id="lm-cfg">${ICON_GEAR} Configurer le suivi</button>
        </div>
        ${membresAvecSuivi.length ? `<div class="lm-hint">${ICON_PEN} Cliquez sur un membre pour modifier son suivi.</div>` : ''}
        <div class="lm-bars" id="lm-bars">${bars}</div>
        ${membresAvecSuivi.length === 0 ? `<p style="font-size:.82rem;color:var(--muted);margin:.5rem 0 1rem">Aucun suivi enregistré pour l'instant.</p>` : ''}
        ${(() => {
          // Untracked = aucune entrée dans statutByMembre (pas simplement hors des barres)
          const untracked = allMembres.filter(m => !statutByMembre[m.id]);
          return untracked.length ? `
          <div class="lm-add-row" id="lm-add-row" style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
            <select id="lm-add-sel" style="font-size:.8rem;padding:.3rem .5rem;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--ink);flex:1;min-width:0">
              ${untracked.map(m => `<option value="${esc(m.id)}">${esc(m.nom)}</option>`).join('')}
            </select>
            <button id="lm-add-btn" class="btn btn-secondary" style="font-size:.78rem;padding:.3rem .75rem;white-space:nowrap">${ICON_PEN} Ajouter au suivi</button>
          </div>` : '';
        })()}
        <div class="lm-graph-card" id="lm-graph-card">
          ${series.length > 0 ? buildSparkSVG(series) : '<svg class="spark" viewBox="0 0 130 46"><line x1="8" y1="38" x2="122" y2="38" stroke="var(--border)" stroke-width="1"/><text x="65" y="22" text-anchor="middle" fill="var(--muted)" font-size="9" font-family=\'Segoe UI,sans-serif\'>Aucune donnée ce mois</text></svg>'}
          <div class="gc-txt"><div class="gc-t">Évolution des lectures</div><div class="gc-s">${series.length > 0 ? 'La course du club, jour après jour' : 'Les données apparaîtront après les mises à jour'}</div></div>
          <span class="gc-arrow">→</span>
        </div>
        <div class="lm-foot">
          <button class="btn btn-secondary" id="lm-voir-comments">${ICON_COMMENT} Voir les commentaires</button>
          <button class="btn btn-secondary" id="lm-laisser-comment">${ICON_COMMENT} Laisser un commentaire</button>
        </div>
      </div>
    </div>`;

  // Wiring livre du mois
  hydrateCover(document.getElementById('lm-cover'), currentLivre);
  document.getElementById('lm-cover').addEventListener('click', openFicheCurrent);
  document.getElementById('lm-cfg').addEventListener('click', openCfgModal);
  document.getElementById('lm-voir-comments').addEventListener('click', () => {
    window.location.href = `commentaires.html?livre=${currentLivreId}`;
  });
  document.getElementById('lm-laisser-comment').addEventListener('click', openCommentaireModal);
  document.getElementById('lm-bars').addEventListener('click', e => {
    const row = e.target.closest('.mrow');
    if (row) openMembreEdit(row.dataset.id);
  });
  document.getElementById('lm-graph-card')?.addEventListener('click', openGraphModal);

  // Ajouter un membre au suivi → ouvrir directement le modal d'édition
  document.getElementById('lm-add-btn')?.addEventListener('click', async () => {
    const sel = document.getElementById('lm-add-sel');
    const membreId = sel?.value;
    if (!membreId || !currentLivreId) return;
    try {
      await upsertStatutLecture({ membre_id: membreId, livre_id: currentLivreId, statut: 'pas_commence', page_actuelle: '', pages_totales: '' });
      await reloadStatuts();
      await renderLivreMois();
      openMembreEdit(membreId);
    } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
  });
}

async function reloadStatuts() {
  const statuts = await getStatutsForLivre(currentLivreId);
  statutByMembre = {};
  statuts.forEach(s => { statutByMembre[s.membre_id] = s; });
}

function refreshBars() {
  const bars = document.getElementById('lm-bars');
  if (!bars) return;
  const membresAvecSuivi = allMembres.filter(m => !!statutByMembre[m.id]).sort((a, b) => {
    const sa = statutByMembre[a.id], sb = statutByMembre[b.id];
    const order = { termine: 3, en_cours: 2, achete: 1, pas_commence: 0 };
    const diff = (order[sb.statut] || 0) - (order[sa.statut] || 0);
    return diff !== 0 ? diff : pctFromStatut(sb) - pctFromStatut(sa);
  });
  bars.innerHTML = membresAvecSuivi.map(m => {
    const s = statutByMembre[m.id];
    const pct = pctFromStatut(s);
    const st = barState(s);
    const col = memColor(m.id);
    return `<div class="mrow" data-id="${m.id}">
      <div class="ava" style="background:${s.statut === 'pas_commence' ? '#b9a88f' : col}">${esc(m.nom[0])}</div>
      <div class="mname">${esc(m.nom)}</div>
      <div class="track"><div class="fill${s.statut === 'termine' ? ' done' : ''}" style="width:${pct}%;background:${s.statut === 'pas_commence' ? 'transparent' : col}"></div></div>
      <div class="mstate-wrap"><span class="bar-state ${st.cls}">${st.html}</span><span class="mpen">${ICON_PEN}</span></div>
    </div>`;
  }).join('');
  bars.addEventListener('click', e => {
    const row = e.target.closest('.mrow');
    if (row) openMembreEdit(row.dataset.id);
  });
}

// ── Fiche livre (overlay papier) ─────────────────────────────────
function openFicheCurrent() {
  if (!currentLivre) return;
  const [g1, g2] = bookTint(currentLivreId);
  const r = (currentVote?.resultats || []).find(x => x.livre_id === currentLivreId);
  const reunion = allReunions.find(ru => ru.livre_id === currentLivreId);
  const noteFinale = computeNoteFinale(reunion);

  const avHtml = allMembres.filter(m => statutByMembre[m.id]).map(m => {
    const s = statutByMembre[m.id];
    const st = barState(s);
    return `<div class="fiche-av-row"><span>${esc(m.nom)}</span>${
      s.statut === 'termine' ? `<span class="fiche-av-done">${ICON_CHECK} Terminé</span>` :
      s.statut === 'en_cours' ? `<span class="fiche-av-prog">En cours · ${pctFromStatut(s)}%</span>` :
      s.statut === 'achete' ? `<span class="fiche-av-owned">Livre possédé</span>` :
      `<span class="fiche-av-none">Pas commencé</span>`
    }</div>`;
  }).join('');

  const hist = [];
  if (currentLivre.date_proposition) {
    const d = toDate(currentLivre.date_proposition);
    hist.push({ label: `Proposé le ${d?.toLocaleDateString('fr-FR') ?? '—'}`, sub: `par ${memNom(currentLivre.propose_par)}` });
  }
  if (r) hist.push({ label: `Vote de ${formatMois(currentVote.mois, currentVote.annee)}`, sub: `Sélection : ${Number(r.moyenne).toFixed(1)} / 5` });
  hist.push({ label: `Élu pour ${formatMois(currentVote.mois, currentVote.annee)}`, kind: 'elu' });
  hist.push({ label: 'En lecture par le club' });

  const reunionHtml = reunion && noteFinale != null ? `
    <div class="fiche-divider"></div>
    <div class="fiche-sec-title">${ICON_NOTE} Réunion</div>
    <div class="fiche-reunion-head">
      <span class="fiche-reunion-meta">${reunion.date ? toDate(reunion.date)?.toLocaleDateString('fr-FR') : '—'} · ${(reunion.participant_ids || []).length} participants</span>
      <span class="fiche-reunion-note">${noteFinale.toFixed(1)}/10</span>
    </div>
    <div class="fiche-reunion-notes">${
      Object.entries(reunion.notes_finales || {}).map(([id, n]) => `${esc(memNom(id))} <b>${n}</b>`).join(' · ')
    }</div>` : '';

  document.getElementById('fiche').innerHTML = `
    <div class="fiche-top"><button class="fiche-close" id="fiche-close">✕</button></div>
    <div class="fiche-head">
      <div class="fiche-cover" style="--g1:${g1};--g2:${g2}"><span>${esc(currentLivre.titre)}</span></div>
      <div class="fiche-htext">
        <div class="fiche-title">${esc(currentLivre.titre)}</div>
        <div class="fiche-author">${esc(currentLivre.auteur || '')}</div>
      </div>
    </div>
    <dl class="fiche-dl">
      ${currentLivre.auteur ? `<dt>Auteur</dt><dd>${esc(currentLivre.auteur)}</dd>` : ''}
      ${currentLivre.annee ? `<dt>Année</dt><dd>${currentLivre.annee}</dd>` : ''}
      ${currentLivre.genre ? `<dt>Genre</dt><dd>${esc(currentLivre.genre)}</dd>` : ''}
      ${currentLivre.nb_pages ? `<dt>Pages</dt><dd>${currentLivre.nb_pages}</dd>` : ''}
      <dt>Proposé par</dt><dd>${esc(memNom(currentLivre.propose_par))}</dd>
      <dt>Statut</dt><dd><span class="fiche-badge lecture">En lecture</span></dd>
    </dl>
    ${avHtml ? `<div class="fiche-divider"></div><div class="fiche-sec-title">${ICON_USERS} Avancement des membres</div><div class="fiche-av">${avHtml}</div>` : ''}
    <div class="fiche-divider"></div>
    <div class="fiche-sec-title">${ICON_CLOCK} Historique</div>
    <div class="fiche-tl">${hist.map(h => `<div class="fiche-tl-item ${h.kind ? 'is-' + h.kind : ''}"><div class="fiche-tl-label ${h.kind ? 'is-' + h.kind : ''}">${h.label}</div>${h.sub ? `<div class="fiche-tl-sub">${h.sub}</div>` : ''}</div>`).join('')}</div>
    ${reunionHtml}
    <div class="fiche-actions">
      <a href="commentaires.html?livre=${currentLivreId}" class="fiche-btn">${ICON_COMMENT} Commentaires de lecture</a>
    </div>`;

  const ov = document.getElementById('fiche-overlay');
  ov.classList.remove('hidden');
  hydrateCover(ov.querySelector('.fiche-cover'), currentLivre);
  document.getElementById('fiche-close').addEventListener('click', closeFiche);
}

function closeFiche() { document.getElementById('fiche-overlay').classList.add('hidden'); }

// Basculement du toggle « vraies couvertures » (sidebar) → re-render
document.addEventListener('ltr-covers-change', () => { renderLivreMois().catch(console.error); renderPalmares(); });

// ── Modal : édition suivi membre ──────────────────────────────────
function openMembreEdit(membreId) {
  editMembreId = membreId;
  const m = allMembres.find(x => x.id === membreId);
  const s = statutByMembre[membreId];
  const col = memColor(membreId);

  document.getElementById('me-ava').textContent = m?.nom?.[0] ?? '?';
  document.getElementById('me-ava').style.background = col;
  document.getElementById('me-name').textContent = m?.nom ?? '—';
  document.getElementById('me-sub').textContent = `${currentLivre?.titre ?? ''} · ${progressionLabelText(currentLivre)}`;
  document.getElementById('me-statut').value = s?.statut ?? 'pas_commence';

  const hier = isHierarchique();
  document.getElementById('me-pos-hier').classList.toggle('hidden', !hier);
  document.getElementById('me-pos-simple').classList.toggle('hidden', hier);

  if (hier && s?.page_actuelle) {
    const { partie, chapitre } = fromAbsolute(Number(s.page_actuelle), currentLivre.progression_parties);
    document.getElementById('me-partie').value = partie;
    document.getElementById('me-chap').value = chapitre;
  } else {
    document.getElementById('me-partie').value = '';
    document.getElementById('me-chap').value = '';
  }
  if (!hier) {
    document.getElementById('me-page').value = s?.page_actuelle ?? '';
    document.getElementById('me-total').value = s?.pages_totales ?? (currentLivre?.progression_total || '');
  }

  meToggle();
  document.getElementById('me-overlay').classList.remove('hidden');
}

function meToggle() {
  const v = document.getElementById('me-statut').value;
  const show = v === 'en_cours';
  document.getElementById('me-pos-hier').classList.toggle('hidden', !show || !isHierarchique());
  document.getElementById('me-pos-simple').classList.toggle('hidden', !show || isHierarchique());
  meHint();
}

function meHint() {
  const v = document.getElementById('me-statut').value;
  const h = document.getElementById('me-hint');
  if (v !== 'en_cours' || !isHierarchique()) { h.textContent = ''; return; }
  const p = +document.getElementById('me-partie').value || 0;
  const c = +document.getElementById('me-chap').value || 0;
  if (p && c && currentLivre?.progression_parties) {
    const parties = currentLivre.progression_parties;
    const abs = toAbsolute(p, c, parties);
    const total = totalChapitres(parties);
    h.textContent = `≈ ${Math.round(abs / total * 100)}% du livre`;
  } else {
    h.textContent = '';
  }
}

document.getElementById('me-statut').addEventListener('change', meToggle);
document.getElementById('me-partie').addEventListener('input', meHint);
document.getElementById('me-chap').addEventListener('input', meHint);
document.getElementById('me-close').addEventListener('click', () => document.getElementById('me-overlay').classList.add('hidden'));
document.getElementById('me-cancel').addEventListener('click', () => document.getElementById('me-overlay').classList.add('hidden'));
document.getElementById('me-overlay').addEventListener('click', e => { if (e.target.id === 'me-overlay') document.getElementById('me-overlay').classList.add('hidden'); });

document.getElementById('me-save').addEventListener('click', async () => {
  if (!editMembreId || !currentLivreId) return;
  const statut = document.getElementById('me-statut').value;
  let page_actuelle, pages_totales;

  if (isHierarchique()) {
    const parties = currentLivre.progression_parties;
    const partie = Number(document.getElementById('me-partie').value);
    const chapitre = Number(document.getElementById('me-chap').value);
    if (statut === 'en_cours' && partie && chapitre) {
      if (partie < 1 || partie > parties.length || chapitre < 1 || chapitre > parties[partie - 1]) {
        showToast('Partie / Chapitre invalide.', 'error'); return;
      }
      page_actuelle = toAbsolute(partie, chapitre, parties);
      pages_totales = totalChapitres(parties);
    } else {
      page_actuelle = '';
      pages_totales = totalChapitres(parties);
    }
  } else {
    // En dehors de « En cours », pas de page d'avancement (achete / pas_commence / termine).
    page_actuelle = statut === 'en_cours' ? document.getElementById('me-page').value : '';
    pages_totales = document.getElementById('me-total').value;
  }

  // Auto-passage en « terminé » quand l'avancement atteint (ou dépasse) le maximum du livre.
  let finalStatut = statut;
  if (statut === 'en_cours' && page_actuelle !== '' && pages_totales !== '' &&
      Number(pages_totales) > 0 && Number(page_actuelle) >= Number(pages_totales)) {
    finalStatut = 'termine';
  }
  const autoTermine = finalStatut === 'termine' && statut !== 'termine';

  try {
    await upsertStatutLecture({ membre_id: editMembreId, livre_id: currentLivreId, statut: finalStatut, page_actuelle, pages_totales });
    const pa = page_actuelle !== '' ? Number(page_actuelle) : null;
    const pt = pages_totales !== '' ? Number(pages_totales) : (currentLivre?.progression_total ?? null);
    // « Terminé » → le point de progression marque la fin du livre (100 %) pour le graphe.
    const effectivePa = (finalStatut === 'termine' && (!pa || pa === 0) && pt) ? pt : pa;
    if (effectivePa !== null && effectivePa > 0) {
      await addProgressionPoint({ livre_id: currentLivreId, membre_id: editMembreId, page_actuelle: effectivePa, pages_totales: pt });
    }
    // Terminé (manuel ou auto) → inscrire le membre comme lecteur sur la réunion du livre.
    if (finalStatut === 'termine') await ensureLecteurReunion(editMembreId);
    showToast(autoTermine ? 'Livre terminé ! 🎉' : 'Suivi mis à jour', 'success');
    document.getElementById('me-overlay').classList.add('hidden');
    await reloadStatuts();
    refreshBars();
    renderHero();
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
});

// Inscrit un membre dans `lecteurs_ids` de la réunion associée au livre courant.
// Sans réunion, rien à faire (le statut « termine » suffit déjà aux statistiques).
async function ensureLecteurReunion(membreId) {
  const reunion = allReunions.find(r => r.livre_id === currentLivreId);
  if (!reunion) return;
  // Réunion ancienne sans `lecteurs_ids` : on initialise à partir des notes existantes
  // pour ne pas perdre les lecteurs déjà comptés via notes_finales.
  const base = Array.isArray(reunion.lecteurs_ids)
    ? reunion.lecteurs_ids
    : Object.entries(reunion.notes_finales || {}).filter(([, n]) => Number(n) > 0).map(([id]) => id);
  if (base.includes(membreId)) return;
  const arr = [...base, membreId];
  await updateReunion(reunion.id, { lecteurs_ids: arr });
  reunion.lecteurs_ids = arr; // maj du cache local
}

// ── Modal : configurer le suivi ───────────────────────────────────
function renderPartiesList(parties) {
  const container = document.getElementById('cfg-parties');
  container.innerHTML = parties.map((n, i) => `
    <div class="partie-row" data-i="${i}">
      <span class="pl">Partie ${i + 1}</span>
      <input type="number" min="1" value="${n}" data-ch>
      ${parties.length > 1 ? `<button class="del" data-del>✕</button>` : '<span></span>'}
    </div>`).join('');
  updateCfgHint();
  container.querySelectorAll('[data-ch]').forEach(inp => inp.addEventListener('input', updateCfgHint));
  container.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', e => {
    const idx = +e.target.closest('.partie-row').dataset.i;
    const vals = [...container.querySelectorAll('[data-ch]')].map(inp => Number(inp.value) || 1);
    vals.splice(idx, 1);
    renderPartiesList(vals);
  }));
}

function updateCfgHint() {
  const inputs = document.getElementById('cfg-parties').querySelectorAll('[data-ch]');
  const total = [...inputs].reduce((s, inp) => s + (Number(inp.value) || 0), 0);
  document.getElementById('cfg-hint').textContent = total > 0 ? `Total : ${total} chapitres` : '';
}

function openCfgModal() {
  const mode = currentLivre?.progression_mode || 'simple';
  const hier = mode === 'hierarchique';
  document.querySelector('input[name="cfg-mode"][value="simple"]').checked = !hier;
  document.querySelector('input[name="cfg-mode"][value="hier"]').checked = hier;
  document.getElementById('cfg-simple').classList.toggle('hidden', hier);
  document.getElementById('cfg-hier').classList.toggle('hidden', !hier);
  document.getElementById('cfg-unite').value = currentLivre?.progression_unite || '';
  document.getElementById('cfg-total').value = currentLivre?.progression_total || '';
  const parties = currentLivre?.progression_parties;
  renderPartiesList(parties?.length ? parties : [1]);
  document.getElementById('cfg-overlay').classList.remove('hidden');
}

document.querySelectorAll('input[name="cfg-mode"]').forEach(r => r.addEventListener('change', e => {
  const hier = e.target.value === 'hier';
  document.getElementById('cfg-simple').classList.toggle('hidden', hier);
  document.getElementById('cfg-hier').classList.toggle('hidden', !hier);
}));

document.getElementById('cfg-add').addEventListener('click', () => {
  const inputs = document.getElementById('cfg-parties').querySelectorAll('[data-ch]');
  const vals = [...inputs].map(inp => Number(inp.value) || 1);
  renderPartiesList([...vals, 8]);
});

['cfg-close', 'cfg-cancel'].forEach(id => {
  document.getElementById(id).addEventListener('click', () => document.getElementById('cfg-overlay').classList.add('hidden'));
});
document.getElementById('cfg-overlay').addEventListener('click', e => { if (e.target.id === 'cfg-overlay') document.getElementById('cfg-overlay').classList.add('hidden'); });

document.getElementById('cfg-save').addEventListener('click', async () => {
  if (!currentLivreId) return;
  const hier = document.querySelector('input[name="cfg-mode"]:checked')?.value === 'hier';
  let updates;
  if (hier) {
    const inputs = document.getElementById('cfg-parties').querySelectorAll('[data-ch]');
    const parties = [...inputs].map(inp => Number(inp.value) || 1);
    if (!parties.length) { showToast('Définissez au moins une partie.', 'error'); return; }
    updates = { progression_mode: 'hierarchique', progression_parties: parties, progression_total: totalChapitres(parties), progression_unite: 'chapitres' };
  } else {
    const unite = document.getElementById('cfg-unite').value.trim();
    const total = document.getElementById('cfg-total').value;
    updates = { progression_mode: 'simple', progression_parties: null, progression_unite: unite || null, progression_total: total ? Number(total) : null };
  }
  try {
    await updateLivre(currentLivreId, updates);
    currentLivre = { ...currentLivre, ...updates };
    showToast('Suivi configuré', 'success');
    document.getElementById('cfg-overlay').classList.add('hidden');
    await renderLivreMois();
  } catch (e) { showToast('Erreur : ' + e.message, 'error'); }
});

// ── Modal : laisser un commentaire ────────────────────────────────
function openCommentaireModal() {
  if (!currentLivreId) return;
  window.location.href = `commentaires.html?livre=${currentLivreId}&new=1`;
}

// ── Modal : graphique plein ────────────────────────────────────────
async function openGraphModal() {
  const mount = document.getElementById('graph-mount');
  mount.innerHTML = '<p style="color:var(--muted);font-size:.85rem;text-align:center;padding:2rem">Chargement…</p>';
  document.getElementById('graph-overlay').classList.remove('hidden');
  const series = await buildProgressionSeries();
  if (!series.length) {
    mount.innerHTML = '<p style="color:var(--muted);font-size:.85rem;text-align:center;padding:2rem">Aucune donnée disponible.<br>Mettez à jour votre avancement pour voir les courbes apparaître.</p>';
    return;
  }
  mount.innerHTML = buildLegendHTML(series) + buildChartSVG(series, currentMonthStart(), { h: 340, unite: currentLivre?.progression_unite || '' });
  wireHighlight(mount);
  wireTooltip(mount);
}

document.getElementById('graph-close').addEventListener('click', () => document.getElementById('graph-overlay').classList.add('hidden'));
document.getElementById('graph-overlay').addEventListener('click', e => { if (e.target.id === 'graph-overlay') document.getElementById('graph-overlay').classList.add('hidden'); });

// ── Frise « Notre parcours » ──────────────────────────────────────
const EV_META = {
  proposition: { label: 'Proposition', icon: ICON_PEN },
  arrivee:     { label: 'Arrivée',     icon: ICON_USER },
  vote:        { label: 'Vote',        icon: ICON_VOTE },
  elu:         { label: 'Élu',         icon: ICON_TROPHY },
  reunion:     { label: 'Réunion',     icon: ICON_NOTE },
  avenir:      { label: 'À venir',     icon: ICON_CLOCK },
};
const EV_COLOR = {
  proposition: '#b5572d', arrivee: '#b08a5a',
  vote: '#8a5cc4', elu: '#1a8a55',
  reunion: '#3f6cc4', avenir: '#b5572d',
};

function buildFriseEvents() {
  const events = [];

  allMembres.forEach(m => {
    const d = toDate(m.date_arrivee);
    if (!d) return;
    events.push({ d: d.toISOString().split('T')[0], type: 'arrivee', title: m.nom, who: 'rejoint le club', navId: m.id, navPage: 'membres' });
  });

  allLivres.filter(l => l.date_proposition).forEach(l => {
    const d = toDate(l.date_proposition);
    if (!d) return;
    events.push({ d: d.toISOString().split('T')[0], type: 'proposition', title: l.titre, who: `par ${memNom(l.propose_par)}`, navId: l.id, navPage: 'bibliotheque' });
  });

  allVotes.forEach(v => {
    const d = v.date ? toDate(v.date) : new Date(v.annee, v.mois - 1, 15);
    const dateStr = d.toISOString().split('T')[0];
    if (v.livre_elu) {
      const r = (v.resultats || []).find(x => x.livre_id === v.livre_elu);
      const titre = r?.titre ?? allLivres.find(l => l.id === v.livre_elu)?.titre ?? 'Livre élu';
      events.push({ d: dateStr, type: 'elu', title: titre, who: `Élu pour ${formatMois(v.mois, v.annee)}`, navId: v.id, navPage: 'votes' });
    } else {
      events.push({ d: dateStr, type: 'vote', title: `Vote de ${formatMois(v.mois, v.annee)}`, who: `${(v.resultats || []).length} livres en lice`, navId: v.id, navPage: 'votes' });
    }
  });

  allReunions.forEach(r => {
    const d = r.date ? toDate(r.date) : new Date(r.annee, r.mois - 1, 15);
    const dateStr = d.toISOString().split('T')[0];
    const livre = allLivres.find(l => l.id === r.livre_id);
    const titre = livre?.titre ?? `Réunion ${formatMois(r.mois, r.annee)}`;
    const noteFinale = computeNoteFinale(r);
    if (r.statut === 'prevue') {
      events.push({ d: dateStr, type: 'avenir', title: titre, who: 'à venir — pensez à noter', navId: r.id, navPage: 'reunions' });
    } else {
      events.push({ d: dateStr, type: 'reunion', title: titre, who: noteFinale != null ? `Réunion · ${noteFinale.toFixed(1)}/10` : 'Réunion', navId: r.id, navPage: 'reunions' });
    }
  });

  events.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  return events;
}

function drawFilSeam() {
  const track = document.querySelector('.fil-track');
  if (!track) return;
  const w = track.scrollWidth, h = track.clientHeight || 336, cy = h / 2;
  const noise = i => { const s = Math.sin(i * 12.9898) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const base = x => cy + Math.sin(x * 0.016) * 3.2 + noise(x * 0.5) * 2.4;
  let dashes = '', x = 18, k = 0;
  while (x < w - 18) {
    const len = 7 + (noise(k) + 1) * 3;
    const x2 = Math.min(w - 18, x + len);
    const y1 = base(x) + noise(k + 7) * 1.3;
    const y2 = base(x2) + noise(k + 13) * 1.3;
    const mx = (x + x2) / 2, my = base(mx) + noise(k + 3) * 2.2;
    dashes += `<path d="M ${x.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
    x = x2 + 5 + (noise(k + 5) + 1) * 2.2; k++;
  }
  track.insertAdjacentHTML('afterbegin', `<svg class="fil-seam" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${dashes}</svg>`);
}

function buildFil(events) {
  let html = '', lastKey = null, idx = 0;
  events.forEach((e, gi) => {
    const [Y, M, D] = e.d.split('-').map(Number);
    const m = M - 1;
    const key = Y + '-' + m;
    const meta = EV_META[e.type];
    const color = EV_COLOR[e.type];
    if (key !== lastKey) {
      html += `<div class="fil-month"><div class="fil-coin"><b>${MFR_SHORT[m]}</b><small>${Y}</small></div></div>`;
      lastKey = key;
    }
    const side = idx % 2 === 0 ? 'up' : 'down';
    const clickable = e.navId ? 'clickable' : '';
    const avenir = e.type === 'avenir' ? 'avenir' : '';
    const card = `<div class="fil-card ${clickable} ${avenir}">
      <div class="fil-stamp"><b>${D}</b><small>${MFR_SHORT[m]}</small></div>
      <div class="fil-body">
        <span class="fil-type">${meta.icon}${meta.label}</span>
        <div class="fil-ttl">${esc(e.title)}</div>
        <div class="fil-sub">${esc(e.who)}</div>
      </div>
    </div>`;
    html += `<div class="fil-ev ${side}" style="--c:${color}" data-i="${gi}">
      <div class="fil-top">${side === 'up' ? card : ''}</div>
      <div class="fil-mid"><div class="fil-node">${meta.icon}</div></div>
      <div class="fil-bot">${side === 'down' ? card : ''}</div>
    </div>`;
    idx++;
  });
  return `<div class="fil-track">${html}</div>`;
}

function buildCarnet(events) {
  const groups = [];
  let cur = null;
  events.forEach((e, gi) => {
    const [Y, M] = e.d.split('-').map(Number);
    const key = Y + '-' + (M - 1);
    if (!cur || cur.key !== key) { cur = { key, Y, m: M - 1, items: [] }; groups.push(cur); }
    cur.items.push({ ...e, gi });
  });
  const nowKey = new Date().getFullYear() + '-' + new Date().getMonth();
  return `<div class="carnet-track">${groups.map(g => {
    const rows = g.items.map(e => {
      const D = parseInt(e.d.split('-')[2]);
      const meta = EV_META[e.type];
      const color = EV_COLOR[e.type];
      const clickable = e.navId ? 'clickable' : '';
      return `<div class="carnet-ev ${clickable}" style="--c:${color}" data-i="${e.gi}">
        <div class="carnet-day"><b>${D}</b><small>${MFR_SHORT[g.m]}</small></div>
        <div class="carnet-main">
          <span class="carnet-ev-type">${meta.icon}${meta.label}</span>
          <div class="carnet-ev-ttl">${esc(e.title)}</div>
          <div class="carnet-ev-sub">${esc(e.who)}</div>
        </div>
      </div>`;
    }).join('');
    return `<div class="carnet-col${g.key === nowKey ? ' now' : ''}">
      <div class="carnet-head">
        <div><span class="carnet-month">${MFR_FULL[g.m]}</span> <span class="carnet-year">${g.Y}</span></div>
        <span class="carnet-count">${g.items.length}</span>
      </div>
      <div class="carnet-list">${rows}</div>
    </div>`;
  }).join('')}</div>`;
}

let friseEvents = [];

function renderFrise() {
  friseEvents = buildFriseEvents();
  if (!friseEvents.length) {
    document.getElementById('frise-mount').innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:.5rem 0">Pas encore d\'événements.</p>';
    return;
  }
  const mount = document.getElementById('frise-mount');
  mount.innerHTML = friseVariant === 'fil' ? buildFil(friseEvents) : buildCarnet(friseEvents);
  if (friseVariant === 'fil') {
    requestAnimationFrame(() => {
      drawFilSeam();
      const wrap = document.getElementById('frise-wrap');
      if (wrap) wrap.scrollLeft = wrap.scrollWidth;
    });
  }
}

function wireFrise() {
  document.getElementById('frise-mount').addEventListener('click', ev => {
    const node = ev.target.closest('[data-i]');
    if (!node) return;
    const e = friseEvents[+node.dataset.i];
    if (!e?.navId) return;
    const pages = { bibliotheque: 'bibliotheque.html', membres: 'membres.html', votes: 'votes.html', reunions: 'reunions.html' };
    const page = pages[e.navPage];
    if (page) window.location.href = `${page}?open=${e.navId}`;
  });
  document.querySelectorAll('#frise-switch button').forEach(btn => btn.addEventListener('click', () => {
    friseVariant = btn.dataset.v;
    document.querySelectorAll('#frise-switch button').forEach(b => b.classList.toggle('active', b === btn));
    renderFrise();
    document.getElementById('frise-wrap').scrollLeft = 0;
  }));
}

// ── Palmarès ─────────────────────────────────────────────────────
function renderPalmares() {
  const elusAvecNote = allVotes
    .filter(v => v.livre_elu)
    .map(v => {
      const reunion = allReunions.find(r => r.livre_id === v.livre_elu);
      const nf = computeNoteFinale(reunion);
      const r = (v.resultats || []).find(x => x.livre_id === v.livre_elu);
      const livre = allLivres.find(l => l.id === v.livre_elu);
      return { livre_id: v.livre_elu, titre: r?.titre ?? livre?.titre ?? '—', auteur: r?.auteur ?? livre?.auteur ?? '', mois: v.mois, annee: v.annee, noteFinale: nf };
    })
    .filter(e => e.noteFinale !== null)
    .sort((a, b) => b.noteFinale - a.noteFinale);

  if (!elusAvecNote.length) {
    document.getElementById('podium').innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:.5rem 0">Les notes apparaîtront après les réunions.</p>';
    document.getElementById('rank-list').innerHTML = '';
    return;
  }

  const top = elusAvecNote.slice(0, 3);
  const rest = elusAvecNote.slice(3);

  document.getElementById('podium').innerHTML = top.map((b, i) => {
    const [g1, g2] = bookTint(b.livre_id);
    return `<div class="pp pp-${i + 1}" data-id="${b.livre_id}">
      <div class="pp-figure">
        <div class="pp-rank">${i + 1}</div>
        <div class="pp-cover" style="--g1:${g1};--g2:${g2}"><div class="pp-cover-ttl">${esc(b.titre)}</div></div>
      </div>
      <div class="pp-block">
        <div class="pp-eyebrow">${esc(formatMois(b.mois, b.annee))}</div>
        <div class="pp-title">${esc(b.titre)}</div>
        <div class="pp-author">${esc(b.auteur)}</div>
        <div class="pp-divider"></div>
        <div class="pp-note">${b.noteFinale.toFixed(1)}<span> / 10</span></div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('rank-list').innerHTML = rest.map((b, i) => `
    <div class="rank-row" data-id="${b.livre_id}">
      <div class="rank-num">${i + 4}</div>
      <div class="rank-mid">
        <div class="rank-title">${esc(b.titre)}</div>
        <div class="rank-author">${esc(b.auteur)}${b.auteur ? ' · ' : ''}${esc(formatMois(b.mois, b.annee))}</div>
      </div>
      <div class="rank-note">${b.noteFinale.toFixed(1)}<span> / 10</span></div>
    </div>`).join('');

  // Vraies couvertures sur le podium
  document.querySelectorAll('#podium .pp[data-id]').forEach(el => {
    hydrateCover(el.querySelector('.pp-cover'), allLivres.find(l => l.id === el.dataset.id));
  });

  // Clic → fiche livre (attaché une seule fois, résiste aux re-renders)
  if (!renderPalmares._wired) {
    renderPalmares._wired = true;
    const nav = id => window.location.href = `bibliotheque.html?open=${id}`;
    document.getElementById('podium').addEventListener('click', e => { const el = e.target.closest('[data-id]'); if (el) nav(el.dataset.id); });
    document.getElementById('rank-list').addEventListener('click', e => { const el = e.target.closest('[data-id]'); if (el) nav(el.dataset.id); });
  }
}

// ── Fiche overlay — click overlay / Escape ────────────────────────
document.getElementById('fiche-overlay').addEventListener('click', e => { if (e.target.id === 'fiche-overlay') closeFiche(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden')); });

// ── Init ──────────────────────────────────────────────────────────
// ── Encarts statut accueil (Réunion + Vote) ──────────────────────

function isReunionPrevue(r) {
  if (Object.keys(r.notes_finales || {}).length > 0) return false;
  const s = (r.statut || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (s.includes('pass') || s.includes('termin')) return false;
  const d = toDate(r.date);
  return !(d && d < new Date());
}

function buildReunionCard(r) {
  const JOURS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  if (!r) {
    return `<div class="hs-card is-empty">
      <div class="hs-eyebrow">${ICON_NOTE} Réunion</div>
      <div class="hs-title">Pas encore de séance prévue${currentLivre ? ` pour ${esc(currentLivre.titre)}` : ''}</div>
      <div class="hs-meta">Aucune réunion planifiée pour l'instant.</div>
      <a class="hs-cta ghost-acc" href="reunions.html">Réunions →</a>
    </div>`;
  }
  const d = toDate(r.date);
  const now = new Date();
  const jours = d ? Math.max(0, Math.ceil((d - now) / 86400000)) : null;
  const cachet = d ? `<div class="hs-cachet">
    <div class="cach-j">${d.getDate()}</div>
    <div class="cach-m">${MFR_SHORT[d.getMonth()]}<br>${d.getFullYear()}</div>
  </div>` : '';
  const meta = [
    d ? `${JOURS[d.getDay()]} ${d.getDate()} ${MFR_FULL[d.getMonth()]}` : null,
    jours === 0 ? "Aujourd'hui !" : jours === 1 ? 'Demain' : jours != null ? `Dans ${jours} jours` : null,
    (r.participant_ids || []).length > 0 ? `${r.participant_ids.length} présent${r.participant_ids.length > 1 ? 's' : ''} attendu${r.participant_ids.length > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');
  return `<div class="hs-card is-reunion">
    <div class="hs-eyebrow">${ICON_NOTE} Réunion</div>
    ${cachet}
    <div class="hs-title">Débrief de ${esc(currentLivre?.titre ?? '—')}</div>
    <div class="hs-meta">${esc(meta)}</div>
    <a class="hs-cta ghost-acc" href="reunions.html">Voir la séance →</a>
  </div>`;
}

function buildVoteCard() {
  if (!voteActif) {
    const now = new Date();
    const nomMois = MFR_FULL[(now.getMonth() + 1) % 12];
    return `<div class="hs-card is-empty">
      <div class="hs-eyebrow">${ICON_VOTE} Vote</div>
      <div class="hs-title">Aucun scrutin ouvert</div>
      <div class="hs-meta">Prochain : <b>livre de ${esc(nomMois)}</b> · ouverture le 1ᵉʳ ${esc(nomMois.toLowerCase())}</div>
      <a class="hs-cta ghost-pur" href="votes.html">Votes →</a>
    </div>`;
  }
  const bulletins = voteActif.bulletins || {};
  const membreIds = voteActif.membre_ids || [];
  const nb = Object.keys(bulletins).length;
  const tot = membreIds.length;
  const pct = tot ? nb / tot : 0;
  const circ = 94.25;
  const dash = (circ * pct).toFixed(1);
  const clotureDate = voteActif.expires_at ? toDate(voteActif.expires_at) : null;
  const joursR = clotureDate ? Math.max(0, Math.ceil((clotureDate - new Date()) / 86400000)) : null;
  const nb_livres = (voteActif.livre_ids || []).length;
  const meta = [
    `<b>${nb_livres} livre${nb_livres > 1 ? 's' : ''}</b> en lice`,
    joursR === 0 ? 'clôture aujourd\'hui' : joursR === 1 ? 'clôture demain' : joursR != null ? `clôture dans ${joursR} jours` : null,
  ].filter(Boolean).join(' · ');
  return `<div class="hs-card is-vote">
    <div class="hs-eyebrow">${ICON_VOTE} Vote</div>
    <div class="hs-ring-wrap">
      <svg class="hs-ring" viewBox="0 0 34 34">
        <circle class="ring-bg" cx="17" cy="17" r="15"/>
        <circle class="ring-fill" cx="17" cy="17" r="15" stroke-dasharray="${dash} ${circ}"/>
      </svg>
      <div class="hs-ring-txt"><b>${nb}/${tot}</b><br>bulletins reçus</div>
    </div>
    <div class="hs-title">Livre de ${formatMois(voteActif.mois, voteActif.annee)}</div>
    <div class="hs-meta">${meta}</div>
    <a class="hs-cta solid" href="vote.html">Voter →</a>
  </div>`;
}

function renderHomeStatus() {
  const mount = document.getElementById('hs-mount');
  if (!mount) return;
  const reunionPrevue = currentLivreId
    ? [...allReunions]
        .filter(r => r.livre_id === currentLivreId && isReunionPrevue(r))
        .sort((a, b) => (toDate(a.date) ?? new Date(9e14)) - (toDate(b.date) ?? new Date(9e14)))[0] ?? null
    : null;
  mount.innerHTML = buildReunionCard(reunionPrevue) + buildVoteCard();
}

async function init() {
  [allVotes, allMembres, allLivres, allReunions, voteActif] = await Promise.all([
    getVotes(), getMembres(), getLivres(), getReunions(), getVoteActif(),
  ]);
  await renderLivreMois();
  renderHero();
  renderHomeStatus();
  renderFrise();
  renderPalmares();
  wireFrise();
}

init();
