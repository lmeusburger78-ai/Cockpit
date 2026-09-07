"""Farb- und Layout-Vorgaben für alle Diagramme.

Die Palette ist auf Farbfehlsichtigkeit geprüft (dataviz-Methode): kategoriale
Farben in fester Reihenfolge (Identität), eine sequenzielle Blau-Rampe (Größe)
und feste Statusfarben für die Ampel. Jede Kennzahl behält über alle Diagramme
dieselbe Farbe.
"""
from __future__ import annotations

# Kategoriale Palette (feste Reihenfolge, nie zyklisch weiterzählen)
KATEGORIAL = [
    "#2a78d6",  # blau
    "#eb6834",  # orange
    "#1baf7a",  # aqua
    "#eda100",  # gelb
    "#e87ba4",  # magenta
    "#008300",  # grün
    "#4a3aa7",  # violett
    "#e34948",  # rot
]

# Sequenzielle Blau-Rampe (hell -> dunkel) für Größenvergleiche
SEQUENZIELL = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]

# Feste Ampel-/Statusfarben – niemals als Serienfarbe missbrauchen
STATUS = {
    "gruen": "#0ca30c",
    "gelb": "#fab219",
    "rot": "#d03b3b",
    "neutral": "#898781",
}
STATUS_SYMBOL = {"gruen": "●", "gelb": "●", "rot": "●", None: "○"}

# Chrome / Text (heller Modus – die App läuft im hellen Streamlit-Theme)
SURFACE = "#fcfcfb"
PLANE = "#f9f9f7"
INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
AXIS = "#c3c2b7"

FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'


def layout(titel: str, untertitel: str = "", hoehe: int = 420) -> dict:
    """Einheitliches Plotly-Layout mit vollständiger Beschriftung."""
    kopf = titel if not untertitel else f"{titel}<br><span style='font-size:13px;color:{INK2}'>{untertitel}</span>"
    return dict(
        title=dict(text=kopf, font=dict(size=18, color=INK, family=FONT), x=0, xanchor="left", y=0.94, yanchor="top"),
        font=dict(family=FONT, color=INK2, size=13),
        paper_bgcolor=SURFACE,
        plot_bgcolor=SURFACE,
        height=hoehe,
        margin=dict(l=70, r=30, t=86, b=55),
        xaxis=dict(gridcolor=GRID, linecolor=AXIS, zerolinecolor=AXIS, title_font=dict(color=INK2, size=13)),
        yaxis=dict(gridcolor=GRID, linecolor=AXIS, zerolinecolor=AXIS, title_font=dict(color=INK2, size=13)),
        legend=dict(font=dict(color=INK2, size=12), bgcolor="rgba(0,0,0,0)"),
        hoverlabel=dict(font=dict(family=FONT, size=13)),
        colorway=KATEGORIAL,
    )


def eur(x: float) -> str:
    return f"{x:,.0f} €".replace(",", ".")


def zahl(x: float, einheit: str = "") -> str:
    if abs(x) >= 100:
        s = f"{x:,.0f}".replace(",", ".")
    else:
        s = f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} {einheit}".strip()
