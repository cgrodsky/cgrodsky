/* =====================================================================
   Windows 11 Accessibility — Magnifier (js/a11y-magnifier.js)
   Load right after js/a11y-vision.js (early group).

   REAL: 100 %–1600 % magnification of everything inside <body> (all apps,
   taskbar, menus, notifications). Our own UI (toolbar, OSK, Narrator box)
   lives in #ax-layer outside <body> and stays at 100 %.
   - Full screen: <body> is transformed (translate + scale). The view follows
     the mouse pointer (proportional mapping, so every edge is reachable),
     keyboard focus and the text cursor. Touch: drag the four screen-edge pan
     strips (Windows behaviour), or drag the toolbar's pan pad.
   - Docked: a magnified live copy at the top, the real desktop shrunk below it.
   - Lens: a magnified live copy that moves with the pointer / finger.
     Lens / docked copies are DOM clones refreshed on change (≤ 4 per second);
     canvases and video frames are copied as pixels, iframes show a placeholder.
   - Invert colors (Ctrl+Alt+I), view cycling (Ctrl+Alt+M / F / D).
   Limitation: in full-screen view an app that positions a popup from raw
   clientX/Y (e.g. some context menus) shows it offset while zoomed.
   ===================================================================== */
(function () {
  "use strict";
  if (!window.A11y || A11y.magnifier) return;
  const { cfg, get, set, on, el, clamp, ui } = A11y;
  const body = () => document.body;
  const VIEWS = [["full", "Full screen"], ["dock", "Docked"], ["lens", "Lens"]];
  const ICO = {
    minus: '<path d="M5 12h14"/>', plus: '<path d="M5 12h14M12 5v14"/>', views: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>', collapse: '<path d="M6 15l6-6 6 6"/>', glass: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M8 10.5h5M10.5 8v5"/>',
    grip: '<circle cx="9" cy="7" r="1.1"/><circle cx="15" cy="7" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="9" cy="17" r="1.1"/><circle cx="15" cy="17" r="1.1"/>',
    pan: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;

  let s = 1, tx = 0, ty = 0;          // full-screen transform
  let focusPt = null;                 // last point of interest in viewport coords (unmagnified)
  let bar = null, mirror = null, stage = null, edges = null, raf = 0;
  const m = () => cfg().mag;
  const W = () => innerWidth, Hh = () => innerHeight;

  // ---------------------------------------------------------------- transform
  function applyTransform() {
    const b = body(); if (!b) return;
    const c = m();
    b.classList.toggle("ax-mag-on", !!c.on);
    b.classList.toggle("ax-mag-invert", !!(c.on && c.invert && c.view !== "lens"));
    b.classList.toggle("ax-mag-anim", !!c.smooth);
    if (!c.on) { b.style.removeProperty("transform"); b.style.removeProperty("transform-origin"); return; }
    if (c.view === "full") {
      s = c.zoom / 100;
      tx = clamp(tx, W() - W() * s, 0); ty = clamp(ty, Hh() - Hh() * s, 0);
      b.style.transformOrigin = "0 0";
      b.style.transform = s === 1 ? "none" : `translate(${tx}px, ${ty}px) scale(${s})`;
    } else if (c.view === "dock") {
      const dh = dockH(), k = (Hh() - dh) / Hh();
      b.style.transformOrigin = "0 0";
      b.style.transform = `translate(${(W() - W() * k) / 2}px, ${dh}px) scale(${k})`;
    } else { b.style.removeProperty("transform"); }
  }
  const dockH = () => Math.round(Hh() * 0.34);
  // Show content point (cx, cy) [unmagnified viewport coords] — proportional (mouse) or centered (focus).
  function lookAt(x, y, mode) {
    const c = m(); if (!c.on) return;
    focusPt = { x, y };
    if (c.view === "full") {
      s = c.zoom / 100;
      if (mode === "pointer") { tx = x * (1 - s); ty = y * (1 - s); }
      else {
        // Only move when the point is outside the middle 80 % of the view.
        const vx = x * s + tx, vy = y * s + ty, mx = W() * 0.1, my = Hh() * 0.1;
        if (vx < mx || vx > W() - mx) tx = W() / 2 - x * s;
        if (vy < my || vy > Hh() - my) ty = Hh() / 2 - y * s;
      }
      schedule();
    } else schedule();
  }
  // Viewport rect (possibly magnified) → unmagnified content point.
  function toContent(vx, vy) {
    const c = m(); if (!c.on) return { x: vx, y: vy };
    if (c.view === "full") return { x: (vx - tx) / s, y: (vy - ty) / s };
    if (c.view === "dock") { const dh = dockH(), k = (Hh() - dh) / Hh(); return { x: (vx - (W() - W() * k) / 2) / k, y: (vy - dh) / k }; }
    return { x: vx, y: vy };
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; applyTransform(); paintMirror(); }); }

  // ---------------------------------------------------------------- lens / dock live copy
  let cloneDirty = true, lastClone = 0, cloneT = 0, mo = null, shadow = null, styleSig = "";
  function ensureMirror() {
    const c = m();
    if (!c.on || c.view === "full") { if (mirror) { mirror.remove(); mirror = stage = shadow = null; styleSig = ""; } if (mo) { mo.disconnect(); mo = null; } return; }
    if (!mirror) {
      mirror = el(`<div class="ax-mirror" aria-hidden="true"><div class="ax-mirror-stage"></div></div>`);
      stage = mirror.firstElementChild; A11y.layer().prepend(mirror);
      mo = new MutationObserver(() => { cloneDirty = true; queueClone(); });
      mo.observe(body(), { subtree: true, childList: true, attributes: true, characterData: true });
      ["input", "scroll"].forEach((t) => window.addEventListener(t, markDirty, { capture: true, passive: true }));
    }
    mirror.className = "ax-mirror " + (c.view === "lens" ? "ax-lens" : "ax-dock") + (c.invert ? " ax-mag-invert" : "");
    cloneDirty = true; queueClone();
  }
  function markDirty() { if (mirror) { cloneDirty = true; queueClone(); } }
  function queueClone() {
    if (cloneT) return;
    const wait = Math.max(0, 250 - (Date.now() - lastClone));
    cloneT = setTimeout(() => { cloneT = 0; if (cloneDirty && mirror) { doClone(); schedule(); } }, wait);
  }
  function doClone() {
    cloneDirty = false; lastClone = Date.now();
    const src = body(), cl = src.cloneNode(true);
    cl.removeAttribute("style"); cl.classList.remove("ax-mag-on", "ax-mag-invert", "ax-mag-anim");
    const a = src.querySelectorAll("*"), b = cl.querySelectorAll("*"), fix = [];
    for (let i = 0; i < a.length && i < b.length; i++) {
      const o = a[i], n = b[i], tag = o.tagName;
      if (tag === "SCRIPT" || tag === "IFRAME" || tag === "VIDEO" || tag === "CANVAS" || tag === "OBJECT" || tag === "EMBED" || tag === "AUDIO") fix.push([o, n]);
      else if (tag === "INPUT") { if (o.type === "checkbox" || o.type === "radio") n.checked = o.checked; else if (o.type !== "file") n.setAttribute("value", o.value); }
      else if (tag === "TEXTAREA") n.textContent = o.value;
      else if (tag === "SELECT") { const si = o.selectedIndex; if (si >= 0 && n.options[si]) n.options[si].setAttribute("selected", ""); }
      if (o.scrollTop || o.scrollLeft) n.__axScroll = [o.scrollTop, o.scrollLeft];
    }
    fix.forEach(([o, n]) => {
      if (o.tagName === "SCRIPT") { n.remove(); return; }
      const r = o.getBoundingClientRect();
      if (o.tagName === "CANVAS" || o.tagName === "VIDEO") {
        const cv = document.createElement("canvas"); cv.width = o.width || o.videoWidth || r.width; cv.height = o.height || o.videoHeight || r.height;
        cv.className = o.className; cv.style.cssText = o.style.cssText;
        try { cv.getContext("2d").drawImage(o, 0, 0, cv.width, cv.height); } catch (_) {}
        n.replaceWith(cv); return;
      }
      const ph = document.createElement("div"); ph.className = o.className; ph.style.cssText = o.style.cssText;
      ph.style.background = ph.style.background || "#808080"; n.replaceWith(ph);
    });
    // The copy lives in a shadow root: its ids never shadow the real ones for
    // document.getElementById, and the page's stylesheets are cloned in once.
    if (!shadow) shadow = stage.attachShadow({ mode: "open" });
    const sheets = [...document.head.querySelectorAll('link[rel="stylesheet"], style')];
    const sig = sheets.length + ":" + sheets.reduce((n, x) => n + (x.textContent || x.href || "").length, 0);
    if (sig !== styleSig) {
      styleSig = sig;
      [...shadow.children].forEach((x) => { if (x.tagName === "LINK" || x.tagName === "STYLE") x.remove(); });
      sheets.forEach((x) => shadow.insertBefore(x.cloneNode(true), shadow.firstChild));
    }
    const h = document.documentElement.cloneNode(false);
    h.style.removeProperty("filter"); h.style.width = W() + "px"; h.style.height = Hh() + "px"; h.style.display = "block"; h.style.position = "relative";
    h.appendChild(cl);
    const prevH = [...shadow.children].find((x) => x.tagName === "HTML"); if (prevH) prevH.replaceWith(h); else shadow.appendChild(h);
    stage.style.width = W() + "px"; stage.style.height = Hh() + "px";
    cl.querySelectorAll("*").forEach((n) => { if (n.__axScroll) { n.scrollTop = n.__axScroll[0]; n.scrollLeft = n.__axScroll[1]; } });
  }
  function paintMirror() {
    const c = m(); if (!mirror || !stage) return;
    const z = c.zoom / 100, p = focusPt || { x: A11y.pointer.x, y: A11y.pointer.y };
    if (c.view === "lens") {
      const lw = Math.min(c.lensW, W() - 8), lh = Math.min(c.lensH, Hh() - 8);
      Object.assign(mirror.style, { width: lw + "px", height: lh + "px", left: clamp(p.x - lw / 2, 0, W() - lw) + "px", top: clamp(p.y - lh / 2, 0, Hh() - lh) + "px" });
      stage.style.transform = `translate(${clamp(lw / 2 - p.x * z, lw - W() * z, 0)}px, ${clamp(lh / 2 - p.y * z, lh - Hh() * z, 0)}px) scale(${z})`;
    } else {
      const dh = dockH();
      Object.assign(mirror.style, { width: "", left: "0", top: "0", height: dh + "px" });
      const ox = clamp(W() / 2 - p.x * z, W() - W() * z, 0), oy = clamp(dh / 2 - p.y * z, dh - Hh() * z, 0);
      stage.style.transform = `translate(${ox}px, ${oy}px) scale(${z})`;
    }
  }

  // ---------------------------------------------------------------- toolbar
  function buildBar() {
    if (bar) return bar;
    bar = el(`<div class="ax-magbar" role="toolbar" aria-label="Magnifier">
      <span class="ax-grip" title="Move" aria-hidden="true">${svg("grip")}</span>
      <button type="button" data-a="out" title="Zoom out (Ctrl+Alt+-)" aria-label="Zoom out">${svg("minus")}</button>
      <button type="button" class="ax-mag-pct" data-a="pct" title="Zoom level" aria-label="Zoom level"></button>
      <button type="button" data-a="in" title="Zoom in (Ctrl+Alt+=)" aria-label="Zoom in">${svg("plus")}</button>
      <button type="button" data-a="views" title="Views (Ctrl+Alt+M)" aria-label="Views" aria-haspopup="menu">${svg("views")}<span class="ax-mag-vn"></span></button>
      <button type="button" data-a="pan" class="ax-mag-pan" title="Drag to pan (touch)" aria-label="Pan">${svg("pan")}</button>
      <button type="button" data-a="settings" title="Settings" aria-label="Magnifier settings">${svg("gear")}</button>
      <button type="button" data-a="collapse" title="Collapse" aria-label="Collapse toolbar">${svg("collapse")}</button>
      <button type="button" data-a="close" title="Close (Ctrl+Alt+Esc)" aria-label="Close Magnifier">${svg("close")}</button>
      <button type="button" class="ax-mag-expand" data-a="expand" title="Magnifier" aria-label="Show Magnifier toolbar">${svg("glass")}</button>
    </div>`);
    A11y.layer().appendChild(bar);
    ui(bar, "pointerdown", (e) => { if (!e.target.closest("input")) e.preventDefault(); });
    // Buttons act on pointerup (reliable for taps on iPad); click only for keyboard activation.
    let downBtn = null;
    ui(bar, "pointerdown", (e) => { downBtn = e.target.closest("button"); });
    ui(bar, "pointerup", (e) => { const b = e.target.closest("button"); if (b && b === downBtn && !(drag && drag.moved)) run(b); downBtn = null; });
    ui(bar, "click", (e) => { if (e.detail === 0) { const b = e.target.closest("button"); if (b) run(b); } });
    function run(b) {
      const a = b.dataset.a;
      if (a === "in") zoomBy(1); else if (a === "out") zoomBy(-1);
      else if (a === "pct") menu(b, [[100, 150, 200, 300, 400, 800, 1600].map((z) => [z + "%", m().zoom === z, () => setZoom(z)])][0]);
      else if (a === "views") menu(b, VIEWS.map(([id, n]) => [n, m().view === id, () => setView(id)]).concat([["Invert colors", !!m().invert, () => set("mag.invert", !m().invert)]]));
      else if (a === "settings") A11y.openPage("ax-magnifier");
      else if (a === "collapse") { set("mag.collapsed", true); paintBar(); }
      else if (a === "expand") { set("mag.collapsed", false); paintBar(); }
      else if (a === "close") off();
    }
    // Drag the toolbar by its grip; drag the pan pad to move the magnified view (touch).
    let drag = null;
    ui(bar, "pointerdown", (e) => {
      const g = e.target.closest(".ax-grip, .ax-mag-pan, .ax-mag-expand"); if (!g) return;
      drag = { pan: g.classList.contains("ax-mag-pan"), x: e.clientX, y: e.clientY, l: bar.offsetLeft, t: bar.offsetTop, tx, ty, moved: false };
      try { g.setPointerCapture(e.pointerId); } catch (_) {}
    });
    ui(bar, "pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      if (drag.pan) { panBy(-dx * 3 - (tx - drag.tx), -dy * 3 - (ty - drag.ty)); }
      else { bar.style.transform = "none"; bar.style.left = clamp(drag.l + dx, 0, innerWidth - bar.offsetWidth) + "px"; bar.style.top = clamp(drag.t + dy, 0, innerHeight - bar.offsetHeight) + "px"; }
    });
    const up = (e) => { if (drag && drag.moved) e.__axStop = true; drag = null; };
    ui(bar, "pointerup", up); ui(bar, "pointercancel", up);
    return bar;
  }
  function paintBar() {
    if (!bar) return;
    const c = m();
    bar.querySelector(".ax-mag-pct").textContent = c.zoom + "%";
    bar.querySelector(".ax-mag-vn").textContent = (VIEWS.find((v) => v[0] === c.view) || VIEWS[0])[1];
    bar.classList.toggle("ax-collapsed", !!c.collapsed);
    bar.querySelector(".ax-mag-pan").style.display = c.view === "full" ? "" : "none";
  }
  let menuEl = null;
  function menu(anchor, items) {
    if (menuEl) { menuEl.remove(); menuEl = null; return; }
    menuEl = el(`<div class="ax-menu ax-ui" role="menu"></div>`);
    items.forEach(([label, checked, fn]) => {
      const b = el(`<button type="button" role="menuitemcheckbox"></button>`); b.textContent = label; b.setAttribute("aria-checked", String(!!checked));
      ui(b, "click", () => { menuEl.remove(); menuEl = null; fn(); }); menuEl.appendChild(b);
    });
    ui(menuEl, "pointerdown", (e) => e.preventDefault());
    A11y.layer().appendChild(menuEl);
    const r = anchor.getBoundingClientRect();
    menuEl.style.left = clamp(r.left, 4, innerWidth - menuEl.offsetWidth - 4) + "px"; menuEl.style.top = (r.bottom + 6) + "px";
    setTimeout(() => window.addEventListener("pointerdown", function h(e) { if (menuEl && !menuEl.contains(e.target)) { menuEl.remove(); menuEl = null; } window.removeEventListener("pointerdown", h, true); }, true), 0);
  }
  // Touch: four thin edge strips pan the full-screen view (Windows: "drag along the borders").
  function buildEdges() {
    if (edges) return;
    edges = el(`<div class="ax-mag-edges" aria-hidden="true"><i data-e="t"></i><i data-e="b"></i><i data-e="l"></i><i data-e="r"></i></div>`);
    A11y.layer().appendChild(edges);
    let d = null;
    ui(edges, "pointerdown", (e) => { const i = e.target.closest("i"); if (!i) return; e.preventDefault(); d = { x: e.clientX, y: e.clientY }; try { i.setPointerCapture(e.pointerId); } catch (_) {} });
    ui(edges, "pointermove", (e) => { if (!d) return; panBy(-(e.clientX - d.x) * 2.5, -(e.clientY - d.y) * 2.5); d = { x: e.clientX, y: e.clientY }; });
    const up = () => { d = null; }; ui(edges, "pointerup", up); ui(edges, "pointercancel", up);
  }
  function panBy(dx, dy) { if (m().view !== "full") return; tx += dx; ty += dy; schedule(); }

  // ---------------------------------------------------------------- follow pointer / focus / caret
  window.addEventListener("pointermove", (e) => {
    const c = m(); if (!c.on || !e.isTrusted) return;
    if (e.pointerType !== "mouse") { if (c.view === "lens" && e.buttons) { focusPt = { x: e.clientX, y: e.clientY }; schedule(); } return; }
    if (!c.mouse || (e.target.closest && e.target.closest(".ax-magbar, .ax-menu"))) return;
    if (c.view === "full") { s = c.zoom / 100; tx = e.clientX * (1 - s); ty = e.clientY * (1 - s); focusPt = toContent(e.clientX, e.clientY); schedule(); }
    else { focusPt = toContent(e.clientX, e.clientY); schedule(); }
  }, { capture: true, passive: true });
  window.addEventListener("pointerdown", (e) => { const c = m(); if (c.on && c.view === "lens" && e.isTrusted && e.pointerType !== "mouse" && !e.target.closest("#ax-layer")) { focusPt = { x: e.clientX, y: e.clientY }; schedule(); } }, { capture: true, passive: true });
  function followRect(r) { const a = toContent(r.left + Math.min(r.width, innerWidth / 3) / 2, r.top + Math.min(r.height, innerHeight / 3) / 2); lookAt(a.x, a.y, "focus"); }
  document.addEventListener("focusin", (e) => {
    const c = m(); if (!c.on || !c.focus || c.view === "lens") return;
    const t = e.target; if (!t || !t.getBoundingClientRect || t.closest("#ax-layer")) return;
    setTimeout(() => { if (document.activeElement === t) followRect(t.getBoundingClientRect()); }, 30);
  }, true);
  let caretT = 0;
  const followCaret = () => {
    const c = m(); if (!c.on || !c.caret || c.view === "lens") return;
    clearTimeout(caretT); caretT = setTimeout(() => { const r = A11y.caretRect && A11y.caretRect(); if (r) followRect({ left: r.left, top: r.top, width: 2, height: r.height }); }, 40);
  };
  window.addEventListener("input", followCaret, true); window.addEventListener("keyup", (e) => { if (/Arrow|Home|End|Page/.test(e.key)) followCaret(); }, true);
  // Narrator moves its cursor → follow it too.
  on("narratorFocus", (r) => { const c = m(); if (c.on && c.focus && c.view !== "lens" && r) followRect(r); });
  window.addEventListener("resize", () => { if (m().on) { cloneDirty = true; queueClone(); schedule(); } });

  // ---------------------------------------------------------------- actions
  const STEPS = [25, 50, 100, 150, 200, 400];
  function setZoom(z) { z = clamp(Math.round(z), 100, 1600); if (!m().on) set("mag.zoom", z); else { set("mag.zoom", z); A11y.emit("announce", "Magnifier " + z + " percent"); } }
  function zoomBy(dir) {
    const c = m();
    if (!c.on) { if (dir < 0) return; set("mag.on", true, { now: true }); if (c.zoom <= 100) set("mag.zoom", 100 + c.inc); A11y.toast("Magnifier on · " + m().zoom + "% · Ctrl+Alt+Esc to close"); return; }
    setZoom(c.zoom + dir * (c.inc || 100));
  }
  function setView(v) {
    if (v === "next") { const i = VIEWS.findIndex((x) => x[0] === m().view); v = VIEWS[(i + 1) % VIEWS.length][0]; }
    set("mag.view", v); A11y.toast("Magnifier: " + (VIEWS.find((x) => x[0] === v) || VIEWS[0])[1]);
  }
  function onOff(v) { set("mag.on", !!v, { now: true }); if (v && m().zoom <= 100) set("mag.zoom", 100 + (m().inc || 100)); }
  function off() { onOff(false); A11y.toast("Magnifier off"); }
  function apply() {
    const c = m();
    if (c.on) { buildBar(); bar.style.display = ""; paintBar(); if ("ontouchstart" in window || navigator.maxTouchPoints > 0) { buildEdges(); edges.style.display = c.view === "full" ? "" : "none"; } }
    else { if (bar) bar.style.display = "none"; if (edges) edges.style.display = "none"; if (menuEl) { menuEl.remove(); menuEl = null; } tx = ty = 0; focusPt = null; }
    ensureMirror(); applyTransform(); paintMirror();
  }
  on("change", (p) => { if (p.startsWith("mag.") && p !== "mag.collapsed") apply(); });
  Object.assign(A11y.actions, {
    magZoom: zoomBy, magOff: () => { if (m().on) off(); }, magView: setView,
    magInvert: () => { set("mag.invert", !m().invert); A11y.toast(m().invert ? "Inverted colors on" : "Inverted colors off"); },
    magToggle: () => { onOff(!m().on); A11y.toast(m().on ? "Magnifier on · " + m().zoom + "%" : "Magnifier off"); },
  });

  // ---------------------------------------------------------------- Settings page
  A11y.page("ax-magnifier", { title: "Magnifier", ic: "zoom", section: "vision", order: 5, desc: "Magnifier on/off, zoom level, views", toggle: "mag.on", onToggle: (v) => onOff(v), keywords: "zoom magnify lens bigger", build(h, H) {
    const c = m;
    h.appendChild(H.row({ ic: "zoom", t: "Magnifier", s: (A11y.isApple ? "" : "Windows logo key + Plus (+) · ") + "Ctrl+Alt+= to start and zoom in, Ctrl+Alt+Esc to close", ctl: H.toggle(() => c().on, onOff, "Magnifier") }));
    const lvl = el(`<span style="display:inline-flex;align-items:center;gap:6px"></span>`);
    const pct = el(`<b style="min-width:4em;text-align:center;font-variant-numeric:tabular-nums" aria-live="polite"></b>`);
    const paint = () => { pct.textContent = c().zoom + "%"; };
    lvl.append(H.button("−", () => setZoom(c().zoom - (c().inc || 100))), pct, H.button("+", () => setZoom(c().zoom + (c().inc || 100))));
    paint(); const off1 = on("change", (p) => { if (!pct.isConnected) return off1(); if (p === "mag.zoom") paint(); });
    h.appendChild(H.row({ t: "Zoom level", s: "100% to 1600%", ctl: lvl }));
    h.appendChild(H.row({ t: "Zoom increment", ctl: H.select(STEPS.map((x) => [x, x + "%"]), () => c().inc, (v) => set("mag.inc", +v), "Zoom increment") }));
    h.appendChild(H.row({ t: "Start Magnifier after sign-in", ctl: H.toggle(() => c().autostart, (v) => set("mag.autostart", v)) }));
    h.appendChild(H.row({ t: "Invert colors", s: "Ctrl+Alt+I", ctl: H.toggle(() => c().invert, (v) => set("mag.invert", v), "Invert colors") }));
    h.appendChild(H.row({ t: "Smooth movement", s: "Animate zoom and panning", ctl: H.toggle(() => c().smooth, (v) => set("mag.smooth", v)) }));
    h.appendChild(H.head("Magnifier view"));
    h.appendChild(H.row({ ic: "eye", t: "View", s: "Ctrl+Alt+M cycles views · Ctrl+Alt+F full screen · Ctrl+Alt+D docked", ctl: H.select(VIEWS, () => c().view, (v) => set("mag.view", v), "Magnifier view") }));
    h.appendChild(H.row({ t: "Lens size", expand: (pn) => {
      pn.appendChild(H.line("Width", H.slider(160, 900, 10, () => c().lensW, (v) => set("mag.lensW", v), { fmt: (v) => v + " px", label: "Lens width" })));
      pn.appendChild(H.line("Height", H.slider(100, 700, 10, () => c().lensH, (v) => set("mag.lensH", v), { fmt: (v) => v + " px", label: "Lens height" })));
    } }));
    h.appendChild(H.row({ t: "Have Magnifier follow", open: true, expand: (pn) => {
      pn.appendChild(H.check("Mouse pointer", () => c().mouse, (v) => set("mag.mouse", v)));
      pn.appendChild(H.check("Keyboard focus (and Narrator's cursor)", () => c().focus, (v) => set("mag.focus", v)));
      pn.appendChild(H.check("Text cursor", () => c().caret, (v) => set("mag.caret", v)));
    } }));
    h.appendChild(H.note("On a touch screen, drag along any edge of the screen (or the ✥ pad in the toolbar) to move around while zoomed in."));
  } });

  // Magnifier only comes back after a reload when "Start Magnifier after sign-in" is on.
  if (m().on && !m().autostart) { cfg().mag.on = false; A11y.save(); }
  A11y.on("shell", (n) => { if (n.classList && n.classList.contains("taskbar") && m().autostart && !m().on) onOff(true); });
  A11y.on("apply", apply);
  A11y.magnifier = { zoomBy, setZoom, setView, onOff, toContent, lookAt, state: () => ({ s, tx, ty, view: m().view, on: m().on }) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();
