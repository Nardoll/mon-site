// ─────────────────────────────────────────────────────────────────────
//  api/enrich.js — Logique d'enrichissement IA d'un livre
//
//  Appelée par worker.js sur la route /api/enrich?titre=…&auteur=…
//  Renvoie genre, nombre de pages, description en 3 mots, et l'ISBN-13
//  (qui sert à récupérer la VRAIE couverture de façon exacte).
//
//  La clé API vit côté serveur dans le secret Cloudflare ANTHROPIC_API_KEY.
//  Elle n'est jamais exposée au navigateur.
// ─────────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6"; // identification fiable des livres (Haiku se trompait trop)

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    trouve:             { type: "boolean" },
    titre_exact:        { type: ["string", "null"] },
    auteur_exact:       { type: ["string", "null"] },
    annee:              { type: ["integer", "null"] },
    genre:              { type: ["string", "null"] },
    nb_pages:           { type: ["integer", "null"] },
    description_3_mots: { type: ["string", "null"] },
    isbn13:             { type: ["string", "null"] },
  },
  required: ["trouve", "titre_exact", "auteur_exact", "annee", "genre", "nb_pages", "description_3_mots", "isbn13"],
};

const SYSTEME = `Tu es un bibliothécaire expert. À partir d'un titre et d'un auteur (parfois approximatifs ou mal orthographiés), identifie le livre réel et renvoie ses métadonnées.

Règles :
- "trouve" = false si tu n'es pas raisonnablement sûr d'avoir identifié le bon livre. Dans ce cas, mets tous les autres champs à null.
- "genre" : un genre littéraire simple, en français (ex : "Roman", "Science-fiction", "Thriller", "Fantasy", "Essai").
- "description_3_mots" : exactement trois mots ou expressions courtes en français, séparés par des virgules, évoquant les thèmes (ex : "vengeance, évasion, trésor"). Pas de spoiler majeur.
- "nb_pages" : nombre de pages d'une édition courante (estimation raisonnable), sinon null.
- "isbn13" : l'ISBN-13 (13 chiffres, sans tirets) d'une édition existante, de préférence l'édition française la plus répandue. N'INVENTE JAMAIS un ISBN : si tu n'es pas certain qu'il existe réellement, mets null. Un ISBN faux est pire qu'un ISBN absent.
- Renvoie uniquement les données structurées, rien d'autre.`;

export async function handleEnrich(request, env) {
  const url = new URL(request.url);
  const titre = (url.searchParams.get("titre") || "").trim();
  const auteur = (url.searchParams.get("auteur") || "").trim();

  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Clé API non configurée (secret ANTHROPIC_API_KEY manquant côté Cloudflare)." }, 503);
  }
  if (!titre) {
    return json({ error: "Paramètre 'titre' requis." }, 400);
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: SYSTEME,
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
        messages: [
          { role: "user", content: `Titre : ${titre}\nAuteur : ${auteur || "(inconnu)"}` },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "Erreur API Claude", status: res.status, detail }, 502);
    }

    const data = await res.json();
    const textBlock = (data.content || []).find(b => b.type === "text");
    if (!textBlock) return json({ error: "Réponse Claude vide." }, 502);

    let parsed;
    try { parsed = JSON.parse(textBlock.text); }
    catch { return json({ error: "Réponse Claude non JSON.", brut: textBlock.text }, 502); }

    // Normalisation de l'ISBN (que des chiffres, 13 caractères)
    if (parsed.isbn13) {
      const clean = String(parsed.isbn13).replace(/[^0-9]/g, "");
      parsed.isbn13 = clean.length === 13 ? clean : null;
    }

    return json(parsed);
  } catch (e) {
    return json({ error: "Exception serveur", detail: String(e) }, 500);
  }
}
