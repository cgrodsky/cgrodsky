/* =====================================================================
   Windows 11 Accessibility — On-Screen Keyboard (js/a11y-osk.js)
   Load late: after js/a11y-keys.js (and after js/wm.js — this replaces the
   tiny window.OSK that js/wm.js defines; js/settings12.js and
   js/systools.js call OSK.show() / OSK.hide()).

   REAL: a floating, draggable, resizable keyboard (Ctrl+Alt+O). Keys never
   take focus (pointerdown / touchstart are cancelled, like the emoji panel in
   js/powertools.js), so the caret stays where it was. Every key goes through
   A11y.sendKey → real keydown / keypress / keyup events + the browser default
   (typing with undo, Backspace, arrows, Enter, Tab, Ctrl+A/C/X/V/Z…).
   Shift latches for one key, Ctrl / Alt / Win latch until the next key (so
   Ctrl + Alt + V really opens Clipboard history), Caps Lock toggles.
   Numeric pad toggle; with Mouse keys on, the pad moves the pointer.
   Text prediction from a built-in word list + words you type (this device).
   iPad: while it's open, text fields get inputmode="none" so the iPad's own
   keyboard stays away.
   ===================================================================== */
(function () {
  "use strict";
  if (!window.A11y || !A11y.keys || A11y.osk) return;
  const { cfg, set, el, ui, clamp } = A11y;
  const K = A11y.keys;
  const isApple = A11y.isApple;
  const touchy = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const o = () => cfg().osk;
  const pf = () => { const d = State.data; if (!d.appData) d.appData = {}; return d.appData.settings12 || (d.appData.settings12 = {}); };

  // [label, key, code, width, cls, shiftLabel]
  const R = (s) => [...s].map((c) => [c, c]);
  const MAIN = [
    [["Esc", "Escape", "Escape", 1, "fn"], ["`", "`", "Backquote", 1, "", "~"], ...R("1234567890").map(([c]) => [c, c, "Digit" + c, 1, "", K.shiftChar(c)]), ["-", "-", "Minus", 1, "", "_"], ["=", "=", "Equal", 1, "", "+"], ["⌫", "Backspace", "Backspace", 2, "fn rep", null, "Backspace"]],
    [["Tab", "Tab", "Tab", 1.5, "fn"], ...R("qwertyuiop").map(([c]) => [c, c, "Key" + c.toUpperCase(), 1]), ["[", "[", "BracketLeft", 1, "", "{"], ["]", "]", "BracketRight", 1, "", "}"], ["\\", "\\", "Backslash", 1.5, "", "|"]],
    [["Caps", "CapsLock", "CapsLock", 1.8, "fn mod"], ...R("asdfghjkl").map(([c]) => [c, c, "Key" + c.toUpperCase(), 1]), [";", ";", "Semicolon", 1, "", ":"], ["'", "'", "Quote", 1, "", '"'], ["Enter", "Enter", "Enter", 2.2, "fn"]],
    [["Shift", "Shift", "ShiftLeft", 2.3, "fn mod"], ...R("zxcvbnm").map(([c]) => [c, c, "Key" + c.toUpperCase(), 1]), [",", ",", "Comma", 1, "", "<"], [".", ".", "Period", 1, "", ">"], ["/", "/", "Slash", 1, "", "?"], ["↑", "ArrowUp", "ArrowUp", 1, "fn rep"], ["Shift", "Shift", "ShiftRight", 1.7, "fn mod"]],
    [["Ctrl", "Control", "ControlLeft", 1.3, "fn mod"], [isApple ? "⌘" : "⊞", "Meta", "MetaLeft", 1.2, "fn mod"], ["Alt", "Alt", "AltLeft", 1.2, "fn mod"], ["", " ", "Space", 6.3, "rep"], ["Alt", "Alt", "AltRight", 1.2, "fn mod"], ["Ctrl", "Control", "ControlRight", 1.2, "fn mod"], ["←", "ArrowLeft", "ArrowLeft", 1, "fn rep"], ["↓", "ArrowDown", "ArrowDown", 1, "fn rep"], ["→", "ArrowRight", "ArrowRight", 1, "fn rep"]],
  ];
  const NAV = [[["Home", "Home", "Home"], ["PgUp", "PageUp", "PageUp"]], [["End", "End", "End"], ["PgDn", "PageDown", "PageDown"]], [["Ins", "Insert", "Insert"], ["Del", "Delete", "Delete"]], [["PrtScn", "PrintScreen", "PrintScreen"], ["Menu", "ContextMenu", "ContextMenu"]], [["Nav", "", "", "nav"], ["Num", "", "", "num"]]];
  const NUM = [[["7", "Numpad7"], ["8", "Numpad8"], ["9", "Numpad9"], ["/", "NumpadDivide"]], [["4", "Numpad4"], ["5", "Numpad5"], ["6", "Numpad6"], ["*", "NumpadMultiply"]], [["1", "Numpad1"], ["2", "Numpad2"], ["3", "Numpad3"], ["-", "NumpadSubtract"]], [["0", "Numpad0", 2], [".", "NumpadDecimal"], ["+", "NumpadAdd"]], [["Enter", "NumpadEnter", 4]]];
  const WORDS = ("the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are were been has had did said made thank thanks hello hi please yes okay sorry great today tomorrow morning night home school help love need here where why very more much many right left next last long little old big high small large different important place world life hand part child eye woman man week case point government company number group problem fact family friend minute hour money water book word game music video photo picture email message window windows settings keyboard screen file folder document open close save print search start before again always never maybe really still every something nothing everything someone anyone thing things should must might may let put keep find tell ask show try call feel leave turn move play run read write learn change follow stop create speak allow add spend grow begin walk win offer remember consider appear buy wait serve send expect build stay fall cut reach kill remain suggest raise pass sell require report decide pull").split(" ");
  const learned = () => (o().learned = o().learned || {});

  let box = null, numOn = false, navOn = true, mods = { shift: false, ctrl: false, alt: false, meta: false }, caps = false, rep = null;
  const lab = (k) => k.querySelector("span");
  function build() {
    if (box) return box;
    box = el(`<div class="ax-osk ax-ui" role="dialog" aria-label="On-Screen Keyboard">
      <div class="ax-osk-head"><b>On-Screen Keyboard</b><button type="button" data-a="num" aria-pressed="false" title="Numeric keypad">Num pad</button><button type="button" data-a="opts" title="Options" aria-haspopup="true">Options</button><button type="button" data-a="close" title="Close (Ctrl+Alt+O)" aria-label="Close">✕</button></div>
      <div class="ax-osk-pred" aria-label="Text suggestions"></div>
      <div class="ax-osk-body"><div class="ax-osk-main"></div><div class="ax-osk-nav ax-osk-main"></div><div class="ax-osk-num" hidden></div></div>
      <span class="ax-osk-grip" title="Resize" aria-hidden="true"></span>
    </div>`);
    const main = box.querySelector(".ax-osk-body > .ax-osk-main:not(.ax-osk-nav)"), nav = box.querySelector(".ax-osk-nav"), num = box.querySelector(".ax-osk-num");
    MAIN.forEach((row) => { const r = el(`<div class="ax-osk-row"></div>`); row.forEach((d) => r.appendChild(key({ label: d[0], key: d[1], code: d[2], w: d[3], cls: d[4] || "", alt: d[5] }))); main.appendChild(r); });
    NAV.forEach((row) => { const r = el(`<div class="ax-osk-row"></div>`); row.forEach((d) => r.appendChild(key({ label: d[0], key: d[1], code: d[2], w: 1.15, cls: "fn" + (d[3] ? " ax-tog-" + d[3] : ""), act: d[3] }))); nav.appendChild(r); });
    NUM.forEach((row) => { const r = el(`<div class="ax-osk-row"></div>`); row.forEach((d) => r.appendChild(key({ label: d[0], key: d[0] === "Enter" ? "Enter" : d[0], code: d[1], w: d[2] || 1, cls: "num rep", np: true }))); num.appendChild(r); });
    ui(box, "pointerdown", (e) => { if (!e.target.closest("input, select")) e.preventDefault(); });
    ui(box, "mousedown", (e) => { if (!e.target.closest("input, select")) e.preventDefault(); });
    ui(box, "touchstart", (e) => { if (!e.target.closest("input, select, .ax-osk-head, .ax-osk-grip")) e.preventDefault(); });
    ui(box, "click", (e) => { const b = e.target.closest(".ax-osk-head button, .ax-osk-pred button"); if (b) headClick(b); });
    // keys act on pointerdown (fast on touch, and the field keeps focus)
    ui(box, "pointerdown", (e) => { const k = e.target.closest(".ax-key"); if (k) press(k, e); const pb = e.target.closest(".ax-osk-pred button"); if (pb && pb.__w) { click(); usePred(pb.__w); } });
    const up = (e) => { if (rep) { clearTimeout(rep.t); clearInterval(rep.i); if (rep.np) K.mouseKey(rep.code, false, {}); const k = rep.k; rep = null; k.classList.remove("ax-down"); } };
    ui(box, "pointerup", up); ui(box, "pointercancel", up); window.addEventListener("blur", up);
    dragify(box.querySelector(".ax-osk-head"), false); dragify(box.querySelector(".ax-osk-grip"), true);
    A11y.layer().appendChild(box);
    return box;
  }
  function key(d) {
    const k = el(`<button type="button" class="ax-key ${d.cls.split(" ").filter(Boolean).map((c) => "ax-" + c).join(" ")}" tabindex="-1"><span></span></button>`);
    k.style.width = `calc(var(--ax-u) * ${d.w} + ${Math.max(0, d.w - 1) * 4}px)`;
    k.__d = d; lab(k).textContent = d.label;
    if (d.alt) { const sm = document.createElement("small"); sm.textContent = d.alt; k.prepend(sm); }
    if (d.key === " ") k.setAttribute("aria-label", "Space");
    return k;
  }
  function paint() {
    if (!box) return;
    const sh = mods.shift;
    box.querySelectorAll(".ax-key").forEach((k) => {
      const d = k.__d; if (!d || d.np || d.act) return;
      if (/^[a-z]$/.test(d.key)) lab(k).textContent = (sh !== caps) ? d.key.toUpperCase() : d.key;
      else if (d.alt) { lab(k).textContent = sh ? d.alt : d.label; }
      const m = { Shift: "shift", Control: "ctrl", Alt: "alt", Meta: "meta" }[d.key];
      if (m) k.classList.toggle("ax-latched", !!mods[m]);
      if (d.key === "CapsLock") k.classList.toggle("ax-latched", caps);
    });
    box.querySelector(".ax-osk-num").hidden = !numOn;
    box.querySelector(".ax-osk-nav").hidden = !navOn;
    const nb = box.querySelector('[data-a="num"]'); nb.setAttribute("aria-pressed", String(numOn)); nb.classList.toggle("ax-on", numOn);
    box.querySelectorAll(".ax-tog-num").forEach((k) => k.classList.toggle("ax-latched", numOn));
    box.querySelectorAll(".ax-tog-nav").forEach((k) => k.classList.toggle("ax-latched", navOn));
  }
  function click() { if (o().sound) A11y.beep(1900, 14, 0.05); }
  function press(k, e) {
    const d = k.__d; if (!d) return;
    click(); k.classList.add("ax-down");
    if (d.act === "num") { numOn = !numOn; set("osk.numpad", numOn); paint(); place(); return; }
    if (d.act === "nav") { navOn = !navOn; paint(); place(); return; }
    const m = { Shift: "shift", Control: "ctrl", Alt: "alt", Meta: "meta" }[d.key];
    if (m) { mods[m] = !mods[m]; paint(); return; }
    if (d.key === "CapsLock") { caps = !caps; sendRaw(d); paint(); return; }
    if (d.np && K.mouseKey(d.code, true, { ctrl: mods.ctrl, shift: mods.shift })) { rep = { k, code: d.code, np: true, t: 0, i: 0 }; return; }
    const fire = () => sendRaw(d);
    fire();
    if (/\brep\b/.test(d.cls) || d.key.length === 1) rep = { k, t: setTimeout(() => { rep && (rep.i = setInterval(fire, 70)); }, 520), i: 0 };
  }
  function sendRaw(d) {
    let key = d.key;
    if (d.np) key = d.code === "NumpadEnter" ? "Enter" : d.label;
    else if (key.length === 1) { const up = mods.shift !== caps; key = /^[a-z]$/.test(key) ? (up ? key.toUpperCase() : key) : mods.shift ? K.shiftChar(key) : key; }
    const spec = { key, code: d.code, shift: mods.shift || (caps && false), ctrl: mods.ctrl, alt: mods.alt, meta: mods.meta, location: d.np ? 3 : /Right$/.test(d.code) ? 2 : 0 };
    K.sendKey(spec);
    if (d.key !== "CapsLock" && (mods.shift || mods.ctrl || mods.alt || mods.meta)) { mods = { shift: false, ctrl: false, alt: false, meta: false }; paint(); }
    if (key.length === 1 || key === "Backspace") predict(); else if (key !== "Shift") clearPred();
    if (key === " " || key === "Enter") learnLast();
  }

  // ---------------------------------------------------------------- prediction
  function fieldWord() {
    const t = K.focusTarget(); if (!t || !K.editable(t) || !K.isField(t)) return null;
    const s = t.selectionStart; if (s == null || s !== t.selectionEnd) return null;
    const m = t.value.slice(0, s).match(/([A-Za-z']+)$/); return { t, s, w: m ? m[1] : "" };
  }
  function clearPred() { if (box) box.querySelector(".ax-osk-pred").innerHTML = ""; }
  function predict() {
    if (!box || !o().predict) { clearPred(); return; }
    const fw = fieldWord(), host = box.querySelector(".ax-osk-pred");
    if (!fw || !fw.w) { host.innerHTML = ""; return; }
    const p = fw.w.toLowerCase(), L = learned();
    const cand = Object.keys(L).filter((w) => w.startsWith(p) && w !== p).sort((a, b) => L[b] - L[a]).concat(WORDS.filter((w) => w.toLowerCase().startsWith(p) && w.toLowerCase() !== p));
    const uniq = [...new Set(cand)].slice(0, 5);
    const cap = /^[A-Z]/.test(fw.w);
    host.innerHTML = "";
    uniq.forEach((w) => { const b = el(`<button type="button" tabindex="-1"></button>`); b.textContent = cap ? w[0].toUpperCase() + w.slice(1) : w; b.__w = b.textContent; host.appendChild(b); });
  }
  function learnLast() {
    const t = K.focusTarget(); if (!t || !K.isField(t)) return;
    const m = t.value.slice(0, t.selectionStart || 0).match(/([A-Za-z']{3,})[^A-Za-z']*$/); if (!m) return;
    const w = m[1].toLowerCase(), L = learned(); L[w] = (L[w] || 0) + 1;
    const keys = Object.keys(L); if (keys.length > 400) { keys.sort((a, b) => L[a] - L[b]).slice(0, 100).forEach((k) => delete L[k]); }
    A11y.save();
  }
  function usePred(w) {
    const fw = fieldWord(); if (!fw) return;
    fw.t.setSelectionRange(fw.s - fw.w.length, fw.s);
    K.insertText(fw.t, w + " "); learnLast(); clearPred();
  }

  // ---------------------------------------------------------------- header, options, drag / resize
  let optMenu = null;
  function headClick(b) {
    if (b.__w) return;   // handled on pointerdown
    const a = b.dataset.a;
    if (a === "close") hide();
    else if (a === "num") { numOn = !numOn; set("osk.numpad", numOn); paint(); place(); }
    else if (a === "opts") {
      if (optMenu) { optMenu.remove(); optMenu = null; return; }
      optMenu = el(`<div class="ax-menu ax-ui" role="menu"></div>`);
      [["Text prediction", "predict"], ["Use click sound", "sound"]].forEach(([l, k]) => {
        const mb = el(`<button type="button" role="menuitemcheckbox"></button>`); mb.textContent = l; mb.setAttribute("aria-checked", String(!!o()[k]));
        ui(mb, "click", () => { set("osk." + k, !o()[k]); optMenu.remove(); optMenu = null; if (k === "predict") predict(); }); optMenu.appendChild(mb);
      });
      const cad = el(`<button type="button" role="menuitem">Ctrl + Alt + Del</button>`); ui(cad, "click", () => { optMenu.remove(); optMenu = null; if (window.SecScreen) SecScreen.show(); }); optMenu.appendChild(cad);
      const st = el(`<button type="button" role="menuitem">Keyboard settings…</button>`); ui(st, "click", () => { optMenu.remove(); optMenu = null; A11y.openPage("ax-keyboard"); }); optMenu.appendChild(st);
      ui(optMenu, "pointerdown", (e) => e.preventDefault());
      A11y.layer().appendChild(optMenu);
      const r = b.getBoundingClientRect(); optMenu.style.left = clamp(r.left, 4, innerWidth - 200) + "px"; optMenu.style.top = Math.max(4, r.top - optMenu.offsetHeight - 6) + "px";
    }
  }
  function dragify(h, resize) {
    let d = null;
    ui(h, "pointerdown", (e) => {
      if (!resize && e.target.closest("button")) return;
      e.preventDefault(); d = { x: e.clientX, y: e.clientY, l: box.offsetLeft, t: box.offsetTop, u: unit(), w: box.offsetWidth };
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
    });
    ui(h, "pointermove", (e) => {
      if (!d) return;
      if (resize) { const nu = clamp(d.u * (d.w + (e.clientX - d.x)) / d.w, 26, 80); box.style.setProperty("--ax-u", nu + "px"); }
      else { box.style.left = clamp(d.l + e.clientX - d.x, -box.offsetWidth + 80, innerWidth - 80) + "px"; box.style.top = clamp(d.t + e.clientY - d.y, 0, innerHeight - 40) + "px"; }
    });
    const up = () => { if (!d) return; d = null; set("osk.x", box.offsetLeft); set("osk.y", box.offsetTop); if (resize) set("osk.u", unit()); };
    ui(h, "pointerup", up); ui(h, "pointercancel", up);
  }
  const unit = () => parseFloat(getComputedStyle(box).getPropertyValue("--ax-u")) || 44;
  function fitUnit() {
    const units = 15.4 + (navOn ? 2.6 : 0) + (numOn ? 4.4 : 0);
    return clamp(Math.floor((innerWidth - 40 - units * 4) / units), 24, 52);
  }
  function place() {
    if (!box) return;
    box.style.setProperty("--ax-u", (o().u || fitUnit()) + "px");
    if (box.offsetWidth > innerWidth - 8) box.style.setProperty("--ax-u", fitUnit() + "px");
    const x = o().x, y = o().y, w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = (x == null ? Math.round((innerWidth - w) / 2) : clamp(x, -w + 80, innerWidth - 80)) + "px";
    box.style.top = (y == null ? Math.max(4, innerHeight - h - 60) : clamp(y, 0, innerHeight - 40)) + "px";
  }

  // ---------------------------------------------------------------- iPad: keep the iPad keyboard away while the OSK is open
  function noVK(t) { if (!touchy || !t || !K.editable(t) || t.dataset.axIm != null) return; t.dataset.axIm = t.getAttribute("inputmode") || ""; t.setAttribute("inputmode", "none"); }
  function restoreVK() { document.querySelectorAll("[data-ax-im]").forEach((t) => { const v = t.dataset.axIm; if (v) t.setAttribute("inputmode", v); else t.removeAttribute("inputmode"); delete t.dataset.axIm; }); }
  document.addEventListener("focusin", (e) => { if (isOpen()) { noVK(e.target); setTimeout(predict, 0); } }, true);

  // ---------------------------------------------------------------- show / hide
  function isOpen() { return !!(box && box.style.display !== "none" && box.isConnected); }
  function show() {
    build(); numOn = !!o().numpad; box.style.display = ""; paint(); place();
    pf().osk = true; A11y.save(); noVK(K.focusTarget()); predict();
    A11y.emit("change", "osk.open", true); A11y.emit("announce", "On-Screen Keyboard");
  }
  function hide() {
    if (box) box.style.display = "none"; if (optMenu) { optMenu.remove(); optMenu = null; }
    mods = { shift: false, ctrl: false, alt: false, meta: false };
    pf().osk = false; A11y.save(); restoreVK(); A11y.emit("change", "osk.open", false);
  }
  function toggle() { if (isOpen()) hide(); else show(); }
  window.addEventListener("resize", () => { if (isOpen()) place(); });
  Object.assign(A11y.actions, { toggleOSK: toggle, oskOpen: isOpen });
  // Not running after a reload (like osk.exe) — keep settings12's switch honest.
  try { if (State.data.appData && State.data.appData.settings12 && State.data.appData.settings12.osk) { State.data.appData.settings12.osk = false; } } catch (_) {}
  window.OSK = { show, hide, toggle, isOpen };
  A11y.osk = { show, hide, toggle, isOpen, mods: () => mods };
})();
