import { db } from "../firebase-config.js";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc,
  doc, query, orderBy, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function getMigraines() {
  const q = query(collection(db, "perso_migraines"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addMigraine({ date, commentaire }) {
  return addDoc(collection(db, "perso_migraines"), {
    date: Timestamp.fromDate(new Date(date)),
    commentaire: commentaire || "",
    cree_le: serverTimestamp(),
  });
}

export async function updateMigraine(id, { date, commentaire }) {
  return updateDoc(doc(db, "perso_migraines", id), {
    date: Timestamp.fromDate(new Date(date)),
    commentaire: commentaire || "",
  });
}

export async function deleteMigraine(id) {
  return deleteDoc(doc(db, "perso_migraines", id));
}
