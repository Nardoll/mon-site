// aggregate.js — à lancer après une collecte complète
// node aggregate.js GUILD_ID
// Lit tous les messages une seule fois, calcule les stats, écrit dans discord_stats_*

import 'dotenv/config';

const GUILD_ID         = process.argv[2] || process.env.GUILD_ID;
const FIREBASE_PROJECT = 'mon-site-e253f';
const FIREBASE_API_KEY = 'AIzaSyBIMKnV2fpa8rvcWG8uNI-z9n_y-R0ILXI';
const FIRESTORE_BASE   = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

if (!GUILD_ID) { console.error('Usage: node aggregate.js GUILD_ID'); process.exit(1); }

// ── Firestore REST ────────────────────────────────────────────────────────────
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean')        return { booleanValue: v };
  if (typeof v === 'number')         return { integerValue: String(v) };
  if (typeof v === 'string')         return { stringValue: v };
  if (Array.isArray(v))              return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object')         return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));
}
async function fsSet(col, docId, data) {
  const fields    = Object.keys(data);
  const fieldMask = fields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${FIRESTORE_BASE}/${col}/${docId}?${fieldMask}&key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`fsSet ${col}/${docId}: ${await res.text()}`);
}

async function fetchAll(col, filter) {
  // Structured query via runQuery
  const url  = `${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: col }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'serveur_id' },
          op:    'EQUAL',
          value: { stringValue: GUILD_ID },
        },
      },
    },
  };
  const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`fetchAll ${col}: ${await res.text()}`);
  const rows = await res.json();
  return rows.filter(r => r.document).map(r => {
    const f = r.document.fields;
    const out = {};
    for (const [k, v] of Object.entries(f)) {
      if (v.stringValue  !== undefined) out[k] = v.stringValue;
      else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
      else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
      else if (v.nullValue    !== undefined) out[k] = null;
      else if (v.arrayValue)  out[k] = (v.arrayValue.values || []).map(x => x.stringValue ?? x.integerValue ?? null);
      else out[k] = null;
    }
    return out;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isoWeek(dateStr) {
  const d   = new Date(dateStr);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const w   = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
}
function isoMonth(dateStr) { return dateStr.slice(0, 7); }
function isoYear(dateStr)  { return dateStr.slice(0, 4); }

function currentWeekKey() { return isoWeek(new Date().toISOString()); }
function currentMonthKey() { return isoMonth(new Date().toISOString()); }

// ── Aggregation ───────────────────────────────────────────────────────────────
async function aggregate() {
  console.log(`\n📊 Agrégation pour le serveur ${GUILD_ID}\n`);

  console.log('  → Chargement des messages…');
  const messages = await fetchAll('discord_messages');
  console.log(`  → ${messages.length} messages chargés`);

  console.log('  → Chargement des membres…');
  const membres = await fetchAll('discord_membres_bot');
  console.log(`  → ${membres.length} membres chargés`);

  const memberMap = {};
  membres.forEach(m => { memberMap[m.discord_id] = m; });

  // ── Stats serveur ────────────────────────────────────────────────────────
  const msgParMois    = {};
  const msgParSemaine = {};
  const msgParAn      = {};
  const thisWeek  = currentWeekKey();
  const thisMonth = currentMonthKey();
  const actifsWeekSet  = new Set();
  const actifsMonthSet = new Set();

  messages.forEach(m => {
    const mo = isoMonth(m.date);
    const we = isoWeek(m.date);
    const yr = isoYear(m.date);
    msgParMois[mo]    = (msgParMois[mo]    || 0) + 1;
    msgParSemaine[we] = (msgParSemaine[we] || 0) + 1;
    msgParAn[yr]      = (msgParAn[yr]      || 0) + 1;
    if (we === thisWeek)  actifsWeekSet.add(m.auteur_id);
    if (mo === thisMonth) actifsMonthSet.add(m.auteur_id);
  });

  // ── Stats par salon ──────────────────────────────────────────────────────
  const salonMap = {};
  messages.forEach(m => {
    if (!salonMap[m.salon_id]) salonMap[m.salon_id] = {
      salon_id: m.salon_id, salon_nom: m.salon_nom,
      msgs: 0, firstMsg: null, lastMsg: null,
      msgParMois: {}, membres: {},
    };
    const s = salonMap[m.salon_id];
    s.msgs++;
    if (!s.firstMsg || m.date < s.firstMsg) s.firstMsg = m.date;
    if (!s.lastMsg  || m.date > s.lastMsg)  s.lastMsg  = m.date;
    const mo = isoMonth(m.date);
    s.msgParMois[mo] = (s.msgParMois[mo] || 0) + 1;
    s.membres[m.auteur_id] = (s.membres[m.auteur_id] || 0) + 1;
  });

  // Top 10 membres par salon
  const salons = Object.values(salonMap).map(s => {
    const topMembres = Object.entries(s.membres)
      .sort(([,a],[,b]) => b - a).slice(0, 10)
      .map(([id, count]) => ({
        id, count,
        nom: memberMap[id]?.display_name || memberMap[id]?.nom || id,
        avatar_url: memberMap[id]?.avatar_url || null,
      }));
    return { ...s, membres: undefined, topMembres, msgParMois: s.msgParMois };
  });

  // ── Stats par membre ─────────────────────────────────────────────────────
  const membreStatsMap = {};
  messages.forEach(m => {
    if (!membreStatsMap[m.auteur_id]) membreStatsMap[m.auteur_id] = {
      auteur_id: m.auteur_id,
      msgs: 0, reponses: 0, firstMsg: null, lastMsg: null,
      msgParMois: {}, salons: {},
    };
    const mb = membreStatsMap[m.auteur_id];
    mb.msgs++;
    if (m.est_reponse) mb.reponses++;
    if (!mb.firstMsg || m.date < mb.firstMsg) mb.firstMsg = m.date;
    if (!mb.lastMsg  || m.date > mb.lastMsg)  mb.lastMsg  = m.date;
    const mo = isoMonth(m.date);
    mb.msgParMois[mo]      = (mb.msgParMois[mo]      || 0) + 1;
    mb.salons[m.salon_id]  = (mb.salons[m.salon_id]  || 0) + 1;
  });

  const membresStats = Object.values(membreStatsMap).map(mb => {
    const info = memberMap[mb.auteur_id] || {};
    const topSalons = Object.entries(mb.salons)
      .sort(([,a],[,b]) => b - a).slice(0, 5)
      .map(([id, count]) => ({ id, count, nom: salonMap[id]?.salon_nom || id }));
    return {
      auteur_id: mb.auteur_id,
      nom:          info.nom          || mb.auteur_id,
      display_name: info.display_name || info.nom || mb.auteur_id,
      avatar_url:   info.avatar_url   || null,
      msgs:         mb.msgs,
      reponses:     mb.reponses,
      firstMsg:     mb.firstMsg,
      lastMsg:      mb.lastMsg,
      msgParMois:   mb.msgParMois,
      topSalons,
      actif_semaine: actifsWeekSet.has(mb.auteur_id),
      actif_mois:    actifsMonthSet.has(mb.auteur_id),
    };
  });

  // ── Stats interactions (paires + réponses directes) ──────────────────────
  const pairCounts = {};

  // Conversations par proximité temporelle (5 min, par salon)
  const bySalon = {};
  messages.forEach(m => {
    if (!bySalon[m.salon_id]) bySalon[m.salon_id] = [];
    bySalon[m.salon_id].push(m);
  });

  const WINDOW_MS = 5 * 60 * 1000;
  Object.values(bySalon).forEach(msgs => {
    const sorted = msgs.slice().sort((a, b) => a.date.localeCompare(b.date));
    let convo = { participants: new Set(), lastTime: 0 };
    const flush = () => {
      const parts = [...convo.participants];
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) {
          const k = [parts[i], parts[j]].sort().join('|');
          pairCounts[k] = (pairCounts[k] || 0) + 1;
        }
      convo = { participants: new Set(), lastTime: 0 };
    };
    for (const m of sorted) {
      const t = new Date(m.date).getTime();
      if (convo.lastTime && t - convo.lastTime > WINDOW_MS) flush();
      convo.participants.add(m.auteur_id);
      convo.lastTime = t;
    }
    flush();
  });

  // Top paires
  const topPaires = Object.entries(pairCounts)
    .sort(([,a],[,b]) => b - a).slice(0, 50)
    .map(([k, count]) => {
      const [id1, id2] = k.split('|');
      return {
        id1, id2, count,
        nom1: memberMap[id1]?.display_name || memberMap[id1]?.nom || id1,
        nom2: memberMap[id2]?.display_name || memberMap[id2]?.nom || id2,
        avatar1: memberMap[id1]?.avatar_url || null,
        avatar2: memberMap[id2]?.avatar_url || null,
      };
    });

  // ── Écriture Firestore ───────────────────────────────────────────────────
  console.log('\n  → Écriture des stats serveur…');
  await fsSet('discord_stats_serveur', GUILD_ID, {
    serveur_id:       GUILD_ID,
    total_messages:   messages.length,
    total_membres:    membres.length,
    total_salons:     salons.length,
    actifs_semaine:   actifsWeekSet.size,
    actifs_mois:      actifsMonthSet.size,
    msg_par_mois:     JSON.stringify(msgParMois),
    msg_par_semaine:  JSON.stringify(msgParSemaine),
    msg_par_an:       JSON.stringify(msgParAn),
    updated_at:       new Date().toISOString(),
  });

  console.log('  → Écriture des stats salons…');
  await fsSet('discord_stats_salons', GUILD_ID, {
    serveur_id: GUILD_ID,
    salons:     JSON.stringify(salons),
    updated_at: new Date().toISOString(),
  });

  console.log('  → Écriture des stats membres…');
  await fsSet('discord_stats_membres', GUILD_ID, {
    serveur_id: GUILD_ID,
    membres:    JSON.stringify(membresStats),
    updated_at: new Date().toISOString(),
  });

  console.log('  → Écriture des stats interactions…');
  await fsSet('discord_stats_interactions', GUILD_ID, {
    serveur_id:  GUILD_ID,
    top_paires:  JSON.stringify(topPaires),
    nb_paires:   Object.keys(pairCounts).length,
    updated_at:  new Date().toISOString(),
  });

  const total = messages.length + membres.length;
  console.log(`\n✅ Agrégation terminée — ${total} lectures, 4 documents écrits.\n`);
  console.log('💡 Maintenant les pages ne liront plus que 1-4 documents au lieu de 60K.\n');
}

aggregate().catch(err => { console.error(err); process.exit(1); });
