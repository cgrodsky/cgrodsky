/* Fake UAC prompt, EXE installer flow (terminal -> installer), and the iTunes app.
   "Not for real" — purely cosmetic; nothing actually changes on the device. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const cw = (opts) => window.WM.createWindow(opts);
  const S = () => State.data;
  const screen = () => document.getElementById("screen");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const mini = (k, n) => (window.Icon ? Icon.mini(k, n) : "");

  // ---------------- UAC ----------------
  window.UAC = {
    prompt(opts, onAllow, onDeny) {
      opts = opts || {};
      const mask = el(`<div class="uac-mask"></div>`);
      const dlg = el(`<div class="uac">
        <div class="uac-head">User Account Control</div>
        <div class="uac-body">
          <p class="uac-q">Do you want to allow this app to make changes to your device?</p>
          <div class="uac-app"><span class="uac-ic">${mini(opts.iconKey || "settings", opts.name || "App")}</span>
            <div class="uac-meta"><b>${opts.name || "App"}</b><span>Verified publisher: ${opts.publisher || "Microsoft Windows"}</span></div></div>
          <button class="uac-more">Show more details</button>
        </div>
        <div class="uac-btns"><button class="uac-yes">Yes</button><button class="uac-no">No</button></div>
      </div>`);
      mask.appendChild(dlg); screen().appendChild(mask);
      const close = () => mask.remove();
      dlg.querySelector(".uac-yes").onclick = () => { close(); onAllow && onAllow(); };
      dlg.querySelector(".uac-no").onclick = () => { close(); onDeny && onDeny(); };
    },
  };

  // ---------------- EXE installer flow ----------------
  const EXE = {
    chrome: { name: "Google Chrome", exe: "ChromeSetup.exe", pub: "Google LLC" },
    blender: { name: "Blender", exe: "blender-4.2-windows-x64.exe", pub: "Blender Foundation" },
    blockbench: { name: "Blockbench", exe: "Blockbench_Setup.exe", pub: "JannisX11" },
  };
  async function terminalStage(meta) {
    const t = cw({ title: "C:\\Windows\\System32\\cmd.exe", icon: mini("terminal", "cmd"), width: 580, height: 300, noMax: true });
    const out = el(`<div class="exe-term"></div>`); t.body.appendChild(out);
    const lines = [
      "Microsoft Windows [Version 12.0.2026]", "(c) Cameron Systems. All rights reserved.", "",
      "C:\\Users\\User\\Downloads> " + meta.exe, "Verifying digital signature... OK",
      "Publisher: " + meta.pub, "Extracting installer package...", "Launching " + meta.name + " Setup...",
    ];
    for (const ln of lines) { const d = document.createElement("div"); d.textContent = ln; out.appendChild(d); out.scrollTop = out.scrollHeight; await wait(220); }
    await wait(550); t.close && t.close();
  }
  async function installerStage(meta, iconHtml) {
    const w = cw({ title: meta.name + " Setup", icon: iconHtml, width: 480, height: 300, noMax: true, noMin: true });
    w.body.innerHTML = `<div class="exe-inst">
      <img class="exe-inst-ic" src="assets/exe_installer.png?v=11" alt="">
      <h2>Installing ${meta.name}</h2>
      <div class="exe-bar"><div class="exe-fill"></div></div>
      <p class="exe-status">Preparing…</p>
      <div class="exe-foot"><button class="exe-finish" disabled>Finish</button></div>
    </div>`;
    const fill = w.body.querySelector(".exe-fill"), status = w.body.querySelector(".exe-status"), finish = w.body.querySelector(".exe-finish");
    const steps = [["Copying files…", 25], ["Registering components…", 55], ["Creating shortcuts…", 80], ["Finishing up…", 100]];
    for (const [msg, pct] of steps) { status.textContent = msg; fill.style.width = pct + "%"; await wait(480); }
    status.textContent = "Installation complete."; finish.disabled = false;
    return new Promise((res) => { finish.onclick = () => { w.close && w.close(); res(); }; });
  }
  window.Installer = {
    hasFlow(id) { return !!EXE[id] || id === "itunes"; },
    async install(app, onDone) {
      if (app.id === "itunes") {
        window.UAC.prompt({ name: "iTunes", publisher: "Apple Inc.", iconKey: "itunes" }, async () => {
          await installerStage({ name: "iTunes" }, mini("itunes", "iTunes")); onDone && onDone();
        });
        return;
      }
      const meta = EXE[app.id] || { name: app.name, exe: app.id + ".exe", pub: "Unknown" };
      await terminalStage(meta);
      await installerStage(meta, mini(app.id, app.name));
      onDone && onDone();
    },
  };

  // ---------------- iTunes ----------------
  const ALBUMS = [
    { t: "After Hours", a: "The Weeknd", c1: "#e11d2a", c2: "#1a0304" },
    { t: "1989", a: "Taylor Swift", c1: "#8fd0e8", c2: "#1f5163" },
    { t: "÷ (Divide)", a: "Ed Sheeran", c1: "#2f7ae5", c2: "#0a2450" },
    { t: "Future Nostalgia", a: "Dua Lipa", c1: "#f06aa0", c2: "#3a1030" },
    { t: "DAMN.", a: "Kendrick Lamar", c1: "#c53030", c2: "#2a0505" },
    { t: "random access memories", a: "Daft Punk", c1: "#c8a24a", c2: "#2b2110" },
    { t: "Abbey Road", a: "The Beatles", c1: "#8a98a8", c2: "#22303c" },
    { t: "Midnights", a: "Taylor Swift", c1: "#3a4a6b", c2: "#0d1526" },
  ];
  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.itunes = function () {
    const ref = cw({ title: "iTunes", icon: mini("itunes", "iTunes"), width: 860, height: 580, appId: "itunes" });
    const body = ref.body; body.classList.add("itunes-host");
    let playing = null, timer = null, pos = 0;
    body.innerHTML = `<div class="itn">
      <div class="itn-side">
        <div class="itn-brand">${mini("itunes", "iTunes")}<b>iTunes</b></div>
        <div class="itn-nav">${["Library", "For You", "Browse", "Radio", "Store"].map((n, i) => `<button class="itn-navbtn ${i === 0 ? "on" : ""}">${n}</button>`).join("")}</div>
        <div class="itn-sec">Library</div>
        ${["Recently Added", "Artists", "Albums", "Songs", "Music Videos", "Genres"].map((n) => `<button class="itn-sub">${n}</button>`).join("")}
      </div>
      <div class="itn-main"><h2>Recently Added</h2><div class="itn-grid"></div></div>
    </div>
    <div class="itn-player">
      <div class="itn-np"></div>
      <div class="itn-controls"><button class="itn-prev">⏮</button><button class="itn-play">▶</button><button class="itn-next">⏭</button></div>
      <div class="itn-scrub"><span class="itn-cur">0:00</span><div class="itn-track"><div class="itn-prog"></div></div><span class="itn-dur">3:20</span></div>
    </div>`;
    const grid = body.querySelector(".itn-grid");
    ALBUMS.forEach((al, i) => {
      const card = el(`<button class="itn-album"><span class="itn-cover" style="background:linear-gradient(150deg,${al.c1},${al.c2})"><span class="itn-cover-t">${al.t}</span></span><span class="itn-al-t">${al.t}</span><span class="itn-al-a">${al.a}</span></button>`);
      card.onclick = () => play(i);
      grid.appendChild(card);
    });
    const npEl = body.querySelector(".itn-np"), playBtn = body.querySelector(".itn-play"), prog = body.querySelector(".itn-prog"), cur = body.querySelector(".itn-cur");
    const DUR = 200;
    function fmt(s) { return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"); }
    function tick() { pos = Math.min(DUR, pos + 1); prog.style.width = (pos / DUR * 100) + "%"; cur.textContent = fmt(pos); if (pos >= DUR) pause(); }
    function play(i) {
      if (i != null) { playing = i; pos = 0; }
      if (playing == null) playing = 0;
      const al = ALBUMS[playing];
      npEl.innerHTML = `<span class="itn-np-cover" style="background:linear-gradient(150deg,${al.c1},${al.c2})"></span><div class="itn-np-txt"><b>${al.t}</b><span>${al.a}</span></div>`;
      playBtn.textContent = "⏸"; clearInterval(timer); timer = setInterval(tick, 1000); if (window.WM) {}
    }
    function pause() { playBtn.textContent = "▶"; clearInterval(timer); timer = null; }
    playBtn.onclick = () => { if (timer) pause(); else play(null); };
    body.querySelector(".itn-next").onclick = () => play((playing == null ? 0 : playing + 1) % ALBUMS.length);
    body.querySelector(".itn-prev").onclick = () => play((playing == null ? 0 : playing - 1 + ALBUMS.length) % ALBUMS.length);
    body.querySelectorAll(".itn-navbtn").forEach((b2) => b2.onclick = () => { body.querySelectorAll(".itn-navbtn").forEach((x) => x.classList.toggle("on", x === b2)); });
    ref.onClose = () => clearInterval(timer);
  };
})();
