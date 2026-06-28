import { db } from '../firebase-config.js';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  query, where, orderBy, serverTimestamp, Timestamp, writeBatch, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Helpers ───────────────────────────────────────────────────────
async function fsSet(col, id, data) {
  await setDoc(doc(db, col, id), data, { merge: true });
}
async function fsGet(col, id) {
  return getDoc(doc(db, col, id));
}

// ── Profiles ──────────────────────────────────────────────────────
export async function getProfiles() {
  const snap = await getDocs(collection(db, 'prono_profiles'));
  return snap.docs.map(d => ({ id: d.id, name: d.data().pseudo, ...d.data() }));
}

export async function getProfile(id) {
  const snap = await fsGet('prono_profiles', id);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createProfile(pseudo) {
  const ref = await addDoc(collection(db, 'prono_profiles'), {
    pseudo,
    avatar_url: null,
    created_at: serverTimestamp()
  });
  return ref.id;
}

export async function updateProfile(id, data) {
  await fsSet('prono_profiles', id, data);
}

// ── Tournaments ───────────────────────────────────────────────────
export async function getTournaments() {
  const snap = await getDocs(collection(db, 'prono_tournaments'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const order = { live: 0, upcoming: 1, finished: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });
}

export async function getTournament(id) {
  const snap = await fsGet('prono_tournaments', id);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createTournament(data) {
  const ref = await addDoc(collection(db, 'prono_tournaments'), {
    ...data,
    created_at: serverTimestamp()
  });
  return ref.id;
}

// ── Matches ───────────────────────────────────────────────────────
export async function getMatchesByTournament(tournamentId) {
  const snap = await getDocs(query(
    collection(db, 'prono_matches'),
    where('tournament_id', '==', tournamentId)
  ));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date_utc || '').localeCompare(b.date_utc || ''));
}

// ── Picks ─────────────────────────────────────────────────────────
export async function getPicksByTournament(profileId, tournamentId) {
  const snap = await getDocs(query(
    collection(db, 'prono_picks'),
    where('profile_id', '==', profileId),
    where('tournament_id', '==', tournamentId)
  ));
  const result = {};
  snap.docs.forEach(d => { result[d.data().match_id] = { id: d.id, ...d.data() }; });
  return result;
}

export async function getAllPicksByMatch(matchId) {
  const snap = await getDocs(query(
    collection(db, 'prono_picks'),
    where('match_id', '==', matchId)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function savePick(profileId, matchId, tournamentId, pickWinner, pickScore1, pickScore2) {
  await fsSet('prono_picks', `${profileId}_${matchId}`, {
    profile_id: profileId,
    match_id: matchId,
    tournament_id: tournamentId,
    pick_winner: pickWinner,
    pick_score1: pickScore1 ?? null,
    pick_score2: pickScore2 ?? null,
    points: null,
    scored: false,
    updated_at: serverTimestamp()
  });
}

// ── Long-term picks ────────────────────────────────────────────────
export async function getLongTermPicks(profileId, tournamentId) {
  const snap = await getDocs(query(
    collection(db, 'prono_long_term'),
    where('profile_id', '==', profileId),
    where('tournament_id', '==', tournamentId)
  ));
  const result = {};
  snap.docs.forEach(d => { result[d.data().type] = { id: d.id, ...d.data() }; });
  return result;
}

export async function getAllLongTermByTournament(tournamentId) {
  const snap = await getDocs(query(
    collection(db, 'prono_long_term'),
    where('tournament_id', '==', tournamentId)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveLongTermPick(profileId, tournamentId, type, value) {
  await fsSet('prono_long_term', `${profileId}_${tournamentId}_${type}`, {
    profile_id: profileId,
    tournament_id: tournamentId,
    type,
    value,
    points: null,
    scored: false,
    updated_at: serverTimestamp()
  });
}

// ── Scoring ────────────────────────────────────────────────────────
export async function scorePicksForMatch(match) {
  if (match.status !== 'finished' || !match.winner) return;

  // Requête simple sur match_id uniquement (pas de double where → pas d'index composite requis)
  const snap = await getDocs(query(
    collection(db, 'prono_picks'),
    where('match_id', '==', match.id)
  ));
  if (snap.empty) return;

  // Filtrer les non-scorés en JS
  const unscored = snap.docs.filter(d => !d.data().scored);
  if (unscored.length === 0) return;

  const batch = writeBatch(db);
  const s1 = parseInt(match.score1) || 0;
  const s2 = parseInt(match.score2) || 0;

  unscored.forEach(d => {
    const pick = d.data();
    let points = 0;

    if (pick.pick_winner === match.winner) {
      const ps1 = parseInt(pick.pick_score1) || 0;
      const ps2 = parseInt(pick.pick_score2) || 0;
      points = (ps1 === s1 && ps2 === s2) ? 5 : 3;
    }

    batch.update(doc(db, 'prono_picks', d.id), { points, scored: true });
  });

  await batch.commit();
}

// ── LoL Esports API sync ──────────────────────────────────────────
// MSI league ID officiel
const MSI_LEAGUE_ID = "98767991310872058";

export async function syncTournament(tournamentId) {
  const tour = await getTournament(tournamentId);
  if (!tour) throw new Error('Tournoi introuvable');

  const now = Date.now();
  const COOLDOWN_MS = 2 * 60 * 1000;

  if (tour.sync_cooldown_until) {
    const until = tour.sync_cooldown_until.toMillis
      ? tour.sync_cooldown_until.toMillis()
      : new Date(tour.sync_cooldown_until).getTime();
    if (until > now) {
      return { ok: false, remaining: Math.ceil((until - now) / 1000) };
    }
  }

  const leagueId = tour.lol_league_id || MSI_LEAGUE_ID;
  const res = await fetch(`/api/lolesports?endpoint=getSchedule&leagueId=${leagueId}`);
  if (!res.ok) throw new Error(`API LoL Esports : HTTP ${res.status}`);
  const data = await res.json();

  const events = data?.data?.schedule?.events || [];
  if (events.length === 0) throw new Error('Aucun match retourné par l\'API');

  // On charge les matchs existants pour matcher par équipes + date
  const existingMatches = await getMatchesByTournament(tournamentId);
  const existingByKey = {};
  for (const m of existingMatches) {
    const k = matchKey(m.team1, m.team2);
    existingByKey[k] = m;
  }

  const batch = writeBatch(db);
  const finishedMatches = [];
  const logos = { ...(tour.team_logos || {}) };
  let updated = 0;

  for (const ev of events) {
    if (ev.type !== 'match') continue;
    const match = ev.match;
    if (!match?.teams || match.teams.length < 2) continue;

    const [t1, t2] = match.teams;
    const team1 = t1.code || t1.name || '';
    const team2 = t2.code || t2.name || '';
    if (!team1 || !team2) continue;

    // Récupérer les logos depuis l'API
    if (t1.image && !logos[team1]) logos[team1] = t1.image;
    if (t2.image && !logos[team2]) logos[team2] = t2.image;

    // Chercher le match existant dans Firebase
    const key = matchKey(team1, team2);
    const existing = existingByKey[key];
    if (!existing) continue; // match pas dans notre bracket, on skip

    const state = ev.state || 'unstarted';
    const outcome1 = t1.result?.outcome;
    const outcome2 = t2.result?.outcome;
    const wins1 = t1.result?.gameWins ?? 0;
    const wins2 = t2.result?.gameWins ?? 0;

    let status = 'scheduled';
    let winner = null;
    let score1 = null, score2 = null;

    if (state === 'completed') {
      status = 'finished';
      score1 = wins1;
      score2 = wins2;
      if (outcome1 === 'win') winner = team1;
      else if (outcome2 === 'win') winner = team2;
    } else if (state === 'inProgress') {
      status = 'live';
      score1 = wins1;
      score2 = wins2;
    }

    if (existing.status === 'finished' && status !== 'finished') continue;

    const update = { status, winner, score1, score2 };
    batch.set(doc(db, 'prono_matches', existing.id), update, { merge: true });
    if (status === 'finished') finishedMatches.push({ ...existing, ...update });
    updated++;
  }

  batch.set(doc(db, 'prono_tournaments', tournamentId), {
    last_sync: Timestamp.fromMillis(now),
    sync_cooldown_until: Timestamp.fromMillis(now + COOLDOWN_MS),
    team_logos: logos
  }, { merge: true });

  await batch.commit();

  for (const match of finishedMatches) {
    await scorePicksForMatch(match);
  }

  return { ok: true, count: updated, total: events.length };
}

function matchKey(t1, t2) {
  return [t1, t2].sort().join('__');
}

// ── Player breakdown ───────────────────────────────────────────────
export async function getPlayerBreakdown(profileId) {
  const snap = await getDocs(query(
    collection(db, 'prono_picks'),
    where('profile_id', '==', profileId),
    where('scored', '==', true)
  ));
  const byTournament = {};
  snap.docs.forEach(d => {
    const p = d.data();
    const tid = p.tournament_id;
    if (!byTournament[tid]) byTournament[tid] = { points: 0, correct: 0, perfect: 0 };
    byTournament[tid].points += p.points || 0;
    if ((p.points || 0) >= 3) byTournament[tid].correct++;
    if ((p.points || 0) >= 5) byTournament[tid].perfect++;
  });
  return byTournament;
}

// ── Admin ─────────────────────────────────────────────────────────
export async function updateMatch(matchId, data) {
  await fsSet('prono_matches', matchId, data);
}

export async function updateTournament(id, data) {
  await fsSet('prono_tournaments', id, data);
}

// ── Classement ────────────────────────────────────────────────────
export async function getLeaderboard(tournamentId) {
  const profiles = await getProfiles();
  const constraints = [where('scored', '==', true)];
  if (tournamentId) constraints.push(where('tournament_id', '==', tournamentId));

  const snap = await getDocs(query(collection(db, 'prono_picks'), ...constraints));

  const pts = {}, correct = {}, perfect = {};
  snap.docs.forEach(d => {
    const p = d.data();
    const pid = p.profile_id;
    pts[pid]     = (pts[pid] || 0) + (p.points || 0);
    if ((p.points || 0) >= 3) correct[pid] = (correct[pid] || 0) + 1;
    if ((p.points || 0) >= 5) perfect[pid] = (perfect[pid] || 0) + 1;
  });

  return profiles
    .map(p => ({
      id: p.id,
      name: p.name || p.pseudo,
      avatar_url: p.avatar_url || null,
      points: pts[p.id] || 0,
      correct: correct[p.id] || 0,
      perfect: perfect[p.id] || 0
    }))
    .sort((a, b) => b.points - a.points || b.correct - a.correct || b.perfect - a.perfect);
}
