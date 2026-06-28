import { requireProfile }                           from './auth.js';
import { injectTopBar, injectSidebar, showToast, avatarHtml, avatarColor } from './nav.js';
import {
  getTournament, getMatchesByTournament, getPicksByTournament,
  getAllPicksByMatch, getProfiles, savePick,
  syncTournament, getLongTermPicks, saveLongTermPick,
  getLeaderboard, updateMatch, updateTournament, scorePicksForMatch
} from './db.js';

function teamLogo(name, size = 22) {
  const logos = tournament?.team_logos || {};
  const src = logos[name];
  if (!src) return '';
  return `<img src="${src}" alt="${esc(name)}" class="team-logo" style="width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'">`;
}

// ── Structure bracket MSI 2026 ─────────────────────────────────────
const PLAY_IN_ROUNDS = [
  { label: 'Round 1',       upper: ['msi2026_playin_r1_T1_TLA','msi2026_playin_r1_KC_DCG'], lower: [] },
  { label: 'Round 2',       upper: ['msi2026_playin_r2_upper'],                              lower: ['msi2026_playin_r2_lower'] },
  { label: 'Round 3',       upper: [],                                                       lower: ['msi2026_playin_r3'] },
  { label: 'Qualification', upper: ['msi2026_playin_gf'],                                    lower: [] },
];

const BRACKET_ROUNDS = [
  { label: 'Round 1', upper: ['msi2026_bracket_ur1_BLG','msi2026_bracket_ur1_HLE','msi2026_bracket_ur1_LYON','msi2026_bracket_ur1_G2'], lower: [] },
  { label: 'Round 2', upper: ['msi2026_bracket_ur2_a','msi2026_bracket_ur2_b'],               lower: ['msi2026_bracket_lr1_a','msi2026_bracket_lr1_b'] },
  { label: 'Round 3', upper: ['msi2026_bracket_ubf'],                                         lower: ['msi2026_bracket_lr2_a','msi2026_bracket_lr2_b'] },
  { label: 'Round 4', upper: [],                                                              lower: ['msi2026_bracket_lr3'] },
  { label: 'LB Final',upper: [],                                                              lower: ['msi2026_bracket_lbf'] },
  { label: 'Grand Final', upper: ['msi2026_bracket_gf'],                                     lower: [] },
];

const params        = new URLSearchParams(location.search);
const TOURNAMENT_ID = params.get('id');
const IS_ADMIN      = params.has('admin');

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
  injectSidebar(p, null);
  if (!TOURNAMENT_ID) {
    document.getElementById('main').innerHTML = '<div class="empty-state">Tournoi introuvable.</div>';
    return;
  }
  await loadPage();
});

async function loadPage() {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="empty-state">Chargement…</div>';

  try {
    [tournament, matches, myPicks, myLtPicks, allProfiles] = await Promise.all([
      getTournament(TOURNAMENT_ID),
      getMatchesByTournament(TOURNAMENT_ID),
      getPicksByTournament(profile.id, TOURNAMENT_ID),
      getLongTermPicks(profile.id, TOURNAMENT_ID),
      getProfiles()
    ]);
  } catch (e) {
    main.innerHTML = `<div class="empty-state" style="color:#ef4444">Erreur : ${e.message}</div>`;
    console.error(e);
    return;
  }

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

    <div class="tour-tabs">
      <button class="tour-tab active" data-tab="calendrier">🗓️ Calendrier</button>
      <button class="tour-tab" data-tab="bracket">🏆 Bracket</button>
      <button class="tour-tab" data-tab="equipes">👥 Équipes</button>
      <button class="tour-tab" data-tab="classement">📊 Classement</button>
      ${IS_ADMIN ? '<button class="tour-tab" data-tab="admin">⚙️ Admin</button>' : ''}
    </div>

    <div id="tab-calendrier" class="tab-pane active"></div>
    <div id="tab-bracket"    class="tab-pane"></div>
    <div id="tab-equipes"    class="tab-pane"></div>
    <div id="tab-classement" class="tab-pane"></div>
    ${IS_ADMIN ? '<div id="tab-admin" class="tab-pane"></div>' : ''}
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
  if (isLive) setupSyncTopBar();
}

function setupSyncTopBar() {
  const cooldown = getSyncCooldown();
  const topBar = document.querySelector('.top-bar');
  if (!topBar || document.getElementById('btn-sync-top')) return;

  const wrap = document.createElement('div');
  wrap.className = 'sync-wrap';
  wrap.id = 'sync-wrap';

  const infoText = cooldown > 0
    ? `dans ${fmtCountdown(cooldown)}`
    : tournament.last_sync ? formatRelative(tournament.last_sync) : '';

  wrap.innerHTML = `
    ${infoText ? `<span class="sync-info" id="sync-info">${infoText}</span>` : '<span class="sync-info" id="sync-info"></span>'}
    <button class="btn-sync-icon${cooldown > 0 ? ' on-cooldown' : ''}" id="btn-sync-top"
      ${cooldown > 0 ? 'disabled' : ''}
      title="${cooldown > 0 ? 'Sync disponible dans ' + fmtCountdown(cooldown) : 'Synchroniser les données'}">
      <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
    </button>
  `;
  topBar.insertBefore(wrap, topBar.querySelector('.top-user'));

  const btn = document.getElementById('btn-sync-top');
  if (cooldown > 0) startCountdownTopBar(cooldown);

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('spinning');
    const info = document.getElementById('sync-info');
    if (info) info.textContent = '…';
    try {
      const result = await syncTournament(TOURNAMENT_ID);
      btn.classList.remove('spinning');
      if (!result.ok) {
        btn.classList.add('on-cooldown');
        startCountdownTopBar(result.remaining);
        return;
      }
      showToast('✓ ' + result.count + ' matchs synchronisés');
      await loadPage();
    } catch (e) {
      btn.classList.remove('spinning');
      btn.disabled = false;
      if (info) info.textContent = tournament.last_sync ? formatRelative(tournament.last_sync) : '';
      showToast('Erreur : ' + e.message);
    }
  });
}

function startCountdownTopBar(secs) {
  const btn = document.getElementById('btn-sync-top');
  if (!btn) return;
  btn.disabled = true;
  btn.classList.add('on-cooldown');
  let rem = secs;
  const tick = () => {
    rem--;
    const info = document.getElementById('sync-info');
    if (rem <= 0) {
      btn.disabled = false;
      btn.classList.remove('on-cooldown');
      btn.title = 'Synchroniser les données';
      if (info) info.textContent = tournament.last_sync ? formatRelative(tournament.last_sync) : '';
    } else {
      btn.title = 'Sync disponible dans ' + fmtCountdown(rem);
      if (info) info.textContent = 'dans ' + fmtCountdown(rem);
      setTimeout(tick, 1000);
    }
  };
  setTimeout(tick, 1000);
}

function renderTab(key) {
  if (key === 'calendrier') renderCalendrier();
  if (key === 'bracket')    renderBracket();
  if (key === 'equipes')    renderEquipes();
  if (key === 'classement') renderClassement();
  if (key === 'admin')      renderAdmin();
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

  let pickScoreHtml = '';
  if (isFinished && pick?.pick_winner) {
    const isCorrect = pick.pick_winner === match.winner;
    const ps1 = pick.pick_score1 != null ? parseInt(pick.pick_score1) : null;
    const ps2 = pick.pick_score2 != null ? parseInt(pick.pick_score2) : null;
    const isPerfect = isCorrect && ps1 === parseInt(match.score1) && ps2 === parseInt(match.score2);
    const cls = isPerfect ? 'pick-perfect' : isCorrect ? 'pick-correct' : 'pick-wrong';
    const label = ps1 != null ? `${ps1} — ${ps2}` : esc(pick.pick_winner);
    pickScoreHtml = `<div class="match-pick-score ${cls}">${label}</div>`;
  }

  const scoreHtml = isFinished
    ? `<div class="match-score">${match.score1} — ${match.score2}</div>${pickScoreHtml}`
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
          ${teamLogo(match.team1, 24)}
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
          ${teamLogo(match.team2, 24)}
        </div>
      </div>
      ${pickSection}
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

// ── Picks Drawer ──────────────────────────────────────────────────
async function openPicksDrawer(match) {
  let drawer = document.getElementById('picks-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'picks-drawer';
    drawer.className = 'picks-drawer';
    document.body.appendChild(drawer);
  }

  const scoreDisplay = (match.score1 != null && match.score2 != null)
    ? `${match.score1} — ${match.score2}` : '';

  // Équipes uniques des matchs existants (hors TBD)
  const allTeams = [...new Set(
    matches.flatMap(m => [m.team1, m.team2]).filter(t => t && t !== 'TBD')
  )].sort();
  const teamSelectOpts = (current) => [
    `<option value="">— Équipe —</option>`,
    ...allTeams.map(t => `<option value="${esc(t)}"${t === current ? ' selected' : ''}>${esc(t)}</option>`)
  ].join('');

  // Matchs du calendrier pour le sélecteur d'horaire
  const otherMatches = matches
    .filter(m => m.id !== match.id && m.date_utc)
    .sort((a, b) => a.date_utc.localeCompare(b.date_utc));

  function calMatchLabel(m) {
    const t = formatMatchTime(m.date_utc);
    const d = new Date(m.date_utc.endsWith('Z') ? m.date_utc : m.date_utc + ' UTC')
      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
    return `${esc(m.team1)} vs ${esc(m.team2)} — ${d} ${t}`;
  }

  const slotOpts = [
    `<option value="">— Copier l'heure d'un match —</option>`,
    ...otherMatches.map(m => `<option value="${esc(m.id)}">${calMatchLabel(m)}</option>`)
  ].join('');

  // Heure actuelle du match (en heure locale pour datetime-local)
  const existingDt = match.date_utc
    ? (() => {
        const d = new Date(match.date_utc.endsWith('Z') ? match.date_utc : match.date_utc + ' UTC');
        const pad = n => String(n).padStart(2, '0');
        // Afficher en UTC pour la saisie (on stocke en UTC)
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
      })()
    : '';

  const adminSection = IS_ADMIN ? `
    <div class="pd-section-label" style="margin-top:.5rem;border-top:1px solid var(--border);padding-top:.5rem">⚙️ Admin</div>
    <form class="bkap-form" id="bkap-form">
      <div class="bkap-row">
        <label>Équipe 1</label>
        <select name="team1">${teamSelectOpts(match.team1)}</select>
      </div>
      <div class="bkap-row">
        <label>Équipe 2</label>
        <select name="team2">${teamSelectOpts(match.team2)}</select>
      </div>
      <div class="bkap-row">
        <label>Statut</label>
        <select name="status">
          <option value="scheduled"${match.status==='scheduled'?' selected':''}>Planifié</option>
          <option value="live"${match.status==='live'?' selected':''}>En cours</option>
          <option value="finished"${match.status==='finished'?' selected':''}>Terminé</option>
        </select>
      </div>
      <div class="bkap-row">
        <label>Gagnant</label>
        <select name="winner">
          <option value="">—</option>
          <option value="${esc(match.team1)}"${match.winner===match.team1?' selected':''}>${esc(match.team1)}</option>
          <option value="${esc(match.team2)}"${match.winner===match.team2?' selected':''}>${esc(match.team2)}</option>
        </select>
      </div>
      <div class="bkap-row">
        <label>Score</label>
        <input type="number" name="score1" min="0" max="3" value="${match.score1 ?? ''}" style="width:46px" />
        <span style="color:var(--muted);padding:0 .2rem">—</span>
        <input type="number" name="score2" min="0" max="3" value="${match.score2 ?? ''}" style="width:46px" />
      </div>
      <div class="bkap-row" style="flex-direction:column;align-items:stretch;gap:.3rem">
        <label style="width:auto">Heure (UTC)</label>
        <input type="datetime-local" name="date_utc" id="bkap-dt" value="${existingDt}" style="font-size:.72rem" />
        <select id="bkap-cal-slot" style="font-size:.68rem">${slotOpts}</select>
      </div>
      <button type="submit" class="bkap-save" id="bkap-save">Sauvegarder</button>
    </form>
  ` : '';

  drawer.innerHTML = `
    <div class="pd-header">
      <div class="pd-match-title">${esc(match.team1)} <span style="color:var(--muted)">vs</span> ${esc(match.team2)}</div>
      ${scoreDisplay ? `<div class="pd-match-score">${scoreDisplay}</div>` : ''}
      <button class="pd-close" id="pd-close">✕</button>
    </div>
    <div class="pd-section-label">Pronostics</div>
    <div class="pd-picks" id="pd-picks">
      <div class="empty-state" style="padding:1rem">Chargement…</div>
    </div>
    ${adminSection}
  `;
  drawer.classList.add('open');

  document.getElementById('pd-close').addEventListener('click', () => {
    drawer.classList.remove('open');
  });

  if (IS_ADMIN) {
    // Quand on sélectionne un créneau → préremplit le datetime-local
    document.getElementById('bkap-cal-slot')?.addEventListener('change', e => {
      const calMatch = matches.find(m => m.id === e.target.value);
      if (!calMatch?.date_utc) return;
      const d = new Date(calMatch.date_utc.endsWith('Z') ? calMatch.date_utc : calMatch.date_utc + ' UTC');
      const pad = n => String(n).padStart(2, '0');
      document.getElementById('bkap-dt').value =
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    });

    document.getElementById('bkap-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const team1    = f.team1.value || 'TBD';
      const team2    = f.team2.value || 'TBD';
      const status   = f.status.value;
      const winner   = f.winner.value || null;
      const score1   = f.score1.value !== '' ? parseInt(f.score1.value) : null;
      const score2   = f.score2.value !== '' ? parseInt(f.score2.value) : null;
      // Heure saisie en UTC → stocker tel quel avec Z
      const dtRaw    = f.date_utc?.value;
      const date_utc = dtRaw ? dtRaw + ':00Z' : (match.date_utc || null);
      const btn = document.getElementById('bkap-save');
      btn.disabled = true; btn.textContent = '…';
      try {
        const matchData = { team1, team2, winner, score1, score2, status, date_utc };
        await updateMatch(match.id, matchData);
        if (status === 'finished' && winner) {
          await scorePicksForMatch({ id: match.id, ...matchData });
        }
        Object.assign(match, matchData);
        showToast('✓ Match mis à jour');
        btn.textContent = '✓ Sauvé';
        setTimeout(() => { btn.disabled = false; btn.textContent = 'Sauvegarder'; }, 1500);
        renderBracket();
        renderCalendrier();
      } catch (err) {
        showToast('Erreur : ' + err.message);
        btn.disabled = false; btn.textContent = 'Sauvegarder';
      }
    });
  }

  const allPicks = await getAllPicksByMatch(match.id);
  const pickByProfile = {};
  allPicks.forEach(p => { pickByProfile[p.profile_id] = p; });

  const rows = allProfiles.map(prof => {
    const pk = pickByProfile[prof.id];
    const isMe = prof.id === profile.id;
    const name = prof.pseudo || prof.name || '?';

    if (!pk?.pick_winner) {
      return `<div class="pd-pick-row${isMe ? ' me' : ''}">
        <span class="pd-pick-name">${esc(name)}</span>
        <span class="pd-pick-none">—</span>
      </div>`;
    }

    const isCorrect = pk.pick_winner === match.winner;
    const isPerfect = isCorrect && pk.pick_score1 === match.score1 && pk.pick_score2 === match.score2;
    const scoreStr = pk.pick_score1 != null ? `${pk.pick_score1}-${pk.pick_score2}` : '';
    const color = isPerfect ? 'var(--win)' : isCorrect ? 'var(--blue)' : 'var(--muted2)';
    const ptsHtml = pk.scored
      ? (pk.points > 0
          ? `<span class="pd-pick-pts" style="color:var(--gold)">+${pk.points}pts</span>`
          : `<span class="pd-pick-pts" style="color:var(--muted)">0pt</span>`)
      : '';

    return `<div class="pd-pick-row${isMe ? ' me' : ''}">
      <span class="pd-pick-name">${esc(name)}</span>
      <span class="pd-pick-team" style="color:${color}">${esc(pk.pick_winner)}</span>
      ${scoreStr ? `<span class="pd-pick-score">${scoreStr}</span>` : ''}
      ${ptsHtml}
    </div>`;
  });

  const content = document.getElementById('pd-picks');
  if (content) content.innerHTML = rows.join('') || '<div class="empty-state">Aucun pronostic.</div>';
}

// ── Données statiques MSI 2026 ─────────────────────────────────────
const MSI_2026_TEAM_LIST = [
  {
    keys: ['BLG', 'Bilibili Gaming'],
    full: 'Bilibili Gaming', league: 'LPL', region: 'Chine',
    seed: '1ère graine LPL — champions de Chine', stage: 'Bracket',
    players: [
      { role: 'Top', name: 'Bin' }, { role: 'Jungle', name: 'Xun' },
      { role: 'Mid', name: 'knight' }, { role: 'Bot', name: 'Viper' }, { role: 'Support', name: 'ON' },
    ]
  },
  {
    keys: ['TES', 'Top Esports'],
    full: 'Top Esports', league: 'LPL', region: 'Chine',
    seed: '2ème graine LPL', stage: 'Bracket',
    players: [
      { role: 'Top', name: 'ZUIAN' }, { role: 'Jungle', name: 'Tian' },
      { role: 'Mid', name: 'Creme' }, { role: 'Bot', name: 'JackeyLove' }, { role: 'Support', name: 'fengyue' },
    ]
  },
  {
    keys: ['HLE', 'Hanwha Life Esports'],
    full: 'Hanwha Life Esports', league: 'LCK', region: 'Corée du Sud',
    seed: '1ère graine LCK', stage: 'Bracket',
    players: [
      { role: 'Top', name: 'Zeus' }, { role: 'Jungle', name: 'Kanavi' },
      { role: 'Mid', name: 'Zeka' }, { role: 'Bot', name: 'Gumayusi' }, { role: 'Support', name: 'Delight' },
    ]
  },
  {
    keys: ['LYON'],
    full: 'LYON', league: 'LCS', region: 'Amérique du Nord',
    seed: '1ère graine LCS', stage: 'Bracket',
    players: [
      { role: 'Top', name: 'Dhokla' }, { role: 'Jungle', name: 'Inspired' },
      { role: 'Mid', name: 'Saint' }, { role: 'Bot', name: 'Berserker' }, { role: 'Support', name: 'Isles' },
    ]
  },
  {
    keys: ['FUR', 'FURIA'],
    full: 'FURIA', league: 'CBLOL', region: 'Brésil',
    seed: '1ère graine CBLOL', stage: 'Bracket',
    players: [
      { role: 'Top', name: 'Guigo' }, { role: 'Jungle', name: 'Tatu' },
      { role: 'Mid', name: 'Tutsz' }, { role: 'Bot', name: 'Ayu' }, { role: 'Support', name: 'Jojo' },
    ]
  },
  {
    keys: ['G2', 'G2 Esports'],
    full: 'G2 Esports', league: 'LEC', region: 'Europe',
    seed: '1ère graine LEC', stage: 'Bracket',
    players: [
      { role: 'Top', name: 'BrokenBlade' }, { role: 'Jungle', name: 'SkewMond' },
      { role: 'Mid', name: 'Caps' }, { role: 'Bot', name: 'Hans Sama' }, { role: 'Support', name: 'Labrov' },
    ]
  },
  {
    keys: ['TSW', 'Secret Whales'],
    full: 'Secret Whales', league: 'LCP', region: 'Pacifique',
    seed: '1ère graine LCP', stage: 'Bracket',
    players: [
      { role: 'Top', name: 'Pun' }, { role: 'Jungle', name: 'Hizto' },
      { role: 'Mid', name: 'Dire' }, { role: 'Bot', name: 'Eddie' }, { role: 'Support', name: 'Bie' },
    ]
  },
  {
    keys: ['T1'],
    full: 'T1', league: 'LCK', region: 'Corée du Sud',
    seed: '2ème graine LCK — équipe de Faker', stage: 'Play-In',
    players: [
      { role: 'Top', name: 'Doran' }, { role: 'Jungle', name: 'Oner' },
      { role: 'Mid', name: 'Faker' }, { role: 'Bot', name: 'Peyz' }, { role: 'Support', name: 'Keria' },
    ]
  },
  {
    keys: ['TLAW', 'Team Liquid'],
    full: 'Team Liquid', league: 'LCS', region: 'Amérique du Nord',
    seed: '2ème graine LCS', stage: 'Play-In',
    players: [
      { role: 'Top', name: 'Morgan' }, { role: 'Jungle', name: 'Josedeodo' },
      { role: 'Mid', name: 'Quid' }, { role: 'Bot', name: 'Yeon' }, { role: 'Support', name: 'CoreJJ' },
    ]
  },
  {
    keys: ['KC', 'Karmine Corp'],
    full: 'Karmine Corp', league: 'LEC', region: 'Europe',
    seed: '2ème graine LEC', stage: 'Play-In',
    players: [
      { role: 'Top', name: 'Canna' }, { role: 'Jungle', name: 'Yike' },
      { role: 'Mid', name: 'kyeahoo' }, { role: 'Bot', name: 'Caliste' }, { role: 'Support', name: 'Busio' },
    ]
  },
  {
    keys: ['DCG', 'Deep Cross Gaming'],
    full: 'Deep Cross Gaming', league: 'LCP', region: 'Pacifique',
    seed: '2ème graine LCP', stage: 'Play-In',
    players: [
      { role: 'Top', name: 'Flauren' }, { role: 'Jungle', name: 'POP9' },
      { role: 'Mid', name: 'HongSuo' }, { role: 'Bot', name: 'Feng' }, { role: 'Support', name: 'ShiauC' },
    ]
  },
];

// Index par n'importe quelle clé (code court ou nom complet)
const MSI_2026_TEAMS = {};
for (const t of MSI_2026_TEAM_LIST) {
  for (const k of t.keys) MSI_2026_TEAMS[k] = t;
}

// ── Onglet Équipes ─────────────────────────────────────────────────
function renderEquipes() {
  const container = document.getElementById('tab-equipes');
  const teams = tournament.teams || extractTeamsFromMatches();

  const KNOWN_WIKI_URLS = {
    '2026 Season Mid-Season Invitational': 'https://lol.fandom.com/wiki/2026_Mid-Season_Invitational',
  };
  const lpUrl = tournament.wiki_url
    || KNOWN_WIKI_URLS[tournament.leaguepedia_key]
    || (tournament.leaguepedia_key ? `https://lol.fandom.com/wiki/${tournament.leaguepedia_key.replace(/\s/g, '_')}` : null);

  // Séparer Bracket et Play-In
  const bracketTeams = teams.filter(t => (MSI_2026_TEAMS[t]?.stage || 'Bracket') === 'Bracket');
  const playInTeams  = teams.filter(t => MSI_2026_TEAMS[t]?.stage === 'Play-In');
  const otherTeams   = teams.filter(t => !MSI_2026_TEAMS[t]);

  container.innerHTML = `
    ${lpUrl ? `<a href="${lpUrl}" target="_blank" rel="noopener" class="lp-link">📖 Voir la page Leaguepedia →</a>` : ''}
    ${teams.length === 0
      ? '<div class="empty-state">Les équipes apparaîtront après la première synchronisation.</div>'
      : `
        ${bracketTeams.length ? `<div class="section-label">🏆 Bracket Stage</div><div class="teams-grid">${bracketTeams.map(t => renderTeamCard(t)).join('')}</div>` : ''}
        ${playInTeams.length  ? `<div class="section-label">🎟️ Play-In</div><div class="teams-grid">${playInTeams.map(t => renderTeamCard(t)).join('')}</div>` : ''}
        ${otherTeams.length   ? `<div class="section-label">Autres</div><div class="teams-grid">${otherTeams.map(t => renderTeamCard(t)).join('')}</div>` : ''}
      `
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
  const color   = avatarColor(teamName);
  const initial = teamName[0]?.toUpperCase() || '?';
  const logos   = tournament?.team_logos || {};
  const logo    = logos[teamName];
  const info    = MSI_2026_TEAMS[teamName];

  const logoHtml = logo
    ? `<img src="${logo}" alt="${esc(teamName)}" class="team-logo-card" onerror="this.style.display='none'">`
    : `<div class="team-initial" style="background:${color}">${initial}</div>`;

  const playersHtml = info?.players
    ? `<div class="team-players">${info.players.map(p =>
        `<div class="team-player"><span class="player-role">${esc(p.role)}</span><span class="player-name">${esc(p.name)}</span></div>`
      ).join('')}</div>`
    : '';

  return `
    <div class="team-card">
      <div class="team-card-header">
        ${logoHtml}
        <div class="team-card-titles">
          <div class="team-name">${esc(info?.full || teamName)}</div>
          ${info ? `<div class="team-league">${esc(info.league)} · ${esc(info.region)}</div>` : ''}
          ${info?.seed ? `<div class="team-seed">${esc(info.seed)}</div>` : ''}
        </div>
      </div>
      ${playersHtml}
    </div>`;
}

// ── Onglet Classement ──────────────────────────────────────────────
async function renderClassement() {
  const container = document.getElementById('tab-classement');
  container.innerHTML = '<div class="empty-state">Chargement…</div>';

  let entries;
  try {
    entries = await getLeaderboard(TOURNAMENT_ID);
  } catch (e) {
    container.innerHTML = `<div class="empty-state" style="color:#ef4444">Erreur : ${e.message}</div>`;
    console.error(e);
    return;
  }
  const rankClass = i => ['gold','silver','bronze'][i] || '';
  const rankIcon  = i => ['🥇','🥈','🥉'][i] || String(i + 1);

  container.innerHTML = `
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

  container.querySelectorAll('.lb-row.clickable').forEach(row => {
    row.addEventListener('click', () => {
      showPlayerBracket(row.dataset.playerId, row.dataset.playerName);
    });
  });
}

// ── Player Bracket Modal ──────────────────────────────────────────
async function showPlayerBracket(playerId, playerName) {
  const overlay = document.createElement('div');
  overlay.className = 'player-bracket-overlay';
  overlay.innerHTML = `
    <div class="player-bracket-modal">
      <div class="pbm-header">
        <div class="pbm-title">🏆 Bracket de ${esc(playerName)}</div>
        <button class="pbm-close" id="pbm-close">Fermer</button>
      </div>
      <div class="pbm-legend">
        <div class="pbm-legend-item"><div class="pbm-legend-dot" style="background:var(--win)"></div> Score exact (+5pts)</div>
        <div class="pbm-legend-item"><div class="pbm-legend-dot" style="background:var(--blue)"></div> Bon gagnant (+3pts)</div>
        <div class="pbm-legend-item"><div class="pbm-legend-dot" style="background:var(--loss)"></div> Mauvais gagnant (0pt)</div>
        <div class="pbm-legend-item"><div class="pbm-legend-dot" style="background:var(--accent)"></div> Pick non encore scoré</div>
      </div>
      <div id="pbm-content"><div class="empty-state">Chargement…</div></div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('pbm-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const playerPicks = await import('./db.js').then(m => m.getPicksByTournament(playerId, TOURNAMENT_ID));

  const byId = {};
  matches.forEach(m => { byId[m.id] = m; });

  const content = document.getElementById('pbm-content');
  content.innerHTML = `
    <div class="bk-legend">
      <span class="bk-legend-item real">Score réel</span>
      <span class="bk-legend-item pick-perfect">Parfait +5</span>
      <span class="bk-legend-item pick-correct">Bon gagnant +3</span>
      <span class="bk-legend-item pick-wrong">Mauvais 0pt</span>
    </div>
    ${renderBracketStageWithPicks('Stage 1 — Play-In', PLAY_IN_ROUNDS, byId, playerPicks)}
    ${renderBracketStageWithPicks('Stage 2 — Bracket', BRACKET_ROUNDS, byId, playerPicks)}
  `;
}

function renderBracketStageWithPicks(title, rounds, byId, playerPicks) {
  return `
    <div class="bk-stage">
      <div class="bk-stage-title">${title}</div>
      <div class="bk-rounds">
        ${rounds.map(r => `
          <div class="bk-col">
            <div class="bk-col-label">${r.label}</div>
            ${r.upper.length > 0 ? `<div class="bk-section">${r.upper.map(id => renderBkMatchWithPicks(byId[id], playerPicks)).join('')}</div>` : ''}
            ${r.lower.length > 0 ? `<div class="bk-section bk-lower"><div class="bk-lower-tag">Losers'</div>${r.lower.map(id => renderBkMatchWithPicks(byId[id], playerPicks)).join('')}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderBkMatchWithPicks(m, playerPicks) {
  if (!m) return '<div class="bk-match bk-empty"></div>';
  const isFinished = m.status === 'finished';
  const t1win = isFinished && m.winner === m.team1;
  const t2win = isFinished && m.winner === m.team2;
  const pick = playerPicks[m.id];

  let pickColHtml = '';
  if (isFinished && pick?.pick_winner) {
    const isCorrect = pick.pick_winner === m.winner;
    const ps1 = pick.pick_score1 != null ? parseInt(pick.pick_score1) : null;
    const ps2 = pick.pick_score2 != null ? parseInt(pick.pick_score2) : null;
    const isPerfect = isCorrect && ps1 === parseInt(m.score1) && ps2 === parseInt(m.score2);
    const cls = isPerfect ? 'pick-perfect' : isCorrect ? 'pick-correct' : 'pick-wrong';
    pickColHtml = `<div class="bk-score-col ${cls}"><span>${ps1 ?? '?'}</span><span>${ps2 ?? '?'}</span></div>`;
  } else if (!isFinished && pick?.pick_winner) {
    pickColHtml = `<div class="bk-pick-indicator pending" title="Pick : ${esc(pick.pick_winner)}">✓</div>`;
  }

  return `
    <div class="bk-match${isFinished ? ' done' : ''}">
      <div class="bk-teams-col">
        <div class="bk-team${t1win ? ' win' : t2win ? ' lose' : ''}">
          ${teamLogo(m.team1, 16)}
          <span class="bk-team-name">${esc(m.team1 || 'TBD')}</span>
        </div>
        <div class="bk-team${t2win ? ' win' : t1win ? ' lose' : ''}">
          ${teamLogo(m.team2, 16)}
          <span class="bk-team-name">${esc(m.team2 || 'TBD')}</span>
        </div>
      </div>
      ${isFinished ? `<div class="bk-score-col real"><span>${m.score1}</span><span>${m.score2}</span></div>${pickColHtml}` : pickColHtml}
    </div>
  `;
}

// ── Onglet Bracket ────────────────────────────────────────────────
function renderBracket() {
  const container = document.getElementById('tab-bracket');
  const byId = {};
  matches.forEach(m => { byId[m.id] = m; });

  container.innerHTML = `
    <div class="bk-legend">
      <span class="bk-legend-item real">Score réel</span>
      <span class="bk-legend-item pick-perfect">Parfait +5</span>
      <span class="bk-legend-item pick-correct">Bon gagnant +3</span>
      <span class="bk-legend-item pick-wrong">Mauvais 0pt</span>
    </div>
    ${renderBracketStage('Stage 1 — Play-In', PLAY_IN_ROUNDS, byId)}
    ${renderBracketStage('Stage 2 — Bracket', BRACKET_ROUNDS, byId)}
  `;

  setupBracketHandlers();
}

function renderBracketStage(title, rounds, byId) {
  return `
    <div class="bk-stage">
      <div class="bk-stage-title">${title}</div>
      <div class="bk-rounds">
        ${rounds.map(r => `
          <div class="bk-col">
            <div class="bk-col-label">${r.label}</div>
            ${r.upper.length > 0 ? `
              <div class="bk-section">
                ${r.upper.map(id => renderBkMatch(byId[id])).join('')}
              </div>` : ''}
            ${r.lower.length > 0 ? `
              <div class="bk-section bk-lower">
                <div class="bk-lower-tag">Losers'</div>
                ${r.lower.map(id => renderBkMatch(byId[id])).join('')}
              </div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderBkMatch(m) {
  if (!m) return '<div class="bk-match bk-empty"></div>';
  const isFinished = m.status === 'finished';
  const t1win  = isFinished && m.winner === m.team1;
  const t2win  = isFinished && m.winner === m.team2;
  const locked = isMatchLocked(m);
  const pick   = myPicks[m.id];
  const hasTbd = m.team1 === 'TBD' || m.team2 === 'TBD';
  const isLive = m.status === 'live';
  const clickable = IS_ADMIN || isFinished || isLive || (!locked && !hasTbd);

  let pickColHtml = '';
  if (isFinished && pick?.pick_winner) {
    const isCorrect = pick.pick_winner === m.winner;
    const ps1 = pick.pick_score1 != null ? parseInt(pick.pick_score1) : null;
    const ps2 = pick.pick_score2 != null ? parseInt(pick.pick_score2) : null;
    const isPerfect = isCorrect && ps1 === parseInt(m.score1) && ps2 === parseInt(m.score2);
    const cls = isPerfect ? 'pick-perfect' : isCorrect ? 'pick-correct' : 'pick-wrong';
    pickColHtml = `<div class="bk-score-col ${cls}"><span>${ps1 ?? '?'}</span><span>${ps2 ?? '?'}</span></div>`;
  }

  return `
    <div class="bk-match${isFinished ? ' done' : ''}${clickable ? ' bk-clickable' : ''}"
         ${clickable ? `data-bk-match="${m.id}"` : ''}>
      <div class="bk-teams-col">
        <div class="bk-team${t1win ? ' win' : t2win ? ' lose' : ''}">
          ${teamLogo(m.team1, 16)}
          <span class="bk-team-name">${esc(m.team1 || 'TBD')}</span>
        </div>
        <div class="bk-team${t2win ? ' win' : t1win ? ' lose' : ''}">
          ${teamLogo(m.team2, 16)}
          <span class="bk-team-name">${esc(m.team2 || 'TBD')}</span>
        </div>
      </div>
      ${isFinished ? `<div class="bk-score-col real"><span>${m.score1}</span><span>${m.score2}</span></div>${pickColHtml}` : ''}
      ${!isFinished && pick && !locked ? `<div class="bk-pick-indicator" title="Ton pick : ${esc(pick.pick_winner)}">✓</div>` : ''}
    </div>
  `;
}

function setupBracketHandlers() {
  document.querySelectorAll('[data-bk-match]').forEach(el => {
    el.addEventListener('click', () => {
      const m = matches.find(x => x.id === el.dataset.bkMatch);
      if (!m) return;
      if (m.status === 'finished' || m.status === 'live' || IS_ADMIN) {
        openPicksDrawer(m);
      } else {
        openPickModal(m);
      }
    });
  });
}

function openPickModal(match) {
  const pick    = myPicks[match.id];
  const bo      = match.best_of || 5;
  const maxWins = Math.ceil(bo / 2);
  const opts    = getScoreOpts(maxWins);

  const overlay = document.createElement('div');
  overlay.className = 'pick-modal-overlay';

  const pickedWinner = pick?.pick_winner || null;

  overlay.innerHTML = `
    <div class="pick-modal">
      <div class="pick-modal-title">Pronostic</div>
      <div class="pick-modal-match">
        <div class="pick-modal-team">
          ${teamLogo(match.team1, 28)}
          <span>${esc(match.team1)}</span>
        </div>
        <span style="color:var(--muted);font-size:.75rem">BO${bo}</span>
        <div class="pick-modal-team">
          <span>${esc(match.team2)}</span>
          ${teamLogo(match.team2, 28)}
        </div>
      </div>
      <div class="pick-label">Gagnant</div>
      <div class="pick-teams" style="margin-bottom:.75rem">
        <button class="pick-team-btn${pickedWinner === match.team1 ? ' selected' : ''}" data-modal-team="${escAttr(match.team1)}">${esc(match.team1)}</button>
        <button class="pick-team-btn${pickedWinner === match.team2 ? ' selected' : ''}" data-modal-team="${escAttr(match.team2)}">${esc(match.team2)}</button>
      </div>
      <div class="pick-scores" id="modal-scores" style="${!pickedWinner ? 'opacity:.35;pointer-events:none' : ''}">
        <span class="pick-score-label">Score :</span>
        <div class="score-opts" id="modal-score-opts">
          ${opts.map(([w, l]) => {
            const s1 = pickedWinner === match.team1 ? w : l;
            const s2 = pickedWinner === match.team1 ? l : w;
            const isSel = pick?.pick_score1 === s1 && pick?.pick_score2 === s2;
            return `<button class="score-btn${isSel ? ' selected' : ''}" data-ms1="${s1}" data-ms2="${s2}">${w}-${l}</button>`;
          }).join('')}
        </div>
      </div>
      <button class="pick-modal-close">Fermer</button>
    </div>
  `;

  document.body.appendChild(overlay);

  let currentWinner = pickedWinner;

  overlay.querySelectorAll('[data-modal-team]').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentWinner = btn.dataset.modalTeam;
      overlay.querySelectorAll('[data-modal-team]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      const scoresEl = document.getElementById('modal-scores');
      if (scoresEl) { scoresEl.style.opacity = '1'; scoresEl.style.pointerEvents = ''; }

      // Régénérer les score-btns
      const optsEl = document.getElementById('modal-score-opts');
      if (optsEl) {
        optsEl.innerHTML = opts.map(([w, l]) => {
          const s1 = currentWinner === match.team1 ? w : l;
          const s2 = currentWinner === match.team1 ? l : w;
          return `<button class="score-btn" data-ms1="${s1}" data-ms2="${s2}">${w}-${l}</button>`;
        }).join('');
        optsEl.querySelectorAll('.score-btn').forEach(sb => attachModalScoreBtn(sb, match, () => currentWinner));
      }

      await savePick(profile.id, match.id, TOURNAMENT_ID, currentWinner, null, null);
      myPicks[match.id] = { ...myPicks[match.id], pick_winner: currentWinner, pick_score1: null, pick_score2: null };
      showToast(`✓ ${currentWinner}`);
    });
  });

  overlay.querySelectorAll('.score-btn').forEach(sb => attachModalScoreBtn(sb, match, () => currentWinner));

  overlay.querySelector('.pick-modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function attachModalScoreBtn(btn, match, getWinner) {
  btn.addEventListener('click', async e => {
    e.stopPropagation();
    const s1 = parseInt(btn.dataset.ms1);
    const s2 = parseInt(btn.dataset.ms2);
    const winner = getWinner();
    if (!winner) return;

    btn.closest('.score-opts')?.querySelectorAll('.score-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');

    await savePick(profile.id, match.id, TOURNAMENT_ID, winner, s1, s2);
    myPicks[match.id] = { ...myPicks[match.id], pick_winner: winner, pick_score1: s1, pick_score2: s2 };
    showToast(`✓ ${s1}-${s2}`);
  });
}

// ── Onglet Admin ───────────────────────────────────────────────────
function renderAdmin() {
  const container = document.getElementById('tab-admin');
  if (!container) return;

  const teams = [...new Set(
    matches.flatMap(m => [m.team1, m.team2]).filter(t => t && t !== 'TBD')
  )].sort();

  const logos = tournament.team_logos || {};

  container.innerHTML = `
    <div class="admin-section" style="margin-bottom:1.2rem">
      <div class="admin-title">🔗 URL wiki Leaguepedia</div>
      <input class="admin-input" id="adm-wiki-url" type="url"
        placeholder="https://lol.fandom.com/wiki/2026_Mid-Season_Invitational"
        value="${esc(tournament.wiki_url || '')}" style="width:100%" />
      <button class="admin-save-btn" id="btn-save-wiki" style="margin-top:.5rem">Sauvegarder l'URL</button>
    </div>

    <div class="admin-section">
      <div class="admin-title">🖼️ Logos des équipes</div>
      <div class="admin-logos-list">
        ${teams.map(t => `
          <div class="admin-logo-row">
            <div class="admin-logo-preview">
              ${logos[t]
                ? `<img src="${logos[t]}" alt="${esc(t)}" style="width:32px;height:32px;object-fit:contain" onerror="this.style.display='none'">`
                : `<div style="width:32px;height:32px;border-radius:50%;background:${avatarColor(t)};display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:#fff">${t[0]}</div>`
              }
            </div>
            <span style="font-size:.8rem;font-weight:600;min-width:130px">${esc(t)}</span>
            <input class="admin-logo-input" type="url" data-team="${escAttr(t)}"
              placeholder="https://…" value="${esc(logos[t] || '')}"
              style="flex:1" />
          </div>
        `).join('')}
      </div>
      <button class="admin-save-btn" id="btn-save-logos" style="margin-top:.75rem">Sauvegarder les logos</button>
    </div>

    <div class="admin-section" style="margin-top:1.5rem">
      <div class="admin-title">⚙️ Gestion des matchs</div>
      <div class="admin-list">
        ${matches.map(m => renderAdminMatch(m, teams)).join('')}
      </div>
    </div>
  `;

  // Sauvegarder l'URL wiki
  document.getElementById('btn-save-wiki')?.addEventListener('click', async () => {
    const url = document.getElementById('adm-wiki-url').value.trim();
    const btn = document.getElementById('btn-save-wiki');
    btn.disabled = true; btn.textContent = '…';
    try {
      await updateTournament(TOURNAMENT_ID, { wiki_url: url || null });
      tournament.wiki_url = url || null;
      showToast('✓ URL sauvegardée');
      btn.textContent = '✓';
      setTimeout(() => { btn.disabled = false; btn.textContent = 'Sauvegarder l\'URL'; }, 1500);
    } catch (e) {
      showToast('Erreur : ' + e.message);
      btn.disabled = false; btn.textContent = 'Sauvegarder l\'URL';
    }
  });

  // Sauvegarder les logos
  document.getElementById('btn-save-logos')?.addEventListener('click', async () => {
    const newLogos = {};
    container.querySelectorAll('.admin-logo-input').forEach(inp => {
      const v = inp.value.trim();
      if (v) newLogos[inp.dataset.team] = v;
    });
    const btn = document.getElementById('btn-save-logos');
    btn.disabled = true; btn.textContent = '…';
    try {
      await updateTournament(TOURNAMENT_ID, { team_logos: newLogos });
      tournament.team_logos = newLogos;
      showToast('✓ Logos sauvegardés');
      btn.textContent = '✓';
      setTimeout(() => { btn.disabled = false; btn.textContent = 'Sauvegarder les logos'; }, 1500);
    } catch (e) {
      showToast('Erreur : ' + e.message);
      btn.disabled = false; btn.textContent = 'Sauvegarder les logos';
    }
  });

  // Créneau calendrier → préremplit le datetime-local correspondant
  container.querySelectorAll('.adm-cal-slot').forEach(sel => {
    sel.addEventListener('change', e => {
      const calMatch = matches.find(m => m.id === e.target.value);
      if (!calMatch?.date_utc) return;
      const d = new Date(calMatch.date_utc.endsWith('Z') ? calMatch.date_utc : calMatch.date_utc + ' UTC');
      const p = n => String(n).padStart(2, '0');
      const dtInput = sel.closest('form').querySelector('.adm-dt');
      if (dtInput) dtInput.value = `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
    });
  });

  container.querySelectorAll('.admin-match-form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const id = form.dataset.matchId;
      const team1      = form.querySelector('[name=team1]').value;
      const team2      = form.querySelector('[name=team2]').value;
      const winner     = form.querySelector('[name=winner]').value;
      const score1     = form.querySelector('[name=score1]').value;
      const score2     = form.querySelector('[name=score2]').value;
      const status     = form.querySelector('[name=status]').value;
      const dtRaw      = form.querySelector('[name=date_utc]')?.value;
      const local      = matches.find(m => m.id === id);
      const date_utc   = dtRaw ? dtRaw + ':00Z' : (local?.date_utc || null);

      const btn = form.querySelector('.admin-save-btn');
      btn.disabled = true;
      btn.textContent = '…';

      try {
        const matchData = {
          team1: team1 || 'TBD',
          team2: team2 || 'TBD',
          winner: winner || null,
          score1: score1 !== '' ? parseInt(score1) : null,
          score2: score2 !== '' ? parseInt(score2) : null,
          status,
          date_utc
        };
        await updateMatch(id, matchData);
        if (status === 'finished' && winner) {
          await scorePicksForMatch({ id, ...matchData });
        }
        if (local) Object.assign(local, matchData);
        showToast('✓ Match mis à jour' + (status === 'finished' && winner ? ' + picks scorés' : ''));
        btn.textContent = '✓ Sauvé';
        setTimeout(() => { btn.disabled = false; btn.textContent = 'Sauvegarder'; }, 1500);
        renderCalendrier();
        renderBracket();
      } catch (err) {
        showToast('Erreur : ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Sauvegarder';
      }
    });
  });
}

function renderAdminMatch(m, teams) {
  const teamSelectOpts = (current) => [
    `<option value="">— Équipe —</option>`,
    ...teams.map(t => `<option value="${esc(t)}"${t === current ? ' selected' : ''}>${esc(t)}</option>`)
  ].join('');

  const winnerOpts = `
    <option value="">— Pas de gagnant —</option>
    <option value="${esc(m.team1)}"${m.winner === m.team1 ? ' selected' : ''}>${esc(m.team1)}</option>
    <option value="${esc(m.team2)}"${m.winner === m.team2 ? ' selected' : ''}>${esc(m.team2)}</option>
  `;

  const otherMatches = matches
    .filter(x => x.id !== m.id && x.date_utc)
    .sort((a, b) => a.date_utc.localeCompare(b.date_utc));
  const slotOpts = [
    `<option value="">— Copier l'heure d'un match —</option>`,
    ...otherMatches.map(x => {
      const t = formatMatchTime(x.date_utc);
      const d = new Date(x.date_utc.endsWith('Z') ? x.date_utc : x.date_utc + ' UTC')
        .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
      return `<option value="${esc(x.id)}">${esc(x.team1)} vs ${esc(x.team2)} — ${d} ${t}</option>`;
    })
  ].join('');

  const existingDt = m.date_utc ? (() => {
    const d = new Date(m.date_utc.endsWith('Z') ? m.date_utc : m.date_utc + ' UTC');
    const p = n => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  })() : '';

  return `
    <details class="admin-match">
      <summary class="admin-match-header">
        <span class="admin-match-label">${esc(m.round)}</span>
        <span class="admin-match-teams">${esc(m.team1)} vs ${esc(m.team2)}</span>
        <span class="admin-match-status ${m.status}">${m.status}</span>
      </summary>
      <form class="admin-match-form" data-match-id="${m.id}">
        <div class="admin-row">
          <label>Équipe 1</label>
          <select name="team1">${teamSelectOpts(m.team1)}</select>
        </div>
        <div class="admin-row">
          <label>Équipe 2</label>
          <select name="team2">${teamSelectOpts(m.team2)}</select>
        </div>
        <div class="admin-row">
          <label>Statut</label>
          <select name="status">
            <option value="scheduled"${m.status==='scheduled'?' selected':''}>Planifié</option>
            <option value="live"${m.status==='live'?' selected':''}>En cours</option>
            <option value="finished"${m.status==='finished'?' selected':''}>Terminé</option>
          </select>
        </div>
        <div class="admin-row">
          <label>Gagnant</label>
          <select name="winner">${winnerOpts}</select>
        </div>
        <div class="admin-row">
          <label>Score</label>
          <input type="number" name="score1" min="0" max="3" value="${m.score1 ?? ''}" style="width:52px" />
          <span style="color:var(--muted)">—</span>
          <input type="number" name="score2" min="0" max="3" value="${m.score2 ?? ''}" style="width:52px" />
        </div>
        <div class="admin-row" style="flex-wrap:wrap;gap:.3rem">
          <label style="width:100%">Heure (UTC)</label>
          <input type="datetime-local" name="date_utc" class="adm-dt" value="${existingDt}" style="flex:1;min-width:0;font-size:.7rem" />
          <select class="adm-cal-slot" data-match-id="${m.id}" style="width:100%;font-size:.68rem">${slotOpts}</select>
        </div>
        <button type="submit" class="admin-save-btn">Sauvegarder</button>
      </form>
    </details>
  `;
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
  // Clic sur .match-main → drawer pour matchs terminés, expand/collapse sinon
  document.querySelectorAll('.match-main').forEach(el => {
    el.addEventListener('click', () => {
      const card = el.closest('.match-card');
      const matchId = card.dataset.matchId;
      const match = matches.find(m => m.id === matchId);

      if (match?.status === 'finished' || match?.status === 'live' || IS_ADMIN) {
        openPicksDrawer(match);
        return;
      }

      card.classList.toggle('expanded');
      const pickEl = card.querySelector('.match-pick');
      if (pickEl) pickEl.style.display = card.classList.contains('expanded') ? 'block' : 'none';
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
