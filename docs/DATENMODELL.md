# Datenmodell – erklärt am Beispiel „Limonadenstände“

Dieses Dokument beantwortet zwei Fragen:

1. Was bedeutet „jeder Upload wird in ein einheitliches Kennzahlen-Modell
   überführt und in DuckDB gespeichert“?
2. Warum ist das für Verdichtung, Drill-Down und Rollen der entscheidende Schritt?

Als Beispiel dient `examples/limonadenstaende.xlsx` (fiktive Verkaufszahlen,
Mai bis Juli 2026, vier Stände, 26.324 Bons, 90 Ausgabenbuchungen).

---

## 1. Was die Excel heute macht

Die Datei enthält **zwei Arten von Blättern**:

| Art | Blätter | Inhalt |
|-----|---------|--------|
| **Rohdaten** | `Bonierungen`, `Ausgaben` | Eine Zeile je Bon bzw. je Buchung. Das sind die eigentlichen Daten. |
| **Auswertungen** | `Dashboard`, `Monatsvergleich`, `Produkt-Mix`, `Management (GuV)`, `Service & Qualität`, `Tagesprofil` | Reine Formeln (`SUMIFS`, `AVERAGEIFS`, `COUNTIFS`) über die Rohdaten. |

Jede Auswertung ist eine **feste Sicht**: Monatsvergleich = Umsatz je Standort
und Monat. Produkt-Mix = Becher je Produkt und Größe. Wer eine neue Frage hat
(„Umsatz je Produkt am Bahnhof im Juni?“), braucht ein neues Blatt mit neuen
Formeln. Und wer andere Adressaten mit anderen Zahlen versorgen will, braucht
weitere Kopien der Datei.

## 2. Das einheitliche Modell: eine Zeile je Messung

Statt viele feste Sichten zu pflegen, bringt das Cockpit **alle Rohdaten in
eine einzige Form** – die Fakt-Tabelle. Jede Zeile beantwortet fünf Fragen:
*Wann? Welche Kennzahl? Welcher Wert? Wo in der Hierarchie? Woher?*

So wird aus **einer** Bonierungs-Zeile der Excel …

| BonNr | Datum | Standort | Produkt | Größe | Menge | Betrag (€) | Wartezeit (Min.) | Zufriedenheit |
|------:|-------|----------|---------|-------|------:|-----------:|-----------------:|--------------:|
| 2 | 01.05.2026 | Bahnhof | Orangensaft | groß 0,4 l | 1 | 6,90 | 4,0 | 4,3 |

… ein Bündel von **fünf Fakten** (eine je Kennzahl):

| datum | kennzahl_id | wert | ebene_1 | ebene_2 | ebene_3 | ebene_4 | quelle | quelle_zeile |
|-------|-------------|-----:|---------|---------|---------|---------|--------|--------------|
| 2026-05-01 | umsatz_eur | 6,90 | Limonadenstände | Bahnhof | Orangensaft | groß 0,4 l | limonadenstaende.xlsx | Bonierungen:2 |
| 2026-05-01 | becher | 1 | Limonadenstände | Bahnhof | Orangensaft | groß 0,4 l | limonadenstaende.xlsx | Bonierungen:2 |
| 2026-05-01 | transaktionen | 1 | Limonadenstände | Bahnhof | Orangensaft | groß 0,4 l | limonadenstaende.xlsx | Bonierungen:2 |
| 2026-05-01 | wartezeit_min | 4,0 | Limonadenstände | Bahnhof | Orangensaft | groß 0,4 l | limonadenstaende.xlsx | Bonierungen:2 |
| 2026-05-01 | zufriedenheit | 4,3 | Limonadenstände | Bahnhof | Orangensaft | groß 0,4 l | limonadenstaende.xlsx | Bonierungen:2 |

Und aus **einer** Ausgaben-Zeile …

| BuchNr | Monat | Kostenstelle | Kategorie | Betrag (€) |
|-------:|-------|--------------|-----------|-----------:|
| 7 | Mai | Bahnhof | Personal | 4.605,30 |

… wird **ein** Fakt in genau derselben Form:

| datum | kennzahl_id | wert | ebene_1 | ebene_2 | ebene_3 | ebene_4 | quelle | quelle_zeile |
|-------|-------------|-----:|---------|---------|---------|---------|--------|--------------|
| 2026-05-01 | kosten_eur | 4.605,30 | Limonadenstände | Bahnhof | Personal | – | limonadenstaende.xlsx | Ausgaben:7 |

**Das ist der Kern:** Umsatz und Kosten kommen aus verschiedenen Blättern mit
verschiedenen Spalten, liegen jetzt aber in derselben Tabelle und treffen sich
auf `ebene_2 = Bahnhof`. Deshalb kann das Cockpit ein Ergebnis je Standort
rechnen, ohne dass irgendwo eine Formel dafür geschrieben wurde. Ein späterer
Aktienkurs wäre einfach eine weitere Zeile: `kennzahl_id = aktie_schluss`,
`ebene_2 = Ticker`, `quelle = kurs-api`.

Wie eine Excel in dieses Modell übersetzt wird, steht **nicht im Code**, sondern
in einem Mapping-Profil: `config/mappings/limonadenstaende.yaml`. Dort steht
„Spalte `Betrag (€)` im Blatt `Bonierungen` ist die Kennzahl `umsatz_eur`,
Spalte `Standort` ist Ebene 2“. Ein neues Excel-Format bedeutet ein neues
Profil, kein neues Programm.

Aus der Beispiel-Datei entstehen so 131.710 Fakten. Das ist viel mehr als die
26.414 Zeilen der Excel – und genau richtig so: Jede einzelne Zahl ist jetzt
adressierbar, verdichtbar und bis zur Excel-Zeile rückverfolgbar
(`quelle_zeile`).

## 3. Warum DuckDB

DuckDB ist eine **eingebettete Analyse-Datenbank**: eine einzige Datei
(`data/cockpit.duckdb`), kein Server, keine Installation, aber vollwertiges SQL
und für Gruppierungen über Millionen Zeilen in Millisekunden gebaut. Genau das
ist Verdichtung: „Summe Umsatz gruppiert nach Standort und Monat“.

Was der Speicher leistet:

* **Ein Upload ersetzt sich selbst.** Wird `limonadenstaende.xlsx` erneut
  hochgeladen, werden zuerst alle Fakten dieser Quelle gelöscht, dann die neuen
  geschrieben. Keine Doppelzählung, kein manuelles Aufräumen.
* **Mehrere Uploads leben nebeneinander.** Die Verkaufszahlen, eine zweite
  Datei mit Kundenbefragungen und der Aktien-Feed liegen in derselben Tabelle
  und werden gemeinsam ausgewertet.
* **Excel bleibt das Werkzeug der Fachbereiche.** Niemand muss eine Datenbank
  bedienen. Die Datei ist nur die Ablage hinter dem Cockpit.

Alternative wäre SQLite (vertrauter, aber langsamer bei Auswertungen) oder
PostgreSQL (Server nötig – erst sinnvoll bei vielen gleichzeitigen Nutzern).

## 4. Verdichtung: die Regel steht an der Kennzahl

`config/kpis.yaml` legt je Kennzahl **einmal** fest, wie sie nach oben
verdichtet wird. Das Beispiel zeigt, warum das nötig ist:

| Kennzahl | Regel | Warum |
|----------|-------|-------|
| Umsatz, Kosten, Becher, Transaktionen | `sum` | Summen addieren sich über Stände und Monate. |
| Ø Wartezeit, Ø Zufriedenheit | `weighted_mean`, gewichtet nach Transaktionen | Ein Stand mit 5.000 Bons muss stärker zählen als einer mit 500. Ein einfacher Mittelwert der Standort-Mittelwerte wäre falsch. |
| Ø Bonwert | `berechnet: umsatz_eur / transaktionen` | Ein Quotient wird auf **jeder Ebene neu gerechnet**, nie gemittelt. |
| Ergebnis | `berechnet: umsatz_eur - kosten_eur`, nur bis Ebene 2 | Kosten sind nur je Standort bekannt. Auf Produkt-Ebene gäbe es kein ehrliches Ergebnis, deshalb wird dort keines gezeigt. |
| Umsatzrendite | `berechnet: ergebnis_eur / umsatz_eur * 100`, nur bis Ebene 2 | Wie Bonwert: neu rechnen statt mitteln. |

Ein konkreter Fund in der Beispiel-Excel: Das `Dashboard` bildet für
„Gesamt/Ø“ der Umsatzrendite den **Durchschnitt der drei Monatsrenditen**
(2,83 %). Die `Management (GuV)` rechnet richtig **Gesamtgewinn durch
Gesamtumsatz** (3,30 %). Zwei Blätter, zwei verschiedene Zahlen für dieselbe
Kennzahl. Im Modell gibt es diese Diskrepanz nicht, weil die Regel nur einmal
existiert. Die Tests in `tests/test_aggregate.py` prüfen jeden verdichteten
Wert gegen die Formelwerte der Excel.

## 5. Drill-Down und Rollen sind Filter, keine Programmierung

Weil alle Fakten die Spalten `ebene_1` bis `ebene_4` tragen, ist jede Sicht
eine Gruppierung bis zu einer Ebene plus ein Filter:

```
Geschäftsführung   Einstieg Ebene 1:  Limonadenstände         169.482 € Umsatz, 5.592 € Ergebnis
   Klick           Ebene 2:           Bahnhof · Hauptplatz · Stadtpark · Wochenmarkt · Zentrale
   Klick           Ebene 3:           -> abgelehnt, Rolle darf nur bis Ebene 2

Standleitung       Einstieg Ebene 2:  Bahnhof (Filter ebene_2 = Bahnhof, sonst nichts sichtbar)
   Klick           Ebene 3:           Orangensaft · Apfelsaft · ... · Personal · Miete · ...
   Klick           Ebene 4:           Orangensaft groß 0,4 l · klein 0,2 l
   Klick           Einzelfakten:      Bonierungen:2, Bonierungen:15, ... (die Excel-Zeilen)
```

Die Rolle steht in `config/rollen.yaml`: Einstiegsebene, maximale Tiefe,
Filter, sichtbare Kennzahlen. Der Filter wird **vor** der Verdichtung
angewendet, nicht erst in der Anzeige – die Standleitung Bahnhof bekommt die
Zahlen der anderen Stände gar nicht erst geliefert.

## 6. Ausprobieren

```bash
pip install -r requirements.txt
python scripts/demo_drilldown.py          # Import, Prüfbericht, DuckDB, Drill-Down
python -m pytest                          # 14 Tests gegen die Excel-Formelwerte
```
