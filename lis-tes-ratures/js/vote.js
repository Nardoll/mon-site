import { requireAuth } from "./auth.js";
import { getMembres, getVoteActif, getLivres, soumettreVote, getVotes, getReunions, lancerVote, cloturerVoteActif, lancerTour2 } from "./db.js";
import { formatMois, computeInactivite } from "./utils.js";

await requireAuth();

// ── Constantes ─────────────────────────────────────────────────────────────
const isAdmin = location.pathname.includes("voteadmin");
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const PALETTE = ["#b5572d","#3f7a52","#6840d8","#bf8a2f","#5a7d8c","#a8503f","#3f5340","#8a5a6b","#46708a","#9a6a2f"];

const IC = {
  check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  ballot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 13 2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg>',
  cal:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

// ── Timer clôture ──────────────────────────────────────────────────────────
let closeTimer = null;

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function ini(nom) { return (nom || "?").slice(0, 2); }
function avaColor(i) { return PALETTE[i % PALETTE.length]; }

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m-1] + s[m]) / 2 : s[m];
}

function showToast(msg, ok = true) {
  const t = document.getElementById("toast");
  t.innerHTML = (ok ? IC.check : "") + esc(msg);
  t.classList.add("show");
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => t.classList.remove("show"), 2600);
}

// ── État global ────────────────────────────────────────────────────────────
let voteActif = null, membres = [], livres = [];
const membreById = {}, livreById = {};

let moi = null;
let moiNom = "";
let notes = {};
let lus = new Set();
let dejaSoumis = false;

// Vote archivé immédiatement précédent (pour rappel des notes du mois dernier)
let previousVote = null;
let showPrevNotes = localStorage.getItem("ltr_prevNotes") === "1";

// Statut d'activité des membres (calculé sur les votes archivés + livres + réunions)
let inactiviteById = {};

async function refreshActivite() {
  try {
    const [archivedVotes, reunions] = await Promise.all([getVotes(), getReunions()]);
    inactiviteById = computeInactivite(membres, archivedVotes, livres, reunions);
  } catch (e) { console.error("Calcul activité membres :", e); }
}

// Un membre marqué inactif redevient actif dès qu'il a déposé son bulletin
// dans le scrutin en cours, sans attendre l'archivage de ce vote.
function isInactif(id) {
  if (!inactiviteById[id]?.inactif) return false;
  const b = voteActif?.bulletins?.[id];
  const isTour2 = voteActif?.tour === 2;
  const aVoteMaintenant = isTour2 ? (b != null && b !== "") : (b && Object.keys(b).length > 0);
  return !aVoteMaintenant;
}

async function refreshPreviousVote() {
  previousVote = null;
  if (!voteActif || voteActif.tour === 2) return;
  try {
    const allVotes = await getVotes();
    previousVote = allVotes.find(v =>
      v.annee < voteActif.annee || (v.annee === voteActif.annee && v.mois < voteActif.mois)
    ) || null;
  } catch (e) { console.error("Chargement vote précédent :", e); }
}

// ── Auto-lancement le 1er du mois ──────────────────────────────────────────
// ⚠️ NE PAS MODIFIER — voir README section "Système de vote automatique"
async function autoLancerSiNecessaire() {
  const today = new Date();
  if (today.getDate() !== 1) return;
  if (voteActif) return;

  // Vérifier qu'aucun vote archivé n'existe déjà pour ce mois
  const allVotes = await getVotes();
  const moisActuel = today.getMonth() + 1, anneeActuelle = today.getFullYear();
  if (allVotes.find(v => v.mois === moisActuel && v.annee === anneeActuelle)) return;

  const propositions = livres.filter(l => l.statut === "en_proposition");
  if (!propositions.length) return;

  const expires = new Date(today.getFullYear(), today.getMonth(), 1, 23, 59, 59);
  try {
    await lancerVote({
      mois: moisActuel,
      annee: anneeActuelle,
      livre_ids: propositions.map(l => l.id),
      membre_ids: membres.map(m => m.id),
      echelle: 5,
      expires_at: expires,
    });
    voteActif = await getVoteActif();
  } catch (e) { console.error("Auto-lancement vote :", e); }
}

// ── Clôture automatique Tour 1 ─────────────────────────────────────────────
// ⚠️ NE PAS MODIFIER — voir README section "Système de vote automatique"
async function closeExpiredVote(va) {
  // Garde-fou : vérifier que le vote n'a pas déjà été clos depuis un autre onglet
  const current = await getVoteActif();
  if (!current || current.id !== va.id) return;

  if (va.tour === 2) {
    await closeExpiredVoteTour2(va);
    return;
  }

  const bulletins = va.bulletins || {};
  const resultats = (va.livre_ids || []).map(livre_id => {
    const notesMap = {};
    Object.entries(bulletins).forEach(([membreId, b]) => {
      const n = b?.[livre_id];
      if (n != null && n !== "") notesMap[membreId] = Number(n);
    });
    const vals = Object.values(notesMap);
    const moy = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const med = median(vals);
    const score = (moy !== null && med !== null) ? (moy + med) / 2 : moy;
    return { livre_id, notes: notesMap, moyenne: score };
  });

  const withScore = resultats.filter(r => r.moyenne !== null);
  let livre_elu = null;

  if (withScore.length) {
    const max = Math.max(...withScore.map(r => r.moyenne));
    const winners = withScore.filter(r => r.moyenne === max);
    if (winners.length === 1) {
      livre_elu = winners[0].livre_id;
    } else {
      // Égalité → 2ème tour le 2 du mois, toute la journée
      const today = new Date();
      const expires2 = new Date(today.getFullYear(), today.getMonth(), 2, 23, 59, 59);
      try {
        await lancerTour2(va.id, {
          livre_ids_tour2: winners.map(w => w.livre_id),
          livre_ids_tour1: va.livre_ids,
          resultats_tour1: resultats,
          expires_at: expires2,
        });
      } catch (e) { console.error("Lancement 2ème tour :", e); }
      return;
    }
  }

  try {
    await cloturerVoteActif(va.id, { mois: va.mois, annee: va.annee, resultats, livre_elu });
  } catch (e) { console.error("Clôture vote :", e); }
}

// ── Clôture automatique Tour 2 ─────────────────────────────────────────────
// ⚠️ NE PAS MODIFIER — voir README section "Système de vote automatique"
async function closeExpiredVoteTour2(va) {
  const bulletins2 = va.bulletins || {};
  const livre_ids = va.livre_ids || [];

  const voteCounts = {};
  livre_ids.forEach(id => voteCounts[id] = 0);
  Object.values(bulletins2).forEach(choix => {
    if (choix && livre_ids.includes(choix)) voteCounts[choix]++;
  });

  const resultats_tour2 = livre_ids.map(livre_id => ({
    livre_id,
    votes: voteCounts[livre_id] || 0,
  }));

  const maxVotes = Math.max(0, ...resultats_tour2.map(r => r.votes));
  const winners = resultats_tour2.filter(r => r.votes === maxVotes);
  let livre_elu, tirage_au_sort = false;

  if (winners.length === 1) {
    livre_elu = winners[0].livre_id;
  } else {
    // Nouvelle égalité → tirage au sort
    livre_elu = winners[Math.floor(Math.random() * winners.length)].livre_id;
    tirage_au_sort = true;
  }

  try {
    await cloturerVoteActif(va.id, {
      mois: va.mois,
      annee: va.annee,
      resultats: va.resultats_tour1,
      livre_elu,
      // enLice et choix utilisés par buildTour2 dans votes.js pour l'affichage archivé
      tour2: { enLice: livre_ids, choix: bulletins2, resultats: resultats_tour2, livre_elu, tirage_au_sort },
    });
  } catch (e) { console.error("Clôture tour 2 :", e); }
}

// ── Clôture anticipée (100% participation) ─────────────────────────────────
// Les membres inactifs (voir computeInactivite dans utils.js) ne sont pas
// comptés : si tout le monde a voté sauf eux, le vote se clôture normalement.
function checkAllVoted() {
  if (!voteActif) return false;
  const memberIds = (voteActif.membre_ids || []).filter(id => !isInactif(id));
  if (!memberIds.length) return false;
  const bulletins = voteActif.bulletins || {};
  const isTour2 = voteActif.tour === 2;
  return memberIds.every(id => {
    const b = bulletins[id];
    return isTour2 ? (b != null && b !== "") : (b && Object.keys(b).length > 0);
  });
}

// ── Classement anonyme (admin) ────────────────────────────────────────────
// Calcule le score courant de chaque livre à partir des bulletins déjà
// soumis, SANS révéler quel livre correspond à quel score (pas d'id/titre
// dans le retour). Calcule aussi un pire-cas / meilleur-cas par livre en
// supposant que chaque votant restant donnerait la pire note (1) ou la
// meilleure (5) possible — ce qui borne mathématiquement si le classement
// peut encore bouger. But : permettre de juger si le vote est « joué
// d'avance » sans se servir de l'identité du livre en tête pour décider.
function computeLiveRanking() {
  if (!voteActif) return null;
  const bulletins = voteActif.bulletins || {};
  const livreIds = voteActif.livre_ids || [];
  const memberIds = voteActif.membre_ids || [];
  const remaining = memberIds.filter(id => !(id in bulletins)).length;
  const isTour2 = voteActif.tour === 2;

  let rows;
  if (isTour2) {
    const counts = {};
    livreIds.forEach(id => { counts[id] = 0; });
    Object.values(bulletins).forEach(choix => {
      if (choix && livreIds.includes(choix)) counts[choix]++;
    });
    rows = livreIds.map(id => ({ score: counts[id], best: counts[id] + remaining }));
    rows.sort((a, b) => b.score - a.score);
  } else {
    rows = livreIds.map(id => {
      const vals = [];
      Object.values(bulletins).forEach(b => {
        const n = b?.[id];
        if (n != null && n !== "") vals.push(Number(n));
      });
      const scoreOf = arr => {
        if (!arr.length) return null;
        const moy = arr.reduce((a, b) => a + b, 0) / arr.length;
        const med = median(arr);
        return (moy + med) / 2;
      };
      return {
        score: scoreOf(vals),
        worst: scoreOf([...vals, ...Array(remaining).fill(1)]),
        best: scoreOf([...vals, ...Array(remaining).fill(5)]),
      };
    });
    rows.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
  }

  const leader = rows[0];
  let locked = false;
  if (leader && (isTour2 ? true : leader.worst != null)) {
    const leaderFloor = isTour2 ? leader.score : leader.worst;
    locked = rows.slice(1).every(r => {
      const rCeiling = isTour2 ? r.best : r.best;
      return rCeiling == null || leaderFloor > rCeiling;
    });
  }

  return { isTour2, remaining, rows, locked };
}

function renderAdminRanking() {
  const el = document.getElementById("admin-ranking-body");
  if (!el) return;
  const rk = computeLiveRanking();
  if (!rk) { el.innerHTML = ""; return; }

  const list = rk.rows.map((r, i) => `
    <div class="admin-rank-row">
      <span class="admin-rank-pos">${i + 1}${i === 0 ? "ᵉʳ" : "ᵉ"}</span>
      <span class="admin-rank-score">${rk.isTour2 ? `${r.score} voix` : (r.score != null ? r.score.toFixed(2) : "—")}</span>
    </div>`).join("");

  el.innerHTML = `
    <div class="admin-ranking-lock ${rk.locked ? "locked" : "unlocked"}">
      ${rk.locked
        ? "🔒 Le livre en tête ne peut plus être rattrapé, quel que soit le vote des votants restants — clôturer maintenant ne changera pas le résultat."
        : `⏳ Le résultat peut encore changer (${rk.remaining} votant${rk.remaining > 1 ? "s" : ""} restant${rk.remaining > 1 ? "s" : ""}).`}
    </div>
    <div class="admin-ranking-list">${list || '<span class="admin-rank-empty">Aucun score pour l\'instant.</span>'}</div>`;
}

async function triggerEarlyClose() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  await closeExpiredVote(voteActif);
  voteActif = await getVoteActif();
  livres = await getLivres();
  moi = null; moiNom = ""; notes = {}; lus = new Set(); dejaSoumis = false;
  await refreshActivite();
  await refreshPreviousVote();
  render();
  if (voteActif) startCountdown();
}

// ── Timer auto-clôture ────────────────────────────────────────────────────
function startCountdown() {
  if (closeTimer) clearTimeout(closeTimer);
  if (!voteActif?.expires_at) return;
  const ms = voteActif.expires_at.toMillis() - Date.now();
  if (ms <= 0) {
    closeExpiredVote(voteActif).then(async () => {
      voteActif = await getVoteActif();
      livres = await getLivres();
      moi = null; moiNom = ""; notes = {}; lus = new Set();
      await refreshActivite();
      await refreshPreviousVote();
      render();
      if (voteActif) startCountdown();
    });
    return;
  }
  closeTimer = setTimeout(async () => {
    if (!voteActif) return;
    await closeExpiredVote(voteActif);
    voteActif = await getVoteActif();
    livres = await getLivres();
    moi = null; moiNom = ""; notes = {}; lus = new Set();
    await refreshActivite();
    await refreshPreviousVote();
    render();
    if (voteActif) startCountdown();
  }, ms);
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  [voteActif, membres, livres] = await Promise.all([
    getVoteActif(), getMembres(), getLivres(),
  ]);
  membres.forEach((m, i) => { m._color = avaColor(i); membreById[m.id] = m; });
  livres.forEach(l => { livreById[l.id] = l; });

  // Si vote actif expiré → clôturer automatiquement
  if (voteActif && voteActif.expires_at?.toMillis() < Date.now()) {
    await closeExpiredVote(voteActif);
    voteActif = await getVoteActif();
    livres = await getLivres();
  }

  // Auto-lancer si 1er du mois et aucun vote actif ou archivé pour ce mois
  await autoLancerSiNecessaire();

  await refreshActivite();
  await refreshPreviousVote();
  render();
  if (voteActif) startCountdown();
}

// ── Rendu principal ────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById("ballot-root");
  if (!voteActif) {
    renderUpcoming(root);
  } else {
    renderActive(root);
  }
}

// ── État à venir ───────────────────────────────────────────────────────────
function renderUpcoming(root) {
  const today = new Date();
  const next  = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nom   = MOIS_FR[next.getMonth()];
  const nomCap = nom.charAt(0).toUpperCase() + nom.slice(1);
  const jours = Math.max(1, Math.ceil((next - today) / 86400000));
  const proposalIds = livres.filter(l => l.statut === "en_proposition").map(l => l.id);

  root.innerHTML = `
    <div class="ballot-letterhead">
      <div class="ballot-club">Club de lecture</div>
      <div class="ballot-h1">Bulletin de <span class="rature">vote</span></div>
      <div class="ballot-sub" id="ballot-sub">Prochain scrutin · ouverture le 1ᵉʳ ${nom}</div>
    </div>

    <div class="vbanner up">
      <div class="vbanner-ico">${IC.cal}</div>
      <div class="vbanner-body">
        <div class="vbanner-title">Prochain vote — ${nomCap} ${next.getFullYear()}</div>
        <div class="vbanner-sub">Ouverture automatique le 1ᵉʳ ${nom}</div>
      </div>
      <div class="vbanner-count">${jours}<small> j. avant l'ouverture</small></div>
    </div>

    <div class="vsec-title"><span class="vsec-num">1</span>Les livres en compétition</div>
    <div class="infos-bar">
      <label class="toggle-switch" style="margin:0"><input type="checkbox" id="infos-toggle"><span class="toggle-slider"></span></label>
      <span><b>Afficher les infos</b> — genre, pages, description</span>
    </div>
    <div class="vbooks" id="vbooks"></div>

    <div class="vsec-title"><span class="vsec-num">2</span>Aperçu du bulletin</div>
    <div class="preview-note">${IC.cal}<span>Le vote s'ouvrira <b>automatiquement le 1ᵉʳ ${nom}</b>. Voici à quoi ressemblera le bulletin — la notation sera alors active et vous pourrez vous identifier.</span></div>
    <div class="rules">Notez chaque livre de <b>1 à 5</b> selon votre envie de le lire. Le score d'un livre = <span class="key">(moyenne + médiane) ÷ 2</span>, ce qui atténue les notes extrêmes. Le plus haut score est <b>élu</b> ; tout score <span class="key">&lt; 3</span> élimine le livre.</div>
    <div class="grade-scale"><span><b>1</b> — envie minimale</span><span><b>5</b> — envie maximale</span></div>
    ${buildVoteTable(proposalIds, true)}`;

  bindInfosToggle();
  renderBooks();
}

// ── Vote actif ─────────────────────────────────────────────────────────────
function renderActive(root) {
  const livreIds  = voteActif.livre_ids  || [];
  const membreIds = voteActif.membre_ids || [];
  const bulletins = voteActif.bulletins  || {};
  const nbVotes   = Object.keys(bulletins).length;
  const total     = membreIds.length;
  const expiry    = voteActif.expires_at?.toDate ? voteActif.expires_at.toDate() : null;
  const isTour2   = voteActif.tour === 2;

  root.innerHTML = `
    <div class="ballot-letterhead">
      <div class="ballot-club">Club de lecture</div>
      <div class="ballot-h1">Bulletin de <span class="rature">vote</span></div>
      <div class="ballot-sub">Scrutin de ${formatMois(voteActif.mois, voteActif.annee)} · ${isTour2 ? "deuxième tour — choisissez un seul livre" : "notez les livres en compétition"}</div>
    </div>

    <div class="vbanner">
      <div class="vbanner-ico">${IC.ballot}</div>
      <div class="vbanner-body">
        <div class="vbanner-title">${isTour2 ? "⚖️ Deuxième tour" : "Vote en cours"} — ${formatMois(voteActif.mois, voteActif.annee)}</div>
        <div class="vbanner-sub" id="b-sub"><b>${livreIds.length} livre${livreIds.length !== 1 ? "s" : ""}</b> ${isTour2 ? "ex-æquo en tête du 1er tour" : "en compétition"}${expiry ? ` · clôture le ${expiry.toLocaleDateString("fr-FR")}` : ""}</div>
      </div>
      <div class="vbanner-count" id="b-count">${nbVotes}<small>/${total} votes</small></div>
    </div>

    ${isAdmin ? `
    <div class="admin-panel">
      <div class="admin-panel-text"><b>Mode admin</b> — vous pouvez clôturer ${isTour2 ? "ce 2ᵉ tour" : "ce vote"} avant son échéance normale. ${isTour2 ? "Le livre avec le plus de voix reçues sera élu (tirage au sort en cas de nouvelle égalité)." : "En cas d'égalité entre plusieurs livres, un 2ᵉ tour sera lancé automatiquement, comme pour une clôture normale."}</div>
      <button class="btn btn-danger" id="admin-close-btn">Clôturer maintenant</button>
    </div>
    <div class="admin-ranking">
      <div class="admin-ranking-title">Classement anonyme — ${isTour2 ? "voix reçues" : "score actuel"} (titres masqués exprès)</div>
      <div id="admin-ranking-body"></div>
    </div>` : ''}

    ${isTour2 ? '<div id="tour2-ctx"></div>' : ''}

    <div class="vsec-title"><span class="vsec-num">1</span>Les livres en compétition</div>
    <div class="infos-bar">
      <label class="toggle-switch" style="margin:0"><input type="checkbox" id="infos-toggle"><span class="toggle-slider"></span></label>
      <span><b>Afficher les infos</b> — genre, pages, description</span>
    </div>
    <div class="vbooks" id="vbooks"></div>

    <div class="vsec-title" id="sec-ident"><span class="vsec-num">2</span>Qui êtes-vous ?</div>
    <div id="ident-mount"></div>

    <div id="vote-mount"></div>

    <div class="bilan" id="bilan-sec">
      <div class="bilan-title">Émargement — <span id="bilan-count"></span></div>
      <div class="bilan-grid" id="bilan-grid"></div>
    </div>`;

  bindInfosToggle();
  if (isAdmin) {
    document.getElementById("admin-close-btn")?.addEventListener("click", adminCloseNow);
    renderAdminRanking();
  }
  if (isTour2) renderTour2Context();
  renderBooks();
  renderIdent();
  renderBilan();
}

// ── Clôture manuelle (admin) ──────────────────────────────────────────────
async function adminCloseNow() {
  if (!voteActif) return;
  const isTour2 = voteActif.tour === 2;
  const msg = isTour2
    ? "Clôturer ce 2ᵉ tour maintenant ? Le livre avec le plus de voix reçues sera élu (tirage au sort en cas de nouvelle égalité). Action irréversible."
    : "Clôturer ce vote maintenant ? En cas d'égalité entre plusieurs livres, un 2ᵉ tour sera lancé automatiquement. Action irréversible.";
  if (!confirm(msg)) return;

  const btn = document.getElementById("admin-close-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Clôture en cours…"; }

  try {
    const wasTour1 = !isTour2;
    await triggerEarlyClose();
    if (wasTour1 && voteActif) {
      showToast("Égalité au 1ᵉʳ tour — 2ᵉ tour lancé.");
    } else {
      showToast("Vote clôturé.");
    }
  } catch (e) {
    showToast("Erreur lors de la clôture : " + e.message, false);
    if (btn) { btn.disabled = false; btn.textContent = "Clôturer maintenant"; }
  }
}

// ── Contexte 2ème tour ─────────────────────────────────────────────────────
// Seuil cohérent avec addVote() dans db.js — voir README "Seuil d'élimination"
const SEUIL_ELIMINATION = 3;

function renderTour2Context() {
  const el = document.getElementById("tour2-ctx");
  if (!el) return;
  const resultats = voteActif.resultats_tour1 || [];
  const tour2Ids = new Set(voteActif.livre_ids || []);
  const sorted = [...resultats].sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));
  const maxMoy = Math.max(0, ...sorted.map(r => r.moyenne ?? 0));

  const rows = sorted.map(r => {
    const l = livreById[r.livre_id];
    const inTour2 = tour2Ids.has(r.livre_id);
    const elimine = !inTour2 && r.moyenne !== null && r.moyenne < SEUIL_ELIMINATION;
    const pct = maxMoy > 0 ? Math.round((r.moyenne ?? 0) / maxMoy * 100) : 0;
    const badgeCls  = inTour2 ? "t2-badge-tie" : elimine ? "t2-badge-elim" : "t2-badge-out";
    const badgeText = inTour2 ? "⚖️ 2e tour" : elimine ? "❌ Éliminé" : "Écarté";
    return `
      <div class="t2-pre-row">
        <div class="t2-pre-name">${esc(l?.titre ?? r.livre_id)}</div>
        <div class="t2-pre-bar"><div class="t2-pre-fill" style="width:${pct}%;background:${inTour2 ? "var(--accent)" : "var(--border)"}"></div></div>
        <div class="t2-pre-score" style="color:${inTour2 ? "var(--accent)" : "var(--muted)"}">${r.moyenne !== null ? Number(r.moyenne).toFixed(2) : "—"}</div>
        <span class="t2-pre-badge ${badgeCls}">${badgeText}</span>
      </div>`;
  }).join("");

  el.innerHTML = `
    <div class="t2-context">
      <div class="t2-ctx-title">⚖️ Égalité au 1er tour — Deuxième tour en cours</div>
      <div class="t2-ctx-sub">${tour2Ids.size} livres ex-æquo en tête. Chaque membre choisit <strong>un seul livre</strong> — celui avec le plus de voix est élu. En cas de nouvelle égalité : tirage au sort.</div>
      <div class="t2-ctx-results">${rows}</div>
    </div>`;
}

// ── Infos toggle ───────────────────────────────────────────────────────────
function bindInfosToggle() {
  document.getElementById("infos-toggle")?.addEventListener("change", e => {
    document.getElementById("vbooks")?.classList.toggle("infos-on", e.target.checked);
  });
}

// ── Grille de livres ───────────────────────────────────────────────────────
function renderBooks() {
  const livreIds = voteActif
    ? (voteActif.livre_ids || [])
    : livres.filter(l => l.statut === "en_proposition").map(l => l.id);
  const books = livreIds.map(id => livreById[id]).filter(Boolean);

  document.getElementById("vbooks").innerHTML = books.map(b => `
    <div class="vbook">
      <div class="vbook-t">${esc(b.titre)}</div>
      <div class="vbook-a">${esc(b.auteur ?? "")}</div>
      <div class="vbook-info">
        ${b.genre ? `<span class="vbook-genre">${esc(b.genre)}</span>` : ""}
        ${b.nb_pages ? `<span class="vbook-pages">${esc(b.nb_pages)} p.</span>` : ""}
        ${b.description_3_mots ? `<span class="vbook-desc">${esc(b.description_3_mots)}</span>` : ""}
        ${b.lien_babelio ? `<a href="${esc(b.lien_babelio)}" target="_blank" rel="noopener" class="vbook-babelio"><img src="/lis-tes-ratures/babelio.png" alt="Babelio" class="babelio-icon"> Babelio</a>` : ""}
      </div>
    </div>`).join("");
}

// ── Identification ─────────────────────────────────────────────────────────
function renderIdent() {
  const mount = document.getElementById("ident-mount");
  if (!mount) return;
  const bulletins  = voteActif?.bulletins  || {};
  const membreIds  = voteActif?.membre_ids || [];
  const isTour2    = voteActif?.tour === 2;

  if (!moi) {
    mount.innerHTML = `
      <div class="ident">
        <label for="who">Sélectionnez votre nom :</label>
        <select id="who">
          <option value="">— Choisir —</option>
          ${membreIds.map(id => {
            const m = membreById[id] || { nom: id };
            const b = bulletins[id];
            const voted = isTour2 ? (b != null && b !== "") : (b && Object.keys(b).length > 0);
            return `<option value="${id}">${esc(m.nom)}${voted ? " (a déjà voté)" : ""}</option>`;
          }).join("")}
        </select>
        <button class="btn btn-primary" id="who-go">Continuer ${IC.arrowR}</button>
      </div>`;
    document.getElementById("who-go").addEventListener("click", () => {
      const v = document.getElementById("who").value;
      if (!v) { showToast("Choisissez votre nom dans la liste.", false); return; }
      moi = v;
      moiNom = membreById[v]?.nom ?? v;
      notes = {}; lus = new Set(); dejaSoumis = false;
      const prev = bulletins[moi];
      if (isTour2) {
        dejaSoumis = (prev != null && prev !== "");
      } else {
        if (prev && Object.keys(prev).length > 0) {
          dejaSoumis = true;
          Object.entries(prev).forEach(([lid, n]) => { if (n != null) notes[lid] = Number(n); });
        }
      }
      renderIdent();
      renderVote();
    });
    document.getElementById("vote-mount").innerHTML = "";
  } else {
    const m = membreById[moi] || { nom: moi, _color: "#888" };
    mount.innerHTML = `
      <div class="voter-tag">
        <span class="ava" style="width:22px;height:22px;border-radius:50%;display:inline-grid;place-items:center;font-size:.62rem;font-weight:700;color:#fff;background:${m._color}">${ini(m.nom)}</span>
        Bulletin de <b>${esc(m.nom)}</b>
        <button class="chg" id="who-change">changer</button>
      </div>`;
    document.getElementById("who-change").addEventListener("click", () => {
      moi = null; moiNom = ""; notes = {}; lus = new Set();
      renderIdent();
    });
  }
}

// ── Interface de vote ──────────────────────────────────────────────────────
function renderVote() {
  const mount = document.getElementById("vote-mount");
  if (!mount || !moi) { if (mount) mount.innerHTML = ""; return; }

  const isTour2 = voteActif.tour === 2;

  if (isTour2) {
    const livreIds = voteActif.livre_ids || [];
    const books = livreIds.map(id => livreById[id]).filter(Boolean);
    const prevChoix = voteActif.bulletins?.[moi];
    mount.innerHTML = `
      <div class="vsec-title"><span class="vsec-num">3</span>Votre choix</div>
      <div class="rules">Choisissez le livre que vous souhaitez lire ce mois-ci. <b>Un seul vote</b> — le livre avec le plus de voix est élu. En cas de nouvelle égalité, le gagnant sera tiré au sort.</div>
      <div class="t2-choices">
        ${books.map(b => `
          <label class="t2-choice">
            <input type="radio" name="t2-choix" value="${esc(b.id)}" ${prevChoix === b.id ? "checked" : ""}>
            <div class="t2-choice-body">
              <div class="vt-titre">${esc(b.titre)}</div>
              ${b.auteur ? `<div class="vt-auteur">${esc(b.auteur)}</div>` : ""}
            </div>
          </label>`).join("")}
      </div>
      <div class="submit-row">
        <span class="submit-hint">${dejaSoumis ? "Vous avez déjà voté — soumettre écrasera votre choix précédent." : "Sélectionnez un livre."}</span>
        <button class="btn btn-primary btn-lg" id="submit">${IC.check} Glisser dans l'urne</button>
      </div>`;
    document.getElementById("submit").addEventListener("click", submitVote);
    return;
  }

  const livreIds = voteActif.livre_ids || [];
  const withPrev = !!previousVote;
  mount.innerHTML = `
    <div class="vsec-title"><span class="vsec-num">3</span>Votre notation</div>
    <div class="rules">
      Notez chaque livre de <b>1 à 5</b> selon votre envie de le lire. Le score d'un livre = <span class="key">(moyenne + médiane) ÷ 2</span>, ce qui atténue les notes extrêmes. Le plus haut score est <b>élu</b> ; tout score <span class="key">&lt; 3</span> élimine le livre. Déjà lu un titre ? Cochez « je passe » pour l'exclure de votre vote.
    </div>
    ${withPrev ? `
    <div class="infos-bar prev-bar">
      <label class="toggle-switch" style="margin:0"><input type="checkbox" id="prev-toggle"${showPrevNotes ? " checked" : ""}><span class="toggle-slider"></span></label>
      <span><b>Afficher mes notes du mois dernier</b> — rappel personnel de vos notes précédentes, colonne <span class="key">Préc.</span> ci-dessous (visible de vous seul)</span>
    </div>` : ""}
    <div class="grade-scale"><span><b>1</b> — envie minimale</span><span><b>5</b> — envie maximale</span></div>
    ${buildVoteTable(livreIds, false, withPrev)}
    <div class="submit-row">
      <span class="submit-hint">${dejaSoumis ? "Vous aviez déjà voté — soumettre écrasera votre bulletin précédent." : "Une note par livre (ou « je passe ») est requise."}</span>
      <button class="btn btn-primary btn-lg" id="submit">${IC.check} Glisser dans l'urne</button>
    </div>`;

  livreIds.forEach(lid => {
    if (notes[lid] != null) highlightDots(lid, notes[lid]);
    if (lus.has(lid)) {
      const cb = document.querySelector(`.read-cb[data-bk="${lid}"]`);
      if (cb) cb.checked = true;
      const row = document.querySelector(`.vrow[data-bk="${lid}"]`);
      if (row) row.classList.add("read");
    }
  });

  wireDots();
  wireReadCheckboxes();
  document.getElementById("submit").addEventListener("click", submitVote);

  if (withPrev) {
    document.getElementById("prev-toggle")?.addEventListener("change", e => {
      showPrevNotes = e.target.checked;
      localStorage.setItem("ltr_prevNotes", showPrevNotes ? "1" : "0");
      document.querySelectorAll(".vtable2").forEach(t => t.classList.toggle("prev-hidden", !showPrevNotes));
    });
  }
}

function buildVoteTable(livreIds, preview, withPrev = false) {
  const books = livreIds.map(id => livreById[id]).filter(Boolean);
  const cols = withPrev ? 8 : 7;
  const rows = (preview && books.length === 0)
    ? `<tr class="vrow"><td class="bkc" colspan="${cols}" style="color:var(--muted);font-size:.82rem;padding:.8rem .4rem">Aucune proposition pour l'instant.</td></tr>`
    : books.map(b => {
        const dots = [1,2,3,4,5].map(n =>
          `<td class="numcol" data-n="${n}"><span class="dot" data-bk="${b.id}" data-n="${n}" role="button" aria-label="${n} sur 5" tabindex="0"></span></td>`
        ).join("");
        const prevCell = withPrev ? `<td class="prevcol">${prevNoteCellHtml(b.id)}</td>` : "";
        return `<tr class="vrow" data-bk="${b.id}">
          <td class="bkc"><span class="vt-titre">${esc(b.titre)}</span> <span class="vt-auteur">— ${esc(b.auteur ?? "")}</span></td>
          ${dots}
          <td class="readcol"><label class="read-toggle"><input type="checkbox" class="read-cb" data-bk="${b.id}"${preview ? ' disabled' : ''}> déjà lu, je passe</label></td>
          ${prevCell}
        </tr>`;
      }).join("");

  return `
    <table class="vtable2${preview ? " preview" : ""}${withPrev && !showPrevNotes ? " prev-hidden" : ""}">
      <thead><tr>
        <th class="bkc"></th>
        ${[1,2,3,4,5].map(n => `<th class="numcol" data-n="${n}"><span class="n">${n}</span>${n <= 2 ? '<span class="elim">élim.</span>' : ""}</th>`).join("")}
        <th class="readcol"></th>
        ${withPrev ? `<th class="prevcol" title="Note que vous aviez donnée à ce livre le mois dernier">Préc.</th>` : ""}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function prevNoteCellHtml(livreId) {
  const r = previousVote?.resultats?.find(x => x.livre_id === livreId);
  const n = r?.notes?.[moi];
  return n != null ? `<span class="prevval">${esc(n)}</span>` : `<span class="prevval prevval-empty">—</span>`;
}

function highlightDots(lid, val) {
  document.querySelectorAll(`.dot[data-bk="${lid}"]`).forEach(d => {
    d.classList.toggle("on", +d.dataset.n === val);
  });
}

function wireDots() {
  document.querySelectorAll(".dot").forEach(d => {
    d.addEventListener("click", () => {
      const lid = d.dataset.bk, n = +d.dataset.n;
      if (lus.has(lid)) return;
      notes[lid] = n;
      highlightDots(lid, n);
    });
    d.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); d.click(); }
    });
  });
}

function wireReadCheckboxes() {
  document.querySelectorAll(".read-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      const lid = cb.dataset.bk;
      const row = cb.closest(".vrow");
      if (cb.checked) {
        lus.add(lid);
        delete notes[lid];
        highlightDots(lid, -1);
      } else {
        lus.delete(lid);
      }
      row.classList.toggle("read", cb.checked);
    });
  });
}

// ── Bilan participation ────────────────────────────────────────────────────
function renderBilan() {
  const membreIds = voteActif?.membre_ids || [];
  const bulletins = voteActif?.bulletins  || {};
  const isTour2   = voteActif?.tour === 2;

  const count = document.getElementById("bilan-count");
  const grid  = document.getElementById("bilan-grid");
  if (!count || !grid) return;

  const nbVotes = membreIds.filter(id => {
    const b = bulletins[id];
    return isTour2 ? (b != null && b !== "") : !!b;
  }).length;
  const nbInactifs = membreIds.filter(id => isInactif(id)).length;
  count.textContent = `${nbVotes} / ${membreIds.length} bulletins reçus`
    + (nbInactifs ? ` · ${nbInactifs} inactif${nbInactifs > 1 ? "s" : ""} (non attendu${nbInactifs > 1 ? "s" : ""})` : "");

  grid.innerHTML = membreIds.map(id => {
    const m = membreById[id] || { nom: id, _color: "#888" };
    const b = bulletins[id];
    const v = isTour2 ? (b != null && b !== "") : !!b;
    const inactif = !v && isInactif(id);
    return `<span class="bilan-tag ${v ? "ok" : inactif ? "inactif" : "no"}">
      <span class="ava" style="background:${m._color}">${ini(m.nom)}</span>${esc(m.nom)}${inactif ? '<small class="bilan-inactif-lbl">inactif</small>' : ''}
      <span class="ck">${IC.check}</span>
    </span>`;
  }).join("");
}

// ── Soumission ─────────────────────────────────────────────────────────────
async function submitVote() {
  if (!moi) { showToast("Choisissez votre nom.", false); return; }

  const isTour2 = voteActif.tour === 2;
  const btn = document.getElementById("submit");
  if (btn) { btn.disabled = true; btn.textContent = "Envoi…"; }

  try {
    if (isTour2) {
      const checked = document.querySelector('input[name="t2-choix"]:checked');
      if (!checked) {
        showToast("Choisissez un livre.", false);
        if (btn) { btn.disabled = false; btn.innerHTML = `${IC.check} Glisser dans l'urne`; }
        return;
      }
      await soumettreVote(voteActif.id, moi, checked.value);
      if (!voteActif.bulletins) voteActif.bulletins = {};
      voteActif.bulletins[moi] = checked.value;
    } else {
      const livreIds = voteActif.livre_ids || [];
      const manquants = livreIds.filter(id => !lus.has(id) && notes[id] == null);
      if (manquants.length) {
        showToast(`Notez chaque livre (${manquants.length} manquant${manquants.length > 1 ? "s" : ""}).`, false);
        if (btn) { btn.disabled = false; btn.innerHTML = `${IC.check} Glisser dans l'urne`; }
        return;
      }
      await soumettreVote(voteActif.id, moi, notes);
      if (!voteActif.bulletins) voteActif.bulletins = {};
      voteActif.bulletins[moi] = { ...notes };
    }

    const bCount = document.getElementById("b-count");
    if (bCount) {
      const nb = Object.keys(voteActif.bulletins).length;
      const tot = (voteActif.membre_ids || []).length;
      bCount.innerHTML = `${nb}<small>/${tot} votes</small>`;
    }

    renderBilan();
    if (isAdmin) renderAdminRanking();
    if (btn) {
      btn.innerHTML = `${IC.check} Bulletin enregistré`;
      btn.style.opacity = ".65";
    }
    dejaSoumis = true;
    const hint = document.querySelector(".submit-hint");
    if (hint) hint.textContent = isTour2
      ? "Vous avez déjà voté — soumettre écrasera votre choix précédent."
      : "Vous aviez déjà voté — soumettre écrasera votre bulletin précédent.";
    showToast("Bulletin glissé dans l'urne — merci !");

    if (checkAllVoted()) await triggerEarlyClose();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = `${IC.check} Glisser dans l'urne`; }
    showToast("Erreur : " + err.message, false);
  }
}

init().catch(console.error);
