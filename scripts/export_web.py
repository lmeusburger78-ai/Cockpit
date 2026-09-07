"""Erzeugt die statische Cockpit-Website (web/cockpit.html) aus den echten Daten.

Alle Rollen-Sichten und Drill-Pfade werden vorberechnet und als JSON in das
HTML-Template (web/template.html) eingebettet. Die Seite ist danach ohne Server
lauffähig (Plotly.js von cdnjs). Aufruf: python scripts/export_web.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from cockpit import service  # noqa: E402

WURZEL = Path(__file__).resolve().parent.parent


def clean(df):
    if df is None or len(df) == 0:
        return []
    d = df.copy()
    for c in d.columns:
        if pd.api.types.is_datetime64_any_dtype(d[c]):
            d[c] = d[c].dt.strftime("%Y-%m-%d")
    return json.loads(d.astype(object).where(pd.notna(d), None).to_json(orient="records"))


def kostenarten(f, pfad, rolle):
    d = f[f.kennzahl_id == "kosten_eur"].copy()
    start = int(rolle["start_ebene"])
    filt = dict(rolle.get("filter") or {})
    for i, k in enumerate(pfad):
        filt[f"ebene_{start + 1 + i}"] = k
    for sp, w in filt.items():
        if sp in d.columns:
            d = d[d[sp] == w]
    if d.empty:
        return {}
    reihe = d.groupby("ebene_3")["wert"].sum().sort_values(ascending=False)
    return {str(k): round(float(v), 2) for k, v in reihe.items()}


def build():
    store = service.store_mit_beispiel()
    f = store.lade()
    kpis, rollen, hier = service.konfig()
    orte = service.standort_orte()
    data = {"kpis": kpis, "rollen": rollen, "ebenen": service.ebenen_namen(hier),
            "orte": orte, "nodes": {}}

    def nk(p):
        return "|".join(p) if p else "_"

    def add(rk):
        r = rollen[rk]
        start, maxe = int(r["start_ebene"]), int(r["max_ebene"])
        hat_kosten = {"umsatz_eur", "kosten_eur"} <= set(r["kennzahlen"])

        def rec(pfad):
            ebene = start + len(pfad)
            filt = dict(r.get("filter") or {})
            for i, k in enumerate(pfad):
                filt[f"ebene_{start + 1 + i}"] = k
            kach = service.kachel_werte(f, kpis, r, tuple(pfad))
            kinder, names = [], []
            if ebene < maxe:
                kd = service.naechste_knoten(f, kpis, r, tuple(pfad))
                ke = f"ebene_{ebene + 1}"
                if not kd.empty and ke in kd.columns:
                    biz = [c for c in kpis if c in kd.columns]
                    kd = kd.dropna(subset=biz, how="all")
                    cols = [c for c in kd.columns if c.startswith("ebene_") or c in kpis or c.endswith("_ampel")]
                    kinder = clean(kd[cols])
                    names = sorted(kd[ke].dropna().unique().tolist())
            try:
                monat = clean(service.sicht(f, kpis, {"_": r}, "_", tuple(pfad), nach_monat=True))
            except Exception:
                monat = []
            std = filt.get("ebene_2")
            g = service.verdichte(f, kpis, ebene, filt, nach_monat=False)
            umsatz = (float(g["umsatz_eur"].iloc[0]) if not g.empty and "umsatz_eur" in g
                      and pd.notna(g["umsatz_eur"].iloc[0]) else None)
            wf = ({"umsatz": umsatz, "kostenarten": kostenarten(f, pfad, r)}
                  if hat_kosten and umsatz and ebene <= 2 else None)
            wt = service.wetter_taeglich(f, std)
            prod = service.produkt_mengen(f, r, tuple(pfad))
            tu = service.taeglicher_umsatz(f, r, tuple(pfad)) if std else None
            data["nodes"][f"{rk}/{nk(pfad)}"] = {
                "rolle": rk, "pfad": pfad, "ebene": ebene, "kann_tiefer": ebene < maxe,
                "titel": (pfad[-1] if pfad else "Gesamt"),
                "kennzahlen": [k for k in r["kennzahlen"] if k in kpis],
                "kacheln": [{**k, "wert": (None if pd.isna(k["wert"]) else float(k["wert"])),
                             "delta_pct": (None if k["delta_pct"] is None else float(k["delta_pct"]))}
                            for k in kach],
                "kinder": kinder, "kinder_names": names, "kind_ebene": f"ebene_{ebene + 1}",
                "monat": monat, "waterfall": wf,
                "produkte": clean(prod), "taeglich_umsatz": clean(tu),
                "wetter": {"std": std, "ort": (orte.get(std, {}).get("ort") if std else None),
                           "kennzahlen": [{**w, "wert": float(w["wert"])}
                                          for w in service.wetter_kennzahlen(f, kpis, std)],
                           "taeglich": clean(wt)}}
            for k in names:
                rec(pfad + [k])
        rec([])

    for rk in rollen:
        add(rk)

    tpl = (WURZEL / "web" / "template.html").read_text(encoding="utf-8")
    html = tpl.replace("/*__DATA__*/", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    ziel = WURZEL / "web" / "cockpit.html"
    ziel.write_text(html, encoding="utf-8")
    print(f"{ziel} geschrieben · {len(data['nodes'])} Knoten · {len(html)/1e6:.2f} MB")


if __name__ == "__main__":
    build()
