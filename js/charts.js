/* ============================================================
   charts.js – Chart.js-Fabriken (Kreis-, Linien-, Balkendiagramm)
   ============================================================ */
window.Cockpit = window.Cockpit || {};

(function (C) {
  "use strict";

  const registry = {}; // canvasId -> Chart-Instanz

  function destroy(id) {
    if (registry[id]) { registry[id].destroy(); delete registry[id]; }
  }
  C.destroyChart = destroy;

  function baseOptions() {
    const grid = C.cssVar("--border");
    const text = C.cssVar("--text-dim");
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: C.cssVar("--panel-2"),
          borderColor: grid,
          borderWidth: 1,
          titleColor: C.cssVar("--text"),
          bodyColor: text,
          padding: 12,
          cornerRadius: 10,
          displayColors: true,
          boxPadding: 4,
        },
      },
      scales: {
        x: { grid: { color: "transparent" }, ticks: { color: text, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
        y: { grid: { color: grid }, ticks: { color: text } },
      },
    };
  }

  /* ---------- Doughnut (Allokation) ---------- */
  C.doughnut = function (canvas, labels, values, colors) {
    const id = canvas.id;
    destroy(id);
    registry[id] = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: C.cssVar("--panel"),
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: Object.assign(baseOptions(), {
        cutout: "62%",
        scales: {},
        plugins: {
          legend: { display: false },
          tooltip: {
            ...baseOptions().plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total ? (ctx.parsed / total) * 100 : 0;
                return ` ${ctx.label}: ${C.fmtMoney(ctx.parsed)} (${C.fmtNum(pct, 1)} %)`;
              },
            },
          },
        },
      }),
    });
    return registry[id];
  };

  /* ---------- Line (Zeitverlauf / Vergleich, indexiert) ---------- */
  C.line = function (canvas, labels, datasets, opts) {
    const id = canvas.id;
    destroy(id);
    const o = opts || {};
    const ds = datasets.map((d) => {
      const col = d.color;
      let fill = false, bg;
      if (d.area) {
        const ctx = canvas.getContext("2d");
        const g = ctx.createLinearGradient(0, 0, 0, canvas.height || 300);
        g.addColorStop(0, hexA(col, 0.28));
        g.addColorStop(1, hexA(col, 0));
        bg = g; fill = true;
      }
      return {
        label: d.label,
        data: d.data,
        borderColor: col,
        backgroundColor: bg || col,
        borderWidth: d.width || 2,
        borderDash: d.dash || [],
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25,
        fill,
      };
    });
    const opt = baseOptions();
    if (o.valueFmt) {
      opt.plugins.tooltip.callbacks = { label: (ctx) => ` ${ctx.dataset.label}: ${o.valueFmt(ctx.parsed.y)}` };
      opt.scales.y.ticks.callback = (v) => o.tickFmt ? o.tickFmt(v) : v;
    }
    registry[id] = new Chart(canvas, { type: "line", data: { labels, datasets: ds }, options: opt });
    return registry[id];
  };

  /* ---------- Horizontal bar (Performance je Position) ---------- */
  C.barH = function (canvas, labels, values) {
    const id = canvas.id;
    destroy(id);
    const up = C.cssVar("--up"), down = C.cssVar("--down");
    const opt = baseOptions();
    opt.indexAxis = "y";
    opt.scales.x.ticks.callback = (v) => v + " %";
    opt.plugins.tooltip.callbacks = { label: (ctx) => " " + C.fmtPct(ctx.parsed.x) };
    registry[id] = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: values.map((v) => (v >= 0 ? hexA(up, 0.8) : hexA(down, 0.8))),
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: opt,
    });
    return registry[id];
  };

  // Hex/rgb -> rgba mit Alpha
  function hexA(col, a) {
    col = (col || "").trim();
    if (col.startsWith("#")) {
      let h = col.slice(1);
      if (h.length === 3) h = h.split("").map((c) => c + c).join("");
      const n = parseInt(h, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    const m = col.match(/\d+/g);
    if (m && m.length >= 3) return `rgba(${m[0]},${m[1]},${m[2]},${a})`;
    return col;
  }

  C.destroyAllCharts = function () { Object.keys(registry).forEach(destroy); };
})(window.Cockpit);
