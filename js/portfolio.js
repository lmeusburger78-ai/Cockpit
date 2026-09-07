/* ============================================================
   portfolio.js – Seite "Portfolio"
   KPIs · Allokation (Kreisdiagramm) · Zeitverlauf/Vergleich · Positionen
   ============================================================ */
window.Cockpit = window.Cockpit || {};

(function (C) {
  "use strict";
  const { el, $ } = C;

  const PERIODS = [
    { label: "1M", days: 30 },
    { label: "3M", days: 90 },
    { label: "6M", days: 180 },
    { label: "1J", days: 365 },
  ];

  let allocMode = "position"; // "position" | "sector"

  C.pages = C.pages || {};
  C.pages.portfolio = {
    title: "Portfolio",
    subtitle: "Übersicht, Allokation und Entwicklung deiner Anlagen",

    async render(root) {
      const holdings = C.state.portfolio();
      if (!holdings.length) {
        root.innerHTML = "";
        root.appendChild(emptyState());
        return;
      }

      root.innerHTML = `<div class="empty">Lade Kurse …</div>`;
      const symbols = holdings.map((h) => h.symbol);
      const quotes = await C.data.quotes(symbols);

      // Positionsberechnung
      const rows = holdings.map((h) => {
        const q = quotes[h.symbol] || { price: C.meta(h.symbol).base, changePct: 0, change: 0 };
        const value = h.shares * q.price;
        const cost = h.shares * h.avgPrice;
        const pl = value - cost;
        return {
          ...h,
          meta: C.meta(h.symbol),
          price: q.price,
          changePct: q.changePct,
          dayChange: h.shares * (q.change || 0),
          value, cost, pl,
          plPct: cost ? (pl / cost) * 100 : 0,
        };
      });

      const totalValue = rows.reduce((a, r) => a + r.value, 0);
      const totalCost = rows.reduce((a, r) => a + r.cost, 0);
      const totalPl = totalValue - totalCost;
      const totalPlPct = totalCost ? (totalPl / totalCost) * 100 : 0;
      const dayChange = rows.reduce((a, r) => a + r.dayChange, 0);
      const dayPct = totalValue - dayChange ? (dayChange / (totalValue - dayChange)) * 100 : 0;

      // ---- Aufbau ----
      root.innerHTML = "";
      root.appendChild(kpiRow({ totalValue, totalPl, totalPlPct, dayChange, dayPct, count: rows.length }));

      const cols = el("div", { class: "grid", style: "grid-template-columns: 1fr 1.4fr;" });
      cols.appendChild(allocCard(rows, totalValue));
      cols.appendChild(timelineCard(symbols, rows));
      // responsiv: auf schmalen Screens 1-spaltig
      if (window.matchMedia("(max-width: 900px)").matches) cols.style.gridTemplateColumns = "1fr";
      root.appendChild(cols);

      root.appendChild(holdingsCard(rows, totalValue));

      // Charts zeichnen
      drawAlloc(rows, totalValue);
      drawTimeline(symbols, rows);
    },
  };

  /* ---------- KPIs ---------- */
  function kpiRow(k) {
    const wrap = el("div", { class: "kpis" });
    const items = [
      { label: "Gesamtwert", value: C.fmtMoney(k.totalValue), delta: null },
      {
        label: "Gewinn / Verlust", value: C.fmtMoney(k.totalPl),
        delta: `${C.arrow(k.totalPl)} ${C.fmtPct(k.totalPlPct)}`, cls: C.signClass(k.totalPl),
      },
      {
        label: "Heute", value: C.fmtMoney(k.dayChange),
        delta: `${C.arrow(k.dayChange)} ${C.fmtPct(k.dayPct)}`, cls: C.signClass(k.dayChange),
      },
      { label: "Positionen", value: String(k.count), delta: null },
    ];
    items.forEach((it) => {
      wrap.appendChild(el("div", { class: "kpi" }, [
        el("div", { class: "label", text: it.label }),
        el("div", { class: "value " + (it.cls || ""), text: it.value }),
        it.delta ? el("div", { class: "delta " + (it.cls || ""), text: it.delta }) : null,
      ]));
    });
    return wrap;
  }

  /* ---------- Allokation (Kreisdiagramm) ---------- */
  function allocCard(rows, total) {
    const card = el("div", { class: "card" });
    const seg = el("div", { class: "seg" }, [
      segBtn("Nach Position", "position"),
      segBtn("Nach Branche", "sector"),
    ]);
    card.appendChild(el("div", { class: "card-head" }, [
      el("h3", { text: "Allokation" }), seg,
    ]));
    card.appendChild(el("div", { class: "chart-box pie" }, el("canvas", { id: "chart-alloc" })));
    card.appendChild(el("div", { class: "legend", id: "alloc-legend", style: "margin-top:16px;" }));

    function segBtn(label, mode) {
      return el("button", {
        class: allocMode === mode ? "active" : "",
        onclick: (e) => {
          allocMode = mode;
          C.$$(".seg button", seg).forEach((b) => b.classList.remove("active"));
          e.target.classList.add("active");
          drawAlloc(rows, total);
        },
      }, label);
    }
    return card;
  }

  function allocData(rows) {
    if (allocMode === "sector") {
      const map = {};
      rows.forEach((r) => { map[r.meta.sector] = (map[r.meta.sector] || 0) + r.value; });
      const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
      return { labels: entries.map((e) => e[0]), values: entries.map((e) => e[1]) };
    }
    const sorted = [...rows].sort((a, b) => b.value - a.value);
    return { labels: sorted.map((r) => r.symbol), values: sorted.map((r) => r.value), rows: sorted };
  }

  function drawAlloc(rows, total) {
    const { labels, values } = allocData(rows);
    const colors = C.palette(labels.length);
    C.doughnut($("#chart-alloc"), labels, values, colors);
    // Legende
    const leg = $("#alloc-legend");
    leg.innerHTML = "";
    labels.forEach((lab, i) => {
      const pct = total ? (values[i] / total) * 100 : 0;
      leg.appendChild(el("div", { class: "legend-row" }, [
        el("div", { class: "l" }, [
          el("span", { class: "dot", style: `background:${colors[i]}` }),
          allocMode === "position" ? `${lab} · ${C.meta(lab).name}` : lab,
        ]),
        el("div", { class: "v" }, `${C.fmtNum(pct, 1)} %`),
      ]));
    });
  }

  /* ---------- Zeitverlauf / Vergleich ---------- */
  function timelineCard(symbols, rows) {
    const card = el("div", { class: "card" });
    const s = C.state.settings();
    const seg = el("div", { class: "seg", id: "period-seg" },
      PERIODS.map((p) =>
        el("button", {
          class: s.period === p.days ? "active" : "",
          "data-days": p.days,
          onclick: (e) => {
            C.state.setSettings({ period: p.days });
            C.$$("#period-seg button").forEach((b) => b.classList.remove("active"));
            e.target.classList.add("active");
            drawTimeline(symbols, rows);
          },
        }, p.label)
      )
    );
    const benchToggle = el("label", { class: "field", style: "flex-direction:row;align-items:center;gap:8px;font-size:12px;" }, [
      el("input", {
        type: "checkbox", ...(s.benchmark ? { checked: "checked" } : {}),
        onchange: (e) => { C.state.setSettings({ benchmark: e.target.checked }); drawTimeline(symbols, rows); },
      }),
      "Benchmark (Weltindex)",
    ]);

    card.appendChild(el("div", { class: "card-head" }, [
      el("div", {}, [
        el("h3", { text: "Entwicklung im Zeitraum" }),
        el("div", { class: "muted", text: "Indexiert auf 100 zu Periodenbeginn" }),
      ]),
      el("div", { style: "display:flex;gap:12px;align-items:center;flex-wrap:wrap;" }, [benchToggle, seg]),
    ]));
    card.appendChild(el("div", { class: "chart-box tall" }, el("canvas", { id: "chart-timeline" })));
    card.appendChild(el("div", { class: "legend", id: "tl-legend", style: "margin-top:14px;flex-direction:row;gap:20px;" }));
    return card;
  }

  async function drawTimeline(symbols, rows) {
    const s = C.state.settings();
    const days = s.period;
    const box = $("#chart-timeline");
    if (!box) return;
    const sharesOf = {};
    rows.forEach((r) => (sharesOf[r.symbol] = r.shares));

    const series = await C.data.series(symbols, days);
    // Portfolio-Wert je Tag
    const len = days;
    const pv = new Array(len).fill(0);
    let times = [];
    symbols.forEach((sym) => {
      const ser = series[sym];
      if (!times.length) times = ser.map((p) => p.t);
      ser.forEach((p, i) => (pv[i] += sharesOf[sym] * p.v));
    });

    const idx = (arr) => arr.map((v) => (arr[0] ? (v / arr[0]) * 100 : 100));
    const labels = times.map((t) =>
      new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })
    );

    const datasets = [{ label: "Portfolio", data: idx(pv), color: C.cssVar("--accent"), area: true, width: 2.5 }];

    // Weltindex-Proxy als eigene Demo-Serie (einmal berechnen)
    let benchIdx = null;
    if (s.benchmark) {
      const bs = (await C.data.series(["WORLDX"], days))["WORLDX"].map((p) => p.v);
      benchIdx = idx(bs);
      datasets.push({ label: "Weltindex", data: benchIdx, color: C.cssVar("--text-mute"), dash: [6, 5], width: 1.6 });
    }

    C.line(box, labels, datasets, {
      valueFmt: (v) => C.fmtNum(v, 1),
      tickFmt: (v) => C.fmtNum(v, 0),
    });

    // Legende + Periodenrendite
    const leg = $("#tl-legend");
    leg.innerHTML = "";
    const ret = pv[0] ? ((pv[len - 1] - pv[0]) / pv[0]) * 100 : 0;
    leg.appendChild(legRow(C.cssVar("--accent"), "Portfolio", C.fmtPct(ret), C.signClass(ret)));
    if (benchIdx) {
      const br = benchIdx[benchIdx.length - 1] - 100;
      leg.appendChild(legRow(C.cssVar("--text-mute"), "Weltindex", C.fmtPct(br), C.signClass(br)));
    }
  }

  function legRow(color, label, val, cls) {
    return el("div", { class: "legend-row", style: "flex:0 0 auto;" }, [
      el("div", { class: "l" }, [el("span", { class: "dot", style: `background:${color}` }), label]),
      el("div", { class: "v " + (cls || ""), text: val }),
    ]);
  }

  /* ---------- Positionen-Tabelle ---------- */
  function holdingsCard(rows, total) {
    const card = el("div", { class: "card" });
    card.appendChild(el("div", { class: "card-head" }, [
      el("h3", { text: "Positionen" }),
      el("button", { class: "btn sm", onclick: () => openHoldingModal() }, "+ Position hinzufügen"),
    ]));

    const table = el("table");
    table.appendChild(el("thead", {}, el("tr", {}, [
      th("Titel", true), th("Anteil"), th("Stück"), th("Ø Kaufkurs"),
      th("Kurs"), th("Wert"), th("Heute"), th("G/V"), th(""),
    ])));
    const tb = el("tbody");
    [...rows].sort((a, b) => b.value - a.value).forEach((r) => {
      const w = total ? (r.value / total) * 100 : 0;
      tb.appendChild(el("tr", {}, [
        td([el("span", { class: "sym" }, r.symbol), el("div", { class: "sym-name", text: r.meta.name })], true),
        td(C.fmtNum(w, 1) + " %"),
        td(C.fmtNum(r.shares, r.shares % 1 ? 4 : 0)),
        td(C.fmtMoney(r.avgPrice)),
        td(C.fmtMoney(r.price)),
        td(el("b", { text: C.fmtMoney(r.value) })),
        tdSigned(r.changePct, C.fmtPct(r.changePct)),
        td(el("div", {}, [
          el("div", { class: C.signClass(r.pl), text: C.fmtMoney(r.pl) }),
          el("div", { class: "sym-name " + C.signClass(r.pl), text: C.fmtPct(r.plPct) }),
        ])),
        td(el("span", {}, [
          iconBtn("✎", "Bearbeiten", () => openHoldingModal(r)),
          iconBtn("🗑", "Entfernen", () => {
            if (confirm(`${r.symbol} aus dem Portfolio entfernen?`)) {
              C.state.removeHolding(r.symbol); C.rerender();
            }
          }),
        ])),
      ]));
    });
    table.appendChild(tb);
    card.appendChild(el("div", { class: "table-wrap" }, table));
    return card;
  }

  /* ---------- Position hinzufügen/bearbeiten ---------- */
  function openHoldingModal(existing) {
    const isEdit = !!existing;
    const opts = Object.keys(C.UNIVERSE).map((s) =>
      el("option", { value: s, ...(existing && existing.symbol === s ? { selected: "selected" } : {}) },
        `${s} · ${C.UNIVERSE[s].name}`)
    );
    const symSel = el("select", { id: "f-sym", ...(isEdit ? { disabled: "disabled" } : {}) }, opts);
    const shares = el("input", { type: "number", id: "f-shares", min: "0", step: "any", value: existing ? existing.shares : "" });
    const avg = el("input", { type: "number", id: "f-avg", min: "0", step: "any", value: existing ? existing.avgPrice : "" });

    const body = el("div", { class: "form-grid" }, [
      el("label", { class: "field full" }, ["Aktie", symSel]),
      el("label", { class: "field" }, ["Stückzahl", shares]),
      el("label", { class: "field" }, ["Ø Kaufkurs", avg]),
      el("div", { class: "full", style: "display:flex;gap:10px;justify-content:flex-end;margin-top:8px;" }, [
        el("button", { class: "btn ghost", onclick: () => C.closeModal() }, "Abbrechen"),
        el("button", {
          class: "btn",
          onclick: () => {
            const h = {
              symbol: symSel.value,
              shares: parseFloat(shares.value),
              avgPrice: parseFloat(avg.value),
            };
            if (!h.symbol || !(h.shares > 0) || !(h.avgPrice >= 0)) {
              C.toast("Bitte gültige Stückzahl und Kaufkurs angeben."); return;
            }
            C.state.addHolding(h);
            C.closeModal();
            C.toast(isEdit ? "Position aktualisiert." : "Position hinzugefügt.");
            C.rerender();
          },
        }, isEdit ? "Speichern" : "Hinzufügen"),
      ]),
    ]);
    C.openModal(isEdit ? "Position bearbeiten" : "Position hinzufügen", body);
  }

  /* ---------- kleine Tabellen-Helfer ---------- */
  function th(t, left) { return el("th", left ? {} : {}, t); }
  function td(content, left) {
    const n = el("td", {});
    if (Array.isArray(content)) content.forEach((c) => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    else n.appendChild(typeof content === "string" ? document.createTextNode(content) : content);
    return n;
  }
  function tdSigned(sign, text) {
    return el("td", {}, el("span", { class: C.signClass(sign) }, `${C.arrow(sign)} ${text}`));
  }
  function iconBtn(icon, title, onclick) {
    return el("button", { class: "icon-btn", title, onclick }, icon);
  }

  function emptyState() {
    return el("div", { class: "card" }, el("div", { class: "empty" }, [
      el("p", { text: "Noch keine Positionen im Portfolio." }),
      el("button", { class: "btn", onclick: () => openHoldingModal() }, "+ Erste Position hinzufügen"),
    ]));
  }
})(window.Cockpit);
