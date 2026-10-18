/* Tips — a friendly "get the most out of Windows 12" app, like the real Tips app.
   A hero header plus a grid of tip cards pointing at features of this sim. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const cw = (opts) => window.WM.createWindow(opts);

  const TIPS = [
    { ic: "searchglass", t: "Search anything", d: "Tap Search in the taskbar and type an app — or a name like “Roblox” for a quick answer card." },
    { ic: "gta6", t: "Steal a car", d: "In GTA VI, walk up to a parked car and press E (or the ENTER button) to hop in and drive." },
    { ic: "msfs", t: "Take to the skies", d: "Open Microsoft Flight Simulator and press H to toggle the glass-cockpit heads-up display." },
    { ic: "settings", t: "Make it yours", d: "Open Settings › Personalization to change your wallpaper, accent color, and theme." },
    { ic: "calendar", t: "Today at a glance", d: "The Calendar icon always shows today’s date — no need to open it to check." },
    { ic: "copilot", t: "Ask Copilot", d: "Stuck on something? Open Copilot and ask it to help, explain, or write for you." },
    { ic: "xbox", t: "Play with Game Pass", d: "Browse the Xbox app to install and launch games like Minecraft and GTA VI." },
    { ic: "store__", t: "Get more apps", d: "Visit the Microsoft Store to install new apps and games onto your desktop." },
  ];

  window.AppRegistry.tips = function () {
    const ref = cw({ title: "Tips", icon: Icon.mini("tips", "Tips"), width: 720, height: 560, appId: "tips" });
    const body = ref.body;
    body.innerHTML = `<div class="tips">
      <div class="tips-hero">
        <div class="tips-hero-ic">${Icon.big("tips", "Tips")}</div>
        <div class="tips-hero-tx"><h1>Tips</h1><p>Get the most out of Windows 12</p></div>
      </div>
      <div class="tips-grid">
        ${TIPS.map((t) => `<button class="tips-card" data-open="${t.ic === "store__" ? "store__" : ""}">
          <span class="tips-card-ic">${Icon.md(t.ic, t.t)}</span>
          <span class="tips-card-tx"><b>${t.t}</b><span>${t.d}</span></span>
        </button>`).join("")}
      </div>
    </div>`;
    body.querySelectorAll(".tips-card[data-open]").forEach((c) => {
      const id = c.getAttribute("data-open"); if (!id) return;
      c.onclick = () => { try { window.WM.open ? window.WM.open(id) : null; } catch (e) {} };
    });
  };
})();
