// ─── Mots clés généraux (pour les cellules de la carte) ─────────────────────

export const MK = {
  sensations: [
    "brume épaisse", "silence absolu", "chaleur étouffante", "odeur de soufre", "froid mordant",
    "lumière dorée", "ombres mouvantes", "écho lointain", "humidité pesante", "vent constant",
    "poussière en suspension", "obscurité totale", "parfum de résine", "vibration sourde", "crépitement",
    "air raréfié", "moiteur collante", "senteur de terre mouillée", "lumière blafarde", "bourdonnement lointain",
    "odeur de sel marin", "chaleur sèche", "souffle glacé", "brouillard épais", "fumée âcre",
    "odeur métallique", "fraîcheur souterraine", "vent mugissant", "lumière verdâtre", "picotement électrique",
    "odeur de cendre", "murmures inaudibles", "pluie imminente", "silence de prédateur", "craquements continus",
    "senteur florale entêtante", "air salin", "chaleur radiante", "froid pénétrant", "odeur de moisi"
  ],
  couleurs: [
    "ocre brûlé", "ardoise grise", "mousse émeraude", "obsidienne noire", "ivoire craquelé",
    "rouille orangée", "craie blanche", "ambre translucide", "lichen gris-vert", "cendre froide",
    "argile rouge", "bronze patiné", "écorce rugueuse", "sel cristallisé", "neige sale",
    "basalte noir", "quartz laiteux", "tourbe sombre", "vermillon passé", "indigo délavé",
    "calcaire blanc", "jais brillant", "malachite verte", "cuivre oxydé", "granit gris",
    "silex gris-bleu", "schiste ardoisé", "jade pâle", "porphyre violet", "terra cotta",
    "cramoisi fané", "soufre jaune", "limon brun", "lichens argentés", "sédiment noir",
    "sable doré", "glaise grise", "marbre veiné", "bois blanchi", "roc sombre"
  ],
  faune: [
    "migration saisonnière", "terrier profond", "prédateur apex", "charognard opportuniste", "essaim dense",
    "territoire délimité", "hibernation profonde", "venin paralysant", "symbiose rare", "camouflage parfait",
    "nid communautaire", "meute organisée", "cornes spiralées", "écailles iridescentes", "plumes colorées",
    "mue annuelle", "bioluminescence", "carcasse abandonnée", "griffes recourbées", "vision nocturne",
    "instinct de chasse", "piste fraîche", "empreintes multiples", "cri d'alarme", "tanière cachée",
    "nocturnité absolue", "odorat développé", "carapace épaisse", "appendices nombreux", "territoire disputé",
    "prédation silencieuse", "comportement collectif", "réserves de nourriture", "trophée de chasse", "terrier abandonné"
  ],
  civilisation: [
    "fondation ancienne", "abandon récent", "gravure runique", "muraille effondrée", "commerce florissant",
    "dette oubliée", "mémoire collective", "interdit ancestral", "frontière disputée", "ruine récente",
    "offrande ritualisée", "surveillance permanente", "exil prononcé", "contrebande organisée", "traité oublié",
    "charte fondatrice", "code des anciens", "impôt en nature", "caserne abandonnée", "sépulture profanée",
    "archives brûlées", "symbole dynastique", "sceau brisé", "place de marché", "aqueduc en ruine",
    "forge abandonnée", "temple désaffecté", "carte annotée", "testament gravé", "colonne de victoire",
    "pont effondré", "mur de lamentations", "puits asséché", "bornage territorial", "monument funéraire"
  ],
  emotions: [
    "méfiance instinctive", "nostalgie profonde", "fierté blessée", "curiosité malsaine", "sérénité fragile",
    "tension latente", "deuil récent", "espoir naïf", "résignation tranquille", "euphorie passagère",
    "solitude choisie", "amertume ancienne", "terreur sourde", "émerveillement sincère", "désespoir discret",
    "culpabilité refoulée", "colère froide", "obsession tranquille", "mélancolie profonde", "vénération craintive",
    "honte ancestrale", "exaltation précaire", "indifférence feinte", "tendresse interdite", "révérence silencieuse",
    "impatience rongeuse", "soulagement coupable", "orgueil blessé", "attachement irrationnel", "compassion épuisée"
  ],
  dynamiques: [
    "déclin lent", "renaissance inattendue", "mutation progressive", "invasion brutale", "oubli collectif",
    "transmission fragile", "rupture irréparable", "cycle immuable", "dégradation constante", "révélation tardive",
    "exode massif", "stagnation prolongée", "effondrement soudain", "convergence forcée", "fragmentation progressive",
    "expansion incontrôlée", "résurrection partielle", "contamination silencieuse", "purge violente", "migration forcée",
    "assimilation progressive", "isolement volontaire", "hybridation féconde", "résistance tenace", "catalyse inattendue",
    "basculement définitif", "épuisement des ressources", "accumulation lente", "dispersion des forces", "résilience improbable"
  ],
  magique: [
    "présage ambigu", "anomalie inexplicable", "résonance ancienne", "trace inexplicable", "souvenir emprunté",
    "écho d'un autre temps", "marque invisible", "attraction inexpliquée", "répulsion instinctive", "distorsion locale"
  ],
};

// ─── Mots clés par type d'oracle ────────────────────────────────────────────

export const ORACLE_TYPES = [
  { id: "creature",   label: "Créer une créature ou un animal" },
  { id: "plante",     label: "Créer une plante ou un élément naturel" },
  { id: "personnage", label: "Créer un personnage" },
  { id: "faction",    label: "Créer une faction ou un groupe" },
  { id: "legende",    label: "Créer une légende ou un mythe" },
  { id: "objet",      label: "Créer un objet remarquable" },
  { id: "coutume",    label: "Décrire une coutume ou une pratique culturelle" },
  { id: "phenomene",  label: "Décrire un phénomène naturel ou magique" },
];

export const ORACLE_MK = {
  creature: [
    "venin paralysant", "camouflage parfait", "bioluminescence", "cornes spiralées", "écailles iridescentes",
    "meute organisée", "symbiose rare", "nocturnité absolue", "instinct de chasse", "carcasse massive",
    "territoire disputé", "vision thermique", "plumes colorées", "mue annuelle", "appendices nombreux",
    "prédateur apex", "charognard opportuniste", "comportement collectif", "hibernation longue", "empreinte distinctive",
    "cri reconnaissable", "odorat surdéveloppé", "carapace régénérante", "sonar naturel", "résistance au froid",
    "nid souterrain", "reproduction lente", "alimentation unique", "lien symbiotique", "comportement de parade"
  ],
  plante: [
    "sève translucide", "racines profondes", "floraison nocturne", "parfum enivrant", "épines recourbées",
    "feuilles coriaces", "symbiose fongique", "propagation agressive", "toxines de défense", "bioluminescence végétale",
    "cycle de trente ans", "pollen mordoré", "fruits amers", "écorce protectrice", "croissance tordue",
    "spores envahissantes", "pollinisateur rare", "parasitisme lent", "résine précieuse", "tige creuse",
    "sensibilité aux vibrations", "racines aériennes", "floraison unique", "adaptation extrême", "carnivorie passive",
    "colonisation rapide", "terrain hostile requis", "sol acide nécessaire", "ombre totale", "lumière filtrée"
  ],
  personnage: [
    "exilé volontaire", "érudit isolé", "marchand itinérant", "guérisseur controversé", "explorateur obsessionnel",
    "gardien solitaire", "réfugié silencieux", "artisan brillant", "prophète douteux", "guerrier retraité",
    "espion dormant", "collectionneur maniaque", "pèlerin fervent", "herboriste solitaire", "mémorialiste oublié",
    "juge errant", "contrebandier habile", "ermite philosophe", "messager rapide", "alchimiste vieillissant",
    "déserteur repenti", "héritier déchu", "traducteur rare", "cartographe obsédé", "gardien de mémoire"
  ],
  faction: [
    "serment fondateur", "hiérarchie secrète", "rituel d'intégration", "territoire revendiqué", "rivalité ancienne",
    "code d'honneur strict", "symbole distinctif", "recrutement sélectif", "réseau de contacts", "idéologie commune",
    "ennemi juré", "fondateur légendaire", "discipline martiale", "ressource contrôlée", "influence croissante",
    "dissolution imminente", "scission interne", "alliance de circonstance", "traître au sein", "mémoire collective",
    "rôle protecteur", "exactions passées", "rédemption recherchée", "reconnaissance officielle refusée", "financement opaque"
  ],
  legende: [
    "origine oubliée", "héros fondateur", "malédiction ancienne", "objet sacré perdu", "lieu interdit",
    "prophétie vague", "sacrifice fondateur", "ennemi primordial", "ère d'or perdue", "retour annoncé",
    "dieux absents", "pacte brisé", "gardien endormi", "épreuve initiatique", "récit contradictoire",
    "témoin impossible", "artefact disparu", "cycle de mille ans", "punition divine", "rédemption incomplète",
    "enfant élu", "trahison originelle", "passage vers l'au-delà", "mort injuste", "promesse non tenue"
  ],
  objet: [
    "matériau inconnu", "fonctionnement mystérieux", "transmission héréditaire", "répliques imparfaites", "valeur symbolique",
    "pouvoir décroissant", "contexte de création perdu", "usure particulière", "marque du créateur", "usage détourné",
    "poids surprenant", "réaction contextuelle", "propriétaire précédent notable", "copie ou original incertain", "indestructibilité apparente",
    "lien spirituel", "chaleur anormale", "inscription indéchiffrable", "attirance inexpliquée", "répulsion instinctive",
    "brisé mais fonctionnel", "propriété cachée", "provenance disputée", "restauration impossible", "copie parfaite existante"
  ],
  coutume: [
    "interdiction ancestrale", "rite de passage", "saison spécifique", "transmission orale exclusive", "accessibilité restreinte",
    "symboles portés", "nourriture rituelle", "geste codifié", "durée précise", "participation collective obligatoire",
    "rôle du chef", "sanction en cas de transgression", "origine mythique", "variantes régionales", "en voie de disparition",
    "observance contrainte", "pèlerinage annuel", "jeûne initiatique", "marque corporelle", "costume distinctif",
    "exclusion des étrangers", "adaptation moderne", "tension générationnelle", "récompense symbolique", "punition collective"
  ],
  phenomene: [
    "cyclique", "localisation précise", "durée variable", "effets mesurables", "témoin survivant",
    "précédents historiques", "théories contradictoires", "zone d'exclusion", "rituels protecteurs associés", "bénéfices secondaires",
    "anomalies résiduelles", "origine débattue", "lien avec d'autres phénomènes", "documentation lacunaire", "résurgence récente",
    "effets sonores", "modification des sens", "attraction animale", "peur instinctive", "marque indélébile",
    "progression géographique", "intensité croissante", "inversion saisonnière", "immunité rare", "rituel d'arrêt"
  ],
};

// ─── Mots clés par type d'événement ─────────────────────────────────────────

export const EVENEMENT_TYPES = [
  { id: "naturel",     label: "Événement naturel",            exemples: "séisme, inondation, éruption, tempête, sécheresse, épidémie" },
  { id: "population",  label: "Mouvement de population",      exemples: "migration, exode, colonisation, pèlerinage" },
  { id: "conflit",     label: "Conflit",                      exemples: "guerre, raid, révolte, siège, escarmouche" },
  { id: "decouverte",  label: "Découverte",                   exemples: "ressource, ruine, passage, créature inconnue" },
  { id: "politique",   label: "Événement politique",          exemples: "alliance, trahison, couronnement, chute d'un dirigeant" },
  { id: "mystere",     label: "Événement mystérieux ou magique", exemples: "apparition, malédiction, prodige, disparition" },
];

export const EVENEMENT_MK = {
  naturel: [
    "soudaineté foudroyante", "progression lente", "zone dévastée", "signes précurseurs ignorés", "durée prolongée",
    "répliques secondaires", "saison inhabituelle", "reconstruction nécessaire", "réfugiés nombreux", "ressources détruites",
    "terrain modifié durablement", "faune déplacée", "eau contaminée", "accès bloqué", "récit des survivants",
    "avertissements méprisés", "préparation insuffisante", "aide tardive", "mémoire collective", "répétition redoutée"
  ],
  population: [
    "provenance lointaine", "destination incertaine", "durée du voyage", "ressources épuisées en route", "guide controversé",
    "tension avec les locaux", "maladie contractée en route", "pertes en chemin", "accueil mitigé", "intégration difficile",
    "culture préservée", "nostalgie collective", "enfants nés en route", "retour impossible", "nouvelle identité forgée",
    "dettes contractées", "langues incomprises", "rumeurs les précédant", "faux espoirs", "promesses non tenues"
  ],
  conflit: [
    "cause initiale disputée", "parties multiples impliquées", "victimes civiles nombreuses", "vainqueur temporaire", "ressource contestée",
    "médiateur échoué", "traité non respecté", "vengeance latente", "conséquences économiques graves", "traumatismes durables",
    "mercenaires impliqués", "trahison interne décisive", "siège prolongé", "fuite précipitée", "récupération lente",
    "alliances surprenantes", "pillage organisé", "prisonniers non rendus", "frontières redessinées", "rancœur silencieuse"
  ],
  decouverte: [
    "profondeur inattendue", "état de conservation remarquable", "première réaction contradictoire", "implications politiques", "valeur estimée considérable",
    "disputes de propriété immédiates", "dangers associés", "documentation partielle", "mythes locaux confirmés", "exploitation prématurée",
    "gardien inattendu", "accès difficile", "datation incertaine", "revendications multiples", "conséquences imprévues",
    "secret tenté", "fuite d'information", "expédition précipitée", "destruction accidentelle", "copie réalisée avant saisie"
  ],
  politique: [
    "succession disputée", "alliances modifiées brutalement", "traité signé sous pression", "dette annulée", "nouveau dirigeant controversé",
    "réforme imposée par la force", "exil prononcé sans retour", "cérémonie publique détournée", "résistance passive organisée", "conséquences à long terme imprévisibles",
    "loyauté divisée", "corruption révélée tardivement", "marionnette politique exposée", "intérêts étrangers dévoilés", "stabilité précaire maintenue",
    "accord secret révélé", "héritier écarté", "conseil divisé", "légitimité contestée", "coup sans sang"
  ],
  mystere: [
    "sans explication rationnelle", "témoins peu nombreux", "zone délimitée précisément", "récurrence possible redoutée", "tentative de reproduction échouée",
    "réaction des locaux divisée", "lien avec phénomènes anciens", "documentation censurée", "théories interdites", "résidu observable",
    "silence des autorités suspect", "disparition soudaine inexpliquée", "vision collective", "temps perturbé localement", "retour impossible",
    "animaux fuyant la zone", "végétation affectée", "traces inconnues", "odeur persistante inexpliquée", "mémoire altérée des témoins"
  ],
};

// ─── Biomes ──────────────────────────────────────────────────────────────────

export const BIOMES = [
  "forêt dense", "forêt clairsemée", "plaine", "montagne", "haute montagne",
  "colline", "désert", "toundra", "marais", "côte",
  "mer peu profonde", "océan", "île", "jungle", "volcan",
  "ruines", "village", "ville", "forteresse", "temple",
  "mine", "route commerciale", "col de montagne", "grotte", "delta fluvial",
];

export const BIOMES_NATURELS = [
  "forêt dense", "forêt clairsemée", "plaine", "montagne", "haute montagne",
  "colline", "désert", "toundra", "marais", "côte",
  "mer peu profonde", "océan", "île", "jungle", "volcan", "delta fluvial",
];

export const BIOMES_CIVILS = [
  "village", "ville", "forteresse", "temple", "mine",
];

export const BIOME_COLORS = {
  "forêt dense":       "#1e4d1a",
  "forêt clairsemée":  "#3a6b2d",
  "plaine":            "#6b8c40",
  "montagne":          "#6b5e50",
  "haute montagne":    "#a8a0a0",
  "colline":           "#8c7a55",
  "désert":            "#c4952a",
  "toundra":           "#8aabb5",
  "marais":            "#3d6640",
  "côte":              "#b09c55",
  "mer peu profonde":  "#3a9ec0",
  "océan":             "#1a5080",
  "île":               "#b0a845",
  "jungle":            "#1a5020",
  "volcan":            "#801a10",
  "ruines":            "#6b5a45",
  "village":           "#b06828",
  "ville":             "#706868",
  "forteresse":        "#484038",
  "temple":            "#9a8060",
  "mine":              "#585048",
  "route commerciale": "#b09050",
  "col de montagne":   "#988878",
  "grotte":            "#403028",
  "delta fluvial":     "#4a8050",
};

export const BIOME_ICONS = {
  "forêt dense":       "🌲",
  "forêt clairsemée":  "🌳",
  "plaine":            "🌾",
  "montagne":          "⛰️",
  "haute montagne":    "🏔️",
  "colline":           "🗻",
  "désert":            "🏜️",
  "toundra":           "❄️",
  "marais":            "🌿",
  "côte":              "🏖️",
  "mer peu profonde":  "🌊",
  "océan":             "🌊",
  "île":               "🏝️",
  "jungle":            "🌴",
  "volcan":            "🌋",
  "ruines":            "🏚️",
  "village":           "🏘️",
  "ville":             "🏙️",
  "forteresse":        "🏯",
  "temple":            "⛩️",
  "mine":              "⛏️",
  "route commerciale": "🛤️",
  "col de montagne":   "🗻",
  "grotte":            "🕳️",
  "delta fluvial":     "〰️",
};

// ─── Règles de proximité biomes ──────────────────────────────────────────────
// Pour chaque biome voisin, poids relatifs vers chaque autre biome.
// _default = poids de base pour les biomes non listés.

export const BIOME_WEIGHTS = {
  "océan":             { "océan": 8, "mer peu profonde": 6, "côte": 2, "île": 1, _default: 0 },
  "mer peu profonde":  { "mer peu profonde": 5, "océan": 4, "côte": 7, "île": 3, "delta fluvial": 3, _default: 0.1 },
  "côte":              { "mer peu profonde": 5, "océan": 2, "plaine": 4, "marais": 3, "delta fluvial": 4, "village": 2, _default: 0.8 },
  "forêt dense":       { "forêt dense": 6, "forêt clairsemée": 5, "colline": 2, "marais": 2, "jungle": 2, _default: 0.3 },
  "forêt clairsemée":  { "forêt clairsemée": 5, "forêt dense": 4, "plaine": 4, "colline": 3, "village": 1.5, _default: 0.8 },
  "plaine":            { "plaine": 5, "forêt clairsemée": 3, "colline": 3, "désert": 1.5, "village": 2, "route commerciale": 2, _default: 1 },
  "montagne":          { "montagne": 6, "haute montagne": 4, "colline": 4, "col de montagne": 3, "grotte": 2, "volcan": 1, _default: 0.3 },
  "haute montagne":    { "haute montagne": 6, "montagne": 5, "col de montagne": 3, "volcan": 2, "toundra": 2, _default: 0.1 },
  "colline":           { "colline": 4, "montagne": 3, "forêt clairsemée": 3, "plaine": 3, "mine": 1.5, _default: 1 },
  "désert":            { "désert": 7, "plaine": 3, "colline": 2, _default: 0.2 },
  "toundra":           { "toundra": 7, "haute montagne": 3, "plaine": 2, _default: 0.2 },
  "marais":            { "marais": 5, "côte": 3, "delta fluvial": 4, "forêt dense": 2, _default: 0.3 },
  "île":               { "mer peu profonde": 5, "océan": 3, "côte": 2, _default: 0.3 },
  "jungle":            { "jungle": 6, "forêt dense": 4, "marais": 2, "côte": 2, _default: 0.2 },
  "volcan":            { "volcan": 3, "haute montagne": 4, "montagne": 3, _default: 0.2 },
  "ruines":            { "plaine": 3, "forêt clairsemée": 3, "désert": 3, "colline": 2, _default: 0.8 },
  "village":           { "plaine": 5, "forêt clairsemée": 3, "côte": 2, "colline": 2, "route commerciale": 3, "village": 0.3, "ville": 0.2, _default: 0.8 },
  "ville":             { "plaine": 5, "route commerciale": 4, "colline": 2, "côte": 2, "village": 2, "ville": 0.1, _default: 0.5 },
  "forteresse":        { "montagne": 4, "colline": 4, "plaine": 3, "col de montagne": 3, _default: 0.5 },
  "temple":            { "forêt dense": 3, "montagne": 3, "ruines": 3, "plaine": 2, _default: 0.5 },
  "mine":              { "montagne": 5, "colline": 4, "haute montagne": 3, _default: 0.3 },
  "route commerciale": { "plaine": 5, "colline": 3, "forêt clairsemée": 2, "village": 3, "ville": 2, _default: 0.5 },
  "col de montagne":   { "montagne": 5, "haute montagne": 4, "colline": 3, _default: 0.2 },
  "grotte":            { "montagne": 5, "colline": 3, "haute montagne": 3, _default: 0.2 },
  "delta fluvial":     { "côte": 5, "mer peu profonde": 3, "marais": 4, "plaine": 3, _default: 0.4 },
};

// ─── Génération de mots clés pour une cellule ───────────────────────────────
// Retourne 3 mots clés : 1 sensation, 1 couleur, 1 faune/civilisation selon biome

export function genMotsClesCellule(biome) {
  const { pickRandom } = _picks;
  const isCivil = BIOMES_CIVILS.includes(biome);
  const pool3 = isCivil ? MK.civilisation : MK.faune;
  return [
    pickRandom(MK.sensations),
    pickRandom(MK.couleurs),
    pickRandom(pool3),
  ];
}

export function genMotsClesOracle(typeId, n = 4) {
  const { pickRandom: pr } = _picks;
  const pool = ORACLE_MK[typeId] || [];
  return _pickN(pool, n);
}

export function genMotsClesEvenement(typeId, n = 4) {
  const pool = EVENEMENT_MK[typeId] || [];
  return _pickN(pool, n);
}

function _pickN(arr, n) {
  const copy = [...arr];
  const res = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    res.push(copy.splice(idx, 1)[0]);
  }
  return res;
}

// Référence interne à pickRandom (pour éviter import circulaire)
const _picks = {
  pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
};

// ─── Sélection de biome pondérée ─────────────────────────────────────────────

export function chooseBiome(neighborBiomes) {
  if (neighborBiomes.length === 0) {
    return BIOMES_NATURELS[Math.floor(Math.random() * BIOMES_NATURELS.length)];
  }

  // Moyenne des poids de tous les voisins
  const totals = {};
  for (const b of BIOMES) totals[b] = 0;

  for (const nb of neighborBiomes) {
    const wmap = BIOME_WEIGHTS[nb] || {};
    const def = wmap._default ?? 1;
    for (const b of BIOMES) {
      totals[b] += (wmap[b] !== undefined ? wmap[b] : def) / neighborBiomes.length;
    }
  }

  // Contrainte civile : si aucun voisin naturel → réduire les biomes civils
  const hasNaturalNeighbor = neighborBiomes.some(nb => BIOMES_NATURELS.includes(nb));
  if (!hasNaturalNeighbor) {
    for (const b of BIOMES_CIVILS) totals[b] = Math.min(totals[b], 0.1);
  }

  // Tirage pondéré
  const keys = Object.keys(totals);
  const vals = keys.map(k => Math.max(0, totals[k]));
  const total = vals.reduce((a, b) => a + b, 0);
  if (total <= 0) return BIOMES_NATURELS[Math.floor(Math.random() * BIOMES_NATURELS.length)];

  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= vals[i];
    if (r <= 0) return keys[i];
  }
  return keys[keys.length - 1];
}
