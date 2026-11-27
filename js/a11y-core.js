/* =====================================================================
   Windows 11 Accessibility for Windows 12 — core (js/a11y-core.js)

   Load EARLY: right after js/state.js (before js/icons.js), followed by
   js/a11y-vision.js, so contrast themes, color filters and pointer styles
   are on <html> before the boot screen paints.
   Late modules (after js/idlelock.js, before js/main.js):
     js/a11y-narrator.js · js/a11y-keys.js · js/a11y-osk.js
   Styles: css/a11y.css (every class prefixed ax-), in <head>.

   What this file does
   - Settings store: State.data.appData.a11y (+ State.save()). The legacy
     "Accessibility mode" keys {on, contrast, bigText, reduceMotion} used by
     js/main.js, js/settings12.js, js/regedit.js (HighContrast\Flags) and
     js/systools.js are left exactly as they are; new features live in
     sub-objects (hc, cf, mag, nar, osk, sticky, filter, toggle, mk, ptr, caret, cap).
   - The keyboard pipeline: ONE window capture keydown/keyup listener,
     registered before any other module, that runs the hooks of Filter Keys,
     Sticky Keys, Toggle Keys, Mouse Keys, the accessibility shortcuts and
     Narrator. It only ever sees keys typed inside this page.
   - Floating UI layer (#ax-layer, a child of <html>, not <body>) so the
     magnifier (which scales <body>) never scales its own toolbar / the OSK.
     Pointer events inside the layer are handled here and never reach the
     OS's "click outside closes the menu" listeners (Start, flyouts).
   - Shortcuts (all only inside this page):
       Ctrl+Alt+U  (Win+U)            Accessibility settings
       Ctrl+Alt+C  (Win+Ctrl+C)       color filters on/off
       Ctrl+Alt+H  (Left Alt+Left Shift+PrtScn)  contrast theme on/off
       Ctrl+Alt+=  / Ctrl+Alt+-  (Win+Plus / Win+Minus)  Magnifier zoom in / out
       Ctrl+Alt+Esc (Win+Esc)         Magnifier off
       Ctrl+Alt+M / F / D / I         Magnifier: cycle view / full screen / docked / invert (while on)
       Ctrl+Alt+Enter (Win+Ctrl+Enter) Narrator on/off
       Ctrl+Alt+O  (Win+Ctrl+O)       On-screen keyboard
       Shift x5 Sticky Keys · hold Right Shift 8 s Filter Keys · hold Num Lock 5 s Toggle Keys ·
       Left Alt+Left Shift+Num Lock Mouse Keys
     Win-key versions only on non-Apple keyboards (⌘ belongs to the browser on iPad / Mac).
   - Settings: the Accessibility page is rebuilt like Windows 11 (Vision /
     Hearing / Interaction) by a MutationObserver (js/settings12.js is not
     edited); each feature page is a window.SettingsSubs entry.
   - Quick Settings "Accessibility" tile, lock-screen accessibility button.
   ===================================================================== */
(function () {
  "use strict";
  if (window.A11y) return;
  const S = () => window.State && State.data;
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || (/Macintosh/.test(navigator.userAgent) && "ontouchend" in document);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // =====================================================================
  //  SETTINGS STORE
  // =====================================================================
  const DEF = {
    hc: { on: false, theme: "aquatic", customs: {} },
    cf: { on: false, type: "grayscale", intensity: 100, boost: 50, shortcut: true },
    mag: { on: false, zoom: 200, inc: 100, view: "full", mouse: true, focus: true, caret: true, invert: false, smooth: true, lensW: 420, lensH: 240, autostart: false, collapsed: false },
    nar: { on: false, voice: "", rate: 10, pitch: 10, volume: 100, mouse: true, touch: true, box: true, caption: true, notif: true, echoChars: true, echoWords: false, verbosity: 3, autostart: false, hints: true, warn: true },
    osk: { numpad: false, predict: true, sound: true, x: null, y: null, u: 0 },
    sticky: { on: false, shortcut: true, lock: true, offTwo: true, sound: true, tray: true },
    filter: { on: false, shortcut: true, bounce: false, bounceMs: 500, slow: false, slowMs: 1000, repeat: false, repeatDelay: 1000, repeatRate: 500, beep: true, tray: true },
    toggle: { on: false, shortcut: true },
    mk: { on: false, shortcut: true, speed: 50, accel: 50, ctrl: true, numlock: true, tray: true },
    ptr: { size: 1, style: "white", color: "#c239b3", touch: true, dark: false },
    caret: { ind: false, size: 2, color: "#c239b3", thick: 1 },
    cap: { style: "default" },
    keys: { shortcuts: true, underline: false },
  };
  function cfg() {
    const d = S(); if (!d) return JSON.parse(JSON.stringify(DEF));
    if (!d.appData) d.appData = {};
    const a = d.appData.a11y || (d.appData.a11y = {});
    for (const k in DEF) {
      if (!a[k] || typeof a[k] !== "object") a[k] = JSON.parse(JSON.stringify(DEF[k]));
      else for (const j in DEF[k]) if (!(j in a[k])) a[k][j] = JSON.parse(JSON.stringify(DEF[k][j]));
    }
    return a;
  }
  function get(path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), cfg()); }
  let saveT = 0;
  function save(now) { clearTimeout(saveT); if (now) { try { State.save(); } catch (_) {} } else saveT = setTimeout(() => { try { State.save(); } catch (_) {} }, 120); }
  function set(path, val, opts) {
    const parts = path.split("."), last = parts.pop();
    const o = parts.reduce((x, k) => (x[k] = x[k] && typeof x[k] === "object" ? x[k] : {}), cfg());
    if (o[last] === val && !(opts && opts.force)) return;
    o[last] = val; save(opts && opts.now);
    emit("change", path, val);
  }

  // ---- events ----
  const LS = {};
  function on(evt, fn) { (LS[evt] = LS[evt] || []).push(fn); return () => { LS[evt] = (LS[evt] || []).filter((f) => f !== fn); }; }
  function emit(evt, ...args) { (LS[evt] || []).slice().forEach((f) => { try { f(...args); } catch (e) { console.error("[a11y]", evt, e); } }); }

  // =====================================================================
  //  FLOATING UI LAYER (child of <html>, outside <body>)
  // =====================================================================
  let layerEl = null;
  function layer() {
    if (layerEl && layerEl.isConnected) return layerEl;
    layerEl = document.getElementById("ax-layer") || el(`<div id="ax-layer" class="ax-ui"></div>`);
    document.documentElement.appendChild(layerEl);
    return layerEl;
  }
  // Pointer events on our UI are dispatched here (window capture) and then stopped,
  // so the OS's document-level "outside click closes it" handlers never see them.
  // Elements register handlers with A11y.ui(el, type, fn).
  const UI_TYPES = ["pointerdown", "pointerup", "pointermove", "pointercancel", "mousedown", "mouseup", "click", "dblclick", "contextmenu", "touchstart", "touchend", "touchmove"];
  function ui(node, type, fn) { (node.__ax = node.__ax || {}); (node.__ax[type] = node.__ax[type] || []).push(fn); return node; }
  UI_TYPES.forEach((type) => window.addEventListener(type, (e) => {
    const t = e.target; if (!t || !t.closest || !layerEl || !layerEl.contains(t)) return;
    let n = t;
    while (n && n !== layerEl.parentNode) {
      if (n.__ax && n.__ax[type]) { for (const f of n.__ax[type]) { try { f.call(n, e); } catch (err) { console.error("[a11y ui]", err); } } if (e.__axStop) break; }
      n = n.parentNode;
    }
    e.stopPropagation();
  }, { capture: true, passive: false }));
  // Global pointer tracking (for magnifier, mouse keys, narrator): last real pointer position.
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, type: "mouse" };
  window.addEventListener("pointermove", (e) => { if (e.isTrusted) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.type = e.pointerType; } }, true);
  window.addEventListener("pointerdown", (e) => { if (e.isTrusted) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.type = e.pointerType; } }, true);

  // ---- toast ----
  let toastEl = null, toastT = 0;
  function toast(msg, ms) {
    if (!toastEl || !toastEl.isConnected) { toastEl = el(`<div class="ax-toast" role="status" aria-live="polite"></div>`); layer().appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.style.display = "";
    clearTimeout(toastT); toastT = setTimeout(() => { if (toastEl) toastEl.style.display = "none"; }, ms || 2200);
    emit("announce", msg);
  }
  // ---- prompt (Yes / No dialog like the Windows Sticky Keys prompt) ----
  function prompt(o) {
    const m = el(`<div class="ax-prompt-mask"><div class="ax-prompt" role="dialog" aria-modal="true"><div class="ax-prompt-h"></div><div class="ax-prompt-b"></div><div class="ax-prompt-f"><button class="ax-primary" data-a="yes"></button><button data-a="no"></button></div></div></div>`);
    m.querySelector(".ax-prompt-h").textContent = o.title || "Accessibility";
    m.querySelector(".ax-prompt-b").innerHTML = o.html || esc(o.body || "");
    m.querySelector('[data-a="yes"]').textContent = o.yes || "Yes";
    m.querySelector('[data-a="no"]').textContent = o.no || "No";
    const close = (r) => { m.remove(); document.removeEventListener("keydown", kd, true); if (r === true && o.onYes) o.onYes(); if (r === false && o.onNo) o.onNo(); };
    ui(m, "click", (e) => { const b = e.target.closest("button,a"); if (b && b.dataset.a) close(b.dataset.a === "yes"); else if (b && b.dataset.link && o.onLink) { close(null); o.onLink(); } });
    const kd = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(false); } };
    document.addEventListener("keydown", kd, true);
    layer().appendChild(m);
    setTimeout(() => { const y = m.querySelector('[data-a="yes"]'); if (y) y.focus({ preventScroll: true }); }, 30);
    emit("announce", (o.title || "") + ". " + m.querySelector(".ax-prompt-b").textContent);
    return m;
  }
  // ---- sounds (WebAudio — the AudioContext is resumed by the first tap / key) ----
  let actx = null;
  function audio() {
    try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (_) { actx = null; }
    return actx;
  }
  ["pointerdown", "keydown", "touchend"].forEach((t) => window.addEventListener(t, () => { if (actx && actx.state === "suspended") { try { actx.resume(); } catch (_) {} } }, { capture: true, passive: true }));
  function beep(freqs, ms, vol) {
    const c = audio(); if (!c) return;
    const qv = S() && S().appData && S().appData.quickSettings ? S().appData.quickSettings.volume : 55;
    const g0 = clamp((vol == null ? 0.18 : vol) * (qv == null ? 1 : qv / 70), 0, 0.4); if (!g0) return;
    let t = c.currentTime + 0.005;
    (Array.isArray(freqs) ? freqs : [freqs]).forEach((f) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(g0, t + 0.008);
      const d = Math.max(0.02, (ms || 90) / 1000);
      g.gain.setValueAtTime(g0, t + Math.max(0.009, d - 0.012)); g.gain.linearRampToValueAtTime(0, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
      t += d;
    });
  }

  // =====================================================================
  //  KEYBOARD PIPELINE — first window capture listener in the page
  // =====================================================================
  // Hooks: fn(e) → true when the key was consumed (then it's prevented + stopped).
  // { trustedOnly } hooks ignore our own synthetic events (from the OSK / Sticky Keys).
  const hooks = [];
  function keyHook(fn, opts) { hooks.push({ fn, order: (opts && opts.order) || 50, trustedOnly: !!(opts && opts.trustedOnly) }); hooks.sort((a, b) => a.order - b.order); }
  function onKey(e) {
    for (const h of hooks) {
      if (h.trustedOnly && !e.isTrusted) continue;
      let r = false; try { r = h.fn(e); } catch (err) { console.error("[a11y key]", err); }
      if (r === true) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    }
  }
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKey, true);
  // Actions other modules fill in (shortcuts call them).
  const actions = {};
  function act(name, ...a) { if (typeof actions[name] === "function") return actions[name](...a); }

  // ---- shortcuts (order 60: after Filter/Sticky/Mouse keys, before Narrator) ----
  keyHook((e) => {
    if (e.type !== "keydown" || e.repeat && !/Equal|Minus|NumpadAdd|NumpadSubtract/.test(e.code)) return false;
    if (!cfg().keys.shortcuts) return false;
    const code = e.code || "", k = e.key || "";
    const ca = e.ctrlKey && e.altKey && !e.metaKey;
    const win = e.metaKey && !isApple;
    const ctrlWin = win && e.ctrlKey && !e.altKey;
    const winOnly = win && !e.ctrlKey && !e.altKey;
    // Accessibility settings: Ctrl+Alt+U / Win+U
    if ((ca && !e.shiftKey && code === "KeyU") || (winOnly && !e.shiftKey && (code === "KeyU" || k === "u"))) { openHub(); return true; }
    // Color filters: Ctrl+Alt+C / Win+Ctrl+C
    if ((ca && !e.shiftKey && code === "KeyC") || (ctrlWin && code === "KeyC")) { if (cfg().cf.shortcut) { act("toggleFilters"); return true; } toast("Turn on the color filters shortcut in Settings › Accessibility › Color filters"); return true; }
    // Contrast themes: Ctrl+Alt+H / Left Alt+Left Shift+Print Screen
    if ((ca && !e.shiftKey && code === "KeyH") || (e.altKey && e.shiftKey && !e.ctrlKey && (code === "PrintScreen" || k === "PrintScreen"))) { act("toggleContrast", true); return true; }
    // Magnifier: Ctrl+Alt+= / - , Win+Plus / Minus, Ctrl+Alt+Esc / Win+Esc
    const plus = code === "Equal" || code === "NumpadAdd" || k === "+" || k === "=";
    const minus = code === "Minus" || code === "NumpadSubtract" || k === "-" || k === "_";
    if ((ca || winOnly) && plus) { act("magZoom", 1); return true; }
    if ((ca || winOnly) && minus) { act("magZoom", -1); return true; }
    if ((ca || winOnly) && (k === "Escape" || code === "Escape")) { if (cfg().mag.on) { act("magOff"); return true; } return false; }
    if (ca && !e.shiftKey && cfg().mag.on) {
      if (code === "KeyM") { act("magView", "next"); return true; }
      if (code === "KeyF") { act("magView", "full"); return true; }
      if (code === "KeyD") { act("magView", "dock"); return true; }
      if (code === "KeyI") { act("magInvert"); return true; }
    }
    // Narrator: Ctrl+Alt+Enter / Win+Ctrl+Enter
    if ((ca && !e.shiftKey && (code === "Enter" || code === "NumpadEnter")) || (ctrlWin && (code === "Enter" || k === "Enter"))) { act("toggleNarrator"); return true; }
    // On-screen keyboard: Ctrl+Alt+O / Win+Ctrl+O
    if ((ca && !e.shiftKey && code === "KeyO") || (ctrlWin && code === "KeyO")) { act("toggleOSK"); return true; }
    return false;
  }, { order: 60 });

  // =====================================================================
  //  SHELL HOOKS: new top-level things in #screen (taskbar, Quick Settings,
  //  lock screen, windows) → listeners registered with A11y.onShell(fn)
  // =====================================================================
  // Our UI sits outside <body>: mirror body.dark onto <html> (html.ax-dark) for it.
  function watchDark() {
    const b = document.body; if (!b || b.__axDark) return; b.__axDark = true;
    const sync = () => document.documentElement.classList.toggle("ax-dark", b.classList.contains("dark"));
    new MutationObserver(sync).observe(b, { attributes: true, attributeFilter: ["class"] }); sync();
  }
  function watchShell() {
    watchDark();
    const scr = document.getElementById("screen"); if (!scr || scr.__axObs) return;
    scr.__axObs = true;
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) emit("shell", n); }))).observe(scr, { childList: true });
    [...scr.children].forEach((n) => emit("shell", n));
  }

  // =====================================================================
  //  SETTINGS PAGES (rendered with js/settings12.js's own classes)
  // =====================================================================
  const PAGES = {};      // key → { title, ic, desc, section, order, toggle, build }
  const SVG_IC = {
    text: '<path d="M4 7V5h11v2M9.5 5v14M7 19h5"/><path d="M14 12v-1.5h7V12M17.5 10.5V19M16 19h3"/>',
    vfx: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z"/><path d="M18 15l.9 2.1 2.1.9-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
    pointer: '<path d="M6 3l12 9.5-5.4.7 3.1 6.3-2.4 1.2-3.1-6.4L6 18z"/>',
    caret: '<path d="M8 4h3M13 4h3M12 4v16M8 20h3M13 20h3"/><path d="M5 9l2 3-2 3M19 9l-2 3 2 3"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M8 10.5h5M10.5 8v5"/>',
    filters: '<circle cx="9" cy="9" r="5.5"/><circle cx="15" cy="9" r="5.5"/><circle cx="12" cy="15" r="5.5"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18z" fill="url(#w12s-g)" stroke="none"/>',
    narrator: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    audio: '<path d="M4 10v4h3l4 3.5v-11L7 10z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18 12h3M19.5 10.5v3"/>',
    cc: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 10a2.2 2.2 0 1 0 0 4M17 10a2.2 2.2 0 1 0 0 4"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h1M9.5 10h1M13 10h1M16.5 10h1M6 13.5h1M17 13.5h1M9 14h6"/>',
    mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v6M6 9h12"/>',
    speech: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    a11y: '<circle cx="12" cy="4.6" r="1.8"/><path d="M5 8.5l7 1.6 7-1.6M12 10.1v4.4M12 14.5l-3 6M12 14.5l3 6"/>',
    more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  };
  const ic = (k, size) => `<svg class="w12s-svg" viewBox="0 0 24 24" width="${size || 20}" height="${size || 20}" fill="none" stroke="url(#w12s-g)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG_IC[k] || SVG_IC.a11y}</svg>`;
  const CHEV = `<span class="w12s-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span>`;
  const CHEV_DOWN = CHEV.replace('w12s-chev"', 'w12s-chev down"');

  // Controls stay in sync when a setting changes elsewhere (shortcut, Quick Settings).
  const syncs = new Set();
  on("change", () => { syncs.forEach((s) => { if (!s.el.isConnected) { syncs.delete(s); return; } try { s.fn(); } catch (_) {} }); });
  const stop = (n) => { n.addEventListener("click", (e) => e.stopPropagation()); n.addEventListener("keydown", (e) => e.stopPropagation()); return n; };
  const H = {
    el, esc, ic,
    toggle(getV, setV, label) {
      const t = el(`<label class="w12s-sw"><input type="checkbox" role="switch"><span></span></label>`), i = t.querySelector("input");
      if (label) i.setAttribute("aria-label", label);
      i.checked = !!getV(); i.onchange = () => setV(i.checked);
      syncs.add({ el: t, fn: () => { i.checked = !!getV(); } });
      return stop(t);
    },
    slider(min, max, step, getV, setV, opts) {
      opts = opts || {};
      const w = el(`<span class="ax-sl" style="display:inline-flex;align-items:center;gap:10px"><input class="w12s-range" type="range" min="${min}" max="${max}" step="${step}"><output style="min-width:3.2em;text-align:right;font-variant-numeric:tabular-nums"></output></span>`);
      const r = w.querySelector("input"), o = w.querySelector("output");
      if (opts.label) r.setAttribute("aria-label", opts.label);
      const fmt = opts.fmt || ((v) => String(v));
      const paint = () => { r.value = getV(); o.textContent = fmt(+r.value); r.setAttribute("aria-valuetext", fmt(+r.value)); };
      paint();
      r.oninput = () => { o.textContent = fmt(+r.value); r.setAttribute("aria-valuetext", fmt(+r.value)); if (!opts.onRelease) setV(+r.value); };
      r.onchange = () => setV(+r.value);
      syncs.add({ el: w, fn: () => { if (document.activeElement !== r) paint(); } });
      return stop(w);
    },
    select(pairs, getV, setV, label) {
      const s = el(`<select class="w12s-select">${pairs.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select>`);
      if (label) s.setAttribute("aria-label", label);
      s.value = String(getV()); s.onchange = () => setV(s.value);
      syncs.add({ el: s, fn: () => { if (document.activeElement !== s) s.value = String(getV()); } });
      return stop(s);
    },
    check(label, getV, setV) {
      const l = el(`<label><input type="checkbox"><span></span></label>`), i = l.querySelector("input");
      l.querySelector("span").textContent = label; i.checked = !!getV(); i.onchange = () => setV(i.checked);
      syncs.add({ el: l, fn: () => { i.checked = !!getV(); } });
      return l;
    },
    button(label, fn, accent) { const b = el(`<button class="w12s-btn${accent ? " w12s-btn-accent" : ""}"></button>`); b.textContent = label; b.onclick = (e) => { e.stopPropagation(); fn(e); }; return b; },
    head(text) { const h = el(`<div class="ax-s-h" role="heading" aria-level="2"></div>`); h.textContent = text; return h; },
    note(html) { return el(`<div class="ax-s-note">${html}</div>`); },
    // A Settings row. o: { ic, t, s, ctl (element), sub (page key), act (fn), expand (fn(panel)) }
    row(o) {
      const click = !!(o.sub || o.act || o.expand);
      const r = el(`<div class="w12s-row ${click ? "w12s-click" : "w12s-row-static"} ax-row" tabindex="${click ? 0 : -1}" ${click ? 'role="button"' : ""}>${o.ic ? `<span class="w12s-row-ic">${ic(o.ic)}</span>` : ""}<div class="w12s-row-txt"><div class="w12s-row-t"></div><div class="w12s-row-s"></div></div><div class="w12s-row-ctl"></div>${o.sub || o.act ? CHEV : o.expand ? CHEV_DOWN : ""}</div>`);
      r.querySelector(".w12s-row-t").textContent = o.t;
      const sEl = r.querySelector(".w12s-row-s");
      const paintS = () => { const s = typeof o.s === "function" ? o.s() : o.s; sEl.textContent = s || ""; sEl.style.display = s ? "" : "none"; };
      paintS(); if (typeof o.s === "function") syncs.add({ el: r, fn: paintS });
      if (o.ctl) r.querySelector(".w12s-row-ctl").appendChild(o.ctl);
      let panel = null;
      const run = () => {
        if (o.sub) openPage(o.sub, r.closest(".w12s-page"));
        else if (o.act) o.act();
        else if (o.expand) {
          if (panel) { panel.remove(); panel = null; r.classList.remove("open"); r.setAttribute("aria-expanded", "false"); return; }
          panel = el(`<div class="ax-s-opts"></div>`); o.expand(panel); r.after(panel); r.classList.add("open"); r.setAttribute("aria-expanded", "true");
        }
      };
      if (click) { r.onclick = run; r.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === r) { e.preventDefault(); run(); } }); }
      if (o.expand) { r.setAttribute("aria-expanded", "false"); if (o.open) setTimeout(run, 0); }
      return r;
    },
    line(label, ctl) { const l = el(`<div class="ax-line"><span></span></div>`); l.firstElementChild.textContent = label; if (ctl) l.appendChild(ctl); return l; },
    card(inner) { return el(`<div class="w12s-card">${inner || ""}</div>`); },
  };

  function page(key, o) {
    PAGES[key] = Object.assign({ key }, o);
    window.SettingsSubs = window.SettingsSubs || {};
    window.SettingsSubs[key] = { title: o.title, parent: "access", build: (h, redraw) => buildInto(key, h, redraw) };
  }
  // Highlight "Accessibility" in Settings' left nav (settings12 re-marks its own
  // current section one frame after opening a sub-page at start-up).
  function markAccess(pg) {
    const root = pg && pg.closest(".w12s"); if (!root) return;
    root.querySelectorAll(".w12s-nav-it").forEach((a) => a.classList.toggle("on", a.dataset.p === "access"));
    const a = root.querySelector('.w12s-nav-it[data-p="access"]'), f = root.querySelector(".w12s-focus");
    if (a && f) { f.style.top = (a.offsetTop + a.offsetHeight / 2 - 9) + "px"; f.style.opacity = "1"; }
  }
  function buildInto(key, box, redraw) {
    const p = PAGES[key]; if (!p) return;
    [0, 60, 200].forEach((ms) => setTimeout(() => { const pg = box.closest(".w12s-page"); if (pg && pg.contains(box)) markAccess(pg); }, ms));
    box.dataset.axPage = key; box.classList.add("ax-s-panel");
    p.build(box, H, redraw || (() => openPage(key)));
  }
  const settingsPage = () => { const ps = [...document.querySelectorAll(".win .w12s-page")]; return ps.find((p) => p.closest(".win").style.display !== "none") || ps[0] || null; };
  function focusWin(pg) { const win = pg && pg.closest(".win"); if (win && window.WM && WM.focusWindow) WM.focusWindow(win); }
  // Open one of our pages inside an existing Settings window (or a new one).
  function openPage(key, pg) {
    pg = pg || settingsPage();
    if (!pg) { window.SettingsStartPage = key; if (window.WM) WM.open("settings"); return; }
    focusWin(pg);
    const root = pg.closest(".w12s"), p = PAGES[key]; if (!p) return;
    const s = root.querySelector(".w12s-search input"); if (s) s.value = "";
    pg.innerHTML = ""; pg.scrollTop = 0;
    const head = el(`<h1 class="w12s-title"><a class="w12s-crumb" tabindex="0" role="link">Accessibility</a><span class="w12s-crumb-sep">›</span><span class="ax-ttl"></span></h1>`);
    head.querySelector(".ax-ttl").textContent = p.title;
    const crumb = head.querySelector(".w12s-crumb"); crumb.onclick = () => openHub(pg); crumb.onkeydown = (e) => { if (e.key === "Enter") openHub(pg); };
    pg.appendChild(head);
    const box = el(`<div class="w12s-list"></div>`); pg.appendChild(box);
    buildInto(key, box, () => openPage(key, pg));
    emit("page", key);
  }
  function openHub(pg) {
    pg = pg && pg.isConnected ? pg : settingsPage();
    if (!pg) { window.SettingsStartPage = "access"; if (window.WM) WM.open("settings"); return; }
    focusWin(pg);
    const a = pg.closest(".w12s").querySelector('.w12s-nav-it[data-p="access"]'); if (a) a.click();
  }

  // ---- The Accessibility hub (settings12's "access" page, rebuilt like Windows 11) ----
  const SECTIONS = [["vision", "Vision"], ["hearing", "Hearing"], ["interaction", "Interaction"]];
  function enhanceHub(pg) {
    const h1 = pg.querySelector(":scope > h1.w12s-title"), list = pg.querySelector(":scope > .w12s-list");
    if (!h1 || !list || h1.querySelector(".w12s-crumb") || list.dataset.axHub || list.dataset.axPage) return;
    if (h1.textContent.trim() !== "Accessibility") return;
    const nav = pg.closest(".w12s") && pg.closest(".w12s").querySelector('.w12s-nav-it.on'); if (nav && nav.dataset.p !== "access") return;
    list.dataset.axHub = "1";
    const old = {}; list.querySelectorAll(":scope > .w12s-row").forEach((r) => { const t = r.querySelector(".w12s-row-t"); if (t) old[t.textContent.trim()] = r; });
    const keep = ["Appearance", "Accessibility mode", "Kiosk mode"].map((t) => old[t]).filter(Boolean);
    list.innerHTML = "";
    SECTIONS.forEach(([id, name]) => {
      const ps = Object.values(PAGES).filter((p) => p.section === id).sort((a, b) => (a.order || 0) - (b.order || 0)); if (!ps.length) return;
      list.appendChild(H.head(name));
      ps.forEach((p) => list.appendChild(H.row({ ic: p.ic, t: p.title, s: p.desc, sub: p.key, ctl: p.toggle ? H.toggle(() => get(p.toggle), (v) => p.onToggle ? p.onToggle(v) : set(p.toggle, v), p.title) : null })));
    });
    if (keep.length) { list.appendChild(H.head("More options")); keep.forEach((r) => list.appendChild(r)); }
    list.appendChild(H.note(`Shortcuts: <kbd>Ctrl+Alt+U</kbd> accessibility settings · <kbd>Ctrl+Alt+Enter</kbd> Narrator · <kbd>Ctrl+Alt+=</kbd> / <kbd>Ctrl+Alt+-</kbd> Magnifier · <kbd>Ctrl+Alt+C</kbd> color filters · <kbd>Ctrl+Alt+H</kbd> contrast theme · <kbd>Ctrl+Alt+O</kbd> on-screen keyboard${isApple ? "" : " (Win-key versions work on PC keyboards)"}.`));
  }
  // Search: add our pages to Settings' search results.
  function enhanceSearch(pg) {
    const h1 = pg.querySelector(":scope > h1.w12s-title"), list = pg.querySelector(":scope > .w12s-list");
    if (!h1 || !list || h1.textContent.trim() !== "Search results" || list.querySelector(".ax-row")) return;
    const inp = pg.closest(".w12s").querySelector(".w12s-search input"), q = inp ? inp.value.trim().toLowerCase() : ""; if (!q) return;
    const hits = Object.values(PAGES).filter((p) => (p.title + " " + (p.desc || "") + " " + (p.keywords || "") + " accessibility").toLowerCase().includes(q));
    if (!hits.length) return;
    const empty = list.querySelector(".w12s-empty"); if (empty) empty.remove();
    hits.forEach((p) => {
      const r = H.row({ ic: p.ic, t: p.title, s: "Accessibility · " + (p.desc || ""), sub: p.key });
      // settings12 has a few placeholder rows with the same name (Narrator, Magnifier…): replace them.
      const dup = [...list.querySelectorAll(":scope > .w12s-row:not(.ax-row)")].find((x) => { const t = x.querySelector(".w12s-row-t"); return t && t.textContent.trim() === p.title; });
      if (dup) dup.replaceWith(r); else list.appendChild(r);
    });
  }
  function hookSettings(win) {
    const pg = win.querySelector && win.querySelector(".w12s-page"); if (!pg || pg.__ax) return;
    pg.__ax = true;
    const run = () => { enhanceHub(pg); enhanceSearch(pg); };
    new MutationObserver(run).observe(pg, { childList: true });
    run();
  }
  on("shell", (n) => { if (n.classList && n.classList.contains("win")) setTimeout(() => hookSettings(n), 0); });

  // =====================================================================
  //  QUICK SETTINGS "Accessibility" tile + lock-screen accessibility menu
  // =====================================================================
  // Quick toggles: [label, getter, action]
  const QUICK = [
    ["Magnifier", () => get("mag.on"), () => act("magToggle")],
    ["Color filters", () => get("cf.on"), () => act("toggleFilters")],
    ["Contrast theme", () => get("hc.on"), () => act("toggleContrast")],
    ["Narrator", () => get("nar.on"), () => act("toggleNarrator")],
    ["On-screen keyboard", () => !!act("oskOpen"), () => act("toggleOSK")],
    ["Sticky keys", () => get("sticky.on"), () => set("sticky.on", !get("sticky.on"))],
  ];
  function quickList(onMore) {
    const box = el(`<div class="ax-qs-a11y" role="group" aria-label="Accessibility"></div>`);
    QUICK.forEach(([label, g, a]) => {
      const row = el(`<div class="ax-qs-row"><span></span><label class="w12s-sw"><input type="checkbox" role="switch"><span></span></label></div>`);
      row.firstElementChild.textContent = label;
      const i = row.querySelector("input"); i.setAttribute("aria-label", label); i.checked = !!g();
      i.onchange = () => { a(); setTimeout(() => { i.checked = !!g(); }, 60); };
      syncs.add({ el: row, fn: () => { i.checked = !!g(); } });
      box.appendChild(row);
    });
    const more = el(`<button class="ax-qs-more" type="button">More accessibility settings</button>`);
    more.onclick = () => { if (onMore) onMore(); openHub(); };
    box.appendChild(more);
    return box;
  }
  const QS_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG_IC.a11y}</svg>`;
  function enhanceQS(panel) {
    const tiles = panel.querySelector(".qs-tiles"); if (!tiles || tiles.querySelector(".ax-qs-tile")) return;
    const anyOn = () => QUICK.some(([, g]) => g());
    const b = el(`<button class="qs-tile ax-qs-tile" aria-haspopup="true"><span class="qs-tile-ic">${QS_ICON}</span><span class="qs-tile-lbl">Accessibility</span></button>`);
    b.classList.toggle("on", anyOn());
    syncs.add({ el: b, fn: () => b.classList.toggle("on", anyOn()) });
    b.onclick = (e) => {
      e.stopPropagation();
      const ex = panel.querySelector(".ax-qs-sub");
      if (ex) { ex.remove(); [...panel.children].forEach((c) => { c.style.display = ""; }); return; }
      const sub = el(`<div class="ax-qs-sub"><div class="ax-qs-head"><button type="button" aria-label="Back">‹</button><b>Accessibility</b></div></div>`);
      sub.appendChild(quickList(() => panel.remove()));
      [...panel.children].forEach((c) => { c.style.display = "none"; });
      panel.prepend(sub);
      sub.querySelector(".ax-qs-head button").onclick = (ev) => { ev.stopPropagation(); sub.remove(); [...panel.children].forEach((c) => { c.style.display = ""; }); };
    };
    tiles.appendChild(b);
  }
  function enhanceLock(ls) {
    if (ls.querySelector(".ax-lock-btn")) return;
    const b = el(`<button type="button" class="ax-lock-btn" title="Accessibility" aria-label="Accessibility" aria-haspopup="true">${QS_ICON}</button>`);
    b.onclick = (e) => {
      e.stopPropagation();
      const ex = ls.querySelector(".ax-lock-menu"); if (ex) { ex.remove(); return; }
      const m = el(`<div class="ax-lock-menu ax-ui"></div>`);
      m.appendChild(quickList(() => m.remove()));
      const more = m.querySelector(".ax-qs-more"); if (more) more.remove();   // Settings need a signed-in user
      ls.appendChild(m);
    };
    ls.appendChild(b);
  }
  on("shell", (n) => {
    if (n.id === "qsPanel") enhanceQS(n);
    else if (n.classList && n.classList.contains("lock-screen")) enhanceLock(n);
  });

  // =====================================================================
  //  START-UP
  // =====================================================================
  function registerApps() {
    try {
      if (window.Icon && Icon.register) Icon.register("a11yhub", `<svg viewBox="0 0 24 24" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="#0f6cbd"/><g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round">${SVG_IC.a11y}</g></svg>`);
      window.AppRegistry = window.AppRegistry || {};
      AppRegistry.a11yhub = function () { openHub(); };
      if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === "a11yhub")) {
        Catalog.storeApps.push({ id: "a11yhub", name: "Accessibility settings", cat: "System", price: 0, builtin: "a11yhub", desc: "Narrator, Magnifier, color filters, contrast themes, on-screen keyboard, Sticky/Filter/Toggle/Mouse keys (Ctrl+Alt+U)." });
      }
    } catch (_) {}
    emit("ready");
  }
  // Apply whatever can be applied now (modules register appliers with on("apply")).
  function applyAll() { emit("apply", cfg()); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { watchShell(); registerApps(); });
  else setTimeout(() => { watchShell(); registerApps(); }, 0);
  // State may be replaced (account switch / restore reload) — re-apply on load.
  window.addEventListener("load", applyAll);

  window.A11y = {
    DEF, cfg, get, set, save, on, emit, applyAll,
    keyHook, actions, act, pointer, isApple,
    layer, ui, toast, prompt, beep, el, esc, clamp,
    page, pages: PAGES, openPage, openHub, H, quickList,
  };
})();
