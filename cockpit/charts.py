"""Plotly-Diagramme für das Cockpit – jedes mit Titel, Achsentiteln (inkl.
Einheit), Legende bei mehreren Serien, direkter Beschriftung der Werte und
Ampelfarben, wo eine Kennzahl eine Ampel hat.

Formwahl nach der Aufgabe der Daten:
- Rangfolge/Magnitude je Knoten -> horizontaler Balken (sequenziell oder Ampel)
- Verlauf über Zeit           -> Linien (kategorial je Knoten)
- Ergebnisrechnung            -> Wasserfall (Umsatz -> Kosten -> Ergebnis)
- Anteil am Ganzen / Hierarchie -> Treemap
"""
from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from cockpit import theme
from cockpit.aggregate import ampel as ampel_farbe

EINHEIT = {
    "umsatz_eur": "€", "kosten_eur": "€", "ergebnis_eur": "€", "bonwert_eur": "€",
    "becher": "Stk", "transaktionen": "Bons", "wartezeit_min": "Min.",
    "zufriedenheit": "1–5", "umsatzrendite_pct": "%",
}


def _fmt(wert: float, kid: str) -> str:
    e = EINHEIT.get(kid, "")
    if e == "€":
        return theme.eur(wert)
    if e == "%":
        return f"{wert:,.1f} %".replace(".", ",")
    if e in ("Stk", "Bons"):
        return f"{wert:,.0f}".replace(",", ".") + f" {e}"
    return f"{wert:,.2f}".replace(".", ",") + (f" {e}" if e else "")


def ranking(df: pd.DataFrame, kid: str, kdef: dict, label_spalte: str,
            titel: str, untertitel: str = "") -> go.Figure:
    """Horizontales Balkendiagramm: eine Kennzahl je Knoten, größter oben.

    Hat die Kennzahl eine Ampel, tragen die Balken die Ampelfarbe; sonst die
    sequenzielle Blau-Rampe (dunkler = größer)."""
    d = df[[label_spalte, kid]].dropna(subset=[kid]).sort_values(kid)
    hat_ampel = "ampel" in kdef
    if hat_ampel:
        farben = [theme.STATUS.get(ampel_farbe(v, kdef), theme.MUTED) for v in d[kid]]
    else:
        lo, hi = d[kid].min(), d[kid].max()
        rampe = theme.SEQUENZIELL[2:]
        farben = [rampe[min(int((v - lo) / (hi - lo + 1e-9) * (len(rampe) - 1)), len(rampe) - 1)]
                  for v in d[kid]]
    fig = go.Figure(go.Bar(
        x=d[kid], y=d[label_spalte], orientation="h", marker=dict(color=farben),
        text=[_fmt(v, kid) for v in d[kid]], textposition="outside",
        textfont=dict(color=theme.INK2, size=12),
        hovertemplate="%{y}<br>" + kdef.get("name", kid) + ": %{text}<extra></extra>",
        cliponaxis=False,
    ))
    lay = theme.layout(titel, untertitel, hoehe=max(260, 60 + 42 * len(d)))
    lay["xaxis"]["title"] = f"{kdef.get('name', kid)} ({EINHEIT.get(kid, '')})"
    lay["showlegend"] = False
    fig.update_layout(lay)
    fig.update_xaxes(rangemode="tozero")
    return fig


def trend(df: pd.DataFrame, kid: str, kdef: dict, knoten_spalte: str,
          titel: str, untertitel: str = "") -> go.Figure:
    """Linien über die Monate, eine Linie je Knoten. Endpunkte direkt beschriftet."""
    fig = go.Figure()
    knoten = list(dict.fromkeys(df[knoten_spalte]))
    for i, k in enumerate(knoten):
        d = df[df[knoten_spalte] == k].sort_values("periode")
        farbe = theme.KATEGORIAL[i % len(theme.KATEGORIAL)]
        fig.add_trace(go.Scatter(
            x=d["periode"], y=d[kid], mode="lines+markers", name=str(k),
            line=dict(color=farbe, width=2), marker=dict(size=8, color=farbe,
                     line=dict(color=theme.SURFACE, width=2)),
            hovertemplate=f"{k}<br>%{{x}}<br>" + kdef.get("name", kid)
                          + ": %{customdata}<extra></extra>",
            customdata=[_fmt(v, kid) for v in d[kid]],
        ))
        letzte = d.iloc[-1]
        fig.add_annotation(x=letzte["periode"], y=letzte[kid], text=f"  {k}",
                           showarrow=False, xanchor="left", font=dict(color=theme.INK2, size=11))
    lay = theme.layout(titel, untertitel)
    lay["xaxis"]["title"] = "Monat"
    lay["yaxis"]["title"] = f"{kdef.get('name', kid)} ({EINHEIT.get(kid, '')})"
    lay["showlegend"] = len(knoten) > 1
    lay["margin"]["r"] = 90
    fig.update_layout(lay)
    fig.update_xaxes(type="category")
    return fig


def guv_wasserfall(umsatz: float, kostenarten: dict[str, float], titel: str,
                   untertitel: str = "") -> go.Figure:
    """Wasserfall: Umsatz minus einzelne Kostenarten ergibt das Ergebnis."""
    namen = ["Umsatz"] + list(kostenarten) + ["Ergebnis"]
    werte = [umsatz] + [-v for v in kostenarten.values()] + [umsatz - sum(kostenarten.values())]
    messung = ["absolute"] + ["relative"] * len(kostenarten) + ["total"]
    fig = go.Figure(go.Waterfall(
        orientation="v", measure=messung, x=namen, y=werte,
        text=[theme.eur(abs(v)) for v in werte], textposition="outside",
        textfont=dict(color=theme.INK2, size=11),
        connector=dict(line=dict(color=theme.AXIS, width=1)),
        increasing=dict(marker=dict(color=theme.KATEGORIAL[0])),
        decreasing=dict(marker=dict(color=theme.KATEGORIAL[1])),
        totals=dict(marker=dict(color=theme.STATUS["gruen"])),
        hovertemplate="%{x}<br>%{text}<extra></extra>",
        cliponaxis=False,
    ))
    lay = theme.layout(titel, untertitel, hoehe=440)
    lay["yaxis"]["title"] = "Betrag (€)"
    lay["xaxis"]["title"] = ""
    lay["showlegend"] = False
    lay["margin"]["b"] = 90
    fig.update_layout(lay)
    fig.update_xaxes(tickangle=-30)
    return fig


def treemap(df: pd.DataFrame, pfad: list[str], wert: str, titel: str,
            untertitel: str = "") -> go.Figure:
    """Treemap über die Hierarchie: Kachelfläche = Wert (z. B. Umsatz).
    `pfad` ist die Liste der Ebenen-Spalten von oben nach unten."""
    d = df.dropna(subset=[wert]).copy()
    for sp in pfad:
        d[sp] = d[sp].fillna("(ohne)")
    fig = px.treemap(d, path=[px.Constant("Gesamt")] + pfad, values=wert,
                     color_discrete_sequence=theme.KATEGORIAL)
    fig.update_traces(
        texttemplate="<b>%{label}</b><br>%{value:,.0f} €<br>%{percentRoot}",
        marker=dict(line=dict(color=theme.SURFACE, width=2)),
        hovertemplate="%{label}<br>%{value:,.0f} €<br>Anteil gesamt: %{percentRoot}<extra></extra>",
        root_color=theme.PLANE,
    )
    lay = theme.layout(titel, untertitel, hoehe=460)
    fig.update_layout(lay)
    return fig

def kuchen(df: pd.DataFrame, label_spalte: str, wert: str, gesamt_label: str,
           titel: str, untertitel: str = "") -> go.Figure:
    """Kuchen-/Donut-Diagramm der Aufteilung einer Summe (z. B. Umsatz je Standort).
    Jedes Segment zeigt Name, Betrag und Anteil; in der Mitte steht die Gesamtsumme.
    Nur fuer Teil-zum-Ganzen mit wenigen Segmenten (<= 6)."""
    d = df.dropna(subset=[wert]).sort_values(wert, ascending=False)
    labels = d[label_spalte].astype(str).tolist()
    werte = d[wert].tolist()
    summe = sum(werte)
    farben = [theme.KATEGORIAL[i % len(theme.KATEGORIAL)] for i in range(len(labels))]
    fig = go.Figure(go.Pie(
        labels=labels, values=werte, hole=0.5, sort=False, direction="clockwise",
        marker=dict(colors=farben, line=dict(color=theme.SURFACE, width=2)),
        text=[f"{n}<br>{theme.eur(v)}" for n, v in zip(labels, werte)],
        texttemplate="%{text}<br>%{percent}", textposition="outside",
        textfont=dict(color=theme.INK2, size=12),
        hovertemplate="%{label}<br>%{value:,.0f} €<br>Anteil: %{percent}<extra></extra>",
        insidetextorientation="horizontal", automargin=True,
    ))
    fig.add_annotation(text=f"<b>{theme.eur(summe)}</b><br><span style='font-size:12px'>{gesamt_label}</span>",
                       showarrow=False, font=dict(color=theme.INK, size=17, family=theme.FONT),
                       x=0.5, y=0.5)
    lay = theme.layout(titel, untertitel, hoehe=520)
    lay["showlegend"] = False  # jedes Segment ist direkt beschriftet – Legende wäre doppelt
    lay["margin"] = dict(l=90, r=90, t=96, b=70)
    fig.update_layout(lay)
    return fig

def wetter_panel(taeglich: pd.DataFrame, titel: str, untertitel: str = "") -> go.Figure:
    """Wetter im Zeitraum: Temperatur als Linie (oben) und Niederschlag als
    Balken (unten) in zwei getrennten Achsen mit gemeinsamer Zeitachse – kein
    Dual-Axis. Beide Achsen tragen Titel mit Einheit."""
    d = taeglich.sort_values("datum")
    fig = make_subplots(rows=2, cols=1, shared_xaxes=True, vertical_spacing=0.08,
                        row_heights=[0.55, 0.45])
    fig.add_trace(go.Scatter(
        x=d["datum"], y=d["temperatur_c"], mode="lines", name="Temperatur",
        line=dict(color=theme.KATEGORIAL[1], width=2),
        hovertemplate="%{x|%d.%m.%Y}<br>%{y:.1f} °C<extra></extra>"), row=1, col=1)
    fig.add_trace(go.Bar(
        x=d["datum"], y=d["niederschlag_mm"], name="Niederschlag",
        marker=dict(color=theme.KATEGORIAL[0]),
        hovertemplate="%{x|%d.%m.%Y}<br>%{y:.1f} mm<extra></extra>"), row=2, col=1)
    lay = theme.layout(titel, untertitel, hoehe=440)
    lay.pop("xaxis", None)
    lay.pop("yaxis", None)
    lay["showlegend"] = False
    lay["margin"] = dict(l=70, r=30, t=86, b=55)
    fig.update_layout(lay)
    fig.update_yaxes(title_text="Temperatur (°C)", gridcolor=theme.GRID, linecolor=theme.AXIS,
                     title_font=dict(color=theme.INK2, size=13), row=1, col=1)
    fig.update_yaxes(title_text="Niederschlag (mm)", gridcolor=theme.GRID, linecolor=theme.AXIS,
                     title_font=dict(color=theme.INK2, size=13), rangemode="tozero", row=2, col=1)
    fig.update_xaxes(gridcolor=theme.GRID, linecolor=theme.AXIS, row=1, col=1)
    fig.update_xaxes(title_text="Datum", gridcolor=theme.GRID, linecolor=theme.AXIS,
                     title_font=dict(color=theme.INK2, size=13), row=2, col=1)
    return fig
