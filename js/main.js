/* Boot -> (Setup if needed) -> Desktop. */
(function () {
  "use strict";

  function applyPrefs() {
    document.body.classList.toggle("dark", State.data.theme === "dark");
    document.body.classList.toggle("xp-theme", !!(State.data.desktop && State.data.desktop.xpTheme));
    if (State.data.accent) document.documentElement.style.setProperty("--accent", State.data.accent);
    document.documentElement.style.setProperty("--scale", State.data.textScale / 100);
  }

  function startDesktop() {
    applyPrefs();
    window.WM.buildDesktop();
  }

  window.addEventListener("DOMContentLoaded", () => {
    // If this window is the Spotify sign-in popup coming back, finish it and close —
    // don't boot a second desktop inside the popup.
    if (window.SpotifyPopup && SpotifyPopup.isCallback()) { SpotifyPopup.finish(); return; }
    Boot.run(() => {
      if (!State.data.setupCompleted) {
        Setup.run(startDesktop);
      } else {
        Lock.run(startDesktop);
      }
    });
  });
})();
