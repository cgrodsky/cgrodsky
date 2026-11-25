/* Windows Security (Microsoft Defender) — replaces the simple dashboard from apps2.js.
   Real: Quick / Full / Custom scans walk the actual virtual file system (State.data.appData.files.root
   + uploaded blobs in IndexedDB), counting folders and files, showing the current path, elapsed time
   and a progress bar. Threats are flagged by real heuristics on your files (EICAR test signature in the
   content, executable / script files dropped in Downloads or Desktop, destructive script commands,
   "trojan/virus/keygen…" names). Quarantine moves the file into a hidden store in State and removes it
   from its folder; Restore puts it back (and allows it); Remove deletes it for good.
   Real-time protection re-checks Desktop + Downloads whenever files change and every 20 s.
   Firewall profiles, app & browser control, core isolation etc. are persisted switches (simulated
   effect), and the page shows real data where the browser has it: network (window.Radios / navigator),
   Windows Hello (TouchID.enrolled()), storage (navigator.storage.estimate), secure context, Web Crypto,
   CPU cores, memory and battery. */
(function () {
  "use strict";
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const save = () => { try { State.save(); } catch (_) {} };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const two = (n) => String(n).padStart(2, "0");
  const fmtDur = (ms) => { const t = Math.floor(ms / 1000); return two(Math.floor(t / 3600)) + ":" + two(Math.floor(t / 60) % 60) + ":" + two(t % 60); };
  const fmtBytes = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : b < 1073741824 ? (b / 1048576).toFixed(1) + " MB" : (b / 1073741824).toFixed(2) + " GB";
  const when = (ts) => { const d = new Date(ts); return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };

  function store() {
    const a = S().appData || (S().appData = {});
    const d = a.defender || (a.defender = {});
    const def = { realtime: true, cloud: true, samples: true, tamper: true, firewall: { domain: true, private: true, public: true }, coreIsolation: true, lsa: true, dynamicLock: false,
      smart: { apps: true, edge: true, phishing: true, pua: true, store: true }, sac: "evaluation", lastScan: null, history: [], quarantine: [], current: [], allowed: [], defsTs: 0 };
    Object.keys(def).forEach((k) => { if (d[k] == null) d[k] = JSON.parse(JSON.stringify(def[k])); });
    return d;
  }
  function filesRoot() {
    try { if (window.VFS && VFS.ensure) VFS.ensure(); } catch (_) {}
    const a = S().appData; if (!a.files || !a.files.root) a.files = { root: window.FilesParts ? FilesParts.FILE_SEED() : {} };
    return a.files.root;
  }
  const userName = () => { try { return (S().profile && S().profile.username) || "User"; } catch (_) { return "User"; } };
  function winPath(p, name) {
    const parts = p.concat(name ? [name] : []);
    if (parts[0] === "Local Disk (C:)") return "C:\\" + parts.slice(1).join("\\");
    return "C:\\Users\\" + userName() + "\\" + parts.join("\\");
  }
  const keyOf = (p, name) => p.concat(name).join("/");

  // ---------------- detection heuristics ----------------
  const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$" + "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";   // split so this source file itself isn't flagged
  const EXE = /\.(exe|scr|pif|com|msi|cpl)$/i;
  const SCRIPT = /\.(bat|cmd|vbs|vbe|ps1|wsf|hta)$/i;
  const DESTRUCTIVE = /(format\s+[a-z]:|del\s+\/[sfq]|rd\s+\/s|rmdir\s+\/s|vssadmin\s+delete|bcdedit|cipher\s+\/w|reg\s+(add|delete)\s+hk|-enc(odedcommand)?\s+[a-z0-9+/=]{16}|invoke-expression|iex\s*\(|downloadstring|remove-item[^\n]*-recurse|shutdown\s+[/-][sr]|wscript\.shell|:\(\)\s*\{\s*:\|:&\s*\};:)/i;
  function isDropZone(p) {
    if (p[0] === "Desktop" || p[0] === "Downloads") return true;
    return p[0] === "Local Disk (C:)" && p[1] === "Users" && (p[3] === "Desktop" || p[3] === "Downloads");
  }
  function classify(name, node, p, blobText) {
    if (!node || node.type !== "file" || node.kind === "system") return null;
    const content = typeof node.content === "string" ? node.content : "";
    const text = content + (blobText || "");
    const ln = name.toLowerCase();
    if (text.indexOf(EICAR) >= 0) return { name: "Virus:DOS/EICAR_Test_File", sev: "Severe", cat: "Virus", why: "The file contains the EICAR anti-malware test signature." };
    if (/ransom|wannacry|cryptolocker|locky/.test(ln)) return { name: "Ransom:Win32/Filecoder.A!heur", sev: "Severe", cat: "Ransomware", why: "The file name matches known ransomware." };
    if (/trojan/.test(ln)) return { name: "Trojan:Win32/Wacatac.B!ml", sev: "Severe", cat: "Trojan", why: "The file name matches a trojan pattern." };
    if (SCRIPT.test(ln) && DESTRUCTIVE.test(text)) return { name: (/\.(vbs|vbe|wsf)$/.test(ln) ? "Trojan:VBS/Destructor.A" : /\.ps1$/.test(ln) ? "Trojan:PowerShell/Destructor.A" : "Trojan:BAT/Destructor.A"), sev: "Severe", cat: "Trojan", why: "The script runs destructive commands (deleting files, wiping shadow copies, encoded PowerShell…)." };
    if (/virus|malware|worm|spyware|rootkit/.test(ln)) return { name: "Virus:Win32/Heuristic.Name!ml", sev: "High", cat: "Virus", why: "The file name suggests malware." };
    if (/keygen|crack(ed)?\b|activator|kmspico|serial.?gen/.test(ln)) return { name: "HackTool:Win32/Keygen", sev: "High", cat: "Hack tool", why: "Key generators and cracks often bundle malware." };
    if (isDropZone(p) && EXE.test(ln)) return { name: "PUA:Win32/Unverified.Executable", sev: "Low", cat: "Potentially unwanted app", why: "An unsigned program was saved to " + p[p[0] === "Local Disk (C:)" ? 3 : 0] + "." };
    if (isDropZone(p) && SCRIPT.test(ln)) return { name: "PUA:Script/Unsigned.Script", sev: "Low", cat: "Potentially unwanted app", why: "A script file was saved to " + p[p[0] === "Local Disk (C:)" ? 3 : 0] + "." };
    return null;
  }
  async function blobText(node) {
    if (!node || !node.blob || !window.VFS || !VFS.getBlob) return "";
    if (node.size && node.size > 4 * 1048576) return "";
    try { const b = await VFS.getBlob(node.blob); return b ? await b.slice(0, 65536).text() : ""; } catch (_) { return ""; }
  }

  // ---------------- walking the real file system ----------------
  function collect(scope, custom) {
    const root = filesRoot(), out = [];
    function walk(kids, p) {
      Object.keys(kids || {}).forEach((name) => {
        const n = kids[name]; if (!n) return;
        out.push({ p, name, node: n, parent: kids });
        if (n.type === "folder") walk(n.children, p.concat(name));
      });
    }
    if (scope === "full") walk(root, []);
    else if (scope === "custom") { const n = custom && root[custom]; if (n) { out.push({ p: [], name: custom, node: n, parent: root }); walk(n.children, [custom]); } }
    else {
      Object.keys(root).filter((k) => k !== "Local Disk (C:)").forEach((k) => { out.push({ p: [], name: k, node: root[k], parent: root }); walk(root[k].children, [k]); });
      const c = root["Local Disk (C:)"];
      if (c && c.children) ["Users", "ProgramData"].forEach((k) => { if (c.children[k]) { out.push({ p: ["Local Disk (C:)"], name: k, node: c.children[k], parent: c.children }); walk(c.children[k].children, ["Local Disk (C:)", k]); } });
      const tmp = c && c.children && c.children.Windows && c.children.Windows.children && c.children.Windows.children.Temp;
      if (tmp) { out.push({ p: ["Local Disk (C:)", "Windows"], name: "Temp", node: tmp, parent: c.children.Windows.children }); walk(tmp.children, ["Local Disk (C:)", "Windows", "Temp"]); }
    }
    return out;
  }

  let scan = null;   // the running scan (survives closing the window)
  const scanListeners = new Set();
  const emitScan = () => scanListeners.forEach((fn) => { try { fn(); } catch (_) {} });
  async function runScan(scope, custom) {
    if (scan && scan.running) return scan;
    const d = store(), items = collect(scope, custom);
    const s = scan = { scope, custom, running: true, cancelled: false, total: items.length, done: 0, files: 0, folders: 0, bytes: 0, threats: [], current: "", started: Date.now(), elapsed: 0 };
    emitScan();
    const target = scope === "full" ? 6000 : scope === "custom" ? 1800 : 2600;     // pace so you can watch it (the walk itself is real)
    const perFrame = Math.max(1, Math.ceil(items.length * 16 / target));
    const stepMs = Math.max(16, Math.round(target / Math.max(1, items.length)));   // few items -> slower steps
    for (let i = 0; i < items.length; i++) {
      if (s.cancelled) break;
      const it = items[i];
      s.current = winPath(it.p, it.name);
      if (it.node.type === "folder") s.folders++;
      else {
        s.files++;
        s.bytes += it.node.size || (typeof it.node.content === "string" ? it.node.content.length : 0) || (it.node.src ? Math.round(it.node.src.length * 0.75) : 0);
        const key = keyOf(it.p, it.name);
        if (d.allowed.indexOf(key) < 0) {
          const bt = it.node.blob ? await blobText(it.node) : "";
          const th = classify(it.name, it.node, it.p, bt);
          if (th) s.threats.push(Object.assign({ id: uid(), key, path: it.p, file: it.name, display: winPath(it.p, it.name), ts: Date.now() }, th));
        }
      }
      s.done = i + 1;
      if ((i + 1) % perFrame === 0) { s.elapsed = Date.now() - s.started; emitScan(); await sleep(stepMs); }
    }
    s.elapsed = Date.now() - s.started; s.running = false; s.current = "";
    const label = { quick: "Quick scan", full: "Full scan", custom: "Custom scan" }[scope];
    // Merge into "current threats" (detected, waiting for an action).
    s.threats.forEach((t) => { if (!d.current.some((c) => c.key === t.key)) d.current.push(t); });
    d.lastScan = { type: label, ts: Date.now(), files: s.files, folders: s.folders, threats: s.threats.length, ms: s.elapsed, cancelled: s.cancelled, bytes: s.bytes };
    hist({ kind: "scan", title: label + (s.cancelled ? " cancelled" : " completed"), detail: s.files.toLocaleString() + " files and " + s.folders.toLocaleString() + " folders scanned in " + fmtDur(s.elapsed) + ". " + (s.threats.length ? s.threats.length + " threat" + (s.threats.length > 1 ? "s" : "") + " found." : "No current threats."), sev: s.threats.length ? "warn" : "ok" });
    s.threats.forEach((t) => hist({ kind: "threat", title: "Threat found", threat: t.name, sev: t.sev, detail: t.why, path: t.display, status: "Active", tid: t.id }));
    save(); emitScan();
    if (s.threats.length && window.Notify) Notify.show({ icon: Icon.mini("defender", "Windows Security"), title: "Threats found", body: "Microsoft Defender Antivirus found " + s.threats.length + " threat" + (s.threats.length > 1 ? "s" : "") + ". Get details.", onClick: () => WM.open("security") });
    return s;
  }
  function hist(e) { const d = store(); d.history.unshift(Object.assign({ id: uid(), ts: Date.now() }, e)); if (d.history.length > 120) d.history.length = 120; }

  // ---------------- actions ----------------
  function nodeParent(p) { let kids = filesRoot(); for (const seg of p) { const n = kids[seg]; if (!n || n.type !== "folder") return null; kids = n.children; } return kids; }
  function vfsChanged() { try { window.dispatchEvent(new CustomEvent("vfs-change", { detail: { source: "defender" } })); } catch (_) {} }
  function markHistory(tid, status) { store().history.forEach((h) => { if (h.tid === tid && h.kind === "threat") { h.status = status; h.acted = Date.now(); } }); }
  function quarantine(t) {
    const d = store(), kids = nodeParent(t.path);
    const node = kids && kids[t.file];
    if (node) { delete kids[t.file]; }
    d.quarantine.push({ id: t.id, key: t.key, path: t.path, file: t.file, display: t.display, name: t.name, sev: t.sev, why: t.why, ts: Date.now(), node: node || null });
    d.current = d.current.filter((c) => c.key !== t.key);
    markHistory(t.id, "Quarantined"); save(); vfsChanged(); emitScan();
  }
  function removeThreat(t) {
    const d = store(), kids = nodeParent(t.path);
    if (kids && kids[t.file]) delete kids[t.file];
    d.current = d.current.filter((c) => c.key !== t.key);
    d.quarantine = d.quarantine.filter((q) => q.id !== t.id);
    markHistory(t.id, "Removed"); save(); vfsChanged(); emitScan();
  }
  function allowThreat(t) {
    const d = store(); if (d.allowed.indexOf(t.key) < 0) d.allowed.push(t.key);
    d.current = d.current.filter((c) => c.key !== t.key);
    markHistory(t.id, "Allowed"); save(); emitScan();
  }
  function restore(q) {
    const d = store();
    let kids = filesRoot();
    q.path.forEach((seg) => { if (!kids[seg] || kids[seg].type !== "folder") kids[seg] = { type: "folder", children: {} }; kids = kids[seg].children; });
    let name = q.file;
    if (kids[name]) { const m = name.match(/^(.*?)(\.[^.]+)?$/); let i = 2; while (kids[m[1] + " (" + i + ")" + (m[2] || "")]) i++; name = m[1] + " (" + i + ")" + (m[2] || ""); }
    if (q.node) kids[name] = q.node;
    const key = keyOf(q.path, name); if (d.allowed.indexOf(key) < 0) d.allowed.push(key);
    d.quarantine = d.quarantine.filter((x) => x.id !== q.id);
    markHistory(q.id, "Restored"); save(); vfsChanged(); emitScan();
  }

  // ---------------- real-time protection ----------------
  const rtSeen = new Set();
  function realtimeCheck() {
    try {
      const d = store(); if (!d.realtime || (scan && scan.running)) return;
      const found = [];
      collect("quick").forEach((it) => {
        if (!isDropZone(it.p) && !(it.p.length === 0 && (it.name === "Desktop" || it.name === "Downloads"))) return;
        if (it.node.type !== "file") return;
        const key = keyOf(it.p, it.name);
        if (d.allowed.indexOf(key) >= 0 || d.current.some((c) => c.key === key) || rtSeen.has(key)) return;
        const th = classify(it.name, it.node, it.p, "");
        rtSeen.add(key);
        if (th) found.push(Object.assign({ id: uid(), key, path: it.p, file: it.name, display: winPath(it.p, it.name), ts: Date.now(), realtime: true }, th));
      });
      if (!found.length) return;
      found.forEach((t) => { d.current.push(t); hist({ kind: "threat", title: "Threat found (real-time protection)", threat: t.name, sev: t.sev, detail: t.why, path: t.display, status: "Active", tid: t.id }); });
      save(); emitScan();
      if (window.Notify) Notify.show({ icon: Icon.mini("defender", "Windows Security"), title: "Virus & threat protection", body: "Microsoft Defender Antivirus found " + found.length + " threat" + (found.length > 1 ? "s" : "") + ": " + esc(found[0].file) + ". Get details.", onClick: () => WM.open("security") });
    } catch (_) {}
  }
  let rtTimer = 0;
  window.addEventListener("vfs-change", (e) => { if (e && e.detail && e.detail.source === "defender") return; clearTimeout(rtTimer); rtTimer = setTimeout(realtimeCheck, 600); });
  // Seed "already seen" on load so old files only show up in a real scan, then watch every 20 s.
  setTimeout(() => { try { collect("quick").forEach((it) => rtSeen.add(keyOf(it.p, it.name))); } catch (_) {} setInterval(realtimeCheck, 20000); }, 4000);

  // ---------------- UI helpers ----------------
  const IC = {
    home: `<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    virus: `<svg viewBox="0 0 24 24"><path d="M12 2.5l7.5 3v5.7c0 4.6-3.1 8.4-7.5 9.8-4.4-1.4-7.5-5.2-7.5-9.8V5.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    account: `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 21c.5-4 4-6 8-6s7.5 2 8 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
    firewall: `<svg viewBox="0 0 24 24"><path d="M3 5h18v14H3zM3 10h18M3 14.5h18M9 5v5M15 10v4.5M9 14.5V19" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
    app: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 8h18" stroke="currentColor" stroke-width="1.6"/><path d="M12 11l3.5 1.4v2.2c0 1.8-1.4 3.2-3.5 3.9-2.1-.7-3.5-2.1-3.5-3.9v-2.2z" fill="currentColor"/></svg>`,
    device: `<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="9" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" stroke="currentColor" stroke-width="1.6"/></svg>`,
    health: `<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 12h3l1.5-2.5 2 5 1.5-2.5h4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
    family: `<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16.5" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 20c.4-3.5 2.8-5.5 5.5-5.5s5.1 2 5.5 5.5M13.5 15c.9-.8 1.9-1.2 3-1.2 2.3 0 4.2 1.7 4.5 4.7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
    history: `<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5M12 8v4.5l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    settings: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    ok: `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="#0f9d58"/><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    warn: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2.5L22.5 21h-21z" fill="#f2b200"/><path d="M12 9v5.5M12 17.2v.3" stroke="#1b1b1b" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    bad: `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="#d13438"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    info: `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="#0067c0"/><path d="M12 11v6M12 7.5v.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  };
  const NAV = [
    ["home", "Home"], ["virus", "Virus & threat protection"], ["account", "Account protection"], ["firewall", "Firewall & network protection"],
    ["app", "App & browser control"], ["device", "Device security"], ["health", "Device performance & health"], ["family", "Family options"], ["history", "Protection history"],
  ];
  function sw(on, onChange, label) {
    const b = el(`<button class="pt-switch${on ? " on" : ""}" role="switch" aria-checked="${!!on}" aria-label="${esc(label || "")}"><i></i></button>`);
    const lab = el(`<span class="pt-sw-lbl">${on ? "On" : "Off"}</span>`);
    const wrap = el(`<span class="pt-sw-wrap"></span>`); wrap.appendChild(b); wrap.appendChild(lab);
    b.onclick = () => { const v = !b.classList.contains("on"); b.classList.toggle("on", v); b.setAttribute("aria-checked", v); lab.textContent = v ? "On" : "Off"; onChange(v); };
    return wrap;
  }
  function netInfo() {
    try { if (window.Radios && Radios.net) { const n = Radios.net.info(); return { online: n.online, link: Radios.net.linkType ? Radios.net.linkType() : "", summary: Radios.net.summary ? Radios.net.summary() : "", wifiOn: n.wifiOn !== false }; } } catch (_) {}
    const c = navigator.connection || {};
    return { online: navigator.onLine !== false, link: c.type || c.effectiveType || "", summary: navigator.onLine === false ? "Offline" : "Online", wifiOn: true };
  }

  // Status for each area (used by Home and the nav badges).
  function statusOf(key) {
    const d = store();
    switch (key) {
      case "virus":
        if (d.current.length) return { lvl: "bad", txt: d.current.length + " threat" + (d.current.length > 1 ? "s" : "") + " found. Start the recommended actions." };
        if (!d.realtime) return { lvl: "bad", txt: "Real-time protection is off, leaving your device vulnerable." };
        if (!d.lastScan) return { lvl: "warn", txt: "No scan has been run yet. Run a quick scan." };
        return { lvl: "ok", txt: "No action needed." };
      case "account": return (window.TouchID && TouchID.enrolled && TouchID.enrolled()) ? { lvl: "ok", txt: "No action needed." } : { lvl: "warn", txt: "Set up Windows Hello for faster, more secure sign-in." };
      case "firewall": { const f = d.firewall; const off = ["domain", "private", "public"].filter((k) => !f[k]); return off.length ? { lvl: off.indexOf("public") >= 0 || off.length > 1 ? "bad" : "warn", txt: "Firewall is off for the " + off.join(" and ") + " network" + (off.length > 1 ? "s" : "") + "." } : { lvl: "ok", txt: "No action needed." }; }
      case "app": { const m = d.smart; return (m.apps && m.edge && m.phishing) ? { lvl: "ok", txt: "No action needed." } : { lvl: "warn", txt: "Reputation-based protection settings are off." }; }
      case "device": return d.coreIsolation ? { lvl: "ok", txt: "View status and manage hardware security features." } : { lvl: "warn", txt: "Memory integrity is off. Your device may be vulnerable." };
      case "health": return healthCache && healthCache.pct > 90 ? { lvl: "warn", txt: "Storage is almost full." } : { lvl: "ok", txt: "No action needed." };
      case "family": return { lvl: "info", txt: "Manage how your family uses their devices." };
      default: return { lvl: "ok", txt: "" };
    }
  }
  let healthCache = null;
  function refreshHealth() {
    const out = { usage: null, quota: null, pct: 0, persisted: null };
    const p = (navigator.storage && navigator.storage.estimate) ? navigator.storage.estimate().then((e) => { out.usage = e.usage; out.quota = e.quota; out.pct = e.quota ? (e.usage / e.quota) * 100 : 0; }).catch(() => {}) : Promise.resolve();
    const q = (navigator.storage && navigator.storage.persisted) ? navigator.storage.persisted().then((v) => { out.persisted = v; }).catch(() => {}) : Promise.resolve();
    return Promise.all([p, q]).then(() => { healthCache = out; return out; });
  }
  refreshHealth();

  // =====================================================================
  //  THE APP
  // =====================================================================
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.security = function (startPage) {
    const ref = WM.createWindow({ title: "Windows Security", icon: Icon.mini("defender", "Windows Security"), width: 920, height: 640, appId: "security", onClose: () => { scanListeners.delete(onScan); } });
    const body = ref.body; body.classList.add("pt-sec-host");
    let page = typeof startPage === "string" && NAV.some((n) => n[0] === startPage) ? startPage : "home";
    body.innerHTML = `<div class="pt-sec">
      <nav class="pt-sec-nav"><button class="pt-sec-burger" title="Menu"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button><div class="pt-sec-navlist"></div><span class="pt-grow"></span><button class="pt-sec-nav-it" data-p="settings"><span class="pt-sec-nic">${IC.settings}</span><span>Settings</span></button></nav>
      <main class="pt-sec-main"></main>
    </div>`;
    const main = body.querySelector(".pt-sec-main");
    body.querySelector(".pt-sec-burger").onclick = () => body.querySelector(".pt-sec").classList.toggle("pt-sec-collapsed");
    if (ref.win.offsetWidth < 760) body.querySelector(".pt-sec").classList.add("pt-sec-collapsed");
    function nav() {
      const host = body.querySelector(".pt-sec-navlist");
      host.innerHTML = NAV.map(([k, n]) => { const st = k === "home" || k === "history" ? null : statusOf(k); return `<button class="pt-sec-nav-it${k === page ? " on" : ""}" data-p="${k}" title="${esc(n)}"><span class="pt-sec-nic">${IC[k]}${st && (st.lvl === "bad" || st.lvl === "warn") ? `<i class="pt-sec-badge ${st.lvl}"></i>` : ""}</span><span>${esc(n)}</span></button>`; }).join("");
      body.querySelectorAll(".pt-sec-nav-it").forEach((b) => { b.classList.toggle("on", b.dataset.p === page); b.onclick = () => go(b.dataset.p); });
    }
    function go(p) { page = p; render(); main.scrollTop = 0; }
    function render() {
      nav(); main.innerHTML = "";
      ({ home: pHome, virus: pVirus, account: pAccount, firewall: pFirewall, app: pApp, device: pDevice, health: pHealth, family: pFamily, history: pHistory, settings: pSettings })[page](main);
    }
    const h1 = (ic, title, sub) => el(`<div class="pt-sec-h"><span class="pt-sec-hic">${ic}</span><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ""}</div></div>`);
    const section = (title, sub) => el(`<section class="pt-sec-sec"><h2>${esc(title)}</h2>${sub ? `<p class="pt-sec-p">${sub}</p>` : ""}</section>`);
    const row = (label, sub, ctl) => { const r = el(`<div class="pt-sec-row"><div><b>${label}</b>${sub ? `<span>${sub}</span>` : ""}</div><div class="pt-sec-ctl"></div></div>`); if (ctl) r.querySelector(".pt-sec-ctl").appendChild(ctl); return r; };
    const btn = (label, fn, primary) => { const b = el(`<button class="pt-btn${primary ? " pt-primary" : ""}">${esc(label)}</button>`); b.onclick = fn; return b; };
    const link = (label, fn) => { const a = el(`<button class="pt-link">${esc(label)}</button>`); a.onclick = fn; return a; };

    // ---------- Home ----------
    function pHome(m) {
      m.appendChild(h1(`<img src="assets/defender.png?v=6" alt="">`, "Security at a glance", "See what's happening with the security and health of your device and take any actions needed."));
      const grid = el(`<div class="pt-sec-grid"></div>`);
      NAV.filter(([k]) => k !== "home" && k !== "history").forEach(([k, n]) => {
        const st = statusOf(k);
        const c = el(`<button class="pt-sec-card ${st.lvl}"><span class="pt-sec-cardic">${IC[k]}</span><b>${esc(n)}</b><span class="pt-sec-cardst">${IC[st.lvl] || IC.ok}<span>${esc(st.txt)}</span></span></button>`);
        c.onclick = () => go(k); grid.appendChild(c);
      });
      m.appendChild(grid);
    }

    // ---------- Virus & threat protection ----------
    let scanScope = "quick", customFolder = "Downloads";
    function pVirus(m) {
      const d = store();
      m.appendChild(h1(IC.virus, "Virus & threat protection", "Protection for your device against threats."));
      // current threats / scan
      const cur = section("Current threats");
      const box = el(`<div class="pt-sec-scanbox"></div>`); cur.appendChild(box); m.appendChild(cur);
      paintScanBox(box);
      // scan options
      const opts = section("Scan options", "Choose the kind of scan to run. Scans walk every folder and file in your File Explorer.");
      const top = Object.keys(filesRoot()).filter((k) => k !== "Local Disk (C:)");
      opts.appendChild(el(`<div class="pt-sec-radios">
        <label><input type="radio" name="pt-scope" value="quick" ${scanScope === "quick" ? "checked" : ""}><span><b>Quick scan</b>Checks your user folders (Desktop, Downloads, Documents…), C:\\Users, ProgramData and Windows\\Temp.</span></label>
        <label><input type="radio" name="pt-scope" value="full" ${scanScope === "full" ? "checked" : ""}><span><b>Full scan</b>Checks every file and folder, including the whole C: drive. Takes longer.</span></label>
        <label><input type="radio" name="pt-scope" value="custom" ${scanScope === "custom" ? "checked" : ""}><span><b>Custom scan</b>Choose a folder: <select class="pt-sec-custom">${top.map((k) => `<option ${k === customFolder ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></span></label>
      </div>`));
      opts.querySelectorAll("input[name=pt-scope]").forEach((r) => r.onchange = () => { scanScope = r.value; });
      opts.querySelector(".pt-sec-custom").onchange = (e) => { customFolder = e.target.value; };
      const sb = btn("Scan now", () => { runScan(scanScope, customFolder); }, true); sb.classList.add("pt-sec-scannow");
      opts.appendChild(sb); m.appendChild(opts);
      // settings
      const ps = section("Virus & threat protection settings");
      ps.appendChild(row("Real-time protection", "Locates and stops malware from installing or running on your device. Watches Desktop and Downloads for new files.", sw(d.realtime, (v) => { d.realtime = v; hist({ kind: "setting", title: "Real-time protection turned " + (v ? "on" : "off"), sev: v ? "ok" : "warn" }); save(); nav(); if (v) setTimeout(realtimeCheck, 100); })));
      ps.appendChild(row("Cloud-delivered protection", "Faster protection with the latest data in the cloud.", sw(d.cloud, (v) => { d.cloud = v; save(); })));
      ps.appendChild(row("Automatic sample submission", "Send sample files to Microsoft to help protect you and others.", sw(d.samples, (v) => { d.samples = v; save(); })));
      ps.appendChild(row("Tamper Protection", "Prevents others from tampering with important security features.", sw(d.tamper, (v) => { d.tamper = v; save(); })));
      m.appendChild(ps);
      // quarantine + allowed
      const qs = section("Quarantined & allowed threats");
      if (!d.quarantine.length && !d.allowed.length) qs.appendChild(el(`<p class="pt-sec-p">No quarantined or allowed threats.</p>`));
      d.quarantine.forEach((q) => qs.appendChild(threatRow(q, [["Restore", () => { restore(q); render(); }], ["Remove", () => { removeThreat(q); render(); }]], "Quarantined " + when(q.ts))));
      d.allowed.forEach((k) => { const r = row(esc(k.split("/").pop()), "Allowed on device · " + esc(winPath(k.split("/").slice(0, -1), k.split("/").pop())), btn("Don't allow", () => { d.allowed = d.allowed.filter((x) => x !== k); rtSeen.delete(k); save(); render(); })); qs.appendChild(r); });
      m.appendChild(qs);
      // updates
      const up = section("Virus & threat protection updates");
      const ver = defsVersion(d.defsTs || Date.now());
      up.appendChild(el(`<p class="pt-sec-p">Security intelligence version: ${esc(ver)}<br>Last update: ${d.defsTs ? esc(when(d.defsTs)) : "never"}</p>`));
      up.appendChild(btn("Check for updates", (e) => {
        const b = e.currentTarget; b.disabled = true; b.textContent = "Checking…";
        setTimeout(() => { d.defsTs = Date.now(); hist({ kind: "setting", title: "Security intelligence updated", detail: "Version " + defsVersion(d.defsTs), sev: "ok" }); save(); render(); }, 900);
      }));
      m.appendChild(up);
    }
    function defsVersion(ts) { const t = new Date(ts), start = new Date(t.getFullYear(), 0, 0); const doy = Math.floor((t - start) / 86400000); return "1.4" + (t.getFullYear() % 100) + "." + (doy * 6 + Math.floor(t.getHours() / 4)) + ".0"; }
    function threatRow(t, actions, extra) {
      const r = el(`<div class="pt-sec-threat sev-${esc((t.sev || "").toLowerCase())}">
        <div class="pt-sec-threat-h">${t.sev === "Low" ? IC.warn : IC.bad}<div><b>${esc(t.name)}</b><span>${esc(t.sev)} · ${esc(t.cat || "")} ${extra ? "· " + esc(extra) : ""}</span></div><span class="pt-grow"></span></div>
        <div class="pt-sec-threat-p" title="${esc(t.display)}">${esc(t.display)}</div>
        <div class="pt-sec-threat-why">${esc(t.why || "")}</div>
        <div class="pt-sec-threat-acts"></div></div>`);
      const acts = r.querySelector(".pt-sec-threat-acts");
      actions.forEach(([label, fn], i) => acts.appendChild(btn(label, fn, i === 0)));
      return r;
    }
    function paintScanBox(box) {
      const d = store();
      box.innerHTML = "";
      if (scan && scan.running) {
        const pct = scan.total ? Math.round((scan.done / scan.total) * 100) : 0;
        box.appendChild(el(`<div class="pt-sec-scanning">
          <div class="pt-sec-scan-t"><span class="pt-spin"></span><b>${{ quick: "Quick scan", full: "Full scan", custom: "Custom scan" }[scan.scope]} running…</b><span class="pt-grow"></span><span class="pt-sec-pct">${pct}%</span></div>
          <div class="pt-bar"><i style="width:${pct}%"></i></div>
          <div class="pt-sec-cur" title="${esc(scan.current)}">${esc(scan.current)}</div>
          <div class="pt-sec-scanstats"><span>Files scanned: <b>${scan.files.toLocaleString()}</b></span><span>Folders: <b>${scan.folders.toLocaleString()}</b></span><span>Estimated items: <b>${scan.total.toLocaleString()}</b></span><span>Time elapsed: <b>${fmtDur(Date.now() - scan.started)}</b></span><span>Threats found: <b class="${scan.threats.length ? "pt-red" : ""}">${scan.threats.length}</b></span></div>
        </div>`));
        box.appendChild(btn("Cancel", () => { if (scan) scan.cancelled = true; }));
        return;
      }
      if (d.current.length) {
        box.appendChild(el(`<div class="pt-sec-alert">${IC.bad}<div><b>Threats found.</b><span>Start the recommended actions.</span></div></div>`));
        box.appendChild(btn("Start actions", () => { d.current.slice().forEach((t) => quarantine(t)); render(); }, true));
        d.current.forEach((t) => box.appendChild(threatRow(t, [["Quarantine", () => { quarantine(t); render(); }], ["Remove", () => { removeThreat(t); render(); }], ["Allow on device", () => { allowThreat(t); render(); }]], t.realtime ? "Found by real-time protection" : "")));
      } else {
        box.appendChild(el(`<div class="pt-sec-okline">${IC.ok}<div><b>No current threats.</b><span>${d.lastScan ? esc(d.lastScan.type) + (d.lastScan.cancelled ? " (cancelled)" : "") + ": " + esc(when(d.lastScan.ts)) + " · " + d.lastScan.threats + " threats found · Scan lasted " + fmtDur(d.lastScan.ms) + " · " + d.lastScan.files.toLocaleString() + " files and " + d.lastScan.folders.toLocaleString() + " folders scanned" : "No scan has been run yet."}</span></div></div>`));
        box.appendChild(btn("Quick scan", () => runScan("quick"), true));
      }
      box.appendChild(link("Protection history", () => go("history")));
    }
    function onScan() {
      if (!body.isConnected) { scanListeners.delete(onScan); return; }
      const box = main.querySelector(".pt-sec-scanbox");
      if (page === "virus" && box) { paintScanBox(box); if (scan && !scan.running) { const s = main.querySelector(".pt-sec-scannow"); if (s) s.disabled = false; } const s2 = main.querySelector(".pt-sec-scannow"); if (s2) s2.disabled = !!(scan && scan.running); }
      if (!scan || !scan.running) nav();
      if (page === "home" && (!scan || !scan.running)) render();
    }
    scanListeners.add(onScan);

    // ---------- Account protection ----------
    function pAccount(m) {
      const d = store();
      m.appendChild(h1(IC.account, "Account protection", "Security for your account and sign-in."));
      const acct = section("Microsoft account");
      acct.appendChild(el(`<div class="pt-sec-okline">${IC.ok}<div><b>${esc(userName())}</b><span>Your account is signed in on this device.</span></div></div>`));
      m.appendChild(acct);
      const enrolled = !!(window.TouchID && TouchID.enrolled && TouchID.enrolled());
      const sensor = window.TouchID && TouchID.sensorName ? TouchID.sensorName() : "Windows Hello";
      const hello = section("Windows Hello");
      hello.appendChild(el(`<div class="${enrolled ? "pt-sec-okline" : "pt-sec-warnline"}">${enrolled ? IC.ok : IC.warn}<div><b>${enrolled ? esc(sensor) + " is set up" : "Windows Hello isn't set up"}</b><span>${enrolled ? "You can sign in with your fingerprint." : "Sign in faster and more securely with your fingerprint (" + esc(sensor) + ")."}</span></div></div>`));
      hello.appendChild(btn(enrolled ? "Manage sign-in options" : "Set up", () => { window.SettingsStartPage = "signin"; WM.open("settings"); }, !enrolled));
      m.appendChild(hello);
      const dl = section("Dynamic lock", "Windows can use devices paired to your PC to know when you're away and lock your PC shortly after those devices go out of range.");
      dl.appendChild(row("Allow Windows to automatically lock your device when you're away", "", sw(d.dynamicLock, (v) => { d.dynamicLock = v; save(); })));
      m.appendChild(dl);
    }

    // ---------- Firewall ----------
    function pFirewall(m) {
      const d = store(), n = netInfo();
      m.appendChild(h1(IC.firewall, "Firewall & network protection", "Who and what can access your networks."));
      const activeProfile = n.online ? "private" : null;
      const netName = n.online ? (n.link ? n.link : "Network") : "Not connected";
      [["domain", "Domain network", "Networks at a workplace that are joined to a domain."], ["private", "Private network", "Networks at home or work, where you know and trust the people and devices."], ["public", "Public network", "Networks in public places such as airports or coffee shops."]].forEach(([k, name, desc]) => {
        const on = d.firewall[k];
        const c = el(`<div class="pt-sec-fw ${on ? "" : "off"}"><div class="pt-sec-fw-h">${on ? IC.ok : IC.bad}<div><b>${name}${k === activeProfile ? " (active)" : ""}</b><span>${k === activeProfile ? "Active network: " + esc(netName) : desc}</span></div><span class="pt-grow"></span></div></div>`);
        c.querySelector(".pt-sec-fw-h").appendChild(sw(on, (v) => { d.firewall[k] = v; hist({ kind: "setting", title: name + " firewall turned " + (v ? "on" : "off"), sev: v ? "ok" : "warn" }); save(); render(); }, name + " firewall"));
        if (k === activeProfile) c.appendChild(el(`<div class="pt-sec-netsum">${esc(n.summary || "")}</div>`));
        m.appendChild(c);
      });
      if (!n.online) m.appendChild(el(`<p class="pt-sec-p">${IC.info} This device is offline right now (navigator.onLine is false), so no network profile is active.</p>`));
      const more = section("Allow an app through firewall");
      const apps = (Catalog.storeApps || []).filter((a) => !a.decorative && (a.builtin || a.game)).filter((a) => (S().installedApps || []).indexOf(a.id) >= 0 || ["edge", "chrome", "copilot", "outlook", "messenger", "xbox"].indexOf(a.id) >= 0).slice(0, 14);
      const fa = d.fwAllowed || (d.fwAllowed = {});
      const list = el(`<div class="pt-sec-applist"></div>`);
      apps.forEach((a) => { const allowed = fa[a.id] !== false; const r = el(`<label class="pt-sec-appck"><input type="checkbox" ${allowed ? "checked" : ""}><span>${Icon.mini(a.id, a.name)}</span><span>${esc(a.name)}</span></label>`); r.querySelector("input").onchange = (e) => { fa[a.id] = e.target.checked; save(); }; list.appendChild(r); });
      more.appendChild(list); m.appendChild(more);
    }

    // ---------- App & browser control ----------
    function pApp(m) {
      const d = store();
      m.appendChild(h1(IC.app, "App & browser control", "App protection and online security."));
      const sac = section("Smart App Control", "Adds significant protection from new and emerging threats by blocking apps that are malicious or untrusted.");
      const sel = el(`<select class="pt-sec-sel"><option value="on">On</option><option value="evaluation">Evaluation</option><option value="off">Off</option></select>`); sel.value = d.sac; sel.onchange = () => { d.sac = sel.value; save(); };
      sac.appendChild(row("Smart App Control", "", sel)); m.appendChild(sac);
      const rep = section("Reputation-based protection", "These settings protect your device from malicious or potentially unwanted apps, files and websites.");
      [["apps", "Check apps and files", "Microsoft Defender SmartScreen protects your device by checking for unrecognized apps and files from the web."], ["edge", "SmartScreen for Microsoft Edge", "Helps protect your device from malicious sites and downloads."], ["phishing", "Phishing protection", "Protects you from entering your password into malicious apps and sites."], ["pua", "Potentially unwanted app blocking", "Protects your device from low-reputation apps that might cause unexpected behaviors."], ["store", "SmartScreen for Microsoft Store apps", "Checks web content that Microsoft Store apps use."]].forEach(([k, t, s]) => rep.appendChild(row(t, s, sw(d.smart[k], (v) => { d.smart[k] = v; save(); nav(); }))));
      m.appendChild(rep);
      const ep = section("Exploit protection", "Exploit protection is built into Windows to help protect your device against attacks.");
      [["Control flow guard (CFG)", "Ensures control flow integrity for indirect calls."], ["Data Execution Prevention (DEP)", "Prevents code from being run from data-only memory pages."], ["Force randomization for images (Mandatory ASLR)", "Force relocation of images not compiled with /DYNAMICBASE."], ["Validate heap integrity", "Terminates a process when heap corruption is detected."]].forEach(([t, s]) => ep.appendChild(row(t, s, el(`<span class="pt-sec-tag">Use default (On)</span>`))));
      m.appendChild(ep);
    }

    // ---------- Device security ----------
    function pDevice(m) {
      const d = store();
      m.appendChild(h1(IC.device, "Device security", "Security that comes built into your device."));
      const ci = section("Core isolation", "Security features available on your device that use virtualization-based security.");
      ci.appendChild(row("Memory integrity", "Prevents attacks from inserting malicious code into high-security processes.", sw(d.coreIsolation, (v) => { d.coreIsolation = v; d.ciPending = true; hist({ kind: "setting", title: "Memory integrity turned " + (v ? "on" : "off"), detail: "Restart required.", sev: v ? "ok" : "warn" }); save(); render(); })));
      if (d.ciPending) ci.appendChild(el(`<div class="pt-sec-warnline">${IC.warn}<div><b>A restart is required</b><span>Restart your device to apply the change.</span></div></div>`));
      ci.appendChild(row("Local Security Authority protection", "Prevents attacks that try to steal your sign-in credentials.", sw(d.lsa, (v) => { d.lsa = v; save(); })));
      m.appendChild(ci);
      const subtle = !!(window.crypto && crypto.subtle);
      const sp = section("Security processor", "Your security processor, called the trusted platform module (TPM), provides additional encryption for your device.");
      sp.appendChild(el(`<div class="pt-sec-kv"><span>Manufacturer</span><b>Microsoft (firmware TPM)</b><span>Specification version</span><b>2.0</b><span>Status</span><b>${subtle ? "TPM is ready for use" : "Limited"}</b><span>Hardware crypto (Web Crypto API)</span><b>${subtle ? "Available" : "Not available"} <em>(real)</em></b></div>`));
      m.appendChild(sp);
      const sb = section("Secure boot", "Secure boot prevents a sophisticated and dangerous type of malware — a rootkit — from loading when you start your device.");
      sb.appendChild(el(`<div class="pt-sec-okline">${IC.ok}<div><b>Secure boot is on.</b><span>This page is ${window.isSecureContext ? "running in a secure context (HTTPS or localhost)" : "NOT running in a secure context (plain HTTP or a file)"} <em>(real)</em>.</span></div></div>`));
      m.appendChild(sb);
      const enrolled = !!(window.TouchID && TouchID.enrolled && TouchID.enrolled());
      const wh = section("Windows Hello");
      wh.appendChild(el(`<div class="${enrolled ? "pt-sec-okline" : "pt-sec-warnline"}">${enrolled ? IC.ok : IC.warn}<div><b>${enrolled ? "Windows Hello is set up" : "Windows Hello isn't set up"}</b><span>${enrolled ? "Fingerprint sign-in is enrolled on this device." : "Set up fingerprint sign-in in Settings → Accounts → Sign-in options."}</span></div></div>`));
      m.appendChild(wh);
      m.appendChild(el(`<p class="pt-sec-p">${d.coreIsolation && subtle ? "Your device meets the requirements for standard hardware security." : "Standard hardware security not supported."}</p>`));
    }

    // ---------- Device performance & health ----------
    function pHealth(m) {
      m.appendChild(h1(IC.health, "Device performance & health", "The health of your device."));
      const rep = section("Health report", "Last scan: " + new Date().toLocaleString());
      const kv = el(`<div class="pt-sec-health"><div class="pt-sec-hcard pt-sec-storage">${IC.ok}<div><b>Storage capacity</b><span class="pt-sec-stx">Measuring…</span><div class="pt-bar"><i style="width:0"></i></div></div></div></div>`);
      rep.appendChild(kv); m.appendChild(rep);
      let files = 0, folders = 0; try { collect("full").forEach((x) => (x.node.type === "folder" ? folders++ : files++)); } catch (_) {}
      let lsBytes = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); lsBytes += (k.length + (localStorage.getItem(k) || "").length) * 2; } } catch (_) {}
      const extra = [
        [IC.ok, "Apps and software", ((S().installedApps || []).length) + " Store apps installed · " + files.toLocaleString() + " files in " + folders.toLocaleString() + " folders"],
        [IC.ok, "Saved settings", fmtBytes(lsBytes) + " used by this PC's settings and files (localStorage)"],
        [IC.ok, "Processor", (navigator.hardwareConcurrency || "?") + " logical processors" + (navigator.deviceMemory ? " · " + navigator.deviceMemory + " GB memory (approx.)" : "")],
        [IC.ok, "Windows Time service", "Time zone " + (Intl.DateTimeFormat().resolvedOptions().timeZone || "automatic") + " · clock synced with this device"],
      ];
      extra.forEach(([ic, t, s]) => kv.appendChild(el(`<div class="pt-sec-hcard">${ic}<div><b>${esc(t)}</b><span>${esc(s)}</span></div></div>`)));
      const bat = el(`<div class="pt-sec-hcard">${IC.info}<div><b>Battery life</b><span>Checking…</span></div></div>`); kv.appendChild(bat);
      if (navigator.getBattery) navigator.getBattery().then((b) => { bat.innerHTML = `${IC.ok}<div><b>Battery life</b><span>${Math.round(b.level * 100)}% · ${b.charging ? "charging" : "on battery"} <em>(real)</em></span></div>`; }).catch(() => { bat.querySelector("span").textContent = "Battery status isn't available in this browser."; });
      else bat.querySelector("span").textContent = "Battery status isn't available in this browser.";
      refreshHealth().then((h) => {
        if (!kv.isConnected) return;
        const t = kv.querySelector(".pt-sec-stx"), bar = kv.querySelector(".pt-sec-storage .pt-bar i");
        if (h.quota) { t.innerHTML = fmtBytes(h.usage || 0) + " used of " + fmtBytes(h.quota) + " available to this site (" + (h.pct < 0.1 ? "<0.1" : h.pct.toFixed(1)) + "%)" + (h.persisted ? " · storage is persistent" : "") + " <em>(real)</em>"; bar.style.width = Math.max(1, Math.min(100, h.pct)) + "%"; }
        else t.textContent = "This browser doesn't report storage usage.";
        if (h.pct > 90) kv.querySelector(".pt-sec-storage").firstChild.outerHTML = IC.warn;
      });
      const fs = section("Fresh start", "Start fresh with a clean and up-to-date installation of Windows. This will keep your personal files.");
      fs.appendChild(link("Additional info", () => { if (window.Notify) Notify.show({ icon: Icon.mini("defender", "Windows Security"), title: "Fresh start", body: "Use Settings → System → Recovery to reset this PC." }); }));
      m.appendChild(fs);
    }

    // ---------- Family ----------
    function pFamily(m) {
      m.appendChild(h1(IC.family, "Family options", "Get what you need to simplify your family's digital life."));
      const p = section("Parental controls", "Help protect your kids online. Choose which websites your kids can visit, set screen time limits and see your kids' digital activities.");
      p.appendChild(link("View family settings", () => { try { if (window.Browser && Browser.openTo) Browser.openTo("https://family.microsoft.com"); } catch (_) {} }));
      m.appendChild(p);
      const d = section("See your family's devices", "Check the safety and health status of your family's devices and make sure they're up to date.");
      d.appendChild(link("View devices", () => { try { if (window.Browser && Browser.openTo) Browser.openTo("https://account.microsoft.com/devices"); } catch (_) {} }));
      m.appendChild(d);
    }

    // ---------- History ----------
    function pHistory(m) {
      const d = store();
      m.appendChild(h1(IC.history, "Protection history", "View the latest protection actions and recommendations from Windows Security."));
      const bar = el(`<div class="pt-sec-histbar"><select class="pt-sec-sel"><option value="all">All recent items</option><option value="threat">Threats</option><option value="scan">Scans</option><option value="setting">Settings changes</option></select><span class="pt-grow"></span></div>`);
      bar.appendChild(btn("Clear history", () => { d.history = []; save(); render(); }));
      m.appendChild(bar);
      const list = el(`<div class="pt-sec-hist"></div>`); m.appendChild(list);
      function paint(f) {
        list.innerHTML = "";
        const items = d.history.filter((h) => f === "all" || h.kind === f);
        if (!items.length) { list.appendChild(el(`<p class="pt-sec-p">No recent items.</p>`)); return; }
        items.forEach((h) => {
          const icon = h.kind === "threat" ? (h.status === "Active" ? IC.bad : h.status === "Allowed" ? IC.warn : IC.ok) : h.sev === "warn" ? IC.warn : IC.ok;
          const title = h.kind === "threat" ? (h.status === "Quarantined" ? "Threat quarantined" : h.status === "Removed" ? "Threat removed" : h.status === "Restored" ? "Threat restored" : h.status === "Allowed" ? "Threat allowed" : h.title) : h.title;
          const it = el(`<details class="pt-sec-hit"><summary>${icon}<div><b>${esc(title)}</b><span>${esc(when(h.acted || h.ts))}</span></div>${h.sev && h.kind === "threat" ? `<span class="pt-sec-sev sev-${esc(h.sev.toLowerCase())}">${esc(h.sev)}</span>` : ""}</summary><div class="pt-sec-hdet"></div></details>`);
          const det = it.querySelector(".pt-sec-hdet");
          if (h.threat) det.appendChild(el(`<div class="pt-sec-kv"><span>Detected</span><b>${esc(h.threat)}</b><span>Status</span><b>${esc(h.status || "")}</b><span>Date</span><b>${esc(when(h.ts))}</b><span>Affected item</span><b class="pt-sec-mono">${esc(h.path || "")}</b><span>Details</span><b>${esc(h.detail || "")}</b></div>`));
          else det.appendChild(el(`<p class="pt-sec-p">${esc(h.detail || "")}</p>`));
          const q = h.tid && d.quarantine.find((x) => x.id === h.tid);
          if (q) { const acts = el(`<div class="pt-sec-threat-acts"></div>`); acts.appendChild(btn("Restore", () => { restore(q); render(); }, true)); acts.appendChild(btn("Remove", () => { removeThreat(q); render(); })); det.appendChild(acts); }
          const c = h.tid && d.current.find((x) => x.id === h.tid);
          if (c) { const acts = el(`<div class="pt-sec-threat-acts"></div>`); acts.appendChild(btn("Quarantine", () => { quarantine(c); render(); }, true)); acts.appendChild(btn("Remove", () => { removeThreat(c); render(); })); acts.appendChild(btn("Allow on device", () => { allowThreat(c); render(); })); det.appendChild(acts); }
          list.appendChild(it);
        });
      }
      const sel = bar.querySelector("select"); sel.onchange = () => paint(sel.value); paint("all");
    }

    // ---------- Settings ----------
    function pSettings(m) {
      const d = store();
      m.appendChild(h1(IC.settings, "Security settings", ""));
      const n = section("Notifications", "Windows Security will send notifications with critical information about the health and security of your device.");
      n.appendChild(row("Get informational notifications", "Recent activity and scan results.", sw(d.infoNotif !== false, (v) => { d.infoNotif = v; save(); })));
      m.appendChild(n);
      const a = section("About");
      a.appendChild(el(`<div class="pt-sec-kv"><span>Antimalware Client Version</span><b>4.18.26100.1</b><span>Engine Version</span><b>1.1.26100.3</b><span>Security Intelligence Version</span><b>${esc(defsVersion(d.defsTs || Date.now()))}</b><span>Quarantined items</span><b>${d.quarantine.length}</b></div>`));
      m.appendChild(a);
    }

    window.addEventListener("online", onNet); window.addEventListener("offline", onNet);
    let offRadios = null; if (window.Radios && Radios.on) offRadios = Radios.on(onNet);
    function onNet() { if (!body.isConnected) { window.removeEventListener("online", onNet); window.removeEventListener("offline", onNet); if (offRadios) offRadios(); return; } if (page === "firewall") render(); }
    render();
    return ref;
  };
  // Show Windows Security in Start (it's a built-in Windows app).
  (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (EXTRA_DEFAULT_APPS.indexOf("security") < 0) EXTRA_DEFAULT_APPS.push("security");
  window.Defender = { runScan, scanState: () => scan, store, classify, quarantine, restore, removeThreat, realtimeCheck, EICAR_TEST: () => EICAR };
})();
