// Relit tous les messages de type sondage depuis Firestore,
// récupère les détails du poll via Discord, et les réécrit avec le bon ID.
// Usage : node recollect-sondages.js GUILD_ID
import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

const GUILD_ID         = process.argv[2] || process.env.GUILD_ID;
const FIREBASE_PROJECT = 'mon-site-e253f';
const FIREBASE_API_KEY = 'AIzaSyBIMKnV2fpa8rvcWG8uNI-z9n_y-R0ILXI';
const FIRESTORE_BASE   = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`fsSet ${col}/${docId}: ${await res.text()}`);
}

// Récupère tous les messages de type sondage pour ce serveur
async function getSondageMessages() {
  const url  = `${FIRESTORE_BASE}:runQuery?key=${FIREBASE_API_KEY}`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'discord_messages' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'serveur_id' }, op: 'EQUAL', value: { stringValue: GUILD_ID } } },
            { fieldFilter: { field: { fieldPath: 'type' },       op: 'EQUAL', value: { stringValue: 'sondage' } } },
          ],
        },
      },
    },
  };
  const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const rows = await res.json();
  return rows.filter(r => r.document).map(r => {
    const f = r.document.fields || {};
    return {
      message_id: f.message_id?.stringValue || r.document.name.split('/').at(-1).replace(`${GUILD_ID}_`, ''),
      salon_id:   f.salon_id?.stringValue,
      salon_nom:  f.salon_nom?.stringValue,
      auteur_id:  f.auteur_id?.stringValue,
      auteur_nom: f.auteur_nom?.stringValue,
      date:       f.date?.stringValue,
    };
  });
}

async function main() {
  console.log(`\n🗳️  Recollecte des sondages pour ${GUILD_ID}\n`);

  const sondageMsgs = await getSondageMessages();
  console.log(`  → ${sondageMsgs.length} messages de type sondage trouvés\n`);
  if (!sondageMsgs.length) { console.log('Rien à faire.\n'); return; }

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  await new Promise((resolve, reject) => { client.once('ready', resolve); client.once('error', reject); client.login(process.env.DISCORD_TOKEN); });
  console.log(`✅ Connecté : ${client.user.tag}\n`);

  let ok = 0, skip = 0;
  for (const sm of sondageMsgs) {
    try {
      const channel = await client.channels.fetch(sm.salon_id).catch(() => null);
      if (!channel) { skip++; continue; }
      const msg = await channel.messages.fetch(sm.message_id).catch(() => null);
      if (!msg || !msg.poll) { skip++; continue; }

      const propositions = [];
      for (const [answerId, answer] of msg.poll.answers) {
        let votants = [];
        try { const voters = await answer.fetchVoters(); votants = [...voters.values()].map(u => u.id); } catch {}
        propositions.push({ texte: answer.text || `Option ${answerId}`, votants });
      }

      await fsSet('discord_sondages_bot', `${GUILD_ID}_${sm.message_id}`, {
        serveur_id:  GUILD_ID,
        message_id:  sm.message_id,
        salon_id:    sm.salon_id,
        salon_nom:   sm.salon_nom,
        auteur_id:   sm.auteur_id,
        auteur_nom:  sm.auteur_nom,
        date:        sm.date,
        question:    msg.poll.question?.text || '',
        type:        msg.poll.allowMultiselect ? 'multiple' : 'unique',
        propositions,
      });
      ok++;
      process.stdout.write(`\r  ${ok} sondages écrits, ${skip} ignorés…`);
      await sleep(300);
    } catch (e) {
      skip++;
    }
  }

  client.destroy();
  console.log(`\n\n✅ Terminé — ${ok} sondages recollectés, ${skip} ignorés (archivés ou supprimés).\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
