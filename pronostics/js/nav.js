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
  if (profile.avatar_url) {
    return `<div class="avatar ${sizeClass}" style="background:${color}" title="${esc(profile.name)}">
      <img src="${esc(profile.avatar_url)}" alt="${esc(profile.name)}" onerror="this.style.display='none'">
    </div>`;
  }
  return `<div class="avatar ${sizeClass}" style="background:${color}" title="${esc(profile.name)}">${initial}</div>`;
}

// ── Top bar (utilisateur uniquement, sans logo) ────────────────────
export function injectTopBar(profile) {
  const bar = document.createElement('header');
  bar.className = 'top-bar';
  bar.innerHTML = `
    <div class="top-user" style="gap:.55rem;margin-left:auto">
      <div id="top-avatar" style="cursor:pointer" title="Modifier le profil">
        ${avatarHtml(profile, '')}
      </div>
      <span class="top-user-name">${esc(profile.name)}</span>
      <button class="btn-logout" id="btn-logout" title="Se déconnecter">✕</button>
    </div>
  `;
  document.body.prepend(bar);

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

// ── Sidebar gauche fixe ────────────────────────────────────────────
export function injectSidebar(profile, active) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.innerHTML = `
    <div class="sb-header">
      <a href="/pronostics/" class="sb-logo">
        <span class="sb-logo-icon">⚡</span>
        <span class="sb-logo-text">Pronostics</span>
      </a>
    </div>
    <nav class="sb-nav">
      <a href="/pronostics/" class="sb-link${active === 'accueil' ? ' active' : ''}">
        🏆 Tournois
      </a>
      <a href="/pronostics/classement.html" class="sb-link${active === 'classement' ? ' active' : ''}">
        📊 Classement général
      </a>
    </nav>
    <div class="sb-footer">
      <a href="/" class="sb-home" title="Accueil du site">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      </a>
    </div>
  `;
  document.body.prepend(sidebar);
}

// ── Avatar edit modal ──────────────────────────────────────────────
function showAvatarModal(profile) {
  const overlay = document.createElement('div');
  overlay.className = 'avatar-modal-overlay';
  overlay.innerHTML = `
    <div class="avatar-modal">
      <div class="avatar-modal-title">✏️ Modifier mon profil</div>
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

  // Preview live
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
    btn.disabled = true;
    btn.textContent = '…';
    try {
      await updateProfile(profile.id, { avatar_url: url });
      // Update local cache
      import('./auth.js').then(({ setLocalProfile }) => {
        setLocalProfile(profile.id, profile.name);
      });
      profile.avatar_url = url;
      // Update top bar avatar
      const topAv = document.getElementById('top-avatar');
      if (topAv) topAv.innerHTML = avatarHtml(profile, '');
      overlay.remove();
      showToast('✓ Profil mis à jour');
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'Enregistrer';
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
