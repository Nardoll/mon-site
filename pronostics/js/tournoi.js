import { requireProfile }                           from './auth.js';
import { injectTopBar, injectBottomNav, showToast, avatarHtml, avatarColor } from './nav.js';
import {
  getTournament, getMatchesByTournament, getPicksByTournament,
  getAllPicksByMatch, getProfiles, savePick,
  syncTournament, getLongTermPicks, saveLongTermPick,
  getLeaderboard
} from './db.js';

const params        = new URLSearchParams(location.search);
const TOURNAMENT_ID = params.get('id');

let profile    = null;
let tournament = null;
let matches    = [];
let myPicks    = {};
let myLtPicks  = {};
let allProfiles = [];
let activeTab  = 'calendrier';

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

  [tournament, matches, myPicks, myLtPicks, allProfiles] = await Promise.all([
    getTournament(TOURNAMENT_ID),
    getMatchesByTournament(TOURNAMENT_ID),
    getPicksByTournament(profile.id, TOURNAMENT_ID),
    getLongTermPicks(profile.id, TOURNAMENT_ID),
    getProfiles()
  ]);

  if (!tournament) {
    main.innerHTML = '<div class="empty-state">Tournoi introuvable.</div>';
    return;
  }

  renderPage(main);
}

// ── Page principale ────────────────────────────────────────────────
function renderPage(main) {
  const scored = Object.values(myPicks).filter(p => p.scored);
  const myPts  = scored.reduce((s, p) => s + (p.points || 0), 0);
  const isLive = tournament.status === 'live';
  const cooldown = getSyncCooldown();

  main.innerHTML = `
    <a href="/pronostics/" class="back-link">← Tournois</a>

    <div class="tournoi-header">
      <div class="tournoi-title">${esc(tournament.name)}</div>
      <div class="tournoi-meta">
        ${tournament.league ? esc(tournament.league) + ' · ' : ''}${formatDateRange(tournament.start_date, tournament.end_date)}
      </div>
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

    ${isLive ? renderSyncBar(cooldown) : ''}

    <div class="tour-tabs">
      <button class="tour-tab active" data-tab="calendrier">🗓️ Calendrier</button>
      <button class="tour-tab" data-tab="equipes">👥 Équipes</button>
      <button class="tour-tab" data-tab="classement">📊 Classement</button>
      <button class="tour-tab" data-tab="longterme">🎯 Long terme</button>
    </div>

    <div id="tab-calendrier" class="tab-pane active"></div>
    <div id="tab-equipes"    class="tab-pane"></div>
    <div id="tab-classement" class="tab-pane"></div>
    <div id="tab-longterme"  class="tab-pane"></div>
  `;

  // Onglets
  document.querySelectorAll('.tour-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tour-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const key = btn.dataset.tab;
      activeTab = key;
      document.getElementById(`tab-${key}`)?.classList.add('active');
      if (!btn.dataset.loaded) {
        btn.dataset.loaded = '1';
        renderTab(key);
      }
    });
  });

  // Charger l'onglet par défaut
  renderTab('calendrier');
  setupSync(cooldown);
}

function renderTab(key) {
  if (key === 'calendrier') renderCalendrier();
  if (key === 'equipes')    renderEquipes();
  if (key === 'classement') renderClassement();
  if (key === 'longterme')  renderLongTerme();
}

// ── Onglet Calendrier ─────────────────────────────────────────────
function renderCalendrier() {
  const container = document.getElementById('tab-calendrier');

  if (matches.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        Aucun match disponible.${tournament.status !== 'finished' ? '<br>Lance une synchronisation.' : ''}
      </div>`;
    return;
  }

  // Grouper par jour (heure de Paris)
  const byDay = new Map();
  for (const m of matches) {
    const dayKey = matchDayKey(m.date_utc);
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey).push(m);
  }

  const todayKey = new Date().toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });

  container.innerHTML = Array.from(byDay.entries()).map(([day, list]) => {
    const isPast  = day < todayKey;
    const isToday = day === todayKey;
    const label   = formatDayLabel(day);
    return `
      <div class="day-group">
        <div class="day-header ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}">
          <span class="day-dot"></span>
          ${label}
          ${isToday ? '<span style="color:var(--accent);font-style:italic;font-size:.62rem;margin-left:.3rem">Aujourd\'hui</span>' : ''}
        </div>
        ${list.map(m => renderMatchCard(m)).join('')}
      </div>
    `;
  }).join('');

  setupMatchHandlers();
}

function renderMatchCard(match) {
  const pick       = myPicks[match.id];
  const isFinished = match.status === 'finished';
  const isLocked   = isMatchLocked(match);
  const bo         = match.best_of || 5;
  const maxWins    = Math.ceil(bo / 2);

  const t1win = isFinished && match.winner === match.team1;
  const t2win = isFinished && match.winner === match.team2;

  const scoreHtml = isFinished
    ? `<div class="match-score">${match.score1} — ${match.score2}</div>`
    : `<div class="match-score pending">VS</div>`;

  const statusTag = isFinished ? '✓ Terminé' : isLocked ? '🔒 Verrouillé' : '📝 Pronostic ouvert';

  // Section pick (ouverte au clic)
  let pickSection = '';
  if (!isLocked && !isFinished) {
    pickSection = renderPickOpen(match, pick, bo, maxWins);
  } else {
    pickSection = renderPickLocked(match, pick, isFinished);
  }

  return `
    <div class="match-card${pick ? ' has-pick' : ''}${isLocked ? ' is-locked' : ''}${isFinished ? ' is-finished' : ''}"
         id="mc-${match.id}" data-match-id="${match.id}" data-locked="${isLocked ? '1' : ''}">
      <div class="match-main">
        <div class="match-team">
          <div class="match-team-name${t1win ? ' winner' : t2win ? ' loser' : ''}">${esc(match.team1 || 'TBD')}</div>
        </div>
        <div class="match-vs">
          ${scoreHtml}
          <div class="match-bo">BO${bo}</div>
          <div class="match-time">${formatMatchTime(match.date_utc)}</div>
          <div class="match-tag">${esc(match.tab || match.round || '')}</div>
        </div>
        <div class="match-team">
          <div class="match-team-name${t2win ? ' winner' : t1win ? ' loser' : ''}">${esc(match.team2 || 'TBD')}</div>
        </div>
      </div>
      ${pickSection}
      ${isLocked ? renderAllPicksSection(match) : ''}
    </div>`;
}

function renderPickOpen(match, pick, bo, maxWins) {
  const opts = getScoreOpts(maxWins);
  const picked1 = pick?.pick_winner === match.team1;
  const picked2 = pick?.pick_winner === match.team2;
  const pickedWinner = pick?.pick_winner;

  const scoreOptsHtml = opts.map(([w, l]) => {
    const s1 = pickedWinner === match.team1 ? w : l;
    const s2 = pickedWinner === match.team1 ? l : w;
    const isSel = pick?.pick_score1 === s1 && pick?.pick_score2 === s2;
    return `<button class="score-btn${isSel ? ' selected' : ''}"
      data-match="${match.id}" data-s1="${s1}" data-s2="${s2}">${w}-${l}</button>`;
  }).join('');

  return `
    <div class="match-pick">
      <div class="pick-label">Ton pronostic
        ${bo === 1 ? '' : '<span style="float:right;color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0">Verrouillé 1h avant le match</span>'}
      </div>
      <div class="pick-teams">
        <button class="pick-team-btn${picked1 ? ' selected' : ''}"
          data-match="${match.id}" data-name="${escAttr(match.team1)}"
          data-bo="${bo}" data-t1="${escAttr(match.team1)}" data-t2="${escAttr(match.team2)}">
          ${esc(match.team1)}
        </button>
        <button class="pick-team-btn${picked2 ? ' selected' : ''}"
          data-match="${match.id}" data-name="${escAttr(match.team2)}"
          data-bo="${bo}" data-t1="${escAttr(match.team1)}" data-t2="${escAttr(match.team2)}">
          ${esc(match.team2)}
        </button>
      </div>
      ${bo > 1 ? `
      <div class="pick-scores" id="pscore-${match.id}" style="${!pickedWinner ? 'opacity:.35;pointer-events:none' : ''}">
        <span class="pick-score-label">Score :</span>
        <div class="score-opts" id="sopts-${match.id}">${scoreOptsHtml}</div>
      </div>` : ''}
    </div>`;
}

function renderPickLocked(match, pick, isFinished) {
  if (!pick) {
    return `
      <div class="match-pick">
        <div class="pick-summary"><span class="pick-locked-label">Pas de pronostic</span></div>
      </div>`;
  }
  const scoreStr = pick.pick_score1 != null ? ` ${pick.pick_score1}-${pick.pick_score2}` : '';
  const ptsHtml = isFinished && pick.scored
    ? (pick.points > 0
        ? `<span class="pick-pts">+${pick.points} pts</span>`
        : `<span class="pick-zero">0 pt</span>`)
    : `<span class="pick-locked-label">${isFinished ? 'Pas encore scoré' : 'Verrouillé'}</span>`;

  return `
    <div class="match-pick">
      <div class="pick-label">Ton pronostic</div>
      <div class="pick-summary">
        <span class="pick-winner-name">${esc(pick.pick_winner)}</span>
        ${scoreStr ? `<span style="color:var(--muted)">${scoreStr}</span>` : ''}
        ${ptsHtml}
      </div>
    </div>`;
}

function renderAllPicksSection(match) {
  // Chargé en lazy au clic (voir setupMatchHandlers)
  return `<div class="all-picks" id="ap-${match.id}">
    <div class="all-picks-title">Pronostics de tous les joueurs</div>
    <div id="ap-content-${match.id}"><div style="color:var(--muted);font-size:.75rem">Chargement…</div></div>
  </div>`;
}

async function loadAllPicks(match) {
  const content = document.getElementById(`ap-content-${match.id}`);
  if (!content || content.dataset.loaded) return;
  content.dataset.loaded = '1';

  const allPicks = await getAllPicksByMatch(match.id);

  // Créer un mapping profile_id → pick
  const pickByProfile = {};
  allPicks.forEach(p => { pickByProfile[p.profile_id] = p; });

  const rows = allProfiles.map(prof => {
    const pk = pickByProfile[prof.id];
    const isMe = prof.id === profile.id;
    const name = prof.pseudo || prof.name || '?';

    if (!pk || !pk.pick_winner) {
      return `<div class="pick-row${isMe ? ' me' : ''}">
        <span class="pick-row-name">${esc(name)}</span>
        <span class="pick-row-no-pick">—</span>
      </div>`;
    }

    const scoreStr = pk.pick_score1 != null ? `${pk.pick_score1}-${pk.pick_score2}` : '';
    const isCorrect = pk.pick_winner === match.winner;
    const ptsHtml = match.status === 'finished' && pk.scored
      ? (pk.points > 0
          ? `<span class="pick-row-pts">+${pk.points}pts</span>`
          : `<span class="pick-row-pts zero">0pt</span>`)
      : '';

    return `<div class="pick-row${isMe ? ' me' : ''}">
      <span class="pick-row-name">${esc(name)}</span>
      <span class="pick-row-pick" style="${match.status === 'finished' ? (isCorrect ? 'color:var(--win)' : 'color:var(--muted2)') : ''}">${esc(pk.pick_winner)}</span>
      ${scoreStr ? `<span class="pick-row-score">${scoreStr}</span>` : ''}
      ${ptsHtml}
    </div>`;
  });

  content.innerHTML = rows.join('') || '<div style="color:var(--muted);font-size:.75rem">Aucun pronostic encore.</div>';
}

// ── Onglet Équipes ─────────────────────────────────────────────────
function renderEquipes() {
  const container = document.getElementById('tab-equipes');
  const teams = tournament.teams || extractTeamsFromMatches();

  const lpKey = tournament.leaguepedia_key;
  const lpUrl = lpKey
    ? `https://lol.fandom.com/wiki/${encodeURIComponent(lpKey.replace(/\s/g, '_'))}`
    : null;

  container.innerHTML = `
    ${lpUrl ? `<a href="${lpUrl}" target="_blank" rel="noopener" class="lp-link">
      📖 Voir la page Leaguepedia →
    </a>` : ''}
    ${teams.length === 0
      ? '<div class="empty-state">Les équipes apparaîtront après la première synchronisation.</div>'
      : `<div class="teams-grid">${teams.map(t => renderTeamCard(t)).join('')}</div>`
    }
  `;
}

function extractTeamsFromMatches() {
  const set = new Set();
  matches.forEach(m => {
    if (m.team1) set.add(m.team1);
    if (m.team2) set.add(m.team2);
  });
  return Array.from(set).sort();
}

function renderTeamCard(teamName) {
  const color  = avatarColor(teamName);
  const initial = teamName[0]?.toUpperCase() || '?';
  return `
    <div class="team-card">
      <div class="team-initial" style="background:${color}">${initial}</div>
      <div>
        <div class="team-name">${esc(teamName)}</div>
      </div>
    </div>`;
}

// ── Onglet Classement ──────────────────────────────────────────────
async function renderClassement() {
  const container = document.getElementById('tab-classement');
  container.innerHTML = '<div class="empty-state">Chargement…</div>';

  const entries = await getLeaderboard(TOURNAMENT_ID);
  const rankClass = i => ['gold','silver','bronze'][i] || '';
  const rankIcon  = i => ['🥇','🥈','🥉'][i] || String(i + 1);

  if (entries.every(e => e.points === 0)) {
    container.innerHTML = '<div class="empty-state">Aucun point encore. Lance-toi !</div>';
    return;
  }

  container.innerHTML = `
    <div class="leaderboard">
      ${entries.map((e, i) => `
        <div class="lb-row${e.id === profile.id ? ' me' : ''}">
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
}

// ── Onglet Long terme ──────────────────────────────────────────────
function renderLongTerme() {
  const container = document.getElementById('tab-longterme');
  const teams = tournament.teams || extractTeamsFromMatches();
  const isLocked = tournament.long_term_locked || false;

  const PICKS = [
    { type: 'winner',   label: '🏆 Vainqueur du tournoi',     pts: '10 pts' },
    { type: 'finalist', label: '🥈 Finaliste',                 pts: '5 pts'  },
    { type: 'semifinal1', label: '4⃣ Demi-finaliste 1',       pts: '3 pts'  },
    { type: 'semifinal2', label: '4⃣ Demi-finaliste 2',       pts: '3 pts'  },
  ];

  container.innerHTML = `
    <div class="long-term-section">
      <div class="lt-title">🎯 Pronostics avant le tournoi</div>
      ${PICKS.map(pk => {
        const cur = myLtPicks[pk.type]?.value || '';
        return `
          <div class="lt-row">
            <span class="lt-pick-label">${pk.label}</span>
            ${isLocked
              ? `<span class="lt-locked-val">${esc(cur) || '—'}</span>`
              : teams.length > 0
                ? `<select class="lt-select" data-lt-type="${pk.type}">
                     <option value="">— Choisir —</option>
                     ${teams.map(t => `<option value="${esc(t)}"${t === cur ? ' selected' : ''}>${esc(t)}</option>`).join('')}
                   </select>`
                : `<input class="lt-select" type="text" data-lt-type="${pk.type}"
                     placeholder="Nom de l'équipe" value="${esc(cur)}"
                     style="max-width:160px" />`
            }
          </div>`;
      }).join('')}

      <div class="lt-pts-info">
        💡 Ces pronostics se verrouillent au lancement du tournoi.<br>
        Vainqueur exact : <b>10 pts</b> · Finaliste : <b>5 pts</b> · Demi-finaliste : <b>3 pts</b>
      </div>
    </div>

    ${renderAllLongTermPicks()}
  `;

  // Handlers
  container.querySelectorAll('[data-lt-type]').forEach(el => {
    const save = async () => {
      const value = el.value.trim();
      if (!value) return;
      await saveLongTermPick(profile.id, TOURNAMENT_ID, el.dataset.ltType, value);
      myLtPicks[el.dataset.ltType] = { ...myLtPicks[el.dataset.ltType], value };
      showToast(`✓ ${value} enregistré`);
    };
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', save);
    } else {
      el.addEventListener('blur', save);
      el.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    }
  });
}

function renderAllLongTermPicks() {
  // Afficher un résumé des pronostics long terme de tous
  // (chargé en lazy — pour l'instant juste un placeholder)
  return `
    <div style="margin-top:1.1rem">
      <div class="section-label">Pronostics des participants</div>
      <div id="all-lt-picks"><div class="empty-state" style="padding:.5rem 0">Chargement…</div></div>
    </div>
  `;
  // Note : chargé dans setupLongTermAllPicks()
}

// ── Sync bar ───────────────────────────────────────────────────────
function renderSyncBar(cooldown) {
  const onCooldown = cooldown > 0;
  const lastSync = tournament.last_sync
    ? `Sync : ${formatRelative(tournament.last_sync)}`
    : 'Jamais synchronisé';

  return `
    <div class="sync-bar">
      <div>
        <div class="sync-info">Données Leaguepedia</div>
        <div class="sync-time" id="sync-time-lbl">
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
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const result = await syncTournament(TOURNAMENT_ID);
      if (!result.ok) { startCountdown(result.remaining); return; }
      showToast(`✓ ${result.count} matchs synchronisés`);
      await loadPage();
    } catch (e) {
      showToast('Erreur : ' + e.message);
      btn.disabled = false;
      btn.textContent = '🔄 Synchroniser';
    }
  });
}

function startCountdown(secs) {
  const btn  = document.getElementById('btn-sync');
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
      const lbl = document.getElementById('sync-time-lbl');
      if (lbl) lbl.textContent = 'Prêt';
    } else {
      setTimeout(tick, 1000);
    }
  };
  setTimeout(tick, 1000);
}

// ── Handlers picks ─────────────────────────────────────────────────
function setupMatchHandlers() {
  // Clic sur .match-main → expand/collapse pick & all-picks
  document.querySelectorAll('.match-main').forEach(el => {
    el.addEventListener('click', () => {
      const card = el.closest('.match-card');
      const matchId = card.dataset.matchId;
      const isLocked = card.dataset.locked === '1';

      card.classList.toggle('expanded');

      // Lazy-load all picks
      if (card.classList.contains('expanded') && isLocked) {
        const match = matches.find(m => m.id === matchId);
        if (match) loadAllPicks(match);
      }

      // Show/hide pick & all-picks sections
      const pickEl = card.querySelector('.match-pick');
      const apEl   = card.querySelector('.all-picks');
      if (pickEl) pickEl.style.display = card.classList.contains('expanded') ? 'block' : 'none';
      if (apEl)   apEl.style.display   = card.classList.contains('expanded') ? 'block' : 'none';
    });
  });

  // Boutons équipe
  document.querySelectorAll('.pick-team-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const matchId  = btn.dataset.match;
      const teamName = btn.dataset.name;
      const bo       = parseInt(btn.dataset.bo) || 5;
      const maxWins  = Math.ceil(bo / 2);
      const t1       = btn.dataset.t1;
      const t2       = btn.dataset.t2;

      document.querySelectorAll(`.pick-team-btn[data-match="${matchId}"]`)
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      const scoresEl = document.getElementById(`pscore-${matchId}`);
      if (scoresEl) { scoresEl.style.opacity = '1'; scoresEl.style.pointerEvents = ''; }

      // Régénérer les score-btns
      const optsEl = document.getElementById(`sopts-${matchId}`);
      if (optsEl) {
        const opts = getScoreOpts(maxWins);
        optsEl.innerHTML = opts.map(([w, l]) => {
          const s1 = teamName === t1 ? w : l;
          const s2 = teamName === t1 ? l : w;
          return `<button class="score-btn" data-match="${matchId}" data-s1="${s1}" data-s2="${s2}">${w}-${l}</button>`;
        }).join('');
        optsEl.querySelectorAll('.score-btn').forEach(sb => attachScoreBtn(sb));
      }

      await savePick(profile.id, matchId, TOURNAMENT_ID, teamName, null, null);
      myPicks[matchId] = { ...myPicks[matchId], pick_winner: teamName, pick_score1: null, pick_score2: null };
      document.getElementById(`mc-${matchId}`)?.classList.add('has-pick');
      showToast(`✓ ${teamName}`);
    });
  });

  // Boutons score (initiaux)
  document.querySelectorAll('.score-btn').forEach(btn => attachScoreBtn(btn));
}

function attachScoreBtn(btn) {
  btn.addEventListener('click', async e => {
    e.stopPropagation();
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
    showToast(`✓ ${s1}-${s2}`);
  });
}

// ── Helpers ────────────────────────────────────────────────────────
function isMatchLocked(match) {
  if (match.status === 'finished' || match.status === 'live') return true;
  if (!match.date_utc) return false;
  const d = new Date(match.date_utc.endsWith('Z') ? match.date_utc : match.date_utc + ' UTC');
  return (d.getTime() - Date.now()) < 60 * 60 * 1000; // 1h avant
}

function getScoreOpts(maxWins) {
  const opts = [];
  for (let l = 0; l < maxWins; l++) opts.push([maxWins, l]);
  return opts;
}

function getSyncCooldown() {
  if (!tournament.sync_cooldown_until) return 0;
  const until = tournament.sync_cooldown_until.toMillis
    ? tournament.sync_cooldown_until.toMillis()
    : new Date(tournament.sync_cooldown_until).getTime();
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function matchDayKey(dateStr) {
  if (!dateStr) return '9999-12-31';
  try {
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + ' UTC');
    return d.toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }); // YYYY-MM-DD
  } catch { return dateStr.slice(0, 10); }
}

function formatDayLabel(dayKey) {
  try {
    const d = new Date(dayKey + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch { return dayKey; }
}

function formatMatchTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + ' UTC');
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  } catch { return ''; }
}

function formatDateRange(start, end) {
  if (!start) return '';
  const fmt = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return end ? `${fmt(start)} — ${fmt(end)}` : `Depuis le ${fmt(start)}`;
}

function formatRelative(ts) {
  const ms = ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
  const diff = Date.now() - ms;
  if (diff < 60000) return 'il y a quelques secondes';
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`;
  return `il y a ${Math.floor(diff / 3600000)}h`;
}

function fmtCountdown(secs) {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(s) {
  return String(s || '').replace(/"/g,'&quot;');
}
