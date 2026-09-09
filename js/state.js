/* ============================================================
   state.js – Persistenz: Portfolio, Watchlist, Settings, eigene Titel
   ------------------------------------------------------------
   Zwei Backends:
   - lokal  : localStorage (Einzelbenutzer, Standard)
   - cloud  : Supabase (Mehrbenutzer mit Login), pro Nutzer eine Zeile
   Die Seiten lesen weiterhin synchron aus dem In-Memory-Store.
   ============================================================ */
window.Cockpit = window.Cockpit || {};

(function (C) {
  "use strict";

  const KEY = "cockpit.v1";

  const DEFAULTS = {
    settings: {
      provider: "demo",     // "demo" | "finnhub"
      finnhubKey: "",
      currency: "EUR",
      theme: "dark",
      period: 180,
      benchmark: true,
    },
  };

  let store = null;
  let cloudUserId = null;   // gesetzt = Cloud-Modus für diesen Nutzer
  let saveTimer = null;

  function applyDefaults(raw) {
    store = raw && typeof raw === "object" ? raw : {};
    if (!Array.isArray(store.portfolio)) store.portfolio = C.DEFAULT_PORTFOLIO.map((x) => ({ ...x }));
    if (!Array.isArray(store.watchlist)) store.watchlist = [...C.DEFAULT_WATCHLIST];
    if (!store.customUniverse || typeof store.customUniverse !== "object") store.customUniverse = {};
    store.settings = Object.assign({}, DEFAULTS.settings, store.settings || {});
    Object.assign(C.UNIVERSE, store.customUniverse);
    C.setCurrency(store.settings.currency);
  }

  function loadLocalRaw() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (_) { return null; }
  }

  function persist() {
    if (!store) return;
    if (!cloudUserId) {
      try { localStorage.setItem(KEY, JSON.stringify(store)); }
      catch (_) { C.toast("Speichern nicht möglich (Speicher voll oder blockiert)."); }
    } else if (C.auth) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        C.auth.saveData(cloudUserId, store).catch((e) => C.toast("Cloud-Speichern fehlgeschlagen: " + e.message));
      }, 700);
    }
  }

  C.state = {
    // ---- Initialisierung ----
    /** Lokaler Modus (kein Login). */
    initLocal() { cloudUserId = null; applyDefaults(loadLocalRaw()); },

    /** Cloud-Modus: Daten des angemeldeten Nutzers laden. */
    async initCloud(userId) {
      cloudUserId = userId;
      let raw = null;
      try { raw = await C.auth.loadData(userId); }
      catch (e) { C.toast("Cloud-Daten konnten nicht geladen werden: " + e.message); }
      const firstLogin = !raw;
      applyDefaults(raw);
      if (firstLogin) persist(); // erste Zeile für den Nutzer anlegen
    },

    /** Beim Logout In-Memory-Daten verwerfen. */
    clear() { store = null; cloudUserId = null; clearTimeout(saveTimer); },

    isCloud: () => !!cloudUserId,

    // ---- Portfolio ----
    portfolio: () => (store ? store.portfolio : []),
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
    watchlist: () => (store ? store.watchlist : []),
    addWatch(sym) { if (!store.watchlist.includes(sym)) { store.watchlist.push(sym); persist(); } },
    removeWatch(sym) { store.watchlist = store.watchlist.filter((s) => s !== sym); persist(); },

    // ---- Settings ----
    settings: () => (store ? store.settings : DEFAULTS.settings),
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
