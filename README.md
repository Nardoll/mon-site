# Mon Site — Documentation Claude Code

> Ce fichier est le point d'entrée pour toute nouvelle session Claude Code. Il contient tout le contexte nécessaire pour reprendre le travail sans aucune explication de l'utilisateur.

---

## Contexte général

Site **personnel et privé** de Tom (utilisateur). Multi-sections indépendantes. La page d'accueil (`/`) dit simplement "rien à voir ici". Chaque section n'est accessible que si on connaît son URL exacte — il n'y a aucun lien depuis l'accueil.

**Sections existantes :**
- `/club-lecture/` — Fonctionnel et en développement actif
- `/recettes/` — Placeholder vide
- `/jdr/` — Placeholder vide

---

## Stack technique

| Élément | Choix |
|---------|-------|
| Langages | HTML / CSS / JS vanilla uniquement |
| Framework | Aucun — pas de React, Vue, bundler, ni npm |
| Base de données | Firebase Firestore v10.12.2 via CDN (ES modules natifs) |
| Hébergement | Netlify — déploiement automatique à chaque push sur `main` |
| Repo GitHub | `https://github.com/Nardoll/mon-site` (branche `main`) |

**Contrainte importante :** ES modules natifs dans le navigateur. Ça fonctionne en HTTPS (Netlify) ou via l'extension Live Server de VS Code. Pas de `file://`.

**Workflow :**
1. Modifier les fichiers dans VS Code
2. `git add` + `git commit` + `git push` → Netlify déploie en ~30 secondes

---

## Structure des fichiers

```
Mon Site/
├── index.html                   Page d'accueil publique ("rien à voir ici")
├── netlify.toml                 Config Netlify : URLs inconnues → index.html (404)
├── README.md                    Ce fichier
│
├── club-lecture/
│   ├── index.html               Page Accueil du club
│   ├── bibliotheque.html        Page Bibliothèque
│   ├── votes.html               Page Votes
│   ├── membres.html             Page Membres
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
│       └── membres.js           Logique page Membres
│
├── recettes/
│   └── index.html               Placeholder (section à développer)
└── jdr/
    └── index.html               Placeholder (section à développer)
```

---

## Section Club de lecture

### Accès / Sécurité

- Mot de passe partagé : **Piranèse**
- Mécanisme : `auth.js` calcule SHA-256 du mot de passe saisi, compare au hash stocké en dur dans le fichier. Si correct → `sessionStorage.setItem("cl_auth", "1")`. Chaque page appelle `await requireAuth()` avant tout.
- Pas de système de comptes/login — tout le club partage le même mot de passe.
- Les règles Firestore sont `allow read, write: if true` (accès public à la base). Le mot de passe JS empêche l'accès via le site ; les données ne sont pas sensibles.

### Pages et fonctionnalités

#### Accueil (`index.html` + `accueil.js`)
1. **Frise chronologique horizontale** (scrollable, glissable à la souris) — affiche tous les événements du club dans l'ordre chronologique : arrivées de membres (👤 gris), propositions de livres (📚 orange), votes sans élu (🗳️ violet), votes avec livre élu (🏆 vert). Les événements alternent au-dessus/en dessous d'une ligne d'axe avec flèche.
2. **Livre du mois** — carte unique montrant : titre, auteur, note au vote, depuis combien de temps proposé et par qui, puis la liste des membres avec leur statut de lecture (cliquable sans login → modal pour mettre à jour).
3. **Chronologie des livres élus** — timeline verticale de tous les livres élus, du plus récent au plus ancien, avec note.

#### Bibliothèque (`bibliotheque.html` + `bibliotheque.js`)
- Tableau filtrable (texte libre sur titre/auteur) et triable par colonne (clic sur en-tête)
- Filtres : statut, membre proposant
- Bouton "Proposer un livre" → modal (titre obligatoire, auteur/année optionnels, membre, date)
- Clic sur un livre → **fiche détaillée** :
  - Métadonnées en haut (auteur, année, proposé par, date, statut)
  - Section "Avancements membres" **uniquement si le livre est élu**
  - Chronologie : date de proposition → chaque vote avec note moyenne → résultat final (Élu / Éliminé)
- Statuts des livres : `en_proposition` / `elu` / `refuse` (affiché "**Éliminé**" — ne pas utiliser "Refusé")

#### Votes (`votes.html` + `votes.js`)
- Liste des votes : une ligne par vote (mois + livre élu) → clic pour ouvrir détail
- **Détail d'un vote** (modal) :
  - Graphe en barres **verticales** : vert = gagnant, violet = conservé (≥ 2.5), gris = éliminé (< 2.5). Ligne en tirets rouges au seuil 2.5.
  - Tableau individuel : lignes = membres, colonnes = livres, avec note + étoiles. Dernière ligne = moyennes.
  - Bouton "✏️ Modifier le mois" pour corriger mois/année d'un vote existant.
- **Saisie d'un vote** (modal) :
  - Sélectionner mois/année
  - Ajouter des livres depuis la liste "en proposition"
  - Grille de saisie des notes (sur 5)
  - À l'enregistrement : livre avec la plus haute moyenne → `elu`, livres avec moyenne ≤ 2.5 → `refuse` (= "Éliminé")
  - En cas d'égalité pour la 1ère place → aucun livre élu automatiquement

#### Membres (`membres.html` + `membres.js`)
- Grille de cartes membres avec initiales, nom, date d'arrivée
- Bouton "Ajouter un membre" → modal (nom + date)
- Clic sur un membre → **profil** (modal) :
  - Résumé : initiales, nom, date d'arrivée, nb propositions, nb votes
  - Livres proposés avec statut
  - Statuts de lecture personnels
  - Historique des notes données dans les votes (graphe par session de vote)

### Design

- **Thème sombre** (`#0f0f0f` fond, `#1a1a1a` cartes)
- **Couleur d'accent** : orange `#e8a44a`
- Sidebar fixe à gauche (240px), responsive mobile
- Polices système (`Segoe UI`, `system-ui`)
- Composants CSS définis dans `style.css` : `.card`, `.btn`, `.badge`, `.overlay`/`.modal`, `.st-badge` (statuts lecture), `.vtable` (tableau votes), `.vchart` (graphe vertical), `.frise-wrap` (frise chronologique), `.ft-timeline` (chronologie fiche livre), `.tl-*` (timeline accueil)

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

> **Attention :** dans l'UI, `refuse` s'affiche toujours "Éliminé" (jamais "Refusé").

#### `votes`
| Champ | Type | Description |
|-------|------|-------------|
| `mois` | number | 1–12 |
| `annee` | number | |
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

---

## URLs

| Page | URL |
|------|-----|
| Accueil site (public) | `/` |
| Club de lecture — Accueil | `/club-lecture/` |
| Club de lecture — Bibliothèque | `/club-lecture/bibliotheque.html` |
| Club de lecture — Votes | `/club-lecture/votes.html` |
| Club de lecture — Membres | `/club-lecture/membres.html` |
| Recettes (placeholder) | `/recettes/` |
| JDR (placeholder) | `/jdr/` |

---

## Décisions de conception importantes

- **Pas de système de login individuel** — tout le club partage un mot de passe unique. Les noms des membres sont sélectionnés dans des listes déroulantes.
- **Pas d'index Firestore composites** — tous les tris se font en JS après récupération complète des collections. Évite les erreurs d'index manquants.
- **"Refusé" ne s'affiche jamais** — le terme affiché partout est "Éliminé". La valeur stockée en base reste `"refuse"` (ne pas changer la valeur Firestore).
- **Notes sur 5** — la saisie des votes se fait sur une échelle 0–5. La détection de l'échelle (5 ou 10) est automatique dans les graphes.
- **Frise vs Chronologie** — la frise (accueil, en haut) est horizontale et montre TOUS les événements. La chronologie (accueil, en bas) montre uniquement les livres élus, verticalement.
- **Avancements membres dans la fiche livre** — s'affiche UNIQUEMENT si le livre a le statut `elu`.
