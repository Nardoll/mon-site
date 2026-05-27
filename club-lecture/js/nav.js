export function initNav(active) {
  const nav = document.getElementById("sidebar");
  if (!nav) return;

  // Appliquer le thème sauvegardé avant tout rendu
  const savedTheme = localStorage.getItem("cl_theme");
  if (savedTheme === "light") document.documentElement.dataset.theme = "light";

  const pages = [
    { id: "accueil",      href: "/club-lecture/",                  icon: "🏠", label: "Accueil" },
    { id: "bibliotheque", href: "/club-lecture/bibliotheque.html", icon: "📚", label: "Bibliothèque" },
    { id: "votes",        href: "/club-lecture/votes.html",        icon: "🗳️",  label: "Votes" },
    { id: "membres",      href: "/club-lecture/membres.html",      icon: "👥", label: "Membres" },
    { id: "reunions",     href: "/club-lecture/reunions.html",     icon: "📝", label: "Réunions" },
    { id: "stats",        href: "/club-lecture/stats.html",        icon: "📊", label: "Statistiques" },
  ];

  const isLight = document.documentElement.dataset.theme === "light";

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
    <div class="sidebar-bottom">
      <a href="/" class="sidebar-home-link">
        <span>🏠</span>
        <span>Accueil du site</span>
      </a>
      <button class="theme-toggle" id="theme-toggle">
        <span id="theme-icon">${isLight ? "🌙" : "☀️"}</span>
        <span id="theme-label">${isLight ? "Mode sombre" : "Mode clair"}</span>
      </button>
    </div>
  `;

  document.getElementById("theme-toggle").addEventListener("click", () => {
    const light = document.documentElement.dataset.theme !== "light";
    document.documentElement.dataset.theme = light ? "light" : "";
    localStorage.setItem("cl_theme", light ? "light" : "dark");
    document.getElementById("theme-icon").textContent  = light ? "🌙" : "☀️";
    document.getElementById("theme-label").textContent = light ? "Mode sombre" : "Mode clair";
  });
}
