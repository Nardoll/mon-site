import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMembres, addMembre, getLivres, getVotes, updateMembreInfos } from "./db.js";
import { formatDate, formatMois, initiales, showToast } from "./utils.js";

await requireAuth();
initNav("membres");

let membres = [], livres = [], votes = [];
let currentProfilId = null;

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

["membre-close", "membre-cancel"].forEach(id => {
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

function detectScale(resultats) {
  const allNotes = (resultats || [])
    .flatMap(r => Object.values(r.notes || {}))
    .map(Number).filter(n => !isNaN(n));
  return (allNotes.length && Math.max(...allNotes) <= 5) ? 5 : 10;
}

function openProfil(id) {
  currentProfilId = id;
  const membre = membres.find(m => m.id === id);
  if (!membre) return;

  const proposes = livres.filter(l => l.propose_par === id);
  const participation = votes
    .filter(v => (v.resultats || []).some(r => r.notes?.[id] !== undefined))
    .sort((a, b) => b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois);

  // ── Livres proposés ─────────────────────────────────────────────
  const proposesHTML = proposes.length
    ? `<ul style="list-style:none">${proposes.map(l => {
        const dateStr = l.date_proposition
          ? `<span class="text-muted" style="font-size:.76rem">${formatDate(l.date_proposition)}</span>`
          : "";
        const badgeCls = l.statut === "elu" ? "elu" : l.statut === "refuse" ? "refuse" : "proposition";
        const badgeLabel = l.statut === "elu" ? "Élu" : l.statut === "refuse" ? "Éliminé" : "En proposition";
        return `<li style="padding:.45rem 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem">
            <span style="font-size:.88rem"><strong>${l.titre}</strong>${l.auteur ? ` — ${l.auteur}` : ""}</span>
            <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
              ${dateStr}
              <span class="badge badge-${badgeCls}">${badgeLabel}</span>
            </div>
          </div>
        </li>`;
      }).join("")}</ul>`
    : `<div class="text-muted" style="font-size:.85rem">Aucune proposition.</div>`;

  // ── Section votes ────────────────────────────────────────────────
  const votesSection = participation.length
    ? `<div style="margin-bottom:.75rem">
        <input type="text" id="vote-search" placeholder="Rechercher un livre…" autocomplete="off">
       </div>
       <div id="vote-histogram" class="hidden"></div>
       <div id="vote-month-list">${participation.map((v, idx) => {
          const scale = detectScale(v.resultats);
          const memberRes = (v.resultats || [])
            .filter(r => r.notes?.[id] !== undefined)
            .sort((a, b) => b.notes[id] - a.notes[id]);
          const top = memberRes[0];
          const nb = memberRes.length;
          const topHtml = top
            ? `1er : <strong>${top.titre}</strong> <span style="color:var(--accent)">(${top.notes[id]}/${scale})</span>`
            : "—";
          return `<div class="vmr" data-vote-idx="${idx}">
            <div class="vmr-header">
              <span class="vmr-month">${formatMois(v.mois, v.annee)}</span>
              <span class="vmr-top">${topHtml}</span>
              <span class="vmr-count">${nb} livre${nb > 1 ? "s" : ""}</span>
              <span class="vmr-arrow">▶</span>
            </div>
            <div class="vmr-detail hidden"></div>
          </div>`;
       }).join("")}</div>`
    : `<div class="text-muted" style="font-size:.85rem">Aucune participation enregistrée.</div>`;

  document.getElementById("profil-title").textContent = membre.nom;
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
    <div class="card-title mb-2">🗳️ Participation aux votes</div>
    ${votesSection}
  `;

  document.getElementById("profil-overlay").classList.remove("hidden");
  attachVoteInteractions(participation, id);
}

// ── Interactions votes ──────────────────────────────────────────────

function attachVoteInteractions(participation, membreId) {
  const searchInput = document.getElementById("vote-search");
  const histogramDiv = document.getElementById("vote-histogram");
  const monthList = document.getElementById("vote-month-list");
  if (!searchInput) return;

  // Toggle month rows
  monthList.querySelectorAll(".vmr-header").forEach(header => {
    header.addEventListener("click", () => {
      const row = header.closest(".vmr");
      const detail = row.querySelector(".vmr-detail");
      const arrow = header.querySelector(".vmr-arrow");
      const v = participation[parseInt(row.dataset.voteIdx)];
      const isOpen = !detail.classList.contains("hidden");

      if (isOpen) {
        detail.classList.add("hidden");
        arrow.classList.remove("open");
        header.classList.remove("active");
        return;
      }

      const scale = detectScale(v.resultats);
      const sorted = (v.resultats || [])
        .filter(r => r.notes?.[membreId] !== undefined)
        .sort((a, b) => b.notes[membreId] - a.notes[membreId]);

      detail.innerHTML = `<div class="chart" style="padding:.25rem 0">${sorted.map((r, i) => {
        const note = r.notes[membreId];
        const pct = Math.round((note / scale) * 100);
        const isElu = v.livre_elu === r.livre_id;
        return `<div class="chart-row">
          <div class="chart-label">
            <span style="opacity:.5;margin-right:.3rem">${i + 1}.</span>${r.titre ?? "?"}
          </div>
          <div class="chart-bar-wrap">
            <div class="chart-bar ${isElu ? "best" : ""}" style="width:${pct}%">${note}/${scale}</div>
          </div>
        </div>`;
      }).join("")}</div>`;

      detail.classList.remove("hidden");
      arrow.classList.add("open");
      header.classList.add("active");
    });
  });

  // Search input → histogram
  searchInput.addEventListener("input", () => {
    const term = searchInput.value.trim().toLowerCase();

    if (term.length < 2) {
      histogramDiv.classList.add("hidden");
      histogramDiv.innerHTML = "";
      monthList.classList.remove("hidden");
      return;
    }

    const chronoOrder = [...participation].sort(
      (a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois
    );
    const matches = [];
    for (const v of chronoOrder) {
      for (const r of (v.resultats || [])) {
        if (r.notes?.[membreId] !== undefined && (r.titre ?? "").toLowerCase().includes(term)) {
          matches.push({ v, r, note: r.notes[membreId], scale: detectScale(v.resultats) });
        }
      }
    }

    if (!matches.length) {
      histogramDiv.innerHTML = `<div class="text-muted" style="font-size:.85rem;padding:.5rem 0">Aucun résultat.</div>`;
      histogramDiv.classList.remove("hidden");
      monthList.classList.add("hidden");
      return;
    }

    const uniqueTitles = [...new Set(matches.map(m => m.r.titre))];
    const titleLabel = uniqueTitles.join(", ");
    const chartH = 140;

    const barsHtml = matches.map(({ v, r, note, scale }) => {
      const barH = Math.max(2, Math.round((note / scale) * chartH));
      const isElu = v.livre_elu === r.livre_id;
      const color = isElu ? "var(--green)" : "var(--accent)";
      return `<div class="vchart-col">
        <div class="vchart-val" style="color:${color}">${note}/${scale}</div>
        <div class="vchart-bar" style="height:${barH}px;background:${color}"></div>
      </div>`;
    }).join("");

    const labelsHtml = matches.map(({ v }) =>
      `<div class="vchart-label-col">${formatMois(v.mois, v.annee)}</div>`
    ).join("");

    histogramDiv.innerHTML = `
      <div style="font-size:.8rem;margin-bottom:.6rem;color:var(--muted)">
        Notes pour : <em style="color:var(--text)">${titleLabel}</em>
      </div>
      <div class="vchart-outer">
        <div class="vchart-wrap">
          <div class="vchart-bars-area" style="height:${chartH}px">${barsHtml}</div>
          <div class="vchart-labels">${labelsHtml}</div>
        </div>
      </div>`;
    histogramDiv.classList.remove("hidden");
    monthList.classList.add("hidden");
  });
}

// ── Close profil ────────────────────────────────────────────────────

document.getElementById("profil-close").addEventListener("click", () => {
  document.getElementById("profil-overlay").classList.add("hidden");
});

document.getElementById("profil-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("profil-overlay").classList.add("hidden");
});

// ── Modifier profil membre ──────────────────────────────────────────

function showProfilEditForm(membre) {
  const dateStr = membre.date_arrivee
    ? new Date(membre.date_arrivee.seconds * 1000).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  document.getElementById("profil-title").textContent = "Modifier le membre";
  document.getElementById("profil-content").innerHTML = `
    <div class="form-group">
      <label>Nom <span style="color:var(--red)">*</span></label>
      <input type="text" id="edit-m-nom">
    </div>
    <div class="form-group">
      <label>Date d'arrivée</label>
      <input type="date" id="edit-m-date">
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="edit-m-cancel">Annuler</button>
      <button class="btn btn-primary" id="edit-m-save">Enregistrer</button>
    </div>
  `;

  document.getElementById("edit-m-nom").value = membre.nom || "";
  document.getElementById("edit-m-date").value = dateStr;

  document.getElementById("edit-m-cancel").addEventListener("click", () => openProfil(currentProfilId));
  document.getElementById("edit-m-save").addEventListener("click", async () => {
    const nom = document.getElementById("edit-m-nom").value.trim();
    if (!nom) { showToast("Le nom est obligatoire.", "error"); return; }
    const dateVal = document.getElementById("edit-m-date").value;
    if (!dateVal) { showToast("La date est obligatoire.", "error"); return; }
    try {
      await updateMembreInfos(currentProfilId, { nom, date_arrivee: dateVal });
      showToast("Membre modifié !", "success");
      membres = await getMembres();
      renderGrid();
      openProfil(currentProfilId);
    } catch (e) {
      showToast("Erreur : " + e.message, "error");
    }
  });
}

document.getElementById("profil-edit").addEventListener("click", () => {
  const membre = membres.find(m => m.id === currentProfilId);
  if (membre) showProfilEditForm(membre);
});

init().catch(console.error);
