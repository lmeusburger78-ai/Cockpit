"""Das einheitliche Kennzahlen-Modell (Fakt-Tabelle) und seine Prüfung.

Jede Zeile ist EINE Messung EINER Kennzahl zu EINEM Datum auf EINEM Knoten
der Hierarchie. Egal ob die Zahl aus einer Bonierung, einer Ausgabenbuchung
oder einem Aktienkurs stammt – im Modell sieht sie gleich aus.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

EBENEN = ["ebene_1", "ebene_2", "ebene_3", "ebene_4"]

FAKT_SPALTEN = [
    "datum",         # Stichtag der Messung
    "kennzahl_id",   # Schlüssel in config/kpis.yaml
    "wert",          # Zahl in der Einheit der Kennzahl
    *EBENEN,         # Hierarchie von oben nach unten (unten darf leer sein)
    "quelle",        # Dateiname des Uploads
    "quelle_zeile",  # Blatt:Zeilen-ID – macht jede Zahl rückverfolgbar
    "geladen_am",    # Ladezeitpunkt
]


@dataclass
class Pruefbericht:
    """Ergebnis der Validierung eines Uploads. Erst bei ok=True wird gespeichert."""

    fehler: list[str] = field(default_factory=list)
    warnungen: list[str] = field(default_factory=list)
    zeilen: int = 0
    kennzahlen: dict[str, int] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.fehler

    def text(self) -> str:
        zeilen = [f"Fakten: {self.zeilen}"]
        for k, n in sorted(self.kennzahlen.items()):
            zeilen.append(f"  {k}: {n}")
        for w in self.warnungen:
            zeilen.append(f"WARNUNG: {w}")
        for e in self.fehler:
            zeilen.append(f"FEHLER: {e}")
        zeilen.append("Ergebnis: " + ("OK" if self.ok else "ABGELEHNT"))
        return "\n".join(zeilen)


def pruefe(fakten: pd.DataFrame, kpis: dict) -> Pruefbericht:
    """Prüft eine Fakt-Tabelle gegen das Schema und den Kennzahlen-Katalog."""
    b = Pruefbericht(zeilen=len(fakten))

    fehlend = [s for s in FAKT_SPALTEN if s not in fakten.columns]
    if fehlend:
        b.fehler.append(f"Spalten fehlen: {fehlend}")
        return b

    unbekannt = sorted(set(fakten["kennzahl_id"]) - set(kpis))
    if unbekannt:
        b.fehler.append(f"Unbekannte Kennzahlen (nicht in kpis.yaml): {unbekannt}")

    berechnet = [k for k in set(fakten["kennzahl_id"]) if "berechnet" in kpis.get(k, {})]
    if berechnet:
        b.fehler.append(f"Berechnete Kennzahlen dürfen nicht geladen werden: {berechnet}")

    if fakten["datum"].isna().any():
        b.fehler.append(f"{int(fakten['datum'].isna().sum())} Zeilen ohne Datum")

    nicht_numerisch = pd.to_numeric(fakten["wert"], errors="coerce").isna() & fakten["wert"].notna()
    if nicht_numerisch.any():
        b.fehler.append(f"{int(nicht_numerisch.sum())} Werte sind nicht numerisch")

    leer = fakten["wert"].isna()
    if leer.any():
        b.warnungen.append(f"{int(leer.sum())} leere Werte werden ignoriert")

    if fakten["ebene_1"].isna().any() or fakten["ebene_2"].isna().any():
        b.fehler.append("Ebene 1 und 2 müssen für jede Zeile gesetzt sein")

    b.kennzahlen = fakten["kennzahl_id"].value_counts().to_dict()
    return b
