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

// Tout le reste : fichiers statiques (index.html, /lis-tes-ratures/…, etc.)
    const res = await env.ASSETS.fetch(request);

    // Les pages HTML ne doivent jamais être servies depuis un cache navigateur
    // périmé (sinon une nouvelle fonctionnalité « n'apparaît pas »).
    const isHtml = url.pathname.endsWith("/") || url.pathname.endsWith(".html");
    if (isHtml) {
      const fresh = new Response(res.body, res);
      fresh.headers.set("Cache-Control", "no-cache");
      return fresh;
    }
    return res;
  },
};
