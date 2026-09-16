/* ==========================================================================
   Limonaden GmbH · Prozesscockpit
   Rechenkern übernommen aus der bestehenden App, Darstellung nach dem
   Claude-Design-Handoff (Layout 1a "Terminal Dense" + Zahlen-Sprache 1b).
   Alle Diagramme sind natives SVG/HTML — keine Chart-Bibliothek, offline lauffähig.
   ========================================================================== */
(function () {
"use strict";

/* =========================== 1 · Konstanten =========================== */

var EINHEIT = {
  umsatz_eur: "€", kosten_eur: "€", ergebnis_eur: "€", bonwert_eur: "€",
  becher: "Stk", transaktionen: "Bons", wartezeit_min: "Min.", zufriedenheit: "1–5",
  umsatzrendite_pct: "%", temperatur_c: "°C", niederschlag_mm: "mm"
};

var GLOSS = {
  umsatz_eur: "Summe aller Verkäufe (Brutto-Umsatz) im Zeitraum.",
  ergebnis_eur: "Ergebnis = Umsatz − Kosten. Der Gewinn (oder Verlust) des Zeitraums.",
  umsatzrendite_pct: "Umsatzrendite = Ergebnis ÷ Umsatz. Wie viel Prozent vom Umsatz als Gewinn bleibt.",
  zufriedenheit: "Durchschnittliche Kundenzufriedenheit (Skala 1–5).",
  wartezeit_min: "Durchschnittliche Wartezeit je Kunde in Minuten.",
  becher: "Verkaufte Menge in Bechern.",
  transaktionen: "Anzahl der Bons (Verkäufe).",
  bonwert_eur: "Durchschnittlicher Umsatz je Bon (Umsatz ÷ Transaktionen).",
  kosten_eur: "Summe aller Kosten im Zeitraum."
};

/* Kurzlabels für die KPI-Leiste (Design: ERGEBNIS · MARGE · WARTEZEIT · ZUFRIEDENHEIT) */
var KPI_SHORT = {
  umsatz_eur: "UMSATZ", kosten_eur: "KOSTEN", ergebnis_eur: "ERGEBNIS",
  umsatzrendite_pct: "MARGE", becher: "BECHER", transaktionen: "BONS",
  wartezeit_min: "WARTEZEIT", zufriedenheit: "ZUFRIEDENHEIT", bonwert_eur: "Ø BON"
};

var ROLE_SHORT = {
  geschaeftsfuehrung: "geschäftsführung",
  standleitung_bahnhof: "standleitung",
  controlling: "controlling"
};

/* Entitätsfarben — eine Entität behält ihre Farbe in allen Diagrammen.
   Standorte: kräftige Serienfarben. Produkte/Größen: neutrales Schiefer.
   Ampel-Farben sind bewusst gesättigter und nie Teil dieser Paletten. */
var PALETTE = {
  light: {
    standort:  ["#2f6fbf", "#e26a3d", "#3aa06c", "#e8b93a", "#e87ba4", "#7c5cbf", "#2aa198", "#b5651d"],
    kostenart: ["#5b7186", "#7c5cbf", "#2aa198", "#b5651d", "#8b5a2b", "#9a7bb0", "#4f7a8c", "#a3894e", "#6f8f4a", "#c2604f", "#6b7280", "#3f6f5f"],
    produkt:   ["#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1"],
    groesse:   ["#334155", "#94a3b8"]
  },
  dark: {
    standort:  ["#4a8fd6", "#e26a3d", "#4bb883", "#e8b93a", "#e88bab", "#9b7ee0", "#3ec2b6", "#d08a4a"],
    kostenart: ["#8fa6bd", "#9b7ee0", "#3ec2b6", "#d08a4a", "#b08050", "#c0a2d6", "#7c9ec4", "#c4ab72", "#8fae65", "#d4796a", "#9aa1ac", "#6fa08c"],
    /* helle Schiefer-Blautöne: die alte Reihe lief bis #3f3e39 und war auf
       dunklem Grund praktisch unsichtbar */
    produkt:   ["#dfe6ef", "#bcc7d6", "#9aa9bd", "#7c8da4", "#63738a"],
    groesse:   ["#dfe6ef", "#9aa9bd"]
  }
};

var AMPEL_DEFAULT_COLORS = { gruen: "#22c55e", gelb: "#eab308", rot: "#dc2626" };

var WT = { 0: "Mo", 1: "Di", 2: "Mi", 3: "Do", 4: "Fr", 5: "Sa", 6: "So" };
var MON_DE = { "01": "Jänner", "02": "Februar", "03": "März", "04": "April", "05": "Mai", "06": "Juni",
  "07": "Juli", "08": "August", "09": "September", "10": "Oktober", "11": "November", "12": "Dezember" };
var MON_KURZ = { "01": "Jän", "02": "Feb", "03": "Mär", "04": "Apr", "05": "Mai", "06": "Jun",
  "07": "Jul", "08": "Aug", "09": "Sep", "10": "Okt", "11": "Nov", "12": "Dez" };
var MON_NUM = { "jänner": "01", januar: "01", februar: "02", "märz": "03", april: "04", mai: "05",
  juni: "06", juli: "07", august: "08", september: "09", oktober: "10", november: "11", dezember: "12" };

var ADDITIV = { umsatz_eur: 1, kosten_eur: 1, ergebnis_eur: 1, becher: 1, transaktionen: 1 };
var SPLIT_ORDER = [["umsatz_eur", "Umsatz"], ["kosten_eur", "Ausgaben"], ["ergebnis_eur", "Gewinn"]];
var SPLIT_LBL = { umsatz_eur: "Umsatz", kosten_eur: "Ausgaben", ergebnis_eur: "Gewinn" };
var PIE_OK = { umsatz_eur: 1, kosten_eur: 1, ergebnis_eur: 1 };

var KPIS = F.kpis, ROLLES = F.rollen, EBN = F.ebenen, ORTE = F.orte, EBENE1 = F.ebene1;

/* Ampel-Schwellen: yellowT = Grenze zur gelben Zone, redT = Grenze zur roten Zone.
   dir "gr" = größer ist besser, "kl" = kleiner ist besser (invers). */
var AMPEL = {
  wartezeit_min:     { dir: "kl", yellowT: 5.5, redT: 6.5, step: 0.5 },
  zufriedenheit:     { dir: "gr", yellowT: 3.8, redT: 3.4, step: 0.1, min: 1, max: 5 },
  ergebnis_eur:      { dir: "gr", yellowT: 0, redT: -1000, step: 100 },
  umsatzrendite_pct: { dir: "gr", yellowT: 5, redT: 0, step: 0.1 }
};

var LS = "limocockpit.v1.";
var state = {
  role: null, pfad: [], from: null, to: null,
  splitMetric: "umsatz_eur", splitView: "kreis",
  standWahl: null, mode: "uebersicht", cmp: null, gran: "monat",
  prodMetric: "menge", prodSize: "gesamt",
  docTab: "beginn", rangeKey: "all", user: "anna.huber"
};
state.from = F.dmin; state.to = F.dmax;

/* =========================== 2 · Kleine Helfer =========================== */

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function store(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} }
function restore(k, dflt) {
  try { var v = localStorage.getItem(LS + k); return v == null ? dflt : JSON.parse(v); }
  catch (e) { return dflt; }
}
function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }
function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

var deDec = function (s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, "."); };

function fmt(v, id) {
  if (v == null || isNaN(v)) return "–";
  var e = EINHEIT[id] || "";
  if (id === "temperatur_c") return v.toFixed(1).replace(".", ",") + " °C";
  if (id === "niederschlag_mm") return Math.round(v).toLocaleString("de-DE") + " mm";
  if (e === "€") return deDec(Math.round(v).toString()) + " €";
  if (e === "%") return v.toFixed(1).replace(".", ",") + " %";
  if (e === "Stk" || e === "Bons") return deDec(Math.round(v).toString()) + " " + e;
  if (id === "zufriedenheit" || id === "bonwert_eur") return v.toFixed(2).replace(".", ",") + (e ? " " + e : "");
  return v.toFixed(1).replace(".", ",") + (e ? " " + e : "");
}
function fmtShort(v, id) {
  var e = EINHEIT[id] || "";
  if (e === "€") return deDec(Math.round(v).toString()) + " €";
  return fmt(v, id);
}
/* Kompakt für Baum/Chips: 52k, 5,4k, 812 */
function fmtK(v) {
  if (v == null || isNaN(v)) return "–";
  var a = Math.abs(v);
  if (a >= 10000) return (v < 0 ? "−" : "") + Math.round(a / 1000) + "k";
  if (a >= 1000) return (v < 0 ? "−" : "") + (a / 1000).toFixed(1).replace(".", ",") + "k";
  return (v < 0 ? "−" : "") + Math.round(a).toLocaleString("de-DE");
}
/* Zahl ohne Einheit + Einheit getrennt (für die KPI-Leiste) */
function fmtParts(v, id) {
  var s = fmt(v, id), e = EINHEIT[id] || "";
  if (e && s.slice(-e.length) === e) return { n: s.slice(0, -e.length).trim(), u: e };
  return { n: s, u: "" };
}
function fmtDE(ds) { var p = String(ds).split("-"); return p[2] + "." + p[1] + "." + p[0]; }
function isoD(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
function monEnd(mo) { return mo + "-" + String(daysInMonth(+mo.slice(0, 4), +mo.slice(5, 7))).padStart(2, "0"); }
function monthsIn(from, to) {
  var out = [], y = +from.slice(0, 4), m = +from.slice(5, 7), ey = +to.slice(0, 4), em = +to.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) { out.push(y + "-" + String(m).padStart(2, "0")); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
function monLabel(mo, kurz) { return (kurz ? MON_KURZ : MON_DE)[mo.slice(5, 7)] + " " + (kurz ? mo.slice(2, 4) : mo.slice(0, 4)); }
function mondayOf(ds) { var dt = new Date(ds + "T00:00:00"), day = (dt.getDay() + 6) % 7; dt.setDate(dt.getDate() - day); return isoD(dt); }
function isoWeek(ds) {
  var dt = new Date(ds + "T00:00:00"), t = new Date(dt);
  t.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
  var w1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}
function wtag(ds) { return WT[(new Date(ds + "T00:00:00").getDay() + 6) % 7]; }

/* =========================== 3 · Farben =========================== */

var COLORS = { standort: {}, produkt: {}, kostenart: {}, groesse: {} };

function buildColors() {
  var pal = PALETTE[isDark() ? "dark" : "light"];
  var rank = function (totals, dim) {
    var names = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a] || (a < b ? -1 : 1); });
    var m = {};
    names.forEach(function (n, i) { m[n] = pal[dim][i % pal[dim].length]; });
    return m;
  };
  var st = {}, pr = {}, ka = {};
  F.sales.forEach(function (r) { st[r.s] = (st[r.s] || 0) + r.um; pr[r.p] = (pr[r.p] || 0) + r.um; });
  F.costs.forEach(function (c) { if (!(c.ks in st)) st[c.ks] = 0; ka[c.ka] = (ka[c.ka] || 0) + c.be; });
  COLORS.standort = rank(st, "standort");
  COLORS.produkt = rank(pr, "produkt");
  COLORS.kostenart = rank(ka, "kostenart");
  COLORS.groesse = { "klein 0,2 l": pal.groesse[1], "groß 0,4 l": pal.groesse[0] };
}

/* Welche Dimension liegt auf Ebene n? (1 Unternehmen → 2 Standort → 3 Produkt/Kostenart → 4 Größe) */
function dimOfEbene(ebene, metric) {
  if (ebene === 2) return "standort";
  if (ebene === 3) return metric === "kosten_eur" ? "kostenart" : "produkt";
  if (ebene === 4) return "groesse";
  return "standort";
}
function colorFor(name, dim) {
  var m = COLORS[dim] || {};
  if (m[name]) return m[name];
  /* Kostenarten tauchen auf Ebene 3 gemeinsam mit Produkten auf */
  return COLORS.kostenart[name] || COLORS.produkt[name] || COLORS.standort[name] || cssv("--muted");
}
function ampelColor(a) {
  return a === "gruen" ? cssv("--gruen") : a === "gelb" ? cssv("--gelb") : a === "rot" ? cssv("--rot") : cssv("--muted");
}
function ampelOf(kid, v) {
  var a = AMPEL[kid];
  if (!a || v == null || isNaN(v)) return null;
  if (a.dir === "kl") return v <= a.yellowT ? "gruen" : (v <= a.redT ? "gelb" : "rot");
  return v >= a.yellowT ? "gruen" : (v >= a.redT ? "gelb" : "rot");
}

/* =========================== 4 · Rechenkern =========================== */

function costFrac(mon) {
  var y = +mon.slice(0, 4), m = +mon.slice(5, 7);
  var m0 = mon + "-01", m1 = mon + "-" + String(daysInMonth(y, m)).padStart(2, "0");
  var lo = state.from > m0 ? state.from : m0, hi = state.to < m1 ? state.to : m1;
  if (hi < lo) return 0;
  return ((new Date(hi) - new Date(lo)) / 86400000 + 1) / daysInMonth(y, m);
}
function fracFor(mon, pf, pt) {
  var y = +mon.slice(0, 4), m = +mon.slice(5, 7);
  var m0 = mon + "-01", m1 = mon + "-" + String(daysInMonth(y, m)).padStart(2, "0");
  var lo = pf > m0 ? pf : m0, hi = pt < m1 ? pt : m1;
  if (hi < lo) return 0;
  return ((new Date(hi) - new Date(lo)) / 86400000 + 1) / daysInMonth(y, m);
}
function salesFilt(filt) {
  return F.sales.filter(function (r) {
    return r.d >= state.from && r.d <= state.to
      && (!filt.ebene_2 || r.s === filt.ebene_2)
      && (!filt.ebene_3 || r.p === filt.ebene_3)
      && (!filt.ebene_4 || (String(filt.ebene_4).indexOf("klein") >= 0 ? r.g === "klein" : r.g === "gross"));
  });
}
function costSum(filt) {
  var k = 0;
  F.costs.forEach(function (c) {
    if (filt.ebene_2 && c.ks !== filt.ebene_2) return;
    if (filt.ebene_3 && c.ka !== filt.ebene_3) return;
    var fr = costFrac(c.mon); if (fr > 0) k += c.be * fr;
  });
  return k;
}
function metrics(rows, ebene, filt) {
  var um = 0, be = 0, tx = 0, wz = 0, zf = 0;
  rows.forEach(function (r) { um += r.um; be += r.be; tx += r.tx; wz += r.wz; zf += r.zf; });
  var kos = costSum(filt), hatV = rows.length > 0;
  var m = {
    umsatz_eur: hatV ? um : null, becher: hatV ? be : null, transaktionen: hatV ? tx : null,
    wartezeit_min: tx ? wz / tx : null, zufriedenheit: tx ? zf / tx : null,
    kosten_eur: kos || null, bonwert_eur: tx ? um / tx : null
  };
  if (ebene <= 2) { m.ergebnis_eur = um - kos; m.umsatzrendite_pct = um ? (um - kos) / um * 100 : null; }
  return m;
}
function alleStandorte() { var s = {}; F.sales.forEach(function (r) { s[r.s] = 1; }); return Object.keys(s).sort(); }
function allProductNames() { var s = {}; F.sales.forEach(function (r) { s[r.p] = 1; }); return Object.keys(s).sort(); }
/* nach Umsatz absteigend — für Rezept- und Preislisten (stärkster Verkäufer zuerst) */
function produkteNachRang() {
  var t = {}; F.sales.forEach(function (r) { t[r.p] = (t[r.p] || 0) + r.um; });
  return Object.keys(t).sort(function (a, b) { return t[b] - t[a] || (a < b ? -1 : 1); });
}
function allKostenarten() { var s = {}; F.costs.forEach(function (c) { s[c.ka] = 1; }); return Object.keys(s).sort(); }
function istEinzelStand(role) { return role.start_ebene === 2 && role.filter && role.filter.ebene_2; }
function aktStand() {
  var role = ROLLES[state.role];
  return istEinzelStand(role) ? (state.standWahl || role.filter.ebene_2) : null;
}
/* Stand, dessen Dokumente gerade gelten: der feste Stand der Standleitung oder
   der Standort, in den GF/Controlling gerade hineingedrillt haben. */
function docStand() {
  var st = aktStand();
  if (st) return st;
  var role = ROLLES[state.role];
  if (role.start_ebene === 1 && state.pfad.length && alleStandorte().indexOf(state.pfad[0]) >= 0) return state.pfad[0];
  return null;
}
function filterOf(role, pfad) {
  var start = role.start_ebene, filt = Object.assign({}, role.filter || {});
  var st = aktStand();
  if (st && role === ROLLES[state.role]) filt.ebene_2 = st;
  pfad.forEach(function (k, i) { filt["ebene_" + (start + 1 + i)] = k; });
  return filt;
}
function childField(ebene) { return { 1: "s", 2: "p", 3: "g" }[ebene]; }
function childCostField(ebene) { return { 1: "ks", 2: "ka" }[ebene]; }

function computeNode() {
  var role = ROLLES[state.role], start = role.start_ebene, maxe = role.max_ebene;
  var ebene = start + state.pfad.length;
  var filt = filterOf(role, state.pfad), std = filt.ebene_2 || null;
  var rows = salesFilt(filt), m = metrics(rows, ebene, filt);

  /* Vergleichszeitraum: Vormonat bzw. gleich lange Periode davor */
  var d0 = new Date(state.from), d1 = new Date(state.to);
  var lenDays = Math.round((d1 - d0) / 86400000) + 1;
  var isMonat = (state.from.slice(8) === "01" && state.to === monEnd(state.from.slice(0, 7)));
  var pFromS, pToS;
  if (isMonat) {
    var y = +state.from.slice(0, 4), mo = +state.from.slice(5, 7) - 1;
    if (mo < 1) { mo = 12; y--; }
    var pm = y + "-" + String(mo).padStart(2, "0");
    pFromS = pm + "-01"; pToS = monEnd(pm);
  } else {
    var pTo = new Date(d0.getTime() - 86400000), pFrom = new Date(pTo.getTime() - (lenDays - 1) * 86400000);
    pFromS = isoD(pFrom); pToS = isoD(pTo);
  }
  var hatVergleich = pToS >= F.dmin;
  var vlabel = isMonat ? "ggü. Vormonat" : "ggü. Vorzeitraum";
  function metricsAt(from, to) {
    var sf = state.from, stt = state.to;
    state.from = from; state.to = to;
    var mm = metrics(salesFilt(filt), ebene, filt);
    state.from = sf; state.to = stt;
    return mm;
  }
  var mPrev = hatVergleich ? metricsAt(pFromS, pToS) : null;

  var mons = monthsIn(state.from, state.to);
  var monat = mons.map(function (mo2) {
    var rr = rows.filter(function (r) { return r.d.slice(0, 7) === mo2; });
    var mm = metrics(rr, ebene, filt);
    return Object.assign({ periode: mo2, ebene_1: EBENE1, ebene_2: std }, mm);
  });

  var kacheln = role.kennzahlen.filter(function (k) { return KPIS[k]; }).map(function (kid) {
    var kd = KPIS[kid], val = m[kid], delta = null, prev = null;
    if (mPrev) {
      var pv = mPrev[kid];
      if (pv != null && !isNaN(pv) && val != null) { prev = pv; if (pv !== 0) delta = (val - pv) / Math.abs(pv) * 100; }
    }
    return {
      id: kid, name: kd.name, einheit: kd.einheit || "",
      wert: (val == null || isNaN(val)) ? null : val,
      ampel: ampelOf(kid, val), delta_pct: delta, prev: prev, richtung: kd.richtung
    };
  }).filter(function (k) { return k.wert != null; });

  /* Kinder des Knotens (für Aufteilung, Drill-down, Baum) */
  var kinder = [], kinder_names = [];
  var kf = childField(ebene), kcf = childCostField(ebene);
  if (ebene < maxe) {
    var set = {};
    if (kf) rows.forEach(function (r) {
      set[r[kf] === "klein" ? "klein 0,2 l" : r[kf] === "gross" ? "groß 0,4 l" : r[kf]] = 1;
    });
    if (kcf) F.costs.forEach(function (c) { if (costFrac(c.mon) > 0) set[c[kcf]] = 1; });
    kinder_names = Object.keys(set).sort();
    kinder_names.forEach(function (nm) {
      var cfilt = Object.assign({}, filt); cfilt["ebene_" + (ebene + 1)] = nm;
      var cm = metrics(salesFilt(cfilt), ebene + 1, cfilt);
      var row = { ebene_1: EBENE1 };
      for (var e = 2; e <= ebene + 1; e++) row["ebene_" + e] = (e === ebene + 1 ? nm : filt["ebene_" + e]);
      Object.keys(cm).forEach(function (k) { row[k] = cm[k]; if (AMPEL[k]) row[k + "_ampel"] = ampelOf(k, cm[k]); });
      kinder.push(row);
    });
  }

  /* Produkte je Größe */
  var pmap = {};
  rows.forEach(function (r) {
    var k = r.p;
    pmap[k] = pmap[k] || { produkt: k, becher_klein: 0, becher_gross: 0, umsatz_klein: 0, umsatz_gross: 0 };
    pmap[k]["becher_" + r.g] += r.be; pmap[k]["umsatz_" + r.g] += r.um;
  });
  var produkte = Object.keys(pmap).map(function (k) {
    var o = pmap[k];
    return Object.assign({}, o, { becher: o.becher_klein + o.becher_gross, umsatz_eur: o.umsatz_klein + o.umsatz_gross });
  }).sort(function (a, b) { return b.becher - a.becher; });

  /* Tagesreihe — sobald ein Standort im Filter steckt */
  var taeglich = [];
  if (std) {
    var dmap = {};
    rows.forEach(function (r) {
      var o = dmap[r.d] || (dmap[r.d] = { um: 0, be: 0, tx: 0, wz: 0 });
      o.um += r.um; o.be += r.be; o.tx += r.tx; o.wz += r.wz;
    });
    taeglich = Object.keys(dmap).sort().map(function (d) {
      var o = dmap[d];
      return { datum: d, umsatz_eur: o.um, becher: o.be, wartezeit_min: o.tx ? o.wz / o.tx : null, wochentag: wtag(d) };
    });
  }

  /* Wetter */
  var wrows = F.weather.filter(function (r) { return r.d >= state.from && r.d <= state.to && (!std || r.s === std); });
  var wday = {};
  wrows.forEach(function (r) {
    var o = wday[r.d] || (wday[r.d] = { n: 0, tmean: 0, tmin: 0, tmax: 0, prec: 0 });
    o.n++; o.tmean += r.tmean; o.tmin += r.tmin; o.tmax += r.tmax; o.prec += r.prec;
  });
  var wt = Object.keys(wday).sort().map(function (d) {
    var o = wday[d];
    return { datum: d, temperatur_c: o.tmean / o.n, temperatur_min_c: o.tmin / o.n, temperatur_max_c: o.tmax / o.n, niederschlag_mm: o.prec / o.n };
  });
  var wsumPrec = wt.reduce(function (a, x) { return a + x.niederschlag_mm; }, 0);
  var wmeanT = wt.length ? wt.reduce(function (a, x) { return a + x.temperatur_c; }, 0) / wt.length : 0;

  /* Wasserfall (Ergebnisrechnung) */
  var waterfall = null;
  if (role.kennzahlen.indexOf("umsatz_eur") >= 0 && role.kennzahlen.indexOf("kosten_eur") >= 0 && ebene <= 2 && m.umsatz_eur) {
    var ka = {};
    F.costs.forEach(function (c) {
      if (filt.ebene_2 && c.ks !== filt.ebene_2) return;
      var fr = costFrac(c.mon); if (fr > 0) ka[c.ka] = (ka[c.ka] || 0) + c.be * fr;
    });
    waterfall = { umsatz: m.umsatz_eur, kostenarten: ka };
  }

  return {
    rolle: state.role, pfad: state.pfad, ebene: ebene, kann_tiefer: ebene < maxe, max_ebene: maxe,
    titel: state.pfad.length ? state.pfad[state.pfad.length - 1] : (istEinzelStand(role) ? aktStand() : "Gesamt"),
    kennzahlen: role.kennzahlen.filter(function (k) { return KPIS[k]; }),
    kacheln: kacheln, kinder: kinder, kinder_names: kinder_names,
    vergleich_label: vlabel, kind_ebene: "ebene_" + (ebene + 1),
    monat: monat, waterfall: waterfall, produkte: produkte, taeglich: taeglich,
    metrik: m,
    wetter: {
      std: std, ort: std && ORTE[std] ? ORTE[std].ort : null, taeglich: wt,
      temp: wt.length ? wmeanT : null, prec: wt.length ? wsumPrec : null,
      regentage: (function () {
      var rt = regenTage(std), n = 0;
      Object.keys(rt).forEach(function (d) { if (rt[d].regen) n++; });
      return n;
    })()
    }
  };
}

function detailRows(gran) {
  var role = ROLLES[state.role], start = role.start_ebene, ebene = start + state.pfad.length;
  var filt = filterOf(role, state.pfad), std = filt.ebene_2 || null;
  var rows = salesFilt(filt);
  var key = function (d) { return gran === "tag" ? d : (gran === "woche" ? mondayOf(d) : d.slice(0, 7)); };
  var bm = {};
  rows.forEach(function (r) {
    var b = key(r.d), o = bm[b] || (bm[b] = { um: 0, be: 0, tx: 0, wz: 0, zf: 0 });
    o.um += r.um; o.be += r.be; o.tx += r.tx; o.wz += r.wz; o.zf += r.zf;
  });
  var wrows = F.weather.filter(function (w) { return w.d >= state.from && w.d <= state.to && (!std || w.s === std); });
  var wm = {};
  wrows.forEach(function (w) {
    var b = key(w.d), o = wm[b] || (wm[b] = { t: 0, tn: 0, ps: {} });
    o.t += w.tmean; o.tn++; o.ps[w.s] = (o.ps[w.s] || 0) + w.prec;
  });
  var keys = Object.keys(bm); Object.keys(wm).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
  keys.sort();
  return keys.map(function (b) {
    var o = bm[b] || { um: 0, be: 0, tx: 0, wz: 0, zf: 0 }, w = wm[b], label;
    if (gran === "tag") label = fmtDE(b) + " (" + wtag(b) + ")";
    else if (gran === "woche") label = "KW " + isoWeek(b) + " (ab " + fmtDE(b) + ")";
    else label = monLabel(b);
    var rec = {
      label: label, umsatz_eur: o.um, becher: o.be, transaktionen: o.tx,
      wartezeit_min: o.tx ? o.wz / o.tx : null, zufriedenheit: o.tx ? o.zf / o.tx : null,
      temperatur_c: w ? w.t / w.tn : null,
      niederschlag_mm: w ? (Object.keys(w.ps).reduce(function (a, k) { return a + w.ps[k]; }, 0) / Object.keys(w.ps).length) : null
    };
    if (gran === "monat" && ebene <= 2) {
      var kos = 0;
      F.costs.forEach(function (c) { if (filt.ebene_2 && c.ks !== filt.ebene_2) return; if (c.mon === b) kos += c.be; });
      rec.ergebnis_eur = o.um - kos;
      rec.umsatzrendite_pct = o.um ? (o.um - kos) / o.um * 100 : null;
    }
    return rec;
  });
}

var CUR = null;
function node() { return CUR; }

/* Regentage im aktuellen Ausschnitt — für die gedämpften Balken im Tagesverlauf */
/* Ab dieser Menge gilt ein Tag als Regentag — 1 mm ist der übliche Schwellwert.
   Über mehrere Märkte gemittelt wäre "Niederschlag > 0" nutzlos: es wäre an
   82 von 92 Tagen wahr, weil irgendwo immer ein Tropfen fällt. */
var RAIN_MM = 1;

/* Regen je Tag im Ausschnitt. Ein Tag zählt als Regentag, wenn mindestens die
   Hälfte der beteiligten Märkte >= 1 mm meldet. Bei einem einzelnen Stand ist
   das schlicht: dieser Stand hatte >= 1 mm. */
function regenTage(std) {
  var m = {};
  F.weather.forEach(function (w) {
    if (w.d < state.from || w.d > state.to) return;
    if (std && w.s !== std) return;
    var o = m[w.d] || (m[w.d] = { n: 0, nass: 0, mm: 0 });
    o.n++; o.mm += w.prec;
    if (w.prec >= RAIN_MM) o.nass++;
  });
  Object.keys(m).forEach(function (d) {
    m[d].mm = m[d].mm / m[d].n;
    m[d].regen = m[d].nass / m[d].n >= 0.5;
  });
  return m;
}
/* Für den Tagesverlauf: nur die Regentage, Wert = Ø Niederschlag */
function rainDays(std) {
  var m = regenTage(std), set = {};
  Object.keys(m).forEach(function (d) { if (m[d].regen) set[d] = m[d].mm; });
  return set;
}

/* =========================== 4b · Statistik für die Analyse =========================== */

/* Pearson-Korrelation. Gibt null zurück, wenn zu wenige Punkte oder keine Streuung. */
function pearson(xs, ys) {
  var n = 0, sx = 0, sy = 0;
  for (var i = 0; i < xs.length; i++) {
    if (xs[i] == null || ys[i] == null || isNaN(xs[i]) || isNaN(ys[i])) continue;
    n++; sx += xs[i]; sy += ys[i];
  }
  if (n < 8) return null;
  var mx = sx / n, my = sy / n, sxy = 0, sxx = 0, syy = 0;
  for (var j = 0; j < xs.length; j++) {
    if (xs[j] == null || ys[j] == null || isNaN(xs[j]) || isNaN(ys[j])) continue;
    var dx = xs[j] - mx, dy = ys[j] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx <= 0 || syy <= 0) return null;
  return { r: sxy / Math.sqrt(sxx * syy), n: n, mx: mx, my: my, slope: sxy / sxx };
}
/* Umgangssprache für die Stärke eines Zusammenhangs */
function corrWort(r) {
  var a = Math.abs(r);
  if (a < 0.2) return "kein erkennbarer";
  if (a < 0.4) return "ein schwacher";
  if (a < 0.6) return "ein mittlerer";
  if (a < 0.8) return "ein starker";
  return "ein sehr starker";
}
function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }

/* Tagesreihe im aktuellen Ausschnitt: Verkauf + Wetter je Tag.
   Ohne Standort-Filter wird das Wetter über die Märkte gemittelt. */
function analyseDays(filt) {
  var std = filt.ebene_2 || null;
  var dmap = {};
  salesFilt(filt).forEach(function (r) {
    var o = dmap[r.d] || (dmap[r.d] = { um: 0, be: 0, tx: 0, wz: 0, zf: 0 });
    o.um += r.um; o.be += r.be; o.tx += r.tx; o.wz += r.wz; o.zf += r.zf;
  });
  var wmap = {}, rt = regenTage(std);
  F.weather.forEach(function (w) {
    if (w.d < state.from || w.d > state.to) return;
    if (std && w.s !== std) return;
    var o = wmap[w.d] || (wmap[w.d] = { n: 0, t: 0, p: 0 });
    o.n++; o.t += w.tmean; o.p += w.prec;
  });
  return Object.keys(dmap).sort().map(function (d) {
    var o = dmap[d], w = wmap[d];
    var dow = (new Date(d + "T00:00:00").getDay() + 6) % 7;
    return {
      datum: d, dow: dow, wochentag: WT[dow], wochenende: dow >= 5,
      umsatz: o.um, becher: o.be, transaktionen: o.tx,
      wartezeit: o.tx ? o.wz / o.tx : null,
      zufriedenheit: o.tx ? o.zf / o.tx : null,
      temperatur: w ? w.t / w.n : null,
      niederschlag: w ? w.p / w.n : null,
      regen: !!(rt[d] && rt[d].regen)
    };
  });
}

/* Mittelwert-Vergleich zweier Gruppen mit Δ in Prozent */
function gruppenVergleich(days, pred, feld) {
  var a = [], b = [];
  days.forEach(function (d) {
    if (d[feld] == null) return;
    (pred(d) ? a : b).push(d[feld]);
  });
  if (a.length < 3 || b.length < 3) return null;
  var ma = mean(a), mb = mean(b);
  return { mit: ma, ohne: mb, nMit: a.length, nOhne: b.length, delta: mb ? (ma - mb) / mb * 100 : null };
}

/* Wetterempfindlichkeit je Standort: wie viel Umsatz kostet ein Regentag? */
function regenJeStandort() {
  var out = [];
  alleStandorte().forEach(function (st) {
    var v = gruppenVergleich(analyseDays({ ebene_2: st }), function (d) { return d.regen; }, "umsatz");
    if (v && v.delta != null) out.push({ name: st, delta: v.delta, nMit: v.nMit, nOhne: v.nOhne });
  });
  return out.sort(function (a, b) { return a.delta - b.delta; });
}

/* =========================== 5 · SVG-Diagramme =========================== */

/* Zieldbreite der Diagramme: nah an der Spaltenbreite, damit das SVG beim
   Skalieren weder winzig noch stark vergrößert wird (Schriftgrößen bleiben ruhig). */
var CHART_TARGET_W = 900;

function svgOpen(vb, style) {
  return '<svg viewBox="' + vb + '" style="' + (style || "width:100%;height:auto") + '" role="img">';
}
function chartWrap(W, H, inner, title) {
  return '<div class="chart-scroll">' +
    svgOpen("0 0 " + W + " " + H, "width:100%;min-width:" + Math.min(W, 620) + "px;height:auto") +
    (title ? "<title>" + esc(title) + "</title>" : "") + inner + "</svg></div>";
}
function niceMax(v) {
  if (!(v > 0)) return 1;
  var e = Math.pow(10, Math.floor(Math.log10(v))), n = v / e;
  var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * e;
}
function axisTicks(max, count) {
  var out = [];
  for (var i = 0; i <= count; i++) out.push(max * i / count);
  return out;
}
/* Achse mit runden Schritten. Nimmt den *kleinsten* runden Schritt, der noch in
   die gewünschte Zahl an Abschnitten passt — sonst springt die Skala zu grob
   (z. B. 0–40 °C für Werte, die zwischen 10 und 30 liegen). */
function niceScale(min, max, count) {
  count = count || 4;
  if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
  if (max <= min) max = min + 1;
  var mag = Math.pow(10, Math.floor(Math.log10((max - min) / count)));
  var cands = [];
  [0.1, 1, 10].forEach(function (m) {
    [1, 2, 2.5, 5].forEach(function (f) { cands.push(f * m * mag); });
  });
  cands.sort(function (a, b) { return a - b; });
  var step = cands[cands.length - 1];
  for (var i = 0; i < cands.length; i++) {
    var s = cands[i];
    if (s > 0 && Math.ceil(max / s) - Math.floor(min / s) <= count + 1) { step = s; break; }
  }
  var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  var ticks = [];
  for (var v = lo; v <= hi + step * 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min: lo, max: hi, step: step, ticks: ticks };
}
function tickLabel(v, metric) {
  var e = EINHEIT[metric] || "";
  if (e === "€" || e === "Stk" || e === "Bons") {
    if (Math.abs(v) >= 1000) {
      /* auf der Achse "2k" statt "2,0k" — Nachkommastelle nur, wenn sie etwas sagt */
      var k = v / 1000;
      return (Math.abs(k % 1) < 0.05 ? String(Math.round(k)) : k.toFixed(1).replace(".", ",")) + "k";
    }
    return String(Math.round(v));
  }
  return (Math.round(v * 10) / 10).toString().replace(".", ",");
}


/* --- Liegendes Balkendiagramm mit Werteachse.
   Eine Darstellung für alle Ebenen: Standorte, Produkte, Größen, Kostenarten.
   Verträgt negative Werte (Gewinn) und ist optional klickbar (Drill-down). --- */
function hBarChart(rows, opts) {
  if (!rows.length) return '<div class="chart-empty">Keine Werte im Zeitraum.</div>';
  var metric = opts.metric, dim = opts.dim, clickable = opts.click;
  var BH = rows.length > 8 ? 20 : 26, GAP = rows.length > 8 ? 9 : 14, top = 14, bot = 46;

  var posSum = rows.reduce(function (a, r) { return a + (r.v > 0 ? r.v : 0); }, 0);
  var withShare = opts.share !== false && posSum > 0;
  var label = function (r) {
    var t = fmtShort(r.v, metric);
    if (withShare && r.v > 0) t += "  ·  " + (r.v / posSum * 100).toFixed(1).replace(".", ",") + " %";
    return t;
  };
  /* Platz links nach dem längsten Namen, rechts nach der längsten Zahl */
  var longest = rows.reduce(function (a, r) { return Math.max(a, String(r.name).length); }, 0);
  var longestVal = rows.reduce(function (a, r) { return Math.max(a, label(r).length); }, 0);
  var LEFT = Math.min(210, Math.max(90, Math.round(longest * 5.9) + 14));
  var RIGHT = Math.min(150, Math.max(60, Math.round(longestVal * 5.4) + 16));
  var W = CHART_TARGET_W, H = top + rows.length * BH + (rows.length - 1) * GAP + bot;
  var plotW = W - LEFT - RIGHT;

  var vals = rows.map(function (r) { return r.v; });
  var scale = niceScale(Math.min(0, Math.min.apply(null, vals)), Math.max(0, Math.max.apply(null, vals)), 5);
  var x = function (v) { return LEFT + (v - scale.min) / (scale.max - scale.min) * plotW; };
  var zero = x(0);

  var grid = scale.ticks.map(function (t) {
    var gx = x(t).toFixed(1);
    return '<line class="grid' + (t === 0 ? "" : " dash") + '" x1="' + gx + '" y1="' + top + '" x2="' + gx + '" y2="' + (H - bot + 6) + '"/>' +
      '<text class="ax" x="' + gx + '" y="' + (H - bot + 20) + '" text-anchor="middle">' + esc(tickLabel(t, metric)) + "</text>";
  }).join("");

  var bars = rows.map(function (r, i) {
    var y = top + i * (BH + GAP), col = colorFor(r.name, dim);
    var xv = x(r.v), bx = Math.min(zero, xv), bw = Math.max(1.5, Math.abs(xv - zero));
    var neg = r.v < 0;
    var vx = neg ? bx - 8 : bx + bw + 8;
    return '<g class="bar' + (clickable ? " click" : "") + '"' + (clickable ? ' data-act="drill" data-arg="' + esc(r.name) + '"' : "") + ">" +
      '<rect x="' + bx.toFixed(1) + '" y="' + y + '" width="' + bw.toFixed(1) + '" height="' + BH + '" fill="' + col + '" rx="3"/>' +
      '<text class="ax" x="' + (LEFT - 10) + '" y="' + (y + BH / 2 + 3.5) + '" text-anchor="end" fill="' + cssv("--fg") + '">' + esc(r.name) + "</text>" +
      '<text class="ax" x="' + vx.toFixed(1) + '" y="' + (y + BH / 2 + 3.5) + '" text-anchor="' + (neg ? "end" : "start") + '"' +
      (neg ? ' fill="' + cssv("--bad-fg") + '"' : "") + ">" + esc(label(r)) + "</text>" +
      "<title>" + esc(r.name + ": " + fmt(r.v, metric) + (r.sub ? " · " + r.sub : "")) + "</title></g>";
  }).join("");

  var axisTitle = opts.axisTitle
    ? '<text class="ax" x="' + (LEFT + plotW / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(opts.axisTitle) + "</text>"
    : "";

  return chartWrap(W, H, grid + bars + axisTitle, opts.title || "");
}

/* --- Streudiagramm mit Trendgerade (Temperatur ↔ Umsatz) --- */
function scatterChart(points, opts) {
  var pts = points.filter(function (p) { return p.x != null && p.y != null; });
  if (pts.length < 5) return '<div class="chart-empty">Zu wenige Tage für eine Streuung.</div>';
  var LEFT = 58, RIGHT = 18, top = 12, bot = 46;
  var W = CHART_TARGET_W, H = 260, plotW = W - LEFT - RIGHT, plotH = H - top - bot;

  var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
  var xS = niceScale(Math.min.apply(null, xs), Math.max.apply(null, xs), 5);
  var yS = niceScale(0, Math.max.apply(null, ys), 4);
  var X = function (v) { return LEFT + (v - xS.min) / (xS.max - xS.min) * plotW; };
  var Y = function (v) { return top + plotH - (v - yS.min) / (yS.max - yS.min) * plotH; };

  var grid = yS.ticks.map(function (t) {
    return '<line class="grid dash" x1="' + LEFT + '" y1="' + Y(t).toFixed(1) + '" x2="' + (W - RIGHT) + '" y2="' + Y(t).toFixed(1) + '"/>' +
      '<text class="ax" x="' + (LEFT - 8) + '" y="' + (Y(t) + 3).toFixed(1) + '" text-anchor="end">' + esc(tickLabel(t, opts.metric)) + "</text>";
  }).join("") + xS.ticks.map(function (t) {
    return '<text class="ax" x="' + X(t).toFixed(1) + '" y="' + (H - bot + 20) + '" text-anchor="middle">' + esc(tickLabel(t)) + " °C</text>";
  }).join("");

  var dots = pts.map(function (p) {
    return '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="3.4" fill="' +
      (p.regen ? cssv("--prec") : cssv("--temp")) + '" opacity="' + (p.regen ? ".85" : ".6") + '"><title>' +
      esc(fmtDE(p.d) + " (" + p.wt + ") · " + p.x.toFixed(1).replace(".", ",") + " °C · " + fmtShort(p.y, opts.metric) +
        (p.regen ? " · Regen" : "")) + "</title></circle>";
  }).join("");

  /* Trendgerade aus der Regression */
  var line = "";
  if (opts.fit) {
    var x1 = xS.min, x2 = xS.max;
    var y1 = opts.fit.my + opts.fit.slope * (x1 - opts.fit.mx);
    var y2 = opts.fit.my + opts.fit.slope * (x2 - opts.fit.mx);
    line = '<line x1="' + X(x1).toFixed(1) + '" y1="' + Y(y1).toFixed(1) + '" x2="' + X(x2).toFixed(1) +
      '" y2="' + Y(y2).toFixed(1) + '" stroke="' + cssv("--fg") + '" stroke-width="1.6" stroke-dasharray="5 4" opacity=".7"/>';
  }
  var axisTitle = '<text class="ax" x="' + (LEFT + plotW / 2) + '" y="' + (H - 6) + '" text-anchor="middle">Tagesmittel-Temperatur (°C)</text>';

  return chartWrap(W, H, grid + line + dots + axisTitle, "Temperatur gegen Umsatz je Tag") +
    '<div class="chart-legend"><span class="i"><span class="sw" style="background:' + cssv("--temp") + ';border-radius:50%"></span>trockener Tag</span>' +
    '<span class="i"><span class="sw" style="background:' + cssv("--prec") + ';border-radius:50%"></span>Regentag</span>' +
    '<span class="i">gestrichelt = Trend</span></div>';
}

/* --- Kreisdiagramm (SVG) mit Legende rechts --- */
function pieChart(rows, opts) {
  var metric = opts.metric, dim = opts.dim, clickable = opts.click;
  var pos = rows.filter(function (r) { return r.v > 0; });
  var neg = rows.filter(function (r) { return r.v <= 0; });
  var total = pos.reduce(function (a, r) { return a + r.v; }, 0);
  var netto = rows.reduce(function (a, r) { return a + r.v; }, 0);
  if (!pos.length || !total) return '<div class="chart-empty">Für diese Kennzahl ist keine Kreis-Darstellung möglich.</div>';

  var R = 130, LR = 90, bg = cssv("--bg"), ang = -Math.PI / 2, slices = [];
  pos.forEach(function (r) {
    var frac = r.v / total, a0 = ang, a1 = ang + frac * Math.PI * 2;
    ang = a1;
    slices.push({ r: r, a0: a0, a1: a1, frac: frac });
  });
  var pts = function (a) { return [(R * Math.cos(a)).toFixed(3), (R * Math.sin(a)).toFixed(3)]; };

  var paths = slices.map(function (s) {
    var p0 = pts(s.a0), p1 = pts(s.a1), large = (s.a1 - s.a0) > Math.PI ? 1 : 0;
    var d = "M 0,0 L " + p0[0] + "," + p0[1] + " A " + R + "," + R + " 0 " + large + ",1 " + p1[0] + "," + p1[1] + " Z";
    /* Vollkreis (nur eine Kategorie) als Kreis zeichnen */
    if (s.frac >= 0.9999) d = "M 0,-" + R + " A " + R + "," + R + " 0 1,1 0," + R + " A " + R + "," + R + " 0 1,1 0,-" + R + " Z";
    return '<path d="' + d + '" fill="' + colorFor(s.r.name, dim) + '" class="pie-slice' + (clickable ? " click" : "") + '"' +
      (clickable ? ' data-act="drill" data-arg="' + esc(s.r.name) + '"' : "") + '>' +
      "<title>" + esc(s.r.name + ": " + fmtShort(s.r.v, metric) + " · " + (s.frac * 100).toFixed(1).replace(".", ",") + " %") + "</title></path>";
  }).join("");

  var seps = slices.length > 1 ? slices.map(function (s) {
    var p = pts(s.a0);
    return '<line x1="0" y1="0" x2="' + p[0] + '" y2="' + p[1] + '" stroke="' + bg + '" stroke-width="1.5"/>';
  }).join("") : "";

  /* Prozente an den Slice-Mitten, deutlich innerhalb der Fläche */
  var labels = slices.filter(function (s) { return s.frac >= 0.035; }).map(function (s) {
    var mid = (s.a0 + s.a1) / 2;
    var x = (LR * Math.cos(mid)).toFixed(1), y = (LR * Math.sin(mid)).toFixed(1);
    return '<text x="' + x + '" y="' + y + '">' + (s.frac * 100).toFixed(1).replace(".", ",") + " %</text>";
  }).join("");

  var legend = rows.map(function (r) {
    var loss = r.v < 0;
    return '<' + (clickable ? 'button type="button"' : "div") + ' class="legend-row' + (clickable ? " click" : "") + '"' +
      (clickable ? ' data-act="drill" data-arg="' + esc(r.name) + '"' : "") + '>' +
      '<span class="sw" style="background:' + colorFor(r.name, dim) + '"></span>' +
      '<span class="legend-name">' + esc(r.name) + "</span>" +
      '<span class="legend-val' + (loss ? " loss" : "") + '">' + esc(fmtShort(r.v, metric)) + (loss ? " · Verlust" : "") + "</span>" +
      "</" + (clickable ? "button" : "div") + ">";
  }).join("");

  return '<div class="pie-wrap"><div class="chart">' +
    svgOpen("-140 -140 280 280", "width:420px;height:420px;max-width:100%") +
    "<title>" + esc(SPLIT_LBL[metric] || metric) + "-Anteile</title>" + paths + seps +
    '<g pointer-events="none" font-weight="600" font-size="15" text-anchor="middle" dominant-baseline="central" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="0.6" paint-order="stroke fill">' +
    labels + "</g></svg></div>" +
    '<div><div class="legend">' + legend + "</div>" +
    '<div class="pie-total">' + esc(SPLIT_LBL[metric] || metric) + " gesamt <b>" + esc(fmtShort(netto, metric)) + "</b>" +
    (neg.length ? '<br><span style="color:var(--bad-fg)">' + neg.length + " Position" + (neg.length > 1 ? "en" : "") + " im Minus — nicht als Segment darstellbar</span>" : "") +
    "</div></div></div>";
}

/* --- Wasserfall · Ergebnisrechnung --- */
function waterfallChart(wf) {
  var arten = Object.keys(wf.kostenarten).sort(function (a, b) { return wf.kostenarten[b] - wf.kostenarten[a]; });
  var steps = [{ name: "Umsatz", v: wf.umsatz, kind: "start" }];
  arten.forEach(function (a) { steps.push({ name: a, v: -wf.kostenarten[a], kind: "step" }); });
  var erg = wf.umsatz - arten.reduce(function (a, k) { return a + wf.kostenarten[k]; }, 0);
  steps.push({ name: "Ergebnis", v: erg, kind: "end" });

  /* Liegender Wasserfall: eine Zeile je Position. Bei einem Dutzend Kostenarten
     lesbar, weil die Namen waagrecht stehen — senkrecht mussten sie gedreht werden
     und die kleinen Posten verschwanden zu Strichen. */
  var RH = 22, GAP = 8, top = 16, bot = 46;
  var longest = steps.reduce(function (a, s) { return Math.max(a, s.name.length); }, 0);
  var LEFT = Math.min(200, Math.max(96, Math.round(longest * 5.9) + 14));
  var RIGHT = 120;
  var W = CHART_TARGET_W, H = top + steps.length * RH + (steps.length - 1) * GAP + bot;
  var plotW = W - LEFT - RIGHT;

  var run = 0, hi = 0;
  steps.forEach(function (s) {
    if (s.kind === "step") { hi = Math.max(hi, run, run + s.v); run += s.v; }
    else { hi = Math.max(hi, s.v); if (s.kind === "start") run = s.v; }
  });
  var scale = niceScale(0, hi, 5);
  var x = function (v) { return LEFT + (v - scale.min) / (scale.max - scale.min) * plotW; };

  var grid = scale.ticks.map(function (t) {
    var gx = x(t).toFixed(1);
    return '<line class="grid' + (t === 0 ? "" : " dash") + '" x1="' + gx + '" y1="' + top + '" x2="' + gx + '" y2="' + (H - bot + 6) + '"/>' +
      '<text class="ax" x="' + gx + '" y="' + (H - bot + 20) + '" text-anchor="middle">' + esc(tickLabel(t, "umsatz_eur")) + "</text>";
  }).join("");

  var body = "", prevX = null;
  run = 0;
  steps.forEach(function (s, i) {
    var y = top + i * (RH + GAP), x0, x1, col, anteil = wf.umsatz ? Math.abs(s.v) / wf.umsatz * 100 : 0;
    if (s.kind === "step") {
      x0 = x(run + s.v); x1 = x(run); run += s.v;
      col = colorFor(s.name, "kostenart");
    } else {
      x0 = x(0); x1 = x(s.v);
      col = s.kind === "start" ? cssv("--fg") : (s.v >= 0 ? cssv("--gruen") : cssv("--rot"));
      run = s.v;   /* Umsatz eröffnet den Zwischenstand, das Ergebnis schließt ihn ab */
    }
    var bx = Math.min(x0, x1), bw = Math.max(2, Math.abs(x1 - x0));
    /* Verbinder: senkrecht vom Ende der vorigen Zeile auf diese Zeile */
    if (prevX != null)
      body += '<line class="grid" x1="' + prevX.toFixed(1) + '" y1="' + (y - GAP) + '" x2="' + prevX.toFixed(1) + '" y2="' + y + '"/>';
    prevX = s.kind === "step" ? x0 : x1;

    body += '<rect class="bar" x="' + bx.toFixed(1) + '" y="' + y + '" width="' + bw.toFixed(1) + '" height="' + RH + '" fill="' + col + '" rx="3"/>' +
      '<text class="ax" x="' + (LEFT - 10) + '" y="' + (y + RH / 2 + 3.5) + '" text-anchor="end" fill="' + cssv("--fg") +
      '"' + (s.kind !== "step" ? ' font-weight="600"' : "") + ">" + esc(s.name) + "</text>" +
      '<text class="ax" x="' + (Math.max(x0, x1) + 8).toFixed(1) + '" y="' + (y + RH / 2 + 3.5) + '">' +
      esc((s.kind === "step" ? "− " : "") + fmtShort(Math.abs(s.v), "umsatz_eur")) +
      (s.kind === "step" ? '</text><text class="ax" x="' + (Math.max(x0, x1) + 8).toFixed(1) + '" y="' + (y + RH / 2 + 3.5) + '" dx="72">' +
        esc(anteil.toFixed(1).replace(".", ",") + " %") : "") +
      "</text>" +
      "<title>" + esc(s.name + ": " + fmt(s.v, "umsatz_eur") +
        (s.kind === "step" ? " · " + anteil.toFixed(1).replace(".", ",") + " % vom Umsatz" : "")) + "</title>";
  });

  var axisTitle = '<text class="ax" x="' + (LEFT + plotW / 2) + '" y="' + (H - 6) + '" text-anchor="middle">Betrag (€)</text>';

  return chartWrap(W, H, grid + body + axisTitle, "Umsatz minus Kostenarten ergibt das Ergebnis");
}

/* --- Tagesverlauf am Standort: Umsatz je Tag, Regentage gedämpft, Temperaturlinie --- */
function dayChart(days, rain, opts) {
  if (!days.length) return '<div class="chart-empty">Keine Tageswerte im Zeitraum.</div>';
  var wmap = {};
  (opts.weather || []).forEach(function (w) { wmap[w.datum] = w; });
  var n = days.length, W = Math.max(CHART_TARGET_W, n * 9);
  /* Zwei getrennte Spuren: oben Temperatur (eigene °C-Achse), unten Umsatz (€-Achse) */
  var top = 12, tempH = 46, gap = 14, bot = 26;
  var uTop = top + tempH + gap, uPlot = 120, H = uTop + uPlot + bot;
  var max = niceMax(Math.max.apply(null, days.map(function (d) { return d.umsatz_eur; })));
  var bw = Math.max(3, (W - 40) / n - 3), step = (W - 40) / n;
  var strong = colorFor(opts.colorName || "", opts.dim || "produkt");
  var muted = cssv("--track"), tempc = cssv("--temp");
  var xAt = function (i) { return 34 + i * step; };

  /* Umsatz-Balken (untere Spur), Regentage gedämpft */
  var bars = days.map(function (d, i) {
    var h = Math.max(1, d.umsatz_eur / max * uPlot);
    var isRain = !!rain[d.datum], w = wmap[d.datum];
    return '<rect class="bar" x="' + xAt(i).toFixed(1) + '" y="' + (uTop + uPlot - h).toFixed(1) + '" width="' + bw.toFixed(1) +
      '" height="' + h.toFixed(1) + '" fill="' + (isRain ? muted : strong) + '"><title>' +
      esc(fmtDE(d.datum) + " (" + d.wochentag + ") · " + fmtShort(d.umsatz_eur, "umsatz_eur") +
        (w ? " · " + w.temperatur_c.toFixed(1).replace(".", ",") + " °C" : "") +
        (isRain ? " · " + rain[d.datum].toFixed(1).replace(".", ",") + " mm Regen" : "")) +
      "</title></rect>";
  }).join("");

  /* €-Achse (links, untere Spur) */
  var uGrid = axisTicks(max, 3).map(function (t) {
    var yy = uTop + uPlot - t / max * uPlot;
    return '<line class="grid dash" x1="30" y1="' + yy.toFixed(1) + '" x2="' + W + '" y2="' + yy.toFixed(1) + '"/>' +
      '<text class="ax" x="26" y="' + (yy + 3).toFixed(1) + '" text-anchor="end">' + esc(tickLabel(t, "umsatz_eur")) + " €</text>";
  }).join("");

  /* Temperatur (obere Spur) mit eigener, rot beschrifteter °C-Achse */
  var tempG = "", tLine = "";
  if (opts.weather && opts.weather.length > 1) {
    var temps = opts.weather.map(function (w) { return w.temperatur_c; });
    var tLo = Math.floor(Math.min.apply(null, temps) / 5) * 5;
    var tHi = Math.ceil(Math.max.apply(null, temps) / 5) * 5;
    if (tHi <= tLo) tHi = tLo + 5;
    var yTemp = function (t) { return top + tempH - (t - tLo) / (tHi - tLo) * tempH; };
    tempG = [tLo, Math.round((tLo + tHi) / 2), tHi].map(function (tt) {
      var yy = yTemp(tt);
      return '<line class="grid dash" x1="30" y1="' + yy.toFixed(1) + '" x2="' + W + '" y2="' + yy.toFixed(1) + '"/>' +
        '<text class="ax" x="26" y="' + (yy + 3).toFixed(1) + '" text-anchor="end" fill="' + tempc + '">' + tt + " °</text>";
    }).join("");
    var pathd = days.map(function (d, i) {
      var w = wmap[d.datum]; if (!w) return null;
      return (i === 0 ? "M" : "L") + (xAt(i) + bw / 2).toFixed(1) + "," + yTemp(w.temperatur_c).toFixed(1);
    }).filter(Boolean).join(" ");
    tLine = '<path d="' + pathd + '" fill="none" stroke="' + tempc + '" stroke-width="1.8" opacity=".95"/>';
  }

  var monTicks = "", seen = {};
  days.forEach(function (d, i) {
    var mo = d.datum.slice(0, 7);
    if (seen[mo]) return;
    seen[mo] = 1;
    monTicks += '<text class="ax" x="' + xAt(i).toFixed(1) + '" y="' + (H - 8) + '">' + esc(MON_KURZ[mo.slice(5, 7)]) + "</text>";
  });

  return chartWrap(W, H, tempG + uGrid + bars + tLine + monTicks, "Verkauf je Tag");
}

/* --- Wetter-Kontext: Temperaturband + Niederschlag, kompakt --- */
function weatherChart(daily) {
  if (!daily.length) return "";
  var n = daily.length;
  var W = Math.max(CHART_TARGET_W, n * 8);
  var LEFT = 76, RIGHT = 24;
  /* zwei getrennte Felder: oben Temperatur, unten Niederschlag */
  var top = 12, tempH = 120, gap = 30, precH = 66, bot = 44;
  var H = top + tempH + gap + precH + bot;
  var tTop = top, tBot = top + tempH;
  var pTop = tBot + gap, pBot = pTop + precH;

  var tScale = niceScale(
    Math.min.apply(null, daily.map(function (d) { return d.temperatur_min_c; })),
    Math.max.apply(null, daily.map(function (d) { return d.temperatur_max_c; })), 5);
  var ty = function (v) { return tBot - (v - tScale.min) / (tScale.max - tScale.min) * tempH; };

  var pScale = niceScale(0, Math.max.apply(null, daily.map(function (d) { return d.niederschlag_mm; })) || 1, 3);
  var py = function (v) { return pBot - v / pScale.max * precH; };

  var step = (W - LEFT - RIGHT) / n, x0 = function (i) { return LEFT + i * step + step / 2; };

  /* --- Temperatur: Band Tief–Hoch, Linie Tagesmittel --- */
  var up = daily.map(function (d, i) { return (i ? "L" : "M") + x0(i).toFixed(1) + "," + ty(d.temperatur_max_c).toFixed(1); }).join(" ");
  var down = daily.map(function (d, i) {
    var j = n - 1 - i;
    return "L" + x0(j).toFixed(1) + "," + ty(daily[j].temperatur_min_c).toFixed(1);
  }).join(" ");
  var band = '<path d="' + up + " " + down + ' Z" fill="' + cssv("--temp") + '" opacity=".15"/>';
  var meanLine = '<path d="' + daily.map(function (d, i) { return (i ? "L" : "M") + x0(i).toFixed(1) + "," + ty(d.temperatur_c).toFixed(1); }).join(" ") +
    '" fill="none" stroke="' + cssv("--temp") + '" stroke-width="1.8" stroke-linejoin="round"/>';

  /* --- Niederschlag --- */
  var bw = Math.max(1.6, Math.min(6, step * 0.6));
  var bars = daily.map(function (d, i) {
    var h = Math.max(d.niederschlag_mm > 0 ? 0.8 : 0, pBot - py(d.niederschlag_mm));
    return '<rect class="bar" x="' + (x0(i) - bw / 2).toFixed(1) + '" y="' + (pBot - h).toFixed(1) +
      '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + cssv("--prec") + '" rx="0.8"><title>' +
      esc(fmtDE(d.datum) + " · " + d.temperatur_c.toFixed(1).replace(".", ",") + " °C (" +
        d.temperatur_min_c.toFixed(0) + "–" + d.temperatur_max_c.toFixed(0) + ") · " +
        d.niederschlag_mm.toFixed(1).replace(".", ",") + " mm") +
      "</title></rect>";
  }).join("");

  /* --- Achsen --- */
  var tGrid = tScale.ticks.map(function (t) {
    var y = ty(t);
    if (y < tTop - 0.5 || y > tBot + 0.5) return "";
    return '<line class="grid dash" x1="' + LEFT + '" y1="' + y.toFixed(1) + '" x2="' + (W - RIGHT) + '" y2="' + y.toFixed(1) + '"/>' +
      '<text class="ax" x="' + (LEFT - 8) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + t + "</text>";
  }).join("");
  var pGrid = pScale.ticks.map(function (t) {
    var y = py(t);
    return '<line class="grid' + (t ? " dash" : "") + '" x1="' + LEFT + '" y1="' + y.toFixed(1) + '" x2="' + (W - RIGHT) + '" y2="' + y.toFixed(1) + '"/>' +
      '<text class="ax" x="' + (LEFT - 8) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + tickLabel(t) + "</text>";
  }).join("");

  /* Monatsgrenzen als senkrechte Trenner */
  var marks = "", seen = {};
  daily.forEach(function (d, i) {
    var mo = d.datum.slice(0, 7);
    if (seen[mo] || i === 0) { seen[mo] = 1; return; }
    seen[mo] = 1;
    var mx = (x0(i) - step / 2).toFixed(1);
    marks += '<line class="grid" x1="' + mx + '" y1="' + tTop + '" x2="' + mx + '" y2="' + pBot + '"/>';
  });

  /* Datumsachse: etwa alle zwei Wochen ein Tick */
  var every = Math.max(1, Math.round(n / 7));
  var dateAxis = '<line class="grid" x1="' + LEFT + '" y1="' + pBot + '" x2="' + (W - RIGHT) + '" y2="' + pBot + '"/>';
  for (var i = 0; i < n; i += every) {
    dateAxis += '<line class="grid" x1="' + x0(i).toFixed(1) + '" y1="' + pBot + '" x2="' + x0(i).toFixed(1) + '" y2="' + (pBot + 4) + '"/>' +
      '<text class="ax" x="' + x0(i).toFixed(1) + '" y="' + (pBot + 16) + '" text-anchor="middle">' +
      esc(+daily[i].datum.slice(8) + ". " + MON_KURZ[daily[i].datum.slice(5, 7)]) + "</text>";
  }

  /* Achsentitel */
  var titles =
    '<text class="ax" transform="translate(20,' + ((tTop + tBot) / 2).toFixed(1) + ') rotate(-90)" text-anchor="middle">Temperatur (°C)</text>' +
    '<text class="ax" transform="translate(20,' + ((pTop + pBot) / 2).toFixed(1) + ') rotate(-90)" text-anchor="middle">Niederschlag (mm)</text>' +
    '<text class="ax" x="' + (LEFT + (W - LEFT - RIGHT) / 2) + '" y="' + (H - 6) + '" text-anchor="middle">Datum</text>';

  return chartWrap(W, H, tGrid + pGrid + marks + dateAxis + titles + band + meanLine + bars, "Temperatur und Niederschlag je Tag") +
    '<div class="chart-legend"><span class="i"><span class="sw" style="background:' + cssv("--temp") + '"></span>Temperatur — Fläche Tief–Hoch, Linie Tagesmittel</span>' +
    '<span class="i"><span class="sw" style="background:' + cssv("--prec") + '"></span>Niederschlag je Tag (mm)</span></div>';
}

/* --- Monatsverlauf (wenn keine Kinder mehr da sind) --- */
function trendChart(monat, metric) {
  var d = monat.filter(function (r) { return r[metric] != null; });
  if (d.length < 2) return "";
  var W = Math.max(CHART_TARGET_W, d.length * 90), H = 190, top = 14, bot = 30, plot = H - top - bot;
  var vals = d.map(function (r) { return r[metric]; });
  var max = niceMax(Math.max.apply(null, vals)), min = Math.min.apply(null, vals.concat([0]));
  min = min < 0 ? -niceMax(-min) : 0;
  var y = function (v) { return top + plot - (v - min) / (max - min) * plot; };
  var step = (W - 40) / d.length, bw = Math.min(64, step * 0.5);
  var col = cssv("--accent");
  var bars = d.map(function (r, i) {
    var x = 34 + i * step + (step - bw) / 2, yy = Math.min(y(r[metric]), y(0)), hh = Math.max(2, Math.abs(y(r[metric]) - y(0)));
    return '<rect class="bar" x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hh.toFixed(1) +
      '" fill="' + col + '" rx="2"><title>' + esc(monLabel(r.periode) + ": " + fmt(r[metric], metric)) + "</title></rect>" +
      '<text class="ax" x="' + (x + bw / 2).toFixed(1) + '" y="' + (yy - 5).toFixed(1) + '" text-anchor="middle">' + esc(fmtK(r[metric])) + "</text>" +
      '<text class="ax" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(monLabel(r.periode, true)) + "</text>";
  }).join("");
  var grid = axisTicks(max, 3).map(function (t) {
    return '<line class="grid dash" x1="30" y1="' + y(t).toFixed(1) + '" x2="' + W + '" y2="' + y(t).toFixed(1) + '"/>' +
      '<text class="ax" x="26" y="' + (y(t) + 3).toFixed(1) + '" text-anchor="end">' + esc(tickLabel(t, metric)) + "</text>";
  }).join("");
  return chartWrap(W, H, grid + bars, "Monatsverlauf");
}

/* --- Gruppierte / gestapelte Balken für den Vergleich --- */
function groupedBars(cfg) {
  /* cfg: {groups:[{label, bars:[{label, segs:[{name,value,color}], total}]}], metric} */
  var groups = cfg.groups.filter(function (g) { return g.bars.length; });
  if (!groups.length) return '<div class="chart-empty">Keine Werte für diese Auswahl.</div>';
  var barsPerGroup = Math.max.apply(null, groups.map(function (g) { return g.bars.length; }));
  var BG = 5, GG = 40, LEFT = 46, top = 24, bot = 52;
  /* Balkenbreite so wählen, dass die Gruppen die Zielbreite gut füllen */
  var avail = CHART_TARGET_W - LEFT - 20 - groups.length * GG;
  var BW = Math.round(avail / (groups.length * barsPerGroup) - BG);
  BW = Math.max(14, Math.min(64, BW));
  var groupW = barsPerGroup * BW + (barsPerGroup - 1) * BG;
  var W = Math.max(CHART_TARGET_W, LEFT + groups.length * (groupW + GG) + 20), H = 268, plot = H - top - bot;
  /* Restbreite gleichmäßig auf die Gruppenabstände verteilen */
  var slack = groups.length > 0 ? (W - LEFT - 20 - groups.length * groupW) / groups.length : 0;

  var hi = 0, lo = 0;
  groups.forEach(function (g) {
    g.bars.forEach(function (b) {
      var up = 0, dn = 0;
      b.segs.forEach(function (s) { if (s.value > 0) up += s.value; else dn += s.value; });
      hi = Math.max(hi, up); lo = Math.min(lo, dn);
    });
  });
  var max = niceMax(hi) || 1, min = lo < 0 ? -niceMax(-lo) : 0;
  var y = function (v) { return top + plot - (v - min) / (max - min) * plot; };

  var body = "";
  groups.forEach(function (g, gi) {
    var gx = LEFT + slack / 2 + gi * (groupW + slack);
    g.bars.forEach(function (b, bi) {
      var x = gx + bi * (BW + BG), up = 0, dn = 0;
      b.segs.forEach(function (s) {
        if (s.value == null || !isFinite(s.value)) return;
        var y0, y1;
        if (s.value >= 0) { y0 = y(up); up += s.value; y1 = y(up); }
        else { y0 = y(dn); dn += s.value; y1 = y(dn); }
        var yy = Math.min(y0, y1), hh = Math.max(1, Math.abs(y1 - y0));
        body += '<rect class="bar" x="' + x + '" y="' + yy.toFixed(1) + '" width="' + BW + '" height="' + hh.toFixed(1) +
          '" fill="' + s.color + '"><title>' + esc(g.label + " · " + b.label + (s.name ? " · " + s.name : "") + ": " + fmt(s.value, cfg.metric)) + "</title></rect>";
      });
      if (BW >= 20 || barsPerGroup <= 2)
        body += '<text class="ax" x="' + (x + BW / 2) + '" y="' + (H - bot + 14) + '" text-anchor="middle">' + esc(b.label) + "</text>";
      if (b.total != null) body += '<text class="ax" x="' + (x + BW / 2) + '" y="' + (y(Math.max(up, 0)) - 5).toFixed(1) + '" text-anchor="middle">' + esc(fmtK(b.total)) + "</text>";
    });
    body += '<text class="lbl" x="' + (gx + groupW / 2) + '" y="' + (H - bot + 34) + '" text-anchor="middle">' + esc(g.label) + "</text>";
  });

  var grid = axisTicks(max, 4).map(function (t) {
    return '<line class="grid dash" x1="' + (LEFT - 6) + '" y1="' + y(t).toFixed(1) + '" x2="' + W + '" y2="' + y(t).toFixed(1) + '"/>' +
      '<text class="ax" x="' + (LEFT - 10) + '" y="' + (y(t) + 3).toFixed(1) + '" text-anchor="end">' + esc(tickLabel(t, cfg.metric)) + "</text>";
  }).join("");
  if (min < 0) grid += '<line class="grid" x1="' + (LEFT - 6) + '" y1="' + y(0).toFixed(1) + '" x2="' + W + '" y2="' + y(0).toFixed(1) + '"/>';

  return chartWrap(W, H, grid + body);
}

/* =========================== 6 · Command-Bar =========================== */

function fillCommandBar() {
  var rs = $("#rolesel");
  if (!rs.options.length) {
    rs.innerHTML = Object.keys(ROLLES).map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(ROLE_SHORT[k] || k) + "</option>";
    }).join("");
  }
  rs.value = state.role;
  rs.title = ROLLES[state.role].beschreibung;

  var einzel = istEinzelStand(ROLLES[state.role]);
  $("#standk").hidden = !einzel;
  var ss = $("#standsel");
  ss.hidden = !einzel;
  if (einzel) {
    var cur = aktStand();
    ss.innerHTML = alleStandorte().map(function (s) {
      return '<option value="' + esc(s) + '"' + (s === cur ? " selected" : "") + ">" + esc(s.toLowerCase()) + "</option>";
    }).join("");
  }

  var rsel = $("#rangesel");
  var opts = ['<option value="all">' + esc(shortRange(F.dmin, F.dmax)) + " · gesamt</option>"];
  monthsIn(F.dmin, F.dmax).forEach(function (mo) {
    opts.push('<option value="' + mo + '">' + esc(MON_KURZ[mo.slice(5, 7)] + " " + mo.slice(0, 4)) + "</option>");
  });
  opts.push('<option value="custom">frei wählen …</option>');
  rsel.innerHTML = opts.join("");
  rsel.value = state.rangeKey;

  $$(".cmd .tab").forEach(function (b) { b.classList.toggle("on", b.dataset.mode === state.mode); });
  $("#tab-d").hidden = !docStand();
  $("#themeicon").textContent = isDark() ? "☀" : "☾";
  $("#themelabel").textContent = isDark() ? "Hell" : "Dunkel";
  $("#username").textContent = state.user;
  $("#useravatar").textContent = initials(state.user);
  [rs, ss, rsel].forEach(autosizeSelect);
}
/* Breite der Command-Bar-Selects auf die gewählte Option bringen —
   sonst richtet sich die Breite nach der längsten Option und der Pfeil steht weit weg. */
var _measure = null;
function autosizeSelect(sel) {
  if (!sel || sel.hidden || !sel.options.length) return;
  if (!_measure) {
    _measure = document.createElement("span");
    _measure.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre";
    document.body.appendChild(_measure);
  }
  var cs = getComputedStyle(sel);
  _measure.style.font = cs.fontWeight + " " + cs.fontSize + "/" + cs.lineHeight + " " + cs.fontFamily;
  _measure.style.letterSpacing = cs.letterSpacing;
  var opt = sel.options[sel.selectedIndex];
  _measure.textContent = opt ? opt.text : "";
  sel.style.width = (_measure.offsetWidth + 22) + "px";
}

function initials(u) {
  var p = String(u).split(/[.\s_@-]+/).filter(Boolean);
  return ((p[0] || "?")[0] + (p[1] ? p[1][0] : "")).toUpperCase();
}
function shortRange(a, b) {
  return a.slice(5, 7) + (a.slice(0, 4) === b.slice(0, 4) ? "–" + b.slice(5, 7) + "." + b.slice(0, 4) : "." + a.slice(0, 4) + "–" + b.slice(5, 7) + "." + b.slice(0, 4));
}
function setRange(from, to, key) {
  state.from = from < F.dmin ? F.dmin : from;
  state.to = to > F.dmax ? F.dmax : to;
  if (state.to < state.from) state.to = state.from;
  state.rangeKey = key || "custom";
  state.cmp = null;
  render();
}

/* =========================== 7 · Rendering · Übersicht =========================== */

function crumbsHTML() {
  var n = node(), role = ROLLES[state.role], start = role.start_ebene;
  var wurzel = istEinzelStand(role) ? aktStand() : "Unternehmen";
  var h = '<button type="button" class="crumb' + (state.pfad.length ? "" : " here") + '" data-act="goto" data-arg="0">' + esc(wurzel) + "</button>";
  state.pfad.forEach(function (k, i) {
    var last = i === state.pfad.length - 1;
    var dim = dimOfEbene(start + 1 + i, state.splitMetric);
    var col = colorFor(k, dim);
    h += '<span class="sep">›</span><button type="button" class="crumb ' + (last ? "here" : "tinted") + '"' +
      (last ? "" : ' style="background:' + col + '"') +
      ' data-act="goto" data-arg="' + (i + 1) + '">' + esc(k) + "</button>";
  });
  h += '<button type="button" class="up" data-act="up"' + (state.pfad.length ? "" : " disabled") + ">↑ eine Ebene hoch</button>";
  return '<div class="crumbs">' + h + "</div>";
}

function heroHTML() {
  var n = node(), m = n.metrik;
  var lead = n.kacheln[0] || null;
  var hero = lead ? lead : { id: "umsatz_eur", wert: m.umsatz_eur, prev: null };
  var pill = "";
  if (hero.prev != null && hero.prev !== 0) {
    var d = (hero.wert - hero.prev) / Math.abs(hero.prev) * 100;
    var gut = (d >= 0) === (KPIS[hero.id].richtung === "groesser_ist_besser");
    pill = '<span class="pill ' + (Math.abs(d) < 0.05 ? "flat" : gut ? "up" : "down") + '">' +
      (d >= 0 ? "▲ " : "▼ ") + Math.abs(d).toFixed(1).replace(".", ",") + " % " + esc(n.vergleich_label) + "</span>";
  }
  var strip = n.kacheln.slice(1).map(function (k) {
    var p = fmtParts(k.wert, k.id);
    var dot = k.ampel ? '<span class="dot" style="background:' + ampelColor(k.ampel) + '"></span>' : "";
    var dlt = "";
    if (k.prev != null) {
      var txt = null, dd;
      if (EINHEIT[k.id] === "%") { dd = k.wert - k.prev; txt = (dd >= 0 ? "▲ " : "▼ ") + Math.abs(dd).toFixed(1).replace(".", ",") + " %p"; }
      else if (k.id === "ergebnis_eur") { dd = k.wert - k.prev; txt = (dd >= 0 ? "▲ " : "▼ ") + fmtShort(Math.abs(dd), "umsatz_eur"); }
      else if (k.prev !== 0) { dd = (k.wert - k.prev) / Math.abs(k.prev) * 100; txt = (dd >= 0 ? "▲ " : "▼ ") + Math.abs(dd).toFixed(1).replace(".", ",") + " %"; }
      if (txt != null) {
        var gut2 = (dd >= 0) === (k.richtung === "groesser_ist_besser");
        dlt = '<div class="dlt ' + (Math.abs(dd) < 0.005 ? "flat" : gut2 ? "up" : "down") + '">' + esc(txt) + "</div>";
      }
    }
    return '<div class="kpi"><div class="lbl"' + (GLOSS[k.id] ? ' title="' + esc(GLOSS[k.id]) + '"' : "") + ">" + dot + esc(KPI_SHORT[k.id] || k.name.toUpperCase()) + "</div>" +
      '<div class="val">' + esc(p.n) + (p.u ? '<span class="u">' + esc(p.u) + "</span>" : "") + "</div>" + dlt + "</div>";
  }).join("");

  var pHero = fmtParts(hero.wert, hero.id);
  return '<div class="hero"><div class="hero-row"><div class="hero-val">' + esc(pHero.n) + (pHero.u ? " " + esc(pHero.u) : "") + "</div>" + pill + "</div>" +
    '<div class="hero-sub" style="margin-top:6px">' + esc(KPIS[hero.id] ? KPIS[hero.id].name : "") + " · " + esc(fmtDE(state.from)) + " – " + esc(fmtDE(state.to)) + "</div></div>" +
    (strip ? '<div class="kpistrip">' + strip + "</div>" : "");
}

function scopeHTML() {
  var n = node(), role = ROLLES[state.role];
  var path = [istEinzelStand(role) ? aktStand().toUpperCase() : "UNTERNEHMEN"].concat(state.pfad.map(function (p) { return p.toUpperCase(); }));
  var hint = istEinzelStand(role) ? ' <span class="hint">◂ nur eigener Stand einsehbar</span>'
    : (state.role === "controlling" ? ' <span class="hint">◂ alle Ebenen</span>' : "");
  return '<div class="scope">' + esc(path.join(" › ")) + " · " + esc(rangeLabel()) + hint + "</div>";
}
function rangeLabel() {
  if (state.from === F.dmin && state.to === F.dmax) {
    var ms = monthsIn(F.dmin, F.dmax);
    return MON_KURZ[ms[0].slice(5, 7)] + "–" + MON_KURZ[ms[ms.length - 1].slice(5, 7)] + " '" + F.dmax.slice(2, 4);
  }
  if (state.from.slice(8) === "01" && state.to === monEnd(state.from.slice(0, 7))) return monLabel(state.from.slice(0, 7));
  return fmtDE(state.from) + " – " + fmtDE(state.to);
}

function weatherStripHTML() {
  var w = node().wetter;
  if (!w.taeglich.length) return "";
  var wo = w.std ? "Markt " + w.std + (w.ort ? " · " + w.ort : "") : "alle Märkte gemittelt";
  return '<div class="weather"><span class="wl">☀ WETTER</span>' +
    "<span>" + esc(wo) + "</span>" +
    '<span><span class="tdot">●</span> Ø <b>' + esc(fmt(w.temp, "temperatur_c")) + "</b></span>" +
    '<span><span class="pdot">●</span> Niederschlag <b>' + esc(fmt(w.prec, "niederschlag_mm")) + "</b></span>" +
    "<span>Regentage <b>" + w.regentage + "</b></span></div>";
}

function splitSectionHTML() {
  var n = node();
  var hat = n.kann_tiefer && n.kinder.length;
  if (!hat) {
    if (n.wetter.std && n.taeglich.length) return "";
    var kid = n.kennzahlen[0] || "umsatz_eur";
    var tc = trendChart(n.monat, kid);
    return tc ? '<div class="sec"><div class="sec-head"><div class="sec-title">' + esc(KPIS[kid].name) + " über die Monate</div></div>" + tc + "</div>" : "";
  }
  var cands = SPLIT_ORDER.filter(function (p) {
    return KPIS[p[0]] && n.kinder.some(function (r) { return r[p[0]] != null; });
  });
  if (!cands.some(function (p) { return p[0] === state.splitMetric; })) state.splitMetric = cands.length ? cands[0][0] : "umsatz_eur";
  var metric = state.splitMetric;
  var dim = dimOfEbene(n.ebene + 1, metric);

  var rows = n.kinder.filter(function (r) { return r[metric] != null; })
    .map(function (r) { return { name: r[n.kind_ebene], v: r[metric] }; })
    .sort(function (a, b) { return b.v - a.v; });

  var pieOk = !!PIE_OK[metric] && rows.some(function (r) { return r.v > 0; });
  if (state.splitView === "kreis" && !pieOk) state.splitView = "balken";

  var kind = EBN[String(n.ebene + 1)] || "Knoten";
  var title = "Aufteilung nach " + (dim === "standort" ? "Standort" : dim === "kostenart" ? "Kostenart" : dim === "groesse" ? "Größe" : "Produkt");

  var metricTabs = '<div class="seg">' + cands.map(function (p) {
    return '<button type="button" data-act="splitmetric" data-arg="' + p[0] + '" class="' + (p[0] === metric ? "on" : "") + '">' + esc(p[1]) + "</button>";
  }).join("") + "</div>";
  var viewTabs = '<div class="tabs-sq">' +
    '<button type="button" data-act="splitview" data-arg="balken" class="' + (state.splitView === "balken" ? "on" : "") + '">BALKEN</button>' +
    '<button type="button" data-act="splitview" data-arg="kreis"' + (pieOk ? "" : " disabled title=\"Kreis nur bei nicht-negativen Werten\"") +
    ' class="' + (state.splitView === "kreis" ? "on" : "") + '">KREIS</button></div>';

  var chart = state.splitView === "kreis"
    ? pieChart(rows, { metric: metric, dim: dim, click: n.kann_tiefer })
    : hBarChart(rows, {
        metric: metric, dim: dim, click: n.kann_tiefer,
        axisTitle: (SPLIT_LBL[metric] || KPIS[metric].name) + " (" + (EINHEIT[metric] || "") + ")",
        title: title
      });

  return '<div class="sec"><div class="sec-head"><div class="sec-title">' + esc(title) + "</div>" +
    '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' + metricTabs + viewTabs + "</div></div>" +
    chart +
    (n.kann_tiefer ? '<div class="sec-note" style="margin-top:12px">Klick auf einen Balken, ein Segment oder eine Legendenzeile führt eine Ebene tiefer (' + esc(kind) + ").</div>" : "") +
    "</div>";
}

function resultSectionHTML() {
  var n = node();
  if (!n.waterfall || !Object.keys(n.waterfall.kostenarten).length) return "";
  return '<div class="sec"><div class="sec-head"><div class="sec-title">Ergebnisrechnung</div>' +
    '<div class="sec-note">Umsatz minus Kostenarten ergibt das Ergebnis · ' + esc(n.titel) + "</div></div>" +
    waterfallChart(n.waterfall) + "</div>";
}

function produkteSectionHTML() {
  var n = node();
  if (!n.produkte || n.produkte.length < 2) return "";
  var isU = state.prodMetric === "umsatz", sz = state.prodSize;
  var val = function (r) {
    var p = isU ? "umsatz" : "becher";
    if (sz === "klein") return r[p + "_klein"] || 0;
    if (sz === "gross") return r[p + "_gross"] || 0;
    return isU ? r.umsatz_eur : r.becher;
  };
  /* die jeweils andere Kennzahl wandert in den Tooltip */
  var other = function (r) {
    var p = isU ? "becher" : "umsatz";
    var v = sz === "klein" ? (r[p + "_klein"] || 0) : sz === "gross" ? (r[p + "_gross"] || 0) : (isU ? r.becher : r.umsatz_eur);
    return isU ? fmtShort(v, "becher") : fmtShort(v, "umsatz_eur");
  };
  var rows = n.produkte.map(function (r) { return { name: r.produkt, v: val(r), sub: other(r) }; })
    .filter(function (r) { return r.v > 0; })
    .sort(function (a, b) { return b.v - a.v; });
  if (!rows.length) return "";
  var metric = isU ? "umsatz_eur" : "becher";

  var szTable = "";
  if (state.role !== "geschaeftsfuehrung") {
    var head = '<thead><tr><th>PRODUKT</th><th>KLEIN 0,2 l</th><th>GROSS 0,4 l</th><th>GESAMT</th></tr></thead>';
    var tot = { k: 0, g: 0 };
    var body = n.produkte.map(function (r) {
      var k = isU ? r.umsatz_klein : r.becher_klein, g = isU ? r.umsatz_gross : r.becher_gross;
      tot.k += k; tot.g += g;
      return "<tr><td>" + esc(r.produkt) + '</td><td class="dim">' + esc(fmtShort(k, metric)) + '</td><td class="dim">' + esc(fmtShort(g, metric)) +
        "</td><td>" + esc(fmtShort(k + g, metric)) + "</td></tr>";
    }).join("");
    body += '<tr class="total"><td>Gesamt</td><td>' + esc(fmtShort(tot.k, metric)) + "</td><td>" + esc(fmtShort(tot.g, metric)) +
      "</td><td>" + esc(fmtShort(tot.k + tot.g, metric)) + "</td></tr>";
    szTable = '<div class="tbl-scroll" style="margin-top:18px"><table class="t">' + head + "<tbody>" + body + "</tbody></table></div>";
  }

  return '<div class="sec"><div class="sec-head"><div class="sec-title">Produkte · ' + (isU ? "Umsatz" : "Menge") + "</div>" +
    '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
    '<div class="seg"><button type="button" data-act="prodmetric" data-arg="menge" class="' + (!isU ? "on" : "") + '">Menge</button>' +
    '<button type="button" data-act="prodmetric" data-arg="umsatz" class="' + (isU ? "on" : "") + '">Umsatz</button></div>' +
    '<div class="seg"><button type="button" data-act="prodsize" data-arg="gesamt" class="' + (sz === "gesamt" ? "on" : "") + '">Gesamt</button>' +
    '<button type="button" data-act="prodsize" data-arg="klein" class="' + (sz === "klein" ? "on" : "") + '">Klein 0,2 l</button>' +
    '<button type="button" data-act="prodsize" data-arg="gross" class="' + (sz === "gross" ? "on" : "") + '">Groß 0,4 l</button></div>' +
    "</div></div>" +
    hBarChart(rows, {
      metric: metric, dim: "produkt",
      axisTitle: isU ? "Umsatz (€)" : "Verkaufte Becher (Stk)",
      title: "Produkte je " + (isU ? "Umsatz" : "verkaufter Menge")
    }) + szTable + "</div>";
}

function tagesSectionHTML() {
  var n = node();
  if (!n.wetter.std || !n.taeglich.length) return "";
  var rain = rainDays(n.wetter.std);
  var dim = n.ebene >= 3 ? (n.ebene >= 4 ? "groesse" : "produkt") : "standort";
  var colorName = n.ebene >= 3 ? n.titel : n.wetter.std;
  var strong = colorFor(colorName, dim);
  var legend = '<div class="chart-legend lg">' +
    '<span class="i"><span class="sw" style="background:' + strong + '"></span>Umsatz je Tag</span>' +
    '<span class="i"><span class="sw" style="background:var(--track)"></span>Regentag (gedämpft)</span>' +
    '<span class="i" style="color:' + cssv("--temp") + '"><span class="sw line"></span>Temperatur</span></div>';
  return '<div class="sec"><div class="sec-head"><div class="sec-title">Verkauf je Tag · ' + esc(n.titel) +
    (n.ebene > 2 ? " am " + esc(n.wetter.std) : "") + "</div></div>" +
    dayChart(n.taeglich, rain, { weather: n.wetter.taeglich, dim: dim, colorName: colorName }) +
    legend + "</div>";
}

function wetterSectionHTML() {
  var n = node();
  if (!n.wetter.taeglich.length) return "";
  if (n.wetter.std && n.taeglich.length) return ""; /* Tagesverlauf zeigt das Wetter bereits */
  return '<div class="sec"><div class="sec-head"><div class="sec-title">Wetter im Zeitraum</div>' +
    '<div class="sec-note">zum Abgleich Regen ↔ Absatz</div></div>' + weatherChart(n.wetter.taeglich) + "</div>";
}

function detailTableHTML() {
  var gran = state.gran || "monat", data = detailRows(gran), n = node();
  if (!data.length) return "";
  var cols = gran === "monat"
    ? [["umsatz_eur", "Umsatz"], ["ergebnis_eur", "Ergebnis"], ["umsatzrendite_pct", "Umsatzrendite"],
       ["wartezeit_min", "Ø Wartezeit"], ["zufriedenheit", "Ø Zufriedenheit"], ["temperatur_c", "Ø Temperatur"], ["niederschlag_mm", "Niederschlag"]]
    : [["umsatz_eur", "Umsatz"], ["becher", "Becher"], ["wartezeit_min", "Ø Wartezeit"],
       ["zufriedenheit", "Ø Zufriedenheit"], ["temperatur_c", "Ø Temperatur"], ["niederschlag_mm", "Niederschlag"]];
  var usable = cols.filter(function (c) { return data.some(function (r) { return r[c[0]] != null; }); });
  var head = "<tr><th>ZEIT</th>" + usable.map(function (c) { return "<th>" + esc(c[1].toUpperCase()) + "</th>"; }).join("") + "</tr>";
  var body = data.map(function (r) {
    return "<tr><td>" + esc(r.label) + "</td>" + usable.map(function (c) {
      return '<td class="' + (c[0] === "ergebnis_eur" ? (r[c[0]] >= 0 ? "pos" : "neg") : "") + '">' + esc(r[c[0]] != null ? fmt(r[c[0]], c[0]) : "–") + "</td>";
    }).join("") + "</tr>";
  }).join("");
  var seg = '<div class="seg">' + [["monat", "Monatlich"], ["woche", "Wöchentlich"], ["tag", "Täglich"]].map(function (g) {
    return '<button type="button" data-act="gran" data-arg="' + g[0] + '" class="' + (gran === g[0] ? "on" : "") + '">' + g[1] + "</button>";
  }).join("") + "</div>";
  return '<div class="sec"><details class="tbl"' + (state.tblOpen ? " open" : "") + '>' +
    "<summary>Detail-Tabelle · " + esc(n.titel) + ' <span class="n">' + data.length + " Zeilen · mit Wetter</span></summary>" +
    '<div class="inner"><div class="sec-head" style="margin-bottom:10px"><div class="sec-note">Auflösung</div>' + seg + "</div>" +
    '<div class="tbl-scroll"><table class="t"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div></div></details></div>";
}

/* --- Ebenen-Baum (Controlling) --- */
function treeHTML() {
  var role = ROLLES[state.role];
  var sel = state.pfad;
  var out = [];
  var totalUm = metrics(salesFilt({}), 1, {}).umsatz_eur;
  out.push('<button type="button" class="tree-row' + (sel.length === 0 ? " sel" : "") + '"' +
    (sel.length === 0 ? ' style="background:' + cssv("--fg") + ';color:' + cssv("--bg") + '"' : "") +
    ' data-act="goto" data-arg="0"><span class="n">▾ Unternehmen</span><span class="v">' + esc(fmtK(totalUm)) + "</span></button>");

  alleStandorte().concat(costOnlyCenters()).forEach(function (st) {
    var open = sel[0] === st;
    var um = metrics(salesFilt({ ebene_2: st }), 2, { ebene_2: st }).umsatz_eur || 0;
    var col = colorFor(st, "standort");
    out.push('<button type="button" class="tree-row l2' + (open ? " sel" : " dim") + '"' + (open ? ' style="background:' + col + '"' : "") +
      ' data-act="path" data-arg="' + esc(st) + '"><span class="n">' + (open ? "▾" : "▸") + " " + esc(st) + '</span><span class="v">' + esc(fmtK(um)) + "</span></button>");
    if (!open) return;
    var kids = {};
    salesFilt({ ebene_2: st }).forEach(function (r) { kids[r.p] = (kids[r.p] || 0) + r.um; });
    Object.keys(kids).sort(function (a, b) { return kids[b] - kids[a]; }).forEach(function (p) {
      var openP = sel[1] === p;
      var pc = colorFor(p, "produkt");
      out.push('<button type="button" class="tree-row l3' + (openP ? " sel" : " dim") + '"' + (openP ? ' style="background:' + pc + ';color:' + (isDark() ? "#161311" : "#fff") + '"' : "") +
        ' data-act="path" data-arg="' + esc(st) + "|" + esc(p) + '"><span class="n">' + (openP ? "▾" : "") + " " + esc(p) + '</span><span class="v">' + esc(fmtK(kids[p])) + "</span></button>");
      if (!openP) return;
      [["klein 0,2 l", "klein"], ["groß 0,4 l", "gross"]].forEach(function (g) {
        var v = 0;
        salesFilt({ ebene_2: st, ebene_3: p }).forEach(function (r) { if (r.g === g[1]) v += r.um; });
        var on = sel[2] === g[0];
        out.push('<button type="button" class="tree-row l4 sub' + (on ? "" : " dim") + '"' +
          (on ? ' style="color:' + colorFor(g[0], "groesse") + ';font-weight:600"' : "") +
          ' data-act="path" data-arg="' + esc(st) + "|" + esc(p) + "|" + esc(g[0]) + '"><span class="n">▸ ' + esc(g[0]) + '</span><span class="v">' + esc(fmtK(v)) + "</span></button>");
      });
    });
  });
  return '<div class="tree"><div class="eyebrow">EBENEN</div><div class="tree-list">' + out.join("") + "</div></div>";
}
function costOnlyCenters() {
  var sales = {}; F.sales.forEach(function (r) { sales[r.s] = 1; });
  var only = {}; F.costs.forEach(function (c) { if (!sales[c.ks]) only[c.ks] = 1; });
  return Object.keys(only).sort();
}

function renderUebersicht() {
  var n = node();
  var body =
    scopeHTML() +
    heroHTML() +
    weatherStripHTML() +
    splitSectionHTML() +
    resultSectionHTML() +
    produkteSectionHTML() +
    tagesSectionHTML() +
    wetterSectionHTML() +
    detailTableHTML();

  var crumbs = (n.max_ebene > ROLLES[state.role].start_ebene) ? crumbsHTML() : "";
  if (state.role === "controlling") {
    return crumbs + '<div class="split">' + treeHTML() + "<div>" + body + "</div></div>";
  }
  return crumbs + body;
}

/* =========================== 8 · Dokumente & Checklisten =========================== */

/* Rezept je Getränk — Zutaten getrennt nach Größe, Zubereitung in Schritten.
   Beispielinhalte: vor dem Echtbetrieb durch die echten Rezepte ersetzen. */
var REZEPTE = {
  "Orangensaft": {
    klein: ["3 Orangen (ca. 350 g)", "15 ml stilles Wasser", "4 g Zucker", "2 Eiswürfel"],
    gross: ["6 Orangen (ca. 700 g)", "30 ml stilles Wasser", "8 g Zucker", "3 Eiswürfel"],
    schritte: [
      "Orangen halbieren, sichtbare Kerne entfernen.",
      "Auf der Zitruspresse auspressen, Fruchtfleisch mitnehmen.",
      "Wasser und Zucker einrühren, bis sich der Zucker gelöst hat.",
      "Über Eis in den Becher füllen, mit einer Orangenscheibe garnieren."
    ],
    zeit: "ca. 2 Min.", allergene: "keine",
    tipp: "Zimmerwarme Orangen geben deutlich mehr Saft — nicht direkt aus dem Kühlschrank pressen."
  },
  "Apfelsaft": {
    klein: ["2–3 Äpfel Gala (ca. 400 g)", "10 ml Wasser", "2 g Zucker", "Spritzer Zitrone"],
    gross: ["5 Äpfel Gala (ca. 800 g)", "20 ml Wasser", "4 g Zucker", "Spritzer Zitrone"],
    schritte: [
      "Äpfel waschen, vierteln, Kerngehäuse entfernen.",
      "Im Entsafter verarbeiten.",
      "Sofort mit Zitrone verrühren — das hält den Saft hell.",
      "Abschmecken, Zucker nur bei sauren Äpfeln zugeben.",
      "Sofort servieren, nicht stehen lassen."
    ],
    zeit: "ca. 3 Min.", allergene: "keine",
    tipp: "Oxidiert schnell und wird braun — immer erst auf Bestellung pressen, nie vorbereiten."
  },
  "Orangen-Karottensaft": {
    klein: ["2 Orangen", "1 Karotte (ca. 80 g)", "3 g Ingwer", "3 g Zucker"],
    gross: ["4 Orangen", "2 Karotten (ca. 160 g)", "5 g Ingwer", "6 g Zucker"],
    schritte: [
      "Karotten schälen und in Stücke schneiden, Ingwer schälen.",
      "Karotten und Ingwer entsaften.",
      "Orangen separat pressen und untermischen.",
      "Kräftig durchrühren — sonst trennen sich die Säfte im Becher."
    ],
    zeit: "ca. 4 Min.", allergene: "keine",
    tipp: "Ingwer sparsam dosieren, er dominiert schnell. Im Zweifel nachlegen statt zu viel nehmen."
  },
  "Zitronensaft": {
    klein: ["1,5 Zitronen", "125 ml kaltes Wasser", "9 g Zucker", "2 Minzblätter"],
    gross: ["3 Zitronen", "250 ml kaltes Wasser", "18 g Zucker", "4 Minzblätter"],
    schritte: [
      "Zucker mit 2 EL heißem Wasser zu Sirup rühren, abkühlen lassen.",
      "Zitronen auspressen.",
      "Sirup, Zitronensaft und kaltes Wasser mischen.",
      "Minze zwischen den Handflächen anklatschen und zugeben.",
      "Über Eis servieren."
    ],
    zeit: "ca. 3 Min.", allergene: "keine",
    tipp: "Sirup morgens für die ganze Schicht ansetzen — spart je Becher rund eine Minute."
  },
  "Apfel-Karottensaft": {
    klein: ["1,5 Äpfel", "1 Karotte (ca. 80 g)", "Spritzer Zitrone"],
    gross: ["3 Äpfel", "2 Karotten (ca. 160 g)", "Spritzer Zitrone"],
    schritte: [
      "Äpfel waschen und vierteln, Karotten schälen.",
      "Abwechselnd entsaften — das mischt gleichmäßiger als nacheinander.",
      "Mit Zitrone abrunden.",
      "Sofort servieren."
    ],
    zeit: "ca. 4 Min.", allergene: "keine",
    tipp: "Nicht stehen lassen, sonst setzt sich die Karotte am Becherboden ab."
  }
};
var PREISE = {
  "Orangensaft": [2.20, 3.80], "Apfelsaft": [2.00, 3.50], "Orangen-Karottensaft": [2.50, 4.20],
  "Zitronensaft": [2.20, 3.80], "Apfel-Karottensaft": [2.50, 4.20]
};
var STANDINFO = {
  "Bahnhof": { adresse: "Bahnhofsplatz 3, 8020 Graz", tel: "+43 664 123 45 67", mail: "bahnhof@limonaden-gmbh.at", leitung: "Marie Kraus", leitungMail: "marie.kraus@limonaden-gmbh.at",
    zeiten: "Mo–Fr 07:00 – 20:00 · Sa 09:00 – 18:00 · So 10:00 – 16:00",
    team: [["Marie K.", "08–14", 4.1], ["Tom R.", "10–18", 4.3], ["Lisa B.", "14–20", 3.9]] },
  "Hauptplatz": { adresse: "Hauptplatz 1, 1010 Wien", tel: "+43 664 123 45 68", mail: "hauptplatz@limonaden-gmbh.at", leitung: "Jonas Weber", leitungMail: "jonas.weber@limonaden-gmbh.at",
    zeiten: "Mo–Sa 08:00 – 20:00 · So 10:00 – 18:00",
    team: [["Jonas W.", "08–15", 4.4], ["Sara P.", "12–20", 4.2]] },
  "Stadtpark": { adresse: "Stadtpark 12, 5020 Salzburg", tel: "+43 664 123 45 69", mail: "stadtpark@limonaden-gmbh.at", leitung: "Nina Fuchs", leitungMail: "nina.fuchs@limonaden-gmbh.at",
    zeiten: "Di–So 09:00 – 19:00 · Mo Ruhetag",
    team: [["Nina F.", "09–15", 4.5], ["Paul M.", "13–19", 4.0]] },
  "Wochenmarkt": { adresse: "Marktplatz 7, 4020 Linz", tel: "+43 664 123 45 70", mail: "wochenmarkt@limonaden-gmbh.at", leitung: "Ali Demir", leitungMail: "ali.demir@limonaden-gmbh.at",
    zeiten: "Mi &amp; Sa 07:00 – 14:00 · sonst geschlossen",
    team: [["Ali D.", "07–14", 4.3]] }
};
var STAND_DEFAULT = {
  zeiten: "Mo–Fr 08:00 – 19:00 · Sa 09:00 – 17:00", adresse: "—", tel: "—", mail: "—",
  leitung: "—", leitungMail: "—", team: []
};
var CHECKLISTEN = {
  beginn: [
    { t: "Kühlschrank-Temperatur prüfen (2–6 °C)", n: "Wert notieren" },
    { t: "Frische Zutaten ausreichend (Orangen, Äpfel, Zitronen, Karotten)" },
    { t: "Presse & Utensilien gereinigt und desinfiziert" },
    { t: "Wechselgeld gezählt", n: "150,00 € Soll" },
    { t: "Kassen-System eingeloggt · Beleg-Rolle geprüft" },
    { t: "Aufsteller / Menütafel platziert · Happy-Hour-Info" },
    { t: "Hände gewaschen · Dresscode erfüllt" },
    { t: "Müllsäcke geprüft, ggf. gewechselt" },
    { t: "Foto Standaufbau → in Chat posten" },
    { t: "Schicht-Übergabe unterschrieben" }
  ],
  ende: [
    { t: "Tagesabschluss im Kassen-System gebucht" },
    { t: "Bargeld gezählt & Differenz dokumentiert", n: "Soll/Ist" },
    { t: "Restware verwertet oder entsorgt (Hygieneprotokoll)" },
    { t: "Presse, Krüge und Arbeitsflächen gereinigt" },
    { t: "Kühlschrank-Temperatur nachgetragen" },
    { t: "Müll entsorgt · Trennung geprüft" },
    { t: "Menütafel, Aufsteller und Schirme eingeräumt" },
    { t: "Bestellung für Folgetag ausgelöst" },
    { t: "Stand abgeschlossen · Strom aus" },
    { t: "Übergabeprotokoll an Standleitung gesendet" }
  ]
};
var DRESSCODE = "weißes Hemd/Poloshirt · schwarze Hose · Schürze mit Logo · rutschfeste Schuhe · Haare zusammengebunden";
var HYGIENE = "Handschuhe bei Zubereitung · Temperatur-Log alle 4 h · Abfall täglich · HACCP-Blatt wöchentlich";

function checkKey(stand, tab) { return "check." + stand + "." + tab + "." + todayISO(); }
function todayISO() { return F.dmax; } /* Beispieldaten: „heute" ist der letzte Datentag */
function getChecks(stand, tab) { return restore(checkKey(stand, tab), {}) || {}; }
function setCheck(stand, tab, idx, on) {
  var c = getChecks(stand, tab); c[idx] = on; store(checkKey(stand, tab), c);
}

function renderDokumente() {
  var stand = docStand();
  if (!stand) return '<div class="sec"><div class="chart-empty">Dokumente gehören zu einem Stand — wähle oben die Rolle „standleitung“ oder klicke dich auf einen Standort.</div></div>';
  var info = STANDINFO[stand] || STAND_DEFAULT;
  var prods = produkteNachRang();
  var openRecipe = state.docRecipe == null ? prods[0] : state.docRecipe;

  /* Rezepte */
  /* Jedes Getränk klappt sein eigenes Rezept auf — Zutaten je Größe,
     Zubereitung in Schritten, dazu Zeit, Allergene und ein Praxis-Tipp. */
  var rez = prods.map(function (p) {
    var open = p === openRecipe, r = REZEPTE[p];
    var head = '<button type="button" class="doc-item' + (open ? " open" : "") + '" data-act="recipe" data-arg="' + esc(p) + '">' +
      '<span><span class="sw" style="background:' + colorFor(p, "produkt") + '"></span>' + esc(p) + "</span>" +
      '<span class="go">' + (open ? "▾ zuklappen" : "▸ Rezept") + "</span></button>";
    if (!open) return head;
    if (!r) return head + '<div class="recipe"><div class="rb">Für dieses Getränk ist noch kein Rezept hinterlegt.</div></div>';
    var zutaten = function (lbl, list) {
      return "<div><div class=\"rt\">Zutaten " + lbl + "</div><ul>" +
        list.map(function (z) { return "<li>" + esc(z) + "</li>"; }).join("") + "</ul></div>";
    };
    return head + '<div class="recipe">' +
      '<div class="rgrid">' + zutaten("0,2 l", r.klein) + zutaten("0,4 l", r.gross) + "</div>" +
      '<div class="rt" style="margin-top:10px">Zubereitung</div>' +
      "<ol class=\"rsteps\">" + r.schritte.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
      '<div class="rmeta"><span>⏱ ' + esc(r.zeit) + "</span><span>Allergene: " + esc(r.allergene) + "</span></div>" +
      '<div class="rtipp"><b>Tipp:</b> ' + esc(r.tipp) + "</div></div>";
  }).join("");
  var recipeBox = "";

  /* Preise */
  var preise = prods.map(function (p) {
    var pr = PREISE[p] || [0, 0];
    return "<tr><td>" + esc(p) + "</td><td>" + pr[0].toFixed(2).replace(".", ",") + " €</td><td>" +
      pr[1].toFixed(2).replace(".", ",") + ' €</td><td class="pos">−0,50 €</td></tr>';
  }).join("");

  /* Checklisten */
  var tab = state.docTab === "ende" ? "ende" : "beginn";
  var items = CHECKLISTEN[tab];
  var checks = getChecks(stand, tab);
  var done = items.filter(function (_, i) { return checks[i]; }).length;
  var list = items.map(function (it, i) {
    var on = !!checks[i];
    return '<label class="check' + (on ? " done" : "") + '"><input type="checkbox" data-act="check" data-arg="' + i + '"' + (on ? " checked" : "") + ">" +
      esc(it.t) + (it.n ? '<span class="note">' + esc(it.n) + "</span>" : "") + "</label>";
  }).join("");

  var teamRows = (info.team || []).map(function (t) {
    return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-2)"><span>' +
      esc(t[0]) + '</span><span style="color:var(--muted)">' + esc(t[1]) + " · " + t[2].toFixed(1).replace(".", ",") + " ★</span></div>";
  }).join("") || '<div style="color:var(--muted)">Keine Schichtplanung hinterlegt.</div>';

  return '<div class="docs-head"><div class="docs-title">Dokumente &amp; Checklisten <span class="sub">· ' + esc(stand) + "</span></div>" +
    '<div class="docs-meta">Stand ' + esc(fmtDE(F.dmax)) + " · alles digital, offline verfügbar · Häkchen werden im Browser gespeichert</div></div>" +
    '<div class="docs-grid">' +

    '<div class="card"><div class="card-head"><div class="card-title">🍋 Getränkerezepte</div>' +
    '<span class="card-meta">' + prods.length + " Rezepte · v3.2</span></div>" +
    '<div class="doc-list">' + rez + "</div>" + recipeBox + "</div>" +

    '<div class="card"><div class="card-head"><div class="card-title">💶 Preise · aktuell</div>' +
    '<span class="card-meta">gültig ab 01.07.2026</span></div>' +
    '<table class="t"><thead><tr><th>GETRÄNK</th><th>0,2 l</th><th>0,4 l</th><th>HAPPY HOUR</th></tr></thead><tbody>' + preise + "</tbody></table>" +
    '<div class="card-meta" style="margin-top:10px">Happy Hour: täglich ab 18:00 Uhr bis Schichtende · gültig ab 01.08.2026</div></div>' +

    '<div class="card"><div class="card-head"><div class="card-title">ℹ Standort-Info</div>' +
    '<span class="card-meta">' + esc(stand) + (ORTE[stand] ? " · " + esc(ORTE[stand].ort) : "") + "</span></div>" +
    '<div class="kv">' +
    '<div class="k">Öffnungszeiten</div><div>' + info.zeiten + "</div>" +
    '<div class="k">Adresse</div><div>' + esc(info.adresse) + "</div>" +
    '<div class="k">Kontakt Stand</div><div>' + esc(info.tel) + " · " + esc(info.mail) + "</div>" +
    '<div class="k">Standleitung</div><div>' + esc(info.leitung) + " · " + esc(info.leitungMail) + "</div>" +
    '<div class="k">Notfall / Zentrale</div><div>+43 1 555 00 00 (24 h) · office@limonaden-gmbh.at</div>' +
    '<div class="k">Dresscode</div><div>' + esc(DRESSCODE) + "</div>" +
    '<div class="k">Hygiene</div><div>' + esc(HYGIENE) + "</div>" +
    '<div class="k">Kassen-System</div><div>SumUp Air · Beleg-Nr. B/… · Tagesabschluss um Schichtende</div>' +
    "</div>" +
    '<div class="eyebrow" style="margin-top:16px">SCHICHT HEUTE</div>' +
    '<div style="font:500 11px \'IBM Plex Sans\'">' + teamRows + "</div></div>" +

    '<div class="card"><div class="card-head"><div class="card-title">✅ Schicht-Checklisten</div>' +
    '<div class="seg"><button type="button" data-act="doctab" data-arg="beginn" class="' + (tab === "beginn" ? "on" : "") + '">Schichtbeginn</button>' +
    '<button type="button" data-act="doctab" data-arg="ende" class="' + (tab === "ende" ? "on" : "") + '">Schichtende</button></div></div>' +
    '<div class="card-meta">' + esc(stand) + " · " + esc(fmtDE(F.dmax)) + " · " + done + " von " + items.length + " erledigt</div>" +
    '<div class="progress"><i style="width:' + (done / items.length * 100).toFixed(0) + '%"></i></div>' +
    '<div class="doc-list">' + list + "</div>" +
    '<div class="doc-foot"><span class="card-meta">' + (done === items.length ? "vollständig — bereit zur Meldung" : "Auto-Sync mit Zentrale") + "</span>" +
    '<span style="display:flex;gap:8px"><button class="btn ghost" data-act="checkreset">Zurücksetzen</button>' +
    '<button class="btn" data-act="checkreport"' + (done === items.length ? "" : " disabled") + ">Als erledigt melden</button></span></div>" +
    '<div class="card-meta" id="checkmsg" style="margin-top:8px"></div></div>' +

    "</div>";
}

/* =========================== 8b · Analyse: Zusammenhänge =========================== */

/* Optionaler Claude-Dienst für die Deutung. Leer = Knopf bleibt aus.
   Siehe app/agent/README.md — der API-Schlüssel gehört auf den Server, nie hierher. */
var AGENT_URL = "";

function miniBars(rows, opts) {
  var max = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.v); }).concat([1]));
  return '<div class="mini">' + rows.map(function (r) {
    return '<div class="mini-row"><span class="n">' + esc(r.name) + "</span>" +
      '<span class="t"><i style="width:' + (Math.abs(r.v) / max * 100).toFixed(1) + "%;background:" +
      (r.color || cssv("--accent")) + '"></i></span>' +
      '<span class="v">' + esc(opts && opts.fmt ? opts.fmt(r.v) : fmtShort(r.v, "umsatz_eur")) + "</span></div>";
  }).join("") + "</div>";
}

function findingCard(f) {
  return '<div class="card finding"><div class="eyebrow">' + esc(f.kat) + "</div>" +
    '<div class="f-val ' + (f.tone || "") + '">' + esc(f.wert) + "</div>" +
    '<div class="f-txt">' + f.text + "</div>" +
    (f.visual ? '<div class="f-vis">' + f.visual + "</div>" : "") +
    '<div class="f-basis">' + esc(f.basis) + "</div></div>";
}

/* Liefert die Befunde als Objekte — die Karten und der optionale
   Claude-Aufruf lesen dieselbe Quelle, damit die Zahlen identisch sind. */
function analyseFindings() {
  var role = ROLLES[state.role];
  var filt = filterOf(role, state.pfad);
  var days = analyseDays(filt);
  var out = { scope: [], days: days.length, findings: [] };
  out.scope.push(istEinzelStand(role) ? aktStand() : (state.pfad[0] || "Unternehmen gesamt"));
  state.pfad.slice(istEinzelStand(role) ? 0 : 1).forEach(function (p) { out.scope.push(p); });
  if (days.length < 10) return out;

  var add = function (o) { out.findings.push(o); };

  /* 1 · Regentage */
  var regen = gruppenVergleich(days, function (d) { return d.regen; }, "umsatz");
  if (regen && regen.delta != null) {
    add({
      key: "regen", kat: "REGEN",
      wert: (regen.delta >= 0 ? "+" : "−") + Math.abs(regen.delta).toFixed(1).replace(".", ",") + " %",
      tone: regen.delta < -3 ? "bad" : regen.delta > 3 ? "good" : "flat",
      satz: "An Regentagen liegt der Tagesumsatz im Schnitt bei " + fmtShort(regen.mit, "umsatz_eur") +
        " statt " + fmtShort(regen.ohne, "umsatz_eur") + " an trockenen Tagen.",
      basis: regen.nMit + " Regentage (ab " + RAIN_MM + " mm) · " + regen.nOhne + " trockene Tage",
      zahlen: { regentag: Math.round(regen.mit), trocken: Math.round(regen.ohne), delta_pct: +regen.delta.toFixed(1) }
    });
  }

  /* 2 · Wochenende */
  var we = gruppenVergleich(days, function (d) { return d.wochenende; }, "umsatz");
  if (we && we.delta != null) {
    add({
      key: "wochenende", kat: "WOCHENENDE",
      wert: (we.delta >= 0 ? "+" : "−") + Math.abs(we.delta).toFixed(1).replace(".", ",") + " %",
      tone: we.delta > 3 ? "good" : we.delta < -3 ? "bad" : "flat",
      satz: "Samstag und Sonntag bringen im Schnitt " + fmtShort(we.mit, "umsatz_eur") +
        " je Tag, Montag bis Freitag " + fmtShort(we.ohne, "umsatz_eur") + ".",
      basis: we.nMit + " Wochenendtage · " + we.nOhne + " Werktage",
      zahlen: { wochenende: Math.round(we.mit), werktag: Math.round(we.ohne), delta_pct: +we.delta.toFixed(1) }
    });
  }

  /* 3 · Temperatur */
  var corr = pearson(days.map(function (d) { return d.temperatur; }), days.map(function (d) { return d.umsatz; }));
  if (corr) {
    var proGrad = corr.slope;
    add({
      key: "temperatur", kat: "TEMPERATUR",
      wert: "r = " + corr.r.toFixed(2).replace(".", ","),
      tone: corr.r > 0.4 ? "good" : corr.r < -0.4 ? "bad" : "flat",
      satz: "Zwischen Tagestemperatur und Umsatz besteht " + corrWort(corr.r) + " Zusammenhang. " +
        "Rechnerisch " + (proGrad >= 0 ? "bringt" : "kostet") + " jedes Grad mehr rund " +
        fmtShort(Math.abs(proGrad), "umsatz_eur") + " Tagesumsatz.",
      basis: corr.n + " Tage mit Wetterdaten",
      fit: corr,
      zahlen: { r: +corr.r.toFixed(2), eur_je_grad: Math.round(proGrad), n: corr.n }
    });
  }

  /* 4 · Wochentage */
  var wt = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
    var v = mean(days.filter(function (d) { return d.dow === i; }).map(function (d) { return d.umsatz; }));
    return { name: WT[i], v: v || 0, wochenende: i >= 5 };
  }).filter(function (r) { return r.v > 0; });
  if (wt.length >= 5) {
    var best = wt.slice().sort(function (a, b) { return b.v - a.v; })[0];
    var schlecht = wt.slice().sort(function (a, b) { return a.v - b.v; })[0];
    add({
      key: "wochentag", kat: "WOCHENTAG",
      wert: best.name + " vs. " + schlecht.name,
      tone: "flat",
      satz: "Der stärkste Tag ist <b>" + esc(best.name) + "</b> mit " + esc(fmtShort(best.v, "umsatz_eur")) +
        ", der schwächste <b>" + esc(schlecht.name) + "</b> mit " + esc(fmtShort(schlecht.v, "umsatz_eur")) +
        " — " + esc((Math.abs(best.v - schlecht.v) / schlecht.v * 100).toFixed(0)) + " % Unterschied.",
      basis: "Mittelwert je Wochentag über " + days.length + " Tage",
      visual: miniBars(wt.map(function (r) {
        return { name: r.name, v: r.v, color: r.wochenende ? cssv("--accent") : cssv("--muted") };
      })),
      zahlen: wt.reduce(function (a, r) { a[r.name] = Math.round(r.v); return a; }, {})
    });
  }

  /* 5 · Wetterempfindlichkeit je Standort */
  if (!filt.ebene_2) {
    var js = regenJeStandort();
    if (js.length > 1) {
      var hart = js[0], mild = js[js.length - 1];
      add({
        key: "standort_regen", kat: "REGEN JE STANDORT",
        wert: hart.name,
        tone: "bad",
        satz: "<b>" + esc(hart.name) + "</b> verliert an Regentagen am meisten (" +
          esc(hart.delta.toFixed(1).replace(".", ",")) + " %), <b>" + esc(mild.name) + "</b> am wenigsten (" +
          esc((mild.delta >= 0 ? "+" : "") + mild.delta.toFixed(1).replace(".", ",")) + " %).",
        basis: "je Standort eigene Wetterreihe",
        visual: miniBars(js.map(function (r) {
          return { name: r.name, v: r.delta, color: r.delta < 0 ? cssv("--bad-fg") : cssv("--ok-fg") };
        }), { fmt: function (v) { return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1).replace(".", ",") + " %"; } }),
        zahlen: js.reduce(function (a, r) { a[r.name] = +r.delta.toFixed(1); return a; }, {})
      });
    }
  }

  /* 6 · Wartezeit und Zufriedenheit.
     Achtung: liegt |r| fast bei 1, sind die beiden Größen rechnerisch aneinander
     gekoppelt und nicht unabhängig gemessen — dann ist das kein Befund, sondern
     eine Eigenschaft der Daten. Genau das ist in den Beispieldaten der Fall. */
  var wz = pearson(days.map(function (d) { return d.wartezeit; }), days.map(function (d) { return d.zufriedenheit; }));
  if (wz) {
    var gekoppelt = Math.abs(wz.r) > 0.98;
    add({
      key: "wartezeit", kat: "WARTEZEIT ↔ ZUFRIEDENHEIT",
      wert: "r = " + wz.r.toFixed(2).replace(".", ","),
      tone: gekoppelt ? "flat" : (wz.r < -0.4 ? "bad" : "flat"),
      satz: gekoppelt
        ? "Die beiden Werte laufen fast exakt gegenläufig (r ≈ " + wz.r.toFixed(2).replace(".", ",") +
          "). Das ist <b>kein inhaltlicher Befund</b>: In den Beispieldaten ist die Zufriedenheit " +
          "direkt aus der Wartezeit berechnet. Aussagekräftig wird der Wert erst mit echten, " +
          "getrennt erhobenen Bewertungen."
        : "Zwischen Wartezeit und Zufriedenheit besteht " + corrWort(wz.r) + " Zusammenhang" +
          (wz.r < 0 ? " — längere Wartezeit, schlechtere Bewertung." : "."),
      basis: wz.n + " Tage" + (gekoppelt ? " · Wert nicht belastbar" : ""),
      zahlen: { r: +wz.r.toFixed(2), n: wz.n, rechnerisch_gekoppelt: gekoppelt }
    });
  }

  /* 7 · Bestes Temperaturfenster */
  var baender = [[-99, 15, "unter 15 °C"], [15, 20, "15–20 °C"], [20, 25, "20–25 °C"], [25, 99, "über 25 °C"]];
  var bd = baender.map(function (b) {
    var v = mean(days.filter(function (d) { return d.temperatur != null && d.temperatur >= b[0] && d.temperatur < b[1]; })
      .map(function (d) { return d.umsatz; }));
    var n = days.filter(function (d) { return d.temperatur != null && d.temperatur >= b[0] && d.temperatur < b[1]; }).length;
    return { name: b[2], v: v || 0, n: n };
  }).filter(function (r) { return r.n >= 3; });
  if (bd.length >= 2) {
    var top = bd.slice().sort(function (a, b) { return b.v - a.v; })[0];
    add({
      key: "temperaturband", kat: "TEMPERATURFENSTER",
      wert: top.name,
      tone: "good",
      satz: "Die besten Tage liegen im Bereich <b>" + esc(top.name) + "</b> mit " +
        esc(fmtShort(top.v, "umsatz_eur")) + " Tagesumsatz.",
      basis: bd.map(function (r) { return r.name + ": " + r.n + " Tage"; }).join(" · "),
      visual: miniBars(bd),
      zahlen: bd.reduce(function (a, r) { a[r.name] = Math.round(r.v); return a; }, {})
    });
  }

  return out;
}

function renderAnalyse() {
  var res = analyseFindings();
  var scope = res.scope.join(" › ");
  if (!res.findings.length) {
    return '<div class="scope">ANALYSE · ' + esc(scope.toUpperCase()) + "</div>" +
      '<div class="sec"><div class="chart-empty">Für eine Auswertung sind mindestens 10 Tage nötig — der gewählte Zeitraum umfasst ' +
      res.days + ".</div></div>";
  }
  var corrF = res.findings.filter(function (f) { return f.key === "temperatur"; })[0];
  var role = ROLLES[state.role];
  var days = analyseDays(filterOf(role, state.pfad));

  var cards = res.findings.map(function (f) {
    return findingCard({
      kat: f.kat, wert: f.wert, tone: f.tone, text: f.satz, visual: f.visual, basis: "Basis: " + f.basis
    });
  }).join("");

  var streuung = corrF ? '<div class="sec"><div class="sec-head"><div class="sec-title">Temperatur gegen Tagesumsatz</div>' +
    '<div class="sec-note">jeder Punkt ist ein Tag</div></div>' +
    scatterChart(days.map(function (d) {
      return { x: d.temperatur, y: d.umsatz, regen: d.regen, d: d.datum, wt: d.wochentag };
    }), { metric: "umsatz_eur", fit: corrF.fit }) + "</div>" : "";

  var agent = AGENT_URL
    ? '<div class="sec"><div class="sec-head"><div class="sec-title">Deutung</div></div>' +
      '<button class="btn" data-act="agent">Deutung von Claude holen</button>' +
      '<div class="agent-out" id="agentout"></div></div>'
    : '<div class="sec"><div class="agent-hint">Eine Deutung in Worten kann Claude ergänzen — dafür muss <code>AGENT_URL</code> ' +
      'in <code>app.js</code> auf den kleinen Dienst aus <code>app/agent/</code> zeigen. Die Zahlen oben rechnet die Seite selbst.</div></div>';

  return '<div class="scope">ANALYSE · ' + esc(scope.toUpperCase()) + " · " + esc(rangeLabel()) + "</div>" +
    '<div class="sec"><div class="sec-head"><div class="sec-title">Was die Zahlen hergeben</div>' +
    '<div class="sec-note">' + res.days + " Tage im Zeitraum · beschreibende Auswertung, kein Beweis für Ursachen</div></div>" +
    '<div class="findings">' + cards + "</div></div>" +
    streuung + agent;
}

/* Deutung beim optionalen Dienst holen — die Zahlen kommen aus analyseFindings(),
   Claude formuliert nur. */
function askAgent() {
  var el = $("#agentout");
  if (!el) return;
  el.className = "agent-out loading";
  el.textContent = "Claude liest die Befunde …";
  var res = analyseFindings();
  fetch(AGENT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: res.scope.join(" › "),
      zeitraum: fmtDE(state.from) + " bis " + fmtDE(state.to),
      tage: res.days,
      befunde: res.findings.map(function (f) {
        return { thema: f.kat, kennwert: f.wert, basis: f.basis, zahlen: f.zahlen };
      })
    })
  }).then(function (r) {
    if (!r.ok) throw new Error("Dienst antwortet mit " + r.status);
    return r.json();
  }).then(function (j) {
    el.className = "agent-out";
    el.innerHTML = String(j.text || "").split(/\n{2,}/).map(function (p) {
      return "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }).catch(function (e) {
    el.className = "agent-out err";
    el.textContent = "Deutung nicht möglich: " + e.message + " — läuft der Dienst aus app/agent/?";
  });
}

/* =========================== 9 · Vergleich (Baukasten) =========================== */

function initCmp() {
  if (state.cmp) return;
  var ms = monthsIn(F.dmin, F.dmax), first = ms[0], last = ms[ms.length - 1];
  state.cmp = {
    metric: "umsatz_eur", serie: "standort", orient: "zeit", stack: false,
    perioden: [{ f: first + "-01", t: monEnd(first) }, { f: last + "-01", t: monEnd(last) }],
    sel: { standort: {}, getraenk: {}, kostenart: {} }
  };
}
function cmpUniverse(dim) { return dim === "getraenk" ? allProductNames() : dim === "kostenart" ? allKostenarten() : cmpStandorte(); }
function cmpStandorte() {
  var fx = ROLLES[state.role].filter && ROLLES[state.role].filter.ebene_2;
  if (fx) return [aktStand()];
  return alleStandorte();
}
function cmpDim(dim) { return dim === "getraenk" ? "produkt" : dim === "kostenart" ? "kostenart" : "standort"; }
function selectedMembers(dim) {
  var uni = cmpUniverse(dim), s = state.cmp.sel[dim], keys = Object.keys(s).filter(function (k) { return s[k]; });
  return keys.length ? uni.filter(function (m) { return s[m]; }) : uni;
}
function selSet(dim) {
  var s = state.cmp.sel[dim], keys = Object.keys(s).filter(function (k) { return s[k]; });
  return keys.length ? keys : null;
}
function cmpMetrics() {
  return [["umsatz_eur", "Umsatz"], ["becher", "Menge"], ["kosten_eur", "Ausgaben"],
          ["ergebnis_eur", "Gewinn"], ["wartezeit_min", "Ø Wartezeit"], ["zufriedenheit", "Ø Zufriedenheit"]];
}
function cmpBreakdowns(metric) {
  if (metric === "kosten_eur") return [["standort", "Standort"], ["kostenart", "Kostenart"]];
  if (metric === "ergebnis_eur") return [["standort", "Standort"]];
  return [["standort", "Standort"], ["getraenk", "Getränk"]];
}
function cmpPivot(p, stdList, itemList, itemKind, metric) {
  var stdSet = {}; stdList.forEach(function (s) { stdSet[s] = 1; });
  var itemSet = itemList ? (function () { var o = {}; itemList.forEach(function (s) { o[s] = 1; }); return o; })() : null;
  var prodF = itemKind === "getraenk" ? itemSet : null;
  var um = 0, be = 0, tx = 0, wz = 0, zf = 0, cnt = 0;
  F.sales.forEach(function (r) {
    if (r.d < p.f || r.d > p.t || !stdSet[r.s]) return;
    if (prodF && !prodF[r.p]) return;
    um += r.um; be += r.be; tx += r.tx; wz += r.wz; zf += r.zf; cnt++;
  });
  if (metric === "umsatz_eur") return cnt ? um : null;
  if (metric === "becher") return cnt ? be : null;
  if (metric === "transaktionen") return cnt ? tx : null;
  if (metric === "wartezeit_min") return tx ? wz / tx : null;
  if (metric === "zufriedenheit") return tx ? zf / tx : null;
  if (metric === "kosten_eur" || metric === "ergebnis_eur") {
    var kaF = itemKind === "kostenart" ? itemSet : null, kos = 0, hit = false;
    F.costs.forEach(function (c) {
      if (!stdSet[c.ks]) return;
      if (kaF && !kaF[c.ka]) return;
      var fr = fracFor(c.mon, p.f, p.t);
      if (fr > 0) { kos += c.be * fr; hit = true; }
    });
    if (metric === "kosten_eur") return hit ? kos : null;
    return (cnt || hit) ? um - kos : null;
  }
  return null;
}
function cmpVal(p, member) {
  var c = state.cmp, metric = c.metric;
  if (c.serie === "standort") {
    return cmpPivot(p, [member], selSet(metric === "kosten_eur" ? "kostenart" : "getraenk"),
      metric === "kosten_eur" ? "kostenart" : "getraenk", metric);
  }
  var std = selSet("standort") || cmpStandorte();
  return cmpPivot(p, std, [member], c.serie, metric);
}
function perLabel(p) {
  var mo = p.f.slice(0, 7);
  if (p.f.slice(8) === "01" && p.t === monEnd(mo)) return MON_KURZ[mo.slice(5, 7)] + " " + mo.slice(0, 4);
  if (p.f === F.dmin && p.t === F.dmax) return "Gesamt";
  return fmtDE(p.f) + "–" + fmtDE(p.t);
}
/* kompakt für die Achsenbeschriftung unter den Balken */
function perLabelShort(p) {
  var mo = p.f.slice(0, 7);
  if (p.f.slice(8) === "01" && p.t === monEnd(mo)) return MON_KURZ[mo.slice(5, 7)];
  if (p.f === F.dmin && p.t === F.dmax) return "Gesamt";
  return p.f.slice(8) + "." + p.f.slice(5, 7) + ".–" + p.t.slice(8) + "." + p.t.slice(5, 7) + ".";
}
function weatherFor(names, from, to) {
  var use = names.filter(function (n) { return F.weather.some(function (w) { return w.s === n; }); });
  if (!use.length) { var all = {}; F.weather.forEach(function (w) { all[w.s] = 1; }); use = Object.keys(all); }
  var tSum = 0, tN = 0, precTot = 0, regTot = 0, mN = 0;
  use.forEach(function (st) {
    var rr = F.weather.filter(function (w) { return w.s === st && w.d >= from && w.d <= to; });
    if (!rr.length) return;
    mN++;
    rr.forEach(function (w) { tSum += w.tmean; tN++; });
    precTot += rr.reduce(function (a, w) { return a + w.prec; }, 0);
    regTot += rr.filter(function (w) { return w.prec > 0; }).length;
  });
  if (!tN) return null;
  return { temp: tSum / tN, prec: precTot / (mN || 1), reg: Math.round(regTot / (mN || 1)) };
}

function chipGroup(dim, label) {
  var uni = cmpUniverse(dim), s = state.cmp.sel[dim];
  var anySel = Object.keys(s).some(function (k) { return s[k]; });
  var chips = '<button type="button" class="chip all' + (anySel ? " off" : "") + '" data-act="cmpall" data-arg="' + dim + '">Alle ' + uni.length + "</button>";
  chips += uni.map(function (m) {
    var on = !!s[m], col = colorFor(m, cmpDim(dim));
    var style = on ? ' style="background:' + col + ';color:' + textOn(col) + '"' : "";
    var dot = on ? "" : '<span class="cdot" style="background:' + col + '"></span>';
    return '<button type="button" class="chip' + (on ? " on" : "") + '"' + style + ' data-act="cmptoggle" data-arg="' + dim + "|" + esc(m) + '">' + dot + esc(m) + "</button>";
  }).join("");
  return '<div class="bfield" style="align-items:flex-start"><span class="blabel" style="padding-top:5px">' + esc(label) + '</span><div class="chips">' + chips + "</div></div>";
}
function textOn(hex) {
  var h = String(hex).replace("#", "");
  if (h.length !== 6) return "#fff";
  var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? "#1a1815" : "#fff";
}

function renderVergleich() {
  initCmp();
  var c = state.cmp, metric = c.metric;
  var istKost = metric === "kosten_eur", istGewinn = metric === "ergebnis_eur";
  var brs = cmpBreakdowns(metric);
  if (!brs.some(function (b) { return b[0] === c.serie; })) c.serie = brs[0][0];

  var stackDim = istKost ? "kostenart" : (istGewinn ? null : "getraenk");
  var canStack = stackDim && c.serie !== stackDim;
  var stacking = c.stack && canStack;

  var members = selectedMembers(c.serie);
  var per = c.perioden;
  var serieLabel = brs.filter(function (b) { return b[0] === c.serie; })[0][1];
  var serPl = { standort: "Standorte", getraenk: "Getränke", kostenart: "Kostenarten" }[c.serie];

  /* ---- Toolbar ---- */
  var toolbar = '<div class="builder">' +
    '<div class="brow">' +
    '<div class="bfield"><span class="blabel">KENNZAHL</span><select class="bsel primary" data-act="cmpset" data-key="metric">' +
      cmpMetrics().map(function (m) { return '<option value="' + m[0] + '"' + (m[0] === metric ? " selected" : "") + ">" + esc(m[1]) + "</option>"; }).join("") + "</select></div>" +
    '<div class="bfield"><span class="blabel">AUFSCHLÜSSELN</span><select class="bsel" data-act="cmpset" data-key="serie">' +
      brs.map(function (b) { return '<option value="' + b[0] + '"' + (b[0] === c.serie ? " selected" : "") + ">" + esc(b[1]) + "</option>"; }).join("") + "</select></div>" +
    '<div class="bfield"><span class="blabel">X-ACHSE</span><select class="bsel" data-act="cmpset" data-key="orient">' +
      '<option value="zeit"' + (c.orient !== "serie" ? " selected" : "") + ">Zeiträume nebeneinander</option>" +
      '<option value="serie"' + (c.orient === "serie" ? " selected" : "") + ">" + esc(serPl) + " nebeneinander</option></select></div>" +
    (canStack ? '<div class="bfield"><span class="blabel">STAPELN</span><div class="seg">' +
      '<button type="button" data-act="cmpstack" data-arg="0" class="' + (!c.stack ? "on" : "") + '">Summe</button>' +
      '<button type="button" data-act="cmpstack" data-arg="1" class="' + (c.stack ? "on" : "") + '">' +
      (stackDim === "kostenart" ? "Kostenarten" : "Getränke") + " gestapelt</button></div></div>" : "") +
    "</div>" +
    '<div class="brow">' + chipGroup(c.serie, serPl.toUpperCase() + " VERGLEICHEN") + "</div>" +
    (c.serie !== "standort" && cmpStandorte().length > 1 ? '<div class="brow">' + chipGroup("standort", "STANDORTE (FILTER)") + "</div>" : "") +
    (istKost && c.serie !== "kostenart" ? '<div class="brow">' + chipGroup("kostenart", "KOSTENARTEN (FILTER)") + "</div>" : "") +
    (!istKost && !istGewinn && c.serie !== "getraenk" ? '<div class="brow">' + chipGroup("getraenk", "GETRÄNKE (FILTER)") + "</div>" : "") +
    '<div class="brow"><div class="bfield" style="align-items:flex-start"><span class="blabel" style="padding-top:6px">ZEITRÄUME</span><div class="chips">' +
      per.map(function (p, i) {
        return '<span class="period"><input type="date" min="' + F.dmin + '" max="' + F.dmax + '" value="' + p.f + '" data-act="cmpper" data-arg="' + i + '|f">' +
          "–<input type=\"date\" min=\"" + F.dmin + '" max="' + F.dmax + '" value="' + p.t + '" data-act="cmpper" data-arg="' + i + '|t">' +
          '<button type="button" class="x" data-act="cmpdel" data-arg="' + i + '"' + (per.length <= 1 ? " disabled" : "") + ' title="Zeitraum entfernen">✕</button></span>';
      }).join("") +
      monthsIn(F.dmin, F.dmax).map(function (mo) {
        return '<button type="button" class="period-add" data-act="cmpaddmon" data-arg="' + mo + '">+ ' + esc(MON_KURZ[mo.slice(5, 7)]) + "</button>";
      }).join("") +
      '<button type="button" class="period-add" data-act="cmpaddall">+ ganzer Zeitraum</button>' +
    "</div></div></div></div>";

  /* ---- Wetter je Zeitraum (nicht bei Ausgaben) ---- */
  var wetter = "";
  if (metric !== "kosten_eur") {
    var stds = c.serie === "standort" ? members : (selSet("standort") || cmpStandorte());
    wetter = '<div class="weather"><span class="wl">☀ WETTER</span>' + per.map(function (p) {
      var w = weatherFor(stds, p.f, p.t);
      return "<span><b>" + esc(perLabel(p)) + "</b> · " + (w ? esc(fmt(w.temp, "temperatur_c") + " · " + fmt(w.prec, "niederschlag_mm") + " · " + w.reg + " Regentage") : "keine Daten") + "</span>";
    }).join("") + "</div>";
  }

  /* ---- Chart ---- */
  var groups, legend = "", chartTitle;
  if (stacking) {
    var segs = selectedMembers(stackDim);
    groups = members.map(function (m) {
      return {
        label: m,
        bars: per.map(function (p) {
          var total = 0;
          var ss = segs.map(function (sg) {
            var v = c.serie === "standort"
              ? cmpPivot(p, [m], [sg], stackDim, metric)
              : cmpPivot(p, selSet("standort") || cmpStandorte(), [m], c.serie, metric);
            if (v != null) total += v;
            return { name: sg, value: v || 0, color: colorFor(sg, cmpDim(stackDim)) };
          });
          return { label: perLabelShort(p), segs: ss, total: total };
        })
      };
    });
    legend = '<div class="chart-legend">' + segs.map(function (sg) {
      return '<span class="i"><span class="sw" style="background:' + colorFor(sg, cmpDim(stackDim)) + '"></span>' + esc(sg) + "</span>";
    }).join("") + "</div>";
    chartTitle = SPLIT_LBL[metric] || KPIS[metric].name;
    chartTitle += " nach " + serieLabel + " · gestapelt nach " + (stackDim === "kostenart" ? "Kostenart" : "Getränk") + (per.length > 1 ? " · Gruppen = Zeiträume" : "");
  } else if (c.orient === "serie") {
    groups = members.map(function (m) {
      return {
        label: m,
        bars: per.map(function (p) {
          var v = cmpVal(p, m);
          return { label: perLabelShort(p), segs: [{ name: "", value: v || 0, color: colorFor(m, cmpDim(c.serie)) }], total: v };
        })
      };
    });
    chartTitle = (SPLIT_LBL[metric] || KPIS[metric].name) + " · " + serPl + " nebeneinander";
  } else {
    groups = per.map(function (p) {
      return {
        label: perLabel(p),
        bars: members.map(function (m) {
          var v = cmpVal(p, m);
          return { label: shortName(m), segs: [{ name: m, value: v || 0, color: colorFor(m, cmpDim(c.serie)) }], total: v };
        })
      };
    });
    legend = '<div class="chart-legend">' + members.map(function (m) {
      return '<span class="i"><span class="sw" style="background:' + colorFor(m, cmpDim(c.serie)) + '"></span>' + esc(m) + "</span>";
    }).join("") + "</div>";
    chartTitle = (SPLIT_LBL[metric] || KPIS[metric].name) + " je Zeitraum · Farbe = " + serieLabel;
  }

  var chart = '<div class="sec"><div class="sec-head"><div class="sec-title">' + esc(chartTitle) + "</div></div>" +
    groupedBars({ groups: groups, metric: metric }) + legend + "</div>";

  /* ---- Δ-Tabelle ---- */
  var mehr = per.length > 1;
  var head = "<tr><th>" + esc(serieLabel.toUpperCase()) + "</th>" +
    per.map(function (p) { return "<th>" + esc(perLabel(p).toUpperCase()) + "</th>"; }).join("") + (mehr ? "<th>Δ</th>" : "") + "</tr>";
  var dcell = function (ys) {
    var f = ys[0], l = ys[ys.length - 1];
    if (f == null || l == null || f === 0) return '<td class="dim">–</td>';
    var d = (l - f) / Math.abs(f) * 100;
    var gut = (d >= 0) === (KPIS[metric].richtung === "groesser_ist_besser");
    return '<td class="' + (gut ? "pos" : "neg") + '">' + (d >= 0 ? "▲ " : "▼ ") + Math.abs(d).toFixed(1).replace(".", ",") + " %</td>";
  };
  var body = members.map(function (m) {
    var ys = per.map(function (p) { return cmpVal(p, m); });
    if (ys.every(function (v) { return v == null; })) return "";
    return "<tr><td>" + esc(m) + "</td>" + ys.map(function (v) { return "<td>" + esc(cmpFmt(v, metric)) + "</td>"; }).join("") + (mehr ? dcell(ys) : "") + "</tr>";
  }).join("");
  var gesamt = "";
  if (ADDITIV[metric] && members.length > 1) {
    var sums = per.map(function (p) {
      return members.reduce(function (a, m) { var v = cmpVal(p, m); return a + (v || 0); }, 0);
    });
    gesamt = '<tr class="total"><td>Gesamt</td>' + sums.map(function (v) { return "<td>" + esc(cmpFmt(v, metric)) + "</td>"; }).join("") + (mehr ? dcell(sums) : "") + "</tr>";
  }
  var table = '<div class="sec"><div class="tbl-scroll"><table class="t"><thead>' + head + "</thead><tbody>" + body + gesamt + "</tbody></table></div></div>";

  return '<div class="scope">VERGLEICH · ' + esc((SPLIT_LBL[metric] || KPIS[metric].name).toUpperCase()) + " NACH " + esc(serieLabel.toUpperCase()) +
    " · " + esc(per.map(perLabel).join(" vs ").toUpperCase()) + "</div>" + toolbar + wetter + chart + table;
}
function shortName(s) { return String(s).length > 14 ? String(s).slice(0, 12) + "…" : String(s); }
function cmpFmt(v, metric) {
  if (v == null || isNaN(v)) return "–";
  var e = EINHEIT[metric] || "";
  if (e === "€") return fmtShort(v, metric);
  if (e === "%") return v.toFixed(1).replace(".", ",") + " %";
  if (metric === "wartezeit_min" || metric === "zufriedenheit") return v.toFixed(2).replace(".", ",") + (e ? " " + e : "");
  return Math.round(v).toLocaleString("de-DE") + (e ? " " + e : "");
}

/* =========================== 10 · Einstellungen (Drawer) =========================== */

function renderThresholds() {
  var order = ["umsatzrendite_pct", "wartezeit_min", "zufriedenheit", "ergebnis_eur"];
  var head = '<div class="hd">KENNZAHL</div>' +
    '<div class="hd"><span class="d" style="background:var(--rot)"></span>ROT</div>' +
    '<div class="hd"><span class="d" style="background:var(--gelb)"></span>GELB</div>';
  var rows = order.filter(function (k) { return AMPEL[k]; }).map(function (kid) {
    var a = AMPEL[kid], nm = KPIS[kid] ? KPIS[kid].name : kid, e = EINHEIT[kid] || "";
    var inv = a.dir === "kl";
    return "<div>" + esc(nm) + ' <span class="unit">(' + esc(e) + (inv ? ", ▲" : "") + ")</span></div>" +
      '<input class="numin" type="number" step="' + a.step + '"' + (a.min != null ? ' min="' + a.min + '"' : "") + (a.max != null ? ' max="' + a.max + '"' : "") +
      ' value="' + a.redT + '" data-amp="' + kid + '" data-which="redT" aria-label="' + esc(nm) + (inv ? " rot ab" : " rot unter") + '">' +
      '<input class="numin" type="number" step="' + a.step + '"' + (a.min != null ? ' min="' + a.min + '"' : "") + (a.max != null ? ' max="' + a.max + '"' : "") +
      ' value="' + a.yellowT + '" data-amp="' + kid + '" data-which="yellowT" aria-label="' + esc(nm) + (inv ? " gelb ab" : " gelb unter") + '">';
  }).join("");
  $("#thresholds").innerHTML = head + rows;
}
function renderSwatches() {
  var cur = restore("ampelColors", AMPEL_DEFAULT_COLORS) || AMPEL_DEFAULT_COLORS;
  var defs = [["gruen", "grün", "#fff"], ["gelb", "gelb", "#1a1815"], ["rot", "rot", "#fff"]];
  $("#swatches").innerHTML = defs.map(function (d) {
    var c = cur[d[0]] || AMPEL_DEFAULT_COLORS[d[0]];
    return '<div class="swatch"><span class="cap">' + d[1] + "</span>" +
      '<label style="background:' + c + ';color:' + textOn(c) + '">✓ ausgewählt<input type="color" value="' + c + '" data-amp-color="' + d[0] + '"></label>' +
      '<span class="hex">' + c + "</span></div>";
  }).join("");
  $("#palettenote").innerHTML = "<span>Standorte:</span>" + alleStandorte().map(function (s) {
    return '<i><span class="sw" style="background:' + colorFor(s, "standort") + '"></span>' + esc(s) + "</i>";
  }).join("");
}
function applyAmpelColors() {
  var cur = restore("ampelColors", null);
  ["gruen", "gelb", "rot"].forEach(function (k) {
    if (cur && cur[k]) document.documentElement.style.setProperty("--" + k, cur[k]);
    else document.documentElement.style.removeProperty("--" + k);
  });
}
function openDrawer() {
  renderThresholds(); renderSwatches();
  $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("open");
}
function closeDrawer() {
  $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true");
  $("#scrim").classList.remove("open");
}

/* =========================== 11 · Excel-Import =========================== */

function loadXLSX(cb) {
  if (typeof XLSX !== "undefined") { cb(true); return; }
  var srcs = ["https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
              "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"];
  var i = 0;
  (function nx() {
    if (typeof XLSX !== "undefined") { cb(true); return; }
    if (i >= srcs.length) { cb(false); return; }
    var sc = document.createElement("script");
    sc.src = srcs[i++]; sc.onload = function () { cb(true); }; sc.onerror = nx;
    document.head.appendChild(sc);
  })();
}
function isoOf(v) {
  if (v instanceof Date) return isoD(v);
  var s = String(v), m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  var d = s.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (d) return d[3] + "-" + d[2].padStart(2, "0") + "-" + d[1].padStart(2, "0");
  return s.slice(0, 10);
}
function num(v) {
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0;
}
function sheetRows(wb, name) {
  var ws = wb.Sheets[name];
  if (!ws) return [];
  var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, cellDates: true });
  var hi = aoa.findIndex(function (r) {
    return r && r.some(function (c) { return /^(Standort|Kostenstelle|BonNr|BuchNr)$/i.test(String(c).trim()); });
  });
  if (hi < 0) hi = 0;
  var head = aoa[hi].map(function (c) { return String(c).trim(); }), out = [];
  for (var i = hi + 1; i < aoa.length; i++) {
    var r = aoa[i];
    if (!r || r.every(function (c) { return c == null || c === ""; })) continue;
    var o = {}; head.forEach(function (h, j) { o[h] = r[j]; });
    out.push(o);
  }
  return out;
}
function importExcel(file) {
  var msg = $("#uploadmsg");
  msg.className = ""; msg.textContent = "Lese Datei …";
  loadXLSX(function (ok) {
    if (!ok) { msg.className = "err"; msg.textContent = "Excel-Bibliothek konnte nicht geladen werden (offline?)."; return; }
    var rd = new FileReader();
    rd.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: "array", cellDates: true });
        var bon = sheetRows(wb, "Bonierungen"), aus = sheetRows(wb, "Ausgaben");
        if (!bon.length) { msg.className = "err"; msg.textContent = "Blatt „Bonierungen“ nicht gefunden."; return; }
        var sm = {};
        bon.forEach(function (r) {
          var d = isoOf(r["Datum"]);
          if (!d || d.length < 10) return;
          var s = String(r["Standort"] || "").trim(), p = String(r["Produkt"] || "").trim();
          var g = String(r["Größe"] || r["Groesse"] || "").indexOf("klein") >= 0 ? "klein" : "gross";
          var k = d + "|" + s + "|" + p + "|" + g;
          var o = sm[k] || (sm[k] = { d: d, s: s, p: p, g: g, um: 0, be: 0, tx: 0, wz: 0, zf: 0 });
          o.um += num(r["Betrag (€)"]); o.be += num(r["Menge"]); o.tx += 1;
          o.wz += num(r["Wartezeit (Min.)"]); o.zf += num(r["Zufriedenheit"]);
        });
        var sales = Object.keys(sm).map(function (k) { return sm[k]; });
        if (!sales.length) { msg.className = "err"; msg.textContent = "Keine gültigen Verkaufszeilen gefunden."; return; }
        var jahr = sales[0].d.slice(0, 4), cm = {};
        aus.forEach(function (r) {
          var mn = MON_NUM[String(r["Monat"] || "").trim().toLowerCase()];
          if (!mn) return;
          var mon = jahr + "-" + mn, ks = String(r["Kostenstelle"] || "").trim(), ka = String(r["Kategorie"] || "").trim();
          var k = mon + "|" + ks + "|" + ka;
          var o = cm[k] || (cm[k] = { mon: mon, ks: ks, ka: ka, be: 0 });
          o.be += num(r["Betrag (€)"]);
        });
        F.sales = sales;
        F.costs = Object.keys(cm).map(function (k) { return cm[k]; });
        var ds = sales.map(function (r) { return r.d; }).sort();
        F.dmin = ds[0]; F.dmax = ds[ds.length - 1];
        state.pfad = []; state.standWahl = null; state.cmp = null;
        state.from = F.dmin; state.to = F.dmax; state.rangeKey = "all";
        buildColors();
        $("#dropname").innerHTML = esc(file.name) + ' <span id="dropmeta">· ' + esc(bon.length.toLocaleString("de-DE")) + " Zeilen</span>";
        msg.className = "ok";
        msg.textContent = "Import ok: " + sales.length.toLocaleString("de-DE") + " Verkaufstage, Zeitraum " + fmtDE(F.dmin) + " bis " + fmtDE(F.dmax) + ".";
        render();
      } catch (err) {
        msg.className = "err"; msg.textContent = "Fehler beim Lesen: " + err.message;
      }
    };
    rd.readAsArrayBuffer(file);
  });
}

/* =========================== 12 · Render & Events =========================== */

function render() {
  CUR = computeNode();
  fillCommandBar();
  var el = $("#content");
  var html;
  if (state.mode === "vergleich") html = renderVergleich();
  else if (state.mode === "dokumente") html = renderDokumente();
  else if (state.mode === "analyse") html = renderAnalyse();
  else html = renderUebersicht();
  el.innerHTML = html;
  if (state.rangeKey === "custom") injectDateInputs();
}
function injectDateInputs() {
  var bar = $(".cmd .right");
  if ($("#dfrom")) return;
  var wrap = document.createElement("span");
  wrap.className = "period";
  wrap.style.marginRight = "6px";
  wrap.innerHTML = '<input type="date" id="dfrom" min="' + F.dmin + '" max="' + F.dmax + '" value="' + state.from + '">' +
    '–<input type="date" id="dto" min="' + F.dmin + '" max="' + F.dmax + '" value="' + state.to + '">';
  bar.insertBefore(wrap, bar.firstChild);
  wrap.addEventListener("change", function (e) {
    var f = $("#dfrom").value || state.from, t = $("#dto").value || state.to;
    setRange(f, t, "custom");
  });
}
function dropDateInputs() {
  var d = $("#dfrom");
  if (d && d.parentNode) d.parentNode.remove();
}

function drill(name) { state.pfad = state.pfad.concat([name]); state.cmp = null; leaveDocsIfGone(); render(); }
function goto(i) { state.pfad = state.pfad.slice(0, i); state.cmp = null; leaveDocsIfGone(); render(); }
function leaveDocsIfGone() { if (state.mode === "dokumente" && !docStand()) state.mode = "uebersicht"; }

function onAction(act, arg, ev) {
  switch (act) {
    case "drill": drill(arg); break;
    case "goto": goto(+arg); break;
    case "up": if (state.pfad.length) goto(state.pfad.length - 1); break;
    case "path": state.pfad = arg ? arg.split("|") : []; state.cmp = null; render(); break;
    case "splitmetric": state.splitMetric = arg; render(); break;
    case "splitview": state.splitView = arg; store("splitView", arg); render(); break;
    case "prodmetric": state.prodMetric = arg; render(); break;
    case "prodsize": state.prodSize = arg; render(); break;
    case "gran": state.gran = arg; render(); break;
    case "recipe": state.docRecipe = (state.docRecipe === arg ? "" : arg); render(); break;
    case "doctab": state.docTab = arg; render(); break;
    case "checkreset":
      store(checkKey(docStand(), state.docTab), {});
      render();
      break;
    case "checkreport": {
      var st = docStand();
      store("reported." + st + "." + state.docTab + "." + todayISO(), new Date().toISOString());
      render();
      var m = $("#checkmsg");
      if (m) m.textContent = "✓ Gemeldet an die Zentrale — " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr (lokal gespeichert).";
      break;
    }
    case "cmpall": state.cmp.sel[arg] = {}; render(); break;
    case "cmptoggle": {
      var p = arg.split("|"), dim = p[0], nm = p.slice(1).join("|");
      state.cmp.sel[dim][nm] = !state.cmp.sel[dim][nm];
      render();
      break;
    }
    case "cmpstack": state.cmp.stack = arg === "1"; render(); break;
    case "cmpdel": if (state.cmp.perioden.length > 1) { state.cmp.perioden.splice(+arg, 1); render(); } break;
    case "cmpaddmon": if (state.cmp.perioden.length < 8) { state.cmp.perioden.push({ f: arg + "-01", t: monEnd(arg) }); render(); } break;
    case "cmpaddall": if (state.cmp.perioden.length < 8) { state.cmp.perioden.push({ f: F.dmin, t: F.dmax }); render(); } break;
    case "agent": askAgent(); break;
  }
}

$("#content").addEventListener("toggle", function (e) {
  if (e.target.matches && e.target.matches("details.tbl")) state.tblOpen = e.target.open;
}, true);
$("#content").addEventListener("click", function (e) {
  var t = e.target.closest("[data-act]");
  if (!t) return;
  var act = t.dataset.act;
  if (act === "check" || act === "cmpset" || act === "cmpper") return; /* change-Events */
  e.preventDefault();
  onAction(act, t.dataset.arg, e);
});
$("#content").addEventListener("change", function (e) {
  var t = e.target.closest("[data-act]");
  if (!t) return;
  var act = t.dataset.act;
  if (act === "check") {
    setCheck(docStand(), state.docTab, +t.dataset.arg, t.checked);
    render();
  } else if (act === "cmpset") {
    var key = t.dataset.key;
    state.cmp[key] = t.value;
    if (key === "metric") {
      var bs = cmpBreakdowns(t.value).map(function (b) { return b[0]; });
      if (bs.indexOf(state.cmp.serie) < 0) state.cmp.serie = bs[0];
    }
    render();
  } else if (act === "cmpper") {
    var p = t.dataset.arg.split("|");
    state.cmp.perioden[+p[0]][p[1]] = t.value;
    render();
  }
});

/* Command-Bar */
$("#rolesel").addEventListener("change", function () {
  state.role = this.value; state.pfad = []; state.standWahl = null; state.cmp = null;
  if (state.mode === "dokumente" && !docStand()) state.mode = "uebersicht";
  store("role", state.role);
  render();
});
$("#standsel").addEventListener("change", function () {
  state.standWahl = this.value; state.pfad = []; state.cmp = null; render();
});
$("#rangesel").addEventListener("change", function () {
  var v = this.value;
  if (v === "all") { dropDateInputs(); setRange(F.dmin, F.dmax, "all"); }
  else if (v === "custom") { state.rangeKey = "custom"; render(); }
  else { dropDateInputs(); setRange(v + "-01", monEnd(v), v); }
});
$$(".cmd .tab[data-mode]").forEach(function (b) {
  b.addEventListener("click", function () { state.mode = b.dataset.mode; state.cmp = state.mode === "vergleich" ? state.cmp : null; render(); });
});
$("#tab-s").addEventListener("click", openDrawer);
$("#logoutbtn").addEventListener("click", function () {
  closeDrawer();
  $("#modal").classList.remove("open");
  leaveCockpit();
});
$("#themebtn").addEventListener("click", function () {
  var dark = !isDark();
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  store("theme", dark ? "dark" : "light");
  buildColors();
  render();
  if ($("#drawer").classList.contains("open")) renderSwatches();
});

/* Drawer */
$("#drawerclose").addEventListener("click", closeDrawer);
$("#drawerdone").addEventListener("click", closeDrawer);
$("#scrim").addEventListener("click", closeDrawer);
$("#thresholds").addEventListener("change", function (e) {
  var t = e.target;
  if (!t.dataset.amp) return;
  var v = parseFloat(String(t.value).replace(",", "."));
  if (isNaN(v)) { t.value = AMPEL[t.dataset.amp][t.dataset.which]; return; }
  AMPEL[t.dataset.amp][t.dataset.which] = v;
  store("ampel", AMPEL);
  flashSaved();
  render();
});
$("#swatches").addEventListener("input", function (e) {
  var t = e.target;
  if (!t.dataset.ampColor) return;
  var cur = restore("ampelColors", {}) || {};
  cur[t.dataset.ampColor] = t.value;
  store("ampelColors", cur);
  applyAmpelColors();
  renderSwatches();
  flashSaved();
  render();
});
function flashSaved() {
  var el = $("#savednote");
  el.textContent = "gespeichert ✓";
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(function () { el.textContent = "automatisch gespeichert"; }, 1600);
}
$("#xlsxfile").addEventListener("change", function (e) { if (e.target.files[0]) importExcel(e.target.files[0]); });
["dragenter", "dragover"].forEach(function (ev) {
  $("#drop").addEventListener(ev, function (e) { e.preventDefault(); this.classList.add("over"); });
});
["dragleave", "drop"].forEach(function (ev) {
  $("#drop").addEventListener(ev, function (e) { e.preventDefault(); this.classList.remove("over"); });
});
$("#drop").addEventListener("drop", function (e) {
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) importExcel(f);
});
$("#helpbtn").addEventListener("click", function () { $("#modal").classList.add("open"); });
$("#modalclose").addEventListener("click", function () { $("#modal").classList.remove("open"); });
$("#modal").addEventListener("click", function (e) { if (e.target.id === "modal") this.classList.remove("open"); });
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  $("#modal").classList.remove("open");
  closeDrawer();
});

/* =========================== 13 · Deckfolie / Login =========================== */

/* Optionales Hintergrund-Video. Leer lassen → die animierte SVG-Szene läuft.
   Pfad zu einer .mp4 eintragen (Datei neben die HTML legen) → das Video ersetzt
   die Szene, sobald es abspielbar ist; schlägt das Laden fehl, bleibt die Szene. */
var VIDEO_SRC = "";
if (VIDEO_SRC) {
  (function () {
    var v = document.createElement("video");
    v.autoplay = v.loop = v.muted = v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.addEventListener("canplay", function () {
      var fb = $("#bgvid .fallback");
      if (fb) fb.style.display = "none";
      $("#bgvid").insertBefore(v, $("#bgvid").firstChild);
    }, { once: true });
    v.src = VIDEO_SRC;
  })();
}

function leaveCockpit() {
  var deck = $("#deck");
  deck.style.display = "";
  /* Reflow erzwingen, damit der Übergang auch beim erneuten Einblenden läuft */
  void deck.offsetWidth;
  deck.classList.remove("gone");
  document.body.classList.add("deck-up");
  $("#app").setAttribute("aria-hidden", "true");
  window.scrollTo(0, 0);
  $("#loginuser").value = state.user;
  $("#loginerr").textContent = "";
}

function enterCockpit(user) {
  state.user = user || state.user;
  var deck = $("#deck");
  document.body.classList.remove("deck-up");
  deck.classList.add("gone");
  $("#app").setAttribute("aria-hidden", "false");
  fillCommandBar();
  setTimeout(function () { deck.style.display = "none"; }, 950);
}
/* Beide Felder müssen ausgefüllt sein — mehr kann eine Seite ohne Backend nicht
   prüfen. Der Benutzername steuert, was oben rechts im Cockpit steht. */
$("#loginform").addEventListener("submit", function (e) {
  e.preventDefault();
  var u = $("#loginuser").value.trim(), p = $("#loginpass").value;
  if (!u || !p) {
    $("#loginerr").textContent = !u ? "Bitte Benutzername eingeben." : "Bitte Kennwort eingeben.";
    (!u ? $("#loginuser") : $("#loginpass")).focus();
    return;
  }
  $("#loginerr").textContent = "";
  if ($("#loginremember").checked) store("user", u);
  enterCockpit(u);
});
$("#loginforgot").addEventListener("click", function () {
  $("#loginerr").textContent = "Demo-Ansicht — jedes Kennwort wird akzeptiert.";
});

/* =========================== 14 · Init =========================== */

(function init() {
  var savedTheme = restore("theme", null);
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
  else if (window.matchMedia && matchMedia("(prefers-color-scheme:dark)").matches)
    document.documentElement.setAttribute("data-theme", "dark");

  var savedAmpel = restore("ampel", null);
  if (savedAmpel) Object.keys(AMPEL).forEach(function (k) {
    if (savedAmpel[k]) { AMPEL[k].yellowT = savedAmpel[k].yellowT; AMPEL[k].redT = savedAmpel[k].redT; }
  });
  applyAmpelColors();

  var savedRole = restore("role", null);
  state.role = (savedRole && ROLLES[savedRole]) ? savedRole : Object.keys(ROLLES)[0];
  /* frühere Fassungen speicherten "kuchen" — auf den neuen Namen umbiegen */
  state.splitView = restore("splitView", "kreis") === "balken" ? "balken" : "kreis";
  var savedUser = restore("user", null);
  if (savedUser) { state.user = savedUser; $("#loginuser").value = savedUser; }

  document.body.classList.add("deck-up");
  buildColors();
  render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fillCommandBar);
})();

})();
