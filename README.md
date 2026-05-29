# Mon Site — Documentation Claude Code

> Ce fichier est le point d'entrée pour toute nouvelle session Claude Code. Il contient tout le contexte nécessaire pour reprendre le travail sans aucune explication de l'utilisateur.

---

## ⚠️ Notes importantes pour Claude Code

> **Ne jamais push sans confirmation explicite de Tom.**
> Netlify a atteint sa limite mensuelle de déploiements en une seule journée. Le site est désormais hébergé sur **Cloudflare Pages** (fonctionnel, même repo GitHub). Pour économiser les déploiements : regrouper les modifications en packs avant de push, et **toujours attendre le feu vert de Tom** avant tout `git push`.

> **Mettre à jour ce README à chaque modification significative.** À la fin de chaque session de développement, Claude doit documenter les changements effectués dans la section "Historique des modifications" ci-dessous. C'est une consigne permanente à appliquer sans que Tom ait besoin de le rappeler.

---

## Contexte général

Site **personnel et privé** de Tom. Multi-sections indépendantes. La page d'accueil (`/`) présente le site et ses différentes sections avec des cartes visuelles. Chaque section n'est accessible qu'avec un mot de passe.

**Sections existantes :**
- `/club-lecture/` — Fonctionnel et en développement actif
- `/jdr/` — Page d'accueil active, protégée par mot de passe, en cours de développement
- `/Jeux/` — Section jeux en ligne, **accès libre** (pas de mot de passe)
- `/recettes/` — Supprimée de l'accueil public (dossier conservé mais non lié)

---

## Stack technique

| Élément | Choix |
|---------|-------|
| Langages | HTML / CSS / JS vanilla uniquement |
| Framework | Aucun — pas de React, Vue, bundler, ni npm |
| Base de données | Firebase Firestore v10.12.2 via CDN (ES modules natifs) |
| Hébergement | Cloudflare Pages — déploiement automatique à chaque push sur `main` |
| Repo GitHub | `https://github.com/Nardoll/mon-site` (branche `main`) |

**Contrainte importante :** ES modules natifs dans le navigateur. Ça fonctionne en HTTPS (Cloudflare Pages) ou via l'extension Live Server de VS Code. Pas de `file://`.

**Workflow :**
1. Modifier les fichiers dans VS Code
2. `git add` + `git commit` + `git push` → Cloudflare Pages déploie en ~30 secondes

---

## Structure des fichiers

```
Mon Site/
├── index.html                   Page d'accueil publique (hero + 3 cartes sections actives)
├── netlify.toml                 Config redirections (héritage — Cloudflare Pages utilisé)
├── README.md                    Ce fichier
│
├── club-lecture/
│   ├── index.html               Page Accueil du club
│   ├── bibliotheque.html        Page Bibliothèque
│   ├── votes.html               Page Votes
│   ├── membres.html             Page Membres
│   ├── commentaires.html        Page Commentaires de lecture (par livre)
│   ├── reunions.html            Page Réunions
│   ├── stats.html               Page Statistiques du club
│   ├── firebase-config.js       Initialisation Firebase + export `db`
│   ├── css/
│   │   └── style.css            Tous les styles (dark theme, sidebar, composants)
│   └── js/
│       ├── auth.js              Vérification mot de passe (SHA-256, sessionStorage)
│       ├── nav.js               Injection sidebar + gestion page active
│       ├── db.js                Toutes les fonctions Firestore (lecture + écriture)
│       ├── utils.js             Helpers partagés (formatDate, initiales, showToast…)
│       ├── accueil.js           Logique page Accueil
│       ├── bibliotheque.js      Logique page Bibliothèque
│       ├── votes.js             Logique page Votes
│       ├── membres.js           Logique page Membres
│       ├── commentaires.js      Logique page Commentaires de lecture
│       ├── reunions.js          Logique page Réunions
│       └── stats.js             Logique page Statistiques
│
├── jdr/
│   ├── index.html               Page d'accueil JDR (bienvenue + liens Archives/Outils)
│   ├── archives.html            Base de données des projets JDR (filtres, tri, 4 vues : cartes/tableau/stats/chrono)
│   ├── outils.html              Liste des outils MJ (3 outils intégrés)
│   ├── firebase-config.js       Initialisation Firebase + export `db` (même projet mon-site-e253f)
│   ├── css/
│   │   └── style.css            Tous les styles JDR (palette vert/rouge, sidebar, Archives, multi-select…)
│   ├── js/
│   │   ├── auth.js              Auth JDR (SHA-256, sessionStorage, SESSION_KEY "jdr_auth")
│   │   ├── nav.js               Injection sidebar JDR + thème (localStorage "jdr_theme")
│   │   ├── archives.js          Logique page Archives (Firestore, multi-select, formulaire, détail, 4 vues)
│   │   ├── stats.js             Vue Statistiques — Chart.js, KPIs, toggle charts, hauteurs dynamiques
│   │   └── chrono.js            Vue Chronologie — frise verticale Gantt, lanes auto, noms sur barres
│   └── Outils/
│       ├── generateur-pnj-makryon_1.html     Générateur PNJ — Les Enfants de Makryon
│       ├── tribunal-dragons-outils_1.html    Outils MJ — Le Tribunal des Dragons (3 onglets)
│       └── paradoxe_temporel_4.html          Roue du Paradoxe — Chroniques d'Aria
├── Jeux/
│   ├── index.html               Page d'accueil de la section Jeux (liste des jeux)
│   ├── jeu-de-mots.html         Jeu de mots multijoueur (avec noms de joueurs + historique partagé)
│   ├── firebase-config.js       Initialisation Firebase + export `db` (même projet mon-site-e253f)
│   ├── css/
│   │   └── style.css            Styles Jeux (thème indigo #667eea, header simple, cartes jeux)
│   └── jeu_mots_multi_1.html    Version originale locale (conservée, non liée)
│
└── recettes/
    └── index.html               Placeholder non lié (retiré de l'accueil public)
```

---

## Page d'accueil publique (`/`)

**`index.html` (racine)** — Page visuelle de présentation du site.

- **Hero** : pill "🔒 Accès privé", titre du site, courte description
- **3 cartes sections** en grille (`repeat(auto-fill, minmax(250px, 1fr))`, `max-width: 860px`) :
  - **Club de lecture** → lien `href="/club-lecture/"`, accent orange `#e8a44a`
  - **Jeux de rôle** → lien `href="/jdr/"`, accent rose `#cf6679`
  - **Jeux** → lien `href="/Jeux/"`, accent indigo `#667eea`, badge "✨ Accès libre"
- **Effets hover** sur les cartes : lift, glow coloré, ligne accent en haut, flèche `→` apparaît
- Chaque carte a ses propres variables CSS `--card-accent` et `--card-glow`
- Pas de JS, pas de mot de passe — page entièrement publique et statique
- ~~Recettes~~ : carte retirée (section non lancée)

---

## Section Club de lecture

### Accès / Sécurité

- Mot de passe partagé : **Piranèse**
- Mécanisme : `auth.js` calcule SHA-256 du mot de passe saisi, compare au hash stocké en dur dans le fichier. Si correct → `sessionStorage.setItem("cl_auth", "1")`. Chaque page appelle `await requireAuth()` avant tout.
- Pas de système de comptes/login — tout le club partage le même mot de passe.
- Les règles Firestore sont `allow read, write: if true` (accès public à la base). Le mot de passe JS empêche l'accès via le site ; les données ne sont pas sensibles.

### Sidebar

- **Bouton "🏠 Accueil du site"** en bas de la sidebar (`nav.js`), au-dessus du bouton de bascule de thème. Lien `href="/"`. Style `.sidebar-home-link`.
- `.sidebar-bottom` : `display:flex; flex-direction:column; gap:.5rem` — les éléments du bas s'empilent verticalement.

### Pages et fonctionnalités

#### Accueil (`index.html` + `accueil.js`)
1. **Frise chronologique horizontale** (scrollable, glissable à la souris) — affiche tous les événements du club dans l'ordre chronologique : arrivées de membres (👤 gris), propositions de livres (📚 orange), votes sans élu (🗳️ violet), votes avec livre élu (🏆 vert), réunions passées (📝 bleu), réunions à venir (📅 gris, bordure en pointillés). Les événements alternent au-dessus/en dessous d'une ligne d'axe avec flèche. S'ouvre positionnée sur les événements les plus récents (droite). **Chaque événement est cliquable** : navigue vers la page correspondante avec `?open=ID` pour auto-ouvrir l'élément concerné. Le drag (glisser) annule le clic. Les votes sont positionnés à leur vraie date si renseignée (champ `date` du document vote), fallback = 15 du mois.
2. **Livre du mois** — carte unique montrant : titre, auteur, note au vote, depuis combien de temps proposé et par qui, puis la liste des membres avec leur statut de lecture.
   - **Titre cliquable** → ouvre la fiche du livre dans la bibliothèque (`bibliotheque.html?open=LIVRE_ID`)
   - **Noms des membres cliquables** → navigue vers leur profil (`membres.html?open=MEMBRE_ID`)
   - **Badges de statut cliquables** → modal pour mettre à jour son statut de lecture
   - **Configuration du suivi** (bouton "⚙️ Configurer le suivi") → modal pour définir l'unité (`pages`, `chapitres`, `parties`, etc.) et le total (ex: 300). Stocké sur le document livre dans Firestore, partagé entre tous les membres. La modale de statut adapte ses labels et pré-remplit le total automatiquement. La barre de progression affiche l'unité (ex: `50/300 pages`).
   - **Bouton "💬 Laisser un commentaire"** → modal directement depuis l'accueil pour ajouter un commentaire sur le livre du mois
   - **Bouton "📖 Voir les commentaires (N) · ⚠️ spoilers"** → lien vers `commentaires.html?livre=LIVRE_ID`
   - **Suivi de lecture** — seuls les membres ayant un suivi réel s'affichent (les membres avec statut "Pas commencé" ET 0 avancement sont masqués). Triés du plus avancé au moins avancé. Bouton crayon ✏️ en fin de ligne (visible au hover) pour éditer. Select en bas de liste pour ajouter un membre au suivi. Boutons "Laisser un commentaire" / "Voir les commentaires" en style primaire.
3. **Graphique d'évolution des lectures** — bouton "📈 Graphique" en bas du cadre Lecture du mois. Au clic, affiche (ou masque) un second cadre en dessous avec un graphique en courbes Chart.js. Une ligne par membre, axe X = date/heure des mises à jour, axe Y = % d'avancement (si total configuré) ou valeur absolue. Les données sont issues de la collection `progression_lecture` : à chaque mise à jour du statut de lecture (via le modal statut), un point horodaté est enregistré si `page_actuelle > 0` ou si le statut passe à "Terminé". Non rétrospectif — seules les mises à jour effectuées après l'implémentation apparaissent. Chart.js + adapter date-fns chargés en lazy au premier clic.
4. **Palmarès (Podium)** — affiche le top 3 des livres ayant la meilleure note finale (moyenne des notes données par les membres lors des réunions). Mise en page visuelle en podium : 2e à gauche, 1er au centre (plus grand), 3e à droite. Un 4e slot "🏅 Meilleur outsider" s'affiche sous le podium. **Seuls les livres ayant une réunion avec des notes finales** apparaissent ici. Chaque carte est cliquable → `bibliotheque.html?open=LIVRE_ID`.

#### Bibliothèque (`bibliotheque.html` + `bibliotheque.js`)

Deux vues alternées :

**Toggle "✨ Infos complémentaires"** — levier ON/OFF en haut de la vue visuelle, persisté en `localStorage` (clé `cl_bib_ai_infos`), OFF par défaut. Contrôle l'affichage des infos générées par IA (genre, nb pages, badge description) sur toutes les cards via la classe `ai-infos-visible` sur `body`. L'explication "Genre littéraire, nombre de pages, description en 3 mots — fournis par IA, potentiellement inexacts." est affichée à côté du levier.

**Vue visuelle** (défaut, `#view-visual`) :
- **Section "En proposition"** : grille de cards, une par livre proposé (titre, auteur, membre, date) + quand le toggle IA est ON : genre en italique, nombre de pages, badge coloré de la description en 3 mots (couleur dérivée d'un hash de la description, 6 couleurs dans `BADGE_PALETTE`)
  - **Bouton "📋 Copier la liste"** (`#btn-copy-props`) : copie dans le presse-papier la liste des propositions au format Discord, prêt à coller : `"Propositions de livres actuellement enregistrée :\n- Titre de Auteur (année) - depuis Mois\n..."`. Utilise `navigator.clipboard.writeText()`.
- **Section "Livres élus"** : liste des livres lus par le club, avec deux boutons de tri :
  - **"📅 Chronologique"** (défaut) — du plus récent au plus ancien
  - **"⭐ Note finale"** — par note finale décroissante (moyenne des notes réunion)
  - Chaque item affiche la **note finale** en grand (`bib-elu-note-finale`) si disponible, et la note de vote en plus petit (`bib-elu-score-vote`) en dessous. Quand le toggle IA est ON : genre, nb pages et badge description également visibles.
- **Section "Éliminés"** : grille de cards pour les livres avec statut `refuse`. Même infos IA que les propositions.
- Lien "Voir en tableau →" pour passer à la vue table (`?vue=table`)
- Bouton "Proposer un livre" dans l'en-tête

**Vue tableau** (`?vue=table`, `#view-table`) :
- Tableau filtrable (texte libre sur titre / auteur / genre / description en 3 mots) et triable par colonne (clic sur en-tête, y compris la colonne Pages)
- Filtres : statut, genre (dropdown peuplé dynamiquement depuis les livres), membre proposant
- Colonnes : Titre · Auteur · Année · Genre · Pages · Proposé par · Date · Statut
- Lien "← Vue visuelle" pour revenir
- Bouton "Proposer un livre" identique

**Fiche détaillée (modal)** — partagée entre les deux vues, ouverte au clic sur n'importe quel livre :
- Métadonnées en haut (auteur, année, proposé par, date, statut)
- **Bloc spoiler "✨ Infos complémentaires (IA)"** — masqué par défaut, révélé au clic (flèche ▶/▼). Contient : nb pages, genre, description en 3 mots + avertissement IA. N'apparaît que si au moins un de ces champs est renseigné.
- Bouton "✏️ Modifier" dans le header → formulaire inline pour corriger titre, auteur, année, proposé par, date + section IA (nb pages, genre, description en 3 mots)
- Section "Avancements membres" **uniquement si le livre est élu**
- Chronologie : date de proposition → chaque vote avec note de sélection moyenne → résultat final
- **Section "📝 Réunion"** (si une réunion est associée au livre) : date, nombre de participants, notes individuelles (nom + note), lien "Voir la fiche réunion →" vers `reunions.html?open=REUNION_ID`
- **Bouton "💬 Commentaires de lecture"** → lien vers `commentaires.html?livre=LIVRE_ID`

**Labels des notes dans la liste des élus :**
- Grand score en accent = **note du club** (moyenne des notes réunion, `/10 club`)
- Petit texte gris = **note de sélection** du vote (`Sélection : X/5`)

- Statuts des livres : `en_proposition` / `elu` / `refuse` (affiché "**Éliminé**" — ne pas utiliser "Refusé")
- **Auto-ouverture** : si l'URL contient `?open=LIVRE_ID`, la fiche du livre s'ouvre automatiquement au chargement
- La vue est détectée via `?vue=table` dans l'URL au chargement du module

#### Votes (`votes.html` + `votes.js`)
- Liste des votes : une ligne par vote (mois + livre élu) → clic pour ouvrir détail
- **Détail d'un vote** (modal) :
  - Graphe en barres **verticales** : vert = gagnant, violet = conservé (≥ 2.5), gris = éliminé (< 2.5). Ligne en tirets rouges au seuil 2.5.
  - Tableau individuel : lignes = membres, colonnes = livres, avec note + étoiles. Dernière ligne = moyennes.
  - Bouton "✏️ Modifier" pour corriger mois, année et **date exacte du vote** (utilisée pour le positionnement dans la frise chronologique de l'accueil). Si aucune date n'est renseignée, le vote est positionné au 15 du mois par défaut.
- **Bannière vote actif** (`#vote-actif-banner`) : s'affiche dès qu'un vote est en cours. Affiche un compte à rebours en temps réel. Boutons "🗳️ Voter", "Clôturer" et "🗑️ Annuler" (ce dernier supprime le vote sans calculer de résultats ni modifier les statuts des livres).
- **Lancer un vote** (modal `#lancer-overlay`) :
  - Sélection mois/année
  - Durée en texte libre : `"24h"`, `"1h30"`, `"15min"`, ou nombre seul = heures (analysé par `parseDuree()`)
  - Liste de livres (`#l-livres-list`) : livres "en proposition" cochés par défaut, élus/refusés affichés mais désactivés
  - Liste de membres (`#l-membres-list`) : à cocher manuellement
  - **Échelle fixe à 5** — pas de champ de saisie, toujours /5
  - Bouton "Confirmer →" → modal de confirmation récapitulative avant de lancer
- **Soumettre son bulletin** (modal `#soumettre-overlay`) — flux en deux étapes :
  1. **Étape 1 — Identification** : sélectionner son nom → "Continuer →" → confirmation *"Vous êtes bien [nom] ?"*. Si ce nom a déjà voté → *"[nom] a déjà soumis un vote. Voulez-vous le modifier et écraser le vote précédent ?"*
  2. **Étape 2 — Notes** : tableau de **boutons radio** (1/5, 2/5, 3/5, 4/5, 5/5), une ligne par livre. Le formulaire est **toujours vide** (jamais pré-rempli, même en cas d'écrasement). Bouton "← Changer" pour revenir à l'étape 1.
  - Les votes des autres membres ne sont jamais visibles dans ce formulaire.
- **Clôture automatique** : à chaque chargement de la page, si `voteActif.expires_at < now()` → calcule les résultats, sauvegarde dans la collection `votes`, supprime le document `votes_actifs`. Même logique si la page reste ouverte pendant l'expiration (setInterval toutes les secondes).
- **Logique des résultats** : livre avec la plus haute moyenne (unique) → `elu`, livres avec moyenne ≤ 2.5 → `refuse`. Égalité au sommet → `livre_elu = null`.
- **Auto-ouverture** : si l'URL contient `?open=VOTE_ID`, le détail du vote s'ouvre automatiquement au chargement

#### Membres (`membres.html` + `membres.js`)
- Grille de cartes membres avec initiales, nom, date d'arrivée
- Bouton "Ajouter un membre" → modal (nom + date)
- Clic sur un membre → **profil** (modal) :
  - Résumé : initiales, nom, date d'arrivée, nb propositions, nb votes
  - Bouton "✏️ Modifier" dans le header → formulaire inline pour corriger nom et date d'arrivée
  - **Livres proposés** : liste avec statut + date de proposition
  - **Participations aux votes** (`.vmr`) : liste des mois où le membre a voté ; chaque ligne montre son choix n°1 et le nombre de livres dans le vote. **Clic → histogramme** de tous ses votes pour ce mois, triés du préféré au moins préféré. Format `.chart-label` fixe (130px) pour alignement parfait.
  - **Barre de recherche** au-dessus des votes : filtre les livres et affiche un histogramme consolidé de toutes les notes données à ce livre à travers toutes les sessions de vote
  - **Commentaires** (`.cmr`) : liste des livres commentés par le membre. Chaque ligne est cliquable → affiche les commentaires du membre pour ce livre, avec click-to-reveal pour la protection anti-spoiler. Lien "📖 Voir tous les commentaires" vers `commentaires.html?livre=LIVRE_ID`
  - **Réunions** : liste des réunions auxquelles le membre a participé (mois, titre du livre, note individuelle donnée). Chaque ligne est cliquable → redirige vers `reunions.html?open=REUNION_ID`
  - ~~Statuts de lecture~~ — section supprimée
- **Auto-ouverture** : si l'URL contient `?open=MEMBRE_ID`, le profil s'ouvre automatiquement au chargement

#### Réunions (`reunions.html` + `reunions.js`)

Page de gestion des réunions du club. Chaque réunion correspond à une séance de discussion autour d'un livre élu.

- **Deux sections** : "Prévues" (statut `prevue`) et "Passées" (statut `passee`)
- **Liste** : date, mois correspondant, titre du livre associé (si trouvé), note finale (si disponible), participants
- **Ajouter / Modifier** (modal `#form-overlay`) :
  - Statut : `prevue` ou `passee`
  - Date (optionnelle) : champ date
  - Mois/Année : le livre élu de ce mois est affiché automatiquement sous le champ (`#livre-display`)
  - Participants : liste de cases à cocher (tous les membres)
  - Compte rendu : textarea libre
  - Lien vidéo : URL optionnelle
- **Fiche détail** (modal `#detail-overlay`) :
  - Toutes les métadonnées + compte rendu + lien vidéo
  - **Notes finales** : pour chaque participant, un input (1–10) pour saisir sa note de lecture. Bouton "💾 Enregistrer les notes" → met à jour `notes_finales` dans Firestore → recalcule et affiche la note finale moyenne (`computeNoteFinale()`)
  - Bouton "✏️ Modifier" → ouvre le formulaire en mode édition (affiche les valeurs existantes)
- **Note finale** = moyenne des notes finales > 0 des participants. Alimente le **Palmarès** de l'accueil et la **bibliothèque** (tri + affichage).
- **Auto-remplissage du livre** : quand le mois/année change dans le formulaire, `updateLivreDisplay()` cherche le vote correspondant dans la collection `votes` et affiche le livre élu.
- **Liens croisés** : dans la fiche détail, le titre du livre est cliquable → `bibliotheque.html?open=LIVRE_ID` ; les noms des participants (dans la dl *et* dans le tableau de notes finales) sont cliquables → `membres.html?open=MEMBRE_ID`.
- **Auto-ouverture** : si l'URL contient `?open=REUNION_ID`, la fiche détail s'ouvre automatiquement au chargement.

#### Statistiques (`stats.html` + `stats.js`)

Dashboard de statistiques globales du club. Protégé par mot de passe (même mécanisme que les autres pages).

**KPIs (4 cartes en grille) :**
- **Livres lus par le club** — nombre de livres élus distincts (un vote avec `livre_elu`)
- **Lectures cumulées des membres** — somme des membres ayant terminé chaque livre élu (statut `termine` dans `statuts_lecture` OU note > 0 dans `reunions.notes_finales`)
- **Pages lues par le club** — somme des `nb_pages` des livres élus (affiche `—` si aucun `nb_pages` renseigné)
- **Pages lues cumulées** — `nb_pages × nb_membres_ayant_terminé` pour chaque livre élu (affiche `—` si aucun `nb_pages`)

**Section "Note moyenne du club"** — note moyenne de toutes les `notes_finales` de toutes les réunions, avec une distribution en barres horizontales pour les notes 1–10.

**Section "Participation aux votes"** — barres horizontales par membre (nb votes participés / nb votes total, en %). Taux moyen affiché en en-tête.

**Section "Membres les plus actifs"** — tableau classant les membres par score composite (`livres×3 + votes×2 + commentaires`). Podium 🥇🥈🥉 sur les 3 premiers.

**Section "Évolution dans le temps"** — histogramme Chart.js (lazy-loaded) : barres mensuelles représentant le **nombre de membres ayant terminé le livre** ce mois-là (statut `termine` dans `statuts_lecture` OU note > 0 dans `reunions.notes_finales`).

#### Commentaires de lecture (`commentaires.html` + `commentaires.js`)

Page dédiée aux commentaires de lecture pour un livre donné. URL : `commentaires.html?livre=LIVRE_ID`.

- **En-tête** : titre de la page (`Commentaires — [Titre du livre]`), lien retour vers la fiche bibliothèque
- **Barre de suivi** (`.suivi-bar`) — visible uniquement pour les livres avec `statut === "elu"` :
  - Label affichant l'unité et le total configurés (ex: `Suivi en pages · 300 max`)
  - Bouton "⚙️ Configurer le suivi" → modal identique à celui de l'accueil (`progression_unite` / `progression_total`), met à jour Firestore et rafraîchit les labels d'avancement dans les commentaires
- **Filtre par membre** : select dropdown (peuplé dynamiquement avec les membres ayant commenté)
- **Liste des commentaires** (`.comment-list`) : triée par avancement croissant (avancement null en dernier)
  - Chaque carte (`.comment-card`) : header avec avatar, nom, titre du commentaire (si présent), label d'avancement, date, flèche `▶` (`<span class="comment-arrow">`)
  - **Clic sur le header** → révèle le corps : avertissement spoiler `⚠️`, texte du commentaire
  - **Bouton "✏️ Modifier"** dans le corps → formulaire inline de modification (date, avancement, titre, texte). Sauvegarde via `updateCommentaire()` puis re-render
- **Bouton "💬 Laisser un commentaire"** → modal d'ajout avec : membre (select), date (auto-remplie à aujourd'hui), avancement (optionnel, label adapté à l'unité du livre), case à cocher "Ajouter un titre" → champ titre (avec rappel anti-spoiler), textarea
- **Titre optionnel** : le titre est visible dans le header de la card SANS cliquer — **ne doit pas contenir de spoiler**. La case est décochée par défaut.
- Les corps de commentaires sont protégés par un clic : ils ne s'affichent pas au chargement, uniquement sur interaction explicite (protection anti-spoiler).

---

### Design

- **Thème sombre** (défaut) : `#0f0f0f` fond, `#1a1a1a` cartes, orange `#e8a44a` accent
- **Thème clair** ("été fleuri") : lavande `#f5f0fe` fond, cartes blanches, violet foncé `#1e1540` texte, ambre `#c87800` accent, vert émeraude, violet, rose
- **Bascule de thème** : bouton en bas de la sidebar (`☀️ / 🌙`), persisté via `localStorage` clé `"cl_theme"` (`"light"` ou `"dark"`). Le thème est appliqué par `nav.js` avant tout rendu (attribut `data-theme="light"` sur `<html>`).
- Toutes les couleurs passent par des **variables CSS** dans `style.css` (`:root` + `[data-theme="light"]`). Les couleurs inline en JS utilisent `var(--nom)` pour être automatiquement mises à jour au changement de thème sans re-render.
- Sidebar fixe à gauche (240px), responsive mobile
- Polices système (`Segoe UI`, `system-ui`)
- **Classe utilitaire critique** : `.hidden { display: none !important; }` — règle générale dans `style.css`. Sans ce `!important`, les éléments flex/grid ignorent le `display:none` hérité et restent visibles.
- Composants CSS définis dans `style.css` :
  - `.card`, `.btn`, `.badge`, `.overlay`/`.modal`
  - `.st-badge` (statuts lecture)
  - `.vtable` (tableau votes), `.vchart` (graphe vertical)
  - `.frise-wrap` (frise chronologique), `.ft-timeline` (chronologie fiche livre)
  - `.tl-*` (timeline accueil), `.progress-circle` (cercle de progression en donut)
  - `.sidebar-bottom` + `.theme-toggle` + `.sidebar-home-link` (sidebar)
  - `.vmr`, `.vmr-header`, `.vmr-detail` (participations aux votes dans profil membre)
  - `.cmr`, `.cmr-header`, `.cmr-detail`, `.cmr-item`, `.cmr-link` (commentaires dans profil membre)
  - `.comment-list`, `.comment-card`, `.comment-header`, `.comment-body`, `.comment-arrow`, `.comment-author`, `.comment-advance`, `.comment-date`, `.comment-spoiler-warn`, `.comment-text` (page commentaires)
  - `.chart-label` : largeur fixe `width:130px; min-width:130px; max-width:130px; flex-shrink:0` — indispensable pour aligner les barres des histogrammes de vote (sans `max-width`, les longs titres décalent tout)
  - `.bib-section`, `.prop-grid`/`.prop-card`, `.bib-elu-list`/`.bib-elu-item`, `.elim-grid`/`.elim-card` (bibliothèque — vue visuelle)
  - `.bib-elu-scores`, `.bib-elu-note-finale`, `.bib-elu-score-vote`, `.bib-elu-no-note` (notes dans la section livres élus — note finale grande, note vote petite)
  - `.vote-actif-banner` et sous-classes (bandeau vote en cours — bordure accent)
  - `.check-list`, `.check-item`, `.check-item-disabled` (listes à cocher dans le formulaire de lancement de vote)
  - `.podium-wrap`, `.podium-top`, `.podium-step`, `.podium-medal`, `.podium-card`, `.podium-rank-1/2/3`, `.podium-score`, `.podium-title`, `.podium-author`, `.podium-month`, `.podium-outsider` (palmarès — page accueil)
  - `.reunion-list`, `.reunion-item`, `.reunion-date`, `.reunion-livre`, `.reunion-livre-titre`, `.reunion-livre-mois`, `.reunion-note`, `.reunion-participants` (liste réunions)

---

## Section JDR (`/jdr/`)

### Accès / Sécurité

- **Mot de passe** : `Orpheus Cordovan` (avec majuscules et espace)
- **Mécanisme** : `jdr/js/auth.js` — SHA-256 du mot de passe saisi comparé au hash stocké en dur. Si correct → `sessionStorage.setItem("jdr_auth", "1")`. Chaque page appelle `requireAuth(callback)` avant tout rendu.
- **SESSION_KEY** : `"jdr_auth"` (distinct du club de lecture)

### Sidebar

- Même structure que le club de lecture : sidebar fixe 240px à gauche, liens de navigation, bouton "🏠 Accueil du site" en bas, bascule thème
- Thème persisté via `localStorage` clé `"jdr_theme"`
- Palette différente : vert forêt `#4e8a5c` (accent), rouge sang `#9b3535` (secondaire), fond très sombre `#080e08`

### Pages

#### Accueil (`index.html`)
Page de bienvenue avec deux cartes-liens vers Archives et Outils.

#### Archives (`archives.html` + `archives.js` + `stats.js` + `chrono.js`)

Base de données Notion-style des projets JDR. Collection Firestore : `jdr_projets`.

**Quatre vues** (barre d'onglets en haut) :
- **⊞ Cartes** (défaut) — grille de cartes projet
- **☰ Tableau** — tableau filtrable et triable
- **📊 Statistiques** — dashboard Chart.js
- **📅 Chronologie** — frise verticale type Gantt

**Filtres (cartes + tableau) :**
- Recherche texte globale sur tous les champs (nom, univers, créateur, participants, etc.)
- Filtre avancement, filtre type
- Tri : récents, nom A→Z/Z→A, séance (récente/ancienne par date la plus ancienne des séances), note

**Vue Tableau — colonnes :**
Nom · Type · Avancement · Créateur · Univers · Séances MJ · Format (IRL/Online) · Participants (tronqué + popover au clic) · Dates séances (première date + popover au clic) · YT · Note

**Vue Statistiques (`stats.js`) :**
- **KPIs** : Projets total, Séances MJ total, Satisfaction moy., Sur YouTube
- **Vue d'ensemble** : Type de projet (toggle Projets / Séances MJ), Avancement, Joués vs en préparation, Présence YouTube
- **Séances & durée** : Tous les projets par durée en séances MJ, Part de chaque projet dans les séances MJ, Format des parties (toggle)
- **Créateurs** : bar chart horizontal toggle Projets / Séances MJ, hauteur dynamique
- **Participants** : bar chart horizontal toggle Séances jouées / Projets, très grand (hauteur dynamique) + projets triés par nombre de participants
- **Systèmes & univers** : donuts toggle Projets / Séances MJ
- **Satisfaction** : Distribution des notes + tous les projets notés par satisfaction
- Tous les charts donuts/bars "toggle" utilisent le pattern `toggleStore` + `attachToggles()` — pas de légende sur les donuts (supprimée pour gagner de la place)
- Hauteurs calculées dynamiquement : `Math.max(min, count * 36)` par ligne de bar chart

**Vue Chronologie (`chrono.js`) :**
- Axe vertical (haut = plus récent, bas = plus ancien)
- **Lanes automatiques** : algo glouton (desc _startMs) — chaque projet occupe une colonne libre et la libère quand il se termine. Les lanes sont "induites" (invisibles), pas des colonnes marquées
- **Campagnes / Mini Campagnes** : barres colorées de leur première à leur dernière date, nom du projet affiché sur la barre. Si la hauteur le permet (≥ 50 px), affiche également `N séances · X/mois` (densité de jeu calculée comme `nb_seances_mj / durée_en_mois`)
- **One shots** : petites chips à chaque date de séance individuelle
- **Marqueurs de mois** : lignes pointillées horizontales sur fond `var(--bg)`, label de mois en petit à gauche
- **Tooltip au hover** : type, dates, satisfaction, participants
- **Clic** → dispatch `CustomEvent('chrono-open')` → `archives.js` ouvre la fiche détail du projet
- **Layout deux colonnes** : frise à gauche (scrollable, `max-width: 680px`), panneau de graphiques à droite (`position: sticky`)
  - **Graphique 1 — Séances dans le temps** : histogramme bar chart avec toggle par mois / par an. Pour les one-shots : 1 séance à chaque date. Pour les campagnes : `nb_seances_mj` réparties uniformément entre la première et la dernière date (fraction proportionnelle par période).
  - **Graphique 2 — Satisfaction dans le temps** : scatter plot chronologique. Pour les one-shots : 1 point par séance à la satisfaction du projet. Pour les campagnes : `nb_seances_mj` points répartis uniformément. Une courbe de tendance (régression linéaire) est ajoutée en violet avec un indicateur ↗/↘/→ dans l'en-tête.

**Vue Recette Magique (`recette.js`) :**
- Nouvel onglet "✨ Recette magique" dans la barre de vues
- **Analyse de corrélation** entre la satisfaction et tous les facteurs disponibles :
  - Variables numériques (`nb_seances_mj`, `nb_seances_joueurs`, durée en mois) → **corrélation de Pearson**
  - Variables booléennes (YouTube, IRL, Online) → **corrélation point-bisériale**
  - Variables catégorielles (type, créateur, participants, univers, système) → **corrélation point-bisériale** par valeur (chaque valeur = variable binaire)
- Seuls les facteurs avec |r| ≥ 0,1 et au moins 2 projets dans chaque groupe sont affichés
- Affiche : résumé des top facteurs positifs/négatifs + tableau complet avec barres visuelles centré sur zéro + explication de la méthodologie
- Nécessite au moins 4 projets notés pour s'afficher

**Ajouter/modifier** : formulaire modal complet
**Supprimer** : bouton dans le formulaire d'édition uniquement

**Formulaire — champs :**
- Nom (obligatoire)
- Type (multi-select : Campagne, Mini Campagne, One shot)
- Avancement (multi-select : Idée, En préparation, Prêt, En cours, Arrêté, Terminé)
- Date de début
- YouTube (checkbox)
- Créateur (multi-select)
- Univers (multi-select)
- Emplacement du scénario (multi-select : PDF, Livre, Notion, Drive, LegendKeeper, Obsidian, Canva, Word)
- **Section "Déjà joué ?"** (conditionnelle via checkbox) :
  - Satisfaction (étoiles interactives 0–5)
  - Séances MJ / Séances joueurs
  - Participants (multi-select)
  - Format (IRL / Online)
  - Dates des séances (liste dynamique de champs date)
- Commentaires (textarea libre)

**Composant Multi-select :**
- Chips pour les valeurs sélectionnées
- Dropdown filtrable à la frappe
- Création de nouvelles options via "+ Créer « xxx »" ou touche Entrée
- Backspace supprime le dernier chip
- Architecture : input jamais détruit (évite le blur prématuré), chips et dropdown mis à jour séparément

#### Outils (`outils.html`)

Grille de 4 outils MJ, chacun s'ouvrant dans le même onglet :

| Outil | Campagne | Fichier |
|-------|----------|---------|
| Générateur de PNJ | Les Enfants de Makryon | `Outils/generateur-pnj-makryon_1.html` |
| Outils du MJ (PNJ + chapeau + détective) | Le Tribunal des Dragons | `Outils/tribunal-dragons-outils_1.html` |
| La Roue du Paradoxe | Chroniques d'Aria | `Outils/paradoxe_temporel_4.html` |
| Roue Personnalisable | Tous univers | `Outils/roue-personnalisable_1.html` |

**Roue Personnalisable — fonctionnement :**
- Même mécanique que la Roue du Paradoxe (canvas, animation, pointeur, carte résultat)
- Onglet **✏️ Personnaliser** : édition des paramètres (titre, sous-titre, campagne, texte bouton) et gestion complète des segments (ajout, modification, suppression, réordonnancement ↑↓)
- Chaque segment : zone, titre, signe (+/-/~/?) → couleur auto, couleur manuelle, description, choix optionnels (label + indication secrète), secret MJ (caché, révélé au clic)
- Données persistées en `localStorage` clé `roue_custom_v1`
- Bouton "Réinitialiser" pour revenir aux données par défaut (4 segments exemples)

---

## Section Jeux (`/Jeux/`)

### Accès / Sécurité

**Pas de mot de passe.** Section entièrement publique, accessible depuis la page d'accueil.

### Design

- Thème sombre, accent indigo `#667eea`
- Header simple (`<header class="jeux-header">`) avec titre + lien "← Accueil du site" — **pas de sidebar**
- Grille de cartes jeux sur la page d'accueil

### Pages

#### Accueil Jeux (`index.html`)

Page d'accueil listant les jeux disponibles sous forme de grille de cartes. Actuellement : une carte "Jeu de Mots".

#### Jeu de Mots (`jeu-de-mots.html`)

Jeu de déduction multijoueur (mots à faire deviner) avec parties partageables via Firebase.

**Flux de jeu :**
1. **Saisie des noms** des joueurs + **choix de la difficulté** (Facile / Normal / Difficile / Expert)
2. **Création de la partie** dans Firestore (`jeu_mots_parties`) → redirection vers `?partie=ID`
3. **Vue partie** (URL partageable) : chaque joueur voit tous les mots floutés (`filter: blur`). Clic sur son propre mot pour le révéler. Chaque joueur peut aller voir son mot depuis son propre appareil sans voir les mots des autres.

**Historique :**
- Chargé depuis Firestore (`jeu_mots_parties`, 30 dernières parties, triées par date desc)
- Commun à tous les appareils / tous les joueurs
- Mots affichés floutés dans l'historique, clic pour révéler. Lien "Ouvrir →" pour revenir sur la vue de la partie.

---

## Firebase — Projet `mon-site-e253f`

**Console :** `console.firebase.google.com` → projet `mon-site-e253f`  
**Règles Firestore :** `allow read, write: if true` (accès ouvert — intentionnel)  
**Tous les tris** se font côté JavaScript (pas d'index composites Firestore requis)

### Collections

#### `membres`
| Champ | Type | Description |
|-------|------|-------------|
| `nom` | string | Prénom + nom |
| `date_arrivee` | Timestamp | Date d'arrivée dans le club |
| `cree_le` | Timestamp | Timestamp création |

#### `livres`
| Champ | Type | Description |
|-------|------|-------------|
| `titre` | string | Obligatoire |
| `auteur` | string | Optionnel |
| `annee` | number | Optionnel |
| `propose_par` | string | ID du document membre |
| `date_proposition` | Timestamp | |
| `statut` | string | `en_proposition` · `elu` · `refuse` |
| `progression_unite` | string \| null | Unité de suivi (ex: `pages`, `chapitres`) |
| `progression_total` | number \| null | Total de l'unité (ex: `300`) |
| `nb_pages` | number \| null | Nombre de pages du livre (optionnel, fourni par IA, à vérifier quand le livre est élu) |
| `genre` | string \| null | Genre littéraire (optionnel, fourni par IA) |
| `description_3_mots` | string \| null | Description en 3 mots (optionnel, fourni par IA) |

> **Attention :** dans l'UI, `refuse` s'affiche toujours "Éliminé" (jamais "Refusé").  
> `progression_unite` et `progression_total` sont configurables depuis l'accueil (livre du mois) **et** depuis la page commentaires (livres avec statut `elu`).  
> `nb_pages` alimente les KPIs "pages lues" de la page Statistiques.  
> `genre` et `description_3_mots` sont des infos IA — affichées conditionnellement selon le toggle de la bibliothèque et dans un spoiler collapsible dans les fiches.

#### `votes`
| Champ | Type | Description |
|-------|------|-------------|
| `mois` | number | 1–12 |
| `annee` | number | |
| `date` | Timestamp | Date exacte du vote — auto-set à la clôture (`serverTimestamp`), modifiable manuellement |
| `resultats` | array | Voir structure ci-dessous |
| `livre_elu` | string \| null | ID du livre élu (null si égalité) |

**Structure d'un élément `resultats` :**
```json
{
  "livre_id": "abc123",
  "titre": "Des fleurs pour Algernon",
  "auteur": "Daniel Keyes",
  "notes": { "membre_id_1": 5, "membre_id_2": 4 },
  "moyenne": 4.5
}
```

**Logique automatique à l'enregistrement d'un vote (`db.js → addVote`) :**
- Livre avec la moyenne la plus haute (unique) → `statut = "elu"`
- Livres avec moyenne ≤ 2.5 → `statut = "refuse"`
- Égalité au sommet → aucun livre élu (`livre_elu = null`)

#### `votes_actifs`

Collection de vote en cours. Il ne peut y avoir qu'un seul document à la fois (interrogé via `getDocs` — le premier document est retourné).

| Champ | Type | Description |
|-------|------|-------------|
| `mois` | number | 1–12 |
| `annee` | number | |
| `livre_ids` | array | IDs des livres soumis au vote |
| `membre_ids` | array | IDs des membres invités à voter |
| `echelle` | number | Échelle de notes (ex: 5 ou 10) |
| `expires_at` | Timestamp | Date/heure d'expiration automatique |
| `bulletins` | map | `{ MEMBRE_ID: { LIVRE_ID: note, … }, … }` |
| `cree_le` | Timestamp | Timestamp création |

> **Clôture** : à chaque chargement de `votes.js`, si `expires_at < now()`, le vote est clôturé automatiquement (côté client). Les résultats sont calculés, sauvegardés dans `votes`, puis le document `votes_actifs` est supprimé.  
> **Soumission partielle** : chaque bulletin est mis à jour via `bulletins.MEMBRE_ID` (point-notation Firestore) pour ne pas écraser les autres bulletins.

#### `reunions`
| Champ | Type | Description |
|-------|------|-------------|
| `statut` | string | `prevue` · `passee` |
| `date` | Timestamp \| null | Date de la réunion |
| `mois` | number | 1–12 |
| `annee` | number | |
| `livre_id` | string \| null | ID du livre élu correspondant |
| `participant_ids` | array | IDs des membres présents |
| `compte_rendu` | string | Texte libre du compte rendu |
| `lien_video` | string \| null | URL vidéo (optionnel) |
| `notes_finales` | map | `{ MEMBRE_ID: note (1-10), … }` |
| `cree_le` | Timestamp | Timestamp création |

> **Note finale** = moyenne de `notes_finales` (valeurs > 0). Alimente le palmarès (accueil) et le tri/affichage de la bibliothèque.

#### `jdr_projets`
| Champ | Type | Description |
|-------|------|-------------|
| `nom` | string | Titre du projet (obligatoire) |
| `type` | array | Campagne · Mini Campagne · One shot |
| `avancement` | array | Idée · En préparation · Prêt · En cours · Arrêté · Terminé |
| `date_debut` | Timestamp \| null | Date de début du projet |
| `youtube` | boolean | Session enregistrée sur YouTube |
| `createur` | array | Noms du ou des créateurs |
| `univers` | array | Univers du projet |
| `emplacement` | array | Où est stocké le scénario (PDF, Livre, Notion…) |
| `deja_joue` | boolean | Le projet a été joué |
| `satisfaction` | number \| null | Note de satisfaction 0–5 (si joué) |
| `nb_seances_mj` | number \| null | Nombre de séances côté MJ |
| `nb_seances_joueurs` | number \| null | Nombre de séances côté joueurs |
| `participants` | array | Noms des participants |
| `irl` | boolean | Partie en présentiel |
| `online` | boolean | Partie en ligne |
| `dates_seances` | array (Timestamp) | Dates individuelles des séances |
| `commentaires` | string | Remarques libres |
| `cree_le` | Timestamp | Timestamp création |
| `mis_a_jour` | Timestamp | Timestamp dernière modification |

> Les valeurs multi-select sont des arrays de strings. Les nouvelles options créées par l'utilisateur dans le formulaire sont sauvegardées en base et réapparaissent automatiquement dans les futurs formulaires (discovery depuis Firestore + PRESETS).

#### `jeu_mots_parties`
| Champ | Type | Description |
|-------|------|-------------|
| `date` | Timestamp | Date et heure de la partie (serverTimestamp) |
| `difficulte` | string | `facile` · `normal` · `difficile` · `expert` |
| `joueurs` | array | `[{ nom: string, mot: string }, …]` — un objet par joueur |

> Partagé entre tous les appareils. Utilisé par `Jeux/jeu-de-mots.html` pour afficher l'historique commun. Les 30 dernières parties sont chargées (`orderBy("date", "desc"), limit(30)`).

#### `progression_lecture`
| Champ | Type | Description |
|-------|------|-------------|
| `livre_id` | string | ID du livre |
| `membre_id` | string | ID du membre |
| `page_actuelle` | number \| null | Avancement enregistré au moment du point |
| `pages_totales` | number \| null | Total connu au moment du point |
| `horodatage` | Timestamp | Date et heure exacte de la mise à jour |

> Chaque fois qu'un membre met à jour son avancement (page_actuelle > 0, ou statut "Terminé" avec un total connu), un nouveau document est ajouté — sans écraser le précédent. C'est un historique immuable qui alimente le graphique d'évolution.

#### `notes_lecture`
| Champ | Type | Description |
|-------|------|-------------|
| `membre_id` | string | ID membre |
| `livre_id` | string | ID livre |
| `note` | number | Note post-lecture |
| `mois` / `annee` | number | Période |

#### `statuts_lecture`
| Champ | Type | Description |
|-------|------|-------------|
| `membre_id` | string | ID membre |
| `livre_id` | string | ID livre |
| `statut` | string | `pas_commence` · `achete` · `en_cours` · `termine` |
| `page_actuelle` | number | Optionnel |
| `pages_totales` | number | Optionnel |
| `mis_a_jour` | Timestamp | Timestamp dernière modif |

#### `commentaires_lecture`
| Champ | Type | Description |
|-------|------|-------------|
| `livre_id` | string | ID livre |
| `membre_id` | string | ID membre |
| `date_commentaire` | Timestamp | Date du commentaire |
| `avancement` | number \| null | Position dans le livre (ex: page, chapitre) — optionnel |
| `titre` | string \| null | Titre court visible sans cliquer (sans spoiler) — optionnel |
| `contenu` | string | Corps du commentaire (masqué par défaut, click-to-reveal) |
| `cree_le` | Timestamp | Timestamp création |

> Les commentaires sont triés par `avancement` croissant (null en dernier, valeur fictive 99999).  
> La modification d'un commentaire existant passe par `updateCommentaire()` dans `db.js`.

---

## URLs

| Page | URL |
|------|-----|
| Accueil site (public) | `/` |
| Club de lecture — Accueil | `/club-lecture/` |
| Club de lecture — Bibliothèque | `/club-lecture/bibliotheque.html` |
| Club de lecture — Votes | `/club-lecture/votes.html` |
| Club de lecture — Membres | `/club-lecture/membres.html` |
| Club de lecture — Commentaires | `/club-lecture/commentaires.html?livre=LIVRE_ID` |
| Club de lecture — Réunions | `/club-lecture/reunions.html` |
| Club de lecture — Statistiques | `/club-lecture/stats.html` |
| JDR — Accueil | `/jdr/` |
| JDR — Archives | `/jdr/archives.html` |
| JDR — Outils | `/jdr/outils.html` |
| JDR — Outil Makryon | `/jdr/Outils/generateur-pnj-makryon_1.html` |
| JDR — Outil Tribunal | `/jdr/Outils/tribunal-dragons-outils_1.html` |
| JDR — Outil Aria | `/jdr/Outils/paradoxe_temporel_4.html` |
| Jeux — Accueil | `/Jeux/` |
| Jeux — Jeu de Mots | `/Jeux/jeu-de-mots.html` |

---

## Décisions de conception importantes

- **Pas de système de login individuel** — tout le club partage un mot de passe unique. Les noms des membres sont sélectionnés dans des listes déroulantes.
- **Pas d'index Firestore composites** — tous les tris se font en JS après récupération complète des collections. Évite les erreurs d'index manquants.
- **"Refusé" ne s'affiche jamais** — le terme affiché partout est "Éliminé". La valeur stockée en base reste `"refuse"` (ne pas changer la valeur Firestore).
- **Notes sur 5 — fixe** — l'échelle de vote est toujours /5, sans possibilité de la modifier lors du lancement. La saisie se fait via boutons radio (1/5 à 5/5), pas de champ numérique libre. La détection de l'échelle (5 ou 10) reste automatique dans les graphes de résultats (pour les anciens votes).
- **Votes permanents** — il n'existe pas de bouton de suppression pour un vote terminé. Seul un vote *actif* peut être annulé (sans enregistrer de résultats). Cela garantit l'intégrité de l'historique.
- **Soumission de vote anonymisée** — le formulaire de vote est toujours vide à l'ouverture (jamais pré-rempli), que ce soit un premier vote ou un écrasement. Un membre ne voit jamais les notes des autres.
- **Frise vs Chronologie** — la frise (accueil, en haut) est horizontale et montre TOUS les événements. La chronologie (accueil, en bas) montre uniquement les livres élus, verticalement.
- **Avancements membres dans la fiche livre** — s'affiche UNIQUEMENT si le livre a le statut `elu`.
- **Modification des fiches** — le bouton "✏️ Modifier" dans les modales bibliothèque et membres permet de corriger les informations de base. Il remplace le contenu de la modale par un formulaire inline ; "Annuler" revient à la fiche sans sauvegarder. Les votes ne sont pas modifiables depuis ces fiches (intégrité des données).
- **Suivi de progression normalisé** — `progression_unite` et `progression_total` sont stockés sur le document livre (Firestore). Tous les membres voient la même unité et le même total dans la modale de mise à jour du statut. Configurable depuis l'accueil (livre du mois) et depuis la page commentaires (tous les livres élus).
- **Protection anti-spoiler des commentaires** — le corps de chaque commentaire est masqué au chargement (`.comment-body.hidden`). Le clic sur le header révèle le contenu. Le titre (optionnel, visible sans cliquer) ne doit jamais contenir de spoiler — un avertissement est affiché dans le formulaire de saisie.
- **Bibliothèque deux vues** — la vue visuelle est le défaut. La vue tableau s'active via `?vue=table`. La détection se fait au chargement du module JS via `URLSearchParams`, avant le rendu.
- **Commentaires triés par avancement** — l'ordre naturel de lecture dans le livre. Les commentaires sans avancement (null) apparaissent en dernier (valeur fictive 99999 pour le tri).
- **`escapeHtml` dans les templates HTML** — utilisé systématiquement pour les données utilisateur dans les templates de rendu JS (`&`, `<`, `>`, `"` échappés). Ne pas insérer de données brutes dans `innerHTML`.
- **Vote actif — un seul à la fois** — la collection `votes_actifs` ne contient jamais qu'un seul document. Si un vote est déjà en cours, le bouton "Lancer" est désactivé. La clôture (auto ou manuelle) supprime le document avant d'écrire dans `votes`.
- **Clôture côté client** — il n'y a pas de Cloud Function ni de cron serveur. La clôture du vote est déclenchée par le premier chargement de `votes.js` après l'expiration. Fiable pour un club privé avec des connexions régulières.
- **Notes finales séparées des notes de vote** — les notes de vote (pendant le choix du livre) sont stockées dans `votes.resultats[].notes`. Les notes finales (après lecture, lors de la réunion) sont stockées dans `reunions.notes_finales`. Ce sont deux scores distincts : le premier mesure l'intérêt *avant* lecture, le second la satisfaction *après*.
- **Palmarès basé uniquement sur la note finale** — seuls les livres ayant une réunion avec des notes finales renseignées apparaissent dans le podium de l'accueil. Un livre élu sans réunion (ou sans notes) n'y figure pas.
- **`editReunionId` vs `currentReunionId`** (réunions.js) — deux variables distinctes pour éviter les conflits entre la fiche détail ouverte (`currentReunionId`) et le formulaire d'édition (`editReunionId`). Après la sauvegarde d'une édition, la fiche détail est rouverte avec `currentReunionId`.
- **Auth JDR autonome** — la section JDR n'utilise pas le fichier `auth.js` du club de lecture. L'authentification est du JS inline dans `jdr/index.html` : même mécanique SHA-256/sessionStorage mais indépendante, avec SESSION_KEY `"jdr_auth"` et hash propre.
- **Liens croisés entre pages** — les fiches livre (bibliothèque), membre et réunion sont interconnectées : la fiche livre affiche un encart réunion avec lien vers la fiche réunion ; la fiche réunion rend le livre et les participants cliquables vers leurs fiches respectives ; la fiche membre liste les réunions avec lien vers chacune. Toutes les pages supportent l'auto-ouverture via `?open=ID`.
- **Chrono JDR — layout deux colonnes** : `.chrono-left` (frise, max 680px, scrollable) + `.chrono-right` (sticky, deux graphiques Chart.js). Les charts sont détruits/recréés via `chronoCharts` à chaque appel de `renderChrono`. L'histogramme et le scatter partagent les fonctions `computeSessionsBuckets` et `computeSatPoints` qui distribuent les séances des campagnes de façon uniforme entre première et dernière date.
- **Recette magique — `recette.js`** : analyse purement frontend, aucune donnée n'est envoyée. Les corrélations sont calculées à chaque affichage de l'onglet à partir des données Firestore déjà chargées dans `allProjets`.

---

## Historique des modifications

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
