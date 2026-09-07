"""Speicher: eine DuckDB-Datei mit der Fakt-Tabelle.

DuckDB ist eine eingebettete Analyse-Datenbank – eine einzige Datei, kein
Server, aber SQL und sehr schnelle Gruppierungen (= Verdichtung). Jeder Upload
ersetzt die Fakten seiner eigenen Quelle, sodass ein erneuter Upload derselben
Datei keine Doppelzählung erzeugt.
"""
from __future__ import annotations

from pathlib import Path

import duckdb
import pandas as pd

from cockpit.model import FAKT_SPALTEN

_SCHEMA = """
CREATE TABLE IF NOT EXISTS fakten (
    datum        DATE,
    kennzahl_id  VARCHAR,
    wert         DOUBLE,
    ebene_1      VARCHAR,
    ebene_2      VARCHAR,
    ebene_3      VARCHAR,
    ebene_4      VARCHAR,
    quelle       VARCHAR,
    quelle_zeile VARCHAR,
    geladen_am   TIMESTAMP
)
"""


class Store:
    def __init__(self, pfad: str | Path = "data/cockpit.duckdb"):
        Path(pfad).parent.mkdir(parents=True, exist_ok=True)
        self.con = duckdb.connect(str(pfad))
        self.con.execute(_SCHEMA)

    def ersetze_quelle(self, fakten: pd.DataFrame) -> int:
        """Löscht alle Fakten der enthaltenen Quellen und schreibt die neuen."""
        quellen = fakten["quelle"].unique().tolist()
        df = fakten[FAKT_SPALTEN]
        self.con.register("_neu", df)
        self.con.execute("BEGIN")
        for q in quellen:
            self.con.execute("DELETE FROM fakten WHERE quelle = ?", [q])
        self.con.execute("INSERT INTO fakten SELECT * FROM _neu")
        self.con.execute("COMMIT")
        self.con.unregister("_neu")
        return len(df)

    def lade(self, **filter: str) -> pd.DataFrame:
        """Liest Fakten, optional gefiltert (z. B. ebene_2="Bahnhof")."""
        where, params = [], []
        for spalte, wert in filter.items():
            where.append(f"{spalte} = ?")
            params.append(wert)
        sql = "SELECT * FROM fakten" + (" WHERE " + " AND ".join(where) if where else "")
        df = self.con.execute(sql, params).df()
        df["datum"] = pd.to_datetime(df["datum"])
        return df

    def quellen(self) -> pd.DataFrame:
        return self.con.execute(
            "SELECT quelle, COUNT(*) AS fakten, MIN(datum) AS von, MAX(datum) AS bis, "
            "MAX(geladen_am) AS geladen_am FROM fakten GROUP BY quelle ORDER BY quelle"
        ).df()

    def close(self) -> None:
        self.con.close()
