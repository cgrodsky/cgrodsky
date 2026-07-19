/* 3D Minecraft-style sandbox with Three.js: seeded worlds, instanced cube
   rendering, voxel raycasting for mining/placing, AABB physics, first-person
   camera with pointer-lock on desktop and split-screen touch controls on
   tablets. Block textures load from assets/mc_<tex>.png. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const BLOCKS = {
    0:  { name: "Air", solid: false },
    1:  { name: "Grass", color: "#5fa83b", solid: true, hardness: 0.6, drop: 2, tex: "grass", texTop: "grass_top", texBottom: "dirt" },
    2:  { name: "Dirt", color: "#8a5a2b", solid: true, hardness: 0.5, drop: 2, tex: "dirt" },
    3:  { name: "Stone", color: "#8c8c8c", solid: true, hardness: 1.5, drop: 17, tex: "stone" },
    4:  { name: "Log", color: "#6b4a25", solid: true, hardness: 2, drop: 4, tex: "log" },
    5:  { name: "Leaves", color: "#3e9b3e", solid: true, hardness: 0.2, drop: 5, tex: "leaves", cutout: true },
    6:  { name: "Sand", color: "#e3d59b", solid: true, hardness: 0.5, drop: 6, tex: "sand" },
    7:  { name: "Planks", color: "#b08243", solid: true, hardness: 2, drop: 7, tex: "planks" },
    8:  { name: "Glass", color: "#bfe8f5", solid: true, hardness: 0.3, drop: 8, tex: "glass", alpha: 0.5 },
    9:  { name: "Brick", color: "#9e4636", solid: true, hardness: 2, drop: 9, tex: "brick" },
    12: { name: "Coal Ore", color: "#5a5a5a", solid: true, hardness: 2.5, drop: 206, tex: "coal_ore" },
    13: { name: "Iron Ore", color: "#caa472", solid: true, hardness: 3, drop: 13, tex: "iron_ore" },
    14: { name: "Gold Ore", color: "#e6c34a", solid: true, hardness: 3, drop: 14, tex: "gold_ore" },
    15: { name: "Diamond Ore", color: "#4fe0d6", solid: true, hardness: 4, drop: 15, tex: "diamond_ore" },
    16: { name: "Bedrock", color: "#33333a", solid: true, hardness: Infinity, drop: 0, tex: "bedrock" },
    17: { name: "Cobblestone", color: "#7d7d7d", solid: true, hardness: 1.8, drop: 17, tex: "cobblestone" },
    18: { name: "Blue Concrete", color: "#2c39c4", solid: true, hardness: 1.8, drop: 18, tex: "blue_concrete" },
    19: { name: "Purple Concrete", color: "#7e2bc0", solid: true, hardness: 1.8, drop: 19, tex: "purple_concrete" },
    20: { name: "Poppy", color: "#e74c4c", solid: false, plant: true, hardness: 0.05, drop: 20, tex: "poppy" },
    21: { name: "Daisy", color: "#ffffff", solid: false, plant: true, hardness: 0.05, drop: 21, tex: "daisy" },
    22: { name: "Dandelion", color: "#ffd34e", solid: false, plant: true, hardness: 0.05, drop: 22, tex: "yellow_flower" },
    23: { name: "Red Mushroom", color: "#c62828", solid: false, plant: true, hardness: 0.05, drop: 23, tex: "red_mushroom" },
    24: { name: "Brown Mushroom", color: "#8a5a2b", solid: false, plant: true, hardness: 0.05, drop: 24, tex: "brown_mushroom" },
    25: { name: "Emerald Block", color: "#17b463", solid: true, hardness: 5, drop: 25, tex: "emerald" },
    26: { name: "Ancient Debris", color: "#5a3434", solid: true, hardness: 30, drop: 26, tex: "ancient_debris" },
    27: { name: "Stripped Log", color: "#c6a06a", solid: true, hardness: 2, drop: 27, tex: "stripped_log" },
    28: { name: "Deepslate Diamond Ore", color: "#3b6f70", solid: true, hardness: 5, drop: 28, tex: "deepslate_diamond_ore" },
    30: { name: "White Wool", color: "#f9f9f9", solid: true, hardness: 0.8, drop: 30 },
    31: { name: "Light Gray Wool", color: "#9c9d97", solid: true, hardness: 0.8, drop: 31 },
    32: { name: "Gray Wool", color: "#474f52", solid: true, hardness: 0.8, drop: 32 },
    33: { name: "Black Wool", color: "#1d1d21", solid: true, hardness: 0.8, drop: 33 },
    34: { name: "Brown Wool", color: "#835432", solid: true, hardness: 0.8, drop: 34 },
    35: { name: "Red Wool", color: "#b02e26", solid: true, hardness: 0.8, drop: 35 },
    36: { name: "Orange Wool", color: "#f9801d", solid: true, hardness: 0.8, drop: 36 },
    37: { name: "Yellow Wool", color: "#fed83d", solid: true, hardness: 0.8, drop: 37 },
    38: { name: "Lime Wool", color: "#80c71f", solid: true, hardness: 0.8, drop: 38 },
    39: { name: "Green Wool", color: "#5e7c16", solid: true, hardness: 0.8, drop: 39 },
    40: { name: "Cyan Wool", color: "#169c9c", solid: true, hardness: 0.8, drop: 40 },
    41: { name: "Light Blue Wool", color: "#3ab3da", solid: true, hardness: 0.8, drop: 41 },
    42: { name: "Blue Wool", color: "#3c44aa", solid: true, hardness: 0.8, drop: 42 },
    43: { name: "Purple Wool", color: "#8932b8", solid: true, hardness: 0.8, drop: 43 },
    44: { name: "Magenta Wool", color: "#c74ebd", solid: true, hardness: 0.8, drop: 44 },
    45: { name: "Pink Wool", color: "#f38baa", solid: true, hardness: 0.8, drop: 45 },
    46: { name: "Smooth Stone", color: "#a8a8a8", solid: true, hardness: 2, drop: 46 },
    47: { name: "Crying Obsidian", color: "#22075e", solid: true, hardness: 35, drop: 47 },
    48: { name: "Copper Ore", color: "#c87f5a", solid: true, hardness: 3, drop: 48 },
    49: { name: "Deepslate Iron Ore", color: "#6e5b3b", solid: true, hardness: 4.5, drop: 49 },
    50: { name: "Redstone Block", color: "#aa0000", solid: true, hardness: 5, drop: 50 },
    51: { name: "Amethyst Block", color: "#8a5cc5", solid: true, hardness: 1.5, drop: 51 },
    52: { name: "Torch Flower", color: "#f5b800", solid: false, plant: true, hardness: 0.05, drop: 52 },
    53: { name: "Shulker Box", color: "#897691", solid: true, hardness: 2, drop: 53 },
    54: { name: "Glass Pane", color: "#bfe8f5", solid: true, hardness: 0.3, drop: 54, alpha: 0.45 },
    55: { name: "Barrel", color: "#7a532b", solid: true, hardness: 2.5, drop: 55 },
    56: { name: "Portal", color: "#7b3aff", solid: false, liquid: true, alpha: 0.65, danger: true },
    60: { name: "White Stained Glass",  color: "#f9f9f9", solid: true, hardness: 0.3, drop: 60, alpha: 0.5 },
    61: { name: "Red Stained Glass",    color: "#b02e26", solid: true, hardness: 0.3, drop: 61, alpha: 0.5 },
    62: { name: "Orange Stained Glass", color: "#f9801d", solid: true, hardness: 0.3, drop: 62, alpha: 0.5 },
    63: { name: "Yellow Stained Glass", color: "#fed83d", solid: true, hardness: 0.3, drop: 63, alpha: 0.5 },
    64: { name: "Green Stained Glass",  color: "#5e7c16", solid: true, hardness: 0.3, drop: 64, alpha: 0.5 },
    65: { name: "Blue Stained Glass",   color: "#3c44aa", solid: true, hardness: 0.3, drop: 65, alpha: 0.5 },
    66: { name: "Purple Stained Glass", color: "#8932b8", solid: true, hardness: 0.3, drop: 66, alpha: 0.5 },
    67: { name: "Black Stained Glass",  color: "#1d1d21", solid: true, hardness: 0.3, drop: 67, alpha: 0.5 },
    // Craftable blocks
    57: { name: "Crafting Table", color: "#9a6b3f", solid: true, hardness: 2.5, drop: 57, tex: "crafting_table", interact: "craft" },
    58: { name: "Furnace", color: "#6f6f6f", solid: true, hardness: 3.5, drop: 58, tex: "furnace", interact: "furnace" },
    59: { name: "Torch", color: "#ffcf4a", solid: false, plant: true, hardness: 0.05, drop: 59, tex: "torch", light: true },
    68: { name: "Chest", color: "#8a5a2b", solid: true, hardness: 2.5, drop: 68, tex: "chest" },
  };

  // Non-block items live in a separate map so they don't get "placed" as blocks.
  const ENDER_PEARL = 200;
  // Bump when a mc_*.png texture changes — images aren't covered by index.html's ?v=
  const TEXV = "2";
  const ITEMS = {
    200: { name: "Ender Pearl", color: "#14c7a8", item: true, tex: "ender_pearl" },
    201: { name: "Stick", color: "#b08a52", item: true, tex: "stick" },
    202: { name: "Wooden Pickaxe", color: "#b08243", item: true, tex: "wood_pickaxe" },
    203: { name: "Stone Pickaxe", color: "#9a9a9a", item: true, tex: "stone_pickaxe" },
    204: { name: "Wooden Axe", color: "#b08243", item: true, tex: "wood_axe" },
    205: { name: "Wooden Sword", color: "#b08243", item: true, tex: "wood_sword" },
    206: { name: "Coal", color: "#26262a", item: true, tex: "coal" },
    207: { name: "Iron Ingot", color: "#d8d8d8", item: true, tex: "iron_ingot" },
    208: { name: "Gold Ingot", color: "#f2d24a", item: true, tex: "gold_ingot" },
    209: { name: "Stone Sword", color: "#9a9a9a", item: true, tex: "stone_sword" },
  };
  // Tools: mining-speed multiplier + attack damage.
  const TOOLS = {
    202: { kind: "pickaxe", mult: 3, atk: 3 }, 203: { kind: "pickaxe", mult: 5, atk: 4 },
    204: { kind: "axe", mult: 3, atk: 4 }, 205: { kind: "sword", mult: 1.5, atk: 5 }, 209: { kind: "sword", mult: 1.5, atk: 7 },
  };
  // Crafting recipes. `shape` is a minimal (cropped) grid; `shapeless` is a bag of ids.
  // out = [resultId, count]. Ingredient ids: 4=Log 7=Planks 17=Cobblestone 201=Stick 206=Coal
  const RECIPES = [
    { out: [7, 4], shapeless: [4] },
    { out: [201, 4], shape: [[7], [7]] },
    { out: [57, 1], shape: [[7, 7], [7, 7]] },
    { out: [58, 1], shape: [[17, 17, 17], [17, 0, 17], [17, 17, 17]] },
    { out: [68, 1], shape: [[7, 7, 7], [7, 0, 7], [7, 7, 7]] },
    { out: [59, 4], shape: [[206], [201]] },
    { out: [202, 1], shape: [[7, 7, 7], [0, 201, 0], [0, 201, 0]] },
    { out: [203, 1], shape: [[17, 17, 17], [0, 201, 0], [0, 201, 0]] },
    { out: [204, 1], shape: [[7, 7], [7, 201], [0, 201]] },
    { out: [205, 1], shape: [[7], [7], [201]] },
    { out: [209, 1], shape: [[17], [17], [201]] },
    { out: [8, 1], shapeless: [6] },
  ];
  // Furnace smelting: input id -> output id. Fuel: id -> items it can smelt.
  const SMELT = { 13: 207, 14: 208, 6: 8, 17: 3, 3: 46 };
  const FUEL = { 206: 8, 4: 1.5, 7: 1.5, 201: 0.5, 57: 1.5, 68: 1.5 };

  // Match the crafting grid (row-major ids, w×h) against RECIPES → [id,count] or null.
  function matchRecipe(ids, w, h) {
    const nonzero = ids.filter((v) => v);
    if (!nonzero.length) return null;
    // crop bounding box
    let minR = h, maxR = -1, minC = w, maxC = -1;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (ids[r * w + c]) { if (r < minR) minR = r; if (r > maxR) maxR = r; if (c < minC) minC = c; if (c > maxC) maxC = c; }
    const ch = maxR - minR + 1, cw = maxC - minC + 1;
    const crop = [];
    for (let r = 0; r < ch; r++) { const row = []; for (let c = 0; c < cw; c++) row.push(ids[(minR + r) * w + (minC + c)]); crop.push(row); }
    for (const rec of RECIPES) {
      if (rec.shapeless) {
        const a = nonzero.slice().sort((x, y) => x - y), b = rec.shapeless.slice().sort((x, y) => x - y);
        if (a.length === b.length && a.every((v, i) => v === b[i])) return rec.out;
      } else {
        const s = rec.shape;
        if (s.length !== ch || s[0].length !== cw) continue;
        let ok = true;
        for (let r = 0; r < ch && ok; r++) for (let c = 0; c < cw; c++) if ((s[r][c] || 0) !== (crop[r][c] || 0)) { ok = false; break; }
        if (ok) return rec.out;
      }
    }
    return null;
  }

  // Every teleport in the game shares this sound (ender pearl, portal, …).
  const TELEPORT_SFX = "SFX_008";

  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cell(seed, x, y) {
    let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Exact-replica Mojang Studios loading screen with the bottom progress bar.
  function mojangLoad(body, done) {
    body.innerHTML = `<div class="mojang-load">
      <div class="mojang-logo"><div class="mojang-word">MOJANG</div><div class="mojang-studios">STUDIOS</div></div>
      <div class="mojang-bar"><div class="mojang-bar-fill"></div></div>
      <div class="mojang-tm">&#169; Mojang AB</div>
    </div>`;
    const fill = body.querySelector(".mojang-bar-fill");
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 16 + 7;
      if (p >= 100) { fill.style.width = "100%"; clearInterval(iv); setTimeout(done, 420); }
      else fill.style.width = p + "%";
    }, 150);
  }
  window.MojangIntro = mojangLoad;

  // Forge-style mod-loading screen shown after the Mojang intro when the player
  // has "installed" mods in CurseForge. Lists the actual installed mod names.
  function modLoad(body, done) {
    let names = [];
    try { if (window.CurseForgeAPI) names = window.CurseForgeAPI.installedNames() || []; } catch (_) {}
    if (!names.length) { done(); return; }
    const total = names.length;
    body.innerHTML = `<div class="fml-load">
      <div class="fml-title">Minecraft Forge</div>
      <div class="fml-sub">Loading ${total} mod${total === 1 ? "" : "s"}</div>
      <div class="fml-bar"><div class="fml-bar-fill"></div></div>
      <div class="fml-cur">Constructing mods…</div>
      <div class="fml-list"></div>
    </div>`;
    const fill = body.querySelector(".fml-bar-fill");
    const cur = body.querySelector(".fml-cur");
    const listEl = body.querySelector(".fml-list");
    const stages = ["Constructing", "Pre-initializing", "Initializing", "Post-initializing", "Loading"];
    let i = 0;
    const iv = setInterval(() => {
      const name = names[i] || names[names.length - 1];
      const stage = stages[Math.floor(Math.random() * stages.length)];
      cur.textContent = stage + " " + name + "…";
      const row = document.createElement("div");
      row.className = "fml-row";
      row.textContent = "✔ " + name;
      listEl.appendChild(row);
      while (listEl.childElementCount > 6) listEl.removeChild(listEl.firstChild);
      i++;
      fill.style.width = Math.min(100, (i / total) * 100) + "%";
      if (i >= total) { clearInterval(iv); setTimeout(done, 500); }
    }, Math.max(160, Math.min(520, 1600 / total)));
  }

  AppRegistry.minecraft = function (opts) {
    // Opens showing the Java icon (like Minecraft Java launching), then swaps
    // to the Minecraft icon after 2 seconds.
    const ref = cw({ title: "Mincraft", icon: Icon.mini("java", "Java"), width: 900, height: 640, appId: "minecraft" });
    setTimeout(() => { if (window.WM && window.WM.setWindowIcon) window.WM.setWindowIcon(ref.win, Icon.mini("minecraft", "Mincraft")); }, 2000);
    if (S().appData.minecraft == null) S().appData.minecraft = { sound: true, fullscreen: false, showFps: false };
    const toMenu = () => menu(ref.body, ref);
    if (opts && opts.skipIntro) toMenu();
    else mojangLoad(ref.body, () => modLoad(ref.body, toMenu));
  };

  function installedMods() { try { if (window.CurseForgeAPI) return window.CurseForgeAPI.installedNames() || []; } catch (_) {} return []; }

  function menu(body, ref) {
    const mods = installedMods();
    const modsBtn = mods.length ? `<div class="mc-button full" data-act="mods"><div class="title">Mods (${mods.length})</div></div>` : "";
    body.innerHTML = `<div class="mc-root mc-home">
      <div class="mc-header">
        <img src="assets/minecraft_header.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div class="mc-header-fallback" style="display:none">MINCRAFT</div>
      </div>
      <div class="mc-menu">
        <div class="mc-button full" data-act="play"><div class="title">Singleplayer</div></div>
        <div class="mc-button full" data-act="multi"><div class="title">Multiplayer</div></div>
        <div class="mc-button full" data-act="realms"><div class="title">Minecraft Realms</div></div>
        ${modsBtn}
        <div class="double">
          <div class="mc-button full" data-act="opts"><div class="title">Options</div></div>
          <div class="mc-button full" data-act="credits"><div class="title">The End</div></div>
        </div>
        <div class="mc-button full" data-act="quit"><div class="title">Quit Game</div></div>
        <div class="mc-button full lang" data-act="lang"><div class="title">EN</div></div>
      </div>
      <div class="mc-splash-text">100% 3D!</div>
      <div class="mc-version">Windows 12 Edition${mods.length ? " · Forge" : ""}</div>
    </div>`;
    const act = {
      play: () => createWorld(body, ref),
      opts: () => options(body, ref),
      mods: () => modsScreen(body, ref),
      credits: () => endSequence(body, ref),
      quit: () => ref.close(),
      multi: () => Notify.show({ icon: "", title: "Multiplayer", body: "No servers reachable in the simulation." }),
      realms: () => Notify.show({ icon: "", title: "Realms", body: "Realms isn't available here." }),
      lang: () => {},
    };
    body.querySelectorAll(".mc-button").forEach((b) => b.onclick = () => (act[b.dataset.act] || (() => {}))());
  }

  // Forge-style mod list, populated from the mods "installed" in CurseForge.
  function modsScreen(body, ref) {
    const mods = installedMods();
    body.innerHTML = `<div class="mc-root mc-optscreen mc-mods">
      <div class="mc-title">Mods</div>
      <div class="mc-mods-count">${mods.length} mod${mods.length === 1 ? "" : "s"} loaded</div>
      <div class="mc-mods-list">${mods.map((n, i) => `<div class="mc-mod-row"><span class="mc-mod-ic" style="background:hsl(${(i * 47) % 360} 55% 45%)">${(n[0] || "M").toUpperCase()}</span><div class="mc-mod-txt"><b>${n.replace(/[<>&]/g, "")}</b><span>Loaded · Minecraft Forge</span></div></div>`).join("") || `<div class="mc-mods-empty">No mods installed. Install some in CurseForge.</div>`}</div>
      <button class="mc-btn" id="modsdone" style="margin-top:16px">Done</button>
    </div>`;
    body.querySelector("#modsdone").onclick = () => menu(body, ref);
  }

  // End-game credits sequence: drifting particles + slow-scrolling two-voice text
  // using Minecraft's § colour codes. The text below is ORIGINAL (the real End Poem
  // is a copyrighted work); credits are brief factual attribution.
  const MC_COL = { "0": "#000000", "1": "#0000AA", "2": "#00AA00", "3": "#00AAAA", "4": "#AA0000", "5": "#AA00AA", "6": "#FFAA00", "7": "#AAAAAA", "8": "#555555", "9": "#5555FF", a: "#55FF55", b: "#55FFFF", c: "#FF5555", d: "#FF55FF", e: "#FFFF55", f: "#FFFFFF" };
  const END_TEXT = [
    "§3Another one has reached the end.",
    "",
    "§2The builder? The one who never stopped digging?",
    "",
    "§3Yes. It shaped a whole world out of almost nothing.",
    "",
    "§2It believes these blocks are the universe.",
    "",
    "§3Let it believe. The dream is gentler than the waking.",
    "",
    "§2It carried §f§klanterns§r §2into the dark and called it courage.",
    "",
    "§3It fell a thousand times and stood up a thousand and one.",
    "",
    "§2Does it know we were here, watching?",
    "",
    "§3It senses something beyond the screen. That is enough.",
    "",
    "§2Then tell it the one thing it needs.",
    "",
    "§3That the light it searched for was the light it carried in.",
    "",
    "§2That the world it made is truer than it dares to think.",
    "",
    "§3Player. The game is only resting now.",
    "",
    "§2Feel your hands. Feel the floor beneath you.",
    "",
    "§3You made it this far. That was never nothing.",
    "",
    "§2Now wake up — and go build something real.",
    "",
    "",
    "",
    "§6Minecraft",
    "§7created by Markus \"Notch\" Persson & Mojang Studios",
    "§7music by Daniel Rosenfeld (C418)",
    "",
    "§bWindows 12 Edition",
    "§7a fan-made simulation",
    "",
    "",
    "§aThank you for playing.",
    "",
    "",
  ];
  function endSequence(body, ref) {
    const esch = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    function fmt(line) {
      if (line === "") return "<div class=\"mc-end-line\">&nbsp;</div>";
      let out = "", color = "#fff", obf = false;
      const parts = line.split("§");
      const add = (t) => { if (!t) return; if (obf) out += `<span class="mc-obf" style="color:${color}" data-len="${t.length}">${esch(t)}</span>`; else out += `<span style="color:${color}">${esch(t)}</span>`; };
      add(parts[0]);
      for (let i = 1; i < parts.length; i++) { const c = parts[i][0], rest = parts[i].slice(1); if (c === "k") obf = true; else if (c === "r") { color = "#fff"; obf = false; } else if (MC_COL[c]) { color = MC_COL[c]; obf = false; } add(rest); }
      return `<div class="mc-end-line">${out}</div>`;
    }
    const ov = el(`<div class="mc-end"><div class="mc-end-sky"></div><div class="mc-end-scroll">${END_TEXT.map(fmt).join("")}</div><div class="mc-end-hint">click to skip</div></div>`);
    const sky = ov.querySelector(".mc-end-sky");
    for (let i = 0; i < 16; i++) {
      const px = el(`<span class="mc-end-p"></span>`);
      px.style.left = (Math.random() * 100) + "%"; px.style.top = (Math.random() * 100) + "%";
      px.style.animationDelay = (-Math.random() * 24) + "s"; px.style.animationDuration = (18 + Math.random() * 22) + "s";
      const s = 16 + Math.random() * 46; px.style.width = s + "px"; px.style.height = s + "px"; px.style.opacity = 0.05 + Math.random() * 0.14;
      sky.appendChild(px);
    }
    body.innerHTML = ""; body.appendChild(ov);
    // glitch the obfuscated (§k) spans
    const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/\\|#*+";
    const obfEls = [...ov.querySelectorAll(".mc-obf")];
    const obfIv = setInterval(() => { obfEls.forEach((e) => { const n = +e.dataset.len; let s = ""; for (let j = 0; j < n; j++) s += CH[Math.floor(Math.random() * CH.length)]; e.textContent = s; }); }, 55);
    // slow cinematic scroll (JS-driven for reliable timing)
    const scroll = ov.querySelector(".mc-end-scroll");
    let raf = null, done = false;
    function finish() { if (done) return; done = true; clearInterval(obfIv); cancelAnimationFrame(raf); menu(body, ref); }
    requestAnimationFrame(() => {
      let y = ov.clientHeight, endY = -scroll.scrollHeight - 20, last = 0;
      scroll.style.transform = "translateY(" + y + "px)";
      function step(ts) {
        if (!last) last = ts; const dt = Math.min(60, ts - last); last = ts;
        y -= 42 * dt / 1000;                        // ~42px per second
        scroll.style.transform = "translateY(" + y + "px)";
        if (y <= endY) { finish(); return; }
        raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
    });
    ov.onclick = finish;
  }

  function createWorld(body, ref) {
    body.innerHTML = `<div class="mc-root mc-optscreen">
      <div class="mc-title">Create New World</div>
      <div class="mc-opts">
        <div class="mc-opt-row"><span>World Seed</span><input id="seed" class="mc-seed" placeholder="leave blank for random"></div>
        <div class="mc-opt-row"><span>Mode</span><span id="mode" style="cursor:pointer">Survival</span></div>
      </div>
      <div class="row" style="gap:10px;margin-top:18px">
        <button class="mc-btn" id="create">Create New World</button>
        <button class="mc-btn" id="back">Cancel</button>
      </div>
    </div>`;
    let creative = false;
    body.querySelector("#mode").onclick = (e) => { creative = !creative; e.target.textContent = creative ? "Creative" : "Survival"; };
    body.querySelector("#back").onclick = () => menu(body, ref);
    body.querySelector("#create").onclick = () => {
      let seedStr = body.querySelector("#seed").value.trim();
      if (!seedStr) seedStr = String(Math.floor(Math.random() * 1e9));
      game(body, ref, seedStr, creative);
    };
  }

  function options(body, ref) {
    const cfg = S().appData.minecraft;
    body.innerHTML = `<div class="mc-root mc-optscreen">
      <div class="mc-title">Options</div>
      <div class="mc-opts">
        <div class="mc-opt-row"><span>Sound</span><label class="switch"><input class="toggle" type="checkbox" id="o-sound"><span class="slider"></span></label></div>
        <div class="mc-opt-row"><span>Fullscreen</span><label class="switch"><input class="toggle" type="checkbox" id="o-fs"><span class="slider"></span></label></div>
        <div class="mc-opt-row"><span>Show FPS</span><label class="switch"><input class="toggle" type="checkbox" id="o-fps"><span class="slider"></span></label></div>
      </div>
      <button class="mc-btn" id="back" style="margin-top:20px">Done</button>
    </div>`;
    const snd = body.querySelector("#o-sound"), fs = body.querySelector("#o-fs"), fps = body.querySelector("#o-fps");
    snd.checked = !!cfg.sound; fs.checked = !!cfg.fullscreen; fps.checked = !!cfg.showFps;
    snd.onchange = () => { cfg.sound = snd.checked; State.save(); };
    fps.onchange = () => { cfg.showFps = fps.checked; State.save(); };
    fs.onchange = () => {
      cfg.fullscreen = fs.checked; State.save();
      const root = body.querySelector(".mc-root") || body;
      if (fs.checked) { if (root.requestFullscreen) root.requestFullscreen().catch(() => {}); }
      else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    body.querySelector("#back").onclick = () => menu(body, ref);
  }

  // ===================== 3D GAME (infinite, chunked) =====================
  function game(body, ref, seedStr, creative) {
    if (typeof THREE === "undefined") {
      body.innerHTML = `<div class="mc-root mc-optscreen">
        <div class="mc-title">3D engine not loaded</div>
        <p style="color:#fff;text-shadow:2px 2px #000;margin:0">Three.js failed to load. Check connection and refresh.</p>
        <button class="mc-btn" id="back" style="margin-top:18px">Back</button></div>`;
      body.querySelector("#back").onclick = () => menu(body, ref);
      return;
    }

    const cfg = S().appData.minecraft;
    const CH = 16, H = 48, RENDER = 3;          // chunk size, world height, chunk render radius
    const seed = hashSeed(seedStr);
    const rng = mulberry32(seed);
    const p1 = rng() * 6.28, p2 = rng() * 6.28, p3 = rng() * 6.28, p4 = rng() * 6.28;

    body.innerHTML = `<div class="mc-root mc-game3d">
      <canvas class="mc3-canvas"></canvas>
      <div class="mc3-crosshair"></div>
      <div class="mc3-hurt"></div>
      <div class="mc3-hud">
        <div class="mc3-stats" style="display:${creative ? "none" : "flex"}"><div class="mc3-hearts"></div><div class="mc3-hunger"></div></div>
        <div class="mc3-xprow" style="display:${creative ? "none" : "flex"}"><span class="mc3-xp-lvl">0</span><div class="mc3-xp"><div class="mc3-xp-fill"></div></div></div>
        <div class="mc-hotbar"></div>
      </div>
      <div class="mc3-help">Drag right to look · left to move · tap right to mine/hit · + to place · E for inventory · seed: ${seedStr}</div>
      <button class="mc3-btn mc3-inv" title="Inventory">▤</button>
      <button class="mc3-btn mc3-jump" title="Jump">▲</button>
      <button class="mc3-btn mc3-place" title="Place">+</button>
      <div class="mc-fps" style="display:${cfg.showFps ? "block" : "none"}">0 fps</div>
      <div class="mc-inv" style="display:none"></div>
      <div class="mc-death" style="display:none">
        <div class="mc-death-card"><h1>You Died!</h1><p id="deathmsg"></p>
        <button class="mc-btn" id="respawn">Respawn</button>
        <button class="mc-btn" id="toMenu">Title screen</button></div>
      </div>
    </div>`;

    const canvas = body.querySelector(".mc3-canvas");
    const heartsEl = body.querySelector(".mc3-hearts");
    const fpsEl = body.querySelector(".mc-fps");
    const deathEl = body.querySelector(".mc-death");
    const hurtEl = body.querySelector(".mc3-hurt");
    const invEl = body.querySelector(".mc-inv");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    const SKY = 0x88c8f0;
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.Fog(SKY, CH * (RENDER - 1), CH * RENDER + 6);
    const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 260);
    scene.add(camera);                          // camera in graph so the held-hand child renders
    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const sun = new THREE.DirectionalLight(0xffffff, 0.5);
    sun.position.set(0.5, 1, 0.3); scene.add(sun);

    // ---------- geometry & materials ----------
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const crossGeo = (function () {
      const g = new THREE.BufferGeometry();
      const a = -0.5, b = 0.5;
      const v = [
        // plane 1
        a, a, a,  b, a, b,  b, b, b,   a, a, a,  b, b, b,  a, b, a,
        // plane 2
        a, a, b,  b, a, a,  b, b, a,   a, a, b,  b, b, a,  a, b, b,
      ];
      const uv = [
        0, 0, 1, 0, 1, 1,  0, 0, 1, 1, 0, 1,
        0, 0, 1, 0, 1, 1,  0, 0, 1, 1, 0, 1,
      ];
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      return g;
    })();

    const materials = {};
    const textures = {};
    function makeFaceMat(b, texKey) {
      const m = new THREE.MeshLambertMaterial({
        color: new THREE.Color(b.color || "#ffffff"),
        transparent: !!b.alpha || !!b.plant || !!b.cutout,
        opacity: b.alpha != null ? b.alpha : 1,
        alphaTest: (b.plant || b.cutout) ? 0.5 : 0,
        side: b.plant ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (texKey) {
        new THREE.TextureLoader().load("assets/mc_" + texKey + ".png?v=" + TEXV, (tex) => {
          tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
          textures[texKey] = tex; m.map = tex; m.color.setHex(0xffffff); m.needsUpdate = true;
        }, undefined, () => {});
      }
      return m;
    }
    function materialFor(id) {
      if (materials[id]) return materials[id];
      const b = BLOCKS[id];
      if (b.texTop || b.texBottom || b.texSide) {
        const side = b.texSide || b.tex, top = b.texTop || b.tex, bot = b.texBottom || b.tex;
        materials[id] = [makeFaceMat(b, side), makeFaceMat(b, side), makeFaceMat(b, top), makeFaceMat(b, bot), makeFaceMat(b, side), makeFaceMat(b, side)];
      } else {
        materials[id] = makeFaceMat(b, b.tex);
      }
      return materials[id];
    }

    // ---------- world storage (infinite via chunks + edit overlay) ----------
    const chunks = new Map();                    // "cx,cz" -> { blocks:Uint8Array, meshes:{}, dirty }
    const edits = new Map();                     // "x,y,z" -> id (player changes survive chunk unload)
    const cKey = (cx, cz) => cx + "," + cz;
    const lidx = (lx, y, lz) => (y * CH + lz) * CH + lx;

    function heightAt(x, z) {
      let h = Math.floor(H * 0.42)
        + Math.sin(x * 0.045 + p1) * 3.5
        + Math.sin(z * 0.05 + p2) * 3.5
        + Math.sin((x + z) * 0.02 + p3) * 5
        + Math.sin((x - z) * 0.03 + p4) * 2.5
        + Math.sin(x * 0.13 + p2) * 1.1 + Math.sin(z * 0.11 + p1) * 1.1;
      h = Math.round(h);
      return Math.max(4, Math.min(H - 8, h));
    }
    const villageHere = (cx, cz) => cell(seed ^ 0x5EED, cx, cz) < 0.02;
    function treeAt(x, z) {
      if (cell(seed ^ 0xBEEF, x, z) >= 0.018) return false;
      return true;
    }
    function genChunk(cx, cz) {
      const blocks = new Uint8Array(CH * H * CH);
      const X0 = cx * CH, Z0 = cz * CH;
      for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
        const X = X0 + lx, Z = Z0 + lz, h = heightAt(X, Z);
        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = 16;
          else if (y === h) id = 1;
          else if (y >= h - 3) id = 2;
          else {
            id = 3;
            const r = cell(seed, X + y * 17, Z + y * 31);
            if (y < h - 8) { if (r < 0.012) id = 15; else if (r < 0.026) id = 14; }
            if (id === 3) { if (r < 0.05) id = 13; else if (r < 0.11) id = 12; }
          }
          blocks[lidx(lx, y, lz)] = id;
        }
        // flowers / mushrooms on grass
        if (h + 1 < H && blocks[lidx(lx, h, lz)] === 1) {
          const r = cell(seed ^ 0xF10E, X, Z);
          if (r < 0.05) blocks[lidx(lx, h + 1, lz)] = [20, 21, 22][Math.floor(cell(seed ^ 0xAAAA, X, Z) * 3)];
          else if (r < 0.065) blocks[lidx(lx, h + 1, lz)] = 23 + Math.floor(cell(seed ^ 0xBBBB, X, Z) * 2);
        }
      }
      // trees (scan a 2-block margin so cross-chunk leaves stay consistent)
      for (let tz = Z0 - 2; tz < Z0 + CH + 2; tz++) for (let tx = X0 - 2; tx < X0 + CH + 2; tx++) {
        if (!treeAt(tx, tz)) continue;
        const sy = heightAt(tx, tz);
        const th = 4 + Math.floor(cell(seed ^ 0xC0DE, tx, tz) * 2);
        const put = (X, Y, Z, id, onlyAir) => {
          const llx = X - X0, llz = Z - Z0;
          if (llx < 0 || llx >= CH || llz < 0 || llz >= CH || Y < 0 || Y >= H) return;
          const k = lidx(llx, Y, llz);
          if (onlyAir && blocks[k] !== 0) return;
          blocks[k] = id;
        };
        for (let t = 1; t <= th; t++) put(tx, sy + t, tz, 4, false);
        for (let dy = th - 1; dy <= th + 1; dy++)
          for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
            const rr = Math.abs(dx) + Math.abs(dz) + (dy === th + 1 ? 1 : 0);
            if (rr > 3) continue;
            put(tx + dx, sy + dy, tz + dz, 5, true);
          }
      }
      // a small village house in rare chunks
      if (villageHere(cx, cz)) {
        const bx = X0 + 5, bz = Z0 + 5, fy = heightAt(bx + 2, bz + 2);
        const put = (X, Y, Z, id) => {
          const llx = X - X0, llz = Z - Z0;
          if (llx < 0 || llx >= CH || llz < 0 || llz >= CH || Y < 0 || Y >= H) return;
          blocks[lidx(llx, Y, llz)] = id;
        };
        for (let dz = 0; dz < 5; dz++) for (let dx = 0; dx < 5; dx++) {
          put(bx + dx, fy, bz + dz, 7);                         // floor
          for (let wy = 1; wy <= 3; wy++) {
            const edge = dx === 0 || dx === 4 || dz === 0 || dz === 4;
            const door = dz === 0 && dx === 2 && wy <= 2;
            if (edge && !door) put(bx + dx, fy + wy, bz + dz, dz === 0 || dz === 4 ? 4 : 7);
          }
          put(bx + dx, fy + 4, bz + dz, 7);                      // roof
        }
      }
      return { blocks, meshes: {}, dirty: true };
    }
    function getChunk(cx, cz) {
      const k = cKey(cx, cz);
      let c = chunks.get(k);
      if (!c) { c = genChunk(cx, cz); chunks.set(k, c); }
      return c;
    }
    function getBlock(x, y, z) {
      if (y < 0) return 16;
      if (y >= H) return 0;
      const ek = x + "," + y + "," + z;
      if (edits.has(ek)) return edits.get(ek);
      const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
      const c = getChunk(cx, cz);
      return c.blocks[lidx(x - cx * CH, y, z - cz * CH)];
    }
    function setBlock(x, y, z, id) {
      edits.set(x + "," + y + "," + z, id);
      const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
      const c = chunks.get(cKey(cx, cz));
      if (c) { c.blocks[lidx(x - cx * CH, y, z - cz * CH)] = id; c.dirty = true; }
      // dirty neighbours on borders so their faces update
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oz]) => {
        const nc = chunks.get(cKey(Math.floor((x + ox) / CH), Math.floor((z + oz) / CH)));
        if (nc && nc !== c) nc.dirty = true;
      });
    }
    function solid(x, y, z) { const b = BLOCKS[getBlock(x, y, z)]; return !!(b && b.solid); }
    function surfaceY(x, z) { let y = H - 1; while (y > 0 && !solid(x, y - 1, z)) y--; return y; }

    // ---------- chunk meshing ----------
    const dummyObj = new THREE.Object3D();
    function isExposed(x, y, z) {
      const b = BLOCKS[getBlock(x, y, z)];
      if (!b) return false;
      if (b.plant) return true;
      return !solid(x + 1, y, z) || !solid(x - 1, y, z) || !solid(x, y + 1, z) || !solid(x, y - 1, z) || !solid(x, y, z + 1) || !solid(x, y, z - 1);
    }
    function buildChunkMesh(cx, cz, c) {
      Object.values(c.meshes).forEach((m) => scene.remove(m));
      c.meshes = {};
      const X0 = cx * CH, Z0 = cz * CH;
      const positions = {};
      for (let y = 0; y < H; y++) for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
        const id = c.blocks[lidx(lx, y, lz)];
        if (id === 0) continue;
        const X = X0 + lx, Z = Z0 + lz;
        if (!isExposed(X, y, Z)) continue;
        (positions[id] = positions[id] || []).push(X, y, Z);
      }
      Object.keys(positions).forEach((idStr) => {
        const id = +idStr, arr = positions[id], n = arr.length / 3;
        const geo = BLOCKS[id].plant ? crossGeo : cube;
        const mesh = new THREE.InstancedMesh(geo, materialFor(id), n);
        for (let i = 0; i < n; i++) {
          dummyObj.position.set(arr[i * 3] + 0.5, arr[i * 3 + 1] + 0.5, arr[i * 3 + 2] + 0.5);
          dummyObj.updateMatrix();
          mesh.setMatrixAt(i, dummyObj.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        scene.add(mesh);
        c.meshes[id] = mesh;
      });
      c.dirty = false;
    }
    function updateChunks(budget) {
      const pcx = Math.floor(player.pos.x / CH), pcz = Math.floor(player.pos.z / CH);
      const want = [];
      for (let dz = -RENDER; dz <= RENDER; dz++) for (let dx = -RENDER; dx <= RENDER; dx++) {
        if (dx * dx + dz * dz > RENDER * RENDER + 1) continue;
        want.push({ cx: pcx + dx, cz: pcz + dz, d: dx * dx + dz * dz });
      }
      want.sort((a, b) => a.d - b.d);
      let built = 0;
      const wantSet = new Set();
      for (const w of want) {
        wantSet.add(cKey(w.cx, w.cz));
        const c = getChunk(w.cx, w.cz);
        if (c.dirty && built < budget) { buildChunkMesh(w.cx, w.cz, c); built++; }
      }
      // unload far chunks (keep edits)
      for (const [k, c] of chunks) {
        const [ccx, ccz] = k.split(",").map(Number);
        if (Math.abs(ccx - pcx) > RENDER + 1 || Math.abs(ccz - pcz) > RENDER + 1) {
          Object.values(c.meshes).forEach((m) => scene.remove(m));
          chunks.delete(k);
        }
      }
    }

    // block highlight + crack overlay
    const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)), new THREE.LineBasicMaterial({ color: 0x000000 }));
    hl.visible = false; scene.add(hl);
    const crackTextures = new Array(5).fill(null);
    ["IMG_0591", "IMG_0593", "IMG_0594", "IMG_0595", "IMG_0596"].forEach((n, i) => {
      new THREE.TextureLoader().load("assets/raw/" + n + ".png", (t) => { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; crackTextures[i] = t; });
    });
    const crackMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), crackMat);
    crackMesh.visible = false; scene.add(crackMesh);

    // ---------- first-person hand / held item ----------
    const handGroup = new THREE.Group();
    camera.add(handGroup);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.62), new THREE.MeshLambertMaterial({ color: 0xe6b58c }));
    arm.position.set(0.52, -0.46, -0.7); arm.rotation.set(-0.2, 0.35, -0.15);
    handGroup.add(arm);
    const heldBlock = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    heldBlock.scale.set(0.34, 0.34, 0.34); heldBlock.position.set(0.55, -0.5, -0.78); heldBlock.rotation.set(0.3, 0.6, 0);
    heldBlock.visible = false; handGroup.add(heldBlock);
    let swingT = 0;
    function swing() { swingT = 1; }
    function updateHand() {
      const id = hotbar[selected], b = BLOCKS[id];
      if (b && b.solid && b.tex) { heldBlock.material = materialFor(id); heldBlock.visible = true; arm.visible = false; }
      else { heldBlock.visible = false; arm.visible = true; }
    }

    // ---------- player ----------
    const spawnX = 0.5, spawnZ = 0.5, spawnY = heightAt(0, 0) + 1;
    const player = { pos: new THREE.Vector3(spawnX, spawnY + 0.1, spawnZ), vel: new THREE.Vector3(), yaw: 0, pitch: 0, onGround: false, hp: 20, dead: false, fallStart: null, hurtCd: 0 };

    const inv = {};
    let hotbar = [], selected = 0;
    if (creative) { hotbar = [1, 3, 4, 7, 18, 19, 25, 20, ENDER_PEARL]; hotbar.forEach((id) => inv[id] = Infinity); }
    // survival: start with an empty inventory (no items)
    const meta = (id) => BLOCKS[id] || ITEMS[id] || null;
    const hbEl = body.querySelector(".mc-hotbar");
    function addItem(id, n) { if (!id) return; inv[id] = (inv[id] === Infinity ? Infinity : (inv[id] || 0) + n); if (!hotbar.includes(id) && hotbar.length < 9) hotbar.push(id); drawHotbar(); }
    function slotHtml(id, cnt, i, sel) {
      const b = id ? meta(id) : null;
      const sw = b ? (b.tex ? `<img class="mc-slot-sw mc-slot-tex" src="assets/mc_${b.tex}.png?v=${TEXV}" alt="" onerror="this.outerHTML='<span class=\\'mc-slot-sw\\' style=\\'background:${b.color || "#888"}\\'></span>'">` : `<span class="mc-slot-sw ${b.item ? "mc-slot-item" : ""}" style="background:${b.color || "#888"}"></span>`) : "";
      return `<div class="mc-slot ${i === sel ? "sel" : ""}" data-i="${i}" title="${b ? b.name : ""}">${sw}${b && cnt !== Infinity ? `<span class="mc-slot-c">${cnt}</span>` : ""}<span class="mc-slot-n">${i + 1}</span></div>`;
    }
    function drawHotbar() {
      hbEl.innerHTML = "";
      for (let i = 0; i < 9; i++) {
        const id = hotbar[i], cnt = id ? inv[id] : 0;
        const slot = el(slotHtml(id, cnt, i, selected));
        slot.onclick = () => { selected = i; drawHotbar(); updateHand(); };
        hbEl.appendChild(slot);
      }
      updateHand();
    }
    drawHotbar();
    function drawHearts() {
      if (creative) { heartsEl.innerHTML = ""; return; }
      let html = "";
      for (let i = 0; i < 10; i++) {
        const f = player.hp - i * 2;
        const src = f >= 2 ? "assets/mc_heart_full.png" : f === 1 ? "assets/mc_heart_half.png" : "assets/mc_heart_full.png";
        html += `<span class="mc3-heart ${f <= 0 ? "h-empty" : ""}"><img src="${src}" alt=""></span>`;
      }
      heartsEl.innerHTML = html;
    }
    drawHearts();
    // hunger (survival): 10 drumsticks, depletes with activity, regenerates HP when full
    const hungerEl = body.querySelector(".mc3-hunger");
    player.hunger = 20;
    function drawHunger() {
      if (creative || !hungerEl) { if (hungerEl) hungerEl.innerHTML = ""; return; }
      let html = "";
      for (let i = 0; i < 10; i++) { const f = player.hunger - i * 2; html += `<span class="mc3-drum ${f >= 2 ? "d-full" : f === 1 ? "d-half" : "d-empty"}"></span>`; }
      hungerEl.innerHTML = html;
    }
    drawHunger();
    let hungerAcc = 0, regenAcc = 0;
    function updateSurvival(dt) {
      if (creative || player.dead) return;
      const moving = Math.abs(player.vel.x) + Math.abs(player.vel.z) > 0.5;
      hungerAcc += dt * (moving ? 1.5 : 0.5);
      if (hungerAcc > 9000 && player.hunger > 0) { player.hunger--; hungerAcc = 0; drawHunger(); }
      if (player.hunger >= 18 && player.hp < 20) { regenAcc += dt; if (regenAcc > 3000) { player.hp = Math.min(20, player.hp + 1); regenAcc = 0; drawHearts(); } }
      else if (player.hunger === 0) { regenAcc += dt; if (regenAcc > 4000) { player.hp = Math.max(1, player.hp - 1); regenAcc = 0; drawHearts(); } }
    }

    // ---------- XP ----------
    const ORE_XP = { 12: 1, 13: 2, 14: 2, 15: 5, 25: 6, 26: 4, 28: 6, 48: 1, 49: 3, 50: 4, 51: 4 };
    let xp = 0, xpLevel = 0;
    const xpFill = body.querySelector(".mc3-xp-fill"), xpLvlEl = body.querySelector(".mc3-xp-lvl");
    const xpForLevel = (l) => 5 + l * 2;
    function drawXp() { const need = xpForLevel(xpLevel); if (xpFill) xpFill.style.width = Math.min(100, xp / need * 100) + "%"; if (xpLvlEl) xpLvlEl.textContent = xpLevel; }
    function addXp(n) { xp += n; let need = xpForLevel(xpLevel); while (xp >= need) { xp -= need; xpLevel++; need = xpForLevel(xpLevel); } drawXp(); playSfx("SFX_023"); }
    drawXp();

    function playSfx(name) { if (!cfg.sound) return; try { const a = new Audio("assets/raw/" + name + ".mp3"); a.volume = 0.5; a.play().catch(() => {}); } catch (_) {} }
    // Play a raw file with its own extension (mob sounds are .wav for Safari support).
    function playSound(file, vol) { if (!cfg.sound) return; try { const a = new Audio("assets/raw/" + file); a.volume = vol == null ? 0.6 : vol; a.play().catch(() => {}); } catch (_) {} }

    // ---------- raycast / targeting ----------
    function raycastVoxel(origin, dir, maxDist) {
      let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
      const dx = Math.sign(dir.x), dy = Math.sign(dir.y), dz = Math.sign(dir.z);
      const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z);
      const nextT = (o, d, v) => d > 0 ? ((v + 1) - o) / d : d < 0 ? (v - o) / d : Infinity;
      let tx = nextT(origin.x, dir.x, x), ty = nextT(origin.y, dir.y, y), tz = nextT(origin.z, dir.z, z);
      let px = x, py = y, pz = z;
      for (let i = 0; i < 90; i++) {
        if (solid(x, y, z)) return { x, y, z, prev: { x: px, y: py, z: pz } };
        px = x; py = y; pz = z;
        if (tx < ty && tx < tz) { if (tx > maxDist) return null; x += dx; tx += tdx; }
        else if (ty < tz) { if (ty > maxDist) return null; y += dy; ty += tdy; }
        else { if (tz > maxDist) return null; z += dz; tz += tdz; }
      }
      return null;
    }
    function lookDir() { const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw), cp = Math.cos(player.pitch), sp = Math.sin(player.pitch); return new THREE.Vector3(-sy * cp, sp, -cy * cp).normalize(); }
    function eyePos() { return new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z); }
    function currentTarget() { return raycastVoxel(eyePos(), lookDir(), 6); }

    function teleportTo(x, y, z) { player.pos.set(x, y, z); player.vel.set(0, 0, 0); player.onGround = false; player.fallStart = null; playSfx(TELEPORT_SFX); }
    function throwPearl() {
      if (player.dead || !(inv[ENDER_PEARL] > 0)) return;
      const hit = raycastVoxel(eyePos(), lookDir(), 28);
      let bx, by, bz;
      if (hit && hit.prev) { bx = hit.prev.x; by = hit.prev.y; bz = hit.prev.z; }
      else { const d = lookDir(); bx = Math.floor(player.pos.x + d.x * 18); by = Math.floor(player.pos.y); bz = Math.floor(player.pos.z + d.z * 18); }
      if (by < 0 || by >= H - 1 || solid(bx, by, bz) || solid(bx, by + 1, bz)) by = surfaceY(bx, bz);
      teleportTo(bx + 0.5, by + 0.1, bz + 0.5);
      if (inv[ENDER_PEARL] !== Infinity) { inv[ENDER_PEARL]--; drawHotbar(); }
      swing();
    }

    // ---------- mobs ----------
    const MOB = {
      pig:      { hp: 10, hostile: false, body: 0xe89a9a, head: 0xe89a9a, snout: 0xcf7f7f, hh: 0.55, ww: 0.9, spd: 1.3, xp: 1 },
      cow:      { hp: 10, hostile: false, body: 0x4a3626, head: 0x3a2a1c, snout: 0xd8c8b8, hh: 0.75, ww: 0.9, spd: 1.2, xp: 1 },
      sheep:    { hp: 8,  hostile: false, body: 0xecebe6, head: 0xd7c3ad, snout: 0xd7c3ad, hh: 0.72, ww: 0.85, spd: 1.1, xp: 1 },
      chicken:  { hp: 4,  hostile: false, body: 0xf4f4f4, head: 0xf4f4f4, snout: 0xe08a1e, hh: 0.4, ww: 0.5, spd: 1.4, xp: 1, hit: "chicken_hit.wav", die: "chicken_death.wav" },
      zombie:   { hp: 20, hostile: true,  body: 0x27a0a0, head: 0x5aa15a, snout: 0x5aa15a, hh: 1.85, ww: 0.6, spd: 2.1, xp: 5, dmg: 3 },
      creeper:  { hp: 20, hostile: true,  body: 0x4fa53a, head: 0x57b040, snout: 0x2f6d22, hh: 1.5, ww: 0.55, spd: 1.75, xp: 5, dmg: 7, creeper: true, hit: "creeper_hit.wav", die: "creeper_death.wav" },
      villager: { hp: 20, hostile: false, body: 0x8b6d5c, head: 0xc7a088, snout: 0xb08060, hh: 1.9, ww: 0.6, spd: 1.0, xp: 0 },
    };
    const mobs = [];
    const MOB_CAP = 12;
    function makeMobMesh(def) {
      const g = new THREE.Group();
      const mats = [];
      const part = (w, h, d, col, y, z) => {
        const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(col) });
        mat.userData.base = mat.color.clone();
        mats.push(mat);
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(0, y, z || 0); g.add(m); return m;
      };
      const bodyH = def.hh, w = def.ww;
      part(w, bodyH, w * 1.2, def.body, bodyH / 2 + 0.2);          // body
      const head = part(w * 0.8, w * 0.8, w * 0.8, def.head, bodyH + 0.2 + w * 0.35, -w * 0.55); // head
      part(w * 0.35, w * 0.3, w * 0.2, def.snout, bodyH + 0.2 + w * 0.3, -w * 0.9);              // snout/nose
      part(w * 0.28, 0.35, w * 0.28, def.body, 0.02, w * 0.3);     // leg back
      part(w * 0.28, 0.35, w * 0.28, def.body, 0.02, -w * 0.3);    // leg front
      g.userData.head = head;
      return { g, mats };
    }
    function spawnMob(type, x, z) {
      if (mobs.length >= MOB_CAP) return;
      const def = MOB[type];
      const sy = surfaceY(Math.floor(x), Math.floor(z));
      if (sy <= 1 || sy >= H - 2) return;
      const { g, mats } = makeMobMesh(def);
      g.position.set(x, sy, z);
      scene.add(g);
      mobs.push({ type, def, mesh: g, mats, pos: new THREE.Vector3(x, sy, z), vel: new THREE.Vector3(), yaw: Math.random() * 6.28, hp: def.hp, hurtT: 0, wanderT: 0, atkCd: 0, onGround: false });
    }
    function feetY(x, z, fromY) { let y = Math.min(H - 1, Math.floor(fromY) + 1); while (y > 0 && !solid(Math.floor(x), y - 1, Math.floor(z))) y--; return y; }
    function mobHurt(m, dmg, kx, kz) {
      m.hp -= dmg; m.hurtT = 0.3;
      m.vel.x += kx * 4; m.vel.z += kz * 4; m.vel.y = 5;
      if (m.hp <= 0) {
        scene.remove(m.mesh); m.mats.forEach((mt) => mt.dispose()); m.dead = true; if (m.def.xp) addXp(m.def.xp);
        if (m.def.die) playSound(m.def.die); else playSfx("SFX_023");
      } else if (m.def.hit) playSound(m.def.hit);
    }
    function attackMobs() {
      const eye = eyePos(), dir = lookDir();
      let best = null, bestD = 9;
      for (const m of mobs) {
        if (m.dead) continue;
        const to = new THREE.Vector3(m.pos.x - eye.x, (m.pos.y + m.def.hh / 2) - eye.y, m.pos.z - eye.z);
        const d = to.length(); if (d > 3.6) continue;
        to.normalize();
        if (to.dot(dir) < 0.82) continue;
        if (d < bestD) { bestD = d; best = m; }
      }
      if (best) { const dir2 = lookDir(); const t = TOOLS[hotbar[selected]]; mobHurt(best, t ? t.atk : 4, dir2.x, dir2.z); return true; }
      return false;
    }
    function updateMobs(dt) {
      const s = dt / 1000;
      const pcx = Math.floor(player.pos.x / CH), pcz = Math.floor(player.pos.z / CH);
      for (let i = mobs.length - 1; i >= 0; i--) {
        const m = mobs[i];
        if (m.dead) { mobs.splice(i, 1); continue; }
        m.hurtT = Math.max(0, m.hurtT - s);
        m.atkCd = Math.max(0, m.atkCd - s);
        // AI heading
        let tx = 0, tz = 0;
        if (m.def.hostile && !player.dead) {
          const dx = player.pos.x - m.pos.x, dz = player.pos.z - m.pos.z, d = Math.hypot(dx, dz);
          if (d > 0.01) { tx = dx / d; tz = dz / d; m.yaw = Math.atan2(tx, tz); }
          if (m.def.creeper) {
            // Creeper: light a fuse when close, flash white, then explode.
            if (d < 3) { m.fuse = (m.fuse || 0) + s; if (Math.floor(m.fuse * 4) % 2) m.mats.forEach((mt) => mt.color.setRGB(1, 1, 1)); }
            else m.fuse = Math.max(0, (m.fuse || 0) - s * 2);
            if (m.fuse > 1.4) {
              const dmg = Math.max(0, Math.round(m.def.dmg * (1 - d / 4)));
              if (dmg > 0) hurt(dmg, "You were blown up by a creeper.");
              // blast a small crater of soft blocks
              const cxp = Math.round(m.pos.x), cyp = Math.round(m.pos.y), czp = Math.round(m.pos.z);
              for (let ex = -2; ex <= 2; ex++) for (let ey = -2; ey <= 2; ey++) for (let ez = -2; ez <= 2; ez++) {
                if (ex * ex + ey * ey + ez * ez > 5) continue;
                const bx = cxp + ex, by = cyp + ey, bz = czp + ez, bb = BLOCKS[getBlock(bx, by, bz)];
                if (bb && bb.solid && bb.hardness !== Infinity && bb.hardness < 6) setBlock(bx, by, bz, 0);
              }
              playSound("creeper_death.wav", 0.7); scene.remove(m.mesh); m.mats.forEach((mt) => mt.dispose()); mobs.splice(i, 1); continue;
            }
          } else if (d < 1.6 && m.atkCd === 0) { m.atkCd = 1; hurt(m.def.dmg || 2, "You were slain by a zombie."); }
        } else {
          m.wanderT -= s;
          if (m.wanderT <= 0) { m.wanderT = 2 + Math.random() * 3; m.yaw = Math.random() * 6.28; m.moving = Math.random() < 0.7; }
          if (m.moving) { tx = Math.sin(m.yaw); tz = Math.cos(m.yaw); }
        }
        const spd = m.def.spd;
        // horizontal move with 1-block step-up
        const nx = m.pos.x + tx * spd * s + m.vel.x * s;
        const nz = m.pos.z + tz * spd * s + m.vel.z * s;
        const curFeet = feetY(m.pos.x, m.pos.z, m.pos.y + 2);
        const newFeet = feetY(nx, nz, m.pos.y + 2);
        if (newFeet - Math.floor(m.pos.y) <= 1) { m.pos.x = nx; m.pos.z = nz; }
        m.vel.x *= 0.8; m.vel.z *= 0.8;
        // gravity + ground snap
        m.vel.y -= 22 * s;
        m.pos.y += m.vel.y * s;
        const ground = feetY(m.pos.x, m.pos.z, m.pos.y + 2);
        if (m.pos.y <= ground) { m.pos.y = ground; m.vel.y = 0; m.onGround = true; } else m.onGround = false;
        if (m.pos.y < -12) { scene.remove(m.mesh); mobs.splice(i, 1); continue; }
        // despawn far
        if (Math.abs(Math.floor(m.pos.x / CH) - pcx) > RENDER + 1 || Math.abs(Math.floor(m.pos.z / CH) - pcz) > RENDER + 1) { scene.remove(m.mesh); mobs.splice(i, 1); continue; }
        // red flash
        const hurtCol = m.hurtT > 0;
        m.mats.forEach((mt) => { if (hurtCol) mt.color.setRGB(1, 0.35, 0.35); else mt.color.copy(mt.userData.base); });
        m.mesh.position.copy(m.pos);
        m.mesh.rotation.y = m.yaw;
      }
    }
    let spawnAcc = 0;
    function spawnTick(dt) {
      spawnAcc += dt;
      if (spawnAcc < 1600) return;
      spawnAcc = 0;
      if (mobs.length >= MOB_CAP) return;
      // villager near a village chunk?
      const pcx = Math.floor(player.pos.x / CH), pcz = Math.floor(player.pos.z / CH);
      for (let dz = -RENDER; dz <= RENDER; dz++) for (let dx = -RENDER; dx <= RENDER; dx++) {
        if (villageHere(pcx + dx, pcz + dz) && Math.random() < 0.5) {
          spawnMob("villager", (pcx + dx) * CH + 7.5, (pcz + dz) * CH + 8.5);
          return;
        }
      }
      const ang = Math.random() * 6.28, dist = 14 + Math.random() * (CH * RENDER - 16);
      const x = player.pos.x + Math.sin(ang) * dist, z = player.pos.z + Math.cos(ang) * dist;
      const r = Math.random();
      spawnMob(r < 0.16 ? "zombie" : r < 0.30 ? "creeper" : r < 0.48 ? "pig" : r < 0.64 ? "cow" : r < 0.82 ? "sheep" : "chicken", x, z);
    }

    // ---------- mining / placing ----------
    let mining = null, mineHeld = false;
    function tryPlace() {
      if (player.dead || invOpen) return;
      // right-clicking an interactable block opens it instead of placing
      const aim = currentTarget();
      if (aim) { const tb = BLOCKS[getBlock(aim.x, aim.y, aim.z)]; if (tb && tb.interact === "craft") { openContainer("table"); return; } if (tb && tb.interact === "furnace") { openContainer("furnace", { x: aim.x, y: aim.y, z: aim.z }); return; } }
      const heldId = hotbar[selected];
      if (heldId && ITEMS[heldId]) { if (heldId === ENDER_PEARL) throwPearl(); return; }
      const hit = currentTarget();
      if (!hit || !hit.prev) return;
      const { x, y, z } = hit.prev;
      if (getBlock(x, y, z) !== 0) return;
      const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
      const py0 = Math.floor(player.pos.y), py1 = Math.floor(player.pos.y + 1.7);
      if (x === px && z === pz && y >= py0 && y <= py1) return;
      const id = hotbar[selected];
      if (!id || !(inv[id] > 0)) return;
      setBlock(x, y, z, id);
      if (inv[id] !== Infinity) inv[id]--;
      drawHotbar(); swing();
      if (window.Achievements) window.Achievements.bump("architect", 1);
    }
    function breakBlockAt(x, y, z) {
      const id = getBlock(x, y, z), b = BLOCKS[id];
      if (!b || (!b.solid && !b.plant) || b.hardness === Infinity) return;
      setBlock(x, y, z, 0);
      if (b.drop) addItem(b.drop, 1);
      if (ORE_XP[id]) addXp(ORE_XP[id]);
      mining = null;
      if (window.Achievements) window.Achievements.bump("miner", 1);
    }
    function instantMine() { if (attackMobs()) { swing(); return; } const hit = currentTarget(); if (hit) { swing(); breakBlockAt(hit.x, hit.y, hit.z); } }
    function updateMining(dt) {
      if (!mineHeld || player.dead || invOpen) { mining = null; return; }
      const hit = currentTarget();
      if (!hit) { mining = null; return; }
      const id = getBlock(hit.x, hit.y, hit.z), b = BLOCKS[id];
      if (!b || (!b.solid && !b.plant) || b.hardness === Infinity) { mining = null; return; }
      if (!mining || mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z) mining = { x: hit.x, y: hit.y, z: hit.z, progress: 0 };
      const hard = creative ? 0.05 : (b.hardness || 0.5);
      const t = TOOLS[hotbar[selected]];
      mining.progress += (dt / 1000) / hard * (t ? t.mult : 1);
      if (mining.progress >= 1) breakBlockAt(hit.x, hit.y, hit.z);
    }

    // ---------- containers: inventory / crafting table / furnace ----------
    let invOpen = false, invQuery = "", uiMode = null, uiPos = null;
    let cursor = null;                 // {id,count} held on the pointer
    let craftGrid = [], craftW = 2;    // stacks or 0
    const furnaceMap = new Map();      // "x,y,z" -> smelting state
    let furnaceEls = null, lastFurnaceSig = null;
    const gameRoot = body.querySelector(".mc-game3d");
    const cursorEl = document.createElement("div"); cursorEl.className = "mci-cursor"; cursorEl.style.display = "none"; gameRoot.appendChild(cursorEl);

    function furnaceAt(pos) { const k = pos.x + "," + pos.y + "," + pos.z; let f = furnaceMap.get(k); if (!f) { f = { input: null, fuel: null, out: null, progress: 0, burn: 0, burnMax: 0, _prog: 0 }; furnaceMap.set(k, f); } return f; }
    function removeAll(id) { const n = inv[id] || 0; delete inv[id]; const hi = hotbar.indexOf(id); if (hi >= 0) hotbar.splice(hi, 1); return n; }
    function give(id, n) { addItem(id, n); }

    function swatchEl(id) {
      const b = meta(id);
      if (b && b.tex) { const img = document.createElement("img"); img.className = "mci-sw"; img.src = "assets/mc_" + b.tex + ".png?v=" + TEXV; img.onerror = () => { const s = document.createElement("span"); s.className = "mci-sw"; s.style.background = b.color || "#888"; img.replaceWith(s); }; return img; }
      const s = document.createElement("span"); s.className = "mci-sw"; s.style.background = (b && b.color) || "#888"; return s;
    }
    function slotNode(stack, cls) {
      const d = document.createElement("div"); d.className = "mci-slot " + (cls || "");
      if (stack && stack.id) {
        const b = meta(stack.id); if (b) d.title = b.name;
        d.appendChild(swatchEl(stack.id));
        if (stack.count && stack.count !== Infinity && stack.count > 1) { const c = document.createElement("span"); c.className = "mci-c"; c.textContent = stack.count; d.appendChild(c); }
      } else d.classList.add("mci-empty");
      return d;
    }

    function openContainer(mode, pos) {
      invOpen = true; uiMode = mode; uiPos = pos || null; lastFurnaceSig = null;
      craftW = mode === "table" ? 3 : 2;
      if (mode === "inv" || mode === "table") craftGrid = new Array(craftW * craftW).fill(0);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      renderUI(); invEl.style.display = "flex";
    }
    function openInv() { openContainer("inv"); }
    function toggleInv() { invOpen ? closeInv() : openInv(); }
    function dumpGrid() { craftGrid.forEach((s) => { if (s) give(s.id, s.count); }); craftGrid = craftGrid.map(() => 0); }
    function closeInv() {
      if (uiMode === "inv" || uiMode === "table") dumpGrid();
      if (cursor) { give(cursor.id, cursor.count); cursor = null; }
      invOpen = false; uiMode = null; uiPos = null; invEl.style.display = "none"; cursorEl.style.display = "none"; drawHotbar();
    }

    function craftResult() { return matchRecipe(craftGrid.map((s) => s ? s.id : 0), craftW, craftW); }
    function doCraft() {
      const res = craftResult(); if (!res) return;
      if (cursor && cursor.id !== res[0]) return;
      cursor = cursor ? { id: res[0], count: cursor.count + res[1] } : { id: res[0], count: res[1] };
      craftGrid = craftGrid.map((s) => { if (!s) return 0; s.count--; return s.count > 0 ? s : 0; });
      renderUI();
    }
    function clickInvItem(id) {
      if (cursor) { give(cursor.id, cursor.count); cursor = null; }
      else if (id && inv[id] > 0) { const n = inv[id] === Infinity ? 64 : removeAll(id); cursor = { id, count: n }; }
      renderUI();
    }
    function clickCell(i) {
      const cell = craftGrid[i];
      if (cursor) {
        if (!cell) { craftGrid[i] = { id: cursor.id, count: 1 }; cursor.count--; if (cursor.count <= 0) cursor = null; }
        else if (cell.id === cursor.id) { cell.count++; cursor.count--; if (cursor.count <= 0) cursor = null; }
        else { craftGrid[i] = { id: cursor.id, count: 1 }; cursor = { id: cell.id, count: cell.count }; }
      } else if (cell) { cursor = { id: cell.id, count: cell.count }; craftGrid[i] = 0; }
      renderUI();
    }
    function clickFurnace(slot) {
      const f = furnaceAt(uiPos);
      if (slot === 2) { if (f.out) { if (!cursor) { cursor = { id: f.out.id, count: f.out.count }; f.out = null; } else if (cursor.id === f.out.id) { cursor.count += f.out.count; f.out = null; } } lastFurnaceSig = null; renderUI(); return; }
      const key = slot === 0 ? "input" : "fuel";
      if (cursor) { if (!f[key]) { f[key] = { id: cursor.id, count: cursor.count }; cursor = null; } else if (f[key].id === cursor.id) { f[key].count += cursor.count; cursor = null; } else { const t = f[key]; f[key] = { id: cursor.id, count: cursor.count }; cursor = { id: t.id, count: t.count }; } }
      else if (f[key]) { cursor = { id: f[key].id, count: f[key].count }; f[key] = null; }
      lastFurnaceSig = null; renderUI();
    }

    function buildInvGrids() {
      const wrap = document.createElement("div");
      const owned = Object.keys(inv).filter((id) => inv[id] > 0 && !hotbar.includes(+id));
      const main = document.createElement("div"); main.className = "mci-main";
      for (let i = 0; i < 27; i++) { const id = +owned[i]; const n = slotNode(id ? { id, count: inv[id] } : 0); if (id) n.onclick = () => clickInvItem(id); main.appendChild(n); }
      const hot = document.createElement("div"); hot.className = "mci-hotrow";
      for (let i = 0; i < 9; i++) { const id = hotbar[i]; const n = slotNode(id ? { id, count: inv[id] } : 0); if (id) n.onclick = () => clickInvItem(id); hot.appendChild(n); }
      wrap.append(main, hot); return wrap;
    }
    function buildCraft(panel) {
      const top = document.createElement("div"); top.className = "mci-top";
      if (uiMode === "inv") {
        const left = document.createElement("div"); left.className = "mci-left";
        const armor = document.createElement("div"); armor.className = "mci-armor";
        for (let i = 0; i < 4; i++) armor.appendChild(slotNode(0));
        const prev = document.createElement("div"); prev.className = "mci-preview";
        const off = document.createElement("div"); off.className = "mci-off"; off.appendChild(slotNode(0));
        left.append(armor, prev, off); top.appendChild(left);
      }
      const craftBox = document.createElement("div"); craftBox.className = "mci-craft";
      const label = document.createElement("div"); label.className = "mci-craftlabel"; label.textContent = "Crafting"; craftBox.appendChild(label);
      const row = document.createElement("div"); row.className = "mci-craftrow";
      const grid = document.createElement("div"); grid.className = uiMode === "table" ? "mci-grid3" : "mci-grid2";
      craftGrid.forEach((s, i) => { const n = slotNode(s); n.onclick = () => clickCell(i); grid.appendChild(n); });
      const arrow = document.createElement("span"); arrow.className = "mci-arrow"; arrow.textContent = "→";
      const r = craftResult();
      const resNode = slotNode(r ? { id: r[0], count: r[1] } : 0, "mci-result"); resNode.onclick = () => doCraft();
      row.append(grid, arrow, resNode); craftBox.appendChild(row); top.appendChild(craftBox);
      panel.appendChild(top); panel.appendChild(buildInvGrids());
    }
    function buildFurnace(panel) {
      const f = furnaceAt(uiPos);
      const label = document.createElement("div"); label.className = "mci-craftlabel"; label.textContent = "Furnace";
      const top = document.createElement("div"); top.className = "mci-top mci-furnace";
      const col = document.createElement("div"); col.className = "mci-fcol";
      const inSlot = slotNode(f.input); inSlot.onclick = () => clickFurnace(0);
      const flame = document.createElement("div"); flame.className = "mci-flame" + (f.burn > 0 ? " lit" : "");
      const fuelSlot = slotNode(f.fuel); fuelSlot.onclick = () => clickFurnace(1);
      col.append(inSlot, flame, fuelSlot);
      const arrowWrap = document.createElement("div"); arrowWrap.className = "mci-farrow";
      const arrowFill = document.createElement("div"); arrowFill.className = "mci-farrow-fill"; arrowFill.style.width = Math.round((f._prog || 0) * 100) + "%"; arrowWrap.appendChild(arrowFill);
      const outSlot = slotNode(f.out, "mci-result"); outSlot.onclick = () => clickFurnace(2);
      top.append(col, arrowWrap, outSlot);
      furnaceEls = { arrow: arrowFill, flame };
      panel.append(label, top, buildInvGrids());
    }
    function buildJEI() {
      const q = invQuery.trim().toLowerCase();
      const all = Object.keys(BLOCKS).map(Number).filter((id) => BLOCKS[id].name !== "Air").concat(Object.keys(ITEMS).map(Number));
      const list = all.filter((id) => { const m = meta(id); return m && (!q || m.name.toLowerCase().includes(q)); });
      const wrap = document.createElement("div"); wrap.className = "mci-jei";
      const head = document.createElement("div"); head.className = "mci-jei-head";
      const input = document.createElement("input"); input.className = "mci-search"; input.placeholder = "Search items"; input.value = invQuery;
      input.oninput = () => { invQuery = input.value; renderUI(); const s = invEl.querySelector(".mci-search"); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } };
      const x = document.createElement("span"); x.className = "mci-jei-x"; x.textContent = "✕"; x.onclick = closeInv;
      head.append(input, x);
      const grid = document.createElement("div"); grid.className = "mci-jei-grid";
      list.forEach((id) => { const n = document.createElement("div"); n.className = "mci-jslot" + (creative ? "" : " mci-jref"); n.title = meta(id).name; n.appendChild(swatchEl(id)); if (creative) n.onclick = () => { if (cursor && cursor.id === id) cursor.count++; else cursor = { id, count: 1 }; renderUI(); }; grid.appendChild(n); });
      const foot = document.createElement("div"); foot.className = "mci-jei-foot"; foot.textContent = creative ? "Click to grab items" : "Recipe reference only";
      wrap.append(head, grid, foot); return wrap;
    }
    function positionCursor() {
      if (!cursor) { cursorEl.style.display = "none"; return; }
      cursorEl.style.display = "flex"; cursorEl.innerHTML = ""; cursorEl.appendChild(swatchEl(cursor.id));
      if (cursor.count > 1 && cursor.count !== Infinity) { const c = document.createElement("span"); c.className = "mci-c"; c.textContent = cursor.count; cursorEl.appendChild(c); }
    }
    function renderUI() {
      invEl.innerHTML = "";
      const panel = document.createElement("div"); panel.className = "mci-panel";
      if (uiMode === "furnace") buildFurnace(panel); else buildCraft(panel);
      invEl.appendChild(panel); invEl.appendChild(buildJEI());
      positionCursor();
    }
    document.addEventListener("mousemove", (e) => { if (!invOpen || !cursor) return; const r = gameRoot.getBoundingClientRect(); cursorEl.style.left = (e.clientX - r.left - 15) + "px"; cursorEl.style.top = (e.clientY - r.top - 15) + "px"; });
    invEl && invEl.addEventListener("touchmove", (e) => { if (!cursor) return; const t = e.touches[0]; if (!t) return; const r = gameRoot.getBoundingClientRect(); cursorEl.style.left = (t.clientX - r.left - 15) + "px"; cursorEl.style.top = (t.clientY - r.top - 15) + "px"; }, { passive: true });

    const SMELT_TIME = 2000;
    function smeltTick(dt) {
      if (uiMode !== "furnace" || !uiPos) return;
      const f = furnaceAt(uiPos);
      const outId = f.input ? SMELT[f.input.id] : null;
      const canSmelt = outId != null && (!f.out || f.out.id === outId);
      if (f.burn <= 0 && canSmelt && f.fuel && FUEL[f.fuel.id] != null) { f.burn = FUEL[f.fuel.id] * SMELT_TIME; f.burnMax = f.burn; f.fuel.count--; if (f.fuel.count <= 0) f.fuel = null; }
      if (f.burn > 0) { f.burn = Math.max(0, f.burn - dt); if (canSmelt) { f.progress += dt; if (f.progress >= SMELT_TIME) { f.progress = 0; f.input.count--; if (f.input.count <= 0) f.input = null; if (!f.out) f.out = { id: outId, count: 1 }; else f.out.count++; } } else f.progress = Math.max(0, f.progress - dt); }
      else f.progress = Math.max(0, f.progress - dt);
      f._prog = f.progress / SMELT_TIME;
      const sig = (f.input ? f.input.id + "x" + f.input.count : "-") + "|" + (f.fuel ? f.fuel.id + "x" + f.fuel.count : "-") + "|" + (f.out ? f.out.id + "x" + f.out.count : "-");
      if (sig !== lastFurnaceSig) { lastFurnaceSig = sig; renderUI(); }
      else if (furnaceEls) { furnaceEls.arrow.style.width = Math.round(f._prog * 100) + "%"; furnaceEls.flame.className = "mci-flame" + (f.burn > 0 ? " lit" : ""); }
    }

    // ---------- input ----------
    const keys = {};
    let pointerLocked = false;
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (e.type === "keydown") {
        if (k === "e") { toggleInv(); e.preventDefault(); return; }
        if (e.key === "Escape") { if (invOpen) { closeInv(); return; } cleanup(); menu(body, ref); return; }
        keys[k] = true;
        if (/^[1-9]$/.test(e.key)) { selected = +e.key - 1; drawHotbar(); }
        if ([" ", "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      } else keys[k] = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);

    canvas.addEventListener("click", () => { if (!isTouch && !pointerLocked && !invOpen && canvas.requestPointerLock) canvas.requestPointerLock(); });
    document.addEventListener("pointerlockchange", () => { pointerLocked = (document.pointerLockElement === canvas); });
    canvas.addEventListener("mousemove", (e) => { if (!pointerLocked) return; player.yaw -= e.movementX * 0.0025; player.pitch -= e.movementY * 0.0025; player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch)); });
    canvas.addEventListener("mousedown", (e) => { e.preventDefault(); if (!pointerLocked || invOpen) return; if (e.button === 0) { mineHeld = true; attackMobs(); swing(); } if (e.button === 2) tryPlace(); });
    window.addEventListener("mouseup", () => { mineHeld = false; mining = null; });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    let touchLook = null, touchMove = null, touchMoveStart = null;
    const touchOpts = { passive: false };
    canvas.addEventListener("touchstart", (e) => {
      if (invOpen) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      for (const t of e.changedTouches) {
        const lx = t.clientX - r.left;
        if (lx < r.width / 2) { if (!touchMove) { touchMove = { id: t.identifier, x: t.clientX, y: t.clientY }; touchMoveStart = { x: t.clientX, y: t.clientY }; } }
        else if (!touchLook) touchLook = { id: t.identifier, x: t.clientX, y: t.clientY, moved: 0, startTime: nowMs() };
      }
    }, touchOpts);
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (touchLook && t.identifier === touchLook.id) {
          const dx = t.clientX - touchLook.x, dy = t.clientY - touchLook.y;
          player.yaw -= dx * 0.006; player.pitch -= dy * 0.006; player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
          touchLook.x = t.clientX; touchLook.y = t.clientY; touchLook.moved += Math.abs(dx) + Math.abs(dy);
        }
        if (touchMove && t.identifier === touchMove.id) { touchMove.x = t.clientX; touchMove.y = t.clientY; }
      }
    }, touchOpts);
    canvas.addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) {
        if (touchLook && t.identifier === touchLook.id) { if (touchLook.moved < 10 && nowMs() - touchLook.startTime < 400) instantMine(); touchLook = null; }
        if (touchMove && t.identifier === touchMove.id) { touchMove = null; touchMoveStart = null; }
      }
    });
    function nowMs() { return performance && performance.now ? performance.now() : 0; }

    body.querySelector(".mc3-jump").onclick = () => { if (player.onGround && !player.dead) { player.vel.y = 8.5; player.onGround = false; } };
    body.querySelector(".mc3-place").onclick = () => tryPlace();
    body.querySelector(".mc3-inv").onclick = () => toggleInv();

    // ---------- physics ----------
    let portalCd = 0;
    function step(dt) {
      if (player.dead || invOpen) return;
      player.hurtCd = Math.max(0, player.hurtCd - dt / 1000);
      portalCd = Math.max(0, portalCd - dt);
      const fbx = Math.floor(player.pos.x), fbz = Math.floor(player.pos.z);
      if ((getBlock(fbx, Math.floor(player.pos.y), fbz) === 56 || getBlock(fbx, Math.floor(player.pos.y + 1), fbz) === 56) && portalCd === 0) {
        portalCd = 2000; const rx = fbx + (Math.floor(Math.random() * 40) - 20), rz = fbz + (Math.floor(Math.random() * 40) - 20);
        teleportTo(rx + 0.5, surfaceY(rx, rz) + 0.1, rz + 0.5); return;
      }
      const speed = 4.2, grav = 22, jumpVel = 8.5;
      let fx = 0, fz = 0;
      if (keys["w"] || keys["arrowup"]) fz -= 1;
      if (keys["s"] || keys["arrowdown"]) fz += 1;
      if (keys["a"] || keys["arrowleft"]) fx -= 1;
      if (keys["d"] || keys["arrowright"]) fx += 1;
      if (touchMove && touchMoveStart) { const tdx = touchMove.x - touchMoveStart.x, tdy = touchMove.y - touchMoveStart.y, mag = Math.hypot(tdx, tdy); if (mag > 8) { fx += tdx / mag; fz += tdy / mag; } }
      const nMag = Math.hypot(fx, fz); if (nMag > 1) { fx /= nMag; fz /= nMag; }
      const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
      player.vel.x = (fx * cy - fz * sy) * speed;
      player.vel.z = (fx * sy + fz * cy) * speed;
      if (keys[" "] && player.onGround) { player.vel.y = jumpVel; player.onGround = false; }
      player.vel.y -= grav * dt / 1000; if (player.vel.y < -40) player.vel.y = -40;
      if (player.onGround) player.fallStart = null; else if (player.fallStart === null) player.fallStart = player.pos.y;
      const wasGround = player.onGround;
      moveAxis("x", player.vel.x * dt / 1000);
      moveAxis("z", player.vel.z * dt / 1000);
      moveAxis("y", player.vel.y * dt / 1000);
      if (!wasGround && player.onGround && player.fallStart !== null) {
        const fell = player.fallStart - player.pos.y;
        if (fell > 3.5 && !creative) hurt(Math.floor(fell - 3), "You fell from a high place.");
        player.fallStart = null;
      }
      if (player.pos.y < -24) die("You fell out of the world.");
    }
    function moveAxis(axis, delta) {
      if (axis === "x") player.pos.x += delta; else if (axis === "y") player.pos.y += delta; else player.pos.z += delta;
      const HW = 0.3, HH = 1.75;
      const minX = Math.floor(player.pos.x - HW), maxX = Math.floor(player.pos.x + HW);
      const minY = Math.floor(player.pos.y), maxY = Math.floor(player.pos.y + HH);
      const minZ = Math.floor(player.pos.z - HW), maxZ = Math.floor(player.pos.z + HW);
      for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
        if (!solid(x, y, z)) continue;
        if (axis === "x") { if (delta > 0) player.pos.x = x - HW - 1e-4; else player.pos.x = (x + 1) + HW + 1e-4; player.vel.x = 0; return; }
        if (axis === "y") { if (delta > 0) { player.pos.y = y - HH - 1e-4; player.vel.y = 0; } else { player.pos.y = (y + 1) + 1e-4; player.vel.y = 0; player.onGround = true; } return; }
        if (axis === "z") { if (delta > 0) player.pos.z = z - HW - 1e-4; else player.pos.z = (z + 1) + HW + 1e-4; player.vel.z = 0; return; }
      }
      if (axis === "y" && delta > 0) player.onGround = false;
    }

    function hurt(n, msg) {
      if (creative || player.dead || player.hurtCd > 0) return;
      player.hp = Math.max(0, player.hp - n); player.hurtCd = 0.5;
      hurtEl.style.opacity = "0.55"; setTimeout(() => { hurtEl.style.opacity = "0"; }, 160);
      drawHearts();
      if (player.hp <= 0) die(msg || "You died.");
    }
    function die(msg) { player.dead = true; body.querySelector("#deathmsg").textContent = msg; deathEl.style.display = "flex"; if (document.pointerLockElement === canvas) document.exitPointerLock(); }
    function respawn() { player.pos.set(spawnX, heightAt(0, 0) + 1.1, spawnZ); player.vel.set(0, 0, 0); player.hp = 20; player.dead = false; player.fallStart = null; drawHearts(); deathEl.style.display = "none"; }
    body.querySelector("#respawn").onclick = respawn;
    body.querySelector("#toMenu").onclick = () => { cleanup(); menu(body, ref); };

    // initial chunks + starting mobs, then drop the player onto the surface
    updateChunks(64);
    player.pos.y = surfaceY(0, 0) + 0.2;
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, d = 8 + Math.random() * 14; const pool = ["pig", "cow", "sheep", "zombie", "creeper", "chicken"]; spawnMob(pool[Math.floor(Math.random() * pool.length)], player.pos.x + Math.sin(a) * d, player.pos.z + Math.cos(a) * d); }

    // ---------- main loop ----------
    let raf, last = 0, fpsT = 0, frames = 0;
    function loop(ts) {
      const dt = Math.min(50, ts - last); last = ts;
      step(dt); updateSurvival(dt); updateMining(dt); updateMobs(dt); spawnTick(dt); updateChunks(2); smeltTick(dt);

      const eye = eyePos(), dir = lookDir();
      camera.position.copy(eye);
      camera.lookAt(eye.x + dir.x, eye.y + dir.y, eye.z + dir.z);

      // hand swing
      if (swingT > 0) { swingT = Math.max(0, swingT - dt / 260); const s = Math.sin((1 - swingT) * Math.PI); handGroup.rotation.set(-s * 0.7, 0, 0); handGroup.position.set(0, -s * 0.12, 0); }
      else { handGroup.rotation.set(0, 0, 0); handGroup.position.set(0, 0, 0); }

      const hit = currentTarget();
      if (hit && !invOpen) { hl.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); hl.visible = true; } else hl.visible = false;

      if (mining && mining.progress > 0) {
        const stage = Math.min(crackTextures.length - 1, Math.floor(mining.progress * crackTextures.length));
        const tex = crackTextures[stage];
        if (tex) { if (crackMat.map !== tex) { crackMat.map = tex; crackMat.needsUpdate = true; } crackMesh.position.set(mining.x + 0.5, mining.y + 0.5, mining.z + 0.5); crackMesh.visible = true; } else crackMesh.visible = false;
      } else crackMesh.visible = false;

      const r = canvas.getBoundingClientRect();
      if (Math.abs(canvas.width - r.width * renderer.getPixelRatio()) > 1) { renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
      renderer.render(scene, camera);
      if (cfg.showFps) { frames++; fpsT += dt; if (fpsT > 500) { fpsEl.textContent = Math.round(frames / (fpsT / 1000)) + " fps"; frames = 0; fpsT = 0; } }
      raf = requestAnimationFrame(loop);
    }

    function cleanup() {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      mobs.forEach((m) => { scene.remove(m.mesh); m.mats.forEach((mt) => mt.dispose()); });
      renderer.dispose(); cube.dispose(); crossGeo.dispose();
      Object.values(materials).forEach((m) => Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose());
      Object.values(textures).forEach((t) => t.dispose());
    }
    body.closest(".win").addEventListener("DOMNodeRemoved", cleanup);

    raf = requestAnimationFrame(loop);
  }
})();
