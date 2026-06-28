import { requireProfile }              from './auth.js';
import { injectTopBar, injectSidebar, setSidebarLive, setNavPts } from './nav.js';
import { getTournaments, createTournament, getLeaderboard } from './db.js';

const IS_ADMIN = new URLSearchParams(location.search).has('admin');

requireProfile(async (profile) => {
  injectTopBar(profile);
  injectSidebar(profile, 'accueil');
  await renderAccueil(profile);
});

async function renderAccueil(profile) {
  const main = document.getElementById('main');
  main.innerHTML = `
    ${IS_ADMIN ? renderAdminPanel() : ''}
    <div id="tours-container"><div class="empty-state">Chargement…</div></div>
  `;

  if (IS_ADMIN) setupAdminPanel();

  const [tournaments, lb] = await Promise.all([
    getTournaments(),
    getLeaderboard(null)
  ]);

  const live     = tournaments.filter(t => t.status === 'live');
  const upcoming = tournaments.filter(t => t.status === 'upcoming');
  const finished = tournaments.filter(t => t.status === 'finished');

  // Points du joueur courant dans le classement
  const myEntry = lb.find(e => e.id === profile.id);
  if (myEntry) setNavPts(myEntry.points);

  const container = document.getElementById('tours-container');

  // Hero live (premier tournoi en cours)
  let heroHtml = '';
  if (live.length > 0) {
    const t = live[0];
    const pts  = myEntry?.points ?? 0;
    const scored = myEntry?.correct ?? 0;
    const rank = myEntry ? (lb.indexOf(myEntry) + 1) : '—';
    const dates = formatDateRange(t.start_date, t.end_date);
    heroHtml = `
      <a href="/pronostics/tournoi.html?id=${esc(t.id)}" class="hero-live">
        <div class="hero-live-glow"></div>
        <div class="hero-live-status">
          <span class="live-dot"></span>
          <span class="live-label">En direct</span>
          ${t.league ? `<span class="hero-region">${esc(t.league)}</span>` : ''}
        </div>
        <div class="hero-name">${esc(t.name)}</div>
        <div class="hero-meta">${dates}${t.phase ? ' · ' + esc(t.phase) : ''}</div>
        <div class="hero-stats">
          <div>
            <div class="hero-stat-val">${pts}</div>
            <div class="hero-stat-label">Mes points</div>
          </div>
          <div>
            <div class="hero-stat-val neutral">${scored}</div>
            <div class="hero-stat-label">Scorés</div>
          </div>
          <div>
            <div class="hero-stat-val neutral">${rank}<span class="hero-stat-sup">${typeof rank === 'number' ? 'e' : ''}</span></div>
            <div class="hero-stat-label">Classement</div>
          </div>
        </div>
      </a>
    `;
  }

  // Grille tous les tournois
  const allTours = [...tournaments];
  let gridHtml = '';
  if (allTours.length > 0) {
    gridHtml = `
      <div class="section-label">Tous les tournois</div>
      <div class="tours-grid">
        ${allTours.map(t => renderCard(t)).join('')}
      </div>
    `;
  } else {
    gridHtml = '<div class="empty-state">Aucun tournoi configuré.</div>';
  }

  container.innerHTML = heroHtml + gridHtml;
}

function renderCard(t) {
  const statusLabel = { live: 'En cours', upcoming: 'À venir', finished: 'Archivé' }[t.status] || t.status;
  const dates = formatDateRange(t.start_date, t.end_date);
  return `
    <a href="/pronostics/tournoi.html?id=${esc(t.id)}" class="tournament-card ${esc(t.status)}">
      <div class="tc-status ${esc(t.status)}">${statusLabel}</div>
      <div class="tc-name">${esc(t.name)}</div>
      <div class="tc-meta">${dates}</div>
    </a>
  `;
}

function renderAdminPanel() {
  return `
    <div class="admin-panel">
      <div class="admin-title">Admin — Ajouter un tournoi</div>
      <div class="admin-form" id="admin-form">
        <div>
          <div class="admin-label">Nom du tournoi</div>
          <input class="admin-input" id="adm-name" placeholder="MSI 2026" />
        </div>
        <div>
          <div class="admin-label">Clé Leaguepedia (OverviewPage)</div>
          <input class="admin-input" id="adm-key" placeholder="2026 Season Mid-Season Invitational" />
        </div>
        <div class="admin-row">
          <div>
            <div class="admin-label">Ligue / Région</div>
            <input class="admin-input" id="adm-league" placeholder="International" />
          </div>
          <div>
            <div class="admin-label">Statut</div>
            <select class="admin-input" id="adm-status">
              <option value="upcoming">À venir</option>
              <option value="live">Live</option>
              <option value="finished">Terminé</option>
            </select>
          </div>
        </div>
        <div class="admin-row">
          <div>
            <div class="admin-label">Date début</div>
            <input class="admin-input" id="adm-start" type="date" />
          </div>
          <div>
            <div class="admin-label">Date fin</div>
            <input class="admin-input" id="adm-end" type="date" />
          </div>
        </div>
        <div>
          <div class="admin-label">Équipes participantes (séparées par des virgules)</div>
          <input class="admin-input" id="adm-teams" placeholder="T1, Gen.G, Cloud9, G2 Esports…" />
        </div>
        <div>
          <div class="admin-label">URL wiki Leaguepedia (optionnel)</div>
          <input class="admin-input" id="adm-wiki" placeholder="https://lol.fandom.com/wiki/…" />
        </div>
        <button class="btn-admin" id="btn-adm-save">Créer le tournoi</button>
      </div>
    </div>
  `;
}

function setupAdminPanel() {
  document.getElementById('btn-adm-save')?.addEventListener('click', async () => {
    const name   = document.getElementById('adm-name').value.trim();
    const key    = document.getElementById('adm-key').value.trim();
    const league = document.getElementById('adm-league').value.trim();
    const status = document.getElementById('adm-status').value;
    const start  = document.getElementById('adm-start').value;
    const end    = document.getElementById('adm-end').value;
    const teams  = document.getElementById('adm-teams').value.split(',').map(s => s.trim()).filter(Boolean);
    const wiki   = document.getElementById('adm-wiki').value.trim();

    if (!name || !key) { alert('Nom et clé Leaguepedia sont requis.'); return; }

    const btn = document.getElementById('btn-adm-save');
    btn.disabled = true; btn.textContent = 'Création…';
    try {
      await createTournament({ name, leaguepedia_key: key, league, status, start_date: start, end_date: end, teams, ...(wiki ? { wiki_url: wiki } : {}) });
      btn.textContent = '✓ Tournoi créé !';
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      alert('Erreur : ' + e.message);
      btn.disabled = false; btn.textContent = 'Créer le tournoi';
    }
  });
}

function formatDateRange(start, end) {
  if (!start) return '';
  const fmt = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return end ? `${fmt(start)} — ${fmt(end)}` : `Depuis le ${fmt(start)}`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
