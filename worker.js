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
    return env.ASSETS.fetch(request);
  },
};
