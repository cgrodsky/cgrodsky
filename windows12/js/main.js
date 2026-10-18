/* Boot -> (Setup if needed) -> Desktop. */
(function () {
  "use strict";

  function applyPrefs() {
    document.body.classList.toggle("dark", State.data.theme === "dark");
    document.documentElement.style.setProperty("--scale", State.data.textScale / 100);
  }

  function startDesktop() {
    applyPrefs();
    window.WM.buildDesktop();
  }

  window.addEventListener("DOMContentLoaded", () => {
    Boot.run(() => {
      if (!State.data.setupCompleted) {
        Setup.run(startDesktop);
      } else {
        startDesktop();
      }
    });
  });
})();
