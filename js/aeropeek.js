/* AeroPeek — classic Windows "Aero Shake" + "Peek / Show desktop" on top of the
   window manager (js/wm.js) and WinX shell (js/winx.js). Self-contained; adds only
   namespaced `ap-` taskbar bits so it never clashes with the shell.

     Aero Shake   grab a window's titlebar and shake it quickly left/right -> minimize
                  every OTHER visible window; shake again -> restore exactly those.
                  Mouse + touch (pointer events). Only clear shakes trigger, so normal
                  dragging / edge-snapping is never disturbed.

     Show desktop a thin sliver at the far-right end of the taskbar toggles minimize-all /
                  restore-all (remembers what it minimized). Hovering it "peeks": open
                  windows go outline-only so the desktop shows through.

     Keyboard     Win+D  / Ctrl+Alt+D   toggle show desktop
                  Win+,  / Ctrl+Alt+,   peek while held (restore on release)

   Public: window.AeroPeek = { showDesktop, peek }.
*/
(function () {
  "use strict";

  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  const scr = () => document.getElementById("screen");
  const wins = () => (window.WM && WM.windows ? WM.windows() : []);
  const isMin = (e) => !e.win || e.win.style.display === "none";
  const offDesk = (e) => e.win && e.win.classList.contains("wx-offdesk"); // lives on another virtual desktop
  function desktopReady() { return !!document.querySelector(".desktop") && !document.querySelector(".lock-screen, .boot-layer, .wsetup-screen"); }
  function kiosk() { return document.body.classList.contains("kiosk-mode"); }
  function reduceMotion() {
    if (document.body.classList.contains("a11y-reduce-motion")) return true;
    try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }
  function isEditable(t) {
    if (!t || !t.tagName) return false;
    const tag = t.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable === true;
  }

  // Windows this agent may minimize: visible, on the active desktop, not kiosk-hidden.
  function visibleWindows() { return wins().filter((e) => e.win && e.win.isConnected && !isMin(e) && !offDesk(e)); }
  function minimizeWin(e) { if (e && e.win) { e.win.style.display = "none"; } }
  function restoreWin(e) { if (e && e.win && e.win.isConnected) { e.win.style.display = ""; } }
  function refresh() { if (window.WM && WM.refreshTaskbarActive) try { WM.refreshTaskbarActive(); } catch (_) {} }

  // =====================================================================
  //  Aero Shake
  // =====================================================================
  // Windows minimized by the LAST shake (so the next shake restores exactly those).
  let shakeStash = null;          // array of entries, or null when nothing stashed

  function doShake(heldEntry) {
    if (shakeStash && shakeStash.length) {
      // Second shake -> restore exactly what we hid.
      shakeStash.forEach(restoreWin);
      shakeStash = null;
      refresh();
      return;
    }
    // First shake -> minimize every other visible window.
    const others = visibleWindows().filter((e) => e !== heldEntry);
    if (!others.length) return;
    others.forEach(minimizeWin);
    shakeStash = others;
    refresh();
  }

  // --- shake gesture detector (one active pointer at a time) ---
  const MIN_STEP = 5;     // px of x-movement below which we treat as noise
  const MIN_SWING = 45;   // a direction change only counts after this much travel
  const WINDOW_MS = 900;  // reversals must fall inside this sliding window
  const NEEDED = 3;       // this many fast reversals = a shake
  let sess = null;        // { pid, winEl, entry, lastX, lastDir, swingStartX, reversals[] }

  function titlebarOf(t) {
    if (!t || !t.closest) return null;
    if (t.closest(".win-controls")) return null; // don't treat min/max/close as a drag handle
    return t.closest(".win-titlebar");
  }

  document.addEventListener("pointerdown", (ev) => {
    if (ev.button) return; // primary button / touch / pen only
    if (!desktopReady()) return;
    const tb = titlebarOf(ev.target);
    if (!tb) return;
    const winEl = tb.closest(".win");
    const entry = winEl && window.WM && WM.entryFor ? WM.entryFor(winEl) : null;
    if (!winEl || !entry) return;
    sess = { pid: ev.pointerId, winEl, entry, lastX: ev.clientX, lastDir: 0, swingStartX: ev.clientX, reversals: [], fired: false };
  }, true);

  document.addEventListener("pointermove", (ev) => {
    if (!sess || sess.fired || ev.pointerId !== sess.pid) return;
    const x = ev.clientX;
    const dx = x - sess.lastX;
    if (Math.abs(dx) < MIN_STEP) return;
    const dir = dx > 0 ? 1 : -1;
    sess.lastX = x;
    if (sess.lastDir === 0) { sess.lastDir = dir; sess.swingStartX = x; return; }
    if (dir === sess.lastDir) return;
    // Direction reversed — only count it if the preceding swing was big enough.
    if (Math.abs(x - sess.swingStartX) >= MIN_SWING) {
      const now = Date.now();
      sess.reversals.push(now);
      sess.reversals = sess.reversals.filter((t) => now - t <= WINDOW_MS);
      sess.swingStartX = x;
      sess.lastDir = dir;
      if (sess.reversals.length >= NEEDED) {
        // One toggle per grab: a single clear shake acts once; shake again (a fresh
        // grab) to restore. This keeps a long continuous wobble from twitch-toggling.
        sess.fired = true;
        sess.reversals = [];
        doShake(sess.entry);
      }
    } else {
      // small jitter: adopt new direction without counting it
      sess.lastDir = dir;
      sess.swingStartX = x;
    }
  }, true);

  function endSess(ev) { if (sess && (!ev || ev.pointerId === sess.pid)) sess = null; }
  document.addEventListener("pointerup", endSess, true);
  document.addEventListener("pointercancel", endSess, true);

  // =====================================================================
  //  Peek / Show desktop
  // =====================================================================
  let sdStash = null;   // windows minimized by Show desktop (toggle target)

  function showDesktop() {
    if (!desktopReady()) return;
    if (sdStash && sdStash.length) {
      sdStash.forEach(restoreWin);
      sdStash = null;
      refresh();
      return;
    }
    const vis = visibleWindows();
    if (!vis.length) { sdStash = null; return; } // nothing to hide, nothing stashed
    vis.forEach(minimizeWin);
    sdStash = vis;
    refresh();
    endPeek(); // a real minimize supersedes any peek-through
  }

  let peeking = false;
  function peek(on) {
    on = !!on;
    if (!desktopReady()) { on = false; }
    if (on === peeking) return;
    peeking = on;
    document.body.classList.toggle("ap-peek", on);
    document.body.classList.toggle("ap-peek-instant", on && reduceMotion());
  }
  function endPeek() { if (peeking) peek(false); }

  // =====================================================================
  //  Taskbar "Show desktop" sliver (far-right end, after the tray / clock)
  // =====================================================================
  function buildSliver() {
    const b = el(`<button class="ap-showdesktop" type="button" title="Show desktop" aria-label="Show desktop"><span class="ap-sd-grip"></span></button>`);
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); endPeek(); showDesktop(); });
    // Hover peeks (mouse only — touch has no hover, so a tap just toggles).
    b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") peek(true); });
    b.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") endPeek(); });
    b.addEventListener("pointercancel", endPeek);
    return b;
  }

  function ensureSliver() {
    const tb = window.WM && WM.taskbarEl ? WM.taskbarEl() : document.querySelector(".taskbar");
    if (!tb) return;
    if (tb.querySelector(".ap-showdesktop")) return;
    tb.appendChild(buildSliver());
  }

  // The taskbar is rebuilt by WM.buildDesktop(); re-add the sliver whenever it reappears.
  function watchTaskbar() {
    const root = scr();
    if (!root) { setTimeout(watchTaskbar, 300); return; }
    try {
      const mo = new MutationObserver(() => ensureSliver());
      mo.observe(root, { childList: true, subtree: true });
    } catch (_) {}
    ensureSliver();
  }

  // =====================================================================
  //  Keyboard: Win+D / Ctrl+Alt+D (toggle), Win+, / Ctrl+Alt+, (hold to peek)
  // =====================================================================
  let kbPeek = false; // peek currently held open by the keyboard
  window.addEventListener("keydown", (e) => {
    if (!desktopReady() || kiosk()) return;
    if (e.repeat) { if (kbPeek) e.preventDefault(); return; }
    if (isEditable(e.target)) return;
    const k = (e.key || "").toLowerCase();
    const win = e.metaKey && !e.ctrlKey && !e.altKey;        // Windows key alone
    const ctrlAlt = e.ctrlKey && e.altKey && !e.metaKey;     // no-Win-key alternative

    if ((win && k === "d") || (ctrlAlt && k === "d")) {
      e.preventDefault(); e.stopPropagation();
      endPeek(); kbPeek = false; showDesktop();
      return;
    }
    if ((win && (k === "," || e.code === "Comma")) || (ctrlAlt && (k === "," || e.code === "Comma"))) {
      e.preventDefault(); e.stopPropagation();
      kbPeek = true; peek(true);
      return;
    }
  }, true);

  window.addEventListener("keyup", (e) => {
    if (!kbPeek) return;
    const k = (e.key || "").toLowerCase();
    // Release when the comma, the Win key, or a modifier of the chord lifts.
    if (k === "," || e.code === "Comma" || k === "meta" || k === "control" || k === "alt" || (!e.metaKey && !e.ctrlKey)) {
      kbPeek = false; endPeek();
    }
  }, true);
  window.addEventListener("blur", () => { if (kbPeek) { kbPeek = false; endPeek(); } });

  // =====================================================================
  //  Boot
  // =====================================================================
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchTaskbar);
  } else {
    watchTaskbar();
  }

  window.AeroPeek = { showDesktop, peek };
})();
