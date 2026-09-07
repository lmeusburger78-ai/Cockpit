"""Import-Tests: Das Modell muss dieselben Zahlen liefern wie die Formeln der Excel."""
from pathlib import Path

import pytest

from cockpit.config import lade_kpis, lade_mapping
from cockpit.ingest.excel import excel_zu_fakten
from cockpit.model import FAKT_SPALTEN, pruefe

BEISPIEL = Path(__file__).resolve().parent.parent / "examples" / "limonadenstaende.xlsx"


@pytest.fixture(scope="module")
def fakten():
    return excel_zu_fakten(BEISPIEL, lade_mapping("limonadenstaende"))


def test_schema(fakten):
    assert list(fakten.columns) == FAKT_SPALTEN
    assert fakten["datum"].notna().all()
    assert fakten["ebene_2"].notna().all()


def test_zeilenzahlen(fakten):
    n = fakten["kennzahl_id"].value_counts()
    assert n["transaktionen"] == 26324          # Bonierungen: 26.324 Bons
    assert n["umsatz_eur"] == 26324
    assert n["kosten_eur"] == 90                # Ausgaben: 15 Kostenstellen-Monate x 6


def test_ausgaben_datum(fakten):
    kosten = fakten[fakten.kennzahl_id == "kosten_eur"]
    assert sorted(kosten["datum"].dt.strftime("%Y-%m-%d").unique()) == [
        "2026-05-01", "2026-06-01", "2026-07-01"]


def test_rueckverfolgbar(fakten):
    assert fakten["quelle_zeile"].str.startswith(("Bonierungen:", "Ausgaben:")).all()
    assert (fakten["quelle"] == "limonadenstaende.xlsx").all()


def test_pruefbericht_ok(fakten):
    b = pruefe(fakten, lade_kpis())
    assert b.ok, b.text()


def test_pruefbericht_lehnt_unbekannte_kennzahl_ab(fakten):
    kaputt = fakten.copy()
    kaputt.loc[kaputt.index[0], "kennzahl_id"] = "gibt_es_nicht"
    b = pruefe(kaputt, lade_kpis())
    assert not b.ok
    assert "gibt_es_nicht" in b.text()
