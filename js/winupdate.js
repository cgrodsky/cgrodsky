/* Windows Update that's real.
   "Check for updates" fetches this site's own index.html (no-store), reads its `var BUILD = "v=…"`
   token and compares it with the build this page is running (the ?v= of the js/main.js <script>).
   When the deployed build is different, "Download & install" really downloads every js/*.js?v= and
   css/*.css?v= file the new index.html references (cache: "reload", so they land in the HTTP cache),
   with a byte/file progress bar. "Restart now" plays the full-screen "Working on updates" screen and
   reloads into the new build. Offline (ISO / VM / no network) it says so and downloads nothing.
   Settings → Windows Update uses the same engine through SettingsParts.renderWindowsUpdate.
   Persisted in State.data.appData.winupdate (history, pause, active hours, options). */
(function () {
  "use strict";
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const save = () => { try { State.save(); } catch (_) {} };
  const fmtBytes = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(2) + " MB";
  const fmtWhen = (ts) => { const d = new Date(ts), t = new Date(); const same = d.toDateString() === t.toDateString(); return (same ? "Today" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
  const hour = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };

  function store() {
    const a = S().appData || (S().appData = {});
    const w = a.winupdate || (a.winupdate = {});
    const def = { lastCheck: 0, history: [], pausedUntil: 0, activeStart: 8, activeEnd: 17, autoActive: false, otherProducts: true, notifyRestart: true, latest: true, metered: false, pending: null };
    Object.keys(def).forEach((k) => { if (w[k] == null) w[k] = Array.isArray(def[k]) ? [] : def[k]; });
    return w;
  }
  function runningBuild() {
    const scripts = Array.from(document.scripts || []);
    const main = scripts.find((s) => /(^|\/)js\/main\.js\?v=/.test(s.getAttribute("src") || ""));
    if (main) { const m = (main.getAttribute("src") || "").match(/[?&]v=([^&#]+)/); if (m) return m[1]; }
    const inl = scripts.map((s) => s.textContent || "").find((t) => /var BUILD = "v=/.test(t));
    const m2 = inl && inl.match(/var BUILD = "v=([^"]+)"/);
    return m2 ? m2[1] : "unknown";
  }
  function kbFor(build) { let h = 0; for (const c of String(build)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return "KB5" + String(100000 + (h % 900000)); }
  function parseFiles(html) {
    const out = [], seen = new Set(), re = /(?:src|href)\s*=\s*["']((?:\.\/)?(?:js|css)\/[^"'?#\s]+\.(?:js|css)\?v=[^"'#\s]+)["']/g;
    let m; while ((m = re.exec(html))) { if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); } }
    return out;
  }
  const paused = () => store().pausedUntil > Date.now();

  // ---------------- the engine (shared by the app and Settings) ----------------
  // job.state: idle | checking | uptodate | available | offline | error | downloading | installing | restart
  const job = { state: "idle", remote: null, files: [], done: 0, bytes: 0, current: "", err: "", pct: 0 };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (_) {} });
  (function initState() {
    try { const w = store(); if (w.pending) { job.state = "restart"; job.remote = w.pending.build; } else if (w.lastResult === "uptodate" && w.lastCheck) job.state = "uptodate"; } catch (_) {}
  })();

  async function check(silent) {
    if (job.state === "checking" || job.state === "downloading" || job.state === "installing") return job;
    if (store().pending) { job.state = "restart"; emit(); return job; }
    job.state = "checking"; job.err = ""; emit();
    const w = store(), local = runningBuild();
    const started = Date.now();
    let html = null;
    if (navigator.onLine === false || location.protocol === "file:") {
      job.state = "offline";
    } else {
      try {
        const r = await fetch(location.pathname + "?u=" + Date.now(), { cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        html = await r.text();
      } catch (e) { job.state = "offline"; job.err = String(e && e.message || e); }
    }
    if (Date.now() - started < 900) await new Promise((r) => setTimeout(r, 900 - (Date.now() - started)));   // let "Checking…" be readable
    if (html != null) {
      const m = html.match(/var BUILD = "v=([^"]+)"/);
      const remote = m ? m[1] : null;
      if (!remote) { job.state = "error"; job.err = "The update service returned a page without a build number (0x8024401f)."; }
      else if (remote === local) { job.state = "uptodate"; job.remote = remote; }
      else { job.state = "available"; job.remote = remote; job.files = parseFiles(html); }
    }
    w.lastCheck = Date.now(); w.lastResult = job.state; save(); emit();
    if (silent && job.state === "available" && window.Notify) Notify.show({ icon: Icon.mini("winupdate", "Windows Update"), title: "Windows Update", body: "An update is available: build " + esc(job.remote) + ".", onClick: () => WM.open("windowsupdate") });
    return job;
  }

  async function download() {
    if (job.state !== "available" && job.state !== "error") return;
    if (!job.files.length) { job.state = "error"; job.err = "The new build doesn't list any files."; emit(); return; }
    job.state = "downloading"; job.done = 0; job.bytes = 0; job.pct = 0; job.err = ""; job.current = ""; job.failed = []; emit();
    const queue = job.files.slice(), total = queue.length;
    async function one(path) {
      const url = new URL(path.replace(/^\.\//, ""), location.href).href;
      job.current = path.replace(/\?.*$/, ""); emit();
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetch(url, { cache: "reload" });
          if (!r.ok) throw new Error("HTTP " + r.status);
          const b = await r.blob();
          job.bytes += b.size; job.done++; job.pct = Math.round((job.done / total) * 100); emit();
          return true;
        } catch (e) { if (attempt === 1) { job.failed.push(path); job.done++; emit(); return false; } }
      }
    }
    const workers = Array.from({ length: Math.min(4, total) }, async () => { while (queue.length) await one(queue.shift()); });
    await Promise.all(workers);
    if (job.failed.length) {
      job.state = "error"; job.err = job.failed.length + " of " + total + " files couldn't be downloaded (0x80240034). Check your connection and try again."; emit(); return;
    }
    // "Install": the files are now in the browser cache; record a pending restart.
    job.state = "installing"; job.pct = 0; emit();
    for (let p = 0; p <= 100; p += 10) { job.pct = p; emit(); await new Promise((r) => setTimeout(r, 120)); }
    const w = store();
    w.pending = { build: job.remote, kb: kbFor(job.remote), files: total, bytes: job.bytes, ts: Date.now(), from: runningBuild() };
    w.history.unshift({ build: job.remote, kb: kbFor(job.remote), title: "Windows 12 cumulative update (build " + job.remote + ") (" + kbFor(job.remote) + ")", ts: Date.now(), status: "Pending restart", files: total, bytes: job.bytes });
    if (w.history.length > 40) w.history.length = 40;
    save();
    job.state = "restart"; emit();
    if (w.notifyRestart && window.Notify) Notify.show({ icon: Icon.mini("winupdate", "Windows Update"), title: "Restart required", body: "Your device needs to restart to finish installing build " + esc(job.remote) + ".", onClick: () => WM.open("windowsupdate") });
  }

  function restartNow() {
    const w = store(), build = (w.pending && w.pending.build) || job.remote;
    document.querySelectorAll(".pt-wu-restart").forEach((x) => x.remove());
    const ov = el(`<div class="pt-wu-restart" role="alert">
      <div class="pt-wu-dots">${"<i></i>".repeat(6)}</div>
      <div class="pt-wu-r1">Working on updates <span class="pt-wu-rp">0</span>%</div>
      <div class="pt-wu-r2">Don't turn off your PC. This will take a while.</div>
      <div class="pt-wu-r3">Your PC will restart several times</div>
    </div>`);
    document.body.appendChild(ov);
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + (p < 30 ? 3 : p < 80 ? 2 : 4));
      ov.querySelector(".pt-wu-rp").textContent = p;
      if (p >= 100) {
        clearInterval(iv);
        ov.querySelector(".pt-wu-r1").textContent = "Restarting";
        ov.querySelector(".pt-wu-r2").textContent = "";
        ov.querySelector(".pt-wu-r3").textContent = "";
        setTimeout(() => {
          const u = new URL(location.href); if (build) u.searchParams.set("b", build);
          try { (window.__ptReload || ((href) => location.replace(href)))(u.href); } catch (_) { location.reload(); }
        }, 1200);
      }
    }, 110);
  }

  // After the restart: confirm the new build is the one running.
  setTimeout(() => {
    try {
      const w = store(); if (!w.pending) return;
      const now = runningBuild();
      if (now === w.pending.build) {
        const h = w.history.find((x) => x.build === w.pending.build && x.status === "Pending restart"); if (h) { h.status = "Successfully installed"; h.installed = Date.now(); }
        w.installedBuild = now; w.pending = null; w.lastCheck = Date.now(); w.lastResult = "uptodate"; job.state = "uptodate"; job.remote = now; save(); emit();
        setTimeout(() => { if (window.Notify) Notify.show({ icon: Icon.mini("winupdate", "Windows Update"), title: "Windows Update", body: "Your PC is up to date — build " + esc(now) + " is installed." }); }, 4000);
      }
    } catch (_) {}
  }, 1200);
  // A quiet background check (once, a minute after start) when allowed.
  setTimeout(() => { try { const w = store(); if (!paused() && w.latest && navigator.onLine !== false && location.protocol !== "file:" && job.state !== "restart") check(true); } catch (_) {} }, 60000);

  // ---------------- UI: the hero card (used by the app and by Settings) ----------------
  const IC = {
    sync: `<svg viewBox="0 0 48 48" width="56" height="56"><path d="M38.5 21A14.8 14.8 0 0 0 11.7 13.4L9 16" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round"/><path d="M8 8v8.6h8.6" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 27a14.8 14.8 0 0 0 26.8 7.6L39 32" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round"/><path d="M40 40v-8.6h-8.6" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    ok: `<svg viewBox="0 0 48 48" width="56" height="56"><path d="M38.5 21A14.8 14.8 0 0 0 11.7 13.4L9 16" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round"/><path d="M8 8v8.6h8.6" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 27a14.8 14.8 0 0 0 26.8 7.6" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round"/><circle cx="36" cy="36" r="10" fill="#0f7b0f"/><path d="M31.5 36.2l3 3 6-6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    warn: `<svg viewBox="0 0 48 48" width="56" height="56"><path d="M38.5 21A14.8 14.8 0 0 0 11.7 13.4L9 16" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round"/><path d="M8 8v8.6h8.6" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 27a14.8 14.8 0 0 0 26.8 7.6" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round"/><path d="M36 25l10 18H26z" fill="#c42b1c"/><path d="M36 31.5v5.5M36 40v.3" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    restart: `<svg viewBox="0 0 48 48" width="56" height="56"><path d="M24 8a16 16 0 1 1-13.9 8" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round"/><path d="M8 9v8h8" fill="none" stroke="#0067c0" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="36" cy="36" r="10" fill="#0067c0"/><path d="M36 30.5v6l3.5 2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    pause: `<svg viewBox="0 0 48 48" width="56" height="56"><circle cx="24" cy="24" r="18" fill="none" stroke="#0067c0" stroke-width="3.6"/><path d="M19 16v16M29 16v16" stroke="#0067c0" stroke-width="4" stroke-linecap="round"/></svg>`,
    chev: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    back: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  function renderHero(box, opts) {
    opts = opts || {};
    const off = () => listeners.delete(paint);
    function paint() {
      if (!box.isConnected && box.__painted) { off(); return; }
      box.__painted = true;
      const w = store(), local = runningBuild();
      const title = "Windows 12 cumulative update (build " + esc(job.remote) + ") (" + kbFor(job.remote) + ")";
      let ic = IC.ok, h = "You're up to date", sub = w.lastCheck ? "Last checked: " + fmtWhen(w.lastCheck) : "Check to see whether a newer build is deployed.", actions = `<button class="pt-btn pt-primary pt-wu-check">Check for updates</button>`, extra = "";
      if (paused() && ["checking", "downloading", "installing", "restart", "available"].indexOf(job.state) < 0) {
        ic = IC.pause; h = "Updates are paused"; sub = "Your device won't get updates until " + new Date(w.pausedUntil).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + ".";
        actions = `<button class="pt-btn pt-primary pt-wu-resume">Resume updates</button>`;
      } else if (job.state === "idle") { ic = IC.sync; h = w.lastCheck ? "You're up to date" : "Check for updates"; }
      else if (job.state === "checking") { ic = IC.sync; h = "Checking for updates…"; sub = "Contacting " + esc(location.host || "this site") + " for the latest build."; actions = ""; }
      else if (job.state === "offline") { ic = IC.warn; h = "No internet connection"; sub = "We couldn't reach the update service, so there's nothing to download. Connect to the internet and try again." + (job.err ? " (" + esc(job.err) + ")" : ""); actions = `<button class="pt-btn pt-primary pt-wu-check">Retry</button>`; }
      else if (job.state === "error") { ic = IC.warn; h = "There were problems installing updates"; sub = esc(job.err); actions = `<button class="pt-btn pt-primary pt-wu-dl">Retry</button><button class="pt-btn pt-wu-check">Check again</button>`; }
      else if (job.state === "available") {
        ic = IC.sync; h = "Updates available"; sub = "Last checked: " + fmtWhen(w.lastCheck) + " · Running build " + esc(local);
        actions = `<button class="pt-btn pt-primary pt-wu-dl">Download &amp; install</button>`;
        extra = `<div class="pt-wu-item"><div><b>${title}</b><span>${job.files.length} files to download</span></div><span class="pt-wu-status">Ready to download</span></div>`;
      } else if (job.state === "downloading" || job.state === "installing") {
        ic = IC.sync; h = job.state === "downloading" ? "Downloading updates" : "Installing updates"; sub = "Running build " + esc(local) + " → " + esc(job.remote); actions = "";
        const pct = job.pct;
        extra = `<div class="pt-wu-item"><div><b>${title}</b><span>${job.state === "downloading" ? "Downloading — " + pct + "% · " + job.done + " of " + job.files.length + " files · " + fmtBytes(job.bytes) : "Installing — " + pct + "%"}</span><div class="pt-bar"><i style="width:${pct}%"></i></div>${job.state === "downloading" ? `<span class="pt-wu-cur">${esc(job.current)}</span>` : ""}</div></div>`;
      } else if (job.state === "restart") {
        ic = IC.restart; h = "Restart required"; const p = w.pending || {};
        sub = "Your device needs to restart to finish installing build " + esc(p.build || job.remote) + "." + (inActive() ? " You're in active hours (" + hour(w.activeStart) + "–" + hour(w.activeEnd) + ")." : "");
        actions = `<button class="pt-btn pt-primary pt-wu-restartbtn">Restart now</button>${opts.compact ? "" : `<button class="pt-btn pt-wu-sched">Schedule the restart</button>`}`;
        extra = `<div class="pt-wu-item"><div><b>Windows 12 cumulative update (build ${esc(p.build || job.remote)}) (${kbFor(p.build || job.remote)})</b><span>Pending restart · ${p.files || 0} files · ${fmtBytes(p.bytes || 0)} downloaded</span></div></div>` + (w.restartAt ? `<div class="pt-wu-note">Restart scheduled for ${esc(fmtWhen(w.restartAt))}.</div>` : "");
      } else if (job.state === "uptodate") { ic = IC.ok; h = "You're up to date"; sub = "Last checked: " + fmtWhen(w.lastCheck) + " · Build " + esc(local); }
      box.innerHTML = `<div class="pt-wu-hero${opts.compact ? " compact" : ""}"><div class="pt-wu-ic${job.state === "checking" || job.state === "downloading" || job.state === "installing" ? " spin" : ""}">${ic}</div><div class="pt-wu-tx"><h2>${h}</h2><p>${sub}</p></div><div class="pt-wu-acts">${actions}</div></div>${extra}${opts.compact ? `<button class="pt-link pt-wu-openapp">Update history, pause updates and advanced options ›</button>` : ""}`;
      box.querySelectorAll(".pt-wu-check").forEach((b) => b.onclick = () => check());
      const dl = box.querySelector(".pt-wu-dl"); if (dl) dl.onclick = () => download();
      const rs = box.querySelector(".pt-wu-resume"); if (rs) rs.onclick = () => { store().pausedUntil = 0; save(); check(); };
      const rb = box.querySelector(".pt-wu-restartbtn"); if (rb) rb.onclick = () => restartNow();
      const sc = box.querySelector(".pt-wu-sched"); if (sc) sc.onclick = () => schedule();
      const oa = box.querySelector(".pt-wu-openapp"); if (oa) oa.onclick = () => WM.open("windowsupdate");
    }
    listeners.add(paint); paint();
  }
  function inActive() { const w = store(), h = new Date().getHours(); return w.activeStart <= w.activeEnd ? h >= w.activeStart && h < w.activeEnd : h >= w.activeStart || h < w.activeEnd; }
  let schedTimer = 0;
  function schedule() {
    const w = store(), t = new Date(); t.setMinutes(0, 0, 0);
    // first hour outside active hours
    for (let i = 1; i <= 24; i++) { const c = new Date(t.getTime() + i * 3600000), h = c.getHours(); const act = w.activeStart <= w.activeEnd ? h >= w.activeStart && h < w.activeEnd : h >= w.activeStart || h < w.activeEnd; if (!act) { w.restartAt = c.getTime(); break; } }
    save(); armSchedule(); emit();
  }
  function armSchedule() { clearTimeout(schedTimer); const w = store(); if (!w.restartAt || !w.pending) return; const ms = w.restartAt - Date.now(); if (ms < 0 || ms > 86400000) return; schedTimer = setTimeout(restartNow, ms); }
  setTimeout(armSchedule, 2000);

  // ---------------- the app ----------------
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.windowsupdate = function () {
    const ref = WM.createWindow({ title: "Windows Update", icon: Icon.mini("winupdate", "Windows Update"), width: 780, height: 600, appId: "windowsupdate" });
    const body = ref.body; body.classList.add("pt-wu-host");
    let page = "main";
    function render() {
      const w = store();
      body.innerHTML = `<div class="pt-wu">${page === "main" ? `<h1>Windows Update</h1>` : `<div class="pt-wu-crumb"><button class="pt-ib pt-wu-back" title="Back">${IC.back}</button><span>Windows Update</span><span class="pt-wu-sep">›</span><b>${page === "history" ? "Update history" : "Advanced options"}</b></div>`}<div class="pt-wu-page"></div></div>`;
      const host = body.querySelector(".pt-wu-page");
      const back = body.querySelector(".pt-wu-back"); if (back) back.onclick = () => { page = "main"; render(); };
      if (page === "main") {
        const hero = el(`<div class="pt-wu-card"></div>`); host.appendChild(hero); renderHero(hero);
        host.appendChild(el(`<h3 class="pt-wu-h3">More options</h3>`));
        const pauseRow = el(`<div class="pt-wu-row"><div class="pt-wu-ric">${IC.pause.replace(/56/g, "22")}</div><div class="pt-wu-rt"><b>Pause updates</b><span>${paused() ? "Paused until " + new Date(w.pausedUntil).toLocaleDateString() : "Temporarily stop updates"}</span></div><select class="pt-wu-pause">${paused() ? `<option value="">Paused</option><option value="0">Resume updates</option>` : `<option value="">Pause for 1 week</option>`}${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">Pause for ${n} week${n > 1 ? "s" : ""}</option>`).join("")}</select></div>`);
        pauseRow.querySelector("select").onchange = (e) => {
          const v = e.target.value; if (v === "") return;
          w.pausedUntil = +v ? Date.now() + +v * 7 * 86400000 : 0; save();
          if (window.Notify) Notify.show({ icon: Icon.mini("winupdate", "Windows Update"), title: "Windows Update", body: +v ? "Updates paused until " + new Date(w.pausedUntil).toLocaleDateString() + "." : "Updates resumed." });
          render(); emit();
        };
        host.appendChild(pauseRow);
        const hist = el(`<button class="pt-wu-row pt-wu-nav"><div class="pt-wu-ric"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5M12 8v4.5l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="pt-wu-rt"><b>Update history</b><span>${w.history.length} update${w.history.length === 1 ? "" : "s"} installed through this app</span></div>${IC.chev}</button>`);
        hist.onclick = () => { page = "history"; render(); }; host.appendChild(hist);
        const adv = el(`<button class="pt-wu-row pt-wu-nav"><div class="pt-wu-ric"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></div><div class="pt-wu-rt"><b>Advanced options</b><span>Active hours (${hour(w.activeStart)} – ${hour(w.activeEnd)}), restart notifications, other products</span></div>${IC.chev}</button>`);
        adv.onclick = () => { page = "advanced"; render(); }; host.appendChild(adv);
        host.appendChild(el(`<div class="pt-wu-row"><div class="pt-wu-ric"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></div><div class="pt-wu-rt"><b>Get the latest updates as soon as they're available</b><span>Check quietly in the background a minute after start-up</span></div></div>`));
        host.lastChild.appendChild(toggle(w.latest, (v) => { w.latest = v; save(); }));
        host.appendChild(el(`<p class="pt-wu-foot">Running build <b>${esc(runningBuild())}</b> from ${esc(location.host || location.protocol)}. Updates come from this site's own deployment — Windows Update downloads the new build's scripts and styles, then restarts into them.</p>`));
      } else if (page === "history") {
        const list = el(`<div class="pt-wu-card"></div>`); host.appendChild(list);
        list.appendChild(el(`<h3 class="pt-wu-h3" style="margin-top:0">Quality updates (${w.history.length})</h3>`));
        if (!w.history.length) list.appendChild(el(`<p class="pt-wu-empty">No updates have been installed through Windows Update on this device yet.</p>`));
        w.history.forEach((x) => list.appendChild(el(`<div class="pt-wu-hrow"><div><b>${esc(x.title)}</b><span>${x.status === "Successfully installed" ? "Successfully installed on " + esc(new Date(x.installed || x.ts).toLocaleString()) : esc(x.status) + " · downloaded " + esc(new Date(x.ts).toLocaleString())}${x.files ? " · " + x.files + " files, " + fmtBytes(x.bytes || 0) : ""}</span></div></div>`)));
        if (w.history.length) { const c = el(`<button class="pt-btn">Clear history</button>`); c.onclick = () => { w.history = w.history.filter((x) => x.status === "Pending restart"); save(); render(); }; host.appendChild(c); }
      } else {
        const card = el(`<div class="pt-wu-card"></div>`); host.appendChild(card);
        const hrs = Array.from({ length: 24 }, (_, i) => i);
        const ah = el(`<div class="pt-wu-row"><div class="pt-wu-rt"><b>Active hours</b><span>We won't restart your device during these hours.</span></div><div class="pt-wu-ah"><label>Start <select class="pt-wu-as">${hrs.map((h) => `<option value="${h}" ${h === w.activeStart ? "selected" : ""}>${hour(h)}</option>`).join("")}</select></label><label>End <select class="pt-wu-ae">${hrs.map((h) => `<option value="${h}" ${h === w.activeEnd ? "selected" : ""}>${hour(h)}</option>`).join("")}</select></label></div></div>`);
        ah.querySelector(".pt-wu-as").onchange = (e) => { w.activeStart = +e.target.value; save(); };
        ah.querySelector(".pt-wu-ae").onchange = (e) => { w.activeEnd = +e.target.value; save(); };
        card.appendChild(ah);
        [["autoActive", "Automatically adjust active hours", "Based on when you use this device"], ["otherProducts", "Receive updates for other Microsoft products", "Get Microsoft Office and other updates together with Windows updates"], ["metered", "Download updates over metered connections", "Data charges may apply"], ["notifyRestart", "Notify me when a restart is required to finish updating", "Show a notification when your device requires a restart"]].forEach(([k, t, s]) => {
          const r = el(`<div class="pt-wu-row"><div class="pt-wu-rt"><b>${t}</b><span>${s}</span></div></div>`); r.appendChild(toggle(w[k], (v) => { w[k] = v; save(); })); card.appendChild(r);
        });
      }
    }
    function toggle(on, fn) {
      const b = el(`<button class="pt-switch${on ? " on" : ""}" role="switch" aria-checked="${!!on}"><i></i></button>`);
      b.onclick = () => { const v = !b.classList.contains("on"); b.classList.toggle("on", v); b.setAttribute("aria-checked", v); fn(v); }; return b;
    }
    render();
    return ref;
  };

  // Settings → Windows Update uses this engine through the existing hook (settings12.js isn't edited).
  try { if (window.SettingsParts && typeof SettingsParts.renderWindowsUpdate === "function") SettingsParts.renderWindowsUpdate = (box) => renderHero(box, { compact: true }); } catch (_) {}

  try {
    if (window.Icon && Icon.alias) Icon.alias("windowsupdate", "winupdate");
    if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === "windowsupdate")) Catalog.storeApps.push({ id: "windowsupdate", name: "Windows Update", cat: "System", price: 0, builtin: "windowsupdate", desc: "Windows Update — check this site for a newer Windows 12 build, download it and restart into it. Update history, pause updates and active hours." });
    (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (EXTRA_DEFAULT_APPS.indexOf("windowsupdate") < 0) EXTRA_DEFAULT_APPS.push("windowsupdate");
  } catch (_) {}
  window.WinUpdate = { check, download, restartNow, runningBuild, parseFiles, job: () => job, store };
})();
