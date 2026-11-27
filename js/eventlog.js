/* Event Log + Event Viewer (eventvwr.msc).
   window.EventLog = { add(log, level, source, id, message), list(log), clear(log), on(fn) }
   keeps the newest ~500 entries in State.data.appData.eventLog. Everything logged here is a
   REAL event in this desktop: page boots, app windows opening/closing, sign-ins at the lock
   screen (and wrong PINs), BSODs, installs/uninstalls, Windows Update, device renames,
   network up/down and uncaught script errors. Hooks wrap existing functions from here, so no
   other file is edited. */
(function () {
  "use strict";
  const MAX = 500;
  const LOGS = ["Application", "Security", "Setup", "System"];
  const LEVELS = ["Critical", "Error", "Warning", "Information", "Verbose", "Audit Success", "Audit Failure"];
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  // The original State.save (we wrap the public one below to watch for installs etc.).
  const rawSave = State.save;
  function store() {
    const d = S(); if (!d.appData) d.appData = {};
    if (!Array.isArray(d.appData.eventLog)) d.appData.eventLog = [];
    return d.appData.eventLog;
  }
  function meta() {
    const d = S(); if (!d.appData) d.appData = {};
    return d.appData.eventLogMeta || (d.appData.eventLogMeta = { seq: 0, record: {} });
  }
  const computer = () => { try { const n = S().deviceName; if (n) return n; const u = ((S().profile && S().profile.username) || "User").replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "USER"; return u.toUpperCase() + "-PC"; } catch (_) { return "DESKTOP-PC"; } };
  const userName = () => { try { return (S().profile && S().profile.username) || "User"; } catch (_) { return "User"; } };

  // Debounced persistence: one State.save for a burst of events. Cancelled on unload so a
  // pending save can never overwrite a backup restore / reset that is reloading the page.
  let saveTimer = 0, unloading = false;
  function persistSoon() { if (unloading) return; clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (!unloading) { try { rawSave.call(State); } catch (_) {} } }, 800); }
  function persistNow() { clearTimeout(saveTimer); try { rawSave.call(State); } catch (_) {} }
  window.addEventListener("beforeunload", () => { unloading = true; clearTimeout(saveTimer); });
  window.addEventListener("pagehide", () => { unloading = true; clearTimeout(saveTimer); });

  const listeners = new Set();
  function emit() { listeners.forEach((fn) => { try { fn(); } catch (_) {} }); }

  const TASKS = { Security: { 4624: "Logon", 4625: "Logon", 4634: "Logoff", 4647: "Logoff", 4800: "Other Logon/Logoff Events", 4801: "Other Logon/Logoff Events", 4723: "User Account Management", 4781: "User Account Management", 1102: "Log clear" } };
  function add(log, level, source, id, message, opts) {
    try {
      log = LOGS.indexOf(log) >= 0 ? log : "Application";
      level = LEVELS.indexOf(level) >= 0 ? level : "Information";
      const m = meta(), arr = store();
      const e = {
        n: ++m.seq, log, level, source: String(source || "Application"), id: id | 0, msg: String(message || "").slice(0, 900),
        ts: Date.now(), user: (opts && opts.user) || (log === "Security" ? "N/A" : userName()), pc: computer(),
        task: (opts && opts.task) || (TASKS[log] && TASKS[log][id]) || "None",
      };
      if (opts && opts.data) e.data = opts.data;
      arr.push(e);
      if (arr.length > MAX) arr.splice(0, arr.length - MAX);
      if (opts && opts.now) persistNow(); else persistSoon();
      emit();
      return e;
    } catch (_) { return null; }
  }
  function list(log) {
    const arr = store();
    const out = log ? arr.filter((e) => e.log === log) : arr.slice();
    return out.reverse(); // newest first
  }
  function clear(log) {
    const arr = store(), before = arr.length;
    for (let i = arr.length - 1; i >= 0; i--) if (!log || arr[i].log === log) arr.splice(i, 1);
    // Windows always records who cleared a log.
    if (log === "Security") add("Security", "Audit Success", "Microsoft Windows security auditing.", 1102, "The audit log was cleared.\r\nSubject:\r\n\tAccount Name:\t" + userName() + "\r\n\tAccount Domain:\t" + computer(), { user: userName(), task: "Log clear" });
    else add("System", "Information", "Eventlog", 104, "The " + (log || "every") + " log file was cleared.");
    persistNow();
    return before - arr.length;
  }
  window.EventLog = { add, list, clear, on(fn) { listeners.add(fn); return () => listeners.delete(fn); }, LOGS, LEVELS };

  // =====================================================================
  //  REAL hooks
  // =====================================================================
  // ---- boot (each page load is a boot of this PC) ----
  const BOOT_KEY = "win12_evt_session";
  (function boot() {
    let prev = null; try { prev = JSON.parse(localStorage.getItem(BOOT_KEY) || "null"); } catch (_) {}
    if (prev && !prev.clean && prev.at) {
      add("System", "Error", "EventLog", 6008, "The previous system shutdown at " + new Date(prev.last || prev.at).toLocaleString() + " was unexpected.");
      add("System", "Critical", "Kernel-Power", 41, "The system has rebooted without cleanly shutting down first. This error could be caused if the system stopped responding, crashed, or lost power unexpectedly.");
    } else if (prev && prev.clean) {
      add("System", "Information", "EventLog", 6006, "The Event log service was stopped.", { });
    }
    const t = new Date();
    add("System", "Information", "Kernel-General", 12, "The operating system started at system time " + t.toISOString() + ".");
    add("System", "Information", "Kernel-Boot", 27, "The boot type was 0x0.\r\n(A full boot of the page: " + location.pathname + ")");
    add("System", "Information", "EventLog", 6005, "The Event log service was started.");
    let ua = ""; try { ua = navigator.userAgent; } catch (_) {}
    add("System", "Information", "EventLog", 6009, "Microsoft (R) Windows (R) 12.00. 26100 Multiprocessor Free.\r\nHost browser: " + ua);
    const mark = (clean) => { try { localStorage.setItem(BOOT_KEY, JSON.stringify({ at: t.getTime(), last: Date.now(), clean })); } catch (_) {} };
    mark(false);
    setInterval(() => mark(false), 60000);
    window.addEventListener("pagehide", () => mark(true));
  })();

  // ---- app windows: watch #screen for .win elements (catches every launch path) ----
  let lastOpen = { id: "", at: 0 };
  function hookWM() {
    if (!window.WM || WM.__evtHooked) return;
    WM.__evtHooked = true;
    const o = WM.open;
    WM.open = function (id) {
      lastOpen = { id: String(id || ""), at: Date.now() };
      const known = (window.Catalog && Catalog.storeApps.some((a) => a.id === id || a.builtin === id)) || (window.AppRegistry && AppRegistry[id]) || id === "store__" || id === "recyclebin";
      if (!known) add("Application", "Warning", "Shell-Core", 9706, "Windows cannot find '" + id + "'. The app isn't registered on this PC.");
      return o.apply(this, arguments);
    };
  }
  hookWM();
  function watchWindows() {
    const scr = document.getElementById("screen"); if (!scr) return;
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (!n || n.nodeType !== 1 || !n.classList.contains("win")) continue;
        const title = ((n.querySelector(".win-titlebar .t-text") || {}).textContent || "").trim() || "Untitled";
        const id = Date.now() - lastOpen.at < 1500 ? lastOpen.id : "";
        const started = Date.now();
        add("Application", "Information", "Shell-Core", 9707, "Started execution of command '" + title + "'." + (id ? "\r\nApp ID: " + id : ""), { data: { app: id || title } });
        n.addEventListener("wm-cleanup", () => {
          const secs = Math.round((Date.now() - started) / 1000);
          add("Application", "Information", "Shell-Core", 9708, "Finished execution of command '" + title + "' (ran for " + secs + " s).", { data: { app: id || title } });
        }, { once: true });
      }
    }).observe(scr, { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchWindows); else watchWindows();

  // ---- blue screen ----
  if (window.BSOD && BSOD.show && !BSOD.__evt) {
    const o = BSOD.show; BSOD.__evt = true;
    BSOD.show = function (opts) {
      const code = (opts && opts.stopCode) || "CRITICAL_PROCESS_DIED";
      add("System", "Critical", "BugCheck", 1001, "The computer has rebooted from a bugcheck. The bugcheck was: 0x000000ef (" + code + "). A dump was saved in: C:\\Windows\\MEMORY.DMP.", { now: true });
      add("System", "Critical", "Kernel-Power", 41, "The system has rebooted without cleanly shutting down first. Stop code: " + code + ".", { now: true });
      return o.apply(this, arguments);
    };
  }

  // ---- lock screen: sign-in (4624), lock/unlock (4800/4801), wrong PIN (4625) ----
  let everUnlocked = false;
  if (window.Lock && Lock.run && !Lock.__evt) {
    const o = Lock.run; Lock.__evt = true;
    Lock.run = function (cb) {
      const relock = everUnlocked;
      if (relock) add("Security", "Audit Success", "Microsoft Windows security auditing.", 4800, "The workstation was locked.\r\nSubject:\r\n\tAccount Name:\t" + userName() + "\r\n\tAccount Domain:\t" + computer(), { user: userName() });
      const wrapped = function () {
        everUnlocked = true;
        const kind = (S().profile && S().profile.authType === "password") ? "Password" : "PIN";
        if (relock) add("Security", "Audit Success", "Microsoft Windows security auditing.", 4801, "The workstation was unlocked.\r\nSubject:\r\n\tAccount Name:\t" + userName() + "\r\n\tAccount Domain:\t" + computer(), { user: userName() });
        else add("Security", "Audit Success", "Microsoft Windows security auditing.", 4624, "An account was successfully logged on.\r\nLogon Type:\t\t2 (Interactive)\r\nNew Logon:\r\n\tAccount Name:\t" + userName() + "\r\n\tAccount Domain:\t" + computer() + "\r\nAuthentication Package:\tNegotiate (" + kind + ")", { user: userName() });
        return cb && cb.apply(this, arguments);
      };
      const r = o.call(this, wrapped);
      // Failed attempts: the lock card shows "Incorrect — try again."
      try {
        const layers = document.querySelectorAll(".lock-screen"), layer = layers[layers.length - 1];
        const err = layer && layer.querySelector(".lock-err");
        if (err) new MutationObserver(() => {
          const t = err.textContent || "";
          if (/incorrect|not recognized/i.test(t)) add("Security", "Audit Failure", "Microsoft Windows security auditing.", 4625, "An account failed to log on.\r\nFailure Reason:\t" + (/finger/i.test(t) ? "Fingerprint not recognized." : "Unknown user name or bad password.") + "\r\nAccount Name:\t" + userName() + "\r\nStatus:\t0xC000006D", { user: userName() });
        }).observe(err, { childList: true, characterData: true, subtree: true });
      } catch (_) {}
      return r;
    };
  }
  if (window.Setup && Setup.run && !Setup.__evt) {
    const o = Setup.run; Setup.__evt = true;
    Setup.run = function () { add("Setup", "Information", "Microsoft-Windows-Setup", 1, "Windows Setup started (Out-of-box experience)."); return o.apply(this, arguments); };
  }

  // ---- State.save wrapper: diff a few things cheaply on every save ----
  function appName(id) { const a = window.Catalog && Catalog.storeApps.find((x) => x.id === id); return a ? a.name : id; }
  function sys32Count() { try { const c = S().appData.files.root["Local Disk (C:)"].children.Windows.children.System32.children; return Object.keys(c).length; } catch (_) { return -1; } }
  function snap() {
    const d = S();
    return {
      apps: (d.installedApps || []).slice(),
      upd: !!(d.update && d.update.installed),
      setup: !!d.setupCompleted,
      name: d.deviceName || "",
      user: (d.profile && d.profile.username) || "",
      secret: (d.profile && d.profile.secret) || "",
      broken: !!d.systemBroken,
      sys32: sys32Count(),
      theme: d.theme,
    };
  }
  let last = null;
  function diff() {
    const now = snap();
    if (!last) { last = now; return; }
    const p = last; last = now;
    const inst = (S().appData.installDates = S().appData.installDates || {});
    now.apps.filter((id) => p.apps.indexOf(id) < 0).forEach((id) => {
      inst[id] = Date.now();
      add("Application", "Information", "MsiInstaller", 11707, "Product: " + appName(id) + " -- Installation completed successfully.");
      add("Application", "Information", "MsiInstaller", 1033, "Windows Installer installed the product. Product Name: " + appName(id) + ". Product Version: 1.0.0. Product Language: 1033. Manufacturer: Microsoft Store. Installation success or error status: 0.");
    });
    p.apps.filter((id) => now.apps.indexOf(id) < 0).forEach((id) => {
      delete inst[id];
      add("Application", "Information", "MsiInstaller", 11724, "Product: " + appName(id) + " -- Removal completed successfully.");
      add("Application", "Information", "MsiInstaller", 1034, "Windows Installer removed the product. Product Name: " + appName(id) + ". Removal success or error status: 0.");
    });
    if (!p.upd && now.upd) {
      add("System", "Information", "WindowsUpdateClient", 19, "Installation Successful: Windows successfully installed the following update: Cumulative Update for Windows 12.");
      add("Setup", "Information", "Microsoft-Windows-Servicing", 2, "Package KB5050012 was successfully changed to the Installed state.");
    }
    if (!p.setup && now.setup) add("Setup", "Information", "Microsoft-Windows-Setup", 2, "Windows Setup completed successfully for user " + userName() + ".");
    if (p.name !== now.name && now.name) add("System", "Information", "EventLog", 6011, "The NetBIOS name and DNS host name of this machine have been changed from " + (p.name || computer()) + " to " + now.name + ".");
    if (p.user && p.user !== now.user && now.user) add("Security", "Audit Success", "Microsoft Windows security auditing.", 4781, "The name of an account was changed.\r\n\tOld Account Name:\t" + p.user + "\r\n\tNew Account Name:\t" + now.user, { user: now.user });
    if (p.secret !== now.secret && p.setup) add("Security", "Audit Success", "Microsoft Windows security auditing.", 4723, "An attempt was made to change an account's password.\r\nTarget Account Name:\t" + now.user, { user: now.user });
    if (!p.broken && now.broken) add("System", "Critical", "Wininit", 1015, "Critical system files are missing from C:\\Windows\\System32. Windows will start recovery.", { now: true });
    if (p.sys32 >= 0 && p.sys32 < 10 && now.sys32 >= 10) add("Application", "Information", "Windows Resource Protection", 1000, "Windows Resource Protection found corrupt files and successfully repaired them. C:\\Windows\\System32 was restored (" + now.sys32 + " items).");
    if (p.sys32 >= 10 && now.sys32 >= 0 && now.sys32 < 10) add("System", "Error", "Windows Resource Protection", 1001, "Files Windows needs were removed from C:\\Windows\\System32 (" + now.sys32 + " items left).");
    if (p.theme !== now.theme && p.setup) add("Application", "Information", "Themes", 1, "The app theme changed from '" + (p.theme || "auto") + "' to '" + now.theme + "'.");
  }
  last = snap();
  State.save = function () {
    try { diff(); } catch (_) {}
    return rawSave.apply(State, arguments);
  };

  // ---- network up/down (real browser events) ----
  window.addEventListener("online", () => add("System", "Information", "NetworkProfile", 10000, "Network Connected. Name: " + ((S().appData.quickSettings && S().appData.quickSettings.ssid) || "Network") + "\r\nType: Managed"));
  window.addEventListener("offline", () => add("System", "Warning", "NetworkProfile", 10001, "Network Disconnected. This device went offline."));

  // ---- uncaught script errors (rate limited) ----
  let errWindow = 0, errCount = 0;
  function errOk() { const t = Date.now(); if (t - errWindow > 60000) { errWindow = t; errCount = 0; } return ++errCount <= 15; }
  window.addEventListener("error", (e) => {
    if (!e || !e.message || !errOk()) return;
    const file = String(e.filename || "").split("/").pop().split("?")[0];
    add("Application", "Error", "Application Error", 1000, "Faulting application name: " + (file || "unknown") + "\r\nException: " + e.message + "\r\nFaulting module path: " + (e.filename || "") + ":" + (e.lineno || 0) + ":" + (e.colno || 0));
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (!errOk()) return;
    const r = e && e.reason; const msg = r && (r.message || String(r)) || "Unknown";
    add("Application", "Error", "Application Error", 1026, "Application: browser runtime\r\nDescription: The process was terminated due to an unhandled promise rejection.\r\nException Info: " + msg);
  });

  // =====================================================================
  //  Event Viewer UI
  // =====================================================================
  const LV_ICON = {
    Critical: '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="7" fill="#a80000"/><path d="M5.2 5.2l5.6 5.6M10.8 5.2l-5.6 5.6" stroke="#fff" stroke-width="1.8"/></svg>',
    Error: '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="7" fill="#e81123"/><path d="M8 4v5.2" stroke="#fff" stroke-width="1.9"/><circle cx="8" cy="11.6" r="1.1" fill="#fff"/></svg>',
    Warning: '<svg viewBox="0 0 16 16" width="15" height="15"><path d="M8 1.5l7 13H1z" fill="#ffb900" stroke="#c48a00" stroke-width=".8"/><path d="M8 6v4.4" stroke="#222" stroke-width="1.6"/><circle cx="8" cy="12.3" r=".95" fill="#222"/></svg>',
    Information: '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="7" fill="#0067c0"/><path d="M8 7v5" stroke="#fff" stroke-width="1.8"/><circle cx="8" cy="4.7" r="1.1" fill="#fff"/></svg>',
    Verbose: '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="8" cy="8" r="7" fill="#8a8a8a"/></svg>',
    "Audit Success": '<svg viewBox="0 0 16 16" width="15" height="15"><circle cx="6" cy="9" r="3.4" fill="none" stroke="#b58500" stroke-width="1.8"/><path d="M8.5 6.5L14 1M11.5 3.5l1.8 1.8" stroke="#b58500" stroke-width="1.8"/></svg>',
    "Audit Failure": '<svg viewBox="0 0 16 16" width="15" height="15"><path d="M3 2h10v9a5 5 0 0 1-10 0z" fill="#5a5a5a"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" stroke-width="1.6"/></svg>',
  };
  const FOLDER = '<svg viewBox="0 0 16 16" width="15" height="15"><path d="M1 4h5l1.5 1.5H15v8H1z" fill="#ffc83d"/><path d="M1 6h14v7.5H1z" fill="#ffd96a"/></svg>';
  const LOGIC = '<svg viewBox="0 0 16 16" width="15" height="15"><rect x="2" y="1.5" width="12" height="13" rx="1.5" fill="#fff" stroke="#6b7a90"/><path d="M4.5 5h7M4.5 8h7M4.5 11h4.5" stroke="#6b7a90"/></svg>';
  const fmtDate = (ts) => { const d = new Date(ts); return d.toLocaleDateString() + " " + d.toLocaleTimeString(); };

  function openViewer() {
    const ref = WM.createWindow({ title: "Event Viewer", icon: Icon.mini("eventviewer", "Event Viewer"), width: Math.min(980, window.innerWidth - 30), height: Math.min(620, window.innerHeight - 90), appId: "eventviewer" });
    const body = ref.body; body.classList.add("st-host");
    body.innerHTML = `<div class="st-app st-ev">
      <div class="st-menubar"><button data-m="file">File</button><button data-m="action">Action</button><button data-m="view">View</button><button data-m="help">Help</button></div>
      <div class="st-toolbar">
        <button class="st-tb" data-a="refresh" title="Refresh">${svgI("refresh")}<span>Refresh</span></button>
        <button class="st-tb" data-a="filter" title="Filter Current Log">${svgI("filter")}<span>Filter Current Log…</span></button>
        <button class="st-tb" data-a="clearfilter" title="Clear Filter" disabled>${svgI("x")}<span>Clear Filter</span></button>
        <button class="st-tb" data-a="clear" title="Clear Log">${svgI("trash")}<span>Clear Log…</span></button>
        <button class="st-tb" data-a="save" title="Save events as CSV">${svgI("save")}<span>Save All Events As…</span></button>
      </div>
      <div class="st-ev-main">
        <div class="st-tree st-ev-tree"></div>
        <div class="st-ev-center">
          <div class="st-ev-head"></div>
          <div class="st-ev-list st-scroll"><table class="st-table st-ev-table"><thead><tr><th>Level</th><th>Date and Time</th><th>Source</th><th>Event ID</th><th class="st-col-task">Task Category</th></tr></thead><tbody></tbody></table></div>
          <div class="st-ev-detail"></div>
        </div>
      </div>
      <div class="st-status"></div>
    </div>`;
    const $ = (s) => body.querySelector(s);
    let cur = "Application", filter = null, selN = null, detailTab = "general";
    const views = [
      { id: "admin", name: "Administrative Events", icon: FOLDER, custom: true },
    ];

    function rows() {
      let r;
      if (cur === "admin") r = list().filter((e) => e.level === "Critical" || e.level === "Error" || e.level === "Warning");
      else r = list(cur);
      if (filter) {
        r = r.filter((e) => {
          if (filter.levels.length && filter.levels.indexOf(e.level) < 0) return false;
          if (filter.since && e.ts < Date.now() - filter.since) return false;
          if (filter.ids.length && filter.ids.indexOf(e.id) < 0) return false;
          if (filter.source && e.source.toLowerCase().indexOf(filter.source.toLowerCase()) < 0) return false;
          if (filter.text && (e.msg + " " + e.source).toLowerCase().indexOf(filter.text.toLowerCase()) < 0) return false;
          return true;
        });
      }
      return r;
    }
    function paintTree() {
      const t = $(".st-ev-tree");
      const count = (l) => list(l).length;
      t.innerHTML = `<div class="st-tn st-tn-root">${svgI("ev")}<span>Event Viewer (Local)</span></div>
        <div class="st-tn st-tn-l1">${FOLDER}<span>Custom Views</span></div>
        ${views.map((v) => `<div class="st-tn st-tn-l2 ${cur === v.id ? "sel" : ""}" data-log="${v.id}" tabindex="0">${LOGIC}<span>${v.name}</span></div>`).join("")}
        <div class="st-tn st-tn-l1">${FOLDER}<span>Windows Logs</span></div>
        ${LOGS.map((l) => `<div class="st-tn st-tn-l2 ${cur === l ? "sel" : ""}" data-log="${l}" tabindex="0">${LOGIC}<span>${l}</span><em>${count(l)}</em></div>`).join("")}
        <div class="st-tn st-tn-l1">${FOLDER}<span>Applications and Services Logs</span></div>
        <div class="st-tn st-tn-l2 st-dim">${LOGIC}<span>Hardware Events</span><em>0</em></div>`;
      t.querySelectorAll("[data-log]").forEach((n) => {
        const go = () => { cur = n.dataset.log; selN = null; filter = null; paint(); };
        n.onclick = go; n.onkeydown = (e) => { if (e.key === "Enter") go(); };
      });
    }
    function paintList() {
      const r = rows();
      const name = cur === "admin" ? "Administrative Events" : cur;
      const total = cur === "admin" ? r.length : list(cur).length;
      $(".st-ev-head").innerHTML = `<b>${esc(name)}</b><span>Number of events: ${total.toLocaleString()}</span>${filter ? `<span class="st-pill">Filtered: Log: ${esc(name)}; Showing ${r.length} of ${total} event(s)</span>` : ""}`;
      $('[data-a="clearfilter"]').disabled = !filter;
      $('[data-a="clear"]').disabled = cur === "admin";
      const tb = $(".st-ev-table tbody");
      if (!r.length) { tb.innerHTML = `<tr class="st-empty-row"><td colspan="5">There are no items to show in this view.</td></tr>`; paintDetail(null); return; }
      tb.innerHTML = r.slice(0, 500).map((e) => `<tr data-n="${e.n}" class="${e.n === selN ? "sel" : ""}" tabindex="-1"><td><span class="st-lv">${LV_ICON[e.level] || ""}${esc(e.level)}</span></td><td>${esc(fmtDate(e.ts))}</td><td>${esc(e.source)}</td><td>${e.id}</td><td class="st-col-task">${esc(e.task || "None")}</td></tr>`).join("");
      if (selN == null || !r.some((e) => e.n === selN)) selN = r[0].n;
      tb.querySelectorAll("tr[data-n]").forEach((tr) => tr.onclick = () => { selN = +tr.dataset.n; tb.querySelectorAll("tr.sel").forEach((x) => x.classList.remove("sel")); tr.classList.add("sel"); paintDetail(r.find((e) => e.n === selN)); });
      const s = tb.querySelector(`tr[data-n="${selN}"]`); if (s) s.classList.add("sel");
      paintDetail(r.find((e) => e.n === selN));
    }
    function paintDetail(e) {
      const d = $(".st-ev-detail");
      if (!e) { d.innerHTML = ""; return; }
      const xml = `<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">\n  <System>\n    <Provider Name="${esc(e.source)}" />\n    <EventID>${e.id}</EventID>\n    <Level>${["Critical", "Error", "Warning", "Information", "Verbose"].indexOf(e.level) + 1 || 0}</Level>\n    <Task>${esc(e.task || "None")}</Task>\n    <TimeCreated SystemTime="${new Date(e.ts).toISOString()}" />\n    <EventRecordID>${e.n}</EventRecordID>\n    <Channel>${esc(e.log)}</Channel>\n    <Computer>${esc(e.pc)}</Computer>\n  </System>\n  <EventData>\n    <Data>${esc(e.msg)}</Data>\n  </EventData>\n</Event>`;
      d.innerHTML = `<div class="st-ev-dhead">Event ${e.id}, ${esc(e.source)}</div>
        <div class="st-tabs"><button data-t="general" class="${detailTab === "general" ? "on" : ""}">General</button><button data-t="details" class="${detailTab === "details" ? "on" : ""}">Details</button></div>
        <div class="st-ev-dbody st-scroll">${detailTab === "general" ? `<pre class="st-ev-msg">${esc(e.msg)}</pre>
          <table class="st-kv"><tr><td>Log Name:</td><td>${esc(e.log)}</td><td>Source:</td><td>${esc(e.source)}</td></tr>
          <tr><td>Event ID:</td><td>${e.id}</td><td>Logged:</td><td>${esc(fmtDate(e.ts))}</td></tr>
          <tr><td>Level:</td><td>${esc(e.level)}</td><td>Task Category:</td><td>${esc(e.task || "None")}</td></tr>
          <tr><td>User:</td><td>${esc(e.user)}</td><td>Computer:</td><td>${esc(e.pc)}</td></tr>
          <tr><td>Keywords:</td><td>${/Audit/.test(e.level) ? esc(e.level) : "Classic"}</td><td>Record:</td><td>${e.n}</td></tr></table>` : `<pre class="st-ev-xml">${xml}</pre>`}</div>`;
      d.querySelectorAll("[data-t]").forEach((b) => b.onclick = () => { detailTab = b.dataset.t; paintDetail(e); });
    }
    function paint() { paintTree(); paintList(); $(".st-status").textContent = (cur === "admin" ? "Custom View" : cur) + ": " + rows().length + " event(s) shown · newest " + MAX + " kept on this device"; }

    function filterDialog() {
      const f = filter || { levels: [], since: 0, ids: [], source: "", text: "" };
      const lv = cur === "Security" ? ["Audit Success", "Audit Failure", "Information"] : ["Critical", "Warning", "Verbose", "Error", "Information"];
      const m = modal(body, "Filter Current Log", `<div class="st-form">
        <label class="st-lbl">Logged:</label><select class="st-input" data-f="since"><option value="0">Any time</option><option value="3600000">Last hour</option><option value="43200000">Last 12 hours</option><option value="86400000">Last 24 hours</option><option value="604800000">Last 7 days</option></select>
        <label class="st-lbl">Event level:</label><div class="st-checks">${lv.map((l) => `<label><input type="checkbox" value="${l}" ${f.levels.indexOf(l) >= 0 ? "checked" : ""}> ${l}</label>`).join("")}</div>
        <label class="st-lbl">Event IDs:</label><input class="st-input" data-f="ids" placeholder="&lt;All Event IDs&gt; e.g. 4624, 9707" value="${esc(f.ids.join(", "))}">
        <label class="st-lbl">Event sources:</label><input class="st-input" data-f="source" placeholder="e.g. Shell-Core" value="${esc(f.source)}">
        <label class="st-lbl">Contains text:</label><input class="st-input" data-f="text" value="${esc(f.text)}">
      </div>`, [["Clear", "clear"], ["OK", "ok", true], ["Cancel", "cancel"]]);
      m.el.querySelector('[data-f="since"]').value = String(f.since || 0);
      m.on("clear", () => { m.el.querySelectorAll("input[type=checkbox]").forEach((c) => c.checked = false); m.el.querySelectorAll("input.st-input").forEach((i) => i.value = ""); m.el.querySelector('[data-f="since"]').value = "0"; });
      m.on("ok", () => {
        const nf = {
          levels: [...m.el.querySelectorAll("input[type=checkbox]:checked")].map((c) => c.value),
          since: +m.el.querySelector('[data-f="since"]').value || 0,
          ids: m.el.querySelector('[data-f="ids"]').value.split(/[\s,;]+/).filter(Boolean).map((x) => parseInt(x, 10)).filter((x) => !isNaN(x)),
          source: m.el.querySelector('[data-f="source"]').value.trim(),
          text: m.el.querySelector('[data-f="text"]').value.trim(),
        };
        filter = (nf.levels.length || nf.since || nf.ids.length || nf.source || nf.text) ? nf : null;
        m.close(); paint();
      });
    }
    function clearDialog() {
      if (cur === "admin") return;
      const m = modal(body, "Event Viewer", `<div class="st-msg">${svgI("q", 34)}<div>Do you want to save "${esc(cur)}" before clearing it?</div></div>`, [["Save and Clear", "save"], ["Clear", "clear", true], ["Cancel", "cancel"]]);
      m.on("save", () => { download(cur); EventLog.clear(cur); m.close(); selN = null; paint(); });
      m.on("clear", () => { EventLog.clear(cur); m.close(); selN = null; paint(); });
    }
    function download(log) {
      const r = log && log !== "admin" ? list(log) : rows();
      const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
      const csv = ["Level,Date and Time,Source,Event ID,Task Category,Log,Message"].concat(r.map((e) => [e.level, new Date(e.ts).toISOString(), e.source, e.id, e.task, e.log, e.msg].map(q).join(","))).join("\r\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = (log || "Events") + ".csv";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    }
    body.querySelector('[data-a="refresh"]').onclick = paint;
    body.querySelector('[data-a="filter"]').onclick = filterDialog;
    body.querySelector('[data-a="clearfilter"]').onclick = () => { filter = null; paint(); };
    body.querySelector('[data-a="clear"]').onclick = clearDialog;
    body.querySelector('[data-a="save"]').onclick = () => download(cur);
    menus(body, {
      file: [["Save All Events As…", () => download(cur)], ["-"], ["Exit", () => ref.close()]],
      action: [["Filter Current Log…", filterDialog], ["Clear Filter", () => { filter = null; paint(); }], ["Clear Log…", clearDialog], ["-"], ["Refresh", paint]],
      view: [["Refresh", paint]],
      help: [["About Event Viewer", () => modal(body, "About Event Viewer", `<div class="st-msg">${Icon.mini("eventviewer", "Event Viewer")}<div><b>Event Viewer</b><br>Version 12.0 · Logs real events from this desktop: sign-ins, app launches, installs, crashes and errors. The newest ${MAX} events are kept on this device.</div></div>`, [["OK", "cancel", true]])]],
    });
    // keyboard: arrows move the selection
    body.querySelector(".st-ev-list").addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const r = rows(), i = r.findIndex((x) => x.n === selN); const j = Math.max(0, Math.min(r.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
      if (r[j]) { selN = r[j].n; paintList(); e.preventDefault(); const tr = body.querySelector("tr.sel"); if (tr) tr.scrollIntoView({ block: "nearest" }); }
    });
    body.querySelector(".st-ev-list").tabIndex = 0;
    // live: new events show up while the viewer is open
    let pending = 0;
    const off = EventLog.on(() => { if (!body.isConnected) { off(); return; } clearTimeout(pending); pending = setTimeout(() => { if (body.isConnected) paint(); }, 250); });
    ref.win.addEventListener("wm-cleanup", () => off());
    paint();
    return ref;
  }

  // ---------- tiny shared UI helpers (also used by systools.js / regedit.js) ----------
  const ICONS = {
    refresh: '<path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3"/>',
    filter: '<path d="M2 3h12l-4.5 5.5V13l-3-1.5V8.5z"/>',
    x: '<path d="M4 4l8 8M12 4l-8 8"/>',
    trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9"/>',
    save: '<path d="M3 2.5h8l2 2v9H3z"/><path d="M5 2.5v3.5h5V2.5M5 13.5v-4h6v4"/>',
    ev: '<rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h3"/>',
    q: '<circle cx="8" cy="8" r="6.5" fill="#0067c0" stroke="none"/><path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.7c-.5.3-.8.6-.8 1.3" stroke="#fff"/><circle cx="8" cy="11.3" r=".7" fill="#fff" stroke="none"/>',
    warn: '<path d="M8 1.5l7 13H1z" fill="#ffb900" stroke="#c48a00"/><path d="M8 6v4" stroke="#222"/><circle cx="8" cy="12" r=".7" fill="#222" stroke="none"/>',
    err: '<circle cx="8" cy="8" r="6.5" fill="#e81123" stroke="none"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff"/>',
    info: '<circle cx="8" cy="8" r="6.5" fill="#0067c0" stroke="none"/><path d="M8 7v4.5" stroke="#fff"/><circle cx="8" cy="4.8" r=".8" fill="#fff" stroke="none"/>',
    shield: '<path d="M8 1.5l5.5 2v4c0 3.5-2.4 5.8-5.5 7-3.1-1.2-5.5-3.5-5.5-7v-4z" fill="#ffd23f" stroke="#2160c4"/><path d="M8 1.5v13" stroke="#2160c4"/>',
  };
  function svgI(k, size) { return `<svg class="st-i" viewBox="0 0 16 16" width="${size || 16}" height="${size || 16}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ""}</svg>`; }
  // A modal dialog inside a window body. buttons: [label, action, isDefault]
  function modal(host, title, html, buttons, opts) {
    const root = host.closest(".win") || host;
    const mask = el(`<div class="st-modal-mask"><div class="st-modal ${opts && opts.wide ? "st-modal-wide" : ""}" role="dialog" aria-label="${esc(title)}"><div class="st-modal-title"><span>${esc(title)}</span><button class="st-modal-x" title="Close">✕</button></div><div class="st-modal-body">${html}</div><div class="st-modal-btns">${(buttons || []).map(([l, a, def]) => `<button class="st-btn ${def ? "st-btn-def" : ""}" data-act="${a}">${esc(l)}</button>`).join("")}</div></div></div>`);
    root.appendChild(mask);
    const handlers = {};
    const close = () => { mask.remove(); if (opts && opts.onClose) opts.onClose(); };
    mask.querySelector(".st-modal-x").onclick = close;
    mask.querySelectorAll("[data-act]").forEach((b) => b.onclick = () => { const a = b.dataset.act; if (handlers[a]) handlers[a](); else if (a === "cancel") close(); });
    mask.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      if (e.key === "Enter" && !(e.target && e.target.tagName === "TEXTAREA")) { const d = mask.querySelector(".st-btn-def"); if (d) { e.preventDefault(); d.click(); } }
    });
    setTimeout(() => { const f = mask.querySelector("input:not([type=checkbox]):not([type=radio]):not([readonly]),select,textarea:not([readonly])") || mask.querySelector(".st-btn-def"); if (f) try { f.focus(); if (f.select) f.select(); } catch (_) {} }, 30);
    return { el: mask, close, on(a, fn) { handlers[a] = fn; } };
  }
  // Classic menu bar: items {key: [[label, fn] | ["-"]]}
  function menus(host, defs) {
    host.querySelectorAll(".st-menubar [data-m]").forEach((b) => {
      b.onclick = (ev) => {
        ev.stopPropagation();
        const was = host.querySelector(".st-menu"); if (was) { was.remove(); if (was.dataset.for === b.dataset.m) return; }
        const items = defs[b.dataset.m] || [];
        const m = el(`<div class="st-menu" data-for="${b.dataset.m}"></div>`);
        items.forEach((it) => {
          if (it[0] === "-") { m.appendChild(el(`<div class="st-menu-sep"></div>`)); return; }
          const disabled = typeof it[2] === "function" ? it[2]() : it[2];
          const x = el(`<button class="st-menu-it" ${disabled ? "disabled" : ""}>${esc(it[0])}</button>`);
          x.onclick = (e2) => { e2.stopPropagation(); m.remove(); it[1](); };
          m.appendChild(x);
        });
        const r = b.getBoundingClientRect(), hr = host.getBoundingClientRect();
        m.style.left = (r.left - hr.left) + "px"; m.style.top = (r.bottom - hr.top) + "px";
        host.appendChild(m);
        setTimeout(() => document.addEventListener("pointerdown", function h(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", h, true); } }, true), 0);
      };
    });
  }
  window.STUI = { modal, menus, svgI, esc, el };

  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.eventviewer = function () { return openViewer(); };
  AppRegistry.eventvwr = AppRegistry.eventviewer;
})();
