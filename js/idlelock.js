/* Idle lock — screen savers, screen timeout / sleep, "require sign-in after away", Dynamic Lock.
   Windows 11 behaviour, done for real in the browser:
     - Idle detection: real pointer / touch / key / wheel input on this page and every same-origin
       iframe, plus visibilitychange (iPad: switching apps or turning the iPad's screen off).
     - Screen savers (Canvas 2D + requestAnimationFrame): 3D Text, Blank, Bubbles, Mystify, Photos
       (your Pictures folder, blobs from IndexedDB via window.VFS), Ribbons. Any input dismisses.
       Classic "Screen Saver Settings" dialog: preview monitor, Settings… per saver, Preview, Wait N
       minutes, "On resume, display logon screen" (with Windows' 5-second grace period).
     - Screen and sleep: dim, then a black "display off" overlay, then "sleep" (media is paused);
       separate battery / plugged-in timeouts when navigator.getBattery() exists.
     - "If you've been away, when should Windows require you to sign in again?" — applied when you
       wake from sleep / the screen saver, and when you come back to the tab after being away.
     - Dynamic Lock: watches a real Bluetooth device (Web Bluetooth via window.Radios). When it
       disconnects / stops advertising and the PC has been idle 30 s, Windows locks.
     - Win+L and Ctrl+Alt+L lock. Start ▸ Power ▸ Sleep uses this sleep (it follows the sign-in rule).
   Uses Lock.run(), so per-account sign-in and Event Log 4800/4801 keep working. Never locks during
   boot, setup, WinRE, a BSOD or kiosk mode, and never when no PIN/password/key is set up.
   Settings: Personalization ▸ Lock screen ▸ Screen saver, System ▸ Power & battery ▸ Screen and
   sleep, Accounts ▸ Sign-in options ▸ Additional settings / Dynamic lock (rows are added to the
   Settings pages as they open — settings12.js is not edited).
   State: State.data.appData.idleLock. Exposes window.IdleLock. */
(function () {
  "use strict";
  if (window.IdleLock) return;

  // ====================================================================
  //  helpers + config
  // ====================================================================
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const save = () => { try { State.save(); } catch (_) {} };
  const now = () => Date.now();
  const MIN = 60000;
  const GRACE_MS = 5000;          // Windows ScreenSaverGracePeriod: input in the first 5 s never locks
  const DYN_IDLE_MS = 30000;      // Dynamic Lock: device gone + 30 s without input
  const HIDDEN_AWAY_MS = 60000;   // a hidden tab counts as "away" after a minute

  const SAVERS = [
    { id: "none", name: "(None)" },
    { id: "text3d", name: "3D Text" },
    { id: "blank", name: "Blank" },
    { id: "bubbles", name: "Bubbles" },
    { id: "mystify", name: "Mystify" },
    { id: "photos", name: "Photos" },
    { id: "ribbons", name: "Ribbons" },
    { id: "bounce", name: "Bounce" },
    { id: "matrix", name: "Matrix" },
  ];
  const SAVER_NAME = (id) => (SAVERS.find((s) => s.id === id) || SAVERS[0]).name;
  const DEF_OPTS = {
    text3d: { mode: "text", text: "Windows 12", motion: "spin", speed: 5, surface: "solid", color: "#3b91d8", size: "medium" },
    bubbles: { overDesktop: true, count: "some" },
    mystify: { shapes: 2, trail: 12 },
    ribbons: { count: 5, width: 14 },
    photos: { folder: "Pictures", speed: "medium", shuffle: true },
    bounce: { speed: 6, celebrate: true },
    matrix: { speed: 6, color: "#20e020" },
    blank: {},
  };
  const TIMEOUTS = [[1, "1 minute"], [2, "2 minutes"], [3, "3 minutes"], [5, "5 minutes"], [10, "10 minutes"], [15, "15 minutes"], [20, "20 minutes"], [25, "25 minutes"], [30, "30 minutes"], [45, "45 minutes"], [60, "1 hour"], [120, "2 hours"], [180, "3 hours"], [240, "4 hours"], [300, "5 hours"], [0, "Never"]];
  const SIGNIN = [["always", "Every time"], ["1", "1 minute"], ["3", "3 minutes"], ["5", "5 minutes"], ["15", "15 minutes"], ["30", "30 minutes"], ["never", "Never"]];

  function cfg() {
    const d = S(); if (!d.appData) d.appData = {};
    const c = d.appData.idleLock || (d.appData.idleLock = {});
    if (!c.saver) c.saver = { type: "none", wait: 10, resumeLock: true, opts: {} };
    if (!c.saver.opts) c.saver.opts = {};
    Object.keys(DEF_OPTS).forEach((k) => { c.saver.opts[k] = Object.assign({}, DEF_OPTS[k], c.saver.opts[k] || {}); });
    if (!(c.saver.wait >= 1)) c.saver.wait = 10;
    // Windows 11 "Balanced" defaults: screen 5 / 10 min, sleep 15 / 30 min (battery / plugged in).
    if (!c.power) c.power = { screenAC: 10, screenDC: 5, sleepAC: 30, sleepDC: 15 };
    if (c.signIn == null) c.signIn = "15"; // gentler than Windows' "Every time" default; changeable in Settings
    if (!c.dyn) c.dyn = { on: false, id: null, name: "" };
    return c;
  }
  function log(logName, level, source, id, msg, opts) { try { if (window.EventLog) EventLog.add(logName, level, source, id, msg, opts); } catch (_) {} }
  const userName = () => { try { return (S().profile && S().profile.username) || "User"; } catch (_) { return "User"; } };
  const reducedMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("a11y-reduce-motion"); } catch (_) { return false; } };

  // ---- battery (real where the browser reports it) ----
  let battery = null;   // BatteryManager or null
  const batteryKnown = () => !!battery;
  const onBattery = () => !!(battery && !battery.charging);
  try {
    if (navigator.getBattery) navigator.getBattery().then((b) => {
      battery = b; const ping = () => emitUi();
      b.addEventListener("chargingchange", ping); b.addEventListener("levelchange", ping); emitUi();
    }).catch(() => {});
  } catch (_) {}
  function screenMin() { const p = cfg().power; return onBattery() ? p.screenDC : p.screenAC; }
  function sleepMin() { const p = cfg().power; return onBattery() ? p.sleepDC : p.sleepAC; }

  const uiListeners = new Set();
  function emitUi() { uiListeners.forEach((fn) => { try { fn(); } catch (_) {} }); }
  function onUi(fn) { uiListeners.add(fn); return () => uiListeners.delete(fn); }

  // ====================================================================
  //  what's on screen
  // ====================================================================
  const BLOCK_SEL = ".boot-layer, .wsetup-screen, .bsod, .rc-winre, .rc-restarting, .rc-fastboot, .rc-signing, .rc-hi, .safety-notice, .power-off";
  const desktopUp = () => !!document.querySelector(".desktop");
  const blocked = () => !desktopUp() || !!document.querySelector(BLOCK_SEL);
  const lockShowing = () => !!document.querySelector(".lock-screen");
  const kiosk = () => !!(S().appData && S().appData.kiosk);
  function hasCredential() {
    try {
      const pr = S().profile || {};
      return !!pr.secret || !!(window.PasswordAuth && PasswordAuth.has && PasswordAuth.has()) ||
        !!(window.TouchID && TouchID.enrolled && TouchID.enrolled()) || !!(window.SecurityKey && SecurityKey.enrolled && SecurityKey.enrolled());
    } catch (_) { return false; }
  }
  // Automatic locks (idle, saver, Dynamic Lock) only when there's something to sign in with.
  const canAutoLock = () => !!window.Lock && !blocked() && !lockShowing() && !kiosk() && hasCredential();

  function eachDoc(fn) {
    fn(document);
    const fr = document.getElementsByTagName("iframe");
    for (let i = 0; i < fr.length; i++) { try { const d = fr[i].contentDocument; if (d) fn(d); } catch (_) {} }
  }
  function mediaPlaying(kind) {
    let on = false;
    eachDoc((d) => { if (on) return; d.querySelectorAll(kind).forEach((m) => { if (!m.paused && !m.ended && m.readyState > 2 && (kind !== "audio" || !m.muted)) on = true; }); });
    return on;
  }
  const videoPlaying = () => mediaPlaying("video");
  const recording = () => { try { return !!(window.GameBar && GameBar.isRecording && GameBar.isRecording()); } catch (_) { return false; } };
  const focusOn = () => {
    try {
      if (S().appData && S().appData.quickSettings && S().appData.quickSettings.focus) return true;
      const i = window.FocusSessions && FocusSessions.info && FocusSessions.info();
      return !!(i && !i.paused);
    } catch (_) { return false; }
  };
  // "Presentation" rules: a playing video or a Game Bar recording keeps the display on (like an
  // app's display-required request); Focus / Do not disturb only holds back the screen saver;
  // audio playing keeps the device awake but lets the screen turn off.
  const holdDisplay = () => videoPlaying() || recording();
  const holdSaver = () => holdDisplay() || focusOn();
  const holdSleep = () => holdDisplay() || mediaPlaying("audio");

  // ====================================================================
  //  idle tracking
  // ====================================================================
  let last = now();           // last real input
  let state = "active";       // active | dim | saver | off | sleep
  let hiddenAt = 0;
  let ov = null, ovMode = "", renderer = null, raf = 0, saverStart = 0, preview = false, ignoreUntil = 0, dimEl = null;
  let moveAcc = 0, lastPt = null;

  function activity(e) {
    if (ov) { wakeFrom(e); return; }
    last = now();
    if (state === "dim") undim();
  }
  const EVTS = ["pointerdown", "keydown", "wheel", "touchstart", "mousedown", "input"];
  function onMove(e) {
    // Mouse jitter shouldn't count: a few pixels of travel are needed (like Windows' saver).
    const p = { x: e.clientX || 0, y: e.clientY || 0 };
    if (e.pointerType === "touch" || e.pointerType === "pen") { activity(e); return; }
    if (lastPt) moveAcc += Math.abs(p.x - lastPt.x) + Math.abs(p.y - lastPt.y);
    lastPt = p;
    if (moveAcc > 6) { moveAcc = 0; activity(e); }
  }
  function hookWin(w) {
    try {
      if (!w || w.__ilHooked) return;
      w.__ilHooked = true;
      EVTS.forEach((t) => w.addEventListener(t, activity, { capture: true, passive: true }));
      w.addEventListener("pointermove", onMove, { capture: true, passive: true });
    } catch (_) {}
  }
  // Keys while an overlay is up only wake it — they never reach the desktop. Registered before the
  // (passive) activity listener so it can cancel the key.
  window.addEventListener("keydown", (e) => { if (!ov) return; e.preventDefault(); e.stopPropagation(); wakeFrom(e); }, true);
  hookWin(window);
  // Focus moving into a (possibly cross-origin) iframe is input we can see.
  window.addEventListener("blur", () => { if (!ov) { setTimeout(() => { if (document.activeElement && document.activeElement.tagName === "IFRAME") activity({ type: "blur" }); }, 0); } });
  function hookFrames() {
    const fr = document.getElementsByTagName("iframe");
    for (let i = 0; i < fr.length; i++) { try { hookWin(fr[i].contentWindow); } catch (_) {} }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = now(); return; }
    const hiddenMs = hiddenAt ? now() - hiddenAt : 0; hiddenAt = 0;
    if (ov) return; // the overlay is still up: the next tap / key wakes it
    if (hiddenMs >= HIDDEN_AWAY_MS && canAutoLock() && signInRule(now() - last)) lockNow("away");
    last = now(); if (state === "dim") undim();
  });

  // ---- the "require sign-in" rule ----
  function signInRule(awayMs) {
    const v = String(cfg().signIn);
    if (v === "never") return false;
    if (v === "always") return true;
    const m = parseFloat(v); return m > 0 && awayMs >= m * MIN;
  }

  function lockNow(reason) {
    if (!window.Lock || lockShowing() || blocked()) return false;
    try { Lock.run(() => { last = now(); }); } catch (e) { console.warn("[IdleLock] lock failed", e); return false; }
    last = now();
    return true;
  }

  // ====================================================================
  //  the timer
  // ====================================================================
  function tick() {
    hookFrames();
    const t = now();
    if (blocked()) { if (!ov) last = Math.max(last, t - 1000); if (state === "dim") undim(); return; }
    if (document.hidden) return;
    const idle = t - last;
    const locked = lockShowing();
    const offMs = screenMin() * MIN, sleepMs = sleepMin() * MIN;
    // On the lock screen the display goes off after a minute (Windows' console lock timeout).
    const offEff = offMs ? (locked ? Math.min(offMs, MIN) : offMs) : 0;
    const c = cfg();
    if (state === "active" || state === "dim") {
      if (sleepMs && idle >= sleepMs && !holdSleep() && !holdDisplay()) return enterSleep("idle");
      if (offEff && idle >= offEff && !holdDisplay()) return enterOff("idle");
      const dimAt = offEff ? offEff - Math.min(30000, offEff / 4) : 0;
      if (offEff && idle >= dimAt && !holdDisplay()) { if (state !== "dim") dim(); }
      else if (state === "dim") undim();
      if (!locked && c.saver.type !== "none" && idle >= c.saver.wait * MIN && !holdSaver() && state === "active") return startSaver(c.saver.type, false);
    } else if (state === "saver" && !preview) {
      if (sleepMs && idle >= sleepMs && !holdSleep()) return enterSleep("idle");
      if (offEff && idle >= offEff) return enterOff("idle");
    } else if (state === "off") {
      if (sleepMs && idle >= sleepMs && !holdSleep()) return enterSleep("idle");
    }
    dynTick(t, idle);
  }
  setInterval(tick, 1000);

  function dim() {
    state = "dim";
    if (!dimEl) { dimEl = el(`<div class="il-dim" aria-hidden="true"></div>`); document.body.appendChild(dimEl); }
    requestAnimationFrame(() => { if (dimEl) dimEl.classList.add("on"); });
  }
  function undim() {
    if (state === "dim") state = "active";
    if (dimEl) { const d = dimEl; dimEl = null; d.classList.remove("on"); setTimeout(() => d.remove(), 400); }
  }

  // ====================================================================
  //  overlay (saver / display off / sleep)
  // ====================================================================
  function makeOverlay(mode) {
    if (dimEl) { dimEl.remove(); dimEl = null; }
    if (!ov) {
      ov = el(`<div class="il-ov" tabindex="-1" role="presentation"></div>`);
      ov.addEventListener("pointerdown", (e) => { e.preventDefault(); wakeFrom(e); });
      ov.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") onMove(e); else wakeFrom(e); });
      ov.addEventListener("touchstart", (e) => { e.preventDefault(); wakeFrom(e); }, { passive: false });
      ov.addEventListener("wheel", (e) => { e.preventDefault(); wakeFrom(e); }, { passive: false });
      ov.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); });
      ov.addEventListener("contextmenu", (e) => e.preventDefault());
      document.body.appendChild(ov);
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (_) {}
      try { ov.focus({ preventScroll: true }); } catch (_) {}
    }
    ov.className = "il-ov il-" + mode;
    ovMode = mode; lastPt = null; moveAcc = 0;
    return ov;
  }

  function stopRenderer() { cancelAnimationFrame(raf); raf = 0; if (renderer) { try { renderer.destroy(); } catch (_) {} renderer = null; } }

  function startSaver(type, isPreview, optsOverride) {
    if (type === "none") return;
    if (!isPreview && (blocked() || lockShowing())) return;
    stopRenderer();
    preview = !!isPreview;
    const o = makeOverlay("saver");
    const opts = Object.assign({}, DEF_OPTS[type] || {}, optsOverride || cfg().saver.opts[type] || {});
    o.classList.toggle("il-clear", type === "bubbles" && !!opts.overDesktop);
    o.innerHTML = `<canvas class="il-canvas"></canvas>`;
    const cv = o.querySelector("canvas");
    renderer = makeRenderer(type, cv, opts, { preview: false, reduced: reducedMotion() });
    runLoop(cv, () => renderer);
    state = "saver"; saverStart = now();
    ignoreUntil = now() + (isPreview ? 600 : 250);
    if (!isPreview) log("Security", "Audit Success", "Microsoft Windows security auditing.", 4802, "The screen saver was invoked.\r\nSubject:\r\n\tAccount Name:\t" + userName() + "\r\nScreen saver:\t" + SAVER_NAME(type), { user: userName(), task: "Other Logon/Logoff Events" });
  }
  function runLoop(cv, getR) {
    let prev = 0;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; const r = getR(); if (r && r.resize) r.resize(); }
    };
    fit();
    const frame = (t) => {
      const r = getR(); if (!r || !cv.isConnected) return;
      fit();
      const dt = prev ? Math.min(60, t - prev) : 16; prev = t;
      try { r.step(dt); } catch (e) { console.warn("[IdleLock] saver", e); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function enterOff(reason) {
    if (state === "off" || state === "sleep") return;
    stopRenderer(); preview = false;
    const o = makeOverlay("off"); o.innerHTML = "";
    state = "off"; ignoreUntil = now() + (reason === "user" ? 1000 : 250);
    log("System", "Information", "Microsoft-Windows-Kernel-Power", 506, "The system is entering Modern Standby (display off).\r\nReason: " + (reason === "user" ? "Button or lid" : "Idle timeout") + ".");
  }
  function enterSleep(reason) {
    if (state === "sleep") return;
    stopRenderer(); preview = false;
    const o = makeOverlay("sleep"); o.innerHTML = "";
    state = "sleep"; ignoreUntil = now() + (reason === "user" ? 1000 : 250);
    sleepAt = now();
    // Sleep really pauses what's playing on this page.
    eachDoc((d) => d.querySelectorAll("video, audio").forEach((m) => { try { if (!m.paused) m.pause(); } catch (_) {} }));
    log("System", "Information", "Microsoft-Windows-Kernel-Power", 42, "The system is entering sleep.\r\nSleep Reason: " + (reason === "user" ? "Application API (Start ▸ Power ▸ Sleep)" : "System Idle"));
  }
  let sleepAt = 0;

  function wakeFrom(e) {
    if (!ov) return;
    const t = now();
    if (t < ignoreUntil) return;
    const mode = ovMode, wasPreview = preview, ranMs = t - saverStart, awayMs = t - last;
    let lock = false;
    if (!wasPreview && canAutoLock()) {
      if (mode === "saver") lock = ranMs >= GRACE_MS && (cfg().saver.resumeLock || signInRule(awayMs));
      else lock = signInRule(awayMs);
    }
    const src = !e ? "Unknown" : /key/.test(e.type) ? "Device -HID Keyboard Device" : (e.pointerType === "touch" || /touch/.test(e.type)) ? "Device -HID-compliant touch screen" : "Device -HID-compliant mouse";
    if (mode === "saver" && !wasPreview) log("Security", "Audit Success", "Microsoft Windows security auditing.", 4803, "The screen saver was dismissed.\r\nSubject:\r\n\tAccount Name:\t" + userName(), { user: userName(), task: "Other Logon/Logoff Events" });
    if (mode === "sleep") log("System", "Information", "Microsoft-Windows-Power-Troubleshooter", 1, "The system has returned from a low power state.\r\nSleep Time: " + new Date(sleepAt).toISOString() + "\r\nWake Time: " + new Date(t).toISOString() + "\r\nWake Source: " + src);
    if (mode === "off") log("System", "Information", "Microsoft-Windows-Kernel-Power", 507, "The system is exiting Modern Standby (display on).\r\nReason: Input — " + src.replace("Device -", ""));
    if (lock) lockNow(mode);
    dismiss();
    last = now();
  }
  function dismiss() {
    stopRenderer();
    const o = ov; ov = null; ovMode = ""; preview = false; state = "active";
    if (!o) return;
    // Keep the (now transparent) layer a moment so the tap's click can't land on the desktop.
    o.classList.add("il-out");
    setTimeout(() => o.remove(), 380);
  }

  // Start ▸ Power ▸ Sleep (js/wm.js shows .sleep-overlay and always locks on click). Take it over
  // so sleep follows "require sign-in" and is logged; the old overlay is removed before its click
  // handler is attached (that happens 400 ms later).
  function watchScreen() {
    const scr = document.getElementById("screen");
    if (!scr) return;
    new MutationObserver((muts) => {
      muts.forEach((m) => m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.classList.contains("sleep-overlay")) { n.remove(); enterSleep("user"); return; }
        if (n.classList.contains("win")) hookSettingsWin(n);
      }));
    }).observe(scr, { childList: true });
    scr.querySelectorAll(".win").forEach(hookSettingsWin);
  }

  // ---- Win+L / Ctrl+Alt+L ----
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || (/Macintosh/.test(navigator.userAgent) && "ontouchend" in document);
  window.addEventListener("keydown", (e) => {
    if (ov) return;
    const isL = e.code === "KeyL" || e.key === "l" || e.key === "L";
    if (!isL || e.shiftKey) return;
    const winKey = e.metaKey && !e.ctrlKey && !e.altKey && !isApple;
    const ctrlAlt = e.ctrlKey && e.altKey && !e.metaKey;
    if (!winKey && !ctrlAlt) return;
    if (blocked() || lockShowing()) return;
    e.preventDefault(); e.stopPropagation();
    lockNow("hotkey");
  }, true);

  // ====================================================================
  //  Dynamic Lock (real Bluetooth presence via Web Bluetooth)
  // ====================================================================
  const dyn = { armed: false, goneAt: 0, connected: false, advAt: 0, watching: null, status: "" };
  function dynSupport() {
    if (!window.Radios || !Radios.bt) return { ok: false, why: "Bluetooth support isn't loaded on this desktop." };
    if (!Radios.bt.supported()) return { ok: false, why: (Radios.bt.reason && Radios.bt.reason()) || Radios.bt.UNSUPPORTED_MSG || "This browser can't use Bluetooth." };
    if (Radios.bt.adapter && Radios.bt.adapter() === false) return { ok: false, why: "No Bluetooth adapter was found on this device." };
    return { ok: true, why: "" };
  }
  function dynDevice() { const c = cfg().dyn; if (!c.id || !window.Radios) return null; try { return Radios.bt.devices().find((d) => d.id === c.id) || null; } catch (_) { return null; } }
  function dynEval() {
    const c = cfg().dyn;
    if (!c.on || !c.id || !dynSupport().ok) { dyn.armed = false; dyn.goneAt = 0; return; }
    const d = dynDevice();
    const present = !!(d && d.connected) || (dyn.advAt && now() - dyn.advAt < 20000);
    if (present) { dyn.armed = true; dyn.goneAt = 0; dyn.connected = true; }
    else {
      dyn.connected = false;
      if (dyn.armed && !dyn.goneAt) {
        dyn.goneAt = now();
        log("System", "Information", "Microsoft-Windows-Bluetooth-Policy", 1001, "Dynamic lock: " + (c.name || "the paired device") + " is no longer connected. Windows will lock after 30 seconds without input.");
      }
    }
    emitUi();
  }
  function dynTick(t, idle) {
    const c = cfg().dyn;
    if (!c.on) return;
    // Advertisement watching: a device that stops advertising for 60 s has left.
    if (dyn.advAt && t - dyn.advAt > 60000 && !(dynDevice() || {}).connected && dyn.armed && !dyn.goneAt) dynEval();
    if (!dyn.goneAt) return;
    if (t - dyn.goneAt >= DYN_IDLE_MS && idle >= DYN_IDLE_MS && canAutoLock()) {
      dyn.goneAt = 0; dyn.armed = false;
      log("Security", "Audit Success", "Microsoft Windows security auditing.", 4800, "Dynamic lock: " + (c.name || "the paired device") + " went out of range and the PC was idle for 30 seconds, so Windows locked.", { user: userName(), task: "Other Logon/Logoff Events" });
      lockNow("dynamic");
      if (ov) dismiss();
    }
  }
  // Where the browser supports watchAdvertisements (Chrome with experimental features), also
  // track presence from advertisements, so a device doesn't have to stay connected.
  async function dynWatchAdverts() {
    try {
      if (dyn.watching) { try { dyn.watching.abort(); } catch (_) {} dyn.watching = null; }
      const c = cfg().dyn, b = navigator.bluetooth;
      if (!c.on || !c.id || !b || typeof b.getDevices !== "function") return;
      const list = await b.getDevices(); const dev = list.find((x) => x.id === c.id);
      if (!dev) return;
      dev.addEventListener("gattserverdisconnected", () => setTimeout(dynEval, 0));
      if (typeof dev.watchAdvertisements !== "function") return;
      const ac = new AbortController(); dyn.watching = ac;
      dev.addEventListener("advertisementreceived", () => { const first = !dyn.advAt; dyn.advAt = now(); if (first || !dyn.armed) dynEval(); });
      await dev.watchAdvertisements({ signal: ac.signal });
    } catch (_) {}
  }
  if (window.Radios && Radios.on) Radios.on(dynEval);
  setTimeout(() => { dynEval(); dynWatchAdverts(); }, 0);
  function dynStatus() {
    const c = cfg().dyn, sup = dynSupport();
    if (!sup.ok) return { kind: "off", text: "Unavailable here. " + sup.why };
    if (!c.on) return { kind: "", text: "Off" };
    if (!c.id) return { kind: "warn", text: "Choose the device Windows should watch." };
    const d = dynDevice();
    if (!d) return { kind: "warn", text: "That device isn't paired any more. Pair it again in Bluetooth & devices." };
    if (dyn.goneAt) { const left = Math.max(0, Math.ceil((DYN_IDLE_MS - (now() - dyn.goneAt)) / 1000)); return { kind: "warn", text: d.name + " is gone — Windows locks after 30 seconds without input" + (left ? " (" + left + " s)" : "") + "." }; }
    if (d.connected || dyn.advAt) return { kind: "ok", text: "Watching " + d.name + ". When it disconnects or goes out of range, Windows locks." };
    return { kind: "warn", text: d.name + " isn't connected right now. Connect it so Windows can tell when it leaves." };
  }

  // ====================================================================
  //  screen saver renderers (Canvas 2D)
  // ====================================================================
  const rnd = (a, b) => a + Math.random() * (b - a);
  function makeRenderer(type, cv, opts, env) {
    const g = cv.getContext("2d");
    const k = env.reduced ? 0.25 : 1;     // reduced motion: everything much slower
    const R = { text3d: text3d, blank: blank, bubbles: bubbles, mystify: mystify, photos: photos, ribbons: ribbons, bounce: bounce, matrix: matrix }[type] || blank;
    return R(cv, g, opts || {}, Object.assign({ k }, env));
  }

  function blank(cv, g) {
    return { step() { g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height); }, destroy() {} };
  }

  // DVD-style bouncing Windows logo: changes colour on every wall hit, celebrates a corner hit.
  function bounce(cv, g, o, env) {
    const spd = (Math.max(1, Math.min(10, +o.speed || 6)) / 6) * env.k;
    let x, y, vx, vy, hue, flash, celebrated;
    function logoSize() { return Math.max(44, Math.min(cv.width, cv.height) * 0.16); }
    function init() {
      const s = logoSize();
      x = rnd(0, cv.width - s * 1.2); y = rnd(0, cv.height - s * 1.3);
      const base = Math.min(cv.width, cv.height) * 0.12 * spd, a = rnd(0.5, 1.1);
      vx = base * Math.cos(a) * (Math.random() < 0.5 ? -1 : 1);
      vy = base * Math.sin(a) * (Math.random() < 0.5 ? -1 : 1);
      hue = rnd(0, 360); flash = 0; celebrated = 0;
    }
    init();
    function drawLogo(cx, cy, s, col, glow) {
      // The Windows four-pane flag, tilted, in a single DVD-logo colour.
      g.save(); g.translate(cx, cy);
      if (glow) { g.shadowColor = col; g.shadowBlur = s * 0.5; }
      g.transform(1, 0.08, -0.14, 1, 0, 0);
      const gap = s * 0.08, pane = (s - gap) / 2;
      g.fillStyle = col;
      [[0, 0], [pane + gap, 0], [0, pane + gap], [pane + gap, pane + gap]].forEach(([px, py]) => {
        g.beginPath(); roundRect(g, px - s / 2, py - s / 2, pane, pane, pane * 0.12); g.fill();
      });
      g.restore();
      g.shadowBlur = 0;
      g.fillStyle = col; g.font = "600 " + Math.round(s * 0.2) + "px 'Segoe UI', system-ui, sans-serif";
      g.textAlign = "center"; g.fillText("Windows 12", cx, cy + s * 0.8);
    }
    return {
      resize: init,
      step(dt) {
        const W = cv.width, H = cv.height, s = logoSize(), span = s * 1.25, sp = dt / 1000;
        g.fillStyle = "#05060a"; g.fillRect(0, 0, W, H);
        x += vx * sp; y += vy * sp;
        let hitX = false, hitY = false;
        if (x < 0) { x = 0; vx = Math.abs(vx); hitX = true; } else if (x > W - span) { x = W - span; vx = -Math.abs(vx); hitX = true; }
        if (y < 0) { y = 0; vy = Math.abs(vy); hitY = true; } else if (y > H - span) { y = H - span; vy = -Math.abs(vy); hitY = true; }
        if (hitX || hitY) { hue = (hue + rnd(40, 110)) % 360; if (hitX && hitY && o.celebrate) { flash = 1; celebrated++; } }
        flash = Math.max(0, flash - sp * 0.6);
        const col = `hsl(${hue | 0} 85% ${55 + flash * 20}%)`;
        if (flash > 0.02) { // corner-hit celebration: expanding rings
          g.strokeStyle = `hsla(${hue | 0} 90% 70% / ${flash})`; g.lineWidth = 3;
          for (let r = 0; r < 3; r++) { g.beginPath(); g.arc(x + span / 2, y + span / 2, s * (0.7 + r * 0.6) * (1.2 - flash), 0, 6.28); g.stroke(); }
        }
        drawLogo(x + span / 2, y + s / 2, s, col, flash > 0.02);
        if (celebrated && o.celebrate) { g.fillStyle = "rgba(255,255,255,.5)"; g.font = "600 13px 'Segoe UI',system-ui,sans-serif"; g.textAlign = "right"; g.fillText("corner hits: " + celebrated, W - 16, H - 14); }
      },
      destroy() {},
    };
  }

  // The Matrix: columns of falling glyphs. Also the `matrix` terminal command.
  function matrix(cv, g, o, env) {
    const GLYPHS = "日ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶ01234789ABCDEFZ:.=*+-<>¦｜╌".split("");
    const base = (/** colour */ o.color) || "#20e020";
    const spd = (Math.max(1, Math.min(10, +o.speed || 6)) / 6) * env.k;
    let fs, cols, drops;
    function init() {
      fs = Math.max(12, Math.round(Math.min(cv.width, cv.height) / 42));
      cols = Math.ceil(cv.width / fs); drops = [];
      for (let i = 0; i < cols; i++) drops.push(rnd(-40, 0));
    }
    init();
    return {
      resize: init,
      step(dt) {
        const W = cv.width, H = cv.height, sp = Math.min(2, dt / 16);
        g.fillStyle = "rgba(0,8,0,0.09)"; g.fillRect(0, 0, W, H);
        g.font = fs + "px 'Consolas','Courier New',monospace"; g.textAlign = "start";
        for (let i = 0; i < cols; i++) {
          const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0], xx = i * fs, yy = drops[i] * fs;
          if (yy > 0) { g.fillStyle = "rgba(200,255,200,0.95)"; g.fillText(ch, xx, yy); g.fillStyle = base; g.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], xx, yy - fs); }
          drops[i] += 0.55 * spd;
          if (yy > H && Math.random() > 0.975) drops[i] = rnd(-30, 0);
        }
      },
      destroy() {},
    };
  }
  function roundRect(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function bubbles(cv, g, o, env) {
    const N = { few: 7, some: 12, lots: 20 }[o.count] || 12;
    let list = [];
    function init() {
      const W = cv.width, H = cv.height, base = Math.min(W, H);
      list = [];
      for (let i = 0; i < N; i++) {
        const r = base * rnd(0.045, 0.11);
        const sp = base * rnd(0.06, 0.16) * env.k;
        const a = rnd(0, Math.PI * 2);
        list.push({ x: rnd(r, W - r), y: rnd(r, H - r), r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, hue: rnd(0, 360), ph: rnd(0, 6.28) });
      }
    }
    init();
    function draw(b) {
      const { x, y, r } = b;
      // body: mostly clear, iridescent toward the rim
      let gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      gr.addColorStop(0, "rgba(255,255,255,0.02)");
      gr.addColorStop(0.72, `hsla(${b.hue},90%,70%,0.10)`);
      gr.addColorStop(0.92, `hsla(${(b.hue + 60) % 360},95%,72%,0.38)`);
      gr.addColorStop(1, `hsla(${(b.hue + 140) % 360},95%,80%,0.55)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.lineWidth = Math.max(1, r * 0.025); g.strokeStyle = "rgba(255,255,255,0.35)"; g.stroke();
      // window highlight
      const hx = x - r * 0.38, hy = y - r * 0.42;
      gr = g.createRadialGradient(hx, hy, 0, hx, hy, r * 0.42);
      gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.35, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.beginPath(); g.ellipse(hx, hy, r * 0.34, r * 0.22, -0.7, 0, Math.PI * 2); g.fill();
      // little glint
      g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.arc(x + r * 0.45, y + r * 0.5, r * 0.06, 0, Math.PI * 2); g.fill();
    }
    return {
      resize: init,
      step(dt) {
        const W = cv.width, H = cv.height, s = dt / 1000;
        if (o.overDesktop) g.clearRect(0, 0, W, H); else { g.fillStyle = "#000"; g.fillRect(0, 0, W, H); }
        list.forEach((b) => {
          b.x += b.vx * s; b.y += b.vy * s; b.hue = (b.hue + 12 * s * env.k) % 360;
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); } if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
        });
        // elastic collisions (mass ~ area)
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
          if (d > 0 && d < m) {
            const nx = dx / d, ny = dy / d, ov2 = (m - d) / 2;
            a.x -= nx * ov2; a.y -= ny * ov2; b.x += nx * ov2; b.y += ny * ov2;
            const ma = a.r * a.r, mb = b.r * b.r, va = a.vx * nx + a.vy * ny, vb = b.vx * nx + b.vy * ny;
            if (va - vb > 0) {
              const na = (va * (ma - mb) + 2 * mb * vb) / (ma + mb), nb = (vb * (mb - ma) + 2 * ma * va) / (ma + mb);
              a.vx += (na - va) * nx; a.vy += (na - va) * ny; b.vx += (nb - vb) * nx; b.vy += (nb - vb) * ny;
            }
          }
        }
        list.forEach(draw);
      },
      destroy() {},
    };
  }

  function mystify(cv, g, o, env) {
    const shapes = Math.max(1, Math.min(3, +o.shapes || 2)), trail = Math.max(3, Math.min(30, +o.trail || 12));
    let polys = [];
    function init() {
      const W = cv.width, H = cv.height, sp = Math.min(W, H) * 0.35 * env.k;
      polys = [];
      for (let p = 0; p < shapes; p++) {
        const v = [];
        for (let i = 0; i < 4; i++) v.push({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-1, 1) * sp, vy: rnd(-1, 1) * sp });
        polys.push({ v, hist: [], hue: rnd(0, 360), acc: 0 });
      }
    }
    init();
    return {
      resize: init,
      step(dt) {
        const W = cv.width, H = cv.height, s = dt / 1000;
        g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
        g.lineWidth = Math.max(1, Math.min(W, H) / 400);
        polys.forEach((p) => {
          p.v.forEach((q) => {
            q.x += q.vx * s; q.y += q.vy * s;
            if (q.x < 0) { q.x = 0; q.vx = Math.abs(q.vx); } if (q.x > W) { q.x = W; q.vx = -Math.abs(q.vx); }
            if (q.y < 0) { q.y = 0; q.vy = Math.abs(q.vy); } if (q.y > H) { q.y = H; q.vy = -Math.abs(q.vy); }
          });
          p.hue = (p.hue + 25 * s * env.k) % 360;
          p.acc += dt;
          if (p.acc > 45 / Math.max(env.k, 0.25) || !p.hist.length) { p.acc = 0; p.hist.push(p.v.map((q) => [q.x, q.y])); if (p.hist.length > trail) p.hist.shift(); }
          p.hist.forEach((h, i) => {
            const a = (i + 1) / p.hist.length;
            g.strokeStyle = `hsla(${(p.hue + i * 3) % 360},95%,60%,${a})`;
            g.beginPath(); g.moveTo(h[0][0], h[0][1]); for (let j = 1; j < 4; j++) g.lineTo(h[j][0], h[j][1]); g.closePath(); g.stroke();
          });
        });
      },
      destroy() {},
    };
  }

  function ribbons(cv, g, o, env) {
    const N = Math.max(1, Math.min(12, +o.count || 5)), MAXP = 260;
    let rib = [];
    function init() {
      const W = cv.width, H = cv.height, base = Math.min(W, H);
      rib = [];
      for (let i = 0; i < N; i++) rib.push({ x: rnd(W * 0.2, W * 0.8), y: rnd(H * 0.2, H * 0.8), a: rnd(0, 6.28), turn: 0, target: rnd(-2, 2), sp: base * rnd(0.18, 0.3) * env.k, w: base * (+o.width || 14) / 900 * rnd(0.7, 1.3), hue: rnd(0, 360), ph: rnd(0, 6.28), pts: [], t: 0 });
    }
    init();
    return {
      resize: init,
      step(dt) {
        const W = cv.width, H = cv.height, s = dt / 1000;
        g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
        rib.forEach((r) => {
          r.t += s;
          if (Math.random() < s * 0.8) r.target = rnd(-2.6, 2.6);
          r.turn += (r.target - r.turn) * Math.min(1, s * 1.5);
          // steer back toward the middle near the edges
          const cx = W / 2 - r.x, cy = H / 2 - r.y, m = Math.min(W, H) * 0.12;
          if (r.x < m || r.y < m || r.x > W - m || r.y > H - m) { const want = Math.atan2(cy, cx); let d = want - r.a; d = Math.atan2(Math.sin(d), Math.cos(d)); r.a += d * Math.min(1, s * 3); }
          r.a += r.turn * s * env.k;
          r.x += Math.cos(r.a) * r.sp * s; r.y += Math.sin(r.a) * r.sp * s;
          r.ph += s * 2.2 * env.k; r.hue = (r.hue + 10 * s) % 360;
          const lastP = r.pts[r.pts.length - 1];
          if (!lastP || Math.hypot(r.x - lastP.x, r.y - lastP.y) > 3) {
            r.pts.push({ x: r.x, y: r.y, nx: -Math.sin(r.a), ny: Math.cos(r.a), tw: Math.cos(r.ph), hue: r.hue });
            if (r.pts.length > MAXP) r.pts.shift();
          }
          const P = r.pts;
          for (let i = 1; i < P.length; i++) {
            const p0 = P[i - 1], p1 = P[i], age = i / P.length;
            const w0 = r.w * p0.tw, w1 = r.w * p1.tw;
            // opaque, fading to black toward the tail (no alpha seams between segments)
            const light = (p1.tw >= 0 ? 50 + 22 * p1.tw : 24 + 10 * -p1.tw) * Math.min(1, age * 1.3);
            g.fillStyle = g.strokeStyle = `hsl(${p1.hue.toFixed(1)},90%,${light.toFixed(1)}%)`;
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(p0.x + p0.nx * w0, p0.y + p0.ny * w0); g.lineTo(p1.x + p1.nx * w1, p1.y + p1.ny * w1);
            g.lineTo(p1.x - p1.nx * w1, p1.y - p1.ny * w1); g.lineTo(p0.x - p0.nx * w0, p0.y - p0.ny * w0);
            g.closePath(); g.fill(); g.stroke();
          }
        });
      },
      destroy() {},
    };
  }

  function text3d(cv, g, o, env) {
    let face = null, side = null, shade = null, lastText = "", x = 0, y = 0, vx = 0, vy = 0, th = 0;
    const timeText = () => { const d = new Date(); return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
    const curText = () => (o.mode === "time" ? timeText() : (String(o.text || "").trim() || "Windows 12")).slice(0, 40);
    function shadeHex(hex, f) {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); const n = m ? parseInt(m[1], 16) : 0x3b91d8;
      const r = Math.round(((n >> 16) & 255) * f), gg = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
      return `rgb(${Math.min(255, r)},${Math.min(255, gg)},${Math.min(255, b)})`;
    }
    function build() {
      const W = cv.width, H = cv.height, txt = curText(); lastText = txt;
      const sizeF = { small: 0.09, medium: 0.14, large: 0.2 }[o.size] || 0.14;
      let fs = Math.round(Math.min(W, H) * sizeF * (env.preview ? 1.4 : 1));
      const font = (f) => `900 ${f}px "Segoe UI", system-ui, -apple-system, Arial, sans-serif`;
      const meas = document.createElement("canvas").getContext("2d");
      meas.font = font(fs); let tw = meas.measureText(txt).width;
      if (tw > W * 0.8) { fs = Math.floor(fs * (W * 0.8) / tw); meas.font = font(fs); tw = meas.measureText(txt).width; }
      const pw = Math.ceil(tw + fs * 0.3), ph = Math.ceil(fs * 1.35);
      const mk = (fill) => {
        const c = document.createElement("canvas"); c.width = pw; c.height = ph;
        const x2 = c.getContext("2d"); x2.font = font(fs); x2.textAlign = "center"; x2.textBaseline = "middle";
        x2.fillStyle = typeof fill === "function" ? fill(x2) : fill; x2.fillText(txt, pw / 2, ph / 2); return c;
      };
      face = mk((x2) => {
        const gr = x2.createLinearGradient(0, 0, 0, ph);
        if (o.surface === "reflection") { gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.35, "#b9c7d8"); gr.addColorStop(0.5, "#5d6b7f"); gr.addColorStop(0.62, "#dfe8f2"); gr.addColorStop(1, "#7d8ba0"); }
        else { gr.addColorStop(0, shadeHex(o.color, 1.45)); gr.addColorStop(0.55, shadeHex(o.color, 1)); gr.addColorStop(1, shadeHex(o.color, 0.7)); }
        return gr;
      });
      side = mk(o.surface === "reflection" ? "#3c4656" : shadeHex(o.color, 0.42));
      shade = mk("#000");
      face._fs = fs;
      if (!x) { x = W / 2; y = H / 2; const sp = Math.min(W, H) * 0.05 * env.k; const a = rnd(0, 6.28); vx = Math.cos(a) * sp; vy = Math.sin(a) * sp; }
    }
    build();
    return {
      resize() { x = 0; build(); },
      step(dt) {
        const W = cv.width, H = cv.height, s = dt / 1000;
        if (o.mode === "time" && timeText() !== lastText) build();
        g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
        const speed = (Math.max(1, Math.min(10, +o.speed || 5)) / 5) * env.k;
        th += s * 1.1 * speed;
        x += vx * s; y += vy * s;
        const hw = face.width / 2 * 0.9, hh = face.height / 2;
        if (x < hw) { x = hw; vx = Math.abs(vx); } if (x > W - hw) { x = W - hw; vx = -Math.abs(vx); }
        if (y < hh) { y = hh; vy = Math.abs(vy); } if (y > H - hh) { y = H - hh; vy = -Math.abs(vy); }
        let rotY = 0, rotX = 0, rotZ = 0;
        if (o.motion === "seesaw") { rotZ = Math.sin(th) * 0.35; rotY = Math.sin(th * 0.5) * 0.5; }
        else if (o.motion === "wobble") { rotY = Math.sin(th) * 0.7; rotX = Math.cos(th * 0.8) * 0.45; }
        else if (o.motion === "tumble") { rotZ = th * 0.6; rotY = th; rotX = Math.sin(th * 0.7) * 0.4; }
        else rotY = th;  // spin
        const sx = Math.cos(rotY), sy = Math.cos(rotX);
        const depth = face._fs * 0.28, L = Math.max(12, Math.min(48, Math.round(depth / 1.1)));
        const dx = Math.sin(rotY) * depth / L, dy = Math.sin(rotX) * depth / L;
        g.save(); g.translate(x, y); g.rotate(rotZ);
        const put = (img, i, alpha) => {
          g.save(); g.translate(i * dx, i * dy); g.scale(sx || 0.001, sy || 0.001);
          g.globalAlpha = alpha; g.drawImage(img, -img.width / 2, -img.height / 2); g.restore();
        };
        const front = sx >= 0;
        // back to front: extruded sides, then the visible face, shaded by how far it's turned away
        if (front) { for (let i = L; i >= 1; i--) put(side, i, 1); put(face, 0, 1); put(shade, 0, (1 - Math.abs(sx)) * 0.55); }
        else { for (let i = 0; i < L; i++) put(side, i, 1); put(face, L, 1); put(shade, L, (1 - Math.abs(sx)) * 0.55); }
        g.restore();
        g.globalAlpha = 1;
      },
      destroy() {},
    };
  }

  // Photos: your Pictures folder (or another one) — inline images or blobs in IndexedDB.
  const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i;
  function photoNodes(folder) {
    const out = [];
    try {
      const root = (S().appData.files && S().appData.files.root) || {};
      const top = root[folder || "Pictures"];
      (function rec(kids, depth) {
        Object.keys(kids || {}).forEach((name) => {
          const c = kids[name]; if (!c) return;
          if (c.type === "folder") { if (depth < 6) rec(c.children, depth + 1); return; }
          if (c.type === "file" && (c.kind === "image" || IMG_RE.test(name)) && (c.blob || c.src) && out.length < 300) out.push({ name, node: c });
        });
      })(top && top.children, 0);
    } catch (_) {}
    return out;
  }
  const FALLBACK = ["assets/wall1.jpg", "assets/wall2.jpg", "assets/wall3.jpg", "assets/wall4.jpg", "assets/wall5.jpg", "assets/wall6.jpg"];
  function photos(cv, g, o, env) {
    let items = photoNodes(o.folder);
    const usingFallback = !items.length;
    if (usingFallback) items = FALLBACK.map((src) => ({ name: src, node: { src } }));
    if (o.shuffle) for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = items[i]; items[i] = items[j]; items[j] = t; }
    const hold = ({ slow: 12000, medium: 7000, fast: 4000 }[o.speed] || 7000) * (env.reduced ? 1.6 : 1);
    const FADE = env.reduced ? 2000 : 1200;
    const urls = []; let dead = false, idx = 0, cur = null, prev = null, curAt = 0, loading = false, missing = 0;
    function load(i) {
      const it = items[i % items.length];
      const done = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
      if (it.node.blob && window.VFS && VFS.getBlob) return VFS.getBlob(it.node.blob).then((b) => { if (!b) return it.node.src ? done(it.node.src) : null; const u = URL.createObjectURL(b); urls.push(u); return done(u); }).catch(() => (it.node.src ? done(it.node.src) : null));
      return done(it.node.src);
    }
    function next() {
      if (loading || dead) return; loading = true;
      load(idx++).then((im) => {
        loading = false; if (dead) return;
        if (!im) { if (++missing < items.length) next(); return; }
        missing = 0; prev = cur; cur = { im, at: performance.now(), pan: [rnd(-1, 1), rnd(-1, 1)] }; curAt = now();
      });
    }
    next();
    function drawImg(c, alpha, t) {
      const W = cv.width, H = cv.height, im = c.im, life = Math.min(1, (t - c.at) / (hold + FADE));
      const kb = env.reduced ? 1 : 1 + 0.06 * life;
      const sc = Math.min(W / im.naturalWidth, H / im.naturalHeight) * kb;
      const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
      const px = env.reduced ? 0 : c.pan[0] * W * 0.015 * life, py = env.reduced ? 0 : c.pan[1] * H * 0.015 * life;
      g.globalAlpha = alpha; g.drawImage(im, (W - w) / 2 + px, (H - h) / 2 + py, w, h); g.globalAlpha = 1;
    }
    return {
      step() {
        const W = cv.width, H = cv.height, t = performance.now();
        g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
        if (cur) {
          const a = Math.min(1, (t - cur.at) / FADE);
          if (prev && a < 1) drawImg(prev, 1 - a, t);
          drawImg(cur, a, t);
          if (a >= 1) prev = null;
        }
        if (env.preview && usingFallback) {
          g.font = `${Math.round(H * 0.07)}px system-ui, sans-serif`; g.fillStyle = "rgba(255,255,255,.85)"; g.textAlign = "center";
          g.fillText("No photos in " + (o.folder || "Pictures") + " — showing samples", W / 2, H - H * 0.06);
        }
        if (!cur || now() - curAt >= hold) next();
      },
      destroy() { dead = true; urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) {} }); },
      info: { count: usingFallback ? 0 : items.length },
    };
  }

  // ====================================================================
  //  Screen Saver Settings dialog (classic, like desk.cpl ▸ Screen Saver)
  // ====================================================================
  let dlg = null;
  function openSaverDialog() {
    if (dlg && dlg.win && dlg.win.isConnected) { try { dlg.win.style.display = ""; dlg.focus(); } catch (_) {} return dlg; }
    if (!window.WM || !WM.createWindow) return null;
    const c = cfg();
    const draft = { type: c.saver.type, wait: c.saver.wait, resumeLock: !!c.saver.resumeLock, opts: JSON.parse(JSON.stringify(c.saver.opts)) };
    const icon = window.Icon && Icon.mini ? Icon.mini("settings", "Settings") : "";
    const w = WM.createWindow({ title: "Screen Saver Settings", icon, width: 430, height: 560, appId: "il-screensaver", noMax: true, noMin: true, onClose: () => { stopPrev(); dlg = null; } });
    dlg = w;
    w.win.classList.add("il-win");
    w.body.innerHTML = `<div class="il-ssd">
      <div class="il-tabs" role="tablist"><span class="il-tab on" role="tab" aria-selected="true">Screen Saver</span></div>
      <div class="il-panel">
        <div class="il-mon" aria-label="Preview"><div class="il-mon-scr"><canvas class="il-mon-cv"></canvas><div class="il-mon-empty"></div></div><div class="il-mon-neck"></div><div class="il-mon-base"></div></div>
        <fieldset class="il-fs"><legend>Screen saver</legend>
          <div class="il-r"><select class="il-sel" aria-label="Screen saver">${SAVERS.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
            <button type="button" class="il-b" data-a="settings">Settings…</button><button type="button" class="il-b" data-a="preview">Preview</button></div>
          <div class="il-r il-r2"><label class="il-wait">Wait: <input class="il-num" type="number" min="1" max="9999" inputmode="numeric" aria-label="Wait minutes"> minutes</label>
            <label class="il-chk"><input type="checkbox" class="il-resume"> On resume, display logon screen</label></div>
          <div class="il-note"></div>
        </fieldset>
        <fieldset class="il-fs"><legend>Power management</legend>
          <p class="il-p">Conserve energy or maximize performance by adjusting display brightness and other power settings.</p>
          <a class="il-link" data-a="power" tabindex="0">Change power settings</a>
        </fieldset>
      </div>
      <div class="il-btns"><button type="button" class="il-b il-primary" data-a="ok">OK</button><button type="button" class="il-b" data-a="cancel">Cancel</button><button type="button" class="il-b" data-a="apply" disabled>Apply</button></div>
      <div class="il-sheet" hidden></div>
    </div>`;
    const B = w.body, q = (s) => B.querySelector(s);
    const sel = q(".il-sel"), num = q(".il-num"), res = q(".il-resume"), apply = q('[data-a="apply"]'), note = q(".il-note");
    sel.value = draft.type; num.value = draft.wait; res.checked = draft.resumeLock;
    let pr = null, praf = 0;
    function stopPrev() { cancelAnimationFrame(praf); praf = 0; if (pr) { try { pr.destroy(); } catch (_) {} pr = null; } }
    function paintPrev() {
      stopPrev();
      const cv = q(".il-mon-cv"), empty = q(".il-mon-empty"), scr = q(".il-mon-scr");
      const none = draft.type === "none";
      empty.hidden = !none; cv.hidden = none;
      scr.classList.toggle("il-mon-desk", none || (draft.type === "bubbles" && draft.opts.bubbles.overDesktop));
      if (none) return;
      cv.width = Math.round(cv.clientWidth * 1.5) || 270; cv.height = Math.round(cv.clientHeight * 1.5) || 160;
      pr = makeRenderer(draft.type, cv, draft.opts[draft.type], { preview: true, reduced: reducedMotion() });
      let prev = 0;
      const frame = (t) => { if (!cv.isConnected || !pr) return; const dt = prev ? Math.min(60, t - prev) : 16; prev = t; try { pr.step(dt); } catch (_) {} praf = requestAnimationFrame(frame); };
      praf = requestAnimationFrame(frame);
    }
    function paint() {
      const none = draft.type === "none";
      q('[data-a="settings"]').disabled = none; q('[data-a="preview"]').disabled = none;
      num.disabled = none; res.disabled = none;
      const parts = [];
      if (!none && draft.resumeLock && !hasCredential()) parts.push("You haven't set up a PIN or password, so resuming goes straight back to the desktop.");
      if (!none && kiosk()) parts.push("Kiosk mode is on: the screen saver runs, but Windows won't lock.");
      const off = screenMin();
      if (!none && off && off <= draft.wait) parts.push("Your screen turns off after " + off + " min, before the screen saver would start. Change it in power settings.");
      note.textContent = parts.join(" ");
      note.hidden = !parts.length;
    }
    const dirty = () => { apply.disabled = false; paint(); };
    sel.onchange = () => { draft.type = sel.value; dirty(); paintPrev(); };
    num.oninput = () => { const v = Math.round(+num.value); if (v >= 1 && v <= 9999) { draft.wait = v; dirty(); } };
    num.onblur = () => { num.value = draft.wait; };
    res.onchange = () => { draft.resumeLock = res.checked; dirty(); };
    function commit() {
      const cc = cfg();
      cc.saver.type = draft.type; cc.saver.wait = draft.wait; cc.saver.resumeLock = draft.resumeLock;
      cc.saver.opts = JSON.parse(JSON.stringify(draft.opts));
      save(); apply.disabled = true; last = now(); emitUi();
    }
    B.querySelector(".il-btns").onclick = (e) => {
      const a = e.target.closest("[data-a]"); if (!a) return;
      if (a.dataset.a === "apply") commit();
      else if (a.dataset.a === "ok") { commit(); w.close(); }
      else if (a.dataset.a === "cancel") w.close();
    };
    q('[data-a="preview"]').onclick = () => { if (draft.type !== "none") startSaver(draft.type, true, draft.opts[draft.type]); };
    q('[data-a="settings"]').onclick = () => openOptions(draft, B.querySelector(".il-sheet"), () => { dirty(); paintPrev(); });
    const pw = q('[data-a="power"]');
    pw.onclick = () => openSettingsAt("power");
    pw.onkeydown = (e) => { if (e.key === "Enter") pw.onclick(); };
    paint();
    requestAnimationFrame(paintPrev);
    return w;
  }

  // Per-saver "Settings…" sheet.
  function openOptions(draft, sheet, onOk) {
    const type = draft.type, o = Object.assign({}, draft.opts[type]);
    const fld = (label, ctl) => `<label class="il-f"><span>${label}</span>${ctl}</label>`;
    const opt = (pairs, v) => pairs.map(([a, b]) => `<option value="${esc(a)}" ${String(a) === String(v) ? "selected" : ""}>${esc(b)}</option>`).join("");
    let body = "";
    if (type === "text3d") body = `
      <div class="il-f"><span>Text</span><label class="il-chk"><input type="radio" name="il-m" value="text" ${o.mode !== "time" ? "checked" : ""}> Custom text</label>
        <input class="il-in" data-k="text" maxlength="40" value="${esc(o.text)}" aria-label="Custom text">
        <label class="il-chk"><input type="radio" name="il-m" value="time" ${o.mode === "time" ? "checked" : ""}> Time</label></div>
      ${fld("Rotation type", `<select class="il-sel" data-k="motion">${opt([["spin", "Spin"], ["seesaw", "See-Saw"], ["wobble", "Wobble"], ["tumble", "Tumble"]], o.motion)}</select>`)}
      ${fld("Rotation speed", `<input type="range" min="1" max="10" data-k="speed" value="${+o.speed || 5}">`)}
      ${fld("Size", `<select class="il-sel" data-k="size">${opt([["small", "Small"], ["medium", "Medium"], ["large", "Large"]], o.size)}</select>`)}
      ${fld("Surface style", `<select class="il-sel" data-k="surface">${opt([["solid", "Solid color"], ["reflection", "Reflection"]], o.surface)}</select>`)}
      ${fld("Color", `<input type="color" data-k="color" value="${esc(o.color)}">`)}`;
    else if (type === "bubbles") body = `
      <label class="il-chk"><input type="checkbox" data-k="overDesktop" ${o.overDesktop ? "checked" : ""}> Show bubbles over the desktop</label>
      ${fld("Number of bubbles", `<select class="il-sel" data-k="count">${opt([["few", "Few"], ["some", "Some"], ["lots", "Lots"]], o.count)}</select>`)}`;
    else if (type === "mystify") body = `
      ${fld("Shapes", `<select class="il-sel" data-k="shapes">${opt([[1, "1"], [2, "2"], [3, "3"]], o.shapes)}</select>`)}
      ${fld("Lines per shape", `<input type="range" min="3" max="30" data-k="trail" value="${+o.trail || 12}">`)}`;
    else if (type === "ribbons") body = `
      ${fld("Number of ribbons", `<input type="range" min="1" max="12" data-k="count" value="${+o.count || 5}">`)}
      ${fld("Ribbon width", `<input type="range" min="4" max="40" data-k="width" value="${+o.width || 14}">`)}`;
    else if (type === "bounce") body = `
      ${fld("Speed", `<input type="range" min="1" max="10" data-k="speed" value="${+o.speed || 6}">`)}
      <label class="il-chk"><input type="checkbox" data-k="celebrate" ${o.celebrate ? "checked" : ""}> Celebrate a corner hit</label>`;
    else if (type === "matrix") body = `
      ${fld("Speed", `<input type="range" min="1" max="10" data-k="speed" value="${+o.speed || 6}">`)}
      ${fld("Rain colour", `<input type="color" data-k="color" value="${esc(o.color || "#20e020")}">`)}`;
    else if (type === "photos") {
      const folders = ["Pictures", "Desktop", "Downloads", "OneDrive", "Documents"];
      body = `${fld("Use pictures from", `<select class="il-sel" data-k="folder">${opt(folders.map((f) => [f, f]), o.folder)}</select>`)}
      <div class="il-dimtx il-photocount"></div>
      ${fld("Slide show speed", `<select class="il-sel" data-k="speed">${opt([["slow", "Slow"], ["medium", "Medium"], ["fast", "Fast"]], o.speed)}</select>`)}
      <label class="il-chk"><input type="checkbox" data-k="shuffle" ${o.shuffle ? "checked" : ""}> Shuffle pictures</label>`;
    }
    else body = `<p class="il-p">This screen saver has no options that you can set.</p>`;
    sheet.innerHTML = `<div class="il-sheet-card" role="dialog" aria-label="${esc(SAVER_NAME(type))} settings"><div class="il-sheet-h">${esc(SAVER_NAME(type))} Settings</div><div class="il-sheet-b">${body}</div>
      <div class="il-btns">${type === "blank" ? "" : `<button type="button" class="il-b il-primary" data-a="ok">OK</button>`}<button type="button" class="il-b" data-a="cancel">${type === "blank" ? "OK" : "Cancel"}</button></div></div>`;
    sheet.hidden = false;
    const pc = sheet.querySelector(".il-photocount");
    const paintCount = () => { if (!pc) return; const n = photoNodes(o.folder).length; pc.textContent = n ? n + " picture" + (n > 1 ? "s" : "") + " found in " + o.folder + "." : "No pictures in " + o.folder + " yet — the slide show uses the Windows sample pictures. Add photos in File Explorer."; };
    paintCount();
    sheet.querySelectorAll("[data-k]").forEach((inp) => {
      const upd = () => { const k = inp.dataset.k; o[k] = inp.type === "checkbox" ? inp.checked : inp.type === "range" || k === "shapes" ? +inp.value : inp.value; if (k === "folder") paintCount(); };
      inp.addEventListener("input", upd); inp.addEventListener("change", upd);
    });
    sheet.querySelectorAll('input[name="il-m"]').forEach((r) => (r.onchange = () => { if (r.checked) o.mode = r.value; }));
    sheet.querySelector(".il-btns").onclick = (e) => {
      const a = e.target.closest("[data-a]"); if (!a) return;
      if (a.dataset.a === "ok") { draft.opts[type] = o; onOk(); }
      sheet.hidden = true; sheet.innerHTML = "";
    };
    const first = sheet.querySelector("input, select, button"); if (first) try { first.focus(); } catch (_) {}
  }

  // ====================================================================
  //  Settings app integration (rows added as pages open; settings12.js unchanged)
  // ====================================================================
  const T = {
    power: ["Power & battery", "Energi och batteri"],
    signin: ["Sign-in options", "Inloggningsalternativ"],
    personal: ["Personalization", "Anpassning"],
  };
  const svgI = (p) => `<svg class="w12s-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="url(#w12s-g)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICONS = {
    lockscreen: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><rect x="9" y="9" width="6" height="5" rx="1"/><path d="M10.5 9V7.8a1.5 1.5 0 0 1 3 0V9M8 20h8"/>',
    saver: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/><circle cx="9" cy="9" r="1.6"/><circle cx="14.5" cy="11" r="2.2"/>',
    timeout: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4M12 7v3.5l2 1.3"/>',
    power: '<path d="M12 4v8"/><path d="M6.3 7.3a8 8 0 1 0 11.4 0"/>',
    away: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    dyn: '<rect x="4" y="11" width="10" height="9" rx="2"/><path d="M6.5 11V8.5a2.5 2.5 0 0 1 5 0V11M17 6l3 3-3 3M17 12l3 3-3 3M17 6v12"/>',
  };
  function sel(pairs, val, onChange, label) {
    const s = el(`<select class="w12s-select" aria-label="${esc(label || "")}">${pairs.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`);
    s.addEventListener("click", (e) => e.stopPropagation());
    s.onchange = () => onChange(s.value);
    return s;
  }
  function row(ic, t, s, opts) {
    opts = opts || {};
    const click = !!opts.onClick;
    const r = el(`<div class="w12s-row ${click ? "w12s-click" : "w12s-row-static"} il-row" tabindex="${click ? 0 : -1}"><span class="w12s-row-ic">${svgI(ICONS[ic] || ICONS.saver)}</span><div class="w12s-row-txt"><div class="w12s-row-t"></div><div class="w12s-row-s"></div></div><div class="w12s-row-ctl"></div>${click ? `<span class="w12s-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span>` : ""}</div>`);
    r.querySelector(".w12s-row-t").textContent = t;
    r.querySelector(".w12s-row-s").textContent = s || "";
    if (opts.ctl) r.querySelector(".w12s-row-ctl").appendChild(opts.ctl);
    if (click) { r.onclick = opts.onClick; r.addEventListener("keydown", (e) => { if (e.key === "Enter") opts.onClick(); }); }
    return r;
  }
  const minsLabel = (m) => (TIMEOUTS.find((x) => x[0] === +m) || [0, m + " minutes"])[1];

  // Open a Settings page: reuse an open Settings window when there is one.
  function openSettingsAt(key) {
    const page = document.querySelector(".win .w12s-page");
    if (page) {
      const win = page.closest(".win"); if (win) { win.style.display = ""; win.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); }
      if (key === "power") return navRow(page, "system", T.power);
      if (key === "signin") return navRow(page, "accounts", T.signin);
      if (key === "lockscreen") return renderMine(page, "lockscreen");
    }
    window.SettingsStartPage = key === "lockscreen" ? "lockscreen" : key;
    if (window.WM) WM.open("settings");
  }
  function navTo(page, id) { const root = page.closest(".w12s"); const a = root && root.querySelector(`.w12s-nav-it[data-p="${id}"]`); if (a) a.click(); }
  function navRow(page, section, titles) {
    navTo(page, section);
    const r = [...page.querySelectorAll(".w12s-row")].find((x) => { const t = x.querySelector(".w12s-row-t"); return t && titles.includes(t.textContent.trim()); });
    if (r) r.click();
  }

  // Sub-pages (also reachable via window.SettingsSubs / window.SettingsStartPage).
  const MY_SUBS = {
    lockscreen: { title: "Lock screen", parent: "personal", build: buildLockScreenPage },
  };
  window.SettingsSubs = window.SettingsSubs || {};
  if (!Object.prototype.hasOwnProperty.call(window.SettingsSubs, "lockscreen")) window.SettingsSubs.lockscreen = MY_SUBS.lockscreen;

  function renderMine(page, key) {
    const sp = MY_SUBS[key]; const root = page.closest(".w12s"); if (!sp || !root) return;
    root.querySelectorAll(".w12s-nav-it").forEach((a) => a.classList.toggle("on", a.dataset.p === sp.parent));
    const parentA = root.querySelector(`.w12s-nav-it[data-p="${sp.parent}"]`);
    page.innerHTML = ""; page.scrollTop = 0;
    const head = el(`<h1 class="w12s-title"><a class="w12s-crumb"></a><span class="w12s-crumb-sep">›</span><span class="il-ttl"></span></h1>`);
    const pName = parentA && (parentA.lastElementChild || parentA);
    head.querySelector(".w12s-crumb").textContent = pName ? pName.textContent.trim() : "Settings";
    head.querySelector(".il-ttl").textContent = sp.title;
    head.querySelector(".w12s-crumb").onclick = () => navTo(page, sp.parent);
    page.appendChild(head);
    const box = el(`<div class="w12s-list" data-il-page="${key}"></div>`); page.appendChild(box);
    sp.build(box, () => renderMine(page, key));
  }

  function buildLockScreenPage(h) {
    const wp = (S().desktop && S().desktop.wallpaper) || "default";
    const bg = !wp || wp === "default" ? "url(assets/wall3.jpg) center/cover" : /^(data:|http|assets\/)/.test(wp) ? `url(${wp}) center/cover` : wp;
    const prev = el(`<div class="w12s-card il-ls-card"><div class="il-ls-prev"><div class="il-ls-time"></div><div class="il-ls-date"></div></div><div class="il-ls-tx"><div class="w12s-row-t">Your lock screen</div><div class="w12s-row-s">Uses your desktop background. Press Windows + L or Ctrl + Alt + L to lock.</div><button class="w12s-btn il-ls-lock" type="button">Lock now</button></div></div>`);
    prev.querySelector(".il-ls-prev").style.background = bg;
    const d = new Date();
    prev.querySelector(".il-ls-time").textContent = window.State && State.formatClock ? State.formatClock() : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    prev.querySelector(".il-ls-date").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    prev.querySelector(".il-ls-lock").onclick = () => lockNow("user");
    h.appendChild(prev);
    h.appendChild(el(`<div class="il-s-h">Related settings</div>`));
    const c = cfg();
    h.appendChild(row("timeout", "Screen timeout", "Turn off after " + (screenMin() ? minsLabel(screenMin()) : "never") + " · sleep after " + (sleepMin() ? minsLabel(sleepMin()) : "never"), { onClick: () => openSettingsAt("power") }));
    h.appendChild(row("saver", "Screen saver", c.saver.type === "none" ? "None" : SAVER_NAME(c.saver.type) + " · after " + c.saver.wait + " min" + (c.saver.resumeLock ? " · sign in on resume" : ""), { onClick: () => openSaverDialog() }));
    h.appendChild(row("away", "Sign-in after being away", (SIGNIN.find((x) => x[0] === String(c.signIn)) || SIGNIN[0])[1] + " — change it in Sign-in options", { onClick: () => openSettingsAt("signin") }));
  }

  function powerCard() {
    const box = el(`<div class="il-inject il-power"></div>`);
    const paint = () => {
      const p = cfg().power;
      box.innerHTML = "";
      const head = row("timeout", "Screen, sleep, & hibernate timeouts", batteryKnown() ? (onBattery() ? "On battery" + (battery.level != null ? " (" + Math.round(battery.level * 100) + "%)" : "") : "Plugged in" + (battery.level != null ? " (" + Math.round(battery.level * 100) + "%)" : "")) + " — reported by your device" : "This browser doesn't report battery status");
      head.classList.add("il-exp-head");
      box.appendChild(head);
      const panel = el(`<div class="w12s-panel il-panel-lines"></div>`);
      const set = (k) => (v) => { cfg().power[k] = +v; save(); last = now(); emitUi(); };
      const line = (t, ctl) => { const r = el(`<div class="il-line"><span></span></div>`); r.firstElementChild.textContent = t; r.appendChild(ctl); panel.appendChild(r); };
      if (batteryKnown()) {
        line("On battery power, turn off my screen after", sel(TIMEOUTS, p.screenDC, set("screenDC"), "On battery, screen"));
        line("When plugged in, turn off my screen after", sel(TIMEOUTS, p.screenAC, set("screenAC"), "Plugged in, screen"));
        line("On battery power, put my device to sleep after", sel(TIMEOUTS, p.sleepDC, set("sleepDC"), "On battery, sleep"));
        line("When plugged in, put my device to sleep after", sel(TIMEOUTS, p.sleepAC, set("sleepAC"), "Plugged in, sleep"));
      } else {
        line("Turn off my screen after", sel(TIMEOUTS, p.screenAC, (v) => { cfg().power.screenAC = cfg().power.screenDC = +v; save(); last = now(); emitUi(); }, "Screen"));
        line("Put my device to sleep after", sel(TIMEOUTS, p.sleepAC, (v) => { cfg().power.sleepAC = cfg().power.sleepDC = +v; save(); last = now(); emitUi(); }, "Sleep"));
        panel.appendChild(el(`<div class="w12s-row-s il-why">Your browser can't tell whether this device is plugged in, so one set of timeouts is used all the time.</div>`));
      }
      panel.appendChild(el(`<div class="w12s-row-s il-why">The screen dims shortly before it turns off. Playing a video or recording with Game Bar keeps it on. Waking follows “If you've been away…” in Sign-in options.</div>`));
      const btns = el(`<div class="il-btnrow"><button type="button" class="w12s-btn" data-a="off">Turn off screen now</button><button type="button" class="w12s-btn" data-a="saver">Screen saver settings</button></div>`);
      btns.querySelector('[data-a="off"]').onclick = () => enterOff("user");
      btns.querySelector('[data-a="saver"]').onclick = () => openSaverDialog();
      panel.appendChild(btns);
      box.appendChild(panel);
    };
    paint();
    let alive = false;
    const off = onUi(() => { if (!box.isConnected) { if (alive) off(); return; } alive = true; if (!box.contains(document.activeElement)) paint(); });
    requestAnimationFrame(() => { alive = box.isConnected; });
    return box;
  }

  function signinCards() {
    const box = el(`<div class="il-inject il-signin"><div class="il-s-h">Additional settings</div></div>`);
    const c = cfg();
    const awayRow = row("away", "If you've been away, when should Windows require you to sign in again?", hasCredential() ? "Applies when you wake the PC from sleep or the screen saver, or come back to this tab" : "You don't have a PIN or password yet, so Windows goes straight back to the desktop", {
      ctl: sel(SIGNIN, String(c.signIn), (v) => { cfg().signIn = v; save(); }, "Require sign-in"),
    });
    awayRow.classList.add("il-wrap");
    box.appendChild(awayRow);
    // Dynamic lock
    const dynCard = el(`<div class="w12s-card il-dyn"></div>`);
    box.appendChild(dynCard);
    const paint = () => {
      const cc = cfg().dyn, sup = dynSupport(), st = dynStatus();
      const devs = sup.ok && window.Radios ? Radios.bt.devices() : [];
      dynCard.innerHTML = `<div class="il-dyn-h"><span class="w12s-row-ic">${svgI(ICONS.dyn)}</span><div class="w12s-row-txt"><div class="w12s-row-t">Dynamic lock</div><div class="w12s-row-s">Automatically lock your device when you're away</div></div></div>
        <label class="il-chk il-dyn-chk"><input type="checkbox" ${cc.on && sup.ok ? "checked" : ""} ${sup.ok ? "" : "disabled"}> Allow Windows to automatically lock your device when you're away</label>
        <div class="il-dyn-dev"></div>
        <div class="il-dyn-st il-st-${st.kind}" role="status"></div>
        <a class="w12s-link il-dyn-bt" tabindex="0">Bluetooth &amp; devices</a>`;
      const stEl = dynCard.querySelector(".il-dyn-st");
      stEl.textContent = st.text; stEl.hidden = sup.ok && !cc.on;
      const chk = dynCard.querySelector(".il-dyn-chk input");
      chk.onchange = () => {
        const d = cfg().dyn; d.on = chk.checked;
        if (d.on && !d.id && devs.length) { const pick = devs.find((x) => x.connected) || devs[0]; d.id = pick.id; d.name = pick.name; }
        save(); dyn.armed = false; dyn.goneAt = 0; dynEval(); dynWatchAdverts(); paint();
      };
      const dv = dynCard.querySelector(".il-dyn-dev");
      if (sup.ok && cc.on) {
        if (!devs.length) dv.innerHTML = `<div class="w12s-row-s">No Bluetooth devices are paired with this browser yet. Pair your phone or another device in Bluetooth &amp; devices.</div>`;
        else {
          const s = sel(devs.map((d) => [d.id, d.name + (d.connected ? " (connected)" : "")]), cc.id || "", (v) => { const d = cfg().dyn; const x = devs.find((y) => y.id === v); d.id = v; d.name = x ? x.name : ""; save(); dyn.armed = false; dyn.goneAt = 0; dynEval(); dynWatchAdverts(); paint(); }, "Device for dynamic lock");
          const lab = el(`<label class="il-line"><span>Device</span></label>`); lab.appendChild(s);
          const dev = dynDevice();
          if (dev && !dev.connected) { const b = el(`<button type="button" class="w12s-btn">Connect</button>`); b.onclick = () => { Radios.bt.connect(dev.id); }; lab.appendChild(b); }
          dv.appendChild(lab);
        }
      }
      const bt = dynCard.querySelector(".il-dyn-bt");
      bt.onclick = () => { const pg = dynCard.closest(".w12s-page"); if (pg) navTo(pg, "devices"); };
      bt.onkeydown = (e) => { if (e.key === "Enter") bt.onclick(); };
    };
    paint();
    let alive = false;
    const offR = window.Radios && Radios.on ? Radios.on(() => { if (!box.isConnected) { if (alive) offR(); return; } alive = true; if (!dynCard.contains(document.activeElement)) paint(); }) : null;
    const offU = onUi(() => { if (!box.isConnected) { if (alive) offU(); return; } alive = true; if (!dynCard.contains(document.activeElement)) paint(); });
    requestAnimationFrame(() => { alive = box.isConnected; });
    // While a countdown is running keep its seconds fresh.
    const iv = setInterval(() => { if (!box.isConnected) { clearInterval(iv); return; } if (dyn.goneAt) { const s = dynCard.querySelector(".il-dyn-st"), st = dynStatus(); if (s) s.textContent = st.text; } }, 1000);
    return box;
  }

  function enhance(page) {
    const h1 = page.querySelector("h1.w12s-title"); if (!h1) return;
    const list = page.querySelector(".w12s-list"); if (!list || list.dataset.ilPage || page.querySelector(".il-inject")) return;
    const crumb = h1.querySelector(".w12s-crumb");
    const title = (crumb ? (h1.lastChild && h1.lastChild.textContent) || "" : h1.textContent).trim();
    if (crumb && T.power.includes(title)) {
      const card = powerCard();
      const firstRow = list.firstElementChild;
      if (firstRow && firstRow.nextSibling) list.insertBefore(card, firstRow.nextSibling); else list.appendChild(card);
    } else if (crumb && T.signin.includes(title)) {
      list.appendChild(signinCards());
    } else if (!crumb && T.personal.includes(title)) {
      const r = row("lockscreen", "Lock screen", "Lock screen image, screen saver, screen timeout", { onClick: () => renderMine(page, "lockscreen") });
      r.classList.add("il-inject");
      const rows = list.querySelectorAll(":scope > .w12s-row");
      if (rows[2]) list.insertBefore(r, rows[2].nextSibling); else list.appendChild(r);
    }
  }
  function hookSettingsWin(win) {
    const page = win.querySelector && win.querySelector(".w12s-page");
    if (!page || page.__il) return;
    page.__il = true;
    new MutationObserver(() => enhance(page)).observe(page, { childList: true });
    enhance(page);
  }

  // ====================================================================
  //  start
  // ====================================================================
  function start() { cfg(); watchScreen(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  window.IdleLock = {
    config: cfg, SAVERS, lockNow: () => lockNow("api"),
    startSaver: (type, isPreview) => startSaver(type || cfg().saver.type, !!isPreview),
    preview: (type) => startSaver(type || cfg().saver.type, true),
    screenOff: () => enterOff("user"), sleep: () => enterSleep("user"),
    wake: () => wakeFrom(null),
    state: () => state, idleMs: () => now() - last,
    openScreenSaverSettings: openSaverDialog, openSettings: openSettingsAt,
    dynamicLock: { status: dynStatus, supported: dynSupport, refresh: dynEval },
    _photoNodes: photoNodes,
  };
})();
