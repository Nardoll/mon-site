export function initNav(active) {
  const nav = document.getElementById("sidebar");
  if (!nav) return;

  const pages = [
    { id: "accueil",      href: "/club-lecture/",              icon: "🏠", label: "Accueil" },
    { id: "bibliotheque", href: "/club-lecture/bibliotheque.html", icon: "📚", label: "Bibliothèque" },
    { id: "votes",        href: "/club-lecture/votes.html",       icon: "🗳️",  label: "Votes" },
    { id: "membres",      href: "/club-lecture/membres.html",     icon: "👥", label: "Membres" },
  ];

  nav.innerHTML = `
    <div class="sidebar-logo">
      <h2>📖 Club de lecture</h2>
      <p>Espace privé</p>
    </div>
    ${pages.map(p => `
      <a href="${p.href}" class="nav-item ${p.id === active ? "active" : ""}">
        <span class="nav-icon">${p.icon}</span>
        ${p.label}
      </a>
    `).join("")}
  `;
}
