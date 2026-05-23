// ── stats.js — Statistiques JDR ───────────────────────────────────
let charts = {};

const PALETTE = [
  '#4e8a5c','#9b3535','#c87a00','#2d7d9a','#7a6af0',
  '#6abf69','#e8a44a','#cf6679','#5a9e6f','#4a6fa5',
  '#8b6914','#3a8f8f','#8b3570','#6b8c63','#5a5a6a',
];

const AVANC_COLORS = {
  'Idée':'#5a5a6a','En préparation':'#4a6fa5','Prêt':'#2d7d9a',
  'En cours':'#c87a00','Arrêté':'#8b3535','Terminé':'#3a6e48',
};

function destroyCharts() {
  Object.values(charts).forEach(c => c?.destroy());
  charts = {};
}

function css() {
  const s = getComputedStyle(document.documentElement);
  return {
    text:    s.getPropertyValue('--text').trim()    || '#c4d8bc',
    muted:   s.getPropertyValue('--muted').trim()   || '#6b8c63',
    border:  s.getPropertyValue('--border').trim()  || '#253225',
    surface: s.getPropertyValue('--surface').trim() || '#111811',
    accent:  s.getPropertyValue('--accent').trim()  || '#4e8a5c',
  };
}

function countBy(projets, field) {
  const c = {};
  projets.forEach(p => (p[field] || []).forEach(v => { c[v] = (c[v] || 0) + 1; }));
  return c;
}

function sumBy(projets, groupField, valueField) {
  const s = {};
  projets.forEach(p => {
    const val = p[valueField] || 0;
    if (!val) return;
    (p[groupField] || []).forEach(v => { s[v] = (s[v] || 0) + val; });
  });
  return s;
}

function sorted(obj, dir = 'desc') {
  return Object.entries(obj).sort((a, b) => dir === 'desc' ? b[1] - a[1] : a[1] - b[1]);
}

// ── HTML helpers ───────────────────────────────────────────────────

function kpi(label, value, sub) {
  return `<div class="stat-kpi">
    <div class="stat-kpi-value">${value}</div>
    <div class="stat-kpi-label">${label}</div>
    ${sub ? `<div class="stat-kpi-sub">${sub}</div>` : ''}
  </div>`;
}

function card(id, title, cls = '') {
  return `<div class="stat-card ${cls}">
    <div class="stat-card-title">${title}</div>
    <div class="stat-canvas-wrap"><canvas id="${id}"></canvas></div>
  </div>`;
}

// ── Chart.js options factories ─────────────────────────────────────

function tooltipDefaults(c) {
  return {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    titleColor: c.text,
    bodyColor: c.muted,
    padding: 10,
    cornerRadius: 6,
  };
}

function donutOpts(c) {
  return {
    responsive: true, maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { position: 'bottom', labels: { color: c.text, padding: 14, font: { size: 11 } } },
      tooltip: tooltipDefaults(c),
    },
  };
}

function barOpts(c, horizontal = false, maxY = null) {
  const scaleX = {
    grid: { color: c.border + '66' },
    ticks: { color: c.muted, font: { size: 11 } },
  };
  const scaleY = {
    grid: { color: c.border + '66' },
    ticks: { color: c.muted, font: { size: 11 } },
    ...(maxY ? { max: maxY } : {}),
  };
  return {
    responsive: true, maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { display: false },
      tooltip: tooltipDefaults(c),
    },
    scales: { x: horizontal ? scaleX : scaleX, y: horizontal ? scaleY : scaleY },
  };
}

// ── Chart initializers ─────────────────────────────────────────────

function mkDonut(id, labels, data, colors) {
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx || !data.some(v => v > 0)) return;
  const c = css();
  charts[id] = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors || PALETTE.slice(0, data.length),
        borderColor: c.surface,
        borderWidth: 3,
        hoverOffset: 10,
      }],
    },
    options: donutOpts(c),
  });
}

function mkBar(id, labels, data, colors, horizontal = false, label = '', maxY = null) {
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx || !labels.length) return;
  const c = css();
  const bgColors = colors || labels.map((_, i) => PALETTE[i % PALETTE.length] + 'cc');
  const bdColors = colors || labels.map((_, i) => PALETTE[i % PALETTE.length]);
  charts[id] = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: bgColors,
        borderColor: bdColors,
        borderWidth: 1,
        borderRadius: 5,
        hoverBackgroundColor: bgColors.map(col => col.replace('cc', 'ff')),
      }],
    },
    options: barOpts(c, horizontal, maxY),
  });
}

// ── Main render ────────────────────────────────────────────────────

export function renderStats(projets) {
  destroyCharts();

  const played  = projets.filter(p => p.deja_joue);
  const withSat = played.filter(p => p.satisfaction > 0);
  const totalMJ = played.reduce((a, p) => a + (p.nb_seances_mj || 0), 0);
  const avgSat  = withSat.length
    ? (withSat.reduce((a, p) => a + p.satisfaction, 0) / withSat.length).toFixed(2)
    : null;
  const ytProj  = projets.filter(p => p.youtube).length;
  const totalJoueurs = played.reduce((a, p) => a + (p.nb_seances_joueurs || 0), 0);

  document.getElementById('view-stats').innerHTML = `
    <div class="stat-kpis">
      ${kpi('Projets', projets.length, `dont ${played.length} joués`)}
      ${kpi('Séances MJ', totalMJ, 'au total')}
      ${kpi('Séances joueurs', totalJoueurs || '—', totalJoueurs ? 'au total' : '')}
      ${kpi('Satisfaction moy.', avgSat ? avgSat + ' ★' : '—', withSat.length + ' projets notés')}
      ${kpi('Sur YouTube', ytProj, `${projets.length ? Math.round(ytProj/projets.length*100) : 0} % des projets`)}
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Vue d'ensemble</div>
      <div class="stat-grid">
        ${card('ch-type',  'Répartition par type')}
        ${card('ch-avanc', 'Répartition par avancement')}
        ${card('ch-joue',  'Joués vs en préparation')}
        ${card('ch-yt',    'Présence YouTube')}
      </div>
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Séances & durée</div>
      <div class="stat-grid">
        ${card('ch-top-seances',   'Projets les plus longs (séances MJ)', 'stat-wide')}
        ${card('ch-seances-type',  'Séances MJ par type')}
        ${card('ch-seances-proj',  'Séances MJ par projet')}
        ${card('ch-format',        'Parties IRL vs Online')}
      </div>
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Créateurs</div>
      <div class="stat-grid">
        ${card('ch-creat-proj',   'Projets par créateur', 'stat-wide')}
        ${card('ch-creat-seances','Séances MJ par créateur', 'stat-wide')}
      </div>
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Participants</div>
      <div class="stat-grid">
        ${card('ch-part-seances', 'Séances jouées par participant', 'stat-wide')}
        ${card('ch-part-proj',    'Projets par participant', 'stat-wide')}
        ${card('ch-dist-part',    'Distribution du nombre de participants par projet')}
      </div>
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Systèmes & univers</div>
      <div class="stat-grid">
        ${card('ch-systemes', 'Systèmes de jeu (nb projets)')}
        ${card('ch-univers',  'Univers (nb projets)')}
      </div>
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Satisfaction</div>
      <div class="stat-grid">
        ${card('ch-dist-sat', 'Distribution des notes')}
        ${card('ch-top-sat',  'Top projets par satisfaction', 'stat-wide')}
      </div>
    </div>`;

  requestAnimationFrame(() => initAllCharts(projets, played, withSat));
}

function initAllCharts(projets, played, withSat) {
  if (!window.Chart) return;

  // ── Vue d'ensemble ────────────────────────────────────
  const typeCounts = countBy(projets, 'type');
  const typeE = sorted(typeCounts);
  mkDonut('ch-type', typeE.map(e => e[0]), typeE.map(e => e[1]));

  const avancCounts = countBy(projets, 'avancement');
  const avancE = sorted(avancCounts);
  mkDonut('ch-avanc', avancE.map(e => e[0]), avancE.map(e => e[1]),
    avancE.map(e => AVANC_COLORS[e[0]] || '#5a5a6a'));

  mkDonut('ch-joue',
    ['Joués', 'Pas encore joués'],
    [played.length, projets.length - played.length],
    ['#3a6e48', '#5a5a6a']);

  const ytCount = projets.filter(p => p.youtube).length;
  mkDonut('ch-yt',
    ['Avec vidéo YouTube', 'Sans vidéo'],
    [ytCount, projets.length - ytCount],
    ['#c87a00', '#5a5a6a']);

  // ── Séances & durée ───────────────────────────────────
  const topSeances = played.filter(p => p.nb_seances_mj)
    .sort((a, b) => b.nb_seances_mj - a.nb_seances_mj).slice(0, 14);
  mkBar('ch-top-seances',
    topSeances.map(p => p.nom.length > 28 ? p.nom.slice(0, 26) + '…' : p.nom),
    topSeances.map(p => p.nb_seances_mj),
    topSeances.map((_, i) => PALETTE[i % PALETTE.length] + 'cc'),
    true, 'Séances MJ');

  const seancesType = sumBy(played, 'type', 'nb_seances_mj');
  const stE = sorted(seancesType);
  mkDonut('ch-seances-type', stE.map(e => e[0]), stE.map(e => e[1]));

  const seancesProj = {};
  played.filter(p => p.nb_seances_mj).forEach(p => { seancesProj[p.nom] = p.nb_seances_mj; });
  const spE = sorted(seancesProj).slice(0, 14);
  mkDonut('ch-seances-proj',
    spE.map(e => e[0].length > 22 ? e[0].slice(0, 20) + '…' : e[0]),
    spE.map(e => e[1]));

  const irl = played.filter(p => p.irl && !p.online).length;
  const online = played.filter(p => p.online && !p.irl).length;
  const hybrid = played.filter(p => p.irl && p.online).length;
  mkDonut('ch-format',
    ['IRL', 'Online', 'IRL + Online', 'Non renseigné'],
    [irl, online, hybrid, played.length - irl - online - hybrid],
    ['#3a6e48', '#2d7d9a', '#7a6af0', '#5a5a6a']);

  // ── Créateurs ─────────────────────────────────────────
  const creatProj = countBy(projets, 'createur');
  const cpE = sorted(creatProj);
  mkBar('ch-creat-proj',
    cpE.map(e => e[0]), cpE.map(e => e[1]), null, true, 'Projets');

  const creatSeances = sumBy(played, 'createur', 'nb_seances_mj');
  const csE = sorted(creatSeances);
  mkBar('ch-creat-seances',
    csE.map(e => e[0]), csE.map(e => e[1]), null, true, 'Séances MJ');

  // ── Participants ──────────────────────────────────────
  const partSeances = {};
  played.filter(p => p.nb_seances_joueurs).forEach(p => {
    (p.participants || []).forEach(part => {
      partSeances[part] = (partSeances[part] || 0) + (p.nb_seances_joueurs || 0);
    });
  });
  const psE = sorted(partSeances);
  mkBar('ch-part-seances',
    psE.map(e => e[0]), psE.map(e => e[1]), null, true, 'Séances jouées');

  const partProj = {};
  played.forEach(p => {
    (p.participants || []).forEach(part => { partProj[part] = (partProj[part] || 0) + 1; });
  });
  const ppE = sorted(partProj);
  mkBar('ch-part-proj',
    ppE.map(e => e[0]), ppE.map(e => e[1]), null, true, 'Projets');

  const distPart = {};
  played.forEach(p => {
    const n = (p.participants || []).length;
    distPart[n] = (distPart[n] || 0) + 1;
  });
  const dpE = Object.entries(distPart).sort((a, b) => a[0] - b[0]);
  mkBar('ch-dist-part',
    dpE.map(e => e[0] + ' participant' + (e[0] > 1 ? 's' : '')),
    dpE.map(e => e[1]), null, false, 'Projets');

  // ── Systèmes & univers ────────────────────────────────
  const sysCounts = countBy(projets, 'systeme');
  const sysE = sorted(sysCounts);
  mkDonut('ch-systemes', sysE.map(e => e[0]), sysE.map(e => e[1]));

  const univCounts = countBy(projets, 'univers');
  const univE = sorted(univCounts);
  mkDonut('ch-univers', univE.map(e => e[0]), univE.map(e => e[1]));

  // ── Satisfaction ──────────────────────────────────────
  const satColors = ['#8b3535','#c87a00','#b8a000','#5a9e6f','#3a6e48'];
  const distSat = [1,2,3,4,5].map(n => withSat.filter(p => Math.round(p.satisfaction) === n).length);
  mkBar('ch-dist-sat',
    ['★', '★★', '★★★', '★★★★', '★★★★★'],
    distSat, satColors, false, 'Projets', Math.max(...distSat) + 1);

  const topSat = [...withSat].sort((a, b) => b.satisfaction - a.satisfaction).slice(0, 12);
  mkBar('ch-top-sat',
    topSat.map(p => p.nom.length > 28 ? p.nom.slice(0, 26) + '…' : p.nom),
    topSat.map(p => p.satisfaction),
    topSat.map(p => satColors[Math.round(p.satisfaction) - 1]),
    true, 'Note /5', 5);
}
