# Statische Website

Eine serverlose HTML-Fassung des Cockpits: alle Rollen-Sichten und Drill-Pfade
werden vorberechnet und ins Template eingebettet, die Diagramme rendert
Plotly.js (von cdnjs). Nützlich zum Teilen einer Momentaufnahme, ohne Streamlit
laufen zu lassen.

```bash
python scripts/export_web.py   # erzeugt web/cockpit.html aus der Beispiel-Excel
```

- `template.html` – Layout, Stil (IBM Plex), Interaktion (Rolle, Drill-Down,
  Diagramme, Wetter, Hilfe-Dialog zum Excel-Upload).
- `cockpit.html` – die fertige Seite (nicht in Git, da regenerierbar).

Die **laufende App** (mit echtem Upload) bleibt Streamlit: `streamlit run app/app.py`.
