// Page vote publique — pas d'authentification requise
import { getLivres, getMembres, getVoteActif, lancerVote, soumettreVote, cloturerVoteActif } from "./db.js";
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
  livres = await getLivres();
  showToast("Le vote est terminé — résultats enregistrés.", "success");
}

// ── Init ───────────────────────────────────────────────────────────

async function init() {
  [livres, membres] = await Promise.all([getLivres(), getMembres()]);
  voteActif = await getVoteActif();

  if (voteActif && voteActif.expires_at?.toMillis() < Date.now()) {
    await closeExpiredVote(voteActif);
    voteActif = null;
    livres = await getLivres();
  }

  await autoLancerSiNecessaire();

  render();
  if (voteActif) startCountdown();
}

// ── Rendu principal ────────────────────────────────────────────────

function render() {
  renderBanner();
  renderBooks();
  renderVotingSection();
  renderVotantsBilan();
}

function renderVotantsBilan() {
  const el = document.getElementById("vote-votants-bilan");
  if (!el) return;
  if (!voteActif) { el.innerHTML = ""; return; }

  const memberIds = voteActif.membre_ids || [];
  const bulletins = voteActif.bulletins || {};
  const nbVotes = memberIds.filter(id => bulletins[id] && Object.keys(bulletins[id]).length > 0).length;

  const rows = memberIds.map(id => {
    const m = membres.find(mb => mb.id === id);
    const aVote = bulletins[id] && Object.keys(bulletins[id]).length > 0;
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

function renderBanner() {
  const banner = document.getElementById("vote-banner");

  if (voteActif) {
    const nbVotants = Object.keys(voteActif.bulletins || {}).length;
    const nbMembres = (voteActif.membre_ids || []).length;
    banner.className = "vote-banner vote-banner-active";
    banner.innerHTML = `
      <div class="vote-banner-icon">🗳️</div>
      <div class="vote-banner-body">
        <div class="vote-banner-title">Vote en cours — ${formatMois(voteActif.mois, voteActif.annee)}</div>
        <div class="vote-banner-sub">${(voteActif.livre_ids || []).length} livres · ${nbVotants}/${nbMembres} vote${nbVotants !== 1 ? "s" : ""} reçu${nbVotants !== 1 ? "s" : ""}</div>
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
  const livresPropo = voteActif
    ? (voteActif.livre_ids || []).map(id => livres.find(l => l.id === id)).filter(Boolean)
    : livres.filter(l => l.statut === "en_proposition");

  const grid = document.getElementById("vote-books-grid");

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
        ${renderVotingTable(livresPropo, true)}
      </div>`;

    document.getElementById("vote-confirm-identity").addEventListener("click", handleIdentityConfirm);
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

    document.getElementById("vote-change-identity").addEventListener("click", () => {
      membreIdentifie = null;
      renderVotingSection();
    });

    document.getElementById("vote-submit").addEventListener("click", handleSubmit);
  }
}

function handleIdentityConfirm() {
  const membreId = document.getElementById("vote-membre-select").value;
  if (!membreId) { showToast("Choisissez votre nom dans la liste.", "error"); return; }
  const nom = membres.find(m => m.id === membreId)?.nom ?? membreId;

  if (!confirm(`Vous êtes bien ${nom} ?`)) return;

  const aDejaVote = voteActif.bulletins?.[membreId];
  if (aDejaVote && Object.keys(aDejaVote).length > 0) {
    if (!confirm(`${nom} a déjà soumis un vote. Voulez-vous le modifier et écraser le vote précédent ?`)) return;
  }

  membreIdentifie = { id: membreId, nom };
  renderVotingSection();
}

async function handleSubmit() {
  if (!voteActif || !membreIdentifie) return;

  const notes = {};
  (voteActif.livre_ids || []).forEach(livre_id => {
    const checked = document.querySelector(`input[name="vr-${livre_id}"]:checked`);
    if (checked) notes[livre_id] = Number(checked.value);
  });

  const manquants = (voteActif.livre_ids || []).filter(id => notes[id] === undefined);
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
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
}

// ── Tableau de vote ────────────────────────────────────────────────

function renderVotingTable(livresPropo, disabled) {
  if (!livresPropo.length) {
    return `<div style="color:var(--muted);font-size:.88rem;padding:.75rem 0">Aucun livre pour ce vote.</div>`;
  }

  const ratings = [1, 2, 3, 4, 5];
  const headerCells = ratings.map(n => `<th class="vt-header-cell">${n}/5</th>`).join("");

  const rows = livresPropo.map(l => {
    const tooltipLines = [
      l.auteur ? `<strong>${escapeHtml(l.auteur)}</strong>` : "",
      l.annee ? `${l.annee}` : "",
      l.genre ? `<em>${escapeHtml(l.genre)}</em>` : "",
      l.nb_pages ? `${l.nb_pages} pages` : "",
      l.description_3_mots ? `<span style="margin-top:.25rem;display:block">${escapeHtml(l.description_3_mots)}</span>` : "",
    ].filter(Boolean).join(" · ");

    const radios = ratings.map(n => `
      <td class="vt-radio-cell">
        <input type="radio" name="vr-${l.id}" value="${n}"
          ${disabled ? "disabled" : ""}
          style="cursor:${disabled ? "default" : "pointer"};width:18px;height:18px;accent-color:var(--accent)">
      </td>`).join("");

    return `<tr class="vt-row">
      <td class="vt-label-cell">
        <span class="vote-book-tooltip-wrap">
          <span class="vt-titre">${escapeHtml(l.titre)}</span>
          ${l.auteur ? `<span class="vt-auteur"> — ${escapeHtml(l.auteur)}</span>` : ""}
          ${tooltipLines ? `<span class="vote-book-tooltip">${tooltipLines}</span>` : ""}
        </span>
      </td>
      ${radios}
    </tr>`;
  }).join("");

  return `
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
  countdownInterval = setInterval(() => {
    if (!voteActif) { clearInterval(countdownInterval); return; }
    if (voteActif.expires_at.toMillis() <= Date.now()) {
      clearInterval(countdownInterval);
      closeExpiredVote(voteActif).then(() => {
        voteActif = null;
        membreIdentifie = null;
        render();
      });
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
