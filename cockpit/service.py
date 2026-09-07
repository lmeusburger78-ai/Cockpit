"""Service-Schicht zwischen Oberfläche und Logik: lädt Konfiguration und Fakten,
bereitet Rollen-Sichten und die Werte für die KPI-Kacheln auf.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from cockpit.aggregate import ampel as ampel_farbe
from cockpit.aggregate import sicht, verdichte
from cockpit.config import lade_hierarchie, lade_kpis, lade_mapping, lade_rollen
from cockpit.ingest.excel import excel_zu_fakten
from cockpit.ingest.weather import WETTER_KNOTEN, csv_zu_fakten
from cockpit.model import EBENEN, pruefe
from cockpit.store import Store

BEISPIEL = Path(__file__).resolve().parent.parent / "examples" / "limonadenstaende.xlsx"
BEISPIEL_WETTER = Path(__file__).resolve().parent.parent / "examples" / "wetter_wien.csv"


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
        filt[f"ebene_{start + i}"] = knoten

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
        filt[f"ebene_{start + i}"] = knoten
    return filt


def naechste_knoten(fakten: pd.DataFrame, kpis: dict, rolle: dict,
                    pfad: tuple[str, ...]) -> pd.DataFrame:
    """Verdichtete Tabelle der KINDER des aktuellen Knotens (eine Ebene tiefer),
    gefiltert auf den Ausschnitt der Rolle – Grundlage der Drill-Down-Balken."""
    start = int(rolle["start_ebene"])
    kind_ebene = start + len(pfad) + 1
    return verdichte(fakten, kpis, kind_ebene, _filter(rolle, pfad), nach_monat=False)


def wetter_taeglich(fakten: pd.DataFrame) -> pd.DataFrame:
    """Tageswerte des Wetters (Temperatur, Niederschlag) als breite Tabelle –
    Grundlage des Wetter-Panels. Leer, wenn keine Wetterdaten geladen sind."""
    w = fakten[fakten["ebene_2"] == WETTER_KNOTEN]
    if w.empty:
        return pd.DataFrame(columns=["datum", "temperatur_c", "niederschlag_mm"])
    breit = w.pivot_table(index="datum", columns="kennzahl_id", values="wert", aggfunc="mean")
    return breit.reset_index().sort_values("datum")


def wetter_kennzahlen(fakten: pd.DataFrame, kpis: dict) -> list[dict]:
    """Kompakte Wetter-Kennzahlen des Zeitraums (Ø Temperatur, Niederschlag gesamt)."""
    d = wetter_taeglich(fakten)
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
           "wetter_taeglich", "wetter_kennzahlen"]
