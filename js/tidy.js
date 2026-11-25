/* Desktop tidy-up: a calmer Home Screen.
   One-time change (flag desktop.tidy1) that
   - keeps only a few shortcuts on the desktop (the rest are still in Start / Search),
   - trims the Office and Essentials groups to two neat rows of three,
   - tucks the Spotify widget away (right-click the desktop → "Show Spotify widget").
   Settings → Personalization → Desktop icons lets you show or hide any shortcut. */
(function () {
  "use strict";
  // Must match the desktop's built-in shortcut list.
  const BUILTIN = [
    ["edge", "Microsoft Edge"], ["chrome", "Chrome"], ["store__", "Store"], ["youtubeApp", "YouTube"],
    ["copilot", "Copilot"], ["settings", "Settings"], ["calculator", "Calculator"], ["mclauncher", "Minecraft"],
    ["xbox", "Xbox"], ["messenger", "Messenger"], ["word", "Word"], ["powerpoint", "PowerPoint"],
    ["excel", "Excel"], ["forms", "Forms"], ["canva", "Canva"],
  ];
  const KEEP = ["edge", "chrome", "store__", "mclauncher"];
  const OFFICE = ["word", "excel", "powerpoint", "outlook", "onenote", "forms"];
  const ESSENTIALS = ["settings", "fileexplorer", "calculator", "copilot", "clock", "photos"];
  const SPOTIFY_DEFAULT = { type: "playlist", id: "37i9dQZF1DXcBWIGoYBM5M", title: "Today's Top Hits" };

  const S = () => State.data;
  function desk() { return S().desktop || (S().desktop = {}); }
  function hidden() { const d = desk(); return d.hiddenIcons || (d.hiddenIcons = []); }

  function minimalIcons() {
    const h = hidden();
    BUILTIN.forEach(([id]) => { if (!KEEP.includes(id) && !h.includes(id)) h.push(id); });
    (S().installedApps || []).forEach((id) => { if (!KEEP.includes(id) && !h.includes(id)) h.push(id); });
  }

  function migrate() {
    try {
      const d = desk();
      if (d.tidy1) return;
      minimalIcons();
      if (!d.groups) d.groups = [
        { id: "grp0_office", name: "Office", apps: OFFICE.slice() },
        { id: "grp1_essentials", name: "Essentials", apps: ESSENTIALS.slice() },
      ];
      else d.groups.forEach((g) => {
        if (g && g.name === "Office") g.apps = OFFICE.slice();
        else if (g && g.name === "Essentials") g.apps = ESSENTIALS.slice();
      });
      if (!S().appData) S().appData = {};
      S().appData.essMigrated2 = true; // don't let the old migration re-add the full Essentials list
      d.spotify = Object.assign({ pos: null, recent: [SPOTIFY_DEFAULT] }, d.spotify || {}, { hidden: true });
      d.tidy1 = true;
      State.save();
    } catch (e) { console.warn("tidy", e); }
  }

  function candidates() {
    const list = BUILTIN.map(([id, name]) => ({ id, name }));
    (S().installedApps || []).forEach((id) => {
      if (list.some((x) => x.id === id)) return;
      const a = window.Catalog && Catalog.storeApps.find((x) => x.id === id);
      if (a) list.push({ id, name: a.name });
    });
    return list;
  }
  const refresh = () => { State.save(); if (window.WM && WM.refreshDesktopIcons) WM.refreshDesktopIcons(); };

  // Settings → Personalization → Desktop icons
  function buildSettings(panel) {
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    function paint() {
      const h = hidden();
      panel.innerHTML = `<div class="tidy-box">
        <div class="tidy-btns"><button data-a="min">Keep it minimal</button><button data-a="all">Show all</button></div>
        <div class="tidy-list">${candidates().map((c) => `<label class="tidy-row"><input type="checkbox" data-id="${esc(c.id)}" ${h.includes(c.id) ? "" : "checked"}><span class="tidy-ic">${window.Icon ? Icon.mini(c.id, c.name) : ""}</span><span>${esc(c.name)}</span></label>`).join("")}</div>
        <div class="tidy-note">Apps inside a desktop group (Office, Essentials) show in the group instead.</div></div>`;
      panel.querySelectorAll(".tidy-row input").forEach((cb) => cb.onchange = () => {
        const h2 = hidden(), id = cb.dataset.id, i = h2.indexOf(id);
        if (cb.checked && i >= 0) h2.splice(i, 1);
        if (!cb.checked && i < 0) h2.push(id);
        refresh();
      });
      panel.querySelector('[data-a="min"]').onclick = () => { minimalIcons(); refresh(); paint(); };
      panel.querySelector('[data-a="all"]').onclick = () => {
        const bin = (desk().bin || []).map((b) => b.id); // things really in the Recycle Bin stay hidden
        desk().hiddenIcons = hidden().filter((id) => bin.includes(id)); refresh(); paint();
      };
    }
    paint();
  }

  migrate();
  window.Tidy = { migrate, buildSettings, minimalIcons };
})();
