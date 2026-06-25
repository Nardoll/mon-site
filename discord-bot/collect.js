import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import 'dotenv/config';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID      = process.env.GUILD_ID;

const FIREBASE_PROJECT = 'mon-site-e253f';
const FIREBASE_API_KEY = 'AIzaSyBIMKnV2fpa8rvcWG8uNI-z9n_y-R0ILXI';
const FIRESTORE_BASE   = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

const CHECKPOINT_FILE = './checkpoint.json';

// ── Checkpoint (reprise incrémentale) ───────────────────────────────────────
function loadCheckpoint() {
  return existsSync(CHECKPOINT_FILE)
    ? JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'))
    : {};
}
function saveCheckpoint(cp) {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ── Firestore REST ───────────────────────────────────────────────────────────
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
async function fsAdd(collection, data) {
  const res = await fetch(`${FIRESTORE_BASE}/${collection}?key=${FIREBASE_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: toFields(data) })
  });
  if (!res.ok) throw new Error(`Firestore ${collection}: ${await res.text()}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getType(msg) {
  if (msg.poll) return 'sondage';
  if (msg.attachments.size > 0) {
    const ct = msg.attachments.first().contentType || '';
    if (ct.startsWith('image/')) return 'image';
    if (ct.startsWith('video/')) return 'video';
    return 'fichier';
  }
  if (/https?:\/\//.test(msg.content)) return 'lien';
  return 'texte';
}

// ── Traitement d'un message ──────────────────────────────────────────────────
async function processMessage(msg, channel) {
  if (msg.author.bot) return;

  const type = getType(msg);

  await fsAdd('discord_messages', {
    serveur_id:           GUILD_ID,
    salon_id:             channel.id,
    salon_nom:            channel.name,
    auteur_id:            msg.author.id,
    auteur_nom:           msg.author.username,
    date:                 msg.createdAt.toISOString(),
    timestamp:            msg.createdTimestamp,
    type,
    est_reponse:          !!msg.reference?.messageId,
    reponse_a_message_id: msg.reference?.messageId || null,
  });

  // Sondage natif : on stocke aussi le détail
  if (type === 'sondage' && msg.poll) {
    const propositions = [];
    for (const [answerId, answer] of msg.poll.answers) {
      let votants = [];
      try {
        const voters = await answer.fetchVoters();
        votants = [...voters.values()].map(u => u.id);
      } catch { /* sondage expiré ou sans votes */ }
      propositions.push({ texte: answer.text || `Option ${answerId}`, votants });
    }
    await fsAdd('discord_sondages_bot', {
      serveur_id:  GUILD_ID,
      message_id:  msg.id,
      salon_id:    channel.id,
      salon_nom:   channel.name,
      auteur_id:   msg.author.id,
      auteur_nom:  msg.author.username,
      date:        msg.createdAt.toISOString(),
      question:    msg.poll.question?.text || '',
      type:        msg.poll.allowMultiselect ? 'multiple' : 'unique',
      propositions,
    });
  }

  await sleep(60); // respecte le rate limit Discord
}

// ── Collecte d'un salon ──────────────────────────────────────────────────────
async function collectChannel(channel, checkpoint) {
  process.stdout.write(`  #${channel.name} ... `);
  let count   = 0;
  let newestId = checkpoint[channel.id] || null;

  if (newestId) {
    // Incrémental : uniquement les messages plus récents
    let afterId  = newestId;
    let hasMore  = true;
    while (hasMore) {
      const batch = await channel.messages.fetch({ limit: 100, after: afterId });
      if (batch.size === 0) break;
      const sorted = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      for (const msg of sorted) {
        await processMessage(msg, channel);
        count++;
        if (msg.id > newestId) newestId = msg.id;
      }
      afterId  = sorted.at(-1).id;
      hasMore  = batch.size === 100;
      await sleep(300);
    }
  } else {
    // Scan complet (première fois)
    let before  = undefined;
    let hasMore = true;
    while (hasMore) {
      const opts = { limit: 100 };
      if (before) opts.before = before;
      const batch = await channel.messages.fetch(opts);
      if (batch.size === 0) break;
      const sorted = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      for (const msg of sorted) {
        await processMessage(msg, channel);
        count++;
        if (!newestId || msg.id > newestId) newestId = msg.id;
      }
      before  = sorted[0].id;
      hasMore = batch.size === 100;
      await sleep(300);
    }
  }

  console.log(`${count} messages`);
  return newestId;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 Discord Data Collector\n');

  const checkpoint = loadCheckpoint();
  const isIncremental = Object.keys(checkpoint).length > 0;
  console.log(isIncremental ? '🔄 Mode incrémental (reprise)\n' : '🆕 Première collecte complète\n');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ]
  });

  await client.login(DISCORD_TOKEN);
  console.log(`✅ Connecté : ${client.user.tag}\n`);

  const guild = await client.guilds.fetch(GUILD_ID);
  console.log(`📡 Serveur : ${guild.name}\n`);

  // Membres
  console.log('👥 Membres...');
  const members = await guild.members.fetch();
  let mbCount = 0;
  for (const [id, member] of members) {
    if (member.user.bot) continue;
    await fsAdd('discord_membres_bot', {
      serveur_id:   GUILD_ID,
      discord_id:   id,
      nom:          member.user.username,
      display_name: member.displayName,
      avatar_url:   member.user.displayAvatarURL(),
      date_arrivee: member.joinedAt?.toISOString() || null,
    });
    mbCount++;
  }
  console.log(`  → ${mbCount} membres\n`);

  // Salons textuels
  const channels = await guild.channels.fetch();
  const textChannels = [...channels.values()]
    .filter(c => c?.type === ChannelType.GuildText)
    .sort((a, b) => a.position - b.position);

  console.log(`💬 ${textChannels.length} salons textuels\n`);

  for (const channel of textChannels) {
    try {
      const newestId = await collectChannel(channel, checkpoint);
      if (newestId) {
        checkpoint[channel.id] = newestId;
        saveCheckpoint(checkpoint); // sauvegarde après chaque salon
      }
    } catch (err) {
      console.log(`  ⚠️  #${channel.name} ignoré : ${err.message}`);
    }
  }

  console.log('\n✅ Collecte terminée ! Checkpoint sauvegardé.');
  client.destroy();
}

main().catch(err => { console.error(err); process.exit(1); });
