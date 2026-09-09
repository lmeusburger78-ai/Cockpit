#!/usr/bin/env node
/* ==========================================================================
   Deutungs-Dienst für das Prozesscockpit.

   Warum es diesen Dienst überhaupt gibt: Der API-Schlüssel darf nicht in die
   HTML-Datei. Alles, was im Browser liegt, kann jeder Besucher auslesen — der
   Schlüssel wäre sofort abgreifbar und auf deine Rechnung nutzbar. Also hält
   ihn dieser kleine Server, und die Seite spricht nur mit ihm.

   Das Cockpit rechnet die Zahlen selbst und schickt nur die fertigen Befunde
   her. Claude formuliert die Deutung, erfindet aber keine Zahlen.

   Start:  ANTHROPIC_API_KEY=sk-ant-... node app/agent/server.mjs
   ========================================================================== */

import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";

const PORT = Number(process.env.PORT || 8787);
/* Für die Entwicklung offen. Im Betrieb auf die eigene Domain setzen. */
const ORIGIN = process.env.CORS_ORIGIN || "*";

const client = new Anthropic();

const SYSTEM = `Du bist Analyst für die Limonaden GmbH, ein Unternehmen mit mehreren
Limonadenständen. Du bekommst fertig gerechnete Befunde aus dem Prozesscockpit.

Regeln:
- Verwende ausschließlich die übergebenen Zahlen. Rechne nichts dazu und erfinde nichts.
- Ist ein Befund als "rechnerisch gekoppelt" oder "nicht belastbar" markiert, benenne
  das offen, statt daraus eine Erkenntnis zu machen.
- Korrelation ist keine Ursache. Formuliere Vermutungen als Vermutungen.
- Antworte auf Deutsch, sachlich, ohne Werbesprache und ohne Aufzählungszeichen.
- Höchstens vier kurze Absätze: (1) was am stärksten auffällt, (2) was dahinterstecken
  könnte, (3) eine konkrete Maßnahme, (4) was die Daten noch nicht hergeben.`;

function send(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST") return send(res, 405, { error: "Nur POST" });

  let raw = "";
  req.on("data", (c) => {
    raw += c;
    if (raw.length > 256 * 1024) req.destroy(); // Befunde sind klein; alles andere ist Unfug
  });
  req.on("end", async () => {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: "Kein gültiges JSON" });
    }

    const frage = [
      `Ausschnitt: ${payload.scope ?? "unbekannt"}`,
      `Zeitraum: ${payload.zeitraum ?? "unbekannt"} (${payload.tage ?? "?"} Tage)`,
      "",
      "Befunde:",
      JSON.stringify(payload.befunde ?? [], null, 2),
    ].join("\n");

    try {
      const response = await client.beta.messages.create({
        model: "claude-opus-5",
        // Bewusst knapp gehalten — gefragt sind vier kurze Absätze, keine Abhandlung.
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        // Lehnt das Modell eine Anfrage ab, übernimmt automatisch ein Ersatzmodell,
        // statt dass der Aufruf ins Leere läuft.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        messages: [{ role: "user", content: frage }],
      });

      if (response.stop_reason === "refusal") {
        return send(res, 200, { text: "Claude hat die Antwort abgelehnt. Bitte den Ausschnitt ändern." });
      }
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n\n");
      send(res, 200, { text, model: response.model, usage: response.usage });
    } catch (err) {
      // Von der spezifischsten zur allgemeinsten Ursache
      if (err instanceof Anthropic.AuthenticationError) {
        console.error("Schlüssel fehlt oder ist ungültig:", err.message);
        return send(res, 500, { error: "API-Schlüssel fehlt oder ist ungültig" });
      }
      if (err instanceof Anthropic.RateLimitError) {
        return send(res, 429, { error: "Zu viele Anfragen — bitte kurz warten" });
      }
      if (err instanceof Anthropic.APIError) {
        console.error("API-Fehler", err.status, err.message);
        return send(res, 502, { error: `API-Fehler ${err.status}` });
      }
      console.error(err);
      send(res, 500, { error: "Unerwarteter Fehler" });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Deutungs-Dienst läuft auf http://localhost:${PORT}`);
  console.log(`In app/src/app.js setzen:  var AGENT_URL = "http://localhost:${PORT}";`);
});
