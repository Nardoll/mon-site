import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMigraines, addMigraine, updateMigraine, deleteMigraine } from "./db.js";
import { formatDate, formatDateShort, showToast } from "./utils.js";

await requireAuth();
initNav("migraines");

let migraines = [];
let currentUnit = "month"; // 'day' | 'month' | 'year'
let chartInstance = null;
let editId = null;
let deleteId = null;

// ── Init ───────────────────────────────────────────────────────────

async function init() {
  migraines = await getMigraines();
  renderKpis();
  await renderChart();
  renderTable();
}

// ── KPIs ───────────────────────────────────────────────────────────

function renderKpis() {
  const now = new Date();
  const ceMonthCount = migraines.filter(m => {
    const d = toDate(m.date);
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const cetteAnneeCount = migraines.filter(m => {
    const d = toDate(m.date);
    return d && d.getFullYear() === now.getFullYear();
  }).length;

  const derniere = migraines[0];
  const daysSinceLast = derniere
    ? Math.floor((now - toDate(derniere.date)) / 86400000)
    : null;

  document.getElementById("kpi-grid").innerHTML = `
    <div class="kpi">
      <div class="kpi-value">${migraines.length}</div>
      <div class="kpi-label">Total enregistrées</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${cetteAnneeCount}</div>
      <div class="kpi-label">Cette année</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${ceMonthCount}</div>
      <div class="kpi-label">Ce mois</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${daysSinceLast !== null ? daysSinceLast : "—"}</div>
      <div class="kpi-label">Jours depuis la dernière</div>
    </div>
  `;
}

// ── Graphique ──────────────────────────────────────────────────────

async function loadChartJs() {
  if (window.Chart) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js";
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function toDate(ts) {
  if (!ts) return null;
  return ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
}

function aggregateMigraines(unit) {
  if (!migraines.length) return [];

  const sorted = [...migraines]
    .map(m => ({ ...m, _d: toDate(m.date) }))
    .filter(m => m._d)
    .sort((a, b) => a._d - b._d);

  if (!sorted.length) return [];

  const first = sorted[0]._d;
  const last = sorted[sorted.length - 1]._d;

  // Build count map
  const counts = {};
  sorted.forEach(m => {
    const key = periodKey(m._d, unit);
    counts[key] = (counts[key] || 0) + 1;
  });

  // Generate all periods between first and last (linear scale with gaps at 0)
  const points = [];
  if (unit === "day") {
    const cur = new Date(first);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(last);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      points.push({ label: labelFor(new Date(cur), unit), value: counts[periodKey(cur, unit)] || 0 });
      cur.setDate(cur.getDate() + 1);
    }
  } else if (unit === "month") {
    let y = first.getFullYear(), mo = first.getMonth();
    const ey = last.getFullYear(), emo = last.getMonth();
    while (y < ey || (y === ey && mo <= emo)) {
      const d = new Date(y, mo, 1);
      points.push({ label: labelFor(d, unit), value: counts[periodKey(d, unit)] || 0 });
      mo++;
      if (mo > 11) { mo = 0; y++; }
    }
  } else {
    for (let y = first.getFullYear(); y <= last.getFullYear(); y++) {
      const d = new Date(y, 0, 1);
      points.push({ label: labelFor(d, unit), value: counts[periodKey(d, unit)] || 0 });
    }
  }

  return points;
}

function periodKey(d, unit) {
  if (unit === "day") return d.toISOString().split("T")[0];
  if (unit === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return String(d.getFullYear());
}

function labelFor(d, unit) {
  if (unit === "day") return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  if (unit === "month") return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  return String(d.getFullYear());
}

async function renderChart() {
  await loadChartJs();

  const points = aggregateMigraines(currentUnit);
  const canvas = document.getElementById("chart-migraines");
  const emptyEl = document.getElementById("chart-empty");

  if (!points.length) {
    canvas.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    return;
  }
  canvas.classList.remove("hidden");
  emptyEl.classList.add("hidden");

  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue("--accent").trim() || "#14b8a6";
  const border = style.getPropertyValue("--border").trim() || "#1c2c2b";
  const muted  = style.getPropertyValue("--muted2").trim() || "#6b9e9a";

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  chartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: points.map(p => p.label),
      datasets: [{
        label: "Migraines",
        data: points.map(p => p.value),
        backgroundColor: accent + "80",
        borderColor: accent,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} migraine${ctx.parsed.y > 1 ? "s" : ""}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: border },
          ticks: { color: muted, maxTicksLimit: currentUnit === "day" ? 14 : 24 }
        },
        y: {
          min: 0,
          ticks: { stepSize: 1, color: muted },
          grid: { color: border }
        }
      }
    }
  });
}

// ── Tableau ────────────────────────────────────────────────────────

function escHtml(s) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTable() {
  const container = document.getElementById("table-container");
  if (!migraines.length) {
    container.innerHTML = `<div class="empty-state"><span class="big-icon">👁️</span>Aucune migraine enregistrée pour l'instant.</div>`;
    return;
  }
  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Commentaire</th>
          <th style="width:100px"></th>
        </tr>
      </thead>
      <tbody>
        ${migraines.map(m => `
          <tr>
            <td style="white-space:nowrap;font-weight:600">${formatDate(m.date)}</td>
            <td style="color:var(--muted2)">${m.commentaire ? escHtml(m.commentaire) : "<em>—</em>"}</td>
            <td>
              <div style="display:flex;gap:.4rem;justify-content:flex-end">
                <button class="btn btn-secondary btn-sm" data-edit="${m.id}">✏️</button>
                <button class="btn btn-danger btn-sm" data-del="${m.id}">🗑️</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  container.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openForm(migraines.find(m => m.id === btn.dataset.edit)));
  });
  container.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => openDelete(btn.dataset.del));
  });
}

// ── Formulaire ─────────────────────────────────────────────────────

function openForm(existing = null) {
  editId = existing?.id ?? null;
  document.getElementById("form-title").textContent = existing ? "Modifier la migraine" : "Ajouter une migraine";

  const dateDefault = new Date().toISOString().split("T")[0];
  document.getElementById("f-date").value = existing?.date?.seconds
    ? new Date(existing.date.seconds * 1000).toISOString().split("T")[0]
    : dateDefault;
  document.getElementById("f-commentaire").value = existing?.commentaire ?? "";

  document.getElementById("form-overlay").classList.remove("hidden");
}

document.getElementById("btn-add").addEventListener("click", () => openForm());
document.getElementById("form-close").addEventListener("click", closeForm);
document.getElementById("form-cancel").addEventListener("click", closeForm);
document.getElementById("form-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeForm();
});

function closeForm() {
  document.getElementById("form-overlay").classList.add("hidden");
  editId = null;
}

document.getElementById("form-save").addEventListener("click", async () => {
  const date = document.getElementById("f-date").value;
  if (!date) { showToast("La date est obligatoire.", "error"); return; }
  const commentaire = document.getElementById("f-commentaire").value.trim();

  try {
    if (editId) {
      await updateMigraine(editId, { date, commentaire });
      showToast("Migraine modifiée !", "success");
    } else {
      await addMigraine({ date, commentaire });
      showToast("Migraine ajoutée !", "success");
    }
    closeForm();
    migraines = await getMigraines();
    renderKpis();
    await renderChart();
    renderTable();
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
});

// ── Suppression ────────────────────────────────────────────────────

function openDelete(id) {
  deleteId = id;
  document.getElementById("del-overlay").classList.remove("hidden");
}

document.getElementById("del-close").addEventListener("click", closeDelete);
document.getElementById("del-cancel").addEventListener("click", closeDelete);
document.getElementById("del-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeDelete();
});

function closeDelete() {
  document.getElementById("del-overlay").classList.add("hidden");
  deleteId = null;
}

document.getElementById("del-confirm").addEventListener("click", async () => {
  if (!deleteId) return;
  try {
    await deleteMigraine(deleteId);
    showToast("Supprimée.", "success");
    closeDelete();
    migraines = await getMigraines();
    renderKpis();
    await renderChart();
    renderTable();
  } catch (e) {
    showToast("Erreur : " + e.message, "error");
  }
});

// ── Toggle unité graphique ─────────────────────────────────────────

document.getElementById("unit-tabs").addEventListener("click", async e => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  currentUnit = btn.dataset.unit;
  document.querySelectorAll("#unit-tabs .tab-btn").forEach(b => b.classList.toggle("active", b === btn));
  await renderChart();
});

// ── Démarrage ──────────────────────────────────────────────────────

init().catch(console.error);
