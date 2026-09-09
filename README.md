# Cockpit

This cockpit should illustrate process-data or different kind of visualizaitons with the capability of drilling to a greater granulate.

## Interval Trainer

A self-contained interval / HIIT training timer, implemented from the
`Interval Trainer.dc.html` Claude Design canvas. No build step, no
dependencies — open `index.html` in any modern browser (or serve the folder).

### Files
- `index.html` — markup for all five screens (Setup, Training, Big Break, Done, Settings) inside an iOS-style device frame.
- `styles.css` — the dark design system: work `#FF5722`, rest `#00897B`, gold `#FFD700`, Inter + JetBrains Mono.
- `app.js` — the timer engine, phase-sequence model, audio/haptics, presets and history. Vanilla JS.

### Screens & flow
1. **Setup** — configure work / rest time, rounds per set, presets, big-break and auto-play toggles, plus a live sequence timeline and nonstop time forecast.
2. **Training** — live ring countdown, phase (Arbeit/Pause), round `x/y`, next-up label, set/round navigation chips and transport controls (reset · play/pause · skip). The last 3 seconds of a work phase pulse gold ("GO · PUSH").
3. **Big Break** — the gold recovery screen shown between sets, with `+1:00` and skip.
4. **Done** — workout summary: total vs. planned, work/rest split, and a completed-rounds grid.
5. **Settings** — steppers for all times, preset saving, and Signal & Feedback options.

### Features
- Drift-corrected countdown that stays accurate across ticks and tab switches.
- Work → rest → next round → big break (between sets) → done state machine.
- Web Audio countdown beeps and phase-change cues, optional vibration, optional voice announcements.
- Screen Wake Lock so the display stays on during a workout (where supported).
- Presets and settings persisted in `localStorage`.
- Time picker (drop-up minute/second wheel) for editing the work/rest/big-break durations.
- Responsive: framed phone mockup on desktop, full-bleed on real phones.
- Keyboard shortcuts on desktop: `Space` play/pause · `→` skip · `R` reset.
