import { requireAuth }    from "./auth.js";
import { initNav }        from "./nav.js";
import { showToast }      from "./utils.js";
import {
  getLivreById, getMembres, updateLivre,
  getCommentairesForLivre, addCommentaire, updateCommentaire,
} from "./db.js";

await requireAuth();

// ── URL params ────────────────────────────────────────────────────────────────
const PARAMS   = new URLSearchParams(location.search);
const LIVRE_ID = PARAMS.get("livre");
const OPEN_ADD = PARAMS.get("new") === "1";

if (!LIVRE_ID) {
  location.href = "bibliotheque.html";
  throw new Error("Aucun livre spécifié.");
}

// ── Icônes ────────────────────────────────────────────────────────────────────
const IC = {
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  bubble: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
};

// ── Palette & couleurs ────────────────────────────────────────────────────────
const PALETTE = [
  "#b5572d","#3f7a52","#6840d8","#bf8a2f","#5a7d8c",
  "#a8503f","#3f5340","#8a5a6b","#46708a","#9a6a2f",
];
const COVER_TINTS = [
  ["#3f5340","#273829"],["#7a3b2e","#56281f"],["#39505c","#25363d"],
  ["#8a6a2f","#5b4420"],["#5a4636","#382a20"],["#4a4038","#2f2822"],
  ["#6b4a52","#432d36"],["#4a5a6b","#2d3842"],["#6b5a3e","#433822"],
  ["#3f4a3f","#262f26"],["#6b3f4a","#42262d"],["#5a6b4a","#37422e"],
];

function bookTint(id = "") {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COVER_TINTS[h % COVER_TINTS.length];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function initiales(nom) {
  if (!nom) return "?";
  return nom.trim().split(/\s+/).map(p => p[0].toUpperCase()).slice(0, 2).join("");
}

function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts === "string") return new Date(ts);
  return new Date(ts);
}

function fmtDate(ts) {
  const d = tsToDate(ts);
  if (!d) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toISO(ts) {
  const d = tsToDate(ts);
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

// ── État ──────────────────────────────────────────────────────────────────────
let livre        = null;
let membres      = [];
let commentaires = [];
const membreById      = {};
const membreColorById = {};
let filterMembreId = "";

// ── Suivi ─────────────────────────────────────────────────────────────────────
const trackUnit = () => livre?.progression_unite || "pages";
const trackMax  = () => Number(livre?.progression_total) || 0;
function pctOf(avancement) {
  const max = trackMax();
  if (!max || avancement == null) return 0;
  return Math.min(100, Math.round((avancement / max) * 100));
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  initNav("bibliotheque");

  [livre, membres, commentaires] = await Promise.all([
    getLivreById(LIVRE_ID),
    getMembres(),
    getCommentairesForLivre(LIVRE_ID),
  ]);

  membres.forEach((m, i) => {
    membreById[m.id]      = m;
    membreColorById[m.id] = PALETTE[i % PALETTE.length];
  });

  renderHeader();
  renderFilter();
  renderList();

  // Boutons
  document.getElementById("btn-add").addEventListener("click", () => openAdd());
  document.getElementById("btn-config").addEventListener("click", openCfg);
  document.getElementById("com-filter").addEventListener("change", e => {
    filterMembreId = e.target.value;
    renderList();
  });

  // Fermeture overlays au clic extérieur
  ["add-overlay", "edit-overlay", "cfg-overlay"].forEach(id => {
    document.getElementById(id).addEventListener("click", e => {
      if (e.target.id === id) {
        if (id === "add-overlay")  closeAdd();
        if (id === "edit-overlay") closeEdit();
        if (id === "cfg-overlay")  closeCfg();
      }
    });
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeAdd(); closeEdit(); closeCfg(); }
  });

  if (OPEN_ADD) openAdd();
}

// ── En-tête ───────────────────────────────────────────────────────────────────
function renderHeader() {
  const [g1, g2] = bookTint(LIVRE_ID);
  const cov = document.getElementById("com-cover");
  cov.style.setProperty("--g1", g1);
  cov.style.setProperty("--g2", g2);
  document.getElementById("com-cover-t").textContent = livre?.titre ?? "";
  document.getElementById("com-book").textContent    = livre?.titre ?? "—";
  document.title = `${livre?.titre ?? "Commentaires"} — Lis tes ratures`;
  renderTrackInfo();
}

function renderTrackInfo() {
  const unit = trackUnit(), max = trackMax();
  document.getElementById("track-info").innerHTML = max
    ? `Suivi en <b>${esc(unit)}</b> · <b>${max}</b> max`
    : `<span style="color:var(--muted)">Aucun suivi configuré</span>`;
}

// ── Filtre membre ─────────────────────────────────────────────────────────────
function renderFilter() {
  const ids = [...new Set(commentaires.map(c => c.membre_id))];
  const sel = document.getElementById("com-filter");
  sel.innerHTML = `<option value="">Tous les membres</option>` +
    ids.map(id => {
      const m = membreById[id];
      return m ? `<option value="${id}">${esc(m.nom)}</option>` : "";
    }).join("");
  sel.value = filterMembreId;
}

// ── Liste des commentaires ────────────────────────────────────────────────────
function renderList() {
  const list = commentaires
    .filter(c => !filterMembreId || c.membre_id === filterMembreId)
    .sort((a, b) => (a.avancement ?? 99999) - (b.avancement ?? 99999));

  const countEl = document.getElementById("com-count");
  countEl.textContent = `${list.length} note${list.length > 1 ? "s" : ""} de lecture`;

  const reading = document.getElementById("reading");

  if (!list.length) {
    reading.innerHTML = `<div class="com-empty">
      ${IC.bubble}
      <p>Aucun commentaire pour l'instant.<br>Sois le premier à laisser une note de lecture !</p>
    </div>`;
    return;
  }

  reading.innerHTML = list.map(c => cardHtml(c)).join("");

  // Toggle accordéon
  reading.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => btn.closest(".com").classList.toggle("open"));
  });

  // Bouton modifier
  reading.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const c = commentaires.find(x => x.id === btn.dataset.edit);
      if (c) openEdit(c);
    });
  });
}

function cardHtml(c) {
  const m     = membreById[c.membre_id];
  const nom   = m?.nom ?? "?";
  const color = membreColorById[c.membre_id] ?? "#8a5a3a";
  const p     = pctOf(c.avancement);
  const max   = trackMax();
  const unit  = trackUnit();

  const advHtml = c.avancement != null
    ? `<span class="com-prog-mini">
        ${max ? `<span class="com-prog-track">
          <span class="com-prog-fill" style="width:${p}%"></span>
        </span>` : ""}
        <span>${c.avancement}${max ? `/${max}` : ""} ${esc(unit)}</span>
       </span>`
    : "";

  const bodyHtml = c.contenu
    .split("\n")
    .filter(Boolean)
    .map(line => `<p>${esc(line)}</p>`)
    .join("");

  return `
  <div class="com" data-id="${c.id}">
    <div class="com-seal" style="--mc:${color};--p:${p}">
      <div class="com-seal-inner">${esc(initiales(nom))}</div>
    </div>
    <div class="com-card">
      <button class="com-head" data-toggle="${c.id}">
        <div class="com-id">
          <div class="com-who">
            <span class="name">${esc(nom)}</span>
            ${c.titre ? `<span class="title">· ${esc(c.titre)}</span>` : ""}
          </div>
          <div class="com-sub">${advHtml}</div>
        </div>
        <span class="com-date">${fmtDate(c.date_commentaire)}</span>
        <span class="com-chev">${IC.chevron}</span>
      </button>
      <div class="com-body">
        <div class="com-body-inner">
          <div class="com-text">${bodyHtml}</div>
          <button class="com-edit" data-edit="${c.id}">${IC.edit} Modifier</button>
        </div>
      </div>
    </div>
  </div>`;
}

// ── Modal : ajouter ───────────────────────────────────────────────────────────
function openAdd(prefillMembreId = null) {
  const opts   = membres.map(m =>
    `<option value="${m.id}"${m.id === prefillMembreId ? " selected" : ""}>${esc(m.nom)}</option>`
  ).join("");
  const max    = trackMax();
  const unit   = trackUnit();
  const uCap   = unit.charAt(0).toUpperCase() + unit.slice(1);
  const today  = new Date().toISOString().slice(0, 10);

  document.getElementById("add-paper").innerHTML = `
    <button class="paper-close" id="a-close">✕</button>
    <div class="paper-kicker">Carnet de lecture · ${esc(livre?.titre ?? "")}</div>
    <div class="paper-title">Laisser un commentaire</div>

    <div class="pf-group">
      <label>Membre <span class="req">*</span></label>
      <select class="pf-input" id="a-member">
        <option value="">— Choisir —</option>${opts}
      </select>
    </div>

    <div class="pf-row">
      <div class="pf-group">
        <label>Date</label>
        <input type="date" class="pf-input" id="a-date" value="${today}" />
      </div>
      ${max ? `<div class="pf-group">
        <label>${esc(uCap)} actuel·le <span class="opt">(optionnel)</span></label>
        <input type="number" class="pf-input" id="a-pos" min="0" max="${max}" placeholder="0–${max}" />
      </div>` : "<div></div>"}
    </div>

    <div class="pf-group">
      <label class="pf-check-label">
        <input type="checkbox" id="a-title-tog" />
        Ajouter un titre <span class="opt" style="margin-left:.15rem">(optionnel)</span>
      </label>
    </div>
    <div class="pf-group hidden" id="a-title-wrap">
      <input type="text" class="pf-input" id="a-title" placeholder="ex. Note du 24 juin" />
    </div>

    <div class="pf-group">
      <label>Commentaire <span class="req">*</span></label>
      <textarea class="pf-input" id="a-body"
        placeholder="Ton ressenti, tes hypothèses, tes émotions…"></textarea>
    </div>

    <div class="pf-foot">
      <button class="pf-btn cancel" id="a-cancel">Annuler</button>
      <button class="pf-btn ok"     id="a-ok">Publier</button>
    </div>`;

  document.getElementById("add-overlay").classList.remove("hidden");
  document.getElementById("add-paper").scrollTop = 0;

  document.getElementById("a-close").addEventListener("click",  closeAdd);
  document.getElementById("a-cancel").addEventListener("click", closeAdd);
  document.getElementById("a-ok").addEventListener("click",     submitAdd);
  document.getElementById("a-title-tog").addEventListener("change", e => {
    document.getElementById("a-title-wrap").classList.toggle("hidden", !e.target.checked);
  });
}

async function submitAdd() {
  const membre_id = document.getElementById("a-member").value;
  const contenu   = document.getElementById("a-body").value.trim();
  if (!membre_id) { showToast("Choisis un membre.", "error");         return; }
  if (!contenu)   { showToast("Le commentaire est vide.", "error");   return; }

  const date_commentaire = document.getElementById("a-date").value || new Date().toISOString().slice(0, 10);
  const posEl            = document.getElementById("a-pos");
  const avancement       = posEl?.value !== "" && posEl?.value != null ? Number(posEl.value) : null;
  const titleTog         = document.getElementById("a-title-tog").checked;
  const titre            = titleTog ? (document.getElementById("a-title").value.trim() || null) : null;

  try {
    await addCommentaire({ livre_id: LIVRE_ID, membre_id, date_commentaire, avancement, titre, contenu });
    commentaires = await getCommentairesForLivre(LIVRE_ID);
    renderFilter();
    renderList();
    closeAdd();
    showToast("Commentaire publié.", "success");
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

function closeAdd() { document.getElementById("add-overlay").classList.add("hidden"); }

// ── Modal : modifier ──────────────────────────────────────────────────────────
function openEdit(c) {
  const m    = membreById[c.membre_id];
  const max  = trackMax();
  const unit = trackUnit();
  const uCap = unit.charAt(0).toUpperCase() + unit.slice(1);

  document.getElementById("edit-paper").innerHTML = `
    <button class="paper-close" id="e-close">✕</button>
    <div class="paper-kicker">Carnet de lecture</div>
    <div class="paper-title">Modifier le commentaire</div>

    <div class="pf-group">
      <label>Membre</label>
      <div class="pf-input" style="pointer-events:none;opacity:.7;display:block">${esc(m?.nom ?? "—")}</div>
    </div>

    <div class="pf-row">
      <div class="pf-group">
        <label>Date</label>
        <input type="date" class="pf-input" id="e-date" value="${toISO(c.date_commentaire)}" />
      </div>
      ${max ? `<div class="pf-group">
        <label>${esc(uCap)} actuel·le</label>
        <input type="number" class="pf-input" id="e-pos" min="0" max="${max}" value="${c.avancement ?? ""}" />
      </div>` : "<div></div>"}
    </div>

    <div class="pf-group">
      <label>Titre <span class="opt">(optionnel)</span></label>
      <input type="text" class="pf-input" id="e-title" value="${esc(c.titre ?? "")}"
        placeholder="ex. Note du 24 juin" />
    </div>

    <div class="pf-group">
      <label>Commentaire <span class="req">*</span></label>
      <textarea class="pf-input" id="e-body">${esc(c.contenu)}</textarea>
    </div>

    <div class="pf-foot">
      <button class="pf-btn cancel" id="e-cancel">Annuler</button>
      <button class="pf-btn ok"     id="e-ok">Enregistrer</button>
    </div>`;

  document.getElementById("edit-overlay").classList.remove("hidden");
  document.getElementById("edit-paper").scrollTop = 0;

  document.getElementById("e-close").addEventListener("click",  closeEdit);
  document.getElementById("e-cancel").addEventListener("click", closeEdit);
  document.getElementById("e-ok").addEventListener("click", async () => {
    const contenu = document.getElementById("e-body").value.trim();
    if (!contenu) { showToast("Le commentaire est vide.", "error"); return; }
    const date_commentaire = document.getElementById("e-date").value;
    const posEl    = document.getElementById("e-pos");
    const avancement = posEl?.value !== "" && posEl?.value != null ? Number(posEl.value) : null;
    const titre    = document.getElementById("e-title").value.trim() || null;
    try {
      await updateCommentaire(c.id, { contenu, titre, date_commentaire, avancement });
      commentaires = await getCommentairesForLivre(LIVRE_ID);
      renderList();
      closeEdit();
      showToast("Commentaire mis à jour.", "success");
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  });
}

function closeEdit() { document.getElementById("edit-overlay").classList.add("hidden"); }

// ── Modal : configurer le suivi ───────────────────────────────────────────────
function openCfg() {
  const unit = trackUnit();
  const max  = trackMax();

  document.getElementById("cfg-paper").innerHTML = `
    <button class="paper-close" id="c-close">✕</button>
    <div class="paper-kicker">Carnet de lecture</div>
    <div class="paper-title">Configurer le suivi</div>

    <div class="pf-group">
      <label>Unité de progression</label>
      <div class="pf-radio" id="c-radio">
        <label class="${unit === "pages" ? "on" : ""}">
          <input type="radio" name="unit" value="pages" ${unit === "pages" ? "checked" : ""} />
          En pages
        </label>
        <label class="${unit === "chapitres" ? "on" : ""}">
          <input type="radio" name="unit" value="chapitres" ${unit === "chapitres" ? "checked" : ""} />
          En chapitres
        </label>
      </div>
    </div>

    <div class="pf-group">
      <label id="c-max-label">Nombre total de ${esc(unit)}</label>
      <input type="number" class="pf-input" id="c-max" min="1"
        value="${max || ""}" placeholder="ex. 300" />
    </div>

    <div class="pf-foot">
      <button class="pf-btn cancel" id="c-cancel">Annuler</button>
      <button class="pf-btn ok"     id="c-ok">Enregistrer</button>
    </div>`;

  document.getElementById("cfg-overlay").classList.remove("hidden");
  document.getElementById("c-close").addEventListener("click",  closeCfg);
  document.getElementById("c-cancel").addEventListener("click", closeCfg);
  document.getElementById("c-ok").addEventListener("click",     submitCfg);

  document.querySelectorAll("#c-radio input").forEach(r => {
    r.addEventListener("change", () => {
      document.querySelectorAll("#c-radio label").forEach(l =>
        l.classList.toggle("on", l.querySelector("input").checked)
      );
      const selected = document.querySelector("#c-radio input:checked").value;
      document.getElementById("c-max-label").textContent = "Nombre total de " + selected;
    });
  });
}

async function submitCfg() {
  const unit = document.querySelector("#c-radio input:checked").value;
  const max  = parseInt(document.getElementById("c-max").value) || 0;
  if (!max) { showToast("Saisir un total valide.", "error"); return; }
  try {
    await updateLivre(LIVRE_ID, { progression_unite: unit, progression_total: max });
    livre = { ...livre, progression_unite: unit, progression_total: max };
    renderTrackInfo();
    renderList();   // recalcule les barres de progression
    closeCfg();
    showToast("Suivi configuré.", "success");
  } catch (err) {
    showToast("Erreur : " + err.message, "error");
  }
}

function closeCfg() { document.getElementById("cfg-overlay").classList.add("hidden"); }

// ── Démarrage ─────────────────────────────────────────────────────────────────
init().catch(err => {
  console.error("[commentaires]", err);
  document.getElementById("reading").innerHTML =
    `<p style="color:var(--accent);font-family:monospace;font-size:.85rem">
      Erreur de chargement : ${esc(err.message)}
    </p>`;
});
