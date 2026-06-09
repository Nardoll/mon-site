import { requireAuth } from "./auth.js";
import { initNav } from "./nav.js";
import { getVotes, getMembres, getLivres, getVoteActif } from "./db.js";
import { formatMois, MOIS_NOMS, showToast } from "./utils.js";

await requireAuth();
initNav("votes");

let votes = [], membres = [], livres = [];
let voteActif = null;
let currentVoteId = null;
let countdownInterval = null;
let nextCountdownInterval = null;

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function toDate(ts) { return ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null; }

// ── Init ──────────────────────────────────────────────────────────────
async function init() {
  [votes, membres, livres] = await Promise.all([getVotes(), getMembres(), getLivres()]);
  voteActif = await getVoteActif();

  // Clôture auto si expiré
  if (voteActif && voteActif.expires_at?.toMillis() < Date.now()) {
    voteActif = await getVoteActif(); // re-fetch au cas où déjà clos depuis vote.html
  }

  renderStatusCard();
  renderList();
  if (voteActif) startCountdown();

  const openId = new URLSearchParams(window.location.search).get("open");
  if (openId) openDetail(openId);
}

// ── Encart statut ─────────────────────────────────────────────────────
function renderStatusCard() {
  const card = document.getElementById("vote-status-card");
  if (!card) return;
  if (nextCountdownInterval) { clearInterval(nextCountdownInterval); nextCountdownInterval = null; }

  if (voteActif) {
    const bulletins = voteActif.bulletins || {};
    const isTour2   = voteActif.tour === 2;
    const livreIds  = voteActif.livre_ids || [];
    const membreIds = voteActif.membre_ids || [];

    const hasVoted = id => {
      const b = bulletins[id];
      return isTour2 ? (b != null && b !== "") : (b && Object.keys(b).length > 0);
    };
    const nbVoted   = membreIds.filter(hasVoted).length;
    const nbMembres = membreIds.length;

    const booksHtml = livreIds.map(id => {
      const l = livres.find(b => b.id === id);
      return `<div class="vs-book">
        <div class="vs-book-title">${esc(l?.titre ?? id)}</div>
        ${l?.auteur ? `<div class="vs-book-author">${esc(l.auteur)}</div>` : ''}
      </div>`;
    }).join('');

    const bilanHtml = membreIds.map(id => {
      const m = membres.find(x => x.id === id);
      const voted = hasVoted(id);
      return `<div class="vs-bilan-row">
        <span class="vs-dot ${voted ? 'done' : 'todo'}"></span>
        <span>${esc(m?.nom ?? id)}</span>
        ${voted ? '<span class="vs-tick">✓</span>' : ''}
      </div>`;
    }).join('');

    card.innerHTML = `
      <div class="vs-card">
        <div class="vs-row">
          <div class="vs-left">
            <div class="vs-icon">${isTour2 ? '⚖️' : '🗳️'}</div>
            <div>
              <div class="vs-title">${isTour2 ? 'Deuxième tour' : 'Vote en cours'} — ${formatMois(voteActif.mois, voteActif.annee)}</div>
              <div class="vs-meta">${livreIds.length} livre${livreIds.length > 1 ? 's' : ''} · ${nbVoted}/${nbMembres} bulletins soumis</div>
              <div class="vs-countdown" id="vsc-countdown"></div>
              <div class="vs-books">${booksHtml}</div>
              <div class="vs-bilan">${bilanHtml}</div>
            </div>
          </div>
          <div class="vs-right">
            <a href="vote.html" class="btn btn-primary">🗳️ Mon bulletin →</a>
          </div>
        </div>
      </div>`;

    updateCountdown();

  } else {
    const now      = new Date();
    const nextVote = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const moisStr  = MOIS_NOMS[nextVote.getMonth()] + " " + nextVote.getFullYear();
    const props    = livres.filter(l => l.statut === "en_proposition");

    card.innerHTML = `
      <a href="vote.html" class="vs-next-link">
        <div class="vs-card">
          <div class="vs-row">
            <div class="vs-left">
              <div class="vs-icon">📅</div>
              <div>
                <div class="vs-title">Prochain vote — ${moisStr}</div>
                <div class="vs-meta">${props.length} livre${props.length !== 1 ? 's' : ''} en compétition · Ouverture le 1er du mois</div>
                <div class="vs-countdown" id="vsc-next-countdown"></div>
              </div>
            </div>
            <div class="vs-right" style="font-size:1.5rem;color:var(--muted)">›</div>
          </div>
        </div>
      </a>`;

    startNextCountdown(nextVote);
  }
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  updateCountdown();
  countdownInterval = setInterval(() => {
    if (!voteActif) { clearInterval(countdownInterval); return; }
    updateCountdown();
  }, 1000);
}

function updateCountdown() {
  const el = document.getElementById("vsc-countdown");
  if (!el || !voteActif?.expires_at) return;
  const ms = voteActif.expires_at.toMillis() - Date.now();
  if (ms <= 0) { el.textContent = "Vote expiré…"; return; }
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
  parts.push(`${String(h).padStart(2,"0")}h`);
  parts.push(`${String(m).padStart(2,"0")}min`);
  parts.push(`${String(s).padStart(2,"0")}s`);
  el.textContent = parts.join(" ");
}

// ── Liste historique ──────────────────────────────────────────────────
function renderList() {
  const container = document.getElementById("votes-list");
  if (!votes.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:.85rem;padding:.3rem 0">Aucun vote archivé pour l'instant.</div>`;
    return;
  }
  container.innerHTML = `<div class="vl-list">${votes.map(v => {
    const eluR     = (v.resultats || []).find(r => r.livre_id === v.livre_elu);
    const eluLivre = livres.find(l => l.id === v.livre_elu);
    const eluTitre = eluR?.titre ?? eluLivre?.titre ?? null;
    const eluHtml  = eluTitre
      ? `📖 <strong>${esc(eluTitre)}</strong>`
      : `<span style="color:var(--muted);font-style:italic">Aucun élu</span>`;
    return `<div class="vl-item" data-id="${v.id}">
      <div class="vl-mois">${formatMois(v.mois, v.annee)}</div>
      <div class="vl-elu">${eluHtml}</div>
      <div class="vl-cnt">${(v.resultats || []).length} livre${(v.resultats||[]).length > 1 ? 's' : ''}</div>
      <div class="vl-arr">›</div>
    </div>`;
  }).join('')}</div>`;

  container.querySelectorAll(".vl-item[data-id]").forEach(el => {
    el.addEventListener("click", () => openDetail(el.dataset.id));
  });
}

// ── Détail vote ───────────────────────────────────────────────────────
function openDetail(id) {
  currentVoteId = id;
  const vote = votes.find(v => v.id === id);
  if (!vote) return;
  document.getElementById("detail-title").textContent = `Vote — ${formatMois(vote.mois, vote.annee)}`;
  document.getElementById("detail-content").innerHTML = renderDetailContent(vote);
  document.getElementById("detail-overlay").classList.remove("hidden");
  attachChartInteraction(vote);
}

function renderDetailContent(vote) {
  const resultats = vote.resultats || [];
  if (!resultats.length) return `<div style="color:var(--muted);font-size:.85rem;padding:1rem 0">Aucune donnée disponible.</div>`;

  const sorted   = [...resultats].sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));
  const allNotes = resultats.flatMap(r => Object.values(r.notes || {})).map(Number).filter(n => !isNaN(n));
  const scale    = allNotes.length && Math.max(...allNotes) <= 5 ? 5 : 10;
  const eluId    = vote.livre_elu;
  const tour1Elu = vote.tour2 ? null : eluId;

  let html = '';
  if (vote.tour2) html += `<div class="vd-tour-label">Tour 1 — Résultats (égalité au premier tour)</div>`;

  html += renderBarChart(sorted, scale, 2.5, tour1Elu);
  html += `<div class="vd-divider"></div>`;
  html += `<div class="vd-sec-title">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    Votes individuels${vote.tour2 ? ' — Tour 1' : ''}
  </div>`;
  html += renderNotesTable(sorted, scale, tour1Elu);

  if (vote.tour2) {
    html += `<div class="vd-divider"></div>`;
    html += renderTour2(vote.tour2, eluId);
  }

  html += renderMemberChartSection(sorted);
  return html;
}

function renderBarChart(sorted, scale, threshold, eluId) {
  const areaH = 200;
  const thresholdPx = Math.round((threshold / scale) * areaH);
  const bars = sorted.map(r => {
    const moy    = r.moyenne ?? 0;
    const barH   = Math.max(3, Math.round((moy / scale) * areaH));
    const isElu  = r.livre_id === eluId;
    const isElim = !isElu && moy < threshold;
    const color  = isElu ? 'var(--green)' : isElim ? 'var(--elim)' : 'var(--purple)';
    return `<div class="vchart-col">
      <div class="vchart-val" style="color:${color}">${Number(moy).toFixed(2)}</div>
      <div class="vchart-bar" style="height:${barH}px;background:${color}"></div>
    </div>`;
  }).join('');
  const labels = sorted.map(r => `<div class="vchart-label-col">${esc(r.titre ?? '?')}</div>`).join('');
  return `
    <div class="vchart-legend">
      <div class="vchart-legend-item"><div class="vchart-legend-dot" style="background:var(--green)"></div>Gagnant</div>
      <div class="vchart-legend-item"><div class="vchart-legend-dot" style="background:var(--purple)"></div>Conservé (≥ ${threshold})</div>
      <div class="vchart-legend-item"><div class="vchart-legend-dot" style="background:var(--elim)"></div>Éliminé (&lt; ${threshold})</div>
    </div>
    <div class="vchart-outer">
      <div class="vchart-wrap">
        <div class="vchart-bars-area" style="height:${areaH}px">
          <div class="vchart-threshold" style="bottom:${thresholdPx}px">
            <span class="vchart-threshold-label">Seuil : ${threshold}</span>
          </div>
          ${bars}
        </div>
        <div class="vchart-labels">${labels}</div>
      </div>
    </div>`;
}

function renderNotesTable(sorted, scale, eluId) {
  const headers = sorted.map(r => {
    const isElu  = r.livre_id === eluId;
    const isElim = !isElu && (r.moyenne ?? 0) < 2.5;
    return `<th class="${isElu ? 'winner-col' : isElim ? 'elim-col' : ''}">${esc(r.titre ?? '?')}</th>`;
  }).join('');

  const rows = membres.map(m => {
    const cells = sorted.map(r => {
      const note = r.notes?.[m.id];
      if (note === undefined || note === null || note === '') return `<td>—</td>`;
      const n    = Number(note);
      const isElu  = r.livre_id === eluId;
      const isElim = !isElu && (r.moyenne ?? 0) < 2.5;
      return `<td class="${isElu ? 'winner-cell' : isElim ? 'elim-cell' : ''}">${n}/${scale}<br><span class="stars">${renderStars(n, scale)}</span></td>`;
    }).join('');
    const myNotes = sorted.map(r => r.notes?.[m.id]).filter(n => n !== undefined && n !== null && n !== '').map(Number).filter(n => !isNaN(n));
    const myAvg   = myNotes.length ? myNotes.reduce((a, b) => a + b, 0) / myNotes.length : null;
    return `<tr><td class="col-member">${esc(m.nom)}</td>${cells}<td class="${myAvg !== null ? 'winner-avg' : ''}">${myAvg !== null ? myAvg.toFixed(2) : '—'}</td></tr>`;
  }).join('');

  const avgCells = sorted.map(r => {
    const isElu = r.livre_id === eluId;
    return `<td class="${isElu ? 'winner-avg' : 'book-avg'}">${r.moyenne !== null && r.moyenne !== undefined ? Number(r.moyenne).toFixed(2) : '—'}</td>`;
  }).join('');

  return `<div class="vtable-wrap"><table class="vtable">
    <thead><tr><th class="col-member">Votant</th>${headers}<th>Moy.</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="vtable-foot-row"><td class="col-member">Moyenne</td>${avgCells}<td></td></tr></tfoot>
  </table></div>`;
}

function renderTour2(tour2, eluId) {
  const sorted   = [...(tour2.resultats || [])].sort((a, b) => b.votes - a.votes);
  const maxVotes = Math.max(0, ...sorted.map(r => r.votes));
  const bars = sorted.map(r => {
    const isW  = r.livre_id === eluId;
    const pct  = maxVotes > 0 ? Math.round(r.votes / maxVotes * 100) : 0;
    const color = isW ? 'var(--green)' : 'var(--purple)';
    return `<div class="vt2-row">
      <div class="vt2-label">${esc(r.titre)}</div>
      <div class="vt2-bar-wrap"><div class="vt2-bar" style="width:${pct}%;background:${color}">${r.votes}</div></div>
      <div class="vt2-count" style="color:${color}">${r.votes} vote${r.votes !== 1 ? 's' : ''}${isW ? ' 🏆' : ''}</div>
    </div>`;
  }).join('');
  return `
    <div class="vd-tour-label">Tour 2 — Vote par choix unique${tour2.tirage_au_sort ? ' · tirage au sort' : ''}</div>
    ${tour2.tirage_au_sort ? `<div class="vt2-tirage">🎲 Égalité au 2ème tour — gagnant désigné par tirage au sort.</div>` : ''}
    <div class="vt2-detail">${bars}</div>`;
}

function renderMemberChartSection(sorted) {
  const votantIds = new Set();
  sorted.forEach(r => Object.keys(r.notes || {}).forEach(id => votantIds.add(id)));
  if (!votantIds.size) return '';

  const memOpts = [...votantIds]
    .map(id => membres.find(m => m.id === id)).filter(Boolean)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map(m => `<option value="${m.id}">${esc(m.nom)}</option>`).join('');
  const livOpts = sorted.map(r => `<option value="${r.livre_id}">${esc(r.titre ?? r.livre_id)}</option>`).join('');

  return `
    <div class="vd-divider"></div>
    <div class="vd-chart-head">
      <div class="vd-sec-title" style="margin-bottom:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        Détail des votes
      </div>
      <div class="vd-chart-tabs">
        <button class="vd-tab on" data-tab="membre">Par votant</button>
        <button class="vd-tab" data-tab="livre">Par livre</button>
      </div>
    </div>
    <select class="vd-member-select" id="vd-mem-sel">${memOpts}</select>
    <select class="vd-member-select hidden" id="vd-liv-sel">${livOpts}</select>
    <div id="vd-chart-area"></div>`;
}

function attachChartInteraction(vote) {
  const memSel  = document.getElementById("vd-mem-sel");
  const livSel  = document.getElementById("vd-liv-sel");
  const area    = document.getElementById("vd-chart-area");
  const tabs    = document.querySelectorAll(".vd-tab");
  if (!memSel || !livSel || !area) return;

  const resultats = vote.resultats || [];
  const allNotes  = resultats.flatMap(r => Object.values(r.notes || {})).map(Number).filter(n => !isNaN(n));
  const scale     = allNotes.length && Math.max(...allNotes) <= 5 ? 5 : 10;

  function avgLine(avg) {
    return `<div style="font-size:.8rem;color:var(--muted);margin-bottom:.5rem">Moyenne : <strong style="color:var(--accent)">${avg.toFixed(2)}/${scale}</strong></div>`;
  }

  function renderMembre(memId) {
    const rows = resultats
      .filter(r => r.notes?.[memId] !== undefined && r.notes[memId] !== null && r.notes[memId] !== '')
      .sort((a, b) => Number(b.notes[memId]) - Number(a.notes[memId]));
    if (!rows.length) { area.innerHTML = `<div style="color:var(--muted);font-size:.83rem">Aucun vote pour ce membre.</div>`; return; }
    const avg = rows.reduce((s, r) => s + Number(r.notes[memId]), 0) / rows.length;
    area.innerHTML = avgLine(avg) + `<div class="chart">${rows.map((r, i) => {
      const note = Number(r.notes[memId]);
      const pct  = Math.round((note / scale) * 100);
      return `<div class="chart-row">
        <div class="chart-label"><span style="opacity:.45;margin-right:.3rem">${i+1}.</span>${esc(r.titre ?? '?')}</div>
        <div class="chart-bar-wrap"><div class="chart-bar ${vote.livre_elu === r.livre_id ? 'best' : ''}" style="width:${pct}%">${note}/${scale}</div></div>
      </div>`;
    }).join('')}</div>`;
  }

  function renderLivre(livId) {
    const result = resultats.find(r => r.livre_id === livId);
    if (!result) { area.innerHTML = ''; return; }
    const memberNotes = Object.entries(result.notes || {})
      .map(([mid, note]) => ({ m: membres.find(mb => mb.id === mid), note: Number(note) }))
      .filter(x => x.m && !isNaN(x.note))
      .sort((a, b) => b.note - a.note);
    if (!memberNotes.length) { area.innerHTML = `<div style="color:var(--muted);font-size:.83rem">Aucun vote pour ce livre.</div>`; return; }
    const avg = memberNotes.reduce((s, x) => s + x.note, 0) / memberNotes.length;
    area.innerHTML = avgLine(avg) + `<div class="chart">${memberNotes.map((x, i) => {
      const pct = Math.round((x.note / scale) * 100);
      return `<div class="chart-row">
        <div class="chart-label"><span style="opacity:.45;margin-right:.3rem">${i+1}.</span>${esc(x.m.nom)}</div>
        <div class="chart-bar-wrap"><div class="chart-bar" style="width:${pct}%">${x.note}/${scale}</div></div>
      </div>`;
    }).join('')}</div>`;
  }

  function switchTab(tab) {
    tabs.forEach(t => t.classList.toggle("on", t.dataset.tab === tab));
    if (tab === "membre") {
      memSel.classList.remove("hidden");
      livSel.classList.add("hidden");
      renderMembre(memSel.value);
    } else {
      memSel.classList.add("hidden");
      livSel.classList.remove("hidden");
      renderLivre(livSel.value);
    }
  }

  tabs.forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  memSel.addEventListener("change", () => renderMembre(memSel.value));
  livSel.addEventListener("change", () => renderLivre(livSel.value));
  renderMembre(memSel.value);
}

function renderStars(note, scale) {
  const n = Math.round((note / scale) * 5);
  return "★".repeat(n) + "☆".repeat(5 - n);
}

// ── Fermer détail ─────────────────────────────────────────────────────
document.getElementById("detail-close").addEventListener("click", () => {
  document.getElementById("detail-overlay").classList.add("hidden");
});
document.getElementById("detail-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.getElementById("detail-overlay").classList.add("hidden");
});

init().catch(console.error);
