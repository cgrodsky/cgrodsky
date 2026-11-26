/* Desktop surface extras: on-wallpaper gadgets, sticky notes, and desktop View
   options (icon size / auto arrange / align to grid). Everything here lives in a
   SEPARATE layer that sits inside the .desktop element (so it stays behind app
   windows but above the wallpaper) and never touches the real desktop icons that
   wm.js / personalize.js render. Persisted under State.data.appData.*.
   New file — does not edit wm.js / personalize.js / index.html. */
(function () {
  "use strict";

  // ---- tiny helpers (house style) ----
  const el = (html) => { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = () => (window.State && State.data) || {};
  const screenEl = () => document.getElementById("screen");
  const desktopEl = () => { const d = document.querySelectorAll(".desktop"); return d.length ? d[d.length - 1] : null; };
  const uid = (p) => (p || "g") + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- persistence ----
  function appData() { const d = S(); if (!d.appData) d.appData = {}; return d.appData; }
  function save() { try { if (window.State) State.save(); } catch (e) {} }
  function gadgets() { const a = appData(); if (!Array.isArray(a.deskGadgets)) a.deskGadgets = []; return a.deskGadgets; }
  function stickies() { const a = appData(); if (!Array.isArray(a.deskStickies)) a.deskStickies = []; return a.deskStickies; }
  function deskView() {
    const a = appData();
    if (!a.deskView || typeof a.deskView !== "object") a.deskView = { autoArrange: true, alignGrid: true };
    if (typeof a.deskView.autoArrange !== "boolean") a.deskView.autoArrange = true;
    if (typeof a.deskView.alignGrid !== "boolean") a.deskView.alignGrid = true;
    return a.deskView;
  }

  // ======================================================================
  //  Layer bootstrap — (re)mounts whenever a fresh .desktop is built.
  // ======================================================================
  let layer = null;   // .dx-layer : holds gadgets + stickies
  let fab = null;     // .dx-fab   : small "+" affordance (fallback add)

  function mount(desktop) {
    if (!desktop) return;
    if (desktop.querySelector(":scope > .dx-layer")) { layer = desktop.querySelector(":scope > .dx-layer"); fab = desktop.querySelector(":scope > .dx-fab"); applyIconView(); return; }
    // Layer goes FIRST so the real desktop icons paint above it and keep their
    // clicks (the icons container is pointer-events:none, so gadgets placed on
    // empty wallpaper still receive pointer events).
    layer = el(`<div class="dx-layer gbs-skip" aria-hidden="false"></div>`);
    desktop.insertBefore(layer, desktop.firstChild);

    fab = el(`<button class="dx-fab gbs-skip" type="button" title="Add gadget or sticky note" aria-label="Add desktop gadget or sticky note">＋</button>`);
    fab.addEventListener("click", (e) => { e.stopPropagation(); openAddMenu(fab.getBoundingClientRect(), true); });
    desktop.appendChild(fab);

    renderAll();
    applyIconView();
    syncVisibility();
  }

  function renderAll() {
    if (!layer) return;
    layer.innerHTML = "";
    gadgets().forEach((g) => layer.appendChild(buildGadget(g)));
    stickies().forEach((n) => layer.appendChild(buildSticky(n)));
  }

  // keep gadgets/notes inside the viewport
  function reclampAll() {
    if (!layer) return;
    layer.querySelectorAll(".dx-item").forEach((node) => {
      const w = node.offsetWidth, h = node.offsetHeight;
      let x = parseFloat(node.style.left) || 0, y = parseFloat(node.style.top) || 0;
      x = clamp(x, 6, Math.max(6, window.innerWidth - w - 6));
      y = clamp(y, 6, Math.max(6, window.innerHeight - h - 70));
      node.style.left = x + "px"; node.style.top = y + "px";
      const rec = node._rec; if (rec) { rec.x = x; rec.y = y; }
    });
  }

  // ======================================================================
  //  Shared drag (mouse + touch)
  // ======================================================================
  function makeDraggable(node, handle, rec, onEnd) {
    let sx = 0, sy = 0, ox = 0, oy = 0, moving = false;
    const down = (e) => {
      if (e.type === "mousedown" && e.button !== 0) return;
      const t = e.target;
      if (t.closest(".dx-btn") || t.closest(".dx-grip") || t.closest("textarea") || t.closest("[contenteditable]")) {
        if (!t.closest(".dx-head")) return; // let controls / editing work
      }
      const p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY;
      ox = parseFloat(node.style.left) || 0; oy = parseFloat(node.style.top) || 0;
      moving = false;
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      window.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
    };
    const move = (e) => {
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if (!moving && Math.hypot(dx, dy) < 4) return;
      moving = true;
      if (e.cancelable) e.preventDefault();
      node.classList.add("dx-dragging");
      const w = node.offsetWidth, h = node.offsetHeight;
      const nx = clamp(ox + dx, 6, Math.max(6, window.innerWidth - w - 6));
      const ny = clamp(oy + dy, 6, Math.max(6, window.innerHeight - h - 70));
      node.style.left = nx + "px"; node.style.top = ny + "px";
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up);
      node.classList.remove("dx-dragging");
      if (moving) { rec.x = parseFloat(node.style.left) || 0; rec.y = parseFloat(node.style.top) || 0; save(); if (onEnd) onEnd(); }
    };
    handle.addEventListener("mousedown", down);
    handle.addEventListener("touchstart", down, { passive: true });
  }

  function placeDefault(rec, w, h) {
    if (typeof rec.x === "number" && typeof rec.y === "number") return;
    // Cascade in the central band: clear of the desktop icon column (far left)
    // and of wm.js's app-group boxes, which dock to the right edge (~right:24).
    const n = layer ? layer.children.length : 0;
    const baseX = Math.max(150, Math.min(window.innerWidth * 0.32, window.innerWidth - w - 360));
    rec.x = clamp(baseX + (n % 3) * 26, 20, Math.max(20, window.innerWidth - w - 10));
    rec.y = clamp(32 + n * 30, 20, Math.max(20, window.innerHeight - h - 90));
  }

  // ======================================================================
  //  GADGETS
  // ======================================================================
  const GADGET_META = {
    clock: { w: 190, h: 196, name: "Clock" },
    weather: { w: 210, h: 150, name: "Weather" },
    system: { w: 210, h: 150, name: "System" },
    notes: { w: 200, h: 170, name: "Notes" },
  };

  function buildGadget(g) {
    const meta = GADGET_META[g.type] || GADGET_META.clock;
    placeDefault(g, meta.w, meta.h);
    const node = el(`<div class="dx-item dx-gadget dx-g-${esc(g.type)} gbs-skip" role="group" aria-label="${esc(meta.name)} gadget"></div>`);
    node._rec = g;
    node.style.left = g.x + "px"; node.style.top = g.y + "px";
    node.style.width = (g.w || meta.w) + "px";
    const head = el(`<div class="dx-head"><span class="dx-grip" aria-hidden="true">⠿</span><span class="dx-title">${esc(meta.name)}</span><button class="dx-btn dx-close" type="button" title="Remove" aria-label="Remove ${esc(meta.name)} gadget">×</button></div>`);
    const bodyWrap = el(`<div class="dx-body"></div>`);
    node.appendChild(head); node.appendChild(bodyWrap);
    head.querySelector(".dx-close").addEventListener("click", (e) => { e.stopPropagation(); removeGadget(g.id); });

    let stop = null;
    if (g.type === "clock") stop = mountClock(bodyWrap);
    else if (g.type === "weather") stop = mountWeather(bodyWrap);
    else if (g.type === "system") stop = mountSystem(bodyWrap);
    else if (g.type === "notes") stop = mountNotes(bodyWrap, g);
    node._stop = stop;

    makeDraggable(node, head, g);
    return node;
  }

  function addGadget(type) {
    if (!GADGET_META[type]) return;
    const g = { id: uid("gad"), type: type };
    gadgets().push(g); save();
    if (layer) { const node = buildGadget(g); layer.appendChild(node); flashIn(node); }
  }
  function removeGadget(id) {
    const arr = gadgets(); const i = arr.findIndex((g) => g.id === id);
    if (i < 0) return;
    arr.splice(i, 1); save();
    if (layer) { const node = [...layer.querySelectorAll(".dx-gadget")].find((n) => n._rec && n._rec.id === id); if (node) { if (node._stop) node._stop(); node.remove(); } }
  }

  // ---- Clock (analog + digital) ----
  function mountClock(body) {
    body.innerHTML =
      `<svg class="dx-clock" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" class="dx-cl-face"/>
        <circle cx="50" cy="50" r="46" class="dx-cl-ring"/>
        ${Array.from({ length: 12 }).map((_, i) => { const a = i * 30 * Math.PI / 180; const r1 = 40, r2 = i % 3 === 0 ? 33 : 37; return `<line x1="${50 + r1 * Math.sin(a)}" y1="${50 - r1 * Math.cos(a)}" x2="${50 + r2 * Math.sin(a)}" y2="${50 - r2 * Math.cos(a)}" class="dx-cl-tick${i % 3 === 0 ? " maj" : ""}"/>`; }).join("")}
        <line class="dx-cl-h" x1="50" y1="54" x2="50" y2="30"/>
        <line class="dx-cl-m" x1="50" y1="56" x2="50" y2="20"/>
        <line class="dx-cl-s" x1="50" y1="58" x2="50" y2="16"/>
        <circle cx="50" cy="50" r="2.6" class="dx-cl-pin"/>
      </svg>
      <div class="dx-cl-digi"><span class="dx-cl-time"></span><span class="dx-cl-date"></span></div>`;
    const hH = body.querySelector(".dx-cl-h"), mH = body.querySelector(".dx-cl-m"), sH = body.querySelector(".dx-cl-s");
    const tEl = body.querySelector(".dx-cl-time"), dEl = body.querySelector(".dx-cl-date");
    const tick = () => {
      if (hidden()) return;
      const d = (window.State && State.now) ? State.now() : new Date();
      const s = d.getSeconds(), m = d.getMinutes(), h = d.getHours();
      sH.setAttribute("transform", `rotate(${s * 6} 50 50)`);
      mH.setAttribute("transform", `rotate(${m * 6 + s * 0.1} 50 50)`);
      hH.setAttribute("transform", `rotate(${(h % 12) * 30 + m * 0.5} 50 50)`);
      try { tEl.textContent = State.formatClock(); dEl.textContent = State.formatDate(); }
      catch (e) { tEl.textContent = d.toLocaleTimeString(); dEl.textContent = d.toLocaleDateString(); }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }

  // ---- Weather (reuses WM.weather / WM.weatherIcon) ----
  function mountWeather(body) {
    const render = () => {
      let w = null;
      try { w = window.WM && WM.weather && WM.weather(); } catch (e) { w = null; }
      if (!w || typeof w.temp !== "number") {
        body.innerHTML = `<div class="dx-wx-empty">Weather unavailable</div>`;
        return;
      }
      let ico = "";
      try { ico = (window.WM && WM.weatherIcon) ? WM.weatherIcon(w.icon) : ""; } catch (e) { ico = ""; }
      const place = esc(w.city || S().region || "Your location");
      body.innerHTML =
        `<div class="dx-wx-main"><span class="dx-wx-ico">${ico}</span><span class="dx-wx-temp">${Math.round(w.temp)}&deg;</span></div>
         <div class="dx-wx-cond">${esc(w.label || "")}</div>
         <div class="dx-wx-meta"><span class="dx-wx-place">${place}</span>${(typeof w.hi === "number" && typeof w.lo === "number") ? `<span class="dx-wx-hilo">H:${Math.round(w.hi)}&deg; L:${Math.round(w.lo)}&deg;</span>` : ""}</div>`;
    };
    render();
    const onWx = () => { if (!hidden()) render(); };
    window.addEventListener("weather-change", onWx);
    const iv = setInterval(onWx, 60000);
    return () => { window.removeEventListener("weather-change", onWx); clearInterval(iv); };
  }

  // ---- System meter (SIMULATED cpu / ram gauges) ----
  function mountSystem(body) {
    body.innerHTML =
      `<div class="dx-sys-row">
        ${gaugeSvg("cpu", "CPU")}
        ${gaugeSvg("ram", "RAM")}
      </div>`;
    let cpu = 24, ram = 48;
    const set = (key, val) => {
      const arc = body.querySelector(`.dx-g-arc[data-k="${key}"]`);
      const lbl = body.querySelector(`.dx-g-val[data-k="${key}"]`);
      if (!arc || !lbl) return;
      const C = 2 * Math.PI * 30; // r=30
      arc.style.strokeDasharray = C.toFixed(1);
      arc.style.strokeDashoffset = (C * (1 - val / 100)).toFixed(1);
      arc.classList.toggle("hot", val > 82);
      lbl.textContent = Math.round(val) + "%";
    };
    const step = () => {
      if (hidden()) return;
      cpu = clamp(cpu + (Math.random() - 0.45) * 22, 3, 99);
      ram = clamp(ram + (Math.random() - 0.5) * 7, 22, 93);
      set("cpu", cpu); set("ram", ram);
    };
    set("cpu", cpu); set("ram", ram);
    const iv = setInterval(step, 900);
    return () => clearInterval(iv);
  }
  function gaugeSvg(key, label) {
    return `<div class="dx-gauge">
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r="30" class="dx-g-track"/>
        <circle cx="36" cy="36" r="30" class="dx-g-arc" data-k="${key}" transform="rotate(-90 36 36)"/>
        <text x="36" y="40" class="dx-g-num"><tspan class="dx-g-val" data-k="${key}">0%</tspan></text>
      </svg>
      <div class="dx-g-lbl">${esc(label)}</div>
    </div>`;
  }

  // ---- Notes gadget (single scratch note, distinct from sticky notes) ----
  function mountNotes(body, g) {
    body.innerHTML = `<textarea class="dx-notes-ta" placeholder="Quick note…" aria-label="Notes gadget text"></textarea>`;
    const ta = body.querySelector("textarea");
    ta.value = g.text || "";
    let t = null;
    ta.addEventListener("input", () => { g.text = ta.value; clearTimeout(t); t = setTimeout(save, 400); });
    ta.addEventListener("blur", () => { g.text = ta.value; save(); });
    return () => {};
  }

  // ======================================================================
  //  STICKY NOTES (colorful, editable, draggable, resizable)
  // ======================================================================
  const STICKY_COLORS = ["yellow", "pink", "blue", "green"];

  function buildSticky(n) {
    if (!STICKY_COLORS.includes(n.color)) n.color = "yellow";
    placeDefault(n, 190, 180);
    const w = clamp(n.w || 190, 140, 460), h = clamp(n.h || 180, 120, 460);
    const node = el(`<div class="dx-item dx-sticky dx-sk-${esc(n.color)} gbs-skip" role="group" aria-label="Sticky note"></div>`);
    node._rec = n;
    node.style.left = n.x + "px"; node.style.top = n.y + "px";
    node.style.width = w + "px"; node.style.height = h + "px";
    node.innerHTML =
      `<div class="dx-head dx-sk-head">
         <span class="dx-grip" aria-hidden="true">⠿</span>
         <div class="dx-sk-colors">${STICKY_COLORS.map((c) => `<button class="dx-sk-dot dx-dot-${c}${c === n.color ? " on" : ""}" type="button" data-c="${c}" title="${c}" aria-label="${c} note"></button>`).join("")}</div>
         <button class="dx-btn dx-close" type="button" title="Delete note" aria-label="Delete sticky note">×</button>
       </div>
       <textarea class="dx-sk-ta" placeholder="Note…" aria-label="Sticky note text"></textarea>
       <span class="dx-resize" aria-hidden="true"></span>`;
    const ta = node.querySelector(".dx-sk-ta");
    ta.value = n.text || "";
    let t = null;
    ta.addEventListener("input", () => { n.text = ta.value; clearTimeout(t); t = setTimeout(save, 400); });
    ta.addEventListener("blur", () => { n.text = ta.value; save(); });
    node.querySelector(".dx-close").addEventListener("click", (e) => { e.stopPropagation(); removeSticky(n.id); });
    node.querySelectorAll(".dx-sk-dot").forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      n.color = b.dataset.c; save();
      node.classList.remove(...STICKY_COLORS.map((c) => "dx-sk-" + c));
      node.classList.add("dx-sk-" + n.color);
      node.querySelectorAll(".dx-sk-dot").forEach((d) => d.classList.toggle("on", d.dataset.c === n.color));
    }));
    makeDraggable(node, node.querySelector(".dx-sk-head"), n);
    makeResizable(node, node.querySelector(".dx-resize"), n);
    return node;
  }

  function makeResizable(node, grip, rec) {
    let sx = 0, sy = 0, ow = 0, oh = 0;
    const down = (e) => {
      e.stopPropagation(); if (e.cancelable) e.preventDefault();
      const p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY; ow = node.offsetWidth; oh = node.offsetHeight;
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      window.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
    };
    const move = (e) => {
      const p = e.touches ? e.touches[0] : e;
      if (e.cancelable) e.preventDefault();
      const w = clamp(ow + (p.clientX - sx), 140, 460), h = clamp(oh + (p.clientY - sy), 120, 460);
      node.style.width = w + "px"; node.style.height = h + "px";
    };
    const up = () => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up);
      rec.w = node.offsetWidth; rec.h = node.offsetHeight; save();
    };
    grip.addEventListener("mousedown", down);
    grip.addEventListener("touchstart", down, { passive: false });
  }

  function addSticky(color) {
    const n = { id: uid("stk"), color: STICKY_COLORS.includes(color) ? color : "yellow", text: "", w: 190, h: 180 };
    stickies().push(n); save();
    if (layer) { const node = buildSticky(n); layer.appendChild(node); flashIn(node); setTimeout(() => { const ta = node.querySelector(".dx-sk-ta"); if (ta) ta.focus(); }, 30); }
  }
  function removeSticky(id) {
    const arr = stickies(); const i = arr.findIndex((n) => n.id === id);
    if (i < 0) return;
    arr.splice(i, 1); save();
    if (layer) { const node = [...layer.querySelectorAll(".dx-sticky")].find((n) => n._rec && n._rec.id === id); if (node) node.remove(); }
  }

  function flashIn(node) { node.classList.add("dx-in"); setTimeout(() => node.classList.remove("dx-in"), 260); }

  // ======================================================================
  //  DESKTOP VIEW (icon size / auto arrange / align to grid)
  // ======================================================================
  function applyIconView() {
    const desktop = desktopEl(); if (!desktop) return;
    const wrap = desktop.querySelector(".desktop-icons"); if (!wrap) return;
    // icon size reuses wm.js's own classes + persisted key so there's one source of truth
    const sz = (S().desktop && S().desktop.iconSize) || "md";
    desktop.classList.remove("icons-sm", "icons-md", "icons-lg");
    desktop.classList.add("icons-" + sz);
    const v = deskView();
    wrap.classList.toggle("dx-loose", !v.autoArrange);     // auto-arrange off = looser spread
    wrap.classList.toggle("dx-align-grid", !!v.alignGrid); // uniform grid cells
  }
  function setIconSize(sz) {
    const d = S(); if (!d.desktop) d.desktop = {}; d.desktop.iconSize = sz; save();
    applyIconView();
  }
  function setAutoArrange(on) { deskView().autoArrange = !!on; save(); applyIconView(); }
  function setAlignGrid(on) { deskView().alignGrid = !!on; save(); applyIconView(); }

  // ======================================================================
  //  MENUS
  // ======================================================================
  function closeMyMenus() { document.querySelectorAll(".dx-menu").forEach((m) => m.remove()); }

  // The gadget rows use the OS's real colourful icons (not emoji, which render flat/monochrome).
  function gIcon(key, name) { return `<span class="dx-gic">${window.Icon ? Icon.mini(key, name) : ""}</span>`; }
  const GADGET_ICON = { clock: "clock", weather: "weather", system: "taskmanager", notes: "stickynotes" };

  // Standalone popup (used by the + affordance). Right-click uses the injected items.
  function openAddMenu(anchorRect, flip) {
    closeMyMenus();
    const menu = el(`<div class="dx-menu dx-menu-pop gbs-skip" role="menu"></div>`);
    const item = (label, fn) => { const b = el(`<button type="button" role="menuitem">${label}</button>`); b.onclick = () => { closeMyMenus(); fn(); }; menu.appendChild(b); };
    menu.appendChild(el(`<div class="dx-menu-h">Add gadget</div>`));
    item(gIcon("clock", "Clock") + "<span>Clock</span>", () => addGadget("clock"));
    item(gIcon("weather", "Weather") + "<span>Weather</span>", () => addGadget("weather"));
    item(gIcon("taskmanager", "System meter") + "<span>System meter</span>", () => addGadget("system"));
    item(gIcon("stickynotes", "Notes") + "<span>Notes</span>", () => addGadget("notes"));
    menu.appendChild(el(`<div class="dx-menu-sep"></div>`));
    menu.appendChild(el(`<div class="dx-menu-h">Sticky note</div>`));
    const row = el(`<div class="dx-menu-colors"></div>`);
    STICKY_COLORS.forEach((c) => { const b = el(`<button type="button" class="dx-sk-dot dx-dot-${c}" title="New ${c} note" aria-label="New ${c} sticky note"></button>`); b.onclick = () => { closeMyMenus(); addSticky(c); }; row.appendChild(b); });
    menu.appendChild(row);
    screenEl().appendChild(menu);
    let left = anchorRect.left, top = anchorRect.top - menu.offsetHeight - 6;
    if (flip) { left = clamp(anchorRect.left, 8, window.innerWidth - menu.offsetWidth - 8); }
    if (top < 8) top = anchorRect.bottom + 6;
    menu.style.left = clamp(left, 8, window.innerWidth - menu.offsetWidth - 8) + "px";
    menu.style.top = clamp(top, 8, window.innerHeight - menu.offsetHeight - 8) + "px";
    setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!menu.contains(ev.target)) { closeMyMenus(); document.removeEventListener("mousedown", h); } }), 0);
  }

  // --- submenu builder shared with the right-click injection ---
  function openSubmenu(anchor, items) {
    document.querySelectorAll(".dx-submenu").forEach((m) => m.remove());
    document.querySelectorAll(".desk-submenu:not(.dx-submenu)").forEach((m) => m.remove());
    const sub = el(`<div class="desk-ctx desk-submenu dx-submenu gbs-skip" role="menu"></div>`);
    items.forEach((it) => {
      if (it === "-") { sub.appendChild(el(`<div class="dctx-sep"></div>`)); return; }
      const [label, fn, checked] = it;
      const b = el(`<button type="button">${checked ? '<span class="dx-check">✓</span>' : '<span class="dx-check"></span>'}${label}</button>`);
      b.onclick = () => { document.querySelectorAll(".desk-ctx").forEach((m) => m.remove()); fn(); };
      sub.appendChild(b);
    });
    screenEl().appendChild(sub);
    const r = anchor.getBoundingClientRect();
    let left = r.right + 2; if (left + 200 > window.innerWidth) left = r.left - 202;
    sub.style.left = Math.max(6, left) + "px";
    sub.style.top = clamp(r.top, 6, window.innerHeight - sub.offsetHeight - 10) + "px";
  }

  // Inject our items into wm.js's own desktop right-click menu.
  function injectIntoDeskMenu(menu) {
    if (menu.querySelector(".dx-injected")) return;
    const iconRow = (icon, label, arrow) => `<span class="dctx-ic">${icon}</span><span class="dctx-lbl">${label}</span>${arrow ? '<span class="dctx-arrow">&rsaquo;</span>' : ""}`;
    const ICN = {
      gadget: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="8" height="8" rx="1.5"/><circle cx="17.5" cy="7" r="3.5"/><rect x="4" y="14" width="16" height="6" rx="2"/></svg>`,
      note: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4"/><path d="M8 11h7M8 15h5"/></svg>`,
      view: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
    };
    const mk = (html, fn, arrow) => { const b = el(`<button type="button" class="dx-injected${arrow ? " has-sub" : ""}">${html}</button>`); if (arrow) { b.onmouseenter = fn; } else if (fn) { b.onclick = () => { menu.remove(); document.querySelectorAll(".desk-ctx,.dx-submenu").forEach((m) => m.remove()); fn(); }; b.addEventListener("mouseenter", () => document.querySelectorAll(".dx-submenu,.desk-submenu").forEach((m) => m.remove())); } return b; };

    const gadgetBtn = mk(iconRow(ICN.gadget, "Add gadget", true), () => openSubmenu(gadgetBtn, [
      [gIcon("clock", "Clock") + "Clock", () => addGadget("clock")],
      [gIcon("weather", "Weather") + "Weather", () => addGadget("weather")],
      [gIcon("taskmanager", "System meter") + "System meter", () => addGadget("system")],
      [gIcon("stickynotes", "Notes") + "Notes", () => addGadget("notes")],
    ]), true);
    const noteBtn = mk(iconRow(ICN.note, "New sticky note", true), () => openSubmenu(noteBtn,
      STICKY_COLORS.map((c) => [c.charAt(0).toUpperCase() + c.slice(1), () => addSticky(c)])
    ), true);
    const viewBtn = mk(iconRow(ICN.view, "Desktop view", true), () => {
      const v = deskView(); const sz = (S().desktop && S().desktop.iconSize) || "md";
      openSubmenu(viewBtn, [
        ["Small icons", () => setIconSize("sm"), sz === "sm"],
        ["Medium icons", () => setIconSize("md"), sz === "md"],
        ["Large icons", () => setIconSize("lg"), sz === "lg"],
        "-",
        ["Auto arrange icons", () => setAutoArrange(!v.autoArrange), v.autoArrange],
        ["Align icons to grid", () => setAlignGrid(!v.alignGrid), v.alignGrid],
      ]);
    }, true);

    // Insert just before wm.js's separator (above Personalize), else at the top.
    const sep = menu.querySelector(".dctx-sep");
    const frag = document.createDocumentFragment();
    frag.appendChild(gadgetBtn); frag.appendChild(noteBtn); frag.appendChild(viewBtn);
    frag.appendChild(el(`<div class="dctx-sep dx-injected"></div>`));
    if (sep) menu.insertBefore(frag, sep); else menu.appendChild(frag);
  }

  // ======================================================================
  //  Visibility (hide behind lock screen / boot / Task View)
  // ======================================================================
  function overlayUp() { return !!document.querySelector(".lock-screen, .boot-layer, .wx-tv"); }
  function hidden() { return !layer || layer.classList.contains("dx-hidden"); }
  function syncVisibility() {
    const up = overlayUp();
    if (layer) layer.classList.toggle("dx-hidden", up);
    if (fab) fab.classList.toggle("dx-hidden", up);
    if (up) closeMyMenus();
  }

  // ======================================================================
  //  Observe the shell: mount on new desktop, inject into menus, hide on overlays.
  // ======================================================================
  let rafQ = 0;
  function queueSync() { if (rafQ) return; rafQ = requestAnimationFrame(() => { rafQ = 0; syncVisibility(); }); }

  function scan(nodes) {
    nodes.forEach((node) => {
      if (node.nodeType !== 1) return;
      if (node.classList && node.classList.contains("desktop")) mount(node);
      else if (node.querySelector && node.querySelector(".desktop")) mount(desktopEl());
      if (node.classList && node.classList.contains("desk-rightclick")) injectIntoDeskMenu(node);
      else if (node.querySelector && node.querySelector(".desk-rightclick")) { const m = node.querySelector(".desk-rightclick"); if (m) injectIntoDeskMenu(m); }
    });
  }

  function startObserver() {
    const root = screenEl(); if (!root) { setTimeout(startObserver, 200); return; }
    const mo = new MutationObserver((muts) => {
      let touchOverlay = false;
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length) scan(m.addedNodes);
        if (m.removedNodes && m.removedNodes.length) touchOverlay = true;
        if (m.addedNodes && m.addedNodes.length) touchOverlay = true;
      }
      if (touchOverlay) queueSync();
    });
    mo.observe(root, { childList: true, subtree: true });
    // If the desktop already exists (script ran after buildDesktop), mount now.
    const d = desktopEl(); if (d) mount(d);
    syncVisibility();
  }

  window.addEventListener("resize", () => { reclampAll(); });

  // Expose a tiny API (handy for other surfaces / tests).
  window.DesktopX = {
    addGadget, removeGadget, addSticky, removeSticky,
    setIconSize, setAutoArrange, setAlignGrid,
    refresh: () => { renderAll(); applyIconView(); },
    _gadgets: gadgets, _stickies: stickies,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startObserver);
  else startObserver();
})();
