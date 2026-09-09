# Deutung durch Claude — optional

Das Cockpit rechnet die Zusammenhänge im Reiter **Analyse** selbst: Regentage,
Wochenende, Temperatur, Wochentage, Wetterempfindlichkeit je Standort. Dafür
braucht es weder Netz noch Schlüssel noch diesen Dienst.

Was hier dazukommt, ist die **Deutung in Worten** — „was fällt auf, was könnte
dahinterstecken, was wäre zu tun". Das kann Statistik nicht.

## Warum ein eigener Dienst?

Der API-Schlüssel darf **nicht** in die HTML-Datei. Alles, was im Browser liegt,
kann jeder Besucher im Quelltext lesen — der Schlüssel wäre sofort abgreifbar und
auf deine Rechnung nutzbar. Deshalb hält ihn dieser kleine Server, und die Seite
spricht nur mit ihm.

Damit ist die Einzeldatei-Eigenschaft **für dieses eine Feature** weg. Der Rest
des Cockpits bleibt, wie er ist.

## Wichtig zur Abrechnung

Ein **Claude.ai-Abo (Pro/Max) deckt die API nicht ab.** Das Abo gilt für claude.ai
und Claude Code. Ein eigenes Programm, das die Anthropic-API aufruft, braucht einen
separaten API-Zugang mit eigenem Guthaben, abgerechnet pro Token.

Für diesen Anwendungsfall ist das wenig: Es werden nur die fertigen Befunde
geschickt (rund tausend Token), nicht die 131.710 Rohzeilen. Claude Opus 5 kostet
5 $ je Million Eingabe-Token und 25 $ je Million Ausgabe-Token. Mit ein paar
hundert bis tausend Ausgabe-Token — das Denken zählt dabei als Ausgabe — landet
eine Deutung bei **etwa zwei bis fünf Cent**.

Wer das drücken will: `thinking` weglassen oder `output_config: { effort: "low" }`
setzen. Für eine Deutung von vier Absätzen reicht das meist.

## Starten

```bash
cd app/agent
npm install
ANTHROPIC_API_KEY=sk-ant-... node server.mjs
```

Dann in `app/src/app.js` (Abschnitt 8b) eintragen und neu bauen:

```js
var AGENT_URL = "http://localhost:8787";
```

```bash
node app/build.js
```

Im Reiter **Analyse** erscheint jetzt der Knopf „Deutung von Claude holen".

## Was gesendet wird

Nur die aggregierten Befunde, die im Cockpit ohnehin sichtbar sind — Ausschnitt,
Zeitraum, Kennwerte je Thema. Keine Rohdaten, keine Namen, keine Belegzeilen:

```json
{
  "scope": "Unternehmen gesamt",
  "zeitraum": "01.05.2026 bis 31.07.2026",
  "tage": 92,
  "befunde": [
    { "thema": "REGEN", "kennwert": "−4,7 %", "basis": "51 Regentage (ab 1 mm) · 41 trockene Tage",
      "zahlen": { "regentag": 1802, "trocken": 1892, "delta_pct": -4.7 } }
  ]
}
```

Mit echten Geschäftszahlen ist das trotzdem eine Weitergabe an einen externen
Dienst — vor dem Echtbetrieb also intern klären (Auftragsverarbeitung, Region).
Die Beispieldaten hier sind erfunden.

## Wie verhindert wird, dass Claude Zahlen erfindet

Das Muster ist bewusst getrennt: **Die App rechnet, Claude formuliert.** Claude
bekommt die Zahlen fertig geliefert und ist per System-Prompt darauf festgelegt,
nur diese zu verwenden. Befunde, die das Cockpit selbst als „rechnerisch
gekoppelt" oder „nicht belastbar" markiert (etwa Wartezeit ↔ Zufriedenheit in den
Beispieldaten), sind so gekennzeichnet, damit daraus keine Scheinerkenntnis wird.

## Betrieb

- `PORT` (Standard 8787) und `CORS_ORIGIN` (Standard `*`) sind über Umgebungs-
  variablen einstellbar. Im Betrieb `CORS_ORIGIN` auf die eigene Domain setzen.
- Der Dienst hat keine Authentifizierung. Er gehört hinter ein internes Netz oder
  einen Reverse-Proxy mit Zugangsschutz — sonst kann jeder auf deine Rechnung
  Anfragen stellen.
