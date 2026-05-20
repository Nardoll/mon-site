import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMembres, getLivres, getVotes, getStatutsForLivre, upsertStatutLecture, getLivreById, updateLivre } from "./db.js";
import { formatMois, formatDate, STATUTS_LECTURE, initiales, showToast } from "./utils.js";

await requireAuth();
initNav("accueil");

let allVotes = [], allMembres = [], allLivres = [];
let currentLivreId = null, currentVote = null, editMembreId = null;
let currentLivre = null, statutByMembre = {};

async function init() {
  [allVotes, allMembres, allLivres] = await Promise.all([getVotes(), getMembres(), getLivres()]);
  renderFrise();
  await renderCurrentBook();
  renderTimeline();
  initFriseDrag();
}

// ── Helpers ────────────────────────────────────────────────────────

function timeSince(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const days = Math.floor((new Date() - d) / 86400000);
  if (days < 1) return "aujourd'hui";
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30.5);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}

function toDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}

function nomMembre(id) {
  return allMembres.find(m => m.id === id)?.nom ?? "—";
}

// ── Frise chronologique ────────────────────────────────────────────

function buildEvents() {
  const events = [];

  allMembres.forEach(m => {
    const d = toDate(m.date_arrivee);
    if (!d) return;
    events.push({ date: d, type: "membre", size: "sm", data: m });
  });

  allLivres.forEach(l => {
    const d = toDate(l.date_proposition);
    if (!d) return;
    events.push({ date: d, type: "livre", size: "md", data: l });
  });

  allVotes.forEach(v => {
    const d = new Date(v.annee, v.mois - 1, 15);
    events.push({ date: d, type: v.livre_elu ? "elu" : "vote", size: "lg", data: v });
  });

  return events.sort((a, b) => a.date - b.date);
}

function renderFrise() {
  const section = document.getElementById("frise-section");
  const events = buildEvents();
  if (!events.length) { section.innerHTML = ""; return; }

  const H = 280, AXIS = 138, DOT_R = 7, STEM = 20;
  const WIDTHS = { sm: 118, md: 148, lg: 168 };

  const cols = events.map((ev, i) => {
    const isTop = i % 2 === 0;
    const w = WIDTHS[ev.size] || 148;
    const dotBg = { membre: "var(--muted)", livre: "var(--accent)", vote: "var(--purple)", elu: "var(--green)" }[ev.type] || "var(--muted)";
    const dotSize = { sm: 10, md: 12, lg: 16 }[ev.size] || 12;
    const dotY = AXIS - dotSize / 2;
    const stemTop = isTop ? AXIS - STEM - dotSize / 2 : AXIS + dotSize / 2;
    const cardBottom = isTop ? `${H - AXIS + STEM + dotSize / 2}px` : "auto";
    const cardTop    = isTop ? "auto" : `${AXIS + dotSize / 2 + STEM}px`;

    const dateStr = ev.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
    const dateLabelY = isTop ? `top:${AXIS + dotSize / 2 + 3}px` : `bottom:${H - AXIS + dotSize / 2 + 3}px`;

    let icon = "", title = "", sub = "";
    if (ev.type === "membre") {
      icon = "👤"; title = ev.data.nom; sub = "Arrivée";
    } else if (ev.type === "livre") {
      icon = "📚";
      title = ev.data.titre.length > 22 ? ev.data.titre.slice(0, 20) + "…" : ev.data.titre;
      sub = nomMembre(ev.data.propose_par);
    } else if (ev.type === "vote") {
      icon = "🗳️"; title = "Vote";
      sub = `${formatMois(ev.data.mois, ev.data.annee)}<br>${(ev.data.resultats || []).length} livres`;
    } else if (ev.type === "elu") {
      const r = (ev.data.resultats || []).find(x => x.livre_id === ev.data.livre_elu);
      icon = "🏆";
      const t = r?.titre ?? "Livre élu";
      title = t.length > 22 ? t.slice(0, 20) + "…" : t;
      sub = formatMois(ev.data.mois, ev.data.annee);
    }

    const borderColor = { membre: "var(--frise-membre-border)", livre: "var(--frise-livre-border)", vote: "var(--frise-vote-border)", elu: "var(--frise-elu-border)" }[ev.type];

    return `
      <div class="frise-ev-col" data-type="${ev.type}" data-id="${ev.data.id}" style="position:relative;flex-shrink:0;width:${w}px;height:${H}px;cursor:pointer">
        <div style="position:absolute;top:${dotY}px;left:calc(50% - ${dotSize/2}px);width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${dotBg};border:2.5px solid var(--bg);z-index:2"></div>
        <div style="position:absolute;left:calc(50% - 1px);top:${stemTop}px;width:2px;height:${STEM}px;background:var(--border)"></div>
        <div style="position:absolute;top:${cardTop};bottom:${cardBottom};left:5%;width:90%;background:var(--surface);border:1px solid ${borderColor};border-radius:6px;padding:.45rem .55rem;text-align:center">
          <span style="font-size:${ev.size === "lg" ? "1.15rem" : ev.size === "sm" ? ".85rem" : "1rem"};display:block;margin-bottom:.15rem">${icon}</span>
          <div style="font-size:.72rem;font-weight:700;line-height:1.25;color:#e0e0e0">${title}</div>
          <div style="font-size:.65rem;color:var(--muted);margin-top:.15rem;line-height:1.3">${sub}</div>
        </div>
        <div style="position:absolute;${dateLabelY};left:0;right:0;text-align:center;font-size:.6rem;color:#555">${dateStr}</div>
      </div>`;
  }).join("");

  section.innerHTML = `
    <div class="frise-wrap" id="frise-wrap">
      <div style="display:inline-flex;position:relative;height:${H}px;padding:0 3.5rem 0 1rem;min-width:100%" id="frise-track">
        <div style="position:absolute;left:0;right:2.2rem;top:${AXIS}px;height:2px;background:var(--border)"></div>
        <div style="position:absolute;right:1rem;top:${AXIS - 7}px;border-left:15px solid var(--muted);border-top:8px solid transparent;border-bottom:8px solid transparent"></div>
        ${cols}
      </div>
    </div>`;

  requestAnimationFrame(() => {
    const wrap = document.getElementById("frise-wrap");
    if (wrap) wrap.scrollLeft = wrap.scrollWidth;
  });

  section.querySelectorAll(".frise-ev-col").forEach(el => {
    el.addEventListener("click", () => {
      const { type, id } = el.dataset;
      if (type === "membre") window.location.href = `membres.html?open=${id}`;
      else if (type === "livre") window.location.href = `bibliotheque.html?open=${id}`;
      else if (type === "vote" || type === "elu") window.location.href = `votes.html?open=${id}`;
    });
  });
}

function initFriseDrag() {
  const wrap = document.getElementById("frise-wrap");
  if (!wrap) return;
  let isDown = false, startX, scrollLeft, moved = false;
  wrap.addEventListener("mousedown", e => { isDown = true; moved = false; startX = e.pageX - wrap.offsetLeft; scrollLeft = wrap.scrollLeft; wrap.style.cursor = "grabbing"; });
  wrap.addEventListener("mouseleave", () => { isDown = false; wrap.style.cursor = "grab"; });
  wrap.addEventListener("mouseup", () => { isDown = false; wrap.style.cursor = "grab"; });
  wrap.addEventListener("mousemove", e => { if (!isDown) return; moved = true; e.preventDefault(); wrap.scrollLeft = scrollLeft - (e.pageX - wrap.offsetLeft - startX); });
  wrap.addEventListener("click", e => { if (moved) { e.stopPropagation(); moved = false; } }, true);
  wrap.style.cursor = "grab";
}

// ── Livre du mois ──────────────────────────────────────────────────

function detectScale(vote, livreId) {
  const r = (vote?.resultats || []).find(x => x.livre_id === livreId);
  const notes = Object.values(r?.notes || {}).map(Number).filter(n => !isNaN(n));
  return notes.length && Math.max(...notes) <= 5 ? 5 : 10;
}

async function renderCurrentBook() {
  const section = document.getElementById("current-book-section");
  const elus = allVotes.filter(v => v.livre_elu).sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);
  if (!elus.length) {
    section.innerHTML = `<div class="empty-state"><span class="big-icon">📖</span>Aucun livre élu pour l'instant.</div>`;
    return;
  }

  const latest = elus[elus.length - 1];
  currentVote = latest;
  currentLivreId = latest.livre_elu;

  const [livre, statuts] = await Promise.all([getLivreById(currentLivreId), getStatutsForLivre(currentLivreId)]);
  currentLivre = livre;
  statutByMembre = {};
  statuts.forEach(s => { statutByMembre[s.membre_id] = s; });

  const r = (latest.resultats || []).find(x => x.livre_id === currentLivreId);
  const scale = detectScale(latest, currentLivreId);
  const moy = r?.moyenne ?? null;
  const proposeur = nomMembre(livre?.propose_par);
  const since = livre?.date_proposition ? timeSince(livre.date_proposition) : null;

  const unite = livre?.progression_unite || "";
  const progressionTotal = livre?.progression_total || null;
  const progressionLabel = unite
    ? `Suivi en ${unite}${progressionTotal ? ` · ${progressionTotal} max` : ""}`
    : "Aucun suivi configuré";

  section.innerHTML = `
    <div class="section-title">Lecture du mois — ${formatMois(latest.mois, latest.annee)}</div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem">
        <div>
          <div class="titre-livre-link" style="font-size:1.2rem;font-weight:700;cursor:pointer" title="Voir la fiche">${livre?.titre ?? "—"}</div>
          <div style="font-size:.8rem;color:var(--muted);margin-top:.3rem">
            ${livre?.auteur ? livre.auteur + " · " : ""}${since ? `Proposé ${since} par ${proposeur}` : ""}
          </div>
        </div>
        ${moy !== null ? `<div style="text-align:right"><span style="font-size:1.5rem;font-weight:800;color:var(--accent)">${Number(moy).toFixed(1)}</span><span style="font-size:.85rem;color:var(--muted)"> / ${scale}</span></div>` : ""}
      </div>
      <div style="height:1px;background:var(--border);margin-bottom:1rem"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
        <span style="font-size:.78rem;color:var(--muted)" id="progression-label">${progressionLabel}</span>
        <button class="btn btn-ghost btn-sm" id="btn-progression-config">⚙️ Configurer le suivi</button>
      </div>
      <ul class="status-list" id="status-list"></ul>
    </div>`;

  section.querySelector(".titre-livre-link").addEventListener("click", () => {
    window.location.href = `bibliotheque.html?open=${currentLivreId}`;
  });
  document.getElementById("btn-progression-config").addEventListener("click", openProgressionModal);

  renderStatusList();
}

function renderStatusList() {
  const list = document.getElementById("status-list");
  if (!list) return;
  const unite = currentLivre?.progression_unite || "";
  list.innerHTML = allMembres.map(m => {
    const s = statutByMembre[m.id];
    const statut = s?.statut ?? "pas_commence";
    const info = STATUTS_LECTURE[statut];
    let progress = "";
    if (s?.page_actuelle && s?.pages_totales && s.pages_totales > 0) {
      const pct = Math.min(100, Math.round(s.page_actuelle / s.pages_totales * 100));
      progress = `<div class="progress-wrap">
        <div class="progress-circle" style="--pct:${pct}%">
          <span class="progress-circle-text">${pct}%</span>
        </div>
        <span class="progress-text">${s.page_actuelle}/${s.pages_totales}${unite ? ` ${unite}` : ""}</span>
      </div>`;
    }
    return `
      <li class="status-row">
        <span class="membre-link" data-id="${m.id}" style="font-size:.88rem;cursor:pointer">${m.nom}</span>
        <div>
          <span class="st-badge st-${info.css}" data-membre="${m.id}" data-statut="${statut}">${info.label}</span>
          ${progress}
        </div>
      </li>`;
  }).join("");

  list.querySelectorAll(".membre-link").forEach(el => {
    el.addEventListener("click", () => { window.location.href = `membres.html?open=${el.dataset.id}`; });
  });
  list.querySelectorAll(".st-badge").forEach(b => b.addEventListener("click", () => openStatutModal(b.dataset.membre, b.dataset.statut)));
}

// ── Chronologie livres élus ────────────────────────────────────────

function renderTimeline() {
  const section = document.getElementById("timeline-section");
  const elus = allVotes.filter(v => v.livre_elu).sort((a, b) => b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois);
  if (!elus.length) {
    section.innerHTML = `<div class="empty-state"><span class="big-icon">📅</span>Aucun livre élu pour l'instant.</div>`;
    return;
  }
  section.innerHTML = `<div class="timeline">${elus.map(v => {
    const r = (v.resultats || []).find(x => x.livre_id === v.livre_elu);
    const scale = detectScale(v, v.livre_elu);
    return `
      <div class="tl-item">
        <div class="tl-card" data-livre-id="${v.livre_elu}">
          <div class="tl-month">${formatMois(v.mois, v.annee)}</div>
          <div class="tl-info">
            <div class="tl-title">${r?.titre ?? v.livre_elu}</div>
            ${r?.auteur ? `<div class="tl-author">${r.auteur}</div>` : ""}
          </div>
          ${r?.moyenne !== null && r?.moyenne !== undefined ? `<div class="tl-score">${Number(r.moyenne).toFixed(1)}/${scale}</div>` : ""}
        </div>
      </div>`;
  }).join("")}</div>`;

  section.querySelectorAll(".tl-card[data-livre-id]").forEach(card => {
    card.addEventListener("click", () => {
      window.location.href = `bibliotheque.html?open=${card.dataset.livreId}`;
    });
  });
}

// ── Modal statut ───────────────────────────────────────────────────

function openStatutModal(membreId, currentStatut) {
  editMembreId = membreId;
  const m = allMembres.find(x => x.id === membreId);
  document.getElementById("statut-modal-title").textContent = `Statut — ${m?.nom ?? ""}`;
  document.getElementById("statut-select").value = currentStatut;

  const unite = currentLivre?.progression_unite || "pages";
  const uniteLabel = unite.charAt(0).toUpperCase() + unite.slice(1);
  const labelActuel = document.getElementById("label-page-actuelle");
  const labelTotal = document.getElementById("label-pages-totales");
  if (labelActuel) labelActuel.textContent = `${uniteLabel} actuel(le)`;
  if (labelTotal) labelTotal.textContent = `Total (${unite})`;

  const existing = statutByMembre[membreId];
  document.getElementById("page-actuelle").value = existing?.page_actuelle ?? "";
  document.getElementById("pages-totales").value = existing?.pages_totales ?? (currentLivre?.progression_total || "");

  document.getElementById("statut-overlay").classList.remove("hidden");
}

["statut-modal-close","statut-modal-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => {
    document.getElementById("statut-overlay").classList.add("hidden");
    editMembreId = null;
  });
});

document.getElementById("statut-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) { document.getElementById("statut-overlay").classList.add("hidden"); editMembreId = null; }
});

document.getElementById("statut-modal-save").addEventListener("click", async () => {
  if (!editMembreId || !currentLivreId) return;
  const statut = document.getElementById("statut-select").value;
  const page_actuelle = document.getElementById("page-actuelle").value;
  const pages_totales = document.getElementById("pages-totales").value;
  try {
    await upsertStatutLecture({ membre_id: editMembreId, livre_id: currentLivreId, statut, page_actuelle, pages_totales });
    showToast("Statut mis à jour", "success");
    document.getElementById("statut-overlay").classList.add("hidden");
    editMembreId = null;
    const statuts = await getStatutsForLivre(currentLivreId);
    statutByMembre = {};
    statuts.forEach(s => { statutByMembre[s.membre_id] = s; });
    renderStatusList();
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
});

// ── Modal configuration du suivi ──────────────────────────────────

function openProgressionModal() {
  document.getElementById("progression-unite").value = currentLivre?.progression_unite || "";
  document.getElementById("progression-total-input").value = currentLivre?.progression_total || "";
  document.getElementById("progression-overlay").classList.remove("hidden");
}

["progression-close","progression-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => {
    document.getElementById("progression-overlay").classList.add("hidden");
  });
});

document.getElementById("progression-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("progression-overlay").classList.add("hidden");
});

document.getElementById("progression-save").addEventListener("click", async () => {
  const unite = document.getElementById("progression-unite").value.trim();
  const total = document.getElementById("progression-total-input").value;
  try {
    await updateLivre(currentLivreId, {
      progression_unite: unite || null,
      progression_total: total ? Number(total) : null,
    });
    showToast("Suivi configuré !", "success");
    document.getElementById("progression-overlay").classList.add("hidden");
    currentLivre = { ...currentLivre, progression_unite: unite || null, progression_total: total ? Number(total) : null };
    const label = document.getElementById("progression-label");
    if (label) {
      const u = currentLivre.progression_unite || "";
      const t = currentLivre.progression_total || null;
      label.textContent = u ? `Suivi en ${u}${t ? ` · ${t} max` : ""}` : "Aucun suivi configuré";
    }
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
});

init().catch(console.error);
