import { db } from "../firebase-config.js";
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  setDoc, query, orderBy, limit, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Cellules ────────────────────────────────────────────────────────────────

export async function getCellules() {
  const snap = await getDocs(collection(db, "atelier_cellules"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addCellule({ q, r, biome, mots_cles, titre, description }) {
  const ref = await addDoc(collection(db, "atelier_cellules"), {
    q, r,
    biome,
    mots_cles,
    titre: titre || null,
    description,
    date_decouverte: serverTimestamp(),
    evenement_ids: [],
  });
  return ref.id;
}

export async function updateCellule(id, data) {
  await updateDoc(doc(db, "atelier_cellules", id), data);
}

export async function addEvenementToCellule(celluleId, evenementId) {
  const ref = doc(db, "atelier_cellules", celluleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const ids = snap.data().evenement_ids || [];
  await updateDoc(ref, { evenement_ids: [...ids, evenementId] });
}

// ─── Wiki ─────────────────────────────────────────────────────────────────────

export const WIKI_CATEGORIES = [
  "Lieux", "Créatures", "Plantes", "Personnages",
  "Factions", "Légendes", "Objets", "Coutumes", "Événements",
];

export async function getWikiEntries() {
  const snap = await getDocs(collection(db, "atelier_wiki"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addWikiEntry({ categorie, titre, mots_cles, contenu, source_type, source_id, cellule_id }) {
  const ref = await addDoc(collection(db, "atelier_wiki"), {
    categorie,
    titre,
    mots_cles: mots_cles || [],
    contenu,
    source_type: source_type || "manuel",
    source_id: source_id || null,
    cellule_id: cellule_id || null,
    cree_le: serverTimestamp(),
    mis_a_jour: serverTimestamp(),
  });
  return ref.id;
}

export async function updateWikiEntry(id, data) {
  await updateDoc(doc(db, "atelier_wiki", id), { ...data, mis_a_jour: serverTimestamp() });
}

export async function deleteWikiEntry(id) {
  await deleteDoc(doc(db, "atelier_wiki", id));
}

// ─── Oracles ──────────────────────────────────────────────────────────────────

export async function addOracle({ type_id, type_label, mots_cles }) {
  const ref = await addDoc(collection(db, "atelier_oracles"), {
    type_id,
    type_label,
    mots_cles,
    wiki_id: null,
    cree_le: serverTimestamp(),
  });
  return ref.id;
}

export async function linkOracleToWiki(oracleId, wikiId) {
  await updateDoc(doc(db, "atelier_oracles", oracleId), { wiki_id: wikiId });
}

export async function countOracles() {
  const snap = await getDocs(collection(db, "atelier_oracles"));
  return snap.size;
}

// ─── Événements ───────────────────────────────────────────────────────────────

export async function addEvenement({ cellule_id, cellule_biome, cellule_q, cellule_r, type_id, type_label, mots_cles, titre, description }) {
  const ref = await addDoc(collection(db, "atelier_evenements"), {
    cellule_id,
    cellule_biome,
    cellule_q,
    cellule_r,
    type_id,
    type_label,
    mots_cles,
    titre: titre || null,
    description,
    cree_le: serverTimestamp(),
  });
  return ref.id;
}

export async function countEvenements() {
  const snap = await getDocs(collection(db, "atelier_evenements"));
  return snap.size;
}

// ─── Actions (journal d'activité) ────────────────────────────────────────────

export async function logAction({ type, details, ref_id }) {
  const now = new Date();
  const date_str = now.toISOString().slice(0, 10);
  await addDoc(collection(db, "atelier_actions"), {
    type,
    details,
    ref_id: ref_id || null,
    date_str,
    timestamp: serverTimestamp(),
  });
}

export async function getRecentActions(n = 3) {
  const snap = await getDocs(collection(db, "atelier_actions"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0))
    .slice(0, n);
}

export async function getAllActions() {
  const snap = await getDocs(collection(db, "atelier_actions"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── TODO ─────────────────────────────────────────────────────────────────────

const TODO_INITIAL = [
  { texte: "Liste des biomes (et leur visuel sur la carte)", fait: false, ordre: 1 },
  { texte: "Règles de proximité des biomes et probabilités d'apparition", fait: false, ordre: 2 },
  { texte: "Définir l'échelle de la carte (ex : 1 hex = X km)", fait: false, ordre: 3 },
  { texte: "Mots clés aléatoires des cellules découvertes — compléter les pools", fait: false, ordre: 4 },
  { texte: "Compléter la liste des types d'oracles", fait: false, ordre: 5 },
  { texte: "Mots clés par type d'oracle — compléter et affiner", fait: false, ordre: 6 },
  { texte: "Compléter la liste des types d'événements", fait: false, ordre: 7 },
  { texte: "Mots clés associés à chaque type d'événement", fait: false, ordre: 8 },
  { texte: "Probabilités de chaque type d'événement", fait: false, ordre: 9 },
  { texte: "Définir le nom et le cadre de l'univers", fait: false, ordre: 10 },
  { texte: "Icônes ou symboles visuels distinctifs pour chaque biome sur la carte", fait: false, ordre: 11 },
  { texte: "Système de liens entre fiches wiki (références croisées)", fait: false, ordre: 12 },
];

export async function getTodos() {
  const snap = await getDocs(collection(db, "atelier_todo"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
}

export async function seedTodosIfEmpty() {
  const snap = await getDocs(collection(db, "atelier_todo"));
  if (!snap.empty) return;
  for (const item of TODO_INITIAL) {
    await addDoc(collection(db, "atelier_todo"), { ...item, cree_le: serverTimestamp() });
  }
}

export async function toggleTodo(id, fait) {
  await updateDoc(doc(db, "atelier_todo", id), { fait });
}

export async function deleteTodo(id) {
  await deleteDoc(doc(db, "atelier_todo", id));
}

export async function addTodo(texte) {
  const snap = await getDocs(collection(db, "atelier_todo"));
  const maxOrdre = snap.docs.reduce((m, d) => Math.max(m, d.data().ordre || 0), 0);
  await addDoc(collection(db, "atelier_todo"), {
    texte,
    fait: false,
    ordre: maxOrdre + 1,
    cree_le: serverTimestamp(),
  });
}

// ─── Suppression (mode test) ──────────────────────────────────────────────────

async function deleteCollection(name) {
  const snap = await getDocs(collection(db, name));
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, name, d.id))));
  return snap.size;
}

export async function deleteCellule(id) {
  await deleteDoc(doc(db, "atelier_cellules", id));
}

export const deleteAllCellules  = () => deleteCollection("atelier_cellules");
export const deleteAllWiki      = () => deleteCollection("atelier_wiki");
export const deleteAllOracles   = () => deleteCollection("atelier_oracles");
export const deleteAllEvenements= () => deleteCollection("atelier_evenements");
export const deleteAllActions   = () => deleteCollection("atelier_actions");

// ─── Stats globales ───────────────────────────────────────────────────────────

export async function getStats() {
  const [cellules, wiki, oracles, evenements] = await Promise.all([
    getDocs(collection(db, "atelier_cellules")),
    getDocs(collection(db, "atelier_wiki")),
    getDocs(collection(db, "atelier_oracles")),
    getDocs(collection(db, "atelier_evenements")),
  ]);
  return {
    cellules: cellules.size,
    wiki: wiki.size,
    oracles: oracles.size,
    evenements: evenements.size,
  };
}
