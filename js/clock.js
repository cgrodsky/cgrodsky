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
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // =====================================================================
  //  FOCUS SESSIONS engine (Windows 11 Clock "Focus" tab). Runs independently of the
  //  Clock window, so a session keeps going when the window is minimized or closed —
  //  a floating chip shows the time left. Stats persist in State.data.appData.focus.
  // =====================================================================
  const Focus = (function () {
    const save = () => { try { State.save(); } catch (_) {} };
    function store() {
      const d = State.data; if (!d.appData) d.appData = {};
      const f = d.appData.focus || (d.appData.focus = {});
      const def = { lengthMin: 30, breaks: true, period: 25, breakMin: 5, goalMin: 60, dnd: true, chime: true, todos: [], days: {}, sessions: 0 };
      Object.keys(def).forEach((k) => { if (f[k] == null) f[k] = Array.isArray(def[k]) ? [] : (typeof def[k] === "object" ? {} : def[k]); });
      return f;
    }
    function qs() {
      const a = State.data.appData || (State.data.appData = {});
      return a.quickSettings || (a.quickSettings = { wifi: true, bt: false, plane: false, night: false, focus: false, brightness: 90, volume: 55, signal: "good" });
    }
    const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()); };
    function plan(lengthMin, breaks, period, breakMin) {
      const segs = []; let left = lengthMin;
      if (!breaks || lengthMin < 30) return [{ type: "focus", ms: lengthMin * 60000 }];
      while (left > 0) {
        let seg = Math.min(period, left);
        if (left - seg > 0 && left - seg < 10) seg = left;          // don't leave a tiny stub at the end
        segs.push({ type: "focus", ms: seg * 60000 }); left -= seg;
        if (left > 0) segs.push({ type: "break", ms: breakMin * 60000 });
      }
      return segs;
    }
    let audio = null;
    function chime(kind) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        audio = audio || new AC(); if (audio.state === "suspended") audio.resume();
        const notes = kind === "end" ? [784, 988, 1175, 1568] : kind === "break" ? [988, 784] : kind === "test" ? [880] : [784, 988];
        notes.forEach((f, i) => {
          const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.2;
          o.type = "sine"; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
          o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.75);
        });
      } catch (_) {}
    }
    function notify(title, body) { try { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("clock", "Clock") : "", title, body }); } catch (_) {} }
    function setDnd(on) { const q = qs(); q.focus = !!on; save(); try { window.dispatchEvent(new CustomEvent("quicksettings-change", { detail: { focus: !!on } })); } catch (_) {} }

    let ticker = null, lastSave = 0;
    function active() { return store().active || null; }
    function credit(ms) {
      if (ms <= 0) return; ms = Math.min(ms, 2000);                 // never credit time the page was closed
      const f = store(), k = dayKey(); f.days[k] = (f.days[k] || 0) + ms / 1000;
    }
    function start() {
      const f = store();
      const segs = plan(f.lengthMin, f.breaks, f.period, f.breakMin), now = Date.now();
      f.active = { segs, idx: 0, segEnd: now + segs[0].ms, remain: segs[0].ms, paused: false, startedAt: now, lastTick: now, prevDnd: !!qs().focus, dnd: !!f.dnd };
      if (f.dnd) setDnd(true);
      chime("test");    // unlocks Web Audio on iPad (needs a tap) and confirms the start
      save(); run();
    }
    function pause() { const a = active(); if (!a || a.paused) return; tick(); a.remain = Math.max(0, a.segEnd - Date.now()); a.paused = true; save(); }
    function resume() { const a = active(); if (!a || !a.paused) return; a.segEnd = Date.now() + a.remain; a.lastTick = Date.now(); a.paused = false; save(); run(); }
    function finish(completed) {
      const f = store(), a = f.active; if (!a) return;
      if (a.dnd) setDnd(a.prevDnd);
      f.active = null;
      if (completed) {
        f.sessions = (f.sessions || 0) + 1;
        const secs = Math.round((a.focusedMs || 0) / 1000), mins = Math.floor(secs / 60);
        if (f.chime) chime("end");
        notify("Focus session complete", "Nice work — you focused for " + (mins ? mins + " min" : secs + " s") + "." + (streak() > 0 ? " Streak: " + streak() + " day" + (streak() === 1 ? "" : "s") + "." : ""));
      }
      save(); stopTicker(); emit();
    }
    function tick() {
      const a = active(); if (!a) { stopTicker(); return; }
      const now = Date.now();
      if (a.paused) { a.lastTick = now; return; }
      let seg = a.segs[a.idx];
      if (seg && seg.type === "focus") { const dms = Math.min(Math.min(now, a.segEnd) - a.lastTick, 2000); if (dms > 0) { credit(dms); a.focusedMs = (a.focusedMs || 0) + dms; } }
      a.lastTick = now;
      while (a.segEnd <= now) {
        a.idx++;
        if (a.idx >= a.segs.length) { finish(true); return; }
        seg = a.segs[a.idx]; a.segEnd += seg.ms; a.lastTick = Math.min(now, a.segEnd);
        if (store().chime) chime(seg.type === "break" ? "break" : "focus");
        if (seg.type === "break") notify("Time for a break", Math.round(seg.ms / 60000) + " minute break. Stretch, drink some water.");
        else notify("Break's over", "Back to focusing.");
      }
      if (now - lastSave > 5000) { lastSave = now; save(); }
    }
    function run() { stopTicker(); ticker = setInterval(() => { tick(); emit(); }, 250); }
    function stopTicker() { if (ticker) clearInterval(ticker); ticker = null; }
    const listeners = new Set();
    function emit() { listeners.forEach((fn) => { try { fn(); } catch (_) {} }); updateChip(); }
    function info() {
      const a = active(); if (!a) return null;
      const now = Date.now(), seg = a.segs[a.idx];
      const segLeft = a.paused ? a.remain : Math.max(0, a.segEnd - now);
      const later = a.segs.slice(a.idx + 1).reduce((n, s) => n + s.ms, 0);
      const focusSegs = a.segs.filter((s) => s.type === "focus").length;
      const focusNo = a.segs.slice(0, a.idx + 1).filter((s) => s.type === "focus").length;
      return { seg, segLeft, segFrac: seg.ms ? segLeft / seg.ms : 0, totalLeft: segLeft + later, paused: a.paused, next: a.segs[a.idx + 1] || null, focusNo, focusSegs, endsAt: (a.paused ? now + segLeft : a.segEnd) + later };
    }
    function todaySec(k) { return store().days[k || dayKey()] || 0; }
    function streak() {
      const f = store(), goal = f.goalMin * 60; let n = 0; const d = new Date();
      if ((f.days[dayKey(d)] || 0) < goal) d.setDate(d.getDate() - 1);     // today still in progress
      while ((f.days[dayKey(d)] || 0) >= goal) { n++; d.setDate(d.getDate() - 1); }
      return n;
    }

    // ---- floating chip while the Clock window is minimized / closed ----
    let chip = null, openHook = null;
    function viewVisible() {
      const v = document.querySelector(".pt-focus-view"); if (!v || !v.isConnected) return false;
      const w = v.closest(".win"); return !w || w.style.display !== "none";
    }
    function updateChip() {
      const i = info();
      const want = !!i && !viewVisible() && !!document.querySelector(".taskbar");
      if (!want) { if (chip) { chip.remove(); chip = null; } return; }
      if (!chip) {
        chip = document.createElement("div"); chip.className = "pt-focus-chip"; chip.setAttribute("role", "button"); chip.title = "Open Focus session";
        chip.innerHTML = `<svg viewBox="0 0 36 36" width="30" height="30"><circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="4"/><circle class="pt-fc-p" cx="18" cy="18" r="15" fill="none" stroke="var(--accent,#0067c0)" stroke-width="4" stroke-linecap="round" stroke-dasharray="94.25" transform="rotate(-90 18 18)"/></svg><div class="pt-fc-tx"><b class="pt-fc-time"></b><span class="pt-fc-lbl"></span></div><button class="pt-fc-pp" title="Pause"></button>`;
        chip.addEventListener("click", (e) => {
          if (e.target.closest(".pt-fc-pp")) { const a = active(); if (a && a.paused) resume(); else pause(); emit(); return; }
          if (openHook) openHook(); else if (window.WM) { Focus.wantTab = "focus"; WM.open("clock"); }
          emit();
        });
        document.body.appendChild(chip);
      }
      chip.querySelector(".pt-fc-time").textContent = fmtShort(i.segLeft);
      chip.querySelector(".pt-fc-lbl").textContent = i.paused ? "Paused" : i.seg.type === "break" ? "Break" : "Focus";
      chip.querySelector(".pt-fc-p").style.strokeDashoffset = String(94.25 * (1 - i.segFrac));
      chip.classList.toggle("brk", i.seg.type === "break");
      chip.querySelector(".pt-fc-pp").innerHTML = i.paused ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>` : `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
      chip.querySelector(".pt-fc-pp").title = i.paused ? "Resume" : "Pause";
    }
    // Resume a session that was running before a reload.
    setTimeout(() => { try { if (active()) { if (!active().paused) active().lastTick = Date.now(); run(); } } catch (_) {} }, 1500);
    return { store, plan, start, pause, resume, end: () => finish(false), finish, info, todaySec, streak, dayKey, chime, on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, emit, setOpenHook: (fn) => { openHook = fn; }, wantTab: null, _tick: tick };
  })();
  function fmtShort(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? h + ":" + two(m) + ":" + two(s) : two(m) + ":" + two(s);
  }
  window.FocusSessions = Focus;

  function openClock() {
    let tab = Focus.wantTab || (Focus.info() ? "focus" : "timer");
    Focus.wantTab = null;
    let timers = []; // cleanup handles
    function stopAll() { timers.forEach((t) => clearInterval(t)); timers = []; }

    const ref = cw({ title: "Clock", icon: window.Icon ? Icon.mini("clock", "Clock") : "", width: 560, height: 620, appId: "clock", onClose: () => { stopAll(); setTimeout(Focus.emit, 0); } });
    const body = ref.body;
    body.classList.add("clk-host");
    Focus.setOpenHook(() => { if (!ref.win.isConnected) { Focus.setOpenHook(null); Focus.wantTab = "focus"; WM.open("clock"); return; } ref.focus(); if (tab !== "focus") { tab = "focus"; render(); } });

    function render() {
      stopAll();
      body.innerHTML = `<div class="clk">
        <div class="clk-tabs">
          <button class="clk-tab ${tab === "focus" ? "on" : ""}" data-t="focus">Focus</button>
          <button class="clk-tab ${tab === "timer" ? "on" : ""}" data-t="timer">Timer</button>
          <button class="clk-tab ${tab === "world" ? "on" : ""}" data-t="world">World clock</button>
          <button class="clk-tab ${tab === "stopwatch" ? "on" : ""}" data-t="stopwatch">Stopwatch</button>
        </div>
        <div class="clk-stage"></div>
      </div>`;
      body.querySelectorAll(".clk-tab").forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); });
      const stage = body.querySelector(".clk-stage");
      if (tab === "focus") renderFocus(stage); else if (tab === "timer") renderTimer(stage); else if (tab === "world") renderWorldClock(stage); else renderStopwatch(stage);
      setTimeout(Focus.emit, 0);
    }

    // ---------------- Focus sessions ----------------
    function renderFocus(stage) {
      const f = Focus.store();
      const R = 112, C = 2 * Math.PI * R;
      const minsTxt = (m) => m >= 60 ? (Math.floor(m / 60) + " hr" + (m % 60 ? " " + (m % 60) + " min" : "")) : m + " min";
      const breaksFor = () => Focus.plan(f.lengthMin, f.breaks, f.period, f.breakMin).filter((s) => s.type === "break").length;
      const step = (m, dir) => { const st = (dir > 0 ? m >= 60 : m > 60) ? 15 : 5; return Math.max(15, Math.min(240, m + dir * st)); };
      const opt = (vals, cur, lab) => vals.map((v) => `<option value="${v}" ${v === cur ? "selected" : ""}>${lab(v)}</option>`).join("");
      stage.innerHTML = `<div class="pt-focus-view">
        <div class="pt-fs-card pt-fs-main"></div>
        <div class="pt-fs-row">
          <div class="pt-fs-card pt-fs-stats">
            <div class="pt-fs-h">Daily progress</div>
            <div class="pt-fs-statgrid">
              <div><span>Yesterday</span><b class="pt-fs-yday"></b></div>
              <div class="pt-fs-goalring"><svg viewBox="0 0 80 80" width="78" height="78"><circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" stroke-opacity=".14" stroke-width="7"/><circle class="pt-fs-goalp" cx="40" cy="40" r="32" fill="none" stroke="var(--accent,#0067c0)" stroke-width="7" stroke-linecap="round" stroke-dasharray="201.06" transform="rotate(-90 40 40)"/></svg><div><span>Daily goal</span><b class="pt-fs-goaltx"></b></div></div>
              <div><span>Streak</span><b class="pt-fs-streak"></b></div>
            </div>
            <div class="pt-fs-today">Focused today: <b class="pt-fs-todaytx"></b> · Sessions completed: <b>${f.sessions || 0}</b></div>
            <label class="pt-fs-goal">Daily goal <select class="pt-fs-goalsel">${opt([15, 30, 45, 60, 90, 120, 180, 240, 360, 480], f.goalMin, minsTxt)}</select></label>
          </div>
          <div class="pt-fs-card pt-fs-tasks">
            <div class="pt-fs-h">Tasks <span class="pt-fs-taskcount"></span></div>
            <form class="pt-fs-addtask"><input class="pt-fs-taskin" placeholder="Add a task for this session" maxlength="120"><button class="pt-fs-addbtn" title="Add task">+</button></form>
            <div class="pt-fs-tasklist"></div>
          </div>
        </div>
      </div>`;
      const main = stage.querySelector(".pt-fs-main");
      let lastMode = null;
      function paintMain() {
        const i = Focus.info();
        const mode = i ? (i.paused ? "paused" : "run") : "setup";
        if (mode !== lastMode) {
          if (lastMode !== null || mode !== "setup") stage.scrollTop = 0;
          lastMode = mode;
          if (!i) {
            main.innerHTML = `<div class="pt-fs-setup">
              <div class="pt-fs-h1">Get ready to focus</div>
              <p class="pt-fs-sub">We'll turn off notifications and app alerts during each session. For longer sessions, we'll add a short break so you can recharge.</p>
              <div class="pt-fs-len"><button class="pt-fs-step" data-d="-1" title="Less time">−</button><div class="pt-fs-lenv"><b>${f.lengthMin}</b><span>mins</span></div><button class="pt-fs-step" data-d="1" title="More time">+</button></div>
              <div class="pt-fs-breaksinfo">${f.breaks && f.lengthMin >= 30 ? (breaksFor() ? "You'll have " + breaksFor() + " break" + (breaksFor() > 1 ? "s" : "") + " (" + f.breakMin + " min every " + f.period + " min)" : "You'll have no breaks") : f.lengthMin < 30 ? "You'll have no breaks — sessions under 30 min run straight through" : "Breaks are off"}</div>
              <div class="pt-fs-opts">
                <label><input type="checkbox" class="pt-fs-brk" ${f.breaks ? "checked" : ""}> Auto breaks</label>
                <label>Break <select class="pt-fs-brklen">${opt([5, 10, 15], f.breakMin, (v) => v + " min")}</select> every <select class="pt-fs-period">${opt([25, 30, 45, 60], f.period, (v) => v + " min")}</select></label>
                <label><input type="checkbox" class="pt-fs-dnd" ${f.dnd ? "checked" : ""}> Turn on do not disturb during focus</label>
                <label><input type="checkbox" class="pt-fs-chime" ${f.chime ? "checked" : ""}> Play an end-of-session sound</label>
              </div>
              <button class="pt-fs-start">${playIcon()}<span>Start focus session</span></button>
            </div>`;
            main.querySelectorAll(".pt-fs-step").forEach((b) => b.onclick = () => { f.lengthMin = step(f.lengthMin, +b.dataset.d); State.save(); lastMode = null; paintMain(); });
            main.querySelector(".pt-fs-brk").onchange = (e) => { f.breaks = e.target.checked; State.save(); lastMode = null; paintMain(); };
            main.querySelector(".pt-fs-brklen").onchange = (e) => { f.breakMin = +e.target.value; State.save(); lastMode = null; paintMain(); };
            main.querySelector(".pt-fs-period").onchange = (e) => { f.period = +e.target.value; State.save(); lastMode = null; paintMain(); };
            main.querySelector(".pt-fs-dnd").onchange = (e) => { f.dnd = e.target.checked; State.save(); };
            main.querySelector(".pt-fs-chime").onchange = (e) => { f.chime = e.target.checked; State.save(); };
            main.querySelector(".pt-fs-start").onclick = () => { Focus.start(); lastMode = null; paintMain(); };
          } else {
            main.innerHTML = `<div class="pt-fs-run">
              <div class="pt-fs-dial">
                <svg viewBox="0 0 260 260" width="216" height="216"><circle cx="130" cy="130" r="${R}" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="14"/><circle class="pt-fs-ringp" cx="130" cy="130" r="${R}" fill="none" stroke="var(--accent,#0067c0)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" transform="rotate(-90 130 130)"/></svg>
                <div class="pt-fs-dialtx"><b class="pt-fs-left"></b><span class="pt-fs-phase"></span></div>
              </div>
              <div class="pt-fs-next"></div>
              <div class="pt-fs-ctl"><button class="pt-fs-pp">${i.paused ? playIcon() : pauseIcon()}<span>${i.paused ? "Resume" : "Pause"}</span></button><button class="pt-fs-end"><span>End session</span></button></div>
              <div class="pt-fs-dndnote">${Focus.store().active && Focus.store().active.dnd ? "Do not disturb is on — notifications are silenced until the session ends." : "Do not disturb is off for this session."}</div>
            </div>`;
            main.querySelector(".pt-fs-pp").onclick = () => { const x = Focus.info(); if (x && x.paused) Focus.resume(); else Focus.pause(); lastMode = null; paintMain(); };
            main.querySelector(".pt-fs-end").onclick = () => { Focus.end(); lastMode = null; paintMain(); paintStats(); };
          }
        }
        if (i) {
          main.querySelector(".pt-fs-left").textContent = fmtShort(i.segLeft);
          main.querySelector(".pt-fs-phase").textContent = i.paused ? "Paused" : i.seg.type === "break" ? "Break time" : (i.focusSegs > 1 ? "Focus period " + i.focusNo + " of " + i.focusSegs : "Focus");
          main.querySelector(".pt-fs-ringp").style.strokeDashoffset = String(C * (1 - i.segFrac));
          main.querySelector(".pt-fs-ringp").style.stroke = i.seg.type === "break" ? "#2fa84f" : "";
          const end = new Date(i.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          main.querySelector(".pt-fs-next").textContent = (i.next ? "Up next: " + (i.next.type === "break" ? Math.round(i.next.ms / 60000) + " min break" : "focus " + Math.round(i.next.ms / 60000) + " min") + " · " : "") + "Session ends at " + end;
        }
      }
      function paintStats() {
        const g = f.goalMin * 60, t = Focus.todaySec();
        const y = new Date(); y.setDate(y.getDate() - 1);
        stage.querySelector(".pt-fs-yday").textContent = minsTxt(Math.floor(Focus.todaySec(Focus.dayKey(y)) / 60));
        stage.querySelector(".pt-fs-goaltx").textContent = Math.floor(t / 60) + " / " + minsTxt(f.goalMin);
        stage.querySelector(".pt-fs-goalp").style.strokeDashoffset = String(201.06 * (1 - Math.min(1, t / g)));
        const s = Focus.streak(); stage.querySelector(".pt-fs-streak").textContent = s + " day" + (s === 1 ? "" : "s");
        stage.querySelector(".pt-fs-todaytx").textContent = Math.floor(t / 60) + " min " + two(Math.floor(t % 60)) + " s";
      }
      stage.querySelector(".pt-fs-goalsel").onchange = (e) => { f.goalMin = +e.target.value; State.save(); paintStats(); };
      // ---- tasks ----
      const list = stage.querySelector(".pt-fs-tasklist");
      function paintTasks() {
        const open = f.todos.filter((t) => !t.done).length;
        stage.querySelector(".pt-fs-taskcount").textContent = f.todos.length ? open + " left" : "";
        list.innerHTML = f.todos.length ? "" : `<div class="pt-fs-empty">Add what you want to get done this session.</div>`;
        f.todos.forEach((t) => {
          const row = el(`<div class="pt-fs-task${t.done ? " done" : ""}"><label><input type="checkbox" ${t.done ? "checked" : ""}><span></span></label><button class="pt-fs-tdel" title="Delete task">×</button></div>`);
          row.querySelector("span").textContent = t.text;
          row.querySelector("input").onchange = (e) => { t.done = e.target.checked; State.save(); paintTasks(); };
          row.querySelector(".pt-fs-tdel").onclick = () => { f.todos = f.todos.filter((x) => x !== t); State.save(); paintTasks(); };
          list.appendChild(row);
        });
      }
      stage.querySelector(".pt-fs-addtask").onsubmit = (e) => {
        e.preventDefault(); const inp = stage.querySelector(".pt-fs-taskin"); const v = inp.value.trim(); if (!v) return;
        f.todos.push({ id: Date.now().toString(36), text: v, done: false }); inp.value = ""; State.save(); paintTasks();
      };
      paintMain(); paintStats(); paintTasks();
      const iv = setInterval(() => { if (!stage.isConnected) return; paintMain(); paintStats(); }, 250); timers.push(iv);
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
