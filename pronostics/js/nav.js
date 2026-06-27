export function injectTopBar(profile) {
  const bar = document.createElement('header');
  bar.className = 'top-bar';
  bar.innerHTML = `
    <a href="/pronostics/" class="top-logo">
      <span class="top-logo-icon">⚡</span>
      <span class="top-logo-text">Pronostics</span>
    </a>
    <div class="top-user">
      <div class="top-user-dot"></div>
      <span>Connecté :</span>
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
}

export function injectBottomNav(active) {
  const items = [
    { href: '/pronostics/',              icon: '🏠', label: 'Accueil',    key: 'accueil' },
    { href: '/pronostics/classement.html', icon: '🏆', label: 'Classement', key: 'classement' },
  ];
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = items.map(i => `
    <a href="${i.href}" class="nav-item${i.key === active ? ' active' : ''}">
      <span class="nav-icon">${i.icon}</span>
      <span class="nav-label">${i.label}</span>
    </a>
  `).join('');
  document.body.appendChild(nav);
}

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
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
