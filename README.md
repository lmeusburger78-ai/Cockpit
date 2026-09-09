# Cockpit · Portfolio Dashboard

Ein persönliches Aktien-Cockpit als eigenständige Web-App – **ohne Build, ohne Server**.
Einfach `index.html` im Browser öffnen.

![Portfolio](https://img.shields.io/badge/pages-3-6366f1) ![Vanilla JS](https://img.shields.io/badge/stack-HTML%20%2F%20CSS%20%2F%20JS-22d3ee)

## Funktionen

### 1 · Portfolio
- **Kennzahlen:** Gesamtwert, Gewinn/Verlust (absolut & %), Tagesveränderung, Anzahl Positionen
- **Kreisdiagramm (Allokation):** umschaltbar zwischen *nach Position* und *nach Branche*, mit Legende und Prozentanteilen
- **Entwicklung im Zeitraum:** Linienchart der Portfolio-Entwicklung, indexiert auf 100, mit
  wählbarem Zeitraum (1M / 3M / 6M / 1J) und optionalem **Benchmark-Vergleich** (Weltindex)
- **Positionen-Tabelle:** Anteil, Stück, Ø Kaufkurs, aktueller Kurs, Wert, Tages- und Gesamt-G/V –
  Positionen anlegen, bearbeiten und löschen

### 2 · Watchlist
- Selbst gewählte Aktien beobachten (Kurs, Tagesveränderung, Tagesbereich-Balken)
- Titel hinzufügen/entfernen, Filter nach Branche, Direkt-Übernahme ins Portfolio

### 3 · News & Zahlen
- **Branche auswählen** → Nachrichten der Titel dieser Branche
- **Klickbare Headlines** (mit Aktien-Kürzel) führen direkt zum Artikel
- **Quartalszahlen** je Titel: EPS Ist vs. Erwartung, Überraschung in %, Umsatz
- Umschaltbar zwischen *ganzer Branche* und *nur meinen Titeln*
- Kuratierte **Nachrichten-Quellen** (Google News, Yahoo Finance, finanzen.net,
  Handelsblatt, Reuters, Bloomberg, MarketWatch, CNBC, Seeking Alpha, Finviz)

### 4 · Aktien-Detailansicht
Klick auf ein Kürzel (in Portfolio, Watchlist oder News) öffnet die Detailansicht mit:
- **Kurs-Chart** mit Zeitraum-Umschaltung (1M/3M/6M/1J)
- **Buy/Hold/Sell-Rating** (Analysten-Konsens + Verteilung)
- **Kennzahlen:** KGV, 52-Wochen-Hoch/Tief inkl. Positionsanzeige, Beta, Marktkapitalisierung, EPS
- **Nächster Quartalstermin** und **Dividende** (Rendite, Betrag, Ex-Tag)
- **Letzte Quartalszahlen** (4 Quartale) und **Jahreszahlen** (3 Jahre)
- **Aktuelle Nachrichten** + Direktlinks zu den wichtigsten Quellen je Aktie

### Weiteres
- 💱 Anzeigewährung schnell umschaltbar (EUR / CHF / USD) über die Kopfzeile
  (reine Anzeige­währung – keine Kurs-Umrechnung)
- 🌗 Hell-/Dunkel-Modus
- 💾 Portfolio, Watchlist & Einstellungen werden lokal im Browser gespeichert (`localStorage`)
- 📊 Charts via Chart.js (lokal mitgeliefert, läuft komplett offline)

## Nutzung

```
# einfach im Browser öffnen
open index.html         # macOS
xdg-open index.html     # Linux
# oder Datei per Doppelklick öffnen
```

Beim ersten Start ist ein Beispiel-Portfolio hinterlegt, das du frei anpassen kannst.

## Datenquellen

Standardmäßig laufen realistische **Demo-Daten** (reproduzierbar, offline).
Für **Live-Daten** in den *Einstellungen* auf **Finnhub** umstellen und einen kostenlosen
API-Key von [finnhub.io](https://finnhub.io/register) eintragen:

- Live: aktuelle Kurse, Firmen-News und Quartalszahlen
- Der Key wird ausschließlich lokal im Browser gespeichert und direkt an Finnhub gesendet
- Fällt bei Fehlern/Limit automatisch auf Demo-Daten zurück

> Hinweis: Historische Kursverläufe sind im kostenlosen Finnhub-Tarif eingeschränkt; die
> Zeitreihe wird daher an den aktuellen Live-Kurs skaliert dargestellt.

## Projektstruktur

```
index.html            App-Grundgerüst (Sidebar, Topbar, Seiten, Modal)
css/styles.css        Design-System (Dark/Light), Layout, Komponenten
js/
  util.js             Formatierung, DOM-Helfer, Farben, seeded RNG
  data.js             Aktien-Universum, Demo-Daten, Finnhub-Provider
  state.js            Persistenz (localStorage): Portfolio, Watchlist, Settings
  charts.js           Chart.js-Fabriken (Kreis-, Linien-, Balkendiagramm)
  portfolio.js        Seite „Portfolio"
  watchlist.js        Seite „Watchlist"
  news.js             Seite „News & Zahlen"
  detail.js           Aktien-Detailansicht (Modal)
  app.js              Router, Navigation, Theme, Einstellungen
  vendor/chart.umd.js Chart.js 4.4.1 (lokal, MIT-Lizenz)
```

## Anpassen

- **Weitere Aktien:** in `js/data.js` das Objekt `UNIVERSE` erweitern (Symbol, Name, Branche, Basispreis)
- **Branchen:** Liste `SECTORS` in `js/data.js`
- **Farben/Design:** CSS-Variablen am Anfang von `css/styles.css`
