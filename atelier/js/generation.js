/**
 * generation.js — Système de génération procédurale des cellules hexagonales
 * Implémente les étapes 1 à 9 décrites dans les règles du worldbuilder.
 */

// ─── Environnements ───────────────────────────────────────────────────────────

export const ENVIRONMENTS = [
  'tempéré', 'steppique', 'désertique', 'tropical', 'glacial', 'volcanique', 'maritime',
];

// ─── Biomes par environnement (poids relatifs) ────────────────────────────────

export const BIOMES_BY_ENV = {
  'tempéré': [
    { biome: 'plaine',              weight: 25 },
    { biome: 'colline',             weight: 15 },
    { biome: 'forêt clairsemée',    weight: 15 },
    { biome: 'forêt ancienne',      weight: 10 },
    { biome: 'prairie',             weight: 12 },
    { biome: 'marais',              weight:  8 },
    { biome: 'marécage',            weight:  5 },
    { biome: 'tourbière',           weight:  4 },
    { biome: 'plateau',             weight:  4 },
    { biome: 'versant de montagne', weight:  2 },
  ],
  'steppique': [
    { biome: 'steppe',          weight: 35 },
    { biome: 'prairie sèche',   weight: 25 },
    { biome: 'colline herbeuse', weight: 20 },
    { biome: 'plaine ventée',   weight: 15 },
    { biome: 'plateau aride',   weight:  5 },
  ],
  'désertique': [
    { biome: 'désert de sable', weight: 30 },
    { biome: 'désert de roche', weight: 28 },
    { biome: 'désert de sel',   weight: 12 },
    { biome: 'plateau aride',   weight: 12 },
    { biome: 'canyon aride',    weight: 10 },
    { biome: 'oasis',           weight:  5 },
    { biome: 'colline aride',   weight:  3 },
  ],
  'tropical': [
    { biome: 'jungle dense',      weight: 28 },
    { biome: 'jungle clairsemée', weight: 20 },
    { biome: 'savane',            weight: 18 },
    { biome: 'marécage tropical', weight: 12 },
    { biome: 'mangrove',          weight:  8 },
    { biome: 'forêt noyée',       weight:  8 },
    { biome: 'côte tropicale',    weight:  4 },
    { biome: 'delta',             weight:  2 },
  ],
  'glacial': [
    { biome: 'toundra',         weight: 30 },
    { biome: 'glace permanente', weight: 25 },
    { biome: 'glacier',         weight: 20 },
    { biome: 'plaine enneigée', weight: 15 },
    { biome: 'côte glaciale',   weight:  7 },
    { biome: 'mer de glace',    weight:  3 },
  ],
  'volcanique': [
    { biome: 'champ de lave',      weight: 30 },
    { biome: 'terres brûlées',     weight: 25 },
    { biome: 'plateau volcanique', weight: 20 },
    { biome: 'lac de cratère',     weight: 10 },
    { biome: 'forêt de cendres',   weight: 10 },
    { biome: 'volcan actif',       weight:  5 },
  ],
  'maritime': [
    { biome: 'eau peu profonde',  weight: 30 },
    { biome: 'eau profonde',      weight: 35 },
    { biome: 'côte rocheuse',     weight: 12 },
    { biome: 'côte sablonneuse',  weight: 10 },
    { biome: 'île',               weight:  8 },
    { biome: 'archipel',          weight:  5 },
  ],
};

// ─── Couleurs des biomes ──────────────────────────────────────────────────────

// Palette par environnement : chaque env a une famille de teintes cohérente.
// Tempéré = verts moyens · Steppique = ocre/doré · Désertique = brun chaud
// Tropical = verts profonds · Glacial = bleu-gris froid · Volcanique = rouge sombre · Maritime = bleu océan
export const BIOME_COLORS = {
  // ── Tempéré — verts moyens (HSL ~115-130°, saturation modérée)
  'plaine':              '#8ab568',
  'colline':             '#7a9a58',
  'forêt clairsemée':   '#4d8038',
  'forêt ancienne':      '#2e5c22',
  'prairie':             '#9ec070',
  'marais':              '#4d7850',
  'marécage':            '#406045',
  'tourbière':           '#4a5840',
  'plateau':             '#7a8860',
  'versant de montagne': '#607055',

  // ── Steppique — ocre/doré (HSL ~42-50°)
  'steppe':              '#c4a838',
  'prairie sèche':       '#b08830',
  'colline herbeuse':    '#9a8040',
  'plaine ventée':       '#c0a850',
  'plateau aride':       '#8a7840',

  // ── Désertique — brun chaud (HSL ~28-38°)
  'désert de sable':     '#d4a028',
  'désert de roche':     '#a86838',
  'désert de sel':       '#ddd8b0',
  'canyon aride':        '#884030',
  'oasis':               '#5a8a48',
  'colline aride':       '#908858',

  // ── Tropical — verts profonds saturés (HSL ~128-140°, plus sombres que tempéré)
  'jungle dense':        '#1a5818',
  'jungle clairsemée':   '#287838',
  'savane':              '#928a30',
  'marécage tropical':   '#3a6840',
  'mangrove':            '#286048',
  'forêt noyée':         '#3a6850',
  'côte tropicale':      '#6a9858',
  'delta':               '#4a8058',

  // ── Glacial — bleu-gris froid (HSL ~205-215°)
  'toundra':             '#8aaab5',
  'glace permanente':    '#c0d8e8',
  'glacier':             '#a0c0dc',
  'plaine enneigée':     '#b8ccd8',
  'côte glaciale':       '#7898a8',
  'mer de glace':        '#5080a0',

  // ── Volcanique — rouge sombre / noir (HSL ~0°, très sombre)
  'champ de lave':       '#3a1010',
  'terres brûlées':      '#5a2818',
  'plateau volcanique':  '#6a3820',
  'lac de cratère':      '#304058',
  'forêt de cendres':    '#484838',
  'volcan actif':        '#9a2018',

  // ── Maritime — bleu océan (HSL ~210-220°)
  'eau peu profonde':    '#2a7ab0',
  'eau profonde':        '#1a4878',
  'côte rocheuse':       '#5a6878',
  'côte sablonneuse':    '#c0a868',
  'île':                 '#7a9040',
  'archipel':            '#6a8038',

  // ── Spéciaux maritime + montagne
  'île volcanique':      '#7a2818',
  'île rocheuse':        '#6a6858',
};

// ─── Icônes des biomes ────────────────────────────────────────────────────────

export const BIOME_ICONS = {
  'plaine': '🌾', 'colline': '🗻', 'forêt clairsemée': '🌳', 'forêt ancienne': '🌲',
  'prairie': '🌿', 'marais': '🐸', 'marécage': '🌊', 'tourbière': '🌿',
  'plateau': '⬜', 'versant de montagne': '⛰️',
  'steppe': '🍂', 'prairie sèche': '🌾', 'colline herbeuse': '🗻', 'plaine ventée': '💨',
  'plateau aride': '🪨',
  'désert de sable': '🏜️', 'désert de roche': '🪨', 'désert de sel': '⬜',
  'canyon aride': '🏔️', 'oasis': '🌴', 'colline aride': '🗻',
  'jungle dense': '🌴', 'jungle clairsemée': '🌿', 'savane': '🦁',
  'marécage tropical': '🐊', 'mangrove': '🌿', 'forêt noyée': '🌊',
  'côte tropicale': '🏖️', 'delta': '〰️',
  'toundra': '❄️', 'glace permanente': '☃️', 'glacier': '🧊',
  'plaine enneigée': '❄️', 'côte glaciale': '🌊', 'mer de glace': '🧊',
  'champ de lave': '🌋', 'terres brûlées': '🔥', 'plateau volcanique': '⛰️',
  'lac de cratère': '💧', 'forêt de cendres': '🌫️', 'volcan actif': '🌋',
  'eau peu profonde': '🌊', 'eau profonde': '🌊', 'côte rocheuse': '🏔️',
  'côte sablonneuse': '🏖️', 'île': '🏝️', 'archipel': '🏝️',
  'île volcanique': '🌋', 'île rocheuse': '🏝️',
};

// Couleur associée à chaque environnement (pour l'UI)
export const ENV_COLORS = {
  'tempéré':   '#7eb56a',
  'steppique': '#c4a53a',
  'désertique':'#d4a530',
  'tropical':  '#1a5e2a',
  'glacial':   '#8aabb5',
  'volcanique':'#8a2010',
  'maritime':  '#1a5080',
};

// ─── Paramètres de continuité des environnements (étape 2A) ──────────────────

const ENV_PARAMS = {
  'tempéré':    { seuilMin: 10, palier1:  40, palier2: 100, palier3: 250, probBase: 0.85 },
  'steppique':  { seuilMin:  6, palier1:  25, palier2:  70, palier3: 180, probBase: 0.80 },
  'désertique': { seuilMin:  8, palier1:  35, palier2:  90, palier3: 220, probBase: 0.82 },
  'tropical':   { seuilMin:  6, palier1:  25, palier2:  70, palier3: 180, probBase: 0.80 },
  'glacial':    { seuilMin: 10, palier1:  35, palier2:  90, palier3: 200, probBase: 0.83 },
  'volcanique': { seuilMin:  1, palier1:   5, palier2:  12, palier3:  25, probBase: 0.55 },
  'maritime':   { seuilMin:  8, palier1:  50, palier2: 150, palier3: 400, probBase: 0.88 },
};

// ─── Matrice de transition entre environnements (étape 2B) ───────────────────

const ENV_TRANSITION = {
  'tempéré':    { steppique: 30, désertique:  5, tropical: 20, glacial: 15, volcanique:  5, maritime: 25 },
  'steppique':  { tempéré:   35, désertique: 35, tropical: 10, glacial: 10, volcanique:  5, maritime:  5 },
  'désertique': { steppique: 50, tempéré:    10, tropical: 15, glacial:  0, volcanique: 10, maritime: 15 },
  'tropical':   { tempéré:   35, steppique:  15, désertique: 10, glacial: 0, volcanique: 10, maritime: 30 },
  'glacial':    { tempéré:   40, steppique:  20, désertique:  0, tropical: 0, volcanique:  5, maritime: 35 },
  'volcanique': { tempéré:   25, steppique:  15, désertique: 20, tropical: 20, glacial: 10, maritime: 10 },
  'maritime':   { tempéré:   35, steppique:  10, désertique: 10, tropical: 25, glacial: 20, volcanique: 0 },
};

// ─── Groupes de modificateurs de proximité (étape 5) ─────────────────────────

const PROXIMITY_GROUPS = [
  { biomes: ['forêt ancienne'],                              compatible: ['forêt clairsemée'],                              coeff: 0.40 },
  { biomes: ['forêt clairsemée'],                            compatible: ['forêt ancienne', 'prairie'],                     coeff: 0.30 },
  { biomes: ['jungle dense'],                                compatible: ['jungle clairsemée'],                             coeff: 0.40 },
  { biomes: ['marais', 'marécage', 'tourbière', 'mangrove'], compatible: ['marais', 'marécage', 'tourbière', 'mangrove'],   coeff: 0.35 },
  { biomes: ['colline', 'colline herbeuse', 'colline aride'], compatible: ['versant de montagne', 'plateau', 'plateau aride'], coeff: 0.25 },
  { biomes: ['désert de sable'],                             compatible: ['désert de roche'],                               coeff: 0.35 },
  { biomes: ['glace permanente', 'glacier'],                 compatible: ['glace permanente', 'glacier'],                   coeff: 0.40 },
  { biomes: ['eau profonde'],                                compatible: ['eau peu profonde'],                              coeff: 0.30 },
  { biomes: ['île', 'archipel'],                             compatible: ['île', 'archipel'],                               coeff: 0.20 },
];

// Biomes côtiers (Step 8 continuity)
const COASTAL_BIOMES = ['côte rocheuse', 'côte sablonneuse', 'côte tropicale', 'côte glaciale'];
// Biomes source de rivière (Step 6)
const RIVER_SOURCE_BIOMES = ['versant de montagne', 'glacier', 'lac de cratère'];
// Biomes embouchure de rivière (Step 6)
const RIVER_MOUTH_BIOMES  = ['eau peu profonde', 'eau profonde', 'marais', 'marécage', 'delta', 'mangrove'];

const NEIGHBOR_OFFSETS = [[1,-1],[1,0],[-1,1],[-1,0],[0,1],[0,-1]];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMap(cellules) {
  return new Map(cellules.map(c => [`${c.q},${c.r}`, c]));
}

function getNeighborCells(q, r, cellules) {
  const map = makeMap(cellules);
  return NEIGHBOR_OFFSETS.map(([dq, dr]) => map.get(`${q+dq},${r+dr}`)).filter(Boolean);
}

function weightedPick(items, weightFn) {
  const total = items.reduce((s, x) => s + weightFn(x), 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * total;
  for (const x of items) { r -= weightFn(x); if (r <= 0) return x; }
  return items[items.length - 1];
}

function envOf(cell) { return cell.environnement || 'tempéré'; }

// ─── ÉTAPE 1 : Sélection de la cellule candidate ─────────────────────────────

export function selectCandidateCell(cellules) {
  if (!cellules.length) return { q: 0, r: 0 };

  const map = makeMap(cellules);
  const candidatesMap = new Map();

  for (const cell of cellules) {
    for (const [dq, dr] of NEIGHBOR_OFFSETS) {
      const nq = cell.q + dq, nr = cell.r + dr;
      const key = `${nq},${nr}`;
      if (!map.has(key)) {
        const existing = candidatesMap.get(key);
        if (existing) existing.n++;
        else candidatesMap.set(key, { q: nq, r: nr, n: 1 });
      }
    }
  }

  if (!candidatesMap.size) return null;
  const candidates = [...candidatesMap.values()];
  const chosen = weightedPick(candidates, c => Math.pow(2, c.n));
  return { q: chosen.q, r: chosen.r };
}

// ─── ÉTAPE 2A : Continuité de l'environnement ────────────────────────────────

function getDominantEnv(neighbors) {
  if (!neighbors.length) return null;
  const counts = {};
  for (const n of neighbors) { const e = envOf(n); counts[e] = (counts[e] || 0) + 1; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function getConnectedZoneSize(env, cellules) {
  const envCells = cellules.filter(c => envOf(c) === env);
  if (!envCells.length) return 0;
  const map = makeMap(cellules);
  const visited = new Set();
  const queue = [envCells[0]];
  visited.add(`${envCells[0].q},${envCells[0].r}`);
  while (queue.length) {
    const cell = queue.shift();
    for (const [dq, dr] of NEIGHBOR_OFFSETS) {
      const key = `${cell.q+dq},${cell.r+dr}`;
      if (!visited.has(key)) {
        const nb = map.get(key);
        if (nb && envOf(nb) === env) { visited.add(key); queue.push(nb); }
      }
    }
  }
  return visited.size;
}

function computeContinuityProb(env, zoneSize) {
  const p = ENV_PARAMS[env];
  if (!p) return 0.80;
  if (zoneSize < p.seuilMin) return 0.95;
  let reduction = 0;
  if (zoneSize > p.palier3)      reduction = 0.28;
  else if (zoneSize > p.palier2) reduction = 0.18;
  else if (zoneSize > p.palier1) reduction = 0.08;
  return Math.max(0.10, p.probBase - reduction);
}

// ─── ÉTAPE 2B : Transition entre environnements ───────────────────────────────

function pickFromTransition(fromEnv) {
  const t = ENV_TRANSITION[fromEnv] || {};
  const filtered = Object.entries(t).filter(([, w]) => w > 0);
  if (!filtered.length) return fromEnv;
  return weightedPick(filtered, ([, w]) => w)[0];
}

// ─── ÉTAPE 3 : Barrières naturelles ──────────────────────────────────────────

function applyBarriers(q, r, cellules, continuityProb) {
  const neighbors = getNeighborCells(q, r, cellules);

  // Chaîne de montagne (3+ cellules montagne connectées)
  const mountainNeighbors = neighbors.filter(n => n.montagne);
  if (mountainNeighbors.length >= 1) {
    const map = makeMap(cellules);
    const visited = new Set();
    const queue = [mountainNeighbors[0]];
    visited.add(`${mountainNeighbors[0].q},${mountainNeighbors[0].r}`);
    while (queue.length) {
      const cell = queue.shift();
      for (const [dq, dr] of NEIGHBOR_OFFSETS) {
        const key = `${cell.q+dq},${cell.r+dr}`;
        if (!visited.has(key)) {
          const nb = map.get(key);
          if (nb?.montagne) { visited.add(key); queue.push(nb); }
        }
      }
    }
    if (visited.size >= 3) {
      const changeProb = Math.min(0.90, (1 - continuityProb) * 2.5);
      continuityProb = 1 - changeProb;
    }
  }

  // Rivière large (2+ voisins avec rivière = approximation de rivière ≥ 5)
  const riverNeighbors = neighbors.filter(n => n.riviere);
  if (riverNeighbors.length >= 2) {
    const changeProb = Math.min(0.90, (1 - continuityProb) * 1.3);
    continuityProb = 1 - changeProb;
  }

  return continuityProb;
}

// ─── Détermination de l'environnement (étapes 2 + 3) ────────────────────────

function determineEnvironment(q, r, cellules) {
  const neighbors = getNeighborCells(q, r, cellules);
  if (!neighbors.length) {
    const natural = ENVIRONMENTS.filter(e => e !== 'maritime' && e !== 'volcanique');
    return natural[Math.floor(Math.random() * natural.length)];
  }

  const dominantEnv = getDominantEnv(neighbors);
  const zoneSize    = getConnectedZoneSize(dominantEnv, cellules);
  let continuityProb = computeContinuityProb(dominantEnv, zoneSize);

  // Modificateurs maritimes (étape 8 — seuils bidirectionnels)
  if (dominantEnv === 'maritime') {
    const maritimeCount = cellules.filter(c => envOf(c) === 'maritime').length;
    if (maritimeCount < 5)       continuityProb = Math.min(continuityProb, 0.60);
    else if (maritimeCount >= 20) continuityProb = Math.max(continuityProb, 0.92);
  }

  continuityProb = applyBarriers(q, r, cellules, continuityProb);

  return Math.random() < continuityProb ? dominantEnv : pickFromTransition(dominantEnv);
}

// ─── ÉTAPE 4 + 5 : Biome (+ modificateurs de proximité) ─────────────────────

function pickBiome(environment, q, r, cellules) {
  const neighbors     = getNeighborCells(q, r, cellules);
  const neighborBiomes = neighbors.map(n => n.biome).filter(Boolean);
  let list = (BIOMES_BY_ENV[environment] || []).map(b => ({ ...b }));

  // Étape 9 — clustering îles (maritime uniquement)
  if (environment === 'maritime') {
    const islandNeighborCount = neighborBiomes.filter(b => b === 'île' || b === 'archipel').length;
    const islandProbMap = { 0: 8, 1: 35, 2: 25 };
    const targetIslandW = islandProbMap[Math.min(islandNeighborCount, 2)] ?? 15;
    // Archipel linéaire : même logique d'axe si plusieurs îles alignées
    const islandAxisBonus = islandNeighborCount >= 2 ? getAxisBonus(q, r, cellules, c => c.biome === 'île' || c.biome === 'archipel', 0.20) : 0;
    list = list.map(b => {
      if (b.biome === 'île')    return { ...b, weight: targetIslandW + (islandAxisBonus > 0 ? targetIslandW * islandAxisBonus : 0) };
      if (b.biome === 'archipel') return { ...b, weight: targetIslandW * 0.5 };
      return b;
    });
  }

  // Étape 5 — proximité
  for (const group of PROXIMITY_GROUPS) {
    for (const targetBiome of group.biomes) {
      const compatible = [targetBiome, ...group.compatible];
      const n = neighborBiomes.filter(b => compatible.includes(b)).length;
      if (n > 0) {
        list = list.map(b => b.biome === targetBiome
          ? { ...b, weight: b.weight * (1 + n * group.coeff) }
          : b
        );
      }
    }
  }

  // Étape 8 — continuité côtes
  const coastNeighborCount = neighborBiomes.filter(b => COASTAL_BIOMES.includes(b)).length;
  if (coastNeighborCount >= 1) {
    list = list.map(b => COASTAL_BIOMES.includes(b.biome)
      ? { ...b, weight: b.weight * (1 + coastNeighborCount * 0.75) }
      : b
    );
  }

  return weightedPick(list, b => Math.max(0, b.weight)).biome;
}

// ─── ÉTAPE 6 : Rivières ──────────────────────────────────────────────────────

function computeRiver(environment, biome, q, r, cellules) {
  if (environment === 'maritime') return false;

  const baseProbs = {
    'tempéré': 0.25, 'tropical': 0.30, 'glacial': 0.20,
    'steppique': 0.12, 'désertique': 0.05, 'volcanique': 0.08,
  };

  let prob = baseProbs[environment] ?? 0.10;
  const neighbors = getNeighborCells(q, r, cellules);
  const riverNeighbors = neighbors.filter(n => n.riviere);

  if (riverNeighbors.length >= 1) prob = Math.max(prob, 0.85);
  if (riverNeighbors.length >= 1 && neighbors.every(n => n.riviere || envOf(n) === 'maritime')) prob = 1.0;

  if (RIVER_SOURCE_BIOMES.includes(biome)) prob = Math.min(1, prob + 0.15);
  if (RIVER_MOUTH_BIOMES.includes(biome))  prob = Math.min(1, prob + 0.20);

  return Math.random() < prob;
}

// ─── ÉTAPE 7 : Montagnes ─────────────────────────────────────────────────────

function computeMountain(environment, q, r, cellules) {
  if (environment === 'maritime') return false;

  const neighbors = getNeighborCells(q, r, cellules);
  const mountainCount = neighbors.filter(n => n.montagne).length;

  let prob = 0.08;
  if (mountainCount === 1)      prob += 0.20;
  else if (mountainCount === 2) prob += 0.35;
  else if (mountainCount >= 3)  prob += 0.50;

  if (mountainCount >= 2) {
    prob += getAxisBonus(q, r, cellules, c => c.montagne, 0.25);
  }

  return Math.random() < prob;
}

// ─── Axe d'allongement (montagnes et archipels) ───────────────────────────────

function getAxisBonus(q, r, cellules, predicate, bonusValue) {
  const seedNeighbors = getNeighborCells(q, r, cellules).filter(predicate);
  if (!seedNeighbors.length) return 0;

  // BFS sur la zone connectée
  const map = makeMap(cellules);
  const visited = new Set();
  const queue = [seedNeighbors[0]];
  visited.add(`${seedNeighbors[0].q},${seedNeighbors[0].r}`);
  const zone = [];
  while (queue.length) {
    const cell = queue.shift();
    zone.push(cell);
    for (const [dq, dr] of NEIGHBOR_OFFSETS) {
      const key = `${cell.q+dq},${cell.r+dr}`;
      if (!visited.has(key)) {
        const nb = map.get(key);
        if (nb && predicate(nb)) { visited.add(key); queue.push(nb); }
      }
    }
  }
  if (zone.length < 2) return 0;

  // Conversion en pixels flat-top
  const SQRT3 = Math.sqrt(3);
  const pts = zone.map(c => ({ x: 1.5 * c.q, y: SQRT3 * (c.r + c.q / 2) }));
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

  // Covariance → axe principal
  let cxx = 0, cxy = 0, cyy = 0;
  for (const p of pts) {
    const dx = p.x - cx, dy = p.y - cy;
    cxx += dx * dx; cxy += dx * dy; cyy += dy * dy;
  }
  const axisAngle = Math.atan2(2 * cxy, cxx - cyy) / 2;

  // Angle de la cellule candidate par rapport au centre
  const candX = 1.5 * q, candY = SQRT3 * (r + q / 2);
  const candAngle = Math.atan2(candY - cy, candX - cx);

  let diff = Math.abs(candAngle - axisAngle) % Math.PI;
  if (diff > Math.PI / 2) diff = Math.PI - diff;

  const DEG30 = Math.PI / 6;
  const DEG45 = Math.PI / 4;

  if (diff <= DEG30)  return bonusValue;       // Dans l'axe : bonus
  if (diff > DEG45)   return -0.10;            // Perpendiculaire : malus
  return 0;
}

// ─── Fonction maître de génération ───────────────────────────────────────────

export function generateCell(cellules) {
  // Première cellule
  if (!cellules.length) {
    const natural = ENVIRONMENTS.filter(e => e !== 'maritime' && e !== 'volcanique');
    const env = natural[Math.floor(Math.random() * natural.length)];
    const biomeList = BIOMES_BY_ENV[env].filter(b => !COASTAL_BIOMES.includes(b.biome));
    const biome = weightedPick(biomeList, b => b.weight).biome;
    return { q: 0, r: 0, environnement: env, biome, montagne: false, riviere: false };
  }

  const pos = selectCandidateCell(cellules);
  if (!pos) return null;
  const { q, r } = pos;

  const environnement = determineEnvironment(q, r, cellules);
  let biome = pickBiome(environnement, q, r, cellules);
  const montagne = computeMountain(environnement, q, r, cellules);

  // Montagne en milieu maritime → île spéciale
  if (environnement === 'maritime' && montagne) {
    const hasVolcNeighbor = getNeighborCells(q, r, cellules).some(n => envOf(n) === 'volcanique');
    biome = hasVolcNeighbor ? 'île volcanique' : 'île rocheuse';
  }

  const riviere = computeRiver(environnement, biome, q, r, cellules);

  return { q, r, environnement, biome, montagne, riviere };
}
