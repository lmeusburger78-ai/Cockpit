"""Verpackt die generierte Website (web/cockpit.html) in eine eigenständige
index.html für GitHub Pages.

web/cockpit.html enthaelt nur den Seiteninhalt (Titel, Styles, Body, Skripte)
ohne <!doctype>/<html>/<head>. Fuer eine normal ausgelieferte Webseite braucht
es diese Huelle mit Charset und Viewport – Plotly wird darin ganz normal per CDN
geladen (kein CSP-Sandbox wie beim Claude-Artifact).

Aufruf (nach scripts/export_web.py):  python scripts/build_pages.py
"""
from __future__ import annotations

from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent


def build() -> Path:
    inhalt = (WURZEL / "web" / "cockpit.html").read_text(encoding="utf-8")
    doc = (
        "<!doctype html>\n<html lang=\"de\">\n<head>\n"
        "<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
        "<style>:root{color-scheme:light dark}body{margin:0}"
        "img{max-width:100%}[hidden]{display:none!important}</style>\n"
        "</head>\n<body>\n" + inhalt + "\n</body>\n</html>\n"
    )
    out = WURZEL / "public"
    out.mkdir(exist_ok=True)
    (out / "index.html").write_text(doc, encoding="utf-8")
    (out / ".nojekyll").write_text("", encoding="utf-8")  # GitHub Pages: kein Jekyll
    print(f"public/index.html geschrieben · {len(doc)/1_048_576:.2f} MB")
    return out / "index.html"


if __name__ == "__main__":
    build()
