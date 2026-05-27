import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getLivres, getMembres, addLivre, getVotes, getStatutsForLivre, updateLivreInfos, getReunions } from "./db.js";
import { formatDate, formatMois, STATUTS_LIVRE, showToast } from "./utils.js";

await requireAuth();
initNav("bibliotheque");

// ── Vue mode ───────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const viewMode = params.get("vue") === "table" ? "table" : "visual";
document.getElementById("view-visual").classList.toggle("hidden", viewMode === "table");
document.getElementById("view-table").classList.toggle("hidden", viewMode !== "table");

let livres = [], membres = [], votes = [], reunions = [];
let sortCol = "date_proposition", sortDir = "desc";
let filters = { search: "", statut: "", genre: "", propose: "" };

// ── Toggle infos IA ───────────────────────────────────────────────
const AI_KEY = "cl_bib_ai_infos";
const aiToggle = document.getElementById("ai-infos-toggle");
if (localStorage.getItem(AI_KEY) === "1") {
  aiToggle.checked = true;
  document.body.classList.add("ai-infos-visible");
}
aiToggle.addEventListener("change", () => {
  const on = aiToggle.checked;
  localStorage.setItem(AI_KEY, on ? "1" : "0");
  document.body.classList.toggle("ai-infos-visible", on);
});

const BADGE_PALETTE = [
  { bg: "#dcfce7", fg: "#166534" },
  { bg: "#dbeafe", fg: "#1e40af" },
  { bg: "#f3e8ff", fg: "#6b21a8" },
  { bg: "#ffedd5", fg: "#9a3412" },
  { bg: "#ccfbf1", fg: "#115e59" },
  { bg: "#fee2e2", fg: "#991b1b" },
];

function descBadge(desc) {
  if (!desc) return "";
  let h = 0;
  for (const c of desc) h = (h * 31 + c.charCodeAt(0)) | 0;
  const { bg, fg } = BADGE_PALETTE[Math.abs(h) % BADGE_PALETTE.length];
  return `<span class="desc-badge" style="background:${bg};color:${fg}">${desc}</span>`;
}
let currentFicheId = null;
let eluSortMode = "chron";

async function init() {
  [livres, membres, votes, reunions] = await Promise.all([getLivres(), getMembres(), getVotes(), getReunions()]);
  populateMembresFilter();
  populateGenreFilter();
  populateMembresPropose();
  if (viewMode === "table") renderTable();
  else renderVisual();
  const openId = params.get("open");
  if (openId) openFiche(openId);
}

function nomMembre(id) {
  return membres.find(m => m.id === id)?.nom ?? id ?? "—";
}

function detectScale(resultats) {
  const all = (resultats || []).flatMap(r => Object.values(r.notes || {})).map(Number).filter(n => !isNaN(n));
  return all.length && Math.max(...all) <= 5 ? 5 : 10;
}

function findVoteElim(livreId) {
  const sorted = [...votes].sort((a, b) => b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois);
  return sorted.find(v => (v.resultats || []).some(r => r.livre_id === livreId && r.moyenne !== null && r.moyenne <= 2.5));
}

function populateMembresFilter() {
  const sel = document.getElementById("filter-propose");
  membres.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id; opt.textContent = m.nom;
    sel.appendChild(opt);
  });
}

function populateGenreFilter() {
  const sel = document.getElementById("filter-genre");
  const genres = [...new Set(livres.map(l => l.genre).filter(Boolean))].sort();
  genres.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g; opt.textContent = g;
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

// ── Vue visuelle ───────────────────────────────────────────────────

function renderVisual() {
  const propositions = livres.filter(l => l.statut === "en_proposition");
  const refuses = livres.filter(l => l.statut === "refuse");

  // ── En proposition ──────────────────────────────────────────────
  const propGrid = document.getElementById("prop-grid");
  if (propositions.length) {
    propGrid.innerHTML = propositions.map(l => `
      <div class="prop-card" data-id="${l.id}">
        <div class="prop-card-title">${l.titre}</div>
        <div class="prop-card-author">${l.auteur || ""}</div>
        ${l.genre ? `<div class="prop-card-genre">${l.genre}</div>` : ""}
        ${l.nb_pages ? `<div class="prop-card-pages">${l.nb_pages} p.</div>` : ""}
        ${descBadge(l.description_3_mots)}
        <div class="prop-card-footer">
          <span>${nomMembre(l.propose_par)}</span>
          <span>${formatDate(l.date_proposition)}</span>
        </div>
      </div>`).join("");
    propGrid.querySelectorAll(".prop-card").forEach(c => c.addEventListener("click", () => openFiche(c.dataset.id)));
  } else {
    propGrid.innerHTML = `<div class="text-muted" style="font-size:.85rem">Aucun livre en proposition.</div>`;
  }

  // ── Élus ────────────────────────────────────────────────────────
  renderElusList();

  // ── Éliminés ────────────────────────────────────────────────────
  const elimGrid = document.getElementById("elim-grid");
  if (refuses.length) {
    elimGrid.innerHTML = refuses.map(l => {
      const v = findVoteElim(l.id);
      const r = v ? (v.resultats || []).find(x => x.livre_id === l.id) : null;
      const scale = v ? detectScale(v.resultats) : 10;
      const moy = r?.moyenne ?? null;
      return `<div class="elim-card" data-id="${l.id}">
        <div class="elim-card-title">${l.titre}</div>
        <div class="elim-card-author">${l.auteur || ""}</div>
        ${l.genre ? `<div class="prop-card-genre" style="margin-bottom:.2rem">${l.genre}</div>` : ""}
        ${descBadge(l.description_3_mots)}
        <div class="elim-card-footer">
          <span>${v ? formatMois(v.mois, v.annee) : "—"}</span>
          ${moy !== null ? `<span class="elim-score">${Number(moy).toFixed(1)}/${scale}</span>` : ""}
        </div>
      </div>`;
    }).join("");
    elimGrid.querySelectorAll(".elim-card").forEach(c => c.addEventListener("click", () => openFiche(c.dataset.id)));
  } else {
    elimGrid.innerHTML = `<div class="text-muted" style="font-size:.85rem">Aucun livre éliminé pour l'instant.</div>`;
  }
}

function notesFinalesMap() {
  const map = {};
  reunions.forEach(r => {
    if (!r.livre_id || !r.notes_finales) return;
    const notes = Object.values(r.notes_finales).map(Number).filter(n => !isNaN(n) && n > 0);
    if (notes.length) map[r.livre_id] = notes.reduce((a, b) => a + b, 0) / notes.length;
  });
  return map;
}

function renderElusList() {
  const nfMap = notesFinalesMap();
  const elusVotes = votes.filter(v => v.livre_elu);

  let sorted;
  if (eluSortMode === "note") {
    const avecNote = elusVotes.filter(v => nfMap[v.livre_elu] !== undefined)
      .sort((a, b) => nfMap[b.livre_elu] - nfMap[a.livre_elu]);
    const sansNote = elusVotes.filter(v => nfMap[v.livre_elu] === undefined)
      .sort((a, b) => b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois);
    sorted = [...avecNote, ...sansNote];
  } else {
    sorted = [...elusVotes].sort((a, b) => b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois);
  }

  const elusList = document.getElementById("elus-list");
  if (!sorted.length) {
    elusList.innerHTML = `<div class="text-muted" style="font-size:.85rem">Aucun livre élu pour l'instant.</div>`;
    return;
  }

  elusList.innerHTML = sorted.map(v => {
    const r = (v.resultats || []).find(x => x.livre_id === v.livre_elu);
    const scale = detectScale(v.resultats);
    const moy = r?.moyenne ?? null;
    const nf = nfMap[v.livre_elu] ?? null;
    return `<div class="bib-elu-item" data-id="${v.livre_elu}">
      <div class="bib-elu-month">${formatMois(v.mois, v.annee)}</div>
      <div class="bib-elu-info">
        <div class="bib-elu-title">${r?.titre ?? v.livre_elu}</div>
        ${r?.auteur ? `<div class="bib-elu-author">${r.auteur}</div>` : ""}
        ${(() => {
          const l = livres.find(x => x.id === v.livre_elu);
          return (l?.genre ? `<div class="bib-elu-genre">${l.genre}</div>` : "")
               + descBadge(l?.description_3_mots);
        })()}
      </div>
      <div class="bib-elu-scores">
        ${nf !== null
          ? `<div class="bib-elu-note-finale">${nf.toFixed(1)}<span class="bib-elu-note-label">/10 club</span></div>`
          : `<div class="bib-elu-no-note">Non noté</div>`}
        ${moy !== null ? `<div class="bib-elu-score-vote">Sélection : ${Number(moy).toFixed(1)}/${scale}</div>` : ""}
      </div>
    </div>`;
  }).join("");
  elusList.querySelectorAll(".bib-elu-item").forEach(el => el.addEventListener("click", () => openFiche(el.dataset.id)));
}

function updateSortEluButtons() {
  document.getElementById("sort-elu-chron").className = `btn btn-sm ${eluSortMode === "chron" ? "btn-primary" : "btn-secondary"}`;
  document.getElementById("sort-elu-note").className = `btn btn-sm ${eluSortMode === "note" ? "btn-primary" : "btn-secondary"}`;
}

document.getElementById("sort-elu-chron").addEventListener("click", () => { eluSortMode = "chron"; updateSortEluButtons(); renderElusList(); });
document.getElementById("sort-elu-note").addEventListener("click", () => { eluSortMode = "note"; updateSortEluButtons(); renderElusList(); });

// ── Vue table ──────────────────────────────────────────────────────

function filteredLivres() {
  return livres.filter(l => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!l.titre?.toLowerCase().includes(q)
        && !l.auteur?.toLowerCase().includes(q)
        && !l.genre?.toLowerCase().includes(q)
        && !l.description_3_mots?.toLowerCase().includes(q)) return false;
    }
    if (filters.statut && l.statut !== filters.statut) return false;
    if (filters.genre && l.genre !== filters.genre) return false;
    if (filters.propose && l.propose_par !== filters.propose) return false;
    return true;
  }).sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (sortCol === "date_proposition") { va = va?.seconds ?? 0; vb = vb?.seconds ?? 0; }
    else if (sortCol === "annee") { va = va ?? 0; vb = vb ?? 0; }
    else { va = (va ?? "").toString().toLowerCase(); vb = (vb ?? "").toString().toLowerCase(); }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

function renderTable() {
  const tbody = document.getElementById("livres-tbody");
  const list = filteredLivres();
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
    return `<tr class="livre-row" data-id="${l.id}" style="cursor:pointer">
      <td><strong>${l.titre}</strong></td>
      <td>${l.auteur || "—"}</td>
      <td>${l.annee || "—"}</td>
      <td>${l.genre ? `<span style="font-style:italic;font-size:.85em">${l.genre}</span>` : "—"}</td>
      <td>${nomMembre(l.propose_par)}</td>
      <td>${formatDate(l.date_proposition)}</td>
      <td><span class="badge badge-${st.css}">${st.label}</span></td>
    </tr>`;
  }).join("");
  tbody.querySelectorAll(".livre-row").forEach(row => row.addEventListener("click", () => openFiche(row.dataset.id)));
}

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
document.getElementById("filter-genre").addEventListener("change", e => { filters.genre = e.target.value; renderTable(); });
document.getElementById("filter-propose").addEventListener("change", e => { filters.propose = e.target.value; renderTable(); });

// ── Proposer un livre ──────────────────────────────────────────────

function openProposeModal() {
  document.getElementById("p-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("propose-overlay").classList.remove("hidden");
}

document.getElementById("btn-proposer").addEventListener("click", openProposeModal);
document.getElementById("btn-proposer-table").addEventListener("click", openProposeModal);

["propose-close", "propose-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => document.getElementById("propose-overlay").classList.add("hidden"));
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
      nb_pages: document.getElementById("p-nb-pages").value,
      genre: document.getElementById("p-genre").value.trim(),
      description_3_mots: document.getElementById("p-desc3").value.trim(),
    });
    showToast("Livre proposé !", "success");
    document.getElementById("propose-overlay").classList.add("hidden");
    ["p-titre", "p-auteur", "p-annee", "p-nb-pages", "p-genre", "p-desc3"].forEach(id => document.getElementById(id).value = "");
    livres = await getLivres();
    if (viewMode === "table") renderTable(); else renderVisual();
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
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
  const allNotes = votesDuLivre.flatMap(v =>
    (v.resultats || []).filter(r => r.livre_id === id).flatMap(r => Object.values(r.notes || {}))
  ).map(Number).filter(n => !isNaN(n));
  const scale = allNotes.length && Math.max(...allNotes) <= 5 ? 5 : 10;

  // Avancements membres (élu seulement)
  let avancementsHTML = "";
  if (livre.statut === "elu") {
    const rows = membres.map(m => {
      const s = statuts.find(x => x.membre_id === m.id);
      const label = s
        ? s.statut === "termine" ? "✅ Terminé"
        : s.statut === "en_cours" ? `📖 En cours (${s.page_actuelle ?? "?"}p)`
        : s.statut === "achete" ? "🛒 Acheté"
        : "—"
        : "—";
      return `<tr><td>${m.nom}</td><td>${label}</td></tr>`;
    }).join("");
    avancementsHTML = `
      <div class="divider"></div>
      <div class="card-title mb-2">Avancements membres</div>
      <div class="table-wrap mb-3"><table><thead><tr><th>Membre</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // Chronologie
  const tlItems = [{ dot: "default", label: `Proposé le ${formatDate(livre.date_proposition)}`, detail: `par ${nomMembre(livre.propose_par)}` }];
  for (const v of votesDuLivre) {
    const r = (v.resultats || []).find(x => x.livre_id === id);
    if (!r) continue;
    const moy = r.moyenne !== null && r.moyenne !== undefined ? Number(r.moyenne).toFixed(2) : "—";
    const isElu = v.livre_elu === id;
    const isElim = !isElu && r.moyenne !== null && r.moyenne <= 2.5;
    tlItems.push({ dot: isElu ? "elu" : isElim ? "refuse" : "default", label: `Vote de ${formatMois(v.mois, v.annee)}`, detail: `Note moyenne : ${moy} / ${scale}` });
  }
  if (livre.statut === "elu") {
    const voteElu = votesDuLivre.find(v => v.livre_elu === id);
    tlItems.push({ dot: "elu", label: `Élu${voteElu ? ` en ${formatMois(voteElu.mois, voteElu.annee)}` : ""}`, detail: null, final: true });
  } else if (livre.statut === "refuse") {
    const voteElim = findVoteElim(id);
    tlItems.push({ dot: "refuse", label: `Éliminé${voteElim ? ` en ${formatMois(voteElim.mois, voteElim.annee)}` : ""}`, detail: null, final: true });
  }

  const tlHTML = `<div class="ft-timeline">${tlItems.map(item => `
    <div class="ft-item">
      <div class="ft-dot ft-dot-${item.dot}"></div>
      <div class="ft-body">
        <div class="ft-label ${item.final ? "ft-label-final ft-final-" + item.dot : ""}">${item.label}</div>
        ${item.detail ? `<div class="ft-detail">${item.detail}</div>` : ""}
      </div>
    </div>`).join("")}</div>`;

  // Réunion associée
  const reunion = reunions.find(r => r.livre_id === id);
  let reunionHTML = "";
  if (reunion) {
    const nf = (() => {
      const vals = Object.values(reunion.notes_finales || {}).map(Number).filter(n => !isNaN(n) && n > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    })();
    const participants = reunion.participant_ids || [];
    const notesParParticipant = participants.map(memId => {
      const note = reunion.notes_finales?.[memId];
      return `<span style="font-size:.8rem">${nomMembre(memId)}${note ? ` <strong style="color:var(--accent)">${Number(note).toFixed(1)}/10</strong>` : ""}</span>`;
    }).join(" · ");
    reunionHTML = `
      <div class="divider"></div>
      <div class="card-title mb-2">📝 Réunion</div>
      <div style="font-size:.85rem;line-height:1.8">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
          <span style="color:var(--muted)">${reunion.date ? formatDate(reunion.date) : "Date non fixée"} · ${participants.length} participant${participants.length > 1 ? "s" : ""}</span>
          ${nf !== null ? `<strong style="font-size:1rem;color:var(--accent)">${nf.toFixed(1)}/10</strong>` : ""}
        </div>
        ${participants.length ? `<div style="margin-top:.4rem;color:var(--muted)">${notesParParticipant}</div>` : ""}
      </div>
      <div style="margin-top:.75rem">
        <a href="reunions.html?open=${reunion.id}" class="btn btn-secondary btn-sm">📝 Voir la fiche réunion →</a>
      </div>`;
  }

  document.getElementById("fiche-content").innerHTML = `
    <dl class="book-detail-meta">
      <dt>Auteur</dt><dd>${livre.auteur || "—"}</dd>
      <dt>Année</dt><dd>${livre.annee || "—"}</dd>
      <dt>Proposé par</dt><dd>${nomMembre(livre.propose_par)}</dd>
      <dt>Date</dt><dd>${formatDate(livre.date_proposition)}</dd>
      <dt>Statut</dt><dd><span class="badge badge-${st.css}">${st.label}</span></dd>
      <dt>Pages</dt><dd>${livre.nb_pages ? livre.nb_pages + " p." : "—"}</dd>
      <dt>Genre</dt><dd>${livre.genre || "—"}</dd>
      <dt>En 3 mots</dt><dd>${livre.description_3_mots || "—"}</dd>
    </dl>
    <div style="font-size:.75rem;color:var(--muted);margin-bottom:1.25rem">⚠️ Pages, genre et description fournis par IA — à vérifier</div>
    ${avancementsHTML}
    <div class="divider"></div>
    <div class="card-title mb-2">Historique</div>
    ${tlHTML}
    ${reunionHTML}
    <div style="height:1px;background:var(--border);margin:1.5rem 0"></div>
    <div style="text-align:center">
      <a href="commentaires.html?livre=${id}" class="btn btn-secondary btn-sm">💬 Commentaires de lecture</a>
    </div>
  `;
}

document.getElementById("fiche-close").addEventListener("click", () => document.getElementById("fiche-overlay").classList.add("hidden"));
document.getElementById("fiche-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("fiche-overlay").classList.add("hidden");
});

// ── Modifier fiche livre ───────────────────────────────────────────

function showFicheEditForm(livre) {
  const membresOptions = membres.map(m => `<option value="${m.id}">${m.nom}</option>`).join("");
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
    <div style="margin-top:.75rem;padding:.85rem;background:var(--bg-alt,#f5f5f5);border-radius:8px;border:1px solid var(--border)">
      <div style="font-size:.77rem;color:var(--muted);margin-bottom:.75rem;line-height:1.4">⚠️ Infos générées par IA — à vérifier, surtout le nombre de pages au moment où le livre est élu.</div>
      <div class="form-row" style="margin-bottom:.75rem">
        <div class="form-group" style="margin-bottom:0">
          <label>Nb de pages</label>
          <input type="number" id="edit-l-nb-pages" min="1" placeholder="optionnel">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label>Genre littéraire</label>
          <input type="text" id="edit-l-genre" placeholder="ex : Roman historique">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label>Description en 3 mots</label>
        <input type="text" id="edit-l-desc3" maxlength="60" placeholder="ex : amour, guerre, trahison">
      </div>
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
  document.getElementById("edit-l-nb-pages").value = livre.nb_pages || "";
  document.getElementById("edit-l-genre").value = livre.genre || "";
  document.getElementById("edit-l-desc3").value = livre.description_3_mots || "";
  if (livre.date_proposition) {
    document.getElementById("edit-l-date").value = new Date(livre.date_proposition.seconds * 1000).toISOString().split("T")[0];
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
        nb_pages: document.getElementById("edit-l-nb-pages").value,
        genre: document.getElementById("edit-l-genre").value.trim(),
        description_3_mots: document.getElementById("edit-l-desc3").value.trim(),
      });
      showToast("Livre modifié !", "success");
      livres = await getLivres();
      if (viewMode === "table") renderTable(); else renderVisual();
      openFiche(currentFicheId);
    } catch (e) { showToast("Erreur : " + e.message, "error"); }
  });
}

document.getElementById("fiche-edit").addEventListener("click", () => {
  const livre = livres.find(l => l.id === currentFicheId);
  if (livre) showFicheEditForm(livre);
});

// ── Copier la liste des propositions ───────────────────────────────

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function tsToDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
}

document.getElementById("btn-copy-props").addEventListener("click", () => {
  const propositions = livres.filter(l => l.statut === "en_proposition");
  if (!propositions.length) { showToast("Aucune proposition à copier.", "error"); return; }

  const lines = propositions.map(l => {
    let line = `- ${l.titre}`;
    if (l.auteur) line += ` de ${l.auteur}`;
    if (l.annee)  line += ` (${l.annee})`;
    const d = tsToDate(l.date_proposition);
    if (d) line += ` - depuis ${MOIS_FR[d.getMonth()]}`;
    return line;
  });

  const text = `Propositions de livres actuellement enregistrée :\n${lines.join('\n')}`;
  navigator.clipboard.writeText(text)
    .then(() => showToast("Liste copiée dans le presse-papier !", "success"))
    .catch(() => showToast("Impossible de copier.", "error"));
});

init().catch(console.error);
