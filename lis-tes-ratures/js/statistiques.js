import { checkAuth }            from "./auth.js";
import { initNav }              from "./nav.js";
import {
  getMembres, getLivres, getVotes, getReunions,
  getAllStatutsLecture, getAllCommentaires,
} from "./db.js";

checkAuth();
initNav("stats");

// ── Utilitaires ──────────────────────────────────────────────────────────────

function toTs(d) {
  if (!d) return 0;
  return d.toDate ? d.toDate().getTime() : new Date(d).getTime();
}

// Détection robuste d'une réunion passée (même logique que reunions.js)
function isPasse(r) {
  if (Object.keys(r.notes_finales || {}).length > 0) return true;
  const s = (r.statut || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (s.includes("pass") || s.includes("termin")) return true;
  if (r.date) {
    const d = r.date.toDate ? r.date.toDate() : new Date(r.date);
    if (!isNaN(d) && d < new Date()) return true;
  }
  return false;
}

function esc(x) {
  return String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stddev(arr) {
  const nums = arr.filter(v => v != null && !isNaN(v)).map(Number);
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.sqrt(nums.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / nums.length);
}

function fmtFr(n, dec = 1) {
  return n == null ? "—" : n.toFixed(dec).replace(".", ",");
}

// ── Point d'entrée ───────────────────────────────────────────────────────────

async function init() {
  const [membres, livres, votes, reunions, statuts, commentaires] = await Promise.all([
    getMembres(), getLivres(), getVotes(), getReunions(),
    getAllStatutsLecture(), getAllCommentaires(),
  ]);

  const SX = window.SX;

  // Index rapide
  const membreById = Object.fromEntries(membres.map(m => [m.id, m]));
  const livreById  = Object.fromEntries(livres.map(l => [l.id, l]));

  // Réunions passées, ordre chronologique
  const passees = reunions.filter(isPasse).sort((a, b) => toTs(a.date) - toTs(b.date));

  // Livres élus
  const livresElus = livres.filter(l => l.statut === "elu");

  // Votes dans l'ordre chronologique (pour les colonnes empilées)
  const votesChron = [...votes].sort((a, b) =>
    a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois
  );

  // Sous-titre récap
  document.getElementById("stats-sub").textContent =
    `${passees.length} séance${passees.length > 1 ? "s" : ""} · ` +
    `${livresElus.length} livre${livresElus.length > 1 ? "s" : ""} lu${livresElus.length > 1 ? "s" : ""} · ` +
    `${membres.length} membre${membres.length > 1 ? "s" : ""}`;

  // Rendu de chaque section
  renderKPIs({ livresElus, statuts, passees });
  renderHistNotes({ passees });
  renderColsLecteurs({ passees, livreById });
  renderPlotNotes({ passees, membres, membreById, livreById, SX });
  renderTblActifs({ membres, livres, votes, reunions, statuts, commentaires });
  renderHeatGouts({ membres, livres, livreById, membreById, votes, SX });
  renderContrConso({ livreById, votes, SX });
  renderDureeVie({ livreById, votes });
  renderPropsStack({ membres, membreById, livreById, votesChron, SX });
}

// ── Archétype 1 · KPI gravé ───────────────────────────────────────────────────

function renderKPIs({ livresElus, statuts, passees }) {
  const lecturesCumulees = statuts.filter(s => s.statut === "terminé").length;
  const pagesClub = livresElus.reduce((s, l) => s + (l.nb_pages || 0), 0);
  const pagesCumulees = livresElus.reduce((s, l) => {
    const finis = statuts.filter(st => st.livre_id === l.id && st.statut === "terminé").length;
    return s + finis * (l.nb_pages || 0);
  }, 0);

  const kpis = [
    { n: livresElus.length,                   label: "Livres lus par le club",   sub: "Livres élus par vote" },
    { n: lecturesCumulees,                     label: "Lectures cumulées",        sub: "Total des lectures individuelles" },
    { n: pagesClub.toLocaleString("fr-FR"),    label: "Pages lues par le club",   sub: "Somme des livres élus" },
    { n: pagesCumulees.toLocaleString("fr-FR"),label: "Pages lues cumulées",      sub: "Pages × membres ayant terminé" },
  ];

  document.getElementById("kpis-root").innerHTML = kpis.map(k => `
    <div class="sx-kpi">
      <div class="sx-kpi-num">${k.n}</div>
      <div class="sx-kpi-label">${k.label}</div>
      ${k.sub ? `<div class="sx-kpi-sub">${k.sub}</div>` : ""}
    </div>`).join("");
}

// ── Archétype 2 · Barres horizontales — histogramme notes /10 ────────────────

function renderHistNotes({ passees }) {
  const allNotes = passees
    .flatMap(r => Object.values(r.notes_finales || {}).map(Number))
    .filter(v => !isNaN(v) && v >= 0 && v <= 10);

  if (!allNotes.length) {
    document.getElementById("avg-note-display").innerHTML = "";
    document.getElementById("hist-notes").innerHTML = `<p class="sx-note">Aucune note enregistrée pour l'instant.</p>`;
    return;
  }

  const counts = Array(10).fill(0);
  allNotes.forEach(n => {
    const idx = Math.min(9, Math.max(0, Math.round(n) - 1));
    counts[idx]++;
  });
  const max    = Math.max(...counts);
  const mean   = allNotes.reduce((a, b) => a + b, 0) / allNotes.length;
  const bestIdx = counts.indexOf(max);

  document.getElementById("avg-note-display").innerHTML = `
    <div style="font-family:var(--serif);font-size:2rem;font-weight:700;color:var(--accent);line-height:1;margin-bottom:1.1rem">
      ${fmtFr(mean)}
      <span style="font-size:.95rem;color:var(--muted);font-weight:400">/10 · ${allNotes.length} note${allNotes.length > 1 ? "s" : ""}</span>
    </div>`;

  document.getElementById("hist-notes").innerHTML = counts.map((c, i) => {
    const cls = i === bestIdx && c > 0 ? "best" : "";
    const pct = max ? Math.max(c / max * 100, c ? 8 : 0) : 0;
    return `<div class="sx-bar-row">
      <span class="sx-bar-lab">${i + 1}</span>
      <div class="sx-bar-track"><div class="sx-bar-fill ${cls}" style="width:${pct}%">${c || ""}</div></div>
      <span class="sx-bar-val">${c}</span>
    </div>`;
  }).join("");
}

// ── Archétype 3 · Colonnes — lecteurs ayant terminé par séance ───────────────

function renderColsLecteurs({ passees, livreById }) {
  if (!passees.length) {
    document.getElementById("cols-lecteurs").innerHTML =
      `<div class="sx-col"><div class="sx-col-lab" style="bottom:auto;position:relative">Aucune séance</div></div>`;
    return;
  }

  const max = Math.max(...passees.map(r => (r.lecteurs_ids || []).length), 1);

  document.getElementById("cols-lecteurs").innerHTML = passees.map(r => {
    const v     = (r.lecteurs_ids || []).length;
    const titre = livreById[r.livre_id]?.titre || "—";
    const label = titre.length > 16 ? titre.slice(0, 14) + "…" : titre;
    return `<div class="sx-col">
      ${v ? `<div class="sx-col-v">${v}</div>` : ""}
      <div class="sx-col-bars" style="height:${v / max * 100}%">
        <div class="sx-col-seg" style="height:100%"></div>
      </div>
      <div class="sx-col-lab">${esc(label)}</div>
    </div>`;
  }).join("");
}

// ── Archétype 4 · Courbe à la plume — évolution des notes ────────────────────

function renderPlotNotes({ passees, membres, membreById, livreById, SX }) {
  const host       = document.getElementById("plot-notes");
  const legendHost = document.getElementById("plot-notes-legend");

  if (!passees.length) {
    host.innerHTML = `<p class="sx-note">Aucune séance pour l'instant.</p>`;
    return;
  }

  // Membres qui apparaissent dans au moins un notes_finales
  const memIds = [...new Set(passees.flatMap(r => Object.keys(r.notes_finales || {})))];

  const series = memIds.map(mid => {
    const m = membreById[mid];
    if (!m) return null;
    return {
      name  : m.nom,
      color : SX.memberColor(m.nom),
      values: passees.map(r => {
        const v = (r.notes_finales || {})[mid];
        return v != null ? Number(v) : null;
      }),
    };
  }).filter(Boolean);

  if (!series.length) {
    host.innerHTML = `<p class="sx-note">Aucune note disponible.</p>`;
    return;
  }

  const xLabels = passees.map(r => {
    const t = livreById[r.livre_id]?.titre || "—";
    return t.length > 18 ? t.slice(0, 16) + "…" : t;
  });

  SX.lineChart(host, { series, xLabels, yMax: 10, yStep: 2, height: 280 });
  legendHost.innerHTML = SX.legend(series);
}

// ── Archétype 6 · Table-registre — membres les plus actifs ───────────────────

function renderTblActifs({ membres, livres, votes, reunions, statuts, commentaires }) {
  const rows = membres.map(m => {
    const livresFinis     = statuts.filter(s => s.membre_id === m.id && s.statut === "terminé").length;
    const reunionsPresent = reunions.filter(r => (r.participant_ids || []).includes(m.id)).length;
    const props           = livres.filter(l => l.propose_par === m.id).length;
    const votesParticipes = votes.filter(v =>
      (v.resultats || []).some(r => r.notes && r.notes[m.id] != null)
    ).length;
    const coms            = commentaires.filter(c => c.membre_id === m.id).length;
    return { nom: m.nom, livresFinis, reunionsPresent, props, votesParticipes, coms,
             _score: livresFinis * 3 + reunionsPresent + props };
  }).sort((a, b) => b._score - a._score);

  const medals = ["or", "ar", "br"];
  const cell   = v => v ? v : `<span class="muted">—</span>`;

  document.getElementById("tbl-actifs").innerHTML = rows.map((s, i) => {
    const medal = i < 3 ? `<span class="sx-medal ${medals[i]}">${i + 1}</span>` : "";
    return `<tr class="${i < 3 ? "top" : ""}">
      <td>${medal}${esc(s.nom)}</td>
      <td>${cell(s.livresFinis)}</td>
      <td>${cell(s.reunionsPresent)}</td>
      <td>${cell(s.props)}</td>
      <td>${cell(s.votesParticipes)}</td>
      <td>${cell(s.coms)}</td>
    </tr>`;
  }).join("");
}

// ── Archétype 5 · Heatmap — matrice des goûts (/5) ───────────────────────────

function renderHeatGouts({ membres, livres, livreById, membreById, votes, SX }) {
  // Proposants = membres ayant proposé un livre qui est apparu dans au moins un vote
  const votedLivreIds = new Set(votes.flatMap(v => (v.resultats || []).map(r => r.livre_id)));
  const proposantIds  = [...new Set(
    [...votedLivreIds]
      .map(lid => livreById[lid]?.propose_par)
      .filter(Boolean)
  )].filter(id => membreById[id]);

  if (!proposantIds.length) {
    document.getElementById("panel-heat").innerHTML =
      `<div class="sx-panel-head"><span class="sx-panel-title">Matrice des goûts</span></div>
       <p class="sx-note">Données de votes insuffisantes.</p>`;
    return;
  }

  // Construire matrix[votantId][proposantId] = [notes /5]
  const matrix = {};
  membres.forEach(m => {
    matrix[m.id] = {};
    proposantIds.forEach(p => { matrix[m.id][p] = []; });
  });

  votes.forEach(vote => {
    (vote.resultats || []).forEach(r => {
      const livre = livreById[r.livre_id];
      if (!livre || !proposantIds.includes(livre.propose_par)) return;
      Object.entries(r.notes || {}).forEach(([votantId, note]) => {
        if (matrix[votantId] && matrix[votantId][livre.propose_par] !== undefined) {
          matrix[votantId][livre.propose_par].push(Number(note));
        }
      });
    });
  });

  // Votants = membres ayant au moins une note dans la matrice
  const votantIds = membres
    .filter(m => proposantIds.some(p => (matrix[m.id]?.[p] || []).length > 0))
    .map(m => m.id);

  if (!votantIds.length) {
    document.getElementById("panel-heat").innerHTML =
      `<div class="sx-panel-head"><span class="sx-panel-title">Matrice des goûts</span></div>
       <p class="sx-note">Données de votes insuffisantes.</p>`;
    return;
  }

  const propNoms = proposantIds.map(id => membreById[id]?.nom || id);

  const head = `<thead><tr>
    <th class="corner">↓ votant / proposant →</th>
    ${propNoms.map(n => `<th>${esc(n)}</th>`).join("")}
  </tr></thead>`;

  const body = "<tbody>" + votantIds.map(vid => {
    const m = membreById[vid];
    if (!m) return "";
    const cells = proposantIds.map(pid => {
      const notes   = matrix[vid]?.[pid] || [];
      const isOwnBook = vid === pid;
      if (!notes.length) return `<td class="empty">—</td>`;
      const a  = notes.reduce((s, v) => s + v, 0) / notes.length;
      const bg = SX.heatColor(a, 1, 5, 3);
      return `<td class="${isOwnBook ? "diag" : ""}" style="background:${bg}">${fmtFr(a)}</td>`;
    }).join("");
    return `<tr><td class="rowhead">${esc(m.nom)}</td>${cells}</tr>`;
  }).join("") + "</tbody>";

  document.getElementById("heat-gouts").innerHTML = head + body;
}

// ── Archétype 7 · Pastilles — controversé / consensuel ───────────────────────

function renderContrConso({ livreById, votes, SX }) {
  // Notes /5 par livre (depuis les bulletins de vote)
  const notesMap = {};
  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      if (!r.notes) return;
      const vals = Object.values(r.notes).map(Number).filter(n => !isNaN(n) && n > 0);
      if (!vals.length) return;
      if (!notesMap[r.livre_id]) notesMap[r.livre_id] = [];
      notesMap[r.livre_id].push(...vals);
    });
  });

  const ranked = Object.entries(notesMap)
    .filter(([, ns]) => ns.length >= 2)
    .map(([lid, ns]) => ({
      livre_id: lid,
      notes   : ns,
      avg     : ns.reduce((a, b) => a + b, 0) / ns.length,
      sd      : stddev(ns),
    }))
    .sort((a, b) => b.sd - a.sd);

  const grid = document.getElementById("grid-contr-conso");

  if (ranked.length < 1) {
    grid.innerHTML = `<p class="sx-note">Données de votes insuffisantes pour calculer la controverse.</p>`;
    return;
  }

  const controversé = ranked[0];
  const consensuel  = ranked[ranked.length - 1];

  const IC_CHILI = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18c8 0 13-5 13-11 0 0 3 0 3 3"/><path d="M5 18c-1 0-2-1-2-2 4 0 6-2 8-4"/></svg>`;
  const IC_DOVE  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h6l3 3c4 0 7-1 9-4-1 7-5 12-12 12a7 7 0 0 1-7-7z"/></svg>`;

  function panel(iconHtml, titre, data) {
    const livre = livreById[data.livre_id];
    const chips = data.notes.map(v => `<span class="sx-chip" style="background:${SX.chipColor(v)}">${v}</span>`).join("");
    return `<div class="sx-panel" style="margin-bottom:0">
      <div class="sx-panel-head">
        <span class="sx-panel-title">${iconHtml} ${esc(titre)}</span>
      </div>
      <div class="sx-book-h">${esc(livre?.titre || "—")}</div>
      <div class="sx-book-a">${esc(livre?.auteur || "—")}</div>
      <div class="sx-stat-line">Moy. <b>${fmtFr(data.avg)}/5</b> · écart-type <b>${fmtFr(data.sd, 2)}</b></div>
      <div class="sx-chips">${chips}</div>
    </div>`;
  }

  grid.innerHTML =
    panel(IC_CHILI, "Livre le plus controversé", controversé) +
    panel(IC_DOVE,  "Livre le plus consensuel",  consensuel);
}

// ── Archétype 2 variante badge — durée de vie des propositions ────────────────

function renderDureeVie({ livreById, votes }) {
  // Compte le nombre de sessions de vote où chaque livre a participé
  // (via resultats ET resultats_tour1 si 2ᵉ tour dans la même session)
  const count = {};

  votes.forEach(v => {
    const livresSession = new Set();
    (v.resultats || []).forEach(r => livresSession.add(r.livre_id));
    // Tour 1 d'un vote à 2 tours (stocké dans tour2.resultats_tour1)
    ((v.tour2?.resultats_tour1) || []).forEach(r => livresSession.add(r.livre_id));
    livresSession.forEach(lid => { count[lid] = (count[lid] || 0) + 1; });
  });

  const items = Object.entries(count)
    .map(([lid, n]) => {
      const livre = livreById[lid];
      if (!livre) return null;
      const elu    = livre.statut === "elu";
      const refuse = livre.statut === "refuse";
      if (!elu && !refuse) return null; // encore en jeu
      return { titre: livre.titre, n, elu };
    })
    .filter(Boolean)
    .sort((a, b) => b.n - a.n || (b.elu ? -1 : 1));

  if (!items.length) {
    document.getElementById("bars-duree").innerHTML =
      `<p class="sx-note">Aucune proposition finalisée pour l'instant.</p>`;
    return;
  }

  const max = Math.max(...items.map(x => x.n), 1);

  document.getElementById("bars-duree").innerHTML = items.map(({ titre, n, elu }) => {
    const label = titre.length > 30 ? titre.slice(0, 28) + "…" : titre;
    const cls   = elu ? "best" : "low";
    const badge = elu
      ? `<span class="sx-bar-badge sx-badge-elu">✓ élu</span>`
      : `<span class="sx-bar-badge sx-badge-elim">✕ éliminé</span>`;
    return `<div class="sx-bar-row">
      <span class="sx-bar-lab">${esc(label)}</span>
      <div class="sx-bar-track">
        <div class="sx-bar-fill ${cls}" style="width:${n / max * 100}%">${n} vote${n > 1 ? "s" : ""}</div>
      </div>
      ${badge}
    </div>`;
  }).join("");
}

// ── Archétype 3 variante empilée — évolution des propositions ────────────────

function renderPropsStack({ membres, membreById, livreById, votesChron, SX }) {
  const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

  // Pour chaque session de vote : compter les livres proposés par chaque membre
  const data = votesChron.map(v => {
    const label    = `${MOIS[(v.mois || 1) - 1]} ${v.annee}`;
    const byMembre = {};

    const allLivreIds = new Set();
    (v.resultats || []).forEach(r => allLivreIds.add(r.livre_id));
    ((v.tour2?.resultats_tour1) || []).forEach(r => allLivreIds.add(r.livre_id));

    [...allLivreIds].forEach(lid => {
      const livre = livreById[lid];
      if (!livre || !livre.propose_par) return;
      const m = membreById[livre.propose_par];
      if (!m) return;
      byMembre[m.id] = (byMembre[m.id] || 0) + 1;
    });

    const total = Object.values(byMembre).reduce((s, v) => s + v, 0);
    return { label, byMembre, total };
  }).filter(d => d.total > 0);

  if (!data.length) {
    document.getElementById("cols-props").innerHTML =
      `<div class="sx-col"><div class="sx-col-lab" style="bottom:auto;position:relative">Aucun vote</div></div>`;
    return;
  }

  // Membres présents dans au moins une session
  const memIds = [...new Set(data.flatMap(d => Object.keys(d.byMembre)))];
  const max    = Math.max(...data.map(d => d.total), 1);

  document.getElementById("cols-props").innerHTML = data.map(({ label, byMembre, total }) => {
    const segs = memIds
      .filter(mid => byMembre[mid])
      .map(mid => {
        const m = membreById[mid];
        if (!m) return "";
        const h = byMembre[mid] / total * 100;
        return `<div class="sx-col-seg" style="height:${h}%;background:${SX.memberColor(m.nom)}"></div>`;
      }).join("");

    return `<div class="sx-col">
      ${total ? `<div class="sx-col-v">${total}</div>` : ""}
      <div class="sx-col-bars" style="height:${total / max * 100}%">${segs}</div>
      <div class="sx-col-lab">${esc(label)}</div>
    </div>`;
  }).join("");

  const legendItems = memIds.map(mid => {
    const m = membreById[mid];
    return m ? { name: m.nom, color: SX.memberColor(m.nom) } : null;
  }).filter(Boolean);

  document.getElementById("cols-props-legend").innerHTML = SX.legend(legendItems);
}

// ── Lancement ────────────────────────────────────────────────────────────────

init().catch(err => {
  console.error("Erreur stats :", err);
  document.getElementById("stats-sub").textContent = "Erreur de chargement.";
});
