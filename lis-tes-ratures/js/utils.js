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

function toJsDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Sentinelle utilisée comme valeur de bulletin pour un "vote blanc" (membre
// identifié qui choisit explicitement de ne noter aucun livre / de ne pas
// choisir entre les finalistes du 2ᵉ tour). Compte comme une participation.
export const VOTE_BLANC = "blanc";

// A-t-on la trace que `mid` a participé au vote `v` (notes /5, vote blanc,
// choix du 2ᵉ tour, ou vote exceptionnel hors système) ? Partagé entre le
// calcul d'activité des membres et les statistiques de participation.
export function aParticipeAuVote(v, mid) {
  if (v.exceptionnel) {
    const choix = v.sondage?.[mid];
    return Array.isArray(choix) ? choix.length > 0 : !!choix;
  }
  if ((v.blancs || []).includes(mid)) return true;
  if (v.tour2?.choix && v.tour2.choix[mid] != null && v.tour2.choix[mid] !== "") return true;
  return (v.resultats || []).some(r => r.notes && Object.prototype.hasOwnProperty.call(r.notes, mid));
}

// Statut d'activité des membres : un membre devient "inactif" s'il n'a participé
// à aucun des 3 derniers votes de choix du livre du mois, et n'a pendant cette
// même période ni proposé de livre ni participé à une réunion. Il redevient actif
// automatiquement dès qu'il refait l'une de ces trois actions (recalcul à chaque
// lecture des données — aucun statut n'est stocké en base).
export function computeInactivite(membres, votesArchives, livres, reunions) {
  const result = {};
  membres.forEach(m => { result[m.id] = { inactif: false, depuis: null }; });

  const votesTries = [...votesArchives].sort((a, b) =>
    b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois
  );
  if (votesTries.length < 3) return result;
  const derniers3 = votesTries.slice(0, 3);

  const plusAncien = derniers3[derniers3.length - 1];
  const windowStart = toJsDate(plusAncien.date) || new Date(plusAncien.annee, plusAncien.mois - 1, 1);

  membres.forEach(m => {
    if (derniers3.some(v => aParticipeAuVote(v, m.id))) return;

    const aPropose = livres.some(l => {
      if (l.propose_par !== m.id) return false;
      const d = toJsDate(l.date_proposition);
      return d && d >= windowStart;
    });
    if (aPropose) return;

    const aReunion = reunions.some(r => {
      if (!(r.participant_ids || []).includes(m.id)) return false;
      const d = toJsDate(r.date);
      return d && d >= windowStart;
    });
    if (aReunion) return;

    result[m.id] = { inactif: true, depuis: windowStart };
  });

  return result;
}

export function showToast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("visible"));
  setTimeout(() => { t.classList.remove("visible"); setTimeout(() => t.remove(), 300); }, 2500);
}
