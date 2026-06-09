export const MOIS_NOMS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
];

export const STATUTS_LECTURE = {
  pas_commence: { label: "Pas commencé", css: "pas_commence" },
  achete:       { label: "Acheté",        css: "achete" },
  en_cours:     { label: "En cours",      css: "en_cours" },
  termine:      { label: "Terminé",       css: "termine" }
};

export const STATUTS_ORDRE = ["pas_commence","achete","en_cours","termine"];

export const STATUTS_LIVRE = {
  en_proposition: { label: "En proposition", css: "proposition" },
  elu:            { label: "Élu",             css: "elu" },
  refuse:         { label: "Éliminé",          css: "refuse" }
};

export function formatMois(mois, annee) {
  return `${MOIS_NOMS[mois - 1]} ${annee}`;
}

export function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function initiales(nom) {
  if (!nom) return "?";
  return nom.trim().split(/\s+/).map(p => p[0].toUpperCase()).slice(0, 2).join("");
}

export function cycleStatut(current) {
  const idx = STATUTS_ORDRE.indexOf(current);
  return STATUTS_ORDRE[(idx + 1) % STATUTS_ORDRE.length];
}

export function moyenne(notes) {
  const vals = Object.values(notes).filter(v => v !== null && v !== undefined && v !== "");
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + Number(b), 0) / vals.length;
}

export function showToast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("visible"));
  setTimeout(() => { t.classList.remove("visible"); setTimeout(() => t.remove(), 300); }, 2500);
}
