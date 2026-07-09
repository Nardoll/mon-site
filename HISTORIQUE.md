# Historique des modifications — Mon Site

> Archive des entrées d'historique du `README.md` (sessions du 2026-05-23 au 2026-07-02), déplacées ici le 2026-07-09 pour alléger le README. Les nouvelles entrées se font dans le README (section « Historique des modifications ») puis sont déplacées ici quand la section devient longue.
>
> ⚠️ Ces entrées sont des **instantanés datés** : elles décrivent l'état du site au moment de chaque session. Certaines décrivent des comportements depuis remplacés (ex : vote le 1er du mois → désormais le 25). En cas de doute, la référence est le README actuel + le code.

---

### 2026-07-02 (suite 2)
**Lis tes ratures — Calendrier de vote au 25, vote blanc, statut Inactif, et suivi de lecture**

Session de petits chantiers (patchnote demandé par Tom en fin de session).

- **Bilan de vote illisible** : `lis-tes-ratures/votes.html` — le tableau d'émargement (`buildTallyTable` dans `votes.js`) débordait/écrasait le texte avec beaucoup de livres en compétition. Cause racine : `table-layout: auto` laisse le navigateur ignorer la largeur de colonne demandée dès que le contenu total dépasse le conteneur visible. Passage en `table-layout: fixed` avec largeurs explicites sur toutes les colonnes (votant 140px, livre 150px, moyenne 68px) — les colonnes gardent leur largeur, c'est `.tally-wrap { overflow-x: auto }` qui prend le relais au-delà.
- **Statut "Inactif" des membres** (nouveau) : un membre devient inactif s'il n'a participé à aucun des 3 derniers votes et n'a, pendant cette période, ni proposé de livre ni participé à une réunion. Calculé à la lecture (`computeInactivite()` + `aParticipeAuVote()` dans `utils.js`, aucun champ stocké) — redevient actif automatiquement dès qu'il revote, propose un livre ou va en réunion.
  - `lis-tes-ratures/js/vote.js` : `checkAllVoted()` ignore les membres inactifs pour la clôture anticipée du vote (100% de participation atteint même si l'inactif n'a pas voté) ; le bilan d'émargement les distingue visuellement (badge grisé "inactif").
  - `lis-tes-ratures/js/membres.js` : badge "Inactif depuis le …" sur la fiche du membre **et** sur sa carte de lecteur dans la grille (texte "Inactif" sous la date d'inscription + carte légèrement grisée `grayscale`/`opacity`, sans emoji).
- **Cachet de note des réunions** : `lis-tes-ratures/js/reunions.js` + `reunions.html` — le sceau rond (`.reg-seal`) affichait la note et le libellé "note du club" empilés, décentrant visuellement le chiffre. Libellé retiré, seule la note "X.X/10" reste, centrée (vérifié desktop + mobile).
- **Calendrier de vote déplacé au 25 du mois** : le scrutin de choix du livre du mois a désormais lieu le **25 du mois pour élire le livre du mois SUIVANT** (ex : vote le 25 juillet → livre d'août), laissant 5 jours de marge pour se procurer le livre élu. Le 2ᵉ tour (égalité) a lieu le 26 au lieu du 2.
  - `lis-tes-ratures/js/vote.js` : `autoLancerSiNecessaire()` et `closeExpiredVote()` mis à jour (⚠️ fonctions historiquement marquées NE PAS MODIFIER — changement délibéré, validé avec Tom).
  - `lis-tes-ratures/js/utils.js` : nouveau helper partagé `prochainScrutin()` (+ `deMois()` pour l'élision "de juillet"/"d'août") — source unique du calcul de date, réutilisé dans `vote.js`, `votes.js` (carte "prochain scrutin") et `accueil.js` (carte vote + délai de lecture de la page d'accueil), qui avaient chacun leur propre calcul jamais mis à jour et continuaient d'annoncer une ouverture "le 1er".
- **Vote blanc** (nouveau) : possibilité de voter blanc au 1er et au 2ᵉ tour ("je laisse les autres décider"). Compte comme une participation (ne bloque pas la clôture anticipée, entre dans le calcul du statut Inactif) et apparaît distinctement dans le bilan d'émargement (en direct et archivé), les statistiques de participation et l'historique de vote sur la fiche membre.
  - Persisté sur le vote archivé via un nouveau champ `blancs` (+ `blancs_tour1` porté à travers le 2ᵉ tour dans `votes_actifs`) — `lis-tes-ratures/js/db.js` (`addVote`, `lancerTour2`).
  - `lis-tes-ratures/js/votes.js` : tableau d'émargement archivé (`buildTallyTable`) et graphique du 2ᵉ tour (`buildTour2`) adaptés pour afficher les votes blancs.
- **Suivi de lecture (page d'accueil)** :
  - `lis-tes-ratures/js/accueil.js` : la modale d'édition du suivi d'un membre affichait toujours "Page actuelle" même quand le livre est configuré en mode "chapitres" — labels `#me-page-label`/`#me-total-label` désormais adaptés à l'unité configurée sur le livre (`progression_unite`).
  - Impossible de marquer "chapitre/page 0" (début de lecture) — plusieurs vérifications traitaient `0` comme une valeur vide (faux en JS) : `partie && chapitre` en mode hiérarchique, `effectivePa > 0` avant l'enregistrement du point de progression, et l'affichage (`barState`, `pctFromStatut`) dans `accueil.js` + `bibliotheque.js`. Toutes ces vérifications passent désormais en `!= null` / `>= 0`.
  - Le total (chapitres/pages) était redemandé à chaque membre alors qu'il est déjà configuré une fois pour tout le monde au niveau du livre — `hasBookTotal()` masque maintenant ce second champ et force sa valeur automatiquement quand le livre en a un configuré (corrige au passage un bug où une ancienne valeur à `0` stockée pour le membre empêchait le repli sur le total du livre, `??` ne retombant pas sur une valeur par défaut quand `0` est déjà présent).
  - `lis-tes-ratures/js/progression-chart.js` : le graphe "Évolution des lectures" bouclait sur lui-même après une rupture de pente (palier plat suivi d'un saut) — l'interpolation Catmull-Rom bridée en boîte a été remplacée par un **Hermite cubique monotone** (Fritsch-Carlson), qui garantit mathématiquement qu'aucun segment ne dépasse la plage y de ses deux points (donc plus de boucle), tout en restant courbe. Le point de départ synthétique (quand le membre n'a pas explicitement marqué "0") n'est plus figé au 1er jour du mois : il est estimé par régression linéaire sur les 6 premiers points réels, extrapolée jusqu'à 0% (repli sur le 1er jour seulement s'il n'y a qu'un seul point réel).

### 2026-07-02
**Lis tes ratures — Vote mobile, rappel de notes, et outil de stabilisation du nombre de livres**

- `lis-tes-ratures/vote.html` : affichage mobile du tableau de notation corrigé — les numéros 1-5 étaient masqués (`thead` caché en `@media (max-width: 620px)`). Chaque cellule de note affiche maintenant son numéro via `::before` + `attr(data-n)`.
- `lis-tes-ratures/js/vote.js` + `vote.html` : **rappel personnel des notes du mois précédent**, colonne "Préc." dans le tableau de notation (tour 1 uniquement, après identification). Alimentée par `previousVote` / `refreshPreviousVote()` (vote archivé immédiatement précédent). Masquée/floutée par défaut, interrupteur "Afficher mes notes du mois dernier", préférence en `localStorage` (`ltr_prevNotes`).
- `lis-tes-ratures/js/vote.js`, `renderTour2Context()` : le tableau de comparaison du tour 1 affiché pendant le tour 2 distingue maintenant **"❌ Éliminé"** (score `< SEUIL_ELIMINATION` = 3, constante locale cohérente avec `db.js`) d'**"Écarté"** (conservé mais pas qualifié pour le tour 2).
- `lis-tes-ratures/chantier.js` :
  - Sélecteur du **vote analysé** — n'importe quel vote clôturé, ou le vote en cours (tour 1 complet, ou tour 1 figé via `resultats_tour1` si on est passé en tour 2). `normalizeVote()` retombe sur `livreById` pour titre/auteur absents des votes récents (le nouveau système de clôture ne les stocke plus, contrairement à l'ancien).
  - Seuil d'élimination **paramétrable** en 3 modes (score minimum / % de livres éliminés / nombre de livres à conserver), appliqué à tous les onglets via `computeEliminationSet()` / `getResultat(..., eliminated)`.
  - Correction d'un bug de double-calcul : `r.moyenne` contient déjà le score combiné pour les votes clôturés par le système auto récent (pas une moyenne simple comme pour les anciens votes) — `moyFromResultat()` recalcule désormais toujours depuis les notes brutes plutôt que de faire confiance à ce champ ambigu.
  - `refreshTabs()` protège chaque onglet avec un `try/catch` individuel.
- **`lis-tes-ratures/stabilisation.html` + `js/stabilisation.js`** (nouvelle page) — outil dédié à la croissance du nombre de livres en compétition, extrait de l'ancien onglet "Stabilisation" de `chantier.js`. Accessible **uniquement par lien direct** (pas dans le menu du site), pensée pour être partagée avec les membres du club :
  - **Vue d'ensemble** : historique réel (nouveaux livres/mois, éliminations, élu, reconstruit par recoupement des `livre_id` entre votes successifs — pas besoin de `date_proposition`), ligne de projection du mois suivant (nombre réel déjà éliminé si le tour 1 est clos + fourchette d'incertitude), réglage requis par scénario de croissance (moyenne / médiane / dernier mois).
  - **Comparer les seuils** : graphique à 5 politiques concrètes modifiables + 3 graphiques dédiés (conserver N / éliminer X% / score minimum), plage de valeurs comparées éditable (plafonnée à 13 courbes pour la lisibilité), courbe "★ Optimal" toujours présente.
  - **Incertitude** : écart-type (n-1) sur les transitions observées, bandes ± écart-type optionnelles sur les graphiques (case à cocher).
  - **Limiter les propositions** (nouveau levier) : plafond de propositions par membre et par mois, basé sur `livre.propose_par` recoupé avec les nouvelles entrées de chaque transition (pas `date_proposition`, peu fiable car un livre peut être proposé un mois et n'apparaître dans un vote qu'un mois plus tard). Impact contrefactuel affiché sur l'historique réel ; une fois activé, remplace la croissance brute dans **tous** les calculs de la page.
  - **Simulation Monte-Carlo** (nouveau) : tirages aléatoires (loi normale, Box-Muller, tronquée à 0) d'un nombre de nouveaux livres différent à chaque mois simulé, répétés 50 à 5000 fois (réglable), horizon 1-24 mois (défaut 10). Calcul entièrement côté client (aucune requête serveur ; 1000 tirages × 10 mois ≈ 4 ms). Affiche moyenne + intervalle 10e-90e percentile, qui s'élargit naturellement avec l'horizon pour les seuils non plafonnants (ex. `%`), mais reste stable pour "conserver N" (le plafond dur "réinitialise" la variance chaque mois — propriété mathématique réelle, pas un bug).
  - `lis-tes-ratures/chantier.html`/`.js` perdent la section Stabilisation (déplacée) ; lien vers la nouvelle page ajouté en bas de l'onglet Impact.
- `lis-tes-ratures/chantier.html` + `stabilisation.html` : ajout de `data-theme="light"` sur `<html>` (absent, donc mode sombre par défaut de la feuille de style — toutes les autres pages du site le forcent en clair).

### 2026-07-01
**Lis tes ratures — Restauration système de vote automatique + seuil à 3 + Babelio**

- `lis-tes-ratures/js/vote.js` : **portage complet de la logique d'auto-vote** depuis l'ancienne version `club-lecture` (qui fonctionnait) — entièrement manquante dans la version lis-tes-ratures. Ajout de :
  - `autoLancerSiNecessaire()` : lance le vote le 1er du mois (livres en_proposition + tous les membres, expires 23h59:59), après vérification qu'aucun vote archivé n'existe déjà pour ce mois.
  - `closeExpiredVote()` : calcule scores (moy+méd)÷2 à l'expiration, élit le gagnant ou lance le 2ème tour en cas d'égalité.
  - `closeExpiredVoteTour2()` : compte les voix (choix unique), élit le plus voté ou tire au sort en cas de nouvelle égalité (`tirage_au_sort: true`).
  - `checkAllVoted()` + `triggerEarlyClose()` : clôture anticipée si 100% de participation.
  - `startCountdown()` : `setTimeout` qui déclenche la clôture automatique à l'expiration si la page reste ouverte.
  - Gestion du 2ème tour dans l'UI : `renderTour2Context()` (barres résultats tour 1), `renderVote()` en mode choix unique (radio), `submitVote()` adapté.
- `lis-tes-ratures/vote.html` : CSS pour `.t2-context`, `.t2-choices`, `.t2-choice`, `.t2-pre-row`, `.t2-pre-badge` (éléments UI du 2ème tour).
- `lis-tes-ratures/js/db.js` : correction `addVote` — seuil `refuse` corrigé de `<= 2.9` à `< 3` (cohérent avec le seuil stocké et la logique d'affichage).
- `lis-tes-ratures/js/db.js` : `addVote` stocke `seuil: 3` (relevé de 2.9, voir session précédente).
- `lis-tes-ratures/babelio.png` + intégrations Babelio (voir session précédente).
- README : documentation complète du système de vote automatique avec avertissement NEVER MODIFY ; seuil mis à jour à 3 ; section votes lis-tes-ratures corrigée (suppression de la fausse note "via console Firebase").

### 2026-06-28 (suite 3)
**Lis tes ratures — Refonte mobile (nav marque-pages + réunions + fix stats)**

- `lis-tes-ratures/css/style.css` : refonte `@media (max-width: 768px)` — sidebar devient barre fixée en bas, chaque onglet = marque-page en papier incliné/décalé (rotations et décalages `translateY` différents par onglet), l'actif se redresse (`translateY(-10px)`) avec liseré terracotta. Logo passe en barre de titre fixée en haut. Padding `.main` : `4rem` haut + `5.2rem` bas. Thème sombre pris en charge (`[data-theme="dark"]`). La spec vient de `SPEC-MOBILE.md` (fichier Tom dans le dossier projet).
- `lis-tes-ratures/reunions.html` : `@media (max-width: 700px)` remplacé — `.reg-row` passe en `grid-template-areas` (cachet date + sceau note en haut, titre/contenu en bas pleine largeur). Élimine la superposition du sceau sur le titre du livre.
- `lis-tes-ratures/statistiques.html` : `@media (max-width: 768px)` ajouté — `.sx-table` passe en `display: block; overflow-x: auto` pour que les tableaux à 7 colonnes scrollent sans élargir la page.

### 2026-06-28
**Lis tes ratures — Suppression mode test sondage + exposé 1984 + correctifs membres**

- `lis-tes-ratures/js/sondage-dispo.js` : suppression complète du mode test (SD_TEST_KEY, sessionStorage, badge TEST, branches `_test`). `submitAvail()` écrit toujours dans Firebase. Ajout de `buildRanking(s)` : classement visuel des dates par score (médailles, barres proportionnelles, nb dispo/si besoin) injecté dans `#ranking-mount` avant la grille Framadate, mis à jour à chaque réponse.
- `lis-tes-ratures/js/accueil.js` : suppression mode test (loadTestSondage). `init()` charge le sondage actif uniquement depuis Firebase. Lien "Répondre →" pointe vers `sondage-dispo.html`.
- `lis-tes-ratures/js/reunions.js` : suppression mode test (SD_TEST_KEY, checkbox, branche sessionStorage). Panneau vide redesigné : lignes horizontales sépia + note italique serif (fini l'emoji calendrier). Poller simplifié à 30s fixe. Ajout champ `lien_expose` : champ texte dans le formulaire d'ajout/édition de réunion, stocké en Firestore (`lien_expose: string|null`), affiché dans la fiche comme preview iframe cliquable (ouvre en plein écran dans un nouvel onglet) ; le chemin est normalisé automatiquement (slash initial garanti). Ajout preview miniature YouTube pour `lien_video` : extrait l'ID via regex, affiche `img.youtube.com/vi/{id}/hqdefault.jpg` avec bouton play superposé, fallback lien texte si non-YouTube. Helper `getYtId(url)` ajouté.
- `lis-tes-ratures/js/membres.js` : `nbExceptByMembre` déplacé au niveau module (fix scope — était dans `init()`, inaccessible depuis `renderRack()` et `openMember()`). Les votes exceptionnels (Piranèse) sont comptés dans "N votes" sur les cartes membres via `v.sondage` (même source que `statistiques.js`).
- `lis-tes-ratures/exposes/1984/` : nouveau dossier — présentation HTML standalone de Dorian sur 1984/Orwell (21 slides, 15 images). Accessible à `/lis-tes-ratures/exposes/1984/`. **Action Tom :** dans la fiche réunion 1984, cliquer Modifier → renseigner "Lien exposé" : `/lis-tes-ratures/exposes/1984/`.
- `lis-tes-ratures/reunions.html` + `sondage-dispo.html` : CSS correspondants (état vide, classement, `.video-preview`, `.expose-preview`).

### 2026-06-28 (suite 2)
**Lis tes ratures — Seuil d'élimination dynamique + recherche livre membres + lien fiche livre**

- `lis-tes-ratures/js/votes.js` : `const SEUIL = 2.9` remplacé par `seuilVote(v)` → retourne `v.seuil ?? 2.5`. Les votes passés (sans champ `seuil` en Firestore) affichent le seuil 2,5 historique ; le graphique, la légende et le tableau d'émargement reflètent chacun le bon seuil.
- `lis-tes-ratures/js/db.js` : `addVote` stocke `seuil: 2.9` sur tout nouveau document `votes`.
- `lis-tes-ratures/js/membres.js` : recherche dans les fiches membres refaite — champ avec `<datalist>` autocomplete (titres des livres votés par ce membre). Sélection exacte d'un livre → vue ciblée "Notes pour [Titre]" (mois + étoiles + note /5). Saisie partielle → filtre les sessions de vote comme avant.
- `lis-tes-ratures/membres.html` : CSS `.rf-book-focus*` pour la vue ciblée.
- `lis-tes-ratures/js/reunions.js` : lien "Voir la fiche du livre" dans la fiche réunion pointe désormais vers `bibliotheque.html?open=<livre_id>` — ouvre directement la fiche du bon livre.

### 2026-06-28 (suite 2)
**Pronostics LoL Esport — Double score bracket, panel admin intégré, timezone Paris, fix scoring**

`pronostics/` — suite d'améliorations UX et corrections :

- **`pronostics/js/db.js`** : `scorePicksForMatch` reécrit — plus de double `where` (évite l'index composite Firestore requis) : requête `where('match_id', '==', id)` unique, filtre JS `!d.data().scored`. Même correction pour `getPlayerBreakdown` (plus de filtre `scored` en Firestore) et `getLeaderboard` (plus de double filtre).

- **`pronostics/css/style.css`** : refonte du bloc `.bk-match` — `display:flex` avec `.bk-teams-col` (flex:1) + `.bk-score-col` (colonne fixe séparée par une bordure). Couleurs : `.real` → muted, `.pick-perfect` → var(--win), `.pick-correct` → #5b9cf6, `.pick-wrong` → var(--loss). Nouveaux styles : `.bk-legend` + `.bk-legend-item` (légende couleurs), `.match-pick-score` (deux scores dans le calendrier), `.bkap-form` / `.bkap-row` / `.bkap-save` (section admin dans le drawer).

- **`pronostics/js/tournoi.js`** :
  - `renderBkMatch` / `renderBkMatchWithPicks` : deux colonnes de scores côte à côte — colonne gris `real` (score officiel) + colonne colorée `pick-*` (pronostic du joueur).
  - Légende des couleurs ajoutée en haut du bracket (`bk-legend`).
  - Même affichage double-score dans `renderMatchCard` (vue calendrier).
  - `setupBracketHandlers` : matchs `live` ouvrent `openPicksDrawer` (comme les terminés). Tous les matchs cliquables en mode `?admin` (y compris TBD).
  - `setupMatchHandlers` (calendrier) : matchs `live` et mode `?admin` ouvrent le drawer au lieu de la modale de pick.
  - `openPicksDrawer` : section admin fusionnée en bas du drawer (visible seulement si `IS_ADMIN`). Équipes : `<select>` peuplé depuis les codes d'équipes réels des matchs (pas `tournament.teams`). Horaire : `<select id="bkap-cal-slot">` listant les matchs du calendrier pour recopier l'horaire, + `<input type="datetime-local" id="bkap-dt">` affichant l'heure en heure Paris. Après sauvegarde : `renderBracket()` + `renderCalendrier()` appelés.
  - `renderAdminMatch` (onglet admin) : même logique `<select>` équipes + `utcToParisLocal()` pour l'affichage.
  - Deux fonctions utilitaires ajoutées : `parisToUtc(localStr)` et `utcToParisLocal(dateStr)` — conversion DST-correcte via `Intl.DateTimeFormat('Europe/Paris')`.

### 2026-06-28 (suite)
**Pronostics LoL Esport — Sidebar + Picks drawer + Player bracket + UX**

`pronostics/` — refonte UX complète en 6 fichiers :

- **`pronostics/js/nav.js`** : suppression de `injectBottomNav`. Ajout de `injectSidebar(profile, active)` — sidebar gauche fixe 210px avec logo ⚡ Pronostics, liens "Tournois" et "Classement général", icône 🏠 en bas pour revenir au site. `injectTopBar` épuré : seulement `.top-user` (avatar + nom + logout), aligné à droite.

- **`pronostics/css/style.css`** : ajout de `--sidebar-w: 210px`. `body` : padding-left remplace padding-bottom. `.top-bar` : `left: var(--sidebar-w)`. Suppression des styles `.bottom-nav` / `.home-btn`. Nouveaux styles : `.sidebar`, `.sb-*`, `.btn-sync-icon` (icône rotation + spinning), `.picks-drawer` (panneau droit slide-in), `.player-bracket-overlay` + `.pbm-*` (modal bracket joueur), `.pts-legend` + `.pts-badge`, `.lb-row.clickable`, `.player-bd-overlay` + `.player-bd-*`.

- **`pronostics/js/accueil.js`** : `injectSidebar(profile, 'accueil')` à la place de `injectBottomNav`.

- **`pronostics/js/classement.js`** : `injectSidebar(profile, 'classement')`. Suppression du guard "tous à 0 pts → message vide". Bloc `.pts-legend` avec explication du barème (5pts/3pts/1pt/0pt). Lignes lb-row `clickable` → clic ouvre modal `showPlayerBreakdown` : points par tournoi + total.

- **`pronostics/js/db.js`** : ajout de `getPlayerBreakdown(profileId)` — agrège tous les picks scorés par tournoi pour un joueur.

- **`pronostics/js/tournoi.js`** : `injectSidebar(profile, null)`. Onglet "Long terme" supprimé. Sync bar → icône `btn-sync-icon` dans la `.top-bar` (spinning + cooldown). Matchs terminés : clic → `openPicksDrawer(match)` (panneau droit). Classement tournoi : clic joueur → `showPlayerBracket` (modal bracket coloré).

### 2026-06-21
**Lis tes ratures — Sondage de disponibilité (Framadate-style) + mode test**

- `lis-tes-ratures/db.js` : 5 nouvelles fonctions : `getSondageDispo()`, `createSondageDispo()`, `updateSondageReponse()`, `cloturerSondage()`, `getSondageById()`. Nouvelle collection Firestore `sondages_dispo`.
- `lis-tes-ratures/accueil.js` : chargement du sondage actif en parallèle ; `buildVoteCard()` affiche l'encart "Date de la séance" avec lien "Répondre →" si un sondage est ouvert ; `buildReunionCard()` remplace "N présents attendus" par "N membres ont fini le livre".
- `lis-tes-ratures/reunions.html` : layout 2 colonnes (registre + panneau sondage cahier relié), bouton ghost violet "Sondage de disponibilité", overlay création (mode delta/plage + durée/échéance + **mode test 2 min**), panneau `.sp-panel` avec grille Framadate, badge "TEST" en terracotta si sondage éphémère.
- `lis-tes-ratures/js/reunions.js` : `renderSondagePanel()`, `buildVoteGrid()`, `openCreerSondage()`, `processClotureSondage()`, `computeScores()`, `computeWinner()`. `init()` charge le sondage Firebase ou, s'il n'y en a pas, le sondage test depuis `sessionStorage`. Helpers `saveTestSondage()` / `loadTestSondage()`.
- `lis-tes-ratures/sondage-dispo.html` : nouvelle page (DA bulletin de vote). Sections : bilan groupe (Framadate), identification, disponibilités interactives (3 boutons/jour).
- `lis-tes-ratures/js/sondage-dispo.js` : nouveau fichier. Charge sondage Firebase ou sessionStorage (mode test). En mode test, `submitAvail()` ne touche pas Firebase — met à jour la mémoire + sessionStorage et affiche un toast "non sauvegardé". Badge "TEST" visible dans l'en-tête.

### 2026-06-20
**Lis tes ratures — auto-fin de lecture + KPIs statistiques recentrés sur les lectures réelles**

- `lis-tes-ratures/js/accueil.js` (modal de suivi du livre du mois) :
  - **Auto-passage en « Terminé »** : quand l'avancement saisi atteint (ou dépasse) le maximum du livre (`page_actuelle >= pages_totales`, valable aussi en mode hiérarchique avec dernier chapitre de la dernière partie), le statut bascule automatiquement sur `termine`. Le point de progression enregistré marque alors la fin (100 %) → le graphe d'évolution prend ce moment comme fin de lecture. Toast « Livre terminé ! 🎉 ».
  - **Inscription auto comme lecteur sur la réunion** : tout passage en `termine` (manuel **ou** auto) appelle `ensureLecteurReunion()`, qui ajoute le membre à `lecteurs_ids` de la réunion associée au livre. Garde-fou rétrocompat : si la réunion n'a pas encore de `lecteurs_ids` (ancien format), on l'initialise à partir des `notes_finales > 0` existantes pour ne pas perdre de lecteurs déjà comptés. Sans réunion associée, rien à faire (le statut `termine` suffit aux stats).
  - Import ajouté : `updateReunion` depuis `db.js`.
- `lis-tes-ratures/js/statistiques.js` (`renderKPIs`) :
  - Un livre est désormais **« lu » dès qu'au moins un membre l'a terminé** (statut `termine` OU présence dans `lecteurs_ids`), **sans exiger de réunion passée**. Conséquence directe : marquer « terminé » sur l'accueil suffit à faire compter le livre.
  - **« Livres lus »** = livres distincts lus (chaque livre une fois). **« Lectures cumulées »** = Σ lecteurs (un livre compte par lecteur, +2 si deux personnes ont fini). **« Pages lues » (cumulées membres)** = pages × nombre de lecteurs. 
  - **Note moyenne retirée** (déjà couverte par le graphe plus bas) et remplacée par une **4ᵉ carte « Pages lues » non cumulée** (= somme des pages des livres lus, chaque livre une fois — même logique que « Livres lus »).

### 2026-06-20 (suite 3)
**Lis tes ratures — votes exceptionnels (Piranèse / sondage Discord)**

- `lis-tes-ratures/js/votes.js` — les votes avec `exceptionnel: true` en Firestore ouvrent une fiche spéciale au clic (fonction `openExceptionnel()`) au lieu de la fiche de dépouillement standard. La fiche spéciale affiche : titre « Sélection exceptionnelle », encart orange « ⚠ Hors scrutin officiel » + `description_exceptionnelle`, note `/10` optionnelle (`note_exceptionnelle`) et liste simplifiée des résultats si `resultats` est présent. En dehors du clic, ces votes sont indiscernables des autres dans la liste des scrutins.
- `lis-tes-ratures/js/statistiques.js` — les votes `exceptionnel: true` sont filtrés de `votesChron` : exclus de toutes les fonctions qui calculent des stats de votes (notes moyennes, participations, etc.).
- `lis-tes-ratures/js/membres.js` — exclusion de la boucle de participation aux votes dans les fiches membres.
- **Action Firestore à faire par Tom** : ouvrir la console Firebase → collection `votes` → document Piranèse → ajouter `exceptionnel: true`. Champs optionnels : `description_exceptionnelle` (texte affiché dans la fiche, ex : _"Ce livre a été élu via un sondage Discord avant la création du site."_) et `note_exceptionnelle` (nombre, si vous souhaitez afficher une note /10).

### 2026-06-20 (suite 2)
**Lis tes ratures — modification des séances de réunion**

- `lis-tes-ratures/js/reunions.js` — ajout d'un bouton crayon discret (icône SVG inline 18×18) dans l'en-tête de la fiche séance, positionné sous la croix de fermeture. Au clic, ferme la fiche et rouvre le formulaire de saisie pré-rempli avec les données de la séance (`date`, `compte_rendu`, `lien_video`, `statut`, listes `present_ids` et `lecteurs_ids`). La soumission appelle `updateReunion()` (mise à jour partielle Firestore) au lieu de `addReunion()`. Deux corrections de bug : (1) SVG sans dimensions → rendu 0×0 corrigé par des attributs `width`/`height` inline ; (2) `closeMeeting()` annulait `curReunion` avant qu'on puisse le passer à `openAdd()` → corrigé en sauvegardant `const r = curReunion` avant d'appeler `closeMeeting()`.
- `lis-tes-ratures/js/db.js` — `updateReunion(id, data)` : `updateDoc` partiel (champs existants non mentionnés préservés).

### 2026-06-20 (suite)
**Lis tes ratures — infos IA sur les fiches élus et éliminés**

- `lis-tes-ratures/js/bibliotheque.js` (`openFiche()`) : le bloc infos IA (genre, description 3 mots) s'affiche désormais pour **tous** les statuts de livre (Élu, Éliminé, Proposition). Spécificité livres élus : `nb_pages` est placé dans le `<dl>` principal (données vérifiées à la main) et **non** dans le bloc IA, contrairement aux livres non élus où `nb_pages` (donnée automatique) reste dans le bloc IA. La variable `isElu` contrôle ce branchement.

### 2026-06-18 (suite 2)
**Lis tes ratures — Statistiques : camembert de répartition des livres**

- `lis-tes-ratures/statistiques.html` — nouveau panel « Répartition des livres » juste sous les KPIs (avant le chapitre « Lectures & notes ») + CSS `.sx-pie-*`.
- `lis-tes-ratures/js/statistiques.js` — `renderRepartition({ livres })` : donut SVG (un `<circle>` par segment, `stroke-dasharray` proportionnel) avec le total au centre, et légende couleur + compte + pourcentage. Statuts : En proposition (terracotta `#b5572d`), Élus (`var(--green)`), Éliminés (`#c0473f`), + « Autre » si un livre a un statut inattendu.

### 2026-06-18 (suite)
**Lis tes ratures — bibliothèque : toggle « Ouvrir tous les livres »**

- `lis-tes-ratures/bibliotheque.html` — barre toggle (DA réutilisée de l'ancien `.ai-toggle-bar` + `.toggle-switch`) en haut de la vue visuelle.
- `lis-tes-ratures/css/style.css` — état `.prop-grid.all-open .bk-cover` : applique l'ouverture à tous les livres, pas seulement au survol. **Angle limité à `rotateY(-90deg)`** en mode « tout ouvert » pour que la couverture ne déborde pas sur le livre de gauche ; le **survol** garde l'ouverture complète (`-112deg`) via la règle plus spécifique `.prop-grid.infos-on .bk:hover .bk-cover`.
- `lis-tes-ratures/js/bibliotheque.js` — toggle `#openall-toggle` qui ajoute/retire `all-open` sur `#prop-grid`, mémorisé en `localStorage` (`ltr_bib_open_all`, OFF par défaut).

### 2026-06-18
**Lis tes ratures — vraies couvertures activées par défaut à chaque connexion**

- `lis-tes-ratures/js/covers.js` + `js/nav.js` — le toggle « Vraies couvertures » passe de `localStorage` (OFF par défaut, mémorisé pour toujours) à **`sessionStorage` (ON par défaut)**. `coversOn()` = vrai sauf `"0"` explicite. Résultat : chaque nouvelle connexion/onglet démarre avec les vraies couvertures ; l'utilisateur peut désactiver pour sa visite, mais ça revient sur ON à la session suivante.

### 2026-06-15
**Lis tes ratures — statut « Livre possédé » + graphe d'évolution sur la fiche des livres élus**

- **Nouveau statut de suivi `achete` (« Livre possédé »)** : ajouté au sélecteur de statut du suivi (livre du mois, accueil) entre « Pas commencé » et « En cours ». Permet d'indiquer qu'on s'est procuré le livre sans l'avoir commencé. La valeur `achete` existait déjà dans le modèle (`statuts_lecture`) et l'ordre de tri ; elle est désormais exposée dans l'UI.
  - `lis-tes-ratures/index.html` — `<option value="achete">Livre possédé</option>` + styles `.bar-state.owned` / `.fiche-av-owned` (brun chaud `#8a6d3f`).
  - `lis-tes-ratures/js/accueil.js` — `barState()` gère `achete` (icône livre + label) ; fiche livre affiche « Livre possédé » ; garde-fou à la sauvegarde : la page d'avancement n'est conservée que pour le statut « En cours » (achete / pas_commence / termine → pas de page résiduelle).
- **Graphe d'évolution des lectures réutilisable** : le graphe « course du club » de l'accueil est désormais aussi affiché dans la **fiche d'un livre élu** (bibliothèque), figé sur le **mois d'élection** du livre (axe X = jours de ce mois, libellé du mois en sous-titre). Les points de `progression_lecture` restent en base pour les mois passés → le graphe est donc consultable a posteriori.
  - **Nouveau module partagé `lis-tes-ratures/js/progression-chart.js`** : `buildSeries(points, membres, monthStart)`, `buildChartSVG(series, monthStart, opts)`, `buildSparkSVG`, `buildLegendHTML`, `wireHighlight`, `memberColor`. Garantit un graphe strictement identique entre l'accueil et la fiche.
  - **Pas de point synthétique de fin de mois** : la courbe s'arrête au dernier point réel (qui finit le 10 finit le 10). Seul le point de départ (jour 1 à 0 %) est synthétique. Rappel : les points de `progression_lecture` ne sont créés qu'à chaque mise à jour de page > 0 (ou « Terminé ») via le suivi de l'accueil — un mois où les membres n'ont saisi qu'une fois donnera forcément une courbe pauvre (donnée non récupérable a posteriori, rien n'est supprimé).
  - **Anti-overshoot du lissage** (`smoothPath`) : les points de contrôle Bézier sont bornés à la boîte de leur segment. Sans ça, un point isolé après une longue ligne droite (espacement très inégal) générait une tangente énorme → grande boucle parasite sur la courbe (et dépassement au-dessus de 100 %).
  - **Tooltip au survol des points** (`wireTooltip`) : survoler un point réel affiche le membre, l'avancement au moment du point (`page/total unité · %`) et la date/heure de l'entrée. Sert à repérer une entrée Firestore douteuse. Cibles de survol = cercles transparents `.dot-hit` (r=6) dessinés au-dessus ; lignes/points visibles passent en `pointer-events:none`. **Actif sur le graphe plein de l'accueil (modal au clic sur la carte graphe) ET sur la fiche** des livres élus. Le style du tooltip est **posé inline en JS** (indépendant du CSS de page) — sinon, sans la règle `.chart-tip`, il s'affichait en bloc pleine largeur mal placé.
  - **Tailles** : la fenêtre du graphe de l'accueil est agrandie (`.modal.graph-modal` max-width 1320 px). Sur la **fiche** d'un livre élu, le graphe reste compact mais un bouton **« Agrandir »** (`#fiche-graph-zoom`) l'ouvre dans une grande fenêtre (`#fgraph-overlay`, même rendu que l'accueil).
  - `lis-tes-ratures/js/accueil.js` — utilise le module partagé (comportement inchangé) ; le mois est calculé via `currentMonthStart()`.
  - `lis-tes-ratures/js/bibliotheque.js` — `openFiche()` charge `getProgressionForLivre(id)` pour les élus et injecte la section « Évolution des lectures » après les avancements membres.
  - `lis-tes-ratures/bibliotheque.html` — CSS du graphe dans la fiche (adapté au fond papier crème).

### 2026-06-11 (suite 14)
**Lis tes ratures — accès libre (mot de passe retiré)**

- `lis-tes-ratures/js/auth.js` — `requireAuth()` devient un no-op (plus de gate). JDR/Atelier non touchés (auth.js séparés).
- `index.html` (racine) — badge de la carte « Lis tes ratures » : 🔒 Mot de passe → ✨ Accès libre.

### 2026-06-11 (suite 13)
**Couvertures — override manuel fiable (n'importe quelle URL d'image)**

- Problème : une URL Open Library/Google collée dans « URL de couverture (manuel) » était prise pour de l'auto (`isAutoUrl`) et pouvait être écrasée.
- `lis-tes-ratures/js/db.js` — `updateLivreInfos()` pose `couv_manuelle: true` quand une URL est saisie.
- `lis-tes-ratures/js/covers.js` — l'override manuel est respecté dès que `couv_manuelle` est vrai (n'importe quelle source). `isAutoUrl` ne sert plus qu'au fallback legacy.
- `lis-tes-ratures/js/bibliotheque.js` — pré-remplissage du champ basé sur `couv_manuelle`. → On peut coller n'importe quelle URL d'image (Babelio, OL `b/id/…`, etc.) et elle reste.

### 2026-06-11 (suite 12)
**Bibliothèque — ouverture des livres toujours active + auteur/proposant à l'intérieur**

- `lis-tes-ratures/bibliotheque.html` — retrait de la barre toggle « Infos complémentaires » (`.ai-toggle-bar`).
- `lis-tes-ratures/js/bibliotheque.js` — `#prop-grid` reçoit toujours la classe `infos-on` (ouverture au survol permanente, plus de localStorage `ltr_bib_ai`). Les cartes propositions affichent désormais **Auteur** et **Proposé par** à l'intérieur (`.bk-page`), visibles même quand la vraie couverture masque la façade.
- `lis-tes-ratures/css/style.css` — `.bk` rallongée (262 → 300 px, proportion couverture ~2:3) et espacements de `.bk-page` resserrés pour que les 4 lignes d'infos + description tiennent sans déborder.

### 2026-06-11 (suite 11)
**Couvertures — fiche bilan des votes + médaille podium au premier plan**

- `lis-tes-ratures/js/votes.js` — couverture en haut de la **fiche bilan d'un scrutin** (`.wcover`) + ré-hydratation/retrait au toggle (suivi via `curResultVote`).
- `lis-tes-ratures/index.html` — `.pp-rank` (numéro/médaille du podium) passe en `z-index:5` pour rester **au-dessus** de la vraie couverture.

### 2026-06-11 (suite 10)
**Vraies couvertures étendues à 5 nouvelles surfaces**

- `lis-tes-ratures/js/covers.js` — `removeAllCovers()` (retire les couvertures du DOM au décochage).
- `accueil.js` — couvertures sur le **podium** (`.pp-cover`) ; listeners du podium attachés une seule fois ; re-render au toggle.
- `bibliotheque.js` + `css/style.css` — vignette `.bib-elu-cover` sur la **tranche des livres élus** (uniquement si toggle ON).
- `votes.js` — couvertures dans le **registre des scrutins** (`.scrutin-cover`) + re-render au toggle.
- `membres.js` — couvertures des **livres proposés** dans les fiches membres (`.rf-prop-cover`) + ré-hydratation/retrait au toggle.
- `reunions.js` — couverture de la **fiche réunion** (`.mtg-cover`) + re-render au toggle.

### 2026-06-11 (suite 9)
**Couvertures — vider le cache mémoire à l'édition**

- `lis-tes-ratures/js/covers.js` — `invalidateCoverCache(livreId)` (supprime l'entrée du `sessionCache` en mémoire).
- `lis-tes-ratures/js/bibliotheque.js` — appelé après l'enregistrement d'une fiche. Sans ça, changer l'ISBN d'un livre **qui avait déjà une couverture** ne la mettait pas à jour (l'ancienne restait en mémoire jusqu'au rechargement complet de la page).

### 2026-06-11 (suite 8)
**Couvertures — séparation auto / manuel (changer l'ISBN relance le calcul)**

- Problème : `couverture_url` servait à la fois de cache auto ET d'override manuel → changer l'ISBN d'un livre ne changeait pas sa couverture (l'ancienne, stockée au même endroit, restait prioritaire).
- `lis-tes-ratures/js/covers.js` (`SEARCH_V` → 5) — nouveau champ `couv_cache` (couverture auto, versionnée) distinct de `couverture_url` (override manuel uniquement). `isAutoUrl()` détecte les URL Open Library/Google (gère les anciennes valeurs auto en legacy). Le bump force le **recalcul de toutes les couvertures existantes** → répare les fausses au passage.
- `lis-tes-ratures/js/db.js` — `updateLivreInfos()` met `couv_cache`/`couv_v` à `null` (recalcul si l'ISBN change).
- `lis-tes-ratures/js/bibliotheque.js` — le champ « URL de couverture (manuel) » de l'édition ne se pré-remplit qu'avec une **vraie** URL manuelle (pas l'auto).

### 2026-06-11 (suite 7)
**Bibliothèque — enrichissement uniquement à l'ajout (toujours par l'IA)**

- `lis-tes-ratures/bibliotheque.html` — retrait du bouton « Enrichir la bibliothèque » et de son panneau ; retrait des champs IA (genre/pages/description) du formulaire de proposition (remplacés par une note « remplis automatiquement par l'IA »).
- `lis-tes-ratures/js/bibliotheque.js` — suppression de tout le code du panneau de rattrapage ; le formulaire d'ajout remplit **toujours** genre/pages/description/ISBN via l'IA (plus de saisie manuelle à la création). Correction toujours possible via la fiche.

### 2026-06-11 (suite 6)
**Couvertures — validation titre/auteur (anti-mauvaise-couverture)**

- `lis-tes-ratures/js/covers.js` (`SEARCH_V` → 4) — une couverture n'est retenue **que si le livre derrière partage un mot du titre OU de l'auteur** (`candMatches`). S'applique à l'**ISBN** (validé via `openlibrary.org/api/books` avant usage — l'IA peut donner un ISBN d'un autre livre) **et** à la recherche floue (Open Library / Google Books vérifient `title`/`author` du résultat). Sinon → illustration générique.
- Symptôme corrigé : « Harry Potter » affiché sur « La Vague », « La religieuse » sur « Le maître du haut château ».
- ⚠️ Les couvertures **déjà** enregistrées (fausses) restent en base : pour les réévaluer, relancer l'enrichissement en mode « écraser » avec **ISBN + couverture** coché (réinitialise `couverture_url`/`couv_v` → recalcul validé).

### 2026-06-11 (suite 5)
**Enrichissement — garde-fou anti-mauvais-livre + modèle Sonnet + cache HTML**

- `api/enrich.js` — passage de **Haiku → Sonnet 4.6** : Haiku confondait des livres (« 1984 » identifié comme « Fondation »), ce qui, en mode « écraser », remplaçait des données manuelles par les mauvaises.
- `lis-tes-ratures/js/bibliotheque.js` — `plausibleMatch()` : on n'écrit les infos IA que si le livre identifié partage un mot du **titre OU de l'auteur**. Appliqué à l'ajout et au panneau ; les livres non identifiés sont comptés et ignorés (« N non identifiés »).
- `worker.js` — force `Cache-Control: no-cache` sur les pages HTML (corrige « la nouvelle fonctionnalité n'apparaît pas » dû au cache navigateur en mode Worker).

### 2026-06-11 (suite 4)
**Lis tes ratures — Enrichissement : panneau de contrôle (champs + portée)**

- `lis-tes-ratures/bibliotheque.html` — modal `#enrich-overlay` : cases à cocher (genre / pages / description / ISBN+couverture) + radios de portée (champs vides · écraser).
- `lis-tes-ratures/js/bibliotheque.js` — le bouton ouvre le panneau au lieu d'un `confirm`. Mise à jour sélective par champ, mode « écraser » optionnel, compteur de cibles en direct, réinitialisation des couvertures en mode écrasement+ISBN. Aucun lancement automatique.

### 2026-06-11 (suite 3)
**Infra — passage de la convention Pages `functions/` à un vrai Worker**

- Constat : le site est un **Cloudflare Worker** (`npx wrangler deploy`, domaine `*.workers.dev`), pas un projet Pages → `functions/api/enrich.js` n'était jamais servi (404).
- `worker.js` (nouveau) — point d'entrée Worker : route `/api/enrich`, délègue le reste à `env.ASSETS`.
- `api/enrich.js` (déplacé depuis `functions/`) — exporte `handleEnrich(request, env)`.
- `wrangler.toml` (nouveau) — `name = "nardoll"`, `main = "worker.js"`, `[assets] directory = "./"`, `nodejs_compat`.
- `.assetsignore` (nouveau) — exclut le code Worker du service public.
- `functions/` supprimé.

### 2026-06-11 (suite 2)
**Lis tes ratures — Enrichissement IA (couvertures exactes par ISBN + infos auto)**

- `functions/api/enrich.js` (nouveau) — Cloudflare Pages Function : enrichissement d'un livre via Claude Haiku (genre, pages, description, **ISBN-13**), clé en secret serveur `ANTHROPIC_API_KEY`. Le projet passe de « 100 % statique » à « statique + 1 fonction ».
- `lis-tes-ratures/js/covers.js` — `SEARCH_V` → 3 : tentative de couverture par **ISBN exact** (validée par `imageOk()`) avant la recherche floue.
- `lis-tes-ratures/js/bibliotheque.js` — `fetchEnrichment()` à l'ajout (remplit les champs vides + ISBN) ; bouton « Enrichir la bibliothèque » (rattrapage des livres existants) ; champ ISBN manuel dans l'édition.
- `lis-tes-ratures/js/db.js` — `addLivre()` et `updateLivreInfos()` gèrent `isbn13`.
- `lis-tes-ratures/bibliotheque.html` — bouton « Enrichir la bibliothèque » dans l'en-tête.
- Nouveau champ Firestore `livres.isbn13`. Voir section [Enrichissement IA](#enrichissement-ia).

### 2026-06-11 (suite)
**Lis tes ratures — Couvertures : meilleure recherche + cadrage entier**

- `lis-tes-ratures/js/covers.js` — recherche en cascade (Open Library titre+auteur, Google Books ciblé, Google Books souple, Open Library titre seul ; 5 résultats au lieu d'1, `&zoom=2`) → bien plus de couvertures trouvées, dont éditions traduites. Ajout d'un numéro de version `SEARCH_V` (champ `couv_v`) pour relancer la recherche sur les livres restés sans couverture. `hydrateCover()` génère désormais un `<div class="real-cover">` (fond flou + image entière).
- `lis-tes-ratures/css/style.css` — `.real-cover` : couverture en `object-fit: contain` sur un fond flou (`::before`) → plus de titres rognés ni de bandes vides.
- Nouveau champ Firestore `livres.couv_v`.

### 2026-06-11
**Lis tes ratures — Vraies couvertures de livres (toggle sidebar)**

- `lis-tes-ratures/js/covers.js` (nouveau) — récupération des couvertures via Open Library + repli Google Books, cache dans `livres.couverture_url`, helper `hydrateCover()`.
- `lis-tes-ratures/js/nav.js` — toggle « Vraies couvertures » dans `.sidebar-bottom`, persisté `localStorage` `ltr_covers`, dispatch `ltr-covers-change`.
- `lis-tes-ratures/js/bibliotheque.js` — hydratation des cartes propositions / éliminés / fiches + champ « URL de couverture (manuel) » dans le formulaire d'édition + re-render sur toggle.
- `lis-tes-ratures/js/accueil.js` — hydratation du livre du mois (`.lm-cover`) et de sa fiche + re-render sur toggle.
- `lis-tes-ratures/js/db.js` — `updateLivreInfos()` gère désormais `couverture_url`.
- `lis-tes-ratures/css/style.css` — styles `.covers-toggle` (interrupteur sidebar) et `.real-cover` (image superposée, fondu).
- Voir section [Couvertures réelles](#couvertures-réelles). Nouveau champ Firestore `livres.couverture_url`.

### 2026-06-10 (suite 3)
**Lis tes ratures — Fiche réunion : étoiles à la place des barres dans "Notes du club"**

- `lis-tes-ratures/js/reunions.js` — `buildReadBlock()` : la barre de progression (`.mtg-note-track`/`.mtg-note-fill`) est remplacée par 10 étoiles `★`/`☆` remplies selon la note (arrondie à l'entier, bornée 0–10).
- `lis-tes-ratures/reunions.html` — CSS : `.mtg-note-stars` reprend la DA des étoiles des fiches membres (`.rf-ballot-stars` : terracotta `#b5572d`, `letter-spacing: -.04em`), taille `.92rem`. Règles `.mtg-note-track`/`.mtg-note-fill` supprimées.

### 2026-06-10 (suite 2)
**Lis tes ratures — Graphique d'évolution : axe horizontal des jours**

- `lis-tes-ratures/js/accueil.js` — `buildChartSVG()` : ajout de l'axe X (jours du mois, du 1ᵉʳ au dernier jour). Repères aux jours 1, 5, 10, 15, 20, 25 et dernier jour du mois (calculé depuis `currentVote` ou le mois courant). Labels `.axis-lbl` sous le graphique + lignes verticales pointillées `.grid-line.vday`.
- `lis-tes-ratures/index.html` — règle CSS `svg.chart .grid-line.vday` (pointillés `2 5`, opacité .65) — même style discret que la grille horizontale existante.

### 2026-06-10 (suite)
**Lis tes ratures — Bulletin de vote : colonnes de notes colorées**

- `lis-tes-ratures/js/vote.js` — `buildVoteTable()` : attribut `data-n="1"` à `"5"` ajouté sur les `<th class="numcol">` et `<td class="numcol">`.
- `lis-tes-ratures/vote.html` — 5 règles CSS : fond très pâle par colonne de note (1 rouge brique → 2 orange → 3 jaune ocre → 4 vert clair → 5 vert soutenu, opacités 6,5 % à 12 %) pour marquer visuellement l'impact d'un vote, comme dans l'ancienne version. Tons chauds compatibles DA parchemin. S'applique au bulletin actif et à l'aperçu.

### 2026-06-10
**Lis tes ratures — Favicon, correctifs accueil/stats, skeleton loading**

`lis-tes-ratures/` :

**Favicon :**
- Ajout de `<link rel="icon" type="image/png" href="/lis-tes-ratures-ltr.png" />` dans le `<head>` des 8 pages HTML (`index.html`, `bibliotheque.html`, `votes.html`, `vote.html`, `membres.html`, `reunions.html`, `statistiques.html`, `commentaires.html`). Favicon `lis-tes-ratures-ltr.png` placé à la racine du repo.

**3 correctifs Accueil & Statistiques :**
- `js/statistiques.js` — `renderBilanProps()` : les filtres utilisaient les mauvais statuts Firestore (`"elimine"` / `"propose"` inexistants) → colonne "Éliminés" toujours à 0. Corrigé : `"refuse"` et `"en_proposition"`.
- `js/accueil.js` — Bouton "Ajouter au suivi" : après `upsertStatutLecture()`, le membre créé (statut `pas_commence`) disparaissait du dropdown sans apparaître dans les barres. Deux causes corrigées :
  1. `membresAvecSuivi` filtrait les membres avec `pas_commence` + page vide → ils n'apparaissaient pas dans les barres. Filtre simplifié : tout membre avec une entrée dans `statutByMembre` est inclus.
  2. `untracked` (dropdown) était calculé depuis `membresAvecSuivi` au lieu de `!statutByMembre[m.id]` → les membres fraîchement ajoutés restaient visibles dans le select.
  3. Après ajout, la modal d'édition s'ouvre immédiatement (`openMembreEdit(membreId)`) pour que l'utilisateur complète les infos.
- `js/accueil.js` — État fantôme (membre ayant une entrée `pas_commence` mais invisible partout) : résolu par les corrections ci-dessus. Les membres `pas_commence` s'affichent maintenant avec le label "Pas commencé" dans les barres.

**Skeleton loading — toutes les pages :**
- `css/style.css` : ajout de `@keyframes sk-shimmer` et de la classe `.sk` (gradient shimmer animé 1.4s, couleurs `var(--border)` / `var(--surface2)`). Un seul fichier CSS, aucun JS modifié — les skeletons disparaissent automatiquement quand le JS remplace le `innerHTML`.
- `index.html` : skeletons dans `#lm-mount` (carte livre + barres membres), `#frise-mount` (5 tuiles en opacité dégressive), `#podium` (3 livres façon podium), `#rank-list` (2 lignes de classement).
- `bibliotheque.html` : skeletons dans `#prop-grid` (3 cartes proposition), `#elus-list` (2 lignes élu avec couverture + notes), `#elim-grid` (4 chips éliminé).
- `votes.html` : skeletons dans `#live-mount` (carte `.live` 2 colonnes avec anneau droit), `#scrutins-mount` (3 lignes `.scrutin` en grille).
- `vote.html` : skeleton dans `#ballot-root` (en-tête lettre + bannière + 3 lignes de table de vote avec dots).
- `membres.html` : skeletons dans `#rack` (3 fiches `.fp` papier avec cachet, nom, datestamps, stats, rotations).
- `reunions.html` : skeletons dans `#reg-rows` (3 lignes `.reg-row` ledger avec cachet date, titre, pips présence, sceau note).
- `statistiques.html` : skeletons dans `#kpis-root` (4 KPI), `#hist10-bars` (histogramme 10 colonnes), `#hist5-bars` (histogramme 5 colonnes), `#participation-content` (3 barres horizontales avec labels).
- `commentaires.html` : skeletons dans `#reading` (3 entrées `.com` avec anneau et carte accordéon).

**Page d'accueil — carte Lis tes ratures redessinée :**
- `index.html` : la carte "Lis tes ratures" a été entièrement redessinée dans la DA du club de lecture ("café littéraire × vieille bibliothèque"). Les 3 autres cartes (JDR, Jeux, Atelier) restent inchangées.
  - Fond parchemin `linear-gradient(160deg, #fdf6ea, #ede0c4)` — contraste immédiat avec le fond sombre `#0a0a0a` de la page
  - Reliure terracotta `#b5572d` (6px, `::after` arrondi à gauche) — effet dos de livre
  - Eyebrow "Club de lecture" en petites majuscules serif Georgia, terracotta
  - Titre "Lis tes **ratures**" en serif Georgia avec la rature oblique signature (barre terracotta 2.5px, `rotate(-1.2deg)`) sur "ratures"
  - Filet de séparation `linear-gradient(90deg, rgba(181,87,45,.5), transparent)` sous le titre
  - Description en brun chaud `#5a3f26` au lieu du gris générique
  - Pied de carte : badge terracotta à gauche + mini étagère de 7 livres colorés à droite (rectangles CSS, hauteurs variées, `box-shadow` interne simulant l'épaisseur du dos)
  - Hover : parchemin légèrement éclairci + bordure terracotta + flèche `→` en terracotta
  - Classes ajoutées : `.ltr-card`, `.ltr-eyebrow`, `.ltr-title`, `.ltr-rature`, `.ltr-rule`, `.ltr-desc`, `.ltr-foot`, `.ltr-badge`, `.ltr-shelf`, `.ltr-book`

### 2026-06-04 (suite 13)

**JDR — Carte : zone pleine hauteur**

- `jdr/css/style.css` : `#tab-carte` passe en `display:flex; flex-direction:column; height:calc(100vh - 210px)`. `#carte-zone` prend `flex:1` — s'étire pour remplir tout l'espace disponible sous la toolbar.

### 2026-06-04 (suite 12)

**JDR — Développement : pages = nombre réel de pages du projet**

- `jdr/js/campagne.js` : KPI "pages" = `wikiPages.length + quetes.length` (plus d'estimation ÷ 250).
- `jdr/campagne.html` : label mis à jour "pages dans le projet".

### 2026-06-04 (suite 11)

**JDR — Carte : outil main (pan + zoom molette)**

- `jdr/campagne.html` : bouton 👆 → ✋.
- `jdr/css/style.css` : `#carte-zone` devient le viewport clippé (`overflow:hidden`), `.carte-wrap` reçoit `transform-origin:0 0` et `will-change:transform`. Curseur `grab` / `grabbing` selon l'état.
- `jdr/js/campagne.js` : état `pan { tx, ty, scale, active }` + `applyMapTransform()` + `resetPan()`. Outil ✋ : clic maintenu = déplacement, molette = zoom centré sur le curseur (`min 0.1×, max 10×`). Pan réinitialisé au changement d'image.

### 2026-06-04 (suite 10)

**JDR — Supprimer une page wiki / quête**

- `jdr/wiki-page.html` : bouton "🗑️ Supprimer" dans la topbar (à gauche du 💾).
- `jdr/js/wiki-page.js` : import `deleteDoc`. Fonction `deletePage()` — confirmation native avec le titre de la page, supprime le document Firestore, redirige vers `campagne.html`. Fonctionne pour les pages wiki et les quêtes (collection dynamique via `COLL`).

### 2026-06-04 (suite 9)

**JDR — Onglet Développement (suivi de progression)**

- `jdr/campagne.html` + `jdr/js/campagne.js` : nouvel onglet **✍️ Développement**.
  - **KPIs** : mots totaux calculés automatiquement depuis toutes les sections (wiki + quêtes + présentation, champs rapides inclus) via `countWords()` + `totalWordsInProject()` ; pages estimées (÷ 250) ; objectif quotidien configurable inline (champ éditable, sauvegardé dans `jdr_campagnes.objectif_mots_par_jour` avec debounce 800 ms) ; mots écrits aujourd'hui (delta automatique).
  - **Snapshot automatique** : à chaque ouverture de l'onglet, `snapshotToday()` enregistre silencieusement le total de mots actuel du projet dans `jdr_camp_dev_journal` (champ `mots_total`). Pas de saisie manuelle. Le delta quotidien = snapshot aujourd'hui − snapshot veille via `getDelta(dateStr)`.
  - **Résumé du jour** : affiche `+N mots écrits aujourd'hui`, statut "🎯 Objectif atteint !" / "X mots manquants" / neutre.
  - **Bar chart "Mots par jour"** (30 derniers jours) : deltas quotidiens, barres vertes si ≥ objectif, atténuées sinon. Ligne rouge pointillée = objectif.
  - **Line chart "Progression cumulée"** : `mots_total` réel dans le temps (pas une somme reconstituée).
  - Les graphiques se re-rendent à l'activation de l'onglet.
- `jdr/css/style.css` : styles `.dev-kpis`, `.dev-kpi`, `.dev-objectif-input`, `.dev-today-card`, `.dev-delta-num`, `.dev-status-ok/progress/neutral`, `.dev-charts`, `.dev-chart-card`.

**Collection Firestore ajoutée :**

| Collection | Champs |
|------------|--------|
| `jdr_camp_dev_journal` | `campagne_id`, `date_str` (YYYY-MM-DD), `mots_total` (snapshot total), `cree_le` |

**Champ Firestore ajouté sur `jdr_campagnes` :**

| Champ | Type | Description |
|-------|------|-------------|
| `objectif_mots_par_jour` | number | Objectif quotidien de l'onglet Développement (défaut : 500) |

### 2026-06-04 (suite 8)

**JDR — Valider une section sauvegarde automatiquement**

- `jdr/js/wiki-page.js` + `jdr/js/campagne.js` : `validateSection` déclenche `savePage` / `savePresentation` immédiatement après fermeture de l'éditeur. Plus besoin de cliquer 💾 séparément après avoir validé une section.

### 2026-06-04 (suite 7)

**JDR — Émoji du projet modifiable en inline**

- `jdr/campagne.html` + `jdr/js/campagne.js` : clic sur l'émoji → input compact (2 rem, bordure accent). Entrée confirme, Échap annule. Seul le premier caractère emoji est retenu. Sauvegardé dans `jdr_campagnes.emoji`, `<title>` mis à jour immédiatement.
- `jdr/css/style.css` : styles `.camp-emoji-editable`, `.camp-emoji-input`.

### 2026-06-04 (suite 6)

**JDR — Idées : case à cocher "utilisée"**

- `jdr/js/campagne.js` : chaque carte idée dispose d'une checkbox en début de ligne. Cochée → carte atténuée (opacity 55%), titre barré. Mise à jour optimiste du DOM + sauvegarde Firestore (`utilisee: boolean` sur `jdr_camp_idees`).
- `jdr/css/style.css` : styles `.idee-check-label`, `.idee-check-box`, `.idee-utilisee`.

### 2026-06-04 (suite 5)

**JDR — Onglet Présentation générale + renommage projet**

- `jdr/campagne.html` + `jdr/js/campagne.js` : nouvel onglet **📋 Présentation** entre Chronologie et Idées.
  - **Éditeur de sections** : même mécanique que `wiki-page.js` (mode lecture/édition, couleurs de fond, ↑↓, supprimer, valider). Sauvegardé directement dans le champ `sections_presentation` du document `jdr_campagnes` — pas de nouvelle collection Firestore.
  - **Bilan automatique des quêtes principales** : en bas de l'onglet, toutes les quêtes `type_quete === 'principale'` regroupées par arc dans l'ordre de la Chronologie. Chaque quête est un lien cliquable → `wiki-page.html?type=quete&id=...`. Les quêtes sans arc apparaissent sous "Sans arc".
- **Renommage du projet** : le titre `<h1>` du projet est maintenant cliquable (curseur texte, hover léger). Clic → bascule en `<input>` inline avec bordure accent. Entrée ou clic ailleurs confirme et sauvegarde dans `jdr_campagnes.nom` via Firestore. Échap annule sans modifier. Le `<title>` de la page est mis à jour immédiatement.
- `jdr/css/style.css` : styles `.pres-editor-wrap`, `.pres-topbar`, `.pres-bilan-wrap`, `.pres-bilan-arc`, `.pres-bilan-quete`, `.camp-nom-editable`, `.camp-nom-input`.

**Schéma Firestore — nouveau champ sur `jdr_campagnes` :**

| Champ | Type | Description |
|-------|------|-------------|
| `sections_presentation` | array | Sections libres de l'onglet Présentation `[{ id, titre, contenu, color }]` |

### 2026-06-04 (suite 4)

**Wiki pages — mode lecture / édition par section**

- `jdr/js/wiki-page.js` : les sections s'affichent en **mode lecture** par défaut (texte rendu proprement, `white-space:pre-wrap`). Survol → bouton **✏️ Modifier** apparaît en haut à droite. Clic → bascule en **mode édition** (titre + textarea + palette couleur). Bouton **✓ Valider** → lit les valeurs du DOM, met à jour `sections[i]`, referme l'éditeur. Nouvelles sections créées directement en mode édition. Gestion de `editingSections` (Set d'indices) — les indices sont recalculés après suppression ou déplacement.
- `jdr/css/style.css` : styles `.wp-section-view`, `.wp-section-view-title`, `.wp-section-view-content`, `.wp-sec-edit-btn` (opacity 0 → 1 au hover), `.wp-view-empty`, `.wp-sec-validate`.

### 2026-06-04 (suite 3)

**Wiki pages — couleur de fond par section**

- `jdr/js/wiki-page.js` : constante `PALETTE` (8 entrées : aucune + vert/jaune/bleu/violet/rouge/cyan/orange). Chaque section affiche une rangée de dots colorés dans sa barre (mode édition). Clic → applique `data-color` sur le div section sans re-render, met à jour `sections[i].color`. Couleur persistée dans `sections[].color` (Firestore).
- `jdr/css/style.css` : `.wp-section[data-color="..."]` — fond teinté (rgba ~.13) + bordure gauche colorée. `.wp-section[data-color] .wp-section-bar` → fond légèrement plus sombre. `.wp-section[data-color] .wp-section-body` → transparent. Adapté thème clair. Styles `.wp-col-dot`, `.wp-col-active`.

### 2026-06-04 (suite 2)

**JDR — Refonte module Projets : wiki pages dédiées, quêtes, boîte à idées**

**Wiki restructuré**
- `jdr/campagne.html` + `jdr/js/campagne.js` : 6 catégories univers (Personnages · Lieux · Objets · Créatures · Factions · Légendes). Suppression des catégories Pistes et Quêtes (déplacées en Chronologie).
- Clic sur une carte wiki → navigation vers `/jdr/wiki-page.html?camp=CAMP_ID&type=wiki&id=PAGE_ID` (plus de modale).
- Création : modale simplifiée (titre + catégorie uniquement) → crée le doc Firestore → redirige vers la page.

**Nouvelle page wiki / quête (`wiki-page.html` + `wiki-page.js`)**
- Breadcrumb ← Projet, badge catégorie, titre éditable (h1 inline).
- **Infos rapides** (wiki) : champs structurés par catégorie (rôle, type lieu, porteur, habitat, leader, etc.) dans un bandeau collapsé.
- **Associations** (quêtes) : cases à cocher arcs associés + lieux associés (depuis le wiki).
- **Éditeur de sections** : autant de sections que voulu, chaque section = sous-titre optionnel + textarea. Réorder ↑↓, supprimer, **Ctrl+S** pour sauvegarder.
- État "non sauvegardé" (● orange) / "Sauvegardé" (✓ vert) en temps réel.

**Chronologie restructurée**
- `jdr/js/campagne.js` : les arcs affichent leurs **quêtes** (Principale ⭐ / Importante 🔑 / Secondaire 📌) sous forme de liens cliquables → wiki-page.html?type=quete.
- Bouton "+ Quête" dans chaque arc → modale (titre + type) → crée dans `jdr_camp_quetes` → redirige vers la page quête.
- Suppression des scénarios texte simples (remplacés par les quêtes pages).

**Boîte à idées (4e onglet)**
- Formulaire inline : titre (optionnel) + note. Ajout rapide (Ctrl+Entrée). Liste triée par date décroissante. Suppression individuelle.

**Collections Firestore ajoutées / modifiées**

| Collection | Changement |
|------------|------------|
| `jdr_camp_wiki` | `sections: [{ id, titre, contenu, color }]` — remplace `contenu` plat ; `fields` conservé pour infos rapides |
| `jdr_camp_quetes` | **Nouvelle** — `{ campagne_id, titre, type_quete, arc_ids[], lieu_ids[], sections[], statut, ordre, cree_le, mis_a_jour }` |
| `jdr_camp_idees` | **Nouvelle** — `{ campagne_id, titre, contenu, cree_le }` |
| `jdr_camp_chrono` | `scenarios[]` supprimé — remplacé par `jdr_camp_quetes` |

**Navigation**

| Page | URL |
|------|-----|
| Page wiki ou quête | `/jdr/wiki-page.html?camp=CAMP_ID&type=wiki\|quete&id=DOC_ID` |

### 2026-06-04 (suite)

**JDR — Nouveau module "Projets" (Wiki + Carte + Chronologie) — version initiale**

- `jdr/campagne.html` : page workspace projet, accessible via `/jdr/campagne.html?id=CAMP_ID`
- `jdr/js/campagne.js` : logique complète (export `initCampagne`)
- `jdr/js/nav.js` : section "Projets" dynamique en sidebar + bouton "+" → modal → redirection
- `jdr/css/style.css` : styles sidebar projets, page camp, wiki, carte, chronologie, toast

**Onglet Carte**
- Image via URL (Discord, Imgur, GitHub raw…)
- Canvas overlay : dessin libre (crayon couleur + épaisseur), gomme, effacement total
- Marqueurs cliquables : label + couleur + lien vers page wiki. Pin colorée avec initiale.
- Sauvegarde manuelle (💾) → Firestore

**Collections Firestore ajoutées (version initiale)**

| Collection | Description |
|------------|-------------|
| `jdr_campagnes` | `{ nom, emoji, cree_le }` — un doc par projet |
| `jdr_camp_carte` | `{ campagne_id, image_url, annotations[], markers[], mis_a_jour }` — un doc par campagne |
| `jdr_camp_chrono` | `{ campagne_id, titre, type, statut, description, ordre, cree_le, mis_a_jour }` |

> **Image carte** : l'image doit être hébergée en ligne (URL). Firebase Storage peut être ajouté ultérieurement pour l'upload direct.

### 2026-06-04

**Réunions — Nombre de lecteurs dans la liste**

- `club-lecture/js/reunions.js` : `renderReunionItem` affiche maintenant « N participants · X ont fini » (le nombre de personnes ayant terminé le livre). Utilise `lecteurs_ids` si défini, sinon retombe sur `notes_finales > 0` (rétrocompat).

**Stats — Classement membres actifs refait (×3 versions successives)**

- `club-lecture/js/stats.js` : score final = `réunion×3 + livre fini×3 + proposition×1 + vote×1 + commentaire×1`. Colonnes : Livres finis · Réunions · Propositions · Votes · Commentaires. Ajout de `propositionsParMembre` (depuis `livres.propose_par`) et `reunionsParMembreActif` (depuis `reunions.participant_ids` des réunions passées).
- `club-lecture/css/style.css` : grille CSS passée à `repeat(5, 80px)` avec `line-height:1.3` et `word-break` pour les en-têtes. Ajout du bouton "i" (`.membres-actifs-info`) : au survol, une 6e colonne "🏅 Score" apparaît en accent avec le score calculé de chaque membre — disparaît au départ de la souris. Styles `.stats-membres-score`, `.membres-actifs-footer`, `.membres-actifs-info`.

**Stats — Graphique "Notes après lecture par membre"**

- `club-lecture/stats.html` : nouvelle section "📊 Notes après lecture par membre" + carte `#card-notes-membres` avec `<canvas id="chart-notes-membres">` et `<div id="notes-membres-legend">`.
- `club-lecture/js/stats.js` : nouvelle fonction `renderNotesParMembre(s)` — graphique Chart.js `type: "line"`. X = livres élus dans l'ordre chronologique ; Y = notes /10. Une courbe par membre, `spanGaps:false` (ne relie pas les points nuls). Légende custom en bas : hover sur un nom → courbe mise en avant, autres estompées (alpha 0x28) ; clic → bascule activé/désactivé (classe `nm-legend-item--off`).
- `club-lecture/css/style.css` : styles `.nm-legend`, `.nm-legend-item`, `.nm-legend-item--off`, `.nm-legend-dot`, `.nm-legend-name`.

### 2026-06-03
**Accueil — Suivi de lecture hiérarchique (Partie + Chapitre)**

- `club-lecture/index.html` : modal "Configurer le suivi" refactorisée — toggle Simple / Hiérarchique. En mode hiérarchique : liste de lignes "Partie N · [nb chapitres]", bouton "+ Ajouter une partie", total calculé affiché en bas. Modal "Statut" : deux sections conditionnelles — simple (inchangé) ou hiérarchique (select Partie + input Chapitre avec max auto, hint "→ chapitre X sur Y au total").
- `club-lecture/js/accueil.js` : nouveaux helpers `totalChapitres`, `toAbsolute`, `fromAbsolute`, `isHierarchique`, `progressionLabel`. `openProgressionModal` gère les deux modes. `renderPartiesList` + `updateTotalHint` construisent la liste dynamique. `openStatutModal` bascule entre les deux sections selon le mode. `renderStatusList` affiche "P2 · Ch.7" au lieu du nombre brut en mode hiérarchique. `openCommentaireModal` adapte le label d'avancement.

**Schéma Firestore — nouveaux champs sur `livres` :**
| Champ | Type | Description |
|-------|------|-------------|
| `progression_mode` | string \| null | `'simple'` (défaut/ancien) ou `'hierarchique'` |
| `progression_parties` | array (number) \| null | Chapitres par partie, ex : `[5, 8, 6]` |

> `progression_total` est automatiquement calculé comme la somme des parties en mode hiérarchique. Rétrocompatibilité totale : les anciens livres sans `progression_mode` fonctionnent comme avant.

### 2026-06-02 (suite 8)
**Vote — seuil d'élimination relevé à 2,9 (temporaire)**

- `club-lecture/js/db.js` : seuil `refuse` passé de `<= 2.5` à `<= 2.9`. S'applique uniquement aux votes futurs — votes passés non affectés.
- `club-lecture/js/vote.js` : texte d'explication `.vt-rules` et affichage du contexte 2ème tour mis à jour (≤ 2,5 → ≤ 2,9).

### 2026-06-02 (suite 7)
**Vote — nouveau calcul (moy+méd)÷2 + option "Déjà lu" + chantier discret**

- `club-lecture/js/vote.js` : ajout de `median()`. `closeExpiredVote` calcule désormais le score comme `(moyenne + médiane) / 2` — stocké dans le champ `moyenne` du résultat Firestore pour rétrocompatibilité. Votes passés non affectés. Explication mise à jour dans l'encadré `.vt-rules` de la page de vote.
- `club-lecture/js/vote.js` : case à cocher "Déjà lu — je passe" sous le titre de chaque livre dans le tableau de vote. Si cochée : la ligne s'estompe (`vt-row-read`), les radios sont désactivés et le livre est exclu de la soumission et de la validation (`dejaLus` Set).
- `club-lecture/js/nav.js` : lien Chantier retiré du nav principal. Remplacé par un petit 🚧 discret en bas de la sidebar (opacity 30%, visible au survol).
- `club-lecture/css/style.css` : nouveaux styles `.vt-read-label`, `.vt-row-read`, `.sidebar-chantier-link`.

### 2026-06-02 (suite 6)
**Club — Page temporaire "Chantier vote" (analyse expérimentale)**

- `club-lecture/chantier.html` + `club-lecture/js/chantier.js` : nouvelle page d'analyse protégée par mot de passe, accessible via 🚧 discret en sidebar. Bannière disclaimer expliquant le caractère temporaire.
- **Onglet Combiné** : résultats du dernier vote simulés avec score (moy+méd)÷2. Tableau comparatif avec alertes si le résultat changerait.
- **Onglet Dispersion** : strip plot — points individuels par livre (jitterisés), avec ▲ médiane (référence), ◆ moyenne, ★ combiné. Légende numérotée. Tooltip affichant la dérive vs médiane.
- **Onglet Influence membres** : pour chaque votant, cumul des deltas (moyenne avec/sans lui) → hausse, baisse, delta net (barre), influence totale. Tri par colonne au clic.
- **Onglet Médiane seule** : même logique que l'onglet Combiné mais avec médiane pure (montre le problème des égalités).
- **Onglet Simulation** : checkboxes votants, recalcul temps réel de la moyenne sans les votants décochés.
- **Onglet Impact détaillé** : tableau croisé votant × livre, note − moyenne des autres, impact absolu moyen.
- `club-lecture/css/style.css` : styles `.cht-*` complets (disclaimer, onglets, tableau, badges, impact, simulation).

### 2026-06-02 (suite 5)
**Réunions — Séparation "présence" / "a lu le livre" + Vote — explication des règles + dégradé de couleur**

**Réunions :**
- `club-lecture/reunions.html` : nouveau champ "Ont lu le livre" (`#r-lecteurs-list`) dans le formulaire ajout/modification, indépendant de "Présents à la réunion".
- `club-lecture/js/db.js` : `addReunion()` stocke le nouveau champ `lecteurs_ids: []` dans Firestore.
- `club-lecture/js/reunions.js` : `openFormModal` peuple les deux listes de cases à cocher (présents / lecteurs). `form-save` collecte `lecteurs_ids`. `renderDetailContent` refonte : la dl "Présents" est info-only ; la section "📚 Ont lu le livre" liste les membres cochés comme lecteurs avec leurs inputs de notes. Bouton "Ajouter un lecteur" (dropdown) remplace l'ancien "Ajouter hors réunion" — il écrit `lecteurs_ids` dans Firestore. **Migration automatique** (`migrerLecteursIds`) : au chargement de la page, toute réunion sans `lecteurs_ids` est migrée une fois — le champ est peuplé depuis les membres ayant `notes_finales > 0`, puis écrit en Firestore. Après migration, toutes les réunions ont le champ.
- `club-lecture/js/accueil.js` : même fonction `migrerLecteursIds` (page d'accueil chargée en premier → migration déclenchée dès la première visite post-déploiement).
- `club-lecture/js/stats.js` : `membersWhoFinishedBook()` utilise `lecteurs_ids` si défini, sinon retombe sur `notes_finales > 0` (rétrocompat). Impacte : KPIs "Lectures cumulées" et "Pages cumulées", évolution dans le temps, membres actifs, bilan propositions.
- `club-lecture/js/membres.js` : filtre des réunions étendu à `lecteurs_ids`. Badge "hors réunion" si lecteur non présent ; "absent" conservé pour les anciennes données (uniquement dans `notes_finales`).

**Vote page (`vote.html`) :**
- `club-lecture/js/vote.js` : `renderVotingTable()` — encadré `.vt-rules` expliquant les règles (gagnant = plus haute moyenne, éliminé = moyenne ≤ 2,5) ajouté au-dessus du tableau. En-têtes de colonnes 1 et 2 marqués "élim." (`vt-elim-tag`). Classes `vt-col-1` à `vt-col-5` appliquées sur les `<th>` et `<td>`.
- `club-lecture/css/style.css` : dégradé de couleur colonnes : `.vt-col-1` rouge, `.vt-col-2` orange, `.vt-col-3` jaune, `.vt-col-4` vert clair, `.vt-col-5` vert foncé. Adapté modes sombre et clair. Nouveaux styles `.vt-col-num`, `.vt-elim-tag`, `.vt-rules`.

**Schéma Firestore — nouveau champ sur `reunions` :**

| Champ | Type | Description |
|-------|------|-------------|
| `lecteurs_ids` | array (string) | IDs des membres ayant lu le livre (indépendant de la présence à la réunion) |

### 2026-06-02 (suite 4)
**Stats — Nouvelles sections de statistiques + distribution des notes de vote**

- `club-lecture/js/stats.js` : refonte complète. `computeStats()` calcule désormais `reunionNotesParMembre` et `voteNotesParMembre` (notes par membre pour les deux types). `renderNoteDistCard()` : helper commun pour les graphiques de distribution avec **sélecteur de membre** (tout le club / un membre spécifique). `renderNoteMoyenne()` et `renderNoteVote()` utilisent ce helper. Nouvelle fonction `computeProposStats()` + 7 fonctions de rendu : `renderBilanPropositions`, `renderMatriceGouts`, `renderControverse`, `renderCorrelScatter`, `renderSimilarite`, `renderDureeVie`, `renderEvoProp`.
- `club-lecture/stats.html` : nouvelle carte "🗳️ Distribution des notes de vote" (/5, avec sélecteur de membre). 3 nouveaux séparateurs de section (`stats-section-divider`). 7 nouvelles cartes : bilan propositions, matrice des goûts, controversé/consensuel (row-2), corrélation vote→réunion (scatter Chart.js), qui vote comme qui (matrice Pearson), durée de vie (barres), évolution des propositions (barres empilées Chart.js). Chaque graphique porte un badge coloré indiquant sa source de données (bleu = votes d'élection /5 · orange = notes après lecture /10).
- `club-lecture/css/style.css` : nouveaux styles `.card-sub`, `.data-source-badge`, `.data-source-vote`, `.data-source-reunion`, `.note-membre-select`, `.stats-section-divider`, `.prop-bilan-*`, `.matrice-*`, `.ctrl-*`, `.dv-badge`, `.dv-elu`, `.dv-elim`.

### 2026-06-02 (suite 3)
**Votes — toggle par votant / par livre dans le graphique de détail**

- `club-lecture/js/votes.js` : la section "📊 Détail des votes" dispose maintenant de deux onglets pills. **Par votant** : sélecteur de membre → barres horizontales de ses notes par livre (livre élu surligné en vert), moyenne en tête. **Par livre** : sélecteur de livre → barres horizontales des notes de chaque membre, triées par note décroissante, moyenne en tête. Fonctions remaniées : `renderMemberChartSection` génère les deux selects + les onglets, `attachMemberChartInteraction` gère le switch et les deux rendus (`renderMembre` / `renderLivre`).
- `club-lecture/css/style.css` : nouveaux styles `.vote-chart-tabs`, `.vote-chart-tab`, `.vote-chart-tab.active` (pills, accent orange à l'état actif).

### 2026-06-02 (suite 2)
**Votes — moyenne du votant affichée au-dessus du graphique**

- `club-lecture/js/votes.js` : dans `attachMemberChartInteraction`, la moyenne des notes du membre sélectionné est calculée et affichée au-dessus des barres sous la forme "Moyenne : **X.XX/5**" (couleur accent, mise à jour à chaque changement de membre).

### 2026-06-02 (suite)
**Votes — graphique des notes par votant dans le détail du vote**

- `club-lecture/js/votes.js` : nouvelle section "📊 Notes d'un votant" en bas du détail de chaque vote. Sélecteur de membre (trié alphabétiquement, peuplé uniquement avec les membres ayant voté) + histogramme horizontal immédiat. Changer le membre re-rend le graphique instantanément. Le livre élu est mis en évidence (barre verte `.best`). Deux nouvelles fonctions : `renderMemberChartSection(sorted)` et `attachMemberChartInteraction(vote)`.
- `club-lecture/css/style.css` : style `.vote-member-select` (select pleine largeur max 280px, cohérent avec le thème).

### 2026-06-02
**Votes — moyenne par votant dans le tableau individuel**

- `club-lecture/js/votes.js` : colonne "Moy." ajoutée à droite du tableau des votes individuels. Affiche la moyenne des notes données par chaque membre sur l'ensemble des livres du vote. La ligne de pied de tableau (moyenne par livre) conserve une cellule vide à cet endroit.
- `club-lecture/css/style.css` : nouveaux styles `.vtable-member-avg-head` et `.vtable-member-avg` — séparateur gauche, couleur accent, gras.

### 2026-06-01
**Vote — Bilan des votants + sécurisation de l'interface**

- `club-lecture/vote.html` + `club-lecture/js/vote.js` : bloc "Participation — X / N" ajouté sous le formulaire de vote. Une pilule par membre : vert bordé `✓ Prénom` si voté, gris `· Prénom` si en attente. Mis à jour en temps réel après chaque soumission.
- `club-lecture/js/votes.js` : même bilan intégré dans l'encart "Vote en cours" de la page admin, sous le compte à rebours.
- `club-lecture/js/votes.js` : boutons "Clôturer" et "Annuler" retirés de l'interface pendant le vote actif — seul le bouton "🗳️ Accéder au vote →" reste visible.
- `club-lecture/css/style.css` : nouveaux styles `.bilan-list`, `.bilan-row`, `.bilan-voted`, `.bilan-pending`, `.bilan-icon`, `.vsc-bilan`, `.vote-votants-bilan-wrap`, `.vote-bilan-title`.

### 2026-05-31 (suite)
**Atelier — Barre de recherche sur la carte**

- `carte.html` : barre de recherche au-dessus de la toolbar. Champ texte avec icône 🔍, bouton ✕ pour effacer (visible uniquement quand du texte est saisi), compteur de résultats affiché à droite ("N résultats sur Total").
- `carte.js` : état `searchQuery`, fonction `cellMatchesSearch()` — teste le biome, l'environnement, le titre, la description, les mots clés et les caractéristiques (montagne/rivière). Debounce 150ms. Classe `hex-dimmed` appliquée dynamiquement dans `renderMap()` aux cellules non-correspondantes. `updateStats()` met à jour le compteur de résultats.
- `css/style.css` : nouveaux styles `.map-search-wrap`, `.map-search-field`, `.map-search-icon`, `.map-search-input`, `.map-search-clear`, `.map-search-count`, `.hex-dimmed` (opacity .18, pointer-events none).

### 2026-05-31
**Atelier — correctifs et améliorations carte**

- **Fix auth `carte-info.html`** : `sessionStorage` n'est pas partagé entre onglets navigateur — la page redemandait le mot de passe à chaque ouverture. Suppression de `requireAuth()` sur cette page (doc statique sans données sensibles).
- **Palette de couleurs par environnement** : refonte de `BIOME_COLORS` dans `generation.js` — chaque environnement a désormais une famille de teintes cohérente (tempéré = verts moyens, steppique = ocre, désertique = brun chaud, tropical = verts profonds, glacial = bleu-gris froid, volcanique = rouge sombre, maritime = bleu océan). Les biomes d'un même environnement restent visuellement proches.
- **Filtre de couleur par environnement** (`carte.js` + `carte.html`) : bouton toggle "🌍 Vue environnements" dans la toolbar de la carte. Quand actif, chaque hexagone prend une couleur vive et bien distincte selon son environnement (7 couleurs très espacées sur la roue chromatique). La légende bascule également vers les environnements présents. Retour aux couleurs de biome au second clic.
- **Batch +50 cellules** (`accueil.js` + `index.html`) : bouton dans la zone de test pour générer 50 cellules automatiquement en une fois. Chaque cellule est générée en passant les précédentes comme contexte (même algorithme que la révélation normale). Pas d'incrément du compteur journalier.
- **Fix suppression bulk** (`db.js`) : `deleteCollection` utilisait `Promise.all` avec des centaines de `deleteDoc` simultanés, ce qui saturait Firestore sur de grandes collections. Remplacement par `writeBatch` (paquets de 500 opérations atomiques) — la suppression fonctionne désormais quelle que soit la taille de la collection.

### 2026-05-30 (suite 7)
**Atelier — Système complet de génération procédurale des cellules + page de documentation**

**Nouveau moteur de génération (`generation.js`) :**
- 9 étapes de génération interconnectées, toutes implémentées dans `generateCell(cellules)`.
- **Étape 1** : sélection pondérée de la cellule candidate (score = 2^X, X = nombre de voisins découverts). Les cellules entourées de plusieurs voisins sont exponentiellement préférées.
- **Étape 2A** : continuité de l'environnement — 7 environnements (tempéré, steppique, désertique, tropical, glacial, volcanique, maritime), chacun avec ses propres seuils et probabilités de base (55% à 88%). Protection des petites zones à 95%.
- **Étape 2B** : matrice de transition entre environnements — transitions interdites entre voisins géographiquement impossibles (désertique↔glacial, tropical↔glacial, maritime↔volcanique).
- **Étape 3** : barrières naturelles — chaîne de montagne (×2.5), rivière large (×1.3), transition côtière (automatique).
- **Étape 4** : 40+ biomes répartis dans les 7 environnements, avec poids relatifs calibrés.
- **Étape 5** : modificateurs de proximité — 9 groupes de biomes compatibles avec coefficients 0.2 à 0.4, appliqués avant le tirage.
- **Étape 6** : rivières — probabilités par environnement (0–30%), continuité à 85%, biomes source/embouchure, delta à 20% pour grandes zones maritimes.
- **Étape 7** : montagnes — caractéristique superposée (prob. base 8%, +20/35/50% selon voisins montagne), axe directionnel calculé par analyse de covariance (+25% dans l'axe, −10% perpendiculaire).
- **Étape 8** : côtes et océan — seuils bidirectionnels (zone maritime < 5 cellules → 60% max, ≥ 20 → 92% min), continuité côtière (×1.75 par voisin côtier).
- **Étape 9** : îles et archipels — clustering (0 île voisine → 8%, 1 → 35%, 2 → 25%, 3+ → 15%), archipel linéaire via axe directionnel (+20% dans l'axe, −15% perpendiculaire).

**Mise à jour des fichiers existants :**
- `mots-cles.js` : suppression de l'ancien système de biomes (BIOMES, BIOME_COLORS, BIOME_ICONS, BIOME_WEIGHTS, chooseBiome). `genMotsClesCellule(biome, environnement)` accepte désormais l'environnement.
- `db.js` : `addCellule` stocke maintenant `environnement`, `montagne` (boolean), `riviere` (boolean) sur chaque cellule.
- `accueil.js` : `openRevelerModal` utilise `generateCell(cellules)` pour les étapes 1→9. La modale affiche le badge d'environnement + les badges montagne/rivière.
- `carte.js` : imports depuis `generation.js`. Overlays SVG sur la carte : ⛰️ pour les montagnes, 〰️ pour les rivières (positionnés dans le coin supérieur de chaque hexagone). La fiche cellule (modal) affiche l'environnement et les caractéristiques.
- `carte.html` : bouton "ℹ Règles" dans la toolbar qui ouvre la page de documentation en onglet.
- `css/style.css` : nouveaux styles `.cell-env-badge`, `.cell-feature-badge.mountain/river`, `.info-*` (page documentation).

**Nouvelle page `carte-info.html` :**
- Accessible depuis le bouton "ℹ Règles" sur la carte (s'ouvre en onglet, protégé par le même mot de passe).
- Documente exhaustivement les 9 étapes avec toutes les formules, tous les chiffres, toutes les tables de probabilités et la matrice de transition.

**Schéma Firestore — nouveaux champs sur `atelier_cellules` :**

| Champ | Type | Description |
|-------|------|-------------|
| `environnement` | string \| null | Un des 7 environnements (tempéré, steppique, etc.) |
| `montagne` | boolean | Caractéristique montagne superposée au biome |
| `riviere` | boolean | Présence d'un segment de rivière |

### 2026-05-30 (suite 6)
**Atelier — Suppression en cascade depuis le wiki**

- `wiki.js` : `confirmDelete()` supprime maintenant toutes les données liées selon le `source_type` :
  - **Lieux** : supprime la cellule dans `atelier_cellules` + les entrées du journal (`deleteActionsByRefId`)
  - **Oracle** : supprime le document dans `atelier_oracles` + les entrées du journal
  - **Événement** : supprime le document dans `atelier_evenements` + retire l'ID de `evenement_ids` sur la cellule + supprime les entrées du journal
  - **Manuel** : supprime la fiche wiki uniquement
  - La confirmation affiche un message spécifique selon ce qui va être supprimé.
- `db.js` : nouvelles fonctions `deleteOracle`, `deleteEvenement`, `removeEvenementFromCellule`, `deleteActionsByRefId`.
- `accueil.js` : instance Chart.js trackée (`_chartInstance`) pour pouvoir détruire et recréer le graphe sans erreur. La zone de test rafraîchit le graphique après chaque suppression bulk.

### 2026-05-30 (suite 5)
**Atelier — Correctifs bugs fondamentaux (Temporal Dead Zone + Firestore)**

- **Bug TDZ** (`accueil.js`, `wiki.js`) : avec le top-level `await`, les `const` définis APRÈS le bloc init sont dans la Temporal Dead Zone quand les fonctions de rendu les utilisent. `ACTION_ICONS` et `SOURCE_ICONS` déplacés AVANT le premier `await` qui les utilise. C'était la cause de "Erreur de chargement" dans "Dernières actions" et du wiki vide.
- **Firestore orderBy** : `getRecentActions()` et `getTodos()` utilisaient `orderBy()` qui nécessite un index Firestore non créé automatiquement sur une nouvelle collection. Remplacés par `getDocs()` + tri côté client sur `.timestamp?.seconds` et `.ordre`.
- **Cache navigateur** : tous les imports dans `wiki.js` et `accueil.js` sont versionnés (`?v=2`) pour forcer le rechargement des modules transversaux (`db.js`, `utils.js`, etc.) quand le navigateur les a en cache depuis une ancienne version.
- `_headers` : fichier ajouté à la racine avec `Cache-Control: no-cache` pour les JS de l'atelier — force la revalidation ETag à chaque déploiement.
- **Graphique adaptatif** : la plage X du chart va du premier jour d'activité à aujourd'hui (minimum 7 jours) au lieu d'une fenêtre fixe de 30 jours.

### 2026-05-30 (suite 4)
**Atelier — Suppression wiki cascade cellule + fix cache**

- `wiki.js` : supprimer une fiche "Lieux" supprime aussi la cellule correspondante dans `atelier_cellules` (via `cellule_id`). Ajout de `deleteCellule` dans db.js.

### 2026-05-30 (suite 3)
**Atelier — Corrections boutons + zone de test + indicateur journalier**

- `accueil.js` : **bug fix critique** — les event listeners des boutons d'action sont maintenant enregistrés **avant** le `Promise.all` Firebase (si le chargement des données échouait, les boutons n'étaient jamais connectés). Chaque modal opener est protégé par `.catch()`. Le `Promise.all` est enveloppé dans un `try/catch` pour ne jamais bloquer l'interface.
- **Compteur journalier via `localStorage`** (abandon de l'approche Firebase) : synchrone, s'affiche instantanément sans réseau. Clé `at_daily_YYYY-MM-DD` auto-reset quotidien.
- **Bouton "+1"** sur l'indicateur de progression : decremente le compteur localStorage pour ajouter une action disponible (pratique en phase de test).
- **Zone de test** en bas du tableau de bord : 5 boutons de suppression (Cellules / Oracles / Événements / Wiki / Journal d'actions) + bouton "Réinitialiser la limite du jour". Chaque suppression a une confirmation. À retirer une fois le paramétrage terminé.
- `db.js` : ajout de `deleteAllCellules`, `deleteAllWiki`, `deleteAllOracles`, `deleteAllEvenements`, `deleteAllActions` (via fonction interne `deleteCollection(name)`).

### 2026-05-30 (suite 2)
**Atelier : 3 actions/jour avec indicateur de progression**

- `accueil.js` + `index.html` + `css/style.css` : 3 actions quotidiennes à répartir librement. Indicateur visuel 3 dots + label. Boutons verrouillés après la 3e action. Reset automatique chaque nouveau jour.

### 2026-05-30 (suite)
**Nouvelle section Atelier — World-building solo procédural**

**Architecture globale :**
- `atelier/` : nouvelle section protégée par mot de passe (`Odandor`, SHA-256, clé `"at_auth"`)
- Accessible depuis la page d'accueil du site (carte ambre doré `#c49a3a`)
- 3 pages : Tableau de bord (`index.html`), Carte (`carte.html`), Wiki (`wiki.html`)
- Instance Firebase nommée `"atelier"` pour éviter les conflits

**Tableau de bord (`accueil.js`) :**
- 4 KPIs : cellules découvertes, entrées wiki, oracles tirés, événements générés
- 3 boutons d'action du jour avec modaux inline : Révéler une cellule / Tirer un oracle / Générer un événement
- Graphique d'activité Chart.js (bar, 30 derniers jours)
- Liste TODO Firestore (sémaphone, cochable, supprimable, extensible) — 12 tâches initiales pré-remplies
- Journal des 3 dernières actions

**Carte hexagonale (`carte.js`) :**
- Hexagones flat-top, coordonnées cube (q, r), taille = 48px
- Rendu SVG avec pan (drag) + zoom (molette + pinch mobile)
- Cellules découvertes colorées par biome + emoji + titre court
- Cellules adjacentes non découvertes affichées en pointillés
- Clic cellule → modal fiche (biome, coords, mots clés, description, événements liés)
- Boutons zoom +/-/reset en toolbar

**Algorithme de biomes (`mots-cles.js`) :**
- 25 biomes avec couleurs et emojis dédiés
- `BIOME_WEIGHTS` : dictionnaire de poids par biome → biome
- Calcul : moyenne des poids des voisins découverts → tirage pondéré
- Contrainte civile : biomes civils (village, ville, forteresse, temple, mine) réduits si pas de voisin naturel

**Base de mots clés (`mots-cles.js`) :**
- 6 pools généraux : sensations (40), couleurs (40), faune (35), civilisation (35), émotions (30), dynamiques (30)
- 8 pools oracles × ~30 mots chacun
- 6 pools événements × ~20 mots chacun
- Génération cellule : 1 sensation + 1 couleur + 1 faune/civilisation

**Oracle :** 8 types, 4 mots clés tirés, relance possible, fiche wiki créée automatiquement
**Événements :** 6 types, cellule tirée aléatoirement, fiche wiki + lien cellule créés automatiquement
**Wiki :** 9 catégories, recherche, onglets, édition/suppression inline, ajout manuel

**Collections Firestore ajoutées :**
`atelier_cellules` · `atelier_wiki` · `atelier_oracles` · `atelier_evenements` · `atelier_actions` · `atelier_todo`

**Navigation (page d'accueil) :**
| Page | URL |
|------|-----|
| Atelier — Tableau de bord | `/atelier/` |
| Atelier — La Carte | `/atelier/carte.html` |
| Atelier — Le Wiki | `/atelier/wiki.html` |

---

### 2026-05-30
**Nouvelle section personnelle + notes réunions hors présence**

**Section personnelle (`/perso/`) :**
- `index.html` : ajout d'un bouton bonhomme discret (SVG, 36px, `position:fixed` bas-droite), entièrement opaque et sans texte. Lien vers `/perso/`.
- `perso/firebase-config.js` : même projet Firebase `mon-site-e253f`, instance nommée `"perso"` pour éviter les conflits.
- `perso/js/auth.js` : mot de passe `Fantominus` (SHA-256), clé `sessionStorage` `"perso_auth"`. Porte de connexion avec fond teal.
- `perso/js/nav.js` : sidebar identique au club de lecture — logo, liens de navigation, bouton "Accueil du site", bascule thème (clé `localStorage` `"perso_theme"`).
- `perso/css/style.css` : thème teal (`--accent: #14b8a6`). Mode sombre par défaut, mode clair via `[data-theme="light"]`. Composants complets : sidebar, boutons, cards, formulaires, modals, table, KPIs, onglets toggle, toast.
- `perso/index.html` + `perso/js/accueil.js` : page d'accueil avec 2 KPIs (total migraines, ce mois) et la dernière migraine enregistrée.
- `perso/migraines.html` + `perso/js/migraines.js` : page **Migraines ophtalmiques** complète :
  - 4 KPIs : total, cette année, ce mois, jours depuis la dernière.
  - Graphique Chart.js (bar) avec toggle **Jours / Mois / Années**. Échelle linéaire : toutes les périodes entre la première et la dernière migraine sont affichées (les périodes vides apparaissent à 0).
  - Tableau historique trié par date décroissante (date, commentaire, boutons ✏️ et 🗑️ avec confirmation).
  - Modal d'ajout/modification : date (obligatoire, défaut = aujourd'hui) + commentaire optionnel.
- `perso/js/db.js` : CRUD Firestore sur la collection `perso_migraines` (`getMigraines`, `addMigraine`, `updateMigraine`, `deleteMigraine`).
- `perso/js/utils.js` : `formatDate`, `formatDateShort`, `showToast`.

**Club de lecture — notes de lecture hors réunion :**
- `club-lecture/js/reunions.js` : la fiche détail d'une réunion distingue maintenant trois zones :
  1. Participants présents → note (inchangé).
  2. Membres absents ayant déjà une note → affichés avec badge "absent" + input note modifiable.
  3. Dropdown "Ajouter un membre ayant lu hors réunion" → ajoute le membre dans `notes_finales` avec note 0, puis l'utilisateur saisit la note et enregistre.
- `club-lecture/js/membres.js` : la section "Réunions" dans le profil d'un membre inclut désormais les réunions où le membre a une note dans `notes_finales` même s'il n'était pas présent (`participant_ids`). Badge "absent" affiché dans ce cas.

**Impacts automatiques (aucun changement de code nécessaire) :**
- Note finale du livre : `computeNoteFinale()` calcule déjà la moyenne de tout `notes_finales` → inclut automatiquement les absents.
- Palmarès accueil : basé sur la note finale → mis à jour.
- Bibliothèque (tri note finale) → mis à jour.
- Statistiques — lectures cumulées et pages cumulées : `membersWhoFinishedBook()` utilise déjà `notes_finales` → les absents notés comptent comme ayant terminé le livre.
- Statistiques — note moyenne globale : utilise toutes les `notes_finales` → inclut les absents.
- Statistiques — membres actifs : le score "livres lus" augmente pour les membres ayant noté hors réunion.

**Collection Firestore ajoutée :**
```
perso_migraines
  date         Timestamp   Date de la migraine
  commentaire  string      Commentaire libre (optionnel)
  cree_le      Timestamp   Timestamp création
```

**Navigation :**
| Page | URL |
|------|-----|
| Perso — Accueil | `/perso/` |
| Perso — Migraines ophtalmiques | `/perso/migraines.html` |



### 2026-05-29
**Votes — lancement automatique + page vote publique**
- `club-lecture/votes.html` : suppression du bouton "Lancer un vote" et de tous ses modals (lancer, confirmer, soumettre). Remplacement par un encart `#vote-status-card` au-dessus de l'historique.
- `club-lecture/js/votes.js` : suppression de toute la logique de lancement manuel. Ajout de `autoLancerSiNecessaire()` (déclenche le vote le 1er du mois si aucun vote actif, expiration à 23h59 fixe) et `renderStatusCard()` (affiche countdown + lien vers `vote.html` ou compte à rebours du prochain vote). Boutons Clôturer / Annuler conservés pour l'admin.
- `club-lecture/vote.html` : **nouvelle page publique sans mot de passe**, partageable directement aux membres. Header minimal avec lien retour vers `votes.html`. Pas de sidebar.
- `club-lecture/js/vote.js` : logique de la page publique — 3 états : (1) pas de vote : liste livres + aperçu grisé ; (2) vote en cours, non identifié : sélection du nom + confirmation + gestion doublon ; (3) vote en cours, identifié : tableau radio 1–5 par livre + soumission. Toggle infos livres non persisté (toujours OFF à l'ouverture). Tooltip au survol des titres dans le tableau (visible si toggle ON). Auto-close si le vote expire pendant la navigation.
- `club-lecture/css/style.css` : nouveaux styles `.vsc-*` (encart votes.html) et `.vote-*` / `.vt-*` (page vote.html).

**Décisions de conception :**
- Le vote se lance automatiquement côté client : le premier visiteur de `vote.html` ou `votes.html` le 1er du mois crée le vote dans Firestore (tous les livres `en_proposition`, tous les membres, expiration 23h59 fixe — pas un timer relatif de 24h).
- La page `vote.html` ne demande pas de mot de passe — accessible directement par lien partagé. L'identification se fait par sélection du nom dans une liste.

### 2026-05-29 (suite 2)
**Votes — compte à rebours live avant le prochain vote**
- `club-lecture/js/votes.js` + `club-lecture/js/vote.js` : remplacement du texte statique "Dans X jours" par un compte à rebours dynamique `Jj HHh MMmin SSs` mis à jour chaque seconde. Les jours sont masqués quand ils tombent à 0. Affiche "C'est aujourd'hui !" le 1er du mois avant l'ouverture automatique. L'intervalle est nettoyé si la carte se re-render.

### 2026-05-29 (suite)
**Vote public — corrections UI**
- `club-lecture/vote.html` + `club-lecture/js/vote.js` : ajout d'un bouton bascule thème clair/sombre en haut à gauche du header (style pill arrondi). Partage la clé `localStorage` `cl_theme` avec le reste du club.
- `club-lecture/css/style.css` : correction de l'aperçu grisé — remplacement de l'overlay `::after` coloré (illisible en mode clair) par une simple `opacity:0.4` sur le wrapper.

### 2026-05-27 (suite 3)
**Votes — champ date pour la frise chronologique**
- `club-lecture/js/db.js` : `addVote()` accepte maintenant un paramètre `date` — stocké en Timestamp si fourni, sinon `serverTimestamp()` (= date de clôture automatique). `updateVote()` convertit les strings `date` en Timestamp (même pattern que `updateReunion`).
- `club-lecture/votes.html` : champ "Date du vote" (`#e-date`) ajouté dans la modale d'édition. Bouton renommé "✏️ Modifier".
- `club-lecture/js/votes.js` : le handler `detail-edit` pré-remplit `e-date` depuis `vote.date`. Le handler `edit-save` envoie la date dans `updateVote`.
- `club-lecture/js/accueil.js` : `buildEvents` utilise `v.date` en priorité pour positionner les votes dans la frise ; fallback = 15 du mois si le champ est absent (votes anciens).

### 2026-05-27 (suite 2)
**Accueil — Frise chronologique : réunions**
- `club-lecture/js/accueil.js` : les réunions sont maintenant affichées dans la frise. Passées (`statut === "passee"`) : icône 📝, point bleu (`#5b9cf6`), bordure bleue pleine, sous-titre = mois + nb de participants. À venir (`statut === "prevue"`) : icône 📅, point gris, bordure bleue en pointillés + opacité 80%, sous-titre = "À venir". Date utilisée : `reunion.date` si renseignée, sinon le 15 du mois. Clic → `reunions.html?open=ID`.
- `club-lecture/css/style.css` : ajout de `--frise-reunion-border` et `--frise-reunion-prevue-border` dans les thèmes sombre et clair.

### 2026-05-27 (suite)
**Club de lecture — Bibliothèque : infos IA, toggle, spoiler fiche + tri pages**
- `club-lecture/js/bibliotheque.js` : ajout de `BADGE_PALETTE` (6 couleurs) et `descBadge()` — badge coloré (hash de la description) affiché sur les cards proposition, éliminé et élu. Filtre genre dans `filteredLivres()`, recherche étendue à `genre` et `description_3_mots`. Tri `nb_pages` dans la vue tableau. Nombre de pages, genre et badge visibles sur les cards Élus (IIFE inline). Filtre genre peuplé dynamiquement depuis les livres (`populateGenreFilter()`). Dans `openFiche` : champs Pages/Genre/En 3 mots déplacés dans un bloc spoiler collapsible (`.fiche-ai-spoiler`) — caché par défaut, révélé au clic avec flèche ▶/▼.
- `club-lecture/bibliotheque.html` : champs `p-genre` et `p-desc3` dans le modal "Proposer un livre" (groupe "Infos IA" avec avertissement). Colonne Genre et colonne Pages dans la vue tableau (thead). Bouton toggle `#ai-infos-toggle` dans `.ai-toggle-bar` en haut de la vue visuelle.
- `club-lecture/css/style.css` : `.prop-card-genre`, `.prop-card-pages`, `.bib-elu-genre`, `.desc-badge` cachés par défaut — visibles avec `.ai-infos-visible` sur `body`. Styles du toggle (`.ai-toggle-bar`, `.toggle-switch`, `.toggle-slider`). Styles du spoiler fiche (`.fiche-ai-spoiler`, `.fiche-ai-trigger`, `.fiche-ai-arrow`, `.fiche-ai-body`, `.fiche-ai-disclaimer`).

**Club de lecture — Stats : graphique lecteurs par mois**
- `club-lecture/js/stats.js` : correction du graphique d'évolution — Y-axis = nb de membres ayant terminé le livre ce mois, pas nb de livres lus (toujours 1). Utilise `membersWhoFinishedBook()`.
- `club-lecture/stats.html` : titre du graphique mis à jour ("Lecteurs ayant terminé le livre, par mois").

**Jeux — Jeu de Mots : parties partageables**
- `Jeux/jeu-de-mots.html` : réécriture complète. Nouveau flux : saisie nb joueurs → noms → difficulté → création d'une partie Firebase (`jeu_mots_parties`) → redirection vers `?partie=ID`. Vue partie : tous les mots floutés par défaut, clic pour révéler (`.revealed`). Chaque joueur voit son mot depuis son propre appareil. Historique partagé : mots floutés, clic pour révéler, lien "Ouvrir →". Import `getDoc` + `doc` pour charger une partie par ID.

**Décisions de conception ajoutées :**
- Toggle AI infos persisté en `localStorage` (clé `cl_bib_ai_infos`), OFF par défaut.
- AI infos (pages, genre, description) masquées dans la fiche livre derrière un spoiler cliquable — indépendant du toggle de la vue bibliothèque.

### 2026-06-09
**Refonte club de lecture — Statistiques + correctifs Réunions**

Pages `lis-tes-ratures/` (nouvelle DA café-bibliothèque) :

**Réunions — correctifs :**
- `lis-tes-ratures/js/reunions.js` : `renderMeeting()` utilisait une comparaison de string directe (`!== "passée"`) au lieu de `isPasse()` → le sceau de l'overlay affichait toujours "à venir". Corrigé : `const prevue = !isPasse(r)`.
- `lis-tes-ratures/reunions.html` : taille du texte des sceaux réduite pour tenir dans les cercles — `.reg-seal-note` `1.4rem → 1.15rem`, `.mtg-seal-note` `1.32rem → 1.1rem`.

**Statistiques — page complète avec tous les graphiques :**
- `lis-tes-ratures/statistiques.html` : page avec 3 chapitres et 14 planches, structure HTML complète.
- `lis-tes-ratures/js/statistiques.js` : module ES6 — chargement parallèle de `membres`, `livres`, `votes`, `reunions`, `statuts_lecture`, `commentaires`. 14 panels rendus :
  - **KPI gravé** (Archétype 1) : livres lus cumulés, pages lues cumulées (avec `membersWhoFinishedBook()` robuste — statut `"termine"` sans accent + retrocompat `lecteurs_ids`/`notes_finales > 0`), note moyenne /10, propositions en attente.
  - **Histogramme /10** (Archétype 2) avec sélecteur membre : distribution des `notes_finales` de réunion.
  - **Histogramme /5** (Archétype 2) avec sélecteur membre : distribution des notes de vote d'élection.
  - **Participation aux votes** (Archétype 2) : barres horizontales par membre (N/total + %).
  - **Colonnes lecteurs** (Archétype 3) : `membersWhoFinishedBook()` par séance passée.
  - **Courbe à la plume** (Archétype 4) : évolution des notes /10 par membre, trous = absent.
  - **Table-registre membres actifs** (Archétype 6) : livres finis, réunions, propositions, votes, commentaires.
  - **Bilan par membre proposant** (Archétype 6) : total / élus / éliminés / en attente / note vote reçue /5 / note finale reçue /10.
  - **Heatmap des goûts** (Archétype 5) : matrice votant × proposant, moyennes des notes /5.
  - **Scatter corrélation vote → réunion** (SVG inline DA-style) : note élection /5 vs note finale /10, droite de tendance.
  - **Similarité votants Pearson** (Archétype 5) : heatmap `heatColor(r, -1, 1, 0)`, min. 3 livres communs par paire.
  - **Controversé / Consensuel** (Archétype 7) : écart-type des notes /5, fond coloré par valeur.
  - **Durée de vie** (Archétype 2 + badge) : sessions traversées par livre, badge élu/éliminé/en attente.
  - **Colonnes empilées propositions** (Archétype 3) : par mois de `date_proposition`, une couleur par membre.
- API SX utilisée correctement : `lineChart(hostEl, { series:[{name,color,values}], xLabels, yMax, yStep })` ; `legend([{name,color}])` ; `memberColor(nom)` (prend le nom, pas l'id Firebase).
- `isPasse()` robuste : notes_finales non vides OU statut contient "pass"/"termin" OU date dans le passé.

### 2026-06-09 (suite 2)
**Refonte club de lecture — Corrections UI statistiques + frise accueil**

**Statistiques — 4 corrections UI :**
- `lis-tes-ratures/statistiques.html` : KPI 4 renommé de "En attente" → "Lectures cumulées" (Σ membres ayant terminé × livre). Thead `tbl-actifs` : `colspan` corrigé à 7, colonne Score ajoutée avec `<span class="sx-info-tip">ⓘ</span>` tooltip formule.
- `lis-tes-ratures/js/statistiques.js` :
  - `renderKPIs()` : calcul des "Lectures cumulées" via `membersWhoFinishedBook()` — `lecturesCum += finishers.size` sur chaque livre élu passé.
  - `renderPlotNotes()` : légende interactive — clic sur un item toggle la classe `.dim` et met `opacity:0.1` sur le groupe SVG `<g data-sid>` correspondant. Génération SVG inline avec `<g class="sx-series-group" data-sid>` par série pour permettre le ciblage DOM.
  - `renderTblActifs()` : suppression des `style="text-align:center"` inline sur les `<td>` (alignement CSS uniquement via `stats.css`). Ajout colonne Score en 7e avec `style="font-weight:700;color:var(--accent)"`.
  - `renderBilanProps()` : helper `ratio(v)` → `"N/total (P %)"` avec le pourcentage en muted. Suppression des `style="text-align:center"` inline pour aligner les colonnes.

**Accueil — frise chronologique :**
- `lis-tes-ratures/js/accueil.js` : `buildFriseEvents()` — filtre des propositions corrigé de `l.statut === 'en_proposition'` → `l.date_proposition`. Tous les livres ayant une date de proposition (élus, éliminés, en attente) apparaissent désormais comme événements "Proposition" dans les vues Fil cousu et Carnet.

### 2026-06-09 (suite 4)
**Refonte club de lecture — 10 corrections + mise en ligne officielle**

`lis-tes-ratures/` :

**10 corrections UI/UX :**
- `nav.js` : suppression du bouton mode sombre et de son listener — thème forcé à `"light"` en permanence (Tom ne veut pas de mode sombre dans le club de lecture)
- `vote.js` : checkboxes "déjà lu, je passe" — attribut `disabled` ajouté quand `preview=true` (avant ouverture du vote, elles étaient cliquables à tort)
- `bibliotheque.js` : 
  - Nouveau helper `unitAbbr(u)` — mappe `progression_unite` vers l'abréviation : `"chapitres"` → `"ch."`, `"parties"` → `"par."`, défaut `"p."`
  - Section "Avancements membres" : affiche "Terminé" si le membre a une note dans `reunions.notes_finales` (même sans statut `"termine"` dans `statuts_lecture`)
  - Label "En cours" : utilise `unitAbbr()` au lieu du `p` codé en dur
- `membres.js` :
  - Paramètre `?open=MEMBRE_ID` : auto-ouvre le profil au chargement (utilisé par la frise "Notre parcours")
  - `IC.chat` : `width="1em" height="1em" style="vertical-align:middle"` — l'icône bulle dans "Voir tous les commentaires →" était à taille pleine SVG
  - Label d'avancement dans les commentaires : utilise `livreById[livreId]?.progression_unite` au lieu du préfixe `p.` codé en dur
- `votes.js` : paramètre `?open=VOTE_ID` — auto-ouvre le détail du scrutin au chargement
- `reunions.js` :
  - Paramètre `?open=REUNION_ID` — auto-ouvre la fiche réunion au chargement
  - `IC.arrowR` : `width="0.75em" height="0.75em"` dans la définition — les flèches de "Voir la fiche du livre" et "Revoir la séance en vidéo" étaient trop grandes
  - Checklist membres (formulaire ajout réunion) : labels passés en `inline-flex` horizontal (checkbox + dot + nom sur une ligne), conteneur `.pf-checklist` en `flex-wrap`. Plus de stacking vertical.
- `accueil.js` :
  - Frise "Élu" : `navId: v.id, navPage: 'votes'` au lieu de `navId: v.livre_elu, navPage: 'bibliotheque'` — le clic sur un événement "Élu" ouvre désormais le vote correspondant, pas la fiche du livre
  - Section "Livre du mois" : bouton "Ajouter au suivi" (select + bouton) pour les membres sans entrée dans `statuts_lecture`. Appelle `upsertStatutLecture` avec `statut: 'pas_commence'`.
- `statistiques.js` : tooltip histogramme "Évolution des propositions" — `background:var(--surface,#fdf6ea)` + `color:var(--ink,#2c1a0e)` au lieu du fond sombre `var(--card,#1c1916)` qui rendait le texte invisible en thème clair

**Mise en ligne officielle :**
- `index.html` : la carte "Club de lecture" pointe désormais vers `/lis-tes-ratures/` (terracotta `#b5572d`). L'ancienne carte `/club-lecture/` et la carte "bêta" ont été fusionnées en une seule entrée propre, sans badge "En construction".
- `_redirects` (nouveau fichier) : `/club-lecture/stats.html` → `/lis-tes-ratures/statistiques.html` (301, règle spécifique en premier car le nom a changé) ; `/club-lecture/*` → `/lis-tes-ratures/:splat` (301, toutes les autres pages) ; `/club-lecture` → `/lis-tes-ratures/` (301).
- `_headers` : ajout des règles `Cache-Control: no-cache` pour `/lis-tes-ratures/js/*` et `/lis-tes-ratures/*.html` (même pattern que l'atelier — évite les versions cachées en navigateur).

### 2026-06-09 (suite 3)
**Refonte club de lecture — Corrections UI statistiques (suite) + page commentaires**

`lis-tes-ratures/` (nouvelle DA café-bibliothèque) :

**Statistiques — 4 corrections UI (suite) :**
- `lis-tes-ratures/statistiques.html` + `lis-tes-ratures/js/statistiques.js` :
  - **Colonne Score** : `<td class="sx-score-col">` (opacity:0 par défaut) révélée uniquement au survol du `<th class="sx-score-th">` via `mouseenter`/`mouseleave` JS. Formule ajoutée en pied de tableau (`.sx-formula-note`).
  - **Controversé / Consensuel** : réécriture complète — UN seul livre par panel (plus haut / plus bas écart-type). Affiche `.sx-book-h` titre, `.sx-book-a` auteur, `.sx-stat-line` moy + écart-type, `.sx-chips` (chips individuelles `chipColor(v)` pour chaque note).
  - **Durée de vie** : inclut maintenant les livres `refuse` même sans session de vote (`isTermine(st)` couvre `"elu"`, `"elimine"`, `"refuse"`). Badge `.sx-badge-elim` unifié pour `refuse` et `elimine`.
  - **Évolution des propositions** : tooltip au survol de chaque colonne de l'histogramme — décompte par membre pour ce mois, positionné via `getBoundingClientRect()`.

**Nouvelle page commentaires de lecture :**
- `lis-tes-ratures/commentaires.html` : page dédiée aux commentaires pour un livre donné (`?livre=LIVRE_ID`, `?new=1` pour ouvrir le formulaire direct).
  - En-tête : miniature de couverture gradient (hash `bookTint()`), titre, lien retour bibliothèque, bouton "Laisser un commentaire"
  - Barre de suivi : label unité/total + bouton "⚙️ Configurer le suivi" → modal radio pages/chapitres + input total (met à jour `progression_unite`/`progression_total` Firestore)
  - Filtre par membre (dropdown peuplé dynamiquement depuis les commentaires existants)
  - Fil de lecture (`.reading`) avec pointillés façon fil cousu via `repeating-linear-gradient`
  - Chaque commentaire (`.com`) : anneau de progression CSS conic-gradient avec initiales (`--mc` couleur membre, `--p` % avancement) + carte accordéon (header : nom, titre optionnel, barre de progression, date ; corps : texte paragraphes + bouton Modifier)
  - **Pas de système spoiler** (volontaire — tous les commentaires en contiennent) : pas de chip spoiler, pas de bannière, pas de blur
  - Modales "papier" (`.paper`) pour ajout, modification, configuration du suivi
- `lis-tes-ratures/js/commentaires.js` : module ES6 — `requireAuth`, `initNav("bibliotheque")`, chargement parallèle livre + membres + commentaires, `renderHeader`, `renderFilter`, `renderList`, `openAdd/closeAdd/submitAdd`, `openEdit/closeEdit`, `openCfg/closeCfg/submitCfg`. Toutes les données via `db.js` existant.

**Liens commentaires dans la page membres :**
- `lis-tes-ratures/js/membres.js` : dans chaque groupe de livre de la section "Commentaires de lecture", lien "Voir tous les commentaires →" ajouté en bas de l'accordéon ouvert → `commentaires.html?livre=LIVRE_ID`.

### 2026-05-27
**Nouvelle section Jeux + Club de lecture Stats + nb_pages**
- `index.html` : ajout de la 3e carte "Jeux" (accent indigo `#667eea`, badge "✨ Accès libre"). Grille passée de `repeat(2, 1fr)` à `repeat(auto-fill, minmax(250px, 1fr))` avec `max-width: 860px`.
- `Jeux/firebase-config.js` : nouveau fichier, même projet Firebase `mon-site-e253f`.
- `Jeux/css/style.css` : nouveau fichier, thème indigo, header simple, cartes jeux.
- `Jeux/index.html` : page d'accueil Jeux, une carte "Jeu de Mots".
- `Jeux/jeu-de-mots.html` : jeu multijoueur adapté — saisie des noms de joueurs avant la partie, sauvegarde automatique dans Firestore (`jeu_mots_parties`) avec noms + mots, historique partagé chargé depuis Firebase.
- `club-lecture/js/db.js` : ajout `nb_pages` dans `addLivre()` et `updateLivreInfos()`. Nouvelles fonctions `getAllStatutsLecture()` et `getAllCommentaires()` pour la page stats.
- `club-lecture/js/nav.js` : ajout du lien "📊 Statistiques" dans la sidebar.
- `club-lecture/bibliotheque.html` : champ "Nb de pages" (optionnel) dans le modal de proposition et dans le formulaire d'édition.
- `club-lecture/js/bibliotheque.js` : lecture/écriture de `nb_pages` dans toutes les formes (proposition, édition, fiche détail).
- `club-lecture/stats.html` : nouvelle page Statistiques (KPIs, note moyenne, participation, membres actifs, évolution).
- `club-lecture/js/stats.js` : logique complète — `computeStats()` charge tout en parallèle, `renderKpis()`, `renderNoteMoyenne()`, `renderParticipation()`, `renderMembresActifs()`, `renderEvolution()` (Chart.js lazy).
- `club-lecture/css/style.css` : ajout des classes `.stats-kpi-grid`, `.stats-row-2`, `.stats-note-*`, `.stats-membres-*`.

**Club de lecture — Graphique d'évolution des lectures**
- `club-lecture/js/db.js` : nouvelles fonctions `addProgressionPoint()` et `getProgressionForLivre()`. Nouvelle collection Firestore `progression_lecture` — stocke un point horodaté à chaque mise à jour d'avancement (ne remplace pas `statuts_lecture`, s'ajoute en parallèle).
- `club-lecture/js/accueil.js` : bouton "📈 Graphique" en bas de la carte Lecture du mois (toggle show/hide). Graphique Chart.js lignes par membre, X = date, Y = % (si total configuré) ou valeur absolue. Chargement lazy de Chart.js + `chartjs-adapter-date-fns`. Enregistrement automatique d'un point dans `progression_lecture` à chaque sauvegarde de statut (si avancement > 0 ou "Terminé").

### 2026-05-25
**JDR — Roue Personnalisable**
- `jdr/Outils/roue-personnalisable_1.html` : nouvel outil. Roue interactive identique à la Roue du Paradoxe, avec un onglet ✏️ Personnaliser permettant de gérer les segments à la main (ajout, édition, suppression, réordonnancement), modifier le titre/sous-titre/campagne/bouton, et réinitialiser. Données stockées en `localStorage`.
- `jdr/outils.html` : ajout de la carte "🎡 Roue Personnalisable" (4e outil).

### 2026-05-23
**JDR — Vue Chronologie améliorée + Onglet Recette Magique**
- `jdr/js/chrono.js` : réécriture complète. Densité de séances (`N séances · X/mois`) affichée sur les barres de campagne si hauteur ≥ 50 px. Layout deux colonnes (frise + panneau de graphiques sticky). Ajout de `computeSessionsBuckets`, `computeSatPoints`, `linearRegression`, `buildSessionsChart`, `buildSatChart`.
- `jdr/js/recette.js` : nouveau fichier. Onglet "✨ Recette Magique" — analyse de corrélation Pearson + point-bisériale entre satisfaction et tous les champs du projet. Affiche top facteurs positifs/négatifs + tableau complet + explication méthodologique.
- `jdr/css/style.css` : ajout des classes `.chrono-layout`, `.chrono-left`, `.chrono-right`, `.chrono-chart-panel`, `.chrono-chart-header`, `.chrono-chart-title`, `.chrono-chart-canvas`, `.chrono-trend-ind`, `.ch-v-bar-stats`, et toutes les classes `.recette-*`.
- `jdr/archives.html` : bouton "✨ Recette magique", div `#view-recette`, import `recette.js`.
- `jdr/js/archives.js` : `ALL_VIEWS` étendu à `'recette'`, listener `btn-view-recette`, `render()` et `switchView()` mis à jour.

**JDR — Corrections graphique séances dans le temps**
- `jdr/js/chrono.js` : distribution des campagnes snappée au mois entier (1er→dernier jour) au lieu de fractions jour-précises depuis la date exacte de début.
- `jdr/js/chrono.js` : remplissage des mois vides avec 0 pour une frise temporelle continue (évite que les mois sans séances soient absents de l'axe X).
- `jdr/js/chrono.js` : labels de l'axe X en année complète (`oct. 2022` au lieu de `oct. 22`) pour éviter la confusion avec un numéro de jour.
