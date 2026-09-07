/* ============================================================
   state.js – Persistenz (localStorage): Portfolio, Watchlist, Settings
   ============================================================ */
window.Cockpit = window.Cockpit || {};

(function (C) {
  "use strict";

  const KEY = "cockpit.v1";

  const DEFAULTS = {
    portfolio: null,   // wird beim ersten Start aus DEFAULT_PORTFOLIO gefüllt
    watchlist: null,
    customUniverse: {}, // vom Nutzer manuell angelegte Titel
    settings: {
      provider: "demo",     // "demo" | "finnhub"
      finnhubKey: "",
      currency: "EUR",
      theme: "dark",
      period: 180,          // Tage für Zeitverlauf
      benchmark: true,
    },
  };

  let store;

  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
    store = raw || {};
    if (!store.portfolio) store.portfolio = C.DEFAULT_PORTFOLIO.map((x) => ({ ...x }));
    if (!store.watchlist) store.watchlist = [...C.DEFAULT_WATCHLIST];
    if (!store.customUniverse) store.customUniverse = {};
    store.settings = Object.assign({}, DEFAULTS.settings, store.settings || {});
    // Eigene Titel ins Universum übernehmen
    Object.assign(C.UNIVERSE, store.customUniverse);
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (_) { C.toast("Speichern nicht möglich (Speicher voll oder blockiert)."); }
  }

  C.state = {
    init() { load(); C.setCurrency(store.settings.currency); },

    // ---- Portfolio ----
    portfolio: () => store.portfolio,
    setPortfolio(list) { store.portfolio = list; persist(); },
    addHolding(h) {
      const ex = store.portfolio.find((p) => p.symbol === h.symbol);
      if (ex) { ex.shares = h.shares; ex.avgPrice = h.avgPrice; }
      else store.portfolio.push(h);
      persist();
    },
    removeHolding(sym) {
      store.portfolio = store.portfolio.filter((p) => p.symbol !== sym);
      persist();
    },

    // ---- Eigene (manuelle) Titel ----
    addCustomStock(sym, name, sector) {
      const s = sym.toUpperCase().trim();
      store.customUniverse[s] = { name: name || s, sector: sector || "Sonstige", base: 100 };
      C.UNIVERSE[s] = store.customUniverse[s];
      persist();
      return s;
    },

    // ---- Watchlist ----
    watchlist: () => store.watchlist,
    addWatch(sym) {
      if (!store.watchlist.includes(sym)) { store.watchlist.push(sym); persist(); }
    },
    removeWatch(sym) {
      store.watchlist = store.watchlist.filter((s) => s !== sym);
      persist();
    },

    // ---- Settings ----
    settings: () => store.settings,
    setSettings(patch) {
      Object.assign(store.settings, patch);
      if (patch.currency) C.setCurrency(patch.currency);
      persist();
    },

    // ---- alle Symbole (Portfolio + Watchlist), eindeutig ----
    allSymbols() {
      const set = new Set([...store.portfolio.map((p) => p.symbol), ...store.watchlist]);
      return Array.from(set);
    },
  };
})(window.Cockpit);
