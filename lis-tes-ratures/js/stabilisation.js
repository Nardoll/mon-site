import { requireAuth } from "./auth.js";
import { getMembres, getVotes, getVoteActif, getLivres } from "./db.js";
import { formatMois } from "./utils.js";

await requireAuth();

async function loadChartJs() {
  if (window.Chart) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── Données globales ─────────────────────────────────────────────
let votes = [], membres = [], livres = [], voteActif = null;
const livreById = {};

// ── Utilitaires math ─────────────────────────────────────────────
function esc(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function mean(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; }
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length % 2 === 0 ? (s[m-1]+s[m])/2 : s[m];
}
function nomMembre(id) { return membres.find(m => m.id === id)?.nom ?? id; }
function lsNum(key, def) {
  const v = localStorage.getItem(key);
  if (v === null || v === "") return def;
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
}
function computeGrowthStats(arr) {
  const n = arr.length;
  const m = mean(arr);
  if (n < 2) return { mean: m, stdev: 0, n };
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1);
  return { mean: m, stdev: Math.sqrt(variance), n };
}
function buildStepValues(from, to, step, maxLines = 13) {
  if (!(step > 0) || to < from) return { values: [], effStep: step, capped: false };
  let n = Math.floor((to - from) / step + 1e-9) + 1;
  let effStep = step, capped = false;
  if (n > maxLines) { effStep = (to - from) / (maxLines - 1); n = maxLines; capped = true; }
  const values = [];
  for (let i = 0; i < n; i++) values.push(+(from + i * effStep).toFixed(3));
  return { values, effStep, capped };
}
function nextMonth(mois, annee) {
  return mois === 12 ? { mois: 1, annee: annee + 1 } : { mois: mois + 1, annee };
}
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// ── Seuil réel de la production — voir SEUIL_ELIMINATION dans vote.js ──
const SEUIL_ELIMINATION_REAL = 3;

// ── État partagé (persisté) ──────────────────────────────────────
let targetPoolSize   = lsNum("stb_target", 20);
let showUncertainty  = localStorage.getItem("stb_uncertainty") !== "0";
let limitEnabled     = localStorage.getItem("stb_limit_enabled") === "1";
let limitN           = lsNum("stb_limit_n", 2);

const comparePolicyParams = {
  keepA:   lsNum("stb_cmp_keepA", 7),
  keepB:   lsNum("stb_cmp_keepB", 15),
  percent: lsNum("stb_cmp_percent", 50),
  score:   lsNum("stb_cmp_score", 3.5),
};
const graphRanges = {
  keep:    { from: lsNum("stb_gk_from", 0), to: lsNum("stb_gk_to", 20), step: lsNum("stb_gk_step", 5) },
  percent: { from: lsNum("stb_gp_from", 0), to: lsNum("stb_gp_to", 50), step: lsNum("stb_gp_step", 5) },
  score:   { from: lsNum("stb_gs_from", 1), to: lsNum("stb_gs_to", 5),  step: lsNum("stb_gs_step", 0.2) },
};
let mcRuns   = parseInt(localStorage.getItem("stb_mc_runs"), 10) || 1000;
let mcMonths = parseInt(localStorage.getItem("stb_mc_months"), 10) || 10;
let mcMode   = localStorage.getItem("stb_mc_mode") || "keep";
let mcValue  = lsNum("stb_mc_value", null);

// ── Reconstruction de l'historique des votes ─────────────────────
function buildPoolTimeline() {
  const closed = [...votes]
    .filter(v => (v.resultats || []).length)
    .sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);
  const timeline = closed.map(v => ({
    mois: v.mois, annee: v.annee,
    ids: new Set((v.resultats || []).map(r => r.livre_id)),
    poolSize: (v.resultats || []).length,
    elu: v.livre_elu || null,
    closed: true,
  }));
  if (voteActif) {
    const idsSrc = voteActif.tour === 2
      ? (voteActif.resultats_tour1 || []).map(r => r.livre_id)
      : (voteActif.livre_ids || []);
    const last = timeline[timeline.length - 1];
    if (idsSrc.length && (!last || last.mois !== voteActif.mois || last.annee !== voteActif.annee)) {
      timeline.push({ mois: voteActif.mois, annee: voteActif.annee, ids: new Set(idsSrc), poolSize: idsSrc.length, elu: null, closed: false });
    }
  }
  return timeline;
}

function computeTransitions(timeline) {
  const rows = [];
  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1], cur = timeline[i];
    const newIds = [...cur.ids].filter(id => !prev.ids.has(id));
    const carried = cur.poolSize - newIds.length;
    const eliminatedFromPrev = Math.max(0, prev.poolSize - (prev.elu ? 1 : 0) - carried);
    rows.push({ mois: cur.mois, annee: cur.annee, poolSize: cur.poolSize, newEntries: newIds.length, newIds, eliminatedFromPrev });
  }
  return rows;
}

function collectAllBookScores() {
  const scores = [];
  const pushFromResultats = resultats => {
    (resultats || []).forEach(r => {
      const notes = Object.values(r.notes || {}).map(Number).filter(n => !isNaN(n));
      if (!notes.length) return;
      const moy = mean(notes), med = median(notes);
      const combined = (moy !== null && med !== null) ? (moy + med) / 2 : null;
      if (combined !== null) scores.push(combined);
    });
  };
  votes.forEach(v => pushFromResultats(v.resultats));
  if (voteActif && voteActif.tour === 2) pushFromResultats(voteActif.resultats_tour1);
  return scores;
}

function scoreThresholdForRate(scores, rate) {
  if (!scores.length || rate <= 0) return null;
  if (rate >= 1) return Math.min(5, Math.max(...scores) + 0.01);
  const sorted = [...scores].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(rate * sorted.length) - 1);
  return Math.min(5, sorted[idx] + 0.005);
}

function eliminationRateForScore(scores, T) {
  if (!scores.length) return 0;
  return scores.filter(s => s < T).length / scores.length;
}

function requiredSettingsFor(newProposals, allScores) {
  const keepN = Math.max(1, Math.round(targetPoolSize - newProposals + 1));
  const percentP = newProposals <= 1 ? 0 : Math.min(100, Math.round(100 * (newProposals - 1) / targetPoolSize));
  const rateNeeded = newProposals <= 1 ? 0 : Math.min(1, (newProposals - 1) / targetPoolSize);
  const scoreT = scoreThresholdForRate(allScores, rateNeeded);
  return { keepN, percentP, scoreT, impossible: targetPoolSize - newProposals + 1 < 1 };
}

function computeCurrentMonthRealElimination() {
  if (!voteActif || voteActif.tour !== 2) return null;
  const tour2Ids = new Set(voteActif.livre_ids || []);
  return (voteActif.resultats_tour1 || []).filter(r => {
    if (tour2Ids.has(r.livre_id)) return false;
    const notes = Object.values(r.notes || {}).map(Number).filter(n => !isNaN(n));
    if (!notes.length) return false;
    const moy = mean(notes), med = median(notes);
    const combined = (moy !== null && med !== null) ? (moy + med) / 2 : null;
    return combined !== null && combined < SEUIL_ELIMINATION_REAL;
  }).length;
}

// ── Qui propose quoi (pour l'onglet "Limiter les propositions") ──
function computeMemberProposalsByTransition(transitions) {
  return transitions.map(t => {
    const byMember = {};
    t.newIds.forEach(id => {
      const who = livreById[id]?.propose_par || "?";
      byMember[who] = (byMember[who] || 0) + 1;
    });
    return { mois: t.mois, annee: t.annee, byMember, total: t.newIds.length };
  });
}

function computeMemberTotals() {
  const totals = {};
  livres.forEach(l => {
    const who = l.propose_par || "?";
    totals[who] = (totals[who] || 0) + 1;
  });
  return Object.entries(totals)
    .map(([id, count]) => ({ id, nom: nomMembre(id), count }))
    .sort((a, b) => b.count - a.count);
}

function cappedNewEntriesArr(memberTransitions, capN) {
  return memberTransitions.map(row => Object.values(row.byMember).reduce((s, c) => s + Math.min(c, capN), 0));
}

// Renvoie les valeurs de croissance à utiliser partout : brutes ou plafonnées
// par membre/mois selon l'état de l'onglet "Limiter les propositions".
function effectiveGrowthArr(rawArr, memberTransitions) {
  return limitEnabled ? cappedNewEntriesArr(memberTransitions, limitN) : rawArr;
}

// ── Simulation d'une politique (projection déterministe) ─────────
function projectPolicy(startPool, growthPerMonth, carriedOverFn, months) {
  const arr = [startPool];
  for (let i = 0; i < months; i++) {
    const prevPool = arr[arr.length - 1];
    const carried  = Math.max(0, carriedOverFn(prevPool));
    arr.push(carried + growthPerMonth);
  }
  return arr;
}

function carriedOverFnFor(mode, value, allScores) {
  if (mode === "keep")    return prev => Math.min(prev - 1, value - 1);
  if (mode === "percent") return prev => prev - 1 - Math.round(prev * (value / 100));
  const rate = eliminationRateForScore(allScores, value);
  return prev => prev - 1 - Math.round(prev * rate);
}

function formatModeValue(mode, v) {
  if (mode === "keep")    return `Conserver ${v}`;
  if (mode === "percent") return `Éliminer ${v} %`;
  return `Score ${v}`;
}

// ── Rendu Chart.js partagé ────────────────────────────────────────
function buildProjectionDatasetGroup(label, color, carriedOverFn, startPool, growthStats, N_MONTHS, pad, opts = {}) {
  const group = [];
  if (showUncertainty && growthStats.stdev > 0) {
    const growthLow  = Math.max(0, growthStats.mean - growthStats.stdev);
    const growthHigh = growthStats.mean + growthStats.stdev;
    const low  = projectPolicy(startPool, growthLow,  carriedOverFn, N_MONTHS);
    const high = projectPolicy(startPool, growthHigh, carriedOverFn, N_MONTHS);
    group.push({ label: `${label} (bas)`, data: pad(low), borderColor: "transparent", backgroundColor: "transparent", pointRadius: 0, tension: .25, _isBand: true });
    group.push({ label: `${label} (haut)`, data: pad(high), borderColor: "transparent", backgroundColor: hexToRgba(color, 0.15), fill: "-1", pointRadius: 0, tension: .25, _isBand: true });
  }
  const central = projectPolicy(startPool, growthStats.mean, carriedOverFn, N_MONTHS);
  group.push({
    label, data: pad(central), borderColor: color, backgroundColor: color,
    borderDash: opts.solid ? undefined : [5, 4], borderWidth: opts.bold ? 3 : 1.5,
    tension: .25, pointRadius: opts.bold ? 4 : 3,
  });
  return group;
}

const LEGEND_HIDE_BANDS = {
  position: "top",
  labels: { usePointStyle: true, pointStyleWidth: 10, padding: 14, font: { size: 11 }, filter: (item, data) => !data.datasets[item.datasetIndex]._isBand },
};

function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  return {
    border: cs.getPropertyValue("--border").trim() || "#333",
    muted:  cs.getPropertyValue("--muted").trim()  || "#888",
    accent: cs.getPropertyValue("--accent").trim() || "#e8a44a",
  };
}

const MODE_PALETTE = ["#4ab870", "#3f8ecb", "#9b59b6", "#e05555", "#bf8a2f", "#46a0a0", "#c9648a", "#7a8ccf", "#8fae3f", "#d47f3f"];

// ── Init ───────────────────────────────────────────────────────────
async function init() {
  [votes, membres, livres, voteActif] = await Promise.all([getVotes(), getMembres(), getLivres(), getVoteActif()]);
  livres.forEach(l => { livreById[l.id] = l; });

  const infoEl = document.getElementById("stb-vote-info");
  const votants = voteActif ? (voteActif.membre_ids || []).length : 0;
  infoEl.innerHTML = voteActif
    ? `<div class="cht-vote-badge cht-vote-badge-live">🔴 Vote en cours — ${formatMois(voteActif.mois, voteActif.annee)} · ${votants} membres</div>`
    : `<div class="cht-vote-badge">Aucun vote en cours actuellement</div>`;

  initTabs();
  renderAll();
}

function initTabs() {
  document.querySelectorAll(".cht-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cht-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".cht-tab-content").forEach(el => el.classList.add("hidden"));
      document.getElementById("tab-" + btn.dataset.tab).classList.remove("hidden");
    });
  });
}

function renderAll() {
  const timeline = buildPoolTimeline();
  const transitions = computeTransitions(timeline);

  if (!transitions.length) {
    document.getElementById("tab-overview").innerHTML = `<div style="color:var(--muted);font-size:.85rem">Pas assez de votes archivés pour analyser une tendance (il en faut au moins 2).</div>`;
    ["compare", "limit", "montecarlo"].forEach(t => document.getElementById("tab-" + t).innerHTML = "");
    return;
  }

  const memberTransitions = computeMemberProposalsByTransition(transitions);
  const rawArr = transitions.map(t => t.newEntries);
  const growthArr = effectiveGrowthArr(rawArr, memberTransitions);
  const growthStats = computeGrowthStats(growthArr);
  const allScores = collectAllBookScores();

  renderOverviewTab(timeline, transitions, rawArr, growthArr, growthStats, allScores);
  renderCompareTab(timeline, growthStats, allScores);
  renderLimitTab(timeline, transitions, memberTransitions, rawArr, growthStats);
  renderMonteCarloTab(timeline, growthStats, allScores);
}

// ── Onglet Vue d'ensemble ─────────────────────────────────────────
function renderOverviewTab(timeline, transitions, rawArr, growthArr, growthStats, allScores) {
  const el = document.getElementById("tab-overview");
  const growthLow  = Math.max(0, growthStats.mean - growthStats.stdev);
  const growthHigh = growthStats.mean + growthStats.stdev;
  const currentPool = timeline[timeline.length - 1].poolSize;

  const histRows = timeline.map((t, i) => {
    const trans = i > 0 ? transitions[i - 1] : null;
    const eluPrec = i === 0 ? "—" : (timeline[i - 1].elu ? "1" : "0");
    return `<tr>
      <td class="cht-td-titre">${formatMois(t.mois, t.annee)}${!t.closed ? ' <span style="color:var(--accent);font-size:.72rem">(en cours)</span>' : ""}</td>
      <td class="cht-td-score">${t.poolSize}</td>
      <td class="cht-td-score">${trans ? trans.newEntries : "—"}</td>
      <td class="cht-td-score">${trans ? trans.eliminatedFromPrev : "—"}</td>
      <td class="cht-td-score">${eluPrec}</td>
    </tr>`;
  }).join("");

  const realElim = computeCurrentMonthRealElimination();
  const lastEntry = timeline[timeline.length - 1];
  const nm = nextMonth(lastEntry.mois, lastEntry.annee);
  let projRowHtml = "";
  if (realElim !== null) {
    const carry = Math.max(0, lastEntry.poolSize - realElim - 1);
    const poolLow = carry + growthLow, poolMid = carry + growthStats.mean, poolHigh = carry + growthHigh;
    projRowHtml = `<tr style="opacity:.8">
      <td class="cht-td-titre">${formatMois(nm.mois, nm.annee)} <span style="color:var(--accent);font-size:.72rem">(projection)</span></td>
      <td class="cht-td-score">≈ ${Math.round(poolMid)}<div class="cht-td-sous">[${Math.round(poolLow)} – ${Math.round(poolHigh)}]</div></td>
      <td class="cht-td-score">≈ ${growthStats.mean.toFixed(1)}<div class="cht-td-sous">± ${growthStats.stdev.toFixed(1)}</div></td>
      <td class="cht-td-score">${realElim}<div class="cht-td-sous">réel (tour 1 clos)</div></td>
      <td class="cht-td-score">1<div class="cht-td-sous">à venir</div></td>
    </tr>`;
  }

  const medNew  = median(rawArr);
  const lastNew = rawArr[rawArr.length - 1];
  const scenarios = [
    { label: `Moyenne historique (${rawArr.length} transition${rawArr.length > 1 ? "s" : ""})`, value: growthStats.mean },
    { label: "Médiane historique", value: median(growthArr) },
    { label: `Dernier mois (${formatMois(lastEntry.mois, lastEntry.annee)})`, value: growthArr[growthArr.length - 1] },
  ];
  const scenarioRows = scenarios.map(sc => {
    const req = requiredSettingsFor(sc.value, allScores);
    const scoreTxt = req.scoreT !== null ? req.scoreT.toFixed(2) : "—";
    return `<tr${req.impossible ? ' class="cht-row-changed"' : ""}>
      <td class="cht-td-titre">${sc.label}<div class="cht-td-sous">≈ ${sc.value.toFixed(1)} nouveaux livres / mois</div></td>
      <td class="cht-td-score">${scoreTxt}</td>
      <td class="cht-td-score">${req.percentP} %</td>
      <td class="cht-td-score">${req.keepN}</td>
    </tr>`;
  }).join("");

  let trendMsg;
  if (currentPool > targetPoolSize) {
    trendMsg = { type: "warn", msg: `⚠️ Le vote actuel compte <strong>${currentPool} livres</strong>, déjà au-dessus de l'objectif de ${targetPoolSize}. Sans seuil suffisant, ce nombre continuera de croître d'environ <strong>${(growthStats.mean - 1).toFixed(1)} livre${Math.abs(growthStats.mean - 1) >= 2 ? "s" : ""} par mois</strong>.` };
  } else {
    trendMsg = { type: "ok", msg: `✅ Le vote actuel compte ${currentPool} livres, sous l'objectif de ${targetPoolSize}.` };
  }

  el.innerHTML = `
    <div class="cht-section-label">Objectif de stabilisation</div>
    <div class="cht-expl">
      Chaque mois, des livres sont <strong>proposés</strong> (aucune limite, n'importe qui peut en proposer autant qu'il veut) et un seul livre est <strong>élu</strong> — retiré du vote. Sans seuil d'élimination, tous les autres livres <strong>s'accumulent</strong> d'un mois sur l'autre. Cette page calcule, à partir de l'historique réel des votes, quel réglage permet de garder le vote sous un nombre de livres cible, indéfiniment.
      ${limitEnabled ? `<br><br><strong>⚠️ La limitation des propositions est activée</strong> (onglet "Limiter les propositions", max ${limitN}/membre/mois) — tous les calculs de cette page en tiennent compte.` : ""}
    </div>
    <div class="cht-seuil-wrap" style="margin-bottom:1.1rem">
      <b>Objectif — garder le vote sous :</b>
      <input type="number" id="target-pool" class="cht-seuil-input" min="5" max="100" step="1" value="${targetPoolSize}">
      <span class="cht-seuil-suffix">livres</span>
    </div>

    <div class="cht-alert cht-alert-${trendMsg.type}">${trendMsg.msg}</div>

    <div class="cht-section-label">Historique du nombre de livres en compétition</div>
    <div style="overflow-x:auto">
      <table class="cht-table">
        <thead><tr>
          <th class="cht-td-titre">Vote</th>
          <th class="cht-td-score">Livres en compétition</th>
          <th class="cht-td-score">Nouveaux ce mois</th>
          <th class="cht-td-score">Éliminés depuis le mois précédent</th>
          <th class="cht-td-score">Élu le mois précédent</th>
        </tr></thead>
        <tbody>${histRows}${projRowHtml}</tbody>
      </table>
    </div>
    <div class="cht-footnote">"Nouveaux" = livres présents dans ce vote mais absents du précédent · "Éliminés" = livres du vote précédent qui ne sont ni revenus ni élus · Basé sur ${timeline.length} vote${timeline.length > 1 ? "s" : ""} (${formatMois(timeline[0].mois, timeline[0].annee)} → ${formatMois(lastEntry.mois, lastEntry.annee)})${realElim === null ? " · Projection indisponible tant que le tour 1 en cours n'est pas clos" : ""}</div>

    <div class="cht-section-label" style="margin-top:1.8rem">Réglage nécessaire selon le scénario de croissance</div>
    <div class="cht-expl">
      Pour chaque hypothèse sur le nombre de <strong>nouveaux</strong> livres proposés chaque mois, voici le réglage à appliquer pour que le vote reste sous <strong>${targetPoolSize} livres</strong> une fois stabilisé. Le <strong>score minimum</strong> est estimé depuis la distribution réelle des notes archivées (${allScores.length} note${allScores.length > 1 ? "s" : ""}) — les deux autres modes sont des calculs directs, donc plus fiables.
    </div>
    <div style="overflow-x:auto">
      <table class="cht-table">
        <thead><tr>
          <th class="cht-td-titre">Scénario de croissance</th>
          <th class="cht-td-score">Score minimum requis</th>
          <th class="cht-td-score">% à éliminer requis</th>
          <th class="cht-td-score">Livres à conserver</th>
        </tr></thead>
        <tbody>${scenarioRows}</tbody>
      </table>
    </div>
    <div class="cht-footnote">Ligne surlignée = objectif difficile à atteindre avec ce mode seul · 1 livre est retiré chaque mois par l'élection, indépendamment du seuil choisi</div>

    <div class="cht-section-label" style="margin-top:1.8rem">Incertitude sur la croissance</div>
    <div class="cht-expl">
      La moyenne de ${growthStats.mean.toFixed(1)} nouveaux livres/mois est calculée sur seulement ${growthArr.length} mois observés (${growthArr.map(v=>v.toFixed(1)).join(", ")}) — une valeur aussi précise laisse penser à une confiance qu'on n'a pas vraiment avec si peu de données. L'écart-type mesuré est de <strong>± ${growthStats.stdev.toFixed(1)}</strong>, soit une fourchette réaliste de <strong>${growthLow.toFixed(1)} à ${growthHigh.toFixed(1)}</strong> nouveaux livres/mois. Cette bande à largeur fixe reste une simplification — voir l'onglet <strong>🎲 Simulation Monte-Carlo</strong> pour une incertitude qui s'accumule correctement dans le temps.
    </div>
    <label style="display:inline-flex;align-items:center;gap:.5rem;font-size:.85rem;color:var(--muted);cursor:pointer">
      <input type="checkbox" id="show-uncertainty" ${showUncertainty ? "checked" : ""}>
      Afficher les bandes d'incertitude sur les graphiques de l'onglet "Comparer les seuils"
    </label>`;

  document.getElementById("target-pool").addEventListener("change", e => {
    const v = parseInt(e.target.value, 10);
    if (isNaN(v) || v < 1) return;
    targetPoolSize = v;
    localStorage.setItem("stb_target", String(v));
    renderAll();
  });
  document.getElementById("show-uncertainty").addEventListener("change", e => {
    showUncertainty = e.target.checked;
    localStorage.setItem("stb_uncertainty", showUncertainty ? "1" : "0");
    renderAll();
  });
}

// ── Onglet Comparer les seuils ────────────────────────────────────
function renderCompareTab(timeline, growthStats, allScores) {
  const el = document.getElementById("tab-compare");
  el.innerHTML = `
    <div class="cht-section-label">Comparaison graphique de seuils concrets</div>
    <div class="cht-expl">
      Toutes les projections ci-dessous utilisent la <strong>même hypothèse de croissance</strong> (${growthStats.mean.toFixed(1)} nouveaux livres/mois en moyenne). Comme 1 livre est élu chaque mois, la croissance nette <strong>sans seuil</strong> est d'environ <strong>${(growthStats.mean - 1).toFixed(1)} livres/mois</strong>. Modifiez les 4 seuils ci-dessous pour comparer leur effet sur 6 mois.
    </div>
    <div class="cht-seuil-wrap" style="row-gap:.6rem">
      <span>Conserver <input type="number" id="cmp-keepA" class="cht-seuil-input" style="width:56px" min="1" max="100" step="1" value="${comparePolicyParams.keepA}"> livres</span>
      <span>Conserver <input type="number" id="cmp-keepB" class="cht-seuil-input" style="width:56px" min="1" max="100" step="1" value="${comparePolicyParams.keepB}"> livres</span>
      <span>Éliminer <input type="number" id="cmp-percent" class="cht-seuil-input" style="width:56px" min="0" max="100" step="5" value="${comparePolicyParams.percent}"> % des moins bons scores</span>
      <span>Score minimum <input type="number" id="cmp-score" class="cht-seuil-input" style="width:56px" min="0" max="5" step="0.1" value="${comparePolicyParams.score}"></span>
    </div>
    <div style="overflow-x:auto;margin-top:.9rem"><div style="min-width:420px"><canvas id="chart-stabilisation" height="180"></canvas></div></div>
    <div class="cht-footnote">Le seuil "score minimum" applique le taux d'élimination réellement observé historiquement (parmi ${allScores.length} note${allScores.length > 1 ? "s" : ""} archivées) · Traits pointillés = projections, trait plein = historique réel</div>

    ${renderModeGraphSection("keep", "Conserver N livres — comparaison de plusieurs valeurs", "chart-mode-keep", "livres à conserver")}
    ${renderModeGraphSection("percent", "Éliminer un % des moins bons scores", "chart-mode-percent", "% éliminés")}
    ${renderModeGraphSection("score", "Score minimum d'élimination", "chart-mode-score", "score minimum")}`;

  [
    ["cmp-keepA", "keepA", "stb_cmp_keepA", parseInt],
    ["cmp-keepB", "keepB", "stb_cmp_keepB", parseInt],
    ["cmp-percent", "percent", "stb_cmp_percent", parseFloat],
    ["cmp-score", "score", "stb_cmp_score", parseFloat],
  ].forEach(([id, key, storageKey, parseFn]) => {
    document.getElementById(id).addEventListener("change", e => {
      const v = parseFn(e.target.value, 10);
      if (isNaN(v)) return;
      comparePolicyParams[key] = v;
      localStorage.setItem(storageKey, String(v));
      drawStabilisationChart(timeline, growthStats, allScores);
    });
  });

  wireModeGraphControls("keep", timeline, growthStats, allScores);
  wireModeGraphControls("percent", timeline, growthStats, allScores);
  wireModeGraphControls("score", timeline, growthStats, allScores);

  drawStabilisationChart(timeline, growthStats, allScores);
  drawModeGraph("keep", timeline, growthStats, allScores);
  drawModeGraph("percent", timeline, growthStats, allScores);
  drawModeGraph("score", timeline, growthStats, allScores);
}

function renderModeGraphSection(mode, title, canvasId, unitLabel) {
  const r = graphRanges[mode];
  const stepAttr = mode === "score" ? "0.1" : "1";
  return `
    <div class="cht-section-label" style="margin-top:1.8rem">${title}</div>
    <div class="cht-expl">
      Comparez plusieurs valeurs : de <input type="number" id="range-${mode}-from" class="cht-seuil-input" style="width:56px" step="${stepAttr}" value="${r.from}">
      à <input type="number" id="range-${mode}-to" class="cht-seuil-input" style="width:56px" step="${stepAttr}" value="${r.to}">
      par pas de <input type="number" id="range-${mode}-step" class="cht-seuil-input" style="width:56px" step="${stepAttr}" min="${stepAttr}" value="${r.step}">
      (${unitLabel}). La ligne <strong style="color:#ffcf4d">★ en surbrillance</strong> reste toujours affichée : le réglage qui stabilise le vote le plus près de l'objectif défini dans "Vue d'ensemble".
    </div>
    <div style="overflow-x:auto"><div style="min-width:420px"><canvas id="${canvasId}" height="180"></canvas></div></div>
    <div class="cht-footnote" id="footnote-${mode}"></div>`;
}

function wireModeGraphControls(mode, timeline, growthStats, allScores) {
  ["from", "to", "step"].forEach(part => {
    document.getElementById(`range-${mode}-${part}`).addEventListener("change", e => {
      const v = parseFloat(e.target.value);
      if (isNaN(v)) return;
      graphRanges[mode][part] = v;
      localStorage.setItem(`stb_g${mode[0]}_${part}`, String(v));
      drawModeGraph(mode, timeline, growthStats, allScores);
    });
  });
}

async function drawStabilisationChart(timeline, growthStats, allScores) {
  await loadChartJs();
  const canvas = document.getElementById("chart-stabilisation");
  if (!canvas) return;
  const { border: borderClr, muted: mutedClr, accent: accentClr } = chartColors();

  const histLabels = timeline.map(t => formatMois(t.mois, t.annee));
  const histData   = timeline.map(t => t.poolSize);
  const startPool  = histData[histData.length - 1];
  const N_MONTHS = 6;
  const { keepA, keepB, percent, score } = comparePolicyParams;
  const scoreRate = eliminationRateForScore(allScores, score);

  const policies = [
    { label: "Sans seuil (statu quo)", color: "#e05555", carriedOverFn: prev => prev - 1 },
    { label: `Conserver ${keepA} livres`, color: "#4ab870", carriedOverFn: prev => Math.min(prev - 1, keepA - 1) },
    { label: `Conserver ${keepB} livres`, color: "#3f8ecb", carriedOverFn: prev => Math.min(prev - 1, keepB - 1) },
    { label: `Éliminer ${percent} % des moins bons`, color: "#9b59b6", carriedOverFn: prev => prev - 1 - Math.round(prev * (percent / 100)) },
    { label: `Score minimum ${score}`, color: "#bf8a2f", carriedOverFn: prev => prev - 1 - Math.round(prev * scoreRate) },
  ];

  const projLabels = [...histLabels, ...Array.from({ length: N_MONTHS }, (_, i) => `+${i + 1} mois`)];
  const pad = arr => [...Array(histLabels.length - 1).fill(null), ...arr];
  const datasets = [
    { label: "Historique réel", data: [...histData, ...Array(N_MONTHS).fill(null)], borderColor: accentClr, backgroundColor: accentClr, tension: .25, pointRadius: 4 },
    ...policies.flatMap(p => buildProjectionDatasetGroup(p.label, p.color, p.carriedOverFn, startPool, growthStats, N_MONTHS, pad)),
  ];

  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type: "line",
    data: { labels: projLabels, datasets },
    options: {
      responsive: true, animation: { duration: 600 },
      plugins: { legend: { ...LEGEND_HIDE_BANDS, labels: { ...LEGEND_HIDE_BANDS.labels, color: mutedClr } } },
      scales: {
        x: { ticks: { color: mutedClr, maxRotation: 0, autoSkip: true }, grid: { color: borderClr } },
        y: { beginAtZero: true, ticks: { color: mutedClr }, grid: { color: borderClr }, title: { display: true, text: "Livres en compétition", color: mutedClr, font: { size: 11 } } },
      },
    },
  });
}

async function drawModeGraph(mode, timeline, growthStats, allScores) {
  await loadChartJs();
  const canvas = document.getElementById(`chart-mode-${mode}`);
  if (!canvas) return;
  const { border: borderClr, muted: mutedClr, accent: accentClr } = chartColors();

  const histLabels = timeline.map(t => formatMois(t.mois, t.annee));
  const histData   = timeline.map(t => t.poolSize);
  const startPool  = histData[histData.length - 1];
  const N_MONTHS = 6;
  const projLabels = [...histLabels, ...Array.from({ length: N_MONTHS }, (_, i) => `+${i + 1} mois`)];
  const pad = arr => [...Array(histLabels.length - 1).fill(null), ...arr];

  const r = graphRanges[mode];
  const { values, effStep, capped } = buildStepValues(r.from, r.to, r.step);
  const req = requiredSettingsFor(growthStats.mean, allScores);
  const optimalValue = mode === "keep" ? req.keepN : mode === "percent" ? req.percentP : req.scoreT;

  const footnoteEl = document.getElementById(`footnote-${mode}`);
  if (footnoteEl) {
    footnoteEl.textContent = (capped ? `Pas ajusté à ${effStep.toFixed(2)} pour rester lisible (demandé : ${r.step}) · ` : "") +
      `★ optimal actuel : ${mode === "score" ? optimalValue?.toFixed(2) : optimalValue} (pour rester sous ${targetPoolSize} livres, croissance moyenne de ${growthStats.mean.toFixed(1)}/mois)` +
      (showUncertainty ? " · bande colorée = croissance moyenne ± écart-type" : "");
  }

  const datasets = [
    { label: "Historique réel", data: [...histData, ...Array(N_MONTHS).fill(null)], borderColor: accentClr, backgroundColor: accentClr, tension: .25, pointRadius: 4 },
    ...values.flatMap((v, i) => buildProjectionDatasetGroup(formatModeValue(mode, v), MODE_PALETTE[i % MODE_PALETTE.length], carriedOverFnFor(mode, v, allScores), startPool, growthStats, N_MONTHS, pad)),
  ];
  if (optimalValue !== null && optimalValue !== undefined) {
    datasets.push(...buildProjectionDatasetGroup(`★ Optimal (${mode === "score" ? optimalValue.toFixed(2) : optimalValue})`, "#ffcf4d", carriedOverFnFor(mode, optimalValue, allScores), startPool, growthStats, N_MONTHS, pad, { bold: true, solid: true }));
  }

  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type: "line",
    data: { labels: projLabels, datasets },
    options: {
      responsive: true, animation: { duration: 600 },
      plugins: { legend: { ...LEGEND_HIDE_BANDS, labels: { ...LEGEND_HIDE_BANDS.labels, color: mutedClr } } },
      scales: {
        x: { ticks: { color: mutedClr, maxRotation: 0, autoSkip: true }, grid: { color: borderClr } },
        y: { beginAtZero: true, ticks: { color: mutedClr }, grid: { color: borderClr }, title: { display: true, text: "Livres en compétition", color: mutedClr, font: { size: 11 } } },
      },
    },
  });
}

// ── Onglet Limiter les propositions ───────────────────────────────
function renderLimitTab(timeline, transitions, memberTransitions, rawArr, effGrowthStats) {
  const el = document.getElementById("tab-limit");
  const totals = computeMemberTotals();
  const nProposants = totals.length;
  const nMembres = membres.length;

  const totalsRows = totals.map(t => `<tr>
    <td class="cht-td-titre">${esc(t.nom)}</td>
    <td class="cht-td-score">${t.count}</td>
  </tr>`).join("");

  const cappedArr = cappedNewEntriesArr(memberTransitions, limitN);
  const cappedStats = computeGrowthStats(cappedArr);

  const compareRows = memberTransitions.map((row, i) => {
    const capped = cappedArr[i];
    return `<tr>
      <td class="cht-td-titre">${formatMois(row.mois, row.annee)}</td>
      <td class="cht-td-score">${row.total}</td>
      <td class="cht-td-score">${capped}${capped < row.total ? ` <span style="color:var(--green,#4ab870);font-size:.72rem">(−${row.total - capped})</span>` : ""}</td>
    </tr>`;
  }).join("");

  el.innerHTML = `
    <div class="cht-section-label">Qui propose des livres ?</div>
    <div class="cht-expl">
      Sur <strong>${nMembres} membres</strong>, <strong>${nProposants}</strong> ont proposé au moins un livre depuis le début du suivi. Une limitation du nombre de propositions par personne et par mois agit <strong>à la source</strong> (moins de livres entrent dans le vote), contrairement aux seuils d'élimination qui agissent <strong>après coup</strong> (des livres sont retirés une fois déjà en compétition). C'est un levier complémentaire, pas un remplacement.
    </div>
    <div style="overflow-x:auto">
      <table class="cht-table">
        <thead><tr><th class="cht-td-titre">Membre</th><th class="cht-td-score">Livres proposés (total)</th></tr></thead>
        <tbody>${totalsRows}</tbody>
      </table>
    </div>
    <div class="cht-footnote">Total sur toute la période suivie par le club de lecture, tous votes confondus</div>

    <div class="cht-section-label" style="margin-top:1.8rem">Simuler une limite</div>
    <div class="cht-expl">
      Combien de <strong>nouveaux</strong> livres par mois y aurait-il eu si chaque membre était plafonné à N propositions par mois ? Ceci recalcule l'historique réel avec ce plafond (en gardant, pour chaque membre et chaque mois, ses N premières propositions).
    </div>
    <div class="cht-seuil-wrap">
      <span>Limiter à <input type="number" id="limit-n" class="cht-seuil-input" style="width:56px" min="1" max="20" step="1" value="${limitN}"> propositions par membre et par mois</span>
      <label style="display:inline-flex;align-items:center;gap:.4rem;cursor:pointer">
        <input type="checkbox" id="limit-enabled" ${limitEnabled ? "checked" : ""}>
        Activer cette limite dans tous les calculs de la page
      </label>
    </div>
    <div style="overflow-x:auto;margin-top:.8rem">
      <table class="cht-table">
        <thead><tr><th class="cht-td-titre">Mois</th><th class="cht-td-score">Nouveaux livres réels</th><th class="cht-td-score">Nouveaux livres avec plafond de ${limitN}</th></tr></thead>
        <tbody>${compareRows}</tbody>
      </table>
    </div>
    <div class="cht-alert cht-alert-${limitEnabled ? "ok" : "warn"}" style="margin-top:1rem">
      ${limitEnabled
        ? `✅ Limite <strong>activée</strong> : avec un plafond de ${limitN}/membre/mois, la croissance moyenne observée aurait été de <strong>${cappedStats.mean.toFixed(1)} nouveaux livres/mois</strong> (± ${cappedStats.stdev.toFixed(1)}) au lieu de ${mean(rawArr).toFixed(1)} réellement. C'est cette valeur plafonnée qui alimente maintenant tous les autres onglets.`
        : `Limite <strong>désactivée</strong> — cochez la case ci-dessus pour l'appliquer partout sur la page. Avec ${limitN}/membre/mois, la croissance moyenne serait de ${cappedStats.mean.toFixed(1)}/mois au lieu de ${mean(rawArr).toFixed(1)} réellement.`}
    </div>
    <div class="cht-footnote">Cette simulation ne change rien au vote réel — elle sert uniquement à évaluer l'impact d'une éventuelle règle avant d'en discuter en groupe</div>`;

  document.getElementById("limit-n").addEventListener("change", e => {
    const v = parseInt(e.target.value, 10);
    if (isNaN(v) || v < 1) return;
    limitN = v;
    localStorage.setItem("stb_limit_n", String(v));
    renderAll();
  });
  document.getElementById("limit-enabled").addEventListener("change", e => {
    limitEnabled = e.target.checked;
    localStorage.setItem("stb_limit_enabled", limitEnabled ? "1" : "0");
    renderAll();
  });
}

// ── Onglet Simulation Monte-Carlo ─────────────────────────────────
function randNormal(meanVal, stdev) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return meanVal + z * stdev;
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return null;
  const idx = (sortedArr.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
}

function runMonteCarlo(startPool, growthStats, carriedOverFn, months, runs) {
  const trajectories = [];
  for (let s = 0; s < runs; s++) {
    const traj = [startPool];
    for (let m = 0; m < months; m++) {
      const g = Math.max(0, randNormal(growthStats.mean, growthStats.stdev));
      const prevPool = traj[traj.length - 1];
      const carried = Math.max(0, carriedOverFn(prevPool));
      traj.push(carried + g);
    }
    trajectories.push(traj);
  }
  const monthStats = [];
  for (let m = 0; m <= months; m++) {
    const vals = trajectories.map(t => t[m]).sort((a, b) => a - b);
    monthStats.push({ mean: mean(vals), p10: percentile(vals, 0.10), p90: percentile(vals, 0.90), min: vals[0], max: vals[vals.length - 1] });
  }
  return monthStats;
}

function renderMonteCarloTab(timeline, growthStats, allScores) {
  const el = document.getElementById("tab-montecarlo");
  const req = requiredSettingsFor(growthStats.mean, allScores);
  if (mcValue === null) {
    mcValue = mcMode === "keep" ? req.keepN : mcMode === "percent" ? req.percentP : (req.scoreT ?? 3);
  }

  el.innerHTML = `
    <div class="cht-section-label">Simulation Monte-Carlo</div>
    <div class="cht-expl">
      Contrairement aux graphiques de l'onglet "Comparer les seuils" (qui appliquent une croissance <em>constante</em> ± un écart fixe), cette simulation tire un nombre de nouveaux livres <strong>au hasard chaque mois</strong> (autour de la moyenne observée), répète l'opération des centaines de fois, et regarde comment les résultats se dispersent. C'est plus honnête : l'incertitude s'accumule naturellement mois après mois au lieu de rester figée.
      <br><br>
      Tout se calcule dans votre navigateur — aucune requête au serveur, aucune limite technique. Même 5000 tirages s'exécutent en une fraction de seconde. Au-delà d'environ 1000-2000 tirages, le résultat ne bouge quasiment plus (l'estimation se stabilise) — inutile d'aller beaucoup plus haut.
    </div>
    <div class="cht-seuil-wrap">
      <span>Nombre de tirages <input type="number" id="mc-runs" class="cht-seuil-input" style="width:70px" min="50" max="5000" step="50" value="${mcRuns}"></span>
      <span>Horizon <input type="number" id="mc-months" class="cht-seuil-input" style="width:56px" min="1" max="24" step="1" value="${mcMonths}"> mois</span>
      <span>Critère
        <select id="mc-mode" class="cht-vote-select">
          <option value="keep" ${mcMode === "keep" ? "selected" : ""}>Conserver N livres</option>
          <option value="percent" ${mcMode === "percent" ? "selected" : ""}>Éliminer X %</option>
          <option value="score" ${mcMode === "score" ? "selected" : ""}>Score minimum</option>
        </select>
      </span>
      <span>Valeur <input type="number" id="mc-value" class="cht-seuil-input" style="width:70px" step="${mcMode === "score" ? "0.1" : "1"}" value="${mcMode === "score" ? Number(mcValue).toFixed(2) : mcValue}"></span>
      <button class="btn btn-primary" id="mc-run">🎲 Lancer la simulation</button>
    </div>
    <div id="mc-result" style="margin:.8rem 0"></div>
    <div style="overflow-x:auto"><div style="min-width:420px"><canvas id="chart-montecarlo" height="200"></canvas></div></div>
    <div class="cht-footnote" id="mc-footnote"></div>`;

  document.getElementById("mc-mode").addEventListener("change", e => {
    mcMode = e.target.value;
    localStorage.setItem("stb_mc_mode", mcMode);
    const r2 = requiredSettingsFor(growthStats.mean, allScores);
    mcValue = mcMode === "keep" ? r2.keepN : mcMode === "percent" ? r2.percentP : (r2.scoreT ?? 3);
    localStorage.setItem("stb_mc_value", String(mcValue));
    renderMonteCarloTab(timeline, growthStats, allScores);
  });

  document.getElementById("mc-run").addEventListener("click", () => {
    const runsInput = parseInt(document.getElementById("mc-runs").value, 10);
    const monthsInput = parseInt(document.getElementById("mc-months").value, 10);
    const valueInput = parseFloat(document.getElementById("mc-value").value);
    if (isNaN(runsInput) || runsInput < 1 || isNaN(monthsInput) || monthsInput < 1 || isNaN(valueInput)) return;
    mcRuns = Math.min(5000, Math.max(1, runsInput));
    mcMonths = Math.min(24, Math.max(1, monthsInput));
    mcValue = valueInput;
    localStorage.setItem("stb_mc_runs", String(mcRuns));
    localStorage.setItem("stb_mc_months", String(mcMonths));
    localStorage.setItem("stb_mc_value", String(mcValue));
    launchMonteCarlo(timeline, growthStats, allScores);
  });
}

async function launchMonteCarlo(timeline, growthStats, allScores) {
  await loadChartJs();
  const canvas = document.getElementById("chart-montecarlo");
  if (!canvas) return;

  const t0 = performance.now();
  const startPool = timeline[timeline.length - 1].poolSize;
  const carriedOverFn = carriedOverFnFor(mcMode, mcValue, allScores);
  const monthStats = runMonteCarlo(startPool, growthStats, carriedOverFn, mcMonths, mcRuns);
  const elapsedMs = (performance.now() - t0).toFixed(1);

  const { border: borderClr, muted: mutedClr, accent: accentClr } = chartColors();
  const labels = ["Aujourd'hui", ...Array.from({ length: mcMonths }, (_, i) => `+${i + 1} mois`)];

  const meanLine = monthStats.map(s => s.mean);
  const p10Line  = monthStats.map(s => s.p10);
  const p90Line  = monthStats.map(s => s.p90);

  const datasets = [
    { label: "10e percentile", data: p10Line, borderColor: "transparent", backgroundColor: "transparent", pointRadius: 0, tension: .2, _isBand: true },
    { label: "90e percentile", data: p90Line, borderColor: "transparent", backgroundColor: hexToRgba("#ffcf4d", 0.18), fill: "-1", pointRadius: 0, tension: .2, _isBand: true },
    { label: `Moyenne sur ${mcRuns} tirages — ${formatModeValue(mcMode, mcMode === "score" ? mcValue.toFixed(2) : mcValue)}`, data: meanLine, borderColor: "#ffcf4d", backgroundColor: "#ffcf4d", borderWidth: 3, tension: .2, pointRadius: 4 },
  ];

  if (canvas._chart) canvas._chart.destroy();
  canvas._chart = new Chart(canvas, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true, animation: { duration: 500 },
      plugins: { legend: { ...LEGEND_HIDE_BANDS, labels: { ...LEGEND_HIDE_BANDS.labels, color: mutedClr } } },
      scales: {
        x: { ticks: { color: mutedClr, maxRotation: 0 }, grid: { color: borderClr } },
        y: { beginAtZero: true, ticks: { color: mutedClr }, grid: { color: borderClr }, title: { display: true, text: "Livres en compétition", color: mutedClr, font: { size: 11 } } },
      },
    },
  });

  const last = monthStats[monthStats.length - 1];
  document.getElementById("mc-result").innerHTML = `
    <div class="cht-alert cht-alert-ok">
      Après <strong>${mcMonths} mois</strong> (${mcRuns} tirages, calculés en ${elapsedMs} ms) : en moyenne <strong>${last.mean.toFixed(1)} livres</strong>, avec 80% des simulations entre <strong>${last.p10.toFixed(0)}</strong> et <strong>${last.p90.toFixed(0)}</strong> livres (extrêmes observés : ${last.min.toFixed(0)} – ${last.max.toFixed(0)}).
    </div>`;
  document.getElementById("mc-footnote").textContent =
    `Bande dorée = intervalle du 10e au 90e percentile sur les ${mcRuns} tirages (élargit naturellement avec l'horizon) · Chaque mois de chaque tirage est indépendant (pas d'autocorrélation modélisée) · Croissance mensuelle tirée d'une loi normale (moyenne ${growthStats.mean.toFixed(1)}, écart-type ${growthStats.stdev.toFixed(1)}), tronquée à 0`;
}

init().catch(console.error);
