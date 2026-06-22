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
    1:  { name: "Grass", color: "#5fa83b", solid: true, hardness: 0.6, drop: 2, tex: "grass" },
    2:  { name: "Dirt", color: "#8a5a2b", solid: true, hardness: 0.5, drop: 2, tex: "dirt" },
    3:  { name: "Stone", color: "#8c8c8c", solid: true, hardness: 1.5, drop: 17, tex: "stone" },
    4:  { name: "Log", color: "#6b4a25", solid: true, hardness: 2, drop: 4, tex: "log" },
    5:  { name: "Leaves", color: "#3e9b3e", solid: true, hardness: 0.2, drop: 5, tex: "leaves", alpha: 0.95 },
    6:  { name: "Sand", color: "#e3d59b", solid: true, hardness: 0.5, drop: 6, tex: "sand" },
    7:  { name: "Planks", color: "#b08243", solid: true, hardness: 2, drop: 7, tex: "planks" },
    8:  { name: "Glass", color: "#bfe8f5", solid: true, hardness: 0.3, drop: 8, tex: "glass", alpha: 0.5 },
    9:  { name: "Brick", color: "#9e4636", solid: true, hardness: 2, drop: 9, tex: "brick" },
    12: { name: "Coal Ore", color: "#5a5a5a", solid: true, hardness: 2.5, drop: 12, tex: "coal_ore" },
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
  };

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

  AppRegistry.minecraft = function () {
    const ref = cw({ title: "Mincraft", icon: Icon.mini("minecraft", "Mincraft"), width: 900, height: 640, appId: "minecraft" });
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
      <div class="mc-splash-text">100% 3D!</div>
      <div class="mc-version">Windows 12 Edition</div>
    </div>`;
    const act = {
      play: () => createWorld(body, ref),
      opts: () => options(body, ref),
      quit: () => ref.close(),
      multi: () => Notify.show({ icon: "", title: "Multiplayer", body: "No servers reachable in the simulation." }),
      realms: () => Notify.show({ icon: "", title: "Realms", body: "Realms isn't available here." }),
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

  // ===================== 3D GAME =====================
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
    const W = 40, H = 28, D = 40;
    const seed = hashSeed(seedStr);
    const world = genWorld3D(W, H, D, seed);

    body.innerHTML = `<div class="mc-root mc-game3d">
      <canvas class="mc3-canvas"></canvas>
      <div class="mc3-crosshair"></div>
      <div class="mc3-hud"><div class="mc-hotbar"></div></div>
      <div class="mc3-help">Drag right side to look · drag left to move · tap right to mine · + to place · seed: ${seedStr}</div>
      <button class="mc3-btn mc3-jump" title="Jump">▲</button>
      <button class="mc3-btn mc3-place" title="Place">+</button>
      <div class="mc-fps" style="display:${cfg.showFps ? "block" : "none"}">0 fps</div>
      <div class="mc3-hearts"></div>
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

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88c8f0);
    scene.fog = new THREE.Fog(0x88c8f0, 18, 50);
    const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.55);
    sun.position.set(0.5, 1, 0.3); scene.add(sun);

    const materials = {};
    const textures = {};
    function materialFor(id) {
      if (materials[id]) return materials[id];
      const b = BLOCKS[id];
      const m = new THREE.MeshLambertMaterial({
        color: new THREE.Color(b.color || "#ffffff"),
        transparent: !!b.alpha || !!b.plant,
        opacity: b.alpha != null ? b.alpha : 1,
        alphaTest: b.plant ? 0.5 : 0,
        side: b.plant ? THREE.DoubleSide : THREE.FrontSide,
      });
      materials[id] = m;
      if (b.tex) {
        new THREE.TextureLoader().load("assets/mc_" + b.tex + ".png", (tex) => {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.generateMipmaps = false;
          textures[b.tex] = tex;
          m.map = tex;
          m.color.setHex(0xffffff);
          m.needsUpdate = true;
        }, undefined, () => {});
      }
      return m;
    }

    function solid(x, y, z) {
      if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return false;
      const b = BLOCKS[world[y][z][x]];
      return b && b.solid;
    }
    function blockAt(x, y, z) {
      if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return 0;
      return world[y][z][x];
    }
    function isExposed(x, y, z) {
      const b = BLOCKS[world[y][z][x]];
      if (!b) return false;
      if (b.plant) return true;
      return !solid(x + 1, y, z) || !solid(x - 1, y, z) || !solid(x, y + 1, z) || !solid(x, y - 1, z) || !solid(x, y, z + 1) || !solid(x, y, z - 1);
    }

    const cube = new THREE.BoxGeometry(1, 1, 1);
    const meshes = {};
    const dummyObj = new THREE.Object3D();
    function rebuildMeshes() {
      Object.values(meshes).forEach((m) => scene.remove(m));
      Object.keys(meshes).forEach((k) => delete meshes[k]);
      const positions = {};
      for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
        const id = world[y][z][x];
        if (id === 0) continue;
        if (!isExposed(x, y, z)) continue;
        (positions[id] = positions[id] || []).push(x, y, z);
      }
      Object.keys(positions).forEach((idStr) => {
        const id = +idStr;
        const arr = positions[id];
        const n = arr.length / 3;
        const mesh = new THREE.InstancedMesh(cube, materialFor(id), n);
        for (let i = 0; i < n; i++) {
          dummyObj.position.set(arr[i * 3] + 0.5, arr[i * 3 + 1] + 0.5, arr[i * 3 + 2] + 0.5);
          dummyObj.updateMatrix();
          mesh.setMatrixAt(i, dummyObj.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        scene.add(mesh);
        meshes[id] = mesh;
      });
    }
    rebuildMeshes();

    const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)),
      new THREE.LineBasicMaterial({ color: 0x000000 }));
    hl.visible = false; scene.add(hl);

    let spawnY = H - 1;
    const cx = W >> 1, cz = D >> 1;
    while (spawnY > 0 && !solid(cx, spawnY - 1, cz)) spawnY--;
    const player = {
      pos: new THREE.Vector3(cx + 0.5, spawnY + 0.1, cz + 0.5),
      vel: new THREE.Vector3(), yaw: 0, pitch: 0,
      onGround: false, hp: 20, dead: false, fallStart: null, hurtCd: 0,
    };

    const inv = {};
    let hotbar = [], selected = 0;
    if (creative) {
      hotbar = [1, 3, 4, 7, 18, 19, 25, 20, 23];
      hotbar.forEach((id) => inv[id] = Infinity);
    }
    const hbEl = body.querySelector(".mc-hotbar");
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
          (b ? `<span class="mc-slot-sw" style="background:${b.color || "#888"}"></span>` : "") +
          (b && cnt !== Infinity ? `<span class="mc-slot-c">${cnt}</span>` : "") +
          `<span class="mc-slot-n">${i + 1}</span></div>`);
        slot.onclick = () => { selected = i; drawHotbar(); };
        hbEl.appendChild(slot);
      }
    }
    drawHotbar();
    function drawHearts() {
      if (creative) { heartsEl.innerHTML = ""; return; }
      let html = "";
      for (let i = 0; i < 10; i++) {
        const filled = player.hp - i * 2;
        const cls = filled >= 2 ? "h-full" : filled === 1 ? "h-half" : "h-empty";
        html += `<span class="mc3-heart ${cls}"></span>`;
      }
      heartsEl.innerHTML = html;
    }
    drawHearts();

    function raycastVoxel(origin, dir, maxDist) {
      let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
      const dx = Math.sign(dir.x), dy = Math.sign(dir.y), dz = Math.sign(dir.z);
      const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z);
      function nextT(o, d, v) { if (d > 0) return ((v + 1) - o) / d; if (d < 0) return (v - o) / d; return Infinity; }
      let tx = nextT(origin.x, dir.x, x), ty = nextT(origin.y, dir.y, y), tz = nextT(origin.z, dir.z, z);
      let px = x, py = y, pz = z;
      for (let i = 0; i < 80; i++) {
        if (solid(x, y, z)) return { x, y, z, prev: { x: px, y: py, z: pz } };
        px = x; py = y; pz = z;
        if (tx < ty && tx < tz) { if (tx > maxDist) return null; x += dx; tx += tdx; }
        else if (ty < tz) { if (ty > maxDist) return null; y += dy; ty += tdy; }
        else { if (tz > maxDist) return null; z += dz; tz += tdz; }
      }
      return null;
    }
    function lookDir() {
      const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw), cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
      return new THREE.Vector3(-sy * cp, sp, -cy * cp).normalize();
    }
    function eyePos() {
      return new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z);
    }
    function currentTarget() {
      return raycastVoxel(eyePos(), lookDir(), 6);
    }

    let mining = null;
    function tryPlace() {
      if (player.dead) return;
      const hit = currentTarget();
      if (!hit || !hit.prev) return;
      const { x, y, z } = hit.prev;
      if (blockAt(x, y, z) !== 0) return;
      const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
      const py0 = Math.floor(player.pos.y), py1 = Math.floor(player.pos.y + 1.7);
      if (x === px && z === pz && (y >= py0 && y <= py1)) return;
      const id = hotbar[selected];
      if (!id || !(inv[id] > 0)) return;
      world[y][z][x] = id;
      if (inv[id] !== Infinity) inv[id]--;
      drawHotbar();
      rebuildMeshes();
    }
    function instantMine() {
      const hit = currentTarget();
      if (!hit) return;
      breakBlockAt(hit.x, hit.y, hit.z);
    }
    function breakBlockAt(x, y, z) {
      const id = world[y][z][x]; const b = BLOCKS[id];
      if (!b || !b.solid || b.hardness === Infinity) return;
      world[y][z][x] = 0;
      if (b.drop) addItem(b.drop, 1);
      mining = null;
      rebuildMeshes();
    }
    function updateMining(dt) {
      if (!mineHeld || player.dead) { mining = null; return; }
      const hit = currentTarget();
      if (!hit) { mining = null; return; }
      const id = world[hit.y][hit.z][hit.x]; const b = BLOCKS[id];
      if (!b || !b.solid || b.hardness === Infinity) { mining = null; return; }
      if (!mining || mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z) {
        mining = { x: hit.x, y: hit.y, z: hit.z, progress: 0 };
      }
      const hard = creative ? 0.05 : (b.hardness || 0.5);
      mining.progress += (dt / 1000) / hard;
      if (mining.progress >= 1) breakBlockAt(hit.x, hit.y, hit.z);
    }

    const keys = {};
    let mineHeld = false;
    let pointerLocked = false;
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (e.type === "keydown") {
        keys[k] = true;
        if (e.key === "Escape") { cleanup(); menu(body, ref); }
        if (/^[1-9]$/.test(e.key)) { selected = +e.key - 1; drawHotbar(); }
        if ([" ", "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      } else keys[k] = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);

    canvas.addEventListener("click", () => { if (!isTouch && !pointerLocked && canvas.requestPointerLock) canvas.requestPointerLock(); });
    document.addEventListener("pointerlockchange", () => { pointerLocked = (document.pointerLockElement === canvas); });
    canvas.addEventListener("mousemove", (e) => {
      if (!pointerLocked) return;
      player.yaw -= e.movementX * 0.0025;
      player.pitch -= e.movementY * 0.0025;
      player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
    });
    canvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (!pointerLocked) return;
      if (e.button === 0) mineHeld = true;
      if (e.button === 2) tryPlace();
    });
    window.addEventListener("mouseup", () => { mineHeld = false; mining = null; });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    let touchLook = null, touchMove = null, touchMoveStart = null;
    const touchOpts = { passive: false };
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      for (const t of e.changedTouches) {
        const lx = t.clientX - r.left;
        if (lx < r.width / 2) {
          if (!touchMove) { touchMove = { id: t.identifier, x: t.clientX, y: t.clientY }; touchMoveStart = { x: t.clientX, y: t.clientY }; }
        } else {
          if (!touchLook) { touchLook = { id: t.identifier, x: t.clientX, y: t.clientY, moved: 0, startTime: Date.now() }; }
        }
      }
    }, touchOpts);
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (touchLook && t.identifier === touchLook.id) {
          const dx = t.clientX - touchLook.x, dy = t.clientY - touchLook.y;
          player.yaw -= dx * 0.006;
          player.pitch -= dy * 0.006;
          player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
          touchLook.x = t.clientX; touchLook.y = t.clientY;
          touchLook.moved += Math.abs(dx) + Math.abs(dy);
        }
        if (touchMove && t.identifier === touchMove.id) {
          touchMove.x = t.clientX; touchMove.y = t.clientY;
        }
      }
    }, touchOpts);
    canvas.addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) {
        if (touchLook && t.identifier === touchLook.id) {
          if (touchLook.moved < 10 && Date.now() - touchLook.startTime < 400) instantMine();
          touchLook = null;
        }
        if (touchMove && t.identifier === touchMove.id) { touchMove = null; touchMoveStart = null; }
      }
    });

    body.querySelector(".mc3-jump").onclick = () => { if (player.onGround && !player.dead) { player.vel.y = 8.5; player.onGround = false; } };
    body.querySelector(".mc3-place").onclick = () => tryPlace();

    function step(dt) {
      if (player.dead) return;
      player.hurtCd = Math.max(0, player.hurtCd - dt / 1000);
      const speed = 4.2, grav = 22, jumpVel = 8.5;

      let fx = 0, fz = 0;
      if (keys["w"] || keys["arrowup"]) fz -= 1;
      if (keys["s"] || keys["arrowdown"]) fz += 1;
      if (keys["a"] || keys["arrowleft"]) fx -= 1;
      if (keys["d"] || keys["arrowright"]) fx += 1;
      if (touchMove && touchMoveStart) {
        const tdx = touchMove.x - touchMoveStart.x, tdy = touchMove.y - touchMoveStart.y;
        const mag = Math.hypot(tdx, tdy);
        if (mag > 8) { fx += tdx / mag; fz += tdy / mag; }
      }
      const nMag = Math.hypot(fx, fz);
      if (nMag > 1) { fx /= nMag; fz /= nMag; }

      const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
      const wx = fx * cy - fz * sy;
      const wz = fx * sy + fz * cy;

      player.vel.x = wx * speed;
      player.vel.z = wz * speed;

      if (keys[" "] && player.onGround) { player.vel.y = jumpVel; player.onGround = false; }
      player.vel.y -= grav * dt / 1000;
      if (player.vel.y < -40) player.vel.y = -40;

      if (player.onGround) player.fallStart = null;
      else if (player.fallStart === null) player.fallStart = player.pos.y;

      const wasGround = player.onGround;
      moveAxis("x", player.vel.x * dt / 1000);
      moveAxis("z", player.vel.z * dt / 1000);
      moveAxis("y", player.vel.y * dt / 1000);

      if (!wasGround && player.onGround && player.fallStart !== null) {
        const fell = player.fallStart - player.pos.y;
        if (fell > 3.5 && !creative) hurt(Math.floor(fell - 3), "You fell from a high place.");
        player.fallStart = null;
      }
      if (player.pos.y < -20) die("You fell out of the world.");
    }
    function moveAxis(axis, delta) {
      if (axis === "x") player.pos.x += delta;
      else if (axis === "y") player.pos.y += delta;
      else player.pos.z += delta;
      const HW = 0.3, HH = 1.75;
      const minX = Math.floor(player.pos.x - HW), maxX = Math.floor(player.pos.x + HW);
      const minY = Math.floor(player.pos.y), maxY = Math.floor(player.pos.y + HH);
      const minZ = Math.floor(player.pos.z - HW), maxZ = Math.floor(player.pos.z + HW);
      for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
        if (!solid(x, y, z)) continue;
        if (axis === "x") { if (delta > 0) player.pos.x = x - HW - 1e-4; else player.pos.x = (x + 1) + HW + 1e-4; player.vel.x = 0; return; }
        if (axis === "y") {
          if (delta > 0) { player.pos.y = y - HH - 1e-4; player.vel.y = 0; }
          else { player.pos.y = (y + 1) + 1e-4; player.vel.y = 0; player.onGround = true; }
          return;
        }
        if (axis === "z") { if (delta > 0) player.pos.z = z - HW - 1e-4; else player.pos.z = (z + 1) + HW + 1e-4; player.vel.z = 0; return; }
      }
      if (axis === "y" && delta > 0) player.onGround = false;
    }

    function hurt(n, msg) {
      if (creative || player.dead || player.hurtCd > 0) return;
      player.hp = Math.max(0, player.hp - n); player.hurtCd = 0.5;
      drawHearts();
      if (player.hp <= 0) die(msg || "You died.");
    }
    function die(msg) {
      player.dead = true;
      body.querySelector("#deathmsg").textContent = msg;
      deathEl.style.display = "flex";
    }
    function respawn() {
      let sy = H - 1; while (sy > 0 && !solid(cx, sy - 1, cz)) sy--;
      player.pos.set(cx + 0.5, sy + 0.1, cz + 0.5);
      player.vel.set(0, 0, 0); player.hp = 20; player.dead = false; player.fallStart = null;
      drawHearts(); deathEl.style.display = "none";
    }
    body.querySelector("#respawn").onclick = respawn;
    body.querySelector("#toMenu").onclick = () => { cleanup(); menu(body, ref); };

    let raf, last = 0, fpsT = 0, frames = 0;
    function loop(ts) {
      const dt = Math.min(50, ts - last); last = ts;
      step(dt); updateMining(dt);

      const eye = eyePos(), dir = lookDir();
      camera.position.copy(eye);
      camera.lookAt(eye.x + dir.x, eye.y + dir.y, eye.z + dir.z);

      const hit = currentTarget();
      if (hit) { hl.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); hl.visible = true; }
      else hl.visible = false;

      const r = canvas.getBoundingClientRect();
      if (Math.abs(canvas.width - r.width * renderer.getPixelRatio()) > 1) {
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / Math.max(1, r.height);
        camera.updateProjectionMatrix();
      }

      renderer.render(scene, camera);
      if (cfg.showFps) {
        frames++; fpsT += dt;
        if (fpsT > 500) { fpsEl.textContent = Math.round(frames / (fpsT / 1000)) + " fps"; frames = 0; fpsT = 0; }
      }
      raf = requestAnimationFrame(loop);
    }

    function cleanup() {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKey);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      renderer.dispose();
      cube.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      Object.values(textures).forEach((t) => t.dispose());
    }
    body.closest(".win").addEventListener("DOMNodeRemoved", cleanup);

    raf = requestAnimationFrame(loop);
  }

  function genWorld3D(W, H, D, seed) {
    const world = [];
    for (let y = 0; y < H; y++) {
      const layer = [];
      for (let z = 0; z < D; z++) layer.push(new Array(W).fill(0));
      world.push(layer);
    }

    const rng = mulberry32(seed);
    const p1 = rng() * 6.28, p2 = rng() * 6.28, p3 = rng() * 6.28, p4 = rng() * 6.28;
    const base = Math.floor(H * 0.5);

    const surf = [];
    for (let z = 0; z < D; z++) {
      surf.push([]);
      for (let x = 0; x < W; x++) {
        let h = base
          + Math.sin(x * 0.18 + p1) * 2
          + Math.sin(z * 0.21 + p2) * 2
          + Math.sin((x + z) * 0.07 + p3) * 3
          + Math.sin((x - z) * 0.11 + p4) * 1.5;
        h = Math.round(h);
        h = Math.max(2, Math.min(H - 3, h));
        surf[z][x] = h;
        for (let y = 0; y <= h; y++) {
          if (y === 0) world[y][z][x] = 16;
          else if (y === h) world[y][z][x] = 1;
          else if (y >= h - 3) world[y][z][x] = 2;
          else {
            world[y][z][x] = 3;
            const r = cell(seed, x + y * 17, z + y * 31);
            if (y < 4) { if (r < 0.015) world[y][z][x] = 15; else if (r < 0.030) world[y][z][x] = 14; }
            if (r < 0.045) world[y][z][x] = 13;
            else if (r < 0.10) world[y][z][x] = 12;
          }
        }
      }
    }

    const trng = mulberry32(seed ^ 0xBEEF);
    for (let z = 2; z < D - 2; z++) for (let x = 2; x < W - 2; x++) {
      if (trng() > 0.04) continue;
      const sy = surf[z][x];
      const th = 4 + Math.floor(trng() * 2);
      for (let t = 1; t <= th; t++) if (sy + t < H) world[sy + t][z][x] = 4;
      for (let dy = th - 1; dy <= th + 1; dy++) {
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
          const r = Math.abs(dx) + Math.abs(dz) + (dy === th + 1 ? 1 : 0);
          if (r > 3) continue;
          const lx = x + dx, ly = sy + dy, lz = z + dz;
          if (lx >= 0 && lx < W && ly < H && lz >= 0 && lz < D && world[ly][lz][lx] === 0) world[ly][lz][lx] = 5;
        }
      }
    }

    const prng = mulberry32(seed ^ 0xF10E);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const sy = surf[z][x];
      if (world[sy][z][x] !== 1) continue;
      if (sy + 1 >= H || world[sy + 1][z][x] !== 0) continue;
      const r = prng();
      if (r < 0.05) world[sy + 1][z][x] = [20, 21, 22][Math.floor(prng() * 3)];
      else if (r < 0.07) world[sy + 1][z][x] = 23 + Math.floor(prng() * 2);
    }

    return world;
  }
})();
