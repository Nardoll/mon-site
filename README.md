# Mon Site — Documentation pour Claude Code

Site personnel multi-sections. Chaque section est accessible uniquement par URL directe, sans liens depuis la page d'accueil.

## Stack
- HTML/CSS/JS vanilla — aucun framework, aucun bundler
- Firebase Firestore v10.12.2 via CDN (ES modules)
- Hébergement : Netlify (déploiement auto à chaque push sur `main`)
- Pas de framework, pas de build step

## Workflow
1. Modifier les fichiers dans VS Code
2. Prévisualiser en local avec Live Server
3. Commit + Push → déploiement Netlify automatique en ~30s

## Structure du projet

```
Mon Site/
├── index.html                   Page d'accueil générique ("rien à voir ici")
├── netlify.toml                 Config Netlify (404 → index.html)
├── club-lecture/                Section club de lecture
│   ├── index.html               Accueil (chronologie + livre du mois)
│   ├── bibliotheque.html        Bibliothèque (liste filtrée des livres)
│   ├── votes.html               Votes (historique + saisie manuelle)
│   ├── membres.html             Membres (liste + profils)
│   ├── firebase-config.js       Init Firebase / Firestore (ES module)
│   ├── css/style.css            Styles globaux (dark theme, sidebar, composants)
│   └── js/
│       ├── db.js                Toutes les opérations Firestore
│       ├── utils.js             Helpers (formatDate, initiales, showToast…)
│       ├── nav.js               Injection de la barre de navigation latérale
│       ├── accueil.js           Logique page Accueil
│       ├── bibliotheque.js      Logique page Bibliothèque
│       ├── votes.js             Logique page Votes
│       └── membres.js           Logique page Membres
├── recettes/index.html          Placeholder (à développer)
└── jdr/index.html               Placeholder (à développer)
```

## Firebase — Projet `mon-site-e253f`

### Collections Firestore

#### `membres`
| Champ | Type | Notes |
|-------|------|-------|
| `nom` | string | |
| `date_arrivee` | Timestamp | |

#### `livres`
| Champ | Type | Notes |
|-------|------|-------|
| `titre` | string | Obligatoire |
| `auteur` | string | Optionnel |
| `annee` | number | Optionnel |
| `propose_par` | string | ID membre |
| `date_proposition` | Timestamp | |
| `statut` | string | `en_proposition` / `elu` / `refuse` |

#### `votes`
| Champ | Type | Notes |
|-------|------|-------|
| `mois` | number | 1–12 |
| `annee` | number | |
| `resultats` | array | `[{ livre_id, titre, auteur, notes: {membre_id: note}, moyenne }]` |
| `livre_elu` | string | ID du livre élu |

**Logique automatique :** à l'enregistrement d'un vote, le livre avec la moyenne la plus haute passe à `elu`, les livres avec moyenne ≤ 2.5 passent à `refuse`.

#### `notes_lecture`
| Champ | Type |
|-------|------|
| `membre_id` | string |
| `livre_id` | string |
| `note` | number |
| `mois` / `annee` | number |

#### `statuts_lecture`
| Champ | Type | Notes |
|-------|------|-------|
| `membre_id` | string | |
| `livre_id` | string | |
| `statut` | string | `pas_commence` / `achete` / `en_cours` / `termine` |
| `page_actuelle` | number | Optionnel |
| `pages_totales` | number | Optionnel |

## URLs

| Section | URL |
|---------|-----|
| Accueil site | `/` |
| Club de lecture | `/club-lecture/` |
| Bibliothèque | `/club-lecture/bibliotheque.html` |
| Votes | `/club-lecture/votes.html` |
| Membres | `/club-lecture/membres.html` |
| Recettes | `/recettes/` |
| JDR | `/jdr/` |

## Notes techniques
- Branche principale : `main`, Netlify surveille cette branche
- ES modules natifs dans le navigateur (pas de bundler) — fonctionne uniquement en HTTPS (Netlify) ou via Live Server
- Pas de système d'authentification — accès par URL directe seulement
- Pour les pages privées : ajouter `<meta name="robots" content="noindex">` dans le `<head>`