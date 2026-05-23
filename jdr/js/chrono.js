// ── chrono.js — Frise chronologique verticale JDR ─────────────────

let chronoCharts = {};

function escH(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tsToDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
}

function fmt(d) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function typeColor(p) {
  const t = p.type || [];
  if (t.includes('Campagne'))      return '#4e8a5c';
  if (t.includes('Mini Campagne')) return '#2d7d9a';
  return '#c87a00';
}

function isOneShot(p) {
  const t = p.type || [];
  return !t.includes('Campagne') && !t.includes('Mini Campagne');
}

function normalizeSession(entry) {
  if (!entry) return null;
  if (typeof entry.seconds === 'number' || typeof entry.toDate === 'function') {
    return { date: tsToDate(entry), participants: [] };
  }
  if (entry.date) {
    return { date: tsToDate(entry.date), participants: entry.participants || [] };
  }
  return null;
}

const DAY_H       = 3;
const LANE_W      = 164;
const LANE_GAP    = 8;
const LABEL_W     = 58;
const BAR_MIN_H   = 28;
const MIN_RANGE_D = Math.ceil(BAR_MIN_H / DAY_H);
const GAP_MS      = 6 * 86400000;

// ── Données pour les graphiques ───────────────────────────────────

function computeSessionsBuckets(projets, mode) {
  const buckets = {};

  projets.forEach(p => {
    if (!p.deja_joue) return;
    const sessions = (p.dates_seances || [])
      .map(normalizeSession)
      .filter(s => s?.date)
      .sort((a, b) => a.date - b.date);
    if (!sessions.length) return;

    if (isOneShot(p)) {
      sessions.forEach(s => {
        const key = mode === 'month'
          ? `${s.date.getFullYear()}-${String(s.date.getMonth() + 1).padStart(2, '0')}`
          : String(s.date.getFullYear());
        buckets[key] = (buckets[key] || 0) + 1;
      });
    } else {
      const startMs = sessions[0].date.getTime();
      const endMs   = sessions[sessions.length - 1].date.getTime();
      const nbSeances = p.nb_seances_mj || sessions.length;
      const totalDuration = Math.max(endMs - startMs, 1);

      if (mode === 'month') {
        let cur = new Date(sessions[0].date.getFullYear(), sessions[0].date.getMonth(), 1);
        while (cur.getTime() <= endMs) {
          const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
          const mStart = Math.max(cur.getTime(), startMs);
          const mEnd   = Math.min(next.getTime(), endMs);
          if (mEnd > mStart) {
            const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
            buckets[key] = (buckets[key] || 0) + ((mEnd - mStart) / totalDuration) * nbSeances;
          }
          cur = next;
        }
      } else {
        const y0 = sessions[0].date.getFullYear();
        const y1 = sessions[sessions.length - 1].date.getFullYear();
        for (let y = y0; y <= y1; y++) {
          const yStart = Math.max(new Date(y, 0, 1).getTime(), startMs);
          const yEnd   = Math.min(new Date(y + 1, 0, 1).getTime(), endMs);
          if (yEnd > yStart) {
            buckets[String(y)] = (buckets[String(y)] || 0) + ((yEnd - yStart) / totalDuration) * nbSeances;
          }
        }
      }
    }
  });

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({ key, val: Math.round(val * 10) / 10 }));
}

function computeSatPoints(projets) {
  const points = [];

  projets.forEach(p => {
    if (!p.deja_joue || !p.satisfaction || p.satisfaction <= 0) return;
    const sessions = (p.dates_seances || [])
      .map(normalizeSession)
      .filter(s => s?.date)
      .sort((a, b) => a.date - b.date);
    if (!sessions.length) return;

    if (isOneShot(p)) {
      sessions.forEach(s => {
        points.push({ x: s.date.getTime(), y: p.satisfaction, nom: p.nom });
      });
    } else {
      const startMs = sessions[0].date.getTime();
      const endMs   = sessions[sessions.length - 1].date.getTime();
      const nb = p.nb_seances_mj || sessions.length;
      if (nb === 1) {
        points.push({ x: (startMs + endMs) / 2, y: p.satisfaction, nom: p.nom });
      } else {
        for (let i = 0; i < nb; i++) {
          points.push({ x: startMs + (endMs - startMs) * i / (nb - 1), y: p.satisfaction, nom: p.nom });
        }
      }
    }
  });

  return points.sort((a, b) => a.x - b.x);
}

function linearRegression(pts) {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  pts.forEach(p => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; });
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

// ── Chart.js helpers ──────────────────────────────────────────────

function cssVars() {
  const s = getComputedStyle(document.documentElement);
  return {
    text:    s.getPropertyValue('--text').trim()    || '#c4d8bc',
    muted:   s.getPropertyValue('--muted').trim()   || '#6b8c63',
    border:  s.getPropertyValue('--border').trim()  || '#253225',
    surface: s.getPropertyValue('--surface').trim() || '#111811',
  };
}

function destroyChronoCharts() {
  Object.values(chronoCharts).forEach(c => c?.destroy());
  chronoCharts = {};
}

function buildSessionsChart(projets, mode) {
  const ctx = document.getElementById('ch-sess-time')?.getContext('2d');
  if (!ctx || !window.Chart) return;
  const c = cssVars();
  const buckets = computeSessionsBuckets(projets, mode);

  const labels = buckets.map(b => {
    if (mode === 'month') {
      const [y, m] = b.key.split('-');
      return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    }
    return b.key;
  });

  if (chronoCharts['sess']) { chronoCharts['sess'].destroy(); delete chronoCharts['sess']; }
  chronoCharts['sess'] = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Séances',
        data: buckets.map(b => b.val),
        backgroundColor: '#4e8a5ccc',
        borderColor: '#4e8a5c',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.surface, borderColor: c.border, borderWidth: 1,
          titleColor: c.text, bodyColor: c.muted, padding: 8, cornerRadius: 6,
          callbacks: { label: ctx => ` ${ctx.parsed.y} séance${ctx.parsed.y > 1 ? 's' : ''}` },
        },
      },
      scales: {
        x: { grid: { color: c.border + '44' }, ticks: { color: c.muted, font: { size: 10 }, maxRotation: 45 } },
        y: { grid: { color: c.border + '44' }, ticks: { color: c.muted, font: { size: 10 } }, beginAtZero: true },
      },
    },
  });
}

function buildSatChart(projets) {
  const ctx = document.getElementById('ch-sat-time')?.getContext('2d');
  if (!ctx || !window.Chart) return;
  const c = cssVars();
  const points = computeSatPoints(projets);
  if (!points.length) return;

  const reg = linearRegression(points);
  const datasets = [{
    type: 'scatter',
    label: 'Satisfaction',
    data: points.map(p => ({ x: p.x, y: p.y })),
    backgroundColor: '#c87a00aa',
    borderColor: '#c87a00',
    pointRadius: 4,
    pointHoverRadius: 6,
  }];

  let trendText = '';
  if (reg) {
    const slopePerMonth = reg.slope * 30.44 * 86400 * 1000;
    if (slopePerMonth > 0.005)       trendText = '↗ En hausse';
    else if (slopePerMonth < -0.005) trendText = '↘ En baisse';
    else                             trendText = '→ Stable';

    const minX = points[0].x, maxX = points[points.length - 1].x;
    datasets.push({
      type: 'line',
      label: 'Tendance',
      data: [{ x: minX, y: reg.slope * minX + reg.intercept }, { x: maxX, y: reg.slope * maxX + reg.intercept }],
      borderColor: '#7a6af0',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0,
      fill: false,
    });
  }

  const trendEl = document.getElementById('ch-trend-ind');
  if (trendEl) {
    trendEl.textContent = trendText;
    trendEl.className = 'chrono-trend-ind' + (trendText.startsWith('↗') ? ' up' : trendText.startsWith('↘') ? ' down' : ' flat');
  }

  const fmtDate = x => new Date(x).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

  if (chronoCharts['sat']) { chronoCharts['sat'].destroy(); delete chronoCharts['sat']; }
  chronoCharts['sat'] = new window.Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.surface, borderColor: c.border, borderWidth: 1,
          titleColor: c.text, bodyColor: c.muted, padding: 8, cornerRadius: 6,
          filter: item => item.datasetIndex === 0,
          callbacks: {
            title: items => items.length ? fmtDate(items[0].parsed.x) : '',
            label: item => {
              const p = points[item.dataIndex];
              return ` ${p?.nom || ''} : ${item.parsed.y} ★`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          grid: { color: c.border + '44' },
          ticks: { color: c.muted, font: { size: 10 }, maxTicksLimit: 8, callback: v => fmtDate(v) },
        },
        y: {
          grid: { color: c.border + '44' },
          ticks: { color: c.muted, font: { size: 10 } },
          min: 0, max: 5,
        },
      },
    },
  });
}

// ── Rendu principal ───────────────────────────────────────────────

export function renderChrono(projets) {
  destroyChronoCharts();
  const wrap = document.getElementById('view-chrono');

  const items = [];
  projets.forEach(p => {
    const sessions = (p.dates_seances || [])
      .map(normalizeSession)
      .filter(s => s?.date)
      .sort((a, b) => a.date - b.date);
    if (!sessions.length) return;

    if (isOneShot(p)) {
      sessions.forEach(s => {
        const sp = s.participants.length ? s.participants : (p.participants || []);
        items.push({
          id: p.id, nom: p.nom, type: p.type,
          satisfaction: p.satisfaction, participants: p.participants,
          _start: s.date, _end: s.date, _oneshot: true, _date: s.date,
          _session_participants: sp,
        });
      });
    } else {
      items.push({
        id: p.id, nom: p.nom, type: p.type,
        satisfaction: p.satisfaction, participants: p.participants,
        nb_seances_mj: p.nb_seances_mj,
        _start: sessions[0].date, _end: sessions[sessions.length - 1].date,
        _oneshot: false, _dates: sessions.map(s => s.date),
        _sessions: sessions,
      });
    }
  });

  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><p>Aucun projet avec des dates de séances.</p></div>`;
    return;
  }

  items.forEach(item => {
    item._startMs = item._start.getTime();
    item._endMs   = Math.max(item._end.getTime(), item._startMs + MIN_RANGE_D * 86400000);
  });

  const allMs = items.flatMap(i => [i._startMs, i._endMs]);
  let minDate = new Date(Math.min(...allMs));
  let maxDate = new Date(Math.max(...allMs));
  minDate = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);

  const totalMs = maxDate.getTime() - minDate.getTime();
  const totalH  = (totalMs / 86400000) * DAY_H;

  function toPy(ms)          { return ((maxDate.getTime() - ms) / totalMs * totalH).toFixed(1); }
  function barH(s, e)        { return Math.max(BAR_MIN_H, ((e - s) / totalMs * totalH)).toFixed(1); }

  items.sort((a, b) => b._startMs - a._startMs);
  const laneFloor = [];
  items.forEach(item => {
    const checkEnd = item._endMs + GAP_MS;
    let assigned = false;
    for (let i = 0; i < laneFloor.length; i++) {
      if (checkEnd <= laneFloor[i]) { laneFloor[i] = item._startMs; item._lane = i; assigned = true; break; }
    }
    if (!assigned) { item._lane = laneFloor.length; laneFloor.push(item._startMs); }
  });

  const numLanes = laneFloor.length;
  const sceneW   = LABEL_W + numLanes * (LANE_W + LANE_GAP);

  const months = [];
  let cur = new Date(minDate);
  while (cur <= maxDate) {
    months.push(new Date(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  const monthsHTML = months.map(m => {
    const y   = toPy(m.getTime());
    const lbl = m.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    return `<div class="ch-v-month" style="top:${y}px">
      <span class="ch-v-mlabel">${escH(lbl)}</span>
      <div class="ch-v-mline"></div>
    </div>`;
  }).join('');

  const barsHTML = items.map(item => {
    const color = typeColor(item);
    const top   = toPy(item._endMs);
    const h     = barH(item._startMs, item._endMs);
    const left  = LABEL_W + item._lane * (LANE_W + LANE_GAP);
    const types = (item.type || []).join(', ') || '—';
    const parts = (item.participants || []).join(', ') || '—';
    const satStr = item.satisfaction > 0 ? `${item.satisfaction} ★` : '—';

    let tip, sub, extraHTML = '';

    if (item._oneshot) {
      const sp = (item._session_participants || []).join(', ') || '—';
      tip = `<strong>${escH(item.nom)}</strong><br>📅 ${escH(fmt(item._date))}<br>🎲 ${escH(types)}<br>👤 ${escH(sp)}`;
      sub = escH(fmt(item._date));
    } else {
      const hasSessP = (item._sessions || []).some(s => s.participants.length);
      let datesStr;
      if (hasSessP) {
        const lines = (item._sessions || []).slice(0, 5).map(s => {
          const sp = s.participants.length ? escH(s.participants.join(', ')) : escH(parts);
          return `• ${escH(fmt(s.date))}: ${sp}`;
        });
        if ((item._sessions || []).length > 5) lines.push(`…+${(item._sessions || []).length - 5} séances`);
        datesStr = lines.join('<br>');
      } else {
        datesStr = escH(item._dates.map(d => fmt(d)).join(', '));
      }
      tip = `<strong>${escH(item.nom)}</strong><br>🎲 ${escH(types)}<br>📅 ${datesStr}<br>⭐ ${satStr}<br>👤 ${escH(parts)}`;
      sub = `${escH(fmt(item._start))} — ${escH(fmt(item._end))}`;

      if (item.nb_seances_mj && parseFloat(h) >= 50) {
        const durationMonths = (item._endMs - item._startMs) / (1000 * 86400 * 30.44);
        const rate = durationMonths > 0.5 ? (item.nb_seances_mj / durationMonths).toFixed(1) : null;
        const statsLine = `${item.nb_seances_mj} séance${item.nb_seances_mj > 1 ? 's' : ''}${rate ? ` · ${rate}/mois` : ''}`;
        extraHTML = `<span class="ch-v-bar-stats">${escH(statsLine)}</span>`;
      }
    }

    const showDate = parseFloat(h) >= 50;
    return `<div class="ch-v-bar" style="top:${top}px;height:${h}px;left:${left}px;width:${LANE_W}px;background:${color}"
      data-tip="${escH(tip)}" data-id="${escH(item.id)}">
      <span class="ch-v-bar-name">${escH(item.nom)}</span>
      ${showDate ? `<span class="ch-v-bar-date">${sub}</span>` : ''}
      ${extraHTML}
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div class="chrono-layout">
      <div class="chrono-left">
        <div id="ch-tooltip" class="ch-tooltip hidden"></div>
        <div class="ch-v-wrap">
          <div class="ch-v-scene" style="height:${totalH}px;width:${sceneW}px">
            ${monthsHTML}
            ${barsHTML}
          </div>
        </div>
      </div>
      <div class="chrono-right">
        <div class="chrono-chart-panel">
          <div class="chrono-chart-header">
            <span class="chrono-chart-title">Séances dans le temps</span>
            <div class="stat-toggle">
              <button class="st-tog active" id="ch-sess-month-btn">Par mois</button>
              <button class="st-tog" id="ch-sess-year-btn">Par an</button>
            </div>
          </div>
          <div class="chrono-chart-canvas"><canvas id="ch-sess-time"></canvas></div>
        </div>
        <div class="chrono-chart-panel">
          <div class="chrono-chart-header">
            <span class="chrono-chart-title">Satisfaction dans le temps</span>
            <span class="chrono-trend-ind" id="ch-trend-ind"></span>
          </div>
          <div class="chrono-chart-canvas"><canvas id="ch-sat-time"></canvas></div>
        </div>
      </div>
    </div>`;

  const tt = wrap.querySelector('#ch-tooltip');
  wrap.querySelectorAll('.ch-v-bar').forEach(el => {
    el.addEventListener('mouseenter', () => { tt.innerHTML = el.dataset.tip || ''; tt.classList.remove('hidden'); });
    el.addEventListener('mousemove',  e => { tt.style.left = (e.clientX + 14) + 'px'; tt.style.top = (e.clientY - 12) + 'px'; });
    el.addEventListener('mouseleave', () => tt.classList.add('hidden'));
    el.addEventListener('click', () => {
      if (el.dataset.id) document.dispatchEvent(new CustomEvent('chrono-open', { detail: { id: el.dataset.id } }));
    });
  });

  requestAnimationFrame(() => {
    buildSessionsChart(projets, 'month');
    buildSatChart(projets);

    document.getElementById('ch-sess-month-btn')?.addEventListener('click', () => {
      document.getElementById('ch-sess-month-btn').classList.add('active');
      document.getElementById('ch-sess-year-btn').classList.remove('active');
      buildSessionsChart(projets, 'month');
    });
    document.getElementById('ch-sess-year-btn')?.addEventListener('click', () => {
      document.getElementById('ch-sess-year-btn').classList.add('active');
      document.getElementById('ch-sess-month-btn').classList.remove('active');
      buildSessionsChart(projets, 'year');
    });
  });
}
