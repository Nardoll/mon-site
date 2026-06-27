// aggregate.js — à lancer après une collecte complète
// node aggregate.js GUILD_ID
import 'dotenv/config';
import { spawn } from 'child_process';

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

async function fetchAll(col) {
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
    const f = r.document.fields || {};
    const out = {};
    for (const [k, v] of Object.entries(f)) {
      if      (v.stringValue  !== undefined) out[k] = v.stringValue;
      else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
      else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
      else if (v.nullValue    !== undefined) out[k] = null;
      else if (v.arrayValue)                out[k] = (v.arrayValue.values || []).map(x => x.stringValue ?? x.integerValue ?? null);
      else out[k] = null;
    }
    return out;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isoWeek(dateStr) {
  const d    = new Date(dateStr);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const w    = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`;
}
function isoMonth(dateStr) { return dateStr.slice(0, 7); }
function isoYear(dateStr)  { return dateStr.slice(0, 4); }
function currentWeekKey()  { return isoWeek(new Date().toISOString()); }
function currentMonthKey() { return isoMonth(new Date().toISOString()); }

// ── Aggregation ───────────────────────────────────────────────────────────────
async function aggregate() {
  console.log(`\n📊 Agrégation pour le serveur ${GUILD_ID}\n`);

  console.log('  → Chargement des messages…');
  const messages = await fetchAll('discord_messages');
  console.log(`  → ${messages.length} messages chargés`);

  console.log('  → Chargement des membres…');
  const membres = await fetchAll('discord_membres_bot');
  console.log(`  → ${membres.length} membres chargés\n`);

  const memberMap = {};
  membres.forEach(m => { memberMap[m.discord_id] = m; });

  // ── Stats globales ───────────────────────────────────────────────────────
  const msgParMois    = {};
  const msgParSemaine = {};
  const msgParAn      = {};
  const typeCounts    = {};
  const thisWeek      = currentWeekKey();
  const thisMonth     = currentMonthKey();
  const actifsWeekSet  = new Set();
  const actifsMonthSet = new Set();
  let lastSondageDate  = null;

  // ── Stats par salon ──────────────────────────────────────────────────────
  const salonMap = {};

  // ── Stats par membre ─────────────────────────────────────────────────────
  const membreStatsMap = {};

  // ── Parcours unique de tous les messages ─────────────────────────────────
  for (const m of messages) {
    const mo = isoMonth(m.date);
    const we = isoWeek(m.date);
    const yr = isoYear(m.date);
    const tp = m.type || 'texte';

    // Globaux
    msgParMois[mo]    = (msgParMois[mo]    || 0) + 1;
    msgParSemaine[we] = (msgParSemaine[we] || 0) + 1;
    msgParAn[yr]      = (msgParAn[yr]      || 0) + 1;
    typeCounts[tp]    = (typeCounts[tp]    || 0) + 1;
    if (we === thisWeek)  actifsWeekSet.add(m.auteur_id);
    if (mo === thisMonth) actifsMonthSet.add(m.auteur_id);
    if (tp === 'sondage' && (!lastSondageDate || m.date > lastSondageDate)) lastSondageDate = m.date;

    // Par salon
    if (!salonMap[m.salon_id]) {
      salonMap[m.salon_id] = {
        salon_id: m.salon_id, salon_nom: m.salon_nom,
        msgs: 0, nb_reponses: 0, firstMsg: null, lastMsg: null,
        msgParMois: {}, msgParSemaine: {}, msgParAn: {},
        byType: {}, membres: {},
      };
    }
    const s = salonMap[m.salon_id];
    s.msgs++;
    if (m.est_reponse) s.nb_reponses++;
    if (!s.firstMsg || m.date < s.firstMsg) s.firstMsg = m.date;
    if (!s.lastMsg  || m.date > s.lastMsg)  s.lastMsg  = m.date;
    s.msgParMois[mo]    = (s.msgParMois[mo]    || 0) + 1;
    s.msgParSemaine[we] = (s.msgParSemaine[we] || 0) + 1;
    s.msgParAn[yr]      = (s.msgParAn[yr]      || 0) + 1;
    s.byType[tp]        = (s.byType[tp]        || 0) + 1;
    s.membres[m.auteur_id] = (s.membres[m.auteur_id] || 0) + 1;

    // Par membre
    if (!membreStatsMap[m.auteur_id]) {
      membreStatsMap[m.auteur_id] = {
        auteur_id: m.auteur_id,
        msgs: 0, nb_reponses: 0, firstMsg: null, lastMsg: null,
        msgParMois: {}, msgParSemaine: {}, msgParAn: {},
        byType: {}, salons: {},
      };
    }
    const mb = membreStatsMap[m.auteur_id];
    mb.msgs++;
    if (m.est_reponse) mb.nb_reponses++;
    if (!mb.firstMsg || m.date < mb.firstMsg) mb.firstMsg = m.date;
    if (!mb.lastMsg  || m.date > mb.lastMsg)  mb.lastMsg  = m.date;
    mb.msgParMois[mo]       = (mb.msgParMois[mo]       || 0) + 1;
    mb.msgParSemaine[we]    = (mb.msgParSemaine[we]    || 0) + 1;
    mb.msgParAn[yr]         = (mb.msgParAn[yr]         || 0) + 1;
    mb.byType[tp]           = (mb.byType[tp]           || 0) + 1;
    mb.salons[m.salon_id]   = (mb.salons[m.salon_id]   || 0) + 1;
  }

  // ── Finalisation salons ──────────────────────────────────────────────────
  const salons = Object.values(salonMap).map(s => {
    const topMembres = Object.entries(s.membres)
      .sort(([,a],[,b]) => b - a).slice(0, 10)
      .map(([id, count]) => ({
        id, count,
        nom:        memberMap[id]?.display_name || memberMap[id]?.nom || id,
        avatar_url: memberMap[id]?.avatar_url   || null,
      }));
    return {
      salon_id:    s.salon_id,
      salon_nom:   s.salon_nom,
      msgs:        s.msgs,
      nb_reponses: s.nb_reponses,
      firstMsg:    s.firstMsg,
      lastMsg:     s.lastMsg,
      msgParMois:    s.msgParMois,
      msgParSemaine: s.msgParSemaine,
      msgParAn:      s.msgParAn,
      byType:        s.byType,
      topMembres,
    };
  });

  // ── Finalisation membres ─────────────────────────────────────────────────
  const membresStats = Object.values(membreStatsMap).map(mb => {
    const info = memberMap[mb.auteur_id] || {};
    const topSalons = Object.entries(mb.salons)
      .sort(([,a],[,b]) => b - a).slice(0, 5)
      .map(([id, count]) => ({ id, count, nom: salonMap[id]?.salon_nom || id }));
    return {
      auteur_id:    mb.auteur_id,
      nom:          info.nom          || mb.auteur_id,
      display_name: info.display_name || info.nom || mb.auteur_id,
      avatar_url:   info.avatar_url   || null,
      date_arrivee: info.date_arrivee || null,
      msgs:          mb.msgs,
      nb_reponses:   mb.nb_reponses,
      firstMsg:      mb.firstMsg,
      lastMsg:       mb.lastMsg,
      msgParMois:    mb.msgParMois,
      msgParSemaine: mb.msgParSemaine,
      msgParAn:      mb.msgParAn,
      byType:        mb.byType,
      topSalons,
      actif_semaine: actifsWeekSet.has(mb.auteur_id),
      actif_mois:    actifsMonthSet.has(mb.auteur_id),
    };
  });

  // ── Interactions : paires + conversations (fenêtre 30 min) ───────────────
  const WINDOW_MS = 30 * 60 * 1000;
  const pairCounts  = {};
  const conversations = [];

  const bySalon = {};
  for (const m of messages) {
    if (!bySalon[m.salon_id]) bySalon[m.salon_id] = { nom: m.salon_nom, msgs: [] };
    bySalon[m.salon_id].msgs.push(m);
  }

  for (const { nom: salonNom, msgs } of Object.values(bySalon)) {
    msgs.sort((a, b) => a.date.localeCompare(b.date));
    let convo = { participants: new Set(), msgs: [], start: null, end: null };

    const flush = () => {
      if (convo.participants.size < 1) { convo = { participants: new Set(), msgs: [], start: null, end: null }; return; }
      const parts = [...convo.participants];
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++) {
          const k = [parts[i], parts[j]].sort().join('|');
          pairCounts[k] = (pairCounts[k] || 0) + 1;
        }
      if (parts.length >= 2) {
        conversations.push({
          participants: parts,
          participantNames: parts.map(id => memberMap[id]?.display_name || memberMap[id]?.nom || id.slice(0, 8)),
          msgCount: convo.msgs.length,
          start: convo.start,
          end:   convo.end,
          salon: salonNom,
        });
      }
      convo = { participants: new Set(), msgs: [], start: null, end: null };
    };

    for (const m of msgs) {
      const t = new Date(m.date).getTime();
      if (convo.end !== null && t - new Date(convo.end).getTime() > WINDOW_MS) flush();
      convo.participants.add(m.auteur_id);
      convo.msgs.push(m);
      if (!convo.start) convo.start = m.date;
      convo.end = m.date;
    }
    flush();
  }

  const topPaires = Object.entries(pairCounts)
    .sort(([,a],[,b]) => b - a).slice(0, 100)
    .map(([k, count]) => {
      const [id1, id2] = k.split('|');
      return {
        id1, id2, count,
        nom1:    memberMap[id1]?.display_name || memberMap[id1]?.nom || id1,
        nom2:    memberMap[id2]?.display_name || memberMap[id2]?.nom || id2,
        avatar1: memberMap[id1]?.avatar_url   || null,
        avatar2: memberMap[id2]?.avatar_url   || null,
      };
    });

  const topConvos = conversations
    .sort((a, b) => b.msgCount - a.msgCount)
    .slice(0, 100);

  // ── Écriture Firestore ───────────────────────────────────────────────────
  console.log('  → Écriture des stats serveur…');
  await fsSet('discord_stats_serveur', GUILD_ID, {
    serveur_id:       GUILD_ID,
    total_messages:   messages.length,
    total_membres:    membres.length,
    total_salons:     salons.length,
    total_sondages:   typeCounts['sondage'] || 0,
    last_sondage_date: lastSondageDate || null,
    actifs_semaine:   actifsWeekSet.size,
    actifs_mois:      actifsMonthSet.size,
    type_counts:      JSON.stringify(typeCounts),
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
    serveur_id:   GUILD_ID,
    top_paires:   JSON.stringify(topPaires),
    conversations: JSON.stringify(topConvos),
    nb_paires:    Object.keys(pairCounts).length,
    nb_convos:    conversations.length,
    updated_at:   new Date().toISOString(),
  });

  const total = messages.length + membres.length;
  console.log(`\n✅ Agrégation terminée — ${total} lectures, 4 documents écrits.\n`);
}

aggregate().catch(err => { console.error(err); process.exit(1); });
