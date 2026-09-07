/* ============================================================
   news.js – Seite "News & Zahlen"
   Branche wählen → News + Quartalszahlen der Aktien dieser Branche
   ============================================================ */
window.Cockpit = window.Cockpit || {};

(function (C) {
  "use strict";
  const { el, $ } = C;

  let sector = C.SECTORS[0];
  let scope = "sector"; // "sector" = ganze Branche | "mine" = nur eigene Titel

  C.pages = C.pages || {};
  C.pages.news = {
    title: "News & Zahlen",
    subtitle: "Nachrichten und Quartalszahlen nach Branche",

    async render(root) {
      root.innerHTML = "";

      // ---- Steuerung ----
      const ctrl = el("div", { class: "card", style: "margin-bottom:18px;" });
      ctrl.appendChild(el("div", { class: "card-head" }, el("h3", { text: "Branche auswählen" })));
      const chips = el("div", { class: "chips" },
        C.SECTORS.map((s) =>
          el("button", { class: "chip " + (sector === s ? "active" : ""), onclick: () => { sector = s; C.rerender(); } }, s)
        )
      );
      ctrl.appendChild(chips);
      const scopeSeg = el("div", { class: "seg", style: "margin-top:14px;" }, [
        el("button", { class: scope === "sector" ? "active" : "", onclick: () => { scope = "sector"; C.rerender(); } }, "Ganze Branche"),
        el("button", { class: scope === "mine" ? "active" : "", onclick: () => { scope = "mine"; C.rerender(); } }, "Nur meine Titel"),
      ]);
      ctrl.appendChild(scopeSeg);
      root.appendChild(ctrl);

      // ---- Symbole der Branche bestimmen ----
      let symbols = Object.keys(C.UNIVERSE).filter((s) => C.meta(s).sector === sector);
      if (scope === "mine") {
        const mine = new Set(C.state.allSymbols());
        symbols = symbols.filter((s) => mine.has(s));
      }

      if (!symbols.length) {
        root.appendChild(el("div", { class: "card" },
          el("div", { class: "empty", text: "Keine Titel in dieser Branche" + (scope === "mine" ? " in deinem Bestand." : ".") })));
        return;
      }

      // Titel-Übersicht
      root.appendChild(el("div", { class: "card", style: "margin-bottom:18px;" }, [
        el("div", { class: "card-head" }, [
          el("h3", { text: `${sector}` }),
          el("div", { class: "muted", text: `${symbols.length} Titel` }),
        ]),
        el("div", { class: "chips" }, symbols.map((s) =>
          el("span", { class: "chip", style: "cursor:default;" }, `${s} · ${C.meta(s).name}`))),
      ]));

      // ---- Quartalszahlen ----
      const earnCard = el("div", { class: "card", style: "margin-bottom:18px;" });
      earnCard.appendChild(el("div", { class: "card-head" }, [
        el("h3", { text: "Quartalszahlen" }),
        el("div", { class: "muted", text: "zuletzt berichtet" }),
      ]));
      earnCard.appendChild(el("div", { class: "empty", text: "Lade Zahlen …" }));
      root.appendChild(earnCard);

      // ---- News ----
      const newsCard = el("div", { class: "card" });
      newsCard.appendChild(el("div", { class: "card-head" }, [
        el("h3", { text: "Aktuelle Nachrichten" }),
        el("div", { class: "muted", id: "news-count", text: "" }),
      ]));
      newsCard.appendChild(el("div", { class: "empty", text: "Lade News …" }));
      root.appendChild(newsCard);

      // Daten laden (parallel)
      const [earnings, news] = await Promise.all([
        C.data.earnings(symbols),
        C.data.news(symbols),
      ]);

      renderEarnings(earnCard, earnings);
      renderNews(newsCard, news);
    },
  };

  function renderEarnings(card, earnings) {
    card.innerHTML = "";
    card.appendChild(el("div", { class: "card-head" }, [
      el("h3", { text: "Quartalszahlen" }),
      el("div", { class: "muted", text: "zuletzt berichtet" }),
    ]));
    if (!earnings.length) {
      card.appendChild(el("div", { class: "empty", text: "Keine Quartalsdaten verfügbar." }));
      return;
    }
    const grid = el("div", { class: "earn-grid" });
    earnings.forEach((e) => {
      const beat = e.epsSurprisePct >= 0;
      const rows = [
        earnRow("EPS (Ist)", el("b", { text: e.epsActual != null ? C.fmtNum(e.epsActual) : "–" })),
        earnRow("EPS (Erw.)", e.epsEstimate != null ? C.fmtNum(e.epsEstimate) : "–"),
        earnRow("Überraschung", el("span", { class: beat ? "beat" : "miss" },
          `${beat ? "▲" : "▼"} ${C.fmtPct(e.epsSurprisePct)}`)),
      ];
      if (e.revenueActual != null) {
        rows.push(earnRow("Umsatz", el("b", { text: C.fmtNum(e.revenueActual, 0) + " Mio." })));
      }
      grid.appendChild(el("div", { class: "earn-card" }, [
        el("div", { class: "head" }, [
          el("div", {}, [el("span", { class: "sym", text: e.symbol }),
            el("div", { class: "sym-name", text: C.meta(e.symbol).name })]),
          el("div", { style: "text-align:right;" }, [
            el("div", { class: "when", text: e.period || "" }),
            el("div", { class: "when", text: C.fmtDate(e.date) }),
          ]),
        ]),
        ...rows,
      ]));
    });
    card.appendChild(grid);
  }

  function earnRow(label, val) {
    return el("div", { class: "earn-row" }, [
      el("span", { text: label }),
      typeof val === "string" ? el("span", { text: val }) : val,
    ]);
  }

  function renderNews(card, news) {
    card.innerHTML = "";
    card.appendChild(el("div", { class: "card-head" }, [
      el("h3", { text: "Aktuelle Nachrichten" }),
      el("div", { class: "muted", text: `${news.length} Meldungen` }),
    ]));
    if (!news.length) {
      card.appendChild(el("div", { class: "empty", text: "Keine aktuellen Nachrichten." }));
      return;
    }
    const list = el("div", { class: "news-list" });
    news.slice(0, 40).forEach((n) => {
      const link = n.url && n.url !== "#"
        ? el("a", { href: n.url, target: "_blank", rel: "noopener", text: n.headline })
        : el("span", { text: n.headline });
      list.appendChild(el("div", { class: "news-item" }, [
        el("div", { class: "tag" }, el("span", { class: "news-cat news", text: n.symbol })),
        el("div", { class: "news-body" }, [
          el("h4", {}, link),
          el("div", { class: "news-meta" }, [
            el("span", { text: C.meta(n.symbol).name }),
            el("span", { text: "·" }),
            el("span", { text: n.source || "" }),
            el("span", { text: "·" }),
            el("span", { text: C.fmtRel(n.datetime) }),
          ]),
          n.summary ? el("p", { class: "news-summary", text: trim(n.summary, 240) }) : null,
        ]),
      ]));
    });
    card.appendChild(list);
  }

  function trim(s, n) { return s && s.length > n ? s.slice(0, n).trim() + " …" : s; }
})(window.Cockpit);
