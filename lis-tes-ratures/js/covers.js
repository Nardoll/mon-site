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
const SEARCH_V = 2;

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

  if (typeof livre.couverture_url === "string") {
    if (livre.couverture_url) return livre.couverture_url;       // trouvé / saisi à la main → on garde
    if ((livre.couv_v || 0) >= SEARCH_V) return null;            // déjà cherché par l'algo actuel, rien trouvé
    // sinon : recherche infructueuse d'une version antérieure → on retente
  }
  if (sessionCache.has(livre.id)) return sessionCache.get(livre.id);

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
