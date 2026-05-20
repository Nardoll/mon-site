import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getVotes, getMembres, getLivres, addVote } from "./db.js";
import { formatMois, MOIS_NOMS, moyenne, showToast } from "./utils.js";

await requireAuth();
initNav("votes");

let votes = [], membres = [], livres = [];
let selectedLivres = []; // { livre_id, titre, auteur }

async function init() {
  [votes, membres, livres] = await Promise.all([getVotes(), getMembres(), getLivres()]);
  populateLivreSelect();
  setDefaultDate();
  renderVotes();
}

function setDefaultDate() {
  const now = new Date();
  document.getElementById("v-annee").value = now.getFullYear();
  document.getElementById("v-mois").value = now.getMonth() + 1;
}

function populateLivreSelect() {
  const sel = document.getElementById("v-livre-select");
  sel.innerHTML = '<option value="">— Choisir un livre —</option>';
  livres
    .filter(l => l.statut === "en_proposition")
    .forEach(l => {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = `${l.titre}${l.auteur ? ` — ${l.auteur}` : ""}`;
      sel.appendChild(opt);
    });
}

// ── Votes list ─────────────────────────────────────────────────────

function renderVotes() {
  const container = document.getElementById("votes-list");
  if (!votes.length) {
    container.innerHTML = `<div class="empty-state"><span class="big-icon">🗳️</span>Aucun vote enregistré.</div>`;
    return;
  }

  container.innerHTML = votes.map(v => {
    const resultats = v.resultats || [];
    const max = Math.max(...resultats.map(r => r.moyenne ?? 0), 1);

    const bars = resultats
      .slice()
      .sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0))
      .map(r => {
        const pct = max > 0 ? Math.round((r.moyenne ?? 0) / 10 * 100) : 0;
        const isElu = r.livre_id === v.livre_elu;
        const isLow = r.moyenne !== null && r.moyenne <= 2.5;
        const cls = isElu ? "best" : isLow ? "low" : "";
        const notesDetail = Object.entries(r.notes || {}).map(([mid, n]) => {
          const nom = membres.find(m => m.id === mid)?.nom ?? mid;
          return `${nom}: ${n}`;
        }).join(" · ");
        return `
          <div class="chart-row">
            <div class="chart-label" title="${r.titre ?? ''}">${r.titre ?? r.livre_id}</div>
            <div class="chart-bar-wrap">
              <div class="chart-bar ${cls}" style="width:${pct}%">
                ${r.moyenne !== null && r.moyenne !== undefined ? Number(r.moyenne).toFixed(1) + "/10" : "—"}
              </div>
            </div>
          </div>
          ${notesDetail ? `<div style="font-size:.72rem;color:var(--muted);margin-left:130px;margin-bottom:.3rem">${notesDetail}</div>` : ""}
        `;
      }).join("");

    const eluInfo = v.livre_elu ? resultats.find(r => r.livre_id === v.livre_elu) : null;

    return `
      <div class="card vote-card">
        <div class="vote-card-header">
          <span class="vote-month-label">${formatMois(v.mois, v.annee)}</span>
          ${eluInfo ? `<span class="badge badge-elu">📖 ${eluInfo.titre ?? "Livre élu"}</span>` : ""}
        </div>
        <div class="chart">${bars}</div>
      </div>
    `;
  }).join("");
}

// ── Modal vote ─────────────────────────────────────────────────────

document.getElementById("btn-add-vote").addEventListener("click", () => {
  selectedLivres = [];
  renderMatrix();
  document.getElementById("vote-overlay").classList.remove("hidden");
});

["vote-close","vote-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => {
    document.getElementById("vote-overlay").classList.add("hidden");
  });
});

document.getElementById("vote-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("vote-overlay").classList.add("hidden");
});

document.getElementById("v-add-livre").addEventListener("click", () => {
  const sel = document.getElementById("v-livre-select");
  const id = sel.value;
  if (!id) return;
  if (selectedLivres.find(l => l.livre_id === id)) {
    showToast("Ce livre est déjà dans la liste.", "error");
    return;
  }
  const livre = livres.find(l => l.id === id);
  selectedLivres.push({ livre_id: id, titre: livre?.titre ?? id, auteur: livre?.auteur ?? "" });
  sel.value = "";
  renderMatrix();
});

function renderMatrix() {
  const section = document.getElementById("v-matrix-section");
  if (!selectedLivres.length) {
    section.innerHTML = `<div class="text-muted" style="margin-top:.75rem;font-size:.85rem">Aucun livre sélectionné.</div>`;
    return;
  }

  const membresHeader = membres.map(m => `<th>${m.nom}</th>`).join("");
  const rows = selectedLivres.map((l, li) => {
    const inputs = membres.map(m =>
      `<td><input type="number" min="0" max="10" step="0.5" placeholder="—" class="note-input" data-livre="${li}" data-membre="${m.id}"></td>`
    ).join("");
    return `
      <tr>
        <td class="book-cell">
          ${l.titre}
          <button class="btn btn-ghost btn-sm" data-remove="${li}" style="float:right;padding:.1rem .3rem">✕</button>
        </td>
        ${inputs}
      </tr>`;
  }).join("");

  section.innerHTML = `
    <div class="matrix-wrap">
      <table class="matrix-table">
        <thead><tr><th class="book-cell">Livre</th>${membresHeader}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  section.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedLivres.splice(Number(btn.dataset.remove), 1);
      renderMatrix();
    });
  });
}

document.getElementById("vote-save").addEventListener("click", async () => {
  if (!selectedLivres.length) { showToast("Ajoutez au moins un livre.", "error"); return; }
  const mois = Number(document.getElementById("v-mois").value);
  const annee = Number(document.getElementById("v-annee").value);
  if (!annee) { showToast("Entrez l'année.", "error"); return; }

  const noteInputs = document.querySelectorAll(".note-input");

  const resultats = selectedLivres.map((l, li) => {
    const notes = {};
    membres.forEach(m => {
      const inp = document.querySelector(`.note-input[data-livre="${li}"][data-membre="${m.id}"]`);
      const v = inp?.value;
      if (v !== "" && v !== undefined && v !== null) notes[m.id] = Number(v);
    });
    const moy = moyenne(notes);
    return { livre_id: l.livre_id, titre: l.titre, auteur: l.auteur, notes, moyenne: moy };
  });

  // Determine livre élu (highest average, must be unique max)
  const withMoy = resultats.filter(r => r.moyenne !== null);
  let livre_elu = null;
  if (withMoy.length) {
    const max = Math.max(...withMoy.map(r => r.moyenne));
    const winners = withMoy.filter(r => r.moyenne === max);
    if (winners.length === 1) livre_elu = winners[0].livre_id;
  }

  try {
    await addVote({ mois, annee, resultats, livre_elu });
    showToast("Vote enregistré !", "success");
    document.getElementById("vote-overlay").classList.add("hidden");
    votes = await getVotes();
    livres = await getLivres();
    renderVotes();
    populateLivreSelect();
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
});

init().catch(console.error);
