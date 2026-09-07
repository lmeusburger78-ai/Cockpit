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
        // In Demo führt der Klick auf eine echte Google-News-Suche zur Aktie
        url: C.newsSearchUrl(m.name),
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

  /* ---------- Externe Links / News-Quellen ---------- */
  C.newsSearchUrl = (name) =>
    `https://news.google.com/search?q=${encodeURIComponent(name + " Aktie")}&hl=de&gl=DE`;

  /** Kuratierte, gute Nachrichten-Quellen (allgemein + je Aktie). */
  C.NEWS_SOURCES = [
    { name: "Google News", url: (s, n) => C.newsSearchUrl(n) },
    { name: "Yahoo Finance", url: (s) => `https://finance.yahoo.com/quote/${s}/news` },
    { name: "finanzen.net", url: (s, n) => `https://www.finanzen.net/suchergebnis.asp?frmAktiensucheTextfeld=${encodeURIComponent(n)}` },
    { name: "MarketWatch", url: (s) => `https://www.marketwatch.com/investing/stock/${s}` },
    { name: "Seeking Alpha", url: (s) => `https://seekingalpha.com/symbol/${s}/news` },
    { name: "Finviz", url: (s) => `https://finviz.com/quote.ashx?t=${s}` },
    { name: "Reuters", url: (s, n) => `https://www.reuters.com/site-search/?query=${encodeURIComponent(n)}` },
  ];

  /* ---------- Demo: Detaildaten je Aktie ---------- */
  function demoProfile(sym) {
    const m = C.meta(sym);
    const r = C.rng(C.hashSeed(sym + "p"));
    const q = demoQuote(sym);
    const sharesOut = Math.round(200 + r() * 8000); // Mio. Aktien
    return {
      symbol: sym, name: m.name, sector: m.sector,
      country: ["US", "DE", "NL", "DK", "GB"][Math.floor(r() * 5)],
      marketCap: Math.round((q.price * sharesOut) / 1000), // Mrd.
      shareOutstanding: sharesOut,
      currency: "USD",
      weburl: "https://www.google.com/search?q=" + encodeURIComponent(m.name),
    };
  }

  function demoRecommendation(sym) {
    const r = C.rng(C.hashSeed(sym + "rec"));
    const total = 18 + Math.floor(r() * 22);
    const bias = r(); // 0..1, höher = optimistischer
    const strongBuy = Math.round(total * (0.15 + bias * 0.35));
    const buy = Math.round(total * (0.2 + bias * 0.2));
    const hold = Math.round(total * (0.15 + (1 - bias) * 0.3));
    const sell = Math.round(total * ((1 - bias) * 0.12));
    const strongSell = Math.max(0, total - strongBuy - buy - hold - sell);
    return { symbol: sym, period: "aktuell", strongBuy, buy, hold, sell, strongSell };
  }

  function demoMetrics(sym) {
    const r = C.rng(C.hashSeed(sym + "met"));
    const q = demoQuote(sym);
    return {
      pe: +(10 + r() * 35).toFixed(1),
      eps: +(q.price / (10 + r() * 35)).toFixed(2),
      high52: +(q.price * (1.05 + r() * 0.35)).toFixed(2),
      low52: +(q.price * (0.55 + r() * 0.3)).toFixed(2),
      beta: +(0.6 + r() * 1.1).toFixed(2),
      dividendYield: +(r() * 3.8).toFixed(2), // %
    };
  }

  function demoNextEarnings(sym) {
    const r = C.rng(C.hashSeed(sym + "cal"));
    const inDays = 8 + Math.floor(r() * 80);
    const m = C.meta(sym);
    return {
      symbol: sym,
      date: Date.now() + inDays * 86400000,
      epsEstimate: +(0.8 + r() * 3).toFixed(2),
      quarter: ["Q1", "Q2", "Q3", "Q4"][Math.floor(r() * 4)] + " 2026",
    };
  }

  function demoDividend(sym) {
    const met = demoMetrics(sym);
    const q = demoQuote(sym);
    if (met.dividendYield < 0.4) return { symbol: sym, pays: false };
    const r = C.rng(C.hashSeed(sym + "div"));
    const annual = +((met.dividendYield / 100) * q.price).toFixed(2);
    const perQuarter = +(annual / 4).toFixed(2);
    const exInDays = -20 + Math.floor(r() * 70);
    return {
      symbol: sym, pays: true,
      amountPerQuarter: perQuarter,
      amountAnnual: annual,
      yield: met.dividendYield,
      frequency: "Quartal",
      exDate: Date.now() + exInDays * 86400000,
      payDate: Date.now() + (exInDays + 14) * 86400000,
    };
  }

  /** Letzte 4 Quartale (neuestes zuerst). */
  function demoQuarterly(sym) {
    const r = C.rng(C.hashSeed(sym + "qh"));
    const m = C.meta(sym);
    const out = [];
    let rev = m.base * (80 + r() * 300);
    let eps = 0.8 + r() * 2.5;
    const now = new Date();
    let qy = now.getFullYear();
    let qi = Math.floor(now.getMonth() / 3); // 0..3 aktuelles Quartal
    for (let i = 0; i < 4; i++) {
      qi--; if (qi < 0) { qi = 3; qy--; }
      const est = +eps.toFixed(2);
      const sur = (r() - 0.4) * 16;
      const act = +(est * (1 + sur / 100)).toFixed(2);
      out.push({
        period: "Q" + (qi + 1) + " " + qy,
        epsActual: act, epsEstimate: est, epsSurprisePct: +sur.toFixed(1),
        revenue: Math.round(rev),
      });
      rev /= 1 + (r() - 0.4) * 0.12;
      eps /= 1 + (r() - 0.4) * 0.15;
    }
    return out;
  }

  /** Letzte 3 Geschäftsjahre (neuestes zuerst). */
  function demoAnnual(sym) {
    const r = C.rng(C.hashSeed(sym + "ah"));
    const m = C.meta(sym);
    const out = [];
    let rev = m.base * (400 + r() * 1400);
    let eps = 3 + r() * 9;
    let year = new Date().getFullYear() - 1;
    for (let i = 0; i < 3; i++) {
      out.push({
        year: year - i,
        revenue: Math.round(rev),
        eps: +eps.toFixed(2),
        netMargin: +(8 + r() * 22).toFixed(1),
      });
      rev /= 1 + (0.04 + r() * 0.14);
      eps /= 1 + (0.03 + r() * 0.16);
    }
    return out;
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

  async function fhProfile(sym, key) {
    const p = await fhGet(`/stock/profile2?symbol=${encodeURIComponent(sym)}`, key);
    if (!p || !p.name) return null;
    return {
      symbol: sym, name: p.name, sector: p.finnhubIndustry || C.meta(sym).sector,
      country: p.country, marketCap: p.marketCapitalization ? Math.round(p.marketCapitalization / 1000) : null,
      shareOutstanding: p.shareOutstanding, currency: p.currency, weburl: p.weburl,
    };
  }
  async function fhRecommendation(sym, key) {
    const arr = await fhGet(`/stock/recommendation?symbol=${encodeURIComponent(sym)}`, key);
    if (!arr || !arr.length) return null;
    const r = arr[0];
    return { symbol: sym, period: r.period, strongBuy: r.strongBuy, buy: r.buy, hold: r.hold, sell: r.sell, strongSell: r.strongSell };
  }
  async function fhMetric(sym, key) {
    const d = await fhGet(`/stock/metric?symbol=${encodeURIComponent(sym)}&metric=all`, key);
    const m = (d && d.metric) || {};
    return {
      pe: m.peBasicExclExtraTTM ?? m.peTTM ?? null,
      eps: m.epsBasicExclExtraItemsTTM ?? null,
      high52: m["52WeekHigh"] ?? null,
      low52: m["52WeekLow"] ?? null,
      beta: m.beta ?? null,
      dividendYield: m.dividendYieldIndicatedAnnual ?? m.currentDividendYieldTTM ?? 0,
    };
  }
  async function fhNextEarnings(sym, key) {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
    const d = await fhGet(`/calendar/earnings?symbol=${encodeURIComponent(sym)}&from=${from}&to=${to}`, key);
    const arr = (d && d.earningsCalendar) || [];
    if (!arr.length) return null;
    const e = arr[0];
    return { symbol: sym, date: new Date(e.date).getTime(), epsEstimate: e.epsEstimate, quarter: `Q${e.quarter} ${e.year}` };
  }
  async function fhDividend(sym, key) {
    const from = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const arr = await fhGet(`/stock/dividend?symbol=${encodeURIComponent(sym)}&from=${from}&to=${to}`, key);
    if (!arr || !arr.length) return { symbol: sym, pays: false };
    arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    const last = arr[0];
    return {
      symbol: sym, pays: true, amountPerQuarter: last.amount,
      amountAnnual: null, yield: null, frequency: "",
      exDate: new Date(last.date).getTime(), payDate: last.payDate ? new Date(last.payDate).getTime() : null,
    };
  }
  async function fhQuarterly(sym, key) {
    const arr = await fhGet(`/stock/earnings?symbol=${encodeURIComponent(sym)}&limit=4`, key);
    if (!arr || !arr.length) return null;
    return arr.slice(0, 4).map((e) => ({
      period: e.period ? e.period.slice(0, 7) : (e.quarter ? "Q" + e.quarter + " " + e.year : ""),
      epsActual: e.actual, epsEstimate: e.estimate,
      epsSurprisePct: e.estimate ? +(((e.actual - e.estimate) / Math.abs(e.estimate)) * 100).toFixed(1) : null,
      revenue: null,
    }));
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

    /** Vollständige Detaildaten für EINE Aktie (für die Detailansicht). */
    async detail(sym) {
      const live = this.isLive();
      const key = live ? C.state.settings().finnhubKey : null;
      // je Feld: live best-effort, sonst Demo-Fallback
      const orDemo = async (liveFn, demoVal) => {
        if (!live) return demoVal;
        try { const v = await liveFn(); return v || demoVal; } catch (_) { return demoVal; }
      };
      const [quote, profile, recommendation, metrics, nextEarnings, dividend, quarterly] = await Promise.all([
        this.quotes([sym]).then((q) => q[sym]),
        orDemo(() => fhProfile(sym, key), demoProfile(sym)),
        orDemo(() => fhRecommendation(sym, key), demoRecommendation(sym)),
        orDemo(() => fhMetric(sym, key), demoMetrics(sym)),
        orDemo(() => fhNextEarnings(sym, key), demoNextEarnings(sym)),
        orDemo(() => fhDividend(sym, key), demoDividend(sym)),
        orDemo(() => fhQuarterly(sym, key), demoQuarterly(sym)),
      ]);
      return {
        symbol: sym, meta: C.meta(sym),
        quote, profile, recommendation, metrics, nextEarnings, dividend,
        quarterly: quarterly && quarterly.length ? quarterly : demoQuarterly(sym),
        annual: demoAnnual(sym), // Jahreszahlen: Demo (Finnhub-Free liefert keine kompletten GuV)
        isLive: live,
      };
    },
  };
})(window.Cockpit);
