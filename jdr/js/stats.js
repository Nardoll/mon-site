// ── stats.js v2 — Statistiques JDR ────────────────────────────────
let charts = {};
let toggleStore = {};

const PALETTE = [
  '#4e8a5c','#9b3535','#c87a00','#2d7d9a','#7a6af0',
  '#6abf69','#e8a44a','#cf6679','#5a9e6f','#4a6fa5',
  '#8b6914','#3a8f8f','#8b3570','#a0522d','#5a5a6a',
];

const AVANC_COLORS = {
  'Idée':'#5a5a6a','En préparation':'#4a6fa5','Prêt':'#2d7d9a',
  'En cours':'#c87a00','Arrêté':'#8b3535','Terminé':'#3a6e48',
};

// ── Utilitaires ────────────────────────────────────────────────────

function destroyCharts() {
  Object.values(charts).forEach(c => c?.destroy());
  charts = {};
  toggleStore = {};
}

function cssVars() {
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

function sorted(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

// ── HTML builders ──────────────────────────────────────────────────

function kpi(label, value, sub) {
  return `<div class="stat-kpi">
    <div class="stat-kpi-value">${value}</div>
    <div class="stat-kpi-label">${label}</div>
    ${sub ? `<div class="stat-kpi-sub">${sub}</div>` : ''}
  </div>`;
}

function card(id, title, cls = '', h = '') {
  const style = h ? ` style="height:${h}px"` : '';
  return `<div class="stat-card ${cls}" id="card-${id}">
    <div class="stat-card-title">${title}</div>
    <div class="stat-canvas-wrap"${style}><canvas id="${id}"></canvas></div>
  </div>`;
}

function toggleCard(id, title, btn1, btn2, cls = '', h = '') {
  const style = h ? ` style="height:${h}px"` : '';
  return `<div class="stat-card ${cls}" id="card-${id}">
    <div class="stat-card-header">
      <div class="stat-card-title">${title}</div>
      <div class="stat-toggle">
        <button class="st-tog active" data-cid="${id}" data-mode="0">${btn1}</button>
        <button class="st-tog" data-cid="${id}" data-mode="1">${btn2}</button>
      </div>
    </div>
    <div class="stat-canvas-wrap"${style}><canvas id="${id}"></canvas></div>
  </div>`;
}

// ── Chart options ──────────────────────────────────────────────────

function tooltipCfg(c) {
  return {
    backgroundColor: c.surface, borderColor: c.border, borderWidth: 1,
    titleColor: c.text, bodyColor: c.muted, padding: 10, cornerRadius: 6,
  };
}

function donutOpts(c) {
  return {
    responsive: true, maintainAspectRatio: false, cutout: '52%',
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipCfg(c),
        callbacks: {
          label: ctx => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total ? Math.round(ctx.parsed / total * 100) : 0;
            return ` ${ctx.label} : ${ctx.parsed}  (${pct} %)`;
          },
        },
      },
    },
  };
}

function barOpts(c, horizontal = false, maxVal = null) {
  const base = { grid: { color: c.border + '55' }, ticks: { color: c.muted, font: { size: 11 } } };
  return {
    responsive: true, maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { display: false },
      tooltip: tooltipCfg(c),
    },
    scales: {
      x: { ...base, ...(maxVal && !horizontal ? { max: maxVal } : {}) },
      y: { ...base, ...(maxVal &&  horizontal ? { max: maxVal } : {}) },
    },
  };
}

// ── Chart creators ─────────────────────────────────────────────────

function mkDonut(id, sets) {
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  const c = cssVars();
  const s = sets[0];
  if (!s.data.some(v => v > 0)) return;
  charts[id] = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: s.labels,
      datasets: [{
        data: s.data,
        backgroundColor: s.colors || PALETTE.slice(0, s.data.length),
        borderColor: c.surface, borderWidth: 3, hoverOffset: 14,
      }],
    },
    options: donutOpts(c),
  });
  if (sets.length > 1) toggleStore[id] = { sets, type: 'donut' };
}

function mkBar(id, sets, horizontal = false, maxVal = null) {
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx || !sets[0].labels.length) return;
  const c = cssVars();
  const s = sets[0];
  const bg = s.colors || s.labels.map((_, i) => PALETTE[i % PALETTE.length] + 'cc');
  const bd = s.colors || s.labels.map((_, i) => PALETTE[i % PALETTE.length]);
  charts[id] = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: s.labels,
      datasets: [{
        label: s.label || '',
        data: s.data,
        backgroundColor: bg,
        borderColor: bd,
        borderWidth: 1,
        borderRadius: 5,
      }],
    },
    options: barOpts(c, horizontal, maxVal),
  });
  if (sets.length > 1) toggleStore[id] = { sets, type: 'bar' };
}

function attachToggles() {
  document.querySelectorAll('.st-tog').forEach(btn => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.cid;
      const mode = parseInt(btn.dataset.mode);
      document.getElementById('card-' + id)?.querySelectorAll('.st-tog')
        .forEach(b => b.classList.toggle('active', b === btn));

      const chart = charts[id];
      const td    = toggleStore[id];
      if (!chart || !td) return;

      const s = td.sets[mode];
      const c = cssVars();
      chart.data.labels = s.labels;
      chart.data.datasets[0].data = s.data;
      if (s.label != null) chart.data.datasets[0].label = s.label;

      if (td.type === 'donut') {
        chart.data.datasets[0].backgroundColor = s.colors || PALETTE.slice(0, s.data.length);
        chart.data.datasets[0].borderColor = c.surface;
      } else {
        const cols = s.colors || s.labels.map((_, i) => PALETTE[i % PALETTE.length]);
        chart.data.datasets[0].backgroundColor = cols.map(col => col + (col.length === 7 ? 'cc' : ''));
        chart.data.datasets[0].borderColor = cols;
      }
      chart.update('active');
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────

export function renderStats(projets) {
  destroyCharts();

  const played  = projets.filter(p => p.deja_joue);
  const withSat = played.filter(p => p.satisfaction > 0);
  const totalMJ = played.reduce((a, p) => a + (p.nb_seances_mj || 0), 0);
  const avgSat  = withSat.length
    ? (withSat.reduce((a, p) => a + p.satisfaction, 0) / withSat.length).toFixed(2) : null;
  const ytProj  = projets.filter(p => p.youtube).length;

  // ── Données pré-calculées ──────────────────────────────────────
  const typeProjE  = sorted(countBy(projets, 'type'));
  const typeSeancE = sorted(sumBy(played,  'type', 'nb_seances_mj'));
  const sysProjE   = sorted(countBy(projets, 'systeme'));
  const sysSeancE  = sorted(sumBy(played,  'systeme', 'nb_seances_mj'));
  const univProjE  = sorted(countBy(projets, 'univers'));
  const univSeancE = sorted(sumBy(played,  'univers', 'nb_seances_mj'));
  const avancE     = sorted(countBy(projets, 'avancement'));
  const cpE        = sorted(countBy(projets, 'createur'));
  const csE        = sorted(sumBy(played,   'createur', 'nb_seances_mj'));

  const partSeancesMap = {};
  played.filter(p => p.nb_seances_joueurs).forEach(p =>
    (p.participants || []).forEach(part => {
      partSeancesMap[part] = (partSeancesMap[part] || 0) + (p.nb_seances_joueurs || 0);
    })
  );
  const partProjMap = {};
  played.forEach(p => (p.participants || []).forEach(part => { partProjMap[part] = (partProjMap[part] || 0) + 1; }));
  const psE = sorted(partSeancesMap);
  const ppE = sorted(partProjMap);

  const topSeances = played.filter(p => p.nb_seances_mj).sort((a, b) => b.nb_seances_mj - a.nb_seances_mj);
  const projByPart = played
    .filter(p => (p.participants || []).length > 0)
    .map(p => ({ nom: p.nom, n: (p.participants || []).length }))
    .sort((a, b) => b.n - a.n);
  const topSat = [...withSat].sort((a, b) => b.satisfaction - a.satisfaction);

  // Hauteurs dynamiques
  const seancesH  = Math.max(300, topSeances.length  * 36);
  const creatH    = Math.max(240, Math.max(cpE.length, csE.length) * 38);
  const partH     = Math.max(300, Math.max(psE.length, ppE.length) * 38);
  const projPartH = Math.max(260, projByPart.length   * 36);
  const satH      = Math.max(160, topSat.length       * 40);

  document.getElementById('view-stats').innerHTML = `
    <div class="stat-kpis">
      ${kpi('Projets', projets.length, `dont ${played.length} joués`)}
      ${kpi('Séances MJ', totalMJ, 'au total')}
      ${kpi('Satisfaction moy.', avgSat ? avgSat + ' ★' : '—', withSat.length + ' projets notés')}
      ${kpi('Sur YouTube', ytProj, `${projets.length ? Math.round(ytProj / projets.length * 100) : 0} % des projets`)}
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Vue d'ensemble</div>
      <div class="stat-grid">
        ${toggleCard('ch-type',  'Type de projet',       'Projets', 'Séances MJ')}
        ${card('ch-avanc', 'Avancement')}
        ${card('ch-joue',  'Joués vs en préparation')}
        ${card('ch-yt',    'Présence YouTube')}
      </div>
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Séances & durée</div>
      <div class="stat-grid">
        <div class="stat-card stat-wide" id="card-ch-top-seances">
          <div class="stat-card-title">Tous les projets — durée en séances MJ (${topSeances.length})</div>
          <div class="stat-canvas-wrap" style="height:${seancesH}px"><canvas id="ch-top-seances"></canvas></div>
        </div>
        ${card('ch-seances-proj', 'Part de chaque projet dans les séances MJ')}
        ${toggleCard('ch-format', 'Format des parties', 'Projets', 'Séances MJ')}
      </div>
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Créateurs</div>
      <div class="stat-grid">
        <div class="stat-card stat-wide" id="card-ch-creat">
          <div class="stat-card-header">
            <div class="stat-card-title">Créateurs</div>
            <div class="stat-toggle">
              <button class="st-tog active" data-cid="ch-creat" data-mode="0">Projets</button>
              <button class="st-tog"        data-cid="ch-creat" data-mode="1">Séances MJ</button>
            </div>
          </div>
          <div class="stat-canvas-wrap" style="height:${creatH}px"><canvas id="ch-creat"></canvas></div>
        </div>
      </div>
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Participants</div>
      <div class="stat-grid">
        <div class="stat-card stat-wide" id="card-ch-part">
          <div class="stat-card-header">
            <div class="stat-card-title">Participants</div>
            <div class="stat-toggle">
              <button class="st-tog active" data-cid="ch-part" data-mode="0">Séances jouées</button>
              <button class="st-tog"        data-cid="ch-part" data-mode="1">Projets</button>
            </div>
          </div>
          <div class="stat-canvas-wrap" style="height:${partH}px"><canvas id="ch-part"></canvas></div>
        </div>
        <div class="stat-card stat-wide" id="card-ch-proj-part">
          <div class="stat-card-title">Projets triés par nombre de participants (${projByPart.length})</div>
          <div class="stat-canvas-wrap" style="height:${projPartH}px"><canvas id="ch-proj-part"></canvas></div>
        </div>
      </div>
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Systèmes & univers</div>
      <div class="stat-grid">
        ${toggleCard('ch-systemes', 'Systèmes de jeu', 'Projets', 'Séances MJ')}
        ${toggleCard('ch-univers',  'Univers',          'Projets', 'Séances MJ')}
      </div>
    </div>

    <div class="stat-section">
      <div class="stat-section-title">Satisfaction</div>
      <div class="stat-grid">
        ${card('ch-dist-sat', 'Distribution des notes')}
        <div class="stat-card stat-wide" id="card-ch-top-sat">
          <div class="stat-card-title">Tous les projets notés — par satisfaction (${topSat.length})</div>
          <div class="stat-canvas-wrap" style="height:${satH}px"><canvas id="ch-top-sat"></canvas></div>
        </div>
      </div>
    </div>`;

  requestAnimationFrame(() => initAllCharts(projets, played, withSat, {
    typeProjE, typeSeancE, sysProjE, sysSeancE, univProjE, univSeancE,
    avancE, cpE, csE, psE, ppE, topSeances, projByPart, topSat,
  }));
}

function initAllCharts(projets, played, withSat, d) {
  if (!window.Chart) return;
  const { typeProjE, typeSeancE, sysProjE, sysSeancE, univProjE, univSeancE,
    avancE, cpE, csE, psE, ppE, topSeances, projByPart, topSat } = d;

  const trunc = (s, n = 30) => s.length > n ? s.slice(0, n - 1) + '…' : s;

  // ── Vue d'ensemble ──────────────────────────────────
  mkDonut('ch-type', [
    { labels: typeProjE.map(e => e[0]),  data: typeProjE.map(e => e[1]) },
    { labels: typeSeancE.map(e => e[0]), data: typeSeancE.map(e => e[1]) },
  ]);

  mkDonut('ch-avanc', [{
    labels: avancE.map(e => e[0]), data: avancE.map(e => e[1]),
    colors: avancE.map(e => AVANC_COLORS[e[0]] || '#5a5a6a'),
  }]);

  mkDonut('ch-joue', [{
    labels: ['Joués', 'Pas encore joués'],
    data:   [played.length, projets.length - played.length],
    colors: ['#3a6e48', '#5a5a6a'],
  }]);

  const ytCount = projets.filter(p => p.youtube).length;
  mkDonut('ch-yt', [{
    labels: ['Avec vidéo YouTube', 'Sans vidéo'],
    data:   [ytCount, projets.length - ytCount],
    colors: ['#c87a00', '#5a5a6a'],
  }]);

  // ── Séances & durée ─────────────────────────────────
  mkBar('ch-top-seances', [{
    labels: topSeances.map(p => trunc(p.nom)),
    data:   topSeances.map(p => p.nb_seances_mj),
    label:  'Séances MJ',
  }], true);

  const spArr = sorted(Object.fromEntries(played.filter(p => p.nb_seances_mj).map(p => [p.nom, p.nb_seances_mj])));
  mkDonut('ch-seances-proj', [{ labels: spArr.map(e => trunc(e[0], 22)), data: spArr.map(e => e[1]) }]);

  const irl = p => p.irl && !p.online, onl = p => p.online && !p.irl, hyb = p => p.irl && p.online;
  const fmtLabels = ['IRL', 'Online', 'IRL + Online'];
  const fmtColors = ['#3a6e48', '#2d7d9a', '#7a6af0'];
  mkDonut('ch-format', [
    { labels: fmtLabels, data: [played.filter(irl).length, played.filter(onl).length, played.filter(hyb).length], colors: fmtColors },
    { labels: fmtLabels, data: [
        played.filter(irl).reduce((a, p) => a + (p.nb_seances_mj || 0), 0),
        played.filter(onl).reduce((a, p) => a + (p.nb_seances_mj || 0), 0),
        played.filter(hyb).reduce((a, p) => a + (p.nb_seances_mj || 0), 0),
      ], colors: fmtColors },
  ]);

  // ── Créateurs ────────────────────────────────────────
  mkBar('ch-creat', [
    { labels: cpE.map(e => e[0]), data: cpE.map(e => e[1]), label: 'Projets' },
    { labels: csE.map(e => e[0]), data: csE.map(e => e[1]), label: 'Séances MJ' },
  ], true);

  // ── Participants ─────────────────────────────────────
  mkBar('ch-part', [
    { labels: psE.map(e => e[0]), data: psE.map(e => e[1]), label: 'Séances jouées' },
    { labels: ppE.map(e => e[0]), data: ppE.map(e => e[1]), label: 'Projets' },
  ], true);

  mkBar('ch-proj-part', [{
    labels: projByPart.map(p => trunc(p.nom)),
    data:   projByPart.map(p => p.n),
    label:  'Participants',
  }], true);

  // ── Systèmes & univers ───────────────────────────────
  mkDonut('ch-systemes', [
    { labels: sysProjE.map(e => e[0]),  data: sysProjE.map(e => e[1]) },
    { labels: sysSeancE.map(e => e[0]), data: sysSeancE.map(e => e[1]) },
  ]);

  mkDonut('ch-univers', [
    { labels: univProjE.map(e => e[0]),  data: univProjE.map(e => e[1]) },
    { labels: univSeancE.map(e => e[0]), data: univSeancE.map(e => e[1]) },
  ]);

  // ── Satisfaction ─────────────────────────────────────
  const satColors = ['#8b3535', '#c87a00', '#b8a000', '#5a9e6f', '#3a6e48'];
  const distSat = [1, 2, 3, 4, 5].map(n => withSat.filter(p => Math.round(p.satisfaction) === n).length);
  mkBar('ch-dist-sat', [{
    labels: ['★', '★★', '★★★', '★★★★', '★★★★★'],
    data:   distSat,
    colors: satColors,
    label:  'Projets',
  }], false);

  mkBar('ch-top-sat', [{
    labels: topSat.map(p => trunc(p.nom)),
    data:   topSat.map(p => p.satisfaction),
    colors: topSat.map(p => satColors[Math.round(p.satisfaction) - 1]),
    label:  'Note /5',
  }], true, 5);

  attachToggles();
}
