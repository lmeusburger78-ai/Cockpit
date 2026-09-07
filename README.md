# Cockpit

Cockpit zur Überwachung unserer Prozesse: Kennzahlen aus verschiedenen Uploads
(Excel, gebündelte Daten, Aktienkurse) werden entlang einer Hierarchie nach
oben verdichtet, je Adressat passend angezeigt und lassen sich per Drill-Down
bis auf die Einzeldaten aufschlüsseln.

**Status:** Phase 2 – die Streamlit-Oberfläche mit Plotly-Diagrammen läuft:
Rollen-Auswahl, KPI-Kacheln mit Ampeln, Drill-Down per Klick, GuV-Wasserfall,
Treemap, Kuchen-/Donutdiagramm, Trendverlauf und ein Wetter-Panel
(Temperatur + Niederschlag), alle vollständig beschriftet. Import, Datenmodell und
Verdichtung aus Phase 1 sind mit Tests hinterlegt.

## Dokumentation

* [Umsetzungsplan, Architektur und offene Fragen](docs/PLAN.md)
* [Datenmodell – erklärt am Beispiel Limonadenstände](docs/DATENMODELL.md)
* [Datenquellen – Excel wöchentlich pflegen, externe Quellen (Aktien, Wetter) anbinden](docs/DATENQUELLEN.md)

## Schnellstart

```bash
pip install -r requirements.txt
streamlit run app/app.py             # das Cockpit im Browser öffnen
python scripts/demo_drilldown.py     # Excel -> Modell -> DuckDB -> Drill-Down (Konsole)
python -m pytest                     # Tests: Verdichtung + App-Rendering je Rolle
```

## Aufbau

```
config/            Kennzahlen (kpis.yaml), Rollen (rollen.yaml), Hierarchie, Mapping-Profile
cockpit/           Python-Paket: model, ingest/excel, ingest/weather, store (DuckDB), aggregate, charts, service, theme
app/               Streamlit-Oberfläche (app.py)
examples/          Beispiel-Excel (Verkaufszahlen) + Beispiel-Wetter (wetter_wien.csv)
scripts/           Demo-Skript
tests/             pytest
data/              Laufzeitdaten (DuckDB) – nicht in Git
```
