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
const SEARCH_V = 3; // v3 : tentative par ISBN exact avant la recherche floue

// Cache de session (évite de re-chercher un même livre dans la même page
// avant que le champ Firestore ne soit relu)
const sessionCache = new Map(); // livreId -> url|null

// ── Sources ───────────────────────────────────────────────────────────
async function openLibrary(titre, auteur) {
  const p = new URLSearchParams({ title: titre, limit: "5", fields: "cover_i" });
  if (auteur) p.set("author", auteur);
  const res = await fetch(`https://openlibrary.org/search.json?${p}`);
  if (!res.ok) return null;
  const data = await res.json();
  const doc = (data.docs || []).find(d => d.cover_i);
  return doc ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null;
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

async function googleBooks(q) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`);
  if (!res.ok) return null;
  const data = await res.json();
  for (const it of (data.items || [])) {
    const links = it.volumeInfo?.imageLinks;
    const img = links?.thumbnail || links?.smallThumbnail;
    if (img) {
      return img.replace(/^http:/, "https:")
                .replace("&edge=curl", "")
                .replace("&zoom=1", "&zoom=2"); // un cran de résolution en plus
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
    () => openLibrary(titre, auteur),                                          // titre + auteur (Open Library)
    () => googleBooks(`intitle:${titre}${auteur ? ` inauthor:${auteur}` : ""}`), // titre + auteur ciblés (Google)
    () => googleBooks(`${titre} ${auteur}`.trim()),                            // requête souple (Google) — capte les éditions traduites
    () => auteur ? openLibrary(titre, "") : null,                             // titre seul (Open Library)
  ];

  for (const run of strategies) {
    try { const url = await run(); if (url) return url; } catch { /* on passe à la stratégie suivante */ }
  }
  return null;
}

// Renvoie l'URL de couverture d'un livre (cache Firestore + session) ou null.
// Persiste le résultat (URL trouvée, ou "" + version si infructueux) pour
// éviter de réinterroger les API aux visites suivantes.
export async function resolveCover(livre) {
  if (!livre?.id) return null;

  // Couverture déjà trouvée ou saisie à la main → on la garde telle quelle
  if (typeof livre.couverture_url === "string" && livre.couverture_url) {
    return livre.couverture_url;
  }
  if (sessionCache.has(livre.id)) return sessionCache.get(livre.id);

  // 1) ISBN exact (fourni par l'enrichissement IA) → couverture fiable
  if (livre.isbn13) {
    const isbnUrl = `https://covers.openlibrary.org/b/isbn/${livre.isbn13}-L.jpg?default=false`;
    if (await imageOk(isbnUrl)) {
      sessionCache.set(livre.id, isbnUrl);
      livre.couverture_url = isbnUrl;
      livre.couv_v = SEARCH_V;
      try { await updateLivre(livre.id, { couverture_url: isbnUrl, couv_v: SEARCH_V }); } catch { /* lecture seule possible */ }
      return isbnUrl;
    }
  }

  // Déjà cherché sans succès par l'algo actuel (et pas d'ISBN exploitable) → rien
  if (typeof livre.couverture_url === "string" && (livre.couv_v || 0) >= SEARCH_V) return null;

  // 2) Recherche floue par titre + auteur (repli)
  const url = await searchCover(livre.titre, livre.auteur);
  sessionCache.set(livre.id, url);
  livre.couverture_url = url || ""; // maj de l'objet en mémoire
  livre.couv_v = SEARCH_V;
  try { await updateLivre(livre.id, { couverture_url: url || "", couv_v: SEARCH_V }); } catch { /* lecture seule possible */ }
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
