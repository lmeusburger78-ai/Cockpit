/* ============================================================
   util.js – Formatierung, DOM-Helfer, Farben
   ============================================================ */
window.Cockpit = window.Cockpit || {};

(function (C) {
  "use strict";

  // ---- DOM helpers ----
  C.$ = (sel, root) => (root || document).querySelector(sel);
  C.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** Create an element from a tag, props and children. */
  C.el = function (tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k.startsWith("on") && typeof v === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v !== null && v !== undefined && v !== false) {
          node.setAttribute(k, v);
        }
      }
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  };

  // ---- Formatting ----
  const CURRENCY = { symbol: "€", locale: "de-DE", code: "EUR" };
  C.setCurrency = (code) => {
    CURRENCY.code = code;
    CURRENCY.symbol = code === "USD" ? "$" : code === "GBP" ? "£" : code === "CHF" ? "CHF" : "€";
  };

  C.fmtMoney = function (n, opts) {
    if (n === null || n === undefined || isNaN(n)) return "–";
    const o = opts || {};
    return new Intl.NumberFormat(CURRENCY.locale, {
      style: "currency",
      currency: CURRENCY.code,
      minimumFractionDigits: o.min ?? 2,
      maximumFractionDigits: o.max ?? 2,
    }).format(n);
  };

  C.fmtNum = (n, dec = 2) =>
    n === null || n === undefined || isNaN(n)
      ? "–"
      : new Intl.NumberFormat("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);

  C.fmtPct = function (n, withSign = true) {
    if (n === null || n === undefined || isNaN(n)) return "–";
    const s = (withSign && n > 0 ? "+" : "") + C.fmtNum(n, 2) + " %";
    return s;
  };

  C.fmtDate = function (ts) {
    const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
  };

  C.fmtRel = function (ts) {
    const diff = Date.now() - (typeof ts === "number" ? ts : new Date(ts).getTime());
    const h = Math.floor(diff / 3.6e6);
    if (h < 1) return "vor " + Math.max(1, Math.floor(diff / 6e4)) + " Min.";
    if (h < 24) return "vor " + h + " Std.";
    const d = Math.floor(h / 24);
    if (d < 30) return "vor " + d + " Tg.";
    return C.fmtDate(ts);
  };

  C.signClass = (n) => (n > 0 ? "up" : n < 0 ? "down" : "");
  C.arrow = (n) => (n > 0 ? "▲" : n < 0 ? "▼" : "•");

  // ---- Chart palette from CSS variables ----
  C.palette = function (n) {
    const cs = getComputedStyle(document.documentElement);
    const cols = [];
    for (let i = 1; i <= 12; i++) cols.push(cs.getPropertyValue("--c" + i).trim());
    const out = [];
    for (let i = 0; i < n; i++) out.push(cols[i % cols.length]);
    return out;
  };
  C.cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // ---- Seeded RNG (mulberry32) for reproducible demo series ----
  C.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  C.hashSeed = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // ---- Toast ----
  let toastTimer;
  C.toast = function (msg) {
    const t = C.$("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  };
})(window.Cockpit);
