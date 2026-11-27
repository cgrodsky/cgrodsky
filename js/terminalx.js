/* Windows Terminal for Windows 12: tabs, split panes, profiles, color schemes, Settings UI,
   settings.json, Command Palette, find, copy/paste, zoom and restoring the previous session.

   Every pane is an independent shell session from js/terminal-core.js (TerminalCore.createSession):
   real cmd / PowerShell / bash on the virtual file system, with its own cwd, history and variables.
   This file only adds the Windows Terminal "host" around those sessions.

   Load order: after js/apps2.js (it replaces AppRegistry.terminal and AppRegistry.powershell).
   js/terminal-core.js is still loaded lazily the first time a Terminal window opens.
   State: State.data.appData.terminal.wt = { settings: {...settings.json...}, session: {...layout...} }. */
(function () {
  "use strict";
  if (window.TerminalX) return;

  // ------------------------------------------------------------------ helpers
  const lc = (s) => String(s == null ? "" : s).toLowerCase();
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let uidN = 0;
  const uid = () => "tx" + (++uidN) + Math.random().toString(36).slice(2, 6);
  const newGuid = () => "{" + "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => { const r = Math.random() * 16 | 0; return (ch === "x" ? r : (r & 3) | 8).toString(16); }) + "}";
  const GUID_RE = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i;
  const HEX_RE = /^#[0-9a-f]{6}$/i;
  function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  const SD = () => window.State && State.data;
  function wtStore() {
    const d = SD(); if (!d) return {};
    if (!d.appData) d.appData = {};
    const t = d.appData.terminal || (d.appData.terminal = { archInstalled: false });
    if (!t.wt || typeof t.wt !== "object") t.wt = {};
    return t.wt;
  }
  function persist() { try { State.save(); } catch (_) {} }

  // ------------------------------------------------------------------ built-in data
  const GUID = { ps: "{61c54bbd-c2c6-5271-96e7-009a87ff44bf}", cmd: "{0caa0dad-35be-5f56-a8ff-afceeeaa6101}", pwsh: "{574e775e-4f2a-5b96-ac1e-a2962a402336}", ubuntu: "{2c4de342-38b7-51cf-b940-2309a097f518}", azure: "{b453ae62-4e3d-5e58-b989-0a998ec441b8}" };
  const DEFAULT_PROFILES = [
    { guid: GUID.ps, name: "Windows PowerShell", commandline: "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", icon: "powershell", colorScheme: "Campbell Powershell", hidden: false },
    { guid: GUID.cmd, name: "Command Prompt", commandline: "%SystemRoot%\\System32\\cmd.exe", icon: "cmd", hidden: false },
    { guid: GUID.pwsh, name: "PowerShell 7", commandline: "pwsh.exe -NoLogo", source: "Windows.Terminal.PowershellCore", icon: "pwsh", hidden: false },
    { guid: GUID.ubuntu, name: "Ubuntu", commandline: "wsl.exe -d Ubuntu", source: "Windows.Terminal.Wsl", icon: "ubuntu", startingDirectory: "~", hidden: false },
    { guid: GUID.azure, name: "Azure Cloud Shell", source: "Windows.Terminal.Azure", icon: "azure", hidden: false },
  ];
  const BASE_DEFAULTS = { colorScheme: "Campbell", font: { face: "Cascadia Mono", size: 12 }, cursorShape: "bar", opacity: 100, useAcrylic: false, padding: "8", bellStyle: "audible", startingDirectory: "%USERPROFILE%" };
  const CURSORS = ["bar", "vintage", "underscore", "doubleUnderscore", "filledBox", "emptyBox"];
  const CURSOR_NAMES = { bar: "Bar ( ┃ )", vintage: "Vintage ( ▃ )", underscore: "Underscore ( ▁ )", doubleUnderscore: "Double underscore ( ‗ )", filledBox: "Filled box ( █ )", emptyBox: "Empty box ( ▯ )" };
  const BELLS = ["audible", "window", "taskbar", "all", "none"];
  const BELL_NAMES = { audible: "Audible (play a sound)", window: "Flash window", taskbar: "Flash tab", all: "All of the above", none: "None" };
  const COLOR_KEYS = ["background", "foreground", "cursorColor", "selectionBackground", "black", "red", "green", "yellow", "blue", "purple", "cyan", "white", "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightPurple", "brightCyan", "brightWhite"];
  const P16 = (a) => ({ black: a[0], red: a[1], green: a[2], yellow: a[3], blue: a[4], purple: a[5], cyan: a[6], white: a[7], brightBlack: a[8], brightRed: a[9], brightGreen: a[10], brightYellow: a[11], brightBlue: a[12], brightPurple: a[13], brightCyan: a[14], brightWhite: a[15] });
  const CAMPBELL = ["#0C0C0C", "#C50F1F", "#13A10E", "#C19C00", "#0037DA", "#881798", "#3A96DD", "#CCCCCC", "#767676", "#E74856", "#16C60C", "#F9F1A5", "#3B78FF", "#B4009E", "#61D6D6", "#F2F2F2"];
  const SOLAR = ["#002B36", "#DC322F", "#859900", "#B58900", "#268BD2", "#D33682", "#2AA198", "#EEE8D5", "#073642", "#CB4B16", "#586E75", "#657B83", "#839496", "#6C71C4", "#93A1A1", "#FDF6E3"];
  const TANGO = ["#000000", "#CC0000", "#4E9A06", "#C4A000", "#3465A4", "#75507B", "#06989A", "#D3D7CF", "#555753", "#EF2929", "#8AE234", "#FCE94F", "#729FCF", "#AD7FA8", "#34E2E2", "#EEEEEC"];
  const BUILTIN_SCHEMES = [
    Object.assign({ name: "Campbell", background: "#0C0C0C", foreground: "#CCCCCC", cursorColor: "#FFFFFF", selectionBackground: "#FFFFFF" }, P16(CAMPBELL)),
    Object.assign({ name: "Campbell Powershell", background: "#012456", foreground: "#CCCCCC", cursorColor: "#FFFFFF", selectionBackground: "#FFFFFF" }, P16(CAMPBELL)),
    Object.assign({ name: "One Half Dark", background: "#282C34", foreground: "#DCDFE4", cursorColor: "#FFFFFF", selectionBackground: "#FFFFFF" }, P16(["#282C34", "#E06C75", "#98C379", "#E5C07B", "#61AFEF", "#C678DD", "#56B6C2", "#DCDFE4", "#5A6374", "#E06C75", "#98C379", "#E5C07B", "#61AFEF", "#C678DD", "#56B6C2", "#DCDFE4"])),
    Object.assign({ name: "One Half Light", background: "#FAFAFA", foreground: "#383A42", cursorColor: "#4F525D", selectionBackground: "#4F525D" }, P16(["#383A42", "#E45649", "#50A14F", "#C18301", "#0184BC", "#A626A4", "#0997B3", "#FAFAFA", "#4F525D", "#DF6C75", "#98C379", "#E4C07A", "#61AFEF", "#C577DD", "#56B5C1", "#FFFFFF"])),
    Object.assign({ name: "Solarized Dark", background: "#002B36", foreground: "#839496", cursorColor: "#FFFFFF", selectionBackground: "#FFFFFF" }, P16(SOLAR)),
    Object.assign({ name: "Solarized Light", background: "#FDF6E3", foreground: "#657B83", cursorColor: "#002B36", selectionBackground: "#073642" }, P16(SOLAR)),
    Object.assign({ name: "Tango Dark", background: "#000000", foreground: "#D3D7CF", cursorColor: "#FFFFFF", selectionBackground: "#FFFFFF" }, P16(TANGO)),
    Object.assign({ name: "Tango Light", background: "#FFFFFF", foreground: "#555753", cursorColor: "#000000", selectionBackground: "#555753" }, P16(TANGO)),
    Object.assign({ name: "Vintage", background: "#000000", foreground: "#C0C0C0", cursorColor: "#FFFFFF", selectionBackground: "#FFFFFF" }, P16(["#000000", "#800000", "#008000", "#808000", "#000080", "#800080", "#008080", "#C0C0C0", "#808080", "#FF0000", "#00FF00", "#FFFF00", "#0000FF", "#FF00FF", "#00FFFF", "#FFFFFF"])),
  ];
  const TAB_COLORS = ["#C50F1F", "#E74856", "#FF8C00", "#C19C00", "#13A10E", "#16C60C", "#00B7C3", "#0078D4", "#3B78FF", "#881798", "#B4009E", "#E3008C", "#767676", "#4C4A48", "#69797E", "#F2F2F2"];

  // Actions (Windows Terminal names). User "actions" in settings.json add to / override these.
  const DEFAULT_ACTIONS = [
    { command: "newTab", keys: "ctrl+shift+t" },
    { command: "closePane", keys: "ctrl+shift+w" },
    { command: "nextTab", keys: "ctrl+tab" },
    { command: "prevTab", keys: "ctrl+shift+tab" },
    { command: "duplicateTab", keys: "ctrl+shift+d" },
    { command: { action: "splitPane", split: "right" }, keys: "alt+shift+plus" },
    { command: { action: "splitPane", split: "down" }, keys: "alt+shift+minus" },
    { command: { action: "splitPane", split: "auto", splitMode: "duplicate" }, keys: "alt+shift+d" },
    { command: { action: "moveFocus", direction: "left" }, keys: "alt+left" },
    { command: { action: "moveFocus", direction: "right" }, keys: "alt+right" },
    { command: { action: "moveFocus", direction: "up" }, keys: "alt+up" },
    { command: { action: "moveFocus", direction: "down" }, keys: "alt+down" },
    { command: { action: "resizePane", direction: "left" }, keys: "alt+shift+left" },
    { command: { action: "resizePane", direction: "right" }, keys: "alt+shift+right" },
    { command: { action: "resizePane", direction: "up" }, keys: "alt+shift+up" },
    { command: { action: "resizePane", direction: "down" }, keys: "alt+shift+down" },
    { command: "commandPalette", keys: "ctrl+shift+p" },
    { command: "find", keys: "ctrl+shift+f" },
    { command: "copy", keys: "ctrl+shift+c" },
    { command: "paste", keys: "ctrl+shift+v" },
    { command: { action: "adjustFontSize", delta: 1 }, keys: "ctrl+=" },
    { command: { action: "adjustFontSize", delta: 1 }, keys: "ctrl+plus" },
    { command: { action: "adjustFontSize", delta: -1 }, keys: "ctrl+minus" },
    { command: "resetFontSize", keys: "ctrl+0" },
    { command: "toggleFullscreen", keys: "f11" },
    { command: "toggleFullscreen", keys: "alt+enter" },
    { command: "openSettings", keys: "ctrl+," },
    { command: { action: "openSettings", target: "settingsFile" }, keys: "ctrl+shift+," },
    { command: "openNewTabDropdown", keys: "ctrl+shift+space" },
    { command: "togglePaneZoom" }, { command: "renameTab" }, { command: "openTabColorPicker" }, { command: "closeTab" },
    { command: "closeOtherTabs" }, { command: "closeTabsAfter" }, { command: "clearBuffer" }, { command: "scrollToTop" }, { command: "scrollToBottom" },
    { command: "about" },
  ].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ command: { action: "newTab", index: n - 1 }, keys: "ctrl+shift+" + n })));
  const ACTION_NAMES = ["newTab", "closePane", "closeTab", "closeOtherTabs", "closeTabsAfter", "nextTab", "prevTab", "duplicateTab", "splitPane", "moveFocus", "resizePane", "togglePaneZoom", "commandPalette", "find", "copy", "paste", "adjustFontSize", "resetFontSize", "toggleFullscreen", "openSettings", "openNewTabDropdown", "renameTab", "openTabColorPicker", "setColorScheme", "clearBuffer", "scrollToTop", "scrollToBottom", "about", "unbound"];

  // ------------------------------------------------------------------ icons
  const G = {
    plus: '<svg class="tx-g" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg>',
    chev: '<svg class="tx-g" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></svg>',
    x: '<svg class="tx-g" viewBox="0 0 16 16" style="width:10px;height:10px"><path d="M3 3l10 10M13 3L3 13"/></svg>',
    bell: '<svg viewBox="0 0 16 16" class="tx-tab-bell"><path d="M8 2a4 4 0 0 0-4 4v3l-1.5 2h11L12 9V6a4 4 0 0 0-4-4zM6.5 13a1.5 1.5 0 0 0 3 0" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    gear: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.3" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    pal: '<svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 7l2 1.5L5 10M8.5 10H11" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    info: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 7v4M8 5v.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    json: '<svg viewBox="0 0 16 16"><path d="M6 2.5c-1.5 0-2 .7-2 2v1.5c0 1-.5 1.6-1.5 2 1 .4 1.5 1 1.5 2v1.5c0 1.3.5 2 2 2M10 2.5c1.5 0 2 .7 2 2v1.5c0 1 .5 1.6 1.5 2-1 .4-1.5 1-1.5 2v1.5c0 1.3-.5 2-2 2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  };
  const PICONS = {
    cmd: '<svg viewBox="0 0 16 16"><rect x=".5" y="1.5" width="15" height="13" rx="2" fill="#1b1b1b" stroke="#8a8a8a"/><path d="M3.2 5.5l2.3 2-2.3 2" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M7 10.5h4.5" stroke="#fff" stroke-width="1.3"/></svg>',
    powershell: '<svg viewBox="0 0 16 16"><path d="M3 2h12l-2.2 12H.8z" fill="#2671be"/><path d="M4.6 5l3.4 2.6-4.6 3.1M7.6 11h3.2" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>',
    pwsh: '<svg viewBox="0 0 16 16"><path d="M3 2h12l-2.2 12H.8z" fill="#1e2c48"/><path d="M4.6 5l3.4 2.6-4.6 3.1M7.6 11h3.2" fill="none" stroke="#9cd1ff" stroke-width="1.3" stroke-linecap="round"/></svg>',
    ubuntu: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7.5" fill="#E95420"/><circle cx="8" cy="8" r="3.6" fill="none" stroke="#fff" stroke-width="1.4"/><circle cx="3.6" cy="8" r="1.35" fill="#fff" stroke="#E95420" stroke-width=".6"/><circle cx="10.2" cy="4.2" r="1.35" fill="#fff" stroke="#E95420" stroke-width=".6"/><circle cx="10.2" cy="11.8" r="1.35" fill="#fff" stroke="#E95420" stroke-width=".6"/></svg>',
    azure: '<svg viewBox="0 0 16 16"><path d="M6.2 1.5h3.4L5 14.5H1.2z" fill="#0a5fb0"/><path d="M10.4 4.8l4.4 9.7H6.6l4.1-1.4-2.5-3.1z" fill="#3ccbf4"/></svg>',
    arch: '<svg viewBox="0 0 16 16"><path d="M8 1L1.5 15c2-1.3 4-2 6.5-2.2 2.5.2 4.5.9 6.5 2.2z" fill="#1793d1"/></svg>',
    terminal: '<svg viewBox="0 0 16 16"><rect x=".5" y="1.5" width="15" height="13" rx="2" fill="#2b2b2b" stroke="#6b6b6b"/><path d="M.5 4.5h15" stroke="#6b6b6b"/><path d="M3.5 7l2 1.6-2 1.6M7 11h4" fill="none" stroke="#4cc2ff" stroke-width="1.3"/></svg>',
  };
  const ICON_KEYS = Object.keys(PICONS);
  function iconHtml(icon, fallback) {
    const k = lc(icon || "");
    if (PICONS[k]) return PICONS[k];
    if (/^(https?:|data:image\/)/i.test(icon || "")) return `<img src="${esc(icon)}" alt="">`;
    if (icon && String(icon).length <= 3) return `<span>${esc(icon)}</span>`;
    return PICONS[fallback] || PICONS.terminal;
  }

  // ------------------------------------------------------------------ settings
  function defaultSettings() {
    return {
      $help: "https://aka.ms/terminal-documentation",
      $schema: "https://aka.ms/terminal-profiles-schema",
      defaultProfile: GUID.cmd,
      firstWindowPreference: "defaultProfile",
      startupActions: "",
      launchMode: "default",
      copyOnSelect: true,
      confirmCloseAllTabs: true,
      multiLinePasteWarning: true,
      theme: "system",
      useAcrylicInTabRow: false,
      tabWidthMode: "equal",
      profiles: { defaults: {}, list: clone(DEFAULT_PROFILES) },
      schemes: [],
      actions: [],
    };
  }
  let SETTINGS = null;
  function settings() {
    if (SETTINGS) return SETTINGS;
    const st = wtStore();
    let s = st.settings;
    if (s && typeof s === "object") { const v = validate(clone(s)); if (!v.errors.length) s = v.value; else s = null; }
    SETTINGS = s || defaultSettings();
    return SETTINGS;
  }
  function saveSettings(s) { SETTINGS = s; wtStore().settings = clone(s); persist(); WINS.forEach((w) => w.applySettings()); }
  const allSchemes = (s) => { s = s || settings(); const custom = (s.schemes || []); const names = new Set(custom.map((x) => lc(x.name))); return BUILTIN_SCHEMES.filter((b) => !names.has(lc(b.name))).concat(custom); };
  const schemeBy = (name, s) => allSchemes(s).find((x) => lc(x.name) === lc(name)) || null;
  const isBuiltinScheme = (name) => BUILTIN_SCHEMES.some((b) => lc(b.name) === lc(name));
  const profilesOf = (s) => ((s || settings()).profiles.list || []);
  const visibleProfiles = (s) => profilesOf(s).filter((p) => !p.hidden);
  function profileBy(key, s) {
    const list = profilesOf(s); if (key == null || key === "") return null;
    if (typeof key === "number") return visibleProfiles(s)[key] || null;
    const k = lc(key);
    return list.find((p) => lc(p.guid) === k) || list.find((p) => lc(p.name) === k) || list.find((p) => lc(p.commandline || "").includes(k)) || null;
  }
  function defaultProfile(s) { s = s || settings(); return profileBy(s.defaultProfile, s) || visibleProfiles(s)[0] || profilesOf(s)[0] || DEFAULT_PROFILES[1]; }
  // profile setting with fallback to profiles.defaults then the built-in defaults
  function prop(p, key, s) {
    s = s || settings(); const d = (s.profiles && s.profiles.defaults) || {};
    if (key === "fontSize") { const v = (p && p.font && p.font.size) != null ? p.font.size : (d.font && d.font.size) != null ? d.font.size : BASE_DEFAULTS.font.size; return clamp(Number(v) || 12, 4, 96); }
    if (key === "fontFace") return (p && p.font && p.font.face) || (d.font && d.font.face) || BASE_DEFAULTS.font.face;
    if (p && p[key] !== undefined && p[key] !== null) return p[key];
    if (d[key] !== undefined && d[key] !== null) return d[key];
    return BASE_DEFAULTS[key];
  }
  function engineOf(p) {
    const c = lc(p.commandline || ""), src = lc(p.source || "");
    if (src.includes("azure") || /azure/.test(c)) return { shell: "azure" };
    if (src.includes("wsl") || /\b(wsl|bash|ubuntu|arch)(\.exe)?\b/.test(c)) return { shell: "bash", distro: /\barch\b/.test(c) ? "arch" : "ubuntu" };
    if (src.includes("powershellcore") || /\bpwsh(\.exe)?\b/.test(c)) return { shell: "ps", ps: "7" };
    if (/powershell(\.exe)?\b/.test(c)) return { shell: "ps", ps: "5.1" };
    return { shell: "cmd" };
  }
  const engineLabel = (p) => { const e = engineOf(p); return e.shell === "bash" ? (e.distro === "arch" ? "bash (Arch Linux, WSL)" : "bash (Ubuntu, WSL)") : e.shell === "ps" ? (e.ps === "7" ? "PowerShell 7 (pwsh)" : "Windows PowerShell 5.1") : e.shell === "azure" ? "Azure Cloud Shell (simulated)" : "Command Prompt (cmd.exe)"; };
  function iconKeyOf(p) { if (p.icon) return p.icon; const e = engineOf(p); return e.shell === "bash" ? (e.distro === "arch" ? "arch" : "ubuntu") : e.shell === "ps" ? (e.ps === "7" ? "pwsh" : "powershell") : e.shell === "azure" ? "azure" : "cmd"; }

  // ---- validation of settings.json (returns a normalized copy) ----
  function validate(raw) {
    const errors = [], warnings = [];
    const E = (m) => errors.push(m), W = (m) => warnings.push(m);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { errors: ["The root of settings.json must be an object { ... }."], warnings, value: null };
    const v = clone(raw);
    const KNOWN = ["$help", "$schema", "defaultProfile", "firstWindowPreference", "startupActions", "launchMode", "copyOnSelect", "confirmCloseAllTabs", "multiLinePasteWarning", "theme", "useAcrylicInTabRow", "tabWidthMode", "profiles", "schemes", "actions", "keybindings", "copyFormatting", "initialCols", "initialRows", "alwaysShowTabs", "showTabsInTitlebar", "wordDelimiters"];
    Object.keys(v).forEach((k) => { if (!KNOWN.includes(k)) W(`Unknown setting "${k}" (ignored).`); });
    const bool = (k) => { if (v[k] !== undefined && typeof v[k] !== "boolean") E(`"${k}" must be true or false.`); };
    ["copyOnSelect", "confirmCloseAllTabs", "multiLinePasteWarning", "useAcrylicInTabRow"].forEach(bool);
    const en = (k, list) => { if (v[k] !== undefined && !list.includes(v[k])) E(`"${k}" must be one of: ${list.map((x) => '"' + x + '"').join(", ")}.`); };
    en("firstWindowPreference", ["defaultProfile", "persistedWindowLayout"]);
    en("launchMode", ["default", "maximized", "fullscreen"]);
    en("theme", ["system", "dark", "light"]);
    en("tabWidthMode", ["equal", "titleLength", "compact"]);
    if (v.startupActions !== undefined && typeof v.startupActions !== "string") E('"startupActions" must be a string, e.g. "new-tab -p \\"Ubuntu\\" ; split-pane -V -p \\"Command Prompt\\"".');
    if (v.keybindings && !v.actions) { v.actions = v.keybindings; }
    delete v.keybindings;
    // schemes
    if (v.schemes === undefined) v.schemes = [];
    if (!Array.isArray(v.schemes)) { E('"schemes" must be an array.'); v.schemes = []; }
    const seenS = new Set();
    v.schemes.forEach((sc, i) => {
      if (!sc || typeof sc !== "object") { E(`schemes[${i}] must be an object.`); return; }
      if (typeof sc.name !== "string" || !sc.name.trim()) { E(`schemes[${i}] needs a "name".`); return; }
      if (seenS.has(lc(sc.name))) E(`Color scheme "${sc.name}" is defined twice.`);
      seenS.add(lc(sc.name));
      COLOR_KEYS.forEach((k) => {
        if (sc[k] === undefined) { if (k === "cursorColor" || k === "selectionBackground") return; W(`Scheme "${sc.name}" has no "${k}"; using Campbell's.`); const camp = BUILTIN_SCHEMES[0]; sc[k] = camp[k]; return; }
        if (typeof sc[k] !== "string" || !HEX_RE.test(sc[k])) E(`Scheme "${sc.name}": "${k}" must be a color like "#1E1E1E" (got ${JSON.stringify(sc[k])}).`);
      });
    });
    const schemeNames = new Set(BUILTIN_SCHEMES.map((x) => lc(x.name)).concat(v.schemes.filter((x) => x && x.name).map((x) => lc(x.name))));
    // profiles
    if (Array.isArray(v.profiles)) v.profiles = { defaults: {}, list: v.profiles };
    if (!v.profiles || typeof v.profiles !== "object") { E('"profiles" must be an object with a "list" array.'); v.profiles = { defaults: {}, list: [] }; }
    if (!v.profiles.defaults || typeof v.profiles.defaults !== "object" || Array.isArray(v.profiles.defaults)) { if (v.profiles.defaults !== undefined) E('"profiles.defaults" must be an object.'); v.profiles.defaults = {}; }
    if (!Array.isArray(v.profiles.list)) { E('"profiles.list" must be an array.'); v.profiles.list = []; }
    if (!v.profiles.list.length) E("At least one profile is required in profiles.list.");
    const checkProfile = (p, where) => {
      if (p.colorScheme !== undefined && (typeof p.colorScheme !== "string" || !schemeNames.has(lc(p.colorScheme)))) E(`${where}: color scheme ${JSON.stringify(p.colorScheme)} doesn't exist. Built-in: ${BUILTIN_SCHEMES.map((x) => x.name).join(", ")}.`);
      if (p.font !== undefined) {
        if (!p.font || typeof p.font !== "object") E(`${where}: "font" must be an object like { "size": 12 }.`);
        else if (p.font.size !== undefined && (typeof p.font.size !== "number" || p.font.size < 4 || p.font.size > 96)) E(`${where}: font.size must be a number from 4 to 96.`);
        else if (p.font.face !== undefined && typeof p.font.face !== "string") E(`${where}: font.face must be a string.`);
      }
      if (p.fontSize !== undefined) { W(`${where}: "fontSize" is deprecated; use "font": { "size": ${p.fontSize} }.`); if (typeof p.fontSize === "number") { p.font = Object.assign({}, p.font || {}, { size: p.fontSize }); } delete p.fontSize; }
      if (p.cursorShape !== undefined && !CURSORS.includes(p.cursorShape)) E(`${where}: "cursorShape" must be one of ${CURSORS.join(", ")}.`);
      if (p.opacity !== undefined && (typeof p.opacity !== "number" || p.opacity < 0 || p.opacity > 100)) E(`${where}: "opacity" must be a number from 0 to 100.`);
      if (p.useAcrylic !== undefined && typeof p.useAcrylic !== "boolean") E(`${where}: "useAcrylic" must be true or false.`);
      if (p.hidden !== undefined && typeof p.hidden !== "boolean") E(`${where}: "hidden" must be true or false.`);
      if (p.padding !== undefined && !(typeof p.padding === "number" || (typeof p.padding === "string" && /^\s*\d+(\s*,\s*\d+){0,3}\s*$/.test(p.padding)))) E(`${where}: "padding" must be a number or a string like "8" or "8, 4".`);
      if (p.bellStyle !== undefined) { const b = [].concat(p.bellStyle); if (!b.every((x) => BELLS.includes(x))) E(`${where}: "bellStyle" must be ${BELLS.map((x) => '"' + x + '"').join(", ")} (or an array of them).`); }
      if (p.startingDirectory !== undefined && p.startingDirectory !== null && typeof p.startingDirectory !== "string") E(`${where}: "startingDirectory" must be a path string or null.`);
      if (p.tabColor !== undefined && p.tabColor !== null && !(typeof p.tabColor === "string" && HEX_RE.test(p.tabColor))) E(`${where}: "tabColor" must be a color like "#0078D4" or null.`);
      ["name", "commandline", "icon", "tabTitle", "source"].forEach((k) => { if (p[k] !== undefined && p[k] !== null && typeof p[k] !== "string") E(`${where}: "${k}" must be a string.`); });
    };
    checkProfile(v.profiles.defaults, "profiles.defaults");
    const seenG = new Set();
    v.profiles.list.forEach((p, i) => {
      if (!p || typeof p !== "object" || Array.isArray(p)) { E(`profiles.list[${i}] must be an object.`); return; }
      const where = `Profile ${JSON.stringify(p.name || "#" + (i + 1))}`;
      if (typeof p.name !== "string" || !p.name.trim()) E(`profiles.list[${i}] needs a "name".`);
      if (p.guid === undefined) { p.guid = newGuid(); W(`${where} had no "guid"; one was generated.`); }
      if (typeof p.guid !== "string" || !GUID_RE.test(p.guid)) E(`${where}: "guid" must look like "{00000000-0000-0000-0000-000000000000}".`);
      else if (seenG.has(lc(p.guid))) E(`${where}: guid ${p.guid} is used by another profile.`);
      seenG.add(lc(p.guid));
      checkProfile(p, where);
    });
    if (v.defaultProfile !== undefined) {
      if (typeof v.defaultProfile !== "string") E('"defaultProfile" must be a profile guid or name.');
      else if (!v.profiles.list.some((p) => p && (lc(p.guid) === lc(v.defaultProfile) || lc(p.name) === lc(v.defaultProfile)))) E(`"defaultProfile" ${JSON.stringify(v.defaultProfile)} doesn't match any profile's guid or name.`);
    }
    // actions
    if (v.actions === undefined) v.actions = [];
    if (!Array.isArray(v.actions)) { E('"actions" must be an array.'); v.actions = []; }
    v.actions.forEach((a, i) => {
      if (!a || typeof a !== "object") { E(`actions[${i}] must be an object.`); return; }
      const cmd = a.command; const name = typeof cmd === "string" ? cmd : cmd && typeof cmd === "object" ? cmd.action : null;
      if (!name || !ACTION_NAMES.includes(name)) E(`actions[${i}]: unknown command ${JSON.stringify(name)}. Known: ${ACTION_NAMES.join(", ")}.`);
      if (a.keys !== undefined) [].concat(a.keys).forEach((k) => { if (typeof k !== "string" || !normKeys(k)) E(`actions[${i}]: can't read keys ${JSON.stringify(k)} (example: "ctrl+shift+t").`); });
    });
    return { errors, warnings, value: v };
  }

  // ------------------------------------------------------------------ keys
  const CODE_KEYS = { Equal: null, Minus: "minus", NumpadAdd: "plus", NumpadSubtract: "minus", Comma: ",", Period: ".", Slash: "/", Backquote: "`", BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'", Backslash: "\\", Space: "space", Tab: "tab", Enter: "enter", NumpadEnter: "enter", Escape: "esc", ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", PageUp: "pgup", PageDown: "pgdn", Home: "home", End: "end", Insert: "insert", Delete: "delete", Backspace: "backspace" };
  function keyOf(e) {
    const c = e.code || ""; let k = null;
    if (/^Key[A-Z]$/.test(c)) k = c.slice(3).toLowerCase();
    else if (/^Digit\d$/.test(c)) k = c.slice(5);
    else if (/^Numpad\d$/.test(c)) k = "numpad_" + c.slice(6);
    else if (/^F\d{1,2}$/.test(c)) k = c.toLowerCase();
    else if (c === "Equal") k = e.shiftKey ? "plus" : "=";
    else if (CODE_KEYS[c]) k = CODE_KEYS[c];
    if (!k) {
      const key = e.key || ""; if (!key || /^(Control|Shift|Alt|Meta|OS)$/.test(key)) return null;
      k = key === "+" ? "plus" : key === "-" ? "minus" : key === " " ? "space" : key === "Escape" ? "esc" : /^Arrow/.test(key) ? key.slice(5).toLowerCase() : key.toLowerCase();
    }
    if (["ctrl", "alt", "shift", "win"].includes(k)) return null;
    return (e.ctrlKey ? "ctrl+" : "") + (e.altKey ? "alt+" : "") + (e.shiftKey ? "shift+" : "") + (e.metaKey ? "win+" : "") + k;
  }
  function normKeys(str) {
    if (typeof str !== "string" || !str.trim()) return null;
    let s = lc(str).replace(/\s+/g, "");
    s = s.replace(/\+\+$/, "+plus").replace(/^\+$/, "plus");
    const parts = s.split("+").filter(Boolean); if (!parts.length) return null;
    const mods = { ctrl: false, alt: false, shift: false, win: false }; let key = null;
    for (const p0 of parts) {
      const p = { control: "ctrl", cmd: "win", meta: "win", option: "alt" }[p0] || p0;
      if (p in mods) { mods[p] = true; continue; }
      if (key) return null;
      key = { escape: "esc", pageup: "pgup", pagedown: "pgdn", del: "delete", return: "enter", "-": "minus", numpad_plus: "plus", numpad_minus: "minus", arrowleft: "left", arrowright: "right", arrowup: "up", arrowdown: "down" }[p] || p;
      if (!/^([a-z0-9]|f\d{1,2}|plus|minus|=|,|\.|\/|`|\[|\]|;|'|\\|space|tab|enter|esc|left|right|up|down|pgup|pgdn|home|end|insert|delete|backspace|numpad_\d)$/.test(key)) return null;
    }
    if (!key) return null;
    return (mods.ctrl ? "ctrl+" : "") + (mods.alt ? "alt+" : "") + (mods.shift ? "shift+" : "") + (mods.win ? "win+" : "") + key;
  }
  const prettyKeys = (k) => (k || "").split("+").map((p) => ({ ctrl: "Ctrl", alt: "Alt", shift: "Shift", win: "Win", plus: "Plus", minus: "Minus", pgup: "PgUp", pgdn: "PgDn", esc: "Esc", space: "Space", tab: "Tab", enter: "Enter", left: "Left", right: "Right", up: "Up", down: "Down" }[p] || (p.length === 1 ? p.toUpperCase() : p.toUpperCase()))).join("+");
  const actName = (cmd) => (typeof cmd === "string" ? cmd : cmd && cmd.action) || "";
  const actArgs = (cmd) => (typeof cmd === "string" ? {} : Object.assign({}, cmd || {}));
  let KEYMAP = null, KEYMAP_FOR = null;
  function keymap() {
    const s = settings(); if (KEYMAP && KEYMAP_FOR === s) return KEYMAP;
    const m = new Map();
    DEFAULT_ACTIONS.concat(s.actions || []).forEach((a) => { if (!a || a.keys == null) return; [].concat(a.keys).forEach((k) => { const n = normKeys(k); if (!n) return; if (actName(a.command) === "unbound") m.delete(n); else m.set(n, a.command); }); });
    KEYMAP = m; KEYMAP_FOR = s; return m;
  }
  function keysFor(cmd) {
    const want = JSON.stringify(typeof cmd === "string" ? { action: cmd } : cmd); let found = null;
    keymap().forEach((c, k) => { if (!found && JSON.stringify(typeof c === "string" ? { action: c } : c) === want) found = k; });
    return found ? prettyKeys(found) : "";
  }

  // ------------------------------------------------------------------ colors
  const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return [0, 0, 0]; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const lum = (h) => { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const rgba = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  function schemeVars(sc, opacity) {
    const bg = sc.background, pick = (...cs) => { for (const c of cs) if (c && contrast(c, bg) >= 3) return c; return cs.slice().sort((a, b) => contrast(b, bg) - contrast(a, bg))[0]; };
    const sel = sc.selectionBackground && contrast(sc.selectionBackground, bg) > 1.6 ? sc.selectionBackground : sc.foreground;
    const op = clamp(opacity == null ? 100 : opacity, 0, 100) / 100;
    return {
      "--tx-bg": op >= 1 ? bg : rgba(bg, op), "--tx-fg": sc.foreground, "--tx-input": pick(sc.brightWhite, sc.foreground), "--tx-white": pick(sc.brightWhite, sc.foreground),
      "--tx-green": pick(sc.brightGreen, sc.green), "--tx-red": pick(sc.brightRed, sc.red), "--tx-yellow": pick(sc.brightYellow, sc.yellow), "--tx-blue": pick(sc.brightBlue, sc.blue),
      "--tx-cyan": pick(sc.brightCyan, sc.cyan), "--tx-magenta": pick(sc.brightPurple, sc.purple), "--tx-arch": pick(sc.blue, sc.brightBlue, sc.cyan), "--tx-upath": pick(sc.brightBlue, sc.blue, sc.cyan),
      "--tx-gray": mix(sc.foreground, bg, 0.42), "--tx-cursor": sc.cursorColor || sc.foreground, "--tx-sel": rgba(sel, 0.32), "--tx-orange": "#E95420",
    };
  }

  // ------------------------------------------------------------------ engine loading
  let coreP = null;
  function verToken() { const src = Array.from(document.scripts).map((s) => s.getAttribute("src") || "").find((s) => /js\/(terminalx|apps2)\.js/.test(s)) || ""; const v = (/[?&]v=([^&#]+)/.exec(src) || [])[1]; return v ? "?v=" + v : ""; }
  function loadCore() {
    if (window.TerminalCore && window.TerminalCore.createSession) return Promise.resolve(window.TerminalCore);
    if (coreP) return coreP;
    coreP = new Promise((res, rej) => {
      const done = () => (window.TerminalCore ? res(window.TerminalCore) : rej(new Error("Terminal engine missing")));
      const existing = Array.from(document.scripts).find((s) => /js\/terminal-core\.js/.test(s.getAttribute("src") || ""));
      if (existing && !window.TerminalCore) { existing.addEventListener("load", done); existing.addEventListener("error", () => { coreP = null; rej(new Error("Could not load js/terminal-core.js")); }); setTimeout(() => { if (window.TerminalCore) done(); }, 50); return; }
      if (window.TerminalCore) return done();
      const sc = document.createElement("script"); sc.src = "js/terminal-core.js" + verToken();
      sc.onload = done; sc.onerror = () => { coreP = null; rej(new Error("Could not load js/terminal-core.js")); };
      document.head.appendChild(sc);
    });
    return coreP;
  }
  function ensureCss() {
    try {
      if (getComputedStyle(document.documentElement).getPropertyValue("--tx-loaded").trim()) return;
      if (document.querySelector('link[href*="terminalx.css"]')) return;
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/terminalx.css" + verToken(); document.head.appendChild(l);
    } catch (_) {}
  }

  // ------------------------------------------------------------------ clipboard
  let CLIP = "";
  function copyText(t) {
    CLIP = t;
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => false); } catch (_) {}
    return Promise.resolve(false);
  }
  function readClip() {
    try { if (navigator.clipboard && navigator.clipboard.readText) return navigator.clipboard.readText().then((t) => (t != null ? t : CLIP), () => CLIP); } catch (_) {}
    return Promise.resolve(CLIP);
  }
  let audio = null;
  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      audio = audio || new AC(); const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.16);
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.18);
    } catch (_) {}
  }

  // ------------------------------------------------------------------ startup actions (wt.exe command line subset)
  function splitArgs(s) { const out = []; let cur = "", q = false, has = false; for (const ch of String(s)) { if (ch === '"') { q = !q; has = true; continue; } if (!q && /\s/.test(ch)) { if (has || cur) out.push(cur); cur = ""; has = false; continue; } cur += ch; } if (has || cur) out.push(cur); return out; }
  function parseWtArgs(str) {
    const cmds = []; const segs = []; let cur = "", q = false;
    for (const ch of String(str || "")) { if (ch === '"') q = !q; if (ch === ";" && !q) { segs.push(cur); cur = ""; continue; } cur += ch; }
    segs.push(cur);
    for (const seg of segs) {
      const a = splitArgs(seg); if (!a.length) continue;
      let verb = lc(a[0]); let i = 1;
      const VERBS = { "new-tab": "nt", nt: "nt", "split-pane": "sp", sp: "sp", "focus-tab": "ft", ft: "ft", "move-focus": "mf", mf: "mf" };
      if (VERBS[verb]) verb = VERBS[verb]; else { verb = "nt"; i = 0; }
      const c = { verb, rest: [] };
      for (; i < a.length; i++) {
        const x = a[i], X = lc(x);
        if (X === "-p" || X === "--profile") c.profile = a[++i];
        else if (X === "-d" || X === "--startingdirectory") c.dir = a[++i];
        else if (X === "--title") c.title = a[++i];
        else if (X === "--tabcolor") c.color = a[++i];
        else if (X === "-h" || X === "--horizontal") c.split = "down";
        else if (X === "-v" || X === "--vertical") c.split = "right";
        else if (X === "-s" || X === "--size") c.size = parseFloat(a[++i]);
        else if (X === "-t" || X === "--target") c.target = parseInt(a[++i], 10);
        else if (verb === "mf" && /^(left|right|up|down)$/.test(X)) c.dir2 = X;
        else c.rest.push(x);
      }
      cmds.push(c);
    }
    return cmds;
  }

  // ------------------------------------------------------------------ the Terminal window
  const WINS = new Set();
  const leavesOf = (n) => (!n ? [] : n.type === "leaf" ? [n] : leavesOf(n.a).concat(leavesOf(n.b)));

  function TermWindow(opts) {
    opts = opts || {};
    const self = this;
    const vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.min(920, Math.max(340, vw - 24)), height = Math.min(580, Math.max(260, vh - 90));
    let closingFromLastTab = false, disposed = false;
    const ref = window.WM.createWindow({ title: opts.admin ? "Administrator: Terminal" : "Terminal", icon: window.Icon ? Icon.mini("terminal", "Terminal") : "", width, height, appId: "terminal", onClose: () => onWinClosed() });
    const win = ref.win, body = ref.body;
    win.classList.add("tx-win");
    this.ref = ref; this.win = win; this.tabs = []; this.active = null; this.admin = !!opts.admin;
    body.innerHTML = `<div class="tx-content"></div>`;
    const content = body.querySelector(".tx-content");
    const tb = win.querySelector(".win-titlebar");
    const strip = el(`<div class="tx-tabs" role="tablist" aria-label="Tabs"><div class="tx-tablist"></div><button class="tx-newtab" type="button" title="New tab (Ctrl+Shift+T)" aria-label="New tab">${G.plus}</button><button class="tx-dd" type="button" title="Open a profile, Settings, Command Palette (Ctrl+Shift+Space)" aria-label="New tab dropdown">${G.chev}</button><div class="tx-drag"></div></div>`);
    tb.insertBefore(strip, tb.querySelector(".win-controls"));
    const tablist = strip.querySelector(".tx-tablist");
    // keep tab gestures from dragging / maximizing the window (the empty .tx-drag area still drags it)
    ["pointerdown", "dblclick", "mousedown"].forEach((ev) => [tablist, strip.querySelector(".tx-newtab"), strip.querySelector(".tx-dd")].forEach((n) => n.addEventListener(ev, (e) => { if (ev !== "mousedown") e.stopPropagation(); })));
    strip.querySelector(".tx-newtab").addEventListener("click", (e) => { if (e.altKey) split({ split: "auto", profile: defaultProfile() }); else newTab(defaultProfile()); });
    strip.querySelector(".tx-dd").addEventListener("click", () => openDropdown());

    // ---- theme / appearance of the window chrome ----
    function applyTheme() {
      const s = settings(); const dark = s.theme === "dark" || (s.theme !== "light" && document.body.classList.contains("dark"));
      win.classList.toggle("tx-light", !dark); win.classList.toggle("tx-dark", dark);
      win.classList.toggle("tx-row-acrylic", !!s.useAcrylicInTabRow);
      strip.classList.remove("tx-w-equal", "tx-w-titleLength", "tx-w-compact"); strip.classList.add("tx-w-" + (s.tabWidthMode || "equal"));
    }
    const themeObs = new MutationObserver(applyTheme); themeObs.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    win.addEventListener("focusin", () => win.classList.add("tx-focused"));
    win.addEventListener("focusout", () => setTimeout(() => { if (!win.contains(document.activeElement)) win.classList.remove("tx-focused"); }, 0));

    // ================================================================ tabs
    function tabTitle(t) {
      if (t.kind === "settings") return "Settings";
      if (t.kind === "json") return "settings.json";
      if (t.title) return t.title;
      const l = t.activePane; if (!l) return "Terminal";
      const p = profileBy(l.guid) || {};
      return l.autoTitle || l.modeName || p.tabTitle || p.name || "Terminal";
    }
    function tabIcon(t) {
      if (t.kind === "settings") return G.gear;
      if (t.kind === "json") return G.json;
      const l = t.activePane; const p = l && profileBy(l.guid);
      if (l && l.modeIcon) return PICONS[l.modeIcon];
      return iconHtml(p ? iconKeyOf(p) : "terminal", "terminal");
    }
    function makeTab(kind) {
      const t = { id: uid(), kind, title: null, color: null, root: null, activePane: null, zoomed: null };
      t.page = el(`<div class="tx-page" hidden></div>`);
      content.appendChild(t.page);
      t.tabEl = el(`<div class="tx-tab" role="tab" tabindex="-1"><span class="tx-tab-color" hidden></span><span class="tx-tab-ic"></span><span class="tx-tab-title"></span>${G.bell}<button class="tx-tab-x" type="button" aria-label="Close tab" title="Close tab">${G.x}</button></div>`);
      wireTab(t);
      return t;
    }
    function addTab(t, at) {
      if (at == null || at >= self.tabs.length) { self.tabs.push(t); tablist.appendChild(t.tabEl); }
      else { self.tabs.splice(at, 0, t); tablist.insertBefore(t.tabEl, self.tabs[at + 1].tabEl); }
      refreshTab(t); selectTab(t);
    }
    function refreshTab(t) {
      const ttl = tabTitle(t);
      t.tabEl.querySelector(".tx-tab-title").textContent = ttl;
      t.tabEl.title = ttl;
      t.tabEl.querySelector(".tx-tab-ic").innerHTML = tabIcon(t);
      const p = t.activePane && profileBy(t.activePane.guid);
      const col = t.color || (p && p.tabColor) || null;
      const bar = t.tabEl.querySelector(".tx-tab-color"); bar.hidden = !col; if (col) bar.style.background = col;
      t.tabEl.classList.toggle("tx-colored", !!col); if (col) t.tabEl.style.setProperty("--tx-tabc", col); else t.tabEl.style.removeProperty("--tx-tabc");
      if (t === self.active) setWinTitle();
    }
    function setWinTitle() {
      const tt = win.querySelector(".win-titlebar .t-text");
      if (tt) tt.textContent = (self.admin ? "Administrator: " : "") + (self.active ? tabTitle(self.active) : "Terminal");
    }
    function selectTab(t) {
      if (!t) return;
      self.tabs.forEach((x) => { const on = x === t; x.page.hidden = !on; x.tabEl.classList.toggle("active", on); x.tabEl.setAttribute("aria-selected", on ? "true" : "false"); });
      self.active = t; t.tabEl.classList.remove("tx-belled");
      const te = t.tabEl; if (te.offsetLeft < tablist.scrollLeft) tablist.scrollLeft = te.offsetLeft; else if (te.offsetLeft + te.offsetWidth > tablist.scrollLeft + tablist.clientWidth) tablist.scrollLeft = te.offsetLeft + te.offsetWidth - tablist.clientWidth;
      setWinTitle(); updateSeeThrough();
      if (t.kind === "term" && t.activePane) focusPane(t.activePane); else if (t.focus) t.focus();
      persistSoon();
    }
    function closeTab(t, force) {
      if (!t) return;
      if (t.kind === "settings" && t.dirty && t.dirty() && !force) { confirmDlg("Discard unsaved changes?", "Your changes to the settings haven't been saved.", "Discard", () => closeTab(t, true)); return; }
      leavesOf(t.root).forEach((l) => { try { l.sess && l.sess.dispose(); } catch (_) {} });
      if (t.dispose) t.dispose();
      const i = self.tabs.indexOf(t); if (i < 0) return;
      self.tabs.splice(i, 1); t.tabEl.remove(); t.page.remove();
      if (!self.tabs.length) { closingFromLastTab = true; wtStore().session = null; persist(); ref.close(); return; }
      if (self.active === t) selectTab(self.tabs[Math.min(i, self.tabs.length - 1)]);
      persistSoon();
    }
    // Moves the neighbour's element (not the dragged one) so pointer capture survives the drag.
    function moveTab(t, to) {
      const i = self.tabs.indexOf(t); if (i < 0) return; to = clamp(to, 0, self.tabs.length - 1); if (Math.abs(to - i) !== 1) return;
      const other = self.tabs[to];
      if (to > i) tablist.insertBefore(other.tabEl, t.tabEl); else t.tabEl.after(other.tabEl);
      self.tabs[to] = t; self.tabs[i] = other; persistSoon();
    }
    function wireTab(t) {
      const te = t.tabEl;
      te.querySelector(".tx-tab-x").addEventListener("click", (e) => { e.stopPropagation(); closeTab(t); });
      te.querySelector(".tx-tab-x").addEventListener("pointerdown", (e) => e.stopPropagation());
      te.addEventListener("auxclick", (e) => { if (e.button === 1) { e.preventDefault(); closeTab(t); } });
      te.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
      te.addEventListener("dblclick", (e) => { e.stopPropagation(); if (t.kind === "term") startRename(t); });
      te.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); tabMenu(t, e.clientX, e.clientY); });
      // pointer: select, drag to reorder, long-press (touch) for the menu
      let st = null;
      t.down = (e) => {
        if (e.button !== 0 || e.target.closest(".tx-tab-x,.tx-tab-rename")) return;
        selectTab(t);
        st = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, lp: null };
        if (e.pointerType !== "mouse") st.lp = setTimeout(() => { if (st && !st.drag) { const s0 = st; st = null; tabMenu(t, s0.x, s0.y + 10); } }, 560);
        try { te.setPointerCapture(e.pointerId); } catch (_) {}
      };
      te.addEventListener("pointerdown", (e) => { if (!e.__txTab) t.down(e); });
      te.addEventListener("pointermove", (e) => {
        if (!st || e.pointerId !== st.id) return;
        const dx = e.clientX - st.x;
        if (!st.drag && Math.abs(dx) < 8 && Math.abs(e.clientY - st.y) < 8) return;
        if (st.lp) { clearTimeout(st.lp); st.lp = null; }
        if (!st.drag) { st.drag = true; te.classList.add("tx-dragging"); }
        const i = self.tabs.indexOf(t);
        const prev = self.tabs[i - 1], next = self.tabs[i + 1];
        if (next) { const r = next.tabEl.getBoundingClientRect(); if (e.clientX > r.left + r.width / 2) moveTab(t, i + 1); }
        if (prev) { const r = prev.tabEl.getBoundingClientRect(); if (e.clientX < r.left + r.width / 2) moveTab(t, i - 1); }
      });
      const end = () => { if (!st) return; if (st.lp) clearTimeout(st.lp); te.classList.remove("tx-dragging"); st = null; };
      te.addEventListener("pointerup", end); te.addEventListener("pointercancel", end);
    }
    function startRename(t) {
      const te = t.tabEl, span = te.querySelector(".tx-tab-title");
      if (te.querySelector(".tx-tab-rename")) return;
      const inp = el(`<input class="tx-tab-rename" aria-label="Tab title" spellcheck="false">`);
      inp.value = tabTitle(t); span.hidden = true; span.after(inp); inp.focus(); inp.select();
      let done = false;
      const finish = (ok) => { if (done) return; done = true; if (ok) { const v = inp.value.trim(); t.title = v || null; } inp.remove(); span.hidden = false; refreshTab(t); persistSoon(); if (t.activePane) focusPane(t.activePane); };
      inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); finish(true); } else if (e.key === "Escape") { e.preventDefault(); finish(false); } });
      inp.addEventListener("blur", () => finish(true));
      ["pointerdown", "dblclick", "click"].forEach((ev) => inp.addEventListener(ev, (e) => e.stopPropagation()));
    }

    // The tab row lives in the window titlebar, where other features (PowerToys "Always on top" menu)
    // listen for right-click / long-press at document level. Tabs get these gestures first.
    const tabFrom = (e) => { const te = e.target && e.target.closest && e.target.closest(".tx-tab"); return te && tablist.contains(te) ? self.tabs.find((x) => x.tabEl === te) : null; };
    const capCtx = (e) => { const t = tabFrom(e); if (!t || e.target.closest(".tx-tab-rename")) return; e.preventDefault(); e.stopPropagation(); tabMenu(t, e.clientX, e.clientY); };
    const capDown = (e) => {
      if (e.pointerType === "mouse" || !e.target || !e.target.closest || !strip.contains(e.target) || e.target.closest(".tx-drag")) return;
      const t = tabFrom(e); e.stopPropagation();
      if (t && !e.target.closest(".tx-tab-x,.tx-tab-rename")) { e.__txTab = true; t.down(e); }
    };
    window.addEventListener("contextmenu", capCtx, true);
    window.addEventListener("pointerdown", capDown, true);

    // ================================================================ panes
    function newLeaf(profile, o2) {
      o2 = o2 || {};
      const leaf = { type: "leaf", id: uid(), guid: profile.guid, fontDelta: 0, scheme: null, autoTitle: null, modeName: null, modeIcon: null, tab: null };
      leaf.el = el(`<div class="tx-pane"><div class="tx-host"></div></div>`);
      const eng = engineOf(profile);
      const startDir = o2.dir != null ? o2.dir : prop(profile, "startingDirectory");
      const T = window.TerminalCore;
      leaf.sess = T.createSession({
        host: leaf.el.firstChild,
        profile: Object.assign({}, eng, { startDir: o2.cwd ? null : startDir, banner: "profile", guid: profile.guid }),
        cwd: o2.cwd || null,
        close: () => closePane(leaf),
        closeWindow: () => closeWindowNow(),
        setTitle: (txt) => { leaf.autoTitle = String(txt || "").trim() || null; if (leaf.tab) refreshTab(leaf.tab); },
        onMode: (m, info) => { leaf.modeName = info.depth > 1 ? info.name : null; leaf.modeIcon = info.depth > 1 ? (m === "bash" ? (info.distro === "ubuntu" ? "ubuntu" : "arch") : m === "ps" ? (info.psv === "5.1" ? "powershell" : "pwsh") : m === "cmd" ? "cmd" : null) : null; if (leaf.tab) refreshTab(leaf.tab); },
        onBell: () => bell(leaf),
        onIdle: () => { leaf.el.classList.toggle("tx-exited", leaf.sess.isExited()); persistSoon(); },
        isActive: () => !!(leaf.tab && self.active === leaf.tab && leaf.tab.activePane === leaf && !overlayOpen()),
      });
      leaf.el.classList.toggle("tx-exited", leaf.sess.isExited());
      wirePane(leaf);
      applyPane(leaf);
      return leaf;
    }
    function applyPane(leaf) {
      const p = profileBy(leaf.guid) || defaultProfile();
      const sc = schemeBy(leaf.scheme || prop(p, "colorScheme")) || BUILTIN_SCHEMES[0];
      const op = Number(prop(p, "opacity")); const vars = schemeVars(sc, op);
      Object.keys(vars).forEach((k) => leaf.el.style.setProperty(k, vars[k]));
      const size = clamp(prop(p, "fontSize") + leaf.fontDelta, 4, 96);
      leaf.el.style.setProperty("--tx-font", (size * 1.2).toFixed(2) + "px");
      const face = String(prop(p, "fontFace") || "Cascadia Mono").replace(/["\\;{}]/g, "");
      leaf.el.style.setProperty("--tx-face", `"${face}", "Cascadia Mono", Consolas, "Courier New", monospace`);
      const pad = String(prop(p, "padding")).split(",").map((x) => clamp(parseInt(x, 10) || 0, 0, 64) + "px");
      leaf.el.style.setProperty("--tx-pad", pad.length === 2 ? `${pad[1]} ${pad[0]}` : pad.length === 4 ? `${pad[1]} ${pad[2]} ${pad[3]} ${pad[0]}` : pad[0]);
      leaf.el.classList.toggle("tx-acrylic", !!prop(p, "useAcrylic") && op < 100);
      leaf.translucent = op < 100;
      const cs = CURSORS.includes(prop(p, "cursorShape")) ? prop(p, "cursorShape") : "bar";
      leaf.el.classList.toggle("tx-cur-custom", cs !== "bar");
      leaf.caret.className = "tx-caret tx-c-" + cs;
      updateCaret(leaf);
    }
    function wirePane(leaf) {
      const pe = leaf.el, term = leaf.sess.el, input = leaf.sess.input;
      term.tabIndex = -1;   // clicking/selecting output keeps keyboard focus inside the Terminal window
      pe.addEventListener("pointerdown", () => { if (leaf.tab && leaf.tab.activePane !== leaf) setActivePane(leaf, true); }, true);
      // custom cursor
      leaf.caret = el(`<i class="tx-caret"></i>`);
      input.parentNode.appendChild(leaf.caret);
      const upd = () => requestAnimationFrame(() => updateCaret(leaf));
      ["input", "keydown", "keyup", "click", "focus", "blur", "select", "scroll"].forEach((ev) => input.addEventListener(ev, upd));
      // copy on select / right-click / long-press
      term.addEventListener("mouseup", (e) => { if (e.button === 0) setTimeout(() => copyOnSelect(leaf), 0); });
      term.addEventListener("contextmenu", (e) => {
        if (e.target.closest(".tx-find")) return;
        e.preventDefault();
        if (leaf.lpShown) { leaf.lpShown = false; return; }
        const sel = selectionIn(leaf);
        if (e.shiftKey) { paneMenu(leaf, e.clientX, e.clientY); return; }
        if (sel) { copyText(sel).then(() => toast("Copied")); try { window.getSelection().removeAllRanges(); } catch (_) {} }
        else doPaste(leaf);
      });
      let lp = null;
      term.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1) return; const t0 = e.touches[0]; const sx = t0.clientX, sy = t0.clientY;
        clearTimeout(lp);
        lp = setTimeout(() => { lp = null; if (selectionIn(leaf)) return; leaf.lpShown = true; setTimeout(() => (leaf.lpShown = false), 900); paneMenu(leaf, sx, sy); }, 650);
        const mv = (ev) => { const t = ev.touches[0]; if (t && Math.hypot(t.clientX - sx, t.clientY - sy) > 10) { clearTimeout(lp); lp = null; } };
        const up = () => { clearTimeout(lp); lp = null; term.removeEventListener("touchmove", mv); term.removeEventListener("touchend", up); term.removeEventListener("touchcancel", up); };
        term.addEventListener("touchmove", mv, { passive: true }); term.addEventListener("touchend", up); term.addEventListener("touchcancel", up);
      }, { passive: true });
      term.addEventListener("wheel", (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoom(leaf, e.deltaY < 0 ? 1 : -1); }, { passive: false });
    }
    let charCache = {};
    function updateCaret(leaf) {
      const c = leaf.caret, inp = leaf.sess && leaf.sess.input; if (!c || !inp || !leaf.el.classList.contains("tx-cur-custom")) return;
      const cs = getComputedStyle(inp); const key = cs.font;
      let w = charCache[key];
      if (!w) { try { const cv = updateCaret.cv || (updateCaret.cv = document.createElement("canvas")); const ctx = cv.getContext("2d"); ctx.font = key; w = ctx.measureText("MMMMMMMMMM").width / 10; } catch (_) { w = parseFloat(cs.fontSize) * 0.6; } charCache[key] = w; }
      const pos = inp.selectionStart == null ? inp.value.length : inp.selectionStart;
      const x = inp.offsetLeft + pos * w - inp.scrollLeft;
      const lh = inp.offsetHeight || parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
      c.style.left = Math.min(x, inp.offsetLeft + inp.clientWidth - 2) + "px"; c.style.top = inp.offsetTop + "px"; c.style.width = Math.max(2, w) + "px"; c.style.height = lh + "px";
    }
    function selectionIn(leaf) {
      try { const s = window.getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return ""; const r = s.getRangeAt(0); if (!leaf.sess.el.contains(r.commonAncestorContainer)) return ""; return String(s); } catch (_) { return ""; }
    }
    function copyOnSelect(leaf) {
      if (!settings().copyOnSelect) return;
      const t = selectionIn(leaf); if (!t || t === leaf.lastCopied) return;
      leaf.lastCopied = t; copyText(t).then((ok) => toast(ok ? "Copied to clipboard" : "Copied (Terminal clipboard)"));
    }
    function setActivePane(leaf, viaPointer) {
      const t = leaf.tab; if (!t) return;
      t.activePane = leaf;
      leavesOf(t.root).forEach((l) => l.el.classList.toggle("tx-active", l === leaf));
      refreshTab(t);
      if (!viaPointer) focusPane(leaf); else setTimeout(() => { if (!selectionIn(leaf) && !overlayOpen() && !(document.activeElement && document.activeElement.closest && document.activeElement.closest(".tx-find"))) leaf.sess.focus(); }, 0);
      persistSoon();
    }
    function focusPane(leaf) {
      if (!leaf || !leaf.sess) return;
      leavesOf(leaf.tab && leaf.tab.root).forEach((l) => l.el.classList.toggle("tx-active", l === leaf));
      if (!overlayOpen()) leaf.sess.focus();
      updateCaret(leaf);
    }
    function render(t) {
      const page = t.page; page.textContent = "";
      const multi = leavesOf(t.root).length > 1;
      page.classList.toggle("tx-multi", multi);
      if (t.zoomed && leavesOf(t.root).includes(t.zoomed)) { t.zoomed.el.style.flex = "1 1 0"; page.appendChild(t.zoomed.el); page.classList.remove("tx-multi"); }
      else { t.zoomed = null; const root = build(t.root, t); root.style.flex = "1 1 0"; page.appendChild(root); }
      leavesOf(t.root).forEach((l) => { l.tab = t; l.el.classList.toggle("tx-active", l === t.activePane); const term = l.sess.el; requestAnimationFrame(() => { term.scrollTop = term.scrollHeight; updateCaret(l); }); });
      updateSeeThrough();
    }
    function build(n, t) {
      if (n.type === "leaf") { n.parent = n.parent || null; return n.el; }
      const box = document.createElement("div"); box.className = "tx-split " + (n.dir === "lr" ? "tx-lr" : "tx-tb");
      const a = build(n.a, t), b = build(n.b, t);
      n.a.parent = n; n.b.parent = n;
      a.style.flex = `${n.ratio} 1 0`; b.style.flex = `${1 - n.ratio} 1 0`;
      const d = el(`<div class="tx-divider" role="separator" aria-orientation="${n.dir === "lr" ? "vertical" : "horizontal"}" aria-label="Resize panes"></div>`);
      d.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation(); try { d.setPointerCapture(e.pointerId); } catch (_) {} d.classList.add("tx-on");
        const r = box.getBoundingClientRect();
        const mv = (ev) => { const ratio = n.dir === "lr" ? (ev.clientX - r.left) / r.width : (ev.clientY - r.top) / r.height; n.ratio = clamp(ratio, 0.08, 0.92); a.style.flex = `${n.ratio} 1 0`; b.style.flex = `${1 - n.ratio} 1 0`; leavesOf(n).forEach(updateCaret); };
        const up = () => { d.classList.remove("tx-on"); d.removeEventListener("pointermove", mv); d.removeEventListener("pointerup", up); d.removeEventListener("pointercancel", up); persistSoon(); };
        d.addEventListener("pointermove", mv); d.addEventListener("pointerup", up); d.addEventListener("pointercancel", up);
      });
      box.append(a, d, b); n.el = box;
      return box;
    }
    function newTab(profile, o2) {
      o2 = o2 || {};
      profile = profile || defaultProfile();
      const t = makeTab("term");
      const leaf = newLeaf(profile, o2);
      t.root = leaf; t.activePane = leaf; leaf.tab = t;
      if (o2.title) t.title = o2.title; if (o2.color && HEX_RE.test(o2.color)) t.color = o2.color;
      render(t);
      addTab(t, o2.at);
      return t;
    }
    function split(o2) {
      const t = self.active; if (!t || t.kind !== "term") return null;
      const src = t.activePane; if (!src) return null;
      t.zoomed = null;
      const dup = o2.splitMode === "duplicate" || (!o2.profile && o2.splitMode !== "default");
      const profile = o2.profile || (dup ? profileBy(src.guid) : defaultProfile()) || defaultProfile();
      const leaf = newLeaf(profile, { cwd: dup && profile.guid === src.guid ? src.sess.cwd() : null });
      if (dup) { leaf.fontDelta = src.fontDelta; leaf.scheme = src.scheme; applyPane(leaf); }
      let dir = o2.split;
      if (!dir || dir === "auto") { const r = src.el.getBoundingClientRect(); dir = r.width >= r.height * 1.6 ? "right" : "down"; }
      const node = { type: "split", dir: dir === "right" || dir === "left" ? "lr" : "tb", ratio: clamp(o2.size ? 1 - o2.size : 0.5, 0.1, 0.9), a: src, b: leaf, parent: src.parent };
      if (dir === "left" || dir === "up") { node.a = leaf; node.b = src; node.ratio = 1 - node.ratio; }
      replaceNode(t, src, node);
      leaf.tab = t; t.activePane = leaf;
      render(t); setActivePane(leaf);
      return leaf;
    }
    function replaceNode(t, old, neu) {
      const par = old.parent;
      if (!par) t.root = neu; else if (par.a === old) par.a = neu; else par.b = neu;
      neu.parent = par || null;
      if (neu.type === "split") { neu.a.parent = neu; neu.b.parent = neu; }
    }
    function closePane(leaf) {
      const t = leaf.tab; if (!t) return;
      try { leaf.sess.dispose(); } catch (_) {}
      if (t.root === leaf) { closeTab(t, true); return; }
      const par = leaf.parent, other = par.a === leaf ? par.b : par.a;
      replaceNode(t, par, other);
      if (t.zoomed === leaf) t.zoomed = null;
      const next = leavesOf(other)[0];
      t.activePane = t.activePane === leaf || !leavesOf(t.root).includes(t.activePane) ? next : t.activePane;
      render(t); if (self.active === t) setActivePane(t.activePane); else refreshTab(t);
    }
    function moveFocus(dir) {
      const t = self.active; if (!t || t.kind !== "term") return;
      const cur = t.activePane; const ls = leavesOf(t.root); if (ls.length < 2) return;
      if (t.zoomed) { t.zoomed = null; render(t); }
      const r = cur.el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let best = null, bd = Infinity;
      ls.forEach((l) => {
        if (l === cur) return; const q = l.el.getBoundingClientRect();
        const ovY = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 2, ovX = Math.min(r.right, q.right) - Math.max(r.left, q.left) > 2;
        let d = null;
        if (dir === "left" && q.right <= r.left + 3 && ovY) d = r.left - q.right;
        if (dir === "right" && q.left >= r.right - 3 && ovX === false && ovY) d = q.left - r.right;
        if (dir === "up" && q.bottom <= r.top + 3 && ovX) d = r.top - q.bottom;
        if (dir === "down" && q.top >= r.bottom - 3 && ovX) d = q.top - r.bottom;
        if (d == null) return;
        d += Math.abs((dir === "left" || dir === "right" ? (q.top + q.height / 2) - cy : (q.left + q.width / 2) - cx)) / 1000;
        if (d < bd) { bd = d; best = l; }
      });
      if (best) setActivePane(best);
    }
    function resizePane(dir) {
      const t = self.active; if (!t || t.kind !== "term") return;
      let n = t.activePane, want = dir === "left" || dir === "right" ? "lr" : "tb";
      while (n && n.parent && n.parent.dir !== want) n = n.parent;
      const par = n && n.parent; if (!par) return;
      const delta = (dir === "left" || dir === "up") ? -0.05 : 0.05;
      par.ratio = clamp(par.ratio + delta, 0.08, 0.92);
      par.a.el.style.flex = `${par.ratio} 1 0`; par.b.el.style.flex = `${1 - par.ratio} 1 0`;
      leavesOf(par).forEach(updateCaret); persistSoon();
    }
    function zoom(leaf, d) {
      if (!leaf) return;
      const p = profileBy(leaf.guid) || defaultProfile(); const base = prop(p, "fontSize");
      leaf.fontDelta = d === 0 ? 0 : clamp(base + leaf.fontDelta + d, 4, 96) - base;
      applyPane(leaf); const term = leaf.sess.el; term.scrollTop = term.scrollHeight;
      toast(`Font size ${base + leaf.fontDelta}`);
    }
    function bell(leaf) {
      const p = profileBy(leaf.guid) || defaultProfile(); const st = [].concat(prop(p, "bellStyle"));
      const has = (x) => st.includes(x) || st.includes("all");
      if (st.includes("none")) return;
      if (has("audible")) beep();
      if (has("window")) { leaf.el.classList.remove("tx-flash"); void leaf.el.offsetWidth; leaf.el.classList.add("tx-flash"); setTimeout(() => leaf.el.classList.remove("tx-flash"), 400); }
      if (has("taskbar") || (leaf.tab && leaf.tab !== self.active)) { if (leaf.tab) { const t = leaf.tab; t.tabEl.classList.add("tx-belled"); if (t === self.active) setTimeout(() => { if (t === self.active) t.tabEl.classList.remove("tx-belled"); }, 2500); } }
    }
    function updateSeeThrough() {
      const t = self.active; const any = !!(t && t.kind === "term" && leavesOf(t.root).some((l) => l.translucent));
      win.classList.toggle("tx-see-through", any);
    }

    // ================================================================ find
    function openFind(leaf) {
      leaf = leaf || (self.active && self.active.activePane); if (!leaf) return;
      if (leaf.find) { leaf.find.input.focus(); leaf.find.input.select(); return; }
      const bar = el(`<div class="tx-find" role="search"><input type="search" placeholder="Find" aria-label="Find" spellcheck="false"><button type="button" data-a="case" title="Match case" aria-label="Match case" aria-pressed="false">Aa</button><span class="tx-find-n" aria-live="polite"></span><button type="button" data-a="prev" title="Find previous (Shift+Enter)" aria-label="Previous match">&#x2191;</button><button type="button" data-a="next" title="Find next (Enter)" aria-label="Next match">&#x2193;</button><button type="button" data-a="close" title="Close (Esc)" aria-label="Close find">&#x2715;</button></div>`);
      leaf.el.appendChild(bar);
      const f = leaf.find = { bar, input: bar.querySelector("input"), marks: [], idx: -1, cs: false };
      const count = bar.querySelector(".tx-find-n");
      const clear = () => { f.marks.forEach((m) => { const p = m.parentNode; if (!p) return; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); }); f.marks = []; f.idx = -1; };
      const go = (i) => { if (!f.marks.length) { count.textContent = f.input.value ? "0/0" : ""; return; } f.marks.forEach((m) => m.classList.remove("tx-hl-cur")); f.idx = (i + f.marks.length) % f.marks.length; const m = f.marks[f.idx]; m.classList.add("tx-hl-cur"); const term = leaf.sess.el, tr = term.getBoundingClientRect(), mr = m.getBoundingClientRect(); if (mr.top < tr.top + 30 || mr.bottom > tr.bottom - 4) term.scrollTop += mr.top - tr.top - tr.height / 2; count.textContent = `${f.idx + 1}/${f.marks.length}`; };
      const search = () => {
        clear(); const q = f.input.value; if (!q) { count.textContent = ""; return; }
        const root = leaf.sess.el; const needle = f.cs ? q : q.toLowerCase();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode.closest(".wt-row,.tx-find,script,style") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
        const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach((n) => {
          const text = n.nodeValue; const hay = f.cs ? text : text.toLowerCase(); let i = hay.indexOf(needle); if (i < 0) return;
          const frag = document.createDocumentFragment(); let last = 0;
          while (i >= 0) { frag.appendChild(document.createTextNode(text.slice(last, i))); const m = document.createElement("mark"); m.className = "tx-hl"; m.textContent = text.slice(i, i + q.length); frag.appendChild(m); f.marks.push(m); last = i + q.length; i = hay.indexOf(needle, last); }
          frag.appendChild(document.createTextNode(text.slice(last))); n.parentNode.replaceChild(frag, n);
        });
        go(f.marks.length - 1);   // like Windows Terminal: start from the most recent output
      };
      f.input.addEventListener("input", search);
      f.input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); go(f.idx + (e.shiftKey ? -1 : 1)); } else if (e.key === "Escape") { e.preventDefault(); f.close(); } });
      bar.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const a = b.dataset.a; if (a === "next") go(f.idx + 1); else if (a === "prev") go(f.idx - 1); else if (a === "close") f.close(); else if (a === "case") { f.cs = !f.cs; b.classList.toggle("on", f.cs); b.setAttribute("aria-pressed", String(f.cs)); search(); } });
      bar.addEventListener("pointerdown", (e) => e.stopPropagation());
      f.close = () => { clear(); bar.remove(); leaf.find = null; leaf.sess.focus(); };
      f.search = search;
      const sel = selectionIn(leaf); if (sel && sel.length < 80 && !/\n/.test(sel)) { f.input.value = sel; search(); }
      f.input.focus();
    }

    // ================================================================ paste
    function doPaste(leaf) {
      leaf = leaf || (self.active && self.active.activePane); if (!leaf) return;
      readClip().then((txt) => {
        if (!txt) { toast("Clipboard is empty (or the browser blocked reading it). Long-press in the command line to paste."); leaf.sess.focus(); return; }
        const text = String(txt).replace(/\r\n?/g, "\n");
        if (!text.includes("\n")) { leaf.sess.insert(text); leaf.sess.focus(); return; }
        const go = () => {
          const lines = text.split("\n"); const last = lines.pop();
          if (lines.length) { lines[0] = leaf.sess.input.value + lines[0]; leaf.sess.input.value = ""; }
          leaf.sess.run(lines).then(() => { if (last) leaf.sess.insert(last); leaf.sess.focus(); });
        };
        if (settings().multiLinePasteWarning) confirmDlg("Warning", "You are about to paste text that contains multiple lines. If you paste this text into your shell, it may result in the unexpected execution of commands. Do you wish to continue?", "Paste anyway", go, text.slice(0, 600));
        else go();
      });
    }
    function doCopy(leaf) {
      leaf = leaf || (self.active && self.active.activePane); if (!leaf) return;
      const t = selectionIn(leaf); if (!t) { toast("Select some text first"); return; }
      copyText(t).then(() => toast("Copied"));
    }

    // ================================================================ overlays: menus, palette, dialogs, toast
    let layer = null;
    function overlayOpen() { return !!(layer && layer.isConnected); }
    function closeOverlay(refocus) { if (layer) { const l = layer; layer = null; l.remove(); } if (refocus !== false) refocusActive(); }
    function refocusActive() { const t = self.active; if (t && t.kind === "term" && t.activePane) focusPane(t.activePane); }
    function openLayer() {
      closeOverlay(false);
      layer = el(`<div class="tx-layer"></div>`);
      layer.addEventListener("pointerdown", (e) => { if (e.target === layer) { e.preventDefault(); closeOverlay(); } });
      layer.addEventListener("contextmenu", (e) => { if (e.target === layer) e.preventDefault(); });
      win.appendChild(layer);
      return layer;
    }
    function place(m, x, y) {
      const wr = win.getBoundingClientRect(); m.style.left = "0px"; m.style.top = "0px";
      const mr = m.getBoundingClientRect();
      m.style.left = clamp(x - wr.left, 4, Math.max(4, wr.width - mr.width - 4)) + "px";
      m.style.top = clamp(y - wr.top, 4, Math.max(4, wr.height - mr.height - 4)) + "px";
    }
    function menu(items, x, y) {
      const L = openLayer();
      const m = el(`<div class="tx-menu" role="menu"></div>`);
      items.forEach((it) => {
        if (it === "-") { m.appendChild(el(`<div class="tx-sep" role="separator"></div>`)); return; }
        if (it.swatches) { m.appendChild(it.swatches); return; }
        const b = el(`<button class="tx-mi" role="menuitem" type="button"${it.disabled ? " disabled" : ""}><span class="tx-mi-ic">${it.icon || ""}</span><span class="tx-mi-t">${esc(it.label)}</span><span class="tx-mi-k">${esc(it.keys || "")}</span></button>`);
        b.addEventListener("click", (e) => { closeOverlay(false); it.run(e); if (!it.keepFocus) setTimeout(refocusActive, 0); });
        m.appendChild(b);
      });
      L.appendChild(m); place(m, x, y);
      m.addEventListener("keydown", (e) => {
        const bs = Array.from(m.querySelectorAll(".tx-mi:not([disabled])")); const i = bs.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); (bs[i + 1] || bs[0]).focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); (bs[i - 1] || bs[bs.length - 1]).focus(); }
        else if (e.key === "Escape") { e.preventDefault(); closeOverlay(); }
      });
      const first = m.querySelector(".tx-mi:not([disabled])"); if (first) first.focus({ preventScroll: true });
      return m;
    }
    function openDropdown() {
      const r = strip.querySelector(".tx-dd").getBoundingClientRect();
      const items = visibleProfiles().map((p, i) => ({ label: p.name, icon: iconHtml(iconKeyOf(p)), keys: i < 9 ? keysFor({ action: "newTab", index: i }) : "", run: (e) => (e && e.altKey ? split({ split: "auto", profile: p }) : newTab(p)) }));
      items.push("-", { label: "Settings", icon: G.gear, keys: keysFor("openSettings"), run: () => openSettings(), keepFocus: true }, { label: "Command Palette", icon: G.pal, keys: keysFor("commandPalette"), run: () => palette(), keepFocus: true }, { label: "About", icon: G.info, run: () => about(), keepFocus: true });
      menu(items, r.left, r.bottom + 2);
    }
    function swatchBox(cur, onPick) {
      const box = el(`<div><div class="tx-swatches" role="group" aria-label="Tab color"></div><div style="display:flex;gap:6px;padding:2px 8px 6px;align-items:center"><label class="tx-mi" style="padding:4px 6px;min-height:28px;flex:1">Custom… <input type="color" style="margin-left:auto;width:28px;height:22px;border:none;padding:0;background:none" value="${esc(cur && HEX_RE.test(cur) ? cur : "#0078d4")}"></label><button type="button" class="tx-btn" style="min-height:28px;padding:3px 10px">Reset</button></div></div>`);
      const g = box.querySelector(".tx-swatches");
      TAB_COLORS.forEach((c) => { const b = el(`<button type="button" class="tx-sw${cur && lc(cur) === lc(c) ? " sel" : ""}" style="background:${c}" title="${c}" aria-label="${c}"></button>`); b.onclick = () => { onPick(c); closeOverlay(); }; g.appendChild(b); });
      box.querySelector("input[type=color]").addEventListener("change", (e) => { onPick(e.target.value); closeOverlay(); });
      box.querySelector(".tx-btn").onclick = () => { onPick(null); closeOverlay(); };
      return box;
    }
    function tabMenu(t, x, y) {
      const i = self.tabs.indexOf(t);
      const items = [];
      if (t.kind === "term") {
        items.push({ label: "Rename tab", run: () => startRename(t), keepFocus: true });
        items.push({ label: "Duplicate tab", keys: keysFor("duplicateTab"), run: () => duplicateTab(t) });
        items.push({ label: "Split tab", keys: keysFor({ action: "splitPane", split: "auto", splitMode: "duplicate" }), run: () => { selectTab(t); split({ split: "auto", splitMode: "duplicate" }); } });
        items.push("-", { swatches: swatchBox(t.color, (c) => { t.color = c; refreshTab(t); persistSoon(); }) }, "-");
      }
      items.push({ label: "Close tabs to the right", disabled: i >= self.tabs.length - 1, run: () => self.tabs.slice(i + 1).forEach((x) => closeTab(x)) });
      items.push({ label: "Close other tabs", disabled: self.tabs.length < 2, run: () => self.tabs.filter((x) => x !== t).forEach((x) => closeTab(x)) });
      items.push({ label: "Close tab", keys: keysFor("closePane"), run: () => closeTab(t) });
      menu(items, x, y);
    }
    function paneMenu(leaf, x, y) {
      const sel = selectionIn(leaf);
      menu([
        { label: "Copy", keys: keysFor("copy"), disabled: !sel, run: () => copyText(sel).then(() => toast("Copied")) },
        { label: "Paste", keys: keysFor("paste"), run: () => doPaste(leaf), keepFocus: true },
        { label: "Find", keys: keysFor("find"), run: () => openFind(leaf), keepFocus: true },
        "-",
        { label: "Split pane right", keys: keysFor({ action: "splitPane", split: "right" }), run: () => { setActivePane(leaf); split({ split: "right", splitMode: "duplicate" }); } },
        { label: "Split pane down", keys: keysFor({ action: "splitPane", split: "down" }), run: () => { setActivePane(leaf); split({ split: "down", splitMode: "duplicate" }); } },
        { label: "Clear buffer", run: () => leaf.sess.clear() },
        "-",
        { label: "Close pane", keys: keysFor("closePane"), run: () => closePane(leaf) },
      ], x, y);
    }
    function dlg(html, buttons, opt) {
      const L = openLayer();
      const mask = el(`<div class="tx-dlg-mask"><div class="tx-dlg" role="dialog" aria-modal="true"><div class="tx-dlg-b">${html}</div><div class="tx-dlg-f"></div></div></div>`);
      const f = mask.querySelector(".tx-dlg-f");
      let primary = null;
      buttons.forEach((b) => { const bt = el(`<button type="button" class="tx-btn${b.primary ? " tx-primary" : ""}">${esc(b.label)}</button>`); bt.onclick = () => { closeOverlay(); if (b.run) b.run(); }; f.appendChild(bt); if (b.primary) primary = bt; });
      mask.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); closeOverlay(); } });
      L.appendChild(mask);
      const fp = () => { if (primary && primary.isConnected && !mask.contains(document.activeElement)) try { primary.focus({ preventScroll: true }); } catch (_) {} };
      fp(); setTimeout(fp, 0); setTimeout(fp, 120);
      return mask;
    }
    function confirmDlg(title, text, okLabel, ok, pre) { dlg(`<h3>${esc(title)}</h3><p>${esc(text)}</p>${pre ? `<pre>${esc(pre)}</pre>` : ""}`, [{ label: okLabel, primary: true, run: ok }, { label: "Cancel" }]); }
    function about() {
      const T = window.TerminalCore || {};
      dlg(`<div class="tx-about-logo">${PICONS.terminal.replace("<svg ", '<svg width="48" height="48" ')}</div><h3>Windows Terminal</h3><p>Version 1.21.3231.0 (Windows 12 edition)<br>Shell engine ${esc(T.VERSION || "")} — real cmd, PowerShell and bash running on this PC's files.</p><p style="color:var(--tx-ui-dim);font-size:12.5px">Azure Cloud Shell is a simulation and never connects to Azure. Ubuntu needs "Windows Subsystem for Linux" (Control Panel &gt; Programs &gt; Turn Windows features on or off).</p>`, [{ label: "OK", primary: true }]);
    }
    let toastT = null;
    function toast(msg) {
      const old = win.querySelector(".tx-toast"); if (old) old.remove(); clearTimeout(toastT);
      const t = el(`<div class="tx-toast" role="status"></div>`); t.textContent = msg; win.appendChild(t);
      toastT = setTimeout(() => t.remove(), 1900);
    }

    // ---- Command Palette ----
    function paletteItems() {
      const items = [];
      const add = (name, cmd, extra) => items.push(Object.assign({ name, keys: cmd ? keysFor(cmd) : "", run: () => runAction(cmd) }, extra || {}));
      add("New tab", "newTab");
      visibleProfiles().forEach((p, i) => add(`New tab, profile: ${p.name}`, { action: "newTab", index: i }, { icon: iconHtml(iconKeyOf(p)), keys: i < 9 ? keysFor({ action: "newTab", index: i }) : "", run: () => newTab(p) }));
      add("Split pane, split: right", { action: "splitPane", split: "right" });
      add("Split pane, split: down", { action: "splitPane", split: "down" });
      add("Split pane, split: auto, split mode: duplicate", { action: "splitPane", split: "auto", splitMode: "duplicate" });
      visibleProfiles().forEach((p) => items.push({ name: `Split pane, profile: ${p.name}`, keys: "", icon: iconHtml(iconKeyOf(p)), run: () => split({ split: "auto", profile: p }) }));
      add("Close pane", "closePane"); add("Close tab", "closeTab"); add("Close other tabs", "closeOtherTabs"); add("Close tabs after", "closeTabsAfter");
      add("Duplicate tab", "duplicateTab"); add("Next tab", "nextTab"); add("Previous tab", "prevTab");
      add("Rename tab…", "renameTab", { run: () => paletteRename() });
      items.push({ name: "Change tab color…", keys: "", children: () => TAB_COLORS.map((c) => ({ name: c, icon: `<i style="display:block;width:14px;height:14px;border-radius:3px;background:${c}"></i>`, run: () => { if (self.active) { self.active.color = c; refreshTab(self.active); persistSoon(); } } })).concat([{ name: "Reset tab color", run: () => { if (self.active) { self.active.color = null; refreshTab(self.active); persistSoon(); } } }]) });
      items.push({ name: "Select color scheme…", keys: "", children: () => allSchemes().map((sc) => ({ name: sc.name, icon: `<span class="tx-mini-sw">${[sc.background, sc.red, sc.green, sc.blue].map((c) => `<i style="background:${c};width:4px"></i>`).join("")}</span>`, run: () => runAction({ action: "setColorScheme", colorScheme: sc.name }) })) });
      add("Move focus left", { action: "moveFocus", direction: "left" }); add("Move focus right", { action: "moveFocus", direction: "right" }); add("Move focus up", { action: "moveFocus", direction: "up" }); add("Move focus down", { action: "moveFocus", direction: "down" });
      add("Resize pane left", { action: "resizePane", direction: "left" }); add("Resize pane right", { action: "resizePane", direction: "right" });
      add("Toggle pane zoom", "togglePaneZoom");
      add("Toggle fullscreen", "toggleFullscreen");
      add("Increase font size", { action: "adjustFontSize", delta: 1 }); add("Decrease font size", { action: "adjustFontSize", delta: -1 }); add("Reset font size", "resetFontSize");
      add("Find", "find"); add("Copy text", "copy"); add("Paste", "paste"); add("Clear buffer", "clearBuffer"); add("Scroll to top", "scrollToTop"); add("Scroll to bottom", "scrollToBottom");
      add("Open settings", "openSettings"); add("Open settings file (JSON)", { action: "openSettings", target: "settingsFile" });
      add("Open new tab dropdown", "openNewTabDropdown"); add("About", "about");
      return items;
    }
    function fuzzy(q, s) {
      if (!q) return { score: 0, html: esc(s) };
      const L = s.toLowerCase(), Q = q.toLowerCase(); let i = 0, score = 0, last = -2; const hit = [];
      for (let j = 0; j < L.length && i < Q.length; j++) if (L[j] === Q[i]) { hit.push(j); score += j === last + 1 ? 3 : 1; if (j === 0 || /[\s,:]/.test(L[j - 1])) score += 2; last = j; i++; }
      if (i < Q.length) return null;
      let html = ""; for (let j = 0; j < s.length; j++) html += hit.includes(j) ? `<b>${esc(s[j])}</b>` : esc(s[j]);
      return { score: score - s.length * 0.01, html };
    }
    function palette(o3) {
      o3 = o3 || {};
      const L = openLayer();
      const p = el(`<div class="tx-pal" role="dialog" aria-label="Command Palette"><div class="tx-pal-top"><div class="tx-pal-crumb" hidden></div><input class="tx-pal-in" type="text" spellcheck="false" autocomplete="off" aria-label="Type a command name" placeholder="Type a command name…"></div><div class="tx-pal-list" role="listbox"></div></div>`);
      L.appendChild(p);
      const inp = p.querySelector("input"), list = p.querySelector(".tx-pal-list"), crumb = p.querySelector(".tx-pal-crumb");
      const stack = []; let source = paletteItems(), shown = [], sel = 0, textMode = null;
      if (o3.textMode) textMode = o3.textMode;
      function draw() {
        list.textContent = "";
        if (textMode) { crumb.hidden = false; crumb.textContent = textMode.label; list.appendChild(el(`<div class="tx-pal-empty">${esc(textMode.hint)}</div>`)); return; }
        crumb.hidden = !stack.length; crumb.textContent = stack.map((s) => s.name).join(" › ");
        const q = inp.value.trim();
        shown = source.map((it) => ({ it, f: fuzzy(q, it.name) })).filter((x) => x.f).sort((a, b) => (q ? b.f.score - a.f.score : 0));
        sel = clamp(sel, 0, Math.max(0, shown.length - 1));
        if (!shown.length) { list.appendChild(el(`<div class="tx-pal-empty">No matching commands</div>`)); return; }
        shown.forEach((x, i) => {
          const b = el(`<button type="button" class="tx-mi${i === sel ? " sel" : ""}" role="option" aria-selected="${i === sel}"><span class="tx-mi-ic">${x.it.icon || ""}</span><span class="tx-mi-t">${x.f.html}${x.it.children ? " …" : ""}</span><span class="tx-mi-k">${esc(x.it.keys || "")}</span></button>`);
          b.addEventListener("pointerdown", (e) => e.preventDefault());
          b.addEventListener("click", () => choose(x.it));
          list.appendChild(b);
        });
        const s = list.children[sel]; if (s && s.scrollIntoView) s.scrollIntoView({ block: "nearest" });
      }
      function choose(it) {
        if (!it) return;
        if (it.children) { stack.push({ name: it.name.replace(/…$/, ""), source }); source = it.children(); inp.value = ""; sel = 0; draw(); return; }
        if (it.text) { textMode = it.text; inp.value = it.text.value || ""; inp.select(); draw(); return; }
        closeOverlay(false); it.run(); setTimeout(() => { if (!overlayOpen()) refocusActive(); }, 0);
      }
      inp.addEventListener("input", () => { sel = 0; draw(); });
      inp.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (textMode) {
          if (e.key === "Enter") { e.preventDefault(); const v = inp.value; const tm = textMode; closeOverlay(); tm.done(v); }
          else if (e.key === "Escape") { e.preventDefault(); closeOverlay(); }
          return;
        }
        if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); draw(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); draw(); }
        else if (e.key === "Enter") { e.preventDefault(); choose(shown[sel] && shown[sel].it); }
        else if (e.key === "Escape") { e.preventDefault(); closeOverlay(); }
        else if (e.key === "Backspace" && !inp.value && stack.length) { e.preventDefault(); source = stack.pop().source; sel = 0; draw(); }
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && lc(e.key) === "p") { e.preventDefault(); closeOverlay(); }
      });
      if (textMode) { inp.value = textMode.value || ""; }
      draw(); inp.focus(); if (textMode) inp.select();
      return p;
    }
    function paletteRename() {
      const t = self.active; if (!t || t.kind !== "term") return;
      palette({ textMode: { label: "Rename tab", hint: "Type a new tab title and press Enter (empty resets it). Esc cancels.", value: tabTitle(t), done: (v) => { t.title = v.trim() || null; refreshTab(t); persistSoon(); } } });
    }

    // ================================================================ actions
    function duplicateTab(t) {
      t = t || self.active; if (!t || t.kind !== "term") return;
      const src = t.activePane; const p = profileBy(src.guid) || defaultProfile();
      const nt = newTab(p, { cwd: src.sess.cwd(), at: self.tabs.indexOf(t) + 1 });
      nt.color = t.color; nt.title = t.title; const l = nt.activePane; l.scheme = src.scheme; l.fontDelta = src.fontDelta; applyPane(l); refreshTab(nt);
      return nt;
    }
    function toggleFullscreen() {
      const d = document;
      const fsEl = d.fullscreenElement || d.webkitFullscreenElement;
      if (fsEl === win) { (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d); return; }
      const req = win.requestFullscreen || win.webkitRequestFullscreen;
      let r = null; try { r = req ? req.call(win) : null; } catch (_) { r = null; }
      if (!req) { const mx = win.querySelector(".ctl-max"); if (mx) mx.click(); return; }
      if (r && r.catch) r.catch(() => { const mx = win.querySelector(".ctl-max"); if (mx) mx.click(); });
    }
    const onFs = () => win.classList.toggle("tx-fs", (document.fullscreenElement || document.webkitFullscreenElement) === win);
    document.addEventListener("fullscreenchange", onFs); document.addEventListener("webkitfullscreenchange", onFs);
    function runAction(cmd) {
      const name = actName(cmd), a = actArgs(cmd); const t = self.active; const leaf = t && t.kind === "term" ? t.activePane : null;
      switch (name) {
        case "newTab": { let p = null; if (a.index != null) p = visibleProfiles()[a.index]; else if (a.profile) p = profileBy(a.profile); if (a.index != null && !p) return true; newTab(p || defaultProfile(), { dir: a.startingDirectory, title: a.tabTitle, color: a.tabColor }); return true; }
        case "splitPane": { if (!leaf) return false; split({ split: a.split || "auto", splitMode: a.splitMode, profile: a.profile ? profileBy(a.profile) : null, size: a.size }); return true; }
        case "closePane": if (leaf) closePane(leaf); else if (t) closeTab(t); return true;
        case "closeTab": if (t) closeTab(t); return true;
        case "closeOtherTabs": self.tabs.filter((x) => x !== t).forEach((x) => closeTab(x)); return true;
        case "closeTabsAfter": self.tabs.slice(self.tabs.indexOf(t) + 1).forEach((x) => closeTab(x)); return true;
        case "nextTab": case "prevTab": { if (self.tabs.length < 2) return true; const i = self.tabs.indexOf(t); selectTab(self.tabs[(i + (name === "nextTab" ? 1 : -1) + self.tabs.length) % self.tabs.length]); return true; }
        case "duplicateTab": duplicateTab(t); return true;
        case "moveFocus": moveFocus(a.direction || "left"); return true;
        case "resizePane": resizePane(a.direction || "left"); return true;
        case "togglePaneZoom": if (leaf && t) { t.zoomed = t.zoomed ? null : leaf; render(t); focusPane(leaf); } return true;
        case "commandPalette": if (overlayOpen() && layer.querySelector(".tx-pal")) closeOverlay(); else palette(); return true;
        case "find": if (leaf) openFind(leaf); return true;
        case "copy": if (leaf) doCopy(leaf); return true;
        case "paste": if (leaf) doPaste(leaf); return true;
        case "adjustFontSize": if (leaf) zoom(leaf, Number(a.delta) || 1); return true;
        case "resetFontSize": if (leaf) zoom(leaf, 0); return true;
        case "toggleFullscreen": toggleFullscreen(); return true;
        case "openSettings": if (a.target === "settingsFile") openJson(); else openSettings(); return true;
        case "openNewTabDropdown": openDropdown(); return true;
        case "renameTab": if (t && t.kind === "term") startRename(t); return true;
        case "openTabColorPicker": if (t) { const r = t.tabEl.getBoundingClientRect(); tabMenu(t, r.left, r.bottom); } return true;
        case "setColorScheme": if (leaf && schemeBy(a.colorScheme)) { leaf.scheme = schemeBy(a.colorScheme).name; applyPane(leaf); toast("Color scheme: " + leaf.scheme); } return true;
        case "clearBuffer": if (leaf) leaf.sess.clear(); return true;
        case "scrollToTop": if (leaf) leaf.sess.el.scrollTop = 0; return true;
        case "scrollToBottom": if (leaf) leaf.sess.el.scrollTop = leaf.sess.el.scrollHeight; return true;
        case "about": about(); return true;
      }
      return false;
    }
    // Shortcuts only while focus is inside this Terminal window; anything else keeps working globally.
    win.addEventListener("keydown", (e) => {
      if (e.isComposing) return;
      if (e.key === "Escape" && overlayOpen()) { e.preventDefault(); e.stopPropagation(); closeOverlay(); return; }
      const k = keyOf(e); if (!k) return;
      const inOverlay = e.target && e.target.closest && e.target.closest(".tx-layer");
      const typing = e.target && e.target.closest && e.target.closest(".tx-set,.tx-json,.tx-tab-rename,.tx-find");
      const cmd = keymap().get(k); if (!cmd) return;
      const name = actName(cmd);
      if (inOverlay && name !== "commandPalette") return;
      if (typing && !/ctrl|alt/.test(k)) return;
      if (typing && e.target.closest(".tx-json") && /^ctrl\+(=|plus|minus|0|shift\+[cv])$/.test(k)) return;
      if (runAction(cmd)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    // Closing with the window's X: confirm when several tabs are open (user clicks only).
    win.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest(".win-controls .ctl-close"); if (!b || !e.isTrusted) return;
      const n = self.tabs.length;
      if (n > 1 && settings().confirmCloseAllTabs) { e.stopPropagation(); e.preventDefault(); confirmDlg("Close all tabs?", `You're about to close ${n} tabs. Do you want to continue?`, "Close all", () => closeWindowNow()); }
    }, true);
    function closeWindowNow() { saveLayout(); ref.close(); }
    function onWinClosed() {
      if (disposed) return; disposed = true;
      if (!closingFromLastTab) saveLayout();
      self.tabs.forEach((t) => { leavesOf(t.root).forEach((l) => { try { l.sess.dispose(); } catch (_) {} }); if (t.dispose) t.dispose(); });
      themeObs.disconnect(); WINS.delete(self);
      window.removeEventListener("contextmenu", capCtx, true); window.removeEventListener("pointerdown", capDown, true);
      document.removeEventListener("fullscreenchange", onFs); document.removeEventListener("webkitfullscreenchange", onFs);
    }

    // ================================================================ layout persistence
    function ser(n) { return n.type === "leaf" ? { profile: n.guid, cwd: n.sess ? n.sess.cwd() : null, scheme: n.scheme || undefined, fontDelta: n.fontDelta || undefined } : { split: n.dir, ratio: Math.round(n.ratio * 1000) / 1000, a: ser(n.a), b: ser(n.b) }; }
    function saveLayout() {
      if (disposed && !closingFromLastTab) return;
      const tabs = self.tabs.filter((t) => t.kind === "term").map((t) => ({ title: t.title || undefined, color: t.color || undefined, active: t === self.active || undefined, focus: leavesOf(t.root).indexOf(t.activePane), root: ser(t.root) }));
      wtStore().session = tabs.length ? { v: 1, tabs, at: Date.now() } : null; persist();
    }
    let persistT = null;
    function persistSoon() { if (disposed) return; clearTimeout(persistT); persistT = setTimeout(saveLayout, 250); }
    function restoreLayout(sess) {
      let activeTab = null;
      (sess.tabs || []).forEach((td) => {
        try {
          const mk = (n) => {
            if (n && n.split) { const node = { type: "split", dir: n.split === "lr" ? "lr" : "tb", ratio: clamp(Number(n.ratio) || 0.5, 0.08, 0.92), a: mk(n.a), b: mk(n.b) }; node.a.parent = node; node.b.parent = node; return node; }
            const p = profileBy(n && n.profile) || defaultProfile();
            const l = newLeaf(p, { cwd: Array.isArray(n && n.cwd) ? n.cwd : null });
            if (n && n.scheme && schemeBy(n.scheme)) l.scheme = n.scheme; if (n && n.fontDelta) l.fontDelta = clamp(Number(n.fontDelta) || 0, -40, 40); applyPane(l);
            return l;
          };
          const t = makeTab("term"); t.root = mk(td.root); t.root.parent = null;
          const ls = leavesOf(t.root); t.activePane = ls[clamp(td.focus | 0, 0, ls.length - 1)] || ls[0];
          ls.forEach((l) => (l.tab = t));
          t.title = td.title || null; t.color = td.color && HEX_RE.test(td.color) ? td.color : null;
          render(t); self.tabs.push(t); tablist.appendChild(t.tabEl); refreshTab(t);
          if (td.active) activeTab = t;
        } catch (err) { try { console.warn("Terminal: could not restore a tab", err); } catch (_) {} }
      });
      if (self.tabs.length) selectTab(activeTab || self.tabs[0]);
      return self.tabs.length > 0;
    }
    function runStartupActions(str, fallbackProfile) {
      const cmds = parseWtArgs(str); let did = false;
      cmds.forEach((c) => {
        const p = c.profile ? profileBy(c.profile) : c.rest.length ? profileBy(c.rest.join(" ")) || profilesOf().find((x) => engineOf(x).shell === engineOf({ commandline: c.rest.join(" ") }).shell) : null;
        if (c.verb === "nt") { newTab(p || fallbackProfile || defaultProfile(), { dir: c.dir, title: c.title, color: c.color }); did = true; }
        else if (c.verb === "sp") { if (!self.active) { newTab(p || defaultProfile()); did = true; return; } split({ split: c.split || "auto", profile: p || null, splitMode: p ? "default" : "duplicate", size: c.size > 0 && c.size < 1 ? c.size : null }); }
        else if (c.verb === "ft") { const t = self.tabs[clamp(c.target | 0, 0, self.tabs.length - 1)]; if (t) selectTab(t); }
        else if (c.verb === "mf") moveFocus(c.dir2 || "left");
      });
      return did || self.tabs.length > 0;
    }

    // ================================================================ settings UI
    function findTab(kind) { return self.tabs.find((t) => t.kind === kind); }
    function openSettings(page) {
      let t = findTab("settings");
      if (t) { selectTab(t); if (page && t.go) t.go(page); return t; }
      t = makeTab("settings");
      buildSettings(t, page);
      addTab(t, self.tabs.indexOf(self.active) + 1);
      return t;
    }
    function openJson() {
      let t = findTab("json");
      if (t) { selectTab(t); if (t.reload) t.reload(); return t; }
      t = makeTab("json");
      buildJson(t);
      addTab(t, self.tabs.indexOf(self.active) + 1);
      return t;
    }
    function buildSettings(t, startPage) {
      let draft = clone(settings()); let page = startPage || "startup"; let schemeSel = null;
      const root = el(`<div class="tx-set"><nav class="tx-set-nav" aria-label="Settings sections"></nav><div class="tx-set-main"><div class="tx-set-scroll"></div><div class="tx-set-foot"><span class="tx-set-msg"></span><button type="button" class="tx-btn" data-a="discard">Discard changes</button><button type="button" class="tx-btn tx-primary" data-a="save">Save</button></div></div></div>`);
      t.page.appendChild(root);
      const nav = root.querySelector(".tx-set-nav"), main = root.querySelector(".tx-set-scroll"), msg = root.querySelector(".tx-set-msg");
      const dirty = () => JSON.stringify(draft) !== JSON.stringify(settings());
      t.dirty = dirty;
      const touch = () => { msg.classList.remove("tx-err"); msg.textContent = dirty() ? "You have unsaved changes." : ""; };
      root.querySelector('[data-a="save"]').onclick = () => {
        const v = validate(draft);
        if (v.errors.length) { msg.classList.add("tx-err"); msg.innerHTML = `Can't save: ${esc(v.errors[0])}${v.errors.length > 1 ? ` (+${v.errors.length - 1} more)` : ""}`; return; }
        draft = v.value; saveSettings(clone(draft)); msg.classList.remove("tx-err"); msg.textContent = "Settings saved."; toast("Settings saved"); renderNav(); renderPage();
      };
      root.querySelector('[data-a="discard"]').onclick = () => { draft = clone(settings()); renderNav(); renderPage(); msg.textContent = "Changes discarded."; };
      t.go = (p) => { page = p; renderNav(); renderPage(); };
      t.refresh = () => { if (!dirty()) draft = clone(settings()); renderNav(); renderPage(); };
      t.focus = () => { const f = nav.querySelector(".sel"); if (f) f.focus({ preventScroll: true }); };
      function renderNav() {
        const items = [["startup", "Startup"], ["interaction", "Interaction"], ["appearance", "Appearance"], ["schemes", "Color schemes"], ["actions", "Actions"]];
        nav.innerHTML = items.map(([k, n]) => `<button type="button" class="tx-mi${page === k ? " sel" : ""}" data-p="${k}"><span class="tx-mi-t">${n}</span></button>`).join("") +
          `<div class="tx-set-h">Profiles</div><button type="button" class="tx-mi${page === "p:defaults" ? " sel" : ""}" data-p="p:defaults"><span class="tx-mi-ic">${G.gear}</span><span class="tx-mi-t">Defaults</span></button>` +
          draft.profiles.list.map((p) => `<button type="button" class="tx-mi${page === "p:" + p.guid ? " sel" : ""}" data-p="p:${esc(p.guid)}"><span class="tx-mi-ic">${iconHtml(iconKeyOf(p))}</span><span class="tx-mi-t">${esc(p.name || "(unnamed)")}${p.hidden ? " (hidden)" : ""}</span></button>`).join("") +
          `<button type="button" class="tx-mi" data-p="add"><span class="tx-mi-ic">${G.plus.replace('class="tx-g"', 'class="tx-g" style="stroke:currentColor;fill:none"')}</span><span class="tx-mi-t">Add a new profile</span></button><div class="tx-sep"></div><button type="button" class="tx-mi" data-p="json"><span class="tx-mi-ic">${G.json}</span><span class="tx-mi-t">Open JSON file</span></button>`;
        nav.querySelectorAll("[data-p]").forEach((b) => b.onclick = () => {
          const p = b.dataset.p;
          if (p === "json") { if (dirty()) { confirmDlg("Unsaved changes", "Save or discard your changes in the Settings tab first, or they won't be in settings.json.", "Open anyway", () => openJson()); } else openJson(); return; }
          if (p === "add") { const np = { guid: newGuid(), name: "New profile", commandline: "cmd.exe", hidden: false }; draft.profiles.list.push(np); page = "p:" + np.guid; touch(); renderNav(); renderPage(); return; }
          page = p; renderNav(); renderPage();
        });
      }
      const row = (label, desc, ctl) => { const r = el(`<div class="tx-row"><div class="tx-row-l"><b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</div><div class="tx-row-c"></div></div>`); [].concat(ctl).forEach((c) => r.querySelector(".tx-row-c").appendChild(c)); return r; };
      const sel = (opts, val, on, aria) => { const s = el(`<select class="tx-sel" aria-label="${esc(aria || "")}">${opts.map(([v, n]) => `<option value="${esc(v)}"${String(v) === String(val) ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`); s.onchange = () => { on(s.value); touch(); }; return s; };
      const tog = (val, on, aria) => { const c = el(`<input type="checkbox" class="tx-tog" role="switch" aria-label="${esc(aria || "")}"${val ? " checked" : ""}>`); c.onchange = () => { on(c.checked); touch(); }; return c; };
      const txt = (val, on, aria, cls) => { const i = el(`<input class="tx-in ${cls || ""}" spellcheck="false" aria-label="${esc(aria || "")}">`); i.value = val == null ? "" : val; i.oninput = () => { on(i.value); touch(); }; return i; };
      const numIn = (val, min, max, on, aria) => { const i = el(`<input type="number" class="tx-in" min="${min}" max="${max}" aria-label="${esc(aria || "")}">`); i.value = val; i.oninput = () => { const n = Number(i.value); const ok = i.value !== "" && n >= min && n <= max; i.classList.toggle("tx-bad", !ok); if (ok) { on(n); touch(); } }; return i; };
      function renderPage() {
        main.textContent = ""; main.scrollTop = 0;
        const H = (s) => main.appendChild(el(`<h2>${esc(s)}</h2>`));
        const S = draft;
        if (page === "startup") {
          H("Startup");
          main.appendChild(row("Default profile", "The profile that opens with the + button, Ctrl+Shift+T and 'wt'.", sel(S.profiles.list.map((p) => [p.guid, p.name]), (profileBy(S.defaultProfile, S) || {}).guid, (v) => (S.defaultProfile = v), "Default profile")));
          main.appendChild(row("When Terminal starts", "\"Open windows from a previous session\" brings back your tabs and panes (not their text).", sel([["defaultProfile", "Open a tab with the default profile"], ["persistedWindowLayout", "Open windows from a previous session"]], S.firstWindowPreference || "defaultProfile", (v) => (S.firstWindowPreference = v), "When Terminal starts")));
          main.appendChild(row("Launch mode", "How the window opens.", sel([["default", "Default"], ["maximized", "Maximized"], ["fullscreen", "Full screen"]], S.launchMode || "default", (v) => (S.launchMode = v), "Launch mode")));
          main.appendChild(row("Startup actions", 'Run when Terminal opens with the default profile, e.g. new-tab -p "Ubuntu" ; split-pane -V -p "Command Prompt"', txt(S.startupActions || "", (v) => (S.startupActions = v), "Startup actions", "tx-wide")));
        } else if (page === "interaction") {
          H("Interaction");
          main.appendChild(row("Automatically copy selection to clipboard", "Selecting text in a pane copies it.", tog(S.copyOnSelect !== false, (v) => (S.copyOnSelect = v), "Copy on select")));
          main.appendChild(row("Warn when closing more than one tab", "", tog(S.confirmCloseAllTabs !== false, (v) => (S.confirmCloseAllTabs = v), "Warn when closing tabs")));
          main.appendChild(row("Warn when pasting text with several lines", "", tog(S.multiLinePasteWarning !== false, (v) => (S.multiLinePasteWarning = v), "Multi-line paste warning")));
        } else if (page === "appearance") {
          H("Appearance");
          main.appendChild(row("Application theme", "Use Windows theme follows Windows 12's light/dark mode.", sel([["system", "Use Windows theme"], ["dark", "Dark"], ["light", "Light"]], S.theme || "system", (v) => (S.theme = v), "Application theme")));
          main.appendChild(row("Tab width mode", "", sel([["equal", "Equal"], ["titleLength", "Size to contents"], ["compact", "Compact"]], S.tabWidthMode || "equal", (v) => (S.tabWidthMode = v), "Tab width mode")));
          main.appendChild(row("Use acrylic in the tab row", "", tog(!!S.useAcrylicInTabRow, (v) => (S.useAcrylicInTabRow = v), "Acrylic tab row")));
        } else if (page === "schemes") renderSchemes();
        else if (page === "actions") {
          H("Actions");
          main.appendChild(el(`<p style="margin:0 0 12px;color:var(--tx-ui-dim)">Keyboard shortcuts work while Terminal has focus. Change them in settings.json ("actions": [{ "command": "newTab", "keys": "ctrl+t" }], or "command": "unbound" to remove one).</p>`));
          keymap().forEach((cmd, k) => { const nm = actName(cmd); const args = actArgs(cmd); delete args.action; const extra = Object.keys(args).map((x) => `${x}: ${args[x]}`).join(", "); main.appendChild(row(nm + (extra ? ` (${extra})` : ""), "", el(`<span class="tx-act-k">${esc(prettyKeys(k))}</span>`))); });
        } else if (page.startsWith("p:")) renderProfile(page.slice(2));
      }
      function renderProfile(guid) {
        const S = draft; const isDef = guid === "defaults";
        const p = isDef ? S.profiles.defaults : S.profiles.list.find((x) => x.guid === guid);
        if (!p) { page = "startup"; renderNav(); renderPage(); return; }
        main.appendChild(el(`<h2>${esc(isDef ? "Defaults" : p.name || "Profile")}</h2>`));
        if (isDef) main.appendChild(el(`<p style="margin:-6px 0 12px;color:var(--tx-ui-dim)">These settings apply to every profile unless the profile sets its own.</p>`));
        const set = (k, v) => { if (v === "" || v === null || v === undefined) delete p[k]; else p[k] = v; };
        const inherit = (k) => { if (isDef) return null; const q = Object.assign({}, p); delete q[k]; if (k === "fontSize") delete q.font; return prop(q, k, S); };
        if (!isDef) {
          main.appendChild(row("Name", "", txt(p.name, (v) => { p.name = v; const b = nav.querySelector(`[data-p="p:${CSS.escape(guid)}"] .tx-mi-t`); if (b) b.textContent = v; }, "Name")));
          const cmdIn = txt(p.commandline || "", (v) => { set("commandline", v); eng.textContent = "Runs: " + engineLabel(p); }, "Command line", "tx-wide");
          const eng = el(`<small style="display:block;color:var(--tx-ui-dim);margin-top:4px"></small>`); eng.textContent = "Runs: " + engineLabel(p);
          const r = row("Command line", "cmd.exe, powershell.exe, pwsh.exe, wsl.exe -d Ubuntu, wsl.exe -d Arch", cmdIn); r.querySelector(".tx-row-l").appendChild(eng); main.appendChild(r);
          main.appendChild(row("Icon", "A built-in icon, 1–3 characters, or an image URL.", [sel([["", "(automatic)"]].concat(ICON_KEYS.map((k) => [k, k])).concat(p.icon && !PICONS[lc(p.icon)] ? [[p.icon, "custom: " + p.icon]] : []), p.icon || "", (v) => { set("icon", v); renderNav(); }, "Icon")]));
          main.appendChild(row("Tab title", "Replaces the profile name in the tab.", txt(p.tabTitle || "", (v) => set("tabTitle", v.trim() || undefined), "Tab title")));
          main.appendChild(row("Hide profile from dropdown", "", tog(!!p.hidden, (v) => { p.hidden = v; renderNav(); }, "Hide profile")));
          const tc = el(`<input type="color" aria-label="Tab color" style="width:40px;height:30px;border:none;background:none;padding:0">`); tc.value = p.tabColor && HEX_RE.test(p.tabColor) ? p.tabColor : "#0078d4";
          tc.oninput = () => { p.tabColor = tc.value; touch(); };
          const clr = el(`<button type="button" class="tx-btn">None</button>`); clr.onclick = () => { delete p.tabColor; touch(); };
          main.appendChild(row("Tab color", p.tabColor ? "" : "No color set.", [tc, clr]));
        }
        const dirIn = txt(p.startingDirectory == null ? "" : p.startingDirectory, (v) => { set("startingDirectory", v || undefined); checkDir(); }, "Starting directory", "tx-wide");
        const dirMsg = el(`<small style="display:block;margin-top:4px"></small>`);
        const checkDir = () => { const v = p.startingDirectory; if (!v || /^%userprofile%$/i.test(v) || v === "~") { dirMsg.textContent = "Your user folder (%USERPROFILE%)."; dirMsg.style.color = "var(--tx-ui-dim)"; dirIn.classList.remove("tx-bad"); return; } const T = window.TerminalCore; const ok = T && T._resolveDir ? T._resolveDir(v.replace(/%userprofile%/ig, "~")) : null; dirMsg.textContent = ok ? "Found: " + ok : "Not found on this PC — Terminal will start in your user folder."; dirMsg.style.color = ok ? "var(--tx-ui-dim)" : "var(--tx-danger)"; dirIn.classList.toggle("tx-bad", !ok); };
        const dr = row("Starting directory", "%USERPROFILE%, ~, or a folder like C:\\Users\\You\\Documents", dirIn); dr.querySelector(".tx-row-l").appendChild(dirMsg); main.appendChild(dr); checkDir();
        main.appendChild(el(`<h4>Appearance</h4>`));
        main.appendChild(row("Color scheme", isDef ? "" : `Default: ${inherit("colorScheme")}`, sel([["", "(use default)"]].concat(allSchemes(S).map((x) => [x.name, x.name])), p.colorScheme || "", (v) => set("colorScheme", v || undefined), "Color scheme")));
        const fs = (p.font && p.font.size) || "";
        main.appendChild(row("Font size", isDef ? "Points (default 12). Ctrl+= / Ctrl+- zoom one pane." : `Default: ${inherit("fontSize")}`, numIn(fs || prop(p, "fontSize", S), 4, 96, (v) => { p.font = Object.assign({}, p.font || {}, { size: v }); }, "Font size")));
        main.appendChild(row("Font face", "", txt((p.font && p.font.face) || "", (v) => { p.font = Object.assign({}, p.font || {}); if (v.trim()) p.font.face = v.trim(); else delete p.font.face; if (!Object.keys(p.font).length) delete p.font; }, "Font face")));
        main.appendChild(row("Cursor shape", "", sel([["", "(use default)"]].concat(CURSORS.map((c) => [c, CURSOR_NAMES[c]])), p.cursorShape || "", (v) => set("cursorShape", v || undefined), "Cursor shape")));
        const op = p.opacity != null ? p.opacity : prop(p, "opacity", S);
        const rg = el(`<input type="range" class="tx-range" min="0" max="100" step="1" aria-label="Background opacity">`); rg.value = op; const rv = el(`<span style="min-width:38px;text-align:right">${op}%</span>`);
        rg.oninput = () => { p.opacity = Number(rg.value); rv.textContent = rg.value + "%"; touch(); };
        main.appendChild(row("Background opacity", "Below 100% you can see what's behind the window.", [rg, rv]));
        main.appendChild(row("Enable acrylic material", "Blurs what shows through (needs opacity below 100%).", tog(!!prop(p, "useAcrylic", S), (v) => (p.useAcrylic = v), "Acrylic")));
        main.appendChild(row("Padding", "Pixels around the text, e.g. 8 or 8, 4", txt(p.padding == null ? "" : String(p.padding), (v) => set("padding", v.trim() || undefined), "Padding")));
        main.appendChild(el(`<h4>Advanced</h4>`));
        const bs = p.bellStyle == null ? "" : [].concat(p.bellStyle).length > 1 ? "all" : [].concat(p.bellStyle)[0];
        main.appendChild(row("Bell notification style", "When a program rings the bell (printf '\\a' in bash, \"`a\" in PowerShell).", sel([["", "(use default)"]].concat(BELLS.map((b) => [b, BELL_NAMES[b]])), bs, (v) => set("bellStyle", v || undefined), "Bell style")));
        if (!isDef) {
          const acts = el(`<div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap"></div>`);
          const open = el(`<button type="button" class="tx-btn">Open in a new tab</button>`); open.onclick = () => { const live = profileBy(p.guid); if (live) newTab(live); else toast("Save first to use this profile"); };
          const dup = el(`<button type="button" class="tx-btn">Duplicate</button>`); dup.onclick = () => { const np = clone(p); np.guid = newGuid(); np.name = (p.name || "Profile") + " (copy)"; S.profiles.list.push(np); page = "p:" + np.guid; touch(); renderNav(); renderPage(); };
          const mkDef = el(`<button type="button" class="tx-btn">Make default</button>`); mkDef.onclick = () => { S.defaultProfile = p.guid; touch(); toast(p.name + " will be the default after you save"); };
          const del = el(`<button type="button" class="tx-btn tx-danger">Delete profile</button>`);
          del.onclick = () => { if (S.profiles.list.length < 2) { toast("You need at least one profile"); return; } confirmDlg("Delete this profile?", `"${p.name}" will be removed when you save.`, "Delete", () => { S.profiles.list = S.profiles.list.filter((x) => x !== p); if (lc(S.defaultProfile) === lc(p.guid) || lc(S.defaultProfile) === lc(p.name)) S.defaultProfile = S.profiles.list[0].guid; page = "p:defaults"; touch(); renderNav(); renderPage(); }); };
          acts.append(open, dup, mkDef, del); main.appendChild(acts);
        }
      }
      function renderSchemes() {
        const S = draft; main.appendChild(el(`<h2>Color schemes</h2>`));
        const wrap = el(`<div class="tx-schemes"><div class="tx-scheme-list" role="listbox" aria-label="Color schemes"></div><div class="tx-scheme-ed"></div></div>`); main.appendChild(wrap);
        const listEl = wrap.querySelector(".tx-scheme-list"), ed = wrap.querySelector(".tx-scheme-ed");
        const schemes = allSchemes(S); if (!schemeSel || !schemeBy(schemeSel, S)) schemeSel = (S.profiles.defaults && S.profiles.defaults.colorScheme) || "Campbell";
        const defName = (S.profiles.defaults && S.profiles.defaults.colorScheme) || "Campbell";
        schemes.forEach((sc) => { const b = el(`<button type="button" class="tx-mi${lc(sc.name) === lc(schemeSel) ? " sel" : ""}" role="option"><span class="tx-mini-sw">${[sc.background, sc.foreground, sc.red, sc.green, sc.yellow, sc.blue, sc.purple, sc.cyan].map((c) => `<i style="background:${c}"></i>`).join("")}</span><span class="tx-mi-t">${esc(sc.name)}${lc(sc.name) === lc(defName) ? " (default)" : ""}${isBuiltinScheme(sc.name) ? "" : " · custom"}</span></button>`); b.onclick = () => { schemeSel = sc.name; renderPage(); }; listEl.appendChild(b); });
        const addB = el(`<button type="button" class="tx-btn" style="margin-top:8px">+ Add new</button>`); addB.onclick = () => { const base = schemeBy(schemeSel, S) || BUILTIN_SCHEMES[0]; let n = 1; while (schemeBy("Color Scheme " + n, S)) n++; const ns = clone(base); ns.name = "Color Scheme " + n; S.schemes = (S.schemes || []).concat([ns]); schemeSel = ns.name; touch(); renderPage(); };
        listEl.appendChild(addB);
        const sc = schemeBy(schemeSel, S); const custom = !isBuiltinScheme(sc.name) || (S.schemes || []).some((x) => lc(x.name) === lc(sc.name));
        const live = custom ? (S.schemes || []).find((x) => lc(x.name) === lc(sc.name)) : null;
        const pv = el(`<div class="tx-preview"></div>`);
        const paintPv = () => { const s2 = live || sc; pv.style.background = s2.background; pv.style.color = s2.foreground; pv.innerHTML = `<span style="color:${s2.brightGreen}">C:\\Users\\you&gt;</span> dir\n <span style="color:${s2.cyan}">Directory of C:\\Users\\you</span>\n<span style="color:${s2.brightBlue}">Documents</span>  <span style="color:${s2.yellow}">notes.txt</span>  <span style="color:${s2.red}">error.log</span>\n<span style="color:${s2.brightBlack}">PS&gt;</span> <span style="color:${s2.purple}">Get-Item</span> <span style="color:${s2.green}">"ok"</span>`; };
        paintPv(); ed.appendChild(pv);
        if (live) { const nm = txt(live.name, (v) => { const old = live.name; if (!v.trim()) return; live.name = v; [S.profiles.defaults].concat(S.profiles.list).forEach((p) => { if (p.colorScheme && lc(p.colorScheme) === lc(old)) p.colorScheme = v; }); schemeSel = v; }, "Scheme name"); nm.onchange = () => renderPage(); ed.appendChild(row("Name", "", nm)); }
        else ed.appendChild(el(`<p style="margin:0 0 10px;color:var(--tx-ui-dim)">${esc(sc.name)} is built in. Duplicate it to change its colors.</p>`));
        const grid = el(`<div class="tx-colors"></div>`);
        COLOR_KEYS.forEach((k) => { const v = (live || sc)[k] || "#000000"; const lab = el(`<label><input type="color"${live ? "" : " disabled"} aria-label="${k}"><span>${k}</span></label>`); const ci = lab.querySelector("input"); ci.value = HEX_RE.test(v) ? v.toLowerCase() : "#000000"; ci.oninput = () => { live[k] = ci.value.toUpperCase(); paintPv(); touch(); }; grid.appendChild(lab); });
        ed.appendChild(grid);
        const acts = el(`<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"></div>`);
        const mk = el(`<button type="button" class="tx-btn">Set as default</button>`); mk.onclick = () => { S.profiles.defaults.colorScheme = sc.name; touch(); renderPage(); };
        const dup = el(`<button type="button" class="tx-btn">Duplicate</button>`); dup.onclick = () => { let n = sc.name + " (copy)"; while (schemeBy(n, S)) n += "'"; const ns = clone(live || sc); ns.name = n; S.schemes = (S.schemes || []).concat([ns]); schemeSel = n; touch(); renderPage(); };
        acts.append(mk, dup);
        if (live) { const del = el(`<button type="button" class="tx-btn tx-danger">Delete color scheme</button>`); del.onclick = () => { S.schemes = S.schemes.filter((x) => x !== live); [S.profiles.defaults].concat(S.profiles.list).forEach((p) => { if (p.colorScheme && lc(p.colorScheme) === lc(live.name)) delete p.colorScheme; }); schemeSel = "Campbell"; touch(); renderPage(); }; acts.appendChild(del); }
        ed.appendChild(acts);
      }
      renderNav(); renderPage();
    }
    function buildJson(t) {
      const root = el(`<div class="tx-json"><div class="tx-json-bar"><span class="tx-json-path">%LOCALAPPDATA%\\Packages\\Microsoft.WindowsTerminal\\LocalState\\settings.json</span><span class="tx-grow"></span><button type="button" class="tx-btn" data-a="format">Format</button><button type="button" class="tx-btn" data-a="revert">Revert</button><button type="button" class="tx-btn" data-a="reset">Reset to defaults</button><button type="button" class="tx-btn tx-primary" data-a="save">Save (Ctrl+S)</button></div><div class="tx-json-ed"><div class="tx-json-gut" aria-hidden="true"></div><textarea class="tx-json-ta" spellcheck="false" autocapitalize="off" autocorrect="off" aria-label="settings.json"></textarea></div><div class="tx-json-st" role="status"></div></div>`);
      t.page.appendChild(root);
      const ta = root.querySelector("textarea"), gut = root.querySelector(".tx-json-gut"), st = root.querySelector(".tx-json-st");
      const lines = () => { const n = ta.value.split("\n").length; let s = ""; for (let i = 1; i <= n; i++) s += i + "\n"; gut.textContent = s; gut.scrollTop = ta.scrollTop; };
      const load = () => { ta.value = JSON.stringify(settings(), null, 4); lines(); status("", ""); saved = ta.value; };
      let saved = "";
      t.dirty = () => ta.value !== saved;
      const status = (cls, html) => { st.className = "tx-json-st" + (cls ? " tx-" + cls : ""); st.innerHTML = html; };
      // First syntax error offset in a JSON text (browsers' JSON.parse messages don't always include one).
      function jsonErrAt(src) {
        let i = 0; const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
        const fail = () => { throw i; };
        const val = () => {
          ws(); const c = src[i];
          if (c === "{") { i++; ws(); if (src[i] === "}") { i++; return; } for (;;) { ws(); if (src[i] !== '"') fail(); str(); ws(); if (src[i] !== ":") fail(); i++; val(); ws(); if (src[i] === ",") { i++; continue; } if (src[i] === "}") { i++; return; } fail(); } }
          if (c === "[") { i++; ws(); if (src[i] === "]") { i++; return; } for (;;) { val(); ws(); if (src[i] === ",") { i++; continue; } if (src[i] === "]") { i++; return; } fail(); } }
          if (c === '"') return str();
          const m = /^(-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(src.slice(i, i + 40)); if (!m) fail(); i += m[0].length;
        };
        const str = () => { i++; while (i < src.length && src[i] !== '"') { if (src[i] === "\\") i++; else if (src[i] === "\n") fail(); i++; } if (i >= src.length) fail(); i++; };
        try { val(); ws(); if (i < src.length) fail(); return -1; } catch (pos) { return typeof pos === "number" ? Math.min(pos, src.length) : -1; }
      }
      function posToLC(text, pos) { const pre = text.slice(0, pos).split("\n"); return { line: pre.length, col: pre[pre.length - 1].length + 1 }; }
      function save() {
        let obj;
        try { obj = JSON.parse(ta.value); }
        catch (e) {
          const m = /position (\d+)/i.exec(e.message || ""); let where = "";
          const at = m ? +m[1] : jsonErrAt(ta.value);
          if (at >= 0) { const p = posToLC(ta.value, at); where = ` at line ${p.line}, column ${p.col}`; try { ta.focus(); ta.setSelectionRange(at, at + 1); const lh = parseFloat(getComputedStyle(ta).lineHeight) || 18; ta.scrollTop = Math.max(0, (p.line - 5) * lh); } catch (_) {} }
          status("err", `<b>settings.json is not valid JSON${esc(where)}.</b><br>${esc(e.message)}<br>Nothing was saved; your previous settings are still in use.`);
          return false;
        }
        const v = validate(obj);
        if (v.errors.length) { status("err", `<b>Found ${v.errors.length} error${v.errors.length > 1 ? "s" : ""}; nothing was saved.</b><ul class="tx-err-list">${v.errors.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${v.warnings.length ? `<ul class="tx-err-list tx-warn">${v.warnings.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`); return false; }
        saveSettings(v.value);
        saved = ta.value;
        status("ok", `Saved. Settings were reloaded${v.warnings.length ? ` with ${v.warnings.length} warning${v.warnings.length > 1 ? "s" : ""}:` : "."}${v.warnings.length ? `<ul class="tx-err-list tx-warn">${v.warnings.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`);
        return true;
      }
      ta.addEventListener("input", lines); ta.addEventListener("scroll", () => (gut.scrollTop = ta.scrollTop));
      ta.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && lc(e.key) === "s") { e.preventDefault(); e.stopPropagation(); save(); }
        else if (e.key === "Tab" && !e.ctrlKey && !e.altKey) { e.preventDefault(); const a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + "    " + ta.value.slice(b); ta.setSelectionRange(a + 4, a + 4); lines(); }
      });
      root.querySelector('[data-a="save"]').onclick = save;
      root.querySelector('[data-a="format"]').onclick = () => { try { ta.value = JSON.stringify(JSON.parse(ta.value), null, 4); lines(); status("", "Formatted (not saved yet)."); } catch (e) { status("err", "Can't format: " + esc(e.message)); } };
      root.querySelector('[data-a="revert"]').onclick = load;
      root.querySelector('[data-a="reset"]').onclick = () => confirmDlg("Reset settings?", "This replaces settings.json with the defaults (your tabs stay open). Save to apply.", "Reset", () => { ta.value = JSON.stringify(defaultSettings(), null, 4); lines(); status("", "Defaults loaded. Select Save to apply them."); });
      t.reload = () => { if (!t.dirty()) load(); };
      t.focus = () => { try { ta.focus({ preventScroll: true }); } catch (_) {} };
      t.save = save; t.textarea = ta;
      load();
    }

    // ================================================================ apply settings to everything
    this.applySettings = function () {
      KEYMAP = null; applyTheme();
      self.tabs.forEach((t) => {
        if (t.kind === "term") { leavesOf(t.root).forEach((l) => { if (!profileBy(l.guid)) l.guid = defaultProfile().guid; if (l.scheme && !schemeBy(l.scheme)) l.scheme = null; applyPane(l); }); refreshTab(t); }
        else if (t.kind === "settings" && t.refresh) t.refresh();
        else if (t.kind === "json" && t.reload) t.reload();
      });
      updateSeeThrough();
    };

    // ---- public bits used by AppRegistry / tests ----
    Object.assign(this, { newTab, split, closePane, closeTab, selectTab, runAction, openSettings, openJson, palette, openFind, moveFocus, saveLayout, leaves: () => leavesOf(self.active && self.active.root), toast });

    // ================================================================ start
    applyTheme();
    WINS.add(this);
    const s = settings();
    const others = Array.from(WINS).filter((w) => w !== self).length;
    let ok = false;
    if (opts.actions) ok = runStartupActions(opts.actions, opts.profile);
    else if (opts.profile) { newTab(opts.profile); ok = true; }
    else {
      if (!others && s.firstWindowPreference === "persistedWindowLayout" && wtStore().session && wtStore().session.tabs && wtStore().session.tabs.length) ok = restoreLayout(wtStore().session);
      if (!ok && s.startupActions && s.startupActions.trim()) ok = runStartupActions(s.startupActions);
    }
    if (!ok || !self.tabs.length) newTab(defaultProfile());
    if (s.launchMode === "maximized") { const mx = win.querySelector(".ctl-max"); if (mx && !win.classList.contains("maximized")) mx.click(); }
    else if (s.launchMode === "fullscreen") setTimeout(toggleFullscreen, 50);
    persistSoon();
  }

  // ------------------------------------------------------------------ opening Terminal
  // Run dialog hints: "cmd" / "powershell" / "pwsh" / "wt" all go through WM.open("terminal" | "powershell");
  // remember what was typed so the matching profile opens.
  let hint = null;
  const setHint = (v) => { hint = { v: lc(String(v || "").trim()).replace(/\.exe$/, ""), t: Date.now() }; };
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target && e.target.matches && e.target.matches(".st-run-in")) setHint(e.target.value); }, true);
  document.addEventListener("click", (e) => { const b = e.target && e.target.closest && e.target.closest(".st-run-ok"); if (b) { const i = b.closest(".st-run") && b.closest(".st-run").querySelector(".st-run-in"); if (i) setHint(i.value); } }, true);
  function takeHint() { const h = hint; hint = null; return h && Date.now() - h.t < 4000 ? h.v : null; }
  function profileForHint(v) {
    if (!v) return null;
    if (/^(cmd|command)$/.test(v)) return profileBy(GUID.cmd) || profilesOf().find((p) => engineOf(p).shell === "cmd");
    if (/^pwsh$/.test(v)) return profileBy(GUID.pwsh) || profilesOf().find((p) => engineOf(p).ps === "7");
    if (/^powershell(_ise)?$/.test(v)) return profileBy(GUID.ps) || profilesOf().find((p) => engineOf(p).ps === "5.1");
    if (/^(bash|wsl|ubuntu)$/.test(v)) return profileBy(GUID.ubuntu) || profilesOf().find((p) => engineOf(p).shell === "bash");
    return null;
  }
  function open(o) {
    o = o || {};
    ensureCss();
    return loadCore().then(() => {
      if (o.profile && typeof o.profile !== "object") o.profile = profileBy(o.profile);
      return new TermWindow(o);
    }).catch((e) => {
      try { console.error(e); } catch (_) {}
      const { body } = window.WM.createWindow({ title: "Terminal", icon: window.Icon ? Icon.mini("terminal", "Terminal") : "", width: 560, height: 220, appId: "terminal" });
      body.innerHTML = `<div style="height:100%;background:#0c0c0c;color:#ff4b4b;font-family:Consolas,monospace;padding:12px">Terminal failed to start: ${esc(e && e.message)}</div>`;
    });
  }
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.terminal = function () { const h = takeHint(); return open({ profile: profileForHint(h) || null }); };
  AppRegistry.powershell = function (opts) {
    const h = takeHint(); const admin = !!(opts && typeof opts === "object" && opts.admin);
    return open({ profile: profileForHint(h === "pwsh" ? "pwsh" : "powershell"), admin });
  };
  // `wt` inside a Terminal pane: opens a new window, with wt.exe arguments (wt -p "Ubuntu" ; sp -V).
  window.TerminalExt = window.TerminalExt || { cmd: {}, ps: {} };
  TerminalExt.cmd = TerminalExt.cmd || {}; TerminalExt.ps = TerminalExt.ps || {};
  TerminalExt.cmd.wt = (c) => {
    const raw = c.raw ? c.raw() : (c.a || []).join(" ");
    if (/^\s*(-\?|\/\?|-h|--help)\s*$/.test(raw)) { c.io.out("wt [options] [command ; ...]\n\n  new-tab, nt      [-p profile] [-d dir] [--title t] [--tabColor #hex]\n  split-pane, sp   [-H | -V] [-p profile] [-s size]\n  focus-tab, ft    -t index\n  move-focus, mf   left|right|up|down\n\nExample: wt -p \"Ubuntu\" ; sp -V -p \"Command Prompt\""); return 0; }
    open(raw.trim() ? { actions: raw } : {});
    return 0;
  };

  window.TerminalX = {
    open, settings, defaultSettings, validate, saveSettings: (s) => { const v = validate(s); if (v.errors.length) return v; saveSettings(v.value); return v; },
    windows: () => Array.from(WINS), schemes: () => allSchemes(), profiles: () => profilesOf(), GUID, parseWtArgs, normKeys, keyOf,
  };
})();
