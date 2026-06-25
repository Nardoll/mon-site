export function renderNav(activePage, servers = []) {
  const nav = document.getElementById('sidebar');
  if (!nav) return;

  nav.innerHTML = `
    <div class="sidebar-header">
      <span class="sidebar-logo">📊</span>
      <span class="sidebar-title">Data Discord</span>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section">Serveurs</div>
      <a href="/data-discord/" class="sidebar-link${activePage === 'home' ? ' active' : ''}">🏠 Accueil</a>
      ${servers.map(s => `
        <a href="/data-discord/dashboard.html?id=${s.id}" class="sidebar-link${activePage === s.id ? ' active' : ''}">
          ${s.icon ? `<img src="${s.icon}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;flex-shrink:0">` : '<span>💬</span>'}
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.nom)}</span>
        </a>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <a href="/" class="sidebar-home">← Accueil du site</a>
    </div>
  `;

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
}
