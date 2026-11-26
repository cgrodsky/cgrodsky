/* =====================================================================
   Windows 11 Accessibility — Narrator (js/a11y-narrator.js)
   Load late: after js/idlelock.js, before js/main.js.

   REAL: speech with the browser's speechSynthesis and the device's own
   voices (voice list, speed, pitch, volume). Narrator reads:
   - the focused element: name, role, state and value ("Bluetooth, toggle
     switch, on"), computed from ARIA, labels and the OS's own markup;
   - window titles when a window opens or becomes active;
   - notifications (toasts) as they appear;
   - what is under the mouse (read by mouse) and, on touch screens, what you
     tap: one tap reads, a second tap on the same item activates it; swipe
     right / left with one finger moves to the next / previous item;
   - characters / words you type (echo).
   Narrator key = Caps Lock or Insert (hold it):  + → / ← next / previous item,
   + D current item, + T window title, + M read from here, + Enter activate,
   + Esc stop. Ctrl alone stops speaking. Ctrl+Alt+Enter turns Narrator on / off.
   iPad Safari: speech only starts from a tap; after a reload with Narrator on
   a "Tap to start Narrator" button appears (voices also load after that tap).
   ===================================================================== */
(function () {
  "use strict";
  if (!window.A11y || A11y.narrator) return;
  const { cfg, set, on, el, clamp } = A11y;
  const n = () => cfg().nar;
  const synth = window.speechSynthesis || null;
  const hasSpeech = !!(synth && window.SpeechSynthesisUtterance);

  // =====================================================================
  //  SPEECH
  // =====================================================================
  let voices = [], gestured = false, gate = null, pending = "";
  function loadVoices() { try { voices = synth ? synth.getVoices() || [] : []; } catch (_) { voices = []; } A11y.emit("voices", voices); return voices; }
  if (synth) { loadVoices(); try { synth.addEventListener ? synth.addEventListener("voiceschanged", loadVoices) : (synth.onvoiceschanged = loadVoices); } catch (_) {} }
  const rateOf = (v) => (v <= 10 ? 0.5 + (v - 1) * (0.5 / 9) : 1 + (v - 10) * 0.1);
  function pickVoice() {
    const want = n().voice; if (!voices.length) loadVoices();
    if (want) { const v = voices.find((x) => x.voiceURI === want || x.name === want); if (v) return v; }
    const lang = (navigator.language || "en-US").toLowerCase();
    return voices.find((x) => x.default && x.lang && x.lang.toLowerCase().startsWith(lang.slice(0, 2))) || voices.find((x) => x.lang && x.lang.toLowerCase().startsWith(lang.slice(0, 2))) || null;
  }
  // Speak text. opts.queue = don't interrupt; opts.force = speak even when Narrator is off (tests / voice preview).
  function speak(text, opts) {
    opts = opts || {};
    text = String(text || "").replace(/\s+/g, " ").trim(); if (!text) return;
    if (!n().on && !opts.force) return;
    caption(text);
    if (!hasSpeech) return;
    if (!gestured && !opts.force) { pending = text; showGate(); return; }
    try {
      if (!opts.queue) synth.cancel();
      const u = new SpeechSynthesisUtterance(text.length > 1200 ? text.slice(0, 1200) : text);
      const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = clamp(rateOf(+n().rate || 10), 0.1, 4); u.pitch = clamp(rateOf(+n().pitch || 10), 0, 2); u.volume = clamp((n().volume == null ? 100 : +n().volume) / 100, 0, 1);
      if (opts.onend) u.onend = opts.onend;
      synth.speak(u);
      if (synth.paused) synth.resume();
    } catch (_) {}
  }
  function stop() { try { if (synth) synth.cancel(); } catch (_) {} reading = false; }
  // iOS: the first utterance must come from a tap / key. Until then, offer a button.
  function unlock() {
    if (gestured) return; gestured = true;
    if (gate) { gate.remove(); gate = null; }
    loadVoices(); setTimeout(loadVoices, 400);
    if (n().on && pending) { const p = pending; pending = ""; speak(p); }
  }
  ["pointerdown", "keydown", "touchend"].forEach((t) => window.addEventListener(t, (e) => { if (e.isTrusted && !gestured) { if (gate && e.target && gate.contains(e.target)) return; unlock(); } }, { capture: true, passive: true }));
  function showGate() {
    if (gate || gestured || !n().on) return;
    gate = el(`<button type="button" class="ax-nar-gate">Tap to start Narrator</button>`);
    A11y.ui(gate, "click", () => { const had = !!pending; unlock(); if (!had) speak("Narrator on. " + describeWindow()); });
    A11y.layer().appendChild(gate);
  }

  // =====================================================================
  //  CAPTION + NARRATOR CURSOR (highlight box)
  // =====================================================================
  let cap = null, capT = 0, box = null, cur = null;
  function caption(text) {
    if (!n().caption || !n().on) { if (cap) cap.style.display = "none"; return; }
    if (!cap) { cap = el(`<div class="ax-nar-cap" aria-hidden="true"><b>Narrator</b><span></span></div>`); A11y.layer().appendChild(cap); }
    cap.style.display = ""; cap.lastElementChild.textContent = text.length > 300 ? text.slice(0, 300) + "…" : text;
    clearTimeout(capT); capT = setTimeout(() => { if (cap) cap.style.display = "none"; }, Math.min(9000, 2500 + text.length * 60));
  }
  function highlight(node) {
    cur = node;
    if (!node || !n().box || !n().on || !node.getBoundingClientRect) { if (box) box.style.display = "none"; return; }
    if (!box) { box = el(`<div class="ax-nar-box" aria-hidden="true"></div>`); A11y.layer().appendChild(box); }
    const r = node.getBoundingClientRect();
    if (!r.width && !r.height) { box.style.display = "none"; return; }
    Object.assign(box.style, { display: "block", left: (r.left - 3) + "px", top: (r.top - 3) + "px", width: (r.width + 6) + "px", height: (r.height + 6) + "px" });
    A11y.emit("narratorFocus", r);
  }
  window.addEventListener("scroll", () => { if (cur && box && box.style.display !== "none") highlight(cur); }, { capture: true, passive: true });

  // =====================================================================
  //  DESCRIBE AN ELEMENT: name, role, state, value
  // =====================================================================
  const clean = (s, max) => { s = String(s || "").replace(/\s+/g, " ").trim(); return max && s.length > max ? s.slice(0, max) + "…" : s; };
  const ROLE = {
    button: "button", link: "link", checkbox: "check box", radio: "radio button", switch: "toggle switch", slider: "slider", textbox: "edit", searchbox: "search edit",
    combobox: "combo box", listbox: "list", option: "list item", menuitem: "menu item", menuitemcheckbox: "menu item", menuitemradio: "menu item", menu: "menu", menubar: "menu bar",
    tab: "tab item", tablist: "tab list", tabpanel: "tab", dialog: "dialog", alertdialog: "alert dialog", alert: "alert", heading: "heading", img: "image", list: "list", listitem: "list item",
    navigation: "navigation landmark", toolbar: "tool bar", progressbar: "progress bar", tree: "tree", treeitem: "tree item", grid: "grid", row: "row", gridcell: "cell", cell: "cell",
    spinbutton: "spinner", status: "status", tooltip: "tool tip", group: "group", radiogroup: "radio group", region: "region", article: "article", main: "main landmark", banner: "banner",
  };
  const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="slider"], [role="treeitem"], [role="combobox"], [contenteditable="true"], [contenteditable=""], [tabindex]:not([tabindex="-1"]), .w12s-click, .w12s-nav-it, .tb-btn, .dicon, .qs-tile, .sm12-app, .start-app, [onclick]';
  function roleOf(e) {
    const r = (e.getAttribute("role") || "").split(" ")[0];
    if (r && ROLE[r]) return r === "heading" ? "heading level " + (e.getAttribute("aria-level") || 2) : ROLE[r];
    const t = e.tagName;
    if (t === "A" && e.hasAttribute("href")) return "link";
    if (t === "BUTTON" || t === "SUMMARY") return "button";
    if (t === "INPUT") {
      const ty = (e.type || "text").toLowerCase();
      if (ty === "checkbox") return e.closest(".w12s-sw, .ax-qs-row") ? "toggle switch" : "check box";
      return { radio: "radio button", range: "slider", button: "button", submit: "button", reset: "button", image: "button", color: "color picker", file: "button", search: "search edit", password: "password edit", number: "spinner" }[ty] || "edit";
    }
    if (t === "TEXTAREA" || e.isContentEditable) return "edit";
    if (t === "SELECT") return e.multiple ? "list" : "combo box";
    if (/^H[1-6]$/.test(t)) return "heading level " + t[1];
    if (t === "IMG" || t === "SVG") return "image";
    if (t === "LI") return "list item";
    if (t === "DIALOG") return "dialog";
    if (t === "NAV") return "navigation landmark";
    if (t === "PROGRESS") return "progress bar";
    if (e.classList.contains("w12s-nav-it")) return "list item";
    if (e.classList.contains("dicon")) return "list item";
    if (e.classList.contains("win")) return "window";
    if (e.matches && e.matches(INTERACTIVE)) return "button";
    return "";
  }
  function byIds(ids) { return clean(ids.split(/\s+/).map((id) => { const x = document.getElementById(id); return x ? x.textContent : ""; }).join(" ")); }
  function nameOf(e) {
    if (e.hasAttribute("aria-labelledby")) { const v = byIds(e.getAttribute("aria-labelledby")); if (v) return v; }
    const al = e.getAttribute("aria-label"); if (al && al.trim()) return clean(al);
    const t = e.tagName;
    if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") {
      if (e.labels && e.labels.length) { const v = clean([...e.labels].map((l) => l.textContent).join(" ")); if (v) return v; }
      if (t === "INPUT" && /^(button|submit|reset)$/i.test(e.type) && e.value) return clean(e.value);
      const row = e.closest(".w12s-row, .ax-qs-row, .ax-line, .il-line, .st-form");
      if (row) { const tt = row.querySelector(".w12s-row-t, :scope > span, .st-lbl"); if (tt && !tt.contains(e)) return clean(tt.textContent, 120); }
      if (e.placeholder) return clean(e.placeholder);
      if (e.title) return clean(e.title);
      return "";
    }
    if (t === "IMG") return clean(e.alt || e.title || "");
    const tt = e.closest && e.closest(".w12s-row") === e ? e.querySelector(".w12s-row-t") : null; if (tt) { const s = e.querySelector(".w12s-row-s"); return clean(tt.textContent + (s && s.textContent ? ", " + s.textContent : ""), 200); }
    let txt = clean(e.innerText != null ? e.innerText : e.textContent, 220);
    if (!txt) { const img = e.querySelector && e.querySelector("img[alt], svg[aria-label], [aria-label]"); if (img) txt = clean(img.getAttribute("alt") || img.getAttribute("aria-label")); }
    return txt || clean(e.title || e.getAttribute("data-tip") || "");
  }
  function stateOf(e) {
    const out = [], t = e.tagName, ty = (e.type || "").toLowerCase();
    const sw = t === "INPUT" && ty === "checkbox" && e.closest(".w12s-sw, .ax-qs-row") || e.getAttribute("role") === "switch";
    if (t === "INPUT" && (ty === "checkbox" || ty === "radio")) out.push(sw ? (e.checked ? "on" : "off") : (e.checked ? "checked" : "not checked"));
    const ac = e.getAttribute("aria-checked"); if (ac != null && !(t === "INPUT")) out.push(sw ? (ac === "true" ? "on" : "off") : ac === "true" ? "checked" : ac === "mixed" ? "partially checked" : "not checked");
    const ap = e.getAttribute("aria-pressed"); if (ap != null) out.push(ap === "true" ? "pressed" : "not pressed");
    const ae = e.getAttribute("aria-expanded"); if (ae != null) out.push(ae === "true" ? "expanded" : "collapsed");
    if (e.getAttribute("aria-selected") === "true" || (e.classList && (e.classList.contains("on") || e.classList.contains("sel")) && /tab|list item/.test(roleOf(e)))) out.push("selected");
    if (e.getAttribute("aria-current") && e.getAttribute("aria-current") !== "false") out.push("current");
    if (e.disabled || e.getAttribute("aria-disabled") === "true") out.push("unavailable");
    if (e.required || e.getAttribute("aria-required") === "true") out.push("required");
    if (e.readOnly && (t === "INPUT" || t === "TEXTAREA")) out.push("read only");
    return out.join(", ");
  }
  function valueOf(e) {
    const t = e.tagName, ty = (e.type || "").toLowerCase();
    if (e.hasAttribute("aria-valuetext")) return clean(e.getAttribute("aria-valuetext"));
    if (t === "INPUT" && ty === "range") return String(e.value);
    if (e.getAttribute("role") === "slider" && e.hasAttribute("aria-valuenow")) return e.getAttribute("aria-valuenow");
    if (t === "SELECT") return clean(e.selectedOptions && e.selectedOptions[0] ? e.selectedOptions[0].textContent : "");
    if ((t === "INPUT" && !/^(checkbox|radio|button|submit|reset|range|color|file|image)$/.test(ty)) || t === "TEXTAREA") {
      if (ty === "password") return e.value ? e.value.length + " characters" : "blank";
      return e.value ? clean(e.value, 160) : "blank";
    }
    if (e.isContentEditable) return clean(e.innerText, 160) || "blank";
    if (t === "PROGRESS") return Math.round((e.value / (e.max || 1)) * 100) + " percent";
    return "";
  }
  function describe(e) {
    if (!e || e.nodeType !== 1) return "";
    const role = roleOf(e), name = nameOf(e), state = stateOf(e), value = valueOf(e);
    const parts = [name, role];
    if (/edit|combo box|slider|spinner/.test(role)) parts.push(value);
    if (state) parts.push(state);
    if (n().verbosity >= 4 && n().hints) { if (role === "link" || role === "button") parts.push("press Enter to activate"); else if (/toggle switch|check box/.test(role)) parts.push("press Space to toggle"); }
    return parts.filter(Boolean).join(", ");
  }
  function describeWindow(w) {
    w = w || topWindow(); if (!w) return document.querySelector(".lock-screen") ? "Lock screen" : "Desktop";
    const t = w.querySelector(".win-titlebar .t-text"); return clean(t ? t.textContent : "") + ", window";
  }
  function topWindow() {
    let best = null, z = -1;
    document.querySelectorAll("#screen > .win").forEach((w) => { if (w.style.display === "none") return; const zi = +w.style.zIndex || 0; if (zi > z) { z = zi; best = w; } });
    return best;
  }

  // =====================================================================
  //  WHAT TO READ
  // =====================================================================
  let lastWin = null, lastEl = null, reading = false;
  const inOurUi = (e) => !!(e && e.closest && e.closest("#ax-layer"));
  function announce(e, opts) {
    if (!n().on || !e) return;
    const w = e.closest && e.closest("#screen > .win");
    let pre = "";
    if (w && w !== lastWin) { pre = describeWindow(w) + ". "; }
    lastWin = w || lastWin;
    lastEl = e; highlight(e);
    speak(pre + describe(e), opts);
  }
  // Readable target under a point / from an event target: the nearest interactive ancestor, else a text block.
  function readable(t) {
    if (!t || t.nodeType !== 1 || inOurUi(t)) return null;
    const i = t.closest(INTERACTIVE + ', .w12s-row, h1, h2, h3, h4, h5, h6, [role="heading"], label, li, p, td, th, .ntitle, .notif, .win-titlebar');
    if (i && i !== document.body && i.id !== "screen") return i.classList.contains("win-titlebar") ? i : i;
    const txt = clean(t.textContent, 50); return txt ? t : null;
  }
  // Keyboard focus
  document.addEventListener("focusin", (e) => {
    if (!n().on) return;
    const t = e.target; if (!t || t === document.body || inOurUi(t)) return;
    if (t === lastEl && Date.now() - lastTouchRead < 600) return;
    announce(t);
  }, true);
  // Value changes on the focused control (toggles, sliders, selects)
  document.addEventListener("change", (e) => {
    if (!n().on) return; const t = e.target; if (!t || inOurUi(t)) return;
    const ty = (t.type || "").toLowerCase();
    if (ty === "checkbox" || ty === "radio" || t.tagName === "SELECT") speak(stateOf(t) || valueOf(t));
  }, true);
  document.addEventListener("input", (e) => { if (n().on && e.target && e.target.type === "range" && !inOurUi(e.target)) speak(valueOf(e.target)); }, true);
  // Read by mouse (hover)
  let hoverT = 0, hoverEl = null;
  window.addEventListener("pointermove", (e) => {
    if (!n().on || !n().mouse || e.pointerType !== "mouse") return;
    clearTimeout(hoverT);
    hoverT = setTimeout(() => {
      const t = readable(document.elementFromPoint(e.clientX, e.clientY));
      if (t && t !== hoverEl && t !== lastEl) { hoverEl = t; announce(t); }
    }, 300);
  }, { capture: true, passive: true });
  // Read by touch: tap reads (and does nothing else), a second tap on the same item activates it.
  let lastTouchRead = 0, touchTarget = null, swallow = false, sw = null;
  const TOUCH_EVTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "click"];
  window.addEventListener("pointerdown", (e) => {
    if (!n().on || !n().touch || e.pointerType !== "touch" || !e.isTrusted || inOurUi(e.target)) { swallow = false; return; }
    sw = { x: e.clientX, y: e.clientY, t: Date.now() };
    const t = readable(e.target);
    if (t && t === touchTarget && Date.now() - lastTouchRead < 5000) { swallow = false; touchTarget = null; return; }   // second tap: activate
    swallow = true; touchTarget = t; lastTouchRead = Date.now();
    if (t) announce(t); else speak(describeWindow());
    e.preventDefault(); e.stopImmediatePropagation();
  }, { capture: true, passive: false });
  TOUCH_EVTS.slice(1).forEach((type) => window.addEventListener(type, (e) => {
    if (!swallow || !e.isTrusted) return;
    if (type.startsWith("mouse") || type === "click" || e.pointerType === "touch") { e.preventDefault(); e.stopImmediatePropagation(); }
    if (type === "click") swallow = false;
  }, { capture: true, passive: false }));
  // One-finger swipe right / left → next / previous item (Windows touch Narrator)
  window.addEventListener("pointerup", (e) => {
    if (!sw || !n().on || !n().touch || e.pointerType !== "touch") return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y, dt = Date.now() - sw.t; sw = null;
    if (dt < 450 && Math.abs(dx) > 70 && Math.abs(dy) < Math.abs(dx) * 0.5) { swallow = true; move(dx > 0 ? 1 : -1); }
  }, true);
  // Windows opening / getting activated, notifications
  A11y.on("shell", (node) => {
    if (!n().on || !node.classList) return;
    if (node.classList.contains("win")) setTimeout(() => { if (node.isConnected && lastWin !== node) { lastWin = node; speak(describeWindow(node), { queue: true }); } }, 60);
    else if (node.classList.contains("lock-screen")) speak("Lock screen. " + clean(node.querySelector(".lock-time") && node.querySelector(".lock-time").textContent) + ". " + clean((node.querySelector(".lock-name") || {}).textContent || ""), { queue: true });
  });
  window.addEventListener("pointerdown", (e) => {
    if (!n().on) return; const w = e.target && e.target.closest && e.target.closest("#screen > .win");
    if (w && w !== lastWin) { lastWin = w; if (e.pointerType === "mouse") speak(describeWindow(w)); }
  }, true);
  function watchNotifications() {
    const box = document.getElementById("notifications"); if (!box || box.__axN) return; box.__axN = true;
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((x) => {
      if (x.nodeType !== 1 || !n().on || !n().notif) return;
      const t = x.querySelector(".ntitle"), b = x.querySelector(".nbody");
      speak("Notification. " + clean(t ? t.textContent : "") + ". " + clean(b ? b.textContent : x.textContent, 240), { queue: true });
    }))).observe(box, { childList: true });
  }
  A11y.on("announce", (msg) => { if (n().on) speak(msg); });

  // =====================================================================
  //  ITEM NAVIGATION + READ FROM HERE
  // =====================================================================
  function items() {
    const rootEl = topWindow() || document.querySelector(".lock-screen") || document.getElementById("screen") || document.body;
    const out = [];
    const walk = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT, { acceptNode(x) {
      if (x.closest("#ax-layer")) return NodeFilter.FILTER_REJECT;
      const cs = x.getClientRects().length ? getComputedStyle(x) : null;
      if (!cs || cs.visibility === "hidden" || cs.display === "none") return NodeFilter.FILTER_REJECT;
      if (x.matches(INTERACTIVE + ', h1, h2, h3, h4, h5, h6, [role="heading"], img[alt]:not([alt=""])')) return NodeFilter.FILTER_ACCEPT;
      const own = [...x.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1);
      return own && !x.closest(INTERACTIVE) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    } });
    let x; while ((x = walk.nextNode())) { if (!out.some((o) => o.contains(x) && o.matches(INTERACTIVE))) out.push(x); if (out.length > 1500) break; }
    return out;
  }
  function move(dir) {
    const list = items(); if (!list.length) { speak(describeWindow()); return; }
    let i = lastEl ? list.indexOf(lastEl) : -1;
    if (i < 0 && lastEl) i = list.findIndex((x) => lastEl.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) - (dir > 0 ? 1 : 0);
    i = clamp(i + dir, 0, list.length - 1);
    const t = list[i]; lastEl = t;
    try { if (t.matches(INTERACTIVE) && t.focus) t.focus({ preventScroll: false }); } catch (_) {}
    try { t.scrollIntoView({ block: "nearest" }); } catch (_) {}
    announce(t);
  }
  function readFromHere() {
    const list = items(); let i = Math.max(0, lastEl ? list.indexOf(lastEl) : 0);
    reading = true;
    const next = () => { if (!reading || i >= list.length) { reading = false; return; } const t = list[i++]; lastEl = t; highlight(t); speak(describe(t), { queue: true, onend: next }); };
    stop(); reading = true; next();
  }
  function activate() {
    const t = lastEl || document.activeElement; if (!t || t === document.body) return;
    speak("Activated " + nameOf(t));
    try { if (t.focus) t.focus(); } catch (_) {}
    t.click();
  }

  // =====================================================================
  //  KEYS: Narrator key (Caps Lock / Insert) commands, Ctrl to stop, typing echo
  // =====================================================================
  let narKey = false, narUsed = false, word = "";
  A11y.keyHook((e) => { if (e.isTrusted && e.type === "keydown") unlock(); return false; }, { order: 0 });
  A11y.keyHook((e) => {
    if (!n().on) return false;
    const k = e.key, isNK = k === "CapsLock" || k === "Insert";
    if (e.type === "keyup") { if (isNK) { narKey = false; if (narUsed) { narUsed = false; return true; } } return false; }
    if (isNK) { narKey = true; narUsed = false; return false; }
    if (k === "Control" && !e.repeat) { stop(); return false; }
    if (narKey) {
      narUsed = true;
      if (k === "ArrowRight") { move(1); return true; }
      if (k === "ArrowLeft") { move(-1); return true; }
      if (k === "d" || k === "D") { if (lastEl || document.activeElement) announce(lastEl || document.activeElement); return true; }
      if (k === "t" || k === "T") { speak(describeWindow()); return true; }
      if (k === "m" || k === "M") { readFromHere(); return true; }
      if (k === "Enter") { activate(); return true; }
      if (k === "Escape") { stop(); return true; }
      if (k === "F1") { A11y.openPage("ax-narrator"); return true; }
      return false;
    }
    // Typing echo
    const t = e.target, editable = t && (t.isContentEditable || /^(INPUT|TEXTAREA)$/.test(t.tagName));
    if (editable && !e.ctrlKey && !e.metaKey && !e.altKey && !inOurUi(t)) {
      if (k.length === 1) {
        if (/[\s.,;:!?]/.test(k)) { if (n().echoWords && word) speak(word); else if (n().echoChars) speak(k === " " ? "space" : k); word = ""; }
        else { word += k; if (n().echoChars) speak(t.type === "password" ? "star" : k); }
      } else if (k === "Backspace" && n().echoChars) speak("backspace");
      else if (k === "Enter" && n().echoWords && word) { speak(word); word = ""; }
    }
    return false;
  }, { order: 80 });

  // =====================================================================
  //  ON / OFF
  // =====================================================================
  function turn(v) {
    set("nar.on", !!v, { now: true });
    if (v) {
      if (!hasSpeech) { A11y.toast("This browser has no speech — Narrator shows captions only"); }
      speak("Narrator on. " + (document.activeElement && document.activeElement !== document.body ? describe(document.activeElement) : describeWindow()), { force: true });
      if (n().warn) A11y.toast(A11y.isApple ? "Narrator is on — Ctrl+Alt+Enter turns it off" : "Narrator is on — Ctrl+Alt+Enter or Win+Ctrl+Enter turns it off", 3500);
    } else { stop(); speak("Exiting Narrator", { force: true }); highlight(null); if (cap) cap.style.display = "none"; if (gate) { gate.remove(); gate = null; } }
  }
  A11y.actions.toggleNarrator = () => turn(!n().on);
  on("change", (p) => { if (p === "nar.box" || p === "nar.on") highlight(n().on ? cur : null); });

  // =====================================================================
  //  SETTINGS PAGE
  // =====================================================================
  A11y.page("ax-narrator", { title: "Narrator", ic: "narrator", section: "vision", order: 8, desc: "Voice, verbosity, keyboard, braille", toggle: "nar.on", onToggle: (v) => turn(v), keywords: "screen reader speech voice read aloud", build(h, H) {
    h.appendChild(H.row({ ic: "narrator", t: "Narrator", s: "Screen reader that reads what's on screen aloud", ctl: H.toggle(() => n().on, turn, "Narrator") }));
    h.appendChild(H.row({ t: "Keyboard shortcut for Narrator", s: (A11y.isApple ? "" : "Windows logo key + Ctrl + Enter, or ") + "Ctrl+Alt+Enter", ctl: H.toggle(() => cfg().keys.shortcuts, (v) => set("keys.shortcuts", v), "Accessibility keyboard shortcuts") }));
    h.appendChild(H.row({ t: "Start Narrator after sign-in", ctl: H.toggle(() => n().autostart, (v) => set("nar.autostart", v)) }));
    h.appendChild(H.head("Narrator's voice"));
    const vs = el(`<select class="w12s-select" aria-label="Choose a voice" style="max-width:260px"></select>`);
    const fill = () => {
      let list = voices; if (!list.length) { try { list = voices = synth ? synth.getVoices() || [] : []; } catch (_) { list = []; } }
      vs.innerHTML = `<option value="">Default voice (${(navigator.language || "en-US")})</option>` + list.map((v) => `<option value="${A11y.esc(v.voiceURI)}">${A11y.esc(v.name)} — ${A11y.esc(v.lang)}${v.localService ? "" : " (online)"}</option>`).join("");
      vs.value = n().voice || ""; if (vs.value !== (n().voice || "")) vs.value = "";
      vcount.textContent = list.length ? list.length + " voices on this device" : (hasSpeech ? "Voices load after you tap or press a key (Safari on iPad)" : "This browser can't speak");
    };
    const vcount = el(`<span class="w12s-row-s"></span>`);
    vs.addEventListener("click", (e) => e.stopPropagation()); vs.onchange = () => set("nar.voice", vs.value);
    const offV = A11y.on("voices", () => { if (!vs.isConnected) return offV(); fill(); });
    const vr = H.row({ t: "Choose a voice", ctl: vs }); vr.querySelector(".w12s-row-txt").appendChild(vcount); h.appendChild(vr); fill();
    h.appendChild(H.row({ t: "Speed", ctl: H.slider(1, 20, 1, () => n().rate, (v) => set("nar.rate", v), { label: "Voice speed" }) }));
    h.appendChild(H.row({ t: "Pitch", ctl: H.slider(1, 20, 1, () => n().pitch, (v) => set("nar.pitch", v), { label: "Voice pitch" }) }));
    h.appendChild(H.row({ t: "Volume", ctl: H.slider(0, 100, 1, () => n().volume, (v) => set("nar.volume", v), { label: "Voice volume" }) }));
    const test = H.button("Listen to this voice", () => { unlock(); speak("Hello, I'm Narrator. This is how I sound at this speed and pitch.", { force: true }); });
    h.appendChild(H.row({ t: "Preview", ctl: test }));
    h.appendChild(H.head("Verbosity"));
    h.appendChild(H.row({ t: "Verbosity level", s: "How much Narrator says about controls", ctl: H.select([[1, "1 · Text only"], [2, "2 · Some control details"], [3, "3 · All control details"], [4, "4 · Some text details"], [5, "5 · All text details"]], () => n().verbosity, (v) => set("nar.verbosity", +v), "Verbosity level") }));
    h.appendChild(H.row({ t: "Hear hints on how to interact with buttons and other controls", ctl: H.toggle(() => n().hints, (v) => set("nar.hints", v)) }));
    h.appendChild(H.row({ t: "Read notifications", s: "Toasts from apps and the system", ctl: H.toggle(() => n().notif, (v) => set("nar.notif", v)) }));
    h.appendChild(H.head("Mouse, touch and keyboard"));
    h.appendChild(H.row({ t: "Have Narrator read and interact with the screen using the mouse", ctl: H.toggle(() => n().mouse, (v) => set("nar.mouse", v)) }));
    h.appendChild(H.row({ t: "Read by touch", s: "Tap reads an item, tap it again to activate · swipe right / left for next / previous item", ctl: H.toggle(() => n().touch, (v) => set("nar.touch", v)) }));
    h.appendChild(H.row({ t: "Hear characters as you type", ctl: H.toggle(() => n().echoChars, (v) => set("nar.echoChars", v)) }));
    h.appendChild(H.row({ t: "Hear words as you type", ctl: H.toggle(() => n().echoWords, (v) => set("nar.echoWords", v)) }));
    h.appendChild(H.head("Narrator cursor and captions"));
    h.appendChild(H.row({ t: "Show the Narrator cursor", s: "A blue box around what Narrator is reading", ctl: H.toggle(() => n().box, (v) => set("nar.box", v)) }));
    h.appendChild(H.row({ t: "Show captions", s: "What Narrator says, on screen", ctl: H.toggle(() => n().caption, (v) => set("nar.caption", v)) }));
    h.appendChild(H.head("Narrator commands"));
    const cmds = [["Ctrl+Alt+Enter", "Turn Narrator on or off"], ["Ctrl", "Stop reading"], ["Narrator + → / ←", "Next / previous item"], ["Narrator + D", "Read current item"], ["Narrator + T", "Read window title"], ["Narrator + M", "Start reading from here"], ["Narrator + Enter", "Activate current item"], ["Narrator + Esc", "Stop"], ["Tab / Shift+Tab", "Move focus (read automatically)"]];
    const tbl = H.card(`<table class="ax-cmds"><tbody>${cmds.map(([k, d]) => `<tr><td><span class="ax-kbd">${A11y.esc(k)}</span></td><td>${A11y.esc(d)}</td></tr>`).join("")}</tbody></table><div class="ax-s-note">The Narrator key is Caps Lock or Insert — hold it while pressing the other key.</div>`);
    h.appendChild(tbl);
  } });

  // Narrator comes back after a reload only with "Start Narrator after sign-in".
  if (n().on && !n().autostart) { cfg().nar.on = false; A11y.save(); }
  A11y.on("shell", (node) => { if (node.classList && node.classList.contains("taskbar") && n().autostart) { if (!n().on) set("nar.on", true, { now: true }); speak("Narrator on. Desktop"); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchNotifications); else watchNotifications();
  A11y.narrator = { speak, stop, describe, nameOf, roleOf, stateOf, valueOf, turn, move, voices: () => voices, isOn: () => !!n().on };
  window.Narrator = { start: () => turn(true), stop: () => turn(false), toggle: () => turn(!n().on), speak: (t) => speak(t, { force: true }) };
})();
