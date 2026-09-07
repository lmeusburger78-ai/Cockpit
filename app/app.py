"""Prozess-Cockpit – Streamlit-Oberfläche.

Rolle links wählen, oben per Breadcrumb navigieren, unten per Klick auf einen
Knoten tiefer gehen (Drill-Down). Jede Rolle sieht nur ihre Kennzahlen und nur
ihren Ausschnitt der Hierarchie, verdichtet bis zu ihrer erlaubten Tiefe.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cockpit import charts, service, theme  # noqa: E402

st.set_page_config(page_title="Prozess-Cockpit", page_icon="📊", layout="wide")

# ---- kleine Stil-Ergänzungen für die KPI-Kacheln ----
st.markdown(f"""
<style>
.block-container {{padding-top: 2rem; max-width: 1400px;}}
.kpi {{background:{theme.SURFACE}; border:1px solid rgba(11,11,11,.10); border-radius:12px;
       padding:16px 18px; height:100%;}}
.kpi .label {{color:{theme.INK2}; font-size:13px; margin-bottom:6px;}}
.kpi .value {{color:{theme.INK}; font-size:30px; font-weight:600; line-height:1.1;}}
.kpi .unit {{color:{theme.MUTED}; font-size:15px; font-weight:500;}}
.kpi .delta {{font-size:13px; margin-top:6px;}}
.kpi .dot {{font-size:15px; margin-right:6px;}}
.crumb {{color:{theme.INK2}; font-size:14px;}}
</style>
""", unsafe_allow_html=True)


def _filter(rolle: dict, pfad: tuple[str, ...]) -> dict:
    """Baut den Hierarchie-Filter der Rolle für den aktuellen Pfad."""
    start = int(rolle["start_ebene"])
    filt = dict(rolle.get("filter") or {})
    for i, knoten in enumerate(pfad):
        filt[f"ebene_{start + i}"] = knoten
    return filt


def _kostenarten(fakten: pd.DataFrame, rolle: dict, pfad: tuple[str, ...]) -> dict[str, float]:
    """Summe je Kostenart (ebene_3 der Ausgaben) unter dem aktuellen Knoten –
    für den GuV-Wasserfall. Nur sinnvoll bis zur Standort-Ebene."""
    d = fakten[fakten["kennzahl_id"] == "kosten_eur"].copy()
    for sp, w in _filter(rolle, pfad).items():
        if sp in d.columns:
            d = d[d[sp] == w]
    if d.empty:
        return {}
    reihe = d.groupby("ebene_3")["wert"].sum().sort_values(ascending=False)
    return {str(k): float(v) for k, v in reihe.items()}


@st.cache_resource
def _store():
    return service.store_mit_beispiel()


@st.cache_data
def _fakten(_stand: float) -> pd.DataFrame:
    return _store().lade()


def _reload():
    _fakten.clear()


kpis, rollen, hierarchie = service.konfig()
store = _store()
fakten = _fakten(store.quellen()["geladen_am"].max() if not store.quellen().empty else 0)
ebenen_namen = service.ebenen_namen(hierarchie)

# ----------------------------------------------------------------- Sidebar
with st.sidebar:
    st.markdown("### 📊 Prozess-Cockpit")
    rolle_key = st.selectbox(
        "Adressat / Rolle", list(rollen), format_func=lambda k: rollen[k].get("beschreibung", k),
    )
    rolle = rollen[rolle_key]
    st.caption(rolle.get("beschreibung", ""))
    st.divider()

    q = store.quellen()
    st.markdown("**Datenquellen**")
    if q.empty:
        st.info("Noch keine Daten geladen.")
    else:
        for _, r in q.iterrows():
            info = f"{r['fakten']:,} Fakten · {r['von']:%b %Y}–{r['bis']:%b %Y}".replace(",", ".")
            st.caption(f"📄 {r['quelle']}  \n{info}")

    with st.expander("＋ Excel hochladen"):
        st.caption("Format der Limonadenstände (Blätter „Bonierungen“ und „Ausgaben“).")
        datei = st.file_uploader("Datei", type=["xlsx"], label_visibility="collapsed")
        if datei is not None and st.button("Importieren", type="primary"):
            with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
                tmp.write(datei.getbuffer())
                tmp_pfad = tmp.name
            bericht = service.importiere(tmp_pfad, "limonadenstaende", store)
            if bericht.ok:
                st.success(f"{bericht.zeilen:,} Fakten importiert.".replace(",", "."))
                _reload()
                st.rerun()
            else:
                st.error("Import abgelehnt:")
                st.code(bericht.text())

# ----------------------------------------------------------------- Navigation
st.session_state.setdefault("pfad", {})
pfad = tuple(st.session_state["pfad"].get(rolle_key, ()))
start = int(rolle["start_ebene"])
max_ebene = int(rolle["max_ebene"])
ebene = start + len(pfad)


def setze_pfad(neu: tuple[str, ...]):
    st.session_state["pfad"][rolle_key] = neu
    st.rerun()


# Breadcrumb
namen = ["Gesamt", *[f"{ebenen_namen.get(start + i, '')}: {k}" for i, k in enumerate(pfad)]]
spalten = st.columns([1] * len(namen) + [6])
for i, (sp, name) in enumerate(zip(spalten, namen)):
    if sp.button(name, key=f"crumb{i}", use_container_width=True):
        setze_pfad(pfad[:i])

titel_ort = "Gesamt" if not pfad else pfad[-1]
ebene_name = ebenen_namen.get(ebene, f"Ebene {ebene}")
st.markdown(f"## {titel_ort}")
st.caption(f"Sicht **{rolle.get('beschreibung', rolle_key)}** · Ebene {ebene} ({ebene_name})")

# ----------------------------------------------------------------- KPI-Kacheln
kacheln = service.kachel_werte(fakten, kpis, rolle, pfad)
if kacheln:
    cols = st.columns(min(len(kacheln), 4))
    for i, k in enumerate(kacheln):
        with cols[i % len(cols)]:
            farbe = theme.STATUS.get(k["ampel"], "transparent")
            wert_txt = charts._fmt(k["wert"], k["id"]).rsplit(" ", 1)
            zahl_txt = wert_txt[0]
            einh = k["einheit"]
            delta_html = ""
            if k["delta_pct"] is not None:
                gut = (k["delta_pct"] >= 0) == (k["richtung"] == "groesser_ist_besser")
                dfarbe = theme.STATUS["gruen"] if gut else theme.STATUS["rot"]
                pfeil = "▲" if k["delta_pct"] >= 0 else "▼"
                delta_html = (f"<div class='delta' style='color:{dfarbe}'>{pfeil} "
                              f"{abs(k['delta_pct']):.1f} % ggü. Vormonat</div>".replace(".", ","))
            dot = f"<span class='dot' style='color:{farbe}'>●</span>" if k["ampel"] else ""
            st.markdown(
                f"<div class='kpi'><div class='label'>{dot}{k['name']}</div>"
                f"<div class='value'>{zahl_txt} <span class='unit'>{einh}</span></div>"
                f"{delta_html}</div>", unsafe_allow_html=True)
else:
    st.info("Für diesen Knoten liegen keine Kennzahlen vor.")

# Wetter-Kontext: je Markt im Drill-Down, sonst über alle Märkte gemittelt
_std = _filter(rolle, pfad).get("ebene_2")
_orte = service.standort_orte()
_ort_label = f" ({_orte[_std]['ort']})" if _std in _orte else ""
wetter_kz = service.wetter_kennzahlen(fakten, kpis, _std)
if wetter_kz:
    teile = " · ".join(f"{w['name']} {theme.zahl(w['wert'], w['einheit'])}" for w in wetter_kz)
    _wo = f"Markt {_std}{_ort_label}" if _std else "alle Märkte gemittelt"
    st.caption(f"🌤️ Wetter im Zeitraum ({_wo}): {teile}")

st.write("")

# ----------------------------------------------------------------- Diagramme
kann_tiefer = ebene < max_ebene
kinder = service.naechste_knoten(fakten, kpis, rolle, pfad) if kann_tiefer else pd.DataFrame()
kind_ebene = f"ebene_{ebene + 1}"
kind_name = ebenen_namen.get(ebene + 1, "Knoten")
PLOT = {"displayModeBar": False}
hat_kinder = kann_tiefer and not kinder.empty and kind_ebene in kinder.columns

st.markdown(f"### Aufteilung nach {kind_name}" if hat_kinder else "### Verlauf")

if hat_kinder:
    # Leitkennzahl der Rolle (für Ranking und Kuchen dieselbe Farbe je Knoten)
    leit = next((k for k in rolle["kennzahlen"] if k in kinder.columns), "umsatz_eur")
    kdef = kpis.get(leit, {"name": leit})
    links, rechts = st.columns(2)
    with links:
        st.plotly_chart(
            charts.ranking(kinder, leit, kdef, kind_ebene,
                           f"{kdef['name']} nach {kind_name}", "größter Wert oben"),
            use_container_width=True, config=PLOT)
    with rechts:
        # Kuchen-/Donut: Anteil je Knoten an der Gesamtsumme
        kuchen_kid = "umsatz_eur" if "umsatz_eur" in kinder.columns else leit
        kkdef = kpis.get(kuchen_kid, {"name": kuchen_kid})
        st.plotly_chart(
            charts.kuchen(kinder, kind_ebene, kuchen_kid, f"{kkdef['name']} gesamt",
                          f"{kkdef['name']}-Anteile je {kind_name}", "Segmentgröße = Anteil am Ganzen"),
            use_container_width=True, config=PLOT)
else:
    # Unterste erlaubte Ebene: Verlauf über die Monate
    leit = next((k for k in rolle["kennzahlen"] if k in fakten["kennzahl_id"].values), "umsatz_eur")
    kdef = kpis.get(leit, {"name": leit})
    monat = service.sicht(fakten, kpis, {"_": rolle}, "_", pfad, nach_monat=True)
    if not monat.empty and leit in monat.columns:
        gruppe = f"ebene_{ebene}" if f"ebene_{ebene}" in monat.columns else "ebene_1"
        st.plotly_chart(
            charts.trend(monat, leit, kdef, gruppe,
                         f"{kdef.get('name', leit)} über die Monate", f"{titel_ort} · unterste Ebene dieser Rolle"),
            use_container_width=True, config=PLOT)

# GuV-Wasserfall über die volle Breite, wenn Umsatz und Kosten sichtbar sind
if {"umsatz_eur", "kosten_eur"} <= set(rolle["kennzahlen"]):
    g = service.verdichte(fakten, kpis, ebene, _filter(rolle, pfad), nach_monat=False)
    arten = _kostenarten(fakten, rolle, pfad)
    if not g.empty and pd.notna(g["umsatz_eur"].iloc[0]) and arten:
        st.markdown("### Ergebnisrechnung")
        st.plotly_chart(
            charts.guv_wasserfall(float(g["umsatz_eur"].iloc[0]), arten,
                                  "Umsatz minus Kostenarten ergibt das Ergebnis",
                                  f"{titel_ort} · Gesamtzeitraum"),
            use_container_width=True, config=PLOT)

# ----------------------------------------------------------------- Wetter-Panel
wetter = service.wetter_taeglich(fakten, _std)
if not wetter.empty:
    st.markdown("### Wetter (Kontext)")
    if _std:
        st.caption(f"Wetter am Markt **{_std}{_ort_label}** – zum Abgleich mit dem "
                   "Absatz dieses Standorts (z. B. Regentage gegen Umsatz).")
        panel_unter = f"Markt {_std}{_ort_label} · Zeitraum der geladenen Daten"
    else:
        st.caption("Über alle Märkte gemittelt. Für das Wetter eines einzelnen Marktes "
                   "in einen Standort hineinklicken – dort erscheint dessen eigenes Wetter.")
        panel_unter = "alle Märkte gemittelt · Zeitraum der geladenen Daten"
    st.plotly_chart(
        charts.wetter_panel(wetter, "Temperatur und Niederschlag je Tag", panel_unter),
        use_container_width=True, config=PLOT)

# ----------------------------------------------------------------- Drill-Down-Knöpfe
if kann_tiefer and not kinder.empty and kind_ebene in kinder.columns:
    st.write("")
    st.markdown(f"**Tiefer zu einzelnem Knoten ({ebenen_namen.get(ebene + 1, '')})**")
    knoten = sorted(kinder[kind_ebene].dropna().unique())
    reihen = [knoten[i:i + 6] for i in range(0, len(knoten), 6)]
    for reihe in reihen:
        cols = st.columns(6)
        for sp, k in zip(cols, reihe):
            if sp.button(f"↳ {k}", key=f"dd_{k}", use_container_width=True):
                setze_pfad(pfad + (k,))

# ----------------------------------------------------------------- Tabelle + Einzeldaten
with st.expander("Tabelle und Einzeldaten dieses Knotens"):
    tab = service.sicht(fakten, kpis, {"_": rolle}, "_", pfad, nach_monat=True)
    st.dataframe(tab, use_container_width=True, hide_index=True)
    if not kann_tiefer or ebene == max_ebene:
        filt = _filter(rolle, pfad)
        einzel = fakten.copy()
        for sp, w in filt.items():
            einzel = einzel[einzel[sp] == w]
        st.caption("Einzelfakten mit Quelle (rückverfolgbar bis zur Excel-Zeile):")
        st.dataframe(einzel.head(200)[["datum", "kennzahl_id", "wert", *service.EBENEN,
                                       "quelle", "quelle_zeile"]],
                     use_container_width=True, hide_index=True)
