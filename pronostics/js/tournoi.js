import { requireProfile }                      from './auth.js';
import { injectTopBar, injectBottomNav, showToast } from './nav.js';
import {
  getTournament, getMatchesByTournament, getPicksByTournament,
  savePick, syncTournament, getLongTermPicks, saveLongTermPick
} from './db.js';

const params       = new URLSearchParams(location.search);
const TOURNAMENT_ID = params.get('id');

let profile    = null;
let tournament = null;
let matches    = [];
let myPicks    = {};
let myLtPicks  = {};

requireProfile(async (p) => {
  profile = p;
  injectTopBar(p);
  injectBottomNav(null);
  if (!TOURNAMENT_ID) {
    document.getElementById('main').innerHTML = '<div class="empty-state">Tournoi introuvable.</div>';
    return;
  }
  await loadPage();
});

async function loadPage() {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="empty-state">Chargement…</div>';

  [tournament, matches, myPicks, myLtPicks] = await Promise.all([
    getTournament(TOURNAMENT_ID),
    getMatchesByTournament(TOURNAMENT_ID),
    getPicksByTournament(profile.id, TOURNAMENT_ID),
    getLongTermPicks(profile.id, TOURNAMENT_ID)
  ]);

  if (!tournament) {
    main.innerHTML = '<div class="empty-state">Tournoi introuvable.</div>';
    return;
  }

  renderPage(main);
}

function renderPage(main) {
  const scored     = Object.values(myPicks).filter(p => p.scored);
  const myPts      = scored.reduce((s, p) => s + (p.points || 0), 0);
  const isFinished = tournament.status === 'finished';
  const cooldown   = getSyncCooldown();

  main.innerHTML = `
    <a href="/pronostics/" class="back-link">← Tournois</a>
    <div class="tournoi-header">
      <div class="tournoi-title">${esc(tournament.name)}</div>
      <div class="tournoi-meta">${tournament.league || ''}${tournament.league && tournament.start_date ? ' · ' : ''}${formatDateRange(tournament.start_date, tournament.end_date)}</div>
    </div>

    <div class="tournoi-stats">
      <div class="stat-card">
        <div class="stat-value">${myPts}</div>
        <div class="stat-label">Mes points</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${scored.length}</div>
        <div class="stat-label">Scorés</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${matches.length}</div>
        <div class="stat-label">Matchs</div>
      </div>
    </div>

    ${renderLongTerm()}
    ${!isFinished ? renderSyncBar(cooldown) : ''}
    <div id="matches-container"></div>
  `;

  renderMatches();
  setupLongTermHandlers();
  setupSync(cooldown);
}

/* ── Long-term ────────────────────────────────────────────────── */
function renderLongTerm() {
  const teams = tournament.teams || [];
  const isLocked = tournament.status === 'finished' || tournament.long_term_locked;

  if (teams.length === 0) return '';

  const picks = [
    { type: 'winner',    label: 'Vainqueur du tournoi' },
    { type: 'finalist',  label: 'Finaliste' },
  ];

  return `
    <div class="long-term-section">
      <div class="lt-title">🎯 Pronostics long terme
        <span style="font-size:.68rem;font-weight:400;color:var(--muted2)">— avant le début du tournoi</span>
      </div>
      ${picks.map(pk => {
        const current = myLtPicks[pk.type]?.value || '';
        if (isLocked) {
          return `
            <div class="lt-row">
              <span class="lt-pick-label">${pk.label}</span>
              <span class="lt-pick-label" style="font-weight:600;color:var(--text)">${esc(current) || '—'}</span>
            </div>`;
        }
        return `
          <div class="lt-row">
            <span class="lt-pick-label">${pk.label}</span>
            <select class="lt-select" data-lt-type="${pk.type}">
              <option value="">— Choisir —</option>
              ${teams.map(t => `<option value="${esc(t)}"${t === current ? ' selected' : ''}>${esc(t)}</option>`).join('')}
            </select>
          </div>`;
      }).join('')}
    </div>
  `;
}

function setupLongTermHandlers() {
  document.querySelectorAll('[data-lt-type]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const type  = sel.dataset.ltType;
      const value = sel.value;
      if (!value) return;
      await saveLongTermPick(profile.id, TOURNAMENT_ID, type, value);
      myLtPicks[type] = { ...myLtPicks[type], value };
      showToast(`✓ ${value} enregistré`);
    });
  });
}

/* ── Sync bar ─────────────────────────────────────────────────── */
function renderSyncBar(cooldown) {
  const onCooldown = cooldown > 0;
  const lastSync = tournament.last_sync
    ? `Sync : ${formatRelative(tournament.last_sync)}`
    : 'Jamais synchronisé';

  return `
    <div class="sync-bar">
      <div>
        <div class="sync-info">Données Leaguepedia</div>
        <div class="sync-time" id="sync-time-label">
          ${onCooldown
            ? `Prochaine sync dans <span id="sync-cd">${fmtCountdown(cooldown)}</span>`
            : lastSync}
        </div>
      </div>
      <button class="btn-sync${onCooldown ? ' cooldown' : ''}" id="btn-sync" ${onCooldown ? 'disabled' : ''}>
        ${onCooldown ? '⏳ Patienter' : '🔄 Synchroniser'}
      </button>
    </div>
  `;
}

function setupSync(cooldown) {
  const btn = document.getElementById('btn-sync');
  if (!btn) return;

  if (cooldown > 0) startCountdown(cooldown);

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Sync…';

    try {
      const result = await syncTournament(TOURNAMENT_ID);
      if (!result.ok) {
        startCountdown(result.remaining);
        return;
      }
      showToast(`✓ ${result.count} matchs récupérés`);
      await loadPage();
    } catch (e) {
      showToast('Erreur : ' + e.message);
      btn.disabled = false;
      btn.textContent = '🔄 Synchroniser';
    }
  });
}

function startCountdown(secs) {
  const btn = document.getElementById('btn-sync');
  const cdEl = document.getElementById('sync-cd');
  if (!btn) return;

  btn.classList.add('cooldown');
  btn.disabled = true;
  btn.textContent = '⏳ Patienter';

  let rem = secs;
  const tick = () => {
    rem--;
    if (cdEl) cdEl.textContent = fmtCountdown(rem);
    if (rem <= 0) {
      btn.classList.remove('cooldown');
      btn.disabled = false;
      btn.textContent = '🔄 Synchroniser';
      const lbl = document.getElementById('sync-time-label');
      if (lbl) lbl.textContent = 'Prêt';
    } else {
      setTimeout(tick, 1000);
    }
  };
  setTimeout(tick, 1000);
}

/* ── Matches ──────────────────────────────────────────────────── */
function renderMatches() {
  const container = document.getElementById('matches-container');
  if (!container) return;

  if (matches.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        Aucun match disponible.<br>
        ${tournament.status !== 'finished' ? 'Lance une synchronisation Leaguepedia.' : ''}
      </div>`;
    return;
  }

  // Grouper par tab/phase
  const groups = new Map();
  for (const m of matches) {
    const key = m.tab || m.round || 'Matchs';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }

  container.innerHTML = Array.from(groups.entries()).map(([phase, list]) => `
    <div class="phase-label">${esc(phase)}</div>
    ${list.map(m => renderMatchCard(m)).join('')}
  `).join('');

  setupPickHandlers();
}

function renderMatchCard(match) {
  const pick       = myPicks[match.id];
  const isFinished = match.status === 'finished';
  const isLocked   = isFinished || isMatchStarted(match);
  const bo         = match.best_of || 5;
  const maxWins    = Math.ceil(bo / 2);

  const t1win = isFinished && match.winner === match.team1;
  const t2win = isFinished && match.winner === match.team2;

  const scoreHtml = isFinished
    ? `<div class="match-score">${match.score1} — ${match.score2}</div>`
    : `<div class="match-score pending">VS</div>`;

  let pickHtml = '';
  if (isLocked) {
    if (pick) {
      const scoreStr = pick.pick_score1 != null ? ` ${pick.pick_score1}-${pick.pick_score2}` : '';
      const ptsStr = isFinished && pick.scored
        ? (pick.points > 0
            ? `<span class="pick-pts">+${pick.points} pts</span>`
            : `<span class="pick-zero">0 pt</span>`)
        : `<span class="pick-locked-label">Verrouillé</span>`;
      pickHtml = `
        <div class="match-pick">
          <div class="pick-label">Ton pronostic</div>
          <div class="pick-summary">
            <span class="pick-winner-name">${esc(pick.pick_winner)}</span>
            ${scoreStr ? `<span style="color:var(--muted)">${scoreStr}</span>` : ''}
            ${ptsStr}
          </div>
        </div>`;
    }
  } else {
    const opts = getScoreOpts(maxWins);
    const picked1 = pick?.pick_winner === match.team1;
    const picked2 = pick?.pick_winner === match.team2;
    const pickedWinner = pick?.pick_winner;

    // Générer les boutons de score en fonction du winner sélectionné
    const scoreOptsHtml = opts.map(([w, l]) => {
      let s1, s2;
      if (pickedWinner === match.team1) { s1 = w; s2 = l; }
      else                              { s1 = l; s2 = w; }
      const isSel = pick?.pick_score1 === s1 && pick?.pick_score2 === s2;
      return `<button class="score-btn${isSel ? ' selected' : ''}" data-match="${match.id}" data-s1="${s1}" data-s2="${s2}">${w}-${l}</button>`;
    }).join('');

    pickHtml = `
      <div class="match-pick">
        <div class="pick-label">Ton pronostic</div>
        <div class="pick-teams">
          <button class="pick-team-btn${picked1 ? ' selected' : ''}"
            data-match="${match.id}" data-team="1" data-name="${escAttr(match.team1)}"
            data-bo="${bo}" data-t1="${escAttr(match.team1)}" data-t2="${escAttr(match.team2)}">
            ${esc(match.team1)}
          </button>
          <button class="pick-team-btn${picked2 ? ' selected' : ''}"
            data-match="${match.id}" data-team="2" data-name="${escAttr(match.team2)}"
            data-bo="${bo}" data-t1="${escAttr(match.team1)}" data-t2="${escAttr(match.team2)}">
            ${esc(match.team2)}
          </button>
        </div>
        <div class="pick-scores" id="pscore-${match.id}" style="${!pickedWinner ? 'opacity:.35;pointer-events:none' : ''}">
          <span class="pick-score-label">Score :</span>
          <div class="score-opts" id="sopts-${match.id}">${scoreOptsHtml}</div>
        </div>
      </div>`;
  }

  return `
    <div class="match-card${pick ? ' has-pick' : ''}${isFinished ? ' finished' : ''}" id="mc-${match.id}">
      <div class="match-main">
        <div class="match-team">
          <div class="match-team-name${t1win ? ' winner' : t2win ? ' loser' : ''}">${esc(match.team1)}</div>
        </div>
        <div class="match-vs">
          ${scoreHtml}
          <div class="match-bo">BO${bo}</div>
          <div class="match-time">${formatMatchTime(match.date_utc)}</div>
        </div>
        <div class="match-team">
          <div class="match-team-name${t2win ? ' winner' : t1win ? ' loser' : ''}">${esc(match.team2)}</div>
        </div>
      </div>
      ${pickHtml}
    </div>`;
}

function getScoreOpts(maxWins) {
  // Retourne [winner_score, loser_score] — le winner score = maxWins toujours
  const opts = [];
  for (let l = 0; l < maxWins; l++) opts.push([maxWins, l]);
  return opts;
}

function isMatchStarted(match) {
  if (!match.date_utc) return false;
  const d = new Date(match.date_utc.endsWith('Z') ? match.date_utc : match.date_utc + ' UTC');
  return d <= new Date();
}

function setupPickHandlers() {
  // Boutons équipe
  document.querySelectorAll('.pick-team-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const matchId   = btn.dataset.match;
      const teamName  = btn.dataset.name;
      const bo        = parseInt(btn.dataset.bo) || 5;
      const maxWins   = Math.ceil(bo / 2);
      const t1        = btn.dataset.t1;
      const t2        = btn.dataset.t2;

      // Update buttons UI
      document.querySelectorAll(`.pick-team-btn[data-match="${matchId}"]`)
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      // Enable scores
      const scoresEl = document.getElementById(`pscore-${matchId}`);
      if (scoresEl) { scoresEl.style.opacity = '1'; scoresEl.style.pointerEvents = ''; }

      // Re-generate score buttons for the chosen winner direction
      const optsEl = document.getElementById(`sopts-${matchId}`);
      if (optsEl) {
        const opts = getScoreOpts(maxWins);
        optsEl.innerHTML = opts.map(([w, l]) => {
          const s1 = (teamName === t1) ? w : l;
          const s2 = (teamName === t1) ? l : w;
          return `<button class="score-btn" data-match="${matchId}" data-s1="${s1}" data-s2="${s2}">${w}-${l}</button>`;
        }).join('');
        // Re-attach score handlers for these new buttons
        optsEl.querySelectorAll('.score-btn').forEach(sb => attachScoreBtn(sb));
      }

      // Save with no score yet
      await savePick(profile.id, matchId, TOURNAMENT_ID, teamName, null, null);
      myPicks[matchId] = { ...myPicks[matchId], pick_winner: teamName, pick_score1: null, pick_score2: null };
      showToast(`✓ ${teamName}`);
    });
  });

  // Boutons score (initiaux)
  document.querySelectorAll('.score-btn').forEach(btn => attachScoreBtn(btn));
}

function attachScoreBtn(btn) {
  btn.addEventListener('click', async () => {
    const matchId = btn.dataset.match;
    const s1 = parseInt(btn.dataset.s1);
    const s2 = parseInt(btn.dataset.s2);

    document.querySelectorAll(`.score-btn[data-match="${matchId}"]`)
      .forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    const pick = myPicks[matchId];
    if (!pick?.pick_winner) return;

    await savePick(profile.id, matchId, TOURNAMENT_ID, pick.pick_winner, s1, s2);
    myPicks[matchId] = { ...myPicks[matchId], pick_score1: s1, pick_score2: s2 };
    showToast(`✓ Score ${s1}-${s2}`);
  });
}

/* ── Helpers ──────────────────────────────────────────────────── */
function getSyncCooldown() {
  if (!tournament.sync_cooldown_until) return 0;
  const until = tournament.sync_cooldown_until.toMillis
    ? tournament.sync_cooldown_until.toMillis()
    : new Date(tournament.sync_cooldown_until).getTime();
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function fmtCountdown(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function formatMatchTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + ' UTC');
    return d.toLocaleString('fr-FR', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Paris'
    });
  } catch { return dateStr; }
}

function formatRelative(ts) {
  const ms = ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
  const diff = Date.now() - ms;
  if (diff < 60000) return 'il y a quelques secondes';
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
  return `il y a ${Math.floor(diff / 3600000)}h`;
}

function formatDateRange(start, end) {
  if (!start) return '';
  const fmt = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return end ? `${fmt(start)} — ${fmt(end)}` : `Depuis le ${fmt(start)}`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(s) {
  return String(s || '').replace(/"/g,'&quot;');
}
