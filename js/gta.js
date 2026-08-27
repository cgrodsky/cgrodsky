/* GTA — a real 3D open-world engine built on the loaded Three.js.
   A third-person character walks a block city, animated by real Mixamo motion
   clips (drunk walk, strafe, kick, greeting, acknowledge) loaded from FBX.
   The character mesh is built by hanging limb boxes off the Mixamo skeleton, so
   no external skinned model is needed — the clips drive the bones directly. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const _fbx = {};
  function loadFBX(url) {
    if (_fbx[url]) return Promise.resolve(_fbx[url]);
    return new Promise((res, rej) => {
      if (!window.FBXLoader) { rej(new Error("no FBXLoader")); return; }
      new window.FBXLoader().load(url, (o) => { _fbx[url] = o; res(o); }, undefined, rej);
    });
  }
  // Lock a clip's Hips horizontal translation so the character animates in place
  // and world movement is driven by code (no foot-sliding / double motion).
  function stripRootMotion(clip) {
    clip.tracks.forEach((t) => {
      if (/Hips\.position$/.test(t.name)) {
        const v = t.values; for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
      }
    });
    return clip;
  }

  function start(body, opts) {
    const T = window.THREE;
    if (!T) { body.innerHTML = `<div style="padding:24px;color:#334">3D engine (Three.js) failed to load. Refresh and try again.</div>`; return null; }

    body.innerHTML = `<div class="gta">
      <div class="gta-hud">
        <div class="gta-top"><span class="gta-cash">$4,720</span><span class="gta-loc" id="gta-loc">Los Santos</span></div>
        <div class="gta-stars" id="gta-stars">★★☆☆☆</div>
      </div>
      <div class="gta-weapon" id="gta-weapon"></div>
      <div class="gta-action" id="gta-action"></div>
      <div class="gta-help">Drag look · WASD move · Shift run · F fire · R reload · G grenade · Space kick · T phone · C cam</div>
      <div class="gta-stick" id="gta-stick"><div class="gta-nub" id="gta-nub"></div></div>
      <div class="gta-btns">
        <button class="gta-b fire" data-k="fire">FIRE</button>
        <button class="gta-b" data-k="reload">RELOAD</button>
        <button class="gta-b" data-k="throw">GRENADE</button>
        <button class="gta-b" data-k="kick">KICK</button>
        <button class="gta-b" data-k="phone">PHONE</button>
        <button class="gta-b" data-k="run">RUN</button>
        <button class="gta-b" data-k="cam">CAM</button>
      </div>
      <div class="gta-phone" id="gta-phone">
        <div class="gph-frame">
          <div class="gph-notch"></div>
          <div class="gph-status"><span id="gph-time">12:00</span><span class="gph-sig">Badger &nbsp;5G&nbsp; &#9646;&#9646;&#9646;&#9646;</span></div>
          <div class="gph-screen" id="gph-screen"></div>
          <div class="gph-home" id="gph-homebtn"></div>
        </div>
      </div>
      <div class="gta-flash" id="gta-flash"></div>
      <div class="gta-cine" id="gta-cine">
        <div class="gta-bar top"></div><div class="gta-bar bot"></div>
        <div class="gta-title" id="gta-title"></div>
        <div class="gta-sub" id="gta-sub"></div>
        <div class="gta-skip">tap to skip ▸</div>
      </div>
      <div class="gta-load" id="gta-load">Loading Los Santos…</div>
    </div>`;
    const host = body.querySelector(".gta");
    const loadEl = host.querySelector("#gta-load");
    const actionEl = host.querySelector("#gta-action");
    const weaponEl = host.querySelector("#gta-weapon");
    const flashEl = host.querySelector("#gta-flash");
    const cineEl = host.querySelector("#gta-cine");
    const titleEl = host.querySelector("#gta-title");
    const subEl = host.querySelector("#gta-sub");

    // ---- renderer / scene / camera ----
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(60, 1, 0.1, 900);
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none";
    host.insertBefore(renderer.domElement, host.firstChild);

    const sky = new T.Color(0x9dc4e8);
    scene.background = sky; scene.fog = new T.Fog(0x9dc4e8, 120, 520);
    scene.add(new T.HemisphereLight(0xdfeaff, 0x6b6357, 0.95));
    const sun = new T.DirectionalLight(0xfff2d6, 1.0); sun.position.set(80, 140, 40); scene.add(sun);

    // ---- ground ----
    const ground = new T.Mesh(new T.PlaneGeometry(1000, 1000), new T.MeshLambertMaterial({ color: 0x3a3d44 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);

    // road markings (dashed centre lines along the avenues)
    const lineMat = new T.MeshBasicMaterial({ color: 0xf4d54a });
    const BLOCK = 44;
    for (let g = -3; g <= 3; g++) {
      for (let d = -140; d < 140; d += 12) {
        const a = new T.Mesh(new T.PlaneGeometry(1.1, 6), lineMat); a.rotation.x = -Math.PI / 2; a.position.set(g * BLOCK, 0.05, d + 3); scene.add(a);
        const b = new T.Mesh(new T.PlaneGeometry(6, 1.1), lineMat); b.rotation.x = -Math.PI / 2; b.position.set(d + 3, 0.05, g * BLOCK); scene.add(b);
      }
    }

    // ---- city buildings (grid of blocks) ----
    function cityTexture() {
      const c = document.createElement("canvas"); c.width = 64; c.height = 128; const x = c.getContext("2d");
      const base = ["#3b4250", "#4a4038", "#394a44", "#4a3a48", "#354055"][Math.floor(Math.random() * 5)];
      x.fillStyle = base; x.fillRect(0, 0, 64, 128);
      for (let yy = 0; yy < 12; yy++) for (let xx = 0; xx < 4; xx++) {
        x.fillStyle = Math.random() < 0.45 ? "#ffe6a3" : "#28303c";
        x.fillRect(6 + xx * 14, 6 + yy * 10, 9, 6);
      }
      const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
    }
    // storefront sign texture
    function signTexture(text, bg) {
      const c = document.createElement("canvas"); c.width = 256; c.height = 64; const x = c.getContext("2d");
      x.fillStyle = bg; x.fillRect(0, 0, 256, 64); x.fillStyle = "#ffe27a"; x.font = "bold 34px Impact, system-ui"; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(text, 128, 34); return new T.CanvasTexture(c);
    }
    // themed shops: revolver at the gun store, grenade at the army-surplus store
    const SHOPS = { "1,0": { key: "revolver", sign: "AMMU-NATION", col: 0x6e2020, front: [-1, 0] }, "0,-1": { key: "grenade", sign: "ARMY SURPLUS", col: 0x3c4a28, front: [0, 1] } };
    const pickupSpots = {};
    const buildings = []; // AABBs for collision {x,z,hw,hd}
    for (let gx = -3; gx <= 3; gx++) {
      for (let gz = -3; gz <= 3; gz++) {
        if (gx === 0 && gz === 0) continue;                    // spawn plaza
        const shop = SHOPS[gx + "," + gz];
        if (!shop && (gx + gz) % 5 === 0) continue;            // occasional empty lot (never skip a shop)
        const cx = gx * BLOCK, cz = gz * BLOCK;
        let hw = 12 + Math.random() * 6, hd = 12 + Math.random() * 6, h = 16 + Math.random() * 46;
        if (shop) { hw = 15; hd = 15; h = 20; }
        const b = new T.Mesh(new T.BoxGeometry(hw * 2, h, hd * 2), shop
          ? new T.MeshLambertMaterial({ color: shop.col })
          : (() => { const tex = cityTexture(); tex.repeat.set(Math.round(hw / 3), Math.round(h / 6)); return new T.MeshLambertMaterial({ map: tex }); })());
        b.position.set(cx, h / 2, cz); scene.add(b);
        const pad = new T.Mesh(new T.BoxGeometry(hw * 2 + 6, 0.6, hd * 2 + 6), new T.MeshLambertMaterial({ color: 0x8b8f96 }));
        pad.position.set(cx, 0.3, cz); scene.add(pad);
        buildings.push({ x: cx, z: cz, hw: hw + 1.4, hd: hd + 1.4 });
        if (shop) {
          const [nx, nz] = shop.front;
          const sign = new T.Mesh(new T.PlaneGeometry(hw * 1.7, 6), new T.MeshBasicMaterial({ map: signTexture(shop.sign, "#12161d") }));
          sign.position.set(cx + nx * (hw + 0.2), h * 0.62, cz + nz * (hd + 0.2));
          sign.rotation.y = nx !== 0 ? nx * Math.PI / 2 : (nz > 0 ? 0 : Math.PI); scene.add(sign);
          pickupSpots[shop.key] = { x: cx + nx * (hw + 5), z: cz + nz * (hd + 5) };
        }
      }
    }

    // ---- a few parked cars ----
    function car(x, z, rot, color) {
      const g = new T.Group();
      const body1 = new T.Mesh(new T.BoxGeometry(4.4, 1.4, 2.2), new T.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4 })); body1.position.y = 1.1; g.add(body1);
      const cab = new T.Mesh(new T.BoxGeometry(2.4, 1.1, 2.0), new T.MeshStandardMaterial({ color: 0x101318, metalness: 0.3, roughness: 0.2 })); cab.position.set(-0.2, 2.0, 0); g.add(cab);
      [[1.5, 1.1], [1.5, -1.1], [-1.5, 1.1], [-1.5, -1.1]].forEach(([wx, wz]) => { const w = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.4, 12), new T.MeshStandardMaterial({ color: 0x0a0a0a })); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.5, wz); g.add(w); });
      g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    }
    [[22, 6, 0, 0xb23b3b], [-22, -10, Math.PI, 0x2f5fb0], [8, 24, Math.PI / 2, 0xd6a52a], [-6, -26, 0, 0x2d8f4e], [26, -20, Math.PI, 0x7a3fb0]].forEach((c) => car(c[0], c[1], c[2], c[3]));

    // ---- character (built later, after FBX loads) ----
    let char = null, mixer = null, actions = {}, current = null, charReady = false, faceOffset = 0;
    const player = { pos: new T.Vector3(0, 0, 8), yaw: Math.PI, moving: false };

    // ---- weapons / combat / NPC / cinematic state ----
    let handBone = null, heldWeapon = null, equipped = null, ammo = 6, shake = 0, recoil = 0;
    let reloading = false, reloadT = 0, phoneOpen = false, phoneView = "home";
    const inv = { revolver: false, grenade: 0 };
    const weaponModels = {};          // name -> loaded Object3D (original, cloned per use)
    const pickups = [];               // {key, holder, ring, spot, got}
    const npcs = [];                  // {grp, dir, spd, phase, alive, deadT}
    const bullets = [];               // tracer lines {ln, t}
    const grenadesLive = [];          // thrown {m, vel, t}
    const explosions = [];            // {mesh, t}
    const HANDROT = { x: -1.2, y: 0, z: 0 };   // orient held gun in the hand (tuned)
    const cine = { active: false, t: 0, dur: 0, mode: null };

    function buildCharacter(rootObj) {
      const skin = new T.MeshStandardMaterial({ color: 0xcf9c72, roughness: 0.8, metalness: 0 });
      const shirt = new T.MeshStandardMaterial({ color: 0x2e6b3a, roughness: 0.7 });   // green jacket
      const pants = new T.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.8 });
      const shoe = new T.MeshStandardMaterial({ color: 0x121212, roughness: 0.6 });
      const hair = new T.MeshStandardMaterial({ color: 0x24170e, roughness: 0.9 });
      const byName = {}; rootObj.traverse((o) => { if (o.isBone) byName[o.name] = o; });
      const clean = (n) => n.replace(/^mixamorig:?/i, "");
      const find = (s) => Object.values(byName).find((b) => clean(b.name) === s);
      // limb: box of `len` along the bone's +Y, plus optional width/depth; parented to bone
      function limb(sfx, len, w, d, mat, yoff) {
        const bone = find(sfx); if (!bone) return null;
        const m = new T.Mesh(new T.BoxGeometry(w, len, d), mat); m.position.set(0, len / 2 + (yoff || 0), 0); bone.add(m); return m;
      }
      function chunk(sfx, w, h, d, mat, ox, oy, oz) {
        const bone = find(sfx); if (!bone) return null;
        const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(ox || 0, oy || 0, oz || 0); bone.add(m); return m;
      }
      // torso / pelvis / head
      chunk("Spine", 26, 20, 15, shirt, 0, 14, 1);
      chunk("Hips", 22, 15, 14, pants, 0, 0, 0);
      chunk("Head", 17, 20, 18, skin, 0, 8, 2);
      chunk("Head", 18, 8, 19, hair, 0, 15, 1);          // hair cap
      chunk("Neck", 8, 9, 8, skin, 0, 4, 0);
      // arms
      ["Right", "Left"].forEach((s) => {
        limb(s + "Arm", 27.8, 8, 8, shirt);
        limb(s + "ForeArm", 28.3, 7, 7, skin);
        chunk(s + "Hand", 7, 8, 4, skin, 0, 8, 0);
        limb(s + "UpLeg", 44.4, 11, 11, pants);
        limb(s + "Leg", 44.5, 9, 9, pants);
        chunk(s + "Foot", 9, 6, 18, shoe, 0, 6, 4);
      });
      return rootObj;
    }

    // ---- load skeleton + all animation clips ----
    const CLIPS = { idle: "greeting", walk: "drunkwalk", strafe: "strafe", kick: "kick", nod: "acknowledge" };
    loadFBX("assets/models/gta/greeting.fbx").then((root) => {
      buildCharacter(root);
      char = new T.Group();
      root.scale.setScalar(0.02);
      char.add(root);
      char.position.copy(player.pos);
      scene.add(char);
      root.traverse((o) => { if (o.isBone && o.name.replace(/^mixamorig:?/i, "") === "RightHand") handBone = o; });
      mixer = new T.AnimationMixer(root);
      // greeting clip already on root
      const add = (key, clip) => { stripRootMotion(clip); const a = mixer.clipAction(clip); actions[key] = a; };
      add("idle", root.animations[0]);
      // "wave" is the greeting clip as a one-shot — clone it so it's a distinct
      // action from the looping idle (clipAction caches per-clip).
      const waveClip = root.animations[0].clone(); stripRootMotion(waveClip); actions.wave = mixer.clipAction(waveClip);
      // load the rest for their clips
      const rest = Object.entries(CLIPS).filter(([k]) => k !== "idle");
      return Promise.all(rest.map(([k, f]) => loadFBX("assets/models/gta/" + f + ".fbx").then((o) => add(k, o.animations[0])).catch(() => {})));
    }).then(() => {
      // one-shots
      ["kick", "nod", "wave"].forEach((k) => { if (actions[k]) { actions[k].setLoop(T.LoopOnce); actions[k].clampWhenFinished = true; } });
      if (actions.idle) actions.idle.play();
      current = actions.idle;
      mixer.addEventListener("finished", () => { fadeTo(player.moving ? "walk" : "idle", 0.25); });
      charReady = true; loadEl.style.display = "none";
    }).catch((err) => { loadEl.textContent = "Character failed to load."; console.warn("[GTA]", err); });

    function fadeTo(key, dur) {
      const next = actions[key]; if (!next || next === current) return;
      next.reset(); next.setEffectiveWeight(1); next.fadeIn(dur || 0.2).play();
      if (current) current.fadeOut(dur || 0.2);
      current = next;
    }
    let oneShotUntil = 0;
    function oneShot(key) {
      if (!charReady || !actions[key]) return;
      actions[key].reset().setEffectiveWeight(1).fadeIn(0.12).play();
      if (current && current !== actions[key]) current.fadeOut(0.12);
      current = actions[key];
      actionEl.textContent = key === "kick" ? "KICK!" : key === "nod" ? "S'up" : "";
      setTimeout(() => { actionEl.textContent = ""; }, 900);
    }

    // ==================== weapons / NPCs / combat / cutscenes ====================
    const _glb = {};
    function loadGLB(url) {
      if (_glb[url]) return Promise.resolve(_glb[url]);
      return new Promise((res, rej) => { if (!window.GLTFLoader) { rej(new Error("no GLTFLoader")); return; } new window.GLTFLoader().load(url, (g) => { _glb[url] = g.scene; res(g.scene); }, undefined, rej); });
    }
    // clone a model, center it, scale to targetLen on its longest axis, wrap in a group
    function normModel(src, targetLen) {
      const m = src.clone(true); const box = new T.Box3().setFromObject(m); const s = box.getSize(new T.Vector3()); const c = box.getCenter(new T.Vector3());
      m.position.sub(c); m.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      const g = new T.Group(); g.add(m); g.scale.setScalar(targetLen / (Math.max(s.x, s.y, s.z) || 1)); return g;
    }

    // -- NPC pedestrians (simple blocky people you can kick / shoot / blow up) --
    function makePed(color) {
      const g = new T.Group();
      const M = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.85 });
      const torso = new T.Mesh(new T.BoxGeometry(1.1, 1.5, 0.6), M(color)); torso.position.y = 2.4; g.add(torso);
      const head = new T.Mesh(new T.BoxGeometry(0.7, 0.7, 0.7), M(0xcaa17a)); head.position.y = 3.5; g.add(head);
      const legL = new T.Mesh(new T.BoxGeometry(0.4, 1.6, 0.4), M(0x2b2f38)); legL.position.set(-0.3, 1.0, 0); g.add(legL);
      const legR = legL.clone(); legR.position.x = 0.3; g.add(legR);
      const armL = new T.Mesh(new T.BoxGeometry(0.35, 1.3, 0.35), M(color)); armL.position.set(-0.75, 2.5, 0); g.add(armL);
      const armR = armL.clone(); armR.position.x = 0.75; g.add(armR);
      g.userData = { legL, legR, armL, armR }; return g;
    }
    function spawnNPCs() {
      const cols = [0x3355aa, 0xaa5533, 0x557733, 0x774488, 0x888888, 0xaa8822, 0x2a9d8f];
      for (let i = 0; i < 7; i++) {
        const g = makePed(cols[i % cols.length]); const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 74;
        g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); scene.add(g);
        npcs.push({ grp: g, dir: Math.random() * Math.PI * 2, spd: 2 + Math.random() * 2, phase: Math.random() * 6, alive: true, deadT: 0 });
      }
    }
    function killNPC(n) { if (!n.alive) return; n.alive = false; n.deadT = 0; n.grp.rotation.set(0, n.grp.rotation.y, Math.PI / 2); n.grp.position.y = 0.6; }
    function updateNPCs(dt) {
      npcs.forEach((n) => {
        if (!n.alive) { n.deadT += dt; if (n.deadT > 6) { const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 70; n.grp.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); n.grp.rotation.set(0, 0, 0); n.alive = true; } return; }
        if (Math.random() < 0.012) n.dir += (Math.random() - 0.5);
        const nx = n.grp.position.x + Math.cos(n.dir) * n.spd * dt, nz = n.grp.position.z + Math.sin(n.dir) * n.spd * dt;
        if (nearestBlocked(nx, nz)) { n.dir += Math.PI * 0.7; } else { n.grp.position.x = clamp(nx, -140, 140); n.grp.position.z = clamp(nz, -140, 140); }
        n.grp.rotation.y = -n.dir + Math.PI / 2;
        n.phase += dt * n.spd * 2; const sw = Math.sin(n.phase) * 0.5; const u = n.grp.userData;
        u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw; u.armR.rotation.x = sw;
      });
    }

    // -- weapon pickups --
    function placePickup(key) {
      const spot = pickupSpots[key]; if (!spot || !weaponModels[key]) return;
      const disp = normModel(weaponModels[key], key === "revolver" ? 2.4 : 1.5);
      const holder = new T.Group(); holder.add(disp); holder.position.set(spot.x, 2.6, spot.z); scene.add(holder);
      const ring = new T.Mesh(new T.TorusGeometry(1.7, 0.13, 8, 24), new T.MeshBasicMaterial({ color: key === "revolver" ? 0xffd23f : 0x66ff88 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(spot.x, 0.5, spot.z); scene.add(ring);
      pickups.push({ key, holder, ring, spot, got: false });
    }
    function loadWeapons() {
      loadGLB("assets/models/gta/revolver.glb").then((o) => { weaponModels.revolver = o; placePickup("revolver"); }).catch((e) => console.warn("[GTA] revolver", e));
      loadGLB("assets/models/gta/grenade.glb").then((o) => { weaponModels.grenade = o; placePickup("grenade"); }).catch((e) => console.warn("[GTA] grenade", e));
    }
    function checkPickups() {
      pickups.forEach((pu) => {
        if (pu.got) return; pu.holder.rotation.y += 0.03; pu.ring.rotation.z += 0.02; pu.holder.position.y = 2.6 + Math.sin(performanceNow() * 0.003) * 0.25;
        const dx = player.pos.x - pu.spot.x, dz = player.pos.z - pu.spot.z;
        if (dx * dx + dz * dz < 12) { pu.got = true; scene.remove(pu.holder); scene.remove(pu.ring); pickup(pu.key); }
      });
    }
    let _pn = 0; function performanceNow() { return (_pn += 16); }
    function pickup(key) {
      if (key === "revolver") { inv.revolver = true; ammo = 6; equip("revolver"); }
      else { inv.grenade += 3; }
      updateWeaponHUD(); pickupCine(key);
    }
    function equip(key) {
      equipped = key;
      if (!handBone || !weaponModels[key]) { updateWeaponHUD(); return; }
      if (heldWeapon) { handBone.remove(heldWeapon); heldWeapon = null; }
      const m = weaponModels[key].clone(true); const box = new T.Box3().setFromObject(m); const s = box.getSize(new T.Vector3()); const c = box.getCenter(new T.Vector3());
      m.position.sub(c); m.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      const wrap = new T.Group(); wrap.add(m); wrap.scale.setScalar(24 / (Math.max(s.x, s.y, s.z) || 1));
      wrap.position.set(0, 7, 3); wrap.rotation.set(HANDROT.x, HANDROT.y, HANDROT.z);
      handBone.add(wrap); heldWeapon = wrap;
      updateWeaponHUD();
    }
    function updateWeaponHUD() {
      let s = "";
      if (equipped === "revolver") s = `<span class="wpn">.357 MAGNUM</span> <span class="ammo">${ammo} / 6</span>`;
      if (inv.grenade > 0) s += `${s ? " &nbsp; " : ""}<span class="wpn">GRENADE ×${inv.grenade}</span>`;
      weaponEl.innerHTML = s;
    }
    // -- shooting --
    function muzzle() {
      if (!heldWeapon) return;
      const p = new T.Vector3(); heldWeapon.getWorldPosition(p);
      const fwd = new T.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      const f = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));
      f.position.copy(p).addScaledVector(fwd, 1.2); scene.add(f); explosions.push({ mesh: f, t: 0.35, flash: true });
    }
    function tracer(a, b) {
      const geo = new T.BufferGeometry().setFromPoints([a, b]);
      const ln = new T.Line(geo, new T.LineBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.9 })); scene.add(ln); bullets.push({ ln, t: 0 });
    }
    function fire() {
      if (equipped !== "revolver" || !char || reloading) return;
      if (ammo <= 0) { startReload(); return; }
      ammo--; updateWeaponHUD(); recoil = 0.05; shake = Math.max(shake, 0.22); muzzle();
      const origin = new T.Vector3(player.pos.x, 3.4, player.pos.z);
      const dir = new T.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).normalize();
      tracer(origin.clone().addScaledVector(dir, 2), origin.clone().addScaledVector(dir, 120));
      let best = null, bd = 1e9;
      npcs.forEach((n) => { if (!n.alive) return; const to = new T.Vector3(n.grp.position.x - origin.x, 0, n.grp.position.z - origin.z); const d = to.length(); if (d > 95) return; to.normalize(); if (to.dot(dir) > 0.985 && d < bd) { bd = d; best = n; } });
      if (best) setTimeout(() => killNPC(best), 50);
      if (ammo <= 0) startReload();
    }
    // -- reload (with a hand/weapon animation) --
    function startReload() {
      if (reloading || equipped !== "revolver" || ammo >= 6) return;
      reloading = true; reloadT = 0; actionEl.textContent = "RELOADING…";
    }
    function updateReload(dt) {
      if (!reloading) return;
      reloadT += dt; const k = clamp(reloadT / 1.3, 0, 1);
      // tilt the gun down to load, snap back up — plus the character glances down (nod)
      if (heldWeapon) {
        const dip = Math.sin(k * Math.PI);                 // 0→1→0
        heldWeapon.rotation.x = HANDROT.x + dip * 1.1;
        heldWeapon.position.y = 7 - dip * 3; heldWeapon.rotation.z = dip * 0.5;
      }
      if (k >= 1) { reloading = false; ammo = 6; updateWeaponHUD(); actionEl.textContent = "RELOADED"; setTimeout(() => { if (actionEl.textContent === "RELOADED") actionEl.textContent = ""; }, 600); if (heldWeapon) { heldWeapon.rotation.set(HANDROT.x, HANDROT.y, HANDROT.z); heldWeapon.position.y = 7; } }
    }
    // -- grenades --
    function throwGrenade() {
      if (inv.grenade <= 0 || !char || !weaponModels.grenade) return;
      inv.grenade--; updateWeaponHUD(); oneShot("wave");
      const m = normModel(weaponModels.grenade, 0.9);
      const fwd = new T.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
      m.position.set(player.pos.x, 3.4, player.pos.z).addScaledVector(fwd, 1.5); scene.add(m);
      grenadesLive.push({ m, vel: fwd.clone().multiplyScalar(24).setY(13), t: 0 });
    }
    function explode(pos) {
      shake = Math.max(shake, 0.8);
      flashEl.classList.add("on"); setTimeout(() => flashEl.classList.remove("on"), 90);
      const s = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({ color: 0xffa63a, transparent: true, opacity: 0.95 }));
      s.position.copy(pos); scene.add(s); explosions.push({ mesh: s, t: 0, blast: true });
      const smoke = new T.Mesh(new T.SphereGeometry(1, 12, 10), new T.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.6 }));
      smoke.position.copy(pos); scene.add(smoke); explosions.push({ mesh: smoke, t: -0.1, blast: true, smoke: true });
      npcs.forEach((n) => { if (n.alive && n.grp.position.distanceTo(pos) < 13) killNPC(n); });
    }
    function updateEffects(dt) {
      shake = Math.max(0, shake - dt * 1.6); recoil = Math.max(0, recoil - dt * 0.4);
      for (let i = bullets.length - 1; i >= 0; i--) { const b = bullets[i]; b.t += dt; b.ln.material.opacity = 0.9 * (1 - b.t / 0.12); if (b.t > 0.12) { scene.remove(b.ln); bullets.splice(i, 1); } }
      for (let i = grenadesLive.length - 1; i >= 0; i--) { const g = grenadesLive[i]; g.vel.y -= 30 * dt; g.m.position.addScaledVector(g.vel, dt); g.m.rotation.x += dt * 9; g.t += dt; if (g.m.position.y <= 0.5 || g.t > 2) { explode(g.m.position.clone().setY(0.6)); scene.remove(g.m); grenadesLive.splice(i, 1); } }
      for (let i = explosions.length - 1; i >= 0; i--) {
        const e = explosions[i]; e.t += dt;
        if (e.flash) { e.mesh.material.opacity = 0.95 * Math.max(0, 1 - (e.t) / 0.08); if (e.t > 0.08) { scene.remove(e.mesh); explosions.splice(i, 1); } continue; }
        if (e.blast) { const sc = e.smoke ? 1 + Math.max(0, e.t) * 14 : 1 + Math.max(0, e.t) * 26; e.mesh.scale.setScalar(sc); e.mesh.material.opacity = (e.smoke ? 0.6 : 0.95) * Math.max(0, 1 - Math.max(0, e.t) / (e.smoke ? 0.9 : 0.5)); if (e.t > (e.smoke ? 0.9 : 0.5)) { scene.remove(e.mesh); explosions.splice(i, 1); } }
      }
    }

    // -- cutscenes --
    function startCine(mode, dur) { cine.active = true; cine.t = 0; cine.dur = dur; cine.mode = mode; cineEl.classList.add("on"); }
    function endCine() { if (!cine.active) return; cine.active = false; cineEl.classList.remove("on"); titleEl.textContent = ""; subEl.textContent = ""; }
    function startIntro() {
      startCine("intro", 6.5); titleEl.textContent = ""; subEl.textContent = "LOS SANTOS";
      setTimeout(() => { if (cine.mode === "intro" && cine.active) { titleEl.textContent = "GRAND THEFT AUTO"; subEl.textContent = ""; } }, 3200);
    }
    function pickupCine(key) { startCine("pickup", 2.2); titleEl.textContent = key === "revolver" ? ".357 MAGNUM" : "GRENADES"; subEl.textContent = "ACQUIRED"; }
    function cineCamera(dt) {
      cine.t += dt;
      const cx0 = player.pos.x, cz0 = player.pos.z;
      if (cine.mode === "intro") {
        const k = clamp(cine.t / cine.dur, 0, 1), a = k * 2.4 + 0.6, r = lerp(120, 16, k), y = lerp(78, 6, k * k);
        camera.position.set(cx0 + Math.cos(a) * r, y, cz0 + Math.sin(a) * r); camera.lookAt(cx0, 3, cz0);
      } else { // pickup close-up orbit
        const a = cine.t * 2.2 + player.yaw, r = 6.5;
        camera.position.set(cx0 + Math.sin(a) * r, 4.2, cz0 + Math.cos(a) * r); camera.lookAt(cx0, 3.2, cz0);
      }
      if (cine.t >= cine.dur) endCine();
    }

    // -- phone (in-game smartphone) --
    const phoneEl = host.querySelector("#gta-phone"), gphScreen = host.querySelector("#gph-screen"), gphTime = host.querySelector("#gph-time");
    const PHONE_APPS = [
      { id: "contacts", name: "Contacts", ic: "&#128100;", col: "#2f7d4f" },
      { id: "map", name: "Maps", ic: "&#128506;", col: "#2a6fb0" },
      { id: "snap", name: "Snapmatic", ic: "&#128247;", col: "#c0392b" },
      { id: "messages", name: "Messages", ic: "&#128172;", col: "#1f9d55" },
      { id: "web", name: "Weazel", ic: "&#127760;", col: "#8e44ad" },
      { id: "settings", name: "Settings", ic: "&#9881;", col: "#555b66" },
    ];
    function togglePhone(force) { phoneOpen = force === undefined ? !phoneOpen : force; phoneEl.classList.toggle("open", phoneOpen); if (phoneOpen) phoneHome(); }
    function phoneHome() {
      phoneView = "home";
      gphScreen.innerHTML = `<div class="gph-grid">${PHONE_APPS.map((a) => `<button class="gph-app" data-app="${a.id}"><span class="gph-ic" style="background:${a.col}">${a.ic}</span><span class="gph-nm">${a.name}</span></button>`).join("")}</div>`;
      gphScreen.querySelectorAll(".gph-app").forEach((b) => b.onclick = () => phoneApp(b.dataset.app));
    }
    function phoneApp(id) {
      phoneView = id; let html = "";
      if (id === "contacts") { const n = ["Lamar", "Franklin", "Roman", "Lester", "Trevor", "Brucie", "Mom"]; html = `<div class="gph-hd">Contacts</div>` + n.map((x) => `<div class="gph-item" data-call="${x}"><span class="gph-av">${x[0]}</span><span class="gph-inm">${x}</span><span class="gph-ph">&#128222;</span></div>`).join(""); }
      else if (id === "map") { html = `<div class="gph-hd">Maps</div><canvas id="gph-map" width="228" height="330"></canvas>`; }
      else if (id === "snap") { html = `<div class="gph-hd">Snapmatic</div><div class="gph-snap">&#128248;<div>Say cheese, Los Santos.</div></div>`; }
      else if (id === "messages") { const m = [["Lamar", "Homie where you at??"], ["Lester", "New score. Come by the factory."], ["Unknown", "You did NOT see nothing."]]; html = `<div class="gph-hd">Messages</div>` + m.map((x) => `<div class="gph-msg"><b>${x[0]}</b><span>${x[1]}</span></div>`).join(""); }
      else if (id === "web") { html = `<div class="gph-hd">Weazel News</div><div class="gph-news">&#128680; Chaos downtown as a lone maniac tears through Los Santos. LSPD "completely baffled." More at 11.</div>`; }
      else if (id === "settings") { html = `<div class="gph-hd">Settings</div><div class="gph-item">Brightness</div><div class="gph-item">Ringtone &middot; Badger</div><div class="gph-item">Airplane mode</div><div class="gph-item">Do not disturb</div>`; }
      gphScreen.innerHTML = html;
      if (id === "contacts") gphScreen.querySelectorAll("[data-call]").forEach((it) => it.onclick = () => phoneCall(it.dataset.call));
    }
    function phoneCall(name) {
      phoneView = "call";
      gphScreen.innerHTML = `<div class="gph-call"><div class="gph-av big">${name[0]}</div><div class="gph-caller">${name}</div><div class="gph-calling">calling&hellip;</div><button class="gph-hang">End Call</button></div>`;
      gphScreen.querySelector(".gph-hang").onclick = phoneHome;
    }
    function drawPhoneMap() {
      const cv = host.querySelector("#gph-map"); if (!cv) return; const g = cv.getContext("2d"); const W = 228, H = 330, sc = 0.7;
      g.clearRect(0, 0, W, H); g.fillStyle = "#222c36"; g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, H / 2);
      buildings.forEach((b) => { g.fillStyle = "#3a4652"; g.fillRect((b.x - player.pos.x) * sc - b.hw * sc, (b.z - player.pos.z) * sc - b.hd * sc, b.hw * 2 * sc, b.hd * 2 * sc); });
      pickups.forEach((pu) => { if (pu.got) return; g.fillStyle = pu.key === "revolver" ? "#ffd23f" : "#66ff88"; g.beginPath(); g.arc((pu.spot.x - player.pos.x) * sc, (pu.spot.z - player.pos.z) * sc, 4, 0, 7); g.fill(); });
      npcs.forEach((n) => { if (!n.alive) return; g.fillStyle = "#e05a4a"; g.fillRect((n.grp.position.x - player.pos.x) * sc - 1.5, (n.grp.position.z - player.pos.z) * sc - 1.5, 3, 3); });
      g.fillStyle = "#4ea3ff"; g.beginPath(); g.moveTo(0, -6); g.lineTo(-4, 5); g.lineTo(4, 5); g.closePath(); g.fill();
      g.restore();
    }
    host.querySelector("#gph-homebtn").onclick = () => { if (phoneView !== "home") phoneHome(); else togglePhone(false); };

    // ---- input ----
    const keys = {};
    let camYaw = Math.PI, camPitch = 0.28, camDist = 11, camMode = 0, running = false;
    const dom = renderer.domElement; dom.tabIndex = 0;
    const kh = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys[k] = e.type === "keydown";
      if (e.type === "keydown") {
        if (cine.active) { endCine(); e.preventDefault(); return; }   // any key skips a cutscene
        if (k === "f") fire();
        if (k === "r") startReload();
        if (k === "t") togglePhone();
        if (k === "g") throwGrenade();
        if (k === " ") oneShot("kick");
        if (k === "e") oneShot("wave");           // wave uses greeting one-shot
        if (k === "q") oneShot("nod");
        if (k === "c") camMode = (camMode + 1) % 2;
        if (k === "shift") running = true;
      }
      if (e.type === "keyup" && k === "shift") running = false;
      if ([" ", "w", "a", "s", "d", "e", "q", "c", "f", "g", "r", "t", "Shift"].includes(k)) e.preventDefault();
    };
    dom.addEventListener("keydown", kh); dom.addEventListener("keyup", kh);

    // drag look
    let drag = false, lx = 0, ly = 0;
    dom.addEventListener("pointerdown", (e) => { if (e.target.closest && e.target.closest(".gta-stick,.gta-btns,.gta-phone")) return; if (cine.active) { endCine(); return; } drag = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture(e.pointerId); dom.focus(); });
    dom.addEventListener("pointermove", (e) => { if (!drag) return; camYaw -= (e.clientX - lx) * 0.005; camPitch = clamp(camPitch + (e.clientY - ly) * 0.004, -0.15, 0.9); lx = e.clientX; ly = e.clientY; });
    dom.addEventListener("pointerup", () => { drag = false; });
    dom.addEventListener("wheel", (e) => { camDist = clamp(camDist + Math.sign(e.deltaY) * 1.2, 6, 22); e.preventDefault(); }, { passive: false });

    // touch joystick
    const stick = host.querySelector("#gta-stick"), nub = host.querySelector("#gta-nub");
    let stickId = null, sMag = 0, sAng = 0;
    stick.addEventListener("pointerdown", (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
    stick.addEventListener("pointermove", (e) => { if (stickId === e.pointerId) moveStick(e); });
    stick.addEventListener("pointerup", () => { stickId = null; sMag = 0; nub.style.transform = "translate(0,0)"; });
    function moveStick(e) {
      const r = stick.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const mag = Math.min(1, Math.hypot(dx, dy) / (r.width / 2)); const ang = Math.atan2(dy, dx);
      sMag = mag; sAng = ang; nub.style.transform = `translate(${Math.cos(ang) * mag * 26}px,${Math.sin(ang) * mag * 26}px)`;
    }
    host.querySelectorAll(".gta-b").forEach((b) => {
      const k = b.dataset.k;
      if (k === "run") { b.onpointerdown = () => { running = !running; b.classList.toggle("on", running); }; return; }
      if (k === "cam") { b.onpointerdown = () => { camMode = (camMode + 1) % 2; }; return; }
      if (k === "fire") { b.onpointerdown = () => fire(); return; }
      if (k === "reload") { b.onpointerdown = () => startReload(); return; }
      if (k === "throw") { b.onpointerdown = () => throwGrenade(); return; }
      if (k === "phone") { b.onpointerdown = () => togglePhone(); return; }
      b.onpointerdown = () => oneShot(k);
    });

    // ---- update ----
    function nearestBlocked(nx, nz) {
      for (const bd of buildings) { if (Math.abs(nx - bd.x) < bd.hw && Math.abs(nz - bd.z) < bd.hd) return true; }
      return false;
    }
    let last = 0, raf = 0;
    function frame(ts) {
      if (!document.body.contains(host)) { renderer.dispose && renderer.dispose(); return; }
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();

      // movement input (camera-relative) — suspended during a cutscene
      let ix = 0, iz = 0;
      if (!cine.active) {
        if (keys.w) iz -= 1; if (keys.s) iz += 1; if (keys.a) ix -= 1; if (keys.d) ix += 1;
        if (sMag > 0.15) { ix += Math.cos(sAng) * sMag; iz += Math.sin(sAng) * sMag; }
      }
      const mag = Math.min(1, Math.hypot(ix, iz));
      player.moving = mag > 0.12 && charReady;

      if (player.moving) {
        const dir = Math.atan2(ix, -iz) + camYaw;
        const spd = (running ? 12 : 6) * mag;
        const nx = player.pos.x + Math.sin(dir) * spd * dt;
        const nz = player.pos.z + Math.cos(dir) * spd * dt;
        if (!nearestBlocked(nx, player.pos.z)) player.pos.x = nx;
        if (!nearestBlocked(player.pos.x, nz)) player.pos.z = nz;
        player.pos.x = clamp(player.pos.x, -150, 150); player.pos.z = clamp(player.pos.z, -150, 150);
        player.yaw = lerpAngle(player.yaw, dir, clamp(dt * 10, 0, 1));
        if (current !== actions.kick && current !== actions.nod) fadeTo("walk", 0.2);
      } else if (charReady && current !== actions.kick && current !== actions.nod && current !== actions.wave) {
        fadeTo("idle", 0.3);
      }
      if (actions.walk) actions.walk.setEffectiveTimeScale(running ? 1.6 : 1.0);

      if (char) { char.position.set(player.pos.x, 0, player.pos.z); char.rotation.y = player.yaw + faceOffset; }
      if (mixer) mixer.update(dt);
      updateNPCs(dt); updateEffects(dt); checkPickups(); updateReload(dt);
      if (phoneOpen) { if (phoneView === "map") drawPhoneMap(); const d = new Date(); if (gphTime) gphTime.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

      // camera
      if (cine.active) {
        cineCamera(dt);
      } else {
        const tgt = new T.Vector3(player.pos.x, 3.2, player.pos.z);
        const cd = camMode === 0 ? camDist : 5.5, cp = (camMode === 0 ? camPitch : 0.1) + recoil;
        const cxp = tgt.x - Math.sin(camYaw) * Math.cos(cp) * cd;
        const czp = tgt.z - Math.cos(camYaw) * Math.cos(cp) * cd;
        const cyp = tgt.y + Math.sin(cp) * cd + 2;
        camera.position.lerp(new T.Vector3(cxp, cyp, czp), clamp(dt * 8, 0, 1));
        if (shake > 0.001) camera.position.x += (Math.sin(ts * 0.05) * shake), camera.position.y += (Math.cos(ts * 0.07) * shake);
        camera.lookAt(tgt);
      }

      renderer.render(scene, camera);
    }
    function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }

    // ---- kick off the world ----
    spawnNPCs();
    loadWeapons();
    startIntro();
    host.__gta = { player, cine, pickups: () => pickups.map((p) => ({ key: p.key, got: p.got })), equipped: () => equipped, ammo: () => ammo, grenades: () => inv.grenade, npcAlive: () => npcs.filter((n) => n.alive).length, reloading: () => reloading, reloadT: () => reloadT, fire, throwGrenade, startReload, togglePhone, phoneApp: (id) => phoneApp(id), setPos: (x, z) => player.pos.set(x, 0, z) };
    requestAnimationFrame(frame);
    setTimeout(() => dom.focus(), 40);

    return { dispose: () => { cancelAnimationFrame(raf); renderer.dispose && renderer.dispose(); } };
  }

  window.GTA = { start };
})();
