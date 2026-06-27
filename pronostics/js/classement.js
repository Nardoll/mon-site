import { requireProfile }                              from './auth.js';
import { injectTopBar, injectSidebar, avatarHtml }     from './nav.js';
import { getTournaments, getLeaderboard, getPlayerBreakdown } from './db.js';

requireProfile(async (profile) => {
  injectTopBar(profile);
  injectSidebar(profile, 'classement');
  await renderClassement(profile);
});

async function renderClassement(profile) {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page-title">Classement général</div>
    <div class="page-subtitle">Tous les tournois confondus.</div>
    <div class="pts-legend">
      <div class="pts-legend-title">Comment sont calculés les points</div>
      <div class="pts-legend-row"><span class="pts-badge">5 pts</span> Score exact (bon gagnant + bon score)</div>
      <div class="pts-legend-row"><span class="pts-badge">3 pts</span> Bon gagnant (mauvais score)</div>
      <div class="pts-legend-row"><span class="pts-badge">1 pt</span> Consolation BO5 (perdant ≥ 2 maps)</div>
      <div class="pts-legend-row"><span class="pts-badge">0 pt</span> Mauvais gagnant</div>
    </div>
    <div id="filter-wrap"></div>
    <div id="lb-wrap"><div class="empty-state">Chargement…</div></div>
  `;

  const tournaments = await getTournaments();
  const withData = tournaments.filter(t => t.status !== 'upcoming');

  renderFilters(withData, profile, tournaments);
  await showLeaderboard(null, profile, tournaments);
}

function renderFilters(tournaments, profile, allTournaments) {
  const wrap = document.getElementById('filter-wrap');
  if (tournaments.length <= 1) return;

  wrap.innerHTML = `
    <div class="tour-filters">
      <button class="btn-filter active" data-id="">Tous</button>
      ${tournaments.map(t =>
        `<button class="btn-filter" data-id="${t.id}">${esc(t.short_name || t.name)}</button>`
      ).join('')}
    </div>
  `;

  wrap.querySelectorAll('.btn-filter').forEach(btn => {
    btn.addEventListener('click', async () => {
      wrap.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await showLeaderboard(btn.dataset.id || null, profile, allTournaments);
    });
  });
}

async function showLeaderboard(tournamentId, profile, tournaments) {
  const wrap = document.getElementById('lb-wrap');
  wrap.innerHTML = '<div class="empty-state">Chargement…</div>';

  const entries = await getLeaderboard(tournamentId);

  const rankClass = i => ['gold','silver','bronze'][i] || '';
  const rankIcon  = i => ['🥇','🥈','🥉'][i] || String(i + 1);

  wrap.innerHTML = `
    <div class="leaderboard">
      ${entries.map((e, i) => `
        <div class="lb-row clickable${e.id === profile.id ? ' me' : ''}"
             data-player-id="${esc(e.id)}" data-player-name="${esc(e.name)}">
          <div class="lb-rank ${rankClass(i)}">${rankIcon(i)}</div>
          <div class="lb-info" style="display:flex;align-items:center;gap:.55rem;flex:1">
            ${avatarHtml({ name: e.name, avatar_url: e.avatar_url }, 'avatar-sm')}
            <div>
              <div class="lb-name-row">
                <span class="lb-name">${esc(e.name)}</span>
                ${e.id === profile.id ? '<span class="lb-you">Toi</span>' : ''}
              </div>
              <div class="lb-detail">${e.correct} bon${e.correct !== 1 ? 's' : ''} · ${e.perfect} parfait${e.perfect !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div class="lb-pts-wrap">
            <div class="lb-pts">${e.points}</div>
            <div class="lb-pts-label">pts</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  wrap.querySelectorAll('.lb-row.clickable').forEach(row => {
    row.addEventListener('click', () => {
      showPlayerBreakdown(row.dataset.playerId, row.dataset.playerName, tournaments);
    });
  });
}

async function showPlayerBreakdown(playerId, playerName, tournaments) {
  const overlay = document.createElement('div');
  overlay.className = 'player-bd-overlay';
  overlay.innerHTML = `
    <div class="player-bd-modal">
      <div class="player-bd-header">
        <div class="player-bd-title">${esc(playerName)}</div>
        <button class="player-bd-close" id="pbd-close">Fermer</button>
      </div>
      <div id="pbd-content"><div class="empty-state">Chargement…</div></div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('pbd-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const breakdown = await getPlayerBreakdown(playerId);
  const content = document.getElementById('pbd-content');

  const rows = tournaments
    .filter(t => t.status !== 'upcoming')
    .map(t => {
      const d = breakdown[t.id] || { points: 0, correct: 0, perfect: 0 };
      return `
        <div class="player-bd-row">
          <span class="player-bd-tour">${esc(t.short_name || t.name)}</span>
          <span class="player-bd-detail">${d.correct} bon${d.correct !== 1 ? 's' : ''} · ${d.perfect} parfait${d.perfect !== 1 ? 's' : ''}</span>
          <span class="player-bd-pts">${d.points} pts</span>
        </div>
      `;
    });

  const total = Object.values(breakdown).reduce((s, d) => s + (d.points || 0), 0);

  content.innerHTML = `
    ${rows.join('')}
    <div class="player-bd-total">
      <span>Total</span>
      <span style="color:var(--gold)">${total} pts</span>
    </div>
  `;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
