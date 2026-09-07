/* ============================================================
   data.js – Aktien-Universum, Demo-Daten, Datenprovider
   ------------------------------------------------------------
   Zwei Modi:
   - "demo"    : realistische, reproduzierbare Beispieldaten (Standard)
   - "finnhub" : Live-Kurse/News/Zahlen über die kostenlose Finnhub-API
                 (API-Key in den Einstellungen, gespeichert im localStorage)
   ============================================================ */
window.Cockpit = window.Cockpit || {};

(function (C) {
  "use strict";

  /* ---------- Branchen (Sektoren) ---------- */
  C.SECTORS = [
    "Technologie",
    "Gesundheit",
    "Finanzen",
    "Konsum zyklisch",
    "Konsum defensiv",
    "Kommunikation",
    "Energie",
    "Industrie",
  ];

  /* ---------- Aktien-Universum (Name, Sektor, Basispreis) ---------- */
  C.UNIVERSE = {
    AAPL:  { name: "Apple",            sector: "Technologie",       base: 195 },
    MSFT:  { name: "Microsoft",        sector: "Technologie",       base: 415 },
    NVDA:  { name: "NVIDIA",           sector: "Technologie",       base: 118 },
    ASML:  { name: "ASML Holding",     sector: "Technologie",       base: 720 },
    SAP:   { name: "SAP",              sector: "Technologie",       base: 205 },
    AMZN:  { name: "Amazon",           sector: "Konsum zyklisch",   base: 178 },
    TSLA:  { name: "Tesla",            sector: "Konsum zyklisch",   base: 245 },
    NKE:   { name: "Nike",             sector: "Konsum zyklisch",   base: 78  },
    GOOGL: { name: "Alphabet",         sector: "Kommunikation",     base: 165 },
    META:  { name: "Meta Platforms",   sector: "Kommunikation",     base: 505 },
    DIS:   { name: "Walt Disney",      sector: "Kommunikation",     base: 95  },
    JPM:   { name: "JPMorgan Chase",   sector: "Finanzen",          base: 205 },
    V:     { name: "Visa",             sector: "Finanzen",          base: 275 },
    ALV:   { name: "Allianz",          sector: "Finanzen",          base: 290 },
    JNJ:   { name: "Johnson & Johnson",sector: "Gesundheit",        base: 155 },
    UNH:   { name: "UnitedHealth",     sector: "Gesundheit",        base: 490 },
    LLY:   { name: "Eli Lilly",        sector: "Gesundheit",        base: 780 },
    NOVO:  { name: "Novo Nordisk",     sector: "Gesundheit",        base: 135 },
    PG:    { name: "Procter & Gamble", sector: "Konsum defensiv",   base: 165 },
    KO:    { name: "Coca-Cola",        sector: "Konsum defensiv",   base: 62  },
    XOM:   { name: "Exxon Mobil",      sector: "Energie",           base: 115 },
    SHEL:  { name: "Shell",            sector: "Energie",           base: 68  },
    SIE:   { name: "Siemens",          sector: "Industrie",         base: 178 },
    CAT:   { name: "Caterpillar",      sector: "Industrie",         base: 355 },
  };

  C.meta = (sym) => C.UNIVERSE[sym] || { name: sym, sector: "Sonstige", base: 100 };

  /* ---------- Standard-Portfolio & Watchlist (erststart) ---------- */
  C.DEFAULT_PORTFOLIO = [
    { symbol: "AAPL", shares: 25, avgPrice: 150 },
    { symbol: "MSFT", shares: 12, avgPrice: 310 },
    { symbol: "NVDA", shares: 40, avgPrice: 55  },
    { symbol: "AMZN", shares: 15, avgPrice: 130 },
    { symbol: "JPM",  shares: 20, avgPrice: 150 },
    { symbol: "JNJ",  shares: 18, avgPrice: 160 },
    { symbol: "SAP",  shares: 22, avgPrice: 150 },
    { symbol: "KO",   shares: 60, avgPrice: 55  },
  ];
  C.DEFAULT_WATCHLIST = ["TSLA", "META", "GOOGL", "LLY", "ASML", "V", "UNH", "SIE"];

  /* ============================================================
     DEMO-DATEN-ENGINE (reproduzierbar über Seed)
     ============================================================ */

  /** Aktueller "Kurs" + Tagesveränderung, deterministisch je Symbol. */
  function demoQuote(sym) {
    const m = C.meta(sym);
    const r = C.rng(C.hashSeed(sym + "q"));
    // aktueller Kurs = Basis * kleiner Faktor
    const cur = +(m.base * (0.9 + r() * 0.35)).toFixed(2);
    const dPct = +((r() - 0.45) * 4).toFixed(2); // Tagesveränderung in %
    const prev = +(cur / (1 + dPct / 100)).toFixed(2);
    return { symbol: sym, price: cur, prevClose: prev, change: +(cur - prev).toFixed(2), changePct: dPct };
  }

  /** Tägliche Schlusskurse der letzten `days` Tage, endet exakt beim aktuellen Kurs. */
  function demoSeries(sym, days) {
    const q = demoQuote(sym);
    const r = C.rng(C.hashSeed(sym + "s"));
    const m = C.meta(sym);
    const drift = ((r() - 0.4) * 0.0009); // leichter Aufwärts-Bias
    const vol = 0.008 + r() * 0.014;
    // Rückwärts erzeugen, damit der letzte Punkt = aktueller Kurs
    const arr = [q.price];
    for (let i = 1; i < days; i++) {
      const shock = (r() - 0.5) * 2 * vol;
      const prev = arr[0] / (1 + drift + shock);
      arr.unshift(+prev.toFixed(2));
    }
    const now = Date.now();
    const day = 86400000;
    return arr.map((v, i) => ({ t: now - (days - 1 - i) * day, v }));
  }

  /* ---------- Demo-News ---------- */
  const NEWS_TEMPLATES = [
    { c: "news", t: (n) => `${n} hebt Jahresprognose nach starkem Quartal an`, s: (n) => `${n} meldet ein über den Erwartungen liegendes Wachstum und zeigt sich für das laufende Geschäftsjahr optimistischer.` },
    { c: "news", t: (n) => `Analysten stufen ${n} auf "Kaufen" hoch`, s: (n) => `Mehrere Investmentbanken heben ihr Kursziel für ${n} an und verweisen auf verbesserte Margen.` },
    { c: "news", t: (n) => `${n} kündigt Aktienrückkaufprogramm an`, s: (n) => `Der Vorstand von ${n} beschließt ein neues Rückkaufprogramm sowie eine Dividendenerhöhung.` },
    { c: "news", t: (n) => `${n} investiert in Ausbau der Kapazitäten`, s: (n) => `${n} plant Milliardeninvestitionen, um die Nachfrage langfristig bedienen zu können.` },
    { c: "news", t: (n) => `${n} unter Druck: Wettbewerb verschärft sich`, s: (n) => `Neue Marktteilnehmer setzen ${n} zu – die Aktie reagiert mit Kursverlusten.` },
    { c: "news", t: (n) => `${n} schließt strategische Partnerschaft`, s: (n) => `Eine neue Kooperation soll ${n} Zugang zu zusätzlichen Märkten verschaffen.` },
  ];

  function demoNews(sym, count) {
    const m = C.meta(sym);
    const r = C.rng(C.hashSeed(sym + "n"));
    const out = [];
    for (let i = 0; i < count; i++) {
      const tpl = NEWS_TEMPLATES[Math.floor(r() * NEWS_TEMPLATES.length)];
      const ago = Math.floor(r() * 10 * 86400000);
      out.push({
        symbol: sym,
        category: "news",
        headline: tpl.t(m.name),
        summary: tpl.s(m.name),
        source: ["Reuters", "Bloomberg", "Handelsblatt", "CNBC", "Börse Online"][Math.floor(r() * 5)],
        url: "#",
        datetime: Date.now() - ago,
      });
    }
    return out;
  }

  /** Letzte Quartalszahlen (EPS actual vs. estimate, Umsatz). */
  function demoEarnings(sym) {
    const r = C.rng(C.hashSeed(sym + "e"));
    const m = C.meta(sym);
    const est = +(0.8 + r() * 3).toFixed(2);
    const surprisePct = +((r() - 0.4) * 18).toFixed(1);
    const act = +(est * (1 + surprisePct / 100)).toFixed(2);
    const revEst = Math.round(m.base * (80 + r() * 400));
    const rev = Math.round(revEst * (1 + (r() - 0.45) * 0.08));
    const daysAgo = Math.floor(r() * 45);
    return {
      symbol: sym,
      period: ["Q1", "Q2", "Q3", "Q4"][Math.floor(r() * 4)] + " " + (2025 + Math.floor(r() * 1)),
      date: Date.now() - daysAgo * 86400000,
      epsActual: act,
      epsEstimate: est,
      epsSurprisePct: surprisePct,
      revenueActual: rev,      // in Mio.
      revenueEstimate: revEst, // in Mio.
    };
  }

  /* ============================================================
     FINNHUB-PROVIDER (Live)
     ============================================================ */
  const FH = "https://finnhub.io/api/v1";

  async function fhGet(path, key) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${FH}${path}${sep}token=${encodeURIComponent(key)}`);
    if (res.status === 429) throw new Error("Finnhub-Limit erreicht (zu viele Anfragen). Bitte kurz warten.");
    if (!res.ok) throw new Error("Finnhub-Fehler " + res.status);
    return res.json();
  }

  async function fhQuote(sym, key) {
    const q = await fhGet(`/quote?symbol=${encodeURIComponent(sym)}`, key);
    return {
      symbol: sym,
      price: q.c,
      prevClose: q.pc,
      change: q.d,
      changePct: q.dp,
    };
  }

  async function fhNews(sym, key) {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const arr = await fhGet(`/company-news?symbol=${encodeURIComponent(sym)}&from=${from}&to=${to}`, key);
    return (arr || []).slice(0, 6).map((n) => ({
      symbol: sym,
      category: "news",
      headline: n.headline,
      summary: n.summary,
      source: n.source,
      url: n.url,
      datetime: n.datetime * 1000,
    }));
  }

  async function fhEarnings(sym, key) {
    const arr = await fhGet(`/stock/earnings?symbol=${encodeURIComponent(sym)}`, key);
    if (!arr || !arr.length) return null;
    const e = arr[0];
    const sur = e.estimate ? ((e.actual - e.estimate) / Math.abs(e.estimate)) * 100 : 0;
    return {
      symbol: sym,
      period: (e.period || "").slice(0, 7),
      date: e.period ? new Date(e.period).getTime() : Date.now(),
      epsActual: e.actual,
      epsEstimate: e.estimate,
      epsSurprisePct: +sur.toFixed(1),
      revenueActual: null,
      revenueEstimate: null,
    };
  }

  /* ============================================================
     ÖFFENTLICHE PROVIDER-API
     Alle Seiten nutzen ausschließlich diese Funktionen.
     ============================================================ */
  C.data = {
    isLive() {
      const s = C.state.settings();
      return s.provider === "finnhub" && !!s.finnhubKey;
    },

    /** Kurse für mehrere Symbole → { SYM: quote }. Fällt bei Live-Fehler auf Demo zurück. */
    async quotes(symbols) {
      const out = {};
      if (this.isLive()) {
        const key = C.state.settings().finnhubKey;
        try {
          await Promise.all(
            symbols.map(async (s) => { out[s] = await fhQuote(s, key); })
          );
          return out;
        } catch (e) {
          C.toast("Live-Daten nicht verfügbar – zeige Demo. (" + e.message + ")");
        }
      }
      symbols.forEach((s) => (out[s] = demoQuote(s)));
      return out;
    },

    /** Zeitreihe (tägliche Schlusskurse). Live-Historie ist im Free-Tier limitiert → Demo-Serie, an Live-Kurs skaliert. */
    async series(symbols, days) {
      const out = {};
      let liveQuotes = null;
      if (this.isLive()) {
        try { liveQuotes = await this.quotes(symbols); } catch (_) {}
      }
      symbols.forEach((s) => {
        const ser = demoSeries(s, days);
        if (liveQuotes && liveQuotes[s] && liveQuotes[s].price) {
          const factor = liveQuotes[s].price / ser[ser.length - 1].v;
          out[s] = ser.map((p) => ({ t: p.t, v: +(p.v * factor).toFixed(2) }));
        } else {
          out[s] = ser;
        }
      });
      return out;
    },

    async news(symbols) {
      let out = [];
      if (this.isLive()) {
        const key = C.state.settings().finnhubKey;
        try {
          const chunks = await Promise.all(symbols.map((s) => fhNews(s, key).catch(() => [])));
          out = chunks.flat();
          if (out.length) return out.sort((a, b) => b.datetime - a.datetime);
        } catch (_) {}
      }
      symbols.forEach((s) => out.push(...demoNews(s, 2)));
      return out.sort((a, b) => b.datetime - a.datetime);
    },

    async earnings(symbols) {
      const out = [];
      if (this.isLive()) {
        const key = C.state.settings().finnhubKey;
        const res = await Promise.all(symbols.map((s) => fhEarnings(s, key).catch(() => null)));
        res.forEach((e) => e && out.push(e));
        if (out.length) return out.sort((a, b) => b.date - a.date);
      }
      symbols.forEach((s) => out.push(demoEarnings(s)));
      return out.sort((a, b) => b.date - a.date);
    },
  };
})(window.Cockpit);
