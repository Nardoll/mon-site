import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMembres } from "./db.js";
import { getVotes } from "./db.js";
import { getStatutsForLivre, upsertStatutLecture, getLivreById } from "./db.js";
import { formatMois, STATUTS_LECTURE, STATUTS_ORDRE, cycleStatut, initiales, showToast } from "./utils.js";

await requireAuth();
initNav("accueil");

let allVotes = [];
let allMembres = [];
let currentLivreId = null;
let editMembre = null;

async function init() {
  [allVotes, allMembres] = await Promise.all([getVotes(), getMembres()]);
  renderCurrentBook();
  renderTimeline();
}

function votesElus() {
  return allVotes
    .filter(v => v.livre_elu)
    .sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);
}

function moyenneFromVote(vote, livreId) {
  const r = (vote.resultats || []).find(x => x.livre_id === livreId);
  return r?.moyenne ?? null;
}

async function renderCurrentBook() {
  const section = document.getElementById("current-book-section");
  const elus = votesElus();
  if (!elus.length) {
    section.innerHTML = `<div class="empty-state"><span class="big-icon">📖</span>Aucun livre élu pour l'instant.</div>`;
    return;
  }

  const latest = elus[elus.length - 1];
  currentLivreId = latest.livre_elu;

  const [livre, statuts] = await Promise.all([
    getLivreById(currentLivreId),
    getStatutsForLivre(currentLivreId)
  ]);

  const statutByMembre = {};
  statuts.forEach(s => { statutByMembre[s.membre_id] = s; });

  const moy = moyenneFromVote(latest, currentLivreId);

  section.innerHTML = `
    <div class="section-title">Lecture du mois — ${formatMois(latest.mois, latest.annee)}</div>
    <div class="current-grid">
      <div class="card">
        <div class="card-title">📖 ${livre?.titre ?? "—"}</div>
        <div style="color:var(--muted);font-size:.85rem;margin-bottom:.5rem">${livre?.auteur ?? ""}</div>
        ${moy !== null ? `<div style="font-size:1.1rem;font-weight:700;color:var(--accent)">${moy.toFixed(1)} / 10</div>` : ""}
      </div>
      <div class="card">
        <div class="card-title">Avancements</div>
        <ul class="status-list" id="status-list"></ul>
      </div>
    </div>
  `;

  renderStatusList(statutByMembre);
}

function renderStatusList(statutByMembre) {
  const list = document.getElementById("status-list");
  if (!list) return;
  list.innerHTML = allMembres.map(m => {
    const s = statutByMembre[m.id];
    const statut = s?.statut ?? "pas_commence";
    const info = STATUTS_LECTURE[statut];
    let progress = "";
    if (s?.page_actuelle && s?.pages_totales && s.pages_totales > 0) {
      const pct = Math.min(100, Math.round(s.page_actuelle / s.pages_totales * 100));
      progress = `
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span class="progress-text">${s.page_actuelle}/${s.pages_totales}</span>
        </div>`;
    }
    return `
      <li class="status-row">
        <span class="member-name">${m.nom}</span>
        <div>
          <span class="st-badge st-${info.css}" data-membre="${m.id}" data-statut="${statut}">${info.label}</span>
          ${progress}
        </div>
      </li>`;
  }).join("");

  list.querySelectorAll(".st-badge").forEach(badge => {
    badge.addEventListener("click", () => openStatutModal(badge.dataset.membre, badge.dataset.statut));
  });
}

function renderTimeline() {
  const section = document.getElementById("timeline-section");
  const elus = votesElus();

  if (!elus.length) {
    section.innerHTML = `<div class="empty-state"><span class="big-icon">📅</span>Aucun livre élu pour l'instant.</div>`;
    return;
  }

  const reversed = [...elus].reverse();
  section.innerHTML = `<div class="timeline">${reversed.map(v => {
    const r = (v.resultats || []).find(x => x.livre_id === v.livre_elu);
    const moy = r?.moyenne;
    const titre = r?.titre ?? v.livre_elu;
    const auteur = r?.auteur ?? "";
    return `
      <div class="tl-item">
        <div class="tl-card" data-vote="${v.id}">
          <div class="tl-month">${formatMois(v.mois, v.annee)}</div>
          <div class="tl-info">
            <div class="tl-title">${titre}</div>
            ${auteur ? `<div class="tl-author">${auteur}</div>` : ""}
          </div>
          ${moy !== null && moy !== undefined ? `<div class="tl-score">${Number(moy).toFixed(1)}/10</div>` : ""}
        </div>
      </div>`;
  }).join("")}</div>`;
}

// ── Modal statut ───────────────────────────────────────────────────

function openStatutModal(membreId, currentStatut) {
  editMembre = membreId;
  const m = allMembres.find(x => x.id === membreId);
  document.getElementById("statut-modal-title").textContent = `Statut — ${m?.nom ?? ""}`;
  document.getElementById("statut-select").value = currentStatut;
  document.getElementById("statut-overlay").classList.remove("hidden");
}

document.getElementById("statut-modal-close").addEventListener("click", closeStatutModal);
document.getElementById("statut-modal-cancel").addEventListener("click", closeStatutModal);
document.getElementById("statut-overlay").addEventListener("click", e => { if (e.target === e.currentTarget) closeStatutModal(); });

function closeStatutModal() {
  document.getElementById("statut-overlay").classList.add("hidden");
  editMembre = null;
}

document.getElementById("statut-modal-save").addEventListener("click", async () => {
  if (!editMembre || !currentLivreId) return;
  const statut = document.getElementById("statut-select").value;
  const page_actuelle = document.getElementById("page-actuelle").value;
  const pages_totales = document.getElementById("pages-totales").value;
  try {
    await upsertStatutLecture({ membre_id: editMembre, livre_id: currentLivreId, statut, page_actuelle, pages_totales });
    showToast("Statut mis à jour", "success");
    closeStatutModal();
    // Refresh
    const statuts = await getStatutsForLivre(currentLivreId);
    const statutByMembre = {};
    statuts.forEach(s => { statutByMembre[s.membre_id] = s; });
    renderStatusList(statutByMembre);
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
});

init().catch(console.error);
