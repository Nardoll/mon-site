import { requireAuth }          from "./auth.js";
import { initNav }              from "./nav.js";
import {
  getMembres, getLivres, getVotes, getReunions,
  getAllStatutsLecture, getAllCommentaires,
} from "./db.js";

// ── Auth (top-level await) ────────────────────────────────────────────
await requireAuth();

// ── Helpers globaux (window.SX depuis stats-helpers.js) ──────────────
// memberColor(nom)  — prend le NOM du membre, pas l'id Firebase
// heatColor(v, lo, hi, mid)
// chipColor(v, lo, hi)   — 3 params, pas de booléen
// lineChart(hostEl, { series:[{name,color,values}], xLabels, yMax, yStep })  — modifie host.innerHTML
// legend(items)          — items = [{name, color}]
// esc(x)
const { memberColor, heatColor, chipColor, lineChart, legend, esc } = window.SX;

// Helper : couleur par membre à partir d'un objet membre
const mColor = m => memberColor(m.nom);

function toTs(d) {
  if (!d) return 0;
  return (typeof d.toDate === "function" ? d.toDate() : new Date(d)).getTime();
}

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

function fmtFr(n, dec = 1) {
  if (!isFinite(n) || n === null || n === undefined) return "—";
  return Number(n).toFixed(dec).replace(".", ",");
}

function avg(arr) {
  if (!arr || !arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function pearson(a, b) {
  if (!a || !b || a.length !== b.length || a.length < 3) return null;
  const ma = avg(a), mb = avg(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const dx = a[i] - ma, dy = b[i] - mb;
    num += dx * dy; da += dx * dx; db += dy * dy;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

/**
 * Membres ayant terminé un livre — ROBUSTE avec retrocompat lecteurs_ids / notes_finales.
 * Valeur Firestore : statut === "termine" (SANS accent — cf. utils.js STATUTS_LECTURE).
 */
function membersWhoFinishedBook(livreId, allStatuts, reusForLivre) {
  const set = new Set();
  // 1. Statuts explicites "termine" (pas d'accent)
  allStatuts
    .filter(s => s.livre_id === livreId && s.statut === "termine")
    .forEach(s => set.add(s.membre_id));
  // 2. Réunions
  (reusForLivre || []).filter(r => r.livre_id === livreId).forEach(r => {
    if (r.lecteurs_ids != null) {
      (r.lecteurs_ids || []).forEach(id => set.add(id));
    } else {
      // Retrocompat : anciennes réunions sans lecteurs_ids → notes_finales > 0
      Object.entries(r.notes_finales || {}).forEach(([id, note]) => {
        if (Number(note) > 0) set.add(id);
      });
    }
  });
  return set;
}

// ════════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════════
async function init() {
  initNav("stats");

  const [membres, livres, votes, reunions, statuts, commentaires] = await Promise.all([
    getMembres(),
    getLivres(),
    getVotes(),
    getReunions(),
    getAllStatutsLecture(),
    getAllCommentaires(),
  ]);

  // ── Index rapides ────────────────────────────────────────────────
  const membreById = Object.fromEntries(membres.map(m => [m.id, m]));
  const livreById  = Object.fromEntries(livres.map(l => [l.id, l]));

  // ── Séances passées triées chronologiquement ────────────────────
  const passees = reunions
    .filter(r => isPasse(r))
    .sort((a, b) => toTs(a.date) - toTs(b.date));

  // ── Votes triés chronologiquement ──────────────────────────────
  const votesChron = [...votes].sort((a, b) => toTs(a.date) - toTs(b.date));

  // ── Sous-titre page ─────────────────────────────────────────────
  const nbElus = livres.filter(l => l.statut === "elu").length;
  document.getElementById("stats-sub").textContent =
    `${nbElus} livre${nbElus !== 1 ? "s" : ""} lu${nbElus !== 1 ? "s" : ""} · ` +
    `${passees.length} réunion${passees.length !== 1 ? "s" : ""} · ` +
    `${membres.length} membre${membres.length !== 1 ? "s" : ""}`;

  // ── Panels ──────────────────────────────────────────────────────
  renderKPIs({ livres, statuts, reunions, passees });
  renderHistNotes10({ passees, membres });
  renderHistNotes5({ votes: votesChron, membres });
  renderParticipation({ votes: votesChron, membres });
  renderColsLecteurs({ passees, statuts });
  renderPlotNotes({ passees, membreById });
  renderTblActifs({ membres, livres, votes: votesChron, reunions, statuts, commentaires });
  renderBilanProps({ membres, livres, votes: votesChron, reunions, livreById });
  renderHeatGouts({ membres, livreById, votes: votesChron });
  renderScatterCorrel({ livres, livreById, votes: votesChron, reunions });
  renderHeatSim({ membres, membreById, votes: votesChron });
  renderContrConso({ livreById, votes: votesChron });
  renderDureeVie({ livreById, votes: votesChron });
  renderPropsStack({ membres, livres });
}

// ════════════════════════════════════════════════════════════════════
// 1. KPIs — corrigé : "termine" (sans accent) + membersWhoFinishedBook
// ════════════════════════════════════════════════════════════════════
function renderKPIs({ livres, statuts, reunions, passees }) {
  const livresElus = livres.filter(l => l.statut === "elu");
  const elusPassesIds = new Set(passees.map(r => r.livre_id).filter(Boolean));

  // Livres cumulés lus = livres élus ayant eu une réunion passée
  const nbLivresLus = livresElus.filter(l => elusPassesIds.has(l.id)).length;

  // Lectures cumulées (Σ membres ayant terminé) + pages cumulées
  let lecturesCum = 0, pagesCum = 0;
  livresElus.forEach(l => {
    if (!elusPassesIds.has(l.id)) return;
    const reusLivre = reunions.filter(r => r.livre_id === l.id);
    const finishers = membersWhoFinishedBook(l.id, statuts, reusLivre);
    lecturesCum += finishers.size;
    pagesCum    += finishers.size * (Number(l.nb_pages) || 0);
  });

  // Note moyenne générale /10
  const allNotes10 = [];
  passees.forEach(r => {
    Object.values(r.notes_finales || {}).forEach(n => {
      const v = Number(n);
      if (v > 0) allNotes10.push(v);
    });
  });
  const noteMoy = avg(allNotes10);

  const kpis = [
    { num: nbLivresLus, label: "Livres lus", sub: "depuis le début" },
    { num: lecturesCum, label: "Lectures cumulées", sub: "total membre × livre" },
    { num: pagesCum > 0 ? pagesCum.toLocaleString("fr-FR") : "0", label: "Pages lues", sub: "cumulées membres" },
    { num: noteMoy !== null ? fmtFr(noteMoy) + "/10" : "—", label: "Note moyenne", sub: `sur ${allNotes10.length} note${allNotes10.length !== 1 ? "s" : ""}` },
  ];

  document.getElementById("kpis-root").innerHTML = kpis.map(k => `
    <div class="sx-kpi">
      <div class="sx-kpi-num">${k.num}</div>
      <div class="sx-kpi-label">${k.label}</div>
      <div class="sx-kpi-sub">${k.sub}</div>
    </div>`).join("");
}

// ════════════════════════════════════════════════════════════════════
// Helper : rendu histogramme barres horizontales (Archétype 2)
// ════════════════════════════════════════════════════════════════════
function renderHistBars(avgEl, barsEl, notes, scale) {
  if (!notes.length) {
    avgEl.innerHTML = "";
    barsEl.innerHTML = `<p class="sx-note">Aucune note pour ce membre.</p>`;
    return;
  }
  const m = avg(notes);
  const counts = Array(scale).fill(0);
  notes.forEach(n => {
    const idx = Math.min(scale - 1, Math.max(0, Math.round(Number(n)) - 1));
    counts[idx]++;
  });
  const maxC    = Math.max(...counts);
  const bestIdx = counts.indexOf(maxC);

  avgEl.innerHTML = `<div class="sx-note-big">${fmtFr(m)}<span> /${scale} · ${notes.length} note${notes.length > 1 ? "s" : ""}</span></div>`;
  barsEl.innerHTML = counts.map((c, i) => {
    const pct = maxC ? Math.max(c / maxC * 100, c > 0 ? 8 : 0) : 0;
    const cls = i === bestIdx && c > 0 ? "best" : "";
    return `<div class="sx-bar-row">
      <span class="sx-bar-lab">${i + 1}</span>
      <div class="sx-bar-track"><div class="sx-bar-fill ${cls}" style="width:${pct.toFixed(1)}%">${c > 0 ? c : ""}</div></div>
      <span class="sx-bar-val">${c}</span>
    </div>`;
  }).join("");
}

// ════════════════════════════════════════════════════════════════════
// 2. Histogramme notes /10 avec sélecteur membre
// ════════════════════════════════════════════════════════════════════
function renderHistNotes10({ passees, membres }) {
  const allNotes = [];
  const byMembre = {};

  passees.forEach(r => {
    Object.entries(r.notes_finales || {}).forEach(([memId, note]) => {
      const v = Number(note);
      if (v > 0) {
        allNotes.push(v);
        if (!byMembre[memId]) byMembre[memId] = [];
        byMembre[memId].push(v);
      }
    });
  });

  const sel    = document.getElementById("hist10-sel");
  const avgEl  = document.getElementById("hist10-avg");
  const barsEl = document.getElementById("hist10-bars");

  if (!allNotes.length) {
    avgEl.innerHTML  = "";
    barsEl.innerHTML = `<p class="sx-note">Aucune note enregistrée pour l'instant.</p>`;
    return;
  }

  membres.filter(m => (byMembre[m.id] || []).length > 0).forEach(m => {
    const opt = document.createElement("option");
    opt.value       = m.id;
    opt.textContent = m.nom;
    sel.appendChild(opt);
  });

  renderHistBars(avgEl, barsEl, allNotes, 10);
  sel.addEventListener("change", () => {
    const notes = sel.value === "all" ? allNotes : (byMembre[sel.value] || []);
    renderHistBars(avgEl, barsEl, notes, 10);
  });
}

// ════════════════════════════════════════════════════════════════════
// 3. Histogramme notes de vote /5 avec sélecteur membre
// ════════════════════════════════════════════════════════════════════
function renderHistNotes5({ votes, membres }) {
  const allNotes = [];
  const byMembre = {};

  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      Object.entries(r.notes || {}).forEach(([memId, note]) => {
        const val = Number(note);
        if (val > 0) {
          allNotes.push(val);
          if (!byMembre[memId]) byMembre[memId] = [];
          byMembre[memId].push(val);
        }
      });
    });
  });

  const sel    = document.getElementById("hist5-sel");
  const avgEl  = document.getElementById("hist5-avg");
  const barsEl = document.getElementById("hist5-bars");

  if (!allNotes.length) {
    avgEl.innerHTML  = "";
    barsEl.innerHTML = `<p class="sx-note">Aucune note de vote enregistrée pour l'instant.</p>`;
    return;
  }

  membres.filter(m => (byMembre[m.id] || []).length > 0).forEach(m => {
    const opt = document.createElement("option");
    opt.value       = m.id;
    opt.textContent = m.nom;
    sel.appendChild(opt);
  });

  renderHistBars(avgEl, barsEl, allNotes, 5);
  sel.addEventListener("change", () => {
    const notes = sel.value === "all" ? allNotes : (byMembre[sel.value] || []);
    renderHistBars(avgEl, barsEl, notes, 5);
  });
}

// ════════════════════════════════════════════════════════════════════
// 4. Participation aux votes (barres horizontales Archétype 2)
// ════════════════════════════════════════════════════════════════════
function renderParticipation({ votes, membres }) {
  const host = document.getElementById("participation-content");
  if (!votes.length || !membres.length) {
    host.innerHTML = `<p class="sx-note">Aucune session de vote enregistrée.</p>`;
    return;
  }

  const totalVotes = votes.length;
  const data = membres.map(m => {
    const cnt = votes.filter(v =>
      (v.resultats || []).some(r => r.notes && r.notes[m.id] !== undefined)
    ).length;
    return { nom: m.nom, cnt, pct: totalVotes ? cnt / totalVotes : 0 };
  }).filter(d => d.cnt > 0).sort((a, b) => b.pct - a.pct);

  if (!data.length) {
    host.innerHTML = `<p class="sx-note">Aucune participation enregistrée.</p>`;
    return;
  }

  const avgPct = avg(data.map(d => d.pct)) * 100;

  host.innerHTML = `
    <p class="sx-taux">Taux moyen : <strong>${fmtFr(avgPct, 0)} %</strong> · ${totalVotes} session${totalVotes !== 1 ? "s" : ""} de vote</p>
    <div class="sx-bars" style="--lab:140px">
      ${data.map(d => `<div class="sx-bar-row">
        <span class="sx-bar-lab" style="font-size:.82rem">${esc(d.nom)}</span>
        <div class="sx-bar-track"><div class="sx-bar-fill" style="width:${Math.max(d.pct * 100, d.cnt > 0 ? 6 : 0).toFixed(1)}%"></div></div>
        <span class="sx-bar-val">${d.cnt}/${totalVotes} <span style="color:var(--muted);font-size:.8em">(${fmtFr(d.pct * 100, 0)} %)</span></span>
      </div>`).join("")}
    </div>`;
}

// ════════════════════════════════════════════════════════════════════
// 5. Colonnes lecteurs par séance (Archétype 3)
// ════════════════════════════════════════════════════════════════════
function renderColsLecteurs({ passees, statuts }) {
  const host = document.getElementById("cols-lecteurs");
  if (!passees.length) {
    host.innerHTML = `<p class="sx-note">Aucune séance enregistrée.</p>`;
    return;
  }

  const counts = passees.map(r =>
    membersWhoFinishedBook(r.livre_id, statuts, [r]).size
  );
  const maxVal = Math.max(1, ...counts);

  host.innerHTML = passees.map((r, i) => {
    const val = counts[i];
    const d   = r.date
      ? (typeof r.date.toDate === "function" ? r.date.toDate() : new Date(r.date))
      : null;
    const lab = d
      ? d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
      : "?";
    const h = Math.max(val / maxVal * 100, val > 0 ? 10 : 2).toFixed(1);
    return `<div class="sx-col">
      <div class="sx-col-bars" style="height:${h}%">
        <div class="sx-col-seg" style="height:100%;background:var(--accent)"></div>
      </div>
      <div class="sx-col-v">${val}</div>
      <div class="sx-col-lab">${lab}</div>
    </div>`;
  }).join("");
}

// ════════════════════════════════════════════════════════════════════
// 6. Courbe évolution des notes (Archétype 4) — légende cliquable
//    SVG custom avec <g data-sid> par série pour le toggle
// ════════════════════════════════════════════════════════════════════
function renderPlotNotes({ passees, membreById }) {
  const plotEl   = document.getElementById("plot-notes");
  const legendEl = document.getElementById("plot-notes-legend");

  if (!passees.length) {
    plotEl.innerHTML = `<p class="sx-note">Aucune donnée.</p>`;
    return;
  }

  const memIds = [...new Set(passees.flatMap(r => Object.keys(r.notes_finales || {})))];

  const series = memIds.map(id => {
    const nom = membreById[id]?.nom ?? id;
    return {
      id,
      nom,
      color:  memberColor(nom),
      values: passees.map(r => {
        const n = Number((r.notes_finales || {})[id]);
        return isFinite(n) && n > 0 ? n : null;
      }),
    };
  });

  const xLabels = passees.map(r => {
    const d = r.date
      ? (typeof r.date.toDate === "function" ? r.date.toDate() : new Date(r.date))
      : null;
    return d ? d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) : "?";
  });

  // ── SVG custom (reproduit SX.lineChart mais avec <g data-sid> par série) ──
  const yMax = 10, yStep = 2, H = 300, W = 920;
  const pL = 34, pR = 14, pT = 14, pB = 36;
  const iw = W - pL - pR, ih = H - pT - pB;
  const n  = xLabels.length;
  const Xf = i => pL + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const Yf = v => pT + ih - (v / yMax) * ih;

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" style="width:100%;height:auto;display:block">`;

  // Grille
  for (let g = 0; g <= yMax; g += yStep) {
    const yy = Yf(g).toFixed(1);
    svg += `<line x1="${pL}" y1="${yy}" x2="${W - pR}" y2="${yy}" class="sx-grid-line"/>`;
    svg += `<text x="${pL - 6}" y="${(Number(yy) + 3.5).toFixed(1)}" class="sx-axis-lab sx-ylab">${g}</text>`;
  }
  xLabels.forEach((lb, i) => {
    const xx = Xf(i).toFixed(1);
    svg += `<line x1="${xx}" y1="${pT}" x2="${xx}" y2="${pT + ih}" class="sx-grid-line minor"/>`;
    svg += `<text x="${xx}" y="${H - 12}" class="sx-axis-lab sx-xlab">${esc(lb)}</text>`;
  });

  // Séries — chacune dans un <g data-sid="...">
  series.forEach(se => {
    svg += `<g class="sx-series-group" data-sid="${se.id}" style="transition:opacity .2s">`;
    let seg = [];
    const flush = () => {
      if (seg.length > 1) svg += `<polyline points="${seg.join(" ")}" stroke="${se.color}" class="sx-line"/>`;
      seg = [];
    };
    se.values.forEach((v, i) => {
      if (v == null) flush();
      else seg.push(`${Xf(i).toFixed(1)},${Yf(v).toFixed(1)}`);
    });
    flush();
    se.values.forEach((v, i) => {
      if (v != null) svg += `<circle cx="${Xf(i).toFixed(1)}" cy="${Yf(v).toFixed(1)}" r="4" fill="${se.color}"/>`;
    });
    svg += `</g>`;
  });

  svg += `</svg>`;
  plotEl.innerHTML = svg;

  // ── Légende interactive ─────────────────────────────────────────
  const legendHtml = series.map(s =>
    `<span class="sx-legend-item" data-sid="${s.id}">
      <i style="background:${s.color};width:12px;height:12px;border-radius:3px;flex-shrink:0;display:inline-block"></i>
      ${esc(s.nom)}
    </span>`
  ).join("");

  legendEl.innerHTML = `
    <div class="sx-legend" style="gap:.3rem .6rem">${legendHtml}</div>
    <p style="font-size:.72rem;color:var(--muted);margin-top:.4rem;font-style:italic">Cliquer sur un nom pour afficher / masquer</p>`;

  // Toggle : clic sur un item
  legendEl.querySelectorAll(".sx-legend-item").forEach(item => {
    item.addEventListener("click", () => {
      const sid   = item.dataset.sid;
      const group = plotEl.querySelector(`[data-sid="${sid}"]`);
      if (!group) return;
      const dimmed = item.classList.toggle("dim");
      group.style.opacity = dimmed ? ".1" : "1";
    });
  });
}

// ════════════════════════════════════════════════════════════════════
// 7. Table membres les plus actifs (Archétype 6)
// ════════════════════════════════════════════════════════════════════
function renderTblActifs({ membres, livres, votes, reunions, statuts, commentaires }) {
  const tbody = document.getElementById("tbl-actifs");

  const rows = membres.map(m => {
    const livresFinis = livres.filter(l => {
      const reusLivre = reunions.filter(r => r.livre_id === l.id);
      return membersWhoFinishedBook(l.id, statuts, reusLivre).has(m.id);
    }).length;

    const nbReunions = reunions.filter(r => {
      if (!isPasse(r)) return false;
      if (r.lecteurs_ids) return r.lecteurs_ids.includes(m.id);
      return Object.entries(r.notes_finales || {})
        .some(([id, n]) => id === m.id && Number(n) > 0);
    }).length;

    const nbProps = livres.filter(l => l.propose_par === m.id).length;
    const nbVotes = votes.filter(v =>
      (v.resultats || []).some(r => r.notes && r.notes[m.id] !== undefined)
    ).length;
    const nbComms = commentaires.filter(c => c.membre_id === m.id).length;
    const score   = livresFinis * 4 + nbReunions * 3 + nbProps * 2 + nbVotes + nbComms;

    return { m, livresFinis, nbReunions, nbProps, nbVotes, nbComms, score };
  }).sort((a, b) => b.score - a.score);

  tbody.innerHTML = rows.map((row, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "";
    return `<tr>
      <td>${medal} <span style="color:${mColor(row.m)};font-weight:600">${esc(row.m.nom)}</span></td>
      <td>${row.livresFinis}</td>
      <td>${row.nbReunions}</td>
      <td>${row.nbProps}</td>
      <td>${row.nbVotes}</td>
      <td>${row.nbComms}</td>
      <td style="font-weight:700;color:var(--accent)">${row.score}</td>
    </tr>`;
  }).join("");
}

// ════════════════════════════════════════════════════════════════════
// 8. Bilan par membre proposant (table-registre Archétype 6)
// ════════════════════════════════════════════════════════════════════
function renderBilanProps({ membres, livres, votes, reunions, livreById }) {
  const tbody = document.getElementById("tbl-bilan-props");

  const rows = membres.map(m => {
    const mLivres = livres.filter(l => l.propose_par === m.id);
    if (!mLivres.length) return null;
    const mIds     = new Set(mLivres.map(l => l.id));
    const elus     = mLivres.filter(l => l.statut === "elu").length;
    const elimines = mLivres.filter(l => l.statut === "elimine").length;
    const attente  = mLivres.filter(l => l.statut === "propose").length;

    // Note vote reçue = moy des votes d'autrui sur ses livres (hors auto-vote)
    const votePool = [];
    votes.forEach(v => {
      (v.resultats || []).forEach(r => {
        if (!mIds.has(r.livre_id)) return;
        Object.entries(r.notes || {}).forEach(([vid, note]) => {
          if (vid === m.id) return;
          const val = Number(note);
          if (val > 0) votePool.push(val);
        });
      });
    });

    // Note finale reçue = moy des notes_finales sur ses livres lors des réunions
    const finalePool = [];
    reunions.filter(r => isPasse(r) && mIds.has(r.livre_id)).forEach(r => {
      Object.values(r.notes_finales || {}).forEach(note => {
        const val = Number(note);
        if (val > 0) finalePool.push(val);
      });
    });

    return {
      m, total: mLivres.length, elus, elimines, attente,
      noteVote:   avg(votePool),
      noteFinale: avg(finalePool),
    };
  }).filter(Boolean).sort((a, b) => b.total - a.total);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:1.5rem">Aucune proposition enregistrée.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => {
    // Ratio + pourcentage : "3/10 (30%)"
    const ratio = (v) => {
      const p = row.total > 0 ? Math.round(v / row.total * 100) : 0;
      return `${v}/${row.total} <span style="color:var(--muted);font-size:.8em">(${p}&nbsp;%)</span>`;
    };
    return `<tr>
      <td><span style="color:${mColor(row.m)};font-weight:600">${esc(row.m.nom)}</span></td>
      <td style="font-weight:600">${row.total}</td>
      <td class="elu">${ratio(row.elus)}</td>
      <td class="elim">${ratio(row.elimines)}</td>
      <td style="color:var(--muted)">${ratio(row.attente)}</td>
      <td class="note">${row.noteVote   !== null ? fmtFr(row.noteVote)   + "/5"  : "—"}</td>
      <td class="note">${row.noteFinale !== null ? fmtFr(row.noteFinale) + "/10" : "—"}</td>
    </tr>`;
  }).join("");
}

// ════════════════════════════════════════════════════════════════════
// 9. Heatmap matrice des goûts /5 (Archétype 5)
// ════════════════════════════════════════════════════════════════════
function renderHeatGouts({ membres, livreById, votes }) {
  const tbl = document.getElementById("heat-gouts");

  // sumMat[votantId][propId] = { sum, cnt }
  const sumMat = {};
  membres.forEach(a => {
    sumMat[a.id] = {};
    membres.forEach(b => { sumMat[a.id][b.id] = { sum: 0, cnt: 0 }; });
  });

  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      const livre = livreById[r.livre_id];
      if (!livre || !livre.propose_par) return;
      const propId = livre.propose_par;
      Object.entries(r.notes || {}).forEach(([votantId, note]) => {
        const val = Number(note);
        if (val > 0 && sumMat[votantId]?.[propId]) {
          sumMat[votantId][propId].sum += val;
          sumMat[votantId][propId].cnt++;
        }
      });
    });
  });

  const propsMems   = membres.filter(m => membres.some(a => (sumMat[a.id]?.[m.id]?.cnt ?? 0) > 0));
  const votantsMems = membres.filter(m => membres.some(b => (sumMat[m.id]?.[b.id]?.cnt ?? 0) > 0));

  if (!propsMems.length || !votantsMems.length) {
    tbl.innerHTML = `<tr><td class="sx-note">Aucun vote enregistré pour l'instant.</td></tr>`;
    return;
  }

  let html = `<tr><th></th>${propsMems.map(m =>
    `<th style="color:${mColor(m)}">${esc(m.nom)}</th>`
  ).join("")}</tr>`;

  votantsMems.forEach(votant => {
    html += `<tr><th style="color:${mColor(votant)}">${esc(votant.nom)}</th>`;
    propsMems.forEach(prop => {
      const { sum, cnt } = sumMat[votant.id]?.[prop.id] ?? { sum: 0, cnt: 0 };
      if (!cnt) {
        html += `<td style="background:transparent;color:var(--muted)">—</td>`;
        return;
      }
      const val   = sum / cnt;
      const isOwn = votant.id === prop.id;
      const bg    = heatColor(val, 0, 5);
      const style = isOwn
        ? `background:repeating-linear-gradient(45deg,${bg} 0 4px,transparent 4px 8px);box-shadow:inset 0 0 0 1px var(--border)`
        : `background:${bg}`;
      html += `<td style="${style}" title="${esc(votant.nom)} → livres de ${esc(prop.nom)} : ${fmtFr(val)}/5 (${cnt})">${fmtFr(val)}</td>`;
    });
    html += `</tr>`;
  });

  tbl.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════
// 10. Scatter corrélation vote → réunion (SVG inline DA-style)
// ════════════════════════════════════════════════════════════════════
function renderScatterCorrel({ livres, livreById, votes, reunions }) {
  const host = document.getElementById("scatter-correl");

  const points = [];
  livres.filter(l => l.statut === "elu").forEach(livre => {
    // Note vote moy /5
    let vSum = 0, vCnt = 0;
    votes.forEach(v => {
      const res = (v.resultats || []).find(r => r.livre_id === livre.id);
      if (!res) return;
      Object.values(res.notes || {}).forEach(note => {
        const val = Number(note);
        if (val > 0) { vSum += val; vCnt++; }
      });
    });
    if (!vCnt) return;

    // Note finale moy /10
    const reusLivre = reunions.filter(r => isPasse(r) && r.livre_id === livre.id);
    if (!reusLivre.length) return;
    let fSum = 0, fCnt = 0;
    reusLivre.forEach(r => {
      Object.values(r.notes_finales || {}).forEach(note => {
        const val = Number(note);
        if (val > 0) { fSum += val; fCnt++; }
      });
    });
    if (!fCnt) return;

    points.push({ titre: livre.titre, voteMoy: vSum / vCnt, noteFinale: fSum / fCnt });
  });

  if (points.length < 2) {
    host.innerHTML = `<p class="sx-note">Données insuffisantes — il faut au moins 2 livres élus avec note de vote et note finale.</p>`;
    return;
  }

  const W = 900, H = 360;
  const pL = 48, pR = 110, pT = 24, pB = 48;
  const iw = W - pL - pR, ih = H - pT - pB;
  const xs = v => pL + (v / 5) * iw;
  const ys = v => pT + ih - (v / 10) * ih;

  let svg = `<svg viewBox="0 0 ${W} ${H}" class="sx-scatter" role="img" aria-label="Corrélation vote réunion">`;

  // Grille
  for (let g = 0; g <= 10; g += 2) {
    const yy = ys(g).toFixed(1);
    svg += `<line x1="${pL}" y1="${yy}" x2="${W - pR}" y2="${yy}" stroke="var(--border)" stroke-width=".8"/>`;
    svg += `<text x="${pL - 6}" y="${(Number(yy) + 4).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="11" font-family="system-ui">${g}</text>`;
  }
  for (let g = 0; g <= 5; g++) {
    const xx = xs(g).toFixed(1);
    svg += `<line x1="${xx}" y1="${pT}" x2="${xx}" y2="${pT + ih}" stroke="var(--border)" stroke-width=".8"/>`;
    svg += `<text x="${xx}" y="${pT + ih + 16}" text-anchor="middle" fill="var(--muted)" font-size="11" font-family="system-ui">${g}</text>`;
  }

  // Tendance (régression linéaire)
  if (points.length >= 3) {
    const xArr = points.map(p => p.voteMoy);
    const yArr = points.map(p => p.noteFinale);
    const mx   = avg(xArr), my = avg(yArr);
    let num = 0, den = 0;
    xArr.forEach((x, i) => { num += (x - mx) * (yArr[i] - my); den += (x - mx) ** 2; });
    if (den !== 0) {
      const slope = num / den, inter = my - slope * mx;
      const y0 = Math.max(0, Math.min(10, inter));
      const y1 = Math.max(0, Math.min(10, slope * 5 + inter));
      svg += `<line x1="${xs(0).toFixed(1)}" y1="${ys(y0).toFixed(1)}"
               x2="${xs(5).toFixed(1)}"  y2="${ys(y1).toFixed(1)}"
               stroke="var(--accent)" stroke-width="1.2" stroke-dasharray="5 4" opacity=".5"/>`;
    }
  }

  // Points
  points.forEach(p => {
    const cx    = xs(p.voteMoy).toFixed(1);
    const cy    = ys(p.noteFinale).toFixed(1);
    const label = p.titre.length > 20 ? p.titre.slice(0, 18) + "…" : p.titre;
    svg += `<circle cx="${cx}" cy="${cy}" r="6" fill="var(--accent)" opacity=".85">
      <title>${esc(p.titre)} — vote : ${fmtFr(p.voteMoy)}/5 · finale : ${fmtFr(p.noteFinale)}/10</title>
    </circle>`;
    svg += `<text x="${(Number(cx) + 9).toFixed(1)}" y="${(Number(cy) - 4).toFixed(1)}" fill="var(--muted)" font-size="10" font-family="system-ui">${esc(label)}</text>`;
  });

  // Labels axes
  svg += `<text x="${((pL + W - pR) / 2).toFixed(1)}" y="${H - 2}" text-anchor="middle" fill="var(--muted)" font-size="11" font-family="system-ui">Note d'élection (/5)</text>`;
  const midY = (pT + ih / 2).toFixed(1);
  svg += `<text x="12" y="${midY}" text-anchor="middle" fill="var(--muted)" font-size="11" font-family="system-ui" transform="rotate(-90 12 ${midY})">Note finale (/10)</text>`;

  svg += `</svg>`;
  host.innerHTML = svg;
}

// ════════════════════════════════════════════════════════════════════
// 11. Heatmap similarité votants — corrélation de Pearson (Archétype 5)
//     heatColor(r, -1, 1, 0) — neutre = crème, négatif = terra, positif = sauge
// ════════════════════════════════════════════════════════════════════
function renderHeatSim({ membres, membreById, votes }) {
  const tbl = document.getElementById("heat-sim");

  // voteVecs[memId][livreId] = note /5
  const voteVecs = {};
  membres.forEach(m => { voteVecs[m.id] = {}; });

  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      Object.entries(r.notes || {}).forEach(([memId, note]) => {
        const val = Number(note);
        if (val > 0 && voteVecs[memId]) {
          voteVecs[memId][r.livre_id] = val;
        }
      });
    });
  });

  const actifs = membres.filter(m => Object.keys(voteVecs[m.id] || {}).length > 0);
  if (actifs.length < 2) {
    tbl.innerHTML = `<tr><td class="sx-note" style="padding:1rem">Pas assez de données de vote (min. 2 membres actifs).</td></tr>`;
    return;
  }

  let html = `<tr><th></th>${actifs.map(m =>
    `<th style="color:${mColor(m)}">${esc(m.nom)}</th>`
  ).join("")}</tr>`;

  actifs.forEach(rowM => {
    html += `<tr><th style="color:${mColor(rowM)}">${esc(rowM.nom)}</th>`;
    actifs.forEach(colM => {
      if (rowM.id === colM.id) {
        html += `<td style="background:var(--paper-dark,#e8e0d3);font-weight:700;text-align:center">1,0</td>`;
        return;
      }
      const livresCommuns = Object.keys(voteVecs[rowM.id])
        .filter(lid => voteVecs[colM.id][lid] !== undefined);

      if (livresCommuns.length < 3) {
        html += `<td style="text-align:center;color:var(--muted);font-size:.8rem" title="${livresCommuns.length} livres communs — min. 3 requis">—</td>`;
        return;
      }

      const a = livresCommuns.map(lid => voteVecs[rowM.id][lid]);
      const b = livresCommuns.map(lid => voteVecs[colM.id][lid]);
      const r = pearson(a, b);

      if (r === null) {
        html += `<td style="text-align:center;color:var(--muted)">—</td>`;
        return;
      }

      const bg = heatColor(r, -1, 1, 0);
      html += `<td style="background:${bg};text-align:center" title="${esc(rowM.nom)} / ${esc(colM.nom)} : r = ${r.toFixed(3)} sur ${livresCommuns.length} livres communs">${fmtFr(r, 2)}</td>`;
    });
    html += `</tr>`;
  });

  tbl.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════
// 12. Controversé / Consensuel (pastilles Archétype 7)
//     chipColor(2 - std, 0, 2) : haute std → terra (chaud), basse std → sauge
// ════════════════════════════════════════════════════════════════════
function renderContrConso({ livreById, votes }) {
  const host = document.getElementById("grid-contr-conso");

  const stats = [];
  Object.entries(livreById).forEach(([lid, livre]) => {
    const pool = [];
    votes.forEach(v => {
      const res = (v.resultats || []).find(r => r.livre_id === lid);
      if (!res) return;
      Object.values(res.notes || {}).forEach(note => {
        const val = Number(note);
        if (val > 0) pool.push(val);
      });
    });
    if (pool.length < 2) return;
    stats.push({ titre: livre.titre, avg: avg(pool), std: stddev(pool), cnt: pool.length });
  });

  if (!stats.length) {
    host.innerHTML = `<div class="sx-panel"><p class="sx-note" style="padding:1rem">Aucune donnée de vote disponible.</p></div>`;
    return;
  }

  stats.sort((a, b) => b.std - a.std);
  const top = 8;
  const ctv = stats.slice(0, top);
  const cns = [...stats].sort((a, b) => a.std - b.std).slice(0, top);

  const makePanel = (items, title, icon) => {
    // sx-book-h / sx-stat-line = Archétype 7 DA (pas les petits chips 26px)
    const rows = items.map(s => {
      const bg = chipColor(2 - Math.min(s.std, 2), 0, 2);
      return `<div style="padding:.55rem .9rem;border-radius:6px;background:${bg};margin-bottom:.4rem">
        <span class="sx-book-h">${esc(s.titre)}</span>
        <div class="sx-stat-line">moy : <b>${fmtFr(s.avg)}/5</b> · σ = <b>${fmtFr(s.std)}</b> · ${s.cnt} vote${s.cnt !== 1 ? "s" : ""}</div>
      </div>`;
    }).join("");
    return `<div class="sx-panel" style="margin-bottom:0">
      <div class="sx-panel-head">
        <span class="sx-panel-title">${icon} ${title}</span>
        <span class="sx-tag">Écart-type des notes /5</span>
      </div>
      ${rows}
    </div>`;
  };

  host.innerHTML =
    makePanel(ctv, "Le plus controversé", "🔥") +
    makePanel(cns, "Le plus consensuel",  "🤝");
}

// ════════════════════════════════════════════════════════════════════
// 13. Durée de vie des propositions (barres + badge Archétype 2)
// ════════════════════════════════════════════════════════════════════
function renderDureeVie({ livreById, votes }) {
  const host = document.getElementById("bars-duree");

  const livreSessions = {};
  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      livreSessions[r.livre_id] = (livreSessions[r.livre_id] || 0) + 1;
    });
  });

  const items = Object.entries(livreSessions)
    .map(([lid, cnt]) => ({
      titre:  livreById[lid]?.titre  ?? lid,
      cnt,
      statut: livreById[lid]?.statut ?? "?",
    }))
    .filter(d => d.cnt > 0)
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 15);

  if (!items.length) {
    host.innerHTML = `<p class="sx-note">Aucune proposition dans les sessions de vote.</p>`;
    return;
  }

  const maxC = Math.max(...items.map(d => d.cnt));

  host.innerHTML = items.map(d => {
    const pct = maxC ? d.cnt / maxC * 100 : 0;
    const [bCls, bTxt] = d.statut === "elu"
      ? ["sx-badge-elu",  "Élu"]
      : d.statut === "elimine"
        ? ["sx-badge-elim", "Éliminé"]
        : ["sx-badge-prop", "En attente"];
    const label = d.titre.length > 28 ? d.titre.slice(0, 26) + "…" : d.titre;
    return `<div class="sx-bar-row">
      <span class="sx-bar-lab" style="font-size:.77rem" title="${esc(d.titre)}">${esc(label)}</span>
      <div class="sx-bar-track"><div class="sx-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
      <span class="sx-bar-val">${d.cnt} <span class="sx-bar-badge ${bCls}">${bTxt}</span></span>
    </div>`;
  }).join("");
}

// ════════════════════════════════════════════════════════════════════
// 14. Évolution des propositions (colonnes empilées Archétype 3)
//     Par mois de date_proposition (comme l'ancienne version)
// ════════════════════════════════════════════════════════════════════
function renderPropsStack({ membres, livres }) {
  const colsEl   = document.getElementById("cols-props");
  const legendEl = document.getElementById("cols-props-legend");

  const moisMap = {};
  livres.forEach(l => {
    if (!l.propose_par || !l.date_proposition) return;
    const d = typeof l.date_proposition.toDate === "function"
      ? l.date_proposition.toDate()
      : new Date(l.date_proposition);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!moisMap[key]) moisMap[key] = {};
    moisMap[key][l.propose_par] = (moisMap[key][l.propose_par] || 0) + 1;
  });

  const keys = Object.keys(moisMap).sort();
  if (!keys.length) {
    colsEl.innerHTML = `<p class="sx-note">Aucune proposition avec date enregistrée.</p>`;
    return;
  }

  const maxTotal = Math.max(...keys.map(k =>
    Object.values(moisMap[k]).reduce((a, b) => a + b, 0)
  ));

  const membresImpliques = membres.filter(m => keys.some(k => moisMap[k][m.id] > 0));

  colsEl.innerHTML = keys.map(k => {
    const total = Object.values(moisMap[k]).reduce((a, b) => a + b, 0);
    const h     = maxTotal ? Math.max(total / maxTotal * 100, 10) : 10;
    const [year, mon] = k.split("-");
    const lab   = new Date(Number(year), Number(mon) - 1)
      .toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

    const segs = membresImpliques.map(m => {
      const cnt = moisMap[k][m.id] || 0;
      if (!cnt) return "";
      const segH = total ? (cnt / total * 100).toFixed(1) : 0;
      return `<div class="sx-col-seg" style="height:${segH}%;background:${mColor(m)}" title="${esc(m.nom)} — ${cnt}"></div>`;
    }).join("");

    return `<div class="sx-col">
      <div class="sx-col-bars" style="height:${h.toFixed(1)}%">${segs}</div>
      <div class="sx-col-v">${total}</div>
      <div class="sx-col-lab">${lab}</div>
    </div>`;
  }).join("");

  // legend items = [{name, color}]
  legendEl.innerHTML = legend(membresImpliques.map(m => ({
    name:  m.nom,
    color: mColor(m),
  })));
}

// ════════════════════════════════════════════════════════════════════
// Démarrage
// ════════════════════════════════════════════════════════════════════
init().catch(err => {
  console.error("[statistiques] init error:", err);
  const main = document.querySelector(".main");
  if (main) {
    main.insertAdjacentHTML("afterbegin",
      `<div style="background:#fde;border:1px solid #c44;padding:1rem;border-radius:8px;margin-bottom:1rem;font-family:monospace;font-size:.85rem">
        <strong>Erreur de chargement :</strong> ${err.message}
      </div>`
    );
  }
});
