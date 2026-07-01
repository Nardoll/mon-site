# Mon Site — Documentation Claude Code

> Ce fichier est le point d'entrée pour toute nouvelle session Claude Code. Il contient tout le contexte nécessaire pour reprendre le travail sans aucune explication de l'utilisateur.

---

## ⚠️ Notes importantes pour Claude Code

> **Push sans confirmation.** Tom a demandé de pusher directement après chaque modification, sans demander son feu vert.
> Le site est hébergé sur **Cloudflare Worker**. Le déploiement est **automatique après chaque push** sur `main` — pas besoin de `npx wrangler deploy` manuellement.

> **Mettre à jour ce README à chaque modification significative.** À la fin de chaque session de développement, Claude doit documenter les changements effectués dans la section "Historique des modifications" ci-dessous. C'est une consigne permanente à appliquer sans que Tom ait besoin de le rappeler.

---

## 🚧 Prochain gros chantier — version téléphone

> **À reprendre en priorité à la prochaine session.** Le prochain grand chantier est l'**affichage mobile / version téléphone du site** : plusieurs ajustements responsive sont à faire (mise en page, tailles, éléments qui débordent ou mal adaptés sur petit écran). Claude doit le rappeler à Tom quand on reprend le travail. (Noté le 2026-06-18.)

---

## Contexte général

Site **personnel et privé** de Tom. Multi-sections indépendantes. La page d'accueil (`/`) présente le site et ses différentes sections avec des cartes visuelles. Chaque section n'est accessible qu'avec un mot de passe.

**Sections existantes :**
- `/lis-tes-ratures/` — Club de lecture, **version en production** (remplace `/club-lecture/`) — fonctionnel, DA "café littéraire × vieille bibliothèque"
- `/club-lecture/` — Ancienne version du club de lecture, **redirigée automatiquement** vers `/lis-tes-ratures/` via `_redirects` (301). Dossier conservé dans le repo.
- `/jdr/` — Page d'accueil active, protégée par mot de passe, en cours de développement
- `/Jeux/` — Section jeux en ligne, **accès libre** (pas de mot de passe)
- `/data-discord/` — Stats et archives du serveur Discord — **en cours de développement** (archives sondages manuelles, membres, stats, thèmes)
- `/atelier/` — Outil de world-building solo procédural, en développement actif
- `/recettes/` — Supprimée de l'accueil public (dossier conservé mais non lié)

---

## Stack technique

| Élément | Choix |
|---------|-------|
| Langages | HTML / CSS / JS vanilla uniquement |
| Framework | Aucun — pas de React, Vue, bundler, ni npm |
| Base de données | Firebase Firestore v10.12.2 via CDN (ES modules natifs) |
| Hébergement | Cloudflare **Worker** (Worker + fichiers statiques) — `npx wrangler deploy` (**manuel**, pas automatique). Domaine `nardoll.monsiteinternet.workers.dev`. Voir [Enrichissement IA](#enrichissement-ia) |
| Repo GitHub | `https://github.com/Nardoll/mon-site` (branche `main`) |

**Contrainte importante :** ES modules natifs dans le navigateur. Ça fonctionne en HTTPS (Cloudflare Pages) ou via l'extension Live Server de VS Code. Pas de `file://`.

**Workflow :**
1. Modifier les fichiers dans VS Code
2. `git add` + `git commit` + `git push`
3. `npx wrangler deploy` pour déployer sur Cloudflare

---

## Bot Discord (`/discord-bot/`)

Script Node.js de collecte + agrégation des données Discord vers Firebase. Architecture en deux étapes : `collect.js` remplit les collections raw, `aggregate.js` calcule 4 docs résumés lus par le site.

### ⚠️ Mise en place sur un nouveau PC (à faire une seule fois)

**1. Installer Node.js** si pas déjà installé : télécharger la version LTS sur nodejs.org

**2. Installer les dépendances :**
```bash
cd discord-bot
npm install
```

**3. Créer le fichier `.env`** (jamais dans le repo, à recréer manuellement) :
```
DISCORD_TOKEN=<token du bot Statisticsman>
GUILD_ID=1499528679758364744
```
> **Où trouver le token** : Tom se l'est envoyé à lui-même sur **WhatsApp**. Aller le chercher là-bas. Ne pas le regénérer sur Discord Developer Portal (ça invaliderait l'ancien).

**4. Vérifier que le bot est bien sur les serveurs.** Si besoin le réinviter :
- Discord Developer Portal → OAuth2 → URL Generator → cocher `bot` → permissions : "Voir les salons" + "Voir les anciens messages" → copier l'URL → l'ouvrir dans le navigateur.

**5. Vérifier que les Privileged Intents sont activés** :
- Discord Developer Portal → onglet Bot → Privileged Gateway Intents → activer les 3 cases (Server Members Intent, Message Content Intent, Presence Intent).

---

### Lancer une collecte

```bash
cd discord-bot
node collect.js GUILD_ID
```

- L'agrégation se lance **automatiquement** à la fin de chaque collecte
- Checkpoint par serveur : `checkpoint_GUILD_ID.json` (non commité) — reprend là où ça s'est arrêté si interrompu
- Première exécution : scan complet (peut prendre 30–60 min sur un grand serveur)
- Exécutions suivantes : incrémental depuis le dernier message connu (rapide)

**Forcer une re-agrégation sans re-collecter :**
```bash
node aggregate.js GUILD_ID
```

---

### Serveurs configurés
| ID | Nom | Statut |
|---|---|---|
| `770300375638474822` | Encore une game | ✅ Collecte initiale faite le 2026-06-25 (~66K messages) |
| `1499528679758364744` | Nardoll (Lis tes ratures) | ✅ Collecte initiale faite le 2026-06-25 |

---

### Fichiers
| Fichier | Rôle |
|---|---|
| `collect.js` | Collecte messages, sondages, membres, salons |
| `aggregate.js` | Calcule les 4 docs stats agrégés (lancé auto après collect) |
| `recollect-sondages.js` | Récupère les sondages depuis Discord avec les bons IDs (outil de récupération) |
| `cleanup-sondages.js` | Supprime les doublons de sondages avec IDs auto-générés (legacy) |
| `.env` | Token + ID serveur — **jamais commité, à recréer depuis WhatsApp** |
| `checkpoint_GUILD_ID.json` | Reprise incrémentale — **jamais commité** |

### Collections Firebase

**Raw (écrites par collect.js) :**
| Collection | Contenu |
|---|---|
| `discord_messages` | Tous les messages — ID = `${GUILD_ID}_${msg.id}` |
| `discord_sondages_bot` | Sondages natifs Discord — ID = `${GUILD_ID}_${msg.id}` |
| `discord_membres_bot` | Membres (pseudo, avatar, date d'arrivée) |
| `discord_salons_bot` | Salons (est_archive, est_prive) |
| `discord_serveurs` | Liste des serveurs |

**Agrégées (écrites par aggregate.js, lues par le site) :**
| Collection / doc | Contenu |
|---|---|
| `discord_stats_serveur/{GUILD_ID}` | Totaux + séries temporelles (msg_par_mois, msg_par_semaine, etc.) |
| `discord_stats_salons/{GUILD_ID}` | Tableau salons avec topMembres, msgParMois, byType... |
| `discord_stats_membres/{GUILD_ID}` | Tableau membres avec byType, topSalons, actif_semaine... |
| `discord_stats_interactions/{GUILD_ID}` | top_paires + conversations pré-calculées |

> **Règle absolue : toujours `fsSet` (PATCH), jamais `fsAdd` (POST)** — fsAdd génère de nouveaux IDs à chaque run et crée des doublons.

---

## Structure des fichiers

```
Mon Site/
├── index.html                   Page d'accueil publique (hero + cartes sections)
├── _redirects                   Redirections Cloudflare Pages (/club-lecture/* → /lis-tes-ratures/*)
├── _headers                     Cache headers Cloudflare Pages (no-cache JS/HTML atelier + lis-tes-ratures)
├── netlify.toml                 Config héritage (Cloudflare Pages utilisé à la place)
├── README.md                    Ce fichier
│
├── worker.js                    ★ Point d'entrée Cloudflare Worker (route /api/* → code, reste → fichiers statiques)
├── wrangler.toml                Config du Worker (nom, assets, compatibilité) — déployé via `npx wrangler deploy`
├── .assetsignore                Fichiers exclus du service public (worker.js, api/, wrangler.toml…)
├── api/
│   └── enrich.js                Logique /api/enrich — enrichissement IA d'un livre (Claude Sonnet, clé en secret serveur)
│
├── lis-tes-ratures/             ★ Club de lecture — VERSION EN PRODUCTION (DA café-bibliothèque)
│   ├── index.html               Page Accueil
│   ├── bibliotheque.html        Page Bibliothèque
│   ├── votes.html               Page Votes (scrutins archivés + vote en cours)
│   ├── vote.html                Bulletin de vote (déposer son vote)
│   ├── membres.html             Page Membres
│   ├── reunions.html            Page Réunions (+ panneau sondage de disponibilité)
│   ├── sondage-dispo.html       Page vote Framadate-style (disponibilités de date)
│   ├── statistiques.html        Page Statistiques
│   ├── commentaires.html        Page Commentaires de lecture (par livre, ?livre=ID)
│   ├── css/
│   │   └── style.css            Tous les styles (thème clair crème/terracotta, sidebar, composants)
│   └── js/
│       ├── firebase-config.js   Initialisation Firebase + export `db`
│       ├── auth.js              Auth (SHA-256, SESSION_KEY "cl_auth")
│       ├── nav.js               Sidebar (thème forcé clair, pas de toggle mode sombre)
│       ├── db.js                Toutes les fonctions Firestore (lecture + écriture)
│       ├── utils.js             Helpers partagés (formatDate, formatMois, initiales, showToast…)
│       ├── stats-helpers.js     Helpers graphiques partagés (window.SX : memberColor, lineChart…)
│       ├── accueil.js           Logique Accueil (livre du mois, suivi, frise, palmarès)
│       ├── bibliotheque.js      Logique Bibliothèque
│       ├── votes.js             Logique Votes (résultats, ?open=VOTE_ID)
│       ├── vote.js              Logique Bulletin de vote
│       ├── membres.js           Logique Membres (?open=MEMBRE_ID)
│       ├── reunions.js          Logique Réunions (?open=REUNION_ID) + sondage de disponibilité
│       ├── sondage-dispo.js     Logique page sondage de date (vote Framadate-style)
│       ├── statistiques.js      Logique Statistiques (14 panels)
│       └── commentaires.js      Logique Commentaires (?livre=ID, ?new=1)
│
├── club-lecture/                ✗ Ancienne version — NE PLUS MODIFIER (redirigée vers lis-tes-ratures/)
│   └── ...                      Conservé pour référence, accessible via _redirects → lis-tes-ratures/
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
├── atelier/
│   ├── index.html               Tableau de bord (KPIs, actions du jour, chart, TODO)
│   ├── carte.html               Carte hexagonale SVG (pan+zoom, fiches cellules)
│   ├── wiki.html                Wiki central (toutes catégories, recherche, édition)
│   ├── firebase-config.js       Initialisation Firebase, instance nommée "atelier"
│   ├── css/
│   │   └── style.css            Styles Atelier (thème ambre doré, sidebar, modaux, carte, wiki)
│   └── js/
│       ├── auth.js              Auth (SHA-256, mot de passe Odandor, clé "at_auth")
│       ├── nav.js               Sidebar Atelier (Tableau de bord / Carte / Wiki)
│       ├── db.js                Toutes les fonctions Firestore (cellules, wiki, oracles, événements, actions, TODO)
│       ├── utils.js             Helpers (formatDate, showToast, escapeHtml, pickRandom, weightedRandom)
│       ├── mots-cles.js         Base de mots clés + biomes + règles de proximité + fonctions de génération
│       ├── accueil.js           Logique dashboard (stats, actions, chart, TODO, modaux oracle/événement/révéler)
│       ├── carte.js             Carte hexagonale SVG (flat-top, cube coords, pan+zoom, modal cellule)
│       └── wiki.js              Wiki (liste, filtres, recherche, modal détail, édition, ajout)
│
└── recettes/
    └── index.html               Placeholder non lié (retiré de l'accueil public)
```

---

## Page d'accueil publique (`/`)

**`index.html` (racine)** — Page visuelle de présentation du site.

- **Hero** : pill "🔒 Accès privé", titre du site, courte description
- **5 cartes sections** en grille (`repeat(auto-fill, minmax(250px, 1fr))`, `max-width: 860px`) :
  - **Lis tes ratures** → lien `href="/lis-tes-ratures/"`, accent terracotta `#b5572d`, badge "✨ Accès libre" (mot de passe retiré)
  - **Jeux de rôle** → lien `href="/jdr/"`, accent rose `#cf6679`, badge "🔒 Mot de passe"
  - **Jeux** → lien `href="/Jeux/"`, accent indigo `#667eea`, badge "✨ Accès libre"
  - **L'Atelier** → lien `href="/atelier/"`, accent ambre `#c49a3a`, badge "🔒 Mot de passe"
  - (+ petit bouton discret en bas à droite → `/perso/`)
- **Effets hover** sur les cartes : lift, glow coloré, ligne accent en haut, flèche `→` apparaît
- Chaque carte a ses propres variables CSS `--card-accent` et `--card-glow`
- Pas de JS, pas de mot de passe — page entièrement publique et statique
- ~~Club de lecture (`/club-lecture/`)~~ : ancienne version retirée de l'accueil, redirigée via `_redirects`
- ~~Recettes~~ : carte retirée (section non lancée)

---

## Section Lis tes ratures (`/lis-tes-ratures/`) — VERSION ACTIVE

> **C'est la version en production.** Remplace `/club-lecture/` depuis juin 2026. DA "café littéraire × vieille bibliothèque" — crème `#fdf6ea`, terracotta `#b5572d`, serif Lora.

### Accès / Sécurité

- **Accès libre — mot de passe retiré** (juin 2026). Le mot de passe n'apportait qu'une sécurité de façade (vérification côté navigateur, base Firestore ouverte) ; il a été supprimé sur cette section.
- `js/auth.js` : `requireAuth()` est désormais un **no-op** (résout immédiatement). Les pages l'appellent toujours, mais aucune saisie n'est demandée.
- Les autres sections (JDR, Atelier) gardent leur propre mot de passe.
- Règles Firestore : `allow read, write: if true` (inchangé).

### Design system

- **Palette** : fond crème `#fdf6ea`, texte brun `#2c1a0e`, accent terracotta `#b5572d`, vert `#3f7a52`
- **Typo** : Lora (serif) pour les titres, Segoe UI / system-ui pour le corps
- **Thème** : uniquement clair — pas de mode sombre, pas de toggle (supprimé)
- **Variables CSS** : `--surface`, `--ink`, `--text`, `--accent`, `--border`, `--muted`, `--card`
- **Composants** : papier modal (`.paper`, `.pf-*`), sceaux conic-gradient, frise fil cousu

### Collections Firebase (projet `mon-site-e253f`)

| Collection | Description |
|---|---|
| `membres` | Membres du club (nom, date_arrivee) |
| `livres` | Livres (titre, auteur, statut : `en_proposition`/`elu`/`refuse`, progression_unite/total) |
| `votes` | Scrutins archivés (resultats, livre_elu, tour2 si 2e tour) |
| `votes_actifs` | Vote en cours (livre_ids, membre_ids, bulletins, expires_at) |
| `reunions` | Séances (notes_finales, participant_ids, lecteurs_ids, compte_rendu, lien_video) |
| `statuts_lecture` | Suivi de lecture par membre × livre (statut, page_actuelle, pages_totales) |
| `progression_lecture` | Historique horodaté des avancements (pour le graphique en courbes) |
| `commentaires_lecture` | Commentaires (livre_id, membre_id, avancement, titre, contenu) |
| `sondages_dispo` | Sondages de disponibilité de date (livre_id, jours[], cloture, ouvert, reponses{}, date_choisie) |

### Navigation — pattern `?open=ID`

Toutes les pages principales gèrent un paramètre URL `?open=ID` pour auto-ouvrir un élément spécifique au chargement. Utilisé par la frise "Notre parcours" de l'accueil :

| Page | Paramètre | Effet |
|---|---|---|
| `bibliotheque.html?open=LIVRE_ID` | Ouvre la fiche du livre |
| `membres.html?open=MEMBRE_ID` | Ouvre la fiche du membre |
| `votes.html?open=VOTE_ID` | Ouvre le détail du scrutin |
| `reunions.html?open=REUNION_ID` | Ouvre la fiche réunion |
| `commentaires.html?livre=LIVRE_ID` | Charge les commentaires du livre |
| `commentaires.html?new=1` | Ouvre directement le formulaire d'ajout |

### Pages et fonctionnalités

#### Accueil (`index.html` + `accueil.js`)
1. **Livre du mois** — livre élu le plus récent, barres de progression par membre (statuts : Pas commencé · **Livre possédé** · En cours · Terminé), boutons "Voir commentaires" / "Laisser un commentaire". **Bouton "Ajouter au suivi"** : select + bouton pour les membres sans entrée dans `statuts_lecture`. Bouton "⚙️ Configurer le suivi" → modal pour définir `progression_unite` / `progression_total` / `progression_mode` (simple ou hiérarchique par parties).
   - **Auto-fin de lecture** : si l'avancement saisi atteint le maximum du livre (`page_actuelle >= pages_totales`, ou dernier chapitre de la dernière partie en mode hiérarchique), le statut bascule automatiquement sur **Terminé** et le point de progression enregistré marque la fin (100 %) pour le graphe.
   - **Lecteur auto sur la réunion** : tout passage en **Terminé** (manuel ou auto) inscrit le membre dans `lecteurs_ids` de la réunion associée au livre (rétrocompat : initialise `lecteurs_ids` depuis les `notes_finales` si l'ancien format est rencontré). Conséquence : le livre est aussitôt compté comme « lu » dans les statistiques.
2. **Graphique d'évolution** — sparkline SVG des avancements du mois en cours (depuis `progression_lecture`). Clic → modal graphique complet.
3. **Frise "Notre parcours"** — deux variantes (Fil cousu / Carnet). Événements : arrivées membres, propositions, votes, élus, réunions. Chaque événement cliquable → navigue vers la page correspondante avec `?open=ID`. Les votes "Élu" ouvrent `votes.html?open=VOTE_ID` (pas la fiche livre).
4. **Palmarès** — top livres par note finale (moyenne `notes_finales` des réunions).

#### Bibliothèque (`bibliotheque.html` + `bibliotheque.js`)
- **Vue visuelle** (défaut) + **Vue DB** (tableau filtrable/triable)
- Statuts : `en_proposition` / `elu` / `refuse` (affiché "Éliminé")
- **Cartes propositions** : ouverture au survol **toujours active**. La façade montre le titre/couverture ; l'intérieur (page crème) montre Auteur · Genre · Pages · Proposé par · description IA.
- **Toggle « Ouvrir tous les livres »** (barre `.ai-toggle-bar` en haut de la vue visuelle, clé `localStorage ltr_bib_open_all`, OFF par défaut) : ajoute la classe `all-open` au `#prop-grid` → **tous** les livres proposés affichent leur intérieur en permanence (même animation 3D que le survol), sans avoir à les survoler un par un. Le survol reste prioritaire (passe au premier plan).
- **Ajout d'un livre** : titre + auteur uniquement requis ; genre / pages / description / ISBN (→ couverture) **remplis automatiquement par l'IA**. Voir [Enrichissement IA](#enrichissement-ia).
- **Vraies couvertures** : toggle global dans la sidebar (genériques ↔ vraies couvertures par ISBN). Voir [Couvertures réelles](#couvertures-réelles).
- **Fiche livre** : historique votes, section avancements membres (statut `termine` OU note présente dans `reunions.notes_finales`), **graphe d'évolution des lectures** (livres élus uniquement — même graphe que l'accueil, figé sur le mois d'élection), section réunion associée, lien commentaires. Bouton ✏️ : édition (dont `ISBN-13` et `URL de couverture` manuels). Unité d'avancement adaptée au `progression_unite` du livre (p./ch./par.).
- **Bouton "Copier la liste"** : format Discord prêt à coller
- `?open=LIVRE_ID` : auto-ouverture de la fiche

#### Votes (`votes.html` + `votes.js`)
- Scrutins archivés : dépouillement barres verticales, tableau émargement, détail par livre/votant
- Vote actif en cours : émargement live, compte à rebours, lien vers bulletin
- `?open=VOTE_ID` : auto-ouverture du détail

#### Bulletin de vote (`vote.html` + `vote.js`)
> ⚠️ **SYSTÈME DE VOTE AUTOMATIQUE — NE JAMAIS MODIFIER LA LOGIQUE DÉCRITE CI-DESSOUS SANS ACCORD EXPLICITE DE TOM. TOUTE MODIFICATION SILENCIEUSE EST INACCEPTABLE.**

Le système de vote est entièrement automatique, piloté par `vote.js` côté client. Voici le fonctionnement précis, à respecter scrupuleusement :

**Lancement automatique (Tour 1)**
- Au chargement de `vote.html`, si on est le **1er du mois** ET qu'il n'y a pas de vote actif ET qu'aucun vote archivé n'existe pour ce mois → `lancerVote()` est appelé automatiquement.
- Livres inclus : tous les livres avec `statut === "en_proposition"`.
- Membres inclus : tous les membres de la collection `membres`.
- Fenêtre de vote : de l'heure de premier chargement jusqu'à **23h59:59 du 1er du mois**.

**Clôture automatique (Tour 1)**
- À l'expiration (`expires_at` passé) ou quand **100% des membres ont voté** → `closeExpiredVote()` calcule les résultats.
- Score de chaque livre = **(moyenne des notes + médiane des notes) ÷ 2**.
- Livre avec le score le plus élevé (unique) → élu.
- **Égalité en tête** (≥ 2 livres avec le même score max) → lancement automatique du **2ème tour**.

**2ème tour (égalité)**
- Le document `votes_actifs` est modifié en place (champ `tour: 2`) — pas de nouveau document.
- Seuls les livres ex-æquo participent.
- Fenêtre : **2 du mois, de minuit à 23h59:59**.
- Interface : **choix unique** par radio button — plus de notes 1–5.
- Clôture : même logique (expiration ou 100% participation).
- Résultat : livre avec le plus de voix est élu. **Nouvelle égalité → tirage au sort** (`tirage_au_sort: true` enregistré).
- Un seul document sauvegardé dans `votes`, avec `tour2: { resultats, livre_elu, tirage_au_sort }`.

**Garde-fous**
- `closeExpiredVote` re-vérifie en Firestore que le document existe encore avant d'agir (protection contre double-clôture depuis deux onglets).
- `autoLancerSiNecessaire` vérifie qu'aucun vote archivé n'existe pour le mois en cours avant de lancer (protection contre re-lancement après clôture le 1er).

**Seuil d'élimination**
- Tour 1 : tout score **strictement inférieur à 3** (`< 3`) marque le livre comme `refuse` et l'affiche comme "Éliminé". Les votes archivés avec `seuil: 2.5` (avant juin 2026) utilisent leur seuil historique via `seuilVote(v)`.
- Tour 2 : pas de seuil d'élimination — seul le choix majoritaire compte.

**UI en mode "à venir"** (pas de vote actif) : aperçu des propositions, cases "déjà lu, je passe" visibles mais **disabled**.
**UI au 2ème tour** : bandeau d'explication avec barres des résultats du tour 1 (⚖️ ex-æquo / Écarté) ; formulaire radio à choix unique.

**Rappel personnel — colonne "Préc." (Tour 1 uniquement)**
- Une fois identifié, le membre voit apparaître une colonne supplémentaire à droite du tableau de notation, alimentée par `previousVote` (le vote archivé immédiatement précédent, calculé via `refreshPreviousVote()`).
- Elle rappelle la note **que ce membre précis** avait donnée à ce livre lors du vote du mois précédent, si le livre était déjà en compétition (recherche dans `resultats[].notes[moi]` du vote archivé).
- Masquée par défaut (floutée) — un interrupteur au-dessus du tableau ("Afficher mes notes du mois dernier") la révèle. Préférence mémorisée en `localStorage` (`ltr_prevNotes`), propre à l'appareil, pas partagée entre membres.
- N'apparaît pas en tour 2 (interface à choix unique, pas de notation) ni tant que le membre n'est pas identifié (donnée personnelle).

> Les fonctions clés à ne jamais altérer : `autoLancerSiNecessaire`, `closeExpiredVote`, `closeExpiredVoteTour2`, `checkAllVoted`, `triggerEarlyClose` dans `lis-tes-ratures/js/vote.js`.

#### Membres (`membres.html` + `membres.js`)
- Fiches membres (grille de "cartes de lecteur")
- Add membre / Edit membre (nom + date d'arrivée)
- Profil membre : propositions, commentaires par livre (avec unité adaptée), votes, réunions
- Lien "Voir tous les commentaires →" depuis chaque groupe de commentaires → `commentaires.html?livre=ID`
- `?open=MEMBRE_ID` : auto-ouverture du profil

#### Réunions (`reunions.html` + `reunions.js`)
- Registre des séances passées + prévues
- Fiche réunion : tampons tour de table, notes, compte rendu, vidéo, flèches liens proportionnées au texte
- Formulaire d'ajout : checklist membres **horizontale et compacte** (dot + nom sur une ligne, flex-wrap)
- `?open=REUNION_ID` : auto-ouverture de la fiche
- **Sondage de disponibilité** (panneau cahier relié à droite) : permet de choisir collectivement la date de la prochaine réunion, style Framadate.
  - Bouton "Sondage de disponibilité" (ghost violet) → overlay de création
  - **Deux modes de dates** : delta (N jours avant/après fin du mois) ou plage libre (date début + date fin)
  - **Deux modes de durée** : durée en jours ou date d'échéance
  - **Mode test (2 min)** : crée un sondage éphémère en sessionStorage, rien n'est enregistré en Firebase
  - Grille Framadate (membres × jours, ✓ dispo / ~ si besoin / ✗ pas dispo, scores calculés côté client)
  - **Auto-clôture** : si `cloture < now` au chargement, clôture automatiquement + crée/met à jour la réunion associée
  - **Tiebreaker** : en cas d'égalité de score, la date la plus proche de la fin du mois est choisie
  - **Sondage lié** : si une réunion a un `sondage_id`, un lien discret apparaît dans la fiche
  - Données stockées dans la collection `sondages_dispo`

#### Sondage de disponibilité (`sondage-dispo.html` + `sondage-dispo.js`)
- Page dédiée (DA bulletin de vote, fond crème, filet rouge gauche)
- **Section 1 — Bilan du groupe** : tableau Framadate complet avec scores et meilleure date surlignée
- **Section 2 — Identification** : dropdown pour choisir son nom (même pattern que `vote.html`)
- **Section 3 — Disponibilités** : 3 boutons par jour (✓ Dispo / ~ Si besoin / ✗ Pas dispo), meilleure date mise en avant
- **Mode test** : si un sondage test (sessionStorage `ltr_sondage_test`) est actif, les votes se sauvegardent en mémoire seulement — badge "TEST" visible dans l'en-tête et dans le sous-titre

#### Statistiques (`statistiques.html` + `statistiques.js`)
Panels répartis en 3 chapitres. Voir entrées historique 2026-06-09 pour le détail complet.
- **KPIs (4 cartes)** : un livre compte comme **lu dès qu'au moins un membre l'a terminé** (statut `termine` OU présence dans `lecteurs_ids` d'une réunion) — pas besoin de réunion passée. **Livres lus** = livres distincts lus · **Lectures cumulées** = Σ lecteurs (un livre par lecteur) · **Pages lues (cumulées membres)** = pages × nb lecteurs · **Pages lues (livres lus)** = pages des livres lus, chaque livre une fois. (La note moyenne n'est plus un KPI — voir le graphe « Note moyenne du club » plus bas.)
- **Répartition des livres** (juste sous les KPIs) : camembert/donut SVG (`renderRepartition`) montrant le **total de livres** au centre et la proportion **En proposition** (terracotta) / **Élus** (vert) / **Éliminés** (rouge), avec une **légende chiffrée** (compte + %). Classes `.sx-pie-*`.
- Tooltip histogramme "Évolution des propositions" : fond clair `var(--surface)` + texte `var(--ink)`

#### Commentaires (`commentaires.html` + `commentaires.js`)
- Par livre (`?livre=LIVRE_ID`)
- Anneau de progression CSS conic-gradient par commentaire
- Add / Edit commentaire — pas de système spoiler (tous les commentaires en contiennent, c'est voulu)

---

## Section Club de lecture (`/club-lecture/`) — ARCHIVÉE

> ⚠️ **Ancienne version.** Redirigée automatiquement vers `/lis-tes-ratures/` via `_redirects`. Ne plus modifier. Conservée dans le repo pour référence uniquement.

### Accès / Sécurité (ancienne version)

- Mot de passe partagé : **Piranèse**
- Mécanisme : `auth.js` calcule SHA-256 du mot de passe saisi, compare au hash stocké en dur dans le fichier. Si correct → `sessionStorage.setItem("cl_auth", "1")`. Chaque page appelle `await requireAuth()` avant tout.
- Pas de système de comptes/login — tout le club partage le même mot de passe.
- Les règles Firestore sont `allow read, write: if true` (accès public à la base). Le mot de passe JS empêche l'accès via le site ; les données ne sont pas sensibles.

### Sidebar (ancienne version)

- **Bouton "🏠 Accueil du site"** en bas de la sidebar, lien `href="/"`. Style `.sidebar-home-link`.
- ~~Bouton bascule de thème~~ — supprimé dans la nouvelle version (thème forcé clair)

### Pages et fonctionnalités (ancienne version)

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
  2. **Étape 2 — Notes** : tableau de **boutons radio** (1/5, 2/5, 3/5, 4/5, 5/5), une ligne par livre. Le formulaire est **toujours vide** (jamais pré-rempli, même en cas d'écrasement). Bouton "← Changer" pour revenir à l'étape 1. Chaque ligne propose une case **"Déjà lu — je passe"** : si cochée, les radios se désactivent et le livre est exclu de la soumission (non compté dans la validation, pas de note envoyée).
  - Les votes des autres membres ne sont jamais visibles dans ce formulaire.
- **Clôture automatique** : à chaque chargement de `votes.html` ou `vote.html`, si `voteActif.expires_at < now()` → calcule les résultats. Même logique si la page reste ouverte pendant l'expiration (setInterval toutes les secondes).
- **Clôture anticipée (100% participation)** : dès que le dernier membre soumet son bulletin sur `vote.html`, le vote se clôture immédiatement sans attendre l'heure limite. Même logique que l'expiration normale : détection d'égalité, lancement du tour 2 si besoin, etc. Fonctionne pour le tour 1 et le tour 2.
- **Logique des résultats (tour 1)** : le score de chaque livre est **(moyenne + médiane) ÷ 2** — réduit l'impact des notes extrêmes. Livre avec le score le plus élevé (unique) → `elu`, livres avec score **≤ 2,9** → `refuse` (seuil relevé temporairement depuis juin 2026, était 2,5). **Égalité au sommet → 2ème tour automatique** (voir ci-dessous). Votes passés non affectés.
- **Deuxième tour (égalité)** : si ≥ 2 livres ex-æquo en tête du tour 1, le document `votes_actifs` est transformé en place (champ `tour: 2`) — pas de nouveau document. Le 2ème tour expire le **2 du même mois à 23h59**. Seuls les livres ex-æquo participent. Le vote se fait par **choix unique** (un seul livre par membre, pas de notes). Le livre le plus voté est élu ; si nouvelle égalité → **tirage au sort**. À la clôture du 2ème tour, **un seul document** est sauvegardé dans `votes`, avec le champ `tour2: { resultats, livre_elu, tirage_au_sort }` en plus des résultats du tour 1.
- **UI `vote.html` au 2ème tour** : bandeau d'explication avec les résultats du tour 1 en barres colorées (⚖️ ex-æquo, Éliminé, Réserve) ; livres hors 2ème tour floutés dans la grille ; formulaire de vote = radio à choix unique (plus de notes 1–5). Légende de l'échelle affichée au-dessus du tableau tour 1 ("1 = je veux le moins lire · 5 = je veux le plus lire").
- **UI `votes.html` au 2ème tour** : une seule ligne dans la liste ; le détail affiche le graphe + tableau du tour 1 (libellé "Tour 1 — Résultats (égalité)"), puis la section tour 2 avec barres horizontales de voix et mention du tirage au sort si applicable.
- **Garde-fou anti-doublon** : `closeExpiredVote` re-vérifie en Firestore que le document `votes_actifs` existe encore avant d'agir — évite un double-enregistrement si la clôture a déjà eu lieu depuis un autre onglet.
- **Auto-ouverture** : si l'URL contient `?open=VOTE_ID`, le détail du vote s'ouvre automatiquement au chargement

#### Membres (`membres.html` + `membres.js`)
- Grille de cartes membres avec initiales, nom, date d'arrivée
- Bouton "Ajouter un membre" → modal (nom + date). Si un vote est en cours au moment de l'ajout, le nouveau membre est automatiquement inscrit dans `membre_ids` du `votes_actifs` (via `arrayUnion`) et peut voter immédiatement. Le toast confirme l'inscription ("ajouté et inscrit au vote en cours").
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
- **Liste** : date, mois correspondant, titre du livre associé (si trouvé), note finale (si disponible), « N participants · X ont fini » (`lecteurs_ids` si défini, sinon `notes_finales > 0`)
- **Ajouter / Modifier** (modal `#form-overlay`) :
  - Statut : `prevue` ou `passee`
  - Date (optionnelle) : champ date
  - Mois/Année : le livre élu de ce mois est affiché automatiquement sous le champ (`#livre-display`)
  - **Présents à la réunion** : liste de cases à cocher (`participant_ids`) — qui était là physiquement
  - **Ont lu le livre** : liste de cases à cocher (`lecteurs_ids`) — indépendant de la présence, peut inclure des membres qui ont lu seuls
  - Compte rendu : textarea libre
  - Lien vidéo : URL optionnelle
- **Fiche détail** (modal `#detail-overlay`) :
  - Métadonnées (statut, date, mois, livre, présents) + compte rendu + lien vidéo
  - **Section "📚 Ont lu le livre"** : pour chaque membre dans `lecteurs_ids`, un input note (1–10). Bouton "Ajouter un lecteur" (dropdown) → écrit dans `lecteurs_ids` Firestore. Bouton "Enregistrer les notes" → met à jour `notes_finales`. Rétrocompat : si `lecteurs_ids` est null (ancienne réunion), affiche les membres ayant une `notes_finales`.
  - Bouton "✏️ Modifier" → ouvre le formulaire en mode édition (affiche les valeurs existantes)
- **Note finale** = moyenne de `notes_finales` > 0 (inchangé). Alimente le **Palmarès** de l'accueil et la **bibliothèque** (tri + affichage).
- **Qui a fini le livre** (stats, pages cumulées, membres actifs) = **`lecteurs_ids`** en priorité. Pour les anciennes réunions sans ce champ : retombe sur `notes_finales > 0` (rétrocompatibilité).
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

Chaque graphique de distribution porte un badge coloré indiquant sa source : **bleu** = votes d'élection /5, **orange** = notes après lecture en réunion /10.

**Section "Note moyenne du club"** — 🟠 **Notes après lecture /10**. Moyenne de toutes les `notes_finales` des réunions, distribution en barres 1–10. **Sélecteur de membre** : peut afficher les notes d'un membre spécifique.

**Section "Distribution des notes de vote"** — 🔵 **Votes d'élection /5**. Même format, même sélecteur, mais sur les notes données lors des votes pour choisir le livre du mois (pas après lecture).

**Section "Participation aux votes"** — 🔵 **Votes d'élection**. Barres horizontales par membre (nb votes participés / nb votes total, en %). Taux moyen affiché en en-tête.

**Section "Membres les plus actifs"** — tableau classant les membres par score composite (`proposition×5 + réunion×3 + livre fini×3 + commentaire×1`). Colonnes : Propositions · Réunions (passées) · Livres finis · Commentaires. Podium 🥇🥈🥉 sur les 3 premiers. Formule affichée en petit sous le tableau.

**Section "Évolution dans le temps"** — 🟠 **Statuts de lecture + réunions**. Histogramme Chart.js : barres mensuelles représentant le nombre de membres ayant terminé le livre ce mois-là.

**Section "Bilan des propositions"** — deux sous-sections :
- **Tableau bilan par membre** : pour chaque proposant → nb de propositions, nb élus (N + %), nb éliminés (N + %), nb en attente, note de vote reçue moyenne 🔵 /5, note finale reçue moyenne 🟠 /10.
- **Matrice des goûts** 🔵 : tableau croisé votant × proposant. Chaque cellule = note moyenne /5 donnée par ce votant aux livres de ce proposant. Diagonale = auto-notation. Colorée en heatmap (rouge = bas, vert = haut).

**Section "Analyse des votes"** — trois sous-sections :
- **Livre le plus controversé / consensuel** 🔵 : parmi les livres ayant ≥ 3 notes de vote, celui avec la plus grande / plus petite variance (écart-type). Affiche les notes individuelles en chips colorées.
- **Corrélation vote → réunion** : scatter plot axe X = note d'élection 🔵 /5, axe Y = note finale 🟠 /10. Un point par livre. Révèle si les livres désirés sont aussi ceux appréciés après lecture.
- **Qui vote comme qui ?** 🔵 : matrice de corrélation de Pearson entre tous les paires de votants (min. 3 livres en commun). Valeur +1 = goûts identiques, -1 = goûts opposés. Heatmap rouge/vert.

**Section "Dynamiques"** — deux sous-sections :
- **Durée de vie des propositions** 🔵 : barres horizontales montrant combien de sessions de vote chaque livre a traversé avant d'être élu (vert) ou éliminé (rouge). Révèle les livres "patients".
- **Évolution des propositions dans le temps** : histogramme empilé Chart.js (une couleur par membre) montrant qui propose quand, mois par mois.

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

### Design (ancienne version)

- **Thème sombre** (défaut) : `#0f0f0f` fond, `#1a1a1a` cartes, orange `#e8a44a` accent
- **Thème clair** ("été fleuri") : lavande `#f5f0fe` fond, cartes blanches, violet foncé `#1e1540` texte, ambre `#c87800` accent
- ~~Bascule de thème~~ : supprimée dans `/lis-tes-ratures/` (thème clair uniquement)
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

## Section Atelier (`/atelier/`)

### Accès / Sécurité

- **Mot de passe** : `Odandor`
- **Mécanisme** : `atelier/js/auth.js` — SHA-256 du mot de passe saisi comparé au hash stocké en dur. Si correct → `sessionStorage.setItem("at_auth", "1")`. Chaque page appelle `await requireAuth()` avant tout rendu.
- **SESSION_KEY** : `"at_auth"` (distinct des autres sections)

### Concept général

Outil de world-building solo procédural. L'idée est de construire un univers de fiction jour après jour via trois mécaniques principales : la carte hexagonale, l'oracle, et les événements. Chaque action enrichit un wiki central qui regroupe toutes les informations de l'univers.

### Sidebar / Navigation

- Logo : ⚒️ L'Atelier · World-building solo
- Pages : Tableau de bord / La Carte / Le Wiki
- Bouton "Accueil du site" en bas
- Bascule thème (clé localStorage `"at_theme"`)
- Palette : ambre doré `#c49a3a` (accent), fond `#0c0b0a`, texte chaud `#e8e0d4`

---

### Page Tableau de bord (`index.html` + `accueil.js`)

**KPIs (4 cartes) :**
- Cellules découvertes
- Entrées dans le wiki
- Oracles tirés
- Événements générés

**Actions du jour (3 boutons) :**

1. **🗺️ Révéler une cellule** → modal inline :
   - Si aucune cellule : crée la cellule centrale (0,0)
   - Si cellules existantes : choisit aléatoirement parmi toutes les cellules adjacentes non découvertes
   - Détermine le biome via l'algorithme de proximité (voir mots-cles.js)
   - Génère 3 mots clés : 1 sensation, 1 couleur, 1 faune/civilisation selon le biome
   - L'utilisateur écrit une description → sauvegardé dans `atelier_cellules` + `atelier_wiki` (catégorie "Lieux") + `atelier_actions`

2. **🔮 Tirer un oracle** → modal inline :
   - Choisit aléatoirement un type d'oracle parmi 8 (créature, plante, personnage, faction, légende, objet, coutume, phénomène)
   - Génère 4 mots clés du pool spécifique au type
   - Bouton "🎲 Relancer" pour changer le type + mots clés
   - L'utilisateur écrit → sauvegardé dans `atelier_oracles` + `atelier_wiki` (catégorie correspondante) + `atelier_actions`

3. **⚡ Générer un événement** → modal inline :
   - Choisit aléatoirement une cellule déjà découverte
   - Choisit aléatoirement un type d'événement parmi 6 (naturel, population, conflit, découverte, politique, mystère)
   - Génère 4 mots clés du pool spécifique
   - Bouton "🎲 Relancer" pour rechoisir cellule + type
   - L'utilisateur écrit → sauvegardé dans `atelier_evenements` + cellule liée (`evenement_ids`) + `atelier_wiki` + `atelier_actions`

**Graphique d'activité :**
- Bar chart Chart.js (lazy-loaded via CDN)
- X = dates (30 derniers jours au format MM-DD)
- Y = nombre d'actions par jour
- Alimenté par la collection `atelier_actions` (champ `date_str` = ISO date du jour)

**Liste TODO :**
- Stockée dans Firestore (`atelier_todo`), initialisée automatiquement au premier chargement (`seedTodosIfEmpty()`)
- Items cochables (toggle `fait`) + supprimables + ajoutables
- Triée par ordre croissant, items faits en bas (via requête `orderBy("ordre")`)

---

### La Carte hexagonale (`carte.html` + `carte.js`)

**Système de coordonnées :**
- Hexagones flat-top (sommet plat en haut)
- Coordonnées cube (q, r, s) avec s = -q-r implicite. Stocké : q et r seulement.
- Conversion pixel : `x = size * 1.5 * q`, `y = size * √3 * (r + q/2)` avec size = 48
- 6 voisins : offsets [+1,-1], [+1,0], [-1,+1], [-1,0], [0,+1], [0,-1]

**Rendu SVG :**
- `<svg id="map-svg">` → `<g id="map-root" transform="translate(tx,ty) scale(s)">` pour pan+zoom
- Cellules découvertes : polygone coloré selon biome + emoji centré + titre court si disponible
- Cellules adjacentes non découvertes : polygone en pointillés `.hex-adjacent` (indication visuelle de l'espace disponible)
- Légende dynamique des biomes présents en bas de page

**Pan & Zoom :**
- Drag souris : met à jour `transform.tx`, `transform.ty`
- Molette : zoom centré sur le curseur
- Boutons toolbar : zoom +/-, reset (recentre sur (0,0))
- Touch mobile : drag 1 doigt = pan, 2 doigts = pinch zoom

**Fiche cellule (modal) :**
- Biome + icône + couleur spécifique
- Coordonnées (q, r), date de découverte, titre si défini
- Mots clés en chips
- Description canonique
- Liste des événements liés à cette cellule (chargés depuis `atelier_evenements` via `evenement_ids`)

---

### L'Oracle (`accueil.js`)

**8 types d'oracles :**
| ID | Label |
|----|-------|
| creature | Créer une créature ou un animal |
| plante | Créer une plante ou un élément naturel |
| personnage | Créer un personnage |
| faction | Créer une faction ou un groupe |
| legende | Créer une légende ou un mythe |
| objet | Créer un objet remarquable |
| coutume | Décrire une coutume ou une pratique culturelle |
| phenomene | Décrire un phénomène naturel ou magique |

Chaque type a ~30 mots clés dédiés dans `ORACLE_MK` de `mots-cles.js`. Le tirage génère 4 mots clés aléatoires sans remise du pool du type.

**Mapping oracle → catégorie wiki :**
`creature→Créatures`, `plante→Plantes`, `personnage→Personnages`, `faction→Factions`, `legende→Légendes`, `objet→Objets`, `coutume→Coutumes`, `phenomene→Événements`

---

### Les Événements (`accueil.js`)

**6 types d'événements :**
| ID | Label | Exemples |
|----|-------|---------|
| naturel | Événement naturel | séisme, inondation, éruption, tempête |
| population | Mouvement de population | migration, exode, colonisation, pèlerinage |
| conflit | Conflit | guerre, raid, révolte, siège |
| decouverte | Découverte | ressource, ruine, passage, créature inconnue |
| politique | Événement politique | alliance, trahison, couronnement |
| mystere | Mystérieux ou magique | apparition, malédiction, prodige, disparition |

---

### Le Wiki (`wiki.html` + `wiki.js`)

**9 catégories :** Lieux · Créatures · Plantes · Personnages · Factions · Légendes · Objets · Coutumes · Événements

**Fonctionnalités :**
- Onglets catégorie (compteur par catégorie)
- Recherche texte sur titre + contenu + mots clés
- Tri par catégorie puis par titre alphabétique
- Clic sur une entrée → modal détail (contenu, mots clés, source, dates)
- Bouton "✏️ Modifier" dans la fiche → formulaire inline (titre, catégorie, mots clés, contenu)
- Bouton "🗑️ Supprimer" avec confirmation
- Bouton "+ Ajouter une fiche" pour la saisie manuelle

**Source des fiches :**
- `cellule` : créée lors de la révélation d'une cellule
- `oracle` : créée lors d'un tirage d'oracle
- `evenement` : créée lors d'un événement
- `manuel` : ajoutée manuellement depuis le wiki

---

### Base de mots clés (`mots-cles.js`)

**Pools généraux** (utilisés pour les cellules de la carte) :
- `sensations` : 40 mots (brume, silence, chaleur étouffante…)
- `couleurs` : 40 mots (ocre, ardoise, obsidienne…)
- `faune` : 35 mots (migration, terrier, prédateur…) — utilisé pour biomes naturels
- `civilisation` : 35 mots (fondation, abandon, gravure…) — utilisé pour biomes civils
- `emotions` : 30 mots
- `dynamiques` : 30 mots

**Pools oracles** (`ORACLE_MK`) : ~30 mots par type d'oracle

**Pools événements** (`EVENEMENT_MK`) : ~20 mots par type d'événement

**Génération cellule** : 1 sensation + 1 couleur + 1 faune (biome naturel) ou civilisation (biome civil)

---

### Algorithme de biomes

**25 biomes disponibles :** forêt dense, forêt clairsemée, plaine, montagne, haute montagne, colline, désert, toundra, marais, côte, mer peu profonde, océan, île, jungle, volcan, ruines, village, ville, forteresse, temple, mine, route commerciale, col de montagne, grotte, delta fluvial

**Règles de proximité (`BIOME_WEIGHTS` dans `mots-cles.js`) :**
- Chaque biome a un dictionnaire de poids vers les autres biomes
- Clé `_default` = poids de base pour les biomes non listés
- Lors de la révélation d'une cellule : on récupère les biomes des voisins déjà découverts, on moyenne leurs dictionnaires de poids, on tire au sort
- **Contrainte civile** : si aucun voisin naturel, les biomes civils (village, ville, forteresse, temple, mine) ont leur poids réduit à 0.1

**Biomes naturels :** forêt dense, forêt clairsemée, plaine, montagne, haute montagne, colline, désert, toundra, marais, côte, mer peu profonde, océan, île, jungle, volcan, delta fluvial

**Biomes civils :** village, ville, forteresse, temple, mine

**Première cellule (0,0,0)** : biome naturel tiré aléatoirement (pas de voisins → pas de contrainte)

---

### Design

- **Thème sombre** (défaut) : fond `#0c0b0a`, cartes `#161410`, ambre `#c49a3a`
- **Thème clair** : parchemin `#faf7f0`, fond cartes `#ffffff`, ambre foncé `#a07828`
- Même structure sidebar que les autres sections
- Bascule thème en bas de sidebar (clé localStorage `"at_theme"`)

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
| `progression_mode` | string \| null | `'simple'` (défaut) ou `'hierarchique'` |
| `progression_parties` | array (number) \| null | Nb de chapitres par partie, ex : `[5, 8, 6]` — mode hiérarchique uniquement |
| `progression_unite` | string \| null | Unité de suivi (ex: `pages`, `chapitres`) — mode simple |
| `progression_total` | number \| null | Total de l'unité (ex: `300`) — calculé automatiquement en mode hiérarchique |
| `nb_pages` | number \| null | Nombre de pages du livre (optionnel, fourni par IA, à vérifier quand le livre est élu) |
| `genre` | string \| null | Genre littéraire (optionnel, fourni par IA) |
| `description_3_mots` | string \| null | Description en 3 mots (optionnel, fourni par IA) |
| `couverture_url` | string \| null | **Override manuel** : URL de couverture collée à la main. Prioritaire **si `couv_manuelle === true`** (quelle que soit la source, y compris Open Library/Google). Vide/null = couverture auto. |
| `couv_manuelle` | boolean \| null | `true` si `couverture_url` est une vraie saisie manuelle (posé par le formulaire d'édition). Distingue un override manuel d'une ancienne valeur auto legacy. |
| `couv_cache` | string \| null | **Couverture auto** mise en cache (`""` = cherché sans résultat). Recalculée par `covers.js` (ISBN validé puis recherche floue validée). Séparée de `couverture_url` pour qu'un changement d'ISBN relance le calcul. |
| `couv_v` | number \| null | Version de l'algo (`SEARCH_V`). `couv_v < SEARCH_V` → re-résolution. Mis à `null` à l'édition d'une fiche pour forcer le recalcul. |
| `isbn13` | string \| null | ISBN-13 (13 chiffres) fourni par l'enrichissement IA. Sert à récupérer la couverture **exacte** (`covers.openlibrary.org/b/isbn/{isbn}-L.jpg`) avant la recherche floue. Voir [Enrichissement IA](#enrichissement-ia) |

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
| `participant_ids` | array | IDs des membres présents à la réunion |
| `lecteurs_ids` | array | IDs des membres ayant lu le livre (indépendant de la présence) |
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

#### `atelier_cellules`
| Champ | Type | Description |
|-------|------|-------------|
| `q` | number | Coordonnée cube q (flat-top) |
| `r` | number | Coordonnée cube r (s = -q-r implicite) |
| `biome` | string | Biome de la cellule (ex: `forêt dense`) |
| `mots_cles` | array (string) | 3 mots clés générés à la révélation |
| `titre` | string \| null | Nom du lieu (optionnel, saisi par l'utilisateur) |
| `description` | string | Texte canonique décrivant la cellule |
| `date_decouverte` | Timestamp | Date de révélation |
| `evenement_ids` | array (string) | IDs des événements survenus sur cette cellule |

#### `atelier_wiki`
| Champ | Type | Description |
|-------|------|-------------|
| `categorie` | string | Lieux · Créatures · Plantes · Personnages · Factions · Légendes · Objets · Coutumes · Événements |
| `titre` | string | Titre de la fiche |
| `mots_cles` | array (string) | Mots clés associés |
| `contenu` | string | Corps de la fiche (texte libre) |
| `source_type` | string | `cellule` · `oracle` · `evenement` · `manuel` |
| `source_id` | string \| null | ID du document source (cellule, oracle ou événement) |
| `cellule_id` | string \| null | ID de la cellule si catégorie = Lieux |
| `cree_le` | Timestamp | Création |
| `mis_a_jour` | Timestamp | Dernière modification |

#### `atelier_oracles`
| Champ | Type | Description |
|-------|------|-------------|
| `type_id` | string | `creature` · `plante` · `personnage` · `faction` · `legende` · `objet` · `coutume` · `phenomene` |
| `type_label` | string | Label lisible du type |
| `mots_cles` | array (string) | Mots clés tirés |
| `wiki_id` | string \| null | ID de la fiche wiki créée |
| `cree_le` | Timestamp | Création |

#### `atelier_evenements`
| Champ | Type | Description |
|-------|------|-------------|
| `cellule_id` | string | ID de la cellule concernée |
| `cellule_biome` | string | Biome de la cellule (dénormalisé) |
| `cellule_q` / `cellule_r` | number | Coordonnées de la cellule |
| `type_id` | string | `naturel` · `population` · `conflit` · `decouverte` · `politique` · `mystere` |
| `type_label` | string | Label lisible |
| `mots_cles` | array (string) | Mots clés tirés |
| `titre` | string \| null | Titre de l'événement |
| `description` | string | Corps de l'événement |
| `cree_le` | Timestamp | Création |

#### `atelier_actions`
| Champ | Type | Description |
|-------|------|-------------|
| `type` | string | `cellule` · `oracle` · `evenement` |
| `details` | string | Description lisible de l'action |
| `ref_id` | string \| null | ID du document créé |
| `date_str` | string | Date ISO `YYYY-MM-DD` (pour le regroupement dans le chart) |
| `timestamp` | Timestamp | Horodatage précis |

#### `atelier_todo`
| Champ | Type | Description |
|-------|------|-------------|
| `texte` | string | Texte de la tâche |
| `fait` | boolean | Cochée ou non |
| `ordre` | number | Ordre d'affichage |
| `cree_le` | Timestamp | Création |

> Les TODO sont initialisés automatiquement au premier chargement de `accueil.js` via `seedTodosIfEmpty()` si la collection est vide.

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
| Atelier — Tableau de bord | `/atelier/` |
| Atelier — La Carte | `/atelier/carte.html` |
| Atelier — Le Wiki | `/atelier/wiki.html` |

---

## Décisions de conception importantes

- **Pas de système de login individuel** — tout le club partage un mot de passe unique. Les noms des membres sont sélectionnés dans des listes déroulantes.
- **Pas d'index Firestore composites** — tous les tris se font en JS après récupération complète des collections. Évite les erreurs d'index manquants.
- **"Refusé" ne s'affiche jamais** — le terme affiché partout est "Éliminé". La valeur stockée en base reste `"refuse"` (ne pas changer la valeur Firestore).
- **Notes sur 5 — fixe** — l'échelle de vote est toujours /5, sans possibilité de la modifier lors du lancement. La saisie se fait via boutons radio (1/5 à 5/5), pas de champ numérique libre. La détection de l'échelle (5 ou 10) reste automatique dans les graphes de résultats (pour les anciens votes).
- **Score (moy+méd)÷2** — depuis juin 2026, le score de chaque livre est calculé comme `(moyenne des notes + médiane des notes) / 2`. Réduit l'impact des notes extrêmes (vote stratégique) par rapport à la moyenne seule, sans le problème d'égalités massives de la médiane pure. Stocké dans le champ `moyenne` du document Firestore pour rétrocompatibilité avec l'affichage existant.
- **Seuil d'élimination : 3** — relevé de 2,5 à 2,9 (juin 2026) puis à 3 (juillet 2026). Sémantique : score **strictement inférieur à 3** (`< 3`) → `refuse`. S'applique uniquement aux votes futurs — votes passés conservent leur seuil historique via `seuilVote(v)`.
- **"Déjà lu — je passe"** — case à cocher optionnelle par livre dans le tableau de vote. Exclut ce livre de la soumission du votant. Le score du livre est calculé uniquement sur les membres ne l'ayant pas encore lu, évitant l'influence des lectures passées (désir de relire ou de ne pas relire).
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

## Décisions de conception — Atelier

- **Actions sans limite journalière stricte** — Le système est conçu pour un usage quotidien (une cellule / un oracle / un événement par jour) mais ne bloque pas techniquement les actions supplémentaires. La discipline reste côté utilisateur.
- **Carte virtuellement infinie** — Le système de coordonnées cube permet une grille sans limite fixe. Les cellules sont simplement stockées par (q, r) ; la carte s'étend dans toutes les directions.
- **Première cellule en (0, 0)** — La cellule centrale est toujours placée aux coordonnées (0, 0). Le biome est tiré aléatoirement parmi les biomes naturels (sans contrainte de voisinage).
- **Biome déterminé à la révélation** — Le biome d'une nouvelle cellule est calculé côté client au moment de la révélation (pas stocké en avance). L'utilisateur ne voit le biome qu'une fois le modal ouvert.
- **Wiki alimenté automatiquement** — Chaque action (révélation, oracle, événement) crée automatiquement une fiche dans le wiki. L'utilisateur peut toujours l'éditer ou la supprimer manuellement depuis le wiki.
- **Événements liés à la cellule** — Les événements sont stockés dans leur propre collection `atelier_evenements` ET leur ID est ajouté au tableau `evenement_ids` de la cellule concernée. Pas de jointure requise pour afficher les événements d'une cellule.
- **Données dénormalisées pour les événements** — `cellule_biome`, `cellule_q`, `cellule_r` sont copiés sur chaque événement pour éviter une lecture Firestore supplémentaire lors de l'affichage dans les listes.
- **Pas de chart interactif de zoom** — Bar chart adaptatif : plage X = du premier jour d'activité à aujourd'hui, minimum 7 jours. Chart.js chargé via `<script>` UMD classique dans le HTML (pas de `import()` dynamique qui ne fonctionne pas avec les bundles UMD). Instance trackée dans `_chartInstance` pour pouvoir détruire/recréer sans erreur.
- **TODO en Firestore** — Les TODO sont persistés en Firestore (pas localStorage) pour être accessibles depuis n'importe quel appareil. Ils sont seedés automatiquement si la collection est vide.
- **Compteur journalier en localStorage** — Le compteur d'actions du jour (`at_daily_YYYY-MM-DD`) est stocké en localStorage, pas en Firestore. C'est synchrone (rendu instantané avant toute réponse Firebase) et s'auto-remet à zéro chaque nouveau jour via la clé datée. Bouton `+1` pour ajouter une action disponible (utile en phase de test).
- **Top-level `await` et Temporal Dead Zone** — Tous les `const` utilisés dans des fonctions appelées pendant le bloc d'initialisation (qui contient des `await`) doivent être déclarés AVANT le premier `await`. Les `const` déclarés après un `await` sont dans la TDZ au moment de leur utilisation.
- **Modules versionnés** — Les imports dans `wiki.js` et `accueil.js` incluent `?v=N` pour contourner le cache navigateur des modules transversaux. Le fichier `_headers` à la racine force `Cache-Control: no-cache` sur tous les JS de l'atelier.
- **Suppression en cascade** — Supprimer une fiche wiki supprime toujours le document source correspondant ET les entrées du journal d'actions associées (`ref_id === source_id`). Pour les événements, retire aussi l'ID de `evenement_ids` sur la cellule concernée.
- **Zone de test** — Section "🧪 Zone de test" en bas du tableau de bord : boutons de suppression par collection + reset de la limite du jour. À retirer une fois le paramétrage de l'univers terminé.

---

## Couvertures réelles

Toggle **« Vraies couvertures »** en bas de la sidebar (`nav.js`) — bascule entre les illustrations génériques (dégradés colorés) et les vraies couvertures des livres récupérées en ligne. Stocké en **`sessionStorage`** clé `ltr_covers`, **ACTIVÉ par défaut à chaque connexion** : `coversOn()` renvoie vrai sauf `"0"` explicite. L'utilisateur peut désactiver — son choix tient pendant toute la visite (navigation entre pages comprise) puis se réinitialise sur ON à la prochaine session/onglet. (Avant juin 2026 : `localStorage`, OFF par défaut.)

- **Module `js/covers.js`** : `coversOn()`, `setCovers()`, `resolveCover(livre)`, `hydrateCover(el, livre)`.
- **Sources** (gratuites, sans clé, CORS ouvert) : recherche en **cascade de stratégies**, première qui aboutit retenue —
  1. Open Library titre + auteur (`openlibrary.org/search.json`, 5 résultats, premier avec `cover_i` → `covers.openlibrary.org/b/id/{id}-L.jpg`)
  2. Google Books ciblé (`intitle:… inauthor:…`)
  3. Google Books requête souple (`titre auteur`) — capte les éditions traduites
  4. Open Library titre seul
  Google Books : `imageLinks.thumbnail`, `&zoom=2` pour un cran de résolution. Pas de traduction auto FR↔EN (pas d'API fiable gratuite).
- **Aucune image stockée** : seule l'URL trouvée est mémorisée dans `livres.couverture_url` (cache Firestore) pour ne pas réinterroger les API et permettre une correction manuelle. `livres.couv_v` mémorise la version de l'algo : bumper `SEARCH_V` relance la recherche sur les livres restés sans couverture, sans retoucher les couvertures déjà trouvées ni les URL manuelles.
- **Surfaces couvertes** : cartes propositions (`.bk-face`), cartes éliminés (`.elim-card`), livre du mois de l'accueil (`.lm-cover`), **podium accueil** (`.pp-cover`), **tranches des livres élus** (`.bib-elu-cover`, vignette ajoutée quand le toggle est ON), **registre des scrutins** page Votes (`.scrutin-cover`), **livres proposés** dans les fiches membres (`.rf-prop-cover`), **fiches réunions** (`.mtg-cover`), et fiches détail (`.fiche-cover` — accueil + bibliothèque). Chaque page écoute `ltr-covers-change` pour ré-hydrater / retirer les couvertures (`removeAllCovers`). La couverture est superposée via `<div class="real-cover">` (fond flou de l'image + `<img class="real-cover-img">` en `object-fit: contain` → couverture **entière**, jamais rognée, sans bandes vides ; fondu au chargement). Si aucune couverture n'est trouvée, l'illustration générique reste affichée. **La liste des élus reste en métaphore « tranches de livres »** (non couverte).
- **Correction manuelle** : champ « URL de couverture (manuel) » dans le formulaire d'édition d'un livre (bibliothèque). Vide = recherche auto réactivée.
- **Re-render** : chaque page écoute l'événement `ltr-covers-change` (dispatché par le toggle) pour rafraîchir ses couvertures sans rechargement.
- **Note** : le matching titre+auteur n'est pas fiable à 100 % (édition rare, livre peu connu) → repli générique + correction manuelle possible.

---

## Enrichissement IA

Au moment d'ajouter un livre (et via le bouton **« Enrichir la bibliothèque »** pour le rattrapage des livres existants), une IA complète automatiquement les infos manquantes (genre, nombre de pages, description en 3 mots) **et** fournit l'**ISBN-13**, qui sert à récupérer la vraie couverture de façon exacte.

### Architecture — Cloudflare Worker

> ⚠️ **Le site est déployé comme un Cloudflare *Worker* (Worker + fichiers statiques), pas comme un projet *Pages*.** Domaine `nardoll.monsiteinternet.workers.dev`, déploiement via `npx wrangler deploy` (connecté au repo GitHub). La convention Pages `functions/` n'est donc **pas** détectée — il faut un vrai point d'entrée Worker.

Le site est statique : **impossible de mettre la clé API Claude dans le JS du navigateur** (elle serait publique). La clé vit côté serveur dans le Worker.

- **`worker.js`** (racine) — point d'entrée. Route `/api/enrich` vers `handleEnrich()`, délègue tout le reste aux fichiers statiques via `env.ASSETS.fetch()`.
- **`api/enrich.js`** — `handleEnrich(request, env)` : appelle l'API Claude (`claude-sonnet-4-6` — fiable sur l'identification ; Haiku confondait des livres) en sortie structurée (`output_config.format` json_schema) et renvoie `{ trouve, titre_exact, auteur_exact, annee, genre, nb_pages, description_3_mots, isbn13 }`.
- **`wrangler.toml`** — config du Worker : `name = "nardoll"`, `main = "worker.js"`, binding `[assets] directory = "./"`. **`.assetsignore`** exclut `worker.js`/`api/`/`wrangler.toml` du service public.
- **Secret Cloudflare `ANTHROPIC_API_KEY`** : à définir dans le dashboard (Worker → Settings → Variables et secrets, en « Encrypt »). La section se débloque une fois que le Worker n'est plus « statique seul » (c.-à-d. après déploiement de `worker.js`). Si le secret manque, `/api/enrich` renvoie une erreur 503 propre sans casser le site.
- **Coût** : Sonnet 4.6 ≈ 3 $/M tokens entrée, 15 $/M sortie → ~0,003–0,008 $ par livre. Un plafond de dépense est réglable côté console Anthropic.
- **Garde-fous** : consigne stricte « n'invente jamais un ISBN » ; l'ISBN est de toute façon validé côté client par chargement réel de l'image (`covers.js` → `imageOk`) avant d'être retenu — sinon repli sur la recherche floue puis l'illustration générique. Genre/pages/description restent marqués « fournis par IA ».

### Côté client

- **Ajout d'un livre** (`bibliotheque.js`, `fetchEnrichment()`) : le formulaire ne demande que **titre / auteur / année / proposé par**. Le **genre, le nombre de pages, la description en 3 mots et l'ISBN (→ couverture)** sont **toujours** remplis par l'IA à la soumission (validés par `plausibleMatch`). Pas de saisie manuelle de ces champs à la création.
- **Correction manuelle** : tout reste modifiable ensuite via la fiche (bouton ✏️), y compris les champs `ISBN-13` et `URL de couverture`.

> Le bouton « Enrichir la bibliothèque » (panneau de rattrapage des livres existants) a été retiré une fois la base nettoyée — l'enrichissement se fait désormais uniquement à l'ajout.

---

## Historique des modifications

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
