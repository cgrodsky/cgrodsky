/* Built-in apps: Store, Calculator, Media Player, Settings, Notepad, Paint, Clock, MS365, YouTube launcher. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  // ---------- Store ----------
  AppRegistry.store = function () {
    const { body } = cw({ title: "Microsoft Store", icon: Icon.mini("store__", "Store"), width: 860, height: 600, appId: "store__" });
    const cats = ["All", ...new Set(Catalog.storeApps.map((a) => a.cat))];
    body.innerHTML = `<div style="display:flex;height:100%">
      <div style="width:180px;background:var(--bg-elev);padding:12px" class="store-nav"></div>
      <div style="flex:1;padding:16px;overflow:auto" class="store-main"></div></div>`;
    const nav = body.querySelector(".store-nav"), main = body.querySelector(".store-main");
    let active = "All";
    cats.forEach((c) => {
      const n = el(`<div class="nav" style="padding:10px;border-radius:6px;cursor:pointer">${c}</div>`);
      n.onclick = () => { active = c; renderNav(); renderApps(); };
      nav.appendChild(n);
    });
    function renderNav() { [...nav.children].forEach((x) => x.classList.toggle("active", x.textContent === active)); }
    function renderApps() {
      main.innerHTML = "";
      const grid = el(`<div class="amz-grid"></div>`);
      Catalog.storeApps.filter((a) => active === "All" || a.cat === active).forEach((a) => {
        const installed = isInstalled(a.id);
        const card = el(`<div class="amz-card">
          <div style="display:flex;justify-content:center;margin-bottom:8px">${Icon.big(a.id, a.name)}</div>
          <div><b>${a.name}</b></div>
          <div class="muted" style="font-size:.78rem;flex:1">${a.desc || a.cat}</div>
          <div class="muted" style="font-size:.75rem">${a.cat}</div>
          <button class="pill-btn act">${installed ? "Open" : (a.price ? "$" + a.price.toFixed(2) : "Get")}</button>
        </div>`);
        card.querySelector(".act").onclick = () => {
          if (installed) { window.WM.open(a.id); return; }
          if (a.price && S().bank.balance < a.price) { alert("Insufficient funds."); return; }
          const doInstall = () => {
            if (a.price) State.addTransaction({ vendor: "App Store", item: a.name, amount: a.price, refundable: true, kind: "app", refId: a.id });
            if (!S().installedApps.includes(a.id)) S().installedApps.push(a.id);
            State.save();
            if (window.WM.refreshDesktopIcons) window.WM.refreshDesktopIcons();
            Notify.show({ icon: "", title: "Installed", body: a.name + " is now on your home screen.", onClick: () => window.WM.open(a.id) });
            renderApps();
          };
          if (a.price) Pay.ensureCard(doInstall); else doInstall();
        };
        grid.appendChild(card);
      });
      main.appendChild(grid);
    }
    renderNav(); renderApps();
  };

  function isInstalled(id) {
    const defaults = ["browser", "chrome", "settings", "calculator", "mediaplayer", "youtubeApp", "ms365", "notepad", "copilot", "imagestudio", "textgen", "fileexplorer", "files", "duolingo", "blockfinder", "messenger", "word", "powerpoint", "minecraft", "codeeditor", "achievements", "store__"];
    return defaults.includes(id) || S().installedApps.includes(id);
  }

  // ---------- Calculator ----------
  AppRegistry.calculator = function () {
    const { body } = cw({ title: "Calculator", icon: Icon.mini("calculator", "Calc"), width: 320, height: 460, appId: "calculator" });
    body.innerHTML = `<div class="calc"><div class="calc-display" id="disp">0</div><div class="calc-grid"></div></div>`;
    const disp = body.querySelector("#disp"), grid = body.querySelector(".calc-grid");
    let cur = "0", prev = null, op = null, fresh = true;
    const keys = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="];
    keys.forEach((k) => {
      const isOp = ["÷", "×", "−", "+", "=", "C", "±", "%"].includes(k);
      const b = el(`<button class="${isOp && k !== "C" ? "op" : ""}" ${k === "0" ? 'style="grid-column:span 2"' : ""}>${k}</button>`);
      b.onclick = () => press(k);
      grid.appendChild(b);
    });
    function press(k) {
      if (k === "C") { cur = "0"; prev = null; op = null; fresh = true; }
      else if ("0123456789".includes(k)) { cur = fresh ? k : (cur === "0" ? k : cur + k); fresh = false; }
      else if (k === ".") { if (!cur.includes(".")) cur += "."; fresh = false; }
      else if (k === "±") cur = String(parseFloat(cur) * -1);
      else if (k === "%") cur = String(parseFloat(cur) / 100);
      else if (["÷", "×", "−", "+"].includes(k)) { if (op && !fresh) compute(); prev = parseFloat(cur); op = k; fresh = true; }
      else if (k === "=") compute();
      disp.textContent = cur;
    }
    function compute() {
      if (op == null || prev == null) return;
      const b = parseFloat(cur);
      let r = prev;
      if (op === "+") r = prev + b; if (op === "−") r = prev - b; if (op === "×") r = prev * b; if (op === "÷") r = b ? prev / b : 0;
      cur = String(Math.round(r * 1e10) / 1e10); op = null; prev = null; fresh = true;
    }
  };

  // ---------- Media Player ----------
  AppRegistry.mediaplayer = function () {
    const { body } = cw({ title: "Media Player", icon: Icon.mini("mediaplayer", "Media"), width: 640, height: 480, appId: "mediaplayer" });
    body.innerHTML = `<div class="mp"><button class="pill-btn" id="pick">Open a file from your device</button>
      <div id="stage" class="center-col grow" style="justify-content:center"><p class="muted">No media loaded.</p></div></div>`;
    const stage = body.querySelector("#stage");
    body.querySelector("#pick").onclick = () => {
      const inp = document.getElementById("globalFileInput");
      inp.accept = "video/*,audio/*,image/*"; inp.value = "";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const url = URL.createObjectURL(f);
        stage.innerHTML = "";
        let elem;
        if (f.type.startsWith("video")) elem = el(`<video src="${url}" controls autoplay></video>`);
        else if (f.type.startsWith("audio")) elem = el(`<audio src="${url}" controls autoplay></audio>`);
        else if (f.type.startsWith("image")) elem = el(`<img src="${url}">`);
        else { stage.innerHTML = "<p class='muted'>Unsupported file type.</p>"; return; }
        stage.appendChild(elem);
        stage.appendChild(el(`<p class="muted">${f.name}</p>`));
      };
      inp.click();
    };
  };

  // ---------- VLC media player (Store app) ----------
  AppRegistry.vlc = function () {
    const { body } = cw({ title: "VLC media player", icon: Icon.mini("vlc", "VLC"), width: 680, height: 500, appId: "vlc" });
    body.innerHTML = `<div class="vlc">
      <div class="vlc-head">${Icon.mini("vlc", "VLC")} <b>VLC media player</b><span class="grow"></span><button class="pill-btn" id="pick">Open media…</button></div>
      <div class="vlc-stage" id="stage"><div class="center-col" style="justify-content:center;height:100%"><div style="transform:scale(2);margin-bottom:16px">${Icon.big("vlc", "VLC")}</div><p class="muted">Open a video or audio file to start playback.</p></div></div>
    </div>`;
    const stage = body.querySelector("#stage");
    body.querySelector("#pick").onclick = () => {
      const inp = document.getElementById("globalFileInput");
      inp.accept = "video/*,audio/*"; inp.value = "";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const url = URL.createObjectURL(f);
        stage.innerHTML = "";
        const elem = f.type.startsWith("audio")
          ? el(`<audio src="${url}" controls autoplay style="width:90%"></audio>`)
          : el(`<video src="${url}" controls autoplay style="max-width:100%;max-height:100%"></video>`);
        stage.appendChild(elem);
        stage.appendChild(el(`<p class="muted" style="margin-top:8px">${f.name}</p>`));
      };
      inp.click();
    };
  };

  // ---------- Settings ----------
  AppRegistry.settings = function () {
    const { body } = cw({ title: "Settings", icon: Icon.mini("settings", "Settings"), width: 760, height: 540, appId: "settings" });
    body.innerHTML = `<div class="settings">
      <div class="settings-nav">
        <div class="nav active" data-p="personal">Personalization</div>
        <div class="nav" data-p="access">Accessibility</div>
        <div class="nav" data-p="account">Account</div>
        <div class="nav" data-p="time">Time & language</div>
        <div class="nav" data-p="icons">Personalize icons</div>
        <div class="nav" data-p="system">System</div>
      </div>
      <div class="settings-body"></div></div>`;
    const sb = body.querySelector(".settings-body");
    const navs = body.querySelectorAll(".nav");
    navs.forEach((n) => n.onclick = () => { navs.forEach((x) => x.classList.remove("active")); n.classList.add("active"); render(n.dataset.p); });

    function render(p) {
      sb.innerHTML = "";
      if (p === "personal") {
        sb.appendChild(el(`<h2>Background</h2>`));
        // Windows 12 default wallpapers (wall3 = default) then a color palette.
        const walls = [
          { v: "default", img: "assets/wall3.jpg" },
          { v: "assets/wall1.jpg", img: "assets/wall1.jpg" },
          { v: "assets/wall2.jpg", img: "assets/wall2.jpg" },
        ];
        const wgrid = el(`<div class="swatch-grid"></div>`);
        walls.forEach((w) => {
          const sw = el(`<div class="swatch swatch-wall" style="background:url(${w.img}) center/cover"></div>`);
          const cur = S().desktop.wallpaper || "default";
          if (cur === w.v) sw.classList.add("sel");
          sw.onclick = () => { S().desktop.wallpaper = w.v; State.save(); window.applyWallpaper(); render("personal"); };
          wgrid.appendChild(sw);
        });
        sb.appendChild(wgrid);
        // Themes
        sb.appendChild(el(`<h2 style="margin-top:18px">Theme</h2>`));
        const xpOn = !!(S().desktop && S().desktop.xpTheme);
        const themeRow2 = el(`<div class="toggle-row" id="themeSel">
          <button data-t="default" class="${xpOn ? "" : "sel"}">Windows 12</button>
          <button data-t="xp" class="${xpOn ? "sel" : ""}">Windows XP</button>
        </div>`);
        themeRow2.querySelectorAll("button").forEach((b) => b.onclick = () => {
          const xp = b.dataset.t === "xp";
          S().desktop.xpTheme = xp;
          S().desktop.wallpaper = xp ? "assets/xp_wallpaper.png" : "default";
          document.body.classList.toggle("xp-theme", xp);
          State.save(); window.applyWallpaper(); render("personal");
        });
        sb.appendChild(el(`<p class="muted" style="margin:6px 0">Windows XP applies the classic Bliss wallpaper and retro accent.</p>`));
        sb.appendChild(themeRow2);
        // Accent color: two preset rows + current chip + custom picker (HSB box + hue slider + hex)
        sb.appendChild(el(`<h2 style="margin-top:18px">Accent color</h2>`));
        const cur = S().accent || "#0067c0";
        const accentHead = el(`<div class="accent-head"><span class="accent-current" style="background:${cur}"></span><span class="accent-cur-hex">${cur.toUpperCase()}</span></div>`);
        sb.appendChild(accentHead);
        const ACCENTS = [
          ["#0067c0", "#0078d4", "#2a5bd7", "#6b57ff", "#8a5cf6", "#b146c2", "#e3008c", "#e81123"],
          ["#da3b01", "#ff8c00", "#ffb900", "#107c10", "#00b294", "#038387", "#4a5459", "#1d1d21"],
        ];
        function setAccent(hx) {
          S().accent = hx; State.save();
          document.documentElement.style.setProperty("--accent", hx);
          accentHead.querySelector(".accent-current").style.background = hx;
          accentHead.querySelector(".accent-cur-hex").textContent = hx.toUpperCase();
          sb.querySelectorAll(".accent-sw").forEach((s) => s.classList.toggle("sel", s.dataset.c && s.dataset.c.toLowerCase() === hx.toLowerCase()));
        }
        ACCENTS.forEach((rowColors) => {
          const row = el(`<div class="accent-row"></div>`);
          rowColors.forEach((c) => {
            const sw = el(`<button class="accent-sw ${c.toLowerCase() === cur.toLowerCase() ? "sel" : ""}" data-c="${c}" style="background:${c}"></button>`);
            sw.onclick = () => setAccent(c);
            row.appendChild(sw);
          });
          sb.appendChild(row);
        });
        // Custom color: a rainbow swatch that opens the custom picker
        const customRow = el(`<div class="accent-row" style="margin-top:4px"><span class="muted" style="font-size:.82rem;margin-right:8px">Custom</span><span id="accent-custom-host"></span></div>`);
        sb.appendChild(customRow);
        const accentPicker = makeColorPicker(cur, (hx) => setAccent(hx));
        accentPicker.el.classList.add("accent-custom");
        customRow.querySelector("#accent-custom-host").replaceWith(accentPicker.el);

        sb.appendChild(el(`<h2 style="margin-top:18px">Solid colors</h2>`));
        const colors = ["#0067c0", "#7b5cff", "#e53935", "#43a047", "#fb8c00", "#00897b", "#222", "#111827", "#5a189a", "#b5179e", "#006466"];
        const grid = el(`<div class="swatch-grid"></div>`);
        colors.forEach((c) => {
          const sw = el(`<div class="swatch" style="background:${c}"></div>`);
          if (S().desktop.wallpaper === c) sw.classList.add("sel");
          sw.onclick = () => { S().desktop.wallpaper = c; State.save(); window.applyWallpaper(); render("personal"); };
          grid.appendChild(sw);
        });
        sb.appendChild(grid);
        const up = el(`<button class="pill-btn" style="margin-top:16px">Upload an image</button>`);
        up.onclick = () => {
          const inp = document.getElementById("globalFileInput"); inp.accept = "image/*"; inp.value = "";
          inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { S().desktop.wallpaper = r.result; State.save(); window.applyWallpaper(); }; r.readAsDataURL(f); };
          inp.click();
        };
        sb.appendChild(up);
      } else if (p === "access") {
        sb.appendChild(el(`<h2>Accessibility</h2>`));
        const themeRow = el(`<div class="toggle-row"><button data-v="light">Light</button><button data-v="dark">Dark</button></div>`);
        themeRow.querySelectorAll("button").forEach((b) => { b.classList.toggle("sel", b.dataset.v === S().theme); b.onclick = () => { S().theme = b.dataset.v; document.body.classList.toggle("dark", S().theme === "dark"); State.save(); window.applyWallpaper(); render("access"); }; });
        sb.appendChild(el(`<label class="muted">Appearance</label>`)); sb.appendChild(themeRow);
        sb.appendChild(el(`<label class="muted">Text size: ${S().textScale}%</label>`));
        const ts = el(`<input type="range" min="80" max="180" step="10" value="${S().textScale}">`);
        ts.oninput = () => { S().textScale = +ts.value; document.documentElement.style.setProperty("--scale", ts.value / 100); State.save(); };
        sb.appendChild(ts);
        const oskBtn = el(`<button class="pill-btn" style="margin-top:16px">Toggle on-screen keyboard</button>`);
        let on = false; oskBtn.onclick = () => { on = !on; on ? OSK.show() : OSK.hide(); };
        sb.appendChild(oskBtn);
      } else if (p === "account") {
        const a = S().account, pr = S().profile;
        sb.appendChild(el(`<h2>Your account</h2>`));
        sb.appendChild(el(`<div class="row" style="gap:16px"><div>${pr.picture ? `<img class="pic-circle-preview" src="${pr.picture}">` : Icon.big("user", pr.username)}</div>
          <div><h3 style="margin:0">${pr.username}</h3><div class="muted">${a ? a.email : "Local account (no email)"}</div>
          <div class="muted">Sign-in: ${pr.authType}</div></div></div>`));
        sb.appendChild(el(`<p class="muted">Windows activation: ${S().hasProductKey ? "Activated (" + S().productKey + ")" : "Not activated"}</p>`));
      } else if (p === "time") {
        sb.appendChild(el(`<h2>Time & language</h2>`));
        sb.appendChild(el(`<p>Region: <b>${S().region}</b></p><p>Language: <b>${S().language}</b></p>`));
        sb.appendChild(el(`<p>Clock: <b>${S().clock.mode}</b>, ${S().clock.format24 ? "24-hour" : "12-hour"}</p>`));
        sb.appendChild(el(`<p>Current time: <b>${State.formatClock()}</b></p>`));
        const fmt = el(`<button class="pill-btn">Toggle 12/24-hour</button>`); fmt.onclick = () => { S().clock.format24 = !S().clock.format24; State.save(); render("time"); };
        sb.appendChild(fmt);
      } else if (p === "system") {
        sb.appendChild(el(`<h2>System</h2><p class="muted">Windows 12 — simulation build</p>`));
        const reset = el(`<button class="pill-btn" style="background:#c0392b">Factory Reset</button>`);
        reset.onclick = () => window.WM.factoryReset();
        sb.appendChild(reset);
      } else if (p === "icons") {
        renderIconCustomizer(sb);
      }
    }
    render("personal");
  };

  // ---------- Notepad ----------
  AppRegistry.notepad = function () {
    const { body } = cw({ title: "Notepad", icon: Icon.mini("notepad", "Notepad"), width: 560, height: 440, appId: "notepad" });
    body.innerHTML = `<textarea style="width:100%;height:100%;border:none;outline:none;resize:none;padding:14px;background:var(--window-bg);color:var(--text);font-family:Consolas,monospace;font-size:1rem"></textarea>`;
  };

  // ---------- Paint ----------
  // ---------- Color picker (vanilla port of a HeroUI-style ColorPicker) ----------
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function hexToRgb(hex) { hex = hex.replace("#", ""); return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]; }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, max ? d / max : 0, max];
  }
  function hsvToHex(h, s, v) {
    const i = Math.floor(h / 60) % 6, f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
    return "#" + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
  }
  function dragify(elm, cb) {
    const frac = (e) => {
      const r = elm.getBoundingClientRect(), t = e.touches && e.touches[0];
      return [clamp01(((t ? t.clientX : e.clientX) - r.left) / r.width), clamp01(((t ? t.clientY : e.clientY) - r.top) / r.height)];
    };
    const down = (e) => {
      e.preventDefault();
      const [fx, fy] = frac(e); cb(fx, fy);
      const mv = (ev) => { const [x, y] = frac(ev); cb(x, y); };
      const up = () => {
        window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
        window.removeEventListener("touchmove", mv); window.removeEventListener("touchend", up);
      };
      window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
      window.addEventListener("touchmove", mv, { passive: false }); window.addEventListener("touchend", up);
    };
    elm.addEventListener("mousedown", down);
    elm.addEventListener("touchstart", down, { passive: false });
  }
  function makeColorPicker(initial, onChange) {
    let [h, s, v] = rgbToHsv.apply(null, hexToRgb(initial));
    const root = el(`<div class="cpk"><button type="button" class="cpk-trigger" title="Color"><span class="cpk-swatch"></span><span class="cpk-hex"></span></button></div>`);
    const swatch = root.querySelector(".cpk-swatch"), hexLbl = root.querySelector(".cpk-hex");
    let pop = null;
    const hex = () => hsvToHex(h, s, v);
    function refresh() {
      const hx = hex();
      swatch.style.background = hx; hexLbl.textContent = hx.toUpperCase();
      if (pop) {
        pop.querySelector(".cpk-area").style.background = `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0)), hsl(${h}, 100%, 50%)`;
        const at = pop.querySelector(".cpk-area-thumb");
        at.style.left = (s * 100) + "%"; at.style.top = ((1 - v) * 100) + "%"; at.style.background = hx;
        pop.querySelector(".cpk-hue-thumb").style.left = (h / 360 * 100) + "%";
        pop.querySelector(".cpk-out").textContent = Math.round(h) + "°";
        const hi = pop.querySelector(".cpk-hex-input");
        if (hi && document.activeElement !== hi) hi.value = hx.replace("#", "").toUpperCase();
      }
      if (onChange) onChange(hx);
    }
    function positionPop() {
      const r = root.querySelector(".cpk-trigger").getBoundingClientRect();
      pop.style.left = Math.min(r.left, window.innerWidth - 236) + "px";
      pop.style.top = (r.bottom + 6) + "px";
    }
    function closePop() { if (!pop) return; document.removeEventListener("mousedown", outside); pop.remove(); pop = null; }
    function outside(e) { if (pop && !pop.contains(e.target) && !root.contains(e.target)) closePop(); }
    function openPop() {
      pop = el(`<div class="cpk-pop">
        <div class="cpk-area"><div class="cpk-area-thumb"></div></div>
        <div class="cpk-hue-row"><span>Hue</span><span class="cpk-out"></span></div>
        <div class="cpk-hue"><div class="cpk-hue-thumb"></div></div>
        <div class="cpk-hex-row"><span>#</span><input class="cpk-hex-input" maxlength="6" spellcheck="false"></div></div>`);
      document.getElementById("screen").appendChild(pop);
      positionPop();
      dragify(pop.querySelector(".cpk-area"), (fx, fy) => { s = fx; v = 1 - fy; refresh(); });
      dragify(pop.querySelector(".cpk-hue"), (fx) => { h = fx * 360; refresh(); });
      const hi = pop.querySelector(".cpk-hex-input");
      hi.addEventListener("input", () => {
        const val = hi.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
        if (val.length === 6) { [h, s, v] = rgbToHsv.apply(null, hexToRgb("#" + val)); refresh(); }
      });
      refresh();
      setTimeout(() => document.addEventListener("mousedown", outside), 0);
    }
    root.querySelector(".cpk-trigger").onclick = () => { if (pop) closePop(); else openPop(); };
    refresh();
    return { el: root, getValue: hex, destroy: closePop };
  }

  AppRegistry.paint = function () {
    const { body } = cw({ title: "Paint", icon: Icon.mini("paint", "Paint"), width: 640, height: 520, appId: "paint" });
    body.innerHTML = `<div style="padding:8px;display:flex;flex-direction:column;height:100%;gap:8px">
      <div class="row"><span id="col-host"></span><input type="range" id="sz" min="1" max="30" value="5"><button class="pill-btn" id="clr">Clear</button></div>
      <canvas width="600" height="420" style="background:#fff;border:1px solid var(--border);border-radius:6px;cursor:crosshair"></canvas></div>`;
    const picker = makeColorPicker("#0485F7", () => {});
    body.querySelector("#col-host").replaceWith(picker.el);
    const cv = body.querySelector("canvas"), ctx = cv.getContext("2d");
    let drawing = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.onmousedown = (e) => { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    cv.onmousemove = (e) => { if (!drawing) return; const p = pos(e); ctx.strokeStyle = picker.getValue(); ctx.lineWidth = body.querySelector("#sz").value; ctx.lineCap = "round"; ctx.lineTo(p.x, p.y); ctx.stroke(); };
    window.addEventListener("mouseup", () => drawing = false);
    body.querySelector("#clr").onclick = () => ctx.clearRect(0, 0, 600, 420);
    body.closest(".win").addEventListener("DOMNodeRemoved", () => picker.destroy());
  };

  // ---------- Clock ----------
  AppRegistry.clock = function () {
    const { body } = cw({ title: "Clock", icon: Icon.mini("clock", "Clock"), width: 380, height: 320, appId: "clock" });
    body.innerHTML = `<div class="center-col" style="justify-content:center;height:100%;gap:12px">
      <div id="big" style="font-size:3rem;font-weight:300"></div><div class="muted" id="date"></div></div>`;
    const tick = () => { const b = body.querySelector("#big"); if (!b) { clearInterval(iv); return; } b.textContent = State.formatClock(); body.querySelector("#date").textContent = State.formatDate(); };
    const iv = setInterval(tick, 1000); tick();
  };

  // ---------- MS365 launcher (opens browser to bundle chooser) ----------
  AppRegistry.ms365 = function () { window.Browser.openTo("microsoft.local"); };

  // ---------- YouTube launcher ----------
  AppRegistry.youtube = function () { window.Browser.openTo("youtube.local"); };

  // ---------- Duolingo launcher ----------
  AppRegistry.duolingo = function () { window.Browser.openTo("duolingo.local"); };

  // ---------- Icon customizer (Settings) ----------
  function renderIconCustomizer(host) {
    host.innerHTML = `<h2>Personalize icons</h2>
      <p class="muted">Upload an image to use as the icon. It's saved in this browser.</p>
      <div class="row" style="margin:10px 0 18px;gap:8px;flex-wrap:wrap">
        <button class="pill-btn" id="ic-copy">Copy icons as text (paste to Claude)</button>
        <button class="btn-text" id="ic-export">Download as files</button>
        <button class="btn-text" id="ic-view">View &amp; long-press to save</button>
        <p class="muted" style="font-size:.78rem;flex-basis:100%">Tap <b>Copy icons as text</b> and paste into your Claude chat — I'll commit the actual image files into the repo so they're global.</p>
      </div>
      <div id="ic-groups" style="display:flex;flex-direction:column;gap:18px"></div>`;
    host.querySelector("#ic-export").onclick = () => exportIconsAsFiles();
    host.querySelector("#ic-view").onclick = () => viewIconsForSave();
    host.querySelector("#ic-copy").onclick = () => copyIconsAsText();
    const groups = host.querySelector("#ic-groups");
    if (S().appData.customIcons == null) S().appData.customIcons = {};

    function group(title, items) {
      const sec = document.createElement("div");
      sec.innerHTML = `<h3 style="margin:6px 0">${title}</h3>`;
      const grid = document.createElement("div");
      grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px";
      items.forEach((it) => {
        const row = document.createElement("div");
        row.style.cssText = "border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center";
        const has = !!S().appData.customIcons[it.key];
        row.innerHTML = `<div>${Icon.md(it.key, it.name)}</div><div style="font-size:.8rem">${it.name}</div>
          <div class="row" style="gap:4px;flex-wrap:wrap;justify-content:center"><button class="btn-text up" style="padding:4px 8px">Upload</button>${has ? '<button class="btn-text cp" style="padding:4px 8px">Copy</button><button class="btn-text rm" style="padding:4px 8px;color:#c0392b">Remove</button>' : ""}</div>`;
        row.querySelector(".up").onclick = () => pickIcon(it.key);
        const cp = row.querySelector(".cp"); if (cp) cp.onclick = () => copyOneIcon(it.key);
        const rm = row.querySelector(".rm"); if (rm) rm.onclick = () => { delete S().appData.customIcons[it.key]; State.save(); renderIconCustomizer(host); };
        grid.appendChild(row);
      });
      sec.appendChild(grid); return sec;
    }

    const channelItems = Catalog.channels.map((c) => ({ key: c.id, name: c.name }));
    const appItems = Catalog.storeApps.filter((a) => !a.decorative).map((a) => ({ key: a.id === "duolingo" ? "duolingo_app" : a.id, name: a.name }));
    const courseItems = [
      { key: "duo_en", name: "English" }, { key: "duo_es", name: "Spanish" },
      { key: "duo_ja", name: "Japanese" }, { key: "duo_zh", name: "Mandarin" }, { key: "duo_sv", name: "Swedish" },
    ];
    const serverItems = Catalog.discordServers.map((s) => ({ key: s.id, name: s.name }));
    const duoVariants = [
      { key: "duolingo", name: "Duolingo (taskbar)" },
      { key: "duolingo_app", name: "Duolingo (home/Start)" },
      { key: "duolingo_super", name: "Super Duolingo" },
      { key: "duolingo_max", name: "Duolingo Max" },
      { key: "duo_sad", name: "Sad Duo (quit modal)" },
    ];
    const brandLogos = [
      { key: "bank", name: "Bank" },
      { key: "discord", name: "Discord (login)" },
      { key: "microsoft", name: "Microsoft" },
      { key: "amazon", name: "Amazon" },
      { key: "youtubeApp", name: "YouTube" },
    ];

    groups.appendChild(group("Duolingo variants", duoVariants));
    groups.appendChild(group("YouTube channels", channelItems));
    groups.appendChild(group("Duolingo courses", courseItems));
    groups.appendChild(group("Brand logos", brandLogos));
    groups.appendChild(group("Apps", appItems));
    groups.appendChild(group("Discord servers", serverItems));
  }

  function pickIcon(key) {
    const inp = document.getElementById("globalFileInput");
    inp.accept = "image/*"; inp.value = "";
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        // Downscale to 256x256 to keep localStorage small.
        const img = new Image();
        img.onload = () => {
          const sz = 128;
          const c = document.createElement("canvas"); c.width = sz; c.height = sz;
          const ctx = c.getContext("2d");
          // cover-fit
          const sc = Math.max(sz / img.width, sz / img.height);
          const w = img.width * sc, h = img.height * sc;
          ctx.drawImage(img, (sz - w) / 2, (sz - h) / 2, w, h);
          if (S().appData.customIcons == null) S().appData.customIcons = {};
          // JPEG is much smaller than PNG for paste-to-Claude bridge. Quality 0.85 is plenty for 128px.
          S().appData.customIcons[key] = c.toDataURL("image/jpeg", 0.85);
          try { State.save(); } catch (e) { alert("Storage full — try smaller/fewer images."); return; }
          // Re-render desktop + active settings panel
          if (window.WM.refreshDesktopIcons) window.WM.refreshDesktopIcons();
          const settingsBody = document.querySelector(".settings-body");
          if (settingsBody) renderIconCustomizer(settingsBody);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
    };
    inp.click();
  }

  function copyOneIcon(key) {
    const url = (S().appData.customIcons || {})[key];
    if (!url) return;
    const payload = `WIN12_ICON ${key} ${url}`;
    const showFallback = () => {
      const overlay = el(`<div class="modal-mask" style="z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">
        <div style="background:var(--window-bg);color:var(--text);max-width:520px;padding:24px;border-radius:12px">
          <h2 style="margin-top:0">Copy and paste to Claude</h2>
          <p>Tap inside, select all, copy, then paste into chat.</p>
          <textarea readonly style="width:100%;height:120px;font-family:monospace;font-size:.7rem">${payload}</textarea>
          <div style="text-align:right;margin-top:12px"><button class="pill-btn" id="cc">Close</button></div>
        </div></div>`);
      overlay.querySelector("#cc").onclick = () => overlay.remove();
      document.getElementById("screen").appendChild(overlay);
      const ta = overlay.querySelector("textarea"); ta.focus(); ta.select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(() => Notify.show({ icon: "", title: "Copied", body: key + " — paste it in Claude" })).catch(showFallback);
    } else showFallback();
  }

  function copyIconsAsText() {
    const icons = S().appData.customIcons || {};
    const entries = Object.entries(icons);
    if (!entries.length) { alert("No personalized icons yet."); return; }
    const payload = "WIN12_ICONS_BEGIN\n" + JSON.stringify(icons, null, 0) + "\nWIN12_ICONS_END";
    const finish = (ok) => {
      const overlay = el(`<div class="modal-mask" style="z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">
        <div style="background:var(--window-bg);color:var(--text);max-width:520px;padding:24px;border-radius:12px">
          <h2 style="margin-top:0">${ok ? "Copied!" : "Couldn't copy — copy manually"}</h2>
          <p>${ok ? "Switch to your Claude chat and paste. I'll see the icons and commit them to the repo." : "Select the text below and copy it, then paste it into your Claude chat."}</p>
          <textarea readonly style="width:100%;height:160px;font-family:monospace;font-size:.7rem">${payload}</textarea>
          <div style="text-align:right;margin-top:12px"><button class="pill-btn" id="cc">Close</button></div>
        </div></div>`);
      overlay.querySelector("#cc").onclick = () => overlay.remove();
      document.getElementById("screen").appendChild(overlay);
      const ta = overlay.querySelector("textarea"); ta.focus(); ta.select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(() => finish(true)).catch(() => finish(false));
    } else finish(false);
  }

  function exportIconsAsFiles() {
    const icons = S().appData.customIcons || {};
    const entries = Object.entries(icons);
    if (!entries.length) { alert("No personalized icons to export yet."); return; }
    entries.forEach(([key, url], i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = url; a.download = key + ".png";
        document.body.appendChild(a); a.click(); a.remove();
      }, i * 250);
    });
  }

  function viewIconsForSave() {
    const icons = S().appData.customIcons || {};
    const entries = Object.entries(icons);
    if (!entries.length) { alert("No personalized icons yet."); return; }
    const overlay = el(`<div class="modal-mask" style="z-index:9999;overflow:auto;padding:20px">
      <div style="background:var(--window-bg);color:var(--text);max-width:520px;margin:0 auto;padding:24px;border-radius:12px">
        <h2 style="margin-top:0">Save these to your device</h2>
        <p class="muted" style="margin-top:0">Long-press each image → <b>Save Image</b>. Then upload to <code>windows12/assets/</code> on GitHub with the filename shown.</p>
        <div id="ic-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-top:14px"></div>
        <div style="text-align:right;margin-top:18px"><button class="pill-btn" id="ic-close">Close</button></div>
      </div></div>`);
    const list = overlay.querySelector("#ic-list");
    entries.forEach(([key, url]) => {
      list.appendChild(el(`<div style="text-align:center"><img src="${url}" style="width:120px;height:120px;border-radius:8px;object-fit:cover;background:#0001"><div style="font-family:monospace;font-size:.8rem;margin-top:6px">${key}.png</div></div>`));
    });
    overlay.querySelector("#ic-close").onclick = () => overlay.remove();
    document.getElementById("screen").appendChild(overlay);
  }

  // ---------- Factory reset (Settings + Terminal command) ----------
  function factoryReset() {
    const secret = S().profile.secret;
    const label = S().profile.authType === "pin" ? "PIN" : "password";
    const p1 = prompt(`Factory reset — enter your ${label}:`);
    if (p1 == null) return false;
    if (secret && p1 !== secret) { alert("Incorrect."); return false; }
    const p2 = prompt(`Enter your ${label} again:`);
    if (p2 == null) return false;
    if (secret && p2 !== secret) { alert("Incorrect."); return false; }
    const c = prompt('Type CONFIRM (all caps) to reset this PC:');
    if (c !== "CONFIRM") { alert("Not confirmed."); return false; }
    // Keep icons/apps/desktop by default so you can "set up as new" without losing them.
    const keep = confirm("Keep your icons, installed apps and wallpaper?\n\nOK = keep them (recommended)\nCancel = wipe everything");
    State.reset(keep);
    location.reload();
    return true;
  }
  // Make available on the WM namespace for both Settings and Terminal to call.
  if (window.WM) window.WM.factoryReset = factoryReset;
  else { const iv = setInterval(() => { if (window.WM) { window.WM.factoryReset = factoryReset; clearInterval(iv); } }, 50); }
})();
