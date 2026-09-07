"""Baut jede Diagrammfunktion mit echten Beispieldaten und prüft, dass eine
gültige Plotly-Figur mit vollständiger Beschriftung entsteht (Titel + Achsen)."""
from pathlib import Path

import pytest

from cockpit import charts, service

BEISPIEL = Path(__file__).resolve().parent.parent / "examples" / "limonadenstaende.xlsx"


@pytest.fixture(scope="module")
def daten():
    kpis, rollen, _ = service.konfig()
    from cockpit.config import lade_mapping
    from cockpit.ingest.excel import excel_zu_fakten
    fakten = excel_zu_fakten(BEISPIEL, lade_mapping("limonadenstaende"))
    return kpis, rollen, fakten


def test_ranking(daten):
    kpis, rollen, fakten = daten
    kinder = service.naechste_knoten(fakten, kpis, rollen["geschaeftsfuehrung"], ())
    fig = charts.ranking(kinder, "umsatz_eur", kpis["umsatz_eur"], "ebene_2", "T", "U")
    assert fig.layout.title.text.startswith("T")
    assert "€" in fig.layout.xaxis.title.text
    assert len(fig.data[0].x) == 4  # vier Standorte mit Umsatz


def test_kuchen_summe_und_labels(daten):
    kpis, rollen, fakten = daten
    kinder = service.naechste_knoten(fakten, kpis, rollen["geschaeftsfuehrung"], ())
    fig = charts.kuchen(kinder, "ebene_2", "umsatz_eur", "Umsatz gesamt", "T", "U")
    assert fig.data[0].type == "pie"
    assert sum(fig.data[0].values) == pytest.approx(169482.9, abs=1)
    assert set(fig.data[0].labels) == {"Hauptplatz", "Bahnhof", "Wochenmarkt", "Stadtpark"}


def test_guv_wasserfall(daten):
    kpis, _, fakten = daten
    d = fakten[fakten.kennzahl_id == "kosten_eur"]
    arten = {str(k): float(v) for k, v in d.groupby("ebene_3")["wert"].sum().items()}
    umsatz = float(service.verdichte(fakten, kpis, 1, {}, nach_monat=False)["umsatz_eur"].iloc[0])
    fig = charts.guv_wasserfall(umsatz, arten, "T", "U")
    assert fig.data[0].type == "waterfall"
    # Umsatz - alle Kosten = Ergebnis (letzter Wert)
    assert fig.data[0].y[0] - sum(arten.values()) == pytest.approx(fig.data[0].y[-1])


def test_trend_und_treemap(daten):
    kpis, rollen, fakten = daten
    monat = service.sicht(fakten, kpis, {"_": rollen["geschaeftsfuehrung"]}, "_", (), nach_monat=True)
    fig = charts.trend(monat, "umsatz_eur", kpis["umsatz_eur"], "ebene_1", "T", "U")
    assert fig.layout.yaxis.title.text and len(fig.data) >= 1
    kinder = service.naechste_knoten(fakten, kpis, rollen["geschaeftsfuehrung"], ())
    tm = charts.treemap(kinder, ["ebene_2"], "umsatz_eur", "T", "U")
    assert tm.data[0].type == "treemap"
