import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMembres, getLivreById, getCommentairesForLivre, addCommentaire, updateCommentaire, updateLivre } from "./db.js";
import { formatDate, initiales, showToast } from "./utils.js";

await requireAuth();
initNav("");

const params = new URLSearchParams(window.location.search);
const livreId = params.get("livre");

let livre = null, membres = [], commentaires = [];
let filterMembre = "";

async function init() {
  if (!livreId) {
    document.getElementById("comments-container").innerHTML =
      `<div class="empty-state"><span class="big-icon">❓</span>Aucun livre spécifié.</div>`;
    return;
  }

  [livre, membres, commentaires] = await Promise.all([
    getLivreById(livreId),
    getMembres(),
    getCommentairesForLivre(livreId)
  ]);

  const titre = livre?.titre ?? "Livre";
  document.getElementById("page-title").textContent = `Commentaires — ${titre}`;
  document.title = `Commentaires — ${titre} — Club de lecture`;
  document.getElementById("page-subtitle").innerHTML =
    `<a href="bibliotheque.html?open=${livreId}" style="color:var(--accent);text-decoration:none">← Retour à la fiche</a>`;

  populateMembresFilter();
  populateMembresModal();
  renderComments();
  setupModal();
  setupSuivi();
}

function nomMembre(id) {
  return membres.find(m => m.id === id)?.nom ?? "—";
}

function formatAvancement(avancement) {
  if (avancement === null || avancement === undefined) return null;
  const unite = livre?.progression_unite || "";
  const total = livre?.progression_total || null;
  if (unite && total) return `${avancement}/${total} ${unite}`;
  if (unite) return `${avancement} ${unite}`;
  return `${avancement}`;
}

function advanceLabel() {
  const unite = livre?.progression_unite || "";
  const total = livre?.progression_total || null;
  return unite
    ? `${unite.charAt(0).toUpperCase() + unite.slice(1)} actuel(le)${total ? ` (sur ${total})` : ""}`
    : "Avancement (optionnel)";
}

function populateMembresFilter() {
  const sel = document.getElementById("filter-membre");
  const presentIds = [...new Set(commentaires.map(c => c.membre_id))];
  presentIds.forEach(id => {
    const nom = nomMembre(id);
    const opt = document.createElement("option");
    opt.value = id; opt.textContent = nom;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", e => { filterMembre = e.target.value; renderComments(); });
}

function populateMembresModal() {
  const sel = document.getElementById("comm-membre");
  sel.innerHTML = '<option value="">— Choisir —</option>';
  membres.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id; opt.textContent = m.nom;
    sel.appendChild(opt);
  });
}

function renderComments() {
  const container = document.getElementById("comments-container");
  const list = filterMembre
    ? commentaires.filter(c => c.membre_id === filterMembre)
    : commentaires;

  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><span class="big-icon">💬</span>${filterMembre ? "Aucun commentaire de ce membre." : "Aucun commentaire pour l'instant."}</div>`;
    return;
  }

  const lbl = advanceLabel();

  container.innerHTML = `<div class="comment-list">${list.map(c => {
    const avance = formatAvancement(c.avancement);
    const dateVal = c.date_commentaire?.seconds
      ? new Date(c.date_commentaire.seconds * 1000).toISOString().split("T")[0]
      : "";
    return `<div class="comment-card" data-id="${c.id}">
      <div class="comment-header">
        <div class="avatar" style="width:32px;height:32px;font-size:.78rem;flex-shrink:0">${initiales(nomMembre(c.membre_id))}</div>
        <div style="flex:1;min-width:0">
          <div class="comment-author">${nomMembre(c.membre_id)}${c.titre ? ` · <em style="font-weight:600;font-style:normal">${escapeHtml(c.titre)}</em>` : ""}</div>
          ${avance ? `<div class="comment-advance">${avance}</div>` : ""}
        </div>
        <div class="comment-date">${formatDate(c.date_commentaire)}</div>
        <span class="comment-arrow">▶</span>
      </div>
      <div class="comment-body hidden">
        <div class="comment-spoiler-warn">⚠️ Attention — potentiel spoiler</div>
        <div class="comment-text">${escapeHtml(c.contenu)}</div>
        <button class="btn btn-ghost btn-sm comment-edit-btn" style="margin-top:.6rem">✏️ Modifier</button>
        <div class="comment-edit-form hidden" style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border)">
          <div class="form-row" style="margin-bottom:.75rem">
            <div>
              <label style="display:block;font-size:.82rem;font-weight:500;color:var(--muted);margin-bottom:.35rem">Date</label>
              <input type="date" class="edit-date" value="${dateVal}">
            </div>
            <div>
              <label style="display:block;font-size:.82rem;font-weight:500;color:var(--muted);margin-bottom:.35rem">${escapeHtml(lbl)}</label>
              <input type="number" class="edit-advance" min="0" placeholder="0" value="${c.avancement ?? ""}">
            </div>
          </div>
          <div style="margin-bottom:.75rem">
            <label style="display:block;font-size:.82rem;font-weight:500;color:var(--muted);margin-bottom:.35rem">Titre <span style="font-weight:400">(visible sans cliquer — pas de spoil !)</span></label>
            <input type="text" class="edit-titre" placeholder="Titre du commentaire" value="${escapeHtml(c.titre ?? "")}">
          </div>
          <div style="margin-bottom:.75rem">
            <label style="display:block;font-size:.82rem;font-weight:500;color:var(--muted);margin-bottom:.35rem">Commentaire</label>
            <textarea class="edit-text" rows="5" style="resize:vertical">${escapeHtml(c.contenu)}</textarea>
          </div>
          <div style="display:flex;gap:.5rem;justify-content:flex-end">
            <button class="btn btn-secondary btn-sm comment-edit-cancel">Annuler</button>
            <button class="btn btn-primary btn-sm comment-edit-save">Enregistrer</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join("")}</div>`;

  container.querySelectorAll(".comment-card").forEach(card => {
    card.querySelector(".comment-header").addEventListener("click", () => {
      const body = card.querySelector(".comment-body");
      const arrow = card.querySelector(".comment-arrow");
      const isOpen = !body.classList.contains("hidden");
      body.classList.toggle("hidden", isOpen);
      card.querySelector(".comment-header").classList.toggle("open", !isOpen);
      arrow.textContent = isOpen ? "▶" : "▼";
    });

    card.querySelector(".comment-edit-btn").addEventListener("click", () => {
      card.querySelector(".comment-edit-form").classList.toggle("hidden");
    });

    card.querySelector(".comment-edit-cancel").addEventListener("click", () => {
      card.querySelector(".comment-edit-form").classList.add("hidden");
    });

    card.querySelector(".comment-edit-save").addEventListener("click", async () => {
      const commentId = card.dataset.id;
      const contenu = card.querySelector(".edit-text").value.trim();
      if (!contenu) { showToast("Le commentaire est vide.", "error"); return; }
      const titre = card.querySelector(".edit-titre").value.trim() || null;
      const dateVal = card.querySelector(".edit-date").value;
      const advVal = card.querySelector(".edit-advance").value;
      try {
        await updateCommentaire(commentId, {
          contenu,
          titre,
          date_commentaire: dateVal || null,
          avancement: advVal !== "" ? advVal : null,
        });
        showToast("Commentaire modifié !", "success");
        commentaires = await getCommentairesForLivre(livreId);
        renderComments();
      } catch (err) { showToast("Erreur : " + err.message, "error"); }
    });
  });
}

function escapeHtml(str) {
  return (str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function setupModal() {
  const overlay = document.getElementById("comment-overlay");
  document.getElementById("comm-advance-label").textContent = advanceLabel();

  document.getElementById("comm-titre-toggle").addEventListener("change", e => {
    document.getElementById("comm-titre-wrap").classList.toggle("hidden", !e.target.checked);
  });

  document.getElementById("btn-add-comment").addEventListener("click", () => {
    document.getElementById("comm-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("comm-advance").value = "";
    document.getElementById("comm-text").value = "";
    document.getElementById("comm-titre").value = "";
    document.getElementById("comm-titre-toggle").checked = false;
    document.getElementById("comm-titre-wrap").classList.add("hidden");
    overlay.classList.remove("hidden");
  });

  ["comm-close", "comm-cancel"].forEach(id => {
    document.getElementById(id).addEventListener("click", () => overlay.classList.add("hidden"));
  });
  overlay.addEventListener("click", e => { if (e.target === e.currentTarget) overlay.classList.add("hidden"); });

  document.getElementById("comm-save").addEventListener("click", async () => {
    const membre_id = document.getElementById("comm-membre").value;
    if (!membre_id) { showToast("Choisissez un membre.", "error"); return; }
    const contenu = document.getElementById("comm-text").value.trim();
    if (!contenu) { showToast("Le commentaire est vide.", "error"); return; }
    const date_commentaire = document.getElementById("comm-date").value || new Date().toISOString().split("T")[0];
    const avancement = document.getElementById("comm-advance").value;
    const titre = document.getElementById("comm-titre-toggle").checked ? document.getElementById("comm-titre").value : "";
    try {
      await addCommentaire({ livre_id: livreId, membre_id, date_commentaire, avancement, titre, contenu });
      showToast("Commentaire publié !", "success");
      overlay.classList.add("hidden");
      commentaires = await getCommentairesForLivre(livreId);
      renderComments();
    } catch (e) { showToast("Erreur : " + e.message, "error"); }
  });
}

function setupSuivi() {
  if (livre?.statut !== "elu") return;

  const bar = document.getElementById("suivi-bar");
  bar.classList.remove("hidden");
  refreshSuiviLabel();

  const overlay = document.getElementById("suivi-overlay");

  document.getElementById("btn-suivi").addEventListener("click", () => {
    document.getElementById("suivi-unite").value = livre?.progression_unite || "";
    document.getElementById("suivi-total").value = livre?.progression_total || "";
    overlay.classList.remove("hidden");
  });

  ["suivi-close", "suivi-cancel"].forEach(id => {
    document.getElementById(id).addEventListener("click", () => overlay.classList.add("hidden"));
  });
  overlay.addEventListener("click", e => { if (e.target === e.currentTarget) overlay.classList.add("hidden"); });

  document.getElementById("suivi-save").addEventListener("click", async () => {
    const unite = document.getElementById("suivi-unite").value.trim();
    const total = document.getElementById("suivi-total").value;
    try {
      await updateLivre(livreId, {
        progression_unite: unite || null,
        progression_total: total ? Number(total) : null,
      });
      livre = { ...livre, progression_unite: unite || null, progression_total: total ? Number(total) : null };
      overlay.classList.add("hidden");
      refreshSuiviLabel();
      renderComments();
      showToast("Suivi mis à jour !", "success");
    } catch (err) { showToast("Erreur : " + err.message, "error"); }
  });
}

function refreshSuiviLabel() {
  const unite = livre?.progression_unite || "";
  const total = livre?.progression_total || null;
  document.getElementById("suivi-label").textContent =
    unite ? `Suivi en ${unite}${total ? ` · ${total} max` : ""}` : "Aucun suivi configuré";
}

init().catch(console.error);
