/* A small 2D Minecraft-style sandbox app: title menu, pixelated Options toggles,
   and a mine/build world with gravity, a hotbar, and a follow camera. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const TILE = 28;
  // block id -> {name, color, solid}
  const BLOCKS = [
    { id: 0, name: "Air", color: null, solid: false },
    { id: 1, name: "Grass", color: "#5fa83b", top: "#7ec850", solid: true },
    { id: 2, name: "Dirt", color: "#8a5a2b", solid: true },
    { id: 3, name: "Stone", color: "#8c8c8c", solid: true },
    { id: 4, name: "Wood", color: "#6b4a25", solid: true },
    { id: 5, name: "Leaves", color: "#3e9b3e", solid: true },
    { id: 6, name: "Sand", color: "#e3d59b", solid: true },
    { id: 7, name: "Planks", color: "#b08243", solid: true },
    { id: 8, name: "Glass", color: "#bfe8f5", solid: true, alpha: 0.45 },
    { id: 9, name: "Brick", color: "#9e4636", solid: true },
  ];

  AppRegistry.minecraft = function () {
    const ref = cw({ title: "Mincraft", icon: Icon.mini("minecraft", "Mincraft"), width: 860, height: 600, appId: "minecraft" });
    const body = ref.body;
    if (S().appData.minecraft == null) S().appData.minecraft = { sound: true, fullscreen: false, showFps: false };
    menu(body, ref);
  };

  function menu(body, ref) {
    body.innerHTML = `<div class="mc-root mc-menu">
      <div class="mc-title">MINCRAFT</div>
      <div class="mc-sub">Windows 12 Edition</div>
      <div class="mc-menu-btns">
        <button class="mc-btn" id="play">Singleplayer</button>
        <button class="mc-btn" id="opts">Options</button>
        <button class="mc-btn" id="quit">Quit Game</button>
      </div>
      <div class="mc-splash">100% blocky!</div>
    </div>`;
    body.querySelector("#play").onclick = () => game(body, ref);
    body.querySelector("#opts").onclick = () => options(body, ref);
    body.querySelector("#quit").onclick = () => ref.close();
  }

  function options(body, ref) {
    const cfg = S().appData.minecraft;
    body.innerHTML = `<div class="mc-root mc-menu">
      <div class="mc-title" style="font-size:1.6rem">Options</div>
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

  function game(body, ref) {
    const cfg = S().appData.minecraft;
    body.innerHTML = `<div class="mc-root mc-game">
      <canvas class="mc-canvas"></canvas>
      <div class="mc-hud">
        <div class="mc-hotbar"></div>
      </div>
      <div class="mc-help">WASD / arrows move &middot; W or Space jump &middot; click mine &middot; right-click place &middot; 1-9 pick block &middot; Esc menu</div>
      <div class="mc-fps" style="display:${cfg.showFps ? "block" : "none"}">0 fps</div>
    </div>`;
    const canvas = body.querySelector(".mc-canvas");
    const ctx = canvas.getContext("2d");
    const W = 100, H = 48; // world size in tiles
    const world = genWorld(W, H);

    // hotbar
    const hotbar = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    let selected = 0;
    const hb = body.querySelector(".mc-hotbar");
    function drawHotbar() {
      hb.innerHTML = "";
      hotbar.forEach((bid, i) => {
        const b = BLOCKS[bid];
        const slot = el(`<div class="mc-slot ${i === selected ? "sel" : ""}"><span class="mc-slot-sw" style="background:${b.color}"></span><span class="mc-slot-n">${i + 1}</span></div>`);
        slot.onclick = () => { selected = i; drawHotbar(); };
        hb.appendChild(slot);
      });
    }
    drawHotbar();

    // player
    const player = { x: (W / 2) * TILE, y: 4 * TILE, w: TILE * 0.8, h: TILE * 1.7, vx: 0, vy: 0, onGround: false };
    const keys = {};
    const cam = { x: 0, y: 0 };

    function solidAt(tx, ty) {
      if (tx < 0 || tx >= W || ty < 0 || ty >= H) return false;
      const b = BLOCKS[world[ty][tx]];
      return b && b.solid;
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width; canvas.height = r.height;
    }

    // input
    const onKey = (e) => {
      if (e.type === "keydown") {
        keys[e.key.toLowerCase()] = true;
        if (e.key === "Escape") { cleanup(); menu(body, ref); }
        if (/^[1-9]$/.test(e.key)) { selected = +e.key - 1; drawHotbar(); }
        if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
      } else keys[e.key.toLowerCase()] = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKey);

    function worldFromMouse(e) {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left + cam.x, my = e.clientY - r.top + cam.y;
      return { tx: Math.floor(mx / TILE), ty: Math.floor(my / TILE) };
    }
    function inReach(tx, ty) {
      const px = (player.x + player.w / 2) / TILE, py = (player.y + player.h / 2) / TILE;
      return Math.hypot(tx + 0.5 - px, ty + 0.5 - py) < 6;
    }
    canvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const { tx, ty } = worldFromMouse(e);
      if (tx < 0 || tx >= W || ty < 0 || ty >= H || !inReach(tx, ty)) return;
      if (e.button === 2) { // place
        if (world[ty][tx] === 0) world[ty][tx] = hotbar[selected];
      } else { // mine
        world[ty][tx] = 0;
      }
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    let raf, last = 0, fpsT = 0, frames = 0;
    const fpsEl = body.querySelector(".mc-fps");

    function step(dt) {
      const speed = 3.4, grav = 0.6, jump = -10.5;
      player.vx = 0;
      if (keys["a"] || keys["arrowleft"]) player.vx = -speed;
      if (keys["d"] || keys["arrowright"]) player.vx = speed;
      if ((keys["w"] || keys["arrowup"] || keys[" "]) && player.onGround) { player.vy = jump; player.onGround = false; }
      player.vy = Math.min(player.vy + grav, 14);

      moveAxis("x");
      moveAxis("y");

      function moveAxis(axis) {
        if (axis === "x") player.x += player.vx; else player.y += player.vy;
        const left = Math.floor(player.x / TILE), right = Math.floor((player.x + player.w) / TILE);
        const top = Math.floor(player.y / TILE), bot = Math.floor((player.y + player.h) / TILE);
        for (let ty = top; ty <= bot; ty++) {
          for (let tx = left; tx <= right; tx++) {
            if (!solidAt(tx, ty)) continue;
            const bx = tx * TILE, by = ty * TILE;
            if (player.x < bx + TILE && player.x + player.w > bx && player.y < by + TILE && player.y + player.h > by) {
              if (axis === "x") {
                if (player.vx > 0) player.x = bx - player.w; else if (player.vx < 0) player.x = bx + TILE;
                player.vx = 0;
              } else {
                if (player.vy > 0) { player.y = by - player.h; player.onGround = true; } else if (player.vy < 0) player.y = by + TILE;
                player.vy = 0;
              }
            }
          }
        }
      }
      // bounds
      player.x = Math.max(0, Math.min(W * TILE - player.w, player.x));
      if (player.y > H * TILE) { player.y = 0; player.vy = 0; }
    }

    function render() {
      cam.x = player.x + player.w / 2 - canvas.width / 2;
      cam.y = player.y + player.h / 2 - canvas.height / 2;
      cam.x = Math.max(0, Math.min(W * TILE - canvas.width, cam.x));
      cam.y = Math.max(0, Math.min(H * TILE - canvas.height, cam.y));

      // sky
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      g.addColorStop(0, "#7ec0ee"); g.addColorStop(1, "#cfeaff");
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);

      const x0 = Math.floor(cam.x / TILE), x1 = Math.ceil((cam.x + canvas.width) / TILE);
      const y0 = Math.floor(cam.y / TILE), y1 = Math.ceil((cam.y + canvas.height) / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
          const b = BLOCKS[world[ty][tx]];
          if (!b || !b.color) continue;
          const sx = tx * TILE - cam.x, sy = ty * TILE - cam.y;
          ctx.globalAlpha = b.alpha || 1;
          ctx.fillStyle = b.color; ctx.fillRect(sx, sy, TILE, TILE);
          if (b.top) { ctx.fillStyle = b.top; ctx.fillRect(sx, sy, TILE, 5); }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.strokeRect(sx, sy, TILE, TILE);
        }
      }
      // player
      ctx.fillStyle = "#3a7bd5";
      ctx.fillRect(player.x - cam.x, player.y - cam.y, player.w, player.h);
      ctx.fillStyle = "#e0b487";
      ctx.fillRect(player.x - cam.x, player.y - cam.y, player.w, player.w * 0.7);
    }

    function loop(ts) {
      const dt = ts - last; last = ts;
      step(dt);
      render();
      if (cfg.showFps) {
        frames++; fpsT += dt;
        if (fpsT >= 500) { fpsEl.textContent = Math.round(frames / (fpsT / 1000)) + " fps"; frames = 0; fpsT = 0; }
      }
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

  function genWorld(W, H) {
    const world = Array.from({ length: H }, () => new Array(W).fill(0));
    const base = Math.floor(H * 0.45);
    for (let x = 0; x < W; x++) {
      const surf = base + Math.round(Math.sin(x * 0.25) * 3 + Math.sin(x * 0.07) * 5);
      for (let y = 0; y < H; y++) {
        if (y === surf) world[y][x] = 1;          // grass
        else if (y > surf && y < surf + 4) world[y][x] = 2; // dirt
        else if (y >= surf + 4) world[y][x] = 3;  // stone
      }
      // occasional tree
      if (x % 11 === 5) {
        const ty = surf - 1;
        for (let t = 0; t < 4; t++) world[ty - t][x] = 4; // trunk
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 0; dy++) {
          const lx = x + dx, ly = ty - 4 + dy;
          if (lx >= 0 && lx < W && ly >= 0 && world[ly][lx] === 0) world[ly][lx] = 5;
        }
      }
    }
    return world;
  }
})();
