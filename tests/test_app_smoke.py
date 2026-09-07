"""Rendert die Streamlit-App in-process für jede Rolle und jeden Drill-Pfad und
stellt sicher, dass keine Ausnahme auftritt (kein laufender Server nötig)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from streamlit.testing.v1 import AppTest  # noqa: E402

from cockpit.config import lade_rollen  # noqa: E402

APP = str(Path(__file__).resolve().parent.parent / "app" / "app.py")


def _run(pfade: dict | None = None) -> AppTest:
    at = AppTest.from_file(APP, default_timeout=30)
    if pfade:
        at.session_state["pfad"] = pfade
    at.run()
    assert not at.exception, at.exception
    return at


def test_startet_ohne_fehler():
    at = _run()
    assert any("Prozess-Cockpit" in (m.value if hasattr(m, "value") else "") for m in at.markdown)


@pytest.mark.parametrize("rolle_key", list(lade_rollen()))
def test_jede_rolle_rendert(rolle_key):
    at = AppTest.from_file(APP, default_timeout=30)
    at.run()
    at.selectbox[0].set_value(rolle_key).run()
    assert not at.exception, (rolle_key, at.exception)


def test_drilldown_geschaeftsfuehrung():
    # Einstieg -> Standort Bahnhof
    at = _run({"geschaeftsfuehrung": ["Limonadenstände"]})
    assert not at.exception


def test_drilldown_standleitung_tief():
    at = _run({"standleitung_bahnhof": ["Bahnhof", "Orangensaft"]})
    assert not at.exception


def test_controlling_bis_unterste_ebene():
    at = _run({"controlling": ["Limonadenstände", "Bahnhof", "Orangensaft"]})
    assert not at.exception
