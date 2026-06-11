// ─────────────────────────────────────────────────────────────────────
//  covers.js — Couvertures réelles des livres
//
//  Récupère la couverture d'un livre à partir de son titre + auteur via
//  des bases publiques gratuites (Open Library, puis Google Books en repli).
//  Aucune image n'est stockée : seule l'URL trouvée est mémorisée dans le
//  document Firestore du livre (champ `couverture_url`) pour ne pas refaire
//  la requête à chaque chargement et permettre une correction manuelle.
//
//  Le basculement « illustrations génériques ↔ vraies couvertures » est
//  piloté par un toggle dans la sidebar (clé localStorage `ltr_covers`).
// ─────────────────────────────────────────────────────────────────────
import { updateLivre } from "./db.js";

export const COVERS_KEY = "ltr_covers";

export function coversOn() {
  return localStorage.getItem(COVERS_KEY) === "1";
}

export function setCovers(on) {
  localStorage.setItem(COVERS_KEY, on ? "1" : "0");
}

// Version de l'algo de recherche. Bumper ce nombre relance la recherche sur
// les livres cherchés sans succès par une version antérieure (les couvertures
// déjà trouvées et les URL manuelles ne sont jamais retouchées).
const SEARCH_V = 5; // v5 : couverture auto séparée (couv_cache) de l'override manuel (couverture_url)

// Cache de session (évite de re-chercher un même livre dans la même page
// avant que le champ Firestore ne soit relu)
const sessionCache = new Map(); // livreId -> url|null

// ── Validation titre/auteur ───────────────────────────────────────────
// On ne retient une couverture QUE si le livre derrière partage un mot du
// titre OU de l'auteur. Évite d'afficher « Harry Potter » sur « La Vague »
// (ISBN erroné de l'IA, ou mauvais résultat de recherche floue).
function normWords(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
}
function candMatches(titre, auteur, candTitle, candAuthor) {
  const exT = normWords(candTitle), exA = normWords(candAuthor);
  if (!exT.length && !exA.length) return false;
  const inT = normWords(titre).filter(w => w.length >= 3 || /^[0-9]+$/.test(w));
  const inA = normWords(auteur).filter(w => w.length >= 3);
  const tOk = inT.some(w => exT.includes(w));
  const aOk = inA.some(w => exA.includes(w));
  return tOk || aOk;
}

// Vérifie qu'une URL pointe vers une vraie image (pas un placeholder 1×1 ni un 404)
function imageOk(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 1 && img.naturalHeight > 1);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

// ── Sources (chacune valide le livre avant de renvoyer une couverture) ──

// Couverture par ISBN, mais SEULEMENT après avoir vérifié que cet ISBN
// correspond bien au livre attendu (l'IA peut se tromper de chiffres).
async function isbnCover(isbn, titre, auteur) {
  try {
    const r = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`);
    if (!r.ok) return null;
    const data = await r.json();
    const rec = data[`ISBN:${isbn}`];
    if (!rec) return null; // ISBN inconnu d'Open Library → on ne s'y fie pas
    const candAuthor = (rec.authors || []).map(a => a.name).join(" ");
    if (!candMatches(titre, auteur, rec.title, candAuthor)) return null; // ISBN d'un autre livre
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    return (await imageOk(url)) ? url : null;
  } catch { return null; }
}

async function openLibrary(titre, auteur) {
  const p = new URLSearchParams({ title: titre, limit: "5", fields: "cover_i,title,author_name" });
  if (auteur) p.set("author", auteur);
  const res = await fetch(`https://openlibrary.org/search.json?${p}`);
  if (!res.ok) return null;
  const data = await res.json();
  for (const d of (data.docs || [])) {
    if (!d.cover_i) continue;
    if (candMatches(titre, auteur, d.title, (d.author_name || []).join(" "))) {
      return `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`;
    }
  }
  return null;
}

async function googleBooks(q, titre, auteur) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`);
  if (!res.ok) return null;
  const data = await res.json();
  for (const it of (data.items || [])) {
    const vi = it.volumeInfo || {};
    const img = vi.imageLinks?.thumbnail || vi.imageLinks?.smallThumbnail;
    if (!img) continue;
    if (candMatches(titre, auteur, vi.title, (vi.authors || []).join(" "))) {
      return img.replace(/^http:/, "https:").replace("&edge=curl", "").replace("&zoom=1", "&zoom=2");
    }
  }
  return null;
}

// Recherche la couverture en ligne. Plusieurs stratégies en cascade, on
// renvoie la première qui aboutit. Renvoie une URL d'image ou null.
async function searchCover(titre, auteur) {
  titre = (titre || "").trim();
  auteur = (auteur || "").trim();
  if (!titre) return null;

  const strategies = [
    () => openLibrary(titre, auteur),                                                       // titre + auteur (Open Library)
    () => googleBooks(`intitle:${titre}${auteur ? ` inauthor:${auteur}` : ""}`, titre, auteur), // titre + auteur ciblés (Google)
    () => googleBooks(`${titre} ${auteur}`.trim(), titre, auteur),                          // requête souple (Google)
    () => auteur ? openLibrary(titre, "") : null,                                           // titre seul (Open Library)
  ];

  for (const run of strategies) {
    try { const url = await run(); if (url) return url; } catch { /* on passe à la stratégie suivante */ }
  }
  return null;
}

// Une URL est dite « auto » si elle provient d'une source de couvertures
// (Open Library / Google Books) — par opposition à une URL collée à la main.
const AUTO_URL_RE = /covers\.openlibrary\.org|googleapis\.com|googleusercontent\.com|books\.google/i;
export function isAutoUrl(u) { return !!u && AUTO_URL_RE.test(u); }

// Renvoie l'URL de couverture d'un livre, ou null.
// Priorité : (1) couverture MANUELLE (URL collée par l'utilisateur dans
// `couverture_url`) → (2) couverture AUTO en cache (`couv_cache`, versionnée
// par `couv_v`) → (3) re-résolution (ISBN validé, puis recherche floue validée).
export async function resolveCover(livre) {
  if (!livre?.id) return null;

  // 1) Override manuel : une couverture_url qui n'est PAS une URL auto
  const cu = livre.couverture_url;
  if (cu && !isAutoUrl(cu)) return cu;

  // 2) Cache auto à jour (couv_cache ; ou ancienne couverture_url auto = legacy)
  let cached;
  if (livre.couv_cache !== undefined && livre.couv_cache !== null) cached = livre.couv_cache; // peut être "" (rien trouvé)
  else cached = isAutoUrl(cu) ? cu : null;
  if ((livre.couv_v || 0) >= SEARCH_V) return cached || null;

  if (sessionCache.has(livre.id)) return sessionCache.get(livre.id);

  // 3) Re-résolution : ISBN validé d'abord, puis recherche floue validée
  let url = null;
  if (livre.isbn13) url = await isbnCover(livre.isbn13, livre.titre, livre.auteur);
  if (!url) url = await searchCover(livre.titre, livre.auteur);

  sessionCache.set(livre.id, url);
  livre.couv_cache = url || "";   // "" = cherché, rien trouvé
  livre.couv_v = SEARCH_V;
  try { await updateLivre(livre.id, { couv_cache: url || "", couv_v: SEARCH_V }); } catch { /* lecture seule possible */ }
  return url;
}

// Superpose la vraie couverture sur un élément « couverture générique »
// (.bk-face, .lm-cover, .fiche-cover, .elim-card). Si aucune couverture
// n'est trouvée, l'illustration générique reste affichée.
export function hydrateCover(el, livre) {
  if (!el || !coversOn() || !livre) return;
  if (el.querySelector(".real-cover")) return; // évite les doublons au re-render
  resolveCover(livre).then(url => {
    if (!url || !coversOn()) return;
    if (el.querySelector(".real-cover")) return;
    // Conteneur : fond flou (rempli, via background-image) + couverture entière au-dessus
    const wrap = document.createElement("div");
    wrap.className = "real-cover";
    wrap.style.backgroundImage = `url("${url}")`;
    const img = document.createElement("img");
    img.className = "real-cover-img";
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("load", () => wrap.classList.add("loaded"));
    img.addEventListener("error", () => wrap.remove());
    img.src = url;
    wrap.appendChild(img);
    el.appendChild(wrap);
  });
}
