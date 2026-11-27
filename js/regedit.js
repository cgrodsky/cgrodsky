/* Registry Editor (regedit). A classic tree of the five hives with Name/Type/Data columns.
   Many keys are MAPPED to this desktop's real settings — editing them changes the app:
     HKCU\Control Panel\Desktop\Wallpaper                         ↔ desktop wallpaper
     HKCU\Control Panel\Colors\Background / Hilight               ↔ solid wallpaper color / accent
     HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize\AppsUseLightTheme ↔ light/dark
     HKCU\Software\Microsoft\Accessibility\TextScaleFactor (+ Control Panel\Accessibility) ↔ text size
     HKLM\SYSTEM\CurrentControlSet\Control\ComputerName\ComputerName ↔ device name
     HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\<app> ↔ installed apps (delete = uninstall)
     …and more (see the M_* values below). Keys and values you create are saved in
   State.data.appData.registry. */
(function () {
  "use strict";
  const S = () => State.data;
  const U = window.STUI, T = window.SysTools;
  const esc = U.esc, el = U.el, svgI = U.svgI, modal = U.modal, menus = U.menus;
  const log = (...a) => { if (window.EventLog) EventLog.add(...a); };

  // ---------------- persistent store for keys/values the user creates ----------------
  function store() {
    const a = S().appData; const r = a.registry || (a.registry = {});
    r.keys = r.keys || {}; r.over = r.over || {}; r.delv = r.delv || {};
    return r;
  }
  const lc = (s) => String(s).toLowerCase();
  const HIVES = ["HKEY_CLASSES_ROOT", "HKEY_CURRENT_USER", "HKEY_LOCAL_MACHINE", "HKEY_USERS", "HKEY_CURRENT_CONFIG"];
  const ABBR = { HKCR: "HKEY_CLASSES_ROOT", HKCU: "HKEY_CURRENT_USER", HKLM: "HKEY_LOCAL_MACHINE", HKU: "HKEY_USERS", HKCC: "HKEY_CURRENT_CONFIG" };
  const SID = "S-1-5-21-3623811015-3361044348-30300820-1001";
  const ERR_WRITE = (n) => "Cannot edit " + (n || "(Default)") + ": Error writing the value's new contents.";

  // ---------------- value constructors ----------------
  // static value (editable; edits persist as overrides)
  const sz = (name, data) => ({ name, type: "REG_SZ", data });
  const esz = (name, data) => ({ name, type: "REG_EXPAND_SZ", data });
  const dw = (name, data) => ({ name, type: "REG_DWORD", data });
  const qw = (name, data) => ({ name, type: "REG_QWORD", data });
  const bin = (name, data) => ({ name, type: "REG_BINARY", data });
  const msz = (name, data) => ({ name, type: "REG_MULTI_SZ", data });
  // mapped value: get() reads the real setting, set(v) applies it (return a string = error)
  const M = (name, type, get, set, del) => ({ name, type, get, set, del, mapped: true });
  // read-only real value (hardware etc.)
  const R = (name, type, get) => ({ name, type, get, ro: true, mapped: true });
  // key: K(name, kids[], vals[], opts)
  const K = (name, kids, vals, opts) => Object.assign({ name, kids: kids || [], vals: vals || [] }, opts || {});

  // ---------------- helpers mapping to real settings ----------------
  const hex2rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "").trim()); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (r, g, b) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, x | 0)).toString(16).padStart(2, "0")).join("");
  const parseRGB = (s) => { const p = String(s).trim().split(/[\s,]+/).map((x) => parseInt(x, 10)); return p.length === 3 && p.every((x) => !isNaN(x) && x >= 0 && x <= 255) ? p : null; };
  const userName = () => T.userName();
  const WALL_DIR = "C:\\Windows\\Web\\Wallpaper\\Windows\\";
  function wallGet() {
    const w = (S().desktop && S().desktop.wallpaper) || "default";
    if (w === "default") return WALL_DIR + "img0.jpg";
    if (w.startsWith("assets/")) return WALL_DIR + w.split("/").pop();
    if (w.startsWith("data:")) return "C:\\Users\\" + userName() + "\\AppData\\Roaming\\Microsoft\\Windows\\Themes\\TranscodedWallpaper";
    if (/^https?:/i.test(w)) return w;
    return ""; // solid color: Windows keeps the wallpaper empty and uses Colors\Background
  }
  function wallSet(v) {
    v = String(v || "").trim(); const cur = S().desktop.wallpaper || "default";
    let m;
    if (!v) { const c = cur.startsWith("#") ? cur : "#000000"; T.setWallpaper(c); return; }
    if (/(^|\\)img0\.jpg$/i.test(v) || /^default$/i.test(v)) { T.setWallpaper("default"); return; }
    if ((m = v.match(/(wall\d+\.jpg|xp_wallpaper\.png)$/i))) { T.setWallpaper("assets/" + m[1].toLowerCase()); return; }
    if (/TranscodedWallpaper$/i.test(v)) { if (cur.startsWith("data:")) return; return "The file " + v + " doesn't exist. Choose a photo in Settings first."; }
    if (/^#[0-9a-f]{6}$/i.test(v)) { T.setWallpaper(v.toLowerCase()); return; }
    if (/^https:\/\/\S+$/i.test(v)) { T.setWallpaper(v); return; }
    return "Windows can't find the picture '" + v + "'. Use " + WALL_DIR + "img0.jpg or wall2.jpg … wall6.jpg, a color like #0067c0, or an https:// image URL.";
  }
  const mouse = () => (S().appData.mouse = S().appData.mouse || { speed: 6, primary: "left", scroll: 3 });
  const fw = () => (S().appData.firewall = S().appData.firewall || { private: true, public: true, notify: true });
  const fxApply = () => { if (window.applyUiFx) applyUiFx(); };
  const qs = () => T.qs();
  const toNum = (v) => { const n = typeof v === "number" ? v : parseInt(v, 10); return isNaN(n) ? null : n; };
  const accentDword = () => { const c = hex2rgb(S().accent || "#0067c0") || [0, 103, 192]; return ((0xff << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; };
  const uacToConsent = (l) => [0, 5, 5, 2][l];
  const browser = () => { const ua = navigator.userAgent || ""; return /iPad|Macintosh.*Mobile|Mac OS X/.test(ua) && navigator.maxTouchPoints > 1 ? "ARM64" : /arm|aarch64/i.test(ua) ? "ARM64" : "AMD64"; };

  // ---------------- the tree ----------------
  function hkcu() {
    const pf = () => (S().appData.settings12 = S().appData.settings12 || {});
    const fx = T.fx;
    return [
      K("AppEvents", [K("EventLabels"), K("Schemes", [K("Apps", [K(".Default")])])]),
      K("Console", [], [sz("FaceName", "Consolas"), dw("FontSize", 0x100000), dw("QuickEdit", 1), dw("WindowAlpha", 255)]),
      K("Control Panel", [
        K("Accessibility", [
          K("HighContrast", [], [M("Flags", "REG_SZ", () => ((S().appData.a11y && S().appData.a11y.on) ? "127" : "126"), (v) => { const n = toNum(v); if (n == null) return ERR_WRITE("Flags"); const a = T.a11y(); a.on = !!(n & 1); a.contrast = a.bigText = a.reduceMotion = true; State.save(); if (window.applyTheme) applyTheme(); }), sz("High Contrast Scheme", "")]),
          K("Keyboard Response", [], [sz("Flags", "126")]),
          K("StickyKeys", [], [sz("Flags", "510")]),
        ], [M("TextScaleFactor", "REG_DWORD", () => S().textScale || 100, (v) => { const n = toNum(v); if (n == null || n < 80 || n > 225) return "TextScaleFactor must be between 80 and 225 (percent)."; T.setTextScale(n); }), dw("MinimumHitRadius", 0)]),
        K("Colors", [], [
          M("Background", "REG_SZ", () => { const w = S().desktop.wallpaper || ""; const c = w.startsWith("#") ? hex2rgb(w) : null; return c ? c.join(" ") : "0 0 0"; }, (v) => { const p = parseRGB(v); if (!p) return "Background must be three numbers 0-255, like \"0 120 215\"."; T.setWallpaper(rgb2hex(...p)); }),
          M("Hilight", "REG_SZ", () => (hex2rgb(S().accent || "#0067c0") || [0, 103, 192]).join(" "), (v) => { const p = parseRGB(v); if (!p) return "Hilight must be three numbers 0-255, like \"0 120 215\"."; T.setAccent(rgb2hex(...p)); }),
          sz("Window", "255 255 255"), sz("WindowText", "0 0 0"), sz("ButtonFace", "240 240 240"), sz("GrayText", "109 109 109"),
        ]),
        K("Cursors", [], [sz("", "Windows Default"), dw("CursorBaseSize", 32)]),
        K("Desktop", [K("WindowMetrics", [], [R("AppliedDPI", "REG_DWORD", () => Math.round(96 * (window.devicePixelRatio || 1))), sz("BorderWidth", "-15"), sz("CaptionHeight", "-330")])], [
          M("Wallpaper", "REG_SZ", wallGet, wallSet),
          sz("WallpaperStyle", "10"), sz("TileWallpaper", "0"),
          M("WheelScrollLines", "REG_SZ", () => String(mouse().scroll || 3), (v) => { const n = toNum(v); if (n == null || n < 1 || n > 100) return "WheelScrollLines must be a number from 1 to 100."; mouse().scroll = Math.min(10, n); State.save(); }),
          sz("MenuShowDelay", "400"), sz("FontSmoothing", "2"), sz("CursorBlinkRate", "530"),
          R("LogPixels", "REG_DWORD", () => Math.round(96 * (window.devicePixelRatio || 1))),
        ]),
        K("International", [K("Geo", [], [sz("Name", "US"), sz("Nation", "244")]), K("User Profile", [], [msz("Languages", [navigator.language || "en-US"])])], [
          R("LocaleName", "REG_SZ", () => navigator.language || "en-US"),
          M("sCountry", "REG_SZ", () => S().region || "United States", (v) => { v = String(v).trim(); if (!v) return ERR_WRITE("sCountry"); S().region = v; State.save(); }),
          M("iTime", "REG_SZ", () => (S().clock.format24 ? "1" : "0"), (v) => { S().clock.format24 = String(v).trim() === "1"; State.save(); }),
          M("sShortTime", "REG_SZ", () => (S().clock.format24 ? "HH:mm" : "h:mm tt"), (v) => { S().clock.format24 = /H/.test(String(v)); State.save(); }),
          sz("sShortDate", "M/d/yyyy"), sz("sLongDate", "dddd, MMMM d, yyyy"), sz("sDecimal", "."), sz("sThousand", ","), sz("sCurrency", "$"),
        ]),
        K("Keyboard", [], [sz("KeyboardDelay", "1"), sz("KeyboardSpeed", "31")]),
        K("Mouse", [], [
          M("MouseSensitivity", "REG_SZ", () => String(Math.max(1, Math.min(20, mouse().speed * 2 - 2))), (v) => { const n = toNum(v); if (n == null || n < 1 || n > 20) return "MouseSensitivity must be a number from 1 to 20."; mouse().speed = Math.max(1, Math.min(11, Math.round((n + 2) / 2))); State.save(); }),
          M("SwapMouseButtons", "REG_SZ", () => (mouse().primary === "right" ? "1" : "0"), (v) => { mouse().primary = String(v).trim() === "1" ? "right" : "left"; State.save(); }),
          sz("DoubleClickSpeed", "500"), sz("MouseSpeed", "1"),
        ]),
        K("Personalization", [K("Desktop Slideshow", [], [dw("Interval", 1800000)])]),
        K("Sound", [], [sz("Beep", "yes")]),
      ]),
      K("Environment", [], [esz("Path", "%USERPROFILE%\\AppData\\Local\\Microsoft\\WindowsApps;"), esz("TEMP", "%USERPROFILE%\\AppData\\Local\\Temp"), esz("TMP", "%USERPROFILE%\\AppData\\Local\\Temp")]),
      K("Keyboard Layout", [K("Preload", [], [sz("1", "00000409")]), K("Substitutes"), K("Toggle")]),
      K("Network"),
      K("Printers", [K("Connections"), K("Settings")], [sz("DeviceOld", "Microsoft Print to PDF,winspool,Ne01:")]),
      K("Software", [
        K("Cameron Systems", [K("Windows 12", [], [
          M("KioskMode", "REG_DWORD", () => (S().appData.kiosk ? 1 : 0), (v) => { if (window.setKiosk) setKiosk(!!toNum(v)); }),
          M("NightLight", "REG_DWORD", () => (qs().night ? 1 : 0), (v) => { qs().night = !!toNum(v); State.save(); if (window.applyDisplayFx) applyDisplayFx(); }),
          M("Brightness", "REG_DWORD", () => qs().brightness || 90, (v) => { const n = toNum(v); if (n == null || n < 10 || n > 100) return "Brightness must be 10-100."; qs().brightness = n; State.save(); if (window.applyDisplayFx) applyDisplayFx(); }),
          M("Volume", "REG_DWORD", () => qs().volume == null ? 55 : qs().volume, (v) => { const n = toNum(v); if (n == null || n < 0 || n > 100) return "Volume must be 0-100."; qs().volume = n; State.save(); }),
          M("XPTheme", "REG_DWORD", () => (S().desktop.xpTheme ? 1 : 0), (v) => { const on = !!toNum(v); S().desktop.xpTheme = on; S().desktop.wallpaper = on ? "assets/xp_wallpaper.png" : "default"; document.body.classList.toggle("xp-theme", on); State.save(); T.safeWall(); }),
          M("RoundedCorners", "REG_DWORD", () => (fx().round ? 1 : 0), (v) => { fx().round = !!toNum(v); State.save(); fxApply(); }),
          M("WindowShadows", "REG_DWORD", () => (fx().shadow ? 1 : 0), (v) => { fx().shadow = !!toNum(v); State.save(); fxApply(); }),
          R("Edition", "REG_SZ", () => (S().hasProductKey ? "Windows 12 Pro" : "Windows 12 Home")),
        ])]),
        K("Classes", [K(".txt"), K("Local Settings")]),
        K("Microsoft", [
          K("Accessibility", [], [M("TextScaleFactor", "REG_DWORD", () => S().textScale || 100, (v) => { const n = toNum(v); if (n == null || n < 80 || n > 225) return "TextScaleFactor must be between 80 and 225 (percent)."; T.setTextScale(n); })]),
          K("Clipboard", [], [dw("EnableClipboardHistory", 1)]),
          K("Edge", [K("Profiles")]),
          K("Office", [K("16.0", [K("Common"), K("Word"), K("Excel"), K("PowerPoint")])]),
          K("OneDrive", [], [sz("Version", "24.201.1006.0005")]),
          K("Windows", [
            K("CurrentVersion", [
              K("Applets", [K("Regedit", [K("Favorites")], [M("LastKey", "REG_SZ", () => "Computer\\" + (store().last || "HKEY_CURRENT_USER"), (v) => { store().last = String(v).replace(/^Computer\\/i, ""); State.save(); })])]),
              K("Explorer", [
                K("Advanced", [], [
                  M("TaskbarAnimations", "REG_DWORD", () => (fx().anim ? 1 : 0), (v) => { fx().anim = !!toNum(v); State.save(); fxApply(); }),
                  M("ListviewShadow", "REG_DWORD", () => (fx().shadow ? 1 : 0), (v) => { fx().shadow = !!toNum(v); State.save(); fxApply(); }),
                  dw("Hidden", 2), dw("HideFileExt", 1), dw("ShowSuperHidden", 0), dw("TaskbarAl", 1), dw("TaskbarSmallIcons", 0), dw("LaunchTo", 1), dw("Start_TrackProgs", 1),
                ]),
                K("HideDesktopIcons", [K("NewStartPanel", [], () => (S().desktop.hiddenIcons || []).map((id) => M(id, "REG_DWORD", () => 1, (v) => { if (!toNum(v)) unhide(id); }, () => unhide(id))), { onNewValue: (name, type, data) => { if (type !== "REG_DWORD") return false; if (toNum(data)) hide(name); return true; } })]),
                K("RunMRU", [], () => { const h = (S().appData.runMRU || []).slice(0, 26); const letters = "abcdefghijklmnopqrstuvwxyz"; return h.map((cmd, i) => M(letters[i], "REG_SZ", () => cmd + "\\1", null, () => { const a = S().appData.runMRU; const j = a.indexOf(cmd); if (j >= 0) a.splice(j, 1); State.save(); })).concat(h.length ? [R("MRUList", "REG_SZ", () => letters.slice(0, h.length))] : []); }),
                K("Shell Folders", [], ["Desktop", "Documents", "Downloads", "Music", "Pictures", "Videos"].map((f) => sz(f === "Documents" ? "Personal" : f === "Pictures" ? "My Pictures" : f === "Music" ? "My Music" : f === "Videos" ? "My Video" : f === "Downloads" ? "{374DE290-123F-4565-9164-39C4925E467B}" : f, "C:\\Users\\" + userName() + "\\" + f))),
                K("User Shell Folders"),
                K("RecentDocs"),
              ]),
              K("Themes", [K("Personalize", [], [
                M("AppsUseLightTheme", "REG_DWORD", () => (T.resolveTheme() === "light" ? 1 : 0), (v) => { const n = toNum(v); if (n == null) return ERR_WRITE("AppsUseLightTheme"); T.setTheme(n ? "light" : "dark"); }),
                M("SystemUsesLightTheme", "REG_DWORD", () => (T.resolveTheme() === "light" ? 1 : 0), (v) => { const n = toNum(v); if (n == null) return ERR_WRITE("SystemUsesLightTheme"); T.setTheme(n ? "light" : "dark"); }),
                M("EnableTransparency", "REG_DWORD", () => (fx().blur ? 1 : 0), (v) => { fx().blur = !!toNum(v); State.save(); fxApply(); }),
                dw("ColorPrevalence", 0),
              ])], [R("CurrentTheme", "REG_SZ", () => "C:\\Windows\\Resources\\Themes\\" + (S().desktop.xpTheme ? "luna.theme" : T.resolveTheme() === "dark" ? "dark.theme" : "aero.theme"))]),
              K("Notifications", [K("Settings", [], [M("NOC_GLOBAL_SETTING_TOASTS_ENABLED", "REG_DWORD", () => (qs().focus ? 0 : 1), (v) => { qs().focus = !toNum(v); State.save(); })])]),
              K("Run", [], [sz("OneDrive", "\"C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe\" /background")]),
              K("Search", [], [dw("SearchboxTaskbarMode", 1), dw("BingSearchEnabled", 1)]),
              K("Uninstall"),
            ]),
            K("DWM", [], [
              M("AccentColor", "REG_DWORD", accentDword, (v) => { const n = toNum(v); if (n == null) return ERR_WRITE("AccentColor"); T.setAccent(rgb2hex(n & 255, (n >>> 8) & 255, (n >>> 16) & 255)); }),
              M("ColorizationColor", "REG_DWORD", () => { const c = hex2rgb(S().accent || "#0067c0"); return ((0xc4 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]) >>> 0; }, (v) => { const n = toNum(v); if (n == null) return ERR_WRITE("ColorizationColor"); T.setAccent(rgb2hex((n >>> 16) & 255, (n >>> 8) & 255, n & 255)); }),
              dw("EnableAeroPeek", 1), dw("ColorPrevalence", 0),
            ]),
          ]),
          K("Windows NT", [K("CurrentVersion", [K("Winlogon"), K("Windows")])]),
        ]),
        K("Policies", [K("Microsoft", [K("Windows")])]),
      ]),
      K("System", [K("GameConfigStore", [], [M("GameDVR_Enabled", "REG_DWORD", () => (pf().gameBar === false ? 0 : 1), (v) => { pf().gameBar = !!toNum(v); State.save(); })])]),
      K("Volatile Environment", [], [R("USERNAME", "REG_SZ", userName), R("USERPROFILE", "REG_SZ", () => "C:\\Users\\" + userName()), R("HOMEDRIVE", "REG_SZ", () => "C:"), R("LOGONSERVER", "REG_SZ", () => "\\\\" + T.deviceName()), R("USERDOMAIN", "REG_SZ", () => T.deviceName())]),
    ];
  }
  function hide(id) { const d = S().desktop; d.hiddenIcons = d.hiddenIcons || []; if (!d.hiddenIcons.includes(id)) d.hiddenIcons.push(id); State.save(); if (WM.refreshDesktopIcons) WM.refreshDesktopIcons(); }
  function unhide(id) { const d = S().desktop; const h = d.hiddenIcons || []; const i = h.indexOf(id); if (i >= 0) h.splice(i, 1); d.bin = (d.bin || []).filter((b) => b.id !== id); State.save(); if (WM.refreshDesktopIcons) WM.refreshDesktopIcons(); }

  function uninstallKeys() {
    return T.installedList().map((a) => K(a.id, [], [
      sz("DisplayName", a.name), sz("Publisher", T.publisher(a.app)), sz("DisplayVersion", a.removable ? "1.0." + (a.id.length * 7 % 90) : "12.0.26100"),
      esz("InstallLocation", a.removable ? "C:\\Program Files\\WindowsApps\\" + a.id : "C:\\Windows\\SystemApps\\" + a.id),
      esz("UninstallString", a.removable ? "\"C:\\Windows\\System32\\msiexec.exe\" /x {" + a.id + "}" : ""),
      R("InstallDate", "REG_SZ", () => { const t = (S().appData.installDates || {})[a.id]; if (!t) return ""; const d = new Date(t); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); }),
      dw("NoRemove", a.removable ? 0 : 1), dw("SystemComponent", a.removable ? 0 : 1), R("EstimatedSize", "REG_DWORD", () => Math.ceil(T.jsonBytes(S().appData[a.id]) / 1024)),
    ], { onDelete: () => {
      if (!a.removable) return "Cannot delete " + a.id + ": Error while deleting key.\n" + a.name + " is a Windows component and can't be uninstalled.";
      T.uninstall(a.id); log("Application", "Information", "Registry Editor", 1, "The Uninstall key for " + a.name + " was deleted, so the app was removed."); return null;
    } }));
  }
  function hklm() {
    const cores = navigator.hardwareConcurrency || 1;
    let tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) {}
    return [
      K("BCD00000000", [K("Description"), K("Objects")]),
      K("HARDWARE", [
        K("ACPI", [K("DSDT"), K("FADT")]),
        K("DESCRIPTION", [K("System", [
          K("BIOS", [], [R("BIOSVendor", "REG_SZ", () => "Cameron Systems"), R("BIOSVersion", "REG_SZ", () => "12.0.26100"), R("SystemProductName", "REG_SZ", () => T.deviceName())]),
          K("CentralProcessor", Array.from({ length: cores }, (_, i) => K(String(i), [], [R("ProcessorNameString", "REG_SZ", () => (browser() === "ARM64" ? "ARM64 Processor" : "x64 Processor") + " (logical core " + (i + 1) + " of " + cores + ")"), R("Identifier", "REG_SZ", () => browser() === "ARM64" ? "ARMv8 (64-bit) Family 8" : "Intel64 Family 6"), R("~MHz", "REG_DWORD", () => 3400)]))),
          K("FloatingPointProcessor"), K("MultifunctionAdapter"),
        ], [R("SystemBiosVersion", "REG_MULTI_SZ", () => ["CAMSYS - 1", "12.0.26100"]), R("Identifier", "REG_SZ", () => browser() + "-based PC")])]),
        K("DEVICEMAP", [K("VIDEO", [], [R("\\Device\\Video0", "REG_SZ", () => { try { const c = document.createElement("canvas"), g = c.getContext("webgl"); const e = g && g.getExtension("WEBGL_debug_renderer_info"); const v = g ? (e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)) : ""; const l = g && g.getExtension("WEBGL_lose_context"); if (l) l.loseContext(); return v || "Microsoft Basic Display Adapter"; } catch (_) { return "Microsoft Basic Display Adapter"; } }), R("MaxObjectNumber", "REG_DWORD", () => 0)]), K("KeyboardClass"), K("PointerClass")]),
        K("RESOURCEMAP"),
      ], [], { protect: true }),
      K("SAM", [K("SAM")], [], { protect: true }),
      K("SECURITY", [], [], { protect: true }),
      K("SOFTWARE", [
        K("Classes", [K(".txt"), K("CLSID")]),
        K("Clients", [K("StartMenuInternet", [K("Microsoft Edge")])]),
        K("Microsoft", [
          K("Windows", [K("CurrentVersion", [
            K("App Paths", [K("regedit.exe", [], [sz("", "C:\\Windows\\regedit.exe")]), K("msedge.exe")]),
            K("Policies", [K("System", [], [
              M("EnableLUA", "REG_DWORD", () => (T.uacLevel() > 0 ? 1 : 0), (v) => { const n = toNum(v); if (n == null) return ERR_WRITE("EnableLUA"); S().appData.uacLevel = n ? (T.uacLevel() || 2) : 0; State.save(); }),
              M("ConsentPromptBehaviorAdmin", "REG_DWORD", () => uacToConsent(T.uacLevel()), (v) => { const n = toNum(v); if (n == null) return ERR_WRITE("ConsentPromptBehaviorAdmin"); S().appData.uacLevel = n === 0 ? 0 : n === 2 ? 3 : 2; State.save(); }),
              dw("PromptOnSecureDesktop", 1),
            ])]),
            K("Run", [], [esz("SecurityHealth", "%windir%\\system32\\SecurityHealthSystray.exe")]),
            K("Uninstall", uninstallKeys, [], { onNewKey: (name) => { const app = Catalog.storeApps.find((a) => lc(a.id) === lc(name) && !a.decorative && (a.builtin || a.game)); if (!app) return false; if (!T.isInstalled(app.id)) { S().installedApps.push(app.id); State.save(); if (WM.refreshDesktopIcons) WM.refreshDesktopIcons(); } return true; } }),
          ], [esz("ProgramFilesDir", "C:\\Program Files"), esz("CommonFilesDir", "C:\\Program Files\\Common Files"), sz("ProgramFilesPath", "%ProgramFiles%")])]),
          K("Windows Defender", [K("Real-Time Protection", [], [dw("DisableRealtimeMonitoring", 0)]), K("Signature Updates")]),
          K("Windows NT", [K("CurrentVersion", [K("Fonts"), K("Winlogon", [], [sz("Shell", "explorer.exe"), sz("Userinit", "C:\\Windows\\system32\\userinit.exe,")])], [
            R("ProductName", "REG_SZ", () => (S().hasProductKey ? "Windows 12 Pro" : "Windows 12 Home")),
            R("EditionID", "REG_SZ", () => (S().hasProductKey ? "Professional" : "Core")),
            R("DisplayVersion", "REG_SZ", () => "26H1"), R("CurrentBuild", "REG_SZ", () => "26100"),
            R("UBR", "REG_DWORD", () => (S().update && S().update.installed ? 4061 : 3775)),
            M("RegisteredOwner", "REG_SZ", userName, (v) => { v = String(v).trim(); if (!v) return ERR_WRITE("RegisteredOwner"); S().profile.username = v.slice(0, 24); State.save(); }),
            sz("RegisteredOrganization", ""),
            R("ProductId", "REG_SZ", () => (S().productKey ? "00330-" + String(S().productKey).replace(/[^A-Z0-9]/g, "").slice(0, 5) + "-00000-AAOEM" : "00330-80000-00000-AA000")),
            R("SystemRoot", "REG_SZ", () => "C:\\Windows"),
          ])]),
        ]),
        K("Policies", [K("Microsoft", [K("Windows")])]),
        K("RegisteredApplications"),
        K("WOW6432Node", [K("Microsoft")]),
      ]),
      K("SYSTEM", [
        K("CurrentControlSet", [
          K("Control", [
            K("ComputerName", [
              K("ComputerName", [], [M("ComputerName", "REG_SZ", () => T.deviceName(), (v) => { if (!T.setDeviceName(v)) return "The computer name can only contain letters, numbers and hyphens (15 max)."; })]),
              K("ActiveComputerName", [], [R("ComputerName", "REG_SZ", () => T.deviceName())]),
            ]),
            K("Nls", [K("Language", [], [sz("Default", "0409"), sz("InstallLanguage", "0409")])]),
            K("Power", [], [dw("HibernateEnabled", 0)]),
            K("Print", [K("Printers", [K("Microsoft Print to PDF", [], [sz("Port", "PORTPROMPT:"), sz("Printer Driver", "Microsoft Print To PDF")])])]),
            K("Session Manager", [K("Environment", [], [R("NUMBER_OF_PROCESSORS", "REG_SZ", () => String(navigator.hardwareConcurrency || 1)), R("OS", "REG_SZ", () => "Windows_NT"), R("PROCESSOR_ARCHITECTURE", "REG_SZ", browser), esz("windir", "%SystemRoot%"), esz("TEMP", "%SystemRoot%\\TEMP"), esz("Path", "%SystemRoot%\\system32;%SystemRoot%;%SystemRoot%\\System32\\Wbem")])]),
            K("TimeZoneInformation", [], [R("TimeZoneKeyName", "REG_SZ", () => tz || "UTC"), R("Bias", "REG_DWORD", () => new Date().getTimezoneOffset() >>> 0), dw("RealTimeIsUniversal", 0)]),
          ]),
          K("Enum", [K("ACPI"), K("BTHENUM"), K("HID"), K("PCI"), K("ROOT"), K("SWD"), K("USB")]),
          K("Services", [
            K("EventLog", ["Application", "Security", "Setup", "System"].map((l) => K(l, [], [esz("File", "%SystemRoot%\\System32\\Winevt\\Logs\\" + l + ".evtx"), dw("MaxSize", 20971520), R("RecordCount", "REG_DWORD", () => (window.EventLog ? EventLog.list(l).length : 0))]))),
            K("SharedAccess", [K("Parameters", [K("FirewallPolicy", [
              K("StandardProfile", [], [M("EnableFirewall", "REG_DWORD", () => (fw().private ? 1 : 0), (v) => { fw().private = !!toNum(v); State.save(); }), M("DisableNotifications", "REG_DWORD", () => (fw().notify ? 0 : 1), (v) => { fw().notify = !toNum(v); State.save(); })]),
              K("PublicProfile", [], [M("EnableFirewall", "REG_DWORD", () => (fw().public ? 1 : 0), (v) => { fw().public = !!toNum(v); State.save(); })]),
            ])])]),
            K("Tcpip", [K("Parameters", [], [R("Hostname", "REG_SZ", () => T.deviceName().toLowerCase()), R("NV Hostname", "REG_SZ", () => T.deviceName()), sz("Domain", "")])]),
            K("bthserv", [], [R("Start", "REG_DWORD", () => (window.Radios && Radios.bt.supported() ? 3 : 4))]),
            K("WinDefend", [], [dw("Start", 2)]),
          ]),
        ]),
        K("MountedDevices", [], [bin("\\DosDevices\\C:", [0x44, 0x4d, 0x49, 0x4f, 0x3a, 0x49, 0x44, 0x3a])]),
        K("Setup", [], [dw("SetupType", 0), sz("CmdLine", ""), R("OOBEInProgress", "REG_DWORD", () => (S().setupCompleted ? 0 : 1))]),
      ]),
    ];
  }
  function hkcr() {
    const ext = (e, prog, ct) => K(e, [K("OpenWithProgids")], [sz("", prog)].concat(ct ? [sz("Content Type", ct)] : []));
    const prog = (name, desc, cmd) => K(name, [K("DefaultIcon"), K("shell", [K("open", [K("command", [], [esz("", cmd)])])])], [sz("", desc)]);
    return [
      K("*", [K("shellex")]),
      ext(".docx", "Word.Document.12", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      ext(".html", "MSEdgeHTM", "text/html"), ext(".jpg", "jpegfile", "image/jpeg"), ext(".pdf", "AcroExch.Document.DC", "application/pdf"),
      ext(".png", "pngfile", "image/png"), ext(".pptx", "PowerPoint.Show.12"), ext(".reg", "regfile", "text/plain"), ext(".txt", "txtfile", "text/plain"), ext(".xlsx", "Excel.Sheet.12"),
      K("CLSID", [K("{20D04FE0-3AEA-1069-A2D8-08002B30309D}", [], [sz("", "This PC")]), K("{645FF040-5081-101B-9F08-00AA002F954E}", [], [sz("", "Recycle Bin")])]),
      K("http", [], [sz("", "URL:HyperText Transfer Protocol"), sz("URL Protocol", "")]),
      K("ms-settings", [K("shell", [K("open", [K("command")])])], [sz("", "URL:ms-settings"), sz("URL Protocol", "")]),
      prog("regfile", "Registration Entries", "regedit.exe \"%1\""),
      prog("txtfile", "Text Document", "%SystemRoot%\\system32\\NOTEPAD.EXE %1"),
    ];
  }
  function root() {
    return [
      K("HKEY_CLASSES_ROOT", hkcr),
      K("HKEY_CURRENT_USER", hkcu),
      K("HKEY_LOCAL_MACHINE", hklm),
      K("HKEY_USERS", () => [K(".DEFAULT", [K("Control Panel"), K("Environment"), K("Software")]), K("S-1-5-18", [K("Software")]), K("S-1-5-19"), K("S-1-5-20"), K(SID, hkcu), K(SID + "_Classes")]),
      K("HKEY_CURRENT_CONFIG", [K("Software", [K("Fonts", [], [R("LogPixels", "REG_DWORD", () => Math.round(96 * (window.devicePixelRatio || 1)))])]), K("System", [K("CurrentControlSet", [K("Control", [K("Print", [K("Printers")])]), K("SERVICES")])])]),
    ];
  }

  // ---------------- tree access ----------------
  const call = (x) => (typeof x === "function" ? x() : x) || [];
  function kidsOf(node, path) {
    const out = node.user ? [] : call(node.kids).slice();
    const lp = lc(path) + "\\";
    const st = store();
    Object.keys(st.keys).forEach((k) => {
      const e = st.keys[k]; if (!e.created) return;
      if (k.startsWith(lp) && k.slice(lp.length).indexOf("\\") < 0 && !out.some((n) => lc(n.name) === k.slice(lp.length))) out.push({ name: e.path.split("\\").pop(), user: true, kids: [], vals: [] });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }
  function nodeAt(path) {
    const segs = normPath(path).split("\\").filter(Boolean); if (!segs.length) return null;
    let node = root().find((h) => lc(h.name) === lc(segs[0])); if (!node) return null;
    let p = node.name; const real = [node.name];
    for (let i = 1; i < segs.length; i++) {
      const k = kidsOf(node, p).find((n) => lc(n.name) === lc(segs[i])); if (!k) return null;
      node = k; p += "\\" + k.name; real.push(k.name);
    }
    node.path = real.join("\\");
    return node;
  }
  function parentPath(p) { const i = p.lastIndexOf("\\"); return i < 0 ? "" : p.slice(0, i); }
  function normPath(raw) {
    let p = String(raw || "").trim().replace(/\//g, "\\").replace(/^computer\\?/i, "").replace(/\\+$/, "");
    const first = p.split("\\")[0].toUpperCase(); if (ABBR[first]) p = ABBR[first] + p.slice(first.length);
    return p;
  }
  // Values of a key (Default first)
  function valuesOf(node, path) {
    const lp = lc(path), st = store(), out = [];
    if (!node.user) call(node.vals).forEach((v) => {
      const id = lp + "\\" + lc(v.name);
      if (st.delv[id] && !v.mapped) return;
      let data, type = v.type;
      if (v.mapped) { try { data = v.get(); } catch (_) { data = ""; } }
      else if (st.over[id]) { data = st.over[id].data; type = st.over[id].type; }
      else data = v.data;
      out.push({ name: v.name, type, data, def: v, kind: v.mapped ? (v.ro ? "ro" : "mapped") : "static" });
    });
    const uk = st.keys[lp];
    if (uk && uk.values) Object.keys(uk.values).forEach((k) => { const v = uk.values[k]; if (!out.some((o) => lc(o.name) === k)) out.push({ name: v.name, type: v.type, data: v.data, kind: "user" }); });
    if (!out.some((o) => o.name === "")) out.push({ name: "", type: "REG_SZ", data: null, kind: "default" });
    return out.sort((a, b) => (a.name === "" ? -1 : b.name === "" ? 1 : a.name.localeCompare(b.name, undefined, { sensitivity: "base" })));
  }
  function ukey(path, create) { const st = store(), l = lc(path); if (!st.keys[l] && create) st.keys[l] = { path, values: {} }; if (st.keys[l] && !st.keys[l].values) st.keys[l].values = {}; return st.keys[l]; }
  // write a value; returns error string or null
  function setValue(path, name, type, data) {
    const node = nodeAt(path); if (!node) return "Cannot find the key " + path + ".";
    const v = valuesOf(node, path).find((x) => lc(x.name) === lc(name));
    if (v && v.kind === "ro") return ERR_WRITE(name);
    if (v && v.kind === "mapped") {
      if (!v.def.set) return ERR_WRITE(name);
      const r = v.def.set(data); if (r) return r;
      log("Application", "Information", "Registry Editor", 2, "Value " + path + "\\" + (name || "(Default)") + " was set to " + fmtData(type, data) + " and applied to this PC.");
      return null;
    }
    if (v && v.kind === "static") { store().over[lc(path) + "\\" + lc(name)] = { type, data }; delete store().delv[lc(path) + "\\" + lc(name)]; State.save(); return null; }
    if (!v && node.onNewValue) { const handled = node.onNewValue(name, type, data); if (handled) return null; }
    const k = ukey(path, true); k.values[lc(name)] = { name, type, data }; State.save(); return null;
  }
  function deleteValue(path, name) {
    const node = nodeAt(path); if (!node) return "Cannot find the key.";
    const v = valuesOf(node, path).find((x) => lc(x.name) === lc(name)); if (!v) return null;
    if (v.kind === "default") return null;
    if (v.kind === "user") { const k = ukey(path); delete k.values[lc(name)]; State.save(); return null; }
    if (v.kind === "static") { if (/^HKEY_LOCAL_MACHINE\\HARDWARE/i.test(path)) return "Unable to delete all specified values."; store().delv[lc(path) + "\\" + lc(name)] = true; delete store().over[lc(path) + "\\" + lc(name)]; State.save(); return null; }
    if (v.def.del) { const r = v.def.del(); return r || null; }
    return "Unable to delete all specified values.";
  }
  function createKey(parent, name) {
    if (!name || /\\/.test(name)) return { err: "The Registry Editor cannot create a key with that name." };
    const node = nodeAt(parent); if (!node) return { err: "Cannot find the parent key." };
    if (kidsOf(node, parent).some((k) => lc(k.name) === lc(name))) return { err: "The Registry Editor cannot rename " + name + ". The specified key name already exists. Type another name and try again." };
    if (/^HKEY_(LOCAL_MACHINE|USERS)$/i.test(parent) || node.protect) return { err: "Cannot create key: You do not have the requisite permissions to create a new key under " + name.split("\\").pop() + "." };
    if (node.onNewKey && node.onNewKey(name)) return { path: parent + "\\" + name, special: true };
    const p = parent + "\\" + name; const k = ukey(p, true); k.created = true; State.save();
    return { path: p };
  }
  function deleteKey(path) {
    const node = nodeAt(path); if (!node) return null;
    if (path.indexOf("\\") < 0) return "Cannot delete " + path + ": Error while deleting key.";
    if (node.user) { const lp = lc(path); const st = store(); Object.keys(st.keys).forEach((k) => { if (k === lp || k.startsWith(lp + "\\")) delete st.keys[k]; }); State.save(); return null; }
    if (node.onDelete) return node.onDelete() || null;
    return "Cannot delete " + node.name + ": Error while deleting key.";
  }
  function renameKey(path, nn) {
    const node = nodeAt(path); if (!node || !node.user) return "The Registry Editor cannot rename " + (node ? node.name : path) + ". Error while renaming key.";
    const par = parentPath(path); if (kidsOf(nodeAt(par), par).some((k) => lc(k.name) === lc(nn))) return "The Registry Editor cannot rename " + node.name + ". The specified key name already exists.";
    const st = store(), lp = lc(path), np = par + "\\" + nn;
    Object.keys(st.keys).forEach((k) => { if (k === lp || k.startsWith(lp + "\\")) { const e = st.keys[k]; delete st.keys[k]; e.path = np + e.path.slice(path.length); st.keys[lc(e.path)] = e; } });
    State.save(); return null;
  }
  function renameValue(path, old, nn) {
    const node = nodeAt(path); const vals = valuesOf(node, path); const v = vals.find((x) => lc(x.name) === lc(old));
    if (!v || (v.kind !== "user")) return "Cannot rename " + (old || "(Default)") + ": Error while renaming value.";
    if (vals.some((x) => lc(x.name) === lc(nn))) return "The Registry Editor cannot rename " + old + ". The specified value name already exists.";
    const k = ukey(path); delete k.values[lc(old)]; k.values[lc(nn)] = { name: nn, type: v.type, data: v.data }; State.save(); return null;
  }

  // ---------------- formatting ----------------
  const hex8 = (n) => (n >>> 0).toString(16).padStart(8, "0");
  function fmtData(type, d) {
    if (d === null || d === undefined) return type === "REG_SZ" ? "(value not set)" : "";
    if (type === "REG_DWORD") { const n = Number(d) >>> 0; return "0x" + hex8(n) + " (" + n + ")"; }
    if (type === "REG_QWORD") { const n = Number(d) || 0; return "0x" + Math.floor(n).toString(16).padStart(16, "0") + " (" + n + ")"; }
    if (type === "REG_BINARY") return (d || []).map((b) => (b & 255).toString(16).padStart(2, "0")).join(" ") || "(zero-length binary value)";
    if (type === "REG_MULTI_SZ") return (Array.isArray(d) ? d : [d]).join(" ");
    return String(d);
  }
  const TYPE_IC = (t) => /SZ/.test(t) ? `<span class="st-rv st-rv-sz">ab</span>` : `<span class="st-rv st-rv-bin">011</span>`;
  const FOLDER = (open) => `<svg viewBox="0 0 16 16" width="16" height="16"><path d="M1 3.5h5l1.5 1.5H15v8.5H1z" fill="${open ? "#ffd96a" : "#ffc83d"}"/><path d="M1 6h14v7.5H1z" fill="${open ? "#ffe9a6" : "#ffd96a"}"/></svg>`;
  const PC = `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="1" y="2" width="14" height="9" rx="1" fill="#2d7fd8"/><rect x="2.2" y="3.2" width="11.6" height="6.6" fill="#9fd0ff"/><path d="M5 14h6M8 11v3" stroke="#666" stroke-width="1.4"/></svg>`;

  // ---------------- .reg export / import ----------------
  function regEscape(s) { return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }
  function hexBytes(arr) { return arr.map((b) => (b & 255).toString(16).padStart(2, "0")).join(","); }
  function utf16(s) { const out = []; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); out.push(c & 255, c >> 8); } return out; }
  function regLine(v) {
    const n = v.name === "" ? "@" : '"' + regEscape(v.name) + '"';
    const d = v.data;
    if (v.kind === "default" || d === null || d === undefined) return null;
    switch (v.type) {
      case "REG_SZ": return n + '="' + regEscape(d) + '"';
      case "REG_DWORD": return n + "=dword:" + hex8(Number(d));
      case "REG_QWORD": { const x = Math.floor(Number(d) || 0); const lo = x % 4294967296, hi = Math.floor(x / 4294967296); const b = []; for (let i = 0; i < 4; i++) b.push((lo >>> (8 * i)) & 255); for (let i = 0; i < 4; i++) b.push((hi >>> (8 * i)) & 255); return n + "=hex(b):" + hexBytes(b); }
      case "REG_EXPAND_SZ": return n + "=hex(2):" + hexBytes(utf16(String(d)).concat([0, 0]));
      case "REG_MULTI_SZ": return n + "=hex(7):" + hexBytes([].concat(...(Array.isArray(d) ? d : [d]).map((s) => utf16(s).concat([0, 0]))).concat([0, 0]));
      case "REG_BINARY": return n + "=hex:" + hexBytes(d || []);
      default: return n + '="' + regEscape(d) + '"';
    }
  }
  function exportText(path) {
    const lines = ["Windows Registry Editor Version 5.00", ""]; let count = 0;
    const rec = (p, depth) => {
      if (count > 4000 || depth > 24) return;
      const node = nodeAt(p); if (!node) return; count++;
      lines.push("[" + p + "]");
      valuesOf(node, p).forEach((v) => { const l = regLine(v); if (l) lines.push(l); });
      lines.push("");
      kidsOf(node, p).forEach((k) => rec(p + "\\" + k.name, depth + 1));
    };
    if (path) rec(path, 0); else HIVES.forEach((h) => rec(h, 0));
    return lines.join("\r\n");
  }
  function downloadReg(path) {
    const txt = exportText(path);
    const buf = new Uint16Array(txt.length + 1); buf[0] = 0xfeff; for (let i = 0; i < txt.length; i++) buf[i + 1] = txt.charCodeAt(i);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
    a.download = (path ? path.split("\\").pop() : "Registry") + ".reg"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    return txt;
  }
  function parseHex(s) { return s.split(",").map((x) => x.trim()).filter(Boolean).map((x) => parseInt(x, 16) & 255); }
  function fromUtf16(bytes) { let s = ""; for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8)); return s; }
  function importText(txt) {
    txt = txt.replace(/^\ufeff/, "");
    if (!/^(Windows Registry Editor Version 5\.00|REGEDIT4)/.test(txt.trim())) return { err: "Cannot import: The specified file is not a registry script. You can only import binary registry files from within the registry editor." };
    const raw = txt.split(/\r?\n/); const lines = [];
    for (let i = 0; i < raw.length; i++) { let l = raw[i]; while (/\\$/.test(l) && i + 1 < raw.length) l = l.slice(0, -1) + raw[++i].trim(); lines.push(l); }
    let cur = null, ok = 0, errs = [];
    for (const l0 of lines) {
      const l = l0.trim(); if (!l || l.startsWith(";")) continue;
      let m;
      if ((m = l.match(/^\[(-?)(.+)\]$/))) {
        const del = m[1] === "-", p = normPath(m[2]);
        if (del) { const e = deleteKey(p); if (e) errs.push(e); else ok++; cur = null; continue; }
        // create missing keys along the way
        const segs = p.split("\\"); let acc = segs[0];
        for (let i = 1; i < segs.length; i++) { const nxt = acc + "\\" + segs[i]; if (!nodeAt(nxt)) { const r = createKey(acc, segs[i]); if (r.err) { errs.push(r.err); break; } } acc = nxt; }
        cur = nodeAt(p) ? nodeAt(p).path : null; continue;
      }
      if (!cur) continue;
      if (!(m = l.match(/^(@|"((?:[^"\\]|\\.)*)")=(.*)$/))) continue;
      const name = m[1] === "@" ? "" : m[2].replace(/\\(.)/g, "$1"), rhs = m[3];
      let type, data, mm;
      if (rhs === "-") { const e = deleteValue(cur, name); if (e) errs.push(e); else ok++; continue; }
      if ((mm = rhs.match(/^"((?:[^"\\]|\\.)*)"$/))) { type = "REG_SZ"; data = mm[1].replace(/\\(.)/g, "$1"); }
      else if ((mm = rhs.match(/^dword:([0-9a-f]{1,8})$/i))) { type = "REG_DWORD"; data = parseInt(mm[1], 16) >>> 0; }
      else if ((mm = rhs.match(/^hex\(b\):(.*)$/i))) { const b = parseHex(mm[1]); type = "REG_QWORD"; data = b.slice(0, 4).reduce((s, x, i) => s + x * 2 ** (8 * i), 0) + b.slice(4, 8).reduce((s, x, i) => s + x * 2 ** (32 + 8 * i), 0); }
      else if ((mm = rhs.match(/^hex\(2\):(.*)$/i))) { type = "REG_EXPAND_SZ"; data = fromUtf16(parseHex(mm[1])).replace(/\0+$/, ""); }
      else if ((mm = rhs.match(/^hex\(7\):(.*)$/i))) { type = "REG_MULTI_SZ"; data = fromUtf16(parseHex(mm[1])).replace(/\0+$/, "").split("\0"); }
      else if ((mm = rhs.match(/^hex:(.*)$/i))) { type = "REG_BINARY"; data = parseHex(mm[1]); }
      else continue;
      const e = setValue(cur, name, type, data); if (e) errs.push(e); else ok++;
    }
    return { ok, errs };
  }

  // ---------------- the app window ----------------
  let elevatedThisSession = false;
  function openRegedit() {
    const ref = WM.createWindow({ title: "Registry Editor", icon: Icon.mini("regedit", "Registry Editor"), width: Math.min(920, window.innerWidth - 30), height: Math.min(600, window.innerHeight - 90), appId: "regedit" });
    const body = ref.body; body.classList.add("st-host");
    body.innerHTML = `<div class="st-app st-rg">
      <div class="st-menubar"><button data-m="file">File</button><button data-m="edit">Edit</button><button data-m="view">View</button><button data-m="fav">Favorites</button><button data-m="help">Help</button></div>
      <div class="st-toolbar st-rg-tools">
        <button class="st-tb" data-a="newkey" title="New Key">${FOLDER(false)}<span>New Key</span></button>
        <button class="st-tb" data-a="newval" title="New Value">${TYPE_IC("REG_SZ")}<span>New Value ▾</span></button>
        <button class="st-tb" data-a="modify" title="Modify">${svgI("ev")}<span>Modify</span></button>
        <button class="st-tb" data-a="delete" title="Delete">${svgI("x")}<span>Delete</span></button>
        <button class="st-tb" data-a="find" title="Find (Ctrl+F)">${svgSearch()}<span>Find</span></button>
        <button class="st-tb" data-a="export" title="Export">${svgI("save")}<span>Export</span></button>
      </div>
      <div class="st-addrbar"><input class="st-input st-rg-addr" spellcheck="false" autocomplete="off" aria-label="Address" data-no-eye></div>
      <div class="st-rg-main"><div class="st-tree st-rg-tree st-scroll" tabindex="0"></div><div class="st-split"></div><div class="st-rg-vals st-scroll" tabindex="0"><table class="st-table st-rg-table"><thead><tr><th>Name</th><th>Type</th><th>Data</th></tr></thead><tbody></tbody></table></div></div>
      <div class="st-status st-rg-status"></div>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const st = store();
    const expanded = new Set(["Computer"].concat(HIVES.slice(0, 0)));
    let cur = st.last && nodeAt(st.last) ? nodeAt(st.last).path : "HKEY_CURRENT_USER";
    let selVal = null, found = null, lastFind = null;
    // expand ancestors of cur
    const expandTo = (p) => { const segs = p.split("\\"); let acc = ""; segs.slice(0, -1).forEach((s) => { acc = acc ? acc + "\\" + s : s; expanded.add(acc); }); };
    expandTo(cur);

    function select(p, keepVal) {
      const n = nodeAt(p); if (!n) return false;
      cur = n.path; st.last = cur; if (!keepVal) selVal = null;
      expandTo(cur); State.save(); paint(); scrollToSel(); return true;
    }
    function scrollToSel() { const s = $(".st-rg-tree .sel"); if (s) s.scrollIntoView({ block: "nearest" }); }
    function paintTree() {
      const t = $(".st-rg-tree"); const keep = t.scrollTop;
      const rows = [`<div class="st-tn st-tn-root ${cur === "" ? "sel" : ""}" data-p="">${PC}<span>Computer</span></div>`];
      const rec = (node, path, depth) => {
        const kids = kidsOf(node, path); const open = expanded.has(path);
        rows.push(`<div class="st-tn ${cur === path ? "sel" : ""}" data-p="${esc(path)}" style="padding-left:${6 + depth * 16}px"><span class="st-tw">${kids.length ? (open ? "▾" : "›") : ""}</span>${FOLDER(cur === path)}<span>${esc(node.name)}</span></div>`);
        if (open) kids.forEach((k) => rec(k, path + "\\" + k.name, depth + 1));
      };
      root().forEach((h) => rec(h, h.name, 1));
      t.innerHTML = rows.join(""); t.scrollTop = keep;
      t.querySelectorAll(".st-tn[data-p]").forEach((n) => {
        const p = n.dataset.p;
        n.querySelector(".st-tw") && (n.querySelector(".st-tw").onclick = (e) => { e.stopPropagation(); expanded.has(p) ? expanded.delete(p) : expanded.add(p); paintTree(); });
        n.onclick = () => { if (p === "") { cur = ""; selVal = null; paint(); return; } select(p); };
        n.ondblclick = () => { if (!p) return; expanded.has(p) ? expanded.delete(p) : expanded.add(p); paintTree(); };
        n.oncontextmenu = (e) => { e.preventDefault(); if (p) { select(p); keyMenu(e.clientX, e.clientY); } };
        longPress(n, (x, y) => { if (p) { select(p); keyMenu(x, y); } });
      });
    }
    function paintVals() {
      const tb = $(".st-rg-table tbody");
      if (!cur) { tb.innerHTML = ""; return; }
      const node = nodeAt(cur); if (!node) { tb.innerHTML = ""; return; }
      const vals = valuesOf(node, cur);
      tb.innerHTML = vals.map((v) => `<tr data-n="${esc(v.name)}" class="${selVal === v.name ? "sel" : ""} ${found && found.p === cur && found.v === v.name ? "st-found" : ""}" tabindex="-1"><td>${TYPE_IC(v.type)}${v.name === "" ? "(Default)" : esc(v.name)}${v.kind === "mapped" ? '<span class="st-real" title="Linked to a real setting on this PC — editing it changes the desktop">live</span>' : v.kind === "ro" ? '<span class="st-real st-real-ro" title="Read from this device">real</span>' : ""}</td><td>${v.type}</td><td>${esc(fmtData(v.type, v.data))}</td></tr>`).join("");
      tb.querySelectorAll("tr").forEach((tr) => {
        const n = tr.dataset.n;
        tr.onclick = () => { selVal = n; tb.querySelectorAll("tr.sel").forEach((x) => x.classList.remove("sel")); tr.classList.add("sel"); paintStatus(); };
        tr.ondblclick = () => { selVal = n; modify(); };
        tr.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); selVal = n; paintVals(); valMenu(e.clientX, e.clientY); };
        longPress(tr, (x, y) => { selVal = n; paintVals(); valMenu(x, y); });
      });
      paintStatus();
    }
    function paintStatus() { $(".st-rg-status").textContent = "Computer" + (cur ? "\\" + cur : "") + (selVal != null && cur ? "  ·  " + (selVal || "(Default)") : ""); $(".st-rg-addr").value = "Computer" + (cur ? "\\" + cur : ""); }
    function paint() { paintTree(); paintVals(); paintStatus(); }
    $(".st-rg-vals").addEventListener("contextmenu", (e) => { if (e.target.closest("tr")) return; e.preventDefault(); if (cur) newMenu(e.clientX, e.clientY); });

    // ---- dialogs ----
    function errBox(msg, title) { modal(body, title || "Registry Editor", `<div class="st-msg">${svgI("err", 32)}<div style="white-space:pre-line">${esc(msg)}</div></div>`, [["OK", "cancel", true]]); }
    function modify(binary) {
      if (!cur || selVal == null) return;
      const node = nodeAt(cur); const v = valuesOf(node, cur).find((x) => x.name === selVal); if (!v) return;
      const nameShown = v.name === "" ? "(Default)" : v.name;
      const live = v.kind === "mapped" ? `<div class="st-live">${svgI("info", 14)} This value is linked to a real setting — OK applies it to the desktop.</div>` : v.kind === "ro" ? `<div class="st-live">${svgI("info", 14)} Read from your device (read-only).</div>` : "";
      let type = binary ? "REG_BINARY" : v.type;
      if (type === "REG_DWORD" || type === "REG_QWORD") {
        const is64 = type === "REG_QWORD";
        const m = modal(body, "Edit " + (is64 ? "QWORD (64-bit)" : "DWORD (32-bit)") + " Value", `<div class="st-form">${live}<label class="st-lbl">Value name:</label><input class="st-input" value="${esc(nameShown)}" readonly><div class="st-dwrow"><div><label class="st-lbl">Value data:</label><input class="st-input st-vd" spellcheck="false" value="${is64 ? Math.floor(Number(v.data) || 0).toString(16) : (Number(v.data) >>> 0).toString(16)}"></div><fieldset class="st-base"><legend>Base</legend><label><input type="radio" name="b" value="16" checked> Hexadecimal</label><label><input type="radio" name="b" value="10"> Decimal</label></fieldset></div><div class="st-err"></div></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
        const inp = m.el.querySelector(".st-vd"); let base = 16;
        m.el.querySelectorAll("input[name=b]").forEach((r) => r.onchange = () => { const nb = +r.value; const n = parseInt(inp.value || "0", base); base = nb; inp.value = isNaN(n) ? "0" : n.toString(base); });
        inp.addEventListener("input", () => { const ok = base === 16 ? /^[0-9a-f]*$/i : /^[0-9]*$/; if (!ok.test(inp.value)) inp.value = inp.value.replace(base === 16 ? /[^0-9a-f]/ig : /[^0-9]/g, ""); });
        m.on("ok", () => {
          const n = parseInt(inp.value || "0", base); const max = is64 ? Number.MAX_SAFE_INTEGER : 0xffffffff;
          if (isNaN(n) || n > max) { m.el.querySelector(".st-err").textContent = "The value is too large for a " + (is64 ? "QWORD" : "DWORD") + "."; return; }
          const e = setValue(cur, v.name, type, n); if (e) { m.close(); errBox(e, "Error Editing Value"); } else { m.close(); paint(); }
        });
        if (v.kind === "ro") m.el.querySelector(".st-vd").readOnly = true;
        return;
      }
      if (type === "REG_MULTI_SZ") {
        const m = modal(body, "Edit Multi-String", `<div class="st-form">${live}<label class="st-lbl">Value name:</label><input class="st-input" value="${esc(nameShown)}" readonly><label class="st-lbl">Value data:</label><textarea class="st-input st-ta" rows="6">${esc((Array.isArray(v.data) ? v.data : [v.data || ""]).join("\n"))}</textarea></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
        m.on("ok", () => { const e = setValue(cur, v.name, type, m.el.querySelector("textarea").value.split("\n").filter((x) => x !== "")); m.close(); if (e) errBox(e, "Error Editing Value"); else paint(); });
        return;
      }
      if (type === "REG_BINARY") {
        const bytes = v.type === "REG_BINARY" ? (v.data || []) : utf16(String(v.data == null ? "" : v.data));
        const m = modal(body, "Edit Binary Value", `<div class="st-form">${live}<label class="st-lbl">Value name:</label><input class="st-input" value="${esc(nameShown)}" readonly><label class="st-lbl">Value data (hex bytes):</label><textarea class="st-input st-ta st-mono" rows="5">${bytes.map((b) => (b & 255).toString(16).padStart(2, "0")).join(" ")}</textarea><div class="st-err"></div></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
        m.on("ok", () => { const t = m.el.querySelector("textarea").value.trim(); if (t && !/^([0-9a-f]{2}[\s,]*)+$/i.test(t)) { m.el.querySelector(".st-err").textContent = "Type hex bytes like 01 a0 ff."; return; } const b = t ? t.split(/[\s,]+/).filter(Boolean).map((x) => parseInt(x, 16)) : []; const e = setValue(cur, v.name, "REG_BINARY", b); m.close(); if (e) errBox(e, "Error Editing Value"); else paint(); });
        return;
      }
      const m = modal(body, type === "REG_EXPAND_SZ" ? "Edit Expandable String" : "Edit String", `<div class="st-form">${live}<label class="st-lbl">Value name:</label><input class="st-input" value="${esc(nameShown)}" readonly><label class="st-lbl">Value data:</label><input class="st-input st-vd" spellcheck="false" value="${esc(v.data == null ? "" : v.data)}"></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
      if (v.kind === "ro") m.el.querySelector(".st-vd").readOnly = true;
      m.on("ok", () => { const e = setValue(cur, v.name, type, m.el.querySelector(".st-vd").value); m.close(); if (e) errBox(e, "Error Editing Value"); else paint(); });
    }
    function newKey() {
      if (!cur) return;
      const m = modal(body, "New Key", `<div class="st-form"><label class="st-lbl">Key name (under ${esc(cur.split("\\").pop())}):</label><input class="st-input" value="New Key #1" spellcheck="false"></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
      m.on("ok", () => { const nm = m.el.querySelector("input").value.trim(); const r = createKey(cur, nm); m.close(); if (r.err) return errBox(r.err, "Error Creating Key"); expanded.add(cur); if (r.special) { log("Application", "Information", "Registry Editor", 3, "Key " + r.path + " was created and applied to this PC."); } select(r.path); });
    }
    function newValue(type) {
      if (!cur) return;
      const node = nodeAt(cur); const vals = valuesOf(node, cur);
      let i = 1; while (vals.some((x) => lc(x.name) === lc("New Value #" + i))) i++;
      const label = { REG_SZ: "String Value", REG_DWORD: "DWORD (32-bit) Value", REG_QWORD: "QWORD (64-bit) Value", REG_BINARY: "Binary Value", REG_MULTI_SZ: "Multi-String Value", REG_EXPAND_SZ: "Expandable String Value" }[type];
      const m = modal(body, "New " + label, `<div class="st-form"><label class="st-lbl">Value name:</label><input class="st-input" value="New Value #${i}" spellcheck="false"></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
      m.on("ok", () => {
        const nm = m.el.querySelector("input").value.trim(); if (!nm) return;
        if (vals.some((x) => lc(x.name) === lc(nm))) { m.close(); return errBox("The Registry Editor cannot create " + nm + ". The specified value name already exists. Type another name and try again.", "Error Creating Value"); }
        const def = { REG_SZ: "", REG_EXPAND_SZ: "", REG_DWORD: 0, REG_QWORD: 0, REG_BINARY: [], REG_MULTI_SZ: [] }[type];
        const e = setValue(cur, nm, type, def); m.close(); if (e) return errBox(e, "Error Creating Value");
        selVal = valuesOf(nodeAt(cur), cur).some((x) => x.name === nm) ? nm : null; paint();
      });
    }
    function del() {
      if (!cur) return;
      if (selVal != null && selVal !== "") {
        const m = modal(body, "Confirm Value Delete", `<div class="st-msg">${svgI("warn", 32)}<div>Deleting certain registry values could cause system instability. Are you sure you want to permanently delete this value?</div></div>`, [["Yes", "yes", true], ["No", "cancel"]]);
        m.on("yes", () => { const e = deleteValue(cur, selVal); m.close(); if (e) errBox(e, "Error Deleting Values"); selVal = null; paint(); });
        return;
      }
      const name = cur.split("\\").pop();
      const m = modal(body, "Confirm Key Delete", `<div class="st-msg">${svgI("warn", 32)}<div>Are you sure you want to permanently delete this key and all of its subkeys?<br><b>${esc(name)}</b></div></div>`, [["Yes", "yes", true], ["No", "cancel"]]);
      m.on("yes", () => { m.close(); const e = deleteKey(cur); if (e) return errBox(e, "Error Deleting Key"); const p = parentPath(cur); select(p || "HKEY_CURRENT_USER"); });
    }
    function rename() {
      if (!cur) return;
      const isVal = selVal != null && selVal !== "";
      const old = isVal ? selVal : cur.split("\\").pop();
      const m = modal(body, "Rename", `<div class="st-form"><label class="st-lbl">New name:</label><input class="st-input" value="${esc(old)}" spellcheck="false"></div>`, [["OK", "ok", true], ["Cancel", "cancel"]]);
      m.on("ok", () => { const nn = m.el.querySelector("input").value.trim(); m.close(); if (!nn || nn === old) return; const e = isVal ? renameValue(cur, old, nn) : renameKey(cur, nn); if (e) return errBox(e, isVal ? "Error Renaming Value" : "Error Renaming Key"); if (isVal) { selVal = nn; paint(); } else select(parentPath(cur) + "\\" + nn); });
    }
    function exportDlg() {
      const m = modal(body, "Export Registry File", `<div class="st-form"><b>Export range</b><label class="st-check"><input type="radio" name="r" value="all"> All</label><label class="st-check"><input type="radio" name="r" value="sel" ${cur ? "checked" : ""}> Selected branch</label><input class="st-input" value="${esc(cur)}" spellcheck="false"><div class="st-dim">Saves a .reg file (UTF-16, like Windows) to your device's downloads.</div></div>`, [["Save", "ok", true], ["Cancel", "cancel"]]);
      if (!cur) m.el.querySelector("input[value=all]").checked = true;
      m.on("ok", () => { const all = m.el.querySelector("input[value=all]").checked; const p = all ? "" : normPath(m.el.querySelector("input.st-input").value); if (p && !nodeAt(p)) { m.el.querySelector(".st-dim").textContent = "That key doesn't exist."; return; } const t = downloadReg(p ? nodeAt(p).path : ""); body.dataset.lastExport = String(t.length); m.close(); log("Application", "Information", "Registry Editor", 4, "The registry branch " + (p || "(All)") + " was exported."); });
    }
    function importDlg() {
      const inp = document.getElementById("globalFileInput") || Object.assign(document.createElement("input"), { type: "file" });
      inp.accept = ".reg,text/plain"; inp.value = "";
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.arrayBuffer().then((buf) => { const u8 = new Uint8Array(buf); const txt = u8[0] === 0xff && u8[1] === 0xfe ? new TextDecoder("utf-16le").decode(u8) : new TextDecoder("utf-8").decode(u8); doImport(txt, f.name); }); };
      inp.click();
    }
    function doImport(txt, name) {
      const r = importText(txt); paint();
      if (r.err) return errBox(r.err);
      modal(body, "Registry Editor", `<div class="st-msg">${svgI(r.errs.length ? "warn" : "info", 32)}<div>${r.errs.length ? "Some keys and values were not imported:<br>" + r.errs.slice(0, 4).map(esc).join("<br>") : "The keys and values contained in " + esc(name || "the file") + " have been successfully added to the registry."} <span class="st-dim">(${r.ok} change${r.ok === 1 ? "" : "s"})</span></div></div>`, [["OK", "cancel", true]]);
    }
    body.__regImport = doImport; // for tests and drag-and-drop
    // Find
    function* walkAll() {
      const rec = function* (node, p) { yield [p, null, node]; for (const v of valuesOf(node, p)) yield [p, v.name, v]; for (const k of kidsOf(node, p)) yield* rec(k, p + "\\" + k.name); };
      for (const h of root()) yield* rec(h, h.name);
    }
    function findNext() {
      if (!lastFind) return findDlg();
      const { what, keys, vals, data, whole } = lastFind; const w = lc(what);
      const match = (s) => (whole ? lc(s) === w : lc(s).indexOf(w) >= 0);
      let passed = !cur; let n = 0;
      $(".st-rg-status").textContent = "Searching the registry…";
      for (const [p, vn, obj] of walkAll()) {
        if (++n > 60000) break;
        if (!passed) { if (p === cur && (selVal == null ? vn === null : vn === selVal)) passed = true; continue; }
        if (vn === null) { if (keys && p !== cur && match(p.split("\\").pop())) { found = { p, v: null }; selVal = null; select(p); return true; } }
        else if ((vals && match(vn === "" ? "(Default)" : vn)) || (data && obj.data != null && match(fmtData(obj.type, obj.data)))) { found = { p, v: vn }; selVal = vn; select(p, true); const tr = body.querySelector("tr.sel"); if (tr) tr.scrollIntoView({ block: "nearest" }); return true; }
      }
      paintStatus();
      modal(body, "Registry Editor", `<div class="st-msg">${svgI("info", 32)}<div>Finished searching through the registry.</div></div>`, [["OK", "cancel", true]]);
      return false;
    }
    function findDlg() {
      const f = lastFind || { what: "", keys: true, vals: true, data: true, whole: false };
      const m = modal(body, "Find", `<div class="st-form"><label class="st-lbl">Find what:</label><input class="st-input" value="${esc(f.what)}" spellcheck="false"><b>Look at</b><label class="st-check"><input type="checkbox" data-k="keys" ${f.keys ? "checked" : ""}> Keys</label><label class="st-check"><input type="checkbox" data-k="vals" ${f.vals ? "checked" : ""}> Values</label><label class="st-check"><input type="checkbox" data-k="data" ${f.data ? "checked" : ""}> Data</label><label class="st-check"><input type="checkbox" data-k="whole" ${f.whole ? "checked" : ""}> Match whole string only</label></div>`, [["Find Next", "ok", true], ["Cancel", "cancel"]]);
      m.on("ok", () => { const what = m.el.querySelector("input.st-input").value; if (!what) return; const g = (k) => m.el.querySelector(`[data-k="${k}"]`).checked; lastFind = { what, keys: g("keys"), vals: g("vals"), data: g("data"), whole: g("whole") }; m.close(); findNext(); });
    }
    // ---- menus ----
    const NEW = [["Key", newKey], ["-"], ["String Value", () => newValue("REG_SZ")], ["Binary Value", () => newValue("REG_BINARY")], ["DWORD (32-bit) Value", () => newValue("REG_DWORD")], ["QWORD (64-bit) Value", () => newValue("REG_QWORD")], ["Multi-String Value", () => newValue("REG_MULTI_SZ")], ["Expandable String Value", () => newValue("REG_EXPAND_SZ")]];
    function ctx(x, y, items) {
      body.querySelectorAll(".st-menu").forEach((m) => m.remove());
      const m = el(`<div class="st-menu st-ctx"></div>`);
      items.forEach((it) => { if (it[0] === "-") { m.appendChild(el(`<div class="st-menu-sep"></div>`)); return; } const b = el(`<button class="st-menu-it" ${it[2] ? "disabled" : ""}>${esc(it[0])}</button>`); b.onclick = (e) => { e.stopPropagation(); m.remove(); it[1](); }; m.appendChild(b); });
      const hr = body.getBoundingClientRect(); body.appendChild(m);
      m.style.left = Math.max(0, Math.min(x - hr.left, hr.width - m.offsetWidth - 4)) + "px"; m.style.top = Math.max(0, Math.min(y - hr.top, hr.height - m.offsetHeight - 4)) + "px";
      setTimeout(() => document.addEventListener("pointerdown", function h(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", h, true); } }, true), 0);
    }
    const keyMenu = (x, y) => ctx(x, y, [[expanded.has(cur) ? "Collapse" : "Expand", () => { expanded.has(cur) ? expanded.delete(cur) : expanded.add(cur); paintTree(); }], ["-"]].concat(NEW.map(([l, f]) => l === "-" ? ["-"] : ["New " + l, f])).concat([["-"], ["Find…", findDlg], ["-"], ["Delete", () => { selVal = null; del(); }], ["Rename", () => { selVal = null; rename(); }], ["-"], ["Export", exportDlg], ["Copy Key Name", copyKey]]));
    const valMenu = (x, y) => ctx(x, y, [["Modify…", () => modify()], ["Modify Binary Data…", () => modify(true)], ["-"], ["Delete", del], ["Rename", rename]]);
    const newMenu = (x, y) => ctx(x, y, NEW.map(([l, f]) => l === "-" ? ["-"] : ["New " + l, f]));
    function copyKey() { const t = cur; try { navigator.clipboard.writeText(t); } catch (_) {} if (window.Notify) Notify.show({ icon: Icon.mini("regedit", ""), title: "Registry Editor", body: "Copied " + esc(t) }); }
    const favItems = () => [["Add to Favorites…", () => { const f = (store().favs = store().favs || []); if (cur && f.indexOf(cur) < 0) f.push(cur); State.save(); }, () => !cur]].concat(((store().favs || []).length ? [["-"]] : []).concat((store().favs || []).map((p) => [p.split("\\").pop(), () => select(p)])));
    const DEFS = {
      file: [["Import…", importDlg], ["Export…", exportDlg], ["-"], ["Exit", () => ref.close()]],
      edit: [["Modify…", () => modify(), () => selVal == null], ["Modify Binary Data…", () => modify(true), () => selVal == null], ["-"]].concat(NEW.map(([l, f]) => l === "-" ? ["-"] : ["New " + l, f, () => !cur])).concat([["-"], ["Delete", del, () => !cur], ["Rename", rename, () => !cur], ["-"], ["Copy Key Name", copyKey, () => !cur], ["-"], ["Find…", findDlg], ["Find Next", findNext]]),
      view: [["Refresh", paint], ["Collapse all", () => { expanded.clear(); paint(); }]],
      fav: favItems(),
      help: [["About Registry Editor", () => modal(body, "About Registry Editor", `<div class="st-msg">${Icon.mini("regedit", "")}<div><b>Registry Editor</b><br>Values marked <span class="st-real">live</span> are linked to this desktop's real settings: editing them changes the app right away (theme, wallpaper, accent, text size, computer name, installed apps, UAC, firewall…). Values marked <span class="st-real st-real-ro">real</span> are read from your device. Keys and values you add are saved on this device.</div></div>`, [["OK", "cancel", true]])]],
    };
    menus(body, DEFS);
    // the Favorites menu is rebuilt each time it opens
    body.querySelector('[data-m="fav"]').addEventListener("pointerdown", () => { DEFS.fav = favItems(); }, true);
    // toolbar
    body.querySelector('[data-a="newkey"]').onclick = newKey;
    body.querySelector('[data-a="newval"]').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); ctx(r.left, r.bottom, NEW.slice(2)); };
    body.querySelector('[data-a="modify"]').onclick = () => modify();
    body.querySelector('[data-a="delete"]').onclick = del;
    body.querySelector('[data-a="find"]').onclick = findDlg;
    body.querySelector('[data-a="export"]').onclick = exportDlg;
    // address bar
    const addr = $(".st-rg-addr");
    addr.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const p = normPath(addr.value); if (!p) { cur = ""; paint(); return; } if (!select(p)) { errBox("Registry Editor cannot find the key " + addr.value.trim() + "."); paintStatus(); } } if (e.key === "Escape") paintStatus(); });
    // keyboard (only inside the tree/value panes, never while typing in inputs)
    body.addEventListener("keydown", (e) => {
      const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "F3") { e.preventDefault(); findNext(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) { e.preventDefault(); findDlg(); return; }
      if (body.querySelector(".st-modal-mask")) return;
      const inTree = t && t.closest && t.closest(".st-rg-tree"), inVals = t && t.closest && t.closest(".st-rg-vals");
      if (e.key === "Delete" && (inTree || inVals)) { e.preventDefault(); if (inTree) selVal = null; del(); return; }
      if (e.key === "F2" && (inTree || inVals)) { e.preventDefault(); rename(); return; }
      if (inVals && e.key === "Enter" && selVal != null) { e.preventDefault(); modify(); return; }
      if (inTree && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        const ps = [...body.querySelectorAll(".st-rg-tree .st-tn[data-p]")].map((n) => n.dataset.p); const i = ps.indexOf(cur);
        if (e.key === "ArrowDown" && ps[i + 1] != null) { if (ps[i + 1] === "") return; select(ps[i + 1]); }
        else if (e.key === "ArrowUp" && i > 0 && ps[i - 1]) select(ps[i - 1]);
        else if (e.key === "ArrowRight") { expanded.add(cur); paintTree(); }
        else if (e.key === "ArrowLeft") { if (expanded.has(cur)) { expanded.delete(cur); paintTree(); } else if (parentPath(cur)) select(parentPath(cur)); }
      }
    });
    // splitter
    const split = $(".st-split"), tree = $(".st-rg-tree");
    split.addEventListener("pointerdown", (e) => { split.setPointerCapture(e.pointerId); const x0 = e.clientX, w0 = tree.offsetWidth; const mv = (ev) => { tree.style.flexBasis = Math.max(140, Math.min(body.offsetWidth - 200, w0 + ev.clientX - x0)) + "px"; }; const up = () => { split.removeEventListener("pointermove", mv); split.removeEventListener("pointerup", up); }; split.addEventListener("pointermove", mv); split.addEventListener("pointerup", up); });
    // live refresh: when settings change elsewhere, mapped values update on next paint (refresh on focus)
    ref.win.addEventListener("pointerdown", () => { if (!body.querySelector(".st-modal-mask") && !body.querySelector(".st-menu")) { clearTimeout(ref._rt); ref._rt = setTimeout(paintVals, 0); } }, true);
    paint();
    return ref;
  }
  function longPress(node, fn) {
    let t = 0, sx = 0, sy = 0;
    node.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") return; sx = e.clientX; sy = e.clientY; clearTimeout(t); t = setTimeout(() => fn(sx, sy), 550); });
    const cancel = (e) => { if (e && e.type === "pointermove" && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return; clearTimeout(t); };
    node.addEventListener("pointermove", cancel); node.addEventListener("pointerup", cancel); node.addEventListener("pointercancel", cancel);
  }
  function svgSearch() { return `<svg class="st-i" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l3 3"/></svg>`; }

  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.regedit = function () {
    if (elevatedThisSession || T.uacLevel() === 0 || !window.UAC) { elevatedThisSession = true; return openRegedit(); }
    T.elevate({ name: "Registry Editor", publisher: "Microsoft Windows", iconKey: "regedit" }, () => { elevatedThisSession = true; openRegedit(); });
  };
  AppRegistry.regedt32 = AppRegistry.regedit;
  window.Registry = { nodeAt, valuesOf, setValue, deleteValue, createKey, deleteKey, exportText, importText, normPath, fmtData };
})();
