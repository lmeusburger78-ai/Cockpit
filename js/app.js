/* ============================================================
   app.js – Router, Navigation, Theme, Einstellungen
   ============================================================ */
(function (C) {
  "use strict";
  const { $, $$ } = C;

  let currentPage = "portfolio";

  /* ---------- Router ---------- */
  async function navigate(page) {
    currentPage = page;
    const def = C.pages[page];
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
    $$(".page").forEach((p) => (p.hidden = true));
    const root = $("#page-" + page);
    root.hidden = false;
    $("#page-title").textContent = def.title;
    $("#page-subtitle").textContent = def.subtitle;
    C.destroyAllCharts();
    try {
      await def.render(root);
    } catch (e) {
      root.innerHTML = `<div class="card"><div class="empty">Fehler beim Laden: ${e.message}</div></div>`;
      console.error(e);
    }
  }

  C.rerender = () => navigate(currentPage);

  // Aus Watchlist ins Portfolio wechseln und Dialog öffnen
  C.goPortfolioAdd = async (sym) => {
    await navigate("portfolio");
    C.toast("Trage Stückzahl & Kaufkurs für " + sym + " ein.");
    // kleiner Timeout, damit die Seite gerendert ist
    setTimeout(() => {
      const btn = $$(".card-head .btn").find((b) => b.textContent.includes("Position hinzufügen"));
      if (btn) btn.click();
      setTimeout(() => { const s = $("#f-sym"); if (s) s.value = sym; }, 50);
    }, 100);
  };

  /* ---------- Modal ---------- */
  C.openModal = function (title, bodyNode, opts) {
    $("#modal-title").textContent = title;
    const body = $("#modal-body");
    body.innerHTML = "";
    body.appendChild(bodyNode);
    $("#modal").classList.toggle("wide", !!(opts && opts.wide));
    $("#modal-backdrop").hidden = false;
  };
  C.closeModal = () => { $("#modal-backdrop").hidden = true; C.destroyChart("detail-chart"); };

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    $("#btn-theme").textContent = theme === "dark" ? "☾" : "☀";
    C.state.setSettings({ theme });
  }

  /* ---------- Datenquellen-Badge ---------- */
  function updateBadge() {
    const badge = $("#data-badge");
    if (C.data.isLive()) { badge.textContent = "● Live (Finnhub)"; badge.classList.add("live"); }
    else { badge.textContent = "Demo-Daten"; badge.classList.remove("live"); }
  }

  /* ---------- Einstellungen ---------- */
  function openSettings() {
    const s = C.state.settings();
    const provider = C.el("select", { id: "s-provider" }, [
      C.el("option", { value: "demo", ...(s.provider === "demo" ? { selected: "selected" } : {}) }, "Demo-Daten (offline)"),
      C.el("option", { value: "finnhub", ...(s.provider === "finnhub" ? { selected: "selected" } : {}) }, "Finnhub (live)"),
    ]);
    const key = C.el("input", { type: "text", id: "s-key", value: s.finnhubKey || "", placeholder: "Finnhub API-Key" });
    const currency = C.el("select", { id: "s-currency" },
      ["EUR", "USD", "GBP"].map((c) => C.el("option", { value: c, ...(s.currency === c ? { selected: "selected" } : {}) }, c)));

    const body = C.el("div", { class: "form-grid" }, [
      C.el("label", { class: "field full" }, ["Datenquelle", provider]),
      C.el("label", { class: "field full" }, ["Finnhub API-Key", key]),
      C.el("p", { class: "hint full", html:
        'Kostenlosen Key erstellen auf <a href="https://finnhub.io/register" target="_blank" rel="noopener">finnhub.io</a>. ' +
        'Der Key wird nur lokal in deinem Browser gespeichert und direkt an Finnhub gesendet. ' +
        'Ohne Key läuft das Cockpit mit realistischen Demo-Daten.' }),
      C.el("label", { class: "field" }, ["Währung", currency]),
      C.el("div", { class: "full", style: "display:flex;gap:10px;justify-content:flex-end;margin-top:8px;" }, [
        C.el("button", { class: "btn ghost", onclick: () => C.closeModal() }, "Abbrechen"),
        C.el("button", {
          class: "btn",
          onclick: () => {
            C.state.setSettings({
              provider: provider.value,
              finnhubKey: key.value.trim(),
              currency: currency.value,
            });
            C.closeModal();
            updateBadge();
            C.toast("Einstellungen gespeichert.");
            C.rerender();
          },
        }, "Speichern"),
      ]),
    ]);
    C.openModal("Einstellungen", body);
  }

  /* ---------- Init ---------- */
  function init() {
    if (typeof Chart === "undefined") {
      const b = C.el("div", { class: "card", style: "margin-bottom:18px;border-color:var(--down);" },
        C.el("div", { class: "empty", text: "Hinweis: Chart-Bibliothek (js/vendor/chart.umd.js) nicht gefunden – Diagramme werden nicht angezeigt." }));
      $("#page-portfolio").appendChild(b);
    }
    C.state.init();
    applyTheme(C.state.settings().theme || "dark");
    updateBadge();

    // Navigation
    $$(".nav-item").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.page)));
    $("#btn-refresh").addEventListener("click", () => { C.toast("Aktualisiert."); C.rerender(); });
    $("#btn-theme").addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      C.rerender();
    });
    $("#btn-settings").addEventListener("click", openSettings);
    $("#modal-close").addEventListener("click", C.closeModal);
    $("#modal-backdrop").addEventListener("click", (e) => { if (e.target.id === "modal-backdrop") C.closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") C.closeModal(); });

    navigate("portfolio");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.Cockpit);
