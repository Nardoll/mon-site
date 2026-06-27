# Passation : exposé 1984 / Orwell pour "Lis tes ratures"

> Fichier de contexte pour reprendre le travail (notamment dans Claude Code) sur la présentation `index.html`. Ne contient que l'essentiel utile pour modifier le support.

---

## 1. Le projet en une phrase

Un support HTML de slides plein écran (un seul fichier autonome), pour un exposé d'environ 15 à 20 minutes au débrief du club de lecture **"Lis tes ratures"**, le **samedi 27 juin 2026**, autour de **1984 de George Orwell**. Présentation en partage d'écran, navigation au clavier.

- **Auteur / présentateur** : Dorian (membre du club). 1984 est son livre préféré, ici en 2ᵉ lecture.
- **Fichier livrable** : `index.html` (anciennement `expose-orwell-1984.html` ; HTML/CSS/JS autonome, polices Google : Playfair Display, Inter, Caveat).
- **Angle** : pas une biographie, une "enquête". Thèse = "Orwell n'a pas imaginé 1984, il l'a vécu, observé, puis distillé." Équilibre visé : environ 60% vie/oeuvres, 40% analyse perso.

---

## 2. Règles de style (IMPORTANT, à respecter pour toute nouvelle rédaction)

La voix doit rester celle de Dorian, pas une voix "IA" générique :

- **JAMAIS de tiret cadratin "—"**. Le remplacer par deux-points, virgule, parenthèses, point-virgule, points de suspension, ou middot "·". (Le fichier en est actuellement à zéro, à garder ainsi.)
- Première personne, ton réflexif et personnel : "je trouve", "à mon sens", "honnêtement", "perso", "quel plaisir".
- Phrases qui coulent, mélangées à quelques fragments. Parenthèses pour les apartés.
- Enthousiasme sincère, jamais de formules punchy type slogan publicitaire (éviter les triplets dramatiques "D'abord X. Puis Y. Enfin Z.").
- Les slides sont un support de parole : texte resserré, c'est Dorian qui développe à l'oral.

---

## 3. Système de design (la D.A. du club)

Reprise de l'identité visuelle du site du club (papier crème, serif élégant, terracotta, cartes, tampons, perforations), adaptée à 1984.

**Signature visuelle** : la **rature** (le barré). Le nom du club joue déjà sur "ratures" (effacements) ; 1984 est le roman de l'effacement (réécrire l'Histoire, le trou de mémoire, vaporiser les gens). Le barré relie donc le club au roman. Implémenté via la classe `.rature` (mot barré d'un trait rouge légèrement incliné).

**Tension chaud / froid** : fond papier crème par défaut (la chaleur de la littérature) ; slides sombres brun espresso (`[data-dark]`) pour les transitions d'actes et les moments de surveillance / effacement.

**Tokens couleur** (dans `:root`) :
```
--bg:#E7DECE        fond papier
--card:#F8F2E6      carte crème
--card-2:#FBF7EE    carte plus claire
--ink:#2B2118       brun espresso (texte + slides sombres)
--ink-soft:#6F6353  brun atténué
--ink-faint:#9A8E7C taupe
--rust:#B0532D      terracotta (accent principal)
--rust-deep:#8F3F1F
--green:#4E7A48     vert forêt (camp républicain, secondaire)
--teal:#2E7E72
--red:#A23A28       rouge tampon / encre de censure
--gold:#A9863B
```

**Typo** :
- Display / titres : `Playfair Display` (800/900).
- Corps / UI : `Inter` (400/500/600).
- Annotations manuscrites (corrections, "rature") : `Caveat`.

---

## 4. Carte des slides (21 slides au total)

| # | data-title | Contenu | Particularité |
|---|------------|---------|---------------|
| 1 | Titre | Accroche "Orwell n'a pas ~~imaginé~~ 1984" + correction manuscrite | rature, Caveat |
| 2 | D'où vient 1984 ? | Avant-propos, la thèse (distillation) | |
| 3 | Mon mois Orwell | Carte de lecture : essais, récits, le roman, autour | liens Wikipédia sur les oeuvres |
| 4 | Acte I (divider) | "L'homme qui voulait voir de ses propres yeux" | sombre, grand chiffre I |
| 5 | Birmanie | Policier impérial, du côté de l'oppresseur | SVG éléphant, lien "Tirer sur un éléphant" |
| 6 | La dèche | Plonge à Paris, vagabond à Londres (pauvreté choisie) | SVG vaisselle/plonge |
| 7 | Espagne, l'engagement | POUM, balle dans le cou, doux-amer | SVG milicien, bouton vers l'aparté |
| 8 | Aparté guerre d'Espagne | Carte schématique + 2 camps + soutiens + issue | dense, infobulles CNT/POUM/Brigades/Phalange |
| 9 | L'Histoire qui s'efface | Trahison du POUM, naissance du Ministère de la Vérité | sombre, SVG avant/après soviétique |
| 10 | Acte II (divider) | "L'obsession de la langue" | sombre |
| 11 | Une écriture comme une vitre | Prose épurée, miroir avec Bradbury | SVG fenêtre, lien Fahrenheit 451 |
| 12 | Le novlangue | Appauvrir les mots = appauvrir la pensée + BBC 1941-1943 | SVG micro, infobulle novlangue, lien Salle 101 |
| 13 | Écho Viktorovitch | Le Pouvoir rhétorique (2021), Logocratie (2025), post-vérité | SVG couvertures, infobulle post-vérité, liens Seuil |
| 14 | Acte III (divider) | "Mes trois portes d'entrée dans 1984" | sombre |
| 15 | Porte I, mise en abyme | Le livre dans le livre, Goldstein = Trotski, le Parti fabrique son opposition | SVG cadres emboîtés, infobulle mise en abyme |
| 16 | Porte II, le statut du réel | Matérialisme / idéalisme / solipsisme, puis 2+2=5 | dense, spectre 3 colonnes, infobulles philo |
| 17 | Porte III, l'intime | Aimer comme acte politique, la beauté du truc, Chambre 101 | SVG visages + étincelle |
| 18 | Acte IV (divider) | "Pourquoi ça nous regarde encore" | sombre |
| 19 | Orwell : 2+2=5 | Doc de Raoul Peck, reco appuyée (avertissement "doomed") | SVG poster, boutons bande-annonce + fiche |
| 20 | On efface encore | Ironie : 1984 interdit en Biélorussie, Servante écarlate aux USA | sombre, **caviardage interactif** |
| 21 | Trois questions | Questions ouvertes pour le débat + crédit Claude | infobulles novlangue/post-vérité |

---

## 5. Architecture technique (pour savoir où modifier)

Tout est dans un seul fichier. Structure : `<style>` puis `<div class="deck">` avec une `<section class="slide">` par diapo, puis la barre de chrome, l'overlay overview, et un `<script>` en bas.

**Conventions de slide** :
- `class="slide"` de base. Ajouter `data-dark` pour une slide sombre, `dense` pour aligner en haut avec typo réduite (slides 8 et 16).
- `data-act="..."` : label affiché en bas à gauche.
- `data-title="..."` : titre repris dans la vue d'ensemble.
- Contenu centré dans `.slide-inner` (ou `.slide-inner.center`).
- Blocs réutilisables : `.eyebrow` (sur-titre capitales), `.headline`, `.lede`, `.takeaway` (encadré accent), `.aside` (italique serif).
- Mise en page texte + illustration : `.split` (texte à gauche) ou `.split.rev` (illustration à gauche). L'illustration va dans `.fig`.

**Illustrations SVG** : inline, classe `.ill`. Elles utilisent des variables CSS `--ill`, `--ill-2`, `--ill-soft` qui basculent automatiquement en clair sur les slides sombres (voir règle `.slide[data-dark] .ill`). Pour ajouter une illustration, dessiner en SVG et utiliser `stroke="var(--ill)"` / `fill="var(--ill-soft)"` / accents `var(--ill-2)`.

**Photos réelles (depuis juin 2026, retour de Dorian)** : les SVG des slides montrant des sujets réels (5 Birmanie, 7 Espagne, 9 photo retouchée, 12 BBC) et les couvertures Viktorovitch (13) acceptent maintenant une **vraie image** placée dans `images/<nom>.jpg`. Mécanisme : un `<img class="photo" ... onerror="this.remove()">` est placé AVANT le SVG ; tant que le fichier image manque, l'`onerror` retire l'`<img>` et le SVG reprend la main (CSS `.fig .photo+.ill{display:none}`). Donc aucune image cassée possible. Liste des fichiers attendus + sources : `images/README.md`. Les SVG conceptuels (vitre, mise en abyme, philo, intime, carte, poster doc) restent en dessin maison (pas de photo qui ait du sens).

**Infobulles de définition** : `<span class="def" tabindex="0">mot<span class="tip">définition...</span></span>`. Affichage au survol, au focus clavier, ou au tap (le JS ajoute `.open` et stoppe la propagation pour ne pas changer de slide). Termes déjà couverts : novlangue, post-vérité, solipsisme, idéalisme, matérialisme, POUM, CNT, Brigades internationales, Phalange, mise en abyme.

**Caviardage interactif (slide 20)** : `<span class="redact">...</span>`. État de base = barre noire qui masque le texte. Chaque clic (ou flèche droite) révèle le bloc suivant via `nextRedaction()`, avec une animation de balayage (`scaleX`). `resetRedactions()` remet tout à l'état masqué quand on (re)entre sur la slide. Pour ajouter d'autres révélations stepwise ailleurs, réutiliser `.redact` (le moteur est générique).

**Liens** : classe `.lnk`, ouverts en `target="_blank" rel="noopener"`. Les clics sur `a`, `button`, `.def`, `.tip` ne déclenchent pas le changement de slide.

**Boutons de saut** : `<button class="jump" data-to="N">` saute à la slide d'index N (0-indexé). Utilisé slide 7 pour aller à l'aparté Espagne.

**Navigation (JS en bas)** :
- Flèche droite / espace / PageDown / flèche bas : suivant (révèle d'abord les caviardages restants).
- Flèche gauche / PageUp / flèche haut : précédent.
- `Home` / `End` : début / fin.
- `F` : plein écran. `O` : vue d'ensemble (grille cliquable). `Échap` : ferme l'overview.
- Clic dans la zone droite (>18% de la largeur) : suivant ; clic dans les 18% de gauche : précédent.
- Barre de progression en haut, compteur "X / 21" en bas à droite, label d'acte en bas à gauche.
- Les slides sombres basculent la classe `body.dark-chrome` (couleurs de la chrome adaptées).

---

## 6. Faits vérifiés (recherchés et confirmés, prêts à présenter)

- **BBC** : Orwell y travaille **1941 à 1943** (Eastern Service, émissions de guerre vers l'Inde), PAS dans les années 30. Il en sort méfiant. La cantine du Ministère de la Vérité et la "Salle 101" viendraient de souvenirs de la BBC.
- **Blessure d'Espagne** : balle de sniper dans le cou / la gorge, mai 1937 près de Huesca, à quelques millimètres d'être fatale.
- **Trahison du POUM** : mai 1937, les staliniens liquident le POUM, l'accusent d'être une "cinquième colonne" fasciste, réécrivent les journaux.
- **Goldstein = Trotski**. "La Théorie et la pratique du collectivisme oligarchique" (le livre dans le livre) parodie **La Révolution trahie** de Trotski.
- **Solipsisme** : O'Brien défend un "solipsisme collectif" en partie 3 ; 2+2=5.
- **1984 interdit en Biélorussie** : ordre de retrait de la vente de toutes les éditions avant le 19 mai 2022 ; le libraire/éditeur Andrei Yanushkevich arrêté, 200 exemplaires saisis, accusé de vendre des "livres nazis". (Source : Nasha Niva.)
- **La Servante écarlate (Atwood)** : contestée ou retirée d'écoles dans une trentaine d'États américains (rapport PEN America 2021-2022 : 1648 titres, 5049 écoles). Atwood a répondu par une **édition ignifugée, impossible à brûler**. (Loi Idaho HB710 en 2025 aussi.)
- **Photos truquées soviétiques** : Iejov (Yezhov) et Trotski effacés des photos officielles ; explicitement cités comme inspiration du Ministère de la Vérité.
- **Doc** : "Orwell : 2+2=5" de Raoul Peck (2025, présenté à Cannes), sortie France 25/02/2026, 1h59, voix d'Orwell par Damian Lewis.

---

## 7. Liens utilisés / utiles

- 1984 : https://fr.wikipedia.org/wiki/1984_(roman)
- Dans la dèche à Paris et à Londres : https://fr.wikipedia.org/wiki/Dans_la_d%C3%A8che_%C3%A0_Paris_et_%C3%A0_Londres
- Hommage à la Catalogne : https://fr.wikipedia.org/wiki/Hommage_%C3%A0_la_Catalogne
- La politique et la langue anglaise : https://fr.wikipedia.org/wiki/La_Politique_et_la_langue_anglaise
- Tirer sur un éléphant : https://fr.wikipedia.org/wiki/Tirer_sur_un_%C3%A9l%C3%A9phant
- Guerre d'Espagne : https://fr.wikipedia.org/wiki/Guerre_d%27Espagne
- Léon Trotski : https://fr.wikipedia.org/wiki/L%C3%A9on_Trotski
- Censure des images en Union soviétique : https://fr.wikipedia.org/wiki/Censure_des_images_en_Union_sovi%C3%A9tique
- Salle 101 : https://fr.wikipedia.org/wiki/Salle_101
- Fahrenheit 451 : https://fr.wikipedia.org/wiki/Fahrenheit_451
- Clément Viktorovitch : https://fr.wikipedia.org/wiki/Cl%C3%A9ment_Viktorovitch
- La Servante écarlate : https://fr.wikipedia.org/wiki/La_Servante_%C3%A9carlate
- Logocratie (Seuil) : https://www.seuil.com/ouvrage/logocratie-clement-viktorovitch/9782021591163
- Viktorovitch, page auteur Seuil : https://www.seuil.com/auteur/clement-viktorovitch/34419
- Doc, fiche Le Pacte : https://le-pacte.com/france/film/orwell-225
- Doc, bande-annonce : https://www.youtube.com/watch?v=whHEMMNb4ps

---

## 8. Précaution droits d'auteur (pour les futures modifs)

Garder les citations de 1984 très courtes (paraphraser de préférence), ne pas reproduire de longs passages. Les slogans courts et iconiques (2+2=5, "faites-le à Julia") sont ok avec parcimonie.

---

## 9. Points ouverts / idées non encore faites

- **Version PDF de secours** pour le jour J (au cas où le partage de navigateur fasse des siennes) : proposée, pas encore générée.
- **Notes orateur cachées** par acte : possible si besoin.
- **Ajuster la longueur d'un acte** si trop ou pas assez fourni à la répétition.
- Éventuellement intégrer de vraies photos d'archives si on bascule vers un hébergement (et qu'on règle les droits).

---

## 10. État actuel (dernière vérif)

Fichier propre : 0 tiret cadratin, balises `<a>` équilibrées (18/18), auteur "Dorian" (plus de "Samuel"), crédit Claude présent en bas de la dernière slide, 11 infobulles, caviardage interactif fonctionnel, 13 illustrations SVG, 12 liens Wikipédia + Seuil + bande-annonce.

**Itération suivante (retours de Dorian, juin 2026), faite :**
- **Animations CSS** ajoutées : entrée échelonnée des éléments de chaque slide (`riseIn`/`figIn`), entrée spécifique des dividers (le grand chiffre glisse, `numIn`), la rature qui se trace toute seule à l'apparition (`strikeIn`), et de nombreux effets au survol (cartes, boutons, questions, tampons, illustrations, couvertures, poster). Tout est désactivé sous `prefers-reduced-motion`.
- **Système de photos réelles** (voir section 5) : slots `<img>` câblés sur slides 5, 7, 9, 12, 13 + `images/README.md` listant quoi télécharger. Fallback SVG/maquette automatique tant que les fichiers manquent.
- **Slide 21 (Trois questions)** : passée en `dense` (alignée en haut) pour ne plus se faire rogner verticalement, espacements resserrés, et le **crédit Claude élargi** (pleine largeur, police plus grande, filet de séparation) pour être bien lisible.

À faire côté Dorian : déposer les images dans `images/` (cf. son README).

**Itération 3 (retours-2, juin 2026), faite :**
- **Liens morts corrigés** : 3 pages FR Wikipédia n'existaient pas. « La politique et la langue anglaise » repointée vers le titre anglais existant (`Politics_and_the_English_Language`). « Tirer sur un éléphant » et « Salle 101 » : liens retirés (texte gardé en italique). Tous les liens restants renvoient 200. Méthode de contrôle : `curl` sur tous les `href` + API de recherche fr.wikipedia.
- **Lightbox** (`#lightbox` + module JS) : clic sur une photo `.zoomable` → ouverture plein écran, fond assombri/flou, **zoom** (clic, molette, +/-), **pan** (glisser quand zoomé), fermeture (✕, clic au fond, Échap). Exclus : images de la slide 9 (bascule censure) et l'affiche du doc (lien bande-annonce). Les covers Viktorovitch restent des liens Seuil (non zoomables).
- **Nouveaux emplacements photo** (même mécanisme img+fallback) : slide 2 couverture de 1984 (`1984-cover.jpg`, repli = fausse couverture CSS `.bc-fake`), slide 6 la dèche (`orwell-deche.jpg`), slide 8 carte d'Espagne (`carte-espagne-1936.jpg`), slide 19 affiche du doc (`orwell-doc-poster.jpg`, repli = poster SVG). SVG conceptuels gardés : slides 11, 15, 16, 17.
- **Slide 21 (Trois questions) re-corrigée** : le vrai bug était `.qlist li{display:flex}`, qui transformait chaque fragment de texte autour des infobulles `.def` en *flex item* séparé (texte éclaté/décalé). Remplacé par numéro en `position:absolute` + `padding-left`, le texte coule normalement.

Crédit en pied de dernière slide : "Présentation co-rédigée avec Claude (Opus 4.8), à partir de mes notes et brouillons, pour les mettre au propre et en forme."
