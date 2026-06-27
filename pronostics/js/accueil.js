import { requireProfile }              from './auth.js';
import { injectTopBar, injectBottomNav } from './nav.js';
import { getTournaments, createTournament } from './db.js';

const IS_ADMIN = new URLSearchParams(location.search).has('admin');

requireProfile(async (profile) => {
  injectTopBar(profile);
  injectBottomNav('accueil');
  await renderAccueil(profile);
});

async function renderAccueil(profile) {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page-title">Bonjour, ${esc(profile.name)} 👋</div>
    <div class="page-subtitle">Fais tes pronostics avant chaque match.</div>
    ${IS_ADMIN ? renderAdminPanel() : ''}
    <div id="tours-container"><div class="empty-state">Chargement…</div></div>
  `;

  if (IS_ADMIN) setupAdminPanel();

  const tournaments = await getTournaments();
  const live     = tournaments.filter(t => t.status === 'live');
  const upcoming = tournaments.filter(t => t.status === 'upcoming');
  const finished = tournaments.filter(t => t.status === 'finished');

  const container = document.getElementById('tours-container');
  container.innerHTML = `
    ${renderSection('🔴 En cours', live, 'live')}
    ${renderSection('📅 À venir', upcoming, 'upcoming')}
    ${finished.length ? renderSection('📁 Archivés', finished, 'finished') : ''}
    ${tournaments.length === 0 ? '<div class="empty-state">Aucun tournoi configuré pour le moment.</div>' : ''}
  `;
}

function renderSection(label, list, cls) {
  if (list.length === 0 && cls !== 'live') {
    return `<div class="section-label">${label}</div><div class="empty-state" style="padding:.8rem 0">Aucun</div>`;
  }
  return `
    <div class="section-label">${label}</div>
    ${list.map(t => renderCard(t, cls)).join('')}
  `;
}

function renderCard(t, cls) {
  const statusLabel = { live: '● Live', upcoming: 'À venir', finished: 'Terminé' }[cls] || cls;
  const dates = formatDateRange(t.start_date, t.end_date);
  return `
    <a href="/pronostics/tournoi.html?id=${t.id}" class="tournament-card ${cls}">
      <div class="tc-header">
        <div>
          <div class="tc-name">${esc(t.name)}</div>
          ${t.league ? `<div class="tc-league">${esc(t.league)}</div>` : ''}
        </div>
        <span class="tc-status ${cls}">${statusLabel}</span>
      </div>
      <div class="tc-body">
        <div class="tc-meta">${dates}</div>
      </div>
      <span class="tc-arrow">→</span>
    </a>
  `;
}

function renderAdminPanel() {
  return `
    <div class="admin-panel">
      <div class="admin-title">⚙️ Admin — Ajouter un tournoi</div>
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
          <input class="admin-input" id="adm-wiki" placeholder="https://lol.fandom.com/wiki/2026_Mid-Season_Invitational" />
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
    const teams  = document.getElementById('adm-teams').value
      .split(',').map(s => s.trim()).filter(Boolean);
    const wiki = document.getElementById('adm-wiki').value.trim();

    if (!name || !key) {
      alert('Nom et clé Leaguepedia sont requis.');
      return;
    }

    const btn = document.getElementById('btn-adm-save');
    btn.disabled = true;
    btn.textContent = 'Création…';

    try {
      await createTournament({ name, leaguepedia_key: key, league, status, start_date: start, end_date: end, teams, ...(wiki ? { wiki_url: wiki } : {}) });
      btn.textContent = '✓ Tournoi créé !';
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      alert('Erreur : ' + e.message);
      btn.disabled = false;
      btn.textContent = 'Créer le tournoi';
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
