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
    { id: "browser", name: "Edge" },
    { id: "chrome", name: "Chrome" },
    { id: "store__", name: "Store" },
    { id: "youtubeApp", name: "YouTube" },
    { id: "copilot", name: "Copilot" },
    { id: "settings", name: "Settings" },
    { id: "calculator", name: "Calculator" },
    { id: "minecraft", name: "Mincraft" },
    { id: "blockfinder", name: "Assets" },
    { id: "messenger", name: "Messenger" },
    { id: "word", name: "Word" },
    { id: "powerpoint", name: "PowerPoint" },
    { id: "excel", name: "Excel" },
    { id: "forms", name: "Forms" },
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
      body.querySelector("#empty").onclick = () => { S().desktop.bin = []; State.save(); render(); };
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
        { name: "Office", apps: ["word", "powerpoint", "excel", "forms", "notepad"] },
        { name: "Essentials", apps: ["settings", "files", "calculator", "copilot"] },
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
  function clearDeskSel() { deskSel.clear(); if (desktop) desktop.querySelectorAll(".dicon.selected").forEach((x) => x.classList.remove("selected")); }

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

    // Recycle Bin is always first and is the drop target.
    const bin = el(`<div class="dicon dbin" data-bin="1"><div class="glyph">${Icon.big("recyclebin", "Recycle Bin")}</div><div class="label">Recycle Bin</div></div>`);
    bin.onclick = (e) => { e.stopPropagation(); if (bin.classList.contains("selected")) { open("recyclebin"); return; } clearDeskSel(); bin.classList.add("selected"); };
    iconWrap.appendChild(bin);

    // App Group folders.
    deskGroups().forEach((g) => {
      const key = "grp:" + g.id;
      const mini = g.apps.slice(0, 4).map((id) => `<span class="grp-mini">${Icon.mini(id === "duolingo" ? duoIconKey(true) : id, id)}</span>`).join("");
      const gEl = el(`<div class="dicon dgroup" data-key="${key}"><div class="glyph"><div class="grp-folder-lg">${mini || ""}</div></div><div class="label">${escAttr(g.name)}</div></div>`);
      makeDesktopIcon(gEl, { key, kind: "group", group: g, name: g.name }, iconWrap, bin);
      iconWrap.appendChild(gEl);
      if (deskSel.has(key)) gEl.classList.add("selected");
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
        add("Copy", () => duplicateDesk([s.key]));
        add("Duplicate", () => duplicateDesk([s.key]));
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

  // ---------------- Taskbar ----------------
  function buildTaskbar() {
    taskbar = el(`<div class="taskbar tb-float">
      <div class="tb-dock">
        <button class="tb-search"><span class="tb-search-ic">${Icon.mini("searchglass", "Search")}</span><span class="tb-search-lbl">Search Anything</span></button>
        <div class="tb-apps">
          <div class="tb-btn start" title="Start">${Icon.mini(xpOn() ? "xpstart" : "winflag", "Windows")}</div>
          <div class="tb-btn" data-open="store__" title="Store">${Icon.mini("store__", "Store")}</div>
          <div class="tb-btn" data-open="browser" title="Edge">${Icon.mini("browser", "Edge")}</div>
          <div class="tb-btn" data-open="files" title="Files">${Icon.mini("files", "Files")}</div>
          <div class="tb-btn" data-open="photos" title="Photos">${Icon.mini("photos", "Photos")}</div>
        </div>
      </div>
      <button class="tb-copilot" data-open="copilot" title="Copilot">${Icon.mini("copilot", "Copilot")}</button>
      <div class="tb-tray">
        <span class="tb-wifi" title="Wi-Fi — Connected">${Icon.mini("wifi", "Wi-Fi")}</span>
        <div class="tb-clock" id="tbClock"></div>
      </div>
    </div>`);
    screen().appendChild(taskbar);
    taskbar.querySelector(".start").onclick = toggleStart;
    taskbar.querySelector(".tb-search").onclick = toggleStart;
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
  }

  // Per-app quick actions for taskbar jump lists.
  const JUMP_ACTIONS = {
    notepad: [{ label: "New note", act: () => open("notepad") }],
    browser: [{ label: "New tab", act: () => open("browser") }],
    paint: [{ label: "New drawing", act: () => open("paint") }],
    files: [{ label: "New window", act: () => open("files") }],
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
      { name: "Essentials", apps: ["settings", "files", "calculator", "copilot"] },
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
    const restartSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 11a8 8 0 1 0-2.3 5.6M20 5v6h-6"/></svg>`;
    const powerSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4v8M6.3 7.3a8 8 0 1 0 11.4 0"/></svg>`;
    const m = el(`<div class="start-powmenu">
      <button data-a="lock">${lockSvg} Lock</button>
      <button data-a="restart">${restartSvg} Restart</button>
      <button data-a="shutdown">${powerSvg} Shut down</button>
    </div>`);
    startMenu.appendChild(m);
    const close = () => m.remove();
    m.querySelector('[data-a="lock"]').onclick = () => { close(); startMenu.classList.remove("open"); if (window.Lock) Lock.run(() => {}); };
    m.querySelector('[data-a="restart"]').onclick = () => location.reload();
    m.querySelector('[data-a="shutdown"]').onclick = () => {
      const off = el(`<div class="power-off"></div>`); screen().appendChild(off);
      setTimeout(() => location.reload(), 1400);
    };
    setTimeout(() => document.addEventListener("click", function h(e) { if (!m.contains(e.target)) { close(); document.removeEventListener("click", h); } }), 0);
  }

  function isDefaultInstalled(id) {
    return ["browser", "chrome", "settings", "calculator", "mediaplayer", "youtubeApp", "ms365", "notepad", "copilot", "imagestudio", "textgen", "fileexplorer", "files", "duolingo", "blockfinder", "messenger", "word", "powerpoint", "excel", "forms", "minecraft", "codeeditor", "achievements", "store__"].includes(id);
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
    const app = Catalog.storeApps.find((a) => a.id === appId);
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
  window.WM = {
    createWindow, open, buildDesktop,
    refreshDesktopIcons: () => { if (desktop) renderDesktopIcons(); },
    refreshTaskbar: refreshTaskbarIcons,
  };
})();
