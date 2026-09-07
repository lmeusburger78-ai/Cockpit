"""Wetter-Adapter: Temperatur und Niederschlag als Fakten im einheitlichen Modell.

Zwei Wege in dieselbe Fakt-Tabelle:
- open_meteo_zu_fakten(): Live-Abruf von Open-Meteo (kostenlos, ohne Schlüssel).
  Nutzt euren Standort per Koordinaten. Läuft überall, wo der Host erreichbar ist.
- csv_zu_fakten(): liest eine CSV (Datum; Temperatur_C; Niederschlag_mm) – für
  Offline-Betrieb, Testdaten oder manuell gelieferte Wetterzahlen.

Wetter ist stadtweit, also standortübergreifend. Es wird als Kontext-Kennzahl
unter ebene_2 = "Wetter" geführt und im Cockpit in einem eigenen Wetter-Panel
gezeigt – es taucht nie als Standort in Ranking, Kuchen oder Drill-Down auf.
"""
from __future__ import annotations

import csv as _csv
import json
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

import pandas as pd

from cockpit.model import FAKT_SPALTEN

WETTER_KNOTEN = "Wetter"


def _fakten(datum: pd.Series, temp: pd.Series, prec: pd.Series, ebene_1: str,
            quelle: str) -> pd.DataFrame:
    geladen = datetime.now().replace(microsecond=0)
    basis = pd.DataFrame({
        "datum": pd.to_datetime(datum).dt.normalize(),
        "ebene_1": ebene_1, "ebene_2": WETTER_KNOTEN, "ebene_3": None, "ebene_4": None,
        "quelle": quelle, "geladen_am": geladen,
    })
    teile = []
    for kid, werte in (("temperatur_c", temp), ("niederschlag_mm", prec)):
        t = basis.copy()
        t["kennzahl_id"] = kid
        t["wert"] = pd.to_numeric(werte, errors="coerce")
        t["quelle_zeile"] = kid + ":" + basis["datum"].dt.strftime("%Y-%m-%d")
        teile.append(t)
    fakten = pd.concat(teile, ignore_index=True)
    fakten = fakten[fakten["wert"].notna()]
    return fakten[FAKT_SPALTEN].reset_index(drop=True)


def csv_zu_fakten(pfad: str | Path, ebene_1: str = "Limonadenstände",
                  quelle: str | None = None) -> pd.DataFrame:
    """Liest eine Wetter-CSV (Spalten: Datum; Temperatur_C; Niederschlag_mm)."""
    pfad = Path(pfad)
    zeilen = list(_csv.DictReader(open(pfad, encoding="utf-8"), delimiter=";"))
    def num(s: str) -> float:
        return float(str(s).replace(",", "."))
    df = pd.DataFrame(zeilen)
    return _fakten(df["Datum"], df["Temperatur_C"].map(num), df["Niederschlag_mm"].map(num),
                   ebene_1, quelle or pfad.name)


def open_meteo_zu_fakten(lat: float, lon: float, start: str, end: str,
                         ebene_1: str = "Limonadenstände",
                         zeitzone: str = "Europe/Vienna") -> pd.DataFrame:
    """Holt Tages-Temperatur (Mittel) und Niederschlag (Summe) von Open-Meteo.

    start/end im Format JJJJ-MM-TT. Produktionsweg – braucht Netzzugang zu
    archive-api.open-meteo.com. Ergebnis ist dieselbe Fakt-Tabelle wie csv_zu_fakten.
    """
    p = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon, "start_date": start, "end_date": end,
        "daily": "temperature_2m_mean,precipitation_sum", "timezone": zeitzone,
    })
    url = f"https://archive-api.open-meteo.com/v1/archive?{p}"
    with urllib.request.urlopen(url, timeout=30) as r:
        d = json.load(r)["daily"]
    return _fakten(pd.Series(d["time"]), pd.Series(d["temperature_2m_mean"]),
                   pd.Series(d["precipitation_sum"]), ebene_1, f"open-meteo:{lat},{lon}")
