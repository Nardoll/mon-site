import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMembres, addMembre, getLivres, getVotes, getNotesForMembre, getStatutsForMembre } from "./db.js";
import { formatDate, formatMois, initiales, STATUTS_LECTURE, showToast } from "./utils.js";

await requireAuth();
initNav("membres");

let membres = [], livres = [], votes = [];

async function init() {
  [membres, livres, votes] = await Promise.all([getMembres(), getLivres(), getVotes()]);
  document.getElementById("m-date").value = new Date().toISOString().split("T")[0];
  renderGrid();
  const openId = new URLSearchParams(window.location.search).get("open");
  if (openId) openProfil(openId);
}

function renderGrid() {
  const grid = document.getElementById("membres-grid");
  if (!membres.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="big-icon">👥</span>Aucun membre pour l'instant.</div>`;
    return;
  }
  grid.innerHTML = membres.map(m => `
    <div class="member-card" data-id="${m.id}">
      <div class="avatar">${initiales(m.nom)}</div>
      <div class="member-card-name">${m.nom}</div>
      <div class="member-card-date">Depuis ${formatDate(m.date_arrivee)}</div>
    </div>
  `).join("");

  grid.querySelectorAll(".member-card").forEach(card => {
    card.addEventListener("click", () => openProfil(card.dataset.id));
  });
}

// ── Add member modal ───────────────────────────────────────────────

document.getElementById("btn-add-membre").addEventListener("click", () => {
  document.getElementById("membre-overlay").classList.remove("hidden");
});

["membre-close","membre-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => {
    document.getElementById("membre-overlay").classList.add("hidden");
  });
});

document.getElementById("membre-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("membre-overlay").classList.add("hidden");
});

document.getElementById("membre-save").addEventListener("click", async () => {
  const nom = document.getElementById("m-nom").value.trim();
  if (!nom) { showToast("Le nom est obligatoire.", "error"); return; }
  const date_arrivee = document.getElementById("m-date").value || new Date().toISOString().split("T")[0];

  try {
    await addMembre({ nom, date_arrivee });
    showToast(`${nom} ajouté !`, "success");
    document.getElementById("membre-overlay").classList.add("hidden");
    document.getElementById("m-nom").value = "";
    membres = await getMembres();
    renderGrid();
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
});

// ── Profil ─────────────────────────────────────────────────────────

async function openProfil(id) {
  const membre = membres.find(m => m.id === id);
  if (!membre) return;

  document.getElementById("profil-title").textContent = membre.nom;
  document.getElementById("profil-content").innerHTML = `<div class="loading">Chargement…</div>`;
  document.getElementById("profil-overlay").classList.remove("hidden");

  const [notes, statuts] = await Promise.all([
    getNotesForMembre(id),
    getStatutsForMembre(id)
  ]);

  // Livres proposés
  const proposes = livres.filter(l => l.propose_par === id);

  // Participation aux votes
  const participation = votes.filter(v =>
    (v.resultats || []).some(r => r.notes && r.notes[id] !== undefined)
  );

  // Votes participés avec notes données
  const votesHTML = participation.length
    ? participation.map(v => {
        const notesVote = (v.resultats || []).map(r => {
          if (r.notes?.[id] === undefined) return null;
          return `<div class="chart-row">
            <div class="chart-label">${r.titre ?? "?"}</div>
            <div class="chart-bar-wrap">
              <div class="chart-bar ${v.livre_elu === r.livre_id ? 'best' : ''}" style="width:${Math.round(r.notes[id] / 10 * 100)}%">
                ${r.notes[id]}/10
              </div>
            </div>
          </div>`;
        }).filter(Boolean).join("");
        return `
          <div style="margin-bottom:1.25rem">
            <div style="font-size:.82rem;font-weight:600;margin-bottom:.5rem">${formatMois(v.mois, v.annee)}</div>
            <div class="chart">${notesVote}</div>
          </div>`;
      }).join("")
    : `<div class="text-muted" style="font-size:.85rem">Aucune participation enregistrée.</div>`;

  const proposesHTML = proposes.length
    ? `<ul style="list-style:none">${proposes.map(l => `
        <li style="padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.88rem">
          <strong>${l.titre}</strong>${l.auteur ? ` — ${l.auteur}` : ""}
          <span class="badge badge-${l.statut === 'elu' ? 'elu' : l.statut === 'refuse' ? 'refuse' : 'proposition'}" style="float:right">${l.statut === 'elu' ? 'Élu' : l.statut === 'refuse' ? 'Éliminé' : 'En proposition'}</span>
        </li>`).join("")}</ul>`
    : `<div class="text-muted" style="font-size:.85rem">Aucune proposition.</div>`;

  const statutsHTML = statuts.length
    ? `<ul style="list-style:none">${statuts.map(s => {
        const livre = livres.find(l => l.id === s.livre_id);
        const info = STATUTS_LECTURE[s.statut] ?? STATUTS_LECTURE.pas_commence;
        return `<li style="padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.88rem;display:flex;justify-content:space-between">
          <span>${livre?.titre ?? s.livre_id}</span>
          <span class="st-badge st-${info.css}">${info.label}</span>
        </li>`;
      }).join("")}</ul>`
    : `<div class="text-muted" style="font-size:.85rem">Aucun statut enregistré.</div>`;

  document.getElementById("profil-content").innerHTML = `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem">
      <div class="avatar" style="width:56px;height:56px;font-size:1.3rem">${initiales(membre.nom)}</div>
      <div>
        <div style="font-size:1.1rem;font-weight:700">${membre.nom}</div>
        <div class="text-muted" style="font-size:.82rem">Membre depuis ${formatDate(membre.date_arrivee)}</div>
        <div class="text-muted" style="font-size:.82rem">${proposes.length} proposition(s) · ${participation.length} vote(s)</div>
      </div>
    </div>

    <div class="divider"></div>
    <div class="card-title mb-2">📚 Livres proposés</div>
    ${proposesHTML}

    <div class="divider"></div>
    <div class="card-title mb-2">📖 Statuts de lecture</div>
    ${statutsHTML}

    <div class="divider"></div>
    <div class="card-title mb-2">🗳️ Participation aux votes</div>
    ${votesHTML}
  `;
}

["profil-close"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => {
    document.getElementById("profil-overlay").classList.add("hidden");
  });
});

document.getElementById("profil-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("profil-overlay").classList.add("hidden");
});

init().catch(console.error);
