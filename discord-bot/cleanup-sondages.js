// Supprime les sondages en doublon (IDs auto-générés par fsAdd)
// Usage : node cleanup-sondages.js GUILD_ID
import 'dotenv/config';

const GUILD_ID         = process.argv[2] || process.env.GUILD_ID;
const FIREBASE_PROJECT = 'mon-site-e253f';
const FIREBASE_API_KEY = 'AIzaSyBIMKnV2fpa8rvcWG8uNI-z9n_y-R0ILXI';
const FIRESTORE_BASE   = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function listAll() {
  let docs = [], pageToken = null;
  do {
    const url = `${FIRESTORE_BASE}/discord_sondages_bot?key=${FIREBASE_API_KEY}&pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return docs;
}

console.log(`🧹 Nettoyage des sondages en doublon pour ${GUILD_ID}\n`);

const docs = await listAll();
const toDelete = docs.filter(d => {
  const fields = d.fields || {};
  const srvId  = fields.serveur_id?.stringValue;
  const docId  = d.name.split('/').at(-1);
  return srvId === GUILD_ID && !docId.startsWith(`${GUILD_ID}_`);
});

console.log(`🗑️  ${toDelete.length} doublons à supprimer\n`);

let n = 0;
for (const d of toDelete) {
  const url = `https://firestore.googleapis.com/v1/${d.name}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) console.error(`Erreur ${d.name}: ${res.status}`);
  n++;
  if (n % 50 === 0) process.stdout.write(`\r  ${n}/${toDelete.length} supprimés…`);
  await sleep(30);
}

console.log(`\n\n✅ ${n} doublons supprimés.\n`);
