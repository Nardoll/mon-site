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

// ── Calculs ────────────────────────────────────────────────────────

function membersWhoFinishedBook(livreId, allStatuts, reunions) {
  const set = new Set();
  allStatuts.filter(s => s.livre_id === livreId && s.statut === "termine")
    .forEach(s => set.add(s.membre_id));
  reunions.filter(r => r.livre_id === livreId).forEach(r => {
    Object.entries(r.notes_finales || {}).forEach(([memId, note]) => {
      if (Number(note) > 0) set.add(memId);
    });
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

  // KPI 1 : Livres lus par le club
  const nbLivresLus = elusLivreIds.size;

  // KPI 2 : Livres lus cumulés (membres × livres)
  let totalLivresCumules = 0;
  for (const livreId of elusLivreIds) {
    totalLivresCumules += membersWhoFinishedBook(livreId, allStatuts, reunions).size;
  }

  // KPI 3 : Pages lues par le club
  const totalPagesClub = elusLivres.reduce((s, l) => s + (l.nb_pages || 0), 0);

  // KPI 4 : Pages lues cumulées
  let totalPagesCumulees = 0;
  for (const livre of elusLivres) {
    if (!livre.nb_pages) continue;
    totalPagesCumulees += livre.nb_pages * membersWhoFinishedBook(livre.id, allStatuts, reunions).size;
  }

  // Note moyenne globale
  const allNotes = reunions.flatMap(r =>
    Object.values(r.notes_finales || {}).map(Number).filter(n => !isNaN(n) && n > 0)
  );
  const noteMoyenne = allNotes.length
    ? allNotes.reduce((a, b) => a + b, 0) / allNotes.length
    : null;

  // Distribution des notes (1–10 buckets)
  const notesDist = Array(10).fill(0);
  allNotes.forEach(n => { const i = Math.min(9, Math.max(0, Math.round(n) - 1)); notesDist[i]++; });

  // Membres actifs : livres lus, commentaires, votes participés
  const livresParMembre = {};
  for (const livreId of elusLivreIds) {
    membersWhoFinishedBook(livreId, allStatuts, reunions).forEach(mId => {
      livresParMembre[mId] = (livresParMembre[mId] || 0) + 1;
    });
  }

  const commentsParMembre = {};
  allComments.forEach(c => {
    commentsParMembre[c.membre_id] = (commentsParMembre[c.membre_id] || 0) + 1;
  });

  // Votes : pour chaque vote, quels membres ont voté ?
  const votesParMembre = {};
  votes.forEach(v => {
    const votants = new Set();
    (v.resultats || []).forEach(r => Object.keys(r.notes || {}).forEach(m => votants.add(m)));
    votants.forEach(m => { votesParMembre[m] = (votesParMembre[m] || 0) + 1; });
  });

  // Participation
  const totalVotes = votes.length;
  const participationParMembre = membres.map(m => ({
    nom: m.nom,
    id: m.id,
    nbVotes: votesParMembre[m.id] || 0,
    taux: totalVotes > 0 ? Math.round((votesParMembre[m.id] || 0) / totalVotes * 100) : 0,
  })).sort((a, b) => b.nbVotes - a.nbVotes);

  const tauxMoyen = participationParMembre.length
    ? Math.round(participationParMembre.reduce((s, m) => s + m.taux, 0) / participationParMembre.length)
    : 0;

  // Évolution : livres lus par mois (cumulatif)
  const parMois = {};
  elusVotes.sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois).forEach(v => {
    const key = `${v.annee}-${String(v.mois).padStart(2, "0")}`;
    parMois[key] = (parMois[key] || 0) + 1;
  });

  return {
    nbLivresLus, totalLivresCumules, totalPagesClub, totalPagesCumulees,
    noteMoyenne, allNotes, notesDist, totalVotes,
    livresParMembre, commentsParMembre, votesParMembre,
    participationParMembre, tauxMoyen,
    parMois, membres, elusLivres, elusVotes
  };
}

// ── Rendu ──────────────────────────────────────────────────────────

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
    </div>
  `;
}

function renderNoteMoyenne(s) {
  const el = document.getElementById("note-moyenne-content");
  if (s.noteMoyenne === null) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">Aucune note finale enregistrée.</div>`;
    return;
  }
  el.innerHTML = `
    <div class="stats-note-big">
      <span class="stats-note-val">${s.noteMoyenne.toFixed(1)}</span>
      <span class="stats-note-denom">/10</span>
      <span class="stats-note-count">(${s.allNotes.length} note${s.allNotes.length > 1 ? "s" : ""})</span>
    </div>
    <div class="stats-note-dist">
      ${s.notesDist.map((count, i) => {
        const pct = s.allNotes.length ? Math.round(count / s.allNotes.length * 100) : 0;
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

function renderMembresActifs(s) {
  const el = document.getElementById("membres-actifs-content");
  const rows = s.membres.map(m => ({
    nom: m.nom,
    id: m.id,
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

async function renderEvolution(s) {
  await loadChartJs();
  const keys = Object.keys(s.parMois).sort();
  if (!keys.length) return;

  const labels = keys.map(k => {
    const [y, m] = k.split("-");
    return formatMois(Number(m), Number(y));
  });
  const values = keys.map(k => s.parMois[k]);

  const style = getComputedStyle(document.documentElement);
  const borderClr = style.getPropertyValue("--border").trim() || "#2a2a2a";
  const mutedClr  = style.getPropertyValue("--muted").trim()  || "#888";
  const textClr   = style.getPropertyValue("--text").trim()   || "#e0e0e0";
  const accentClr = style.getPropertyValue("--accent").trim() || "#e8a44a";

  new Chart(document.getElementById("chart-evolution"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Livres lus",
        data: values,
        backgroundColor: accentClr + "88",
        borderColor: accentClr,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 800, easing: "easeInOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} livre${ctx.parsed.y > 1 ? "s" : ""}` } }
      },
      scales: {
        x: { grid: { color: borderClr }, ticks: { color: mutedClr } },
        y: { min: 0, ticks: { stepSize: 1, color: mutedClr }, grid: { color: borderClr } }
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

    document.getElementById("card-membres-actifs").style.display = "block";
    renderMembresActifs(s);
  }

  if (Object.keys(s.parMois).length) {
    document.getElementById("card-evolution").style.display = "block";
    await renderEvolution(s);
  }
}

init().catch(console.error);
