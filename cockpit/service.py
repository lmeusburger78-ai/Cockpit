"""Service-Schicht zwischen Oberfläche und Logik: lädt Konfiguration und Fakten,
bereitet Rollen-Sichten und die Werte für die KPI-Kacheln auf.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from cockpit.aggregate import ampel as ampel_farbe
from cockpit.aggregate import sicht, verdichte
from cockpit.config import KONFIG_DIR, lade_hierarchie, lade_kpis, lade_mapping, lade_rollen
from cockpit.ingest.excel import excel_zu_fakten
from cockpit.ingest.weather import csv_zu_fakten
from cockpit.model import EBENEN, pruefe
from cockpit.store import Store

BEISPIEL = Path(__file__).resolve().parent.parent / "examples" / "limonadenstaende.xlsx"
BEISPIEL_WETTER = Path(__file__).resolve().parent.parent / "examples" / "wetter.csv"


def konfig() -> tuple[dict, dict, dict]:
    return lade_kpis(), lade_rollen(), lade_hierarchie()


def store_mit_beispiel(pfad: str = "data/cockpit.duckdb") -> Store:
    """Öffnet den Speicher und lädt einmalig die Beispieldatei, falls leer."""
    store = Store(pfad)
    kpis = lade_kpis()
    if store.quellen().empty and BEISPIEL.exists():
        fakten = excel_zu_fakten(BEISPIEL, lade_mapping("limonadenstaende"))
        if pruefe(fakten, kpis).ok:
            store.ersetze_quelle(fakten)
        if BEISPIEL_WETTER.exists():
            wetter = csv_zu_fakten(BEISPIEL_WETTER)
            if pruefe(wetter, kpis).ok:
                store.ersetze_quelle(wetter)
    return store


def importiere(pfad: str, profil_name: str, store: Store):
    """Import eines Uploads mit Prüfbericht; speichert nur bei ok."""
    fakten = excel_zu_fakten(pfad, lade_mapping(profil_name))
    bericht = pruefe(fakten, lade_kpis())
    if bericht.ok:
        store.ersetze_quelle(fakten)
    return bericht


def kachel_werte(fakten: pd.DataFrame, kpis: dict, rolle: dict,
                 pfad: tuple[str, ...]) -> list[dict]:
    """Werte für die KPI-Kacheln des aktuellen Knotens inkl. Ampel und
    Veränderung gegenüber dem Vormonat."""
    start = int(rolle["start_ebene"])
    ebene = start + len(pfad)
    filt = dict(rolle.get("filter") or {})
    for i, knoten in enumerate(pfad):
        filt[f"ebene_{start + 1 + i}"] = knoten

    gesamt = verdichte(fakten, kpis, ebene, filt, nach_monat=False)
    monatlich = verdichte(fakten, kpis, ebene, filt, nach_monat=True)
    kacheln = []
    for kid in rolle["kennzahlen"]:
        if kid not in gesamt.columns or gesamt.empty:
            continue
        wert = gesamt[kid].iloc[0]
        if pd.isna(wert):
            continue
        kdef = kpis[kid]
        reihe = monatlich.sort_values("periode")[kid].dropna() if kid in monatlich else pd.Series([])
        delta = None
        if len(reihe) >= 2 and reihe.iloc[-2]:
            delta = (reihe.iloc[-1] - reihe.iloc[-2]) / abs(reihe.iloc[-2]) * 100
        kacheln.append({
            "id": kid, "name": kdef.get("name", kid), "einheit": kdef.get("einheit", ""),
            "wert": wert, "ampel": ampel_farbe(wert, kdef),
            "delta_pct": delta, "richtung": kdef.get("richtung"),
            "reihe": reihe.tolist(),
        })
    return kacheln


def ebenen_namen(hierarchie: dict) -> dict[int, str]:
    return {int(k): v for k, v in hierarchie.get("ebenen", {}).items()}


def _filter(rolle: dict, pfad: tuple[str, ...]) -> dict:
    start = int(rolle["start_ebene"])
    filt = dict(rolle.get("filter") or {})
    for i, knoten in enumerate(pfad):
        filt[f"ebene_{start + 1 + i}"] = knoten
    return filt


def naechste_knoten(fakten: pd.DataFrame, kpis: dict, rolle: dict,
                    pfad: tuple[str, ...]) -> pd.DataFrame:
    """Verdichtete Tabelle der KINDER des aktuellen Knotens (eine Ebene tiefer),
    gefiltert auf den Ausschnitt der Rolle – Grundlage der Drill-Down-Balken."""
    start = int(rolle["start_ebene"])
    kind_ebene = start + len(pfad) + 1
    return verdichte(fakten, kpis, kind_ebene, _filter(rolle, pfad), nach_monat=False)


WETTER_KZ = ["temperatur_c", "temperatur_min_c", "temperatur_max_c", "niederschlag_mm"]


WOCHENTAG = {0: "Mo", 1: "Di", 2: "Mi", 3: "Do", 4: "Fr", 5: "Sa", 6: "So"}


def _knoten_filter(rolle: dict, pfad: tuple[str, ...]) -> dict:
    start = int(rolle["start_ebene"])
    filt = dict(rolle.get("filter") or {})
    for i, k in enumerate(pfad):
        filt[f"ebene_{start + 1 + i}"] = k
    return filt


def im_zeitraum(fakten: pd.DataFrame, von, bis) -> pd.DataFrame:
    """Filtert Fakten auf den Zeitraum [von, bis]. Tageszeilen (Verkauf, Wetter)
    werden per Datum gefiltert; monatliche Kostenzeilen anteilig nach überlappenden
    Tagen skaliert, damit Teilmonate korrekt gewichtet werden."""
    von, bis = pd.Timestamp(von), pd.Timestamp(bis)
    ist_kosten = fakten["kennzahl_id"] == "kosten_eur"
    tage = fakten[~ist_kosten]
    tage = tage[(tage["datum"] >= von) & (tage["datum"] <= bis)]
    kosten = fakten[ist_kosten].copy()
    if not kosten.empty:
        m0 = kosten["datum"].values.astype("datetime64[M]").astype("datetime64[ns]")
        m1 = (pd.to_datetime(m0) + pd.offsets.MonthEnd(0)).normalize()
        lo = pd.Series(m0, index=kosten.index).where(lambda x: x >= von, von)
        hi = pd.Series(m1.values, index=kosten.index).where(lambda x: x <= bis, bis)
        tage_im = (hi - lo).dt.days + 1
        monatstage = (m1 - pd.to_datetime(m0)).days + 1
        frac = (tage_im / monatstage).clip(lower=0)
        kosten = kosten[frac > 0].copy()
        kosten["wert"] = kosten["wert"] * frac[frac > 0].values
    return pd.concat([tage, kosten], ignore_index=True)


def produkt_mengen(fakten: pd.DataFrame, rolle: dict, pfad: tuple[str, ...]) -> pd.DataFrame:
    """Verkaufte Menge (Becher) und Umsatz je Produkt unter dem aktuellen Knoten –
    zusätzlich aufgeteilt nach Getränkegröße (klein/groß), damit die Oberfläche
    zwischen Menge/Umsatz und klein/groß umschalten kann.
    Produkte stehen in ebene_3 der Verkaufszeilen; Kostenzeilen fallen weg (kein 'becher')."""
    spalten = ["produkt", "becher", "umsatz_eur", "becher_klein", "becher_gross",
               "umsatz_klein", "umsatz_gross"]
    d = fakten[fakten["kennzahl_id"].isin(["becher", "umsatz_eur"])].copy()
    for sp, w in _knoten_filter(rolle, pfad).items():
        if sp in d.columns and sp not in ("ebene_3", "ebene_4"):
            d = d[d[sp] == w]
    d = d[d["ebene_3"].notna()]
    if d.empty:
        return pd.DataFrame(columns=spalten)
    d["groesse"] = d["ebene_4"].astype(str).str.contains("klein").map({True: "klein", False: "gross"})
    pv = d.pivot_table(index="ebene_3", columns=["kennzahl_id", "groesse"], values="wert",
                       aggfunc="sum", fill_value=0.0)
    out = pd.DataFrame(index=pv.index)
    for kid, kurz in (("becher", "becher"), ("umsatz_eur", "umsatz")):
        for g in ("klein", "gross"):
            col = (kid, g)
            out[f"{kurz}_{g}"] = pv[col] if col in pv.columns else 0.0
    out["becher"] = out["becher_klein"] + out["becher_gross"]
    out["umsatz_eur"] = out["umsatz_klein"] + out["umsatz_gross"]
    out = out.reset_index().rename(columns={"ebene_3": "produkt"})
    return out[spalten].sort_values("becher", ascending=False)


def taeglicher_umsatz(fakten: pd.DataFrame, rolle: dict, pfad: tuple[str, ...]) -> pd.DataFrame:
    """Umsatz je Tag unter dem aktuellen Knoten, mit Wochentag – für den Tagesverlauf
    (Absatz gegen Wetter, sichtbarer Wochentag)."""
    d = fakten[fakten["kennzahl_id"] == "umsatz_eur"].copy()
    for sp, w in _knoten_filter(rolle, pfad).items():
        if sp in d.columns:
            d = d[d[sp] == w]
    if d.empty:
        return pd.DataFrame(columns=["datum", "umsatz_eur", "wochentag"])
    g = d.groupby("datum")["wert"].sum().reset_index().rename(columns={"wert": "umsatz_eur"})
    g["wochentag"] = g["datum"].dt.dayofweek.map(WOCHENTAG)
    return g.sort_values("datum")


def standort_orte() -> dict:
    """Standort -> Ort/Koordinaten aus config/standorte.yaml (für Panel-Beschriftung)."""
    import yaml
    p = KONFIG_DIR / "standorte.yaml"
    if not p.exists():
        return {}
    return (yaml.safe_load(open(p, encoding="utf-8")) or {}).get("standorte", {})


def wetter_taeglich(fakten: pd.DataFrame, standort: str | None = None) -> pd.DataFrame:
    """Tageswerte des Wetters (Temperatur, Niederschlag) als breite Tabelle.

    standort=None mittelt über alle Märkte (Temperatur) bzw. mittelt den
    Niederschlag – für die Übersicht. Ein Standortname filtert auf dessen Wetter
    – für den Drill-Down in einen Markt. Leer, wenn keine Wetterdaten geladen sind.
    """
    w = fakten[fakten["kennzahl_id"].isin(WETTER_KZ)]
    if standort is not None:
        w = w[w["ebene_2"] == standort]
    if w.empty:
        return pd.DataFrame(columns=["datum", "temperatur_c", "niederschlag_mm"])
    # je Tag über die Märkte zusammenfassen (Mittel – bei einem Markt unverändert)
    breit = w.pivot_table(index="datum", columns="kennzahl_id", values="wert", aggfunc="mean")
    return breit.reset_index().sort_values("datum")


def wetter_kennzahlen(fakten: pd.DataFrame, kpis: dict, standort: str | None = None) -> list[dict]:
    """Kompakte Wetter-Kennzahlen des Zeitraums (Ø Temperatur, Niederschlag gesamt)."""
    d = wetter_taeglich(fakten, standort)
    if d.empty:
        return []
    return [
        {"name": kpis["temperatur_c"]["name"], "einheit": "°C",
         "wert": round(d["temperatur_c"].mean(), 1)},
        {"name": kpis["niederschlag_mm"]["name"], "einheit": "mm",
         "wert": round(d["niederschlag_mm"].sum(), 0)},
        {"name": "Regentage", "einheit": "Tage",
         "wert": int((d["niederschlag_mm"] > 0).sum())},
    ]


__all__ = ["EBENEN", "konfig", "store_mit_beispiel", "importiere", "kachel_werte",
           "ebenen_namen", "naechste_knoten", "sicht", "verdichte",
           "wetter_taeglich", "wetter_kennzahlen", "standort_orte",
           "produkt_mengen", "taeglicher_umsatz", "im_zeitraum"]
