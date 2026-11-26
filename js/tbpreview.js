/* Taskbar thumbnail previews + taskbar empty-area context menu ("Windows 12").
   Adds two taskbar features on top of the existing shell (js/wm.js / js/winx.js),
   without touching them — everything hangs off the public window.WM API and DOM:

   1) Hovering a taskbar app button (.tb-btn) pops a preview above it with one card
      per open window of that app: the window title, an ✕ to close it, and a scaled
      live snapshot of that window's .win-body. Plain clones don't carry <canvas>
      pixels, so each canvas is re-drawn into a fresh canvas (falling back to the app
      icon tile when the body can't be snapshotted — e.g. a minimized window). Clicking
      a card focuses that window. The popup lingers briefly on mouse-leave so you can
      slide into it. On touch, a long-press on the button shows it.

   2) Right-clicking the empty taskbar area opens a context menu: Cascade windows,
      Show windows stacked, Show windows side by side, Show the desktop (minimise all /
      restore toggle), Task Manager, Taskbar settings. The arrange modes reposition the
      non-minimised, non-kiosk windows over the work area above the taskbar.

   Public: window.TbPreview = { arrange(mode), showFor(btn) }. */
(function () {
  "use strict";
  if (window.TbPreview) return;

  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const WM = () => window.WM;
  const taskbarEl = () => (window.WM && WM().taskbarEl && WM().taskbarEl()) || document.querySelector(".taskbar");
  const kiosk = () => document.body.classList.contains("kiosk-mode");

  // ---- window helpers ---------------------------------------------------
  function allEntries() { try { return (WM() && WM().windows && WM().windows()) || []; } catch (e) { return []; } }
  function isMin(e) { return !e.win || e.win.style.display === "none"; }
  function onActive(e) { return !window.WinX || !WinX.onActive || WinX.onActive(e); }
  function winTitle(e) {
    const t = e.win && e.win.querySelector(".win-titlebar .t-text");
    return (t && t.textContent.trim()) || e.title || e.appId || "Window";
  }
  function winIcon(e) {
    if (e.icon) return e.icon;
    try { return window.Icon ? Icon.mini(e.appId || "app", winTitle(e)) : ""; } catch (err) { return ""; }
  }
  // The windows a given taskbar button stands for (prefer the active desktop's).
  function entriesForBtn(btn) {
    let entries = [];
    try { const info = WM() && WM().taskBtnApp && WM().taskBtnApp(btn); if (info) entries = info.entries || []; } catch (e) {}
    if (!entries.length) return [];
    const here = entries.filter(onActive);
    return here.length ? here : entries;
  }
  function closeEntry(e) {
    const c = e.win && e.win.querySelector(".win-titlebar .ctl-close");
    if (c && !c.disabled) { c.click(); return; }
    try { if (e.close) e.close(); else if (e.win) e.win.remove(); } catch (err) {}
  }

  // ---- live snapshot of a .win-body -------------------------------------
  // Clone the body scaled to fit the thumbnail width; re-draw any <canvas>
  // (clones are blank) and fall back to the app icon when there's nothing to show.
  function buildShot(entry, thumbW) {
    const body = entry.win && entry.win.querySelector(".win-body");
    const r = body && body.getBoundingClientRect();
    if (!body || !r || r.width < 4 || r.height < 4 || isMin(entry)) return iconTile(entry);
    const scale = thumbW / r.width;
    const shotH = Math.max(64, Math.min(150, Math.round(r.height * scale)));
    const shot = el(`<div class="tbp-shot" aria-hidden="true" style="width:${thumbW}px;height:${shotH}px"></div>`);
    let clone;
    try { clone = body.cloneNode(true); } catch (e) { return iconTile(entry); }
    // Re-draw canvases: a cloned canvas keeps its size but loses its pixels.
    try {
      const src = body.querySelectorAll("canvas");
      const dst = clone.querySelectorAll("canvas");
      for (let i = 0; i < dst.length; i++) {
        const sc = src[i]; if (!sc || !sc.width || !sc.height) continue;
        const dc = dst[i];
        try {
          dc.width = sc.width; dc.height = sc.height;
          const ctx = dc.getContext("2d");
          if (ctx) ctx.drawImage(sc, 0, 0);
        } catch (err) { /* tainted / WebGL — leave the blank clone */ }
      }
    } catch (e) {}
    clone.classList.add("tbp-clone");
    clone.style.width = r.width + "px";
    clone.style.height = r.height + "px";
    clone.style.transform = "scale(" + scale + ")";
    clone.style.transformOrigin = "top left";
    // Neutralise the clone so it can't trap focus / fire handlers.
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    clone.querySelectorAll("input,textarea,select,button,a,iframe,[tabindex]").forEach((n) => { try { n.tabIndex = -1; n.disabled = true; } catch (err) {} });
    shot.appendChild(clone);
    return shot;
  }
  function iconTile(entry) {
    const tile = el(`<div class="tbp-shot tbp-iconshot" aria-hidden="true"><span class="tbp-bigicon">${winIcon(entry)}</span></div>`);
    return tile;
  }

  // ---- the preview popup -------------------------------------------------
  let pop = null, popBtn = null, hideTimer = null;

  function clearHide() { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } }
  function scheduleHide(delay) { clearHide(); hideTimer = setTimeout(hide, delay == null ? 260 : delay); }

  function hide() {
    clearHide();
    if (pop) { try { pop.remove(); } catch (e) {} }
    pop = null; popBtn = null;
  }

  function showFor(btn) {
    if (!btn) return;
    const entries = entriesForBtn(btn);
    if (!entries.length) { hide(); return; }
    // Rebuild if it's for a different button; otherwise refresh in place.
    hide();
    popBtn = btn;
    const touch = isCoarse();
    const thumbW = touch ? 180 : 212;
    pop = el(`<div class="tbp-preview" role="group" aria-label="Window previews"></div>`);
    entries.slice().sort((a, b) => (+b.win.style.zIndex || 0) - (+a.win.style.zIndex || 0)).forEach((e) => pop.appendChild(buildCard(e, thumbW)));
    document.body.appendChild(pop);
    pop.addEventListener("mouseenter", clearHide);
    pop.addEventListener("mouseleave", () => scheduleHide());
    position(btn);
  }

  function buildCard(entry, thumbW) {
    const card = el(`<div class="tbp-card" tabindex="0" role="button">
        <div class="tbp-head"><span class="tbp-ic">${winIcon(entry)}</span><span class="tbp-title">${esc(winTitle(entry))}</span><button class="tbp-close" title="Close" aria-label="Close ${esc(winTitle(entry))}">&#10005;</button></div>
      </div>`);
    card.insertBefore(buildShot(entry, thumbW), null);
    const focus = () => { hide(); try { WM().focusWindow(entry.win); } catch (e) {} };
    card.addEventListener("click", (ev) => { if (ev.target.closest(".tbp-close")) return; focus(); });
    card.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); focus(); } });
    card.querySelector(".tbp-close").addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeEntry(entry);
      // Re-render the popup for the same button (hide if nothing is left).
      const btn = popBtn;
      setTimeout(() => { if (btn && entriesForBtn(btn).length) showFor(btn); else hide(); }, 0);
    });
    return card;
  }

  function position(btn) {
    if (!pop) return;
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.round(r.left + r.width / 2 - pw / 2);
    left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
    let top = Math.round(r.top - ph - 10);
    if (top < 8) top = 8;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function isCoarse() { try { return window.matchMedia && window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } }

  // ---- taskbar wiring: hover (mouse) + long-press (touch) ----------------
  let wiredBar = null;
  function wireTaskbar() {
    const bar = taskbarEl();
    if (!bar || bar === wiredBar) return !!bar;
    wiredBar = bar;

    // Hover preview (mouse only). mouseover/out bubble, so we can delegate.
    bar.addEventListener("mouseover", (e) => {
      if (isCoarse()) return;
      const btn = e.target.closest(".tb-btn"); if (!btn) return;
      if (btn.classList.contains("start") || btn.classList.contains("wx-tv-btn")) return;
      if (!entriesForBtn(btn).length) return;
      clearHide();
      if (btn !== popBtn) showFor(btn);
    });
    bar.addEventListener("mouseout", (e) => {
      const btn = e.target.closest(".tb-btn"); if (!btn) return;
      // Leaving the button (not into the popup) -> schedule hide.
      const to = e.relatedTarget;
      if (to && (pop && pop.contains(to))) return;
      if (to && to.closest && to.closest(".tb-btn") === btn) return;
      scheduleHide();
    });

    // Touch long-press -> preview. The shell's own long-press opens a jump list
    // ~550ms in; ours fires a touch earlier and suppresses that jump list for the
    // gesture, so the preview wins without editing the shell.
    let lp = null, lx = 0, ly = 0, suppress = 0;
    const cancelLp = () => { if (lp) { clearTimeout(lp); lp = null; } };
    bar.addEventListener("pointerdown", (e) => {
      cancelLp();
      if (e.pointerType === "mouse") return;
      const btn = e.target.closest(".tb-btn"); if (!btn) return;
      if (btn.classList.contains("start") || btn.classList.contains("wx-tv-btn")) return;
      if (!entriesForBtn(btn).length) return;
      lx = e.clientX; ly = e.clientY;
      lp = setTimeout(() => {
        lp = null;
        showFor(btn);
        // Swallow the shell's jump list that appears just after.
        suppress = Date.now() + 500;
        const t = setInterval(() => {
          if (Date.now() > suppress) { clearInterval(t); return; }
          document.querySelectorAll(".jumplist").forEach((m) => m.remove());
        }, 60);
      }, 480);
    });
    bar.addEventListener("pointermove", (e) => { if (lp && Math.hypot(e.clientX - lx, e.clientY - ly) > 10) cancelLp(); });
    ["pointerup", "pointercancel"].forEach((ev) => bar.addEventListener(ev, cancelLp));

    // Right-click the empty taskbar area -> our context menu. Capture phase +
    // stopImmediatePropagation beats the shell's own empty-area handler, while app
    // buttons (jump list) and the Start / Task View buttons fall through untouched.
    bar.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".tb-btn")) return;       // app / start / task-view button -> shell handles it
      if (e.target.closest(".tbp-ctx")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      hide();
      showContextMenu(e.clientX, e.clientY);
    }, true);

    return true;
  }

  // ---- context menu ------------------------------------------------------
  function closeContextMenu() { document.querySelectorAll(".tbp-ctx").forEach((m) => m.remove()); }

  function showContextMenu(x, y) {
    closeContextMenu();
    const items = [
      { label: "Cascade windows", act: () => arrange("cascade") },
      { label: "Show windows stacked", act: () => arrange("stacked") },
      { label: "Show windows side by side", act: () => arrange("sidebyside") },
      { sep: true },
      { label: "Show the desktop", act: toggleShowDesktop },
      { sep: true },
      { label: "Task Manager", act: () => { try { WM().open("taskmanager"); } catch (e) {} } },
      { label: "Taskbar settings", act: () => { try { WM().open("settings"); } catch (e) {} } },
    ];
    const menu = el(`<div class="tbp-ctx" role="menu"></div>`);
    items.forEach((it) => {
      if (it.sep) { menu.appendChild(el(`<div class="tbp-ctx-sep"></div>`)); return; }
      const b = el(`<button class="tbp-ctx-item" role="menuitem">${esc(it.label)}</button>`);
      b.addEventListener("click", () => { closeContextMenu(); try { it.act(); } catch (e) {} });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - mw - 8)) + "px";
    let top = y - mh - 6;                       // prefer opening upward from the taskbar
    if (top < 8) top = Math.min(y + 6, window.innerHeight - mh - 8);
    menu.style.top = Math.max(8, top) + "px";
    setTimeout(() => {
      document.addEventListener("pointerdown", function h(ev) { if (!menu.contains(ev.target)) { closeContextMenu(); document.removeEventListener("pointerdown", h); } });
      document.addEventListener("keydown", function k(ev) { if (ev.key === "Escape") { closeContextMenu(); document.removeEventListener("keydown", k); } });
    }, 0);
  }

  // ---- work area + arranging --------------------------------------------
  function workArea() {
    const sw = window.innerWidth, sh = window.innerHeight;
    let bottom = sh - 48;
    const dock = taskbarEl() && taskbarEl().querySelector(".tb-dock");
    const bar = taskbarEl();
    try {
      if (dock) bottom = dock.getBoundingClientRect().top - 8;
      else if (bar) bottom = bar.getBoundingClientRect().top - 6;
    } catch (e) {}
    const pad = 8;
    return { x: pad, y: pad, w: Math.max(240, sw - pad * 2), h: Math.max(180, bottom - pad) };
  }

  // Non-minimised, non-kiosk windows on the active desktop, bottom-of-stack first.
  function arrangeable() {
    if (kiosk()) return [];
    return allEntries()
      .filter((e) => e.win && !isMin(e) && onActive(e))
      .sort((a, b) => (+a.win.style.zIndex || 0) - (+b.win.style.zIndex || 0));
  }

  function place(entry, l, t, w, h) {
    const win = entry.win;
    try { if (entry.maximized && entry.setMaximized) entry.setMaximized(false); } catch (e) {}
    try { if (entry.wxSnap && window.WinX && WinX.unsnap) WinX.unsnap(entry); } catch (e) {}
    win.classList.remove("maximized");
    win.style.left = Math.round(l) + "px";
    win.style.top = Math.round(t) + "px";
    win.style.width = Math.round(w) + "px";
    win.style.height = Math.round(h) + "px";
  }

  function arrange(mode) {
    const list = arrangeable();
    if (!list.length) return;
    const a = workArea();
    if (mode === "cascade") {
      const step = 30;
      const cw = Math.min(a.w, Math.max(360, Math.round(a.w * 0.62)));
      const ch = Math.min(a.h, Math.max(260, Math.round(a.h * 0.68)));
      const maxI = Math.max(1, Math.floor((Math.min(a.w - cw, a.h - ch)) / step));
      list.forEach((e, i) => {
        const k = i % (maxI + 1);
        place(e, a.x + k * step, a.y + k * step, cw, ch);
      });
    } else if (mode === "stacked") {
      // Rows: each window full width, stacked vertically (tile horizontally).
      const n = list.length, rh = Math.floor(a.h / n);
      list.forEach((e, i) => place(e, a.x, a.y + i * rh, a.w, rh - 6));
    } else if (mode === "sidebyside") {
      // Columns: each window full height, side by side (tile vertically).
      const n = list.length, cw = Math.floor(a.w / n);
      list.forEach((e, i) => place(e, a.x + i * cw, a.y, cw - 6, a.h));
    }
    // Re-focus in bottom-to-top order so the original stacking survives.
    list.forEach((e) => { try { WM().focusWindow(e.win); } catch (err) {} });
  }

  // Show the desktop: minimise all visible windows, or restore them if already hidden.
  let hiddenStash = null;
  function toggleShowDesktop() {
    const visible = allEntries().filter((e) => e.win && !isMin(e) && onActive(e));
    if (visible.length) {
      hiddenStash = visible.map((e) => e.win);
      visible.forEach((e) => { e.win.style.display = "none"; });
      try { WM().refreshTaskbarActive(); } catch (e) {}
    } else if (hiddenStash && hiddenStash.length) {
      hiddenStash.forEach((w) => { if (w && w.isConnected) w.style.display = ""; });
      hiddenStash = null;
      try { WM().refreshTaskbarActive(); } catch (e) {}
    }
  }

  // ---- boot: wait for the taskbar to exist ------------------------------
  function boot() {
    if (wireTaskbar()) return;
    const t = setInterval(() => { if (wireTaskbar()) clearInterval(t); }, 500);
    // The shell rebuilds the taskbar (buildDesktop); re-check so our listeners re-attach.
  }
  // Keep re-wiring if the taskbar element is ever replaced.
  setInterval(() => { const bar = taskbarEl(); if (bar && bar !== wiredBar) wireTaskbar(); }, 1500);
  // Hide the preview on scroll / resize / when a window takes focus elsewhere.
  window.addEventListener("resize", hide);
  window.addEventListener("blur", hide);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.TbPreview = { arrange, showFor };
})();
