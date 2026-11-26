/* WinX — Windows 11/12 window management on top of the window manager:
   Snap Layouts + Snap Assist + edge snapping, Alt+Tab switcher, Task View and
   virtual desktops. Works with mouse, touch (iPad) and keyboards without a
   Windows key (every Win combo has a Ctrl+Alt alternative and a visible button).

   Keyboard:
     Alt+Tab (hold Alt)  switcher; Shift reverses; Esc cancels; release Alt to switch
     Ctrl+Alt+Tab        switcher that stays open (arrows / Tab + Enter, or click)
     Ctrl+Alt+Up, Win+Tab   Task View   (Ctrl+Alt+Down / Esc closes it)
     Ctrl+Alt+Left/Right, Ctrl+Win+Left/Right   previous / next desktop
     Win+Left/Right  snap the focused window to a side; press again to cycle the
                     width: half -> third -> two-thirds (see SNAP SCHEME below).
     Win+Up/Down     after a side-snap: top / bottom quarter; otherwise maximize /
                     minimize (restore a maximized window first).
     Ctrl+Alt+Shift+Arrow is the no-Win-key alternative for all of the above
     (Ctrl+Alt+Arrow without Shift is kept for switching desktops).
*/
(function () {
  "use strict";

  const scr = () => document.getElementById("screen");
  const S = () => State.data;
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const wins = () => (window.WM && WM.windows ? WM.windows() : []);
  const zOf = (e) => +e.win.style.zIndex || 0;
  const isMin = (e) => e.win.style.display === "none";
  const kiosk = () => document.body.classList.contains("kiosk-mode");
  function reduceMotion() {
    if (document.body.classList.contains("a11y-reduce-motion")) return true;
    try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }
  function desktopReady() { return !!document.querySelector(".desktop") && !document.querySelector(".lock-screen, .boot-layer, .wsetup-screen"); }
  function titleText(e) { const t = e.win.querySelector(".win-titlebar .t-text"); return (t && t.textContent.trim()) || e.title || e.appId || "Window"; }
  function iconHtml(e) { return e.icon || (window.Icon ? Icon.mini(e.appId || "app", titleText(e)) : ""); }
  const OVERLAY_Z = 9400;

  // =====================================================================
  //  Virtual desktops  (persisted in State.data.appData.desktops)
  // =====================================================================
  function store() {
    if (!S().appData) S().appData = {};
    let d = S().appData.desktops;
    if (!d || !Array.isArray(d.list) || !d.list.length) d = S().appData.desktops = { list: [{ id: "d1", name: "Desktop 1" }], active: "d1", next: 2 };
    if (!d.next) d.next = d.list.length + 1;
    if (!d.list.some((x) => x.id === d.active)) d.active = d.list[0].id;
    return d;
  }
  function activeId() { return store().active; }
  function deskById(id) { return store().list.find((x) => x.id === id); }
  function onActive(e) {
    if (!e) return true;
    if (!e.desk || !deskById(e.desk)) e.desk = activeId(); // stray / legacy window → current desktop
    return e.desk === activeId();
  }
  function deskWindows(id) { return wins().filter((e) => (e.desk || activeId()) === id); }

  // ---- per-desktop wallpaper ----
  // Each desktop may carry its own optional `wallpaper` (an assets/ path, data:/http
  // URL, or a CSS color). With none set it falls back to the global wallpaper. On
  // switch we apply the active desktop's wallpaper; the Task View minis use the same.
  function isImgWp(wp) { return typeof wp === "string" && (wp.startsWith("data:") || wp.startsWith("http") || wp.startsWith("assets/")); }
  function globalWallpaperCss() {
    try { const pz = window.Personalize && Personalize.wallpaperCss && Personalize.wallpaperCss(); if (pz) return pz; } catch (e) {}
    const wp = S().desktop && S().desktop.wallpaper;
    if (!wp || wp === "default") return "url(assets/wall3.jpg) center/cover";
    return isImgWp(wp) ? `url(${wp}) center/cover` : wp;
  }
  function deskWallpaperCss(id) {
    const d = deskById(id); const wp = d && d.wallpaper;
    if (!wp || wp === "default") return globalWallpaperCss();
    return isImgWp(wp) ? `url(${wp}) center/cover` : wp;
  }
  let lastWpSig = null;
  function applyDeskWallpaper() {
    const desk = document.querySelector(".desktop"); if (!desk) return;
    const d = deskById(activeId()); const wp = (d && d.wallpaper) || "default";
    // Keyed by the resolved wallpaper so repeated applyDesktop() calls (rename, reorder,
    // move window) don't re-trigger a crossfade when the background hasn't changed.
    const sig = wp === "default" ? "global" : wp;
    if (sig === lastWpSig) return;
    lastWpSig = sig;
    // No custom wallpaper: let the window manager restore the global one (keeps
    // slideshow / spotlight / crossfade behaviour intact).
    if (wp === "default") { if (window.WM && WM.applyWallpaper) WM.applyWallpaper(); else desk.style.background = globalWallpaperCss(); return; }
    desk.style.background = isImgWp(wp) ? `url(${wp}) center/cover` : wp;
  }
  function setDeskWallpaper(id, wp) {
    const d = deskById(id); if (!d) return;
    if (!wp || wp === "default") delete d.wallpaper; else d.wallpaper = wp;
    State.save();
    if (id === activeId()) applyDeskWallpaper();
  }

  // Show only the active desktop's windows (minimized state is left alone).
  function applyDesktop() {
    wins().forEach((e) => e.win.classList.toggle("wx-offdesk", !onActive(e)));
    applyDeskWallpaper();
    if (window.WM && WM.refreshTaskbarActive) WM.refreshTaskbarActive();
    const tv = document.querySelector(".taskbar .wx-tv-btn");
    if (tv) { const d = store(); const i = d.list.findIndex((x) => x.id === d.active); tv.dataset.desk = d.list.length > 1 ? String(i + 1) : ""; tv.title = "Task View (Ctrl+Alt+Up)" + (d.list.length > 1 ? " · " + deskById(d.active).name : ""); }
  }

  let slideAnims = [];
  function switchTo(id, opts) {
    opts = opts || {};
    const d = store();
    if (!deskById(id) || id === d.active) return;
    const from = d.list.findIndex((x) => x.id === d.active), to = d.list.findIndex((x) => x.id === id);
    const dir = to > from ? 1 : -1;
    const outgoing = wins().filter((e) => onActive(e) && !isMin(e));
    slideAnims.forEach((a) => { try { a.cancel(); } catch (e) {} }); slideAnims = [];
    d.active = id; State.save();
    applyDeskWallpaper(); // show the incoming desktop's wallpaper right away
    const animate = opts.animate !== false && !reduceMotion() && typeof Element.prototype.animate === "function";
    if (animate) {
      const W = (scr() && scr().clientWidth) || window.innerWidth;
      const ease = { duration: 300, easing: "cubic-bezier(.2,.8,.2,1)" };
      // Keep the outgoing windows on screen while they slide away.
      outgoing.forEach((e) => {
        const a = e.win.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-dir * W}px)` }], ease);
        slideAnims.push(a);
      });
      wins().forEach((e) => { if (onActive(e)) e.win.classList.remove("wx-offdesk"); });
      wins().filter((e) => onActive(e) && !isMin(e)).forEach((e) => slideAnims.push(e.win.animate([{ transform: `translateX(${dir * W}px)` }, { transform: "translateX(0)" }], ease)));
      if (window.WM && WM.refreshTaskbarActive) WM.refreshTaskbarActive();
      const mine = slideAnims;
      setTimeout(() => { if (slideAnims === mine) { slideAnims = []; applyDesktop(); } }, 310);
    } else applyDesktop();
    showDeskHud(deskById(id).name, dir);
    if (tvOpen()) renderTaskView();
  }
  function switchRelative(step) {
    const d = store(); const i = d.list.findIndex((x) => x.id === d.active);
    const n = d.list[i + step];
    if (n) switchTo(n.id);
    else showDeskHud(deskById(d.active).name, 0, true); // bump at the end of the strip
  }
  function addDesktop() {
    const d = store();
    const id = "d" + d.next++;
    let n = d.list.length + 1; while (d.list.some((x) => x.name === "Desktop " + n)) n++;
    d.list.push({ id, name: "Desktop " + n }); State.save();
    applyDesktop();
    return id;
  }
  function renameDesktop(id, name) { const x = deskById(id); name = String(name || "").trim().slice(0, 40); if (x && name) { x.name = name; State.save(); applyDesktop(); } }
  function closeDesktop(id) {
    const d = store(); if (d.list.length <= 1) return;
    const i = d.list.findIndex((x) => x.id === id); if (i < 0) return;
    const neighbour = d.list[i - 1] || d.list[i + 1];
    deskWindows(id).forEach((e) => { e.desk = neighbour.id; });
    d.list.splice(i, 1);
    if (d.active === id) d.active = neighbour.id;
    State.save(); applyDesktop();
  }
  function moveWindow(e, id) { if (!e || !deskById(id)) return; e.desk = id; applyDesktop(); }

  let hudT = null;
  function showDeskHud(name, dir, bump) {
    if (tv) return; // Task View already shows which desktop is active
    let h = document.querySelector(".wx-desk-hud");
    if (!h) { h = el(`<div class="wx-desk-hud" role="status" aria-live="polite"></div>`); scr().appendChild(h); }
    const d = store();
    h.innerHTML = `<div class="wx-hud-dots">${d.list.map((x) => `<span class="${x.id === d.active ? "on" : ""}"></span>`).join("")}</div><b>${esc(name)}</b>`;
    h.classList.remove("wx-hud-bump"); void h.offsetWidth;
    h.classList.add("show"); if (bump) h.classList.add("wx-hud-bump");
    clearTimeout(hudT); hudT = setTimeout(() => h.classList.remove("show", "wx-hud-bump"), 1100);
  }

  // =====================================================================
  //  Live previews: a scaled-down, non-interactive clone of a window
  // =====================================================================
  function makePreview(e, boxW, boxH) {
    const win = e.win;
    const hidden = !win.offsetWidth;
    if (hidden) win.classList.add("wx-measure");
    // Snapshot the window BODY (the app's content). The card header already shows the
    // icon + title, so cloning the body alone keeps the thumbnail clean and lighter.
    const src = win.querySelector(".win-body") || win;
    const { w, h } = { w: src.offsetWidth || 600, h: src.offsetHeight || 400 };
    // Note scroll offsets (the clone's element list stays index-aligned with the source).
    const all = src.querySelectorAll("*"), scrolls = [];
    for (let i = 0; i < all.length; i++) { const n = all[i]; if (n.scrollTop || n.scrollLeft) scrolls.push([i, n.scrollTop, n.scrollLeft]); }
    const srcCanvases = [...src.querySelectorAll("canvas")].map((c) => ({ c, cw: c.offsetWidth, ch: c.offsetHeight }));
    const clone = src.cloneNode(true);
    if (hidden) win.classList.remove("wx-measure");
    // Sanitize BEFORE it touches the document: no duplicate ids, no radio-group
    // stealing, no reloading iframes, no media playback.
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((n) => { if (!(n instanceof SVGElement)) n.removeAttribute("id"); });
    clone.querySelectorAll("input,select,textarea,button,form,iframe").forEach((n) => { n.removeAttribute("name"); n.removeAttribute("autofocus"); });
    clone.querySelectorAll("iframe,object,embed").forEach((n) => { const ph = document.createElement("div"); ph.className = "wx-pv-ph " + (n.className && n.className.baseVal == null ? n.className : ""); ph.setAttribute("style", n.getAttribute("style") || ""); ph.style.width = ph.style.width || "100%"; ph.style.height = ph.style.height || "100%"; n.replaceWith(ph); });
    clone.querySelectorAll("video,audio").forEach((n) => { n.removeAttribute("autoplay"); n.removeAttribute("src"); n.setAttribute("preload", "none"); n.querySelectorAll("source").forEach((s) => s.removeAttribute("src")); });
    clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
    // Canvases don't clone their pixels; copy a down-scaled snapshot.
    clone.querySelectorAll("canvas").forEach((c, i) => {
      const s = srcCanvases[i]; if (!s) return;
      try {
        const sw = s.c.width, sh = s.c.height; if (!sw || !sh) return;
        const k = Math.min(1, 480 / Math.max(sw, sh));
        if (s.cw && s.ch) { c.style.width = s.cw + "px"; c.style.height = s.ch + "px"; }
        c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
        c.getContext("2d").drawImage(s.c, 0, 0, c.width, c.height);
      } catch (err) { /* tainted / lost context: leave blank */ }
    });
    clone.classList.remove("wx-offdesk", "wx-measure", "wx-snapped", "maximized");
    clone.classList.add("wx-clone");
    const k = Math.min(boxW / w, boxH / h);
    Object.assign(clone.style, { position: "absolute", left: "0", top: "0", width: w + "px", height: h + "px", transform: `scale(${k})`, transformOrigin: "0 0", zIndex: "auto", margin: "0" });
    const wrap = el(`<div class="wx-pv" aria-hidden="true"></div>`);
    wrap.style.width = Math.round(w * k) + "px"; wrap.style.height = Math.round(h * k) + "px";
    wrap.setAttribute("inert", "");
    wrap.appendChild(clone);
    wrap.__wxScroll = () => {
      if (!scrolls.length) return;
      const cl = clone.querySelectorAll("*");
      scrolls.forEach(([i, t, l]) => { const n = cl[i]; if (n) { n.scrollTop = t; n.scrollLeft = l; } });
    };
    return wrap;
  }
  function mount(host, pv) { host.appendChild(pv); try { pv.__wxScroll(); } catch (e) {} }

  // =====================================================================
  //  Snap
  // =====================================================================
  function workArea() { const s = scr(); return { W: s.clientWidth, H: s.clientHeight - (kiosk() ? 0 : 48) }; }
  function fracRect(f) { const { W, H } = workArea(); const l = Math.round(f[0] * W), t = Math.round(f[1] * H); return { l, t, w: Math.round((f[0] + f[2]) * W) - l, h: Math.round((f[1] + f[3]) * H) - t }; }
  function curRect(win) { return { l: win.offsetLeft, t: win.offsetTop, w: win.offsetWidth, h: win.offsetHeight }; }
  const Z = {
    left: [0, 0, 0.5, 1], right: [0.5, 0, 0.5, 1],
    tl: [0, 0, 0.5, 0.5], tr: [0.5, 0, 0.5, 0.5], bl: [0, 0.5, 0.5, 0.5], br: [0.5, 0.5, 0.5, 0.5],
  };
  const LAYOUTS = [
    { name: "Halves", zones: [Z.left, Z.right] },
    { name: "Two-thirds and one-third", zones: [[0, 0, 2 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
    { name: "Thirds", zones: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
    { name: "Half and two quarters", zones: [Z.left, Z.tr, Z.br] },
    { name: "Quarters", zones: [Z.tl, Z.tr, Z.bl, Z.br] },
    { name: "Quarter, half, quarter", zones: [[0, 0, 0.25, 1], [0.25, 0, 0.5, 1], [0.75, 0, 0.25, 1]], wide: true },
  ];
  function canSnap(e) { return e && !e.noMax && !kiosk(); }
  function snap(e, f, pre) {
    if (!canSnap(e)) return;
    const win = e.win;
    if (!pre) pre = e.wxSnap ? e.wxPrev : (e.maximized && e.maxPrev ? e.maxPrev() : curRect(win));
    if (e.maximized && e.setMaximized) e.setMaximized(false);
    e.wxPrev = pre; e.wxSnap = { f: f.slice() };
    win.classList.add("wx-snapped");
    const r = fracRect(f);
    Object.assign(win.style, { left: r.l + "px", top: r.t + "px", width: r.w + "px", height: r.h + "px" });
    if (window.WM) WM.focusWindow(win);
  }
  function unsnap(e) {
    if (!e || !e.wxSnap) return;
    const p = e.wxPrev; e.wxSnap = null; e.wxKb = null; e.win.classList.remove("wx-snapped");
    if (p) { e.win.style.width = p.w + "px"; e.win.style.height = p.h + "px"; }
    dropFromGroups(e); // leaving a layout breaks the snap group
  }
  function maximizeFrom(e, pre) {
    if (!e.setMaximized || e.noMax) return;
    if (e.wxSnap) unsnap(e);
    if (pre) Object.assign(e.win.style, { left: pre.l + "px", top: pre.t + "px", width: pre.w + "px", height: pre.h + "px" });
    e.setMaximized(true);
  }
  window.addEventListener("resize", () => { wins().forEach((e) => { if (e.wxSnap) { const r = fracRect(e.wxSnap.f); Object.assign(e.win.style, { left: r.l + "px", top: r.t + "px", width: r.w + "px", height: r.h + "px" }); } }); });

  // =====================================================================
  //  Snap groups — windows snapped into one layout are remembered together,
  //  so a taskbar button in the group can "restore group" (raise them all).
  //  Stored in State.data.appData.snapGroups = [{ id, members:[{winId,f}] }].
  //  A group needs >= 2 live members; it is pruned when windows close / unsnap.
  // =====================================================================
  let grpSeq = 1, assistGroupId = null;
  function groupStore() { if (!S().appData) S().appData = {}; if (!Array.isArray(S().appData.snapGroups)) S().appData.snapGroups = []; return S().appData.snapGroups; }
  function liveEntryById(id) { return wins().find((e) => e.id === id) || null; }
  function entriesInGroup(g) { return g.members.map((m) => liveEntryById(m.winId)).filter(Boolean); }
  function groupFor(entry) { return entry && entry.id ? groupStore().find((g) => g.members.some((m) => m.winId === entry.id)) || null : null; }
  function pruneGroups() {
    const gs = groupStore();
    gs.forEach((g) => { g.members = g.members.filter((m) => liveEntryById(m.winId)); });
    const kept = gs.filter((g) => g.members.length >= 2);
    if (kept.length !== gs.length) { S().appData.snapGroups = kept; }
    return S().appData.snapGroups;
  }
  function upsertGroup(entries) {
    entries = (entries || []).filter((e) => e && e.id && e.win && e.win.isConnected && e.wxSnap);
    const seen = new Set(); entries = entries.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
    if (entries.length < 2) return;
    const gs = groupStore();
    const ids = entries.map((e) => e.id);
    gs.forEach((g) => { g.members = g.members.filter((m) => !ids.includes(m.winId)); });
    let g = assistGroupId ? gs.find((x) => x.id === assistGroupId) : null;
    if (!g) { g = { id: "sg" + grpSeq++, members: [] }; gs.push(g); assistGroupId = g.id; }
    g.members = entries.map((e) => ({ winId: e.id, f: e.wxSnap.f.slice() }));
    S().appData.snapGroups = gs.filter((x) => x.members.length >= 2);
    State.save();
  }
  function dropFromGroups(e) {
    if (!e || !e.id || !(S().appData && S().appData.snapGroups)) return;
    const gs = S().appData.snapGroups; let changed = false;
    gs.forEach((g) => { const n = g.members.length; g.members = g.members.filter((m) => m.winId !== e.id); if (g.members.length !== n) changed = true; });
    const kept = gs.filter((g) => g.members.length >= 2);
    if (changed || kept.length !== gs.length) { S().appData.snapGroups = kept; State.save(); }
  }
  function restoreGroup(g) {
    const members = g.members.map((m) => ({ e: liveEntryById(m.winId), f: m.f })).filter((x) => x.e);
    if (members.length < 2) return;
    members.forEach(({ e, f }) => {
      if (e.desk && e.desk !== activeId()) moveWindow(e, activeId()); // bring the whole group onto the current desktop
      if (e.win.style.display === "none") e.win.style.display = "";
      if (f && canSnap(e)) snap(e, f); else if (window.WM) WM.focusWindow(e.win);
    });
    members.forEach(({ e }) => { if (window.WM) WM.focusWindow(e.win); }); // raise them above everything else, in order
  }

  // ---- taskbar hover affordance: "restore group" over a grouped app button ----
  // Appended to document.body (not #screen) with a z above the taskbar thumbnail
  // previews (js/tbpreview.js, .tbp-preview at z 9700): #screen is a fixed stacking
  // context with z:auto, so a chip inside it can't paint over a body-level popup.
  // When that preview is showing, the chip sits above it so the two don't fight.
  let grpFly = null, grpForBtn = null, grpShowT = null, grpHideT = null, grpReposT = null;
  const tbBtnOf = (t) => (t && t.closest ? t.closest(".taskbar .tb-btn") : null);
  function groupForBtn(btn) { pruneGroups(); const ents = wins().filter((e) => e.taskBtn === btn); for (const e of ents) { const g = groupFor(e); if (g) return g; } return null; }
  function scheduleGrpHide() { clearTimeout(grpHideT); grpHideT = setTimeout(hideGrpFly, 260); }
  function hideGrpFly() { clearTimeout(grpShowT); clearTimeout(grpHideT); clearTimeout(grpReposT); if (grpFly) { const f = grpFly; f.classList.remove("show"); setTimeout(() => f.remove(), 140); } grpFly = null; grpForBtn = null; }
  function positionGrpFly(f, btn) {
    const r = btn.getBoundingClientRect(), fw = f.offsetWidth, fh = f.offsetHeight;
    let left = r.left + r.width / 2 - fw / 2; left = Math.max(8, Math.min(window.innerWidth - fw - 8, left));
    // If a taskbar thumbnail preview is open above this button, sit above it instead.
    let anchorTop = r.top;
    const tbp = document.querySelector(".tbp-preview");
    if (tbp) { const tr = tbp.getBoundingClientRect(); if (tr.height && tr.left < r.right + 8 && tr.right > r.left - 8) anchorTop = Math.min(anchorTop, tr.top); }
    let top = anchorTop - fh - 8; if (top < 8) top = r.bottom + 8;
    f.style.left = left + "px"; f.style.top = top + "px";
  }
  function showGrpFly(btn) {
    const g = groupForBtn(btn); if (!g) return;
    if (grpFly && grpForBtn === btn) return;
    hideGrpFly(); grpForBtn = btn;
    const ents = entriesInGroup(g);
    const tiles = g.members.map((m) => { const f = m.f || [0, 0, 1, 1]; return `<span class="wx-grpz" style="left:${f[0] * 100}%;top:${f[1] * 100}%;width:${f[2] * 100}%;height:${f[3] * 100}%"></span>`; }).join("");
    const f = grpFly = el(`<div class="wx-grpfly" role="dialog" aria-label="Snap group"><div class="wx-grpprev">${tiles}</div><button class="wx-grprestore">Restore group<span class="wx-grpn">${ents.length}</span></button></div>`);
    f.style.zIndex = "9900"; // above .tbp-preview (9700), at document.body level
    f.querySelector(".wx-grprestore").onclick = (ev) => { ev.stopPropagation(); hideGrpFly(); restoreGroup(g); };
    f.addEventListener("pointerenter", () => clearTimeout(grpHideT));
    f.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") scheduleGrpHide(); });
    document.body.appendChild(f);
    positionGrpFly(f, btn);
    void f.offsetWidth; f.classList.add("show");
    // The thumbnail preview may open a moment later; re-anchor above it once it's there.
    clearTimeout(grpReposT);
    grpReposT = setTimeout(() => { if (grpFly === f) { positionGrpFly(f, btn); grpReposT = setTimeout(() => { if (grpFly === f) positionGrpFly(f, btn); }, 260); } }, 200);
  }
  document.addEventListener("pointerover", (ev) => {
    if (ev.pointerType !== "mouse") return;
    const b = tbBtnOf(ev.target); if (!b || !groupForBtn(b)) return;
    clearTimeout(grpHideT); clearTimeout(grpShowT);
    grpShowT = setTimeout(() => { if (b.matches(":hover")) showGrpFly(b); }, 380);
  }, true);
  document.addEventListener("pointerout", (ev) => {
    if (ev.pointerType !== "mouse") return;
    const b = tbBtnOf(ev.target); if (!b) return;
    if (ev.relatedTarget && (b.contains(ev.relatedTarget) || (grpFly && grpFly.contains(ev.relatedTarget)))) return;
    clearTimeout(grpShowT); if (grpFly) scheduleGrpHide();
  }, true);
  // Touch / click a grouped taskbar button: let the taskbar's own click run, but
  // surface the chip briefly so the group is reachable without a mouse hover.
  document.addEventListener("pointerdown", (ev) => {
    if (grpFly && !grpFly.contains(ev.target) && !tbBtnOf(ev.target)) hideGrpFly();
    if (ev.pointerType === "mouse") return;
    const b = tbBtnOf(ev.target); if (b && groupForBtn(b)) setTimeout(() => showGrpFly(b), 0);
  }, true);

  // =====================================================================
  //  Keyboard snapping — halves, thirds, two-thirds and quarters.
  //
  //  SNAP SCHEME (focused window; Win+Arrow, or Ctrl+Alt+Shift+Arrow):
  //    Win+Left / Win+Right set the side. The FIRST press is a half. Pressing the
  //    same side again cycles the width:  half -> third -> two-thirds -> half.
  //    (Pressing the opposite side jumps straight to that side's half.)
  //    Win+Up / Win+Down, once a window is side-snapped, step the vertical zone to a
  //    quarter (always half-width):  half -> top quarter -> (Up) maximize;
  //                                  half -> bottom quarter -> (Down) minimize.
  //    From a quarter, Left/Right expands back to a half on that side first.
  //    With no snap: Win+Up maximizes, Win+Down minimizes (a maximized window
  //    restores on Win+Down first).
  // =====================================================================
  const KBW = { half: 0.5, third: 1 / 3, twothird: 2 / 3 };
  function kbFrac(st) {
    const w = KBW[st.size] || 0.5;
    const left = st.side === "left" ? 0 : 1 - w;
    const top = st.vert === "bottom" ? 0.5 : 0, h = st.vert === "full" ? 1 : 0.5;
    return [left, top, w, h];
  }
  function focusedEntry() { return wins().filter((e) => onActive(e) && !isMin(e)).sort((a, b) => zOf(b) - zOf(a))[0] || null; }
  function minimizeEntry(e) { const b = e.win.querySelector(".win-titlebar .ctl-min"); if (b && !b.disabled) b.click(); }
  function kbSnap(e, key) {
    const vertical = key === "ArrowUp" || key === "ArrowDown";
    let st = (e.wxKb && e.wxSnap) ? e.wxKb : null; // only trust kb-state while still snapped
    if (vertical) {
      if (!st) {
        if (e.maximized) { if (key === "ArrowDown" && e.setMaximized) e.setMaximized(false); return; }
        if (key === "ArrowUp") maximizeFrom(e); else minimizeEntry(e);
        return;
      }
      if (key === "ArrowUp") {
        if (st.vert === "bottom") st.vert = "full";
        else if (st.vert === "full") { st.vert = "top"; st.size = "half"; }
        else { e.wxKb = null; maximizeFrom(e); return; } // top quarter -> maximize
      } else {
        if (st.vert === "top") st.vert = "full";
        else if (st.vert === "full") { st.vert = "bottom"; st.size = "half"; }
        else { minimizeEntry(e); return; } // bottom quarter -> minimize
      }
    } else {
      const side = key === "ArrowLeft" ? "left" : "right";
      if (!st || st.side !== side) st = { side: side, size: "half", vert: "full" };
      else if (st.vert !== "full") { st.vert = "full"; st.size = "half"; } // quarter -> half
      else st.size = st.size === "half" ? "third" : st.size === "third" ? "twothird" : "half";
    }
    e.wxKb = st;
    snap(e, kbFrac(st));
  }

  // ---- drag a window to an edge / corner ----
  let drag = null;
  function edgeZone(x, y, touch) {
    const s = scr(); const W = s.clientWidth, H = s.clientHeight;
    const E = touch ? 22 : 6, C = Math.min(150, H * 0.2);
    const { H: WH } = workArea();
    if (x <= E) return y < C ? "tl" : y > WH - C ? "bl" : "left";
    if (x >= W - 1 - E) return y < C ? "tr" : y > WH - C ? "br" : "right";
    if (y <= E) return x < C * 0.6 ? "tl" : x > W - C * 0.6 ? "tr" : "max";
    return null;
  }
  function zoneRect(z) { return z === "max" ? { l: 0, t: 0, w: workArea().W, h: workArea().H } : fracRect(Z[z]); }
  function dragStart(e, ev) {
    if (!canSnap(e)) { drag = null; return; }
    drag = { e, pre: curRect(e.win), zone: null, touch: ev.pointerType !== "mouse", pv: null };
  }
  function dragMove(e, ev) {
    if (!drag || drag.e !== e) return;
    const z = edgeZone(ev.clientX, ev.clientY, drag.touch);
    if (z === drag.zone) return;
    drag.zone = z;
    if (!z) { if (drag.pv) { const p = drag.pv; p.classList.remove("show"); setTimeout(() => { if (!p.classList.contains("show")) p.remove(); }, 200); drag.pv = null; } return; }
    let pv = drag.pv;
    if (!pv) {
      pv = drag.pv = el(`<div class="wx-snap-preview"></div>`);
      const c = curRect(e.win);
      Object.assign(pv.style, { left: c.l + "px", top: c.t + "px", width: c.w + "px", height: c.h + "px", zIndex: e.win.style.zIndex });
      scr().insertBefore(pv, e.win);
      void pv.offsetWidth;
    }
    const r = zoneRect(z);
    Object.assign(pv.style, { left: r.l + "px", top: r.t + "px", width: r.w + "px", height: r.h + "px" });
    pv.classList.add("show");
  }
  function dragEnd(e, ev, cancelled) {
    if (!drag || drag.e !== e) return;
    const d = drag; drag = null;
    if (d.pv) { const p = d.pv; p.classList.remove("show"); setTimeout(() => p.remove(), 200); }
    if (cancelled || !d.zone) return;
    if (d.zone === "max") { maximizeFrom(e, d.pre); return; }
    snap(e, Z[d.zone], d.pre);
    const rest = { left: ["right"], right: ["left"], tl: ["tr", "bl", "br"], tr: ["tl", "bl", "br"], bl: ["tl", "tr", "br"], br: ["tl", "tr", "bl"] }[d.zone] || [];
    setTimeout(() => snapAssist(rest.map((k) => Z[k]), [e]), 60);
  }

  // ---- Snap Layouts flyout (hover / long-press the maximize button) ----
  let fly = null, flyFor = null, flyShowT = null, flyHideT = null, lpT = null, swallowUntil = 0, lpXY = null;
  function hideFly() { clearTimeout(flyShowT); clearTimeout(flyHideT); if (fly) { const f = fly; f.classList.remove("show"); setTimeout(() => f.remove(), 150); } fly = null; flyFor = null; }
  function showFly(btn) {
    const win = btn.closest(".win"); const e = window.WM && WM.entryFor(win);
    if (!e || !canSnap(e) || btn.disabled) return;
    if (fly && flyFor === e) return;
    hideFly();
    const wide = workArea().W >= 1400;
    const f = fly = el(`<div class="wx-snapfly" role="menu" aria-label="Snap layouts"><div class="wx-snapfly-grid"></div><div class="wx-snapfly-hint">Snap layouts</div></div>`);
    flyFor = e;
    const grid = f.querySelector(".wx-snapfly-grid");
    LAYOUTS.filter((L) => !L.wide || wide).forEach((L) => {
      const t = el(`<div class="wx-sl" title="${esc(L.name)}"></div>`);
      L.zones.forEach((z, i) => {
        const zb = el(`<button class="wx-sz" role="menuitem" aria-label="${esc(L.name)} — zone ${i + 1}"></button>`);
        Object.assign(zb.style, { left: `calc(${z[0] * 100}% + 2px)`, top: `calc(${z[1] * 100}% + 2px)`, width: `calc(${z[2] * 100}% - 4px)`, height: `calc(${z[3] * 100}% - 4px)` });
        zb.onclick = (ev) => {
          ev.stopPropagation(); hideFly();
          snap(e, z);
          setTimeout(() => snapAssist(L.zones.filter((_, j) => j !== i), [e]), 60);
        };
        t.appendChild(zb);
      });
      grid.appendChild(t);
    });
    f.style.zIndex = OVERLAY_Z + 300;
    f.addEventListener("pointerenter", () => clearTimeout(flyHideT));
    f.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") scheduleHide(); });
    scr().appendChild(f);
    const r = btn.getBoundingClientRect(), fw = f.offsetWidth, fh = f.offsetHeight;
    let left = r.left + r.width / 2 - fw / 2; left = Math.max(8, Math.min(window.innerWidth - fw - 8, left));
    let top = r.bottom + 4; if (top + fh > window.innerHeight - 8) top = Math.max(8, r.top - fh - 4);
    f.style.left = left + "px"; f.style.top = top + "px";
    void f.offsetWidth; f.classList.add("show");
  }
  function scheduleHide() { clearTimeout(flyHideT); flyHideT = setTimeout(hideFly, 300); }
  const maxBtnOf = (t) => (t && t.closest ? t.closest(".win:not(.wx-clone) .win-controls .ctl-max") : null);
  document.addEventListener("pointerover", (ev) => {
    if (ev.pointerType !== "mouse") return;
    const b = maxBtnOf(ev.target); if (!b || b.disabled) return;
    clearTimeout(flyHideT); clearTimeout(flyShowT);
    flyShowT = setTimeout(() => { if (b.matches(":hover")) showFly(b); }, 420);
  }, true);
  document.addEventListener("pointerout", (ev) => {
    if (ev.pointerType !== "mouse") return;
    const b = maxBtnOf(ev.target); if (!b) return;
    if (ev.relatedTarget && (b.contains(ev.relatedTarget) || (fly && fly.contains(ev.relatedTarget)))) return;
    clearTimeout(flyShowT); if (fly) scheduleHide();
  }, true);
  document.addEventListener("pointerdown", (ev) => {
    if (fly && !fly.contains(ev.target) && !maxBtnOf(ev.target)) hideFly();
    if (ev.pointerType === "mouse") { if (maxBtnOf(ev.target)) { clearTimeout(flyShowT); hideFly(); } return; }
    const b = maxBtnOf(ev.target); if (!b || b.disabled) return;
    clearTimeout(lpT); lpXY = [ev.clientX, ev.clientY];
    lpT = setTimeout(() => { lpT = null; swallowUntil = Date.now() + 1500; showFly(b); }, 500);
  }, true);
  document.addEventListener("pointermove", (ev) => { if (lpT && lpXY && Math.hypot(ev.clientX - lpXY[0], ev.clientY - lpXY[1]) > 12) { clearTimeout(lpT); lpT = null; } }, true);
  ["pointerup", "pointercancel"].forEach((t) => document.addEventListener(t, () => { if (lpT) { clearTimeout(lpT); lpT = null; } }, true));
  // The tap that ended a long-press on maximize must not also maximize.
  document.addEventListener("click", (ev) => { if (swallowUntil > Date.now() && maxBtnOf(ev.target)) { swallowUntil = 0; ev.stopPropagation(); ev.preventDefault(); } }, true);
  document.addEventListener("contextmenu", (ev) => { if (maxBtnOf(ev.target)) ev.preventDefault(); }, true);

  // ---- Snap Assist: fill the remaining zones with other open windows ----
  let assist = null;
  function closeAssist() { if (assist) { assist.remove(); assist = null; } }
  function snapAssist(zones, used) {
    closeAssist();
    assistGroupId = null; // a fresh Snap Assist session builds one snap group
    zones = zones.slice(); used = used.slice();
    const candidates = () => wins().filter((x) => onActive(x) && canSnap(x) && !used.includes(x)).sort((a, b) => zOf(b) - zOf(a));
    if (!zones.length || !candidates().length) return;
    const ov = assist = el(`<div class="wx-assist" role="dialog" aria-label="Snap Assist"></div>`);
    ov.style.zIndex = OVERLAY_Z + 100;
    ov.addEventListener("click", (ev) => { if (ev.target === ov) closeAssist(); });
    function render() {
      ov.innerHTML = "";
      const list = candidates();
      if (!zones.length || !list.length) { closeAssist(); return; }
      zones.forEach((z, zi) => {
        const r = fracRect(z);
        const zone = el(`<div class="wx-az ${zi === 0 ? "wx-az-cur" : ""}"></div>`);
        Object.assign(zone.style, { left: r.l + 4 + "px", top: r.t + 4 + "px", width: r.w - 8 + "px", height: r.h - 8 + "px" });
        if (zi === 0) {
          const n = list.length;
          const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * (r.w / Math.max(1, r.h)) * 0.75)) || 1));
          const rows = Math.ceil(n / cols);
          const bw = Math.max(90, Math.min(260, (r.w - 40) / cols - 20)), bh = Math.max(60, Math.min(180, (r.h - 40) / rows - 50));
          const grid = el(`<div class="wx-az-grid"></div>`);
          list.forEach((x) => {
            const card = el(`<button class="wx-card wx-az-card" title="${esc(titleText(x))}"><div class="wx-card-h"><span class="wx-card-ic">${iconHtml(x)}</span><span class="wx-card-t">${esc(titleText(x))}</span></div><div class="wx-card-pv"></div></button>`);
            const pvBox = card.querySelector(".wx-card-pv"); pvBox.style.width = bw + "px"; pvBox.style.height = bh + "px";
            mount(pvBox, makePreview(x, bw, bh));
            card.onclick = (ev) => {
              ev.stopPropagation();
              if (isMin(x) && window.WM) WM.focusWindow(x.win);
              snap(x, z); used.push(x); zones.shift();
              upsertGroup(used); // remember these windows as a snap group
              render();
            };
            grid.appendChild(card);
          });
          zone.appendChild(grid);
        }
        ov.appendChild(zone);
      });
    }
    scr().appendChild(ov);
    render();
    const first = ov.querySelector(".wx-az-card"); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
  }

  // =====================================================================
  //  Alt+Tab
  // =====================================================================
  let at = null; // { el, list, idx, held }
  function atList() { return wins().filter((e) => onActive(e)).sort((a, b) => zOf(b) - zOf(a)); }
  function openAltTab(held, step) {
    closeAll("alttab");
    const list = atList();
    if (!list.length && held) return false;
    const box = el(`<div class="wx-alttab" role="listbox" aria-label="Switch windows"><div class="wx-at-panel"><div class="wx-at-row"></div></div></div>`);
    box.style.zIndex = OVERLAY_Z + 200;
    const row = box.querySelector(".wx-at-row");
    const W = window.innerWidth, n = list.length;
    const bw = Math.max(130, Math.min(240, (W * 0.86) / Math.min(Math.max(n, 1), W < 700 ? 2 : 4) - 30)), bh = Math.round(bw * 0.62);
    if (!n) row.appendChild(el(`<div class="wx-at-empty">No open windows</div>`));
    list.forEach((e, i) => {
      const c = el(`<button class="wx-card wx-at-card" role="option" data-i="${i}"><div class="wx-card-h"><span class="wx-card-ic">${iconHtml(e)}</span><span class="wx-card-t">${esc(titleText(e))}</span>${isMin(e) ? '<span class="wx-card-min">Minimized</span>' : ""}</div><div class="wx-card-pv"></div></button>`);
      const pv = c.querySelector(".wx-card-pv"); pv.style.width = bw + "px"; pv.style.height = bh + "px";
      mount(pv, makePreview(e, bw, bh));
      c.onclick = (ev) => { ev.stopPropagation(); at.idx = i; commitAltTab(); };
      c.onpointerenter = (ev) => { if (ev.pointerType === "mouse" && at && !at.held) { at.idx = i; paintAltTab(); } };
      row.appendChild(c);
    });
    box.addEventListener("click", (ev) => { if (ev.target === box) closeAltTab(); });
    scr().appendChild(box);
    at = { el: box, list, idx: 0, held };
    stepAltTab(step == null ? 1 : step);
    return true;
  }
  function stepAltTab(step) {
    if (!at || !at.list.length) return;
    const n = at.list.length;
    at.idx = ((at.idx + step) % n + n) % n;
    paintAltTab();
  }
  function paintAltTab() {
    if (!at) return;
    at.el.querySelectorAll(".wx-at-card").forEach((c, i) => { const on = i === at.idx; c.classList.toggle("sel", on); c.setAttribute("aria-selected", on ? "true" : "false"); if (on) try { c.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) {} });
  }
  function commitAltTab() {
    if (!at) return;
    const e = at.list[at.idx]; closeAltTab();
    if (e && e.win.isConnected && window.WM) WM.focusWindow(e.win);
  }
  function closeAltTab() { if (at) { at.el.remove(); at = null; } }

  // =====================================================================
  //  Task View
  // =====================================================================
  let tv = null; // { el, shown: deskId, sel }
  const tvOpen = () => !!tv;
  function toggleTaskView() { if (tv) closeTaskView(); else openTaskView(); }
  function openTaskView() {
    if (!desktopReady()) return;
    if (tv) closeTaskView(); // never stack two Task View overlays
    closeAll("tv");
    const ov = el(`<div class="wx-tv" role="dialog" aria-label="Task View">
      <div class="wx-tv-top"><span class="wx-tv-title"></span><button class="wx-tv-x" title="Close Task View (Esc)" aria-label="Close Task View">&times;</button></div>
      <div class="wx-tv-grid"></div>
      <div class="wx-tv-strip" role="list"></div>
    </div>`);
    ov.style.zIndex = OVERLAY_Z;
    ov.querySelector(".wx-tv-x").onclick = closeTaskView;
    ov.addEventListener("click", (ev) => { if (ev.target === ov || ev.target.classList.contains("wx-tv-grid")) closeTaskView(); });
    scr().appendChild(ov);
    const hud = document.querySelector(".wx-desk-hud.show"); if (hud) hud.classList.remove("show");
    tv = { el: ov, shown: activeId(), sel: 0 };
    renderTaskView();
    requestAnimationFrame(() => ov.classList.add("show"));
  }
  function closeTaskView() { if (!tv) return; hideWallPick(); const o = tv.el; tv = null; o.classList.remove("show"); setTimeout(() => o.remove(), reduceMotion() ? 0 : 160); }
  function renderTaskView() {
    if (!tv) return;
    renderTvGrid(tv.shown);
    renderTvStrip();
  }
  function renderTvGrid(deskId) {
    const ov = tv.el, grid = ov.querySelector(".wx-tv-grid");
    const d = deskById(deskId) || deskById(activeId());
    ov.querySelector(".wx-tv-title").textContent = d.name + (d.id === activeId() ? "" : " (preview)");
    grid.innerHTML = "";
    const list = deskWindows(d.id).sort((a, b) => zOf(b) - zOf(a));
    if (!list.length) { grid.appendChild(el(`<div class="wx-tv-empty">No windows open on ${esc(d.name)}</div>`)); return; }
    const W = window.innerWidth, H = window.innerHeight;
    const availW = W * 0.9, availH = Math.max(160, H - 290);
    let best = null;
    for (let cols = 1; cols <= list.length; cols++) {
      const rows = Math.ceil(list.length / cols);
      const bw = Math.min(460, availW / cols - 28), bh = Math.min(bw * 0.62, availH / rows - 52);
      const size = Math.min(bw, bh / 0.62);
      if (!best || size > best.size) best = { size, bw: Math.min(bw, bh / 0.62), bh };
    }
    const bw = Math.max(110, best.bw), bh = Math.max(70, Math.min(best.bh, bw * 0.62));
    list.forEach((e, i) => {
      const card = el(`<div class="wx-card wx-tv-card${i === tv.sel ? " sel" : ""}" tabindex="0" role="button" aria-label="${esc(titleText(e))}">
        <div class="wx-card-h"><span class="wx-card-ic">${iconHtml(e)}</span><span class="wx-card-t">${esc(titleText(e))}</span>${isMin(e) ? '<span class="wx-card-min">Minimized</span>' : ""}<button class="wx-card-x" title="Close" aria-label="Close ${esc(titleText(e))}">&times;</button></div>
        <div class="wx-card-pv"></div></div>`);
      card.__entry = e;
      const pv = card.querySelector(".wx-card-pv"); pv.style.width = bw + "px"; pv.style.height = bh + "px";
      mount(pv, makePreview(e, bw, bh));
      card.querySelector(".wx-card-x").onclick = (ev) => {
        ev.stopPropagation();
        const c = e.win.querySelector(".win-titlebar .ctl-close");
        if (c && !c.disabled) c.click(); else if (e.close) e.close();
        setTimeout(() => { if (tv) renderTaskView(); }, 30);
      };
      wireTvCard(card, e);
      grid.appendChild(card);
    });
  }
  function activateFromTv(e) {
    closeTaskView();
    if (e.desk !== activeId()) switchTo(e.desk);
    if (window.WM) WM.focusWindow(e.win);
  }
  // Tap/click a card to switch to it; drag it onto a desktop to move it there.
  function wireTvCard(card, e) {
    card.style.touchAction = "none";
    card.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); activateFromTv(e); } });
    card.addEventListener("pointerdown", (ev) => {
      if (ev.button || ev.target.closest(".wx-card-x")) return;
      const sx = ev.clientX, sy = ev.clientY; let dragging = false, over = null;
      try { card.setPointerCapture(ev.pointerId); } catch (err) {}
      const move = (m) => {
        const dx = m.clientX - sx, dy = m.clientY - sy;
        if (!dragging && Math.hypot(dx, dy) > 8) {
          dragging = true; const r = card.getBoundingClientRect();
          card.style.transformOrigin = `${sx - r.left}px ${sy - r.top}px`;
          card.classList.add("wx-dragging"); tv.el.classList.add("wx-tv-dragging");
        }
        if (!dragging) return;
        card.style.transform = `translate(${dx}px, ${dy}px) scale(.6)`;
        const hit = document.elementFromPoint(m.clientX, m.clientY);
        const tile = hit && hit.closest && hit.closest(".wx-tv-desk, .wx-tv-new");
        if (tile !== over) { if (over) over.classList.remove("wx-dropzone"); over = tile; if (over) over.classList.add("wx-dropzone"); }
      };
      const up = (u) => {
        card.removeEventListener("pointermove", move); card.removeEventListener("pointerup", up); card.removeEventListener("pointercancel", up);
        if (over) over.classList.remove("wx-dropzone");
        if (!dragging) { if (u.type === "pointerup") activateFromTv(e); return; }
        card.classList.remove("wx-dragging"); card.style.transform = "";
        if (tv) tv.el.classList.remove("wx-tv-dragging");
        if (u.type === "pointerup" && over) {
          const target = over.classList.contains("wx-tv-new") ? addDesktop() : over.dataset.id;
          if (target && target !== e.desk) { moveWindow(e, target); }
        }
        if (tv) renderTaskView();
      };
      card.addEventListener("pointermove", move); card.addEventListener("pointerup", up); card.addEventListener("pointercancel", up);
    });
  }
  function deskMini(id, w, h) {
    const mini = el(`<div class="wx-tv-mini"></div>`);
    mini.style.width = w + "px"; mini.style.height = h + "px";
    mini.style.background = deskWallpaperCss(id); // each desktop's own wallpaper (falls back to global)
    mini.style.backgroundSize = "cover"; mini.style.backgroundPosition = "center";
    const s = scr(); const kx = w / s.clientWidth, ky = h / s.clientHeight;
    deskWindows(id).filter((e) => !isMin(e)).sort((a, b) => zOf(a) - zOf(b)).forEach((e) => {
      const r = e.win.offsetWidth ? curRect(e.win) : (e.win.classList.add("wx-measure"), (() => { const c = curRect(e.win); e.win.classList.remove("wx-measure"); return c; })());
      const b = el(`<div class="wx-tv-miniwin"></div>`);
      Object.assign(b.style, { left: r.l * kx + "px", top: r.t * ky + "px", width: Math.max(4, r.w * kx) + "px", height: Math.max(3, r.h * ky) + "px" });
      mini.appendChild(b);
    });
    return mini;
  }
  function renderTvStrip() {
    const strip = tv.el.querySelector(".wx-tv-strip"); strip.innerHTML = "";
    const d = store(); const many = d.list.length > 1;
    const tw = window.innerWidth < 700 ? 110 : 150, th = Math.round(tw * 0.58);
    d.list.forEach((x, i) => {
      const t = el(`<div class="wx-tv-desk${x.id === d.active ? " on" : ""}" role="listitem" data-id="${esc(x.id)}" tabindex="0" title="Switch to ${esc(x.name)} — double-click the name to rename, drag to reorder">
        <div class="wx-tv-deskbtns"><button class="wx-tv-ren" title="Rename" aria-label="Rename ${esc(x.name)}"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button><button class="wx-tv-bg" title="Change background" aria-label="Change background for ${esc(x.name)}"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.4"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg></button>${many ? `<button class="wx-tv-close" title="Close desktop" aria-label="Close ${esc(x.name)}">&times;</button>` : ""}</div>
        <div class="wx-tv-name">${esc(x.name)}</div></div>`);
      t.insertBefore(deskMini(x.id, tw, th), t.querySelector(".wx-tv-name"));
      t.onclick = (ev) => {
        if (t.__dragged) { t.__dragged = false; return; } // drop that reordered, don't switch
        if (ev.target.closest(".wx-tv-deskbtns") || ev.target.closest("input")) return;
        closeTaskView(); switchTo(x.id);
      };
      t.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target === t) { closeTaskView(); switchTo(x.id); } });
      t.addEventListener("pointerenter", (ev) => { if (ev.pointerType === "mouse" && tv && !tv.el.classList.contains("wx-tv-dragging")) { tv.shown = x.id; renderTvGrid(x.id); } });
      t.querySelector(".wx-tv-ren").onclick = (ev) => { ev.stopPropagation(); startRename(t, x); };
      t.querySelector(".wx-tv-bg").onclick = (ev) => { ev.stopPropagation(); openWallPick(t.querySelector(".wx-tv-bg"), x); };
      t.querySelector(".wx-tv-name").ondblclick = (ev) => { ev.stopPropagation(); startRename(t, x); };
      const cl = t.querySelector(".wx-tv-close");
      if (cl) cl.onclick = (ev) => { ev.stopPropagation(); closeDesktop(x.id); if (tv) { tv.shown = activeId(); renderTaskView(); } };
      wireDeskReorder(t, x);
      strip.appendChild(t);
    });
    const nw = el(`<button class="wx-tv-new" title="New desktop (drop a window here to move it to a new desktop)"><div class="wx-tv-plus" style="width:${tw}px;height:${th}px"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div><div class="wx-tv-name">New desktop</div></button>`);
    nw.onclick = () => { addDesktop(); renderTvStrip(); };
    strip.appendChild(nw);
    strip.onpointerleave = (ev) => { if (ev.pointerType === "mouse" && tv && tv.shown !== activeId() && !tv.el.classList.contains("wx-tv-dragging")) { tv.shown = activeId(); renderTvGrid(tv.shown); } };
  }
  // Drag a desktop tile left/right in the strip to reorder desktops (persisted).
  function reorderDesktops(orderIds) {
    const d = store();
    const map = {}; d.list.forEach((x) => { map[x.id] = x; });
    const next = orderIds.map((id) => map[id]).filter(Boolean);
    d.list.forEach((x) => { if (next.indexOf(x) < 0) next.push(x); });
    if (next.length === d.list.length) { d.list = next; State.save(); applyDesktop(); }
  }
  function wireDeskReorder(tile, x) {
    tile.style.touchAction = "none";
    tile.addEventListener("pointerdown", (ev) => {
      if (ev.button || ev.target.closest(".wx-tv-deskbtns") || ev.target.closest("input")) return;
      const strip = tile.parentNode; const sx = ev.clientX, sy = ev.clientY; let dragging = false;
      try { tile.setPointerCapture(ev.pointerId); } catch (err) {}
      const move = (m) => {
        const dx = m.clientX - sx, dy = m.clientY - sy;
        if (!dragging && Math.hypot(dx, dy) > 10) { dragging = true; tile.classList.add("wx-desk-dragging"); if (tv) tv.el.classList.add("wx-tv-dragging"); }
        if (!dragging) return;
        if (m.cancelable) m.preventDefault();
        tile.style.transform = `translate(${dx}px, ${dy}px)`;
        let target = null;
        [...strip.querySelectorAll(".wx-tv-desk")].forEach((o) => { if (target || o === tile) return; const r = o.getBoundingClientRect(); if (m.clientX < r.left + r.width / 2) target = o; });
        if (target) { if (target !== tile.nextSibling) strip.insertBefore(tile, target); }
        else { const nb = strip.querySelector(".wx-tv-new"); if (nb) strip.insertBefore(tile, nb); else strip.appendChild(tile); }
      };
      const up = () => {
        tile.removeEventListener("pointermove", move); tile.removeEventListener("pointerup", up); tile.removeEventListener("pointercancel", up);
        if (!dragging) return;
        tile.classList.remove("wx-desk-dragging"); tile.style.transform = "";
        if (tv) tv.el.classList.remove("wx-tv-dragging");
        tile.__dragged = true; // swallow the click that follows the drop
        reorderDesktops([...strip.querySelectorAll(".wx-tv-desk")].map((n) => n.dataset.id));
      };
      tile.addEventListener("pointermove", move); tile.addEventListener("pointerup", up); tile.addEventListener("pointercancel", up);
    });
  }

  // Per-desktop "Change background": pick from the built-in wallpapers, a few solid
  // colours, or "Global" (no custom wallpaper → use the system wallpaper).
  const WALL_PRESETS = [
    { wp: "default", label: "Global (system wallpaper)" },
    { wp: "assets/wall1.jpg" }, { wp: "assets/wall2.jpg" }, { wp: "assets/wall3.jpg" },
    { wp: "assets/wall4.jpg" }, { wp: "assets/wall5.jpg" }, { wp: "assets/wall6.jpg" },
    { wp: "#0067c0" }, { wp: "#107c10" }, { wp: "#5c2d91" }, { wp: "#c239b3" }, { wp: "#1f1f1f" },
  ];
  let wallPick = null, wallPickDoc = null;
  function hideWallPick() { if (wallPickDoc) { document.removeEventListener("pointerdown", wallPickDoc, true); wallPickDoc = null; } if (wallPick) { wallPick.remove(); wallPick = null; } }
  function openWallPick(anchor, x) {
    hideWallPick();
    const cur = (deskById(x.id) && deskById(x.id).wallpaper) || "default";
    const p = wallPick = el(`<div class="wx-wallpick" role="menu" aria-label="Change background for ${esc(x.name)}"><div class="wx-wallpick-h">Background · ${esc(x.name)}</div><div class="wx-wallpick-grid"></div></div>`);
    p.style.zIndex = OVERLAY_Z + 500;
    const grid = p.querySelector(".wx-wallpick-grid");
    WALL_PRESETS.forEach((opt) => {
      const on = cur === opt.wp || (opt.wp === "default" && cur === "default");
      const sw = el(`<button class="wx-wallsw${on ? " on" : ""}" role="menuitemradio" aria-checked="${on}" title="${esc(opt.label || opt.wp)}" aria-label="${esc(opt.label || opt.wp)}"></button>`);
      if (opt.wp === "default") { sw.classList.add("wx-wall-default"); sw.textContent = "Global"; }
      else if (isImgWp(opt.wp)) sw.style.background = `url(${opt.wp}) center/cover`;
      else sw.style.background = opt.wp;
      sw.onclick = (ev) => { ev.stopPropagation(); setDeskWallpaper(x.id, opt.wp); hideWallPick(); if (tv) renderTvStrip(); };
      grid.appendChild(sw);
    });
    scr().appendChild(p);
    const r = anchor.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
    let left = r.left + r.width / 2 - pw / 2; left = Math.max(8, Math.min(window.innerWidth - pw - 8, left));
    let top = r.bottom + 6; if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    p.style.left = left + "px"; p.style.top = top + "px";
    wallPickDoc = (ev) => { if (wallPick && !wallPick.contains(ev.target) && !anchor.contains(ev.target)) hideWallPick(); };
    setTimeout(() => document.addEventListener("pointerdown", wallPickDoc, true), 0);
  }

  function startRename(tile, x) {
    const nm = tile.querySelector(".wx-tv-name");
    const inp = el(`<input class="wx-tv-input" maxlength="40" aria-label="Desktop name">`); inp.value = x.name;
    nm.replaceWith(inp); inp.focus(); inp.select();
    let done = false;
    const finish = (save) => { if (done) return; done = true; if (save) renameDesktop(x.id, inp.value); if (tv) renderTaskView(); };
    inp.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") finish(true); if (ev.key === "Escape") finish(false); });
    inp.addEventListener("blur", () => finish(true));
    inp.addEventListener("click", (ev) => ev.stopPropagation());
  }
  function tvMoveSel(step) {
    if (!tv) return;
    const cards = [...tv.el.querySelectorAll(".wx-tv-card")]; if (!cards.length) return;
    tv.sel = ((tv.sel + step) % cards.length + cards.length) % cards.length;
    cards.forEach((c, i) => c.classList.toggle("sel", i === tv.sel));
    try { cards[tv.sel].focus({ preventScroll: false }); } catch (e) {}
  }

  function closeAll(except) {
    if (except !== "alttab") closeAltTab();
    if (except !== "tv") closeTaskView();
    hideFly(); closeAssist(); hideGrpFly(); hideWallPick();
    document.querySelectorAll(".jumplist").forEach((m) => m.remove());
  }

  // =====================================================================
  //  Keyboard
  // =====================================================================
  window.addEventListener("keydown", (e) => {
    if (!desktopReady()) return;
    const k = e.key;
    const own = () => { e.preventDefault(); e.stopPropagation(); };
    // Alt+Tab / Shift+Alt+Tab (held), Ctrl+Alt+Tab (stays open)
    if (k === "Tab" && e.altKey && !e.metaKey) {
      own();
      if (at) stepAltTab(e.shiftKey ? -1 : 1);
      else openAltTab(!e.ctrlKey, e.shiftKey ? -1 : 1);
      return;
    }
    if (at) {
      if (k === "Escape") { own(); closeAltTab(); return; }
      if (k === "Enter" || k === " ") { own(); commitAltTab(); return; }
      if (k === "ArrowRight" || k === "ArrowDown" || (k === "Tab" && !e.shiftKey)) { own(); stepAltTab(1); return; }
      if (k === "ArrowLeft" || k === "ArrowUp" || (k === "Tab" && e.shiftKey)) { own(); stepAltTab(-1); return; }
      if (k === "Alt" || k === "Shift" || k === "Control") return;
      if (!at.held) { own(); return; } // swallow stray keys while the persistent switcher is up
    }
    // Task View: Win+Tab, Ctrl+Alt+Up (Ctrl+Alt+Down closes)
    if ((k === "Tab" && e.metaKey) || (e.ctrlKey && e.altKey && k === "ArrowUp")) { own(); toggleTaskView(); return; }
    if (tv && e.ctrlKey && e.altKey && k === "ArrowDown") { own(); closeTaskView(); return; }
    // Keyboard window snapping (halves / thirds / two-thirds / quarters): Win+Arrow,
    // or Ctrl+Alt+Shift+Arrow as the no-Win-key alternative. Not while a switcher /
    // Task View is up (arrows drive those). See the SNAP SCHEME comment above.
    if (!tv && !at && (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown")) {
      const winCombo = e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
      const altCombo = e.ctrlKey && e.altKey && e.shiftKey && !e.metaKey;
      if (winCombo || altCombo) { const ent = focusedEntry(); if (ent) { own(); kbSnap(ent, k); return; } }
    }
    // Switch desktops: Ctrl+Alt+Left/Right, Ctrl+Win+Left/Right (Shift is reserved for snapping)
    if (e.ctrlKey && (e.altKey || e.metaKey) && !e.shiftKey && (k === "ArrowLeft" || k === "ArrowRight")) {
      own(); const wasTv = !!tv; closeTaskView(); switchRelative(k === "ArrowLeft" ? -1 : 1); if (wasTv) openTaskView(); return;
    }
    if (tv) {
      if (e.target && e.target.classList && e.target.classList.contains("wx-tv-input")) return;
      if (k === "Escape") { own(); closeTaskView(); return; }
      if (k === "ArrowRight" || k === "ArrowDown") { own(); tvMoveSel(1); return; }
      if (k === "ArrowLeft" || k === "ArrowUp") { own(); tvMoveSel(-1); return; }
      if (k === "Enter" && !(e.target && e.target.closest && e.target.closest(".wx-tv-desk, .wx-tv-new, button"))) { const c = tv.el.querySelectorAll(".wx-tv-card")[tv.sel]; if (c) { own(); activateFromTv(c.__entry); } return; }
    }
    if ((assist || fly) && k === "Escape") { own(); closeAssist(); hideFly(); }
  }, true);
  window.addEventListener("keyup", (e) => {
    if (at && at.held && (e.key === "Alt" || !e.altKey)) { e.preventDefault(); e.stopPropagation(); commitAltTab(); }
  }, true);
  window.addEventListener("blur", () => { if (at && at.held) closeAltTab(); });

  window.WinX = {
    // used by the window manager
    activeId, onActive, switchTo, unsnap, dragStart, dragMove, dragEnd, toggleTaskView,
    // public helpers
    openTaskView, closeTaskView, openAltTab: (persistent) => openAltTab(!persistent, 1), closeAltTab,
    snap: (entry, zone) => snap(entry, Array.isArray(zone) ? zone : Z[zone]),
    layouts: LAYOUTS, zones: Z, showSnapLayouts: (win) => { const b = win && win.querySelector(".ctl-max"); if (b) showFly(b); },
    desktops: () => JSON.parse(JSON.stringify(store())),
    addDesktop, closeDesktop, renameDesktop, moveWindow, switchRelative, applyDesktop,
    // desktop reorder + per-desktop wallpaper (Task View)
    reorderDesktops: (ids) => reorderDesktops(ids), setDeskWallpaper: (id, wp) => setDeskWallpaper(id, wp),
    // snap groups + keyboard snapping
    snapGroups: () => JSON.parse(JSON.stringify(pruneGroups())),
    restoreSnapGroup: (id) => { const g = groupStore().find((x) => x.id === id); if (g) restoreGroup(g); },
    kbSnap: (entry, key) => kbSnap(entry, key),
  };
  // Apply saved desktops once the taskbar exists.
  const boot = setInterval(() => { if (document.querySelector(".taskbar .wx-tv-btn")) { clearInterval(boot); applyDesktop(); } }, 500);
})();
