/* ===================================================================
   Interval Trainer — app logic
   Implements the state machine from "Interval Trainer.dc.html":
     phase work/rest, rounds per set, sets, big break between sets,
     live ring, last-3s gold warning, sound/haptics, presets, history.
   Vanilla JS, no dependencies.
   =================================================================== */
(() => {
  'use strict';

  // ---------- Persistence ----------
  const LS = {
    config: 'it.config.v1',
    settings: 'it.settings.v1',
    presets: 'it.presets.v1',
    last: 'it.last.v1',
  };
  const load = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const DEFAULT_CONFIG = {
    workSec: 120, restSec: 60, roundsPerSet: 8, sets: 2, bigBreakSec: 300,
    autoPlay: true, bigBreakOn: true,
  };
  const DEFAULT_SETTINGS = {
    sound: true, countdown: true, vibration: false, voice: false, keepDisplay: true,
  };
  const DEFAULT_PRESETS = [
    { id: 'p_leistung', name: 'Leistung', workSec: 120, restSec: 60, roundsPerSet: 8, sets: 2, bigBreakSec: 300, bigBreakOn: true },
    { id: 'p_crossfit', name: 'CrossFit 20', workSec: 60, restSec: 0, roundsPerSet: 20, sets: 1, bigBreakSec: 300, bigBreakOn: false },
    { id: 'p_sprint', name: 'Sprint 10', workSec: 30, restSec: 90, roundsPerSet: 10, sets: 1, bigBreakSec: 300, bigBreakOn: false },
  ];

  let config = Object.assign({}, DEFAULT_CONFIG, load(LS.config, {}));
  let settings = Object.assign({}, DEFAULT_SETTINGS, load(LS.settings, {}));
  let presets = load(LS.presets, DEFAULT_PRESETS.slice());

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const fmt = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const fmtLong = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ---------- Sequence model ----------
  // Produces the ordered list of phases the timer walks through.
  function buildSequence(cfg) {
    const seq = [];
    const bigBreak = cfg.bigBreakOn && cfg.sets > 1;
    for (let s = 1; s <= cfg.sets; s++) {
      for (let r = 1; r <= cfg.roundsPerSet; r++) {
        seq.push({ type: 'work', set: s, round: r, dur: cfg.workSec });
        const lastRound = r === cfg.roundsPerSet;
        const lastSet = s === cfg.sets;
        if (lastRound && lastSet) {
          // workout ends after this work phase
        } else if (lastRound && !lastSet) {
          if (bigBreak && cfg.bigBreakSec > 0) {
            seq.push({ type: 'bigbreak', set: s, toSet: s + 1, dur: cfg.bigBreakSec });
          } else if (cfg.restSec > 0) {
            seq.push({ type: 'rest', set: s, round: r, dur: cfg.restSec });
          }
        } else if (cfg.restSec > 0) {
          seq.push({ type: 'rest', set: s, round: r, dur: cfg.restSec });
        }
      }
    }
    return seq;
  }

  function totalWorkoutSeconds(cfg) {
    return buildSequence(cfg).reduce((a, p) => a + p.dur, 0);
  }
  function globalRoundNumber(cfg, set, round) {
    return (set - 1) * cfg.roundsPerSet + round;
  }

  // ---------- Audio (Web Audio, no assets) ----------
  const Audio = (() => {
    let ctx = null;
    const ensure = () => {
      if (!ctx) {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    const beep = (freq, dur = 0.12, gain = 0.18, type = 'sine') => {
      if (!settings.sound) return;
      const c = ensure(); if (!c) return;
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = type; osc.frequency.value = freq;
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(); osc.stop(c.currentTime + dur + 0.02);
    };
    return {
      unlock: ensure,
      tick: () => beep(660, 0.08, 0.14, 'triangle'),          // countdown 5..2
      go: () => beep(990, 0.22, 0.2, 'square'),               // phase → work
      rest: () => beep(430, 0.28, 0.18, 'sine'),              // phase → rest
      big: () => { beep(520, 0.18, 0.18); setTimeout(() => beep(390, 0.3, 0.18), 160); },
      done: () => { beep(660, 0.15, 0.2); setTimeout(() => beep(880, 0.15, 0.2), 150); setTimeout(() => beep(1175, 0.35, 0.22), 300); },
    };
  })();

  function vibrate(pattern) {
    if (settings.vibration && navigator.vibrate) { try { navigator.vibrate(pattern); } catch {} }
  }

  function speak(text) {
    if (!settings.voice || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; u.rate = 1.05;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch {}
  }

  // ---------- Wake lock ----------
  let wakeLock = null;
  async function requestWakeLock() {
    if (!settings.keepDisplay || !('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }
  function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch {} wakeLock = null; }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && engine.running) requestWakeLock();
  });

  // ---------- Engine ----------
  const RING_R = 158;
  const RING_C = 2 * Math.PI * RING_R;

  const engine = {
    seq: [],
    idx: 0,
    remaining: 0,
    running: false,
    startedAt: null,        // wall clock of workout start
    _tickHandle: null,
    _lastBeep: null,        // remaining value we last beeped at
    elapsed: { work: 0, rest: 0, big: 0 }, // actual seconds spent per type
    completed: [],          // per global round: 'work' | 'skipped'

    reset() {
      this.seq = [];
      this.idx = 0;
      this.remaining = 0;
      this.running = false;
      this.startedAt = null;
      this._lastBeep = null;
      this.elapsed = { work: 0, rest: 0, big: 0 };
      this.completed = [];
    },

    start() {
      this.reset();
      this.seq = buildSequence(config);
      if (!this.seq.length) return;
      this.idx = 0;
      this.remaining = this.seq[0].dur;
      this.startedAt = Date.now();
      this.completed = new Array(config.roundsPerSet * config.sets).fill(null);
      Audio.unlock();
      if (config.autoPlay) this.play(); else this.pause();
      ui.showFor(this.current());
      ui.render();
    },

    current() { return this.seq[this.idx] || null; },
    next() { return this.seq[this.idx + 1] || null; },

    play() {
      if (this.running || !this.current()) return;
      this.running = true;
      this._lastTs = Date.now();
      this._acc = 0;
      this._tickHandle = setInterval(() => this._loop(), 200);
      requestWakeLock();
      ui.render();
    },
    pause() {
      this.running = false;
      clearInterval(this._tickHandle); this._tickHandle = null;
      releaseWakeLock();
      ui.render();
    },
    toggle() { this.running ? this.pause() : this.play(); },

    _loop() {
      // drift-corrected: accumulate real elapsed and consume whole seconds
      const now = Date.now();
      this._acc += (now - this._lastTs) / 1000;
      this._lastTs = now;
      while (this._acc >= 1) {
        this._acc -= 1;
        this._second();
        if (!this.running) break;
      }
      ui.tickRender();
    },

    _second() {
      const cur = this.current();
      if (!cur) return;
      this.remaining -= 1;
      // track elapsed
      const bucket = cur.type === 'work' ? 'work' : cur.type === 'rest' ? 'rest' : 'big';
      this.elapsed[bucket] += 1;

      // countdown cues in the last 5 seconds
      if (settings.countdown && this.remaining <= 5 && this.remaining >= 1) {
        if (this._lastBeep !== this.remaining) {
          this._lastBeep = this.remaining;
          Audio.tick();
          vibrate(30);
        }
      }
      if (this.remaining <= 0) {
        this.advance(false);
      }
    },

    // advance to next phase; skipped=true means user-initiated skip
    advance(skipped) {
      const cur = this.current();
      if (cur && cur.type === 'work') {
        const g = globalRoundNumber(config, cur.set, cur.round);
        if (g >= 1 && g <= this.completed.length) {
          this.completed[g - 1] = skipped && this.remaining > 0 ? 'skipped' : 'work';
        }
      }
      this._lastBeep = null;
      this.idx += 1;
      const nx = this.current();
      if (!nx) { this.finish(); return; }
      this.remaining = nx.dur;

      // feedback + view for the phase we just entered
      if (nx.type === 'work') { Audio.go(); vibrate([60, 40, 60]); speak('Arbeit, los!'); }
      else if (nx.type === 'rest') { Audio.rest(); vibrate(90); speak('Pause'); }
      else if (nx.type === 'bigbreak') { Audio.big(); vibrate([80, 60, 80, 60, 120]); speak('Grosse Pause'); }

      ui.showFor(nx);
      if (!config.autoPlay && !skipped) this.pause();
      ui.render();
    },

    skip() { if (this.current()) this.advance(true); },

    // jump backwards/forwards by round or set
    jump(kind) {
      const cur = this.current();
      if (!cur) return;
      const curSet = cur.set || 1;
      const curRound = cur.round || 1;
      let targetSet = curSet, targetRound = curRound;
      if (kind === 'roundfwd') targetRound = curRound + 1;
      else if (kind === 'roundback') targetRound = curRound - 1;
      else if (kind === 'setfwd') { targetSet = curSet + 1; targetRound = 1; }
      else if (kind === 'setback') { targetSet = curSet - 1; targetRound = 1; }

      if (targetRound < 1) { targetSet -= 1; targetRound = config.roundsPerSet; }
      if (targetRound > config.roundsPerSet) { targetSet += 1; targetRound = 1; }
      targetSet = clamp(targetSet, 1, config.sets);
      targetRound = clamp(targetRound, 1, config.roundsPerSet);

      const i = this.seq.findIndex(p => p.type === 'work' && p.set === targetSet && p.round === targetRound);
      if (i < 0) return;
      this.idx = i;
      this.remaining = this.seq[i].dur;
      this._lastBeep = null;
      ui.showFor(this.current());
      ui.render();
    },

    resetTimer() {
      // back to first phase, paused
      this.pause();
      this.idx = 0;
      this.remaining = this.seq.length ? this.seq[0].dur : 0;
      this._lastBeep = null;
      this.elapsed = { work: 0, rest: 0, big: 0 };
      this.completed = new Array(config.roundsPerSet * config.sets).fill(null);
      ui.showFor(this.current());
      ui.render();
    },

    addTime(sec) {
      this.remaining += sec;
      ui.tickRender();
    },

    finish() {
      this.pause();
      Audio.done(); vibrate([120, 80, 120, 80, 200]);
      speak('Workout fertig. Stark!');
      const planned = totalWorkoutSeconds(config);
      const actual = this.elapsed.work + this.elapsed.rest + this.elapsed.big;
      const summary = {
        when: Date.now(),
        config: Object.assign({}, config),
        planned,
        actual,
        elapsed: Object.assign({}, this.elapsed),
        completed: this.completed.slice(),
        seq: this.seq.map(p => ({ type: p.type, set: p.set, round: p.round })),
      };
      save(LS.last, summary);
      ui.renderDone(summary);
      ui.show('done');
    },
  };

  // ---------- Warning state (last 3s of work while running) ----------
  function isWarning() {
    const cur = engine.current();
    return !!cur && cur.type === 'work' && engine.running && engine.remaining <= 3 && engine.remaining > 0;
  }

  // ---------- UI ----------
  const ui = {
    els: {},

    init() {
      // cache elements
      this.els = {
        views: {
          setup: $('#view-setup'), training: $('#view-training'),
          bigbreak: $('#view-bigbreak'), done: $('#view-done'), settings: $('#view-settings'),
        },
      };
      this.wireStatic();
      this.renderSetup();
      this.renderSettings();
      this.show('setup');
      this.startClock();
    },

    show(name) {
      Object.entries(this.els.views).forEach(([k, el]) => el.classList.toggle('active', k === name));
      $('#device').scrollTop = 0;
      const view = this.els.views[name];
      if (view) view.scrollTop = 0;
      this.currentView = name;
    },
    showFor(phase) {
      if (!phase) return;
      if (phase.type === 'bigbreak') { this.renderBigBreak(phase); this.show('bigbreak'); }
      else { this.show('training'); }
    },

    // -------- status bar clock --------
    startClock() {
      const upd = () => {
        const d = new Date();
        $('#sbTime').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      };
      upd(); setInterval(upd, 15000);
    },

    // -------- SETUP --------
    // Home = read-only overview only. All editing lives in Settings.
    renderSetup() {
      $('#setupTitle').textContent = currentProgramName();
      $('#setupWork').textContent = fmt(config.workSec);
      $('#setupRest').textContent = fmt(config.restSec);
      $('#ovRounds').textContent = config.roundsPerSet;
      $('#ovSets').textContent = config.sets;
      $('#ovBigBreak').textContent = (config.bigBreakOn && config.sets > 1) ? fmt(config.bigBreakSec) : '—';
      this.renderSequence();
      this.renderForecast();
    },

    renderPresets() {
      const strip = $('#presetStrip');
      strip.innerHTML = '';
      if (!presets.length) {
        const empty = document.createElement('div');
        empty.className = 'pc-rounds';
        empty.style.padding = '10px 2px';
        empty.textContent = 'Noch keine Presets gespeichert';
        strip.appendChild(empty);
        return;
      }
      presets.forEach(p => {
        const dot = p.workSec <= 45 ? 'var(--rest)' : (p.restSec === 0 ? 'var(--gold)' : 'var(--work)');
        const card = document.createElement('button');
        card.className = 'preset-card' + (sameConfig(p, config) ? ' selected' : '');
        card.innerHTML = `
          <div class="pc-head">
            <div class="pc-name">${escapeHtml(p.name)}</div>
            <span class="dot" style="background:${dot};box-shadow:0 0 8px ${dot};"></span>
          </div>
          <div class="pc-tags">
            <span class="pc-tag w">Arbeit ${fmt(p.workSec)}</span>
            <span class="pc-tag r">Pause ${fmt(p.restSec)}</span>
          </div>
          <div class="pc-foot">
            <span class="pc-rounds">${p.roundsPerSet * (p.sets || 1)} Runden</span>
            <span class="pc-total">${fmtLong(totalWorkoutSeconds(normalizeCfg(p)))}</span>
          </div>`;
        card.addEventListener('click', () => this.applyPreset(p));
        // long-press / right-click delete for user presets
        if (!isDefaultPreset(p.id)) {
          card.addEventListener('contextmenu', (e) => { e.preventDefault(); this.deletePreset(p.id); });
        }
        strip.appendChild(card);
      });
    },

    applyPreset(p) {
      config = Object.assign({}, config, normalizeCfg(p));
      save(LS.config, config);
      this.renderSetup(); this.renderSettings();
      toast(`Preset „${p.name}" geladen`);
    },
    deletePreset(id) {
      presets = presets.filter(p => p.id !== id);
      save(LS.presets, presets);
      this.renderPresets();
      toast('Preset gelöscht');
    },

    renderSequence() {
      const cfg = config;
      const seq = buildSequence(cfg);
      const total = seq.reduce((a, p) => a + p.dur, 0);
      $('#sequenceLabel').textContent = `Ablauf · ${fmtLong(total)} total`;
      $('#sequenceSets').textContent = `${cfg.sets} Set${cfg.sets > 1 ? 's' : ''} × ${cfg.roundsPerSet}`;

      const list = $('#sequenceList');
      list.innerHTML = '';
      // group per round: work (+ following rest/bigbreak)
      const maxDur = Math.max(cfg.workSec, cfg.restSec, cfg.bigBreakSec, 1);
      const scale = 120 / maxDur; // px per second, capped
      let round = 0;
      for (let i = 0; i < seq.length; i++) {
        const p = seq[i];
        if (p.type !== 'work') continue;
        round++;
        const after = seq[i + 1];
        const workW = Math.max(10, Math.round(p.dur * scale));
        let afterBar = '', total = p.dur;
        if (after && after.type === 'rest') { afterBar = `<div class="seq-bar r" style="width:${Math.max(6, Math.round(after.dur * scale))}px"></div>`; total += after.dur; }
        else if (after && after.type === 'bigbreak') { afterBar = `<div class="seq-bar b" style="width:${Math.max(6, Math.round(after.dur * scale))}px"></div>`; total += after.dur; }
        const row = document.createElement('div');
        row.className = 'seq-row';
        row.innerHTML = `
          <div class="seq-n">${String(round).padStart(2, '0')}</div>
          <div class="seq-bars">
            <div class="seq-bar w" style="width:${workW}px"></div>
            ${afterBar}
          </div>
          <div class="seq-total">${fmt(total)}</div>`;
        list.appendChild(row);
      }
    },

    renderForecast() {
      const auto = config.autoPlay;
      $('#forecast').hidden = !auto;
      $('#forecastManual').hidden = auto;
      if (!auto) return;
      const total = totalWorkoutSeconds(config);
      $('#forecastTotal').textContent = fmtLong(total);
      const finish = new Date(Date.now() + total * 1000);
      $('#forecastFinish').textContent = `${String(finish.getHours()).padStart(2, '0')}:${String(finish.getMinutes()).padStart(2, '0')}`;
      const rounds = config.roundsPerSet * config.sets;
      $('#forecastSetsLine').textContent = `${config.sets} Set${config.sets > 1 ? 's' : ''} · ${rounds} Runden`;
      const breaks = (config.bigBreakOn && config.sets > 1) ? config.sets - 1 : 0;
      $('#forecastBreakLine').textContent = breaks ? `+ ${breaks}× große Pause ${fmt(config.bigBreakSec)}` : 'keine große Pause';
    },

    // -------- TRAINING --------
    render() {
      if (this.currentView !== 'training') { this.renderCurrentOnly(); return; }
      const cur = engine.current();
      if (!cur) return;
      const isWork = cur.type === 'work';
      const view = this.els.views.training;
      view.classList.toggle('is-rest', !isWork);
      view.classList.toggle('running', engine.running && !isWarning());
      view.classList.toggle('warn', isWarning());

      const phaseColor = isWork ? 'var(--work)' : 'var(--rest)';
      $('#phaseDot').style.background = isWork ? '#FF5722' : '#00897B';
      $('#phaseDot').style.boxShadow = `0 0 14px ${isWork ? '#FF5722' : '#00897B'}`;
      $('#phaseLabel').textContent = isWork ? 'ARBEIT' : 'PAUSE';
      $('#timerSub').textContent = isWork ? 'GO · PUSH' : 'RECOVER · BREATHE';

      const gRound = isWork ? cur.round : cur.round;
      $('#roundNow').textContent = String(cur.round || 1).padStart(2, '0');
      $('#roundTot').textContent = '/' + String(config.roundsPerSet).padStart(2, '0');
      $('#phaseTotal').textContent = fmt(cur.dur);

      // play/pause icon
      $('#iconPause').hidden = !engine.running;
      $('#iconPlay').hidden = engine.running;

      // next label
      $('#nextLabel').textContent = this.nextLabel();
      $('#trAuto').textContent = config.autoPlay ? 'AUTO · ON' : 'MANUELL';

      this.tickRender();
    },

    renderCurrentOnly() {
      // if a non-training view is active but engine changed, still keep bigbreak timer synced
      if (this.currentView === 'bigbreak') this.tickRender();
    },

    tickRender() {
      const cur = engine.current();
      if (!cur) return;
      if (cur.type === 'bigbreak' && this.currentView === 'bigbreak') {
        $('#bbTimer').textContent = fmt(engine.remaining);
        return;
      }
      if (this.currentView !== 'training') return;
      const view = this.els.views.training;
      view.classList.toggle('warn', isWarning());
      view.classList.toggle('running', engine.running && !isWarning());
      $('#ringCenter').classList.toggle('warn', isWarning());

      $('#timerBig').textContent = fmt(engine.remaining);
      $('#iconPause').hidden = !engine.running;
      $('#iconPlay').hidden = engine.running;

      // ring progress
      const pct = clamp(engine.remaining / cur.dur, 0, 1);
      const prog = $('#ringProg');
      prog.setAttribute('stroke-dasharray', RING_C.toFixed(2));
      prog.setAttribute('stroke-dashoffset', (RING_C * (1 - pct)).toFixed(2));
    },

    nextLabel() {
      const nx = engine.next();
      if (!nx) return 'Fertig';
      if (nx.type === 'rest') return `${fmt(nx.dur)} Pause`;
      if (nx.type === 'bigbreak') return `Große Pause ${fmt(nx.dur)}`;
      if (nx.type === 'work') return `Runde ${nx.round} · ${fmt(nx.dur)} Arbeit`;
      return '—';
    },

    // -------- BIG BREAK --------
    renderBigBreak(phase) {
      $('#bbTimer').textContent = fmt(engine.remaining);
      $('#bbSetDone').textContent = `Set ${phase.set} · abgeschlossen`;
      $('#bbSetOld').textContent = `Set ${phase.set}`;
      $('#bbSetNew').textContent = `Set ${phase.toSet}`;
      $('#bbNextRounds').textContent = config.roundsPerSet;
      $('#bbNextWork').textContent = fmt(config.workSec);
      $('#bbNextRest').textContent = fmt(config.restSec);
    },

    // -------- DONE --------
    renderDone(s) {
      const cfg = s.config;
      $('#dnMeta').textContent = `Leistung · ${cfg.sets} Set${cfg.sets > 1 ? 's' : ''} × ${cfg.roundsPerSet} Runden · ${timeRange(s)}`;
      $('#dnTotal').textContent = fmtLong(s.actual);

      const delta = s.actual - s.planned;
      const dEl = $('#dnDelta');
      if (Math.abs(delta) < 2) { dEl.textContent = 'wie geplant'; dEl.style.color = 'rgba(255,255,255,.4)'; }
      else if (delta > 0) { dEl.textContent = `+${fmt(delta)} länger als geplant`; dEl.style.color = 'var(--rest)'; }
      else { dEl.textContent = `−${fmt(-delta)} schneller als geplant`; dEl.style.color = 'var(--work)'; }

      const doneRounds = s.completed.filter(x => x === 'work').length;
      $('#dnWork').textContent = fmtLong(s.elapsed.work);
      $('#dnWorkSub').textContent = `${doneRounds} Runde${doneRounds !== 1 ? 'n' : ''}`;
      $('#dnRest').textContent = fmtLong(s.elapsed.rest + s.elapsed.big);
      const smallBreaks = s.seq.filter(p => p.type === 'rest').length;
      const bigBreaks = s.seq.filter(p => p.type === 'bigbreak').length;
      $('#dnRestSub').textContent = bigBreaks ? `${smallBreaks}× klein · ${bigBreaks}× groß` : `${smallBreaks}× Pause`;

      // round grid
      const grid = $('#dnRoundGrid');
      grid.innerHTML = '';
      const setSize = cfg.roundsPerSet;
      s.completed.forEach((state, i) => {
        const cell = document.createElement('div');
        const isSetBoundary = cfg.sets > 1 && ((i + 1) % setSize === 0) && (i + 1) < s.completed.length;
        let cls = 'dn-cell ';
        if (state === 'work') cls += isSetBoundary ? 'big' : 'work';
        else cls += 'skipped';
        cell.className = cls;
        cell.textContent = String(i + 1).padStart(2, '0');
        grid.appendChild(cell);
      });
    },

    // -------- SETTINGS --------
    renderSettings() {
      $('#stWork').textContent = fmt(config.workSec);
      $('#stRest').textContent = fmt(config.restSec);
      $('#stRounds').textContent = config.roundsPerSet;
      $('#stSets').textContent = config.sets;
      $('#stBigBreak').textContent = fmt(config.bigBreakSec);
      $('#bigBreakSub').textContent = `Nach ${config.roundsPerSet} Runden ${fmt(config.bigBreakSec)} Pause zwischen Sets`;
      $$('.switch[data-toggle]').forEach(sw => {
        const key = sw.getAttribute('data-toggle');
        sw.setAttribute('aria-checked', String(!!settings[key]));
      });
      $$('.switch[data-cfgtoggle]').forEach(sw => {
        const key = sw.getAttribute('data-cfgtoggle');
        sw.setAttribute('aria-checked', String(!!config[key]));
      });
      this.renderPresets();
    },

    // -------- wiring --------
    wireStatic() {
      // steppers (setup + settings share data-step)
      $$('[data-step]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.step(btn.getAttribute('data-step'), parseInt(btn.getAttribute('data-dir'), 10));
        });
      });

      // edit time values (Settings only) → wheel picker
      $$('[data-edit]').forEach(btn => {
        const open = () => openPicker(btn.getAttribute('data-edit'));
        btn.addEventListener('click', open);
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
      });

      // "adjust in settings" link on the overview
      $('#openSettings2').addEventListener('click', () => { this.renderSettings(); this.show('settings'); });

      // config toggles (Ablauf: Auto-Play, Große Pause) — Settings only
      $$('.switch[data-cfgtoggle]').forEach(sw => {
        sw.addEventListener('click', () => {
          const key = sw.getAttribute('data-cfgtoggle');
          config[key] = !config[key];
          save(LS.config, config);
          this.renderSettings(); this.renderSetup();
        });
      });

      // settings toggles
      $$('.switch[data-toggle]').forEach(sw => {
        sw.addEventListener('click', () => {
          const key = sw.getAttribute('data-toggle');
          settings[key] = !settings[key];
          save(LS.settings, settings);
          this.renderSettings();
          if (key === 'sound' && settings.sound) Audio.go();
          if (key === 'vibration' && settings.vibration) vibrate(60);
          if (key === 'keepDisplay') { settings.keepDisplay ? (engine.running && requestWakeLock()) : releaseWakeLock(); }
        });
      });

      // navigation
      $('#openSettings').addEventListener('click', () => { this.renderSettings(); this.show('settings'); });
      $('#closeSettings').addEventListener('click', () => { this.renderSetup(); this.show('setup'); });
      $('#startBtn').addEventListener('click', () => { Audio.unlock(); engine.start(); });

      // transport
      $('#playBtn').addEventListener('click', () => { Audio.unlock(); engine.toggle(); });
      $('#resetBtn').addEventListener('click', () => engine.resetTimer());
      $('#skipBtn').addEventListener('click', () => engine.skip());
      $$('[data-nav]').forEach(b => b.addEventListener('click', () => engine.jump(b.getAttribute('data-nav'))));

      // big break
      $('#bbAddBtn').addEventListener('click', () => engine.addTime(60));
      $('#bbSkipBtn').addEventListener('click', () => engine.skip());

      // done
      $('#dnRestart').addEventListener('click', () => engine.start());
      $('#dnHome').addEventListener('click', () => { engine.reset(); this.renderSetup(); this.show('setup'); });
      $('#dnSavePreset').addEventListener('click', () => this.savePreset(''));

      // preset saving
      $('#savePresetBtn').addEventListener('click', () => {
        const name = $('#presetName').value.trim();
        this.savePreset(name);
        $('#presetName').value = '';
      });
      $('#presetName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { this.savePreset($('#presetName').value.trim()); $('#presetName').value = ''; }
      });

      // reset all
      $('#resetAllBtn').addEventListener('click', () => {
        if (!confirm('Zeiten, Presets und Signal-Optionen auf Auslieferungszustand zurücksetzen?')) return;
        config = Object.assign({}, DEFAULT_CONFIG);
        settings = Object.assign({}, DEFAULT_SETTINGS);
        presets = DEFAULT_PRESETS.slice();
        save(LS.config, config); save(LS.settings, settings); save(LS.presets, presets);
        this.renderSetup(); this.renderSettings();
        toast('Zurückgesetzt');
      });

      // keyboard shortcuts (desktop)
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (this.currentView === 'training' || this.currentView === 'bigbreak') {
          if (e.code === 'Space') { e.preventDefault(); engine.toggle(); }
          else if (e.code === 'ArrowRight') engine.skip();
          else if (e.code === 'KeyR') engine.resetTimer();
        }
      });
    },

    step(key, dir) {
      if (key === 'work') config.workSec = clamp(config.workSec + dir * 5, 5, 3600);
      else if (key === 'rest') config.restSec = clamp(config.restSec + dir * 5, 0, 3600);
      else if (key === 'bigbreak') config.bigBreakSec = clamp(config.bigBreakSec + dir * 15, 0, 3600);
      else if (key === 'rounds') config.roundsPerSet = clamp(config.roundsPerSet + dir, 1, 99);
      else if (key === 'sets') config.sets = clamp(config.sets + dir, 1, 20);
      save(LS.config, config);
      this.renderSetup(); this.renderSettings();
    },

    savePreset(name) {
      if (!name) name = `Preset ${presets.length + 1}`;
      const preset = {
        id: 'p_' + Date.now().toString(36),
        name,
        workSec: config.workSec, restSec: config.restSec,
        roundsPerSet: config.roundsPerSet, sets: config.sets,
        bigBreakSec: config.bigBreakSec, bigBreakOn: config.bigBreakOn,
      };
      presets.push(preset);
      save(LS.presets, presets);
      this.renderPresets();
      toast(`„${name}" gespeichert`);
    },
  };

  // ---------- Time picker (drop-up wheel) ----------
  let pickerTarget = null;
  function openPicker(which) {
    pickerTarget = which;
    const total = which === 'work' ? config.workSec : which === 'rest' ? config.restSec : config.bigBreakSec;
    $('#pickerTitle').textContent = which === 'work' ? 'Arbeit' : which === 'rest' ? 'Pause' : 'Große Pause';
    buildWheel($('#wheelMin'), 60, Math.floor(total / 60), 'Min');
    buildWheel($('#wheelSec'), 60, total % 60, 'Sek');
    const bd = $('#pickerBackdrop');
    bd.hidden = false;
    requestAnimationFrame(() => bd.classList.add('open'));
  }
  function closePicker() {
    const bd = $('#pickerBackdrop');
    bd.classList.remove('open');
    setTimeout(() => { bd.hidden = true; }, 300);
  }
  function buildWheel(el, count, selected, unit) {
    el.innerHTML = '';
    // two padding items top & bottom so first/last center under highlight
    for (let k = 0; k < 2; k++) { const pad = document.createElement('div'); pad.className = 'wheel-item pad'; el.appendChild(pad); }
    for (let i = 0; i < count; i++) {
      const it = document.createElement('div');
      it.className = 'wheel-item';
      it.dataset.val = i;
      it.innerHTML = `${String(i).padStart(2, '0')}<span class="wheel-unit">${unit}</span>`;
      el.appendChild(it);
    }
    for (let k = 0; k < 2; k++) { const pad = document.createElement('div'); pad.className = 'wheel-item pad'; el.appendChild(pad); }
    const highlight = () => {
      const center = el.scrollTop + 100; // 200px tall / 2
      let best = 0, bestDist = Infinity;
      $$('.wheel-item', el).forEach(it => {
        if (it.classList.contains('pad')) { it.classList.remove('on'); return; }
        const mid = it.offsetTop + 20;
        const d = Math.abs(mid - center);
        if (d < bestDist) { bestDist = d; best = it; }
        it.classList.remove('on');
      });
      if (best) best.classList.add('on');
      el._val = best ? parseInt(best.dataset.val, 10) : 0;
    };
    el.onscroll = () => { clearTimeout(el._t); el._t = setTimeout(highlight, 40); highlightNow(); };
    function highlightNow() {
      const center = el.scrollTop + 100;
      $$('.wheel-item', el).forEach(it => {
        if (it.classList.contains('pad')) return;
        const mid = it.offsetTop + 20;
        it.classList.toggle('on', Math.abs(mid - center) < 20);
        if (Math.abs(mid - center) < 20) el._val = parseInt(it.dataset.val, 10);
      });
    }
    // position to selected (item index offset by 2 pads → offsetTop = (2+sel)*40)
    requestAnimationFrame(() => {
      el.scrollTop = selected * 40;
      highlight();
    });
    el._val = selected;
  }
  function commitPicker() {
    const mins = $('#wheelMin')._val || 0;
    const secs = $('#wheelSec')._val || 0;
    let total = mins * 60 + secs;
    if (pickerTarget === 'work') config.workSec = clamp(total || 5, 5, 3600);
    else if (pickerTarget === 'rest') config.restSec = clamp(total, 0, 3600);
    else config.bigBreakSec = clamp(total, 0, 3600);
    save(LS.config, config);
    ui.renderSetup(); ui.renderSettings();
    closePicker();
  }

  // ---------- small utils ----------
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 250); }, 1900);
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function normalizeCfg(p) {
    return {
      workSec: p.workSec, restSec: p.restSec, roundsPerSet: p.roundsPerSet,
      sets: p.sets || 1, bigBreakSec: p.bigBreakSec ?? 300, bigBreakOn: p.bigBreakOn ?? ((p.sets || 1) > 1),
    };
  }
  function sameConfig(p, c) {
    const n = normalizeCfg(p);
    return n.workSec === c.workSec && n.restSec === c.restSec && n.roundsPerSet === c.roundsPerSet && n.sets === c.sets;
  }
  function isDefaultPreset(id) { return DEFAULT_PRESETS.some(p => p.id === id); }
  function currentProgramName() {
    const m = presets.find(p => sameConfig(p, config));
    return m ? m.name : 'Eigenes Workout';
  }
  function timeRange(s) {
    const start = new Date(s.when - s.actual * 1000);
    const end = new Date(s.when);
    const hm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${hm(start)}–${hm(end)}`;
  }

  // picker buttons
  document.addEventListener('DOMContentLoaded', () => {
    ui.init();
    $('#pickerCancel').addEventListener('click', closePicker);
    $('#pickerOk').addEventListener('click', commitPicker);
    $('#pickerBackdrop').addEventListener('click', (e) => { if (e.target.id === 'pickerBackdrop') closePicker(); });
  });
})();
