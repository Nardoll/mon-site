// Page vote publique — pas d'authentification requise
import { getLivres, getMembres, getVoteActif, lancerVote, soumettreVote, cloturerVoteActif, lancerTour2 } from "./db.js";
import { formatMois, MOIS_NOMS, showToast } from "./utils.js";

// ── Thème (même clé que le reste du club) ─────────────────────────
(function() {
  if (localStorage.getItem("cl_theme") === "light") {
    document.documentElement.dataset.theme = "light";
  }
})();

const themeBtn   = document.getElementById("vote-theme-btn");
const themeIcon  = document.getElementById("vote-theme-icon");
const themeLabel = document.getElementById("vote-theme-label");

function applyThemeUI() {
  const isLight = document.documentElement.dataset.theme === "light";
  themeIcon.textContent  = isLight ? "🌙" : "☀️";
  themeLabel.textContent = isLight ? "Mode sombre" : "Mode clair";
}

applyThemeUI();

themeBtn.addEventListener("click", () => {
  const light = document.documentElement.dataset.theme !== "light";
  document.documentElement.dataset.theme = light ? "light" : "";
  localStorage.setItem("cl_theme", light ? "light" : "dark");
  applyThemeUI();
});

let livres = [], membres = [], voteActif = null;
let membreIdentifie = null;
let countdownInterval = null;
let nextCountdownInterval = null;

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

// ── Toggle infos livres (NON persisté en localStorage) ─────────────

document.getElementById("vote-ai-toggle").addEventListener("change", e => {
  document.body.classList.toggle("ai-infos-visible", e.target.checked);
});

// ── Badges description ─────────────────────────────────────────────

const BADGE_PALETTE = [
  { bg: "#dcfce7", fg: "#166534" }, { bg: "#dbeafe", fg: "#1e40af" },
  { bg: "#f3e8ff", fg: "#6b21a8" }, { bg: "#ffedd5", fg: "#9a3412" },
  { bg: "#ccfbf1", fg: "#115e59" }, { bg: "#fee2e2", fg: "#991b1b" },
];

function descBadge(desc) {
  if (!desc) return "";
  let h = 0;
  for (const c of desc) h = (h * 31 + c.charCodeAt(0)) | 0;
  const { bg, fg } = BADGE_PALETTE[Math.abs(h) % BADGE_PALETTE.length];
  return `<span class="desc-badge" style="background:${bg};color:${fg}">${escapeHtml(desc)}</span>`;
}

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
  } catch (e) { console.error("Auto-lancement vote :", e); }
}

// ── Clôture automatique Tour 1 ────────────────────────────────────

async function closeExpiredVote(va) {
  // Garde-fou : vérifier que le vote existe encore (peut avoir été clos depuis un autre onglet)
  const current = await getVoteActif();
  if (!current || current.id !== va.id) return;

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
    const moy  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const med  = median(vals);
    const score = (moy !== null && med !== null) ? (moy + med) / 2 : moy;
    return { livre_id, titre: livre?.titre ?? livre_id, auteur: livre?.auteur ?? "", notes, moyenne: score };
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
  showToast("Le vote est terminé — résultats enregistrés.", "success");
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
  showToast("Deuxième tour terminé — livre élu !", "success");
}

// ── Init ───────────────────────────────────────────────────────────

async function init() {
  [livres, membres] = await Promise.all([getLivres(), getMembres()]);
  voteActif = await getVoteActif();

  if (voteActif && voteActif.expires_at?.toMillis() < Date.now()) {
    await closeExpiredVote(voteActif);
    voteActif = await getVoteActif();
    livres = await getLivres();
  }

  await autoLancerSiNecessaire();

  render();
  if (voteActif) startCountdown();
}

// ── Rendu principal ────────────────────────────────────────────────

function render() {
  renderBanner();
  renderTour2Context();
  renderBooks();
  renderVotingSection();
  renderVotantsBilan();
}

// ── Contexte 2ème tour ────────────────────────────────────────────

function renderTour2Context() {
  const el = document.getElementById("vote-tour2-context");
  if (!el) return;
  if (!voteActif || voteActif.tour !== 2) { el.innerHTML = ""; el.classList.add("hidden"); return; }

  const resultats = voteActif.resultats_tour1 || [];
  const tour2Ids = new Set(voteActif.livre_ids || []);
  const sorted = [...resultats].sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));
  const maxMoy = Math.max(0, ...sorted.map(r => r.moyenne ?? 0));

  const rows = sorted.map(r => {
    const inTour2 = tour2Ids.has(r.livre_id);
    const isElim = !inTour2 && (r.moyenne ?? 0) <= 2.5;
    let color, badge;
    if (inTour2) {
      color = "var(--accent)";
      badge = `<span class="vote-t1-pre-badge vote-t1-pre-badge--tour2">⚖️ 2e tour</span>`;
    } else if (isElim) {
      color = "var(--elim, #888)";
      badge = `<span class="vote-t1-pre-badge vote-t1-pre-badge--elim">Éliminé</span>`;
    } else {
      color = "var(--purple, #9b59b6)";
      badge = `<span class="vote-t1-pre-badge vote-t1-pre-badge--reserve">Réserve</span>`;
    }
    const pct = maxMoy > 0 ? Math.round((r.moyenne ?? 0) / maxMoy * 100) : 0;
    return `
      <div class="vote-t1-pre-row">
        <div class="vote-t1-pre-name">${escapeHtml(r.titre)}</div>
        <div class="vote-t1-pre-bar"><div class="vote-t1-pre-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="vote-t1-pre-score" style="color:${color}">${r.moyenne !== null ? Number(r.moyenne).toFixed(2) : "—"}/5</div>
        ${badge}
      </div>`;
  }).join("");

  const nbTied = tour2Ids.size;
  el.innerHTML = `
    <div class="vote-tour2-context">
      <div class="vote-t2-ctx-title">⚖️ Deuxième tour — Égalité au 1er tour</div>
      <div class="vote-t2-ctx-sub">${nbTied} livres sont arrivés ex-æquo en tête du premier tour. Un deuxième tour est en cours pour les départager : chaque membre choisit <strong>un seul livre</strong>, celui qui obtient le plus de voix est élu.</div>
      <div class="vote-t2-ctx-preresults">
        <div class="vote-t2-ctx-preresults-title">Résultats du 1er tour</div>
        ${rows}
      </div>
    </div>`;
  el.classList.remove("hidden");
}

// ── Bannière ──────────────────────────────────────────────────────

function renderBanner() {
  const banner = document.getElementById("vote-banner");

  if (voteActif) {
    const bulletins = voteActif.bulletins || {};
    const memberIds = voteActif.membre_ids || [];
    const isTour2 = voteActif.tour === 2;
    const nbVotants = isTour2
      ? Object.values(bulletins).filter(v => v != null && v !== "").length
      : Object.keys(bulletins).filter(id => bulletins[id] && Object.keys(bulletins[id]).length > 0).length;
    const nbMembres = memberIds.length;

    banner.className = "vote-banner vote-banner-active";
    banner.innerHTML = `
      <div class="vote-banner-icon">${isTour2 ? "⚖️" : "🗳️"}</div>
      <div class="vote-banner-body">
        <div class="vote-banner-title">${isTour2 ? "Deuxième tour" : "Vote en cours"} — ${formatMois(voteActif.mois, voteActif.annee)}</div>
        <div class="vote-banner-sub">${(voteActif.livre_ids || []).length} livre${(voteActif.livre_ids || []).length !== 1 ? "s" : ""} · ${nbVotants}/${nbMembres} vote${nbVotants !== 1 ? "s" : ""} reçu${nbVotants !== 1 ? "s" : ""}</div>
        <div class="vote-banner-countdown" id="vote-countdown"></div>
      </div>`;
    updateCountdown();
  } else {
    const now = new Date();
    const nextVote = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const livresPropo = livres.filter(l => l.statut === "en_proposition");
    const moisStr = MOIS_NOMS[nextVote.getMonth()] + " " + nextVote.getFullYear();

    banner.className = "vote-banner vote-banner-waiting";
    banner.innerHTML = `
      <div class="vote-banner-icon">📅</div>
      <div class="vote-banner-body">
        <div class="vote-banner-title">Prochain vote — ${moisStr}</div>
        <div class="vote-banner-sub">${livresPropo.length} livre${livresPropo.length !== 1 ? "s" : ""} en compétition · Ouverture le 1er du mois</div>
        <div class="vote-banner-countdown" id="vote-next-countdown"></div>
      </div>`;

    startNextCountdown(nextVote);
  }
}

// ── Livres en compétition ──────────────────────────────────────────

function renderBooks() {
  const grid = document.getElementById("vote-books-grid");

  if (voteActif?.tour === 2) {
    // Tour 2 : tous les livres du tour 1 visibles, ceux hors tour 2 floutés
    const tour1Ids = voteActif.livre_ids_tour1 || [];
    const tour2Ids = new Set(voteActif.livre_ids || []);
    const allBooks = tour1Ids.map(id => livres.find(l => l.id === id)).filter(Boolean);

    if (!allBooks.length) {
      grid.innerHTML = `<div style="color:var(--muted);font-size:.88rem">Aucun livre.</div>`;
      return;
    }

    grid.innerHTML = allBooks.map(l => {
      const inTour2 = tour2Ids.has(l.id);
      return `
        <div class="vote-book-card${inTour2 ? "" : " vote-book-card-blurred"}">
          <div class="vote-book-titre">${escapeHtml(l.titre)}</div>
          <div class="vote-book-auteur">${escapeHtml(l.auteur || "—")}</div>
          <div class="vote-book-ai">
            ${l.genre ? `<div class="vote-book-genre">${escapeHtml(l.genre)}</div>` : ""}
            ${l.nb_pages ? `<div class="vote-book-pages">${l.nb_pages} pages</div>` : ""}
            ${descBadge(l.description_3_mots)}
          </div>
        </div>`;
    }).join("");
    return;
  }

  const livresPropo = voteActif
    ? (voteActif.livre_ids || []).map(id => livres.find(l => l.id === id)).filter(Boolean)
    : livres.filter(l => l.statut === "en_proposition");

  if (!livresPropo.length) {
    grid.innerHTML = `<div style="color:var(--muted);font-size:.88rem">Aucun livre en compétition pour l'instant.</div>`;
    return;
  }

  grid.innerHTML = livresPropo.map(l => `
    <div class="vote-book-card">
      <div class="vote-book-titre">${escapeHtml(l.titre)}</div>
      <div class="vote-book-auteur">${escapeHtml(l.auteur || "—")}</div>
      <div class="vote-book-ai">
        ${l.genre ? `<div class="vote-book-genre">${escapeHtml(l.genre)}</div>` : ""}
        ${l.nb_pages ? `<div class="vote-book-pages">${l.nb_pages} pages</div>` : ""}
        ${descBadge(l.description_3_mots)}
      </div>
    </div>`).join("");
}

// ── Section vote ───────────────────────────────────────────────────

function renderVotingSection() {
  const section = document.getElementById("vote-section-content");

  const livresPropo = voteActif
    ? (voteActif.livre_ids || []).map(id => livres.find(l => l.id === id)).filter(Boolean)
    : livres.filter(l => l.statut === "en_proposition");

  if (!voteActif) {
    section.innerHTML = `
      <div class="vote-preview-msg">Le vote n'a pas encore commencé — voici un aperçu de l'interface</div>
      <div class="vote-preview-wrap">
        ${renderVotingTable(livresPropo, true)}
      </div>`;
    return;
  }

  if (!membreIdentifie) {
    section.innerHTML = `
      <div class="vote-identity-row">
        <label style="font-size:.88rem;font-weight:500;color:var(--muted);white-space:nowrap">Qui êtes-vous ?</label>
        <select id="vote-membre-select">
          <option value="">— Choisir —</option>
          ${(voteActif.membre_ids || []).map(id => {
            const m = membres.find(m => m.id === id);
            return `<option value="${id}">${escapeHtml(m?.nom ?? id)}</option>`;
          }).join("")}
        </select>
        <button class="btn btn-primary" id="vote-confirm-identity">Continuer →</button>
      </div>
      <div class="vote-preview-wrap">
        ${voteActif.tour === 2
          ? renderVotingTableTour2(livresPropo, true)
          : renderVotingTable(livresPropo, true)}
      </div>`;
    document.getElementById("vote-confirm-identity").addEventListener("click", handleIdentityConfirm);
    return;
  }

  if (voteActif.tour === 2) {
    section.innerHTML = `
      <div class="vote-voter-label">
        Vote de <strong>${escapeHtml(membreIdentifie.nom)}</strong>
        <button class="btn btn-ghost btn-sm" id="vote-change-identity" style="font-size:.75rem;margin-left:.5rem">← Changer</button>
      </div>
      <div class="vote-t2-instructions">Choisissez le livre que vous souhaitez lire ce mois-ci :</div>
      ${renderVotingTableTour2(livresPropo, false)}
      <div style="display:flex;justify-content:flex-end;margin-top:1.25rem">
        <button class="btn btn-primary" id="vote-submit">✓ Soumettre mon vote</button>
      </div>`;
  } else {
    section.innerHTML = `
      <div class="vote-voter-label">
        Vote de <strong>${escapeHtml(membreIdentifie.nom)}</strong>
        <button class="btn btn-ghost btn-sm" id="vote-change-identity" style="font-size:.75rem;margin-left:.5rem">← Changer</button>
      </div>
      ${renderVotingTable(livresPropo, false)}
      <div style="display:flex;justify-content:flex-end;margin-top:1.25rem">
        <button class="btn btn-primary" id="vote-submit">✓ Soumettre mon vote</button>
      </div>`;
  }

  document.getElementById("vote-change-identity").addEventListener("click", () => {
    membreIdentifie = null;
    renderVotingSection();
  });
  document.getElementById("vote-submit").addEventListener("click", handleSubmit);

  // Activer les cases "Déjà lu"
  document.querySelectorAll(".vt-read-check").forEach(cb => {
    cb.addEventListener("change", () => {
      const row = cb.closest("tr");
      row.classList.toggle("vt-row-read", cb.checked);
      row.querySelectorAll('input[type="radio"]').forEach(r => {
        r.disabled = cb.checked;
        if (cb.checked) r.checked = false;
      });
    });
  });
}

// ── Tableau vote Tour 1 (notes 1–5) ───────────────────────────────

function renderVotingTable(livresPropo, disabled) {
  if (!livresPropo.length) {
    return `<div style="color:var(--muted);font-size:.88rem;padding:.75rem 0">Aucun livre pour ce vote.</div>`;
  }

  const ratings = [1, 2, 3, 4, 5];
  const headerCells = ratings.map(n => {
    const isElim = n <= 2;
    return `<th class="vt-header-cell vt-col-${n}">
      <span class="vt-col-num">${n}/5</span>
      ${isElim ? '<span class="vt-elim-tag">&#9249; élim.</span>' : ''}
    </th>`;
  }).join("");

  const rows = livresPropo.map(l => {
    const tooltipLines = [
      l.auteur ? `<strong>${escapeHtml(l.auteur)}</strong>` : "",
      l.annee ? `${l.annee}` : "",
      l.genre ? `<em>${escapeHtml(l.genre)}</em>` : "",
      l.nb_pages ? `${l.nb_pages} pages` : "",
      l.description_3_mots ? `<span style="margin-top:.25rem;display:block">${escapeHtml(l.description_3_mots)}</span>` : "",
    ].filter(Boolean).join(" · ");

    const radios = ratings.map(n => `
      <td class="vt-radio-cell vt-col-${n}">
        <input type="radio" name="vr-${l.id}" value="${n}"
          ${disabled ? "disabled" : ""}
          style="cursor:${disabled ? "default" : "pointer"};width:18px;height:18px;accent-color:var(--accent)">
      </td>`).join("");

    const readCheck = `<label class="vt-read-label">
      <input type="checkbox" class="vt-read-check" data-livre="${l.id}" ${disabled ? "disabled" : ""}>
      <span>Déjà lu — je passe</span>
    </label>`;

    return `<tr class="vt-row">
      <td class="vt-label-cell">
        <span class="vote-book-tooltip-wrap">
          <span class="vt-titre">${escapeHtml(l.titre)}</span>
          ${l.auteur ? `<span class="vt-auteur"> — ${escapeHtml(l.auteur)}</span>` : ""}
          ${tooltipLines ? `<span class="vote-book-tooltip">${tooltipLines}</span>` : ""}
        </span>
        ${readCheck}
      </td>
      ${radios}
    </tr>`;
  }).join("");

  return `
    <div class="vt-rules">
      📋 <strong>Comment ça marche :</strong> notez chaque livre de 1 à 5. Le score est calculé comme <strong>(moyenne + médiane) ÷ 2</strong> — cela réduit l'impact des notes extrêmes. Le livre avec le <strong>plus haut score</strong> est élu. Tout score <strong>≤ 2,5</strong> élimine le livre définitivement. Si vous avez <strong>déjà lu</strong> un livre, cochez la case pour l'exclure de votre vote.
    </div>
    <div style="font-size:.82rem;color:var(--muted);margin-bottom:.6rem">
      🔢 <strong style="color:var(--text)">1</strong> = je veux le moins lire &nbsp;·&nbsp; <strong style="color:var(--text)">5</strong> = je veux le plus lire
    </div>
    <div style="overflow-x:auto">
      <table class="vt-table">
        <thead><tr>
          <th class="vt-label-cell"></th>
          ${headerCells}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${disabled ? "" : '<div style="font-size:.73rem;color:var(--muted);margin-top:.5rem">* Une note par livre est requise.</div>'}`;
}

// ── Tableau vote Tour 2 (choix unique) ─────────────────────────────

function renderVotingTableTour2(livresPropo, disabled) {
  if (!livresPropo.length) {
    return `<div style="color:var(--muted);font-size:.88rem;padding:.75rem 0">Aucun livre pour ce vote.</div>`;
  }
  const rows = livresPropo.map(l => `
    <label class="vt2-choice-row">
      <input type="radio" name="tour2-choix" value="${l.id}"
        ${disabled ? "disabled" : ""}
        style="width:20px;height:20px;accent-color:var(--accent);cursor:${disabled ? "default" : "pointer"};flex-shrink:0">
      <div class="vt2-choice-info">
        <div class="vt-titre">${escapeHtml(l.titre)}</div>
        ${l.auteur ? `<div class="vt2-choice-auteur">${escapeHtml(l.auteur)}</div>` : ""}
      </div>
    </label>`).join("");
  return `<div class="vt2-choices">${rows}</div>
    ${disabled ? "" : '<div style="font-size:.73rem;color:var(--muted);margin-top:.5rem">* Sélectionnez un seul livre.</div>'}`;
}

// ── Clôture anticipée si 100% participation ───────────────────────

function checkAllVoted() {
  if (!voteActif) return false;
  const memberIds = voteActif.membre_ids || [];
  if (!memberIds.length) return false;
  const bulletins = voteActif.bulletins || {};
  const isTour2 = voteActif.tour === 2;
  return memberIds.every(id => {
    const b = bulletins[id];
    return isTour2 ? (b != null && b !== "") : (b && Object.keys(b).length > 0);
  });
}

async function triggerEarlyClose() {
  clearInterval(countdownInterval);
  await closeExpiredVote(voteActif);
  voteActif = await getVoteActif();
  livres = await getLivres();
  membreIdentifie = null;
  render();
  if (voteActif) startCountdown();
}

// ── Identification ─────────────────────────────────────────────────

function handleIdentityConfirm() {
  const membreId = document.getElementById("vote-membre-select").value;
  if (!membreId) { showToast("Choisissez votre nom dans la liste.", "error"); return; }
  const nom = membres.find(m => m.id === membreId)?.nom ?? membreId;

  if (!confirm(`Vous êtes bien ${nom} ?`)) return;

  const bulletin = voteActif.bulletins?.[membreId];
  const aDejaVote = voteActif.tour === 2
    ? bulletin != null && bulletin !== ""
    : bulletin && Object.keys(bulletin).length > 0;

  if (aDejaVote) {
    if (!confirm(`${nom} a déjà soumis un vote. Voulez-vous le modifier et écraser le vote précédent ?`)) return;
  }

  membreIdentifie = { id: membreId, nom };
  renderVotingSection();
}

// ── Soumettre le vote ──────────────────────────────────────────────

async function handleSubmit() {
  if (!voteActif || !membreIdentifie) return;

  if (voteActif.tour === 2) {
    const checked = document.querySelector('input[name="tour2-choix"]:checked');
    if (!checked) { showToast("Choisissez un livre.", "error"); return; }
    try {
      await soumettreVote(voteActif.id, membreIdentifie.id, checked.value);
      voteActif.bulletins = { ...(voteActif.bulletins || {}), [membreIdentifie.id]: checked.value };
      showToast("Vote soumis ! Merci.", "success");
      renderBanner();
      renderVotantsBilan();
      const btn = document.getElementById("vote-submit");
      if (btn) { btn.disabled = true; btn.textContent = "✓ Vote enregistré"; btn.style.opacity = ".6"; }
      if (checkAllVoted()) await triggerEarlyClose();
    } catch (e) { showToast("Erreur : " + e.message, "error"); }
    return;
  }

  const notes = {};
  (voteActif.livre_ids || []).forEach(livre_id => {
    const checked = document.querySelector(`input[name="vr-${livre_id}"]:checked`);
    if (checked) notes[livre_id] = Number(checked.value);
  });

  const dejaLus = new Set([...document.querySelectorAll(".vt-read-check:checked")].map(el => el.dataset.livre));
  const manquants = (voteActif.livre_ids || []).filter(id => !dejaLus.has(id) && notes[id] === undefined);
  if (manquants.length) {
    showToast(`Donnez une note à chaque livre (${manquants.length} manquant${manquants.length > 1 ? "s" : ""}).`, "error");
    return;
  }

  try {
    await soumettreVote(voteActif.id, membreIdentifie.id, notes);
    voteActif.bulletins = { ...(voteActif.bulletins || {}), [membreIdentifie.id]: notes };
    showToast("Vote soumis ! Merci.", "success");
    renderBanner();
    renderVotantsBilan();
    const btn = document.getElementById("vote-submit");
    if (btn) { btn.disabled = true; btn.textContent = "✓ Vote enregistré"; btn.style.opacity = ".6"; }
    if (checkAllVoted()) await triggerEarlyClose();
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
}

// ── Bilan des votants ──────────────────────────────────────────────

function renderVotantsBilan() {
  const el = document.getElementById("vote-votants-bilan");
  if (!el) return;
  if (!voteActif) { el.innerHTML = ""; return; }

  const memberIds = voteActif.membre_ids || [];
  const bulletins = voteActif.bulletins || {};
  const isTour2 = voteActif.tour === 2;

  const hasVoted = (id) => {
    const b = bulletins[id];
    if (isTour2) return b != null && b !== "";
    return b && Object.keys(b).length > 0;
  };

  const nbVotes = memberIds.filter(id => hasVoted(id)).length;

  const rows = memberIds.map(id => {
    const m = membres.find(mb => mb.id === id);
    const aVote = hasVoted(id);
    return `<div class="bilan-row ${aVote ? "bilan-voted" : "bilan-pending"}">
      <span class="bilan-icon">${aVote ? "✓" : "·"}</span>
      <span class="bilan-nom">${escapeHtml(m?.nom ?? id)}</span>
    </div>`;
  }).join("");

  el.innerHTML = `
    <div class="vote-votants-bilan-wrap">
      <div class="vote-bilan-title">Participation — ${nbVotes} / ${memberIds.length}</div>
      <div class="bilan-list">${rows}</div>
    </div>`;
}

// ── Countdown ──────────────────────────────────────────────────────

function startNextCountdown(target) {
  if (nextCountdownInterval) clearInterval(nextCountdownInterval);
  updateNextCountdown(target);
  nextCountdownInterval = setInterval(() => updateNextCountdown(target), 1000);
}

function updateNextCountdown(target) {
  const el = document.getElementById("vote-next-countdown");
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
      membreIdentifie = null;
      render();
      if (voteActif) startCountdown();
      return;
    }
    updateCountdown();
  }, 1000);
}

function updateCountdown() {
  const el = document.getElementById("vote-countdown");
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

init().catch(console.error);
