const ICONS = {
  accueil:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>',
  bibliotheque:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h6v16H6a1 1 0 0 1-1-1z"/><path d="M11 4h2.5l3.5.6-2.2 14-3.8-.6z"/><path d="M19 20H6"/></svg>',
  votes:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 13 2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg>',
  membres:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.7-4.7"/></svg>',
  reunions:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 10h7M8 14h5"/></svg>',
  stats:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V4M4 20h16"/><rect x="8" y="11" width="3" height="6" rx=".5"/><rect x="14" y="7" width="3" height="10" rx=".5"/></svg>',
  home:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>',
  cover:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 3v18"/><path d="M12 7h4M12 11h4"/></svg>',
};

// Clé sessionStorage du basculement « illustrations génériques ↔ vraies couvertures »
// (dupliquée depuis covers.js pour garder nav.js sans dépendance Firebase).
// ACTIVÉ par défaut à chaque session : on est « on » sauf "0" explicite.
const COVERS_KEY = "ltr_covers";
const coversIsOn = () => sessionStorage.getItem(COVERS_KEY) !== "0";

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

  // Thème : toujours clair
  document.documentElement.dataset.theme = "light";

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
      <button type="button" class="covers-toggle" id="covers-toggle" role="switch" title="Afficher les vraies couvertures des livres (récupérées en ligne)">
        <span class="nav-icon">${ICONS.cover}</span>
        <span class="covers-toggle-label">Vraies couvertures</span>
        <span class="covers-switch"><span class="covers-knob"></span></span>
      </button>
      <a href="/" class="sidebar-home-link">
        <span class="nav-icon">${ICONS.home}</span>
        <span>Accueil du site</span>
      </a>
    </div>
  `;

  // Toggle couvertures réelles
  const ct = document.getElementById("covers-toggle");
  if (ct) {
    const sync = () => ct.classList.toggle("is-on", coversIsOn());
    sync();
    ct.addEventListener("click", () => {
      const on = !coversIsOn();
      sessionStorage.setItem(COVERS_KEY, on ? "1" : "0");
      ct.setAttribute("aria-checked", on ? "true" : "false");
      sync();
      // Les pages écoutent cet événement pour re-render leurs couvertures
      document.dispatchEvent(new CustomEvent("ltr-covers-change", { detail: { on } }));
    });
    ct.setAttribute("aria-checked", coversIsOn() ? "true" : "false");
  }
}
