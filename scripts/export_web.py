"""Erzeugt die statische Cockpit-Website (web/cockpit.html) aus den echten Daten.

Exportiert kompakte TAGESDATEN (Verkauf je Tag/Standort/Produkt/Größe, Kosten je
Monat, Wetter je Tag/Standort). Die Seite berechnet daraus im Browser alle
Kennzahlen, Diagramme und die Auswahl der Zeitspanne live (siehe web/template.html).
Aufruf: python scripts/export_web.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from cockpit import service  # noqa: E402

WURZEL = Path(__file__).resolve().parent.parent


def build():
    store = service.store_mit_beispiel()
    f = store.lade()
    kpis, rollen, hier = service.konfig()
    orte = service.standort_orte()

    verk = f[f["kennzahl_id"].isin(
        ["umsatz_eur", "becher", "transaktionen", "wartezeit_min", "zufriedenheit"])].copy()
    verk = verk[verk["ebene_2"].notna() & (verk["ebene_2"] != "Wetter") & verk["ebene_3"].notna()]
    piv = verk.pivot_table(index=["datum", "ebene_2", "ebene_3", "ebene_4"], columns="kennzahl_id",
                           values="wert", aggfunc="sum", fill_value=0.0).reset_index()
    sales = [{"d": r["datum"].strftime("%Y-%m-%d"), "s": r["ebene_2"], "p": r["ebene_3"],
              "g": "klein" if "klein" in str(r["ebene_4"]) else "gross",
              "um": round(float(r.get("umsatz_eur", 0)), 2), "be": int(r.get("becher", 0)),
              "tx": int(r.get("transaktionen", 0)), "wz": round(float(r.get("wartezeit_min", 0)), 2),
              "zf": round(float(r.get("zufriedenheit", 0)), 2)} for _, r in piv.iterrows()]

    kos = f[f["kennzahl_id"] == "kosten_eur"].copy()
    kos["mon"] = kos["datum"].dt.strftime("%Y-%m")
    kg = kos.groupby(["mon", "ebene_2", "ebene_3"])["wert"].sum().reset_index()
    costs = [{"mon": r["mon"], "ks": r["ebene_2"], "ka": r["ebene_3"], "be": round(float(r["wert"]), 2)}
             for _, r in kg.iterrows()]

    w = f[f["kennzahl_id"].isin(
        ["temperatur_c", "temperatur_min_c", "temperatur_max_c", "niederschlag_mm"])].copy()
    wp = w.pivot_table(index=["datum", "ebene_2"], columns="kennzahl_id", values="wert",
                       aggfunc="mean").reset_index()
    weather = [{"d": r["datum"].strftime("%Y-%m-%d"), "s": r["ebene_2"],
                "tmean": round(float(r.get("temperatur_c", 0)), 1),
                "tmin": round(float(r.get("temperatur_min_c", 0)), 1),
                "tmax": round(float(r.get("temperatur_max_c", 0)), 1),
                "prec": round(float(r.get("niederschlag_mm", 0)), 1)} for _, r in wp.iterrows()]

    data = {"kpis": kpis, "rollen": rollen, "ebenen": service.ebenen_namen(hier), "orte": orte,
            "sales": sales, "costs": costs, "weather": weather,
            "dmin": f["datum"].min().strftime("%Y-%m-%d"), "dmax": f["datum"].max().strftime("%Y-%m-%d"),
            "ebene1": "Limonadenstände"}

    tpl = (WURZEL / "web" / "template.html").read_text(encoding="utf-8")
    html = tpl.replace("/*__DATA__*/", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    ziel = WURZEL / "web" / "cockpit.html"
    ziel.write_text(html, encoding="utf-8")
    print(f"{ziel} geschrieben · {len(sales)} Verkaufstage · {len(html)/1e6:.2f} MB")


if __name__ == "__main__":
    build()
