import { db } from '../firebase-config.js';
import { collection, getDocs, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const PAGES = [
  { id: "accueil",  label: "🏠 Accueil",  href: "/jdr/" },
  { id: "archives", label: "📁 Archives", href: "/jdr/archives.html" },
  { id: "outils",   label: "🛠️ Outils",   href: "/jdr/outils.html" },
];

function escH(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function initNav(activePage) {
  const saved = localStorage.getItem("jdr_theme");
  if (saved === "light") document.documentElement.setAttribute("data-theme", "light");
  const isLight = () => document.documentElement.getAttribute("data-theme") === "light";

  const activeCampagneId = new URLSearchParams(window.location.search).get('id');

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
    <div class="sidebar-sep"></div>
    <div class="sidebar-section-header">
      <span>Projets</span>
      <button id="btn-new-campagne" class="sidebar-add-btn" title="Nouveau projet">+</button>
    </div>
    <ul class="sidebar-nav" id="sidebar-campagnes">
      <li class="sidebar-loading">Chargement…</li>
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

  document.getElementById("btn-new-campagne").addEventListener("click", openNewCampagneModal);
  loadCampagnes(activeCampagneId);
}

async function loadCampagnes(activeCampagneId) {
  const ul = document.getElementById("sidebar-campagnes");
  if (!ul) return;
  try {
    const snap = await getDocs(collection(db, 'jdr_campagnes'));
    const campagnes = [];
    snap.forEach(d => campagnes.push({ id: d.id, ...d.data() }));
    campagnes.sort((a, b) => (a.cree_le?.seconds ?? 0) - (b.cree_le?.seconds ?? 0));

    if (campagnes.length === 0) {
      ul.innerHTML = `<li class="sidebar-empty">Aucun projet</li>`;
      return;
    }
    ul.innerHTML = campagnes.map(c => `
      <li>
        <a href="/jdr/campagne.html?id=${c.id}"
           class="nav-link nav-link-campagne${c.id === activeCampagneId ? " active" : ""}">
          <span>${escH(c.emoji || '🎲')}</span>
          <span class="camp-nav-name">${escH(c.nom)}</span>
        </a>
      </li>`).join('');
  } catch(e) {
    ul.innerHTML = `<li class="sidebar-empty">—</li>`;
  }
}

function openNewCampagneModal() {
  document.getElementById("new-camp-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "new-camp-overlay";
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <h2 class="modal-title">Nouveau projet</h2>
        <button class="modal-close" id="nco-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label class="form-label">Émoji</label>
          <input id="nco-emoji" class="form-input" type="text" value="🎲" maxlength="2"
                 style="width:64px;text-align:center;font-size:1.4rem">
        </div>
        <div class="form-row">
          <label class="form-label">Nom <span style="color:var(--accent2)">*</span></label>
          <input id="nco-nom" class="form-input" type="text" placeholder="Ex: La Tour Maudite">
        </div>
        <div id="nco-error" style="color:var(--accent2);font-size:.82rem;min-height:1.2em"></div>
      </div>
      <div class="form-actions">
        <button class="btn-ghost btn-sm" id="nco-cancel">Annuler</button>
        <button class="btn-primary btn-sm" id="nco-save">Créer →</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  document.getElementById("nco-close").addEventListener("click", close);
  document.getElementById("nco-cancel").addEventListener("click", close);

  const nomInput = document.getElementById("nco-nom");
  nomInput.focus();
  nomInput.addEventListener("keydown", e => { if (e.key === "Enter") save(); });
  document.getElementById("nco-save").addEventListener("click", save);

  async function save() {
    const nom   = document.getElementById("nco-nom").value.trim();
    const emoji = document.getElementById("nco-emoji").value.trim() || "🎲";
    const errEl = document.getElementById("nco-error");
    if (!nom) { errEl.textContent = "Le nom est requis."; return; }

    const btn = document.getElementById("nco-save");
    btn.disabled = true; btn.textContent = "Création…";
    try {
      const ref = await addDoc(collection(db, "jdr_campagnes"), {
        nom, emoji, cree_le: serverTimestamp()
      });
      close();
      window.location.href = `/jdr/campagne.html?id=${ref.id}`;
    } catch(ex) {
      errEl.textContent = "Erreur : " + ex.message;
      btn.disabled = false; btn.textContent = "Créer →";
    }
  }
}
