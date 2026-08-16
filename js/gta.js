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
      <div class="gta-action" id="gta-action"></div>
      <div class="gta-help">Drag = look · W/A/S/D move · Shift run · Space kick · E wave · Q nod · C camera</div>
      <div class="gta-stick" id="gta-stick"><div class="gta-nub" id="gta-nub"></div></div>
      <div class="gta-btns">
        <button class="gta-b" data-k="kick">KICK</button>
        <button class="gta-b" data-k="wave">WAVE</button>
        <button class="gta-b" data-k="nod">NOD</button>
        <button class="gta-b" data-k="run">RUN</button>
        <button class="gta-b" data-k="cam">CAM</button>
      </div>
      <div class="gta-load" id="gta-load">Loading Los Santos…</div>
    </div>`;
    const host = body.querySelector(".gta");
    const loadEl = host.querySelector("#gta-load");
    const actionEl = host.querySelector("#gta-action");

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
    const buildings = []; // AABBs for collision {x,z,hw,hd}
    for (let gx = -3; gx <= 3; gx++) {
      for (let gz = -3; gz <= 3; gz++) {
        if (gx === 0 && gz === 0) continue;                    // spawn plaza
        if ((gx + gz) % 5 === 0) continue;                     // occasional empty lot
        const cx = gx * BLOCK, cz = gz * BLOCK;
        const hw = 12 + Math.random() * 6, hd = 12 + Math.random() * 6, h = 16 + Math.random() * 46;
        const tex = cityTexture(); tex.repeat.set(Math.round(hw / 3), Math.round(h / 6));
        const b = new T.Mesh(new T.BoxGeometry(hw * 2, h, hd * 2), new T.MeshLambertMaterial({ map: tex }));
        b.position.set(cx, h / 2, cz); scene.add(b);
        // sidewalk pad
        const pad = new T.Mesh(new T.BoxGeometry(hw * 2 + 6, 0.6, hd * 2 + 6), new T.MeshLambertMaterial({ color: 0x8b8f96 }));
        pad.position.set(cx, 0.3, cz); scene.add(pad);
        buildings.push({ x: cx, z: cz, hw: hw + 1.4, hd: hd + 1.4 });
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

    // ---- input ----
    const keys = {};
    let camYaw = Math.PI, camPitch = 0.28, camDist = 11, camMode = 0, running = false;
    const dom = renderer.domElement; dom.tabIndex = 0;
    const kh = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys[k] = e.type === "keydown";
      if (e.type === "keydown") {
        if (k === " ") oneShot("kick");
        if (k === "e") oneShot("wave");           // wave uses greeting one-shot
        if (k === "q") oneShot("nod");
        if (k === "c") camMode = (camMode + 1) % 2;
        if (k === "shift") running = true;
      }
      if (e.type === "keyup" && k === "shift") running = false;
      if ([" ", "w", "a", "s", "d", "e", "q", "c", "Shift"].includes(k)) e.preventDefault();
    };
    dom.addEventListener("keydown", kh); dom.addEventListener("keyup", kh);

    // drag look
    let drag = false, lx = 0, ly = 0;
    dom.addEventListener("pointerdown", (e) => { if (e.target.closest && e.target.closest(".gta-stick,.gta-btns")) return; drag = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture(e.pointerId); dom.focus(); });
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

      // movement input (camera-relative)
      let ix = 0, iz = 0;
      if (keys.w) iz -= 1; if (keys.s) iz += 1; if (keys.a) ix -= 1; if (keys.d) ix += 1;
      if (sMag > 0.15) { ix += Math.cos(sAng) * sMag; iz += Math.sin(sAng) * sMag; }
      const mag = Math.min(1, Math.hypot(ix, iz));
      player.moving = mag > 0.12 && charReady;

      if (player.moving) {
        // direction in world from camera yaw
        const dir = Math.atan2(ix, -iz) + camYaw;
        const spd = (running ? 12 : 6) * mag;
        const nx = player.pos.x + Math.sin(dir) * spd * dt;
        const nz = player.pos.z + Math.cos(dir) * spd * dt;
        if (!nearestBlocked(nx, player.pos.z)) player.pos.x = nx;
        if (!nearestBlocked(player.pos.x, nz)) player.pos.z = nz;
        player.pos.x = clamp(player.pos.x, -150, 150); player.pos.z = clamp(player.pos.z, -150, 150);
        // face movement direction (smooth)
        player.yaw = lerpAngle(player.yaw, dir, clamp(dt * 10, 0, 1));
        if (current !== actions.kick && current !== actions.nod) fadeTo("walk", 0.2);
      } else if (charReady && current !== actions.kick && current !== actions.nod && current !== actions.wave) {
        fadeTo("idle", 0.3);
      }
      // run animation faster when running
      if (actions.walk) actions.walk.setEffectiveTimeScale(running ? 1.6 : 1.0);

      if (char) { char.position.set(player.pos.x, 0, player.pos.z); char.rotation.y = player.yaw + faceOffset; }
      if (mixer) mixer.update(dt);

      // camera follow
      const tgt = new T.Vector3(player.pos.x, 3.2, player.pos.z);
      const cd = camMode === 0 ? camDist : 5.5, cp = camMode === 0 ? camPitch : 0.1;
      const cxp = tgt.x - Math.sin(camYaw) * Math.cos(cp) * cd;
      const czp = tgt.z - Math.cos(camYaw) * Math.cos(cp) * cd;
      const cyp = tgt.y + Math.sin(cp) * cd + 2;
      camera.position.lerp(new T.Vector3(cxp, cyp, czp), clamp(dt * 8, 0, 1));
      camera.lookAt(tgt);

      renderer.render(scene, camera);
    }
    function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
    requestAnimationFrame(frame);
    setTimeout(() => dom.focus(), 40);

    return { dispose: () => { cancelAnimationFrame(raf); renderer.dispose && renderer.dispose(); } };
  }

  window.GTA = { start };
})();
