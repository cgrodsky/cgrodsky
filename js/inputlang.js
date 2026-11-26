/* Input languages & keyboard layouts (Windows 11 style).
   - Settings ▸ Time & language ▸ Language & region: add / remove / reorder input methods
     (English US/UK, Swedish, German QWERTZ, French AZERTY, Spanish, US-Dvorak, Russian ЙЦУКЕН,
     Greek, Japanese with a simple romaji → hiragana IME). Time & language ▸ Typing opens
     "Advanced keyboard settings" (default input method, per-window input method, hotkeys).
   - Taskbar input indicator ("ENG / US"): tap for the list, or Win+Space / Ctrl+Alt+Space
     (hold the modifiers, tap Space to move, release to switch). Left Alt+Shift and Ctrl+Shift
     switch straight to the next one (both can be turned off).
   - REAL remapping: while a non-US layout is active, keys from a hardware keyboard typed into
     text fields / text areas / contenteditable are translated by their physical position
     (KeyboardEvent.code) into that layout's characters, with Shift, Caps Lock, AltGr (Ctrl+Alt,
     or Option on a Mac/iPad keyboard) and dead keys (´ ` ^ ¨ ~ and Greek tonos) — the text is
     inserted at the caret so undo and input events keep working.
     On-screen / iOS virtual keyboard input (no `code`, "Unidentified", or IME composition)
     is never touched, and neither are Ctrl / Cmd shortcuts.
   State: State.data.appData.inputlang. Public API: window.InputLang. */
(function () {
  "use strict";
  if (window.InputLang) return;
  const S = () => State.data;
  const scr = () => document.getElementById("screen");
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const UA = navigator.userAgent || "";
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || (/Macintosh/.test(UA) && "ontouchend" in document);
  const desktopReady = () => !!document.querySelector(".desktop") && !document.querySelector(".boot-layer, .wsetup-screen");

  // =====================================================================
  //  Layout tables. Rows follow the physical keys (KeyboardEvent.code) of an ISO keyboard;
  //  each row is given as [normal, shift]. AltGr levels and dead keys are listed separately.
  // =====================================================================
  const ROWS = [
    ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"],
    ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Backslash"],
    ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"],
    ["IntlBackslash", "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"],
  ];
  const US_ROWS = ["`1234567890-=", "~!@#$%^&*()_+", "qwertyuiop[]\\", "QWERTYUIOP{}|", "asdfghjkl;'", "ASDFGHJKL:\"", "\\zxcvbnm,./", "|ZXCVBNM<>?"];
  const DEFS = [
    { id: "en-US", lang: "English (United States)", kbd: "US", abbr: "ENG", sub: "US", rows: US_ROWS, native: true },
    { id: "en-GB", lang: "English (United Kingdom)", kbd: "United Kingdom", abbr: "ENG", sub: "UK",
      rows: ["`1234567890-=", "¬!\"£$%^&*()_+", "qwertyuiop[]#", "QWERTYUIOP{}~", "asdfghjkl;'", "ASDFGHJKL:@", "\\zxcvbnm,./", "|ZXCVBNM<>?"],
      altgr: { Backquote: "¦", Digit4: "€", KeyE: "éÉ", KeyU: "úÚ", KeyI: "íÍ", KeyO: "óÓ", KeyA: "áÁ" } },
    { id: "sv-SE", lang: "Svenska (Sverige)", kbd: "Swedish", abbr: "SWE", sub: "SE",
      rows: ["§1234567890+´", "½!\"#¤%&/()=?`", "qwertyuiopå¨'", "QWERTYUIOPÅ^*", "asdfghjklöä", "ASDFGHJKLÖÄ", "<zxcvbnm,.-", ">ZXCVBNM;:_"],
      altgr: { Digit2: "@", Digit3: "£", Digit4: "$", Digit5: "€", Digit7: "{", Digit8: "[", Digit9: "]", Digit0: "}", Minus: "\\", BracketRight: "~", KeyE: "€", KeyM: "µ", IntlBackslash: "|" },
      dead: ["Equal:0", "Equal:1", "BracketRight:0", "BracketRight:1", "BracketRight:2"] },
    { id: "de-DE", lang: "Deutsch (Deutschland)", kbd: "German", abbr: "DEU", sub: "DE",
      rows: ["^1234567890ß´", "°!\"§$%&/()=?`", "qwertzuiopü+#", "QWERTZUIOPÜ*'", "asdfghjklöä", "ASDFGHJKLÖÄ", "<yxcvbnm,.-", ">YXCVBNM;:_"],
      altgr: { Digit2: "²", Digit3: "³", Digit7: "{", Digit8: "[", Digit9: "]", Digit0: "}", Minus: "\\", KeyQ: "@", KeyE: "€", BracketRight: "~", IntlBackslash: "|", KeyM: "µ" },
      dead: ["Backquote:0", "Equal:0", "Equal:1"] },
    { id: "fr-FR", lang: "Français (France)", kbd: "French", abbr: "FRA", sub: "FR",
      rows: ["²&é\"'(-è_çà)=", "²1234567890°+", "azertyuiop^$*", "AZERTYUIOP¨£µ", "qsdfghjklmù", "QSDFGHJKLM%", "<wxcvbn,;:!", ">WXCVBN?./§"],
      altgr: { Digit2: "~", Digit3: "#", Digit4: "{", Digit5: "[", Digit6: "|", Digit7: "`", Digit8: "\\", Digit9: "^", Digit0: "@", Minus: "]", Equal: "}", KeyE: "€", BracketRight: "¤" },
      dead: ["BracketLeft:0", "BracketLeft:1", "Digit2:2", "Digit7:2"] },
    { id: "es-ES", lang: "Español (España)", kbd: "Spanish", abbr: "ESP", sub: "ES",
      rows: ["º1234567890'¡", "ª!\"·$%&/()=?¿", "qwertyuiop`+ç", "QWERTYUIOP^*Ç", "asdfghjklñ´", "ASDFGHJKLÑ¨", "<zxcvbnm,.-", ">ZXCVBNM;:_"],
      altgr: { Backquote: "\\", Digit1: "|", Digit2: "@", Digit3: "#", Digit4: "~", Digit5: "€", Digit6: "¬", KeyE: "€", BracketLeft: "[", BracketRight: "]", Quote: "{", Backslash: "}" },
      dead: ["BracketLeft:0", "BracketLeft:1", "Quote:0", "Quote:1"] },
    { id: "en-US-dvorak", lang: "English (United States)", kbd: "United States-Dvorak", abbr: "ENG", sub: "DV",
      rows: ["`1234567890[]", "~!@#$%^&*(){}", "',.pyfgcrl/=\\", "\"<>PYFGCRL?+|", "aoeuidhtns-", "AOEUIDHTNS_", "\\;qjkxbmwvz", "|:QJKXBMWVZ"] },
    { id: "ru-RU", lang: "Русский (Россия)", kbd: "Russian", abbr: "RUS", sub: "RU",
      rows: ["ё1234567890-=", "Ё!\"№;%:?*()_+", "йцукенгшщзхъ\\", "ЙЦУКЕНГШЩЗХЪ/", "фывапролджэ", "ФЫВАПРОЛДЖЭ", "\\ячсмитьбю.", "/ЯЧСМИТЬБЮ,"] },
    { id: "el-GR", lang: "Ελληνικά (Ελλάδα)", kbd: "Greek", abbr: "ELL", sub: "GR",
      rows: ["`1234567890-=", "~!@#$%^&*()_+", ";ςερτυθιοπ[]\\", ":΅ΕΡΤΥΘΙΟΠ{}|", "ασδφγηξκλ΄'", "ΑΣΔΦΓΗΞΚΛ¨\"", "<ζχψωβνμ,./", ">ΖΧΨΩΒΝΜ<>?"],
      altgr: { Digit2: "²", Digit3: "³", Digit4: "£", Digit5: "§", Digit6: "¶", Digit8: "¤", Digit9: "¦", Digit0: "°", Minus: "±", Equal: "½", KeyE: "€", KeyR: "®", KeyY: "¥", BracketLeft: "«", BracketRight: "»", Backslash: "¬", KeyC: "©" },
      dead: ["Semicolon:0", "Semicolon:1", "KeyW:1"] },
    { id: "ja-JP", lang: "日本語 (日本)", kbd: "Microsoft IME (romaji → hiragana)", abbr: "JPN", sub: "JP", rows: US_ROWS, ime: true },
  ];
  // Build code → [normal, shift, altgr, shift+altgr] maps
  const LAYOUTS = {};
  DEFS.forEach((d) => {
    const map = {};
    ROWS.forEach((codes, r) => {
      const n = Array.from(d.rows[r * 2]), s = Array.from(d.rows[r * 2 + 1]);
      codes.forEach((c, i) => { if (n[i] != null) map[c] = [n[i], s[i] != null ? s[i] : n[i], null, null]; });
    });
    Object.keys(d.altgr || {}).forEach((c) => { const v = Array.from(d.altgr[c]); if (!map[c]) map[c] = [null, null, null, null]; map[c][2] = v[0]; map[c][3] = v[1] || null; });
    const dead = new Set(d.dead || []);
    LAYOUTS[d.id] = Object.assign({}, d, { map, dead });
  });
  const COMBINING = { "´": "\u0301", "`": "\u0300", "^": "\u0302", "¨": "\u0308", "~": "\u0303", "΄": "\u0301", "΅": "\u0308\u0301" };
  function compose(dead, base) {
    const m = COMBINING[dead]; if (!m || !base) return null;
    const c = (base + m).normalize("NFC");
    return Array.from(c).length === 1 ? c : null;
  }

  // ---- romaji → hiragana (a small, predictable subset of Microsoft IME) ----
  const ROMA = (function () {
    const R = {}, V = "aiueo";
    const rows = { "": "あいうえお", k: "かきくけこ", g: "がぎぐげご", s: "さしすせそ", z: "ざじずぜぞ", t: "たちつてと", d: "だぢづでど", n: "なにぬねの", h: "はひふへほ", b: "ばびぶべぼ", p: "ぱぴぷぺぽ", m: "まみむめも", r: "らりるれろ", x: "ぁぃぅぇぉ", l: "ぁぃぅぇぉ", c: "かしくせこ", f: "ふぁふぃふふぇふぉ" };
    Object.keys(rows).forEach((c) => { if (c === "f") return; Array.from(rows[c]).forEach((k, i) => { R[c + V[i]] = k; }); });
    Object.assign(R, { fa: "ふぁ", fi: "ふぃ", fu: "ふ", fe: "ふぇ", fo: "ふぉ", ya: "や", yi: "い", yu: "ゆ", ye: "いぇ", yo: "よ", wa: "わ", wi: "うぃ", wu: "う", we: "うぇ", wo: "を",
      shi: "し", chi: "ち", tsu: "つ", ji: "じ", "n'": "ん", xn: "ん", xtu: "っ", ltu: "っ", xtsu: "っ", ltsu: "っ", xya: "ゃ", xyu: "ゅ", xyo: "ょ", lya: "ゃ", lyu: "ゅ", lyo: "ょ", xwa: "ゎ", vu: "ゔ", qa: "くぁ", qi: "くぃ", qe: "くぇ", qo: "くぉ", thi: "てぃ", dhi: "でぃ", twu: "とぅ" });
    const Y = { ky: "き", gy: "ぎ", sy: "し", sh: "し", zy: "じ", jy: "じ", j: "じ", ch: "ち", ty: "ち", cy: "ち", dy: "ぢ", ny: "に", hy: "ひ", by: "び", py: "ぴ", my: "み", ry: "り" };
    Object.keys(Y).forEach((k) => { R[k + "a"] = Y[k] + "ゃ"; R[k + "u"] = Y[k] + "ゅ"; R[k + "o"] = Y[k] + "ょ"; if (/^(sh|j|ch)$/.test(k)) R[k + "e"] = Y[k] + "ぇ"; });
    const P = new Set(); Object.keys(R).forEach((k) => { for (let i = 1; i < k.length; i++) P.add(k.slice(0, i)); });
    function convert(buf) {
      let out = "";
      while (buf) {
        if (R[buf]) { out += R[buf]; buf = ""; break; }
        if (buf.length >= 2 && buf[0] === buf[1] && /[bcdfghjkmpqrstvwxyz]/.test(buf[0])) { out += "っ"; buf = buf.slice(1); continue; }
        if (buf[0] === "n" && buf.length >= 2 && !/[aiueoy']/.test(buf[1])) { out += "ん"; buf = buf.slice(1); continue; }
        if (P.has(buf)) break;
        out += buf[0]; buf = buf.slice(1);
      }
      return { out, rest: buf };
    }
    const PUNCT = { "-": "ー", ",": "、", ".": "。", "[": "「", "]": "」", "/": "・", "~": "〜" };
    return { R, convert, PUNCT };
  })();

  // =====================================================================
  //  State
  // =====================================================================
  function cfg() {
    const d = S(); d.appData = d.appData || {};
    let c = d.appData.inputlang;
    if (!c || typeof c !== "object") c = d.appData.inputlang = {};
    if (!Array.isArray(c.list) || !c.list.length) c.list = [I18nDefault()];
    c.list = c.list.filter((id, i, a) => LAYOUTS[id] && a.indexOf(id) === i);
    if (!c.list.length) c.list = ["en-US"];
    if (!LAYOUTS[c.cur] || c.list.indexOf(c.cur) < 0) c.cur = (c.override && c.list.indexOf(c.override) >= 0) ? c.override : c.list[0];
    if (c.override && c.list.indexOf(c.override) < 0) c.override = "";
    if (c.ctrlShift == null) c.ctrlShift = true;
    if (c.altShift == null) c.altShift = true;
    if (c.perApp == null) c.perApp = false;
    if (c.indicator == null) c.indicator = true;
    if (c.ime == null) c.ime = true; // Japanese: hiragana mode on
    return c;
  }
  function I18nDefault() { return window.I18n && I18n.lang === "sv" ? "sv-SE" : "en-US"; }
  function save() { try { State.save(); } catch (e) {} }
  const cur = () => LAYOUTS[cfg().cur] || LAYOUTS["en-US"];
  const listeners = new Set();
  function emit() { listeners.forEach((f) => { try { f(); } catch (e) {} }); paintIndicator(); try { window.dispatchEvent(new CustomEvent("inputlangchange", { detail: { id: cfg().cur } })); } catch (e) {} }

  // per-window input methods
  const winLayout = new WeakMap();
  let activeWin = null;
  function setLayout(id, opts) {
    opts = opts || {};
    const c = cfg(); if (!LAYOUTS[id] || c.list.indexOf(id) < 0) return false;
    resetTyping();
    const changed = c.cur !== id;
    c.cur = id;
    if (c.perApp && activeWin && !opts.fromFocus) winLayout.set(activeWin, id);
    save(); emit();
    if (changed && !opts.quiet) flashIndicator();
    return true;
  }
  function cycle(dir) {
    const c = cfg(); if (c.list.length < 2) return;
    const i = c.list.indexOf(c.cur);
    setLayout(c.list[(i + (dir || 1) + c.list.length) % c.list.length]);
  }
  function defaultLayout() { const c = cfg(); return c.override && c.list.indexOf(c.override) >= 0 ? c.override : c.list[0]; }
  function onWindowFocus(win) {
    if (win === activeWin) return;
    activeWin = win;
    const c = cfg(); if (!c.perApp || !win) return;
    const want = winLayout.get(win) || defaultLayout();
    if (want !== c.cur) setLayout(want, { fromFocus: true, quiet: true });
  }
  ["pointerdown", "focusin"].forEach((t) => document.addEventListener(t, (e) => {
    const w = e.target && e.target.closest && e.target.closest("#screen > .win");
    if (w) onWindowFocus(w);
  }, true));

  // =====================================================================
  //  Typing: physical key → layout character
  // =====================================================================
  function editable(t) {
    if (!t || t.nodeType !== 1) return null;
    if (t.closest && t.closest("[data-il2-native]")) return null;
    if (t.tagName === "TEXTAREA") return t.readOnly || t.disabled ? null : t;
    if (t.tagName === "INPUT") { const ty = (t.getAttribute("type") || "text").toLowerCase(); return /^(text|search|url|tel|password|email)$/.test(ty) && !t.readOnly && !t.disabled ? t : null; }
    if (t.isContentEditable) return t;
    return null;
  }
  const isField = (t) => t.tagName === "TEXTAREA" || t.tagName === "INPUT";
  function insertText(t, text) {
    let ok = false;
    try { ok = document.execCommand("insertText", false, text); } catch (e) { ok = false; }
    if (ok) return;
    if (isField(t)) {
      try {
        const a = t.selectionStart, b = t.selectionEnd;
        t.setRangeText(text, a, b, "end");
        t.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      } catch (e) { t.value += text; t.dispatchEvent(new Event("input", { bubbles: true })); }
    } else {
      const sel = window.getSelection(); if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0); r.deleteContents(); const n = document.createTextNode(text); r.insertNode(n);
      r.setStartAfter(n); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
      t.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }
  }
  // Replace the n characters before the caret with text (romaji → kana).
  function replaceBefore(t, n, text) {
    if (isField(t)) {
      const end = t.selectionStart; try { t.setSelectionRange(Math.max(0, end - n), t.selectionEnd); } catch (e) {}
    } else {
      const sel = window.getSelection(); if (sel && sel.modify) for (let i = 0; i < n; i++) sel.modify("extend", "backward", "character");
    }
    insertText(t, text);
  }
  function textBefore(t, n) {
    if (isField(t)) { const e = t.selectionStart; return e == null ? null : t.value.slice(Math.max(0, e - n), e); }
    const sel = window.getSelection(); if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
    const r = sel.getRangeAt(0); if (r.startContainer.nodeType !== 3) return null;
    return r.startContainer.nodeValue.slice(Math.max(0, r.startOffset - n), r.startOffset);
  }

  let pendingDead = null;           // { ch, target }
  let romaji = { buf: "", target: null };
  function resetTyping() { pendingDead = null; romaji = { buf: "", target: null }; }
  document.addEventListener("focusout", () => resetTyping(), true);
  document.addEventListener("pointerdown", (e) => { if (!(e.target && e.target.closest && e.target.closest(".il2-ind, .il2-fly"))) resetTyping(); }, true);

  function charFor(L, e) {
    const k = L.map[e.code]; if (!k) return null;
    const altgr = e.altKey || (e.getModifierState && e.getModifierState("AltGraph"));
    let shift = e.shiftKey;
    let level = altgr ? (shift ? 3 : 2) : (shift ? 1 : 0);
    // Caps Lock flips letters (keys whose shifted value is the uppercase of the normal one)
    if (!altgr && e.getModifierState && e.getModifierState("CapsLock") && k[0] && k[0] !== k[0].toUpperCase() && k[0].toUpperCase() === k[1]) level = shift ? 0 : 1;
    const ch = k[level];
    if (!ch) return null;
    return { ch, dead: L.dead.has(e.code + ":" + level) };
  }

  function onTypingKey(e) {
    const L = cur();
    if (L.native && !(L.ime)) return false;
    if (e.isComposing || e.keyCode === 229) return false;
    if (!e.code || e.code === "Unidentified") return false;            // virtual / on-screen keyboards
    if (e.metaKey || (e.ctrlKey && !e.altKey)) return false;            // shortcuts
    const t = editable(e.target); if (!t) return false;
    // keys that are not characters (Enter, Backspace, arrows, Tab, F-keys …)
    if (!L.map[e.code]) {
      if (e.code === "Space" && !e.ctrlKey && !e.altKey) {
        if (pendingDead && pendingDead.target === t) { e.preventDefault(); e.stopPropagation(); const d = pendingDead.ch; pendingDead = null; insertText(t, d); return true; }
        if (L.ime && romaji.target === t && romaji.buf === "n" && textBefore(t, 1) === "n") { replaceBefore(t, 1, "ん"); }
      }
      if (e.code === "Backspace" && L.ime && romaji.target === t && romaji.buf) { romaji.buf = romaji.buf.slice(0, -1); return false; }
      if (/^(Shift|Control|Alt|Meta|OS|CapsLock|Fn)/.test(e.code)) return false; // modifiers keep a pending dead key
      if (L.ime && romaji.target === t && romaji.buf === "n" && e.code === "Enter" && textBefore(t, 1) === "n") replaceBefore(t, 1, "ん");
      pendingDead = null; if (L.ime) romaji = { buf: "", target: null };
      return false;
    }
    if (L.ime) return onImeKey(L, e, t);
    const r = charFor(L, e);
    if (!r) return false; // e.g. AltGr+key with nothing on it → leave the shortcut alone
    e.preventDefault(); e.stopPropagation();
    if (pendingDead && pendingDead.target !== t) pendingDead = null;
    if (pendingDead) {
      const d = pendingDead.ch; pendingDead = null;
      if (r.dead) { insertText(t, d + r.ch); return true; }
      const c = compose(d, r.ch);
      insertText(t, c || d + r.ch);
      return true;
    }
    if (r.dead) { pendingDead = { ch: r.ch, target: t }; return true; }
    insertText(t, r.ch);
    return true;
  }
  function onImeKey(L, e, t) {
    const c = cfg();
    if (!c.ime || e.altKey) { romaji = { buf: "", target: null }; return false; } // alphanumeric mode: plain US
    const r = charFor(L, e); if (!r) return false;
    const ch = r.ch;
    if (/^[a-z']$/.test(ch) && !e.shiftKey) {
      e.preventDefault(); e.stopPropagation();
      if (romaji.target !== t || (romaji.buf && textBefore(t, romaji.buf.length) !== romaji.buf)) romaji = { buf: "", target: t };
      const prev = romaji.buf, res = ROMA.convert(prev + ch);
      const text = res.out + res.rest;
      if (prev.length) replaceBefore(t, prev.length, text); else insertText(t, text);
      romaji.buf = res.rest;
      return true;
    }
    // punctuation in hiragana mode
    if (ROMA.PUNCT[ch]) {
      e.preventDefault(); e.stopPropagation();
      if (romaji.target === t && romaji.buf === "n" && textBefore(t, 1) === "n") replaceBefore(t, 1, "ん");
      romaji = { buf: "", target: null };
      insertText(t, ROMA.PUNCT[ch]);
      return true;
    }
    romaji = { buf: "", target: null };
    return false; // digits, uppercase etc. pass through natively
  }

  // =====================================================================
  //  Hotkeys: Win+Space / Ctrl+Alt+Space switcher, Alt+Shift / Ctrl+Shift, Alt+` (IME mode)
  // =====================================================================
  let sw = null;         // { idx, mods, el }
  let chord = null;      // "ctrl" | "alt" while only Ctrl/Alt + Shift are down
  function own(e) { e.preventDefault(); e.stopPropagation(); }
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.shiftKey) {
      const meta = e.metaKey && !e.ctrlKey && !e.altKey;
      const ca = e.ctrlKey && e.altKey && !e.metaKey;
      if ((meta || ca) && (sw || cfg().list.length > 1)) { own(e); chord = null; if (!sw) openSwitcher(meta ? "meta" : "ctrlalt"); else moveSwitcher(1); return; }
    }
    if (sw) {
      if (e.key === "Escape") { own(e); closeSwitcher(false); return; }
      if (e.key === "Enter") { own(e); closeSwitcher(true); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { own(e); moveSwitcher(e.key === "ArrowDown" ? 1 : -1); return; }
    }
    // Alt+` toggles the Japanese IME between hiragana and alphanumeric
    if (e.code === "Backquote" && e.altKey && !e.ctrlKey && !e.metaKey && cur().ime) { own(e); toggleIme(); return; }
    if (e.key === "Shift" && !e.metaKey && (e.ctrlKey !== e.altKey)) chord = e.ctrlKey ? "ctrl" : "alt";
    else if ((e.key === "Control" || e.key === "Alt") && e.shiftKey && !e.metaKey && !(e.ctrlKey && e.altKey)) chord = e.key === "Control" ? "ctrl" : "alt";
    else if (!/^(Shift|Control|Alt)$/.test(e.key)) chord = null;
    if (!desktopReady()) return;
    if (onTypingKey(e)) chord = null;
  }, true);
  window.addEventListener("keyup", (e) => {
    if (sw) {
      const done = sw.mods === "meta" ? (e.key === "Meta" || e.key === "OS" || !e.metaKey) : (e.key === "Control" || e.key === "Alt" || !(e.ctrlKey && e.altKey));
      if (done) closeSwitcher(true);
      return;
    }
    if (chord && /^(Shift|Control|Alt)$/.test(e.key)) {
      const c = cfg(), which = chord; chord = null;
      if ((which === "ctrl" && c.ctrlShift) || (which === "alt" && c.altShift)) cycle(1);
    }
  }, true);
  window.addEventListener("blur", () => { chord = null; if (sw) closeSwitcher(true); });

  function openSwitcher(mods) {
    const c = cfg();
    const idx = (c.list.indexOf(c.cur) + 1) % c.list.length;
    const box = el(`<div class="il2-switch gbs-skip" role="listbox" aria-label="Input methods"></div>`);
    (scr() || document.body).appendChild(box);
    sw = { idx, mods, el: box };
    paintSwitcher();
  }
  function paintSwitcher() {
    if (!sw) return;
    const c = cfg();
    sw.el.innerHTML = c.list.map((id, i) => { const L = LAYOUTS[id]; return `<div class="il2-sw-it${i === sw.idx ? " on" : ""}" role="option" aria-selected="${i === sw.idx}" data-id="${id}"><span class="il2-ab">${esc(L.abbr)}<small>${esc(L.sub)}</small></span><span class="il2-sw-tx"><b>${esc(L.lang)}</b><span>${esc(L.kbd)}</span></span></div>`; }).join("") + `<div class="il2-sw-hint">${sw.mods === "meta" ? "Windows" : "Ctrl+Alt"} + Space to switch</div>`;
    sw.el.querySelectorAll(".il2-sw-it").forEach((it, i) => { it.onpointerdown = (ev) => { ev.preventDefault(); sw.idx = i; closeSwitcher(true); }; });
  }
  function moveSwitcher(d) { if (!sw) return; const n = cfg().list.length; sw.idx = (sw.idx + d + n) % n; paintSwitcher(); }
  function closeSwitcher(commit) {
    if (!sw) return;
    const s = sw; sw = null; s.el.remove();
    if (commit) setLayout(cfg().list[s.idx]);
  }
  function toggleIme() { const c = cfg(); c.ime = !c.ime; resetTyping(); save(); emit(); }

  // =====================================================================
  //  Taskbar input indicator + flyout
  // =====================================================================
  let fly = null;
  function paintIndicator() {
    const tray = document.querySelector(".taskbar .tb-tray");
    const c = cfg(), L = cur();
    let b = document.querySelector(".il2-ind"), m = document.querySelector(".il2-ime");
    const want = !!tray && c.indicator && c.list.length > 1 && desktopReady();
    if (!want) { if (b) b.remove(); if (m) m.remove(); if (fly) closeFly(); return; }
    if (!b || b.parentNode !== tray) {
      if (b) b.remove();
      b = el(`<button class="il2-ind" type="button"><span class="il2-ind-a"></span><span class="il2-ind-b"></span></button>`);
      b.addEventListener("click", (e) => { e.stopPropagation(); if (fly) closeFly(); else openFly(b); });
      const qs = tray.querySelector(".tb-qs");
      tray.insertBefore(b, qs || tray.firstChild);
    }
    b.dataset.layout = L.id;
    b.querySelector(".il2-ind-a").textContent = L.abbr;
    b.querySelector(".il2-ind-b").textContent = L.sub;
    b.title = L.lang + "\n" + L.kbd + "\n\nTo switch input methods, press Windows key + Space" + (isApple ? " (on iPad/Mac: Ctrl + Option + Space)" : " or Ctrl + Alt + Space") + ".";
    b.setAttribute("aria-label", "Input indicator: " + L.lang + ", " + L.kbd);
    // Japanese IME mode button (あ / A), left of the language
    if (L.ime) {
      if (!m || m.parentNode !== tray) {
        if (m) m.remove();
        m = el(`<button class="il2-ime" type="button"></button>`);
        m.addEventListener("click", (e) => { e.stopPropagation(); toggleIme(); });
        tray.insertBefore(m, b);
      }
      m.textContent = c.ime ? "あ" : "A";
      m.title = (c.ime ? "Hiragana" : "Half-width alphanumeric") + " — click or press Alt + ` to switch";
    } else if (m) m.remove();
    if (fly) paintFly();
  }
  function flashIndicator() { const b = document.querySelector(".il2-ind"); if (!b) return; b.classList.remove("il2-flash"); void b.offsetWidth; b.classList.add("il2-flash"); }
  function openFly(anchor) {
    closeFly();
    fly = el(`<div class="il2-fly gbs-skip" role="dialog" aria-label="Input methods"></div>`);
    (scr() || document.body).appendChild(fly);
    const r = anchor.getBoundingClientRect();
    fly.style.right = Math.max(8, innerWidth - r.right - 40) + "px";
    paintFly();
    anchor.classList.add("on");
    setTimeout(() => { document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", flyKey, true); }, 0);
  }
  function outside(e) { if (fly && !fly.contains(e.target) && !e.target.closest(".il2-ind")) closeFly(); }
  function flyKey(e) { if (e.key === "Escape" && fly) { e.preventDefault(); closeFly(); } }
  function closeFly() { if (fly) { fly.remove(); fly = null; } const b = document.querySelector(".il2-ind"); if (b) b.classList.remove("on"); document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", flyKey, true); }
  function paintFly() {
    if (!fly) return;
    const c = cfg();
    fly.innerHTML = `<div class="il2-fly-list">${c.list.map((id) => { const L = LAYOUTS[id]; return `<button class="il2-fly-it${id === c.cur ? " on" : ""}" data-id="${id}"><span class="il2-ab">${esc(L.abbr)}<small>${esc(L.sub)}</small></span><span class="il2-sw-tx"><b>${esc(L.lang)}</b><span>${esc(L.kbd)}</span></span></button>`; }).join("")}</div>
      ${cur().ime ? `<button class="il2-fly-ime">${c.ime ? "あ  Hiragana" : "A  Half-width alphanumeric"} <small>Alt + \`</small></button>` : ""}
      <div class="il2-fly-foot"><button class="il2-link" data-a="more">More keyboard settings</button><button class="il2-link" data-a="lang">Language preferences</button></div>`;
    fly.querySelectorAll(".il2-fly-it").forEach((b) => b.onclick = () => { setLayout(b.dataset.id); closeFly(); });
    const ib = fly.querySelector(".il2-fly-ime"); if (ib) ib.onclick = () => toggleIme();
    fly.querySelector('[data-a="more"]').onclick = () => { closeFly(); openSettings("il2keyboard"); };
    fly.querySelector('[data-a="lang"]').onclick = () => { closeFly(); openSettings("language"); };
  }
  (function watchTaskbar() {
    const s = scr(); if (!s) { document.addEventListener("DOMContentLoaded", watchTaskbar); return; }
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(paintIndicator, 120); }).observe(s, { childList: true });
    setTimeout(paintIndicator, 500);
  })();

  // =====================================================================
  //  Settings integration
  // =====================================================================
  const T = {
    time: ["Time & language", "Tid och språk"],
    language: ["Language & region", "Språk och region"],
    typing: ["Typing", "Skriva"],
    display: ["Windows display language", "Visningsspråk för Windows"],
  };
  const svgI = (p) => `<svg class="w12s-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="url(#w12s-g)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON = {
    kbd: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    lang: '<path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 4-3 7-7 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
    sw: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    win: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01"/>',
    ind: '<rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M14 17h4M7 4l3 6M13 4l-3 6"/>',
  };
  const DISPLAY_LANGS = ["en", "sv"]; // the only display languages with a translated interface
  function selectEl(pairs, val, onChange, label) {
    const s = el(`<select class="w12s-select" aria-label="${esc(label || "")}">${pairs.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`);
    s.addEventListener("click", (e) => e.stopPropagation());
    s.onchange = () => onChange(s.value);
    return s;
  }
  function toggleEl(on, onChange, label) {
    const t = el(`<label class="w12s-sw"><input type="checkbox" ${on ? "checked" : ""} aria-label="${esc(label || "")}"><span></span></label>`);
    t.addEventListener("click", (e) => e.stopPropagation());
    t.querySelector("input").onchange = (e) => onChange(e.target.checked);
    return t;
  }
  function row(ic, t, s, opts) {
    opts = opts || {};
    const click = !!opts.onClick;
    const r = el(`<div class="w12s-row ${click ? "w12s-click" : "w12s-row-static"} il2-row" tabindex="${click ? 0 : -1}"><span class="w12s-row-ic">${svgI(ICON[ic] || ICON.kbd)}</span><div class="w12s-row-txt"><div class="w12s-row-t"></div><div class="w12s-row-s"></div></div><div class="w12s-row-ctl"></div>${click ? `<span class="w12s-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span>` : ""}</div>`);
    r.querySelector(".w12s-row-t").textContent = t;
    r.querySelector(".w12s-row-s").textContent = s || "";
    if (opts.ctl) r.querySelector(".w12s-row-ctl").appendChild(opts.ctl);
    if (click) { r.onclick = opts.onClick; r.addEventListener("keydown", (e) => { if (e.key === "Enter") opts.onClick(); }); }
    return r;
  }
  function displayPairs() {
    const langs = (window.I18n && I18n.languages) || [{ code: "en", name: "English (United States)" }];
    return langs.filter((l) => DISPLAY_LANGS.indexOf(l.code) >= 0).map((l) => [l.code, l.name]);
  }
  function setDisplay(v) {
    if (!window.I18n) return;
    I18n.set(v);
    if (window.Notify) try { Notify.show({ icon: Icon.mini("settings", "Settings"), title: "Settings", body: v === "sv" ? "Visningsspråket är nu svenska." : "Display language changed." }); } catch (e) {}
  }

  // "Language & region" — preferred languages / keyboards
  function buildLanguageSection(h, redraw) {
    const c = cfg();
    const box = el(`<div class="il2-inject il2-langs"></div>`);
    box.appendChild(el(`<div class="il2-s-h">Language</div>`));
    const disp = (window.I18n && I18n.lang) || "en";
    box.appendChild(row("lang", "Windows display language", "Settings, File Explorer and other Windows features appear in this language. Only English and Swedish have a translated interface.", { ctl: selectEl(displayPairs(), DISPLAY_LANGS.indexOf(disp) >= 0 ? disp : "en", (v) => { setDisplay(v); redraw(); }, "Windows display language") }));
    const head = row("kbd", "Preferred languages", "Keyboards you can switch between with Windows + Space or the input indicator", { ctl: el(`<button class="w12s-btn w12s-btn-accent il2-add" type="button">Add a language</button>`) });
    head.querySelector(".il2-add").onclick = (e) => { e.stopPropagation(); addDialog(box, () => redraw()); };
    box.appendChild(head);
    const list = el(`<div class="il2-list" role="list"></div>`);
    c.list.forEach((id, i) => {
      const L = LAYOUTS[id];
      const it = el(`<div class="il2-it${id === c.cur ? " cur" : ""}" role="listitem" data-id="${id}"><span class="il2-ab">${esc(L.abbr)}<small>${esc(L.sub)}</small></span><div class="il2-it-tx"><b>${esc(L.lang)}</b><span>${esc(L.kbd)}${i === 0 ? " · default" : ""}${id === c.cur ? " · in use" : ""}</span></div>
        <div class="il2-it-b"><button class="il2-ib" data-a="use" title="Use now" ${id === c.cur ? "disabled" : ""}>Use</button><button class="il2-ib" data-a="up" title="Move up" aria-label="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button class="il2-ib" data-a="down" title="Move down" aria-label="Move down" ${i === c.list.length - 1 ? "disabled" : ""}>↓</button><button class="il2-ib" data-a="rm" title="Remove" aria-label="Remove" ${c.list.length < 2 ? "disabled" : ""}>✕</button></div></div>`);
      it.querySelector('[data-a="use"]').onclick = () => { setLayout(id); redraw(); };
      it.querySelector('[data-a="up"]').onclick = () => { move(id, -1); redraw(); };
      it.querySelector('[data-a="down"]').onclick = () => { move(id, 1); redraw(); };
      it.querySelector('[data-a="rm"]').onclick = () => { remove(id); redraw(); };
      list.appendChild(it);
    });
    box.appendChild(list);
    box.appendChild(row("sw", "Typing", "Advanced keyboard settings — default input method, switching, per-window input", { onClick: () => openKeyboardPage(h) }));
    h.appendChild(box);
  }
  function move(id, d) { const c = cfg(), i = c.list.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= c.list.length) return; c.list.splice(i, 1); c.list.splice(j, 0, id); save(); emit(); }
  function add(id) { const c = cfg(); if (!LAYOUTS[id] || c.list.indexOf(id) >= 0) return false; c.list.push(id); save(); emit(); return true; }
  function remove(id) { const c = cfg(); if (c.list.length < 2) return false; const i = c.list.indexOf(id); if (i < 0) return false; c.list.splice(i, 1); if (c.cur === id) c.cur = defaultLayout(); if (c.override === id) c.override = ""; save(); emit(); return true; }
  function addDialog(host, done) {
    const c = cfg();
    const ov = el(`<div class="il2-dlg-mask"><div class="il2-dlg" role="dialog" aria-label="Choose a language to install"><h3>Choose a language to install</h3><input class="il2-dlg-q" placeholder="Type a language name" aria-label="Search languages"><div class="il2-dlg-list"></div><div class="il2-dlg-b"><button class="w12s-btn" data-a="cancel">Cancel</button><button class="w12s-btn w12s-btn-accent" data-a="ok" disabled>Install</button></div></div></div>`);
    let pick = null;
    const paint = () => {
      const q = ov.querySelector(".il2-dlg-q").value.trim().toLowerCase();
      const lst = ov.querySelector(".il2-dlg-list"); lst.innerHTML = "";
      DEFS.filter((d) => c.list.indexOf(d.id) < 0 && (!q || (d.lang + " " + d.kbd + " " + d.abbr).toLowerCase().includes(q))).forEach((d) => {
        const b = el(`<button class="il2-dlg-it${pick === d.id ? " on" : ""}" data-id="${d.id}"><span class="il2-ab">${esc(d.abbr)}<small>${esc(d.sub)}</small></span><span class="il2-sw-tx"><b>${esc(d.lang)}</b><span>${esc(d.kbd)} keyboard</span></span></button>`);
        b.onclick = () => { pick = d.id; ov.querySelector('[data-a="ok"]').disabled = false; paint(); };
        b.ondblclick = () => { pick = d.id; finish(); };
        lst.appendChild(b);
      });
      if (!lst.children.length) lst.appendChild(el(`<div class="il2-dim">No more languages to add.</div>`));
    };
    const close = () => ov.remove();
    const finish = () => { if (pick) add(pick); close(); done && done(); };
    ov.querySelector(".il2-dlg-q").oninput = paint;
    ov.querySelector('[data-a="cancel"]').onclick = close;
    ov.querySelector('[data-a="ok"]').onclick = finish;
    ov.addEventListener("pointerdown", (e) => { if (e.target === ov) close(); });
    ov.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    paint();
    (host.closest(".w12s") || host).appendChild(ov);
    setTimeout(() => { try { ov.querySelector(".il2-dlg-q").focus(); } catch (e) {} }, 30);
  }

  // "Advanced keyboard settings"
  function buildKeyboardPage(h, redraw) {
    const c = cfg();
    h.classList.add("il2-page");
    h.appendChild(row("kbd", "Override for default input method", "If you want a different input method than the first one in your language list, choose it here", {
      ctl: selectEl([["", "Use language list (recommended)"]].concat(c.list.map((id) => [id, LAYOUTS[id].lang + " — " + LAYOUTS[id].kbd])), c.override || "", (v) => { cfg().override = v; save(); emit(); }, "Default input method"),
    }));
    h.appendChild(el(`<div class="il2-s-h">Switching input methods</div>`));
    h.appendChild(row("win", "Let me use a different input method for each app window", "Each window remembers the keyboard you used in it", { ctl: toggleEl(c.perApp, (v) => { cfg().perApp = v; save(); }, "Per-window input method") }));
    h.appendChild(row("sw", "Use Left Alt + Shift to switch input methods", "Press and release both keys", { ctl: toggleEl(c.altShift, (v) => { cfg().altShift = v; save(); }, "Alt+Shift") }));
    h.appendChild(row("sw", "Use Ctrl + Shift to switch input methods", "Press and release both keys", { ctl: toggleEl(c.ctrlShift, (v) => { cfg().ctrlShift = v; save(); }, "Ctrl+Shift") }));
    h.appendChild(row("ind", "Show the input indicator on the taskbar", "Shown when you have more than one input method", { ctl: toggleEl(c.indicator, (v) => { cfg().indicator = v; save(); paintIndicator(); }, "Input indicator") }));
    h.appendChild(el(`<div class="il2-note">Windows + Space or Ctrl + Alt + Space shows the switcher: keep holding the first keys and tap Space to move, let go to switch.${isApple ? " On an iPad or Mac keyboard, Cmd + Space is taken by the system — use Ctrl + Option + Space." : ""} Layouts only change what a <b>hardware keyboard</b> types; the iPad on-screen keyboard keeps its own language (change it with its globe key).</div>`));
    // Try it: live keyboard map of the current layout
    const tryBox = el(`<div class="w12s-card il2-try"><div class="il2-try-h"><b>Try it</b><span class="il2-try-cur"></span></div><textarea class="il2-try-ta" rows="2" placeholder="Type here with your keyboard to test the current layout"></textarea><div class="il2-kbd" aria-hidden="true"></div></div>`);
    h.appendChild(tryBox);
    const paintKbd = () => {
      if (!tryBox.isConnected && tryBox.__seen) { listeners.delete(paintKbd); return; }
      const L = cur();
      tryBox.querySelector(".il2-try-cur").textContent = L.lang + " — " + L.kbd + (L.ime ? (cfg().ime ? " (hiragana)" : " (alphanumeric)") : "");
      tryBox.querySelector(".il2-kbd").innerHTML = ROWS.map((codes, r) => `<div class="il2-kr il2-kr${r}">${codes.map((code) => { const k = L.map[code] || [" ", " "]; const dead = L.dead.has(code + ":0"); return `<span class="il2-k${dead ? " dead" : ""}" data-code="${code}"><i>${esc(k[1] && k[1] !== (k[0] || "").toUpperCase() ? k[1] : "")}</i>${esc(k[0] || "")}${k[2] ? `<em>${esc(k[2])}</em>` : ""}</span>`; }).join("")}</div>`).join("");
    };
    paintKbd(); requestAnimationFrame(() => { tryBox.__seen = true; });
    listeners.add(paintKbd);
    const ta = tryBox.querySelector(".il2-try-ta");
    ta.addEventListener("keydown", (e) => { const k = tryBox.querySelector(`.il2-k[data-code="${e.code}"]`); if (k) { k.classList.add("down"); setTimeout(() => k.classList.remove("down"), 160); } });
  }
  const MY_SUBS = { il2keyboard: { title: "Advanced keyboard settings", parent: "time", build: buildKeyboardPage } };
  window.SettingsSubs = window.SettingsSubs || {};
  if (!Object.prototype.hasOwnProperty.call(window.SettingsSubs, "il2keyboard")) window.SettingsSubs.il2keyboard = MY_SUBS.il2keyboard;

  function navTo(page, id) { const root = page.closest(".w12s"); const a = root && root.querySelector(`.w12s-nav-it[data-p="${id}"]`); if (a) a.click(); }
  function renderMine(page, key) {
    const sp = MY_SUBS[key]; const root = page.closest(".w12s"); if (!sp || !root) return;
    root.querySelectorAll(".w12s-nav-it").forEach((a) => a.classList.toggle("on", a.dataset.p === sp.parent));
    const parentA = root.querySelector(`.w12s-nav-it[data-p="${sp.parent}"]`);
    page.innerHTML = ""; page.scrollTop = 0;
    const head = el(`<h1 class="w12s-title"><a class="w12s-crumb"></a><span class="w12s-crumb-sep">›</span><span class="il2-ttl"></span></h1>`);
    const pName = parentA && (parentA.lastElementChild || parentA);
    head.querySelector(".w12s-crumb").textContent = pName ? pName.textContent.trim() : "Time & language";
    head.querySelector(".il2-ttl").textContent = sp.title;
    head.querySelector(".w12s-crumb").onclick = () => navTo(page, sp.parent);
    page.appendChild(head);
    const box = el(`<div class="w12s-list" data-il2-page="${key}"></div>`); page.appendChild(box);
    sp.build(box, () => renderMine(page, key));
  }
  function openKeyboardPage(fromEl) {
    const page = fromEl && fromEl.closest && fromEl.closest(".w12s-page");
    if (page) renderMine(page, "il2keyboard"); else openSettings("il2keyboard");
  }
  function openSettings(key) {
    const page = document.querySelector(".win .w12s-page");
    if (page) {
      const win = page.closest(".win"); if (win) { win.style.display = ""; win.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); }
      if (key === "il2keyboard") return renderMine(page, key);
      navTo(page, "time");
      const r = [...page.querySelectorAll(".w12s-row")].find((x) => { const t = x.querySelector(".w12s-row-t"); return t && T.language.includes(t.textContent.trim()); });
      if (r) r.click();
      return;
    }
    window.SettingsStartPage = key;
    if (window.WM) WM.open("settings");
  }
  const titleOf = (page) => {
    const h1 = page.querySelector("h1.w12s-title"); if (!h1) return null;
    const crumb = h1.querySelector(".w12s-crumb");
    return { crumb: !!crumb, title: (crumb ? (h1.lastChild && h1.lastChild.textContent) || "" : h1.textContent).trim() };
  };
  function enhance(page) {
    const t = titleOf(page); if (!t) return;
    const list = page.querySelector(".w12s-list"); if (!list || list.dataset.il2Page || list.dataset.ilPage) return;
    if (!t.crumb && T.time.includes(t.title)) {
      // Time & language: honest display-language list, and Typing opens Advanced keyboard settings
      list.querySelectorAll(":scope > .w12s-row").forEach((r) => {
        const tt = r.querySelector(".w12s-row-t"); if (!tt) return;
        const name = tt.textContent.trim();
        if (T.display.includes(name) && !r.__il2) {
          r.__il2 = true;
          const s = r.querySelector("select"); if (s) {
            [...s.options].forEach((o) => { if (DISPLAY_LANGS.indexOf(o.value) < 0) { if (o.selected) o.textContent = o.textContent + " (setup screens only)"; else o.remove(); } });
          }
        }
        if (T.typing.includes(name) && !r.__il2) {
          r.__il2 = true;
          r.classList.remove("w12s-row-static"); r.classList.add("w12s-click"); r.tabIndex = 0;
          r.querySelector(".w12s-row-s").textContent = "Keyboards, input switching, per-window input method";
          if (!r.querySelector(".w12s-chev")) r.appendChild(el(`<span class="w12s-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span>`));
          r.onclick = () => renderMine(page, "il2keyboard");
          r.addEventListener("keydown", (e) => { if (e.key === "Enter") renderMine(page, "il2keyboard"); });
        }
      });
    } else if (t.crumb && T.language.includes(t.title) && !page.querySelector(".il2-inject")) {
      // replace the static "Windows display language" line with the real picker (it lives in our section)
      list.querySelectorAll(":scope > .w12s-row").forEach((r) => { const tt = r.querySelector(".w12s-row-t"); if (tt && T.display.includes(tt.textContent.trim())) r.remove(); });
      const redraw = () => { const x = page.querySelector(".il2-inject"); if (x) x.remove(); buildLanguageSection(list, redraw); };
      buildLanguageSection(list, redraw);
    }
  }
  function hookSettingsWin(win) {
    const page = win.querySelector && win.querySelector(".w12s-page");
    if (!page || page.__il2) return;
    page.__il2 = true;
    new MutationObserver(() => enhance(page)).observe(page, { childList: true });
    enhance(page);
  }
  (function watchSettings() {
    const s = scr(); if (!s) { document.addEventListener("DOMContentLoaded", watchSettings); return; }
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains("win")) setTimeout(() => hookSettingsWin(n), 0); }))).observe(s, { childList: true });
    s.querySelectorAll(".win").forEach(hookSettingsWin);
  })();

  // Swedish phrase book additions for the new interface text (real translations only)
  try {
    if (window.SvPhrases && SvPhrases.phrases) Object.assign(SvPhrases.phrases, {
      "Preferred languages": "Önskade språk", "Add a language": "Lägg till ett språk", "Advanced keyboard settings": "Avancerade tangentbordsinställningar",
      "More keyboard settings": "Fler tangentbordsinställningar", "Language preferences": "Språkinställningar", "Choose a language to install": "Välj ett språk att installera",
      "Install": "Installera", "Switching input methods": "Byta inmatningsmetod", "Try it": "Prova",
    });
  } catch (e) {}

  window.InputLang = {
    layouts: () => DEFS.map((d) => ({ id: d.id, lang: d.lang, kbd: d.kbd, abbr: d.abbr, sub: d.sub })),
    list: () => cfg().list.slice(), current: () => cfg().cur, set: setLayout, next: () => cycle(1), prev: () => cycle(-1),
    add, remove, move, config: cfg, imeOn: () => !!cfg().ime, toggleIme,
    map: (id, code) => { const L = LAYOUTS[id || cfg().cur]; return L && L.map[code] ? L.map[code].slice() : null; },
    on: (f) => { listeners.add(f); return () => listeners.delete(f); },
    openSettings, paint: paintIndicator, romaji: (s) => ROMA.convert(s),
  };
})();
