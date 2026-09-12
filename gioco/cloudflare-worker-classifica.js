/**
 * Cloudflare Worker — classifica globale di Numeroids
 *
 * COSA FA:
 * - GET  -> restituisce i 6 migliori punteggi salvati
 * - POST -> riceve { initials, score }, lo aggiunge alla classifica se rientra
 *           nei primi 6, e restituisce la classifica aggiornata
 *
 * COME ATTIVARLO:
 * 1. Vai su https://dash.cloudflare.com e crea un account gratuito
 * 2. Nel menu a sinistra: Workers & Pages -> Create -> Create Worker
 * 3. Dagli un nome (es. "numeroids-scores") e crealo
 * 4. Apri l'editor del Worker, cancella il codice di esempio e incolla
 *    tutto il contenuto di questo file
 * 5. Prima di fare Deploy, vai su Settings -> Variables -> KV Namespace Bindings
 *    -> Add binding: Variable name = HIGHSCORES, crea un nuovo namespace KV
 *    (es. "numeroids-kv") e collegalo
 * 6. Fai Deploy. Ti verrà mostrato un URL tipo:
 *    https://numeroids-scores.tuonome.workers.dev
 * 7. Copia quell'URL e incollalo nella costante HIGHSCORE_API dentro game.js
 */

const MAX_SCORES = 6;
const KEY = "top6";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method === "GET") {
      const data = await env.HIGHSCORES.get(KEY);
      return new Response(data || "[]", {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "JSON non valido" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const initials = String(body.initials || "")
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .padEnd(3, "A")
        .slice(0, 3);

      // Un minimo di validazione: punteggio intero, in un range plausibile.
      // Non impedisce del tutto la manomissione (un sito statico senza login
      // non può farlo), ma scoraggia gli abusi casuali.
      let score = parseInt(body.score, 10);
      if (!Number.isFinite(score) || score < 0) score = 0;
      score = Math.min(score, 999999);

      let list = [];
      try {
        list = JSON.parse((await env.HIGHSCORES.get(KEY)) || "[]");
        if (!Array.isArray(list)) list = [];
      } catch (e) {
        list = [];
      }

      list.push({ initials, score });
      list.sort((a, b) => b.score - a.score);
      list = list.slice(0, MAX_SCORES);

      await env.HIGHSCORES.put(KEY, JSON.stringify(list));

      return new Response(JSON.stringify(list), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response("Metodo non consentito", {
      status: 405,
      headers: cors,
    });
  },
};
