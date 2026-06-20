import { requireAuth } from "./auth.js";
import {
  getMembres, getLivres, getVotes, getReunions,
  addReunion, updateReunion,
  getSondageDispo, createSondageDispo, updateSondageReponse, cloturerSondage,
} from "./db.js";
import { initNav } from "./nav.js";
import { formatMois, formatDate, initiales } from "./utils.js";
import { hydrateCover } from "./covers.js";

await requireAuth();

// ── Constantes ──────────────────────────────────────────────────────────────
const PALETTE = [
  "#b5572d","#3f7a52","#6840d8","#bf8a2f","#5a7d8c",
  "#a8503f","#3f5340","#8a5a6b","#46708a","#9a6a2f",
];
const COVERS = [
  ["#46607a","#2c3d4f"], ["#5a4326","#3a2b18"], ["#6a3330","#42201d"],
  ["#3a3a3a","#222222"], ["#2f4a5c","#1d2f3d"], ["#3f3550","#262033"],
  ["#5a6b7a","#37434f"], ["#6b5a2f","#46401f"], ["#2f3a30","#1d251e"],
  ["#6b4a52","#432d36"],
];
const MOIS_NOMS = ["Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const IC = {
  check:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  cal:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>`,
  book:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h6v16H6a1 1 0 0 1-1-1z"/><path d="M11 4h2.5l3.5.6-2.2 14-3.8-.6z"/><path d="M19 20H6"/></svg>`,
  users:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.7-4.7"/></svg>`,
  note:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 10h7M8 14h5"/></svg>`,
  edit:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  arrowR: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="0.75em" height="0.75em" style="vertical-align:middle;flex-shrink:0"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
};

// ── État global ─────────────────────────────────────────────────────────────
let reunions = [], membres = [], livres = [], votes = [];
let sondageActif = null;
const membreById = {}, livreById = {};
// voteByMoisAnnee : "mois-annee" → vote (pour auto-détecter le livre élu)
const voteByMoisAnnee = {};

// State fiche réunion ouverte
let curReunion = null;
let editMode   = false;
// Notes temporaires pendant l'édition : { membre_id: number }
let editNotes  = {};
// ID de la réunion en cours d'édition dans le formulaire (null = création)
let editingReunionId = null;

// ── Helpers ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/**
 * Détermine si une réunion est "passée" de façon robuste.
 * On ne se fie pas uniquement au champ statut (valeurs variables en BDD) :
 * une réunion est passée si elle a des notes, ou si sa date est dans le passé.
 */
function isPasse(r) {
  // 1. Notes présentes → forcément passée
  if (Object.keys(r.notes_finales || {}).length > 0) return true;
  // 2. Statut contient "pass" ou "termin" (insensible à la casse/accents)
  const s = (r.statut || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (s.includes("pass") || s.includes("termin")) return true;
  // 3. Date explicitement dans le passé
  if (r.date) {
    const d = r.date.toDate ? r.date.toDate() : new Date(r.date);
    if (!isNaN(d) && d < new Date()) return true;
  }
  return false;
}

function dotDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
           .replace(/\//g, "·");
}

function calcAvg(notesFinales) {
  const vals = Object.values(notesFinales || {}).filter(v => v != null);
  return vals.length ? vals.reduce((s, v) => s + Number(v), 0) / vals.length : null;
}

function sealColor(avg) {
  if (avg === null) return "#9a7a4e";
  if (avg >= 8)   return "#1a7a4e";
  if (avg >= 6.5) return "#c0421e"; // terracotta vif
  return "#b83a1e";                 // rouge-brun même hors seuil
}

function coverOf(livreId) {
  const l = livreById[livreId];
  return l?._cover || COVERS[0];
}

// ── Helpers sondage ─────────────────────────────────────────────────────────
const JFR = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MFR_C = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

function joursFromDelta(avant, apres) {
  const now = new Date();
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const jours = [];
  for (let i = -avant; i <= apres; i++) {
    const d = new Date(fin); d.setDate(d.getDate() + i);
    jours.push(d.toISOString().split('T')[0]);
  }
  return jours;
}

function joursFromRange(debut, fin) {
  const jours = [];
  const d = new Date(debut + 'T12:00:00'), f = new Date(fin + 'T12:00:00');
  while (d <= f) { jours.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
  return jours;
}

function formatJour(iso) {
  const d = new Date(iso + 'T12:00:00');
  return { court: `${JFR[d.getDay()]} ${d.getDate()}`, long: `${JFR[d.getDay()]} ${d.getDate()} ${MFR_C[d.getMonth()]}` };
}

function computeScores(sondage) {
  const scores = {};
  (sondage.jours || []).forEach(j => { scores[j] = 0; });
  Object.values(sondage.reponses || {}).forEach(({ votes: v }) => {
    Object.entries(v || {}).forEach(([j, e]) => {
      if (e === 'dispo') scores[j] = (scores[j] || 0) + 1;
      else if (e === 'si_besoin') scores[j] = (scores[j] || 0) + 0.5;
    });
  });
  return scores;
}

function computeWinner(sondage) {
  const scores = computeScores(sondage);
  const now = new Date();
  const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let best = -1, winner = null;
  (sondage.jours || []).forEach(j => {
    const s = scores[j] || 0;
    if (s > best) { best = s; winner = j; return; }
    if (s === best && winner) {
      const dj = Math.abs(new Date(j + 'T12:00:00') - finMois);
      const dw = Math.abs(new Date(winner + 'T12:00:00') - finMois);
      if (dj < dw) winner = j;
    }
  });
  return best > 0 ? winner : null;
}

async function processClotureSondage(sondage) {
  const winner = computeWinner(sondage);
  let reunionId = null;

  if (winner) {
    const dateW = winner; // ISO string, updateReunion accepte string
    let reunion = reunions.find(r => r.livre_id === sondage.livre_id);
    if (reunion) {
      await updateReunion(reunion.id, { date: dateW, statut: 'prévue', sondage_id: sondage.id });
      reunionId = reunion.id;
    } else {
      const d = new Date(winner + 'T12:00:00');
      const ref = await addReunion({
        statut: 'prévue', date: dateW,
        mois: d.getMonth() + 1, annee: d.getFullYear(),
        livre_id: sondage.livre_id,
        participant_ids: [], lecteurs_ids: [], compte_rendu: '', lien_video: null,
      });
      reunionId = ref.id;
      await updateReunion(reunionId, { sondage_id: sondage.id });
    }
  }

  await cloturerSondage(sondage.id, { date_choisie: winner, reunion_id: reunionId });
  sondageActif = null;
  reunions = await getReunions();
  renderLedger();
  renderSondagePanel();
  toast(winner ? `Sondage clôturé — réunion prévue le ${formatJour(winner).long}` : 'Sondage clôturé sans date choisie.');
}

// ── Panneau sondage (colonne droite) ────────────────────────────────────────
function buildVoteGrid(sondage, scores, winner) {
  const jours = sondage.jours || [];
  const reponses = sondage.reponses || {};
  const ids = Object.keys(reponses);
  if (!ids.length) return `<p style="font-size:.8rem;color:var(--muted);font-style:italic;padding:.5rem 0">Aucune réponse pour l'instant.</p>`;
  const SYM = { dispo: '✓', si_besoin: '~', pas_dispo: '✗' };
  const heads = jours.map(j => `<th class="${j === winner ? 'best' : ''}">${formatJour(j).court}</th>`).join('');
  const rows = ids.map(mid => {
    const rep = reponses[mid];
    const nom = rep.nom || membreById[mid]?.nom || mid;
    const cells = jours.map(j => {
      const e = rep.votes?.[j] || ''; return `<td class="sp-cell ${e}">${SYM[e] || '—'}</td>`;
    }).join('');
    return `<tr><td class="sp-name">${esc(nom)}</td>${cells}</tr>`;
  }).join('');
  const scoreRow = jours.map(j => {
    const s = scores[j] || 0;
    return `<td class="${j === winner ? 'best' : ''}">${s % 1 ? s.toFixed(1) : s}</td>`;
  }).join('');
  return `<table class="sp-grid">
    <thead><tr><th></th>${heads}</tr></thead>
    <tbody>${rows}<tr class="sp-score-row"><td class="sp-name">Score</td>${scoreRow}</tr></tbody>
  </table>`;
}

function renderSondagePanel() {
  const mount = document.getElementById('sp-mount');
  if (!mount) return;

  if (!sondageActif) {
    mount.innerHTML = `
      <div class="sp-panel-head">
        <span class="sp-panel-title">Sondage de disponibilité</span>
      </div>
      <div class="sp-empty">
        <div class="sp-empty-icon">📅</div>
        <div style="line-height:1.5">Aucun sondage en cours.<br>Proposez des dates pour la prochaine réunion.</div>
      </div>`;
    return;
  }

  const s = sondageActif;
  const livre = livreById[s.livre_id];
  const cloture = s.cloture?.toDate ? s.cloture.toDate() : new Date(s.cloture);
  const joursR = Math.max(0, Math.ceil((cloture - new Date()) / 86400000));
  const expired = cloture < new Date();
  const clotStr = expired ? 'Clôture dépassée'
    : joursR === 0 ? "Clôture aujourd'hui"
    : joursR === 1 ? 'Clôture demain'
    : `Clôture dans ${joursR} j`;

  const scores = computeScores(s);
  const winner = computeWinner(s);
  const nb = Object.keys(s.reponses || {}).length;

  const winnerBanner = winner ? `
    <div class="sp-winner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
      <span>Meilleure date : <strong>${formatJour(winner).long}</strong></span>
    </div>` : '';

  mount.innerHTML = `
    <div class="sp-panel-head">
      <span class="sp-panel-title">${esc(livre?.titre ?? '—')}<small>${nb} réponse${nb !== 1 ? 's' : ''}</small></span>
      <span class="sp-cloture${expired ? ' expired' : ''}">${clotStr}</span>
    </div>
    ${winnerBanner}
    <div class="sp-grid-wrap">${buildVoteGrid(s, scores, winner)}</div>
    <div class="sp-actions">
      <button class="sp-btn-vote" id="sp-btn-vote">Remplir mes disponibilités</button>
      <button class="sp-btn-close-poll" id="sp-btn-close">Clôturer</button>
    </div>`;

  document.getElementById('sp-btn-vote').addEventListener('click', () => openVoter(s));
  document.getElementById('sp-btn-close').addEventListener('click', async () => {
    if (!confirm('Clôturer le sondage et planifier la réunion sur la date la plus disponible ?')) return;
    await processClotureSondage(s);
  });
}

// ── Créer un sondage ─────────────────────────────────────────────────────────
let sdModeDate = false, sdModeEcheance = false;

function updateSdPreview() {
  const isDelta = !sdModeDate;
  let jours;
  if (isDelta) {
    const avant = parseInt(document.getElementById('sd-avant').value) || 5;
    const apres = parseInt(document.getElementById('sd-apres').value) || 3;
    jours = joursFromDelta(avant, apres);
  } else {
    const debut = document.getElementById('sd-debut').value;
    const fin   = document.getElementById('sd-fin').value;
    jours = debut && fin && debut <= fin ? joursFromRange(debut, fin) : [];
  }
  const prev = document.getElementById('sd-preview');
  if (!prev) return;
  if (!jours.length) { prev.innerHTML = 'Sélectionnez une plage valide.'; return; }
  prev.innerHTML = `<b>${jours.length} jour${jours.length > 1 ? 's' : ''} :</b> ${jours.map(j => formatJour(j).court).join(', ')}`;
}

function openCreerSondage() {
  sdModeDate = false; sdModeEcheance = false;
  document.getElementById('sd-tab-delta').classList.add('active');
  document.getElementById('sd-tab-range').classList.remove('active');
  document.getElementById('sd-mode-delta').classList.remove('hidden');
  document.getElementById('sd-mode-range').classList.add('hidden');
  document.getElementById('sd-tab-duree').classList.add('active');
  document.getElementById('sd-tab-echeance').classList.remove('active');
  document.getElementById('sd-mode-duree').classList.remove('hidden');
  document.getElementById('sd-mode-echeance').classList.add('hidden');
  updateSdPreview();
  document.getElementById('sd-overlay').classList.remove('hidden');
}

function wireSondageForm() {
  document.getElementById('sd-tab-delta').addEventListener('click', () => {
    sdModeDate = false;
    document.getElementById('sd-tab-delta').classList.add('active');
    document.getElementById('sd-tab-range').classList.remove('active');
    document.getElementById('sd-mode-delta').classList.remove('hidden');
    document.getElementById('sd-mode-range').classList.add('hidden');
    updateSdPreview();
  });
  document.getElementById('sd-tab-range').addEventListener('click', () => {
    sdModeDate = true;
    document.getElementById('sd-tab-range').classList.add('active');
    document.getElementById('sd-tab-delta').classList.remove('active');
    document.getElementById('sd-mode-range').classList.remove('hidden');
    document.getElementById('sd-mode-delta').classList.add('hidden');
    updateSdPreview();
  });
  document.getElementById('sd-tab-duree').addEventListener('click', () => {
    sdModeEcheance = false;
    document.getElementById('sd-tab-duree').classList.add('active');
    document.getElementById('sd-tab-echeance').classList.remove('active');
    document.getElementById('sd-mode-duree').classList.remove('hidden');
    document.getElementById('sd-mode-echeance').classList.add('hidden');
  });
  document.getElementById('sd-tab-echeance').addEventListener('click', () => {
    sdModeEcheance = true;
    document.getElementById('sd-tab-echeance').classList.add('active');
    document.getElementById('sd-tab-duree').classList.remove('active');
    document.getElementById('sd-mode-echeance').classList.remove('hidden');
    document.getElementById('sd-mode-duree').classList.add('hidden');
  });
  ['sd-avant','sd-apres'].forEach(id => document.getElementById(id)?.addEventListener('input', updateSdPreview));
  ['sd-debut','sd-fin'].forEach(id => document.getElementById(id)?.addEventListener('change', updateSdPreview));

  document.getElementById('sd-close').addEventListener('click', () => document.getElementById('sd-overlay').classList.add('hidden'));
  document.getElementById('sd-cancel').addEventListener('click', () => document.getElementById('sd-overlay').classList.add('hidden'));
  document.getElementById('sd-overlay').addEventListener('click', e => { if (e.target.id === 'sd-overlay') document.getElementById('sd-overlay').classList.add('hidden'); });

  document.getElementById('sd-ok').addEventListener('click', async () => {
    // Compute jours
    let jours;
    if (!sdModeDate) {
      const avant = parseInt(document.getElementById('sd-avant').value) || 5;
      const apres = parseInt(document.getElementById('sd-apres').value) || 3;
      jours = joursFromDelta(avant, apres);
    } else {
      const debut = document.getElementById('sd-debut').value;
      const fin   = document.getElementById('sd-fin').value;
      if (!debut || !fin || debut > fin) { toast('Sélectionnez une plage de dates valide.'); return; }
      jours = joursFromRange(debut, fin);
    }
    if (!jours.length) { toast('Aucune date dans la plage sélectionnée.'); return; }

    // Compute cloture
    let cloture;
    if (!sdModeEcheance) {
      const val = parseInt(document.getElementById('sd-duree-val').value) || 5;
      const unite = document.getElementById('sd-duree-unite').value;
      cloture = new Date();
      cloture.setTime(cloture.getTime() + val * (unite === 'h' ? 3600000 : 86400000));
    } else {
      const dateE = document.getElementById('sd-ech-date').value;
      const heureE = document.getElementById('sd-ech-heure').value || '23:59';
      if (!dateE) { toast('Sélectionnez une date de clôture.'); return; }
      cloture = new Date(`${dateE}T${heureE}:00`);
    }

    // Find current livre
    const livreId = currentLivreIdForSondage();
    const btn = document.getElementById('sd-ok');
    btn.disabled = true; btn.textContent = 'Création…';
    try {
      await createSondageDispo({ livre_id: livreId, jours, cloture });
      sondageActif = await getSondageDispo();
      document.getElementById('sd-overlay').classList.add('hidden');
      renderSondagePanel();
      toast('Sondage ouvert !');
    } catch(e) {
      toast('Erreur : ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Ouvrir le sondage';
    }
  });
}

function currentLivreIdForSondage() {
  // Most recent elected book
  const v = [...votes].filter(v => v.livre_elu).sort((a, b) => a.annee !== b.annee ? b.annee - a.annee : b.mois - a.mois)[0];
  return v?.livre_elu ?? null;
}

// ── Voter : remplir ses disponibilités ───────────────────────────────────────
function openVoter(sondage) {
  const livre = livreById[sondage.livre_id];
  document.getElementById('vd-title').textContent = `Disponibilités — ${livre?.titre ?? '—'}`;

  const sel = document.getElementById('vd-membre');
  sel.innerHTML = `<option value="">— Choisir —</option>` +
    membres.map(m => `<option value="${esc(m.id)}">${esc(m.nom)}</option>`).join('');

  let currentVotes = {};
  const grid = document.getElementById('vd-grid');
  grid.innerHTML = '';

  function buildVdGrid(membreId) {
    const existing = sondage.reponses?.[membreId]?.votes || {};
    currentVotes = { ...existing };
    grid.innerHTML = sondage.jours.map(j => {
      const e = currentVotes[j] || '';
      const { long } = formatJour(j);
      return `<div class="vd-day-row" style="grid-template-columns:1fr auto">
        <div class="vd-day-label">${long}</div>
        <div class="vd-btns">
          <button class="vd-state-btn dispo ${e === 'dispo' ? 'active' : ''}" data-state="dispo" data-jour="${j}" title="Disponible">✓</button>
          <button class="vd-state-btn si_besoin ${e === 'si_besoin' ? 'active' : ''}" data-state="si_besoin" data-jour="${j}" title="Si besoin">~</button>
          <button class="vd-state-btn pas_dispo ${e === 'pas_dispo' ? 'active' : ''}" data-state="pas_dispo" data-jour="${j}" title="Pas disponible">✗</button>
        </div>
      </div>`;
    }).join('');
    grid.querySelectorAll('.vd-state-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const jour = btn.dataset.jour;
        currentVotes[jour] = btn.dataset.state;
        grid.querySelectorAll(`.vd-state-btn[data-jour="${jour}"]`).forEach(b => {
          b.classList.toggle('active', b.dataset.state === btn.dataset.state);
        });
      });
    });
  }

  sel.onchange = () => sel.value ? buildVdGrid(sel.value) : (grid.innerHTML = '');

  document.getElementById('vd-ok').onclick = async () => {
    const membreId = sel.value;
    if (!membreId) { toast('Choisissez un membre.'); return; }
    const m = membres.find(x => x.id === membreId);
    const btn = document.getElementById('vd-ok');
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    try {
      await updateSondageReponse(sondage.id, membreId, m?.nom ?? membreId, currentVotes);
      if (!sondageActif.reponses) sondageActif.reponses = {};
      sondageActif.reponses[membreId] = { nom: m?.nom ?? membreId, votes: { ...currentVotes } };
      document.getElementById('vd-overlay').classList.add('hidden');
      renderSondagePanel();
      toast('Disponibilités enregistrées !');
    } catch(e) {
      toast('Erreur : ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Enregistrer mes disponibilités';
    }
  };

  document.getElementById('vd-overlay').classList.remove('hidden');
}

// ── Init ────────────────────────────────────────────────────────────────────
async function init() {
  initNav("reunions");

  [reunions, membres, livres, votes, sondageActif] = await Promise.all([
    getReunions(), getMembres(), getLivres(), getVotes(), getSondageDispo(),
  ]);

  membres.forEach((m, i) => {
    m._color = PALETTE[i % PALETTE.length];
    membreById[m.id] = m;
  });
  livres.forEach((l, i) => {
    l._cover = COVERS[i % COVERS.length];
    livreById[l.id] = l;
  });
  votes.forEach(v => {
    voteByMoisAnnee[`${v.mois}-${v.annee}`] = v;
  });

  renderLedger();
  renderSondagePanel();

  // Auto-clôture si le sondage est expiré
  if (sondageActif) {
    const cloture = sondageActif.cloture?.toDate ? sondageActif.cloture.toDate() : new Date(sondageActif.cloture);
    if (cloture < new Date()) await processClotureSondage(sondageActif);
  }

  // Auto-ouvrir une réunion depuis l'URL ?open=ID (ex: frise "Notre parcours")
  const openId = new URLSearchParams(location.search).get("open");
  if (openId) openMeeting(openId);

  document.getElementById("btn-add").addEventListener("click", openAdd);
  document.getElementById("btn-sondage").addEventListener("click", () => {
    if (sondageActif) { toast("Un sondage est déjà en cours."); return; }
    openCreerSondage();
  });
  document.getElementById("mtg-overlay").addEventListener("click", e => {
    if (e.target.id === "mtg-overlay") closeMeeting();
  });
  document.getElementById("add-overlay").addEventListener("click", e => {
    if (e.target.id === "add-overlay") closeAdd();
  });
  document.getElementById("vd-close").addEventListener("click", () => document.getElementById("vd-overlay").classList.add("hidden"));
  document.getElementById("vd-cancel").addEventListener("click", () => document.getElementById("vd-overlay").classList.add("hidden"));
  document.getElementById("vd-overlay").addEventListener("click", e => { if (e.target.id === "vd-overlay") document.getElementById("vd-overlay").classList.add("hidden"); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeMeeting(); closeAdd(); document.getElementById("sd-overlay").classList.add("hidden"); document.getElementById("vd-overlay").classList.add("hidden"); }
  });

  wireSondageForm();
}

// ── Registre (liste) ─────────────────────────────────────────────────────────
function renderLedger() {
  const count = document.getElementById("ledger-count");
  const rows  = document.getElementById("reg-rows");

  const passees = reunions.filter(r => r.statut === "passée" || r.statut === "Passée");
  const prevues = reunions.filter(r => r.statut !== "passée" && r.statut !== "Passée");
  const all = [...passees, ...prevues]; // passées en premier (déjà triées par date desc par getReunions)

  count.textContent = `${reunions.length} séance${reunions.length > 1 ? "s" : ""} consignée${reunions.length > 1 ? "s" : ""}`;

  if (!all.length) {
    rows.innerHTML = `<p style="color:#a98a5c;font-style:italic;padding:.8rem 0">Aucune réunion enregistrée.</p>`;
    return;
  }

  rows.innerHTML = all.map(r => {
    const prevue = !isPasse(r);
    const livre  = livreById[r.livre_id];
    const titreLivre = livre?.titre || "—";
    const avg    = calcAvg(r.notes_finales);
    const seal   = sealColor(avg);

    // Pips : lecteurs → vert, présents non-lecteurs → orange (max 12)
    const lecteurs  = new Set(r.lecteurs_ids || []);
    const presents  = new Set(r.participant_ids || []);
    const everyone  = [...new Set([...presents, ...lecteurs])].slice(0, 12);
    const pips = everyone.map(mid => {
      const cls = lecteurs.has(mid) ? "lu" : presents.has(mid) ? "present" : "absent";
      return `<span class="reg-pip ${cls}"></span>`;
    }).join("");

    const nbPresents = presents.size;
    const nbLu       = lecteurs.size;

    const sealHtml = prevue
      ? `<span class="reg-seal" style="--seal:#9a7a4e"><span class="reg-seal-inner"><span class="reg-seal-note" style="font-size:1rem">à venir</span></span></span>`
      : avg === null
        ? `<span class="reg-seal" style="--seal:#9a7a4e"><span class="reg-seal-inner"><span class="reg-seal-note">—<span>/10</span></span><span class="reg-seal-label">non noté</span></span></span>`
        : `<span class="reg-seal" style="--seal:${seal}"><span class="reg-seal-inner"><span class="reg-seal-note">${avg.toFixed(1)}<span>/10</span></span><span class="reg-seal-label">note du club</span></span></span>`;

    return `
    <button class="reg-row${prevue ? " prevue" : ""}" data-id="${esc(r.id)}">
      <span class="reg-stamp">
        <span class="reg-stamp-label">${prevue ? "Prévue le" : "Séance du"}</span>
        <span class="reg-stamp-date">${dotDate(r.date)}</span>
      </span>
      <span class="reg-mid">
        <span class="reg-livre">${esc(titreLivre)}</span>
        <span class="reg-mois">livre de ${formatMois(r.mois, r.annee)}</span>
        <span class="reg-att">
          <span class="reg-pips">${pips}</span>
          <span class="reg-att-text"><b>${nbPresents}</b> présent·es · <b>${nbLu}</b> ${nbLu > 1 ? "ont" : "a"} lu</span>
        </span>
      </span>
      ${sealHtml}
    </button>`;
  }).join("");

  document.querySelectorAll(".reg-row").forEach(el =>
    el.addEventListener("click", () => openMeeting(el.dataset.id))
  );
}

// ── Fiche réunion ─────────────────────────────────────────────────────────────
function openMeeting(reunionId) {
  curReunion = reunions.find(r => r.id === reunionId);
  if (!curReunion) return;
  editMode = false;
  editNotes = { ...(curReunion.notes_finales || {}) };
  renderMeeting();
  document.getElementById("mtg-overlay").classList.remove("hidden");
  document.getElementById("mtg-paper").scrollTop = 0;
}

function closeMeeting() {
  document.getElementById("mtg-overlay").classList.add("hidden");
  curReunion = null; editMode = false;
}

function renderMeeting() {
  const r      = curReunion;
  const livre  = livreById[r.livre_id];
  const titre  = livre?.titre || "—";
  const [g1, g2] = coverOf(r.livre_id);
  const prevue = !isPasse(r);

  const notes  = r.notes_finales || {};
  const avg    = calcAvg(notes);
  const seal   = sealColor(avg);

  const lecteurs  = new Set(r.lecteurs_ids || []);
  const presents  = new Set(r.participant_ids || []);
  const everyone  = [...new Set([...presents, ...lecteurs, ...Object.keys(notes)])];

  // Tampons tour de table
  const tampons = everyone.map(mid => {
    const m   = membreById[mid];
    const nom = m?.nom || mid;
    const col = m?._color || "#8a5a3a";
    const lu  = lecteurs.has(mid);
    const pr  = presents.has(mid);
    const cls = (lu ? "lu " : "") + (pr ? "" : "absent");
    return `<div class="mtg-tampon ${cls}">
      <div class="mtg-tampon-seal" style="--mc:${col}">${initiales(nom)}</div>
      <div class="mtg-tampon-name">${esc(nom)}</div>
    </div>`;
  }).join("");

  // Notes (read ou edit)
  const notesBlock = editMode ? buildEditBlock(r, everyone) : buildReadBlock(r, notes, avg, presents);

  // Compte rendu
  // Lien discret vers le sondage si présent
  const sondageLink = r.sondage_id
    ? `<div style="margin-top:.7rem"><a class="sp-sondage-link" href="reunions.html" title="Voir le sondage de disponibilité ayant défini cette date">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>
        Date choisie par sondage de disponibilité
      </a></div>` : '';

  const crBlock = r.compte_rendu
    ? `<div class="mtg-divider"></div>
       <div class="mtg-sec-title">${IC.note} Compte rendu</div>
       <div style="font-size:.9rem;line-height:1.6;color:#3a2b1c;white-space:pre-wrap">${esc(r.compte_rendu)}</div>`
    : "";
  // Vidéo
  const videoBlock = r.lien_video
    ? `<div style="margin-top:1.1rem"><a href="${esc(r.lien_video)}" target="_blank" rel="noopener" class="mtg-livre-link" style="margin-top:0">▶ Revoir la séance en vidéo ${IC.arrowR}</a></div>`
    : "";

  const sealHtml = prevue || avg === null
    ? `<div class="mtg-seal" style="--seal:#9a7a4e"><div class="mtg-seal-inner"><div class="mtg-seal-note">—<span>/10</span></div><div class="mtg-seal-label">${prevue ? "à venir" : "non noté"}</div></div></div>`
    : `<div class="mtg-seal" style="--seal:${seal}"><div class="mtg-seal-inner"><div class="mtg-seal-note">${avg.toFixed(1)}<span>/10</span></div><div class="mtg-seal-label">note du club</div></div></div>`;

  document.getElementById("mtg-paper").innerHTML = `
    <button class="paper-close" id="mtg-close" aria-label="Fermer">✕</button>
    <button class="paper-close" id="mtg-modif-btn" aria-label="Modifier la séance" title="Modifier la séance" style="right:2.6rem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
    <div class="mtg-head">
      <div class="mtg-cover" style="--g1:${g1};--g2:${g2}"><span>${esc(titre)}</span></div>
      <div class="mtg-head-info">
        <span class="mtg-eyebrow${prevue ? " prevue" : ""}">${prevue ? IC.cal : IC.check} ${prevue ? "Séance prévue" : "Séance passée"}</span>
        <div class="mtg-livre">${esc(titre)}</div>
        <div class="mtg-meta">Séance du ${dotDate(r.date)}<span class="sep">·</span>livre de ${formatMois(r.mois, r.annee)}</div>
        <a class="mtg-livre-link" href="bibliotheque.html">Voir la fiche du livre ${IC.arrowR}</a>
      </div>
      ${sealHtml}
    </div>

    <div class="mtg-divider"></div>
    <div class="mtg-sec-title">${IC.users} Tour de table<span class="aside">${presents.size} présent·es · ${lecteurs.size} ${lecteurs.size > 1 ? "ont" : "a"} lu</span></div>
    <div class="mtg-att-grid">${tampons}</div>
    <div class="mtg-att-legend">
      <span><span class="mtg-leg-dot" style="background:#1a8a55"></span>A lu le livre (✓)</span>
      <span><span class="mtg-leg-dot" style="background:#d2935f"></span>Présent·e</span>
      <span><span class="mtg-leg-dot" style="background:#cdbb9a"></span>Absent·e</span>
    </div>

    <div class="mtg-divider"></div>
    <div class="mtg-sec-title">${IC.note} Notes du club<span class="aside">${editMode ? "mode édition" : "sur 10"}</span>
      ${editMode ? "" : `<button class="rf-edit" id="mtg-edit-btn" style="margin-left:.6rem">${IC.edit} Modifier</button>`}
    </div>
    ${notesBlock}
    ${sondageLink}
    ${crBlock}
    ${videoBlock}`;

  document.getElementById("mtg-close").addEventListener("click", closeMeeting);
  document.getElementById("mtg-modif-btn").addEventListener("click", () => {
    const r = curReunion;
    closeMeeting();
    openAdd(r);
  });
  hydrateCover(document.querySelector("#mtg-paper .mtg-cover"), livre);
  if (editMode) {
    wireEditMode();
  } else {
    document.getElementById("mtg-edit-btn")?.addEventListener("click", () => {
      editMode = true;
      editNotes = { ...(curReunion.notes_finales || {}) };
      renderMeeting();
    });
  }
}

// Toggle « vraies couvertures » : re-render de la fiche réunion ouverte
document.addEventListener("ltr-covers-change", () => { if (curReunion) renderMeeting(); });

function buildReadBlock(r, notes, avg, presents) {
  const sorted = Object.entries(notes)
    .map(([mid, n]) => ({ mid, n: Number(n) }))
    .sort((a, b) => b.n - a.n);
  if (!sorted.length) {
    return `<p style="font-size:.84rem;color:#a08768;font-style:italic">Aucune note enregistrée.</p>`;
  }
  const rows = sorted.map(({ mid, n }) => {
    const nom = membreById[mid]?.nom || mid;
    const absent = !presents.has(mid);
    const full = Math.max(0, Math.min(10, Math.round(n)));
    return `<div class="mtg-note-row">
      <span class="mtg-note-name">${esc(nom)}${absent ? '<span class="abs"> (absent·e)</span>' : ""}</span>
      <span class="mtg-note-stars">${"★".repeat(full)}${"☆".repeat(10 - full)}</span>
      <span class="mtg-note-val">${n}<span>/10</span></span>
    </div>`;
  }).join("");
  return `<div class="mtg-notes">${rows}</div>
    <div class="mtg-avg">
      <span class="mtg-avg-label">Moyenne du club</span>
      <span class="mtg-avg-val">${avg.toFixed(2)}<span>/10</span></span>
    </div>`;
}

function buildEditBlock(r, everyone) {
  const rows = everyone.map((mid, idx) => {
    const nom = membreById[mid]?.nom || mid;
    const val = editNotes[mid] != null ? editNotes[mid] : "";
    return `<div class="mtg-edit-row">
      <span class="mtg-edit-name">${esc(nom)}</span>
      <span class="mtg-edit-input-wrap">
        <input class="mtg-edit-input" type="number" min="0" max="10" step="0.5" value="${val}" data-mid="${esc(mid)}" placeholder="—" />
        <span class="mtg-edit-unit">/10</span>
      </span>
    </div>`;
  }).join("");

  // Membres pouvant être ajoutés (pas encore dans everyone)
  const evSet = new Set(everyone);
  const candidates = membres.filter(m => !evSet.has(m.id));
  const opts = candidates.map(m => `<option value="${esc(m.id)}">${esc(m.nom)}</option>`).join("");

  return `<div id="mtg-edit-list">${rows}</div>
    <div class="mtg-edit-add">
      <label>Ajouter un lecteur :</label>
      <select class="mtg-edit-select" id="mtg-add-reader">
        <option value="">— Choisir un membre —</option>${opts}
      </select>
      <button class="rf-edit" id="mtg-add-reader-btn">Ajouter</button>
    </div>
    <div class="mtg-foot">
      <button class="pf-btn cancel" id="mtg-edit-cancel">Annuler</button>
      <button class="pf-btn ok" id="mtg-edit-save">Enregistrer les notes</button>
    </div>`;
}

function wireEditMode() {
  // Sync inputs → editNotes
  document.querySelectorAll("#mtg-edit-list .mtg-edit-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const mid = inp.dataset.mid;
      const v   = parseFloat(inp.value);
      if (!isNaN(v)) editNotes[mid] = Math.max(0, Math.min(10, v));
      else delete editNotes[mid];
    });
  });

  // Ajouter un lecteur
  document.getElementById("mtg-add-reader-btn").addEventListener("click", () => {
    const sel = document.getElementById("mtg-add-reader");
    const mid = sel.value;
    if (!mid) return;
    // Ajouter à lecteurs_ids si absent
    if (!curReunion.lecteurs_ids) curReunion.lecteurs_ids = [];
    if (!curReunion.lecteurs_ids.includes(mid)) curReunion.lecteurs_ids.push(mid);
    editNotes[mid] = 7;
    renderMeeting();
  });

  document.getElementById("mtg-edit-cancel").addEventListener("click", () => {
    editMode = false;
    editNotes = { ...(curReunion.notes_finales || {}) };
    renderMeeting();
  });

  document.getElementById("mtg-edit-save").addEventListener("click", async () => {
    const btn = document.getElementById("mtg-edit-save");
    btn.disabled = true; btn.textContent = "Enregistrement…";
    try {
      // Lire toutes les inputs au moment du save (au cas où focus pas encore quitté)
      document.querySelectorAll("#mtg-edit-list .mtg-edit-input").forEach(inp => {
        const mid = inp.dataset.mid;
        const v   = parseFloat(inp.value);
        if (!isNaN(v)) editNotes[mid] = Math.max(0, Math.min(10, v));
        else delete editNotes[mid];
      });

      await updateReunion(curReunion.id, { notes_finales: { ...editNotes } });
      curReunion.notes_finales = { ...editNotes };
      editMode = false;
      renderMeeting();
      renderLedger();
      toast("Notes de la séance enregistrées.");
    } catch (err) {
      btn.disabled = false; btn.textContent = "Enregistrer les notes";
      toast("Erreur : " + err.message);
    }
  });
}

// ── Ajouter / Modifier une réunion ───────────────────────────────────────────
// r = réunion existante (édition) ou undefined (création)
function openAdd(r) {
  editingReunionId = r?.id ?? null;
  const now    = new Date();
  const curMois  = r ? r.mois : now.getMonth() + 1;
  const curAnnee = r ? r.annee : now.getFullYear();

  const moisOpts = MOIS_NOMS.map((n, i) =>
    `<option value="${i + 1}" ${i + 1 === curMois ? "selected" : ""}>${n}</option>`
  ).join("");

  // Pré-remplissage si édition
  const presentsSet = new Set(r?.participant_ids || []);
  const lecteursSet = new Set(r?.lecteurs_ids || []);
  const dateVal = r?.date ? (r.date.toDate ? r.date.toDate() : new Date(r.date)).toISOString().split("T")[0] : '';
  const crVal   = r?.compte_rendu || '';
  const videoVal = r?.lien_video || '';
  const statutVal = r?.statut || 'passée';

  // Checklist membres
  const checklistHtml = (prefix, defaultChecked, activeSet) => membres.map(m => {
    const isChecked = activeSet ? activeSet.has(m.id) : defaultChecked;
    return `<label class="pf-check" style="display:inline-flex;align-items:center;gap:.35rem;flex-direction:row;padding:.25rem .45rem;margin:.2rem .2rem 0 0">
      <input type="checkbox" data-mid="${esc(m.id)}" id="${prefix}-${esc(m.id)}" ${isChecked ? "checked" : ""} style="margin:0;flex-shrink:0" />
      <span class="mc-dot" style="background:${m._color};width:1.3rem;height:1.3rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:#fff;flex-shrink:0">${initiales(m.nom)}</span>
      <span style="font-size:.82rem;white-space:nowrap">${esc(m.nom)}</span>
    </label>`;
  }).join("");

  document.getElementById("add-paper").innerHTML = `
    <button class="paper-close" id="add-close" aria-label="Fermer">✕</button>
    <div class="pf-eyebrow">Registre des séances</div>
    <div class="pf-title">${editingReunionId ? "Modifier la séance" : "Consigner une séance"}</div>

    <div class="pf-row">
      <div class="pf-group" style="margin-bottom:0">
        <label>Statut</label>
        <select class="pf-input" id="add-statut">
          <option value="passée" ${statutVal === "passée" ? "selected" : ""}>Passée</option>
          <option value="prévue" ${statutVal === "prévue" ? "selected" : ""}>Prévue</option>
        </select>
      </div>
      <div class="pf-group" style="margin-bottom:0">
        <label>Date <span class="pf-hint">(optionnel)</span></label>
        <input type="date" class="pf-input" id="add-date" value="${dateVal}" />
      </div>
    </div>

    <div class="pf-row" style="margin-top:1.1rem">
      <div class="pf-group" style="margin-bottom:0">
        <label>Mois</label>
        <select class="pf-input" id="add-mois">${moisOpts}</select>
      </div>
      <div class="pf-group" style="margin-bottom:0">
        <label>Année</label>
        <input type="number" class="pf-input" id="add-annee" value="${curAnnee}" min="2018" max="2099" />
      </div>
    </div>

    <div class="pf-group" style="margin-top:1.1rem">
      <label>Livre associé</label>
      <div class="pf-livre" id="add-livre-box" data-livre-id="${r?.livre_id || ''}"></div>
    </div>

    <div class="pf-group">
      <label>Présents à la réunion</label>
      <div class="pf-checklist" id="add-presents" style="display:flex;flex-wrap:wrap;gap:.15rem">${checklistHtml("pre", true, editingReunionId ? presentsSet : null)}</div>
      <div class="pf-chk-tools">
        <button type="button" data-target="add-presents" data-val="true">Tout cocher</button>
        <button type="button" data-target="add-presents" data-val="false">Tout décocher</button>
      </div>
    </div>

    <div class="pf-group">
      <label>Ont lu le livre</label>
      <div class="pf-checklist" id="add-lu" style="display:flex;flex-wrap:wrap;gap:.15rem">${checklistHtml("lu", false, editingReunionId ? lecteursSet : null)}</div>
      <div class="pf-chk-tools">
        <button type="button" data-target="add-lu" data-val="true">Tout cocher</button>
        <button type="button" data-target="add-lu" data-val="false">Tout décocher</button>
      </div>
    </div>

    <div class="pf-group">
      <label>Compte rendu <span class="pf-hint">(optionnel)</span></label>
      <textarea class="pf-input" id="add-cr" placeholder="Notes, sujets abordés, impressions du groupe…">${esc(crVal)}</textarea>
    </div>

    <div class="pf-group">
      <label>Lien vidéo <span class="pf-hint">(optionnel)</span></label>
      <input type="url" class="pf-input" id="add-video" value="${esc(videoVal)}" placeholder="https://youtube.com/…" />
    </div>

    <div class="pf-foot">
      <button class="pf-btn cancel" id="add-cancel">Annuler</button>
      <button class="pf-btn ok" id="add-ok">${editingReunionId ? "Enregistrer les modifications" : "Enregistrer"}</button>
    </div>`;

  document.getElementById("add-overlay").classList.remove("hidden");
  document.getElementById("add-paper").scrollTop = 0;

  updateAddLivre();
  document.getElementById("add-mois").addEventListener("change", updateAddLivre);
  document.getElementById("add-annee").addEventListener("input", updateAddLivre);

  // Tout cocher / décocher
  document.querySelectorAll(".pf-chk-tools button").forEach(btn => {
    btn.addEventListener("click", () => {
      const on = btn.dataset.val === "true";
      document.querySelectorAll(`#${btn.dataset.target} input[type=checkbox]`).forEach(c => c.checked = on);
    });
  });

  document.getElementById("add-close").addEventListener("click", closeAdd);
  document.getElementById("add-cancel").addEventListener("click", closeAdd);
  document.getElementById("add-ok").addEventListener("click", submitAdd);
}

function updateAddLivre() {
  const mois  = parseInt(document.getElementById("add-mois").value, 10);
  const annee = parseInt(document.getElementById("add-annee").value, 10);
  const box   = document.getElementById("add-livre-box");
  if (!box) return;

  const vote  = voteByMoisAnnee[`${mois}-${annee}`];
  const livre = vote?.livre_elu ? livreById[vote.livre_elu] : null;

  if (livre) {
    box.innerHTML = `${IC.book}<span><b>${esc(livre.titre)}</b> <span class="auth">— ${esc(livre.auteur || "")}</span></span>`;
    box.dataset.livreId = livre.id;
  } else {
    // Fallback : select parmi les livres élus (pré-sélectionner si édition)
    const elus = livres.filter(l => l.statut === "elu");
    const preselect = box.dataset.livreId || "";
    if (elus.length) {
      box.innerHTML = `${IC.book}<select class="pf-input" id="add-livre-select" style="border:none;background:transparent;padding:0;font-size:.9rem;color:#2c2015;width:auto">
        <option value="">— Aucun livre détecté, choisir manuellement —</option>
        ${elus.map(l => `<option value="${esc(l.id)}" ${l.id === preselect ? "selected" : ""}>${esc(l.titre)}</option>`).join("")}
      </select>`;
      box.dataset.livreId = preselect;
      document.getElementById("add-livre-select").addEventListener("change", e => {
        box.dataset.livreId = e.target.value;
      });
    } else {
      box.innerHTML = `${IC.book}<span class="auth">Aucun livre élu trouvé pour ce mois.</span>`;
      box.dataset.livreId = "";
    }
  }
}

function checkedMids(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map(c => c.dataset.mid);
}

async function submitAdd() {
  const mois   = parseInt(document.getElementById("add-mois").value, 10);
  const annee  = parseInt(document.getElementById("add-annee").value, 10);
  const statut = document.getElementById("add-statut").value;
  const dateVal = document.getElementById("add-date").value;
  const livreId = document.getElementById("add-livre-box").dataset.livreId || "";
  const presents = checkedMids("add-presents");
  const lecteurs = checkedMids("add-lu");
  const cr       = document.getElementById("add-cr").value.trim();
  const video    = document.getElementById("add-video").value.trim();

  const btn = document.getElementById("add-ok");
  btn.disabled = true; btn.textContent = "Enregistrement…";

  try {
    const livre = livreById[livreId];
    const data = {
      statut,
      date:            dateVal || null,
      mois,
      annee,
      livre_id:        livreId || null,
      participant_ids: presents,
      lecteurs_ids:    lecteurs,
      compte_rendu:    cr,
      lien_video:      video || null,
    };

    if (editingReunionId) {
      // Mise à jour d'une séance existante (on conserve notes_finales)
      await updateReunion(editingReunionId, data);
      toast(`Séance${livre ? ` « ${livre.titre} »` : ""} modifiée.`);
    } else {
      await addReunion(data);
      toast(statut === "prévue"
        ? `Séance prévue${livre ? ` « ${livre.titre} »` : ""} ajoutée.`
        : `Séance${livre ? ` « ${livre.titre} »` : ""} consignée au registre.`);
    }

    editingReunionId = null;
    reunions = await getReunions();
    renderLedger();
    closeAdd();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = editingReunionId ? "Enregistrer les modifications" : "Enregistrer";
    toast("Erreur : " + err.message);
  }
}

function closeAdd() {
  document.getElementById("add-overlay").classList.add("hidden");
  editingReunionId = null;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastT;
function toast(msg) {
  const t = document.getElementById("mtoast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.remove("show"), 2600);
}

init().catch(console.error);
