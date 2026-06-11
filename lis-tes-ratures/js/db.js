import {
  getFirestore, collection, doc,
  getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, Timestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

// ── Helpers ────────────────────────────────────────────────────────

function snap(querySnapshot) {
  return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Membres ────────────────────────────────────────────────────────

export async function getMembres() {
  const s = await getDocs(collection(db, "membres"));
  return snap(s).sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? "", "fr"));
}

export async function getMembreById(id) {
  const d = await getDoc(doc(db, "membres", id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

export async function addMembre({ nom, date_arrivee }) {
  return addDoc(collection(db, "membres"), {
    nom,
    date_arrivee: Timestamp.fromDate(new Date(date_arrivee)),
    cree_le: serverTimestamp()
  });
}

// ── Livres ─────────────────────────────────────────────────────────

export async function getLivres() {
  const s = await getDocs(collection(db, "livres"));
  return snap(s).sort((a, b) => (b.date_proposition?.seconds ?? 0) - (a.date_proposition?.seconds ?? 0));
}

export async function getLivreById(id) {
  const d = await getDoc(doc(db, "livres", id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

export async function addLivre({ titre, auteur, annee, propose_par, date_proposition, statut = "en_proposition", nb_pages, genre, description_3_mots, isbn13 }) {
  return addDoc(collection(db, "livres"), {
    titre,
    auteur: auteur || "",
    annee: annee ? Number(annee) : null,
    propose_par: propose_par || "",
    date_proposition: date_proposition
      ? Timestamp.fromDate(new Date(date_proposition))
      : serverTimestamp(),
    statut,
    nb_pages: nb_pages ? Number(nb_pages) : null,
    genre: genre || null,
    description_3_mots: description_3_mots || null,
    isbn13: isbn13 || null,
    cree_le: serverTimestamp()
  });
}

export async function updateLivre(id, data) {
  return updateDoc(doc(db, "livres", id), data);
}

export async function updateLivreInfos(id, { titre, auteur, annee, propose_par, date_proposition, nb_pages, genre, description_3_mots, couverture_url, isbn13 }) {
  return updateDoc(doc(db, "livres", id), {
    titre,
    auteur: auteur || "",
    annee: annee ? Number(annee) : null,
    propose_par: propose_par || "",
    date_proposition: Timestamp.fromDate(new Date(date_proposition)),
    nb_pages: nb_pages ? Number(nb_pages) : null,
    genre: genre || null,
    description_3_mots: description_3_mots || null,
    // URL non vide = couverture manuelle ; vide = null → couverture auto
    couverture_url: couverture_url ? couverture_url : null,
    isbn13: isbn13 ? String(isbn13).replace(/[^0-9]/g, "") || null : null,
    // Invalide le cache de couverture auto → recalcul (utile si l'ISBN change)
    couv_cache: null,
    couv_v: null,
  });
}

export async function updateMembreInfos(id, { nom, date_arrivee }) {
  return updateDoc(doc(db, "membres", id), {
    nom,
    date_arrivee: Timestamp.fromDate(new Date(date_arrivee)),
  });
}

// ── Votes ──────────────────────────────────────────────────────────

export async function getVotes() {
  const s = await getDocs(collection(db, "votes"));
  return snap(s).sort((a, b) => b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois);
}

export async function getVoteById(id) {
  const d = await getDoc(doc(db, "votes", id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

export async function addVote({ mois, annee, resultats, livre_elu, date, tour2 }) {
  const voteData = {
    mois: Number(mois),
    annee: Number(annee),
    resultats,
    livre_elu: livre_elu || null,
    date: date ? Timestamp.fromDate(new Date(date)) : serverTimestamp(),
    cree_le: serverTimestamp()
  };
  if (tour2) voteData.tour2 = tour2;
  const ref = await addDoc(collection(db, "votes"), voteData);

  // Update book statuses based on vote results
  for (const r of resultats) {
    if (!r.livre_id) continue;
    let statut;
    if (r.livre_id === livre_elu) {
      statut = "elu";
    } else if (r.moyenne !== null && r.moyenne !== undefined && r.moyenne <= 2.9) {
      statut = "refuse";
    }
    if (statut) await updateLivre(r.livre_id, { statut });
  }

  return ref;
}

export async function updateVote(id, data) {
  const d = { ...data };
  if (typeof d.date === "string") d.date = d.date ? Timestamp.fromDate(new Date(d.date)) : null;
  return updateDoc(doc(db, "votes", id), d);
}

// ── Notes de lecture ───────────────────────────────────────────────

export async function getNotesForLivre(livre_id) {
  const s = await getDocs(query(collection(db, "notes_lecture"), where("livre_id", "==", livre_id)));
  return snap(s);
}

export async function getNotesForMembre(membre_id) {
  const s = await getDocs(query(collection(db, "notes_lecture"), where("membre_id", "==", membre_id)));
  return snap(s);
}

export async function upsertNoteLecture({ membre_id, livre_id, note, mois, annee }) {
  const q = query(
    collection(db, "notes_lecture"),
    where("membre_id", "==", membre_id),
    where("livre_id", "==", livre_id)
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    return updateDoc(doc(db, "notes_lecture", existing.docs[0].id), { note, mois, annee });
  }
  return addDoc(collection(db, "notes_lecture"), { membre_id, livre_id, note, mois, annee });
}

// ── Statuts de lecture ─────────────────────────────────────────────

export async function getStatutsForLivre(livre_id) {
  const s = await getDocs(query(collection(db, "statuts_lecture"), where("livre_id", "==", livre_id)));
  return snap(s);
}

export async function getStatutsForMembre(membre_id) {
  const s = await getDocs(query(collection(db, "statuts_lecture"), where("membre_id", "==", membre_id)));
  return snap(s);
}

// ── Commentaires de lecture ────────────────────────────────────────

export async function addCommentaire({ livre_id, membre_id, date_commentaire, avancement, titre, contenu }) {
  return addDoc(collection(db, "commentaires_lecture"), {
    livre_id,
    membre_id,
    date_commentaire: Timestamp.fromDate(new Date(date_commentaire)),
    avancement: avancement !== null && avancement !== "" && avancement !== undefined ? Number(avancement) : null,
    titre: titre?.trim() || null,
    contenu,
    cree_le: serverTimestamp()
  });
}

export async function getCommentairesForLivre(livre_id) {
  const s = await getDocs(query(collection(db, "commentaires_lecture"), where("livre_id", "==", livre_id)));
  return snap(s).sort((a, b) => (a.avancement ?? 99999) - (b.avancement ?? 99999));
}

export async function getCommentairesForMembre(membre_id) {
  const s = await getDocs(query(collection(db, "commentaires_lecture"), where("membre_id", "==", membre_id)));
  return snap(s);
}

export async function updateCommentaire(id, { contenu, titre, date_commentaire, avancement }) {
  const data = { contenu, titre: titre || null };
  if (date_commentaire) data.date_commentaire = Timestamp.fromDate(new Date(date_commentaire));
  data.avancement = avancement !== null && avancement !== undefined && avancement !== "" ? Number(avancement) : null;
  return updateDoc(doc(db, "commentaires_lecture", id), data);
}

// ── Votes actifs ───────────────────────────────────────────────────

export async function getVoteActif() {
  const s = await getDocs(collection(db, "votes_actifs"));
  const docs = snap(s);
  return docs.length ? docs[0] : null;
}

export async function lancerVote({ mois, annee, livre_ids, membre_ids, echelle, expires_at }) {
  return addDoc(collection(db, "votes_actifs"), {
    mois: Number(mois),
    annee: Number(annee),
    livre_ids,
    membre_ids,
    echelle: Number(echelle),
    expires_at: Timestamp.fromDate(expires_at instanceof Date ? expires_at : new Date(expires_at)),
    bulletins: {},
    cree_le: serverTimestamp(),
  });
}

export async function ajouterMembreAuVoteActif(docId, membre_id) {
  return updateDoc(doc(db, "votes_actifs", docId), {
    membre_ids: arrayUnion(membre_id)
  });
}

export async function lancerTour2(docId, { livre_ids_tour2, livre_ids_tour1, resultats_tour1, expires_at }) {
  return updateDoc(doc(db, "votes_actifs", docId), {
    tour: 2,
    livre_ids_tour1,
    livre_ids: livre_ids_tour2,
    resultats_tour1,
    bulletins: {},
    expires_at: Timestamp.fromDate(expires_at instanceof Date ? expires_at : new Date(expires_at)),
  });
}

export async function soumettreVote(docId, membre_id, notes) {
  const updates = {};
  updates[`bulletins.${membre_id}`] = notes;
  return updateDoc(doc(db, "votes_actifs", docId), updates);
}

export async function cloturerVoteActif(docId, voteData) {
  await addVote(voteData);
  return deleteDoc(doc(db, "votes_actifs", docId));
}

export async function annulerVoteActif(docId) {
  return deleteDoc(doc(db, "votes_actifs", docId));
}

export async function deleteVote(id) {
  return deleteDoc(doc(db, "votes", id));
}

// ── Réunions ───────────────────────────────────────────────────────

export async function getReunions() {
  const s = await getDocs(collection(db, "reunions"));
  return snap(s).sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0));
}

export async function addReunion({ statut, date, mois, annee, livre_id, participant_ids, lecteurs_ids, compte_rendu, lien_video }) {
  return addDoc(collection(db, "reunions"), {
    statut,
    date: date ? Timestamp.fromDate(new Date(date)) : null,
    mois: Number(mois),
    annee: Number(annee),
    livre_id: livre_id || null,
    participant_ids: participant_ids || [],
    lecteurs_ids: lecteurs_ids || [],
    compte_rendu: compte_rendu || "",
    lien_video: lien_video || null,
    notes_finales: {},
    cree_le: serverTimestamp(),
  });
}

export async function updateReunion(id, data) {
  const d = { ...data };
  if (typeof d.date === "string") d.date = d.date ? Timestamp.fromDate(new Date(d.date)) : null;
  return updateDoc(doc(db, "reunions", id), d);
}

export async function upsertStatutLecture({ membre_id, livre_id, statut, page_actuelle, pages_totales }) {
  const q = query(
    collection(db, "statuts_lecture"),
    where("membre_id", "==", membre_id),
    where("livre_id", "==", livre_id)
  );
  const existing = await getDocs(q);
  const data = {
    statut,
    page_actuelle: page_actuelle !== undefined ? Number(page_actuelle) : null,
    pages_totales: pages_totales !== undefined ? Number(pages_totales) : null,
    mis_a_jour: serverTimestamp()
  };
  if (!existing.empty) {
    return updateDoc(doc(db, "statuts_lecture", existing.docs[0].id), data);
  }
  return addDoc(collection(db, "statuts_lecture"), { membre_id, livre_id, ...data });
}

// ── Stats — lectures globales ─────────────────────────────────────

export async function getAllStatutsLecture() {
  const s = await getDocs(collection(db, "statuts_lecture"));
  return snap(s);
}

export async function getAllCommentaires() {
  const s = await getDocs(collection(db, "commentaires_lecture"));
  return snap(s);
}

// ── Progression de lecture (historique) ───────────────────────────

export async function addProgressionPoint({ livre_id, membre_id, page_actuelle, pages_totales }) {
  return addDoc(collection(db, "progression_lecture"), {
    livre_id,
    membre_id,
    page_actuelle: page_actuelle !== null && page_actuelle !== undefined ? Number(page_actuelle) : null,
    pages_totales: pages_totales !== null && pages_totales !== undefined ? Number(pages_totales) : null,
    horodatage: serverTimestamp(),
  });
}

export async function getProgressionForLivre(livre_id) {
  const s = await getDocs(query(collection(db, "progression_lecture"), where("livre_id", "==", livre_id)));
  return snap(s).sort((a, b) => (a.horodatage?.seconds ?? 0) - (b.horodatage?.seconds ?? 0));
}
