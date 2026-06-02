import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMembres, getVotes } from "./db.js";
import { formatMois } from "./utils.js";

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
