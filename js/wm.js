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
    { id: "store__", name: "Store" },
    { id: "youtubeApp", name: "YouTube" },
    { id: "copilot", name: "Copilot" },
    { id: "settings", name: "Settings" },
    { id: "calculator", name: "Calculator" },
  ];

  function renderDesktopIcons() {
    const iconWrap = desktop.querySelector(".desktop-icons");
    iconWrap.innerHTML = "";
    const seen = new Set();
    const items = DEFAULT_SHORTCUTS.slice();
    // Installed apps from the Store stay on the home screen.
    S().installedApps.forEach((id) => {
      if (DEFAULT_SHORTCUTS.some((s) => s.id === id)) return;
      const app = Catalog.storeApps.find((a) => a.id === id);
      if (app) items.push({ id: app.id, name: app.name });
    });
    items.forEach((s) => {
      if (seen.has(s.id)) return; seen.add(s.id);
      const ikey = s.id === "duolingo" ? duoIconKey(true) : s.id;
      const ic = el(`<div class="dicon"><div class="glyph">${Icon.big(ikey, s.name)}</div><div class="label">${s.name}</div></div>`);
      ic.ondblclick = () => open(s.id);
      iconWrap.appendChild(ic);
    });
  }

  function buildDesktop() {
    desktop = el(`<div class="desktop"><div class="desktop-icons"></div></div>`);
    screen().appendChild(desktop);
    applyWallpaper();
    renderDesktopIcons();
    buildTaskbar();
    startClock();
  }

  function applyWallpaper() {
    const wp = S().desktop.wallpaper;
    if (!wp || wp === "default") {
      desktop.style.background = S().theme === "dark"
        ? "radial-gradient(circle at 50% 30%, #1b3a66, #0a1f3f 70%)"
        : "radial-gradient(circle at 50% 30%, #4a90e2, #0a3d8f 80%)";
    } else if (wp.startsWith("data:") || wp.startsWith("http")) {
      desktop.style.background = `url(${wp}) center/cover`;
    } else {
      desktop.style.background = wp; // color
    }
  }
  window.applyWallpaper = applyWallpaper;

  // ---------------- Taskbar ----------------
  function buildTaskbar() {
    taskbar = el(`<div class="taskbar">
      <div class="tb-btn start" title="Start">${Icon.mini("start", "Windows")}</div>
      <div class="tb-btn" data-open="browser" title="Edge">${Icon.mini("browser", "Edge")}</div>
      <div class="tb-btn" data-open="store__" title="Store">${Icon.mini("store__", "Store")}</div>
      <div class="tb-btn" data-open="duolingo" title="Duolingo">${Icon.mini(duoIconKey(false), "Duolingo")}</div>
      <div class="tb-btn" data-open="settings" title="Settings">${Icon.mini("settings", "Settings")}</div>
      <div class="tb-clock" id="tbClock"></div>
    </div>`);
    screen().appendChild(taskbar);
    taskbar.querySelector(".start").onclick = toggleStart;
    taskbar.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => open(b.dataset.open));
    buildStartMenu();
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
    taskbar.insertBefore(btn, taskbar.querySelector(".tb-clock"));
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

  // ---------------- Start menu ----------------
  function buildStartMenu() {
    startMenu = el(`<div class="start-menu">
      <input class="search" placeholder="${I18n.t("search_apps")}">
      <div class="app-grid"></div>
    </div>`);
    screen().appendChild(startMenu);
    const search = startMenu.querySelector(".search");
    search.oninput = () => renderStartApps(search.value);
    renderStartApps("");
    document.addEventListener("click", (e) => {
      if (startMenu.classList.contains("open") && !startMenu.contains(e.target) && !e.target.closest(".start")) {
        startMenu.classList.remove("open");
      }
    });
  }

  function renderStartApps(filter) {
    const grid = startMenu.querySelector(".app-grid");
    grid.innerHTML = "";
    // Store is always available; plus installed + builtin apps
    const list = [{ id: "store__", name: "Store" }];
    Catalog.storeApps.forEach((a) => {
      const installed = a.builtin || a.game ? S().installedApps.includes(a.id) || isDefaultInstalled(a.id) : false;
      if (a.decorative) return;
      if (installed) list.push({ id: a.id, name: a.name });
    });
    const f = (filter || "").toLowerCase();
    list.filter((a) => a.name.toLowerCase().includes(f)).forEach((a) => {
      const ikey = a.id === "duolingo" ? duoIconKey(true) : a.id;
      const tile = el(`<div class="app-tile"><div class="ic">${Icon.md(ikey, a.name)}</div><div class="nm">${a.name}</div></div>`);
      tile.onclick = () => { startMenu.classList.remove("open"); open(a.id); };
      grid.appendChild(tile);
    });
  }

  function isDefaultInstalled(id) {
    return ["browser", "settings", "calculator", "mediaplayer", "youtubeApp", "ms365", "notepad", "copilot", "imagestudio", "textgen", "fileexplorer", "duolingo", "blockfinder", "minecraft", "store__"].includes(id);
  }

  function toggleStart() { startMenu.classList.toggle("open"); renderStartApps(""); }

  // ---------------- App opening dispatch ----------------
  function open(appId) {
    if (appId === "store__") { AppRegistry.store(); return; }
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
