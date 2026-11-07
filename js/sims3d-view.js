/* The Sims — 3D view (Three.js). Renders the lot from js/sims.js in real 3D:
   procedural house (walls with cutaway, room floors, lawn, sidewalk, street), furniture
   (the GLB models from assets/models/sims where one fits, procedural pieces otherwise),
   articulated low-poly Sims with walk/sit/lie/dance poses, a 3D plumbob, sun that moves
   with the game clock, lamps at night. sims.js keeps all the game logic and calls
   view.render(state) each frame; picking goes through view.pick(). */
(function () {
  "use strict";
  const MODEL_BASE = "assets/models/sims/";
  // CAT type → GLB model (+ how to orient it; yaw in radians so its front faces +z).
  const MODELS = {
    sofa: { file: "sofas/sofa-modelo-duplo-reto.glb", yaw: 0 },
    armchair: { file: "sofas/sofa-modelo-um-assento.glb", yaw: 0 },
    tv: { file: "crt-tv.glb", yaw: 0, h: 0.62, onStand: 0.5 },
    bookshelf: { file: "metal-bookshelf.glb", yaw: 0 },
    lamp: { file: "lamp.glb", yaw: 0, h: 0.68, onStand: 0.72 },
    deckchair: { file: "deckchair-striped.glb", yaw: Math.PI / 2 },
    deckchair2: { file: "deckchair.glb", yaw: Math.PI / 2 },
    porchswing: { file: "porchswing.glb", yaw: 0, depth: 2.2 },
    barrel: { file: "barrel.glb", yaw: 0 },
    sofa3: { file: "sofas/sofa-modelo-triplo-pes.glb", yaw: 0 },
    sectional: { file: "sofas/sofa-modelo-triplo-chaise.glb", yaw: 0 },
    papasan: { file: "sofas/sofa-modelo-cadeira-rede.glb", yaw: 0, depth: 1.2 },
    daybed: { file: "sofas/sofa-modelo-diva.glb", yaw: 0 },
  };
  const WALL_H = 2.6, WALL_LOW = 0.32, WALL_T = 0.12;

  function create(opts) {
    const THREE = window.THREE;
    const { LW, LH, HOUSE, ROOMS, hWall, vWall, CAT } = opts;
    const canvas = document.createElement("canvas"); canvas.className = "sm-3d";
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
    const disposables = [];
    const keep = (x) => { disposables.push(x); return x; };
    const mat = (color, o) => keep(new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8 }, o || {})));

    // ---------- canvas textures ----------
    function texture(draw, size, rep) {
      const c = document.createElement("canvas"); c.width = c.height = size || 128; const g = c.getContext("2d"); draw(g, c.width);
      const t = keep(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (rep) t.repeat.set(rep[0], rep[1]); return t;
    }
    const noise = (g, s, base, amt, n) => { g.fillStyle = base; g.fillRect(0, 0, s, s); for (let i = 0; i < (n || 900); i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * amt})`; g.fillRect(Math.random() * s, Math.random() * s, 2, 2); } };
    const TEX = {
      grass: texture((g, s) => { noise(g, s, "#5aa33f", 0.12, 2500); for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(${30 + Math.random() * 40},${110 + Math.random() * 60},40,.6)`; const x = Math.random() * s, y = Math.random() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.random() * 3 - 1.5, y - 4); g.stroke(); } }, 256),
      wood: texture((g, s) => { for (let i = 0; i < 8; i++) { g.fillStyle = ["#b07a44", "#a8723e", "#b8844c", "#a06c3a"][i % 4]; g.fillRect(0, i * s / 8, s, s / 8); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, i * s / 8, s, 1.5); g.fillRect(((i * 37) % 8) * s / 8, i * s / 8, 1.5, s / 8); } for (let i = 0; i < 60; i++) { g.strokeStyle = "rgba(80,40,10,.12)"; const y = Math.random() * s; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s / 3, y + 3, s * 2 / 3, y - 3, s, y); g.stroke(); } }, 256),
      carpet: texture((g, s) => noise(g, s, "#4a6aa0", 0.18, 4000), 128),
      tile: texture((g, s) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? "#e8eef2" : "#d5dee4"; g.fillRect(x * s / 2, y * s / 2, s / 2, s / 2); } g.strokeStyle = "#aab4bc"; g.lineWidth = 2; g.strokeRect(0, 0, s, s); g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke(); }, 128),
      kitchen: texture((g, s) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? "#efe2a8" : "#3a3a40"; g.fillRect(x * s / 2, y * s / 2, s / 2, s / 2); } }, 64),
      sidewalk: texture((g, s) => { noise(g, s, "#c4c4bc", 0.1, 1200); g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2); }, 128),
      road: texture((g, s) => { noise(g, s, "#3a3d44", 0.12, 2500); g.fillStyle = "#e8d84a"; g.fillRect(s * 0.1, s / 2 - 3, s * 0.4, 6); }, 128),
      wallpaper: texture((g, s) => { g.fillStyle = "#efe6d4"; g.fillRect(0, 0, s, s); g.fillStyle = "rgba(170,140,100,.18)"; for (let x = 0; x < s; x += s / 8) g.fillRect(x, 0, s / 32, s); }, 128),
      siding: texture((g, s) => { for (let y = 0; y < 8; y++) { g.fillStyle = y % 2 ? "#d7cdb4" : "#d0c5aa"; g.fillRect(0, y * s / 8, s, s / 8); g.fillStyle = "rgba(0,0,0,.15)"; g.fillRect(0, (y + 1) * s / 8 - 2, s, 2); } }, 128),
      blanket: texture((g, s) => { g.fillStyle = "#3a5a9a"; g.fillRect(0, 0, s, s); g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 3; for (let i = -s; i < s * 2; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); } }, 128),
    };

    // ---------- environment reflections: a soft sky/ground gradient baked into an env map ----------
    try {
      const envScene = new THREE.Scene(); const sg = new THREE.SphereGeometry(10, 24, 12); const cols = [];
      const top = new THREE.Color(0xbcd8f2), hor = new THREE.Color(0xf2ece0), bot = new THREE.Color(0x5a6a48);
      for (let i = 0; i < sg.attributes.position.count; i++) { const y = sg.attributes.position.getY(i) / 10; const c = y > 0 ? hor.clone().lerp(top, y) : hor.clone().lerp(bot, -y * 2); cols.push(c.r, c.g, c.b); }
      sg.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
      envScene.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const pm = new THREE.PMREMGenerator(renderer); const envRT = pm.fromScene(envScene, 0.04); scene.environment = envRT.texture; scene.environmentIntensity = 0.55; keep(envRT); pm.dispose(); sg.dispose();
    } catch (e) {}

    // ---------- lights & sky ----------
    const hemi = new THREE.HemisphereLight(0xdfefff, 0x5a7a3a, 0.9); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 60; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    const lampLights = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffd8a0, 0, 7, 1.6); scene.add(l); lampLights.push(l); }
    const tvLight = new THREE.PointLight(0x8ab8ff, 0, 5, 1.8); scene.add(tvLight);

    // ---------- ground ----------
    const plane = (w, h, m, x, z, y) => { const me = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), m); me.rotation.x = -Math.PI / 2; me.position.set(x, y || 0, z); me.receiveShadow = true; scene.add(me); return me; };
    const grassT = TEX.grass.clone(); grassT.needsUpdate = true; grassT.repeat.set(40, 40); keep(grassT);
    plane(80, 80, mat(0xffffff, { map: grassT, roughness: 1 }), LW / 2, LH / 2, -0.02);
    const swT = TEX.sidewalk.clone(); swT.needsUpdate = true; swT.repeat.set(30, 1); keep(swT);
    plane(30, 1, mat(0xffffff, { map: swT }), LW / 2, LH - 1.5, 0.005);
    const rdT = TEX.road.clone(); rdT.needsUpdate = true; rdT.repeat.set(30, 1); keep(rdT);
    plane(60, 4, mat(0xffffff, { map: rdT, roughness: 0.95 }), LW / 2, LH + 1, 0.004);
    // driveway + front path
    plane(1, LH - 2 - (HOUSE.y1 + 1), mat(0xc4c4bc), 7.5, (HOUSE.y1 + 1 + LH - 2) / 2, 0.006);
    // lot boundary hedge
    const hedgeM = mat(0x3f7f2e, { roughness: 1 });
    [[LW / 2, -0.25, LW + 0.5, 0.5], [-0.25, (LH - 2) / 2, 0.5, LH - 2], [LW + 0.25, (LH - 2) / 2, 0.5, LH - 2]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, 0.7, d)), hedgeM); m.position.set(x, 0.35, z); m.castShadow = m.receiveShadow = true; scene.add(m); });
    // room floors
    const floorM = {};
    ROOMS.forEach((r) => {
      const w = r.x1 - r.x0 + 1, d = r.y1 - r.y0 + 1, t = TEX[r.floor] || TEX.wood; const tt = t.clone(); tt.needsUpdate = true; tt.repeat.set(w, d); keep(tt);
      floorM[r.id] = plane(w, d, mat(0xffffff, { map: tt, roughness: r.floor === "tile" ? 0.35 : 0.8 }), r.x0 + w / 2, r.y0 + d / 2, 0.012);
    });
    // foundation
    const fnd = new THREE.Mesh(keep(new THREE.BoxGeometry(HOUSE.x1 - HOUSE.x0 + 1.2, 0.12, HOUSE.y1 - HOUSE.y0 + 1.2)), mat(0x9a948a)); fnd.position.set((HOUSE.x0 + HOUSE.x1 + 1) / 2, -0.05, (HOUSE.y0 + HOUSE.y1 + 1) / 2); fnd.receiveShadow = true; scene.add(fnd);

    // ---------- walls ----------
    const walls = [];
    const inMat = mat(0xffffff, { map: TEX.wallpaper }), outMat = mat(0xffffff, { map: TEX.siding }), capMat = mat(0xf4f1ea);
    const houseC = new THREE.Vector2((HOUSE.x0 + HOUSE.x1 + 1) / 2, (HOUSE.y0 + HOUSE.y1 + 1) / 2);
    function addWall(x0, z0, x1, z1) {
      const horiz = z0 === z1, len = horiz ? x1 - x0 : z1 - z0;
      const exterior = (horiz && (z0 === HOUSE.y0 || z0 === HOUSE.y1 + 1)) || (!horiz && (x0 === HOUSE.x0 || x0 === HOUSE.x1 + 1));
      const geo = keep(new THREE.BoxGeometry(horiz ? len + WALL_T : WALL_T, 1, horiz ? WALL_T : len + WALL_T)); geo.translate(0, 0.5, 0);
      const m = new THREE.Mesh(geo, exterior ? [outMat, outMat, capMat, capMat, outMat, outMat] : inMat);
      // inner faces get wallpaper even on exterior walls
      if (exterior) { const inside = horiz ? (z0 === HOUSE.y0 ? 4 : 5) : (x0 === HOUSE.x0 ? 0 : 1); m.material = m.material.slice(); m.material[inside] = inMat; }
      m.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; scene.add(m);
      const w = { m, mid: new THREE.Vector2((x0 + x1) / 2, (z0 + z1) / 2), exterior, h: WALL_H, target: WALL_H };
      m.scale.y = WALL_H; walls.push(w);
      // a window in long exterior runs
      return w;
    }
    for (let y = 0; y <= LH; y++) for (let x = 0; x <= LW; x++) {
      if (hWall[y] && hWall[y][x]) addWall(x, y, x + 1, y);
      if (vWall[y] && vWall[y][x]) addWall(x, y, x, y + 1);
    }
    // windows: glass panes on some exterior segments (front & back)
    const glassM = mat(0x9ec8e6, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55 }), frameM = mat(0xffffff);
    walls.forEach((w, i) => {
      if (!w.exterior || i % 3 !== 1) return;
      const horiz = w.m.geometry.parameters.depth === WALL_T;
      const g = new THREE.Group(); const pane = new THREE.Mesh(keep(new THREE.BoxGeometry(horiz ? 0.6 : WALL_T + 0.02, 0.8, horiz ? WALL_T + 0.02 : 0.6)), glassM);
      const fr = new THREE.Mesh(keep(new THREE.BoxGeometry(horiz ? 0.7 : WALL_T + 0.04, 0.9, horiz ? WALL_T + 0.04 : 0.7)), frameM);
      g.add(fr, pane); fr.scale.set(1, 1, 1); g.position.set(w.mid.x, 1.45, w.mid.y); scene.add(g); w.win = g;
    });

    // ---------- furniture ----------
    const loader = window.GLTFLoader ? new window.GLTFLoader() : null;
    const modelCache = {};
    function loadModel(file) {
      if (!loader) return Promise.reject(new Error("no loader"));
      if (!modelCache[file]) modelCache[file] = new Promise((res, rej) => loader.load(MODEL_BASE + file, (gl) => {
        gl.scene.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.material) disposables.push(m.material); if (m.geometry) disposables.push(m.geometry); } });
        res(gl.scene);
      }, undefined, rej));
      return modelCache[file];
    }
    const box = (w, h, d, color, x, y, z, o) => { const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), typeof color === "number" ? mat(color, o) : color); m.position.set(x || 0, (y || 0) + h / 2, z || 0); m.castShadow = m.receiveShadow = true; return m; };
    const cyl = (rt, rb, h, color, x, y, z, seg, o) => { const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(rt, rb, h, seg || 16)), typeof color === "number" ? mat(color, o) : color); m.position.set(x || 0, (y || 0) + h / 2, z || 0); m.castShadow = m.receiveShadow = true; return m; };
    // Procedural furniture: built facing +z, centered on its footprint (w tiles along x).
    function procedural(t, w) {
      const g = new THREE.Group(), W = w * 0.92;
      const legs = (gw, gd, h, col) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(box(0.06, h, 0.06, col, a * (gw / 2 - 0.05), 0, b * (gd / 2 - 0.05))));
      switch (t) {
        case "fridge": g.add(box(0.8, 1.85, 0.72, 0xe8ecf0, 0, 0, -0.05, { roughness: 0.35, metalness: 0.2 })); g.add(box(0.04, 0.5, 0.04, 0x9aa0a8, 0.3, 1.1, 0.33)); g.add(box(0.04, 0.3, 0.04, 0x9aa0a8, 0.3, 0.4, 0.33)); g.add(box(0.78, 0.01, 0.01, 0x9aa0a8, 0, 0.78, 0.32)); break;
        case "stove": g.add(box(0.8, 0.9, 0.7, 0xd8dde3, 0, 0, -0.05, { roughness: 0.4 })); g.add(box(0.78, 0.02, 0.68, 0x222428, 0, 0.9, -0.05)); [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.12], [0.2, 0.12]].forEach(([x, z]) => g.add(cyl(0.11, 0.11, 0.015, 0x444, x, 0.92, z - 0.05))); g.add(box(0.6, 0.4, 0.02, 0x30343c, 0, 0.25, 0.31)); break;
        case "counter": g.add(box(0.95, 0.86, 0.66, 0xb98a5a, 0, 0, -0.08)); g.add(box(1, 0.05, 0.72, 0xe8e4dc, 0, 0.86, -0.06, { roughness: 0.3 })); break;
        case "table": g.add(box(W, 0.05, 0.9, 0x8a5a34, 0, 0.72, 0)); legs(W, 0.9, 0.72, 0x6a4424); break;
        case "chair": g.add(box(0.45, 0.05, 0.45, 0x7a4a2a, 0, 0.45, 0)); g.add(box(0.45, 0.5, 0.05, 0x7a4a2a, 0, 0.5, -0.2)); legs(0.45, 0.45, 0.45, 0x5a3418); break;
        case "toilet": g.add(cyl(0.18, 0.15, 0.4, 0xf6f7f9, 0, 0, 0.05, 16, { roughness: 0.2 })); g.add(cyl(0.22, 0.2, 0.06, 0xf6f7f9, 0, 0.4, 0.08, 16, { roughness: 0.2 })); g.add(box(0.42, 0.42, 0.18, 0xf6f7f9, 0, 0.4, -0.28, { roughness: 0.2 })); break;
        case "shower": g.add(box(0.9, 0.08, 0.9, 0xe6eaee, 0, 0, 0)); g.add(box(0.04, 2.1, 0.9, 0xbfdcec, 0.45, 0, 0, { transparent: true, opacity: 0.35, roughness: 0.05 })); g.add(box(0.9, 2.1, 0.04, 0xbfdcec, 0, 0, 0.45, { transparent: true, opacity: 0.35, roughness: 0.05 })); g.add(cyl(0.1, 0.1, 0.03, 0xc0c4c8, 0, 1.95, -0.3)); break;
        case "tub": g.add(box(W, 0.55, 0.8, 0xf6f7f9, 0, 0, 0, { roughness: 0.2 })); g.add(box(W - 0.16, 0.05, 0.64, 0x9ad0e6, 0, 0.5, 0, { roughness: 0.05 })); break;
        case "sink": g.add(box(0.6, 0.8, 0.5, 0xc9b28a, 0, 0, -0.18)); g.add(box(0.62, 0.08, 0.54, 0xe6eaee, 0, 0.8, -0.16, { roughness: 0.2 })); g.add(box(0.03, 0.2, 0.03, 0xc0c4c8, 0, 0.88, -0.36)); g.add(box(0.5, 0.6, 0.02, 0x9ad0e6, 0, 1.15, -0.44, { roughness: 0.05, metalness: 0.4 })); break;
        case "bed": g.add(box(W, 0.35, 0.95, 0x6a4424, 0, 0, 0)); g.add(box(W - 0.04, 0.16, 0.92, 0xf4f1ea, 0, 0.35, 0)); g.add(box(0.06, 0.7, 0.98, 0x6a4424, -W / 2 + 0.03, 0, 0)); { const bl = box(W * 0.7, 0.05, 0.94, mat(0xffffff, { map: TEX.blanket }), W * 0.12, 0.51, 0); bl.name = "blanket"; g.add(bl); } g.add(box(0.32, 0.1, 0.55, 0xffffff, -W / 2 + 0.26, 0.51, 0)); break;
        case "computer": g.add(box(1.1, 0.05, 0.6, 0xc9a77d, 0, 0.72, -0.1)); legs(1.1, 0.6, 0.72, 0x8a6a44); g.add(box(0.42, 0.34, 0.36, 0xd9d4c4, 0, 0.77, -0.18)); g.add(box(0.34, 0.25, 0.01, 0x1a3a6a, 0, 0.82, 0.005, { emissive: 0x1a4a8a, emissiveIntensity: 0.6 })); g.add(box(0.4, 0.02, 0.14, 0xd9d4c4, 0, 0.77, 0.1)); break;
        case "stereo": g.add(box(0.5, 0.6, 0.35, 0x30343c, 0, 0, 0)); g.add(cyl(0.12, 0.12, 0.02, 0x111, -0.12, 0.25, 0.17)); [-0.12, 0.12].forEach((x) => { const s = cyl(0.08, 0.08, 0.02, 0x111, x, 0.35, 0.18); s.rotation.x = Math.PI / 2; g.add(s); }); break;
        case "phone": g.add(box(0.3, 0.75, 0.3, 0x8a6a44, 0, 0, 0)); g.add(box(0.2, 0.08, 0.16, 0xc9a46a, 0, 0.75, 0)); break;
        case "chess": g.add(box(0.7, 0.05, 0.7, 0x5a3a22, 0, 0.7, 0)); legs(0.7, 0.7, 0.7, 0x4a2a12); g.add(box(0.5, 0.01, 0.5, mat(0xffffff, { map: TEX.kitchen }), 0, 0.75, 0)); break;
        case "easel": [[-0.2, 0], [0.2, 0], [0, -0.3]].forEach(([x, z]) => { const l = box(0.04, 1.6, 0.04, 0xa87a4a, x, 0, z); l.rotation.x = z ? 0.2 : -0.08; g.add(l); }); g.add(box(0.6, 0.5, 0.03, 0xf8f6f0, 0, 0.9, 0.06)); break;
        case "mirror": g.add(box(0.6, 1.5, 0.05, 0x8a6a44, 0, 0.2, -0.4)); g.add(box(0.5, 1.4, 0.02, 0xcfeaf6, 0, 0.25, -0.37, { roughness: 0.02, metalness: 0.8 })); break;
        case "gym": g.add(box(0.35, 0.45, 1.2, 0x4a4e58, 0, 0, 0)); g.add(box(0.06, 1.1, 0.06, 0x888, -0.5, 0, -0.5)); g.add(box(0.06, 1.1, 0.06, 0x888, 0.5, 0, -0.5)); { const bar = cyl(0.02, 0.02, 1.3, 0xaaaaaa, 0, 1.05, -0.5); bar.rotation.z = Math.PI / 2; g.add(bar); } break;
        case "plant": g.add(cyl(0.2, 0.15, 0.4, 0xb4673a, 0, 0, 0)); for (let i = 0; i < 7; i++) { const lf = new THREE.Mesh(keep(new THREE.ConeGeometry(0.08, 0.9, 5)), mat(0x2e8a3a)); lf.position.set(0, 0.8, 0); lf.rotation.set(Math.cos(i) * 0.6, i, Math.sin(i * 2) * 0.6); lf.castShadow = true; g.add(lf); } g.add(cyl(0.03, 0.04, 0.6, 0x6a4a2a, 0, 0.35, 0)); break;
        case "lamp": g.add(cyl(0.18, 0.2, 0.04, 0x333, 0, 0, 0)); g.add(cyl(0.02, 0.02, 1.5, 0x555, 0, 0.04, 0)); { const sh = cyl(0.16, 0.28, 0.32, 0xe8d7a0, 0, 1.5, 0, 16, { emissive: 0xffd890, emissiveIntensity: 0 }); sh.name = "shade"; g.add(sh); } break;
        case "sculpture": g.add(box(0.4, 0.8, 0.4, 0xe8e2d6, 0, 0, 0)); { const s = new THREE.Mesh(keep(new THREE.TorusKnotGeometry(0.15, 0.05, 64, 8)), mat(0xc25a3a, { metalness: 0.4, roughness: 0.3 })); s.position.y = 1.05; s.castShadow = true; g.add(s); } break;
        case "trash": g.add(cyl(0.18, 0.15, 0.5, 0x5a6470, 0, 0, 0, 16, { metalness: 0.5, roughness: 0.4 })); break;
        case "mailbox": g.add(box(0.06, 1, 0.06, 0x6a4a2a, 0, 0, 0)); g.add(box(0.22, 0.25, 0.45, 0x3a5aa0, 0, 1, 0, { metalness: 0.3 })); g.add(box(0.02, 0.18, 0.08, 0xd63b2a, 0.12, 1.15, -0.1)); break;
        case "crib": g.add(box(0.8, 0.5, 0.5, 0xf4e6f0, 0, 0.3, 0)); legs(0.8, 0.5, 0.3, 0xd8c0d0); for (let i = 0; i < 7; i++) g.add(box(0.02, 0.4, 0.02, 0xffffff, -0.36 + i * 0.12, 0.8, 0.25)); break;
        case "plate": g.add(cyl(0.14, 0.12, 0.02, 0xf0ede6, 0, 0, 0)); g.add(cyl(0.06, 0.06, 0.015, 0x9a6a3a, 0.02, 0.02, 0)); break;
        case "puddle": { const p = new THREE.Mesh(keep(new THREE.CircleGeometry(0.35, 20)), mat(0xd8e24a, { transparent: true, opacity: 0.7, roughness: 0.05 })); p.rotation.x = -Math.PI / 2; p.position.y = 0.015; g.add(p); } break;
        case "sofa": case "armchair": case "sofa3": case "sectional": case "papasan": case "daybed": g.add(box(W, 0.42, 0.8, 0x6a3a8a, 0, 0, 0)); g.add(box(W, 0.45, 0.2, 0x6a3a8a, 0, 0.42, -0.3)); break;
        case "tv": g.add(box(0.9, 0.5, 0.45, 0x5a3a22, 0, 0, 0)); g.add(box(0.7, 0.55, 0.45, 0x2a2a30, 0, 0.5, 0)); break;
        default: g.add(box(0.8 * w, 0.7, 0.7, 0x888888, 0, 0, 0));
      }
      return g;
    }
    // facing: rotation (yaw) so the piece's front (+z) points into the room
    function facing(o, objs) {
      if (o.rot != null) return o.rot * Math.PI / 2;
      const d = CAT[o.t], w = d.w || 1;
      const adj = (tt) => objs.find((q) => q !== o && tt.includes(q.t) && Math.abs(q.x - o.x) + Math.abs(q.y - o.y) === 1);
      if (o.t === "chair") { const tgt = adj(["computer", "table", "chess"]); if (tgt) { const dx = tgt.x - o.x, dy = tgt.y - o.y; return Math.atan2(dx, dy); } }
      if (o.t === "tv") { const seat = objs.filter((q) => CAT[q.t] && CAT[q.t].seat).sort((a, b) => (Math.abs(a.x - o.x) + Math.abs(a.y - o.y)) - (Math.abs(b.x - o.x) + Math.abs(b.y - o.y)))[0]; if (seat && Math.abs(seat.x - o.x) + Math.abs(seat.y - o.y) < 6) { const dx = seat.x + (CAT[seat.t].w - 1) / 2 - o.x, dy = seat.y - o.y; return Math.abs(dx) > Math.abs(dy) ? Math.atan2(Math.sign(dx), 0) : Math.atan2(0, Math.sign(dy)); } }
      // away from an adjacent wall
      const x = o.x, y = o.y, x2 = o.x + w;
      if (hWall[y] && hWall[y].slice(x, x2).some(Boolean)) return 0;                 // wall behind (north) → face +z
      if (hWall[y + 1] && hWall[y + 1].slice(x, x2).some(Boolean)) return Math.PI;   // wall in front → face -z
      if (vWall[y] && vWall[y][x]) return Math.PI / 2;                                  // wall west → face +x
      if (vWall[y] && vWall[y][x2]) return -Math.PI / 2;                                // wall east → face -x
      return 0;
    }
    const objMeshes = new Map(); // obj → {group, key}
    function buildObject(o, objs) {
      const d = CAT[o.t]; if (!d) return null; const w = d.w || 1;
      const root = new THREE.Group(); root.userData.obj = o;
      const yaw = facing(o, objs);
      root.position.set(o.x + w / 2, 0, o.y + 0.5);
      const inner = new THREE.Group(); inner.rotation.y = yaw; root.add(inner);
      const proc = procedural(o.t, w); inner.add(proc);
      const M = MODELS[o.t];
      if (M) loadModel(M.file).then((src) => {
        if (!root.parent && !objMeshes.has(o)) return;
        const m = src.clone(true); const bb = new THREE.Box3().setFromObject(m); const sz = bb.getSize(new THREE.Vector3());
        let s = Math.min((w * 0.98) / Math.max(sz.x, 0.01), (M.depth || 0.98) / Math.max(sz.z, 0.01)); if (M.h) s = Math.min(s, M.h / sz.y); s = Math.min(s, 1.15);
        m.scale.setScalar(s); m.rotation.y = M.yaw || 0; m.position.y = M.onStand || 0;
        const holder = new THREE.Group(); holder.add(m);
        inner.remove(proc);
        if (M.onStand) { const stand = o.t === "tv" ? box(0.9, M.onStand, 0.5, 0x5a3a22, 0, 0, 0) : box(0.5, M.onStand, 0.5, 0x8a5a34, 0, 0, 0); inner.add(stand); }
        inner.add(holder); root.userData.model = true;
        if (o.t === "lamp") { const sh = new THREE.Object3D(); sh.name = "shade"; sh.position.y = M.onStand + 0.5; inner.add(sh); }
      }).catch(() => {});
      scene.add(root);
      return root;
    }

    // ---------- door frames (wall gaps inside the house) ----------
    const trimM = mat(0xf4f1ea, { roughness: 0.5 }), baseM = mat(0x6a4a30, { roughness: 0.6 });
    function doorFrame(x, z, horiz) {
      const g = new THREE.Group();
      const post = (o) => { const p = new THREE.Mesh(keep(new THREE.BoxGeometry(horiz ? 0.08 : WALL_T + 0.06, 2.15, horiz ? WALL_T + 0.06 : 0.08)), trimM); p.position.set(horiz ? o : 0, 1.075, horiz ? 0 : o); p.castShadow = true; g.add(p); };
      post(-0.46); post(0.46);
      const lin = new THREE.Mesh(keep(new THREE.BoxGeometry(horiz ? 1 : WALL_T + 0.06, 0.1, horiz ? WALL_T + 0.06 : 1)), trimM); lin.position.y = 2.15; g.add(lin);
      const above = new THREE.Mesh(keep(new THREE.BoxGeometry(horiz ? 1 : WALL_T, WALL_H - 2.2, horiz ? WALL_T : 1)), inMat); above.position.y = 2.2 + (WALL_H - 2.2) / 2; g.add(above);
      g.position.set(x, 0, z); scene.add(g);
      walls.push({ m: g, mid: new THREE.Vector2(x, z), exterior: false, h: WALL_H, isFrame: true });
    }
    for (let y = HOUSE.y0; y <= HOUSE.y1 + 1; y++) for (let x = HOUSE.x0; x <= HOUSE.x1; x++) if (hWall[y] && !hWall[y][x] && hWall[y][x - 1] && hWall[y][x + 1]) doorFrame(x + 0.5, y, true);
    for (let y = HOUSE.y0; y <= HOUSE.y1; y++) for (let x = HOUSE.x0; x <= HOUSE.x1 + 1; x++) if (vWall[y] && !vWall[y][x] && vWall[y - 1] && vWall[y - 1][x] && vWall[y + 1] && vWall[y + 1][x]) doorFrame(x, y + 0.5, false);
    // baseboards along every wall
    walls.slice().forEach((w) => { if (w.isFrame) return; const p = w.m.geometry.parameters; const bb = new THREE.Mesh(keep(new THREE.BoxGeometry(p.width + 0.02, 0.1, p.depth + 0.02)), baseM); bb.position.set(w.m.position.x, 0.05, w.m.position.z); scene.add(bb); });
    // front door (a real door panel in the front gap)
    for (let x = HOUSE.x0; x <= HOUSE.x1; x++) if (!hWall[HOUSE.y1 + 1][x] && hWall[HOUSE.y1 + 1][x - 1]) { const d = new THREE.Mesh(keep(new THREE.BoxGeometry(0.06, 2.1, 0.86)), mat(0x7a2a1a, { roughness: 0.5 })); d.geometry.translate(0, 1.05, 0); d.position.set(x + 0.08, 0, HOUSE.y1 + 1 + 0.45); d.rotation.y = -0.2; d.castShadow = true; scene.add(d); walls.push({ m: d, mid: new THREE.Vector2(x + 0.5, HOUSE.y1 + 1), exterior: true, h: WALL_H, isFrame: true }); }

    // ---------- rug and paintings ----------
    const rugT = texture((g, s) => { g.fillStyle = "#8a2a2a"; g.fillRect(0, 0, s, s); g.strokeStyle = "#e8c47a"; g.lineWidth = s / 24; g.strokeRect(s / 12, s / 12, s * 10 / 12, s * 10 / 12); g.strokeStyle = "#2a3a6a"; g.lineWidth = s / 40; g.strokeRect(s / 6, s / 6, s * 4 / 6, s * 4 / 6); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? "#e8c47a" : "#2a3a6a"; g.beginPath(); g.arc(s / 2, s / 2, s / 4 - i * s / 30, 0, 7); g.fill(); } }, 256);
    const liv = ROOMS.find((r) => r.id === "liv");
    if (liv) { const rug = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.6, 1.8)), mat(0xffffff, { map: rugT, roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(liv.x0 + 2, 0.016, liv.y0 + 1.9); rug.receiveShadow = true; scene.add(rug); }
    const art = [
      (g, s) => { g.fillStyle = "#f3e7c9"; g.fillRect(0, 0, s, s); g.fillStyle = "#e8505b"; g.beginPath(); g.arc(s * 0.35, s * 0.4, s * 0.22, 0, 7); g.fill(); g.fillStyle = "#2a5aa0"; g.fillRect(s * 0.5, s * 0.45, s * 0.35, s * 0.4); g.fillStyle = "#f6b33c"; g.fillRect(s * 0.15, s * 0.7, s * 0.3, s * 0.12); },
      (g, s) => { const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, "#f6a35a"); gr.addColorStop(0.55, "#f3d27a"); gr.addColorStop(0.56, "#3a6a8a"); gr.addColorStop(1, "#1f3a5a"); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.fillStyle = "#fff4c0"; g.beginPath(); g.arc(s * 0.5, s * 0.52, s * 0.12, Math.PI, 0); g.fill(); },
      (g, s) => { g.fillStyle = "#dfe8d8"; g.fillRect(0, 0, s, s); g.fillStyle = "#4a7a3a"; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(s * 0.5, s * 0.55, s * 0.08, s * 0.3, i * 0.6 - 1.2, 0, 7); g.fill(); } g.fillStyle = "#b4673a"; g.fillRect(s * 0.4, s * 0.75, s * 0.2, s * 0.2); },
    ];
    let artI = 0;
    walls.forEach((w, i) => {
      if (w.isFrame || w.win || i % 4 !== 2) return;
      const p = w.m.geometry.parameters, horiz = p.depth === WALL_T; if ((horiz ? p.width : p.depth) < 0.9) return;
      // hang on the side facing the room the wall belongs to
      const n = horiz ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const side = w.exterior ? (horiz ? (w.mid.y === HOUSE.y0 ? 1 : -1) : (w.mid.x === HOUSE.x0 ? 1 : -1)) : 1;
      const tx = texture(art[artI++ % art.length], 128);
      const pic = new THREE.Group(); pic.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.64, 0.5, 0.03)), mat(0x3a2a1a))); const canvasM = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.56, 0.42)), mat(0xffffff, { map: tx, roughness: 0.9 })); canvasM.position.z = 0.017; pic.add(canvasM);
      pic.position.set(w.mid.x + n.x * side * (WALL_T / 2 + 0.02), 1.55, w.mid.y + n.z * side * (WALL_T / 2 + 0.02)); pic.lookAt(pic.position.x + n.x * side, 1.55, pic.position.z + n.z * side);
      scene.add(pic); w.art = pic;
    });

    // ---------- neighborhood: trees, streetlights, neighbor houses ----------
    const trunkM = mat(0x6a4a2e, { roughness: 1 }), leafMs = [mat(0x3f7f2e, { roughness: 0.9, flatShading: true }), mat(0x4f8f36, { roughness: 0.9, flatShading: true }), mat(0x356b28, { roughness: 0.9, flatShading: true })];
    const blobGeo = keep(new THREE.IcosahedronGeometry(1, 1)), trunkGeo = keep(new THREE.CylinderGeometry(0.12, 0.18, 1, 7));
    function tree(x, z, sz, kind) {
      const g = new THREE.Group(); sz = sz || 1;
      const tr = new THREE.Mesh(trunkGeo, trunkM); tr.scale.set(sz, 2.2 * sz, sz); tr.position.y = 1.1 * sz; tr.castShadow = true; g.add(tr);
      if (kind === "pine") { for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(keep(new THREE.ConeGeometry((1.4 - i * 0.28) * sz, 1.4 * sz, 8)), leafMs[2]); c.position.y = (1.6 + i * 0.75) * sz; c.castShadow = true; g.add(c); } }
      else for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(blobGeo, leafMs[i % 3]); const a = i * 1.7; b.scale.setScalar((0.75 + (i % 3) * 0.15) * sz); b.position.set(Math.cos(a) * 0.6 * sz, (2.6 + (i % 2) * 0.6) * sz, Math.sin(a) * 0.6 * sz); b.castShadow = true; g.add(b); }
      g.position.set(x, 0, z); g.rotation.y = x * 1.3; scene.add(g); return g;
    }
    [[-1.4, 1.2, 1.1], [LW + 1.4, 2.5, 1.2, "pine"], [LW + 2.2, 9.5, 0.9], [-1.6, 9, 1.15, "pine"], [0.6, LH - 2.7, 0.55], [5, -2.2, 1.3, "pine"], [10.5, -2.6, 1.2], [-6, 4, 1.4], [LW + 6, 6, 1.3, "pine"], [-4, 14, 0.9], [LW + 4, LH - 1, 1]].forEach((t) => tree(t[0], t[1], t[2], t[3]));
    const bulbs = [];
    [2, 13].forEach((x) => { const p = new THREE.Group(); p.add(cyl(0.05, 0.07, 3.6, 0x3a3d44, 0, 0, 0)); const arm = box(0.7, 0.06, 0.06, 0x3a3d44, 0.3, 3.55, 0); p.add(arm); const b = new THREE.Mesh(keep(new THREE.SphereGeometry(0.13, 10, 8)), keep(new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd890, emissiveIntensity: 0 }))); b.position.set(0.6, 3.45, 0); p.add(b); bulbs.push(b); p.position.set(x, 0, LH - 1.1); p.rotation.y = Math.PI / 2; scene.add(p); });
    // neighbor houses across the street and next door use the house model
    if (loader) loadModel("house.glb").then((src) => {
      [[LW / 2 - 7, LH + 12.5, Math.PI], [LW / 2 + 9, LH + 12.5, Math.PI], [-12, LH / 2 - 1, Math.PI / 2]].forEach(([x, z, ry]) => {
        const h = src.clone(true); h.scale.setScalar(0.72); h.rotation.y = ry; h.position.set(x, 0, z); scene.add(h);
        h.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
      });
      [[LW / 2 - 7, LH + 6], [LW / 2 + 9, LH + 6]].forEach(([x, z]) => plane(1.2, 3.5, mat(0xc4c4bc), x, z, 0.006));
    }).catch(() => {});

    // ---------- Sims ----------
    const simMeshes = new Map();
    function simMat(c) { return keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(c || "#888"), roughness: 0.7 })); }
    function buildSim(e) {
      const g = new THREE.Group(); g.userData.ent = e;
      const F = e.gender === "F";
      const skin = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(e.skin || "#e8b48a"), roughness: 0.6, emissive: new THREE.Color(e.skin || "#e8b48a"), emissiveIntensity: 0.16 })), shirt = simMat(e.shirt), pants = simMat(e.pants), hair = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(e.hair || "#333"), roughness: 0.55 })), shoe = keep(new THREE.MeshStandardMaterial({ color: 0x2a2626, roughness: 0.5 }));
      const white = simMat("#f8f8f6"), iris = simMat(["#5a3a22", "#3a6a9a", "#4a7a3a", "#6a4a2a"][((e.name || "x").charCodeAt(0) || 0) % 4]), dark = simMat("#141414"), lip = simMat(F ? "#c0625e" : "#a8605a");
      const part = (geo, m, x, y, z) => { const me = new THREE.Mesh(keep(geo), m); me.position.set(x || 0, y || 0, z || 0); me.castShadow = true; me.userData.ent = e; return me; };
      const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg || 16);
      const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips);
      // pelvis + torso (smooth lathe shapes)
      { const pel = part(lathe(F ? [[0, -0.07], [0.12, -0.065], [0.15, 0.0], [0.145, 0.1], [0, 0.1]] : [[0, -0.07], [0.115, -0.065], [0.14, 0.0], [0.14, 0.1], [0, 0.1]]), pants); pel.scale.z = 0.72; hips.add(pel); }
      const torsoPts = F ? [[0, 0.08], [0.145, 0.08], [0.13, 0.2], [0.145, 0.3], [0.16, 0.38], [0.15, 0.46], [0.07, 0.53], [0, 0.53]] : [[0, 0.08], [0.15, 0.08], [0.155, 0.22], [0.175, 0.36], [0.19, 0.45], [0.12, 0.52], [0, 0.53]];
      const torso = part(lathe(torsoPts), shirt); torso.scale.z = F ? 0.78 : 0.72; hips.add(torso);
      const chest = new THREE.Group(); chest.position.y = 0.5; hips.add(chest);
      chest.add(part(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), skin, 0, 0.05, 0));
      const collar = part(new THREE.TorusGeometry(0.06, 0.018, 6, 14), shirt, 0, 0.02, 0); collar.rotation.x = Math.PI / 2; chest.add(collar);
      // head
      const head = new THREE.Group(); head.position.y = 0.21; chest.add(head);
      const skull = part(new THREE.SphereGeometry(0.115, 20, 16), skin); skull.scale.set(F ? 0.92 : 0.95, 1.08, 1); head.add(skull);
      const jaw = part(new THREE.SphereGeometry(0.085, 14, 10), skin, 0, -0.055, 0.025); jaw.scale.set(F ? 0.95 : 1.05, 0.8, 0.95); head.add(jaw);
      { const nose = part(new THREE.SphereGeometry(0.02, 10, 8), skin, 0, -0.012, 0.112); nose.scale.set(0.8, 1.2, 1); head.add(nose); }
      [-1, 1].forEach((sd) => {
        { const ear = part(new THREE.SphereGeometry(0.025, 8, 6), skin, sd * 0.108, -0.005, 0); ear.scale.set(0.5, 1, 0.8); head.add(ear); } // ears
        const eye = part(new THREE.SphereGeometry(0.021, 12, 8), white, sd * 0.042, 0.018, 0.093); eye.scale.z = 0.6; head.add(eye);
        head.add(part(new THREE.SphereGeometry(0.012, 10, 8), iris, sd * 0.042, 0.018, 0.106));
        head.add(part(new THREE.SphereGeometry(0.006, 6, 6), dark, sd * 0.042, 0.018, 0.115));
        const brow = part(new THREE.BoxGeometry(0.04, 0.008, 0.01), hair, sd * 0.042, 0.05, 0.104); brow.rotation.z = sd * (F ? -0.12 : -0.05); head.add(brow);
      });
      const lids = new THREE.Group(); [-1, 1].forEach((sd) => { const l = part(new THREE.SphereGeometry(0.023, 10, 8), skin, sd * 0.042, 0.018, 0.097); l.scale.z = 0.62; lids.add(l); }); lids.visible = false; head.add(lids);
      const mouth = part(new THREE.CapsuleGeometry(0.008, 0.03, 4, 8), lip, 0, -0.058, 0.105); mouth.rotation.z = Math.PI / 2; head.add(mouth);
      // hair styles
      const style = ((e.name || "").length + (F ? 3 : 0)) % 3;
      const cap = part(new THREE.SphereGeometry(0.124, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), hair, 0, 0.006, -0.004); cap.scale.set(F ? 0.96 : 0.99, 1.1, 1.04); head.add(cap);
      const backHair = part(new THREE.SphereGeometry(0.124, 20, 12, Math.PI, Math.PI, 0, Math.PI * (F ? 0.72 : 0.56)), hair, 0, 0.006, -0.006); backHair.scale.set(F ? 0.96 : 0.99, 1.1, 1.06); head.add(backHair);
      if (F) {
        if (style === 0) { const back = part(new THREE.CapsuleGeometry(0.1, 0.18, 6, 12), hair, 0, -0.12, -0.05); back.scale.set(1.1, 1, 0.6); head.add(back); }       // long hair
        else if (style === 1) { const bob = part(new THREE.SphereGeometry(0.135, 18, 12, Math.PI * 0.92, Math.PI * 1.16, 0, Math.PI * 0.74), hair, 0, -0.005, -0.012); bob.scale.set(1.02, 1.05, 1.05); head.add(bob); }  // bob
        else { const pt = part(new THREE.CapsuleGeometry(0.035, 0.16, 4, 10), hair, 0, -0.07, -0.13); pt.rotation.x = 0.35; head.add(pt); head.add(part(new THREE.SphereGeometry(0.045, 10, 8), hair, 0, 0.03, -0.11)); } // ponytail
        const fringe = part(new THREE.SphereGeometry(0.125, 16, 6, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.18, Math.PI * 0.16), hair, 0, 0.008, 0.004); fringe.scale.set(0.97, 1.1, 1.06); head.add(fringe);
      } else {
        if (style === 1) { const quiff = part(new THREE.CapsuleGeometry(0.05, 0.08, 4, 10), hair, 0.01, 0.1, 0.05); quiff.rotation.z = Math.PI / 2; head.add(quiff); }
        if (style === 2) { [-1, 1].forEach((sd) => head.add(part(new THREE.BoxGeometry(0.02, 0.06, 0.06), hair, sd * 0.112, 0.02, 0.02))); }  // sideburns
      }
      // limbs: capsules with elbows/knees, hands and shoes
      const limb = (r, len, m) => { const p = new THREE.Group(); p.add(part(new THREE.CapsuleGeometry(r, len - r * 2, 4, 10), m, 0, -len / 2, 0)); return p; };
      const sh = F ? 0.175 : 0.2;
      const armL = limb(0.045, 0.3, shirt), armR = limb(0.045, 0.3, shirt); armL.position.set(-sh, 0.45, 0); armR.position.set(sh, 0.45, 0); hips.add(armL, armR);
      const foreL = limb(0.037, 0.28, skin), foreR = limb(0.037, 0.28, skin); foreL.position.y = -0.3; foreR.position.y = -0.3; armL.add(foreL); armR.add(foreR);
      [foreL, foreR].forEach((f) => { const hand = part(new THREE.SphereGeometry(0.042, 10, 8), skin, 0, -0.3, 0.005); hand.scale.set(0.75, 1.15, 0.5); f.add(hand); });
      const legL = limb(F ? 0.068 : 0.072, 0.45, pants), legR = limb(F ? 0.068 : 0.072, 0.45, pants); legL.position.set(-0.085, 0, 0); legR.position.set(0.085, 0, 0); hips.add(legL, legR);
      const shinL = limb(0.055, 0.45, pants), shinR = limb(0.055, 0.45, pants); shinL.position.y = -0.45; shinR.position.y = -0.45; legL.add(shinL); legR.add(shinR);
      [shinL, shinR].forEach((sn) => { const sho = part(new THREE.CapsuleGeometry(0.045, 0.12, 4, 10), shoe, 0, -0.465, 0.05); sho.rotation.x = Math.PI / 2; sho.scale.set(1, 1, 0.7); sn.add(sho); });
      g.userData.rig = { hips, chest, head, armL, armR, foreL, foreR, legL, legR, shinL, shinR, torso, lids };
      g.userData.blink = 2 + Math.random() * 3;
      g.userData.look = [e.skin, e.shirt, e.pants, e.hair, e.gender].join("|");
      g.scale.setScalar(e.scale || 1);
      scene.add(g);
      return g;
    }
    // plumbob (hexagonal bipyramid, same proportions as the credited model)
    const bobGeo = keep(new THREE.CylinderGeometry(0, 0.09, 0.18, 6)); const bobGeo2 = keep(new THREE.CylinderGeometry(0.09, 0, 0.18, 6));
    const bobMat = keep(new THREE.MeshStandardMaterial({ color: 0x3be36a, emissive: 0x1a8a30, emissiveIntensity: 0.6, roughness: 0.25, flatShading: true, transparent: true, opacity: 0.92 }));
    const bob = new THREE.Group(); const b1 = new THREE.Mesh(bobGeo, bobMat), b2 = new THREE.Mesh(bobGeo2, bobMat); b1.position.y = 0.09; b2.position.y = -0.09; bob.add(b1, b2); scene.add(bob);
    // ghost for buy mode
    let ghost = null, ghostKey = "";
    const ghostOk = keep(new THREE.MeshBasicMaterial({ color: 0x3cdc5a, transparent: true, opacity: 0.35 })), ghostBad = keep(new THREE.MeshBasicMaterial({ color: 0xe63c3c, transparent: true, opacity: 0.4 }));
    const ghostTile = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), ghostOk); ghostTile.rotation.x = -Math.PI / 2; ghostTile.position.y = 0.03; ghostTile.visible = false; scene.add(ghostTile);
    // hover tile
    const hoverTile = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.96, 0.96)), keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }))); hoverTile.rotation.x = -Math.PI / 2; hoverTile.position.y = 0.025; hoverTile.visible = false; scene.add(hoverTile);
    // carpool
    const car = new THREE.Group(); car.add(box(2.4, 0.7, 1.1, 0xe6c22a, 0, 0.25, 0)); car.add(box(1.4, 0.5, 1, 0x9ad0e6, -0.1, 0.95, 0, { roughness: 0.1 })); [[-0.8, 0.55], [0.8, 0.55], [-0.8, -0.55], [0.8, -0.55]].forEach(([x, z]) => { const wh = cyl(0.25, 0.25, 0.15, 0x222, x, 0.0, z); wh.rotation.x = Math.PI / 2; wh.position.y = 0.25; car.add(wh); }); car.visible = false; scene.add(car);

    // ---------- camera control ----------
    const cam = { tx: houseC.x, tz: houseC.y + 1, ty: 0.6, yaw: Math.PI / 4, pitch: 0.82, dist: 21, yawTarget: Math.PI / 4 };
    let W = 1, H = 1;
    function placeCamera() {
      cam.yaw += (cam.yawTarget - cam.yaw) * 0.18;
      const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      camera.position.set(cam.tx + Math.sin(cam.yaw) * cp * cam.dist, sp * cam.dist + Math.max(0, Math.min(1, (12 - cam.dist) / 8)) * 0.9, cam.tz + Math.cos(cam.yaw) * cp * cam.dist);
      const near = Math.max(0, Math.min(1, (12 - cam.dist) / 8)); camera.lookAt(cam.tx, cam.ty + near * 0.8, cam.tz);
    }
    function resize(w, h) { W = Math.max(1, w); H = Math.max(1, h); renderer.setSize(W, H, false); canvas.style.width = W + "px"; canvas.style.height = H + "px"; camera.aspect = W / H; camera.updateProjectionMatrix(); }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmpV = new THREE.Vector3();
    function cellAt(mx, my) { ndc.set(mx / W * 2 - 1, -(my / H) * 2 + 1); ray.setFromCamera(ndc, camera); const p = ray.ray.intersectPlane(groundPlane, tmpV); if (!p) return { x: -99, y: -99 }; return { x: Math.floor(p.x), y: Math.floor(p.z) }; }
    function pick(mx, my) {
      ndc.set(mx / W * 2 - 1, -(my / H) * 2 + 1); ray.setFromCamera(ndc, camera);
      const targets = []; simMeshes.forEach((g) => { if (g.visible) targets.push(g); }); objMeshes.forEach((g) => targets.push(g));
      const hits = ray.intersectObjects(targets, true);
      for (const h of hits) { let o = h.object; while (o && !o.userData.ent && !o.userData.obj) o = o.parent; if (o && o.userData.ent) return { ent: o.userData.ent }; if (o && o.userData.obj) return { obj: o.userData.obj }; }
      return { cell: cellAt(mx, my) };
    }
    function project(x, y, h) { tmpV.set(x, h, y).project(camera); return [(tmpV.x + 1) / 2 * W, (1 - tmpV.y) / 2 * H, tmpV.z < 1]; }
    function pan(dx, dy) { const s = cam.dist / 600; const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw); cam.tx = Math.max(-2, Math.min(LW + 2, cam.tx - dx * s * cy - dy * s * sy * 1.3)); cam.tz = Math.max(-2, Math.min(LH + 2, cam.tz + dx * s * sy - dy * s * cy * 1.3)); }
    function focus(x, z, dist) { cam.tx = x; cam.tz = z; if (dist) { cam.dist = dist; cam.pitch = dist < 8 ? 0.45 : 0.82; } }
    function zoom(f) { cam.dist = Math.max(3.5, Math.min(40, cam.dist * f)); cam.pitch = Math.max(0.35, Math.min(cam.pitch, 0.35 + (cam.dist - 3.5) / 12)); if (f > 1) cam.pitch = Math.min(0.82, cam.pitch + 0.03); }
    function rotate(dir) { cam.yawTarget += dir * Math.PI / 2; }
    function orbit(dx, dy) { cam.yawTarget -= dx * 0.008; cam.yaw = cam.yawTarget; cam.pitch = Math.max(0.35, Math.min(1.35, cam.pitch + dy * 0.006)); }
    let wallMode = "cutaway";

    // ---------- per-frame ----------
    let t = 0;
    const footOf = (e) => ({ x: e.fx + 0.5, z: e.fy + 0.5 });
    function poseSim(g, e, info, dt) {
      const r = g.userData.rig; const pose = info.pose; const a = (e.anim || 0) + t * (pose === "dance" ? 8 : 0);
      const walk = pose === "walk", sw = walk ? Math.sin(a * 1.2) * 0.6 : 0;
      r.hips.position.y = 0.92; r.hips.rotation.set(0, 0, 0); r.chest.rotation.set(0, 0, 0); r.head.rotation.set(0, 0, 0);
      r.legL.rotation.set(sw, 0, 0); r.legR.rotation.set(-sw, 0, 0); r.shinL.rotation.set(walk ? Math.max(0, -sw) * 0.9 : 0, 0, 0); r.shinR.rotation.set(walk ? Math.max(0, sw) * 0.9 : 0, 0, 0);
      r.armL.rotation.set(-sw * 0.8, 0, 0.08); r.armR.rotation.set(sw * 0.8, 0, -0.08); r.foreL.rotation.set(-0.15, 0, 0); r.foreR.rotation.set(-0.15, 0, 0);
      if (walk) r.hips.position.y = 0.92 + Math.abs(Math.cos(a * 1.2)) * 0.03;
      if (pose === "stand" || pose === "eat" || pose === "cook") { const br = Math.sin(t * 1.8 + (e.name || "").length) * 0.02; r.chest.rotation.x = br; if (pose !== "stand") { r.armL.rotation.x = -0.9; r.armR.rotation.x = -0.9; r.foreL.rotation.x = -0.6 + Math.sin(t * 6) * 0.2; r.foreR.rotation.x = -0.6 - Math.sin(t * 6) * 0.2; } }
      if (pose === "sit" || pose === "bath") { r.hips.position.y = pose === "bath" ? 0.35 : 0.5; r.legL.rotation.x = r.legR.rotation.x = -1.5; r.shinL.rotation.x = r.shinR.rotation.x = 1.5; r.armL.rotation.x = r.armR.rotation.x = -0.5; r.foreL.rotation.x = r.foreR.rotation.x = -0.6; }
      if (pose === "lie") { r.hips.position.y = 0.62; r.hips.rotation.x = -Math.PI / 2; r.armL.rotation.set(0, 0, 0.1); r.armR.rotation.set(0, 0, -0.1); }
      if (pose === "dance") { r.hips.position.y = 0.92 + Math.abs(Math.sin(a)) * 0.08; r.armL.rotation.set(-2.6 + Math.sin(a) * 0.5, 0, 0.3); r.armR.rotation.set(-2.6 - Math.sin(a) * 0.5, 0, -0.3); r.chest.rotation.y = Math.sin(a * 0.5) * 0.4; r.legL.rotation.x = Math.sin(a) * 0.3; r.legR.rotation.x = -Math.sin(a) * 0.3; }
      // blink every few seconds (eyes closed while sleeping)
      g.userData.blink -= dt || 0.016; let lid = 0.01; if (g.userData.blink < 0.12) lid = 1; if (g.userData.blink < 0) g.userData.blink = 2 + Math.random() * 4;
      if (pose === "lie" && info.sleeping) lid = 1; r.lids.visible = lid > 0.5;
      if (info.talking) { r.armR.rotation.x = -0.5 + Math.sin(t * 5) * 0.4; r.foreR.rotation.x = -0.8; r.head.rotation.x = Math.sin(t * 4) * 0.08; }
    }
    let lastObjs = [];
    function render(st) {
      t += st.dt || 0.016; lastObjs = st.objs;
      placeCamera();
      // sun & sky by game hour
      const hr = st.hour, day = Math.max(0, Math.sin((hr - 6) / 12 * Math.PI));
      const ang = (hr - 6) / 12 * Math.PI;
      sun.position.set(houseC.x + Math.cos(ang) * 18, 4 + Math.max(0, Math.sin(ang)) * 22, houseC.y - 8 + Math.sin(ang) * 4); sun.target.position.set(houseC.x, 0, houseC.y);
      sun.intensity = 0.15 + day * 1.5; sun.color.setHSL(0.1, 0.6, 0.6 + day * 0.35);
      hemi.intensity = 0.15 + day * 0.45;
      const skyDay = new THREE.Color(0x7fb8e0), skyDusk = new THREE.Color(0xe08a5a), skyNight = new THREE.Color(0x0e1a30);
      const sky = day > 0.25 ? skyDay.clone().lerp(skyDusk, Math.max(0, 0.45 - day)) : skyNight.clone().lerp(skyDusk, day * 3);
      scene.background = sky; scene.fog = scene.fog || new THREE.Fog(sky, 40, 90); scene.fog.color.copy(sky);
      const night = day < 0.2; bulbs.forEach((b) => { b.material.emissiveIntensity = night ? 2.2 : 0; });
      // walls: cutaway follows camera direction
      const cd = new THREE.Vector2(Math.sin(cam.yaw), Math.cos(cam.yaw));
      walls.forEach((w) => {
        const rel = w.mid.clone().sub(houseC).dot(cd);
        const want = wallMode === "up" ? WALL_H : wallMode === "down" ? WALL_LOW : (w.exterior ? (rel < 0 ? WALL_H : WALL_LOW) : (rel < -2 ? WALL_H : WALL_LOW));
        w.h += (want - w.h) * 0.25; w.m.scale.y = w.isFrame ? w.h / WALL_H : w.h; if (w.win) w.win.visible = w.h > 1.9; if (w.art) w.art.visible = w.h > 1.9;
      });
      // objects: add/remove/rebuild
      const seen = new Set();
      st.objs.forEach((o) => {
        seen.add(o); const key = o.t + "@" + o.x + "," + o.y + "r" + (o.rot != null ? o.rot : "");
        let rec = objMeshes.get(o);
        if (rec && rec.userData.key !== key) { scene.remove(rec); objMeshes.delete(o); rec = null; }
        if (!rec) { rec = buildObject(o, st.objs); if (rec) { rec.userData.key = key; objMeshes.set(o, rec); } }
      });
      objMeshes.forEach((g, o) => { if (!seen.has(o)) { scene.remove(g); objMeshes.delete(o); } });
      // lamps at night
      let li = 0; lampLights.forEach((l) => { l.intensity = 0; });
      tvLight.intensity = 0;
      st.objs.forEach((o) => {
        const g = objMeshes.get(o); if (!g) return; const d = CAT[o.t];
        if (d.light && li < lampLights.length) { const l = lampLights[li++]; l.position.set(o.x + 0.5, 1.5, o.y + 0.5); l.intensity = night ? 3.2 : 0; g.traverse((m) => { if (m.name === "shade" && m.material && m.material.emissive) m.material.emissiveIntensity = night ? 0.9 : 0; }); }
        if (o.t === "tv" && st.tvOn) { tvLight.position.set(o.x + 0.5, 0.9, o.y + 0.9); tvLight.intensity = 1.5 + Math.random() * 0.6; }
        const blanket = g.getObjectByName("blanket"); if (blanket) blanket.visible = true;
      });
      // sims
      const seenE = new Set();
      st.ents.forEach((info) => {
        const e = info.e; seenE.add(e);
        let g = simMeshes.get(e);
        const look = [e.skin, e.shirt, e.pants, e.hair, e.gender].join("|");
        if (g && g.userData.look !== look) { scene.remove(g); simMeshes.delete(e); g = null; }
        if (!g) { g = buildSim(e); simMeshes.set(e, g); }
        g.visible = !info.hidden;
        if (!g.visible) return;
        const x = info.x + 0.5, z = info.y + 0.5;
        const px = g.userData.px, pz = g.userData.pz;
        if (px != null && (Math.abs(x - px) + Math.abs(z - pz)) > 0.001) g.userData.yaw = Math.atan2(x - px, z - pz);
        if (info.face != null) g.userData.yaw = info.face;
        g.userData.px = x; g.userData.pz = z;
        const cy = g.rotation.y, ty = g.userData.yaw || 0; let dy = ty - cy; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; g.rotation.y = cy + dy * 0.25;
        g.position.set(x, info.lift || 0, z);
        poseSim(g, e, info, st.dt);
        if (info.lie) { g.rotation.y = info.lieYaw; }
      });
      simMeshes.forEach((g, e) => { if (!seenE.has(e)) { scene.remove(g); simMeshes.delete(e); } });
      // plumbob above the player
      const pl = st.ents.find((i) => i.e.player && !i.hidden);
      bob.visible = !!pl;
      if (pl) { const g = simMeshes.get(pl.e); const hy = pl.pose === "lie" ? 1.3 : pl.pose === "sit" ? 1.75 : 2.2; bob.position.set(pl.x + 0.5, hy * (pl.e.scale || 1) + Math.sin(t * 2.4) * 0.04, pl.y + 0.5); bob.rotation.y += 0.03; const hue = (st.mood + 100) / 200 * 0.33; bobMat.color.setHSL(hue, 0.85, 0.5); bobMat.emissive.setHSL(hue, 0.9, 0.25); }
      // buy ghost + hover
      if (st.ghost) { const d = CAT[st.ghost.t]; ghostTile.visible = true; ghostTile.material = st.ghost.ok ? ghostOk : ghostBad; ghostTile.scale.set(d.w || 1, 1, 1); ghostTile.position.set(st.ghost.x + (d.w || 1) / 2, 0.03, st.ghost.y + 0.5);
        const gk = st.ghost.t; if (ghostKey !== gk) { if (ghost) scene.remove(ghost); ghost = procedural(gk, d.w || 1); ghost.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.55; disposables.push(m.material); } }); scene.add(ghost); ghostKey = gk; }
        ghost.visible = true; ghost.position.set(st.ghost.x + (d.w || 1) / 2, 0, st.ghost.y + 0.5); ghost.rotation.y = (d.w > 1 ? (st.ghost.rot % 2 ? 2 : st.ghost.rot) : st.ghost.rot || 0) * Math.PI / 2;
      } else { ghostTile.visible = false; if (ghost) ghost.visible = false; }
      if (st.hover && !st.ghost) { hoverTile.visible = true; hoverTile.position.set(st.hover.x + 0.5, 0.025, st.hover.y + 0.5); } else hoverTile.visible = false;
      car.visible = !!st.carpool; if (car.visible) car.position.set(8.5, 0, LH + 0.6);
      renderer.render(scene, camera);
    }
    function dispose() {
      renderer.dispose(); disposables.forEach((d) => { try { d.dispose(); } catch (e) {} });
      Object.values(TEX).forEach((tx) => tx.dispose());
      canvas.remove();
    }
    return { canvas, resize, render, pick, yawOf: (o) => facing(o, lastObjs), cellAt, project, pan, zoom, rotate, orbit, focus, setWallMode: (m) => { wallMode = m; }, get wallMode() { return wallMode; }, dispose, scene, camera };
  }
  window.Sims3DView = { create, MODELS };
})();
