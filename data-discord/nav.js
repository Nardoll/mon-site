export function renderNav(activePage, servers = []) {
  const nav = document.getElementById('sidebar');
  if (!nav) return;

  const params    = new URLSearchParams(location.search);
  const guildId   = params.get('id');
  const pageName  = location.pathname.split('/').at(-1).replace('.html', '') || 'index';

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const subPages = [
    { key: 'dashboard', label: '📊 Vue d\'ensemble', file: 'dashboard.html' },
    { key: 'membres',   label: '👥 Membres',          file: 'membres.html'   },
    { key: 'salons',    label: '💬 Salons',            file: 'salons.html'    },
    { key: 'graphe',    label: '🕸️ Graphe',            file: 'graphe.html'    },
    { key: 'sondages',  label: '🗳️ Sondages',          file: 'sondages.html'  },
  ];

  nav.innerHTML = `
    <div class="sidebar-header">
      <span class="sidebar-logo">📊</span>
      <span class="sidebar-title">Data Discord</span>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section">Serveurs</div>
      <a href="/data-discord/" class="sidebar-link${pageName === 'index' ? ' active' : ''}">🏠 Accueil</a>

      ${servers.map(s => {
        const isActive = guildId === s.id;
        const av = (s.icon_url || s.guild_icon_url)
          ? `<img src="${esc(s.icon_url || s.guild_icon_url)}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;flex-shrink:0">`
          : '<span>💬</span>';
        return `
          <a href="/data-discord/dashboard.html?id=${s.id}" class="sidebar-link${isActive ? ' server-active' : ''}">
            ${av}
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.nom)}</span>
          </a>
          ${isActive ? `<div style="margin-left:.75rem;padding-left:.75rem;border-left:2px solid rgba(255,255,255,.08);display:flex;flex-direction:column;gap:2px;margin-top:2px;margin-bottom:4px">
            ${subPages.map(p => `
              <a href="/data-discord/${p.file}?id=${s.id}" class="sidebar-link sidebar-sublink${pageName === p.key ? ' active' : ''}">
                ${p.label}
              </a>`).join('')}
          </div>` : ''}
        `;
      }).join('')}
    </nav>
    <div class="sidebar-footer">
      <a href="/" class="sidebar-home">← Accueil du site</a>
    </div>
  `;
}
