const PAGES = [
  { id: "accueil",  label: "🏠 Accueil",  href: "/jdr/" },
  { id: "archives", label: "📁 Archives", href: "/jdr/archives.html" },
  { id: "outils",   label: "🛠️ Outils",   href: "/jdr/outils.html" },
];

export function initNav(activePage) {
  const saved = localStorage.getItem("jdr_theme");
  if (saved === "light") document.documentElement.setAttribute("data-theme", "light");

  const isLight = () => document.documentElement.getAttribute("data-theme") === "light";

  const sidebar = document.createElement("nav");
  sidebar.id = "sidebar";
  sidebar.className = "sidebar";
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-title">🎲 Jeux de rôle</div>
    </div>
    <ul class="sidebar-nav">
      ${PAGES.map(p => `
        <li><a href="${p.href}" class="nav-link${p.id === activePage ? " active" : ""}">${p.label}</a></li>
      `).join("")}
    </ul>
    <div class="sidebar-bottom">
      <a href="/" class="sidebar-home-link">🏠 Accueil du site</a>
      <button class="theme-toggle" id="theme-toggle">${isLight() ? "🌙 Thème sombre" : "☀️ Thème clair"}</button>
    </div>`;

  document.body.prepend(sidebar);

  document.getElementById("theme-toggle").addEventListener("click", () => {
    if (isLight()) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("jdr_theme", "dark");
      document.getElementById("theme-toggle").textContent = "☀️ Thème clair";
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("jdr_theme", "light");
      document.getElementById("theme-toggle").textContent = "🌙 Thème sombre";
    }
  });
}
