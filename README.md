# Mon Site — Documentation Claude Code

> Ce fichier est le point d'entrée pour toute nouvelle session Claude Code. Il contient tout le contexte nécessaire pour reprendre le travail sans aucune explication de l'utilisateur.

---

## ⚠️ Notes importantes pour Claude Code

> **Push sans confirmation.** Tom a demandé de pusher directement après chaque modification, sans demander son feu vert.
>
> ⚠️ **DÉPLOIEMENT — NE JAMAIS ÉCRIRE LE CONTRAIRE DE CETTE LIGNE, MÊME AILLEURS DANS CE FICHIER.** Le site est hébergé sur **Cloudflare Worker**. Le déploiement est **automatique après chaque push** sur `main` — **pas besoin de `npx wrangler deploy` manuellement**, ça a toujours été le cas. Si un autre passage de ce README semble dire "manuel" ou "pas automatique", **c'est faux et obsolète** : corrige-le immédiatement au lieu de le croire. Cette confusion a déjà induit Claude en erreur plusieurs fois (a fait croire à Tom que rien n'était en ligne) — ne pas répéter cette erreur.

> **Mettre à jour ce README à chaque modification significative.** À la fin de chaque session de développement, Claude doit documenter les changements effectués dans la section "Historique des modifications" ci-dessous. C'est une consigne permanente à appliquer sans que Tom ait besoin de le rappeler.

---

## 🚧 Prochain gros chantier — version téléphone

> **À reprendre en priorité à la prochaine session.** Le prochain grand chantier est l'**affichage mobile / version téléphone du site** : plusieurs ajustements responsive sont à faire (mise en page, tailles, éléments qui débordent ou mal adaptés sur petit écran). Claude doit le rappeler à Tom quand on reprend le travail. (Noté le 2026-06-18.)

---

## Contexte général

Site **personnel et privé** de Tom. Multi-sections indépendantes. La page d'accueil (`/`) présente le site et ses différentes sections avec des cartes visuelles. Certaines sections sont protégées par un mot de passe, d'autres sont en accès libre.

**Sections existantes :**
- `/lis-tes-ratures/` — Club de lecture, **version en production** (remplace `/club-lecture/`) — fonctionnel, DA "café littéraire × vieille bibliothèque", **accès libre**
- `/club-lecture/` — Ancienne version du club de lecture, **redirigée automatiquement** vers `/lis-tes-ratures/` via `_redirects` (301). Dossier conservé dans le repo.
- `/jdr/` — Archives des projets JDR, outils MJ et **campagnes** (wiki, quêtes, journal) — protégée par mot de passe
- `/Jeux/` — Section jeux en ligne, **accès libre** (pas de mot de passe)
- `/pronostics/` — Pronostics e-sport LoL entre amis (MSI, Worlds…) — **accès par profil** (pas de mot de passe), voir [Section Pronostics](#section-pronostics-pronostics)
- `/data-discord/` — Stats et archives du serveur Discord (sondages, membres, salons, interactions) — alimentée par le [bot Discord](#bot-discord-discord-bot)
- `/atelier/` — Outil de world-building solo procédural, en développement actif
- `/perso/` — Espace personnel de Tom (suivi des migraines ophtalmiques) — mot de passe, lié par un bouton discret sur l'accueil
- `/recettes/` — Supprimée de l'accueil public (dossier conservé mais non lié)

---

## Stack technique

| Élément | Choix |
|---------|-------|
| Langages | HTML / CSS / JS vanilla uniquement |
| Framework | Aucun — pas de React, Vue, bundler, ni npm |
| Base de données | Firebase Firestore v10.12.2 via CDN (ES modules natifs) |
| Hébergement | Cloudflare **Worker** (Worker + fichiers statiques) — déploiement **automatique à chaque push sur `main`**. Domaine `nardoll.monsiteinternet.workers.dev`. Voir [Enrichissement IA](#enrichissement-ia) |
| Repo GitHub | `https://github.com/Nardoll/mon-site` (branche `main`) |

**Contrainte importante :** ES modules natifs dans le navigateur. Ça fonctionne en HTTPS (site en ligne) ou via l'extension Live Server de VS Code. Pas de `file://`.

**Workflow :**
1. Modifier les fichiers dans VS Code
2. `git add` + `git commit` + `git push` sur `main`
3. Déploiement Cloudflare automatique — rien d'autre à faire

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
├── index.html                   Page d'accueil publique (hero + 6 cartes sections + bouton perso)
├── _redirects                   Redirections servies par les assets du Worker (/club-lecture/* → /lis-tes-ratures/*)
├── _headers                     Cache headers assets (no-cache JS/HTML atelier + lis-tes-ratures)
├── README.md                    Ce fichier
├── HISTORIQUE.md                Historique détaillé des modifications (sessions passées)
│
├── worker.js                    ★ Point d'entrée Cloudflare Worker (routes /api/* + no-cache HTML/JS/CSS, reste → fichiers statiques)
├── wrangler.toml                Config du Worker (nom, assets, compatibilité) — déploiement AUTOMATIQUE au push sur main
├── .assetsignore                Fichiers exclus du service public (worker.js, api/, wrangler.toml…)
├── api/
│   └── enrich.js                Logique /api/enrich — enrichissement IA d'un livre (Claude Sonnet, clé en secret serveur)
│
├── lis-tes-ratures/             ★ Club de lecture — VERSION EN PRODUCTION (DA café-bibliothèque)
│   ├── index.html               Page Accueil
│   ├── bibliotheque.html        Page Bibliothèque
│   ├── votes.html               Page Votes (scrutins archivés + vote en cours)
│   ├── vote.html                Bulletin de vote (déposer son vote)
│   ├── voteadmin.html           Bulletin de vote — vue admin (bouton "Clôturer maintenant"), même js/vote.js
│   ├── membres.html             Page Membres
│   ├── reunions.html            Page Réunions (+ panneau sondage de disponibilité)
│   ├── sondage-dispo.html       Page vote Framadate-style (disponibilités de date)
│   ├── statistiques.html        Page Statistiques
│   ├── commentaires.html        Page Commentaires de lecture (par livre, ?livre=ID)
│   ├── chantier.html            Outil d'analyse des seuils de vote (lien direct uniquement, pas dans le menu)
│   ├── stabilisation.html       Outil de projection du nb de livres en compétition (lien direct uniquement)
│   ├── exposes/1984/index.html  Exposé HTML standalone (Dorian, 1984/Orwell)
│   ├── babelio.png              Logo Babelio (liens fiches livres)
│   ├── css/
│   │   ├── style.css            Tous les styles (thème clair crème/terracotta, sidebar, composants)
│   │   └── stats.css            Styles de la page Statistiques
│   └── js/
│       ├── firebase-config.js   Initialisation Firebase + export `db`
│       ├── auth.js              ⚠️ No-op — accès libre, mot de passe retiré (juin 2026)
│       ├── nav.js               Sidebar (thème forcé clair) + toggle « Vraies couvertures »
│       ├── db.js                Toutes les fonctions Firestore (lecture + écriture)
│       ├── utils.js             Helpers partagés (formatDate, prochainScrutin, computeInactivite, showToast…)
│       ├── stats-helpers.js     Helpers graphiques partagés (window.SX : memberColor, lineChart…)
│       ├── covers.js            Vraies couvertures (Open Library / Google Books, cache couv_cache)
│       ├── progression-chart.js Graphe d'évolution des lectures (Hermite monotone)
│       ├── accueil.js           Logique Accueil (livre du mois, suivi, frise, palmarès)
│       ├── bibliotheque.js      Logique Bibliothèque
│       ├── votes.js             Logique Votes (résultats, ?open=VOTE_ID)
│       ├── vote.js              Logique Bulletin de vote (⚠️ système auto — voir section Votes)
│       ├── membres.js           Logique Membres (?open=MEMBRE_ID)
│       ├── reunions.js          Logique Réunions (?open=REUNION_ID) + sondage de disponibilité
│       ├── sondage-dispo.js     Logique page sondage de date (vote Framadate-style)
│       ├── statistiques.js      Logique Statistiques (14 panels)
│       ├── commentaires.js      Logique Commentaires (?livre=ID, ?new=1)
│       ├── chantier.js          Logique outil chantier vote
│       └── stabilisation.js     Logique outil stabilisation (Monte-Carlo, seuils)
│
├── club-lecture/                ✗ Ancienne version — NE PLUS MODIFIER (redirigée vers lis-tes-ratures/)
│   └── ...                      Conservé pour référence, accessible via _redirects → lis-tes-ratures/
│
├── jdr/
│   ├── index.html               Page d'accueil JDR (bienvenue + liens Archives/Outils)
│   ├── archives.html            Base de données des projets JDR (filtres, tri, 5 vues : cartes/tableau/stats/chrono/recette)
│   ├── outils.html              Liste des outils MJ (4 outils intégrés)
│   ├── campagne.html            Page d'une campagne (wiki, quêtes, arcs, journal, carte, chrono)
│   ├── wiki-page.html           Page d'une fiche wiki/quête de campagne (?camp=ID&type=&id=)
│   ├── firebase-config.js       Initialisation Firebase + export `db` (même projet mon-site-e253f)
│   ├── css/
│   │   └── style.css            Tous les styles JDR (palette vert/rouge, sidebar, Archives, multi-select…)
│   ├── js/
│   │   ├── auth.js              Auth JDR (SHA-256, sessionStorage, SESSION_KEY "jdr_auth")
│   │   ├── nav.js               Sidebar JDR + thème (localStorage "jdr_theme") + liste dynamique des campagnes
│   │   ├── archives.js          Logique page Archives (Firestore, multi-select, formulaire, détail)
│   │   ├── stats.js             Vue Statistiques — Chart.js, KPIs, toggle charts, hauteurs dynamiques
│   │   ├── chrono.js            Vue Chronologie — frise verticale Gantt, lanes auto, noms sur barres
│   │   ├── recette.js           Vue Recette magique — corrélations satisfaction/facteurs
│   │   ├── campagne.js          Logique page Campagne (wiki, quêtes, arcs, journal…)
│   │   └── wiki-page.js         Logique page fiche wiki/quête
│   └── Outils/
│       ├── generateur-pnj-makryon_1.html     Générateur PNJ — Les Enfants de Makryon
│       ├── tribunal-dragons-outils_1.html    Outils MJ — Le Tribunal des Dragons (3 onglets)
│       ├── paradoxe_temporel_4.html          Roue du Paradoxe — Chroniques d'Aria
│       └── roue-personnalisable_1.html       Roue personnalisable (segments édités, localStorage)
│
├── Jeux/
│   ├── index.html               Page d'accueil de la section Jeux (liste des jeux)
│   ├── jeu-de-mots.html         Jeu de mots multijoueur (avec noms de joueurs + historique partagé)
│   ├── firebase-config.js       Initialisation Firebase + export `db` (même projet mon-site-e253f)
│   ├── css/
│   │   └── style.css            Styles Jeux (thème indigo #667eea, header simple, cartes jeux)
│   ├── jeu_mots_4.html          Version locale 2 joueurs (conservée, non liée)
│   └── jeu_mots_multi_1.html    Version originale locale (conservée, non liée)
│
├── pronostics/                  Pronostics e-sport LoL — voir section dédiée
│   ├── index.html               Accueil (liste des tournois)
│   ├── tournoi.html             Page tournoi (?id= ; calendrier, bracket, classement, mode ?admin)
│   ├── classement.html          Classement général (tous tournois)
│   ├── seed.html                Outil d'init des tournois (usage ponctuel admin)
│   ├── seed-matches.html        Outil d'init des matchs (usage ponctuel admin)
│   ├── firebase-config.js       Initialisation Firebase + export `db`
│   ├── css/
│   │   └── style.css            Styles Pronostics (DA Hextech sombre or/bleu, sidebar 210px)
│   └── js/
│       ├── auth.js              Profils localStorage (pas de mot de passe) — requireProfile()
│       ├── nav.js               injectSidebar + injectTopBar
│       ├── db.js                Fonctions Firestore (tournois, matchs, picks, scoring, classement)
│       ├── accueil.js           Logique accueil
│       ├── tournoi.js           Logique tournoi (calendrier, bracket, drawer picks, admin)
│       └── classement.js        Logique classement général (+ détail par joueur)
│
├── data-discord/                Stats du serveur Discord (données du bot discord-bot/)
│   ├── index.html               Choix du serveur
│   ├── dashboard.html           Vue d'ensemble (?id=GUILD_ID)
│   ├── membres.html             Stats par membre
│   ├── salons.html              Stats par salon
│   ├── interactions.html        Paires de membres qui interagissent
│   ├── graphe.html              Représentation graphique des interactions
│   ├── sondages.html            Archives des sondages
│   ├── stats.html               Statistiques diverses
│   ├── firebase-config.js       Initialisation Firebase + export `db`
│   └── nav.js                   Sidebar commune (liste des serveurs + pages)
│
├── atelier/
│   ├── index.html               Tableau de bord (KPIs, actions du jour, chart, TODO, zone de test)
│   ├── carte.html               Carte hexagonale SVG (pan+zoom, fiches cellules)
│   ├── carte-info.html          Règles de génération de la carte (doc intégrée)
│   ├── wiki.html                Wiki central (toutes catégories, recherche, édition)
│   ├── firebase-config.js       Initialisation Firebase, instance nommée "atelier"
│   ├── css/
│   │   └── style.css            Styles Atelier (thème ambre doré, sidebar, modaux, carte, wiki)
│   └── js/
│       ├── auth.js              Auth (SHA-256, mot de passe Odandor, clé "at_auth")
│       ├── nav.js               Sidebar Atelier (Tableau de bord / Carte / Wiki)
│       ├── db.js                Toutes les fonctions Firestore (cellules, wiki, oracles, événements, actions, TODO)
│       ├── utils.js             Helpers (formatDate, showToast, escapeHtml, pickRandom, weightedRandom)
│       ├── mots-cles.js         Base de mots clés + biomes + règles de proximité
│       ├── generation.js        Fonctions de génération (biomes, mots clés)
│       ├── accueil.js           Logique dashboard (stats, actions, chart, TODO, modaux oracle/événement/révéler)
│       ├── carte.js             Carte hexagonale SVG (flat-top, cube coords, pan+zoom, modal cellule)
│       └── wiki.js              Wiki (liste, filtres, recherche, modal détail, édition, ajout)
│
├── perso/                       Espace personnel de Tom (mot de passe)
│   ├── index.html               Accueil espace perso
│   ├── migraines.html           Suivi des migraines ophtalmiques
│   ├── firebase-config.js       Initialisation Firebase + export `db`
│   ├── css/style.css            Styles perso
│   └── js/                      auth.js (SHA-256, clé "perso_auth"), nav.js, db.js, utils.js, accueil.js, migraines.js
│
├── discord-bot/                 Scripts Node.js de collecte Discord → Firebase (voir section Bot Discord)
│
└── recettes/
    └── index.html               Placeholder non lié (retiré de l'accueil public)
```

---

## Page d'accueil publique (`/`)

**`index.html` (racine)** — Page visuelle de présentation du site.

- **Hero** : pill "🔒 Accès privé", titre du site, courte description
- **6 cartes sections** en grille (`repeat(auto-fill, minmax(250px, 1fr))`, `max-width: 860px`) :
  - **Lis tes ratures** → lien `href="/lis-tes-ratures/"`, DA café-bibliothèque (fond crème, tranche terracotta), badge "✨ Accès libre" (mot de passe retiré)
  - **Jeux de rôle** → lien `href="/jdr/"`, accent rose `#cf6679`, badge "🔒 Mot de passe"
  - **Jeux** → lien `href="/Jeux/"`, accent indigo `#667eea`, badge "✨ Accès libre"
  - **L'Atelier** → lien `href="/atelier/"`, accent ambre `#c49a3a`, badge "🔒 Mot de passe"
  - **Pronostics** → lien `href="/pronostics/"`, DA Hextech (fond bleu nuit, or `#d8a955`, coins coupés), badge "✨ Accès libre"
  - **Data Discord** → lien `href="/data-discord/"`, DA Discord (fond bleu-violet `#5865f2`), badge "📊 Stats & archives"
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

**Calendrier (depuis juillet 2026) : le scrutin a lieu le 25 du mois et élit le livre du mois SUIVANT** (ex : vote le 25 juillet → livre d'août), pour laisser 5 jours de marge pour se procurer le livre élu. Le calcul de date est centralisé dans `prochainScrutin()` (`utils.js`) — source unique utilisée par `vote.js`, `votes.js` et `accueil.js`. *(Avant juillet 2026, le vote avait lieu le 1er du mois — si un passage de ce fichier ou de l'historique mentionne encore le « 1er », c'est l'ancien calendrier.)*

**Lancement automatique (Tour 1)**
- Au chargement de `vote.html`, si on est le **25 du mois** ET qu'il n'y a pas de vote actif ET qu'aucun vote archivé n'existe pour le **mois cible** (le mois suivant) → `lancerVote()` est appelé automatiquement.
- Le document est archivé sous `mois`/`annee` du **mois cible** (celui du livre élu), pas du mois du scrutin.
- Livres inclus : tous les livres avec `statut === "en_proposition"`.
- Membres inclus : tous les membres de la collection `membres`.
- Fenêtre de vote : de l'heure de premier chargement jusqu'à **23h59:59 du 25**.

**Clôture automatique (Tour 1)**
- À l'expiration (`expires_at` passé) ou quand **100% des membres ont voté** → `closeExpiredVote()` calcule les résultats. Les membres **inactifs** (voir `computeInactivite()` dans `utils.js`) sont ignorés pour le calcul des 100%.
- **Vote blanc** possible (« je laisse les autres décider ») : compte comme une participation, enregistré dans le champ `blancs` du vote archivé.
- Score de chaque livre = **(moyenne des notes + médiane des notes) ÷ 2**.
- Livre avec le score le plus élevé (unique) → élu.
- **Égalité en tête** (≥ 2 livres avec le même score max) → lancement automatique du **2ème tour**.

**2ème tour (égalité)**
- Le document `votes_actifs` est modifié en place (champ `tour: 2`) — pas de nouveau document.
- Seuls les livres ex-æquo participent.
- Fenêtre : **26 du mois, de minuit à 23h59:59**.
- Interface : **choix unique** par radio button — plus de notes 1–5. Vote blanc possible aussi.
- Clôture : même logique (expiration ou 100% participation).
- Résultat : livre avec le plus de voix est élu. **Nouvelle égalité → tirage au sort** (`tirage_au_sort: true` enregistré).
- Un seul document sauvegardé dans `votes`, avec `tour2: { resultats, livre_elu, tirage_au_sort }` (+ `blancs_tour1` porté à travers le 2ᵉ tour).

**Garde-fous**
- `closeExpiredVote` re-vérifie en Firestore que le document existe encore avant d'agir (protection contre double-clôture depuis deux onglets).
- `autoLancerSiNecessaire` vérifie qu'aucun vote archivé n'existe pour le mois cible avant de lancer (protection contre re-lancement après clôture le 25).

**Seuil d'élimination**
- Tour 1 : tout score **strictement inférieur à 3** (`< 3`) marque le livre comme `refuse` et l'affiche comme "Éliminé". Les votes archivés avec `seuil: 2.5` (avant juin 2026) utilisent leur seuil historique via `seuilVote(v)`.
- Tour 2 : pas de seuil d'élimination — seul le choix majoritaire compte.

**UI en mode "à venir"** (pas de vote actif) : aperçu des propositions, cases "déjà lu, je passe" visibles mais **disabled**.
**UI au 2ème tour** : bandeau d'explication avec barres des résultats du tour 1 — chaque livre est étiqueté ⚖️ ex-æquo (qualifié pour le tour 2), ❌ Éliminé (score `< SEUIL_ELIMINATION`, constante définie dans `vote.js`, actuellement 3, cohérente avec `addVote()` dans `db.js`) ou Écarté (conservé mais pas qualifié) ; formulaire radio à choix unique.

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

> ⚠️ **Ancienne version, remplacée par `/lis-tes-ratures/` en juin 2026.** Redirigée automatiquement via `_redirects` (301). **Ne plus modifier** — dossier conservé dans le repo pour référence uniquement.
>
> - Mot de passe de l'époque : **Piranèse** (`auth.js`, SHA-256, sessionStorage `cl_auth`). La nouvelle version est en accès libre.
> - La documentation détaillée de cette ancienne version a été retirée du README (2026-07-09) pour éviter toute confusion avec la version active : elle décrivait notamment l'**ancien calendrier de vote** (1er/2 du mois) qui ne s'applique plus. Se référer directement au code du dossier `club-lecture/` si besoin.

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

#### Campagnes (`campagne.html` + `campagne.js` / `wiki-page.html` + `wiki-page.js`)

Système de gestion de campagne type Notion/LegendKeeper, accessible depuis la **sidebar JDR** qui liste dynamiquement les campagnes existantes (emoji + nom, collection `jdr_campagnes`) avec un bouton de création (modal nom + emoji → redirection vers la nouvelle campagne).

- **`campagne.html?id=CAMPAGNE_ID`** — page d'une campagne, onglets : **Présentation** / **Wiki** / **Idées** / **Journal de dev** / **Carte** / **Chronologie**. Gère aussi les **quêtes** et **arcs narratifs**.
- **`wiki-page.html?camp=ID&type=wiki|quete&id=PAGE_ID`** — page pleine d'une fiche wiki ou d'une quête (lecture/édition).
- **Collections Firestore** : `jdr_campagnes`, `jdr_camp_wiki`, `jdr_camp_quetes`, `jdr_camp_idees`, `jdr_camp_dev_journal`, `jdr_camp_carte`, `jdr_camp_chrono`.

> `campagne.js` fait ~1 300 lignes — cette doc est un résumé ; se référer au code pour le détail des fonctionnalités.

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

## Section Pronostics (`/pronostics/`)

Pronostics e-sport **League of Legends** entre amis (MSI, Worlds, grands tournois). DA « Hextech » : fond bleu nuit, or `#d8a955` / bleu `#38bdf8`, coins coupés, polices Chakra Petch/Rajdhani.

### Accès / Profils

- **Pas de mot de passe.** Chaque joueur choisit ou crée un **profil** (nom + avatar) au premier accès (`requireProfile()` dans `js/auth.js`) — mémorisé en `localStorage` (`prono_profile_id`, `prono_profile_name`, `prono_profile_avatar`). Les profils sont stockés dans la collection `prono_profiles`.
- **Mode admin** : ajouter `?admin` à l'URL de `tournoi.html` → onglet Admin + tous les matchs éditables (équipes, scores, horaires), **création de nouveaux matchs** (formulaire "Ajouter un match" : équipes, BO, libellé semaine/round, heure Paris) et **suppression** (avec les picks associés, après confirmation). Pas de mot de passe, juste une URL non mise en avant. C'est le workflow normal : tout se gère depuis le site, plus besoin des pages seed.
- **Couleurs des joueurs** (`registerAvatarColors()` dans `nav.js`) : les n joueurs (triés par nom) reçoivent des teintes HSL **espacées de 360°/n** sur le cercle chromatique → jamais deux couleurs proches. Utilisées partout : avatars sans image (hexagone + initiale) et courbes de l'onglet Évolution. Enregistré automatiquement par la nav (via `getProfiles()`) + de façon synchrone dans `tournoi.js`/`classement.js` avant le rendu. Les noms hors effectif (ex : équipes dans `renderTeamCard`) gardent le hash historique sur la palette fixe.

### Pages

- **`index.html`** (`accueil.js`) — liste des tournois.
- **`tournoi.html?id=…`** (`tournoi.js`) — page d'un tournoi : **calendrier** (cartes matchs, voyant rouge clignotant sur les matchs sans pronostic), **bracket** (double score : résultat officiel en gris + pronostic coloré) **ou onglet « Ligue »** si le tournoi a `format: 'league'` (ex : LEC — classement des équipes : V/D en séries, différence de manches, top 6 marqué qualifié playoffs, calculé depuis les matchs terminés), **classement du tournoi**, **évolution** (voir ci-dessous). Clic sur un match terminé/live → **drawer** des picks de tous les joueurs (+ section admin en bas si `?admin`). Horaires affichés en **heure de Paris** (helpers `parisToUtc` / `utcToParisLocal`, DST-correct).
  - **Onglet Évolution** (`renderEvolution()`) : graphique en courbes des **points cumulés par joueur au fil des jours de match** (Chart.js 4.4.3 chargé en lazy au premier clic sur l'onglet). Les points sont datés au **jour du match** (heure de Paris, `matchDayKey`), pas à la date du scoring. Une courbe par joueur ayant ≥ 1 pick scoré, couleur = `avatarColor(nom)` (cohérente avec l'avatar), joueur courant en trait épais, légende et tooltip triés par total décroissant, point de départ commun « Début » à 0. Données : `getAllPicksByTournament()` (db.js) + les `matches` déjà chargés.
- **`classement.html`** (`classement.js`) — classement général tous tournois. Barème : **5 pts** score exact · **3 pts** bon gagnant · **0 pt** mauvais gagnant. Delta affiché = points gagnés **aujourd'hui** (depuis minuit Paris). Clic sur un joueur → détail des points par tournoi.
- **Colonnes des classements** (général **et** onglet tournoi) : chaque ligne affiche 3 colonnes chiffrées **disjointes** — **bons** (bon gagnant sans le score, bleu `#5b9cf6`, 3 pts), **exacts** (score exact, vert `--win`, 5 pts), **mauvais** (rouge `--loss`, 0 pt) — avec le barème rappelé en tout petit sous chaque colonne, puis le **total** séparé par un filet vertical. La somme des 3 = nombre de pronostics scorés. Départage du classement inchangé : points, puis total de bons gagnants (`correct + perfect`), puis scores exacts.
- **`seed.html`** / **`seed-matches.html`** — outils ponctuels d'initialisation des tournois/matchs (admin, lien direct uniquement).

### Données / API

- **Collections Firestore** : `prono_tournaments`, `prono_matches`, `prono_picks`, `prono_profiles`, `prono_long_term`.
- ⚠️ **Actualisation par API : ABANDONNÉE (2026-07-19).** Les deux proxys du Worker existent toujours (`/api/leaguepedia`, `/api/lolesports`) mais aucun ne fonctionne en pratique : l'API lolesports n'a jamais rien renvoyé d'utilisable pour le MSI, et lol.fandom.com **rate-limite les IP partagées des Workers Cloudflare** (erreur `ratelimited` constatée par Tom le 2026-07-19). **Workflow assumé : saisie manuelle** des résultats/équipes via `?admin` — c'est déjà comme ça que le MSI a été géré. Le bouton Sync de la top-bar n'apparaît plus que si le tournoi a un champ `lol_league_id` explicitement renseigné (aucun à ce jour).
- **Scoring** : `scorePicksForMatch` (db.js) marque les picks `scored` ; le gagnant est auto-déduit des scores si non renseigné. Pas de double `where` Firestore (évite les index composites) — filtres en JS.

---

## Section Data Discord (`/data-discord/`)

Visualisation des stats du serveur Discord, alimentée par les 4 documents agrégés écrits par le [bot Discord](#bot-discord-discord-bot) (`discord_stats_serveur`, `discord_stats_salons`, `discord_stats_membres`, `discord_stats_interactions`).

- **Pas de mot de passe.** Sidebar commune injectée par `nav.js` : liste des serveurs (collection `discord_serveurs`) + pages.
- **Pages** (toutes avec `?id=GUILD_ID`) : `index.html` (choix du serveur), `dashboard.html` (vue d'ensemble), `membres.html`, `salons.html`, `interactions.html` (paires de membres), `graphe.html` (représentation graphique des interactions), `sondages.html` (archives des sondages).
- `stats.html` existe dans le dossier mais n'est **pas liée** dans la sidebar (page héritée).

---

## Section Perso (`/perso/`)

Espace personnel de Tom, lié uniquement par le petit bouton discret en bas à droite de l'accueil.

- **Mot de passe** : SHA-256 comparé à un hash en dur (`js/auth.js`), `sessionStorage` clé `"perso_auth"` — même mécanique que JDR/Atelier.
- **Pages** : `index.html` (accueil de l'espace) et `migraines.html` (`js/migraines.js`) — **suivi des migraines ophtalmiques** (enregistrement des crises, collection Firestore `perso_migraines`).

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
| Lis tes ratures — Accueil | `/lis-tes-ratures/` |
| Lis tes ratures — Bibliothèque | `/lis-tes-ratures/bibliotheque.html` |
| Lis tes ratures — Votes | `/lis-tes-ratures/votes.html` |
| Lis tes ratures — Bulletin de vote | `/lis-tes-ratures/vote.html` |
| Lis tes ratures — Bulletin admin | `/lis-tes-ratures/voteadmin.html` |
| Lis tes ratures — Membres | `/lis-tes-ratures/membres.html` |
| Lis tes ratures — Réunions | `/lis-tes-ratures/reunions.html` |
| Lis tes ratures — Sondage de date | `/lis-tes-ratures/sondage-dispo.html` |
| Lis tes ratures — Statistiques | `/lis-tes-ratures/statistiques.html` |
| Lis tes ratures — Commentaires | `/lis-tes-ratures/commentaires.html?livre=LIVRE_ID` |
| Lis tes ratures — Chantier vote (lien direct) | `/lis-tes-ratures/chantier.html` |
| Lis tes ratures — Stabilisation (lien direct) | `/lis-tes-ratures/stabilisation.html` |
| Club de lecture (ancien) | `/club-lecture/*` → redirigé 301 vers `/lis-tes-ratures/*` |
| JDR — Accueil | `/jdr/` |
| JDR — Archives | `/jdr/archives.html` |
| JDR — Outils | `/jdr/outils.html` |
| JDR — Campagne | `/jdr/campagne.html?id=CAMPAGNE_ID` |
| JDR — Fiche wiki/quête | `/jdr/wiki-page.html?camp=ID&type=wiki\|quete&id=PAGE_ID` |
| JDR — Outil Makryon | `/jdr/Outils/generateur-pnj-makryon_1.html` |
| JDR — Outil Tribunal | `/jdr/Outils/tribunal-dragons-outils_1.html` |
| JDR — Outil Aria | `/jdr/Outils/paradoxe_temporel_4.html` |
| JDR — Roue personnalisable | `/jdr/Outils/roue-personnalisable_1.html` |
| Jeux — Accueil | `/Jeux/` |
| Jeux — Jeu de Mots | `/Jeux/jeu-de-mots.html` |
| Pronostics — Accueil | `/pronostics/` |
| Pronostics — Tournoi | `/pronostics/tournoi.html?id=…` (+ `&admin` pour le mode admin) |
| Pronostics — Classement | `/pronostics/classement.html` |
| Data Discord — Accueil | `/data-discord/` |
| Data Discord — Dashboard | `/data-discord/dashboard.html?id=GUILD_ID` |
| Atelier — Tableau de bord | `/atelier/` |
| Atelier — La Carte | `/atelier/carte.html` |
| Atelier — Le Wiki | `/atelier/wiki.html` |
| Perso — Accueil | `/perso/` |
| Perso — Migraines | `/perso/migraines.html` |

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
- **Aucune image stockée** : seule l'URL trouvée est mémorisée en Firestore. Depuis la v5 de l'algo (`SEARCH_V = 5`), la couverture **auto** est mise en cache dans `livres.couv_cache` (`""` = cherché sans résultat), **séparée** de `livres.couverture_url` qui est réservé à l'**override manuel** (avec `couv_manuelle: true`). `livres.couv_v` mémorise la version de l'algo : bumper `SEARCH_V` relance la recherche sans retoucher les couvertures manuelles. (Ancien système pré-v5 : tout dans `couverture_url` — des valeurs legacy peuvent subsister.)
- **Surfaces couvertes** : cartes propositions (`.bk-face`), cartes éliminés (`.elim-card`), livre du mois de l'accueil (`.lm-cover`), **podium accueil** (`.pp-cover`), **tranches des livres élus** (`.bib-elu-cover`, vignette ajoutée quand le toggle est ON), **registre des scrutins** page Votes (`.scrutin-cover`), **livres proposés** dans les fiches membres (`.rf-prop-cover`), **fiches réunions** (`.mtg-cover`), et fiches détail (`.fiche-cover` — accueil + bibliothèque). Chaque page écoute `ltr-covers-change` pour ré-hydrater / retirer les couvertures (`removeAllCovers`). La couverture est superposée via `<div class="real-cover">` (fond flou de l'image + `<img class="real-cover-img">` en `object-fit: contain` → couverture **entière**, jamais rognée, sans bandes vides ; fondu au chargement). Si aucune couverture n'est trouvée, l'illustration générique reste affichée. **La liste des élus reste en métaphore « tranches de livres »** (non couverte).
- **Correction manuelle** : champ « URL de couverture (manuel) » dans le formulaire d'édition d'un livre (bibliothèque). Vide = recherche auto réactivée.
- **Re-render** : chaque page écoute l'événement `ltr-covers-change` (dispatché par le toggle) pour rafraîchir ses couvertures sans rechargement.
- **Note** : le matching titre+auteur n'est pas fiable à 100 % (édition rare, livre peu connu) → repli générique + correction manuelle possible.

---

## Enrichissement IA

Au moment d'ajouter un livre (et via le bouton **« Enrichir la bibliothèque »** pour le rattrapage des livres existants), une IA complète automatiquement les infos manquantes (genre, nombre de pages, description en 3 mots) **et** fournit l'**ISBN-13**, qui sert à récupérer la vraie couverture de façon exacte.

### Architecture — Cloudflare Worker

> ⚠️ **Le site est déployé comme un Cloudflare *Worker* (Worker + fichiers statiques), pas comme un projet *Pages*.** Domaine `nardoll.monsiteinternet.workers.dev`, déploiement **automatique à chaque push sur `main`** (connecté au repo GitHub — pas besoin de lancer `wrangler deploy` à la main). La convention Pages `functions/` n'est donc **pas** détectée — il faut un vrai point d'entrée Worker.

Le site est statique : **impossible de mettre la clé API Claude dans le JS du navigateur** (elle serait publique). La clé vit côté serveur dans le Worker.

- **`worker.js`** (racine) — point d'entrée. **Trois routes API** :
  - `/api/enrich` → `handleEnrich()` (enrichissement IA des livres, ci-dessous) ;
  - `/api/leaguepedia` → proxy cargoquery vers `lol.fandom.com` (résultats de matchs, cache 120 s, CORS ouvert) — utilisé par `/pronostics/` ;
  - `/api/lolesports` → proxy vers l'API `esports-api.lolesports.com` (clé publique connue en dur, cache 120 s) — utilisé par `/pronostics/`.

  Tout le reste est délégué aux fichiers statiques via `env.ASSETS.fetch()`, avec `Cache-Control: no-cache` forcé sur **tous** les HTML/JS/CSS du site (en complément du fichier `_headers`).
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

> **📜 L'historique complet des sessions antérieures au 2026-07-09 est dans [`HISTORIQUE.md`](HISTORIQUE.md)** (déplacé pour alléger ce fichier). Continuer à documenter chaque session ici ; quand cette section devient longue, déplacer les entrées les plus anciennes vers `HISTORIQUE.md`.

### 2026-07-19
**Pronostics — Annulation EWC, MSI clôturé, LEC Summer 2026 en mode « ligue », abandon de l'API**

- **EWC 2026 annulé et supprimé** de la base (tournoi + 27 matchs, aucun pick n'avait été posé) — décision de Tom : les matchs s'enchaînaient trop vite pour que quiconque ait le temps de pronostiquer. **MSI 2026 passé en `finished`**.
- **LEC Summer 2026 créé** (doc `jktxjultvQzfzBlKIpkj`, statut `upcoming`) : 24 juillet → 20 septembre 2026, les 10 équipes vérifiées (Fnatic, G2, GIANTX, Karmine Corp, Vitality, Heretics, Shifters, Movistar KOI, SK Gaming, Natus Vincere), `format: 'league'`, `wiki_url` vers la page Leaguepedia. **Aucun match seedé** — le calendrier sera saisi via le nouveau formulaire admin (ou seedé par Claude si Tom colle le calendrier Leaguepedia dans une session).
- **API abandonnée définitivement** : test en conditions réelles du proxy `/api/leaguepedia` par Tom → `ratelimited` (lol.fandom.com blackliste les IP partagées Cloudflare Workers). Voir l'encart ⚠️ de la section [Données / API](#données--api). Bouton Sync masqué sauf `lol_league_id` explicite (`tournoi.js`).
- **`format: 'league'`** (nouveau champ tournoi) : l'onglet Bracket devient **« Ligue »** — classement des équipes (V/D en séries, manches, diff, top 6 surligné or = qualif playoffs), fonction `renderLigue()` + styles `.lg-*`. La modale depuis le classement s'intitule « Picks de X » au lieu de « Bracket de X ».
- **Admin — création/suppression de matchs depuis le site** (`db.js` : `createMatch`/`deleteMatch`, `tournoi.js`) : formulaire "Ajouter un match" (équipes du tournoi en select, BO1/3/5, libellé, heure Paris) et bouton "Supprimer" rouge sur chaque match (supprime aussi les picks posés dessus, `confirm()` avant). Les selects d'équipes de l'admin incluent désormais `tournament.teams` (avant : seulement les équipes déjà présentes dans des matchs — bloquant pour un tournoi sans matchs).

### 2026-07-15
**Pronostics — Ajout du tournoi Esports World Cup (EWC) 2026 + bracket générique** *(⚠️ tournoi EWC annulé et supprimé le 2026-07-19, voir ci-dessus — le fix « bracket générique » reste)*

- **Tournoi `EWC 2026`** (doc `k5uQjWRvCNWW64VK4dyU`, déjà ébauché par Tom via `seed.html`) complété directement en base : 16 équipes (4 groupes GSL A/B/C/D), statut passé à `live` (le tournoi démarre le 15/07). Infos réelles (groupes, équipes, horaires du Round 1) trouvées par recherche web — dates/heures confirmées : 15–19 juillet 2026, Paris.
- **27 matchs insérés** dans `prono_matches` : les **8 matchs du Round 1** (un par paire de chaque groupe) ont les **vraies équipes et horaires confirmés** (best-of-1). Les tours suivants (Round 2, Round 3, Quarts/Demi/Finale) sont en **`TBD` vs `TBD`** avec horaires provisoires — à corriger en mode admin (`?admin`) au fil des résultats, comme cela avait été fait pour le bracket MSI 2026.
- ⚠️ **`lol_league_id` non renseigné** — l'ID de ligue LoL Esports pour l'EWC n'a pas pu être récupéré (API `esports-api.lolesports.com` bloquée par la politique réseau de cet environnement, et les pages Leaguepedia/Liquipedia renvoient 403 au scraping). Le bouton **Sync** ne remontera donc aucun résultat tant que ce champ n'est pas renseigné — en attendant, saisie des scores **à la main** via le panneau Admin. Si Tom retrouve l'ID (ouvrir lolesports.com, onglet réseau du navigateur, chercher `leagueId` dans une requête `getLeagues`/`getSchedule`), il suffit de l'ajouter au doc du tournoi (`lol_league_id`) pour activer le sync auto.
- **`pronostics/js/tournoi.js` — Bracket généralisé** : l'onglet Bracket (et la modale "Bracket de {joueur}") était **codé en dur pour la structure du MSI 2026** (`PLAY_IN_ROUNDS`/`BRACKET_ROUNDS` référençant des IDs de matchs précis) — tout autre tournoi affichait un onglet Bracket vide. Ajout de `BRACKET_STRUCTURES` (table par `tournament_id`, ne contient que le MSI 2026 en dur) + `buildGenericBracketStages()` qui reconstruit les colonnes/étages **à partir des champs `tab`/`round`/`bracket_side` des matchs** pour tout tournoi absent de la table. Les matchs EWC 2026 utilisent ce mécanisme générique (`tab: "Groupe A"…"Playoffs"`, `bracket_side: "lower"` sur les matchs de bracket perdants).

### 2026-07-09 (suite 3)
**Pronostics — Colonnes bons / exacts / mauvais dans les deux classements**

- `pronostics/js/db.js` : `getLeaderboard` et `getPlayerBreakdown` passent en catégories **disjointes** — `perfect` (5 pts), `correct` (3 pts, bon gagnant sans le score exact), nouveau champ `wrong` (0 pt). ⚠️ Le **départage** du classement reste identique à avant (points, puis `correct + perfect` = total de bons gagnants, puis `perfect`) — un premier essai avec `perfect` en premier critère inversait Tom/Zozo à égalité de points, corrigé.
- `pronostics/js/classement.js` + `tournoi.js` : le petit texte "N bons · N parfaits" sous les noms est remplacé par **3 colonnes chiffrées** — bons (bleu `#5b9cf6`), exacts (vert), mauvais (rouge), mêmes couleurs que la légende du bracket — avec le barème (3/5/0 pts) rappelé en tout petit sous chaque colonne. Colonne "total" (ex-"pts") séparée par un filet vertical. Modal détail joueur (classement général) alignée sur les mêmes catégories colorées.
- `pronostics/css/style.css` : `.lb-stats`/`.lb-stat*`, `.c-blue`/`.c-green`/`.c-red`, filet `border-left` sur `.lb-pts-wrap`, ajustements mobile ≤ 640 px (vérifié en local desktop + 375 px, données réelles).

### 2026-07-09 (suite 2)
**Pronostics — Couleurs de joueurs vraiment distinctes (avatars + graphique)**

- `pronostics/js/nav.js` : nouvelle fonction `registerAvatarColors(profils)` — les n joueurs triés par nom reçoivent des teintes HSL **espacées de 360°/n** sur le cercle chromatique (6 joueurs → 60° d'écart garanti). Remplace le hash simple sur palette qui pouvait donner deux couleurs quasi identiques (Thibaud et M1K étaient tous deux bleus). `avatarColor(nom)` consulte ce registre d'abord, hash historique en repli (conservé pour les équipes). Le jaune (~60°) est légèrement assombri/saturé pour rester lisible sur fond sombre. Enregistrement automatique dans la nav (`getProfiles()` + rafraîchissement de l'avatar du haut) et synchrone dans `tournoi.js` (après chargement de `allProfiles`) et `classement.js` (après `getLeaderboard`) pour éviter toute course avec le rendu.
- Effet : avatars sans image ET courbes du graphe Évolution utilisent les mêmes couleurs, désormais toutes bien différenciées (vérifié en local sur les 6 profils réels : bleu, magenta, cyan, rouge, jaune, vert).

### 2026-07-09 (suite)
**Pronostics — Onglet « Évolution » : graphique des points cumulés par joueur**

- `pronostics/js/db.js` : nouvelle fonction `getAllPicksByTournament(tournamentId)` (requête simple sur `tournament_id`, pas d'index composite).
- `pronostics/js/tournoi.js` : nouvel onglet **Évolution** dans la page tournoi (entre Classement et Admin). `renderEvolution()` : points datés au **jour du match** (heure de Paris via `matchDayKey`, pas à la date du scoring — le sync peut scorer en retard), cumul par joueur, une courbe par joueur ayant au moins un pick scoré. Chart.js 4.4.3 chargé en **lazy** au premier clic (`loadChartJs()`), couleurs = `avatarColor(nom)` (mêmes couleurs que les avatars), joueur courant en trait épais « (toi) », légende/tooltip triés par total décroissant, point de départ commun « Début » à 0, jours sans match ignorés (seuls les jours avec matchs terminés apparaissent). État vide propre tant qu'aucun match n'est scoré.
- `pronostics/css/style.css` : styles `.evo-card` / `.evo-title` / `.evo-sub` / `.evo-canvas-wrap` (hauteur 340 px, 280 px en mobile), DA Hextech (clip-path, surface).
- Testé en local (serveur statique + vraies données Firestore) : totaux du graphe identiques au classement (Tom 52 · Zozo 52 · Thibaud 45 · Front 19 · M1K 6), rendu desktop + mobile OK.
- `.gitignore` : ajout de `.claude/` (fichiers locaux de session, dont `launch.json` de prévisualisation).

### 2026-07-09
**Audit complet README ↔ site + remise en cohérence de la documentation**

Audit lecture seule demandé par Tom, puis application des corrections validées :
- **README — section « Bulletin de vote » corrigée** : elle décrivait encore l'ancien calendrier (vote le 1er du mois, 2ᵉ tour le 2) alors que le code fait le **25/26** depuis le 2026-07-02. Ajout du vote blanc et des membres inactifs dans la description de la clôture.
- **README — sections manquantes ajoutées** : `/pronostics/` (profils localStorage, mode `?admin`, proxys API), `/data-discord/` (pages + sources de données), `/perso/` (mot de passe, suivi migraines), campagnes JDR (`campagne.html`, `wiki-page.html`, collections `jdr_camp_*`).
- **README — structure des fichiers réécrite** (une vingtaine de fichiers et 3 sections manquaient), **table des URLs complétée**, page d'accueil documentée avec ses **6 cartes**.
- **README — mentions obsolètes purgées** : « déployé via npx wrangler deploy » (ligne structure), « Cloudflare Pages » résiduels ; section « Couvertures réelles » alignée sur la v5 (`couv_cache` séparé de `couverture_url`) ; doc `worker.js` complétée avec les routes `/api/leaguepedia` et `/api/lolesports` + no-cache global.
- **README — doc détaillée de l'ancienne version `/club-lecture/` retirée** (remplacée par un encart court) : elle dupliquait la doc du système de vote avec les anciennes dates.
- **Historique déplacé dans `HISTORIQUE.md`** (~1 000 lignes) pour alléger le README.
- `index.html` (accueil) : badge « MSI 2026 · Live » codé en dur remplacé par « ✨ Accès libre » (intemporel) ; texte du hero corrigé (toutes les sections ne sont pas protégées par mot de passe).
- `lis-tes-ratures/js/covers.js` : commentaire d'en-tête aligné sur le fonctionnement v5 réel (cache `couv_cache`).
- `_redirects` / `_headers` : commentaires « Cloudflare Pages » corrigés (assets du Worker).
- `netlify.toml` supprimé (héritage Netlify inutilisé ; retiré aussi de `.assetsignore`).

### 2026-07-03 *(entrée reconstituée depuis les commits — non documentée à l'époque)*
- `lis-tes-ratures` : **boutons +1/−1** sur le chapitre/page en cours du suivi de lecture (commit `2f43cc8`).
- `pronostics` : **voyant rouge clignotant** sur les matchs du calendrier sans pronostic (`8c22bff`) ; **delta du classement = points gagnés aujourd'hui** depuis minuit Paris au lieu de 24 h glissantes (`a08ef5e`) ; **scoring : gagnant auto-déduit des scores** si non sélectionné (`107158b`).

---

> Les entrées antérieures (2026-05-23 → 2026-07-02) sont dans [`HISTORIQUE.md`](HISTORIQUE.md).
