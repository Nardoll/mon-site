import { requireAuth } from "./auth.js?v=2";
import { initNav } from "./nav.js?v=2";
import { escapeHtml, formatDate, showToast } from "./utils.js?v=2";
import { getWikiEntries, addWikiEntry, updateWikiEntry, deleteWikiEntry, WIKI_CATEGORIES, deleteCellule } from "./db.js?v=2";

await requireAuth();
initNav("wiki");

// ─── État ─────────────────────────────────────────────────────────────────────

let allEntries = [];
let activeCategory = "Tous";
let searchQuery = "";

// SOURCE_ICONS doit être avant le await qui appelle renderList()
const SOURCE_ICONS = { oracle: "🔮", cellule: "🗺️", evenement: "⚡", manuel: "✍️" };

// ─── Init ─────────────────────────────────────────────────────────────────────

try {
  allEntries = await getWikiEntries();
  console.log(`Wiki: ${allEntries.length} entrée(s) chargée(s)`);
} catch (e) {
  console.error("getWikiEntries échec:", e);
  document.getElementById("wiki-list").innerHTML =
    `<div class="wiki-empty" style="color:var(--danger)">Erreur Firestore — voir la console (F12)</div>`;
}
renderCategoryTabs();
renderList();

// ─── Onglets catégories ───────────────────────────────────────────────────────

function renderCategoryTabs() {
  const tabs = document.getElementById("wiki-cat-tabs");
  const all = ["Tous", ...WIKI_CATEGORIES];
  tabs.innerHTML = all.map(cat => `
    <button class="wiki-cat-tab ${cat === activeCategory ? "active" : ""}" data-cat="${cat}">
      ${escapeHtml(cat)}
      <span style="opacity:.6;font-size:.72rem;margin-left:.3rem">${catCount(cat)}</span>
    </button>
  `).join("");

  tabs.querySelectorAll(".wiki-cat-tab").forEach(el => {
    el.addEventListener("click", () => {
      activeCategory = el.dataset.cat;
      renderCategoryTabs();
      renderList();
    });
  });
}

function catCount(cat) {
  if (cat === "Tous") return allEntries.length;
  return allEntries.filter(e => e.categorie === cat).length;
}

// ─── Recherche ────────────────────────────────────────────────────────────────

document.getElementById("wiki-search").addEventListener("input", e => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderList();
});

// ─── Liste ────────────────────────────────────────────────────────────────────

function filteredEntries() {
  return allEntries.filter(e => {
    if (activeCategory !== "Tous" && e.categorie !== activeCategory) return false;
    if (searchQuery) {
      const haystack = [e.titre, e.contenu, ...(e.mots_cles || [])].join(" ").toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  }).sort((a, b) => {
    // Tri : d'abord par catégorie, puis par titre
    if (a.categorie < b.categorie) return -1;
    if (a.categorie > b.categorie) return 1;
    return (a.titre || "").localeCompare(b.titre || "");
  });
}

function renderList() {
  const entries = filteredEntries();
  const list = document.getElementById("wiki-list");

  if (!entries.length) {
    list.innerHTML = `<div class="wiki-empty">Aucune entrée trouvée.</div>`;
    return;
  }

  list.innerHTML = entries.map(e => `
    <div class="wiki-item" data-id="${e.id}">
      <div class="wiki-item-body">
        <div class="wiki-item-title">${escapeHtml(e.titre || "Sans titre")}</div>
        <div class="wiki-item-meta">
          ${SOURCE_ICONS[e.source_type] || "✍️"} ${escapeHtml(e.categorie)}
          ${e.cree_le ? " · " + formatDate(e.cree_le) : ""}
        </div>
        ${e.mots_cles?.length ? `
          <div class="wiki-item-chips">
            ${e.mots_cles.slice(0, 5).map(m => `<span class="wiki-item-chip">${escapeHtml(m)}</span>`).join("")}
          </div>
        ` : ""}
      </div>
      <span class="wiki-cat-badge">${escapeHtml(e.categorie)}</span>
    </div>
  `).join("");

  list.querySelectorAll(".wiki-item").forEach(el => {
    el.addEventListener("click", () => {
      const entry = allEntries.find(e => e.id === el.dataset.id);
      if (entry) openDetailModal(entry);
    });
  });
}

// ─── Modal détail ─────────────────────────────────────────────────────────────

let currentEntry = null;

function openDetailModal(entry) {
  currentEntry = entry;
  renderDetailView(entry);
  document.getElementById("wiki-detail-overlay").classList.remove("hidden");
}

function renderDetailView(entry) {
  const body = document.getElementById("wiki-detail-body");
  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
      <span class="wiki-cat-badge">${escapeHtml(entry.categorie)}</span>
      <div style="display:flex;gap:.4rem">
        <button class="btn btn-secondary" id="wiki-edit-btn" style="font-size:.8rem;padding:.4rem .75rem">✏️ Modifier</button>
        <button class="btn btn-danger" id="wiki-del-btn" style="font-size:.8rem;padding:.4rem .75rem">🗑️ Supprimer</button>
      </div>
    </div>
    ${entry.mots_cles?.length ? `
      <div class="chips-row">
        ${entry.mots_cles.map(m => `<span class="chip">${escapeHtml(m)}</span>`).join("")}
      </div>
    ` : ""}
    <div class="wiki-modal-content">${escapeHtml(entry.contenu || "")}</div>
    <div style="font-size:.75rem;color:var(--muted2);border-top:1px solid var(--border);padding-top:.5rem">
      ${entry.cree_le ? "Créé le " + formatDate(entry.cree_le) : ""}
      ${entry.mis_a_jour ? " · Modifié le " + formatDate(entry.mis_a_jour) : ""}
      ${entry.source_type ? ` · Source : ${SOURCE_ICONS[entry.source_type] || ""} ${entry.source_type}` : ""}
    </div>
  `;

  document.getElementById("wiki-detail-title").textContent = entry.titre || "Sans titre";

  document.getElementById("wiki-edit-btn")?.addEventListener("click", () => openEditModal(entry));
  document.getElementById("wiki-del-btn")?.addEventListener("click", () => confirmDelete(entry));
}

document.getElementById("wiki-detail-close").addEventListener("click", () => {
  document.getElementById("wiki-detail-overlay").classList.add("hidden");
  currentEntry = null;
});

// ─── Modal édition ────────────────────────────────────────────────────────────

function openEditModal(entry) {
  document.getElementById("edit-titre").value = entry.titre || "";
  document.getElementById("edit-categorie").value = entry.categorie || WIKI_CATEGORIES[0];
  document.getElementById("edit-mots-cles").value = (entry.mots_cles || []).join(", ");
  document.getElementById("edit-contenu").value = entry.contenu || "";
  document.getElementById("wiki-edit-overlay").classList.remove("hidden");
}

document.getElementById("wiki-edit-close").addEventListener("click", () => {
  document.getElementById("wiki-edit-overlay").classList.add("hidden");
});

document.getElementById("wiki-edit-save").addEventListener("click", async () => {
  const titre = document.getElementById("edit-titre").value.trim();
  const categorie = document.getElementById("edit-categorie").value;
  const motsClesStr = document.getElementById("edit-mots-cles").value;
  const contenu = document.getElementById("edit-contenu").value.trim();
  if (!contenu) { showToast("Le contenu est requis.", "error"); return; }

  const motsCles = motsClesStr.split(",").map(m => m.trim()).filter(Boolean);
  const btn = document.getElementById("wiki-edit-save");
  btn.disabled = true;
  btn.textContent = "Sauvegarde…";

  try {
    if (currentEntry) {
      // Mise à jour
      await updateWikiEntry(currentEntry.id, { titre, categorie, mots_cles: motsCles, contenu });
      currentEntry = { ...currentEntry, titre, categorie, mots_cles: motsCles, contenu };
      allEntries = allEntries.map(e => e.id === currentEntry.id ? { ...e, titre, categorie, mots_cles: motsCles, contenu } : e);
      document.getElementById("wiki-edit-overlay").classList.add("hidden");
      renderDetailView(currentEntry);
      showToast("Fiche mise à jour !");
    } else {
      // Création
      const id = await addWikiEntry({ categorie, titre, mots_cles: motsCles, contenu, source_type: "manuel" });
      const newEntry = { id, categorie, titre, mots_cles: motsCles, contenu, source_type: "manuel" };
      allEntries.push(newEntry);
      document.getElementById("wiki-edit-overlay").classList.add("hidden");
      showToast("Fiche ajoutée au wiki !");
    }
    renderCategoryTabs();
    renderList();
  } catch (e) {
    showToast("Erreur lors de la sauvegarde.", "error");
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sauvegarder →";
  }
});

// ─── Suppression ──────────────────────────────────────────────────────────────

async function confirmDelete(entry) {
  const label = entry.titre || "cette fiche";
  const extra = entry.categorie === "Lieux" ? "\nLa cellule correspondante sera aussi supprimée de la carte." : "";
  if (!confirm(`Supprimer "${label}" ?${extra}\nCette action est irréversible.`)) return;
  try {
    await deleteWikiEntry(entry.id);
    if (entry.categorie === "Lieux" && entry.cellule_id) {
      await deleteCellule(entry.cellule_id);
    }
    allEntries = allEntries.filter(e => e.id !== entry.id);
    document.getElementById("wiki-detail-overlay").classList.add("hidden");
    document.getElementById("wiki-edit-overlay").classList.add("hidden");
    currentEntry = null;
    renderCategoryTabs();
    renderList();
    showToast("Fiche supprimée.");
  } catch (e) {
    showToast("Erreur lors de la suppression.", "error");
  }
}

// ─── Ajout manuel ─────────────────────────────────────────────────────────────

document.getElementById("btn-add-wiki")?.addEventListener("click", () => {
  currentEntry = null;
  document.getElementById("edit-titre").value = "";
  document.getElementById("edit-categorie").value = WIKI_CATEGORIES[0];
  document.getElementById("edit-mots-cles").value = "";
  document.getElementById("edit-contenu").value = "";
  document.getElementById("wiki-edit-overlay").classList.remove("hidden");
});
