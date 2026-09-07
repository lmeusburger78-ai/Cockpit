"""Wetter-Adapter: CSV-Import ins Modell, Kontext-Kennzahlen bleiben aus der
Geschäftsverdichtung heraus."""
from pathlib import Path

import pandas as pd
import pytest

from cockpit.aggregate import verdichte
from cockpit.config import lade_kpis, lade_mapping
from cockpit.ingest.excel import excel_zu_fakten
from cockpit.ingest.weather import csv_zu_fakten
from cockpit.model import FAKT_SPALTEN, pruefe

WETTER = Path(__file__).resolve().parent.parent / "examples" / "wetter.csv"
EXCEL = Path(__file__).resolve().parent.parent / "examples" / "limonadenstaende.xlsx"


@pytest.fixture(scope="module")
def wetter():
    return csv_zu_fakten(WETTER)


def test_schema_und_pruefung(wetter):
    assert list(wetter.columns) == FAKT_SPALTEN
    assert pruefe(wetter, lade_kpis()).ok
    assert set(wetter["kennzahl_id"]) == {"temperatur_c", "niederschlag_mm"}
    # Wetter haengt jetzt an den Maerkten (ebene_2 = Standort), nicht an "Wetter"
    assert set(wetter["ebene_2"]) == {"Hauptplatz", "Bahnhof", "Stadtpark", "Wochenmarkt"}


def test_wetter_verschmutzt_geschaeft_nicht(wetter):
    kpis = lade_kpis()
    excel = excel_zu_fakten(EXCEL, lade_mapping("limonadenstaende"))
    alle = pd.concat([excel, wetter], ignore_index=True)
    e2 = verdichte(alle, kpis, 2, {}, nach_monat=False)
    assert "Wetter" not in set(e2["ebene_2"])                  # kein Wetter-Pseudostandort
    assert "temperatur_c" not in e2.columns                    # keine Kontext-Spalte
    assert set(e2["ebene_2"]) == {"Hauptplatz", "Bahnhof", "Stadtpark", "Wochenmarkt", "Zentrale"}
    # Umsatz unverändert gegenüber ohne Wetter
    nur = verdichte(excel, kpis, 1, {}, nach_monat=False)["umsatz_eur"].iloc[0]
    mit = verdichte(alle, kpis, 1, {}, nach_monat=False)["umsatz_eur"].iloc[0]
    assert nur == pytest.approx(mit)
