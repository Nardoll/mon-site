import { requireAuth } from "./auth.js";
import { getVotes, getMembres, getLivres, getVoteActif, updateVote } from "./db.js";
import { initNav } from "./nav.js";
import { formatMois } from "./utils.js";
import { hydrateCover, coversOn, removeAllCovers } from "./covers.js";

await requireAuth();
initNav("votes");

// ── Constantes ─────────────────────────────────────────────────────────────
const SEUIL = 2.9;
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const PALETTE = ["#b5572d","#3f7a52","#6840d8","#bf8a2f","#5a7d8c","#a8503f","#3f5340","#8a5a6b","#46708a","#9a6a2f"];
const COVERS = [
  ["#3f5340","#273829"],["#39505c","#25363d"],["#6b4a52","#432d36"],
  ["#5a4636","#382a20"],["#8a6a2f","#5b4420"],["#5a4326","#3a2b18"],
  ["#2f2822","#1d1814"],["#3a3a40","#222227"],["#7a3b2e","#56281f"],
];

const IC = {
  check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  laurel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 19h6M12 13v6"/></svg>',
  users:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.7-4.7"/></svg>',
  bars:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V4M4 20h16"/><rect x="8" y="11" width="3" height="6" rx=".5"/><rect x="14" y="7" width="3" height="10" rx=".5"/></svg>',
  grid:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  cal:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s) { return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function ini(nom) { return (nom || "?").slice(0, 2); }
function stars(n) { const k = Math.round(Math.max(0, Math.min(5, n))); return "★".repeat(k) + "☆".repeat(5 - k); }
function avaColor(i) { return PALETTE[i % PALETTE.length]; }
function coverColor(i) { return COVERS[i % COVERS.length]; }

// Couleur de couverture stable par livre_id (initialisée dans init via index)
const _coverCache = new Map();
function getBookCover(livreId) {
  return _coverCache.get(livreId) || COVERS[0];
}

// ── État global ────────────────────────────────────────────────────────────
let voteActif = null, membres = [], livres = [], votes = [];
const membreById = {}, livreById = {};
let _timer = null;

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  [voteActif, membres, livres, votes] = await Promise.all([
    getVoteActif(), getMembres(), getLivres(), getVotes(),
  ]);
  membres.forEach((m, i) => { m._color = avaColor(i); membreById[m.id] = m; });
  livres.forEach((l, i) => { livreById[l.id] = l; _coverCache.set(l.id, coverColor(i)); });

  renderStatus();
  renderScrutins();
  bindOverlay();

  // Auto-ouvrir un scrutin depuis l'URL ?open=ID (ex: frise "Notre parcours")
  const openId = new URLSearchParams(location.search).get("open");
  if (openId) {
    const v = votes.find(x => x.id === openId);
    if (v) v.exceptionnel ? openExceptionnel(v) : openResult(v);
  }
}

// ── Statut (vote actif ou à venir) ────────────────────────────────────────
function renderStatus() {
  if (voteActif) renderLive();
  else renderUpcoming();
}

function renderLive() {
  const livreIds  = voteActif.livre_ids  || [];
  const membreIds = voteActif.membre_ids || [];
  const bulletins = voteActif.bulletins  || {};
  const nbVotes   = Object.keys(bulletins).length;
  const total     = membreIds.length;
  const pct       = total ? Math.round(nbVotes / total * 100) : 0;

  const emarge = membreIds.map(id => {
    const m = membreById[id] || { nom: id, _color: "#888" };
    const v = !!bulletins[id];
    return `<span class="emarge-tag ${v ? "voted" : "pending"}">
      <span class="ava" style="background:${m._color}">${ini(m.nom)}</span>${esc(m.nom)}
      <span class="ck">${IC.check}</span>
    </span>`;
  }).join("");

  const chips = livreIds.map(id => {
    const l = livreById[id];
    return `<span class="live-chip">${esc(l?.titre ?? id)}</span>`;
  }).join("");

  document.getElementById("live-mount").innerHTML = `
    <div class="live">
      <div class="live-grid">
        <div class="live-main">
          <span class="live-eyebrow"><span class="pulse"></span>Vote ouvert</span>
          <div class="live-title">Scrutin de ${formatMois(voteActif.mois, voteActif.annee)}</div>
          <div class="live-meta"><b>${livreIds.length} livre${livreIds.length !== 1 ? "s" : ""}</b> en compétition · notation de 1 à ${voteActif.echelle || 5}</div>
          <div class="live-count" id="live-countdown">${IC.users}${nbVotes} / ${total} bulletins reçus</div>
          <div class="live-books">${chips}</div>
        </div>
        <div class="live-side">
          <div class="ring" style="--pct:${pct}">
            <span class="ring-txt"><b>${nbVotes}</b><span>sur ${total}</span></span>
          </div>
          <div class="live-side-label">Participation</div>
          <a class="live-cta" href="vote.html">Accéder au bulletin ${IC.arrowR}</a>
        </div>
      </div>
      <div class="emarge">${emarge}</div>
    </div>`;

  if (voteActif.expires_at) {
    const expiry = voteActif.expires_at.toDate ? voteActif.expires_at.toDate() : new Date(voteActif.expires_at);
    startCountdown(expiry, nbVotes, total);
  }
}

function startCountdown(expiry, nbVotes, total) {
  if (_timer) clearInterval(_timer);
  function tick() {
    const el = document.getElementById("live-countdown");
    if (!el) { clearInterval(_timer); return; }
    const diff = expiry - Date.now();
    if (diff <= 0) {
      el.innerHTML = `${IC.users}${nbVotes} / ${total} bulletins · vote clos`;
      clearInterval(_timer); return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor(diff % 3600000 / 60000);
    const s = Math.floor(diff % 60000 / 1000);
    const t = h > 0 ? `${h} h ${String(m).padStart(2,"0")} min` : `${m} min ${String(s).padStart(2,"0")} s`;
    el.innerHTML = `${IC.users}${nbVotes} / ${total} bulletins · clôture dans ${t}`;
  }
  tick();
  _timer = setInterval(tick, 1000);
}

function renderUpcoming() {
  const today = new Date();
  const next  = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nom   = MOIS_FR[next.getMonth()];
  const nomCap = nom.charAt(0).toUpperCase() + nom.slice(1);
  const jours = Math.max(1, Math.ceil((next - today) / 86400000));

  document.getElementById("live-mount").innerHTML = `
    <div class="live up">
      <div class="live-grid">
        <div class="live-main">
          <span class="live-eyebrow up">${IC.cal}À venir</span>
          <div class="live-title">Prochain scrutin — ${nomCap} ${next.getFullYear()}</div>
          <div class="live-meta">Ouverture automatique le 1ᵉʳ ${nom}</div>
          <div class="live-count up">${IC.cal}Dans ${jours} jour${jours > 1 ? "s" : ""}</div>
        </div>
        <div class="live-side">
          <div class="up-cal">
            <div class="up-cal-top"></div>
            <div class="up-cal-body"><span class="up-cal-d">1ᵉʳ</span><span class="up-cal-m">${nom}</span></div>
          </div>
          <div class="live-side-label">Ouverture du scrutin</div>
          <a class="live-cta" href="vote.html">Voir le bulletin ${IC.arrowR}</a>
        </div>
      </div>
    </div>`;
}

// ── Registre des scrutins ─────────────────────────────────────────────────
function renderScrutins() {
  document.getElementById("scrutins-count").textContent = votes.length
    ? `${votes.length} scrutin${votes.length !== 1 ? "s" : ""} archivé${votes.length !== 1 ? "s" : ""}`
    : "";

  if (!votes.length) {
    document.getElementById("scrutins-mount").innerHTML =
      `<div style="color:var(--muted);font-size:.85rem;padding:.5rem 0">Aucun scrutin archivé pour le moment.</div>`;
    return;
  }

  document.getElementById("scrutins-mount").innerHTML = votes.map(v => {
    const eluL = livreById[v.livre_elu];
    const eluR = (v.resultats || []).find(r => r.livre_id === v.livre_elu);
    const score = eluR?.score ?? eluR?.moyenne ?? null;
    const nb    = (v.resultats || []).length;
    const elim  = (v.resultats || []).filter(r => (r.score ?? r.moyenne ?? 0) <= SEUIL).length;
    const [g1, g2] = getBookCover(v.livre_elu);

    return `
    <button class="scrutin" data-id="${esc(v.id)}" style="--g1:${g1};--g2:${g2}">
      <span class="scrutin-month">${formatMois(v.mois, v.annee)}</span>
      <span class="scrutin-cover"></span>
      <span class="scrutin-info">
        <span class="scrutin-elu-label">${IC.laurel} Élu</span>
        <span class="scrutin-title">${esc(eluL?.titre ?? "—")}</span>
        <span class="scrutin-author">${esc(eluL?.auteur ?? "")}</span>
      </span>
      <span class="scrutin-right">
        <span class="scrutin-tags">
          ${score != null ? `<span class="scrutin-score">${Number(score).toFixed(2)}<small>/5</small></span>` : ""}
          <span class="scrutin-sub">${nb} livre${nb !== 1 ? "s" : ""}${elim ? ` · ${elim} éliminé${elim > 1 ? "s" : ""}` : ""}</span>
          ${v.tour2 ? `<span class="scrutin-2tours">${IC.repeat} 2 tours</span>` : ""}
        </span>
        <span class="scrutin-chev">›</span>
      </span>
    </button>`;
  }).join("");

  document.querySelectorAll(".scrutin").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = votes.find(x => x.id === btn.dataset.id);
      if (!v) return;
      if (v.exceptionnel) openExceptionnel(v);
      else openResult(v);
    });
    if (coversOn()) {
      const v = votes.find(x => x.id === btn.dataset.id);
      hydrateCover(btn.querySelector(".scrutin-cover"), v && livreById[v.livre_elu]);
    }
  });
}

// Vraies couvertures : re-render du registre + ré-hydratation de la fiche bilan ouverte
let curResultVote = null;
document.addEventListener("ltr-covers-change", e => {
  renderScrutins();
  const wcover = document.querySelector("#result-paper .wcover");
  if (!wcover) return;
  if (e.detail?.on && curResultVote) hydrateCover(wcover, livreById[curResultVote.livre_elu]);
  else removeAllCovers(document.getElementById("result-paper"));
});

// ── Fiche vote exceptionnel (hors système de notation) ───────────────────
function openExceptionnel(vote) {
  const eluL = livreById[vote.livre_elu];
  const [g1, g2] = getBookCover(vote.livre_elu);
  const note = vote.note_exceptionnelle ?? null;
  const desc = vote.description_exceptionnelle ?? "Ce livre a été choisi via un sondage extérieur au site.";
  const hasSondage = vote.sondage && Object.keys(vote.sondage).length > 0;

  document.getElementById("result-paper").innerHTML = `
    <button class="paper-close" id="result-close" aria-label="Fermer">✕</button>
    <div class="paper-eyebrow">Scrutin · ${formatMois(vote.mois, vote.annee)}</div>
    <div class="paper-title">Sélection exceptionnelle</div>
    <div class="paper-winner" style="--g1:${g1};--g2:${g2}">
      <span class="wcover"></span>
      <div class="winfo">
        <div class="wlabel">${IC.laurel} Livre élu</div>
        <div class="wtitle">${esc(eluL?.titre ?? "—")}</div>
        <div class="wauthor">${esc(eluL?.auteur ?? "")}</div>
      </div>
      ${note != null ? `<div class="wscore"><b>${Number(note).toFixed(1)}</b><small>note /10</small></div>` : ""}
    </div>
    <div class="paper-divider"></div>
    <div style="background:rgba(181,87,45,.07);border:1px solid rgba(181,87,45,.22);border-radius:10px;padding:1.1rem 1.3rem;font-size:.9rem;line-height:1.6;color:#5a3c22">
      <div style="font-weight:700;color:#b5572d;margin-bottom:.5rem;font-size:.82rem;letter-spacing:.06em;text-transform:uppercase">⚠ Hors scrutin officiel</div>
      ${esc(desc)}
    </div>
    <div class="paper-divider"></div>
    <div class="paper-sec-title">${IC.bars} Résultats du sondage</div>
    <div class="paper-sec-sub">Nombre de voix par livre — vote unique par membre.</div>
    ${buildSondageChart(vote)}
    ${hasSondage ? `
    <div class="paper-divider"></div>
    <div class="paper-sec-title">${IC.grid} Émargement</div>
    <div class="paper-sec-sub">✓ = a voté pour ce livre.</div>
    ${buildSondageTable(vote)}
    ` : `<p style="font-size:.83rem;color:var(--muted);margin:.6rem 0 .2rem">Aucun vote renseigné — cliquez "Modifier les votes" pour saisir les résultats.</p>`}
    <div class="paper-divider"></div>
    <button id="sondage-edit-btn" style="display:inline-flex;align-items:center;gap:.45rem;background:none;border:1px solid var(--border);border-radius:8px;padding:.5rem 1rem;font-size:.83rem;cursor:pointer;color:var(--text)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
      Modifier les votes
    </button>`;

  document.getElementById("result-overlay").classList.remove("hidden");
  document.getElementById("result-paper").scrollTop = 0;
  document.getElementById("result-close").addEventListener("click", closeResult);
  document.getElementById("sondage-edit-btn").addEventListener("click", () => openSondageEdit(vote));
  curResultVote = vote;
  hydrateCover(document.querySelector("#result-paper .wcover"), eluL);
}

function buildSondageChart(vote) {
  const sondage = vote.sondage || {};
  const livreIds = vote.livre_ids || [...new Set(Object.values(sondage))];
  if (!livreIds.length) return `<p style="font-size:.83rem;color:var(--muted);margin:.3rem 0">Aucun livre enregistré.</p>`;

  const counts = {};
  livreIds.forEach(id => { counts[id] = 0; });
  Object.values(sondage).forEach(lId => { if (lId in counts) counts[lId]++; });

  const H = 150;
  const maxCount = Math.max(1, ...Object.values(counts));
  const sorted = [...livreIds].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));

  const cols = sorted.map(lId => {
    const isWin = lId === vote.livre_elu;
    const col = isWin ? "#1a8a55" : "#6840d8";
    const cnt = counts[lId] || 0;
    const h = Math.max(cnt > 0 ? 18 : 3, Math.round(cnt / maxCount * H));
    return `<div class="dep-col">
      <div class="dep-val" style="color:${col}">${cnt} voix</div>
      <div class="dep-bar" style="height:${h}px;background:${col}"></div>
    </div>`;
  }).join("");

  const labels = sorted.map(lId => {
    const l = livreById[lId];
    return `<div class="dep-label">${esc(l?.titre ?? lId)}</div>`;
  }).join("");

  return `
    <div class="dep-legend">
      <span class="dep-legend-item"><span class="dep-legend-dot" style="background:#1a8a55"></span>Élu</span>
      <span class="dep-legend-item"><span class="dep-legend-dot" style="background:#6840d8"></span>En lice</span>
    </div>
    <div class="dep-chart-wrap">
      <div class="dep-chart">${cols}</div>
      <div class="dep-labels">${labels}</div>
    </div>`;
}

function buildSondageTable(vote) {
  const sondage = vote.sondage || {};
  const livreIds = vote.livre_ids || [...new Set(Object.values(sondage))];
  const membreIds = Object.keys(sondage);
  if (!membreIds.length || !livreIds.length) return "";

  const heads = livreIds.map(id => {
    const l = livreById[id];
    const isWin = id === vote.livre_elu;
    return `<th class="${isWin ? "win" : ""}">${esc(l?.titre ?? id)}</th>`;
  }).join("");

  const rows = membreIds.map(mId => {
    const m = membreById[mId] || { nom: mId, _color: "#888" };
    const voted = sondage[mId];
    const cells = livreIds.map(lId => lId === voted
      ? `<td style="text-align:center;background:rgba(26,138,85,.12);color:#1a8a55;font-weight:700;font-size:1rem">✓</td>`
      : `<td></td>`
    ).join("");
    return `<tr>
      <td class="who"><span style="display:inline-flex;align-items:center;gap:.4rem">
        <span style="width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;font-size:.56rem;font-weight:700;color:#fff;background:${m._color}">${ini(m.nom)}</span>${esc(m.nom)}
      </span></td>
      ${cells}
    </tr>`;
  }).join("");

  return `<div class="tally-wrap"><table class="tally">
    <thead><tr><th class="who">Membre</th>${heads}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function openSondageEdit(vote) {
  const livreIdsSet = new Set(vote.livre_ids || [...new Set(Object.values(vote.sondage || {}))]);
  const sondage = vote.sondage || {};

  const livresSorted = [...livres].sort((a, b) => (a.titre ?? "").localeCompare(b.titre ?? ""));

  const checkboxes = livresSorted.map(l => {
    const checked = livreIdsSet.has(l.id) ? "checked" : "";
    return `<label style="display:flex;align-items:center;gap:.55rem;padding:.3rem 0;cursor:pointer;font-size:.84rem">
      <input type="checkbox" data-livre="${esc(l.id)}" ${checked} style="cursor:pointer;flex-shrink:0">
      ${esc(l.titre)}${l.auteur ? `<span style="color:var(--muted);font-size:.77rem;margin-left:.2rem">— ${esc(l.auteur)}</span>` : ""}
    </label>`;
  }).join("");

  const voteRows = membres.map(m => {
    const current = sondage[m.id] || "";
    const opts = livresSorted.map(l =>
      `<option value="${esc(l.id)}" ${current === l.id ? "selected" : ""}>${esc(l.titre)}</option>`
    ).join("");
    return `<div style="display:flex;align-items:center;gap:.8rem;padding:.45rem 0;border-bottom:1px solid rgba(120,90,50,.1)">
      <span style="min-width:90px;font-size:.85rem;flex-shrink:0">${esc(m.nom)}</span>
      <select data-membre="${esc(m.id)}" style="flex:1;font-size:.82rem;padding:.3rem .5rem;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)">
        <option value="">— N'a pas voté —</option>
        ${opts}
      </select>
    </div>`;
  }).join("");

  document.getElementById("result-paper").innerHTML = `
    <button class="paper-close" id="result-close" aria-label="Fermer">✕</button>
    <div class="paper-eyebrow">Sondage · ${formatMois(vote.mois, vote.annee)}</div>
    <div class="paper-title">Modifier les votes</div>

    <div class="paper-sec-title" style="margin-top:.8rem">${IC.grid} Livres en compétition</div>
    <p style="font-size:.83rem;color:var(--muted);margin:.2rem 0 .7rem">Cocher les livres qui étaient dans le sondage Discord.</p>
    <div style="display:flex;flex-direction:column;max-height:180px;overflow-y:auto;padding:.1rem .2rem;border:1px solid var(--border);border-radius:8px;margin-bottom:1.2rem">${checkboxes}</div>

    <div class="paper-sec-title">${IC.users} Votes individuels</div>
    <p style="font-size:.83rem;color:var(--muted);margin:.2rem 0 .7rem">Indiquer quel livre chaque membre a choisi.</p>
    <div style="display:flex;flex-direction:column;margin-bottom:1.2rem">${voteRows}</div>

    <div style="display:flex;gap:.8rem;flex-wrap:wrap">
      <button id="sondage-save-btn" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:.55rem 1.2rem;font-size:.88rem;font-weight:600;cursor:pointer">Enregistrer</button>
      <button id="sondage-cancel-btn" style="background:none;border:1px solid var(--border);border-radius:8px;padding:.55rem 1.2rem;font-size:.88rem;cursor:pointer;color:var(--text)">Annuler</button>
    </div>`;

  document.getElementById("result-paper").scrollTop = 0;
  document.getElementById("result-close").addEventListener("click", closeResult);
  document.getElementById("sondage-cancel-btn").addEventListener("click", () => openExceptionnel(vote));
  document.getElementById("sondage-save-btn").addEventListener("click", async () => {
    const newLivreIds = [];
    document.getElementById("result-paper").querySelectorAll("[data-livre]").forEach(cb => {
      if (cb.checked) newLivreIds.push(cb.dataset.livre);
    });
    const newSondage = {};
    document.getElementById("result-paper").querySelectorAll("[data-membre]").forEach(sel => {
      if (sel.value) newSondage[sel.dataset.membre] = sel.value;
    });
    try {
      await updateVote(vote.id, { livre_ids: newLivreIds, sondage: newSondage });
      vote.livre_ids = newLivreIds;
      vote.sondage = newSondage;
      openExceptionnel(vote);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la sauvegarde.");
    }
  });
}

// ── Fiche résultats ───────────────────────────────────────────────────────
function openResult(vote) {
  const eluL  = livreById[vote.livre_elu];
  const eluR  = (vote.resultats || []).find(r => r.livre_id === vote.livre_elu);
  const score = eluR?.score ?? eluR?.moyenne ?? null;
  const [g1, g2] = getBookCover(vote.livre_elu);
  const hasTour2 = !!vote.tour2;

  const resultats = [...(vote.resultats || [])].sort(
    (a, b) => (b.score ?? b.moyenne ?? 0) - (a.score ?? a.moyenne ?? 0)
  );
  const elim = resultats.filter(r => (r.score ?? r.moyenne ?? 0) <= SEUIL).length;
  const hasNotes = resultats.some(r => r.notes && Object.keys(r.notes).length > 0);
  const votants  = hasNotes
    ? [...new Set(resultats.flatMap(r => Object.keys(r.notes || {})))]
    : [];

  const depTitle = hasTour2 ? "Premier tour — égalité" : "Dépouillement";
  const depSub   = hasTour2
    ? `Score de chaque livre : <b>(moyenne + médiane) ÷ 2</b>. Deux titres arrivent à égalité en tête — d'où le second tour ci-dessous.`
    : `Score de chaque livre : <b>(moyenne + médiane) ÷ 2</b> — ce qui atténue les notes extrêmes. Le plus haut score est élu ; tout score <b>≤ ${SEUIL}</b> élimine le livre.`;

  document.getElementById("result-paper").innerHTML = `
    <button class="paper-close" id="result-close" aria-label="Fermer">✕</button>
    <div class="paper-eyebrow">Scrutin · ${formatMois(vote.mois, vote.annee)}</div>
    <div class="paper-title">Résultats du vote</div>
    <div class="paper-winner" style="--g1:${g1};--g2:${g2}">
      <span class="wcover"></span>
      <div class="winfo">
        <div class="wlabel">${IC.laurel} Livre élu${hasTour2 ? " · 2ᵉ tour" : ""}</div>
        <div class="wtitle">${esc(eluL?.titre ?? "—")}</div>
        <div class="wauthor">${esc(eluL?.auteur ?? "")}</div>
      </div>
      ${score != null ? `<div class="wscore"><b>${Number(score).toFixed(2)}</b><small>score /5</small></div>` : ""}
    </div>

    <div class="paper-divider"></div>
    <div class="paper-sec-title">${IC.bars} ${depTitle}</div>
    <div class="paper-sec-sub">${depSub}</div>
    ${buildDepChart(resultats, vote)}
    ${hasTour2 ? buildTour2(vote) : ""}

    ${hasNotes ? `
      <div class="paper-divider"></div>
      <div class="paper-sec-title">${IC.grid} Émargement — bulletins individuels${hasTour2 ? " (1ᵉʳ tour)" : ""}</div>
      <div class="paper-sec-sub">${votants.length} votants · une note de 1 à 5 par livre${elim ? ` · <b>${elim}</b> livre${elim > 1 ? "s" : ""} sous le seuil` : ""}.</div>
      ${buildTallyTable(resultats, vote, votants)}
      <div class="paper-divider"></div>
      <div class="detail-head">
        <div class="paper-sec-title" style="margin:0">${IC.bars} Détail</div>
        <div class="seg-tabs">
          <button class="seg-tab active" data-tab="livre">Par livre</button>
          <button class="seg-tab" data-tab="votant">Par votant</button>
        </div>
      </div>
      <select class="detail-select" id="detail-select"></select>
      <div id="detail-chart"></div>
    ` : ""}`;

  document.getElementById("result-overlay").classList.remove("hidden");
  document.getElementById("result-paper").scrollTop = 0;
  document.getElementById("result-close").addEventListener("click", closeResult);
  if (hasNotes) wireDetail(resultats, vote, votants);

  curResultVote = vote;
  hydrateCover(document.querySelector("#result-paper .wcover"), eluL);
}

function buildDepChart(resultats, vote) {
  const H = 200;
  const tBottom = Math.round(SEUIL / 5 * H);
  const cols = resultats.map(r => {
    const sc     = r.score ?? r.moyenne ?? 0;
    const isWin  = r.livre_id === vote.livre_elu && !vote.tour2;
    const isTie  = vote.tour2 && (vote.tour2.enLice || []).includes(r.livre_id);
    const isElim = sc <= SEUIL;
    const col    = isWin ? "#1a8a55" : isTie ? "#b5572d" : isElim ? "#a89a82" : "#6840d8";
    const h      = Math.max(3, Math.round(sc / 5 * H));
    return `<div class="dep-col">
      <div class="dep-val" style="color:${col}">${sc != null ? Number(sc).toFixed(2) : "—"}</div>
      <div class="dep-bar" style="height:${h}px;background:${col}"></div>
    </div>`;
  }).join("");

  const labels = resultats.map(r => {
    const l = livreById[r.livre_id];
    return `<div class="dep-label">${esc(l?.titre ?? r.livre_id)}</div>`;
  }).join("");

  const legend = vote.tour2
    ? `<span class="dep-legend-item"><span class="dep-legend-dot" style="background:#b5572d"></span>Ex æquo en tête</span>`
    : `<span class="dep-legend-item"><span class="dep-legend-dot" style="background:#1a8a55"></span>Élu</span>`;

  return `
    <div class="dep-legend">
      ${legend}
      <span class="dep-legend-item"><span class="dep-legend-dot" style="background:#6840d8"></span>Conservé (&gt; ${SEUIL})</span>
      <span class="dep-legend-item"><span class="dep-legend-dot" style="background:#a89a82"></span>Éliminé (≤ ${SEUIL})</span>
    </div>
    <div class="dep-chart-wrap">
      <div class="dep-chart">
        <div class="dep-threshold" style="bottom:${tBottom}px"><span>Seuil ${SEUIL}</span></div>
        ${cols}
      </div>
      <div class="dep-labels">${labels}</div>
    </div>`;
}

function buildTour2(vote) {
  const t2 = vote.tour2;
  if (!t2?.enLice) return "";
  const counts = {};
  t2.enLice.forEach(id => { counts[id] = 0; });
  if (t2.choix) Object.values(t2.choix).forEach(id => { if (id in counts) counts[id]++; });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const maxV  = Math.max(...Object.values(counts), 1);

  const rows = [...t2.enLice]
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
    .map(id => {
      const l = livreById[id];
      const v = counts[id] || 0;
      const isWin = id === vote.livre_elu;
      const pct = Math.round(v / maxV * 100);
      return `<div class="t2-row">
        <div class="t2-name">${esc(l?.titre ?? id)}<span class="au">${esc(l?.auteur ?? "")}</span></div>
        <div class="t2-track"><div class="t2-fill ${isWin ? "win" : ""}" style="width:${pct}%"></div></div>
        <div class="t2-count" style="color:${isWin ? "#177a4a" : "#5b3bb0"}">${v} voix${isWin ? " " + IC.laurel : ""}</div>
      </div>`;
    }).join("");

  return `
    <div class="paper-divider"></div>
    <div class="paper-sec-title">${IC.repeat} Second tour — départage</div>
    <div class="t2-note">Égalité parfaite en tête du 1ᵉʳ tour entre <b>${t2.enLice.length} livres</b>. Chaque membre choisit <b>un seul</b> titre — celui qui réunit le plus de voix l'emporte. <b>${total} bulletin${total !== 1 ? "s" : ""}</b> exprimé${total !== 1 ? "s" : ""}.</div>
    ${rows}`;
}

function buildTallyTable(resultats, vote, votants) {
  const heads = resultats.map(r => {
    const isWin  = r.livre_id === vote.livre_elu && !vote.tour2;
    const isElim = (r.score ?? r.moyenne ?? 0) <= SEUIL;
    const l = livreById[r.livre_id];
    return `<th class="${isWin ? "win" : isElim ? "elim" : ""}">${esc(l?.titre ?? r.livre_id)}</th>`;
  }).join("");

  const rows = votants.map(mId => {
    const m = membreById[mId] || { nom: mId, _color: "#888" };
    const cells = resultats.map(r => {
      const isWin  = r.livre_id === vote.livre_elu && !vote.tour2;
      const isElim = (r.score ?? r.moyenne ?? 0) <= SEUIL;
      const n = r.notes?.[mId];
      if (n == null) return `<td class="skip">passe</td>`;
      return `<td class="${isWin ? "win" : isElim ? "elim" : ""}">${Number(n)}/5<span class="stars">${stars(Number(n))}</span></td>`;
    }).join("");
    const mNotes = resultats.map(r => r.notes?.[mId]).filter(n => n != null);
    const mAvg = mNotes.length ? (mNotes.reduce((a, b) => a + Number(b), 0) / mNotes.length).toFixed(1) : "—";
    return `<tr><td class="who"><span style="display:inline-flex;align-items:center;gap:.4rem">
      <span style="width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;font-size:.56rem;font-weight:700;color:#fff;background:${m._color}">${ini(m.nom)}</span>${esc(m.nom)}
    </span></td>${cells}<td class="moy-col">${mAvg}</td></tr>`;
  }).join("");

  const foot = resultats.map(r => {
    const isWin  = r.livre_id === vote.livre_elu && !vote.tour2;
    const sc     = r.score ?? r.moyenne ?? null;
    const isElim = sc !== null && sc <= SEUIL;
    return `<td class="${isWin ? "win" : isElim ? "elim" : ""}">${sc != null ? Number(sc).toFixed(2) : "—"}</td>`;
  }).join("");

  return `<div class="tally-wrap"><table class="tally">
    <thead><tr><th class="who">Votant</th>${heads}<th class="moy-col">Moy.</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td class="who">Score (moy+méd)÷2</td>${foot}<td class="moy-col"></td></tr></tfoot>
  </table></div>`;
}

function wireDetail(resultats, vote, votants) {
  const sel   = document.getElementById("detail-select");
  const chart = document.getElementById("detail-chart");
  const tabs  = document.querySelectorAll(".seg-tab");
  let mode = "livre";

  const fillOptions = () => {
    if (mode === "livre") {
      sel.innerHTML = resultats.map((r, i) => {
        const l = livreById[r.livre_id];
        return `<option value="${i}">${esc(l?.titre ?? r.livre_id)}</option>`;
      }).join("");
    } else {
      sel.innerHTML = votants.map(id => {
        const m = membreById[id] || { nom: id };
        return `<option value="${id}">${esc(m.nom)}</option>`;
      }).join("");
    }
  };

  const renderByLivre = idx => {
    const r = resultats[idx];
    if (!r?.notes) { chart.innerHTML = `<div class="detail-avg">Aucune note individuelle.</div>`; return; }
    const sc = r.score ?? r.moyenne ?? null;
    const entries = Object.entries(r.notes).map(([id, n]) => ({ id, n: Number(n) })).sort((a, b) => b.n - a.n);
    chart.innerHTML = (sc != null ? `<div class="detail-avg">Score <b>${Number(sc).toFixed(2)}/5</b></div>` : "") +
      entries.map(e => {
        const m = membreById[e.id] || { nom: e.id };
        const pct = Math.round(e.n / 5 * 100);
        return `<div class="dbar-row"><div class="dbar-label">${esc(m.nom)}</div><div class="dbar-track"><div class="dbar-fill" style="width:${pct}%">${e.n}/5</div></div></div>`;
      }).join("");
  };

  const renderByVotant = mId => {
    const m = membreById[mId] || { nom: mId };
    const items = resultats
      .filter(r => r.notes?.[mId] != null)
      .map(r => ({ id: r.livre_id, n: Number(r.notes[mId]), elu: r.livre_id === vote.livre_elu && !vote.tour2 }))
      .sort((a, b) => b.n - a.n);
    if (!items.length) { chart.innerHTML = `<div class="detail-avg">N'a pas voté.</div>`; return; }
    const avg = items.reduce((s, x) => s + x.n, 0) / items.length;
    chart.innerHTML = `<div class="detail-avg">Moyenne de ${esc(m.nom)} : <b>${avg.toFixed(2)}/5</b></div>` +
      items.map((x, i) => {
        const l = livreById[x.id];
        const pct = Math.round(x.n / 5 * 100);
        return `<div class="dbar-row"><div class="dbar-label"><span class="rk">${i + 1}.</span>${esc(l?.titre ?? x.id)}</div><div class="dbar-track"><div class="dbar-fill ${x.elu ? "win" : ""}" style="width:${pct}%">${x.n}/5</div></div></div>`;
      }).join("");
  };

  const refresh = () => mode === "livre" ? renderByLivre(+sel.value) : renderByVotant(sel.value);

  tabs.forEach(tab => tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    mode = tab.dataset.tab;
    fillOptions();
    refresh();
  }));
  sel.addEventListener("change", refresh);
  fillOptions();
  refresh();
}

// ── Overlay ────────────────────────────────────────────────────────────────
function closeResult() {
  curResultVote = null;
  document.getElementById("result-overlay").classList.add("hidden");
}

function bindOverlay() {
  document.getElementById("result-overlay").addEventListener("click", e => {
    if (e.target.id === "result-overlay") closeResult();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeResult(); });
}

init().catch(console.error);
