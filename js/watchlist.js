/* ============================================================
   watchlist.js – Seite "Watchlist" (selbst gewählte Aktien)
   ============================================================ */
window.Cockpit = window.Cockpit || {};

(function (C) {
  "use strict";
  const { el, $ } = C;

  let sectorFilter = "Alle";

  C.pages = C.pages || {};
  C.pages.watchlist = {
    title: "Watchlist",
    subtitle: "Aktien, die du beobachtest",

    async render(root) {
      root.innerHTML = "";

      // Kopf mit Auswahl zum Hinzufügen
      root.appendChild(addCard());

      const symbols = C.state.watchlist();
      if (!symbols.length) {
        root.appendChild(el("div", { class: "card" },
          el("div", { class: "empty", text: "Deine Watchlist ist leer – füge oben Aktien hinzu." })));
        return;
      }

      // Branchen-Filter
      const sectors = ["Alle", ...Array.from(new Set(symbols.map((s) => C.meta(s).sector)))];
      const chips = el("div", { class: "chips", style: "margin-bottom:16px;" },
        sectors.map((sec) =>
          el("button", {
            class: "chip " + (sectorFilter === sec ? "active" : ""),
            onclick: () => { sectorFilter = sec; C.rerender(); },
          }, sec)
        )
      );
      root.appendChild(chips);

      const shown = symbols.filter((s) => sectorFilter === "Alle" || C.meta(s).sector === sectorFilter);

      const card = el("div", { class: "card" });
      card.appendChild(el("div", { class: "card-head" }, [
        el("h3", { text: "Beobachtete Titel" }),
        el("div", { class: "muted", text: `${shown.length} von ${symbols.length}` }),
      ]));
      card.appendChild(el("div", { class: "empty", text: "Lade Kurse …" }));
      root.appendChild(card);

      const quotes = await C.data.quotes(shown);

      const table = el("table");
      table.appendChild(el("thead", {}, el("tr", {}, [
        el("th", {}, "Titel"), el("th", {}, "Branche"),
        el("th", {}, "Kurs"), el("th", {}, "Veränderung"),
        el("th", {}, "Tagesbereich"), el("th", {}, ""),
      ])));
      const tb = el("tbody");
      shown.forEach((sym) => {
        const m = C.meta(sym);
        const q = quotes[sym] || { price: m.base, changePct: 0, change: 0 };
        tb.appendChild(el("tr", {}, [
          el("td", {}, [el("span", { class: "sym" }, sym), el("div", { class: "sym-name", text: m.name })]),
          el("td", {}, el("span", { class: "sym-name", text: m.sector })),
          el("td", {}, el("b", { text: C.fmtMoney(q.price) })),
          el("td", {}, el("span", { class: C.signClass(q.change) },
            `${C.arrow(q.change)} ${C.fmtMoney(Math.abs(q.change))} (${C.fmtPct(q.changePct)})`)),
          el("td", {}, sparkbar(q)),
          el("td", {}, [
            el("button", { class: "icon-btn", title: "Ins Portfolio", onclick: () => C.goPortfolioAdd(sym) }, "＋"),
            el("button", { class: "icon-btn", title: "Entfernen", onclick: () => { C.state.removeWatch(sym); C.toast(sym + " entfernt."); C.rerender(); } }, "🗑"),
          ]),
        ]));
      });
      table.appendChild(tb);
      card.innerHTML = "";
      card.appendChild(el("div", { class: "card-head" }, [
        el("h3", { text: "Beobachtete Titel" }),
        el("div", { class: "muted", text: `${shown.length} von ${symbols.length}` }),
      ]));
      card.appendChild(el("div", { class: "table-wrap" }, table));
    },
  };

  function addCard() {
    const available = Object.keys(C.UNIVERSE).filter((s) => !C.state.watchlist().includes(s));
    const sel = el("select", { id: "wl-add" },
      available.length
        ? available.map((s) => el("option", { value: s }, `${s} · ${C.UNIVERSE[s].name} (${C.UNIVERSE[s].sector})`))
        : [el("option", { value: "" }, "Alle Titel bereits in der Watchlist")]
    );
    const card = el("div", { class: "card", style: "margin-bottom:18px;" });
    card.appendChild(el("div", { class: "card-head" }, el("h3", { text: "Aktie hinzufügen" })));
    card.appendChild(el("div", { style: "display:flex;gap:10px;flex-wrap:wrap;align-items:end;" }, [
      el("label", { class: "field", style: "flex:1;min-width:240px;" }, ["Titel auswählen", sel]),
      el("button", {
        class: "btn",
        onclick: () => {
          const v = sel.value;
          if (!v) return;
          C.state.addWatch(v);
          C.toast(v + " zur Watchlist hinzugefügt.");
          C.rerender();
        },
      }, "+ Hinzufügen"),
    ]));
    return card;
  }

  // kleiner Tagesbereich-Balken (visualisiert Position im Tag)
  function sparkbar(q) {
    const pct = Math.max(0, Math.min(100, 50 + (q.changePct || 0) * 6));
    const col = q.change >= 0 ? C.cssVar("--up") : C.cssVar("--down");
    return el("div", { style: "width:120px;height:8px;background:var(--panel-2);border-radius:4px;position:relative;border:1px solid var(--border);" },
      el("div", { style: `position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${col};border-radius:4px;` }));
  }
})(window.Cockpit);
