/* DOOM — a raycasting first-person shooter in the spirit of id Software's 1993 classic.
   Textured walls, floors and ceilings with Doom-style light diminishing, sliding doors,
   zombiemen / imps / demons with sight, pain and death states, imp fireballs, exploding
   barrels, fist / pistol / shotgun, the status bar with the marine's face, an automap,
   secrets, two original maps with intermission stats, and synthesized sound effects.
   Every texture, sprite and sound is generated procedurally — no external assets. */
(function () {
  "use strict";

  const W = 320, H = 200, VH = 168, HALF = VH / 2, TEX = 64, TM = TEX - 1;
  const DW = 640, DH = 480; // display canvas — 320x200 stretched to 4:3 like the original

  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

  // =========================================================================
  //  MAPS — original layouts. Legend:
  //  1 brick  2 tech  3 stone  4 marble  D door  X exit switch
  //  S start  z zombieman  i imp  p demon  h medikit  t stimpack  a clip
  //  e shell box  G shotgun  r armor  b barrel  l lamp  * secret spot
  // =========================================================================
  const MAPS = [
    {
      name: "MAP01: OUTPOST KILO",
      grid: [
        "22222222222222222222222222222222",
        "2S....2.........2........2.....2",
        "2.....2...z.....2...h....2..i..2",
        "2.....D.........D........D.....2",
        "2..b..2....a....2..z.....2..r..2",
        "2..a..2.........2........2.....2",
        "222D222222D222222222D22222222D22",
        "1....l.........................1",
        "1..z......b.........i.......z..1",
        "1.......11111.....11111........1",
        "1.......1...1.....1...1........1",
        "1..h....1.G.D.....D.e.1....a...1",
        "1.......1...1.....1...1........1",
        "1.......11111.....11111........1",
        "1...................z.....b....1",
        "1....l.................l.......1",
        "1111111111111D11111111111111D111",
        "3...........3.......3..........3",
        "3..z..a.....3...t...3....i.....3",
        "3...........D.......D..........3",
        "3..i........3...p...3....h..z..3",
        "3.*.........3.......3..........X",
        "3...........3.......3..........3",
        "33333333333333333333333333333333",
      ],
    },
    {
      name: "MAP02: COOLANT WORKS",
      grid: [
        "33333333333333333333333333333333",
        "3S......3...............3......3",
        "3.......3..i....z....i..3..h...3",
        "3..a....D...............D......3",
        "3.......3...44.....44...3..z...3",
        "3333D3333...44..b..44...3333D333",
        "4.......3...............3......4",
        "4..z....3..i....p....i..3..e...4",
        "4.......3333333D33333333....r..4",
        "4..h......................z....4",
        "4.....b.......44444444.........4",
        "4.............4..i...4.....i...4",
        "4..i....p.....4..t...D.........4",
        "4.............4......4....h....4",
        "4.............44444444.........4",
        "4..z...................b.......4",
        "44444D444444444444444444444D4444",
        "3.........3...........3........3",
        "3..i...z..3...p...z...3..z.....3",
        "3.........D...........D........3",
        "3...h.....3....*......3...i....3",
        "3..a......3...........3........X",
        "3.........3...........3........3",
        "33333333333333333333333333333333",
      ],
    },
  ];

  // =========================================================================
  //  ASSETS — procedural textures and sprites, built once
  // =========================================================================
  let ASSETS = null;

  function makeTex(fn) {
    const t = new Uint8Array(TEX * TEX * 3);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
      const c = fn(x, y), i = (y * TEX + x) * 3;
      t[i] = clamp(c[0] | 0, 0, 255); t[i + 1] = clamp(c[1] | 0, 0, 255); t[i + 2] = clamp(c[2] | 0, 0, 255);
    }
    return t;
  }
  function texFromCanvas(base, draw) {
    const c = document.createElement("canvas"); c.width = c.height = TEX;
    const g = c.getContext("2d");
    if (base) {
      const id = g.createImageData(TEX, TEX);
      for (let i = 0, j = 0; j < base.length; i += 4, j += 3) { id.data[i] = base[j]; id.data[i + 1] = base[j + 1]; id.data[i + 2] = base[j + 2]; id.data[i + 3] = 255; }
      g.putImageData(id, 0, 0);
    }
    draw(g);
    const d = g.getImageData(0, 0, TEX, TEX).data, t = new Uint8Array(TEX * TEX * 3);
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { t[j] = d[i]; t[j + 1] = d[i + 1]; t[j + 2] = d[i + 2]; }
    return t;
  }
  function spr(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); draw(g, w, h);
    return { w, h, d: g.getImageData(0, 0, w, h).data };
  }
  function ell(g, cx, cy, rx, ry) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
  function star(g, cx, cy, r1, r2, n) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r2 : r1; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.closePath(); g.fill();
  }
  function glow(g, cx, cy, r, inner, outer) {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, inner); gr.addColorStop(0.45, outer); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  }

  // ---- monsters (front view, as in the classic's facing frame) ----
  function zombieFrame(pose) {
    return spr(48, 64, (g) => {
      const skin = "#c8936a", shirt = pose === "pain" ? "#9c4a3a" : "#5f6b3a", pants = "#3d4527", dark = "#262626";
      if (pose.startsWith("dead")) {
        const k = +pose.slice(4);
        g.fillStyle = "#7a0c0c"; ell(g, 24, 59, 8 + k * 6, 2 + k * 1.5);
        if (k === 1) { g.fillStyle = shirt; g.fillRect(13, 34, 22, 18); g.fillStyle = skin; g.fillRect(18, 22, 12, 12); g.fillStyle = pants; g.fillRect(15, 50, 18, 10); }
        else if (k === 2) { g.fillStyle = shirt; g.fillRect(10, 47, 28, 9); g.fillStyle = skin; g.fillRect(34, 46, 9, 8); g.fillStyle = pants; g.fillRect(4, 50, 8, 7); }
        else { g.fillStyle = "#4f5a30"; g.fillRect(8, 53, 32, 6); g.fillStyle = "#a8775a"; g.fillRect(36, 52, 8, 6); g.fillStyle = "#5a0808"; ell(g, 24, 57, 12, 2); }
        return;
      }
      const step = pose === "walk2" ? 3 : pose === "walk1" ? -3 : 0;
      g.fillStyle = pants; g.fillRect(16 + step, 44, 7, 18); g.fillRect(25 - step, 44, 7, 18);
      g.fillStyle = "#151515"; g.fillRect(15 + step, 59, 9, 5); g.fillRect(24 - step, 59, 9, 5);
      g.fillStyle = shirt; g.fillRect(13, 22, 22, 23);
      g.fillStyle = "#454f2b"; g.fillRect(13, 40, 22, 4);
      g.fillStyle = "#8a7030"; g.fillRect(22, 40, 4, 4);
      g.fillStyle = shirt; g.fillRect(8, 24, 6, 16); g.fillRect(34, 24, 6, 16);
      g.fillStyle = skin; g.fillRect(9, 38, 6, 5); g.fillRect(33, 38, 6, 5);
      g.fillStyle = dark; g.fillRect(11, 33, 26, 5); g.fillRect(22, 29, 5, 13);
      g.fillStyle = "#4a4a4a"; g.beginPath(); g.arc(24.5, 35.5, 3, 0, 7); g.fill();
      g.fillStyle = skin; g.fillRect(18, 8, 12, 14);
      g.fillStyle = "#3a2716"; g.fillRect(18, 6, 12, 4);
      g.fillStyle = "#8a1010"; g.fillRect(20, 13, 3, 2); g.fillRect(25, 13, 3, 2);
      g.fillStyle = "#5a2a20"; g.fillRect(21, 18, 6, 2);
      g.fillStyle = "#9c6a4a"; g.fillRect(17, 11, 1, 7); g.fillRect(30, 11, 1, 7);
      if (pose === "attack") { g.fillStyle = "#ffd84a"; star(g, 24.5, 35.5, 10, 4, 6); g.fillStyle = "#fffbe0"; star(g, 24.5, 35.5, 5, 2.5, 6); }
    });
  }
  function impFrame(pose) {
    return spr(56, 64, (g) => {
      const body = pose === "pain" ? "#c88a62" : "#8a5634", dark = "#5a3520", spike = "#ece4cc";
      if (pose.startsWith("dead")) {
        const k = +pose.slice(4);
        g.fillStyle = "#6e0a0a"; ell(g, 28, 59, 9 + k * 6, 2 + k * 1.5);
        if (k === 1) { g.fillStyle = body; g.fillRect(16, 30, 24, 22); g.fillStyle = spike; g.fillRect(14, 30, 4, 4); g.fillRect(38, 30, 4, 4); }
        else if (k === 2) { g.fillStyle = body; g.fillRect(10, 46, 34, 10); g.fillStyle = dark; g.fillRect(40, 44, 10, 9); }
        else { g.fillStyle = dark; g.fillRect(6, 53, 44, 6); g.fillStyle = spike; g.fillRect(12, 52, 3, 3); g.fillRect(30, 52, 3, 3); }
        return;
      }
      const step = pose === "walk2" ? 3 : pose === "walk1" ? -3 : 0;
      g.fillStyle = dark; g.fillRect(18 + step, 44, 8, 18); g.fillRect(30 - step, 44, 8, 18);
      g.fillStyle = spike; g.fillRect(17 + step, 61, 3, 3); g.fillRect(24 + step, 61, 3, 3); g.fillRect(29 - step, 61, 3, 3); g.fillRect(36 - step, 61, 3, 3);
      g.fillStyle = body; g.beginPath(); g.moveTo(13, 21); g.lineTo(43, 21); g.lineTo(38, 46); g.lineTo(18, 46); g.closePath(); g.fill();
      g.fillStyle = dark; for (let r = 0; r < 4; r++) g.fillRect(20, 26 + r * 5, 16, 2);
      g.fillStyle = spike;
      g.beginPath(); g.moveTo(13, 22); g.lineTo(6, 15); g.lineTo(16, 18); g.fill();
      g.beginPath(); g.moveTo(43, 22); g.lineTo(50, 15); g.lineTo(40, 18); g.fill();
      if (pose === "attack") {
        g.fillStyle = body; g.fillRect(9, 3, 7, 21); g.fillRect(40, 3, 7, 21);
        glow(g, 28, 6, 11, "#fff6b0", "#ff7a14");
      } else {
        g.fillStyle = body; g.fillRect(7, 23, 7, 21); g.fillRect(42, 23, 7, 21);
        g.fillStyle = spike; g.fillRect(7, 43, 2, 4); g.fillRect(11, 43, 2, 4); g.fillRect(43, 43, 2, 4); g.fillRect(47, 43, 2, 4);
      }
      g.fillStyle = body; g.fillRect(21, 7, 14, 15);
      g.fillStyle = spike; g.beginPath(); g.moveTo(21, 9); g.lineTo(18, 2); g.lineTo(25, 7); g.fill(); g.beginPath(); g.moveTo(35, 9); g.lineTo(38, 2); g.lineTo(31, 7); g.fill();
      g.fillStyle = "#ff3a10"; g.fillRect(23, 12, 3, 3); g.fillRect(30, 12, 3, 3);
      g.fillStyle = "#1c0603"; g.fillRect(24, 18, 8, 3);
      g.fillStyle = spike; g.fillRect(25, 18, 1, 2); g.fillRect(27, 18, 1, 2); g.fillRect(29, 18, 1, 2);
    });
  }
  function demonFrame(pose) {
    return spr(64, 56, (g) => {
      const pink = pose === "pain" ? "#f0a0ad" : "#d9788a", dark = "#9a4050";
      if (pose.startsWith("dead")) {
        const k = +pose.slice(4);
        g.fillStyle = "#6e0a0a"; ell(g, 32, 51, 10 + k * 7, 3 + k * 1.5);
        g.fillStyle = k < 3 ? pink : dark; ell(g, 32, 48 - (3 - k) * 4, 22 - k * 2, 8 - k);
        if (k === 3) { g.fillStyle = "#eee"; g.fillRect(24, 46, 2, 3); g.fillRect(30, 46, 2, 3); g.fillRect(36, 46, 2, 3); }
        return;
      }
      const step = pose === "walk2" ? 3 : pose === "walk1" ? -3 : 0;
      g.fillStyle = dark; g.fillRect(14 + step, 38, 10, 17); g.fillRect(40 - step, 38, 10, 17);
      g.fillStyle = "#3a1a1e"; g.fillRect(12 + step, 52, 14, 4); g.fillRect(38 - step, 52, 14, 4);
      g.fillStyle = pink; ell(g, 32, 28, 26, 17);
      g.fillStyle = dark; g.fillRect(8, 26, 8, 12); g.fillRect(48, 26, 8, 12);
      g.fillStyle = pink; ell(g, 32, 17, 15, 12);
      g.fillStyle = "#ffd23a"; g.fillRect(24, 9, 4, 3); g.fillRect(36, 9, 4, 3);
      const open = pose === "attack" ? 9 : 3;
      g.fillStyle = "#3a0508"; g.fillRect(19, 18, 26, 4 + open);
      g.fillStyle = "#f4f0e0";
      for (let t = 0; t < 6; t++) { g.fillRect(20 + t * 4, 18, 2, 3); g.fillRect(20 + t * 4, 19 + open, 2, 3); }
    });
  }

  function buildAssets() {
    const T = {};
    T["1"] = makeTex((x, y) => {
      const row = (y / 8) | 0, off = (row & 1) * 8, bx = (x + off) % 16;
      const n = hash(((x + off) / 16) | 0, row, 1) * 30 + hash(x, y, 2) * 22;
      if (y % 8 === 0 || bx === 0) return [58 + n * 0.3, 44 + n * 0.2, 34];
      const edge = (y % 8 === 1 || bx === 1) ? 14 : 0;
      return [118 + n + edge, 76 + n * 0.6 + edge, 48 + n * 0.3];
    });
    T["2"] = makeTex((x, y) => {
      const px = x % 32, py = y % 32, n = hash(x, y, 3) * 18;
      if (px === 0 || py === 0 || px === 31 || py === 31) return [56, 58, 62];
      const bevel = (px === 1 || py === 1) ? 30 : (px === 30 || py === 30) ? -25 : 0;
      if (py >= 6 && py <= 8 && px >= 6 && px <= 9) return hash((x / 32) | 0, (y / 32) | 0, 9) > 0.5 ? [40, 230, 70] : [235, 50, 34];
      if (py >= 17 && py <= 26 && px >= 8 && px <= 24 && py % 3 === 0) return [44, 46, 50];
      return [110 + n + bevel, 112 + n + bevel, 120 + n + bevel];
    });
    T["3"] = makeTex((x, y) => {
      const n = hash(x >> 2, y >> 2, 4) * 26 + hash(x, y, 5) * 20;
      const crack = (hash(x >> 3, y >> 3, 6) > 0.86 && (x + y) % 7 === 0) ? -30 : 0;
      const blk = (y % 32 === 0 || (x + ((y >> 5) & 1) * 16) % 32 === 0) ? -28 : 0;
      return [84 + n + crack + blk, 88 + n + crack + blk, 76 + n + crack + blk];
    });
    T["4"] = makeTex((x, y) => {
      const v = Math.sin((x + y * 0.6) * 0.25 + Math.sin(y * 0.15) * 3) * 0.5 + 0.5;
      const n = hash(x, y, 7) * 16, vein = v > 0.92 ? 50 : 0;
      const face = (x >= 22 && x <= 42 && y >= 18 && y <= 44);
      if (face) { // carved demon face, the marble walls' signature
        const fx = x - 32, fy = y - 31;
        if ((Math.abs(fx + 5) < 3 && Math.abs(fy + 4) < 2) || (Math.abs(fx - 5) < 3 && Math.abs(fy + 4) < 2)) return [180, 20, 10];
        if (fy > 5 && fy < 9 && Math.abs(fx) < 7) return [20, 30, 18];
        return [26 + n, 58 + n + v * 20, 28 + n];
      }
      return [32 + n + vein * 0.4, 72 + v * 30 + n + vein, 36 + n + vein * 0.4];
    });
    T.D = makeTex((x, y) => {
      const n = hash(x, y, 8) * 14;
      if (y < 7 || y > 56) return (((x + y) >> 3) & 1) ? [212, 182, 32] : [30, 28, 24];
      if (x < 3 || x > 60) return [70, 66, 58];
      const rib = x % 16 < 2 ? -32 : (x % 16 === 2 ? 26 : 0);
      return [126 + n + rib, 118 + n + rib, 98 + n + rib];
    });
    const sign = (lit) => (g) => {
      g.fillStyle = "#151515"; g.fillRect(12, 12, 40, 24);
      g.fillStyle = lit ? "#052a08" : "#3a0606"; g.fillRect(14, 14, 36, 20);
      g.fillStyle = lit ? "#4cff6a" : "#ff3a22"; g.font = "bold 13px monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("EXIT", 32, 25);
      g.fillStyle = "#4a4a4a"; g.fillRect(26, 40, 12, 18);
      g.fillStyle = lit ? "#3c3" : "#c33"; g.fillRect(29, lit ? 42 : 48, 6, 8);
    };
    T.X = texFromCanvas(T["2"], sign(false));
    T.Y = texFromCanvas(T["2"], sign(true));
    T.F = makeTex((x, y) => {
      const n = hash(x >> 1, y >> 1, 10) * 22, gl = (x % 32 === 0 || y % 32 === 0) ? -26 : 0;
      const rivet = (x % 32 === 3 || x % 32 === 28) && (y % 32 === 3 || y % 32 === 28) ? 30 : 0;
      return [80 + n + gl + rivet, 74 + n + gl + rivet, 62 + n + gl + rivet];
    });
    T.C = makeTex((x, y) => {
      const n = hash(x, y, 11) * 10;
      if (x % 32 >= 11 && x % 32 < 21 && y % 32 >= 11 && y % 32 < 21) return [240, 236, 206];
      const gl = (x % 16 === 0 || y % 16 === 0) ? -20 : 0;
      return [64 + n + gl, 64 + n + gl, 70 + n + gl];
    });

    const S = {};
    S.zombie = { walk1: zombieFrame("walk1"), walk2: zombieFrame("walk2"), attack: zombieFrame("attack"), pain: zombieFrame("pain"), dead: [zombieFrame("dead1"), zombieFrame("dead2"), zombieFrame("dead3")] };
    S.imp = { walk1: impFrame("walk1"), walk2: impFrame("walk2"), attack: impFrame("attack"), pain: impFrame("pain"), dead: [impFrame("dead1"), impFrame("dead2"), impFrame("dead3")] };
    S.demon = { walk1: demonFrame("walk1"), walk2: demonFrame("walk2"), attack: demonFrame("attack"), pain: demonFrame("pain"), dead: [demonFrame("dead1"), demonFrame("dead2"), demonFrame("dead3")] };
    S.medikit = spr(26, 18, (g) => { g.fillStyle = "#e8e8e8"; g.fillRect(1, 2, 24, 15); g.fillStyle = "#9a9a9a"; g.fillRect(1, 15, 24, 2); g.fillStyle = "#d81818"; g.fillRect(10, 4, 6, 11); g.fillRect(6, 7, 14, 5); });
    S.stim = spr(14, 14, (g) => { g.fillStyle = "#e0e0e0"; g.fillRect(1, 3, 12, 10); g.fillStyle = "#d81818"; g.fillRect(6, 4, 3, 8); g.fillRect(3, 7, 9, 3); });
    S.clip = spr(12, 9, (g) => { g.fillStyle = "#6a5a20"; g.fillRect(1, 2, 10, 7); g.fillStyle = "#d4b030"; g.fillRect(2, 0, 2, 3); g.fillRect(5, 0, 2, 3); g.fillRect(8, 0, 2, 3); });
    S.shells = spr(20, 12, (g) => { g.fillStyle = "#5a3a20"; g.fillRect(0, 4, 20, 8); for (let i = 0; i < 5; i++) { g.fillStyle = "#c82020"; g.fillRect(1 + i * 4, 0, 3, 6); g.fillStyle = "#d4b030"; g.fillRect(1 + i * 4, 5, 3, 2); } });
    S.shotgun = spr(44, 12, (g) => { g.fillStyle = "#3a3a3a"; g.fillRect(2, 3, 34, 3); g.fillStyle = "#5a5a5a"; g.fillRect(2, 3, 34, 1); g.fillStyle = "#6a4020"; g.fillRect(16, 6, 10, 3); g.fillRect(30, 5, 13, 6); });
    S.armor = spr(30, 24, (g) => { g.fillStyle = "#2f7a2f"; g.beginPath(); g.moveTo(4, 2); g.lineTo(11, 2); g.lineTo(15, 7); g.lineTo(19, 2); g.lineTo(26, 2); g.lineTo(28, 22); g.lineTo(2, 22); g.closePath(); g.fill(); g.fillStyle = "#4fae4f"; g.fillRect(6, 9, 18, 3); g.fillRect(6, 15, 18, 3); });
    S.barrel = spr(24, 34, (g) => { g.fillStyle = "#3e5a3a"; g.fillRect(2, 4, 20, 30); g.fillStyle = "#5a7a52"; g.fillRect(4, 4, 4, 30); g.fillStyle = "#283a26"; g.fillRect(2, 12, 20, 2); g.fillRect(2, 24, 20, 2); g.fillStyle = "#7cff3a"; ell(g, 12, 4, 10, 3); g.fillStyle = "#c8ff8a"; ell(g, 12, 4, 5, 1.4); });
    S.lamp = spr(16, 60, (g) => { g.fillStyle = "#3a3a3a"; g.fillRect(6, 14, 4, 44); g.fillRect(3, 56, 10, 4); glow(g, 8, 8, 8, "#ffffff", "#ffe6a0"); });
    S.fire = [spr(20, 20, (g) => glow(g, 10, 10, 10, "#fffbd0", "#ff8a14")), spr(20, 20, (g) => glow(g, 10, 10, 9, "#ffe880", "#ff5a0a"))];
    S.boom = [spr(32, 32, (g) => glow(g, 16, 16, 9, "#fff6c0", "#ff8a14")), spr(32, 32, (g) => glow(g, 16, 16, 14, "#ffd060", "#e04008")), spr(32, 32, (g) => glow(g, 16, 16, 16, "#a06030", "rgba(60,40,30,0.7)"))];
    S.puff = [spr(10, 10, (g) => { g.fillStyle = "#ffe080"; star(g, 5, 5, 4, 1.5, 4); }), spr(10, 10, (g) => { g.fillStyle = "rgba(170,170,170,0.9)"; ell(g, 5, 5, 3.5, 3.5); })];
    S.blood = [spr(10, 10, (g) => { g.fillStyle = "#c00000"; ell(g, 5, 5, 3, 3); g.fillRect(1, 3, 2, 2); g.fillRect(7, 6, 2, 2); }), spr(10, 10, (g) => { g.fillStyle = "#880000"; ell(g, 5, 7, 4, 2); })];

    // status bar background
    const sb = document.createElement("canvas"); sb.width = W; sb.height = 32;
    const sg = sb.getContext("2d");
    for (let y = 0; y < 32; y++) for (let x = 0; x < W; x++) { const n = 78 + hash(x, y, 21) * 30; sg.fillStyle = `rgb(${n | 0},${n | 0},${(n + 4) | 0})`; sg.fillRect(x, y, 1, 1); }
    [[0, 48], [48, 104], [104, 142], [142, 178], [178, 234], [234, 320]].forEach(([a, b]) => {
      sg.fillStyle = "#3a3a3a"; sg.fillRect(a + 1, 1, b - a - 2, 1); sg.fillRect(a + 1, 1, 1, 30);
      sg.fillStyle = "#a8a8a8"; sg.fillRect(a + 1, 30, b - a - 2, 1); sg.fillRect(b - 2, 1, 1, 30);
    });
    sg.font = "bold 7px monospace"; sg.fillStyle = "#e8e8e8"; sg.textAlign = "center";
    sg.fillText("AMMO", 24, 29); sg.fillText("HEALTH", 76, 29); sg.fillText("ARMS", 123, 29); sg.fillText("ARMOR", 206, 29);
    return { tex: T, spr: S, statusBg: sb };
  }

  // =========================================================================
  //  AUDIO — tiny WebAudio synth for the classic sound set
  // =========================================================================
  function makeAudio() {
    let ac = null, master = null, noise = null, muted = false;
    function ctx() {
      if (!ac) {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain(); master.gain.value = 0.32; master.connect(ac.destination);
          noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
          const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { ac = null; }
      }
      if (ac && ac.state === "suspended") ac.resume();
      return ac;
    }
    function nz(dur, freq, q, vol, type) {
      const a = ctx(); if (!a || muted) return;
      const s = a.createBufferSource(); s.buffer = noise;
      const f = a.createBiquadFilter(); f.type = type || "bandpass"; f.frequency.value = freq; f.Q.value = q;
      const gn = a.createGain(), t = a.currentTime;
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f); f.connect(gn); gn.connect(master); s.start(t); s.stop(t + dur);
    }
    function tn(type, f0, f1, dur, vol, delay) {
      const a = ctx(); if (!a || muted) return;
      const o = a.createOscillator(), gn = a.createGain(), t = a.currentTime + (delay || 0);
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur);
    }
    return {
      unlock: ctx,
      toggle() { muted = !muted; return muted; },
      close() { try { if (ac) ac.close(); } catch (e) {} ac = null; },
      pistol() { nz(0.16, 1900, 0.7, 0.9); tn("square", 240, 60, 0.09, 0.22); },
      shotgun() { nz(0.42, 850, 0.45, 1.3); tn("sawtooth", 130, 35, 0.28, 0.42); },
      pump() { nz(0.06, 2600, 3, 0.25, "highpass"); nz(0.06, 2000, 3, 0.25, "highpass"); },
      punch() { nz(0.08, 500, 1, 0.7, "lowpass"); },
      hurt() { tn("sawtooth", 320, 110, 0.22, 0.38); nz(0.12, 700, 1, 0.3); },
      die() { tn("sawtooth", 260, 40, 0.9, 0.45); },
      pickup() { tn("square", 700, 1050, 0.07, 0.18); },
      weapon() { tn("square", 520, 520, 0.08, 0.2); tn("square", 780, 780, 0.08, 0.2, 0.09); tn("square", 1040, 1040, 0.12, 0.2, 0.18); },
      door() { nz(0.65, 160, 0.6, 0.6, "lowpass"); tn("sawtooth", 70, 55, 0.6, 0.12); },
      sight(kind) { tn("sawtooth", kind === "demon" ? 90 : kind === "imp" ? 160 : 210, kind === "demon" ? 60 : 110, 0.5, 0.3); nz(0.4, 400, 0.8, 0.22); },
      pain() { tn("sawtooth", 220, 160, 0.18, 0.25); },
      mdie(kind) { tn("sawtooth", kind === "demon" ? 140 : 300, 40, 0.7, 0.35); nz(0.3, 500, 0.7, 0.3); },
      fireball() { nz(0.35, 1300, 0.6, 0.5); tn("sine", 500, 180, 0.3, 0.2); },
      bite() { nz(0.1, 900, 1.5, 0.6); tn("square", 180, 120, 0.1, 0.25); },
      explode() { nz(0.9, 320, 0.4, 1.4, "lowpass"); tn("sawtooth", 90, 30, 0.7, 0.4); },
      swtch() { tn("square", 300, 300, 0.05, 0.25); tn("square", 450, 450, 0.08, 0.25, 0.06); },
      secret() { tn("triangle", 660, 660, 0.12, 0.25); tn("triangle", 880, 880, 0.2, 0.25, 0.12); },
    };
  }

  // =========================================================================
  //  GAME INSTANCE
  // =========================================================================
  function start(body) {
    if (!ASSETS) ASSETS = buildAssets();
    const A = ASSETS, TX = A.tex, SP = A.spr;
    const coarse = (window.matchMedia && matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window);

    body.innerHTML = `<div class="doom" style="position:relative;width:100%;height:100%;background:#000;overflow:hidden;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;touch-action:none">
      <canvas class="doom-cv" width="${DW}" height="${DH}" tabindex="0" style="image-rendering:pixelated;image-rendering:crisp-edges;outline:none;touch-action:none;cursor:crosshair"></canvas>
      <div class="doom-touch" style="position:absolute;inset:0;pointer-events:none;display:${coarse ? "block" : "none"}">
        <div class="dt-stick" style="position:absolute;left:4%;bottom:6%;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.22);pointer-events:auto;touch-action:none"><div class="dt-nub" style="position:absolute;left:40px;top:40px;width:40px;height:40px;border-radius:50%;background:rgba(255,80,40,.55)"></div></div>
        <div style="position:absolute;right:3%;bottom:6%;display:grid;grid-template-columns:repeat(2,64px);gap:10px;pointer-events:auto">
          <button class="dt-b" data-k="use" style="grid-column:1">USE</button>
          <button class="dt-b" data-k="fire" style="grid-row:1/3;grid-column:2;height:138px;background:rgba(200,30,20,.55)">FIRE</button>
          <button class="dt-b" data-k="wpn" style="grid-column:1">WPN</button>
        </div>
        <button class="dt-b" data-k="map" style="position:absolute;right:3%;top:4%;pointer-events:auto;width:56px;height:40px">MAP</button>
      </div>
    </div>`;
    const host = body.querySelector(".doom"), cv = host.querySelector(".doom-cv"), dctx = cv.getContext("2d");
    host.querySelectorAll(".dt-b").forEach((b) => { b.style.cssText += ";width:64px;height:64px;border-radius:14px;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff;font:800 13px system-ui,sans-serif;touch-action:none"; });
    host.querySelector('[data-k="fire"]').style.height = "138px";
    host.querySelector('[data-k="map"]').style.height = "40px";

    const lo = document.createElement("canvas"); lo.width = W; lo.height = H;
    const g = lo.getContext("2d");
    const img = g.createImageData(W, VH), buf = new Uint32Array(img.data.buffer), zbuf = new Float32Array(W);
    const sfx = makeAudio();

    function fit() {
      const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
      const s = Math.min(r.width / 4, r.height / 3);
      cv.style.width = Math.floor(s * 4) + "px"; cv.style.height = Math.floor(s * 3) + "px";
    }
    fit();
    let ro = null; try { ro = new ResizeObserver(fit); ro.observe(host); } catch (e) {}

    // ---- persistent player inventory (carries across maps, like the original) ----
    const P = { health: 100, armor: 0, bullets: 50, shells: 0, owned: [true, true, false], weapon: 1 };
    let saved = null;
    // ---- per-level state ----
    let level = 0, mapW = 0, mapH = 0, grid = [], doors = {}, seen = null;
    let px = 1.5, py = 1.5, dirX = 1, dirY = 0, planeX = 0, planeY = 0.66;
    let enemies = [], items = [], decor = [], projectiles = [], effects = [], secrets = [];
    let stats = null;
    let state = "title", stateT = 0, msg = "", msgT = 0, flash = 0, flashCol = "255,0,0", muzzle = 0;
    let wcd = 0, wAnim = 0, wSwitch = 0, pendingWeapon = -1, bob = 0, bobAmt = 0, firing = false;
    let face = { look: 0, lookT: 0, mode: "", modeT: 0 };
    let automap = false, paused = false, exitT = -1, titleA = 0;

    function startGame() { Object.assign(P, { health: 100, armor: 0, bullets: 50, shells: 0, owned: [true, true, false], weapon: 1 }); loadLevel(0); }
    function loadLevel(n) {
      level = n; const M = MAPS[n];
      mapH = M.grid.length; mapW = Math.max.apply(null, M.grid.map((r) => r.length));
      grid = []; doors = {}; enemies = []; items = []; decor = []; projectiles = []; effects = []; secrets = [];
      seen = new Uint8Array(mapW * mapH);
      stats = { kills: 0, totalKills: 0, items: 0, totalItems: 0, secrets: 0, totalSecrets: 0, time: 0 };
      for (let y = 0; y < mapH; y++) {
        const row = [];
        for (let x = 0; x < mapW; x++) {
          let ch = M.grid[y][x] || "3";
          if ((y === 0 || x === 0 || y === mapH - 1 || x === mapW - 1) && "1234X".indexOf(ch) < 0) ch = "3";
          let cell = 0; const cx = x + 0.5, cy = y + 0.5;
          if ("1234DX".indexOf(ch) >= 0) cell = ch;
          else if (ch === "S") { px = cx; py = cy; }
          else if (ch === "z" || ch === "i" || ch === "p") spawn(ch === "z" ? "zombie" : ch === "i" ? "imp" : "demon", cx, cy);
          else if (ch === "b") decor.push({ kind: "barrel", x: cx, y: cy, hp: 20, solid: true, dead: false });
          else if (ch === "l") decor.push({ kind: "lamp", x: cx, y: cy, solid: true });
          else if (ch === "*") { secrets.push({ x, y, found: false }); stats.totalSecrets++; }
          else if ("htaeGr".indexOf(ch) >= 0) { items.push({ kind: ch, x: cx, y: cy }); stats.totalItems++; }
          if (ch === "D") doors[y * mapW + x] = { open: 0, target: 0, timer: 0 };
          row.push(cell);
        }
        grid.push(row);
      }
      // face the first open direction from the start
      const opts = [[1, 0], [0, 1], [-1, 0], [0, -1]];
      for (const [dx, dy] of opts) { if (!grid[(py + dy) | 0][(px + dx) | 0]) { dirX = dx; dirY = dy; break; } }
      planeX = -dirY * 0.66; planeY = dirX * 0.66;
      saved = JSON.parse(JSON.stringify(P));
      state = "play"; stateT = 0; exitT = -1; automap = false; paused = false; flash = 0;
      message(M.name.split(": ")[1] ? "Entering " + M.name : M.name);
    }
    const ETYPE = {
      zombie: { hp: 20, speed: 1.5, pain: 0.78, range: 13, hs: 0.9, w: 0.55 },
      imp: { hp: 60, speed: 1.75, pain: 0.78, range: 15, hs: 0.95, w: 0.6 },
      demon: { hp: 150, speed: 3.0, pain: 0.7, range: 1.15, hs: 0.78, w: 0.75 },
    };
    function spawn(type, x, y) {
      const T = ETYPE[type];
      enemies.push({ type, x, y, hp: T.hp, state: "idle", t: 0, cd: rand(0.5, 1.5), anim: 0, awake: false, fired: false, strafe: 0, strafeT: 0, deadT: 0 });
      stats.totalKills++;
    }
    function message(m) { msg = m; msgT = 3.2; }
    const cellAt = (x, y) => (x < 0 || y < 0 || x >= mapW || y >= mapH) ? "3" : grid[y][x];
    function blocked(x, y) {
      const cx = x | 0, cy = y | 0, c = cellAt(cx, cy);
      if (!c) return false;
      if (c === "D") return doors[cy * mapW + cx].open < 0.9;
      return true;
    }
    function solidSprite(x, y, r, self) {
      for (const d of decor) if (d.solid && !d.dead && Math.abs(d.x - x) < r && Math.abs(d.y - y) < r) return true;
      for (const e of enemies) if (e !== self && e.state !== "dead" && Math.abs(e.x - x) < r && Math.abs(e.y - y) < r) return true;
      return false;
    }
    function canStand(x, y, r, self) {
      return !blocked(x - r, y - r) && !blocked(x + r, y - r) && !blocked(x - r, y + r) && !blocked(x + r, y + r) && !solidSprite(x, y, r + 0.12, self);
    }
    function los(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 0.15);
      for (let k = 1; k < n; k++) {
        const x = (x0 + dx * k / n) | 0, y = (y0 + dy * k / n) | 0, c = cellAt(x, y);
        if (c) { if (c === "D") { if (doors[y * mapW + x].open < 0.6) return false; } else return false; }
      }
      return true;
    }
    function openDoor(cx, cy) {
      const d = doors[cy * mapW + cx]; if (!d) return;
      if (d.target === 0 || d.open < 1) { if (d.target !== 1) sfx.door(); d.target = 1; d.timer = 0; }
    }

    // ---------------- player actions ----------------
    function hurtPlayer(dmg, srcX, srcY) {
      if (state !== "play") return;
      let save = Math.floor(dmg / 3);
      if (P.armor <= 0) save = 0; else if (save > P.armor) save = P.armor;
      P.armor -= save; P.health -= (dmg - save);
      flash = Math.min(0.75, flash + dmg / 40); flashCol = "255,0,0";
      face.mode = "ouch"; face.modeT = 0.6;
      if (srcX != null) { const a = Math.atan2(srcY - py, srcX - px) - Math.atan2(dirY, dirX); const s = Math.sin(a); face.look = s > 0.3 ? 1 : s < -0.3 ? -1 : 0; face.lookT = 1; }
      if (P.health <= 0) { P.health = 0; state = "dead"; stateT = 0; sfx.die(); face.mode = "dead"; if (document.pointerLockElement === cv) document.exitPointerLock(); }
      else sfx.hurt();
    }
    function alertMonsters() {
      for (const e of enemies) if (!e.awake && e.state !== "dead" && Math.hypot(e.x - px, e.y - py) < 16) { e.awake = true; e.state = "chase"; }
    }
    function bestWeapon() { if (P.owned[2] && P.shells > 0) return 2; if (P.bullets > 0) return 1; return 0; }
    function switchWeapon(i) {
      if (i < 0 || i > 2 || !P.owned[i] || i === P.weapon || pendingWeapon >= 0) return;
      if (i === 1 && P.bullets <= 0) return; if (i === 2 && P.shells <= 0) return;
      pendingWeapon = i; wSwitch = 0.4;
    }
    function screenOf(o) {
      const sx = o.x - px, sy = o.y - py, inv = 1 / (planeX * dirY - dirX * planeY);
      const tx = inv * (dirY * sx - dirX * sy), ty = inv * (-planeY * sx + planeX * sy);
      return { tx, ty, col: (W / 2) * (1 + tx / ty) };
    }
    function hitscan(spreadPx) {
      const col = clamp((W / 2 + spreadPx) | 0, 0, W - 1), wallD = zbuf[col];
      let best = null, bd = wallD;
      const consider = (o, halfW) => { const s = screenOf(o); if (s.ty <= 0.2 || s.ty >= bd) return; const pw = (VH / s.ty) * halfW; if (Math.abs(s.col - col) < pw) { best = o; bd = s.ty; } };
      for (const e of enemies) if (e.state !== "dead") consider(e, ETYPE[e.type].w * 0.32);
      for (const d of decor) if (d.kind === "barrel" && !d.dead) consider(d, 0.22);
      if (best) return best;
      const camX = 2 * col / W - 1, rdx = dirX + planeX * camX, rdy = dirY + planeY * camX, d = Math.min(wallD, 30) * 0.96;
      effects.push({ x: px + rdx * d, y: py + rdy * d, frames: SP.puff, t: 0, dur: 0.25, hs: 0.12, z: 0.42, bright: true });
      return null;
    }
    function damage(o, dmg) {
      if (o.kind === "barrel") { o.hp -= dmg; if (o.hp <= 0 && !o.dead) explodeBarrel(o); return; }
      if (o.state === "dead") return;
      o.hp -= dmg; o.awake = true;
      effects.push({ x: o.x + rand(-0.1, 0.1), y: o.y + rand(-0.1, 0.1), frames: SP.blood, t: 0, dur: 0.35, hs: 0.14, z: 0.4 });
      if (o.hp <= 0) { o.state = "dead"; o.deadT = 0; stats.kills++; sfx.mdie(o.type); return; }
      if (Math.random() < ETYPE[o.type].pain) { o.state = "pain"; o.t = 0.22; sfx.pain(); }
      else if (o.state === "idle") o.state = "chase";
    }
    function explodeBarrel(b) {
      b.dead = true; sfx.explode();
      effects.push({ x: b.x, y: b.y, frames: SP.boom, t: 0, dur: 0.55, hs: 0.8, z: 0.05, bright: true });
      const pd = Math.hypot(px - b.x, py - b.y); if (pd < 2.6) hurtPlayer(Math.round((2.6 - pd) * 45), b.x, b.y);
      for (const e of enemies) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < 2.6) damage(e, Math.round((2.6 - d) * 60)); }
      for (const o of decor) if (o !== b && o.kind === "barrel" && !o.dead && Math.hypot(o.x - b.x, o.y - b.y) < 2.2) setTimeout(() => { if (!o.dead) explodeBarrel(o); }, 160);
    }
    function fire() {
      if (state !== "play" || paused || wcd > 0 || pendingWeapon >= 0) return;
      const w = P.weapon;
      if (w === 1 && P.bullets <= 0) { switchWeapon(bestWeapon()); return; }
      if (w === 2 && P.shells <= 0) { switchWeapon(bestWeapon()); return; }
      if (w === 0) {
        wcd = 0.5; wAnim = 0.3; sfx.punch();
        let best = null, bd = 1.4;
        for (const e of enemies) {
          if (e.state === "dead") continue; const s = screenOf(e);
          if (s.ty > 0 && s.ty < bd && Math.abs(s.col - W / 2) < 60) { best = e; bd = s.ty; }
        }
        if (best) damage(best, irand(2, 20));
        return;
      }
      alertMonsters(); muzzle = 0.12; face.mode = "fire"; face.modeT = 0.3;
      if (w === 1) { P.bullets--; wcd = 0.4; wAnim = 0.22; sfx.pistol(); const t = hitscan(rand(-4, 4)); if (t) damage(t, irand(5, 15)); }
      else { P.shells--; wcd = 1.0; wAnim = 0.95; sfx.shotgun(); setTimeout(() => sfx.pump(), 450); for (let i = 0; i < 7; i++) { const t = hitscan(rand(-26, 26)); if (t) damage(t, irand(5, 15)); } }
    }
    function use() {
      if (state !== "play" || paused) return;
      for (const r of [0.8, 1.3]) {
        const cx = (px + dirX * r) | 0, cy = (py + dirY * r) | 0, c = cellAt(cx, cy);
        if (c === "D") { openDoor(cx, cy); return; }
        if (c === "X") { grid[cy][cx] = "Y"; sfx.swtch(); exitT = 0.7; return; }
      }
    }
    function pickup(it) {
      const k = it.kind;
      if (k === "h") { if (P.health >= 100) return false; message(P.health < 25 ? "Picked up a medikit that you REALLY need!" : "Picked up a medikit."); P.health = Math.min(100, P.health + 25); }
      else if (k === "t") { if (P.health >= 100) return false; message("Picked up a stimpack."); P.health = Math.min(100, P.health + 10); }
      else if (k === "a") { if (P.bullets >= 200) return false; message("Picked up a clip."); P.bullets = Math.min(200, P.bullets + 10); }
      else if (k === "e") { if (P.shells >= 50) return false; message("Picked up a box of shotgun shells."); P.shells = Math.min(50, P.shells + 20); }
      else if (k === "r") { if (P.armor >= 100) return false; message("Picked up the armor."); P.armor = 100; }
      else if (k === "G") {
        message("You got the shotgun!"); const had = P.owned[2]; P.owned[2] = true; P.shells = Math.min(50, P.shells + 8);
        sfx.weapon(); face.mode = "grin"; face.modeT = 1.2; flash = 0.35; flashCol = "255,220,90"; stats.items++;
        if (!had) switchWeapon(2); return true;
      }
      sfx.pickup(); flash = Math.max(flash, 0.25); flashCol = "255,220,90"; stats.items++;
      return true;
    }

    // ---------------- update ----------------
    const keys = {};
    let turnAcc = 0, stick = { x: 0, y: 0 }, touchFire = false;
    function update(dt) {
      titleA += dt;
      if (msgT > 0) msgT -= dt;
      flash = Math.max(0, flash - dt * 1.4); muzzle = Math.max(0, muzzle - dt);
      if (state !== "play" || paused) { stateT += dt; return; }
      stats.time += dt; stateT += dt;
      if (exitT >= 0) { exitT -= dt; if (exitT < 0) { state = "inter"; stateT = 0; if (document.pointerLockElement === cv) document.exitPointerLock(); } }

      // turning
      let turn = turnAcc; turnAcc = 0;
      if (keys.ArrowLeft) turn -= 2.6 * dt; if (keys.ArrowRight) turn += 2.6 * dt;
      if (turn) {
        const c = Math.cos(turn), s = Math.sin(turn);
        const ndx = dirX * c - dirY * s, ndy = dirX * s + dirY * c; dirX = ndx; dirY = ndy;
        const npx = planeX * c - planeY * s, npy = planeX * s + planeY * c; planeX = npx; planeY = npy;
      }
      // movement
      const run = keys.ShiftLeft || keys.ShiftRight ? 1.65 : 1;
      let fw = 0, st = 0;
      if (keys.KeyW || keys.ArrowUp) fw += 1; if (keys.KeyS || keys.ArrowDown) fw -= 1;
      if (keys.KeyD) st += 1; if (keys.KeyA) st -= 1;
      fw += -stick.y; st += stick.x;
      const mag = Math.min(1, Math.hypot(fw, st));
      if (mag > 0.05) {
        const sp = 3.4 * run * dt / Math.max(1, Math.hypot(fw, st));
        const mx = (dirX * fw - dirY * st) * sp, my = (dirY * fw + dirX * st) * sp;
        if (canStand(px + mx, py, 0.24)) px += mx;
        if (canStand(px, py + my, 0.24)) py += my;
        bob += dt * 10 * run; bobAmt = Math.min(1, bobAmt + dt * 4);
      } else bobAmt = Math.max(0, bobAmt - dt * 4);
      // auto-open doors you walk into, Doom-style use is still on Space/E
      // pickups
      for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; if (Math.abs(it.x - px) < 0.55 && Math.abs(it.y - py) < 0.55 && pickup(it)) items.splice(i, 1); }
      for (const s of secrets) if (!s.found && (px | 0) === s.x && (py | 0) === s.y) { s.found = true; stats.secrets++; message("A secret is revealed!"); sfx.secret(); }
      // weapon timers
      wcd = Math.max(0, wcd - dt); wAnim = Math.max(0, wAnim - dt);
      if (pendingWeapon >= 0) { wSwitch -= dt; if (wSwitch <= 0.2 && P.weapon !== pendingWeapon) P.weapon = pendingWeapon; if (wSwitch <= 0) { pendingWeapon = -1; wSwitch = 0; } }
      if ((firing || touchFire) && P.weapon !== 0) fire();
      // face
      face.lookT -= dt; if (face.lookT <= 0) { face.look = irand(-1, 1); face.lookT = rand(0.8, 2); }
      face.modeT -= dt; if (face.modeT <= 0 && face.mode !== "dead") face.mode = "";
      // doors
      for (const k in doors) {
        const d = doors[k];
        if (d.open < d.target) d.open = Math.min(1, d.open + dt * 1.7);
        else if (d.open > d.target) d.open = Math.max(0, d.open - dt * 1.7);
        if (d.open >= 1) {
          d.timer += dt;
          const cx = k % mapW, cy = (k / mapW) | 0;
          const occupied = ((px | 0) === cx && (py | 0) === cy) || enemies.some((e) => e.state !== "dead" && (e.x | 0) === cx && (e.y | 0) === cy);
          if (d.timer > 4 && !occupied) { d.target = 0; d.timer = 0; sfx.door(); }
        }
      }
      updateEnemies(dt); updateProjectiles(dt);
      for (let i = effects.length - 1; i >= 0; i--) { effects[i].t += dt; if (effects[i].t >= effects[i].dur) effects.splice(i, 1); }
    }
    function updateEnemies(dt) {
      for (const e of enemies) {
        const T = ETYPE[e.type];
        if (e.state === "dead") { e.deadT += dt; continue; }
        const dx = px - e.x, dy = py - e.y, dist = Math.hypot(dx, dy);
        if (!e.awake) {
          if (dist < 20 && los(e.x, e.y, px, py)) { e.awake = true; e.state = "chase"; if (Math.random() < 0.6) sfx.sight(e.type); }
          continue;
        }
        if (e.state === "pain") { e.t -= dt; if (e.t <= 0) e.state = "chase"; continue; }
        if (e.state === "attack") {
          e.t -= dt;
          if (!e.fired && e.t < 0.22) {
            e.fired = true;
            if (e.type === "zombie") { sfx.pistol(); if (los(e.x, e.y, px, py) && Math.random() < clamp(0.75 - dist * 0.04, 0.2, 0.75)) hurtPlayer(irand(3, 15), e.x, e.y); }
            else if (e.type === "imp") {
              if (dist < 1.3) { sfx.bite(); hurtPlayer(irand(3, 24), e.x, e.y); }
              else { sfx.fireball(); const a = Math.atan2(dy, dx); projectiles.push({ x: e.x + Math.cos(a) * 0.4, y: e.y + Math.sin(a) * 0.4, vx: Math.cos(a) * 5.5, vy: Math.sin(a) * 5.5, t: 0 }); }
            } else if (dist < 1.35) { sfx.bite(); hurtPlayer(irand(4, 40), e.x, e.y); }
          }
          if (e.t <= 0) { e.state = "chase"; e.cd = e.type === "demon" ? rand(0.45, 0.9) : rand(0.9, 2.4); }
          continue;
        }
        // chase
        e.cd -= dt; e.anim += dt;
        const see = dist < 22 && los(e.x, e.y, px, py);
        if (e.cd <= 0 && see && dist < T.range) { e.state = "attack"; e.t = e.type === "demon" ? 0.4 : 0.55; e.fired = false; continue; }
        e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe = e.type === "demon" ? rand(-0.3, 0.3) : rand(-1, 1); e.strafeT = rand(0.8, 2); }
        if (dist > 0.9) {
          const a = Math.atan2(dy, dx) + e.strafe * 0.9, sp = T.speed * dt;
          let nx = e.x + Math.cos(a) * sp, ny = e.y + Math.sin(a) * sp;
          // monsters open doors in their way
          const fx = (e.x + Math.cos(a) * 0.6) | 0, fy = (e.y + Math.sin(a) * 0.6) | 0;
          if (cellAt(fx, fy) === "D") openDoor(fx, fy);
          const okX = canStand(nx, e.y, 0.28, e) && Math.hypot(px - nx, py - e.y) > 0.6, okY = canStand(e.x, ny, 0.28, e) && Math.hypot(px - e.x, py - ny) > 0.6;
          if (okX) e.x = nx; if (okY) e.y = ny;
          if (!okX && !okY) { e.strafe = -e.strafe || 1; e.strafeT = 0.5; }
        }
      }
    }
    function updateProjectiles(dt) {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i]; p.t += dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        let hit = blocked(p.x, p.y) || p.t > 6;
        if (!hit && Math.hypot(p.x - px, p.y - py) < 0.42) { hurtPlayer(irand(3, 24), p.x - p.vx, p.y - p.vy); hit = true; }
        if (!hit) for (const d of decor) if (d.kind === "barrel" && !d.dead && Math.hypot(p.x - d.x, p.y - d.y) < 0.35) { explodeBarrel(d); hit = true; break; }
        if (hit) { effects.push({ x: p.x - p.vx * 0.02, y: p.y - p.vy * 0.02, frames: SP.boom, t: 0, dur: 0.4, hs: 0.45, z: 0.3, bright: true }); projectiles.splice(i, 1); }
      }
    }

    // ---------------- rendering ----------------
    function shadeAt(dist) { return clamp(1.16 - dist * 0.098 + muzzle * 2.2, 0.12, 1.15); }
    function render3D() {
      const rd0x = dirX - planeX, rd0y = dirY - planeY, rd1x = dirX + planeX, rd1y = dirY + planeY;
      const F = TX.F, C = TX.C;
      // floor + ceiling casting
      for (let y = HALF + 1; y < VH; y++) {
        const p = y - HALF, rowD = HALF / p;
        const stepX = rowD * (rd1x - rd0x) / W, stepY = rowD * (rd1y - rd0y) / W;
        let fx = px + rowD * rd0x, fy = py + rowD * rd0y;
        const sh = shadeAt(rowD), shc = sh * 0.9, yc = VH - y - 1;
        let off = y * W, offc = yc * W;
        for (let x = 0; x < W; x++, off++, offc++) {
          const tx = ((fx - Math.floor(fx)) * TEX) & TM, ty = ((fy - Math.floor(fy)) * TEX) & TM, ti = (ty * TEX + tx) * 3;
          fx += stepX; fy += stepY;
          buf[off] = 0xff000000 | (clamp(F[ti + 2] * sh, 0, 255) << 16) | (clamp(F[ti + 1] * sh, 0, 255) << 8) | clamp(F[ti] * sh, 0, 255);
          const lamp = C[ti] > 220, s2 = lamp ? 1 : shc;
          buf[offc] = 0xff000000 | (clamp(C[ti + 2] * s2, 0, 255) << 16) | (clamp(C[ti + 1] * s2, 0, 255) << 8) | clamp(C[ti] * s2, 0, 255);
        }
      }
      // horizon row
      for (let x = 0; x < W; x++) buf[HALF * W + x] = 0xff101010;
      // walls (DDA)
      for (let x = 0; x < W; x++) {
        const camX = 2 * x / W - 1, rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
        let mx = px | 0, my = py | 0;
        const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
        let stepX, stepY, sdx, sdy;
        if (rdx < 0) { stepX = -1; sdx = (px - mx) * ddx; } else { stepX = 1; sdx = (mx + 1 - px) * ddx; }
        if (rdy < 0) { stepY = -1; sdy = (py - my) * ddy; } else { stepY = 1; sdy = (my + 1 - py) * ddy; }
        let side = 0, tile = "3", perp = 30, wallX = 0, doorOff = 0;
        for (let guard = 0; guard < 96; guard++) {
          if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0; } else { sdy += ddy; my += stepY; side = 1; }
          const c = cellAt(mx, my); if (!c) continue;
          perp = side === 0 ? sdx - ddx : sdy - ddy;
          wallX = side === 0 ? py + perp * rdy : px + perp * rdx; wallX -= Math.floor(wallX);
          if (c === "D") { const d = doors[my * mapW + mx]; if (d && wallX < d.open) continue; doorOff = d ? d.open : 0; }
          tile = c; if (mx >= 0 && my >= 0 && mx < mapW && my < mapH) seen[my * mapW + mx] = 1;
          break;
        }
        if (perp < 0.01) perp = 0.01;
        zbuf[x] = perp;
        const T = TX[tile] || TX["3"];
        let tx = ((wallX - doorOff) * TEX) | 0;
        if (tile !== "D" && ((side === 0 && rdx > 0) || (side === 1 && rdy < 0))) tx = TM - tx;
        tx &= TM;
        const lineH = VH / perp, ds = HALF - lineH / 2;
        const y0 = Math.max(0, ds | 0), y1 = Math.min(VH - 1, (ds + lineH) | 0);
        const step = TEX / lineH; let tp = (y0 - ds) * step;
        const sh = shadeAt(perp) * (side ? 0.8 : 1);
        for (let y = y0; y <= y1; y++, tp += step) {
          const ti = (((tp | 0) & TM) * TEX + tx) * 3;
          const lit = tile === "X" || tile === "Y" ? (T[ti] > 200 || T[ti + 1] > 200 ? 1.15 : sh) : sh;
          buf[y * W + x] = 0xff000000 | (clamp(T[ti + 2] * lit, 0, 255) << 16) | (clamp(T[ti + 1] * lit, 0, 255) << 8) | clamp(T[ti] * lit, 0, 255);
        }
      }
      // sprites
      const list = [];
      for (const e of enemies) {
        const S = SP[e.type], T = ETYPE[e.type]; let im;
        if (e.state === "dead") im = S.dead[Math.min(2, (e.deadT / 0.16) | 0)];
        else if (e.state === "attack") im = e.t < 0.32 ? S.attack : S.walk1;
        else if (e.state === "pain") im = S.pain;
        else im = (((e.anim / 0.22) | 0) & 1) ? S.walk2 : S.walk1;
        list.push({ x: e.x, y: e.y, im, hs: e.state === "dead" ? T.hs * 0.95 : T.hs, z: 0, bright: e.state === "attack" && e.type !== "demon" && e.t < 0.32 });
      }
      for (const it of items) {
        const m = { h: [SP.medikit, 0.2], t: [SP.stim, 0.16], a: [SP.clip, 0.12], e: [SP.shells, 0.14], G: [SP.shotgun, 0.13], r: [SP.armor, 0.28] }[it.kind];
        list.push({ x: it.x, y: it.y, im: m[0], hs: m[1], z: 0 });
      }
      for (const d of decor) if (!d.dead) list.push({ x: d.x, y: d.y, im: d.kind === "barrel" ? SP.barrel : SP.lamp, hs: d.kind === "barrel" ? 0.5 : 0.95, z: 0, bright: d.kind === "lamp" });
      for (const p of projectiles) list.push({ x: p.x, y: p.y, im: SP.fire[((p.t * 12) | 0) & 1], hs: 0.28, z: 0.36, bright: true });
      for (const f of effects) list.push({ x: f.x, y: f.y, im: f.frames[Math.min(f.frames.length - 1, ((f.t / f.dur) * f.frames.length) | 0)], hs: f.hs, z: f.z, bright: f.bright });
      const inv = 1 / (planeX * dirY - dirX * planeY);
      for (const s of list) { const sx = s.x - px, sy = s.y - py; s.tx = inv * (dirY * sx - dirX * sy); s.ty = inv * (-planeY * sx + planeX * sy); }
      list.sort((a, b) => b.ty - a.ty);
      for (const s of list) {
        if (s.ty <= 0.15) continue;
        const im = s.im, sh = s.bright ? 1.1 : shadeAt(s.ty);
        const scx = (W / 2) * (1 + s.tx / s.ty);
        const hPx = s.hs * VH / s.ty, wPx = hPx * im.w / im.h;
        const bottom = HALF + (VH / 2) / s.ty - s.z * VH / s.ty, top = bottom - hPx;
        const x0 = Math.max(0, (scx - wPx / 2) | 0), x1 = Math.min(W - 1, (scx + wPx / 2) | 0);
        const yy0 = Math.max(0, top | 0), yy1 = Math.min(VH - 1, bottom | 0);
        const d = im.d;
        for (let x = x0; x <= x1; x++) {
          if (s.ty >= zbuf[x]) continue;
          const tx = clamp(((x - (scx - wPx / 2)) * im.w / wPx) | 0, 0, im.w - 1);
          for (let y = yy0; y <= yy1; y++) {
            const ty = clamp(((y - top) * im.h / hPx) | 0, 0, im.h - 1), i = (ty * im.w + tx) * 4;
            if (d[i + 3] < 128) continue;
            buf[y * W + x] = 0xff000000 | (clamp(d[i + 2] * sh, 0, 255) << 16) | (clamp(d[i + 1] * sh, 0, 255) << 8) | clamp(d[i] * sh, 0, 255);
          }
        }
      }
      g.putImageData(img, 0, 0);
    }

    function drawWeapon() {
      const w = pendingWeapon >= 0 && P.weapon !== pendingWeapon ? P.weapon : P.weapon;
      const lower = pendingWeapon >= 0 ? Math.sin(Math.min(1, (0.4 - wSwitch) / 0.4) * Math.PI) * 60 : 0;
      const deadDrop = state === "dead" ? Math.min(80, stateT * 120) : 0;
      const bx = Math.cos(bob * 0.5) * 7 * bobAmt, by = Math.abs(Math.sin(bob * 0.5)) * 6 * bobAmt + lower + deadDrop;
      g.save(); g.translate(bx, by);
      const skin = "#c48a62", skinD = "#94603e";
      if (w === 0) {
        const punch = wAnim > 0 ? Math.sin((1 - wAnim / 0.3) * Math.PI) : 0;
        const ox = 196 - punch * 40, oy = 138 - punch * 40;
        g.fillStyle = skinD; g.fillRect(ox + 6, oy + 18, 46, 40);
        g.fillStyle = skin; g.fillRect(ox, oy, 46, 34);
        g.fillStyle = skinD; for (let k = 0; k < 4; k++) g.fillRect(ox + 4 + k * 11, oy + 2, 2, 12);
        g.fillStyle = "#e0a87e"; for (let k = 0; k < 4; k++) g.fillRect(ox + 2 + k * 11, oy + 1, 8, 4);
        g.fillStyle = "#2e6a2e"; g.fillRect(ox + 2, oy + 34, 50, 30);
      } else if (w === 1) {
        const k = wAnim > 0.14 ? 7 : 0;
        if (wAnim > 0.12) { g.fillStyle = "#ffd84a"; star(g, 160, 100 + k, 18, 7, 7); g.fillStyle = "#fffae0"; star(g, 160, 100 + k, 9, 4, 7); }
        g.fillStyle = "#2e6a2e"; g.fillRect(140, 158 + k, 40, 14); g.fillStyle = "#245424"; g.fillRect(140, 158 + k, 40, 3);
        g.fillStyle = "#3a3a3a"; g.fillRect(151, 110 + k, 18, 34);
        g.fillStyle = "#606060"; g.fillRect(152, 110 + k, 16, 5);
        g.fillStyle = "#1c1c1c"; for (let r = 0; r < 4; r++) g.fillRect(153, 119 + k + r * 4, 14, 2);
        g.fillStyle = "#909090"; g.fillRect(158, 105 + k, 4, 6);
        g.fillStyle = "#101010"; g.fillRect(155, 106 + k, 2, 4); g.fillRect(163, 106 + k, 2, 4);
        g.fillStyle = skin; g.fillRect(145, 136 + k, 30, 24);
        g.fillStyle = skinD; g.fillRect(145, 144 + k, 30, 2); g.fillRect(145, 150 + k, 30, 2); g.fillRect(145, 156 + k, 30, 2);
        g.fillStyle = "#dca07a"; g.fillRect(171, 132 + k, 7, 14); g.fillStyle = skinD; g.fillRect(171, 145 + k, 7, 2);
      } else {
        const fireP = wAnim > 0.8 ? 1 : 0, pumpP = wAnim > 0.25 && wAnim < 0.75 ? Math.sin((0.75 - wAnim) / 0.5 * Math.PI) : 0;
        const ky = fireP ? 8 : 0;
        if (fireP) { g.fillStyle = "#ffd84a"; star(g, 160, 92, 26, 10, 8); g.fillStyle = "#fffae0"; star(g, 160, 92, 13, 5, 8); }
        g.fillStyle = "#262626"; g.fillRect(150, 100 + ky, 20, 70);
        g.fillStyle = "#4e4e4e"; g.fillRect(152, 100 + ky, 4, 70); g.fillStyle = "#111"; g.fillRect(155, 99 + ky, 10, 4);
        g.fillStyle = "#6a3e1c"; g.fillRect(143, 132 + ky + pumpP * 18, 34, 18); g.fillStyle = "#4a2a10"; for (let k = 0; k < 4; k++) g.fillRect(145, 135 + ky + pumpP * 18 + k * 4, 30, 1);
        g.fillStyle = skin; g.fillRect(138, 140 + ky + pumpP * 18, 12, 18); g.fillRect(170, 140 + ky + pumpP * 18, 12, 18);
        g.fillStyle = "#2e6a2e"; g.fillRect(132, 156 + ky + pumpP * 18, 56, 20);
      }
      g.restore();
    }
    function drawFace(x, y) {
      g.fillStyle = "#2a2622"; g.fillRect(x, y, 30, 29);
      const hp = P.health, lvl = hp > 80 ? 0 : hp > 60 ? 1 : hp > 40 ? 2 : hp > 20 ? 3 : 4;
      const dead = face.mode === "dead" || state === "dead";
      g.fillStyle = dead ? "#a46a4c" : "#c8906a"; g.fillRect(x + 6, y + 3, 18, 24); g.fillRect(x + 5, y + 6, 20, 17);
      g.fillStyle = "#5a3a1c"; g.fillRect(x + 6, y + 2, 18, 4); g.fillRect(x + 5, y + 4, 2, 6); g.fillRect(x + 23, y + 4, 2, 6);
      const look = dead ? 0 : face.look;
      if (dead) { g.fillStyle = "#300"; g.fillRect(x + 9, y + 11, 4, 1); g.fillRect(x + 17, y + 11, 4, 1); g.fillRect(x + 11, y + 20, 8, 3); }
      else {
        g.fillStyle = "#f2f2f2"; g.fillRect(x + 9, y + 10, 5, 3); g.fillRect(x + 17, y + 10, 5, 3);
        g.fillStyle = "#1a3a8a"; g.fillRect(x + 11 + look, y + 10, 2, 3); g.fillRect(x + 19 + look, y + 10, 2, 3);
        g.fillStyle = "#5a3a1c";
        if (face.mode === "fire" || face.mode === "ouch") { g.fillRect(x + 8, y + 8, 6, 1); g.fillRect(x + 17, y + 8, 6, 1); }
        else { g.fillRect(x + 9, y + 8, 5, 1); g.fillRect(x + 17, y + 8, 5, 1); }
        if (face.mode === "grin") { g.fillStyle = "#f4f4f4"; g.fillRect(x + 10, y + 19, 11, 3); g.fillStyle = "#300"; g.fillRect(x + 10, y + 22, 11, 1); }
        else if (face.mode === "ouch") { g.fillStyle = "#300"; g.fillRect(x + 12, y + 18, 6, 6); }
        else { g.fillStyle = "#6a3a2a"; g.fillRect(x + 11, y + 20, 9, 2); }
        g.fillStyle = "#a06a4a"; g.fillRect(x + 14, y + 13, 2, 5);
      }
      g.fillStyle = "#b00000";
      const marks = [[8, 15], [21, 7], [19, 17], [9, 22], [16, 4], [22, 21], [7, 9], [13, 24]];
      for (let k = 0; k < Math.min(marks.length, (dead ? 4 : lvl) * 2); k++) g.fillRect(x + marks[k][0], y + marks[k][1], 2, 2);
    }
    function bigNum(val, cx, y) {
      g.font = "bold 15px monospace"; g.textAlign = "center"; g.textBaseline = "top";
      g.fillStyle = "#300"; g.fillText(val, cx + 1, y + 1); g.fillStyle = "#e8281c"; g.fillText(val, cx, y);
    }
    function drawStatus() {
      g.drawImage(A.statusBg, 0, VH);
      const ammo = P.weapon === 1 ? P.bullets : P.weapon === 2 ? P.shells : "";
      bigNum(String(ammo), 24, VH + 5);
      bigNum(Math.max(0, Math.round(P.health)) + "%", 76, VH + 5);
      bigNum(P.armor + "%", 206, VH + 5);
      g.font = "bold 9px monospace"; g.textAlign = "center"; g.textBaseline = "top";
      const arms = [[2, 1], [3, 2], [4, -1], [5, -1], [6, -1], [7, -1]];
      arms.forEach(([n, wi], k) => { g.fillStyle = wi >= 0 && P.owned[wi] ? "#f0d020" : "#606060"; g.fillText(String(n), 112 + (k % 3) * 11, VH + 4 + ((k / 3) | 0) * 10); });
      drawFace(145, VH + 2);
      g.font = "bold 7px monospace"; g.textAlign = "left";
      [["BULL", P.bullets, 200], ["SHEL", P.shells, 50], ["RCKT", 0, 50], ["CELL", 0, 300]].forEach(([lab, c, m], k) => {
        g.fillStyle = "#cfcfcf"; g.fillText(lab, 238, VH + 3 + k * 7);
        g.fillStyle = "#f0d020"; g.textAlign = "right"; g.fillText(String(c), 286, VH + 3 + k * 7); g.fillText(String(m), 314, VH + 3 + k * 7); g.textAlign = "left";
        g.fillStyle = "#cfcfcf"; g.fillText("/", 289, VH + 3 + k * 7);
      });
    }
    function drawAutomap() {
      g.fillStyle = "#000"; g.fillRect(0, 0, W, VH);
      const sc = 6, ox = W / 2 - px * sc, oy = HALF - py * sc;
      g.lineWidth = 1;
      for (let y = 0; y < mapH; y++) for (let x = 0; x < mapW; x++) {
        if (!seen[y * mapW + x]) continue;
        const c = grid[y][x]; if (!c) continue;
        const sx = ox + x * sc, sy = oy + y * sc;
        const col = c === "D" ? "#e0c020" : c === "X" || c === "Y" ? "#20e040" : "#c02010";
        g.fillStyle = col;
        if (!cellAt(x, y - 1)) g.fillRect(sx, sy, sc, 1);
        if (!cellAt(x, y + 1)) g.fillRect(sx, sy + sc - 1, sc, 1);
        if (!cellAt(x - 1, y)) g.fillRect(sx, sy, 1, sc);
        if (!cellAt(x + 1, y)) g.fillRect(sx + sc - 1, sy, 1, sc);
      }
      const a = Math.atan2(dirY, dirX), cx = W / 2, cy = HALF;
      g.strokeStyle = "#fff"; g.beginPath();
      g.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); g.lineTo(cx + Math.cos(a + 2.5) * 5, cy + Math.sin(a + 2.5) * 5);
      g.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); g.lineTo(cx + Math.cos(a - 2.5) * 5, cy + Math.sin(a - 2.5) * 5);
      g.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); g.lineTo(cx - Math.cos(a) * 5, cy - Math.sin(a) * 5); g.stroke();
      g.font = "bold 8px monospace"; g.fillStyle = "#e8281c"; g.textAlign = "left"; g.textBaseline = "top"; g.fillText(MAPS[level].name, 4, VH - 12);
    }

    function attract(dt) { // slow camera spin behind the title screen
      const c = Math.cos(dt * 0.25), s = Math.sin(dt * 0.25);
      const ndx = dirX * c - dirY * s, ndy = dirX * s + dirY * c; dirX = ndx; dirY = ndy;
      const npx = planeX * c - planeY * s, npy = planeX * s + planeY * c; planeX = npx; planeY = npy;
    }
    function frameDraw() {
      if (state === "play" || state === "dead" || state === "title") {
        if (automap && state === "play") drawAutomap(); else render3D();
        if (state !== "title") {
          if (!automap) drawWeapon();
          if (flash > 0.01) { g.fillStyle = `rgba(${flashCol},${Math.min(0.6, flash)})`; g.fillRect(0, 0, W, VH); }
          if (state === "dead") { g.fillStyle = `rgba(160,0,0,${Math.min(0.45, stateT * 0.3)})`; g.fillRect(0, 0, W, VH); }
          drawStatus();
          if (msgT > 0) { g.font = "bold 8px monospace"; g.textAlign = "left"; g.textBaseline = "top"; g.fillStyle = "#200"; g.fillText(msg, 3, 3); g.fillStyle = "#e8281c"; g.fillText(msg, 2, 2); }
        }
      } else { g.fillStyle = "#000"; g.fillRect(0, 0, W, H); }
      dctx.imageSmoothingEnabled = false;
      if (state === "title") { dctx.drawImage(lo, 0, 0, W, VH, 0, 0, DW, DH); }
      else dctx.drawImage(lo, 0, 0, W, H, 0, 0, DW, DH);
      overlay();
    }
    function center(txt, y, font, col, shadow) {
      dctx.font = font; dctx.textAlign = "center"; dctx.textBaseline = "middle";
      if (shadow !== false) { dctx.fillStyle = "rgba(0,0,0,.85)"; dctx.fillText(txt, DW / 2 + 3, y + 3); }
      dctx.fillStyle = col; dctx.fillText(txt, DW / 2, y);
    }
    function logo(y, size) {
      dctx.save();
      dctx.font = `900 ${size}px Impact, "Arial Black", "Helvetica Neue", sans-serif`; dctx.textAlign = "center"; dctx.textBaseline = "middle";
      dctx.translate(DW / 2, y); dctx.transform(1, 0, -0.06, 1, 0, 0); dctx.scale(1.25, 1);
      const gr = dctx.createLinearGradient(0, -size * 0.42, 0, size * 0.42);
      gr.addColorStop(0, "#fff0b0"); gr.addColorStop(0.3, "#ff9a2a"); gr.addColorStop(0.62, "#d0200c"); gr.addColorStop(1, "#4a0602");
      dctx.lineJoin = "miter"; dctx.lineWidth = 12; dctx.strokeStyle = "#140302"; dctx.strokeText("DOOM", 0, 0);
      dctx.fillStyle = gr; dctx.fillText("DOOM", 0, 0);
      dctx.lineWidth = 2; dctx.strokeStyle = "rgba(255,230,170,.55)"; dctx.strokeText("DOOM", -1, -2); // top bevel glint
      dctx.restore();
    }
    const tapWord = coarse ? "TAP" : "PRESS ENTER";
    function overlay() {
      if (state === "title") {
        dctx.fillStyle = "rgba(0,0,0,.45)"; dctx.fillRect(0, 0, DW, DH);
        logo(150, 150);
        center("A RAYCASTING TRIBUTE TO THE 1993 CLASSIC", 248, "bold 15px monospace", "#d8c8a8");
        if (((titleA * 2) | 0) % 2 === 0) center(`${tapWord} TO START`, 312, "bold 26px monospace", "#ff3a22");
        const lines = coarse
          ? ["LEFT STICK: MOVE · DRAG RIGHT: TURN", "FIRE · USE (DOORS / EXIT SWITCH) · WPN · MAP"]
          : ["WASD MOVE · MOUSE / ←→ TURN · CLICK OR CTRL FIRE", "SPACE / E USE · 1 2 3 WEAPONS · TAB MAP · SHIFT RUN · M MUTE"];
        lines.forEach((l, i) => center(l, 384 + i * 24, "bold 13px monospace", "#bdbdbd"));
        return;
      }
      if (state === "dead") {
        center("YOU ARE DEAD", 170, "900 54px Impact, 'Arial Black', sans-serif", "#ff2a14");
        if (stateT > 1) center(`${tapWord} TO RESTART THE LEVEL`, 240, "bold 18px monospace", "#f0d0c0");
      }
      if (paused && state === "play") { dctx.fillStyle = "rgba(0,0,0,.55)"; dctx.fillRect(0, 0, DW, DH); center("PAUSED", 200, "900 60px Impact, 'Arial Black', sans-serif", "#ff3a22"); center(coarse ? "TAP TO RESUME" : "CLICK OR PRESS ESC TO RESUME", 260, "bold 16px monospace", "#ddd"); }
      if (state === "play" && !paused && !coarse && document.pointerLockElement !== cv && stats && stats.time < 6) center("CLICK THE VIEW FOR MOUSE LOOK", 74, "bold 13px monospace", "#ffd84a");
      if (state === "inter" || state === "victory") {
        const bg = dctx.createLinearGradient(0, 0, 0, DH); bg.addColorStop(0, "#2a0806"); bg.addColorStop(1, "#0a0202");
        dctx.fillStyle = bg; dctx.fillRect(0, 0, DW, DH);
        for (let i = 0; i < 70; i++) { dctx.fillStyle = `rgba(255,${60 + (i * 37) % 120},20,${0.04 + (i % 5) * 0.015})`; dctx.fillRect((i * 97) % DW, (i * 53 + titleA * 30) % DH, 3, 3); }
        if (state === "victory") {
          logo(120, 110);
          center("YOU HAVE CLEARED BOTH OUTPOSTS", 220, "bold 22px monospace", "#ffd8a0");
          center("THE INVASION IS HELD BACK — FOR NOW.", 256, "bold 16px monospace", "#d8b090");
          if (stateT > 1.2) center(`${tapWord} TO PLAY AGAIN`, 360, "bold 20px monospace", "#ff3a22");
          return;
        }
        const M = MAPS[level], k = clamp(stateT / 1.6, 0, 1);
        center(M.name, 92, "900 34px Impact, 'Arial Black', sans-serif", "#ff4a24");
        center("FINISHED", 132, "900 30px Impact, 'Arial Black', sans-serif", "#ffd8a0");
        const pct = (a, b) => (b ? Math.round(a / b * 100 * k) : 100) + "%";
        const t = Math.floor(stats.time * k), tt = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
        [["KILLS", pct(stats.kills, stats.totalKills)], ["ITEMS", pct(stats.items, stats.totalItems)], ["SECRET", pct(stats.secrets, stats.totalSecrets)], ["TIME", tt]].forEach(([l, v], i) => {
          dctx.font = "900 28px Impact, 'Arial Black', sans-serif"; dctx.textBaseline = "middle";
          dctx.textAlign = "left"; dctx.fillStyle = "#e8281c"; dctx.fillText(l, 160, 200 + i * 46);
          dctx.textAlign = "right"; dctx.fillStyle = "#ffd8a0"; dctx.fillText(v, 480, 200 + i * 46);
        });
        if (stateT > 1.8) center(`${tapWord} TO CONTINUE`, 420, "bold 18px monospace", "#ff3a22");
      }
    }

    function advance() { // Enter / tap on non-play screens
      sfx.unlock();
      if (state === "title") { startGame(); return; }
      if (state === "dead" && stateT > 1) { Object.assign(P, JSON.parse(JSON.stringify(saved))); loadLevel(level); return; }
      if (state === "inter" && stateT > 1.8) { if (level + 1 < MAPS.length) loadLevel(level + 1); else { state = "victory"; stateT = 0; } return; }
      if (state === "victory" && stateT > 1.2) { state = "title"; stateT = 0; loadLevel(0); state = "title"; return; }
    }

    // ---------------- input ----------------
    let active = true;
    const GAME_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyE", "Tab", "ControlLeft", "ControlRight", "KeyF", "Digit1", "Digit2", "Digit3", "Enter", "ShiftLeft", "ShiftRight", "KeyM"]);
    function onKeyDown(e) {
      if (!active || !document.body.contains(host)) return;
      if (GAME_KEYS.has(e.code) || e.code === "Escape") e.preventDefault();
      if (e.repeat && (e.code === "Space" || e.code === "KeyE" || e.code === "Tab")) return;
      keys[e.code] = true; sfx.unlock();
      if (e.code === "Enter") { if (state !== "play") advance(); return; }
      if (e.code === "Escape") { if (state === "play") paused = !paused; return; }
      if (state !== "play") return;
      if (paused) return;
      if (e.code === "Space" || e.code === "KeyE") use();
      if (e.code === "Tab") automap = !automap;
      if (e.code === "KeyM") message(sfx.toggle() ? "Sound off" : "Sound on");
      if (e.code === "ControlLeft" || e.code === "ControlRight" || e.code === "KeyF") { firing = true; fire(); }
      if (e.code === "Digit1") switchWeapon(0); if (e.code === "Digit2") switchWeapon(1); if (e.code === "Digit3") switchWeapon(2);
    }
    function onKeyUp(e) {
      keys[e.code] = false;
      if (e.code === "ControlLeft" || e.code === "ControlRight" || e.code === "KeyF") firing = false;
    }
    function onDocDown(e) { active = host.contains(e.target); if (!active) { firing = false; for (const k in keys) keys[k] = false; } }
    function onMouseMove(e) { if (document.pointerLockElement === cv && state === "play" && !paused) turnAcc += e.movementX * 0.0026; }
    function onLockChange() { if (document.pointerLockElement !== cv) firing = false; }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerdown", onDocDown, true);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLockChange);

    // canvas pointer: mouse = lock + fire; touch = turn drag on the right side
    const drags = {};
    cv.addEventListener("pointerdown", (e) => {
      e.preventDefault(); sfx.unlock(); active = true; cv.focus();
      if (state !== "play") { advance(); return; }
      if (paused) { paused = false; return; }
      if (e.pointerType === "mouse") {
        if (document.pointerLockElement !== cv && cv.requestPointerLock) { try { cv.requestPointerLock(); } catch (er) {} }
        else { firing = true; fire(); }
        drags[e.pointerId] = { x: e.clientX, mouse: true };
      } else {
        drags[e.pointerId] = { x: e.clientX, mouse: false };
      }
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
    });
    cv.addEventListener("pointermove", (e) => {
      const d = drags[e.pointerId]; if (!d) return;
      if (d.mouse && document.pointerLockElement === cv) return;
      const r = cv.getBoundingClientRect(), dx = e.clientX - d.x; d.x = e.clientX;
      if (state === "play" && !paused) turnAcc += dx / r.width * (d.mouse ? 3.2 : 4.2);
    });
    const endDrag = (e) => { if (drags[e.pointerId] && drags[e.pointerId].mouse) firing = false; delete drags[e.pointerId]; };
    cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);

    // touch stick + buttons
    const stickEl = host.querySelector(".dt-stick"), nub = host.querySelector(".dt-nub");
    let stickId = null;
    function stickMove(e) {
      const r = stickEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      stick.x = dx; stick.y = dy; nub.style.left = (40 + dx * 40) + "px"; nub.style.top = (40 + dy * 40) + "px";
    }
    stickEl.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); sfx.unlock(); if (state !== "play") { advance(); return; } stickId = e.pointerId; try { stickEl.setPointerCapture(e.pointerId); } catch (er) {} stickMove(e); });
    stickEl.addEventListener("pointermove", (e) => { if (e.pointerId === stickId) stickMove(e); });
    const stickEnd = (e) => { if (e.pointerId !== stickId) return; stickId = null; stick.x = stick.y = 0; nub.style.left = nub.style.top = "40px"; };
    stickEl.addEventListener("pointerup", stickEnd); stickEl.addEventListener("pointercancel", stickEnd);
    host.querySelectorAll(".dt-b").forEach((b) => {
      const k = b.dataset.k;
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation(); sfx.unlock();
        if (state !== "play") { advance(); return; }
        if (paused) { paused = false; return; }
        if (k === "fire") { touchFire = true; fire(); }
        else if (k === "use") use();
        else if (k === "map") automap = !automap;
        else if (k === "wpn") { for (let i = 1; i <= 3; i++) { const n = (P.weapon + i) % 3; if (P.owned[n] && (n === 0 || (n === 1 && P.bullets > 0) || (n === 2 && P.shells > 0))) { switchWeapon(n); break; } } }
      });
      const up = () => { if (k === "fire") touchFire = false; };
      b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
    });

    // ---------------- loop & teardown ----------------
    let raf = 0, last = performance.now(), dead = false;
    function cleanup() {
      if (dead) return; dead = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("pointerdown", onDocDown, true);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (document.pointerLockElement === cv) { try { document.exitPointerLock(); } catch (e) {} }
      if (ro) ro.disconnect();
      sfx.close();
    }
    const win = body.closest(".win"); if (win) win.addEventListener("wm-cleanup", cleanup);
    function frame() {
      if (dead) return;
      if (!document.body.contains(host)) { cleanup(); return; }
      const now = performance.now(); let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1;
      if (state === "title") attract(dt);
      update(dt);
      frameDraw();
      raf = requestAnimationFrame(frame);
    }
    loadLevel(0); state = "title"; // the level renders behind the title screen
    raf = requestAnimationFrame(frame);
    // debug/test hooks
    host.__doom = {
      get state() { return state; }, get level() { return level; }, get health() { return P.health; }, get pos() { return [px, py]; },
      get enemies() { return enemies.filter((e) => e.state !== "dead").length; }, get kills() { return stats ? stats.kills : 0; },
      start: () => advance(), fire, use, P, warp: (x, y) => { px = x; py = y; }, face: (dx, dy) => { const m = Math.hypot(dx, dy); dirX = dx / m; dirY = dy / m; planeX = -dirY * 0.66; planeY = dirX * 0.66; },
      doorAt: (x, y) => doors[y * mapW + x], cell: (x, y) => cellAt(x, y), step: (dt) => update(dt), list: () => enemies, zb: () => zbuf, scr: (o) => screenOf(o),
    };
    return { dispose: cleanup };
  }

  window.DOOM = { start, MAPS };
})();
