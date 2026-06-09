/* ══════════════════════════════════════════════════════════════════════
   KIT STATISTIQUES — helpers réutilisables
   ----------------------------------------------------------------------
   À importer dans n'importe quelle page de stats :  <script src="stats.js"></script>
   Tout est exposé sur window.SX.  Voir GUIDE-STATS.md pour le mode d'emploi.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  // Palette membres — teintes bois/terre, alignée sur les autres pages (AVA).
  const MEMBER_COLORS = {
    Iliade:'#9a4a2a', Minka:'#3f7a52', Dorian:'#6840d8', Yanou:'#a9742a', Tamo:'#4a6d7c',
    Matthew:'#a8503f', Tom:'#3f5340', Mariwenn:'#8a5a6b', Lisa:'#46708a', Margot:'#8a5a2a',
    'Maïlys':'#a8527a', 'Margot J.':'#5a6cb0', Mato:'#4f7a5e',
  };
  const memberColor = n => MEMBER_COLORS[n] || '#8a5a3a';

  /* ── Couleur d'une cellule de heatmap (encre-lavée, sauge ↔ terracotta) ──
     v       : valeur de la cellule (null = vide)
     lo/hi   : bornes de l'échelle
     mid     : point neutre (crème). défaut = milieu de [lo,hi]
     max alpha 0.55 → reste « encre diluée », jamais criard. */
  function heatColor(v, lo, hi, mid) {
    if (v == null || v === '' || Number.isNaN(v)) return 'transparent';
    if (mid == null) mid = (lo + hi) / 2;
    let t;
    if (v >= mid) { t = (hi - mid) ? (v - mid) / (hi - mid) : 0; return `rgba(42,122,86,${(Math.min(1,t) * 0.55).toFixed(3)})`; }
    t = (mid - lo) ? (mid - v) / (mid - lo) : 0; return `rgba(176,87,45,${(Math.min(1,t) * 0.55).toFixed(3)})`;
  }

  /* ── Couleur d'une pastille de note (échelle 1→5, basse=terracotta, haute=sauge) ── */
  function chipColor(v, lo = 1, hi = 5) {
    const t = (hi - lo) ? (v - lo) / (hi - lo) : .5; // 0..1
    if (t >= .5) return `rgba(42,122,86,${(0.12 + ((t - .5) / .5) * 0.45).toFixed(3)})`;
    return `rgba(176,87,45,${(0.12 + ((.5 - t) / .5) * 0.45).toFixed(3)})`;
  }

  /* ── Courbe à la plume : trace un graphe SVG dans `host` ──
     opts = {
       series  : [{ name, color, values:[…] }, …],
       xLabels : ['Piranèse', 'Des fleurs…', …],
       yMax    : 10,   yStep : 1,   (graduations de l'axe Y)
       height  : 300
     }
     Les valeurs null créent une coupure dans la courbe (membre absent). */
  function lineChart(host, opts) {
    const { series = [], xLabels = [], yMax = 10, yStep = 1, height = 300 } = opts;
    const W = 920, H = height, padL = 34, padR = 14, padT = 14, padB = 36;
    const iw = W - padL - padR, ih = H - padT - padB, n = xLabels.length;
    const X = i => padL + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
    const Y = v => padT + ih - (v / yMax) * ih;
    let s = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">`;
    // grille horizontale + graduations Y
    for (let g = 0; g <= yMax + 1e-9; g += yStep) {
      const yy = Y(g);
      s += `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" class="sx-grid-line"/>`;
      s += `<text x="${padL - 6}" y="${(yy + 3.5).toFixed(1)}" class="sx-axis-lab sx-ylab">${(+g.toFixed(2))}</text>`;
    }
    // grille verticale (papier millimétré) + labels X
    xLabels.forEach((lb, i) => {
      const xx = X(i);
      s += `<line x1="${xx.toFixed(1)}" y1="${padT}" x2="${xx.toFixed(1)}" y2="${padT + ih}" class="sx-grid-line minor"/>`;
      s += `<text x="${xx.toFixed(1)}" y="${H - 12}" class="sx-axis-lab sx-xlab">${esc(lb)}</text>`;
    });
    // séries (gère les trous : on segmente sur les null)
    series.forEach(se => {
      let seg = [];
      const flush = () => { if (seg.length > 1) s += `<polyline points="${seg.join(' ')}" stroke="${se.color}" class="sx-line"/>`; seg = []; };
      se.values.forEach((v, i) => { if (v == null) { flush(); } else { seg.push(`${X(i).toFixed(1)},${Y(v).toFixed(1)}`); } });
      flush();
      se.values.forEach((v, i) => { if (v != null) s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4" fill="${se.color}"/>`; });
    });
    s += `</svg>`;
    host.innerHTML = s;
  }

  /* ── Légende (réutilisée par colonnes empilées & courbes) ── */
  function legend(items) { // items = [{name,color}]
    return `<div class="sx-legend">${items.map(i => `<span><i style="background:${i.color}"></i>${esc(i.name)}</span>`).join('')}</div>`;
  }

  function esc(x) { return String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  window.SX = { MEMBER_COLORS, memberColor, heatColor, chipColor, lineChart, legend, esc };
})();
