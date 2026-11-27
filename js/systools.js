/* Windows system tools tied to this desktop's real data:
   Control Panel (controlpanel), Device Manager (devicemanager / devmgmt), Disk Management
   (diskmgmt), Disk Cleanup (cleanmgr), an upgraded Run dialog (run), System Information
   (msinfo32) and About Windows (winver). Registry Editor lives in js/regedit.js and Event
   Viewer in js/eventlog.js (loaded first: it provides window.STUI dialog helpers). */
(function () {
  "use strict";
  const S = () => State.data;
  const U = window.STUI;
  const esc = U.esc, el = U.el, svgI = U.svgI, modal = U.modal, menus = U.menus;
  const AR = (window.AppRegistry = window.AppRegistry || {});
  const log = (...a) => { if (window.EventLog) EventLog.add(...a); };
  const note = (title, body, ic) => { if (window.Notify) Notify.show({ icon: Icon.mini(ic || "controlpanel", title), title: esc(title), body: esc(body) }); };

  // =====================================================================
  //  Catalog entries + icons (so they appear in Start, search and the Store)
  // =====================================================================
  const APPS = [
    { id: "controlpanel", name: "Control Panel", desc: "Classic Control Panel — programs, system info, devices, network, personalization, clock, region and accessibility, all wired to this PC." },
    { id: "regedit", name: "Registry Editor", desc: "Browse and edit the registry. Keys like AppsUseLightTheme or Control Panel\\Desktop\\Wallpaper change the real settings." },
    { id: "devicemanager", name: "Device Manager", desc: "See this device's real hardware — display, touch, processors, audio, network, Bluetooth, battery and the fingerprint sensor." },
    { id: "eventviewer", name: "Event Viewer", desc: "Windows Logs for this desktop: sign-ins, app launches, installs, crashes and errors." },
    { id: "diskmgmt", name: "Disk Management", desc: "Real browser storage quota and usage, with a breakdown of what's using space." },
    { id: "cleanmgr", name: "Disk Cleanup", desc: "Free up real storage: empty the Recycle Bin, temporary files, thumbnails, histories and caches." },
  ];
  APPS.forEach((a) => {
    if (!Catalog.storeApps.find((x) => x.id === a.id)) Catalog.storeApps.push({ id: a.id, name: a.name, cat: "System", price: 0, builtin: a.id, desc: a.desc });
    (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []).push(a.id);
  });
  if (Icon.alias) { Icon.alias("devmgmt", "devicemanager"); Icon.alias("eventvwr", "eventviewer"); Icon.alias("msinfo32", "devicemanager"); Icon.alias("winver", "winflag"); }

  // =====================================================================
  //  Shared helpers (window.SysTools — also used by regedit.js)
  // =====================================================================
  const profile = () => S().profile || (S().profile = { username: "User" });
  const userName = () => profile().username || "User";
  const derivedName = () => (userName().replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "USER").toUpperCase() + "-PC";
  const deviceName = () => S().deviceName || derivedName();
  function setDeviceName(v) { v = String(v || "").trim().replace(/[^A-Za-z0-9-]/g, "").slice(0, 15).toUpperCase(); if (!v) return false; S().deviceName = v; State.save(); return true; }
  const qs = () => { if (!S().appData) S().appData = {}; return S().appData.quickSettings || (S().appData.quickSettings = { wifi: true, bt: false, plane: false, night: false, focus: false, brightness: 90, volume: 55, signal: "good" }); };
  const fx = () => { const d = S().desktop || (S().desktop = {}); return d.fx || (d.fx = { round: true, anim: true, shadow: true, blur: true }); };
  const a11y = () => (S().appData.a11y = S().appData.a11y || {});
  function fmtBytes(b) {
    if (b == null || isNaN(b)) return "—";
    if (b < 1024) return Math.round(b) + " bytes";
    const u = ["KB", "MB", "GB", "TB"]; let i = -1; do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
    return (b >= 100 ? Math.round(b) : b >= 10 ? b.toFixed(1) : b.toFixed(2)) + " " + u[i];
  }
  const resolveTheme = () => (S().theme === "light" || S().theme === "dark") ? S().theme : (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  function setTheme(t) { S().theme = t; State.save(); if (window.applyTheme) applyTheme(); safeWall(); }
  function safeWall() { try { if (document.querySelector(".desktop") && window.applyWallpaper) applyWallpaper(); } catch (_) {} }
  function setWallpaper(v) { S().desktop.wallpaper = v; State.save(); safeWall(); }
  function setAccent(hx) { S().accent = hx; State.save(); document.documentElement.style.setProperty("--accent", hx); }
  function setTextScale(v) { S().textScale = Math.max(80, Math.min(225, Math.round(v))); State.save(); if (window.applyTheme) applyTheme(); else document.documentElement.style.setProperty("--scale", S().textScale / 100); }
  function openSettings(page) { window.SettingsStartPage = page || null; WM.open("settings"); }
  function isInstalled(id) { return window.SettingsParts && SettingsParts.isInstalled ? SettingsParts.isInstalled(id) : (S().installedApps || []).includes(id); }
  function installedList() {
    return Catalog.storeApps.filter((a) => !a.decorative && (a.builtin || a.game) && isInstalled(a.id))
      .map((a) => ({ id: a.id, name: a.name, cat: a.cat, removable: (S().installedApps || []).includes(a.id), app: a }))
      .sort((x, y) => x.name.localeCompare(y.name));
  }
  function uninstall(id) {
    const arr = S().installedApps || [], i = arr.indexOf(id);
    if (i < 0) return false;
    arr.splice(i, 1); State.save();
    if (window.WM && WM.refreshDesktopIcons) WM.refreshDesktopIcons();
    return true;
  }
  function publisher(a, removable) {
    const n = (a.name || "").toLowerCase();
    if (removable === undefined) removable = (S().installedApps || []).includes(a.id);
    if (/minecraft|mincraft|xbox|word|excel|powerpoint|outlook|onenote|edge|teams|solitaire|forms|copilot|365|paint|notepad|calculator|clock|windows|store|settings|file explorer|media player|registry|control panel|device manager|event viewer|disk/.test(n)) return "Microsoft Corporation";
    if (/chrome|gmail|classroom|youtube/.test(n)) return "Google LLC";
    if (/itunes/.test(n)) return "Apple Inc.";
    if (/adobe|acrobat/.test(n)) return "Adobe Inc.";
    if (/grammarly/.test(n)) return "Grammarly Inc.";
    if (/canva/.test(n)) return "Canva Pty Ltd";
    if (/blender/.test(n)) return "Blender Foundation";
    if (/vlc/.test(n)) return "VideoLAN";
    if (a.game) return "Windows 12 Games";
    return removable ? "Microsoft Store" : "Microsoft Corporation";
  }
  // UAC level 0..3 (0 = never notify). Shared with the registry (EnableLUA).
  const uacLevel = () => { const v = S().appData.uacLevel; return v == null ? 2 : v; };
  let elevatedUntil = 0;   // a consent just given (e.g. Run with Ctrl+Shift+Enter) covers the app it launches
  function elevate(opts, onAllow, onDeny) {
    if (uacLevel() === 0 || !window.UAC || Date.now() < elevatedUntil) { elevatedUntil = 0; onAllow(); return; }
    UAC.prompt(opts, () => { elevatedUntil = Date.now() + 1500; log("Security", "Audit Success", "Microsoft Windows security auditing.", 4688, "A new process was created with elevated rights (UAC consent given).\r\nProcess Name:\t" + (opts.name || "") + "\r\nToken Elevation Type:\tTokenElevationTypeFull (2)", { user: userName() }); onAllow(); },
      () => { log("Application", "Warning", "User Account Control", 1, "The user declined elevation for " + (opts.name || "an app") + "."); if (onDeny) onDeny(); });
  }

  // ---- real storage measurement ----
  const jsonBytes = (x) => { try { return x === undefined || x === null ? 0 : JSON.stringify(x).length * 2; } catch (_) { return 0; } };
  function lsKeys() {
    const out = []; let total = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), v = localStorage.getItem(k) || ""; const b = (k.length + v.length) * 2; out.push({ key: k, bytes: b }); total += b; } } catch (_) {}
    return { total, keys: out.sort((a, b) => b.bytes - a.bytes) };
  }
  function cDrive() { try { return S().appData.files.root["Local Disk (C:)"]; } catch (_) { return null; } }
  function walkFiles(cb) {
    const root = S().appData && S().appData.files && S().appData.files.root; if (!root) return;
    const rec = (kids, path) => Object.keys(kids || {}).forEach((name) => { const n = kids[name]; if (!n) return; cb(n, name, path, kids); if (n.type === "folder") rec(n.children, path.concat(name)); });
    rec(root, []);
  }
  function tempTargets() {
    const out = [];
    const c = cDrive();
    const tmpDir = c && c.children && c.children.Windows && c.children.Windows.children && c.children.Windows.children.Temp;
    if (tmpDir && tmpDir.children) Object.keys(tmpDir.children).forEach((k) => out.push({ kids: tmpDir.children, name: k, path: "C:\\Windows\\Temp\\" + k }));
    walkFiles((n, name, path, kids) => {
      const p = path.join("\\");
      if (n.type === "file" && /\.(tmp|temp|bak|old|log~)$/i.test(name) && !/Windows\\Temp$/.test(p)) out.push({ kids, name, path: p + "\\" + name });
      if (n.type === "folder" && name === "Temp" && /AppData\\Local$/.test(p) && n.children) Object.keys(n.children).forEach((k) => out.push({ kids: n.children, name: k, path: p + "\\Temp\\" + k }));
    });
    return out;
  }
  function thumbTargets() { const out = []; walkFiles((n) => { if (n.type === "file" && n.blob && typeof n.src === "string" && n.src.startsWith("data:")) out.push(n); }); return out; }
  // Category breakdown of everything in localStorage (sizes are UTF-16 bytes = chars x 2).
  function breakdown() {
    const d = S(), ad = d.appData || {};
    const ls = lsKeys(), stateKey = ls.keys.find((k) => k.key === (window.WIN12_STATE_KEY || "win12_state_v1"));
    const root = ad.files && ad.files.root;
    const c = cDrive();
    let userFiles = 0; if (root) Object.keys(root).forEach((k) => { if (k !== "Local Disk (C:)") userFiles += jsonBytes(root[k]); });
    const tempB = tempTargets().reduce((s, t) => s + jsonBytes(t.kids[t.name]), 0);
    const thumbsB = thumbTargets().reduce((s, n) => s + n.src.length * 2, 0);
    const cats = [
      { key: "files", name: "Documents, Pictures & other files", bytes: Math.max(0, userFiles - thumbsB), color: "#0067c0" },
      { key: "system", name: "System files (C:\\Windows, Program Files)", bytes: Math.max(0, jsonBytes(c) - tempB), color: "#5c2d91" },
      { key: "temp", name: "Temporary files", bytes: tempB, color: "#ff8c00" },
      { key: "thumbs", name: "Thumbnails", bytes: thumbsB, color: "#e3008c" },
      { key: "imagegen", name: "Image Studio history", bytes: jsonBytes(ad.imageGen), color: "#00b294" },
      { key: "snips", name: "Snips & screenshots", bytes: jsonBytes(ad.snips), color: "#038387" },
      { key: "terminal", name: "Terminal history", bytes: jsonBytes(ad.terminal && ad.terminal.history), color: "#4a5459" },
      { key: "notif", name: "Notification history", bytes: jsonBytes(ad.notifLog), color: "#ffb900" },
      { key: "ai", name: "Copilot & AI chat history", bytes: jsonBytes(d.copilot && d.copilot.history) + jsonBytes(ad.outlookCop), color: "#8a5cf6" },
      { key: "browser", name: "Browsing history & web caches", bytes: jsonBytes(ad.browser && ad.browser.history) + jsonBytes(ad.weather), color: "#2a5bd7" },
      { key: "events", name: "Event logs", bytes: jsonBytes(ad.eventLog), color: "#a80000" },
      { key: "media", name: "Wallpaper, profile picture & custom icons", bytes: (String(d.desktop && d.desktop.wallpaper || "").startsWith("data:") ? d.desktop.wallpaper.length * 2 : 0) + jsonBytes(profile().picture) + jsonBytes(ad.customIcons), color: "#da3b01" },
    ];
    const known = cats.reduce((s, x) => s + x.bytes, 0);
    cats.push({ key: "apps", name: "Other app data & settings", bytes: Math.max(0, (stateKey ? stateKey.bytes : 0) - known), color: "#107c10" });
    const other = ls.keys.filter((k) => k.key !== (window.WIN12_STATE_KEY || "win12_state_v1")).reduce((s, k) => s + k.bytes, 0);
    cats.push({ key: "otherkeys", name: "Other site data (sign-ins, tokens)", bytes: other, color: "#767676" });
    return { total: ls.total, cats: cats.sort((a, b) => b.bytes - a.bytes), keys: ls.keys };
  }
  async function estimate() {
    try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (_) {}
    return null;
  }
  window.SysTools = { deviceName, setDeviceName, userName, fmtBytes, setTheme, resolveTheme, setWallpaper, setAccent, setTextScale, openSettings, installedList, uninstall, publisher, isInstalled, uacLevel, elevate, breakdown, lsKeys, estimate, jsonBytes, fx, qs, a11y, safeWall,
    // shared with Storage Sense (js/sysutil2.js): the same clean-up categories as Disk Cleanup
    cleanupCats: (system) => cleanupCats(system), tempTargets: () => tempTargets(), walkFiles };

  // ---------- generic little icons (24 viewbox, colored) ----------
  const G = {
    system: '<rect x="2" y="4" width="20" height="13" rx="2" fill="#2d7fd8"/><rect x="4" y="6" width="16" height="9" rx="1" fill="#9fd0ff"/><path d="M9 20h6M12 17v3" stroke="#555" stroke-width="2"/><path d="M15 3l5 1.5v3.5c0 3-2 4.6-5 5.5-3-.9-5-2.5-5-5.5V4.5z" fill="#ffd23f" stroke="#2160c4" stroke-width=".8" transform="translate(4 6) scale(.55)"/>',
    network: '<circle cx="12" cy="12" r="9" fill="#2d7fd8"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="#cfe6ff" stroke-width="1.4" fill="none"/>',
    hardware: '<rect x="3" y="6" width="12" height="9" rx="1.5" fill="#6b7a90"/><rect x="5" y="8" width="8" height="5" fill="#bfe1ff"/><path d="M16 12l3-3v8l-3-3z" fill="#2d7fd8"/><circle cx="18" cy="18" r="3" fill="#43a047"/>',
    programs: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#7b5cff"/><rect x="6" y="6" width="5" height="5" rx="1" fill="#fff"/><rect x="13" y="6" width="5" height="5" rx="1" fill="#e4dcff"/><rect x="6" y="13" width="5" height="5" rx="1" fill="#e4dcff"/><rect x="13" y="13" width="5" height="5" rx="1" fill="#fff"/>',
    users: '<circle cx="9" cy="8" r="4" fill="#2d7fd8"/><path d="M2 20a7 7 0 0 1 14 0z" fill="#2d7fd8"/><circle cx="17" cy="9" r="3" fill="#43a047"/><path d="M13 20a5 5 0 0 1 9.5-2.2V20z" fill="#43a047"/>',
    appearance: '<rect x="2" y="4" width="20" height="14" rx="2" fill="#e3008c"/><path d="M2 14l6-5 5 4 3-2 6 5v2H2z" fill="#ffb3e0"/><circle cx="16" cy="8" r="2" fill="#ffe27a"/>',
    clock: '<circle cx="12" cy="12" r="9.5" fill="#fff" stroke="#2d7fd8" stroke-width="2"/><path d="M12 7v5l3.5 2" stroke="#333" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="19" cy="18" r="4" fill="#43a047"/><path d="M15 18h8M19 14c1.5 1.5 1.5 6.5 0 8" stroke="#d9f5dc" stroke-width=".8"/>',
    ease: '<circle cx="12" cy="12" r="10" fill="#2d7fd8"/><circle cx="12" cy="6.5" r="1.8" fill="#fff"/><path d="M6.5 9.5l5.5 1 5.5-1M12 10.5v4l-2.5 5M12 14.5l2.5 5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
    firewall: '<rect x="2" y="5" width="20" height="14" rx="1.5" fill="#b5462d"/><path d="M2 9.6h20M2 14.3h20M8 5v4.6M15 5v4.6M5 9.6v4.7M12 9.6v4.7M18 9.6v4.7M8 14.3V19M15 14.3V19" stroke="#ffd0c2" stroke-width="1"/><circle cx="19" cy="18" r="4.3" fill="#2d7fd8"/><path d="M15 18h8M19 14c1.6 1.6 1.6 6.4 0 8" stroke="#fff" stroke-width=".8"/>',
    tools: '<rect x="3" y="3" width="18" height="18" rx="3" fill="#4a5459"/><path d="M7 15l6-6M14.5 6.5a2.6 2.6 0 0 0 3 3l-1 1-3-3z" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M7 7l3 3M15 15l2 2" stroke="#ffb900" stroke-width="1.8" stroke-linecap="round"/>',
    devices: '<rect x="2" y="7" width="12" height="9" rx="1.5" fill="#6b7a90"/><rect x="4" y="9" width="8" height="5" fill="#bfe1ff"/><path d="M14 10h6v8h-6z" fill="#3a3a3a"/><path d="M15 12h4" stroke="#fff"/><rect x="16" y="4" width="6" height="5" rx="1" fill="#2d7fd8"/>',
    printer: '<path d="M6 3h12v5H6z" fill="#fff" stroke="#6b7a90"/><rect x="2" y="8" width="20" height="9" rx="2" fill="#6b7a90"/><path d="M6 14h12v7H6z" fill="#fff" stroke="#6b7a90"/><circle cx="18.5" cy="11" r="1" fill="#43e07a"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2.5" fill="#3a3a3a"/><rect x="8.5" y="4" width="7" height="14" fill="#9fd0ff"/>',
    bt: '<circle cx="12" cy="12" r="10" fill="#0a5bd3"/><path d="M8 8.5l7.5 7-3.5 3V5.5l3.5 3L8 15.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
    fp: '<circle cx="12" cy="12" r="10" fill="#e8eef8" stroke="#2d7fd8"/><path d="M8 15c0-5 1.5-7 4-7s4 2 4 6M10 17c.5-1 .5-3 .5-5a1.5 1.5 0 0 1 3 0c0 2.5-.5 4.5-1.5 6M12.5 12c0 3-1 5-2 6.5" stroke="#2d7fd8" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
    keyboard: '<rect x="2" y="7" width="20" height="11" rx="2" fill="#4a5459"/><path d="M5 10.5h.01M8 10.5h.01M11 10.5h.01M14 10.5h.01M17 10.5h.01M19 10.5h.01M6 14.5h12" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    mouse: '<rect x="7" y="3" width="10" height="18" rx="5" fill="#6b7a90"/><path d="M12 3v7M7 10h10" stroke="#fff" stroke-width="1.2"/>',
    touch: '<path d="M10 11V5.5a1.6 1.6 0 0 1 3.2 0V11l4.3.8a2 2 0 0 1 1.6 2.3l-.9 5A2 2 0 0 1 16.2 21H11a2 2 0 0 1-1.6-.8l-3.5-4.6a1.4 1.4 0 0 1 2.1-1.8L10 15.6z" fill="#ffcf9f" stroke="#a5653a" stroke-width=".9"/>',
    monitor: '<rect x="2" y="4" width="20" height="13" rx="1.5" fill="#3a3a3a"/><rect x="3.5" y="5.5" width="17" height="10" fill="#2d7fd8"/><path d="M9 21h6M12 17v4" stroke="#555" stroke-width="2"/>',
    gpu: '<rect x="2" y="6" width="20" height="11" rx="1.5" fill="#43a047"/><circle cx="9" cy="11.5" r="3.5" fill="#1b5e20"/><circle cx="9" cy="11.5" r="1.3" fill="#a5d6a7"/><rect x="14" y="9" width="6" height="5" rx="1" fill="#1b5e20"/><path d="M4 17v3M7 17v3M10 17v3" stroke="#c9a227" stroke-width="1.4"/>',
    audio: '<path d="M4 9h3l5-4v14l-5-4H4z" fill="#6b7a90"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="#2d7fd8" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    mic: '<rect x="9" y="2.5" width="6" height="12" rx="3" fill="#6b7a90"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="#2d7fd8" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    camera: '<path d="M3 8h4l2-3h6l2 3h4v11H3z" fill="#6b7a90"/><circle cx="12" cy="13" r="3.6" fill="#bfe1ff" stroke="#fff"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2" fill="#4a5459"/><rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="#9fd0ff"/><path d="M9 2v3M12 2v3M15 2v3M9 19v3M12 19v3M15 19v3M2 9h3M2 12h3M2 15h3M19 9h3M19 12h3M19 15h3" stroke="#8a8a8a" stroke-width="1.4"/>',
    disk: '<rect x="3" y="6" width="18" height="12" rx="2" fill="#8a94a6"/><rect x="5" y="13" width="14" height="3" rx="1" fill="#5a6477"/><circle cx="17.5" cy="9.5" r="1.1" fill="#43e07a"/>',
    battery: '<rect x="2.5" y="7" width="17" height="10" rx="2" fill="none" stroke="#4a5459" stroke-width="1.6"/><rect x="4.5" y="9" width="10" height="6" rx="1" fill="#43a047"/><rect x="20" y="10" width="2" height="4" rx=".8" fill="#4a5459"/>',
    netcard: '<rect x="2" y="7" width="20" height="10" rx="1.5" fill="#2d7fd8"/><path d="M5 17v3M8 17v3M11 17v3M14 17v3" stroke="#c9a227" stroke-width="1.4"/><rect x="15" y="9" width="5" height="5" rx="1" fill="#0a3e86"/><path d="M5 10.5h7M5 13h5" stroke="#cfe6ff"/>',
    computer: '<rect x="2" y="3" width="20" height="13" rx="1.5" fill="#3a3a3a"/><rect x="3.5" y="4.5" width="17" height="10" fill="#9fd0ff"/><path d="M7 21h10M12 16v5" stroke="#555" stroke-width="2"/>',
    hid: '<rect x="4" y="3" width="16" height="18" rx="3" fill="#6b7a90"/><circle cx="12" cy="9" r="3" fill="#bfe1ff"/><path d="M8 16h8" stroke="#fff" stroke-width="1.6"/>',
    chip: '<rect x="4" y="6" width="16" height="12" rx="2" fill="#5c2d91"/><path d="M7 9h10M7 12h10M7 15h6" stroke="#d9c7ff"/>',
    software: '<rect x="3" y="4" width="18" height="16" rx="2" fill="#0078d4"/><path d="M3 8h18" stroke="#fff"/><path d="M8 12l-2 2 2 2M16 12l2 2-2 2M13 11l-2 6" stroke="#fff" stroke-width="1.4" fill="none"/>',
    font: '<rect x="2" y="3" width="20" height="18" rx="2" fill="#ffd96a"/><path d="M6 17l4.5-11h1L16 17M7.5 13.5h7" stroke="#6b4e00" stroke-width="1.8" fill="none"/>',
    power: '<rect x="3" y="7" width="15" height="10" rx="2" fill="#43a047"/><rect x="18" y="10" width="2" height="4" fill="#43a047"/><path d="M11 8.5l-3 4h3l-2 3.5" stroke="#fff" stroke-width="1.5" fill="none"/>',
    sound: '<circle cx="12" cy="12" r="10" fill="#6b7a90"/><path d="M6 10h2.5l3.5-3v10l-3.5-3H6z" fill="#fff"/><path d="M14.5 9.5a3.5 3.5 0 0 1 0 5" stroke="#fff" stroke-width="1.6" fill="none"/>',
    recovery: '<circle cx="12" cy="12" r="10" fill="#0078d4"/><path d="M7 12a5 5 0 1 0 1.5-3.6L7 10M7 6.5v3.5h3.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
    trouble: '<circle cx="12" cy="12" r="10" fill="#ffb900"/><path d="M14.5 6.5a3.3 3.3 0 0 0 3 3l-1 1-3-3zM14 9l-7 7" stroke="#4a3500" stroke-width="1.8" stroke-linecap="round"/>',
    backup: '<circle cx="12" cy="12" r="10" fill="#43a047"/><path d="M8 13l4-4 4 4M12 9v8" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    taskbar: '<rect x="2" y="4" width="20" height="16" rx="2" fill="#9fd0ff"/><rect x="2" y="16" width="20" height="4" rx="1" fill="#2d7fd8"/><path d="M10 18h4" stroke="#fff" stroke-width="1.5"/>',
    security: '<path d="M12 2l8.5 3v6.5c0 5.2-3.6 8.7-8.5 10.5-4.9-1.8-8.5-5.3-8.5-10.5V5z" fill="#2d7fd8"/><path d="M8 12l3 3 5-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>',
    region: '<circle cx="12" cy="12" r="10" fill="#43a047"/><path d="M6 8c2 0 2 2 4 2s1 3 3 3 1 3 0 5M14 4c0 2 2 2 3 4s3 1 3 3" stroke="#c8f2cd" stroke-width="1.3" fill="none"/>',
    explorer: '<path d="M2 6h7l2 2h11v11H2z" fill="#ffc83d"/><path d="M2 9h20v10H2z" fill="#ffd96a"/>',
    mail: '<rect x="2" y="5" width="20" height="14" rx="2" fill="#0078d4"/><path d="M2 7l10 6 10-6" stroke="#fff" stroke-width="1.5" fill="none"/>',
    defender: '<path d="M12 2l8.5 3v6.5c0 5.2-3.6 8.7-8.5 10.5-4.9-1.8-8.5-5.3-8.5-10.5V5z" fill="#0b63ce"/><path d="M12 2v20" stroke="#fff" stroke-width="1"/>',
    bitlocker: '<rect x="2" y="7" width="17" height="10" rx="2" fill="#8a94a6"/><rect x="4" y="12.5" width="12" height="2.5" rx="1" fill="#5a6477"/><rect x="12" y="11" width="10" height="9" rx="1.6" fill="#ffb900"/><path d="M14 11V9a3 3 0 0 1 6 0v2" stroke="#6b5000" stroke-width="1.6" fill="none"/><circle cx="17" cy="15.5" r="1.3" fill="#6b5000"/>',
    indexing: '<rect x="3" y="3" width="13" height="17" rx="1.5" fill="#fff" stroke="#6b7a90"/><path d="M6 7h7M6 10h7M6 13h4" stroke="#9aa6b8" stroke-width="1.4"/><circle cx="16" cy="15" r="4.2" fill="#fff" stroke="#0067c0" stroke-width="2"/><path d="M19 18l3 3" stroke="#0067c0" stroke-width="2.2" stroke-linecap="round"/>',
    taskschd: '<rect x="3" y="4" width="18" height="17" rx="2" fill="#fff" stroke="#6b7a90"/><rect x="3" y="4" width="18" height="4.5" rx="2" fill="#0067c0"/><circle cx="15" cy="15" r="4.6" fill="#fff" stroke="#0067c0" stroke-width="1.5"/><path d="M15 12.4V15l2 1.3" stroke="#222" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M6 12h3M6 15h2.5M6 18h3" stroke="#9aa6b8" stroke-width="1.3"/>',
  };
  const gi = (k, s) => `<svg class="st-gi" viewBox="0 0 24 24" width="${s || 24}" height="${s || 24}">${G[k] || G.software}</svg>`;

  // =====================================================================
  //  CONTROL PANEL
  // =====================================================================
  const CATS = [
    { id: "system", name: "System and Security", ic: "security", links: [["Review your computer's status", "open:security"], ["Back up your files", "set:devicesync"], ["Manage BitLocker", "page:bitlocker"], ["Troubleshoot common computer problems", "set:troubleshoot"]] },
    { id: "network", name: "Network and Internet", ic: "network", links: [["View network status and tasks", "page:network"]] },
    { id: "hardware", name: "Hardware and Sound", ic: "hardware", links: [["View devices and printers", "page:devices"], ["Add a device", "act:pair"]] },
    { id: "programs", name: "Programs", ic: "programs", links: [["Uninstall a program", "page:programs"]] },
    { id: "users", name: "User Accounts", ic: "users", links: [["Change account type", "page:users"]] },
    { id: "appearance", name: "Appearance and Personalization", ic: "appearance", links: [["Change the theme", "page:personalization"], ["Adjust screen resolution", "set:display"]] },
    { id: "clock", name: "Clock and Region", ic: "clock", links: [["Change date, time, or number formats", "page:region"]] },
    { id: "ease", name: "Ease of Access", ic: "ease", links: [["Let Windows suggest settings", "page:ease"], ["Optimize visual display", "page:ease"]] },
  ];
  const ITEMS = [
    { id: "admintools", name: "Windows Tools", cat: "system", ic: "tools", go: "page:admintools", desc: "Administrative tools: Event Viewer, Registry Editor, Disk Cleanup…" },
    { id: "backup", name: "Backup and Restore", cat: "system", ic: "backup", go: "set:devicesync", desc: "Back up this desktop or restore it on another device" },
    { id: "bitlocker", name: "BitLocker Drive Encryption", cat: "system", ic: "bitlocker", go: "page:bitlocker", desc: "Protect your files with real AES-256 encryption (password + recovery key)" },
    { id: "indexing", name: "Indexing Options", cat: "system", ic: "indexing", go: "page:indexing", desc: "Change how Windows indexes files to search faster" },
    { id: "taskschd", name: "Task Scheduler", cat: "system", ic: "taskschd", go: "open:taskschd", desc: "Schedule tasks to run automatically" },
    { id: "datetime", name: "Date and Time", cat: "clock", ic: "clock", go: "page:datetime", desc: "Set the date, time and time zone" },
    { id: "devmgr", name: "Device Manager", cat: "hardware", ic: "hardware", go: "open:devicemanager", desc: "View and update your hardware's settings and drivers" },
    { id: "devices", name: "Devices and Printers", cat: "hardware", ic: "devices", go: "page:devices", desc: "View and manage devices, printers and print jobs" },
    { id: "ease", name: "Ease of Access Center", cat: "ease", ic: "ease", go: "page:ease", desc: "Accessibility settings and programs" },
    { id: "explorer", name: "File Explorer Options", cat: "appearance", ic: "explorer", go: "open:fileexplorer", desc: "Change how files and folders are shown" },
    { id: "fonts", name: "Fonts", cat: "appearance", ic: "font", go: "page:fonts", desc: "Preview fonts installed on this computer" },
    { id: "mouse", name: "Mouse", cat: "hardware", ic: "mouse", go: "set:mouse", desc: "Change mouse button, pointer speed and scrolling" },
    { id: "keyboard", name: "Keyboard", cat: "hardware", ic: "keyboard", go: "open:devicemanager", desc: "Keyboard devices and drivers" },
    { id: "network", name: "Network and Sharing Center", cat: "network", ic: "network", go: "page:network", desc: "Check network status and change network settings" },
    { id: "personalization", name: "Personalization", cat: "appearance", ic: "appearance", go: "page:personalization", desc: "Change the theme, desktop background and colors" },
    { id: "power", name: "Power Options", cat: "hardware", ic: "power", go: "page:power", desc: "Battery status and power settings" },
    { id: "programs", name: "Programs and Features", cat: "programs", ic: "programs", go: "page:programs", desc: "Uninstall or change programs on your computer" },
    { id: "recovery", name: "Recovery", cat: "system", ic: "recovery", go: "set:recovery", desc: "Reset this PC" },
    { id: "region", name: "Region", cat: "clock", ic: "region", go: "page:region", desc: "Change location, date, time and number formats" },
    { id: "security", name: "Security and Maintenance", cat: "system", ic: "security", go: "open:security", desc: "Review recent messages and resolve problems" },
    { id: "sound", name: "Sound", cat: "hardware", ic: "sound", go: "set:sound", desc: "Change system sounds and volume" },
    { id: "storage", name: "Storage Spaces", cat: "system", ic: "disk", go: "open:diskmgmt", desc: "Drives, quota and what's using space" },
    { id: "system", name: "System", cat: "system", ic: "system", go: "page:system", desc: "View basic information about your computer" },
    { id: "taskbar", name: "Taskbar and Navigation", cat: "appearance", ic: "taskbar", go: "set:personal", desc: "Customize the taskbar" },
    { id: "troubleshoot", name: "Troubleshooting", cat: "system", ic: "trouble", go: "set:troubleshoot", desc: "Find and fix common problems" },
    { id: "users", name: "User Accounts", cat: "users", ic: "users", go: "page:users", desc: "Change your account name, picture and settings" },
    { id: "firewall", name: "Windows Defender Firewall", cat: "system", ic: "firewall", go: "page:firewall", desc: "Protect your computer from network threats" },
    { id: "mail", name: "Mail (Microsoft Outlook)", cat: "users", ic: "mail", go: "open:outlook", desc: "Email profiles" },
  ];
  const PAGE_TITLE = { home: "Control Panel", all: "All Control Panel Items", programs: "Programs and Features", updates: "Installed Updates", system: "System", devices: "Devices and Printers", network: "Network and Sharing Center", personalization: "Personalization", datetime: "Date and Time", region: "Region", ease: "Ease of Access Center", users: "User Accounts", firewall: "Windows Defender Firewall", admintools: "Windows Tools", fonts: "Fonts", power: "Power Options", bitlocker: "BitLocker Drive Encryption", indexing: "Indexing Options" };
  const PAGE_CAT = { programs: "programs", updates: "programs", system: "system", firewall: "system", admintools: "system", bitlocker: "system", indexing: "system", devices: "hardware", power: "hardware", network: "network", personalization: "appearance", fonts: "appearance", datetime: "clock", region: "clock", ease: "ease", users: "users" };

  function openControlPanel(startPage) {
    const ref = WM.createWindow({ title: "Control Panel", icon: Icon.mini("controlpanel", "Control Panel"), width: Math.min(900, window.innerWidth - 30), height: Math.min(600, window.innerHeight - 90), appId: "controlpanel" });
    const body = ref.body; body.classList.add("st-host");
    body.innerHTML = `<div class="st-app st-cp">
      <div class="st-addr">
        <button class="st-nav" data-n="back" title="Back">${arrow("l")}</button><button class="st-nav" data-n="fwd" title="Forward">${arrow("r")}</button><button class="st-nav" data-n="up" title="Up">${arrow("u")}</button>
        <div class="st-crumbs"></div>
        <label class="st-search">${svgSearch()}<input placeholder="Search Control Panel" data-no-eye></label>
      </div>
      <div class="st-cp-body st-scroll"></div>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const content = $(".st-cp-body");
    let hist = [], idx = -1, view = (S().appData.cpView || "category"), cleanup = [];
    function go(page, push) {
      cleanup.forEach((f) => { try { f(); } catch (_) {} }); cleanup = [];
      if (push !== false) { hist = hist.slice(0, idx + 1); hist.push(page); idx = hist.length - 1; }
      render(page);
    }
    function crumbs(page) {
      const c = $(".st-crumbs"); const parts = [["Control Panel", "home"]];
      if (page === "all") parts.push(["All Control Panel Items", "all"]);
      else if (page.startsWith("cat:")) { const ct = CATS.find((x) => x.id === page.slice(4)); if (ct) parts.push([ct.name, page]); }
      else if (page.startsWith("search:")) parts.push(["Search results", page]);
      else if (PAGE_TITLE[page] && page !== "home") {
        if (view === "category" && PAGE_CAT[page]) { const ct = CATS.find((x) => x.id === PAGE_CAT[page]); parts.push([ct.name, "cat:" + ct.id]); }
        else parts.push(["All Control Panel Items", "all"]);
        if (page === "updates") parts.push(["Programs and Features", "programs"]);
        parts.push([PAGE_TITLE[page], page]);
      }
      c.innerHTML = `<span class="st-crumb-ic">${Icon.mini("controlpanel", "")}</span>` + parts.map(([n, p], i) => `<button class="st-crumb" data-p="${esc(p)}">${esc(n)}</button>${i < parts.length - 1 ? '<span class="st-crumb-sep">›</span>' : ""}`).join("");
      c.querySelectorAll(".st-crumb").forEach((b) => b.onclick = () => go(b.dataset.p));
      $('[data-n="back"]').disabled = idx <= 0; $('[data-n="fwd"]').disabled = idx >= hist.length - 1; $('[data-n="up"]').disabled = parts.length <= 1;
      $('[data-n="up"]').onclick = () => go(parts.length > 1 ? parts[parts.length - 2][1] : "home");
    }
    $('[data-n="back"]').onclick = () => { if (idx > 0) { idx--; render(hist[idx]); } };
    $('[data-n="fwd"]').onclick = () => { if (idx < hist.length - 1) { idx++; render(hist[idx]); } };
    const search = $(".st-search input");
    search.addEventListener("input", () => { const t = search.value.trim(); if (t) go("search:" + t, !String(hist[idx]).startsWith("search:")); else go("home"); });
    function act(target) {
      const [k, v] = String(target).split(":");
      if (k === "page") go(v);
      else if (k === "open") WM.open(v);
      else if (k === "set") openSettings(v);
      else if (k === "act" && v === "pair") pairDevice();
    }
    function viewBy() {
      const s = el(`<label class="st-viewby">View by: <select class="st-input st-sm"><option value="category">Category</option><option value="large">Large icons</option><option value="small">Small icons</option></select></label>`);
      const sel = s.querySelector("select"); sel.value = view;
      sel.onchange = () => { view = sel.value; S().appData.cpView = view; State.save(); go(view === "category" ? "home" : "all"); };
      return s;
    }
    function render(page) {
      crumbs(page); content.innerHTML = ""; content.scrollTop = 0;
      if (page === "home" && view !== "category") page = "all";
      if (page === "home") return renderHome();
      if (page === "all") return renderAll(view === "small");
      if (page.startsWith("cat:")) return renderCat(page.slice(4));
      if (page.startsWith("search:")) return renderSearch(page.slice(7));
      const P = PAGES[page]; if (!P) return renderHome();
      const wrap = el(`<div class="st-cp-page"><div class="st-cp-side"></div><div class="st-cp-main"><h1 class="st-h1">${esc(PAGE_TITLE[page] || page)}</h1></div></div>`);
      content.appendChild(wrap);
      const side = wrap.querySelector(".st-cp-side"), main = wrap.querySelector(".st-cp-main");
      side.appendChild(el(`<button class="st-sidelink st-side-home">Control Panel Home</button>`)).onclick = () => go("home");
      P(main, side, { go, act, redraw: () => render(page), onLeave: (f) => cleanup.push(f) });
    }
    function sideLink(side, text, fn, opts) { const b = el(`<button class="st-sidelink ${opts && opts.shield ? "st-shield" : ""}">${opts && opts.shield ? svgI("shield", 14) : ""}${esc(text)}</button>`); b.onclick = fn; side.appendChild(b); return b; }
    function renderHome() {
      const w = el(`<div class="st-cp-home"><div class="st-cp-hhead"><h1 class="st-h1">Adjust your computer's settings</h1></div><div class="st-cp-cats"></div></div>`);
      w.querySelector(".st-cp-hhead").appendChild(viewBy());
      const g = w.querySelector(".st-cp-cats");
      CATS.forEach((c) => {
        const card = el(`<div class="st-cp-cat"><span class="st-cp-catic">${gi(c.ic, 44)}</span><div><button class="st-cp-cattitle">${esc(c.name)}</button>${c.links.map(([t], i) => `<button class="st-cp-sublink" data-i="${i}">${esc(t)}</button>`).join("")}</div></div>`);
        card.querySelector(".st-cp-cattitle").onclick = () => go("cat:" + c.id);
        card.querySelectorAll(".st-cp-sublink").forEach((b) => b.onclick = () => act(c.links[+b.dataset.i][1]));
        g.appendChild(card);
      });
      content.appendChild(w);
    }
    function itemTile(it, small) {
      const b = el(`<button class="st-cp-item ${small ? "small" : ""}" title="${esc(it.desc)}"><span>${gi(it.ic, small ? 20 : 32)}</span><span class="st-cp-itemname">${esc(it.name)}</span></button>`);
      b.onclick = () => act(it.go);
      return b;
    }
    function renderAll(small) {
      const w = el(`<div class="st-cp-home"><div class="st-cp-hhead"><h1 class="st-h1">Adjust your computer's settings</h1></div><div class="st-cp-items ${small ? "small" : ""}"></div></div>`);
      w.querySelector(".st-cp-hhead").appendChild(viewBy());
      const g = w.querySelector(".st-cp-items");
      ITEMS.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((it) => g.appendChild(itemTile(it, small)));
      content.appendChild(w);
    }
    function renderCat(cid) {
      const c = CATS.find((x) => x.id === cid); if (!c) return renderHome();
      const w = el(`<div class="st-cp-page"><div class="st-cp-side"></div><div class="st-cp-main"></div></div>`);
      const side = w.querySelector(".st-cp-side"), main = w.querySelector(".st-cp-main");
      sideLink(side, "Control Panel Home", () => go("home")).classList.add("st-side-home");
      CATS.forEach((x) => { const b = sideLink(side, x.name, () => go("cat:" + x.id)); if (x.id === cid) b.classList.add("on"); });
      ITEMS.filter((it) => it.cat === cid).forEach((it) => {
        const r = el(`<div class="st-cp-catrow"><span>${gi(it.ic, 40)}</span><div><button class="st-cp-cattitle">${esc(it.name)}</button><div class="st-dim">${esc(it.desc)}</div></div></div>`);
        r.querySelector("button").onclick = () => act(it.go);
        main.appendChild(r);
      });
      content.appendChild(w);
    }
    function renderSearch(t) {
      const q = t.toLowerCase();
      const hits = ITEMS.filter((it) => (it.name + " " + it.desc).toLowerCase().includes(q));
      const w = el(`<div class="st-cp-home"><h1 class="st-h1">Search results for “${esc(t)}”</h1><div class="st-cp-items small"></div></div>`);
      const g = w.querySelector(".st-cp-items");
      hits.forEach((it) => g.appendChild(itemTile(it, true)));
      if (!hits.length) g.appendChild(el(`<div class="st-empty">No items match your search.</div>`));
      content.appendChild(w);
    }
    const PAGES = cpPages(sideLink);
    go(startPage || "home");
    return ref;
  }
  function arrow(d) { const p = { l: "M10 3L5 8l5 5", r: "M6 3l5 5-5 5", u: "M3 10l5-5 5 5" }[d]; return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${p}"/></svg>`; }
  function svgSearch() { return `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></svg>`; }
  function pairDevice() {
    if (window.Radios && Radios.bt.supported()) Radios.bt.pair();
    else note("Add a device", window.Radios ? Radios.bt.reason() : "Bluetooth isn't available in this browser.", "controlpanel");
  }
  const kv = (rows) => `<table class="st-kv st-kv2">${rows.filter(Boolean).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join("")}</table>`;
  function section(main, title, html) { const s = el(`<section class="st-sec"><h2 class="st-h2">${esc(title)}</h2><div class="st-sec-body">${html || ""}</div></section>`); main.appendChild(s); return s.querySelector(".st-sec-body"); }
  function btn(text, fn, cls) { const b = el(`<button class="st-btn ${cls || ""}">${text}</button>`); b.onclick = fn; return b; }

  // ---- real environment info ----
  function browserInfo() {
    const ua = navigator.userAgent || "";
    let name = "Unknown browser", ver = "";
    let m;
    if ((m = ua.match(/Edg\/([\d.]+)/))) { name = "Microsoft Edge"; ver = m[1]; }
    else if ((m = ua.match(/OPR\/([\d.]+)/))) { name = "Opera"; ver = m[1]; }
    else if ((m = ua.match(/Firefox\/([\d.]+)/))) { name = "Firefox"; ver = m[1]; }
    else if ((m = ua.match(/CriOS\/([\d.]+)/))) { name = "Chrome (iOS)"; ver = m[1]; }
    else if ((m = ua.match(/Chrome\/([\d.]+)/))) { name = /HeadlessChrome/.test(ua) ? "Chromium (headless)" : "Chrome"; ver = m[1]; }
    else if ((m = ua.match(/Version\/([\d.]+).*Safari/))) { name = "Safari"; ver = m[1]; }
    const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    let os = /Windows NT 10/.test(ua) ? "Windows 10/11" : /Windows/.test(ua) ? "Windows" : ipad ? "iPadOS" : /iPhone/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /CrOS/.test(ua) ? "ChromeOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
    const arch = /arm|aarch64/i.test(ua) || ipad || /iPhone|Macintosh/.test(ua) ? "ARM64 (or Apple silicon)" : /x86_64|Win64|x64|WOW64|amd64/i.test(ua) ? "x64" : "Unknown";
    return { name, ver, os, ipad, arch, ua, engine: /AppleWebKit/.test(ua) && !/Chrome|CriOS/.test(ua) ? "WebKit" : /Gecko\/\d/.test(ua) && /Firefox/.test(ua) ? "Gecko" : "Blink" };
  }
  function gpuName() {
    if (gpuName.v !== undefined) return gpuName.v;
    gpuName.v = "";
    try {
      const c = document.createElement("canvas"), gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (gl) {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        gpuName.v = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        gpuName.vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
        gpuName.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext();
      }
      c.width = c.height = 0;
    } catch (_) {}
    return gpuName.v;
  }
  function measureRefresh() {
    if (measureRefresh.p) return measureRefresh.p;
    measureRefresh.p = new Promise((res) => {
      let n = 0, t0 = 0; const times = [];
      const step = (t) => { if (t0) times.push(t - t0); t0 = t; if (++n < 40) requestAnimationFrame(step); else { times.sort((a, b) => a - b); const med = times[Math.floor(times.length / 2)] || 16.7; const hz = Math.round(1000 / med); res([60, 75, 90, 100, 120, 144, 165, 240].reduce((a, b) => Math.abs(b - hz) < Math.abs(a - hz) ? b : a, hz)); } };
      requestAnimationFrame(step);
      setTimeout(() => res(null), 3000);
    });
    return measureRefresh.p;
  }
  const edition = () => (S().hasProductKey ? "Windows 12 Pro" : "Windows 12 Home");

  function cpPages(sideLink) {
    return {
      // ---------------- Programs and Features ----------------
      programs(main, side, nav) {
        sideLink(side, "View installed updates", () => nav.go("updates"));
        sideLink(side, "Turn Windows features on or off", () => featuresDialog(main), { shield: true });
        main.appendChild(el(`<p class="st-dim">To uninstall a program, select it from the list and then click Uninstall. Built-in Windows apps can't be removed.</p>`));
        const tools = el(`<div class="st-cmdbar"><span class="st-cmd-org">Organize ▾</span><button class="st-cmd" data-a="un" disabled>Uninstall</button><button class="st-cmd" data-a="open" disabled>Open</button><span class="st-grow"></span><input class="st-input st-sm" placeholder="Search Programs and Features" data-no-eye></div>`);
        main.appendChild(tools);
        const tbl = el(`<div class="st-tablewrap"><table class="st-table st-sortable"><thead><tr><th data-k="name">Name</th><th data-k="pub">Publisher</th><th data-k="date">Installed On</th><th data-k="size">Size</th><th data-k="ver" class="st-col-opt">Version</th></tr></thead><tbody></tbody></table></div>`);
        main.appendChild(tbl);
        const foot = el(`<div class="st-cp-foot"></div>`); main.appendChild(foot);
        let sel = null, sortK = "name", dir = 1, filterT = "";
        const ad = S().appData;
        const sizeOf = (id) => jsonBytes(ad[id]) + jsonBytes(S()[id] && typeof S()[id] === "object" ? S()[id] : undefined);
        function rows() {
          const dates = ad.installDates || {};
          return installedList().map((a) => ({ ...a, pub: publisher(a.app), date: dates[a.id] || 0, size: sizeOf(a.id), ver: a.removable ? "1.0." + (a.id.length * 7 % 90) : "12.0.26100" }))
            .filter((r) => !filterT || (r.name + " " + r.pub).toLowerCase().includes(filterT))
            .sort((x, y) => { const a = x[sortK], b = y[sortK]; return (typeof a === "number" ? a - b : String(a).localeCompare(String(b))) * dir; });
        }
        function paint() {
          const r = rows(), tb = tbl.querySelector("tbody");
          tb.innerHTML = r.map((a) => `<tr data-id="${esc(a.id)}" class="${a.id === sel ? "sel" : ""}"><td><span class="st-cell-ic">${Icon.mini(a.id, a.name)}</span>${esc(a.name)}${a.removable ? "" : ' <span class="st-tag">Windows</span>'}</td><td>${esc(a.pub)}</td><td>${a.date ? new Date(a.date).toLocaleDateString() : a.removable ? "—" : "Built in"}</td><td>${a.size > 2 ? fmtBytes(a.size) : ""}</td><td class="st-col-opt">${esc(a.ver)}</td></tr>`).join("") || `<tr class="st-empty-row"><td colspan="5">No programs match.</td></tr>`;
          tb.querySelectorAll("tr[data-id]").forEach((tr) => { tr.onclick = () => { sel = tr.dataset.id; paint(); }; tr.ondblclick = () => { sel = tr.dataset.id; doUninstall(); }; });
          const cur = r.find((x) => x.id === sel);
          tools.querySelector('[data-a="un"]').disabled = !cur || !cur.removable;
          tools.querySelector('[data-a="open"]').disabled = !cur;
          tbl.querySelectorAll("th").forEach((th) => th.classList.toggle("sorted", th.dataset.k === sortK));
          const all = installedList(), removable = all.filter((x) => x.removable).length;
          const tot = all.reduce((s, a) => s + sizeOf(a.id), 0);
          foot.innerHTML = `<span class="st-cp-footic">${gi("programs", 36)}</span><div><b>Currently installed programs</b> &nbsp; Total size: ${fmtBytes(tot)}<br>${all.length} programs installed · ${removable} from the Microsoft Store can be uninstalled${cur ? `<br><b>${esc(cur.name)}</b> · ${esc(cur.pub)} · ${esc(cur.cat || "")}` : ""}</div>`;
        }
        function doUninstall() {
          const cur = installedList().find((x) => x.id === sel); if (!cur) return;
          if (!cur.removable) { modal(main, "Programs and Features", `<div class="st-msg">${svgI("info", 32)}<div>${esc(cur.name)} is part of Windows and can't be uninstalled.</div></div>`, [["OK", "cancel", true]]); return; }
          const m = modal(main, "Programs and Features", `<div class="st-msg">${svgI("q", 32)}<div>Are you sure you want to uninstall ${esc(cur.name)}?</div></div>`, [["Yes", "yes", true], ["No", "cancel"]]);
          m.on("yes", () => {
            m.close();
            elevate({ name: cur.name + " Uninstaller", publisher: publisher(cur.app), iconKey: cur.id }, () => {
              uninstall(cur.id); sel = null; paint();
              note("Programs and Features", cur.name + " was uninstalled.", "controlpanel");
            });
          });
        }
        tools.querySelector('[data-a="un"]').onclick = doUninstall;
        tools.querySelector('[data-a="open"]').onclick = () => sel && WM.open(sel);
        tools.querySelector("input").oninput = (e) => { filterT = e.target.value.trim().toLowerCase(); paint(); };
        tbl.querySelectorAll("th").forEach((th) => th.onclick = () => { if (sortK === th.dataset.k) dir = -dir; else { sortK = th.dataset.k; dir = 1; } paint(); });
        paint();
      },
      updates(main, side, nav) {
        sideLink(side, "Uninstall a program", () => nav.go("programs"));
        const ups = (window.SettingsParts && SettingsParts.UPDATES) || [];
        const done = !!(S().update && S().update.installed);
        main.appendChild(el(`<p class="st-dim">Updates from Windows Update. ${done ? "All updates are installed." : "Updates are waiting — install them in Settings › Windows Update."}</p>`));
        const t = el(`<div class="st-tablewrap"><table class="st-table"><thead><tr><th>Name</th><th>Program</th><th>Status</th></tr></thead><tbody>${ups.map((u) => `<tr><td>${esc(u.name)}</td><td>Microsoft Windows</td><td>${done ? "Installed" : "Pending"}</td></tr>`).join("") || `<tr class="st-empty-row"><td colspan="3">No updates.</td></tr>`}</tbody></table></div>`);
        main.appendChild(t);
        main.appendChild(btn("Open Windows Update", () => openSettings("update")));
      },
      // ---------------- System ----------------
      system(main, side, nav) {
        sideLink(side, "Device Manager", () => WM.open("devicemanager"), { shield: true });
        sideLink(side, "Disk Management", () => WM.open("diskmgmt"), { shield: true });
        sideLink(side, "Advanced system settings", () => WM.open("regedit"), { shield: true });
        sideLink(side, "System Information", () => WM.open("msinfo32"));
        sideLink(side, "Open About in Settings", () => openSettings("about"));
        main.appendChild(el(`<p class="st-dim">View basic information about your computer</p>`));
        systemInfo(main, nav);
      },
      // ---------------- Devices and Printers ----------------
      devices(main, side, nav) {
        sideLink(side, "Device Manager", () => WM.open("devicemanager"));
        sideLink(side, "Bluetooth settings", () => openSettings("devices"));
        const bar = el(`<div class="st-cmdbar"></div>`);
        bar.appendChild(btn("Add a device", pairDevice, "st-cmd"));
        bar.appendChild(btn("Add a printer", () => modal(main, "Add a printer", `<div class="st-msg">${gi("printer", 34)}<div>Browsers can't install printers. Use “Microsoft Print to PDF” — it opens your device's real print dialog, where you can choose any printer this device knows.</div></div>`, [["OK", "cancel", true]]), "st-cmd"));
        main.appendChild(bar);
        const grid = el(`<div></div>`); main.appendChild(grid);
        function paint() {
          const bi = browserInfo(); const touch = navigator.maxTouchPoints > 0;
          const groups = [
            ["Devices", [
              { ic: "computer", name: deviceName(), sub: edition() + " · " + bi.os, open: () => nav.go("system") },
              { ic: "monitor", name: "Generic PnP Monitor", sub: screen.width + " × " + screen.height + " @" + (window.devicePixelRatio || 1) + "x", open: () => WM.open("devicemanager") },
              { ic: touch ? "touch" : "mouse", name: touch ? "HID-compliant touch screen" : "HID-compliant mouse", sub: touch ? navigator.maxTouchPoints + " touch points" : "Pointer device", open: () => WM.open("devicemanager") },
              { ic: "keyboard", name: "HID Keyboard Device", sub: navigator.language || "", open: () => WM.open("devicemanager") },
              window.TouchID ? { ic: "fp", name: TouchID.driverInfo().name, sub: TouchID.enrolled() ? "Fingerprint set up" : "Not set up", open: () => openSettings("signin") } : null,
            ].filter(Boolean)],
            ["Bluetooth", (window.Radios ? Radios.bt.devices() : []).map((d) => ({ ic: "bt", name: d.name, sub: d.connected ? "Connected" + (d.battery != null ? " · battery " + d.battery + "%" : "") : "Paired", open: () => openSettings("devices") }))],
            ["Printers", [{ ic: "printer", name: "Microsoft Print to PDF", sub: "Default · ready", open: () => printTestPage(), action: "Print test page" }]],
          ];
          grid.innerHTML = "";
          groups.forEach(([g, items]) => {
            const s = el(`<div class="st-devgroup"><div class="st-devgroup-h">${esc(g)} (${items.length})</div><div class="st-devgrid"></div></div>`);
            const gd = s.querySelector(".st-devgrid");
            if (!items.length) gd.appendChild(el(`<div class="st-dim st-pad">${g === "Bluetooth" ? (window.Radios && Radios.bt.supported() ? "No Bluetooth devices paired yet. Use “Add a device”." : "Bluetooth isn't available in this browser.") : "None"}</div>`));
            items.forEach((d) => { const b = el(`<button class="st-devtile" title="${esc(d.action || "Open")}">${gi(d.ic, 48)}<b>${esc(d.name)}</b><span>${esc(d.sub)}</span></button>`); b.onclick = d.open; gd.appendChild(b); });
            grid.appendChild(s);
          });
        }
        paint();
        if (window.Radios) { const off = Radios.on(() => { if (!main.isConnected) return off(); paint(); }); nav.onLeave(off); }
      },
      // ---------------- Network and Sharing Center ----------------
      network(main, side, nav) {
        sideLink(side, "Change adapter settings", () => WM.open("devicemanager"));
        sideLink(side, "Network settings", () => openSettings("network"));
        sideLink(side, "Windows Defender Firewall", () => nav.go("firewall"));
        const box = el(`<div></div>`); main.appendChild(box);
        function paint() {
          const R = window.Radios, q = qs();
          const n = R ? R.net.info() : { online: navigator.onLine };
          const conn = R ? R.net.isConnected() : navigator.onLine;
          const parts = R ? R.net.parts() : [];
          box.innerHTML = `<h2 class="st-h2">View your basic network information and set up connections</h2>
            <div class="st-netmap"><div class="st-netnode">${gi("computer", 44)}<span>${esc(deviceName())}<br><small>(This computer)</small></span></div><div class="st-netline ${conn ? "on" : "off"}"></div><div class="st-netnode">${gi("network", 44)}<span>${conn ? "Internet" : "No Internet access"}</span></div></div>
            <div class="st-sec"><div class="st-h2s">View your active networks</div>
            ${conn ? `<div class="st-netcard"><div><b>${esc(q.ssid || "HomeNetwork_5G")}</b><span class="st-tag">name simulated</span><br><span class="st-dim">Private network</span></div>${kv([["Access type:", "Internet"], ["Connections:", esc(R ? (R.net.linkType() || "Wi-Fi") : "Wi-Fi") + " (" + esc(q.ssid || "HomeNetwork_5G") + ")"], ["Status:", '<span class="st-ok">● Connected (real)</span>'], ["Link details:", esc(parts.join(", ") || "Not reported by this browser")], ["Data saver:", n.saveData ? "On" : "Off"], ["Last test:", n.lastTest ? esc(n.latency != null ? n.latency + " ms latency, " + n.jitter + " ms jitter" : (n.error || "failed")) + " · " + new Date(n.lastTest).toLocaleTimeString() : "Not run yet"]])}</div>`
              : `<div class="st-netcard"><b>You are currently not connected to any networks.</b><br><span class="st-dim">${esc(R ? R.net.summary() : "Offline")}</span></div>`}</div>
            <div class="st-h2s">Change your networking settings</div>`;
          const acts = el(`<div class="st-tasks"></div>`);
          const t1 = el(`<button class="st-task">${gi("trouble", 28)}<span><b>Troubleshoot problems</b><br><span class="st-dim">Runs a real latency test to this site's server${n.testing ? " — testing…" : ""}</span></span></button>`);
          t1.onclick = () => { if (R) R.net.test(); };
          const t2 = el(`<button class="st-task">${gi("network", 28)}<span><b>${q.wifi ? "Disconnect Wi-Fi (simulated)" : "Connect to a network"}</b><br><span class="st-dim">Toggles the desktop's Wi-Fi switch — your device stays online</span></span></button>`);
          t2.onclick = () => { q.wifi = !q.wifi; if (q.wifi) q.plane = false; State.save(); if (WM.refreshWifi) WM.refreshWifi(); if (R) R.emit(); else paint(); };
          acts.append(t1, t2); box.appendChild(acts);
        }
        paint();
        if (window.Radios) { const off = Radios.on(() => { if (!main.isConnected) return off(); paint(); }); nav.onLeave(off); }
        const on = () => paint(); window.addEventListener("online", on); window.addEventListener("offline", on); nav.onLeave(() => { window.removeEventListener("online", on); window.removeEventListener("offline", on); });
      },
      // ---------------- Firewall ----------------
      firewall(main, side, nav) {
        const fw = S().appData.firewall || (S().appData.firewall = { private: true, public: true, notify: true });
        sideLink(side, "Turn Windows Defender Firewall on or off", () => onOff(), { shield: true });
        sideLink(side, "Restore defaults", () => { elevate({ name: "Windows Defender Firewall", iconKey: "security" }, () => { fw.private = fw.public = fw.notify = true; State.save(); nav.redraw(); }); }, { shield: true });
        sideLink(side, "Windows Security", () => WM.open("security"));
        main.appendChild(el(`<p class="st-dim">Windows Defender Firewall can help prevent hackers or malicious software from gaining access to your PC through the internet or a network. <span class="st-tag">switches are simulated · network status is real</span></p>`));
        const conn = window.Radios ? Radios.net.isConnected() : navigator.onLine;
        const card = (title, on, active) => `<div class="st-fwcard ${on ? "on" : "off"}"><div class="st-fwhead">${svgI("shield", 18)}<b>${title}</b><span>${active ? "Connected" : "Not connected"}</span></div>${kv([["Windows Defender Firewall state:", on ? "On" : '<span class="st-bad">Off</span>'], ["Incoming connections:", on ? "Block all connections to apps that are not on the list of allowed apps" : "Allowed"], ["Active networks:", active ? esc(qs().ssid || "HomeNetwork_5G") : "None"], ["Notification state:", fw.notify ? "Notify me when Windows Defender Firewall blocks a new app" : "Do not notify me"]])}</div>`;
        main.appendChild(el(`<div>${card("Private networks", fw.private, conn)}${card("Guest or public networks", fw.public, false)}</div>`));
        function onOff() {
          elevate({ name: "Windows Defender Firewall", publisher: "Microsoft Windows", iconKey: "security" }, () => {
            const m = modal(main, "Customize Settings", `<div class="st-form"><b>Private network settings</b><label><input type="radio" name="p" value="1" ${fw.private ? "checked" : ""}> Turn on Windows Defender Firewall</label><label><input type="radio" name="p" value="0" ${fw.private ? "" : "checked"}> Turn off Windows Defender Firewall (not recommended)</label><b>Public network settings</b><label><input type="radio" name="q" value="1" ${fw.public ? "checked" : ""}> Turn on Windows Defender Firewall</label><label><input type="radio" name="q" value="0" ${fw.public ? "" : "checked"}> Turn off Windows Defender Firewall (not recommended)</label><label><input type="checkbox" class="st-fwn" ${fw.notify ? "checked" : ""}> Notify me when Windows Defender Firewall blocks a new app</label></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
            m.on("ok", () => {
              fw.private = m.el.querySelector('input[name=p]:checked').value === "1"; fw.public = m.el.querySelector('input[name=q]:checked').value === "1"; fw.notify = m.el.querySelector(".st-fwn").checked;
              State.save(); log("System", fw.private && fw.public ? "Information" : "Warning", "Windows Firewall With Advanced Security", 2003, "A Windows Defender Firewall setting in the " + (fw.private && fw.public ? "all" : "a") + " profile has changed. Private: " + (fw.private ? "On" : "Off") + ", Public: " + (fw.public ? "On" : "Off") + ".");
              m.close(); nav.redraw();
            });
          });
        }
      },
      // ---------------- Personalization ----------------
      personalization(main, side, nav) {
        sideLink(side, "Change desktop icons", () => openSettings("icons"));
        sideLink(side, "Open Personalization in Settings", () => openSettings("personal"));
        sideLink(side, "Ease of Access Center", () => nav.go("ease"));
        main.appendChild(el(`<p class="st-dim">Change the visuals on your computer. Click a theme to change the desktop background, color and light or dark mode at once.</p>`));
        const xp = !!(S().desktop && S().desktop.xpTheme);
        const themes = [
          { id: "light", name: "Windows (light)", img: "assets/wall3.jpg", apply: () => { applyXP(false); setTheme("light"); } },
          { id: "dark", name: "Windows (dark)", img: "assets/wall4.jpg", apply: () => { applyXP(false); setTheme("dark"); } },
          { id: "auto", name: "Match my device", img: "assets/wall5.jpg", apply: () => { applyXP(false); setTheme("auto"); } },
          { id: "xp", name: "Windows XP", img: "assets/xp_wallpaper.png", apply: () => { applyXP(true); } },
        ];
        function applyXP(on) { const was = !!S().desktop.xpTheme; S().desktop.xpTheme = on; if (on !== was) S().desktop.wallpaper = on ? "assets/xp_wallpaper.png" : "default"; document.body.classList.toggle("xp-theme", on); State.save(); safeWall(); }
        const curT = xp ? "xp" : (S().theme === "light" || S().theme === "dark") ? S().theme : "auto";
        const tg = el(`<div class="st-themes"></div>`);
        themes.forEach((t) => { const b = el(`<button class="st-theme ${t.id === curT ? "sel" : ""}"><span style="background-image:url(${t.img})"></span>${esc(t.name)}</button>`); b.onclick = () => { t.apply(); tg.querySelectorAll(".st-theme").forEach((x) => x.classList.toggle("sel", x === b)); paintNow(); }; tg.appendChild(b); });
        section(main, "My Themes").appendChild(tg);
        const wb = section(main, "Desktop Background");
        const walls = [["default", "assets/wall3.jpg"], ["assets/wall4.jpg"], ["assets/wall5.jpg"], ["assets/wall6.jpg"], ["assets/wall2.jpg"], ["#0067c0"], ["#5a189a"], ["#111827"], ["#107c10"], ["#e53935"]];
        const wg = el(`<div class="st-walls"></div>`); wb.appendChild(wg);
        function paintWalls() { const cur = S().desktop.wallpaper || "default"; wg.innerHTML = ""; walls.forEach(([v, img]) => { const b = el(`<button class="st-wall ${cur === v ? "sel" : ""}" style="${v.startsWith("#") ? "background:" + v : "background-image:url(" + (img || v) + ")"}" title="${esc(v)}"></button>`); b.onclick = () => { setWallpaper(v); paintWalls(); paintNow(); }; wg.appendChild(b); }); }
        paintWalls();
        const cb = section(main, "Color");
        const acc = el(`<div class="st-accents"></div>`); cb.appendChild(acc);
        function paintAcc() { const cur = (S().accent || "#0067c0").toLowerCase(); acc.innerHTML = ""; ["#0067c0", "#0078d4", "#6b57ff", "#b146c2", "#e3008c", "#e81123", "#da3b01", "#ff8c00", "#ffb900", "#107c10", "#00b294", "#038387", "#4a5459"].forEach((c) => { const b = el(`<button class="st-acc ${c === cur ? "sel" : ""}" style="background:${c}" title="${c}"></button>`); b.onclick = () => { setAccent(c); paintAcc(); paintNow(); }; acc.appendChild(b); }); }
        paintAcc();
        const now = el(`<p class="st-dim st-now"></p>`); main.appendChild(now);
        function paintNow() { const w = S().desktop.wallpaper || "default"; now.textContent = "Current: " + (S().desktop.xpTheme ? "Windows XP theme" : resolveTheme() + " mode (" + (S().theme || "auto") + ")") + " · background " + (w.startsWith("data:") ? "your photo" : w) + " · accent " + (S().accent || "#0067c0"); }
        paintNow();
      },
      // ---------------- Date and Time ----------------
      datetime(main, side, nav) {
        sideLink(side, "Open Date & time in Settings", () => openSettings("datetime"));
        sideLink(side, "Region", () => nav.go("region"));
        const c = S().clock;
        let tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) {}
        const offMin = -new Date().getTimezoneOffset(); const offStr = "UTC" + (offMin >= 0 ? "+" : "−") + String(Math.floor(Math.abs(offMin) / 60)).padStart(2, "0") + ":" + String(Math.abs(offMin) % 60).padStart(2, "0");
        const box = el(`<div class="st-dt"><div class="st-dt-clock"><svg viewBox="0 0 100 100" width="130" height="130"><circle cx="50" cy="50" r="46" class="st-dt-face"/>${Array.from({ length: 12 }, (_, i) => `<line x1="50" y1="8" x2="50" y2="${i % 3 ? 13 : 16}" transform="rotate(${i * 30} 50 50)" class="st-dt-tick"/>`).join("")}<line class="st-dt-h" x1="50" y1="50" x2="50" y2="28"/><line class="st-dt-m" x1="50" y1="50" x2="50" y2="16"/><line class="st-dt-s" x1="50" y1="54" x2="50" y2="12"/><circle cx="50" cy="50" r="2.5" class="st-dt-dot"/></svg></div>
          <div><div class="st-dt-date"></div><div class="st-dt-time"></div><div class="st-dim">Time zone: (${esc(offStr)}) ${esc(tz || "Automatic")}</div><div class="st-dim st-dt-mode"></div><div class="st-row st-dt-btns"></div></div></div>`);
        main.appendChild(box);
        const tick = () => {
          if (!box.isConnected) return clearInterval(iv);
          const d = State.now();
          box.querySelector(".st-dt-date").textContent = d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
          box.querySelector(".st-dt-time").textContent = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: !c.format24 });
          const h = d.getHours() % 12, m = d.getMinutes(), s = d.getSeconds();
          box.querySelector(".st-dt-h").setAttribute("transform", `rotate(${h * 30 + m * 0.5} 50 50)`);
          box.querySelector(".st-dt-m").setAttribute("transform", `rotate(${m * 6 + s * 0.1} 50 50)`);
          box.querySelector(".st-dt-s").setAttribute("transform", `rotate(${s * 6} 50 50)`);
          box.querySelector(".st-dt-mode").textContent = c.mode === "custom" ? "Clock: set manually (custom time runs at 2× speed in this PC)" : "Clock: set automatically from this device";
        };
        const iv = setInterval(tick, 1000); nav.onLeave(() => clearInterval(iv)); tick();
        const btns = box.querySelector(".st-dt-btns");
        btns.appendChild(btn("Change date and time…", () => {
          const d = State.now(); const pad = (n) => String(n).padStart(2, "0");
          const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          elevate({ name: "Date and Time", iconKey: "clock" }, () => {
            const m = modal(main, "Date and Time Settings", `<div class="st-form"><label class="st-lbl">Date and time:</label><input type="datetime-local" class="st-input" value="${v}"></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
            m.on("ok", () => { const t = new Date(m.el.querySelector("input").value).getTime(); if (!isNaN(t)) { const old = State.now(); c.mode = "custom"; c.customBaseMs = t; c.customSetAt = Date.now(); State.save(); log("Security", "Audit Success", "Microsoft Windows security auditing.", 4616, "The system time was changed.\r\nPrevious Time:\t" + old.toLocaleString() + "\r\nNew Time:\t" + new Date(t).toLocaleString(), { user: userName() }); } m.close(); tick(); });
          });
        }));
        btns.appendChild(btn("Set automatically", () => { c.mode = "automatic"; State.save(); tick(); }));
        const f24 = el(`<label class="st-check"><input type="checkbox" ${c.format24 ? "checked" : ""}> 24-hour clock</label>`);
        f24.querySelector("input").onchange = (e) => { c.format24 = e.target.checked; State.save(); tick(); };
        btns.appendChild(f24);
        // Internet Time: compare this device's clock with the web server's Date header (real).
        const it = section(main, "Internet Time", `<div class="st-dim">This computer is set to automatically synchronize with the server that hosts this page.</div><div class="st-it-res"></div>`);
        it.appendChild(btn("Update now", async () => {
          const r = it.querySelector(".st-it-res"); r.textContent = "Synchronizing…";
          try {
            const t0 = Date.now(); const res = await fetch(location.href.split("#")[0], { method: "HEAD", cache: "no-store" }); const t1 = Date.now();
            const hd = res.headers.get("date"); if (!hd) throw new Error("no Date header");
            const server = new Date(hd).getTime() + (t1 - t0) / 2; const diff = Math.round((Date.now() - server) / 1000);
            r.innerHTML = `The clock was successfully synchronized with <b>${esc(location.host || "this server")}</b> on ${new Date().toLocaleString()}.<br>Your device's clock is ${Math.abs(diff) <= 1 ? "in sync" : Math.abs(diff) + " s " + (diff > 0 ? "ahead" : "behind")} (server's clock has 1 s precision).`;
            if (c.mode === "custom") { c.mode = "automatic"; State.save(); tick(); }
          } catch (e) { r.textContent = "An error occurred while Windows was synchronizing: " + (e && e.message || e) + "."; }
        }));
      },
      // ---------------- Region ----------------
      region(main, side, nav) {
        sideLink(side, "Language settings", () => openSettings("language"));
        sideLink(side, "Date and Time", () => nav.go("datetime"));
        const R = S().appData.regionFmt || "";
        const locales = ["en-US", "en-GB", "en-CA", "en-AU", "sv-SE", "de-DE", "fr-FR", "es-ES", "es-MX", "it-IT", "nl-NL", "pt-BR", "ja-JP", "ko-KR", "zh-CN", "ar-SA", "hi-IN", "pl-PL", "fi-FI", "nb-NO", "da-DK"];
        const nav0 = navigator.language || "en-US"; if (locales.indexOf(nav0) < 0) locales.unshift(nav0);
        const fmt = R || nav0;
        const f = section(main, "Formats");
        f.innerHTML = `<div class="st-form"><label class="st-lbl">Format:</label><select class="st-input st-fmt">${locales.map((l) => `<option value="${l}" ${l === fmt ? "selected" : ""}>${esc(dispLocale(l))}${l === nav0 ? " (this device)" : ""}</option>`).join("")}</select></div><div class="st-fmt-ex"></div>`;
        const ex = f.querySelector(".st-fmt-ex");
        function paintEx(l) { const d = State.now(); ex.innerHTML = `<b>Examples</b>` + kv([["Short date:", esc(d.toLocaleDateString(l))], ["Long date:", esc(d.toLocaleDateString(l, { weekday: "long", year: "numeric", month: "long", day: "numeric" }))], ["Short time:", esc(d.toLocaleTimeString(l, { hour: "numeric", minute: "2-digit" }))], ["Number:", esc((123456789.25).toLocaleString(l))], ["Currency:", esc(currencyFor(l))]]); }
        paintEx(fmt);
        f.querySelector(".st-fmt").onchange = (e) => { S().appData.regionFmt = e.target.value; State.save(); paintEx(e.target.value); };
        const loc = section(main, "Location");
        const regions = regionList();
        loc.innerHTML = `<div class="st-form"><label class="st-lbl">Home location (used by Settings and apps):</label><select class="st-input st-home">${regions.map((r) => `<option ${r === (S().region || "United States") ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></div>`;
        loc.querySelector(".st-home").onchange = (e) => { S().region = e.target.value; State.save(); note("Region", "Home location changed to " + e.target.value + ".", "controlpanel"); };
        const adm = section(main, "Administrative");
        adm.innerHTML = kv([["Windows display language:", esc(S().language || "English (United States)")], ["Browser languages:", esc((navigator.languages || [nav0]).join(", "))]]);
        if (window.I18n && I18n.languages) {
          const sel = el(`<select class="st-input">${I18n.languages.map((l) => `<option value="${esc(l.code)}" ${l.code === I18n.lang ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select>`);
          sel.onchange = () => { I18n.set(sel.value); nav.redraw(); };
          const r = el(`<div class="st-form"><label class="st-lbl">Change system display language:</label></div>`); r.appendChild(sel); adm.appendChild(r);
        }
      },
      // ---------------- Ease of Access ----------------
      ease(main, side, nav) {
        sideLink(side, "Open Accessibility in Settings", () => openSettings("access"));
        sideLink(side, "Personalization", () => nav.go("personalization"));
        main.appendChild(el(`<p class="st-dim">Make your computer easier to use. Every option below changes this desktop right away.</p>`));
        const pf = (S().appData.settings12 = S().appData.settings12 || {});
        const f = fx();
        const quick = section(main, "Quick access to common tools");
        const tools = el(`<div class="st-tasks"></div>`); quick.appendChild(tools);
        const t1 = el(`<button class="st-task">${gi("keyboard", 28)}<span><b>Start On-Screen Keyboard</b><br><span class="st-dim">${pf.osk ? "On — click to turn off" : "Type with touch or the mouse"}</span></span></button>`);
        t1.onclick = () => { pf.osk = !pf.osk; State.save(); if (window.OSK) (pf.osk ? OSK.show() : OSK.hide()); t1.querySelector(".st-dim").textContent = pf.osk ? "On — click to turn off" : "Type with touch or the mouse"; };
        const t2 = el(`<button class="st-task">${gi("sound", 28)}<span><b>Start Narrator</b><br><span class="st-dim">Reads text aloud with your device's voice</span></span></button>`);
        t2.onclick = () => { if (window.Narrator) { Narrator.start(); return; } try { const u = new SpeechSynthesisUtterance("Narrator is on. Welcome to Windows 12, " + userName() + "."); speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (_) { note("Narrator", "Speech isn't available in this browser.", "controlpanel"); } };
        tools.append(t1, t2);
        const opts = section(main, "Explore all settings");
        const a = a11y();
        const chk = (label, on, fn, sub) => { const r = el(`<label class="st-check st-check-lg"><input type="checkbox" ${on ? "checked" : ""}><span><b>${esc(label)}</b>${sub ? `<br><span class="st-dim">${esc(sub)}</span>` : ""}</span></label>`); r.querySelector("input").onchange = (e) => fn(e.target.checked); opts.appendChild(r); return r; };
        chk("Turn on accessibility mode", !!a.on, (v) => { a.on = v; a.contrast = a.bigText = a.reduceMotion = true; State.save(); if (window.applyTheme) applyTheme(); }, "High contrast, bigger text and reduced motion");
        chk("Turn off all unnecessary animations", !f.anim, (v) => { f.anim = !v; State.save(); if (window.applyUiFx) applyUiFx(); });
        chk("Turn off transparency", !f.blur, (v) => { f.blur = !v; State.save(); if (window.applyUiFx) applyUiFx(); });
        chk("Use dark mode", resolveTheme() === "dark", (v) => setTheme(v ? "dark" : "light"));
        const ts = el(`<div class="st-form"><label class="st-lbl">Make text bigger: <b class="st-tsv">${S().textScale || 100}%</b></label><input type="range" min="80" max="180" step="10" value="${S().textScale || 100}" class="st-range"></div>`);
        ts.querySelector("input").oninput = (e) => { setTextScale(+e.target.value); ts.querySelector(".st-tsv").textContent = e.target.value + "%"; };
        opts.appendChild(ts);
      },
      // ---------------- User Accounts ----------------
      users(main, side, nav) {
        sideLink(side, "Manage your credentials", () => openSettings("signin"));
        sideLink(side, "Change User Account Control settings", () => uacDialog(main), { shield: true });
        sideLink(side, "Your info in Settings", () => openSettings("yourinfo"));
        const pr = profile();
        const pic = pr.picture ? `<img class="st-avatar" src="${esc(pr.picture)}" alt="">` : `<span class="st-avatar st-avatar-def">${gi("users", 56)}</span>`;
        main.appendChild(el(`<h2 class="st-h2">Make changes to your user account</h2>`));
        const card = el(`<div class="st-usercard">${pic}<div><b class="st-uname">${esc(userName())}</b><br><span class="st-dim">${S().account && S().account.email ? esc(S().account.email) : "Local Account"}</span><br><span class="st-dim">Administrator · ${pr.authType === "password" ? "Password protected" : "PIN protected"}</span></div></div>`);
        main.appendChild(card);
        const tasks = el(`<div class="st-tasks st-tasks-col"></div>`); main.appendChild(tasks);
        const task = (t, fn, shield) => { const b = el(`<button class="st-sidelink st-tasklink ${shield ? "st-shield" : ""}">${shield ? svgI("shield", 14) : ""}${esc(t)}</button>`); b.onclick = fn; tasks.appendChild(b); };
        task("Change your account name", () => {
          const m = modal(main, "Change Your Name", `<div class="st-form"><label class="st-lbl">Type a new account name for ${esc(userName())}:</label><input class="st-input" maxlength="24" value="${esc(userName())}"><div class="st-dim">This name will appear on the Welcome screen, the Start menu and Settings.</div></div>`, [["Change Name", "ok", true], ["Cancel", "cancel"]]);
          m.on("ok", () => { const v = m.el.querySelector("input").value.trim(); if (v) { pr.username = v; State.save(); } m.close(); nav.redraw(); });
        });
        task("Change your picture", () => { const inp = document.getElementById("globalFileInput"); if (!inp) return; inp.accept = "image/*"; inp.value = ""; inp.onchange = () => { const fl = inp.files[0]; if (!fl) return; const r = new FileReader(); r.onload = () => { shrink(r.result, 256).then((u) => { pr.picture = u; State.save(); nav.redraw(); }); }; r.readAsDataURL(fl); }; inp.click(); });
        if (pr.picture) task("Remove your picture", () => { pr.picture = null; State.save(); nav.redraw(); });
        task("Change your account type", () => modal(main, "Change Account Type", `<div class="st-msg">${svgI("info", 30)}<div>${esc(userName())} is the only account on this PC, so it must stay an <b>Administrator</b>.</div></div>`, [["OK", "cancel", true]]), true);
        task("Change User Account Control settings", () => uacDialog(main), true);
      },
      // ---------------- Windows Tools / Administrative Tools ----------------
      admintools(main) {
        main.appendChild(el(`<p class="st-dim">Tools for system administrators and advanced users.</p>`));
        const tools = [["Control Panel", "controlpanel"], ["Device Manager", "devicemanager"], ["Disk Cleanup", "cleanmgr"], ["Disk Management", "diskmgmt"], ["Event Viewer", "eventviewer"], ["Registry Editor", "regedit"], ["Run", "run"], ["System Information", "msinfo32"], ["Task Manager", "taskmanager"], ["Task Scheduler", "taskschd"], ["Command Prompt", "terminal"], ["Windows PowerShell", "powershell"], ["Windows Security", "security"], ["File Explorer", "fileexplorer"]];
        const g = el(`<div class="st-cp-items"></div>`);
        tools.forEach(([n, id]) => { const b = el(`<button class="st-cp-item"><span>${Icon.mini(id, n)}</span><span class="st-cp-itemname">${esc(n)}</span></button>`); b.onclick = () => WM.open(id); g.appendChild(b); });
        main.appendChild(g);
      },
      // ---------------- Fonts (real: fonts loaded by this page + device font checks) ----------------
      fonts(main, side, nav) {
        if (window.SysUtil2 && SysUtil2.cp) return SysUtil2.cp.fonts(main, side, nav);   // install / uninstall fonts (js/sysutil2.js)
        main.appendChild(el(`<p class="st-dim">Preview fonts available to this desktop. Web fonts are loaded by the page; system fonts are detected on your device.</p>`));
        const g = el(`<div class="st-fonts"></div>`); main.appendChild(g);
        const fams = new Set();
        try { document.fonts.forEach((f) => { if (f.status === "loaded" || f.status === "unloaded") fams.add(f.family.replace(/["']/g, "")); }); } catch (_) {}
        ["Segoe UI", "Arial", "Times New Roman", "Courier New", "Helvetica Neue", "Georgia", "Verdana", "Menlo", "Consolas", "Tahoma", "Calibri", "Comic Sans MS"].forEach((f) => { try { if (document.fonts.check("12px '" + f + "'") && isSystemFont(f)) fams.add(f); } catch (_) {} });
        [...fams].sort().forEach((f) => { const t = el(`<div class="st-font"><div class="st-font-a" style="font-family:'${esc(f)}'">Abg</div><div class="st-font-n">${esc(f)}</div></div>`); g.appendChild(t); });
        if (!fams.size) g.appendChild(el(`<div class="st-empty">No fonts reported by this browser.</div>`));
      },
      // ---------------- Power (real Battery Status API when available) ----------------
      power(main, side, nav) {
        if (window.SysUtil2 && SysUtil2.cp) return SysUtil2.cp.power(main, side, nav);    // power plans + hibernate (js/sysutil2.js)
        sideLink(side, "Power & battery in Settings", () => openSettings("power"));
        const box = el(`<div class="st-dim">Checking battery…</div>`); main.appendChild(box);
        if (navigator.getBattery) navigator.getBattery().then((b) => {
          const paint = () => { box.className = ""; box.innerHTML = `<div class="st-battery"><div class="st-bat"><i style="width:${Math.round(b.level * 100)}%"></i></div><b>${Math.round(b.level * 100)}%</b> ${b.charging ? "· charging (plugged in)" : "· on battery"}</div>` + kv([["Time to full:", b.charging && isFinite(b.chargingTime) ? Math.round(b.chargingTime / 60) + " min" : "—"], ["Time remaining:", !b.charging && isFinite(b.dischargingTime) ? Math.round(b.dischargingTime / 60) + " min" : "—"], ["Source:", "Battery Status API (real)"]]); };
          paint(); ["levelchange", "chargingchange"].forEach((ev) => b.addEventListener(ev, () => { if (box.isConnected) paint(); }));
        }).catch(() => { box.textContent = "Battery information isn't available."; });
        else box.textContent = "This browser doesn't share battery information (Safari and Firefox keep it private). Your device's own battery icon shows the real level.";
        section(main, "Choose or customize a power plan", `<label class="st-check"><input type="radio" name="pp" checked> Balanced (recommended)</label><label class="st-check"><input type="radio" name="pp"> Power saver</label>`);
      },
      // ---------------- BitLocker Drive Encryption / Indexing Options (js/sysutil2.js) ----------------
      bitlocker(main, side, nav) {
        if (window.SysUtil2 && SysUtil2.cp) return SysUtil2.cp.bitlocker(main, side, nav);
        main.appendChild(el(`<div class="st-empty">BitLocker Drive Encryption is still loading. Try again in a moment.</div>`));
      },
      indexing(main, side, nav) {
        if (window.SysUtil2 && SysUtil2.cp) return SysUtil2.cp.indexing(main, side, nav);
        main.appendChild(el(`<div class="st-empty">Indexing Options is still loading. Try again in a moment.</div>`));
      },
    };
  }
  function dispLocale(l) { try { return new Intl.DisplayNames([l], { type: "language" }).of(l) + " — " + l; } catch (_) { return l; } }
  function currencyFor(l) { const cur = { "en-US": "USD", "en-GB": "GBP", "en-CA": "CAD", "en-AU": "AUD", "sv-SE": "SEK", "ja-JP": "JPY", "ko-KR": "KRW", "zh-CN": "CNY", "pt-BR": "BRL", "es-MX": "MXN", "hi-IN": "INR", "pl-PL": "PLN", "nb-NO": "NOK", "da-DK": "DKK", "ar-SA": "SAR" }[l] || "EUR"; try { return (123456789.25).toLocaleString(l, { style: "currency", currency: cur }); } catch (_) { return "$123,456,789.25"; } }
  function regionList() {
    const codes = ["US", "GB", "CA", "AU", "NZ", "IE", "SE", "NO", "DK", "FI", "DE", "FR", "ES", "IT", "NL", "BE", "CH", "AT", "PL", "PT", "BR", "MX", "AR", "JP", "KR", "CN", "IN", "SG", "ZA", "AE", "SA", "TR", "IL", "EG", "NG", "KE", "PH", "ID", "TH", "VN"];
    let names = codes.map((c) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(c); } catch (_) { return c; } });
    const cur = S().region || "United States"; if (names.indexOf(cur) < 0) names.push(cur);
    return names.sort();
  }
  function isSystemFont(f) { try { const c = document.createElement("canvas").getContext("2d"); const t = "mmmmmmmmmmlli"; c.font = "72px monospace"; const a = c.measureText(t).width; c.font = "72px '" + f + "', monospace"; return c.measureText(t).width !== a; } catch (_) { return false; } }
  function shrink(dataUrl, max) { return new Promise((res) => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.85)); }; img.onerror = () => res(dataUrl); img.src = dataUrl; }); }
  function printTestPage() {
    const f = document.createElement("iframe"); f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(f);
    const d = f.contentDocument; const bi = browserInfo();
    d.open(); d.write(`<!doctype html><title>Test page</title><body style="font-family:Segoe UI,Arial,sans-serif;padding:30px"><h1>Microsoft Print to PDF — Test Page</h1><p>Congratulations! If you can read this, your printer is working.</p><table cellpadding="4">${[["Computer name", deviceName()], ["Printer", "Microsoft Print to PDF"], ["Submitted", new Date().toLocaleString()], ["Browser", bi.name + " " + bi.ver], ["Operating system", bi.os]].map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</table></body>`); d.close();
    log("System", "Information", "PrintService", 307, "Document 1, Test Page owned by " + userName() + " was printed on Microsoft Print to PDF.");
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) {} setTimeout(() => f.remove(), 60000); }, 100);
  }
  function featuresDialog(host) {
    const t = S().appData.terminal || (S().appData.terminal = { archInstalled: false });
    const wf = S().appData.winFeatures || (S().appData.winFeatures = { net35: false, ie: false, hyperv: false, telnet: false, sandbox: false });
    elevate({ name: "Windows Features", iconKey: "controlpanel" }, () => {
      const list = [["wsl", "Windows Subsystem for Linux", !!t.archInstalled, "Real: installs Arch Linux in Terminal (wsl / arch)"], ["net35", ".NET Framework 3.5 (includes .NET 2.0 and 3.0)", wf.net35], ["hyperv", "Hyper-V", wf.hyperv], ["ie", "Internet Explorer 11", wf.ie], ["sandbox", "Windows Sandbox", wf.sandbox], ["telnet", "Telnet Client", wf.telnet]];
      const m = modal(host, "Windows Features", `<div class="st-form"><div class="st-dim">To turn a feature on, select its check box. To turn a feature off, clear its check box.</div>${list.map(([k, n, on, sub]) => `<label class="st-check"><input type="checkbox" data-k="${k}" ${on ? "checked" : ""}> ${esc(n)}${sub ? `<span class="st-tag">${esc(sub)}</span>` : ""}</label>`).join("")}</div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
      m.on("ok", () => {
        m.el.querySelectorAll("input[data-k]").forEach((c) => { if (c.dataset.k === "wsl") t.archInstalled = c.checked; else wf[c.dataset.k] = c.checked; });
        State.save(); m.close();
        log("Setup", "Information", "Microsoft-Windows-Servicing", 4, "Windows features were changed. Windows Subsystem for Linux: " + (t.archInstalled ? "Enabled" : "Disabled") + ".");
        note("Windows Features", "Windows completed the requested changes.", "controlpanel");
      });
    });
  }
  function uacDialog(host) {
    elevate({ name: "User Account Control Settings", iconKey: "controlpanel" }, () => {
      const labels = ["Never notify me", "Notify me only when apps try to make changes (do not dim my desktop)", "Notify me only when apps try to make changes (default)", "Always notify me"];
      const m = modal(host, "User Account Control Settings", `<div class="st-form"><b>Choose when to be notified about changes to your computer</b><input type="range" min="0" max="3" step="1" value="${uacLevel()}" class="st-range st-uac"><div class="st-uac-l st-dim">${esc(labels[uacLevel()])}</div><div class="st-dim">“Never notify” skips the prompt when you open Registry Editor or other admin tools. Also stored as EnableLUA in the registry.</div></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
      const r = m.el.querySelector(".st-uac"); r.oninput = () => { m.el.querySelector(".st-uac-l").textContent = labels[+r.value]; };
      m.on("ok", () => { S().appData.uacLevel = +r.value; State.save(); m.close(); });
    });
  }
  // System summary (used by Control Panel › System and msinfo32).
  function systemInfo(main, nav) {
    const bi = browserInfo();
    const memory = navigator.deviceMemory ? "≥ " + navigator.deviceMemory + " GB (reported by the browser, rounded)" : "Not reported by this browser";
    const touch = navigator.maxTouchPoints > 0 ? "Full Windows Touch Support with " + navigator.maxTouchPoints + " Touch Points" : "No Pen or Touch Input is available for this Display";
    const s1 = section(main, "Windows edition");
    s1.innerHTML = `<div class="st-sysed"><div>${esc(edition())}<br><span class="st-dim">© Cameron Systems. A pretend computer — not affiliated with Microsoft.</span></div><span class="st-winlogo">${Icon.md("winflag", "Windows")}</span></div>`;
    const s2 = section(main, "System");
    s2.innerHTML = kv([["Processor:", esc(navigator.hardwareConcurrency ? navigator.hardwareConcurrency + " logical processors (" + bi.arch + ")" : "Not reported")], ["Installed memory (RAM):", esc(memory)], ["System type:", esc((bi.arch.startsWith("x64") ? "64-bit operating system, x64-based processor" : bi.arch.startsWith("ARM") ? "64-bit operating system, ARM-based processor" : "64-bit operating system"))], ["Pen and Touch:", esc(touch)], ["Display:", esc(screen.width + " × " + screen.height + " · " + (window.devicePixelRatio || 1) + "× scaling · " + screen.colorDepth + "-bit color")], ["Graphics:", esc(gpuName() || "Not reported")], ["Host:", esc(bi.name + " " + bi.ver + " on " + bi.os)]]);
    const s3 = section(main, "Computer name, domain, and workgroup settings");
    s3.innerHTML = kv([["Computer name:", `<b class="st-cn">${esc(deviceName())}</b>`], ["Full computer name:", esc(deviceName())], ["Computer description:", ""], ["Workgroup:", "WORKGROUP"]]);
    s3.appendChild(btn(svgI("shield", 14) + " Change settings", () => {
      elevate({ name: "System Properties", iconKey: "controlpanel" }, () => {
        const m = modal(main, "Computer Name/Domain Changes", `<div class="st-form"><div class="st-dim">You can change the name of this computer. Changes might affect access to network resources.</div><label class="st-lbl">Computer name:</label><input class="st-input" maxlength="15" value="${esc(deviceName())}"><div class="st-dim">Letters, numbers and hyphens only (15 max).</div></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
        m.on("ok", () => { const v = m.el.querySelector("input").value; if (setDeviceName(v)) { m.close(); note("System Properties", "Your PC is now called " + deviceName() + ".", "controlpanel"); if (nav) nav.redraw(); } });
      });
    }));
    const s4 = section(main, "Windows activation");
    s4.innerHTML = S().hasProductKey ? `Windows is activated &nbsp; <span class="st-dim">Product key: ${esc(String(S().productKey || "").replace(/^(\w{3}-\w{3}).*/, "$1-***-***"))}</span>` : `Windows is not activated. <span class="st-dim">Enter a product key in Settings › Activation.</span>`;
    const s5 = section(main, "Storage", `<div class="st-dim">Measuring…</div>`);
    estimate().then((e) => {
      const ls = lsKeys().total;
      s5.innerHTML = kv([["Browser storage quota:", e ? esc(fmtBytes(e.quota)) : "Not reported"], ["Used by this site:", e ? esc(fmtBytes(e.usage)) : "—"], ["localStorage (settings & files):", esc(fmtBytes(ls)) + " · usually capped near 5 MB"]]);
      s5.appendChild(btn("Open Disk Management", () => WM.open("diskmgmt")));
    });
  }

  AR.controlpanel = function () { const p = window.ControlPanelStartPage || null; window.ControlPanelStartPage = null; return openControlPanel(p); };
  window.openControlPanel = openControlPanel;

  // msinfo32: System Information
  AR.msinfo32 = function () {
    const ref = WM.createWindow({ title: "System Information", icon: Icon.mini("devicemanager", "System Information"), width: Math.min(760, window.innerWidth - 30), height: Math.min(560, window.innerHeight - 90), appId: "msinfo32" });
    ref.body.classList.add("st-host");
    ref.body.innerHTML = `<div class="st-app"><div class="st-cp-body st-scroll st-pad2"></div></div>`;
    const main = ref.body.querySelector(".st-cp-body");
    main.appendChild(el(`<h1 class="st-h1">System Summary</h1>`));
    systemInfo(main, { redraw: () => { ref.close(); AR.msinfo32(); } });
    const bi = browserInfo();
    section(main, "Software Environment", kv([["User agent:", `<code class="st-code">${esc(bi.ua)}</code>`], ["Rendering engine:", esc(bi.engine)], ["Languages:", esc((navigator.languages || []).join(", "))], ["Cookies enabled:", navigator.cookieEnabled ? "Yes" : "No"], ["Secure context (HTTPS):", window.isSecureContext ? "Yes" : "No"], ["Online:", navigator.onLine ? "Yes" : "No"]]));
    return ref;
  };
  // winver: About Windows
  if (!AR.winver) AR.winver = function () {
    const ref = WM.createWindow({ title: "About Windows", icon: Icon.mini("winflag", "About Windows"), width: 460, height: 440, appId: "winver", noMax: true });
    ref.body.classList.add("st-host");
    ref.body.innerHTML = `<div class="st-app st-winver"><div class="st-winver-logo">${Icon.md("winflag", "Windows")}<span>Windows 12</span></div><hr><p>Microsoft Windows<br>Version 26H1 (OS Build 26100.${(S().update && S().update.installed) ? "4061" : "3775"})<br>© Cameron Systems. All rights reserved.</p><p class="st-dim">The ${esc(edition())} operating system and its user interface are a pretend computer made for fun. Not affiliated with Microsoft.</p><p>This product is licensed to:<br><b>${esc(userName())}</b><br><span class="st-dim">${esc(deviceName())}</span></p><div class="st-modal-btns"><button class="st-btn st-btn-def">OK</button></div></div>`;
    ref.body.querySelector(".st-btn").onclick = () => ref.close();
    return ref;
  };

  // =====================================================================
  //  DEVICE MANAGER
  // =====================================================================
  function dmStore() { return S().appData.devmgr || (S().appData.devmgr = { disabled: {}, removed: {}, drivers: {} }); }
  let mediaCache = null;
  async function enumMedia(force) {
    if (mediaCache && !force) return mediaCache;
    try { mediaCache = navigator.mediaDevices && navigator.mediaDevices.enumerateDevices ? await navigator.mediaDevices.enumerateDevices() : []; } catch (_) { mediaCache = []; }
    return mediaCache;
  }
  let batteryCache;
  async function battery() { if (batteryCache !== undefined) return batteryCache; try { batteryCache = navigator.getBattery ? await navigator.getBattery() : null; } catch (_) { batteryCache = null; } return batteryCache; }
  async function buildDevices(hz) {
    const bi = browserInfo(), media = await enumMedia(), bat = await battery();
    const est = await estimate();
    const R = window.Radios, q = qs();
    const dev = (cat, id, name, o) => Object.assign({ cat, id, name, mfr: "(Standard system devices)", driver: { provider: "Microsoft", date: "6/21/2006", version: "10.0.26100.1" }, props: [] }, o || {});
    const L = [];
    // Audio
    const ins = media.filter((d) => d.kind === "audioinput"), outs = media.filter((d) => d.kind === "audiooutput"), cams = media.filter((d) => d.kind === "videoinput");
    const label = (d, i, kind) => d.label || (d.deviceId === "default" ? "Default " + kind : kind + " " + (i + 1));
    (ins.length ? ins : [{ label: "", deviceId: "generic-in" }]).forEach((d, i) => L.push(dev("Audio inputs and outputs", "audin-" + (d.deviceId || i).slice(0, 12), (ins.length ? label(d, i, "Microphone") : "Microphone (High Definition Audio Device)") + (d.label ? "" : ""), { ic: "mic", real: !!ins.length, mfr: "Generic", props: [["Source", ins.length ? "navigator.mediaDevices.enumerateDevices()" : "Generic (browser reported no inputs)"], ["Label", d.label || "(hidden until you allow microphone access)"], ["Group ID", d.groupId || "—"]] })));
    (outs.length ? outs : [{ label: "", deviceId: "generic-out" }]).forEach((d, i) => L.push(dev("Audio inputs and outputs", "audout-" + (d.deviceId || i).slice(0, 12), outs.length ? label(d, i, "Speakers") : "Speakers (High Definition Audio Device)", { ic: "audio", real: !!outs.length, mfr: "Generic", props: [["Source", outs.length ? "enumerateDevices()" : "Generic (this browser doesn't list outputs)"], ["Label", d.label || "(hidden)"]] })));
    // Batteries
    L.push(dev("Batteries", "acadapter", "Microsoft AC Adapter", { ic: "power" }));
    if (bat) L.push(dev("Batteries", "battery0", "Microsoft ACPI-Compliant Control Method Battery", { ic: "battery", real: true, props: [["Charge level", Math.round(bat.level * 100) + "%"], ["Charging", bat.charging ? "Yes" : "No"], ["Source", "Battery Status API"]] }));
    // Biometric
    if (window.TouchID) { const t = TouchID.driverInfo(); L.push(dev("Biometric devices", "fingerprint", t.name, { ic: "fp", real: true, mfr: t.provider, driver: { provider: t.provider, date: t.date, version: t.version, file: t.driver }, props: [["Driver", t.driver], ["Enrolled", TouchID.enrolled() ? "Yes — a fingerprint is set up" : "No"], ["Sensor", TouchID.sensorName()]] })); }
    // Bluetooth
    if (R) {
      const sup = R.bt.supported();
      L.push(dev("Bluetooth", "btadapter", sup ? "Generic Bluetooth Adapter" : "Bluetooth Adapter (unavailable in this browser)", { ic: "bt", real: true, problem: !sup ? "This device cannot start. (Code 10) — " + R.bt.reason() : R.bt.adapter() === false ? "No Bluetooth radio found on this device. (Code 45)" : "", props: [["Web Bluetooth API", sup ? "Supported" : "Not supported"], ["Adapter", R.bt.adapter() == null ? "Unknown" : R.bt.adapter() ? "Present" : "Not found"], ["Status", R.bt.summary()], ["Switch (desktop)", q.bt ? "On" : "Off"]], onDisable: (off) => { R.bt.setEnabled(!off); } }));
      R.bt.devices().forEach((d) => L.push(dev("Bluetooth", "bt-" + String(d.id).slice(0, 16), d.name, { ic: "bt", real: true, mfr: "Bluetooth device", props: [["Connected", d.connected ? "Yes" : "No"], ["Battery", d.battery != null ? d.battery + "%" : "—"], ["Paired", d.pairedAt ? new Date(d.pairedAt).toLocaleString() : "—"]] })));
    }
    // Cameras
    cams.forEach((d, i) => L.push(dev("Cameras", "cam-" + (d.deviceId || i).slice(0, 12), label(d, i, "Camera"), { ic: "camera", real: true, props: [["Label", d.label || "(hidden until you allow camera access)"]] })));
    // Computer
    L.push(dev("Computer", "computer", bi.ipad ? "Apple iPad (ARM64 PC)" : bi.arch.startsWith("x64") ? "ACPI x64-based PC" : "ARM64-based PC", { ic: "computer", real: true, props: [["Host OS", bi.os], ["Architecture", bi.arch], ["Browser", bi.name + " " + bi.ver]] }));
    // Disk drives
    L.push(dev("Disk drives", "disk0", "Browser Storage Virtual Disk (" + (est ? fmtBytes(est.quota) : "unknown size") + ")", { ic: "disk", real: !!est, mfr: "(Standard disk drives)", props: est ? [["Capacity (quota)", fmtBytes(est.quota)], ["Used", fmtBytes(est.usage)], ["Source", "navigator.storage.estimate()"]] : [["Source", "Not reported"]] }));
    // Display adapters
    const g = gpuName();
    L.push(dev("Display adapters", "gpu0", g || "Microsoft Basic Display Adapter", { ic: "gpu", real: !!g, mfr: gpuName.vendor || "(Standard display types)", props: [["Renderer (WebGL)", g || "Not reported"], ["Vendor", gpuName.vendor || "—"], ["Max texture size", gpuName.maxTex ? gpuName.maxTex + " px" : "—"]] }));
    // HID
    if (navigator.maxTouchPoints > 0) L.push(dev("Human Interface Devices", "hidtouch", "HID-compliant touch screen", { ic: "touch", real: true, props: [["Max touch points", String(navigator.maxTouchPoints)]] }));
    L.push(dev("Human Interface Devices", "hidsys", "HID-compliant system controller", { ic: "hid" }));
    // Keyboards
    L.push(dev("Keyboards", "kbd0", bi.ipad ? "HID Keyboard Device (Magic Keyboard or on-screen)" : "HID Keyboard Device", { ic: "keyboard", real: true, props: [["Input language", navigator.language || "—"], ["Keyboard API", navigator.keyboard ? "Available" : "Not available"]] }));
    // Mice
    const fine = window.matchMedia && matchMedia("(pointer: fine)").matches, coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
    if (fine) L.push(dev("Mice and other pointing devices", "mouse0", "HID-compliant mouse", { ic: "mouse", real: true, props: [["Hover capable", matchMedia("(hover: hover)").matches ? "Yes" : "No"]] }));
    if (coarse || navigator.maxTouchPoints > 0) L.push(dev("Mice and other pointing devices", "touch0", "Touch input (" + navigator.maxTouchPoints + " points)", { ic: "touch", real: true, props: [["navigator.maxTouchPoints", String(navigator.maxTouchPoints)], ["Primary pointer", coarse ? "Coarse (finger)" : "Fine"]] }));
    // Monitors
    const hdr = window.matchMedia && matchMedia("(dynamic-range: high)").matches, p3 = window.matchMedia && matchMedia("(color-gamut: p3)").matches;
    L.push(dev("Monitors", "mon0", "Generic PnP Monitor", { ic: "monitor", real: true, mfr: "(Standard monitor types)", props: [["Resolution", screen.width + " × " + screen.height + " (CSS px)"], ["Physical pixels", Math.round(screen.width * (window.devicePixelRatio || 1)) + " × " + Math.round(screen.height * (window.devicePixelRatio || 1))], ["Available area", screen.availWidth + " × " + screen.availHeight], ["Scale (devicePixelRatio)", String(window.devicePixelRatio || 1)], ["Color depth", screen.colorDepth + "-bit"], ["Color gamut", p3 ? "Display P3 (wide)" : "sRGB"], ["HDR", hdr ? "Yes" : "No"], ["Refresh rate (measured)", hz ? "~" + hz + " Hz" : "measuring…"], ["Orientation", (screen.orientation && screen.orientation.type) || "—"]] }));
    // Network adapters
    const n = R ? R.net.info() : { online: navigator.onLine };
    const lt = R ? R.net.linkType() : "";
    L.push(dev("Network adapters", "net0", n.type === "ethernet" ? "Ethernet Controller" : n.type === "cellular" ? "Mobile Broadband Adapter" : "Wireless Network Adapter", { ic: "netcard", real: true, mfr: "Network adapters", problem: !n.online ? "Media disconnected — this device is offline." : "", props: [["Online", n.online ? "Yes" : "No"], ["Link", lt || "Not reported"], ["Connection type", n.type || "Not reported"], ["Effective type", n.effectiveType || "Not reported"], ["Downlink", n.downlink != null ? n.downlink + " Mbps" : "—"], ["RTT", n.rtt != null ? n.rtt + " ms" : "—"], ["Measured latency", n.latency != null ? n.latency + " ms" : "Run a test in Network and Sharing Center"], ["Desktop Wi-Fi switch", q.wifi ? "On" : "Off"]], onDisable: (off) => { q.wifi = !off; if (off) q.plane = false; State.save(); if (WM.refreshWifi) WM.refreshWifi(); if (R) R.emit(); } }));
    L.push(dev("Network adapters", "net1", "WAN Miniport (IKEv2)", { ic: "netcard" }));
    // Processors
    const cores = navigator.hardwareConcurrency || 1;
    for (let i = 0; i < cores; i++) L.push(dev("Processors", "cpu" + i, (bi.ipad || /Macintosh/.test(bi.ua) ? "Apple silicon" : bi.arch.startsWith("x64") ? "x64 Processor" : "ARM64 Processor") + " (logical core " + (i + 1) + ")", { ic: "cpu", real: true, mfr: "Processor", props: [["Logical processors (navigator.hardwareConcurrency)", String(cores)], ["Index", String(i)]] }));
    // Software devices
    L.push(dev("Software devices", "swspeech", "Microsoft Speech Synthesis", { ic: "software", real: "speechSynthesis" in window, props: [["Voices", (() => { try { return String(speechSynthesis.getVoices().length); } catch (_) { return "—"; } })()]] }));
    L.push(dev("Software devices", "swgeo", "Microsoft Geolocation Provider", { ic: "software", props: [["Geolocation API", "geolocation" in navigator ? "Available" : "No"]] }));
    // System devices
    ["ACPI Fixed Feature Button", "High precision event timer", "Microsoft ACPI-Compliant System", "PCI Express Root Complex", "System CMOS/real time clock", "Trusted Platform Module 2.0"].forEach((nm, i) => L.push(dev("System devices", "sys" + i, nm, { ic: "chip" })));
    // driver overrides
    const st = dmStore();
    L.forEach((d) => { if (st.drivers[d.id]) Object.assign(d.driver, st.drivers[d.id]); d.disabled = !!st.disabled[d.id]; d.removed = !!st.removed[d.id]; });
    return L;
  }
  const CAT_IC = { "Audio inputs and outputs": "audio", Batteries: "battery", "Biometric devices": "fp", Bluetooth: "bt", Cameras: "camera", Computer: "computer", "Disk drives": "disk", "Display adapters": "gpu", "Human Interface Devices": "hid", Keyboards: "keyboard", "Mice and other pointing devices": "mouse", Monitors: "monitor", "Network adapters": "netcard", Processors: "cpu", "Software devices": "software", "System devices": "chip" };

  function openDeviceManager() {
    const ref = WM.createWindow({ title: "Device Manager", icon: Icon.mini("devicemanager", "Device Manager"), width: Math.min(640, window.innerWidth - 30), height: Math.min(560, window.innerHeight - 90), appId: "devicemanager" });
    const body = ref.body; body.classList.add("st-host");
    body.innerHTML = `<div class="st-app st-dm">
      <div class="st-menubar"><button data-m="file">File</button><button data-m="action">Action</button><button data-m="view">View</button><button data-m="help">Help</button></div>
      <div class="st-toolbar">
        <button class="st-tb" data-a="props" title="Properties">${svgI("ev")}<span>Properties</span></button>
        <button class="st-tb" data-a="update" title="Update driver">${upIcon()}<span>Update driver</span></button>
        <button class="st-tb" data-a="disable" title="Disable device">${disIcon()}<span>Disable</span></button>
        <button class="st-tb" data-a="uninstall" title="Uninstall device">${svgI("x")}<span>Uninstall</span></button>
        <button class="st-tb" data-a="scan" title="Scan for hardware changes">${scanIcon()}<span>Scan for hardware changes</span></button>
      </div>
      <div class="st-tree st-dm-tree st-scroll" tabindex="0"></div>
      <div class="st-status"></div>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const open = new Set(S().appData.devmgrOpen || ["Biometric devices", "Display adapters", "Monitors"]);
    let devices = [], sel = null, hz = null;
    async function load(force) { if (force) { await enumMedia(true); batteryCache = undefined; } devices = await buildDevices(hz); paint(); }
    function paint() {
      const t = $(".st-dm-tree"); const st = t.scrollTop;
      const cats = [...new Set(devices.filter((d) => !d.removed).map((d) => d.cat))].sort();
      t.innerHTML = `<div class="st-tn st-tn-root ${sel === "__root" ? "sel" : ""}" data-root="1">${gi("computer", 18)}<span>${esc(deviceName())}</span></div>` + cats.map((c) => {
        const ds = devices.filter((d) => d.cat === c && !d.removed); const o = open.has(c);
        const warn = ds.some((d) => d.problem && !d.disabled);
        return `<div class="st-tn st-tn-l1 st-tn-cat" data-cat="${esc(c)}"><span class="st-tw">${o ? "▾" : "›"}</span>${gi(CAT_IC[c] || "chip", 18)}<span>${esc(c)}</span>${warn && !o ? '<span class="st-warnbadge">!</span>' : ""}</div>` + (o ? ds.map((d) => `<div class="st-tn st-tn-l2 ${sel === d.id ? "sel" : ""} ${d.disabled ? "st-disabled" : ""}" data-id="${esc(d.id)}" tabindex="-1"><span class="st-devic">${gi(d.ic || CAT_IC[c], 18)}${d.disabled ? '<span class="st-ovl st-ovl-dis">↓</span>' : d.problem ? '<span class="st-ovl st-ovl-warn">!</span>' : ""}</span><span>${esc(d.name)}</span>${d.real ? '<span class="st-real" title="Read from your real device">real</span>' : ""}</div>`).join("") : "");
      }).join("");
      t.scrollTop = st;
      t.querySelectorAll(".st-tn-cat").forEach((n) => n.onclick = () => { const c = n.dataset.cat; open.has(c) ? open.delete(c) : open.add(c); S().appData.devmgrOpen = [...open]; State.save(); paint(); });
      t.querySelectorAll("[data-id]").forEach((n) => { n.onclick = () => { sel = n.dataset.id; paint(); }; n.ondblclick = () => { sel = n.dataset.id; props(); }; });
      const cur = devices.find((d) => d.id === sel);
      $('[data-a="props"]').disabled = !cur; $('[data-a="update"]').disabled = !cur; $('[data-a="disable"]').disabled = !cur; $('[data-a="uninstall"]').disabled = !cur;
      $('[data-a="disable"] span').textContent = cur && cur.disabled ? "Enable" : "Disable";
      const removed = devices.filter((d) => d.removed).length, dis = devices.filter((d) => d.disabled && !d.removed).length;
      $(".st-status").textContent = devices.filter((d) => !d.removed).length + " devices · " + devices.filter((d) => d.real && !d.removed).length + " read from this device" + (dis ? " · " + dis + " disabled" : "") + (removed ? " · " + removed + " uninstalled (Scan for hardware changes to restore)" : "");
    }
    function cur() { return devices.find((d) => d.id === sel); }
    function setDisabled(d, off) {
      const st = dmStore(); if (off) st.disabled[d.id] = true; else delete st.disabled[d.id];
      State.save(); if (d.onDisable) try { d.onDisable(off); } catch (_) {}
      log("System", off ? "Warning" : "Information", "Kernel-PnP", off ? 225 : 400, "Device " + d.name + " was " + (off ? "disabled" : "enabled") + " by " + userName() + ".");
      d.disabled = off; paint();
    }
    function toggleDisable() {
      const d = cur(); if (!d) return;
      if (d.disabled) return setDisabled(d, false);
      const m = modal(body, d.name, `<div class="st-msg">${svgI("warn", 32)}<div>Disabling this device will cause it to stop functioning. Do you really want to disable it?${d.onDisable ? "<br><span class=\"st-dim\">This one is wired to the desktop: it turns the matching switch off.</span>" : ""}</div></div>`, [["Yes", "yes", true], ["No", "cancel"]]);
      m.on("yes", () => { m.close(); setDisabled(d, true); });
    }
    function uninstallDev() {
      const d = cur(); if (!d) return;
      const m = modal(body, "Uninstall Device", `<div class="st-msg">${gi(d.ic || "chip", 32)}<div><b>${esc(d.name)}</b><br>Warning: You are about to uninstall this device from your system.<br><span class="st-dim">It comes back the next time you choose “Scan for hardware changes”.</span></div></div>`, [["Uninstall", "yes", true], ["Cancel", "cancel"]]);
      m.on("yes", () => { m.close(); dmStore().removed[d.id] = true; State.save(); log("System", "Information", "Kernel-PnP", 420, "Device " + d.name + " was deleted."); sel = null; load(); });
    }
    function scan() {
      const st = dmStore(); const n = Object.keys(st.removed).length; st.removed = {}; State.save();
      $(".st-status").textContent = "Scanning for plug and play compliant hardware…";
      if (n) log("System", "Information", "Kernel-PnP", 410, n + " device(s) were reinstalled after scanning for hardware changes.");
      setTimeout(() => load(true), 600);
    }
    function updateDriver() {
      const d = cur(); if (!d) return;
      const m = modal(body, "Update Drivers - " + d.name, `<div class="st-form"><b>How do you want to search for drivers?</b><button class="st-bigopt" data-o="auto"><b>→ Search automatically for drivers</b><br><span class="st-dim">Windows will search your computer for the best available driver and install it on your device.</span></button><button class="st-bigopt" data-o="browse"><b>→ Browse my computer for drivers</b><br><span class="st-dim">Locate and install a driver manually.</span></button></div>`, [["Cancel", "cancel"]], { wide: true });
      m.el.querySelector('[data-o="auto"]').onclick = () => {
        const b = m.el.querySelector(".st-modal-body"); b.innerHTML = `<div class="st-msg"><span class="st-spin"></span><div>Searching for drivers…</div></div>`;
        setTimeout(() => {
          const st = dmStore(), cur0 = st.drivers[d.id];
          let msg;
          if (!cur0 || !cur0.updated) {
            const parts = String(d.driver.version).split(".").map((x) => +x || 0); parts[parts.length - 1] += 1;
            st.drivers[d.id] = { version: parts.join("."), date: new Date().toLocaleDateString("en-US"), updated: true }; State.save();
            log("System", "Information", "UserPnp", 20001, "Driver Management concluded the process to install driver " + parts.join(".") + " for Device Instance ID " + d.id.toUpperCase() + " with status 0x0.");
            msg = `<b>Windows has successfully updated your drivers</b><br>Windows has finished installing the drivers for this device:<br>${esc(d.name)} — version ${esc(parts.join("."))} <span class="st-tag">simulated</span>`;
          } else msg = `<b>The best drivers for your device are already installed</b><br>Windows has determined that the best driver for this device is already installed.`;
          b.innerHTML = `<div class="st-msg">${svgI("info", 32)}<div>${msg}</div></div>`;
          m.el.querySelector(".st-modal-btns").innerHTML = `<button class="st-btn st-btn-def">Close</button>`; m.el.querySelector(".st-modal-btns button").onclick = () => { m.close(); load(); };
        }, 1300);
      };
      m.el.querySelector('[data-o="browse"]').onclick = () => { m.close(); window.FilesStartPath = ["Local Disk (C:)", "Windows", "System32"]; WM.open("fileexplorer"); };
    }
    function props() {
      const d = cur(); if (!d) return;
      let tab = "general";
      const m = modal(body, d.name + " Properties", `<div class="st-tabs"><button data-t="general" class="on">General</button><button data-t="driver">Driver</button><button data-t="details">Details</button><button data-t="events">Events</button></div><div class="st-propbody"></div>`, [["OK", "cancel", true], ["Cancel", "cancel"]], { wide: true });
      const pb = m.el.querySelector(".st-propbody");
      function paintP() {
        m.el.querySelectorAll(".st-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === tab));
        if (tab === "general") pb.innerHTML = `<div class="st-prophead">${gi(d.ic || "chip", 36)}<b>${esc(d.name)}</b></div>` + kv([["Device type:", esc(d.cat)], ["Manufacturer:", esc(d.mfr)], ["Location:", d.real ? "Read from this device by the browser" : "On Microsoft Virtual Bus"]]) + `<div class="st-lbl">Device status</div><div class="st-statusbox">${d.disabled ? "This device is disabled. (Code 22)" : d.problem ? esc(d.problem) : "This device is working properly."}</div>`;
        else if (tab === "driver") {
          pb.innerHTML = `<div class="st-prophead">${gi(d.ic || "chip", 36)}<b>${esc(d.name)}</b></div>` + kv([["Driver Provider:", esc(d.driver.provider)], ["Driver Date:", esc(d.driver.date)], ["Driver Version:", esc(d.driver.version)], ["Digital Signer:", "Microsoft Windows"], d.driver.file ? ["Driver file:", esc(d.driver.file)] : null]) + `<div class="st-row st-wrap"></div>`;
          const row = pb.querySelector(".st-row");
          row.append(btn("Update Driver", () => { m.close(); updateDriver(); }), btn(d.disabled ? "Enable Device" : "Disable Device", () => { m.close(); toggleDisable(); }), btn("Uninstall Device", () => { m.close(); uninstallDev(); }));
          if (/^aud|^cam/.test(d.id) && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) row.append(btn("Show real device names", async () => { try { const s = await navigator.mediaDevices.getUserMedia(/^cam/.test(d.id) ? { video: true } : { audio: true }); s.getTracks().forEach((t) => t.stop()); m.close(); load(true); } catch (e) { note("Device Manager", "Access wasn't allowed: " + (e && e.name || e), "devicemanager"); } }));
        } else if (tab === "details") {
          const ps = d.props.length ? d.props : [["Device description", d.name]];
          pb.innerHTML = `<div class="st-lbl">Property</div><select class="st-input st-propsel">${ps.map(([k], i) => `<option value="${i}">${esc(k)}</option>`).join("")}<option value="all">(All properties)</option></select><div class="st-lbl">Value</div><div class="st-propval"></div>`;
          const sv = pb.querySelector(".st-propsel"), pv = pb.querySelector(".st-propval");
          const show = () => { pv.innerHTML = sv.value === "all" ? kv(ps.map(([k, v]) => [k, esc(v)])) : esc(ps[+sv.value][1]); };
          sv.onchange = show; show();
        } else {
          const evs = window.EventLog ? EventLog.list("System").filter((e) => e.msg.indexOf(d.name) >= 0 || e.msg.toUpperCase().indexOf(d.id.toUpperCase()) >= 0).slice(0, 20) : [];
          pb.innerHTML = evs.length ? `<table class="st-table"><thead><tr><th>Timestamp</th><th>Description</th></tr></thead><tbody>${evs.map((e) => `<tr><td>${esc(new Date(e.ts).toLocaleString())}</td><td>${esc(e.msg)}</td></tr>`).join("")}</tbody></table>` : `<div class="st-dim st-pad">No events for this device yet. Disable, enable or update it and they appear here (and in Event Viewer).</div>`;
        }
      }
      m.el.querySelectorAll(".st-tabs button").forEach((b) => b.onclick = () => { tab = b.dataset.t; paintP(); });
      paintP();
    }
    $('[data-a="props"]').onclick = props; $('[data-a="update"]').onclick = updateDriver; $('[data-a="disable"]').onclick = toggleDisable; $('[data-a="uninstall"]').onclick = uninstallDev; $('[data-a="scan"]').onclick = scan;
    menus(body, {
      file: [["Exit", () => ref.close()]],
      action: [["Update driver", updateDriver, () => !cur()], ["Disable device / Enable device", toggleDisable, () => !cur()], ["Uninstall device", uninstallDev, () => !cur()], ["-"], ["Scan for hardware changes", scan], ["-"], ["Properties", props, () => !cur()]],
      view: [["Expand all", () => { devices.forEach((d) => open.add(d.cat)); paint(); }], ["Collapse all", () => { open.clear(); paint(); }], ["Refresh", () => load(true)]],
      help: [["About Device Manager", () => modal(body, "About Device Manager", `<div class="st-msg">${Icon.mini("devicemanager", "")}<div>Device Manager shows hardware the browser can see on this device (marked <b>real</b>): display, GPU, touch, processors, audio, cameras, network, Bluetooth, battery and storage. Drivers and some system devices are simulated.</div></div>`, [["OK", "cancel", true]])]],
    });
    $(".st-dm-tree").addEventListener("keydown", (e) => {
      const ids = [...body.querySelectorAll("[data-id]")].map((n) => n.dataset.id); const i = ids.indexOf(sel);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = ids[Math.max(0, Math.min(ids.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))] || sel; paint(); }
      if (e.key === "Enter" && sel) props();
      if (e.key === "Delete" && sel) uninstallDev();
    });
    $(".st-status").textContent = "Enumerating devices…";
    load();
    measureRefresh().then((v) => { hz = v; if (body.isConnected) load(); });
    if (window.Radios) { const off = Radios.on(() => { if (!body.isConnected) return off(); load(); }); }
    return ref;
  }
  function upIcon() { return `<svg class="st-i" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="5" width="12" height="7" rx="1"/><path d="M8 1.5v6M5.5 4L8 1.5 10.5 4" stroke="#107c10" stroke-width="1.6"/></svg>`; }
  function disIcon() { return `<svg class="st-i" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="3" width="12" height="7" rx="1"/><circle cx="11.5" cy="11.5" r="3.5" fill="#fff" stroke="#333"/><path d="M11.5 9.8v3.4M10 11.8l1.5 1.5 1.5-1.5" stroke="#333"/></svg>`; }
  function scanIcon() { return `<svg class="st-i" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="3" width="10" height="7" rx="1"/><circle cx="11" cy="11" r="3" stroke="#0067c0" stroke-width="1.5"/><path d="M13.2 13.2l2 2" stroke="#0067c0" stroke-width="1.6"/></svg>`; }
  AR.devicemanager = openDeviceManager;
  AR.devmgmt = openDeviceManager;

  // =====================================================================
  //  DISK MANAGEMENT
  // =====================================================================
  function openDiskMgmt() {
    const ref = WM.createWindow({ title: "Disk Management", icon: Icon.mini("diskmgmt", "Disk Management"), width: Math.min(860, window.innerWidth - 30), height: Math.min(600, window.innerHeight - 90), appId: "diskmgmt" });
    const body = ref.body; body.classList.add("st-host");
    body.innerHTML = `<div class="st-app st-dk">
      <div class="st-menubar"><button data-m="file">File</button><button data-m="action">Action</button><button data-m="view">View</button><button data-m="help">Help</button></div>
      <div class="st-toolbar"><button class="st-tb" data-a="refresh">${svgI("refresh")}<span>Refresh</span></button><button class="st-tb" data-a="persist">${svgI("shield")}<span>Make storage persistent</span></button><button class="st-tb" data-a="clean">${Icon.mini("cleanmgr", "")}<span>Disk Cleanup</span></button></div>
      <div class="st-dk-main st-scroll"><div class="st-dk-vols"></div><div class="st-dk-disks"></div><div class="st-dk-break"></div></div>
      <div class="st-status"></div>
    </div>`;
    const $ = (s) => body.querySelector(s);
    async function paint() {
      $(".st-status").textContent = "Reading storage…";
      const e = await estimate(); const b = breakdown();
      let persisted = null; try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (_) {}
      const quota = e && e.quota || 0, usage = e && e.usage || 0, det = (e && e.usageDetails) || null;
      const LSCAP = browserInfo().engine === "WebKit" ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // Safari ≈ 5 MB, Chrome/Firefox ≈ 5M UTF-16 chars
      const lsUsed = b.total;
      const idb = det ? det.indexedDB || 0 : null, cch = det ? det.caches || 0 : null, sw = det ? det.serviceWorkerRegistrations || 0 : null;
      const vols = [
        { name: "(C:)", label: "Browser storage", layout: "Simple", type: "Basic", fs: "NTFS", status: "Healthy (Boot, Page File, Primary Partition)" + (persisted ? " · Persistent" : persisted === false ? " · Best-effort" : ""), cap: quota, free: Math.max(0, quota - usage), real: !!e },
        { name: "(L:)", label: "localStorage", layout: "Simple", type: "Basic", fs: "UTF-16", status: "Healthy (Settings, files & app data)", cap: LSCAP, free: Math.max(0, LSCAP - lsUsed), real: true, approx: true },
      ];
      $(".st-dk-vols").innerHTML = `<div class="st-tablewrap"><table class="st-table"><thead><tr><th>Volume</th><th>Layout</th><th>Type</th><th>File System</th><th>Status</th><th>Capacity</th><th>Free Space</th><th>% Free</th></tr></thead><tbody>${vols.map((v) => `<tr><td>${gi("disk", 16)} ${esc(v.name)} ${esc(v.label)}</td><td>${v.layout}</td><td>${v.type}</td><td>${v.fs}</td><td>${esc(v.status)}</td><td>${v.cap ? (v.approx ? "≈ " : "") + fmtBytes(v.cap) : "Unknown"}</td><td>${v.cap ? fmtBytes(v.free) : "—"}</td><td>${v.cap ? Math.round(v.free / v.cap * 100) + " %" : "—"}</td></tr>`).join("")}</tbody></table></div>`;
      // Disk 0 graphical layout (real proportions of usage)
      const part = (label, bytes, cls, total) => `<div class="st-part ${cls}" style="flex:${Math.max(0.12, total ? bytes / total : 0)}"><b>${esc(label)}</b><span>${fmtBytes(bytes)}</span></div>`;
      const other = det ? Math.max(0, usage - (idb || 0) - (cch || 0) - (sw || 0)) : Math.max(0, usage - lsUsed);
      $(".st-dk-disks").innerHTML = `<div class="st-disk"><div class="st-disk-lbl">${gi("disk", 22)}<b>Disk 0</b><span>Basic</span><span>${quota ? fmtBytes(quota) : "Unknown"}</span><span>Online</span></div><div class="st-disk-parts">${quota ? [
        part("localStorage", lsUsed, "p-ls", quota),
        idb != null ? part("IndexedDB (big files)", idb, "p-idb", quota) : "",
        cch != null ? part("Cache Storage", cch, "p-cache", quota) : "",
        part(det ? "Other site data" : "Site data", other, "p-other", quota),
        `<div class="st-part p-free" style="flex:${Math.max(0.5, (quota - usage) / quota)}"><b>Free space</b><span>${fmtBytes(quota - usage)}</span></div>`,
      ].join("") : '<div class="st-part p-free" style="flex:1"><b>Unknown</b><span>This browser doesn\'t report a storage quota</span></div>'}</div></div>
      <div class="st-disk"><div class="st-disk-lbl">${gi("disk", 22)}<b>Disk 1</b><span>localStorage</span><span>≈ ${fmtBytes(LSCAP)}</span><span>Online</span></div><div class="st-disk-parts">${lsParts(b.cats, lsUsed).map((c) => `<div class="st-part" style="flex:${c.flex};border-top-color:${c.color}" title="${esc(c.name)}: ${fmtBytes(c.bytes)}"><b>${esc(c.name)}</b><span>${fmtBytes(c.bytes)}</span></div>`).join("")}<div class="st-part p-free" style="flex:${Math.max(1.4, (LSCAP - lsUsed) / LSCAP * 4)}"><b>Free</b><span>${fmtBytes(Math.max(0, LSCAP - lsUsed))}</span></div></div></div>
      <div class="st-legend"><span><i class="p-ls"></i>localStorage</span><span><i class="p-idb"></i>IndexedDB</span><span><i class="p-cache"></i>Cache Storage</span><span><i class="p-other"></i>Other</span><span><i class="p-free"></i>Free / unallocated</span></div>`;
      // Breakdown of localStorage by category and by key
      const max = Math.max(1, ...b.cats.map((c) => c.bytes));
      $(".st-dk-break").innerHTML = `<h2 class="st-h2">What's using localStorage (${fmtBytes(lsUsed)})</h2><div class="st-bars">${b.cats.map((c) => `<div class="st-barrow"><span class="st-barname"><i style="background:${c.color}"></i>${esc(c.name)}</span><span class="st-bar"><i style="width:${(c.bytes / max * 100).toFixed(1)}%;background:${c.color}"></i></span><span class="st-barval">${fmtBytes(c.bytes)}</span></div>`).join("")}</div>
        <h2 class="st-h2">localStorage keys</h2><div class="st-tablewrap"><table class="st-table"><thead><tr><th>Key</th><th>Size</th></tr></thead><tbody>${b.keys.map((k) => `<tr><td><code class="st-code">${esc(k.key)}</code></td><td>${fmtBytes(k.bytes)}</td></tr>`).join("")}</tbody></table></div>
        <p class="st-dim">Sizes are measured live: localStorage stores text as UTF-16, so each character takes 2 bytes. Quota and usage come from navigator.storage.estimate()${det ? " (with a per-type breakdown from this browser)" : ""}.</p>`;
      $(".st-status").textContent = (e ? "Quota " + fmtBytes(quota) + " · used " + fmtBytes(usage) + " (" + (quota ? (usage / quota * 100).toFixed(2) : "?") + "%)" : "Storage estimate not available") + " · localStorage " + fmtBytes(lsUsed) + (persisted != null ? " · " + (persisted ? "persistent storage granted" : "best-effort storage (may be cleared when the device is low on space)") : "");
      $('[data-a="persist"]').disabled = !navigator.storage || !navigator.storage.persist || persisted === true;
    }
    $('[data-a="refresh"]').onclick = paint;
    $('[data-a="clean"]').onclick = () => WM.open("cleanmgr");
    $('[data-a="persist"]').onclick = async () => {
      let ok = false; try { ok = await navigator.storage.persist(); } catch (_) {}
      modal(body, "Disk Management", `<div class="st-msg">${svgI(ok ? "info" : "warn", 30)}<div>${ok ? "This browser granted persistent storage: your desktop won't be cleared automatically when the device runs low on space." : "The browser didn't grant persistent storage right now (it decides based on how often you use this site). Your data is still saved."}</div></div>`, [["OK", "cancel", true]]);
      paint();
    };
    menus(body, { file: [["Exit", () => ref.close()]], action: [["Refresh", paint], ["Rescan Disks", paint], ["Disk Cleanup", () => WM.open("cleanmgr")]], view: [["Refresh", paint]], help: [["About Disk Management", () => modal(body, "About Disk Management", `<div class="st-msg">${Icon.mini("diskmgmt", "")}<div>Disk 0 is this site's real browser storage quota. Disk 1 is localStorage, where settings and files live (browsers cap it near 5 MB).</div></div>`, [["OK", "cancel", true]])]] });
    paint();
    return ref;
  }
  // The biggest few categories get their own partition; the rest are grouped.
  function lsParts(cats, used) {
    const nz = cats.filter((c) => c.bytes > 0), top = nz.slice(0, 3), rest = nz.slice(3);
    const SHORT = { files: "Files", system: "System", temp: "Temp files", thumbs: "Thumbnails", imagegen: "Image Studio", snips: "Snips", terminal: "Terminal", notif: "Notifications", ai: "AI chats", browser: "Web data", events: "Event logs", media: "Pictures & icons", apps: "App data", otherkeys: "Sign-ins" };
    const out = top.map((c) => ({ name: SHORT[c.key] || c.name, bytes: c.bytes, color: c.color }));
    if (rest.length) out.push({ name: "Other (" + rest.length + ")", bytes: rest.reduce((s, c) => s + c.bytes, 0), color: "#767676" });
    return out.map((c) => Object.assign(c, { flex: Math.max(0.9, used ? c.bytes / used * 3 : 1) }));
  }
  AR.diskmgmt = openDiskMgmt;

  // =====================================================================
  //  DISK CLEANUP
  // =====================================================================
  function cleanupCats(system) {
    const d = S(), ad = d.appData || (d.appData = {});
    const C = [];
    const bin = (d.desktop && d.desktop.bin) || [];
    // The file Recycle Bin (js/files12.js keeps deleted files in appData.fileBin); their IndexedDB bytes are freed too.
    const fbin = Array.isArray(ad.fileBin) ? ad.fileBin : [];
    const blobIds = []; const ids = (n) => { if (!n) return; if (typeof n.blob === "string") blobIds.push(n.blob); if (n.type === "folder") Object.values(n.children || {}).forEach(ids); };
    const nodeSize = (n) => !n ? 0 : n.type === "folder" ? Object.values(n.children || {}).reduce((s, x) => s + nodeSize(x), 0) : (typeof n.size === "number" && (n.blob || !n.content) ? n.size : jsonBytes(n));
    C.push({ id: "bin", name: "Recycle Bin", desc: "The Recycle Bin contains files and shortcuts you've deleted. Emptying it removes them for good (Storage Sense can do this automatically for old items).", bytes: (bin.length ? jsonBytes(bin) : 0) + fbin.reduce((s, b) => s + nodeSize(b && b.node), 0), count: bin.length + fbin.length, check: false,
      run: async () => {
        d.desktop.bin = []; if (WM.refreshDesktopIcons) WM.refreshDesktopIcons();
        if (fbin.length) { fbin.forEach((b) => ids(b && b.node)); ad.fileBin = []; State.save(); try { window.dispatchEvent(new Event("vfs-change")); } catch (_) {} if (window.SysUtil2 && SysUtil2.gcBlobs) await SysUtil2.gcBlobs(blobIds); }
      } });
    const tmp = tempTargets();
    C.push({ id: "temp", name: "Temporary files", desc: "Files in C:\\Windows\\Temp, AppData\\Local\\Temp and other .tmp files that apps don't need anymore.", bytes: tmp.reduce((s, t) => s + jsonBytes(t.kids[t.name]), 0), count: tmp.length, check: true, run: () => tempTargets().forEach((t) => { delete t.kids[t.name]; }) });
    const th = thumbTargets();
    C.push({ id: "thumbs", name: "Thumbnails", desc: "Small previews of your pictures. They're rebuilt from the full pictures (stored separately) — only the preview icons are removed.", bytes: th.reduce((s, n) => s + n.src.length * 2, 0), count: th.length, check: true, run: () => thumbTargets().forEach((n) => { delete n.src; }) });
    const arr = (o, k) => (o && Array.isArray(o[k]) ? o[k] : []);
    C.push({ id: "imagegen", name: "Image Studio history", desc: "Images and prompts you generated in Image Studio.", bytes: jsonBytes(arr(ad, "imageGen")) * (arr(ad, "imageGen").length ? 1 : 0), count: arr(ad, "imageGen").length, check: false, run: () => { arr(ad, "imageGen").length = 0; } });
    const th2 = ad.terminal && arr(ad.terminal, "history");
    C.push({ id: "terminal", name: "Terminal command history", desc: "Commands you typed in Terminal, Command Prompt and PowerShell.", bytes: th2 && th2.length ? jsonBytes(th2) : 0, count: th2 ? th2.length : 0, check: false, run: () => { if (th2) th2.length = 0; } });
    { const nc = (ad.notifCenter && Array.isArray(ad.notifCenter.items)) ? ad.notifCenter.items : null;
      const n = arr(ad, "notifLog").length + (nc ? nc.length : 0);
      C.push({ id: "notif", name: "Notification history", desc: "Old notifications kept for the Notification Center.", bytes: n ? jsonBytes(ad.notifLog) + (nc ? jsonBytes(nc) : 0) : 0, count: n, check: true, run: () => { arr(ad, "notifLog").length = 0; if (nc) nc.length = 0; } }); }
    const bh = ad.browser && arr(ad.browser, "history");
    C.push({ id: "web", name: "Temporary Internet Files", desc: "Browsing history from Edge/Chrome in this desktop and cached weather data.", bytes: (bh && bh.length ? jsonBytes(bh) : 0) + jsonBytes(ad.weather), count: (bh ? bh.length : 0) + (ad.weather ? 1 : 0), check: true, run: () => { if (bh) bh.length = 0; delete ad.weather; } });
    const ch = d.copilot && arr(d.copilot, "history");
    C.push({ id: "ai", name: "Copilot conversation history", desc: "Your chats with Copilot (your API key and settings are kept).", bytes: ch && ch.length ? jsonBytes(ch) : 0, count: ch ? ch.length : 0, check: false, run: () => { if (ch) ch.length = 0; } });
    C.push({ id: "caches", name: "Downloaded program files (Cache Storage)", desc: "Files this site's apps cached in the browser's Cache Storage, such as downloaded AI models. They're downloaded again when needed.", bytes: null, count: 0, check: false, async: true, run: async () => { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } } });
    if (system) {
      const wer = (ad.eventLog || []).filter((e) => e.source === "Application Error" || e.source === "BugCheck");
      C.push({ id: "wer", name: "System error memory dump files & Windows Error Reporting", desc: "Crash reports (BugCheck) and application error reports from Event Viewer.", bytes: jsonBytes(wer) * (wer.length ? 1 : 0), count: wer.length, check: true, run: () => { const l = ad.eventLog || []; for (let i = l.length - 1; i >= 0; i--) if (l[i].source === "Application Error" || l[i].source === "BugCheck") l.splice(i, 1); } });
      const events = (ad.eventLog || []).filter((e) => e.source !== "Application Error" && e.source !== "BugCheck");
      C.push({ id: "logs", name: "Windows upgrade log files", desc: "Older Event Viewer entries (everything except the newest 50).", bytes: events.length > 50 ? jsonBytes(events.slice(0, events.length - 50)) : 0, count: Math.max(0, events.length - 50), check: false, run: () => { const l = ad.eventLog || []; let keep = 50; for (let i = l.length - 1; i >= 0; i--) { if (l[i].source === "Application Error" || l[i].source === "BugCheck") continue; if (keep > 0) { keep--; continue; } l.splice(i, 1); } } });
    }
    return C;
  }
  async function cacheBytes() {
    try {
      const e = await estimate(); if (e && e.usageDetails && typeof e.usageDetails.caches === "number") return e.usageDetails.caches;
      if (!window.caches) return 0;
      let total = 0; const ks = await caches.keys();
      for (const k of ks) { const c = await caches.open(k); const reqs = await c.keys(); for (const r of reqs.slice(0, 300)) { const res = await c.match(r); const len = res && +res.headers.get("content-length"); if (len) total += len; else if (res) { try { total += (await res.clone().blob()).size; } catch (_) {} } } }
      return total;
    } catch (_) { return 0; }
  }
  function openCleanup() {
    const ref = WM.createWindow({ title: "Disk Cleanup for (C:)", icon: Icon.mini("cleanmgr", "Disk Cleanup"), width: Math.min(470, window.innerWidth - 20), height: Math.min(560, window.innerHeight - 70), appId: "cleanmgr", noMax: true });
    const body = ref.body; body.classList.add("st-host");
    let system = false;
    body.innerHTML = `<div class="st-app st-cl"><div class="st-cl-scan"><span class="st-spin"></span><div><b>Disk Cleanup</b><br>Disk Cleanup is calculating how much space you will be able to free on (C:). This may take a few moments.<div class="st-progress"><i></i></div></div></div></div>`;
    async function scan() {
      const app = body.querySelector(".st-app");
      app.innerHTML = `<div class="st-cl-scan"><span class="st-spin"></span><div><b>Disk Cleanup</b><br>Calculating how much space you can free on (C:)…<div class="st-progress"><i></i></div></div></div>`;
      const cats = cleanupCats(system);
      const cb = await cacheBytes(); const cc = cats.find((c) => c.id === "caches"); cc.bytes = cb; cc.count = cb ? 1 : 0;
      await new Promise((r) => setTimeout(r, 350));
      render(cats);
    }
    function render(cats) {
      const app = body.querySelector(".st-app");
      const total = cats.reduce((s, c) => s + (c.bytes || 0), 0);
      app.innerHTML = `<div class="st-tabs st-cl-tabs"><button class="on">Disk Cleanup</button></div><div class="st-cl-body">
        <div class="st-msg">${Icon.mini("cleanmgr", "")}<div>You can use Disk Cleanup to free up to <b>${fmtBytes(total)}</b> of disk space on (C:).</div></div>
        <div class="st-lbl">Files to delete:</div>
        <div class="st-cl-list st-scroll">${cats.map((c, i) => `<label class="st-cl-row" data-i="${i}"><input type="checkbox" ${c.check && c.bytes ? "checked" : ""} ${c.bytes ? "" : ""}><span class="st-cl-name">${esc(c.name)}</span><span class="st-cl-size">${fmtBytes(c.bytes || 0)}</span></label>`).join("")}</div>
        <div class="st-cl-total">Total amount of disk space you gain: <b class="st-cl-gain"></b></div>
        <fieldset class="st-cl-desc"><legend>Description</legend><div class="st-cl-desctext"></div></fieldset>
        <div class="st-row st-cl-actions"><button class="st-btn st-cl-sys">${svgI("shield", 14)} Clean up system files</button><button class="st-btn st-cl-view">View Files</button></div>
      </div><div class="st-modal-btns"><button class="st-btn st-btn-def st-cl-ok">OK</button><button class="st-btn st-cl-cancel">Cancel</button></div>`;
      const rows = [...app.querySelectorAll(".st-cl-row")];
      let focusI = 0;
      const gain = () => rows.reduce((s, r, i) => s + (r.querySelector("input").checked ? cats[i].bytes || 0 : 0), 0);
      const paintGain = () => { app.querySelector(".st-cl-gain").textContent = fmtBytes(gain()); app.querySelector(".st-cl-desctext").textContent = cats[focusI].desc + (cats[focusI].count ? " (" + cats[focusI].count + " item" + (cats[focusI].count === 1 ? "" : "s") + ")" : " (nothing to clean)"); rows.forEach((r, i) => r.classList.toggle("sel", i === focusI)); };
      rows.forEach((r, i) => { r.addEventListener("click", () => { focusI = i; setTimeout(paintGain, 0); }); r.querySelector("input").onchange = paintGain; });
      paintGain();
      app.querySelector(".st-cl-cancel").onclick = () => ref.close();
      app.querySelector(".st-cl-sys").disabled = system;
      app.querySelector(".st-cl-sys").onclick = () => elevate({ name: "Disk Space Cleanup Manager for Windows", publisher: "Microsoft Windows", iconKey: "cleanmgr" }, () => { system = true; scan(); });
      app.querySelector(".st-cl-view").onclick = () => { const c = cats[focusI]; if (c.id === "bin") WM.open("recyclebin"); else if (c.id === "temp") { window.FilesStartPath = ["Local Disk (C:)", "Windows", "Temp"]; WM.open("fileexplorer"); } else if (c.id === "imagegen") WM.open("imagestudio"); else if (c.id === "wer" || c.id === "logs") WM.open("eventviewer"); else WM.open("diskmgmt"); };
      app.querySelector(".st-cl-ok").onclick = () => {
        const chosen = cats.filter((c, i) => rows[i].querySelector("input").checked);
        if (!chosen.length) { ref.close(); return; }
        const m = modal(body, "Disk Cleanup", `<div class="st-msg">${svgI("q", 32)}<div>Are you sure you want to permanently delete these files?<ul class="st-ul">${chosen.map((c) => `<li>${esc(c.name)} — ${fmtBytes(c.bytes || 0)}</li>`).join("")}</ul></div></div>`, [["Delete Files", "yes", true], ["Cancel", "cancel"]]);
        m.on("yes", async () => {
          m.close();
          app.innerHTML = `<div class="st-cl-scan"><span class="st-spin"></span><div><b>Disk Cleanup</b><br>The Disk Cleanup utility is cleaning up unnecessary files on your machine.<div class="st-progress"><i></i></div><div class="st-dim st-cl-now"></div></div></div>`;
          const beforeLS = lsKeys().total; const est0 = await estimate();
          for (const c of chosen) { app.querySelector(".st-cl-now").textContent = "Cleaning up: " + c.name; try { await c.run(); } catch (_) {} await new Promise((r) => setTimeout(r, 160)); }
          State.save();
          const afterLS = lsKeys().total; const est1 = await estimate();
          const freedLS = Math.max(0, beforeLS - afterLS);
          const freedCache = chosen.some((c) => c.id === "caches") && est0 && est1 ? Math.max(0, est0.usage - est1.usage) : 0;
          const freed = freedLS + freedCache;
          log("Application", "Information", "cleanmgr", 1, "Disk Cleanup freed " + fmtBytes(freed) + " (" + freed + " bytes) on (C:). Cleaned: " + chosen.map((c) => c.name).join(", ") + ".");
          app.innerHTML = `<div class="st-cl-done"><div class="st-msg">${Icon.mini("cleanmgr", "")}<div><b>Disk Cleanup finished</b><br>Disk Cleanup freed <b class="st-freed">${fmtBytes(freed)}</b> on (C:).<br><span class="st-dim">localStorage: ${fmtBytes(beforeLS)} → ${fmtBytes(afterLS)}${freedCache ? " · Cache Storage: " + fmtBytes(freedCache) : ""}</span></div></div></div><div class="st-modal-btns"><button class="st-btn st-cl-again">Scan again</button><button class="st-btn st-btn-def st-cl-close">Close</button></div>`;
          app.querySelector(".st-cl-close").onclick = () => ref.close();
          app.querySelector(".st-cl-again").onclick = scan;
          note("Disk Cleanup", "Freed " + fmtBytes(freed) + " on (C:).", "cleanmgr");
        });
      };
    }
    setTimeout(scan, 200);
    return ref;
  }
  AR.cleanmgr = openCleanup;

  // =====================================================================
  //  RUN dialog (overrides the one in js/tools.js)
  // =====================================================================
  const SET_URI = { display: "display", "personalization-background": "background", personalization: "personal", "personalization-colors": "personal", colors: "personal", themes: "personal", network: "network", "network-wifi": "wifinets", "network-status": "network", bluetooth: "devices", connecteddevices: "devices", "mousetouchpad": "mouse", about: "about", dateandtime: "datetime", regionformatting: "language", "regionlanguage": "language", windowsupdate: "update", "windowsupdate-history": "uphistory", appsfeatures: "installed", "apps-features": "installed", apps: "apps", privacy: "privacy", easeofaccess: "access", accessibility: "access", yourinfo: "yourinfo", signinoptions: "signin", sound: "sound", notifications: "notifications", storagesense: "su-storagesense", storagepolicies: "su-storagesense", "storage-categories": "su-storagecats", fonts: "su-fonts", "cortana-windowssearch": "su-searching", "search-permissions": "su-searching", powersleep: "power", batterysaver: "power", gaming: "gaming", "gaming-gamebar": "gaming", accounts: "accounts", emailandaccounts: "email", recovery: "recovery", troubleshoot: "troubleshoot", activation: "activation", backup: "devicesync", multitasking: "multitask", system: "system", "": "system" };
  const RUN = {
    calc: "calculator", calculator: "calculator", notepad: "notepad", write: "word", wordpad: "word", cmd: "terminal", command: "terminal", terminal: "terminal", wt: "terminal", powershell: "powershell", pwsh: "powershell", "powershell_ise": "powershell",
    regedit: "regedit", regedt32: "regedit", control: "controlpanel", "control panel": "controlpanel", devmgmt: "devicemanager", "devmgmt.msc": "devicemanager", "hdwwiz.cpl": "devicemanager", eventvwr: "eventviewer", "eventvwr.msc": "eventviewer",
    "diskmgmt.msc": "diskmgmt", diskmgmt: "diskmgmt", "taskschd.msc": "taskschd", taskschd: "taskschd", "task scheduler": "taskschd", "control schedtasks": "taskschd", "srchadmin.dll": "cp:indexing", "rundll32.exe shell32.dll,control_rundll srchadmin.dll": "cp:indexing", "control /name microsoft.indexingoptions": "cp:indexing", cleanmgr: "cleanmgr", taskmgr: "taskmanager", "task manager": "taskmanager", explorer: "fileexplorer", mspaint: "paint", paint: "paint", winver: "winver", msinfo32: "msinfo32",
    "compmgmt.msc": "cp:admintools", "control admintools": "cp:admintools", "appwiz.cpl": "cp:programs", "control appwiz.cpl": "cp:programs", "ncpa.cpl": "cp:network", "sysdm.cpl": "cp:system", "timedate.cpl": "cp:datetime", "intl.cpl": "cp:region", "desk.cpl": "cp:personalization", "control desktop": "cp:personalization", "control color": "cp:personalization",
    "firewall.cpl": "cp:firewall", "wf.msc": "cp:firewall", "control printers": "cp:devices", "control userpasswords": "cp:users", "control userpasswords2": "cp:users", netplwiz: "cp:users", "access.cpl": "cp:ease", "utilman": "cp:ease", "control fonts": "cp:fonts", fonts: "cp:fonts", "powercfg.cpl": "cp:power", "main.cpl": "set:mouse", "mmsys.cpl": "set:sound", "inetcpl.cpl": "edge",
    useraccountcontrolsettings: "act:uac", osk: "act:osk", narrator: "act:narrator", "shutdown": "act:shutdown", logoff: "act:lock", "rundll32.exe user32.dll,lockworkstation": "act:lock",
    msedge: "edge", edge: "edge", chrome: "chrome", iexplore: "edge", winword: "word", excel: "excel", powerpnt: "powerpoint", outlook: "outlook", onenote: "onenote", snippingtool: "snip", "ms-windows-store:": "store__", store: "store__", copilot: "copilot", "ms-settings:": "set:system", settings: "settings", calendar: "calendar",
    "%temp%": "dir:C:\\Windows\\Temp", temp: "dir:C:\\Windows\\Temp", "%windir%": "dir:C:\\Windows", "%systemroot%": "dir:C:\\Windows", "%userprofile%": "dir:~", "~": "dir:~", ".": "dir:~", "%appdata%": "dir:~", "shell:desktop": "dir:Desktop", "shell:downloads": "dir:Downloads", "shell:documents": "dir:Documents", "shell:recyclebinfolder": "recyclebin", "shell:appsfolder": "act:start",
  };
  function runHistory() { const a = S().appData; if (!Array.isArray(a.runMRU)) a.runMRU = []; return a.runMRU; }
  function pushHistory(cmd) { const h = runHistory(); const i = h.findIndex((x) => x.toLowerCase() === cmd.toLowerCase()); if (i >= 0) h.splice(i, 1); h.unshift(cmd); if (h.length > 26) h.length = 26; State.save(); }
  // Resolve a Windows-ish path to File Explorer's path array (or null).
  function resolvePath(raw) {
    let p = raw.trim().replace(/^"|"$/g, "").replace(/\//g, "\\");
    const root = S().appData.files && S().appData.files.root; if (!root) return null;
    const user = userName();
    p = p.replace(/%userprofile%|%homepath%/ig, "C:\\Users\\" + user).replace(/%windir%|%systemroot%/ig, "C:\\Windows").replace(/%temp%|%tmp%/ig, "C:\\Windows\\Temp").replace(/%programfiles%/ig, "C:\\Program Files");
    if (p === "~" || p === "%userprofile%") return { path: [] , quick: true };
    let segs;
    const userRe = new RegExp("^c:\\\\users\\\\(" + user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "|you)(\\\\|$)", "i");
    if (/^c:\\?$/i.test(p)) segs = ["Local Disk (C:)"];
    else if (userRe.test(p)) { const rest = p.replace(userRe, ""); segs = rest ? rest.split("\\").filter(Boolean) : []; if (!segs.length) return { path: [], quick: true }; }
    else if (/^c:\\/i.test(p)) segs = ["Local Disk (C:)"].concat(p.slice(3).split("\\").filter(Boolean));
    else if (/^(desktop|documents|downloads|pictures|music|videos|onedrive)(\\|$)/i.test(p)) segs = p.split("\\").filter(Boolean);
    else return null;
    // Case-insensitive walk
    let kids = root; const out = [];
    for (let i = 0; i < segs.length; i++) {
      const name = Object.keys(kids || {}).find((k) => k.toLowerCase() === segs[i].toLowerCase());
      if (!name) return { missing: true };
      const n = kids[name]; out.push(name);
      if (n.type === "file") return i === segs.length - 1 ? { file: n, name } : { missing: true };
      kids = n.children;
    }
    return { path: out };
  }
  function runCommand(raw, opts) {
    const cmd = String(raw || "").trim(); if (!cmd) return { ok: false };
    const lc = cmd.toLowerCase().replace(/\s+/g, " ");
    const key = lc.replace(/\.exe$/, "");
    const doTarget = (t) => {
      if (t.startsWith("cp:")) { openControlPanel(t.slice(3)); return true; }
      if (t.startsWith("set:")) { openSettings(t.slice(4)); return true; }
      if (t.startsWith("dir:")) { const r = resolvePath(t.slice(4) === "~" ? "%userprofile%" : t.slice(4)); window.FilesStartPath = r && r.path && r.path.length ? r.path : r && r.quick ? "quick" : null; WM.open("fileexplorer"); return true; }
      if (t.startsWith("act:")) {
        const a = t.slice(4);
        if (a === "uac") uacDialog(document.querySelector("#screen") || document.body);
        else if (a === "osk") { const pf = (S().appData.settings12 = S().appData.settings12 || {}); pf.osk = true; State.save(); if (window.OSK) OSK.show(); }
        else if (a === "narrator") { if (window.Narrator) Narrator.start(); else try { speechSynthesis.speak(new SpeechSynthesisUtterance("Narrator is on.")); } catch (_) {} }
        else if (a === "lock") { if (window.Lock) Lock.run(() => {}); }
        else if (a === "shutdown") { location.reload(); }
        else if (a === "start") { const b = document.querySelector(".start-btn, .tb-start, [data-open='start']"); if (b) b.click(); }
        return true;
      }
      WM.open(t); return true;
    };
    // ms-settings:<page>
    let m;
    if ((m = lc.match(/^ms-settings:([a-z-]*)/))) { let pg = SET_URI[m[1]]; if (pg && /^su-/.test(pg) && !(window.SettingsSubs && window.SettingsSubs[pg])) pg = pg === "su-fonts" ? "personal" : pg === "su-searching" ? "privacy" : "storage"; openSettings(pg || "system"); return { ok: true }; }
    if ((m = lc.match(/^control(?:\.exe)? \/name microsoft\.(\w+)/))) { const map = { programsandfeatures: "programs", system: "system", devicemanager: "dev", networkandsharingcenter: "network", personalization: "personalization", dateandtime: "datetime", regionandlanguage: "region", easeofaccesscenter: "ease", useraccounts: "users", windowsfirewall: "firewall", administrativetools: "admintools", devicesandprinters: "devices", fonts: "fonts", poweroptions: "power", bitlockerdriveencryption: "bitlocker", indexingoptions: "indexing" }; const pg = map[m[1]]; if (pg === "dev") WM.open("devicemanager"); else openControlPanel(pg || "home"); return { ok: true }; }
    const elevated = opts && opts.admin;
    const go = (fn) => { if (elevated) elevate({ name: cmd, publisher: "Microsoft Windows", iconKey: "run" }, fn); else fn(); };
    if (RUN[key]) { go(() => doTarget(RUN[key])); return { ok: true }; }
    // "explorer <path>" / "start <path|url>"
    if ((m = cmd.match(/^(?:explorer(?:\.exe)?|start)\s+(.+)$/i))) return runCommand(m[1], opts);
    // URLs
    if (/^(https?:\/\/|www\.)/i.test(cmd) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|org|net|edu|gov|io|dev|app|ai|co|uk|se|de|fr|tv|me|info|us)(\/.*)?$/i.test(cmd)) {
      if (window.Browser) Browser.openTo(cmd.replace(/^https?:\/\//i, "")); else WM.open("edge"); return { ok: true };
    }
    // paths
    const r = resolvePath(cmd);
    if (r && r.file) { if (window.VFS) VFS.openNode(r.name, r.file); return { ok: true }; }
    if (r && (r.path || r.quick)) { window.FilesStartPath = r.quick ? "quick" : r.path; WM.open("fileexplorer"); return { ok: true }; }
    // app ids and names from the catalog / registry
    const app = Catalog.storeApps.find((a) => !a.decorative && (a.id.toLowerCase() === key || a.name.toLowerCase() === lc || (a.builtin && a.builtin.toLowerCase() === key)));
    if (app && (isInstalled(app.id) || AR[app.builtin || app.id])) { go(() => WM.open(app.id)); return { ok: true }; }
    if (AR[key] && typeof AR[key] === "function") { go(() => WM.open(key)); return { ok: true }; }
    return { ok: false, notFound: true };
  }
  window.SysRun = runCommand;

  AR.run = function () {
    const existing = [...document.querySelectorAll(".st-run")].find((x) => x.isConnected);
    if (existing) { const w = existing.closest(".win"); if (w) { w.style.display = ""; w.dispatchEvent(new Event("mousedown")); const i = w.querySelector(".st-run-in"); if (i) setTimeout(() => i.focus(), 30); return; } }
    const vw = window.innerWidth, vh = window.innerHeight;
    const ref = WM.createWindow({ title: "Run", icon: Icon.mini("run", "Run"), width: Math.min(420, vw - 20), height: 236, appId: "run", noMax: true, left: 12, top: Math.max(10, vh - 236 - 70) });
    const body = ref.body; body.classList.add("st-host");
    body.innerHTML = `<div class="st-app st-run">
      <div class="st-run-top"><img class="st-run-ic" src="assets/run.png?v=15" alt=""><p>Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.</p></div>
      <div class="st-run-field"><label for="">Open:</label><div class="st-combo"><input class="st-run-in st-input" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Open"><button class="st-combo-btn" title="History" tabindex="-1">▾</button><div class="st-combo-list" hidden></div></div></div>
      <div class="st-run-admin st-dim">${svgI("shield", 14)} Ctrl+Shift+Enter runs it with administrative privileges.</div>
      <div class="st-modal-btns"><button class="st-btn st-btn-def st-run-ok">OK</button><button class="st-btn st-run-cancel">Cancel</button><button class="st-btn st-run-browse">Browse…</button></div>
    </div>`;
    const input = body.querySelector(".st-run-in"), list = body.querySelector(".st-combo-list"), okB = body.querySelector(".st-run-ok");
    const h = runHistory(); input.value = h[0] || ""; okB.disabled = !input.value.trim();
    setTimeout(() => { input.focus(); input.select(); }, 60);
    let li = -1;
    function showList(filter) {
      const f = (filter || "").toLowerCase();
      const items = runHistory().filter((x) => !f || x.toLowerCase().startsWith(f));
      if (!items.length) { list.hidden = true; return; }
      list.innerHTML = items.map((x, i) => `<button class="st-combo-it ${i === li ? "sel" : ""}" data-v="${esc(x)}">${esc(x)}</button>`).join("");
      list.querySelectorAll(".st-combo-it").forEach((b) => b.onpointerdown = (e) => { e.preventDefault(); input.value = b.dataset.v; list.hidden = true; okB.disabled = false; input.focus(); });
      list.hidden = false;
    }
    body.querySelector(".st-combo-btn").onpointerdown = (e) => e.preventDefault();   // keep focus in the box
    body.querySelector(".st-combo-btn").onmousedown = (e) => e.preventDefault();
    body.querySelector(".st-combo-btn").onclick = () => { if (list.hidden) { li = -1; showList(""); } else list.hidden = true; input.focus(); };
    input.addEventListener("input", () => { okB.disabled = !input.value.trim(); li = -1; if (input.value) showList(input.value); else list.hidden = true; });
    input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 150));
    function go(admin) {
      const v = input.value.trim(); if (!v) return;
      const r = runCommand(v, { admin });
      if (r.ok) { pushHistory(v); ref.close(); return; }
      const m = modal(body, v, `<div class="st-msg">${svgI("err", 32)}<div>Windows cannot find '${esc(v)}'. Make sure you typed the name correctly, and then try again.</div></div>`, [["OK", "cancel", true]]);
      void m;
    }
    okB.onclick = () => go(false);
    body.querySelector(".st-run-cancel").onclick = () => ref.close();
    body.querySelector(".st-run-browse").onclick = () => { window.FilesStartPath = ["Local Disk (C:)", "Windows", "System32"]; WM.open("fileexplorer"); };
    input.addEventListener("keydown", (e) => {
      const items = list.hidden ? [] : [...list.querySelectorAll(".st-combo-it")];
      if (e.key === "Enter") { e.preventDefault(); if (items[li]) { input.value = items[li].dataset.v; list.hidden = true; } go(e.ctrlKey && e.shiftKey); }
      else if (e.key === "Escape") { e.preventDefault(); if (!list.hidden) list.hidden = true; else ref.close(); }
      else if (e.key === "ArrowDown" || (e.key === "ArrowDown" && e.altKey)) { e.preventDefault(); if (list.hidden) { li = -1; showList(""); } const n = list.querySelectorAll(".st-combo-it").length; li = Math.min(n - 1, li + 1); list.querySelectorAll(".st-combo-it").forEach((b, i) => b.classList.toggle("sel", i === li)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); li = Math.max(0, li - 1); list.querySelectorAll(".st-combo-it").forEach((b, i) => b.classList.toggle("sel", i === li)); }
    });
    return ref;
  };

  // Storage Sense, Task Scheduler, BitLocker, power plans, Fonts and Search indexing live in js/sysutil2.js
  // (+ css/sysutil2.css). index.html may list it; otherwise it's loaded from here once.
  (function loadSysUtil2() {
    const go = () => {
      if (window.SysUtil2 || document.querySelector('script[src*="js/sysutil2.js"]')) return;
      let v = ""; try { const me = document.querySelector('script[src*="js/systools.js"]'); const m = me && me.src.match(/[?&]v=([^&#]+)/); v = m ? "?v=" + m[1] : ""; } catch (_) {}
      const sc = document.createElement("script"); sc.src = "js/sysutil2.js" + v; sc.async = false; document.head.appendChild(sc);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else setTimeout(go, 0);
  })();

  // Ctrl+Alt+R opens Run (Win+R is handled by js/tools.js and calls AppRegistry.run, which is this one).
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey && e.altKey && !e.metaKey && (e.key === "r" || e.key === "R" || e.code === "KeyR"))) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return; // never steal keys while typing
    if (!document.querySelector(".desktop") || document.querySelector(".lock-screen, .boot-layer, .uac-mask")) return;
    e.preventDefault(); AR.run();
  });
})();
