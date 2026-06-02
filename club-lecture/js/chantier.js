import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMembres, getVotes } from "./db.js";
import { formatMois } from "./utils.js";

async function loadChartJs() {
  if (window.Chart) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

await requireAuth();
initNav("chantier");

let votes = [], membres = [], lastVote = null;

// ── Utilitaires math ──────────────────────────────────────────────

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function nomMembre(id) {
  return membres.find(m => m.id === id)?.nom ?? id;
}

function prenom(nom) {
  return (nom || "").split(" ")[0];
}

// Couleur de fond selon le score (1=rouge … 5=vert)
function scoreBg(score) {
  if (score === null) return "";
  if (score <= 1.5) return "rgba(210,55,55,0.18)";
  if (score <= 2.5) return "rgba(220,125,40,0.15)";
  if (score <= 3.5) return "rgba(190,170,30,0.11)";
  if (score <= 4.5) return "rgba(75,185,80,0.12)";
  return "rgba(35,145,55,0.18)";
}

// Badge résultat selon score et meilleur score
function getResultat(score, maxScore, hasTies) {
  if (score === null) return { text: "—", cls: "" };
  if (hasTies && score === maxScore) return { text: "⚖️ Égalité", cls: "cht-tie" };
  if (score === maxScore) return { text: "✅ Élu", cls: "cht-elu" };
  if (score <= 2.5) return { text: "❌ Éliminé", cls: "cht-elim" };
  return { text: "🟣 Conservé", cls: "cht-conserve" };
}

// Collecte tous les votants du vote
function getVotants(resultats) {
  const ids = new Set();
  resultats.forEach(r => Object.keys(r.notes || {}).forEach(id => ids.add(id)));
  return [...ids]
    .map(id => ({ id, nom: nomMembre(id) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

// ── Init ──────────────────────────────────────────────────────────

async function init() {
  [votes, membres] = await Promise.all([getVotes(), getMembres()]);

  // Dernier vote terminé (votes triés date desc)
  lastVote = votes[0] ?? null;

  const infoEl = document.getElementById("chantier-vote-info");

  if (!lastVote || !(lastVote.resultats || []).length) {
    infoEl.innerHTML = `<div style="color:var(--muted);font-size:.88rem">Aucun vote terminé disponible.</div>`;
    return;
  }

  const votants = getVotants(lastVote.resultats);
  infoEl.innerHTML = `
    <div class="cht-vote-badge">
      🗳️ Analyse du vote de <strong>${formatMois(lastVote.mois, lastVote.annee)}</strong>
      — ${(lastVote.resultats || []).length} livres · ${votants.length} votant${votants.length > 1 ? "s" : ""}
    </div>`;

  renderTabCombine();
  renderTabDispersion();
  renderTabInfluence();
  renderTabMediane();
  renderTabSimulation();
  renderTabImpact();
  initTabs();
}

// ── Navigation onglets ────────────────────────────────────────────

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

// ── Onglet 0 : Combiné (moyenne + médiane) / 2 ───────────────────

function renderTabCombine() {
  const el = document.getElementById("tab-combine");
  const resultats = lastVote.resultats || [];

  const data = resultats.map(r => {
    const notes = Object.values(r.notes || {}).map(Number).filter(n => !isNaN(n));
    const moy = r.moyenne ?? mean(notes);
    const med = median(notes);
    const combined = (moy !== null && med !== null) ? (moy + med) / 2 : null;
    return { ...r, moy, med, combined, nbNotes: notes.length };
  });

  const withCombined = data.filter(r => r.combined !== null);
  if (!withCombined.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Données insuffisantes.</div>`;
    return;
  }

  const maxCombined = Math.max(...withCombined.map(r => r.combined));
  const maxMoy      = Math.max(...data.filter(r => r.moy !== null).map(r => r.moy));

  // Égalité par score combiné ?
  const topCombined = withCombined.filter(r => r.combined === maxCombined);
  const tieCombined = topCombined.length > 1;

  const eluActuel   = lastVote.livre_elu;
  const eluCombined = !tieCombined ? topCombined[0]?.livre_id : null;

  let alerte;
  if (tieCombined) {
    alerte = { type: "warn", msg: `⚖️ Égalité entre ${topCombined.length} livres avec le score combiné (${topCombined.map(r => `"${r.titre}"`).join(", ")}) — un 2ème tour serait nécessaire.` };
  } else if (eluCombined && eluCombined !== eluActuel) {
    const nomNouveau = data.find(r => r.livre_id === eluCombined)?.titre ?? "?";
    const nomAncien  = data.find(r => r.livre_id === eluActuel)?.titre ?? "?";
    alerte = { type: "change", msg: `🔄 Le résultat <strong>changerait</strong> : au lieu de "${nomAncien}", c'est "<strong>${nomNouveau}</strong>" qui serait élu.` };
  } else {
    alerte = { type: "ok", msg: `✅ Le score combiné <strong>ne change pas</strong> le résultat — le même livre serait élu.` };
  }

  const sorted = [...data].sort((a, b) => (b.combined ?? -1) - (a.combined ?? -1));

  const rows = sorted.map((r, i) => {
    const resActuel  = getResultat(r.moy, maxMoy, false);
    const resCombine = getResultat(r.combined, maxCombined, tieCombined);
    const changed    = resActuel.cls !== resCombine.cls;

    // Barre de score combiné
    const pct = maxCombined > 0 ? Math.round(r.combined / 5 * 100) : 0;

    return `<tr class="${changed ? "cht-row-changed" : ""}">
      <td class="cht-td-titre">
        ${i === 0 && !tieCombined ? '<span style="font-size:.9rem">🏆</span> ' : ""}${r.titre}
        <div class="cht-td-sous">${r.auteur || ""} · ${r.nbNotes} note${r.nbNotes > 1 ? "s" : ""}</div>
      </td>
      <td class="cht-td-score" style="background:${scoreBg(r.moy)}">${r.moy !== null ? r.moy.toFixed(2) : "—"}</td>
      <td class="cht-td-score" style="background:${scoreBg(r.med)}">${r.med !== null ? r.med.toFixed(1) : "—"}</td>
      <td class="cht-td-score cht-combined-score" style="background:${scoreBg(r.combined)}">
        ${r.combined !== null ? r.combined.toFixed(2) : "—"}
        <div class="cht-combined-bar"><div style="width:${pct}%;height:100%;background:var(--accent);border-radius:3px;opacity:.55"></div></div>
      </td>
      <td class="cht-td-badge"><span class="${resActuel.cls}">${resActuel.text}</span></td>
      <td class="cht-td-badge"><span class="${resCombine.cls}">${resCombine.text}</span>${changed ? ' <span class="cht-diff">≠</span>' : ""}</td>
    </tr>`;
  }).join("");

  el.innerHTML = `
    <div class="cht-alert cht-alert-${alerte.type}">${alerte.msg}</div>
    <div class="cht-section-label">Résultats simulés — score combiné (moyenne + médiane) ÷ 2</div>
    <div class="cht-expl">
      Le <strong>score combiné</strong> fait la moyenne entre la moyenne et la médiane de chaque livre.
      La médiane "ancre" le score là où est le groupe, la moyenne apporte la nuance entre des livres autrement à égalité.
      Résultat : un vote stratégique isolé a <strong>deux fois moins d'impact</strong> qu'avec la moyenne seule, et les égalités de la médiane pure disparaissent presque toujours.
    </div>
    <div style="overflow-x:auto">
      <table class="cht-table">
        <thead><tr>
          <th class="cht-td-titre">Livre</th>
          <th class="cht-td-score">Moyenne</th>
          <th class="cht-td-score">Médiane</th>
          <th class="cht-td-score">Score combiné</th>
          <th class="cht-td-badge">Résultat actuel</th>
          <th class="cht-td-badge">Si combiné</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="cht-footnote">Score combiné = (moyenne + médiane) ÷ 2 · Seuil d'élimination : ≤ 2,5 · Trié par score combiné décroissant</div>`;
}

// ── Onglet Dispersion ─────────────────────────────────────────────

async function renderTabDispersion() {
  const el = document.getElementById("tab-dispersion");
  const resultats = lastVote.resultats || [];
  if (!resultats.length) { el.innerHTML = `<div style="color:var(--muted)">Aucune donnée.</div>`; return; }

  const minWidth = Math.max(420, resultats.length * 58);
  const legendItems = resultats.map((r, i) =>
    `<div class="cht-disp-legend-item"><span class="cht-disp-legend-num">${i + 1}</span>${r.titre}${r.auteur ? ` <span style="color:var(--muted);font-size:.72rem">— ${r.auteur}</span>` : ""}</div>`
  ).join("");

  el.innerHTML = `
    <div class="cht-section-label">Dispersion des votes par livre — ${formatMois(lastVote.mois, lastVote.annee)}</div>
    <div class="cht-expl">
      Chaque <strong>petit cercle bleuté</strong> = la note d'un votant (légèrement décalé si plusieurs ont la même note).
      <span style="white-space:nowrap"><strong style="color:#9b59b6">▲ violet</strong> = médiane (référence)</span> ·
      <span style="white-space:nowrap"><strong style="color:var(--accent)">◆ orange</strong> = moyenne</span> ·
      <span style="white-space:nowrap"><strong style="color:#4ab870">★ vert</strong> = combiné ÷2</span>
      — survolez un point pour voir la dérive vs médiane.
    </div>
    <div style="overflow-x:auto;margin-top:.75rem">
      <div style="min-width:${minWidth}px">
        <canvas id="chart-dispersion" height="240"></canvas>
      </div>
    </div>
    <div class="cht-disp-legend">${legendItems}</div>`;

  await loadChartJs();

  const cs       = getComputedStyle(document.documentElement);
  const borderClr = cs.getPropertyValue("--border").trim() || "#333";
  const mutedClr  = cs.getPropertyValue("--muted").trim()  || "#888";
  const accentClr = cs.getPropertyValue("--accent").trim() || "#e8a44a";

  // Construire les datasets
  const votePoints     = [];
  const meanPoints     = [];
  const medianPoints   = [];
  const combinedPoints = [];

  resultats.forEach((r, idx) => {
    const notes = Object.values(r.notes || {}).map(Number).filter(n => !isNaN(n));
    if (!notes.length) return;

    // Jitter : regrouper par valeur de note, étaler horizontalement
    const groups = {};
    notes.forEach(n => { (groups[n] = groups[n] || []).push(n); });
    Object.entries(groups).forEach(([noteVal, arr]) => {
      const count  = arr.length;
      const spread = count > 1 ? Math.min(0.33, (count - 1) * 0.09) : 0;
      arr.forEach((_, i) => {
        const offset = count > 1 ? -spread / 2 + i * (spread / (count - 1)) : 0;
        votePoints.push({ x: idx + offset, y: Number(noteVal) });
      });
    });

    const moy  = r.moyenne ?? mean(notes);
    const med  = median(notes);
    const comb = moy !== null && med !== null ? (moy + med) / 2 : null;
    if (moy  !== null) meanPoints.push({ x: idx, y: moy });
    if (med  !== null) medianPoints.push({ x: idx, y: med });
    if (comb !== null) combinedPoints.push({ x: idx, y: comb });
  });

  // Indicateurs d'écart à la médiane par livre (pour le tooltip et les annotations)
  const deviations = resultats.map((r, idx) => {
    const notes = Object.values(r.notes || {}).map(Number).filter(n => !isNaN(n));
    const med  = median(notes);
    const moy  = r.moyenne ?? mean(notes);
    const comb = moy !== null && med !== null ? (moy + med) / 2 : null;
    return {
      titre: r.titre,
      med,
      moy,
      comb,
      moyDrift:  moy  !== null && med !== null ? moy  - med : null,
      combDrift: comb !== null && med !== null ? comb - med : null,
    };
  });

  const labels = resultats.map((_, i) => String(i + 1));

  new Chart(document.getElementById("chart-dispersion"), {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Votes individuels",
          data: votePoints,
          backgroundColor: "rgba(130,145,210,0.38)",
          borderColor:     "rgba(130,145,210,0.65)",
          borderWidth: 1,
          pointRadius: 5.5,
          pointHoverRadius: 7,
          pointStyle: "circle",
          order: 4,
        },
        {
          label: "Médiane (centre de référence)",
          data: medianPoints,
          backgroundColor: "#9b59b6",
          borderColor: "#fff",
          borderWidth: 2,
          pointRadius: 11,
          pointHoverRadius: 13,
          pointStyle: "triangle",
          order: 1,
        },
        {
          label: "Moyenne (dérive vs médiane)",
          data: meanPoints,
          backgroundColor: accentClr,
          borderColor: "#fff",
          borderWidth: 2,
          pointRadius: 10,
          pointHoverRadius: 12,
          pointStyle: "rectRot",
          order: 2,
        },
        {
          label: "Combiné ÷2 (dérive vs médiane)",
          data: combinedPoints,
          backgroundColor: "#4ab870",
          borderColor: "#fff",
          borderWidth: 2,
          pointRadius: 10,
          pointHoverRadius: 12,
          pointStyle: "star",
          order: 3,
        },
      ]
    },
    options: {
      responsive: true,
      animation: { duration: 700, easing: "easeInOutQuart" },
      plugins: {
        legend: {
          position: "top",
          labels: { color: mutedClr, font: { size: 12 }, usePointStyle: true, pointStyleWidth: 14, padding: 18 }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const idx   = Math.round(ctx.parsed.x);
              const dev   = deviations[idx];
              const titre = dev?.titre ?? "";
              const val   = ctx.parsed.y.toFixed(2);
              const ds    = ctx.dataset.label;

              if (ds.startsWith("Votes")) {
                return `Vote — ${titre} : ${val}/5`;
              }
              if (ds.startsWith("Médiane")) {
                return `Médiane — ${titre} : ${val}/5 (référence)`;
              }
              if (ds.startsWith("Moyenne") && dev?.moyDrift !== null) {
                const d = dev.moyDrift;
                const sign = d > 0 ? "+" : "";
                return `Moyenne — ${titre} : ${val}/5  (dérive ${sign}${d.toFixed(2)} vs médiane)`;
              }
              if (ds.startsWith("Combiné") && dev?.combDrift !== null) {
                const d = dev.combDrift;
                const sign = d > 0 ? "+" : "";
                return `Combiné — ${titre} : ${val}/5  (dérive ${sign}${d.toFixed(2)} vs médiane)`;
              }
              return `${ds} — ${titre} : ${val}/5`;
            }
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          min: -0.5,
          max: resultats.length - 0.5,
          ticks: {
            stepSize: 1,
            color: mutedClr,
            maxRotation: 0,
            callback: val => {
              const i = Math.round(val);
              return Math.abs(val - i) < 0.01 ? labels[i] : null;
            }
          },
          grid: { color: borderClr }
        },
        y: {
          min: 0.5,
          max: 5.5,
          ticks: { stepSize: 1, color: mutedClr },
          grid: { color: borderClr },
          title: { display: true, text: "Note /5", color: mutedClr, font: { size: 11 } }
        }
      }
    }
  });
}

// ── Onglet Influence membres ──────────────────────────────────────

function renderTabInfluence() {
  const el = document.getElementById("tab-influence");
  const resultats = lastVote.resultats || [];
  const votants = getVotants(resultats);

  // Pour chaque votant : somme des deltas (moyenne avec - moyenne sans) sur tous les livres
  const statsVotants = votants.map(v => {
    let hausse = 0, baisse = 0;

    resultats.forEach(r => {
      const notes = r.notes || {};
      if (notes[v.id] === undefined) return;

      const notesAll     = Object.values(notes).map(Number).filter(n => !isNaN(n));
      const notesSans    = Object.entries(notes)
        .filter(([id]) => id !== v.id)
        .map(([, n]) => Number(n)).filter(n => !isNaN(n));
      if (!notesSans.length) return;

      const delta = mean(notesAll) - mean(notesSans); // positif = il a fait monter
      if (delta > 0.0001) hausse += delta;
      else if (delta < -0.0001) baisse += delta;
    });

    const net    = hausse + baisse;
    const absolu = hausse + Math.abs(baisse);
    return { ...v, hausse, baisse, net, absolu };
  }).sort((a, b) => b.absolu - a.absolu);

  const maxAbsolu = Math.max(...statsVotants.map(v => v.absolu), 0.001);
  const maxAbsNet = Math.max(...statsVotants.map(v => Math.abs(v.net)), 0.001);

  const rows = statsVotants.map((v, i) => {
    const netBarPct = Math.round(Math.abs(v.net) / maxAbsNet * 100);
    const netColor  = v.net > 0.005 ? "var(--green,#4ab870)" : v.net < -0.005 ? "#e05555" : "var(--border)";
    const netSign   = v.net > 0.005 ? "+" : "";
    return `<tr>
      <td class="cht-infl-rank">${i + 1}</td>
      <td class="cht-infl-nom">${prenom(v.nom)}</td>
      <td class="cht-infl-hausse">+${v.hausse.toFixed(3)}</td>
      <td class="cht-infl-baisse">${v.baisse.toFixed(3)}</td>
      <td class="cht-infl-absolu">
        <span class="cht-infl-absolu-val">${v.absolu.toFixed(3)}</span>
      </td>
      <td class="cht-infl-net">
        <div style="font-size:.75rem;font-weight:700;color:${netColor};margin-bottom:.2rem">${netSign}${v.net.toFixed(3)}</div>
        <div class="cht-infl-bar"><div style="width:${netBarPct}%;height:100%;background:${netColor};border-radius:3px;opacity:.7"></div></div>
      </td>
    </tr>`;
  }).join("");

  // État de tri
  let sortCol = "absolu", sortAsc = false;

  const COLS = [
    { key: "nom",    label: "Membre",           cls: "cht-infl-nom",    extraStyle: "" },
    { key: "hausse", label: "↑ Hausse",          cls: "cht-infl-hausse", extraStyle: "color:var(--green,#4ab870)" },
    { key: "baisse", label: "↓ Baisse",          cls: "cht-infl-baisse", extraStyle: "color:#e05555" },
    { key: "absolu", label: "Influence totale",  cls: "cht-infl-absolu", extraStyle: "" },
    { key: "net",    label: "Δ Net",             cls: "cht-infl-net",    extraStyle: "" },
  ];

  function buildRows(data) {
    return data.map((v, i) => {
      const netBarPct = Math.round(Math.abs(v.net) / maxAbsNet * 100);
      const netColor  = v.net > 0.005 ? "var(--green,#4ab870)" : v.net < -0.005 ? "#e05555" : "var(--border)";
      const netSign   = v.net > 0.005 ? "+" : "";
      return `<tr>
        <td class="cht-infl-rank">${i + 1}</td>
        <td class="cht-infl-nom">${prenom(v.nom)}</td>
        <td class="cht-infl-hausse">+${v.hausse.toFixed(3)}</td>
        <td class="cht-infl-baisse">${v.baisse.toFixed(3)}</td>
        <td class="cht-infl-absolu"><span class="cht-infl-absolu-val">${v.absolu.toFixed(3)}</span></td>
        <td class="cht-infl-net">
          <div style="font-size:.75rem;font-weight:700;color:${netColor};margin-bottom:.2rem">${netSign}${v.net.toFixed(3)}</div>
          <div class="cht-infl-bar"><div style="width:${netBarPct}%;height:100%;background:${netColor};border-radius:3px;opacity:.7"></div></div>
        </td>
      </tr>`;
    }).join("");
  }

  function getSorted() {
    return [...statsVotants].sort((a, b) => {
      const va = sortCol === "nom" ? a.nom : a[sortCol];
      const vb = sortCol === "nom" ? b.nom : b[sortCol];
      if (sortCol === "nom") return sortAsc ? va.localeCompare(vb, "fr") : vb.localeCompare(va, "fr");
      return sortAsc ? va - vb : vb - va;
    });
  }

  function refreshTable() {
    document.getElementById("infl-tbody").innerHTML = buildRows(getSorted());
    document.querySelectorAll(".cht-infl-th").forEach(th => {
      const isActive = th.dataset.col === sortCol;
      th.classList.toggle("cht-th-active", isActive);
      const arrow = th.querySelector(".cht-sort-arrow");
      if (arrow) arrow.textContent = isActive ? (sortAsc ? " ↑" : " ↓") : " ↕";
    });
  }

  const theadCells = COLS.map(c => `
    <th class="cht-infl-th ${c.cls}" data-col="${c.key}" style="${c.extraStyle};cursor:pointer;user-select:none" title="Trier par ${c.label}">
      ${c.label}<span class="cht-sort-arrow">${c.key === sortCol ? (sortAsc ? " ↑" : " ↓") : " ↕"}</span>
    </th>`).join("");

  el.innerHTML = `
    <div class="cht-section-label">Influence de chaque votant sur les moyennes — vote de ${formatMois(lastVote.mois, lastVote.annee)}</div>
    <div class="cht-expl">
      Pour chaque membre, on compare la moyenne de chaque livre <strong>avec</strong> et <strong>sans</strong> son vote, puis on cumule les différences sur tous les livres.
      <strong class="cht-green">↑ Hausse</strong> = somme des livres qu'il a fait monter ·
      <strong class="cht-red">↓ Baisse</strong> = somme des livres qu'il a fait baisser ·
      <strong>Influence totale</strong> = |hausse| + |baisse| ·
      <strong>Δ Net</strong> = hausse + baisse (signé) · <em>Cliquez sur un en-tête pour trier.</em>
    </div>
    <div style="overflow-x:auto">
      <table class="cht-table">
        <thead><tr>
          <th class="cht-infl-rank">#</th>
          ${theadCells}
        </tr></thead>
        <tbody id="infl-tbody">${buildRows(getSorted())}</tbody>
      </table>
    </div>
    <div class="cht-footnote">
      Δ Net = hausse + baisse · Influence totale = |hausse| + |baisse| ·
      Un delta net très négatif = tend à baisser les scores · Un delta net proche de zéro avec une influence totale élevée = tire dans les deux sens (vote stratégique)
    </div>`;

  el.querySelectorAll(".cht-infl-th").forEach(th => {
    th.addEventListener("click", () => {
      if (sortCol === th.dataset.col) {
        sortAsc = !sortAsc;
      } else {
        sortCol = th.dataset.col;
        sortAsc = sortCol === "nom";
      }
      refreshTable();
    });
  });
}

// ── Onglet 1 : Médiane ────────────────────────────────────────────

function renderTabMediane() {
  const el = document.getElementById("tab-mediane");
  const resultats = lastVote.resultats || [];

  const data = resultats.map(r => {
    const notes = Object.values(r.notes || {}).map(Number).filter(n => !isNaN(n));
    return {
      ...r,
      moy:  r.moyenne ?? mean(notes),
      med:  median(notes),
      nbNotes: notes.length,
    };
  });

  const maxMoy = Math.max(...data.map(r => r.moy ?? -Infinity));
  const withMed = data.filter(r => r.med !== null);
  const maxMed = withMed.length ? Math.max(...withMed.map(r => r.med)) : -Infinity;

  // Égalité par médiane ?
  const topMed = withMed.filter(r => r.med === maxMed);
  const tieMed = topMed.length > 1;

  // Qui gagne ?
  const eluActuel = lastVote.livre_elu;
  const eluMediane = !tieMed && topMed[0]?.livre_id;

  let alerte;
  if (tieMed) {
    alerte = { type: "warn", msg: `⚖️ La médiane produit une <strong>égalité</strong> entre ${topMed.length} livres (${topMed.map(r => `"${r.titre}"`).join(", ")}) — un 2ème tour serait nécessaire.` };
  } else if (eluMediane && eluMediane !== eluActuel) {
    const nomNouveau = data.find(r => r.livre_id === eluMediane)?.titre ?? "?";
    const nomAncien  = data.find(r => r.livre_id === eluActuel)?.titre ?? "?";
    alerte = { type: "change", msg: `🔄 Le résultat <strong>changerait</strong> : au lieu de "${nomAncien}", c'est "<strong>${nomNouveau}</strong>" qui serait élu.` };
  } else {
    alerte = { type: "ok", msg: `✅ La médiane <strong>ne change pas</strong> le résultat — le même livre serait élu.` };
  }

  const sorted = [...data].sort((a, b) => (b.med ?? -1) - (a.med ?? -1));

  const rows = sorted.map(r => {
    const resActuel = getResultat(r.moy, maxMoy, false);
    const resMed    = getResultat(r.med, maxMed, tieMed);
    const changed   = resActuel.cls !== resMed.cls;
    return `<tr class="${changed ? "cht-row-changed" : ""}">
      <td class="cht-td-titre">${r.titre}<div class="cht-td-sous">${r.auteur || ""} · ${r.nbNotes} note${r.nbNotes > 1 ? "s" : ""}</div></td>
      <td class="cht-td-score" style="background:${scoreBg(r.moy)}">${r.moy !== null ? r.moy.toFixed(2) : "—"}</td>
      <td class="cht-td-score" style="background:${scoreBg(r.med)}">${r.med !== null ? r.med.toFixed(1) : "—"}</td>
      <td class="cht-td-badge"><span class="${resActuel.cls}">${resActuel.text}</span></td>
      <td class="cht-td-badge"><span class="${resMed.cls}">${resMed.text}</span>${changed ? ' <span class="cht-diff">≠</span>' : ""}</td>
    </tr>`;
  }).join("");

  el.innerHTML = `
    <div class="cht-alert cht-alert-${alerte.type}">${alerte.msg}</div>
    <div class="cht-section-label">Moyenne vs Médiane — vote de ${formatMois(lastVote.mois, lastVote.annee)}</div>
    <div class="cht-expl">La <strong>médiane</strong> classe les notes dans l'ordre et prend celle du milieu. Contrairement à la moyenne, une seule note très basse (ou très haute) ne peut pas à elle seule faire basculer le résultat — elle doit être partagée par au moins la moitié des votants pour avoir un effet. Les lignes surlignées indiquent un changement de résultat.</div>
    <div style="overflow-x:auto">
      <table class="cht-table">
        <thead><tr>
          <th class="cht-td-titre">Livre</th>
          <th class="cht-td-score">Moy. actuelle</th>
          <th class="cht-td-score">Médiane</th>
          <th class="cht-td-badge">Résultat actuel</th>
          <th class="cht-td-badge">Si médiane</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="cht-footnote">Seuil d'élimination : moyenne ou médiane ≤ 2,5. Trié par médiane décroissante.</div>`;
}

// ── Onglet 2 : Simulation ─────────────────────────────────────────

function renderTabSimulation() {
  const el = document.getElementById("tab-simulation");
  const resultats = lastVote.resultats || [];
  const votants = getVotants(resultats);

  const checkboxes = votants.map(v => `
    <label class="cht-voter-check">
      <input type="checkbox" class="sim-voter" value="${v.id}" checked>
      <span>${prenom(v.nom)}</span>
    </label>`).join("");

  el.innerHTML = `
    <div class="cht-section-label">Membres inclus dans le calcul</div>
    <div class="cht-expl">Décochez un votant pour voir les résultats <strong>comme s'il n'avait pas voté</strong>. Utile pour mesurer l'impact d'un vote potentiellement stratégique sur le résultat final. Le système de calcul reste la <strong>moyenne</strong>.</div>
    <div class="cht-voter-grid" id="sim-voter-grid">${checkboxes}</div>
    <div id="sim-result" style="margin-top:1.5rem"></div>`;

  function update() {
    const checked = [...document.querySelectorAll(".sim-voter:checked")].map(el => el.value);
    renderSimResult(resultats, checked, votants.length);
  }

  document.querySelectorAll(".sim-voter").forEach(cb => cb.addEventListener("change", update));
  update();
}

function renderSimResult(resultats, includedIds, totalVotants) {
  const el = document.getElementById("sim-result");

  if (!includedIds.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem;padding:.5rem 0">Sélectionnez au moins un votant.</div>`;
    return;
  }

  const data = resultats.map(r => {
    const notesOrig  = Object.values(r.notes || {}).map(Number).filter(n => !isNaN(n));
    const notesSim   = Object.entries(r.notes || {})
      .filter(([id]) => includedIds.includes(id))
      .map(([, n]) => Number(n)).filter(n => !isNaN(n));
    return {
      ...r,
      moy_orig: r.moyenne ?? mean(notesOrig),
      moy_sim:  mean(notesSim),
    };
  });

  const withSim  = data.filter(r => r.moy_sim !== null);
  const withOrig = data.filter(r => r.moy_orig !== null);
  if (!withSim.length) { el.innerHTML = `<div style="color:var(--muted)">Aucune donnée pour ces votants.</div>`; return; }

  const maxSim  = Math.max(...withSim.map(r => r.moy_sim));
  const maxOrig = Math.max(...withOrig.map(r => r.moy_orig));

  const topSim = withSim.filter(r => r.moy_sim === maxSim);
  const tieSim = topSim.length > 1;

  const eluSim  = !tieSim ? topSim[0]?.livre_id : null;
  const eluOrig = lastVote.livre_elu;

  let alerte;
  if (tieSim) {
    alerte = { type: "warn", msg: `⚖️ Égalité entre ${topSim.length} livres avec ces ${includedIds.length} votants — un 2ème tour serait nécessaire.` };
  } else if (eluSim && eluSim !== eluOrig) {
    const nomNouveau = data.find(r => r.livre_id === eluSim)?.titre ?? "?";
    alerte = { type: "change", msg: `🔄 Avec ${includedIds.length}/${totalVotants} votants, le résultat <strong>changerait</strong> : "<strong>${nomNouveau}</strong>" serait élu.` };
  } else {
    alerte = { type: "ok", msg: `✅ Avec ${includedIds.length}/${totalVotants} votants, le même livre serait élu.` };
  }

  const sorted = [...data].sort((a, b) => (b.moy_sim ?? -1) - (a.moy_sim ?? -1));

  const rows = sorted.map(r => {
    const resOrig = getResultat(r.moy_orig, maxOrig, false);
    const resSim  = getResultat(r.moy_sim, maxSim, tieSim);
    const changed = resOrig.cls !== resSim.cls;
    const delta   = r.moy_sim !== null && r.moy_orig !== null ? r.moy_sim - r.moy_orig : null;
    const deltaHtml = delta !== null
      ? `<span class="cht-delta ${delta > 0.005 ? "pos" : delta < -0.005 ? "neg" : ""}">${delta > 0 ? "+" : ""}${delta.toFixed(2)}</span>`
      : "";
    return `<tr class="${changed ? "cht-row-changed" : ""}">
      <td class="cht-td-titre">${r.titre}</td>
      <td class="cht-td-score" style="background:${scoreBg(r.moy_orig)}">${r.moy_orig !== null ? r.moy_orig.toFixed(2) : "—"}</td>
      <td class="cht-td-score" style="background:${scoreBg(r.moy_sim)}">${r.moy_sim !== null ? r.moy_sim.toFixed(2) : "—"} ${deltaHtml}</td>
      <td class="cht-td-badge"><span class="${resOrig.cls}">${resOrig.text}</span></td>
      <td class="cht-td-badge"><span class="${resSim.cls}">${resSim.text}</span>${changed ? ' <span class="cht-diff">≠</span>' : ""}</td>
    </tr>`;
  }).join("");

  el.innerHTML = `
    <div class="cht-alert cht-alert-${alerte.type}">${alerte.msg}</div>
    <div style="overflow-x:auto">
      <table class="cht-table">
        <thead><tr>
          <th class="cht-td-titre">Livre</th>
          <th class="cht-td-score">Moy. originale</th>
          <th class="cht-td-score">Moy. simulée</th>
          <th class="cht-td-badge">Résultat original</th>
          <th class="cht-td-badge">Résultat simulé</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="cht-footnote">${includedIds.length} / ${totalVotants} votants · delta = différence entre moy. simulée et originale · Seuil : ≤ 2,5</div>`;
}

// ── Onglet 3 : Impact votants ─────────────────────────────────────

function renderTabImpact() {
  const el = document.getElementById("tab-impact");
  const resultats = lastVote.resultats || [];
  const votants = getVotants(resultats);

  // Pour chaque votant × livre : impact = sa note - moyenne des autres
  const impacts = {};
  votants.forEach(v => { impacts[v.id] = {}; });

  resultats.forEach(r => {
    const notes = r.notes || {};
    votants.forEach(v => {
      const myNote = notes[v.id] !== undefined ? Number(notes[v.id]) : null;
      if (myNote === null) { impacts[v.id][r.livre_id] = null; return; }
      const othersNotes = Object.entries(notes)
        .filter(([id]) => id !== v.id)
        .map(([, n]) => Number(n)).filter(n => !isNaN(n));
      const othersMean = mean(othersNotes);
      impacts[v.id][r.livre_id] = othersMean !== null ? myNote - othersMean : null;
    });
  });

  // Impact absolu moyen par votant (combien il dévie du groupe en moyenne)
  const statsVotants = votants.map(v => {
    const vals = Object.values(impacts[v.id]).filter(x => x !== null);
    const valsAbs = vals.map(Math.abs);
    return {
      ...v,
      absImpact: valsAbs.length ? mean(valsAbs) : null,
      rawImpact: vals.length ? mean(vals) : null,
    };
  }).sort((a, b) => (b.absImpact ?? -1) - (a.absImpact ?? -1));

  const maxAbs = Math.max(...statsVotants.map(v => v.absImpact ?? 0), 0.001);

  // Couleur d'une cellule impact
  function impBg(val) {
    if (val === null) return "";
    const intensity = Math.min(1, Math.abs(val) / 2.5);
    if (val > 0.12) return `rgba(75,185,80,${0.08 + intensity * 0.32})`;
    if (val < -0.12) return `rgba(210,55,55,${0.08 + intensity * 0.32})`;
    return "";
  }

  const bookHeaders = resultats.map(r =>
    `<th class="cht-impact-book" title="${r.titre}${r.auteur ? " — " + r.auteur : ""}">${r.titre.length > 18 ? r.titre.slice(0, 16) + "…" : r.titre}</th>`
  ).join("");

  const rows = statsVotants.map(v => {
    const isHighImpact = v.absImpact !== null && (v.absImpact / maxAbs) >= 0.6;
    const barWidth = v.absImpact !== null ? Math.round(v.absImpact / maxAbs * 100) : 0;

    const bookCells = resultats.map(r => {
      const val    = impacts[v.id][r.livre_id];
      const myNote = r.notes?.[v.id] !== undefined ? Number(r.notes[v.id]) : null;
      if (val === null && myNote === null) return `<td class="cht-impact-cell cht-impact-absent">—</td>`;
      const valStr = val !== null ? `${val > 0 ? "+" : ""}${val.toFixed(2)}` : "—";
      const noteStr = myNote !== null ? myNote : "—";
      return `<td class="cht-impact-cell" style="background:${impBg(val)}">
        <div class="cht-impact-val ${val > 0.12 ? "pos" : val < -0.12 ? "neg" : ""}">${valStr}</div>
        <div class="cht-impact-note">(${noteStr})</div>
      </td>`;
    }).join("");

    const rawStr = v.rawImpact !== null ? `${v.rawImpact > 0 ? "+" : ""}${v.rawImpact.toFixed(2)}` : "—";

    return `<tr>
      <td class="cht-impact-voter">
        ${isHighImpact ? '<span class="cht-impact-flag" title="Impact élevé">⚡</span> ' : ""}${prenom(v.nom)}
      </td>
      ${bookCells}
      <td class="cht-impact-abs">
        <div class="cht-impact-abs-val">${v.absImpact !== null ? v.absImpact.toFixed(2) : "—"}</div>
        <div class="cht-impact-abs-bar"><div style="width:${barWidth}%;height:100%;background:var(--accent);border-radius:3px;opacity:.6"></div></div>
        <div class="cht-impact-abs-raw">${rawStr} brut</div>
      </td>
    </tr>`;
  }).join("");

  el.innerHTML = `
    <div class="cht-section-label">Impact de chaque votant sur la moyenne des livres</div>
    <div class="cht-expl">
      Chaque cellule montre <strong>la note donnée</strong> (entre parenthèses) et l'<strong>écart à la moyenne des autres votants</strong> pour ce livre.
      <span class="cht-green">Vert = a fait monter la moyenne du groupe</span> · <span class="cht-red">Rouge = a fait baisser</span>.
      La colonne <strong>Impact ±</strong> est l'écart absolu moyen du votant par rapport au groupe sur tous les livres — un score élevé signale quelqu'un qui se démarque fortement. L'impact "brut" (signé) indique s'il tend à sur-noter ou sous-noter globalement.
    </div>
    <div style="overflow-x:auto">
      <table class="cht-table">
        <thead><tr>
          <th class="cht-impact-voter">Votant</th>
          ${bookHeaders}
          <th class="cht-impact-abs">Impact ±</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="cht-footnote">⚡ = parmi les impacts les plus élevés · Trié par impact absolu décroissant · Cellule absente si la personne n'a pas noté ce livre</div>`;
}

init().catch(console.error);
