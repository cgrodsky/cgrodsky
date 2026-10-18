/* Blender & Blockbench — lightweight 3D apps built on the already-loaded Three.js.
   Shared orbit viewport: drag to rotate, wheel/pinch to zoom. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const cw = (opts) => window.WM.createWindow(opts);
  function dlFile(url, name) { const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

  // Build an orbiting Three.js viewport inside `host`. Returns { scene, camera, THREE, add, dispose }.
  function viewport(host, bg) {
    if (typeof THREE === "undefined") { host.innerHTML = `<div class="m3-noengine">3D engine (Three.js) failed to load. Check your connection and refresh.</div>`; return null; }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bg || 0x1e1e1e);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none";
    const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(4, 8, 6); scene.add(key);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const grid = new THREE.GridHelper(20, 20, 0x555555, 0x333333); scene.add(grid);

    let radius = 7, theta = 0.9, phi = 1.1, target = new THREE.Vector3(0, 0.5, 0);
    function place() {
      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(target);
    }
    function resize() { const w = host.clientWidth || 1, h = host.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    let dragging = false, lx = 0, ly = 0;
    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", (e) => { dragging = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener("pointermove", (e) => { if (!dragging) return; theta -= (e.clientX - lx) * 0.01; phi = Math.max(0.15, Math.min(3.0, phi - (e.clientY - ly) * 0.01)); lx = e.clientX; ly = e.clientY; });
    dom.addEventListener("pointerup", () => { dragging = false; });
    dom.addEventListener("wheel", (e) => { e.preventDefault(); radius = Math.max(2, Math.min(30, radius + Math.sign(e.deltaY) * 0.6)); }, { passive: false });
    let alive = true;
    function loop() {
      if (!alive || !document.body.contains(host)) { alive = false; renderer.dispose && renderer.dispose(); return; }
      resize(); place(); renderer.render(scene, camera); requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return { scene, camera, THREE, renderer, setTarget: (v) => { target.copy(v); } };
  }

  const PRIMS = {
    Cube: () => new THREE.BoxGeometry(2, 2, 2),
    "UV Sphere": () => new THREE.SphereGeometry(1.3, 32, 24),
    Cone: () => new THREE.ConeGeometry(1.3, 2.4, 32),
    Cylinder: () => new THREE.CylinderGeometry(1.2, 1.2, 2.2, 32),
    Torus: () => new THREE.TorusGeometry(1.2, 0.45, 20, 40),
    Icosphere: () => new THREE.IcosahedronGeometry(1.4, 1),
  };

  // ---------------- Blender ----------------
  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.blender = function () {
    const ref = cw({ title: "Blender", icon: window.Icon ? Icon.mini("blender", "Blender") : "", width: 940, height: 640, appId: "blender" });
    const body = ref.body; body.classList.add("bl-host");
    body.innerHTML = `<div class="bl">
      <div class="bl-menubar"><span class="bl-logo">${window.Icon ? Icon.mini("blender", "") : "🅱"}</span><span>File</span><span>Edit</span><span>Add</span><span>Object</span><span>Render</span><span>Window</span><span>Help</span><span class="grow"></span><span class="bl-scene">Scene · View Layer</span></div>
      <div class="bl-main">
        <div class="bl-tools">${["↖","✥","⟲","⤢","⊹"].map((t) => `<button class="bl-tool">${t}</button>`).join("")}</div>
        <div class="bl-viewport"></div>
        <div class="bl-side">
          <div class="bl-outliner"><div class="bl-panel-h">Outliner</div><div class="bl-tree"><div>▸ Scene Collection</div><div style="padding-left:14px">▸ 📷 Camera</div><div style="padding-left:14px">▸ 💡 Light</div><div style="padding-left:14px" class="on">▸ ◼ <b class="bl-objname">Cube</b></div></div></div>
          <div class="bl-props"><div class="bl-panel-h">Object Properties</div>
            <label>Mesh<select class="bl-prim">${Object.keys(PRIMS).map((k) => `<option>${k}</option>`).join("")}</select></label>
            <label>Base color<input type="color" class="bl-color" value="#c8792e"></label>
            <label class="bl-check"><input type="checkbox" class="bl-wire">Wireframe</label>
            <label class="bl-check"><input type="checkbox" class="bl-spin" checked>Auto-rotate</label>
            <button class="bl-export">Render image (PNG)</button>
            <div class="bl-stats"></div>
          </div>
        </div>
      </div>
    </div>`;
    const vp = viewport(body.querySelector(".bl-viewport"), 0x2b2b2b);
    if (!vp) return;
    let mat = new vp.THREE.MeshStandardMaterial({ color: 0xc8792e, roughness: 0.5, metalness: 0.1 });
    let mesh = new vp.THREE.Mesh(PRIMS.Cube(), mat); vp.scene.add(mesh);
    const stats = body.querySelector(".bl-stats");
    function updateStats(name) { const g = mesh.geometry; const verts = g.attributes.position.count; stats.innerHTML = `Verts: ${verts}<br>Object: ${name}`; body.querySelector(".bl-objname").textContent = name; }
    updateStats("Cube");
    let spin = true;
    body.querySelector(".bl-prim").onchange = (e) => { mesh.geometry.dispose(); mesh.geometry = PRIMS[e.target.value](); updateStats(e.target.value); };
    body.querySelector(".bl-color").oninput = (e) => { mat.color.set(e.target.value); };
    body.querySelector(".bl-wire").onchange = (e) => { mat.wireframe = e.target.checked; };
    body.querySelector(".bl-spin").onchange = (e) => { spin = e.target.checked; };
    body.querySelector(".bl-export").onclick = () => { try { vp.renderer.render(vp.scene, vp.camera); dlFile(vp.renderer.domElement.toDataURL("image/png"), "blender-render.png"); } catch (_) {} };
    (function anim() { if (!document.body.contains(body)) return; if (spin) mesh.rotation.y += 0.01; requestAnimationFrame(anim); })();
  };

  // ---------------- Blockbench ----------------
  window.AppRegistry.blockbench = function () {
    const ref = cw({ title: "Blockbench", icon: window.Icon ? Icon.mini("blockbench", "Blockbench") : "", width: 940, height: 640, appId: "blockbench" });
    const body = ref.body; body.classList.add("bb-host");
    body.innerHTML = `<div class="bb">
      <div class="bb-menubar"><span class="bb-logo">${window.Icon ? Icon.mini("blockbench", "") : "▦"}</span><span>File</span><span>Edit</span><span>Transform</span><span>View</span><span>Help</span><span class="grow"></span><span class="bb-title2">Untitled model</span></div>
      <div class="bb-main">
        <div class="bb-viewport"></div>
        <div class="bb-side">
          <div class="bb-panel-h">Outliner</div>
          <div class="bb-list"></div>
          <div class="bb-row"><button class="bb-add">+ Add Cube</button><button class="bb-del">Delete</button></div>
          <div class="bb-row"><button class="bb-export">Export model (.json)</button></div>
          <div class="bb-panel-h">Element</div>
          <div class="bb-el">
            <label>Color<input type="color" class="bb-color" value="#4cc3ff"></label>
            <label>X<input type="range" class="bb-x" min="-4" max="4" step="1" value="0"></label>
            <label>Y<input type="range" class="bb-y" min="-4" max="4" step="1" value="0"></label>
            <label>Z<input type="range" class="bb-z" min="-4" max="4" step="1" value="0"></label>
          </div>
        </div>
      </div>
    </div>`;
    const vp = viewport(body.querySelector(".bb-viewport"), 0x20242b);
    if (!vp) return;
    const T = vp.THREE;
    const cubes = []; let selected = -1;
    function addCube(x, y, z, color) {
      const g = new T.BoxGeometry(1, 1, 1);
      const m = new T.MeshStandardMaterial({ color: color || 0x4cc3ff, roughness: 0.6 });
      const mesh = new T.Mesh(g, m); mesh.position.set(x, y + 0.5, z); vp.scene.add(mesh);
      const edges = new T.LineSegments(new T.EdgesGeometry(g), new T.LineBasicMaterial({ color: 0x0a0a0a })); mesh.add(edges);
      cubes.push({ mesh, color: color || 0x4cc3ff }); return cubes.length - 1;
    }
    const listEl = body.querySelector(".bb-list");
    function renderList() {
      listEl.innerHTML = cubes.map((c, i) => `<div class="bb-li ${i === selected ? "on" : ""}" data-i="${i}"><span class="bb-sw" style="background:#${c.color.toString(16).padStart(6, "0")}"></span>Cube ${i + 1}</div>`).join("") || `<div class="bb-empty">No elements</div>`;
      listEl.querySelectorAll(".bb-li").forEach((r) => r.onclick = () => { selected = +r.dataset.i; syncEl(); renderList(); });
    }
    function syncEl() {
      const c = cubes[selected]; if (!c) return;
      body.querySelector(".bb-color").value = "#" + c.color.toString(16).padStart(6, "0");
      body.querySelector(".bb-x").value = Math.round(c.mesh.position.x);
      body.querySelector(".bb-y").value = Math.round(c.mesh.position.y - 0.5);
      body.querySelector(".bb-z").value = Math.round(c.mesh.position.z);
    }
    body.querySelector(".bb-add").onclick = () => { selected = addCube(0, cubes.length ? 1 : 0, 0); renderList(); syncEl(); };
    body.querySelector(".bb-del").onclick = () => { const c = cubes[selected]; if (!c) return; vp.scene.remove(c.mesh); cubes.splice(selected, 1); selected = Math.min(selected, cubes.length - 1); renderList(); syncEl(); };
    body.querySelector(".bb-color").oninput = (e) => { const c = cubes[selected]; if (!c) return; c.color = parseInt(e.target.value.slice(1), 16); c.mesh.material.color.set(e.target.value); renderList(); };
    ["x", "y", "z"].forEach((ax) => body.querySelector(".bb-" + ax).oninput = (e) => { const c = cubes[selected]; if (!c) return; const v = +e.target.value; c.mesh.position[ax] = ax === "y" ? v + 0.5 : v; });
    // seed a tiny starter model
    body.querySelector(".bb-export").onclick = () => {
      const model = { format: "blockbench-lite", elements: cubes.map((c, i) => ({ name: "Cube " + (i + 1), position: [Math.round(c.mesh.position.x), Math.round(c.mesh.position.y - 0.5), Math.round(c.mesh.position.z)], color: "#" + c.color.toString(16).padStart(6, "0") })) };
      dlFile("data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(model, null, 2)), "model.json");
    };
    addCube(0, 0, 0, 0x4cc3ff); addCube(1, 0, 0, 0xff5c8a); addCube(0, 1, 0, 0xffd23f); selected = 0;
    renderList(); syncEl();
  };
})();
