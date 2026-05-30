import { requireAuth } from "./auth.js?v=2";
import { initNav } from "./nav.js?v=2";
import { showToast, escapeHtml, formatDate } from "./utils.js?v=2";
import {
  getStats, getRecentActions, getAllActions, logAction,
  getCellules, addCellule, addWikiEntry,
  addOracle, linkOracleToWiki,
  addEvenement, addEvenementToCellule,
  getTodos, seedTodosIfEmpty, toggleTodo, deleteTodo, addTodo,
  deleteAllCellules, deleteAllWiki, deleteAllOracles, deleteAllEvenements, deleteAllActions,
} from "./db.js?v=2";
import {
  ORACLE_TYPES, EVENEMENT_TYPES,
  genMotsClesCellule, genMotsClesOracle, genMotsClesEvenement,
  chooseBiome, BIOME_ICONS, BIOME_COLORS, BIOMES_NATURELS,
} from "./mots-cles.js?v=2";

const NEIGHBORS = [[1,-1],[1,0],[-1,1],[-1,0],[0,1],[0,-1]];
const DAILY_LIMIT = 3;

// ─── Limite journalière (localStorage — synchrone, pas de Firebase) ───────────

function _dailyKey() {
  return "at_daily_" + new Date().toISOString().slice(0, 10);
}

function _getDailyCount() {
  return Math.min(DAILY_LIMIT, parseInt(localStorage.getItem(_dailyKey()) || "0", 10));
}

function _incrementDailyCount() {
  const key = _dailyKey();
  localStorage.setItem(key, (parseInt(localStorage.getItem(key) || "0", 10) + 1));
}

function isDailyLimitReached() {
  return _getDailyCount() >= DAILY_LIMIT;
}

function renderDailyProgress() {
  const label = document.getElementById("daily-label");
  const dots  = document.getElementById("daily-dots");
  const progress = document.getElementById("daily-progress");
  if (!label || !dots || !progress) return;

  const count = _getDailyCount();

  dots.innerHTML = Array.from({ length: DAILY_LIMIT }, (_, i) =>
    `<span class="daily-dot ${i < count ? "filled" : ""}"></span>`
  ).join("");

  const remaining = DAILY_LIMIT - count;
  if (count >= DAILY_LIMIT) {
    label.textContent = "Toutes les actions du jour posées ✓";
    progress.classList.add("daily-done");
    progress.classList.remove("daily-active");
  } else if (count === 0) {
    label.textContent = `${DAILY_LIMIT} actions disponibles aujourd'hui`;
    progress.classList.remove("daily-done", "daily-active");
  } else {
    label.textContent = `${remaining} action${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""} aujourd'hui`;
    progress.classList.add("daily-active");
    progress.classList.remove("daily-done");
  }

  const disabled = count >= DAILY_LIMIT;
  ["btn-reveler", "btn-oracle", "btn-evenement"].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.style.opacity = disabled ? "0.4" : "";
    btn.style.cursor  = disabled ? "not-allowed" : "";
    if (disabled) btn.setAttribute("data-locked", "1");
    else btn.removeAttribute("data-locked");
  });
}

// ─── Init ────────────────────────────────────────────────────────────────────

await requireAuth();
initNav("accueil");
renderDailyProgress(); // synchrone — avant tout Firebase

// Les event listeners sont enregistrés AVANT les chargements async
// pour qu'un éventuel échec Firebase ne les empêche pas de fonctionner.
document.getElementById("btn-reveler").addEventListener("click", () => {
  if (isDailyLimitReached()) return;
  openRevelerModal().catch(e => { showToast("Erreur inattendue.", "error"); console.error(e); });
});
document.getElementById("btn-oracle").addEventListener("click", () => {
  if (isDailyLimitReached()) return;
  openOracleModal().catch(e => { showToast("Erreur inattendue.", "error"); console.error(e); });
});
document.getElementById("btn-evenement").addEventListener("click", () => {
  if (isDailyLimitReached()) return;
  openEvenementModal().catch(e => { showToast("Erreur inattendue.", "error"); console.error(e); });
});

// Bouton +1 action sur l'indicateur
document.getElementById("daily-plus")?.addEventListener("click", () => {
  const key = _dailyKey();
  const current = parseInt(localStorage.getItem(key) || "0", 10);
  if (current > 0) localStorage.setItem(key, current - 1);
  renderDailyProgress();
});

// Boutons de test
setupTestZone();

// Chargements async indépendants — chacun dans son try/catch
// pour qu'un échec isolé ne bloque pas les autres
try { await seedTodosIfEmpty(); } catch (e) { console.warn("seedTodos:", e); }
try { await renderStats(); }        catch (e) { console.warn("renderStats:", e); }
try {
  await renderRecentActions();
} catch (e) {
  console.warn("renderRecentActions:", e);
  const el = document.getElementById("recent-actions-list");
  if (el) el.innerHTML = `<p class="action-empty" style="color:var(--danger)">Erreur de chargement (voir console)</p>`;
}
try { await renderTodos(); }        catch (e) { console.warn("renderTodos:", e); }
renderChart();

// ─── Stats ───────────────────────────────────────────────────────────────────

async function renderStats() {
  const stats = await getStats();
  document.getElementById("kpi-cellules").textContent = stats.cellules;
  document.getElementById("kpi-wiki").textContent     = stats.wiki;
  document.getElementById("kpi-oracles").textContent  = stats.oracles;
  document.getElementById("kpi-events").textContent   = stats.evenements;
}

// ─── Dernières actions ────────────────────────────────────────────────────────

const ACTION_ICONS = { cellule: "🗺️", oracle: "🔮", evenement: "⚡" };

async function renderRecentActions() {
  const actions = await getRecentActions(3);
  const el = document.getElementById("recent-actions-list");
  if (!actions.length) {
    el.innerHTML = `<p class="action-empty">Aucune action enregistrée pour l'instant.</p>`;
    return;
  }
  el.innerHTML = actions.map(a => `
    <div class="action-log-item">
      <span class="action-log-icon">${ACTION_ICONS[a.type] || "📌"}</span>
      <div class="action-log-text">
        <div class="action-log-details">${escapeHtml(a.details)}</div>
        <div class="action-log-date">${a.date_str || "—"}</div>
      </div>
    </div>
  `).join("");
}

// ─── Chart activité ───────────────────────────────────────────────────────────

async function renderChart() {
  const allActions = await getAllActions();
  if (!allActions.length) return;

  // Grouper par date
  const counts = {};
  for (const a of allActions) {
    const d = a.date_str || "?";
    counts[d] = (counts[d] || 0) + 1;
  }

  // Plage : du premier jour d'activité à aujourd'hui
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const allDates = allActions.map(a => a.date_str).filter(Boolean).sort();
  const firstStr = allDates[0] || todayStr;

  // Minimum 7 jours, maximum toute la plage
  const minStart = new Date(today);
  minStart.setDate(minStart.getDate() - 6);
  const startDate = new Date(firstStr) < minStart ? new Date(firstStr) : minStart;

  const labels = [];
  const data = [];
  const cur = new Date(startDate);
  while (cur <= today) {
    const key = cur.toISOString().slice(0, 10);
    labels.push(key.slice(5)); // MM-DD
    data.push(counts[key] || 0);
    cur.setDate(cur.getDate() + 1);
  }

  const Chart = window.Chart;
  if (!Chart) { console.warn("Chart.js non disponible"); return; }

  const ctx = document.getElementById("chart-activite");
  if (!ctx) return;

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#c49a3a";

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Actions",
        data,
        backgroundColor: accent + "88",
        borderColor: accent,
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.raw} action${ctx.raw > 1 ? "s" : ""}` } },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,.04)" },
          ticks: { color: "#8a8278", font: { size: 10 }, maxTicksLimit: 10 },
        },
        y: {
          grid: { color: "rgba(255,255,255,.06)" },
          ticks: { color: "#8a8278", font: { size: 11 }, stepSize: 1 },
          min: 0,
          beginAtZero: true,
        },
      },
    },
  });
}

// ─── TODO ─────────────────────────────────────────────────────────────────────

async function renderTodos() {
  const todos = await getTodos();
  const list = document.getElementById("todo-list");
  const count = document.getElementById("todo-count");

  const done = todos.filter(t => t.fait).length;
  count.textContent = `${done} / ${todos.length} fait${done > 1 ? "s" : ""}`;

  list.innerHTML = todos.map(t => `
    <div class="todo-item ${t.fait ? "fait" : ""}" data-id="${t.id}">
      <div class="todo-check ${t.fait ? "checked" : ""}" data-id="${t.id}">
        ${t.fait ? "✓" : ""}
      </div>
      <span class="todo-text">${escapeHtml(t.texte)}</span>
      <button class="todo-del" data-id="${t.id}" title="Supprimer">✕</button>
    </div>
  `).join("");

  list.querySelectorAll(".todo-check").forEach(el => {
    el.addEventListener("click", async () => {
      const id = el.dataset.id;
      const item = todos.find(t => t.id === id);
      if (!item) return;
      await toggleTodo(id, !item.fait);
      renderTodos();
    });
  });

  list.querySelectorAll(".todo-del").forEach(el => {
    el.addEventListener("click", async () => {
      await deleteTodo(el.dataset.id);
      renderTodos();
    });
  });
}

document.getElementById("todo-add-btn").addEventListener("click", async () => {
  const input = document.getElementById("todo-add-input");
  const text = input.value.trim();
  if (!text) return;
  await addTodo(text);
  input.value = "";
  renderTodos();
});

document.getElementById("todo-add-input").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("todo-add-btn").click();
});

// ─── MODAL : Révéler une cellule ─────────────────────────────────────────────

let _revealData = null;

async function openRevelerModal() {
  const cellules = await getCellules();
  const discovered = new Map(cellules.map(c => [`${c.q},${c.r}`, c]));

  let targetQ, targetR, neighborBiomes;

  if (cellules.length === 0) {
    // Première cellule : centre (0,0)
    targetQ = 0;
    targetR = 0;
    neighborBiomes = [];
  } else {
    // Trouver toutes les cellules adjacentes non découvertes
    const candidates = new Set();
    for (const c of cellules) {
      for (const [dq, dr] of NEIGHBORS) {
        const key = `${c.q + dq},${c.r + dr}`;
        if (!discovered.has(key)) candidates.add(key);
      }
    }
    if (!candidates.size) {
      showToast("Aucune cellule adjacente disponible.", "error");
      return;
    }

    // Choix aléatoire parmi les candidats
    const arr = [...candidates];
    const chosen = arr[Math.floor(Math.random() * arr.length)];
    [targetQ, targetR] = chosen.split(",").map(Number);

    // Biomes des voisins déjà découverts
    neighborBiomes = NEIGHBORS
      .map(([dq, dr]) => discovered.get(`${targetQ + dq},${targetR + dr}`))
      .filter(Boolean)
      .map(c => c.biome);
  }

  const biome = chooseBiome(neighborBiomes);
  const motsCles = genMotsClesCellule(biome);
  const icon = BIOME_ICONS[biome] || "🗺️";
  const color = BIOME_COLORS[biome] || "#888";

  _revealData = { q: targetQ, r: targetR, biome, motsCles };

  document.getElementById("reveal-biome").textContent = `${icon} ${biome}`;
  document.getElementById("reveal-biome").style.color = color;
  document.getElementById("reveal-coords").textContent = `Coordonnées : (${targetQ}, ${targetR})`;
  document.getElementById("reveal-chips").innerHTML = motsCles.map(m => `<span class="chip">${escapeHtml(m)}</span>`).join("");
  document.getElementById("reveal-titre").value = "";
  document.getElementById("reveal-desc").value = "";

  document.getElementById("reveal-overlay").classList.remove("hidden");
  document.getElementById("reveal-desc").focus();
}

document.getElementById("reveal-close").addEventListener("click", () => {
  document.getElementById("reveal-overlay").classList.add("hidden");
  _revealData = null;
});

document.getElementById("reveal-save").addEventListener("click", async () => {
  if (!_revealData) return;
  const titre = document.getElementById("reveal-titre").value.trim();
  const desc = document.getElementById("reveal-desc").value.trim();
  if (!desc) { showToast("Une description est requise.", "error"); return; }

  const btn = document.getElementById("reveal-save");
  btn.disabled = true;
  btn.textContent = "Sauvegarde…";

  try {
    const { q, r, biome, motsCles } = _revealData;
    const cellId = await addCellule({ q, r, biome, mots_cles: motsCles, titre: titre || null, description: desc });
    const wikiId = await addWikiEntry({
      categorie: "Lieux",
      titre: titre || `${biome} (${q}, ${r})`,
      mots_cles: motsCles,
      contenu: desc,
      source_type: "cellule",
      source_id: cellId,
      cellule_id: cellId,
    });
    await logAction({
      type: "cellule",
      details: `${BIOME_ICONS[biome] || ""} ${biome} révélée en (${q}, ${r})${titre ? " — " + titre : ""}`,
      ref_id: cellId,
    });
    document.getElementById("reveal-overlay").classList.add("hidden");
    _revealData = null;
    _incrementDailyCount();
    renderDailyProgress();
    showToast("Cellule révélée et ajoutée au wiki !");
    await Promise.all([renderStats(), renderRecentActions()]);
  } catch (e) {
    showToast("Erreur lors de la sauvegarde.", "error");
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = "Révéler →";
  }
});

// ─── MODAL : Oracle ───────────────────────────────────────────────────────────

let _oracleData = null;

function openOracleModal() {
  const type = ORACLE_TYPES[Math.floor(Math.random() * ORACLE_TYPES.length)];
  const motsCles = genMotsClesOracle(type.id, 4);
  _oracleData = { type_id: type.id, type_label: type.label, motsCles };

  document.getElementById("oracle-type").textContent = type.label;
  document.getElementById("oracle-chips").innerHTML = motsCles.map(m => `<span class="chip">${escapeHtml(m)}</span>`).join("");
  document.getElementById("oracle-titre").value = "";
  document.getElementById("oracle-desc").value = "";

  document.getElementById("oracle-overlay").classList.remove("hidden");
  document.getElementById("oracle-desc").focus();
}

document.getElementById("oracle-close").addEventListener("click", () => {
  document.getElementById("oracle-overlay").classList.add("hidden");
  _oracleData = null;
});

document.getElementById("oracle-reroll").addEventListener("click", openOracleModal);

document.getElementById("oracle-save").addEventListener("click", async () => {
  if (!_oracleData) return;
  const titre = document.getElementById("oracle-titre").value.trim();
  const desc = document.getElementById("oracle-desc").value.trim();
  if (!desc) { showToast("Une description est requise.", "error"); return; }

  const btn = document.getElementById("oracle-save");
  btn.disabled = true;
  btn.textContent = "Sauvegarde…";

  try {
    const { type_id, type_label, motsCles } = _oracleData;

    // Catégorie wiki correspondante
    const CAT_MAP = {
      creature: "Créatures", plante: "Plantes", personnage: "Personnages",
      faction: "Factions", legende: "Légendes", objet: "Objets",
      coutume: "Coutumes", phenomene: "Événements",
    };
    const categorie = CAT_MAP[type_id] || "Légendes";

    const oracleId = await addOracle({ type_id, type_label, mots_cles: motsCles });
    const wikiId = await addWikiEntry({
      categorie,
      titre: titre || type_label,
      mots_cles: motsCles,
      contenu: desc,
      source_type: "oracle",
      source_id: oracleId,
    });
    await linkOracleToWiki(oracleId, wikiId);
    await logAction({
      type: "oracle",
      details: `🔮 ${type_label}${titre ? " — " + titre : ""}`,
      ref_id: oracleId,
    });
    document.getElementById("oracle-overlay").classList.add("hidden");
    _oracleData = null;
    _incrementDailyCount();
    renderDailyProgress();
    showToast("Oracle sauvegardé dans le wiki !");
    await Promise.all([renderStats(), renderRecentActions()]);
  } catch (e) {
    showToast("Erreur lors de la sauvegarde.", "error");
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sauvegarder →";
  }
});

// ─── MODAL : Événement ────────────────────────────────────────────────────────

let _evData = null;

async function openEvenementModal() {
  const cellules = await getCellules();
  if (!cellules.length) {
    showToast("Révèle d'abord au moins une cellule.", "error");
    return;
  }

  const cellule = cellules[Math.floor(Math.random() * cellules.length)];
  const type = EVENEMENT_TYPES[Math.floor(Math.random() * EVENEMENT_TYPES.length)];
  const motsCles = genMotsClesEvenement(type.id, 4);
  _evData = { cellule, type_id: type.id, type_label: type.label, motsCles };

  const icon = BIOME_ICONS[cellule.biome] || "🗺️";
  document.getElementById("ev-cell").textContent = `${icon} ${cellule.biome} — (${cellule.q}, ${cellule.r})${cellule.titre ? " · " + cellule.titre : ""}`;
  document.getElementById("ev-type").textContent = type.label;
  document.getElementById("ev-exemples").textContent = type.exemples || "";
  document.getElementById("ev-chips").innerHTML = motsCles.map(m => `<span class="chip">${escapeHtml(m)}</span>`).join("");
  document.getElementById("ev-titre").value = "";
  document.getElementById("ev-desc").value = "";

  document.getElementById("ev-overlay").classList.remove("hidden");
  document.getElementById("ev-desc").focus();
}

document.getElementById("ev-close").addEventListener("click", () => {
  document.getElementById("ev-overlay").classList.add("hidden");
  _evData = null;
});

document.getElementById("ev-reroll").addEventListener("click", openEvenementModal);

document.getElementById("ev-save").addEventListener("click", async () => {
  if (!_evData) return;
  const titre = document.getElementById("ev-titre").value.trim();
  const desc = document.getElementById("ev-desc").value.trim();
  if (!desc) { showToast("Une description est requise.", "error"); return; }

  const btn = document.getElementById("ev-save");
  btn.disabled = true;
  btn.textContent = "Sauvegarde…";

  try {
    const { cellule, type_id, type_label, motsCles } = _evData;
    const evId = await addEvenement({
      cellule_id: cellule.id,
      cellule_biome: cellule.biome,
      cellule_q: cellule.q,
      cellule_r: cellule.r,
      type_id, type_label, mots_cles: motsCles,
      titre: titre || null,
      description: desc,
    });
    await addEvenementToCellule(cellule.id, evId);
    await addWikiEntry({
      categorie: "Événements",
      titre: titre || type_label,
      mots_cles: motsCles,
      contenu: desc,
      source_type: "evenement",
      source_id: evId,
      cellule_id: cellule.id,
    });
    await logAction({
      type: "evenement",
      details: `⚡ ${type_label}${titre ? " — " + titre : ""} (${cellule.biome} ${cellule.q},${cellule.r})`,
      ref_id: evId,
    });
    document.getElementById("ev-overlay").classList.add("hidden");
    _evData = null;
    _incrementDailyCount();
    renderDailyProgress();
    showToast("Événement enregistré !");
    await Promise.all([renderStats(), renderRecentActions()]);
  } catch (e) {
    showToast("Erreur lors de la sauvegarde.", "error");
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sauvegarder →";
  }
});

// ─── Zone de test ─────────────────────────────────────────────────────────────

function setupTestZone() {
  const confirmAndDelete = async (label, deleteFn, resetDaily = false) => {
    if (!confirm(`Supprimer ${label} ? Cette action est irréversible.`)) return;
    try {
      await deleteFn();
      if (resetDaily) {
        localStorage.removeItem(_dailyKey());
        renderDailyProgress();
      }
      showToast(`${label} supprimé(e)s.`);
      await Promise.all([renderStats(), renderRecentActions()]);
    } catch (e) {
      showToast("Erreur lors de la suppression.", "error");
      console.error(e);
    }
  };

  document.getElementById("del-cellules")?.addEventListener("click",   () => confirmAndDelete("les cellules",   deleteAllCellules));
  document.getElementById("del-oracles")?.addEventListener("click",    () => confirmAndDelete("les oracles",    deleteAllOracles));
  document.getElementById("del-events")?.addEventListener("click",     () => confirmAndDelete("les événements", deleteAllEvenements));
  document.getElementById("del-wiki")?.addEventListener("click",       () => confirmAndDelete("le wiki",        deleteAllWiki));
  document.getElementById("del-actions")?.addEventListener("click",    () => confirmAndDelete("le journal d'actions", deleteAllActions, true));
  document.getElementById("reset-daily")?.addEventListener("click", () => {
    localStorage.removeItem(_dailyKey());
    renderDailyProgress();
    showToast("Limite du jour réinitialisée.");
  });
}
