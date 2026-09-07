# Datenquellen: Excel wöchentlich pflegen und auf externe Quellen wechseln

Dieses Dokument beantwortet drei praktische Fragen:

1. Wie erweitere ich die Excel wöchentlich um aktuelle Zahlen, und wie läuft
   der Upload?
2. Wie aufwendig ist der Wechsel von Excel auf externe Quellen wie
   tagesaktuelle Aktienkurse oder Wetter?
3. Welche ähnlichen Anwendungsbeispiele gibt es?

Der rote Faden: Egal woher die Zahlen kommen, sie landen alle in **demselben
Kennzahlen-Modell** (siehe [DATENMODELL.md](DATENMODELL.md)). Eine neue Quelle
ist ein neuer *Adapter*, der Rohzahlen in Fakten übersetzt. Verdichtung,
Drill-Down und Rollen ändern sich dabei nie.

---

## 1. Excel wöchentlich erweitern und hochladen

### Der einfache Weg (heute schon möglich)

Es gibt zwei gleichwertige Vorgehensweisen:

**A – Immer die ganze Datei hochladen.** Ihr pflegt die Excel weiter wie bisher
(neue Zeilen im Blatt „Bonierungen“, neue Buchungen im Blatt „Ausgaben“) und
ladet die **komplette Datei** erneut im Cockpit hoch. Beim Import passiert
Folgendes automatisch:

1. Das Cockpit liest die Rohdaten-Blätter und erzeugt die Fakten.
2. Der **Prüfbericht** meldet fehlende Spalten, unbekannte Standorte oder
   Produkte, nicht-numerische Werte. Nur wenn er sauber ist, wird gespeichert.
3. Der Speicher **ersetzt die alten Fakten dieser Datei** durch die neuen
   (`Store.ersetze_quelle`). Es gibt keine Doppelzählung, auch wenn dieselben
   Wochen erneut enthalten sind.

Das heißt: Ihr müsst nichts löschen oder abgleichen. Datei ergänzen, hochladen,
fertig. Diese Variante ist die robusteste und für den wöchentlichen Rhythmus
völlig ausreichend.

> Der Upload liegt in der Seitenleiste des Cockpits unter „＋ Excel hochladen“.
> Datei wählen, „Importieren“, Prüfbericht lesen. Bei Grün ist der neue Stand
> sofort in allen Rollen sichtbar.

**B – Nur die neue Woche hochladen (später).** Wenn die Gesamtdatei zu groß
wird, kann pro Upload auch eine kleine Wochendatei mit denselben Spalten geladen
werden. Dafür muss der Import „anfügen statt ersetzen“ können und die neue Woche
über eine eigene Quelle-Kennung führen. Das ist ein kleiner Zusatz (halber Tag)
und lohnt sich erst bei sehr vielen Zeilen.

### Der bequeme Weg (Phase 3): OneDrive-Eingangsordner

Der wöchentliche Upload lässt sich vollständig automatisieren:

1. Ein überwachter Ordner, z. B. `Cockpit/01_Eingang`, in eurem OneDrive oder
   SharePoint.
2. Ein Job (alle 15 Minuten oder einmal täglich) holt neue Dateien per
   Microsoft-Graph-Schnittstelle, importiert sie mit demselben Prüfbericht und
   verschiebt sie nach `02_Verarbeitet` bzw. bei Fehlern nach `03_Fehler`
   (mit dem Bericht daneben).

Dann muss niemand mehr ins Cockpit einloggen, um Daten zu liefern: Die
Fachabteilung legt die aktualisierte Excel dort ab, wo sie ohnehin arbeitet.
Voraussetzung ist eine einmalige App-Registrierung durch einen
Microsoft-365-Administrator.

### Empfehlung für den Wochenrhythmus

Startet mit **Variante A** (ganze Datei, manueller Upload). Sobald das rund
läuft, automatisieren wir es über den **OneDrive-Ordner**, sodass „hochladen“
zu „Datei in den Ordner legen“ wird.

---

## 2. Wechsel von Excel auf externe Quellen – wie aufwendig?

**Kurz: gering, weil nur der Adapter neu ist.** Der Excel-Import ist selbst
schon ein Adapter (`cockpit/ingest/excel.py`, rund 80 Zeilen). Eine externe
Quelle ersetzt genau dieses eine Teil und liefert dieselbe Fakt-Tabelle. Alles
dahinter – Speicher, Verdichtung, Ampeln, Rollen, Diagramme – bleibt
unverändert.

Ein neuer Adapter besteht immer aus denselben drei Schritten:

1. **Abrufen** – Daten von der Schnittstelle holen (eine HTTP-Anfrage).
2. **Zuordnen** – jedes Feld auf `datum`, `kennzahl_id`, `wert`, die
   Hierarchie-Ebenen und `quelle` abbilden.
3. **Prüfen und speichern** – derselbe Prüfbericht, dieselbe Speicher-Funktion.

### Aufwand je Quelle (grobe Schätzung)

| Quelle | Schnittstelle | Aufwand | Kosten |
|--------|---------------|---------|--------|
| **Aktienkurse** (täglich) | yfinance (kostenlos) oder Alpha Vantage / Twelve Data (API-Schlüssel) | **0,5–1 Tag** | 0 € bzw. Lizenz |
| **Wetter** (aktuell/Vorhersage) | Open-Meteo (kostenlos, ohne Schlüssel) oder OpenWeatherMap | **0,5–1 Tag** | 0 € bzw. gering |
| **Weitere Excel-/CSV-Formate** | neues Mapping-Profil, kein Code | **1–2 Stunden** | 0 € |
| **Datenbank** (z. B. ERP/Warenwirtschaft) | SQL-Abfrage | **1–2 Tage** | 0 € |
| **REST-API eines Fremdsystems** (CRM, Ticketing) | HTTP + Feld-Mapping | **1–3 Tage** | je nach System |

Der Grund für den geringen Aufwand: Aktien- und Wetterdaten sind bereits
**Zahlen mit Zeitstempel**. Genau dafür ist das Modell gebaut. Ein Kurs wird zu
`kennzahl_id = aktie_schluss`, `ebene_2 = Ticker`, `wert = 172,35`,
`datum = heute`. Ein Wetterwert zu `kennzahl_id = temperatur_c`,
`ebene_2 = Standort`.

### Automatischer Abruf statt Upload

Externe Quellen werden nicht hochgeladen, sondern **abgeholt** – als geplanter
Job (z. B. täglich 6 Uhr per GitHub Actions oder Server-Cron). Der Ablauf ist
derselbe wie beim Excel-Import, nur dass die Daten aus dem Netz statt aus einer
Datei kommen. Für Aktienkurse gibt es zusätzlich weiterhin den manuellen
Zahlen-Upload, falls eine API lizenzrechtlich nicht genutzt werden darf.

---

## 3. Ähnliche Anwendungsbeispiele

Alles, was sich als „Zahl je Zeitpunkt je Einheit“ ausdrücken lässt, passt ohne
Änderung am Cockpit hinein. Einige Beispiele:

**Finanzen und Markt**
- Aktien-, Fonds- oder Indexkurse (eigene Aktie, Benchmark, Kundenportfolio)
- Wechselkurse, Rohstoff- und Energiepreise (Strom, Gas, Sprit)
- Zinssätze

**Wetter und Umwelt** (oft ein Frühindikator für Umsatz im Außengeschäft)
- Temperatur, Niederschlag, Sonnenstunden je Standort
- Pollen-, Luftqualitäts- oder Pegelstände

**Betrieb und Prozesse**
- Website-/Shop-Kennzahlen (Besucher, Bestellungen, Warenkorbwert)
- Support-Tickets (Anzahl, Bearbeitungszeit, Zufriedenheit)
- Produktion (Ausbringung, Ausschussquote, Stillstände)
- Lager- und Bestandsreichweite
- Projekt-Reifegrade (z. B. SPICE-Level je Prozess)

**Personal**
- Krankenstand, Auslastung, offene Stellen je Bereich

Der gemeinsame Nenner: Jede dieser Quellen liefert Zahlen mit Datum und einer
Zugehörigkeit (Standort, Titel, Bereich). Damit sind sie im selben Cockpit
verdichtbar, per Drill-Down aufschlüsselbar und je Rolle filterbar – und lassen
sich sogar **nebeneinander** auswerten. So wird sichtbar, ob der Umsatz am
Stadtpark-Stand an Regentagen einbricht: Wetter und Verkaufszahlen liegen dann
in derselben Tabelle, verknüpft über Standort und Datum.

---

## Was als Nächstes sinnvoll ist

**Wetter ist bereits eingebaut** (`cockpit/ingest/weather.py`): Temperatur und
Niederschlag werden als Kontext-Kennzahlen ins Modell geladen und im Cockpit in
einem eigenen Wetter-Panel gezeigt (Temperatur als Linie, Niederschlag als
Balken) – in der Übersicht wie im Drill-Down. Der Live-Abruf läuft über
Open-Meteo (kostenlos, ohne Schlüssel); für den Offlinebetrieb liegt eine
Beispiel-Wetterdatei bei (`examples/wetter.csv`). Jeder Markt hat sein eigenes Wetter (Koordinaten in
`config/standorte.yaml`); im Drill-Down erscheint das Wetter des jeweiligen
Standorts, in der Übersicht über die Märkte gemittelt. Wetter
taucht nie als Standort in Ranking, Kuchen oder Ergebnis auf; es dient
dem Abgleich mit Umsatz und Kundenzahl (z. B. Regentage gegen Absatz).

Ein **Aktien-Feed** ist der nächste naheliegende Schritt – dieselbe Bauweise,
sobald geklärt ist, welche Titel und ob eine API genutzt werden darf.

> Hinweis: In der Cloud-Umgebung dieser Session ist der Open-Meteo-Host durch
> die Egress-Policy gesperrt, deshalb kommen die Wetterzahlen hier aus der
> beigelegten Beispieldatei. In eurer Umgebung, wo der Host erreichbar ist,
> zieht `open_meteo_zu_fakten()` die echten Tageswerte.
