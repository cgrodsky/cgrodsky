/* =====================================================================
   Windows 11 Accessibility — Vision (js/a11y-vision.js)
   Load EARLY, right after js/a11y-core.js (both right after js/state.js).

   REAL here
   - Contrast themes Aquatic, Desert, Dusk, Night sky (Windows 11 palettes) and
     custom themes: <html class="ax-hc"> + --ax-* variables; css/a11y.css
     repaints every element of every app with the theme's 8 colors.
   - Color filters: one SVG <feColorMatrix> on the root (<html>):
     grayscale, inverted, grayscale inverted, and correction filters for
     deuteranopia / protanopia / tritanopia (Machado 2009 simulation +
     daltonization) with Intensity and Color boost. On iPad / Safari the three
     simple filters use the equivalent CSS functions (SVG filters on a whole
     page are software-rendered there and make it crawl).
   - Mouse pointer style / size / color as SVG data-URI cursors (≤128 px, the
     browser limit); bigger sizes and the true "inverted" style use a drawn
     pointer with mix-blend-mode: difference. iPad shows no cursor (iPadOS draws its own).
   - Touch indicator (circle under each finger), text cursor indicator and
     text cursor thickness (drawn caret; the native caret is hidden).
   ===================================================================== */
(function () {
  "use strict";
  if (!window.A11y || A11y.vision) return;
  const { cfg, get, set, on, el, esc, clamp } = A11y;
  const root = document.documentElement;
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|Android/.test(navigator.userAgent);

  // =====================================================================
  //  CONTRAST THEMES
  // =====================================================================
  const ROLES = [
    ["bg", "Background"], ["fg", "Text"], ["link", "Hyperlinks"], ["dis", "Inactive text"],
    ["selBg", "Selected text — background"], ["selFg", "Selected text — text"], ["btnBg", "Button — background"], ["btnFg", "Button — text"],
  ];
  const THEMES = {
    aquatic: { name: "Aquatic", bg: "#202020", fg: "#ffffff", link: "#75e9fc", dis: "#a6a6a6", selBg: "#8ee3f0", selFg: "#263b50", btnBg: "#202020", btnFg: "#ffffff" },
    desert: { name: "Desert", bg: "#fffaef", fg: "#3d3d3d", link: "#1c5e75", dis: "#676767", selBg: "#903909", selFg: "#fff5e3", btnBg: "#fffaef", btnFg: "#202020" },
    dusk: { name: "Dusk", bg: "#2d3236", fg: "#ffffff", link: "#70ebde", dis: "#a6a6a6", selBg: "#a1bfde", selFg: "#212d3b", btnBg: "#2d3236", btnFg: "#b6f6f0" },
    nightsky: { name: "Night sky", bg: "#000000", fg: "#ffffff", link: "#8080ff", dis: "#a6a6a6", selBg: "#d6b4fd", selFg: "#2b2b2b", btnBg: "#000000", btnFg: "#ffee32" },
  };
  const hex2rgb = (h) => { h = String(h || "").replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); const n = parseInt(h, 16); return isNaN(n) ? [0, 0, 0] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = (h) => { const [r, g, b] = hex2rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function palette(id) {
    id = id || cfg().hc.theme;
    if (THEMES[id]) return THEMES[id];
    const c = id && id.startsWith("custom:") && cfg().hc.customs[id.slice(7)];
    return c ? Object.assign({ name: id.slice(7) }, c) : THEMES.aquatic;
  }
  function themeList() { return Object.keys(THEMES).map((k) => [k, THEMES[k].name]).concat(Object.keys(cfg().hc.customs || {}).map((n) => ["custom:" + n, n])); }
  function applyContrast() {
    const c = cfg().hc, p = palette();
    root.classList.toggle("ax-hc", !!c.on);
    root.classList.toggle("ax-hc-light", !!c.on && lum(p.bg) > 0.5);
    const map = { bg: "--ax-bg", fg: "--ax-fg", link: "--ax-link", dis: "--ax-dis", selBg: "--ax-sel-bg", selFg: "--ax-sel-fg", btnBg: "--ax-btn-bg", btnFg: "--ax-btn-fg" };
    for (const k in map) { if (c.on) root.style.setProperty(map[k], p[k]); else root.style.removeProperty(map[k]); }
    let meta = document.querySelector('meta[name="theme-color"]#ax-theme-color');
    if (c.on) { if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; meta.id = "ax-theme-color"; document.head.appendChild(meta); } meta.content = p.bg; } else if (meta) meta.remove();
  }
  function toggleContrast(announce) {
    const c = cfg().hc;
    set("hc.on", !c.on, { now: true });
    if (announce) A11y.toast(c.on ? "Contrast theme: " + palette().name : "Contrast themes off");
  }

  // =====================================================================
  //  COLOR FILTERS (feColorMatrix on <html>)
  // =====================================================================
  const FILTERS = [
    ["grayscale", "Grayscale"], ["inverted", "Inverted"], ["grayinv", "Grayscale inverted"],
    ["deutan", "Red-green (green weak, deuteranopia)"], ["protan", "Red-green (red weak, protanopia)"], ["tritan", "Blue-yellow (tritanopia)"],
  ];
  const CVD = { deutan: 1, protan: 1, tritan: 1 };
  // Machado, Oliveira & Fernandes (2009), severity 1.0 — linear RGB.
  const SIM = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
  };
  const SHIFT = { protan: [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]], deutan: [[0, 0, 0], [0.7, 1, 0], [0.7, 0, 1]], tritan: [[1, 0, 0.7], [0, 1, 0.7], [0, 0, 0]] };
  const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const mul = (a, b) => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
  const lerpM = (a, b, t) => a.map((r, i) => r.map((v, j) => v + (b[i][j] - v) * t));
  const LW = [0.2126, 0.7152, 0.0722];
  const satM = (s) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => LW[j] * (1 - s) + (i === j ? s : 0)));
  // Returns { m: 3x3, off: [r,g,b], space: "sRGB" | "linearRGB" }
  function filterMatrix(type, intensity, boost) {
    const t = clamp((intensity == null ? 100 : intensity) / 100, 0, 1);
    if (type === "grayscale") return { m: [LW, LW, LW], off: [0, 0, 0], space: "sRGB" };
    if (type === "inverted") return { m: [[-1, 0, 0], [0, -1, 0], [0, 0, -1]], off: [1, 1, 1], space: "sRGB" };
    if (type === "grayinv") return { m: [LW.map((v) => -v), LW.map((v) => -v), LW.map((v) => -v)], off: [1, 1, 1], space: "sRGB" };
    const S = SIM[type] || SIM.deutan, E = SHIFT[type] || SHIFT.deutan;
    const err = I3.map((r, i) => r.map((v, j) => v - S[i][j]));
    const corr = I3.map((r, i) => r.map((v, j) => v + mul(E, err)[i][j]));
    const m = mul(satM(1 + clamp((boost == null ? 50 : boost) / 100, 0, 1) * 0.6), lerpM(I3, corr, t));
    return { m, off: [0, 0, 0], space: "linearRGB" };
  }
  let svgDefs = null;
  function ensureDefs() {
    if (svgDefs && svgDefs.isConnected) return svgDefs;
    svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgDefs.setAttribute("class", "ax-svgdefs"); svgDefs.setAttribute("aria-hidden", "true"); svgDefs.setAttribute("focusable", "false");
    svgDefs.innerHTML = `<defs><filter id="ax-cf" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/></filter></defs>`;
    (document.body || root).appendChild(svgDefs);
    return svgDefs;
  }
  function applyFilters() {
    const c = cfg().cf;
    if (!c.on) { root.style.removeProperty("filter"); root.classList.remove("ax-cf"); return; }
    root.classList.add("ax-cf");
    if (isSafari && !CVD[c.type]) {
      root.style.setProperty("filter", c.type === "grayscale" ? "grayscale(1)" : c.type === "inverted" ? "invert(1)" : "grayscale(1) invert(1)");
    } else {
      const d = ensureDefs(), f = d.querySelector("#ax-cf"), fm = f.querySelector("feColorMatrix");
      const { m, off, space } = filterMatrix(c.type, c.intensity, c.boost);
      f.setAttribute("color-interpolation-filters", space);
      const r = (v) => Math.round(v * 100000) / 100000;
      fm.setAttribute("values", m.map((row, i) => row.map(r).join(" ") + " 0 " + r(off[i])).join("  ") + "  0 0 0 1 0");
      root.style.setProperty("filter", "url(#ax-cf)");
    }
  }
  function toggleFilters() {
    const c = cfg().cf; set("cf.on", !c.on, { now: true });
    A11y.toast(c.on ? "Color filter on: " + (FILTERS.find((f) => f[0] === c.type) || FILTERS[0])[1] : "Color filters off");
  }

  // =====================================================================
  //  MOUSE POINTER (style, size, color)
  // =====================================================================
  const SHAPES = {
    arrow: { d: "M3 2 L3 23 L8.2 18.2 L11.6 26.2 L15.2 24.6 L11.8 16.8 L18.8 16.8 Z", hx: 3, hy: 2, w: 22, h: 28 },
    hand: { d: "M9 3.5c0-1.3 2.5-1.3 2.5 0V12l.3-1.6c.3-1.2 2.4-1 2.4.3v1.2l.3-.9c.4-1.1 2.3-.8 2.3.5v1.3l.4-.6c.6-.9 2.1-.4 2.1.7V19c0 3-2.2 6-5.7 6h-1.6c-2.1 0-3.4-1-4.4-2.6L3.4 17c-.7-1.2.9-2.5 2-1.4L9 19z", hx: 10.2, hy: 2.5, w: 22, h: 28 },
    text: { d: "M7 3h3.2c.8 0 1.3.4 1.8.9.5-.5 1-.9 1.8-.9H17v2h-2.4c-.9 0-1.6.6-1.6 1.6V13h1.5v2H13v6.4c0 1 .7 1.6 1.6 1.6H17v2h-3.2c-.8 0-1.3-.4-1.8-.9-.5.5-1 .9-1.8.9H7v-2h2.4c.9 0 1.6-.6 1.6-1.6V15H9.5v-2H11V6.6C11 5.6 10.3 5 9.4 5H7z", hx: 12, hy: 14, w: 24, h: 28 },
  };
  const ptrPx = (size) => Math.round(24 * (1 + (clamp(size, 1, 15) - 1) * 0.43));    // 24 … ~169 px (Windows 1–15)
  function ptrColors(p) {
    if (p.style === "black") return ["#000000", "#ffffff"];
    if (p.style === "custom") return [p.color || "#c239b3", "#ffffff"];
    if (p.style === "inverted") return ["#ffffff", "#000000"];
    return ["#ffffff", "#000000"];
  }
  function cursorSvg(kind, p, px) {
    const s = SHAPES[kind], [fill, stroke] = ptrColors(p), k = px / 28;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(s.w * k)}" height="${Math.round(s.h * k)}" viewBox="0 0 ${s.w} ${s.h}"><path d="${s.d}" fill="${fill}" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
    return { svg, uri: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), hx: Math.round(s.hx * k), hy: Math.round(s.hy * k) };
  }
  const CUR = { arrow: "", hand: "", text: "" };
  let ptrMode = "native";       // native | image | drawn
  let ptrStyle = null, ptrDiv = null;
  const upgraded = new Set();
  function applyPointer() {
    const p = cfg().ptr, px = ptrPx(p.size);
    const mode = p.size <= 1 && p.style === "white" ? "native" : (p.style === "inverted" || px > 128) ? "drawn" : "image";
    ptrMode = mode;
    root.classList.toggle("ax-ptr", mode === "image"); root.classList.toggle("ax-ptr-drawn", mode === "drawn");
    if (!ptrStyle) { ptrStyle = document.createElement("style"); ptrStyle.id = "ax-ptr-style"; document.head.appendChild(ptrStyle); }
    upgraded.forEach((n) => { if (n.style) n.style.removeProperty("cursor"); }); upgraded.clear();
    if (mode === "image") {
      ["arrow", "hand", "text"].forEach((k) => { const c = cursorSvg(k, p, px); CUR[k] = `url("${c.uri}") ${c.hx} ${c.hy}, ${k === "arrow" ? "default" : k === "hand" ? "pointer" : "text"}`; });
      ptrStyle.textContent = `html.ax-ptr, html.ax-ptr body { cursor: ${CUR.arrow}; }
html.ax-ptr :is(input:not([type=button],[type=submit],[type=reset],[type=checkbox],[type=radio],[type=range],[type=color],[type=file]), textarea, [contenteditable="true"], [contenteditable=""]) { cursor: ${CUR.text} !important; }
html.ax-ptr :is(a[href], button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], select, summary, label, .w12s-click) { cursor: ${CUR.hand} !important; }`;
    } else if (mode === "drawn") {
      ptrStyle.textContent = `html.ax-ptr-drawn, html.ax-ptr-drawn * { cursor: none !important; }`;
    } else ptrStyle.textContent = "";
    if (mode !== "drawn" && ptrDiv) { ptrDiv.remove(); ptrDiv = null; }
    if (mode === "drawn") drawPtr("arrow");
  }
  // Elements whose own CSS asks for a hand / text cursor get the big version (image mode).
  window.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const t = e.target; if (!t || t.nodeType !== 1) return;
    if (ptrMode === "image") {
      if (upgraded.has(t) || t.closest("#ax-layer")) return;
      const c = getComputedStyle(t).cursor;
      if (c === "pointer") { t.style.setProperty("cursor", CUR.hand, "important"); upgraded.add(t); }
      else if (c === "text") { t.style.setProperty("cursor", CUR.text, "important"); upgraded.add(t); }
    } else if (ptrMode === "drawn") drawPtr(kindFor(t));
  }, true);
  function kindFor(t) {
    if (t.closest('input:not([type=button],[type=submit],[type=checkbox],[type=radio],[type=range],[type=color]), textarea, [contenteditable="true"], [contenteditable=""]')) return "text";
    if (t.closest('a[href], button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], select, summary, label, .w12s-click, .tb-btn, .dicon')) return "hand";
    return "arrow";
  }
  let ptrKind = "";
  function drawPtr(kind) {
    if (!ptrDiv) {
      ptrDiv = el(`<div class="ax-bigptr ax-ui" aria-hidden="true"></div>`);
      root.appendChild(ptrDiv);   // not in #ax-layer: mix-blend-mode must reach the page
    }
    if (kind === ptrKind && ptrDiv.firstChild) return;
    ptrKind = kind;
    const p = cfg().ptr, c = cursorSvg(kind, p, ptrPx(p.size));
    ptrDiv.innerHTML = c.svg; ptrDiv.style.marginLeft = -c.hx + "px"; ptrDiv.style.marginTop = -c.hy + "px";
    ptrDiv.classList.toggle("ax-inv", p.style === "inverted");
  }
  window.addEventListener("pointermove", (e) => {
    if (ptrMode !== "drawn" || !ptrDiv) return;
    if (e.pointerType !== "mouse") { ptrDiv.style.display = "none"; return; }
    ptrDiv.style.display = ""; ptrDiv.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  }, { capture: true, passive: true });
  document.addEventListener("mouseleave", () => { if (ptrDiv) ptrDiv.style.display = "none"; });

  // =====================================================================
  //  TOUCH INDICATOR
  // =====================================================================
  const touches = new Map();
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || !cfg().ptr.touch) return;
    const d = el(`<div class="ax-touch${cfg().ptr.dark ? " ax-dark" : ""}" aria-hidden="true"></div>`);
    d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px";
    A11y.layer().appendChild(d); touches.set(e.pointerId, d);
  }, { capture: true, passive: true });
  window.addEventListener("pointermove", (e) => { const d = touches.get(e.pointerId); if (d) { d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; } }, { capture: true, passive: true });
  const touchUp = (e) => { const d = touches.get(e.pointerId); if (!d) return; touches.delete(e.pointerId); d.classList.add("ax-up"); setTimeout(() => d.remove(), 400); };
  window.addEventListener("pointerup", touchUp, true); window.addEventListener("pointercancel", touchUp, true);

  // =====================================================================
  //  CARET GEOMETRY (shared: text cursor, magnifier, narrator)
  // =====================================================================
  const TEXTY = /^(text|search|url|tel|email|password|number|)$/i;
  const isField = (n) => !!n && ((n.tagName === "TEXTAREA") || (n.tagName === "INPUT" && TEXTY.test(n.type || "")));
  const MIRROR_PROPS = ["boxSizing", "width", "height", "overflowX", "overflowY", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize", "fontSizeAdjust", "lineHeight", "fontFamily", "textAlign", "textTransform", "textIndent", "textDecoration", "letterSpacing", "wordSpacing", "tabSize", "MozTabSize", "whiteSpace", "wordBreak", "overflowWrap"];
  let mirror = null;
  // Caret rectangle (viewport coords, already including any magnifier transform) of the focused field.
  function caretRect(node) {
    node = node || document.activeElement;
    if (!node || node === document.body) return null;
    try {
      if (isField(node)) {
        const pos = node.selectionDirection === "backward" ? node.selectionStart : node.selectionEnd;
        if (pos == null) return null;
        const cs = getComputedStyle(node);
        if (!mirror) { mirror = document.createElement("div"); mirror.setAttribute("aria-hidden", "true"); }
        const ms = mirror.style; ms.cssText = "position:absolute;visibility:hidden;left:-9999px;top:0;overflow:hidden";
        MIRROR_PROPS.forEach((p) => { ms[p] = cs[p]; });
        if (node.tagName === "INPUT") { ms.whiteSpace = "pre"; ms.height = cs.height; } else { ms.whiteSpace = "pre-wrap"; ms.overflowWrap = "break-word"; }
        const val = node.type === "password" ? "•".repeat(node.value.length) : node.value;
        mirror.textContent = val.slice(0, pos);
        const mark = document.createElement("span"); mark.textContent = val.slice(pos) || "."; mirror.appendChild(mark);
        document.body.appendChild(mirror);
        const r = node.getBoundingClientRect(), k = r.width / (node.offsetWidth || r.width || 1);   // magnifier scale
        const x = mark.offsetLeft - node.scrollLeft, y = mark.offsetTop - node.scrollTop;
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
        mirror.remove();
        const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
        let top = r.top + (y + bt) * k;
        if (node.tagName === "INPUT") top = r.top + (r.height - lh * k) / 2;
        return { left: r.left + (x + bl) * k, top, height: lh * k, scale: k, color: cs.color };
      }
      const sel = document.getSelection();
      if (sel && sel.rangeCount && node.isContentEditable && node.contains(sel.focusNode)) {
        const rg = document.createRange(); rg.setStart(sel.focusNode, sel.focusOffset); rg.collapse(true);
        let b = rg.getClientRects()[0];
        if (!b) { const host = sel.focusNode.nodeType === 1 ? sel.focusNode : sel.focusNode.parentElement; const hr = host.getBoundingClientRect(); const fs = parseFloat(getComputedStyle(host).fontSize) || 16; b = { left: hr.left + 2, top: hr.top + 2, height: fs * 1.25 }; }
        const k = node.getBoundingClientRect().width / (node.offsetWidth || 1) || 1;
        return { left: b.left, top: b.top, height: b.height || 16, scale: k, color: getComputedStyle(node).color };
      }
    } catch (_) {}
    return null;
  }
  const collapsedSel = (n) => { try { if (isField(n)) return n.selectionStart === n.selectionEnd; const s = document.getSelection(); return !!s && s.isCollapsed; } catch (_) { return true; } };

  // =====================================================================
  //  TEXT CURSOR: indicator (colored triangles) + thickness (drawn caret)
  // =====================================================================
  let ind = null, bar = null, caretRaf = 0;
  function applyCaret() {
    const c = cfg().caret;
    root.classList.toggle("ax-thickcaret", c.thick > 1);
    root.style.setProperty("--ax-ci", (4 + c.size * 3) + "px");
    root.style.setProperty("--ax-cic", c.color || "#c239b3");
    if (!c.ind && ind) { ind.remove(); ind = null; }
    if (c.thick <= 1 && bar) { bar.remove(); bar = null; }
    scheduleCaret();
  }
  function scheduleCaret() { if (!caretRaf) caretRaf = requestAnimationFrame(() => { caretRaf = 0; paintCaret(); }); }
  function paintCaret() {
    const c = cfg().caret; if (!c.ind && c.thick <= 1) return;
    const a = document.activeElement;
    const r = a && (isField(a) || a.isContentEditable) && collapsedSel(a) && !a.closest("#ax-layer") ? caretRect(a) : null;
    if (c.ind) {
      if (!ind) { ind = el(`<div class="ax-caretind" aria-hidden="true"><i></i><b></b><i></i></div>`); A11y.layer().appendChild(ind); }
      if (r) { const w = (4 + c.size * 3) * 2; Object.assign(ind.style, { display: "block", left: (r.left - w / 2) + "px", top: (r.top - (4 + c.size * 3) * 1.25) + "px", width: w + "px", height: (r.height + (4 + c.size * 3) * 2.5) + "px" }); }
      else ind.style.display = "none";
    }
    if (c.thick > 1) {
      if (!bar) { bar = el(`<div class="ax-caretbar" aria-hidden="true"></div>`); A11y.layer().appendChild(bar); }
      if (r) {
        const w = c.thick * (r.scale || 1);
        Object.assign(bar.style, { display: "block", left: (r.left - w / 2) + "px", top: r.top + "px", width: w + "px", height: r.height + "px", background: r.color || "#000" });
        bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = "";
      } else bar.style.display = "none";
    }
  }
  ["selectionchange"].forEach((t) => document.addEventListener(t, scheduleCaret));
  ["input", "keyup", "focusin", "focusout", "scroll", "resize", "pointerup"].forEach((t) => window.addEventListener(t, scheduleCaret, { capture: true, passive: true }));

  // =====================================================================
  //  CAPTION STYLES (real <video> captions via ::cue, Narrator captions)
  // =====================================================================
  const CAPS = {
    default: ["Default", "color:#fff;background:rgba(0,0,0,.8)"],
    small: ["White on black (small caps)", "color:#fff;background:#000;font-variant:small-caps"],
    large: ["Large text", "color:#fff;background:rgba(0,0,0,.85);font-size:150%"],
    yellow: ["Yellow on blue", "color:#ffee32;background:#0b2a6f"],
    outline: ["Outline (no background)", "color:#fff;background:transparent;text-shadow:0 0 3px #000,0 0 3px #000,0 0 3px #000"],
  };
  let capStyle = null;
  function applyCaptions() {
    const s = CAPS[cfg().cap.style] || CAPS.default;
    if (!capStyle) { capStyle = document.createElement("style"); capStyle.id = "ax-cap-style"; document.head.appendChild(capStyle); }
    capStyle.textContent = `::cue{${s[1]}} .ax-nar-cap{${s[1].replace(/background:[^;]+/, (m) => m.replace("transparent", "rgba(0,0,0,.6)"))}}`;
  }

  // =====================================================================
  //  SETTINGS PAGES
  // =====================================================================
  const S = () => State.data;
  A11y.page("ax-textsize", { title: "Text size", ic: "text", section: "vision", order: 1, desc: "Make text bigger across the system", keywords: "font scale bigger larger", build(h, H) {
    const cur = () => clamp(S().textScale || 100, 100, 225);
    let v = cur();
    const prev = H.card(`<div class="w12s-row-s">Text size preview</div><div class="ax-ts-prev" style="font-size:${v / 100}rem;line-height:1.4">Drag the slider until the text here is easy to read, then select Apply.</div>`);
    h.appendChild(prev);
    const pv = prev.querySelector(".ax-ts-prev");
    const sl = H.slider(100, 225, 5, () => v, (x) => { v = x; pv.style.fontSize = x / 100 + "rem"; }, { label: "Text size", fmt: (x) => x + "%" });
    const apply = H.button("Apply", () => { if (window.SysTools && SysTools.setTextScale) SysTools.setTextScale(v); else { S().textScale = v; State.save(); if (window.applyTheme) applyTheme(); } A11y.toast("Text size " + v + "%"); }, true);
    const r = H.row({ ic: "text", t: "Text size", s: "Applies to every app and the taskbar (also HKCU\\…\\Accessibility\\TextScaleFactor in Registry Editor)" });
    r.querySelector(".w12s-row-ctl").append(sl, apply);
    h.appendChild(r);
  } });

  A11y.page("ax-vfx", { title: "Visual effects", ic: "vfx", section: "vision", order: 2, desc: "Scroll bars, transparency, animations", keywords: "animation transparency motion scrollbar", build(h, H) {
    const fx = () => (window.SysTools && SysTools.fx ? SysTools.fx() : ((S().desktop.fx = S().desktop.fx || { round: true, anim: true, shadow: true, blur: true })));
    const upd = () => { State.save(); if (window.applyUiFx) applyUiFx(); };
    h.appendChild(H.row({ t: "Always show scroll bars", s: "Scroll bars stay wide and visible", ctl: H.toggle(() => root.classList.contains("ax-scrollbars"), (v) => { set("keys.scrollbars", v); }) }));
    h.appendChild(H.row({ t: "Transparency effects", s: "Windows and surfaces appear translucent", ctl: H.toggle(() => fx().blur !== false, (v) => { fx().blur = v; upd(); }) }));
    h.appendChild(H.row({ t: "Animation effects", s: "Turning this off also reduces motion everywhere", ctl: H.toggle(() => fx().anim !== false, (v) => { fx().anim = v; upd(); document.body.classList.toggle("a11y-reduce-motion", !v || !!(cfg().on && cfg().reduceMotion)); }) }));
  } });

  A11y.page("ax-pointer", { title: "Mouse pointer and touch", ic: "pointer", section: "vision", order: 3, desc: "Mouse pointer color, size, touch indicator", keywords: "cursor mouse size color touch", build(h, H) {
    const p = () => cfg().ptr;
    const styles = el(`<div class="ax-ptrs" role="radiogroup" aria-label="Mouse pointer style"></div>`);
    [["white", "White"], ["black", "Black"], ["inverted", "Inverted"], ["custom", "Custom"]].forEach(([id, name]) => {
      const c = cursorSvg("arrow", Object.assign({}, p(), { style: id }), 30);
      const b = el(`<button type="button" role="radio" title="${name}" aria-label="${name}" style="${id === "inverted" ? "background:linear-gradient(90deg,#fff 50%,#000 50%)" : ""}">${c.svg}</button>`);
      const paint = () => { b.classList.toggle("sel", p().style === id); b.setAttribute("aria-checked", String(p().style === id)); };
      paint(); b.onclick = () => { set("ptr.style", id); styles.querySelectorAll("button").forEach((x) => x.__p && x.__p()); }; b.__p = paint;
      styles.appendChild(b);
    });
    const r1 = H.row({ ic: "pointer", t: "Mouse pointer style", ctl: styles }); h.appendChild(r1);
    const sw = el(`<div class="ax-swatches" aria-label="Recommended colors"></div>`);
    ["#c239b3", "#00b294", "#ffb900", "#e81123", "#0078d4", "#7fba00", "#ff8c00", "#8764b8"].forEach((c) => {
      const b = el(`<button type="button" class="ax-sw" style="background:${c}" aria-label="Pointer color ${c}"></button>`);
      const paint = () => b.classList.toggle("sel", p().style === "custom" && p().color === c); paint();
      b.onclick = () => { set("ptr.color", c); set("ptr.style", "custom"); sw.querySelectorAll(".ax-sw").forEach((x) => x.__p && x.__p()); styles.querySelectorAll("button").forEach((x) => x.__p && x.__p()); }; b.__p = paint;
      sw.appendChild(b);
    });
    const pick = el(`<input type="color" aria-label="Choose another color">`); pick.value = p().color; pick.oninput = () => { set("ptr.color", pick.value); set("ptr.style", "custom"); };
    sw.appendChild(pick);
    const rc = H.row({ t: "Custom color", s: "Recommended colors", ctl: sw }); h.appendChild(rc);
    h.appendChild(H.row({ t: "Size", s: "1 is the normal size (sizes above 10 are drawn by Windows 12 instead of the browser)", ctl: H.slider(1, 15, 1, () => p().size, (v) => set("ptr.size", v), { label: "Pointer size" }) }));
    h.appendChild(H.head("Touch"));
    h.appendChild(H.row({ t: "Touch indicator", s: "Show a circle on the screen where you touch it", expand: (pn) => pn.appendChild(H.check("Make the circle darker and larger", () => p().dark, (v) => set("ptr.dark", v))), ctl: H.toggle(() => p().touch, (v) => set("ptr.touch", v), "Touch indicator") }));
    h.appendChild(H.row({ ic: "mouse", t: "Mouse keys, speed, acceleration", s: "Use the numeric keypad to move the pointer", sub: "ax-mouse" }));
  } });

  A11y.page("ax-textcursor", { title: "Text cursor", ic: "caret", section: "vision", order: 4, desc: "Text cursor indicator, color, size", keywords: "caret indicator thickness", build(h, H) {
    const c = () => cfg().caret;
    h.appendChild(H.row({ ic: "caret", t: "Text cursor indicator", s: "Show colored marks above and below the text cursor", ctl: H.toggle(() => c().ind, (v) => set("caret.ind", v), "Text cursor indicator") }));
    h.appendChild(H.row({ t: "Size", ctl: H.slider(1, 5, 1, () => c().size, (v) => set("caret.size", v), { label: "Indicator size" }) }));
    const sw = el(`<div class="ax-swatches"></div>`);
    ["#c239b3", "#00b294", "#ffb900", "#e81123", "#0078d4", "#7fba00", "#ff8c00", "#000000"].forEach((col) => {
      const b = el(`<button type="button" class="ax-sw" style="background:${col}" aria-label="Indicator color ${col}"></button>`);
      const paint = () => b.classList.toggle("sel", c().color === col); paint();
      b.onclick = () => { set("caret.color", col); sw.querySelectorAll(".ax-sw").forEach((x) => x.__p && x.__p()); }; b.__p = paint; sw.appendChild(b);
    });
    h.appendChild(H.row({ t: "Recommended colors", ctl: sw }));
    h.appendChild(H.head("Text cursor thickness"));
    h.appendChild(H.row({ t: "Text cursor thickness", s: "1 is the system caret; 2–20 draws a thicker one", ctl: H.slider(1, 20, 1, () => c().thick, (v) => set("caret.thick", v), { label: "Text cursor thickness" }) }));
    const inp = el(`<input class="ax-preview-input" value="Click here to preview the text cursor" aria-label="Text cursor preview">`);
    const card = H.card(`<div class="w12s-row-s">Text cursor preview</div>`); card.appendChild(inp); h.appendChild(card);
  } });

  A11y.page("ax-colorfilters", { title: "Color filters", ic: "filters", section: "vision", order: 6, desc: "Color filters for color blindness, grayscale, inverted", toggle: "cf.on", keywords: "color blind deuteranopia protanopia tritanopia grayscale invert", build(h, H) {
    const c = () => cfg().cf;
    h.appendChild(H.card(`<div class="w12s-row-s">Preview — the whole screen, this included, is filtered</div><div class="ax-cf-prev"></div><div class="ax-cf-dots">${["#e81123", "#ff8c00", "#ffb900", "#107c10", "#00b294", "#0078d4", "#8764b8", "#e3008c"].map((x) => `<i style="background:${x}"></i>`).join("")}</div>`));
    h.appendChild(H.row({ ic: "filters", t: "Color filters", s: "Turn on to change how colors appear", ctl: H.toggle(() => c().on, (v) => set("cf.on", v), "Color filters") }));
    const list = el(`<div class="ax-radio-list" role="radiogroup" aria-label="Color filter"></div>`);
    const extra = el(`<div class="ax-s-panel"></div>`);
    const paintExtra = () => {
      extra.innerHTML = "";
      if (!CVD[c().type]) return;
      extra.appendChild(H.row({ t: "Intensity", ctl: H.slider(0, 100, 1, () => c().intensity, (v) => set("cf.intensity", v), { label: "Intensity" }) }));
      extra.appendChild(H.row({ t: "Color boost", ctl: H.slider(0, 100, 1, () => c().boost, (v) => set("cf.boost", v), { label: "Color boost" }) }));
    };
    FILTERS.forEach(([id, name]) => {
      const l = el(`<label><input type="radio" name="ax-cf-type" value="${id}"><span></span></label>`);
      l.querySelector("span").textContent = name; const i = l.querySelector("input"); i.checked = c().type === id;
      i.onchange = () => { if (i.checked) { set("cf.type", id); if (!c().on) set("cf.on", true); paintExtra(); } };
      list.appendChild(l);
    });
    const card = H.card(""); card.appendChild(list); h.appendChild(card); h.appendChild(extra); paintExtra();
    h.appendChild(H.row({ t: "Keyboard shortcut for color filters", s: A11y.isApple ? "Ctrl+Alt+C" : "Ctrl+Alt+C or Windows logo key + Ctrl + C", ctl: H.toggle(() => c().shortcut, (v) => set("cf.shortcut", v), "Keyboard shortcut for color filters") }));
  } });

  A11y.page("ax-contrast", { title: "Contrast themes", ic: "contrast", section: "vision", order: 7, desc: "Color themes for low vision, light sensitivity", toggle: "hc.on", keywords: "high contrast aquatic desert dusk night sky theme", build(h, H, redraw) {
    const c = () => cfg().hc;
    let sel = c().on ? c().theme : "none";
    const prev = el(`<div class="ax-hc-prev ax-keep" aria-hidden="true"><div class="ax-hp-side"></div><div class="ax-hp-main"></div></div>`);
    const paintPrev = () => {
      const p = sel === "none" ? null : palette(sel);
      const side = prev.firstElementChild, main = prev.lastElementChild;
      if (!p) { prev.style.display = "none"; return; } prev.style.display = "";
      side.style.cssText = `background:${p.bg};color:${p.fg};border-right:1px solid ${p.fg}`; main.style.cssText = `background:${p.bg};color:${p.fg}`;
      side.innerHTML = `<b>${esc(p.name)}</b><span style="color:${p.dis}">Inactive text</span>`;
      main.innerHTML = `<span>Text</span><span style="color:${p.link};text-decoration:underline">Hyperlink</span><span style="background:${p.selBg};color:${p.selFg};padding:2px 6px;align-self:flex-start">Selected text</span><span style="background:${p.btnBg};color:${p.btnFg};border:1px solid ${p.btnFg};padding:4px 12px;border-radius:4px;align-self:flex-start">Button</span>`;
    };
    // Thumbnails of every theme (click to preview; Apply makes it live)
    const thumbs = el(`<div class="ax-hc-thumbs" role="radiogroup" aria-label="Contrast themes"></div>`);
    const paintThumbs = () => thumbs.querySelectorAll("button").forEach((x) => { x.classList.toggle("sel", x.dataset.t === sel); x.setAttribute("aria-checked", String(x.dataset.t === sel)); });
    themeList().forEach(([id, name]) => {
      const p = palette(id);
      const t = el(`<button type="button" role="radio" class="ax-hc-thumb ax-keep" data-t="${esc(id)}" style="background:${p.bg};color:${p.fg};border-color:${p.fg}"><b></b><span style="color:${p.link};text-decoration:underline">Link</span><span style="background:${p.selBg};color:${p.selFg};padding:0 4px">Selected</span><span style="background:${p.btnBg};color:${p.btnFg};border:1px solid ${p.btnFg};padding:0 6px;border-radius:3px">Button</span></button>`);
      t.querySelector("b").textContent = name;
      t.onclick = () => { sel = id; dd.value = id; paintPrev(); paintThumbs(); edit.disabled = false; };
      thumbs.appendChild(t);
    });
    h.appendChild(thumbs);
    h.appendChild(prev); paintPrev();
    const opts = [["none", "None"]].concat(themeList());
    const dd = H.select(opts, () => sel, (v) => { sel = v; paintPrev(); paintThumbs(); edit.disabled = sel === "none"; }, "Contrast themes");
    const apply = H.button("Apply", () => { if (sel === "none") set("hc.on", false, { now: true }); else { set("hc.theme", sel); set("hc.on", true, { now: true }); } A11y.toast(sel === "none" ? "Contrast themes off" : "Applied " + palette(sel).name); }, true);
    const edit = H.button("Edit", () => openEditor()); edit.disabled = sel === "none";
    const r = H.row({ ic: "contrast", t: "Contrast themes", s: "Unique colors that make text and apps easier to see" }); r.querySelector(".w12s-row-ctl").append(dd, apply, edit);
    h.appendChild(r); paintThumbs();
    h.appendChild(H.note(`Press <kbd>Ctrl+Alt+H</kbd> (or <kbd>Left Alt+Left Shift+Print Screen</kbd>) to turn the last contrast theme on and off.`));
    const edBox = el(`<div class="ax-s-panel"></div>`); h.appendChild(edBox);
    function openEditor() {
      if (sel === "none") return;
      const base = palette(sel), work = {}; ROLES.forEach(([k]) => { work[k] = base[k]; });
      edBox.innerHTML = "";
      const card = H.card(`<div class="w12s-row-t">Edit contrast theme — ${esc(base.name)}</div><div class="w12s-row-s">Pick a color for each item. The number is its contrast with the background (4.5:1 or more is easy to read).</div><div class="ax-hc-grid"></div><div class="ax-line"><span>Theme name</span><input class="w12s-input ax-hc-name" maxlength="30"></div><div class="ax-hc-acts" style="display:flex;gap:8px;flex-wrap:wrap"></div>`);
      const grid = card.querySelector(".ax-hc-grid"), name = card.querySelector(".ax-hc-name");
      name.value = sel.startsWith("custom:") ? sel.slice(7) : base.name + " (custom)";
      const paintRatios = () => grid.querySelectorAll(".ax-hc-item").forEach((it) => {
        const k = it.dataset.k, rr = it.querySelector(".ax-ratio"); if (!rr) return;
        const against = k === "selFg" ? work.selBg : k === "btnFg" ? work.btnBg : k === "selBg" ? work.selFg : k === "btnBg" ? work.btnFg : work.bg;
        const x = ratio(work[k], against); rr.textContent = x.toFixed(1) + ":1"; rr.className = "ax-ratio " + (x >= 4.5 ? "ax-ok" : "ax-bad");
      });
      ROLES.forEach(([k, label]) => {
        const it = el(`<label class="ax-hc-item" data-k="${k}"><input type="color"><span></span>${k === "bg" ? "" : '<em class="ax-ratio"></em>'}</label>`);
        it.querySelector("span").textContent = label; const ci = it.querySelector("input"); ci.value = work[k];
        ci.oninput = () => { work[k] = ci.value; paintRatios(); };
        grid.appendChild(it);
      });
      paintRatios();
      const acts = card.querySelector(".ax-hc-acts");
      acts.append(H.button("Save and apply", () => {
        const n = (name.value || "").trim().slice(0, 30) || "Custom theme";
        const cs = Object.assign({}, c().customs); cs[n] = Object.assign({}, work); set("hc.customs", cs, { force: true });
        set("hc.theme", "custom:" + n); set("hc.on", true, { now: true }); A11y.toast("Saved and applied " + n); redraw();
      }, true), H.button("Cancel", () => { edBox.innerHTML = ""; }));
      if (sel.startsWith("custom:")) acts.append(H.button("Delete", () => { const cs = Object.assign({}, c().customs); delete cs[sel.slice(7)]; set("hc.customs", cs, { force: true }); if (c().theme === sel) { set("hc.theme", "aquatic"); if (c().on) set("hc.on", false, { now: true }); } redraw(); }));
      edBox.appendChild(card);
    }
  } });

  A11y.page("ax-captions", { title: "Captions", ic: "cc", section: "hearing", order: 1, desc: "Caption style for videos and Narrator captions", keywords: "subtitles captions", build(h, H) {
    h.appendChild(H.row({ ic: "cc", t: "Caption style", s: "Used by videos with captions in every app, and by Narrator's on-screen captions", ctl: H.select(Object.keys(CAPS).map((k) => [k, CAPS[k][0]]), () => cfg().cap.style, (v) => set("cap.style", v), "Caption style") }));
    const p = H.card(`<div class="w12s-row-s">Preview</div><div style="background:url(assets/wall3.jpg) center/cover;border-radius:6px;height:110px;display:flex;align-items:flex-end;justify-content:center;padding:10px" class="ax-keep"><span class="ax-cap-demo" style="padding:2px 8px;border-radius:2px">This is what captions look like.</span></div>`);
    const demo = p.querySelector(".ax-cap-demo"); const paint = () => { demo.style.cssText = "padding:2px 8px;border-radius:2px;" + (CAPS[cfg().cap.style] || CAPS.default)[1]; }; paint();
    h.appendChild(p);
    const off = on("change", (path) => { if (!demo.isConnected) return off(); if (path === "cap.style") paint(); });
  } });

  // =====================================================================
  //  WIRING
  // =====================================================================
  function applyMisc() { root.classList.toggle("ax-scrollbars", !!cfg().keys.scrollbars); }
  on("change", (path) => {
    if (path.startsWith("hc.")) applyContrast();
    else if (path.startsWith("cf.")) applyFilters();
    else if (path.startsWith("ptr.")) applyPointer();
    else if (path.startsWith("caret.")) applyCaret();
    else if (path.startsWith("cap.")) applyCaptions();
    else if (path === "keys.scrollbars") applyMisc();
  });
  function applyAll() { applyContrast(); applyFilters(); applyPointer(); applyCaret(); applyCaptions(); applyMisc(); }
  on("apply", applyAll);
  Object.assign(A11y.actions, { toggleContrast, toggleFilters });
  A11y.vision = { THEMES, ROLES, FILTERS, palette, ratio, lum, filterMatrix, caretRect, isField, applyAll, cursorSvg };
  A11y.caretRect = caretRect;
  applyAll();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyAll);
})();
