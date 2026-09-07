# Cockpit

Cockpit zur Überwachung unserer Prozesse: Kennzahlen aus verschiedenen Uploads
(Excel, gebündelte Daten, Aktienkurse) werden entlang einer Hierarchie nach
oben verdichtet, je Adressat passend angezeigt und lassen sich per Drill-Down
bis auf die Einzeldaten aufschlüsseln.

**Status:** Phase 1 (Grundgerüst) – Import, Datenmodell, Verdichtung und
Rollen-Sicht laufen als Python-Bibliothek mit Tests. Die Oberfläche (Phase 2)
folgt.

## Dokumentation

* [Umsetzungsplan, Architektur und offene Fragen](docs/PLAN.md)
* [Datenmodell – erklärt am Beispiel Limonadenstände](docs/DATENMODELL.md)

## Schnellstart

```bash
pip install -r requirements.txt
python scripts/demo_drilldown.py     # Excel -> Modell -> DuckDB -> Drill-Down je Rolle
python -m pytest                     # Tests gegen die Formelwerte der Beispiel-Excel
```

## Aufbau

```
config/            Kennzahlen (kpis.yaml), Rollen (rollen.yaml), Hierarchie, Mapping-Profile
cockpit/           Python-Paket: model, ingest/excel, store (DuckDB), aggregate
examples/          Beispiel-Excel (fiktive Verkaufszahlen der Limonadenstände)
scripts/           Demo-Skript
tests/             pytest
data/              Laufzeitdaten (DuckDB) – nicht in Git
```
