/* Boot -> (Setup if needed) -> Desktop. */
(function () {
  "use strict";

  // Theme can be "light", "dark", or "auto" (follow the host OS appearance).
  function hostPrefersDark() {
    try { return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); } catch (e) { return false; }
  }
  function resolveTheme() {
    var t = State.data.theme;
    if (t === "light" || t === "dark") return t;
    return hostPrefersDark() ? "dark" : "light"; // "auto"/unset -> match the device
  }
  function applyPrefs() {
    document.body.classList.toggle("dark", resolveTheme() === "dark");
    document.body.classList.toggle("xp-theme", !!(State.data.desktop && State.data.desktop.xpTheme));
    // Accessibility + kiosk modes (real CSS effects).
    var a = (State.data.appData && State.data.appData.a11y) || {};
    document.body.classList.toggle("a11y-mode", !!a.on);
    document.body.classList.toggle("a11y-contrast", !!(a.on && a.contrast));
    document.body.classList.toggle("a11y-reduce-motion", !!(a.on && a.reduceMotion));
    document.body.classList.toggle("kiosk-mode", !!(State.data.appData && State.data.appData.kiosk));
    if (State.data.accent) document.documentElement.style.setProperty("--accent", State.data.accent);
    var scale = State.data.textScale / 100;
    if (a.on && a.bigText) scale = Math.max(scale, 1.35);
    document.documentElement.style.setProperty("--scale", scale);
  }
  window.applyTheme = applyPrefs;

  // Kiosk mode: full screen, single-app lock (taskbar + desktop hidden via CSS).
  function syncKioskExit() {
    var on = !!(State.data.appData && State.data.appData.kiosk);
    var ex = document.getElementById("kiosk-exit");
    if (on && !ex) {
      ex = document.createElement("button"); ex.id = "kiosk-exit"; ex.className = "kiosk-exit"; ex.textContent = "⤢ Exit kiosk";
      ex.onclick = function () { window.setKiosk(false); };
      document.body.appendChild(ex);
    } else if (!on && ex) { ex.remove(); }
  }
  window.setKiosk = function (on) {
    if (!State.data.appData) State.data.appData = {};
    State.data.appData.kiosk = !!on; State.save();
    applyPrefs(); syncKioskExit();
    try {
      if (on) { var el = document.documentElement; if (el.requestFullscreen) { var p = el.requestFullscreen(); if (p && p.catch) p.catch(function () {}); } }
      else if (document.fullscreenElement && document.exitFullscreen) { var q = document.exitFullscreen(); if (q && q.catch) q.catch(function () {}); }
    } catch (e) {}
    if (window.Notify && on) Notify.show({ icon: "🖥️", title: "Kiosk mode on", body: "Taskbar and desktop are hidden. Use “Exit kiosk” (top-right) or type kiosk off in Terminal." });
  };
  // When on "auto", follow the host switching between light/dark live.
  try {
    var mq = matchMedia("(prefers-color-scheme: dark)");
    var onHostTheme = function () {
      if (State.data.theme !== "light" && State.data.theme !== "dark") { applyPrefs(); if (window.applyWallpaper) window.applyWallpaper(); }
    };
    mq.addEventListener ? mq.addEventListener("change", onHostTheme) : mq.addListener && mq.addListener(onHostTheme);
  } catch (e) {}

  function startDesktop() {
    applyPrefs();
    window.WM.buildDesktop();
    syncKioskExit();
  }

  // Real dependency: the desktop won't run without C:\Windows\System32. If those
  // files are gone (deleted, or marked broken), boot goes to recovery/Setup.
  function system32Ok() {
    try {
      if (State.data.systemBroken) return false;
      var r = State.data.appData && State.data.appData.files && State.data.appData.files.root;
      if (!r || !r["Local Disk (C:)"]) return true; // not seeded yet — fine
      var c = r["Local Disk (C:)"].children || {};
      var win = c["Windows"] && c["Windows"].children;
      var sys = win && win["System32"] && win["System32"].children;
      return !!sys && Object.keys(sys).length >= 10; // System32 must hold its files
    } catch (e) { return true; }
  }
  window.repairSystem32 = function () {
    try {
      var d = State.data; if (!d.appData) d.appData = {};
      if (window.FilesParts) {
        d.appData.files = d.appData.files || { root: FilesParts.FILE_SEED() };
        Object.assign(d.appData.files.root, FilesParts.WIN_FS());
      }
      d.systemBroken = false; State.save();
    } catch (e) {}
    return true;
  };

  window.addEventListener("DOMContentLoaded", () => {
    // If this window is the Spotify sign-in popup coming back, finish it and close —
    // don't boot a second desktop inside the popup.
    if (window.SpotifyPopup && SpotifyPopup.isCallback()) { SpotifyPopup.finish(); return; }
    Boot.run(() => {
      // Enforce the System32 dependency before reaching the desktop.
      if (State.data.setupCompleted && !system32Ok()) {
        State.data.systemBroken = true; State.data.setupCompleted = false; State.data.installerDone = false; State.save();
      }
      if (!State.data.setupCompleted) {
        Setup.run(startDesktop);
      } else {
        Lock.run(startDesktop);
      }
    });
  });
})();
