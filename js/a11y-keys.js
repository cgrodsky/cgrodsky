/* =====================================================================
   Windows 11 Accessibility — Keyboard & mouse keys (js/a11y-keys.js)
   Load late: after js/idlelock.js, before js/main.js (after js/a11y-narrator.js).

   REAL (only for keys typed inside this Windows 12 page):
   - A11y.sendKey(): delivers a key as real keydown / keypress / keyup events
     (key, code, keyCode, modifiers) to the focused element, so app shortcuts
     work; when nobody cancels it, the browser default is reproduced: typing
     (execCommand insertText → undo works), Backspace / Delete, Enter, Tab
     focus moves, caret moves with arrows / Home / End (Shift extends),
     Ctrl+A / C / X / V / Z / Y, Space / Enter on buttons, sliders, selects,
     scrolling. Used by Sticky Keys, Filter Keys and the on-screen keyboard.
   - Sticky Keys: Shift, Ctrl, Alt, Win latch (press twice to lock), sounds,
     taskbar indicator, Shift×5 prompt, "turn off when two keys are pressed".
   - Filter Keys: ignore quick keystrokes (slow keys), ignore repeated
     keystrokes (bounce keys), slow down auto-repeat; hold Right Shift 8 s.
   - Toggle Keys: high / low tone for Caps / Num / Scroll Lock; hold Num Lock 5 s.
   - Mouse Keys: numeric keypad (hardware, or the OSK's numeric pad) moves a
     virtual pointer; 5 / + / 0 / . click, double-click, press, release via
     elementFromPoint + synthetic pointer / mouse events. Left Alt+Left Shift+Num Lock.
   ===================================================================== */
(function () {
  "use strict";
  if (!window.A11y || A11y.sendKey) return;
  const { cfg, get, set, on, el, clamp, beep, toast } = A11y;
  const isApple = A11y.isApple;

  // =====================================================================
  //  KEY TABLES
  // =====================================================================
  const SHIFTED = { "`": "~", 1: "!", 2: "@", 3: "#", 4: "$", 5: "%", 6: "^", 7: "&", 8: "*", 9: "(", 0: ")", "-": "_", "=": "+", "[": "{", "]": "}", "\\": "|", ";": ":", "'": '"', ",": "<", ".": ">", "/": "?" };
  const UNSHIFT = Object.fromEntries(Object.entries(SHIFTED).map(([a, b]) => [b, a]));
  const PUNCT_CODE = { "`": "Backquote", "-": "Minus", "=": "Equal", "[": "BracketLeft", "]": "BracketRight", "\\": "Backslash", ";": "Semicolon", "'": "Quote", ",": "Comma", ".": "Period", "/": "Slash", " ": "Space" };
  const KEYCODE = { Backspace: 8, Tab: 9, Enter: 13, Shift: 16, Control: 17, Alt: 18, Pause: 19, CapsLock: 20, Escape: 27, " ": 32, PageUp: 33, PageDown: 34, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, PrintScreen: 44, Insert: 45, Delete: 46, Meta: 91, ContextMenu: 93, NumLock: 144, ScrollLock: 145,
    ";": 186, "=": 187, ",": 188, "-": 189, ".": 190, "/": 191, "`": 192, "[": 219, "\\": 220, "]": 221, "'": 222 };
  function codeFor(key) {
    if (/^[a-z]$/i.test(key)) return "Key" + key.toUpperCase();
    if (/^[0-9]$/.test(key)) return "Digit" + key;
    if (UNSHIFT[key]) { const b = UNSHIFT[key]; return /^[0-9]$/.test(b) ? "Digit" + b : PUNCT_CODE[b]; }
    if (PUNCT_CODE[key]) return PUNCT_CODE[key];
    return { Control: "ControlLeft", Shift: "ShiftLeft", Alt: "AltLeft", Meta: "MetaLeft" }[key] || key;
  }
  function keyCodeFor(key, code) {
    if (/^Numpad\d$/.test(code || "")) return 96 + +code.slice(6);
    const np = { NumpadMultiply: 106, NumpadAdd: 107, NumpadSubtract: 109, NumpadDecimal: 110, NumpadDivide: 111, NumpadEnter: 13 }[code]; if (np) return np;
    if (/^[a-z]$/i.test(key)) return key.toUpperCase().charCodeAt(0);
    if (/^[0-9]$/.test(key)) return 48 + +key;
    if (UNSHIFT[key]) { const b = UNSHIFT[key]; return /^[0-9]$/.test(b) ? 48 + +b : KEYCODE[b] || 0; }
    if (/^F\d{1,2}$/.test(key)) return 111 + +key.slice(1);
    return KEYCODE[key] || 0;
  }
  const shiftChar = (k) => (/^[a-z]$/.test(k) ? k.toUpperCase() : /^[A-Z]$/.test(k) ? k : SHIFTED[k] || k);

  // =====================================================================
  //  WHERE KEYS GO
  // =====================================================================
  const TEXTY = /^(text|search|url|tel|email|password|number|)$/i;
  const isField = (t) => !!t && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && TEXTY.test(t.type || "")));
  const editable = (t) => !!t && (isField(t) ? !t.readOnly && !t.disabled : !!t.isContentEditable);
  const inLayer = (t) => !!(t && t.closest && t.closest("#ax-layer"));
  let lastFocus = null;
  document.addEventListener("focusin", (e) => { const t = e.target; if (t && t !== document.body && !inLayer(t)) lastFocus = t; }, true);
  function focusTarget(pref) {
    const a = document.activeElement;
    if (pref && pref.isConnected) return pref;
    if (a && a !== document.body && a !== document.documentElement && !inLayer(a)) return a;
    if (lastFocus && lastFocus.isConnected && lastFocus.getClientRects().length) return lastFocus;
    return document.body;
  }

  // =====================================================================
  //  SYNTHETIC KEY DELIVERY
  // =====================================================================
  function fire(type, target, o) {
    const ev = new KeyboardEvent(type, { key: o.key, code: o.code, location: o.location || 0, ctrlKey: !!o.ctrl, altKey: !!o.alt, shiftKey: !!o.shift, metaKey: !!o.meta, repeat: !!o.repeat, bubbles: true, cancelable: true, composed: true, view: window });
    const kc = type === "keypress" ? (o.key.length === 1 ? o.key.charCodeAt(0) : 13) : keyCodeFor(o.key, o.code);
    try { Object.defineProperty(ev, "keyCode", { get: () => kc }); Object.defineProperty(ev, "which", { get: () => kc }); if (type === "keypress") Object.defineProperty(ev, "charCode", { get: () => kc }); } catch (_) {}
    target.dispatchEvent(ev);
    return ev;
  }
  // o: { key, code?, ctrl, alt, shift, meta, target? }   → true when something happened
  function sendKey(o) {
    o = Object.assign({}, o); if (!o.code) o.code = codeFor(o.key);
    let t = focusTarget(o.target);
    if (o.target && document.activeElement !== t && t.focus) { try { t.focus({ preventScroll: true }); } catch (_) {} }
    const kd = fire("keydown", t, o);
    if (!kd.defaultPrevented) {
      const t2 = focusTarget();   // a keydown handler may have moved focus
      if (o.key.length === 1 && !o.ctrl && !o.meta && !o.alt) {
        const kp = fire("keypress", t2, o);
        if (!kp.defaultPrevented) typeChar(t2, o.key);
      } else defaultAction(t2, o);
    }
    fire("keyup", focusTarget(), o);
    A11y.emit("sentKey", o);
    return true;
  }
  function typeChar(t, ch) {
    if (editable(t)) return insertText(t, ch);
    if (ch === " ") return activateOrScroll(t, " ");
    return false;
  }
  function insertText(t, text) {
    if (!editable(t)) return false;
    try { if (document.activeElement !== t) t.focus({ preventScroll: true }); } catch (_) {}
    if (isField(t)) {
      let s = t.selectionStart, e = t.selectionEnd; if (s == null) s = e = t.value.length;
      const before = t.value;
      let ok = false; try { ok = document.execCommand("insertText", false, text); } catch (_) {}
      if (!ok || t.value === before) {
        if (t.maxLength > 0 && before.length - (e - s) + text.length > t.maxLength) return false;
        try { t.setRangeText(text, s, e, "end"); } catch (_) { t.value = before.slice(0, s) + text + before.slice(e); }
        t.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      }
      return true;
    }
    let ok = false; try { ok = document.execCommand(text === "\n" ? "insertParagraph" : "insertText", false, text === "\n" ? null : text); } catch (_) {}
    if (!ok) {
      const sel = document.getSelection(); if (!sel.rangeCount) return false;
      const r = sel.getRangeAt(0); r.deleteContents(); const node = document.createTextNode(text); r.insertNode(node); r.setStartAfter(node); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
      t.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }
    return true;
  }
  function delChar(t, forward, word) {
    if (isField(t)) {
      let s = t.selectionStart, e = t.selectionEnd;
      if (s === e) {
        if (word) { if (forward) e = wordRight(t.value, e); else s = wordLeft(t.value, s); }
        else if (forward) e = Math.min(t.value.length, e + 1); else s = Math.max(0, s - 1);
        if (s === e) return false;
        t.setSelectionRange(s, e);
      }
      let ok = false; try { ok = document.execCommand("delete"); } catch (_) {}
      if (!ok) { t.setRangeText("", t.selectionStart, t.selectionEnd, "end"); t.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: forward ? "deleteContentForward" : "deleteContentBackward" })); }
      return true;
    }
    const sel = document.getSelection();
    if (word && sel.isCollapsed && sel.modify) sel.modify("extend", forward ? "forward" : "backward", "word");
    try { return document.execCommand(forward ? "forwardDelete" : "delete"); } catch (_) { return false; }
  }
  const wordLeft = (v, i) => { while (i > 0 && /\s/.test(v[i - 1])) i--; while (i > 0 && !/\s/.test(v[i - 1])) i--; return i; };
  const wordRight = (v, i) => { while (i < v.length && !/\s/.test(v[i])) i++; while (i < v.length && /\s/.test(v[i])) i++; return i; };
  function moveCaret(t, o) {
    const k = o.key;
    if (isField(t)) {
      const v = t.value, back = t.selectionDirection === "backward";
      let s = t.selectionStart, e = t.selectionEnd; if (s == null) return false;
      let f = back ? s : e; const a = back ? e : s;
      if (!o.shift && s !== e && (k === "ArrowLeft" || k === "ArrowRight")) { const p = k === "ArrowLeft" ? s : e; t.setSelectionRange(p, p); return true; }
      const ls = (i) => v.lastIndexOf("\n", i - 1) + 1, le = (i) => { const j = v.indexOf("\n", i); return j < 0 ? v.length : j; };
      const multi = t.tagName === "TEXTAREA";
      const vert = (i, n) => { let col = i - ls(i), p = i; for (let c = 0; c < Math.abs(n); c++) { if (n < 0) { const st = ls(p); if (st === 0) return 0; p = ls(st - 1); } else { const en = le(p); if (en >= v.length) return v.length; p = en + 1; } } return Math.min(p + col, le(p)); };
      if (k === "ArrowLeft") f = o.ctrl ? wordLeft(v, f) : Math.max(0, f - 1);
      else if (k === "ArrowRight") f = o.ctrl ? wordRight(v, f) : Math.min(v.length, f + 1);
      else if (k === "Home") f = o.ctrl || !multi ? 0 : ls(f);
      else if (k === "End") f = o.ctrl || !multi ? v.length : le(f);
      else if (k === "ArrowUp") f = multi ? vert(f, -1) : 0;
      else if (k === "ArrowDown") f = multi ? vert(f, 1) : v.length;
      else if (k === "PageUp") f = multi ? vert(f, -10) : 0;
      else if (k === "PageDown") f = multi ? vert(f, 10) : v.length;
      if (o.shift) t.setSelectionRange(Math.min(a, f), Math.max(a, f), f < a ? "backward" : "forward"); else t.setSelectionRange(f, f);
      return true;
    }
    const sel = document.getSelection(); if (!sel || !sel.modify) return false;
    const dir = /Left|Up|Home|PageUp/.test(k) ? "backward" : "forward";
    const gran = /Home|End/.test(k) ? (o.ctrl ? "documentboundary" : "lineboundary") : /Up|Down/.test(k) ? (k.startsWith("Page") ? "paragraphboundary" : "line") : o.ctrl ? "word" : "character";
    sel.modify(o.shift ? "extend" : "move", dir, gran);
    return true;
  }
  function focusables() {
    const scope = (document.activeElement && document.activeElement.closest(".win, .ax-prompt, .lock-screen, .start-menu")) || document.getElementById("screen") || document.body;
    return [...scope.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]')]
      .filter((x) => x.getClientRects().length && getComputedStyle(x).visibility !== "hidden" && !inLayer(x));
  }
  function tabMove(back) {
    const list = focusables(); if (!list.length) return false;
    const i = list.indexOf(document.activeElement);
    const nx = list[(i < 0 ? (back ? list.length - 1 : 0) : (i + (back ? -1 : 1) + list.length) % list.length)];
    try { nx.focus(); if (isField(nx) && nx.select) nx.select(); } catch (_) {}
    return true;
  }
  function scroller(t) {
    let x = t && t.nodeType === 1 ? t : document.elementFromPoint(A11y.pointer.x, A11y.pointer.y);
    while (x && x !== document.body) { const cs = getComputedStyle(x); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (x.scrollHeight > x.clientHeight + 2 || x.scrollWidth > x.clientWidth + 2)) return x; x = x.parentElement; }
    return null;
  }
  const BTN_LIKE = 'button, a[href], summary, input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"], [role="option"], .w12s-click, .tb-btn';
  function activateOrScroll(t, key) {
    if (t && t.matches && t.matches(BTN_LIKE)) {
      if (key === "Enter" && t.matches('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="switch"]')) return false;
      if (t.tagName === "INPUT" && t.type === "submit" && t.form && key === "Enter") { t.form.requestSubmit ? t.form.requestSubmit(t) : t.click(); return true; }
      t.click(); return true;
    }
    const sc = scroller(t); if (sc && key === " ") { sc.scrollBy({ top: sc.clientHeight * 0.85, behavior: "smooth" }); return true; }
    return false;
  }
  function defaultAction(t, o) {
    const k = o.key, ctrl = o.ctrl || (isApple && o.meta);
    if (k === "Tab" && !o.ctrl && !o.alt) return tabMove(o.shift);
    if (editable(t)) {
      if (ctrl && !o.alt) {
        const c = k.toLowerCase();
        if (c === "a") { if (isField(t)) t.select(); else document.execCommand("selectAll"); return true; }
        if (c === "c") { try { return document.execCommand("copy"); } catch (_) { return false; } }
        if (c === "x") { try { return document.execCommand("cut"); } catch (_) { return false; } }
        if (c === "v") { paste(t); return true; }
        if (c === "z") { try { return document.execCommand(o.shift ? "redo" : "undo"); } catch (_) { return false; } }
        if (c === "y") { try { return document.execCommand("redo"); } catch (_) { return false; } }
        if (k === "Backspace" || k === "Delete") return delChar(t, k === "Delete", true);
        if (/^(Arrow|Home|End)/.test(k)) return moveCaret(t, o);
        return false;
      }
      if (k === "Backspace") return delChar(t, false);
      if (k === "Delete") return delChar(t, true);
      if (k === "Enter") {
        if (t.tagName === "TEXTAREA" || t.isContentEditable) return insertText(t, "\n");
        if (t.form) { try { t.form.requestSubmit ? t.form.requestSubmit() : t.form.submit(); } catch (_) {} return true; }
        return false;
      }
      if (/^(Arrow|Home|End|Page)/.test(k)) return moveCaret(t, o);
      return false;
    }
    if (ctrl && k.toLowerCase() === "c") { try { return document.execCommand("copy"); } catch (_) { return false; } }
    if (k === "Enter") return activateOrScroll(t, "Enter");
    if (t && t.tagName === "INPUT" && t.type === "range" && /^Arrow|Home|End|Page/.test(k)) {
      const st = +t.step || 1, mn = +t.min || 0, mx = t.max === "" ? 100 : +t.max, v = +t.value;
      const nv = k === "Home" ? mn : k === "End" ? mx : /Right|Up/.test(k) ? v + st : /Left|Down/.test(k) ? v - st : k === "PageUp" ? v + st * 10 : v - st * 10;
      t.value = clamp(nv, mn, mx); t.dispatchEvent(new Event("input", { bubbles: true })); t.dispatchEvent(new Event("change", { bubbles: true })); return true;
    }
    if (t && t.tagName === "SELECT" && /^Arrow(Up|Down)$/.test(k)) {
      const i = clamp(t.selectedIndex + (k === "ArrowDown" ? 1 : -1), 0, t.options.length - 1);
      if (i !== t.selectedIndex) { t.selectedIndex = i; t.dispatchEvent(new Event("input", { bubbles: true })); t.dispatchEvent(new Event("change", { bubbles: true })); } return true;
    }
    if (t && t.tagName === "INPUT" && t.type === "radio" && /^Arrow/.test(k) && t.name) {
      const g = [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(t.name)}"]`)].filter((x) => !x.disabled); const i = g.indexOf(t);
      const nx = g[(i + (/Right|Down/.test(k) ? 1 : -1) + g.length) % g.length]; if (nx) { nx.focus(); nx.click(); } return true;
    }
    const sc = scroller(t);
    if (sc) {
      const d = { ArrowDown: [0, 40], ArrowUp: [0, -40], ArrowRight: [40, 0], ArrowLeft: [-40, 0], PageDown: [0, sc.clientHeight * 0.85], PageUp: [0, -sc.clientHeight * 0.85] }[k];
      if (d) { sc.scrollBy({ left: d[0], top: d[1] }); return true; }
      if (k === "Home") { sc.scrollTop = 0; return true; } if (k === "End") { sc.scrollTop = sc.scrollHeight; return true; }
    }
    return false;
  }
  function paste(t) {
    const fallback = () => { toast(isApple ? "The browser only lets ⌘V paste from your clipboard — or use Clipboard history (Ctrl+Alt+V)" : "The browser blocked reading the clipboard — use Ctrl+V on your keyboard or Clipboard history (Ctrl+Alt+V)", 4200); };
    try {
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((x) => { if (x) insertText(t, x); else fallback(); }).catch(fallback);
      else fallback();
    } catch (_) { fallback(); }
  }

  // =====================================================================
  //  STICKY KEYS
  // =====================================================================
  const MODS = { Shift: "shift", Control: "ctrl", Alt: "alt", Meta: "meta", OS: "meta" };
  const latch = { shift: 0, ctrl: 0, alt: 0, meta: 0 };      // 0 off · 1 latched · 2 locked
  const held = new Set(); let comboUsed = false;
  const swallowUp = new Set();
  let shiftN = 0, shiftLast = 0;
  const sk = () => cfg().sticky;
  function skSound(kind) { if (!sk().sound) return; beep(kind === "lock" ? [880, 1320] : kind === "off" ? 440 : kind === "on" ? 880 : 660, kind === "lock" ? 70 : 80, 0.14); }
  function clearLatches() { for (const k in latch) latch[k] = 0; paintTray(); A11y.emit("latch", latch); }
  function stickyHook(e) {
    const m = MODS[e.key];
    // Shift ×5 → offer to turn Sticky Keys on (or turn it off)
    if (e.type === "keydown" && !e.repeat) {
      if (e.key === "Shift" && !e.ctrlKey && !e.altKey && !e.metaKey) { const now = Date.now(); shiftN = now - shiftLast < 1200 ? shiftN + 1 : 1; shiftLast = now; if (shiftN >= 5) { shiftN = 0; shiftFive(); } }
      else if (e.key !== "Shift") shiftN = 0;
    }
    if (!sk().on) return false;
    if (e.type === "keydown") {
      if (m) { if (!e.repeat) { held.add(m); comboUsed = false; } return false; }
      if (held.size) {
        comboUsed = true;
        if (sk().offTwo) { set("sticky.on", false); clearLatches(); skSound("off"); toast("Sticky keys turned off (two keys were pressed at once)"); }
        return false;
      }
      const any = Object.keys(latch).some((k) => latch[k]);
      if (!any) return false;
      let key = e.key;
      if (latch.shift && key.length === 1) key = e.getModifierState && e.getModifierState("CapsLock") && /^[a-z]$/i.test(key) ? key.toLowerCase() : shiftChar(key);
      swallowUp.add(e.code);
      sendKey({ key, code: e.code, location: e.location, shift: !!latch.shift || e.shiftKey, ctrl: !!latch.ctrl || e.ctrlKey, alt: !!latch.alt || e.altKey, meta: !!latch.meta || e.metaKey });
      for (const k in latch) if (latch[k] === 1) latch[k] = 0;
      paintTray(); A11y.emit("latch", latch);
      return true;
    }
    // keyup
    if (swallowUp.has(e.code)) { swallowUp.delete(e.code); return true; }
    if (m) {
      const wasHeld = held.has(m); held.delete(m);
      if (wasHeld && !comboUsed) {
        const v = latch[m];
        latch[m] = v === 0 ? 1 : v === 1 && sk().lock ? 2 : 0;
        skSound(latch[m] === 2 ? "lock" : latch[m] === 1 ? "latch" : "off");
        paintTray(); A11y.emit("latch", latch);
      }
      if (!held.size) comboUsed = false;
    }
    return false;
  }
  function shiftFive() {
    if (sk().on) { set("sticky.on", false); clearLatches(); skSound("off"); toast("Sticky keys off"); return; }
    if (!sk().shortcut) return;
    beep([660, 880], 90, 0.14);
    A11y.prompt({ title: "Sticky Keys",
      html: `Do you want to turn on Sticky Keys?<br><br>Sticky Keys lets you use the Shift, Ctrl, Alt or Windows logo keys by pressing one key at a time. The keyboard shortcut to turn on Sticky Keys is to press the Shift key 5 times.<br><br><a data-link="1">Disable this keyboard shortcut in accessibility keyboard settings</a>`,
      onYes: () => { set("sticky.on", true); skSound("on"); toast("Sticky keys on"); }, onLink: () => A11y.openPage("ax-keyboard") });
  }

  // =====================================================================
  //  FILTER KEYS
  // =====================================================================
  const fk = () => cfg().filter;
  const downAt = {}, upAt = {}, repAt = {}, slowT = {}, fSwallow = new Set();
  let rshiftT = 0;
  function filterHook(e) {
    const code = e.code || e.key;
    // Hold Right Shift for 8 seconds → Filter Keys prompt / off
    if (code === "ShiftRight") {
      if (e.type === "keydown" && !e.repeat) { clearTimeout(rshiftT); rshiftT = setTimeout(() => { if (fk().on) { set("filter.on", false); beep(440, 120); toast("Filter keys off"); } else if (fk().shortcut) filterPrompt(); }, 8000); }
      else if (e.type === "keyup") clearTimeout(rshiftT);
    }
    if (!fk().on || MODS[e.key]) return false;
    const f = fk(), now = Date.now();
    if (e.type === "keyup") {
      upAt[code] = now;
      if (slowT[code]) { clearTimeout(slowT[code]); slowT[code] = 0; }
      if (fSwallow.has(code)) { fSwallow.delete(code); return true; }
      return false;
    }
    if (!e.repeat) {
      if (f.bounce && upAt[code] && now - upAt[code] < f.bounceMs) { fSwallow.add(code); if (f.beep) beep(300, 60, 0.1); return true; }
      downAt[code] = now; repAt[code] = now;
      if (f.slow) {
        fSwallow.add(code);
        const spec = { key: e.key, code: e.code, location: e.location, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey };
        clearTimeout(slowT[code]);
        slowT[code] = setTimeout(() => { slowT[code] = 0; if (f.beep) beep(1200, 40, 0.08); sendKey(spec); }, f.slowMs);
        if (f.beep) beep(600, 30, 0.06);
        return true;
      }
      return false;
    }
    // auto-repeat
    if (f.slow) return true;
    if (f.repeat) {
      if (now - (downAt[code] || 0) < f.repeatDelay || now - (repAt[code] || 0) < f.repeatRate) return true;
      repAt[code] = now;
    }
    return false;
  }
  function filterPrompt() {
    beep([523, 659, 784], 90, 0.14);
    A11y.prompt({ title: "Filter Keys", html: `Do you want to turn on Filter Keys?<br><br>Filter Keys ignores brief or repeated keystrokes and slows down the repeat rate. The keyboard shortcut is to hold the right Shift key for 8 seconds.<br><br><a data-link="1">Disable this keyboard shortcut in accessibility keyboard settings</a>`,
      onYes: () => { set("filter.on", true); if (!fk().slow && !fk().bounce && !fk().repeat) set("filter.slow", true); toast("Filter keys on"); }, onLink: () => A11y.openPage("ax-keyboard") });
  }

  // =====================================================================
  //  TOGGLE KEYS
  // =====================================================================
  const LOCKS = { CapsLock: 1, NumLock: 1, ScrollLock: 1 };
  let lockBeepAt = {}, numHoldT = 0;
  function toggleHook(e) {
    if (e.key === "NumLock" && !e.altKey && !e.shiftKey) {
      if (e.type === "keydown" && !e.repeat) { clearTimeout(numHoldT); numHoldT = setTimeout(() => { const t = cfg().toggle; if (t.on) { set("toggle.on", false); beep(440, 120); toast("Toggle keys off"); } else if (t.shortcut) A11y.prompt({ title: "Toggle Keys", html: "Do you want to turn on Toggle Keys?<br><br>Toggle Keys plays a sound when you press Caps Lock, Num Lock or Scroll Lock. The keyboard shortcut is to hold the Num Lock key for 5 seconds.", onYes: () => set("toggle.on", true) }); }, 5000); }
      else if (e.type === "keyup") clearTimeout(numHoldT);
    }
    if (!cfg().toggle.on || !LOCKS[e.key] || e.repeat) return false;
    let state = null;
    if (isApple) state = e.type === "keydown";
    else if (e.type === "keyup") state = e.getModifierState ? e.getModifierState(e.key) : null;
    if (state == null) return false;
    const now = Date.now(); if (now - (lockBeepAt[e.key] || 0) < 120) return false; lockBeepAt[e.key] = now;
    beep(state ? 1046 : 523, 110, 0.16);
    A11y.emit("lock", e.key, state);
    paintTray();
    return false;
  }

  // =====================================================================
  //  MOUSE KEYS
  // =====================================================================
  const mk = () => cfg().mk;
  const DIRS = { Numpad1: [-1, 1], Numpad2: [0, 1], Numpad3: [1, 1], Numpad4: [-1, 0], Numpad6: [1, 0], Numpad7: [-1, -1], Numpad8: [0, -1], Numpad9: [1, -1] };
  const NUMPAD = /^Numpad(\d|Divide|Multiply|Subtract|Add|Decimal)$/;
  const mp = { x: null, y: null, btn: 0, down: false, held: new Set(), start: 0, raf: 0, last: 0, fast: false, slow: false };
  let mkPtr = null;
  function ptrEl() {
    if (!mkPtr) { mkPtr = el(`<svg class="ax-mk-ptr" viewBox="0 0 22 32" aria-hidden="true"><path d="M2 2v24l6-5.5 4 9 4-1.8-4-8.8h8z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>`); A11y.layer().appendChild(mkPtr); }
    return mkPtr;
  }
  function showPtr() {
    if (mp.x == null) { mp.x = A11y.pointer.x; mp.y = A11y.pointer.y; }
    const p = ptrEl(); p.classList.add("ax-on"); p.style.transform = `translate(${mp.x}px, ${mp.y}px)`; p.classList.toggle("ax-press", mp.down);
  }
  function target(x, y) { return document.elementFromPoint(x, y) || document.body; }
  function mouseEv(type, x, y, o) {
    const t = o && o.target || target(x, y);
    const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, screenX: x, screenY: y, button: (o && o.button) || 0, buttons: (o && o.buttons) || 0, detail: (o && o.detail) || 1, ctrlKey: !!(o && o.ctrl), shiftKey: !!(o && o.shift) };
    const ev = type.startsWith("pointer") ? new PointerEvent(type, Object.assign(init, { pointerId: 77, pointerType: "mouse", isPrimary: true, width: 1, height: 1, pressure: init.buttons ? 0.5 : 0 })) : new MouseEvent(type, init);
    t.dispatchEvent(ev); return ev;
  }
  function press(x, y, button) {
    const b = button === 2 ? 2 : 0, bs = b === 2 ? 2 : 1, t = target(x, y);
    const pd = mouseEv("pointerdown", x, y, { target: t, button: b, buttons: bs });
    const md = pd.defaultPrevented ? null : mouseEv("mousedown", x, y, { target: t, button: b, buttons: bs });
    if (!md || !md.defaultPrevented) {
      const f = t.closest && t.closest('a[href], button, input, select, textarea, [tabindex], [contenteditable="true"], [contenteditable=""]');
      try { if (f && !f.disabled) f.focus({ preventScroll: true }); else if (document.activeElement && document.activeElement !== document.body && !(document.activeElement.contains && document.activeElement.contains(t))) document.activeElement.blur(); } catch (_) {}
    }
    return t;
  }
  function release(x, y, button, downOn, detail) {
    const b = button === 2 ? 2 : 0, t = target(x, y);
    mouseEv("pointerup", x, y, { target: t, button: b }); mouseEv("mouseup", x, y, { target: t, button: b });
    if (b === 2) mouseEv("contextmenu", x, y, { target: t, button: 2 });
    else if (!downOn || downOn === t || downOn.contains(t) || t.contains(downOn)) { const c = new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, detail: detail || 1 }); t.dispatchEvent(c); }
  }
  function clickAt(x, y, button, detail) { const d = press(x, y, button); release(x, y, button, d, detail); }
  function dblAt(x, y) { clickAt(x, y, 0, 1); clickAt(x, y, 0, 2); target(x, y).dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, detail: 2 })); }
  let dragFrom = null;
  function step(ts) {
    mp.raf = 0;
    if (!mp.held.size) return;
    const dt = Math.min(64, ts - (mp.last || ts)); mp.last = ts;
    let dx = 0, dy = 0; mp.held.forEach((c) => { dx += DIRS[c][0]; dy += DIRS[c][1]; });
    dx = clamp(dx, -1, 1); dy = clamp(dy, -1, 1);
    const top = 60 + mk().speed * 9;                                   // px/s at full speed
    const ramp = 200 + (100 - mk().accel) * 30;                        // ms to reach full speed
    let v = 40 + (top - 40) * Math.min(1, (ts - mp.start) / ramp);
    if (mk().ctrl && mp.fast) v *= 3; if (mk().ctrl && mp.slow) v *= 0.3;
    mp.x = clamp(mp.x + dx * v * dt / 1000, 0, innerWidth - 1); mp.y = clamp(mp.y + dy * v * dt / 1000, 0, innerHeight - 1);
    showPtr();
    mouseEv("pointermove", mp.x, mp.y, { buttons: mp.down ? 1 : 0 }); mouseEv("mousemove", mp.x, mp.y, { buttons: mp.down ? 1 : 0 });
    A11y.pointer.x = mp.x; A11y.pointer.y = mp.y;
    mp.raf = requestAnimationFrame(step);
  }
  // code: "Numpad5" etc.; down: keydown(true) / keyup(false); mods: {ctrl, shift}. Also used by the OSK's numeric pad.
  function mouseKey(code, down, mods) {
    if (!mk().on || !NUMPAD.test(code)) return false;
    mp.fast = !!(mods && mods.ctrl); mp.slow = !!(mods && mods.shift);
    if (mp.x == null) { mp.x = A11y.pointer.x; mp.y = A11y.pointer.y; }
    if (DIRS[code]) {
      if (down) { if (!mp.held.size) { mp.start = performance.now(); mp.last = 0; } mp.held.add(code); if (!mp.raf) mp.raf = requestAnimationFrame(step); }
      else mp.held.delete(code);
      showPtr(); return true;
    }
    if (!down) return true;
    showPtr();
    if (code === "Numpad5") clickAt(mp.x, mp.y, mp.btn);
    else if (code === "NumpadAdd") dblAt(mp.x, mp.y);
    else if (code === "NumpadDivide") { mp.btn = 0; toast("Mouse keys: left button"); }
    else if (code === "NumpadMultiply") { mp.btn = 0; toast("Mouse keys: both buttons (left)"); }
    else if (code === "NumpadSubtract") { mp.btn = 2; toast("Mouse keys: right button"); }
    else if (code === "Numpad0") { if (!mp.down) { mp.down = true; dragFrom = press(mp.x, mp.y, 0); showPtr(); } }
    else if (code === "NumpadDecimal") { if (mp.down) { mp.down = false; release(mp.x, mp.y, 0, dragFrom); dragFrom = null; showPtr(); } }
    paintTray();
    return true;
  }
  function mouseHook(e) {
    if (e.code === "NumLock" && e.altKey && e.shiftKey && e.type === "keydown") {
      if (mk().on) { set("mk.on", false); beep(440, 120); toast("Mouse keys off"); return true; }
      if (mk().shortcut) A11y.prompt({ title: "Mouse Keys", html: "Do you want to turn on Mouse Keys?<br><br>Mouse Keys lets you use the numeric keypad to move the mouse pointer. The keyboard shortcut is Left Alt + Left Shift + Num Lock.", onYes: () => { set("mk.on", true); showPtr(); } });
      return true;
    }
    if (!mk().on || !NUMPAD.test(e.code || "")) return false;
    if (mk().numlock && !isApple && e.getModifierState && !e.getModifierState("NumLock")) return false;
    if (e.repeat) return true;
    return mouseKey(e.code, e.type === "keydown", { ctrl: e.ctrlKey, shift: e.shiftKey });
  }
  // A real mouse move takes the virtual pointer along.
  window.addEventListener("pointermove", (e) => { if (e.isTrusted && e.pointerType === "mouse" && mk().on) { mp.x = e.clientX; mp.y = e.clientY; if (mkPtr) mkPtr.classList.remove("ax-on"); } }, { capture: true, passive: true });

  // =====================================================================
  //  TASKBAR INDICATOR
  // =====================================================================
  let tray = null;
  function paintTray() {
    const tb = document.querySelector(".taskbar .tb-tray"); if (!tb) return;
    const c = cfg(), show = (c.sticky.on && c.sticky.tray) || (c.filter.on && c.filter.tray) || (c.mk.on && c.mk.tray);
    if (!show) { if (tray) { tray.remove(); tray = null; } return; }
    if (!tray || !tray.isConnected) {
      tray = el(`<button type="button" class="ax-tray" title="Keyboard accessibility" aria-label="Keyboard accessibility status"></button>`);
      tray.onclick = (e) => { e.stopPropagation(); A11y.openPage(c.mk.on && !c.sticky.on && !c.filter.on ? "ax-mouse" : "ax-keyboard"); };
      tb.insertBefore(tray, tb.querySelector(".tb-qs"));
    }
    const lab = isApple ? { shift: "⇧", ctrl: "Ctrl", alt: "⌥", meta: "⌘" } : { shift: "Shift", ctrl: "Ctrl", alt: "Alt", meta: "Win" };
    let h = "";
    if (c.sticky.on && c.sticky.tray) h += ["shift", "ctrl", "alt", "meta"].map((k) => `<i class="${latch[k] === 2 ? "ax-lock" : latch[k] ? "ax-lat" : ""}" title="${lab[k]} ${latch[k] === 2 ? "locked" : latch[k] ? "latched" : ""}">${lab[k]}</i>`).join("");
    if (c.filter.on && c.filter.tray) h += `<svg viewBox="0 0 24 24" aria-label="Filter keys on"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 3h5"/></svg>`;
    if (c.mk.on && c.mk.tray) h += `<svg viewBox="0 0 24 24" aria-label="Mouse keys on"><rect x="7" y="3" width="10" height="17" rx="5"/><path d="M12 3v6"/>${mp.down ? '<path d="M7.5 9h4.5V3.6" fill="currentColor"/>' : ""}</svg>`;
    tray.innerHTML = h;
  }
  A11y.on("shell", (n) => { if (n.classList && n.classList.contains("taskbar")) setTimeout(paintTray, 0); });
  on("change", (p) => {
    if (/^(sticky|filter|mk)\./.test(p)) paintTray();
    if (p === "sticky.on" && !sk().on) clearLatches();
    if (p === "mk.on" && !mk().on && mkPtr) { mkPtr.classList.remove("ax-on"); mp.held.clear(); }
    if (p === "mk.on" && mk().on) showPtr();
  });

  // ---- register hooks (core runs them from its first-in-page capture listener) ----
  A11y.keyHook(filterHook, { order: 10, trustedOnly: true });
  A11y.keyHook(stickyHook, { order: 20, trustedOnly: true });
  A11y.keyHook(toggleHook, { order: 30, trustedOnly: true });
  A11y.keyHook(mouseHook, { order: 40, trustedOnly: true });

  // =====================================================================
  //  SETTINGS: Keyboard, Mouse
  // =====================================================================
  const MS = [[300, "0.3 seconds"], [500, "0.5 seconds"], [700, "0.7 seconds"], [1000, "1 second"], [1400, "1.4 seconds"], [2000, "2 seconds"]];
  A11y.page("ax-keyboard", { title: "Keyboard", ic: "keyboard", section: "interaction", order: 2, desc: "Sticky, Filter and Toggle keys, on-screen keyboard", keywords: "sticky filter toggle keys osk on-screen shortcuts", build(h, H) {
    const c = cfg;
    h.appendChild(H.row({ ic: "keyboard", t: "Sticky keys", s: "Press one key at a time for keyboard shortcuts", ctl: H.toggle(() => c().sticky.on, (v) => set("sticky.on", v), "Sticky keys"), expand: (p) => {
      p.appendChild(H.check("Keyboard shortcut for Sticky keys (press Shift five times)", () => c().sticky.shortcut, (v) => set("sticky.shortcut", v)));
      p.appendChild(H.check("Show the Sticky keys icon on the taskbar", () => c().sticky.tray, (v) => set("sticky.tray", v)));
      p.appendChild(H.check("Lock shortcut keys when pressed twice in a row", () => c().sticky.lock, (v) => set("sticky.lock", v)));
      p.appendChild(H.check("Turn off Sticky keys when two keys are pressed at the same time", () => c().sticky.offTwo, (v) => set("sticky.offTwo", v)));
      p.appendChild(H.check("Play a sound when shortcut keys are pressed and released", () => c().sticky.sound, (v) => set("sticky.sound", v)));
    } }));
    h.appendChild(H.row({ ic: "keyboard", t: "Filter keys", s: "Ignore brief or repeated keystrokes and change keyboard repeat rates", ctl: H.toggle(() => c().filter.on, (v) => { set("filter.on", v); if (v && !c().filter.slow && !c().filter.bounce && !c().filter.repeat) set("filter.slow", true); }, "Filter keys"), expand: (p) => {
      p.appendChild(H.check("Keyboard shortcut for Filter keys (hold the right Shift key for 8 seconds)", () => c().filter.shortcut, (v) => set("filter.shortcut", v)));
      p.appendChild(H.check("Show the Filter keys icon on the taskbar", () => c().filter.tray, (v) => set("filter.tray", v)));
      p.appendChild(H.check("Beep when keys are pressed or accepted", () => c().filter.beep, (v) => set("filter.beep", v)));
      p.appendChild(H.check("Ignore quick keystrokes (Slow keys) — a key counts only after you hold it", () => c().filter.slow, (v) => set("filter.slow", v)));
      p.appendChild(H.line("Wait time before accepting a keystroke", H.select(MS, () => c().filter.slowMs, (v) => set("filter.slowMs", +v), "Slow keys wait time")));
      p.appendChild(H.check("Ignore unintended keystrokes (Bounce keys) — the same key again too soon is ignored", () => c().filter.bounce, (v) => set("filter.bounce", v)));
      p.appendChild(H.line("Ignore repeats within", H.select(MS, () => c().filter.bounceMs, (v) => set("filter.bounceMs", +v), "Bounce keys time")));
      p.appendChild(H.check("Ignore repeated keystrokes (Repeat keys) — slow down auto-repeat", () => c().filter.repeat, (v) => set("filter.repeat", v)));
      p.appendChild(H.line("Wait before starting to repeat", H.select(MS, () => c().filter.repeatDelay, (v) => set("filter.repeatDelay", +v), "Repeat delay")));
      p.appendChild(H.line("Wait between repeats", H.select(MS, () => c().filter.repeatRate, (v) => set("filter.repeatRate", +v), "Repeat rate")));
      const test = el(`<input class="ax-preview-input" placeholder="Type here to test your settings" aria-label="Test Filter keys">`); p.appendChild(test);
    } }));
    h.appendChild(H.row({ ic: "keyboard", t: "Toggle keys", s: "Play a sound when you press Caps Lock, Num Lock or Scroll Lock", ctl: H.toggle(() => c().toggle.on, (v) => set("toggle.on", v), "Toggle keys"), expand: (p) => {
      p.appendChild(H.check("Keyboard shortcut for Toggle keys (hold Num Lock for 5 seconds)", () => c().toggle.shortcut, (v) => set("toggle.shortcut", v)));
    } }));
    h.appendChild(H.row({ ic: "keyboard", t: "On-screen keyboard", s: (isApple ? "" : "Windows logo key + Ctrl + O, or ") + "Ctrl+Alt+O · types into the app you were using", ctl: H.toggle(() => !!A11y.act("oskOpen"), () => A11y.act("toggleOSK"), "On-screen keyboard") }));
    h.appendChild(H.row({ t: "Accessibility keyboard shortcuts", s: "Ctrl+Alt+U, Ctrl+Alt+Enter, Ctrl+Alt+=/-, Ctrl+Alt+C, Ctrl+Alt+H, Ctrl+Alt+O", ctl: H.toggle(() => c().keys.shortcuts, (v) => set("keys.shortcuts", v), "Accessibility keyboard shortcuts") }));
    h.appendChild(H.head("Keyboard shortcuts"));
    const rows = [["Ctrl+Alt+U", "Win+U", "Accessibility settings"], ["Ctrl+Alt+Enter", "Win+Ctrl+Enter", "Narrator on / off"], ["Ctrl+Alt+= / Ctrl+Alt+-", "Win+Plus / Win+Minus", "Magnifier zoom in / out"], ["Ctrl+Alt+Esc", "Win+Esc", "Close Magnifier"],
      ["Ctrl+Alt+M · F · D · I", "", "Magnifier: next view · full screen · docked · invert"], ["Ctrl+Alt+C", "Win+Ctrl+C", "Color filters on / off"], ["Ctrl+Alt+H", "Left Alt+Left Shift+PrtScn", "Contrast theme on / off"], ["Ctrl+Alt+O", "Win+Ctrl+O", "On-screen keyboard"],
      ["Shift ×5", "", "Sticky keys"], ["Hold Right Shift 8 s", "", "Filter keys"], ["Hold Num Lock 5 s", "", "Toggle keys"], ["Left Alt+Left Shift+Num Lock", "", "Mouse keys"]];
    h.appendChild(H.card(`<table class="ax-cmds"><tbody>${rows.map(([a, b, d]) => `<tr><td><span class="ax-kbd">${a}</span>${b && !isApple ? ` <span class="ax-kbd">${b}</span>` : ""}</td><td>${d}</td></tr>`).join("")}</tbody></table><div class="ax-s-note">These work only inside this Windows 12 page.${isApple ? " On iPad and Mac, Alt is the ⌥ Option key; ⌘ shortcuts belong to the browser." : ""}</div>`));
  } });
  A11y.page("ax-mouse", { title: "Mouse", ic: "mouse", section: "interaction", order: 3, desc: "Mouse keys, speed, acceleration", toggle: "mk.on", keywords: "mouse keys numeric keypad pointer", build(h, H) {
    const c = () => cfg().mk;
    h.appendChild(H.row({ ic: "mouse", t: "Mouse keys", s: "Use the numeric keypad to move the mouse pointer", ctl: H.toggle(() => c().on, (v) => set("mk.on", v), "Mouse keys"), expand: (p) => {
      p.appendChild(H.check("Keyboard shortcut for Mouse keys (Left Alt + Left Shift + Num Lock)", () => c().shortcut, (v) => set("mk.shortcut", v)));
      p.appendChild(H.check("Show the Mouse keys icon on the taskbar", () => c().tray, (v) => set("mk.tray", v)));
      p.appendChild(H.check("Only use Mouse keys when Num Lock is on", () => c().numlock, (v) => set("mk.numlock", v)));
      p.appendChild(H.check("Hold the Ctrl key to speed up and the Shift key to slow down", () => c().ctrl, (v) => set("mk.ctrl", v)));
    }, open: true }));
    h.appendChild(H.row({ t: "Mouse keys speed", ctl: H.slider(1, 100, 1, () => c().speed, (v) => set("mk.speed", v), { label: "Mouse keys speed" }) }));
    h.appendChild(H.row({ t: "Mouse keys acceleration", ctl: H.slider(1, 100, 1, () => c().accel, (v) => set("mk.accel", v), { label: "Mouse keys acceleration" }) }));
    h.appendChild(H.card(`<table class="ax-cmds"><tbody>${[["1–4, 6–9", "Move the pointer"], ["5", "Click"], ["+", "Double-click"], ["/ · −", "Left button · right button"], ["0 · .", "Press and hold · release (drag)"]].map(([a, b]) => `<tr><td><span class="ax-kbd">${a}</span></td><td>${b}</td></tr>`).join("")}</tbody></table><div class="ax-s-note">No numeric keypad (iPad keyboards)? Open the on-screen keyboard (Ctrl+Alt+O), choose Num pad, and its keys drive Mouse keys.</div>`));
    h.appendChild(H.row({ ic: "pointer", t: "Mouse pointer and touch", s: "Pointer size and color, touch indicator", sub: "ax-pointer" }));
  } });

  A11y.sendKey = sendKey;
  A11y.keys = { sendKey, insertText, latch, mouseKey, clickAt, focusTarget, codeFor, shiftChar, paintTray, isField, editable };
})();
