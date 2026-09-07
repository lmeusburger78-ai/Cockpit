"""Verdichtung (nach oben) und Rollen-Sicht (Drill-Down nach unten).

Kernidee: Die Fakt-Tabelle wird nach den Hierarchie-Spalten bis zur gewünschten
Ebene gruppiert. Die Regel je Kennzahl (sum, weighted_mean, ...) kommt aus
config/kpis.yaml. Abgeleitete Kennzahlen (Quotienten, Differenzen) werden
danach auf der verdichteten Ebene neu gerechnet.
"""
from __future__ import annotations

import pandas as pd

from cockpit.model import EBENEN


def ampel(wert: float, kdef: dict) -> str | None:
    """Liefert 'gruen' | 'gelb' | 'rot' nach den Schwellwerten der Kennzahl."""
    a = kdef.get("ampel")
    if not a or wert is None or pd.isna(wert):
        return None
    if kdef.get("richtung") == "kleiner_ist_besser":
        if wert <= a["gruen_bis"]:
            return "gruen"
        return "gelb" if wert <= a["gelb_bis"] else "rot"
    if wert >= a["gruen_ab"]:
        return "gruen"
    return "gelb" if wert >= a["gelb_ab"] else "rot"


def verdichte(fakten: pd.DataFrame, kpis: dict, ebene: int, filter: dict | None = None,
              nach_monat: bool = True) -> pd.DataFrame:
    """Verdichtet Fakten auf `ebene` (1 = oberste). Ergebnis: eine Zeile je Knoten
    (und Monat), eine Spalte je Kennzahl plus `<kennzahl>_ampel`."""
    df = fakten
    for spalte, wert in (filter or {}).items():
        df = df[df[spalte] == wert]
    gruppen = EBENEN[:ebene]
    if nach_monat:
        df = df.assign(periode=df["datum"].dt.to_period("M").astype(str))
        gruppen = gruppen + ["periode"]

    ergebnis: dict[str, pd.Series] = {}
    for kid, kdef in kpis.items():
        if "berechnet" in kdef or kdef.get("kontext") or ebene > int(kdef.get("gueltig_bis_ebene", 4)):
            continue
        teil = df[df["kennzahl_id"] == kid]
        if teil.empty:
            continue
        agg = kdef.get("aggregation", "sum")
        g = teil.groupby(gruppen, dropna=False)["wert"]
        if agg in ("sum", "mean", "min", "max"):
            ergebnis[kid] = getattr(g, agg)()
        elif agg == "last":
            ergebnis[kid] = teil.sort_values("datum").groupby(gruppen, dropna=False)["wert"].last()
        elif agg == "weighted_mean":
            gewicht = df[df["kennzahl_id"] == kdef["gewicht"]][["quelle", "quelle_zeile", "wert"]]
            gewicht = gewicht.rename(columns={"wert": "_g"})
            m = teil.merge(gewicht, on=["quelle", "quelle_zeile"], how="left")
            m["_g"] = m["_g"].fillna(1.0)
            m["_wg"] = m["wert"] * m["_g"]
            s = m.groupby(gruppen, dropna=False)[["_wg", "_g"]].sum()
            ergebnis[kid] = s["_wg"] / s["_g"]
        else:
            raise ValueError(f"Unbekannte Aggregation '{agg}' für {kid}")

    breit = pd.DataFrame(ergebnis)
    # Abgeleitete Kennzahlen: Summen-Kennzahlen ohne Wert zählen als 0 (kein Umsatz
    # ist 0 € Umsatz), Mittelwerte ohne Wert bleiben unbekannt. Quotienten durch 0
    # werden zu "unbekannt" statt zu unendlich.
    basis = breit.copy()
    for kid, kdef in kpis.items():
        if kid in basis.columns and kdef.get("aggregation", "sum") == "sum":
            basis[kid] = basis[kid].fillna(0.0)
    for kid, kdef in kpis.items():
        if "berechnet" not in kdef or ebene > int(kdef.get("gueltig_bis_ebene", 4)):
            continue
        try:
            wert = basis.eval(kdef["berechnet"])
        except (KeyError, ValueError, TypeError, pd.errors.UndefinedVariableError):
            wert = float("nan")
        basis[kid] = wert
        breit[kid] = pd.Series(wert, index=breit.index).replace([float("inf"), -float("inf")],
                                                                 float("nan"))
    breit = breit.reset_index()

    for kid, kdef in kpis.items():
        if "ampel" in kdef and kid in breit.columns:
            breit[f"{kid}_ampel"] = breit[kid].map(lambda w, k=kdef: ampel(w, k))
    return breit


def sicht(fakten: pd.DataFrame, kpis: dict, rollen: dict, rolle: str,
          pfad: tuple[str, ...] = (), nach_monat: bool = False) -> pd.DataFrame:
    """Rollen-Sicht mit Drill-Down.

    `pfad` sind die angeklickten Knoten unterhalb der Start-Ebene der Rolle:
    ()                    -> Einstiegs-Ebene der Rolle
    ("Limonadenstände",)  -> eine Ebene tiefer (z. B. alle Standorte)
    ("Limonadenstände", "Bahnhof") -> Produkte des Bahnhofs
    Tiefer als max_ebene der Rolle geht es nicht.
    """
    r = rollen[rolle]
    start = int(r["start_ebene"])
    ebene = start + len(pfad)
    if ebene > int(r["max_ebene"]):
        raise PermissionError(
            f"Rolle '{rolle}' darf nur bis Ebene {r['max_ebene']} (angefragt: {ebene})"
        )
    filt = dict(r.get("filter") or {})
    for i, knoten in enumerate(pfad):
        filt[f"ebene_{start + 1 + i}"] = knoten

    breit = verdichte(fakten, kpis, ebene, filt, nach_monat)
    schluessel = EBENEN[:ebene] + (["periode"] if nach_monat else [])
    kennzahlen = [k for k in r["kennzahlen"] if k in breit.columns]
    ampeln = [f"{k}_ampel" for k in kennzahlen if f"{k}_ampel" in breit.columns]
    breit = breit.dropna(subset=kennzahlen, how="all")
    return breit[schluessel + kennzahlen + ampeln].reset_index(drop=True)
