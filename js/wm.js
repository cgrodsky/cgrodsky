/* Window manager, desktop, taskbar, start menu, on-screen keyboard, notifications. */
(function () {
  "use strict";

  const screen = () => document.getElementById("screen");
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;

  let desktop, taskbar, startMenu;
  let zCounter = 200;
  const openWindows = []; // {id, win, taskBtn, appId, title}

  // App launchers registered by apps.js / games.js / browser.js
  const AppRegistry = {};
  window.AppRegistry = AppRegistry;

  // Duolingo icon depends on the current subscription tier.
  function duoIconKey(forApp) {
    const tier = (S().appData && S().appData.duolingo && S().appData.duolingo.tier) || "free";
    if (tier === "max") return "duolingo_max";
    if (tier === "super") return "duolingo_super";
    return forApp ? "duolingo_app" : "duolingo";
  }

  // ---------------- Window manager ----------------
  function createWindow(opts) {
    opts = opts || {};
    const w = opts.width || 720, h = opts.height || 480;
    const left = opts.left != null ? opts.left : Math.max(20, (window.innerWidth - w) / 2 + (openWindows.length % 5) * 28 - 60);
    const top = opts.top != null ? opts.top : Math.max(20, (window.innerHeight - h) / 2 + (openWindows.length % 5) * 24 - 80);

    const win = el(`<div class="win" style="width:${w}px;height:${h}px;left:${left}px;top:${top}px">
      <div class="win-titlebar">
        <div class="title">${opts.icon ? `<span>${opts.icon}</span>` : ""}<span class="t-text">${opts.title || ""}</span></div>
        <div class="win-controls">
          <button class="min ctl ctl-min" title="Minimize"></button>
          <button class="max ctl ctl-max" title="Maximize"></button>
          <button class="close ctl ctl-close" title="Close"></button>
        </div>
      </div>
      <div class="win-body"></div>
    </div>`);
    const body = win.querySelector(".win-body");
    const controls = win.querySelector(".win-controls");
    if (opts.noMin) controls.querySelector(".min").disabled = true;
    if (opts.noMax) controls.querySelector(".max").disabled = true;
    if (opts.noClose) controls.querySelector(".close").disabled = true;

    win.style.zIndex = ++zCounter;
    win.addEventListener("mousedown", () => focusWindow(win));

    // drag
    const tb = win.querySelector(".win-titlebar");
    let dragging = false, sx, sy, sl, st;
    tb.addEventListener("mousedown", (e) => {
      if (e.target.closest(".win-controls")) return;
      if (win.classList.contains("maximized")) return;
      dragging = true; sx = e.clientX; sy = e.clientY; sl = win.offsetLeft; st = win.offsetTop;
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      win.style.left = Math.max(0, sl + e.clientX - sx) + "px";
      win.style.top = Math.max(0, st + e.clientY - sy) + "px";
    });
    window.addEventListener("mouseup", () => { dragging = false; });

    const entry = { id: "w" + (++zCounter), win, appId: opts.appId, title: opts.title || "", icon: opts.icon };

    function close() {
      const idx = openWindows.indexOf(entry);
      if (idx >= 0) openWindows.splice(idx, 1);
      if (entry.taskBtn && entry.taskBtn.parentNode && !entry.pinned) entry.taskBtn.remove();
      win.remove();
      if (opts.onClose) opts.onClose();
      refreshTaskbarActive();
    }
    entry.close = close;
    controls.querySelector(".close").onclick = () => { if (!opts.noClose) close(); };
    controls.querySelector(".min").onclick = () => { if (opts.noMin) return; win.style.display = "none"; refreshTaskbarActive(); };
    let maximized = false, prev;
    controls.querySelector(".max").onclick = () => {
      if (opts.noMax) return;
      maximized = !maximized;
      controls.querySelector(".max").title = maximized ? "Restore down" : "Maximize";
      if (maximized) {
        prev = { l: win.style.left, t: win.style.top, w: win.style.width, h: win.style.height };
        win.classList.add("maximized");
        win.style.left = "0"; win.style.top = "0"; win.style.width = "100%"; win.style.height = "calc(100% - 48px)";
      } else {
        win.classList.remove("maximized");
        Object.assign(win.style, { left: prev.l, top: prev.t, width: prev.w, height: prev.h });
      }
    };

    screen().appendChild(win);
    openWindows.push(entry);
    addTaskButton(entry);
    focusWindow(win);
    return { win, body, close, focus: () => focusWindow(win) };
  }

  function focusWindow(win) {
    win.style.zIndex = ++zCounter;
    win.style.display = "";
    refreshTaskbarActive();
  }

  // ---------------- Desktop ----------------
  const DEFAULT_SHORTCUTS = [
    { id: "edge", name: "Microsoft Edge" },
    { id: "chrome", name: "Chrome" },
    { id: "store__", name: "Store" },
    { id: "youtubeApp", name: "YouTube" },
    { id: "copilot", name: "Copilot" },
    { id: "settings", name: "Settings" },
    { id: "calculator", name: "Calculator" },
    { id: "mclauncher", name: "Minecraft" },
    { id: "xbox", name: "Xbox" },
    { id: "messenger", name: "Messenger" },
    { id: "word", name: "Word" },
    { id: "powerpoint", name: "PowerPoint" },
    { id: "excel", name: "Excel" },
    { id: "forms", name: "Forms" },
    { id: "canva", name: "Canva" },
  ];

  function xpOn() { return !!(S().desktop && S().desktop.xpTheme); }
  function hiddenIcons() { return (S().desktop && S().desktop.hiddenIcons) || []; }
  function binItems() { if (!S().desktop.bin) S().desktop.bin = []; return S().desktop.bin; }
  function removeFromDesktop(id, name) {
    if (!S().desktop.hiddenIcons) S().desktop.hiddenIcons = [];
    if (!S().desktop.hiddenIcons.includes(id)) S().desktop.hiddenIcons.push(id);
    const bin = binItems();
    if (!bin.some((b) => b.id === id)) bin.push({ id, name: name || id });
    const i = S().installedApps.indexOf(id); if (i >= 0) S().installedApps.splice(i, 1); // uninstall Store apps
    State.save();
    renderDesktopIcons();
    if (window.Notify) Notify.show({ icon: Icon.mini("recyclebin", "Recycle Bin"), title: "Recycle Bin", body: (name || "Item") + " moved to Recycle Bin", onClick: () => open("recyclebin") });
  }
  function restoreFromBin(id) {
    const h = S().desktop.hiddenIcons || []; const hi = h.indexOf(id); if (hi >= 0) h.splice(hi, 1);
    S().desktop.bin = binItems().filter((b) => b.id !== id);
    // Re-install store apps that aren't default shortcuts.
    const isDefault = DEFAULT_SHORTCUTS.some((s) => s.id === id);
    const app = Catalog.storeApps.find((a) => a.id === id);
    if (app && !isDefault && !S().installedApps.includes(id)) S().installedApps.push(id);
    State.save();
    renderDesktopIcons();
  }

  AppRegistry.recyclebin = function () {
    const { body } = createWindow({ title: "Recycle Bin", icon: Icon.mini("recyclebin", "Recycle Bin"), width: 520, height: 420, appId: "recyclebin" });
    function render() {
      const items = binItems();
      body.innerHTML = `<div class="rbin">
        <div class="rbin-bar"><b>Recycle Bin</b><span class="grow"></span><button class="pill-btn" id="empty" ${items.length ? "" : "disabled"}>Empty Recycle Bin</button></div>
        <div class="rbin-list"></div>
      </div>`;
      const list = body.querySelector(".rbin-list");
      if (!items.length) { list.innerHTML = `<div class="muted" style="padding:24px;text-align:center">Recycle Bin is empty.</div>`; }
      items.forEach((it) => {
        const ikey = it.id === "duolingo" ? duoIconKey(true) : it.id;
        const row = el(`<div class="rbin-row"><span class="rbin-ic">${Icon.md(ikey, it.name)}</span><span class="grow">${it.name}</span><button class="btn-text rbin-restore">Restore</button></div>`);
        row.querySelector(".rbin-restore").onclick = () => { restoreFromBin(it.id); render(); };
        list.appendChild(row);
      });
      body.querySelector("#empty").onclick = () => { S().desktop.bin = []; State.save(); render(); renderDesktopIcons(); };
    }
    render();
  };

  // -------- Desktop App Groups (folders that live on the Home Screen) --------
  function deskGroups() {
    if (!S().desktop) S().desktop = {};
    if (!S().desktop.groups) {
      // Seed the Home Screen with the previous Start-menu groups so App Groups
      // now live on the desktop instead of the search bar.
      const src = (S().appData && S().appData.appGroups) || [
        { name: "Office", apps: ["word", "powerpoint", "excel", "outlook", "onenote", "forms", "notepad"] },
        { name: "Essentials", apps: ["settings", "fileexplorer", "calculator", "copilot"] },
      ];
      S().desktop.groups = src.map((g, i) => ({ id: "grp" + i + "_" + Math.abs(hashStr(g.name)), name: g.name, apps: g.apps.slice() }));
      State.save();
    }
    return S().desktop.groups;
  }
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function groupedIds() { const set = new Set(); deskGroups().forEach((g) => g.apps.forEach((id) => set.add(id))); return set; }
  function deskDupes() { if (!S().desktop.dupes) S().desktop.dupes = []; return S().desktop.dupes; }
  function newGid() { return "grp_" + Math.abs(hashStr(deskGroups().map((g) => g.id).join("") + deskGroups().length + Object.keys(S().installedApps || {}).length)); }

  // Current multi-selection on the desktop, keyed by icon "key"
  // (app id, "dup:"+uid, or "grp:"+gid).
  let deskSel = new Set();
  let sysClipboard = [];   // desktop copy/paste clipboard (keys)
  function clearDeskSel() { deskSel.clear(); if (desktop) { desktop.querySelectorAll(".dicon.selected").forEach((x) => x.classList.remove("selected")); desktop.querySelectorAll(".desk-appgroup.sel").forEach((x) => x.classList.remove("sel")); } }

  function groupBoxMenu(g, anchor) {
    document.querySelectorAll(".desk-ctx").forEach((m) => m.remove());
    const menu = el(`<div class="desk-ctx"></div>`);
    const add = (label, fn, cls) => { const b = el(`<button class="${cls || ""}">${label}</button>`); b.onclick = () => { menu.remove(); fn(); }; menu.appendChild(b); };
    add("Rename group", () => { const nm = promptName("Rename group", g.name); if (nm) { g.name = nm; State.save(); renderDesktopIcons(); } });
    add("Ungroup", () => { const gs = deskGroups(); const i = gs.findIndex((x) => x.id === g.id); if (i >= 0) gs.splice(i, 1); State.save(); clearDeskSel(); renderDesktopIcons(); });
    add("Delete group", () => { const gs = deskGroups(); const i = gs.findIndex((x) => x.id === g.id); if (i >= 0) gs.splice(i, 1); State.save(); clearDeskSel(); renderDesktopIcons(); }, "danger");
    screen().appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 10) + "px";
    menu.style.top = Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 10) + "px";
    setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", h); } }), 0);
  }

  function dagGripSvg() { return `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="8" cy="6" r="1.6"/><circle cx="16" cy="6" r="1.6"/><circle cx="8" cy="12" r="1.6"/><circle cx="16" cy="12" r="1.6"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/></svg>`; }
  // Make an App Group box selectable, draggable (by its header), and menu-able.
  function wireGroupBox(box, g, key) {
    const head = box.querySelector(".dag-head");
    let sx = 0, sy = 0, moved = false, dragging = false, ox = 0, oy = 0;
    const onMove = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - sx, dy = pt.clientY - sy;
      if (!dragging && Math.hypot(dx, dy) > 5) { dragging = true; moved = true; box.classList.add("dragging"); }
      if (dragging) {
        if (e.cancelable) e.preventDefault();
        let nx = ox + dx, ny = oy + dy;
        const maxX = (desktop.clientWidth) - box.offsetWidth - 4, maxY = (desktop.clientHeight) - box.offsetHeight - 4;
        nx = Math.max(4, Math.min(maxX, nx)); ny = Math.max(4, Math.min(maxY, ny));
        box.style.left = nx + "px"; box.style.top = ny + "px"; box.style.right = "auto";
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp);
      box.classList.remove("dragging");
      if (dragging) { g.pos = { x: parseInt(box.style.left, 10) || 0, y: parseInt(box.style.top, 10) || 0 }; State.save(); }
      dragging = false;
    };
    const onDown = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      const r = box.getBoundingClientRect(), dr = desktop.getBoundingClientRect();
      ox = r.left - dr.left; oy = r.top - dr.top; sx = pt.clientX; sy = pt.clientY; moved = false; dragging = false;
      window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", onUp);
    };
    head.addEventListener("mousedown", onDown);
    head.addEventListener("touchstart", onDown, { passive: true });
    head.onclick = (e) => { e.stopPropagation(); if (moved) { moved = false; return; } if (deskSel.has(key)) { groupBoxMenu(g, head); } else { clearDeskSel(); deskSel.add(key); box.classList.add("sel"); } };
    head.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); groupBoxMenu(g, head); };
  }

  // Right-click on empty desktop — Windows 12 style context menu.
  function desktopContextMenu(e) {
    document.querySelectorAll(".desk-ctx, .desk-submenu").forEach((m) => m.remove());
    const menu = el(`<div class="desk-ctx desk-rightclick"></div>`);
    const iconRow = (icon, label, arrow) => `<span class="dctx-ic">${icon}</span><span class="dctx-lbl">${label}</span>${arrow ? '<span class="dctx-arrow">&rsaquo;</span>' : ""}`;
    const ICN = {
      view: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
      sort: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 4v16l-3-3M17 20V4l3 3"/></svg>`,
      add: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`,
      group: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/></svg>`,
      refresh: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4v6h6"/><path d="M20 12a8 8 0 1 0-2.3 5.6"/></svg>`,
      brush: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4l5 5-9 9H6v-5z"/><path d="M13 6l5 5"/></svg>`,
      display: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M9 21h6"/></svg>`,
    };
    const mkItem = (html, fn, arrow) => { const b = el(`<button>${html}</button>`); if (fn) b.onclick = () => { menu.remove(); fn(); }; if (arrow) b.classList.add("has-sub"); return b; };
    // View — icon size
    const viewBtn = mkItem(iconRow(ICN.view, "View", true), null, true);
    viewBtn.onmouseenter = () => openSub(viewBtn, [
      ["Large icons", () => setIconSize("lg")], ["Medium icons", () => setIconSize("md")], ["Small icons", () => setIconSize("sm")],
    ]);
    menu.appendChild(viewBtn);
    // Sort by
    const sortBtn = mkItem(iconRow(ICN.sort, "Sort by", true), null, true);
    sortBtn.onmouseenter = () => openSub(sortBtn, [
      ["Name", () => sortIcons("name")], ["Type", () => sortIcons("type")],
    ]);
    menu.appendChild(sortBtn);
    // New
    const newBtn = mkItem(iconRow(ICN.add, "New", true), null, true);
    newBtn.onmouseenter = () => openSub(newBtn, [
      ["App group", () => { const apps = [...deskSel].map((k) => keyToApp(k)).filter(Boolean).map((a) => a.id); const nm = promptName("New App Group", "New Group"); if (nm) { deskGroups().push({ id: newGid(), name: nm, apps: apps }); State.save(); clearDeskSel(); renderDesktopIcons(); } }],
    ]);
    menu.appendChild(newBtn);
    menu.appendChild(mkItem(iconRow(ICN.group, "Add to app group"), () => { if (deskSel.size) makeGroupFromSelection(); else Notify.show({ icon: "", title: "App groups", body: "Select icons first, then add them to a group." }); }));
    const pasteBtn = mkItem(iconRow(`<img class="dctx-cp" src="assets/sys_paste.png?v=1" alt="">`, "Paste"), () => {
      if (!sysClipboard.length) { Notify.show({ icon: "", title: "Paste", body: "Nothing to paste. Right-click an icon and choose Copy first." }); return; }
      duplicateDesk(sysClipboard);
      Notify.show({ icon: "", title: "Pasted", body: sysClipboard.length + " item" + (sysClipboard.length > 1 ? "s" : "") + " pasted to the desktop." });
    });
    if (!sysClipboard.length) pasteBtn.classList.add("dctx-dim");
    menu.appendChild(pasteBtn);
    menu.appendChild(mkItem(iconRow(ICN.refresh, "Refresh"), () => renderDesktopIcons()));
    menu.appendChild(el(`<div class="dctx-sep"></div>`));
    menu.appendChild(mkItem(iconRow(ICN.brush, "Personalize"), () => open("settings")));
    menu.appendChild(mkItem(iconRow(ICN.display, "Display settings"), () => open("settings")));
    function openSub(anchor, items) {
      document.querySelectorAll(".desk-submenu").forEach((m) => m.remove());
      const sub = el(`<div class="desk-ctx desk-submenu"></div>`);
      items.forEach(([label, fn]) => { const b = el(`<button>${label}</button>`); b.onclick = () => { menu.remove(); sub.remove(); fn(); }; sub.appendChild(b); });
      screen().appendChild(sub);
      const r = anchor.getBoundingClientRect();
      let left = r.right + 2; if (left + 180 > window.innerWidth) left = r.left - 182;
      sub.style.left = left + "px"; sub.style.top = Math.min(r.top, window.innerHeight - sub.offsetHeight - 10) + "px";
    }
    menu.querySelectorAll("button:not(.has-sub)").forEach((b) => b.addEventListener("mouseenter", () => document.querySelectorAll(".desk-submenu").forEach((m) => m.remove())));
    screen().appendChild(menu);
    menu.style.left = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 10) + "px";
    menu.style.top = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 10) + "px";
    setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!menu.contains(ev.target) && !ev.target.closest(".desk-submenu")) { menu.remove(); document.querySelectorAll(".desk-submenu").forEach((m) => m.remove()); document.removeEventListener("mousedown", h); } }), 0);
  }
  function setIconSize(sz) { if (!S().desktop) S().desktop = {}; S().desktop.iconSize = sz; State.save(); desktop.classList.remove("icons-sm", "icons-md", "icons-lg"); desktop.classList.add("icons-" + sz); }
  function sortIcons(by) {
    // Sort loose shortcuts by name or type (persisted order).
    if (!S().desktop) S().desktop = {};
    S().desktop.sortBy = by; State.save(); renderDesktopIcons();
  }

  function renderDesktopIcons() {
    const iconWrap = desktop.querySelector(".desktop-icons");
    iconWrap.innerHTML = "";
    const seen = new Set();
    const hidden = hiddenIcons();
    const inGroup = groupedIds();
    const items = DEFAULT_SHORTCUTS.slice();
    S().installedApps.forEach((id) => {
      if (DEFAULT_SHORTCUTS.some((s) => s.id === id)) return;
      const app = Catalog.storeApps.find((a) => a.id === id);
      if (app) items.push({ id: app.id, name: app.name });
    });
    const sortBy = S().desktop && S().desktop.sortBy;
    if (sortBy === "name") items.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "type") items.sort((a, b) => { const ca = (Catalog.storeApps.find((x) => x.id === a.id) || {}).cat || ""; const cb = (Catalog.storeApps.find((x) => x.id === b.id) || {}).cat || ""; return ca.localeCompare(cb) || a.name.localeCompare(b.name); });

    // Recycle Bin is always first and is the drop target. Show the empty-bin art
    // when nothing's in it, the full bin (paper poking out) when it holds items.
    const binKey = binItems().length ? "recyclebin" : "recyclebin_empty";
    const bin = el(`<div class="dicon dbin" data-bin="1"><div class="glyph">${Icon.big(binKey, "Recycle Bin")}</div><div class="label">Recycle Bin</div></div>`);
    bin.onclick = (e) => { e.stopPropagation(); if (bin.classList.contains("selected")) { open("recyclebin"); return; } clearDeskSel(); bin.classList.add("selected"); };
    iconWrap.appendChild(bin);

    // App Groups render as free-floating translucent containers, docked to the
    // right of the screen by default and draggable anywhere.
    let dockTop = 24;
    desktop.querySelectorAll(".desk-appgroup").forEach((x) => x.remove());
    deskGroups().forEach((g, gi) => {
      const key = "grp:" + g.id;
      const box = el(`<div class="desk-appgroup ${deskSel.has(key) ? "sel" : ""}" data-key="${key}">
        <div class="dag-head"><span class="dag-grip">${dagGripSvg()}</span><span class="dag-name">${escAttr(g.name)}</span></div>
        <div class="dag-tiles"></div>
      </div>`);
      const tw = box.querySelector(".dag-tiles");
      g.apps.forEach((id) => {
        const a = Catalog.storeApps.find((x) => x.id === id);
        const nm = a ? a.name : id;
        const ik = id === "duolingo" ? duoIconKey(true) : id;
        const t = el(`<div class="dag-tile"><div class="dag-ic">${Icon.big(ik, nm)}</div><div class="dag-lbl">${escAttr(nm)}</div></div>`);
        t.onclick = (e) => { e.stopPropagation(); open(id); };
        tw.appendChild(t);
      });
      // Position: saved pos, else dock to the right, stacked.
      if (g.pos) { box.style.left = g.pos.x + "px"; box.style.top = g.pos.y + "px"; }
      else { box.style.right = "24px"; box.style.top = dockTop + "px"; }
      desktop.appendChild(box);
      if (!g.pos) dockTop += box.offsetHeight + 16;
      wireGroupBox(box, g, key);
    });

    // App shortcuts (skip hidden and grouped).
    items.forEach((s) => {
      if (seen.has(s.id) || hidden.includes(s.id) || inGroup.has(s.id)) return; seen.add(s.id);
      const ikey = s.id === "duolingo" ? duoIconKey(true) : s.id;
      const ic = el(`<div class="dicon" data-key="${s.id}"><div class="glyph">${Icon.big(ikey, s.name)}</div><div class="label">${escAttr(s.name)}</div></div>`);
      makeDesktopIcon(ic, { key: s.id, kind: "app", id: s.id, name: s.name }, iconWrap, bin);
      iconWrap.appendChild(ic);
      if (deskSel.has(s.id)) ic.classList.add("selected");
    });

    // Duplicated shortcuts (from Copy / Duplicate).
    deskDupes().forEach((d) => {
      if (inGroup.has(d.id)) return;
      const key = "dup:" + d.uid;
      const ikey = d.id === "duolingo" ? duoIconKey(true) : d.id;
      const ic = el(`<div class="dicon" data-key="${key}"><div class="glyph">${Icon.big(ikey, d.name)}</div><div class="label">${escAttr(d.name)}</div></div>`);
      makeDesktopIcon(ic, { key, kind: "dup", id: d.id, uid: d.uid, name: d.name }, iconWrap, bin);
      iconWrap.appendChild(ic);
      if (deskSel.has(key)) ic.classList.add("selected");
    });
  }
  function escAttr(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // Pointer-based select / menu / drag-to-bin (works with mouse and touch).
  function makeDesktopIcon(ic, s, iconWrap, bin) {
    let startX = 0, startY = 0, dragging = false, ghost = null;
    const onMove = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - startX, dy = pt.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > 8) {
        dragging = true;
        ghost = ic.cloneNode(true); ghost.classList.add("dicon-ghost"); document.getElementById("screen").appendChild(ghost);
        ic.classList.add("dragging");
      }
      if (dragging) {
        e.preventDefault();
        ghost.style.left = pt.clientX + "px"; ghost.style.top = pt.clientY + "px";
        const overBin = bin.getBoundingClientRect();
        const on = pt.clientX >= overBin.left && pt.clientX <= overBin.right && pt.clientY >= overBin.top && pt.clientY <= overBin.bottom;
        bin.classList.toggle("drop-hover", on);
      }
    };
    const onUp = (e) => {
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp);
      if (dragging) {
        const pt = e.changedTouches ? e.changedTouches[0] : e;
        const r = bin.getBoundingClientRect();
        const on = pt.clientX >= r.left && pt.clientX <= r.right && pt.clientY >= r.top && pt.clientY <= r.bottom;
        if (ghost) ghost.remove();
        ic.classList.remove("dragging"); bin.classList.remove("drop-hover");
        if (on) deleteDeskItem(s);
      } else {
        // Tap: first tap selects (blue); tapping the blue icon opens the dropdown.
        if (deskSel.has(s.key) && deskSel.size <= 1) { deskIconMenu(s, ic); }
        else { clearDeskSel(); deskSel.add(s.key); ic.classList.add("selected"); }
      }
      dragging = false;
    };
    const onDown = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX; startY = pt.clientY; dragging = false;
      window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false }); window.addEventListener("touchend", onUp);
    };
    ic.addEventListener("mousedown", onDown);
    ic.addEventListener("touchstart", onDown, { passive: true });
    ic.addEventListener("contextmenu", (e) => { e.preventDefault(); if (!deskSel.has(s.key)) { clearDeskSel(); deskSel.add(s.key); ic.classList.add("selected"); } deskIconMenu(s, ic); });
  }

  function launchDeskItem(s) { if (s.kind === "group") openDeskGroup(s.group); else open(s.id); }
  function deleteDeskItem(s) {
    if (s.kind === "group") { const gs = deskGroups(); const i = gs.findIndex((g) => g.id === s.group.id); if (i >= 0) gs.splice(i, 1); State.save(); renderDesktopIcons(); }
    else if (s.kind === "dup") { S().desktop.dupes = deskDupes().filter((d) => d.uid !== s.uid); State.save(); renderDesktopIcons(); }
    else removeFromDesktop(s.id, s.name);
  }

  // The blue-icon dropdown (flat, no arrows / submenus).
  function deskIconMenu(s, anchor) {
    document.querySelectorAll(".desk-ctx").forEach((m) => m.remove());
    const selKeys = [...deskSel];
    const multi = selKeys.length > 1;
    const menu = el(`<div class="desk-ctx"></div>`);
    const add = (label, fn, cls) => { const b = el(`<button class="${cls || ""}">${label}</button>`); b.onclick = () => { menu.remove(); fn(); }; menu.appendChild(b); };

    if (!multi) {
      add("Open", () => launchDeskItem(s));
      if (s.kind === "group") {
        add("Rename", () => { const nm = promptName("Rename group", s.group.name); if (nm) { s.group.name = nm; State.save(); renderDesktopIcons(); } });
        add("Ungroup", () => { const gs = deskGroups(); const i = gs.findIndex((g) => g.id === s.group.id); if (i >= 0) gs.splice(i, 1); State.save(); clearDeskSel(); renderDesktopIcons(); });
      } else {
        add(`<img class="dctx-cp" src="assets/sys_cut.png?v=1" alt=""> Cut`, () => { sysClipboard = [...deskSel]; const n = selKeys.length; deleteSelection(); if (window.Notify) Notify.show({ icon: "", title: "Cut", body: n + " item" + (n > 1 ? "s" : "") + " cut. Right-click the desktop to paste." }); });
        add(`<img class="dctx-cp" src="assets/sys_copy.png?v=1" alt=""> Copy`, () => { sysClipboard = [...deskSel]; if (window.Notify) Notify.show({ icon: "", title: "Copied", body: selKeys.length + " item" + (selKeys.length > 1 ? "s" : "") + " copied. Right-click the desktop to paste." }); });
        add("Duplicate", () => duplicateDesk([s.key]));
        if (window.Icon && Icon.pickIcon) add("Change icon…", () => Icon.pickIcon(s.id, s.name, () => renderDesktopIcons()));
      }
    }
    // "App Group" — the headline action: fold the whole selection into a folder.
    if (s.kind !== "group") add(multi ? "App Group (" + selKeys.length + ")" : "App Group", () => makeGroupFromSelection());
    add(multi ? "Delete (" + selKeys.length + ")" : "Delete", () => { deleteSelection(); }, "danger");

    screen().appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 10) + "px";
    menu.style.top = Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 10) + "px";
    setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", h); } }), 0);
  }

  function keyToApp(key) {
    if (key.startsWith("grp:")) return null;
    if (key.startsWith("dup:")) { const d = deskDupes().find((x) => "dup:" + x.uid === key); return d ? { id: d.id, name: d.name, dupUid: d.uid } : null; }
    const s = DEFAULT_SHORTCUTS.find((x) => x.id === key) || Catalog.storeApps.find((x) => x.id === key);
    return s ? { id: key, name: s.name } : { id: key, name: key };
  }
  function duplicateDesk(keys) {
    keys.forEach((k) => { const a = keyToApp(k); if (a) deskDupes().push({ uid: "d" + Math.abs(hashStr(k + deskDupes().length + a.id)) + deskDupes().length, id: a.id, name: a.name }); });
    State.save(); renderDesktopIcons();
  }
  function deleteSelection() {
    [...deskSel].forEach((k) => {
      if (k.startsWith("grp:")) { const gs = deskGroups(); const i = gs.findIndex((g) => "grp:" + g.id === k); if (i >= 0) gs.splice(i, 1); }
      else if (k.startsWith("dup:")) { S().desktop.dupes = deskDupes().filter((d) => "dup:" + d.uid !== k); }
      else { const a = keyToApp(k); removeFromDesktop(k, a ? a.name : k); }
    });
    State.save(); clearDeskSel(); renderDesktopIcons();
  }
  function makeGroupFromSelection() {
    const apps = [];
    [...deskSel].forEach((k) => { if (k.startsWith("grp:")) return; const a = keyToApp(k); if (a && apps.indexOf(a.id) < 0) apps.push(a.id); });
    if (!apps.length) return;
    // Drop any duplicate shortcuts that got folded in.
    S().desktop.dupes = deskDupes().filter((d) => [...deskSel].indexOf("dup:" + d.uid) < 0);
    const nm = promptName("New App Group", "New Group");
    if (!nm) { State.save(); renderDesktopIcons(); return; }
    deskGroups().push({ id: newGid(), name: nm, apps });
    State.save(); clearDeskSel(); renderDesktopIcons();
  }

  // Folder popup shown when a desktop App Group is opened.
  function openDeskGroup(group) {
    document.querySelectorAll(".dgrp-pop, .dgrp-mask").forEach((m) => m.remove());
    const mask = el(`<div class="dgrp-mask"></div>`);
    const pop = el(`<div class="dgrp-pop"><div class="dgrp-head"><b>${escAttr(group.name)}</b><button class="dgrp-close" title="Close">&times;</button></div><div class="dgrp-grid"></div></div>`);
    const grid = pop.querySelector(".dgrp-grid");
    if (!group.apps.length) grid.innerHTML = `<div class="muted" style="grid-column:1/-1;padding:18px;text-align:center">This group is empty.</div>`;
    group.apps.forEach((id) => {
      const a = Catalog.storeApps.find((x) => x.id === id);
      const nm = a ? a.name : id;
      const t = el(`<div class="dgrp-app"><div class="dgrp-ic">${Icon.big(id === "duolingo" ? duoIconKey(true) : id, nm)}</div><div class="dgrp-nm">${escAttr(nm)}</div></div>`);
      t.onclick = () => { close(); open(id); };
      grid.appendChild(t);
    });
    function close() { mask.remove(); }
    pop.querySelector(".dgrp-close").onclick = close;
    mask.onclick = (e) => { if (e.target === mask) close(); };
    mask.appendChild(pop);
    screen().appendChild(mask);
  }
  // Simple in-app name prompt (avoids the native prompt dialog).
  function promptName(title, initial) { return window.prompt(title, initial || ""); }

  // Rubber-band selection: drag on the empty Home Screen to select multiple icons.
  function enableMarquee() {
    let box = null, sx = 0, sy = 0, active = false;
    const iconWrap = () => desktop.querySelector(".desktop-icons");
    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      const pt = e.touches ? e.touches[0] : e;
      // only start on empty desktop, not on an icon
      if (!(e.target === desktop || e.target.classList.contains("desktop-icons"))) return;
      sx = pt.clientX; sy = pt.clientY; active = false;
      const move = (ev) => {
        const p = ev.touches ? ev.touches[0] : ev;
        const dx = p.clientX - sx, dy = p.clientY - sy;
        if (!active && Math.hypot(dx, dy) > 8) {
          active = true; clearDeskSel();
          box = el(`<div class="desk-marquee"></div>`); screen().appendChild(box);
        }
        if (active) {
          if (ev.cancelable) ev.preventDefault();
          const x = Math.min(sx, p.clientX), y = Math.min(sy, p.clientY), w = Math.abs(dx), h = Math.abs(dy);
          box.style.left = x + "px"; box.style.top = y + "px"; box.style.width = w + "px"; box.style.height = h + "px";
          const rect = { left: x, top: y, right: x + w, bottom: y + h };
          iconWrap().querySelectorAll(".dicon").forEach((ic) => {
            if (ic.classList.contains("dbin")) return;
            const r = ic.getBoundingClientRect();
            const hit = r.left < rect.right && r.right > rect.left && r.top < rect.bottom && r.bottom > rect.top;
            const key = ic.dataset.key;
            if (hit) { ic.classList.add("selected"); if (key) deskSel.add(key); }
            else { ic.classList.remove("selected"); if (key) deskSel.delete(key); }
          });
        }
      };
      const up = () => {
        window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
        window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up);
        if (box) box.remove(); box = null;
      };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      window.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
    };
    desktop.addEventListener("mousedown", onDown);
    desktop.addEventListener("touchstart", onDown, { passive: true });
  }

  function buildDesktop() {
    desktop = el(`<div class="desktop"><div class="desktop-icons"></div></div>`);
    screen().appendChild(desktop);
    // Click empty desktop to clear icon selection.
    desktop.addEventListener("click", (e) => { if (e.target === desktop || e.target.classList.contains("desktop-icons")) clearDeskSel(); });
    desktop.addEventListener("contextmenu", (e) => { if (e.target === desktop || e.target.classList.contains("desktop-icons")) { e.preventDefault(); desktopContextMenu(e); } });
    if (S().desktop && S().desktop.iconSize) desktop.classList.add("icons-" + S().desktop.iconSize);
    enableMarquee();
    applyWallpaper();
    renderDesktopIcons();
    buildTaskbar();
    startClock();
  }

  function applyWallpaper() {
    const wp = S().desktop.wallpaper;
    if (!wp || wp === "default") {
      desktop.style.background = "url(assets/wall3.jpg) center/cover"; // Windows 12 default
    } else if (wp.startsWith("data:") || wp.startsWith("http") || wp.startsWith("assets/")) {
      desktop.style.background = `url(${wp}) center/cover`;
    } else {
      desktop.style.background = wp; // color
    }
  }
  window.applyWallpaper = applyWallpaper;

  // ---------------- Widgets ----------------
  const wxImg = (f, alt) => `<img class="wg-wx-img" src="assets/${f}.png?v=2" width="22" height="22" alt="${alt}" style="object-fit:contain;vertical-align:middle">`;
  const WX_SVG = {
    sun: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f5b301" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.5" fill="#ffd75e" stroke="none"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A4 4 0 0 1 17 18Z" fill="#cfd8e6"/></svg>`,
    partly: wxImg("weather_partly", "Partly cloudy"),
    rain: wxImg("weather_rain", "Rain"),
    showers: wxImg("weather_showers", "Showers"),
    thunder: wxImg("weather_thunder", "Thunderstorms"),
    snow: wxImg("weather_snow", "Snow"),
    fog: wxImg("weather_fog", "Foggy"),
  };
  const WX_STATES = [
    { icon: "sun", label: "Sunny", temp: 74, hi: 78, lo: 61 },
    { icon: "partly", label: "Partly cloudy", temp: 68, hi: 72, lo: 58 },
    { icon: "cloud", label: "Cloudy", temp: 63, hi: 66, lo: 55 },
    { icon: "showers", label: "Showers", temp: 61, hi: 64, lo: 54 },
    { icon: "rain", label: "Light rain", temp: 59, hi: 62, lo: 52 },
    { icon: "thunder", label: "Thunderstorms", temp: 57, hi: 60, lo: 51 },
    { icon: "snow", label: "Snow", temp: 31, hi: 35, lo: 25 },
    { icon: "fog", label: "Foggy", temp: 52, hi: 55, lo: 48 },
  ];
  function weatherToday() { const d = new Date(State.now ? State.now() : Date.now()); return WX_STATES[(d.getFullYear() + d.getMonth() * 31 + d.getDate()) % WX_STATES.length]; }
  function widgetTodos() { if (!S().appData) S().appData = {}; if (!S().appData.widgetTodos) S().appData.widgetTodos = [{ text: "Explore Windows 12", done: false }]; return S().appData.widgetTodos; }

  function toggleWidgets() {
    const ex = document.getElementById("widgetsPanel"); if (ex) { ex.classList.add("closing"); setTimeout(() => ex.remove(), 200); return; }
    const w = weatherToday();
    const city = (S().region && S().region.city) || "Seattle";
    const now = new Date(State.now ? State.now() : Date.now());
    const panel = el(`<div id="widgetsPanel" class="widgets-panel">
      <div class="wg-head"><b>Widgets</b><button class="wg-close" title="Close">&times;</button></div>
      <div class="wg-grid">
        <div class="wg-card wg-weather">
          <div class="wg-wx-top"><div><div class="wg-wx-temp">${w.temp}&deg;</div><div class="wg-wx-city">${city}</div></div><div class="wg-wx-ic">${WX_SVG[w.icon]}</div></div>
          <div class="wg-wx-label">${w.label} &middot; H:${w.hi}&deg; L:${w.lo}&deg;</div>
          <div class="wg-wx-days"></div>
        </div>
        <div class="wg-card wg-clock"><div class="wg-clock-time">${State.formatClock()}</div><div class="wg-clock-date">${State.formatDate()}</div></div>
        <div class="wg-card wg-todo">
          <div class="wg-card-h">To do</div>
          <div class="wg-todo-list"></div>
          <div class="wg-todo-add"><input placeholder="Add a task" class="wg-todo-in"><button class="wg-todo-btn">Add</button></div>
        </div>
        <div class="wg-card wg-stocks">
          <div class="wg-card-h">Watchlist</div>
          <div class="wg-stock-list"></div>
        </div>
      </div>
    </div>`);
    // 4-day mini forecast
    const days = panel.querySelector(".wg-wx-days");
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 1; i <= 4; i++) { const st = WX_STATES[(now.getDate() + i) % WX_STATES.length]; days.appendChild(el(`<div class="wg-day"><span>${dow[(now.getDay() + i) % 7]}</span>${WX_SVG[st.icon]}<b>${st.hi}&deg;</b></div>`)); }
    // To-do
    const list = panel.querySelector(".wg-todo-list");
    function renderTodos() {
      list.innerHTML = "";
      widgetTodos().forEach((t, i) => {
        const row = el(`<label class="wg-todo-row ${t.done ? "done" : ""}"><input type="checkbox" ${t.done ? "checked" : ""}><span>${escAttr(t.text)}</span><button class="wg-todo-x" title="Remove">&times;</button></label>`);
        row.querySelector("input").onchange = (e) => { t.done = e.target.checked; State.save(); renderTodos(); };
        row.querySelector(".wg-todo-x").onclick = (e) => { e.preventDefault(); widgetTodos().splice(i, 1); State.save(); renderTodos(); };
        list.appendChild(row);
      });
      if (!widgetTodos().length) list.innerHTML = `<div class="wg-empty">No tasks yet</div>`;
    }
    renderTodos();
    const addTodo = () => { const inp = panel.querySelector(".wg-todo-in"); const v = inp.value.trim(); if (!v) return; widgetTodos().push({ text: v, done: false }); State.save(); inp.value = ""; renderTodos(); };
    panel.querySelector(".wg-todo-btn").onclick = addTodo;
    panel.querySelector(".wg-todo-in").onkeydown = (e) => { if (e.key === "Enter") addTodo(); };
    // Stocks (stable sample values)
    const stocks = [["MSFT", 441.2, +1.3], ["AAPL", 229.8, -0.4], ["NVDA", 128.6, +2.1], ["GOOGL", 182.4, +0.6]];
    const sl = panel.querySelector(".wg-stock-list");
    stocks.forEach(([t, p, ch]) => sl.appendChild(el(`<div class="wg-stock"><span class="wg-stk-t">${t}</span><span class="wg-stk-p">$${p.toFixed(2)}</span><span class="wg-stk-c ${ch >= 0 ? "up" : "down"}">${ch >= 0 ? "+" : ""}${ch}%</span></div>`)));
    panel.querySelector(".wg-close").onclick = () => { panel.classList.add("closing"); setTimeout(() => panel.remove(), 200); };
    screen().appendChild(panel);
    setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!panel.contains(ev.target) && !ev.target.closest(".tb-widgets")) { panel.classList.add("closing"); setTimeout(() => panel.remove(), 200); document.removeEventListener("mousedown", h); } }), 0);
  }

  // ---------------- System tray SVGs ----------------
  const SYS_SVG = {
    volume: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8 8 0 0 1 0 12"/></svg>`,
    battery: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="8" width="16" height="9" rx="2"/><rect x="5" y="10" width="10" height="5" rx="1" fill="currentColor" stroke="none"/><path d="M21 11v3" stroke-linecap="round"/></svg>`,
    bt: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M8 7l8 10-4 3V4l4 3-8 10"/></svg>`,
    plane: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M21 15v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V8l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5.5L21 15Z"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20 14A8 8 0 0 1 10 4a7 7 0 1 0 10 10Z"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>`,
    focus: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>`,
    cast: `<img src="assets/cast.png?v=9" width="20" height="20" alt="Cast" style="object-fit:contain;vertical-align:middle">`,
    access: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="4.5" r="1.6" fill="currentColor" stroke="none"/><path d="M4 8h16M12 8v6M12 14l-3 6M12 14l3 6"/></svg>`,
  };

  function qs() { if (!S().appData) S().appData = {}; if (!S().appData.quickSettings) S().appData.quickSettings = { wifi: true, bt: false, plane: false, night: false, focus: false, brightness: 90, volume: 55, signal: "good" }; return S().appData.quickSettings; }
  function wifiIconKey() { const q = qs(); return (q.wifi && q.signal === "poor") ? "wifi_poor" : "wifi"; }
  function notifLog() { if (!S().appData) S().appData = {}; if (!S().appData.notifLog) S().appData.notifLog = []; return S().appData.notifLog; }

  // Warm overlay for Night light + dimming for Brightness.
  function applyDisplayFx() {
    const st = qs();
    let fx = document.getElementById("displayFx");
    if (!fx) { fx = el(`<div id="displayFx"></div>`); screen().appendChild(fx); }
    const dim = Math.max(0, (100 - st.brightness) / 100 * 0.55);
    fx.style.background = st.night ? "rgba(255,170,80,0.18)" : "transparent";
    fx.style.boxShadow = "none";
    fx.style.opacity = "1";
    let dimEl = document.getElementById("displayDim");
    if (!dimEl) { dimEl = el(`<div id="displayDim"></div>`); screen().appendChild(dimEl); }
    dimEl.style.background = "#000";
    dimEl.style.opacity = String(dim);
  }
  window.applyDisplayFx = applyDisplayFx;

  function toggleQuickSettings() {
    const ex = document.getElementById("qsPanel"); if (ex) { ex.remove(); return; }
    document.getElementById("notifPanel") && document.getElementById("notifPanel").remove();
    const st = qs();
    const tiles = [
      { k: "wifi", label: "Wi-Fi", icon: Icon.mini("wifi", "Wi-Fi") },
      { k: "bt", label: "Bluetooth", icon: SYS_SVG.bt },
      { k: "plane", label: "Airplane mode", icon: SYS_SVG.plane },
      { k: "focus", label: "Focus", icon: SYS_SVG.focus },
      { k: "night", label: "Night light", icon: SYS_SVG.moon },
      { k: "cast", label: "Cast", icon: SYS_SVG.cast, momentary: true },
    ];
    const panel = el(`<div id="qsPanel" class="qs-panel">
      <div class="qs-tiles"></div>
      <div class="qs-slider"><span class="qs-sl-ic">${SYS_SVG.sun}</span><input type="range" min="10" max="100" value="${st.brightness}" class="qs-brightness"></div>
      <div class="qs-slider"><span class="qs-sl-ic qs-vol-ic">${Icon.mini(st.volume > 0 ? "sound_on" : "sound_off", "Volume")}</span><input type="range" min="0" max="100" value="${st.volume}" class="qs-volume"></div>
      <div class="qs-foot"><span class="qs-batt">${SYS_SVG.battery} 100%</span><span class="grow"></span><button class="qs-settings" title="All settings">${SYS_SVG.focus}</button></div>
    </div>`);
    const tilesWrap = panel.querySelector(".qs-tiles");
    tiles.forEach((t) => {
      const on = !t.momentary && st[t.k];
      const b = el(`<button class="qs-tile ${on ? "on" : ""}"><span class="qs-tile-ic">${t.icon}</span><span class="qs-tile-lbl">${t.label}</span></button>`);
      b.onclick = () => {
        if (t.momentary) { Notify.show({ icon: "", title: t.label, body: t.label + " is not available" }); return; }
        st[t.k] = !st[t.k];
        if (t.k === "plane" && st.plane) { st.wifi = false; st.bt = false; }
        State.save(); b.classList.toggle("on", st[t.k]);
        tilesWrap.querySelector(".qs-tile:nth-child(1)").classList.toggle("on", st.wifi);
        tilesWrap.querySelector(".qs-tile:nth-child(2)").classList.toggle("on", st.bt);
        const wifiIc = taskbar.querySelector(".tb-wifi"); if (wifiIc) wifiIc.style.opacity = st.wifi ? "0.9" : "0.3";
        if (t.k === "night") applyDisplayFx();
      };
      tilesWrap.appendChild(b);
    });
    panel.querySelector(".qs-brightness").oninput = (e) => { st.brightness = +e.target.value; State.save(); applyDisplayFx(); };
    panel.querySelector(".qs-volume").oninput = (e) => {
      st.volume = +e.target.value; State.save();
      const ic = Icon.mini(st.volume > 0 ? "sound_on" : "sound_off", "Volume");
      const slIc = panel.querySelector(".qs-vol-ic"); if (slIc) slIc.innerHTML = ic;
      const trayIc = taskbar && taskbar.querySelector(".tb-vol"); if (trayIc) trayIc.innerHTML = ic;
    };
    panel.querySelector(".qs-settings").onclick = () => { panel.remove(); open("settings"); };
    screen().appendChild(panel);
    setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!panel.contains(ev.target) && !ev.target.closest(".tb-qs")) { panel.remove(); document.removeEventListener("mousedown", h); } }), 0);
  }

  function toggleNotifCenter() {
    const ex = document.getElementById("notifPanel"); if (ex) { ex.remove(); return; }
    document.getElementById("qsPanel") && document.getElementById("qsPanel").remove();
    const log = notifLog();
    const panel = el(`<div id="notifPanel" class="notif-panel">
      <div class="notif-head"><b>Notifications</b>${log.length ? `<button class="notif-clear">Clear all</button>` : ""}</div>
      <div class="notif-list"></div>
      <div class="notif-cal"></div>
    </div>`);
    const list = panel.querySelector(".notif-list");
    if (!log.length) list.innerHTML = `<div class="notif-empty">No new notifications</div>`;
    else log.slice().reverse().forEach((n) => list.appendChild(el(`<div class="notif-item"><b>${n.title || "Notification"}</b><span>${n.body || ""}</span></div>`)));
    if (log.length) panel.querySelector(".notif-clear").onclick = () => { S().appData.notifLog = []; State.save(); panel.remove(); toggleNotifCenter(); };
    panel.querySelector(".notif-cal").appendChild(buildCalendar());
    screen().appendChild(panel);
    setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!panel.contains(ev.target) && !ev.target.closest(".tb-clock")) { panel.remove(); document.removeEventListener("mousedown", h); } }), 0);
  }
  function buildCalendar() {
    const now = new Date(State.now ? State.now() : Date.now());
    const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const cal = el(`<div class="cal"><div class="cal-head">${months[m]} ${y}</div><div class="cal-grid"></div></div>`);
    const grid = cal.querySelector(".cal-grid");
    ["S", "M", "T", "W", "T", "F", "S"].forEach((d) => grid.appendChild(el(`<span class="cal-dow">${d}</span>`)));
    for (let i = 0; i < first; i++) grid.appendChild(el(`<span></span>`));
    for (let d = 1; d <= days; d++) grid.appendChild(el(`<span class="cal-day ${d === today ? "today" : ""}">${d}</span>`));
    return cal;
  }

  // ---------------- Taskbar ----------------
  function buildTaskbar() {
    const w = weatherToday();
    taskbar = el(`<div class="taskbar tb-float">
      <button class="tb-widgets" title="Widgets">${WX_SVG[w.icon] || WX_SVG.sun}<span class="tb-wx-temp">${w.temp}&deg;</span></button>
      <div class="tb-dock">
        <button class="tb-search"><span class="tb-search-ic">${Icon.mini("searchglass", "Search")}</span><span class="tb-search-lbl">Search Anything</span></button>
        <div class="tb-apps">
          <div class="tb-btn start" title="Start">${Icon.mini(xpOn() ? "xpstart" : "winflag", "Windows")}</div>
          <div class="tb-btn" data-open="store__" title="Store">${Icon.mini("store__", "Store")}</div>
          <div class="tb-btn" data-open="browser" title="Edge">${Icon.mini("browser", "Edge")}</div>
          <div class="tb-btn" data-open="fileexplorer" title="File Explorer">${Icon.mini("fileexplorer", "File Explorer")}</div>
          <div class="tb-btn" data-open="photos" title="Photos">${Icon.mini("photos", "Photos")}</div>
        </div>
      </div>
      <button class="tb-copilot" data-open="copilot" title="Copilot">${Icon.mini("copilot", "Copilot")}</button>
      <div class="tb-tray">
        <button class="tb-qs" title="Quick settings">
          <span class="tb-wifi">${Icon.mini(wifiIconKey(), "Wi-Fi")}</span>
          <span class="tb-sysic tb-vol">${Icon.mini(qs().volume > 0 ? "sound_on" : "sound_off", "Volume")}</span>
          <span class="tb-sysic">${SYS_SVG.battery}</span>
        </button>
        <button class="tb-clock" id="tbClock"></button>
      </div>
    </div>`);
    screen().appendChild(taskbar);
    taskbar.querySelector(".start").onclick = toggleStart;
    taskbar.querySelector(".tb-search").onclick = toggleStart;
    taskbar.querySelector(".tb-qs").onclick = toggleQuickSettings;
    taskbar.querySelector(".tb-clock").onclick = toggleNotifCenter;
    taskbar.querySelector(".tb-widgets").onclick = toggleWidgets;
    taskbar.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => open(b.dataset.open));
    // Right-click: jump list on an app button, layout menu on empty taskbar.
    taskbar.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const btn = e.target.closest(".tb-btn[data-open]");
      if (btn) showJumpList(btn.dataset.open, btn);
      else showTaskbarLayoutMenu(e.clientX);
    });
    applyTaskbarLayout();
    buildStartMenu();
    const wifiIc = taskbar.querySelector(".tb-wifi"); if (wifiIc) wifiIc.style.opacity = qs().wifi ? "0.9" : "0.3";
    applyDisplayFx();
  }

  // Per-app quick actions for taskbar jump lists.
  const JUMP_ACTIONS = {
    notepad: [{ label: "New note", act: () => open("notepad") }],
    browser: [{ label: "New tab", act: () => open("browser") }],
    paint: [{ label: "New drawing", act: () => open("paint") }],
    fileexplorer: [{ label: "New window", act: () => open("fileexplorer") }],
    copilot: [{ label: "New chat", act: () => open("copilot") }],
    minecraft: [{ label: "Play", act: () => open("minecraft") }],
  };
  function appDisplayName(id) { const a = Catalog.storeApps.find((x) => x.id === id); return a ? a.name : id; }
  function showJumpList(appId, anchor) {
    document.querySelectorAll(".jumplist,.tb-layoutmenu").forEach((m) => m.remove());
    const running = openWindows.some((e) => e.appId === appId);
    const acts = JUMP_ACTIONS[appId] || [];
    const jl = el(`<div class="jumplist"></div>`);
    if (acts.length) { jl.appendChild(el(`<div class="jl-head">${appDisplayName(appId)}</div>`)); acts.forEach((a) => { const b = el(`<button>${a.label}</button>`); b.onclick = () => { jl.remove(); a.act(); }; jl.appendChild(b); }); jl.appendChild(el(`<div class="jl-sep"></div>`)); }
    const openBtn = el(`<button>Open</button>`); openBtn.onclick = () => { jl.remove(); open(appId); }; jl.appendChild(openBtn);
    if (running) { const cl = el(`<button>Close all windows</button>`); cl.onclick = () => { jl.remove(); openWindows.filter((e) => e.appId === appId).slice().forEach((e) => e.close && e.close()); }; jl.appendChild(cl); }
    screen().appendChild(jl);
    const r = anchor.getBoundingClientRect();
    jl.style.left = Math.min(r.left, window.innerWidth - jl.offsetWidth - 8) + "px";
    jl.style.bottom = (window.innerHeight - r.top + 6) + "px";
    setTimeout(() => document.addEventListener("click", function h(ev) { if (!jl.contains(ev.target)) { jl.remove(); document.removeEventListener("click", h); } }), 0);
  }

  const TB_LAYOUTS = ["Default", "Joined", "Classic", "Compact"];
  function applyTaskbarLayout() {
    if (!taskbar) return;
    const layout = (S().appData && S().appData.taskbarLayout) || "Default";
    TB_LAYOUTS.forEach((l) => taskbar.classList.remove("tb-" + l.toLowerCase()));
    taskbar.classList.add("tb-" + layout.toLowerCase());
  }
  function showTaskbarLayoutMenu(x) {
    document.querySelectorAll(".jumplist,.tb-layoutmenu").forEach((m) => m.remove());
    const cur = (S().appData && S().appData.taskbarLayout) || "Default";
    const menu = el(`<div class="tb-layoutmenu"><div class="jl-head">Taskbar layout</div></div>`);
    TB_LAYOUTS.forEach((l) => {
      const b = el(`<button>${l === cur ? "&#10003; " : ""}${l}</button>`);
      b.onclick = () => { if (!S().appData) S().appData = {}; S().appData.taskbarLayout = l; State.save(); applyTaskbarLayout(); menu.remove(); };
      menu.appendChild(b);
    });
    screen().appendChild(menu);
    menu.style.left = Math.min(x, window.innerWidth - menu.offsetWidth - 8) + "px";
    menu.style.bottom = "56px";
    setTimeout(() => document.addEventListener("click", function h(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", h); } }), 0);
  }

  function addTaskButton(entry) {
    // reuse existing pinned button if app matches
    const existing = taskbar.querySelector(`.tb-btn[data-open="${entry.appId}"]`);
    if (existing) {
      entry.taskBtn = existing; entry.pinned = true;
      existing.onclick = () => toggleWindow(entry);
      refreshTaskbarActive();
      return;
    }
    const btn = el(`<div class="tb-btn" title="${entry.title}">${entry.icon || Icon.mini(entry.appId || "app", entry.title)}</div>`);
    btn.onclick = () => toggleWindow(entry);
    (taskbar.querySelector(".tb-apps") || taskbar).appendChild(btn);
    entry.taskBtn = btn;
    refreshTaskbarActive();
  }

  function toggleWindow(entry) {
    if (entry.win.style.display === "none") focusWindow(entry.win);
    else if (+entry.win.style.zIndex === zCounter) entry.win.style.display = "none";
    else focusWindow(entry.win);
    refreshTaskbarActive();
  }

  function refreshTaskbarActive() {
    if (!taskbar) return;
    taskbar.querySelectorAll(".tb-btn").forEach((b) => b.classList.remove("active"));
    openWindows.forEach((e) => { if (e.taskBtn && e.win.style.display !== "none") e.taskBtn.classList.add("active"); });
  }

  function startClock() {
    const tick = () => {
      const c = document.getElementById("tbClock");
      if (c) c.innerHTML = `${State.formatClock()}<br>${State.formatDate()}`;
    };
    tick(); setInterval(tick, 1000);
  }

  // ---------------- Start menu ("Meet the new Start") ----------------
  function buildStartMenu() {
    startMenu = el(`<div class="start-menu">
      <div class="start-search"><span class="start-search-ic"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span><input class="search" placeholder="${I18n.t("search_apps")}"></div>
      <div class="start-scroll">
        <div class="start-sec">
          <div class="start-sec-head"><span>Pinned</span></div>
          <div class="app-grid pinned-grid"></div>
        </div>
        <div class="start-sec recents-sec">
          <div class="start-sec-head"><span>Recommended</span></div>
          <div class="recents-row"></div>
        </div>
      </div>
      <div class="start-foot">
        <button class="start-user"><span class="start-ava"></span><span class="start-uname"></span></button>
        <button class="start-power" title="Power">&#9211;</button>
      </div>
    </div>`);
    screen().appendChild(startMenu);
    const search = startMenu.querySelector(".search");
    search.oninput = () => renderStartApps(search.value);
    updateStartUser();
    startMenu.querySelector(".start-user").onclick = () => { startMenu.classList.remove("open"); open("settings"); };
    startMenu.querySelector(".start-power").onclick = (e) => { e.stopPropagation(); showPowerMenu(); };
    renderStartApps("");
    document.addEventListener("click", (e) => {
      if (startMenu.classList.contains("open") && !startMenu.contains(e.target) && !e.target.closest(".start")) {
        startMenu.classList.remove("open");
      }
    });
  }

  function updateStartUser() {
    if (!startMenu) return;
    const pr = S().profile || {};
    const ava = startMenu.querySelector(".start-ava");
    ava.innerHTML = pr.picture ? `<img src="${pr.picture}" alt="">` : Icon.mini("user", pr.username || "User");
    startMenu.querySelector(".start-uname").textContent = pr.username || "User";
  }

  function allInstalledApps() {
    const list = [{ id: "store__", name: "Store" }];
    Catalog.storeApps.forEach((a) => {
      if (a.decorative) return;
      const installed = (a.builtin || a.game) ? (S().installedApps.includes(a.id) || isDefaultInstalled(a.id)) : false;
      if (installed) list.push({ id: a.id, name: a.name });
    });
    return list;
  }

  function appTile(a, small) {
    const ikey = a.id === "duolingo" ? duoIconKey(true) : a.id;
    const tile = el(`<div class="app-tile ${small ? "small" : ""}"><div class="ic">${Icon.md(ikey, a.name)}</div><div class="nm">${a.name}</div></div>`);
    tile.onclick = () => { startMenu.classList.remove("open"); open(a.id); };
    return tile;
  }

  // ---------------- App Groups (Start folders) ----------------
  function appGroups() {
    if (!S().appData) S().appData = {};
    if (!S().appData.appGroups) S().appData.appGroups = [
      { name: "Office", apps: ["word", "powerpoint", "excel", "notepad"] },
      { name: "Essentials", apps: ["settings", "fileexplorer", "calculator", "copilot"] },
    ];
    return S().appData.appGroups;
  }
  function appMeta(id) { const a = Catalog.storeApps.find((x) => x.id === id); return { id, name: a ? a.name : id }; }
  function groupTile(group, gi) {
    const icons = group.apps.slice(0, 4).map((id) => `<span class="grp-mini">${Icon.mini(id === "duolingo" ? duoIconKey(true) : id, id)}</span>`).join("");
    const tile = el(`<div class="app-tile grp-tile"><div class="grp-folder">${icons}</div><div class="nm">${group.name}</div></div>`);
    tile.onclick = () => openGroup(group);
    tile.oncontextmenu = (e) => { e.preventDefault(); groupCtxMenu(group, gi, e); };
    return tile;
  }
  function openGroup(group) {
    startMenu.querySelectorAll(".grp-pop").forEach((m) => m.remove());
    const pop = el(`<div class="grp-pop"><div class="grp-pop-head"><b>${group.name}</b><button class="grp-close" title="Close">&times;</button></div><div class="app-grid grp-pop-grid"></div></div>`);
    const grid = pop.querySelector(".grp-pop-grid");
    if (!group.apps.length) grid.innerHTML = `<div class="muted" style="grid-column:1/-1;padding:16px;text-align:center">Empty group. Right-click an app to add it here.</div>`;
    group.apps.forEach((id) => grid.appendChild(appTile(appMeta(id))));
    pop.querySelector(".grp-close").onclick = () => pop.remove();
    startMenu.appendChild(pop);
    setTimeout(() => document.addEventListener("mousedown", function h(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener("mousedown", h); } }), 0);
  }
  function appGroupMenu(a, e) {
    document.querySelectorAll(".start-ctx").forEach((m) => m.remove());
    const menu = el(`<div class="start-ctx"><div class="jl-head">Add “${a.name}” to group</div></div>`);
    appGroups().forEach((g) => { const b = el(`<button>${g.name}</button>`); b.onclick = () => { if (!g.apps.includes(a.id)) g.apps.push(a.id); State.save(); menu.remove(); renderStartApps(""); }; menu.appendChild(b); });
    menu.appendChild(el(`<div class="jl-sep"></div>`));
    const nb = el(`<button>＋ New group…</button>`); nb.onclick = () => { menu.remove(); const nm = prompt("Group name:"); if (nm) { appGroups().push({ name: nm, apps: [a.id] }); State.save(); renderStartApps(""); } }; menu.appendChild(nb);
    placeCtx(menu, e);
  }
  function groupCtxMenu(group, gi, e) {
    document.querySelectorAll(".start-ctx").forEach((m) => m.remove());
    const menu = el(`<div class="start-ctx"><button data-a="rename">Rename group</button><button data-a="ungroup">Delete group</button></div>`);
    menu.querySelector('[data-a="rename"]').onclick = () => { menu.remove(); const nm = prompt("Rename group:", group.name); if (nm) { group.name = nm; State.save(); renderStartApps(""); } };
    menu.querySelector('[data-a="ungroup"]').onclick = () => { menu.remove(); appGroups().splice(gi, 1); State.save(); renderStartApps(""); };
    placeCtx(menu, e);
  }
  function placeCtx(menu, e) {
    screen().appendChild(menu);
    menu.style.left = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8) + "px";
    menu.style.top = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8) + "px";
    setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", h); } }), 0);
  }

  function renderStartApps(filter) {
    const pinnedGrid = startMenu.querySelector(".pinned-grid");
    const recentsSec = startMenu.querySelector(".recents-sec");
    const recentsRow = startMenu.querySelector(".recents-row");
    pinnedGrid.innerHTML = "";
    const f = (filter || "").toLowerCase();
    const list = allInstalledApps();
    list.filter((a) => a.name.toLowerCase().includes(f)).forEach((a) => pinnedGrid.appendChild(appTile(a)));
    const recents = (S().appData.recentApps || []).map((id) => list.find((a) => a.id === id)).filter(Boolean);
    if (f || !recents.length) { recentsSec.style.display = "none"; }
    else {
      recentsSec.style.display = "";
      recentsRow.innerHTML = "";
      recents.slice(0, 6).forEach((a) => recentsRow.appendChild(appTile(a, true)));
    }
  }

  function showPowerMenu() {
    startMenu.querySelectorAll(".start-powmenu").forEach((m) => m.remove());
    const lockSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
    const restartSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v6h6"/><path d="M3.5 9a9 9 0 1 1-.4 5.5"/></svg>`;
    const powerSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 4v8"/><path d="M6.3 7.3a8 8 0 1 0 11.4 0"/></svg>`;
    const sleepSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.6 6.6 0 0 0 20 14.5z"/></svg>`;
    const m = el(`<div class="start-powmenu">
      <button data-a="lock">${lockSvg} Lock</button>
      <button data-a="sleep">${sleepSvg} Sleep</button>
      <button data-a="restart">${restartSvg} Restart</button>
      <button data-a="shutdown">${powerSvg} Shut down</button>
    </div>`);
    startMenu.appendChild(m);
    const close = () => m.remove();
    m.querySelector('[data-a="lock"]').onclick = () => { close(); startMenu.classList.remove("open"); if (window.Lock) Lock.run(() => {}); };
    m.querySelector('[data-a="sleep"]').onclick = () => {
      close(); startMenu.classList.remove("open");
      const z = el(`<div class="sleep-overlay"></div>`); screen().appendChild(z);
      setTimeout(() => z.addEventListener("click", () => { z.remove(); if (window.Lock) Lock.run(() => {}); }), 400);
    };
    m.querySelector('[data-a="restart"]').onclick = () => location.reload();
    m.querySelector('[data-a="shutdown"]').onclick = () => {
      const off = el(`<div class="power-off"></div>`); screen().appendChild(off);
      setTimeout(() => location.reload(), 1400);
    };
    setTimeout(() => document.addEventListener("click", function h(e) { if (!m.contains(e.target)) { close(); document.removeEventListener("click", h); } }), 0);
  }

  function isDefaultInstalled(id) {
    return ["browser", "chrome", "edge", "settings", "calculator", "mediaplayer", "youtubeApp", "ms365", "notepad", "copilot", "imagestudio", "textgen", "fileexplorer", "duolingo", "blockfinder", "messenger", "word", "powerpoint", "excel", "forms", "clock", "outlook", "onenote", "minecraft", "mclauncher", "xbox", "curseforge", "codeeditor", "vscode", "acrobat", "qrcode", "achievements", "store__"].includes(id);
  }

  function toggleStart() {
    startMenu.classList.toggle("open");
    if (startMenu.classList.contains("open")) {
      updateStartUser();
      renderStartApps("");
      const s = startMenu.querySelector(".search"); s.value = ""; setTimeout(() => s.focus(), 50);
    }
  }

  // ---------------- App opening dispatch ----------------
  function recordRecent(id) {
    if (!id) return;
    if (!S().appData) S().appData = {};
    const r = S().appData.recentApps || (S().appData.recentApps = []);
    const i = r.indexOf(id); if (i >= 0) r.splice(i, 1);
    r.unshift(id); if (r.length > 8) r.length = 8;
    State.save();
    if (startMenu && startMenu.classList.contains("open")) renderStartApps(startMenu.querySelector(".search").value);
  }
  function open(appId) {
    recordRecent(appId);
    if (appId === "store__") { AppRegistry.store(); return; }
    if (appId === "recyclebin") { AppRegistry.recyclebin(); return; }
    let app = Catalog.storeApps.find((a) => a.id === appId);
    // Taskbar buttons and shortcuts may reference an app by its builtin key
    // (e.g. "photos", "fileexplorer") rather than its generated store id.
    if (!app) app = Catalog.storeApps.find((a) => a.builtin === appId);
    if (!app && AppRegistry[appId]) { return AppRegistry[appId](createWindow); }
    if (!app) return;
    if (app.game) { return Games.launch(app, createWindow); }
    if (app.builtin && AppRegistry[app.builtin]) { return AppRegistry[app.builtin](createWindow); }
    // decorative app: simple placeholder window
    const { body } = createWindow({ title: app.name, icon: Icon.mini(app.id, app.name), width: 520, height: 360, appId });
    body.innerHTML = `<div class="site center-col" style="justify-content:center;height:100%"><div style="transform:scale(1.8);margin-bottom:18px">${Icon.big(app.id, app.name)}</div><h2>${app.name}</h2><p class="muted">${app.desc}</p></div>`;
  }

  // ---------------- On-screen keyboard ----------------
  const OSK = (function () {
    let osk = null, target = null;
    document.addEventListener("focusin", (e) => {
      if (e.target.matches("input,textarea")) target = e.target;
    });
    function show() {
      if (osk) return;
      const rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
      osk = el(`<div class="osk"></div>`);
      rows.forEach((r) => {
        const row = el(`<div class="osk-row"></div>`);
        [...r].forEach((ch) => {
          const k = el(`<div class="osk-key">${ch}</div>`);
          k.onmousedown = (e) => { e.preventDefault(); type(ch); };
          row.appendChild(k);
        });
        osk.appendChild(row);
      });
      const last = el(`<div class="osk-row"></div>`);
      [["space", " "], ["Back", "BACK"], ["Enter", "ENTER"]].forEach(([label, val]) => {
        const k = el(`<div class="osk-key" style="min-width:${val === " " ? 200 : 60}px">${label}</div>`);
        k.onmousedown = (e) => { e.preventDefault(); type(val); };
        last.appendChild(k);
      });
      osk.appendChild(last);
      screen().appendChild(osk);
    }
    function type(v) {
      if (!target) return;
      if (v === "BACK") target.value = target.value.slice(0, -1);
      else if (v === "ENTER") target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      else target.value += v;
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function hide() { if (osk) { osk.remove(); osk = null; } }
    return { show, hide };
  })();
  window.OSK = OSK;

  // ---------------- Notifications ----------------
  function notify({ icon, title, body, onClick }) {
    // Keep a short history for the Notification Center.
    try { const lg = notifLog(); lg.push({ title: title || "", body: body || "" }); if (lg.length > 30) lg.shift(); State.save(); } catch (_) {}
    if (S().appData && S().appData.quickSettings && S().appData.quickSettings.focus) return; // Focus mutes toasts
    const n = el(`<div class="notif"><div class="nic">${icon || Icon.mini("notify", title || "N")}</div><div><div class="ntitle">${title || ""}</div><div class="nbody">${body || ""}</div></div></div>`);
    n.onclick = () => {
      if (onClick) {
        n.classList.add("clicked");
        n.animate([{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }], { duration: 250 });
        setTimeout(() => { onClick(); dismiss(); }, 250);
      } else dismiss();
    };
    function dismiss() { n.classList.add("closing"); setTimeout(() => n.remove(), 300); }
    document.getElementById("notifications").appendChild(n);
    setTimeout(dismiss, 7000);
  }
  window.Notify = { show: notify };

  function refreshTaskbarIcons() {
    if (!taskbar) return;
    const btn = taskbar.querySelector('.tb-btn[data-open="duolingo"]');
    if (btn) btn.innerHTML = Icon.mini(duoIconKey(false), "Duolingo");
  }
  // Swap a window's icon in both its titlebar and its taskbar button.
  function setWindowIcon(win, iconHtml) {
    if (!win) return;
    const tbIcon = win.querySelector(".win-titlebar .title span");
    if (tbIcon) tbIcon.innerHTML = iconHtml;
    const entry = openWindows.find((e) => e.win === win);
    if (entry) { entry.icon = iconHtml; if (entry.taskBtn) entry.taskBtn.innerHTML = iconHtml; }
  }

  window.WM = {
    createWindow, open, buildDesktop, setWindowIcon,
    refreshDesktopIcons: () => { if (desktop) renderDesktopIcons(); },
    refreshTaskbar: refreshTaskbarIcons,
    refreshWifi: () => { const t = taskbar && taskbar.querySelector(".tb-wifi"); if (!t) return; t.innerHTML = Icon.mini(wifiIconKey(), "Wi-Fi"); t.style.opacity = qs().wifi ? "0.9" : "0.3"; },
  };
})();
