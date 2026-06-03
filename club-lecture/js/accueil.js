import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMembres, getLivres, getVotes, getStatutsForLivre, upsertStatutLecture, getLivreById, updateLivre, addCommentaire, getCommentairesForLivre, getReunions, addProgressionPoint, getProgressionForLivre, updateReunion } from "./db.js";
import { formatMois, formatDate, STATUTS_LECTURE, initiales, showToast } from "./utils.js";

await requireAuth();
initNav("accueil");

let allVotes = [], allMembres = [], allLivres = [], allReunions = [];
let currentLivreId = null, currentVote = null, editMembreId = null;
let currentLivre = null, statutByMembre = {};
let chartInstance = null, chartVisible = false;

async function migrerLecteursIds(reunions) {
  const aMigrer = reunions.filter(r => r.lecteurs_ids == null);
  if (!aMigrer.length) return;
  await Promise.all(aMigrer.map(r => {
    const lecteurs_ids = Object.entries(r.notes_finales || {})
      .filter(([, note]) => Number(note) > 0)
      .map(([id]) => id);
    r.lecteurs_ids = lecteurs_ids;
    return updateReunion(r.id, { lecteurs_ids });
  }));
}

async function init() {
  [allVotes, allMembres, allLivres, allReunions] = await Promise.all([getVotes(), getMembres(), getLivres(), getReunions()]);
  await migrerLecteursIds(allReunions);
  renderFrise();
  await renderCurrentBook();
  renderPodium();
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
    const d = v.date ? toDate(v.date) : new Date(v.annee, v.mois - 1, 15);
    events.push({ date: d, type: v.livre_elu ? "elu" : "vote", size: "lg", data: v });
  });

  allReunions.forEach(r => {
    const d = r.date ? toDate(r.date) : new Date(r.annee, r.mois - 1, 15);
    if (!d) return;
    const type = r.statut === "prevue" ? "reunion_prevue" : "reunion";
    events.push({ date: d, type, size: "md", data: r });
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
    const dotBg = { membre: "var(--muted)", livre: "var(--accent)", vote: "var(--purple)", elu: "var(--green)", reunion: "#5b9cf6", reunion_prevue: "var(--muted)" }[ev.type] || "var(--muted)";
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
    } else if (ev.type === "reunion" || ev.type === "reunion_prevue") {
      icon = ev.type === "reunion_prevue" ? "📅" : "📝";
      const livreR = allLivres.find(l => l.id === ev.data.livre_id);
      const t = livreR?.titre ?? "Réunion";
      title = t.length > 22 ? t.slice(0, 20) + "…" : t;
      sub = ev.type === "reunion_prevue"
        ? `${formatMois(ev.data.mois, ev.data.annee)}<br>À venir`
        : `${formatMois(ev.data.mois, ev.data.annee)}<br>${(ev.data.participant_ids || []).length} participant${(ev.data.participant_ids || []).length > 1 ? "s" : ""}`;
    }

    const borderColor = { membre: "var(--frise-membre-border)", livre: "var(--frise-livre-border)", vote: "var(--frise-vote-border)", elu: "var(--frise-elu-border)", reunion: "var(--frise-reunion-border)", reunion_prevue: "var(--frise-reunion-prevue-border)" }[ev.type];

    return `
      <div class="frise-ev-col" data-type="${ev.type}" data-id="${ev.data.id}" style="position:relative;flex-shrink:0;width:${w}px;height:${H}px;cursor:pointer">
        <div style="position:absolute;top:${dotY}px;left:calc(50% - ${dotSize/2}px);width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${dotBg};border:2.5px solid var(--bg);z-index:2"></div>
        <div style="position:absolute;left:calc(50% - 1px);top:${stemTop}px;width:2px;height:${STEM}px;background:var(--border)"></div>
        <div style="position:absolute;top:${cardTop};bottom:${cardBottom};left:5%;width:90%;background:var(--surface);border:${ev.type === "reunion_prevue" ? `1.5px dashed ${borderColor}` : `1px solid ${borderColor}`};border-radius:6px;padding:.45rem .55rem;text-align:center;${ev.type === "reunion_prevue" ? "opacity:.8" : ""}">
          <span style="font-size:${ev.size === "lg" ? "1.15rem" : ev.size === "sm" ? ".85rem" : "1rem"};display:block;margin-bottom:.15rem">${icon}</span>
          <div style="font-size:.72rem;font-weight:700;line-height:1.25;color:var(--text)">${title}</div>
          <div style="font-size:.65rem;color:var(--muted);margin-top:.15rem;line-height:1.3">${sub}</div>
        </div>
        <div style="position:absolute;${dateLabelY};left:0;right:0;text-align:center;font-size:.6rem;color:var(--muted)">${dateStr}</div>
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
      else if (type === "reunion" || type === "reunion_prevue") window.location.href = `reunions.html?open=${id}`;
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

  const [livre, statuts, commentaires] = await Promise.all([getLivreById(currentLivreId), getStatutsForLivre(currentLivreId), getCommentairesForLivre(currentLivreId)]);
  currentLivre = livre;
  statutByMembre = {};
  statuts.forEach(s => { statutByMembre[s.membre_id] = s; });

  const r = (latest.resultats || []).find(x => x.livre_id === currentLivreId);
  const scale = detectScale(latest, currentLivreId);
  const moy = r?.moyenne ?? null;
  const proposeur = nomMembre(livre?.propose_par);
  const since = livre?.date_proposition ? timeSince(livre.date_proposition) : null;

  const progressionLabelText = progressionLabel(livre);

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
        <span style="font-size:.78rem;color:var(--muted)" id="progression-label">${progressionLabelText}</span>
        <button class="btn btn-ghost btn-sm" id="btn-progression-config">⚙️ Configurer le suivi</button>
      </div>
      <ul class="status-list" id="status-list"></ul>
      <div class="comment-actions">
        <button class="btn btn-primary" id="btn-laisser-commentaire">💬 Laisser un commentaire</button>
        <a href="commentaires.html?livre=${currentLivreId}" class="btn btn-secondary">
          📖 Voir les commentaires${commentaires.length > 0 ? ` (${commentaires.length})` : ""}${commentaires.length > 0 ? " · ⚠️ spoilers" : ""}
        </a>
      </div>
      <div style="border-top:1px solid var(--border);margin-top:.75rem;padding-top:.75rem">
        <button class="btn btn-ghost btn-sm" id="btn-toggle-chart">📈 Graphique</button>
      </div>
    </div>
    <div id="progression-chart-wrap" class="hidden" style="margin-top:.75rem">
      <div class="card" style="padding:1.25rem">
        <div style="font-size:.88rem;font-weight:600;color:var(--text);margin-bottom:.85rem">Évolution des lectures</div>
        <div id="progression-chart-empty" class="hidden" style="text-align:center;padding:2rem 1rem;color:var(--muted);font-size:.83rem">
          Aucune donnée pour l'instant.<br>Mettez à jour votre avancement pour que les points apparaissent ici.
        </div>
        <canvas id="progression-chart" style="max-height:280px"></canvas>
      </div>
    </div>`;

  section.querySelector(".titre-livre-link").addEventListener("click", () => {
    window.location.href = `bibliotheque.html?open=${currentLivreId}`;
  });
  document.getElementById("btn-progression-config").addEventListener("click", openProgressionModal);
  document.getElementById("btn-laisser-commentaire").addEventListener("click", () => openCommentaireModal(livre));
  document.getElementById("btn-toggle-chart").addEventListener("click", async () => {
    chartVisible = !chartVisible;
    const wrap = document.getElementById("progression-chart-wrap");
    const btn = document.getElementById("btn-toggle-chart");
    if (chartVisible) {
      wrap.classList.remove("hidden");
      btn.textContent = "📈 Masquer le graphique";
      await renderProgressionChart();
    } else {
      wrap.classList.add("hidden");
      btn.textContent = "📈 Graphique";
    }
  });

  renderStatusList();
}

// ── Modal commentaire de lecture ───────────────────────────────────

function openCommentaireModal(livre) {
  const sel = document.getElementById("comm-membre");
  sel.innerHTML = '<option value="">— Choisir —</option>';
  allMembres.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id; opt.textContent = m.nom;
    sel.appendChild(opt);
  });

  const mode = livre?.progression_mode || 'simple';
  const parties = livre?.progression_parties || [];
  let advLabel;
  if (mode === 'hierarchique' && parties.length) {
    advLabel = `Chapitre global (optionnel, sur ${totalChapitres(parties)})`;
  } else {
    const unite = livre?.progression_unite || "";
    const total = livre?.progression_total || null;
    advLabel = unite
      ? `${unite.charAt(0).toUpperCase() + unite.slice(1)} actuel(le)${total ? ` (sur ${total})` : ""}`
      : "Avancement (optionnel)";
  }
  document.getElementById("comm-advance-label").textContent = advLabel;
  document.getElementById("comm-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("comm-advance").value = "";
  document.getElementById("comm-text").value = "";
  document.getElementById("comm-titre").value = "";
  document.getElementById("comm-titre-toggle").checked = false;
  document.getElementById("comm-titre-wrap").classList.add("hidden");
  document.getElementById("commentaire-overlay").classList.remove("hidden");
}

document.getElementById("comm-titre-toggle").addEventListener("change", e => {
  document.getElementById("comm-titre-wrap").classList.toggle("hidden", !e.target.checked);
});

["comm-close", "comm-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => {
    document.getElementById("commentaire-overlay").classList.add("hidden");
  });
});

document.getElementById("commentaire-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("commentaire-overlay").classList.add("hidden");
});

document.getElementById("comm-save").addEventListener("click", async () => {
  const membre_id = document.getElementById("comm-membre").value;
  if (!membre_id) { showToast("Choisissez un membre.", "error"); return; }
  const contenu = document.getElementById("comm-text").value.trim();
  if (!contenu) { showToast("Le commentaire est vide.", "error"); return; }
  const date_commentaire = document.getElementById("comm-date").value || new Date().toISOString().split("T")[0];
  const avancement = document.getElementById("comm-advance").value;
  const titre = document.getElementById("comm-titre-toggle").checked ? document.getElementById("comm-titre").value : "";
  try {
    await addCommentaire({ livre_id: currentLivreId, membre_id, date_commentaire, avancement, titre, contenu });
    showToast("Commentaire publié !", "success");
    document.getElementById("commentaire-overlay").classList.add("hidden");
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
});

function renderStatusList() {
  const list = document.getElementById("status-list");
  if (!list) return;
  document.getElementById("status-add-row")?.remove();
  const rank = { termine: 3, en_cours: 2, achete: 1, pas_commence: 0 };
  const hasRealStatut = m => {
    const s = statutByMembre[m.id];
    if (!s) return false;
    if (s.statut === "pas_commence" && !Number(s.page_actuelle)) return false;
    return true;
  };
  const withStatut = allMembres
    .filter(hasRealStatut)
    .sort((a, b) => {
      const sa = statutByMembre[a.id], sb = statutByMembre[b.id];
      const ra = rank[sa.statut] ?? 0, rb = rank[sb.statut] ?? 0;
      if (ra !== rb) return rb - ra;
      const pctA = (sa.page_actuelle && sa.pages_totales) ? sa.page_actuelle / sa.pages_totales : 0;
      const pctB = (sb.page_actuelle && sb.pages_totales) ? sb.page_actuelle / sb.pages_totales : 0;
      return pctB - pctA;
    });

  const missingMembres = allMembres.filter(m => !hasRealStatut(m));

  list.innerHTML = withStatut.map(m => {
    const s = statutByMembre[m.id];
    const statut = s.statut ?? "pas_commence";
    const info = STATUTS_LECTURE[statut];
    let pct = 0, progressText = "";
    if (s.page_actuelle && s.pages_totales && s.pages_totales > 0) {
      pct = Math.min(100, Math.round(s.page_actuelle / s.pages_totales * 100));
      if (isHierarchique()) {
        const { partie, chapitre } = fromAbsolute(Number(s.page_actuelle), currentLivre.progression_parties);
        progressText = `P${partie} · Ch.${chapitre} · ${pct}%`;
      } else {
        const unite = currentLivre?.progression_unite || "";
        progressText = `${s.page_actuelle}/${s.pages_totales}${unite ? ` ${unite}` : ""} · ${pct}%`;
      }
    }
    return `
      <li class="status-row">
        <span class="membre-link" data-id="${m.id}" style="font-size:.88rem;cursor:pointer;min-width:90px;flex-shrink:0">${m.nom}</span>
        <div class="status-bar-wrap">
          <div class="status-bar-track">
            <div class="status-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="status-right">
          <span class="st-badge st-${info.css}" data-membre="${m.id}" data-statut="${statut}">${info.label}</span>
          ${progressText ? `<span class="progress-text">${progressText}</span>` : ""}
          <button class="btn-edit-statut" data-membre="${m.id}" data-statut="${statut}" title="Modifier le statut">✏️</button>
        </div>
      </li>`;
  }).join("");

  if (missingMembres.length) {
    const options = missingMembres.map(m => `<option value="${m.id}">${m.nom}</option>`).join("");
    list.insertAdjacentHTML("afterend", `
      <div class="status-add-row" id="status-add-row">
        <select id="select-add-membre" class="status-add-select">
          <option value="">+ Ajouter un membre au suivi…</option>
          ${options}
        </select>
      </div>`);
    document.getElementById("select-add-membre")?.addEventListener("change", e => {
      if (e.target.value) { openStatutModal(e.target.value, "pas_commence"); e.target.value = ""; }
    });
  }

  list.querySelectorAll(".membre-link").forEach(el => {
    el.addEventListener("click", () => { window.location.href = `membres.html?open=${el.dataset.id}`; });
  });
  list.querySelectorAll(".st-badge").forEach(b => b.addEventListener("click", () => openStatutModal(b.dataset.membre, b.dataset.statut)));
  list.querySelectorAll(".btn-edit-statut").forEach(b => b.addEventListener("click", () => openStatutModal(b.dataset.membre, b.dataset.statut)));
}

// ── Podium / Palmarès ──────────────────────────────────────────────

function computeNoteFinale(reunion) {
  if (!reunion?.notes_finales) return null;
  const notes = Object.values(reunion.notes_finales).map(Number).filter(n => !isNaN(n) && n > 0);
  if (!notes.length) return null;
  return notes.reduce((a, b) => a + b, 0) / notes.length;
}

function renderPodium() {
  const section = document.getElementById("podium-section");

  const elusAvecNote = allVotes
    .filter(v => v.livre_elu)
    .map(v => {
      const reunion = allReunions.find(r => r.livre_id === v.livre_elu);
      const nf = computeNoteFinale(reunion);
      const r = (v.resultats || []).find(x => x.livre_id === v.livre_elu);
      return { livre_id: v.livre_elu, titre: r?.titre ?? v.livre_elu, auteur: r?.auteur ?? "", mois: v.mois, annee: v.annee, noteFinale: nf };
    })
    .filter(e => e.noteFinale !== null)
    .sort((a, b) => b.noteFinale - a.noteFinale);

  if (!elusAvecNote.length) {
    section.innerHTML = `<div class="empty-state"><span class="big-icon">🏆</span>Les notes seront affichées après les réunions.</div>`;
    return;
  }

  // Podium : ordre 2e, 1er, 3e (pyramide visuelle)
  const top = elusAvecNote.slice(0, 3);
  const outsider = elusAvecNote[3] ?? null;
  const podiumSlots = [top[1], top[0], top[2]];
  const medals = ["🥈", "🥇", "🥉"];
  const classes = ["silver", "gold", "bronze"];
  const rankClasses = ["podium-rank-2", "podium-rank-1", "podium-rank-3"];

  const podiumHtml = `<div class="podium-top">
    ${podiumSlots.map((e, i) => e ? `
      <div class="podium-step ${rankClasses[i]}">
        <div class="podium-medal">${medals[i]}</div>
        <div class="podium-card ${classes[i]}" data-livre-id="${e.livre_id}" style="cursor:pointer">
          <div class="podium-score">${e.noteFinale.toFixed(1)}<span style="font-size:.52em;color:var(--muted);font-weight:500">/10</span></div>
          <div class="podium-title">${e.titre}</div>
          ${e.auteur ? `<div class="podium-author">${e.auteur}</div>` : ""}
          <div class="podium-month">${formatMois(e.mois, e.annee)}</div>
        </div>
      </div>` : `<div class="podium-step"></div>`
    ).join("")}
  </div>`;

  const outsiderHtml = outsider ? `
    <div class="podium-outsider">
      <div class="podium-outsider-label">Meilleur outsider</div>
      <div class="podium-outsider-card" data-livre-id="${outsider.livre_id}" style="cursor:pointer">
        <span style="font-size:1.4rem">🏅</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${outsider.titre}</div>
          ${outsider.auteur ? `<div style="font-size:.75rem;color:var(--muted)">${outsider.auteur}</div>` : ""}
        </div>
        <div style="font-size:1.05rem;font-weight:800;color:var(--accent);flex-shrink:0">${outsider.noteFinale.toFixed(1)}/10</div>
      </div>
    </div>` : "";

  section.innerHTML = `<div class="podium-wrap">${podiumHtml}${outsiderHtml}</div>`;

  section.querySelectorAll("[data-livre-id]").forEach(el => {
    el.addEventListener("click", () => {
      window.location.href = `bibliotheque.html?open=${el.dataset.livreId}`;
    });
  });
}

// ── Modal statut ───────────────────────────────────────────────────

function updateStatutChapitreMax() {
  const parties = currentLivre?.progression_parties || [];
  const idx = Number(document.getElementById('statut-partie').value) - 1;
  const max = parties[idx] || 1;
  document.getElementById('statut-chapitre').max = max;
  updateStatutPositionHint();
}

function updateStatutPositionHint() {
  const parties = currentLivre?.progression_parties || [];
  const partie = Number(document.getElementById('statut-partie').value);
  const chapitre = Number(document.getElementById('statut-chapitre').value);
  const hint = document.getElementById('statut-position-hint');
  if (!hint) return;
  if (partie && chapitre) {
    const abs = toAbsolute(partie, chapitre, parties);
    const total = totalChapitres(parties);
    hint.textContent = `→ chapitre ${abs} sur ${total} au total`;
  } else {
    hint.textContent = '';
  }
}

document.getElementById('statut-partie').addEventListener('change', () => {
  if (!document.getElementById('statut-hier-section').classList.contains('hidden')) {
    updateStatutChapitreMax();
  }
});

document.getElementById('statut-chapitre').addEventListener('input', () => {
  if (!document.getElementById('statut-hier-section').classList.contains('hidden')) {
    updateStatutPositionHint();
  }
});

function openStatutModal(membreId, currentStatut) {
  editMembreId = membreId;
  const m = allMembres.find(x => x.id === membreId);
  document.getElementById("statut-modal-title").textContent = `Statut — ${m?.nom ?? ""}`;
  document.getElementById("statut-select").value = currentStatut;

  const hier = isHierarchique();
  const parties = currentLivre?.progression_parties || [];

  document.getElementById('statut-simple-section').classList.toggle('hidden', hier);
  document.getElementById('statut-hier-section').classList.toggle('hidden', !hier);

  if (hier) {
    const sel = document.getElementById('statut-partie');
    sel.innerHTML = parties.map((n, i) => `<option value="${i + 1}">Partie ${i + 1} (${n} ch.)</option>`).join('');

    const existing = statutByMembre[membreId];
    if (existing?.page_actuelle) {
      const { partie, chapitre } = fromAbsolute(Number(existing.page_actuelle), parties);
      sel.value = partie;
      document.getElementById('statut-chapitre').value = chapitre;
    } else {
      sel.value = 1;
      document.getElementById('statut-chapitre').value = '';
    }
    updateStatutChapitreMax();
  } else {
    const unite = currentLivre?.progression_unite || "pages";
    const uniteLabel = unite.charAt(0).toUpperCase() + unite.slice(1);
    const labelActuel = document.getElementById("label-page-actuelle");
    const labelTotal = document.getElementById("label-pages-totales");
    if (labelActuel) labelActuel.textContent = `${uniteLabel} actuel(le)`;
    if (labelTotal) labelTotal.textContent = `Total (${unite})`;

    const existing = statutByMembre[membreId];
    document.getElementById("page-actuelle").value = existing?.page_actuelle ?? "";
    document.getElementById("pages-totales").value = existing?.pages_totales ?? (currentLivre?.progression_total || "");
  }

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

  let page_actuelle, pages_totales;
  if (isHierarchique()) {
    const parties = currentLivre.progression_parties;
    const partie = Number(document.getElementById('statut-partie').value);
    const chapitre = Number(document.getElementById('statut-chapitre').value);
    page_actuelle = (partie && chapitre) ? toAbsolute(partie, chapitre, parties) : "";
    pages_totales = totalChapitres(parties);
  } else {
    page_actuelle = document.getElementById("page-actuelle").value;
    pages_totales = document.getElementById("pages-totales").value;
  }

  try {
    await upsertStatutLecture({ membre_id: editMembreId, livre_id: currentLivreId, statut, page_actuelle, pages_totales });
    showToast("Statut mis à jour", "success");
    document.getElementById("statut-overlay").classList.add("hidden");

    const pa = page_actuelle !== "" ? Number(page_actuelle) : null;
    const pt = pages_totales !== "" ? Number(pages_totales) : (currentLivre?.progression_total ?? null);
    const effectivePa = (statut === "termine" && (!pa || pa === 0) && pt) ? pt : pa;
    if (effectivePa !== null && effectivePa > 0) {
      await addProgressionPoint({ livre_id: currentLivreId, membre_id: editMembreId, page_actuelle: effectivePa, pages_totales: pt });
      if (chartVisible) await renderProgressionChart();
    }

    editMembreId = null;
    const statuts = await getStatutsForLivre(currentLivreId);
    statutByMembre = {};
    statuts.forEach(s => { statutByMembre[s.membre_id] = s; });
    renderStatusList();
  } catch (e) { showToast("Erreur : " + e.message, "error"); }
});

// ── Helpers hiérarchiques ──────────────────────────────────────────

function totalChapitres(parties) {
  return (parties || []).reduce((s, n) => s + n, 0);
}

function toAbsolute(partie, chapitre, parties) {
  let abs = 0;
  for (let i = 0; i < partie - 1; i++) abs += parties[i];
  return abs + chapitre;
}

function fromAbsolute(pos, parties) {
  let remaining = pos;
  for (let i = 0; i < parties.length; i++) {
    if (remaining <= parties[i]) return { partie: i + 1, chapitre: remaining };
    remaining -= parties[i];
  }
  return { partie: parties.length, chapitre: parties[parties.length - 1] };
}

function isHierarchique() {
  return currentLivre?.progression_mode === 'hierarchique' && (currentLivre?.progression_parties?.length > 0);
}

function progressionLabel(livre) {
  if (livre?.progression_mode === 'hierarchique' && livre?.progression_parties?.length) {
    const parties = livre.progression_parties;
    const total = totalChapitres(parties);
    return `Suivi hiérarchique · ${parties.length} partie${parties.length > 1 ? 's' : ''} · ${total} chapitres`;
  }
  const u = livre?.progression_unite || "";
  const t = livre?.progression_total || null;
  return u ? `Suivi en ${u}${t ? ` · ${t} max` : ""}` : "Aucun suivi configuré";
}

// ── Modal configuration du suivi ──────────────────────────────────

function renderPartiesList(parties) {
  const container = document.getElementById('prog-parties-list');
  container.innerHTML = parties.map((n, i) => `
    <div class="prog-partie-row" style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem">
      <span style="font-size:.83rem;min-width:58px;color:var(--text)">Partie ${i + 1}</span>
      <input type="number" class="prog-partie-input" min="1" value="${n}" placeholder="nb ch." style="width:74px">
      <span style="font-size:.78rem;color:var(--muted)">chapitres</span>
      ${parties.length > 1 ? `<button class="btn btn-ghost btn-sm prog-partie-del" data-index="${i}" style="padding:.15rem .35rem;margin-left:auto;line-height:1">✕</button>` : ''}
    </div>`).join('');

  updateTotalHint();

  container.querySelectorAll('.prog-partie-input').forEach(inp => inp.addEventListener('input', updateTotalHint));
  container.querySelectorAll('.prog-partie-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const inputs = container.querySelectorAll('.prog-partie-input');
      const current = [...inputs].map(inp => Number(inp.value) || 1);
      current.splice(Number(btn.dataset.index), 1);
      renderPartiesList(current);
    });
  });
}

function updateTotalHint() {
  const inputs = document.getElementById('prog-parties-list').querySelectorAll('.prog-partie-input');
  const total = [...inputs].reduce((s, inp) => s + (Number(inp.value) || 0), 0);
  document.getElementById('prog-total-hint').textContent = total > 0 ? `Total : ${total} chapitres` : '';
}

function openProgressionModal() {
  const mode = currentLivre?.progression_mode || 'simple';
  const parties = currentLivre?.progression_parties || [];
  const hier = mode === 'hierarchique';

  document.getElementById('prog-mode-simple').checked = !hier;
  document.getElementById('prog-mode-hier').checked = hier;
  document.getElementById('prog-simple-section').classList.toggle('hidden', hier);
  document.getElementById('prog-hier-section').classList.toggle('hidden', !hier);

  document.getElementById("progression-unite").value = currentLivre?.progression_unite || "";
  document.getElementById("progression-total-input").value = currentLivre?.progression_total || "";

  renderPartiesList(parties.length ? parties : [1]);

  document.getElementById("progression-overlay").classList.remove("hidden");
}

document.querySelectorAll('[name="prog-mode"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const hier = document.getElementById('prog-mode-hier').checked;
    document.getElementById('prog-simple-section').classList.toggle('hidden', hier);
    document.getElementById('prog-hier-section').classList.toggle('hidden', !hier);
    if (hier && !document.getElementById('prog-parties-list').children.length) renderPartiesList([1]);
  });
});

document.getElementById('prog-add-partie').addEventListener('click', () => {
  const inputs = document.getElementById('prog-parties-list').querySelectorAll('.prog-partie-input');
  const current = [...inputs].map(inp => Number(inp.value) || 1);
  renderPartiesList([...current, 1]);
});

["progression-close","progression-cancel"].forEach(id => {
  document.getElementById(id).addEventListener("click", () => {
    document.getElementById("progression-overlay").classList.add("hidden");
  });
});

document.getElementById("progression-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) document.getElementById("progression-overlay").classList.add("hidden");
});

document.getElementById("progression-save").addEventListener("click", async () => {
  const hier = document.getElementById('prog-mode-hier').checked;
  let updates;

  if (hier) {
    const inputs = document.getElementById('prog-parties-list').querySelectorAll('.prog-partie-input');
    const parties = [...inputs].map(inp => Number(inp.value) || 1);
    if (!parties.length) { showToast("Définissez au moins une partie.", "error"); return; }
    updates = {
      progression_mode: 'hierarchique',
      progression_parties: parties,
      progression_total: totalChapitres(parties),
      progression_unite: 'chapitres',
    };
  } else {
    const unite = document.getElementById("progression-unite").value.trim();
    const total = document.getElementById("progression-total-input").value;
    updates = {
      progression_mode: 'simple',
      progression_parties: null,
      progression_unite: unite || null,
      progression_total: total ? Number(total) : null,
    };
  }

  try {
    await updateLivre(currentLivreId, updates);
    showToast("Suivi configuré !", "success");
    document.getElementById("progression-overlay").classList.add("hidden");
    currentLivre = { ...currentLivre, ...updates };
    const label = document.getElementById("progression-label");
    if (label) label.textContent = progressionLabel(currentLivre);
    renderStatusList();
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
});

// ── Graphique progression ─────────────────────────────────────────

async function loadChartJs() {
  if (window.Chart) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function renderProgressionChart() {
  await loadChartJs();

  const canvas = document.getElementById("progression-chart");
  const emptyEl = document.getElementById("progression-chart-empty");
  if (!canvas || !currentLivreId) return;

  const points = await getProgressionForLivre(currentLivreId);

  if (!points.length) {
    canvas.classList.add("hidden");
    emptyEl?.classList.remove("hidden");
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }
  canvas.classList.remove("hidden");
  emptyEl?.classList.add("hidden");

  const totalConf = currentLivre?.progression_total ?? null;
  const unite = currentLivre?.progression_unite || "";
  const usePercent = !!totalConf;

  const byMembre = {};
  points.forEach(p => {
    (byMembre[p.membre_id] ??= []).push(p);
  });

  const COLORS = ["#e8a44a", "#6abf69", "#7a6af0", "#cf6679", "#4ecdc4", "#5b9cf6"];

  const datasets = Object.entries(byMembre).map(([membreId, pts], i) => {
    const color = COLORS[i % COLORS.length];
    const data = pts.map(p => {
      const date = p.horodatage?.toDate ? p.horodatage.toDate() : new Date(p.horodatage * 1000);
      const total = totalConf || p.pages_totales || null;
      const val = usePercent && total ? Math.min(100, Math.round(p.page_actuelle / total * 100)) : (p.page_actuelle ?? 0);
      return { x: date, y: val };
    });
    return {
      label: nomMembre(membreId),
      data,
      borderColor: color,
      backgroundColor: color + "33",
      pointBackgroundColor: color,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: false,
    };
  });

  const style = getComputedStyle(document.documentElement);
  const borderClr = style.getPropertyValue("--border").trim() || "#2a2a2a";
  const mutedClr  = style.getPropertyValue("--muted").trim()  || "#888";
  const textClr   = style.getPropertyValue("--text").trim()   || "#e0e0e0";

  if (chartInstance) chartInstance.destroy();

  const monthStart = new Date(currentVote.annee, currentVote.mois - 1, 1);
  const monthEnd   = new Date(currentVote.annee, currentVote.mois, 0, 23, 59, 59);

  chartInstance = new Chart(canvas, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      animation: { duration: 900, easing: "easeInOutQuart" },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: textClr, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label} : ${ctx.parsed.y}${usePercent ? "%" : (unite ? " " + unite : "")}`
          }
        }
      },
      scales: {
        x: {
          type: "time",
          min: monthStart,
          max: monthEnd,
          time: {
            tooltipFormat: "d MMM, HH'h'",
            displayFormats: { hour: "d MMM HH'h'", day: "d MMM", week: "d MMM", month: "MMM yyyy" }
          },
          grid: { color: borderClr },
          ticks: { color: mutedClr, maxTicksLimit: 8 }
        },
        y: {
          min: 0,
          max: usePercent ? 100 : undefined,
          grid: { color: borderClr },
          ticks: {
            color: mutedClr,
            callback: v => usePercent ? v + "%" : (unite ? v + " " + unite : v)
          }
        }
      }
    }
  });
}

init().catch(console.error);
