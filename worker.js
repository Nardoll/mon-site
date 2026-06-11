// ─────────────────────────────────────────────────────────────────────
//  worker.js — Point d'entrée Cloudflare Worker
//
//  Le site est servi comme un Worker + fichiers statiques (binding ASSETS).
//  Ce Worker route les requêtes /api/* vers le code dynamique, et délègue
//  tout le reste (HTML, CSS, JS, images) aux fichiers statiques.
// ─────────────────────────────────────────────────────────────────────
import { handleEnrich } from "./api/enrich.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/enrich") {
      return handleEnrich(request, env);
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
