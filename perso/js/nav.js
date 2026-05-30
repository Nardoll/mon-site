export function initNav(active) {
  const nav = document.getElementById("sidebar");
  if (!nav) return;

  const savedTheme = localStorage.getItem("perso_theme");
  if (savedTheme === "light") document.documentElement.dataset.theme = "light";

  const pages = [
    { id: "accueil",   href: "/perso/",             icon: "🏠", label: "Accueil" },
    { id: "migraines", href: "/perso/migraines.html", icon: "👁️", label: "Migraines" },
  ];

  const isLight = document.documentElement.dataset.theme === "light";

  nav.innerHTML = `
    <div class="sidebar-logo">
      <h2>🔒 Espace perso</h2>
      <p>Accès privé</p>
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
    localStorage.setItem("perso_theme", light ? "light" : "dark");
    document.getElementById("theme-icon").textContent  = light ? "🌙" : "☀️";
    document.getElementById("theme-label").textContent = light ? "Mode sombre" : "Mode clair";
  });
}
