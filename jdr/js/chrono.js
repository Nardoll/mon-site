// ── chrono.js — Frise chronologique verticale JDR ─────────────────

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

const DAY_H      = 3;              // px per day (vertical axis)
const LANE_W     = 164;            // px — width of each lane column
const LANE_GAP   = 8;             // px — gap between lanes
const LABEL_W    = 58;            // px — left margin for month labels
const BAR_MIN_H  = 28;            // px — minimum bar height
const MIN_RANGE_D = Math.ceil(BAR_MIN_H / DAY_H); // days for one-shot collision box
const GAP_MS     = 6 * 86400000;  // 6-day gap between items in same lane

export function renderChrono(projets) {
  const wrap = document.getElementById('view-chrono');

  // Build flat list of displayable items
  const items = [];
  projets.forEach(p => {
    const dates = (p.dates_seances || [])
      .map(ts => tsToDate(ts)).filter(Boolean)
      .sort((a, b) => a - b);
    if (!dates.length) return;

    if (isOneShot(p)) {
      dates.forEach(d => items.push({
        id: p.id, nom: p.nom, type: p.type,
        satisfaction: p.satisfaction, participants: p.participants,
        _start: d, _end: d, _oneshot: true, _date: d,
      }));
    } else {
      items.push({
        id: p.id, nom: p.nom, type: p.type,
        satisfaction: p.satisfaction, participants: p.participants,
        nb_seances_mj: p.nb_seances_mj,
        _start: dates[0], _end: dates[dates.length - 1],
        _oneshot: false, _dates: dates,
      });
    }
  });

  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><p>Aucun projet avec des dates de séances.</p></div>`;
    return;
  }

  // Effective ms range (one-shots get a minimum box for collision)
  items.forEach(item => {
    item._startMs = item._start.getTime();
    item._endMs   = Math.max(
      item._end.getTime(),
      item._startMs + MIN_RANGE_D * 86400000
    );
  });

  // Global date range — pad 1 month on each side
  const allMs = items.flatMap(i => [i._startMs, i._endMs]);
  let minDate  = new Date(Math.min(...allMs));
  let maxDate  = new Date(Math.max(...allMs));
  minDate = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
  maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);

  const totalMs = maxDate.getTime() - minDate.getTime();
  const totalH  = (totalMs / 86400000) * DAY_H;

  // Vertical coordinate: top = maxDate (most recent), bottom = minDate (oldest)
  function toPy(ms) {
    return ((maxDate.getTime() - ms) / totalMs * totalH).toFixed(1);
  }
  function barH(startMs, endMs) {
    return Math.max(BAR_MIN_H, ((endMs - startMs) / totalMs * totalH)).toFixed(1);
  }

  // ── Lane assignment (greedy, desc _startMs) ──────────────────────
  // laneFloor[i] = minimum _startMs of items in lane i (oldest item's start)
  // A new item fits in lane i if: item._endMs + GAP_MS <= laneFloor[i]
  items.sort((a, b) => b._startMs - a._startMs);

  const laneFloor = [];
  items.forEach(item => {
    const checkEnd = item._endMs + GAP_MS;
    let assigned = false;
    for (let i = 0; i < laneFloor.length; i++) {
      if (checkEnd <= laneFloor[i]) {
        laneFloor[i] = item._startMs;
        item._lane = i;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      item._lane = laneFloor.length;
      laneFloor.push(item._startMs);
    }
  });

  const numLanes = laneFloor.length;
  const sceneW   = LABEL_W + numLanes * (LANE_W + LANE_GAP);

  // ── Month markers ────────────────────────────────────────────────
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

  // ── Bars ─────────────────────────────────────────────────────────
  const barsHTML = items.map(item => {
    const color = typeColor(item);
    const top   = toPy(item._endMs);
    const h     = barH(item._startMs, item._endMs);
    const left  = LABEL_W + item._lane * (LANE_W + LANE_GAP);
    const types = (item.type || []).join(', ') || '—';
    const parts = (item.participants || []).join(', ') || '—';
    const satStr = item.satisfaction > 0 ? `${item.satisfaction} ★` : '—';

    let tip, sub;
    if (item._oneshot) {
      tip = `<strong>${escH(item.nom)}</strong><br>📅 ${escH(fmt(item._date))}<br>🎲 ${escH(types)}<br>👤 ${escH(parts)}`;
      sub = escH(fmt(item._date));
    } else {
      const datesStr = item._dates.map(d => fmt(d)).join(', ');
      tip = `<strong>${escH(item.nom)}</strong><br>🎲 ${escH(types)}<br>📅 ${escH(datesStr)}<br>⭐ ${satStr}<br>👤 ${escH(parts)}`;
      sub = `${escH(fmt(item._start))} — ${escH(fmt(item._end))}`;
    }

    const showDate = parseFloat(h) >= 50;
    return `<div class="ch-v-bar" style="top:${top}px;height:${h}px;left:${left}px;width:${LANE_W}px;background:${color}"
      data-tip="${escH(tip)}" data-id="${escH(item.id)}">
      <span class="ch-v-bar-name">${escH(item.nom)}</span>
      ${showDate ? `<span class="ch-v-bar-date">${sub}</span>` : ''}
    </div>`;
  }).join('');

  wrap.innerHTML = `
    <div id="ch-tooltip" class="ch-tooltip hidden"></div>
    <div class="ch-v-wrap">
      <div class="ch-v-scene" style="height:${totalH}px;width:${sceneW}px">
        ${monthsHTML}
        ${barsHTML}
      </div>
    </div>`;

  // ── Tooltip & click ───────────────────────────────────────────────
  const tt = wrap.querySelector('#ch-tooltip');
  wrap.querySelectorAll('.ch-v-bar').forEach(el => {
    el.addEventListener('mouseenter', () => {
      tt.innerHTML = el.dataset.tip || '';
      tt.classList.remove('hidden');
    });
    el.addEventListener('mousemove', e => {
      tt.style.left = (e.clientX + 14) + 'px';
      tt.style.top  = (e.clientY - 12) + 'px';
    });
    el.addEventListener('mouseleave', () => tt.classList.add('hidden'));
    el.addEventListener('click', () => {
      if (el.dataset.id)
        document.dispatchEvent(new CustomEvent('chrono-open', { detail: { id: el.dataset.id } }));
    });
  });
}
