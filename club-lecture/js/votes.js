import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getVotes, getMembres, getLivres, addVote, updateVote } from "./db.js";
import { formatMois, moyenne, showToast } from "./utils.js";

await requireAuth();
initNav("votes");

let votes = [], membres = [], livres = [];
let currentVoteId = null;
let selectedLivres = [];

async function init() {
  [votes, membres, livres] = await Promise.all([getVotes(), getMembres(), getLivres()]);
  populateLivreSelect();
  setDefaultDate();
  renderList();
  const openId = new URLSearchParams(window.location.search).get("open");
  if (openId) openDetail(openId);
}

function setDefaultDate() {
  const now = new Date();
  document.getElementById("v-annee").value = now.getFullYear();
  document.getElementById("v-mois").value = now.getMonth() + 1;
}

function populateLivreSelect() {
  const sel = document.getElementById("v-livre-select");
  sel.innerHTML = '<option value="">— Choisir un livre —</option>';
  livres.filter(l => l.statut === "en_proposition").forEach(l => {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = `${l.titre}${l.auteur ? ` — ${l.auteur}` : ""}`;
    sel.appendChild(opt);
  });
}

// ── Vote list ──────────────────────────────────────────────────────

function renderList() {
  const container = document.getElementById("votes-list");
  if (!votes.length) {
    container.innerHTML = `<div class="empty-state"><span class="big-icon">🗳️</span>Aucun vote enregistré.</div>`;
    return;
  }

  container.innerHTML = `<div class="vote-list">${votes.map(v => {
    const eluResult = (v.resultats || []).find(r => r.livre_id === v.livre_elu);
    const eluLabel = eluResult ? `<strong>${eluResult.titre}</strong>` : `<span style="color:var(--muted);font-style:italic">Aucun élu</span>`;
    return `
      <div class="vote-item" data-id="${v.id}">
        <div class="vote-item-month">${formatMois(v.mois, v.annee)}</div>
        <div class="vote-item-elu">📖 ${eluLabel}</div>
        <div class="vote-item-actions">
          <span style="color:var(--muted);font-size:.8rem">${(v.resultats || []).length} livre(s)</span>
          <span style="color:var(--muted)">›</span>
        </div>
      </div>`;
  }).join("")}</div>`;

  container.querySelectorAll(".vote-item").forEach(el => {
    el.addEventListener("click", () => openDetail(el.dataset.id));
  });
}

// ── Detail modal ───────────────────────────────────────────────────

function openDetail(id) {
  currentVoteId = id;
  const vote = votes.find(v => v.id === id);
  if (!vote) return;

  document.getElementById("detail-title").textContent = `Vote — ${formatMois(vote.mois, vote.annee)}`;
  document.getElementById("detail-content").innerHTML = renderDetailContent(vote);
  document.getElementById("detail-overlay").classList.remove("hidden");
}

function renderDetailContent(vote) {
  const resultats = vote.resultats || [];
  if (!resultats.length) return `<div class="empty-state">Aucune donnée.</div>`;

  const sorted = [...resultats].sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));

  // Detect scale
  const allNotes = resultats.flatMap(r => Object.values(r.notes || {})).map(Number).filter(n => !isNaN(n));
  const maxNote = allNotes.length ? Math.max(...allNotes) : 10;
  const scale = maxNote <= 5 ? 5 : 10;
  const threshold = 2.5;

  const eluId = vote.livre_elu;

  return `
    ${renderChart(sorted, scale, threshold, eluId)}
    <div class="divider"></div>
    <div class="card-title mb-2">Votes individuels</div>
    ${renderTable(sorted, membres, scale, eluId)}
  `;
}

function renderChart(sorted, scale, threshold, eluId) {
  const barAreaH = 220;
  const thresholdBottom = Math.round((threshold / scale) * barAreaH);

  const bars = sorted.map(r => {
    const moy = r.moyenne ?? 0;
    const barH = Math.max(2, Math.round((moy / scale) * barAreaH));
    const isWinner = r.livre_id === eluId;
    const isElim = !isWinner && moy < threshold;
    const color = isWinner ? "var(--green)" : isElim ? "#555" : "var(--purple)";
    const valColor = isWinner ? "var(--green)" : isElim ? "#666" : "var(--purple)";
    return `
      <div class="vchart-col">
        <div class="vchart-val" style="color:${valColor}">${Number(moy).toFixed(2)}</div>
        <div class="vchart-bar" style="height:${barH}px;background:${color}"></div>
      </div>`;
  }).join("");

  const labels = sorted.map(r =>
    `<div class="vchart-label-col">${r.titre ?? "?"}</div>`
  ).join("");

  return `
    <div class="vchart-legend">
      <div class="vchart-legend-item"><div class="vchart-legend-dot" style="background:var(--green)"></div>Gagnant</div>
      <div class="vchart-legend-item"><div class="vchart-legend-dot" style="background:var(--purple)"></div>Conservé (≥ ${threshold})</div>
      <div class="vchart-legend-item"><div class="vchart-legend-dot" style="background:#555"></div>Éliminé (< ${threshold})</div>
    </div>
    <div class="vchart-outer">
      <div class="vchart-wrap">
        <div class="vchart-bars-area" style="height:${barAreaH}px">
          <div class="vchart-threshold" style="bottom:${thresholdBottom}px">
            <span class="vchart-threshold-label">Seuil : ${threshold}</span>
          </div>
          ${bars}
        </div>
        <div class="vchart-labels">${labels}</div>
      </div>
    </div>`;
}

function renderTable(sorted, membres, scale, eluId) {
  const headers = sorted.map(r => {
    const isWinner = r.livre_id === eluId;
    const isElim = !isWinner && (r.moyenne ?? 0) < 2.5;
    const cls = isWinner ? "winner-col" : isElim ? "elim-col" : "";
    return `<th class="${cls}">${r.titre ?? "?"}</th>`;
  }).join("");

  const rows = membres.map(m => {
    const cells = sorted.map(r => {
      const note = r.notes?.[m.id];
      if (note === undefined || note === null || note === "") return `<td class="text-muted">—</td>`;
      const n = Number(note);
      const isWinner = r.livre_id === eluId;
      const isElim = !isWinner && (r.moyenne ?? 0) < 2.5;
      const cls = isWinner ? "winner-cell" : isElim ? "elim-cell" : "";
      const stars = renderStars(n, scale);
      return `<td class="${cls}">${n}/${scale}<br><span class="stars">${stars}</span></td>`;
    }).join("");
    return `<tr><td class="member-cell">${m.nom}</td>${cells}</tr>`;
  }).join("");

  const avgCells = sorted.map(r => {
    const isWinner = r.livre_id === eluId;
    const isElim = !isWinner && (r.moyenne ?? 0) < 2.5;
    const cls = isWinner ? "winner-avg" : isElim ? "elim-avg" : "";
    return `<td class="${cls}">${r.moyenne !== null && r.moyenne !== undefined ? Number(r.moyenne).toFixed(2) : "—"}</td>`;
  }).join("");

  return `
    <div class="vtable-wrap">
      <table class="vtable">
        <thead><tr><th>Votant</th>${headers}</tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td class="member-cell">Moyenne</td>${avgCells}</tr></tfoot>
      </table>
    </div>`;
}

function renderStars(note, scale) {
  const normalized = Math.round((note / scale) * 5);
  return "★".repeat(normalized) + "☆".repeat(5 - normalized);
}

// ── Close detail ───────────────────────────────────────────────────

document.getElementById("detail-close").addEventListener("click", () => {
  document.getElementById("detail-overlay").classList.add("hidden");
  currentVoteId = null;
});
document.getElementById("detail-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) { document.getElementById("detail-overlay").classList.add("hidden"); currentVoteId = null; }
});

// ── Edit month modal ───────────────────────────────────────────────

document.getElementById("detail-edit").addEventListener("click", () => {
  const vote = votes.find(v => v.id === currentVoteId);
  if (!vote) return;
  document.getElementById("e-mois").value = vote.mois;
  document.getElementById("e-annee").value = vote.annee;
  document.getElementById("edit-overlay").classList.remove("hidden");
});

["edit-close", "edit-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => document.getElementById("edit-overlay").classList.add("hidden"));
});

document.getElementById("edit-save").addEventListener("click", async () => {
  if (!currentVoteId) return;
  const mois = Number(document.getElementById("e-mois").value);
  const annee = Number(document.getElementById("e-annee").value);
  try {
    await updateVote(currentVoteId, { mois, annee });
    showToast("Mois mis à jour !", "success");
    document.getElementById("edit-overlay").classList.add("hidden");
    votes = await getVotes();
    renderList();
    // Refresh detail title
    document.getElementById("detail-title").textContent = `Vote — ${formatMois(mois, annee)}`;
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
});

// ── Saisie vote modal ──────────────────────────────────────────────

document.getElementById("btn-add-vote").addEventListener("click", () => {
  selectedLivres = [];
  renderMatrix();
  document.getElementById("vote-overlay").classList.remove("hidden");
});

["vote-close","vote-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => document.getElementById("vote-overlay").classList.add("hidden"));
});
document.getElementById("vote-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("vote-overlay").classList.add("hidden");
});

document.getElementById("v-add-livre").addEventListener("click", () => {
  const sel = document.getElementById("v-livre-select");
  const id = sel.value;
  if (!id) return;
  if (selectedLivres.find(l => l.livre_id === id)) { showToast("Déjà dans la liste.", "error"); return; }
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
      `<td><input type="number" min="0" max="5" step="0.5" placeholder="—" class="note-input" data-livre="${li}" data-membre="${m.id}"></td>`
    ).join("");
    return `<tr>
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
    </div>
    <div style="margin-top:.5rem;font-size:.75rem;color:var(--muted)">Notes sur 5</div>`;

  section.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => { selectedLivres.splice(Number(btn.dataset.remove), 1); renderMatrix(); });
  });
}

document.getElementById("vote-save").addEventListener("click", async () => {
  if (!selectedLivres.length) { showToast("Ajoutez au moins un livre.", "error"); return; }
  const mois = Number(document.getElementById("v-mois").value);
  const annee = Number(document.getElementById("v-annee").value);
  if (!annee) { showToast("Entrez l'année.", "error"); return; }

  const resultats = selectedLivres.map((l, li) => {
    const notes = {};
    membres.forEach(m => {
      const inp = document.querySelector(`.note-input[data-livre="${li}"][data-membre="${m.id}"]`);
      const v = inp?.value;
      if (v !== "" && v !== undefined && v !== null && v !== "") notes[m.id] = Number(v);
    });
    return { livre_id: l.livre_id, titre: l.titre, auteur: l.auteur, notes, moyenne: moyenne(notes) };
  });

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
    renderList();
    populateLivreSelect();
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
});

init().catch(console.error);
