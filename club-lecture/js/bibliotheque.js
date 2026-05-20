import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getLivres, getMembres, addLivre, getVotes, getStatutsForLivre, updateLivreInfos } from "./db.js";
import { formatDate, formatMois, STATUTS_LIVRE, showToast } from "./utils.js";

await requireAuth();
initNav("bibliotheque");

let livres = [], membres = [], votes = [];
let sortCol = "date_proposition", sortDir = "desc";
let filters = { search: "", statut: "", propose: "" };
let currentFicheId = null;

async function init() {
  [livres, membres, votes] = await Promise.all([getLivres(), getMembres(), getVotes()]);
  populateMembresFilter();
  populateMembresPropose();
  renderTable();
  const openId = new URLSearchParams(window.location.search).get("open");
  if (openId) openFiche(openId);
}

function nomMembre(id) {
  return membres.find(m => m.id === id)?.nom ?? id ?? "—";
}

function populateMembresFilter() {
  const sel = document.getElementById("filter-propose");
  membres.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id; opt.textContent = m.nom;
    sel.appendChild(opt);
  });
}

function populateMembresPropose() {
  const sel = document.getElementById("p-membre");
  sel.innerHTML = '<option value="">— Choisir —</option>';
  membres.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id; opt.textContent = m.nom;
    sel.appendChild(opt);
  });
}

// ── Table ──────────────────────────────────────────────────────────

function filteredLivres() {
  return livres.filter(l => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!l.titre?.toLowerCase().includes(q) && !l.auteur?.toLowerCase().includes(q)) return false;
    }
    if (filters.statut && l.statut !== filters.statut) return false;
    if (filters.propose && l.propose_par !== filters.propose) return false;
    return true;
  }).sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (sortCol === "date_proposition") {
      va = va?.seconds ?? 0; vb = vb?.seconds ?? 0;
    } else if (sortCol === "annee") {
      va = va ?? 0; vb = vb ?? 0;
    } else {
      va = (va ?? "").toString().toLowerCase();
      vb = (vb ?? "").toString().toLowerCase();
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

function renderTable() {
  const tbody = document.getElementById("livres-tbody");
  const list = filteredLivres();

  // Update sort indicators
  document.querySelectorAll("#livres-table th").forEach(th => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.col === sortCol) th.classList.add(`sort-${sortDir}`);
  });

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Aucun livre trouvé.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(l => {
    const st = STATUTS_LIVRE[l.statut] ?? STATUTS_LIVRE.en_proposition;
    return `
      <tr class="livre-row" data-id="${l.id}" style="cursor:pointer">
        <td><strong>${l.titre}</strong></td>
        <td>${l.auteur || "—"}</td>
        <td>${l.annee || "—"}</td>
        <td>${nomMembre(l.propose_par)}</td>
        <td>${formatDate(l.date_proposition)}</td>
        <td><span class="badge badge-${st.css}">${st.label}</span></td>
      </tr>`;
  }).join("");

  tbody.querySelectorAll(".livre-row").forEach(row => {
    row.addEventListener("click", () => openFiche(row.dataset.id));
  });
}

// ── Sort & Filters ─────────────────────────────────────────────────

document.querySelectorAll("#livres-table th").forEach(th => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    if (sortCol === col) sortDir = sortDir === "asc" ? "desc" : "asc";
    else { sortCol = col; sortDir = "asc"; }
    renderTable();
  });
});

document.getElementById("filter-search").addEventListener("input", e => { filters.search = e.target.value; renderTable(); });
document.getElementById("filter-statut").addEventListener("change", e => { filters.statut = e.target.value; renderTable(); });
document.getElementById("filter-propose").addEventListener("change", e => { filters.propose = e.target.value; renderTable(); });

// ── Proposer un livre modal ────────────────────────────────────────

document.getElementById("btn-proposer").addEventListener("click", () => {
  document.getElementById("p-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("propose-overlay").classList.remove("hidden");
});

["propose-close","propose-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => {
    document.getElementById("propose-overlay").classList.add("hidden");
  });
});

document.getElementById("propose-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("propose-overlay").classList.add("hidden");
});

document.getElementById("propose-save").addEventListener("click", async () => {
  const titre = document.getElementById("p-titre").value.trim();
  if (!titre) { showToast("Le titre est obligatoire.", "error"); return; }
  const propose_par = document.getElementById("p-membre").value;
  if (!propose_par) { showToast("Choisissez un membre.", "error"); return; }

  try {
    await addLivre({
      titre,
      auteur: document.getElementById("p-auteur").value.trim(),
      annee: document.getElementById("p-annee").value,
      propose_par,
      date_proposition: document.getElementById("p-date").value,
    });
    showToast("Livre proposé !", "success");
    document.getElementById("propose-overlay").classList.add("hidden");
    // Reset
    ["p-titre","p-auteur","p-annee"].forEach(id => document.getElementById(id).value = "");
    livres = await getLivres();
    renderTable();
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
});

// ── Fiche livre ────────────────────────────────────────────────────

async function openFiche(id) {
  currentFicheId = id;
  const livre = livres.find(l => l.id === id);
  if (!livre) return;

  document.getElementById("fiche-titre").textContent = livre.titre;
  document.getElementById("fiche-content").innerHTML = `<div class="loading">Chargement…</div>`;
  document.getElementById("fiche-overlay").classList.remove("hidden");

  const statuts = livre.statut === "elu" ? await getStatutsForLivre(id) : [];
  const votesDuLivre = votes
    .filter(v => (v.resultats || []).some(r => r.livre_id === id))
    .sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);

  const st = STATUTS_LIVRE[livre.statut] ?? STATUTS_LIVRE.en_proposition;

  // Detect scale from vote data
  const allNotes = votesDuLivre.flatMap(v =>
    (v.resultats || []).filter(r => r.livre_id === id).flatMap(r => Object.values(r.notes || {}))
  ).map(Number).filter(n => !isNaN(n));
  const scale = allNotes.length && Math.max(...allNotes) <= 5 ? 5 : 10;

  // ── Avancements membres (élu seulement) ───
  let avancementsHTML = "";
  if (livre.statut === "elu") {
    const rows = membres.map(m => {
      const s = statuts.find(x => x.membre_id === m.id);
      const label = s
        ? s.statut === "termine" ? "✅ Terminé"
        : s.statut === "en_cours" ? `📖 En cours (${s.page_actuelle ?? "?"}p)`
        : s.statut === "achete"   ? "🛒 Acheté"
        : "—"
        : "—";
      return `<tr><td>${m.nom}</td><td>${label}</td></tr>`;
    }).join("");
    avancementsHTML = `
      <div class="divider"></div>
      <div class="card-title mb-2">Avancements membres</div>
      <div class="table-wrap mb-3">
        <table><thead><tr><th>Membre</th><th>Statut</th></tr></thead>
        <tbody>${rows}</tbody></table>
      </div>`;
  }

  // ── Chronologie ───────────────────────────
  const tlItems = [];

  // 1. Proposition
  tlItems.push({
    dot: "default",
    label: `Proposé le ${formatDate(livre.date_proposition)}`,
    detail: `par ${nomMembre(livre.propose_par)}`
  });

  // 2. Votes
  for (const v of votesDuLivre) {
    const r = (v.resultats || []).find(x => x.livre_id === id);
    if (!r) continue;
    const moy = r.moyenne !== null && r.moyenne !== undefined ? Number(r.moyenne).toFixed(2) : "—";
    const isElu = v.livre_elu === id;
    const isElim = !isElu && r.moyenne !== null && r.moyenne <= 2.5;
    tlItems.push({
      dot: isElu ? "elu" : isElim ? "refuse" : "default",
      label: `Vote de ${formatMois(v.mois, v.annee)}`,
      detail: `Note moyenne : ${moy} / ${scale}`
    });
  }

  // 3. Résultat final
  if (livre.statut === "elu") {
    const voteElu = votesDuLivre.find(v => v.livre_elu === id);
    tlItems.push({
      dot: "elu",
      label: `Élu${voteElu ? ` en ${formatMois(voteElu.mois, voteElu.annee)}` : ""}`,
      detail: null,
      final: true
    });
  } else if (livre.statut === "refuse") {
    const voteElim = votesDuLivre.findLast(v =>
      (v.resultats || []).some(r => r.livre_id === id && r.moyenne !== null && r.moyenne <= 2.5)
    );
    tlItems.push({
      dot: "refuse",
      label: `Éliminé${voteElim ? ` en ${formatMois(voteElim.mois, voteElim.annee)}` : ""}`,
      detail: null,
      final: true
    });
  }

  const tlHTML = `
    <div class="ft-timeline">
      ${tlItems.map(item => `
        <div class="ft-item">
          <div class="ft-dot ft-dot-${item.dot}"></div>
          <div class="ft-body">
            <div class="ft-label ${item.final ? "ft-label-final ft-final-" + item.dot : ""}">${item.label}</div>
            ${item.detail ? `<div class="ft-detail">${item.detail}</div>` : ""}
          </div>
        </div>`).join("")}
    </div>`;

  document.getElementById("fiche-content").innerHTML = `
    <dl class="book-detail-meta">
      <dt>Auteur</dt><dd>${livre.auteur || "—"}</dd>
      <dt>Année</dt><dd>${livre.annee || "—"}</dd>
      <dt>Proposé par</dt><dd>${nomMembre(livre.propose_par)}</dd>
      <dt>Date</dt><dd>${formatDate(livre.date_proposition)}</dd>
      <dt>Statut</dt><dd><span class="badge badge-${st.css}">${st.label}</span></dd>
    </dl>
    ${avancementsHTML}
    <div class="divider"></div>
    <div class="card-title mb-2">Historique</div>
    ${tlHTML}
  `;
}

document.getElementById("fiche-close").addEventListener("click", () => document.getElementById("fiche-overlay").classList.add("hidden"));
document.getElementById("fiche-overlay").addEventListener("click", e => { if (e.target === e.currentTarget) document.getElementById("fiche-overlay").classList.add("hidden"); });

// ── Modifier fiche livre ───────────────────────────────────────────

function showFicheEditForm(livre) {
  const membresOptions = membres.map(m =>
    `<option value="${m.id}">${m.nom}</option>`
  ).join("");

  document.getElementById("fiche-titre").textContent = "Modifier le livre";
  document.getElementById("fiche-content").innerHTML = `
    <div class="form-group">
      <label>Titre <span style="color:var(--red)">*</span></label>
      <input type="text" id="edit-l-titre">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Auteur</label>
        <input type="text" id="edit-l-auteur">
      </div>
      <div class="form-group">
        <label>Année</label>
        <input type="number" id="edit-l-annee" min="1000" max="2099">
      </div>
    </div>
    <div class="form-group">
      <label>Proposé par</label>
      <select id="edit-l-membre">${membresOptions}</select>
    </div>
    <div class="form-group">
      <label>Date de proposition</label>
      <input type="date" id="edit-l-date">
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="edit-l-cancel">Annuler</button>
      <button class="btn btn-primary" id="edit-l-save">Enregistrer</button>
    </div>
  `;

  document.getElementById("edit-l-titre").value = livre.titre || "";
  document.getElementById("edit-l-auteur").value = livre.auteur || "";
  document.getElementById("edit-l-annee").value = livre.annee || "";
  document.getElementById("edit-l-membre").value = livre.propose_par || "";
  if (livre.date_proposition) {
    const d = new Date(livre.date_proposition.seconds * 1000);
    document.getElementById("edit-l-date").value = d.toISOString().split("T")[0];
  }

  document.getElementById("edit-l-cancel").addEventListener("click", () => openFiche(currentFicheId));
  document.getElementById("edit-l-save").addEventListener("click", async () => {
    const titre = document.getElementById("edit-l-titre").value.trim();
    if (!titre) { showToast("Le titre est obligatoire.", "error"); return; }
    const dateVal = document.getElementById("edit-l-date").value;
    if (!dateVal) { showToast("La date est obligatoire.", "error"); return; }
    try {
      await updateLivreInfos(currentFicheId, {
        titre,
        auteur: document.getElementById("edit-l-auteur").value.trim(),
        annee: document.getElementById("edit-l-annee").value,
        propose_par: document.getElementById("edit-l-membre").value,
        date_proposition: dateVal,
      });
      showToast("Livre modifié !", "success");
      livres = await getLivres();
      renderTable();
      openFiche(currentFicheId);
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  });
}

document.getElementById("fiche-edit").addEventListener("click", () => {
  const livre = livres.find(l => l.id === currentFicheId);
  if (livre) showFicheEditForm(livre);
});

init().catch(console.error);
