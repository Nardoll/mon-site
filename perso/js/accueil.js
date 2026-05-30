import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getMigraines } from "./db.js";
import { formatDate } from "./utils.js";

await requireAuth();
initNav("accueil");

async function init() {
  const migraines = await getMigraines();
  const el = document.getElementById("accueil-content");

  const now = new Date();
  const ceMonthCount = migraines.filter(m => {
    const d = m.date?.seconds ? new Date(m.date.seconds * 1000) : null;
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const derniere = migraines[0];
  const derniereStr = derniere ? formatDate(derniere.date) : "Aucune enregistrée";

  el.innerHTML = `
    <div class="kpi-grid" style="max-width:640px">
      <div class="kpi">
        <div class="kpi-value">${migraines.length}</div>
        <div class="kpi-label">Migraines enregistrées</div>
      </div>
      <div class="kpi">
        <div class="kpi-value">${ceMonthCount}</div>
        <div class="kpi-label">Ce mois-ci</div>
      </div>
    </div>

    <div class="card" style="max-width:640px">
      <div class="card-title">Dernière migraine</div>
      <div style="font-size:.92rem">${derniereStr}</div>
      ${derniere?.commentaire ? `<div style="font-size:.82rem;color:var(--muted2);margin-top:.35rem">${escHtml(derniere.commentaire)}</div>` : ""}
    </div>

    <div style="margin-top:1.5rem">
      <a href="/perso/migraines.html" class="btn btn-primary">👁️ Voir l'historique complet →</a>
    </div>
  `;
}

function escHtml(s) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

init().catch(console.error);
