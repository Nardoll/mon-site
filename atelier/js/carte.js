import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { escapeHtml, formatDate } from "./utils.js";
import { getCellules } from "./db.js";
import { BIOME_COLORS, BIOME_ICONS, ENV_COLORS } from "./generation.js?v=2";
import { db } from "../firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

await requireAuth();
initNav("carte");

// ─── Constantes hexagone (flat-top) ──────────────────────────────────────────

const SIZE = 48;
const SQRT3 = Math.sqrt(3);
const NEIGHBORS = [[1,-1],[1,0],[-1,1],[-1,0],[0,1],[0,-1]];

function hexToPixel(q, r) {
  return {
    x: SIZE * 1.5 * q,
    y: SIZE * SQRT3 * (r + q / 2),
  };
}

function hexPoints(cx, cy, size = SIZE) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

// ─── Couleurs vives pour le filtre environnement ─────────────────────────────
// Bien espacées sur la roue des couleurs pour être immédiatement lisibles

const ENV_FILTER_COLORS = {
  'tempéré':    '#72cc4a',  // vert lime vif
  'steppique':  '#f5c830',  // jaune doré vif
  'désertique': '#e87830',  // orange vif
  'tropical':   '#30b878',  // vert teal vif (distinct du tempéré)
  'glacial':    '#58c0e8',  // bleu ciel vif
  'volcanique': '#e02828',  // rouge vif
  'maritime':   '#2868c8',  // bleu océan vif
};

// ─── État ─────────────────────────────────────────────────────────────────────

let cellules = [];
let transform = { tx: 0, ty: 0, scale: 1 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragMoved = false;
let envFilterActive = false;

const svg = document.getElementById("map-svg");
const mapRoot = document.getElementById("map-root");

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  resizeSVG();
  cellules = await getCellules();
  renderMap();
  updateStats();
}

function resizeSVG() {
  const container = document.getElementById("map-container");
  const rect = container.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${rect.width || 800} ${rect.height || 600}`);
  transform.tx = (rect.width || 800) / 2;
  transform.ty = (rect.height || 600) / 2;
  applyTransform();
}

await init();

// ─── Rendu carte ─────────────────────────────────────────────────────────────

function renderMap() {
  const discovered = new Map(cellules.map(c => [`${c.q},${c.r}`, c]));

  // Cellules adjacentes non découvertes
  const adjacent = new Set();
  for (const c of cellules) {
    for (const [dq, dr] of NEIGHBORS) {
      const key = `${c.q + dq},${c.r + dr}`;
      if (!discovered.has(key)) adjacent.add(key);
    }
  }

  let html = "";

  // Cellules adjacentes (contour en pointillés)
  for (const key of adjacent) {
    const [q, r] = key.split(",").map(Number);
    const { x, y } = hexToPixel(q, r);
    html += `<polygon
      points="${hexPoints(x, y)}"
      class="hex-adjacent"
      data-q="${q}" data-r="${r}"
    />`;
  }

  // Cellules découvertes
  for (const c of cellules) {
    const { x, y } = hexToPixel(c.q, c.r);
    const color = envFilterActive
      ? (ENV_FILTER_COLORS[c.environnement] || "#888")
      : (BIOME_COLORS[c.biome] || "#555");
    const icon = BIOME_ICONS[c.biome] || "?";
    html += `
      <g class="hex-cell" data-id="${c.id}" style="cursor:pointer">
        <polygon
          points="${hexPoints(x, y)}"
          fill="${color}"
          stroke="#0c0b0a"
          stroke-width="1.5"
        />
        <text
          x="${x}" y="${y + 5}"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="18"
          style="pointer-events:none;user-select:none"
        >${icon}</text>
        ${c.titre ? `<text
          x="${x}" y="${y + SIZE - 12}"
          text-anchor="middle"
          fill="rgba(255,255,255,.7)"
          font-size="8"
          font-family="Segoe UI,sans-serif"
          style="pointer-events:none;user-select:none"
        >${escapeHtml(c.titre.length > 12 ? c.titre.slice(0, 12) + "…" : c.titre)}</text>` : ""}
        ${c.montagne ? `<text x="${x - 17}" y="${y - 26}" font-size="11" style="pointer-events:none;user-select:none">⛰️</text>` : ""}
        ${c.riviere  ? `<text x="${x + 17}" y="${y - 26}" font-size="11" style="pointer-events:none;user-select:none">〰️</text>` : ""}
      </g>`;
  }

  mapRoot.innerHTML = html;

  // Événements click sur cellules découvertes
  mapRoot.querySelectorAll(".hex-cell").forEach(el => {
    el.addEventListener("click", () => {
      if (dragMoved) return;
      const id = el.dataset.id;
      const c = cellules.find(x => x.id === id);
      if (c) openCellModal(c);
    });
  });
}

function updateStats() {
  const el = document.getElementById("map-cell-count");
  if (el) el.textContent = `${cellules.length} cellule${cellules.length > 1 ? "s" : ""} découverte${cellules.length > 1 ? "s" : ""}`;
}

// ─── Pan & Zoom ───────────────────────────────────────────────────────────────

function applyTransform() {
  mapRoot.setAttribute("transform", `translate(${transform.tx},${transform.ty}) scale(${transform.scale})`);
}

svg.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  isDragging = true;
  dragMoved = false;
  dragStart = { x: e.clientX - transform.tx, y: e.clientY - transform.ty };
  svg.style.cursor = "grabbing";
});

window.addEventListener("mousemove", e => {
  if (!isDragging) return;
  const dx = Math.abs(e.clientX - dragStart.x - transform.tx);
  const dy = Math.abs(e.clientY - dragStart.y - transform.ty);
  if (dx > 4 || dy > 4) dragMoved = true;
  transform.tx = e.clientX - dragStart.x;
  transform.ty = e.clientY - dragStart.y;
  applyTransform();
});

window.addEventListener("mouseup", () => {
  isDragging = false;
  svg.style.cursor = "grab";
  setTimeout(() => { dragMoved = false; }, 50);
});

svg.addEventListener("wheel", e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 0.89;
  const rect = svg.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  transform.tx = mx - factor * (mx - transform.tx);
  transform.ty = my - factor * (my - transform.ty);
  transform.scale = Math.max(0.15, Math.min(6, transform.scale * factor));
  applyTransform();
}, { passive: false });

// Zoom boutons
document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
  transform.scale = Math.min(6, transform.scale * 1.2);
  applyTransform();
});
document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
  transform.scale = Math.max(0.15, transform.scale / 1.2);
  applyTransform();
});
document.getElementById("btn-zoom-reset")?.addEventListener("click", () => {
  const container = document.getElementById("map-container");
  const rect = container.getBoundingClientRect();
  transform = { tx: rect.width / 2, ty: rect.height / 2, scale: 1 };
  applyTransform();
});

// Touch (mobile) pinch-to-zoom
let lastTouches = null;
svg.addEventListener("touchstart", e => {
  lastTouches = e.touches;
}, { passive: true });
svg.addEventListener("touchmove", e => {
  e.preventDefault();
  if (e.touches.length === 1 && lastTouches?.length === 1) {
    const dx = e.touches[0].clientX - lastTouches[0].clientX;
    const dy = e.touches[0].clientY - lastTouches[0].clientY;
    transform.tx += dx;
    transform.ty += dy;
    applyTransform();
  } else if (e.touches.length === 2 && lastTouches?.length === 2) {
    const d0 = Math.hypot(lastTouches[0].clientX - lastTouches[1].clientX, lastTouches[0].clientY - lastTouches[1].clientY);
    const d1 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const factor = d1 / d0;
    transform.scale = Math.max(0.15, Math.min(6, transform.scale * factor));
    applyTransform();
  }
  lastTouches = e.touches;
}, { passive: false });

// ─── Fenêtre resize ───────────────────────────────────────────────────────────

window.addEventListener("resize", () => {
  const container = document.getElementById("map-container");
  const rect = container.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
});

// ─── Modal fiche cellule ──────────────────────────────────────────────────────

async function openCellModal(c) {
  // Charger les événements de cette cellule
  let evenements = [];
  if (c.evenement_ids?.length) {
    const snap = await getDocs(collection(db, "atelier_evenements"));
    const allEv = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    evenements = allEv.filter(e => c.evenement_ids.includes(e.id));
  }

  const icon = BIOME_ICONS[c.biome] || "🗺️";
  const color = BIOME_COLORS[c.biome] || "#888";
  const envColor = c.environnement ? (ENV_COLORS[c.environnement] || "var(--accent)") : "var(--muted2)";

  document.getElementById("cell-modal-biome").innerHTML =
    `<span style="margin-right:.35rem">${icon}</span><span style="color:${color}">${escapeHtml(c.biome)}</span>`;

  const envEl = document.getElementById("cell-modal-env");
  if (envEl) {
    envEl.style.display = c.environnement ? "" : "none";
    envEl.textContent = c.environnement || "";
    envEl.style.borderColor = envColor;
    envEl.style.color = envColor;
  }

  const featEl = document.getElementById("cell-modal-features");
  if (featEl) {
    const badges = [];
    if (c.montagne) badges.push(`<span class="cell-feature-badge mountain">⛰️ Montagne</span>`);
    if (c.riviere)  badges.push(`<span class="cell-feature-badge river">〰️ Rivière</span>`);
    featEl.innerHTML = badges.join("");
    featEl.style.display = badges.length ? "" : "none";
  }

  document.getElementById("cell-modal-meta").innerHTML = [
    `<span>Coordonnées : (${c.q}, ${c.r})</span>`,
    c.date_decouverte ? `<span>Découverte le ${formatDate(c.date_decouverte)}</span>` : "",
    c.titre ? `<span>📌 ${escapeHtml(c.titre)}</span>` : "",
  ].filter(Boolean).join(" · ");

  document.getElementById("cell-modal-chips").innerHTML =
    (c.mots_cles || []).map(m => `<span class="chip">${escapeHtml(m)}</span>`).join("");

  document.getElementById("cell-modal-desc").textContent = c.description || "Aucune description.";

  const evEl = document.getElementById("cell-modal-events");
  if (!evenements.length) {
    evEl.innerHTML = `<p class="action-empty">Aucun événement sur cette cellule.</p>`;
  } else {
    evEl.innerHTML = evenements.map(e => `
      <div class="cell-event-item">
        <div class="cell-event-type">${escapeHtml(e.type_label || e.type_id)}</div>
        ${e.titre ? `<div class="cell-event-title">${escapeHtml(e.titre)}</div>` : ""}
        <div class="cell-event-date">${e.cree_le ? formatDate(e.cree_le) : "—"}</div>
      </div>
    `).join("");
  }

  document.getElementById("cell-overlay").classList.remove("hidden");
}

document.getElementById("cell-close").addEventListener("click", () => {
  document.getElementById("cell-overlay").classList.add("hidden");
});

// ─── Légende ──────────────────────────────────────────────────────────────────

function renderLegend() {
  const el = document.getElementById("map-legend");
  if (!el) return;

  if (envFilterActive) {
    // Légende par environnement — uniquement ceux présents sur la carte
    const presentEnvs = [...new Set(cellules.map(c => c.environnement).filter(Boolean))];
    el.innerHTML = presentEnvs.map(env => `
      <div class="map-legend-item">
        <div class="map-legend-dot" style="background:${ENV_FILTER_COLORS[env] || '#888'}"></div>
        <span>${env}</span>
      </div>
    `).join("");
  } else {
    // Légende par biome (défaut)
    const presentBiomes = [...new Set(cellules.map(c => c.biome))];
    el.innerHTML = presentBiomes.map(b => `
      <div class="map-legend-item">
        <div class="map-legend-dot" style="background:${BIOME_COLORS[b] || '#888'}"></div>
        <span>${BIOME_ICONS[b] || ""} ${b}</span>
      </div>
    `).join("");
  }
}

// ─── Toggle filtre environnement ──────────────────────────────────────────────

document.getElementById("btn-env-filter")?.addEventListener("click", () => {
  envFilterActive = !envFilterActive;
  const btn = document.getElementById("btn-env-filter");
  if (envFilterActive) {
    btn.style.background = "var(--accent)";
    btn.style.color = "#0c0b0a";
    btn.style.border = "1px solid var(--accent)";
    btn.textContent = "🎨 Vue biomes";
  } else {
    btn.style.background = "";
    btn.style.color = "";
    btn.style.border = "";
    btn.textContent = "🌍 Vue environnements";
  }
  renderMap();
  renderLegend();
});

renderLegend();
