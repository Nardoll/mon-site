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

  const snap = await getDocs(query(
    collection(db, 'prono_picks'),
    where('match_id', '==', match.id),
    where('scored', '==', false)
  ));
  if (snap.empty) return;

  const batch = writeBatch(db);
  const bo = parseInt(match.best_of) || 5;
  const s1 = parseInt(match.score1) || 0;
  const s2 = parseInt(match.score2) || 0;

  // Score du perdant dans le match réel
  const loserScore = match.winner === match.team1 ? s2 : s1;

  snap.docs.forEach(d => {
    const pick = d.data();
    let points = 0;

    if (pick.pick_winner === match.winner) {
      // Bon gagnant — vérifier le score exact
      const ps1 = parseInt(pick.pick_score1) || 0;
      const ps2 = parseInt(pick.pick_score2) || 0;
      points = (ps1 === s1 && ps2 === s2) ? 5 : 3;
    } else if (bo >= 5) {
      // Mauvais gagnant en BO5 : consolation si le perdant a ≥2 maps
      if (loserScore >= 2) points = 1;
    }

    batch.update(doc(db, 'prono_picks', d.id), { points, scored: true });
  });

  await batch.commit();
}

// ── Leaguepedia sync ──────────────────────────────────────────────
export async function syncTournament(tournamentId) {
  const tour = await getTournament(tournamentId);
  if (!tour) throw new Error('Tournoi introuvable');

  const now = Date.now();
  const COOLDOWN_MS = 5 * 60 * 1000;

  if (tour.sync_cooldown_until) {
    const until = tour.sync_cooldown_until.toMillis
      ? tour.sync_cooldown_until.toMillis()
      : new Date(tour.sync_cooldown_until).getTime();
    if (until > now) {
      return { ok: false, remaining: Math.ceil((until - now) / 1000) };
    }
  }

  if (!tour.leaguepedia_key) throw new Error('Clé Leaguepedia manquante');

  const key = tour.leaguepedia_key;
  const url = `/api/leaguepedia?key=${encodeURIComponent(key)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  if (data.error) throw new Error(data.error.info);

  const rows = data.cargoquery || [];
  const batch = writeBatch(db);
  const finishedMatches = [];
  const teamSet = new Set();

  for (const row of rows) {
    const m = row.title;
    const team1 = m.Team1 || '';
    const team2 = m.Team2 || '';
    const dateStr = m['DateTime UTC'] || '';

    if (!team1 || !team2) continue;

    teamSet.add(team1);
    teamSet.add(team2);

    const matchId = makeMatchId(tournamentId, team1, team2, dateStr);
    const score1 = parseInt(m.Team1Score) || 0;
    const score2 = parseInt(m.Team2Score) || 0;
    const winner = m.Winner || null;

    let status = 'scheduled';
    if (winner) {
      status = 'finished';
    } else if (dateStr) {
      const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + ' UTC');
      if (d < new Date()) status = 'live';
    }

    const matchData = {
      tournament_id: tournamentId,
      team1, team2, date_utc: dateStr,
      best_of: parseInt(m.BestOf) || 5,
      winner, score1, score2, status,
      round: m.Round || '',
      tab: m.Tab || ''
    };

    batch.set(doc(db, 'prono_matches', matchId), matchData, { merge: true });
    if (status === 'finished') finishedMatches.push({ id: matchId, ...matchData });
  }

  // Mettre à jour la liste des équipes dans le tournoi
  const teamsArray = Array.from(teamSet).sort();

  batch.set(doc(db, 'prono_tournaments', tournamentId), {
    last_sync: Timestamp.fromMillis(now),
    sync_cooldown_until: Timestamp.fromMillis(now + COOLDOWN_MS),
    ...(teamsArray.length > 0 ? { teams: teamsArray } : {})
  }, { merge: true });

  await batch.commit();

  for (const match of finishedMatches) {
    await scorePicksForMatch(match);
  }

  return { ok: true, count: rows.length, teams: teamsArray.length };
}

function makeMatchId(tournamentId, t1, t2, date) {
  return `${tournamentId}_${t1}_${t2}_${date}`
    .replace(/[\s:]/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 120);
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
