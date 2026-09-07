"""Excel-Import: liest Rohdaten-Blätter anhand eines Mapping-Profils ein und
überführt sie in das einheitliche Kennzahlen-Modell (siehe cockpit/model.py).

Ein neues Excel-Format bedeutet ein neues Profil in config/mappings/,
keinen neuen Code.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pandas as pd

from cockpit.model import EBENEN, FAKT_SPALTEN

MONATE = {
    "jänner": 1, "januar": 1, "februar": 2, "märz": 3, "april": 4, "mai": 5, "juni": 6,
    "juli": 7, "august": 8, "september": 9, "oktober": 10, "november": 11, "dezember": 12,
}


def _datum(df: pd.DataFrame, regel: dict) -> pd.Series:
    """Leitet die Datums-Spalte nach der Regel des Profils ab."""
    if "spalte" in regel:
        return pd.to_datetime(df[regel["spalte"]], errors="coerce").dt.normalize()
    if "monat_spalte" in regel:
        monat = df[regel["monat_spalte"]].astype(str).str.strip().str.lower().map(MONATE)
        jahr = regel.get("jahr", datetime.now().year)
        return pd.to_datetime(
            {"year": jahr, "month": monat, "day": 1}, errors="coerce"
        )
    raise ValueError(f"Unbekannte Datumsregel: {regel}")


def blatt_zu_fakten(df: pd.DataFrame, blatt: dict, ebene_1: str, quelle: str,
                    geladen_am: datetime) -> pd.DataFrame:
    """Wandelt EIN Rohdaten-Blatt (breit) in Fakten (lang) um."""
    df = df.dropna(how="all")
    basis = pd.DataFrame({
        "datum": _datum(df, blatt["datum"]),
        "ebene_1": ebene_1,
        "quelle": quelle,
        "quelle_zeile": blatt["blatt"] + ":" + df[blatt["zeilen_id"]].astype(str),
        "geladen_am": geladen_am,
    }, index=df.index)
    for ebene in EBENEN[1:]:
        spalte = blatt.get("ebenen", {}).get(ebene)
        basis[ebene] = df[spalte].astype(str).str.strip() if spalte else None

    teile = []
    for kennzahl_id, regel in blatt["kennzahlen"].items():
        if isinstance(regel, dict) and "konstante" in regel:
            wert = pd.Series(regel["konstante"], index=df.index, dtype="float64")
        else:
            wert = pd.to_numeric(df[regel], errors="coerce")
        teil = basis.copy()
        teil["kennzahl_id"] = kennzahl_id
        teil["wert"] = wert
        teile.append(teil)

    fakten = pd.concat(teile, ignore_index=True)
    fakten = fakten[fakten["wert"].notna()]
    return fakten[FAKT_SPALTEN].reset_index(drop=True)


def excel_zu_fakten(pfad: str | Path, profil: dict) -> pd.DataFrame:
    """Liest alle im Profil genannten Blätter einer Excel-Datei als Fakten."""
    pfad = Path(pfad)
    geladen_am = datetime.now().replace(microsecond=0)
    teile = []
    for blatt in profil["blaetter"]:
        roh = pd.read_excel(pfad, sheet_name=blatt["blatt"], header=blatt.get("kopfzeile", 1) - 1)
        teile.append(blatt_zu_fakten(roh, blatt, profil["ebene_1"], pfad.name, geladen_am))
    return pd.concat(teile, ignore_index=True)
