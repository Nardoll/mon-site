// ─────────────────────────────────────────────────────────────────────
//  worker.js — Point d'entrée Cloudflare Worker
//
//  Le site est servi comme un Worker + fichiers statiques (binding ASSETS).
//  Ce Worker route les requêtes /api/* vers le code dynamique, et délègue
//  tout le reste (HTML, CSS, JS, images) aux fichiers statiques.
// ─────────────────────────────────────────────────────────────────────
import { handleEnrich } from "./api/enrich.js";

async function handleLeaguepedia(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response(JSON.stringify({ error: "missing key" }), { status: 400 });

  const lpUrl = [
    "https://lol.fandom.com/api.php?action=cargoquery",
    "tables=MatchSchedule",
    "fields=Team1,Team2,DateTime+UTC,BestOf,Winner,Team1Score,Team2Score,Tab,Round",
    `where=OverviewPage%3D"${encodeURIComponent(key)}"`,
    "order_by=DateTime+UTC+ASC",
    "limit=500",
    "format=json"
  ].join("&");

  const cacheKey = new Request(lpUrl);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return addCors(cached);

  const res = await fetch(lpUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; pronostics-bot/1.0)" }
  });
  const data = await res.text();
  const response = new Response(data, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=120"
    }
  });
  if (res.ok) await cache.put(cacheKey, response.clone());
  return addCors(response);
}

const LOL_API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const LOL_BASE = "https://esports-api.lolesports.com/persisted/gw";

async function handleLolesports(request) {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint") || "getSchedule";
  const leagueId = url.searchParams.get("leagueId") || "";
  const tournamentId = url.searchParams.get("tournamentId") || "";

  let apiUrl = `${LOL_BASE}/${endpoint}?hl=en-US`;
  if (leagueId) apiUrl += `&leagueId=${leagueId}`;
  if (tournamentId) apiUrl += `&tournamentId=${tournamentId}`;

  const cacheKey = new Request(apiUrl);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return addCors(cached);

  const res = await fetch(apiUrl, {
    headers: { "x-api-key": LOL_API_KEY }
  });
  const data = await res.text();
  const response = new Response(data, {
    status: res.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=120"
    }
  });
  if (res.ok) await cache.put(cacheKey, response.clone());
  return addCors(response);
}

function addCors(res) {
  const r = new Response(res.body, res);
  r.headers.set("Access-Control-Allow-Origin", "*");
  return r;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/enrich") {
      return handleEnrich(request, env);
    }

    if (url.pathname === "/api/leaguepedia") {
      return handleLeaguepedia(request);
    }

    if (url.pathname === "/api/lolesports") {
      return handleLolesports(request);
    }

// Tout le reste : fichiers statiques (index.html, /lis-tes-ratures/…, etc.)
    const res = await env.ASSETS.fetch(request);

    // Les pages HTML, le JS et le CSS ne doivent jamais être servis depuis un
    // cache navigateur périmé (sinon une nouvelle fonctionnalité « n'apparaît
    // pas » — un fichier JS modifié restait caché malgré le déploiement).
    const isNoCache = url.pathname.endsWith("/") || /\.(html|js|css)$/.test(url.pathname);
    if (isNoCache) {
      const fresh = new Response(res.body, res);
      fresh.headers.set("Cache-Control", "no-cache");
      return fresh;
    }
    return res;
  },
};
