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

  // Modern replacement for the long-removed DOMNodeRemoved mutation event
  // (gone from Chrome 127+ and Safari 18+). Apps used to hang teardown logic —
  // stopping timers, audio, animation loops, WebGL map contexts — off
  // DOMNodeRemoved, but it no longer fires, so those leaked on every close.
  // One observer watches for detached .win subtrees and fires a "wm-cleanup"
  // event on each window element instead, through any removal path.
  (function installCleanupObserver() {
    function fire(w) {
      if (w.__wmCleaned) return; w.__wmCleaned = true; w.dispatchEvent(new CustomEvent("wm-cleanup"));
      // iPad Safari only allows a few live WebGL contexts and a fixed pool of canvas memory, and frees
      // them lazily. Release every canvas in a closed window right away so the next app can draw.
      setTimeout(() => releaseCanvases(w), 0);
    }
    function releaseCanvases(root) {
      try {
        root.querySelectorAll("canvas").forEach((c) => {
          try { const gl = c.__gl || null; if (gl && gl.getExtension) { const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); } } catch (e) {}
          c.width = 0; c.height = 0;
        });
      } catch (e) {}
    }
    // Remember WebGL contexts as they're created so they can be released on close.
    try {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, opts) { const ctx = orig.call(this, type, opts); if (ctx && /webgl/.test(type)) this.__gl = ctx; return ctx; };
    } catch (e) {}
    window.WMReleaseCanvases = releaseCanvases;
    function scan(node) {
      if (!node || node.nodeType !== 1) return;
      if (node.matches && node.matches(".win")) fire(node);
      if (node.querySelectorAll) node.querySelectorAll(".win").forEach(fire);
    }
    try {
      new MutationObserver((muts) => {
        for (const m of muts) for (const n of m.removedNodes) scan(n);
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  })();

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

    // drag — pointer events so windows can be dragged by finger on touch devices
    // (mouse events aren't delivered during a touch drag on mobile Safari).
    const tb = win.querySelector(".win-titlebar");
    tb.style.touchAction = "none";
    // A drag only starts after a few pixels of movement, so a plain click on the
    // titlebar never un-snaps / restores a window. Dragging a maximized or snapped
    // window restores its pre-snap size under the pointer (like Windows); WinX
    // (js/winx.js) adds the edge-snap preview and snaps on release.
    let dragging = false, dragMoved = false, sx, sy, sl, st;
    tb.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".win-controls")) return;
      if (e.button) return; // right/middle button
      dragging = true; dragMoved = false; sx = e.clientX; sy = e.clientY; sl = win.offsetLeft; st = win.offsetTop;
    });
    const onDragMove = (e) => {
      if (!dragging) return;
      if (!dragMoved) {
        if (Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
        dragMoved = true;
        if (entry.maximized || entry.wxSnap) {
          const ratio = Math.min(1, Math.max(0, (sx - win.offsetLeft) / Math.max(1, win.offsetWidth)));
          if (entry.maximized) setMaximized(false);
          else if (window.WinX) WinX.unsnap(entry);
          sl = sx - win.offsetWidth * ratio; st = Math.max(0, sy - 18);
          win.style.left = sl + "px"; win.style.top = st + "px";
        }
        if (window.WinX) WinX.dragStart(entry, e);
      }
      win.style.left = Math.max(-win.offsetWidth + 80, sl + e.clientX - sx) + "px";
      win.style.top = Math.max(0, st + e.clientY - sy) + "px";
      if (window.WinX) WinX.dragMove(entry, e);
    };
    const onDragUp = (e) => {
      if (dragging && dragMoved && window.WinX) WinX.dragEnd(entry, e, e.type === "pointercancel");
      dragging = false; dragMoved = false;
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
    window.addEventListener("pointercancel", onDragUp);
    // These live on window, so they must be torn down when the window goes away
    // (any removal path), or they pile up and run on every global pointer event.
    win.addEventListener("wm-cleanup", () => {
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragUp);
      window.removeEventListener("pointercancel", onDragUp);
    });
    // Double-click the titlebar to maximize / restore, like Windows.
    tb.addEventListener("dblclick", (e) => { if (!e.target.closest(".win-controls") && !opts.noMax) setMaximized(!entry.maximized); });

    const entry = { id: "w" + (++zCounter), win, appId: opts.appId, title: opts.title || "", icon: opts.icon, maximized: false, noMax: !!opts.noMax };
    // Virtual desktops (js/winx.js): a window belongs to the desktop it opened on.
    entry.desk = window.WinX ? WinX.activeId() : null;

    function close() {
      const idx = openWindows.indexOf(entry);
      if (idx >= 0) openWindows.splice(idx, 1);
      if (entry.taskBtn && entry.taskBtn.parentNode && !entry.pinned) entry.taskBtn.remove();
      else if (entry.taskBtn && entry.pinned) {
        // A pinned button's click was repointed at this window when it opened;
        // now that it's closing, point it at another open window of the same app
        // if one remains, otherwise back to launching the app (so it still opens).
        const btn = entry.taskBtn, id = entry.appId;
        const other = openWindows.find((e) => e.taskBtn === btn);
        btn.onclick = other ? () => toggleWindow(other) : () => open(id);
      }
      win.remove();
      if (opts.onClose) opts.onClose();
      refreshTaskbarActive();
    }
    entry.close = close;
    controls.querySelector(".close").onclick = () => { if (!opts.noClose) close(); };
    controls.querySelector(".min").onclick = () => { if (opts.noMin) return; win.style.display = "none"; refreshTaskbarActive(); };
    let prev;
    // Maximize / restore. A snapped window (WinX) restores to its pre-snap size.
    function setMaximized(on) {
      on = !!on;
      if (on === entry.maximized) return;
      entry.maximized = on;
      controls.querySelector(".max").title = on ? "Restore down" : "Maximize";
      if (on) {
        if (entry.wxSnap && entry.wxPrev) {
          const p = entry.wxPrev; prev = { l: p.l + "px", t: p.t + "px", w: p.w + "px", h: p.h + "px" };
          entry.wxSnap = null; win.classList.remove("wx-snapped");
        } else prev = { l: win.style.left, t: win.style.top, w: win.style.width, h: win.style.height };
        win.classList.add("maximized");
        win.style.left = "0"; win.style.top = "0"; win.style.width = "100%"; win.style.height = "calc(100% - 48px)";
      } else {
        win.classList.remove("maximized");
        if (prev) Object.assign(win.style, { left: prev.l, top: prev.t, width: prev.w, height: prev.h });
      }
    }
    entry.setMaximized = setMaximized;
    // The pre-maximize geometry in px (WinX uses it as the pre-snap size).
    entry.maxPrev = () => prev ? { l: parseFloat(prev.l) || 0, t: parseFloat(prev.t) || 0, w: parseFloat(prev.w) || w, h: parseFloat(prev.h) || h } : null;
    controls.querySelector(".max").onclick = () => { if (!opts.noMax) setMaximized(!entry.maximized); };

    screen().appendChild(win);
    openWindows.push(entry);
    addTaskButton(entry);
    focusWindow(win);
    return { win, body, close, focus: () => focusWindow(win) };
  }

  function focusWindow(win) {
    // Focusing a window that lives on another virtual desktop switches to that desktop.
    if (window.WinX) { const en = openWindows.find((x) => x.win === win); if (en && !WinX.onActive(en)) WinX.switchTo(en.desk); }
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

  // -------- Task Manager --------
  AppRegistry.taskmanager = function () {
    const ref = createWindow({ title: "Task Manager", icon: Icon.mini("taskmanager", "Task Manager"), width: 660, height: 520, appId: "taskmanager" });
    const body = ref.body; body.classList.add("tm-host");
    const esc = escAttr;
    let tab = "proc", iv = null;
    const BG = [
      { name: "System", type: "sys" }, { name: "Registry", type: "sys" }, { name: "Desktop Window Manager", type: "sys" },
      { name: "Windows Explorer", type: "sys" }, { name: "Client Server Runtime Process", type: "sys" }, { name: "Service Host: Network", type: "sys" },
      { name: "Antimalware Service Executable", type: "sys" }, { name: "Runtime Broker", type: "sys" }, { name: "Search Indexer", type: "sys" },
    ].map((p) => ({ ...p, cpu: Math.random() * 2, mem: 20 + Math.random() * 180 }));
    let cpuHist = Array.from({ length: 40 }, () => 5 + Math.random() * 10);
    let memHist = Array.from({ length: 40 }, () => 40 + Math.random() * 10);
    let diskHist = Array.from({ length: 40 }, () => Math.random() * 12);
    let netHist = Array.from({ length: 40 }, () => 0);
    // Real network throughput: seed from the Network Information API where it
    // exists (Chrome/Edge), and actively measure by timing a cache-busted fetch
    // of a real asset — so the graph reflects the actual connection, not a fake.
    let netMbps = (navigator.connection && navigator.connection.downlink) || 0, netProbing = false;
    async function measureNet() {
      if (netProbing || (navigator.onLine === false)) return; netProbing = true;
      try {
        const t0 = performance.now();
        const res = await fetch("assets/wall3.jpg?_net=" + Date.now(), { cache: "no-store" });
        const buf = await res.arrayBuffer();
        const dt = (performance.now() - t0) / 1000;
        if (dt > 0.01 && buf.byteLength > 0) { const mbps = (buf.byteLength * 8) / dt / 1e6; netMbps = netMbps ? netMbps * 0.5 + mbps * 0.5 : mbps; }
      } catch (e) { /* offline/blocked — keep the last reading */ }
      netProbing = false;
    }
    function rows() {
      const apps = openWindows.filter((w) => w.appId !== "taskmanager").map((w) => ({ name: w.title || w.appId, entry: w, app: true, cpu: Math.random() * 8, mem: 60 + Math.random() * 260 }));
      BG.forEach((p) => { p.cpu = Math.max(0, p.cpu + (Math.random() - 0.5)); p.mem = Math.max(10, p.mem + (Math.random() - 0.5) * 6); });
      return { apps, bg: BG };
    }
    function stop() { if (iv) clearInterval(iv); iv = null; }
    function render() {
      stop();
      body.innerHTML = `<div class="tm">
        <div class="tm-tabs"><button class="tm-tab ${tab === "proc" ? "on" : ""}" data-t="proc">Processes</button><button class="tm-tab ${tab === "perf" ? "on" : ""}" data-t="perf">Performance</button></div>
        <div class="tm-body"></div></div>`;
      body.querySelectorAll(".tm-tab").forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); });
      const host = body.querySelector(".tm-body");
      if (tab === "proc") renderProc(host); else renderPerf(host);
    }
    function paintProc(host) {
      const { apps, bg } = rows();
      const totCpu = Math.min(100, apps.concat(bg).reduce((s, r) => s + r.cpu, 0) + 3);
      const totMem = Math.min(99, 38 + apps.length * 4 + apps.concat(bg).reduce((s, r) => s + r.mem, 0) / 260);
      const rowHtml = (r) => `<div class="tm-row${r.app ? " tm-app" : ""}"><span class="tm-name">${esc(r.name)}</span><span class="tm-cpu">${r.cpu.toFixed(1)}%</span><span class="tm-mem">${Math.round(r.mem)} MB</span>${r.app ? `<button class="tm-end" data-id="${r.entry.id}">End task</button>` : "<span class='tm-end'></span>"}</div>`;
      host.innerHTML = `<div class="tm-head"><span class="tm-name">Name</span><span class="tm-cpu"><b>${totCpu.toFixed(0)}%</b><i>CPU</i></span><span class="tm-mem"><b>${totMem.toFixed(0)}%</b><i>Memory</i></span><span class="tm-end"></span></div>
        <div class="tm-sec">Apps (${apps.length})</div>${apps.map(rowHtml).join("") || "<div class='tm-empty'>No apps running.</div>"}
        <div class="tm-sec">Background processes (${bg.length})</div>${bg.map(rowHtml).join("")}`;
      host.querySelectorAll(".tm-end[data-id]").forEach((b) => b.onclick = () => { const w = openWindows.find((x) => x.id === b.dataset.id); if (w) { w.win.querySelector(".ctl-close").click(); paintProc(host); } });
    }
    function renderProc(host) { paintProc(host); iv = setInterval(() => { if (!document.body.contains(host)) return stop(); paintProc(host); }, 1500); }
    function spark(hist, color) { const w = 260, h = 90; const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * w},${h - (v / 100) * h}`).join(" "); return `<svg viewBox="0 0 ${w} ${h}" class="tm-spark" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/><polyline points="0,${h} ${pts} ${w},${h}" fill="${color}22" stroke="none"/></svg>`; }
    function renderPerf(host) {
      let n = 0;
      function tick() {
        const nudge = (hist, lo, hi, amp) => hist.slice(1).concat(Math.max(lo, Math.min(hi, hist[hist.length - 1] + (Math.random() - 0.5) * amp)));
        cpuHist = nudge(cpuHist, 2, 100, 18);
        memHist = nudge(memHist, 30, 90, 4);
        diskHist = nudge(diskHist, 0, 100, 26);
        if (n % 4 === 0) measureNet();           // re-probe the real connection every ~4s
        netHist = netHist.slice(1).concat(netMbps);
        n++;
        const last = (h) => h[h.length - 1];
        const netMax = Math.max(1, ...netHist), netScaled = netHist.map((v) => (v / netMax) * 100);
        host.innerHTML = `<div class="tm-perf">
          <div class="tm-graph"><div class="tm-graph-h">CPU <b>${last(cpuHist).toFixed(0)}%</b></div>${spark(cpuHist, "#2f7be0")}</div>
          <div class="tm-graph"><div class="tm-graph-h">Memory <b>${last(memHist).toFixed(0)}%</b> · ${(last(memHist) / 100 * 16).toFixed(1)}/16 GB</div>${spark(memHist, "#a142f4")}</div>
          <div class="tm-graph"><div class="tm-graph-h">Disk <b>${last(diskHist).toFixed(0)}%</b></div>${spark(diskHist, "#1f9d57")}</div>
          <div class="tm-graph"><div class="tm-graph-h">Network <b>${netMbps.toFixed(1)} Mbps</b></div>${spark(netScaled, "#f5820b")}</div>
        </div>`;
      }
      tick(); iv = setInterval(() => { if (!document.body.contains(host)) return stop(); tick(); }, 1000);
    }
    ref.onClose = stop;
    render();
  };

  // -------- Weather app (full screen, uses the same NOAA data as the widget) --------
  function wxBg(icon) {
    const M = { sun: "linear-gradient(160deg,#3a7bd5,#63b3ed)", partly: "linear-gradient(160deg,#4a7fb5,#7fb0d9)", cloud: "linear-gradient(160deg,#5a6b7e,#8a9bb0)", showers: "linear-gradient(160deg,#41668c,#6d8fb0)", rain: "linear-gradient(160deg,#374a63,#5b7089)", thunder: "linear-gradient(160deg,#2b3550,#4a4f6b)", snow: "linear-gradient(160deg,#6a7c93,#aebfd4)", fog: "linear-gradient(160deg,#6b7280,#9aa3b2)" };
    return M[icon] || M.partly;
  }
  // Animated CSS weather scene for the current condition.
  function wxScene(icon) {
    let s = '<div class="wx-scene">';
    if (icon === "sun" || icon === "partly") s += '<div class="wx-sun"><span class="wx-rays"></span></div>';
    if (icon !== "sun") { s += '<div class="wx-cloud c1"></div><div class="wx-cloud c2"></div>'; if (icon === "cloud" || icon === "fog" || icon === "thunder") s += '<div class="wx-cloud c3"></div>'; }
    if (icon === "rain" || icon === "showers" || icon === "thunder") { let d = ""; const n = icon === "rain" ? 22 : 34; for (let i = 0; i < n; i++) d += `<span class="wx-drop" style="left:${(i * 4.3) % 100}%;animation-delay:${((i % 11) * 0.11).toFixed(2)}s;animation-duration:${(0.5 + (i % 5) * 0.08).toFixed(2)}s"></span>`; s += `<div class="wx-rainfield">${d}</div>`; }
    if (icon === "thunder") s += '<div class="wx-flash"></div>';
    if (icon === "snow") { let f = ""; for (let i = 0; i < 26; i++) f += `<span class="wx-flake" style="left:${(i * 3.9) % 100}%;animation-delay:${((i % 8) * 0.45).toFixed(2)}s;animation-duration:${(3 + (i % 4)).toFixed(1)}s">❄</span>`; s += `<div class="wx-snowfield">${f}</div>`; }
    if (icon === "fog") s += '<div class="wx-fog f1"></div><div class="wx-fog f2"></div>';
    return s + "</div>";
  }
  AppRegistry.weather = function () {
    const ref = createWindow({ title: "Weather", icon: Icon.mini("weather", "Weather"), width: 720, height: 640, appId: "weather" });
    const body = ref.body; body.classList.add("wx-host");
    const esc = escAttr;
    loadRealWeather();
    function render() {
      const w = weatherToday();
      const city = w.city || (S().region && S().region.city) || "Seattle";
      const now = new Date(State.now ? State.now() : Date.now());
      const hours = Array.from({ length: 8 }, (_, i) => { const h = (now.getHours() + i) % 24; return { label: i === 0 ? "Now" : ((h % 12) || 12) + (h < 12 ? " AM" : " PM"), temp: Math.round(w.temp + Math.sin(i * 0.7) * 3 - i * 0.4), icon: w.icon }; });
      const dnames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const days = (w.days && w.days.length) ? w.days : Array.from({ length: 7 }, (_, i) => { const st = WX_STATES[(now.getDate() + i) % WX_STATES.length]; return { name: dnames[(now.getDay() + i) % 7], hi: st.hi, lo: st.lo, icon: st.icon }; });
      const maxHi = Math.max(...days.map((d) => d.hi || w.hi)), minLo = Math.min(...days.map((d) => d.lo != null ? d.lo : w.lo));
      body.innerHTML = `<div class="wx" style="background:${wxBg(w.icon)}">
        ${wxScene(w.icon)}
        <div class="wx-cur"><div class="wx-city">${esc(city)}</div><div class="wx-temp">${w.temp}&deg;</div><div class="wx-cond">${esc(w.label)}</div><div class="wx-hilo">H:${w.hi}&deg; &nbsp; L:${w.lo}&deg;${w.live ? " &middot; Live" : ""}</div></div>
        <div class="wx-panel wx-hours">${hours.map((h) => `<div class="wx-hour"><span>${esc(h.label)}</span><span class="wx-hic">${WX_SVG[h.icon] || WX_SVG.sun}</span><b>${h.temp}&deg;</b></div>`).join("")}</div>
        <div class="wx-panel wx-days">${days.map((d, i) => { const hi = d.hi != null ? d.hi : w.hi, lo = d.lo != null ? d.lo : w.lo; const l = ((lo - minLo) / Math.max(1, maxHi - minLo)) * 100, r = ((hi - minLo) / Math.max(1, maxHi - minLo)) * 100; return `<div class="wx-drow"><span class="wx-dname">${i === 0 ? "Today" : esc(d.name || "")}</span><span class="wx-dic">${WX_SVG[d.icon] || WX_SVG.sun}</span><span class="wx-dlo">${lo}&deg;</span><span class="wx-bar"><span class="wx-bar-fill" style="left:${l}%;right:${100 - r}%"></span></span><span class="wx-dhi">${hi}&deg;</span></div>`; }).join("")}</div>
      </div>`;
    }
    render();
    setTimeout(() => { if (document.body.contains(body)) render(); }, 1600);
  };

  // -------- Desktop App Groups (folders that live on the Home Screen) --------
  const ESSENTIALS = ["settings", "fileexplorer", "calculator", "copilot", "notepad", "clock", "calendar", "weather", "photos", "camera", "snip", "taskmanager", "tips"];
  function migrateEssentials() {
    if (!S().appData) S().appData = {};
    if (S().appData.essMigrated2) return;
    const bump = (groups) => (groups || []).forEach((g) => { if (g && g.name === "Essentials") ESSENTIALS.forEach((a) => { if (g.apps.indexOf(a) < 0) g.apps.push(a); }); });
    bump(S().desktop && S().desktop.groups);
    bump(S().appData.appGroups);
    S().appData.essMigrated2 = true; State.save();
  }
  function deskGroups() {
    if (!S().desktop) S().desktop = {};
    if (!S().desktop.groups) {
      // Seed the Home Screen with the previous Start-menu groups so App Groups
      // now live on the desktop instead of the search bar.
      const src = (S().appData && S().appData.appGroups) || [
        { name: "Office", apps: ["word", "powerpoint", "excel", "outlook", "onenote", "forms", "notepad"] },
        { name: "Essentials", apps: ESSENTIALS.slice() },
      ];
      S().desktop.groups = src.map((g, i) => ({ id: "grp" + i + "_" + Math.abs(hashStr(g.name)), name: g.name, apps: g.apps.slice() }));
      State.save();
    }
    migrateEssentials();
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
    menu.appendChild(mkItem(iconRow(`<img src="assets/personalization.png?v=1" alt="" style="width:17px;height:17px">`, "Personalize"), () => { window.SettingsStartPage = "personal"; open("settings"); }));
    if (spState().hidden) menu.appendChild(mkItem(iconRow(`<svg viewBox="0 0 24 24" width="17" height="17"><circle cx="12" cy="12" r="11" fill="#1ed760"/><path d="M6.5 9.3c3.6-1.1 7.8-.8 11 1.1M7.2 12.4c2.9-.8 6.3-.5 8.9 1M7.9 15.3c2.3-.6 4.8-.4 6.9.8" stroke="#000" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`, "Show Spotify widget"), () => { const w = desktop.querySelector(".spw"); if (w && w._show) w._show(); }));
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
    // Mouse double-click opens the app straight away, like real Windows (tap → select → menu still works on touch).
    ic.addEventListener("dblclick", (e) => { e.preventDefault(); document.querySelectorAll(".desk-ctx").forEach((m) => m.remove()); clearDeskSel(); launchDeskItem(s); });
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
    buildSpotifyWidget();
    buildTaskbar();
    // First time a fingerprint sensor is found: Windows-style "installing device driver".
    setTimeout(() => { if (window.TouchID) TouchID.installDriverOnce(); }, 3000);
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

  // ---------------- Spotify side widget ----------------
  // Real music through Spotify's embed player (no Spotify app). It remembers what you
  // play here as "Recent". Logged in to Spotify in this browser = full songs; otherwise
  // Spotify plays 30-second previews. Built once, so music keeps playing.
  const SPOTIFY_DEFAULT = { type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M", title: "Today's Top Hits" };
  // Built-in Spotify app Client ID (public, not a secret — PKCE needs no secret). Used unless
  // the user set their own. For their account to connect it must be added under User Management
  // in this app's Spotify dashboard (while the app is in Development mode).
  const SPOTIFY_CLIENT_ID = "ee13b83a1aef48728ea814414db013d3";
  const spClientId = () => (spState().clientId || SPOTIFY_CLIENT_ID);
  const SPOTIFY_SVG = `<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="11" fill="#1ed760"/><path d="M6.5 9.3c3.6-1.1 7.8-.8 11 1.1M7.2 12.4c2.9-.8 6.3-.5 8.9 1M7.9 15.3c2.3-.6 4.8-.4 6.9.8" stroke="#000" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`;
  function spState() { const d = S().desktop || (S().desktop = {}); return d.spotify || (d.spotify = { hidden: false, pos: null, recent: [SPOTIFY_DEFAULT] }); }
  function parseSpotify(t) {
    const s = String(t || "").trim();
    let m = s.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{22})/i) || s.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]{22})$/i);
    return m ? { type: m[1].toLowerCase(), id: m[2] } : null;
  }
  // ---- Spotify sign-in (Authorization Code + PKCE: no secret, works on GitHub Pages) ----
  const SP_REDIRECT = () => location.origin + location.pathname.replace(/index\.html$/, "");
  const spTok = { get() { try { return JSON.parse(localStorage.getItem("spw_token") || "null"); } catch (_) { return null; } }, set(t) { try { t ? localStorage.setItem("spw_token", JSON.stringify(t)) : localStorage.removeItem("spw_token"); } catch (_) {} } };
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  async function spConnect() {
    const id = spClientId(); if (!id) return;
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    try { localStorage.setItem("spw_pkce", verifier); } catch (_) {}
    const url = "https://accounts.spotify.com/authorize?" + new URLSearchParams({ response_type: "code", client_id: id, scope: "user-read-recently-played", redirect_uri: SP_REDIRECT(), code_challenge_method: "S256", code_challenge: challenge, state: "spw" });
    // Open sign-in in a popup so the desktop stays put. If the browser blocks it
    // (iPad Safari sometimes does), fall back to a full-page redirect.
    let win = null;
    try { win = window.open(url, "spotify_login", "width=480,height=720,noopener=no"); } catch (_) { win = null; }
    if (!win) { location.href = url; return; }
    try { win.focus(); } catch (_) {}
  }
  // The popup lands back on this app (the redirect URI). If this window IS that popup,
  // finish the token exchange, tell the opener, and close — without booting a 2nd desktop.
  function spIsPopupCallback() { try { return !!window.opener && window.opener !== window && /[?&]state=spw\b/.test(location.search) && /[?&](code|error)=/.test(location.search); } catch (_) { return false; } }
  async function spFinishPopup() {
    let ok = false, err = "";
    try { await spFinishLogin(); ok = true; } catch (e) { err = (e && e.message) || "Sign-in failed"; }
    try { if (window.opener && !window.opener.closed) window.opener.postMessage({ sp: "spw-done", ok, err }, location.origin); } catch (_) {}
    try { window.close(); } catch (_) {}
    try { document.documentElement.innerHTML = `<body style="margin:0;font:16px system-ui;display:grid;place-items:center;height:100vh;background:#121216;color:#fff"><div style="text-align:center">${ok ? "✓ Connected to Spotify." : "Couldn't connect: " + err.replace(/</g, "&lt;")}<br><br>You can close this window and go back to Windows 12.</div></body>`; } catch (_) {}
  }
  window.SpotifyPopup = { isCallback: spIsPopupCallback, finish: spFinishPopup };
  if (!window.__spMsg) { window.__spMsg = 1; window.addEventListener("message", (e) => { if (e.origin === location.origin && e.data && e.data.sp === "spw-done" && typeof window.__spOnConnected === "function") window.__spOnConnected(e.data); }); }
  async function spTokenRequest(params) {
    const r = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
    const j = await r.json(); if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "Spotify sign-in failed");
    const old = spTok.get() || {};
    spTok.set({ access: j.access_token, refresh: j.refresh_token || old.refresh, exp: Date.now() + (j.expires_in - 60) * 1000 });
  }
  async function spFinishLogin() {   // back from Spotify with ?code=…&state=spw
    const q = new URLSearchParams(location.search);
    if (q.get("state") !== "spw" || !(q.get("code") || q.get("error"))) return false;
    history.replaceState(null, "", SP_REDIRECT() + location.hash);
    if (q.get("error")) throw new Error(q.get("error") === "access_denied" ? "Spotify sign-in was cancelled." : q.get("error"));
    let verifier = ""; try { verifier = localStorage.getItem("spw_pkce") || ""; localStorage.removeItem("spw_pkce"); } catch (_) {}
    await spTokenRequest({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: SP_REDIRECT(), client_id: spClientId(), code_verifier: verifier });
    return true;
  }
  async function spApi(path) {
    let t = spTok.get(); if (!t) throw new Error("not connected");
    if (Date.now() > t.exp) { await spTokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh, client_id: spClientId() }); t = spTok.get(); }
    const r = await fetch("https://api.spotify.com/v1" + path, { headers: { Authorization: "Bearer " + t.access } });
    if (r.status === 401) { spTok.set(null); throw new Error("Spotify signed you out — connect again."); }
    if (r.status === 403) throw new Error("This Spotify account isn't allowed for the app yet. Add it under User Management in your Spotify developer dashboard.");
    if (!r.ok) throw new Error("Spotify error " + r.status);
    return r.json();
  }

  function buildSpotifyWidget() {
    if (!desktop || desktop.querySelector(".spw")) return;
    const st = spState();
    const cur = st.recent[0] || SPOTIFY_DEFAULT;
    const w = el(`<div class="spw ${st.hidden ? "spw-hidden" : ""}">
      <div class="spw-head"><span class="dag-grip">${dagGripSvg()}</span><svg class="spw-logo" viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="11" fill="#1ed760"/><path d="M6.5 9.3c3.6-1.1 7.8-.8 11 1.1M7.2 12.4c2.9-.8 6.3-.5 8.9 1M7.9 15.3c2.3-.6 4.8-.4 6.9.8" stroke="#000" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg><b>Spotify</b><span class="grow"></span><button class="spw-btn spw-acct" title="Connect your Spotify account"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></button><button class="spw-btn spw-add" title="Play a Spotify link">＋</button><button class="spw-btn spw-x" title="Hide widget">×</button></div>
      <div class="spw-paste" hidden><input placeholder="Paste a Spotify song, album or playlist link" spellcheck="false"><button>Play</button><div class="spw-err"></div></div>
      <div class="spw-conn" hidden></div>
      <iframe class="spw-frame" title="Spotify player" src="https://open.spotify.com/embed/${cur.type}/${cur.id}?utm_source=generator" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
      <div class="spw-recent-h">Recent listens</div>
      <div class="spw-recent"></div>
    </div>`);
    const frame = w.querySelector(".spw-frame"), paste = w.querySelector(".spw-paste"), inp = paste.querySelector("input"), err = paste.querySelector(".spw-err");
    function play(item) {
      spState().pickedSince = true;
      const r = spState().recent.filter((x) => x.id !== item.id); r.unshift(item); spState().recent = r.slice(0, 6); State.save();
      frame.src = `https://open.spotify.com/embed/${item.type}/${item.id}?utm_source=generator`;
      paintRecent();
      if (!item.title) fetch("https://open.spotify.com/oembed?url=" + encodeURIComponent(`https://open.spotify.com/${item.type}/${item.id}`)).then((x) => x.json()).then((j) => {
        const it = spState().recent.find((x) => x.id === item.id); if (it && j && j.title) { it.title = j.title; it.thumb = j.thumbnail_url; State.save(); paintRecent(); }
      }).catch(() => {});
    }
    let spRecent = null;   // real "recently played" from Spotify once connected
    function paintRecent() {
      const box = w.querySelector(".spw-recent"); box.innerHTML = "";
      w.querySelector(".spw-recent-h").textContent = spRecent ? "Recently played on Spotify" : "Recent listens";
      if (spRecent) {
        if (!spRecent.length) box.innerHTML = `<span class="spw-none">Nothing played on Spotify yet.</span>`;
        spRecent.forEach((it) => {
          const b = el(`<button class="spw-chip" title="${escAttr(it.title + " — " + it.artist)}">${it.thumb ? `<img src="${escAttr(it.thumb)}" alt="">` : `<span class="spw-chip-ic">♫</span>`}<span>${escAttr(it.title)}</span></button>`);
          b.onclick = () => { frame.src = `https://open.spotify.com/embed/track/${it.id}?utm_source=generator`; box.querySelectorAll(".spw-chip").forEach((x) => x.classList.toggle("on", x === b)); };
          box.appendChild(b);
        });
        return;
      }
      spState().recent.forEach((it, i) => {
        const b = el(`<button class="spw-chip ${i === 0 ? "on" : ""}" title="${escAttr(it.title || it.type)}">${it.thumb ? `<img src="${escAttr(it.thumb)}" alt="">` : `<span class="spw-chip-ic">♫</span>`}<span>${escAttr(it.title || (it.type[0].toUpperCase() + it.type.slice(1)))}</span></button>`);
        b.onclick = () => play(it);
        box.appendChild(b);
      });
    }
    paintRecent();
    st.recent.filter((x) => !x.thumb).slice(0, 6).forEach((it) => fetch("https://open.spotify.com/oembed?url=" + encodeURIComponent(`https://open.spotify.com/${it.type}/${it.id}`)).then((x) => x.json()).then((j) => { if (j && j.thumbnail_url) { it.thumb = j.thumbnail_url; if (j.title) it.title = j.title; State.save(); paintRecent(); } }).catch(() => {}));
    // ---- connect your Spotify account (real recently played) ----
    const conn = w.querySelector(".spw-conn");
    function loadRecent() {
      return spApi("/me/player/recently-played?limit=20").then((j) => {
        const seen = new Set();
        spRecent = (j.items || []).map((x) => x.track).filter((t) => t && t.id && !seen.has(t.id) && seen.add(t.id)).slice(0, 10)
          .map((t) => ({ id: t.id, title: t.name, artist: (t.artists || []).map((a) => a.name).join(", "), thumb: ((t.album && t.album.images) || []).slice(-1)[0]?.url }));
        paintRecent();
        if (spRecent[0] && !spState().pickedSince) frame.src = `https://open.spotify.com/embed/track/${spRecent[0].id}?utm_source=generator`;
      });
    }
    function paintConn(msg) {
      const connected = !!spTok.get();
      conn.innerHTML = connected
        ? `<div class="spw-c-row">✓ Connected to Spotify — showing your recently played.</div><div class="spw-c-btns"><button class="spw-c-refresh">Refresh</button><button class="spw-c-out">Disconnect</button></div>`
        : `<div class="spw-c-row">Connect your Spotify account to see your real <b>recently played</b> songs here.</div>
           <div class="spw-c-btns"><button class="spw-c-go spw-c-connect">Connect Spotify</button></div>
           <a class="spw-c-adv">Use my own Spotify app</a>
           <div class="spw-c-own" hidden>
             <input class="spw-c-id" placeholder="Client ID (32 characters)" value="${escAttr(spState().clientId || "")}" spellcheck="false">
             <div class="spw-c-row spw-c-small">Add this Redirect URI in your Spotify app:<br><code>${escAttr(SP_REDIRECT())}</code></div>
             <div class="spw-c-btns"><button class="spw-c-go spw-c-own-go">Connect with it</button></div>
           </div>`;
      if (msg) conn.appendChild(el(`<div class="spw-err">${escAttr(msg)}</div>`));
      const connect = conn.querySelector(".spw-c-connect"); if (connect) connect.onclick = () => spConnect();
      const adv = conn.querySelector(".spw-c-adv"); if (adv) adv.onclick = () => { const own = conn.querySelector(".spw-c-own"); own.hidden = !own.hidden; };
      const g = conn.querySelector(".spw-c-own-go");
      if (g) g.onclick = () => { const v = conn.querySelector(".spw-c-id").value.trim(); if (!/^[0-9a-f]{32}$/i.test(v)) { paintConn("That doesn't look like a Client ID (32 letters and numbers)."); return; } spState().clientId = v; State.save(); spConnect(); };
      const rf = conn.querySelector(".spw-c-refresh"); if (rf) rf.onclick = () => loadRecent().then(() => paintConn()).catch((e) => paintConn(e.message));
      const out = conn.querySelector(".spw-c-out"); if (out) out.onclick = () => { spTok.set(null); spRecent = null; paintRecent(); paintConn(); };
    }
    w.querySelector(".spw-acct").onclick = () => { conn.hidden = !conn.hidden; paste.hidden = true; if (!conn.hidden) paintConn(); };
    // When the popup sign-in finishes, it messages us — refresh the widget then.
    window.__spOnConnected = (d) => {
      if (d && d.ok === false) { conn.hidden = false; paintConn(d.err || "Couldn't connect to Spotify."); return; }
      conn.hidden = false;
      loadRecent().then(() => paintConn()).catch((e) => paintConn(e.message));
      if (window.Notify) Notify.show({ icon: SPOTIFY_SVG, title: "Spotify connected", body: "Your recently played songs are in the Spotify widget." });
    };
    // Full-page redirect fallback: if we came back from Spotify in this same window.
    spFinishLogin().then((justLoggedIn) => {
      if (spTok.get()) loadRecent().catch((e) => { conn.hidden = false; paintConn(e.message); });
      if (justLoggedIn && window.Notify) Notify.show({ icon: SPOTIFY_SVG, title: "Spotify connected", body: "Your recently played songs are in the Spotify widget." });
    }).catch((e) => { conn.hidden = false; paintConn(e.message); });

    w.querySelector(".spw-add").onclick = () => { paste.hidden = !paste.hidden; conn.hidden = true; err.textContent = ""; if (!paste.hidden) inp.focus(); };
    const go = () => { const p = parseSpotify(inp.value); if (!p) { err.textContent = "That isn't a Spotify link. In Spotify, tap Share → Copy link."; return; } inp.value = ""; paste.hidden = true; play(p); };
    paste.querySelector("button").onclick = go;
    inp.onkeydown = (e) => { if (e.key === "Enter") go(); if (e.key === "Escape") paste.hidden = true; };
    w.querySelector(".spw-x").onclick = () => {
      spState().hidden = true; State.save(); w.classList.add("spw-hidden");
      frame.src = "about:blank";   // stop the music when hidden
      if (window.Notify) Notify.show({ icon: `<svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="11" fill="#1ed760"/><path d="M6.5 9.3c3.6-1.1 7.8-.8 11 1.1M7.2 12.4c2.9-.8 6.3-.5 8.9 1M7.9 15.3c2.3-.6 4.8-.4 6.9.8" stroke="#000" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`, title: "Spotify widget hidden", body: "Right-click the desktop → Show Spotify widget to bring it back." });
    };
    // drag by the header
    if (st.pos) { w.style.left = st.pos.x + "px"; w.style.top = st.pos.y + "px"; w.style.right = "auto"; w.style.bottom = "auto"; }
    const head = w.querySelector(".spw-head");
    head.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      const r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      head.setPointerCapture(e.pointerId); w.classList.add("dragging");
      const move = (ev) => { const x = Math.max(0, Math.min(window.innerWidth - r.width, ev.clientX - dx)), y = Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - dy)); w.style.left = x + "px"; w.style.top = y + "px"; w.style.right = "auto"; w.style.bottom = "auto"; };
      const up = () => { head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); w.classList.remove("dragging"); const b = w.getBoundingClientRect(); spState().pos = { x: Math.round(b.left), y: Math.round(b.top) }; State.save(); };
      head.addEventListener("pointermove", move); head.addEventListener("pointerup", up);
    });
    w.addEventListener("click", (e) => e.stopPropagation());
    w.addEventListener("contextmenu", (e) => e.stopPropagation());
    desktop.appendChild(w);
    w._show = () => { spState().hidden = false; State.save(); w.classList.remove("spw-hidden"); const c = spState().recent[0] || SPOTIFY_DEFAULT; if (frame.src === "about:blank") frame.src = `https://open.spotify.com/embed/${c.type}/${c.id}?utm_source=generator`; };
  }

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
  // Real weather from the NOAA/NWS API (no key; US-only). Falls back to the
  // date-based demo whenever geolocation, network, or coverage isn't available.
  function cachedWeather() { try { const w = S().appData && S().appData.weather; if (w && w.live && (Date.now() - w.ts) < 3600000) return w; } catch (e) {} return null; }
  function weatherToday() { return cachedWeather() || WX_STATES[(() => { const d = new Date(State.now ? State.now() : Date.now()); return (d.getFullYear() + d.getMonth() * 31 + d.getDate()) % WX_STATES.length; })()]; }
  function mapForecast(short, isDay) {
    const s = (short || "").toLowerCase();
    if (/thunder|t-?storm/.test(s)) return "thunder";
    if (/snow|flurr|sleet|ice|wintry|blizzard/.test(s)) return "snow";
    if (/rain|shower|drizzle/.test(s)) return /sun|partly|mostly sunny|few clouds/.test(s) ? "showers" : "rain";
    if (/fog|haze|mist|smoke/.test(s)) return "fog";
    if (/cloud|overcast/.test(s)) return /partly|mostly sunny|few|scattered/.test(s) ? "partly" : "cloud";
    if (/sun|clear|fair/.test(s)) return isDay ? "sun" : "partly";
    return "partly";
  }
  function getCoords() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject();
      navigator.geolocation.getCurrentPosition((pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }), () => reject(), { timeout: 8000, maximumAge: 3600000 });
    });
  }
  let wxLoading = false;
  async function loadRealWeather() {
    if (wxLoading || cachedWeather()) return; wxLoading = true;
    try {
      const c = await getCoords();
      const ua = { headers: { "User-Agent": "(windows12-sim, grodsky@forgepr.com)", "Accept": "application/geo+json" } };
      const pt = await fetch(`https://api.weather.gov/points/${c.lat.toFixed(4)},${c.lon.toFixed(4)}`, ua).then((r) => r.ok ? r.json() : Promise.reject());
      const city = (pt.properties.relativeLocation && pt.properties.relativeLocation.properties.city) || (S().region && S().region.city) || "Weather";
      const fc = await fetch(pt.properties.forecast, ua).then((r) => r.ok ? r.json() : Promise.reject());
      const per = fc.properties.periods || [];
      if (!per.length) throw 0;
      const cur = per[0];
      const temps = per.slice(0, 2).map((p) => p.temperature).filter((t) => typeof t === "number");
      const hi = temps.length ? Math.max(...temps) : cur.temperature, lo = temps.length ? Math.min(...temps) : cur.temperature;
      const days = per.filter((pp) => pp.isDaytime).slice(0, 5).map((pp) => ({ name: pp.name.slice(0, 3), hi: pp.temperature, icon: mapForecast(pp.shortForecast, true) }));
      if (!S().appData) S().appData = {};
      S().appData.weather = { live: true, ts: Date.now(), temp: cur.temperature, hi, lo, label: cur.shortForecast, icon: mapForecast(cur.shortForecast, cur.isDaytime), city, days };
      State.save();
      const t = taskbar && taskbar.querySelector(".tb-widgets"); if (t) { const w = S().appData.weather; t.innerHTML = (WX_SVG[w.icon] || WX_SVG.sun) + `<span class="tb-wx-temp">${w.temp}&deg;</span>`; }
      const wp = document.getElementById("widgetsPanel"); if (wp) { wp.classList.add("closing"); setTimeout(() => wp.remove(), 0); toggleWidgets(); }
    } catch (e) { /* keep the demo */ } finally { wxLoading = false; }
  }
  function widgetTodos() { if (!S().appData) S().appData = {}; if (!S().appData.widgetTodos) S().appData.widgetTodos = [{ text: "Explore Windows 12", done: false }]; return S().appData.widgetTodos; }

  function toggleWidgets() {
    const ex = document.getElementById("widgetsPanel"); if (ex) { ex.classList.add("closing"); setTimeout(() => ex.remove(), 200); return; }
    loadRealWeather(); // fire-and-forget: swaps in live NOAA data if available
    const w = weatherToday();
    const city = w.city || (S().region && S().region.city) || "Seattle";
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
    if (w.days && w.days.length) {
      w.days.slice(1, 5).forEach((d) => days.appendChild(el(`<div class="wg-day"><span>${d.name}</span>${WX_SVG[d.icon] || WX_SVG.sun}<b>${d.hi}&deg;</b></div>`)));
    } else {
      for (let i = 1; i <= 4; i++) { const st = WX_STATES[(now.getDate() + i) % WX_STATES.length]; days.appendChild(el(`<div class="wg-day"><span>${dow[(now.getDay() + i) % 7]}</span>${WX_SVG[st.icon]}<b>${st.hi}&deg;</b></div>`)); }
    }
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
    volumeMuted: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`,
    battery: `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="8" width="16" height="9" rx="2"/><rect x="5" y="10" width="10" height="5" rx="1" fill="currentColor" stroke="none"/><path d="M21 11v3" stroke-linecap="round"/></svg>`,
    bt: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M8 7l8 10-4 3V4l4 3-8 10"/></svg>`,
    plane: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M21 15v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V8l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5.5L21 15Z"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20 14A8 8 0 0 1 10 4a7 7 0 1 0 10 10Z"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>`,
    focus: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>`,
    cast: `<img src="assets/cast.png?v=9" width="20" height="20" alt="Cast" style="object-fit:contain;vertical-align:middle">`,
    access: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="4.5" r="1.6" fill="currentColor" stroke="none"/><path d="M4 8h16M12 8v6M12 14l-3 6M12 14l3 6"/></svg>`,
    wifiOff: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-linecap="round"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0" stroke="currentColor" stroke-width="1.9" opacity=".45"/><circle cx="17.5" cy="17.5" r="5" fill="#e5484d"/><path d="M15.6 15.6l3.8 3.8M19.4 15.6l-3.8 3.8" stroke="#fff" stroke-width="1.6"/></svg>`,
  };

  // Clean, background-free volume symbol for the tray + quick settings.
  const volSvg = (v) => (v > 0 ? SYS_SVG.volume : SYS_SVG.volumeMuted);
  function qs() { if (!S().appData) S().appData = {}; if (!S().appData.quickSettings) S().appData.quickSettings = { wifi: true, bt: false, plane: false, night: false, focus: false, brightness: 90, volume: 55, signal: "good" }; return S().appData.quickSettings; }
  // Real connection state comes from js/radios.js when it is loaded (online/offline, speed, latency).
  function wifiIconKey() { if (window.Radios) return Radios.net.iconKey(); const q = qs(); return (q.wifi && q.signal === "poor") ? "wifi_poor" : "wifi"; }
  function wifiConnected() { return window.Radios ? Radios.net.isConnected() : !!qs().wifi; }
  let _radiosHooked = false;
  function refreshWifiTray() {
    const t = taskbar && taskbar.querySelector(".tb-wifi"); if (!t) return;
    const key = wifiIconKey();
    // Disconnected: inline SVG so it still draws when the device is really offline (no image fetch needed).
    if (t.dataset.key !== key) { t.innerHTML = key === "wifi_disabled" ? SYS_SVG.wifiOff : Icon.mini(key, "Wi-Fi"); t.dataset.key = key; }
    t.style.opacity = window.Radios ? "0.95" : (qs().wifi ? "0.9" : "0.3");
    t.title = window.Radios ? "Wi-Fi: " + Radios.net.summary() : (qs().wifi ? "Wi-Fi connected" : "Wi-Fi off");
    if (window.Radios && !_radiosHooked) { _radiosHooked = true; Radios.on(refreshWifiTray); }
  }
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
      <div class="qs-slider"><span class="qs-sl-ic qs-vol-ic">${volSvg(st.volume)}</span><input type="range" min="0" max="100" value="${st.volume}" class="qs-volume"></div>
      <div class="qs-foot"><span class="qs-batt"></span><span class="grow"></span><button class="qs-settings" title="All settings">${SYS_SVG.focus}</button></div>
    </div>`);
    const tilesWrap = panel.querySelector(".qs-tiles");
    const tileOn = (k) => (k === "wifi" ? wifiConnected() : !!st[k]);
    const paintRadioTiles = () => {
      const w = tilesWrap.querySelector(".qs-tile:nth-child(1)"), b = tilesWrap.querySelector(".qs-tile:nth-child(2)"), p = tilesWrap.querySelector(".qs-tile:nth-child(3)");
      if (w) { w.classList.toggle("on", tileOn("wifi")); w.title = window.Radios ? Radios.net.summary() : ""; }
      if (b) { b.classList.toggle("on", !!st.bt); b.title = window.Radios ? "Bluetooth: " + Radios.bt.summary() : ""; }
      if (p) p.classList.toggle("on", !!st.plane);
    };
    tiles.forEach((t) => {
      const on = !t.momentary && tileOn(t.k);
      const b = el(`<button class="qs-tile ${on ? "on" : ""}"><span class="qs-tile-ic">${t.icon}</span><span class="qs-tile-lbl">${t.label}</span></button>`);
      b.onclick = () => {
        if (t.momentary) { Notify.show({ icon: "", title: t.label, body: t.label + " is not available" }); return; }
        // Real radios: the Bluetooth tile opens the browser's real pairing chooser (or explains why it can't);
        // the Wi-Fi tile can't switch the real connection, so when the device is offline it says so.
        if (window.Radios && t.k === "bt") { Radios.ui.quickTile(); State.save(); paintRadioTiles(); refreshWifiTray(); return; }
        if (window.Radios && t.k === "wifi" && !Radios.net.info().online) { Notify.show({ icon: "", title: "Wi-Fi", body: "This device is offline. Websites can't join Wi-Fi networks — connect in your device's own Wi-Fi settings." }); return; }
        st[t.k] = !st[t.k];
        if (t.k === "wifi" && st.wifi) st.plane = false;
        if (t.k === "plane" && st.plane) { st.wifi = false; st.bt = false; if (window.Radios) Radios.bt.setEnabled(false); }
        State.save(); b.classList.toggle("on", tileOn(t.k));
        paintRadioTiles(); refreshWifiTray();
        if (window.Radios) Radios.emit();
        if (t.k === "night") applyDisplayFx();
      };
      tilesWrap.appendChild(b);
    });
    if (window.Radios) {
      tilesWrap.after(Radios.ui.quickStatus());
      const offR = Radios.on(() => { if (!panel.isConnected) return offR(); paintRadioTiles(); });
      paintRadioTiles();
    }
    panel.querySelector(".qs-brightness").oninput = (e) => { st.brightness = +e.target.value; State.save(); applyDisplayFx(); };
    panel.querySelector(".qs-volume").oninput = (e) => {
      st.volume = +e.target.value; State.save();
      const ic = volSvg(st.volume);
      const slIc = panel.querySelector(".qs-vol-ic"); if (slIc) slIc.innerHTML = ic;
      const trayIc = taskbar && taskbar.querySelector(".tb-vol"); if (trayIc) trayIc.innerHTML = ic;
    };
    panel.querySelector(".qs-settings").onclick = () => { panel.remove(); open("settings"); };
    screen().appendChild(panel);
    refreshBattery();
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
  // ---------------- Dynamic battery icon (level + charging) ----------------
  const batt = { level: 0.9, charging: false, real: false, inited: false };
  let _battClip = 0;
  function batterySVG(level, charging) {
    const L = Math.max(0, Math.min(1, level));
    const critical = L <= 0.05 && !charging;
    const low = L <= 0.15 && !charging;
    const green = "#38c172", red = "#e5484d", grey = "#c3ccd4";
    const fill = low ? red : green;
    const id = "bc" + (++_battClip);
    const bx = 6.5, by = 5.5, bw = 11, bh = 15, r = 2.6;
    const fh = Math.max(2, bh * L), fy = by + (bh - fh);
    let s = `<svg viewBox="0 0 24 24" width="19" height="19" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle">`;
    s += `<defs><clipPath id="${id}"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${r}"/></clipPath></defs>`;
    s += `<rect x="9" y="2.6" width="6" height="3.4" rx="1.2" fill="${grey}"/>`;
    s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${r}" fill="${grey}"/>`;
    if (critical) {
      s += `<rect x="10.7" y="8" width="2.6" height="5.2" rx="1.3" fill="${red}"/>`;
      s += `<circle cx="12" cy="15.6" r="1.4" fill="${red}"/>`;
    } else {
      s += `<rect x="${bx}" y="${fy}" width="${bw}" height="${fh}" fill="${fill}" clip-path="url(#${id})"/>`;
      if (charging) s += `<path d="M12.6 7 L8.8 13.2 h2.5 l-1 3.9 L15.2 10.6 h-2.7 z" fill="#ffd21e" stroke="#1a8f52" stroke-width="0.4" stroke-linejoin="round"/>`;
    }
    s += `</svg>`;
    return s;
  }
  function batteryPct() { return Math.round(batt.level * 100); }
  function refreshBattery() {
    const svg = batterySVG(batt.level, batt.charging);
    const t = taskbar && taskbar.querySelector(".tb-batt"); if (t) t.innerHTML = svg;
    const q = document.querySelector(".qs-batt"); if (q) q.innerHTML = svg + " " + batteryPct() + "%" + (batt.charging ? " · Charging" : "");
  }
  function battTick() {
    if (batt.real) return;
    if (batt.charging) { batt.level = Math.min(1, batt.level + 0.03); if (batt.level >= 1) batt.charging = false; }
    else { batt.level = Math.max(0, batt.level - 0.01); if (batt.level <= 0.02) batt.charging = true; }
    refreshBattery();
  }
  function initBattery() {
    if (batt.inited) return; batt.inited = true;
    let started = false;
    const sim = () => { if (started) return; started = true; setInterval(battTick, 60000); };
    try {
      if (navigator.getBattery) {
        navigator.getBattery().then((b) => {
          batt.real = true;
          const upd = () => { batt.level = b.level; batt.charging = b.charging; refreshBattery(); };
          b.addEventListener("levelchange", upd); b.addEventListener("chargingchange", upd); upd();
        }).catch(sim);
      } else sim();
    } catch (e) { sim(); }
  }

  function buildTaskbar() {
    const w = weatherToday();
    taskbar = el(`<div class="taskbar tb-float">
      <button class="tb-widgets" title="Widgets">${WX_SVG[w.icon] || WX_SVG.sun}<span class="tb-wx-temp">${w.temp}&deg;</span></button>
      <div class="tb-dock">
        <button class="tb-search"><span class="tb-search-ic">${Icon.mini("searchglass", "Search")}</span><span class="tb-search-lbl">Search Anything</span></button>
        <div class="tb-apps">
          <div class="tb-btn start" title="Start">${Icon.mini(xpOn() ? "xpstart" : "winflag", "Windows")}</div>
          <div class="tb-btn wx-tv-btn" title="Task View (Ctrl+Alt+Up)" aria-label="Task View"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="5" width="12" height="11" rx="2"/><path d="M18 8h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-1"/></svg></div>
          ${taskbarPins().map(pinBtnHtml).join("")}
        </div>
      </div>
      <button class="tb-copilot" data-open="copilot" title="Copilot">${Icon.mini("copilot", "Copilot")}</button>
      <div class="tb-tray">
        <button class="tb-qs" title="Quick settings">
          <span class="tb-wifi">${Icon.mini(wifiIconKey(), "Wi-Fi")}</span>
          <span class="tb-sysic tb-vol">${volSvg(qs().volume)}</span>
          <span class="tb-sysic tb-batt"></span>
        </button>
        <button class="tb-clock" id="tbClock"></button>
      </div>
    </div>`);
    screen().appendChild(taskbar);
    taskbar.querySelector(".start").onclick = toggleStart;
    // Touch feedback on taskbar icons: press-in on touch, highlight that fades 2 s after the tap.
    taskbar.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".tb-btn, .tb-copilot"); if (!b) return;
      b.classList.add("tb-pressed");
      if (e.pointerType !== "mouse") { b.classList.add("tb-touched"); clearTimeout(b.__tbT); b.__tbT = setTimeout(() => b.classList.remove("tb-touched"), 2000); }
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => taskbar.addEventListener(ev, (e) => { const b = e.target.closest && e.target.closest(".tb-btn, .tb-copilot"); if (b) b.classList.remove("tb-pressed"); }, true));
    taskbar.querySelector(".tb-search").onclick = (e) => { e.stopPropagation(); toggleSearch(); };
    taskbar.querySelector(".tb-qs").onclick = toggleQuickSettings;
    taskbar.querySelector(".tb-clock").onclick = toggleNotifCenter;
    taskbar.querySelector(".tb-widgets").onclick = toggleWidgets;
    taskbar.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => open(b.dataset.open));
    taskbar.querySelector(".wx-tv-btn").onclick = () => { if (window.WinX) WinX.toggleTaskView(); };
    // Right-click (or long-press on touch): jump list on an app button, layout menu on empty taskbar.
    taskbar.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const btn = e.target.closest(".tb-btn");
      if (btn && taskBtnApp(btn)) showJumpList(btn);
      else showTaskbarLayoutMenu(e.clientX);
    });
    let lpTimer = null, lpX = 0, lpY = 0;
    const lpCancel = () => { clearTimeout(lpTimer); lpTimer = null; };
    taskbar.addEventListener("pointerdown", (e) => {
      lpCancel();
      if (e.pointerType === "mouse") return;
      const b = e.target.closest(".tb-btn"); if (!b || !taskBtnApp(b)) return;
      lpX = e.clientX; lpY = e.clientY;
      lpTimer = setTimeout(() => { lpTimer = null; lpFired = true; b.classList.remove("tb-pressed"); showJumpList(b); }, 550);
    });
    let lpFired = false, lpSwallowUntil = 0;
    taskbar.addEventListener("pointermove", (e) => { if (lpTimer && Math.hypot(e.clientX - lpX, e.clientY - lpY) > 10) lpCancel(); });
    ["pointerup", "pointercancel"].forEach((ev) => taskbar.addEventListener(ev, () => { lpCancel(); if (lpFired) { lpFired = false; lpSwallowUntil = Date.now() + 600; } }));
    // The tap that ends a long-press must not also launch / toggle the app.
    taskbar.addEventListener("click", (e) => { if (Date.now() < lpSwallowUntil) { lpSwallowUntil = 0; e.stopPropagation(); e.preventDefault(); } }, true);
    applyTaskbarLayout();
    buildStartMenu();
    buildSearchPanel();
    refreshWifiTray();
    refreshBattery(); initBattery();
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
  // ---- Taskbar pins (persisted in appData.taskbarPins) ----
  const DEFAULT_TB_PINS = ["store__", "edge", "fileexplorer", "photos"];
  const PIN_TITLES = { store__: "Store", edge: "Microsoft Edge", fileexplorer: "File Explorer", photos: "Photos" };
  function taskbarPins() {
    if (!S().appData) S().appData = {};
    if (!Array.isArray(S().appData.taskbarPins)) S().appData.taskbarPins = DEFAULT_TB_PINS.slice();
    return S().appData.taskbarPins;
  }
  function pinTitle(id) { return PIN_TITLES[id] || appDisplayName(id); }
  function pinBtnHtml(id) { const t = escAttr(pinTitle(id)); return `<div class="tb-btn" data-open="${escAttr(id)}" title="${t}">${Icon.mini(id === "duolingo" ? duoIconKey(false) : id, pinTitle(id))}</div>`; }
  function pinToTaskbar(appId) {
    const pins = taskbarPins(); if (!appId || pins.includes(appId)) return;
    pins.push(appId); State.save();
    const apps = taskbar.querySelector(".tb-apps") || taskbar;
    const btn = el(pinBtnHtml(appId)); btn.onclick = () => open(appId);
    const lastPinned = [...apps.querySelectorAll(".tb-btn[data-open]")].pop();
    if (lastPinned) lastPinned.after(btn); else apps.appendChild(btn);
    // Fold the app's running windows into the new pinned button.
    openWindows.filter((e) => e.appId === appId).forEach((e) => { if (e.taskBtn && !e.pinned) e.taskBtn.remove(); e.taskBtn = null; addTaskButton(e); });
    refreshTaskbarActive();
  }
  function unpinFromTaskbar(appId) {
    const pins = taskbarPins(); const i = pins.indexOf(appId); if (i < 0) return;
    pins.splice(i, 1); State.save();
    const btn = taskbar.querySelector(`.tb-btn[data-open="${appId}"]`); if (btn) btn.remove();
    // Running windows keep a (now unpinned) button of their own.
    openWindows.filter((e) => e.taskBtn === btn).forEach((e) => { e.pinned = false; e.taskBtn = null; addTaskButton(e); });
    refreshTaskbarActive();
  }
  // What app a taskbar button stands for: its pinned id, or the running windows behind it.
  function taskBtnApp(btn) {
    if (!btn || btn.classList.contains("start") || btn.classList.contains("wx-tv-btn")) return null;
    const entries = openWindows.filter((e) => e.taskBtn === btn);
    const appId = btn.dataset.open || (entries[0] && entries[0].appId) || null;
    if (!appId && !entries.length) return null;
    return { appId, entries };
  }
  function showJumpList(btn) {
    document.querySelectorAll(".jumplist,.tb-layoutmenu").forEach((m) => m.remove());
    const info = taskBtnApp(btn); if (!info) return;
    const appId = info.appId;
    const zOf = (e) => +e.win.style.zIndex || 0;
    const here = info.entries.filter((e) => !window.WinX || WinX.onActive(e)).sort((a, b) => zOf(b) - zOf(a));
    // End task force-closes every window of the app, on every desktop.
    const all = appId ? openWindows.filter((e) => e.appId === appId) : info.entries.slice();
    const first = info.entries[0];
    let name = appId ? (btn.dataset.open ? pinTitle(appId) : appDisplayName(appId)) : "";
    if (!name || name === appId) name = (first && first.title) || btn.title || appId || "App";
    const iconHtml = (first && first.icon) || Icon.mini(appId || "app", name);
    const acts = (appId && JUMP_ACTIONS[appId]) || [];
    const jl = el(`<div class="jumplist wx-jl"></div>`);
    const add = (label, fn, cls) => { const b = el(`<button class="${cls || ""}">${label}</button>`); b.onclick = () => { jl.remove(); fn(); }; jl.appendChild(b); return b; };
    if (acts.length) { jl.appendChild(el(`<div class="jl-head">Tasks</div>`)); acts.forEach((a) => add(a.label, a.act)); jl.appendChild(el(`<div class="jl-sep"></div>`)); }
    const head = add(`<span class="wx-jl-ic">${iconHtml}</span><span class="wx-jl-name">${escAttr(name)}</span>`, () => { if (appId) open(appId); }, "wx-jl-app");
    head.title = appId ? "Open a new window" : name;
    if (appId) {
      const pinned = taskbarPins().includes(appId);
      add(pinned ? "Unpin from taskbar" : "Pin to taskbar", () => pinned ? unpinFromTaskbar(appId) : pinToTaskbar(appId));
    }
    if (here.length) {
      // Close goes through each window's own close button, so apps can still ask to save.
      add(here.length > 1 ? `Close all windows (${here.length})` : "Close window", () => here.forEach((e) => { const c = e.win.querySelector(".win-titlebar .ctl-close"); if (c && !c.disabled) c.click(); else if (e.close) e.close(); }));
    }
    if (all.length) add("End task", () => all.slice().forEach((e) => { try { e.close && e.close(); } catch (err) { e.win.remove(); } }), "wx-jl-end");
    screen().appendChild(jl);
    jl.style.zIndex = 9600; // above toasts (#notifications is 9500)
    const r = btn.getBoundingClientRect();
    jl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - jl.offsetWidth - 8)) + "px";
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
    // A pinned button points at its app's newest window; prefer one on the
    // current virtual desktop, otherwise switch to the desktop that has it.
    if (window.WinX && !WinX.onActive(entry)) {
      const here = openWindows.filter((x) => x.taskBtn === entry.taskBtn && WinX.onActive(x)).sort((a, b) => (+b.win.style.zIndex || 0) - (+a.win.style.zIndex || 0))[0];
      if (here) entry = here; else { focusWindow(entry.win); return; }
    }
    if (entry.win.style.display === "none") focusWindow(entry.win);
    else if (+entry.win.style.zIndex === zCounter) entry.win.style.display = "none";
    else focusWindow(entry.win);
    refreshTaskbarActive();
  }

  function refreshTaskbarActive() {
    if (!taskbar) return;
    taskbar.querySelectorAll(".tb-btn").forEach((b) => b.classList.remove("active"));
    openWindows.forEach((e) => {
      if (!e.taskBtn) return;
      // Only the active virtual desktop's windows show in the taskbar.
      const here = !window.WinX || WinX.onActive(e);
      if (!e.pinned) e.taskBtn.classList.toggle("wx-offdesk", !here);
      if (here && e.win.style.display !== "none") e.taskBtn.classList.add("active");
    });
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
    const IC = (d, w) => `<svg viewBox="0 0 24 24" width="${w || 18}" height="${w || 18}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    startMenu = el(`<div class="start-menu sm12">
      <div class="sm12-left">
        <button class="sm12-ava start-user" title="Your account"><span class="start-ava"></span></button>
        <div class="sm12-name start-uname"></div>
        <label class="sm12-search">${IC('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 17)}<input class="search" placeholder="Search for apps, settings and files" spellcheck="false"></label>
        <div class="sm12-list"></div>
      </div>
      <div class="sm12-right">
        <div class="sm12-toprow">
          <div class="sm12-card sm12-folders"></div>
          <div class="sm12-clockbox">
            <div class="sm12-time"></div><div class="sm12-date"></div>
            <div class="sm12-clock-btns"><button class="sm12-ib sm12-expand" title="Expand">${IC('<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>')}</button><button class="sm12-ib start-power" title="Power">${IC('<path d="M12 4v8"/><path d="M6.3 7.3a8 8 0 1 0 11.4 0"/>', 20)}</button></div>
          </div>
        </div>
        <div class="sm12-card sm12-pins"><div class="sm12-head"><b class="sm12-pins-t">Pinned</b><button class="sm12-pill sm12-all">All <span>›</span></button></div><div class="sm12-grid pinned-grid"></div></div>
        <div class="sm12-card sm12-sugg recents-sec"><div class="sm12-head"><b>Suggested files</b><button class="sm12-pill sm12-more">More <span>›</span></button></div><div class="sm12-files recents-row"></div></div>
      </div>
    </div>`);
    screen().appendChild(startMenu);
    const search = startMenu.querySelector(".search");
    search.oninput = () => renderStartApps(search.value);
    search.onkeydown = (e) => { if (e.key === "Enter") { const f = startMenu.querySelector(".sm12-list .sm12-app"); if (f) f.click(); } if (e.key === "Escape") startMenu.classList.remove("open"); };
    updateStartUser();
    startMenu.querySelector(".start-user").onclick = () => { startMenu.classList.remove("open"); window.SettingsStartPage = "yourinfo"; open("settings"); };
    startMenu.querySelector(".start-power").onclick = (e) => { e.stopPropagation(); showPowerMenu(); };
    startMenu.querySelector(".sm12-expand").onclick = () => startMenu.classList.toggle("sm12-big");
    startMenu.querySelector(".sm12-all").onclick = () => { startMenu.classList.toggle("sm12-showall"); renderStartApps(search.value); };
    startMenu.querySelector(".sm12-more").onclick = () => { startMenu.classList.remove("open"); window.FilesStartPath = "quick"; open("fileexplorer"); };
    renderStartApps("");
    setInterval(() => { if (startMenu.classList.contains("open")) paintStartClock(); }, 1000);
    document.addEventListener("click", (e) => {
      if (startMenu.classList.contains("open") && !startMenu.contains(e.target) && !e.target.closest(".start") && !e.target.closest(".start-ctx")) {
        startMenu.classList.remove("open");
      }
    });
  }
  function paintStartClock() {
    const d = State.now ? State.now() : new Date();
    const sv = window.I18n && I18n.lang === "sv", loc = sv ? "sv-SE" : undefined;
    const h24 = sv || !!(S().clock && S().clock.format24);
    const parts = new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: !h24 }).formatToParts(d);
    const main = parts.filter((p) => p.type !== "dayPeriod").map((p) => p.value).join("").trim();
    const per = (parts.find((p) => p.type === "dayPeriod") || {}).value || "";
    startMenu.querySelector(".sm12-time").innerHTML = main + (per ? `<small>${per}</small>` : "");
    startMenu.querySelector(".sm12-date").textContent = d.toLocaleDateString(loc, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  const START_PIN_DEFAULT = ["calculator", "camera", "settings", "store__", "edge", "fileexplorer", "notepad", "copilot", "xbox", "minecraft", "word", "photos", "clock", "outlook", "excel", "powerpoint", "calendar", "weather"];
  function startPins() {
    if (!S().appData) S().appData = {};
    return S().appData.startPins || (S().appData.startPins = START_PIN_DEFAULT.slice());
  }
  function startAppMenu(a, e) {
    document.querySelectorAll(".start-ctx").forEach((m) => m.remove());
    const pins = startPins(), pinned = pins.includes(a.id);
    const menu = el(`<div class="start-ctx"><div class="jl-head">${a.name}</div><button data-a="open">Open</button><button data-a="pin">${pinned ? "Unpin from Start" : "Pin to Start"}</button>${pinned && pins.indexOf(a.id) > 0 ? '<button data-a="first">Move to front</button>' : ""}</div>`);
    menu.querySelector('[data-a="open"]').onclick = () => { menu.remove(); startMenu.classList.remove("open"); open(a.id); };
    menu.querySelector('[data-a="pin"]').onclick = () => { menu.remove(); if (pinned) pins.splice(pins.indexOf(a.id), 1); else pins.push(a.id); State.save(); renderStartApps(startMenu.querySelector(".search").value); };
    const f = menu.querySelector('[data-a="first"]'); if (f) f.onclick = () => { menu.remove(); pins.splice(pins.indexOf(a.id), 1); pins.unshift(a.id); State.save(); renderStartApps(""); };
    placeCtx(menu, e);
  }

  // ---------------- Taskbar search (Windows Search) ----------------
  let searchPanel;
  function buildSearchPanel() {
    if (searchPanel) return;
    searchPanel = el(`<div class="search-panel">
      <div class="sp-bar"><span class="sp-ic"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span><input class="sp-input" placeholder="Search for apps, the web and images" spellcheck="false"></div>
      <div class="sp-tabs"><button data-m="all" class="on">All</button><button data-m="apps">Apps</button><button data-m="images">Images</button></div>
      <div class="sp-body"></div>
    </div>`);
    screen().appendChild(searchPanel);
    const input = searchPanel.querySelector(".sp-input");
    input.oninput = () => renderSearch(input.value);
    searchPanel.querySelectorAll(".sp-tabs button").forEach((b) => b.onclick = () => { setSearchMode(b.dataset.m); renderSearch(input.value); input.focus(); });
    input.onkeydown = (e) => {
      if (e.key === "Enter") { const first = searchPanel.querySelector(".sp-row"); if (first) first.click(); }
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("click", (e) => {
      if (searchPanel.classList.contains("open") && !searchPanel.contains(e.target) && !e.target.closest(".tb-search")) closeSearch();
    });
  }
  function openSearchApp(id) { closeSearch(); if (startMenu) startMenu.classList.remove("open"); open(id); }
  function searchRow(icon, title, sub, onClick) {
    const r = el(`<div class="sp-row"><div class="sp-row-ic">${icon}</div><div class="sp-row-tx"><div class="sp-row-t">${title}</div>${sub ? `<div class="sp-row-s">${sub}</div>` : ""}</div></div>`);
    r.onclick = onClick; return r;
  }
  // Rich knowledge cards for well-known web entities.
  const SEARCH_KNOWLEDGE = [
    { keys: ["roblox"], name: "Roblox", img: "assets/brand_roblox.png", desc: "Online platform where millions play and build 3D games together.", url: "https://www.roblox.com" },
    { keys: ["app store", "appstore", "apple store"], name: "App Store", img: "assets/brand_appstore.png", desc: "Apple's marketplace for iPhone, iPad, and Mac apps.", url: "https://www.apple.com/app-store/" },
    { keys: ["x", "twitter", "x app"], name: "X (formerly Twitter)", img: "assets/brand_xapp.png", desc: "Social platform for real-time posts, news, and conversation.", url: "https://x.com" },
    { keys: ["gemini", "google gemini"], name: "Gemini", img: "assets/brand_gemini.png", desc: "Google's family of multimodal AI models and assistant.", url: "https://gemini.google.com" },
    { keys: ["meta", "facebook meta"], name: "Meta", img: "assets/brand_meta.png", desc: "Parent company of Facebook, Instagram, WhatsApp, and Quest.", url: "https://about.meta.com" },
    { keys: ["tinder"], name: "Tinder", img: "assets/brand_tinder.png", desc: "The dating app that made swipe-to-match famous — meet people nearby.", url: "https://tinder.com" },
    { keys: ["starbucks", "star bucks"], name: "Starbucks", img: "assets/brand_starbucks.png", desc: "Global coffeehouse chain — order ahead, collect Stars, and pay in-app.", url: "https://www.starbucks.com" },
    { keys: ["playstation", "play station", "ps5", "psn"], name: "PlayStation", img: "assets/brand_playstation.png", desc: "Sony's gaming brand — consoles, exclusive games, and PlayStation Network.", url: "https://www.playstation.com" },
    { keys: ["grok", "grok ai"], name: "Grok", img: "assets/brand_grok.png", desc: "xAI's conversational AI assistant, built to answer questions with real-time knowledge.", url: "https://grok.com" },
    { keys: ["anydesk", "any desk"], name: "AnyDesk", img: "assets/brand_anydesk.png", desc: "Remote desktop software for accessing and controlling computers from anywhere.", url: "https://anydesk.com" },
    { keys: ["flower", "flowers", "daisy"], name: "Flower", img: "assets/brand_flower.png", desc: "The seed-bearing part of a plant — often bright and fragrant to attract pollinators like bees and butterflies.", url: "https://en.wikipedia.org/wiki/Flower" },
    { keys: ["doordash", "door dash"], name: "DoorDash", img: "assets/brand_doordash.png", desc: "On-demand food and grocery delivery from local restaurants and stores.", url: "https://www.doordash.com" },
  ];
  function knowledgeFor(q) { const s = q.toLowerCase(); return SEARCH_KNOWLEDGE.find((k) => k.keys.some((key) => key === s || (s.length >= 2 && key.startsWith(s)))); }
  // ---- Images search (Wikimedia Commons: free pictures, no key needed) ----
  let spMode = "all", spImgSeq = 0;
  function setSearchMode(m) { spMode = m; searchPanel.querySelectorAll(".sp-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.m === m)); }
  function fetchImages(q, n) {
    const u = "https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=query&generator=search&gsrnamespace=6&gsrlimit=" + n +
      "&prop=imageinfo&iiprop=url|mime&iiurlwidth=1024&gsrsearch=" + encodeURIComponent(q + " filetype:bitmap");
    return fetch(u).then((r) => r.json()).then((j) => Object.values((j.query && j.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0))
      .filter((p) => p.imageinfo && p.imageinfo[0].thumburl && /image\/(jpeg|png|gif|webp)/.test(p.imageinfo[0].mime || ""))
      .map((p) => ({ title: p.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""), file: p.title.replace(/^File:/, ""), big: p.imageinfo[0].thumburl, thumb: p.imageinfo[0].thumburl.replace(/\/(\d+)px-/, "/240px-"), page: p.imageinfo[0].descriptionurl })));
  }
  function imageGrid(host, q, n, more) {
    const seq = ++spImgSeq;
    if (window.SafeSearch && SafeSearch.on() && SafeSearch.isAdultText(q)) { host.appendChild(el(`<div class="sp-empty">🛡 SafeSearch is on — pictures for this search are hidden.</div>`)); return; }
    const grid = el(`<div class="sp-imgs"><div class="sp-empty">Finding pictures of “${q.replace(/</g, "&lt;")}”…</div></div>`);
    host.appendChild(grid);
    clearTimeout(imageGrid.t);
    imageGrid.t = setTimeout(() => fetchImages(q, n).then((list) => {
      if (seq !== spImgSeq) return;
      grid.innerHTML = "";
      if (!list.length) { grid.innerHTML = `<div class="sp-empty">No pictures found for “${q.replace(/</g, "&lt;")}”.</div>`; return; }
      list.forEach((im) => { const t = el(`<button class="sp-img" title="${im.title.replace(/"/g, "&quot;")}"><img src="${im.thumb}" alt="" loading="lazy" onerror="this.src='${im.big}'"></button>`); t.onclick = () => showImage(im); grid.appendChild(t); });
      if (more) { const m = el(`<button class="sp-more">See more images ›</button>`); m.onclick = () => { setSearchMode("images"); renderSearch(q); }; host.appendChild(m); }
    }).catch(() => { if (seq === spImgSeq) grid.innerHTML = `<div class="sp-empty">Couldn't load pictures. Check your connection.</div>`; }), 280);
  }
  function showImage(im) {
    document.querySelectorAll(".sp-light").forEach((x) => x.remove());
    const ov = el(`<div class="sp-light"><div class="sp-light-box"><img src="${im.big}" alt=""><div class="sp-light-bar"><b>${im.title.replace(/</g, "&lt;")}</b><span class="grow"></span><button class="sp-l-save">Save to Pictures</button><button class="sp-l-open">Open page</button><button class="sp-l-x">Close</button></div><div class="sp-light-src">From Wikimedia Commons — check the page for the picture's license.</div></div></div>`);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.querySelector(".sp-l-x").onclick = () => ov.remove();
    ov.querySelector(".sp-l-open").onclick = () => { ov.remove(); closeSearch(); if (window.Browser) Browser.openTo(im.page); };
    ov.querySelector(".sp-l-save").onclick = (e) => {
      const b = e.currentTarget; b.disabled = true; b.textContent = "Saving…";
      fetch(im.big).then((r) => r.blob()).then((blob) => {
        if (!window.VFS || !VFS.nodeFromFile) throw new Error("no vfs");
        const name = im.file.replace(/[\\/:*?"<>|]/g, "_");
        return VFS.nodeFromFile(new File([blob], name, { type: blob.type || "image/jpeg" })).then((node) => {
          if (!S().appData.files && window.FilesParts) S().appData.files = { root: FilesParts.FILE_SEED() };
          const root = S().appData.files.root; if (!root.Pictures) root.Pictures = { type: "folder", children: {} };
          const kids = root.Pictures.children; let nm = name, i = 2; while (kids[nm]) nm = name.replace(/(\.[^.]+)?$/, " (" + (i++) + ")$1");
          kids[nm] = node; State.save();
          b.textContent = "Saved ✓"; if (window.Notify) Notify.show({ icon: "", title: "Saved to Pictures", body: nm, onClick: () => { window.FilesStartPath = ["Pictures"]; open("fileexplorer"); } });
        });
      }).catch(() => { b.disabled = false; b.textContent = "Couldn't save — try again"; });
    };
    screen().appendChild(ov);
  }

  function renderSearch(q) {
    const body = searchPanel.querySelector(".sp-body");
    body.innerHTML = "";
    const query = (q || "").trim();
    if (spMode === "images") {
      if (!query) { body.appendChild(el(`<div class="sp-empty">Type something to search for pictures — like “cats”, “mountains” or “space”.</div>`)); return; }
      body.appendChild(el(`<div class="sp-head">Images</div>`));
      imageGrid(body, query, 30, false);
      return;
    }
    const apps = allInstalledApps();
    const matches = query ? apps.filter((a) => a.name.toLowerCase().includes(query.toLowerCase())) : apps.slice(0, 8);
    const know = query ? knowledgeFor(query) : null;
    if (know) {
      body.appendChild(el(`<div class="sp-head">Top result</div>`));
      const card = el(`<div class="sp-know"><img class="sp-know-img" src="${know.img}?v=1" alt=""><div class="sp-know-tx"><div class="sp-know-name">${know.name}</div><div class="sp-know-desc">${know.desc}</div></div></div>`);
      card.onclick = () => { closeSearch(); if (window.Browser) window.Browser.openTo(know.url); };
      body.appendChild(card);
    }
    // Dictionary knowledge card — any single word shows its definition (offline).
    const dict = (!know && /^[a-zA-Z]{2,}$/.test(query)) ? (window.DICTIONARY && window.DICTIONARY[query.toLowerCase()]) : null;
    if (dict) {
      body.appendChild(el(`<div class="sp-head">Dictionary</div>`));
      body.appendChild(el(`<div class="sp-know"><div class="sp-know-img" style="display:flex;align-items:center;justify-content:center;font-size:22px;background:#eef1f6;color:#3a4a63">📖</div><div class="sp-know-tx"><div class="sp-know-name">${query.toLowerCase()} <span style="font-weight:400;font-style:italic;opacity:.65">· ${dict.pos}</span></div><div class="sp-know-desc">${dict.def}</div></div></div>`));
    }
    if (matches.length) {
      body.appendChild(el(`<div class="sp-head">Apps</div>`));
      const grid = el(`<div class="sp-list"></div>`);
      matches.slice(0, 8).forEach((a) => grid.appendChild(searchRow(Icon.mini(a.id === "duolingo" ? duoIconKey(true) : a.id, a.name), a.name, "App", () => openSearchApp(a.id))));
      body.appendChild(grid);
    } else if (!know) {
      body.appendChild(el(`<div class="sp-head">Apps</div>`));
      body.appendChild(el(`<div class="sp-empty">No apps found for “${query.replace(/</g, "&lt;")}”</div>`));
    }
    if (spMode === "apps") return;
    if (query && query.length > 1) {
      body.appendChild(el(`<div class="sp-head">Images</div>`));
      const sec = el(`<div class="sp-img-sec"></div>`); body.appendChild(sec);
      imageGrid(sec, query, 8, true);
    }
    if (query) {
      body.appendChild(el(`<div class="sp-head">Search the web</div>`));
      const web = el(`<div class="sp-list"></div>`);
      web.appendChild(searchRow(`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>`,
        `${query.replace(/</g, "&lt;")} - See web results`, "Bing search", () => { closeSearch(); if (window.Browser) window.Browser.openTo("https://www.bing.com/search?q=" + encodeURIComponent(query)); }));
      body.appendChild(web);
    }
  }
  function openSearch() {
    if (!searchPanel) buildSearchPanel();
    if (startMenu) startMenu.classList.remove("open");
    setSearchMode("all");
    renderSearch("");
    searchPanel.classList.add("open");
    const input = searchPanel.querySelector(".sp-input"); input.value = ""; setTimeout(() => input.focus(), 30);
  }
  function closeSearch() { if (searchPanel) searchPanel.classList.remove("open"); }
  function toggleSearch() { if (searchPanel && searchPanel.classList.contains("open")) closeSearch(); else openSearch(); }

  function updateStartUser() {
    if (!startMenu) return;
    const pr = S().profile || {};
    const ava = startMenu.querySelector(".start-ava");
    ava.innerHTML = pr.picture ? `<img src="${pr.picture}" alt="">` : `<svg viewBox="0 0 40 40" width="100%" height="100%"><defs><linearGradient id="sm12-avg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b061d6"/><stop offset="1" stop-color="#3b7fd8"/></linearGradient></defs><circle cx="20" cy="14" r="7.5" fill="url(#sm12-avg)"/><path d="M6 34c1-7.5 6.5-11 14-11s13 3.5 14 11z" fill="url(#sm12-avg)" opacity=".9"/></svg>`;
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
      { name: "Essentials", apps: ESSENTIALS.slice() },
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
    const f = (filter || "").trim().toLowerCase();
    const list = allInstalledApps().slice().sort((x, y) => x.name.localeCompare(y.name));
    const ikey = (a) => (a.id === "duolingo" ? duoIconKey(true) : a.id);
    const escq = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    // ---- left: every app, A–Z (or search results) ----
    const left = startMenu.querySelector(".sm12-list"); left.innerHTML = "";
    const shown = f ? list.filter((a) => a.name.toLowerCase().includes(f)).sort((x, y) => (y.name.toLowerCase().startsWith(f) ? 1 : 0) - (x.name.toLowerCase().startsWith(f) ? 1 : 0)) : list;
    let letter = "";
    if (f && shown.length) left.appendChild(el(`<div class="sm12-letter">Best match</div>`));
    shown.forEach((a, i) => {
      if (!f) { const L = /[a-z]/i.test(a.name[0]) ? a.name[0].toUpperCase() : "#"; if (L !== letter) { letter = L; left.appendChild(el(`<div class="sm12-letter">${L}</div>`)); } }
      else if (i === 1) left.appendChild(el(`<div class="sm12-letter">Apps</div>`));
      const row = el(`<button class="sm12-app"><span class="sm12-app-ic">${Icon.mini(ikey(a), a.name)}</span><span>${a.name}</span></button>`);
      row.onclick = () => { startMenu.classList.remove("open"); open(a.id); };
      row.oncontextmenu = (e) => { e.preventDefault(); startAppMenu(a, e); };
      left.appendChild(row);
    });
    if (f) {   // matching files too, then the web
      const files = (window.FilesHelper ? FilesHelper.recent(400) : []).filter((x) => x.name.toLowerCase().includes(f)).slice(0, 4);
      if (files.length) {
        left.appendChild(el(`<div class="sm12-letter">Files</div>`));
        files.forEach((x) => { const r = el(`<button class="sm12-app"><span class="sm12-app-ic">${FilesHelper.glyph(x.name, x.node, 22)}</span><span>${escq(x.name)}</span></button>`); r.onclick = () => { startMenu.classList.remove("open"); if (window.VFS) VFS.openNode(x.name, x.node); }; left.appendChild(r); });
      }
      if (!shown.length && !files.length) left.appendChild(el(`<div class="sm12-letter">No apps found</div>`));
      const web = el(`<button class="sm12-app"><span class="sm12-app-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg></span><span>Search the web for “${escq(filter.trim())}”</span></button>`);
      web.onclick = () => { startMenu.classList.remove("open"); if (window.Browser) window.Browser.openTo("https://www.bing.com/search?q=" + encodeURIComponent(filter.trim())); };
      left.appendChild(web);
    }
    // ---- right top: folders ----
    const folders = startMenu.querySelector(".sm12-folders");
    if (!folders.childElementCount) {
      [["Documents", "assets/documentsfolder.png"], ["Pictures", "assets/picturesfolder.png"], ["Music", "assets/musicfolder.png"]].forEach(([n, src]) => {
        const b = el(`<button class="sm12-folder"><img src="${src}?v=7" alt=""><span>${n}</span></button>`);
        b.onclick = () => { startMenu.classList.remove("open"); window.FilesStartPath = [n]; open("fileexplorer"); };
        folders.appendChild(b);
      });
    }
    paintStartClock();
    // ---- pinned (or all apps) ----
    const all = startMenu.classList.contains("sm12-showall");
    startMenu.querySelector(".sm12-pins-t").textContent = all ? "All apps" : "Pinned";
    startMenu.querySelector(".sm12-all").innerHTML = all ? "<span>‹</span> Back" : "All <span>›</span>";
    const grid = startMenu.querySelector(".pinned-grid"); grid.innerHTML = "";
    const pins = all ? list : startPins().map((id) => list.find((a) => a.id === id)).filter(Boolean);
    pins.forEach((a) => {
      const t = el(`<button class="sm12-tile"><span class="sm12-tile-ic">${Icon.md(ikey(a), a.name)}</span><span class="sm12-tile-n">${a.name}</span></button>`);
      t.onclick = () => { startMenu.classList.remove("open"); open(a.id); };
      t.oncontextmenu = (e) => { e.preventDefault(); startAppMenu(a, e); };
      grid.appendChild(t);
    });
    if (!pins.length) grid.appendChild(el(`<div class="sm12-empty">Right-click an app and choose “Pin to Start”.</div>`));
    // ---- suggested files (falls back to recently opened apps) ----
    const box = startMenu.querySelector(".sm12-files"); box.innerHTML = "";
    const recent = window.FilesHelper ? FilesHelper.recent(6) : [];
    const head = startMenu.querySelector(".sm12-sugg b");
    if (recent.length) {
      head.textContent = "Suggested files";
      recent.forEach((x) => {
        const r = el(`<button class="sm12-file"><span class="sm12-file-ic">${FilesHelper.glyph(x.name, x.node, 34)}</span><span class="sm12-file-tx"><b>${escq(x.name)}</b><span>${FilesHelper.ago(x.node.ts)}</span></span></button>`);
        r.onclick = () => { startMenu.classList.remove("open"); if (window.VFS) VFS.openNode(x.name, x.node); };
        box.appendChild(r);
      });
    } else {
      head.textContent = "Recently opened";
      const rec = (S().appData.recentApps || []).map((id) => list.find((a) => a.id === id)).filter(Boolean).slice(0, 6);
      if (!rec.length) box.appendChild(el(`<div class="sm12-empty">Apps and files you open will show up here.</div>`));
      rec.forEach((a) => { const r = el(`<button class="sm12-file"><span class="sm12-file-ic">${Icon.mini(ikey(a), a.name)}</span><span class="sm12-file-tx"><b>${a.name}</b><span>App</span></span></button>`); r.onclick = () => { startMenu.classList.remove("open"); open(a.id); }; box.appendChild(r); });
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
    return ["browser", "chrome", "edge", "settings", "calculator", "mediaplayer", "youtubeApp", "ms365", "notepad", "copilot", "imagestudio", "textgen", "fileexplorer", "duolingo", "blockfinder", "messenger", "word", "powerpoint", "excel", "forms", "clock", "outlook", "onenote", "minecraft", "mclauncher", "xbox", "curseforge", "codeeditor", "vscode", "acrobat", "qrcode", "grammarly", "achievements", "store__"].includes(id) || (window.EXTRA_DEFAULT_APPS || []).includes(id);
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
    refreshWifi: () => refreshWifiTray(),
    // Window-management hooks used by js/winx.js (snap, Alt+Tab, Task View, desktops).
    windows: () => openWindows,
    entryFor: (win) => openWindows.find((e) => e.win === win) || null,
    focusWindow: (win) => focusWindow(win),
    refreshTaskbarActive: () => refreshTaskbarActive(),
    topZ: () => zCounter,
    pinToTaskbar: (id) => pinToTaskbar(id),
    unpinFromTaskbar: (id) => unpinFromTaskbar(id),
    taskbarPins: () => taskbarPins().slice(),
    showTaskbarMenu: (btn) => showJumpList(btn),
  };
})();
