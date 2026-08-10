/* Small system utilities: Color Picker and the Run (Win+R) dialog. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const cw = (opts) => window.WM.createWindow(opts);

  // ---------------- Color Picker ----------------
  function hsvToRgb(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  const hex2 = (n) => n.toString(16).padStart(2, "0");
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.colorpicker = function () {
    const ref = cw({ title: "Color Picker", icon: window.Icon ? Icon.mini("colorpicker", "Color Picker") : "", width: 420, height: 560, appId: "colorpicker" });
    const body = ref.body; body.classList.add("cpick-host");
    let h = 210, s = 0.75, v = 0.9;
    const recents = [];
    body.innerHTML = `<div class="cpick">
      <div class="cpick-area"><div class="cpick-area-thumb"></div></div>
      <div class="cpick-hue"><div class="cpick-hue-thumb"></div></div>
      <div class="cpick-preview"><span class="cpick-swatch"></span><div class="cpick-vals">
        <div class="cpick-row"><label>HEX</label><input class="cpick-hex" spellcheck="false"></div>
        <div class="cpick-row"><label>RGB</label><span class="cpick-rgb"></span></div>
        <div class="cpick-row"><label>HSL</label><span class="cpick-hsl"></span></div>
      </div><button class="cpick-copy" title="Copy HEX">Copy</button></div>
      <div class="cpick-presets"></div>
      <div class="cpick-recent-h">Recent</div><div class="cpick-recent"></div>
    </div>`;
    const area = body.querySelector(".cpick-area"), areaThumb = body.querySelector(".cpick-area-thumb");
    const hue = body.querySelector(".cpick-hue"), hueThumb = body.querySelector(".cpick-hue-thumb");
    const swatch = body.querySelector(".cpick-swatch"), hexIn = body.querySelector(".cpick-hex");
    function hexStr() { const [r, g, b] = hsvToRgb(h, s, v); return "#" + hex2(r) + hex2(g) + hex2(b); }
    function paint() {
      area.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${h},100%,50%)`;
      areaThumb.style.left = s * 100 + "%"; areaThumb.style.top = (1 - v) * 100 + "%";
      hueThumb.style.left = (h / 360 * 100) + "%";
      const [r, g, b] = hsvToRgb(h, s, v); const hx = hexStr();
      swatch.style.background = hx; hexIn.value = hx.toUpperCase();
      body.querySelector(".cpick-rgb").textContent = `${r}, ${g}, ${b}`;
      const [hh, ss, ll] = rgbToHsl(r, g, b); body.querySelector(".cpick-hsl").textContent = `${hh}°, ${ss}%, ${ll}%`;
    }
    function drag(elm, onMove) {
      elm.addEventListener("pointerdown", (e) => { elm.setPointerCapture(e.pointerId); const r = elm.getBoundingClientRect(); const mv = (ev) => onMove(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))); mv(e); const up = () => { elm.removeEventListener("pointermove", mv); elm.removeEventListener("pointerup", up); pushRecent(); }; elm.addEventListener("pointermove", mv); elm.addEventListener("pointerup", up); });
    }
    drag(area, (x, y) => { s = x; v = 1 - y; paint(); });
    drag(hue, (x) => { h = x * 360; paint(); });
    hexIn.onchange = () => { const m = /^#?([0-9a-f]{6})$/i.exec(hexIn.value.trim()); if (!m) { paint(); return; } const n = parseInt(m[1], 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const [hh, ss, ll] = rgbToHsl(r, g, b); h = hh; s = ss / 100 > 0 ? (Math.max(r, g, b) - Math.min(r, g, b)) / (Math.max(r, g, b) || 1) : 0; v = Math.max(r, g, b) / 255; paint(); pushRecent(); };
    body.querySelector(".cpick-copy").onclick = () => { const t = hexStr().toUpperCase(); try { navigator.clipboard && navigator.clipboard.writeText(t); } catch (_) {} if (window.Notify) Notify.show({ title: "Color Picker", body: "Copied " + t }); };
    const PRESETS = ["#E81123", "#F7630C", "#FFB900", "#107C10", "#00B7C3", "#0078D4", "#5C2D91", "#E3008C", "#000000", "#767676", "#FFFFFF"];
    const pr = body.querySelector(".cpick-presets");
    PRESETS.forEach((c) => { const b = el(`<button class="cpick-chip" style="background:${c}" title="${c}"></button>`); b.onclick = () => { const n = parseInt(c.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255; const [hh] = rgbToHsl(r, g, bl); h = hh; const mx = Math.max(r, g, bl) / 255, mn = Math.min(r, g, bl) / 255; v = mx; s = mx ? (mx - mn) / mx : 0; paint(); pushRecent(); }; pr.appendChild(b); });
    const recentEl = body.querySelector(".cpick-recent");
    function pushRecent() { const hx = hexStr().toUpperCase(); if (recents[0] === hx) return; recents.unshift(hx); if (recents.length > 10) recents.pop(); recentEl.innerHTML = recents.map((c) => `<button class="cpick-chip" style="background:${c}" title="${c}"></button>`).join(""); recentEl.querySelectorAll(".cpick-chip").forEach((b, i) => b.onclick = () => { hexIn.value = recents[i]; hexIn.onchange(); }); }
    paint();
  };

  // ---------------- Run dialog (Win+R) ----------------
  const RUN_MAP = {
    notepad: "notepad", calc: "calculator", calculator: "calculator", cmd: "terminal", terminal: "terminal",
    powershell: "powershell", pwsh: "powershell", mspaint: "paint", paint: "paint", explorer: "fileexplorer",
    control: "settings", settings: "settings", msedge: "edge", edge: "edge", chrome: "chrome", winword: "word",
    word: "word", excel: "excel", powerpnt: "powerpoint", powerpoint: "powerpoint", outlook: "outlook",
    clock: "clock", solitaire: "solitaire", blender: "blender", blockbench: "blockbench", copilot: "copilot",
    photos: "photos", camera: "camera", store: "store__", xbox: "xbox", vscode: "vscode", code: "vscode",
    defender: "security", windowsdefender: "security", minecraft: "minecraft",
  };
  window.AppRegistry.run = function () {
    const ref = cw({ title: "Run", icon: window.Icon ? Icon.mini("run", "Run") : "", width: 420, height: 210, appId: "run", noMax: true });
    const body = ref.body; body.classList.add("run-host");
    body.innerHTML = `<div class="run">
      <div class="run-top"><img class="run-ic" src="assets/run.png?v=1" alt=""><p>Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.</p></div>
      <div class="run-field"><label>Open:</label><input class="run-in" spellcheck="false" autocomplete="off"></div>
      <div class="run-btns"><button class="run-ok">OK</button><button class="run-cancel">Cancel</button><button class="run-browse">Browse…</button></div>
    </div>`;
    const input = body.querySelector(".run-in");
    setTimeout(() => input.focus(), 60);
    function go() {
      const raw = input.value.trim(); if (!raw) return;
      const key = raw.toLowerCase().replace(/\.exe$/, "").replace(/\s+/g, "");
      if (RUN_MAP[key]) { ref.close && ref.close(); window.WM.open(RUN_MAP[key]); return; }
      if (/^(https?:\/\/|www\.)|\.[a-z]{2,}($|\/)/i.test(raw)) { ref.close && ref.close(); if (window.Browser) window.Browser.openTo(raw.replace(/^https?:\/\//, "")); else window.WM.open("edge"); return; }
      if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("run", "Run") : "", title: "Run", body: `Windows cannot find '${raw}'. Check the spelling and try again.` });
    }
    body.querySelector(".run-ok").onclick = go;
    body.querySelector(".run-browse").onclick = () => window.WM.open("fileexplorer");
    body.querySelector(".run-cancel").onclick = () => ref.close && ref.close();
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); if (e.key === "Escape") ref.close && ref.close(); });
  };

  // Win+R opens the Run dialog (desktop keyboards).
  document.addEventListener("keydown", (e) => {
    if (e.metaKey && (e.key === "r" || e.key === "R")) {
      const desktopReady = document.querySelector(".desktop") && !document.querySelector(".lock-layer, .boot-layer");
      if (desktopReady) { e.preventDefault(); window.AppRegistry.run(); }
    }
  });
})();
