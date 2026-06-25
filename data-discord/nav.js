export function renderNav(activePage) {
  const nav = document.getElementById('sidebar');
  if (!nav) return;

  const links = [
    { section: 'Serveurs' },
    { href: '/data-discord/dashboard.html', label: '📗 Lis tes ratures', id: 'dashboard' },
    { section: 'Sondages manuels' },
    { href: '/data-discord/', label: '🗳️ Archives', id: 'archives' },
    { href: '/data-discord/membres.html', label: '👥 Membres', id: 'membres' },
    { href: '/data-discord/stats.html', label: '📊 Statistiques', id: 'stats' },
  ];

  nav.innerHTML = `
    <div class="sidebar-header">
      <span class="sidebar-logo">📊</span>
      <span class="sidebar-title">Data Discord</span>
    </div>
    <nav class="sidebar-nav">
      ${links.map(l => l.section
        ? `<div class="sidebar-section">${l.section}</div>`
        : `<a href="${l.href}" class="sidebar-link${activePage === l.id ? ' active' : ''}">${l.label}</a>`
      ).join('')}
    </nav>
    <div class="sidebar-footer">
      <a href="/" class="sidebar-home">← Accueil du site</a>
    </div>
  `;
}
