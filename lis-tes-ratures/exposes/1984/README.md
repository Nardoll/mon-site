# Orwell · _1984_ · Exposé

Support de présentation pour un exposé d'environ 15-20 minutes autour de **_1984_ de George Orwell**, présenté au club de lecture « Lis tes ratures ».

**▶︎ Voir la présentation en ligne : https://lumiaspic.github.io/expose-orwell-1984/**

> L'angle n'est pas biographique mais celui d'une enquête. Thèse : *Orwell n'a pas imaginé 1984, il l'a vécu, observé, puis distillé.*

## Aperçu

Une présentation **plein écran**, dans un **seul fichier HTML autonome** (HTML + CSS + JS inline, sans build). Identité visuelle « papier crème / terracotta », avec pour signature visuelle la **rature** : le club joue sur « ratures » (effacements), et _1984_ est le roman de l'effacement (réécrire l'Histoire, vaporiser les gens).

21 slides organisées en quatre actes :

1. **L'homme qui voulait voir de ses propres yeux** : Birmanie, la dèche, l'Espagne, l'Histoire qui s'efface.
2. **L'obsession de la langue** : l'écriture comme une vitre, le novlangue, écho avec Clément Viktorovitch.
3. **Trois portes d'entrée dans _1984_** : la mise en abyme, le statut du réel (2+2=5), l'intime.
4. **Pourquoi ça nous regarde encore** : le documentaire de Raoul Peck, la censure aujourd'hui, questions pour le débat.

## Fonctionnalités

- Navigation au clavier (flèches, espace, `Home`/`End`).
- `F` : plein écran · `O` : vue d'ensemble (grille cliquable) · `Échap` : fermer.
- Photos cliquables pour s'agrandir (lightbox avec zoom qui suit le curseur et déplacement).
- Infobulles de définition, caviardage interactif, repli automatique en illustration SVG quand une photo manque.
- Animations CSS respectueuses de `prefers-reduced-motion`.

## Utilisation locale

Ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

## Structure

```
index.html                 La présentation (tout est dedans)
images/                    Photos d'illustration (+ README détaillant chaque fichier)
CLAUDE.md                  Guide pour travailler sur le dépôt avec Claude Code
PASSATION-expose-orwell.md Notes de contexte détaillées (carte des slides, faits vérifiés)
```

## Crédits

Présentation de Dorian, co-rédigée avec Claude (Opus 4.8) à partir de ses notes et brouillons. Les images d'archives proviennent majoritairement de Wikimedia Commons (domaine public) ; les couvertures et affiches restent la propriété de leurs éditeurs, citées ici à titre d'illustration pour un exposé.
