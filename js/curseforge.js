/* CurseForge — a Minecraft mod browser. Browse mods by category, search, and
   "install" them (persisted in appData.curseforge.installed). */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const CATS = ["All", "Popular", "Tech", "Magic", "Adventure", "World Gen", "Performance", "Utility", "Library", "Food", "Mobs"];
  const MODS = [
    { id: "jei", name: "Just Enough Items (JEI)", author: "mezz", dl: 412000000, cat: "Utility", c: "#f4a020", desc: "View recipes and items — the essential recipe helper." },
    { id: "create", name: "Create", author: "simibubi", dl: 78000000, cat: "Tech", c: "#8a6d3b", desc: "Build contraptions and machines with rotational power." },
    { id: "sodium", name: "Sodium", author: "jellysquid3", dl: 96000000, cat: "Performance", c: "#2f7be0", desc: "A modern rendering engine — massive FPS boost." },
    { id: "iris", name: "Iris Shaders", author: "coderbot", dl: 54000000, cat: "Performance", c: "#7b5cff", desc: "Run beautiful shader packs with great performance." },
    { id: "fabricapi", name: "Fabric API", author: "FabricMC", dl: 520000000, cat: "Library", c: "#9aa0a6", desc: "Core library required by most Fabric mods." },
    { id: "journeymap", name: "JourneyMap", author: "techbrew", dl: 210000000, cat: "Utility", c: "#16a34a", desc: "Real-time in-game minimap and world map." },
    { id: "bop", name: "Biomes O' Plenty", author: "Forstride", dl: 190000000, cat: "World Gen", c: "#22c55e", desc: "Adds 90+ new biomes to explore." },
    { id: "twilight", name: "The Twilight Forest", author: "Benimatic", dl: 130000000, cat: "Adventure", c: "#6d28d9", desc: "A whole new dimension of adventure and bosses." },
    { id: "ae2", name: "Applied Energistics 2", author: "AlgorithmX2", dl: 150000000, cat: "Tech", c: "#0891b2", desc: "Digital storage and automation networks." },
    { id: "farmers", name: "Farmer's Delight", author: "vectorwing", dl: 88000000, cat: "Food", c: "#ca8a04", desc: "Cooking, crops, and cozy farm life." },
    { id: "alexmobs", name: "Alex's Mobs", author: "sbom_xela", dl: 72000000, cat: "Mobs", c: "#e11d48", desc: "Over 80 new animals and monsters." },
    { id: "waystones", name: "Waystones", author: "BlayTheNinth", dl: 160000000, cat: "Utility", c: "#0e7490", desc: "Fast-travel between placed waystones." },
    { id: "botania", name: "Botania", author: "Vazkii", dl: 84000000, cat: "Magic", c: "#16a34a", desc: "Nature-based magic powered by flowers." },
    { id: "ars", name: "Ars Nouveau", author: "baileyholl", dl: 45000000, cat: "Magic", c: "#7c3aed", desc: "Craft custom spells and magical automation." },
  ];
  const POPULAR = ["jei", "fabricapi", "create", "sodium", "journeymap", "waystones"];

  function store() { if (!S().appData) S().appData = {}; if (!S().appData.curseforge) S().appData.curseforge = { installed: [] }; if (!S().appData.curseforge.installed) S().appData.curseforge.installed = []; return S().appData.curseforge; }
  function isInstalled(id) { return store().installed.indexOf(id) >= 0; }
  function fmtDl(n) { if (n >= 1e9) return (n / 1e9).toFixed(1) + "B"; if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (n >= 1e3) return (n / 1e3).toFixed(0) + "K"; return "" + n; }

  function openCurseForge() {
    const ref = cw({ title: "CurseForge", icon: window.Icon ? Icon.mini("curseforge", "CurseForge") : "", width: 980, height: 660, appId: "curseforge" });
    const body = ref.body;
    body.classList.add("cf-host");
    let cat = "All", query = "", view = "browse";

    function render() {
      body.innerHTML = `<div class="cf">
        <div class="cf-side">
          <div class="cf-brand">${window.Icon ? Icon.mini("curseforge", "CurseForge") : ""}<b>CurseForge</b></div>
          <button class="cf-nav ${view === "browse" ? "on" : ""}" data-v="browse">Browse Mods</button>
          <button class="cf-nav ${view === "installed" ? "on" : ""}" data-v="installed">My Mods${store().installed.length ? " (" + store().installed.length + ")" : ""}</button>
          <div class="cf-cats-h">Categories</div>
          <div class="cf-cats"></div>
        </div>
        <div class="cf-main">
          <div class="cf-top"><div class="cf-search"><input placeholder="Search ${MODS.length}+ mods" value="${esc(query)}"></div><span class="grow"></span><span class="cf-mc">for Minecraft: Java Edition</span></div>
          <div class="cf-grid"></div>
        </div>
      </div>`;
      const catsEl = body.querySelector(".cf-cats");
      CATS.forEach((c) => { const b = el(`<button class="cf-cat ${c === cat ? "on" : ""}">${c}</button>`); b.onclick = () => { cat = c; view = "browse"; render(); }; catsEl.appendChild(b); });
      body.querySelectorAll(".cf-nav").forEach((b) => b.onclick = () => { view = b.dataset.v; render(); });
      const searchIn = body.querySelector(".cf-search input");
      searchIn.oninput = () => { query = searchIn.value; renderGrid(); };
      renderGrid();
    }

    function renderGrid() {
      const grid = body.querySelector(".cf-grid");
      grid.innerHTML = "";
      const q = query.trim().toLowerCase();
      let list = MODS.slice();
      if (view === "installed") list = list.filter((m) => isInstalled(m.id));
      else if (q) list = list.filter((m) => (m.name + " " + m.author + " " + m.cat).toLowerCase().includes(q));
      else if (cat === "Popular") list = POPULAR.map((id) => MODS.find((m) => m.id === id)).filter(Boolean);
      else if (cat !== "All") list = list.filter((m) => m.cat === cat);
      if (!list.length) { grid.innerHTML = `<div class="cf-empty">${view === "installed" ? "No mods installed yet. Browse and install some!" : "No mods found."}</div>`; return; }
      list.forEach((m) => {
        const inst = isInstalled(m.id);
        const card = el(`<div class="cf-card">
          <div class="cf-card-ic" style="background:${m.c}">${esc(m.name[0])}</div>
          <div class="cf-card-info">
            <div class="cf-card-top"><b>${esc(m.name)}</b><span class="cf-card-cat">${esc(m.cat)}</span></div>
            <div class="cf-card-author">by ${esc(m.author)}</div>
            <div class="cf-card-desc">${esc(m.desc)}</div>
            <div class="cf-card-meta"><span class="cf-dl">${downloadIc()} ${fmtDl(m.dl)}</span></div>
          </div>
          <button class="cf-install ${inst ? "done" : ""}">${inst ? "Installed" : "Install"}</button>
        </div>`);
        const btn = card.querySelector(".cf-install");
        btn.onclick = () => {
          const s = store();
          if (isInstalled(m.id)) { s.installed = s.installed.filter((x) => x !== m.id); State.save(); render(); }
          else { s.installed.push(m.id); State.save(); btn.textContent = "Installed"; btn.classList.add("done"); if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("curseforge", "CurseForge") : "", title: "CurseForge", body: m.name + " installed" }); if (view === "browse" && (cat === "Popular" || true)) renderGridSoft(); }
        };
        grid.appendChild(card);
      });
    }
    function renderGridSoft() { const nav = body.querySelector('.cf-nav[data-v="installed"]'); if (nav) nav.textContent = "My Mods" + (store().installed.length ? " (" + store().installed.length + ")" : ""); }
    function downloadIc() { return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>`; }
    render();
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.curseforge = openCurseForge;
})();
