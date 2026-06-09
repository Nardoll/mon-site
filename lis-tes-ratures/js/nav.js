const ICONS = {
  accueil:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>',
  bibliotheque:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h6v16H6a1 1 0 0 1-1-1z"/><path d="M11 4h2.5l3.5.6-2.2 14-3.8-.6z"/><path d="M19 20H6"/></svg>',
  votes:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 13 2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg>',
  membres:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.7-4.7"/></svg>',
  reunions:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 10h7M8 14h5"/></svg>',
  stats:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V4M4 20h16"/><rect x="8" y="11" width="3" height="6" rx=".5"/><rect x="14" y="7" width="3" height="10" rx=".5"/></svg>',
  home:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>',
};

const PAGES = [
  { id: "accueil",      href: "/lis-tes-ratures/",                       label: "Accueil" },
  { id: "bibliotheque", href: "/lis-tes-ratures/bibliotheque.html",      label: "Bibliothèque" },
  { id: "votes",        href: "/lis-tes-ratures/votes.html",             label: "Votes" },
  { id: "membres",      href: "/lis-tes-ratures/membres.html",           label: "Membres" },
  { id: "reunions",     href: "/lis-tes-ratures/reunions.html",          label: "Réunions" },
  { id: "stats",        href: "/lis-tes-ratures/statistiques.html",      label: "Statistiques" },
];

export function initNav(active) {
  const nav = document.getElementById("sidebar");
  if (!nav) return;

  // Thème : light par défaut (nouvelle DA), persisté sous "ltr_theme"
  const saved = localStorage.getItem("ltr_theme");
  document.documentElement.dataset.theme = saved === "dark" ? "dark" : "light";

  const isDark = document.documentElement.dataset.theme === "dark";

  nav.innerHTML = `
    <div class="sidebar-logo">
      <h2>Lis tes <span class="rature">ratures</span></h2>
      <p>Club de lecture · espace privé</p>
    </div>
    ${PAGES.map(p => `
      <a href="${p.href}" class="nav-item ${p.id === active ? "active" : ""}">
        <span class="nav-icon">${ICONS[p.id]}</span>${p.label}
      </a>
    `).join("")}
    <div class="sidebar-bottom">
      <a href="/" class="sidebar-home-link">
        <span class="nav-icon">${ICONS.home}</span>
        <span>Accueil du site</span>
      </a>
      <button class="theme-toggle" id="theme-toggle">
        <span id="theme-icon">${isDark ? "☀️" : "🌙"}</span>
        <span id="theme-label">${isDark ? "Mode clair" : "Mode sombre"}</span>
      </button>
    </div>
  `;

  document.getElementById("theme-toggle").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("ltr_theme", dark ? "dark" : "light");
    document.getElementById("theme-icon").textContent  = dark ? "☀️" : "🌙";
    document.getElementById("theme-label").textContent = dark ? "Mode clair" : "Mode sombre";
  });
}
