/* ============================================================
   detail.js – Aktien-Detailansicht (Modal)
   Kurs-Chart · Buy/Hold/Sell-Rating · Kennzahlen ·
   nächste Quartalszahlen · Dividende · Quartals-/Jahreszahlen · News
   ============================================================ */
window.Cockpit = window.Cockpit || {};

(function (C) {
  "use strict";
  const { el, $ } = C;

  const PERIODS = [
    { label: "1M", days: 30 }, { label: "3M", days: 90 },
    { label: "6M", days: 180 }, { label: "1J", days: 365 },
  ];

  const RATING = {
    labels: { strongBuy: "Strong Buy", buy: "Buy", hold: "Hold", sell: "Sell", strongSell: "Strong Sell" },
    colors: { strongBuy: "#16a34a", buy: "#22c55e", hold: "#f59e0b", sell: "#f97316", strongSell: "#ef4444" },
    order: ["strongBuy", "buy", "hold", "sell", "strongSell"],
  };

  C.openStockDetail = async function (sym) {
    const m = C.meta(sym);
    C.openModal(`${sym} · ${m.name}`, el("div", { class: "empty", text: "Lade Aktiendaten …" }), { wide: true });

    let d;
    try { d = await C.data.detail(sym); }
    catch (e) {
      $("#modal-body").innerHTML = `<div class="empty">Fehler: ${e.message}</div>`;
      return;
    }

    const body = el("div", {});
    body.appendChild(header(d));
    body.appendChild(factsGrid(d));

    // Chart
    const chartSec = el("div", { class: "detail-section" }, [
      el("div", { class: "card-head", style: "margin-bottom:8px;" }, [
        el("h3", { text: "Kursverlauf" }),
        el("div", { class: "seg", id: "detail-period" },
          PERIODS.map((p, i) =>
            el("button", {
              class: p.days === 180 ? "active" : "", "data-days": p.days,
              onclick: (e) => {
                C.$$("#detail-period button").forEach((b) => b.classList.remove("active"));
                e.target.classList.add("active");
                drawChart(sym, p.days);
              },
            }, p.label))),
      ]),
      el("div", { class: "chart-box" }, el("canvas", { id: "detail-chart" })),
    ]);
    body.appendChild(chartSec);

    // Rating
    body.appendChild(ratingSection(d.recommendation));

    // Quartals- & Jahreszahlen
    body.appendChild(quarterlySection(d.quarterly));
    body.appendChild(annualSection(d.annual));

    // News + Quellen
    body.appendChild(newsSection(d));

    $("#modal-body").innerHTML = "";
    $("#modal-body").appendChild(body);
    drawChart(sym, 180);
    loadNews(sym);
  };

  /* ---------- Kopf ---------- */
  function header(d) {
    const q = d.quote || {};
    const cons = consensus(d.recommendation);
    return el("div", { class: "detail-head" }, [
      el("div", {}, [
        el("div", { class: "price", text: C.fmtMoney(q.price) }),
        el("div", { class: C.signClass(q.change), style: "font-weight:600;font-size:14px;margin-top:4px;",
          text: `${C.arrow(q.change)} ${C.fmtMoney(Math.abs(q.change || 0))} (${C.fmtPct(q.changePct)})` }),
        el("div", { class: "name-sub", text: `${d.meta.sector}${d.profile && d.profile.country ? " · " + d.profile.country : ""}${d.isLive ? " · Live" : " · Demo"}` }),
      ]),
      el("div", { style: "text-align:right;" }, [
        el("div", { class: "rating-badge rating-" + cons.key, text: cons.label }),
        el("div", { class: "name-sub", style: "margin-top:6px;", text: "Analysten-Konsens" }),
      ]),
    ]);
  }

  /* ---------- Fakten-Kacheln ---------- */
  function factsGrid(d) {
    const met = d.metrics || {};
    const ne = d.nextEarnings || {};
    const div = d.dividend || {};
    const facts = [
      fact("KGV (P/E)", met.pe != null ? C.fmtNum(met.pe, 1) : "–"),
      fact("52W-Hoch", met.high52 != null ? C.fmtMoney(met.high52) : "–"),
      fact("52W-Tief", met.low52 != null ? C.fmtMoney(met.low52) : "–"),
      fact("Beta", met.beta != null ? C.fmtNum(met.beta, 2) : "–"),
      fact("Marktkap.", d.profile && d.profile.marketCap ? C.fmtNum(d.profile.marketCap, 0) + " Mrd." : "–"),
      fact("Nächste Zahlen", ne.date ? C.fmtDate(ne.date) : "–", ne.quarter || ""),
      fact("Dividende", div.pays ? (div.yield != null ? C.fmtNum(div.yield, 2) + " %" : C.fmtMoney(div.amountPerQuarter)) : "keine",
        div.pays && div.amountAnnual ? C.fmtMoney(div.amountAnnual) + " p.a." : (div.pays && div.exDate ? "Ex: " + C.fmtDate(div.exDate) : "")),
      fact("EPS (TTM)", met.eps != null ? C.fmtNum(met.eps, 2) : "–"),
    ];
    // 52-Wochen-Positionsanzeige (wo steht der Kurs?)
    const grid = el("div", { class: "facts" }, facts);
    return el("div", {}, [
      grid,
      met.high52 && met.low52 && d.quote ? rangeBar(d.quote.price, met.low52, met.high52) : null,
    ]);
  }
  function fact(k, v, sub) {
    return el("div", { class: "fact" }, [
      el("div", { class: "k", text: k }),
      el("div", { class: "v" }, [document.createTextNode(v), sub ? el("small", { text: " " + sub }) : null]),
    ]);
  }
  function rangeBar(price, low, high) {
    const pos = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
    return el("div", { style: "margin:4px 2px 0;" }, [
      el("div", { class: "range-track" }, el("div", { class: "marker", style: `left:${pos}%` })),
      el("div", { class: "range-labels" }, [
        el("span", { text: "52W-Tief " + C.fmtMoney(low) }),
        el("span", { text: C.fmtMoney(high) + " 52W-Hoch" }),
      ]),
    ]);
  }

  /* ---------- Kurs-Chart ---------- */
  async function drawChart(sym, days) {
    const canvas = $("#detail-chart");
    if (!canvas) return;
    const ser = (await C.data.series([sym], days))[sym];
    const labels = ser.map((p) => new Date(p.t).toLocaleDateString("de-DE", { day: "2-digit", month: "short" }));
    const up = ser[ser.length - 1].v >= ser[0].v;
    C.line(canvas, labels, [{
      label: sym, data: ser.map((p) => p.v),
      color: up ? C.cssVar("--up") : C.cssVar("--down"), area: true, width: 2,
    }], { valueFmt: (v) => C.fmtMoney(v), tickFmt: (v) => C.fmtNum(v, 0) });
  }

  /* ---------- Rating (Buy/Hold/Sell) ---------- */
  function consensus(rec) {
    if (!rec) return { key: "hold", label: "Hold", score: 3 };
    const total = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
    if (!total) return { key: "hold", label: "Hold", score: 3 };
    const score = (rec.strongBuy * 5 + rec.buy * 4 + rec.hold * 3 + rec.sell * 2 + rec.strongSell * 1) / total;
    let key = "hold";
    if (score >= 4.5) key = "strongBuy"; else if (score >= 3.5) key = "buy";
    else if (score >= 2.5) key = "hold"; else if (score >= 1.5) key = "sell"; else key = "strongSell";
    return { key, label: RATING.labels[key], score, total };
  }
  function ratingSection(rec) {
    const sec = el("div", { class: "detail-section" }, el("h3", { text: "Analysten-Rating" }));
    if (!rec) { sec.appendChild(el("div", { class: "empty", text: "Keine Analystendaten." })); return sec; }
    const total = RATING.order.reduce((a, k) => a + (rec[k] || 0), 0) || 1;
    const bar = el("div", { class: "rating-bar" },
      RATING.order.map((k) => el("span", { style: `width:${((rec[k] || 0) / total) * 100}%;background:${RATING.colors[k]};` })));
    const legend = el("div", { class: "rating-legend" },
      RATING.order.map((k) => el("div", { class: "l" }, [
        el("span", { class: "dot", style: `background:${RATING.colors[k]}` }),
        `${RATING.labels[k]}: ${rec[k] || 0}`,
      ])));
    sec.appendChild(bar);
    sec.appendChild(legend);
    sec.appendChild(el("div", { class: "name-sub", style: "margin-top:8px;", text: `${total} Analysten` }));
    return sec;
  }

  /* ---------- Quartalszahlen ---------- */
  function quarterlySection(q) {
    const sec = el("div", { class: "detail-section" }, el("h3", { text: "Letzte Quartalszahlen" }));
    if (!q || !q.length) { sec.appendChild(el("div", { class: "empty", text: "Keine Quartalsdaten." })); return sec; }
    const t = el("table");
    t.appendChild(el("thead", {}, el("tr", {}, [
      el("th", {}, "Quartal"), el("th", {}, "EPS Ist"), el("th", {}, "EPS Erw."),
      el("th", {}, "Überraschung"), el("th", {}, "Umsatz"),
    ])));
    const tb = el("tbody");
    q.forEach((e) => {
      const beat = (e.epsSurprisePct || 0) >= 0;
      tb.appendChild(el("tr", {}, [
        el("td", {}, el("span", { class: "sym", text: e.period })),
        el("td", {}, C.fmtNum(e.epsActual)),
        el("td", {}, e.epsEstimate != null ? C.fmtNum(e.epsEstimate) : "–"),
        el("td", {}, e.epsSurprisePct != null
          ? el("span", { class: beat ? "beat" : "miss", text: `${beat ? "▲" : "▼"} ${C.fmtPct(e.epsSurprisePct)}` }) : "–"),
        el("td", {}, e.revenue != null ? C.fmtNum(e.revenue, 0) + " Mio." : "–"),
      ]));
    });
    t.appendChild(tb);
    sec.appendChild(el("div", { class: "table-wrap" }, t));
    return sec;
  }

  /* ---------- Jahreszahlen ---------- */
  function annualSection(a) {
    const sec = el("div", { class: "detail-section" }, el("h3", { text: "Jahreszahlen" }));
    if (!a || !a.length) { sec.appendChild(el("div", { class: "empty", text: "Keine Jahresdaten." })); return sec; }
    const t = el("table");
    t.appendChild(el("thead", {}, el("tr", {}, [
      el("th", {}, "Jahr"), el("th", {}, "Umsatz"), el("th", {}, "EPS"), el("th", {}, "Nettomarge"),
    ])));
    const tb = el("tbody");
    a.forEach((y) => {
      tb.appendChild(el("tr", {}, [
        el("td", {}, el("span", { class: "sym", text: String(y.year) })),
        el("td", {}, C.fmtNum(y.revenue, 0) + " Mio."),
        el("td", {}, C.fmtNum(y.eps)),
        el("td", {}, C.fmtNum(y.netMargin, 1) + " %"),
      ]));
    });
    t.appendChild(tb);
    sec.appendChild(el("div", { class: "table-wrap" }, t));
    return sec;
  }

  /* ---------- News + Quellen ---------- */
  function newsSection(d) {
    const sec = el("div", { class: "detail-section" }, [
      el("h3", { text: "Nachrichten" }),
      el("div", { class: "chips", style: "margin-bottom:12px;" },
        C.NEWS_SOURCES.map((src) =>
          el("a", { class: "chip", href: src.url(d.symbol, d.meta.name), target: "_blank", rel: "noopener" }, src.name))),
      el("div", { id: "detail-news", class: "news-list" }, el("div", { class: "empty", text: "Lade News …" })),
    ]);
    return sec;
  }
  async function loadNews(sym) {
    const host = $("#detail-news");
    if (!host) return;
    const news = await C.data.news([sym]);
    host.innerHTML = "";
    if (!news.length) { host.appendChild(el("div", { class: "empty", text: "Keine aktuellen Nachrichten." })); return; }
    news.slice(0, 6).forEach((n) => {
      const link = n.url && n.url !== "#"
        ? el("a", { href: n.url, target: "_blank", rel: "noopener", text: n.headline })
        : el("span", { text: n.headline });
      host.appendChild(el("div", { class: "news-item" }, [
        el("div", { class: "news-body" }, [
          el("h4", {}, link),
          el("div", { class: "news-meta" }, [
            el("span", { text: n.source || "" }), el("span", { text: "·" }), el("span", { text: C.fmtRel(n.datetime) }),
          ]),
        ]),
      ]));
    });
  }
})(window.Cockpit);
