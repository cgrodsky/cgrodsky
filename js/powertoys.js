/* Microsoft PowerToys for Windows 12 — Settings app + five utilities:
   Color Picker, Always on Top, PowerRename, Text Extractor and Shortcut Guide.
   Open: Start → "PowerToys", or the PowerToys icon in the taskbar tray (quick access).

   Default activation shortcuts (all editable in PowerToys Settings; Win-key versions only on PC keyboards —
   the Windows key never reaches a web page on iPad / Mac, where ⌘ belongs to the browser):
     Color Picker      Ctrl+Alt+Shift+C   (Win+Shift+C)
     Always on Top     Ctrl+Alt+T         (Win+Ctrl+T)   also: right-click / long-press a title bar
     PowerRename       Ctrl+Alt+Shift+N   (renames the File Explorer selection; also in Explorer's right-click menu)
     Text Extractor    Ctrl+Alt+Shift+T   (Win+Shift+T)
     Shortcut Guide    Ctrl+Alt+Shift+/   (hold Win on PC keyboards; long-press Start on touch)

   What is REAL here:
   - Color Picker uses the browser's native EyeDropper (desktop Chrome / Edge — samples real screen pixels,
     even outside the browser). Elsewhere (iPad / Safari / Firefox) it renders the Windows 12 screen into a
     canvas with GBSnap (js/gamebar.js) and samples that, with a magnifier. HEX/RGB/HSL/HSV/CMYK/CIELAB are
     computed exactly (sRGB, D65). The chosen format is written to the real clipboard. History persists.
   - Always on Top really keeps the window above every other window, across focus changes.
   - PowerRename really renames nodes of the virtual file system (State.data.appData.files), skips
     read-only items, validates names like Windows, and can undo the last rename.
   - Text Extractor reads the real text that is on screen inside the rectangle (DOM text — exact, no OCR
     needed). Text inside pictures / canvases is read with the browser's TextDetector API when it exists;
     otherwise it says so (no OCR engine is bundled or downloaded).
   - Shortcut Guide lists the shortcuts that actually work in this Windows 12 (collected from its modules).
   Simulated: the "PowerToys v0.86" version / update status, "Run at startup".

   State: State.data.appData.powertoys.   Styles: css/powertoys.css (every class prefixed ptz-). */
(function () {
  "use strict";
  if (window.PowerToys) return;

  // =====================================================================
  //  Helpers
  // =====================================================================
  const S = () => State.data;
  const scr = () => document.getElementById("screen") || document.body;
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const save = () => { try { State.save(); } catch (e) {} };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const UA = navigator.userAgent || "";
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || /iPad|iPhone|iPod/.test(UA) || (/Macintosh/.test(UA) && "ontouchend" in document);
  const kiosk = () => document.body.classList.contains("kiosk-mode");
  const desktopReady = () => !!document.querySelector(".desktop") && !document.querySelector(".lock-screen, .boot-layer, .wsetup-screen");
  const wins = () => (window.WM && WM.windows ? WM.windows() : []);
  const zOf = (w) => +w.style.zIndex || 0;
  const isMin = (w) => w.style.display === "none";
  const offDesk = (w) => w.classList.contains("wx-offdesk");
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  const appIcon = () => (window.Icon ? Icon.mini("powertoys", "PowerToys") : "");
  const VERSION = "0.86.0";
  const SCRIPT_V = (() => { try { const s = document.currentScript && document.currentScript.src; const m = s && s.match(/[?&]v=([^&#]+)/); return m ? m[1] : ""; } catch (e) { return ""; } })();
  function ensureCss() {
    if (document.querySelector('link[href*="powertoys.css"]') || document.getElementById("ptz-css")) return;
    // Already loaded some other way (e.g. inlined)? A probe rule tells.
    const probe = document.createElement("div"); probe.className = "ptz-css-probe"; probe.style.position = "absolute"; document.body.appendChild(probe);
    const ok = getComputedStyle(probe).zIndex === "7"; probe.remove();
    if (ok) return;
    const l = document.createElement("link"); l.id = "ptz-css"; l.rel = "stylesheet"; l.href = "css/powertoys.css" + (SCRIPT_V ? "?v=" + SCRIPT_V : ""); document.head.appendChild(l);
  }

  const SVG = {
    colorPicker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 4.5l4 4M13 7l4 4-8.5 8.5H4.5v-4z"/><path d="M14 3.5l6.5 6.5-2 2-6.5-6.5z" fill="currentColor" stroke="none" opacity=".35"/></svg>',
    alwaysOnTop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="13" height="12" rx="2"/><rect x="8" y="3" width="13" height="12" rx="2" fill="currentColor" fill-opacity=".18"/></svg>',
    powerRename: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6.5" width="15" height="11" rx="2"/><path d="M6 12h6M20 4v16M18 4h4M18 20h4"/></svg>',
    textExtractor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3"/><path d="M8 8h8M12 8v9"/></svg>',
    shortcutGuide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M6 9.5h1M9.5 9.5h1M13 9.5h1M16.5 9.5h1M6 12.5h1M17 12.5h1M8.5 15.5h7"/></svg>',
    general: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M14.5 2.5l7 7-2.2.6-3.6 3.6.4 4.6-1.6 1.6-4.2-4.2-5.1 5.1H4v-1.2l5.1-5.1-4.2-4.2L6.5 7.7l4.6.4 3.6-3.6z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M2.5 6.5a2 2 0 0 1 2-2h4.6l2 2h8.4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z" fill="#f2c94c" stroke="#d9a926" stroke-width=".8"/></svg>',
    file: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 2.5h8l4.5 4.5v14.5H6z" fill="#fff" stroke="#8a94a6" stroke-width="1"/><path d="M14 2.5V7h4.5" fill="none" stroke="#8a94a6" stroke-width="1"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  };
  const icoTool = (id, size) => `<span class="ptz-tico ptz-tico-${id}" style="width:${size || 20}px;height:${size || 20}px">${SVG[id] || ""}</span>`;

  // =====================================================================
  //  Settings store  (State.data.appData.powertoys)
  // =====================================================================
  const TOOLS = [
    { id: "colorPicker", name: "Color Picker", short: "Pick a color from anywhere on the screen and copy it in HEX, RGB, HSL, HSV, CMYK or CIELAB.",
      key: { c: 1, a: 1, s: 1, code: "KeyC" }, win: { m: 1, s: 1, code: "KeyC" } },
    { id: "alwaysOnTop", name: "Always on Top", short: "Pin a window so it stays above every other window, with a colored border.",
      key: { c: 1, a: 1, code: "KeyT" }, win: { m: 1, c: 1, code: "KeyT" } },
    { id: "powerRename", name: "PowerRename", short: "Bulk-rename files and folders with search & replace, regular expressions, text case and numbering.",
      key: { c: 1, a: 1, s: 1, code: "KeyN" }, win: null },
    { id: "textExtractor", name: "Text Extractor", short: "Drag a rectangle over the screen and copy the text inside it.",
      key: { c: 1, a: 1, s: 1, code: "KeyT" }, win: { m: 1, s: 1, code: "KeyT" } },
    { id: "shortcutGuide", name: "Shortcut Guide", short: "Show the keyboard shortcuts that work in Windows 12.",
      key: { c: 1, a: 1, s: 1, code: "Slash" }, win: { m: 1, s: 1, code: "Slash" } },
  ];
  const toolById = (id) => TOOLS.find((t) => t.id === id);
  const FORMATS = ["HEX", "RGB", "HSL", "HSV", "CMYK", "CIELAB"];
  function ad() { const d = S(); if (!d.appData) d.appData = {}; return d.appData; }
  const validKey = (k) => k && typeof k === "object" && typeof k.code === "string" && k.code && (k.c || k.a || k.m);
  function store() {
    const a = ad();
    let p = a.powertoys; if (!p || typeof p !== "object") p = a.powertoys = {};
    if (!p.enabled || typeof p.enabled !== "object") p.enabled = {};
    if (!p.keys || typeof p.keys !== "object") p.keys = {};
    TOOLS.forEach((t) => {
      if (typeof p.enabled[t.id] !== "boolean") p.enabled[t.id] = true;
      if (!validKey(p.keys[t.id])) p.keys[t.id] = Object.assign({}, t.key);
    });
    if (typeof p.winKeys !== "boolean") p.winKeys = true;
    if (typeof p.tray !== "boolean") p.tray = true;
    const cp = p.cp || (p.cp = {});
    if (cp.mode !== "auto" && cp.mode !== "screen") cp.mode = "auto";
    if (typeof cp.editor !== "boolean") cp.editor = true;
    if (FORMATS.indexOf(cp.copyFormat) < 0) cp.copyFormat = "HEX";
    if (!cp.formats || typeof cp.formats !== "object") cp.formats = {};
    FORMATS.forEach((f) => { if (typeof cp.formats[f] !== "boolean") cp.formats[f] = true; });
    if (!Array.isArray(cp.history)) cp.history = [];
    const aot = p.aot || (p.aot = {});
    if (typeof aot.border !== "boolean") aot.border = true;
    if (typeof aot.accent !== "boolean") aot.accent = true;
    if (!/^#[0-9a-f]{6}$/i.test(aot.color || "")) aot.color = "#0078d4";
    if (!(aot.thickness >= 1 && aot.thickness <= 12)) aot.thickness = 4;
    if (typeof aot.sound !== "boolean") aot.sound = false;
    if (typeof aot.menu !== "boolean") aot.menu = true;
    const te = p.te || (p.te = {});
    if (typeof te.singleLine !== "boolean") te.singleLine = false;
    if (typeof te.preview !== "boolean") te.preview = true;
    const sg = p.sg || (p.sg = {});
    if (typeof sg.holdWin !== "boolean") sg.holdWin = true;
    if (!(sg.holdMs >= 300 && sg.holdMs <= 3000)) sg.holdMs = 900;
    if (typeof sg.startHold !== "boolean") sg.startHold = true;
    if (!(sg.opacity >= 40 && sg.opacity <= 100)) sg.opacity = 92;
    if (["system", "light", "dark"].indexOf(sg.theme) < 0) sg.theme = "system";
    const pr = p.pr || (p.pr = {});
    if (typeof pr.explorerMenu !== "boolean") pr.explorerMenu = true;
    if (typeof pr.remember !== "boolean") pr.remember = true;
    if (!pr.last || typeof pr.last !== "object") pr.last = {};
    if (TOOLS.concat([{ id: "general" }]).every((t) => t.id !== p.page)) p.page = "general";
    return p;
  }
  const enabled = (id) => { try { return !!store().enabled[id]; } catch (e) { return false; } };

  // ---------- keyboard shortcut helpers ----------
  const CODE_LABEL = { Slash: "/", Period: ".", Comma: ",", Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Minus: "-", Equal: "=", Backquote: "`",
    Space: "Space", Enter: "Enter", Escape: "Esc", Tab: "Tab", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", PrintScreen: "PrtScn",
    Backspace: "Backspace", Delete: "Delete", Home: "Home", End: "End", PageUp: "PgUp", PageDown: "PgDn", Insert: "Insert" };
  function codeLabel(code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^F\d{1,2}$/.test(code)) return code;
    if (/^Numpad/.test(code)) return "Num " + code.slice(6);
    return CODE_LABEL[code] || code;
  }
  function keyParts(k) {
    if (!k) return [];
    const p = [];
    if (k.m) p.push(isApple ? "⌘" : "Win");
    if (k.c) p.push("Ctrl");
    if (k.a) p.push("Alt");
    if (k.s) p.push("Shift");
    p.push(codeLabel(k.code));
    return p;
  }
  const keyText = (k) => keyParts(k).join("+");
  const kbd = (parts, cls) => `<span class="ptz-keys${cls ? " " + cls : ""}">${parts.map((x) => `<kbd>${esc(x)}</kbd>`).join("")}</span>`;
  const sameKey = (a, b) => a && b && a.code === b.code && !!a.c === !!b.c && !!a.a === !!b.a && !!a.s === !!b.s && !!a.m === !!b.m;
  const matches = (e, k) => k && e.code === k.code && !!e.ctrlKey === !!k.c && !!e.altKey === !!k.a && !!e.shiftKey === !!k.s && !!e.metaKey === !!k.m;

  // ---------- clipboard + toast ----------
  function legacyCopy(text) {
    const keep = document.activeElement;
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0"; document.body.appendChild(ta);
    let ok = false;
    try { ta.select(); ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    try { if (keep && keep.focus) keep.focus({ preventScroll: true }); } catch (e) {}
    return ok;
  }
  // navigator.clipboard.writeText is wrapped by js/powertools.js, so copies land in Clipboard history too.
  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => legacyCopy(text));
    } catch (e) {}
    return Promise.resolve(legacyCopy(text));
  }
  let toastEl = null, toastT = null;
  function toast(title, body, opts) {
    opts = opts || {};
    if (toastEl) toastEl.remove();
    toastEl = el(`<div class="ptz-toast gbs-skip" role="status" aria-live="polite">${opts.swatch ? `<i class="ptz-toast-sw" style="background:${esc(opts.swatch)}"></i>` : `<span class="ptz-toast-ic">${appIcon()}</span>`}<div class="ptz-toast-tx"><b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ""}</div></div>`);
    toastEl.onclick = () => { if (toastEl) toastEl.remove(); toastEl = null; };
    scr().appendChild(toastEl);
    clearTimeout(toastT); toastT = setTimeout(() => { if (toastEl) { toastEl.classList.add("ptz-out"); const t = toastEl; setTimeout(() => t.remove(), 250); toastEl = null; } }, opts.ms || 3800);
  }
  function closeShellFlyouts() {
    try { if (window.WM && WM.closeShellFlyouts) WM.closeShellFlyouts(); } catch (e) {}
    try { if (window.PowerTools && PowerTools.close) PowerTools.close(); } catch (e) {}
    closeTrayFly();
  }

  // =====================================================================
  //  Color math (sRGB, D65)
  // =====================================================================
  const Color = (function () {
    function hexToRgb(h) {
      h = String(h || "").trim().replace(/^#/, "");
      if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
      if (!/^[0-9a-f]{6}$/i.test(h)) return null;
      const n = parseInt(h, 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    const hex2 = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
    const rgbToHex = (c) => "#" + hex2(c.r) + hex2(c.g) + hex2(c.b);
    function rgbToHsl({ r, g, b }) {
      r /= 255; g /= 255; b /= 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
      let h = 0, s = 0;
      if (d) {
        s = d / (1 - Math.abs(2 * l - 1));
        h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
      }
      return { h, s: s * 100, l: l * 100 };
    }
    function hslToRgb({ h, s, l }) {
      s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100; h = ((h % 360) + 360) % 360;
      const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
      const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
      return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
    }
    function rgbToHsv({ r, g, b }) {
      r /= 255; g /= 255; b /= 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let h = 0;
      if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
      return { h, s: mx ? (d / mx) * 100 : 0, v: mx * 100 };
    }
    function rgbToCmyk({ r, g, b }) {
      r /= 255; g /= 255; b /= 255;
      const k = 1 - Math.max(r, g, b);
      if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
      return { c: ((1 - r - k) / (1 - k)) * 100, m: ((1 - g - k) / (1 - k)) * 100, y: ((1 - b - k) / (1 - k)) * 100, k: k * 100 };
    }
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    function rgbToXyz({ r, g, b }) {
      const R = lin(r), G = lin(g), B = lin(b);
      // sRGB → XYZ (D65), the same 4-digit matrix PowerToys' Color Picker uses
      return { x: (R * 0.4124 + G * 0.3576 + B * 0.1805) * 100, y: (R * 0.2126 + G * 0.7152 + B * 0.0722) * 100, z: (R * 0.0193 + G * 0.1192 + B * 0.9505) * 100 };
    }
    function rgbToLab(c) {
      const { x, y, z } = rgbToXyz(c);
      const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
      const fx = f(x / 95.05), fy = f(y / 100), fz = f(z / 108.9);   // white point = the matrix row sums, so white is exactly (100, 0, 0)
      return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
    }
    const R0 = (v) => Math.round(v);
    const R2 = (v) => { const r = Math.round(v * 100) / 100; return Object.is(r, -0) ? 0 : r; };
    function format(fmt, c) {
      switch (fmt) {
        case "HEX": return rgbToHex(c);
        case "RGB": return `rgb(${c.r}, ${c.g}, ${c.b})`;
        case "HSL": { const x = rgbToHsl(c); return `hsl(${R0(x.h) % 360}, ${R0(x.s)}%, ${R0(x.l)}%)`; }
        case "HSV": { const x = rgbToHsv(c); return `hsv(${R0(x.h) % 360}, ${R0(x.s)}%, ${R0(x.v)}%)`; }
        case "CMYK": { const x = rgbToCmyk(c); return `cmyk(${R0(x.c)}%, ${R0(x.m)}%, ${R0(x.y)}%, ${R0(x.k)}%)`; }
        case "CIELAB": { const x = rgbToLab(c); return `CIELab(${R2(x.l)}, ${R2(x.a)}, ${R2(x.b)})`; }
      }
      return rgbToHex(c);
    }
    // Lighter / darker variants (by HSL lightness), like the editor's shade bar.
    function shade(c, dl) { const x = rgbToHsl(c); return hslToRgb({ h: x.h, s: x.s, l: clamp(x.l + dl, 0, 100) }); }
    function name(c) { // a rough, honest hue name for screen readers / tooltips
      const x = rgbToHsl(c);
      if (x.l < 8) return "Black"; if (x.l > 94) return "White"; if (x.s < 10) return x.l < 40 ? "Dark gray" : x.l > 70 ? "Light gray" : "Gray";
      const names = [[15, "Red"], [40, "Orange"], [65, "Yellow"], [160, "Green"], [195, "Teal"], [250, "Blue"], [290, "Purple"], [335, "Pink"], [360, "Red"]];
      const hn = names.find((n) => x.h < n[0])[1];
      return (x.l < 30 ? "Dark " : x.l > 72 ? "Light " : "") + hn.toLowerCase().replace(/^./, (m) => (x.l < 30 || x.l > 72 ? m : m.toUpperCase()));
    }
    return { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, rgbToHsv, rgbToCmyk, rgbToLab, rgbToXyz, format, shade, name };
  })();

  // =====================================================================
  //  COLOR PICKER
  // =====================================================================
  const CP = (function () {
    let ov = null, busy = false, cleanup = null;
    function cfg() { return store().cp; }
    async function start(opts) {
      opts = opts || {};
      if (ov || busy || !desktopReady()) return;
      closeShellFlyouts();
      if (cfg().mode === "auto" && typeof window.EyeDropper === "function" && !opts.screen) {
        busy = true;
        try {
          const r = await new window.EyeDropper().open();
          busy = false;
          if (r && r.sRGBHex) { picked(r.sRGBHex, "system"); return; }
        } catch (err) {
          busy = false;
          if (err && err.name === "AbortError") return;   // the user pressed Esc
          // NotAllowedError / NotSupportedError → fall back to the screen capture below
        }
      }
      return startScreen();
    }
    function cancel() { if (cleanup) cleanup(); cleanup = null; if (ov) ov.remove(); ov = null; busy = false; }

    async function startScreen() {
      busy = true;
      ov = el(`<div class="ptz-cp-ov gbs-skip" role="dialog" aria-label="Color Picker">
        <div class="ptz-cp-bar"><span class="ptz-spin"></span><span class="ptz-cp-msg">Capturing the screen…</span><button class="ptz-cp-cancel" type="button">Cancel</button></div>
      </div>`);
      const mine = ov;
      ov.querySelector(".ptz-cp-cancel").onclick = (e) => { e.stopPropagation(); cancel(); };
      ov.addEventListener("pointerdown", (e) => { if (e.target.closest(".ptz-cp-bar")) e.stopPropagation(); });
      const onKeyWait = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); } };
      window.addEventListener("keydown", onKeyWait, true);
      cleanup = () => window.removeEventListener("keydown", onKeyWait, true);
      scr().appendChild(ov);
      await nextFrame();
      let snap = null;
      try {
        if (!window.GBSnap) throw new Error("no renderer");
        // Like a real PC, the picker reads the colors apps draw — not the simulated brightness dimmer /
        // night light layers (Settings → Display). GBSnap clones the DOM synchronously, so they are
        // hidden only for that instant (no visible flicker).
        const fx = [...document.querySelectorAll("#displayDim, #displayFx")], vis = fx.map((n) => n.style.visibility);
        fx.forEach((n) => { n.style.visibility = "hidden"; });
        let job;
        try { job = GBSnap.render({ scale: clamp(window.devicePixelRatio || 1, 1, 2) }); }
        finally { fx.forEach((n, i) => { n.style.visibility = vis[i]; }); }
        snap = await job;
      } catch (e) { snap = null; }
      if (ov !== mine) return;   // cancelled while capturing
      busy = false;
      let data = null;
      try { const cv = snap.canvas; data = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height); } catch (e) { data = null; }
      if (!data) { cancel(); toast("Color Picker", "The screen couldn't be captured in this browser."); return; }
      if (cleanup) cleanup();
      armPicker(snap, data);
    }

    function armPicker(snap, img) {
      const touchUI = matchMedia("(pointer: coarse)").matches;
      ov.classList.add("ptz-cp-live");
      const bar = ov.querySelector(".ptz-cp-bar");
      bar.querySelector(".ptz-spin").remove();
      bar.querySelector(".ptz-cp-msg").innerHTML = (touchUI ? "Drag to aim, lift your finger to pick" : "Click to pick · Esc to cancel · scroll to zoom · arrow keys nudge") +
        (snap.mode === "simplified" ? ' <em>Simplified capture — colors may be approximate</em>' : "");
      const loupe = el(`<div class="ptz-cp-loupe" aria-hidden="true"><canvas width="160" height="160"></canvas><div class="ptz-cp-chip"><i></i><span></span></div></div>`);
      ov.appendChild(loupe);
      const lc = loupe.querySelector("canvas"), lg = lc.getContext("2d");
      const chipI = loupe.querySelector(".ptz-cp-chip i"), chipT = loupe.querySelector(".ptz-cp-chip span");
      const sr = scr().getBoundingClientRect();
      const kx = img.width / snap.W, ky = img.height / snap.H;
      let cells = 11, px = sr.left + sr.width / 2, py = sr.top + sr.height / 2, cur = { r: 0, g: 0, b: 0 }, ptype = touchUI ? "touch" : "mouse", shown = false, down = false;
      const tmp = document.createElement("canvas"), tg = tmp.getContext("2d");
      function sampleAt(ix, iy) {
        ix = clamp(ix, 0, img.width - 1); iy = clamp(iy, 0, img.height - 1);
        const i = (iy * img.width + ix) * 4; return { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] };
      }
      function draw() {
        const ix = Math.floor((px - sr.left) * kx), iy = Math.floor((py - sr.top) * ky);
        cur = sampleAt(ix, iy);
        const half = (cells - 1) / 2;
        tmp.width = cells; tmp.height = cells;
        const id = tg.createImageData(cells, cells);
        for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
          const c = sampleAt(ix - half + x, iy - half + y), o = (y * cells + x) * 4;
          id.data[o] = c.r; id.data[o + 1] = c.g; id.data[o + 2] = c.b; id.data[o + 3] = 255;
        }
        tg.putImageData(id, 0, 0);
        lg.imageSmoothingEnabled = false; lg.clearRect(0, 0, 160, 160); lg.drawImage(tmp, 0, 0, 160, 160);
        const cs = 160 / cells;
        lg.strokeStyle = "rgba(127,127,127,.28)"; lg.lineWidth = 1; lg.beginPath();
        for (let i = 1; i < cells; i++) { lg.moveTo(i * cs + 0.5, 0); lg.lineTo(i * cs + 0.5, 160); lg.moveTo(0, i * cs + 0.5); lg.lineTo(160, i * cs + 0.5); }
        lg.stroke();
        lg.lineWidth = 2; lg.strokeStyle = "#000"; lg.strokeRect(half * cs, half * cs, cs, cs); lg.strokeStyle = "#fff"; lg.strokeRect(half * cs - 2, half * cs - 2, cs + 4, cs + 4);
        const hex = Color.rgbToHex(cur);
        chipI.style.background = hex; chipT.textContent = Color.format(cfg().copyFormat, cur);
        // place the loupe: beside the mouse pointer, above a finger
        const W = window.innerWidth, H = window.innerHeight, lw = loupe.offsetWidth || 168, lh = loupe.offsetHeight || 200;
        let lx, ly;
        if (ptype === "mouse") { lx = px + 22; ly = py + 22; if (lx + lw > W - 4) lx = px - 22 - lw; if (ly + lh > H - 4) ly = py - 22 - lh; }
        else { lx = px - lw / 2; ly = py - lh - 46; if (ly < 4) ly = py + 46; }
        loupe.style.left = clamp(lx, 4, W - lw - 4) + "px"; loupe.style.top = clamp(ly, 4, H - lh - 4) + "px";
        if (!shown) { shown = true; loupe.classList.add("ptz-show"); }
      }
      const aim = (e) => { ptype = e.pointerType || "mouse"; px = e.clientX; py = e.clientY; draw(); };
      ov.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || down) aim(e); });
      ov.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".ptz-cp-bar")) return;
        e.preventDefault();
        if (e.button === 2) { cancel(); return; }
        down = true; try { ov.setPointerCapture(e.pointerId); } catch (_) {}
        aim(e);
      });
      ov.addEventListener("pointerup", (e) => {
        if (!down) return; down = false;
        if (e.button === 2) return;
        aim(e); finish();
      });
      ov.addEventListener("pointercancel", () => { down = false; });
      ov.addEventListener("contextmenu", (e) => { e.preventDefault(); cancel(); });
      ov.addEventListener("wheel", (e) => { e.preventDefault(); cells = clamp(cells + (e.deltaY > 0 ? 4 : -4), 5, 31); draw(); }, { passive: false });
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); return; }
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); finish(); return; }
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (d) { e.preventDefault(); e.stopPropagation(); const st = (e.shiftKey ? 10 : 1) / kx; px += d[0] * st; py += d[1] * st; ptype = "mouse"; draw(); }
      };
      window.addEventListener("keydown", onKey, true);
      cleanup = () => window.removeEventListener("keydown", onKey, true);
      function finish() { const c = cur; cancel(); picked(Color.rgbToHex(c), "screen"); }
      if (!touchUI) draw();
      try { ov.focus(); } catch (e) {}
    }

    function addHistory(hex) {
      const h = cfg().history; const i = h.indexOf(hex); if (i >= 0) h.splice(i, 1);
      h.unshift(hex); if (h.length > 30) h.length = 30; save();
    }
    function picked(hex, src) {
      hex = String(hex).toLowerCase();
      const c = Color.hexToRgb(hex); if (!c) return;
      addHistory(hex);
      const text = Color.format(cfg().copyFormat, c);
      copyText(text).then((ok) => toast(ok ? "Copied to the clipboard" : "Color picked", text + (src === "system" ? "  ·  system eyedropper" : ""), { swatch: hex }));
      if (cfg().editor) Editor.open(hex); else Editor.refresh();
      return text;
    }
    return { start, cancel, picked, addHistory, isOpen: () => !!ov };
  })();

  // ---------- Color Picker editor window ----------
  const Editor = (function () {
    let ref = null, cur = null, adjustOpen = false;
    const cfg = () => store().cp;
    function open(hex) {
      if (hex) cur = String(hex).toLowerCase();
      if (!cur) cur = cfg().history[0] || "#0078d4";
      const ent = ref && wins().find((e) => e.win === ref.win);
      if (!ent) {
        const W = Math.min(560, window.innerWidth - 24), H = Math.min(500, window.innerHeight - 70);
        ref = WM.createWindow({ title: "Color Picker", icon: appIcon(), width: W, height: H, appId: "ptz-colorpicker", onClose: () => { ref = null; } });
        ref.body.classList.add("ptz-cpe-host");
        ref.body.addEventListener("click", onClick);
        ref.body.addEventListener("input", onInput);
      } else WM.focusWindow(ref.win);
      render();
    }
    function refresh() { if (ref) render(); }
    function render() {
      if (!ref) return;
      const c = Color.hexToRgb(cur) || { r: 0, g: 120, b: 212 };
      const h = cfg().history;
      const shades = [-24, -12, 0, 12, 24].map((d) => (d ? Color.rgbToHex(Color.shade(c, d)) : cur));
      const fm = FORMATS.filter((f) => cfg().formats[f]);
      ref.body.innerHTML = `<div class="ptz-cpe">
        <div class="ptz-cpe-top">
          <button class="ptz-btn ptz-primary" data-a="pick">${icoTool("colorPicker", 16)} Pick a color</button>
          <span class="ptz-grow"></span>
          <button class="ptz-ib" data-a="settings" title="Color Picker settings" aria-label="Color Picker settings">${SVG.gear}</button>
        </div>
        <div class="ptz-cpe-main">
          <div class="ptz-cpe-hist" role="listbox" aria-label="Color history">
            ${h.length ? h.map((x) => `<button class="ptz-cpe-sw${x === cur ? " ptz-on" : ""}" role="option" aria-selected="${x === cur}" data-hex="${esc(x)}" title="${esc(x)} · ${esc(Color.name(Color.hexToRgb(x)))}" style="background:${esc(x)}"></button>`).join("") : '<div class="ptz-dim ptz-cpe-none">No colors yet</div>'}
          </div>
          <div class="ptz-cpe-center">
            <div class="ptz-cpe-shades" role="group" aria-label="Shades">
              ${shades.map((x, i) => `<button class="ptz-cpe-shade${i === 2 ? " ptz-main" : ""}" data-${i === 2 ? "a=\"adjust\"" : "hex=\"" + esc(x) + "\""} title="${i === 2 ? "Adjust color" : esc(x)}" style="background:${esc(x)}">${i === 2 ? `<span>${esc(Color.name(c))}</span>` : ""}</button>`).join("")}
            </div>
            <div class="ptz-cpe-adjust"${adjustOpen ? "" : " hidden"}>
              <label class="ptz-cpe-hexin">HEX <input class="ptz-in" data-f="hex" value="${esc(cur)}" maxlength="7" spellcheck="false" autocomplete="off"></label>
              ${["r", "g", "b"].map((k) => `<label class="ptz-cpe-sl"><span>${k.toUpperCase()}</span><input type="range" min="0" max="255" data-f="${k}" value="${c[k]}"><output>${c[k]}</output></label>`).join("")}
              <div class="ptz-row"><span class="ptz-grow"></span><button class="ptz-btn" data-a="adjust-cancel">Close</button><button class="ptz-btn ptz-primary" data-a="adjust-ok">Add to history</button></div>
            </div>
            <div class="ptz-cpe-formats">
              ${fm.map((f) => `<div class="ptz-cpe-fmt"><span class="ptz-cpe-fl">${f}</span><input class="ptz-in" readonly value="${esc(Color.format(f, c))}" data-fmt="${f}" aria-label="${f} value"><button class="ptz-ib" data-copy="${f}" title="Copy ${f}" aria-label="Copy ${f}">${SVG.copy}</button></div>`).join("") || '<div class="ptz-dim">All formats are hidden — turn some on in Settings.</div>'}
            </div>
            <div class="ptz-row ptz-cpe-foot">
              <button class="ptz-link" data-a="remove"${h.indexOf(cur) < 0 ? " disabled" : ""}>Remove from history</button>
              <span class="ptz-grow"></span>
              <button class="ptz-link" data-a="clear"${h.length ? "" : " disabled"}>Clear history</button>
            </div>
          </div>
        </div>
      </div>`;
    }
    function setCur(hex, keepAdjust) { cur = hex; if (!keepAdjust) adjustOpen = false; render(); }
    function onClick(e) {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.hex) { setCur(b.dataset.hex, false); return; }
      if (b.dataset.copy) {
        const c = Color.hexToRgb(cur), t = Color.format(b.dataset.copy, c);
        copyText(t).then((ok) => toast(ok ? "Copied to the clipboard" : "Couldn't copy", t, { swatch: cur }));
        return;
      }
      const a = b.dataset.a;
      if (a === "pick") { if (ref) ref.win.style.visibility = "hidden"; const w = ref && ref.win; CP.start().then(() => { if (w) w.style.visibility = ""; }, () => { if (w) w.style.visibility = ""; }); watchPick(w); }
      else if (a === "settings") Settings.open("colorPicker");
      else if (a === "adjust") { adjustOpen = !adjustOpen; render(); }
      else if (a === "adjust-cancel") { adjustOpen = false; render(); }
      else if (a === "adjust-ok") { CP.addHistory(cur); adjustOpen = false; render(); }
      else if (a === "remove") { const h = cfg().history, i = h.indexOf(cur); if (i >= 0) { h.splice(i, 1); save(); } cur = h[0] || cur; render(); }
      else if (a === "clear") { cfg().history.length = 0; save(); render(); }
    }
    // While a pick from the editor is in progress the editor hides; it comes back when the overlay closes.
    function watchPick(w) {
      if (!w) return;
      const t = setInterval(() => { if (!CP.isOpen() && !document.querySelector(".ptz-cp-ov")) { clearInterval(t); w.style.visibility = ""; } }, 200);
      setTimeout(() => { if (!document.querySelector(".ptz-cp-ov")) { clearInterval(t); w.style.visibility = ""; } }, 60000);
    }
    function onInput(e) {
      const f = e.target.dataset.f; if (!f) return;
      if (f === "hex") { const c = Color.hexToRgb(e.target.value); if (c) { cur = Color.rgbToHex(c); updateLive(true); } return; }
      const c = Color.hexToRgb(cur); c[f] = +e.target.value; cur = Color.rgbToHex(c); updateLive(false);
    }
    // Update values without rebuilding the inputs (keeps the slider being dragged / the caret).
    function updateLive(fromHex) {
      const c = Color.hexToRgb(cur), b = ref.body;
      b.querySelectorAll("[data-fmt]").forEach((i) => { i.value = Color.format(i.dataset.fmt, c); });
      const main = b.querySelector(".ptz-cpe-shade.ptz-main"); if (main) { main.style.background = cur; main.querySelector("span").textContent = Color.name(c); }
      const sh = b.querySelectorAll(".ptz-cpe-shade:not(.ptz-main)"); [-24, -12, 12, 24].forEach((d, i) => { if (sh[i]) { const x = Color.rgbToHex(Color.shade(c, d)); sh[i].style.background = x; sh[i].dataset.hex = x; sh[i].title = x; } });
      ["r", "g", "b"].forEach((k) => { const s = b.querySelector(`[data-f="${k}"]`); if (s) { s.value = c[k]; s.nextElementSibling.textContent = c[k]; } });
      if (!fromHex) { const hi = b.querySelector('[data-f="hex"]'); if (hi) hi.value = cur; }
    }
    return { open, refresh, current: () => cur, isOpen: () => !!ref };
  })();

  // =====================================================================
  //  ALWAYS ON TOP
  // =====================================================================
  const AOT = (function () {
    const pinned = new Set();
    let lastFocused = null, applying = false;
    const watched = new WeakSet();
    const mo = new MutationObserver((recs) => {
      if (applying) return;
      const top = window.WM && WM.topZ ? WM.topZ() : 0;
      recs.forEach((r) => { const w = r.target; if (w.isConnected && zOf(w) === top && !isMin(w)) lastFocused = w; });
      enforce();
    });
    function watchAll() {
      const top = window.WM && WM.topZ ? WM.topZ() : 0;
      wins().forEach((e) => {
        if (!watched.has(e.win)) {
          watched.add(e.win); mo.observe(e.win, { attributes: true, attributeFilter: ["style"] });
          if (zOf(e.win) === top) lastFocused = e.win;
        }
      });
    }
    function prune() { pinned.forEach((w) => { if (!w.isConnected) { pinned.delete(w); } }); }
    // Keep every pinned window above every other window (pinned ones keep their own order).
    function enforce() {
      prune();
      if (!pinned.size) return;
      let maxOther = 0;
      wins().forEach((e) => { if (!pinned.has(e.win)) maxOther = Math.max(maxOther, zOf(e.win)); });
      const list = [...pinned].sort((a, b) => (zOf(a) - zOf(b)) || (a === lastFocused ? 1 : b === lastFocused ? -1 : 0));
      let next = maxOther + 1;
      applying = true;
      list.forEach((w) => { if (zOf(w) < next) w.style.zIndex = String(next); next = zOf(w) + 1; });
      mo.takeRecords();
      applying = false;
    }
    function focused() {
      if (lastFocused && lastFocused.isConnected && !isMin(lastFocused) && !offDesk(lastFocused) && lastFocused.style.visibility !== "hidden") return lastFocused;
      const vis = wins().map((e) => e.win).filter((w) => w.isConnected && !isMin(w) && !offDesk(w));
      vis.sort((a, b) => zOf(b) - zOf(a));
      return vis[0] || null;
    }
    const titleOf = (w) => { const t = w && w.querySelector(".win-titlebar .t-text"); return (t && t.textContent.trim()) || "Window"; };
    function styleOf(w) {
      const a = store().aot;
      w.classList.toggle("ptz-aot-border", !!a.border);
      w.style.setProperty("--ptz-aot-color", a.accent ? "var(--accent, #0078d4)" : a.color);
      w.style.setProperty("--ptz-aot-w", a.thickness + "px");
    }
    function beep(on) {
      if (!store().aot.sound) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        const ac = beep.ac || (beep.ac = new AC()); const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = on ? 880 : 520; g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18);
        o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.2);
      } catch (e) {}
    }
    function pin(w, quiet) {
      if (!w || pinned.has(w)) return;
      watchAll();
      pinned.add(w); lastFocused = w;
      w.classList.add("ptz-aot");
      styleOf(w);
      if (!w.querySelector(":scope > .ptz-aot-frame")) w.appendChild(el(`<div class="ptz-aot-frame" aria-hidden="true"></div>`));
      const tb = w.querySelector(".win-titlebar"), ctr = tb && tb.querySelector(".win-controls");
      if (tb && ctr && !tb.querySelector(".ptz-aot-pin")) {
        const b = el(`<button class="ptz-aot-pin" type="button" title="Always on top — click to unpin" aria-label="Unpin from always on top">${SVG.pin}</button>`);
        b.addEventListener("pointerdown", (e) => e.stopPropagation());
        b.addEventListener("click", (e) => { e.stopPropagation(); unpin(w); });
        tb.insertBefore(b, ctr);
      }
      if (window.WM && WM.focusWindow) WM.focusWindow(w);
      enforce(); beep(true);
      if (!quiet) toast("Always on top", "“" + titleOf(w) + "” stays above other windows.");
      Settings.refresh("alwaysOnTop"); Tray.refresh();
    }
    function unpin(w, quiet) {
      if (!w || !pinned.has(w)) return;
      pinned.delete(w);
      w.classList.remove("ptz-aot", "ptz-aot-border");
      const f = w.querySelector(":scope > .ptz-aot-frame"); if (f) f.remove();
      const b = w.querySelector(".ptz-aot-pin"); if (b) b.remove();
      beep(false);
      if (!quiet) toast("Always on top is off", "“" + titleOf(w) + "”");
      Settings.refresh("alwaysOnTop"); Tray.refresh();
    }
    function toggle(w) {
      w = w || focused();
      if (!w) { toast("Always on Top", "Open or click a window first."); return false; }
      if (pinned.has(w)) { unpin(w); return false; }
      pin(w); return true;
    }
    function restyle() { pinned.forEach(styleOf); }
    function unpinAll() { [...pinned].forEach((w) => unpin(w, true)); }

    // New windows: watch them (and keep pinned ones above them).
    function boot() {
      const s = document.getElementById("screen");
      if (!s) { setTimeout(boot, 500); return; }
      new MutationObserver((recs) => {
        let added = false, removed = false;
        recs.forEach((r) => { r.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains("win")) added = true; }); r.removedNodes.forEach((n) => { if (n.nodeType === 1 && pinned.has(n)) removed = true; }); });
        if (added) { watchAll(); enforce(); }
        if (removed) { prune(); Settings.refresh("alwaysOnTop"); Tray.refresh(); }
      }).observe(s, { childList: true });
      watchAll();
    }
    boot();
    return { toggle, pin, unpin, isPinned: (w) => pinned.has(w), pinned: () => [...pinned].filter((w) => w.isConnected), focused, enforce, restyle, unpinAll, titleOf, watchAll };
  })();

  // ---------- Title bar menu (right-click, or long-press on touch) ----------
  const WinMenu = (function () {
    let menu = null, openedAt = 0;
    function close() { if (menu) menu.remove(); menu = null; }
    function show(win, x, y) {
      close();
      const ent = window.WM && WM.entryFor ? WM.entryFor(win) : null; if (!ent) return;
      const on = AOT.isPinned(win);
      const items = [
        { a: "aot", t: "Always on top", check: on, kbd: keyText(store().keys.alwaysOnTop) },
        "-",
        ent.noMax ? null : { a: "max", t: ent.maximized ? "Restore" : "Maximize" },
        { a: "min", t: "Minimize" },
        window.WinX && WinX.showSnapLayouts && !ent.noMax ? { a: "snap", t: "Snap layouts…" } : null,
        "-",
        { a: "close", t: "Close", danger: true },
      ].filter(Boolean);
      menu = el(`<div class="ptz-menu gbs-skip" role="menu">${items.map((it) => it === "-" ? '<div class="ptz-menu-sep"></div>' : `<button role="menuitemcheckbox" aria-checked="${!!it.check}" data-a="${it.a}" class="${it.danger ? "ptz-danger" : ""}"><span class="ptz-menu-ck">${it.check ? "✓" : ""}</span><span class="ptz-menu-t">${esc(it.t)}</span>${it.kbd ? `<span class="ptz-menu-k">${esc(it.kbd)}</span>` : ""}</button>`).join("")}</div>`);
      scr().appendChild(menu);
      const W = window.innerWidth, H = window.innerHeight;
      menu.style.left = clamp(x, 4, W - menu.offsetWidth - 4) + "px"; menu.style.top = clamp(y, 4, H - menu.offsetHeight - 4) + "px";
      openedAt = Date.now();
      menu.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        e.stopPropagation(); if (Date.now() - openedAt < 220) return;
        const a = b.dataset.a; close();
        if (a === "aot") AOT.toggle(win);
        else if (a === "max") { if (ent.setMaximized) ent.setMaximized(!ent.maximized); }
        else if (a === "min") { const m = win.querySelector(".win-controls .ctl-min"); if (m) m.click(); }
        else if (a === "snap") { WinX.showSnapLayouts(win); }
        else if (a === "close") { const c = win.querySelector(".win-controls .ctl-close"); if (c && !c.disabled) c.click(); else if (ent.close) ent.close(); }
      });
      const f = menu.querySelector("button"); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
    }
    const eligible = (e) => {
      if (!enabled("alwaysOnTop") || !store().aot.menu || !desktopReady()) return null;
      const t = e.target; if (!t || !t.closest) return null;
      const tb = t.closest(".win-titlebar"); if (!tb || t.closest(".win-controls, .ptz-aot-pin, input, textarea, select, [contenteditable]")) return null;
      const w = tb.closest(".win"); return w && window.WM && WM.entryFor && WM.entryFor(w) ? w : null;
    };
    document.addEventListener("contextmenu", (e) => {
      const w = eligible(e); if (!w) return;
      e.preventDefault(); e.stopPropagation();
      if (window.WM) WM.focusWindow(w);
      show(w, e.clientX, e.clientY);
    }, true);
    let lp = null;
    document.addEventListener("pointerdown", (e) => {
      if (menu && !menu.contains(e.target)) close();
      if (e.pointerType === "mouse") return;
      const w = eligible(e); if (!w) return;
      const sx = e.clientX, sy = e.clientY;
      clearTimeout(lp && lp.t);
      lp = { sx, sy, t: setTimeout(() => { lp = null; show(w, sx - 20, sy + 14); }, 600) };
    }, true);
    document.addEventListener("pointermove", (e) => { if (lp && Math.hypot(e.clientX - lp.sx, e.clientY - lp.sy) > 9) { clearTimeout(lp.t); lp = null; } }, true);
    ["pointerup", "pointercancel"].forEach((t) => document.addEventListener(t, () => { if (lp) { clearTimeout(lp.t); lp = null; } }, true));
    window.addEventListener("keydown", (e) => { if (menu && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }, true);
    return { show, close };
  })();

  // =====================================================================
  //  VFS helpers (PowerRename)
  // =====================================================================
  const VFS = (function () {
    function rootKids() {
      const a = ad();
      if (!a.files || !a.files.root) { try { if (window.FilesHelper && FilesHelper.recent) FilesHelper.recent(1); } catch (e) {} }
      if (!a.files) a.files = { root: {} };
      if (!a.files.root) a.files.root = {};
      return a.files.root;
    }
    function nodeAt(path) { let n = { type: "folder", children: rootKids() }; for (const seg of path) { n = n && n.children && n.children[seg]; if (!n) return null; } return n; }
    function kidsAt(path) { const n = nodeAt(path); return n && n.type === "folder" ? (n.children || (n.children = {})) : null; }
    function findPath(node) {
      let found = null;
      (function rec(kids, p) {
        for (const k of Object.keys(kids)) {
          if (found) return;
          const n = kids[k]; if (!n) continue;
          if (n === node) { found = p.concat(k); return; }
          if (n.type === "folder" && n.children) rec(n.children, p.concat(k));
        }
      })(rootKids(), []);
      return found;
    }
    function isRO(path) { let n = { children: rootKids() }; for (const seg of path) { n = n && n.children && n.children[seg]; if (!n) return false; if (n.readOnly) return true; } return false; }
    const winPath = (p) => (window.FilesHelper && FilesHelper.winPath ? (() => { try { return FilesHelper.winPath(p); } catch (e) { return p.join("\\"); } })() : p.join("\\"));
    function changed() { save(); try { window.dispatchEvent(new Event("vfs-change")); } catch (e) {} }
    return { rootKids, nodeAt, kidsAt, findPath, isRO, winPath, changed };
  })();

  // =====================================================================
  //  POWERRENAME
  // =====================================================================
  const PR = (function () {
    const DEF = { search: "", replace: "", regex: false, all: true, caseSensitive: false, enumerate: false, datetime: false, scope: "both", noFiles: false, noFolders: false, noSub: false, fmt: "" };
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const SMALL = new Set(["a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet", "at", "by", "in", "of", "on", "to", "up", "as", "is", "it", "via"]);
    const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
    let inst = null;   // the open PowerRename window

    function splitName(name, isFile) {
      if (!isFile) return { base: name, ext: "" };
      const i = name.lastIndexOf(".");
      if (i <= 0) return { base: name, ext: "" };
      return { base: name.slice(0, i), ext: name.slice(i + 1) };
    }
    function applyFormat(s, fmt) {
      if (fmt === "lower") return s.toLowerCase();
      if (fmt === "upper") return s.toUpperCase();
      if (fmt === "cap") return s.toLowerCase().replace(/(^|[\s\-_.(\[])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
      if (fmt === "title") {
        let first = true;
        return s.toLowerCase().replace(/[\p{L}\p{N}']+/gu, (w, off, all) => {
          const keepSmall = !first && SMALL.has(w) && off + w.length < all.length;
          first = false;
          return keepSmall ? w : w.charAt(0).toUpperCase() + w.slice(1);
        });
      }
      return s;
    }
    function dateTokens(str, ts) {
      const d = new Date(ts || Date.now()), p2 = (n) => String(n).padStart(2, "0");
      const map = { YYYY: d.getFullYear(), YY: p2(d.getFullYear() % 100), MMMM: MONTHS[d.getMonth()], MMM: MONTHS[d.getMonth()].slice(0, 3), MM: p2(d.getMonth() + 1), M: d.getMonth() + 1,
        DDDD: DAYS[d.getDay()], DDD: DAYS[d.getDay()].slice(0, 3), DD: p2(d.getDate()), D: d.getDate(), hh: p2(d.getHours()), h: d.getHours(), mm: p2(d.getMinutes()), m: d.getMinutes(),
        ss: p2(d.getSeconds()), s: d.getSeconds(), fff: String(d.getMilliseconds()).padStart(3, "0") };
      return str.replace(/\$(YYYY|YY|MMMM|MMM|MM|M|DDDD|DDD|DD|D|hh|h|mm|m|ss|s|fff)/g, (m, k) => String(map[k]));
    }
    // ${start=10,increment=5,padding=3}  (defaults: start 0, increment 1, padding 0 — like PowerRename)
    function enumerate(str, n) {
      return str.replace(/\$\{([^}]*)\}/g, (m, args) => {
        let start = 0, inc = 1, pad = 0;
        String(args).split(",").forEach((kv) => {
          const mm = kv.trim().match(/^(start|increment|padding)\s*=\s*(-?\d+)$/i); if (!mm) return;
          const v = parseInt(mm[2], 10), k = mm[1].toLowerCase();
          if (k === "start") start = v; else if (k === "increment") inc = v; else pad = clamp(v, 0, 12);
        });
        const val = start + n * inc, neg = val < 0;
        return (neg ? "-" : "") + String(Math.abs(val)).padStart(pad, "0");
      });
    }
    function validName(n) {
      if (!n || !n.trim()) return "The name can't be empty";
      if (/[\\/:*?"<>|]/.test(n)) return 'Names can\'t contain \\ / : * ? " < > |';
      if (RESERVED.test(n) || /^\.+$/.test(n)) return "Reserved name";
      if (/[ .]$/.test(n)) return "Can't end with a space or a period";
      if (n.length > 255) return "Name is too long";
      return "";
    }
    // Flatten the chosen roots into rows (folders list their contents, like PowerRename).
    function flatten(roots) {
      const out = [], seen = new Set();
      roots.forEach((r) => {
        const path = VFS.findPath(r.node); if (!path) return;
        const add = (node, name, parentPath, depth) => {
          if (seen.has(node)) return; seen.add(node);
          out.push({ node, name, parentPath, depth, isFile: node.type !== "folder" });
          if (node.type === "folder" && node.children) Object.keys(node.children).forEach((k) => { const c = node.children[k]; if (c) add(c, k, parentPath.concat(name), depth + 1); });
        };
        add(r.node, path[path.length - 1], path.slice(0, -1), 0);
      });
      return out;
    }
    function compute(items, o, checked) {
      let re = null, error = "";
      if (o.search) {
        try {
          const flags = (o.all ? "g" : "") + (o.caseSensitive ? "" : "i");
          re = new RegExp(o.regex ? o.search : o.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
        } catch (e) { error = "Invalid regular expression: " + (e.message || "").replace(/^Invalid regular expression: /, ""); }
      }
      const active = !error && (!!o.search || !!o.fmt);
      let counter = 0;
      const rows = items.map((it) => {
        const r = { it, newName: it.name, state: "", note: "" };
        const excluded = (it.isFile && o.noFiles) || (!it.isFile && o.noFolders) || (it.depth > 0 && o.noSub);
        r.excluded = excluded;
        r.checked = checked.get(it.node) !== false;
        if (!active || excluded || !r.checked) return r;
        const sp = splitName(it.name, it.isFile);
        const target = o.scope === "name" ? sp.base : o.scope === "ext" ? sp.ext : it.name;
        let out = target, matched = false;
        if (re) {
          re.lastIndex = 0;
          matched = re.test(target); re.lastIndex = 0;
          if (matched) {
            let repl = o.replace || "";
            if (o.datetime) repl = dateTokens(repl, it.node.ts || it.node.created);
            if (o.enumerate) repl = enumerate(repl, counter);
            out = o.regex ? target.replace(re, repl) : target.replace(re, () => repl);
          }
        } else matched = true;   // formatting only
        if (!matched) return r;
        if (o.fmt) out = applyFormat(out, o.fmt);
        let nn = o.scope === "name" ? out + (sp.ext ? "." + sp.ext : "") : o.scope === "ext" ? sp.base + (out ? "." + out : "") : out;
        if (nn === it.name) return r;
        counter++;
        r.newName = nn; r.state = "rename";
        const bad = validName(nn);
        if (bad) { r.state = "error"; r.note = bad; return r; }
        if (VFS.isRO(it.parentPath.concat(it.name))) { r.state = "error"; r.note = "Read-only"; return r; }
        if (it.parentPath.length === 0) { r.state = "error"; r.note = "System location — can't be renamed"; return r; }
        return r;
      });
      // Name clashes (case-insensitive, like Windows) inside each folder.
      const byParent = new Map();
      rows.forEach((r) => { const k = r.it.parentPath.join("/"); if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(r); });
      byParent.forEach((list, k) => {
        const kids = VFS.kidsAt(k ? k.split("/") : []) || {};
        const leaving = new Set(list.filter((r) => r.state === "rename").map((r) => r.it.name.toLowerCase()));
        const finalNames = new Map();
        Object.keys(kids).forEach((n) => { if (!leaving.has(n.toLowerCase())) finalNames.set(n.toLowerCase(), (finalNames.get(n.toLowerCase()) || 0) + 1); });
        list.filter((r) => r.state === "rename").forEach((r) => { const l = r.newName.toLowerCase(); finalNames.set(l, (finalNames.get(l) || 0) + 1); });
        list.filter((r) => r.state === "rename").forEach((r) => { if (finalNames.get(r.newName.toLowerCase()) > 1) { r.state = "error"; r.note = "An item with this name already exists"; } });
      });
      return { rows, error, active, renaming: rows.filter((r) => r.state === "rename").length, errors: rows.filter((r) => r.state === "error").length };
    }
    // Rename for real: every folder is rebuilt once with its keys in the same order.
    function execute(rows) {
      const plan = rows.filter((r) => r.state === "rename");
      if (!plan.length) return null;
      const pins = Array.isArray(ad().filesPinned) ? ad().filesPinned : [];
      const pinNodes = pins.map((p) => VFS.nodeAt(p));
      const groups = new Map();
      plan.forEach((r) => {
        const kids = VFS.kidsAt(r.it.parentPath); if (!kids || kids[r.it.name] !== r.it.node) return;
        if (!groups.has(kids)) groups.set(kids, new Map());
        groups.get(kids).set(r.it.name, r.newName);
      });
      const undo = [];
      let n = 0;
      groups.forEach((map, kids) => {
        const rebuilt = {}; Object.keys(kids).forEach((k) => { rebuilt[map.has(k) ? map.get(k) : k] = kids[k]; });
        Object.keys(kids).forEach((k) => delete kids[k]); Object.assign(kids, rebuilt);
        const back = new Map(); map.forEach((to, from) => back.set(to, from)); undo.push({ kids, map: back });
        n += map.size;
      });
      pinNodes.forEach((node, i) => { if (node) { const p = VFS.findPath(node); if (p) pins[i] = p; } });
      VFS.changed();
      return { count: n, undo };
    }
    function undoRename(u) {
      if (!u) return 0;
      const pins = Array.isArray(ad().filesPinned) ? ad().filesPinned : [];
      const pinNodes = pins.map((p) => VFS.nodeAt(p));
      let n = 0;
      u.undo.forEach(({ kids, map }) => {
        const ok = [...map.keys()].filter((k) => kids[k] && !(map.get(k) in kids && !map.has(map.get(k))));
        if (!ok.length) return;
        const rebuilt = {}; Object.keys(kids).forEach((k) => { rebuilt[ok.indexOf(k) >= 0 ? map.get(k) : k] = kids[k]; });
        Object.keys(kids).forEach((k) => delete kids[k]); Object.assign(kids, rebuilt);
        n += ok.length;
      });
      pinNodes.forEach((node, i) => { if (node) { const p = VFS.findPath(node); if (p) pins[i] = p; } });
      VFS.changed();
      return n;
    }

    // The current File Explorer selection (the front-most Explorer window that has one).
    function explorerSelection() {
      const ex = wins().filter((e) => e.appId === "fileexplorer" && e.win.isConnected).sort((a, b) => zOf(b.win) - zOf(a.win));
      for (const e of ex) {
        const keys = [...e.win.querySelectorAll(".fx12-body .fx-it.sel[data-k]")].map((n) => n.dataset.k).filter((k) => k && !/^(bin|zip):/.test(k));
        if (keys.length) return keys.map((k) => k.split("/"));
      }
      return [];
    }

    // ---------------- window ----------------
    function open(paths) {
      if (!enabled("powerRename")) { toast("PowerRename is turned off", "Turn it on in PowerToys Settings."); return; }
      if (inst && inst.ref.win.isConnected) { WM.focusWindow(inst.ref.win); if (paths && paths.length) inst.add(paths, true); return inst; }
      inst = build();
      if (paths && paths.length) inst.add(paths, true);
      return inst;
    }
    function build() {
      const p = store().pr;
      const o = Object.assign({}, DEF, p.remember ? p.last : {});
      const W = Math.min(940, window.innerWidth - 24), H = Math.min(620, window.innerHeight - 70);
      const ref = WM.createWindow({ title: "PowerRename", icon: appIcon(), width: W, height: H, appId: "ptz-powerrename", onClose: () => { if (inst && inst.ref === ref) inst = null; } });
      const body = ref.body; body.classList.add("ptz-pr-host");
      let roots = [], items = [], result = null, lastUndo = null, filter = "all";
      const checked = new WeakMap();
      body.innerHTML = `<div class="ptz-pr">
        <div class="ptz-pr-side">
          <label class="ptz-lbl" for="ptz-pr-s">Search for</label>
          <input class="ptz-in" id="ptz-pr-s" data-f="search" placeholder="Text, or a regular expression" spellcheck="false" autocomplete="off" autocapitalize="off">
          <div class="ptz-pr-checks">
            <label><input type="checkbox" data-o="regex"> Use regular expressions</label>
            <label><input type="checkbox" data-o="all"> Match all occurrences</label>
            <label><input type="checkbox" data-o="caseSensitive"> Case sensitive</label>
          </div>
          <label class="ptz-lbl" for="ptz-pr-r">Replace with</label>
          <input class="ptz-in" id="ptz-pr-r" data-f="replace" placeholder="Replacement (\${start=1} numbers items)" spellcheck="false" autocomplete="off" autocapitalize="off">
          <div class="ptz-pr-checks">
            <label title="\${} \${start=1} \${start=10,increment=5,padding=3}"><input type="checkbox" data-o="enumerate"> Enumerate items <code>\${start=1}</code></label>
            <label title="$YYYY $YY $MMMM $MMM $MM $M $DDDD $DDD $DD $D $hh $h $mm $m $ss $s $fff"><input type="checkbox" data-o="datetime"> Use file date &amp; time <code>$YYYY-$MM-$DD</code></label>
          </div>
          <label class="ptz-lbl" for="ptz-pr-scope">Apply to</label>
          <select class="ptz-in" id="ptz-pr-scope" data-o="scope"><option value="both">Filename + extension</option><option value="name">Filename only</option><option value="ext">Extension only</option></select>
          <div class="ptz-pr-checks ptz-pr-ex">
            <label><input type="checkbox" data-o="noFiles"> Exclude files</label>
            <label><input type="checkbox" data-o="noFolders"> Exclude folders</label>
            <label><input type="checkbox" data-o="noSub"> Exclude subfolder items</label>
          </div>
          <div class="ptz-lbl">Text formatting</div>
          <div class="ptz-seg" role="group" aria-label="Text formatting">
            <button data-fmt="lower" title="lowercase">aa</button><button data-fmt="upper" title="UPPERCASE">AA</button><button data-fmt="title" title="Title Case">Aa</button><button data-fmt="cap" title="Capitalize Each Word">Aa Aa</button>
          </div>
          <div class="ptz-pr-help ptz-dim">Leave “Search for” empty to only change the text case. With regular expressions, use $1, $2… for groups.</div>
        </div>
        <div class="ptz-pr-main">
          <div class="ptz-pr-tools">
            <button class="ptz-btn" data-a="explorer" title="Add the items selected in File Explorer">Add Explorer selection</button>
            <button class="ptz-btn" data-a="browse">Browse…</button>
            <button class="ptz-btn" data-a="clear">Clear</button>
            <span class="ptz-grow"></span>
            <select class="ptz-in ptz-pr-filter" data-a="filter" aria-label="Show"><option value="all">Show all items</option><option value="renamed">Show only renamed items</option></select>
          </div>
          <div class="ptz-pr-table" role="table" aria-label="Preview">
            <div class="ptz-pr-head" role="row"><label class="ptz-pr-ck"><input type="checkbox" data-a="checkall" aria-label="Select all" checked></label><span role="columnheader">Original</span><span role="columnheader">Renamed</span></div>
            <div class="ptz-pr-rows"></div>
          </div>
          <div class="ptz-pr-foot">
            <span class="ptz-pr-stat ptz-dim"></span>
            <span class="ptz-grow"></span>
            <button class="ptz-btn" data-a="undo" disabled>Undo</button>
            <button class="ptz-btn ptz-primary" data-a="apply" disabled>Rename</button>
          </div>
        </div>
      </div>`;
      const $ = (s) => body.querySelector(s);
      const rowsEl = $(".ptz-pr-rows");
      // fill controls from options
      $('[data-f="search"]').value = o.search || ""; $('[data-f="replace"]').value = o.replace || "";
      body.querySelectorAll("[data-o]").forEach((c) => { if (c.type === "checkbox") c.checked = !!o[c.dataset.o]; else c.value = o[c.dataset.o]; });
      const paintFmt = () => body.querySelectorAll("[data-fmt]").forEach((b) => { const on = b.dataset.fmt === o.fmt; b.classList.toggle("ptz-on", on); b.setAttribute("aria-pressed", on); });
      paintFmt();
      function remember() { if (store().pr.remember) { store().pr.last = Object.assign({}, o); save(); } }
      function recompute() {
        items = flatten(roots);
        result = compute(items, o, checked);
        paintRows();
      }
      function paintRows() {
        const rs = result.rows.filter((r) => filter === "all" || r.state === "rename" || r.state === "error");
        if (!items.length) {
          rowsEl.innerHTML = `<div class="ptz-pr-empty"><b>No items yet</b><span>Select files in File Explorer and choose “Add Explorer selection”, right-click them and pick “Rename with PowerRename”, or use Browse….</span></div>`;
        } else if (!rs.length) rowsEl.innerHTML = `<div class="ptz-pr-empty"><span>No item would be renamed with these options.</span></div>`;
        else rowsEl.innerHTML = rs.map((r, i) => {
          const it = r.it, ic = it.isFile ? SVG.file : SVG.folder;
          const cls = r.state === "rename" ? " ptz-ren" : r.state === "error" ? " ptz-err" : "";
          return `<div class="ptz-pr-row${cls}${r.excluded ? " ptz-exc" : ""}" role="row" data-i="${result.rows.indexOf(r)}" title="${esc(VFS.winPath(it.parentPath.concat(it.name)))}">
            <label class="ptz-pr-ck"><input type="checkbox" ${r.checked ? "checked" : ""} aria-label="Include ${esc(it.name)}"></label>
            <span class="ptz-pr-n" style="padding-left:${Math.min(it.depth, 8) * 16}px">${ic}<span>${esc(it.name)}</span></span>
            <span class="ptz-pr-new">${r.state === "rename" ? `<span>${esc(r.newName)}</span>` : r.state === "error" ? `<span>${esc(r.newName)}</span><em>${esc(r.note)}</em>` : r.excluded ? '<em class="ptz-dim">Excluded</em>' : ""}</span>
          </div>`;
        }).join("");
        const sel = result.rows.filter((r) => r.checked && !r.excluded).length;
        $(".ptz-pr-stat").innerHTML = result.error ? `<span class="ptz-red">${esc(result.error)}</span>` :
          `Items selected: <b>${sel}</b> &nbsp;|&nbsp; Renaming: <b>${result.renaming}</b>${result.errors ? ` &nbsp;|&nbsp; <span class="ptz-red">${result.errors} can't be renamed</span>` : ""}`;
        $('[data-a="apply"]').disabled = !result.renaming;
        $('[data-a="undo"]').disabled = !lastUndo;
        const all = $('[data-a="checkall"]'); const ch = result.rows.filter((r) => r.checked).length;
        all.checked = !!result.rows.length && ch === result.rows.length; all.indeterminate = ch > 0 && ch < result.rows.length;
      }
      function add(paths, replace) {
        if (replace) roots = [];
        let added = 0;
        paths.forEach((p) => { const n = VFS.nodeAt(p); if (n && !roots.some((r) => r.node === n)) { roots.push({ node: n }); added++; } });
        recompute();
        return added;
      }
      body.addEventListener("input", (e) => {
        const f = e.target.dataset.f; if (f) { o[f] = e.target.value; remember(); recompute(); }
      });
      body.addEventListener("change", (e) => {
        const t = e.target;
        if (t.dataset.o) { o[t.dataset.o] = t.type === "checkbox" ? t.checked : t.value; remember(); recompute(); return; }
        if (t.dataset.a === "filter") { filter = t.value; paintRows(); return; }
        if (t.dataset.a === "checkall") { result.rows.forEach((r) => checked.set(r.it.node, t.checked)); recompute(); return; }
        const row = t.closest(".ptz-pr-row");
        if (row && t.type === "checkbox") { const r = result.rows[+row.dataset.i]; if (r) { checked.set(r.it.node, t.checked); recompute(); } }
      });
      body.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.fmt) { o.fmt = o.fmt === b.dataset.fmt ? "" : b.dataset.fmt; paintFmt(); remember(); recompute(); return; }
        const a = b.dataset.a;
        if (a === "explorer") {
          const sel = explorerSelection();
          if (!sel.length) { toast("PowerRename", "Nothing is selected in File Explorer."); return; }
          add(sel, false);
        } else if (a === "browse") browse(body, (paths) => add(paths, false));
        else if (a === "clear") { roots = []; recompute(); }
        else if (a === "apply") {
          const r = execute(result.rows);
          if (r) { lastUndo = r; toast("PowerRename", "Renamed " + r.count + " item" + (r.count === 1 ? "" : "s") + "."); }
          recompute();
        } else if (a === "undo") {
          const n = undoRename(lastUndo); lastUndo = null;
          toast("PowerRename", n ? "Undid the rename of " + n + " item" + (n === 1 ? "" : "s") + "." : "Nothing to undo — the items changed since.");
          recompute();
        }
      });
      const onV = () => { if (!body.isConnected) { window.removeEventListener("vfs-change", onV); return; } roots = roots.filter((r) => VFS.findPath(r.node)); recompute(); };
      window.addEventListener("vfs-change", onV);
      if (window.ResizeObserver) new ResizeObserver(() => body.classList.toggle("ptz-narrow", body.clientWidth < 680)).observe(body);
      recompute();
      setTimeout(() => { try { $('[data-f="search"]').focus({ preventScroll: true }); } catch (e) {} }, 30);
      return { ref, add, options: o, result: () => result, items: () => items, roots: () => roots };
    }

    // ---------------- built-in folder browser ----------------
    function browse(host, onPick) {
      let path = ["Documents"]; if (!VFS.nodeAt(path)) path = [];
      const picked = new Set();
      const mask = el(`<div class="ptz-modal-mask"><div class="ptz-modal ptz-browse" role="dialog" aria-label="Choose items to rename">
        <div class="ptz-modal-h"><b>Choose items to rename</b><span class="ptz-grow"></span><button class="ptz-ib" data-a="x" aria-label="Close">${SVG.close}</button></div>
        <div class="ptz-browse-bar"><button class="ptz-ib" data-a="up" title="Up one level" aria-label="Up one level">${SVG.up}</button><div class="ptz-browse-path"></div></div>
        <div class="ptz-browse-list" role="listbox" aria-multiselectable="true"></div>
        <div class="ptz-row ptz-modal-f"><button class="ptz-link" data-a="all">Select all</button><span class="ptz-grow"></span><button class="ptz-btn" data-a="here">Add this folder</button><button class="ptz-btn ptz-primary" data-a="add" disabled>Add selected</button><button class="ptz-btn" data-a="x">Cancel</button></div>
      </div></div>`);
      host.appendChild(mask);
      const list = mask.querySelector(".ptz-browse-list");
      function paint() {
        const kids = VFS.kidsAt(path) || {};
        const names = Object.keys(kids).filter((k) => kids[k] && !kids[k].hidden).sort((a, b) => ((kids[a].type === "folder") === (kids[b].type === "folder") ? a.localeCompare(b, undefined, { numeric: true }) : kids[a].type === "folder" ? -1 : 1));
        mask.querySelector(".ptz-browse-path").innerHTML = ['<button data-crumb="0">This PC</button>'].concat(path.map((s, i) => `<span>›</span><button data-crumb="${i + 1}">${esc(s)}</button>`)).join("");
        list.innerHTML = names.length ? names.map((k) => {
          const n = kids[k], key = path.concat(k).join("/");
          return `<div class="ptz-browse-it${picked.has(key) ? " ptz-on" : ""}" role="option" aria-selected="${picked.has(key)}" data-k="${esc(k)}"><input type="checkbox" ${picked.has(key) ? "checked" : ""} aria-label="Select ${esc(k)}" tabindex="-1">${n.type === "folder" ? SVG.folder : SVG.file}<span class="ptz-browse-n">${esc(k)}</span>${n.type === "folder" ? '<button class="ptz-link" data-open="1">Open</button>' : ""}</div>`;
        }).join("") : '<div class="ptz-dim ptz-browse-empty">This folder is empty.</div>';
        mask.querySelector('[data-a="up"]').disabled = !path.length;
        mask.querySelector('[data-a="here"]').disabled = !path.length;
        const ab = mask.querySelector('[data-a="add"]'); ab.disabled = !picked.size; ab.textContent = picked.size ? "Add selected (" + picked.size + ")" : "Add selected";
      }
      const close = () => mask.remove();
      mask.addEventListener("click", (e) => {
        if (e.target === mask) { close(); return; }
        const cr = e.target.closest("[data-crumb]"); if (cr) { path = path.slice(0, +cr.dataset.crumb); paint(); return; }
        const it = e.target.closest(".ptz-browse-it");
        if (it) {
          const k = it.dataset.k;
          if (e.target.closest("[data-open]")) { path = path.concat(k); paint(); return; }
          const key = path.concat(k).join("/"); picked.has(key) ? picked.delete(key) : picked.add(key); paint(); return;
        }
        const b = e.target.closest("button"); if (!b) return;
        const a = b.dataset.a;
        if (a === "x") close();
        else if (a === "up") { path = path.slice(0, -1); paint(); }
        else if (a === "all") { const kids = VFS.kidsAt(path) || {}; Object.keys(kids).forEach((k) => picked.add(path.concat(k).join("/"))); paint(); }
        else if (a === "here") { onPick([path.slice()]); close(); }
        else if (a === "add") { onPick([...picked].map((k) => k.split("/"))); close(); }
      });
      list.addEventListener("dblclick", (e) => { const it = e.target.closest(".ptz-browse-it"); if (!it) return; const n = (VFS.kidsAt(path) || {})[it.dataset.k]; if (n && n.type === "folder") { path = path.concat(it.dataset.k); paint(); } });
      paint();
    }

    // ---------------- "Rename with PowerRename" in File Explorer's right-click menu ----------------
    function hookExplorerMenus() {
      const s = document.getElementById("screen"); if (!s) { setTimeout(hookExplorerMenus, 800); return; }
      new MutationObserver((recs) => {
        if (!enabled("powerRename") || !store().pr.explorerMenu) return;
        recs.forEach((r) => r.addedNodes.forEach((m) => {
          if (m.nodeType !== 1 || !m.classList.contains("fx12-pop") || m.dataset.level !== "0" || !m.querySelector(":scope > .fx-pop-strip") || m.querySelector(".ptz-fx-pr")) return;
          const sel = explorerSelection(); if (!sel.length) return;
          const born = Date.now();
          const b = el(`<button role="menuitem" class="ptz-fx-pr"><span class="fx-pop-ic">${icoTool("powerRename", 18)}</span><span class="fx-pop-t">Rename with PowerRename</span></button>`);
          b.onclick = (e) => { e.stopPropagation(); if (Date.now() - born < 250) return; document.querySelectorAll(".fx12-pop").forEach((x) => x.remove()); open(sel); };
          const after = [...m.querySelectorAll(":scope > button")].find((x) => /Copy as path/.test(x.textContent));
          if (after) after.after(b); else m.appendChild(b);
          // keep the menu inside the screen after growing
          const H = window.innerHeight; const top = parseFloat(m.style.top) || 0; if (top + m.offsetHeight > H - 6) m.style.top = Math.max(4, H - m.offsetHeight - 6) + "px";
        }));
      }).observe(s, { childList: true });
    }
    hookExplorerMenus();

    return { open, compute, flatten, execute, undoRename, explorerSelection, applyFormat, enumerate, dateTokens, validName, current: () => inst };
  })();

  // =====================================================================
  //  TEXT EXTRACTOR
  // =====================================================================
  const TE = (function () {
    let ov = null, single = false;
    function start() {
      if (ov || !desktopReady()) return;
      closeShellFlyouts();
      single = store().te.singleLine;
      const touchUI = matchMedia("(pointer: coarse)").matches;
      ov = el(`<div class="ptz-te-ov gbs-skip" role="dialog" aria-label="Text Extractor">
        <div class="ptz-te-rect" hidden></div>
        <div class="ptz-te-bar"><span>${touchUI ? "Drag over the text to copy" : "Drag over the text to copy · Esc to cancel"}</span>
          <button type="button" class="ptz-te-tg${single ? " ptz-on" : ""}" data-a="single" aria-pressed="${single}" title="Join all lines into one">Single line</button>
          <button type="button" data-a="cancel">Cancel</button></div>
      </div>`);
      scr().appendChild(ov);
      const rectEl = ov.querySelector(".ptz-te-rect"), bar = ov.querySelector(".ptz-te-bar");
      let sx = 0, sy = 0, drag = false, rect = null;
      bar.addEventListener("pointerdown", (e) => e.stopPropagation());
      bar.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return; e.stopPropagation();
        if (b.dataset.a === "cancel") stop();
        else if (b.dataset.a === "single") { single = !single; b.classList.toggle("ptz-on", single); b.setAttribute("aria-pressed", single); }
      });
      ov.addEventListener("pointerdown", (e) => {
        if (e.button === 2) { stop(); return; }
        e.preventDefault(); drag = true; sx = e.clientX; sy = e.clientY; rect = { x: sx, y: sy, w: 0, h: 0 };
        try { ov.setPointerCapture(e.pointerId); } catch (_) {}
        ov.classList.add("ptz-te-drag"); rectEl.hidden = false; paint();
      });
      ov.addEventListener("pointermove", (e) => {
        if (!drag) return;
        rect = { x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY), w: Math.abs(e.clientX - sx), h: Math.abs(e.clientY - sy) }; paint();
      });
      ov.addEventListener("pointerup", () => {
        if (!drag) return; drag = false;
        if (!rect || rect.w < 6 || rect.h < 6) { ov.classList.remove("ptz-te-drag"); rectEl.hidden = true; return; }
        finish(rect);
      });
      ov.addEventListener("contextmenu", (e) => { e.preventDefault(); stop(); });
      function paint() { Object.assign(rectEl.style, { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px" }); }
      ov.__key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stop(); } };
      window.addEventListener("keydown", ov.__key, true);
    }
    function stop() { if (!ov) return; window.removeEventListener("keydown", ov.__key, true); ov.remove(); ov = null; }

    // ---- read the text under a rectangle (viewport coordinates) ----
    function visibleHit(doc, x, y, p) {
      const hit = doc.elementFromPoint(x, y);
      if (!hit) return false;
      if (hit === p || p.contains(hit)) return true;
      if (hit.contains(p)) {
        if (hit === doc.body || hit === doc.documentElement || hit.id === "screen") return false;
        const hw = hit.closest(".win"), pw = p.closest(".win");
        return hw === pw;
      }
      return false;
    }
    const secret = (n) => (window.GBSnap && GBSnap.isSecret ? GBSnap.isSecret(n) : (n.type === "password"));
    function collect(doc, root, rect, off, out, depth) {
      const R = { x: rect.x - off.x, y: rect.y - off.y, w: rect.w, h: rect.h };   // rectangle in this document's coordinates
      const hitR = (r) => r.right > R.x && r.left < R.x + R.w && r.bottom > R.y && r.top < R.y + R.h;
      const inside = (cx, cy) => cx >= R.x && cx <= R.x + R.w && cy >= R.y && cy <= R.y + R.h;
      const group = (n) => { const w = n.closest && n.closest(".win"); return w || (n.closest && n.closest(".taskbar")) || null; };
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!n.nodeValue || !/\S/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          const p = n.parentElement; if (!p) return NodeFilter.FILTER_REJECT;
          if (p.closest("script,style,noscript,template,textarea,.ptz-te-ov,.ptz-toast")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const range = doc.createRange();
      let n, budget = 30000;
      while ((n = walker.nextNode()) && budget > 0) {
        range.selectNodeContents(n);
        const br = range.getBoundingClientRect();
        if (!br.width || !br.height || !hitR(br)) continue;
        const p = n.parentElement, cs = doc.defaultView.getComputedStyle(p);
        if (cs.visibility === "hidden" || +cs.opacity === 0) continue;
        const g = group(p);
        const text = n.nodeValue, re = /\S+/g; let m;
        while ((m = re.exec(text)) && budget-- > 0) {
          range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length);
          const r = range.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          if (!inside(cx, cy)) continue;
          if (!visibleHit(doc, cx, cy, p)) continue;
          out.words.push({ t: m[0], x: r.left + off.x, y: r.top + off.y, w: r.width, h: r.height, cy: cy + off.y, g });
        }
      }
      // form fields: their text isn't in text nodes
      root.querySelectorAll("input, textarea").forEach((f) => {
        const t = (f.type || "").toLowerCase();
        if (/^(checkbox|radio|range|color|file|hidden|button|submit|reset|image)$/.test(t)) return;
        const r = f.getBoundingClientRect(); if (!r.width || !hitR(r) || !f.value) return;
        const cx = clamp(r.left + r.width / 2, R.x, R.x + R.w), cy = clamp(r.top + Math.min(r.height / 2, 14), R.y, R.y + R.h);
        if (!visibleHit(doc, cx, cy, f)) return;
        if (secret(f)) { out.secret++; return; }
        f.value.split(/\n/).forEach((ln, i) => { if (ln.trim()) out.words.push({ t: ln.trim(), x: r.left + 6 + off.x, y: r.top + i * 18 + off.y, w: Math.min(r.width, ln.length * 7), h: 16, cy: r.top + 9 + i * 18 + off.y, g: group(f) }); });
      });
      // pictures / canvases / video (no DOM text) and embedded pages
      root.querySelectorAll("img, canvas, video, svg, iframe, object, embed").forEach((m) => {
        const r = m.getBoundingClientRect(); if (r.width < 24 || r.height < 16 || !hitR(r)) return;
        const ix = Math.max(r.left, R.x), iy = Math.max(r.top, R.y), ax = Math.min(r.right, R.x + R.w), ay = Math.min(r.bottom, R.y + R.h);
        if ((ax - ix) * (ay - iy) < 300) return;
        if (!visibleHit(doc, (ix + ax) / 2, (iy + ay) / 2, m)) return;
        if (m.tagName === "IFRAME") {
          let d = null; try { d = m.contentDocument; } catch (e) {}
          if (d && d.body && depth < 2) {
            const ox = off.x + r.left + m.clientLeft, oy = off.y + r.top + m.clientTop;
            collect(d, d.body, rect, { x: ox, y: oy }, out, depth + 1);
          } else out.frames++;
          return;
        }
        if (m.tagName === "svg" && m.querySelector("text")) return;   // SVG <text> is already in the DOM text
        if (m.tagName === "svg" && (r.width < 64 || r.height < 40)) return;   // icons
        out.media.push({ x: ix + off.x, y: iy + off.y, w: ax - ix, h: ay - iy });
      });
    }
    function linesFrom(words, singleLine) {
      // keep each window's text together (windows ordered by position), lines top→bottom, words left→right
      const groups = new Map();
      words.forEach((w) => { if (!groups.has(w.g)) groups.set(w.g, []); groups.get(w.g).push(w); });
      const gl = [...groups.values()].map((ws) => ({ ws, y: Math.min(...ws.map((w) => w.y)), x: Math.min(...ws.map((w) => w.x)) }));
      gl.sort((a, b) => (Math.abs(a.y - b.y) > 30 ? a.y - b.y : a.x - b.x));
      const out = [];
      gl.forEach(({ ws }) => {
        ws.sort((a, b) => a.cy - b.cy || a.x - b.x);
        const lines = [];
        ws.forEach((w) => {
          const L = lines.find((l) => Math.abs(l.cy - w.cy) < Math.max(4, Math.min(l.h, w.h) * 0.5));
          if (L) { L.ws.push(w); L.cy = (L.cy * (L.ws.length - 1) + w.cy) / L.ws.length; } else lines.push({ cy: w.cy, h: w.h, ws: [w] });
        });
        lines.sort((a, b) => a.cy - b.cy);
        lines.forEach((l) => { l.ws.sort((a, b) => a.x - b.x); out.push(l.ws.map((w) => w.t).join(" ")); });
      });
      return singleLine ? out.join(" ").replace(/\s+/g, " ").trim() : out.join("\n");
    }
    function extract(rect, opts) {
      opts = opts || {};
      const out = { words: [], media: [], frames: 0, secret: 0 };
      const hide = ov; if (hide) hide.style.visibility = "hidden";
      const tst = toastEl; if (tst) tst.style.visibility = "hidden";
      try { collect(document, scr(), rect, { x: 0, y: 0 }, out, 0); }
      finally { if (hide) hide.style.visibility = ""; if (tst) tst.style.visibility = ""; }
      out.text = linesFrom(out.words, opts.single);
      return out;
    }
    // Pictures: the browser's TextDetector (Shape Detection API) when it exists — real OCR, on-device.
    async function detectInMedia(rect, media) {
      if (typeof window.TextDetector !== "function" || !media.length || !window.GBSnap) return null;
      try {
        const snap = await GBSnap.render({ scale: 1 });
        const sr = scr().getBoundingClientRect();
        const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(rect.w)); c.height = Math.max(1, Math.round(rect.h));
        c.getContext("2d").drawImage(snap.canvas, rect.x - sr.left, rect.y - sr.top, rect.w, rect.h, 0, 0, rect.w, rect.h);
        const found = await new window.TextDetector().detect(c);
        const inMedia = (b) => media.some((m) => { const cx = rect.x + b.x + b.width / 2, cy = rect.y + b.y + b.height / 2; return cx >= m.x && cx <= m.x + m.w && cy >= m.y && cy <= m.y + m.h; });
        return found.filter((f) => f.rawValue && inMedia(f.boundingBox)).sort((a, b) => a.boundingBox.y - b.boundingBox.y || a.boundingBox.x - b.boundingBox.x).map((f) => f.rawValue).join("\n");
      } catch (e) { return null; }
    }
    function finish(rect) {
      const res = extract(rect, { single });
      stop();
      const notes = [];
      if (res.frames) notes.push(res.frames + " embedded web page" + (res.frames === 1 ? "" : "s") + " can't be read");
      if (res.secret) notes.push("password fields are skipped");
      const done = (text, ocrNote) => {
        if (ocrNote) notes.push(ocrNote);
        if (!text) { toast("Text Extractor", "No text found in the selection." + (notes.length ? " " + notes.join(" · ") + "." : ""), { ms: 5200 }); return; }
        copyText(text).then((ok) => {
          if (!ok) { showResult(text, notes); return; }
          const pv = text.length > 140 ? text.slice(0, 140) + "…" : text;
          toast("Copied " + text.length + " character" + (text.length === 1 ? "" : "s"), (store().te.preview ? pv : "") + (notes.length ? (store().te.preview ? "\n" : "") + notes.join(" · ") + "." : ""), { ms: 5200 });
        });
      };
      if (res.media.length) {
        if (typeof window.TextDetector === "function") {
          // copy the exact DOM text right away (inside the user's gesture), then add picture text if any
          detectInMedia(rect, res.media).then((ocr) => {
            const all = [res.text, ocr].filter(Boolean).join(single ? " " : "\n");
            done(all, ocr == null ? "pictures couldn't be read" : "");
          });
          return res;
        }
        done(res.text, (res.media.length === 1 ? "1 picture in the selection wasn't read" : res.media.length + " pictures in the selection weren't read") + " — this browser has no offline OCR for images");
        return res;
      }
      done(res.text, "");
      return res;
    }
    // When the clipboard is blocked, show the text so it can be copied by hand.
    function showResult(text, notes) {
      const W = Math.min(520, window.innerWidth - 24), H = Math.min(360, window.innerHeight - 80);
      const ref = WM.createWindow({ title: "Text Extractor", icon: appIcon(), width: W, height: H, appId: "ptz-textextractor" });
      ref.body.innerHTML = `<div class="ptz-teres"><p class="ptz-dim">The browser didn't allow copying automatically. Select the text and copy it, or press Copy.${notes.length ? " (" + esc(notes.join(" · ")) + ")" : ""}</p><textarea class="ptz-in" spellcheck="false"></textarea><div class="ptz-row"><span class="ptz-grow"></span><button class="ptz-btn ptz-primary">Copy</button></div></div>`;
      const ta = ref.body.querySelector("textarea"); ta.value = text;
      ref.body.querySelector("button").onclick = () => { ta.select(); copyText(text).then((ok) => toast(ok ? "Copied" : "Copy failed", ok ? text.length + " characters" : "Use the keyboard or the edit menu.")); };
    }
    return { start, stop, extract, linesFrom, isOpen: () => !!ov, hasOCR: () => typeof window.TextDetector === "function" };
  })();

  // =====================================================================
  //  SHORTCUT GUIDE
  // =====================================================================
  const SG = (function () {
    let ov = null, mode = "", openedAt = 0;
    const W = (k) => (isApple ? null : k);   // Win-key equivalents only mean something on PC keyboards
    function groups() {
      const p = store(), G = [];
      const sys = [];
      const r = (keys, label, win) => ({ keys, label, win: win ? W(win) : null });
      if (window.WinX) {
        sys.push(r("Alt+Tab", "Switch windows (keep Alt held)"), r("Ctrl+Alt+Tab", "Window switcher that stays open"), r("Ctrl+Alt+Up", "Task View", "Win+Tab"),
          r("Ctrl+Alt+Down", "Close Task View"), r("Ctrl+Alt+Left / Right", "Previous / next virtual desktop", "Ctrl+Win+Left / Right"));
      }
      if (window.Widgets12) sys.push(r("Ctrl+Alt+W", "Widgets", "Win+W"));
      if (window.NotifCenter) sys.push(r("Ctrl+Alt+N", "Notification center & calendar", "Win+N"));
      if (window.AppRegistry && AppRegistry.run) sys.push(r("Ctrl+Alt+R", "Run", "Win+R"));
      if (window.PowerTools) sys.push(r("Ctrl+Alt+V", "Clipboard history", "Win+V"), r("Ctrl+Alt+.", "Emoji, kaomoji & symbols", "Win+."));
      if (window.Recall) sys.push(r("Ctrl+Alt+J", "Recall timeline", "Win+J"));
      if (sys.length) G.push({ id: "sys", title: "Windows 12", rows: sys });
      const pt = TOOLS.filter((t) => p.enabled[t.id]).map((t) => ({ keys: keyText(p.keys[t.id]), label: t.name, win: p.winKeys && t.win ? W(keyText(t.win)) : null }));
      if (pt.length) G.push({ id: "pt", title: "PowerToys", rows: pt });
      if (window.GameBar || window.GBSnap) G.push({ id: "game", title: "Xbox Game Bar & capture", rows: [r("Ctrl+Alt+G", "Open Game Bar", "Win+G"), r("Ctrl+Alt+Shift+S", "Take a screenshot", "Win+Alt+PrtScn"), r("Ctrl+Alt+Shift+R", "Start / stop recording", "Win+Alt+R")] });
      if (window.FilesHelper) G.push({ id: "fx", title: "File Explorer", rows: [
        r("Ctrl+T / Ctrl+W", "New tab / close tab"), r("Ctrl+Tab", "Next tab"), r("Ctrl+N", "New window"), r("Ctrl+Shift+N", "New folder"),
        r("Ctrl+E or Ctrl+F", "Search"), r("Ctrl+L or Alt+D", "Address bar"), r("F2", "Rename"), r("Delete / Shift+Delete", "Recycle / delete permanently"),
        r("Ctrl+C / X / V", "Copy / cut / paste"), r("Ctrl+Z", "Undo"), r("Ctrl+A", "Select all"), r("Ctrl+Shift+C", "Copy as path"),
        r("Alt+P / Alt+Shift+P", "Preview / details pane"), r("Alt+Enter", "Properties"), r("Alt+Left / Right / Up", "Back / forward / up"), r("F5", "Refresh"),
      ] });
      const touch = [];
      if (p.enabled.shortcutGuide && p.sg.startHold) touch.push({ keys: "Long-press Start", label: "Show this guide (lift to hide)" });
      if (p.enabled.alwaysOnTop && p.aot.menu) touch.push({ keys: "Right-click / long-press a title bar", label: "Window menu · Always on top" });
      if (window.WinX) touch.push({ keys: "Hover / long-press Maximize", label: "Snap layouts" }, { keys: "Drag a title bar to an edge", label: "Snap a window" });
      touch.push({ keys: "Double-click a title bar", label: "Maximize / restore" }, { keys: "Right-click / long-press a taskbar app", label: "Jump list" });
      if (p.tray) touch.push({ keys: "PowerToys icon in the tray", label: "Quick access to every PowerToy" });
      G.push({ id: "touch", title: "Touch & mouse", rows: touch, gesture: true });
      return G;
    }
    const chips = (s) => s.split(/(\s\/\s|\sor\s)/).map((part) => /^\s(\/|or)\s$/.test(part) ? `<span class="ptz-sg-or">${part.trim()}</span>` : kbd(part.split("+").map((x) => x.trim()))).join("");
    function show(m) {
      if (!desktopReady()) return;
      if (ov) { if (m === "sticky") mode = "sticky"; return; }
      closeShellFlyouts();
      if (toastEl) { toastEl.remove(); toastEl = null; }
      mode = m || "sticky"; openedAt = Date.now();
      const p = store();
      const theme = p.sg.theme === "system" ? (document.body.classList.contains("dark") ? "dark" : "light") : p.sg.theme;
      ov = el(`<div class="ptz-sg-ov gbs-skip ptz-sg-${theme}" role="dialog" aria-label="Shortcut Guide" style="--ptz-sg-op:${p.sg.opacity / 100}">
        <div class="ptz-sg">
          <div class="ptz-sg-h">${appIcon()}<b>Shortcut Guide</b><span class="ptz-grow"></span><button class="ptz-ib" data-a="x" aria-label="Close Shortcut Guide">${SVG.close}</button></div>
          <div class="ptz-sg-note"><b>The Windows key doesn't reach web pages on iPad and Mac</b> (⌘ belongs to the browser) — use these Ctrl+Alt shortcuts instead. On Apple keyboards Alt is <kbd>⌥ Option</kbd>.${isApple ? "" : " On a PC keyboard the Win-key versions work too."}</div>
          <div class="ptz-sg-cols">${groups().map((g) => `<section class="ptz-sg-g" data-g="${g.id}"><h4>${esc(g.title)}</h4>${g.rows.map((x) => `<div class="ptz-sg-r"><span class="ptz-sg-l">${esc(x.label)}</span><span class="ptz-sg-k">${g.gesture ? `<span class="ptz-sg-gest">${esc(x.keys)}</span>` : `<span class="ptz-sg-main">${chips(x.keys)}</span>`}${x.win ? `<span class="ptz-sg-win">${chips(x.win)}</span>` : ""}</span></div>`).join("")}</section>`).join("")}</div>
          <div class="ptz-sg-f ptz-dim">${mode === "hold" ? "Release the keys to close" : "Esc, or tap outside, to close"} · change shortcuts in PowerToys Settings</div>
        </div>
      </div>`);
      ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest('[data-a="x"]')) hide(); });
      scr().appendChild(ov);
      requestAnimationFrame(() => ov && ov.classList.add("ptz-show"));
    }
    function hide() { if (!ov) return; const o = ov; ov = null; mode = ""; o.classList.remove("ptz-show"); setTimeout(() => o.remove(), 140); }
    function toggle() { if (ov) hide(); else show("sticky"); }
    // a quick tap of the shortcut keeps it open; holding and releasing closes it
    function released() { if (ov && mode === "hold") { if (Date.now() - openedAt > 650) hide(); else { mode = "sticky"; const f = ov.querySelector(".ptz-sg-f"); if (f) f.firstChild.textContent = "Esc, or tap outside, to close"; } } }
    return { show, hide, toggle, released, isOpen: () => !!ov, mode: () => mode, groups };
  })();

  // =====================================================================
  //  Keyboard
  // =====================================================================
  let recording = false, metaT = null;
  function activate(id, how) {
    if (!enabled(id)) return false;
    if (id === "colorPicker") CP.start();
    else if (id === "alwaysOnTop") AOT.toggle();
    else if (id === "powerRename") { const sel = PR.explorerSelection(); PR.open(sel); }
    else if (id === "textExtractor") TE.start();
    else if (id === "shortcutGuide") { if (how === "key") { if (SG.isOpen()) SG.hide(); else SG.show("hold"); } else SG.toggle(); }
    return true;
  }
  window.addEventListener("keydown", (e) => {
    if (recording || !desktopReady() || kiosk()) return;
    if (!(window.State && State.data)) return;
    const p = store();
    if (SG.isOpen() && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); SG.hide(); return; }
    for (const t of TOOLS) {
      if (!p.enabled[t.id]) continue;
      if (matches(e, p.keys[t.id]) || (p.winKeys && !isApple && t.win && matches(e, t.win))) {
        e.preventDefault(); e.stopPropagation();
        if (!e.repeat) activate(t.id, "key");
        return;
      }
    }
    // Hold the Windows key (PC keyboards) to show the Shortcut Guide, like PowerToys.
    if (e.key === "Meta" && !isApple && !e.repeat && p.enabled.shortcutGuide && p.sg.holdWin && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      clearTimeout(metaT); metaT = setTimeout(() => { metaT = null; SG.show("hold"); }, p.sg.holdMs);
    } else if (metaT) { clearTimeout(metaT); metaT = null; }
    else if (SG.isOpen() && SG.mode() === "hold" && !/^(Control|Alt|Shift|Meta|OS)$/.test(e.key)) SG.hide();   // Win+<key> used: the guide gets out of the way
  }, true);
  window.addEventListener("keyup", (e) => {
    if (metaT && (e.key === "Meta" || !e.metaKey)) { clearTimeout(metaT); metaT = null; }
    if (SG.isOpen() && SG.mode() === "hold" && /^(Control|Alt|Shift|Meta|OS)$/.test(e.key)) SG.released();
  }, true);
  window.addEventListener("blur", () => { clearTimeout(metaT); metaT = null; if (SG.mode() === "hold") SG.hide(); });

  // Long-press Start (touch / pen) = hold to show the Shortcut Guide; lifting hides it.
  (function startHold() {
    let t = null, sx = 0, sy = 0, fired = false, swallowUntil = 0;
    document.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" || !e.target.closest) return;
      const b = e.target.closest(".taskbar .tb-btn.start"); if (!b) return;
      if (!enabled("shortcutGuide") || !store().sg.startHold || kiosk()) return;
      sx = e.clientX; sy = e.clientY; fired = false; clearTimeout(t);
      t = setTimeout(() => { t = null; fired = true; SG.show("hold"); }, 650);
    }, true);
    document.addEventListener("pointermove", (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { clearTimeout(t); t = null; } }, true);
    ["pointerup", "pointercancel"].forEach((ty) => document.addEventListener(ty, () => {
      if (t) { clearTimeout(t); t = null; }
      if (fired) { fired = false; swallowUntil = Date.now() + 700; if (SG.mode() === "hold") SG.hide(); }
    }, true));
    window.addEventListener("click", (e) => { if (Date.now() < swallowUntil && e.target.closest && e.target.closest(".taskbar .tb-btn.start")) { swallowUntil = 0; e.preventDefault(); e.stopPropagation(); } }, true);
  })();

  // =====================================================================
  //  Taskbar tray icon + quick-access flyout
  // =====================================================================
  let trayFly = null, trayOpenedAt = 0;
  function closeTrayFly() { if (trayFly) { trayFly.remove(); trayFly = null; const b = document.querySelector(".ptz-tray"); if (b) b.classList.remove("ptz-on"); } }
  const Tray = (function () {
    function ensure() {
      const tray = document.querySelector(".taskbar .tb-tray");
      const mine = document.querySelector(".ptz-tray");
      const want = !!(tray && window.State && State.data && store().tray && !kiosk() && desktopReady());
      if (!want) { if (mine) mine.remove(); return; }
      if (mine && mine.parentNode === tray) return;
      if (mine) mine.remove();
      const b = el(`<button class="ptz-tray" type="button" title="PowerToys" aria-label="PowerToys quick access"><img src="assets/powertoys.png" alt="" draggable="false"></button>`);
      b.onclick = (e) => { e.stopPropagation(); if (trayFly) closeTrayFly(); else openFly(b); };
      tray.insertBefore(b, tray.firstChild);
    }
    function openFly(anchor) {
      closeShellFlyouts();
      const p = store(), w = AOT.focused(), pinnedW = w && AOT.isPinned(w);
      const tiles = [
        ["colorPicker", "Color Picker"], ["textExtractor", "Text Extractor"],
        ["alwaysOnTop", w ? (pinnedW ? "Unpin window" : "Pin window on top") : "Always on Top"],
        ["powerRename", "PowerRename"], ["shortcutGuide", "Shortcut Guide"],
      ].filter(([id]) => p.enabled[id]);
      trayFly = el(`<div class="ptz-fly gbs-skip" role="dialog" aria-label="PowerToys quick access">
        <div class="ptz-fly-h">${appIcon()}<b>PowerToys</b><span class="ptz-grow"></span><button class="ptz-ib" data-a="settings" title="Settings" aria-label="PowerToys Settings">${SVG.gear}</button></div>
        <div class="ptz-fly-grid">${tiles.map(([id, name]) => `<button class="ptz-fly-t${id === "alwaysOnTop" && pinnedW ? " ptz-on" : ""}" data-t="${id}">${icoTool(id, 22)}<span>${esc(name)}</span>${id === "alwaysOnTop" && w ? `<small>${esc(AOT.titleOf(w).slice(0, 28))}</small>` : ""}</button>`).join("") || '<div class="ptz-dim">All utilities are turned off.</div>'}</div>
        <button class="ptz-fly-all" data-a="settings">All settings</button>
      </div>`);
      scr().appendChild(trayFly);
      anchor.classList.add("ptz-on");
      const r = anchor.getBoundingClientRect();
      trayFly.style.right = Math.max(8, window.innerWidth - r.right - 40) + "px";
      trayOpenedAt = Date.now();
      trayFly.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        const t = b.dataset.t, a = b.dataset.a;
        closeTrayFly();
        if (a === "settings") { Settings.open(); return; }
        if (t === "alwaysOnTop") { AOT.toggle(w); return; }
        if (t) setTimeout(() => activate(t, "tray"), 30);
      });
    }
    document.addEventListener("pointerdown", (e) => { if (trayFly && !trayFly.contains(e.target) && !e.target.closest(".ptz-tray") && Date.now() - trayOpenedAt > 200) closeTrayFly(); }, true);
    window.addEventListener("keydown", (e) => { if (trayFly && e.key === "Escape") { e.preventDefault(); closeTrayFly(); } }, true);
    setInterval(ensure, 1200);
    return { ensure, refresh: () => { if (trayFly) closeTrayFly(); ensure(); } };
  })();

  // =====================================================================
  //  POWERTOYS SETTINGS
  // =====================================================================
  const Settings = (function () {
    let ref = null, page = null, body = null;
    const PAGES = [{ id: "general", name: "General" }].concat(TOOLS.map((t) => ({ id: t.id, name: t.name })));
    function open(pg) {
      ensureCss();
      const p = store();
      if (pg && PAGES.some((x) => x.id === pg)) { p.page = pg; save(); }
      if (ref && ref.win.isConnected) { WM.focusWindow(ref.win); go(p.page); return ref; }
      const W = Math.min(1000, window.innerWidth - 24), H = Math.min(680, window.innerHeight - 70);
      ref = WM.createWindow({ title: "PowerToys Settings", icon: appIcon(), width: W, height: H, appId: "powertoys", onClose: () => { ref = null; body = null; } });
      body = ref.body; body.classList.add("ptz-set-host");
      body.innerHTML = `<div class="ptz-set"><nav class="ptz-nav" aria-label="PowerToys">
          <div class="ptz-nav-h">${window.Icon ? Icon.box("powertoys", "PowerToys", 22) : ""}<b>PowerToys</b></div>
          ${PAGES.map((x) => `<button class="ptz-nav-b" data-page="${x.id}" title="${esc(x.name)}">${icoTool(x.id, 18)}<span>${esc(x.name)}</span></button>`).join("")}
        </nav><main class="ptz-page" tabindex="-1"></main></div>`;
      body.querySelector(".ptz-nav").addEventListener("click", (e) => { const b = e.target.closest("[data-page]"); if (b) go(b.dataset.page); });
      body.addEventListener("click", onClick);
      body.addEventListener("change", onChange);
      body.addEventListener("input", onInput);
      if (window.ResizeObserver) new ResizeObserver(() => body && body.classList.toggle("ptz-compact", body.clientWidth < 660)).observe(body);
      go(p.page);
      return ref;
    }
    function go(id) {
      if (!body) return;
      const p = store(); p.page = id; save(); page = id;
      body.querySelectorAll("[data-page]").forEach((b) => { const on = b.dataset.page === id; b.classList.toggle("ptz-on", on); b.setAttribute("aria-current", on ? "page" : "false"); });
      const main = body.querySelector(".ptz-page");
      main.innerHTML = id === "general" ? general() : toolPage(id);
      main.scrollTop = 0;
    }
    function refresh(id) { if (body && (!id || id === page)) { const main = body.querySelector(".ptz-page"), st = main.scrollTop; go(page); main.scrollTop = st; } }
    const sw = (key, on, label, dis) => `<button class="ptz-switch${on ? " ptz-on" : ""}" role="switch" aria-checked="${!!on}" data-sw="${key}"${dis ? " disabled" : ""} aria-label="${esc(label || "")}"><i></i></button><span class="ptz-sw-l">${on ? "On" : "Off"}</span>`;
    const card = (title, desc, ctrl, extra) => `<div class="ptz-card"><div class="ptz-card-tx"><b>${title}</b>${desc ? `<span>${desc}</span>` : ""}</div><div class="ptz-card-c">${ctrl || ""}</div>${extra || ""}</div>`;
    function shortcutCard(t) {
      const p = store(), k = p.keys[t.id];
      return card("Activation shortcut", (t.win && !isApple && p.winKeys ? "Also " + kbd(keyParts(t.win), "ptz-keys-sm") + " on PC keyboards. " : "") + "Needs a hardware keyboard.",
        `${kbd(keyParts(k))}<button class="ptz-btn" data-a="edit-key" data-t="${t.id}">Edit</button>${sameKey(k, t.key) ? "" : `<button class="ptz-link" data-a="reset-key" data-t="${t.id}">Reset</button>`}`);
    }
    function general() {
      const p = store();
      return `<h1 class="ptz-h1">General</h1>
        <div class="ptz-hero">${window.Icon ? Icon.box("powertoys", "PowerToys", 56) : ""}<div><b>PowerToys</b><span>Version v${VERSION} · Windows 12 edition</span><span class="ptz-dim">Up to date <i class="ptz-sim">simulated</i></span></div></div>
        <h2 class="ptz-h2">Utilities</h2>
        <div class="ptz-dash">${TOOLS.map((t) => `<div class="ptz-dash-c${p.enabled[t.id] ? "" : " ptz-off"}">
          <div class="ptz-dash-h">${icoTool(t.id, 22)}<b>${esc(t.name)}</b><span class="ptz-grow"></span>${sw("en:" + t.id, p.enabled[t.id], "Enable " + t.name)}</div>
          <p>${esc(t.short)}</p>
          <div class="ptz-dash-f">${kbd(keyParts(p.keys[t.id]), "ptz-keys-sm")}<span class="ptz-grow"></span><button class="ptz-link" data-page-go="${t.id}">Settings</button><button class="ptz-btn ptz-sm" data-launch="${t.id}"${p.enabled[t.id] ? "" : " disabled"}>Launch</button></div>
        </div>`).join("")}</div>
        <h2 class="ptz-h2">Keyboard</h2>
        ${card("Also accept Windows-key shortcuts", isApple ? "Not available on this device — the ⌘ key belongs to the browser on iPad and Mac." : "Win+Shift+C, Win+Ctrl+T, Win+Shift+T, Win+Shift+/ and holding Win, on PC keyboards.", sw("winKeys", p.winKeys && !isApple, "Windows-key shortcuts", isApple))}
        ${card("Shortcut Guide", "See every shortcut that works here.", `<button class="ptz-btn" data-launch="shortcutGuide">Open</button>`)}
        <h2 class="ptz-h2">Taskbar</h2>
        ${card("Show PowerToys in the taskbar", "A tray icon with quick access to every utility — handy on touch screens.", sw("tray", p.tray, "Tray icon"))}
        ${card("Run at startup", "PowerToys starts with Windows 12. <i class=\"ptz-sim\">simulated</i>", sw("startup", true, "Run at startup", true))}
        <h2 class="ptz-h2">Backup &amp; restore</h2>
        ${card("Restore default settings", "Turns every utility on and resets shortcuts and options. Color history is kept.", `<button class="ptz-btn" data-a="defaults">Restore defaults</button>`)}
        <h2 class="ptz-h2">How it works here</h2>
        <div class="ptz-about">
          <p><b>Real:</b> Color Picker uses the browser's system eyedropper where it exists (desktop Chrome / Edge) and otherwise samples a capture of the Windows 12 screen; values and clipboard copies are real. Always on Top really keeps windows above others. PowerRename really renames your files. Text Extractor copies the actual on-screen text inside the rectangle${TE.hasOCR() ? " and reads pictures with this browser's TextDetector" : ""}.</p>
          <p><b>Simulated:</b> the version / update check and “Run at startup”. ${TE.hasOCR() ? "" : "This browser has no built-in OCR, so text inside pictures can't be read (no OCR engine is downloaded)."}</p>
        </div>`;
    }
    function toolPage(id) {
      const t = toolById(id), p = store(), on = p.enabled[id];
      const head = `<div class="ptz-ph">${icoTool(id, 34)}<div><h1 class="ptz-h1">${esc(t.name)}</h1><p class="ptz-dim">${esc(t.short)}</p></div></div>
        ${card("Enable " + esc(t.name), "", sw("en:" + id, on, "Enable " + t.name))}`;
      const launch = (label) => `<button class="ptz-btn ptz-primary" data-launch="${id}"${on ? "" : " disabled"}>${label}</button>`;
      let x = "";
      if (id === "colorPicker") {
        const cp = p.cp, hasEd = typeof window.EyeDropper === "function";
        x = `${shortcutCard(t)}
          ${card("Launch", "", launch("Pick a color"))}
          <h2 class="ptz-h2">Behavior</h2>
          ${card("Picker", hasEd ? "This browser has the system eyedropper — it can sample real pixels anywhere on your screen." : "This browser has no system eyedropper, so the Windows 12 screen is captured and sampled (with a magnifier).",
            `<select class="ptz-in" data-set="cp.mode"><option value="auto"${cp.mode === "auto" ? " selected" : ""}>Automatic${hasEd ? " (system eyedropper)" : ""}</option><option value="screen"${cp.mode === "screen" ? " selected" : ""}>Windows 12 screen + magnifier</option></select>`)}
          ${card("Open the editor after picking", "Otherwise the color is just copied.", sw("cp.editor", cp.editor, "Open editor"))}
          ${card("Default color format", "Copied to the clipboard when you pick a color.", `<select class="ptz-in" data-set="cp.copyFormat">${FORMATS.map((f) => `<option${f === cp.copyFormat ? " selected" : ""}>${f}</option>`).join("")}</select>`)}
          <h2 class="ptz-h2">Color formats in the editor</h2>
          <div class="ptz-fmtlist">${FORMATS.map((f) => `<div class="ptz-fmt-r"><b>${f}</b><code>${esc(Color.format(f, { r: 30, g: 144, b: 255 }))}</code><span class="ptz-grow"></span>${sw("fmt:" + f, cp.formats[f], f)}</div>`).join("")}</div>
          <h2 class="ptz-h2">History</h2>
          ${card(cp.history.length + " color" + (cp.history.length === 1 ? "" : "s") + " saved", `<span class="ptz-hist-mini">${cp.history.slice(0, 16).map((h) => `<i style="background:${esc(h)}" title="${esc(h)}"></i>`).join("")}</span>`,
            `<button class="ptz-btn" data-a="cp-editor">Open editor</button><button class="ptz-btn" data-a="cp-clear"${cp.history.length ? "" : " disabled"}>Clear</button>`)}`;
      } else if (id === "alwaysOnTop") {
        const a = p.aot, list = AOT.pinned();
        x = `${shortcutCard(t)}
          ${card("Pin the focused window", "Or right-click / long-press any title bar and choose Always on top.", launch("Pin / unpin focused window"))}
          ${card("Title bar menu", "Right-click (long-press on touch) a window's title bar for Always on top, Maximize, Minimize, Snap layouts and Close.", sw("aot.menu", a.menu, "Title bar menu"))}
          <h2 class="ptz-h2">Appearance &amp; behavior</h2>
          ${card("Show a border around the pinned window", "", sw("aot.border", a.border, "Border"))}
          ${card("Border color", "", `<label class="ptz-chk"><input type="checkbox" data-set="aot.accent"${a.accent ? " checked" : ""}> Use the accent color</label><input type="color" class="ptz-color" data-set="aot.color" value="${esc(a.color)}"${a.accent ? " disabled" : ""} aria-label="Border color">`)}
          ${card("Border thickness", "", `<input type="range" min="1" max="12" value="${a.thickness}" data-set="aot.thickness" aria-label="Border thickness"><output class="ptz-out">${a.thickness} px</output>`)}
          ${card("Play a sound when pinning", "", sw("aot.sound", a.sound, "Sound"))}
          <h2 class="ptz-h2">Pinned windows</h2>
          ${list.length ? `<div class="ptz-list">${list.map((w, i) => `<div class="ptz-list-r"><span>${esc(AOT.titleOf(w))}</span><span class="ptz-grow"></span><button class="ptz-btn ptz-sm" data-a="aot-unpin" data-i="${i}">Unpin</button></div>`).join("")}</div>` : '<p class="ptz-dim">No window is pinned.</p>'}`;
      } else if (id === "powerRename") {
        x = `${shortcutCard(t)}
          ${card("Open PowerRename", "With the items selected in File Explorer, if any.", launch("Open PowerRename"))}
          ${card("Show in File Explorer's right-click menu", "“Rename with PowerRename” on selected files and folders.", sw("pr.explorerMenu", p.pr.explorerMenu, "Explorer menu"))}
          ${card("Remember the last search, replace and options", "", sw("pr.remember", p.pr.remember, "Remember options"))}
          <div class="ptz-about"><p>Renames really happen in your files. Read-only items and system locations are skipped, names are checked like Windows does, and the last rename can be undone from PowerRename.</p>
          <p>Enumerate: <code>\${}</code>, <code>\${start=1}</code>, <code>\${start=10,increment=5,padding=3}</code>. Dates (file modified time): <code>$YYYY $YY $MMMM $MMM $MM $M $DDDD $DDD $DD $D $hh $h $mm $m $ss $s $fff</code>.</p></div>`;
      } else if (id === "textExtractor") {
        x = `${shortcutCard(t)}
          ${card("Launch", "", launch("Extract text"))}
          ${card("Join lines into a single line by default", "You can also switch this on the selection bar.", sw("te.singleLine", p.te.singleLine, "Single line"))}
          ${card("Show the text in the notification", "", sw("te.preview", p.te.preview, "Preview"))}
          ${card("Text in pictures (OCR)", TE.hasOCR() ? "Available — this browser's TextDetector reads text in images and canvases, on this device." : "Not available in this browser — there is no built-in OCR and none is downloaded. On-screen text (everything that isn't a picture) is copied exactly.", `<span class="ptz-pill${TE.hasOCR() ? " ptz-ok" : ""}">${TE.hasOCR() ? "Available" : "Not available"}</span>`)}`;
      } else if (id === "shortcutGuide") {
        x = `${shortcutCard(t)}
          ${card("Open the guide", "Tap the shortcut to keep it open, or hold it and release to close.", launch("Show Shortcut Guide"))}
          ${card("Hold the Windows key to show", isApple ? "Not available on iPad / Mac — the ⌘ key belongs to the browser." : "PC keyboards. Release the key to hide it.", sw("sg.holdWin", p.sg.holdWin && !isApple, "Hold Windows key", isApple))}
          ${card("Press duration", "How long to hold the Windows key before the guide appears.", `<input type="range" min="300" max="3000" step="100" value="${p.sg.holdMs}" data-set="sg.holdMs" aria-label="Press duration"${isApple ? " disabled" : ""}><output class="ptz-out">${p.sg.holdMs} ms</output>`)}
          ${card("Long-press Start to show (touch)", "Lift your finger to hide it.", sw("sg.startHold", p.sg.startHold, "Long-press Start"))}
          ${card("Theme", "", `<select class="ptz-in" data-set="sg.theme">${[["system", "Windows default"], ["light", "Light"], ["dark", "Dark"]].map(([v, n]) => `<option value="${v}"${p.sg.theme === v ? " selected" : ""}>${n}</option>`).join("")}</select>`)}
          ${card("Background opacity", "", `<input type="range" min="40" max="100" value="${p.sg.opacity}" data-set="sg.opacity" aria-label="Background opacity"><output class="ptz-out">${p.sg.opacity}%</output>`)}`;
      }
      return head + `<div class="ptz-tool${on ? "" : " ptz-dimmed"}">${x}</div>`;
    }
    function setPath(path, v) { const p = store(); const [a, b] = path.split("."); p[a][b] = v; save(); }
    function onClick(e) {
      const b = e.target.closest("button"); if (!b || !body) return;
      if (b.dataset.pageGo) { go(b.dataset.pageGo); return; }
      if (b.dataset.launch) { const id = b.dataset.launch; if (id === "colorPicker" || id === "textExtractor") { if (ref) ref.win.style.visibility = "hidden"; setTimeout(() => { activate(id, "settings"); restoreAfterOverlay(); }, 30); } else activate(id, "settings"); return; }
      if (b.dataset.sw) {
        const k = b.dataset.sw, p = store(), on = !b.classList.contains("ptz-on");
        if (k.startsWith("en:")) { p.enabled[k.slice(3)] = on; save(); if (!on && k === "en:alwaysOnTop") AOT.unpinAll(); Tray.refresh(); }
        else if (k.startsWith("fmt:")) { p.cp.formats[k.slice(4)] = on; save(); Editor.refresh(); }
        else if (k === "winKeys" || k === "tray") { p[k] = on; save(); Tray.ensure(); }
        else if (k.indexOf(".") > 0) { setPath(k, on); if (k.startsWith("aot.")) AOT.restyle(); if (k === "cp.editor") {} }
        refresh(); return;
      }
      const a = b.dataset.a;
      if (a === "edit-key") Recorder.open(b.dataset.t);
      else if (a === "reset-key") { store().keys[b.dataset.t] = Object.assign({}, toolById(b.dataset.t).key); save(); refresh(); }
      else if (a === "defaults") {
        if (!confirm("Restore all PowerToys settings to their defaults?")) return;
        const hist = store().cp.history.slice(); delete ad().powertoys; store().cp.history = hist; save(); AOT.restyle(); Tray.refresh(); go("general");
      }
      else if (a === "cp-editor") Editor.open();
      else if (a === "cp-clear") { store().cp.history.length = 0; save(); Editor.refresh(); refresh(); }
      else if (a === "aot-unpin") { const w = AOT.pinned()[+b.dataset.i]; if (w) AOT.unpin(w); }
    }
    function restoreAfterOverlay() {
      const w = ref && ref.win; if (!w) return;
      const t = setInterval(() => { if (!document.querySelector(".ptz-cp-ov, .ptz-te-ov")) { clearInterval(t); w.style.visibility = ""; } }, 150);
      setTimeout(() => { if (!document.querySelector(".ptz-cp-ov, .ptz-te-ov")) { clearInterval(t); w.style.visibility = ""; } }, 1500);
    }
    function onChange(e) {
      const t = e.target, k = t.dataset.set; if (!k) return;
      let v = t.type === "checkbox" ? t.checked : t.type === "range" ? +t.value : t.value;
      setPath(k, v);
      if (k.startsWith("aot.")) AOT.restyle();
      if (k === "cp.copyFormat" || k === "cp.mode") Editor.refresh();
      if (t.type !== "range") refresh();
    }
    function onInput(e) {
      const t = e.target, k = t.dataset.set; if (!k || t.type !== "range") return;
      setPath(k, +t.value);
      const o = t.nextElementSibling; if (o && o.tagName === "OUTPUT") o.textContent = t.value + (k === "sg.opacity" ? "%" : k === "sg.holdMs" ? " ms" : " px");
      if (k.startsWith("aot.")) AOT.restyle();
    }
    return { open, refresh, go, page: () => page, isOpen: () => !!ref };
  })();

  // ---------- Shortcut recorder ----------
  const Recorder = (function () {
    function systemTaken() {
      // shortcuts other parts of Windows 12 already use (Ctrl+Alt+letter family)
      const L = [];
      const add = (code, label, s) => L.push({ k: { c: 1, a: 1, s: s ? 1 : 0, code }, label });
      if (window.PowerTools) { add("KeyV", "Clipboard history"); add("Period", "Emoji panel"); add("Semicolon", "Emoji panel"); }
      if (window.Recall) add("KeyJ", "Recall");
      if (window.Widgets12) add("KeyW", "Widgets");
      if (window.NotifCenter) add("KeyN", "Notification center");
      add("KeyR", "Run"); add("KeyR", "Game Bar recording", true);
      if (window.GameBar || window.GBSnap) { add("KeyG", "Xbox Game Bar"); add("KeyS", "Screenshot", true); add("PrintScreen", "Screenshot"); }
      if (window.WinX) ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].forEach((c) => add(c, c === "Tab" ? "Window switcher" : c === "ArrowUp" || c === "ArrowDown" ? "Task View" : "Switch desktop"));
      return L;
    }
    function open(id) {
      const t = toolById(id); if (!t) return;
      const host = document.querySelector(".ptz-set-host"); if (!host) return;
      let cand = Object.assign({}, store().keys[id]);
      const mask = el(`<div class="ptz-modal-mask"><div class="ptz-modal ptz-rec" role="dialog" aria-label="Activation shortcut" tabindex="-1">
        <div class="ptz-modal-h"><b>Activation shortcut — ${esc(t.name)}</b></div>
        <p class="ptz-dim">Press a key combination. It needs Ctrl, Alt${isApple ? "" : " or Win"} plus another key.</p>
        <div class="ptz-rec-keys" aria-live="polite"></div>
        <div class="ptz-rec-msg" aria-live="polite"></div>
        <details class="ptz-rec-man"><summary>No keyboard? Choose the keys</summary>
          <div class="ptz-row">${[["c", "Ctrl"], ["a", "Alt"], ["s", "Shift"]].concat(isApple ? [] : [["m", "Win"]]).map(([k, n]) => `<label class="ptz-chk"><input type="checkbox" data-m="${k}"> ${n}</label>`).join("")}
          <select class="ptz-in" data-m="code" aria-label="Key">${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => `<option value="Key${c}">${c}</option>`).join("")}${"0123456789".split("").map((c) => `<option value="Digit${c}">${c}</option>`).join("")}<option value="Slash">/</option><option value="Period">.</option><option value="Comma">,</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `<option value="F${n}">F${n}</option>`).join("")}</select></div>
        </details>
        <div class="ptz-row ptz-modal-f"><button class="ptz-link" data-a="reset">Reset to ${esc(keyText(t.key))}</button><span class="ptz-grow"></span><button class="ptz-btn ptz-primary" data-a="save">Save</button><button class="ptz-btn" data-a="cancel">Cancel</button></div>
      </div></div>`);
      host.appendChild(mask);
      const keysEl = mask.querySelector(".ptz-rec-keys"), msg = mask.querySelector(".ptz-rec-msg"), saveB = mask.querySelector('[data-a="save"]');
      function check() {
        keysEl.innerHTML = kbd(keyParts(cand));
        let err = "", warn = "";
        if (!validKey(cand)) err = "Add Ctrl, Alt" + (isApple ? "" : " or Win") + ".";
        else if (!cand.c && !cand.a && cand.m && isApple) err = "⌘ shortcuts don't reach web pages on this device.";
        const dup = TOOLS.find((x) => x.id !== id && sameKey(store().keys[x.id], cand));
        if (!err && dup) err = "Already used by " + dup.name + ".";
        const sys = systemTaken().find((x) => sameKey(x.k, cand));
        if (!err && sys) warn = "Windows 12 also uses this for " + sys.label + " — both will run.";
        msg.className = "ptz-rec-msg" + (err ? " ptz-red" : warn ? " ptz-warn" : "");
        msg.textContent = err || warn || "";
        saveB.disabled = !!err;
        const man = mask.querySelectorAll("[data-m]"); man.forEach((m) => { if (m.type === "checkbox") m.checked = !!cand[m.dataset.m]; else m.value = cand.code; });
      }
      const MOD = /^(Control|Alt|Shift|Meta|OS|AltGraph|CapsLock)$/;
      const onKey = (e) => {
        if (e.target && e.target.closest && e.target.closest(".ptz-rec-man select, .ptz-rec-man summary") && !e.ctrlKey && !e.altKey && !e.metaKey) { if (e.key === "Escape") { e.preventDefault(); close(); } return; }
        if (e.key === "Escape" && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); close(); return; }
        if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) return;
        e.preventDefault(); e.stopPropagation();
        if (MOD.test(e.key)) { keysEl.innerHTML = kbd(keyParts({ c: e.ctrlKey, a: e.altKey, s: e.shiftKey, m: e.metaKey, code: "" }).slice(0, -1).concat(["…"])); return; }
        cand = { c: e.ctrlKey ? 1 : 0, a: e.altKey ? 1 : 0, s: e.shiftKey ? 1 : 0, m: e.metaKey ? 1 : 0, code: e.code || "" };
        check();
      };
      function close() { recording = false; window.removeEventListener("keydown", onKey, true); mask.remove(); }
      recording = true;
      window.addEventListener("keydown", onKey, true);
      mask.addEventListener("change", (e) => { const m = e.target.dataset.m; if (!m) return; if (m === "code") cand.code = e.target.value; else cand[m] = e.target.checked ? 1 : 0; check(); });
      mask.addEventListener("click", (e) => {
        if (e.target === mask) { close(); return; }
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.a === "cancel") close();
        else if (b.dataset.a === "reset") { cand = Object.assign({}, t.key); check(); }
        else if (b.dataset.a === "save") { if (saveB.disabled) return; store().keys[id] = { c: cand.c ? 1 : 0, a: cand.a ? 1 : 0, s: cand.s ? 1 : 0, m: cand.m ? 1 : 0, code: cand.code }; save(); close(); Settings.refresh(); }
      });
      check();
      try { mask.querySelector(".ptz-rec").focus({ preventScroll: true }); } catch (e) {}
    }
    return { open, isOpen: () => recording };
  })();

  // =====================================================================
  //  App registration
  // =====================================================================
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.powertoys = function (arg) { Settings.open(typeof arg === "string" ? arg : undefined); };
  try {
    if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === "powertoys")) {
      Catalog.storeApps.push({ id: "powertoys", name: "PowerToys", cat: "Utilities", price: 0, builtin: "powertoys",
        desc: "Microsoft PowerToys: Color Picker, Always on Top, PowerRename, Text Extractor (OCR) and Shortcut Guide. Shortcuts: Ctrl+Alt+Shift+C, Ctrl+Alt+T, Ctrl+Alt+Shift+N, Ctrl+Alt+Shift+T, Ctrl+Alt+Shift+/." });
    }
    const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (ex.indexOf("powertoys") < 0) ex.push("powertoys");
  } catch (e) {}
  if (document.body) ensureCss(); else document.addEventListener("DOMContentLoaded", ensureCss);

  window.PowerToys = {
    version: VERSION,
    open: (page) => Settings.open(page),
    settings: () => store(),
    activate,
    colorPicker: { start: CP.start, cancel: CP.cancel, pick: CP.picked, openEditor: Editor.open, isOpen: CP.isOpen },
    alwaysOnTop: { toggle: AOT.toggle, pin: AOT.pin, unpin: AOT.unpin, isPinned: AOT.isPinned, pinned: AOT.pinned, focused: AOT.focused },
    powerRename: { open: PR.open, compute: PR.compute, explorerSelection: PR.explorerSelection, current: PR.current, applyFormat: PR.applyFormat },
    textExtractor: { start: TE.start, stop: TE.stop, extract: TE.extract, hasOCR: TE.hasOCR, isOpen: TE.isOpen },
    shortcutGuide: { show: SG.show, hide: SG.hide, toggle: SG.toggle, isOpen: SG.isOpen, groups: SG.groups },
    color: Color,
    keyText,
    tray: Tray,
    windowMenu: WinMenu,
  };
})();
