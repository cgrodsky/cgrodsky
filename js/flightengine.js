/* FlightEngine — a real-ish 3D flight simulator engine built on the loaded Three.js.
   Systems: aerodynamics (lift/drag/thrust/AoA/stall), procedural terrain, day/night
   sky, clouds, wind & turbulence, a glass cockpit (artificial horizon + tapes),
   autopilot (HDG/ALT/SPD), multiple aircraft, and four camera modes. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function svg(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ------------------------------------------------------------------ value noise (terrain)
  function makeNoise(seed) {
    const p = new Uint8Array(512); const perm = [];
    let s = seed >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const grad = (h, x, y) => { const u = (h & 1) ? x : -x, v = (h & 2) ? y : -y; return u + v; };
    function noise(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const a = p[X] + Y, b = p[X + 1] + Y;
      return lerp(lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u), lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u), v);
    }
    return function fbm(x, y) { let f = 0, amp = 0.5, freq = 1; for (let o = 0; o < 5; o++) { f += amp * noise(x * freq, y * freq); freq *= 2; amp *= 0.5; } return f; };
  }

  // ------------------------------------------------------------------ aircraft catalog
  // mass (kg), S wing area (m^2), thrust (N), clSlope per rad, clMax, cd0, name, model builder
  function AIRCRAFT(T) {
    const mat = (c, m, r) => new T.MeshStandardMaterial({ color: c, metalness: m == null ? 0.3 : m, roughness: r == null ? 0.5 : r });
    function b707() {
      const g = new T.Group(); const white = mat(0xf2f4f7), blue = mat(0x1e5fa8), dark = mat(0x26262b, 0.6, 0.4);
      const fus = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 46, 22), white); fus.rotation.x = Math.PI / 2; g.add(fus);
      const nose = new T.Mesh(new T.SphereGeometry(2.2, 18, 12), white); nose.position.z = 23; nose.scale.z = 1.9; g.add(nose);
      const cone = new T.Mesh(new T.ConeGeometry(2.2, 6, 18), white); cone.rotation.x = -Math.PI / 2; cone.position.z = -25; g.add(cone);
      const stripe = new T.Mesh(new T.CylinderGeometry(2.24, 2.24, 40, 22, 1, true), blue); stripe.rotation.x = Math.PI / 2; stripe.scale.y = 0.16; stripe.position.y = 0.75; g.add(stripe);
      const wingGeo = new T.BoxGeometry(36, 0.7, 7);
      const wl = new T.Mesh(wingGeo, white); wl.position.set(-16, -0.6, -2); wl.rotation.y = 0.34; g.add(wl);
      const wr = new T.Mesh(wingGeo, white); wr.position.set(16, -0.6, -2); wr.rotation.y = -0.34; g.add(wr);
      const fin = new T.Mesh(new T.BoxGeometry(0.7, 9, 7), blue); fin.position.set(0, 5, -22); fin.rotation.x = 0.32; g.add(fin);
      const hs = new T.Mesh(new T.BoxGeometry(17, 0.6, 4), white); hs.position.set(0, 1.6, -23); g.add(hs);
      [[-9, 0], [-16, 2], [9, 0], [16, 2]].forEach(([x, z]) => { const e = new T.Mesh(new T.CylinderGeometry(1.5, 1.4, 6, 16), dark); e.rotation.x = Math.PI / 2; e.position.set(x, -2.6, z + 1); g.add(e); });
      return g;
    }
    function cessna() {
      const g = new T.Group(); const body = mat(0xdfe6ee), red = mat(0xc0392b), dark = mat(0x333);
      const fus = new T.Mesh(new T.CylinderGeometry(1.2, 0.6, 16, 14), body); fus.rotation.x = Math.PI / 2; g.add(fus);
      const nose = new T.Mesh(new T.ConeGeometry(1.2, 3, 14), body); nose.rotation.x = -Math.PI / 2; nose.position.z = 9; g.add(nose);
      const wing = new T.Mesh(new T.BoxGeometry(22, 0.5, 4), body); wing.position.set(0, 2.2, 2); g.add(wing);
      const strut1 = new T.Mesh(new T.BoxGeometry(0.2, 2.4, 0.2), dark); strut1.position.set(-4, 1, 2); strut1.rotation.z = 0.4; g.add(strut1);
      const fin = new T.Mesh(new T.BoxGeometry(0.4, 4, 3), red); fin.position.set(0, 2.4, -7); g.add(fin);
      const hs = new T.Mesh(new T.BoxGeometry(9, 0.4, 2.5), body); hs.position.set(0, 0.6, -7); g.add(hs);
      const prop = new T.Mesh(new T.BoxGeometry(6, 0.3, 0.3), dark); prop.position.z = 10.5; g.add(prop); g.userData.prop = prop;
      return g;
    }
    function a320() {
      const g = new T.Group(); const white = mat(0xf5f7fa), navy = mat(0x18306b), grey = mat(0x2a2a30, 0.6, 0.4);
      const fus = new T.Mesh(new T.CylinderGeometry(2.4, 2.4, 44, 22), white); fus.rotation.x = Math.PI / 2; g.add(fus);
      const nose = new T.Mesh(new T.SphereGeometry(2.4, 18, 12), white); nose.position.z = 22; nose.scale.z = 1.7; g.add(nose);
      const wl = new T.Mesh(new T.BoxGeometry(34, 0.7, 8), white); wl.position.set(-15, -0.8, -1); wl.rotation.y = 0.28; g.add(wl);
      const wr = new T.Mesh(new T.BoxGeometry(34, 0.7, 8), white); wr.position.set(15, -0.8, -1); wr.rotation.y = -0.28; g.add(wr);
      const fin = new T.Mesh(new T.BoxGeometry(0.8, 10, 7), navy); fin.position.set(0, 6, -21); g.add(fin);
      const hs = new T.Mesh(new T.BoxGeometry(15, 0.6, 4), white); hs.position.set(0, 1.4, -22); g.add(hs);
      [[-9], [9]].forEach(([x]) => { const e = new T.Mesh(new T.CylinderGeometry(1.9, 1.7, 7, 16), grey); e.rotation.x = Math.PI / 2; e.position.set(x, -2.8, 1); g.add(e); });
      return g;
    }
    function f16() {
      const g = new T.Group(); const grey = mat(0x9aa2ad, 0.5, 0.5), dark = mat(0x2a2f36);
      const fus = new T.Mesh(new T.CylinderGeometry(1.3, 0.8, 26, 14), grey); fus.rotation.x = Math.PI / 2; g.add(fus);
      const nose = new T.Mesh(new T.ConeGeometry(1.3, 6, 14), grey); nose.rotation.x = -Math.PI / 2; nose.position.z = 16; g.add(nose);
      const canopy = new T.Mesh(new T.SphereGeometry(1.2, 12, 8), new T.MeshStandardMaterial({ color: 0x223, metalness: 0.6, roughness: 0.2 })); canopy.position.set(0, 1, 6); canopy.scale.z = 2; g.add(canopy);
      const wl = new T.Mesh(new T.BoxGeometry(14, 0.4, 8), grey); wl.position.set(-7, -0.2, -3); wl.rotation.y = 0.6; g.add(wl);
      const wr = new T.Mesh(new T.BoxGeometry(14, 0.4, 8), grey); wr.position.set(7, -0.2, -3); wr.rotation.y = -0.6; g.add(wr);
      const fin = new T.Mesh(new T.BoxGeometry(0.4, 5, 5), grey); fin.position.set(0, 3, -11); fin.rotation.x = 0.4; g.add(fin);
      const eng = new T.Mesh(new T.CylinderGeometry(1.3, 1.1, 4, 14), dark); eng.rotation.x = Math.PI / 2; eng.position.z = -14; g.add(eng);
      return g;
    }
    function b747() { // fallback stand-in for the real Air France glTF
      const g = new T.Group(); const white = mat(0xf3f5f8), blue = mat(0x123a86), grey = mat(0x2a2a30, 0.6, 0.4);
      const fus = new T.Mesh(new T.CylinderGeometry(3.2, 3.2, 68, 24), white); fus.rotation.x = Math.PI / 2; g.add(fus);
      const nose = new T.Mesh(new T.SphereGeometry(3.2, 20, 14), white); nose.position.z = 34; nose.scale.z = 1.7; g.add(nose);
      const hump = new T.Mesh(new T.CapsuleGeometry(2.6, 12, 6, 14), white); hump.rotation.x = Math.PI / 2; hump.position.set(0, 2.6, 22); hump.scale.set(1, 0.7, 1); g.add(hump);
      const cone = new T.Mesh(new T.ConeGeometry(3.2, 9, 18), white); cone.rotation.x = -Math.PI / 2; cone.position.z = -37; g.add(cone);
      const wingGeo = new T.BoxGeometry(52, 1.0, 11);
      const wl = new T.Mesh(wingGeo, white); wl.position.set(-24, -1.4, -3); wl.rotation.y = 0.36; g.add(wl);
      const wr = new T.Mesh(wingGeo, white); wr.position.set(24, -1.4, -3); wr.rotation.y = -0.36; g.add(wr);
      const fin = new T.Mesh(new T.BoxGeometry(1.0, 13, 10), blue); fin.position.set(0, 8, -32); fin.rotation.x = 0.34; g.add(fin);
      const hs = new T.Mesh(new T.BoxGeometry(24, 0.9, 6), white); hs.position.set(0, 2.4, -34); g.add(hs);
      [[-13, -1], [-23, 2], [13, -1], [23, 2]].forEach(([x, z]) => { const e = new T.Mesh(new T.CylinderGeometry(2.2, 2.0, 8, 16), grey); e.rotation.x = Math.PI / 2; e.position.set(x, -4, z); g.add(e); });
      return g;
    }
    return [
      { id: "b747", name: "Air France Boeing 747-400", mass: 285000, S: 525, thrust: 1000000, clSlope: 5.6, clMax: 1.5, cd0: 0.021, vRef: 160, model: b747,
        real: { url: "assets/models/b747/scene.gltf", kind: "gltf", len: 70, orient: { x: 0, y: 0, z: 0 } } },
      { id: "b707", name: "Boeing 707-300", mass: 116000, S: 283, thrust: 320000, clSlope: 5.6, clMax: 1.5, cd0: 0.021, vRef: 150, model: b707,
        real: { url: "assets/models/b707.fbx", kind: "fbx", len: 46, orient: { x: 0, y: 0, z: 0 } } },
      { id: "a320", name: "Airbus A320", mass: 68000, S: 122, thrust: 240000, clSlope: 5.8, clMax: 1.6, cd0: 0.022, vRef: 140, model: a320 },
      { id: "c172", name: "Cessna 172", mass: 1100, S: 16, thrust: 4200, clSlope: 5.7, clMax: 1.6, cd0: 0.028, vRef: 55, model: cessna },
      { id: "f16", name: "F-16 Falcon", mass: 12000, S: 28, thrust: 130000, clSlope: 4.8, clMax: 1.2, cd0: 0.018, vRef: 130, model: f16 },
    ];
  }

  // ------------------------------------------------------------------ real model loading (glTF / FBX)
  const _modelCache = {};   // url -> loaded Object3D (original; cloned per use)
  function loadModel(url, kind) {
    if (_modelCache[url]) return Promise.resolve(_modelCache[url]);
    return new Promise((resolve, reject) => {
      const Loader = kind === "fbx" ? window.FBXLoader : window.GLTFLoader;
      if (!Loader) { reject(new Error("loader unavailable: " + kind)); return; }
      new Loader().load(url,
        (res) => { const obj = kind === "fbx" ? res : res.scene; _modelCache[url] = obj; resolve(obj); },
        undefined,
        (err) => reject(err));
    });
  }
  // Center a loaded model at origin, scale it to `len` metres on its longest axis,
  // apply a per-model orientation, and return it wrapped in a clean group whose
  // rotation the engine is free to overwrite each frame.
  function prepReal(T, obj, desc) {
    if (desc.orient) obj.rotation.set(desc.orient.x || 0, desc.orient.y || 0, desc.orient.z || 0);
    obj.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(obj);
    const size = box.getSize(new T.Vector3());
    const center = box.getCenter(new T.Vector3());
    obj.position.sub(center);
    obj.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = o.receiveShadow = false; } });
    const wrap = new T.Group();
    wrap.add(obj);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    wrap.scale.setScalar((desc.len || 40) / longest);
    return wrap;
  }

  // ------------------------------------------------------------------ the engine
  function start(body, opts) {
    opts = opts || {};
    if (typeof THREE === "undefined") { body.innerHTML = `<div style="padding:24px;color:#334">3D engine (Three.js) failed to load. Check your connection and refresh.</div>`; return null; }
    const T = THREE;
    const fleet = AIRCRAFT(T);
    let acIndex = 0;

    body.innerHTML = `<div class="fe">
      <div class="fe-instr"></div>
      <div class="fe-top">
        <div class="fe-tag" id="fe-ac"></div>
        <div class="fe-ap" id="fe-ap"></div>
        <div class="fe-clock" id="fe-clock"></div>
      </div>
      <canvas class="fe-map" width="150" height="150"></canvas>
      <div class="fe-help">Drag = pitch/bank · A/D rudder · W/S or +/- throttle · F flaps · G gear · B brakes · C camera · P plane · 1 AP-ALT 2 AP-HDG 3 AP-SPD · R reset</div>
      <div class="fe-touch">
        <button class="fe-b" data-k="thrUp">▲ THR</button><button class="fe-b" data-k="thrDn">▼ THR</button>
        <button class="fe-b" data-k="flaps">FLAPS</button><button class="fe-b" data-k="gear">GEAR</button>
        <button class="fe-b" data-k="cam">CAM</button><button class="fe-b" data-k="reset">RESET</button>
      </div>
      <div class="fe-warn" id="fe-warn"></div>
      <div class="fe-load" id="fe-load"></div>
    </div>`;
    const host = body.querySelector(".fe");
    const instr = host.querySelector(".fe-instr");
    const map = host.querySelector(".fe-map").getContext("2d");
    const warnEl = host.querySelector("#fe-warn");
    const loadEl = host.querySelector("#fe-load");
    const setLoad = (msg) => { loadEl.textContent = msg || ""; loadEl.classList.toggle("on", !!msg); };

    // ---- scene ----
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(62, 1, 0.6, 12000);
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none";
    host.insertBefore(renderer.domElement, host.firstChild);

    const hemi = new T.HemisphereLight(0xffffff, 0x5a6a45, 1.0); scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff2d8, 1.0); scene.add(sun);
    const sunMesh = new T.Mesh(new T.SphereGeometry(120, 16, 16), new T.MeshBasicMaterial({ color: 0xfff2c0 })); scene.add(sunMesh);
    const moonMesh = new T.Mesh(new T.SphereGeometry(70, 16, 16), new T.MeshBasicMaterial({ color: 0xd8e0ff })); scene.add(moonMesh);

    // stars (for night)
    const starGeo = new T.BufferGeometry(); const starPos = [];
    for (let i = 0; i < 900; i++) { const v = new T.Vector3((Math.random() - 0.5), Math.random() * 0.6 + 0.05, (Math.random() - 0.5)).normalize().multiplyScalar(9000); starPos.push(v.x, v.y, v.z); }
    starGeo.setAttribute("position", new T.Float32BufferAttribute(starPos, 3));
    const stars = new T.Points(starGeo, new T.PointsMaterial({ color: 0xffffff, size: 26, sizeAttenuation: true, transparent: true })); scene.add(stars);

    // ---- terrain (procedural, re-centered around the aircraft for endless flight) ----
    const fbm = makeNoise(1337);
    const TSIZE = 6000, TSEG = 120;
    const terrGeo = new T.PlaneGeometry(TSIZE, TSIZE, TSEG, TSEG);
    terrGeo.rotateX(-Math.PI / 2);
    const terrColors = new Float32Array((TSEG + 1) * (TSEG + 1) * 3);
    terrGeo.setAttribute("color", new T.BufferAttribute(terrColors, 3));
    const terrain = new T.Mesh(terrGeo, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })); scene.add(terrain);
    const water = new T.Mesh(new T.PlaneGeometry(TSIZE * 2, TSIZE * 2), new T.MeshStandardMaterial({ color: 0x2f6ea5, metalness: 0.2, roughness: 0.4, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 6; scene.add(water);
    function elev(x, z) { return Math.max(0, (fbm(x * 0.00035, z * 0.00035) + 0.35) * 900 - 120); }
    function paintTerrain(cx, cz) {
      const pos = terrGeo.attributes.position, col = terrGeo.attributes.color;
      const half = TSIZE / 2;
      for (let i = 0; i <= TSEG; i++) for (let j = 0; j <= TSEG; j++) {
        const idx = i * (TSEG + 1) + j;
        const wx = cx - half + (j / TSEG) * TSIZE, wz = cz - half + (i / TSEG) * TSIZE;
        const h = elev(wx, wz);
        pos.setX(idx, wx - cx); pos.setZ(idx, wz - cz); pos.setY(idx, h);
        let r, g, b;
        if (h < 10) { r = 0.19; g = 0.45; b = 0.55; } else if (h < 120) { r = 0.36; g = 0.55; b = 0.30; }
        else if (h < 340) { r = 0.30; g = 0.46; b = 0.24; } else if (h < 560) { r = 0.42; g = 0.38; b = 0.30; }
        else { const s = clamp((h - 560) / 300, 0, 1); r = lerp(0.45, 0.95, s); g = lerp(0.42, 0.96, s); b = lerp(0.40, 1, s); }
        col.setXYZ(idx, r, g, b);
      }
      pos.needsUpdate = true; col.needsUpdate = true; terrGeo.computeVertexNormals();
    }

    // ---- runway near origin ----
    const runway = new T.Mesh(new T.PlaneGeometry(60, 1400), new T.MeshLambertMaterial({ color: 0x33343a }));
    runway.rotation.x = -Math.PI / 2; runway.position.set(0, elev(0, 0) + 0.6, -300); scene.add(runway);

    // ---- clouds ----
    const cloudMat = new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false });
    const clouds = new T.Group(); scene.add(clouds);
    for (let i = 0; i < 60; i++) {
      const c = new T.Group(); const n = 3 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) { const s = new T.Mesh(new T.SphereGeometry(40 + Math.random() * 60, 8, 6), cloudMat); s.position.set((Math.random() - 0.5) * 160, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 160); c.add(s); }
      c.position.set((Math.random() - 0.5) * 9000, 500 + Math.random() * 900, (Math.random() - 0.5) * 9000); clouds.add(c);
    }

    // ---- aircraft ----
    let plane, spec, loadToken = 0;
    function loadAircraft(i) {
      if (plane) { scene.remove(plane); plane = null; }
      spec = fleet[i];
      host.querySelector("#fe-ac").textContent = spec.name;
      // Procedural stand-in shows instantly and is the permanent fallback if the
      // real model can't be fetched (offline, decode error, missing loader).
      plane = spec.model();
      scene.add(plane);
      if (spec.real) {
        const token = ++loadToken;
        setLoad("Loading " + spec.name + " …");
        loadModel(spec.real.url, spec.real.kind).then((orig) => {
          if (token !== loadToken) return;            // user already switched planes
          const wrap = prepReal(T, orig.clone(true), spec.real);
          if (plane) scene.remove(plane);
          plane = wrap; scene.add(plane);
          setLoad("");
        }).catch((err) => {
          if (token === loadToken) setLoad("");
          console.warn("[FlightEngine] real model failed, using stand-in:", spec.real.url, err);
        });
      } else {
        setLoad("");
      }
    }
    loadAircraft(acIndex);

    // ---- airport stairs at the runway threshold (scenery) ----
    loadModel("assets/models/stairs/scene.gltf", "gltf").then((orig) => {
      const s = orig.clone(true);
      const g = new T.Group(); g.add(s);
      const box = new T.Box3().setFromObject(s);
      const size = box.getSize(new T.Vector3()); const c = box.getCenter(new T.Vector3());
      s.position.sub(c); s.position.y += size.y / 2;             // sit flush on the ground
      g.scale.setScalar(6 / (size.y || 6));                       // ~6 m tall
      g.position.set(34, elev(0, -980) + 0.4, -980);
      s.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      scene.add(g);
    }).catch(() => {});

    // ---- flight state ----
    const st = {};
    function reset() {
      st.pos = new T.Vector3(0, elev(0, -300) + 2, -300);
      st.vel = new T.Vector3(0, 0, -0.1);
      st.heading = 0; st.pitch = 0; st.roll = 0;
      st.throttle = 0.0; st.flaps = 0; st.gear = true; st.brakes = true;
      st.onGround = true; st.crashed = false;
      st.time = 9; // hours (day)
      st.wind = new T.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
      st.ap = { alt: false, hdg: false, spd: false, altTgt: 3000, hdgTgt: 0, spdTgt: 250 };
      warnEl.textContent = ""; warnEl.className = "fe-warn";
    }
    reset();

    // ---- input ----
    const keys = {};
    let camMode = 0; const CAMS = ["Chase", "Cockpit", "Orbit", "Tower"];
    const kh = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys[k] = e.type === "keydown";
      if (e.type === "keydown") {
        if (k === "c") camMode = (camMode + 1) % CAMS.length;
        if (k === "f") st.flaps = st.flaps >= 3 ? 0 : st.flaps + 1;
        if (k === "g") st.gear = !st.gear;
        if (k === "b") st.brakes = !st.brakes;
        if (k === "r") reset();
        if (k === "p") { acIndex = (acIndex + 1) % fleet.length; loadAircraft(acIndex); reset(); }
        if (k === "1") st.ap.alt = !st.ap.alt, st.ap.altTgt = Math.round(st.pos.y * 3.3 / 100) * 100 / 3.3;
        if (k === "2") st.ap.hdg = !st.ap.hdg, st.ap.hdgTgt = st.heading;
        if (k === "3") st.ap.spd = !st.ap.spd, st.ap.spdTgt = st.vel.length() * 1.94;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "+", "-", "=", "w", "s", "a", "d", "c", "f", "g", "b", "r", "p"].includes(k)) e.preventDefault();
    };
    const dom = renderer.domElement; dom.tabIndex = 0;
    dom.addEventListener("keydown", kh); dom.addEventListener("keyup", kh);
    let drag = false, dx = 0, dy = 0, uPitch = 0, uRoll = 0;
    dom.addEventListener("pointerdown", (e) => { drag = true; dx = e.clientX; dy = e.clientY; dom.setPointerCapture(e.pointerId); dom.focus(); });
    dom.addEventListener("pointermove", (e) => { if (!drag) return; uRoll = clamp((e.clientX - dx) / 130, -1, 1); uPitch = clamp((e.clientY - dy) / 130, -1, 1); });
    dom.addEventListener("pointerup", () => { drag = false; uPitch = 0; uRoll = 0; });
    host.querySelectorAll(".fe-b").forEach((b) => b.onpointerdown = () => {
      const k = b.dataset.k;
      if (k === "thrUp") st.throttle = clamp(st.throttle + 0.08, 0, 1);
      else if (k === "thrDn") st.throttle = clamp(st.throttle - 0.08, 0, 1);
      else if (k === "flaps") st.flaps = st.flaps >= 3 ? 0 : st.flaps + 1;
      else if (k === "gear") st.gear = !st.gear;
      else if (k === "cam") camMode = (camMode + 1) % CAMS.length;
      else if (k === "reset") reset();
    });

    // ---- instruments (SVG glass cockpit) ----
    function buildInstruments() {
      const s = svg("svg", { viewBox: "0 0 520 150", class: "fe-instr-svg" }); instr.appendChild(s);
      // Attitude indicator (artificial horizon)
      const cx = 260, cy = 75, R = 62;
      const clip = svg("clipPath", { id: "adiClip" }); clip.appendChild(svg("circle", { cx, cy, r: R })); s.appendChild(clip);
      const adi = svg("g", { "clip-path": "url(#adiClip)" }); s.appendChild(adi);
      const sky = svg("rect", { x: cx - 200, y: cy - 200, width: 400, height: 400, fill: "#3a86d6" }); adi.appendChild(sky);
      const grd = svg("rect", { x: cx - 200, y: cy, width: 400, height: 400, fill: "#8a5a2b" }); adi.appendChild(grd);
      const horizon = svg("line", { x1: cx - 200, y1: cy, x2: cx + 200, y2: cy, stroke: "#fff", "stroke-width": 2 }); adi.appendChild(horizon);
      const adiG = svg("g", {}); adiG.appendChild(sky); adiG.appendChild(grd); adiG.appendChild(horizon);
      // wrap sky/grd/horizon in a group we can rotate/translate
      adi.innerHTML = ""; const rotG = svg("g", {}); adi.appendChild(rotG);
      rotG.appendChild(sky); rotG.appendChild(grd); rotG.appendChild(horizon);
      for (let a = -60; a <= 60; a += 10) { if (!a) continue; const w = a % 30 ? 12 : 26; rotG.appendChild(svg("line", { x1: cx - w, y1: cy - a * 1.3, x2: cx + w, y2: cy - a * 1.3, stroke: "#fff", "stroke-width": 1 })); }
      s.appendChild(svg("circle", { cx, cy, r: R, fill: "none", stroke: "#0a0a0a", "stroke-width": 6 }));
      // fixed aircraft symbol
      const sym = svg("path", { d: `M${cx - 34},${cy} L${cx - 10},${cy} L${cx},${cy + 8} L${cx + 10},${cy} L${cx + 34},${cy}`, fill: "none", stroke: "#ffd23f", "stroke-width": 3 }); s.appendChild(sym);
      s.appendChild(svg("path", { d: `M${cx},${cy - R + 3} l-6,10 l12,0 z`, fill: "#ffd23f" }));
      // airspeed tape (left) + altitude tape (right)
      const tape = (x, label, id) => { s.appendChild(svg("rect", { x, y: 20, width: 58, height: 110, rx: 4, fill: "rgba(8,14,22,.7)", stroke: "#2b3d52" })); const t = svg("text", { x: x + 29, y: 78, "text-anchor": "middle", class: "fe-tape-v", id }); s.appendChild(t); s.appendChild(svg("text", { x: x + 29, y: 122, "text-anchor": "middle", class: "fe-tape-l", }, )).textContent = label; return t; };
      const spd = tape(14, "KTS", "fe-spd"); const alt = tape(448, "ALT", "fe-alt");
      // heading + vsi + throttle text (bottom row via foreignless text)
      s.appendChild(svg("text", { x: cx, y: 145, "text-anchor": "middle", class: "fe-mini", id: "fe-hdg" }));
      s.appendChild(svg("text", { x: 90, y: 145, "text-anchor": "middle", class: "fe-mini", id: "fe-vsi" }));
      s.appendChild(svg("text", { x: 430, y: 145, "text-anchor": "middle", class: "fe-mini", id: "fe-thr" }));
      return { rotG, cx, cy, spdT: spd, altT: alt };
    }
    // simpler tape labels
    const ADI = buildInstruments();
    // fix tape label text nodes (createElementNS text content)
    instr.querySelectorAll(".fe-tape-l").forEach((n, i) => { n.textContent = i === 0 ? "KTS" : "ALT"; });

    function updateInstruments(kts, altFt, hdg, vsi, thr, aoa) {
      instr.querySelector("#fe-spd").textContent = Math.round(kts);
      instr.querySelector("#fe-alt").textContent = Math.round(altFt);
      instr.querySelector("#fe-hdg").textContent = "HDG " + String(Math.round(((hdg * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, "0");
      instr.querySelector("#fe-vsi").textContent = "VSI " + (vsi >= 0 ? "+" : "") + Math.round(vsi);
      instr.querySelector("#fe-thr").textContent = "THR " + Math.round(thr * 100) + "%";
      const p = clamp(st.pitch, -1, 1), r = st.roll;
      ADI.rotG.setAttribute("transform", `rotate(${-r * 57.3} ${ADI.cx} ${ADI.cy}) translate(0 ${p * 90})`);
    }

    // ---- autopilot text ----
    function apText() {
      const a = st.ap; const parts = [];
      if (a.alt) parts.push("ALT " + Math.round(a.altTgt * 3.3));
      if (a.hdg) parts.push("HDG " + String(Math.round((a.hdgTgt * 180 / Math.PI % 360 + 360) % 360)).padStart(3, "0"));
      if (a.spd) parts.push("SPD " + Math.round(a.spdTgt));
      host.querySelector("#fe-ap").textContent = parts.length ? "AP: " + parts.join(" · ") : "AP off";
    }

    // ---- physics ----
    const RHO0 = 1.225, G = 9.81;
    function step(dt) {
      if (st.crashed) return;
      const a = st.ap;
      // control inputs
      let inPitch = uPitch + (keys.ArrowUp ? -1 : 0) + (keys.ArrowDown ? 1 : 0);
      let inRoll = uRoll + (keys.ArrowLeft ? -1 : 0) + (keys.ArrowRight ? 1 : 0);
      let inYaw = (keys.a ? -1 : 0) + (keys.d ? 1 : 0);
      if (keys.w || keys["+"] || keys["="]) st.throttle = clamp(st.throttle + dt * 0.5, 0, 1);
      if (keys.s || keys["-"]) st.throttle = clamp(st.throttle - dt * 0.5, 0, 1);

      const spd = st.vel.length();
      const kts = spd * 1.94384;
      // autopilot overrides
      if (a.hdg) { let e = ((a.hdgTgt - st.heading + Math.PI) % (2 * Math.PI)) - Math.PI; inRoll = clamp(e * 1.2, -0.6, 0.6); }
      if (a.alt) { const altErr = a.altTgt - st.pos.y; inPitch = clamp(-altErr * 0.0006 - st.vel.y * 0.02, -0.5, 0.5); }
      if (a.spd) { const sErr = a.spdTgt / 1.94384 - spd; st.throttle = clamp(st.throttle + sErr * 0.004, 0, 1); }

      // integrate attitude
      st.roll += (inRoll * 0.9 - st.roll) * clamp(dt * 3, 0, 1);
      st.pitch += (inPitch * 0.6 - st.pitch) * clamp(dt * 2.4, 0, 1);
      const turnRate = -Math.sin(st.roll) * (G / Math.max(spd, 30)) * (spd > 20 ? 1 : 0);
      st.heading += (turnRate + inYaw * 0.25) * dt;

      // air density with altitude
      const rho = RHO0 * Math.exp(-st.pos.y / 8500);
      // angle of attack (approx from pitch relative to velocity flight path)
      const fpa = spd > 1 ? Math.asin(clamp(st.vel.y / spd, -1, 1)) : 0;
      let aoa = st.pitch - fpa + (st.flaps * 0.04);
      // lift & drag
      let cl = spec.clSlope * aoa;
      let stalled = false;
      if (cl > spec.clMax) { cl = spec.clMax - (cl - spec.clMax) * 0.8; stalled = true; }
      if (cl < -spec.clMax) { cl = -spec.clMax; }
      const cd = spec.cd0 + cl * cl / (Math.PI * 8 * 0.8) + st.flaps * 0.01 + (st.gear ? 0.02 : 0);
      const q = 0.5 * rho * spd * spd * spec.S;
      const lift = cl * q, drag = cd * q, thrust = st.throttle * spec.thrust * (rho / RHO0);

      // forces in world space
      const fwd = new T.Vector3(Math.sin(st.heading) * Math.cos(st.pitch), Math.sin(st.pitch), -Math.cos(st.heading) * Math.cos(st.pitch)).normalize();
      const up = new T.Vector3(0, 1, 0);
      // lift acts along body-up (approx world-up tilted by roll toward turn)
      const liftDir = new T.Vector3(Math.sin(st.roll) * Math.cos(st.heading + Math.PI / 2), Math.cos(st.roll), Math.sin(st.roll) * Math.sin(st.heading + Math.PI / 2)).normalize();
      const force = new T.Vector3();
      force.addScaledVector(fwd, thrust - drag);
      force.addScaledVector(liftDir, lift);
      force.y -= spec.mass * G;
      force.add(st.wind.clone().multiplyScalar(spec.mass * 0.02)); // wind push
      // turbulence
      if (st.pos.y > 20) force.add(new T.Vector3((Math.random() - 0.5), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5)).multiplyScalar(spec.mass * 0.03));

      const acc = force.multiplyScalar(1 / spec.mass);
      st.vel.addScaledVector(acc, dt);

      // ground handling
      const gh = elev(st.pos.x, st.pos.z);
      if (st.pos.y <= gh + 2.2) {
        st.onGround = true; st.pos.y = gh + 2.2;
        if (st.vel.y < -8 && spd > 40) { crash(); return; }
        st.vel.y = Math.max(0, st.vel.y);
        // rolling friction / brakes
        const fric = st.brakes ? 0.6 : (st.gear ? 0.12 : 0.3);
        st.vel.x -= st.vel.x * fric * dt; st.vel.z -= st.vel.z * fric * dt;
        st.pitch *= 0.9;
      } else st.onGround = false;

      st.pos.addScaledVector(st.vel, dt);

      // warnings
      if (stalled && !st.onGround) { warnEl.textContent = "STALL"; warnEl.className = "fe-warn on"; }
      else if (kts < spec.vRef * 0.7 && !st.onGround && st.pos.y > 30) { warnEl.textContent = "LOW SPEED"; warnEl.className = "fe-warn on"; }
      else { warnEl.textContent = ""; warnEl.className = "fe-warn"; }

      // day/night advance
      st.time = (st.time + dt * 0.02) % 24;
    }
    function crash() { st.crashed = true; warnEl.innerHTML = `TERRAIN — CRASH<br><button class="fe-restart">Restart</button>`; warnEl.className = "fe-warn crash"; warnEl.querySelector(".fe-restart").onclick = reset; }

    // ---- environment update ----
    function updateEnv() {
      const ang = (st.time / 24) * Math.PI * 2 - Math.PI / 2;
      const sx = Math.cos(ang) * 6000, sy = Math.sin(ang) * 6000;
      sun.position.set(sx, sy, 2000); sunMesh.position.copy(sun.position);
      moonMesh.position.set(-sx, -sy, 2000);
      const day = clamp((sy + 1500) / 3000, 0, 1); // 0 night, 1 day
      sun.intensity = 0.15 + day * 0.95; hemi.intensity = 0.25 + day * 0.85;
      const skyDay = new T.Color(0x8fc7f0), skyNight = new T.Color(0x0a1428), skyDusk = new T.Color(0xdd7a4a);
      const dusk = clamp(1 - Math.abs(day - 0.5) * 4, 0, 1) * 0.6;
      const sky = skyNight.clone().lerp(skyDay, day).lerp(skyDusk, dusk);
      scene.background = sky; scene.fog = new T.Fog(sky.getHex(), 400, 5000);
      stars.material.opacity = clamp(1 - day * 2, 0, 1);
      sunMesh.visible = day > 0.05; moonMesh.visible = day < 0.6;
    }

    // ---- minimap ----
    function drawMap() {
      map.clearRect(0, 0, 150, 150); map.fillStyle = "rgba(8,20,14,.8)"; map.fillRect(0, 0, 150, 150);
      const scale = 0.02;
      map.save(); map.translate(75, 75); map.rotate(-st.heading);
      // sample terrain around
      for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
        const wx = st.pos.x + i * 300, wz = st.pos.z + j * 300; const h = elev(wx, wz);
        map.fillStyle = h < 10 ? "#2f6ea5" : h < 340 ? "#3a6b2e" : h < 560 ? "#6b5a3a" : "#cfd4dc";
        map.fillRect((wx - st.pos.x) * scale - 3, (wz - st.pos.z) * scale - 3, 6, 6);
      }
      map.restore();
      map.fillStyle = "#ffd23f"; map.beginPath(); map.moveTo(75, 68); map.lineTo(71, 80); map.lineTo(79, 80); map.closePath(); map.fill();
    }

    // ---- camera ----
    function updateCamera() {
      const p = st.pos, h = st.heading;
      if (camMode === 0) { const off = new T.Vector3(Math.sin(h) * -60, 16, Math.cos(h) * 60); camera.position.copy(p).add(off); camera.up.set(0, 1, 0); camera.lookAt(p.x, p.y + 4, p.z); }
      else if (camMode === 1) { const off = new T.Vector3(Math.sin(h) * 6, 3, -Math.cos(h) * 6); camera.position.copy(p).add(off); camera.lookAt(p.x + Math.sin(h) * 100, p.y + Math.sin(st.pitch) * 100, p.z - Math.cos(h) * 100); }
      else if (camMode === 2) { const t = performance ? (st.time * 4) : 0; const off = new T.Vector3(Math.sin(h + 1) * 90, 30, Math.cos(h + 1) * 90); camera.position.copy(p).add(off); camera.lookAt(p.x, p.y, p.z); }
      else { camera.position.set(0, elev(0, 0) + 40, -260); camera.lookAt(p.x, p.y, p.z); }
    }

    // ---- render aircraft transform ----
    function orientPlane() {
      plane.position.copy(st.pos);
      plane.rotation.set(0, 0, 0); plane.rotateY(st.heading); plane.rotateX(st.pitch); plane.rotateZ(-st.roll);
      if (plane.userData.prop) plane.userData.prop.rotation.z += st.throttle * 0.9 + 0.1;
    }

    // ---- loop ----
    let last = 0, raf = 0, terrCX = 1e9, terrCZ = 1e9;
    function frame(ts) {
      if (!document.body.contains(host)) { renderer.dispose && renderer.dispose(); return; }
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
      const w = host.clientWidth || 1, hh = host.clientHeight || 1;
      renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix();

      step(dt);
      // re-center terrain if drifted
      if (Math.abs(st.pos.x - terrCX) > 400 || Math.abs(st.pos.z - terrCZ) > 400) { terrCX = st.pos.x; terrCZ = st.pos.z; paintTerrain(terrCX, terrCZ); terrain.position.set(terrCX, 0, terrCZ); water.position.set(terrCX, 6, terrCZ); }
      clouds.position.set(Math.round(st.pos.x / 9000) * 9000, 0, Math.round(st.pos.z / 9000) * 9000);
      stars.position.copy(camera.position);
      orientPlane(); updateEnv(); updateCamera();
      const spd = st.vel.length(), kts = spd * 1.94384, altFt = st.pos.y * 3.3, vsi = st.vel.y * 196.85;
      updateInstruments(kts, altFt, st.heading, vsi, st.throttle, 0); apText();
      host.querySelector("#fe-clock").textContent = String(Math.floor(st.time)).padStart(2, "0") + ":" + String(Math.floor((st.time % 1) * 60)).padStart(2, "0") + (st.gear ? " · GEAR" : "") + (st.brakes ? " · BRK" : "") + (st.flaps ? " · FLAPS " + st.flaps : "");
      drawMap();
      renderer.render(scene, camera);
    }
    paintTerrain(0, 0); terrCX = 0; terrCZ = 0;
    requestAnimationFrame(frame);
    host.__fe = { scene, get plane() { return plane; }, get spec() { return spec; }, meshCount() { let n = 0; plane && plane.traverse((o) => { if (o.isMesh) n++; }); return n; } };
    return { dispose: () => { cancelAnimationFrame(raf); renderer.dispose && renderer.dispose(); } };
  }

  window.FlightEngine = { start };
})();
