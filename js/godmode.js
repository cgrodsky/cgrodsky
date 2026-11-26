/* God Mode — the classic All Tasks folder (GodMode.{ED7BA470-8E54-465E-825C-99712043E01C}).
   One scrollable, searchable window that indexes every Control Panel / Settings task in the
   simulation, grouped by category, each row opening the real destination:
     s:<key>  -> Settings (a section id or a sub-page key) via window.SettingsStartPage
     c:<page> -> Control Panel applet via window.openControlPanel
     a:<id>   -> an app / system tool via WM.open
   A desktop "God Mode" icon opens it, and renaming any File Explorer folder to
   Something.{ED7BA470-8E54-465E-825C-99712043E01C} turns it into this window (see js/files12.js). */
(function () {
  "use strict";
  if (window.GodMode) return;
  function el(h) { const d = document.createElement("div"); d.innerHTML = String(h).trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const GUID = "{ED7BA470-8E54-465E-825C-99712043E01C}";

  try {
    if (window.Icon && Icon.register) Icon.register("godmode", `<svg viewBox="0 0 48 48" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b5cff"/><stop offset="1" stop-color="#2d8cff"/></linearGradient></defs><path d="M6 12a3 3 0 0 1 3-3h10l4 4h16a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3Z" fill="url(#gm-g)"/><path d="M6 16h36v3H6Z" fill="#ffffff" opacity=".18"/><g transform="translate(24 27)" fill="#fff"><path d="M0-9 2.2-3.2 8-3.3 3.3.4 5 6 0 2.5-5 6 3.3.4-1.3-3.3-5.8.1Z" opacity=".95"/><circle r="3" fill="url(#gm-g)"/></g></svg>`);
  } catch (e) {}

  // ---- the task catalogue (label, target) grouped by category ----
  const CAT = [
    ["System", "opt_monitor", [
      ["Display settings", "s:display"], ["Adjust screen brightness", "s:display"], ["Night light settings", "s:display"],
      ["Change display resolution", "s:display"], ["Scale and layout", "s:display"], ["Multiple displays", "s:display"],
      ["Sound settings", "s:sound"], ["Choose output device", "s:sound"], ["Volume mixer", "s:sound"],
      ["Notifications & actions", "s:notifications"], ["Focus assist", "s:notifications"],
      ["Power & battery", "s:power"], ["Choose a power plan", "c:power"], ["Change what the power buttons do", "c:power"],
      ["Storage settings", "s:storage"], ["Storage Sense", "s:storage"], ["Free up disk space (Disk Cleanup)", "a:cleanmgr"],
      ["Multitasking", "s:multitask"], ["Snap windows", "s:multitask"],
      ["Projecting to this PC", "s:system"], ["Remote Desktop", "s:system"], ["Clipboard", "s:system"],
      ["About this PC", "s:about"], ["System information (msinfo32)", "a:msinfo32"], ["System properties", "c:system"],
      ["Rename this PC", "s:about"],
    ]],
    ["Bluetooth & devices", "set_bluetooth", [
      ["Add a Bluetooth or other device", "s:devices"], ["Bluetooth on/off", "s:devices"],
      ["Devices and drivers", "s:devmgr"], ["Open Device Manager", "a:devicemanager"],
      ["Mouse settings", "s:mouse"], ["Mouse pointer speed", "s:mouse"], ["Mouse properties", "c:system"],
      ["Printers & scanners", "c:devices"], ["Devices and Printers", "c:devices"],
      ["Touchpad", "s:devices"], ["Pen & Windows Ink", "s:devices"], ["AutoPlay", "s:devices"], ["USB", "s:devices"],
    ]],
    ["Network & internet", "wifi", [
      ["Network status", "s:network"], ["Wi-Fi networks", "s:wifinets"], ["Manage known networks", "s:wifinets"],
      ["Ethernet", "s:network"], ["VPN", "s:network"], ["Mobile hotspot", "s:network"], ["Airplane mode", "s:network"],
      ["Proxy", "s:network"], ["Data usage", "s:network"], ["Network and Sharing Center", "c:network"],
      ["Network adapter options", "c:network"], ["Windows Defender Firewall", "c:firewall"], ["Network reset", "s:network"],
    ]],
    ["Personalization", "personalization", [
      ["Background", "s:background"], ["Choose your picture", "s:background"], ["Colors / accent color", "s:personal"],
      ["Themes", "s:personal"], ["Lock screen", "s:personal"], ["Start", "s:personal"], ["Taskbar", "s:personal"],
      ["Fonts", "c:fonts"], ["Desktop icon settings", "s:icons"], ["Dark / light mode", "s:personal"],
      ["Change the theme (Control Panel)", "c:personalization"],
    ]],
    ["Apps", "store__", [
      ["Installed apps", "s:installed"], ["Uninstall a program", "c:programs"], ["Programs and Features", "c:programs"],
      ["Default apps", "s:apps"], ["Startup apps", "s:apps"], ["Optional features", "s:apps"],
      ["Apps for websites", "s:apps"], ["Turn Windows features on or off", "c:programs"], ["Microsoft Store", "a:store__"],
    ]],
    ["Accounts", "user", [
      ["Your info", "s:yourinfo"], ["Sign-in options", "s:signin"], ["PIN / Windows Hello", "s:signin"],
      ["Email & accounts", "s:email"], ["Family & other users", "s:accounts"], ["User Accounts (Control Panel)", "c:users"],
      ["Windows Backup", "s:devicesync"], ["Sync your settings", "s:accounts"], ["Access work or school", "s:accounts"],
    ]],
    ["Time & language", "clock", [
      ["Date & time", "s:datetime"], ["Set time automatically", "s:datetime"], ["Add a clock for a time zone", "c:datetime"],
      ["Language & region", "s:language"], ["Region (Control Panel)", "c:region"], ["Speech", "s:time"],
      ["Typing", "s:time"],
    ]],
    ["Gaming", "xbox", [
      ["Game Bar", "s:gaming"], ["Captures", "s:gaming"], ["Game Mode", "s:gaming"], ["Xbox", "a:xbox"],
    ]],
    ["Accessibility", "accessibility", [
      ["Text size", "s:access"], ["Visual effects", "s:access"], ["Mouse pointer and touch", "s:access"],
      ["Magnifier", "s:access"], ["Color filters", "s:access"], ["Contrast themes", "s:access"],
      ["Narrator", "s:access"], ["Audio", "s:access"], ["Captions", "s:access"], ["Keyboard", "s:access"],
      ["Ease of Access Center", "c:ease"],
    ]],
    ["Privacy & security", "security", [
      ["Windows Security", "a:security"], ["Privacy dashboard", "s:privacy"], ["Location", "s:privacy"],
      ["Camera", "s:privacy"], ["Microphone", "s:privacy"], ["Activity history", "s:privacy"],
      ["App permissions", "s:privacy"], ["Find my device", "s:privacy"], ["For developers", "s:privacy"],
      ["BitLocker drive encryption", "c:bitlocker"],
    ]],
    ["Update & recovery", "winupdate", [
      ["Check for updates", "s:update"], ["Update history", "s:uphistory"], ["Pause updates", "s:update"],
      ["Advanced options", "s:update"], ["Recovery", "s:recovery"], ["Reset this PC", "s:recovery"],
      ["System Restore", "a:rstrui"], ["System Protection", "a:sysprotect"], ["Activation", "s:activation"],
      ["Troubleshoot", "s:troubleshoot"],
    ]],
    ["Administrative tools", "devicemanager", [
      ["Task Manager", "a:taskmanager"], ["Device Manager", "a:devicemanager"], ["Disk Management", "a:diskmgmt"],
      ["Event Viewer", "a:eventviewer"], ["Task Scheduler", "a:taskschd"], ["Registry Editor", "a:regedit"],
      ["System Configuration (msconfig)", "a:msconfig"], ["System Information", "a:msinfo32"],
      ["Disk Cleanup", "a:cleanmgr"], ["Control Panel", "a:controlpanel"], ["About Windows (winver)", "a:winver"],
      ["Administrative Tools folder", "c:admintools"], ["Indexing Options", "c:indexing"],
    ]],
  ];

  function launch(tg) {
    const k = tg.charAt(0), v = tg.slice(2);
    try {
      if (k === "s") { window.SettingsStartPage = v || "system"; WM.open("settings"); }
      else if (k === "c") { if (window.openControlPanel) window.openControlPanel(v || "home"); else { window.ControlPanelStartPage = v; WM.open("controlpanel"); } }
      else if (k === "a") { WM.open(v); }
    } catch (e) {}
  }

  function totalTasks() { return CAT.reduce((n, c) => n + c[2].length, 0); }

  function render(body) {
    const n = totalTasks();
    body.innerHTML = `<div class="gm-root">
      <div class="gm-head">
        <div class="gm-title"><span class="gm-ic">${Icon.mini("godmode", "God Mode")}</span><div><b>All Tasks</b><span class="gm-sub">God Mode · ${n} settings and Control Panel tasks</span></div></div>
        <label class="gm-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="text" placeholder="Search all tasks" spellcheck="false" aria-label="Search all tasks"></label>
      </div>
      <div class="gm-list"></div>
      <div class="gm-empty" hidden>No tasks match your search.</div>
    </div>`;
    const list = body.querySelector(".gm-list"), empty = body.querySelector(".gm-empty");
    const input = body.querySelector(".gm-search input");

    function paint(filter) {
      list.innerHTML = ""; const f = (filter || "").trim().toLowerCase(); let shown = 0;
      CAT.forEach(([name, icKey, tasks]) => {
        const hits = f ? tasks.filter((t) => (t[0] + " " + name).toLowerCase().includes(f)) : tasks;
        if (!hits.length) return;
        shown += hits.length;
        const sec = el(`<section class="gm-sec"><h3 class="gm-sec-h">${esc(name)} <span class="gm-count">${hits.length}</span></h3><div class="gm-rows"></div></section>`);
        const rows = sec.querySelector(".gm-rows");
        hits.forEach(([label, tg]) => {
          const r = el(`<button class="gm-row" type="button"><span class="gm-row-ic">${Icon.mini(icKey, name)}</span><span class="gm-row-t">${esc(label)}</span><span class="gm-row-go"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span></button>`);
          r.onclick = () => launch(tg);
          rows.appendChild(r);
        });
        list.appendChild(sec);
      });
      empty.hidden = shown > 0;
    }
    input.addEventListener("input", () => paint(input.value));
    paint("");
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
  }

  function open() {
    const ref = WM.createWindow({ title: "All Tasks (God Mode)", icon: Icon.mini("godmode", "God Mode"), width: Math.min(880, innerWidth - 24), height: Math.min(620, innerHeight - 90), appId: "godmode" });
    const body = ref.body || ref.content || (ref.el && ref.el.querySelector(".win-body"));
    render(body);
    return ref;
  }

  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.godmode = open;
  window.GodMode = { open, GUID, isGuidFolder: (nm) => new RegExp("\\." + GUID.replace(/[{}]/g, "\\$&") + "$", "i").test(String(nm || "")) };
})();
