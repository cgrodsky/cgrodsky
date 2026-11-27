/* Recovery: Advanced Startup (WinRE), Safe Mode, System Restore, Startup Repair, UEFI settings.

   Machine-wide boot configuration (like the BCD store) lives in localStorage
   win12_bootcfg_v1[__vmN]: { safeboot, safebootOnce, basevideo, lowresOnce, altshell, winre, uefiOnce,
   fails, stage, fw:{ secureBoot, tpm, vt, fastBoot, bootOrder }, srt }.

   • Boot: wraps Boot.run. A restart started from here (switch user, Safe Mode, restore, WinRE
     "Continue") sets a one-time sessionStorage flag so the next page load skips the long boot
     animation. `winre` / `uefiOnce` take the boot over; a crash loop (the desktop failed to come
     up twice in a row: an exception while building the lock screen / desktop, or a reload after a
     script error before the desktop got ready) starts Automatic Repair.
   • Safe Mode: black wallpaper, "Safe Mode" in the four corners, low-res look, only built-in
     Windows tools launch; store apps, games, widgets and auto-starts are blocked.
   • System Restore: restore points are FULL snapshots of one account's state JSON, kept in
     IndexedDB (win12_restore[__vmN]). Created by hand (System Properties, rstrui, Checkpoint-Computer)
     and automatically right before app installs / uninstalls and Windows Update installs.
     Restoring writes only that account's key, after saving an "Undo" point, then restarts.
   • Startup Repair really parses and validates every account's saved state and the account
     registry, quarantines unreadable data in IndexedDB and repairs what it can.

   window.Recovery = { restartToWinRE, reboot, safeMode, points, restore, diagnose, ... } */
(function () {
  "use strict";
  if (!window.State || !State.keyFor) return;
  const LS = window.localStorage;
  const VM = window.WIN12_VM_DEPTH ? "__vm" + window.WIN12_VM_DEPTH : "";
  const CFG_KEY = "win12_bootcfg_v1" + VM;
  const FAST_KEY = "win12_fastboot" + VM;
  const NOTE_KEY = "win12_restore_note" + VM;
  const MAX_POINTS = 10;
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const log = (lg, level, source, id, msg, opts) => { try { if (window.EventLog) EventLog.add(lg, level, source, id, msg, opts); } catch (_) {} };
  const A = () => window.Accounts || null;
  const modal = (o) => (A() ? Accounts.modal(o) : Promise.resolve(window.confirm((o.title || "") + "\n\n" + String(o.html || "").replace(/<[^>]+>/g, ""))));
  const elevate = (what) => (A() ? Accounts.elevate(what) : Promise.resolve(true));
  const fmtSize = (b) => (b < 1024 ? b + " bytes" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(2) + " MB");
  const fmtWhen = (t) => new Date(t).toLocaleString(undefined, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const notify = (title, body) => { try { if (window.Notify) Notify.show({ icon: Icon.mini("rstrui", "System Restore"), title, body }); } catch (_) {} };

  // ------------------------------------------------------------------ boot configuration
  const fwDefaults = () => ({ secureBoot: true, tpm: true, vt: true, fastBoot: false, bootOrder: ["wbm", "usb", "pxe"] });
  const cfgDefaults = () => ({ v: 1, safeboot: null, safebootOnce: null, altshell: false, basevideo: false, lowresOnce: false, winre: false, uefiOnce: false, fails: 0, stage: "idle", lastBoot: 0, fw: fwDefaults(), srt: null });
  function readCfg() {
    try {
      const c = JSON.parse(LS.getItem(CFG_KEY) || "null");
      if (isObj(c)) {
        const out = Object.assign(cfgDefaults(), c);
        out.fw = Object.assign(fwDefaults(), isObj(c.fw) ? c.fw : {});
        if (!Array.isArray(out.fw.bootOrder) || out.fw.bootOrder.length !== 3 || ["wbm", "usb", "pxe"].some((x) => out.fw.bootOrder.indexOf(x) < 0)) out.fw.bootOrder = fwDefaults().bootOrder;
        if (["minimal", "network"].indexOf(out.safeboot) < 0) out.safeboot = null;
        if (["minimal", "network"].indexOf(out.safebootOnce) < 0) out.safebootOnce = null;
        out.fails = Math.max(0, Math.min(9, out.fails | 0));
        return out;
      }
    } catch (_) {}
    return cfgDefaults();
  }
  function writeCfg(c) { try { LS.setItem(CFG_KEY, JSON.stringify(c)); return true; } catch (_) { return false; } }
  function patchCfg(fn) { const c = readCfg(); fn(c); writeCfg(c); return c; }

  // What this page load booted as (filled in by the Boot.run wrapper).
  const BOOT = { safe: null, altshell: false, lowres: false, readyAt: 0, desktop: false };
  (function early() {   // known before any module builds UI, so others can check window.WIN12_SAFE_MODE
    const c = readCfg();
    if (!c.winre && !c.uefiOnce && c.fails < 2) { BOOT.safe = c.safebootOnce || c.safeboot || null; BOOT.altshell = !!(BOOT.safe && c.altshell); }
    window.WIN12_SAFE_MODE = BOOT.safe;
  })();

  // ------------------------------------------------------------------ restarts
  function takeFast() {
    try { const raw = sessionStorage.getItem(FAST_KEY); if (!raw) return null; sessionStorage.removeItem(FAST_KEY); const f = JSON.parse(raw); return f && Date.now() - (f.at || 0) < 120000 ? f : null; } catch (_) { return null; }
  }
  function spinner() { return `<div class="rc-spin"><i></i><i></i><i></i><i></i><i></i></div>`; }
  // Restart this PC: one-time fast boot (no boot animation), then the normal lock screen / desktop.
  function reboot(opts) {
    opts = opts || {};
    try { sessionStorage.setItem(FAST_KEY, JSON.stringify({ at: Date.now(), to: opts.to || "boot" })); } catch (_) {}
    if (!opts.noSave) { try { State.save(); } catch (_) {} }
    State.freeze();
    document.querySelectorAll(".rc-restarting").forEach((x) => x.remove());
    const ov = el(`<div class="rc-restarting">${spinner()}<div>${esc(opts.label || "Restarting")}</div></div>`);
    document.body.appendChild(ov);
    setTimeout(() => location.reload(), opts.delay == null ? 1100 : opts.delay);
  }
  function restartToWinRE() {
    patchCfg((c) => { c.winre = true; });
    log("System", "Information", "User32", 1074, "The process Explorer.exe has initiated the restart of computer " + pcName() + " on behalf of user " + userName() + " for the following reason: Advanced startup (Windows Recovery Environment).", { now: true });
    reboot({ label: "Please wait" });
  }
  const pcName = () => { try { return S().deviceName || "WIN12-PC"; } catch (_) { return "WIN12-PC"; } };
  const userName = () => { try { return (S().profile && S().profile.username) || "User"; } catch (_) { return "User"; } };

  // ------------------------------------------------------------------ IndexedDB: restore points
  const DB_NAME = "win12_restore" + VM;
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("IndexedDB isn't available in this browser."));
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "id", autoIncrement: true });
        if (!d.objectStoreNames.contains("data")) d.createObjectStore("data", { keyPath: "id" });
        if (!d.objectStoreNames.contains("quarantine")) d.createObjectStore("quarantine", { keyPath: "id", autoIncrement: true });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error || new Error("Couldn't open the restore point store."));
      rq.onblocked = () => rej(new Error("The restore point store is busy."));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  // Run fn(stores) inside one transaction; resolves with whatever fn put into `out.v` once committed.
  function tx(names, mode, fn) {
    return db().then((d) => new Promise((res, rej) => {
      const t = d.transaction(names, mode), out = { v: undefined };
      const st = {}; names.forEach((n) => (st[n] = t.objectStore(n)));
      fn(st, out);
      t.oncomplete = () => res(out.v);
      t.onerror = () => rej(t.error || new Error("Restore point storage failed."));
      t.onabort = () => rej(t.error || new Error("Restore point storage failed (aborted — the device may be out of space)."));
    }));
  }
  const points = {
    list(key) {
      return tx(["meta"], "readonly", (s, out) => { const r = s.meta.getAll(); r.onsuccess = () => { out.v = (r.result || []).filter((m) => !key || m.key === key).sort((a, b) => b.ts - a.ts); }; });
    },
    get(id) { return tx(["meta"], "readonly", (s, out) => { const r = s.meta.get(+id); r.onsuccess = () => { out.v = r.result || null; }; }); },
    json(id) { return tx(["data"], "readonly", (s, out) => { const r = s.data.get(+id); r.onsuccess = () => { out.v = r.result ? r.result.json : null; }; }); },
    async add(o) {
      const json = String(o.json || "");
      const meta = { key: o.key || State.STORAGE_KEY, uid: o.uid != null ? o.uid : State.accountId, user: o.user || userName(), desc: String(o.desc || "Restore point").slice(0, 120), type: o.type || "Manual", ts: Date.now(), size: new Blob([json]).size };
      const id = await tx(["meta", "data"], "readwrite", (s, out) => {
        const r = s.meta.add(meta);
        r.onsuccess = () => { out.v = r.result; s.data.put({ id: r.result, json }); };
      });
      meta.id = id;
      await points.prune(meta.key, o.keep);
      return meta;
    },
    async prune(key, keep) {   // newest MAX_POINTS per account survive (plus `keep`, the point being restored)
      const all = await points.list(key), hasKeep = all.some((m) => m.id === keep);
      const extra = all.filter((m) => m.id !== keep).slice(hasKeep ? MAX_POINTS - 1 : MAX_POINTS);
      for (const m of extra) await points.remove(m.id);
    },
    remove(id) { return tx(["meta", "data"], "readwrite", (s) => { s.meta.delete(+id); s.data.delete(+id); }); },
    async removeAllFor(key) { const all = await points.list(key); for (const m of all) await points.remove(m.id); return all.length; },
    quarantine(key, raw, reason) { return tx(["quarantine"], "readwrite", (s, out) => { const r = s.quarantine.add({ key, raw: String(raw), reason, ts: Date.now() }); r.onsuccess = () => { out.v = r.result; }; }); },
    quarantined() { return tx(["quarantine"], "readonly", (s, out) => { const r = s.quarantine.getAll(); r.onsuccess = () => { out.v = (r.result || []).map((q) => ({ id: q.id, key: q.key, reason: q.reason, ts: q.ts, size: q.raw.length })); }; }); },
  };
  function currentJson() {
    if (!State.frozen) { try { State.save(); } catch (_) {} }
    return LS.getItem(State.STORAGE_KEY) || JSON.stringify(S());
  }
  // Create a restore point of THIS account now.
  async function createPoint(desc, type) {
    const meta = await points.add({ json: currentJson(), desc, type: type || "Manual" });
    log("Application", "Information", "System Restore", 8194, "Successfully created restore point (Process = " + (type === "Manual" || !type ? "System Protection" : "Windows Modules Installer") + "; Description = " + meta.desc + "; Type = " + meta.type + "; Size = " + fmtSize(meta.size) + ").");
    return meta;
  }

  // Automatic restore points: right before app installs / uninstalls and Windows Update installs.
  // The snapshot is the state as it was saved just BEFORE the change.
  (function autoPoints() {
    let lastJson = null, lastApps = null, lastWU = null;
    const appsOf = (d) => (Array.isArray(d.installedApps) ? d.installedApps.slice() : []);
    const wuOf = (d) => { try { const h = (d.appData && d.appData.winupdate && d.appData.winupdate.history) || []; return { p: h.filter((x) => x && x.status === "Pending restart").length, i: !!(d.update && d.update.installed) }; } catch (_) { return { p: 0, i: false }; } };
    const appName = (id) => { const a = window.Catalog && Catalog.storeApps.find((x) => x.id === id); return a ? a.name : id; };
    let lastAutoAt = 0;
    function reset() { try { lastJson = LS.getItem(State.STORAGE_KEY); } catch (_) { lastJson = null; } lastApps = appsOf(S()); lastWU = wuOf(S()); }
    reset();
    State.onSave((json) => {
      const d = S(), apps = appsOf(d), wu = wuOf(d), before = lastJson;
      const added = apps.filter((x) => lastApps.indexOf(x) < 0), removed = lastApps.filter((x) => apps.indexOf(x) < 0);
      const wuChanged = wu.p > lastWU.p || (wu.i && !lastWU.i);
      lastJson = json; lastApps = apps; lastWU = wu;
      if (!BOOT.readyAt || Date.now() < BOOT.readyAt || !d.setupCompleted || !before || BOOT.safe) return;
      if (!added.length && !removed.length && !wuChanged) return;
      if (Date.now() - lastAutoAt < 60000) { log("Application", "Information", "System Restore", 8216, "Skipping creation of restore point (Process = Windows Modules Installer) as there is a restore point available which is recent enough."); return; }
      lastAutoAt = Date.now();
      const desc = wuChanged ? "Windows Update" : added.length ? "Installed " + added.map(appName).join(", ") : "Removed " + removed.map(appName).join(", ");
      const type = wuChanged ? "Windows Update" : added.length ? "Application Install" : "Application Uninstall";
      points.add({ json: before, desc, type }).then((m) => log("Application", "Information", "System Restore", 8194, "Successfully created restore point (Process = Windows Modules Installer; Description = " + m.desc + "; Type = " + m.type + ").")).catch(() => {});
    });
  })();

  // Restore one account to a restore point (only that account's key is written).
  async function restore(id, opts) {
    opts = opts || {};
    const meta = await points.get(id); if (!meta) throw new Error("That restore point no longer exists.");
    const json = await points.json(id); if (!json) throw new Error("The restore point's data is missing.");
    let parsed; try { parsed = JSON.parse(json); } catch (_) { throw new Error("The restore point is damaged (its data can't be read)."); }
    if (!isObj(parsed)) throw new Error("The restore point is damaged.");
    const key = meta.key, isCur = key === State.STORAGE_KEY;
    const curRaw = isCur && !State.frozen ? currentJson() : LS.getItem(key);
    if (curRaw && curRaw !== json) {
      try { await points.add({ key, uid: meta.uid, user: meta.user, json: curRaw, desc: "Undo: Restore Operation", type: "Undo", keep: meta.id }); } catch (_) {}
    }
    try { LS.setItem(key, json); }
    catch (_) { throw new Error("System Restore did not complete successfully. There isn't enough storage space to restore this point (0x80070070)."); }
    if (isCur) State.freeze();   // nothing from this page may overwrite the restored state now
    try { sessionStorage.setItem(NOTE_KEY, JSON.stringify({ ok: true, desc: meta.desc, ts: meta.ts, type: meta.type, user: meta.user, at: Date.now() })); } catch (_) {}
    log("Application", "Information", "System Restore", 8211, "System Restore restored " + meta.user + "'s files and settings to the restore point “" + meta.desc + "” (" + fmtWhen(meta.ts) + ").", { now: true });
    return meta;
  }

  // ------------------------------------------------------------------ Startup Repair (real checks)
  const DEF_KEYS = ["profile", "desktop", "bank", "youtube", "discord", "amazon", "copilot", "appData", "clock", "setup"];
  function sys32Count(st) { try { return Object.keys(st.appData.files.root["Local Disk (C:)"].children.Windows.children.System32.children).length; } catch (_) { return -1; } }
  // Validate + repair one account's parsed state in place; returns the list of fixes.
  function fixState(st, regName) {
    const D = State.defaults(), fixes = [];
    const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "an array" : typeof v);
    DEF_KEYS.forEach((k) => {
      if (!isObj(st[k])) { fixes.push(k + " settings were " + typeOf(st[k]) + " — rebuilt with defaults"); st[k] = D[k]; }
      else Object.keys(D[k]).forEach((sub) => { if (st[k][sub] === undefined) st[k][sub] = D[k][sub]; });
    });
    const pr = st.profile;
    if (typeof pr.username !== "string" || !pr.username.trim()) { pr.username = regName || "User"; fixes.push("user name was missing — set to " + pr.username); }
    if (pr.authType !== "pin" && pr.authType !== "password") { pr.authType = "pin"; fixes.push("sign-in type was invalid — set to PIN"); }
    if (pr.secret != null && typeof pr.secret !== "string") { pr.secret = String(pr.secret); fixes.push("PIN/password was stored with the wrong type — converted"); }
    if (pr.pwHash != null && !(isObj(pr.pwHash) && pr.pwHash.s && pr.pwHash.h)) { delete pr.pwHash; fixes.push("damaged password hash removed (PIN / other methods still work)"); }
    [["installedApps", st], ["redeemedKeys", st], ["hiddenIcons", st.desktop], ["transactions", st.bank]].forEach(([k, o]) => {
      if (Array.isArray(o[k])) return;
      if (typeof o[k] === "string" && o[k].trim()) { o[k] = o[k].split(",").map((x) => x.trim()).filter(Boolean); fixes.push(k + " was text instead of a list — converted (" + o[k].length + " item(s) kept)"); }
      else { fixes.push(k + " was not a list — emptied"); o[k] = []; }
    });
    const apps = st.installedApps.filter((x, i, a) => typeof x === "string" && x && a.indexOf(x) === i);
    if (apps.length !== st.installedApps.length) { fixes.push("removed " + (st.installedApps.length - apps.length) + " invalid / duplicate installed-app entries"); st.installedApps = apps; }
    if (typeof st.bank.balance !== "number" || !isFinite(st.bank.balance)) { st.bank.balance = 1000; fixes.push("bank balance was not a number — reset"); }
    if (["light", "dark", "auto"].indexOf(st.theme) < 0) { st.theme = "auto"; fixes.push("theme was invalid — set to Auto"); }
    if (typeof st.accent !== "string" || !/^#[0-9a-f]{3,8}$/i.test(st.accent)) { st.accent = D.accent; fixes.push("accent color was invalid — reset"); }
    if (typeof st.textScale !== "number" || !(st.textScale >= 50 && st.textScale <= 300)) { st.textScale = 100; fixes.push("text size was out of range — set to 100%"); }
    if (["automatic", "custom"].indexOf(st.clock.mode) < 0) { st.clock.mode = "automatic"; fixes.push("clock mode was invalid — set to automatic"); }
    if (st.desktop.wallpaper != null && typeof st.desktop.wallpaper !== "string") { st.desktop.wallpaper = "default"; fixes.push("wallpaper setting was damaged — reset"); }
    if (st.appData.eventLog != null && !Array.isArray(st.appData.eventLog)) { delete st.appData.eventLog; fixes.push("event log was damaged — cleared"); }
    if (st.appData.files != null && !(isObj(st.appData.files) && isObj(st.appData.files.root))) { delete st.appData.files; fixes.push("file system index was unreadable — it will be rebuilt"); }
    // System32 (the desktop's real dependency, see js/main.js)
    const n = sys32Count(st);
    if (st.systemBroken || (n >= 0 && n < 10)) {
      if (window.FilesParts && st.appData.files && isObj(st.appData.files.root)) {
        try {
          const fresh = FilesParts.WIN_FS(), root = st.appData.files.root;
          if (!root["Local Disk (C:)"]) root["Local Disk (C:)"] = fresh["Local Disk (C:)"];
          else {
            const c = root["Local Disk (C:)"].children || (root["Local Disk (C:)"].children = {});
            const fw = fresh["Local Disk (C:)"].children.Windows;
            if (!c.Windows) c.Windows = fw;
            else { const wc = c.Windows.children || (c.Windows.children = {}); const sys = wc.System32 || (wc.System32 = { type: "folder", children: {} }); sys.children = sys.children || {}; Object.keys(fw.children.System32.children).forEach((k) => { if (!sys.children[k]) sys.children[k] = fw.children.System32.children[k]; }); }
          }
        } catch (_) {}
      }
      fixes.push("C:\\Windows\\System32 was damaged — " + (window.FilesParts ? "missing system files were put back" : "marked for repair"));
      st.systemBroken = false;
      if (!st.setupCompleted && st.profile.username) { st.setupCompleted = true; st.installerDone = true; fixes.push("Windows was set to reinstall because of the damage — it will start normally instead"); }
    }
    return fixes;
  }
  function salvage(raw, regName) {
    const pick = (re) => { const m = re.exec(raw); return m ? m[1] : null; };
    const st = State.defaults();
    st.bootCompleted = st.installerDone = st.setupCompleted = true;
    st.profile.username = pick(/"username"\s*:\s*"([^"\\]{1,40})"/) || regName || "User";
    const at = pick(/"authType"\s*:\s*"(pin|password)"/); if (at) st.profile.authType = at;
    const sec = pick(/"secret"\s*:\s*"([^"\\]{0,64})"/); if (sec != null) st.profile.secret = sec;
    st.appData = { firstLogon: true };
    return st;
  }
  // Diagnose (and repair) every account + the registry + the boot configuration.
  async function diagnose(opts) {
    opts = opts || {};
    const fix = opts.fix !== false, rep = [], problems = [], fixed = [];
    const say = (test, result, detail) => rep.push({ test, result, detail: detail || "" });
    // 1. boot configuration
    let rawCfg = LS.getItem(CFG_KEY), cfgOk = true;
    if (rawCfg) { try { if (!isObj(JSON.parse(rawCfg))) cfgOk = false; } catch (_) { cfgOk = false; } }
    const cfg = readCfg();
    if (!cfgOk) { problems.push("Boot configuration data was corrupt"); if (fix) fixed.push("Rebuilt the boot configuration data (BCD) store"); }
    if (cfg.fails) { if (fix) fixed.push("Cleared the failed-boot counter (" + cfg.fails + " failed starts)"); }
    if (fix) { cfg.fails = 0; cfg.stage = "idle"; writeCfg(cfg); }
    say("Check boot configuration data (BCD)", cfgOk ? "Completed successfully. Error code = 0x0" : "Repaired. Error code = 0x0", cfgOk ? "safeboot=" + (cfg.safeboot || "none") : "The BCD store could not be read and was rebuilt");
    // 2. account registry
    const regKey = State.ACCOUNTS_KEY, rawReg = LS.getItem(regKey);
    let regOk = true; if (rawReg) { try { const r = JSON.parse(rawReg); if (!isObj(r) || !Array.isArray(r.users)) regOk = false; } catch (_) { regOk = false; } }
    if (!regOk) { problems.push("The account list was corrupt"); if (fix) { try { await points.quarantine(regKey, rawReg, "Corrupt account registry"); } catch (_) {} LS.removeItem(regKey); fixed.push("Rebuilt the account list from the accounts stored on this PC"); } }
    let reg = A() ? Accounts.ensure() : null;
    say("Check user account registry", regOk ? "Completed successfully. Error code = 0x0" : fix ? "Repaired. Error code = 0x0" : "Failed. Error code = 0x490", reg ? reg.users.length + " account(s)" : "no accounts yet");
    // accounts on disk that the registry doesn't list (orphans) → add back
    const ids = new Set(reg ? reg.users.map((u) => u.id) : [State.accountId]);
    const orphans = [];
    try {
      const re = new RegExp("^" + State.BASE_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "__u(\\d+)$");
      for (let i = 0; i < LS.length; i++) { const m = re.exec(LS.key(i) || ""); if (m && !ids.has(+m[1])) orphans.push(+m[1]); }
    } catch (_) {}
    orphans.forEach((oid) => {
      ids.add(oid);
      if (!reg || !fix) { problems.push("Account #" + oid + " is missing from the account list"); return; }
      let nm = "User " + oid, tp = "standard";
      try { const st = JSON.parse(LS.getItem(State.keyFor(oid))); nm = (st.profile && st.profile.username) || nm; tp = (st.accountMeta && st.accountMeta.type) || tp; } catch (_) {}
      reg.users.push({ id: oid, name: nm, type: tp === "admin" ? "admin" : "standard", picture: null, methods: [], created: Date.now(), lastSignIn: null });
      reg.nextId = Math.max(reg.nextId || 2, oid + 1);
      try { LS.setItem(regKey, JSON.stringify(reg)); } catch (_) {}
      problems.push("Account " + nm + " was missing from the account list"); fixed.push("Added " + nm + " back to the account list");
    });
    // 3. each account's state
    for (const id of Array.from(ids).sort((a, b) => a - b)) {
      const key = State.keyFor(id), u = reg && reg.users.find((x) => x.id === id), name = (u && u.name) || "User " + id;
      const raw = LS.getItem(key);
      if (raw == null) {
        if (id === State.accountId && !S().setupCompleted) continue;  // fresh PC
        problems.push(name + "'s saved state is missing");
        const pts = await points.list(key).catch(() => []);
        if (fix && pts.length) {
          const j = await points.json(pts[0].id);
          try { JSON.parse(j); LS.setItem(key, j); if (key === State.STORAGE_KEY) State.freeze(); fixed.push("Restored " + name + " from the restore point “" + pts[0].desc + "” (" + fmtWhen(pts[0].ts) + ")"); say("Check user state: " + name, "Repaired. Error code = 0x0", "missing — restored from a restore point"); continue; } catch (_) {}
        }
        if (fix && reg && id !== State.accountId) { reg.users = reg.users.filter((x) => x.id !== id); LS.setItem(regKey, JSON.stringify(reg)); fixed.push("Removed the broken account entry “" + name + "” (it had no data)"); }
        say("Check user state: " + name, fix ? "Repaired. Error code = 0x0" : "Failed. Error code = 0x2", "the account's data is gone");
        continue;
      }
      let st = null, parseErr = null;
      try { st = JSON.parse(raw); if (!isObj(st)) { parseErr = "the saved state is " + (Array.isArray(st) ? "an array" : typeof st) + ", not an object"; st = null; } } catch (e) { parseErr = e.message; }
      if (!st) {
        problems.push(name + "'s saved state is unreadable (" + parseErr + ")");
        if (!fix) { say("Check user state: " + name, "Failed. Error code = 0xc0000034", parseErr); continue; }
        try { await points.quarantine(key, raw, "Unreadable state: " + parseErr); } catch (_) {}
        const pts = await points.list(key).catch(() => []);
        let done = false;
        for (const p of pts) {
          const j = await points.json(p.id).catch(() => null);
          try { if (j && isObj(JSON.parse(j))) { LS.setItem(key, j); fixed.push("Restored " + name + " from the restore point “" + p.desc + "” (" + fmtWhen(p.ts) + "); the damaged copy was kept in quarantine"); done = true; break; } } catch (_) {}
        }
        if (!done) {
          const sv = salvage(raw, name);
          try { LS.setItem(key, JSON.stringify(sv)); } catch (_) {}
          fixed.push("Rebuilt " + (sv.profile.username || name) + "'s profile (name and PIN/password recovered); the damaged data was kept in quarantine");
        }
        if (key === State.STORAGE_KEY) State.freeze();
        say("Check user state: " + name, "Repaired. Error code = 0x0", parseErr);
        continue;
      }
      const fixes = fixState(st, name);
      if (fixes.length) {
        problems.push(...fixes.map((f) => name + ": " + f));
        if (fix) {
          try { LS.setItem(key, JSON.stringify(st)); if (key === State.STORAGE_KEY) State.freeze(); fixes.forEach((f) => fixed.push(name + ": " + f)); }
          catch (_) { say("Check user state: " + name, "Failed. Error code = 0x70", "not enough storage space to write the repair"); continue; }
        }
      }
      say("Check user state: " + name, fixes.length ? (fix ? "Repaired. Error code = 0x0" : "Failed. Error code = 0x1f") : "Completed successfully. Error code = 0x0", fixes.length ? fixes.join("; ") : "valid (" + fmtSize(raw.length * 2) + ")");
    }
    // registry names follow the (repaired) states
    if (fix && reg) {
      let ch = false;
      reg.users.forEach((u) => { try { const st = JSON.parse(LS.getItem(State.keyFor(u.id)) || "null"); const nm = st && st.profile && st.profile.username; if (nm && nm !== u.name) { u.name = String(nm).slice(0, 40); ch = true; } } catch (_) {} });
      if (ch) { try { LS.setItem(regKey, JSON.stringify(reg)); } catch (_) {} }
    }
    // 4. storage
    let used = 0; try { for (let i = 0; i < LS.length; i++) { const k = LS.key(i); used += (k.length + (LS.getItem(k) || "").length) * 2; } } catch (_) {}
    say("Check disk (browser storage)", used > 4.6 * 1048576 ? "Warning. Error code = 0x0" : "Completed successfully. Error code = 0x0", fmtSize(used) + " of about 5 MB used" + (used > 4.6 * 1048576 ? " — almost full" : ""));
    let pts = 0; try { pts = (await points.list()).length; } catch (_) {}
    say("Check system protection (restore points)", "Completed successfully. Error code = 0x0", pts + " restore point(s) in IndexedDB");
    const result = { tests: rep, problems, fixed, at: Date.now() };
    if (fix) {
      const text = "Startup Repair diagnosis and repair log\n---------------------------\nLast successful boot time: " + (cfg.lastBoot ? fmtWhen(cfg.lastBoot) : "unknown") + "\nNumber of repair attempts: 1\n\nSession details\n---------------------------\nSystem Disk = \\Device\\Harddisk0\nWindows directory = C:\\Windows\nAutoChk Run = 0\nNumber of root causes = " + problems.length + "\n\nTest Performed:\n---------------------------\n" + rep.map((t) => "Name: " + t.test + "\nResult: " + t.result + (t.detail ? "\nDetail: " + t.detail : "")).join("\n---------------------------\n") + "\n---------------------------\n\nRoot cause found:\n---------------------------\n" + (problems.length ? problems.join("\n") : "No problems were found.") + "\n\nRepair action: " + (fixed.length ? fixed.join("\n") : "None") + "\n";
      patchCfg((c) => { c.srt = text.slice(0, 12000); });
      result.log = text;
    }
    return result;
  }

  // ------------------------------------------------------------------ boot failures (crash loop)
  function bootFailure(err, where) {
    const c = patchCfg((x) => { x.fails = (x.fails | 0) + 1; x.stage = "crashed"; });
    try { console.error("[recovery] boot failure in " + where + ":", err); } catch (_) {}
    log("System", "Critical", "BugCheck", 1001, "The computer has rebooted from a bugcheck. The bugcheck was: 0x00000074 (BAD_SYSTEM_CONFIG_INFO) while starting the " + where + ": " + ((err && err.message) || err) + ". Failed starts in a row: " + c.fails + ".", { now: true });
    document.querySelectorAll(".rc-crash").forEach((x) => x.remove());
    const bs = el(`<div class="bsod rc-crash"><div class="bsod-inner"><div class="bsod-face">:(</div>
      <p class="bsod-msg">Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.</p>
      <p class="bsod-pct"><span class="rc-crash-n">0</span>% complete</p>
      <div class="bsod-foot"><div class="bsod-foot-tx"><p class="bsod-small">If you call a support person, give them this info:</p><p class="bsod-small">Stop code: BAD_SYSTEM_CONFIG_INFO</p><p class="bsod-small">Failed: ${esc(where)} — ${esc(String((err && err.message) || err).slice(0, 140))}</p></div></div></div></div>`);
    document.body.appendChild(bs);
    let p = 0; const n = bs.querySelector(".rc-crash-n");
    const iv = setInterval(() => { p = Math.min(100, p + 20); n.textContent = p; if (p >= 100) { clearInterval(iv); reboot({ noSave: true, delay: 600, label: "Restarting" }); } }, 500);
  }

  // ------------------------------------------------------------------ fast boot (restarts started here)
  function fastBoot(fw) {
    return new Promise((resolve) => {
      const layer = el(`<div class="rc-fastboot"><div class="rc-fb-lines"></div><div class="rc-fb-logo"><i></i><i></i><i></i><i></i></div>${spinner()}</div>`);
      document.body.appendChild(layer);
      const lines = layer.querySelector(".rc-fb-lines");
      const order = (fw && fw.bootOrder) || ["wbm"];
      const before = order.slice(0, order.indexOf("wbm"));
      const msgs = { usb: ["Checking media presence......", "Media not present (USB)"], pxe: [">>Start PXE over IPv4.", "  Station IP address is not available.", ">>Start PXE over IPv6.", "  PXE-E16: No offer received."] };
      let t = 0;
      before.forEach((d) => (msgs[d] || []).forEach((m) => { t += 260; setTimeout(() => lines.appendChild(el(`<div></div>`)).textContent = m, t); }));
      const logoAt = t + (before.length ? 400 : 0);
      setTimeout(() => layer.classList.add("rc-fb-show"), logoAt);
      setTimeout(() => { layer.classList.add("rc-out"); setTimeout(() => layer.remove(), 300); resolve(); }, logoAt + (fw && fw.fastBoot ? 700 : 1300));
    });
  }
  function applyBootClasses() {
    document.body.classList.toggle("rc-safemode", !!BOOT.safe);
    document.body.classList.toggle("rc-lowres", !!(BOOT.safe || BOOT.lowres));
    document.documentElement.classList.toggle("rc-lowres", !!(BOOT.safe || BOOT.lowres));
    if (BOOT.safe && !document.querySelector(".rc-safe-corners")) {
      const lbl = "Safe Mode" + (BOOT.safe === "network" ? " with Networking" : "");
      document.body.appendChild(el(`<div class="rc-safe-corners" aria-hidden="true"><span class="rc-c-tl">${lbl}</span><span class="rc-c-tr">${lbl}</span><span class="rc-c-bl">${lbl}</span><span class="rc-c-br">${lbl}</span><span class="rc-c-tc">Microsoft (R) Windows 12 (Build 26100.2026)</span></div>`));
    }
  }

  // ------------------------------------------------------------------ Boot.run wrapper
  if (window.Boot && Boot.run && !Boot.__rc) {
    const oBoot = Boot.run; Boot.__rc = true;
    Boot.run = function (done) {
      const cfg = readCfg();
      if (cfg.stage === "desktop-error") cfg.fails = (cfg.fails | 0) + 1;   // last start hit script errors and never got the desktop ready
      cfg.stage = "boot"; cfg.lastBoot = Date.now();
      const fast = takeFast();
      if (cfg.uefiOnce) { cfg.uefiOnce = false; writeCfg(cfg); BOOT.safe = null; window.WIN12_SAFE_MODE = null; firmware(); return; }
      if (cfg.winre) { cfg.winre = false; writeCfg(cfg); BOOT.safe = null; window.WIN12_SAFE_MODE = null; WinRE.open(); return; }
      if (cfg.fails >= 2) { writeCfg(cfg); BOOT.safe = null; window.WIN12_SAFE_MODE = null; WinRE.automatic(); return; }
      BOOT.safe = cfg.safebootOnce || cfg.safeboot || null;
      BOOT.altshell = !!(BOOT.safe && cfg.altshell);
      BOOT.lowres = !!(cfg.lowresOnce || cfg.basevideo);
      if (cfg.safebootOnce) { cfg.safebootOnce = null; if (!cfg.safeboot) cfg.altshell = false; }
      cfg.lowresOnce = false;
      writeCfg(cfg);
      window.WIN12_SAFE_MODE = BOOT.safe;
      applyBootClasses();
      const wrappedDone = function () { try { if (typeof done === "function") return done.apply(this, arguments); } catch (e) { bootFailure(e, "sign-in screen"); } };
      if (fast) { fastBoot(cfg.fw).then(wrappedDone); return; }
      return oBoot.call(this, wrappedDone);
    };
  }

  // ------------------------------------------------------------------ desktop: stage tracking + Safe Mode
  const ESSENTIAL = ["settings", "fileexplorer", "files", "notepad", "terminal", "powershell", "cmd", "taskmanager", "regedit", "regedt32", "eventviewer", "eventvwr", "run", "security", "recyclebin", "controlpanel", "devicemanager", "diskmgmt", "cleanmgr", "msconfig", "rstrui", "sysprotect"];
  let safeQuietUntil = 0;
  function allowedInSafe(id) {
    if (!id) return true;
    if (ESSENTIAL.indexOf(id) >= 0) return true;
    const a = window.Catalog && Catalog.storeApps.find((x) => x.id === id || x.builtin === id);
    return !!(a && a.builtin && ESSENTIAL.indexOf(a.builtin) >= 0);
  }
  function blocked(id) {
    const a = window.Catalog && Catalog.storeApps.find((x) => x.id === id || x.builtin === id);
    const name = (a && a.name) || id;
    log("Application", "Warning", "Safe Mode", 1530, "Blocked “" + name + "” (" + id + ") from starting: only built-in Windows tools run in Safe Mode.");
    if (Date.now() < safeQuietUntil) return;   // auto-starts are blocked quietly
    modal({ title: name + " can't open in Safe Mode", html: `<p>Safe Mode starts Windows with only the built-in tools it needs. Store apps, games, widgets and apps that start automatically are turned off.</p><p class="rc-dim">Restart normally to use ${esc(name)}.</p>`, buttons: [{ label: "Exit Safe Mode", primary: true, value: "exit" }, { label: "Close", value: null }] }).then((v) => { if (v === "exit") exitSafeMode(); });
  }
  function prepSafeMode() {
    window.WIN12_SAFE_MODE = BOOT.safe;
    safeQuietUntil = Date.now() + 8000;
    try {
      Object.keys(window.AppRegistry || {}).forEach((id) => {
        if (allowedInSafe(id) || typeof AppRegistry[id] !== "function" || AppRegistry[id].__rcBlocked) return;
        const f = function () { blocked(id); return { body: document.createElement("div"), win: document.createElement("div"), close() {} }; };
        f.__rcBlocked = true; AppRegistry[id] = f;
      });
    } catch (_) {}
    if (window.Games && Games.launch && !Games.launch.__rcBlocked) { const g = function (app) { blocked((app && app.id) || "game"); }; g.__rcBlocked = true; Games.launch = g; }
    if (window.WM && WM.open && !WM.open.__rcSafe) { const o = WM.open; const w = function (id) { if (!allowedInSafe(id)) return blocked(id); return o.apply(this, arguments); }; w.__rcSafe = true; WM.open = w; }
  }
  function exitSafeMode() {
    patchCfg((c) => { c.safeboot = null; c.safebootOnce = null; c.altshell = false; });
    reboot({});
  }
  function afterDesktop() {
    BOOT.desktop = true;
    // Shift + Restart (or press and hold Restart) → Advanced startup
    try {
      const sm = document.querySelector(".start-menu");
      if (sm) new MutationObserver(() => {
        const b = sm.querySelector('.start-powmenu [data-a="restart"]');
        if (!b || b.__rc) return; b.__rc = true;
        b.title = "Hold Shift (or press and hold) to restart into Advanced startup";
        let held = false, tm = 0;
        b.addEventListener("pointerdown", () => { held = false; clearTimeout(tm); tm = setTimeout(() => { held = true; b.classList.add("rc-held"); }, 750); });
        ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => clearTimeout(tm)));
        b.onclick = (e) => { if (e.shiftKey || held) restartToWinRE(); else location.reload(); };
      }).observe(sm, { childList: true, subtree: true });
    } catch (_) {}
    // After System Restore
    try {
      const raw = sessionStorage.getItem(NOTE_KEY);
      if (raw) {
        sessionStorage.removeItem(NOTE_KEY);
        const n = JSON.parse(raw);
        log("Application", "Information", "System Restore", 8211, "System Restore completed successfully. The account was restored to “" + n.desc + "” (" + fmtWhen(n.ts) + ").");
        setTimeout(() => modal({ title: "System Restore", html: `<div class="rc-ok-row"><span class="rc-ok-ic">✓</span><div><b>System Restore completed successfully.</b><p>Your files, apps and settings were restored to how they were on ${esc(fmtWhen(n.ts))}.</p><p class="rc-dim">Restore point: ${esc(n.desc)} (${esc(n.type)}). An “Undo: Restore Operation” point was saved first, so you can undo this from System Restore.</p></div></div>`, buttons: [{ label: "Close", primary: true, value: true }] }), 900);
      }
    } catch (_) {}
    if (BOOT.safe) {
      try { const sp = document.querySelector(".spw"); if (sp) sp.remove(); } catch (_) {}
      log("System", "Warning", "Kernel-Boot", 30, "The system started in Safe Mode (" + (BOOT.safe === "network" ? "Network" : "Minimal") + "). Only essential drivers and built-in tools were loaded; store apps, widgets and auto-starts were blocked.");
      setTimeout(() => {
        modal({ title: "Windows is running in Safe Mode", html: `<p>This special diagnostic mode of Windows starts with only the files and drivers it needs, so you can find and fix problems.</p><p class="rc-dim">Store apps, games and widgets are turned off. Settings, File Explorer, Terminal, Task Manager, System Restore and System Configuration still work.</p>`, buttons: [{ label: "OK", primary: true, value: null }, { label: "Restart normally", value: "exit" }, { label: "System Configuration", value: "msconfig" }] })
          .then((v) => { if (v === "exit") exitSafeMode(); else if (v === "msconfig") WM.open("msconfig"); });
        if (BOOT.altshell) WM.open("terminal");
      }, 700);
    }
  }
  // An uncaught error while the desktop is starting marks this start as suspect: if the page is then
  // reloaded before the desktop got ready (4 s), it counts as a failed start. Plain reloads don't.
  window.addEventListener("error", (e) => {
    if (!e || !e.message || /^Script error\.?$/.test(e.message)) return;
    if (!BOOT.readyAt || Date.now() < BOOT.readyAt) { const c = readCfg(); if (c.stage === "desktop") { c.stage = "desktop-error"; writeCfg(c); } }
  });
  if (window.WM && WM.buildDesktop && !WM.__rc) {
    const o = WM.buildDesktop; WM.__rc = true;
    WM.buildDesktop = function () {
      patchCfg((c) => { c.stage = "desktop"; });
      if (BOOT.safe) prepSafeMode();
      let res;
      try { res = o.apply(this, arguments); }
      catch (e) { bootFailure(e, "desktop"); return; }
      BOOT.readyAt = Date.now() + 4000;
      setTimeout(() => patchCfg((c) => { if (c.stage === "desktop" || c.stage === "desktop-error") { c.stage = "ready"; c.fails = 0; } }), 4000);
      try { afterDesktop(); } catch (_) {}
      return res;
    };
  }
  // Firmware: Hyper-V needs virtualization turned on in UEFI.
  if (window.VM12 && VM12.launch && !VM12.__rc) {
    const o = VM12.launch; VM12.__rc = true;
    VM12.launch = function () { if (!readCfg().fw.vt) return { ok: false, message: "Hyper-V can't start the virtual machine: virtualization (VT-x) is turned off in this PC's UEFI firmware settings." }; return o.apply(this, arguments); };
  }

  // ------------------------------------------------------------------ Windows Recovery Environment
  const IC = {
    cont: '<path d="M24 6a18 18 0 1 0 0 36 18 18 0 0 0 0-36z"/><path d="M16 24h15M25 17l7 7-7 7"/>',
    trouble: '<path d="M29 8a8 8 0 0 0-7 11L9 32a3 3 0 0 0 4 4l13-13a8 8 0 0 0 11-7l-5 3-4-1-1-4z"/>',
    off: '<path d="M24 8v15"/><path d="M14 13a15 15 0 1 0 20 0"/>',
    reset: '<rect x="6" y="9" width="36" height="24" rx="2"/><path d="M17 41h14M24 33v8"/><path d="M30 18a7 7 0 1 1-2-4"/><path d="M29 10v5h-5"/>',
    adv: '<path d="M8 12h4M8 24h4M8 36h4M18 12h22M18 24h22M18 36h22"/>',
    repair: '<rect x="5" y="8" width="38" height="26" rx="2"/><path d="M17 42h14M24 34v8"/><circle cx="24" cy="21" r="5"/><path d="M24 12v3M24 27v3M15 21h3M30 21h3"/>',
    gear: '<circle cx="24" cy="24" r="6"/><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.3 4.3M33.2 33.2l4.3 4.3M10.5 37.5l4.3-4.3M33.2 14.8l4.3-4.3"/>',
    cmd: '<rect x="5" y="9" width="38" height="30" rx="2"/><path d="M5 16h38M12 24l6 5-6 5M21 34h10"/>',
    updates: '<rect x="8" y="8" width="32" height="32" rx="2"/><path d="M16 24h16"/>',
    uefi: '<rect x="12" y="12" width="24" height="24" rx="2"/><rect x="18" y="18" width="12" height="12"/><path d="M18 6v6M24 6v6M30 6v6M18 36v6M24 36v6M30 36v6M6 18h6M6 24h6M6 30h6M36 18h6M36 24h6M36 30h6"/>',
    restore: '<path d="M8 24a16 16 0 1 0 5-11.6"/><path d="M8 8v7h7"/><path d="M24 15v10l7 4"/>',
    back: '<path d="M30 12L18 24l12 12"/>',
    user: '<circle cx="24" cy="17" r="8"/><path d="M8 42c1.5-9 8-13 16-13s14.5 4 16 13"/>',
  };
  const svg = (k, n) => `<svg viewBox="0 0 48 48" width="${n || 44}" height="${n || 44}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;
  const WinRE = (function () {
    let root = null, stack = [];
    function mount() {
      if (root && root.isConnected) return root;
      document.body.classList.remove("rc-safemode", "rc-lowres"); document.documentElement.classList.remove("rc-lowres");
      document.querySelectorAll(".rc-safe-corners").forEach((x) => x.remove());
      root = el(`<div class="rc-winre" role="application" aria-label="Windows Recovery Environment"><div class="rc-wr-in"></div></div>`);
      document.body.appendChild(root);
      return root;
    }
    function page(title, opts) {
      mount(); opts = opts || {};
      const inner = root.querySelector(".rc-wr-in");
      inner.innerHTML = "";
      const head = el(`<div class="rc-wr-head">${opts.back ? `<button type="button" class="rc-wr-back" aria-label="Back">${svg("back", 22)}</button>` : ""}<h1></h1></div>`);
      head.querySelector("h1").textContent = title;
      if (opts.back) head.querySelector(".rc-wr-back").onclick = opts.back;
      inner.appendChild(head);
      const body = el(`<div class="rc-wr-body"></div>`); inner.appendChild(body);
      root.scrollTop = 0;
      return body;
    }
    function tiles(body, list) {
      const g = el(`<div class="rc-wr-tiles"></div>`);
      list.forEach((t) => {
        const b = el(`<button type="button" class="rc-wr-tile"><span class="rc-wr-ic">${svg(t.ic)}</span><span class="rc-wr-tx"><b></b><span></span></span></button>`);
        b.querySelector("b").textContent = t.t; b.querySelector(".rc-wr-tx span").textContent = t.s || "";
        b.onclick = t.go; g.appendChild(b);
      });
      body.appendChild(g);
    }
    function btnRow(body, list) {
      const r = el(`<div class="rc-wr-btns"></div>`);
      list.forEach((x) => { const b = el(`<button type="button" class="rc-wr-btn${x.primary ? " primary" : ""}"></button>`); b.textContent = x.t; b.onclick = x.go; if (x.disabled) b.disabled = true; r.appendChild(b); });
      body.appendChild(r); return r;
    }
    function working(text) {
      mount();
      root.querySelector(".rc-wr-in").innerHTML = `<div class="rc-wr-working">${spinner()}<div></div></div>`;
      root.querySelector(".rc-wr-working div:last-child").textContent = text;
    }
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    function open() {
      log("System", "Information", "WinRE", 1, "Windows Recovery Environment (Advanced startup) was started.");
      choose();
    }
    function choose() {
      const b = page("Choose an option");
      tiles(b, [
        { ic: "cont", t: "Continue", s: "Exit and continue to Windows 12", go: () => { reboot({ label: "Please wait", noSave: true }); } },
        { ic: "trouble", t: "Troubleshoot", s: "Reset your PC or see advanced options", go: trouble },
        { ic: "off", t: "Turn off your PC", go: turnOff },
      ]);
    }
    function trouble() {
      const b = page("Troubleshoot", { back: choose });
      tiles(b, [
        { ic: "reset", t: "Reset this PC", s: "Lets you choose to keep or remove your personal files, and then reinstalls Windows.", go: () => { if (window.WM && WM.factoryReset) WM.factoryReset(); } },
        { ic: "adv", t: "Advanced options", go: advanced },
      ]);
    }
    function advanced() {
      const b = page("Advanced options", { back: trouble });
      tiles(b, [
        { ic: "repair", t: "Startup Repair", s: "Fix problems that keep Windows from loading", go: startupRepair },
        { ic: "gear", t: "Startup Settings", s: "Change Windows startup behavior", go: startupSettings },
        { ic: "cmd", t: "Command Prompt", s: "Use the Command Prompt for advanced troubleshooting", go: commandPrompt },
        { ic: "updates", t: "Uninstall Updates", s: "Remove recently installed quality or feature updates from Windows", go: uninstallUpdates },
        { ic: "uefi", t: "UEFI Firmware Settings", s: "Change settings in your PC's UEFI firmware", go: uefiConfirm },
        { ic: "restore", t: "System Restore", s: "Use a restore point recorded on your PC to restore Windows", go: () => systemRestore() },
      ]);
    }
    function turnOff() {
      const off = el(`<div class="rc-poweroff"><span>Tap anywhere to turn on your PC</span></div>`);
      document.body.appendChild(off);
      setTimeout(() => off.addEventListener("click", () => location.reload()), 600);
    }
    // ---- Startup Settings
    function startupSettings() {
      const b = page("Startup Settings", { back: advanced });
      b.appendChild(el(`<div class="rc-wr-text"><p>Restart to change Windows options such as:</p><ul><li>Enable low-resolution video mode</li><li>Enable debugging mode</li><li>Enable boot logging</li><li>Enable Safe Mode</li><li>Disable driver signature enforcement</li><li>Disable early-launch anti-malware protection</li><li>Disable automatic restart on system failure</li></ul></div>`));
      btnRow(b, [{ t: "Restart", primary: true, go: async () => { working("Restarting"); await wait(900); startupMenu(); } }]);
    }
    function startupMenu() {
      const b = page("Startup Settings");
      const opts = [[1, "Enable debugging"], [2, "Enable boot logging"], [3, "Enable low-resolution video"], [4, "Enable Safe Mode"], [5, "Enable Safe Mode with Networking"], [6, "Enable Safe Mode with Command Prompt"], [7, "Disable driver signature enforcement"], [8, "Disable early launch anti-malware protection"], [9, "Disable automatic restart after failure"]];
      b.appendChild(el(`<p class="rc-wr-p">Press a number to choose from the options below:</p>`));
      b.appendChild(el(`<p class="rc-wr-p rc-dim2">Use number keys or functions keys F1-F9 — or tap an option.</p>`));
      const list = el(`<div class="rc-wr-numlist"></div>`);
      const pick = (n) => {
        document.removeEventListener("keydown", onKey, true);
        patchCfg((c) => {
          if (n === 3) c.lowresOnce = true;
          if (n === 4) { c.safebootOnce = "minimal"; c.altshell = false; }
          if (n === 5) { c.safebootOnce = "network"; c.altshell = false; }
          if (n === 6) { c.safebootOnce = "minimal"; c.altshell = true; }
        });
        log("System", "Information", "WinRE", 2, "Startup Settings: option " + n + " (" + ((opts.find((o) => o[0] === n) || [])[1] || "Normal startup") + ") was chosen.");
        reboot({ noSave: true, label: "Please wait" });
      };
      opts.forEach(([n, t]) => { const x = el(`<button type="button" class="rc-wr-num"><b>${n})</b> <span></span></button>`); x.querySelector("span").textContent = t; x.onclick = () => pick(n); list.appendChild(x); });
      b.appendChild(list);
      b.appendChild(el(`<p class="rc-wr-p rc-dim2">Press F10 for more options. Press Enter to return to your operating system.</p>`));
      btnRow(b, [{ t: "Return to Windows (Enter)", go: () => pick(0) }]);
      const onKey = (e) => {
        const m = /^(?:F)?([1-9])$/.exec(e.key);
        if (m) { e.preventDefault(); pick(+m[1]); }
        else if (e.key === "Enter") { e.preventDefault(); pick(0); }
      };
      document.addEventListener("keydown", onKey, true);
    }
    // ---- Startup Repair
    async function startupRepair(auto) {
      working(auto ? "Diagnosing your PC" : "Startup Repair\nDiagnosing your PC");
      await wait(900);
      let r;
      try { r = await diagnose({ fix: true }); } catch (e) { r = { tests: [], problems: ["Startup Repair failed: " + e.message], fixed: [], log: String(e && e.stack || e) }; }
      await wait(600);
      log("Application", r.fixed.length ? "Warning" : "Information", "Startup Repair", r.fixed.length ? 1002 : 1001, r.fixed.length ? "Startup Repair repaired " + r.fixed.length + " problem(s): " + r.fixed.join("; ") : "Startup Repair found no problems.");
      if (auto) return r;
      const b = page("Startup Repair", { back: advanced });
      b.appendChild(el(`<div class="rc-wr-text"><h2>${r.fixed.length ? "Startup Repair repaired your PC" : r.problems.length ? "Startup Repair couldn't repair your PC" : "Startup Repair couldn't find any problems"}</h2><p>${r.fixed.length ? r.fixed.length + " problem(s) were fixed. Restart to start Windows." : "Press “Advanced options” to try other options to repair your PC or “Shut down” to turn off your PC."}</p></div>`));
      const ul = el(`<ul class="rc-wr-results"></ul>`);
      r.tests.forEach((t) => { const li = el(`<li><b></b> — <span></span><div class="rc-dim2"></div></li>`); li.querySelector("b").textContent = t.test; li.querySelector("span").textContent = t.result; li.querySelector("div").textContent = t.detail; ul.appendChild(li); });
      if (r.fixed.length) r.fixed.forEach((f) => { const li = el(`<li class="rc-fix"></li>`); li.textContent = "Fixed: " + f; ul.appendChild(li); });
      b.appendChild(ul);
      btnRow(b, [{ t: "Restart", primary: true, go: () => reboot({ noSave: true }) }, { t: "View log file (SrtTrail.txt)", go: () => showLog(r.log || readCfg().srt || "") }, { t: "Advanced options", go: advanced }]);
    }
    function showLog(text) {
      const b = page("SrtTrail.txt", { back: advanced });
      const pre = el(`<pre class="rc-wr-log"></pre>`); pre.textContent = text || "No log yet."; b.appendChild(pre);
      btnRow(b, [{ t: "Close", primary: true, go: advanced }]);
    }
    // ---- Automatic Repair (after 2 failed starts)
    async function automatic() {
      mount();
      log("System", "Error", "WinRE", 1001, "Windows failed to start twice in a row. Automatic Repair was started.");
      root.querySelector(".rc-wr-in").innerHTML = `<div class="rc-wr-working rc-wr-black">${spinner()}<div>Preparing Automatic Repair</div></div>`;
      root.classList.add("rc-black");
      await wait(1400);
      const r = await startupRepair(true);
      root.classList.remove("rc-black");
      const b = page("Automatic Repair");
      b.appendChild(el(`<div class="rc-wr-text"><h2>${r.fixed.length ? "Automatic Repair fixed your PC" : "Your PC did not start correctly"}</h2><p>${r.fixed.length ? "These problems kept Windows from starting and were repaired:" : "Press “Restart” to restart your PC, which can sometimes fix the problem. You can also press “Advanced options” to try other options to repair your PC."}</p></div>`));
      if (r.fixed.length) { const ul = el(`<ul class="rc-wr-results"></ul>`); r.fixed.forEach((f) => { const li = el(`<li class="rc-fix"></li>`); li.textContent = f; ul.appendChild(li); }); b.appendChild(ul); }
      btnRow(b, [{ t: "Advanced options", go: choose }, { t: "Restart", primary: true, go: () => reboot({ noSave: true }) }]);
    }
    // ---- account chooser (System Restore, Command Prompt)
    function chooseAccount(back, purpose, onOk) {
      const users = A() ? Accounts.list() : [{ id: State.accountId, name: userName(), type: "admin", methods: [] }];
      const b = page(purpose, { back });
      b.appendChild(el(`<p class="rc-wr-p">To continue, choose an account.</p>`));
      const g = el(`<div class="rc-wr-accts"></div>`);
      if (!users.length) users.push({ id: State.accountId, name: userName(), type: "admin", methods: [] });
      users.forEach((u) => {
        const x = el(`<button type="button" class="rc-wr-acct">${A() ? Accounts.avatar(u, 44) : svg("user", 40)}<span><b></b><span>${u.type === "standard" ? "Standard user" : "Administrator"}</span></span></button>`);
        x.querySelector("b").textContent = u.name;
        x.onclick = () => password(u);
        g.appendChild(x);
      });
      b.appendChild(g);
      function password(u) {
        if (A() && !Accounts.needsSecret(u.id)) return onOk(u);
        const p = page(u.name, { back: () => chooseAccount(back, purpose, onOk) });
        p.appendChild(el(`<p class="rc-wr-p">Enter the PIN or password for this account.</p>`));
        const f = el(`<form class="rc-wr-form" autocomplete="off"><input type="password" data-no-eye class="rc-wr-input" aria-label="PIN or password"><div class="rc-wr-err" role="alert"></div></form>`);
        p.appendChild(f);
        const inp = f.querySelector("input"), err = f.querySelector(".rc-wr-err");
        const go = async () => {
          const ok = A() ? await Accounts.verify(u.id, inp.value) : true;
          if (ok) onOk(u); else { err.textContent = "The password is incorrect. Try again."; inp.value = ""; inp.focus(); }
        };
        f.onsubmit = (e) => { e.preventDefault(); go(); };
        btnRow(p, [{ t: "Continue", primary: true, go }, { t: "Cancel", go: () => chooseAccount(back, purpose, onOk) }]);
        setTimeout(() => inp.focus(), 50);
      }
    }
    // ---- System Restore (from WinRE)
    function systemRestore() {
      chooseAccount(advanced, "System Restore", async (u) => {
        const key = State.keyFor(u.id);
        working("Finding restore points");
        let list = [];
        try { list = await points.list(key); } catch (e) { }
        await wait(500);
        const b = page("System Restore — " + u.name, { back: advanced });
        if (!list.length) { b.appendChild(el(`<div class="rc-wr-text"><h2>No restore points</h2><p>No restore points have been created for ${esc(u.name)} yet. Create them in Windows from Settings → System → About → System protection.</p></div>`)); btnRow(b, [{ t: "Back", go: advanced }]); return; }
        b.appendChild(el(`<p class="rc-wr-p">Choose the restore point to go back to. Only ${esc(u.name)}'s files, apps and settings change.</p>`));
        const tbl = el(`<div class="rc-wr-points" role="listbox"></div>`);
        let sel = list[0].id;
        list.forEach((m) => {
          const r = el(`<button type="button" class="rc-wr-pt" role="option"><span>${esc(fmtWhen(m.ts))}</span><span class="d"></span><span>${esc(m.type)}</span><span>${esc(fmtSize(m.size))}</span></button>`);
          r.querySelector(".d").textContent = m.desc;
          if (m.id === sel) r.classList.add("on");
          r.onclick = () => { sel = m.id; tbl.querySelectorAll(".rc-wr-pt").forEach((x) => x.classList.toggle("on", x === r)); };
          tbl.appendChild(r);
        });
        b.appendChild(tbl);
        btnRow(b, [{ t: "Restore", primary: true, go: async () => {
          const m = list.find((x) => x.id === sel);
          const c = page("Confirm your restore point", { back: systemRestore });
          c.appendChild(el(`<div class="rc-wr-text"><p>${esc(u.name)}'s files and settings will be restored to the state they were in before the event below.</p><p><b>Time:</b> ${esc(fmtWhen(m.ts))}<br><b>Description:</b> ${esc(m.type)}: ${esc(m.desc)}<br><b>Size:</b> ${esc(fmtSize(m.size))}</p><p>Once started, System Restore cannot be interrupted.</p></div>`));
          btnRow(c, [{ t: "Finish", primary: true, go: async () => {
            working("Please wait while your Windows files and settings are being restored.\nSystem Restore is restoring the registry...");
            await wait(1500);
            try { await restore(m.id); } catch (e) { const f = page("System Restore", { back: advanced }); f.appendChild(el(`<div class="rc-wr-text"><h2>System Restore did not complete successfully</h2><p></p></div>`)).querySelector("p").textContent = e.message; btnRow(f, [{ t: "Close", primary: true, go: advanced }]); return; }
            const d = page("System Restore");
            d.appendChild(el(`<div class="rc-wr-text"><h2>System Restore completed successfully</h2><p>${esc(u.name)} was restored to ${esc(fmtWhen(m.ts))}. Restart your PC to continue.</p></div>`));
            btnRow(d, [{ t: "Restart", primary: true, go: () => reboot({ noSave: true }) }]);
          } }, { t: "Back", go: systemRestore }]);
        } }, { t: "Cancel", go: advanced }]);
      });
    }
    // ---- Command Prompt (the real terminal engine)
    function loadTerminal() {
      if (window.TerminalCore) return Promise.resolve(window.TerminalCore);
      return new Promise((res, rej) => {
        const src = (Array.from(document.scripts).map((s) => s.getAttribute("src") || "").find((s) => /js\/apps2\.js/.test(s)) || "");
        const v = (/[?&]v=([^&#]+)/.exec(src) || [])[1];
        const sc = document.createElement("script"); sc.src = "js/terminal-core.js" + (v ? "?v=" + v : "");
        sc.onload = () => (window.TerminalCore ? res(window.TerminalCore) : rej(new Error("Terminal engine missing")));
        sc.onerror = () => rej(new Error("Could not load the command processor (js/terminal-core.js)."));
        document.head.appendChild(sc);
      });
    }
    function commandPrompt() {
      const users = A() ? Accounts.list() : [];
      const cur = users.find((u) => u.id === State.accountId);
      const go = (u) => {
        if (u.id !== State.accountId) {
          // The prompt works on the files of the account that's loaded; switch to the chosen one first.
          try { const r = JSON.parse(LS.getItem(State.ACCOUNTS_KEY)); r.current = u.id; LS.setItem(State.ACCOUNTS_KEY, JSON.stringify(r)); } catch (_) {}
          patchCfg((c) => { c.winre = true; }); try { sessionStorage.setItem("win12_winre_cmd" + VM, "1"); } catch (_) {}
          reboot({ noSave: true, label: "Please wait" }); return;
        }
        loadTerminal().then((T) => {
          const ov = el(`<div class="rc-wr-cmd"><div class="rc-wr-cmdbar"><span>Administrator: X:\\windows\\system32\\cmd.exe</span><button type="button" aria-label="Close">✕</button></div><div class="rc-wr-cmdbody"></div></div>`);
          root.appendChild(ov);
          const body = ov.querySelector(".rc-wr-cmdbody"), win = ov;
          const close = () => { ov.remove(); advanced(); };
          ov.querySelector("button").onclick = close;
          T.open(() => ({ body, win, close, el: ov }));
          setTimeout(() => { const i = ov.querySelector(".wt-in"); if (i) i.focus(); }, 80);
        }).catch((e) => { const p = page("Command Prompt", { back: advanced }); p.appendChild(el(`<p class="rc-wr-p"></p>`)).textContent = e.message; });
      };
      if (cur && !(A() && Accounts.needsSecret(cur.id)) && users.length < 2) return go(cur);
      chooseAccount(advanced, "Command Prompt", go);
    }
    // ---- Uninstall Updates (appData.winupdate history of the loaded account)
    function uninstallUpdates() {
      const b = page("Uninstall Updates", { back: advanced });
      const key = State.STORAGE_KEY;
      let st = null; try { st = JSON.parse(LS.getItem(key) || "null"); } catch (_) {}
      const hist = (st && st.appData && st.appData.winupdate && Array.isArray(st.appData.winupdate.history)) ? st.appData.winupdate.history : [];
      const quality = hist.filter((h) => h && (h.status === "Successfully installed" || h.status === "Pending restart") && !/feature/i.test(h.title || ""));
      const feature = hist.filter((h) => h && h.status === "Successfully installed" && /feature/i.test(h.title || ""));
      const run = async (kind, item) => {
        const c = page("Uninstall latest " + kind + " update", { back: uninstallUpdates });
        c.appendChild(el(`<div class="rc-wr-text"><p>Uninstall “${esc(item.title || item.kb)}” from ${esc(userName())}'s Windows Update history? Windows will restart afterwards.</p></div>`));
        btnRow(c, [{ t: "Uninstall " + kind + " update", primary: true, go: async () => {
          working("Uninstalling the latest " + kind + " update…"); await wait(1400);
          try {
            const s2 = JSON.parse(LS.getItem(key)); const w = s2.appData.winupdate;
            const it = w.history.find((h) => h.ts === item.ts && h.title === item.title);
            if (it) { it.status = "Uninstalled"; it.uninstalled = Date.now(); }
            if (w.pending && it && w.pending.build === it.build) w.pending = null;
            if (it && w.installedBuild === it.build) { const prev = w.history.find((h) => h !== it && h.status === "Successfully installed"); w.installedBuild = prev ? prev.build : null; }
            if (s2.update) s2.update.installed = false;
            LS.setItem(key, JSON.stringify(s2)); State.freeze();
            log("Setup", "Information", "Microsoft-Windows-Servicing", 3, "Package " + (item.kb || "update") + " was successfully changed to the Uninstalled state (from Windows Recovery Environment).");
          } catch (e) { const f = page("Uninstall Updates", { back: advanced }); f.appendChild(el(`<p class="rc-wr-p"></p>`)).textContent = "Couldn't uninstall: " + e.message; return; }
          const d = page("Uninstall Updates");
          d.appendChild(el(`<div class="rc-wr-text"><h2>You've successfully uninstalled the latest ${kind} update.</h2></div>`));
          btnRow(d, [{ t: "Done", primary: true, go: () => reboot({ noSave: true }) }]);
        } }, { t: "Cancel", go: uninstallUpdates }]);
      };
      tiles(b, [
        { ic: "updates", t: "Uninstall latest quality update", s: quality.length ? (quality[0].title || quality[0].kb) : "No quality updates are installed", go: () => { if (quality.length) run("quality", quality[0]); } },
        { ic: "updates", t: "Uninstall latest feature update", s: feature.length ? (feature[0].title || feature[0].kb) : "No feature updates are installed", go: () => { if (feature.length) run("feature", feature[0]); } },
      ]);
    }
    function uefiConfirm() {
      const b = page("UEFI Firmware Settings", { back: advanced });
      b.appendChild(el(`<div class="rc-wr-text"><p>Restart to change UEFI firmware settings.</p></div>`));
      btnRow(b, [{ t: "Restart", primary: true, go: () => { patchCfg((c) => { c.uefiOnce = true; }); reboot({ noSave: true }); } }]);
    }
    // Resumed after switching account for the Command Prompt
    function resume() { try { if (sessionStorage.getItem("win12_winre_cmd" + VM)) { sessionStorage.removeItem("win12_winre_cmd" + VM); setTimeout(commandPrompt, 50); return true; } } catch (_) {} return false; }
    return { open() { open(); resume(); }, automatic, choose, advanced, startupRepair, systemRestore, commandPrompt, page };
  })();

  // ------------------------------------------------------------------ UEFI firmware settings (simulated firmware)
  function firmware() {
    const cfg = readCfg(), fw = JSON.parse(JSON.stringify(cfg.fw));
    const NAMES = { wbm: "Windows Boot Manager (Local Disk C:)", usb: "UEFI: USB Flash Drive", pxe: "UEFI: PXE IPv4 Network" };
    const onoff = (v) => (v ? "[Enabled]" : "[Disabled]");
    let tab = 0, sel = 0;
    const root = el(`<div class="rc-fw" role="application" aria-label="UEFI firmware settings">
      <div class="rc-fw-top">Aptio Setup — Cameron Systems Firmware</div>
      <div class="rc-fw-tabs"></div>
      <div class="rc-fw-main"><div class="rc-fw-list"></div><div class="rc-fw-help"><div class="rc-fw-hl"></div><div class="rc-fw-keys">→←: Select Screen<br>↑↓: Select Item<br>Enter / tap: Change<br>F9: Optimized Defaults<br>F10: Save &amp; Exit<br>ESC: Exit</div></div></div>
      <div class="rc-fw-foot">Version 2.22.1287 Copyright (C) 2026 Cameron Systems, Inc.</div></div>`);
    document.body.appendChild(root);
    const mem = navigator.deviceMemory ? navigator.deviceMemory + " GB (reported by the browser)" : "Not reported by this browser";
    const clock = () => { const d = new Date(); return [d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" }), d.toLocaleTimeString()]; };
    const tabs = [
      { name: "Main", items: () => [
        { l: "BIOS Vendor", v: "Cameron Systems" }, { l: "Core Version", v: "5.27" }, { l: "Compliancy", v: "UEFI 2.9; PI 1.8" }, { l: "Project Version", v: "W12-26H1 x64" }, { l: "Build Date and Time", v: "11/01/2026 04:12:00" },
        { l: "Processor", v: (navigator.hardwareConcurrency || "?") + " logical processors (real)" }, { l: "Total Memory", v: mem }, { l: "Platform", v: navigator.platform || "Unknown" },
        { l: "System Date", v: clock()[0], h: "The real date from this device's clock." }, { l: "System Time", v: clock()[1] },
      ] },
      { name: "Advanced", items: () => [
        { l: "Intel(R) Virtualization Technology", v: onoff(fw.vt), act: () => (fw.vt = !fw.vt), h: "When disabled, Hyper-V virtual machines (win12 / Start-VM) can't start." },
        { l: "Security Device Support (TPM 2.0)", v: onoff(fw.tpm), act: () => (fw.tpm = !fw.tpm), h: "Trusted Platform Module. Shown to Windows (Get-Tpm)." },
        { l: "Hyper-Threading", v: "[Enabled]", h: "Fixed by this platform." },
      ] },
      { name: "Boot", items: () => [
        { l: "Boot Mode", v: "[UEFI]", h: "Legacy BIOS (CSM) isn't supported by Windows 12." },
        { l: "Fast Boot", v: onoff(fw.fastBoot), act: () => (fw.fastBoot = !fw.fastBoot), h: "Shortens the firmware's part of the restart." },
      ].concat(fw.bootOrder.map((d, i) => ({ l: "Boot Option #" + (i + 1), v: "[" + NAMES[d] + "]", act: () => { const j = i === 0 ? fw.bootOrder.length - 1 : i - 1; const t = fw.bootOrder[i]; fw.bootOrder.splice(i, 1); fw.bootOrder.splice(j, 0, t); }, h: "Tap to move this device up the boot order (#1 moves to the bottom). Devices before Windows Boot Manager are tried first." }))) },
      { name: "Security", items: () => [
        { l: "Secure Boot", v: onoff(fw.secureBoot), act: () => (fw.secureBoot = !fw.secureBoot), h: "Shown to Windows: Confirm-SecureBootUEFI and Settings → About." },
        { l: "Secure Boot Mode", v: "[Standard]" }, { l: "Administrator Password", v: "Not Installed" },
      ] },
      { name: "Save & Exit", items: () => [
        { l: "Save Changes and Reset", act: () => saveExit(true), h: "Save and restart into Windows." },
        { l: "Discard Changes and Exit", act: () => saveExit(false) },
        { l: "Restore Defaults", act: () => { Object.assign(fw, fwDefaults()); }, h: "Load optimized defaults (not saved until you choose Save)." },
        { l: "Boot Override: Windows Boot Manager", act: () => saveExit(false) },
      ] },
    ];
    function saveExit(save) {
      if (save) { patchCfg((c) => { c.fw = fw; }); log("System", "Information", "Firmware", 1, "UEFI firmware settings changed: Secure Boot " + (fw.secureBoot ? "on" : "off") + ", TPM " + (fw.tpm ? "on" : "off") + ", virtualization " + (fw.vt ? "on" : "off") + ", boot order " + fw.bootOrder.join(" > ") + "."); }
      document.removeEventListener("keydown", onKey, true);
      clearInterval(iv);
      reboot({ noSave: true, label: "" });
    }
    function paint() {
      const items = tabs[tab].items();
      sel = Math.max(0, Math.min(sel, items.length - 1));
      root.querySelector(".rc-fw-tabs").innerHTML = tabs.map((t, i) => `<button type="button" class="${i === tab ? "on" : ""}" data-t="${i}">${esc(t.name)}</button>`).join("");
      root.querySelector(".rc-fw-list").innerHTML = items.map((it, i) => `<button type="button" class="rc-fw-it${i === sel ? " on" : ""}${it.act ? " act" : ""}" data-i="${i}"><span>${esc(it.l)}</span><span>${esc(it.v || "")}</span></button>`).join("");
      root.querySelector(".rc-fw-hl").textContent = (items[sel] && items[sel].h) || "";
    }
    root.querySelector(".rc-fw-tabs").onclick = (e) => { const b = e.target.closest("[data-t]"); if (b) { tab = +b.dataset.t; sel = 0; paint(); } };
    root.querySelector(".rc-fw-list").onclick = (e) => { const b = e.target.closest("[data-i]"); if (!b) return; const i = +b.dataset.i; const it = tabs[tab].items()[i]; sel = i; if (it.act) it.act(); paint(); };
    const onKey = (e) => {
      const items = tabs[tab].items();
      if (e.key === "ArrowRight") tab = (tab + 1) % tabs.length, sel = 0;
      else if (e.key === "ArrowLeft") tab = (tab + tabs.length - 1) % tabs.length, sel = 0;
      else if (e.key === "ArrowDown") sel = Math.min(items.length - 1, sel + 1);
      else if (e.key === "ArrowUp") sel = Math.max(0, sel - 1);
      else if (e.key === "Enter" || e.key === "+" || e.key === "-") { if (items[sel] && items[sel].act) items[sel].act(); }
      else if (e.key === "F10") { e.preventDefault(); saveExit(true); return; }
      else if (e.key === "F9") { e.preventDefault(); Object.assign(fw, fwDefaults()); }
      else if (e.key === "Escape") { saveExit(false); return; }
      else return;
      e.preventDefault(); paint();
    };
    document.addEventListener("keydown", onKey, true);
    const iv = setInterval(() => { if (tab === 0) paint(); }, 1000);
    paint();
  }

  // ------------------------------------------------------------------ Apps: System Restore (rstrui), System Configuration (msconfig), System Properties
  const ICONS = {
    rstrui: `<svg viewBox="0 0 48 48" width="100%" height="100%"><defs><linearGradient id="rcRs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3ea0ff"/><stop offset="1" stop-color="#0058b0"/></linearGradient></defs><rect x="4" y="6" width="40" height="28" rx="3" fill="url(#rcRs)"/><rect x="17" y="36" width="14" height="4" fill="#7a8796"/><rect x="12" y="40" width="24" height="3" rx="1.5" fill="#9aa6b4"/><circle cx="24" cy="20" r="9" fill="#fff"/><path d="M24 14v6l4 2.5" stroke="#0058b0" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M13.5 13.5l2.6 4.4 2.7-3.9" fill="#ffb900"/></svg>`,
    msconfig: `<svg viewBox="0 0 48 48" width="100%" height="100%"><rect x="5" y="7" width="38" height="32" rx="3" fill="#e9eef5" stroke="#6b7a90"/><rect x="5" y="7" width="38" height="7" rx="3" fill="#0067c0"/><circle cx="31" cy="27" r="7" fill="#5b6b80"/><circle cx="31" cy="27" r="2.6" fill="#e9eef5"/><path d="M10 20h12M10 25h10M10 30h12" stroke="#6b7a90" stroke-width="2" stroke-linecap="round"/></svg>`,
    sysprotect: `<svg viewBox="0 0 48 48" width="100%" height="100%"><path d="M24 4l17 6v12c0 10-7 18-17 22C14 40 7 32 7 22V10z" fill="#0067c0"/><path d="M24 4v40c10-4 17-12 17-22V10z" fill="#3a96ff"/><path d="M17 24a7 7 0 1 0 2.2-5.1" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M18 14v5h5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  try { if (window.Icon && Icon.register) Object.keys(ICONS).forEach((k) => Icon.register(k, ICONS[k])); } catch (_) {}
  const iconMini = (id, name) => (window.Icon ? Icon.mini(id, name) : "");
  window.AppRegistry = window.AppRegistry || {};

  AppRegistry.rstrui = function () {
    const ref = WM.createWindow({ title: "System Restore", icon: iconMini("rstrui", "System Restore"), width: 620, height: 500, appId: "rstrui" });
    const body = ref.body; body.classList.add("rc-app");
    let list = [], sel = null;
    async function load() { try { list = await points.list(State.STORAGE_KEY); } catch (e) { list = []; } }
    function frame(title, sub, inner, btns) {
      body.innerHTML = `<div class="rc-wiz"><div class="rc-wiz-head">${ICONS.rstrui}<div><h2></h2><p></p></div></div><div class="rc-wiz-body"></div><div class="rc-wiz-foot"></div></div>`;
      body.querySelector("h2").textContent = title; body.querySelector(".rc-wiz-head p").textContent = sub || "";
      const b = body.querySelector(".rc-wiz-body"); if (typeof inner === "string") b.innerHTML = inner; else if (inner) b.appendChild(inner);
      const f = body.querySelector(".rc-wiz-foot");
      btns.forEach((x) => { const bt = el(`<button type="button" class="rc-btn${x.primary ? " rc-btn-primary" : ""}"></button>`); bt.textContent = x.t; bt.onclick = x.go; if (x.disabled) bt.disabled = true; if (x.cls) bt.classList.add(x.cls); f.appendChild(bt); });
      return b;
    }
    async function step1() {
      await load();
      if (!list.length) {
        frame("System Restore", "Restore system files and settings", `<p>System Restore can help fix problems that might be making your computer run slowly or stop responding.</p><p><b>No restore points have been created for ${esc(userName())} yet.</b></p><p class="rc-dim">Restore points are made automatically before apps or updates are installed, or you can create one now.</p>`,
          [{ t: "Create a restore point", primary: true, go: async () => { await createDialog(); step1(); } }, { t: "Cancel", go: () => ref.close() }]);
        return;
      }
      const latest = list[0];
      const box = frame("System Restore", "Restore system files and settings", `<p>System Restore can help fix problems that might be making your computer run slowly or stop responding. It changes only <b>${esc(userName())}</b>'s files, apps and settings — other accounts aren't touched.</p>
        <label class="rc-radio"><input type="radio" name="rcrs" value="rec" checked><span>Recommended restore: <b></b><br><span class="rc-dim"></span></span></label>
        <label class="rc-radio"><input type="radio" name="rcrs" value="pick"><span>Choose a different restore point</span></label>`,
        [{ t: "Next >", primary: true, go: () => { const v = body.querySelector('input[name="rcrs"]:checked').value; if (v === "rec") { sel = latest.id; step3(); } else step2(); } }, { t: "Cancel", go: () => ref.close() }]);
      box.querySelector(".rc-radio b").textContent = latest.desc;
      box.querySelector(".rc-radio .rc-dim").textContent = fmtWhen(latest.ts) + " · " + latest.type;
    }
    function step2() {
      const wrap = el(`<div><p>Current time zone: ${esc((Intl.DateTimeFormat().resolvedOptions().timeZone) || "local")}</p><div class="rc-table" role="grid"><div class="rc-tr rc-th"><span>Date and Time</span><span>Description</span><span>Type</span><span>Size</span></div></div><div class="rc-wiz-tools"></div></div>`);
      const t = wrap.querySelector(".rc-table");
      if (!list.some((m) => m.id === sel)) sel = list[0] && list[0].id;
      list.forEach((m) => {
        const r = el(`<button type="button" class="rc-tr" role="row"><span>${esc(fmtWhen(m.ts))}</span><span class="d"></span><span>${esc(m.type)}</span><span>${esc(fmtSize(m.size))}</span></button>`);
        r.querySelector(".d").textContent = m.desc;
        if (m.id === sel) r.classList.add("on");
        r.onclick = () => { sel = m.id; t.querySelectorAll(".rc-tr").forEach((x) => x.classList.toggle("on", x === r)); };
        t.appendChild(r);
      });
      const tools = wrap.querySelector(".rc-wiz-tools");
      const scan = el(`<button type="button" class="rc-btn">Scan for affected programs</button>`); scan.onclick = () => affected(sel);
      const del = el(`<button type="button" class="rc-btn">Delete</button>`);
      del.onclick = async () => { const m = list.find((x) => x.id === sel); if (!m) return; const ok = await modal({ title: "Delete restore point?", html: `<p>Delete “${esc(m.desc)}” (${esc(fmtWhen(m.ts))})? You won't be able to restore to it.</p>`, buttons: [{ label: "Delete", primary: true, value: true }, { label: "Cancel", value: false }] }); if (!ok) return; await points.remove(m.id); log("Application", "Information", "System Restore", 8212, "Restore point “" + m.desc + "” was deleted."); await load(); if (!list.length) return step1(); sel = list[0].id; step2(); };
      const mk = el(`<button type="button" class="rc-btn">Create…</button>`); mk.onclick = async () => { if (await createDialog()) { await load(); sel = list[0] && list[0].id; step2(); } };
      tools.append(scan, del, mk);
      frame("Restore your computer to the state it was in before the selected event", "How do I choose a restore point?", wrap, [{ t: "< Back", go: step1 }, { t: "Next >", primary: true, go: () => { if (sel) step3(); } }, { t: "Cancel", go: () => ref.close() }]);
    }
    async function affected(id) {
      const m = list.find((x) => x.id === id); if (!m) return;
      let then = []; try { then = JSON.parse(await points.json(id)).installedApps || []; } catch (_) {}
      const now = S().installedApps || [];
      const nm = (x) => { const a = window.Catalog && Catalog.storeApps.find((c) => c.id === x); return esc(a ? a.name : x); };
      const del = now.filter((x) => then.indexOf(x) < 0), back = then.filter((x) => now.indexOf(x) < 0);
      modal({ title: "Scan for affected programs", wide: true, html: `<p class="rc-dim">Description: ${esc(m.desc)} · Date: ${esc(fmtWhen(m.ts))}</p><p><b>Programs and apps that will be deleted:</b></p>${del.length ? `<ul>${del.map((x) => `<li>${nm(x)}</li>`).join("")}</ul>` : `<p class="rc-dim">None detected.</p>`}<p><b>Programs and apps that will be restored:</b></p>${back.length ? `<ul>${back.map((x) => `<li>${nm(x)}</li>`).join("")}</ul>` : `<p class="rc-dim">None detected.</p>`}<p class="rc-dim">Your desktop, files and settings also go back to how they were at that time.</p>`, buttons: [{ label: "Close", primary: true }] });
    }
    function step3() {
      const m = list.find((x) => x.id === sel); if (!m) return step1();
      const box = frame("Confirm your restore point", "", `<p>Your computer will be restored to the state it was in before the event in the Description field below.</p>
        <table class="rc-kv"><tr><td>Time:</td><td>${esc(fmtWhen(m.ts))}</td></tr><tr><td>Description:</td><td class="d"></td></tr><tr><td>Account:</td><td>${esc(m.user)}</td></tr><tr><td>Size:</td><td>${esc(fmtSize(m.size))}</td></tr></table>
        <p class="rc-dim">Windows will save an “Undo” restore point first, then restart. Other accounts on this PC aren't changed.</p>`,
        [{ t: "< Back", go: () => (list.length > 1 ? step2() : step1()) }, { t: "Finish", primary: true, go: finish }, { t: "Cancel", go: () => ref.close() }]);
      box.querySelector(".d").textContent = m.type + ": " + m.desc;
      async function finish() {
        const ok = await modal({ title: "System Restore", html: `<p>Once started, System Restore cannot be interrupted. Do you want to continue?</p>`, buttons: [{ label: "Yes", primary: true, value: true }, { label: "No", value: false }] });
        if (!ok) return;
        if (!(await elevate("System Restore"))) return;
        const ov = el(`<div class="rc-restarting rc-restoring">${spinner()}<div>Please wait while your Windows files and settings are being restored.</div><div class="rc-dim2">System Restore is initializing...</div></div>`);
        document.body.appendChild(ov);
        try { await restore(m.id); }
        catch (e) { ov.remove(); modal({ title: "System Restore did not complete successfully", html: `<p>${esc(e.message)}</p><p class="rc-dim">Your computer's files and settings were not changed.</p>` }); return; }
        ov.querySelector(".rc-dim2").textContent = "System Restore is restoring the registry...";
        setTimeout(() => { ov.remove(); reboot({ noSave: true, label: "Restarting" }); }, 1300);
      }
    }
    step1();
  };

  // "Create a restore point" dialog (System Properties, System Restore, Settings).
  async function createDialog() {
    const desc = await modal({ title: "Create a restore point", html: `<p>Type a description to help you identify the restore point. The current date and time are added automatically.</p><input class="rc-input rc-cp-desc" maxlength="80" spellcheck="false" aria-label="Description">`,
      buttons: [{ label: "Create", primary: true, onClick: (api) => { const v = api.content.querySelector(".rc-cp-desc").value.trim(); if (!v) { api.error("Type a description."); return false; } return v; } }, { label: "Cancel", value: null }] });
    if (!desc) return null;
    const ov = el(`<div class="rc-modal-dim"><div class="rc-modal"><div class="rc-modal-body"><h2 class="rc-modal-title">System Protection</h2><div class="rc-busy">${spinner()}<span>Creating a restore point...</span></div></div></div></div>`);
    document.body.appendChild(ov);
    let meta = null, err = null;
    try { [meta] = await Promise.all([createPoint(desc, "Manual"), new Promise((r) => setTimeout(r, 900))]); } catch (e) { err = e; }
    ov.remove();
    if (err) { await modal({ title: "System Protection", html: `<p>The restore point couldn't be created: ${esc(err.message)}</p>` }); return null; }
    await modal({ title: "System Protection", html: `<p>The restore point was created successfully.</p><p class="rc-dim">${esc(meta.desc)} · ${esc(fmtSize(meta.size))}</p>`, buttons: [{ label: "Close", primary: true }] });
    return meta;
  }

  AppRegistry.sysprotect = function () {
    const ref = WM.createWindow({ title: "System Properties", icon: iconMini("sysprotect", "System Properties"), width: 520, height: 540, appId: "sysprotect" });
    const body = ref.body; body.classList.add("rc-app");
    async function paint() {
      let list = []; try { list = await points.list(State.STORAGE_KEY); } catch (_) {}
      const used = list.reduce((s, m) => s + (m.size || 0), 0);
      body.innerHTML = `<div class="rc-props"><div class="rc-tabs"><span>Computer Name</span><span>Hardware</span><span>Advanced</span><span class="on">System Protection</span><span>Remote</span></div>
        <div class="rc-props-body">
          <div class="rc-row-ic">${ICONS.sysprotect}<p>Use system protection to undo unwanted system changes.</p></div>
          <fieldset><legend>System Restore</legend><div class="rc-flex"><p>You can undo system changes by reverting your computer to a previous restore point.</p><button type="button" class="rc-btn" data-a="rstrui">System Restore...</button></div></fieldset>
          <fieldset><legend>Protection Settings</legend>
            <div class="rc-table"><div class="rc-tr rc-th"><span>Available Drives</span><span>Protection</span></div><div class="rc-tr"><span>Local Disk (C:) (System) — ${esc(userName())}</span><span>On</span></div></div>
            <p class="rc-dim">${list.length} of ${MAX_POINTS} restore points · ${esc(fmtSize(used))} used in IndexedDB</p>
            <div class="rc-flex"><p>Delete all restore points for this account.</p><button type="button" class="rc-btn" data-a="config">Delete...</button></div>
            <div class="rc-flex"><p>Create a restore point right now for the drives that have system protection turned on.</p><button type="button" class="rc-btn" data-a="create">Create...</button></div>
          </fieldset></div>
        <div class="rc-wiz-foot"><button type="button" class="rc-btn rc-btn-primary" data-a="ok">OK</button><button type="button" class="rc-btn" data-a="ok">Cancel</button></div></div>`;
      body.onclick = async (e) => {
        const b = e.target.closest("[data-a]"); if (!b) return;
        const a = b.dataset.a;
        if (a === "ok") ref.close();
        else if (a === "rstrui") WM.open("rstrui");
        else if (a === "create") { if (await createDialog()) paint(); }
        else if (a === "config") {
          if (!list.length) return modal({ title: "System Protection", html: `<p>There are no restore points to delete.</p>` });
          const ok = await modal({ title: "System Protection", html: `<p>You will not be able to undo unwanted system changes on ${esc(userName())}'s account by using System Restore. Delete all ${list.length} restore points?</p>`, buttons: [{ label: "Continue", primary: true, value: true }, { label: "Cancel", value: false }] });
          if (!ok || !(await elevate("System Protection"))) return;
          const n = await points.removeAllFor(State.STORAGE_KEY); log("Application", "Information", "System Restore", 8212, n + " restore point(s) were deleted by the user."); paint();
        }
      };
    }
    paint();
  };

  AppRegistry.msconfig = function () {
    const ref = WM.createWindow({ title: "System Configuration", icon: iconMini("msconfig", "System Configuration"), width: 560, height: 470, appId: "msconfig" });
    const body = ref.body; body.classList.add("rc-app");
    const c0 = readCfg();
    const st = { safe: !!c0.safeboot, kind: c0.safeboot || "minimal", alt: !!c0.altshell, base: !!c0.basevideo, tab: "boot", startup: (S().appData && S().appData.msconfigStartup) || "normal" };
    function paint() {
      body.innerHTML = `<div class="rc-props"><div class="rc-tabs">${[["general", "General"], ["boot", "Boot"], ["services", "Services"], ["startup", "Startup"], ["tools", "Tools"]].map(([k, n]) => `<button type="button" data-tab="${k}" class="${st.tab === k ? "on" : ""}">${n}</button>`).join("")}</div><div class="rc-props-body rc-msc"></div>
        <div class="rc-wiz-foot"><button type="button" class="rc-btn rc-btn-primary" data-a="ok">OK</button><button type="button" class="rc-btn" data-a="cancel">Cancel</button><button type="button" class="rc-btn" data-a="apply">Apply</button></div></div>`;
      const p = body.querySelector(".rc-msc");
      if (st.tab === "general") p.innerHTML = `<fieldset><legend>Startup selection</legend>
        <label class="rc-radio"><input type="radio" name="g" value="normal" ${!st.safe ? "checked" : ""}><span><b>Normal startup</b><br><span class="rc-dim">Load all device drivers and services</span></span></label>
        <label class="rc-radio"><input type="radio" name="g" value="diag" ${st.safe ? "checked" : ""}><span><b>Diagnostic startup</b><br><span class="rc-dim">Load basic devices and services only (Safe Mode)</span></span></label></fieldset>`;
      if (st.tab === "boot") p.innerHTML = `<div class="rc-oslist"><div class="on">Windows 12 (C:\\Windows) : Current OS; Default OS</div></div>
        <fieldset><legend>Boot options</legend>
        <label class="rc-check"><input type="checkbox" data-k="safe" ${st.safe ? "checked" : ""}><span>Safe boot</span></label>
        <div class="rc-indent"><label class="rc-radio"><input type="radio" name="k" value="minimal" ${st.kind === "minimal" ? "checked" : ""} ${st.safe ? "" : "disabled"}><span>Minimal</span></label>
        <label class="rc-radio"><input type="radio" name="k" value="network" ${st.kind === "network" ? "checked" : ""} ${st.safe ? "" : "disabled"}><span>Network</span></label>
        <label class="rc-check"><input type="checkbox" data-k="alt" ${st.alt ? "checked" : ""} ${st.safe ? "" : "disabled"}><span>Alternate shell (open Command Prompt)</span></label></div>
        <label class="rc-check"><input type="checkbox" data-k="base" ${st.base ? "checked" : ""}><span>Base video (low resolution)</span></label></fieldset>
        <p class="rc-dim">Safe boot stays on until you clear it here, restart from Settings, or run <code>bcdedit /deletevalue {current} safeboot</code>.</p>`;
      if (st.tab === "services") p.innerHTML = `<p class="rc-dim">Services are managed by Windows in this PC. Use Task Manager to see running apps.</p>`;
      if (st.tab === "startup") p.innerHTML = `<p>To manage startup items, use the Startup section of Task Manager.</p><button type="button" class="rc-btn" data-open="taskmanager">Open Task Manager</button>`;
      if (st.tab === "tools") p.innerHTML = `<div class="rc-table">${[["System Restore", "Restore your computer system to an earlier state.", "rstrui"], ["System Properties", "Create and manage restore points.", "sysprotect"], ["Command Prompt", "Open a command prompt window.", "terminal"], ["Event Viewer", "View monitoring and troubleshooting messages.", "eventviewer"], ["Registry Editor", "Make changes to the Windows registry.", "regedit"], ["Task Manager", "View details about programs and processes.", "taskmanager"], ["Advanced startup", "Restart into the Windows Recovery Environment.", "__winre"]].map(([n, d, id]) => `<button type="button" class="rc-tr" data-open="${id}"><span><b>${n}</b></span><span class="rc-dim">${d}</span></button>`).join("")}</div>`;
    }
    body.onclick = async (e) => {
      const t = e.target.closest("[data-tab]"); if (t) { st.tab = t.dataset.tab; paint(); return; }
      const o = e.target.closest("[data-open]"); if (o) { if (o.dataset.open === "__winre") { const ok = await modal({ title: "Advanced startup", html: "<p>Restart now into the Windows Recovery Environment?</p>", buttons: [{ label: "Restart now", primary: true, value: true }, { label: "Cancel", value: false }] }); if (ok) restartToWinRE(); } else WM.open(o.dataset.open); return; }
      const a = e.target.closest("[data-a]"); if (!a) return;
      if (a.dataset.a === "cancel") return ref.close();
      const changed = apply();
      if (a.dataset.a === "ok") { ref.close(); if (await changed) restartAsk(); }
    };
    body.onchange = (e) => {
      const i = e.target;
      if (i.name === "g") st.safe = i.value === "diag";
      if (i.name === "k") st.kind = i.value;
      if (i.dataset && i.dataset.k) st[i.dataset.k] = i.checked;
      paint();
    };
    async function apply() {
      const c = readCfg();
      const want = { safeboot: st.safe ? st.kind : null, altshell: st.safe && st.alt, basevideo: st.base };
      if (c.safeboot === want.safeboot && !!c.altshell === want.altshell && !!c.basevideo === want.basevideo) return false;
      if (!(await elevate("System Configuration"))) return false;
      patchCfg((x) => Object.assign(x, want));
      log("System", "Information", "msconfig", 1, "Boot configuration changed: safeboot=" + (want.safeboot || "off") + ", alternate shell=" + want.altshell + ", base video=" + want.basevideo + ".");
      return true;
    }
    function restartAsk() {
      modal({ title: "System Configuration", html: `<p>You may need to restart your computer to apply these changes. Before restarting, save any open files and close all programs.</p>`, buttons: [{ label: "Restart", primary: true, value: true }, { label: "Exit without restart", value: false }] }).then((v) => { if (v) reboot({}); });
    }
    paint();
  };

  // Catalog entries (installed by default, findable in Start / search / Run)
  try {
    if (window.Catalog && Catalog.storeApps) {
      [{ id: "rstrui", name: "System Restore", cat: "System", price: 0, builtin: "rstrui", desc: "Undo system changes by going back to a restore point (a full snapshot of your account)." },
        { id: "msconfig", name: "System Configuration", cat: "System", price: 0, builtin: "msconfig", desc: "Boot options: Safe boot (Minimal / Network), base video, and recovery tools." },
        { id: "sysprotect", name: "System Properties (System Protection)", cat: "System", price: 0, builtin: "sysprotect", desc: "Create and delete restore points, open System Restore." },
      ].forEach((a) => { if (!Catalog.storeApps.some((x) => x.id === a.id)) Catalog.storeApps.push(a); });
    }
    window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || [];
    ["rstrui", "msconfig", "sysprotect"].forEach((id) => { if (EXTRA_DEFAULT_APPS.indexOf(id) < 0) EXTRA_DEFAULT_APPS.push(id); });
  } catch (_) {}

  // ------------------------------------------------------------------ Settings hooks
  function settingsRecovery(h, H) {
    const b = H.el(`<button class="w12s-btn">Restart now</button>`);
    b.onclick = async () => {
      const ok = await modal({ title: "We'll restart your device so save your work", html: `<p>Windows will restart into Advanced startup, where you can use Startup Settings (Safe Mode), Startup Repair, System Restore, Command Prompt, Uninstall Updates and UEFI firmware settings.</p>`, buttons: [{ label: "Restart now", primary: true, value: true }, { label: "Cancel", value: false }] });
      if (ok) restartToWinRE();
    };
    h.appendChild(H.line("Advanced startup", b, "Restart your device to change startup settings, including Safe Mode and System Restore"));
    const r = H.el(`<button class="w12s-btn">Open System Restore</button>`); r.onclick = () => WM.open("rstrui");
    h.appendChild(H.line("System Restore", r, "Go back to a restore point (a snapshot of your account's files, apps and settings)"));
    const c = readCfg();
    if (c.safeboot || BOOT.safe) {
      const x = H.el(`<button class="w12s-btn">Restart normally</button>`); x.onclick = () => exitSafeMode();
      h.appendChild(H.line("Safe Mode", x, BOOT.safe ? "This PC is running in Safe Mode" + (c.safeboot ? " (safe boot is set to stay on)" : "") : "Safe boot is set for the next restart"));
    }
  }
  function settingsAbout(h, H) {
    const fw = readCfg().fw;
    const btn = H.el(`<span style="display:flex;gap:8px;flex-wrap:wrap"><button class="w12s-btn" data-a="sp">System protection</button><button class="w12s-btn" data-a="mk">Create a restore point</button></span>`);
    btn.onclick = async (e) => { const b = e.target.closest("[data-a]"); if (!b) return; if (b.dataset.a === "sp") WM.open("sysprotect"); else createDialog(); };
    h.appendChild(H.line("System protection", btn, "Restore points for " + esc(userName()) + " · firmware: UEFI, Secure Boot " + (fw.secureBoot ? "On" : "Off") + (BOOT.safe ? " · running in Safe Mode" : "")));
  }

  // ------------------------------------------------------------------ Terminal: bcdedit, rstrui, msconfig, Checkpoint-Computer, Get-ComputerRestorePoint, Restore-Computer
  const notAdmin = () => A() && !Accounts.isAdmin();
  async function bcdedit(c) {
    const io = c.io, a = c.a.map((x) => x.toLowerCase());
    if (a[0] === "/?" || a[0] === "/help") { io.out("BCDEDIT - Boot Configuration Data Store Editor\n\n  bcdedit [/enum]\n  bcdedit /set {current} safeboot minimal|network\n  bcdedit /set {current} safebootalternateshell yes\n  bcdedit /set {current} basevideo yes\n  bcdedit /deletevalue {current} safeboot|safebootalternateshell|basevideo\n"); return 0; }
    if (notAdmin() && !(await elevate("Boot Configuration Data Store Editor"))) { io.err("The boot configuration data store could not be opened.\nAccess is denied."); return 1; }
    const cfg = readCfg();
    if (!a.length || a[0] === "/enum" || a[0] === "/v") {
      io.out("\nWindows Boot Manager\n--------------------\nidentifier              {bootmgr}\ndevice                  partition=\\Device\\HarddiskVolume1\npath                    \\EFI\\Microsoft\\Boot\\bootmgfw.efi\ndescription             Windows Boot Manager\nlocale                  en-US\ndefault                 {current}\nresumeobject            {7e2f1c3a-0b2d-11f1-9d2e-c8b29b1e2026}\ndisplayorder            {current}\ntoolsdisplayorder       {memdiag}\ntimeout                 30\n\nWindows Boot Loader\n-------------------\nidentifier              {current}\ndevice                  partition=C:\npath                    \\Windows\\system32\\winload.efi\ndescription             Windows 12\nlocale                  en-US\nrecoverysequence        {7e2f1c3c-0b2d-11f1-9d2e-c8b29b1e2026}\ndisplaymessageoverride  Recovery\nrecoveryenabled         Yes\nisolatedcontext         Yes\nallowedinmemorysettings 0x15000075\nosdevice                partition=C:\nsystemroot              \\Windows\nnx                      OptIn\nbootmenupolicy          Standard" + (cfg.safeboot ? "\nsafeboot                " + (cfg.safeboot === "network" ? "Network" : "Minimal") : "") + (cfg.altshell ? "\nsafebootalternateshell  Yes" : "") + (cfg.basevideo ? "\nbasevideo               Yes" : "") + "\n");
      return 0;
    }
    const target = a[1] || "";
    if ((a[0] === "/set" || a[0] === "/deletevalue") && target !== "{current}" && target !== "{default}") { io.err("The specified entry identifier is not valid. Use {current}."); return 1; }
    if (a[0] === "/set") {
      const k = a[2], v = a[3];
      if (k === "safeboot") { if (v !== "minimal" && v !== "network") { io.err("The element data type specified is not recognized, or does not apply to the specified entry.\nRun \"bcdedit /?\" for command line assistance.\nElement not found."); return 1; } patchCfg((x) => { x.safeboot = v; }); }
      else if (k === "safebootalternateshell") patchCfg((x) => { x.altshell = /^(yes|on|true)$/.test(v || ""); });
      else if (k === "basevideo") patchCfg((x) => { x.basevideo = /^(yes|on|true)$/.test(v || ""); });
      else { io.err("The element data type specified is not recognized, or does not apply to the specified entry."); return 1; }
      log("System", "Information", "bcdedit", 1, "Boot configuration changed: " + k + " = " + v + ".");
      io.out("The operation completed successfully."); return 0;
    }
    if (a[0] === "/deletevalue") {
      const k = a[2], map = { safeboot: "safeboot", safebootalternateshell: "altshell", basevideo: "basevideo" };
      if (!map[k]) { io.err("The element data type specified is not recognized."); return 1; }
      if (!cfg[map[k]]) { io.err("An error occurred while attempting to delete the specified data element.\nElement not found."); return 1; }
      patchCfg((x) => { x[map[k]] = k === "safeboot" ? null : false; if (k === "safeboot") x.safebootOnce = null; });
      log("System", "Information", "bcdedit", 1, "Boot configuration value deleted: " + k + ".");
      io.out("The operation completed successfully."); return 0;
    }
    io.err("The parameter is incorrect. Run \"bcdedit /?\" for command line assistance."); return 1;
  }
  async function checkpoint(c) {
    const io = c.io; let desc = null, type = "APPLICATION_INSTALL";
    for (let i = 0; i < c.a.length; i++) { const x = c.a[i]; if (/^-desc/i.test(x)) desc = c.a[++i]; else if (/^-restorepointtype/i.test(x)) type = String(c.a[++i] || type).toUpperCase(); else if (desc == null && !/^-/.test(x)) desc = x; }
    if (!desc) { io.err("Checkpoint-Computer: Cannot process command because of one or more missing mandatory parameters: Description."); return 1; }
    if (notAdmin() && !(await elevate("Checkpoint-Computer"))) { io.err("Checkpoint-Computer: This command requires administrator privileges."); return 1; }
    io.out("Creating a system restore point... (" + desc + ")", "#61d6d6");
    try { const m = await createPoint(desc, type === "MODIFY_SETTINGS" ? "Modify Settings" : type === "APPLICATION_UNINSTALL" ? "Application Uninstall" : "Manual"); io.out("Restore point " + m.id + " created (" + fmtSize(m.size) + ")."); return 0; }
    catch (e) { io.err("Checkpoint-Computer: " + e.message); return 1; }
  }
  async function getPoints(c) {
    const io = c.io; let list = [];
    try { list = await points.list(State.STORAGE_KEY); } catch (e) { io.err(e.message); return 1; }
    if (!list.length) return 0;
    const TYPE = { "Manual": 0, "Application Install": 0, "Application Uninstall": 1, "Modify Settings": 12, "Windows Update": 18, "Undo": 6 };
    io.out("\nCreationTime           Description                              SequenceNumber    EventType         RestorePointType\n------------           -----------                              --------------    ---------         ----------------");
    list.slice().reverse().forEach((m) => { const d = new Date(m.ts); const ts = (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear() + " " + d.toLocaleTimeString(); io.out(ts.padEnd(23) + m.desc.slice(0, 40).padEnd(41) + String(m.id).padEnd(18) + "BEGIN_SYSTEM_C... " + (m.type === "Manual" ? "APPLICATION_INSTALL" : m.type.toUpperCase().replace(/ /g, "_")) + " (" + (TYPE[m.type] != null ? TYPE[m.type] : 0) + ")"); });
    io.out(""); return 0;
  }
  async function restoreComputer(c) {
    const io = c.io; let n = null;
    for (let i = 0; i < c.a.length; i++) { if (/^-restorepoint/i.test(c.a[i])) n = +c.a[++i]; else if (/^\d+$/.test(c.a[i])) n = +c.a[i]; }
    if (!n) { io.err("Restore-Computer: Cannot process command because of one or more missing mandatory parameters: RestorePoint."); return 1; }
    const m = await points.get(n).catch(() => null);
    if (!m || m.key !== State.STORAGE_KEY) { io.err("Restore-Computer: The restore point " + n + " was not found for this account."); return 1; }
    const ans = await io.ask("Restore " + userName() + " to “" + m.desc + "” (" + fmtWhen(m.ts) + ")? The PC will restart. [Y] Yes  [N] No: ");
    if (!/^y/i.test(String(ans).trim())) return 0;
    if (!(await elevate("Restore-Computer"))) { io.err("Restore-Computer: Access is denied."); return 1; }
    try { await restore(n); } catch (e) { io.err("Restore-Computer: " + e.message); return 1; }
    io.out("System Restore will restart the computer now.");
    setTimeout(() => reboot({ noSave: true }), 800); return 0;
  }
  window.TerminalExt = window.TerminalExt || { cmd: {}, ps: {} };
  TerminalExt.cmd = TerminalExt.cmd || {}; TerminalExt.ps = TerminalExt.ps || {};
  Object.assign(TerminalExt.cmd, {
    bcdedit,
    rstrui: () => { WM.open("rstrui"); return 0; },
    msconfig: () => { WM.open("msconfig"); return 0; },
    systempropertiesprotection: () => { WM.open("sysprotect"); return 0; },
    reagentc: (c) => { const a = c.a.map((x) => x.toLowerCase()); if (a[0] === "/boottore") { patchCfg((x) => { x.winre = true; }); c.io.out("REAGENTC.EXE: Operation Successful."); return 0; } c.io.out("Windows Recovery Environment (Windows RE) and system reset configuration\nInformation:\n\n    Windows RE status:         Enabled\n    Windows RE location:       \\\\?\\GLOBALROOT\\device\\harddisk0\\partition4\\Recovery\\WindowsRE\n    Boot Configuration Data (BCD) identifier: 7e2f1c3c-0b2d-11f1-9d2e-c8b29b1e2026\n    Recovery image location:\n    Recovery image index:      0\n    Custom image location:\n    Custom image index:        0\n\nREAGENTC.EXE: Operation Successful.\n\nTip: reagentc /boottore makes the next restart open Advanced startup."); return 0; },
  });
  Object.assign(TerminalExt.ps, {
    "checkpoint-computer": checkpoint,
    "get-computerrestorepoint": getPoints,
    "restore-computer": restoreComputer,
    "confirm-securebootuefi": (c) => { c.io.out(readCfg().fw.secureBoot ? "True" : "False"); return 0; },
    "get-tpm": (c) => { const on = readCfg().fw.tpm; c.io.out("\nTpmPresent                : " + (on ? "True" : "False") + "\nTpmReady                  : " + (on ? "True" : "False") + "\nTpmEnabled                : " + (on ? "True" : "False") + "\nManufacturerIdTxt         : CSYS\nManufacturerVersion       : 7.2.3.1\n"); return 0; },
  });

  window.Recovery = {
    restartToWinRE, reboot, exitSafeMode, points, createPoint, createDialog, restore, diagnose,
    settingsRecovery, settingsAbout, readCfg, patchCfg,
    get safeMode() { return BOOT.safe; },
    winre: WinRE, firmware, _fixState: fixState,
  };
})();
