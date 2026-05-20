import {
  getFirestore, collection, doc,
  getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "../firebase-config.js";

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

export async function addLivre({ titre, auteur, annee, propose_par, date_proposition, statut = "en_proposition" }) {
  return addDoc(collection(db, "livres"), {
    titre,
    auteur: auteur || "",
    annee: annee ? Number(annee) : null,
    propose_par: propose_par || "",
    date_proposition: date_proposition
      ? Timestamp.fromDate(new Date(date_proposition))
      : serverTimestamp(),
    statut,
    cree_le: serverTimestamp()
  });
}

export async function updateLivre(id, data) {
  return updateDoc(doc(db, "livres", id), data);
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

export async function addVote({ mois, annee, resultats, livre_elu }) {
  const ref = await addDoc(collection(db, "votes"), {
    mois: Number(mois),
    annee: Number(annee),
    resultats,
    livre_elu: livre_elu || null,
    cree_le: serverTimestamp()
  });

  // Update book statuses based on vote results
  for (const r of resultats) {
    if (!r.livre_id) continue;
    let statut;
    if (r.livre_id === livre_elu) {
      statut = "elu";
    } else if (r.moyenne !== null && r.moyenne !== undefined && r.moyenne <= 2.5) {
      statut = "refuse";
    }
    if (statut) await updateLivre(r.livre_id, { statut });
  }

  return ref;
}

export async function updateVote(id, data) {
  return updateDoc(doc(db, "votes", id), data);
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
