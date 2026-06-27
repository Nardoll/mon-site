import { requireProfile }                from './auth.js';
import { injectTopBar, injectBottomNav } from './nav.js';
import { getTournaments, getLeaderboard } from './db.js';

requireProfile(async (profile) => {
  injectTopBar(profile);
  injectBottomNav('classement');
  await renderClassement(profile);
});

async function renderClassement(profile) {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page-title">Classement</div>
    <div id="filter-wrap"></div>
    <div id="lb-wrap"><div class="empty-state">Chargement…</div></div>
  `;

  const tournaments = await getTournaments();
  const withData = tournaments.filter(t => t.status !== 'upcoming');

  renderFilters(withData, profile);
  await showLeaderboard(null, profile);
}

function renderFilters(tournaments, profile) {
  const wrap = document.getElementById('filter-wrap');
  if (tournaments.length <= 1) return;

  wrap.innerHTML = `
    <div class="tour-filters">
      <button class="btn-filter active" data-id="">Tous les tournois</button>
      ${tournaments.map(t =>
        `<button class="btn-filter" data-id="${t.id}">${esc(t.short_name || t.name)}</button>`
      ).join('')}
    </div>
  `;

  wrap.querySelectorAll('.btn-filter').forEach(btn => {
    btn.addEventListener('click', async () => {
      wrap.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await showLeaderboard(btn.dataset.id || null, profile);
    });
  });
}

async function showLeaderboard(tournamentId, profile) {
  const wrap = document.getElementById('lb-wrap');
  wrap.innerHTML = '<div class="empty-state">Chargement…</div>';

  const entries = await getLeaderboard(tournamentId);

  if (entries.every(e => e.points === 0)) {
    wrap.innerHTML = '<div class="empty-state">Aucune donnée de score pour le moment.</div>';
    return;
  }

  const rankClass = i => ['gold','silver','bronze'][i] || '';
  const rankIcon  = i => ['🥇','🥈','🥉'][i] || String(i + 1);

  wrap.innerHTML = `
    <div class="leaderboard">
      ${entries.map((e, i) => `
        <div class="lb-row${e.id === profile.id ? ' me' : ''}">
          <div class="lb-rank ${rankClass(i)}">${rankIcon(i)}</div>
          <div class="lb-info">
            <div class="lb-name-row">
              <span class="lb-name">${esc(e.name)}</span>
              ${e.id === profile.id ? '<span class="lb-you">Toi</span>' : ''}
            </div>
            <div class="lb-detail">${e.correct} bon${e.correct !== 1 ? 's' : ''} · ${e.perfect} parfait${e.perfect !== 1 ? 's' : ''}</div>
          </div>
          <div class="lb-pts-wrap">
            <div class="lb-pts">${e.points}</div>
            <div class="lb-pts-label">pts</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
