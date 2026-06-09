import { requireAuth } from "./auth.js";
import { getMembres, getVoteActif, getLivres, soumettreVote } from "./db.js";
import { formatMois } from "./utils.js";

await requireAuth();

// ── Constantes ─────────────────────────────────────────────────────────────
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const PALETTE = ["#b5572d","#3f7a52","#6840d8","#bf8a2f","#5a7d8c","#a8503f","#3f5340","#8a5a6b","#46708a","#9a6a2f"];

const IC = {
  check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  ballot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m9 13 2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg>',
  cal:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function ini(nom) { return (nom || "?").slice(0, 2); }
function avaColor(i) { return PALETTE[i % PALETTE.length]; }

function showToast(msg, ok = true) {
  const t = document.getElementById("toast");
  t.innerHTML = (ok ? IC.check : "") + esc(msg);
  t.classList.add("show");
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => t.classList.remove("show"), 2600);
}

// ── État global ────────────────────────────────────────────────────────────
let voteActif = null, membres = [], livres = [];
const membreById = {}, livreById = {};

let moi = null;       // membre_id sélectionné
let moiNom = "";
let notes = {};       // {livre_id: 1..5}
let lus = new Set();  // livre_ids "déjà lu, je passe"
let dejaSoumis = false;

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  [voteActif, membres, livres] = await Promise.all([
    getVoteActif(), getMembres(), getLivres(),
  ]);
  membres.forEach((m, i) => { m._color = avaColor(i); membreById[m.id] = m; });
  livres.forEach(l => { livreById[l.id] = l; });
  render();
}

// ── Rendu principal ────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById("ballot-root");
  if (!voteActif) {
    renderUpcoming(root);
  } else {
    renderActive(root);
  }
}

// ── État à venir ───────────────────────────────────────────────────────────
function renderUpcoming(root) {
  const today = new Date();
  const next  = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nom   = MOIS_FR[next.getMonth()];
  const nomCap = nom.charAt(0).toUpperCase() + nom.slice(1);
  const jours = Math.max(1, Math.ceil((next - today) / 86400000));

  root.innerHTML = `
    <div class="ballot-letterhead">
      <div class="ballot-club">Club de lecture</div>
      <div class="ballot-h1">Bulletin de <span class="rature">vote</span></div>
      <div class="ballot-sub" id="ballot-sub">Prochain scrutin · ouverture le 1ᵉʳ ${nom}</div>
    </div>

    <div class="vbanner up">
      <div class="vbanner-ico">${IC.cal}</div>
      <div class="vbanner-body">
        <div class="vbanner-title">Prochain vote — ${nomCap} ${next.getFullYear()}</div>
        <div class="vbanner-sub">Ouverture automatique le 1ᵉʳ ${nom}</div>
      </div>
      <div class="vbanner-count">${jours}<small> j. avant l'ouverture</small></div>
    </div>

    <div class="vsec-title"><span class="vsec-num">1</span>Les livres en compétition</div>
    <div class="infos-bar">
      <label class="toggle-switch" style="margin:0"><input type="checkbox" id="infos-toggle"><span class="toggle-slider"></span></label>
      <span><b>Afficher les infos</b> — genre, pages, description</span>
    </div>
    <div class="vbooks" id="vbooks"></div>

    <div class="vsec-title"><span class="vsec-num">2</span>Aperçu du bulletin</div>
    <div class="preview-note">${IC.cal}<span>Le vote s'ouvrira <b>automatiquement le 1ᵉʳ ${nom}</b>. Voici à quoi ressemblera le bulletin — la notation sera alors active et vous pourrez vous identifier.</span></div>
    <div class="rules">Notez chaque livre de <b>1 à 5</b> selon votre envie de le lire. Le score d'un livre = <span class="key">(moyenne + médiane) ÷ 2</span>, ce qui atténue les notes extrêmes. Le plus haut score est <b>élu</b> ; tout score <span class="key">≤ 2,9</span> élimine le livre.</div>
    <div class="grade-scale"><span><b>1</b> — envie minimale</span><span><b>5</b> — envie maximale</span></div>
    ${buildVoteTable([], true)}`;

  bindInfosToggle();
  renderBooks();
}

// ── Vote actif ─────────────────────────────────────────────────────────────
function renderActive(root) {
  const livreIds  = voteActif.livre_ids  || [];
  const membreIds = voteActif.membre_ids || [];
  const bulletins = voteActif.bulletins  || {};
  const nbVotes   = Object.keys(bulletins).length;
  const total     = membreIds.length;
  const expiry    = voteActif.expires_at?.toDate ? voteActif.expires_at.toDate() : null;

  root.innerHTML = `
    <div class="ballot-letterhead">
      <div class="ballot-club">Club de lecture</div>
      <div class="ballot-h1">Bulletin de <span class="rature">vote</span></div>
      <div class="ballot-sub">Scrutin de ${formatMois(voteActif.mois, voteActif.annee)} · notez les livres en compétition</div>
    </div>

    <div class="vbanner">
      <div class="vbanner-ico">${IC.ballot}</div>
      <div class="vbanner-body">
        <div class="vbanner-title">Vote en cours — ${formatMois(voteActif.mois, voteActif.annee)}</div>
        <div class="vbanner-sub" id="b-sub"><b>${livreIds.length} livre${livreIds.length !== 1 ? "s" : ""}</b> en compétition${expiry ? ` · clôture le ${expiry.toLocaleDateString("fr-FR")}` : ""}</div>
      </div>
      <div class="vbanner-count" id="b-count">${nbVotes}<small>/${total} votes</small></div>
    </div>

    <div class="vsec-title"><span class="vsec-num">1</span>Les livres en compétition</div>
    <div class="infos-bar">
      <label class="toggle-switch" style="margin:0"><input type="checkbox" id="infos-toggle"><span class="toggle-slider"></span></label>
      <span><b>Afficher les infos</b> — genre, pages, description</span>
    </div>
    <div class="vbooks" id="vbooks"></div>

    <div class="vsec-title" id="sec-ident"><span class="vsec-num">2</span>Qui êtes-vous ?</div>
    <div id="ident-mount"></div>

    <div id="vote-mount"></div>

    <div class="bilan" id="bilan-sec">
      <div class="bilan-title">Émargement — <span id="bilan-count"></span></div>
      <div class="bilan-grid" id="bilan-grid"></div>
    </div>`;

  bindInfosToggle();
  renderBooks();
  renderIdent();
  renderBilan();
}

// ── Infos toggle ───────────────────────────────────────────────────────────
function bindInfosToggle() {
  document.getElementById("infos-toggle")?.addEventListener("change", e => {
    document.getElementById("vbooks")?.classList.toggle("infos-on", e.target.checked);
  });
}

// ── Grille de livres ───────────────────────────────────────────────────────
function renderBooks() {
  const livreIds = voteActif?.livre_ids || [];
  const books = livreIds.map(id => livreById[id]).filter(Boolean);

  document.getElementById("vbooks").innerHTML = books.map(b => `
    <div class="vbook">
      <div class="vbook-t">${esc(b.titre)}</div>
      <div class="vbook-a">${esc(b.auteur ?? "")}</div>
      <div class="vbook-info">
        ${b.genre ? `<span class="vbook-genre">${esc(b.genre)}</span>` : ""}
        ${b.nb_pages ? `<span class="vbook-pages">${esc(b.nb_pages)} p.</span>` : ""}
        ${b.description_3_mots ? `<span class="vbook-desc">${esc(b.description_3_mots)}</span>` : ""}
      </div>
    </div>`).join("");
}

// ── Identification ─────────────────────────────────────────────────────────
function renderIdent() {
  const mount = document.getElementById("ident-mount");
  if (!mount) return;
  const bulletins  = voteActif?.bulletins  || {};
  const membreIds  = voteActif?.membre_ids || [];

  if (!moi) {
    mount.innerHTML = `
      <div class="ident">
        <label for="who">Sélectionnez votre nom :</label>
        <select id="who">
          <option value="">— Choisir —</option>
          ${membreIds.map(id => {
            const m = membreById[id] || { nom: id };
            const voted = !!bulletins[id];
            return `<option value="${id}">${esc(m.nom)}${voted ? " (a déjà voté)" : ""}</option>`;
          }).join("")}
        </select>
        <button class="btn btn-primary" id="who-go">Continuer ${IC.arrowR}</button>
      </div>`;
    document.getElementById("who-go").addEventListener("click", () => {
      const v = document.getElementById("who").value;
      if (!v) { showToast("Choisissez votre nom dans la liste.", false); return; }
      moi = v;
      moiNom = membreById[v]?.nom ?? v;
      notes = {}; lus = new Set(); dejaSoumis = false;
      // Pré-remplir si déjà voté
      const prev = bulletins[moi];
      if (prev) {
        dejaSoumis = true;
        Object.entries(prev).forEach(([lid, n]) => { if (n != null) notes[lid] = Number(n); });
      }
      renderIdent();
      renderVote();
    });
    document.getElementById("vote-mount").innerHTML = "";
  } else {
    const m = membreById[moi] || { nom: moi, _color: "#888" };
    mount.innerHTML = `
      <div class="voter-tag">
        <span class="ava" style="width:22px;height:22px;border-radius:50%;display:inline-grid;place-items:center;font-size:.62rem;font-weight:700;color:#fff;background:${m._color}">${ini(m.nom)}</span>
        Bulletin de <b>${esc(m.nom)}</b>
        <button class="chg" id="who-change">changer</button>
      </div>`;
    document.getElementById("who-change").addEventListener("click", () => {
      moi = null; moiNom = ""; notes = {}; lus = new Set();
      renderIdent();
    });
  }
}

// ── Table de notation ──────────────────────────────────────────────────────
function renderVote() {
  const mount = document.getElementById("vote-mount");
  if (!mount || !moi) { if (mount) mount.innerHTML = ""; return; }

  const livreIds = voteActif.livre_ids || [];
  const bulletins = voteActif.bulletins || {};

  mount.innerHTML = `
    <div class="vsec-title"><span class="vsec-num">3</span>Votre notation</div>
    <div class="rules">
      Notez chaque livre de <b>1 à 5</b> selon votre envie de le lire. Le score d'un livre = <span class="key">(moyenne + médiane) ÷ 2</span>, ce qui atténue les notes extrêmes. Le plus haut score est <b>élu</b> ; tout score <span class="key">≤ 2,9</span> élimine le livre. Déjà lu un titre ? Cochez « je passe » pour l'exclure de votre vote.
    </div>
    <div class="grade-scale"><span><b>1</b> — envie minimale</span><span><b>5</b> — envie maximale</span></div>
    ${buildVoteTable(livreIds, false)}
    <div class="submit-row">
      <span class="submit-hint">${dejaSoumis ? "Vous aviez déjà voté — soumettre écrasera votre bulletin précédent." : "Une note par livre (ou « je passe ») est requise."}</span>
      <button class="btn btn-primary btn-lg" id="submit">${IC.check} Glisser dans l'urne</button>
    </div>`;

  // Restaurer les notes existantes
  livreIds.forEach(lid => {
    if (notes[lid] != null) {
      highlightDots(lid, notes[lid]);
    }
    if (lus.has(lid)) {
      const cb = document.querySelector(`.read-cb[data-bk="${lid}"]`);
      if (cb) cb.checked = true;
      const row = document.querySelector(`.vrow[data-bk="${lid}"]`);
      if (row) row.classList.add("read");
    }
  });

  wireDots();
  wireReadCheckboxes();
  document.getElementById("submit").addEventListener("click", submitVote);
}

function buildVoteTable(livreIds, preview) {
  const books = livreIds.map(id => livreById[id]).filter(Boolean);
  // For preview (à venir), show placeholder rows
  const rows = preview
    ? `<tr class="vrow"><td class="bkc" colspan="7" style="color:var(--muted);font-size:.82rem;padding:.8rem .4rem">Les livres seront affichés à l'ouverture du scrutin.</td></tr>`
    : books.map(b => {
        const dots = [1,2,3,4,5].map(n =>
          `<td class="numcol"><span class="dot" data-bk="${b.id}" data-n="${n}" role="button" aria-label="${n} sur 5" tabindex="0"></span></td>`
        ).join("");
        return `<tr class="vrow" data-bk="${b.id}">
          <td class="bkc"><span class="vt-titre">${esc(b.titre)}</span> <span class="vt-auteur">— ${esc(b.auteur ?? "")}</span></td>
          ${dots}
          <td class="readcol"><label class="read-toggle"><input type="checkbox" class="read-cb" data-bk="${b.id}"> déjà lu, je passe</label></td>
        </tr>`;
      }).join("");

  return `
    <table class="vtable2${preview ? " preview" : ""}">
      <thead><tr>
        <th class="bkc"></th>
        ${[1,2,3,4,5].map(n => `<th class="numcol"><span class="n">${n}</span>${n <= 2 ? '<span class="elim">élim.</span>' : ""}</th>`).join("")}
        <th class="readcol"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function highlightDots(lid, val) {
  document.querySelectorAll(`.dot[data-bk="${lid}"]`).forEach(d => {
    d.classList.toggle("on", +d.dataset.n === val);
  });
}

function wireDots() {
  document.querySelectorAll(".dot").forEach(d => {
    d.addEventListener("click", () => {
      const lid = d.dataset.bk, n = +d.dataset.n;
      if (lus.has(lid)) return;
      notes[lid] = n;
      highlightDots(lid, n);
    });
    d.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); d.click(); }
    });
  });
}

function wireReadCheckboxes() {
  document.querySelectorAll(".read-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      const lid = cb.dataset.bk;
      const row = cb.closest(".vrow");
      if (cb.checked) {
        lus.add(lid);
        delete notes[lid];
        highlightDots(lid, -1);
      } else {
        lus.delete(lid);
      }
      row.classList.toggle("read", cb.checked);
    });
  });
}

// ── Bilan participation ────────────────────────────────────────────────────
function renderBilan() {
  const membreIds = voteActif?.membre_ids || [];
  const bulletins = voteActif?.bulletins  || {};
  const nbVotes   = Object.keys(bulletins).length;
  const total     = membreIds.length;

  const count = document.getElementById("bilan-count");
  const grid  = document.getElementById("bilan-grid");
  if (!count || !grid) return;

  count.textContent = `${nbVotes} / ${total} bulletins reçus`;
  grid.innerHTML = membreIds.map(id => {
    const m = membreById[id] || { nom: id, _color: "#888" };
    const v = !!bulletins[id];
    return `<span class="bilan-tag ${v ? "ok" : "no"}">
      <span class="ava" style="background:${m._color}">${ini(m.nom)}</span>${esc(m.nom)}
      <span class="ck">${IC.check}</span>
    </span>`;
  }).join("");
}

// ── Soumission ─────────────────────────────────────────────────────────────
async function submitVote() {
  if (!moi) { showToast("Choisissez votre nom.", false); return; }
  const livreIds = voteActif.livre_ids || [];
  const manquants = livreIds.filter(id => !lus.has(id) && notes[id] == null);
  if (manquants.length) {
    showToast(`Notez chaque livre (${manquants.length} manquant${manquants.length > 1 ? "s" : ""}).`, false);
    return;
  }

  const btn = document.getElementById("submit");
  if (btn) { btn.disabled = true; btn.textContent = "Envoi…"; }

  try {
    await soumettreVote(voteActif.id, moi, notes);
    // Mettre à jour les bulletins localement
    if (!voteActif.bulletins) voteActif.bulletins = {};
    voteActif.bulletins[moi] = { ...notes };

    // Mettre à jour le compteur dans la bannière
    const bCount = document.getElementById("b-count");
    if (bCount) {
      const nb = Object.keys(voteActif.bulletins).length;
      const tot = (voteActif.membre_ids || []).length;
      bCount.innerHTML = `${nb}<small>/${tot} votes</small>`;
    }

    renderBilan();
    if (btn) {
      btn.innerHTML = `${IC.check} Bulletin enregistré`;
      btn.style.opacity = ".65";
    }
    dejaSoumis = true;
    const hint = document.querySelector(".submit-hint");
    if (hint) hint.textContent = "Vous aviez déjà voté — soumettre écrasera votre bulletin précédent.";
    showToast("Bulletin glissé dans l'urne — merci !");
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = `${IC.check} Glisser dans l'urne`; }
    showToast("Erreur : " + err.message, false);
  }
}

init().catch(console.error);
