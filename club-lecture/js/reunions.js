import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMembres, getLivres, getVotes, getReunions, addReunion, updateReunion } from "./db.js";
import { formatMois, formatDate, showToast } from "./utils.js";

await requireAuth();
initNav("reunions");

let reunions = [], membres = [], livres = [], votes = [];
let currentReunionId = null;
let editReunionId = null;

async function init() {
  [reunions, membres, livres, votes] = await Promise.all([
    getReunions(), getMembres(), getLivres(), getVotes()
  ]);
  renderList();
}

function getLivreForMois(mois, annee) {
  const vote = votes.find(v => v.mois === mois && v.annee === annee && v.livre_elu);
  if (!vote) return null;
  return livres.find(l => l.id === vote.livre_elu) ?? null;
}

function getLivreTitle(livre_id) {
  return livres.find(l => l.id === livre_id)?.titre ?? "—";
}

function nomMembre(id) {
  return membres.find(m => m.id === id)?.nom ?? "—";
}

function computeNoteFinale(reunion) {
  if (!reunion.notes_finales) return null;
  const notes = Object.values(reunion.notes_finales).map(Number).filter(n => !isNaN(n) && n > 0);
  if (!notes.length) return null;
  return notes.reduce((a, b) => a + b, 0) / notes.length;
}

// ── Liste ──────────────────────────────────────────────────────────

function renderList() {
  const container = document.getElementById("reunions-list");
  if (!reunions.length) {
    container.innerHTML = `<div class="empty-state"><span class="big-icon">📝</span>Aucune réunion enregistrée.</div>`;
    return;
  }

  const prevues = reunions.filter(r => r.statut === "prevue");
  const passees = reunions.filter(r => r.statut === "passee");

  let html = "";
  if (prevues.length) {
    html += `<div class="section-title" style="margin-top:0">📅 Prévues</div>
             <div class="reunion-list">${prevues.map(renderReunionItem).join("")}</div>`;
  }
  if (passees.length) {
    html += `<div class="section-title">✅ Passées</div>
             <div class="reunion-list">${passees.map(renderReunionItem).join("")}</div>`;
  }

  container.innerHTML = html;
  container.querySelectorAll(".reunion-item").forEach(el => {
    el.addEventListener("click", () => openDetail(el.dataset.id));
  });
}

function renderReunionItem(r) {
  const dateStr = r.date ? formatDate(r.date) : "Date non fixée";
  const titre = r.livre_id ? getLivreTitle(r.livre_id) : "Aucun livre associé";
  const nf = computeNoteFinale(r);
  const n = (r.participant_ids || []).length;
  return `<div class="reunion-item" data-id="${r.id}">
    <div class="reunion-date">${dateStr}</div>
    <div class="reunion-livre">
      <div class="reunion-livre-titre">${titre}</div>
      <div class="reunion-livre-mois">${formatMois(r.mois, r.annee)}</div>
    </div>
    ${nf !== null ? `<div class="reunion-note">${nf.toFixed(1)}/10</div>` : ""}
    <div class="reunion-participants">${n} participant${n > 1 ? "s" : ""}</div>
  </div>`;
}

// ── Détail ─────────────────────────────────────────────────────────

function openDetail(id) {
  currentReunionId = id;
  const r = reunions.find(x => x.id === id);
  if (!r) return;
  const dateStr = r.date ? formatDate(r.date) : "Date non fixée";
  const titre = r.livre_id ? getLivreTitle(r.livre_id) : "—";
  document.getElementById("detail-title").textContent = `${formatMois(r.mois, r.annee)} — ${titre}`;
  renderDetailContent(r);
  document.getElementById("detail-overlay").classList.remove("hidden");
}

function renderDetailContent(r) {
  const participants = r.participant_ids || [];
  const nf = computeNoteFinale(r);

  const notesHtml = participants.length
    ? participants.map(membreId => {
        const note = r.notes_finales?.[membreId] ?? "";
        return `<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.4rem">
          <span style="flex:1;font-size:.88rem">${nomMembre(membreId)}</span>
          <input type="number" class="note-finale-input" data-membre="${membreId}"
            min="1" max="10" step="0.5" placeholder="—" value="${note}" style="width:80px">
          <span style="font-size:.78rem;color:var(--muted)">/10</span>
        </div>`;
      }).join("")
    : `<div class="text-muted" style="font-size:.85rem">Aucun participant enregistré.</div>`;

  document.getElementById("detail-content").innerHTML = `
    <dl class="book-detail-meta">
      <dt>Statut</dt><dd>${r.statut === "passee" ? "✅ Passée" : "📅 Prévue"}</dd>
      <dt>Date</dt><dd>${r.date ? formatDate(r.date) : "Non fixée"}</dd>
      <dt>Mois</dt><dd>${formatMois(r.mois, r.annee)}</dd>
      <dt>Livre</dt><dd>${r.livre_id ? getLivreTitle(r.livre_id) : "—"}</dd>
      <dt>Participants</dt><dd>${participants.map(nomMembre).join(", ") || "—"}</dd>
      ${r.lien_video ? `<dt>Vidéo</dt><dd><a href="${r.lien_video}" target="_blank" rel="noopener" style="color:var(--accent)">Voir l'enregistrement →</a></dd>` : ""}
    </dl>
    ${r.compte_rendu ? `
      <div class="divider"></div>
      <div class="card-title mb-2">Compte rendu</div>
      <div style="font-size:.88rem;line-height:1.7;white-space:pre-wrap">${r.compte_rendu}</div>` : ""}
    <div class="divider"></div>
    <div class="card-title mb-2" style="display:flex;align-items:center;gap:.75rem">
      Notes finales
      <span style="font-size:.75rem;font-weight:400;color:var(--muted)">sur 10</span>
      ${nf !== null ? `<span style="font-size:.88rem;font-weight:800;color:var(--accent);margin-left:auto">Moyenne : ${nf.toFixed(1)}/10</span>` : ""}
    </div>
    ${notesHtml}
    ${participants.length ? `<div style="margin-top:.75rem">
      <button class="btn btn-primary btn-sm" id="save-notes-btn">Enregistrer les notes</button>
    </div>` : ""}
  `;

  document.getElementById("save-notes-btn")?.addEventListener("click", async () => {
    const notes = {};
    document.querySelectorAll(".note-finale-input").forEach(inp => {
      const v = inp.value.trim();
      if (v !== "") notes[inp.dataset.membre] = Number(v);
    });
    try {
      await updateReunion(currentReunionId, { notes_finales: notes });
      const r = reunions.find(x => x.id === currentReunionId);
      if (r) r.notes_finales = notes;
      renderList();
      showToast("Notes enregistrées !", "success");
      // Refresh the note finale display
      openDetail(currentReunionId);
    } catch (e) { showToast("Erreur : " + e.message, "error"); }
  });
}

document.getElementById("detail-close").addEventListener("click", () => {
  document.getElementById("detail-overlay").classList.add("hidden");
  currentReunionId = null;
});
document.getElementById("detail-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) {
    document.getElementById("detail-overlay").classList.add("hidden");
    currentReunionId = null;
  }
});

document.getElementById("detail-edit").addEventListener("click", () => {
  const r = reunions.find(x => x.id === currentReunionId);
  if (r) openFormModal(r);
});

// ── Formulaire ajout / modification ───────────────────────────────

function updateLivreDisplay() {
  const mois = Number(document.getElementById("r-mois").value);
  const annee = Number(document.getElementById("r-annee").value);
  const livre = getLivreForMois(mois, annee);
  document.getElementById("r-livre-display").textContent = livre
    ? `📖 ${livre.titre}${livre.auteur ? ` — ${livre.auteur}` : ""}`
    : "Aucun livre élu pour ce mois";
}

function openFormModal(existing = null) {
  const isEdit = !!existing;
  editReunionId = existing?.id ?? null;
  document.getElementById("form-title").textContent = isEdit ? "Modifier la réunion" : "Ajouter une réunion";

  const now = new Date();
  document.getElementById("r-statut").value = existing?.statut ?? "prevue";
  document.getElementById("r-date").value = existing?.date?.seconds
    ? new Date(existing.date.seconds * 1000).toISOString().split("T")[0]
    : "";
  document.getElementById("r-mois").value = existing?.mois ?? (now.getMonth() + 1);
  document.getElementById("r-annee").value = existing?.annee ?? now.getFullYear();
  document.getElementById("r-compte-rendu").value = existing?.compte_rendu ?? "";
  document.getElementById("r-lien-video").value = existing?.lien_video ?? "";

  const selectedIds = new Set(existing?.participant_ids ?? membres.map(m => m.id));
  document.getElementById("r-membres-list").innerHTML = membres.map(m => `
    <label class="check-item">
      <input type="checkbox" name="r-membre" value="${m.id}" ${selectedIds.has(m.id) ? "checked" : ""}>
      ${m.nom}
    </label>`).join("");

  updateLivreDisplay();
  document.getElementById("detail-overlay").classList.add("hidden");
  document.getElementById("form-overlay").classList.remove("hidden");
}

document.getElementById("r-mois").addEventListener("change", updateLivreDisplay);
document.getElementById("r-annee").addEventListener("change", updateLivreDisplay);

document.getElementById("btn-add-reunion").addEventListener("click", () => openFormModal());
["form-close", "form-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => document.getElementById("form-overlay").classList.add("hidden"));
});
document.getElementById("form-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("form-overlay").classList.add("hidden");
});

document.getElementById("form-save").addEventListener("click", async () => {
  const mois = Number(document.getElementById("r-mois").value);
  const annee = Number(document.getElementById("r-annee").value);
  const livre = getLivreForMois(mois, annee);
  const participant_ids = [...document.querySelectorAll("input[name='r-membre']:checked")].map(el => el.value);
  const data = {
    statut: document.getElementById("r-statut").value,
    date: document.getElementById("r-date").value || null,
    mois,
    annee,
    livre_id: livre?.id ?? null,
    participant_ids,
    compte_rendu: document.getElementById("r-compte-rendu").value.trim(),
    lien_video: document.getElementById("r-lien-video").value.trim() || null,
  };
  try {
    if (editReunionId) {
      await updateReunion(editReunionId, data);
      reunions = await getReunions();
      showToast("Réunion modifiée !", "success");
      document.getElementById("form-overlay").classList.add("hidden");
      renderList();
      openDetail(editReunionId);
    } else {
      await addReunion(data);
      reunions = await getReunions();
      showToast("Réunion ajoutée !", "success");
      document.getElementById("form-overlay").classList.add("hidden");
      renderList();
    }
    editReunionId = null;
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
});

init().catch(console.error);
