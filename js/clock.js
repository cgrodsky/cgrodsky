/* Windows Clock — Timer (circular ring) + Stopwatch, matching the concept. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const cw = (opts) => window.WM.createWindow(opts);
  const two = (n) => String(n).padStart(2, "0");
  function fmt(ms) {
    const t = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return two(h) + ":" + two(m) + ":" + two(s);
  }
  const RING = 2 * Math.PI * 130; // r = 130

  function openClock() {
    let tab = "timer";
    let timers = []; // cleanup handles
    function stopAll() { timers.forEach((t) => clearInterval(t)); timers = []; }

    const ref = cw({ title: "Clock", icon: window.Icon ? Icon.mini("clock", "Clock") : "", width: 560, height: 620, appId: "clock", onClose: stopAll });
    const body = ref.body;
    body.classList.add("clk-host");

    function render() {
      stopAll();
      body.innerHTML = `<div class="clk">
        <div class="clk-tabs">
          <button class="clk-tab ${tab === "timer" ? "on" : ""}" data-t="timer">Timer</button>
          <button class="clk-tab ${tab === "world" ? "on" : ""}" data-t="world">World clock</button>
          <button class="clk-tab ${tab === "stopwatch" ? "on" : ""}" data-t="stopwatch">Stopwatch</button>
        </div>
        <div class="clk-stage"></div>
      </div>`;
      body.querySelectorAll(".clk-tab").forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); });
      const stage = body.querySelector(".clk-stage");
      if (tab === "timer") renderTimer(stage); else if (tab === "world") renderWorldClock(stage); else renderStopwatch(stage);
    }

    function ringSvg(color) {
      return `<svg class="clk-ring" viewBox="0 0 300 300" width="280" height="280">
        <circle cx="150" cy="150" r="130" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="10"/>
        <circle class="clk-ring-p" cx="150" cy="150" r="130" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
          stroke-dasharray="${RING}" stroke-dashoffset="0" transform="rotate(-90 150 150)"/>
      </svg>`;
    }

    // ---------------- Timer ----------------
    function renderTimer(stage) {
      let total = 5 * 60 * 1000; // default 5:00
      let remaining = total;
      let running = false, endAt = 0, tick = null;
      stage.innerHTML = `<div class="clk-timer">
        <div class="clk-dial">
          ${ringSvg("var(--accent, #e0483d)")}
          <div class="clk-time" tabindex="0" title="Click to set time">00:05:00</div>
        </div>
        <div class="clk-presets">
          <button data-min="1">1 min</button><button data-min="3">3 min</button>
          <button data-min="5">5 min</button><button data-min="10">10 min</button><button data-min="25">25 min</button>
        </div>
        <div class="clk-controls">
          <button class="clk-play" title="Start">${playIcon()}</button>
          <button class="clk-reset" title="Reset">${resetIcon()}</button>
        </div>
      </div>`;
      const timeEl = stage.querySelector(".clk-time");
      const ring = stage.querySelector(".clk-ring-p");
      const playBtn = stage.querySelector(".clk-play");

      function paint() {
        timeEl.textContent = fmt(remaining);
        const frac = total > 0 ? remaining / total : 0;
        ring.style.strokeDashoffset = String(RING * (1 - frac));
      }
      function setRunning(on) {
        running = on;
        playBtn.innerHTML = on ? pauseIcon() : playIcon();
        playBtn.title = on ? "Pause" : "Start";
        stage.querySelector(".clk-timer").classList.toggle("running", on);
      }
      function loop() {
        remaining = Math.max(0, endAt - Date.now());
        paint();
        if (remaining <= 0) { stopTick(); setRunning(false); done(); }
      }
      function startTick() { endAt = Date.now() + remaining; tick = setInterval(loop, 100); timers.push(tick); }
      function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
      function done() {
        if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("clock", "Clock") : "", title: "Timer", body: "Time's up!" });
        try { const a = new Audio("assets/raw/SFX_023.mp3"); a.volume = 0.6; a.play().catch(() => {}); } catch (_) {}
        stage.querySelector(".clk-dial").animate([{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }], { duration: 400, iterations: 3 });
      }

      playBtn.onclick = () => {
        if (running) { stopTick(); setRunning(false); }
        else { if (remaining <= 0) remaining = total; setRunning(true); startTick(); }
      };
      stage.querySelector(".clk-reset").onclick = () => { stopTick(); setRunning(false); remaining = total; paint(); };
      stage.querySelectorAll(".clk-presets button").forEach((b) => b.onclick = () => { stopTick(); setRunning(false); total = (+b.dataset.min) * 60 * 1000; remaining = total; paint(); });

      // Click the time to set a custom duration.
      timeEl.onclick = () => {
        if (running) return;
        const cur = fmt(remaining);
        const v = window.prompt("Set timer (HH:MM:SS or minutes)", cur);
        if (v == null) return;
        let ms = 0;
        if (/^\d+$/.test(v.trim())) ms = parseInt(v, 10) * 60000;
        else { const p = v.split(":").map((x) => parseInt(x, 10) || 0); while (p.length < 3) p.unshift(0); ms = (p[0] * 3600 + p[1] * 60 + p[2]) * 1000; }
        if (ms > 0) { total = ms; remaining = ms; paint(); }
      };
      paint();
    }

    // ---------------- Stopwatch ----------------
    function renderStopwatch(stage) {
      let elapsed = 0, running = false, startAt = 0, tick = null, laps = [];
      stage.innerHTML = `<div class="clk-timer">
        <div class="clk-dial">
          ${ringSvg("var(--accent, #4c8dff)")}
          <div class="clk-time clk-sw">00:00:00</div>
        </div>
        <div class="clk-controls">
          <button class="clk-play" title="Start">${playIcon()}</button>
          <button class="clk-lap" title="Lap">${lapIcon()}</button>
          <button class="clk-reset" title="Reset">${resetIcon()}</button>
        </div>
        <div class="clk-laps"></div>
      </div>`;
      const timeEl = stage.querySelector(".clk-time");
      const ring = stage.querySelector(".clk-ring-p");
      const playBtn = stage.querySelector(".clk-play");
      const lapsEl = stage.querySelector(".clk-laps");
      function paint() { timeEl.textContent = fmt(elapsed); ring.style.strokeDashoffset = String(RING * (1 - (elapsed % 60000) / 60000)); }
      function loop() { elapsed = Date.now() - startAt; paint(); }
      playBtn.onclick = () => {
        if (running) { clearInterval(tick); running = false; playBtn.innerHTML = playIcon(); }
        else { startAt = Date.now() - elapsed; tick = setInterval(loop, 50); timers.push(tick); running = true; playBtn.innerHTML = pauseIcon(); }
      };
      stage.querySelector(".clk-lap").onclick = () => { if (!running && !elapsed) return; laps.unshift(elapsed); renderLaps(); };
      stage.querySelector(".clk-reset").onclick = () => { clearInterval(tick); running = false; elapsed = 0; laps = []; playBtn.innerHTML = playIcon(); paint(); renderLaps(); };
      function renderLaps() { lapsEl.innerHTML = laps.map((l, i) => `<div class="clk-lap-row"><span>Lap ${laps.length - i}</span><span>${fmt(l)}</span></div>`).join(""); }
      paint();
    }

    // ---------------- World clock ----------------
    function renderWorldClock(stage) {
      const CITIES = [
        { city: "Honolulu", tz: "Pacific/Honolulu" }, { city: "Los Angeles", tz: "America/Los_Angeles" },
        { city: "Denver", tz: "America/Denver" }, { city: "New York", tz: "America/New_York" },
        { city: "London", tz: "Europe/London" }, { city: "Paris", tz: "Europe/Paris" },
        { city: "Dubai", tz: "Asia/Dubai" }, { city: "Mumbai", tz: "Asia/Kolkata" },
        { city: "Tokyo", tz: "Asia/Tokyo" }, { city: "Sydney", tz: "Australia/Sydney" },
      ];
      const h24 = !!(window.State && State.data.clock && State.data.clock.format24);
      function offsetHours(tz) {
        const now = new Date();
        const local = new Date(now.toLocaleString("en-US"));
        const other = new Date(now.toLocaleString("en-US", { timeZone: tz }));
        return Math.round((other - local) / 3600000);
      }
      stage.innerHTML = `<div class="clk-world"><div class="clk-world-list"></div></div>`;
      const list = stage.querySelector(".clk-world-list");
      function paint() {
        list.innerHTML = CITIES.map((c) => {
          const d = new Date();
          const time = d.toLocaleTimeString("en-US", { timeZone: c.tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: !h24 });
          const day = d.toLocaleDateString("en-US", { timeZone: c.tz, weekday: "short", month: "short", day: "numeric" });
          const off = offsetHours(c.tz);
          const offStr = off === 0 ? "Local time" : (off > 0 ? "+" + off : String(off)) + " hr";
          return `<div class="clk-wc-row"><div class="clk-wc-city"><b>${c.city}</b><span>${day} · ${offStr}</span></div><div class="clk-wc-time">${time}</div></div>`;
        }).join("");
      }
      paint(); const iv = setInterval(paint, 1000); timers.push(iv);
    }

    function playIcon() { return `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`; }
    function pauseIcon() { return `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`; }
    function resetIcon() { return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v6h6"/><path d="M20 12a8 8 0 1 0-2.3 5.6"/></svg>`; }
    function lapIcon() { return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/></svg>`; }

    ref.onClose = stopAll;
    render();
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.clock = openClock;
})();
