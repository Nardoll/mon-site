import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMembres, getLivreById, getCommentairesForLivre, addCommentaire } from "./db.js";
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

  container.innerHTML = `<div class="comment-list">${list.map((c, i) => {
    const avance = formatAvancement(c.avancement);
    return `<div class="comment-card" data-idx="${i}">
      <div class="comment-header">
        <div class="avatar" style="width:32px;height:32px;font-size:.78rem;flex-shrink:0">${initiales(nomMembre(c.membre_id))}</div>
        <div style="flex:1;min-width:0">
          <div class="comment-author">${nomMembre(c.membre_id)}${c.titre ? ` · <em style="font-weight:600;font-style:normal">${escapeHtml(c.titre)}</em>` : ""}</div>
          ${avance ? `<div class="comment-advance">${avance}</div>` : ""}
        </div>
        <div class="comment-date">${formatDate(c.date_commentaire)}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-left:.5rem">▶</div>
      </div>
      <div class="comment-body hidden">
        <div class="comment-spoiler-warn">⚠️ Attention — potentiel spoiler</div>
        <div class="comment-text">${escapeHtml(c.contenu)}</div>
      </div>
    </div>`;
  }).join("")}</div>`;

  container.querySelectorAll(".comment-card").forEach(card => {
    card.querySelector(".comment-header").addEventListener("click", () => {
      const body = card.querySelector(".comment-body");
      const arrow = card.querySelector(".comment-header div:last-child");
      const isOpen = !body.classList.contains("hidden");
      body.classList.toggle("hidden", isOpen);
      card.querySelector(".comment-header").classList.toggle("open", !isOpen);
      arrow.textContent = isOpen ? "▶" : "▼";
    });
  });
}

function escapeHtml(str) {
  return (str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setupModal() {
  const overlay = document.getElementById("comment-overlay");
  const unite = livre?.progression_unite || "";
  const total = livre?.progression_total || null;
  const advLabel = unite
    ? `${unite.charAt(0).toUpperCase() + unite.slice(1)} actuel(le)${total ? ` (sur ${total})` : ""}`
    : "Avancement (optionnel)";
  document.getElementById("comm-advance-label").textContent = advLabel;

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

init().catch(console.error);
