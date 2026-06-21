/* A 2D Minecraft-style sandbox: seeded worlds, progressive block breaking with
   per-block hardness, a survival inventory (mine to collect, place from stock),
   health with fall/lava/drowning damage, ores, caves, water, and texture support.
   Block textures load from assets/mc_<tex>.png (fallback to a flat color). */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const TILE = 28;
  const SEA = 0.55; // sea level as fraction of world height

  // id: {name, color, top, solid, hardness(sec), drop, tex, alpha, liquid, danger}
  const BLOCKS = {
    0:  { name: "Air", solid: false },
    1:  { name: "Grass", color: "#5fa83b", top: "#7ec850", solid: true, hardness: 0.6, drop: 2, tex: "grass" },
    2:  { name: "Dirt", color: "#8a5a2b", solid: true, hardness: 0.5, drop: 2, tex: "dirt" },
    3:  { name: "Stone", color: "#8c8c8c", solid: true, hardness: 1.5, drop: 17, tex: "stone" },
    4:  { name: "Log", color: "#6b4a25", solid: true, hardness: 2, drop: 4, tex: "log" },
    5:  { name: "Leaves", color: "#3e9b3e", solid: true, hardness: 0.2, drop: 5, tex: "leaves", alpha: 0.95 },
    6:  { name: "Sand", color: "#e3d59b", solid: true, hardness: 0.5, drop: 6, tex: "sand" },
    7:  { name: "Planks", color: "#b08243", solid: true, hardness: 2, drop: 7, tex: "planks" },
    8:  { name: "Glass", color: "#bfe8f5", solid: true, hardness: 0.3, drop: 8, tex: "glass", alpha: 0.45 },
    9:  { name: "Brick", color: "#9e4636", solid: true, hardness: 2, drop: 9, tex: "brick" },
    10: { name: "Water", color: "#3a6ff0", solid: false, liquid: true, alpha: 0.55, tex: "water" },
    11: { name: "Lava", color: "#e8631b", solid: false, liquid: true, alpha: 0.85, danger: true, tex: "lava" },
    12: { name: "Coal Ore", color: "#5a5a5a", solid: true, hardness: 2.5, drop: 12, tex: "coal_ore" },
    13: { name: "Iron Ore", color: "#caa472", solid: true, hardness: 3, drop: 13, tex: "iron_ore" },
    14: { name: "Gold Ore", color: "#e6c34a", solid: true, hardness: 3, drop: 14, tex: "gold_ore" },
    15: { name: "Diamond Ore", color: "#4fe0d6", solid: true, hardness: 4, drop: 15, tex: "diamond_ore" },
    16: { name: "Bedrock", color: "#33333a", solid: true, hardness: Infinity, drop: 0, tex: "bedrock" },
    17: { name: "Cobblestone", color: "#7d7d7d", solid: true, hardness: 1.8, drop: 17, tex: "cobblestone" },
    18: { name: "Blue Concrete", color: "#2c39c4", solid: true, hardness: 1.8, drop: 18, tex: "blue_concrete" },
    19: { name: "Purple Concrete", color: "#7e2bc0", solid: true, hardness: 1.8, drop: 19, tex: "purple_concrete" },
    25: { name: "Emerald Block", color: "#17b463", solid: true, hardness: 5, drop: 25, tex: "emerald" },
    26: { name: "Ancient Debris", color: "#5a3434", solid: true, hardness: 30, drop: 26, tex: "ancient_debris" },
    20: { name: "Poppy", color: "#e74c4c", solid: false, plant: true, hardness: 0.05, drop: 20, tex: "poppy" },
    21: { name: "Daisy", color: "#ffffff", solid: false, plant: true, hardness: 0.05, drop: 21, tex: "daisy" },
    22: { name: "Dandelion", color: "#ffd34e", solid: false, plant: true, hardness: 0.05, drop: 22, tex: "yellow_flower" },
    23: { name: "Red Mushroom", color: "#c62828", solid: false, plant: true, hardness: 0.05, drop: 23, tex: "red_mushroom" },
    24: { name: "Brown Mushroom", color: "#8a5a2b", solid: false, plant: true, hardness: 0.05, drop: 24, tex: "brown_mushroom" },
  };

  // ---- textures ----
  const TEX = {};
  function loadTex(key) {
    if (!key || TEX[key]) return;
    const img = new Image();
    const rec = { img, ok: false };
    img.onload = () => { rec.ok = true; };
    img.src = "assets/mc_" + key + ".png";
    TEX[key] = rec;
  }
  Object.values(BLOCKS).forEach((b) => loadTex(b.tex));
  loadTex("missing");

  // ---- procedural pixel textures (original art, drawn to offscreen canvases) ----
  // Used when no assets/mc_<tex>.png is supplied. Gives blocks a real blocky look.
  const PROC = {};
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  function proc(id) {
    if (PROC[id]) return PROC[id];
    const b = BLOCKS[id]; if (!b || !b.color) return null;
    const px = 8, c = document.createElement("canvas"); c.width = c.height = px;
    const x = c.getContext("2d");
    const rng = mulberry32((id + 1) * 2654435761 >>> 0);
    x.fillStyle = b.color; x.fillRect(0, 0, px, px);
    const speckle = (spread, density) => {
      for (let i = 0; i < px; i++) for (let j = 0; j < px; j++) {
        if (rng() < density) { x.fillStyle = shade(b.color, Math.floor((rng() - 0.5) * spread)); x.fillRect(i, j, 1, 1); }
      }
    };
    if (id === 1) { // grass: green speckle + dirt strip below top
      speckle(40, 0.5);
      x.fillStyle = "#8a5a2b"; x.fillRect(0, 5, px, 3);
      for (let i = 0; i < px; i++) for (let j = 5; j < px; j++) if (rng() < 0.4) { x.fillStyle = shade("#8a5a2b", Math.floor((rng() - .5) * 40)); x.fillRect(i, j, 1, 1); }
      x.fillStyle = "#7ec850"; for (let i = 0; i < px; i++) if (rng() < 0.6) x.fillRect(i, 0, 1, 1 + Math.floor(rng() * 2));
    } else if (id === 4) { // log: vertical grain + rings
      speckle(30, 0.4);
      x.fillStyle = shade(b.color, -30); x.fillRect(1, 0, 1, px); x.fillRect(6, 0, 1, px);
      x.fillStyle = shade(b.color, 25); x.fillRect(3, 0, 1, px);
    } else if (id === 7) { // planks: horizontal boards
      speckle(20, 0.3);
      x.fillStyle = shade(b.color, -45); x.fillRect(0, 2, px, 1); x.fillRect(0, 5, px, 1);
    } else if (id === 9) { // brick pattern
      x.fillStyle = shade(b.color, 35);
      x.fillRect(0, 3, px, 1); x.fillRect(0, 7, px, 1);
      x.fillRect(3, 0, 1, 3); x.fillRect(6, 4, 1, 3);
    } else if (id >= 12 && id <= 15) { // ores: stone base + colored blobs
      x.fillStyle = "#8c8c8c"; x.fillRect(0, 0, px, px);
      for (let i = 0; i < px; i++) for (let j = 0; j < px; j++) if (rng() < 0.35) { x.fillStyle = shade("#8c8c8c", Math.floor((rng() - .5) * 40)); x.fillRect(i, j, 1, 1); }
      x.fillStyle = b.color;
      for (let k = 0; k < 5; k++) { const i = Math.floor(rng() * (px - 1)), j = Math.floor(rng() * (px - 1)); x.fillRect(i, j, 2, 2); }
    } else if (id === 10 || id === 11) { // liquids: wavy bands
      for (let j = 0; j < px; j++) { x.fillStyle = shade(b.color, j % 2 ? 12 : -12); x.fillRect(0, j, px, 1); }
    } else {
      speckle(id === 3 || id === 17 ? 35 : 28, 0.5);
    }
    PROC[id] = c; return c;
  }

  // ---- seeded RNG ----
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
  // deterministic per-cell value from seed
  function cell(seed, x, y) {
    let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  AppRegistry.minecraft = function () {
    const ref = cw({ title: "Mincraft", icon: Icon.mini("minecraft", "Mincraft"), width: 880, height: 620, appId: "minecraft" });
    if (S().appData.minecraft == null) S().appData.minecraft = { sound: true, fullscreen: false, showFps: false };
    menu(ref.body, ref);
  };

  function menu(body, ref) {
    body.innerHTML = `<div class="mc-root mc-home">
      <div class="mc-header">
        <img src="assets/minecraft_header.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div class="mc-header-fallback" style="display:none">MINCRAFT</div>
      </div>
      <div class="mc-menu">
        <div class="mc-button full" data-act="play"><div class="title">Singleplayer</div></div>
        <div class="mc-button full" data-act="multi"><div class="title">Multiplayer</div></div>
        <div class="mc-button full" data-act="realms"><div class="title">Minecraft Realms</div></div>
        <div class="double">
          <div class="mc-button full" data-act="opts"><div class="title">Options</div></div>
          <div class="mc-button full" data-act="quit"><div class="title">Quit Game</div></div>
        </div>
        <div class="mc-button full lang" data-act="lang"><div class="title">EN</div></div>
      </div>
      <div class="mc-splash-text">100% blocky!</div>
      <div class="mc-version">Windows 12 Edition</div>
    </div>`;
    const act = {
      play: () => createWorld(body, ref),
      opts: () => options(body, ref),
      quit: () => ref.close(),
      multi: () => Notify.show({ icon: "", title: "Multiplayer", body: "No servers reachable in the simulation." }),
      realms: () => Notify.show({ icon: "", title: "Minecraft Realms", body: "Realms isn't available here." }),
      lang: () => {},
    };
    body.querySelectorAll(".mc-button").forEach((b) => b.onclick = () => (act[b.dataset.act] || (() => {}))());
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

  function game(body, ref, seedStr, creative) {
    const cfg = S().appData.minecraft;
    const W = 160, H = 64, seaY = Math.floor(H * SEA);
    const seed = hashSeed(seedStr);
    const world = genWorld(W, H, seed, seaY);

    body.innerHTML = `<div class="mc-root mc-game">
      <canvas class="mc-canvas"></canvas>
      <div class="mc-hud"><div class="mc-hotbar"></div></div>
      <div class="mc-help">WASD/arrows move &middot; W/Space jump &middot; hold-click mine &middot; right-click place &middot; 1-9 select &middot; Esc menu &middot; seed: ${seedStr}</div>
      <div class="mc-fps" style="display:${cfg.showFps ? "block" : "none"}">0 fps</div>
      <div class="mc-death" style="display:none"><div class="mc-death-card"><h1>You Died!</h1><p id="deathmsg"></p><button class="mc-btn" id="respawn">Respawn</button><button class="mc-btn" id="toMenu">Title screen</button></div></div>
    </div>`;
    const canvas = body.querySelector(".mc-canvas");
    const ctx = canvas.getContext("2d");
    const hbEl = body.querySelector(".mc-hotbar");
    const fpsEl = body.querySelector(".mc-fps");
    const deathEl = body.querySelector(".mc-death");

    // inventory: blockId -> count ; hotbar: ordered list of blockIds
    const inv = {};
    let hotbar = [];
    let selected = 0;
    if (creative) {
      hotbar = [1, 3, 4, 7, 18, 19, 20, 22, 23];
      hotbar.forEach((b) => inv[b] = Infinity);
    }
    function addItem(id, n) {
      if (!id) return;
      inv[id] = (inv[id] || 0) + n;
      if (!hotbar.includes(id) && hotbar.length < 9) hotbar.push(id);
      drawHotbar();
    }
    function drawHotbar() {
      hbEl.innerHTML = "";
      for (let i = 0; i < 9; i++) {
        const id = hotbar[i];
        const b = id ? BLOCKS[id] : null;
        const cnt = id ? inv[id] : 0;
        const slot = el(`<div class="mc-slot ${i === selected ? "sel" : ""}">` +
          (b ? `<span class="mc-slot-sw" style="background:${b.color}"></span>` : "") +
          (b && cnt !== Infinity ? `<span class="mc-slot-c">${cnt}</span>` : "") +
          `<span class="mc-slot-n">${i + 1}</span></div>`);
        slot.onclick = () => { selected = i; drawHotbar(); };
        hbEl.appendChild(slot);
      }
    }
    drawHotbar();

    // player
    const spawnX = Math.floor(W / 2);
    const player = { x: spawnX * TILE, y: 0, w: TILE * 0.8, h: TILE * 1.7, vx: 0, vy: 0, onGround: false,
      hp: 20, maxHp: 20, air: 300, maxAir: 300, dead: false, fallStart: null, hurtCd: 0 };
    respawnPlayer();
    function respawnPlayer() {
      // drop player at surface above spawn column
      let ty = 0; while (ty < H && !solid(spawnX, ty) && !BLOCKS[world[ty][spawnX]].liquid) ty++;
      player.x = spawnX * TILE + 2; player.y = (ty - 2) * TILE;
      player.vx = player.vy = 0; player.hp = player.maxHp; player.air = player.maxAir; player.dead = false; player.fallStart = null;
      deathEl.style.display = "none";
    }

    const keys = {};
    const cam = { x: 0, y: 0 };
    function solid(tx, ty) {
      if (tx < 0 || tx >= W || ty < 0 || ty >= H) return false;
      const b = BLOCKS[world[ty][tx]]; return b && b.solid;
    }
    function blockAt(tx, ty) { return (tx < 0 || tx >= W || ty < 0 || ty >= H) ? 0 : world[ty][tx]; }

    function resize() { const r = canvas.getBoundingClientRect(); canvas.width = r.width; canvas.height = r.height; }

    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (e.type === "keydown") {
        keys[k] = true;
        if (e.key === "Escape") { cleanup(); menu(body, ref); }
        if (/^[1-9]$/.test(e.key)) { selected = +e.key - 1; drawHotbar(); }
        if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      } else keys[k] = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);

    // mining state
    let mining = null; // {tx,ty,progress}
    let mouseBtn = -1, mouse = { x: 0, y: 0 };
    function mouseTile() {
      return { tx: Math.floor((mouse.x + cam.x) / TILE), ty: Math.floor((mouse.y + cam.y) / TILE) };
    }
    function inReach(tx, ty) {
      const px = (player.x + player.w / 2) / TILE, py = (player.y + player.h / 2) / TILE;
      return Math.hypot(tx + 0.5 - px, ty + 0.5 - py) < 6;
    }
    canvas.addEventListener("mousemove", (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("mousedown", (e) => {
      e.preventDefault(); mouseBtn = e.button;
      if (e.button === 2) placeBlock();
    });
    window.addEventListener("mouseup", () => { mouseBtn = -1; mining = null; });

    function placeBlock() {
      if (player.dead) return;
      const { tx, ty } = mouseTile();
      if (!inReach(tx, ty) || blockAt(tx, ty) !== 0) return;
      const id = hotbar[selected]; if (!id || !(inv[id] > 0)) return;
      // don't place inside the player
      const bx = tx * TILE, by = ty * TILE;
      if (player.x < bx + TILE && player.x + player.w > bx && player.y < by + TILE && player.y + player.h > by) return;
      world[ty][tx] = id;
      if (inv[id] !== Infinity) { inv[id]--; if (inv[id] <= 0 && !creative) { /* keep slot */ } }
      drawHotbar();
    }

    function updateMining(dt) {
      if (mouseBtn !== 0 || player.dead) { mining = null; return; }
      const { tx, ty } = mouseTile();
      const id = blockAt(tx, ty);
      const b = BLOCKS[id];
      if (!id || !b || !inReach(tx, ty) || b.hardness === Infinity || b.liquid) { mining = null; return; }
      if (!mining || mining.tx !== tx || mining.ty !== ty) mining = { tx, ty, progress: 0 };
      const hard = creative ? 0.05 : (b.hardness || 0.5);
      mining.progress += (dt / 1000) / hard;
      if (mining.progress >= 1) {
        world[ty][tx] = 0;
        if (b.drop) addItem(b.drop, 1);
        mining = null;
      }
    }

    function hurt(amount, msg) {
      if (creative || player.dead || player.hurtCd > 0) return;
      player.hp -= amount; player.hurtCd = 0.5;
      if (player.hp <= 0) { player.hp = 0; die(msg || "You died."); }
    }
    function die(msg) {
      player.dead = true;
      body.querySelector("#deathmsg").textContent = msg;
      deathEl.style.display = "flex";
    }
    body.querySelector("#respawn").onclick = respawnPlayer;
    body.querySelector("#toMenu").onclick = () => { cleanup(); menu(body, ref); };

    function step(dt) {
      if (player.dead) return;
      player.hurtCd = Math.max(0, player.hurtCd - dt / 1000);
      const inLiquid = bodyInLiquid();
      const speed = 3.2, grav = inLiquid ? 0.18 : 0.6, jump = inLiquid ? -4 : -10.5;
      player.vx = 0;
      if (keys["a"] || keys["arrowleft"]) player.vx = -speed;
      if (keys["d"] || keys["arrowright"]) player.vx = speed;
      const wantJump = keys["w"] || keys["arrowup"] || keys[" "];
      if (wantJump && (player.onGround || inLiquid)) { player.vy = jump; player.onGround = false; }
      player.vy = Math.min(player.vy + grav, inLiquid ? 3 : 14);

      // fall damage tracking
      if (player.onGround) player.fallStart = null;
      else if (player.fallStart === null) player.fallStart = player.y;

      const wasGround = player.onGround;
      moveAxis("x"); moveAxis("y");

      if (!wasGround && player.onGround && player.fallStart !== null && !inLiquid) {
        const fellTiles = (player.y - player.fallStart) / TILE;
        if (fellTiles > 3.5) hurt(Math.floor(fellTiles - 3), "You fell from a high place.");
        player.fallStart = null;
      }

      // hazards
      const feet = { tx: Math.floor((player.x + player.w / 2) / TILE), ty: Math.floor((player.y + player.h - 2) / TILE) };
      if (BLOCKS[blockAt(feet.tx, feet.ty)] && BLOCKS[blockAt(feet.tx, feet.ty)].danger) hurt(3, "You tried to swim in lava.");
      // drowning
      const head = { tx: Math.floor((player.x + player.w / 2) / TILE), ty: Math.floor((player.y + 4) / TILE) };
      if (blockAt(head.tx, head.ty) === 10) {
        player.air -= dt / 1000 * 60;
        if (player.air <= 0) { player.air = 0; hurt(2, "You drowned."); }
      } else player.air = Math.min(player.maxAir, player.air + dt / 1000 * 120);

      if (player.y > H * TILE + 200) die("You fell out of the world.");

      function moveAxis(axis) {
        if (axis === "x") player.x += player.vx; else player.y += player.vy;
        const left = Math.floor(player.x / TILE), right = Math.floor((player.x + player.w) / TILE);
        const top = Math.floor(player.y / TILE), bot = Math.floor((player.y + player.h) / TILE);
        for (let ty = top; ty <= bot; ty++) for (let tx = left; tx <= right; tx++) {
          if (!solid(tx, ty)) continue;
          const bx = tx * TILE, by = ty * TILE;
          if (player.x < bx + TILE && player.x + player.w > bx && player.y < by + TILE && player.y + player.h > by) {
            if (axis === "x") { if (player.vx > 0) player.x = bx - player.w; else if (player.vx < 0) player.x = bx + TILE; player.vx = 0; }
            else { if (player.vy > 0) { player.y = by - player.h; player.onGround = true; } else if (player.vy < 0) player.y = by + TILE; player.vy = 0; }
          }
        }
      }
      player.x = Math.max(0, Math.min(W * TILE - player.w, player.x));
    }
    function bodyInLiquid() {
      const tx = Math.floor((player.x + player.w / 2) / TILE), ty = Math.floor((player.y + player.h / 2) / TILE);
      return BLOCKS[blockAt(tx, ty)] && BLOCKS[blockAt(tx, ty)].liquid;
    }

    function drawBlock(id, sx, sy) {
      const b = BLOCKS[id]; if (!b || id === 0) return;
      const t = TEX[b.tex];
      ctx.globalAlpha = b.alpha || 1;
      ctx.imageSmoothingEnabled = false;
      if (t && t.ok) ctx.drawImage(t.img, sx, sy, TILE, TILE);
      else {
        const pc = proc(id);
        if (pc) ctx.drawImage(pc, sx, sy, TILE, TILE);
        else if (TEX.missing && TEX.missing.ok) ctx.drawImage(TEX.missing.img, sx, sy, TILE, TILE);
        else { ctx.fillStyle = b.color; ctx.fillRect(sx, sy, TILE, TILE); }
      }
      ctx.globalAlpha = 1;
      if (b.solid) { ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.strokeRect(sx, sy, TILE, TILE); }
    }

    function render() {
      cam.x = Math.max(0, Math.min(W * TILE - canvas.width, player.x + player.w / 2 - canvas.width / 2));
      cam.y = Math.max(0, Math.min(H * TILE - canvas.height, player.y + player.h / 2 - canvas.height / 2));
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      g.addColorStop(0, "#7ec0ee"); g.addColorStop(1, "#cfeaff");
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);

      const x0 = Math.floor(cam.x / TILE), x1 = Math.ceil((cam.x + canvas.width) / TILE);
      const y0 = Math.floor(cam.y / TILE), y1 = Math.ceil((cam.y + canvas.height) / TILE);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        drawBlock(blockAt(tx, ty), tx * TILE - cam.x, ty * TILE - cam.y);
      }
      // mining cracks
      if (mining) {
        const sx = mining.tx * TILE - cam.x, sy = mining.ty * TILE - cam.y;
        const stage = Math.min(9, Math.floor(mining.progress * 10));
        ctx.strokeStyle = "rgba(0,0,0," + (0.25 + stage * 0.05) + ")"; ctx.lineWidth = 1;
        for (let i = 0; i <= stage; i++) {
          ctx.beginPath(); ctx.moveTo(sx + (i * 3) % TILE, sy); ctx.lineTo(sx, sy + (i * 5) % TILE); ctx.stroke();
        }
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.strokeRect(sx, sy, TILE, TILE);
      }
      // targeted block highlight
      const mt = mouseTile();
      if (inReach(mt.tx, mt.ty) && blockAt(mt.tx, mt.ty) !== 0) {
        ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 2;
        ctx.strokeRect(mt.tx * TILE - cam.x, mt.ty * TILE - cam.y, TILE, TILE);
      }
      // player
      ctx.fillStyle = "#3a7bd5"; ctx.fillRect(player.x - cam.x, player.y - cam.y, player.w, player.h);
      ctx.fillStyle = "#e0b487"; ctx.fillRect(player.x - cam.x, player.y - cam.y, player.w, player.w * 0.7);

      drawHud();
    }

    function drawHud() {
      if (creative) return;
      // hearts
      const hearts = player.maxHp / 2;
      for (let i = 0; i < hearts; i++) {
        const hx = 10 + i * 20, hy = 10;
        const filled = player.hp - i * 2;
        ctx.fillStyle = "#3a0000"; heart(hx, hy);
        if (filled >= 2) { ctx.fillStyle = "#ff3b3b"; heart(hx, hy); }
        else if (filled === 1) { ctx.fillStyle = "#ff3b3b"; heart(hx, hy, true); }
      }
      // air bubbles (only when low/underwater)
      if (player.air < player.maxAir) {
        const bubbles = Math.ceil(player.air / 30);
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = i < bubbles ? "#bfe8ff" : "rgba(255,255,255,0.15)";
          ctx.beginPath(); ctx.arc(16 + i * 18, 34, 5, 0, 7); ctx.fill();
        }
      }
      function heart(x, y, half) {
        ctx.beginPath();
        const w = half ? 8 : 16;
        ctx.moveTo(x + 8, y + 14);
        ctx.bezierCurveTo(x - 2, y + 5, x + 4, y - 2, x + 8, y + 4);
        ctx.bezierCurveTo(x + 12, y - 2, x + 18, y + 5, x + 8, y + 14);
        ctx.fill();
      }
    }

    let raf, last = 0, fpsT = 0, frames = 0;
    function loop(ts) {
      const dt = Math.min(50, ts - last); last = ts;
      step(dt); updateMining(dt); render();
      if (cfg.showFps) { frames++; fpsT += dt; if (fpsT >= 500) { fpsEl.textContent = Math.round(frames / (fpsT / 1000)) + " fps"; frames = 0; fpsT = 0; } }
      raf = requestAnimationFrame(loop);
    }
    function cleanup() {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
      window.removeEventListener("resize", resize);
    }
    window.addEventListener("resize", resize);
    body.closest(".win").addEventListener("DOMNodeRemoved", cleanup);
    resize();
    raf = requestAnimationFrame(loop);
  }

  function genWorld(W, H, seed, seaY) {
    const world = Array.from({ length: H }, () => new Array(W).fill(0));
    const rng = mulberry32(seed);
    // surface via layered sines with seed-derived phases
    const p1 = rng() * 6.28, p2 = rng() * 6.28, p3 = rng() * 6.28;
    const base = Math.floor(H * 0.42);
    const surf = [];
    for (let x = 0; x < W; x++) {
      const h = base + Math.round(Math.sin(x * 0.18 + p1) * 4 + Math.sin(x * 0.05 + p2) * 6 + Math.sin(x * 0.5 + p3) * 1.5);
      surf[x] = h;
    }
    for (let x = 0; x < W; x++) {
      const s = surf[x];
      const underwater = s > seaY;
      for (let y = 0; y < H; y++) {
        if (y === H - 1) { world[y][x] = 16; continue; } // bedrock floor
        if (y < s) {
          if (y <= seaY && !underwater) {} // air
          continue;
        }
        if (y === s) world[y][x] = underwater ? 6 : 1;             // sand or grass
        else if (y < s + 4) world[y][x] = underwater ? 6 : 2;      // sand/dirt
        else {
          world[y][x] = 3; // stone
          const r = cell(seed, x, y);
          const depth = y - s;
          if (depth > 6) {
            if (r < 0.010 && y > H - 16) world[y][x] = 15;      // diamond (deep)
            else if (r < 0.020) world[y][x] = 14;               // gold
            else if (r < 0.045) world[y][x] = 13;               // iron
            else if (r < 0.090) world[y][x] = 12;               // coal
          }
        }
      }
      // water fill in dips up to sea level
      if (underwater) for (let y = seaY; y < s; y++) if (world[y][x] === 0) world[y][x] = 10;
    }
    // caves: carve where 3D-ish hash is high, leave lava pockets deep
    for (let x = 1; x < W - 1; x++) for (let y = base; y < H - 2; y++) {
      const n = cell(seed ^ 0x9e37, x, y) * 0.6 + cell(seed ^ 0x51ed, Math.floor(x / 2), Math.floor(y / 2)) * 0.4;
      if (n > 0.78 && BLOCKS[world[y][x]].solid) {
        world[y][x] = (y > H - 8 && cell(seed ^ 0xa1, x, y) > 0.7) ? 11 : 0; // lava deep, else cave
      }
    }
    // trees on grass
    const trng = mulberry32(seed ^ 0xBEEF);
    for (let x = 2; x < W - 2; x++) {
      const s = surf[x];
      if (world[s][x] !== 1) continue;
      if (trng() < 0.12) {
        const top = s - 1;
        const th = 3 + Math.floor(trng() * 2);
        for (let t = 0; t < th; t++) if (top - t > 0) world[top - t][x] = 4;
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 0; dy++) {
          const lx = x + dx, ly = top - th + dy;
          if (lx >= 0 && lx < W && ly >= 0 && world[ly][lx] === 0) world[ly][lx] = 5;
        }
      }
    }
    // plants & mushrooms on grass (after trees so leaves don't get overwritten)
    const prng = mulberry32(seed ^ 0xF10E);
    const flowers = [20, 21, 22]; // poppy, daisy, dandelion
    const fungi = [23, 24];       // red, brown mushroom
    for (let x = 0; x < W; x++) {
      const s = surf[x];
      if (s <= 0 || world[s][x] !== 1) continue;
      const above = s - 1;
      if (above < 0 || world[above][x] !== 0) continue;
      const r = prng();
      if (r < 0.06) world[above][x] = flowers[Math.floor(prng() * flowers.length)];
      else if (r < 0.08) world[above][x] = fungi[Math.floor(prng() * fungi.length)];
    }
    return world;
  }
})();
