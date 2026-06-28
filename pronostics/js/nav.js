import { updateProfile } from './db.js';

// ── Avatar helpers ─────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c',
  '#3498db','#9b59b6','#e91e63','#ff5722','#00bcd4'
];

export function avatarColor(name) {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function avatarHtml(profile, sizeClass = '') {
  const color = avatarColor(profile.name || profile.pseudo || '?');
  const initial = (profile.name || profile.pseudo || '?')[0].toUpperCase();
  const hex = sizeClass === 'avatar-sm' ? 'avatar-hex avatar-hex-sm'
            : sizeClass === 'avatar-lg' ? 'avatar-hex avatar-hex-lg'
            : 'avatar-hex';
  if (profile.avatar_url) {
    return `<div class="${hex}" style="background:${color}" title="${esc(profile.name || profile.pseudo)}">
      <img src="${esc(profile.avatar_url)}" alt="${esc(profile.name || profile.pseudo)}" onerror="this.style.display='none'">
    </div>`;
  }
  return `<div class="${hex}" style="background:${color}" title="${esc(profile.name || profile.pseudo)}">${initial}</div>`;
}

// ── Top navigation (desktop horizontal) ────────────────────────────
export function injectTopBar(profile) {
  // no-op: kept for tournoi.js which calls both injectTopBar + injectSidebar
  // real nav is built by injectSidebar
}

export function injectSidebar(profile, active) {
  _buildNav(profile, active);
}

function _buildNav(profile, active) {
  const nav = document.createElement('header');
  nav.className = 'top-nav';
  nav.innerHTML = `
    <a href="/pronostics/" class="nav-logo">
      <div class="nav-logo-hex"></div>
      <span class="nav-logo-text">Pronos</span>
    </a>
    <nav class="nav-links">
      <a href="/pronostics/" class="nav-link${active === 'accueil' ? ' active' : ''}">Tournois</a>
      <a href="/pronostics/classement.html" class="nav-link${active === 'classement' ? ' active' : ''}">Classement</a>
    </nav>
    <div class="nav-right">
      <div id="nav-sync-slot"></div>
      <div id="nav-live-wrap"></div>
      <span class="nav-pts" id="nav-pts" style="display:none"></span>
      <div id="top-avatar" style="cursor:pointer" title="Modifier le profil">
        ${avatarHtml(profile, '')}
      </div>
      <button class="btn-logout" id="btn-logout" title="Se déconnecter">✕</button>
    </div>
  `;
  document.body.prepend(nav);

  // Tournois live dans la nav
  import('./db.js').then(({ getTournaments }) => {
    getTournaments().then(tournaments => {
      const live = tournaments.filter(t => t.status === 'live');
      const wrap = document.getElementById('nav-live-wrap');
      if (!wrap || !live.length) return;
      wrap.innerHTML = live.map(t => `
        <a class="nav-live-badge" href="/pronostics/tournoi.html?id=${esc(t.id)}">
          <span class="nav-live-dot"></span>${esc(t.short_name || t.name)}
        </a>
      `).join('');
    });
  });

  // Bouton retour site (bas gauche)
  const homeBtn = document.createElement('a');
  homeBtn.href = '/';
  homeBtn.className = 'home-btn';
  homeBtn.title = "Retour à l'accueil du site";
  homeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;
  document.body.appendChild(homeBtn);

  document.getElementById('btn-logout').addEventListener('click', () => {
    import('./auth.js').then(({ clearLocalProfile }) => {
      clearLocalProfile();
      location.reload();
    });
  });

  document.getElementById('top-avatar').addEventListener('click', () => {
    showAvatarModal(profile);
  });
}

export function setNavPts(pts) {
  const el = document.getElementById('nav-pts');
  if (!el) return;
  el.textContent = `${pts} pts`;
  el.style.display = '';
}

// kept for backwards compat — live tournaments could appear here if needed
export function setSidebarLive() {}

// ── Avatar edit modal ──────────────────────────────────────────────
function showAvatarModal(profile) {
  const overlay = document.createElement('div');
  overlay.className = 'avatar-modal-overlay';
  overlay.innerHTML = `
    <div class="avatar-modal">
      <div class="avatar-modal-title">Modifier mon profil</div>
      <div class="avatar-preview">
        <div id="av-preview">${avatarHtml({ ...profile }, 'avatar-lg')}</div>
      </div>
      <div class="avatar-modal-label">URL d'une image (Discord, internet…)</div>
      <input class="avatar-modal-input" id="av-url" type="url"
        placeholder="https://…"
        value="${esc(profile.avatar_url || '')}" />
      <div class="avatar-modal-btns">
        <button class="btn-secondary" id="av-cancel">Annuler</button>
        <button class="btn-primary" id="av-save" style="flex:1">Enregistrer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const urlInput = document.getElementById('av-url');
  const preview  = document.getElementById('av-preview');
  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    preview.innerHTML = avatarHtml({ ...profile, avatar_url: url || null }, 'avatar-lg');
  });

  document.getElementById('av-cancel').addEventListener('click', () => overlay.remove());

  document.getElementById('av-save').addEventListener('click', async () => {
    const url = urlInput.value.trim() || null;
    const btn = document.getElementById('av-save');
    btn.disabled = true; btn.textContent = '…';
    try {
      await updateProfile(profile.id, { avatar_url: url });
      import('./auth.js').then(({ setLocalProfile }) => {
        setLocalProfile(profile.id, profile.name, url);
      });
      profile.avatar_url = url;
      const topAv = document.getElementById('top-avatar');
      if (topAv) topAv.innerHTML = avatarHtml(profile, '');
      overlay.remove();
      showToast('✓ Profil mis à jour');
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Enregistrer';
    }
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Toast ──────────────────────────────────────────────────────────
export function showToast(msg, duration = 2500) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), duration);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
