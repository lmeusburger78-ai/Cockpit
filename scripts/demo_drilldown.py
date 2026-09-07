"""Demo: Excel -> Fakt-Modell -> DuckDB -> Verdichtung -> Rollen-Sicht -> Drill-Down.

Aufruf:  python scripts/demo_drilldown.py [pfad/zur/excel.xlsx]
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cockpit.aggregate import sicht, verdichte  # noqa: E402
from cockpit.config import lade_kpis, lade_mapping, lade_rollen  # noqa: E402
from cockpit.ingest.excel import excel_zu_fakten  # noqa: E402
from cockpit.model import pruefe  # noqa: E402
from cockpit.store import Store  # noqa: E402

pd.set_option("display.width", 160)
pd.set_option("display.max_columns", 20)
pd.set_option("display.float_format", lambda x: f"{x:,.2f}")


def titel(t: str) -> None:
    print("\n" + "=" * 100 + f"\n{t}\n" + "=" * 100)


def zeige(df: pd.DataFrame) -> None:
    print(df.to_string(index=False))


def main(pfad: str) -> None:
    kpis, rollen = lade_kpis(), lade_rollen()

    titel("1) Upload -> einheitliches Modell (Fakt-Tabelle)")
    fakten = excel_zu_fakten(pfad, lade_mapping("limonadenstaende"))
    print(fakten.head(8).to_string(index=False))
    print(f"... insgesamt {len(fakten):,} Fakten aus {Path(pfad).name}")

    titel("2) Prüfbericht")
    bericht = pruefe(fakten, kpis)
    print(bericht.text())
    if not bericht.ok:
        sys.exit(1)

    titel("3) Speichern in DuckDB (data/cockpit.duckdb)")
    store = Store()
    n = store.ersetze_quelle(fakten)
    print(f"{n:,} Fakten geschrieben. Quellen im Speicher:")
    print(store.quellen().to_string(index=False))
    fakten = store.lade()

    titel("4) Verdichtung auf Unternehmens-Ebene je Monat (Ebene 1)")
    zeige(verdichte(fakten, kpis, ebene=1))

    titel("5) Sicht 'geschaeftsfuehrung' – Einstieg (Ebene 1, Gesamtzeitraum)")
    zeige(sicht(fakten, kpis, rollen, "geschaeftsfuehrung"))

    titel("6) Drill-Down der Geschäftsführung: Klick auf den Standort 'Bahnhof'")
    zeige(sicht(fakten, kpis, rollen, "geschaeftsfuehrung", ("Bahnhof",)))

    titel("7) Geschäftsführung darf NICHT tiefer (max_ebene 2)")
    try:
        sicht(fakten, kpis, rollen, "geschaeftsfuehrung", ("Bahnhof", "Orangensaft"))
    except PermissionError as e:
        print("Abgelehnt:", e)

    titel("8) Sicht 'standleitung_bahnhof' – Einstieg (nur der eigene Stand, je Monat)")
    zeige(sicht(fakten, kpis, rollen, "standleitung_bahnhof", nach_monat=True))

    titel("9) Drill-Down der Standleitung: Klick auf das Produkt 'Orangensaft'")
    zeige(sicht(fakten, kpis, rollen, "standleitung_bahnhof", ("Orangensaft",)))

    titel("10) ... und weiter: Orangensaft -> Größen")
    zeige(sicht(fakten, kpis, rollen, "standleitung_bahnhof",
                ("Orangensaft", "groß 0,4 l")))

    titel("11) Unterste Ebene: Einzelfakten mit Quelle (rückverfolgbar bis zur Excel-Zeile)")
    einzel = fakten[(fakten.ebene_2 == "Bahnhof") & (fakten.ebene_3 == "Orangensaft")
                    & (fakten.kennzahl_id == "umsatz_eur")].head(5)
    print(einzel.to_string(index=False))
    store.close()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "examples/limonadenstaende.xlsx")
