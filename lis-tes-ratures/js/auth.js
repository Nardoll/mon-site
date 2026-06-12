// ─────────────────────────────────────────────────────────────────────
//  auth.js — Accès libre (mot de passe retiré sur Lis tes ratures)
//
//  Le mot de passe n'apportait qu'une sécurité de façade (vérification côté
//  navigateur, base Firestore ouverte). Il a été retiré sur cette section.
//  Les pages appellent toujours `await requireAuth()` : on garde donc la
//  fonction, mais elle ne fait plus rien (résout immédiatement).
//
//  Les autres sections (JDR, Atelier) ont leur propre auth.js et restent
//  protégées.
// ─────────────────────────────────────────────────────────────────────

export async function requireAuth() {
  // Accès libre — aucun mot de passe.
}
