# Limonaden GmbH · Prozesscockpit — Redesign

Die bestehende Cockpit-App im Design aus dem Claude-Design-Handoff
(`project/Limonaden Cockpit Redesign.dc.html`). Gleiche Daten, gleiche Rechenlogik,
neue Oberfläche — plus den neuen Reiter **Dokumente**.

**Ergebnis: [`limonaden-cockpit.html`](limonaden-cockpit.html)** — eine Datei,
im Browser öffnen, kein Server, kein Build nötig, funktioniert offline.

---

## Was drin ist

| Screen | Rolle | Inhalt |
| --- | --- | --- |
| Deckfolie | alle | Idyllische, animierte Szene (Limonadenstand, ziehende Wolken, treibende Zitronenscheiben); nach dem Klick auf „Cockpit öffnen“ blendet sie weich aus (900 ms, opacity + scale + blur) |
| Übersicht | alle | KPI-Hero mit Δ-Pille, KPI-Leiste mit Ampelpunkten, Wetter-Streifen, Aufteilung als **Balken oder Kreis**, Ergebnisrechnung (Wasserfall), Produkte, Tagesverlauf, Detail-Tabelle |
| Drill-down | GF bis Standort, Standleitung/Controlling bis Größe | Klick auf Balken, Kreissegment, Legendenzeile oder Baum-Zeile; Breadcrumb-Chips in der Entitätsfarbe |
| Controlling | Controlling | zusätzlich Ebenen-Baum links (Unternehmen → Standort → Produkt → Größe), farbkonsistent |
| Dokumente | Standleitung, sowie GF/Controlling sobald sie auf einem Standort stehen | Getränkerezepte (je Getränk aufklappbar: Zutaten nach Größe, Zubereitungsschritte, Zeit, Allergene, Tipp), Preise mit Happy Hour, Standort-Info (Öffnungszeiten, Dresscode, Hygiene, Notfall), Schicht-Checklisten |
| Analyse | alle | Zusammenhänge, die die Seite selbst rechnet: Regentage, Wochenende, Temperatur (Korrelation + Streudiagramm), Wochentage, Wetterempfindlichkeit je Standort, Temperaturfenster · optional eine Deutung in Worten von Claude |
| Vergleich | alle | Baukasten: Kennzahl · Aufschlüsseln · X-Achse · Stapeln · Mehrfachauswahl je Dimension · beliebig viele Zeiträume · Wetter je Zeitraum · Δ-Tabelle |
| Einstellungen | alle | Drawer von rechts: Ampel-Schwellen als Zahlenfelder, Ampel-Farben, Excel-Upload |

Hell und Dunkel über ☾/☀ oben rechts, „Abmelden“ führt zurück auf die Startseite,
voll responsiv bis 320 px.

### Wo finde ich die Arbeitsanweisungen eines Standes?

Der Reiter **Dokumente** erscheint, sobald ein Standort feststeht — auf zwei Wegen:

1. In der Command-Bar oben `role:` auf **standleitung** stellen. Daneben taucht
   `stand:` auf, dort den Stand wählen. Der Reiter **Dokumente** ist sofort da.
2. Als Geschäftsführung oder Controlling im Kreis oder Balken auf einen Standort
   klicken (Drill-down). Sobald der Breadcrumb den Standort zeigt, erscheint der
   Reiter und zeigt die Unterlagen genau dieses Standes.

Ohne Standort-Bezug ist der Reiter ausgeblendet — Rezepte und Checklisten gehören
zu einem Stand, nicht zum Gesamtunternehmen.

### Neu gegenüber der alten App

- **Dokumente-Reiter** auf Standebene. Die Checklisten sind echt: Häkchen werden je
  Stand, Schicht (Beginn/Ende) und Tag im Browser gespeichert (`localStorage`), mit
  Fortschrittsbalken, Zurücksetzen und „Als erledigt melden“ (erst aktiv, wenn alles
  abgehakt ist). Rezepte, Preise und Standort-Infos je Stand.
- **Rollentausch sichtbar** — als Auswahl direkt in der Command-Bar statt versteckt
  in der Seitenleiste (Pain-Point aus dem Chat).
- **Anmeldemaske mit Benutzername und Kennwort.** Geprüft wird nur, dass beide
  Felder ausgefüllt sind — jedes Kennwort wird akzeptiert, der Hinweis unter dem
  Knopf sagt das auch. Der Benutzername landet oben rechts in der Command-Bar.
  Eine echte Zugangskontrolle braucht ein Backend: in einer Datei, die im Browser
  liegt, lässt sich kein Geheimnis prüfen.
- **Wetter integriert** statt als großes Extra-Panel: kompakter Streifen mit
  Ø Temperatur, Niederschlag und Regentagen; im Tagesverlauf sind Regentage als
  gedämpfte Balken markiert, die Temperatur läuft als Linie darüber.
- **Vergleichs-Screen entzerrt**: eine Toolbar mit Chips statt Checkbox-Blöcken.
- **Mobile funktioniert**: KPIs 2×2, Diagramme scrollen horizontal statt zu brechen.
- **Ampel-Schwellen als Zahlenfelder** (kein Schieber), Ampel-Farben fest in der
  Signal-Palette und bewusst von den Standortfarben getrennt.
- **Keine Chart-Bibliothek mehr.** Alle Diagramme sind natives SVG im
  Design-Stil. Plotly (~3,5 MB vom CDN) ist raus — die Seite läuft offline.
- **Eine Balken-Darstellung auf allen Ebenen**: liegende Balken mit Werteachse,
  Gitternetz und Achsentitel — für Standorte, Produkte, Größen und Kostenarten
  gleich. Verträgt negative Werte (Gewinn) und ist klickbar für den Drill-down.
- **Ergebnisrechnung als liegender Wasserfall**: eine Zeile je Position mit
  Betrag und Anteil am Umsatz. Senkrecht mussten bei einem Dutzend Kostenarten
  die Namen gedreht werden und die kleinen Posten wurden zu Strichen.
- Einstellungen (Theme, Rolle, Ampel-Schwellen und -Farben, Checklisten) überleben
  einen Reload.

---

## Analyse — was da gerechnet wird

Alles im Reiter **Analyse** rechnet die Seite selbst: Mittelwertvergleiche und
Pearson-Korrelationen über die Tagesreihe des aktuellen Ausschnitts. Kein Netz,
kein Schlüssel, bei gleichen Daten immer dasselbe Ergebnis.

Zwei Festlegungen, die das Ergebnis prägen:

- **Regentag = ab 1 mm.** „Niederschlag > 0" wäre über vier gemittelte Märkte an
  82 von 92 Tagen wahr, weil irgendwo immer ein Tropfen fällt — der Vergleich
  gegen 10 trockene Tage wäre wertlos. Mit 1 mm und der Regel „mindestens die
  Hälfte der Märkte meldet Regen" ergibt sich ein tragfähiges 51:41.
- **Fast perfekte Korrelationen werden entschärft.** Liegt |r| über 0,98, sind die
  beiden Größen rechnerisch aneinander gekoppelt statt unabhängig gemessen. Die
  Karte sagt das dann offen, statt eine Erkenntnis vorzutäuschen. Genau das ist
  bei Wartezeit ↔ Zufriedenheit der Fall: In den Beispieldaten ist die
  Zufriedenheit direkt aus der Wartezeit berechnet (r = −1,00).

Die Karten nennen immer ihre Basis (Anzahl Tage je Gruppe). Es sind beschreibende
Auswertungen, keine Ursachennachweise — die Kopfzeile sagt das auch.

### Deutung durch Claude (optional)

Ein Knopf „Deutung von Claude holen" erscheint, sobald `AGENT_URL` in `app.js`
gesetzt ist. Dahinter steht der kleine Dienst in **[`agent/`](agent/README.md)**,
der den API-Schlüssel hält — in der HTML-Datei wäre er für jeden Besucher lesbar.

Das Muster ist bewusst getrennt: **die App rechnet, Claude formuliert.** Gesendet
werden nur die fertigen Befunde, nie die Rohdaten. Ohne diesen Dienst funktioniert
der Analyse-Reiter vollständig, nur eben ohne Fließtext.

Hinweis zur Abrechnung: Ein Claude.ai-Abo deckt die API **nicht** ab — dafür
braucht es einen eigenen API-Zugang. Details in `agent/README.md`.

---

## Bearbeiten

Die Auslieferungsdatei ist generiert. Geändert wird in `src/`:

```
app/
├── limonaden-cockpit.html   ← Ergebnis (generiert, nicht von Hand ändern)
├── build.js                 ← baut src/ zu einer Datei zusammen
├── smoke.js                 ← Klick-Rundgang durch alle Screens
├── agent/                   ← optionaler Deutungs-Dienst (hält den API-Schlüssel)
└── src/
    ├── cockpit.html         Grundgerüst: Deckfolie, Command-Bar, Drawer, Hilfe
    ├── style.css            Design-Tokens und alle Styles
    ├── data.js              Beispieldaten (unverändert aus der alten App)
    └── app.js               Rechenkern, Diagramme, Rendering
```

```bash
node app/build.js     # baut app/limonaden-cockpit.html
node app/build.js --artifact   # zusätzlich die Fassung zum Veröffentlichen
node app/smoke.js     # 45 Schritte durch alle Screens, bricht bei Konsolenfehlern ab
node app/smoke.js --shots   # dazu Screenshots nach app/shots/
```

**Zwei Fassungen, eine Quelle.** `limonaden-cockpit.html` ist das vollständige
Dokument zum lokalen Öffnen. `limonaden-cockpit.artifact.html` ist dieselbe Seite
ohne eigenes `<html>`/`<head>`/`<body>` — dieses Gerüst setzt der Artifact-Dienst
beim Veröffentlichen selbst. Titel, Schrift-Link und Styles stehen dort oben im
Inhalt, und der Titel ist auf „Limonaden Cockpit" gekürzt, weil die Seite in der
Galerie neben vielen anderen steht.

`smoke.js` braucht `playwright` (`npm i -D playwright`) und nutzt das im Image
vorinstallierte Chromium.

### `app.js` in Abschnitten

1. Konstanten · 2. Helfer · 3. Farben · 4. Rechenkern · 4b. Statistik · 5. SVG-Diagramme ·
6. Command-Bar · 7. Übersicht · 8. Dokumente · 8b. Analyse · 9. Vergleich · 10. Einstellungen ·
11. Excel-Import · 12. Rendering & Events · 13. Deckfolie/Login · 14. Init

Der Rechenkern (Abschnitt 4: `metrics`, `computeNode`, `detailRows`, `cmpPivot`,
Kostenverteilung über Monatsanteile) ist bewusst aus der alten App übernommen —
gleiche Zahlen wie vorher.

---

## Design-Tokens

Alles als CSS-Variablen in `src/style.css`, Hell auf `:root`, Dunkel unter
`html[data-theme="dark"]`.

| | Hell | Dunkel |
| --- | --- | --- |
| Grund / Command-Bar | `#f7f4ec` / `#f0eadb` | `#161311` / `#0e0c0a` |
| Karte | `#ffffff` | `#231f1b` |
| Text / gedämpft | `#1a1815` / `#8b7a5e` | `#f5f0e2` / `#a3957d` |
| Linie | `#e5dfd0` | `#3b342c` |
| Akzent | `#2f6fbf` | `#f5c518` |

**Entitätsfarben** liegen global fest (Rang nach Gesamtumsatz), damit eine Entität
in jedem Diagramm dieselbe Farbe behält:

- Standorte — Hauptplatz `#2f6fbf` (dunkel `#4a8fd6`) · Bahnhof `#e26a3d` ·
  Wochenmarkt `#3aa06c` (dunkel `#4bb883`) · Stadtpark `#e8b93a`
- Produkte / Größen — Schiefer `#334155 → #cbd5e1`; dunkel helle Schiefer-Blautöne
  `#dfe6ef → #63738a` (die alte dunkle Reihe lief bis `#3f3e39` und war unsichtbar)
- Kostenarten — eigene Palette, die den vier Standortfarben ausweicht
- Wetter — Temperatur `#d1495b`, Niederschlag `#4a86b8`
- Ampel — Grün `#22c55e` · Gelb `#eab308` · Rot `#dc2626` (gesättigter als alles andere)

Schrift: **nur IBM Plex Sans** (400/500/600/700), Zahlen mit `tabular-nums`.
Fällt auf `system-ui` zurück, wenn Google Fonts nicht erreichbar ist.

---

## Ampel-Schwellen

Je Kennzahl zwei Werte: `redT` und `yellowT`. Die Richtung steht in den Daten.

- *größer ist besser* (Marge, Zufriedenheit, Ergebnis): rot unter `redT`,
  gelb unter `yellowT`, sonst grün.
- *kleiner ist besser* (Wartezeit, im Drawer mit ▲ markiert): rot über `redT`,
  gelb über `yellowT`, sonst grün.

Änderungen wirken sofort und werden gespeichert.

---

## Excel-Upload

Wie vorher clientseitig: Blätter „Bonierungen“ und „Ausgaben“, die Datei verlässt
den Browser nicht. `xlsx` wird beim ersten Upload vom CDN nachgeladen — dafür
braucht es einmalig Netz. Ohne Netz bleiben die eingebauten Beispieldaten.
Datei per Klick wählen oder in die Fläche ziehen.

---

## Echtes Video auf der Deckfolie

Standardmäßig läuft die animierte SVG-Szene — ohne Netz, ohne zusätzliche Datei.
Für ein echtes Video: `.mp4` neben die HTML legen und in `src/app.js` (Abschnitt 13)

```js
var VIDEO_SRC = "idyllic-limonadenstand.mp4";
```

setzen, dann `node app/build.js`. Das Video ersetzt die Szene erst, wenn es
abspielbar ist; schlägt das Laden fehl, bleibt die Szene stehen.

---

## Abweichungen vom Design-Handoff

Bewusst und begründet:

- **Wartezeit je Stunde** (Artboard 2a) gibt es nicht — die Daten sind Tageswerte,
  keine Stundenwerte. Statt erfundener Stunden zeigt der Tagesverlauf echte
  Tageswerte. Für echte Stundenwerte müsste die Excel Uhrzeiten liefern.
- **Team / Schichtplan** (Namen, Zeiten, Sterne) sind Stammdaten, die nicht in den
  Daten stecken. Sie liegen als gepflegte Liste in `app.js` (`STANDINFO`) und
  erscheinen auf der Dokumente-Seite statt auf der Übersicht.
- **Reiter „Produkte“ und „Team“** (Artboard 2a2) sind nicht eigene Screens
  geworden — Produkte stehen auf der Übersicht, Team unter Dokumente. So bleiben
  es vier Reiter statt sechs.
- **Zahlen in den Artboards** sind Mockups; die App rechnet aus den echten
  Beispieldaten. Wo beides vergleichbar ist, stimmt es überein (Umsatz gesamt
  169.483 €, Standort-Anteile 30,9 / 27,3 / 23,5 / 18,4 %, Δ-Tabelle Mai↔Juli).
- **Rezepte, Preise, Öffnungszeiten, Dresscode** stammen aus dem Design und sind
  als Beispielinhalte hinterlegt — vor dem Echtbetrieb durch die echten ersetzen
  (`REZEPTE`, `PREISE`, `STANDINFO`, `CHECKLISTEN` in `app.js`). Ein Rezept in
  `REZEPTE` hat `klein` und `gross` (Zutatenlisten), `schritte` (Array),
  `zeit`, `allergene` und `tipp`.
- **Happy Hour** gilt täglich ab 18:00 Uhr, wirksam ab 01.08.2026. An Ständen mit
  früherem Ladenschluss (Bahnhof Sa bis 18:00, So bis 16:00) fällt das Fenster
  damit weg — falls dort ein Rabatt laufen soll, brauchen die Öffnungszeiten oder
  die Happy Hour eine Ausnahme.
