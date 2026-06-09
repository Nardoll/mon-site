import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getLivres, getMembres, getVotes, getVoteActif } from "./db.js";
import { formatMois, showToast } from "./utils.js";

await requireAuth();
initNav("votes");

// ── State ─────────────────────────────────────────────────────────────
let voteActif = null, votes = [], livres = [], membres = [];

// ── Helpers ───────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toDate(ts) { return ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null; }

// ── Vote en cours ─────────────────────────────────────────────────────
function renderActif() {
  const mount = document.getElementById("actif-mount");

  if (!voteActif) {
    mount.innerHTML = `<div class="no-vote">Aucun vote en cours pour le moment.</div>`;
    return;
  }

  const isTour2   = voteActif.tour === 2;
  const livreIds  = voteActif.livre_ids  || [];
  const bulletins = voteActif.bulletins  || {};
  const membreIds = voteActif.membre_ids || [];
  const submitted = Object.keys(bulletins);
  const pct       = membreIds.length ? Math.round(submitted.length / membreIds.length * 100) : 0;
  const deadline  = toDate(voteActif.expires_at);
  const dlStr     = deadline ? deadline.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : '—';
  const daysLeft  = deadline ? Math.ceil((deadline - new Date()) / 864e5) : null;
  const dlSuffix  = daysLeft !== null
    ? daysLeft > 0  ? ` <span style="color:var(--accent)">(dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''})</span>`
    : daysLeft === 0 ? ` <span style="color:var(--accent)">(aujourd'hui)</span>`
    : ` <span style="color:var(--red)">(dépassée)</span>` : '';

  mount.innerHTML = `
    <div class="vac">
      <div class="vac-head">
        <div>
          <div class="vac-title">Vote en cours${isTour2 ? ' — Tour 2' : ''}</div>
          <div class="vac-sub">${formatMois(voteActif.mois, voteActif.annee)}</div>
        </div>
        <span class="vac-pill${isTour2 ? ' t2' : ''}">
          ${isTour2
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> 2ème tour'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="m9 13 2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg> Vote actif'}
        </span>
      </div>

      <div class="vac-deadline">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        Deadline :&nbsp;<b>${dlStr}</b>${dlSuffix}
      </div>

      <div class="vac-livres">
        ${livreIds.map(id => {
          const l = livres.find(b => b.id === id);
          return `<div class="vac-livre">
            <div class="vac-livre-title">${esc(l?.titre ?? id)}</div>
            ${l?.auteur ? `<div class="vac-livre-author">${esc(l.auteur)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>

      <div class="vac-prog-label">Bulletins soumis — ${submitted.length} / ${membreIds.length}</div>
      <div class="vac-prog-bar"><div class="vac-prog-fill" style="width:${pct}%"></div></div>
      <div class="vac-bul-grid">
        ${membreIds.map(id => {
          const done = submitted.includes(id);
          const m = membres.find(x => x.id === id);
          return `<div class="vac-bul-item">
            <span class="vac-dot ${done ? 'done' : 'todo'}"></span>
            <span>${esc(m?.nom ?? id)}</span>
            ${done ? '<span class="vac-bul-ok">✓</span>' : ''}
          </div>`;
        }).join('')}
      </div>

      <div class="vac-actions">
        <a href="vote.html" class="btn btn-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="m9 13 2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg>
          Mon bulletin
        </a>
      </div>
    </div>`;
}

// ── Historique ────────────────────────────────────────────────────────
function renderHisto() {
  const mount = document.getElementById("histo-mount");

  if (!votes.length) {
    mount.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:.3rem 0">Aucun vote archivé pour l\'instant.</div>';
    return;
  }

  mount.innerHTML = `<div class="vh-list">${votes.map(v => {
    const resultats = [...(v.resultats || [])].sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
    const allNotes  = resultats.flatMap(r => Object.values(r.notes || {})).map(Number).filter(n => !isNaN(n));
    const echelle   = allNotes.length && Math.max(...allNotes) <= 5 ? 5 : 10;
    const eluR      = resultats.find(r => r.livre_id === v.livre_elu);
    const eluLivre  = livres.find(l => l.id === v.livre_elu);
    const eluTitre  = eluR?.titre ?? eluLivre?.titre ?? '—';
    const memCols   = membres.filter(m => resultats.some(r => m.id in (r.notes ?? {})));

    return `<div class="vh-card" id="vh-${v.id}">
      <div class="vh-head" data-id="${v.id}">
        <span class="vh-chev">▶</span>
        <span class="vh-mois">${formatMois(v.mois, v.annee)}</span>
        ${v.livre_elu
          ? `<span class="vh-elu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>
              ${esc(eluTitre)}</span>`
          : '<span class="vh-no-elu">Aucun élu</span>'}
      </div>
      <div class="vh-body">
        ${v.tour2 ? `<div class="vh-t2note">⚡ 2ème tour — résultats du tour final affichés</div>` : ''}
        ${resultats.length
          ? `<div style="overflow-x:auto">
              <table class="vh-table">
                <thead><tr>
                  <th>Livre</th>
                  ${memCols.map(m => `<th class="c">${esc(m.nom.split(' ')[0])}</th>`).join('')}
                  <th class="c">Moyenne</th>
                </tr></thead>
                <tbody>${resultats.map(r => `<tr class="${r.livre_id === v.livre_elu ? 'elu' : ''}">
                  <td class="col-titre">${esc(r.titre)}${r.auteur ? `<br><span style="font-size:.73rem;color:var(--muted)">${esc(r.auteur)}</span>` : ''}</td>
                  ${memCols.map(m => {
                    const n = r.notes?.[m.id];
                    const val = (n !== undefined && n !== null && n !== '') ? Number(n).toFixed(1) : null;
                    return `<td class="c">${val ?? '<span class="vh-abs">—</span>'}</td>`;
                  }).join('')}
                  <td class="vh-moy">${r.moyenne !== null && r.moyenne !== undefined ? Number(r.moyenne).toFixed(2) : '—'}<span style="font-size:.62rem;color:var(--muted);font-weight:400">/${echelle}</span></td>
                </tr>`).join('')}</tbody>
              </table>
            </div>`
          : '<div style="color:var(--muted);font-size:.83rem">Aucun résultat enregistré.</div>'}
      </div>
    </div>`;
  }).join('')}</div>`;

  document.querySelectorAll(".vh-head[data-id]").forEach(head => {
    head.addEventListener("click", () => {
      document.getElementById(`vh-${head.dataset.id}`).classList.toggle("open");
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────
async function init() {
  [voteActif, votes, livres, membres] = await Promise.all([
    getVoteActif(), getVotes(), getLivres(), getMembres(),
  ]);
  renderActif();
  renderHisto();
}

init().catch(console.error);
