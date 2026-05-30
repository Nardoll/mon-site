import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIMKnV2fpa8rvcWG8uNI-z9n_y-R0ILXI",
  authDomain: "mon-site-e253f.firebaseapp.com",
  projectId: "mon-site-e253f",
  storageBucket: "mon-site-e253f.firebasestorage.app",
  messagingSenderId: "716530207963",
  appId: "1:716530207963:web:1d913490f6357ba53f50fe"
};

export const app = initializeApp(firebaseConfig, "atelier");
export const db = getFirestore(app);
