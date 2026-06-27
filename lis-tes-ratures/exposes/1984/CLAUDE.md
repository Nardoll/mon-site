# CLAUDE.md

Guide pour travailler sur ce dépôt avec Claude Code.

## Le projet

Un support de présentation **plein écran, en un seul fichier HTML autonome** (`index.html`), pour un exposé d'environ 15-20 minutes autour de **_1984_ de George Orwell**, présenté au club de lecture « Lis tes ratures ». Navigation au clavier, partage d'écran.

- **Auteur / présentateur** : Dorian.
- **Angle** : pas une biographie, une « enquête ». Thèse = « Orwell n'a pas imaginé _1984_, il l'a vécu, observé, puis distillé. » Équilibre ~60 % vie/œuvres, 40 % analyse perso.
- **Livrable unique** : `index.html` (HTML + CSS + JS inline, polices Google : Playfair Display, Inter, Caveat). Aucune étape de build : on ouvre le fichier dans un navigateur.

## Lancer / prévisualiser

Ouvrir `index.html` dans un navigateur (double-clic), ou servir le dossier :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

La version en ligne (GitHub Pages) sert ce même `index.html` à la racine.

## Règle de style NON NÉGOCIABLE

La voix est celle de Dorian, pas une voix « IA » générique. Pour toute rédaction nouvelle :

- **JAMAIS de tiret cadratin « — ».** Le remplacer par deux-points, virgule, parenthèses, point-virgule, points de suspension, ou middot « · ». (Le fichier est à zéro tiret cadratin, à garder ainsi.)
- Première personne, ton réflexif et personnel (« je trouve », « à mon sens », « honnêtement », « perso »).
- Phrases qui coulent + quelques fragments. Apartés entre parenthèses.
- Enthousiasme sincère, jamais de slogan publicitaire ; éviter les triplets dramatiques (« D'abord X. Puis Y. Enfin Z. »).
- Les slides sont un support de parole : texte resserré, c'est Dorian qui développe à l'oral.

## Architecture (un seul fichier)

`index.html` : `<style>` puis `<div class="deck">` avec une `<section class="slide">` par diapo (21 au total), la barre de chrome, l'overlay « vue d'ensemble », la lightbox, et un `<script>` en bas.

Conventions de slide :
- `class="slide"` de base ; ajouter `data-dark` (slide sombre brun espresso, pour les transitions d'actes / surveillance), `dense` (alignée en haut, typo réduite).
- `data-act="..."` (label en bas à gauche), `data-title="..."` (titre repris dans la vue d'ensemble).
- Blocs réutilisables : `.eyebrow`, `.headline`, `.lede`, `.takeaway`, `.aside`, mise en page `.split` / `.split.rev` (illustration dans `.fig`).

Composants JS :
- **Photos réelles avec repli SVG** : un `<img class="photo" ... onerror="this.remove()">` placé avant un SVG ; si l'image manque, l'`onerror` la retire et le SVG reprend la main (donc jamais d'image cassée). Fichiers attendus + sources : voir `images/README.md`.
- **Infobulles** : `<span class="def" tabindex="0">mot<span class="tip">définition</span></span>`.
- **Caviardage interactif** (slide 20) : `<span class="redact">…</span>`, révélé pas à pas.
- **Lightbox** : photos `.zoomable` cliquables → plein écran, zoom (molette/clic, suit le curseur), pan, fermeture (✕ / clic au fond / Échap).
- **Navigation** : flèches / espace / PageUp-Down / Home-End ; `F` plein écran, `O` vue d'ensemble. **Le clic ne change PAS de slide** (sauf liens internes, ex. zoom).

Détail complet (carte des 21 slides, tokens couleur, faits vérifiés, historique des itérations) : **`PASSATION-expose-orwell.md`**.

## Images

Tout est dans `images/`. Chaque fichier a un nom précis attendu par le HTML (voir `images/README.md`). Ne pas renommer une image sans mettre à jour le `src="images/..."` correspondant.

## Droits d'auteur

Garder les citations de _1984_ très courtes (paraphraser de préférence). Les slogans iconiques (2+2=5) sont ok avec parcimonie.
