// progression-chart.js — graphique d'évolution des lectures (partagé).
// Utilisé par l'accueil (livre du mois) ET par la fiche d'un livre élu dans la
// bibliothèque. Le graphe est strictement identique : seul le mois de lecture
// (monthStart = 1er jour du mois) change selon le contexte.

// Palette : doit suivre l'ordre de getMembres() pour que les couleurs des
// membres soient stables d'une page à l'autre.
const PALETTE = ['#b5572d','#1a8a55','#3f6cc4','#8a5cc4','#c4923f','#c44d6a','#2f9e9e','#6b7b3a','#9c4dab','#4f6b8a'];

export function memberColor(membres, id) {
  const idx = membres.findIndex(m => m.id === id);
  return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Construit les séries (une par membre) à partir des points de progression_lecture,
// bornées au mois de lecture (monthStart). Renvoie [] si rien à tracer.
export function buildSeries(points, membres, monthStart) {
  if (!points || !points.length) return [];
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
  const totalMs = monthEnd - monthStart;

  const byMembre = {};
  points.forEach(p => {
    const ts = toDate(p.horodatage);
    if (!ts || ts < monthStart) return;
    if (!byMembre[p.membre_id]) byMembre[p.membre_id] = [];
    byMembre[p.membre_id].push({ ts, pct: p.pages_totales ? Math.min(100, Math.round(p.page_actuelle / p.pages_totales * 100)) : 0 });
  });

  const nom = id => membres.find(m => m.id === id)?.nom ?? '—';
  return Object.entries(byMembre)
    .filter(([, pts]) => pts.length > 0)
    .map(([id, pts]) => {
      pts.sort((a, b) => a.ts - b.ts);
      const series = [{ frac: 0, pct: 0 }, ...pts.map(p => ({ frac: Math.min(1, (p.ts - monthStart) / totalMs), pct: p.pct }))];
      return { id, nom: nom(id), color: memberColor(membres, id), points: series };
    });
}

// Graphique complet — axe X = jours du mois (1 → dernier jour), axe Y = % avancement.
export function buildChartSVG(series, monthStart, opts = {}) {
  const W = opts.w || 860, H = opts.h || 300;
  const padL = 38, padR = 110, padT = 18, padB = 32;
  const xFn = frac => padL + frac * (W - padL - padR);
  const yFn = v => padT + (1 - v / 100) * (H - padT - padB);
  let g = '';
  [0, 25, 50, 75, 100].forEach(v => {
    g += `<line class="grid-line${v === 0 ? ' zero' : ''}" x1="${padL}" y1="${yFn(v)}" x2="${W - padR}" y2="${yFn(v)}"/>`;
    g += `<text class="axis-lbl" x="${padL - 8}" y="${yFn(v) + 4}" text-anchor="end">${v}%</text>`;
  });
  // axe horizontal — jours du mois (1 → dernier jour)
  const nbJours = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  [...new Set([1, 5, 10, 15, 20, 25, nbJours])].forEach(d => {
    const x = xFn((d - 1) / nbJours);
    if (d > 1) g += `<line class="grid-line vday" x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${yFn(0)}"/>`;
    g += `<text class="axis-lbl" x="${x.toFixed(1)}" y="${H - padB + 17}" text-anchor="middle">${d}</text>`;
  });
  const ends = [];
  series.forEach(s => {
    const pts = s.points.map(p => ({ x: xFn(p.frac), y: yFn(p.pct) }));
    g += `<path class="series-line" data-m="${esc(s.id)}" d="${smoothPath(pts)}" stroke="${s.color}"/>`;
    pts.forEach(p => { g += `<circle class="series-dot" data-m="${esc(s.id)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.6" fill="${s.color}"/>`; });
    const last = pts[pts.length - 1];
    g += `<circle data-m="${esc(s.id)}" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="4" fill="${s.color}"/>`;
    ends.push({ id: s.id, nom: s.nom, pct: s.points[s.points.length - 1].pct, col: s.color, x: last.x, y: last.y });
  });
  // dé-collision des labels
  const GAP = 14, minY = padT + 4, maxY = H - padB;
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) { if (ends[i].y - ends[i - 1].y < GAP) ends[i].y = ends[i - 1].y + GAP; }
  const ov = ends.length ? ends[ends.length - 1].y - maxY : 0;
  if (ov > 0) ends.forEach(l => l.y = Math.max(minY, l.y - ov));
  ends.forEach(l => { g += `<text class="end-lbl" data-m="${esc(l.id)}" x="${(l.x + 9).toFixed(1)}" y="${(l.y + 3.5).toFixed(1)}" fill="${l.col}">${esc(l.nom)} ${Math.round(l.pct)}%</text>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
}

export function buildSparkSVG(series) {
  const W = 130, H = 46, padT = 4, padB = 4;
  const xFn = frac => frac * W;
  const yFn = v => padT + (1 - v / 100) * (H - padT - padB);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${series.slice(0, 5).map(s => {
      const pts = s.points.map(p => ({ x: xFn(p.frac), y: yFn(p.pct) }));
      return `<path d="${smoothPath(pts)}" fill="none" stroke="${s.color}" stroke-width="1.6" stroke-linecap="round"/>`;
    }).join('')}
  </svg>`;
}

export function buildLegendHTML(series) {
  return `<div class="legend">${series.map(s => `<span class="lg" data-m="${esc(s.id)}"><i style="background:${s.color}"></i>${esc(s.nom)}</span>`).join('')}</div>`;
}

export function wireHighlight(root) {
  const svg = root.querySelector('svg.chart');
  if (!svg) return;
  root.querySelectorAll('.lg').forEach(lg => {
    lg.addEventListener('mouseenter', () => {
      svg.classList.add('dim');
      svg.querySelectorAll(`[data-m="${lg.dataset.m}"]`).forEach(e => e.classList.add('hl'));
    });
    lg.addEventListener('mouseleave', () => {
      svg.classList.remove('dim');
      svg.querySelectorAll('.hl').forEach(e => e.classList.remove('hl'));
    });
  });
}
