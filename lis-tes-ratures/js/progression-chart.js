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
  // Mois déjà terminé : on prolonge la dernière valeur connue de chaque membre
  // jusqu'au bord droit (courbe « finie » plutôt que tronquée au milieu). Pour
  // le mois en cours, on s'arrête au dernier point réel (graphe accueil inchangé).
  const isPastMonth = monthEnd.getTime() < Date.now();

  const byMembre = {};
  points.forEach(p => {
    const ts = toDate(p.horodatage);
    if (!ts || ts < monthStart) return;
    if (!byMembre[p.membre_id]) byMembre[p.membre_id] = [];
    byMembre[p.membre_id].push({
      ts,
      pct: p.pages_totales ? Math.min(100, Math.round(p.page_actuelle / p.pages_totales * 100)) : 0,
      page: p.page_actuelle ?? null,
      total: p.pages_totales ?? null,
    });
  });

  const nom = id => membres.find(m => m.id === id)?.nom ?? '—';
  return Object.entries(byMembre)
    .filter(([, pts]) => pts.length > 0)
    .map(([id, pts]) => {
      pts.sort((a, b) => a.ts - b.ts);
      // Points réels (real:true) = vraies entrées Firestore, survolables. Le
      // point de départ (jour 1 à 0 %) et l'éventuel prolongement de fin de
      // mois sont synthétiques (real:false), sans tooltip.
      const series = [
        { frac: 0, pct: 0, real: false },
        ...pts.map(p => ({ frac: Math.min(1, (p.ts - monthStart) / totalMs), pct: p.pct, real: true, page: p.page, total: p.total, dateMs: p.ts.getTime() })),
      ];
      const last = series[series.length - 1];
      if (isPastMonth && last.frac < 1) series.push({ frac: 1, pct: last.pct, real: false });
      return { id, nom: nom(id), color: memberColor(membres, id), points: series };
    });
}

// Graphique complet — axe X = jours du mois (1 → dernier jour), axe Y = % avancement.
export function buildChartSVG(series, monthStart, opts = {}) {
  const W = opts.w || 860, H = opts.h || 300;
  const unite = opts.unite || '';
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
  const hits = [];
  series.forEach(s => {
    const pts = s.points.map(p => ({ x: xFn(p.frac), y: yFn(p.pct) }));
    g += `<path class="series-line" data-m="${esc(s.id)}" d="${smoothPath(pts)}" stroke="${s.color}"/>`;
    pts.forEach(p => { g += `<circle class="series-dot" data-m="${esc(s.id)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.6" fill="${s.color}"/>`; });
    const last = pts[pts.length - 1];
    g += `<circle data-m="${esc(s.id)}" cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="4" fill="${s.color}"/>`;
    ends.push({ id: s.id, nom: s.nom, pct: s.points[s.points.length - 1].pct, col: s.color, x: last.x, y: last.y });
    // Cibles de survol (points réels uniquement), dessinées en dernier pour
    // capter le pointeur par-dessus les lignes.
    s.points.forEach((src, i) => {
      if (!src.real) return;
      const p = pts[i];
      const av = src.page != null
        ? `${src.page}${src.total != null ? '/' + src.total : ''}${unite ? ' ' + unite : ''} · ${src.pct}%`
        : `${src.pct}%`;
      hits.push(`<circle class="dot-hit" data-nom="${esc(s.nom)}" data-av="${esc(av)}" data-date="${src.dateMs || ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="transparent"/>`);
    });
  });
  g += hits.join('');
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

// Tooltip au survol d'un point réel : membre · avancement au moment du point ·
// date/heure de l'entrée. Utile pour repérer une entrée Firestore douteuse.
export function wireTooltip(root) {
  const svg = root.querySelector('svg.chart');
  if (!svg) return;
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';

  let tip = root.querySelector('.chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.style.display = 'none';
    root.appendChild(tip);
  }

  const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const escTxt = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const place = ev => {
    const r = root.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = ev.clientX - r.left + 14;
    let y = ev.clientY - r.top + 14;
    if (x + tw > r.width)  x = ev.clientX - r.left - tw - 14;
    if (y + th > r.height) y = ev.clientY - r.top - th - 14;
    tip.style.left = Math.max(0, x) + 'px';
    tip.style.top  = Math.max(0, y) + 'px';
  };

  const show = ev => {
    const el = ev.currentTarget;
    const nom = el.getAttribute('data-nom');
    const av = el.getAttribute('data-av') || '';
    const dateMs = Number(el.getAttribute('data-date'));
    const dateStr = dateMs ? fmt.format(new Date(dateMs)) : '';
    tip.innerHTML = `<b>${escTxt(nom)}</b><span>${escTxt(av)}</span>${dateStr ? `<span class="ct-date">${escTxt(dateStr)}</span>` : ''}`;
    tip.style.display = 'block';
    place(ev);
  };

  svg.querySelectorAll('.dot-hit').forEach(c => {
    c.addEventListener('mouseenter', show);
    c.addEventListener('mousemove', place);
    c.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  });
}
