import { requireAuth } from "./auth.js";
import { getMembres, getLivres, getSondageDispo, updateSondageReponse } from "./db.js";

await requireAuth();

const PALETTE = ["#b5572d","#3f7a52","#6840d8","#bf8a2f","#5a7d8c","#a8503f","#3f5340","#8a5a6b","#46708a","#9a6a2f"];
const JFR    = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MFR_L  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const MFR_C  = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

const IC = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  cal:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.7-4.7"/></svg>',
  dispo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};

function esc(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function ini(nom) { return (nom || "?").slice(0,2).toUpperCase(); }

function showToast(msg, ok = true) {
  const t = document.getElementById("toast");
  t.innerHTML = (ok ? IC.check : "⚠") + " " + esc(msg);
  t.classList.add("show");
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => t.classList.remove("show"), 2800);
}

function formatJour(iso) {
  const d = new Date(iso + "T12:00:00");
  return {
    court: `${JFR[d.getDay()]} ${d.getDate()} ${MFR_C[d.getMonth()]}`,
    long:  `${JFR[d.getDay()]} ${d.getDate()} ${MFR_L[d.getMonth()]}`,
    date:  d,
  };
}

function computeScores(sondage) {
  const scores = {};
  (sondage.jours || []).forEach(j => { scores[j] = 0; });
  Object.values(sondage.reponses || {}).forEach(({ votes: v }) => {
    Object.entries(v || {}).forEach(([j, e]) => {
      if (e === "dispo")     scores[j] = (scores[j] || 0) + 1;
      else if (e === "si_besoin") scores[j] = (scores[j] || 0) + 0.5;
    });
  });
  return scores;
}

function computeWinner(sondage) {
  const scores = computeScores(sondage);
  const now = new Date();
  const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let best = -1, winner = null;
  (sondage.jours || []).forEach(j => {
    const s = scores[j] || 0;
    if (s > best) { best = s; winner = j; return; }
    if (s === best && winner) {
      const dj = Math.abs(new Date(j + "T12:00:00") - finMois);
      const dw = Math.abs(new Date(winner + "T12:00:00") - finMois);
      if (dj < dw) winner = j;
    }
  });
  return best > 0 ? winner : null;
}

// ── sessionStorage test mode ──────────────────────────────────────────────────
const SD_TEST_KEY = 'ltr_sondage_test';
function loadTestSondage() {
  try {
    const raw = sessionStorage.getItem(SD_TEST_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const cloture = new Date(s.cloture);
    if (cloture < new Date()) { sessionStorage.removeItem(SD_TEST_KEY); return null; }
    return { ...s, cloture: { toDate: () => cloture } };
  } catch { return null; }
}
function saveTestSondage(s) {
  sessionStorage.setItem(SD_TEST_KEY, JSON.stringify({
    ...s,
    cloture: s.cloture?.toDate ? s.cloture.toDate().toISOString() : s.cloture,
  }));
}

// ── État ──────────────────────────────────────────────────────────────────────
let sondage = null, membres = [], livres = [];
const membreById = {};
let moi = null, moiNom = "";
let currentVotes = {};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  let sondageFirebase;
  [sondageFirebase, membres, livres] = await Promise.all([
    getSondageDispo(), getMembres(), getLivres(),
  ]);
  sondage = sondageFirebase ?? loadTestSondage();
  membres.forEach((m, i) => { m._color = PALETTE[i % PALETTE.length]; membreById[m.id] = m; });

  const root = document.getElementById("ballot-root");
  if (!sondage) {
    renderNone(root); return;
  }
  if (!sondage.ouvert) {
    renderClosed(root); return;
  }
  renderActive(root);
}

// ── Aucun sondage ─────────────────────────────────────────────────────────────
function renderNone(root) {
  root.innerHTML = `
    <div class="ballot-letterhead">
      <div class="ballot-club">Club de lecture</div>
      <div class="ballot-h1">Sondage de <span class="rature">date</span></div>
      <div class="ballot-sub">Aucun sondage en cours</div>
    </div>
    <div class="vbanner up">
      <div class="vbanner-ico">${IC.cal}</div>
      <div class="vbanner-body">
        <div class="vbanner-title">Pas de sondage ouvert</div>
        <div class="vbanner-sub">Le prochain sondage sera lancé depuis la page Réunions.</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:2rem">
      <a href="reunions.html" style="display:inline-flex;align-items:center;gap:.4rem;color:var(--accent);font-weight:600;text-decoration:none;border:1px solid var(--accent);border-radius:8px;padding:.55rem 1.1rem">
        ${IC.cal} Retour aux réunions
      </a>
    </div>`;
}

// ── Sondage clôturé ───────────────────────────────────────────────────────────
function renderClosed(root) {
  const dateChoisie = sondage.date_choisie ? formatJour(sondage.date_choisie) : null;
  const livre = livres.find(l => l.id === sondage.livre_id);
  root.innerHTML = `
    <div class="ballot-letterhead">
      <div class="ballot-club">Club de lecture</div>
      <div class="ballot-h1">Sondage de <span class="rature">date</span></div>
      <div class="ballot-sub">${esc(livre?.titre ?? "—")}</div>
    </div>
    <div class="vbanner closed">
      <div class="vbanner-ico">${IC.check}</div>
      <div class="vbanner-body">
        <div class="vbanner-title">Sondage clôturé</div>
        <div class="vbanner-sub">${dateChoisie ? `Date retenue : <b>${dateChoisie.long}</b>` : "Aucune date retenue."}</div>
      </div>
    </div>
    ${buildFramadateTable(sondage)}
    <div style="text-align:center;margin-top:2rem">
      <a href="reunions.html" style="display:inline-flex;align-items:center;gap:.4rem;color:var(--accent);font-weight:600;text-decoration:none;border:1px solid var(--accent);border-radius:8px;padding:.55rem 1.1rem">
        ${IC.cal} Retour aux réunions
      </a>
    </div>`;
}

// ── Sondage actif ─────────────────────────────────────────────────────────────
function renderActive(root) {
  const livre   = livres.find(l => l.id === sondage.livre_id);
  const cloture = sondage.cloture?.toDate ? sondage.cloture.toDate() : new Date(sondage.cloture);
  const joursR  = Math.max(0, Math.ceil((cloture - new Date()) / 86400000));
  const nb      = Object.keys(sondage.reponses || {}).length;
  const tot     = membres.length;
  const clotStr = joursR === 0 ? "Clôture aujourd'hui"
    : joursR === 1 ? "Clôture demain"
    : `Clôture dans ${joursR} jours`;

  const testBadge = sondage._test ? `<span style="font-size:.66rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:rgba(181,87,45,.15);color:#b5572d;border:1px solid rgba(181,87,45,.4);border-radius:4px;padding:.1rem .45rem;margin-left:.5rem">TEST</span>` : '';
  root.innerHTML = `
    <div class="ballot-letterhead">
      <div class="ballot-club">Club de lecture ${testBadge}</div>
      <div class="ballot-h1">Sondage de <span class="rature">date</span></div>
      <div class="ballot-sub">${esc(livre?.titre ?? "—")} · séance à planifier${sondage._test ? ' · <em style="color:#b5572d">mode test — rien n\'est enregistré</em>' : ''}</div>
    </div>

    <div class="vbanner">
      <div class="vbanner-ico">${IC.cal}</div>
      <div class="vbanner-body">
        <div class="vbanner-title">Sondage ouvert — ${esc(livre?.titre ?? "—")}</div>
        <div class="vbanner-sub" id="b-sub"><b>${(sondage.jours || []).length} date${(sondage.jours || []).length > 1 ? "s" : ""}</b> proposée${(sondage.jours || []).length > 1 ? "s" : ""} · ${clotStr}</div>
      </div>
      <div class="vbanner-count" id="b-count">${nb}<small>/${tot} réponses</small></div>
    </div>

    <div class="vsec-title"><span class="vsec-num">1</span>${IC.users} Disponibilités du groupe</div>
    <div id="framadate-mount">${buildFramadateTable(sondage)}</div>

    <div class="vsec-title" id="sec-ident"><span class="vsec-num">2</span>Qui êtes-vous ?</div>
    <div id="ident-mount"></div>

    <div id="avail-mount"></div>

    <div class="bilan" id="bilan-sec">
      <div class="bilan-title">Émargement — <span id="bilan-count"></span></div>
      <div class="bilan-grid" id="bilan-grid"></div>
    </div>`;

  renderIdent();
  renderBilan();
}

// ── Table Framadate ───────────────────────────────────────────────────────────
function buildFramadateTable(s) {
  const jours    = s.jours || [];
  const reponses = s.reponses || {};
  const ids      = Object.keys(reponses);
  const scores   = computeScores(s);
  const winner   = computeWinner(s);
  const SYM      = { dispo: "✓", si_besoin: "~", pas_dispo: "✗" };

  if (!jours.length) return "";

  const heads = jours.map(j => {
    const { court } = formatJour(j);
    return `<th class="${j === winner ? "fd-best" : ""}">${court}</th>`;
  }).join("");

  const rows = ids.map(mid => {
    const rep = reponses[mid];
    const nom = rep.nom || membreById[mid]?.nom || mid;
    const cells = jours.map(j => {
      const e = rep.votes?.[j] || "";
      return `<td class="fd-cell ${e}">${SYM[e] || "—"}</td>`;
    }).join("");
    return `<tr><td class="fd-name">${esc(nom)}</td>${cells}</tr>`;
  }).join("");

  const scoreRow = jours.map(j => {
    const sc = scores[j] || 0;
    return `<td class="${j === winner ? "fd-best" : ""}">${sc % 1 ? sc.toFixed(1) : sc}</td>`;
  }).join("");

  const emptyRow = !ids.length
    ? `<tr><td class="fd-name" colspan="${jours.length + 1}" style="color:var(--muted);font-style:italic;text-align:center;padding:.9rem">Aucune réponse pour l'instant.</td></tr>`
    : "";

  return `<div class="framadate-wrap">
    <table class="framadate">
      <thead><tr><th></th>${heads}</tr></thead>
      <tbody>
        ${rows}${emptyRow}
        ${ids.length ? `<tr class="fd-score"><td class="fd-name">Score</td>${scoreRow}</tr>` : ""}
      </tbody>
    </table>
  </div>`;
}

// ── Identification ────────────────────────────────────────────────────────────
function renderIdent() {
  const mount = document.getElementById("ident-mount");
  if (!mount) return;

  if (!moi) {
    mount.innerHTML = `
      <div class="ident">
        <label for="who">Sélectionnez votre nom :</label>
        <select id="who">
          <option value="">— Choisir —</option>
          ${membres.map(m => {
            const voted = !!sondage.reponses?.[m.id];
            return `<option value="${esc(m.id)}">${esc(m.nom)}${voted ? " ✓" : ""}</option>`;
          }).join("")}
        </select>
        <button class="btn btn-primary" id="who-go">Continuer →</button>
      </div>`;
    document.getElementById("who-go").addEventListener("click", () => {
      const v = document.getElementById("who").value;
      if (!v) { showToast("Choisissez votre nom dans la liste.", false); return; }
      moi = v;
      moiNom = membreById[v]?.nom ?? v;
      // Pré-remplir si déjà répondu
      currentVotes = { ...(sondage.reponses?.[moi]?.votes || {}) };
      renderIdent();
      renderAvail();
    });
    document.getElementById("avail-mount").innerHTML = "";
  } else {
    const m = membreById[moi] || { nom: moi, _color: "#888" };
    mount.innerHTML = `
      <div class="voter-tag">
        <span style="width:22px;height:22px;border-radius:50%;display:inline-grid;place-items:center;font-size:.6rem;font-weight:700;color:#fff;background:${m._color}">${ini(m.nom)}</span>
        Disponibilités de <b>${esc(m.nom)}</b>
        <button class="chg" id="who-change">changer</button>
      </div>`;
    document.getElementById("who-change").addEventListener("click", () => {
      moi = null; moiNom = ""; currentVotes = {};
      renderIdent();
      document.getElementById("avail-mount").innerHTML = "";
    });
  }
}

// ── Grille de disponibilités ──────────────────────────────────────────────────
function renderAvail() {
  const mount = document.getElementById("avail-mount");
  if (!mount || !moi) { if (mount) mount.innerHTML = ""; return; }

  const scores = computeScores(sondage);
  const winner = computeWinner(sondage);

  const rows = (sondage.jours || []).map(j => {
    const { court } = formatJour(j);
    const e = currentVotes[j] || "";
    const isBest = j === winner;
    return `<div class="avail-row${isBest ? " best-day" : ""}" data-jour="${j}">
      <div class="avail-day">
        ${court}
        ${isBest ? `<small>Meilleure disponibilité actuelle</small>` : ""}
      </div>
      <div class="avail-btns">
        <button class="avail-btn dispo ${e === "dispo" ? "active" : ""}" data-state="dispo" data-jour="${j}">${IC.dispo} Dispo</button>
        <button class="avail-btn si_besoin ${e === "si_besoin" ? "active" : ""}" data-state="si_besoin" data-jour="${j}">~ Si besoin</button>
        <button class="avail-btn pas_dispo ${e === "pas_dispo" ? "active" : ""}" data-state="pas_dispo" data-jour="${j}">✗ Pas dispo</button>
      </div>
    </div>`;
  }).join("");

  mount.innerHTML = `
    <div class="vsec-title"><span class="vsec-num">3</span>Vos disponibilités</div>
    <div class="avail-legend">
      <span><b style="color:#1a8a55">${IC.dispo}</b> Disponible</span>
      <span><b style="color:#c88200">~</b> Si besoin (préférence faible)</span>
      <span><b style="color:#c83232">✗</b> Pas disponible</span>
    </div>
    <div class="avail-grid" id="avail-grid">${rows}</div>
    <div class="submit-row">
      <button class="btn btn-primary btn-lg" id="submit-avail">${IC.check} Enregistrer mes disponibilités</button>
    </div>`;

  // Wire boutons
  document.querySelectorAll(".avail-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const jour  = btn.dataset.jour;
      const state = btn.dataset.state;
      currentVotes[jour] = state;
      document.querySelectorAll(`.avail-btn[data-jour="${jour}"]`).forEach(b => {
        b.classList.toggle("active", b.dataset.state === state);
      });
    });
  });

  document.getElementById("submit-avail").addEventListener("click", submitAvail);
}

// ── Soumission ────────────────────────────────────────────────────────────────
async function submitAvail() {
  if (!moi) { showToast("Choisissez votre nom.", false); return; }
  const btn = document.getElementById("submit-avail");
  btn.disabled = true; btn.textContent = "Enregistrement…";
  try {
    if (!sondage._test) {
      await updateSondageReponse(sondage.id, moi, moiNom, currentVotes);
    }
    // Mise à jour locale (test ou réel)
    if (!sondage.reponses) sondage.reponses = {};
    sondage.reponses[moi] = { nom: moiNom, votes: { ...currentVotes } };
    if (sondage._test) saveTestSondage(sondage);
    // Rafraîchir la table du groupe + bilan
    document.getElementById("framadate-mount").innerHTML = buildFramadateTable(sondage);
    renderBilan();
    const nb = Object.keys(sondage.reponses).length;
    const countEl = document.getElementById("b-count");
    if (countEl) countEl.innerHTML = `${nb}<small>/${membres.length} réponses</small>`;
    btn.innerHTML = `${IC.check} Disponibilités enregistrées`;
    btn.style.opacity = ".65";
    showToast(sondage._test ? "Disponibilités enregistrées (test — non sauvegardé)." : "Disponibilités enregistrées — merci !");
  } catch(e) {
    btn.disabled = false; btn.innerHTML = `${IC.check} Enregistrer mes disponibilités`;
    showToast("Erreur : " + e.message, false);
  }
}

// ── Bilan émargement ─────────────────────────────────────────────────────────
function renderBilan() {
  const count = document.getElementById("bilan-count");
  const grid  = document.getElementById("bilan-grid");
  if (!count || !grid) return;
  const nb  = Object.keys(sondage.reponses || {}).length;
  const tot = membres.length;
  count.textContent = `${nb} / ${tot} réponses reçues`;
  grid.innerHTML = membres.map(m => {
    const ok = !!sondage.reponses?.[m.id];
    return `<span class="bilan-tag ${ok ? "ok" : ""}">
      <span class="ava" style="background:${m._color}">${ini(m.nom)}</span>
      ${esc(m.nom)}
      <span class="ck">${IC.check}</span>
    </span>`;
  }).join("");
}

init().catch(console.error);
