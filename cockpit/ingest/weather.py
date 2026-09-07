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


def _fakten(datum: pd.Series, werte_je_kennzahl: dict, ebene_1: str,
            quelle: str, ebene_2=WETTER_KNOTEN) -> pd.DataFrame:
    """ebene_2 ist der Wetter-Knoten: konstant "Wetter" (stadtweit) oder je Zeile
    der Standortname, damit jeder Markt sein eigenes Wetter trägt.
    werte_je_kennzahl: {kennzahl_id: Serie} – z. B. Temperatur (Mittel/Min/Max), Niederschlag."""
    geladen = datetime.now().replace(microsecond=0)
    basis = pd.DataFrame({
        "datum": pd.to_datetime(datum).dt.normalize(),
        "ebene_1": ebene_1, "ebene_2": ebene_2, "ebene_3": None, "ebene_4": None,
        "quelle": quelle, "geladen_am": geladen,
    })
    teile = []
    for kid, werte in werte_je_kennzahl.items():
        if werte is None:
            continue
        t = basis.copy()
        t["kennzahl_id"] = kid
        t["wert"] = pd.to_numeric(pd.Series(list(werte), index=basis.index), errors="coerce")
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
    ebene_2 = df["Standort"].astype(str).str.strip() if "Standort" in df.columns else WETTER_KNOTEN
    werte = {"temperatur_c": df["Temperatur_C"].map(num),
             "niederschlag_mm": df["Niederschlag_mm"].map(num)}
    if "Temperatur_min_C" in df.columns:
        werte["temperatur_min_c"] = df["Temperatur_min_C"].map(num)
    if "Temperatur_max_C" in df.columns:
        werte["temperatur_max_c"] = df["Temperatur_max_C"].map(num)
    return _fakten(df["Datum"], werte, ebene_1, quelle or pfad.name, ebene_2)


def open_meteo_zu_fakten(lat: float, lon: float, start: str, end: str,
                         ebene_1: str = "Limonadenstände",
                         zeitzone: str = "Europe/Vienna") -> pd.DataFrame:
    """Holt Tages-Temperatur (Mittel) und Niederschlag (Summe) von Open-Meteo.

    start/end im Format JJJJ-MM-TT. Produktionsweg – braucht Netzzugang zu
    archive-api.open-meteo.com. Ergebnis ist dieselbe Fakt-Tabelle wie csv_zu_fakten.
    """
    p = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon, "start_date": start, "end_date": end,
        "daily": "temperature_2m_mean,temperature_2m_min,temperature_2m_max,precipitation_sum",
        "timezone": zeitzone,
    })
    url = f"https://archive-api.open-meteo.com/v1/archive?{p}"
    with urllib.request.urlopen(url, timeout=30) as r:
        d = json.load(r)["daily"]
    werte = {"temperatur_c": d["temperature_2m_mean"], "temperatur_min_c": d["temperature_2m_min"],
             "temperatur_max_c": d["temperature_2m_max"], "niederschlag_mm": d["precipitation_sum"]}
    return _fakten(pd.Series(d["time"]), werte, ebene_1, f"open-meteo:{lat},{lon}")


def open_meteo_je_standort(standorte: dict, start: str, end: str,
                           ebene_1: str = "Limonadenstände") -> pd.DataFrame:
    """Holt für JEDEN Standort das Wetter an seiner Koordinate (Produktionsweg).

    `standorte` ist config/standorte.yaml["standorte"]: {Name: {lat, lon, ort}}.
    Das Ergebnis trägt ebene_2 = Standortname, sodass jeder Markt im Drill-Down
    sein eigenes Wetter zeigt.
    """
    teile = []
    for name, o in standorte.items():
        f = open_meteo_zu_fakten(o["lat"], o["lon"], start, end, ebene_1)
        f["ebene_2"] = name
        f["quelle"] = f"open-meteo:{o.get('ort', name)}"
        teile.append(f)
    return pd.concat(teile, ignore_index=True)
