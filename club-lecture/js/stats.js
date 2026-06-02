import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getLivres, getMembres, getVotes, getReunions, getAllStatutsLecture, getAllCommentaires } from "./db.js";
import { formatMois } from "./utils.js";

await requireAuth();
initNav("stats");

// ── Chargement Chart.js (lazy) ────────────────────────────────────

async function loadChartJs() {
  if (window.Chart) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── Calculs de base ────────────────────────────────────────────────

function membersWhoFinishedBook(livreId, allStatuts, reunions) {
  const set = new Set();
  allStatuts.filter(s => s.livre_id === livreId && s.statut === "termine")
    .forEach(s => set.add(s.membre_id));
  reunions.filter(r => r.livre_id === livreId).forEach(r => {
    if (r.lecteurs_ids != null) {
      // Nouveau système : qui a lu le livre est coché dans lecteurs_ids
      (r.lecteurs_ids || []).forEach(memId => set.add(memId));
    } else {
      // Rétrocompat : anciennes réunions sans lecteurs_ids → utiliser notes_finales > 0
      Object.entries(r.notes_finales || {}).forEach(([memId, note]) => {
        if (Number(note) > 0) set.add(memId);
      });
    }
  });
  return set;
}

async function computeStats() {
  const [livres, membres, votes, reunions, allStatuts, allComments] = await Promise.all([
    getLivres(), getMembres(), getVotes(), getReunions(),
    getAllStatutsLecture(), getAllCommentaires()
  ]);

  const elusVotes = votes.filter(v => v.livre_elu);
  const elusLivreIds = new Set(elusVotes.map(v => v.livre_elu));
  const elusLivres = livres.filter(l => elusLivreIds.has(l.id));

  // KPIs
  const nbLivresLus = elusLivreIds.size;
  let totalLivresCumules = 0;
  for (const livreId of elusLivreIds)
    totalLivresCumules += membersWhoFinishedBook(livreId, allStatuts, reunions).size;

  const totalPagesClub = elusLivres.reduce((s, l) => s + (l.nb_pages || 0), 0);
  let totalPagesCumulees = 0;
  for (const livre of elusLivres) {
    if (!livre.nb_pages) continue;
    totalPagesCumulees += livre.nb_pages * membersWhoFinishedBook(livre.id, allStatuts, reunions).size;
  }

  // Notes de réunion — globales + par membre
  const reunionNotesParMembre = {};
  membres.forEach(m => { reunionNotesParMembre[m.id] = []; });
  const allNotes = [];
  reunions.forEach(r => {
    Object.entries(r.notes_finales || {}).forEach(([memId, note]) => {
      const n = Number(note);
      if (!isNaN(n) && n > 0) {
        allNotes.push(n);
        if (reunionNotesParMembre[memId]) reunionNotesParMembre[memId].push(n);
      }
    });
  });
  const noteMoyenne = allNotes.length ? allNotes.reduce((a, b) => a + b, 0) / allNotes.length : null;
  const notesDist = Array(10).fill(0);
  allNotes.forEach(n => { const i = Math.min(9, Math.max(0, Math.round(n) - 1)); notesDist[i]++; });

  // Notes de vote (élections) — globales + par membre
  const voteNotesParMembre = {};
  membres.forEach(m => { voteNotesParMembre[m.id] = []; });
  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      Object.entries(r.notes || {}).forEach(([memId, note]) => {
        const n = Number(note);
        if (!isNaN(n) && voteNotesParMembre[memId]) voteNotesParMembre[memId].push(n);
      });
    });
  });
  const allVoteNotes = Object.values(voteNotesParMembre).flat();
  const voteMoyenne = allVoteNotes.length ? allVoteNotes.reduce((a, b) => a + b, 0) / allVoteNotes.length : null;
  const voteNotesDist = Array(5).fill(0);
  allVoteNotes.forEach(n => { const i = Math.min(4, Math.max(0, Math.round(n) - 1)); voteNotesDist[i]++; });

  // Membres actifs
  const livresParMembre = {};
  for (const livreId of elusLivreIds)
    membersWhoFinishedBook(livreId, allStatuts, reunions).forEach(mId => {
      livresParMembre[mId] = (livresParMembre[mId] || 0) + 1;
    });

  const commentsParMembre = {};
  allComments.forEach(c => { commentsParMembre[c.membre_id] = (commentsParMembre[c.membre_id] || 0) + 1; });

  const votesParMembre = {};
  votes.forEach(v => {
    const votants = new Set();
    (v.resultats || []).forEach(r => Object.keys(r.notes || {}).forEach(m => votants.add(m)));
    votants.forEach(m => { votesParMembre[m] = (votesParMembre[m] || 0) + 1; });
  });

  const totalVotes = votes.length;
  const participationParMembre = membres.map(m => ({
    nom: m.nom, id: m.id,
    nbVotes: votesParMembre[m.id] || 0,
    taux: totalVotes > 0 ? Math.round((votesParMembre[m.id] || 0) / totalVotes * 100) : 0,
  })).sort((a, b) => b.nbVotes - a.nbVotes);

  const tauxMoyen = participationParMembre.length
    ? Math.round(participationParMembre.reduce((s, m) => s + m.taux, 0) / participationParMembre.length) : 0;

  // Évolution lecteurs par mois
  const parMois = {};
  elusVotes.sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois).forEach(v => {
    if (!v.livre_elu) return;
    const key = `${v.annee}-${String(v.mois).padStart(2, "0")}`;
    parMois[key] = membersWhoFinishedBook(v.livre_elu, allStatuts, reunions).size;
  });

  return {
    nbLivresLus, totalLivresCumules, totalPagesClub, totalPagesCumulees,
    noteMoyenne, allNotes, notesDist, reunionNotesParMembre,
    allVoteNotes, voteMoyenne, voteNotesDist, voteNotesParMembre,
    totalVotes, livresParMembre, commentsParMembre, votesParMembre,
    participationParMembre, tauxMoyen,
    parMois, membres, elusLivres, elusVotes,
    livres, votes, reunions
  };
}

// ── Rendu — KPIs ───────────────────────────────────────────────────

function fmt(n) { return n.toLocaleString("fr-FR"); }

function renderKpis(s) {
  const hasPagesClub = s.totalPagesClub > 0;
  const hasPagesCum  = s.totalPagesCumulees > 0;
  document.getElementById("kpi-grid").innerHTML = `
    <div class="stats-kpi">
      <div class="stats-kpi-value">${s.nbLivresLus}</div>
      <div class="stats-kpi-label">Livre${s.nbLivresLus > 1 ? "s" : ""} lu${s.nbLivresLus > 1 ? "s" : ""} par le club</div>
    </div>
    <div class="stats-kpi">
      <div class="stats-kpi-value">${s.totalLivresCumules}</div>
      <div class="stats-kpi-label">Lectures cumulées des membres</div>
      <div class="stats-kpi-sub">Total de toutes les lectures individuelles</div>
    </div>
    <div class="stats-kpi ${!hasPagesClub ? "stats-kpi-dim" : ""}">
      <div class="stats-kpi-value">${hasPagesClub ? fmt(s.totalPagesClub) : "—"}</div>
      <div class="stats-kpi-label">Pages lues par le club</div>
      <div class="stats-kpi-sub">${hasPagesClub ? "Somme des livres élus renseignés" : "Renseignez les pages dans la bibliothèque"}</div>
    </div>
    <div class="stats-kpi ${!hasPagesCum ? "stats-kpi-dim" : ""}">
      <div class="stats-kpi-value">${hasPagesCum ? fmt(s.totalPagesCumulees) : "—"}</div>
      <div class="stats-kpi-label">Pages lues cumulées</div>
      <div class="stats-kpi-sub">${hasPagesCum ? "Pages × membres ayant terminé" : "Renseignez les pages dans la bibliothèque"}</div>
    </div>`;
}

// ── Rendu — Graphique distribution notes (réunion & vote) ──────────

function renderNoteDistCard({ contentId, allNotes, notesParMembre, membres, scale, suffix }) {
  const el = document.getElementById(contentId);
  if (!allNotes.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Aucune note enregistrée.</div>`;
    return;
  }

  const selectId = contentId + "-sel";
  const statsId  = contentId + "-stats";

  const memberOpts = membres
    .filter(m => (notesParMembre[m.id] || []).length > 0)
    .map(m => `<option value="${m.id}">${m.nom}</option>`)
    .join("");

  el.innerHTML = `
    <select class="note-membre-select" id="${selectId}">
      <option value="all">Tout le club</option>
      ${memberOpts}
    </select>
    <div id="${statsId}"></div>`;

  function renderDist(notes) {
    const statsEl = document.getElementById(statsId);
    if (!notes.length) {
      statsEl.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Aucune note pour ce membre.</div>`;
      return;
    }
    const moy  = notes.reduce((a, b) => a + b, 0) / notes.length;
    const dist = Array(scale).fill(0);
    notes.forEach(n => { const i = Math.min(scale - 1, Math.max(0, Math.round(n) - 1)); dist[i]++; });
    statsEl.innerHTML = `
      <div class="stats-note-big">
        <span class="stats-note-val">${moy.toFixed(1)}</span>
        <span class="stats-note-denom">${suffix}</span>
        <span class="stats-note-count">(${notes.length} note${notes.length > 1 ? "s" : ""})</span>
      </div>
      <div class="stats-note-dist">
        ${dist.map((count, i) => {
          const pct = Math.round(count / notes.length * 100);
          return `
            <div class="stats-note-dist-row">
              <span class="stats-note-dist-label">${i + 1}</span>
              <div class="chart-bar-wrap">
                <div class="chart-bar" style="width:${pct}%;min-width:${count > 0 ? 2 : 0}px">
                  ${count > 0 ? count : ""}
                </div>
              </div>
            </div>`;
        }).join("")}
      </div>`;
  }

  renderDist(allNotes);
  document.getElementById(selectId).addEventListener("change", e => {
    const notes = e.target.value === "all" ? allNotes : (notesParMembre[e.target.value] || []);
    renderDist(notes);
  });
}

function renderNoteMoyenne(s) {
  renderNoteDistCard({
    contentId: "note-moyenne-content",
    allNotes: s.allNotes,
    notesParMembre: s.reunionNotesParMembre,
    membres: s.membres,
    scale: 10,
    suffix: "/10"
  });
}

function renderNoteVote(s) {
  if (!s.allVoteNotes.length) return;
  document.getElementById("card-note-vote").style.display = "block";
  renderNoteDistCard({
    contentId: "note-vote-content",
    allNotes: s.allVoteNotes,
    notesParMembre: s.voteNotesParMembre,
    membres: s.membres,
    scale: 5,
    suffix: "/5"
  });
}

// ── Rendu — Participation ─────────────────────────────────────────

function renderParticipation(s) {
  const el = document.getElementById("participation-content");
  if (!s.totalVotes) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Aucun vote enregistré.</div>`;
    return;
  }
  const rows = s.participationParMembre.map(m => `
    <div class="chart-row">
      <span class="chart-label">${m.nom}</span>
      <div class="chart-bar-wrap">
        <div class="chart-bar" style="width:${m.taux}%;min-width:${m.nbVotes > 0 ? 2 : 0}px">
          ${m.nbVotes > 0 ? m.taux + "%" : ""}
        </div>
      </div>
      <span style="font-size:.75rem;color:var(--muted);white-space:nowrap">${m.nbVotes}/${s.totalVotes}</span>
    </div>`).join("");
  el.innerHTML = `
    <div style="font-size:.8rem;color:var(--muted);margin-bottom:.75rem">Taux moyen : <strong style="color:var(--text)">${s.tauxMoyen}%</strong></div>
    <div class="chart">${rows}</div>`;
}

// ── Rendu — Membres actifs ────────────────────────────────────────

function renderMembresActifs(s) {
  const el = document.getElementById("membres-actifs-content");
  const rows = s.membres.map(m => ({
    nom: m.nom, id: m.id,
    livres: s.livresParMembre[m.id] || 0,
    comments: s.commentsParMembre[m.id] || 0,
    votes: s.votesParMembre[m.id] || 0,
  })).sort((a, b) => (b.livres * 3 + b.comments + b.votes * 2) - (a.livres * 3 + a.comments + a.votes * 2));

  el.innerHTML = `
    <div class="stats-membres-table">
      <div class="stats-membres-header">
        <span class="stats-membres-name">Membre</span>
        <span class="stats-membres-col">📚 Livres lus</span>
        <span class="stats-membres-col">💬 Commentaires</span>
        <span class="stats-membres-col">🗳️ Votes</span>
      </div>
      ${rows.map((m, i) => `
        <div class="stats-membres-row ${i === 0 ? "stats-membres-top" : ""}">
          <span class="stats-membres-name">${i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}${m.nom}</span>
          <span class="stats-membres-col">${m.livres || "—"}</span>
          <span class="stats-membres-col">${m.comments || "—"}</span>
          <span class="stats-membres-col">${m.votes || "—"}</span>
        </div>`).join("")}
    </div>`;
}

// ── Rendu — Évolution lecteurs ────────────────────────────────────

async function renderEvolution(s) {
  await loadChartJs();
  const keys = Object.keys(s.parMois).sort();
  if (!keys.length) return;

  const labels = keys.map(k => { const [y, m] = k.split("-"); return formatMois(Number(m), Number(y)); });
  const values = keys.map(k => s.parMois[k]);

  const style  = getComputedStyle(document.documentElement);
  const borderClr = style.getPropertyValue("--border").trim() || "#2a2a2a";
  const mutedClr  = style.getPropertyValue("--muted").trim()  || "#888";
  const accentClr = style.getPropertyValue("--accent").trim() || "#e8a44a";

  new Chart(document.getElementById("chart-evolution"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Lecteurs", data: values,
        backgroundColor: accentClr + "88", borderColor: accentClr, borderWidth: 1, borderRadius: 4 }] },
    options: {
      responsive: true, animation: { duration: 800, easing: "easeInOutQuart" },
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} lecteur${ctx.parsed.y > 1 ? "s" : ""}` } } },
      scales: {
        x: { grid: { color: borderClr }, ticks: { color: mutedClr } },
        y: { min: 0, ticks: { stepSize: 1, color: mutedClr }, grid: { color: borderClr } }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// ── Calculs Propositions ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function noteHeatBg(val, scale) {
  if (val === null || val === undefined) return "";
  const t = Math.max(0, Math.min(1, (val - 1) / (scale - 1)));
  let r, g;
  if (t < 0.5) { r = 210; g = Math.round(t * 2 * 155); }
  else { r = Math.round((1 - (t - 0.5) * 2) * 210); g = 155; }
  return `rgba(${r},${g},55,0.28)`;
}

function corrHeatBg(val) {
  if (val === null || val === undefined) return "";
  const t = Math.max(0, Math.min(1, (val + 1) / 2));
  let r, g;
  if (t < 0.5) { r = 210; g = Math.round(t * 2 * 155); }
  else { r = Math.round((1 - (t - 0.5) * 2) * 210); g = 155; }
  return `rgba(${r},${g},55,0.28)`;
}

function computeProposStats(livres, votes, reunions, membres) {
  // Mapping livre_id → propose_par
  const livreProposeur = {};
  livres.forEach(l => { if (l.propose_par) livreProposeur[l.id] = l.propose_par; });

  // ── Bilan par membre proposant ────────────────────────────────
  const bilanMap = {};
  membres.forEach(m => {
    bilanMap[m.id] = { id: m.id, nom: m.nom, total: 0, elus: 0, elimines: 0, enAttente: 0, notesVote: [], notesFinales: [] };
  });

  livres.forEach(l => {
    const b = bilanMap[l.propose_par];
    if (!b) return;
    b.total++;
    if (l.statut === "elu") b.elus++;
    else if (l.statut === "refuse") b.elimines++;
    else b.enAttente++;
  });

  // Notes individuelles reçues par les livres de chaque proposant
  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      const b = bilanMap[livreProposeur[r.livre_id]];
      if (!b) return;
      Object.values(r.notes || {}).forEach(note => b.notesVote.push(Number(note)));
    });
  });

  // Notes finales des réunions pour les livres élus de chaque proposant
  reunions.forEach(r => {
    if (!r.livre_id) return;
    const b = bilanMap[livreProposeur[r.livre_id]];
    if (!b) return;
    const notes = Object.values(r.notes_finales || {}).map(Number).filter(n => n > 0);
    if (notes.length) b.notesFinales.push(notes.reduce((a, c) => a + c, 0) / notes.length);
  });

  const bilanPropositions = Object.values(bilanMap)
    .filter(b => b.total > 0)
    .sort((a, b) => b.total - a.total);

  // ── Matrice des goûts ─────────────────────────────────────────
  const votantsIds = new Set();
  const proposantsIds = new Set();
  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      const pid = livreProposeur[r.livre_id];
      if (pid) proposantsIds.add(pid);
      Object.keys(r.notes || {}).forEach(mid => votantsIds.add(mid));
    });
  });
  const votants    = membres.filter(m => votantsIds.has(m.id));
  const proposants = membres.filter(m => proposantsIds.has(m.id));

  const matriceRaw = {};
  votants.forEach(v => {
    matriceRaw[v.id] = {};
    proposants.forEach(p => { matriceRaw[v.id][p.id] = []; });
  });
  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      const pid = livreProposeur[r.livre_id];
      if (!pid) return;
      Object.entries(r.notes || {}).forEach(([mid, note]) => {
        if (matriceRaw[mid]?.[pid] !== undefined) matriceRaw[mid][pid].push(Number(note));
      });
    });
  });

  const matriceValues = {};
  votants.forEach(v => {
    matriceValues[v.id] = {};
    proposants.forEach(p => {
      const ns = matriceRaw[v.id]?.[p.id] || [];
      matriceValues[v.id][p.id] = ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
    });
  });

  // ── Variance des livres ───────────────────────────────────────
  const livreNotesMap = {};
  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      const ns = Object.values(r.notes || {}).map(Number).filter(n => !isNaN(n));
      if (!livreNotesMap[r.livre_id]) livreNotesMap[r.livre_id] = { titre: r.titre, auteur: r.auteur, notes: [] };
      livreNotesMap[r.livre_id].notes.push(...ns);
    });
  });

  const varianceBooks = Object.entries(livreNotesMap)
    .filter(([, v]) => v.notes.length >= 3)
    .map(([, v]) => {
      const mean = v.notes.reduce((a, b) => a + b, 0) / v.notes.length;
      const std  = Math.sqrt(v.notes.reduce((a, b) => a + (b - mean) ** 2, 0) / v.notes.length);
      return { titre: v.titre, auteur: v.auteur, notes: v.notes, mean, std };
    })
    .sort((a, b) => b.std - a.std);

  // ── Corrélation vote → réunion ────────────────────────────────
  const livreVoteMoyMap = {};
  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      if (!livreVoteMoyMap[r.livre_id]) livreVoteMoyMap[r.livre_id] = [];
      if (r.moyenne !== null && r.moyenne !== undefined) livreVoteMoyMap[r.livre_id].push(r.moyenne);
    });
  });

  const correlPoints = [];
  reunions.forEach(r => {
    if (!r.livre_id) return;
    const finalNotes = Object.values(r.notes_finales || {}).map(Number).filter(n => n > 0);
    if (!finalNotes.length) return;
    const noteFinale = finalNotes.reduce((a, b) => a + b, 0) / finalNotes.length;
    const vMoys = livreVoteMoyMap[r.livre_id];
    if (!vMoys?.length) return;
    const voteMoy = vMoys.reduce((a, b) => a + b, 0) / vMoys.length;
    const livre = livres.find(l => l.id === r.livre_id);
    if (livre) correlPoints.push({ titre: livre.titre, voteMoy, noteFinale });
  });

  // ── Similarité votants (Pearson) ──────────────────────────────
  const notesParVotant = {};
  membres.forEach(m => { notesParVotant[m.id] = {}; });
  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      Object.entries(r.notes || {}).forEach(([mid, note]) => {
        if (notesParVotant[mid]) notesParVotant[mid][r.livre_id] = Number(note);
      });
    });
  });

  function pearson(a, b) {
    const common = Object.keys(a).filter(k => b[k] !== undefined);
    if (common.length < 3) return null;
    const xs = common.map(k => a[k]);
    const ys = common.map(k => b[k]);
    const n  = common.length;
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    const num = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0);
    const den = Math.sqrt(xs.reduce((s, v) => s + (v - mx) ** 2, 0) * ys.reduce((s, v) => s + (v - my) ** 2, 0));
    return den === 0 ? null : num / den;
  }

  const simValues = {};
  votants.forEach(v => {
    simValues[v.id] = {};
    votants.forEach(p => {
      simValues[v.id][p.id] = v.id === p.id ? 1.0
        : pearson(notesParVotant[v.id] || {}, notesParVotant[p.id] || {});
    });
  });

  // ── Durée de vie ──────────────────────────────────────────────
  const livreVoteCount = {};
  votes.forEach(v => {
    (v.resultats || []).forEach(r => {
      livreVoteCount[r.livre_id] = (livreVoteCount[r.livre_id] || 0) + 1;
    });
  });

  const dureeVie = livres
    .filter(l => l.statut !== "en_proposition" && (livreVoteCount[l.id] || 0) > 0)
    .map(l => ({ titre: l.titre, auteur: l.auteur, statut: l.statut, nbVotes: livreVoteCount[l.id] || 0 }))
    .sort((a, b) => b.nbVotes - a.nbVotes);

  // ── Évolution des propositions ────────────────────────────────
  const evoPropMois = {};
  livres.forEach(l => {
    if (!l.propose_par || !l.date_proposition) return;
    const d = l.date_proposition.toDate ? l.date_proposition.toDate() : new Date(l.date_proposition);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!evoPropMois[key]) evoPropMois[key] = {};
    evoPropMois[key][l.propose_par] = (evoPropMois[key][l.propose_par] || 0) + 1;
  });

  return {
    bilanPropositions,
    matrice: { votants, proposants, values: matriceValues },
    varianceBooks,
    correlPoints,
    simVotants: votants,
    simValues,
    dureeVie,
    evoPropMois
  };
}

// ── Rendu — Bilan des propositions ───────────────────────────────

function renderBilanPropositions({ bilanPropositions }) {
  const el = document.getElementById("bilan-propositions-content");
  if (!bilanPropositions.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Aucun livre proposé pour le moment.</div>`;
    return;
  }

  const rows = bilanPropositions.map(b => {
    const pctElu  = b.total ? Math.round(b.elus     / b.total * 100) : 0;
    const pctElim = b.total ? Math.round(b.elimines / b.total * 100) : 0;
    const nvote   = b.notesVote.length
      ? (b.notesVote.reduce((a, c) => a + c, 0) / b.notesVote.length).toFixed(2) + "&thinsp;/5"
      : "—";
    const nfinale = b.notesFinales.length
      ? (b.notesFinales.reduce((a, c) => a + c, 0) / b.notesFinales.length).toFixed(1) + "&thinsp;/10"
      : "—";
    return `
      <div class="prop-bilan-row">
        <span class="prop-bilan-nom">${b.nom}</span>
        <span class="prop-bilan-cell">${b.total}</span>
        <span class="prop-bilan-cell prop-bilan-elu">${b.elus} <small class="prop-bilan-pct">(${pctElu}%)</small></span>
        <span class="prop-bilan-cell prop-bilan-elim">${b.elimines} <small class="prop-bilan-pct">(${pctElim}%)</small></span>
        <span class="prop-bilan-cell" style="color:var(--muted)">${b.enAttente || "—"}</span>
        <span class="prop-bilan-cell">${nvote}</span>
        <span class="prop-bilan-cell">${nfinale}</span>
      </div>`;
  }).join("");

  el.innerHTML = `
    <div class="prop-bilan-table">
      <div class="prop-bilan-header">
        <span class="prop-bilan-nom">Membre</span>
        <span class="prop-bilan-cell">Propositions</span>
        <span class="prop-bilan-cell">✅ Élus</span>
        <span class="prop-bilan-cell">❌ Éliminés</span>
        <span class="prop-bilan-cell">⏳ En attente</span>
        <span class="prop-bilan-cell">Note vote reçue</span>
        <span class="prop-bilan-cell">Note finale reçue</span>
      </div>
      ${rows}
    </div>`;
}

// ── Rendu — Matrice des goûts ─────────────────────────────────────

function renderMatriceGouts({ matrice }) {
  const el = document.getElementById("matrice-gouts-content");
  const { votants, proposants, values } = matrice;

  if (!votants.length || !proposants.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Données insuffisantes.</div>`;
    return;
  }

  const prenom = nom => nom.split(" ")[0];

  const thead = `<thead><tr>
    <th class="matrice-corner">↓ Votant &nbsp;/&nbsp; Proposant →</th>
    ${proposants.map(p => `<th class="matrice-th">${prenom(p.nom)}</th>`).join("")}
  </tr></thead>`;

  const tbody = `<tbody>${votants.map(v => `
    <tr>
      <td class="matrice-row-label">${prenom(v.nom)}</td>
      ${proposants.map(p => {
        const val    = values[v.id]?.[p.id] ?? null;
        const isSelf = v.id === p.id;
        const bg     = val !== null ? noteHeatBg(val, 5) : "";
        return `<td class="matrice-td${isSelf ? " matrice-td-self" : ""}" style="background:${bg}">
          ${val !== null ? val.toFixed(1) : "—"}
        </td>`;
      }).join("")}
    </tr>`).join("")}
  </tbody>`;

  el.innerHTML = `
    <div class="matrice-scroll">
      <table class="matrice-table">${thead}${tbody}</table>
    </div>
    <p class="matrice-legend">Rouge = note basse · Vert = note haute · Diagonale = notes données à ses propres livres</p>`;
}

// ── Rendu — Controversé / Consensuel ─────────────────────────────

function renderControverse({ varianceBooks }) {
  const elCont = document.getElementById("controverse-content");
  const elCons = document.getElementById("consensuel-content");

  if (varianceBooks.length < 2) {
    const msg = `<div style="color:var(--muted);font-size:.85rem">Données insuffisantes (min. 3 notes par livre).</div>`;
    elCont.innerHTML = msg; elCons.innerHTML = msg;
    return;
  }

  function bookCard(book) {
    const chips = book.notes.map(n => {
      const bg = noteHeatBg(n, 5);
      return `<span class="ctrl-note" style="background:${bg}">${n}</span>`;
    }).join("");
    return `
      <div class="ctrl-titre">${book.titre}</div>
      ${book.auteur ? `<div class="ctrl-auteur">${book.auteur}</div>` : ""}
      <div class="ctrl-stats">
        Moy.&nbsp;<strong>${book.mean.toFixed(2)}/5</strong>
        &nbsp;·&nbsp;
        Écart-type&nbsp;<strong>${book.std.toFixed(2)}</strong>
      </div>
      <div class="ctrl-notes">${chips}</div>`;
  }

  elCont.innerHTML = bookCard(varianceBooks[0]);
  elCons.innerHTML = bookCard(varianceBooks[varianceBooks.length - 1]);
}

// ── Rendu — Corrélation vote → réunion (scatter) ──────────────────

async function renderCorrelScatter({ correlPoints }) {
  if (correlPoints.length < 2) {
    document.getElementById("correl-content").innerHTML =
      `<div style="color:var(--muted);font-size:.85rem">Données insuffisantes (min. 2 livres avec note de vote et note finale).</div>`;
    return;
  }
  await loadChartJs();

  const cs      = getComputedStyle(document.documentElement);
  const accent  = cs.getPropertyValue("--accent").trim()  || "#e8a44a";
  const border  = cs.getPropertyValue("--border").trim()  || "#2a2a2a";
  const muted   = cs.getPropertyValue("--muted").trim()   || "#888";

  new Chart(document.getElementById("chart-correl"), {
    type: "scatter",
    data: {
      datasets: [{
        data: correlPoints.map(p => ({ x: p.voteMoy, y: p.noteFinale, label: p.titre })),
        backgroundColor: accent + "cc",
        borderColor: accent,
        borderWidth: 1.5,
        pointRadius: 8,
        pointHoverRadius: 10,
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 800 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw.label} — vote : ${ctx.raw.x.toFixed(2)}/5, finale : ${ctx.raw.y.toFixed(1)}/10`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Note de vote (/5)", color: muted },
          min: 0, max: 5,
          grid: { color: border }, ticks: { color: muted }
        },
        y: {
          title: { display: true, text: "Note finale réunion (/10)", color: muted },
          min: 0, max: 10,
          grid: { color: border }, ticks: { color: muted }
        }
      }
    }
  });
}

// ── Rendu — Similarité (qui vote comme qui ?) ─────────────────────

function renderSimilarite({ simVotants, simValues }) {
  const el = document.getElementById("similarite-content");

  if (simVotants.length < 2) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Au moins 2 votants nécessaires.</div>`;
    return;
  }

  let hasData = false;
  simVotants.forEach(v => simVotants.forEach(p => {
    if (v.id !== p.id && simValues[v.id]?.[p.id] !== null) hasData = true;
  }));

  if (!hasData) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Pas assez de livres votés en commun (min. 3 par paire).</div>`;
    return;
  }

  const prenom = nom => nom.split(" ")[0];

  const thead = `<thead><tr>
    <th class="matrice-corner"></th>
    ${simVotants.map(v => `<th class="matrice-th">${prenom(v.nom)}</th>`).join("")}
  </tr></thead>`;

  const tbody = `<tbody>${simVotants.map(v => `
    <tr>
      <td class="matrice-row-label">${prenom(v.nom)}</td>
      ${simVotants.map(p => {
        const val    = simValues[v.id]?.[p.id] ?? null;
        const isSelf = v.id === p.id;
        const bg     = isSelf ? "rgba(232,164,74,0.15)" : (val !== null ? corrHeatBg(val) : "");
        const txt    = isSelf ? "—" : (val !== null ? val.toFixed(2) : "—");
        return `<td class="matrice-td${isSelf ? " matrice-td-self" : ""}" style="background:${bg}">${txt}</td>`;
      }).join("")}
    </tr>`).join("")}
  </tbody>`;

  el.innerHTML = `
    <div class="matrice-scroll">
      <table class="matrice-table">${thead}${tbody}</table>
    </div>
    <p class="matrice-legend">Rouge = votes opposés · Vert = votes similaires · Valeur = corrélation de Pearson (−1 à +1) · min. 3 livres en commun</p>`;
}

// ── Rendu — Durée de vie des propositions ─────────────────────────

function renderDureeVie({ dureeVie }) {
  const el = document.getElementById("duree-vie-content");
  if (!dureeVie.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Aucun livre décidé pour le moment.</div>`;
    return;
  }

  const maxV = Math.max(...dureeVie.map(d => d.nbVotes));
  const rows = dureeVie.map(d => {
    const pct    = maxV > 0 ? Math.round(d.nbVotes / maxV * 100) : 0;
    const barCls = d.statut === "elu" ? "chart-bar best" : "chart-bar low";
    const badge  = d.statut === "elu"
      ? `<span class="dv-badge dv-elu">✅ élu</span>`
      : `<span class="dv-badge dv-elim">❌ éliminé</span>`;
    const label  = d.nbVotes === 1 ? "1 vote" : `${d.nbVotes} votes`;
    return `
      <div class="chart-row">
        <span class="chart-label" title="${d.titre}${d.auteur ? " — " + d.auteur : ""}">${d.titre}</span>
        <div class="chart-bar-wrap">
          <div class="${barCls}" style="width:${pct}%;min-width:2px">${d.nbVotes > 0 ? label : ""}</div>
        </div>
        ${badge}
      </div>`;
  }).join("");

  el.innerHTML = `<div class="chart">${rows}</div>`;
}

// ── Rendu — Évolution des propositions ────────────────────────────

async function renderEvoProp({ evoPropMois, membres }) {
  const moisKeys = Object.keys(evoPropMois).sort();
  if (moisKeys.length < 2) return;
  document.getElementById("card-evo-prop").style.display = "block";
  await loadChartJs();

  const PALETTE = ["#e8a44a","#5b9cf6","#cf6679","#4caf91","#9575cd","#ff7043","#26c6da","#66bb6a"];
  const cs      = getComputedStyle(document.documentElement);
  const border  = cs.getPropertyValue("--border").trim() || "#2a2a2a";
  const muted   = cs.getPropertyValue("--muted").trim()  || "#888";

  const propMembres = membres.filter(m => moisKeys.some(k => (evoPropMois[k][m.id] || 0) > 0));
  const labels = moisKeys.map(k => { const [y, m] = k.split("-"); return formatMois(Number(m), Number(y)); });

  new Chart(document.getElementById("chart-evo-prop"), {
    type: "bar",
    data: {
      labels,
      datasets: propMembres.map((m, i) => ({
        label: m.nom,
        data: moisKeys.map(k => evoPropMois[k][m.id] || 0),
        backgroundColor: PALETTE[i % PALETTE.length] + "bb",
        borderColor:     PALETTE[i % PALETTE.length],
        borderWidth: 1,
        stack: "stack",
        borderRadius: 3,
      }))
    },
    options: {
      responsive: true, animation: { duration: 800 },
      plugins: {
        legend: { labels: { color: muted, font: { size: 11 } } },
        tooltip: { mode: "index", intersect: false }
      },
      scales: {
        x: { stacked: true, grid: { color: border }, ticks: { color: muted } },
        y: { stacked: true, min: 0, ticks: { stepSize: 1, color: muted }, grid: { color: border } }
      }
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────

async function init() {
  const s = await computeStats();

  renderKpis(s);

  if (s.membres.length) {
    document.getElementById("stats-row-2").style.display = "grid";
    renderNoteMoyenne(s);
    renderParticipation(s);

    // Graphique notes de vote (élections /5)
    renderNoteVote(s);

    document.getElementById("card-membres-actifs").style.display = "block";
    renderMembresActifs(s);
  }

  if (Object.keys(s.parMois).length) {
    document.getElementById("card-evolution").style.display = "block";
    await renderEvolution(s);
  }

  // ── Sections Propositions ──────────────────────────────────────
  const ps = computeProposStats(s.livres, s.votes, s.reunions, s.membres);

  if (ps.bilanPropositions.length) {
    document.getElementById("stats-section-propositions").style.display = "block";
    document.getElementById("card-bilan-propositions").style.display = "block";
    renderBilanPropositions(ps);
  }

  if (ps.matrice.votants.length && ps.matrice.proposants.length) {
    document.getElementById("card-matrice-gouts").style.display = "block";
    renderMatriceGouts(ps);
  }

  if (ps.varianceBooks.length >= 2) {
    document.getElementById("card-controverse").style.display = "grid";
    renderControverse(ps);
  }

  const hasAnalyse = ps.correlPoints.length >= 2 || ps.simVotants.length >= 2;
  if (hasAnalyse) document.getElementById("stats-section-analyse").style.display = "block";

  if (ps.correlPoints.length >= 2) {
    document.getElementById("card-correl").style.display = "block";
    await renderCorrelScatter(ps);
  }

  if (ps.simVotants.length >= 2) {
    document.getElementById("card-similarite").style.display = "block";
    renderSimilarite(ps);
  }

  const hasDyn = ps.dureeVie.length || Object.keys(ps.evoPropMois).length >= 2;
  if (hasDyn) document.getElementById("stats-section-dynamiques").style.display = "block";

  if (ps.dureeVie.length) {
    document.getElementById("card-duree-vie").style.display = "block";
    renderDureeVie(ps);
  }

  await renderEvoProp({ evoPropMois: ps.evoPropMois, membres: s.membres });
}

init().catch(console.error);
