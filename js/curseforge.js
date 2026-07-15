/* CurseForge — a Minecraft mod browser. Browse mods by category, search, and
   "install" them (persisted in appData.curseforge.installed). */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const CATS = ["All", "Popular", "Tech", "Magic", "Adventure", "World Gen", "Performance", "Utility", "Library", "Food", "Mobs"];

  // Hand-drawn SVG icons for the two mods the user provided art for (JEI green "J", Sodium blue droplet).
  const JEI_ICON = `<svg viewBox="0 0 48 48" width="100%" height="100%"><rect width="48" height="48" rx="9" fill="#fff"/><rect x="1" y="1" width="46" height="46" rx="8.5" fill="none" stroke="#d9d9d9"/><text x="24" y="35" font-family="Arial Black, Arial, sans-serif" font-size="30" font-weight="900" text-anchor="middle" fill="#3cbf3c">J</text></svg>`;
  const SODIUM_ICON = `<svg viewBox="0 0 48 48" width="100%" height="100%"><defs><linearGradient id="cfSod" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f9be6"/><stop offset="1" stop-color="#1560c8"/></linearGradient></defs><rect width="48" height="48" rx="9" fill="url(#cfSod)"/><path d="M24 9c6 7 10 11 10 17a10 10 0 0 1-20 0c0-6 4-10 10-17z" fill="#eaf6ff" opacity=".95"/><path d="M20 26a4 4 0 0 0 4 5" fill="none" stroke="#1560c8" stroke-width="2" stroke-linecap="round"/></svg>`;

  const MODS = [
    { id: "jei", name: "Just Enough Items (JEI)", author: "mezz", dl: 412000000, cat: "Utility", c: "#e9f5e9", iconImg: "assets/mod_jei.png", desc: "View recipes and items — the essential recipe helper.",
      long: "JEI is an item and recipe viewing mod for Minecraft, built from the ground up for stability and performance. Hover over any item and press R to see how it's made, or U to see what you can make with it. Search, bookmark, and cheat items in creative — it's the mod almost every modpack depends on.",
      shots: ["assets/mod_jei_1.png", "assets/mod_jei_2.png", "assets/mod_jei_3.png", "assets/mod_jei_4.png"] },
    { id: "create", name: "Create", author: "simibubi", dl: 78000000, cat: "Tech", c: "#8a6d3b", desc: "Build contraptions and machines with rotational power.",
      long: "Create is about building with rotational force. Assemble gears, belts, and shafts into elaborate contraptions — automated farms, moving structures, and factories that actually animate as they run.",
      gallery: ["Kinetic contraption", "Mechanical press", "Windmill build"] },
    { id: "sodium", name: "Sodium", author: "jellysquid3", dl: 96000000, cat: "Performance", c: "#2f7be0", icon: SODIUM_ICON, desc: "A modern rendering engine — massive FPS boost.",
      long: "Sodium is a free and open-source rendering optimization mod for Minecraft that dramatically improves frame rates and reduces micro-stutter, while fixing many graphical issues. It's the go-to performance mod for the Fabric ecosystem.",
      gallery: ["Smooth 200+ FPS", "Video settings", "Chunk rendering"] },
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
    // --- expanded catalogue ---
    { id: "appleskin", name: "AppleSkin", author: "squeek502", dl: 380000000, cat: "Utility", c: "#e2574c", desc: "Shows food saturation and hunger restored.",
      long: "AppleSkin adds food-related information to the HUD: exact saturation and hunger values, how much a food will restore before you eat it, and how fast health regenerates. Tiny, dependency-light, and installed in almost every pack.",
      gallery: ["Saturation overlay", "Food tooltip", "Regen timer"] },
    { id: "rei", name: "Roughly Enough Items (REI)", author: "shedaniel", dl: 300000000, cat: "Utility", c: "#38bdf8", desc: "A clean recipe & item viewer, JEI alternative.",
      long: "REI is a modern recipe viewing mod built for Fabric and Forge. It shows crafting recipes, uses, and lets you search the full item registry. Deep compatibility with tech and magic mods makes it a favourite for large modpacks.",
      gallery: ["Recipe browser", "Item filter", "Cheat mode"] },
    { id: "xaeros", name: "Xaero's Minimap", author: "xaero96", dl: 260000000, cat: "Utility", c: "#f59e0b", desc: "A configurable minimap with waypoints.",
      long: "Xaero's Minimap displays the surrounding terrain, mobs, players, and custom waypoints in the corner of your screen. Fully customizable shape, zoom, and cave mode — pairs with Xaero's World Map for a full mapping suite.",
      gallery: ["Corner minimap", "Waypoint list", "Cave mode"] },
    { id: "supplementaries", name: "Supplementaries", author: "MehVahdJukaar", dl: 110000000, cat: "Utility", c: "#0d9488", desc: "Hundreds of decorative blocks and gadgets.",
      long: "Supplementaries adds a huge collection of vanilla-styled decorative and functional blocks: signs, hanging pots, cannons, faucets, sconces, and more. Everything is designed to feel like it belongs in base Minecraft.",
      gallery: ["Decor blocks", "Cannon build", "Item shelves"] },
    { id: "terralith", name: "Terralith", author: "Stardust Labs", dl: 62000000, cat: "World Gen", c: "#0ea5e9", desc: "Overhauls terrain with 100+ new biomes.",
      long: "Terralith uses vanilla's own datapack system to add over 100 new biomes and reshape terrain into dramatic mountains, canyons, and cave systems — all without breaking compatibility with other world-gen mods.",
      gallery: ["Mountain range", "New biome", "Cave system"] },
    { id: "oculus", name: "Oculus", author: "Asek3", dl: 41000000, cat: "Performance", c: "#a855f7", desc: "Iris shaders port for Forge.",
      long: "Oculus is a Forge port of Iris, letting Forge players run modern shader packs with strong performance. Works alongside Rubidium (the Forge Sodium port) for smooth, good-looking gameplay.",
      gallery: ["Shader lighting", "Water reflections", "Shadow quality"] },
    { id: "cloth", name: "Cloth Config API", author: "shedaniel", dl: 340000000, cat: "Library", c: "#94a3b8", desc: "Config screen library used by many mods.",
      long: "Cloth Config API provides a clean, standardized in-game config screen framework. Many popular Fabric mods depend on it to give you a proper settings menu instead of editing text files.",
      gallery: ["Config screen", "Category tabs", "Search bar"] },
    { id: "createadd", name: "Create: Additions", author: "mrh0", dl: 34000000, cat: "Tech", c: "#b45309", desc: "Bridges Create's kinetics with electricity.",
      long: "Create: Additions adds an electricity layer to Create — alternators, motors, and connectors that convert rotational force to energy and back, letting Create builds talk to other tech mods.",
      gallery: ["Alternator setup", "Motor block", "Energy bridge"] },
    { id: "mekanism", name: "Mekanism", author: "bradyaidanc", dl: 165000000, cat: "Tech", c: "#0284c7", desc: "High-tech machines, ore processing, jetpacks.",
      long: "Mekanism is a sprawling tech mod: multi-step ore processing that up to 5x's your yield, digital miners, jetpacks, teleporters, and endgame fusion reactors. A staple of kitchen-sink modpacks.",
      gallery: ["Ore factory", "Jetpack flight", "Fusion reactor"] },
    { id: "storagedrawers", name: "Storage Drawers", author: "Texelsaur", dl: 140000000, cat: "Tech", c: "#7c4a1e", desc: "Compact, high-capacity item storage drawers.",
      long: "Storage Drawers gives you space-efficient block storage that shows its contents on the front face. Upgrade capacity, lock slots, and pull items out with a click — the tidy alternative to walls of chests.",
      gallery: ["Drawer wall", "Upgrade slots", "Item labels"] },
    { id: "dungeons", name: "When Dungeons Arise", author: "Aureljz", dl: 58000000, cat: "Adventure", c: "#9333ea", desc: "Adds large, hand-built dungeons and structures.",
      long: "When Dungeons Arise scatters big, lovingly hand-designed structures across your world — sky ships, mushroom mines, bandit villages, and more — each with loot worth the fight.",
      gallery: ["Sky ship", "Bandit village", "Loot room"] },
    { id: "iceandfire", name: "Ice and Fire: Dragons", author: "Alexthe666", dl: 76000000, cat: "Mobs", c: "#dc2626", desc: "Tameable dragons and mythical creatures.",
      long: "Ice and Fire adds fire and ice dragons you can hatch, raise, and ride, plus a bestiary of mythical creatures — hippogryphs, cyclopes, sea serpents — and the gear to hunt or befriend them.",
      gallery: ["Fire dragon", "Dragon roost", "Rideable mount"] },
    { id: "chunkyprev", name: "Chunky", author: "pop4959", dl: 52000000, cat: "Utility", c: "#65a30d", desc: "Pre-generate chunks to reduce lag.",
      long: "Chunky pre-generates world chunks in the background so exploration doesn't stutter later. Set a radius, kick it off, and let it build the terrain ahead of time — great for servers.",
      gallery: ["Progress bar", "Region select", "Server console"] },
    { id: "immersive", name: "Immersive Engineering", author: "BluSunrize", dl: 82000000, cat: "Tech", c: "#a16207", desc: "Retro-industrial machines and wiring.",
      long: "Immersive Engineering is a tech mod with a distinct 1920s industrial aesthetic: multiblock machines, hanging power lines you wire by hand, windmills, and dieselpunk gadgets.",
      gallery: ["Powerline grid", "Multiblock", "Windmill tower"] },
    { id: "spark", name: "spark", author: "lucko", dl: 120000000, cat: "Performance", c: "#f97316", desc: "A performance profiler for servers & clients.",
      long: "spark is a lightweight profiler that shows you exactly what's eating your tick time and memory. Run a sampler, open the web report, and pinpoint the mod or mechanic causing lag.",
      gallery: ["Profiler report", "Tick graph", "Heap summary"] },
  ];
  const POPULAR = ["jei", "fabricapi", "create", "sodium", "journeymap", "waystones", "appleskin", "rei", "xaeros", "mekanism"];

  function store() { if (!S().appData) S().appData = {}; if (!S().appData.curseforge) S().appData.curseforge = { installed: [] }; if (!S().appData.curseforge.installed) S().appData.curseforge.installed = []; return S().appData.curseforge; }
  function isInstalled(id) { return store().installed.indexOf(id) >= 0; }
  function toggleInstall(id) { const s = store(); if (isInstalled(id)) s.installed = s.installed.filter((x) => x !== id); else s.installed.push(id); State.save(); }
  function fmtDl(n) { if (n >= 1e9) return (n / 1e9).toFixed(1) + "B"; if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (n >= 1e3) return (n / 1e3).toFixed(0) + "K"; return "" + n; }
  function modIcon(m, cls) { if (m.iconImg) return `<div class="${cls} cf-ic-svg"><img src="${m.iconImg}" alt=""></div>`; if (m.icon) return `<div class="${cls} cf-ic-svg">${m.icon}</div>`; return `<div class="${cls}" style="background:${m.c}">${esc(m.name[0])}</div>`; }
  function downloadIc() { return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>`; }

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
        const card = el(`<div class="cf-card cf-card-click">
          ${modIcon(m, "cf-card-ic")}
          <div class="cf-card-info">
            <div class="cf-card-top"><b>${esc(m.name)}</b><span class="cf-card-cat">${esc(m.cat)}</span></div>
            <div class="cf-card-author">by ${esc(m.author)}</div>
            <div class="cf-card-desc">${esc(m.desc)}</div>
            <div class="cf-card-meta"><span class="cf-dl">${downloadIc()} ${fmtDl(m.dl)}</span></div>
          </div>
          <button class="cf-install ${inst ? "done" : ""}">${inst ? "Installed" : "Install"}</button>
        </div>`);
        card.onclick = (e) => { if (e.target.closest(".cf-install")) return; showModDetails(m); };
        const btn = card.querySelector(".cf-install");
        btn.onclick = () => {
          const wasInst = isInstalled(m.id);
          toggleInstall(m.id);
          if (wasInst) { render(); }
          else { btn.textContent = "Installed"; btn.classList.add("done"); if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("curseforge", "CurseForge") : "", title: "CurseForge", body: m.name + " installed" }); renderGridSoft(); }
        };
        grid.appendChild(card);
      });
    }
    function renderGridSoft() { const nav = body.querySelector('.cf-nav[data-v="installed"]'); if (nav) nav.textContent = "My Mods" + (store().installed.length ? " (" + store().installed.length + ")" : ""); }

    function showModDetails(m) {
      const long = m.long || m.desc;
      const gallery = m.gallery && m.gallery.length ? m.gallery : ["Screenshot 1", "Screenshot 2", "Screenshot 3"];
      const overlay = el(`<div class="cf-modal-ov">
        <div class="cf-modal">
          <button class="cf-modal-x" aria-label="Close">&times;</button>
          <div class="cf-md-hero" style="--cfc:${m.c}"></div>
          <div class="cf-md-head">
            ${modIcon(m, "cf-md-ic")}
            <div class="cf-md-titles">
              <h2>${esc(m.name)}</h2>
              <div class="cf-md-by">by <b>${esc(m.author)}</b> · ${esc(m.cat)}</div>
              <div class="cf-md-stats"><span class="cf-dl">${downloadIc()} ${fmtDl(m.dl)} downloads</span><span class="cf-md-mc">Minecraft: Java Edition</span></div>
            </div>
            <button class="cf-md-install"></button>
          </div>
          <div class="cf-md-body">
            <div class="cf-md-gallery"></div>
            <h3>About this mod</h3>
            <p class="cf-md-desc">${esc(long)}</p>
          </div>
        </div>
      </div>`);
      // Gallery: real screenshots when provided, else generated tiles themed to the mod colour.
      const g = overlay.querySelector(".cf-md-gallery");
      if (m.shots && m.shots.length) {
        g.classList.add("cf-md-gallery-img");
        m.shots.forEach((src) => {
          const tile = el(`<div class="cf-shot cf-shot-img"><img src="${src}" alt=""></div>`);
          tile.querySelector("img").onclick = () => {
            const lb = el(`<div class="cf-lightbox"><img src="${src}" alt=""></div>`);
            lb.onclick = () => lb.remove();
            overlay.appendChild(lb);
          };
          g.appendChild(tile);
        });
      } else {
        gallery.forEach((cap, i) => {
          const tile = el(`<div class="cf-shot" style="--cfc:${m.c};--i:${i}"><div class="cf-shot-grid"></div><span class="cf-shot-cap">${esc(cap)}</span></div>`);
          g.appendChild(tile);
        });
      }
      const instBtn = overlay.querySelector(".cf-md-install");
      function syncBtn() { const inst = isInstalled(m.id); instBtn.textContent = inst ? "Installed ✓" : "Install"; instBtn.classList.toggle("done", inst); }
      syncBtn();
      instBtn.onclick = () => {
        const wasInst = isInstalled(m.id);
        toggleInstall(m.id); syncBtn();
        if (!wasInst && window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("curseforge", "CurseForge") : "", title: "CurseForge", body: m.name + " installed" });
        renderGridSoft();
      };
      const close = () => { overlay.remove(); renderGrid(); };
      overlay.querySelector(".cf-modal-x").onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };
      body.appendChild(overlay);
    }

    render();
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.curseforge = openCurseForge;
})();
