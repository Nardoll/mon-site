// ── chrono.js — Frise chronologique JDR ────────────────────────────
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
  if (t.includes('Campagne')) return '#4e8a5c';
  if (t.includes('Mini Campagne')) return '#2d7d9a';
  return '#c87a00';
}

function isOneShot(p) {
  const t = p.type || [];
  return !t.includes('Campagne') && !t.includes('Mini Campagne');
}

const LABEL_W = 200;
const DAY_W   = 10;    // px per day
const ROW_H   = 48;

export function renderChrono(projets) {
  const wrap = document.getElementById('view-chrono');

  const withDates = projets
    .filter(p => (p.dates_seances || []).length > 0)
    .map(p => ({
      ...p,
      _dates: (p.dates_seances || []).map(ts => tsToDate(ts)).filter(Boolean).sort((a, b) => a - b),
    }))
    .filter(p => p._dates.length > 0);

  if (!withDates.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><p>Aucun projet avec des dates de séances.</p></div>`;
    return;
  }

  // Date range
  const allMs = withDates.flatMap(p => p._dates.map(d => d.getTime()));
  let minDate = new Date(Math.min(...allMs));
  let maxDate = new Date(Math.max(...allMs));
  minDate = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);

  const totalMs   = maxDate - minDate;
  const totalDays = totalMs / 86400000;
  const trackW    = Math.max(totalDays * DAY_W, 900);

  function toPx(d) {
    return ((d - minDate) / totalMs * trackW).toFixed(1) + 'px';
  }
  function spanPx(d1, d2) {
    return Math.max(((d2 - d1) / totalMs * trackW), 28).toFixed(1) + 'px';
  }

  // Sort by first date
  withDates.sort((a, b) => a._dates[0] - b._dates[0]);

  // Month axis
  const months = [];
  let cur = new Date(minDate);
  while (cur <= maxDate) {
    months.push(new Date(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  const axisHTML = months.map((m, i) => {
    const next = months[i + 1] || maxDate;
    const w = ((next - m) / totalMs * trackW).toFixed(1) + 'px';
    const lbl = m.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    return `<div class="ch-month" style="width:${w}">${lbl}</div>`;
  }).join('');

  const gridHTML = months.map(m => {
    return `<div class="ch-grid-line" style="left:${toPx(m)}"></div>`;
  }).join('');

  // Rows
  const rowsHTML = withDates.map(p => {
    const color   = typeColor(p);
    const oneShot = isOneShot(p);
    const types   = (p.type || []).join(', ') || '—';
    const format  = [p.irl && 'IRL', p.online && 'Online'].filter(Boolean).join(' + ') || '—';
    const parts   = (p.participants || []).join(', ') || '—';
    const satStr  = p.satisfaction > 0 ? `${p.satisfaction} ★` : '—';
    const datesStr = p._dates.map(d => fmt(d)).join(', ');

    let elements = '';

    if (oneShot) {
      // One dot per session date
      elements = p._dates.map(d => {
        const tip = `<strong>${escH(p.nom)}</strong><br>📅 ${escH(fmt(d))}<br>🎲 ${escH(types)}<br>👤 ${escH(parts)}`;
        return `<div class="ch-dot" style="left:${toPx(d)};background:${color}"
          data-tip="${escH(tip)}" data-id="${escH(p.id)}"></div>`;
      }).join('');
    } else {
      // Bar from first to last date
      const left = toPx(p._dates[0]);
      const w    = spanPx(p._dates[0], p._dates[p._dates.length - 1]);
      const tip  = `<strong>${escH(p.nom)}</strong><br>🎲 ${escH(types)}<br>📅 ${escH(datesStr)}<br>👥 MJ : ${p.nb_seances_mj || '—'} séance(s)<br>👤 ${escH(parts)}<br>⭐ ${satStr}`;
      elements = `<div class="ch-bar" style="left:${left};width:${w};background:${color}"
        data-tip="${escH(tip)}" data-id="${escH(p.id)}">
        <span class="ch-bar-label">${escH(p.nom)}</span>
      </div>`;
    }

    return `<div class="ch-row">
      <div class="ch-label" title="${escH(p.nom)}">${escH(p.nom)}</div>
      <div class="ch-track" style="width:${trackW}px">
        ${gridHTML}
        ${elements}
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div id="ch-tooltip" class="ch-tooltip hidden"></div>
    <div class="ch-outer">
      <div class="ch-inner" style="min-width:${LABEL_W + trackW}px">
        <div class="ch-head">
          <div class="ch-label ch-label-head">Projet</div>
          <div class="ch-axis" style="width:${trackW}px">${axisHTML}</div>
        </div>
        <div class="ch-rows">${rowsHTML}</div>
      </div>
    </div>`;

  // Tooltip logic
  const tt = wrap.querySelector('#ch-tooltip');

  wrap.querySelectorAll('.ch-bar, .ch-dot').forEach(el => {
    el.addEventListener('mouseenter', e => {
      tt.innerHTML = el.dataset.tip || '';
      tt.classList.remove('hidden');
    });
    el.addEventListener('mousemove', e => {
      tt.style.left = (e.clientX + 14) + 'px';
      tt.style.top  = (e.clientY - 12) + 'px';
    });
    el.addEventListener('mouseleave', () => tt.classList.add('hidden'));
    el.addEventListener('click', () => {
      if (el.dataset.id) {
        // Dispatch custom event picked up by archives.js
        document.dispatchEvent(new CustomEvent('chrono-open', { detail: { id: el.dataset.id } }));
      }
    });
  });
}
