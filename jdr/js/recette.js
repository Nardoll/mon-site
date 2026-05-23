// ── recette.js — Analyse de corrélation "Recette Magique" ──────────

function escH(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tsToDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
}

function getDurationMonths(p) {
  const dates = (p.dates_seances || []).map(entry => {
    if (!entry) return null;
    if (typeof entry.seconds === 'number') return new Date(entry.seconds * 1000);
    if (entry.toDate) return entry.toDate();
    if (entry.date) return tsToDate(entry.date);
    return null;
  }).filter(Boolean);
  if (dates.length < 2) return null;
  dates.sort((a, b) => a - b);
  return (dates[dates.length - 1] - dates[0]) / (1000 * 86400 * 30.44);
}

// Corrélation de Pearson entre deux tableaux de valeurs numériques
function pearson(pairs) { // [[y, x], ...] — x peut être null
  const valid = pairs.filter(([, x]) => x != null && !isNaN(x));
  const m = valid.length;
  if (m < 4) return null;
  const xs = valid.map(([, x]) => x);
  const ys = valid.map(([y]) => y);
  const mx = xs.reduce((a, b) => a + b, 0) / m;
  const my = ys.reduce((a, b) => a + b, 0) / m;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < m; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx  += (xs[i] - mx) ** 2;
    dy  += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return { r: num / Math.sqrt(dx * dy), n: m };
}

// Corrélation point-bisériale entre variable binaire (0/1) et satisfaction
function pointBiserial(arr) { // [{ y: satisfaction, x: 0|1 }, ...]
  const m   = arr.length;
  const g1  = arr.filter(v => v.x === 1);
  const g0  = arr.filter(v => v.x === 0);
  if (g1.length < 2 || g0.length < 2) return null;

  const M1   = g1.reduce((a, v) => a + v.y, 0) / g1.length;
  const M0   = g0.reduce((a, v) => a + v.y, 0) / g0.length;
  const allY = arr.map(v => v.y);
  const meanY = allY.reduce((a, b) => a + b, 0) / m;
  const sY  = Math.sqrt(allY.reduce((a, b) => a + (b - meanY) ** 2, 0) / m);
  if (sY === 0) return null;

  const r = ((M1 - M0) / sY) * Math.sqrt(g1.length * g0.length / (m * m));
  return { r, n: m, n1: g1.length, n0: g0.length, M1: M1.toFixed(2), M0: M0.toFixed(2) };
}

export function renderRecette(projets) {
  const el = document.getElementById('view-recette');
  const withSat = projets.filter(p => p.deja_joue && p.satisfaction > 0);

  if (withSat.length < 4) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧪</div><p>Il faut au moins 4 projets notés pour lancer l'analyse.</p></div>`;
    return;
  }

  const n      = withSat.length;
  const satVals = withSat.map(p => p.satisfaction);
  const satMean = satVals.reduce((a, b) => a + b, 0) / n;

  const factors = [];

  // ── Variables numériques (Pearson) ─────────────────────────────

  const seancesR = pearson(withSat.map(p => [p.satisfaction, p.nb_seances_mj]));
  if (seancesR) factors.push({ key: 'Nombre de séances MJ', r: seancesR.r, n: seancesR.n, type: 'num',
    detail: `Corrélation de Pearson sur ${seancesR.n} projets` });

  const durR = pearson(withSat.map(p => [p.satisfaction, getDurationMonths(p)]));
  if (durR) factors.push({ key: 'Durée du projet (mois)', r: durR.r, n: durR.n, type: 'num',
    detail: `Corrélation de Pearson sur ${durR.n} projets` });

  const joueurR = pearson(withSat.map(p => [p.satisfaction, p.nb_seances_joueurs]));
  if (joueurR) factors.push({ key: 'Nombre de séances joueurs', r: joueurR.r, n: joueurR.n, type: 'num',
    detail: `Corrélation de Pearson sur ${joueurR.n} projets` });

  // ── Variables booléennes (point-bisériale) ─────────────────────

  function addBool(key, fn) {
    const arr = withSat.map(p => ({ y: p.satisfaction, x: fn(p) ? 1 : 0 }));
    const res = pointBiserial(arr);
    if (res) factors.push({ key, r: res.r, n: res.n, type: 'bool',
      detail: `Moy. si présent : ${res.M1} ★ vs absent : ${res.M0} ★ (${res.n1} avec / ${res.n0} sans)` });
  }

  addBool('YouTube', p => p.youtube);
  addBool('Format IRL', p => p.irl);
  addBool('Format Online', p => p.online);

  // ── Variables catégorielles (point-bisériale par valeur) ────────

  function addCatField(field, label) {
    const vals = [...new Set(withSat.flatMap(p => p[field] || []))];
    vals.forEach(val => {
      const arr = withSat.map(p => ({ y: p.satisfaction, x: (p[field] || []).includes(val) ? 1 : 0 }));
      const res = pointBiserial(arr);
      if (res && Math.abs(res.r) >= 0.1) {
        factors.push({ key: `${label} : ${val}`, r: res.r, n: res.n, type: 'cat',
          detail: `Moy. présent : ${res.M1} ★ vs absent : ${res.M0} ★ (${res.n1} avec / ${res.n0} sans)` });
      }
    });
  }

  addCatField('type', 'Type');
  addCatField('createur', 'Créateur');
  addCatField('participants', 'Participant');
  addCatField('univers', 'Univers');
  addCatField('systeme', 'Système');

  factors.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  // ── Rendu HTML ────────────────────────────────────────────────

  function rColor(r) {
    if (r >= 0.4)  return '#3a6e48';
    if (r >= 0.15) return '#5a9e6f';
    if (r <= -0.4) return '#8b3535';
    if (r <= -0.15) return '#c87a00';
    return '#6b8c63';
  }

  function rBar(r) {
    const pct = Math.round(Math.abs(r) * 100);
    const color = rColor(r);
    return `<div class="recette-bar-wrap">
      <div class="recette-bar-neg">${r < 0 ? `<div class="recette-bar" style="width:${pct}%;background:${color}"></div>` : ''}</div>
      <div class="recette-bar-center"></div>
      <div class="recette-bar-pos">${r >= 0 ? `<div class="recette-bar" style="width:${pct}%;background:${color}"></div>` : ''}</div>
    </div>`;
  }

  const topPos = factors.filter(f => f.r > 0).slice(0, 3);
  const topNeg = factors.filter(f => f.r < 0).slice(0, 3);

  const recetteHTML = [
    topPos.length ? `<div class="recette-recipe">
      <div class="recette-recipe-title">🏆 Facteurs les plus positifs</div>
      <ul>${topPos.map(f => `<li><strong>${escH(f.key)}</strong> — r = ${f.r >= 0 ? '+' : ''}${f.r.toFixed(2)} · ${escH(f.detail)}</li>`).join('')}</ul>
    </div>` : '',
    topNeg.length ? `<div class="recette-recipe recette-recipe-neg">
      <div class="recette-recipe-title">⚠️ Facteurs les plus négatifs</div>
      <ul>${topNeg.map(f => `<li><strong>${escH(f.key)}</strong> — r = ${f.r.toFixed(2)} · ${escH(f.detail)}</li>`).join('')}</ul>
    </div>` : '',
  ].join('');

  el.innerHTML = `
    <div class="recette-wrap">
      <div class="recette-header">
        <h2 class="recette-title">✨ Recette Magique</h2>
        <p class="recette-subtitle">Quels éléments sont le plus corrélés avec la satisfaction de tes projets JDR ?</p>
      </div>

      <div class="recette-meta">${n} projets notés · Satisfaction moyenne : ${satMean.toFixed(2)} ★</div>

      ${recetteHTML}

      <div class="recette-section-title">Tous les facteurs — triés par corrélation absolue</div>

      <div class="recette-table">
        <div class="recette-table-header">
          <span>Facteur</span>
          <span>Corrélation (axe centré)</span>
          <span style="text-align:right">r</span>
        </div>
        ${factors.map(f => `
          <div class="recette-row" title="${escH(f.detail)}">
            <div class="recette-row-key">${escH(f.key)}</div>
            ${rBar(f.r)}
            <div class="recette-row-r" style="color:${rColor(f.r)}">${f.r >= 0 ? '+' : ''}${f.r.toFixed(2)}</div>
          </div>`).join('')}
        ${!factors.length ? '<div class="recette-empty">Pas assez de données pour calculer des corrélations significatives.</div>' : ''}
      </div>

      <div class="recette-method">
        <div class="recette-method-title">📊 Méthodologie</div>
        <p>L'analyse compare chaque facteur avec la satisfaction des projets (note de 1 à 5). Deux types de corrélation :</p>
        <ul>
          <li><strong>Variables numériques</strong> (nb séances, durée) : corrélation de <strong>Pearson <em>r</em></strong> — mesure la relation linéaire entre deux grandeurs continues.</li>
          <li><strong>Variables catégorielles</strong> (type, créateur, participants, univers, système, format, YouTube) : corrélation <strong>point-bisériale</strong> — chaque valeur devient une variable binaire (présent = 1 / absent = 0). On mesure si les projets avec cette valeur ont une satisfaction plus haute ou plus basse que les autres.</li>
        </ul>
        <p>Lecture de <em>r</em> : de −1 (corrélation négative parfaite) à +1 (positive parfaite). Seuls les facteurs avec |<em>r</em>| ≥ 0,1 et au moins 2 projets dans chaque groupe sont affichés.</p>
        <p class="recette-caveat">⚠️ Avec peu de données, les résultats sont indicatifs. Une corrélation n'implique pas une causalité.</p>
      </div>
    </div>`;
}
