#!/usr/bin/env node
/* Baut aus src/ eine einzelne, offline lauffähige HTML-Datei.
   Aufruf: node app/build.js   →   app/limonaden-cockpit.html          */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "limonaden-cockpit.html");

const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");

const shell = read("cockpit.html");
const css = read("style.css");
const data = read("data.js");
const app = read("app.js");

// Ein </script> im Quelltext würde den umschließenden Script-Block beenden.
const guard = (s, name) => {
  if (/<\/script/i.test(s)) throw new Error(`${name} enthält "</script>" — bitte maskieren.`);
  return s;
};

const out = shell
  .replace("/* @@CSS@@ */", () => css)
  .replace("/* @@DATA@@ */", () => guard(data, "data.js"))
  .replace("/* @@APP@@ */", () => guard(app, "app.js"));

["@@CSS@@", "@@DATA@@", "@@APP@@"].forEach((m) => {
  if (out.includes(m)) throw new Error(`Platzhalter ${m} wurde nicht ersetzt.`);
});

fs.writeFileSync(OUT, out);
console.log(`✓ ${path.relative(process.cwd(), OUT)} — ${(out.length / 1024).toFixed(0)} KB`);

/* Artifact-Fassung: dieselbe Seite ohne eigenes <html>/<head>/<body>.
   Der Artifact-Dienst setzt das Gerüst selbst; Titel, Schrift-Link und Styles
   stehen dafür oben im Inhalt. Aufruf: node app/build.js --artifact          */
if (process.argv.includes("--artifact")) {
  const ART = path.join(__dirname, "limonaden-cockpit.artifact.html");
  const head = out.slice(out.indexOf("<head>") + 6, out.indexOf("</head>"));
  const body = out.slice(out.indexOf("<body>") + 6, out.lastIndexOf("</body>"));

  const keep = (re) => (head.match(re) || []).join("\n");
  const kopf = [
    keep(/<title>[\s\S]*?<\/title>/),
    keep(/<link rel="preconnect"[^>]*>/g),
    keep(/<link rel="stylesheet"[^>]*>/g),
    keep(/<style>[\s\S]*?<\/style>/),
  ].filter(Boolean).join("\n");

  /* In der Galerie steht die Seite neben vielen anderen — dort trägt ein kurzer
     Name besser als Firma plus Gattungsbezeichnung. */
  const art = kopf.replace(/<title>.*?<\/title>/, "<title>Limonaden Cockpit</title>") +
    "\n" + body.trim() + "\n";
  if (/<\/?(html|head|body)[\s>]/i.test(art)) throw new Error("Artifact enthält noch Dokument-Tags.");
  if (!art.includes("<title>")) throw new Error("Artifact hat keinen Titel.");
  fs.writeFileSync(ART, art);
  console.log(`✓ ${path.relative(process.cwd(), ART)} — ${(art.length / 1024).toFixed(0)} KB`);
}
