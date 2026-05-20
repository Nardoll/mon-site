import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getLivres, getMembres, addLivre, getVotes, getStatutsForLivre } from "./db.js";
import { formatDate, STATUTS_LIVRE, showToast } from "./utils.js";

await requireAuth();
initNav("bibliotheque");

let livres = [], membres = [], votes = [];
let sortCol = "date_proposition", sortDir = "desc";
let filters = { search: "", statut: "", propose: "" };

async function init() {
  [livres, membres, votes] = await Promise.all([getLivres(), getMembres(), getVotes()]);
  populateMembresFilter();
  populateMembresPropose();
  renderTable();
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
  const livre = livres.find(l => l.id === id);
  if (!livre) return;

  document.getElementById("fiche-titre").textContent = livre.titre;
  document.getElementById("fiche-content").innerHTML = `<div class="loading">Chargement…</div>`;
  document.getElementById("fiche-overlay").classList.remove("hidden");

  const [statuts, votesDuLivre] = await Promise.all([
    getStatutsForLivre(id),
    Promise.resolve(votes.filter(v => (v.resultats || []).some(r => r.livre_id === id)))
  ]);

  const st = STATUTS_LIVRE[livre.statut] ?? STATUTS_LIVRE.en_proposition;

  // Build vote history
  let voteHTML = "";
  if (votesDuLivre.length) {
    voteHTML = votesDuLivre.map(v => {
      const r = v.resultats.find(x => x.livre_id === id);
      if (!r) return "";
      const notes = Object.entries(r.notes || {});
      const max = 10;
      const isElu = v.livre_elu === id;
      const pct = r.moyenne ? Math.round(r.moyenne / max * 100) : 0;
      return `
        <div style="margin-bottom:1.25rem">
          <div style="font-size:.82rem;color:var(--muted);margin-bottom:.5rem">
            Vote de ${v.mois}/${v.annee} ${isElu ? '<span class="badge badge-elu">Élu</span>' : ''}
          </div>
          <div class="chart">
            ${notes.map(([mid, note]) => {
              const nom = membres.find(m => m.id === mid)?.nom ?? mid;
              const p = Math.round(Number(note) / max * 100);
              return `<div class="chart-row">
                <div class="chart-label">${nom}</div>
                <div class="chart-bar-wrap">
                  <div class="chart-bar ${isElu ? 'best' : ''}" style="width:${p}%">${note}/10</div>
                </div>
              </div>`;
            }).join("")}
            <div class="chart-row">
              <div class="chart-label" style="font-weight:700;color:var(--text)">Moyenne</div>
              <div class="chart-bar-wrap">
                <div class="chart-bar ${isElu ? 'best' : ''}" style="width:${pct}%;background:${isElu ? 'var(--green)' : 'var(--purple)'}">
                  ${r.moyenne !== null ? Number(r.moyenne).toFixed(1) + '/10' : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }).join("");
  } else {
    voteHTML = `<div class="text-muted" style="font-size:.85rem">Pas encore de vote pour ce livre.</div>`;
  }

  // Statuts de lecture
  const statutRows = membres.map(m => {
    const s = statuts.find(x => x.membre_id === m.id);
    const label = s ? (s.statut === "termine" ? "✅ Terminé" : s.statut === "en_cours" ? `📖 En cours (${s.page_actuelle ?? '?'}p)` : s.statut === "achete" ? "🛒 Acheté" : "—") : "—";
    return `<tr><td>${m.nom}</td><td>${label}</td></tr>`;
  }).join("");

  document.getElementById("fiche-content").innerHTML = `
    <dl class="book-detail-meta">
      <dt>Auteur</dt><dd>${livre.auteur || "—"}</dd>
      <dt>Année</dt><dd>${livre.annee || "—"}</dd>
      <dt>Proposé par</dt><dd>${nomMembre(livre.propose_par)}</dd>
      <dt>Date</dt><dd>${formatDate(livre.date_proposition)}</dd>
      <dt>Statut</dt><dd><span class="badge badge-${st.css}">${st.label}</span></dd>
    </dl>

    <div class="divider"></div>
    <div class="card-title">Avancements membres</div>
    <div class="table-wrap mb-3">
      <table><thead><tr><th>Membre</th><th>Statut</th></tr></thead>
      <tbody>${statutRows}</tbody></table>
    </div>

    <div class="divider"></div>
    <div class="card-title">Historique des votes</div>
    ${voteHTML}
  `;
}

document.getElementById("fiche-close").addEventListener("click", () => document.getElementById("fiche-overlay").classList.add("hidden"));
document.getElementById("fiche-overlay").addEventListener("click", e => { if (e.target === e.currentTarget) document.getElementById("fiche-overlay").classList.add("hidden"); });

init().catch(console.error);
