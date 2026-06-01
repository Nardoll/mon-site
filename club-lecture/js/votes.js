import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getVotes, getMembres, getLivres, addVote, updateVote, getVoteActif, lancerVote, cloturerVoteActif, annulerVoteActif, lancerTour2 } from "./db.js";

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
import { formatMois, MOIS_NOMS, moyenne, showToast } from "./utils.js";

await requireAuth();
initNav("votes");

let votes = [], membres = [], livres = [];
let currentVoteId = null;
let voteActif = null;
let countdownInterval = null;
let nextCountdownInterval = null;

// ── Auto-lancement le 1er du mois ─────────────────────────────────

async function autoLancerSiNecessaire() {
  const today = new Date();
  if (today.getDate() !== 1) return;
  if (voteActif) return;

  const livresPropo = livres.filter(l => l.statut === "en_proposition");
  if (!livresPropo.length) return;

  const expires = new Date(today.getFullYear(), today.getMonth(), 1, 23, 59, 59, 0);

  try {
    await lancerVote({
      mois: today.getMonth() + 1,
      annee: today.getFullYear(),
      livre_ids: livresPropo.map(l => l.id),
      membre_ids: membres.map(m => m.id),
      echelle: 5,
      expires_at: expires,
    });
    voteActif = await getVoteActif();
    showToast("Vote du mois lancé automatiquement !", "success");
  } catch (e) { console.error("Auto-lancement vote :", e); }
}

// ── Init ───────────────────────────────────────────────────────────

async function init() {
  [votes, membres, livres] = await Promise.all([getVotes(), getMembres(), getLivres()]);
  voteActif = await getVoteActif();

  if (voteActif && voteActif.expires_at?.toMillis() < Date.now()) {
    await closeExpiredVote(voteActif);
    voteActif = await getVoteActif();
    livres = await getLivres();
  }

  await autoLancerSiNecessaire();

  renderList();
  renderStatusCard();
  if (voteActif) startCountdown();

  const openId = new URLSearchParams(window.location.search).get("open");
  if (openId) openDetail(openId);
}

// ── Clôture automatique Tour 1 ────────────────────────────────────

async function closeExpiredVote(va) {
  if (va.tour === 2) {
    await closeExpiredVoteTour2(va);
    return;
  }

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
    if (winners.length === 1) {
      livre_elu = winners[0].livre_id;
    } else {
      // Égalité → lancer le 2ème tour
      const today = new Date();
      const expires2 = new Date(today.getFullYear(), today.getMonth(), 2, 23, 59, 59, 0);
      try {
        await lancerTour2(va.id, {
          livre_ids_tour2: winners.map(w => w.livre_id),
          livre_ids_tour1: va.livre_ids,
          resultats_tour1: resultats,
          expires_at: expires2,
        });
        showToast(`Égalité entre ${winners.length} livres ! 2ème tour lancé.`, "info");
      } catch (e) { console.error("Lancement 2ème tour :", e); }
      return;
    }
  }

  await cloturerVoteActif(va.id, { mois: va.mois, annee: va.annee, resultats, livre_elu });
  votes = await getVotes();
  livres = await getLivres();
  showToast("Vote clôturé !", "success");
  renderList();
}

// ── Clôture automatique Tour 2 ────────────────────────────────────

async function closeExpiredVoteTour2(va) {
  const bulletins2 = va.bulletins || {};
  const livre_ids = va.livre_ids || [];

  const voteCounts = {};
  livre_ids.forEach(id => voteCounts[id] = 0);
  Object.values(bulletins2).forEach(choix => {
    if (choix && livre_ids.includes(choix)) voteCounts[choix]++;
  });

  const resultats_tour2 = livre_ids.map(livre_id => {
    const livre = livres.find(l => l.id === livre_id);
    return { livre_id, titre: livre?.titre ?? livre_id, auteur: livre?.auteur ?? "", votes: voteCounts[livre_id] || 0 };
  });

  const maxVotes = Math.max(0, ...resultats_tour2.map(r => r.votes));
  const winners = resultats_tour2.filter(r => r.votes === maxVotes);
  let livre_elu;
  let tirage_au_sort = false;

  if (winners.length === 1) {
    livre_elu = winners[0].livre_id;
  } else {
    livre_elu = winners[Math.floor(Math.random() * winners.length)].livre_id;
    tirage_au_sort = true;
  }

  await cloturerVoteActif(va.id, {
    mois: va.mois,
    annee: va.annee,
    resultats: va.resultats_tour1,
    livre_elu,
    tour2: { resultats: resultats_tour2, livre_elu, tirage_au_sort },
  });
  votes = await getVotes();
  livres = await getLivres();
  showToast("Deuxième tour terminé — livre élu !", "success");
  renderList();
}

// ── Encart statut vote ─────────────────────────────────────────────

function renderStatusCard() {
  const card = document.getElementById("vote-status-card");
  if (!card) return;
  if (nextCountdownInterval) { clearInterval(nextCountdownInterval); nextCountdownInterval = null; }

  if (voteActif) {
    const bulletins = voteActif.bulletins || {};
    const isTour2 = voteActif.tour === 2;
    const hasVoted = (id) => {
      const b = bulletins[id];
      if (isTour2) return b != null && b !== "";
      return b && Object.keys(b).length > 0;
    };
    const nbVotants = (voteActif.membre_ids || []).filter(id => hasVoted(id)).length;
    const nbMembres = (voteActif.membre_ids || []).length;
    const bilanRows = (voteActif.membre_ids || []).map(id => {
      const m = membres.find(mb => mb.id === id);
      const aVote = hasVoted(id);
      return `<div class="bilan-row ${aVote ? "bilan-voted" : "bilan-pending"}">
        <span class="bilan-icon">${aVote ? "✓" : "·"}</span>
        <span class="bilan-nom">${m?.nom ?? id}</span>
      </div>`;
    }).join("");
    card.innerHTML = `
      <div class="vsc-active">
        <div class="vsc-left">
          <div class="vsc-icon">${isTour2 ? "⚖️" : "🗳️"}</div>
          <div>
            <div class="vsc-title">${isTour2 ? "Deuxième tour" : "Vote en cours"} — ${formatMois(voteActif.mois, voteActif.annee)}</div>
            <div class="vsc-meta">${(voteActif.livre_ids || []).length} livres · ${nbVotants}/${nbMembres} votes reçus</div>
            <div class="vsc-countdown" id="vsc-countdown"></div>
            <div class="vsc-bilan"><div class="bilan-list">${bilanRows}</div></div>
          </div>
        </div>
        <div class="vsc-right">
          <a href="vote.html" class="btn btn-primary">🗳️ Accéder au vote →</a>
        </div>
      </div>`;

    updateCountdown();
  } else {
    const now = new Date();
    const livresPropo = livres.filter(l => l.statut === "en_proposition");
    const nextVote = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const moisStr = MOIS_NOMS[nextVote.getMonth()] + " " + nextVote.getFullYear();

    card.innerHTML = `
      <a href="vote.html" class="vsc-next-link">
        <div class="vsc-next">
          <div class="vsc-icon">📅</div>
          <div class="vsc-next-body">
            <div class="vsc-title">Prochain vote — ${moisStr}</div>
            <div class="vsc-meta">${livresPropo.length} livre${livresPropo.length !== 1 ? "s" : ""} en compétition · Ouverture le 1er du mois</div>
            <div class="vsc-countdown-label" id="vsc-next-countdown"></div>
          </div>
          <div class="vsc-arrow">›</div>
        </div>
      </a>`;

    startNextCountdown(nextVote);
  }
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  updateCountdown();
  countdownInterval = setInterval(async () => {
    if (!voteActif) { clearInterval(countdownInterval); return; }
    if (voteActif.expires_at.toMillis() <= Date.now()) {
      clearInterval(countdownInterval);
      await closeExpiredVote(voteActif);
      voteActif = await getVoteActif();
      livres = await getLivres();
      renderStatusCard();
      if (voteActif) startCountdown();
      return;
    }
    updateCountdown();
  }, 1000);
}

function updateCountdown() {
  const el = document.getElementById("vsc-countdown");
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

function startNextCountdown(target) {
  if (nextCountdownInterval) clearInterval(nextCountdownInterval);
  updateNextCountdown(target);
  nextCountdownInterval = setInterval(() => updateNextCountdown(target), 1000);
}

function updateNextCountdown(target) {
  const el = document.getElementById("vsc-next-countdown");
  if (!el) { clearInterval(nextCountdownInterval); return; }
  const ms = target - Date.now();
  if (ms <= 0) { el.textContent = "C'est aujourd'hui !"; clearInterval(nextCountdownInterval); return; }
  const j = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const parts = [];
  if (j > 0) parts.push(`${j}j`);
  parts.push(`${String(h).padStart(2, "0")}h`);
  parts.push(`${String(m).padStart(2, "0")}min`);
  parts.push(`${String(s).padStart(2, "0")}s`);
  el.textContent = parts.join(" ");
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

  // Tour 1 : pas de gagnant à surligner si vote en 2 tours (égalité au 1er)
  const tour1EluId = vote.tour2 ? null : eluId;

  let html = "";
  if (vote.tour2) {
    html += `<div class="vote-tour-label">Tour 1 — Résultats (égalité)</div>`;
  }
  html += renderChart(sorted, scale, threshold, tour1EluId);
  html += `<div class="divider"></div>`;
  html += `<div class="card-title mb-2">Votes individuels${vote.tour2 ? " — Tour 1" : ""}</div>`;
  html += renderTable(sorted, membres, scale, tour1EluId);
  if (vote.tour2) {
    html += `<div class="divider"></div>`;
    html += renderTour2Section(vote.tour2, eluId);
  }
  return html;
}

function renderTour2Section(tour2, eluId) {
  const resultats = [...(tour2.resultats || [])].sort((a, b) => b.votes - a.votes);
  const maxVotes = Math.max(0, ...resultats.map(r => r.votes));

  const bars = resultats.map(r => {
    const isWinner = r.livre_id === eluId;
    const color = isWinner ? "var(--green)" : "var(--purple)";
    const pct = maxVotes > 0 ? Math.round(r.votes / maxVotes * 100) : 0;
    return `<div class="vote-t2-detail-row">
      <div class="vote-t2-detail-label" title="${escapeHtml(r.titre)}">${escapeHtml(r.titre)}</div>
      <div class="vote-t2-detail-bar-wrap">
        <div class="vote-t2-detail-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="vote-t2-detail-count" style="color:${color}">${r.votes} vote${r.votes !== 1 ? "s" : ""}</div>
      ${isWinner ? `<span style="color:var(--green);font-size:1rem">🏆</span>` : ""}
    </div>`;
  }).join("");

  return `
    <div class="vote-tour-label">Tour 2 — Vote par choix unique${tour2.tirage_au_sort ? " · tirage au sort" : ""}</div>
    ${tour2.tirage_au_sort ? `<div class="vote-t2-tirage-notice">🎲 Égalité au 2ème tour — le gagnant a été désigné par tirage au sort parmi les ex-æquo.</div>` : ""}
    <div class="vote-t2-detail">${bars}</div>`;
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

// ── Modifier vote ──────────────────────────────────────────────────

document.getElementById("detail-edit").addEventListener("click", () => {
  const vote = votes.find(v => v.id === currentVoteId);
  if (!vote) return;
  document.getElementById("e-mois").value = vote.mois;
  document.getElementById("e-annee").value = vote.annee;
  if (vote.date) {
    const d = vote.date.toDate ? vote.date.toDate() : new Date(vote.date.seconds * 1000);
    document.getElementById("e-date").value = d.toISOString().split("T")[0];
  } else {
    document.getElementById("e-date").value = "";
  }
  document.getElementById("edit-overlay").classList.remove("hidden");
});
["edit-close", "edit-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => document.getElementById("edit-overlay").classList.add("hidden"));
});
document.getElementById("edit-save").addEventListener("click", async () => {
  if (!currentVoteId) return;
  const mois = Number(document.getElementById("e-mois").value);
  const annee = Number(document.getElementById("e-annee").value);
  const dateVal = document.getElementById("e-date").value;
  try {
    await updateVote(currentVoteId, { mois, annee, date: dateVal || null });
    showToast("Vote mis à jour !", "success");
    document.getElementById("edit-overlay").classList.add("hidden");
    votes = await getVotes();
    renderList();
    document.getElementById("detail-title").textContent = `Vote — ${formatMois(mois, annee)}`;
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
});

init().catch(console.error);
