# Das Cockpit in eine bestehende Seite einbauen

Drei Wege, von risikoarm nach aufwändig. Lies erst den Abschnitt „Was
kollidieren kann" — der entscheidet, welcher Weg für dich der richtige ist.

---

## Weg 1 · Als iframe einbetten (empfohlen)

```html
<iframe src="limonaden-cockpit.html"
        style="width:100%;height:900px;border:0"
        title="Prozesscockpit"></iframe>
```

Datei neben deine Seite legen, fertig. Der iframe ist ein eigenes Dokument:
**Nichts kann kollidieren** — weder CSS noch Skripte noch IDs. Das Cockpit bringt
seine eigene Hell/Dunkel-Umschaltung mit und ist bis 320 px responsiv.

Der einzige Nachteil: Das Cockpit weiß nichts von der umgebenden Seite. Für ein
Dashboard, das ohnehin für sich steht, ist das kein Verlust — und du sparst dir
jede Aufräumarbeit.

Höhe: Ein festes `height` ist am unkompliziertesten. Automatische Höhe braucht
`postMessage` zwischen den Dokumenten; sag Bescheid, wenn du das brauchst.

---

## Weg 2 · Direkt in eine Seite hineinkopieren

Wenn das Cockpit Teil deiner Seite werden soll, statt darin zu wohnen:

1. Aus `limonaden-cockpit.html` alles zwischen `<body>` und `</body>` übernehmen.
2. Den `<style>`-Block und den Schrift-`<link>` aus dem `<head>` mitnehmen.
3. Vorher **umbenennen** — siehe unten, sonst zerlegt es dir eine der beiden Seiten.

`limonaden-cockpit.artifact.html` ist genau diese Fassung schon fertig: dieselbe
Seite ohne eigenes `<html>`/`<head>`/`<body>`, Titel und Styles oben im Inhalt.
Als Ausgangspunkt zum Kopieren ist die bequemer als die vollständige Datei.

---

## Weg 3 · Aus den Quellen bauen

```
src/cockpit.html   Grundgerüst: Deckfolie, Command-Bar, Drawer, Hilfe
src/style.css      alle Styles und Design-Tokens
src/data.js        die Beispieldaten (F = {...})
src/app.js         Rechenkern, Diagramme, Rendering
build.js           fügt die vier zu einer Datei zusammen
```

```bash
node build.js              # → limonaden-cockpit.html
node build.js --artifact   # zusätzlich die Fassung ohne Dokument-Hülle
```

So kannst du gezielt Teile herauslösen — etwa nur den Analyse-Reiter oder nur den
Rechenkern. `app.js` ist in Abschnitte gegliedert, die Nummern stehen in `README.md`.

---

## Was kollidieren kann

Beim Einbetten per iframe: **nichts**. Bei Weg 2 und 3 sind es drei Stellen.

### 1. CSS-Klassennamen — das größte Risiko

Die Styles sind nicht abgeschottet. Diese Namen sind so allgemein, dass fast jede
Webseite sie ebenfalls benutzt:

```
.card  .tab  .btn  .chip  .chips  .pill  .modal  .sheet  .user  .login
.check  .drop  .steps  .progress  .split  .legend  .finding  .weather
```

Trifft `.card` aus deiner Seite auf `.card` aus dem Cockpit, gewinnt die zuletzt
geladene Regel — und zerlegt eine der beiden Ansichten.

**Zwei Auswege.** Entweder alles mit einem Präfix versehen (`.lc-card`, `.lc-tab`)
— das betrifft `style.css` *und* die Klassennamen in `app.js` und `cockpit.html`.
Oder du hängst alles unter einen Wurzel-Container:

```html
<div class="limo-cockpit"> … Inhalt … </div>
```

```css
.limo-cockpit .card { … }   /* jede Regel bekommt den Vorsatz */
```

Der zweite Weg ist schneller, macht die Selektoren aber spezifischer — was gegen
deine eigenen Styles gewinnt, gelegentlich unerwünscht.

### 2. Element-IDs

Vergeben sind unter anderem `#app`, `#deck`, `#content`, `#drawer`, `#modal`,
`#scrim`, `#username`. Besonders `#app` und `#content` haben viele Seiten schon.
IDs müssen im Dokument eindeutig sein; doppelte führen dazu, dass das Cockpit die
falschen Elemente anspricht. Beim Umbenennen `cockpit.html` und `app.js` gemeinsam
anpassen.

### 3. Der Name `F`

`data.js` legt die Daten unter `F` ab — ein einzelner Großbuchstabe im globalen
Namensraum. Falls deine Seite ebenfalls ein `F` kennt, überschreibt eines das
andere. Umbenennen (etwa in `LIMO_DATA`) betrifft `data.js` und `app.js`.

**Sonst ist nichts global.** `app.js` steckt vollständig in einer IIFE, am `window`
hängt kein einziger Wert. Nach diesen drei Punkten ist die Luft rein.

---

## Was das Cockpit von außen braucht

- **Google Fonts** für IBM Plex Sans. Nicht erreichbar? Dann greift `system-ui`,
  die Seite bleibt benutzbar, sieht nur anders aus.
- **Sonst nichts.** Keine Chart-Bibliothek, kein Framework, kein Build-Schritt,
  kein Server. Die Diagramme sind natives SVG.
- **Nur beim Excel-Upload** wird `xlsx` einmalig von jsdelivr nachgeladen. Ohne
  Netz bleiben die eingebauten Beispieldaten, alles andere läuft weiter.
- **`localStorage`** für Theme, Rolle, Ampel-Schwellen und die Checklisten-Häkchen.
  Nicht verfügbar? Dann startet die Seite jedes Mal frisch, ohne Fehler.

---

## Zwei Punkte vor dem Produktivgang

**Die Anmeldung ist Deko.** Benutzername und Kennwort werden nicht geprüft, jede
Eingabe kommt durch. Wer die Seite erreicht, sieht alles. Das ist Absicht und für
eine Demo mit erfundenen Zahlen richtig — mit echten Geschäftsdaten braucht es
davor eine echte Zugangskontrolle, und die kann nur ein Backend leisten.

**Die Rollen sind Ansichten, keine Rechte.** „Standleitung sieht nur den eigenen
Stand" steuert, was angezeigt wird. Die Daten für alle Standorte stecken trotzdem
in der Datei und sind im Quelltext lesbar. Für echte Mandantentrennung müssen die
Daten vom Server kommen, gefiltert nach dem angemeldeten Benutzer.
