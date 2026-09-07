"""Verdichtungs-Tests gegen die (zwischengespeicherten) Formelwerte der Beispiel-Excel."""
from pathlib import Path

import pandas as pd
import pytest

from cockpit.aggregate import ampel, sicht, verdichte
from cockpit.config import lade_kpis, lade_mapping, lade_rollen
from cockpit.ingest.excel import excel_zu_fakten

BEISPIEL = Path(__file__).resolve().parent.parent / "examples" / "limonadenstaende.xlsx"

# Werte aus dem Blatt "Management (GuV)" / "Dashboard" / "Monatsvergleich" der Excel
EXCEL_UMSATZ = {"2026-05": 48874.80, "2026-06": 54719.10, "2026-07": 65889.00}
EXCEL_GEWINN = {"2026-05": -325.93, "2026-06": 542.65, "2026-07": 5375.36}
EXCEL_TRANSAKTIONEN = {"2026-05": 7563, "2026-06": 8540, "2026-07": 10221}
EXCEL_BECHER = {"2026-05": 9552, "2026-06": 10769, "2026-07": 12890}
EXCEL_WARTEZEIT = {"2026-05": 6.1155, "2026-06": 6.1166, "2026-07": 6.1002}
EXCEL_UMSATZ_HAUPTPLATZ_MAI = 15474.30
EXCEL_RENDITE_GESAMT_PCT = 3.2995   # GuV: 5.592,08 / 169.482,90


@pytest.fixture(scope="module")
def fakten():
    return excel_zu_fakten(BEISPIEL, lade_mapping("limonadenstaende"))


@pytest.fixture(scope="module")
def kpis():
    return lade_kpis()


def _je_monat(df: pd.DataFrame, spalte: str) -> dict:
    return df.set_index("periode")[spalte].to_dict()


def test_unternehmen_je_monat_wie_excel(fakten, kpis):
    e1 = verdichte(fakten, kpis, ebene=1)
    for spalte, erwartet, tol in [
        ("umsatz_eur", EXCEL_UMSATZ, 0.01),
        ("ergebnis_eur", EXCEL_GEWINN, 0.01),
        ("transaktionen", EXCEL_TRANSAKTIONEN, 0),
        ("becher", EXCEL_BECHER, 0),
        ("wartezeit_min", EXCEL_WARTEZEIT, 0.001),
    ]:
        ist = _je_monat(e1, spalte)
        for monat, soll in erwartet.items():
            assert ist[monat] == pytest.approx(soll, abs=tol), (spalte, monat)


def test_standort_wie_excel(fakten, kpis):
    e2 = verdichte(fakten, kpis, ebene=2)
    zeile = e2[(e2.ebene_2 == "Hauptplatz") & (e2.periode == "2026-05")].iloc[0]
    assert zeile["umsatz_eur"] == pytest.approx(EXCEL_UMSATZ_HAUPTPLATZ_MAI, abs=0.01)


def test_quotienten_werden_neu_gerechnet_nicht_gemittelt(fakten, kpis):
    """Die Excel mittelt im Dashboard drei Monatsrenditen (2,83 %); richtig ist die
    Rendite des Gesamtzeitraums (3,30 %) – so rechnet es das Modell."""
    gesamt = verdichte(fakten, kpis, ebene=1, nach_monat=False).iloc[0]
    assert gesamt["umsatzrendite_pct"] == pytest.approx(EXCEL_RENDITE_GESAMT_PCT, abs=0.001)


def test_summe_der_standorte_ist_das_unternehmen(fakten, kpis):
    e1 = verdichte(fakten, kpis, ebene=1, nach_monat=False).iloc[0]
    e2 = verdichte(fakten, kpis, ebene=2, nach_monat=False)
    assert e2["umsatz_eur"].sum() == pytest.approx(e1["umsatz_eur"])
    assert e2["kosten_eur"].sum() == pytest.approx(e1["kosten_eur"])
    # Zentrale hat Kosten, aber keinen Umsatz -> Ergebnis dort negativ,
    # und die Ergebnisse der Ebene 2 addieren sich zum Unternehmensgewinn
    zentrale = e2[e2.ebene_2 == "Zentrale"].iloc[0]
    assert pd.isna(zentrale["umsatz_eur"]) and zentrale["kosten_eur"] == 25500
    assert zentrale["ergebnis_eur"] == -25500 and pd.isna(zentrale["umsatzrendite_pct"])
    assert e2["ergebnis_eur"].sum() == pytest.approx(e1["ergebnis_eur"])


def test_ergebnis_nur_bis_standort(fakten, kpis):
    """Kosten sind nur je Standort bekannt -> auf Produkt-Ebene kein Ergebnis."""
    e3 = verdichte(fakten, kpis, ebene=3, nach_monat=False)
    assert "ergebnis_eur" not in e3.columns
    assert "umsatzrendite_pct" not in e3.columns


def test_gewichteter_mittelwert():
    kpis = {
        "n": {"aggregation": "sum"},
        "wz": {"aggregation": "weighted_mean", "gewicht": "n"},
    }
    fakten = pd.DataFrame({
        "datum": pd.to_datetime(["2026-05-01"] * 4),
        "kennzahl_id": ["n", "wz", "n", "wz"],
        "wert": [100, 4.0, 10, 8.0],          # großer Stand 4 Min, kleiner Stand 8 Min
        "ebene_1": "U", "ebene_2": ["A", "A", "B", "B"], "ebene_3": None, "ebene_4": None,
        "quelle": "t", "quelle_zeile": ["1", "1", "2", "2"], "geladen_am": pd.Timestamp.now(),
    })
    e1 = verdichte(fakten, kpis, ebene=1, nach_monat=False).iloc[0]
    assert e1["wz"] == pytest.approx((100 * 4 + 10 * 8) / 110)   # 4,36 – nicht 6,0


def test_ampel():
    kleiner = {"richtung": "kleiner_ist_besser", "ampel": {"gruen_bis": 5.5, "gelb_bis": 6.5}}
    groesser = {"richtung": "groesser_ist_besser", "ampel": {"gruen_ab": 3.8, "gelb_ab": 3.4}}
    assert ampel(5.0, kleiner) == "gruen"
    assert ampel(6.0, kleiner) == "gelb"
    assert ampel(7.0, kleiner) == "rot"
    assert ampel(3.9, groesser) == "gruen"
    assert ampel(None, {"ampel": {"gruen_ab": 1, "gelb_ab": 0}}) is None


def test_rollen_sicht_und_drilldown(fakten, kpis):
    rollen = lade_rollen()
    # GF steigt auf Unternehmensebene ein (eine Zeile), ohne Kostendetails
    gf = sicht(fakten, kpis, rollen, "geschaeftsfuehrung")
    assert list(gf.columns[:1]) == ["ebene_1"] and len(gf) == 1
    assert "kosten_eur" not in gf.columns

    # Drill-Down in einen Standort: genau dieser Knoten auf Ebene 2
    bahnhof = sicht(fakten, kpis, rollen, "geschaeftsfuehrung", ("Bahnhof",))
    assert len(bahnhof) == 1 and bahnhof["ebene_2"].iloc[0] == "Bahnhof"
    assert bahnhof["umsatz_eur"].iloc[0] == pytest.approx(46189.2, abs=0.1)

    # GF darf nicht tiefer als Ebene 2
    with pytest.raises(PermissionError):
        sicht(fakten, kpis, rollen, "geschaeftsfuehrung", ("Bahnhof", "Orangensaft"))

    # Standleitung sieht nur den eigenen Stand (Rollenfilter greift serverseitig)
    stand = sicht(fakten, kpis, rollen, "standleitung_bahnhof")
    assert set(stand["ebene_2"]) == {"Bahnhof"}
    # Drill in ein Produkt: Filter bleibt auf Bahnhof, zusätzlich Produkt
    orangen = sicht(fakten, kpis, rollen, "standleitung_bahnhof", ("Orangensaft",))
    assert set(orangen["ebene_2"]) == {"Bahnhof"}
    assert set(orangen["ebene_3"]) == {"Orangensaft"}
    # eine Ebene tiefer: Größen des Produkts am Bahnhof
    groessen = sicht(fakten, kpis, rollen, "standleitung_bahnhof", ("Orangensaft", "groß 0,4 l"))
    assert set(groessen["ebene_4"]) == {"groß 0,4 l"}


def test_im_zeitraum(fakten, kpis):
    from cockpit.service import im_zeitraum
    juni = im_zeitraum(fakten, "2026-06-01", "2026-06-30")
    umsatz = verdichte(juni, kpis, 1, {}, nach_monat=False)["umsatz_eur"].iloc[0]
    assert umsatz == pytest.approx(54719.1, abs=0.5)          # Juni-Umsatz
    # Kosten des vollen Junis bleiben voll erhalten (kein Teilmonat)
    assert juni[juni.kennzahl_id == "kosten_eur"]["wert"].sum() == pytest.approx(54176.45, abs=0.5)
    # Teilmonat: halber Mai -> ~Hälfte der Mai-Kosten
    halb = im_zeitraum(fakten, "2026-05-01", "2026-05-15")
    mai_voll = fakten[(fakten.kennzahl_id == "kosten_eur") & (fakten.datum == "2026-05-01")]["wert"].sum()
    assert halb[halb.kennzahl_id == "kosten_eur"]["wert"].sum() == pytest.approx(mai_voll * 15 / 31, rel=0.02)
