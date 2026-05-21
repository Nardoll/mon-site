import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getVotes, getMembres, getLivres, addVote, updateVote, getVoteActif, lancerVote, soumettreVote, cloturerVoteActif, annulerVoteActif, deleteVote } from "./db.js";
import { formatMois, moyenne, showToast } from "./utils.js";

await requireAuth();
initNav("votes");

let votes = [], membres = [], livres = [];
let currentVoteId = null;
let voteActif = null;
let pendingVoteData = null;
let countdownInterval = null;

async function init() {
  [votes, membres, livres] = await Promise.all([getVotes(), getMembres(), getLivres()]);
  voteActif = await getVoteActif();

  if (voteActif && voteActif.expires_at?.toMillis() < Date.now()) {
    await closeExpiredVote(voteActif);
    voteActif = null;
  }

  renderList();
  renderActiveVoteBanner();
  if (voteActif) startCountdown();

  const openId = new URLSearchParams(window.location.search).get("open");
  if (openId) openDetail(openId);
}

// ── Clôture automatique ────────────────────────────────────────────

async function closeExpiredVote(va) {
  const bulletins = va.bulletins || {};
  const resultats = (va.livre_ids || []).map(livre_id => {
    const livre = livres.find(l => l.id === livre_id);
    const notes = {};
    Object.entries(bulletins).forEach(([membreId, b]) => {
      const n = b?.[livre_id];
      if (n !== undefined && n !== null && n !== "") notes[membreId] = Number(n);
    });
    const vals = Object.values(notes);
    const moy = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { livre_id, titre: livre?.titre ?? livre_id, auteur: livre?.auteur ?? "", notes, moyenne: moy };
  });

  const withMoy = resultats.filter(r => r.moyenne !== null);
  let livre_elu = null;
  if (withMoy.length) {
    const max = Math.max(...withMoy.map(r => r.moyenne));
    const winners = withMoy.filter(r => r.moyenne === max);
    if (winners.length === 1) livre_elu = winners[0].livre_id;
  }

  await cloturerVoteActif(va.id, { mois: va.mois, annee: va.annee, resultats, livre_elu });
  votes = await getVotes();
  livres = await getLivres();
  showToast("Vote clôturé !", "success");
  renderList();
}

// ── Bannière vote actif ────────────────────────────────────────────

function renderActiveVoteBanner() {
  const banner = document.getElementById("vote-actif-banner");
  if (!voteActif) { banner.classList.add("hidden"); return; }
  banner.classList.remove("hidden");
  document.getElementById("vote-actif-title").textContent =
    `🗳️ Vote en cours — ${formatMois(voteActif.mois, voteActif.annee)}`;
  updateCountdown();
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  updateCountdown();
  countdownInterval = setInterval(() => {
    if (!voteActif) { clearInterval(countdownInterval); return; }
    if (voteActif.expires_at.toMillis() <= Date.now()) {
      clearInterval(countdownInterval);
      closeExpiredVote(voteActif).then(() => { voteActif = null; renderActiveVoteBanner(); });
      return;
    }
    updateCountdown();
  }, 1000);
}

function updateCountdown() {
  const el = document.getElementById("vote-actif-countdown");
  if (!el || !voteActif) return;
  const ms = voteActif.expires_at.toMillis() - Date.now();
  if (ms <= 0) { el.textContent = "Vote expiré — clôture en cours…"; return; }
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}min`);
  parts.push(`${s}s`);
  el.textContent = `Se termine dans ${parts.join(" ")}`;
}

// ── Liste des votes ────────────────────────────────────────────────

function renderList() {
  const container = document.getElementById("votes-list");
  if (!votes.length) {
    container.innerHTML = `<div class="empty-state"><span class="big-icon">🗳️</span>Aucun vote enregistré.</div>`;
    return;
  }
  container.innerHTML = `<div class="vote-list">${votes.map(v => {
    const eluResult = (v.resultats || []).find(r => r.livre_id === v.livre_elu);
    const eluLabel = eluResult
      ? `<strong>${eluResult.titre}</strong>`
      : `<span style="color:var(--muted);font-style:italic">Aucun élu</span>`;
    return `<div class="vote-item" data-id="${v.id}">
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

// ── Détail vote ────────────────────────────────────────────────────

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
    const color = isWinner ? "var(--green)" : isElim ? "var(--elim)" : "var(--purple)";
    return `<div class="vchart-col">
      <div class="vchart-val" style="color:${color}">${Number(moy).toFixed(2)}</div>
      <div class="vchart-bar" style="height:${barH}px;background:${color}"></div>
    </div>`;
  }).join("");
  const labels = sorted.map(r => `<div class="vchart-label-col">${r.titre ?? "?"}</div>`).join("");
  return `
    <div class="vchart-legend">
      <div class="vchart-legend-item"><div class="vchart-legend-dot" style="background:var(--green)"></div>Gagnant</div>
      <div class="vchart-legend-item"><div class="vchart-legend-dot" style="background:var(--purple)"></div>Conservé (≥ ${threshold})</div>
      <div class="vchart-legend-item"><div class="vchart-legend-dot" style="background:var(--elim)"></div>Éliminé (< ${threshold})</div>
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
    return `<th class="${isWinner ? "winner-col" : isElim ? "elim-col" : ""}">${r.titre ?? "?"}</th>`;
  }).join("");
  const rows = membres.map(m => {
    const cells = sorted.map(r => {
      const note = r.notes?.[m.id];
      if (note === undefined || note === null || note === "") return `<td class="text-muted">—</td>`;
      const n = Number(note);
      const isWinner = r.livre_id === eluId;
      const isElim = !isWinner && (r.moyenne ?? 0) < 2.5;
      const cls = isWinner ? "winner-cell" : isElim ? "elim-cell" : "";
      return `<td class="${cls}">${n}/${scale}<br><span class="stars">${renderStars(n, scale)}</span></td>`;
    }).join("");
    return `<tr><td class="member-cell">${m.nom}</td>${cells}</tr>`;
  }).join("");
  const avgCells = sorted.map(r => {
    const isWinner = r.livre_id === eluId;
    const isElim = !isWinner && (r.moyenne ?? 0) < 2.5;
    return `<td class="${isWinner ? "winner-avg" : isElim ? "elim-avg" : ""}">${r.moyenne !== null && r.moyenne !== undefined ? Number(r.moyenne).toFixed(2) : "—"}</td>`;
  }).join("");
  return `<div class="vtable-wrap"><table class="vtable">
    <thead><tr><th>Votant</th>${headers}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td class="member-cell">Moyenne</td>${avgCells}</tr></tfoot>
  </table></div>`;
}

function renderStars(note, scale) {
  const normalized = Math.round((note / scale) * 5);
  return "★".repeat(normalized) + "☆".repeat(5 - normalized);
}

// ── Fermer détail ──────────────────────────────────────────────────

document.getElementById("detail-close").addEventListener("click", () => {
  document.getElementById("detail-overlay").classList.add("hidden");
  currentVoteId = null;
});
document.getElementById("detail-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) { document.getElementById("detail-overlay").classList.add("hidden"); currentVoteId = null; }
});

// ── Modifier mois ──────────────────────────────────────────────────

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
    document.getElementById("detail-title").textContent = `Vote — ${formatMois(mois, annee)}`;
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
});

// ── Lancer un vote ─────────────────────────────────────────────────

function parseDuree(text) {
  const s = text.toLowerCase().trim();
  let ms = 0;
  const matchH = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const matchM = s.match(/(\d+)\s*min/);
  if (matchH) ms += parseFloat(matchH[1].replace(",", ".")) * 3600000;
  if (matchM) ms += parseInt(matchM[1]) * 60000;
  if (!matchH && !matchM) {
    const n = parseFloat(s.replace(",", "."));
    if (!isNaN(n) && n > 0) ms = n * 3600000;
  }
  return ms || null;
}

function openLancerVoteModal() {
  if (voteActif) { showToast("Un vote est déjà en cours.", "error"); return; }
  const now = new Date();
  document.getElementById("l-annee").value = now.getFullYear();
  document.getElementById("l-mois").value = now.getMonth() + 1;
  document.getElementById("l-duree").value = "";
  document.getElementById("l-echelle").value = "5";

  const livresList = document.getElementById("l-livres-list");
  livresList.innerHTML = livres.map(l => {
    const actif = l.statut === "en_proposition";
    const label = l.statut !== "en_proposition"
      ? ` <span style="font-size:.72rem;color:var(--muted)">(${l.statut === "elu" ? "élu" : "éliminé"})</span>`
      : "";
    return `<label class="check-item${actif ? "" : " check-item-disabled"}">
      <input type="checkbox" name="l-livre" value="${l.id}" ${actif ? "checked" : ""} ${actif ? "" : "disabled"}>
      ${l.titre}${label}
    </label>`;
  }).join("") || `<div style="font-size:.85rem;color:var(--muted)">Aucun livre disponible.</div>`;

  const membresList = document.getElementById("l-membres-list");
  membresList.innerHTML = membres.map(m => `
    <label class="check-item">
      <input type="checkbox" name="l-membre" value="${m.id}" checked>
      ${m.nom}
    </label>`).join("");

  document.getElementById("lancer-overlay").classList.remove("hidden");
}

document.getElementById("btn-lancer-vote").addEventListener("click", openLancerVoteModal);
["lancer-close", "lancer-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => document.getElementById("lancer-overlay").classList.add("hidden"));
});
document.getElementById("lancer-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("lancer-overlay").classList.add("hidden");
});

document.getElementById("lancer-confirm").addEventListener("click", () => {
  const mois = Number(document.getElementById("l-mois").value);
  const annee = Number(document.getElementById("l-annee").value);
  const dureeText = document.getElementById("l-duree").value.trim();
  const echelle = Number(document.getElementById("l-echelle").value) || 5;

  const dureeMs = parseDuree(dureeText);
  if (!dureeMs) { showToast("Durée invalide. Ex : 24h, 1h30, 15min", "error"); return; }

  const selectedLivreIds = [...document.querySelectorAll("input[name='l-livre']:checked")].map(el => el.value);
  const selectedMembreIds = [...document.querySelectorAll("input[name='l-membre']:checked")].map(el => el.value);
  if (!selectedLivreIds.length) { showToast("Sélectionnez au moins un livre.", "error"); return; }
  if (!selectedMembreIds.length) { showToast("Sélectionnez au moins un membre.", "error"); return; }

  const expiresAt = new Date(Date.now() + dureeMs);
  pendingVoteData = { mois, annee, echelle, livre_ids: selectedLivreIds, membre_ids: selectedMembreIds, expires_at: expiresAt };

  const livreNames = selectedLivreIds.map(id => livres.find(l => l.id === id)?.titre ?? id);
  const membreNames = selectedMembreIds.map(id => membres.find(m => m.id === id)?.nom ?? id);

  document.getElementById("confirm-content").innerHTML = `
    <dl class="book-detail-meta">
      <dt>Mois</dt><dd>${formatMois(mois, annee)}</dd>
      <dt>Se termine le</dt><dd>${expiresAt.toLocaleString("fr-FR", { day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" })}</dd>
      <dt>Livres (${selectedLivreIds.length})</dt><dd>${livreNames.join(", ")}</dd>
      <dt>Membres (${selectedMembreIds.length})</dt><dd>${membreNames.join(", ")}</dd>
      <dt>Échelle</dt><dd>1 à ${echelle}</dd>
    </dl>`;

  document.getElementById("lancer-overlay").classList.add("hidden");
  document.getElementById("confirm-overlay").classList.remove("hidden");
});

["confirm-close"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => document.getElementById("confirm-overlay").classList.add("hidden"));
});
document.getElementById("confirm-back").addEventListener("click", () => {
  document.getElementById("confirm-overlay").classList.add("hidden");
  document.getElementById("lancer-overlay").classList.remove("hidden");
});

document.getElementById("confirm-launch").addEventListener("click", async () => {
  if (!pendingVoteData) return;
  try {
    await lancerVote(pendingVoteData);
    voteActif = await getVoteActif();
    showToast("Vote lancé !", "success");
    document.getElementById("confirm-overlay").classList.add("hidden");
    pendingVoteData = null;
    renderActiveVoteBanner();
    startCountdown();
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
});

// ── Soumettre son vote ─────────────────────────────────────────────

function openSoumettreModal() {
  if (!voteActif) return;
  const sel = document.getElementById("s-membre");
  sel.innerHTML = '<option value="">— Choisir —</option>';
  (voteActif.membre_ids || []).forEach(id => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = membres.find(m => m.id === id)?.nom ?? id;
    sel.appendChild(opt);
  });
  document.getElementById("s-step-identity").classList.remove("hidden");
  document.getElementById("s-step-notes").classList.add("hidden");
  document.getElementById("soumettre-overlay").classList.remove("hidden");
}

function renderNotesForm(membreId) {
  const container = document.getElementById("s-notes-list");
  if (!voteActif) return;
  const echelle = voteActif.echelle || 5;
  const existing = voteActif.bulletins?.[membreId] ?? {};
  container.innerHTML = (voteActif.livre_ids || []).map(livre_id => {
    const livre = livres.find(l => l.id === livre_id);
    const val = existing[livre_id] ?? "";
    return `<div class="form-group">
      <label>${livre?.titre ?? livre_id}</label>
      <input type="number" class="note-vote-input" data-livre="${livre_id}"
        min="1" max="${echelle}" step="0.5" placeholder="Note (1–${echelle})" value="${val}">
    </div>`;
  }).join("");
}

document.getElementById("s-confirm-identity").addEventListener("click", () => {
  const membreId = document.getElementById("s-membre").value;
  if (!membreId) { showToast("Choisissez votre nom dans la liste.", "error"); return; }
  const nom = membres.find(m => m.id === membreId)?.nom ?? membreId;

  if (!confirm(`Vous êtes bien ${nom} ?`)) return;

  const aDejaVote = voteActif.bulletins?.[membreId];
  if (aDejaVote && Object.keys(aDejaVote).length > 0) {
    if (!confirm(`${nom} a déjà soumis un vote. Voulez-vous le modifier et écraser le vote précédent ?`)) return;
  }

  document.getElementById("s-voter-label").textContent = `Vote de ${nom}`;
  renderNotesForm(membreId);
  document.getElementById("s-step-identity").classList.add("hidden");
  document.getElementById("s-step-notes").classList.remove("hidden");
});

document.getElementById("s-back-identity").addEventListener("click", () => {
  document.getElementById("s-step-notes").classList.add("hidden");
  document.getElementById("s-step-identity").classList.remove("hidden");
});

document.getElementById("btn-soumettre-vote").addEventListener("click", openSoumettreModal);
["soumettre-close", "soumettre-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => document.getElementById("soumettre-overlay").classList.add("hidden"));
});
document.getElementById("soumettre-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("soumettre-overlay").classList.add("hidden");
});

document.getElementById("soumettre-save").addEventListener("click", async () => {
  if (!voteActif) return;
  const membreId = document.getElementById("s-membre").value;
  if (!membreId) { showToast("Identité non confirmée.", "error"); return; }
  const notes = {};
  document.querySelectorAll(".note-vote-input").forEach(inp => {
    const v = inp.value.trim();
    if (v !== "") notes[inp.dataset.livre] = Number(v);
  });
  if (!Object.keys(notes).length) { showToast("Entrez au moins une note.", "error"); return; }
  try {
    await soumettreVote(voteActif.id, membreId, notes);
    voteActif.bulletins = { ...(voteActif.bulletins || {}), [membreId]: notes };
    showToast("Vote soumis !", "success");
    document.getElementById("soumettre-overlay").classList.add("hidden");
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
});

// ── Clôturer manuellement ──────────────────────────────────────────

document.getElementById("btn-cloturer-vote").addEventListener("click", async () => {
  if (!voteActif) return;
  if (!confirm("Clôturer le vote maintenant et calculer les résultats ?")) return;
  if (countdownInterval) clearInterval(countdownInterval);
  await closeExpiredVote(voteActif);
  voteActif = null;
  renderActiveVoteBanner();
});

document.getElementById("btn-annuler-vote").addEventListener("click", async () => {
  if (!voteActif) return;
  if (!confirm("Annuler le vote sans calculer les résultats ? Les statuts des livres ne seront pas modifiés.")) return;
  if (countdownInterval) clearInterval(countdownInterval);
  try {
    await annulerVoteActif(voteActif.id);
    voteActif = null;
    renderActiveVoteBanner();
    showToast("Vote annulé.", "success");
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
});

document.getElementById("detail-delete").addEventListener("click", async () => {
  if (!currentVoteId) return;
  const vote = votes.find(v => v.id === currentVoteId);
  if (!vote) return;
  if (!confirm(`Supprimer définitivement le vote de ${formatMois(vote.mois, vote.annee)} ? Les statuts des livres ne seront pas modifiés.`)) return;
  try {
    await deleteVote(currentVoteId);
    document.getElementById("detail-overlay").classList.add("hidden");
    currentVoteId = null;
    votes = await getVotes();
    renderList();
    showToast("Vote supprimé.", "success");
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
});

init().catch(console.error);
