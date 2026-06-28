import { requireAuth } from "./auth.js";
import {
  getMembres, getLivres, getVotes, getReunions,
  getCommentairesForMembre, addMembre, updateMembreInfos,
} from "./db.js";
import { initNav } from "./nav.js";
import { formatMois, formatDate, initiales } from "./utils.js";
import { hydrateCover, coversOn, removeAllCovers } from "./covers.js";

await requireAuth();

// ── Constantes ──────────────────────────────────────────────────────────────
const PALETTE = [
  "#b5572d","#3f7a52","#6840d8","#bf8a2f","#5a7d8c",
  "#a8503f","#3f5340","#8a5a6b","#46708a","#9a6a2f",
];
const COVERS = [
  ["#46607a","#2c3d4f"], ["#5a4326","#3a2b18"], ["#6a3330","#42201d"],
  ["#3a3a3a","#222222"], ["#2f4a5c","#1d2f3d"], ["#3f3550","#262033"],
  ["#5a6b7a","#37434f"], ["#6b5a2f","#46401f"], ["#2f3a30","#1d251e"],
  ["#6b4a52","#432d36"],
];

const IC = {
  plus:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
  book:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h6v16H6a1 1 0 0 1-1-1z"/><path d="M11 4h2.5l3.5.6-2.2 14-3.8-.6z"/><path d="M19 20H6"/></svg>`,
  chat:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="1em" height="1em" style="vertical-align:middle;flex-shrink:0"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.9-5.5a8.38 8.38 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg>`,
  note:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 10h7M8 14h5"/></svg>`,
  ballot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M8 8V5a4 4 0 0 1 8 0v3M9 13h6"/></svg>`,
  edit:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
};

// ── État global ─────────────────────────────────────────────────────────────
let membres = [], livres = [], votes = [], reunions = [];
const livreById        = {};
const livresByMembre   = {}; // membre_id → livre[]
const reunionsByMembre = {}; // membre_id → reunion[]
const votesByMembre    = {}; // membre_id → { vote_id: { v, ballot: {livre_id: note} } }
const nbExceptByMembre = {}; // membre_id → nb votes exceptionnels

// ── Helpers ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function noStr(i) { return "Nº " + String(i + 1).padStart(3, "0"); }
function shortDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
function stars5(n) { return "★".repeat(n) + "☆".repeat(5 - n); }

// ── Init ────────────────────────────────────────────────────────────────────
async function init() {
  initNav("membres");

  [membres, livres, votes, reunions] = await Promise.all([
    getMembres(), getLivres(), getVotes(), getReunions(),
  ]);

  // Index livres + regroupement par proposant
  livres.forEach((l, i) => {
    livreById[l.id] = l;
    l._cover = COVERS[i % COVERS.length];
    const mid = l.propose_par;
    if (mid) {
      if (!livresByMembre[mid]) livresByMembre[mid] = [];
      livresByMembre[mid].push(l);
    }
  });

  // Regroupement réunions par participant OU lecteur du livre
  reunions.forEach(r => {
    const presents = new Set(r.participant_ids || []);
    // Participants présents à la réunion
    presents.forEach(mid => {
      if (!reunionsByMembre[mid]) reunionsByMembre[mid] = [];
      reunionsByMembre[mid].push({ r, present: true });
    });
    // Lecteurs du livre absents de la réunion
    (r.lecteurs_ids || []).forEach(mid => {
      if (presents.has(mid)) return;
      if (!reunionsByMembre[mid]) reunionsByMembre[mid] = [];
      reunionsByMembre[mid].push({ r, present: false });
    });
  });

  // Regroupement votes par membre — hors votes exceptionnels (hors système /5)
  votes.filter(v => !v.exceptionnel).forEach(v => {
    (v.resultats || []).forEach(r => {
      if (!r.notes) return;
      Object.entries(r.notes).forEach(([mid, note]) => {
        if (!votesByMembre[mid]) votesByMembre[mid] = {};
        if (!votesByMembre[mid][v.id]) votesByMembre[mid][v.id] = { v, ballot: {} };
        votesByMembre[mid][v.id].ballot[r.livre_id] = note;
      });
    });
  });

  // Compte des votes exceptionnels par membre (pour le total affiché — pas la liste)
  votes.filter(v => v.exceptionnel).forEach(v => {
    Object.keys(v.sondage || {}).forEach(mid => {
      nbExceptByMembre[mid] = (nbExceptByMembre[mid] || 0) + 1;
    });
  });

  membres.forEach((m, i) => { m._color = PALETTE[i % PALETTE.length]; });

  renderRack();

  // Auto-ouvrir un membre depuis l'URL ?open=ID (ex: frise "Notre parcours")
  const openId = new URLSearchParams(location.search).get("open");
  if (openId) openMember(openId);

  document.getElementById("btn-add").addEventListener("click", openAdd);
  document.getElementById("member-overlay").addEventListener("click", e => {
    if (e.target.id === "member-overlay") closeMember();
  });
  document.getElementById("add-overlay").addEventListener("click", e => {
    if (e.target.id === "add-overlay") closeAdd();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeMember(); closeAdd(); }
  });
}

// ── Grille de fiches ─────────────────────────────────────────────────────────
function renderRack() {
  const rack = document.getElementById("rack");
  if (!membres.length) {
    rack.innerHTML = `<p style="color:var(--muted);grid-column:1/-1">Aucun membre enregistré.</p>`;
    return;
  }

  rack.innerHTML = membres.map((m, i) => {
    const props    = livresByMembre[m.id] || [];
    const nbProp   = props.length;
    const nbElus   = props.filter(l => l.statut === "elu").length;
    const nbVotes  = Object.keys(votesByMembre[m.id] || {}).length + (nbExceptByMembre[m.id] || 0);
    const isNew    = nbProp === 0 && nbVotes === 0;

    // Tampons de dates (max 4 propositions, les plus récentes en premier)
    const stamps = props.slice(0, 4).map((l, k) => {
      const rot = (k % 2 ? 1 : -1) * (1.5 + k * 0.4);
      return `<span class="fp-datestamp ${l.statut === "elu" ? "elu" : ""}" style="--rot:${rot}deg">${shortDate(l.date_proposition)}</span>`;
    }).join("");
    const more = nbProp > 4
      ? `<span class="fp-datestamp more">+${nbProp - 4}</span>`
      : "";
    const stampsBlock = nbProp
      ? `<div class="fp-dates-label">Propositions déposées</div><div class="fp-stamps">${stamps}${more}</div>`
      : `<div class="fp-dates-label">Propositions déposées</div><div class="fp-stamps"><span class="fp-empty">Aucune proposition.</span></div>`;

    const foot = isNew
      ? `<span class="fp-newtag">Nouveau lecteur</span>`
      : [
          `<span class="fp-stat"><b>${nbProp}</b> proposition${nbProp > 1 ? "s" : ""}</span>`,
          nbElus ? `<span class="fp-stat g"><b>${nbElus}</b> élu${nbElus > 1 ? "s" : ""}</span>` : "",
          `<span class="fp-stat"><b>${nbVotes}</b> vote${nbVotes > 1 ? "s" : ""}</span>`,
        ].join("");

    return `
      <article class="fp" data-id="${esc(m.id)}" style="--mc:${m._color}">
        <div class="fp-notch"></div>
        <div class="fp-head">
          <span class="fp-libname">Carte de lecteur</span>
          <span class="fp-no">${noStr(i)}</span>
        </div>
        <div class="fp-stamp-row">
          <div class="fp-stamp"><span>${initiales(m.nom)}</span></div>
          <div class="fp-id">
            <div class="fp-name">${esc(m.nom)}</div>
            <div class="fp-since">inscrit·e le ${formatDate(m.date_arrivee)}</div>
          </div>
        </div>
        ${stampsBlock}
        <div class="fp-foot">${foot}</div>
      </article>`;
  }).join("");

  document.querySelectorAll(".fp").forEach(el =>
    el.addEventListener("click", () => openMember(el.dataset.id))
  );
}

// ── Fiche lecteur (overlay) ──────────────────────────────────────────────────
async function openMember(membreId) {
  const m = membres.find(x => x.id === membreId);
  if (!m) return;
  const paper = document.getElementById("member-paper");

  // Ouvrir l'overlay avec spinner pendant le chargement des commentaires
  paper.innerHTML = `<div style="text-align:center;padding:3rem;color:#a98a5c">Chargement…</div>`;
  document.getElementById("member-overlay").classList.remove("hidden");

  // Lazy-load commentaires uniquement pour ce membre
  const commentaires = await getCommentairesForMembre(m.id);

  const props    = livresByMembre[m.id] || [];
  const reus     = reunionsByMembre[m.id] || [];
  const votesObj = votesByMembre[m.id] || {};
  const nbProp   = props.length;
  const nbVotes  = Object.keys(votesObj).length + (nbExceptByMembre[m.id] || 0);

  // ── Livres proposés ──────────────────────────────────────────────────────
  const propsHtml = nbProp
    ? `<div class="rf-props">${props.map(l => {
        const [g1, g2] = l._cover;
        const tagMap = {
          elu:            ["elu",  "Élu"],
          refuse:         ["elim", "Éliminé"],
          en_proposition: ["prop", "En proposition"],
        };
        const [cls, label] = tagMap[l.statut] || ["prop", "En proposition"];
        return `<div class="rf-prop" data-id="${esc(l.id)}">
          <span class="rf-prop-cover" style="--g1:${g1};--g2:${g2}"></span>
          <div class="rf-prop-main">
            <div class="rf-prop-title">${esc(l.titre)}</div>
            <div class="rf-prop-author">${esc(l.auteur || "")}</div>
          </div>
          <span class="rf-prop-date">${formatDate(l.date_proposition)}</span>
          <span class="rf-tag ${cls}">${label}</span>
        </div>`;
      }).join("")}</div>`
    : `<div class="rf-empty">Aucune proposition.</div>`;

  // ── Commentaires regroupés par livre ─────────────────────────────────────
  const cmtByLivre = {};
  commentaires.forEach(c => {
    if (!cmtByLivre[c.livre_id]) cmtByLivre[c.livre_id] = [];
    cmtByLivre[c.livre_id].push(c);
  });
  // Trier chaque groupe par avancement
  Object.values(cmtByLivre).forEach(arr =>
    arr.sort((a, b) => (a.avancement ?? 99999) - (b.avancement ?? 99999))
  );

  const cmtEntries = Object.entries(cmtByLivre);
  const cmtHtml = cmtEntries.length
    ? cmtEntries.map(([livreId, items], ci) => {
        const titre = livreById[livreId]?.titre || "Livre inconnu";
        return `
        <div class="rf-row">
          <div class="rf-row-head" data-cmt="${ci}">
            <span class="rf-row-title">${esc(titre)}</span>
            <span class="rf-row-sub">${items.length} commentaire${items.length > 1 ? "s" : ""}</span>
            <span class="rf-row-chev">›</span>
          </div>
          <div class="rf-row-body hidden">${items.map(it => {
            const livreUnite = livreById[livreId]?.progression_unite;
            const unitPfx = livreUnite === 'chapitres' ? 'ch.' : livreUnite === 'parties' ? 'par.' : 'p.';
            const adv  = it.avancement != null ? `${unitPfx}${it.avancement}` : (it.titre || "Note");
            const date = formatDate(it.date_commentaire);
            return `
            <div class="rf-cmt">
              <div class="rf-cmt-head">
                <span class="rf-cmt-label"><b>${esc(m.nom)}</b><span class="rf-cmt-adv"> — ${esc(adv)}</span></span>
                <span class="rf-cmt-date">${date}</span>
                <span class="rf-cmt-chev">›</span>
              </div>
              <div class="rf-cmt-detail hidden">
                <div class="rf-cmt-text">${esc(it.contenu)}</div>
              </div>
            </div>`;
          }).join("")}
          <a href="commentaires.html?livre=${livreId}"
             style="display:inline-flex;align-items:center;gap:.35rem;font-size:.8rem;font-weight:600;color:var(--accent);text-decoration:none;margin:.55rem 0 .15rem;padding-left:.2rem">
            ${IC.chat} Voir tous les commentaires →
          </a>
          </div>
        </div>`;
      }).join("")
    : `<div class="rf-empty">Aucun commentaire enregistré.</div>`;

  // ── Réunions ──────────────────────────────────────────────────────────────
  const reusSorted = reus.slice().sort((a, b) =>
    a.r.annee !== b.r.annee ? a.r.annee - b.r.annee : a.r.mois - b.r.mois
  );
  const reuHtml = reusSorted.length
    ? `<div class="rf-reunions">${reusSorted.map(({ r, present }) => {
        const titre = livreById[r.livre_id]?.titre || "—";
        const note  = r.notes_finales?.[m.id];
        const absentTag = !present ? ` <em class="rf-absent-badge">absent·e</em>` : "";
        const noteHtml  = note != null ? `${note}<small>/10</small>` : (!present ? "" : "—");
        return `<div class="rf-reunion${!present ? " rf-reunion-absent" : ""}">
          <span class="rf-reunion-mois">${formatMois(r.mois, r.annee)}</span>
          <span class="rf-reunion-livre">${esc(titre)}${absentTag}</span>
          ${noteHtml ? `<span class="rf-reunion-note">${noteHtml}</span>` : ""}
        </div>`;
      }).join("")}</div>`
    : `<div class="rf-empty">Aucune réunion enregistrée.</div>`;

  // ── Votes ─────────────────────────────────────────────────────────────────
  const votesArr = Object.values(votesObj)
    .sort((a, b) => b.v.annee !== a.v.annee ? b.v.annee - a.v.annee : b.v.mois - a.v.mois);
  const voteHtml = votesArr.length
    ? buildVoteSection(votesArr)
    : `<div class="rf-empty">Aucune participation enregistrée.</div>`;

  // ── Assemblage ────────────────────────────────────────────────────────────
  paper.innerHTML = `
    <button class="paper-close" id="member-close" aria-label="Fermer">✕</button>
    <div class="rf-head">
      <div class="rf-stamp" style="--mc:${m._color}">${initiales(m.nom)}</div>
      <div class="rf-head-info">
        <div class="rf-name">${esc(m.nom)}</div>
        <div class="rf-since">Lecteur·rice depuis le ${formatDate(m.date_arrivee)}</div>
        <div class="rf-meta">${nbProp} proposition${nbProp > 1 ? "s" : ""}<span class="sep">·</span>${nbVotes} vote${nbVotes > 1 ? "s" : ""}</div>
      </div>
      <button class="rf-edit" id="member-edit">${IC.edit} Modifier</button>
    </div>

    <div class="rf-divider"></div>
    <div class="rf-sec-title">${IC.book} Livres proposés</div>
    ${propsHtml}

    <div class="rf-divider"></div>
    <div class="rf-sec-title">${IC.chat} Commentaires de lecture</div>
    ${cmtHtml}

    <div class="rf-divider"></div>
    <div class="rf-sec-title">${IC.note} Réunions</div>
    ${reuHtml}

    <div class="rf-divider"></div>
    <div class="rf-sec-title">${IC.ballot} Participation aux votes</div>
    ${voteHtml}`;

  paper.scrollTop = 0;

  document.getElementById("member-close").addEventListener("click", closeMember);
  document.getElementById("member-edit").addEventListener("click", () => openEdit(m));

  // Commentaires repliables par livre
  paper.querySelectorAll(".rf-row-head[data-cmt]").forEach(h => {
    h.addEventListener("click", () => toggleRow(h));
  });
  // Texte de commentaire (anti-spoiler)
  paper.querySelectorAll(".rf-cmt-head").forEach(h => {
    h.addEventListener("click", e => { e.stopPropagation(); toggleRow(h); });
  });

  wireVoteSearch(votesArr);

  // Vraies couvertures sur les livres proposés
  if (coversOn()) paper.querySelectorAll(".rf-prop[data-id]").forEach(row => {
    hydrateCover(row.querySelector(".rf-prop-cover"), livreById[row.dataset.id]);
  });
}

// Toggle « vraies couvertures » : ré-hydrate ou retire sur la fiche ouverte
document.addEventListener("ltr-covers-change", e => {
  const paper = document.getElementById("member-paper");
  if (e.detail?.on) {
    paper.querySelectorAll(".rf-prop[data-id]").forEach(row => {
      hydrateCover(row.querySelector(".rf-prop-cover"), livreById[row.dataset.id]);
    });
  } else {
    removeAllCovers(paper);
  }
});

function toggleRow(h) {
  const body = h.nextElementSibling;
  const chev = h.querySelector(".rf-row-chev, .rf-cmt-chev");
  const nowOpen = body.classList.toggle("hidden");
  h.classList.toggle("open", !nowOpen);
  if (chev) chev.classList.toggle("open", !nowOpen);
}

function closeMember() {
  document.getElementById("member-overlay").classList.add("hidden");
}

// ── Votes repliables + recherche ─────────────────────────────────────────────
function buildVoteSection(votesArr) {
  const titles = [...new Set(
    votesArr.flatMap(({ ballot }) => Object.keys(ballot).map(lid => livreById[lid]?.titre).filter(Boolean))
  )].sort();
  const opts = titles.map(t => `<option value="${esc(t)}">`).join("");
  return `
    <input type="text" class="rf-search" id="rf-vote-search" list="rf-vote-books" autocomplete="off" placeholder="Rechercher un livre ou un mois…" />
    <datalist id="rf-vote-books">${opts}</datalist>
    <div id="rf-vote-list">${voteRows(votesArr)}</div>`;
}

function voteRows(votesArr) {
  return votesArr.map((entry, vi) => {
    const { v, ballot } = entry;
    const sorted = Object.entries(ballot)
      .map(([lid, n]) => ({ titre: livreById[lid]?.titre || lid, note: Number(n) }))
      .sort((a, b) => b.note - a.note);
    if (!sorted.length) return "";
    const premier = sorted[0];
    return `
    <div class="rf-row" data-vote="${vi}">
      <div class="rf-row-head" data-votehead="${vi}">
        <span class="rf-row-title">${formatMois(v.mois, v.annee)}</span>
        <span class="rf-row-sub rf-vote-premier">1ᵉʳ : <b>${esc(premier.titre)}</b> (${premier.note}/5) · ${sorted.length} livre${sorted.length > 1 ? "s" : ""}</span>
        <span class="rf-row-chev">›</span>
      </div>
      <div class="rf-row-body hidden">
        <div class="rf-ballot">${sorted.map(b =>
          `<span class="rf-ballot-book ${b === premier ? "elu" : ""}">${esc(b.titre)}</span><span class="rf-ballot-stars">${stars5(b.note)}</span>`
        ).join("")}</div>
      </div>
    </div>`;
  }).join("");
}

function wireVoteSearch(votesArr) {
  const bindRows = () => document.querySelectorAll("#rf-vote-list .rf-row-head[data-votehead]").forEach(h => {
    h.addEventListener("click", () => toggleRow(h));
  });
  bindRows();

  const search = document.getElementById("rf-vote-search");
  if (!search) return;

  // Index titre → livre_id pour détecter une sélection exacte depuis la datalist
  const titreToLid = {};
  votesArr.forEach(({ ballot }) => {
    Object.keys(ballot).forEach(lid => {
      const t = livreById[lid]?.titre;
      if (t) titreToLid[t.toLowerCase()] = lid;
    });
  });

  search.addEventListener("input", () => {
    const q = search.value.trim();
    const qLow = q.toLowerCase();
    const list = document.getElementById("rf-vote-list");

    if (!q) {
      list.innerHTML = voteRows(votesArr);
      bindRows();
      return;
    }

    // Sélection exacte d'un livre (via datalist ou frappe précise) → vue ciblée
    const matchedLid = titreToLid[qLow];
    if (matchedLid) {
      const titre = livreById[matchedLid]?.titre || q;
      const entries = votesArr.filter(({ ballot }) => matchedLid in ballot);
      list.innerHTML = entries.length
        ? `<div class="rf-book-focus">
            <div class="rf-book-focus-title">Notes pour <em>${esc(titre)}</em></div>
            ${entries.map(({ v, ballot }) => {
              const note = Number(ballot[matchedLid]);
              return `<div class="rf-book-focus-row">
                <span class="rf-book-focus-mois">${formatMois(v.mois, v.annee)}</span>
                <span class="rf-ballot-stars">${stars5(note)}</span>
                <span class="rf-book-focus-note">${note}/5</span>
              </div>`;
            }).join("")}
          </div>`
        : `<div class="rf-empty">Aucun vote pour ce livre.</div>`;
      return;
    }

    // Filtre souple par mois ou titre partiel
    const filtered = votesArr.filter(({ v, ballot }) => {
      if (formatMois(v.mois, v.annee).toLowerCase().includes(qLow)) return true;
      return Object.keys(ballot).some(lid =>
        (livreById[lid]?.titre || "").toLowerCase().includes(qLow)
      );
    });
    list.innerHTML = filtered.length
      ? voteRows(filtered)
      : `<div class="rf-empty">Aucun vote ne correspond.</div>`;
    bindRows();
  });
}

// ── Modifier un membre ───────────────────────────────────────────────────────
function openEdit(m) {
  const iso = m.date_arrivee
    ? (m.date_arrivee.toDate ? m.date_arrivee.toDate() : new Date(m.date_arrivee))
        .toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  fillAddPaper({
    eyebrow:  "Casier des lecteurs",
    title:    "Modifier la fiche",
    nomValue: m.nom,
    dateValue: iso,
    okLabel:  "Enregistrer",
    onOk: async (nom, date_arrivee) => {
      await updateMembreInfos(m.id, { nom, date_arrivee });
      // Mettre à jour localement
      m.nom = nom;
      m.date_arrivee = { toDate: () => new Date(date_arrivee) };
      renderRack();
      closeAdd();
      toast(`Fiche de « ${nom} » mise à jour.`);
    },
  });
}

// ── Ajouter un membre ────────────────────────────────────────────────────────
function openAdd() {
  fillAddPaper({
    eyebrow:   "Casier des lecteurs",
    title:     "Nouvelle fiche de lecteur",
    nomValue:  "",
    dateValue: new Date().toISOString().slice(0, 10),
    okLabel:   "Tamponner la fiche",
    onOk: async (nom, date_arrivee) => {
      await addMembre({ nom, date_arrivee });
      membres = await getMembres();
      membres.forEach((mb, i) => { mb._color = PALETTE[i % PALETTE.length]; });
      renderRack();
      closeAdd();
      toast(`Fiche de « ${nom} » ajoutée au casier.`);
    },
  });
}

function fillAddPaper({ eyebrow, title, nomValue, dateValue, okLabel, onOk }) {
  const paper = document.getElementById("add-paper");
  paper.innerHTML = `
    <button class="paper-close" id="add-close" aria-label="Fermer">✕</button>
    <div class="pf-eyebrow">${eyebrow}</div>
    <div class="pf-title">${title}</div>
    <div class="pf-group">
      <label>Nom <span class="req">*</span></label>
      <input type="text" class="pf-input" id="add-name" value="${esc(nomValue)}" placeholder="Prénom Nom" autocomplete="off" />
    </div>
    <div class="pf-group">
      <label>Date d'arrivée</label>
      <input type="date" class="pf-input" id="add-date" value="${dateValue}" />
    </div>
    <div class="pf-foot">
      <button class="pf-btn cancel" id="add-cancel">Annuler</button>
      <button class="pf-btn ok" id="add-ok">${okLabel}</button>
    </div>`;

  document.getElementById("add-overlay").classList.remove("hidden");

  const close = () => closeAdd();
  document.getElementById("add-close").addEventListener("click", close);
  document.getElementById("add-cancel").addEventListener("click", close);
  document.getElementById("add-name").focus();

  const submit = async () => {
    const nom = document.getElementById("add-name").value.trim();
    if (!nom) {
      document.getElementById("add-name").style.borderColor = "#b0444a";
      return;
    }
    const date_arrivee = document.getElementById("add-date").value;
    const btn = document.getElementById("add-ok");
    btn.disabled = true; btn.textContent = "Enregistrement…";
    try {
      await onOk(nom, date_arrivee);
    } catch (err) {
      btn.disabled = false; btn.textContent = okLabel;
      toast("Erreur : " + err.message);
    }
  };

  document.getElementById("add-ok").addEventListener("click", submit);
  document.getElementById("add-name").addEventListener("keydown", e => {
    if (e.key === "Enter") submit();
  });
}

function closeAdd() {
  document.getElementById("add-overlay").classList.add("hidden");
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastT;
function toast(msg) {
  const t = document.getElementById("mtoast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.remove("show"), 2600);
}

init().catch(console.error);
