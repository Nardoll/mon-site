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

// Cache de session (évite de re-chercher un même livre dans la même page
// avant que le champ Firestore ne soit relu)
const sessionCache = new Map(); // livreId -> url|null

// Recherche la couverture en ligne. Renvoie une URL d'image ou null.
async function searchCover(titre, auteur) {
  titre = (titre || "").trim();
  if (!titre) return null;

  // 1) Open Library — gratuit, sans clé, CORS ouvert
  try {
    const params = new URLSearchParams({ title: titre, limit: "1", fields: "cover_i" });
    if (auteur) params.set("author", auteur);
    const res = await fetch(`https://openlibrary.org/search.json?${params}`);
    if (res.ok) {
      const data = await res.json();
      const cid = data.docs?.[0]?.cover_i;
      if (cid) return `https://covers.openlibrary.org/b/id/${cid}-L.jpg`;
    }
  } catch { /* réseau indisponible → on tente le repli */ }

  // 2) Google Books — repli, souvent meilleur sur les livres FR récents
  try {
    let term = `intitle:${titre}`;
    if (auteur) term += ` inauthor:${auteur}`;
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(term)}&maxResults=1`);
    if (res.ok) {
      const data = await res.json();
      const img = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
      if (img) return img.replace(/^http:/, "https:");
    }
  } catch { /* aucune couverture → fallback illustration générique */ }

  return null;
}

// Renvoie l'URL de couverture d'un livre (cache Firestore + session) ou null.
// Persiste le résultat (URL trouvée, ou "" si recherche infructueuse) pour
// éviter de réinterroger les API aux visites suivantes.
export async function resolveCover(livre) {
  if (!livre?.id) return null;

  // Déjà renseigné en base : "" = déjà cherché, rien trouvé ; URL = trouvé/manuel
  if (typeof livre.couverture_url === "string") {
    return livre.couverture_url || null;
  }
  if (sessionCache.has(livre.id)) return sessionCache.get(livre.id);

  const url = await searchCover(livre.titre, livre.auteur);
  sessionCache.set(livre.id, url);
  livre.couverture_url = url || ""; // maj de l'objet en mémoire
  try { await updateLivre(livre.id, { couverture_url: url || "" }); } catch { /* lecture seule possible */ }
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
    const img = document.createElement("img");
    img.className = "real-cover";
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("load", () => img.classList.add("loaded"));
    img.addEventListener("error", () => img.remove());
    img.src = url;
    el.appendChild(img);
  });
}
