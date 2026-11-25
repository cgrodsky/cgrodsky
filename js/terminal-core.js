/* Windows 12 Terminal engine: Command Prompt, PowerShell and Arch Linux (bash) that all
   run on the REAL simulated filesystem: State.data.appData.files.root, the same tree
   File Explorer shows. Every change is saved with State.save().
   Loaded lazily by AppRegistry.terminal in js/apps2.js (or by its own <script> tag).

   Path mapping
     C:\                            root["Local Disk (C:)"]  (Windows, Program Files, Users...)
     C:\Users\<you>  (%USERPROFILE%, ~)
                                    the top-level folders File Explorer shows: Desktop,
                                    Documents, Downloads, Pictures, Music, Videos, OneDrive...
                                    <you> = account name without spaces; "You" is an alias.
     bash (Arch):  /  = C:\     ~ = /home/<user> = C:\Users\<you>     /mnt/c = C:\     /home = C:\Users
*/
(function () {
  "use strict";
  const S = () => State.data;
  const SYS = "Local Disk (C:)";
  // Colors are CSS variables so Windows Terminal color schemes (js/terminalx.js) can restyle every
  // pane; the fallbacks are the classic Campbell colors used when no scheme is applied.
  const V = (n, fb) => "var(--tx-" + n + "," + fb + ")";
  const COL = { fg: V("fg", "#cccccc"), green: V("green", "#16c60c"), red: V("red", "#ff4b4b"), yellow: V("yellow", "#ffe000"), blue: V("blue", "#3a96ff"), gray: V("gray", "#888888"), arch: V("arch", "#1793d1"), cyan: V("cyan", "#61d6d6"), white: V("white", "#f2f2f2"), ps: V("white", "#f2f2f2"), input: V("input", "#ffffff"), magenta: V("magenta", "#b4009e"), ubuntuPath: V("upath", "#3b78ff") };
  const CANCEL = { cancelled: true };
  // Commands added by other files (js/recovery.js, js/accounts.js): window.TerminalExt =
  // { cmd: { name: fn(c, api) }, ps: { "verb-noun": fn(c, api) } }. They run before the built-ins.
  const extCmd = (kind, key) => { try { const t = window.TerminalExt && window.TerminalExt[kind]; return (t && Object.prototype.hasOwnProperty.call(t, key) && t[key]) || null; } catch (_) { return null; } };
  const SYS_TS = new Date(2026, 9, 1, 4, 12).getTime();
  const VERSION = "12.0.2026";
  const HOSTNAME = "WIN12-PC";
  const lc = (s) => String(s == null ? "" : s).toLowerCase();
  const p2 = (n) => String(n).padStart(2, "0");
  const num = (n) => Number(n || 0).toLocaleString("en-US");
  const nowD = () => (window.State && State.now ? State.now() : new Date());
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Real free space from the browser's storage quota (falls back to a plausible number).
  let DISK = { free: 254123456789, total: 511101108224 };
  try { if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => { if (e && e.quota) DISK = { free: Math.max(0, e.quota - (e.usage || 0)), total: e.quota }; }).catch(() => {}); } catch (_) {}

  // ---------------------------------------------------------------- state
  function TS() {
    const d = S(); if (!d.appData) d.appData = {};
    const t = d.appData.terminal || (d.appData.terminal = { archInstalled: false });
    if (!t.epoch) t.epoch = Date.now();
    if (!Array.isArray(t.history)) t.history = [];
    if (!t.env || typeof t.env !== "object") t.env = {};
    if (!t.ip) t.ip = "192.168.1." + (50 + Math.floor(Math.random() * 150));
    if (!t.mac) t.mac = Array.from({ length: 6 }, (_, i) => (i === 0 ? 0x00 : Math.floor(Math.random() * 256)).toString(16).padStart(2, "0").toUpperCase()).join("-");
    return t;
  }
  const userName = () => (((S().profile && S().profile.username) || "User").replace(/[\s\\/:*?"<>|]+/g, "") || "User");
  const archUser = () => lc(userName()) || "user";
  const HOME = () => ["Users", userName()];

  // ---------------------------------------------------------------- filesystem (real data)
  function R() {
    const d = S(); if (!d.appData) d.appData = {};
    const FP = window.FilesParts; let ch = false;
    if (!d.appData.files || !d.appData.files.root) { d.appData.files = { root: FP ? FP.FILE_SEED() : {} }; ch = true; }
    const r = d.appData.files.root;
    if (!r[SYS] && FP) { Object.assign(r, FP.WIN_FS()); ch = true; }
    ["Videos", "OneDrive"].forEach((k) => { if (!r[k]) { r[k] = { type: "folder", children: {} }; ch = true; } });
    if (ch) State.save();
    return r;
  }
  function save() { try { State.save(); } catch (_) {} try { window.dispatchEvent(new CustomEvent("vfs-change", { detail: { source: "terminal" } })); } catch (_) {} }
  const isHomeAlias = (n) => { const l = lc(n); return l === lc(userName()) || l === "you"; };
  function keyIn(kids, name) {
    if (!kids || name == null) return null;
    const r = R(); const skip = (k) => kids === r && k === SYS;
    if (Object.prototype.hasOwnProperty.call(kids, name) && !skip(name)) return name;
    const l = lc(name);
    for (const k of Object.keys(kids)) if (!skip(k) && lc(k) === l) return k;
    return null;
  }
  const homeNode = () => ({ type: "folder", children: R(), virtual: "home", ts: TS().epoch });
  // Walk C:-relative segments -> { node, parent (children obj), key, canon } | null
  function walk(segs) {
    const r = R(); let node = r[SYS];
    if (!node) return null;
    let parent = null, key = null; const canon = [];
    for (let i = 0; i < segs.length; i++) {
      if (!node || node.type !== "folder") return null;
      if (i === 1 && lc(canon[0]) === "users" && isHomeAlias(segs[1])) { parent = node.children; key = null; node = homeNode(); canon.push(userName()); continue; }
      const kids = node.children; const k = keyIn(kids, segs[i]);
      if (!k) return null;
      parent = kids; key = k; node = kids[k]; canon.push(k);
    }
    return { node, parent, key, canon };
  }
  function entries(h) {
    if (!h || h.node.type !== "folder") return [];
    const kids = h.node.children || {}; const r = R();
    let list = Object.keys(kids).filter((k) => !(kids === r && k === SYS)).map((k) => [k, kids[k]]);
    if (h.canon.length === 1 && lc(h.canon[0]) === "users") { list = list.filter(([k]) => !isHomeAlias(k)); list.push([userName(), homeNode()]); }
    return list.sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));
  }
  const childH = (h, name, node) => ({ node, parent: h.node.children, key: node.virtual ? null : name, canon: h.canon.concat(name) });
  const isDir = (n) => n && n.type === "folder";
  const hidden = (n) => /H/.test((n && n.attr) || "");
  const ro = (n) => /R/.test((n && n.attr) || "");
  const badName = (n) => !n || /[\\/:*?"<>|]/.test(n) || /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(n) || /^\.+$/.test(n);
  const mtime = (n) => (n && n.ts) || (n && n.kind === "system" ? SYS_TS : TS().epoch);
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function fsize(name, n) {
    if (!n || n.type !== "file") return 0;
    if (typeof n.size === "number") return n.size;
    if (typeof n.content === "string" && n.content) { try { return new TextEncoder().encode(n.content).length; } catch (_) { return n.content.length; } }
    if (n.kind === "system") return (8 + (hash(name) % 4800)) * 512;
    if (n.src) return Math.round(String(n.src).length * 0.75);
    return 0;
  }
  function htmlToText(h) { try { return new DOMParser().parseFromString(String(h).replace(/<(br|\/p|\/div|\/h\d|\/li|\/tr)\b[^>]*>/gi, "$&\n"), "text/html").body.textContent || ""; } catch (_) { return String(h).replace(/<[^>]+>/g, ""); } }
  function textOf(name, n) {
    if (!n || n.type !== "file") return "";
    if (n.kind === "text" || (n.kind == null && typeof n.content === "string")) return n.content || "";
    if (n.kind === "word") return htmlToText(n.content || "");
    if (n.kind === "pptx") { try { const out = []; (function g(o) { if (typeof o === "string") { if (o.trim() && !/^(#|data:|https?:)/.test(o)) out.push(o.indexOf("<") >= 0 ? htmlToText(o) : o); } else if (o && typeof o === "object") Object.keys(o).forEach((k) => g(o[k])); })(JSON.parse(n.content)); return out.join("\n"); } catch (_) { return n.content || ""; } }
    if (n.kind === "xlsx" && typeof n.content === "string") return n.content;
    if (n.kind === "system" || /\.(exe|dll|sys)$/i.test(name)) return "MZ\ufffd\u0003\ufffd\ufffd\ufffd@\ufffd\ufffd\u000e\u001f\ufffd\u000e\ufffd\t\ufffd!\ufffd\u0001L\ufffd!This program cannot be run in DOS mode.\r\r\n$\ufffd\ufffd\ufffdPE\ufffd\ufffdL\u0001";
    return "\ufffd\ufffd\ufffd\ufffd (binary file, " + num(fsize(name, n)) + " bytes; open it from File Explorer)";
  }
  const isTextual = (n) => n && n.type === "file" && (n.kind === "text" || n.kind === "word" || n.kind === "pptx" || (n.kind == null && typeof n.content === "string"));
  function clone(n) { const c = JSON.parse(JSON.stringify(n)); c.ts = Date.now(); return c; }
  function countTree(n) { let f = 0, d = 0, b = 0; (function g(x, nm) { if (isDir(x)) { d++; Object.keys(x.children || {}).forEach((k) => { if (!(x.children === R() && k === SYS)) g(x.children[k], k); }); } else { f++; b += fsize(nm, x); } })(n, ""); return { files: f, dirs: d - 1, bytes: b }; }

  // ---- protection: Windows needs C:\Windows\System32 ----
  function sys32Hit(canon) { const l = canon.map(lc); if (l.length <= 2 && ["windows", "system32"].slice(0, l.length).every((x, i) => x === l[i])) return true; return l[0] === "windows" && l[1] === "system32"; }
  const writeProtected = (canon) => { const l = canon.map(lc); return l[0] === "windows" && l[1] !== "temp"; };
  function guard(h, force) {
    const l = h.canon.map(lc);
    if (h.node.virtual || (l.length === 1 && l[0] === "users")) return "hard";
    const prot = l.length === 0 || (l[0] === "windows" && l[1] !== "temp") || (l.length === 1 && /^(program files|program files \(x86\)|programdata)$/.test(l[0])) || ro(h.node);
    if (prot && !force) return "deny";
    return sys32Hit(h.canon) ? "bsod" : "ok";
  }
  function removeH(h) {
    if (!h.canon.length) { const k = h.node.children; Object.keys(k).forEach((x) => delete k[x]); return; }
    if (h.parent && h.key != null) delete h.parent[h.key];
  }
  let crashing = false;
  function crash() { save(); if (crashing) return; crashing = true; setTimeout(() => { crashing = false; if (window.BSOD) window.BSOD.show(); }, 700); }

  function mkdirP(segs) {
    for (let i = 1; i <= segs.length; i++) {
      const h = walk(segs.slice(0, i));
      if (h) { if (!isDir(h.node)) return "path"; continue; }
      const par = walk(segs.slice(0, i - 1));
      if (!par || !isDir(par.node)) return "path";
      const nm = segs[i - 1];
      if (badName(nm)) return "name";
      if (writeProtected(par.canon.concat(nm))) return "denied";
      par.node.children[nm] = { type: "folder", children: {}, ts: Date.now() };
    }
    return null;
  }
  function writeAt(segs, text, append) {
    if (!segs.length) return "dir";
    const h = walk(segs);
    if (h) {
      if (isDir(h.node)) return "dir";
      if (writeProtected(h.canon) || ro(h.node)) return "denied";
      const n = h.node;
      if (n.kind !== "text") { const prev = append && isTextual(n) ? textOf(h.key, n) : ""; ["blob", "src", "mime"].forEach((k) => delete n[k]); n.kind = "text"; n.content = prev; }
      delete n.size;
      n.content = append ? (n.content || "") + text : text; n.ts = Date.now();
      save(); return null;
    }
    const par = walk(segs.slice(0, -1));
    if (!par || !isDir(par.node)) return "path";
    const nm = segs[segs.length - 1];
    if (badName(nm)) return "name";
    if (writeProtected(par.canon.concat(nm))) return "denied";
    par.node.children[nm] = { type: "file", kind: "text", content: text, ts: Date.now() };
    save(); return null;
  }

  // ---- paths ----
  const splitP = (p) => String(p).split(/[\\/]+/).filter(Boolean);
  function norm(base, parts) { const o = base.slice(); for (const s of parts) { if (s === ".") continue; if (s === "..") { o.pop(); continue; } o.push(s); } return o; }
  function winSegs(p, cwd) {
    p = String(p == null ? "" : p).trim();
    if (p === "") return cwd.slice();
    const m = /^([a-zA-Z]):(.*)$/.exec(p);
    if (m) { if (lc(m[1]) !== "c") return null; const r = m[2]; return /^[\\/]/.test(r) ? norm([], splitP(r)) : norm(cwd, splitP(r)); }
    if (/^[\\/]/.test(p)) return norm([], splitP(p));
    if (p === "~" || /^~[\\/]/.test(p)) return norm(HOME(), splitP(p.slice(1)));
    return norm(cwd, splitP(p));
  }
  function posixSegs(p, cwd) {
    p = String(p == null ? "" : p);
    if (p === "") return cwd.slice();
    if (p === "~" || p.startsWith("~/")) return norm(HOME(), splitP(p.slice(1)));
    if (/^[a-zA-Z]:[\\/]?/.test(p)) return winSegs(p, cwd);
    if (p.startsWith("/")) { let parts = splitP(p); if (parts[0] === "mnt" && lc(parts[1]) === "c") parts = parts.slice(2); else if (parts[0] === "home") parts = ["Users"].concat(parts.slice(1)); return norm([], parts); }
    return norm(cwd, splitP(p));
  }
  const winPath = (segs) => "C:\\" + segs.join("\\");
  function posixPath(segs) {
    if (segs.length && lc(segs[0]) === "users") return "/home" + (segs.length > 1 ? "/" + (isHomeAlias(segs[1]) ? archUser() : segs[1]) : "") + (segs.length > 2 ? "/" + segs.slice(2).join("/") : "");
    return "/" + segs.join("/");
  }
  const atHome = (segs) => segs.length >= 2 && lc(segs[0]) === "users" && isHomeAlias(segs[1]);
  function tildePath(segs) { return atHome(segs) ? "~" + (segs.length > 2 ? "/" + segs.slice(2).join("/") : "") : posixPath(segs); }
  const hasWild = (s) => /[*?]/.test(s);
  function rx(pat) { return new RegExp("^" + String(pat).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i"); }
  function fixWildDot(pat) { return pat === "*.*" ? "*" : pat; }

  // ---- dates ----
  function dosDate(ms) { const d = new Date(ms); let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${d.getFullYear()}  ${p2(h)}:${p2(d.getMinutes())} ${ap}`; }
  function psDate(ms) { const d = new Date(ms); let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h}:${p2(d.getMinutes())} ${ap}`; }
  function lsDate(ms) { const d = new Date(ms); const recent = Math.abs(Date.now() - ms) < 182 * 864e5; return `${MON[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${recent ? p2(d.getHours()) + ":" + p2(d.getMinutes()) : " " + d.getFullYear()}`; }
  function longDate(d) { let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${ap}`; }

  // ---- apps & processes (the real window manager) ----
  const APP_ALIAS = { notepad: "notepad", calc: "calculator", calculator: "calculator", mspaint: "paint", paint: "paint", explorer: "fileexplorer", control: "settings", "ms-settings:": "settings", settings: "settings", msedge: "edge", edge: "edge", chrome: "chrome", browser: "browser", winword: "word", word: "word", excel: "excel", powerpnt: "powerpoint", powerpoint: "powerpoint", outlook: "outlook", taskmgr: "taskmanager", cmd: "terminal", wt: "terminal", terminal: "terminal", code: "vscode", vscode: "vscode", snippingtool: "snip", camera: "camera", photos: "photos", store: "store__", copilot: "copilot", clock: "clock", solitaire: "solitaire", minecraft: "minecraft", xbox: "xbox", defender: "security", mail: "mail", maps: "maps", weather: "weather", spotify: "spotify" };
  function findApp(name) {
    const n = lc(name).replace(/\.exe$/, "");
    if (!n) return null;
    const id = APP_ALIAS[n] || n;
    const AR = window.AppRegistry || {};
    if (id === "store__") return id;
    if (AR[id] && typeof AR[id] === "function") return id;
    const cat = (window.Catalog && window.Catalog.storeApps) || [];
    const hit = cat.find((a) => lc(a.id) === id || lc(a.builtin) === id || lc(a.name).replace(/\s+/g, "") === id.replace(/\s+/g, ""));
    return hit ? hit.id : null;
  }
  function launchApp(id) { try { window.WM.open(id); return true; } catch (e) { return false; } }
  const PIDS = new WeakMap(); let pidNext = 4200 + Math.floor(Math.random() * 400) * 4;
  const SYS_PROCS = [["System Idle Process", 0, 8], ["System", 4, 1536], ["Registry", 124, 61240], ["smss.exe", 412, 1184], ["csrss.exe", 612, 5620], ["wininit.exe", 700, 6912], ["services.exe", 788, 9812], ["lsass.exe", 804, 18240], ["svchost.exe", 932, 31228], ["svchost.exe", 1040, 14100], ["dwm.exe", 1188, 98420], ["explorer.exe", 3820, 142880], ["ctfmon.exe", 2410, 16604]];
  const CRITICAL = ["csrss.exe", "wininit.exe", "smss.exe", "services.exe", "lsass.exe"];
  function windowsList() {
    return Array.from(document.querySelectorAll(".win")).filter((w) => w.querySelector(".win-titlebar") && w.isConnected).map((w) => {
      if (!PIDS.has(w)) { PIDS.set(w, pidNext); pidNext += 4; }
      const title = ((w.querySelector(".t-text") || {}).textContent || "App").trim() || "App";
      const short = title.split(/\s+[-–—]\s+/).pop();
      const image = (short.replace(/[^A-Za-z0-9]+/g, "") || "App") + ".exe";
      return { el: w, title, image, pid: PIDS.get(w), mem: 9000 + w.getElementsByTagName("*").length * 6, minimized: w.style.display === "none" };
    });
  }
  function closeWin(w) { const b = w.el.querySelector(".ctl-close"); if (b && !b.disabled) { b.click(); return !w.el.isConnected; } return false; }

  // ---------------------------------------------------------------- lexer / parser
  function lex(src, mode) {
    const toks = []; let i = 0, cur = null;
    const word = () => (cur = cur || { t: "w", v: "", raw: "", q: false, s: i, e: i });
    const push = () => { if (cur) { toks.push(cur); cur = null; } };
    while (i < src.length) {
      const ch = src[i];
      if (ch === '"' || (ch === "'" && mode !== "cmd")) {
        word(); const end = src.indexOf(ch, i + 1); const stop = end < 0 ? src.length : end;
        let inner = src.slice(i + 1, stop);
        if (ch === '"' && mode === "bash") inner = inner.replace(/\\(["\\$`])/g, "$1");
        cur.v += inner; cur.raw += src.slice(i, Math.min(src.length, stop + 1)); cur.q = true; i = stop + 1; cur.e = i; continue;
      }
      if (((ch === "^" && mode === "cmd") || (ch === "\\" && mode === "bash") || (ch === "`" && mode === "ps")) && i + 1 < src.length) { word(); cur.v += src[i + 1]; cur.raw += src.slice(i, i + 2); i += 2; cur.e = i; continue; }
      if (/\s/.test(ch)) { push(); i++; continue; }
      if (!cur && src.startsWith("2>&1", i)) { toks.push({ t: "op", v: "2>&1" }); i += 4; continue; }
      if (!cur && src.startsWith("2>", i)) { toks.push({ t: "op", v: "2>" }); i += 2; continue; }
      const two = src.slice(i, i + 2);
      if (two === "&&" || two === "||" || two === ">>") { push(); toks.push({ t: "op", v: two }); i += 2; continue; }
      if (ch === "|" || ch === ">" || ch === "<" || (ch === "&" && mode !== "ps") || (ch === ";" && mode !== "cmd")) { push(); toks.push({ t: "op", v: ch }); i++; continue; }
      word(); cur.v += ch; cur.raw += ch; i++; cur.e = i;
    }
    push();
    return toks;
  }
  function parse(toks, src) {
    const items = []; const newStage = () => ({ words: [], out: null, inFile: null, errNull: false, src });
    let stage = newStage(), stages = [stage], op = null;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === "w") { stage.words.push(t); continue; }
      if (t.v === "|") { stage = newStage(); stages.push(stage); continue; }
      if (t.v === "&&" || t.v === "||" || t.v === ";" || t.v === "&") { items.push({ op, stages }); op = (t.v === "&&" || t.v === "||") ? t.v : null; stage = newStage(); stages = [stage]; continue; }
      if (t.v === ">" || t.v === ">>" || t.v === "<" || t.v === "2>") {
        const f = toks[++i]; if (!f || f.t !== "w") return { error: true };
        if (t.v === "<") stage.inFile = f.v; else if (t.v === "2>") stage.errNull = true; else stage.out = { path: f.v, append: t.v === ">>" };
        continue;
      }
    }
    items.push({ op, stages });
    return { items: items.filter((it) => it.stages.some((s) => s.words.length || s.out)) };
  }

  // ---------------------------------------------------------------- the terminal window
  let styled = false;
  function injectStyle() {
    if (styled) return; styled = true;
    const st = document.createElement("style");
    st.textContent = `.wt-term{height:100%;background:var(--tx-bg,#0c0c0c);color:var(--tx-fg,#cccccc);font-family:"Cascadia Mono",Consolas,"Courier New",monospace;font-size:.9rem;padding:12px;overflow:auto;box-sizing:border-box;line-height:1.3;cursor:text}
.wt-out .tl{white-space:pre-wrap;word-break:break-word;min-height:1.3em}
.wt-row{display:flex;align-items:flex-start}.wt-row.busy .wt-in{caret-color:transparent}
.wt-prompt{white-space:pre;color:var(--tx-green,#16c60c);flex:none;max-width:70%;overflow:hidden;text-overflow:ellipsis}
.wt-in{flex:1;min-width:40px;background:none;border:none;color:var(--tx-input,#fff);outline:none;font:inherit;padding:0;margin:0;caret-color:var(--tx-cursor,#fff)}
.wt-term ::selection{background:var(--tx-sel,#264f78)}`;
    document.head.appendChild(st);
  }

  // Profiles a session can start as (js/terminalx.js passes one per pane):
  //   { shell: "cmd" | "ps" | "bash" | "azure", ps: "5.1" | "7", distro: "arch" | "ubuntu",
  //     startDir: "C:\\Users\\me\\Documents" | "~" | "%USERPROFILE%" | null, banner: "legacy" | "profile" | "none" }
  const BASE_PROFILE = { shell: "cmd", ps: "7", distro: "arch", startDir: null, banner: "legacy" };

  // The classic single-session Terminal window (also used by the Windows RE Command Prompt in js/recovery.js).
  function open(cw, profile) {
    const create = cw || ((o) => window.WM.createWindow(o));
    let sess = null;
    const winRef = create({ title: "Terminal", icon: Icon.mini("terminal", "Terminal"), width: 720, height: 460, appId: "terminal", onClose: () => { if (sess) sess.dispose(); } });
    sess = createSession({ host: winRef.body, win: winRef.win, close: () => winRef.close(), profile: profile || BASE_PROFILE });
    return winRef;
  }

  // One shell session rendered into o.host. Each session has its own cwd, history, variables and
  // nested-shell stack. Hooks (all optional):
  //   o.close()            close this session's pane/tab/window ("exit" in the outermost shell)
  //   o.closeWindow()      close the whole window (taskkill / Stop-Process on the Terminal itself)
  //   o.setTitle(text)     the `title` command          o.onMode(mode, info)  nested shell entered/left
  //   o.onBell()           BEL was printed              o.onIdle()            a command finished
  //   o.win                window element (legacy chrome updates when onMode is not given)
  function createSession(o) {
    injectStyle();
    o = o || {};
    const prof = Object.assign({}, BASE_PROFILE, o.profile || {});
    let closed = false, curJob = null, pendingAsk = null, busy = false, exited = null;
    const winRef = { win: o.win || null, close: () => { if (o.closeWindow) o.closeWindow(); else if (o.close) o.close(); } };
    const body = o.host;
    const legacy = prof.banner === "legacy";
    body.innerHTML = `<div class="wt-term">
      <div class="wt-banner">${legacy ? `<div style="color:var(--tx-green,#16c60c)">Windows 12 Terminal [Version ${VERSION}]</div><div>(c) Cameron Systems. All rights reserved (not really).</div><div style="color:var(--tx-gray,#888)">Type 'help' for the list of commands. Tab completes, Up/Down = history, Ctrl+C cancels, Ctrl+L clears.</div>` : ""}</div>
      <div class="wt-out"></div>
      <div class="wt-row"><span class="wt-prompt prompt"></span><input class="wt-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Command line"></div></div>`;
    const termEl = body.querySelector(".wt-term"), out = body.querySelector(".wt-out"), cmd = body.querySelector(".wt-in"), promptEl = body.querySelector(".prompt"), rowEl = body.querySelector(".wt-row");
    let fg = COL.fg;

    // ---- session ----
    const ts = TS();
    function startSegs() {
      const d = prof.startDir;
      if (!d || /^%userprofile%$/i.test(String(d).trim()) || String(d).trim() === "~") return HOME();
      const raw = String(d).trim().replace(/%userprofile%/ig, winPath(HOME())).replace(/%systemroot%|%windir%/ig, "C:\\Windows").replace(/%homepath%/ig, winPath(HOME()));
      const segs = /^[\/]/.test(raw) && !/^\\/.test(raw) ? posixSegs(raw, HOME()) : winSegs(raw, HOME());
      const h = segs && walk(segs);
      return h && isDir(h.node) ? h.canon : null;
    }
    const firstFrame = () => ({ mode: prof.shell, cwd: (o.cwd && walk(o.cwd) && isDir(walk(o.cwd).node) ? walk(o.cwd).canon : startSegs()) || HOME(), psv: prof.ps === "5.1" ? "5.1" : "7", distro: prof.distro === "ubuntu" ? "ubuntu" : "arch" });
    const stack = [firstFrame()];
    const top = () => stack[stack.length - 1];
    const mode = () => top().mode;
    const cwd = () => top().cwd;
    const setCwd = (segs) => { top().prev = top().cwd; top().cwd = segs; };
    const segsFor = (p) => (mode() === "bash" ? posixSegs(p, cwd()) : winSegs(p, cwd()));
    const show = (segs) => (mode() === "bash" ? posixPath(segs) : winPath(segs));
    const sessionEnv = {};
    const psVars = {};
    const bashEnv = {};
    let lastStatus = 0;
    const hist = ts.history.slice(-200);
    const wtSession = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => { const r = Math.random() * 16 | 0; return (ch === "x" ? r : (r & 3) | 8).toString(16); });
    let histIdx = hist.length, tabState = null, lastTabAt = 0;
    let shutdownTimer = null;

    function winEnv() {
      const u = userName(), home = winPath(HOME());
      const base = { ALLUSERSPROFILE: "C:\\ProgramData", APPDATA: home + "\\AppData\\Roaming", COMMONPROGRAMFILES: "C:\\Program Files\\Common Files", COMPUTERNAME: HOSTNAME, COMSPEC: "C:\\Windows\\system32\\cmd.exe", HOMEDRIVE: "C:", HOMEPATH: "\\Users\\" + u, LOCALAPPDATA: home + "\\AppData\\Local", NUMBER_OF_PROCESSORS: String(navigator.hardwareConcurrency || 4), OS: "Windows_NT", PATH: "C:\\Windows\\system32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\", PATHEXT: ".COM;.EXE;.BAT;.CMD;.VBS;.JS;.WSH;.MSC", PROCESSOR_ARCHITECTURE: "AMD64", PROGRAMDATA: "C:\\ProgramData", PROGRAMFILES: "C:\\Program Files", "PROGRAMFILES(X86)": "C:\\Program Files (x86)", PROMPT: "$P$G", PUBLIC: "C:\\Users\\Public", SYSTEMDRIVE: "C:", SYSTEMROOT: "C:\\Windows", TEMP: "C:\\Windows\\Temp", TMP: "C:\\Windows\\Temp", USERDOMAIN: HOSTNAME, USERNAME: u, USERPROFILE: home, WINDIR: "C:\\Windows" };
      Object.keys(ts.env).forEach((k) => (base[k.toUpperCase()] = ts.env[k]));
      Object.keys(sessionEnv).forEach((k) => { if (sessionEnv[k] == null) delete base[k]; else base[k] = sessionEnv[k]; });
      return base;
    }
    const NICE = { PATH: "Path", SYSTEMROOT: "SystemRoot", WINDIR: "windir", PROGRAMFILES: "ProgramFiles", "PROGRAMFILES(X86)": "ProgramFiles(x86)", PROGRAMDATA: "ProgramData", SYSTEMDRIVE: "SystemDrive", COMMONPROGRAMFILES: "CommonProgramFiles" };
    function getEnv(name) {
      const N = String(name).toUpperCase(), d = nowD();
      if (N === "CD") return winPath(cwd());
      if (N === "DATE") return `${DAYS[d.getDay()].slice(0, 3)} ${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${d.getFullYear()}`;
      if (N === "TIME") return `${String(d.getHours()).padStart(2)}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p2(Math.floor(d.getMilliseconds() / 10))}`;
      if (N === "RANDOM") return String(Math.floor(Math.random() * 32768));
      if (N === "ERRORLEVEL") return String(lastStatus);
      const e = winEnv(); return e[N] != null ? e[N] : null;
    }
    function bashVar(n) {
      const ub = isUbuntu();
      const map = { HOME: "/home/" + archUser(), USER: archUser(), LOGNAME: archUser(), SHELL: "/bin/bash", PATH: "/usr/local/sbin:/usr/local/bin:/usr/bin:/mnt/c/Windows/system32", LANG: "en_US.UTF-8", TERM: "xterm-256color", HOSTNAME: ub ? HOSTNAME : "arch", PWD: posixPath(cwd()), OLDPWD: top().prev ? posixPath(top().prev) : "", "?": String(lastStatus), $: "1337", WSL_DISTRO_NAME: ub ? "Ubuntu" : "Arch", WT_SESSION: wtSession, WT_PROFILE_ID: prof.guid || "" };
      return bashEnv[n] != null ? bashEnv[n] : map[n] != null ? map[n] : "";
    }

    // ---- output ----
    const scroll = () => { termEl.scrollTop = termEl.scrollHeight; };
    function emit(parts, color) {
      if (Array.isArray(parts) ? parts.some((p) => /\u0007/.test(p[0])) : /\u0007/.test(parts)) {
        if (o.onBell) try { o.onBell(); } catch (_) {}
        parts = Array.isArray(parts) ? parts.map((p) => [String(p[0]).replace(/\u0007/g, ""), p[1]]) : String(parts).replace(/\u0007/g, "");
        if (Array.isArray(parts) ? !parts.some((p) => p[0]) : !parts) return;
      }
      const d = document.createElement("div"); d.className = "tl";
      if (Array.isArray(parts)) parts.forEach(([t, c]) => { const s = document.createElement("span"); s.textContent = t; if (c) s.style.color = c; d.appendChild(s); });
      else { d.textContent = parts; if (color) d.style.color = color; }
      out.appendChild(d);
      while (out.childElementCount > 4000) out.removeChild(out.firstChild);
      scroll();
    }
    function clearScreen() { out.innerHTML = ""; const b = body.querySelector(".wt-banner"); if (b) b.remove(); }
    function isUbuntu() { return mode() === "bash" && top().distro === "ubuntu"; }
    function promptText() { return promptParts().map((p) => p[0]).join(""); }
    function promptParts() {
      const m = mode();
      if (m === "bash") {
        const c = cwd();
        if (isUbuntu()) return [[`${archUser()}@${HOSTNAME}`, promptEl.dataset.custom || COL.green], [":", COL.fg], [tildePath(c), COL.ubuntuPath], ["$ ", COL.fg]];
        const base = atHome(c) ? "~" : c.length ? c[c.length - 1] : "/"; return [[`[${archUser()}@arch ${base}]$ `, promptEl.dataset.custom || COL.arch]];
      }
      if (m === "azure") return [["PS Azure:\\> ", COL.yellow]];
      if (m === "ps") return [[`PS ${winPath(cwd())}> `, promptEl.dataset.custom || (top().psv === "5.1" ? COL.fg : COL.green)]];
      return [[winPath(cwd()) + ">", promptEl.dataset.custom || COL.green]];
    }
    const promptColor = () => promptParts()[0][1];
    function paintPrompt() { promptEl.textContent = ""; promptEl.style.color = ""; promptParts().forEach(([t, c]) => { const sp = document.createElement("span"); sp.textContent = t; if (c) sp.style.color = c; promptEl.appendChild(sp); }); }
    const isActive = () => (o.isActive ? o.isActive() : true);
    function renderPrompt() {
      if (exited) { rowEl.classList.add("busy"); promptEl.textContent = ""; cmd.readOnly = true; }
      else if (pendingAsk) { rowEl.classList.remove("busy"); promptEl.textContent = pendingAsk.q; promptEl.style.color = fg; cmd.readOnly = false; }
      else if (busy) { promptEl.textContent = ""; rowEl.classList.add("busy"); cmd.readOnly = true; }
      else { rowEl.classList.remove("busy"); cmd.readOnly = false; paintPrompt(); }
      if (!closed && isActive()) try { cmd.focus({ preventScroll: true }); } catch (_) {}
      scroll();
    }
    function setChrome(iconKey, label, title) {
      if (!winRef.win) return;
      const ic = winRef.win.querySelector(".win-titlebar .title span:first-child");
      if (ic && window.Icon) ic.innerHTML = Icon.mini(iconKey, label);
      const tt = winRef.win.querySelector(".win-titlebar .t-text");
      if (tt) tt.textContent = title;
    }
    function shellName() {
      const m = mode(), f = top();
      if (m === "bash") return f.distro === "ubuntu" ? "Ubuntu" : "Arch Linux";
      if (m === "ps") return f.psv === "5.1" ? "Windows PowerShell" : "PowerShell";
      if (m === "azure") return "Azure Cloud Shell";
      return "Command Prompt";
    }
    function chromeForMode() {
      const m = mode();
      if (o.onMode) { try { o.onMode(m, { name: shellName(), distro: top().distro, psv: top().psv, depth: stack.length }); } catch (_) {} return; }
      if (m === "bash") setChrome("linuxterminal", "Arch", "Arch Linux");
      else if (m === "ps") setChrome("powershell", "PowerShell", "Windows PowerShell");
      else setChrome("terminal", "Terminal", "Terminal");
    }

    function mkIO(job, sink, stdin, quietErr) {
      return {
        stdin,
        get cancelled() { return job.dead; },
        out(t, c) { if (job.dead) return; if (sink) { String(t).split("\n").forEach((x) => sink.push(x)); return; } emit(String(t), c); },
        seg(parts) { if (job.dead) return; if (sink) { sink.push(parts.map((p) => p[0]).join("")); return; } emit(parts); },
        err(t) { if (job.dead || quietErr) return; emit(String(t), COL.red); },
        warn(t) { if (job.dead) return; emit(String(t), COL.yellow); },
        ask(q) { if (job.dead) return Promise.reject(CANCEL); return new Promise((res) => { pendingAsk = { q, res, job }; renderPrompt(); }); },
        sleep(ms) { return new Promise((res, rej) => setTimeout(() => (job.dead ? rej(CANCEL) : res()), ms)); },
        check() { if (job.dead) throw CANCEL; },
      };
    }

    // ---- run a line ----
    async function submit(line) {
      emit(promptParts().concat([[line, COL.input]]));
      const t = line.trim();
      if (t) { if (hist[hist.length - 1] !== line) hist.push(line); if (hist.length > 200) hist.shift(); ts.history = hist.slice(); try { State.save(); } catch (_) {} }
      histIdx = hist.length;
      if (!t) { renderPrompt(); return; }
      busy = true; renderPrompt();
      const job = { dead: false }; curJob = job;
      const cancelP = new Promise((res) => { job.cancel = () => { if (job.dead) return; job.dead = true; res(); }; });
      const p = execLine(line, job);
      p.catch(() => {});
      try { await Promise.race([p, cancelP]); }
      catch (e) { if (e !== CANCEL) { emit("Error: " + ((e && e.message) || e), COL.red); try { console.warn(e); } catch (_) {} } }
      curJob = null; pendingAsk = null; busy = false;
      if (!closed && !exited) renderPrompt();
      if (!closed && o.onIdle) try { o.onIdle(); } catch (_) {}
    }
    function expand(line, m) {
      if (m === "cmd") return line.replace(/%([^%\s]+)%/g, (all, n) => { const v = getEnv(n); return v == null ? all : v; });
      // single-quoted text is literal in PowerShell and bash
      return line.split(/('[^']*')/).map((seg, i) => {
        if (i % 2) return seg;
        if (m === "ps") return seg.replace(/\$env:([A-Za-z_][\w()]*)/gi, (a, n) => { const v = getEnv(n); return v == null ? "" : v; })
          .replace(/\$([A-Za-z_]\w*)\b(?!\.)/g, (a, n) => {
            const k = lc(n);
            if (k === "psversiontable" || k === "host") return a;
            if (k === "home") return winPath(HOME()); if (k === "pwd") return winPath(cwd()); if (k === "true") return "True"; if (k === "false") return "False"; if (k === "null") return "";
            return psVars[k] != null ? psVars[k] : "";
          }).replace(/\$\?/g, lastStatus ? "False" : "True").replace(/`a/g, "\u0007");
        return seg.replace(/\$\{(\w+)\}|\$(\w+|\?|\$)/g, (a, b, c) => bashVar(b || c)).replace(/(^|\s)~(?=\/|\s|$)/g, "$1/home/" + archUser());
      }).join("");
    }
    async function execLine(line, job) {
      const m = mode();
      if (m === "azure") return runAzure(line, mkIO(job, null, null));
      if (m === "ps") { const r = psPre(line, job); if (r !== undefined) return r; }
      if (m === "bash") { const a = /^\s*(?:export\s+)?([A-Za-z_]\w*)=(.*)$/.exec(line); if (a) { bashEnv[a[1]] = expand(a[2], "bash").replace(/^["']|["']$/g, ""); return 0; } }
      const src = expand(line, m);
      const parsed = parse(lex(src, m), src);
      if (parsed.error) { syntaxError(mkIO(job, null, null)); return (lastStatus = 1); }
      let status = 0;
      for (const item of parsed.items) {
        if (item.op === "&&" && status !== 0) continue;
        if (item.op === "||" && status === 0) continue;
        status = await runPipeline(item.stages, job);
        lastStatus = status;
        if (job.dead || closed) return status;
      }
      return status;
    }
    function syntaxError(io) {
      const m = mode();
      if (m === "bash") io.err("bash: syntax error near unexpected token `newline'");
      else if (m === "ps") io.err("ParserError: An empty pipe element is not allowed.");
      else io.err("The syntax of the command is incorrect.");
    }
    function fsErr(code, p, verb) {
      const m = mode();
      if (m === "bash") return `${verb || "bash"}: ${p}: ${code === "dir" ? "Is a directory" : code === "denied" ? "Permission denied" : code === "name" ? "Invalid argument" : "No such file or directory"}`;
      if (m === "ps") return code === "dir" ? `${verb || "Out-File"}: Access to the path '${p}' is denied.` : code === "denied" ? `${verb || "Out-File"}: Access to the path '${p}' is denied.` : code === "name" ? `${verb || "Out-File"}: The filename, directory name, or volume label syntax is incorrect. : '${p}'` : `${verb || "Out-File"}: Could not find a part of the path '${p}'.`;
      return code === "dir" || code === "denied" ? "Access is denied." : code === "name" ? "The filename, directory name, or volume label syntax is incorrect." : "The system cannot find the path specified.";
    }
    function readPath(p) {
      if (lc(p) === "nul" || p === "/dev/null") return { text: "" };
      if (mode() === "bash") { const v = VIRTUAL_ETC()[p]; if (v != null) return { text: v }; }
      const segs = segsFor(p); const h = segs && walk(segs);
      if (!h) return { err: mode() === "bash" ? `bash: ${p}: No such file or directory` : "The system cannot find the file specified." };
      if (isDir(h.node)) return { err: mode() === "bash" ? `bash: ${p}: Is a directory` : "Access is denied." };
      return { text: textOf(h.key, h.node), h };
    }
    async function runPipeline(stages, job) {
      let input = null, status = 0;
      for (let i = 0; i < stages.length; i++) {
        const st = stages[i]; const last = i === stages.length - 1;
        if (!st.words.length && !(st.out && mode() === "bash")) { syntaxError(mkIO(job, null, null)); return 1; }
        if (st.inFile) { const r = readPath(st.inFile); if (r.err) { emit(r.err, COL.red); return 1; } input = r.text; }
        const target = st.out ? st.out.path : null;
        const toCon = target && lc(target) === "con";
        const sink = (!last || (st.out && !toCon)) ? [] : null;
        const io = mkIO(job, sink, input, st.errNull);
        status = st.words.length ? await runStage(st, io) : 0;
        if (job.dead || closed) return status;
        input = sink ? sink.join("\n") : null;
        if (st.out && !toCon && lc(target) !== "nul" && target !== "/dev/null") {
          const segs = segsFor(target);
          const text = sink.length ? sink.join("\n") + "\n" : "";
          const w = segs ? writeAt(segs, text, st.out.append) : "path";
          if (w) { emit(fsErr(w, mode() === "bash" ? target : segs ? show(segs) : target), COL.red); status = 1; }
        }
      }
      return status;
    }
    async function runStage(st, io) {
      const m = mode(); const words = st.words;
      let name = words[0].v, args = words.slice(1);
      if (m !== "bash" && !words[0].q) {
        const mm = /^(cd|chdir)([.\\/].*)$/i.exec(name);
        if (mm) { name = mm[1]; args = [{ t: "w", v: mm[2], raw: mm[2], q: false, s: words[0].s + mm[1].length, e: words[0].e }].concat(args); }
        if (m === "cmd" && /^echo[.:(]$/i.test(name)) { io.out(""); return 0; }
      }
      if (m !== "bash" && /^[a-z]:$/i.test(name)) { if (lc(name) === "c:") return 0; io.err("The system cannot find the drive specified."); return 1; }
      const c = { name, words, args, a: args.map((t) => t.v), io, st, raw: () => (args.length ? st.src.slice(args[0].s, args[args.length - 1].e) : "") };
      if (m === "bash") return runBash(c);
      if (m === "ps") return runPS(c);
      return runCmd(c);
    }

    // ---------------------------------------------------------------- shared commands
    function splitOpts(a) {   // cmd-style /x switches
      const flags = {}, rest = [];
      a.forEach((x) => {
        if (/^(\/[A-Za-z?][A-Za-z0-9-]*(:[^\/]*)?)+$/.test(x)) {
          x.split(/(?=\/)/).forEach((f) => { const k = f.slice(1); const i = k.indexOf(":"); if (i >= 0) flags[lc(k.slice(0, i))] = k.slice(i + 1); else flags[lc(k)] = true; });
        } else rest.push(x);
      });
      return { flags, rest };
    }
    function resolveMany(p) {   // wildcard-aware: [{h, segs}] ; null when parent path missing
      const segs = segsFor(p); if (!segs) return null;
      const last = segs[segs.length - 1];
      if (last && hasWild(last)) {
        const par = walk(segs.slice(0, -1)); if (!par || !isDir(par.node)) return null;
        const re = rx(fixWildDot(last));
        return entries(par).filter(([n]) => re.test(n)).map(([n, node]) => ({ h: childH(par, n, node), name: n }));
      }
      const h = walk(segs);
      return h ? [{ h, name: h.canon[h.canon.length - 1] }] : [];
    }
    function evalMath(expr) {
      const e = String(expr).replace(/\s+/g, "");
      if (!e || /[^0-9+\-*/().%e]/i.test(e)) throw new Error("Invalid expression");
      const v = Function('"use strict";return (' + e + ")")();
      if (typeof v !== "number" || !isFinite(v)) throw new Error("Invalid result");
      return Math.round(v * 1e10) / 1e10;
    }
    async function doCurl(c, saveTo) {
      const io = c.io; const a = c.a;
      let outFile = saveTo != null ? saveTo : null, head = false, silent = false, url = null;
      for (let i = 0; i < a.length; i++) {
        const x = a[i];
        if (x === "-o" || x === "--output" || lc(x) === "-outfile") outFile = a[++i];
        else if (x === "-O" || x === "--remote-name") outFile = "";
        else if (x === "-I" || x === "--head") head = true;
        else if (x === "-s" || x === "--silent" || x === "-L" || x === "-q") silent = x === "-s" || x === "--silent" || x === "-q" ? true : silent;
        else if (!x.startsWith("-") && !url) url = x;
      }
      if (!url) { io.err("usage: curl [-o file] [-I] <url>   e.g. curl https://api.ipify.org"); return 2; }
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      if (outFile === "") { try { outFile = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "") || "index.html"; } catch (_) { outFile = "index.html"; } }
      if (!silent && !outFile) io.out("*   Trying " + url + " ...", COL.gray);
      let r;
      try { r = await fetch(url, head ? { method: "HEAD" } : undefined); }
      catch (e) { io.err("curl: (6) Could not reach " + url + " (offline, or the site blocks cross-origin requests). " + (e && e.message ? e.message : "")); return 6; }
      io.check();
      if (head) { io.out("HTTP/2 " + r.status + " " + (r.statusText || "")); r.headers.forEach((v, k) => io.out(k + ": " + v)); return r.ok ? 0 : 22; }
      const t = await r.text(); io.check();
      if (outFile) {
        const segs = segsFor(outFile); const w = segs ? writeAt(segs, t, false) : "path";
        if (w) { io.err(fsErr(w, outFile)); return 23; }
        io.out(`'${show(segs)}' saved [${num(t.length)} bytes]  (HTTP ${r.status})`, r.ok ? COL.green : COL.yellow);
        return r.ok ? 0 : 22;
      }
      if (!silent) io.out("< HTTP " + r.status + " " + (r.statusText || ""), r.ok ? COL.green : COL.yellow);
      io.out(t.length > 20000 ? t.slice(0, 20000) : t);
      if (t.length > 20000) io.out("... (" + num(t.length) + " bytes total, truncated)", COL.gray);
      return r.ok ? 0 : 22;
    }
    async function resolveHost(host) {
      if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
      if (/^(localhost|win12-pc|windows12\.local)$/i.test(host)) return "127.0.0.1";
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 4000);
      try {
        const r = await fetch("https://cloudflare-dns.com/dns-query?name=" + encodeURIComponent(host) + "&type=A", { headers: { accept: "application/dns-json" }, signal: ctl.signal });
        const j = await r.json(); const a = (j.Answer || []).filter((x) => x.type === 1);
        return a.length ? a[a.length - 1].data : null;
      } catch (_) { return null; } finally { clearTimeout(tm); }
    }
    async function probe(host) {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 4000); const t0 = performance.now();
      try { await fetch("https://" + host + "/favicon.ico?_=" + Date.now(), { mode: "no-cors", cache: "no-store", signal: ctl.signal }); return Math.max(1, Math.round(performance.now() - t0)); }
      catch (_) { return null; } finally { clearTimeout(tm); }
    }
    async function doPing(c, linux) {
      const io = c.io, a = c.a;
      let host = null, count = 4;
      for (let i = 0; i < a.length; i++) { const x = lc(a[i]); if (x === "-t") count = Infinity; else if (x === "-n" || x === "-c" || x === "-count") count = Math.max(1, parseInt(a[++i], 10) || 4); else if (!x.startsWith("-") && !x.startsWith("/")) host = a[i]; }
      if (!host) { io.out(linux ? "ping: usage error: Destination address required" : "Usage: ping [-t] [-n count] target_name"); return 1; }
      if (linux && !a.some((x) => x === "-c")) count = Infinity;
      const local = /^(localhost|127\.\d+\.\d+\.\d+|::1|win12-pc|windows12\.local)$/i.test(host);
      const ip = await resolveHost(host); io.check();
      if (!ip) { io.out(linux ? `ping: ${host}: Name or service not known` : `Ping request could not find host ${host}. Please check the name and try again.`); return 1; }
      io.out(linux ? `PING ${host} (${ip}) 56(84) bytes of data.` : `\nPinging ${host}${ip !== host ? " [" + ip + "]" : ""} with 32 bytes of data:`);
      const times = []; let sent = 0;
      for (let i = 0; i < count; i++) {
        if (i) await io.sleep(Math.max(50, 1000 - (times[times.length - 1] || 0)));
        sent++;
        const t = local ? 0 : await probe(host); io.check();
        if (t == null) io.out(linux ? `From ${ip} icmp_seq=${i + 1} Destination Host Unreachable` : "Request timed out.");
        else { times.push(t); io.out(linux ? `64 bytes from ${ip}: icmp_seq=${i + 1} ttl=${local ? 64 : 117} time=${t || 0.04} ms` : `Reply from ${ip}: bytes=32 time${t ? "=" + t : "<1"}ms TTL=${local ? 128 : 117}`); }
      }
      const lost = sent - times.length;
      if (linux) { io.out(`\n--- ${host} ping statistics ---`); io.out(`${sent} packets transmitted, ${times.length} received, ${Math.round(lost / sent * 100)}% packet loss`); }
      else {
        io.out(`\nPing statistics for ${ip}:`); io.out(`    Packets: Sent = ${sent}, Received = ${times.length}, Lost = ${lost} (${Math.round(lost / sent * 100)}% loss),`);
        if (times.length) { io.out("Approximate round trip times in milli-seconds:"); io.out(`    Minimum = ${Math.min(...times)}ms, Maximum = ${Math.max(...times)}ms, Average = ${Math.round(times.reduce((x, y) => x + y, 0) / times.length)}ms`); }
      }
      return times.length ? 0 : 1;
    }
    async function doNslookup(c) {
      const host = c.a.find((x) => !x.startsWith("-")); const io = c.io;
      io.out("Server:  cloudflare-dns.com"); io.out("Address:  1.1.1.1"); io.out("");
      if (!host) return 0;
      const ip = await resolveHost(host); io.check();
      if (!ip) { io.err(`*** cloudflare-dns.com can't find ${host}: Non-existent domain`); return 1; }
      io.out("Non-authoritative answer:"); io.out("Name:    " + host); io.out("Address:  " + ip); return 0;
    }
    function ipconfig(c) {
      const io = c.io, all = c.a.some((x) => lc(x) === "/all"), t = TS(), on = navigator.onLine !== false;
      const conn = navigator.connection || {};
      const sw = (c.a[0] || "").toLowerCase();
      if (sw === "/flushdns") { io.out("\nWindows IP Configuration\n\nSuccessfully flushed the DNS Resolver Cache."); return 0; }
      if (sw === "/release" || sw === "/renew") { io.out("\nWindows IP Configuration\n"); io.out(sw === "/release" ? "Wi-Fi adapter released its address. Run 'ipconfig /renew' to get one again." : "Wi-Fi:\n   IPv4 Address. . . . . . . . . . . : " + t.ip); return 0; }
      io.out("\nWindows IP Configuration\n");
      if (all) { io.out(`   Host Name . . . . . . . . . . . . : ${HOSTNAME}\n   Primary Dns Suffix  . . . . . . . : \n   Node Type . . . . . . . . . . . . : Hybrid\n   IP Routing Enabled. . . . . . . . : No\n`); }
      io.out("Wireless LAN adapter Wi-Fi:\n");
      if (!on) { io.out("   Media State . . . . . . . . . . . : Media disconnected\n   Connection-specific DNS Suffix  . : "); return 0; }
      if (all) io.out(`   Description . . . . . . . . . . . : Cameron Virtual Wi-Fi 7 Adapter\n   Physical Address. . . . . . . . . : ${t.mac}\n   DHCP Enabled. . . . . . . . . . . : Yes`);
      io.out(`   Connection-specific DNS Suffix  . : home\n   IPv4 Address. . . . . . . . . . . : ${t.ip}\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.1.1`);
      if (all) io.out(`   DNS Servers . . . . . . . . . . . : 1.1.1.1\n                                       8.8.8.8\n   Link speed (browser estimate) . . : ${conn.downlink ? conn.downlink + " Mbps (" + (conn.effectiveType || "") + ")" : "unknown"}`);
      return 0;
    }
    function systeminfo(c) {
      const io = c.io; const d = S();
      const mem = navigator.deviceMemory ? navigator.deviceMemory * 1024 : 8192;
      const heap = performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
      const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return "UTC"; } })();
      const boot = new Date(performance.timeOrigin || Date.now() - performance.now());
      const rows = [["Host Name", HOSTNAME], ["OS Name", "Microsoft Windows 12 Pro"], ["OS Version", VERSION + " N/A Build 2026"], ["OS Manufacturer", "Microsoft Corporation"], ["OS Configuration", "Standalone Workstation"], ["OS Build Type", "Multiprocessor Free"], ["Registered Owner", (d.profile && d.profile.username) || "User"], ["Product ID", d.productKey ? String(d.productKey).slice(0, 23) : "00330-80000-00000-AA000"], ["Original Install Date", dosDate(TS().epoch).replace("  ", ", ")], ["System Boot Time", dosDate(boot.getTime()).replace("  ", ", ")], ["System Manufacturer", "Cameron Systems"], ["System Model", "Windows 12 Web PC (" + (navigator.platform || "browser") + ")"], ["System Type", "x64-based PC"], ["Processor(s)", `1 Processor(s) Installed.\n${" ".repeat(27)}[01]: ${navigator.hardwareConcurrency || 4} logical processors`], ["Windows Directory", "C:\\Windows"], ["System Directory", "C:\\Windows\\system32"], ["System Locale", navigator.language || "en-US"], ["Time Zone", tz], ["Total Physical Memory", num(mem) + " MB"], ["Available Physical Memory", heap != null ? num(Math.max(0, mem - heap)) + " MB" : "unknown"], ["Disk C: free space", num(DISK.free) + " bytes of " + num(DISK.total)], ["Display", `${screen.width} x ${screen.height} @ ${window.devicePixelRatio || 1}x`], ["Network Card(s)", navigator.onLine === false ? "Wi-Fi: Media disconnected" : "Wi-Fi: Connected, IP " + TS().ip], ["Browser (host)", navigator.userAgent]];
      rows.forEach(([k, v]) => io.out((k + ":").padEnd(27) + v));
      return 0;
    }
    function tasklist(c) {
      const io = c.io;
      const ws = windowsList();
      io.out(""); io.out("Image Name                     PID Session Name        Session#    Mem Usage"); io.out("========================= ======== ================ =========== ============");
      const row = (n, pid, s, sn, mem) => io.out(n.slice(0, 25).padEnd(25) + String(pid).padStart(9) + " " + s.padEnd(16) + String(sn).padStart(12) + (num(mem) + " K").padStart(13));
      SYS_PROCS.forEach(([n, pid, mem]) => row(n, pid, pid < 1000 ? "Services" : "Console", pid < 1000 ? 0 : 1, mem));
      ws.forEach((w) => row(w.image, w.pid, "Console", 1, w.mem));
      return 0;
    }
    function taskkill(c) {
      const io = c.io, a = c.a; let im = null, pid = null, force = false;
      for (let i = 0; i < a.length; i++) { const x = lc(a[i]); if (x === "/im") im = a[++i]; else if (x === "/pid") pid = parseInt(a[++i], 10); else if (x === "/f") force = true; else if (x === "/t") { /* tree */ } }
      if (im == null && pid == null) { io.err('ERROR: Invalid syntax. Neither /FI nor /PID nor /IM were specified.\nType "TASKKILL /?" for usage.'); return 1; }
      const sys = SYS_PROCS.filter(([n, p]) => (pid != null ? p === pid : rx(/\./.test(im) ? im : im + ".exe").test(n) || lc(n) === lc(im)));
      if (sys.length) {
        const [n, p] = sys[0];
        if (force && CRITICAL.includes(lc(n))) { io.out(`SUCCESS: The process "${n}" with PID ${p} has been terminated.`); crash(); return 0; }
        io.err(`ERROR: The process "${n}" with PID ${p} could not be terminated.\nReason: ${force || !CRITICAL.includes(lc(n)) ? "Access is denied." : "This process can only be terminated forcefully (with /F option)."}`); return 1;
      }
      const ws = windowsList().filter((w) => (pid != null ? w.pid === pid : (rx(/\.exe$/i.test(im) || hasWild(im) ? im : im + ".exe").test(w.image) || lc(w.title) === lc(im) || lc(w.title.split(/\s+[-–—]\s+/).pop()) === lc(im))));
      if (!ws.length) { io.err(pid != null ? `ERROR: The process "${pid}" not found.` : `ERROR: The process "${im}" not found.`); return 128; }
      let ok = 0;
      ws.forEach((w) => {
        if (w.el.contains(termEl)) { io.out(`SUCCESS: The process "${w.image}" with PID ${w.pid} has been terminated.`); ok++; setTimeout(() => winRef.close(), 200); return; }
        if (closeWin(w)) { ok++; io.out(force ? `SUCCESS: The process "${w.image}" with PID ${w.pid} has been terminated.` : `SUCCESS: Sent termination signal to the process "${w.image}" with PID ${w.pid}.`); }
        else io.err(`ERROR: The process "${w.image}" with PID ${w.pid} could not be terminated.\nReason: This process is protected.`);
      });
      return ok ? 0 : 1;
    }
    function startThing(c, target, rest) {
      const io = c.io;
      if (!target) { launchApp("terminal"); return 0; }
      if (/^https?:\/\//i.test(target) || /^www\./i.test(target)) { const u = /^https?:/i.test(target) ? target : "https://" + target; if (window.Browser && window.Browser.openTo) window.Browser.openTo(u); else window.open(u, "_blank", "noopener"); return 0; }
      const segs = segsFor(target); const h = segs && walk(segs);
      if (h) {
        if (isDir(h.node)) { openExplorerAt(h.canon); return 0; }
        const id = /\.exe$/i.test(h.key) && findApp(h.key);
        if (id) { launchApp(id); return 0; }
        if (/\.(exe|dll|sys|com)$/i.test(h.key)) { io.err("This app can't run on your PC. (" + h.key + ")"); return 1; }
        if (window.VFS && window.VFS.openNode) { window.VFS.openNode(h.key, h.node); return 0; }
      }
      const id = findApp(target);
      if (id) { launchApp(id); return 0; }
      if (mode() === "ps") io.err(`Start-Process: This command cannot be run due to the error: The system cannot find the file specified.`);
      else io.err(`Windows cannot find '${target}'. Make sure you typed the name correctly, and then try again.`);
      return 1;
    }
    function openExplorerAt(canon) {
      const path = atHome(canon) ? canon.slice(2) : [SYS].concat(canon);
      window.FilesStartPath = path.length ? path : null;
      launchApp("fileexplorer");
    }
    function shutdown(c) {
      const io = c.io, a = c.a.map(lc);
      const tIdx = a.indexOf("/t"); const secs = tIdx >= 0 ? Math.max(0, parseInt(a[tIdx + 1], 10) || 0) : (a.includes("/s") || a.includes("/r") ? 1 : 0);
      if (a.includes("/a")) { if (shutdownTimer) { clearTimeout(shutdownTimer); shutdownTimer = null; io.out("The scheduled shutdown was cancelled."); return 0; } io.err("Unable to abort the system shutdown because no shutdown was in progress.(1116)"); return 1; }
      const act = a.includes("/r") || a.includes("/g") ? "r" : a.includes("/s") || a.includes("/p") ? "s" : a.includes("/l") ? "l" : a.includes("/h") ? "h" : null;
      if (a.includes("/o") && act !== "r") { io.err("The /o option must be used with /r.(87)"); return 1; }
      if (!act) { io.out("Usage: shutdown [/s | /r | /l | /h | /a] [/o] [/t xxx]\n\n    /s   Shut down the computer.\n    /r   Full shutdown and restart the computer.\n    /l   Log off (lock).\n    /h   Hibernate (sleep).\n    /a   Abort a pending shutdown (during /t).\n    /o   With /r: restart to the Advanced Startup (recovery) menu.\n    /t xxx  Set the time-out period before shutdown to xxx seconds."); return 0; }
      const run = () => {
        shutdownTimer = null;
        if (act === "r" && a.includes("/o") && window.Recovery) window.Recovery.restartToWinRE();
        else if (act === "r") location.reload();
        else if (act === "s") { const off = document.createElement("div"); off.className = "power-off"; (document.getElementById("screen") || document.body).appendChild(off); setTimeout(() => location.reload(), 1400); }
        else if (act === "l" && window.Accounts) window.Accounts.signOut();
        else if (act === "l" || act === "h") { if (window.Lock) window.Lock.run(() => {}); }
      };
      if (secs > 1) io.out(`Windows will ${act === "r" ? "restart" : act === "s" ? "shut down" : "sign out"} in ${secs} seconds. Run 'shutdown /a' to cancel.`, COL.yellow);
      if (shutdownTimer) clearTimeout(shutdownTimer);
      shutdownTimer = setTimeout(run, secs * 1000);
      return 0;
    }
    function hasSys32Ok() { const h = walk(["Windows", "System32"]); return !!h && isDir(h.node) && Object.keys(h.node.children).length >= 10 && !S().systemBroken; }
    function repairSys32() {   // like sfc: put back what's missing, keep everything else
      const FP = window.FilesParts; if (!FP) return 0; let fixed = 0;
      const fresh = FP.WIN_FS()[SYS]; const r = R(); if (!r[SYS]) { r[SYS] = fresh; return 999; }
      (function merge(dst, src, depth) { Object.keys(src.children).forEach((k) => { if (!dst.children[k]) { dst.children[k] = src.children[k]; fixed += isDir(src.children[k]) ? countTree(src.children[k]).files + 1 : 1; } else if (isDir(dst.children[k]) && isDir(src.children[k]) && depth < 3 && (depth > 0 || k === "Windows")) merge(dst.children[k], src.children[k], depth + 1); }); })(r[SYS], { children: { Windows: fresh.children.Windows } }, 0);
      S().systemBroken = false; save(); return fixed;
    }
    async function sfc(c) {
      const io = c.io, sw = lc(c.a[0] || "");
      if (sw !== "/scannow" && sw !== "/verifyonly") { io.out("Usage: sfc /scannow | /verifyonly\n\n/SCANNOW     Scans integrity of all protected system files and repairs files with problems when possible.\n/VERIFYONLY  Scans integrity of all protected system files. No repair operation is performed."); return 0; }
      io.out("\nBeginning system scan.  This process will take some time.\n\nBeginning verification phase of system scan.");
      for (const p of [12, 25, 47, 60, 84, 100]) { await io.sleep(380); io.out(`Verification ${p}% complete.`); }
      const ok = hasSys32Ok() && walk(["Windows", "System32", "kernel32.dll"]) && walk(["Windows", "System32", "ntoskrnl.exe"]);
      io.out("");
      if (ok) { io.out("Windows Resource Protection did not find any integrity violations. C:\\Windows\\System32 is intact.", COL.green); return 0; }
      if (sw === "/verifyonly") { io.warn("Windows Resource Protection found integrity violations in C:\\Windows\\System32. Run 'sfc /scannow' to repair them."); return 1; }
      const n = repairSys32();
      io.out(`Windows Resource Protection found corrupt files and successfully repaired them (${n} item(s) restored). C:\\Windows\\System32 restored.`, COL.green);
      return 0;
    }
    async function chkdsk(c) {
      const io = c.io, fix = c.a.some((x) => /^\/(f|r)$/i.test(x));
      io.out("The type of the file system is NTFS.\nVolume label is Local Disk.\n");
      if (fix) {
        io.out("Cannot lock current drive.\n\nChkdsk cannot run because the volume is in use by another\nprocess.");
        const ans = await io.ask("Would you like to schedule this volume to be\nchecked the next time the system restarts? (Y/N) ");
        io.out(/^y/i.test(ans) ? "\nThis volume will be checked the next time the system restarts." : "");
        return 0;
      }
      io.out("WARNING!  /F parameter not specified.\nRunning CHKDSK in read-only mode.\n");
      const cRoot = walk([]); const tC = countTree(cRoot.node), tH = countTree({ type: "folder", children: Object.fromEntries(entries(walk(HOME())).map(([k, n]) => [k, n])) });
      const files = tC.files + tH.files, dirs = tC.dirs + tH.dirs + 1, bytes = tC.bytes + tH.bytes;
      io.out("Stage 1: Examining basic file system structure ..."); await io.sleep(500);
      io.out(`  ${num(files + dirs + 64)} file records processed.\nFile verification completed.`); await io.sleep(300);
      io.out("Stage 2: Examining file name linkage ..."); await io.sleep(500);
      io.out(`  ${num(dirs + 12)} index entries processed.\nIndex verification completed.`);
      io.out("Stage 3: Examining security descriptors ..."); await io.sleep(400);
      io.out("Security descriptor verification completed.\n");
      if (!hasSys32Ok()) io.warn("Windows found problems with C:\\Windows\\System32.\nRun 'sfc /scannow' to repair them.\n");
      else io.out("Windows has scanned the file system and found no problems.\nNo further action is required.\n");
      const kb = (b) => num(Math.ceil(b / 1024)).padStart(16);
      io.out(`${kb(DISK.total)} KB total disk space.\n${kb(bytes)} KB in ${num(files)} files.\n${kb(dirs * 4096)} KB in ${num(dirs)} indexes.\n${kb(0)} KB in bad sectors.\n${kb(65536)} KB in use by the system.\n${kb(DISK.free)} KB available on disk.`);
      return 0;
    }
    function whereCmd(c) {
      const io = c.io; const { flags, rest } = splitOpts(c.a);
      if (!rest.length) { io.err("ERROR: A search pattern must be specified.\nType \"WHERE /?\" for usage."); return 2; }
      const found = [];
      if (flags.r) {
        const base = segsFor(typeof flags.r === "string" ? flags.r : rest.shift()); const h = base && walk(base);
        if (!h) { io.err("ERROR: The system cannot find the path specified."); return 2; }
        const pats = rest.map((p) => rx(p));
        (function g(hh) { entries(hh).forEach(([n, node]) => { const ch = childH(hh, n, node); if (!isDir(node) && pats.some((re) => re.test(n))) found.push(winPath(ch.canon)); if (isDir(node)) g(ch); }); })(h);
      } else {
        const dirs = (getEnv("PATH") || "").split(";").filter(Boolean).map((d) => winSegs(d, cwd())).filter(Boolean);
        dirs.unshift(cwd());
        const exts = ["", ".com", ".exe", ".bat", ".cmd", ".msc"];
        rest.forEach((p) => dirs.forEach((ds) => { const h = walk(ds); if (!h || !isDir(h.node)) return; entries(h).forEach(([n, node]) => { if (node.type === "file" && (hasWild(p) ? rx(p).test(n) : exts.some((e) => lc(n) === lc(p) + e))) { const w = winPath(h.canon.concat(n)); if (!found.includes(w)) found.push(w); } }); }));
      }
      if (!found.length) { io.err("INFO: Could not find files for the given pattern(s)."); return 1; }
      found.forEach((f) => io.out(f)); return 0;
    }
    function treeLines(h, files, ascii, bashStyle) {
      const lines = []; let nd = 0, nf = 0;
      (function g(hh, prefix) {
        const all = entries(hh).filter(([, n]) => !hidden(n));
        const fl = all.filter(([, n]) => !isDir(n)), dl = all.filter(([, n]) => isDir(n));
        if (bashStyle) {
          const list = all.filter(([, n]) => files || isDir(n));
          list.forEach(([n, node], i) => { const last = i === list.length - 1; lines.push(prefix + (last ? "└── " : "├── ") + n); if (isDir(node)) { nd++; g(childH(hh, n, node), prefix + (last ? "    " : "│   ")); } else nf++; });
          return;
        }
        if (files) { fl.forEach(([n]) => { lines.push(prefix + (dl.length ? "│   " : "    ") + n); nf++; }); if (fl.length) lines.push(prefix + (dl.length ? "│" : "")); }
        dl.forEach(([n, node], i) => { const last = i === dl.length - 1; nd++; lines.push(prefix + (last ? (ascii ? "\\---" : "└───") : (ascii ? "+---" : "├───")) + n); g(childH(hh, n, node), prefix + (last ? "    " : (ascii ? "|   " : "│   "))); });
      })(h, "");
      return { lines, nd, nf };
    }
    function attribCmd(c) {
      const io = c.io; const sets = c.a.filter((x) => /^[+-][rhsa]$/i.test(x)); const paths = c.a.filter((x) => !/^[+-][rhsa]$/i.test(x) && !x.startsWith("/"));
      const list = paths.length ? paths.flatMap((p) => { const r = resolveMany(p); if (!r || !r.length) { io.err(`File not found - ${p}`); return []; } return r; }) : entries(walk(cwd())).filter(([, n]) => !isDir(n)).map(([n, node]) => ({ h: childH(walk(cwd()), n, node), name: n }));
      list.forEach(({ h }) => {
        if (sets.length) {
          if (writeProtected(h.canon)) { io.err("Access denied - " + winPath(h.canon)); return; }
          let at = h.node.attr || "";
          sets.forEach((s) => { const f = s[1].toUpperCase(); if (f === "S" || f === "A") return; at = at.replace(f, ""); if (s[0] === "+") at += f; });
          h.node.attr = at; if (!at) delete h.node.attr;
          save(); return;
        }
        const n = h.node, A = isDir(n) ? " " : "A", Sy = n.kind === "system" ? "S" : " ";
        io.out(`${A}    ${Sy}${hidden(n) ? "H" : " "}${ro(n) ? "R" : " "}       ${winPath(h.canon)}`);
      });
      return 0;
    }
    function filesForSearch(p, recursive) {
      const segs = segsFor(p); if (!segs) return [];
      const last = segs[segs.length - 1] || "";
      const h0 = walk(segs);
      if (h0 && !isDir(h0.node)) return [{ h: h0, label: p }];
      if (h0 && isDir(h0.node) && !recursive) return [];
      const base = h0 && isDir(h0.node) ? h0 : walk(segs.slice(0, -1));
      const re = h0 && isDir(h0.node) ? /.*/ : rx(fixWildDot(last));
      const out = [];
      if (!base) return out;
      (function g(hh) { entries(hh).forEach(([n, node]) => { const ch = childH(hh, n, node); if (!isDir(node) && re.test(n)) out.push({ h: ch, label: recursive ? winPath(ch.canon) : n }); else if (isDir(node) && recursive) g(ch); }); })(base);
      return out;
    }
    function textLines(t) { const s = String(t || "").replace(/\r\n?/g, "\n"); return (s.endsWith("\n") ? s.slice(0, -1) : s).split("\n"); }
    function printText(io, t) { const s = String(t || "").replace(/\r\n?/g, "\n"); if (!s) return; io.out(s.endsWith("\n") ? s.slice(0, -1) : s); }
    function setColor(c) {
      const a = (c.a[0] || "").trim();
      const HEX = ["#0c0c0c", "#0037da", "#13a10e", "#3a96dd", "#c50f1f", "#881798", "#c19c00", "#cccccc", "#767676", "#3b78ff", "#16c60c", "#61d6d6", "#e74856", "#b4009e", "#f9f1a5", "#f2f2f2"];
      const NAMES = { green: "#16c60c", red: "#ff4b4b", blue: "#3a96ff", yellow: "#ffe000", white: "#ffffff", cyan: "#00ffff" };
      let bg = "#0c0c0c", f = null;
      if (!a) { f = COL.fg; delete promptEl.dataset.custom; }
      else if (NAMES[lc(a)]) f = NAMES[lc(a)];
      else if (/^[0-9a-f]{1,2}$/i.test(a)) { const s = a.length === 1 ? "0" + a : a; if (lc(s[0]) === lc(s[1])) return 1; bg = HEX[parseInt(s[0], 16)]; f = HEX[parseInt(s[1], 16)]; }
      else { c.io.err("Unknown color. Try: color 0A (hex bg/fg), or green, red, blue, yellow, white, cyan"); return 1; }
      fg = f; termEl.style.background = bg; termEl.style.color = f; cmd.style.color = f;
      if (a) promptEl.dataset.custom = f; promptEl.style.color = promptColor();
      if (a && NAMES[lc(a)]) c.io.out("Color set.", f);
      return 0;
    }
    // WSL: the Control Panel "Windows Subsystem for Linux" feature is appData.terminal.archInstalled
    // (js/systools.js). Turning it on makes both distros (Ubuntu, Arch) available.
    async function installArch(io, distro) {
      const nm = distro === "ubuntu" ? "Ubuntu" : "Arch Linux";
      if (TS().archInstalled) { io.out(`${nm} is already installed. Launch it with: ${distro === "ubuntu" ? "ubuntu (or wsl -d Ubuntu)" : "arch"}`, COL.green); TS().wslDefault = TS().wslDefault || distro; State.save(); return 0; }
      io.out(`Installing: Windows Subsystem for Linux\nInstalling ${nm} (WSL). It uses this PC's real files: / is C:\\ and ~ is your user folder.`, COL.green);
      const steps = distro === "ubuntu" ? ["Downloading: Ubuntu 24.04 LTS...", "Installing: Ubuntu...", "Creating default user...", "Configuring /etc/wsl.conf (interop, automount /mnt/c)..."] : ["Downloading Arch Linux rootfs...", ":: Synchronizing package databases...", "  core   is up to date", "  extra  is up to date", ":: Running pacstrap (base linux linux-firmware)...", ":: Configuring system (locale, keyring, fstab)...", ":: Finalizing installation..."];
      for (const l of steps) { await io.sleep(320); io.out(l); }
      TS().archInstalled = true; TS().wslDefault = distro || "arch"; State.save();
      io.out(`${nm} has been installed. Launch it with: ${distro === "ubuntu" ? "ubuntu" : "arch"}  (Terminal: open the Ubuntu profile from the tab dropdown)`, COL.green);
      return 0;
    }
    function enterArch(io, distro) {
      distro = distro === "ubuntu" ? "ubuntu" : "arch";
      if (!TS().archInstalled) { io.err(distro === "ubuntu" ? "Windows Subsystem for Linux has no installed distributions.\nInstall one with: wsl --install   (or turn on \"Windows Subsystem for Linux\" in Control Panel > Programs > Turn Windows features on or off)" : "Arch is not installed. Run: wsl --install arch"); return 1; }
      stack.push({ mode: "bash", cwd: HOME(), distro }); chromeForMode();
      io.out(distro === "ubuntu" ? "Welcome to Ubuntu 24.04.1 LTS on WSL. / is C:\\, ~ is your user folder. Type 'help'; 'exit' returns to Windows." : "Welcome to Arch Linux on WSL. / is C:\\, ~ is your user folder. Type 'help' or 'neofetch'; 'exit' returns to Windows.", distro === "ubuntu" ? COL.green : COL.arch);
      return 0;
    }
    function enterPS(io, ver) {
      ver = ver === "5.1" ? "5.1" : "7";
      stack.push({ mode: "ps", cwd: cwd().slice(), psv: ver }); chromeForMode();
      io.out(ver === "5.1" ? "Windows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved.\n\nType 'help' for commands. 'exit' returns to the previous shell." : "PowerShell 7.4.6\nType 'help' for commands. 'exit' returns to the previous shell.");
      return 0;
    }
    function enterCmd(io) { stack.push({ mode: "cmd", cwd: cwd().slice() }); chromeForMode(); io.out(`Microsoft Windows 12 [Version ${VERSION}]\n(c) Microsoft Corporation. All rights reserved.`); return 0; }
    function exitShell(io) {
      if (stack.length > 1) { const was = stack.pop(); chromeForMode(); if (was.mode === "bash") io.out("logout"); return 0; }
      if (mode() === "bash") io.out("logout");
      setTimeout(() => { if (o.close) o.close(); }, 0); return 0;
    }
    function doLast(c) {
      const u = mode() === "bash" ? archUser() : userName();
      c.io.out(`${u}     pts/0    192.168.1.5    ${new Date().toDateString()}   still logged in\n${u}     pts/0    192.168.1.5    ${new Date(Date.now() - 864e5).toDateString()} - down\nreboot   system   boot ${mode() === "bash" ? "6.9.1-arch1-1" : "Windows 12"}   ${new Date(Date.now() - 864e5).toDateString()}\n\nwtmp begins ${new Date(Date.now() - 6048e5).toDateString()}`);
      return 0;
    }
    const doWho = (c) => { c.io.out(`${mode() === "bash" ? archUser() : userName()}   pts/0   ${State.formatClock()}`); return 0; };
    function update(c) {
      const io = c.io; io.out("Checking for updates…");
      return fetch(location.pathname + "?u=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.text() : Promise.reject()))
        .then(() => { io.out("Update server reached. Applying the latest version…", COL.green); setTimeout(() => location.reload(), 800); return 0; })
        .catch(() => { io.warn("Offline, or running from a read-only disc — no update available right now."); io.out("The live version auto-updates when you're online."); return 1; });
    }
    function kiosk(c) { const on = lc(c.a[0]) !== "off"; if (window.setKiosk) window.setKiosk(on); c.io.out("Kiosk mode " + (on ? "enabled" : "disabled") + ".", COL.green); return 0; }
    function a11y(c) { const on = lc(c.a[0]) !== "off"; const d = (S().appData.a11y = S().appData.a11y || {}); d.on = on; d.contrast = d.bigText = d.reduceMotion = true; State.save(); if (window.applyTheme) window.applyTheme(); c.io.out("Accessibility mode " + (on ? "on" : "off") + ".", COL.green); return 0; }
    function theme(c) { const t = lc(c.a[0]); if (["auto", "light", "dark"].indexOf(t) < 0) { c.io.err("Usage: theme auto|light|dark"); return 1; } S().theme = t; State.save(); if (window.applyTheme) window.applyTheme(); if (window.applyWallpaper) window.applyWallpaper(); c.io.out("Theme set to " + t + ".", COL.green); return 0; }
    function openApp(c) { const id = c.a[0]; if (!id) { c.io.err("Usage: open <app>"); return 1; } const real = findApp(id) || id; try { window.WM.open(real); c.io.out("Opened " + id, COL.green); return 0; } catch (e) { c.io.err("Unknown app: " + id); return 1; } }
    function weather(c) { const cs = ["Sunny", "Partly cloudy", "Cloudy", "Light rain", "Clear"]; c.io.out(`${S().region}: ${cs[Math.floor(Math.random() * cs.length)]}, ${12 + Math.floor(Math.random() * 20)}°`); return 0; }
    function calc(c) {
      if (!c.a.length) { launchApp("calculator"); return 0; }
      const expr = c.a.join(" ").replace(/[^0-9+\-*/().% ]/g, "");
      try { c.io.out(String(evalMath(expr))); return 0; } catch (e) { c.io.err("Error: " + e.message); return 1; }
    }
    function wsl(c) {
      const s = lc(c.a.join(" "));
      const pick = (t) => (/ubuntu/.test(t) ? "ubuntu" : /arch/.test(t) ? "arch" : null);
      if (lc(c.name) === "install") { if (/arch|ubuntu/.test(s)) return installArch(c.io, pick(s)); c.io.warn("Usage: install arch   (or: wsl --install)"); return 1; }
      if (/(^|\s)--install\b/.test(s)) return installArch(c.io, pick(s) || "ubuntu");
      if (/^(-l|--list)/.test(s)) {
        c.io.out("Windows Subsystem for Linux Distributions:");
        if (!TS().archInstalled) { c.io.out("(none) Install one with: wsl --install   (Ubuntu)   or: wsl --install arch"); return 0; }
        const def = TS().wslDefault || "arch";
        if (/-v|--verbose/.test(s)) { c.io.out("  NAME      STATE           VERSION"); [["ubuntu", "Ubuntu"], ["arch", "Arch"]].forEach(([k, n]) => c.io.out(`${k === def ? "*" : " "} ${n.padEnd(9)} Stopped         2`)); }
        else { c.io.out(def === "ubuntu" ? "Ubuntu (Default)\nArch" : "Arch (Default)\nUbuntu"); }
        return 0;
      }
      if (/^--status/.test(s)) { c.io.out(TS().archInstalled ? `Default Distribution: ${(TS().wslDefault || "arch") === "ubuntu" ? "Ubuntu" : "Arch"}\nDefault Version: 2` : "The Windows Subsystem for Linux optional component is not enabled. Turn it on in Control Panel > Programs > Turn Windows features on or off, or run: wsl --install"); return 0; }
      if (/^(-v|--version)$/.test(s)) { c.io.out("WSL version: 2.3.26.0\nKernel version: 5.15.167.4-1\nWindows version: " + VERSION); return 0; }
      if (/^--shutdown/.test(s)) return 0;
      const m = /^(?:-d|--distribution)\s+(\S+)/.exec(s);
      if (m) { const d = pick(m[1]); if (!d) { c.io.err("There is no distribution with the supplied name.\nError code: Wsl/Service/WSL_E_DISTRO_NOT_FOUND"); return 1; } return enterArch(c.io, d); }
      if (!s) return enterArch(c.io, TS().wslDefault || "arch");
      c.io.warn("Usage: wsl [--install [-d Ubuntu|Arch]] [-d <distro>] [-l -v] [--status]   (then run: ubuntu or arch)"); return 1;
    }
    function historyCmd(c) { hist.forEach((h, i) => c.io.out(`${String(i + 1).padStart(5)}  ${h}`)); return 0; }
    async function timeoutCmd(c) {
      const io = c.io; const i = c.a.findIndex((x) => lc(x) === "/t"); const n = parseInt(i >= 0 ? c.a[i + 1] : c.a[0], 10);
      if (isNaN(n)) { io.err("ERROR: Invalid syntax. Default option is not allowed more than '1' time(s).\nType \"TIMEOUT /?\" for usage."); return 1; }
      for (let s = n; s > 0; s--) { io.out(`Waiting for ${s} seconds, press CTRL+C to quit ...`); await io.sleep(1000); }
      io.out("Waiting for 0 seconds, press CTRL+C to quit ..."); return 0;
    }
    function clip(c) { const t = c.io.stdin != null ? c.io.stdin : c.raw(); try { navigator.clipboard.writeText(t); } catch (_) {} return 0; }
    // Bash virtual files
    function VIRTUAL_ETC() {
      if (isUbuntu()) return { "/etc/os-release": `PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04.1 LTS (Noble Numbat)"\nVERSION_CODENAME=noble\nID=ubuntu\nID_LIKE=debian\nHOME_URL="https://www.ubuntu.com/"`, "/etc/hostname": HOSTNAME, "/proc/version": "Linux version 5.15.167.4-microsoft-standard-WSL2 (root@f9c826d3017f) (gcc (GCC) 11.2.0) #1 SMP", "/etc/shells": "/bin/sh\n/bin/bash\n/usr/bin/bash", "/etc/wsl.conf": "[boot]\nsystemd=true\n\n[automount]\nenabled=true\nroot=/mnt/", "/proc/cpuinfo": `processor\t: 0\nmodel name\t: Cameron Virtual CPU\ncpu cores\t: ${navigator.hardwareConcurrency || 4}` };
      return { "/etc/os-release": `NAME="Arch Linux"\nPRETTY_NAME="Arch Linux"\nID=arch\nBUILD_ID=rolling\nANSI_COLOR="38;2;23;147;209"\nHOME_URL="https://archlinux.org/"`, "/etc/hostname": "arch", "/proc/version": "Linux version 6.9.1-arch1-1 (linux@archlinux) (gcc (GCC) 14.1.1) #1 SMP PREEMPT_DYNAMIC", "/etc/shells": "/bin/sh\n/bin/bash", "/proc/cpuinfo": `processor\t: 0\nmodel name\t: Cameron Virtual CPU\ncpu cores\t: ${navigator.hardwareConcurrency || 4}` };
    }

    // ================================================================ cmd.exe
    const CMD_HELP = [
      ["ATTRIB", "Displays or changes file attributes (+R -R +H -H)."], ["CD / CHDIR", "Displays the name of or changes the current directory (cd.., cd \\)."], ["CHKDSK", "Checks the disk and displays a status report (/f)."], ["CLIP", "Copies piped output to the clipboard (dir | clip)."], ["CLS", "Clears the screen."], ["CMD", "Starts a new instance of the command interpreter."], ["COLOR", "Sets console colors: color 0A, or color green."], ["COPY", "Copies one or more files (wildcards, /y)."], ["DATE / TIME", "Displays the date / time (/t)."], ["DEL / ERASE", "Deletes one or more files (/s /q /f)."], ["DIR", "Lists files and subfolders with sizes and dates (/s /b /w /a)."], ["ECHO", "Displays messages; echo text > file, echo text >> file."], ["EXIT", "Quits the current shell (closes Terminal from cmd)."], ["FC", "Compares two files and displays the differences."], ["FIND", "Searches for a text string: find \"txt\" file, dir | find \"x\"."], ["FINDSTR", "Searches for strings in files (/i /n /s /r /c:\"text\")."], ["HELP", "Provides help: help, or <command> /?."], ["HOSTNAME", "Prints the computer name."], ["IPCONFIG", "Network configuration (/all /flushdns)."], ["MD / MKDIR", "Creates a directory (and parents)."], ["MORE", "Displays output one screen at a time."], ["MOVE", "Moves files and folders, or renames folders."], ["NSLOOKUP", "Looks up a domain name (real DNS-over-HTTPS)."], ["PATH", "Displays or sets the search path."], ["PAUSE", "Waits for Enter."], ["PING", "Real HTTP round-trip check to a host (-n N, -t until Ctrl+C)."], ["RD / RMDIR", "Removes a directory (/s /q)."], ["REN / RENAME", "Renames files (ren *.txt *.md works)."], ["SET / SETX", "Shows, sets or removes environment variables (set /a, set /p)."], ["SHUTDOWN", "/s shut down, /r restart, /l sign out, /t N, /a abort."], ["SORT", "Sorts input (/r)."], ["START", "Opens an app, file, folder or URL."], ["SYSTEMINFO", "Shows real details about this PC and browser."], ["TASKKILL", "Closes an open window: taskkill /im notepad.exe, /pid N, /f."], ["TASKLIST", "Lists running processes and open windows."], ["TIMEOUT", "Waits N seconds (timeout /t 5); Ctrl+C stops it."], ["TITLE", "Sets the window title."], ["TREE", "Graphically displays the folder structure (/f /a)."], ["TYPE", "Displays the contents of a text file."], ["VER", "Displays the Windows version."], ["WHERE", "Finds files on the PATH, or /r dir pattern."], ["WHOAMI", "Prints the current user."], ["XCOPY", "Copies files and directory trees."],
    ];
    const W12_HELP = [["calc <expr>", "Calculator: calc (2+3)*4  (no args opens Calculator)"], ["curl / wget <url>", "Real HTTP request (-o file saves to disk; wget saves)"], ["open <app>", "Open an app: browser, settings, notepad, copilot..."], ["update", "Get the latest version (when online)"], ["theme auto|light|dark", "Appearance (auto follows your device)"], ["kiosk on|off", "Full-screen single-app lock"], ["accessibility on|off", "High contrast, bigger text, less motion (a11y)"], ["sfc /scannow", "Check & repair C:\\Windows\\System32"], ["factory-reset", "Reset Windows 12 to factory settings"], ["win12 [/fresh]", "Run Windows 12 inside Windows 12 (a VM; /fresh = clean install)"], ["powershell / pwsh", "Start PowerShell (exit returns here)"], ["wsl --install arch", "Install Arch Linux, then run: arch (or wsl / bash)"], ["weather, calendar, last, who, history", "Misc"]];
    function cmdHelp(c) {
      const io = c.io;
      if (c.a[0]) { const n = lc(c.a[0]); const row = CMD_HELP.find(([k]) => k.split(" / ").some((x) => lc(x) === n)); io.out(row ? row[0] + "\n    " + row[1] : `This command is not supported by the help utility.  Try "${n} /?".`); return 0; }
      io.out("For more information on a specific command, type HELP command-name\n");
      CMD_HELP.forEach(([k, d]) => io.out(k.padEnd(15) + d));
      io.out("\nWindows 12 extras:", COL.green);
      W12_HELP.forEach(([k, d]) => io.out("  " + k.padEnd(38) + d));
      io.out("\nReal files:", COL.green);
      io.out(`  C:\\ is the PC's drive (Windows, System32, Program Files...). Your user folder\n  C:\\Users\\${userName()} (= %USERPROFILE% = ~) holds the folders File Explorer shows:\n  Desktop, Documents, Downloads, Pictures, Music, Videos, OneDrive.\n  Everything you create, copy, move or delete here shows up in File Explorer.\n  System files need /f to delete, and deleting System32 crashes Windows.`);
      io.out("\nTerminal keys:", COL.green);
      io.out("  Tab completes commands and file names   Up/Down history   Ctrl+C cancel   Ctrl+L clear\n  Pipes: dir | find \"txt\"   Chaining: md x && cd x   Redirect: > and >>   Quotes: cd \"My Folder\"");
      return 0;
    }
    function cmdDir(c) {
      const io = c.io; const { flags, rest } = splitOpts(c.a);
      const bare = !!flags.b, recursive = !!flags.s, wide = !!flags.w, showHidden = flags.a != null && flags.a !== false;
      const targets = rest.length ? rest : ["."];
      let anyFound = false, totF = 0, totB = 0, totD = 0;
      if (!bare) io.out(" Volume in drive C is Local Disk\n Volume Serial Number is 1A2B-3C4D");
      for (const p of targets) {
        let segs = segsFor(p); if (!segs) { io.err("The system cannot find the path specified."); return 1; }
        let pattern = null; let h = walk(segs);
        const last = segs[segs.length - 1];
        if ((!h && last && hasWild(last)) || (h && !isDir(h.node))) { pattern = rx(fixWildDot(last)); segs = segs.slice(0, -1); h = walk(segs); }
        if (!h || !isDir(h.node)) { if (!bare) io.out(""); io.err(walk(segs.slice(0, -1)) ? "File Not Found" : "The system cannot find the path specified."); return 1; }
        const one = (hh, top) => {
          io.check();
          const all = entries(hh).filter(([, n]) => showHidden || !hidden(n));
          const items = pattern ? all.filter(([n]) => pattern.test(n)) : all;
          if (items.length || (top && !pattern)) {
            anyFound = true;
            if (bare) items.forEach(([n]) => io.out(recursive ? winPath(hh.canon.concat(n)) : n));
            else {
              io.out("\n Directory of " + winPath(hh.canon) + "\n");
              let f = 0, b = 0, d = 0;
              const rows = [];
              if (!pattern && hh.canon.length) { rows.push([".", hh.node, true]); rows.push(["..", hh.node, true]); }
              items.forEach(([n, node]) => rows.push([n, node, isDir(node)]));
              if (wide) { const cells = rows.map(([n, , dd]) => (dd ? "[" + n + "]" : n)); const w = Math.min(40, Math.max(...cells.map((x) => x.length)) + 2); const per = Math.max(1, Math.floor(76 / w)); for (let i = 0; i < cells.length; i += per) io.out(cells.slice(i, i + per).map((x) => x.padEnd(w)).join("").trimEnd()); }
              rows.forEach(([n, node, dd]) => { if (dd) d++; else { f++; b += fsize(n, node); } if (!wide) io.out(`${dosDate(mtime(node))}    ${dd ? "<DIR>          " : num(fsize(n, node)).padStart(14) + " "}${n}`); });
              io.out(`${String(f).padStart(16)} File(s) ${num(b).padStart(14)} bytes`);
              if (!recursive) io.out(`${String(d).padStart(16)} Dir(s) ${num(DISK.free).padStart(15)} bytes free`);
              totF += f; totB += b; totD += d;
            }
          }
          if (recursive) all.forEach(([n, node]) => { if (isDir(node)) one(childH(hh, n, node), false); });
        };
        one(h, true);
      }
      if (!anyFound) { if (!bare) io.out(""); io.err("File Not Found"); return 1; }
      if (recursive && !bare) io.out(`\n     Total Files Listed:\n${String(totF).padStart(16)} File(s) ${num(totB).padStart(14)} bytes\n${String(totD).padStart(16)} Dir(s) ${num(DISK.free).padStart(15)} bytes free`);
      return 0;
    }
    function cmdCd(c) {
      const io = c.io; const parts = c.a.filter((x) => lc(x) !== "/d");
      if (!parts.length) { io.out(winPath(cwd())); return 0; }
      const p = parts.join(" ");
      const segs = winSegs(p, cwd());
      if (!segs) { io.err("The system cannot find the drive specified."); return 1; }
      const h = walk(segs);
      if (!h) { io.err("The system cannot find the path specified."); return 1; }
      if (!isDir(h.node)) { io.err("The directory name is invalid."); return 1; }
      setCwd(h.canon); return 0;
    }
    function cmdMd(c) {
      const io = c.io; if (!c.a.length) { io.err("The syntax of the command is incorrect."); return 1; }
      let st = 0;
      c.a.forEach((p) => {
        const segs = winSegs(p, cwd()); if (!segs || !segs.length) { io.err("The system cannot find the path specified."); st = 1; return; }
        if (walk(segs)) { io.err(`A subdirectory or file ${p} already exists.`); st = 1; return; }
        const e = mkdirP(segs); if (e) { io.err(fsErr(e, p)); st = 1; return; }
      });
      save(); return st;
    }
    async function cmdRd(c) {
      const io = c.io; const { flags, rest } = splitOpts(c.a);
      if (!rest.length) { io.err("The syntax of the command is incorrect."); return 1; }
      let st = 0, boom = false;
      for (const p of rest) {
        const segs = winSegs(p, cwd()); const h = segs && walk(segs);
        if (!h) { io.err(segs && walk(segs.slice(0, -1)) ? "The system cannot find the file specified." : "The system cannot find the path specified."); st = 1; continue; }
        if (!isDir(h.node)) { io.err("The directory name is invalid."); st = 1; continue; }
        const g = guard(h, !!flags.f);
        if (g === "hard" || g === "deny") { io.err("Access is denied."); st = 1; continue; }
        const kids = entries(h).length;
        if (kids && !flags.s) { io.err("The directory is not empty."); st = 1; continue; }
        if (flags.s && !flags.q) { const ans = await io.ask(`${p}, Are you sure (Y/N)? `); if (!/^y/i.test(ans.trim())) continue; }
        const inside = cwd().length >= h.canon.length && h.canon.every((x, i) => lc(x) === lc(cwd()[i]));
        if (inside && h.canon.length) { io.err("The process cannot access the file because it is being used by another process."); st = 1; continue; }
        removeH(h); if (g === "bsod") boom = true;
      }
      save(); if (boom) crash();
      return st;
    }
    async function cmdDel(c) {
      const io = c.io; const { flags, rest } = splitOpts(c.a);
      if (!rest.length) { io.err("The syntax of the command is incorrect."); return 1; }
      let st = 0, boom = false, deleted = 0;
      const killFile = (h) => { const g = guard(h, !!flags.f); if (g === "deny" || g === "hard") { io.err(winPath(h.canon) + "\nAccess is denied."); st = 1; return; } removeH(h); deleted++; if (g === "bsod") boom = true; if (flags.s) io.out("Deleted file - " + winPath(h.canon)); };
      for (const p of rest) {
        const segs = winSegs(p, cwd()); if (!segs) { io.err("The system cannot find the path specified."); st = 1; continue; }
        const last = segs[segs.length - 1] || "";
        let h = walk(segs);
        if (h && isDir(h.node)) {
          if (!flags.q) { const ans = await io.ask(`${winPath(h.canon)}\\*, Are you sure (Y/N)? `); if (!/^y/i.test(ans.trim())) continue; }
          const walkDel = (hh) => entries(hh).forEach(([n, node]) => { const ch = childH(hh, n, node); if (isDir(node)) { if (flags.s) walkDel(ch); } else killFile(ch); });
          walkDel(h); continue;
        }
        if (h) { killFile(h); continue; }
        if (hasWild(last)) {
          const par = walk(segs.slice(0, -1)); if (!par) { io.err("The system cannot find the path specified."); st = 1; continue; }
          const re = rx(fixWildDot(last)); const found = [];
          (function g(hh) { entries(hh).forEach(([n, node]) => { const ch = childH(hh, n, node); if (!isDir(node) && re.test(n)) found.push(ch); else if (isDir(node) && flags.s) g(ch); }); })(par);
          if (!found.length) { io.err("Could Not Find " + winPath(segs)); st = 1; continue; }
          if (/^\*(\.\*)?$/.test(last) && !flags.q) { const ans = await io.ask(`${winPath(par.canon)}\\*, Are you sure (Y/N)? `); if (!/^y/i.test(ans.trim())) continue; }
          found.forEach(killFile); continue;
        }
        io.err("Could Not Find " + winPath(segs)); st = 1;
      }
      save(); if (boom) crash();
      return st;
    }
    async function copyOrMove(c, isMove) {
      const io = c.io; const { flags, rest } = splitOpts(c.a);
      if (!rest.length) { io.err("The syntax of the command is incorrect."); return 1; }
      const srcArg = rest[0], dstArg = rest[1] || ".";
      const srcs = resolveMany(srcArg);
      if (!srcs || !srcs.length) { io.err(srcs === null ? "The system cannot find the path specified." : "The system cannot find the file specified."); if (!isMove) io.out("        0 file(s) copied."); return 1; }
      let list = srcs;
      if (!isMove && srcs.length === 1 && isDir(srcs[0].h.node)) list = entries(srcs[0].h).filter(([, n]) => !isDir(n)).map(([n, node]) => ({ h: childH(srcs[0].h, n, node), name: n }));
      else if (!isMove) list = srcs.filter(({ h }) => !isDir(h.node));
      if (!list.length) { io.out("        0 file(s) copied."); return 0; }
      const dsegs = winSegs(dstArg, cwd()); if (!dsegs) { io.err("The system cannot find the path specified."); return 1; }
      const dh = walk(dsegs);
      const intoDir = dh && isDir(dh.node);
      let n = 0, dirs = 0, all = !!flags.y, st = 0;
      if (!intoDir && list.length > 1 && !isMove) {   // copy a+b+c into one file (concatenate), like cmd
        const text = list.filter(({ h }) => !isDir(h.node)).map(({ h }) => textOf(h.key, h.node)).join("");
        list.forEach(({ name }) => io.out(name));
        const w = writeAt(dsegs, text, false); if (w) { io.err(fsErr(w, dstArg)); return 1; }
        io.out("        1 file(s) copied."); return 0;
      }
      if (!intoDir && list.length > 1) { io.err("Cannot move multiple files to a single file."); return 1; }
      for (const { h, name } of list) {
        const target = intoDir ? dh.canon.concat(name) : dsegs;
        const par = walk(target.slice(0, -1));
        if (!par || !isDir(par.node)) { io.err("The system cannot find the path specified."); st = 1; continue; }
        const nm = target[target.length - 1];
        if (badName(nm)) { io.err("The filename, directory name, or volume label syntax is incorrect."); st = 1; continue; }
        if (h.node.virtual || (isMove && guard(h, false) !== "ok") || writeProtected(par.canon.concat(nm))) { io.err("Access is denied."); st = 1; continue; }
        if (isDir(h.node) && par.canon.concat(nm).map(lc).join("\\").startsWith(h.canon.map(lc).join("\\") + "\\")) { io.err("The process cannot access the file because it is being used by another process."); st = 1; continue; }
        const exKey = keyIn(par.node.children, nm);
        if (exKey && par.node.children[exKey] === h.node) { if (!isMove) { io.err("The file cannot be copied onto itself."); io.out("        0 file(s) copied."); return 1; } continue; }
        if (exKey) {
          if (isDir(par.node.children[exKey])) { io.err("Access is denied."); st = 1; continue; }
          if (!all) { const ans = lc((await io.ask(`Overwrite ${winPath(par.canon.concat(exKey))}? (Yes/No/All): `)).trim()); if (/^a/.test(ans)) all = true; else if (!/^y/.test(ans)) continue; }
          delete par.node.children[exKey];
        }
        if (list.length > 1 || hasWild(srcArg)) io.out(winPath(h.canon));
        if (isMove) { delete h.parent[h.key]; par.node.children[exKey || nm] = h.node; h.node.ts = h.node.ts || Date.now(); }
        else par.node.children[exKey || nm] = clone(h.node);
        if (isDir(h.node)) dirs++; else n++;
      }
      save();
      if (isMove) io.out(dirs && !n ? `        ${dirs} dir(s) moved.` : `        ${n} file(s) moved.`);
      else io.out(`        ${n} file(s) copied.`);
      return st;
    }
    function cmdXcopy(c) {
      const io = c.io; const { rest } = splitOpts(c.a);
      if (!rest.length) { io.err("Invalid number of parameters"); return 1; }
      const src = walk(winSegs(rest[0], cwd()) || []); if (!src || !winSegs(rest[0], cwd())) { io.err("File not found - " + rest[0]); io.out("0 File(s) copied"); return 1; }
      const dsegs = winSegs(rest[1] || ".", cwd()); if (!dsegs) { io.err("Invalid drive specification"); return 1; }
      if (writeProtected(dsegs)) { io.err("Access denied"); return 1; }
      let n = 0;
      const put = (node, segs) => { if (isDir(node)) { mkdirP(segs); Object.keys(node.children).forEach((k) => { if (!(node.children === R() && k === SYS)) put(node.children[k], segs.concat(k)); }); } else { writeAt(segs, "", false); const h = walk(segs); if (h && h.parent) { h.parent[h.key] = clone(node); n++; io.out(winPath(segs)); } } };
      if (isDir(src.node)) { if (src.node.virtual) { io.err("Cyclic copy not allowed"); return 1; } put(src.node, dsegs); }
      else { const dh = walk(dsegs); put(src.node, dh && isDir(dh.node) ? dsegs.concat(src.key) : dsegs); }
      save(); io.out(`${n} File(s) copied`); return 0;
    }
    function cmdRen(c) {
      const io = c.io; const [src, nn] = c.a;
      if (!src || !nn || /[\\/]/.test(nn)) { io.err("The syntax of the command is incorrect."); return 1; }
      const list = resolveMany(src);
      if (!list || !list.length) { io.err("The system cannot find the file specified."); return 1; }
      let st = 0;
      list.forEach(({ h, name }) => {
        let target = nn;
        if (hasWild(nn)) { const dot = name.lastIndexOf("."); const base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : ""; target = nn.startsWith("*.") ? base + nn.slice(1) : nn.endsWith(".*") ? nn.slice(0, -2) + ext : nn.replace(/\*/g, base); }
        if (h.node.virtual || guard(h, false) !== "ok") { io.err("Access is denied."); st = 1; return; }
        if (badName(target)) { io.err("The syntax of the command is incorrect."); st = 1; return; }
        const ex = keyIn(h.parent, target);
        if (ex && ex !== h.key) { io.err("A duplicate file name exists, or the file\ncannot be found."); st = 1; return; }
        const node = h.node; delete h.parent[h.key]; h.parent[target] = node; node.ts = node.ts || Date.now();
      });
      save(); return st;
    }
    function cmdType(c) {
      const io = c.io; if (!c.a.length) { io.err("The syntax of the command is incorrect."); return 1; }
      let st = 0; const multi = c.a.length > 1 || c.a.some(hasWild);
      c.a.forEach((p) => {
        if (lc(p) === "nul") return;
        const list = resolveMany(p);
        if (!list || !list.length) { io.err(list === null ? "The system cannot find the path specified." : "The system cannot find the file specified."); if (multi) io.err("Error occurred while processing: " + p + "."); st = 1; return; }
        list.forEach(({ h, name }) => {
          if (isDir(h.node)) { io.err("Access is denied."); st = 1; return; }
          if (multi) io.out("\n" + name + "\n\n");
          printText(io, textOf(name, h.node));
        });
      });
      return st;
    }
    function cmdEcho(c) {
      const raw = c.raw();
      if (!raw) { c.io.out("ECHO is on."); return 0; }
      if (/^(on|off)$/i.test(raw.trim())) return 0;
      c.io.out(raw.replace(/\s+$/, "")); return 0;
    }
    async function cmdSet(c) {
      const io = c.io; let raw = c.raw();
      if (/^\/a\s*/i.test(raw)) {
        const ex = raw.replace(/^\/a\s*/i, "").replace(/^"|"$/g, "");
        const m = /^([A-Za-z_]\w*)\s*([+\-*/%]?=)(.*)$/.exec(ex);
        try {
          if (m) { const cur = Number(getEnv(m[1]) || 0); const rhs = evalMath(m[3].replace(/[A-Za-z_]\w*/g, (v) => String(Number(getEnv(v) || 0)))); const val = m[2] === "=" ? rhs : evalMath(cur + m[2][0] + "(" + rhs + ")"); sessionEnv[m[1].toUpperCase()] = String(Math.trunc(val)); io.out(String(Math.trunc(val))); }
          else io.out(String(Math.trunc(evalMath(ex.replace(/[A-Za-z_]\w*/g, (v) => String(Number(getEnv(v) || 0)))))));
          return 0;
        } catch (e) { io.err("Missing operand."); return 1; }
      }
      if (/^\/p\s*/i.test(raw)) {
        const m = /^([^=]+)=(.*)$/.exec(raw.replace(/^\/p\s*/i, "")); if (!m) { io.err("The syntax of the command is incorrect."); return 1; }
        const v = await io.ask(m[2].replace(/^"|"$/g, "")); sessionEnv[m[1].trim().toUpperCase()] = v; return 0;
      }
      raw = raw.replace(/^"(.*)"$/, "$1");
      const eq = raw.indexOf("=");
      if (eq > 0) { const k = raw.slice(0, eq).trim().toUpperCase(), v = raw.slice(eq + 1); sessionEnv[k] = v === "" ? null : v; return 0; }
      const env = winEnv(); const keys = Object.keys(env).sort();
      const pre = raw.trim().toUpperCase();
      const list = keys.filter((k) => k.startsWith(pre));
      if (!list.length) { io.err(`Environment variable ${raw.trim()} not defined`); return 1; }
      list.forEach((k) => io.out(`${NICE[k] || k}=${env[k]}`));
      return 0;
    }
    function cmdSetx(c) {
      const [k, v] = c.a; if (!k || v == null) { c.io.err("ERROR: Invalid syntax.\nType \"SETX /?\" for usage."); return 1; }
      TS().env[k.toUpperCase()] = v; State.save(); c.io.out("\nSUCCESS: Specified value was saved."); return 0;
    }
    function cmdPath(c) { const raw = c.raw(); if (!raw) { c.io.out("PATH=" + getEnv("PATH")); return 0; } sessionEnv.PATH = raw === ";" ? "" : raw.replace(/^=/, ""); return 0; }
    function cmdTree(c) {
      const io = c.io; const { flags, rest } = splitOpts(c.a);
      const segs = segsFor(rest[0] || "."); const h = segs && walk(segs);
      if (!h || !isDir(h.node)) { io.err("Invalid path - " + (rest[0] ? winPath(segs || []) : "")); return 1; }
      io.out("Folder PATH listing for volume Local Disk\nVolume serial number is 1A2B-3C4D");
      io.out(rest[0] ? winPath(h.canon) : "C:.");
      const t = treeLines(h, !!flags.f, !!flags.a, false);
      t.lines.forEach((l) => io.out(l));
      if (!t.nd && !t.nf) io.out("No subfolders exist \n");
      return 0;
    }
    function findLike(c, isFindstr) {
      const io = c.io; const toks = c.args;
      const flags = {}; const rest = [];
      toks.forEach((t) => { if (!t.q && /^\/[a-z]/i.test(t.v)) t.v.split(/(?=\/)/).forEach((f) => { const k = f.slice(1); const i = k.indexOf(":"); if (i >= 0) flags[lc(k.slice(0, i))] = k.slice(i + 1); else flags[lc(k)] = true; }); else rest.push(t); });
      let patterns, files;
      if (!isFindstr) {
        if (!rest.length || !rest[0].q) { io.err(rest.length ? "FIND: Parameter format not correct" : "FIND: Parameter format not correct"); return 2; }
        patterns = [rest[0].v]; files = rest.slice(1).map((t) => t.v);
      } else {
        if (typeof flags.c === "string") { patterns = [flags.c]; files = rest.map((t) => t.v); }
        else { if (!rest.length) { io.err("FINDSTR: Bad command line"); return 2; } patterns = rest[0].v.split(/\s+/).filter(Boolean); files = rest.slice(1).map((t) => t.v); }
      }
      const ci = !!flags.i, inv = !!flags.v, showN = !!flags.n, count = !!flags.c && !isFindstr, regex = isFindstr && !!flags.r;
      const test = (line) => { const r = patterns.some((p) => { if (regex) { try { return new RegExp(p, ci ? "i" : "").test(line); } catch (_) { return false; } } return ci ? lc(line).includes(lc(p)) : line.includes(p); }); return inv ? !r : r; };
      let hits = 0;
      const scan = (text, label, multi) => {
        const lines = textLines(text); let k = 0;
        if (!isFindstr && label != null) { }
        const outL = [];
        lines.forEach((l, i) => { if (test(l)) { k++; outL.push((isFindstr && multi ? label + ":" : "") + (showN ? (isFindstr ? (i + 1) + ":" : "[" + (i + 1) + "]") : "") + l); } });
        hits += k;
        if (!isFindstr && label != null) { io.out(count ? `\n---------- ${label.toUpperCase()}: ${k}` : `\n---------- ${label.toUpperCase()}`); if (!count) outL.forEach((x) => io.out(x)); }
        else if (count) io.out(String(k));
        else outL.forEach((x) => io.out(x));
      };
      if (!files.length) { if (io.stdin == null) { return 1; } scan(io.stdin, null, false); return hits ? 0 : 1; }
      const all = []; let st = 0;
      files.forEach((p) => { const list = isFindstr && flags.s ? filesForSearch(p, true) : (resolveMany(p) || []).filter(({ h }) => !isDir(h.node)).map(({ h, name }) => ({ h, label: hasWild(p) ? name : p })); if (!list.length) { io.err(isFindstr ? `FINDSTR: Cannot open ${p}` : `File not found - ${p.toUpperCase()}`); st = 2; } all.push(...list); });
      if (isFindstr && flags.m) { all.forEach(({ h, label }) => { if (textLines(textOf(h.key, h.node)).some(test)) { io.out(label); hits++; } }); return hits ? 0 : 1; }
      all.forEach(({ h, label }) => scan(textOf(h.key, h.node), label, all.length > 1 || !!flags.s));
      return hits ? 0 : (st || 1);
    }
    function sortCmd(c, reverse, fileArg) {
      const io = c.io; let text = io.stdin;
      if (fileArg) { const r = readPath(fileArg); if (r.err) { io.err(mode() === "bash" ? `sort: cannot read: ${fileArg}: No such file or directory` : "The system cannot find the file specified."); return 1; } text = r.text; }
      if (text == null) return 0;
      const lines = textLines(text).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      if (reverse) lines.reverse();
      lines.forEach((l) => io.out(l)); return 0;
    }
    function moreCmd(c) {
      const io = c.io; const files = c.a.filter((x) => !x.startsWith("/") && !x.startsWith("+"));
      if (!files.length) { if (io.stdin != null) printText(io, io.stdin); return 0; }
      let st = 0;
      files.forEach((p) => { const r = readPath(p); if (r.err) { io.err("Cannot access file " + (segsFor(p) ? show(segsFor(p)) : p)); st = 1; } else printText(io, r.text); });
      return st;
    }
    function fcCmd(c) {
      const io = c.io; const { flags, rest } = splitOpts(c.a);
      if (rest.length < 2) { io.err("FC: Insufficient number of file specifications"); return 2; }
      const A = readPath(rest[0]), B = readPath(rest[1]);
      if (A.err) { io.err("FC: cannot open " + rest[0].toUpperCase() + " - No such file or folder"); return 2; }
      if (B.err) { io.err("FC: cannot open " + rest[1].toUpperCase() + " - No such file or folder"); return 2; }
      const na = winPath(A.h.canon).toUpperCase(), nb = winPath(B.h.canon).toUpperCase();
      io.out(`Comparing files ${A.h.key.toUpperCase()} and ${B.h.key.toUpperCase()}`);
      const cmp = (x) => (flags.c ? lc(x) : x);
      const la = textLines(A.text), lb = textLines(B.text);
      if (la.length === lb.length && la.every((l, i) => cmp(l) === cmp(lb[i]))) { io.out("FC: no differences encountered\n"); return 0; }
      // simple LCS-free block diff: report differing ranges line by line
      let i = 0, diffs = 0;
      while (i < Math.max(la.length, lb.length)) {
        if (cmp(la[i] == null ? "\u0000" : la[i]) === cmp(lb[i] == null ? "\u0000" : lb[i])) { i++; continue; }
        let j = i; while (j < Math.max(la.length, lb.length) && cmp(la[j] == null ? "\u0000" : la[j]) !== cmp(lb[j] == null ? "\u0000" : lb[j])) j++;
        const ln = (k) => (flags.n ? String(k + 1).padStart(5) + ":  " : "");
        io.out("***** " + na); for (let k = Math.max(0, i - 1); k < Math.min(la.length, j + 1); k++) io.out(ln(k) + la[k]);
        io.out("***** " + nb); for (let k = Math.max(0, i - 1); k < Math.min(lb.length, j + 1); k++) io.out(ln(k) + lb[k]);
        io.out("*****\n"); diffs++; i = j;
        if (diffs > 50) break;
      }
      return 1;
    }
    function cmdDate(c, which) {
      const d = nowD(); const t = c.a.some((x) => lc(x) === "/t");
      const ds = `${DAYS[d.getDay()].slice(0, 3)} ${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${d.getFullYear()}`;
      let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; const h12 = h % 12 || 12;
      if (which === "date") c.io.out(t ? ds : "The current date is: " + ds);
      else c.io.out(t ? `${p2(h12)}:${p2(d.getMinutes())} ${ap}` : `The current time is: ${String(h).padStart(2)}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p2(Math.floor(d.getMilliseconds() / 10))}`);
      return 0;
    }
    // Windows 12 inside Windows 12 (Hyper-V style VM, see js/vm12.js).
    function vmCmd(c) {
      const a = (c.a || []).map((x) => lc(String(x)));
      if (a.some((x) => x === "/?" || x === "-?" || x === "--help" || x === "help")) {
        c.io.out("Runs Windows 12 as a virtual machine inside this Windows 12.\nThe VM has its own separate files and settings.\n\n  win12            Start (or resume) the VM\n  win12 /fresh     Erase the VM and start from Windows Setup\n\nAlso: vmconnect, or in PowerShell: Start-VM -Name \"Windows 12\" [-Fresh], Get-VM");
        return 0;
      }
      if (!window.VM12) { c.io.err("Hyper-V is not available on this device."); return 1; }
      const fresh = a.some((x) => x === "/fresh" || x === "--fresh" || x === "-fresh" || x === "fresh" || x === "/new");
      c.io.out("Starting virtual machine 'Windows 12'" + (fresh ? " with a fresh install" : "") + "...", COL.gray);
      const r = window.VM12.launch({ fresh });
      if (r.ok) c.io.out(r.message, COL.green); else c.io.err(r.message);
      return r.ok ? 0 : 1;
    }
    function vmList(c) {
      const d = (window.WIN12_VM_DEPTH || 0) + 1;
      let has = false; try { has = !!localStorage.getItem("win12_state_v1__vm" + d); } catch (_) {}
      c.io.out("\nName        State  CPUUsage(%) MemoryAssigned(M) Uptime   Status             Version\n----        -----  ----------- ----------------- ------   ------             -------\nWindows 12  " + (has ? "Saved  " : "Off    ") + "0           0                 00:00:00 Operating normally 12.0");
      return 0;
    }
    const CMD = {
      help: cmdHelp, "/?": cmdHelp, dir: cmdDir, cd: cmdCd, chdir: cmdCd, md: cmdMd, mkdir: cmdMd, rd: cmdRd, rmdir: cmdRd, del: cmdDel, erase: cmdDel,
      copy: (c) => copyOrMove(c, false), move: (c) => copyOrMove(c, true), xcopy: cmdXcopy, robocopy: cmdXcopy, ren: cmdRen, rename: cmdRen, type: cmdType, echo: cmdEcho,
      cls: () => { clearScreen(); return 0; }, clear: () => { clearScreen(); return 0; }, exit: (c) => exitShell(c.io),
      ver: (c) => { c.io.out(`\nMicrosoft Windows 12 [Version ${VERSION}]`, COL.green); return 0; },
      whoami: (c) => { c.io.out(lc(HOSTNAME) + "\\" + lc(userName())); return 0; }, hostname: (c) => { c.io.out(HOSTNAME); return 0; },
      date: (c) => cmdDate(c, "date"), time: (c) => cmdDate(c, "time"), calendar: (c) => { c.io.out(nowD().toDateString()); return 0; },
      set: cmdSet, setx: cmdSetx, path: cmdPath, where: whereCmd, tasklist, taskkill, start: (c) => { const a = c.args.slice(); if (a[0] && a[0].q && a.length > 1) a.shift(); return startThing(c, a[0] && a[0].v, a.slice(1)); },
      explorer: (c) => { if (!c.a[0]) { launchApp("fileexplorer"); return 0; } return startThing(c, c.a[0]); },
      shutdown, systeminfo, ipconfig, ping: (c) => doPing(c, false), nslookup: doNslookup, attrib: attribCmd, find: (c) => findLike(c, false), findstr: (c) => findLike(c, true),
      sort: (c) => { const { flags, rest } = splitOpts(c.a); return sortCmd(c, !!flags.r, rest[0]); }, more: moreCmd, fc: fcCmd, comp: fcCmd, chkdsk, tree: cmdTree, title: (c) => { if (o.setTitle) { o.setTitle(c.raw()); return 0; } const tt = winRef.win && winRef.win.querySelector(".win-titlebar .t-text"); if (tt) tt.textContent = c.raw() || "Terminal"; return 0; },
      color: setColor, calc, weather, history: historyCmd, doskey: (c) => (lc(c.a[0]) === "/history" ? historyCmd(c) : 0), last: doLast, who: doWho, open: openApp, update, kiosk, accessibility: a11y, a11y, theme,
      sfc, "factory-reset": () => { window.WM.factoryReset(); return 0; }, curl: (c) => doCurl(c), wget: (c) => doCurl(c, ""), "curl.exe": (c) => doCurl(c),
      wsl, install: wsl, arch: (c) => enterArch(c.io, "arch"), ubuntu: (c) => enterArch(c.io, "ubuntu"), bash: (c) => (TS().archInstalled ? enterArch(c.io, TS().wslDefault || "arch") : (c.io.err("'bash' is not recognized as an internal or external command,\noperable program or batch file.\nInstall Linux first: wsl --install arch"), 1)),
      powershell: (c) => enterPS(c.io, "5.1"), pwsh: (c) => enterPS(c.io, "7"), cmd: (c) => enterCmd(c.io), timeout: timeoutCmd, pause: async (c) => { await c.io.ask("Press Enter to continue . . . "); return 0; },
      clip, rem: () => 0, vol: (c) => { c.io.out(" Volume in drive C is Local Disk\n Volume Serial Number is 1A2B-3C4D"); return 0; },
      win12: vmCmd, vmconnect: vmCmd, "vmconnect.exe": vmCmd, "virtmgmt.msc": vmCmd, hyperv: vmCmd,
    };
    function notRecognized(c) {
      const m = mode();
      if (m === "ps") c.io.err(`${c.name}: The term '${c.name}' is not recognized as a name of a cmdlet, function, script file, or executable program.\nCheck the spelling of the name, or if a path was included, verify that the path is correct and try again.`);
      else c.io.err(`'${c.name}' is not recognized as an internal or external command,\noperable program or batch file.`);
      return m === "ps" ? 1 : 9009;
    }
    function external(c) {
      const n = c.name;
      const segs = winSegs(n, cwd()); const h = segs && /[\\/.]/.test(n) && walk(segs);
      if (h && !isDir(h.node)) return startThing(c, n);
      const id = findApp(n);
      if (id) {
        if (id === "powershell") return enterPS(c.io, /pwsh/i.test(n) ? "7" : "5.1");
        const fa = c.a[0] && winSegs(c.a[0], cwd()); const fh = fa && walk(fa);
        if (fh && !isDir(fh.node) && window.VFS && window.VFS.openNode && id !== "fileexplorer") { window.VFS.openNode(fh.key, fh.node); return 0; }
        if (fh && isDir(fh.node) && id === "fileexplorer") { openExplorerAt(fh.canon); return 0; }
        launchApp(id); return 0;
      }
      const sysHit = walk(["Windows", "System32", lc(n).endsWith(".exe") ? n : n + ".exe"]);
      if (sysHit) { c.io.err("This app can't run on your PC. (" + sysHit.key + ")"); return 1; }
      return notRecognized(c);
    }
    async function runCmd(c) {
      const key = lc(c.name);
      if (c.a[0] === "/?" && CMD[key] && key !== "echo") { const row = CMD_HELP.find(([k]) => k.split(" / ").some((x) => lc(x) === key)); if (row) { c.io.out(row[1]); return 0; } if (!/^(win12|vmconnect|vmconnect\.exe|virtmgmt\.msc|hyperv|wsl)$/.test(key)) { c.io.out("No help available for " + c.name + "."); return 0; } }
      const ex = extCmd("cmd", key) || extCmd("cmd", key.replace(/\.exe$/, ""));
      if (ex) { const r = await ex(c, { mode: "cmd", COL, host: HOSTNAME, userName }); return typeof r === "number" ? r : 0; }
      const fn = CMD[key];
      if (fn) { const r = await fn(c); return typeof r === "number" ? r : 0; }
      return external(c);
    }

    // ================================================================ PowerShell
    const PS_NAMES = ["Get-ChildItem", "Set-Location", "Get-Location", "Get-Content", "Set-Content", "Add-Content", "New-Item", "Remove-Item", "Copy-Item", "Move-Item", "Rename-Item", "Get-Process", "Stop-Process", "Get-Date", "Get-Host", "Clear-Host", "Write-Output", "Write-Host", "Select-String", "Sort-Object", "Measure-Object", "Get-History", "Start-Process", "Invoke-WebRequest", "Invoke-Item", "Get-Command", "Get-Help", "Test-Path", "Test-Connection", "Resolve-DnsName", "Get-Item", "Out-File"];
    const PS_ALIAS = { ls: "get-childitem", dir: "get-childitem", gci: "get-childitem", cd: "set-location", sl: "set-location", chdir: "set-location", pwd: "get-location", gl: "get-location", cat: "get-content", gc: "get-content", type: "get-content", ac: "add-content", ni: "new-item", rm: "remove-item", del: "remove-item", erase: "remove-item", rd: "remove-item", rmdir: "remove-item", ri: "remove-item", cp: "copy-item", copy: "copy-item", cpi: "copy-item", mv: "move-item", move: "move-item", mi: "move-item", ren: "rename-item", rni: "rename-item", ps: "get-process", gps: "get-process", kill: "stop-process", spps: "stop-process", cls: "clear-host", clear: "clear-host", echo: "write-output", write: "write-output", sls: "select-string", sort: "sort-object", measure: "measure-object", h: "get-history", history: "get-history", ghy: "get-history", start: "start-process", saps: "start-process", iwr: "invoke-webrequest", ii: "invoke-item", gcm: "get-command", man: "get-help", help: "get-help", gi: "get-item", date: "get-date" };
    const PS_PASS = ["ipconfig", "ping", "whoami", "hostname", "systeminfo", "tasklist", "taskkill", "nslookup", "sfc", "chkdsk", "shutdown", "tree", "attrib", "findstr", "curl", "wget", "wsl", "install", "arch", "ubuntu", "bash", "cmd", "update", "kiosk", "accessibility", "a11y", "theme", "factory-reset", "open", "weather", "calc", "calendar", "last", "who", "timeout", "clip", "explorer", "setx", "xcopy", "robocopy", "where.exe", "ver"];
    function psParams(tokens, spec) {
      const named = {}, pos = []; const all = (spec.sw || []).concat(spec.params || []);
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]; const m = !t.q && /^-([A-Za-z][\w]*)(?::(.+))?$/.exec(t.v);
        if (m) {
          const k = lc(m[1]); const full = all.find((x) => x === k) || all.find((x) => x.startsWith(k)) || (spec.alias && spec.alias[k]);
          if (!full) return { _error: `A parameter cannot be found that matches parameter name '${m[1]}'.` };
          if ((spec.sw || []).includes(full)) named[full] = m[2] == null ? true : !/^\$?false$/i.test(m[2]);
          else { const v = m[2] != null ? m[2] : tokens[i + 1] ? tokens[++i].v : undefined; if (v === undefined) return { _error: `Missing an argument for parameter '${m[1]}'. Specify a parameter of type 'System.String' and try again.` }; named[full] = v; }
        } else pos.push(t.v);
      }
      let pi = 0;
      (spec.pos || []).forEach((k) => { if (named[k] == null && pi < pos.length) named[k] = pos[pi++]; });
      named._pos = pos; named._extra = pos.slice(pi);
      return named;
    }
    const psMode = (n, name) => (isDir(n) ? "d" : "-") + (isDir(n) ? "-" : "a") + (ro(n) ? "r" : "-") + (hidden(n) ? "h" : "-") + (n.kind === "system" ? "s" : "-");
    function psTable(io, dirCanon, rows) {
      io.out(""); io.out("    Directory: " + winPath(dirCanon)); io.out("");
      io.out("Mode                 LastWriteTime         Length Name"); io.out("----                 -------------         ------ ----");
      rows.forEach(([n, node]) => io.out(`${psMode(node, n)}${" ".repeat(9)}${psDate(mtime(node)).padStart(20)}${(isDir(node) ? "" : String(fsize(n, node))).padStart(15)} ${n}`));
      io.out("");
    }
    const psErr = (io, cmdlet, msg) => { io.err(`${cmdlet}: ${msg}`); return 1; };
    function psResolve(p, cmdlet, io) {
      const segs = winSegs(p, cwd());
      const list = segs ? resolveMany(p) : null;
      if (!list || !list.length) { psErr(io, cmdlet, `Cannot find path '${segs ? winPath(segs) : p}' because it does not exist.`); return null; }
      return list;
    }
    function psGci(c) {
      const io = c.io; const P = psParams(c.args, { pos: ["path"], params: ["path", "filter", "include", "depth"], sw: ["recurse", "force", "name", "file", "directory"] });
      if (P._error) return psErr(io, "Get-ChildItem", P._error);
      const p = P.path || ".";
      let segs = winSegs(p, cwd()); if (!segs) return psErr(io, "Get-ChildItem", `Cannot find drive. A drive with the name '${p.split(":")[0]}' does not exist.`);
      let h = walk(segs); let pat = P.filter ? rx(P.filter) : P.include ? rx(P.include) : null;
      if (!h && hasWild(segs[segs.length - 1] || "")) { pat = rx(segs[segs.length - 1]); segs = segs.slice(0, -1); h = walk(segs); }
      if (!h) return psErr(io, "Get-ChildItem", `Cannot find path '${winPath(segs)}' because it does not exist.`);
      if (!isDir(h.node)) { if (P.name) io.out(h.key); else psTable(io, h.canon.slice(0, -1), [[h.key, h.node]]); return 0; }
      const one = (hh, depth) => {
        io.check();
        const all = entries(hh).filter(([, n]) => P.force || !hidden(n));
        const rows = all.filter(([n, node]) => (!pat || pat.test(n)) && (!P.file || !isDir(node)) && (!P.directory || isDir(node)));
        if (rows.length) { if (P.name) rows.forEach(([n]) => io.out(P.recurse ? hh.canon.slice(h.canon.length).concat(n).join("\\") : n)); else psTable(io, hh.canon, rows); }
        if (P.recurse && (P.depth == null || depth < Number(P.depth))) all.forEach(([n, node]) => { if (isDir(node)) one(childH(hh, n, node), depth + 1); });
      };
      one(h, 0); return 0;
    }
    function psSetLoc(c) {
      const io = c.io; const P = psParams(c.args, { pos: ["path"], params: ["path", "literalpath"] });
      if (P._error) return psErr(io, "Set-Location", P._error);
      const p = P.path || P.literalpath;
      if (p == null) { setCwd(HOME()); return 0; }
      if (p === "-") { if (top().prev) { const pv = top().prev; setCwd(pv); } return 0; }
      const segs = winSegs(p, cwd()); const h = segs && walk(segs);
      if (!h) return psErr(io, "Set-Location", `Cannot find path '${segs ? winPath(segs) : p}' because it does not exist.`);
      if (!isDir(h.node)) return psErr(io, "Set-Location", `Cannot find path '${winPath(h.canon)}' because it does not exist.`);
      setCwd(h.canon); return 0;
    }
    function psGetContent(c) {
      const io = c.io; const P = psParams(c.args, { pos: ["path"], params: ["path", "totalcount", "head", "first", "tail", "last", "encoding"], sw: ["raw", "wait"] });
      if (P._error) return psErr(io, "Get-Content", P._error);
      if (!P.path) return psErr(io, "Get-Content", "Cannot bind argument to parameter 'Path' because it is null.");
      let st = 0;
      String(P.path).split(",").map((x) => x.trim()).filter(Boolean).forEach((p) => {
        const list = psResolve(p, "Get-Content", io); if (!list) { st = 1; return; }
        list.forEach(({ h }) => {
          if (isDir(h.node)) { st = psErr(io, "Get-Content", `Unable to get content because it is a directory: '${winPath(h.canon)}'. Please use 'Get-ChildItem' instead.`); return; }
          let lines = textLines(textOf(h.key, h.node)); const head = P.totalcount || P.head || P.first, tail = P.tail || P.last;
          if (head != null) lines = lines.slice(0, Number(head)); if (tail != null) lines = lines.slice(-Number(tail));
          if (lines.length === 1 && lines[0] === "") return;
          lines.forEach((l) => io.out(l));
        });
      });
      return st;
    }
    function psSetContent(c, append) {
      const io = c.io; const nm = append ? "Add-Content" : "Set-Content";
      const P = psParams(c.args, { pos: ["path", "value"], params: ["path", "value", "encoding"], sw: ["force", "nonewline", "passthru"] });
      if (P._error) return psErr(io, nm, P._error);
      if (!P.path) return psErr(io, nm, "Cannot bind argument to parameter 'Path' because it is null.");
      let val = P.value != null ? [P.value].concat(P._extra).join(" ") : io.stdin != null ? io.stdin.replace(/\n$/, "") : "";
      val = String(val).split(",").length > 1 && !c.args.some((t) => t.q && t.v.includes(",")) ? String(val).split(",").map((x) => x.trim()).join("\n") : val;
      const segs = winSegs(P.path, cwd()); if (!segs) return psErr(io, nm, `Cannot find drive.`);
      let text = P.nonewline ? val : val + "\n";
      if (append) { const h = walk(segs); if (h && !isDir(h.node)) { const prev = textOf(h.key, h.node); if (prev && !prev.endsWith("\n")) text = "\n" + text; } }
      const w = writeAt(segs, text, append);
      if (w) return psErr(io, nm, w === "path" ? `Could not find a part of the path '${winPath(segs)}'.` : w === "dir" ? `Access to the path '${winPath(segs)}' is denied.` : w === "denied" ? `Access to the path '${winPath(segs)}' is denied.` : "The filename, directory name, or volume label syntax is incorrect.");
      return 0;
    }
    function psNewItem(c, forceDir) {
      const io = c.io; const P = psParams(c.args, { pos: ["path"], params: ["path", "name", "itemtype", "value", "type"], sw: ["force"], alias: { type: "itemtype" } });
      if (P._error) return psErr(io, "New-Item", P._error);
      let p = P.path || "."; if (P.name) p = (P.path ? P.path.replace(/[\\/]$/, "") + "\\" : "") + P.name; else if (!P.path) return psErr(io, "New-Item", "Cannot bind argument to parameter 'Path' because it is null.");
      const type = forceDir ? "directory" : lc(P.itemtype || P.type || "file");
      const segs = winSegs(p, cwd()); if (!segs || !segs.length) return psErr(io, "New-Item", `Could not find a part of the path '${p}'.`);
      const ex = walk(segs);
      if (ex && !P.force) return psErr(io, "New-Item", `An item with the specified name ${winPath(ex.canon)} already exists.`);
      if (/^d|^folder/.test(type)) { const e = mkdirP(segs); if (e) return psErr(io, "New-Item", e === "denied" ? `Access to the path '${winPath(segs)}' is denied.` : `Could not find a part of the path '${winPath(segs)}'.`); }
      else if (/^f/.test(type)) { if (P.force) mkdirP(segs.slice(0, -1)); const w = writeAt(segs, P.value != null ? P.value : "", false); if (w) return psErr(io, "New-Item", w === "denied" || w === "dir" ? `Access to the path '${winPath(segs)}' is denied.` : `Could not find a part of the path '${winPath(segs)}'.`); }
      else return psErr(io, "New-Item", `The provider does not support the use of filters, or ItemType '${P.itemtype}' is not valid.`);
      save();
      const h = walk(segs); if (h) psTable(io, h.canon.slice(0, -1), [[h.canon[h.canon.length - 1], h.node]]);
      return 0;
    }
    async function psRemove(c) {
      const io = c.io; const P = psParams(c.args, { pos: ["path"], params: ["path", "literalpath", "filter", "include"], sw: ["recurse", "force", "confirm", "whatif"] });
      if (P._error) return psErr(io, "Remove-Item", P._error);
      const paths = String(P.path || P.literalpath || "").split(",").map((x) => x.trim()).filter(Boolean).concat(P._extra.map((x) => x.replace(/,$/, "")));
      if (!paths.length) return psErr(io, "Remove-Item", "Cannot bind argument to parameter 'Path' because it is null.");
      let st = 0, boom = false, yesAll = !!P.recurse;
      for (const p of paths) {
        const list = psResolve(p, "Remove-Item", io); if (!list) { st = 1; continue; }
        for (const { h } of list) {
          const g = guard(h, !!P.force);
          if (g === "hard" || g === "deny") { st = psErr(io, "Remove-Item", `Access to the path '${winPath(h.canon)}' is denied.`); continue; }
          if (isDir(h.node) && entries(h).length && !yesAll) {
            const ans = lc((await io.ask(`\nConfirm\nThe item at ${winPath(h.canon)} has children and the Recurse parameter was not specified. If you continue, all children will be removed with the item. Are you sure you want to continue?\n[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [S] Suspend  [?] Help (default is "Y"): `)).trim());
            if (/^a/.test(ans)) yesAll = true; else if (ans && !/^y/.test(ans)) continue;
          }
          if (P.whatif) { io.out(`What if: Performing the operation "Remove ${isDir(h.node) ? "Directory" : "File"}" on target "${winPath(h.canon)}".`); continue; }
          const inside = cwd().length >= h.canon.length && h.canon.every((x, i) => lc(x) === lc(cwd()[i]));
          if (inside && isDir(h.node)) { st = psErr(io, "Remove-Item", `Cannot remove item ${winPath(h.canon)}: The process cannot access the file '${winPath(h.canon)}' because it is being used by another process.`); continue; }
          removeH(h); if (g === "bsod") boom = true;
        }
      }
      save(); if (boom) crash();
      return st;
    }
    async function psCopyMove(c, isMove) {
      const io = c.io; const nm = isMove ? "Move-Item" : "Copy-Item";
      const P = psParams(c.args, { pos: ["path", "destination"], params: ["path", "destination", "literalpath"], sw: ["recurse", "force", "passthru", "container"] });
      if (P._error) return psErr(io, nm, P._error);
      if (!P.path) return psErr(io, nm, "Cannot bind argument to parameter 'Path' because it is null.");
      const list = psResolve(P.path, nm, io); if (!list) return 1;
      const dsegs = winSegs(P.destination || ".", cwd()); if (!dsegs) return psErr(io, nm, "Cannot find drive.");
      const dh = walk(dsegs); const intoDir = dh && isDir(dh.node);
      let st = 0, boom = false;
      for (const { h, name } of list) {
        const target = intoDir ? dh.canon.concat(name) : dsegs;
        const par = walk(target.slice(0, -1));
        if (!par || !isDir(par.node)) { st = psErr(io, nm, `Could not find a part of the path '${winPath(target)}'.`); continue; }
        const tn = target[target.length - 1];
        const g = guard(h, !!P.force);
        if (h.node.virtual || (isMove && (g === "deny" || g === "hard")) || writeProtected(par.canon.concat(tn))) { st = psErr(io, nm, `Access to the path '${winPath(h.canon)}' is denied.`); continue; }
        if (isMove && g === "bsod") boom = true;
        if (isDir(h.node) && par.canon.concat(tn).map(lc).join("\\").startsWith(h.canon.map(lc).join("\\") + "\\")) { st = psErr(io, nm, `Cannot ${isMove ? "move" : "copy"} item ${winPath(h.canon)} to a subdirectory of itself, ${winPath(target)}.`); continue; }
        const ex = keyIn(par.node.children, tn);
        if (ex && par.node.children[ex] === h.node) continue;
        if (ex && !P.force && (isMove || isDir(par.node.children[ex]))) { st = psErr(io, nm, isMove ? "Cannot create a file when that file already exists." : `An item with the specified name ${winPath(par.canon.concat(ex))} already exists.`); continue; }
        if (ex) delete par.node.children[ex];
        if (isMove) { delete h.parent[h.key]; par.node.children[ex || tn] = h.node; }
        else { const cl = clone(h.node); if (isDir(cl) && !P.recurse) cl.children = {}; par.node.children[ex || tn] = cl; }
      }
      save(); if (boom) crash(); return st;
    }
    function psRename(c) {
      const io = c.io; const P = psParams(c.args, { pos: ["path", "newname"], params: ["path", "newname", "literalpath"], sw: ["force", "passthru"] });
      if (P._error) return psErr(io, "Rename-Item", P._error);
      if (!P.path || !P.newname) return psErr(io, "Rename-Item", "Cannot bind argument to parameter 'NewName' because it is null.");
      if (/[\\/]/.test(P.newname)) return psErr(io, "Rename-Item", "Cannot rename the specified target, because it represents a path or device name.");
      const segs = winSegs(P.path, cwd()); const h = segs && walk(segs);
      if (!h) return psErr(io, "Rename-Item", `Cannot rename because item at '${P.path}' does not exist.`);
      if (h.node.virtual || guard(h, !!P.force) !== "ok") return psErr(io, "Rename-Item", `Access to the path '${winPath(h.canon)}' is denied.`);
      if (badName(P.newname)) return psErr(io, "Rename-Item", "The filename, directory name, or volume label syntax is incorrect.");
      const ex = keyIn(h.parent, P.newname); if (ex && ex !== h.key) return psErr(io, "Rename-Item", "Cannot create a file when that file already exists.");
      const node = h.node; delete h.parent[h.key]; h.parent[P.newname] = node; save(); return 0;
    }
    function psProcList(filter) {
      const list = SYS_PROCS.filter(([, pid]) => pid > 4).map(([n, pid, mem]) => ({ name: n.replace(/\.exe$/, ""), pid, ws: mem, si: pid < 1000 ? 0 : 1 }))
        .concat(windowsList().map((w) => ({ name: w.image.replace(/\.exe$/, ""), pid: w.pid, ws: w.mem, si: 1, win: w })));
      return filter ? list.filter((p) => filter(p)) : list;
    }
    function psGetProcess(c) {
      const io = c.io; const P = psParams(c.args, { pos: ["name"], params: ["name", "id"], sw: [] });
      if (P._error) return psErr(io, "Get-Process", P._error);
      const re = P.name ? rx(P.name) : null;
      const list = psProcList((p) => (!re || re.test(p.name)) && (P.id == null || p.pid === Number(P.id))).sort((a, b) => a.name.localeCompare(b.name));
      if (!list.length) return psErr(io, "Get-Process", P.id != null ? `Cannot find a process with the process identifier ${P.id}.` : `Cannot find a process with the name "${P.name}". Verify the process name and call the cmdlet again.`);
      io.out(""); io.out(" NPM(K)    PM(M)      WS(M)     CPU(s)      Id  SI ProcessName"); io.out(" ------    -----      -----     ------      --  -- -----------");
      list.forEach((p) => io.out(`${String(8 + (p.pid % 40)).padStart(7)}${(p.ws / 1300).toFixed(2).padStart(9)}${(p.ws / 1024).toFixed(2).padStart(11)}${((p.pid % 97) / 7).toFixed(2).padStart(11)}${String(p.pid).padStart(8)}${String(p.si).padStart(4)} ${p.name}`));
      io.out(""); return 0;
    }
    function psStopProcess(c) {
      const io = c.io; const P = psParams(c.args, { pos: ["name"], params: ["name", "id"], sw: ["force", "passthru"] });
      if (P._error) return psErr(io, "Stop-Process", P._error);
      if (P.name == null && P.id == null) return psErr(io, "Stop-Process", "Cannot bind argument to parameter 'Id' because it is null.");
      const idNum = P.id != null ? Number(P.id) : /^\d+$/.test(P.name || "") ? Number(P.name) : null;
      const re = idNum == null ? rx(String(P.name).replace(/\.exe$/i, "")) : null;
      const list = psProcList((p) => (idNum != null ? p.pid === idNum : re.test(p.name) || (p.win && lc(p.win.title) === lc(P.name))));
      if (!list.length) return psErr(io, "Stop-Process", idNum != null ? `Cannot find a process with the process identifier ${idNum}.` : `Cannot find a process with the name "${P.name}". Verify the process name and call the cmdlet again.`);
      let st = 0;
      list.forEach((p) => {
        if (!p.win) { if (P.force && CRITICAL.includes(lc(p.name) + ".exe")) { crash(); return; } st = psErr(io, "Stop-Process", `Cannot stop process "${p.name} (${p.pid})" because of the following error: Access is denied.`); return; }
        if (p.win.el.contains(termEl)) { setTimeout(() => winRef.close(), 200); return; }
        if (!closeWin(p.win)) st = psErr(io, "Stop-Process", `Cannot stop process "${p.name} (${p.pid})" because of the following error: Access is denied.`);
      });
      return st;
    }
    function psGetDate(c) {
      const P = psParams(c.args, { params: ["format", "uformat"], sw: [] }); const d = nowD();
      if (P.format) { const f = P.format; const map = { yyyy: d.getFullYear(), MM: p2(d.getMonth() + 1), dd: p2(d.getDate()), HH: p2(d.getHours()), mm: p2(d.getMinutes()), ss: p2(d.getSeconds()) }; c.io.out(f.replace(/yyyy|MM|dd|HH|mm|ss/g, (m) => map[m])); return 0; }
      c.io.out(""); c.io.out(longDate(d)); c.io.out(""); return 0;
    }
    const PS_INSTANCE = "a1b2c3d4-" + Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0") + "-4e5f-9a8b-0c1d2e3f4a5b";
    function psHost(io) { io.out(""); [["Name", "ConsoleHost"], ["Version", top().psv === "5.1" ? "5.1.26100.2026" : "7.4.6"], ["InstanceId", PS_INSTANCE], ["UI", "System.Management.Automation.Internal.Host.InternalHostUserInterface"], ["CurrentCulture", navigator.language || "en-US"], ["CurrentUICulture", navigator.language || "en-US"], ["PrivateData", "Microsoft.PowerShell.ConsoleHost+ConsoleColorProxy"], ["DebuggerEnabled", "True"], ["IsRunspacePushed", "False"], ["Runspace", "System.Management.Automation.Runspaces.LocalRunspace"]].forEach(([k, v]) => io.out(k.padEnd(17) + ": " + v)); io.out(""); return 0; }
    function psVersionTable(io, sub) {
      const win = top().psv === "5.1";
      if (sub === "psversion") { io.out("\nMajor  Minor  " + (win ? "Build  Revision\n-----  -----  -----  --------\n5      1      26100  2026\n" : "Patch  PreReleaseLabel BuildLabel\n-----  -----  -----  --------------- ----------\n7      4      6\n")); return 0; }
      io.out("\nName                           Value\n----                           -----");
      (win ? [["PSVersion", "5.1.26100.2026"], ["PSEdition", "Desktop"], ["PSCompatibleVersions", "{1.0, 2.0, 3.0, 4.0...}"], ["BuildVersion", "10.0.26100.2026"], ["CLRVersion", "4.0.30319.42000"], ["WSManStackVersion", "3.0"], ["PSRemotingProtocolVersion", "2.3"], ["SerializationVersion", "1.1.0.1"]]
        : [["PSVersion", "7.4.6"], ["PSEdition", "Core"], ["GitCommitId", "7.4.6"], ["OS", "Microsoft Windows " + VERSION], ["Platform", "Win32NT"], ["PSCompatibleVersions", "{1.0, 2.0, 3.0, 4.0…}"], ["PSRemotingProtocolVersion", "2.3"], ["SerializationVersion", "1.1.0.1"], ["WSManStackVersion", "3.0"]]).forEach(([k, v]) => io.out(k.padEnd(31) + v));
      io.out(""); return 0;
    }
    function psPre(line, job) {
      const t = line.trim(); const io = mkIO(job, null, null);
      let m = /^\$PSVersionTable(?:\.(\w+))?$/i.exec(t); if (m) return psVersionTable(io, lc(m[1]));
      if (/^\$host$/i.test(t)) return psHost(io);
      m = /^\$env:([A-Za-z_][\w()]*)\s*=\s*(.*)$/i.exec(t); if (m) { const v = m[2].trim().replace(/^["'](.*)["']$/, "$1"); sessionEnv[m[1].toUpperCase()] = v === "" || /^\$null$/i.test(v) ? null : v; return 0; }
      m = /^\$([A-Za-z_]\w*)\s*=\s*(.*)$/.exec(t);
      if (m) { let v = expand(m[2].trim(), "ps"); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); else if (/^[\d\s+\-*/().%]+$/.test(v)) { try { v = String(evalMath(v)); } catch (_) {} } psVars[lc(m[1])] = v; return 0; }
      if (/^[\d\s+\-*/().%]+$/.test(t) && /\d/.test(t) && /[\d)]\s*$/.test(t)) { try { io.out(String(evalMath(t))); return 0; } catch (_) {} }
      if (/^\$[A-Za-z_]\w*$/.test(t)) { const k = lc(t.slice(1)); const v = k === "home" ? winPath(HOME()) : k === "pwd" ? winPath(cwd()) : psVars[k]; if (v != null && v !== "") io.out(v); return 0; }
      return undefined;
    }
    function psHelp(c) {
      const io = c.io;
      io.out("PowerShell commands (aliases in brackets) — they all work on this PC's real files:\n");
      [["Get-ChildItem", "ls, dir, gci", "-Path -Filter -Recurse -Force -Name -File -Directory"], ["Set-Location", "cd, sl", "cd .. , cd \\, cd ~, cd -"], ["Get-Location", "pwd, gl", ""], ["Get-Content", "cat, gc, type", "-TotalCount N -Tail N"], ["Set-Content", "", "-Path f -Value text"], ["Add-Content", "ac", "-Path f -Value text"], ["New-Item", "ni, mkdir, md", "-ItemType File|Directory -Name -Value -Force"], ["Remove-Item", "rm, del, rd, ri", "-Recurse -Force (system files need -Force)"], ["Copy-Item", "cp, copy, cpi", "-Destination -Recurse -Force"], ["Move-Item", "mv, move, mi", "-Destination -Force"], ["Rename-Item", "ren, rni", "-NewName"], ["Get-Process", "ps, gps", "-Name -Id  (open windows are processes)"], ["Stop-Process", "kill, spps", "-Name notepad | -Id N  (closes the window)"], ["Get-Date", "date", "-Format yyyy-MM-dd"], ["Get-Host / $host", "", ""], ["Clear-Host", "cls, clear", ""], ["Write-Output", "echo, write", "Write-Host too"], ["Select-String", "sls", "ls | sls txt ; -Path f -Pattern x"], ["Sort-Object / Measure-Object", "sort / measure", ""], ["Test-Path", "", "True/False"], ["Start-Process / Invoke-Item", "start / ii", "apps, files, folders, URLs"], ["Invoke-WebRequest", "iwr", "real HTTP; curl/wget also work"], ["Test-Connection / Resolve-DnsName", "", "real network checks"], ["Get-Command / Get-Help / Get-History", "gcm / help / h", ""], ["$PSVersionTable, $env:NAME, $x = 5, 2+3", "", "variables and math"], ["exit", "", "back to Command Prompt"]].forEach(([n, a, d]) => io.out(`  ${n.padEnd(34)}${(a ? "[" + a + "] " : "")}${d}`));
      io.out("\n  Also: ipconfig, ping, tasklist, taskkill, systeminfo, whoami, tree, findstr, sfc, chkdsk, shutdown, wsl, arch, cmd...");
      io.out("  Tab completes, Up/Down = history, Ctrl+C cancels, Ctrl+L clears, | pipes, && chains, > and >> redirect.");
      return 0;
    }
    async function runPS(c) {
      const io = c.io; const n = lc(c.name);
      if (c.words[0].q) { [c.words[0].v].concat(c.a).forEach((x) => io.out(x)); return 0; }
      const k = PS_ALIAS[n] || n;
      const ex = extCmd("ps", k) || extCmd("cmd", n) || extCmd("cmd", n.replace(/\.exe$/, ""));
      if (ex) { const r = await ex(c, { mode: "ps", COL, host: HOSTNAME, userName }); return typeof r === "number" ? r : 0; }
      switch (k) {
        case "get-childitem": return psGci(c);
        case "set-location": return psSetLoc(c);
        case "get-location": io.out("\nPath\n----\n" + winPath(cwd()) + "\n"); return 0;
        case "get-content": return psGetContent(c);
        case "set-content": return psSetContent(c, false);
        case "add-content": return psSetContent(c, true);
        case "out-file": { const P = psParams(c.args, { pos: ["filepath"], params: ["filepath", "encoding"], sw: ["append", "force"] }); const segs = winSegs(P.filepath || "", cwd()); const w = segs ? writeAt(segs, (io.stdin || "") + "\n", !!P.append) : "path"; return w ? psErr(io, "Out-File", fsErr(w, P.filepath)) : 0; }
        case "new-item": return psNewItem(c, false);
        case "mkdir": case "md": return psNewItem(c, true);
        case "remove-item": return psRemove(c);
        case "copy-item": return psCopyMove(c, false);
        case "move-item": return psCopyMove(c, true);
        case "rename-item": return psRename(c);
        case "start-vm": case "vmconnect": case "win12": return vmCmd(c);
        case "get-vm": return vmList(c);
        case "get-process": return psGetProcess(c);
        case "stop-process": return psStopProcess(c);
        case "get-date": return psGetDate(c);
        case "get-host": return psHost(io);
        case "clear-host": clearScreen(); return 0;
        case "write-output": if (!c.a.length && io.stdin != null) printText(io, io.stdin); c.a.forEach((x) => io.out(x)); return 0;
        case "write-host": { const P = psParams(c.args, { params: ["foregroundcolor", "backgroundcolor", "object"], sw: ["nonewline"] }); const map = { red: COL.red, green: COL.green, yellow: COL.yellow, blue: COL.blue, cyan: COL.cyan, white: COL.white, gray: COL.gray, magenta: "#b4009e" }; io.out(P._pos.join(" "), map[lc(P.foregroundcolor)]); return 0; }
        case "select-string": {
          const P = psParams(c.args, { pos: ["pattern", "path"], params: ["pattern", "path"], sw: ["casesensitive", "simplematch", "notmatch", "quiet"] });
          if (P._error) return psErr(io, "Select-String", P._error);
          if (!P.pattern) return psErr(io, "Select-String", "Cannot bind argument to parameter 'Pattern' because it is null.");
          let re; try { re = P.simplematch ? rx("*" + P.pattern.replace(/[*?]/g, "") + "*") : new RegExp(P.pattern, P.casesensitive ? "" : "i"); } catch (_) { re = rx("*" + P.pattern + "*"); }
          const test = (l) => (P.notmatch ? !re.test(l) : re.test(l)); let hits = 0;
          if (P.path) { const list = filesForSearch(P.path, false); if (!list.length) return psErr(io, "Select-String", `Cannot find path '${P.path}' because it does not exist.`); list.forEach(({ h }) => textLines(textOf(h.key, h.node)).forEach((l, i) => { if (test(l)) { hits++; io.out(`${h.key}:${i + 1}:${l}`); } })); }
          else if (io.stdin != null) textLines(io.stdin).forEach((l) => { if (test(l)) { hits++; io.out(l); } });
          return hits ? 0 : 1;
        }
        case "sort-object": return sortCmd(c, c.a.some((x) => /^-desc/i.test(x)), null);
        case "measure-object": { const lines = io.stdin != null ? textLines(io.stdin).filter((l) => l.trim()) : []; io.out(`\nCount             : ${lines.length}\nAverage           : \nSum               : \nMaximum           : \nMinimum           : \nProperty          : \n`); return 0; }
        case "get-history": hist.forEach((h, i) => io.out(`${String(i + 1).padStart(4)} ${h}`)); return 0;
        case "start-process": case "invoke-item": { const P = psParams(c.args, { pos: ["filepath"], params: ["filepath", "argumentlist", "path"], sw: ["wait", "nonewwindow"] }); return startThing(c, P.filepath || P.path); }
        case "invoke-webrequest": {
          const P = psParams(c.args, { pos: ["uri"], params: ["uri", "outfile", "method"], sw: ["usebasicparsing"] });
          if (!P.uri) return psErr(io, "Invoke-WebRequest", "Cannot bind argument to parameter 'Uri' because it is null.");
          if (P.outfile) return doCurl({ a: [P.uri, "-o", P.outfile], io, args: [] }).then((r) => r);
          let url = /^https?:/i.test(P.uri) ? P.uri : "https://" + P.uri;
          try { const r = await fetch(url); const t = await r.text(); io.check(); io.out(`\nStatusCode        : ${r.status}\nStatusDescription : ${r.statusText || (r.ok ? "OK" : "")}\nContent           : ${t.slice(0, 300).replace(/\s+/g, " ")}${t.length > 300 ? "..." : ""}\nRawContentLength  : ${t.length}\n`); return r.ok ? 0 : 1; }
          catch (e) { return psErr(io, "Invoke-WebRequest", "No such host is known, or the site blocks cross-origin requests. (" + url + ")"); }
        }
        case "get-command": { const P = psParams(c.args, { pos: ["name"], params: ["name"], sw: [] }); const re = P.name ? rx(P.name) : null; io.out("\nCommandType     Name                                               Version    Source\n-----------     ----                                               -------    ------"); PS_NAMES.filter((x) => !re || re.test(x)).sort().forEach((x) => io.out(`Cmdlet          ${x.padEnd(51)}7.0.0.0    Microsoft.PowerShell.Management`)); Object.keys(PS_ALIAS).filter((a) => !re || re.test(a)).sort().forEach((a) => { const tgt = PS_NAMES.find((x) => lc(x) === PS_ALIAS[a]); if (tgt) io.out(`Alias           ${(a + " -> " + tgt).padEnd(51)}`); }); io.out(""); return 0; }
        case "get-help": return psHelp(c);
        case "test-path": { const p = c.a.find((x) => !x.startsWith("-")); const segs = p && winSegs(p, cwd()); io.out(segs && walk(segs) ? "True" : "False"); return 0; }
        case "test-connection": return doPing({ a: c.a.filter((x) => !/^-(targetname|computername)$/i.test(x)), io }, false);
        case "resolve-dnsname": return doNslookup(c);
        case "get-item": { const p = c.a.find((x) => !x.startsWith("-")) || "."; const list = psResolve(p, "Get-Item", io); if (!list) return 1; list.forEach(({ h }) => psTable(io, h.canon.slice(0, -1), [[h.canon[h.canon.length - 1] || "C:\\", h.node]])); return 0; }
        case "exit": return exitShell(io);
        case "powershell": return enterPS(io, "5.1");
        case "pwsh": return enterPS(io, "7");
        case "where": case "where-object": io.err("Where-Object isn't supported in this PowerShell. Try: ls | sls pattern"); return 1;
      }
      if (PS_PASS.includes(n) && CMD[n.replace(/\.exe$/, "")]) { const r = await CMD[n.replace(/\.exe$/, "")](c); return typeof r === "number" ? r : 0; }
      if (/\.exe$/i.test(n) && CMD[n.slice(0, -4)]) { const r = await CMD[n.slice(0, -4)](c); return typeof r === "number" ? r : 0; }
      return external(c);
    }

    // ================================================================ Arch Linux (bash)
    function bErr(io, msg) { io.err(msg); return 1; }
    const bq = (n) => (/[\s'"$`\\()&;|<>*?]/.test(n) ? "'" + n.replace(/'/g, "'\\''") + "'" : n);
    function bashFlags(a) { const f = new Set(), rest = []; let endOpts = false; a.forEach((x) => { if (!endOpts && x === "--") { endOpts = true; return; } if (!endOpts && /^-[A-Za-z]+$/.test(x)) x.slice(1).split("").forEach((ch) => f.add(ch)); else if (!endOpts && /^--[a-z-]+$/.test(x)) f.add(x); else rest.push(x); }); return { f, rest }; }
    function bashResolveGlob(p) {   // expand * ? in the last component
      const segs = posixSegs(p, cwd()); const last = segs[segs.length - 1] || "";
      if (!hasWild(last)) return [p];
      const par = walk(segs.slice(0, -1)); if (!par || !isDir(par.node)) return [p];
      const re = rx(last); const prefix = p.slice(0, p.length - last.length);
      const m = entries(par).filter(([n]) => re.test(n) && !n.startsWith(".")).map(([n]) => prefix + n);
      return m.length ? m : [p];
    }
    const permStr = (h) => (isDir(h.node) ? "d" : "-") + (ro(h.node) || writeProtected(h.canon) ? "r-xr-xr-x" : isDir(h.node) ? "rwxr-xr-x" : "rw-r--r--");
    function bashLs(c) {
      const io = c.io; const { f, rest } = bashFlags(c.a);
      const long = f.has("l"), all = f.has("a") || f.has("A"), one = f.has("1"), rec = f.has("R"), human = f.has("h");
      const targets = (rest.length ? rest.flatMap(bashResolveGlob) : ["."]);
      let st = 0;
      const sz = (b) => (human ? (b >= 1048576 ? (b / 1048576).toFixed(1) + "M" : b >= 1024 ? (b / 1024).toFixed(1) + "K" : String(b)) : String(b));
      const owner = (h) => (writeProtected(h.canon) || !h.canon.length || h.node.kind === "system" ? "root root" : `${archUser()} ${archUser()}`);
      const show1 = (hh, label) => {
        io.check();
        let list = entries(hh).filter(([n, node]) => all || (!n.startsWith(".") && !hidden(node)));
        if (label) io.out(label + ":");
        if (long) {
          io.out("total " + list.reduce((s, [n, node]) => s + Math.ceil(fsize(n, node) / 1024) * 4, 0));
          if (all) list = [[".", hh.node], [".."], ...list].filter((x) => x[1]);
          list.forEach(([n, node]) => { const ch = n === "." ? hh : childH(hh, n, node); const size = isDir(node) ? 4096 : fsize(n, node); io.seg([[`${permStr(ch)} ${isDir(node) ? 2 : 1} ${owner(ch)} ${sz(size).padStart(human ? 5 : 8)} ${lsDate(mtime(node))} `, null], [bq(n), isDir(node) ? COL.arch : null]]); });
        } else if (list.length) {
          if (one) list.forEach(([n, node]) => io.seg([[bq(n), isDir(node) ? COL.arch : null]]));
          else { const parts = []; list.forEach(([n, node], i) => { parts.push([bq(n), isDir(node) ? COL.arch : null]); if (i < list.length - 1) parts.push(["  ", null]); }); io.seg(parts); }
        }
        if (rec) list.forEach(([n, node]) => { if (isDir(node) && n !== "." && n !== "..") { io.out(""); const ch = childH(hh, n, node); show1(ch, "." + "/" + ch.canon.slice(walk(posixSegs(targets[0], cwd())).canon.length).join("/")); } });
      };
      const files = [], dirs = [];
      targets.forEach((p) => { const segs = posixSegs(p, cwd()); const h = segs && walk(segs); if (!h) { io.err(`ls: cannot access '${p}': No such file or directory`); st = 2; } else if (isDir(h.node)) dirs.push([p, h]); else files.push([p, h]); });
      files.forEach(([p, h]) => { if (long) io.seg([[`${permStr(h)} 1 ${owner(h)} ${sz(fsize(h.key, h.node)).padStart(8)} ${lsDate(mtime(h.node))} `, null], [p, null]]); else io.out(bq(p)); });
      dirs.forEach(([p, h], i) => { if (files.length || dirs.length > 1) { if (i || files.length) io.out(""); show1(h, p); } else show1(h, rec ? "." : null); });
      return st;
    }
    function bashCd(c) {
      const io = c.io; let p = c.a[0];
      if (p == null || p === "~") { setCwd(HOME()); return 0; }
      if (p === "-") { if (!top().prev) return bErr(io, "bash: cd: OLDPWD not set"); const pv = top().prev; setCwd(pv); io.out(posixPath(pv)); return 0; }
      const segs = posixSegs(p, cwd()); const h = segs && walk(segs);
      if (!h) return bErr(io, `bash: cd: ${p}: No such file or directory`);
      if (!isDir(h.node)) return bErr(io, `bash: cd: ${p}: Not a directory`);
      setCwd(h.canon); return 0;
    }
    function bashMkdir(c, sudo) {
      const io = c.io; const { f, rest } = bashFlags(c.a); let st = 0;
      if (!rest.length) return bErr(io, "mkdir: missing operand");
      rest.forEach((p) => {
        const segs = posixSegs(p, cwd());
        if (walk(segs)) { if (!f.has("p")) { io.err(`mkdir: cannot create directory '${p}': File exists`); st = 1; } return; }
        if (!f.has("p")) { const par = walk(segs.slice(0, -1)); if (!par || !isDir(par.node)) { io.err(`mkdir: cannot create directory '${p}': No such file or directory`); st = 1; return; } }
        if (writeProtected(segs) && !sudo) { io.err(`mkdir: cannot create directory '${p}': Permission denied`); st = 1; return; }
        const e = sudo && writeProtected(segs) ? (() => { const par = walk(segs.slice(0, -1)); if (!par) return "path"; par.node.children[segs[segs.length - 1]] = { type: "folder", children: {}, ts: Date.now() }; return null; })() : mkdirP(segs);
        if (e) { io.err(`mkdir: cannot create directory '${p}': ${e === "denied" ? "Permission denied" : e === "name" ? "Invalid argument" : "No such file or directory"}`); st = 1; }
      });
      save(); return st;
    }
    function bashRm(c, sudo, isRmdir) {
      const io = c.io; const { f, rest } = bashFlags(c.a);
      const recursive = f.has("r") || f.has("R") || f.has("--recursive"), force = f.has("f") || f.has("--force");
      const verb = isRmdir ? "rmdir" : "rm";
      if (!rest.length) return force ? 0 : bErr(io, `${verb}: missing operand\nTry '${verb} --help' for more information.`);
      let st = 0, boom = false;
      rest.flatMap(bashResolveGlob).forEach((p) => {
        const segs = posixSegs(p, cwd()); const h = segs && walk(segs);
        if (!segs.length && recursive && !f.has("--no-preserve-root")) { io.err("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe"); st = 1; return; }
        if (!h) { if (!force) { io.err(`${verb}: cannot remove '${p}': No such file or directory`); st = 1; } return; }
        if (isRmdir) { if (!isDir(h.node)) { io.err(`rmdir: failed to remove '${p}': Not a directory`); st = 1; return; } if (entries(h).length) { io.err(`rmdir: failed to remove '${p}': Directory not empty`); st = 1; return; } }
        else if (isDir(h.node) && !recursive) { io.err(`rm: cannot remove '${p}': Is a directory`); st = 1; return; }
        const g = guard(h, sudo);
        if (g === "hard" || g === "deny") { io.err(`${verb}: cannot remove '${p}': Permission denied`); st = 1; return; }
        const inside = cwd().length >= h.canon.length && h.canon.every((x, i) => lc(x) === lc(cwd()[i]));
        if (inside && h.canon.length) setCwd(h.canon.slice(0, -1));
        removeH(h); if (g === "bsod") boom = true;
        if (f.has("v")) io.out(`removed '${p}'`);
      });
      save(); if (boom) crash();
      return st;
    }
    function bashCpMv(c, isMove, sudo) {
      const io = c.io; const { f, rest } = bashFlags(c.a); const verb = isMove ? "mv" : "cp";
      const items = rest.flatMap(bashResolveGlob);
      if (items.length < 2) return bErr(io, `${verb}: missing ${items.length ? "destination file operand after '" + items[0] + "'" : "file operand"}`);
      const dst = items.pop(); const dsegs = posixSegs(dst, cwd()); const dh = walk(dsegs); const intoDir = dh && isDir(dh.node);
      if (items.length > 1 && !intoDir) return bErr(io, `${verb}: target '${dst}': Not a directory`);
      let st = 0;
      items.forEach((p) => {
        const segs = posixSegs(p, cwd()); const h = segs && walk(segs);
        if (!h) { io.err(`${verb}: cannot stat '${p}': No such file or directory`); st = 1; return; }
        if (isDir(h.node) && !isMove && !(f.has("r") || f.has("R") || f.has("a"))) { io.err(`cp: -r not specified; omitting directory '${p}'`); st = 1; return; }
        const nm = intoDir ? h.canon[h.canon.length - 1] : dsegs[dsegs.length - 1];
        const parH = intoDir ? dh : walk(dsegs.slice(0, -1));
        if (!parH || !isDir(parH.node)) { io.err(`${verb}: cannot create regular file '${dst}': No such file or directory`); st = 1; return; }
        const tcanon = parH.canon.concat(nm);
        const g = guard(h, sudo);
        if (h.node.virtual || (isMove && (g === "deny" || g === "hard")) || (writeProtected(tcanon) && !sudo)) { io.err(`${verb}: cannot ${isMove ? "move" : "create"} '${p}': Permission denied`); st = 1; return; }
        if (isDir(h.node) && tcanon.map(lc).join("/").startsWith(h.canon.map(lc).join("/") + "/")) { io.err(`${verb}: cannot ${isMove ? "move" : "copy"} '${p}' to a subdirectory of itself, '${dst}'`); st = 1; return; }
        const ex = keyIn(parH.node.children, nm);
        if (ex && parH.node.children[ex] === h.node) { io.err(`${verb}: '${p}' and '${dst}' are the same file`); st = 1; return; }
        if (ex && isDir(parH.node.children[ex]) && !isDir(h.node)) { io.err(`${verb}: cannot overwrite directory '${dst}' with non-directory`); st = 1; return; }
        if (ex) { if (f.has("n")) return; delete parH.node.children[ex]; }
        const boomNow = isMove && sys32Hit(h.canon);
        if (isMove) { delete h.parent[h.key]; parH.node.children[ex || nm] = h.node; } else parH.node.children[ex || nm] = clone(h.node);
        if (f.has("v")) io.out(`'${p}' -> '${dst}'`);
        if (boomNow) crash();
      });
      save(); return st;
    }
    function bashTouch(c, sudo) {
      const io = c.io; const { rest } = bashFlags(c.a); let st = 0;
      if (!rest.length) return bErr(io, "touch: missing file operand");
      rest.forEach((p) => { const segs = posixSegs(p, cwd()); const h = walk(segs); if (h) { if (writeProtected(h.canon) && !sudo) { io.err(`touch: cannot touch '${p}': Permission denied`); st = 1; return; } h.node.ts = Date.now(); return; } const w = writeAt(segs, "", false); if (w) { io.err(`touch: cannot touch '${p}': ${w === "denied" ? "Permission denied" : "No such file or directory"}`); st = 1; } });
      save(); return st;
    }
    function bashRead(io, p, verb) {
      if (p === "-") return io.stdin || "";
      const v = VIRTUAL_ETC()[p]; if (v != null) return v + "\n";
      const segs = posixSegs(p, cwd()); const h = segs && walk(segs);
      if (!h) { io.err(`${verb}: ${p}: No such file or directory`); return null; }
      if (isDir(h.node)) { io.err(`${verb}: ${p}: Is a directory`); return null; }
      return textOf(h.key, h.node);
    }
    function bashCat(c) {
      const io = c.io; const { f, rest } = bashFlags(c.a);
      if (!rest.length) { if (io.stdin != null) printText(io, io.stdin); return 0; }
      let st = 0; let n = 0;
      rest.flatMap(bashResolveGlob).forEach((p) => { const t = bashRead(io, p, "cat"); if (t == null) { st = 1; return; } if (f.has("n")) textLines(t).forEach((l) => io.out(String(++n).padStart(6) + "\t" + l)); else printText(io, t); });
      return st;
    }
    function bashHeadTail(c, tail) {
      const io = c.io; let n = 10; const files = [];
      for (let i = 0; i < c.a.length; i++) { const x = c.a[i]; if (x === "-n") n = parseInt(c.a[++i], 10) || 0; else if (/^-n\d+$/.test(x)) n = parseInt(x.slice(2), 10); else if (/^-\d+$/.test(x)) n = parseInt(x.slice(1), 10); else files.push(x); }
      const emitL = (t) => { let l = textLines(t); if (l.length === 1 && l[0] === "") l = []; (tail ? l.slice(-n || l.length) : l.slice(0, n)).forEach((x) => io.out(x)); };
      if (!files.length) { if (io.stdin != null) emitL(io.stdin); return 0; }
      let st = 0;
      files.forEach((p, i) => { const t = bashRead(io, p, tail ? "tail" : "head"); if (t == null) { st = 1; return; } if (files.length > 1) io.out((i ? "\n" : "") + `==> ${p} <==`); emitL(t); });
      return st;
    }
    function bashWc(c) {
      const io = c.io; const { f, rest } = bashFlags(c.a); const any = f.has("l") || f.has("w") || f.has("c") || f.has("m");
      const fmt = (t, label) => { const s = String(t); const L = (s.match(/\n/g) || []).length, W = (s.match(/\S+/g) || []).length; let B; try { B = new TextEncoder().encode(s).length; } catch (_) { B = s.length; } const cols = []; if (!any || f.has("l")) cols.push(L); if (!any || f.has("w")) cols.push(W); if (!any || f.has("c") || f.has("m")) cols.push(B); return cols.map((x) => String(x).padStart(any && cols.length === 1 && label == null ? 1 : 7)).join(" ") + (label != null ? " " + label : ""); };
      if (!rest.length) { io.out(fmt(io.stdin != null ? (io.stdin.endsWith("\n") || !io.stdin ? io.stdin : io.stdin + "\n") : "", null).trim()); return 0; }
      let st = 0; rest.forEach((p) => { const t = bashRead(io, p, "wc"); if (t == null) { st = 1; return; } io.out(fmt(t, p)); });
      return st;
    }
    function bashGrep(c) {
      const io = c.io; const { f, rest } = bashFlags(c.a);
      if (!rest.length) return (io.err("Usage: grep [OPTION]... PATTERNS [FILE]..."), 2);
      const pat = rest[0]; let re; try { re = new RegExp(f.has("F") ? pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : pat, f.has("i") ? "i" : ""); } catch (_) { return (io.err("grep: Invalid regular expression"), 2); }
      const inv = f.has("v"), num_ = f.has("n"), cnt = f.has("c"), listOnly = f.has("l"), rec = f.has("r") || f.has("R");
      const test = (l) => (inv ? !re.test(l) : re.test(l)); let hits = 0;
      const scan = (t, label) => { let k = 0; textLines(t).forEach((l, i) => { if (test(l)) { k++; hits++; if (!cnt && !listOnly) io.seg((label ? [[label, "#b4009e"], [":", COL.arch]] : []).concat(num_ ? [[String(i + 1), COL.green], [":", COL.arch]] : []).concat([[l, null]])); } }); if (cnt) io.out((label ? label + ":" : "") + k); if (listOnly && k) io.out(label); };
      let files = rest.slice(1).flatMap(bashResolveGlob);
      if (!files.length) { if (rec) files = ["."]; else { if (io.stdin != null) scan(io.stdin, null); return hits ? 0 : 1; } }
      const multi = files.length > 1 || rec; let st = 0;
      files.forEach((p) => {
        const segs = posixSegs(p, cwd()); const h = segs && walk(segs);
        if (!h) { io.err(`grep: ${p}: No such file or directory`); st = 2; return; }
        if (isDir(h.node)) { if (!rec) { io.err(`grep: ${p}: Is a directory`); return; } (function g(hh, pre) { entries(hh).forEach(([n, node]) => { const ch = childH(hh, n, node); if (isDir(node)) g(ch, pre + n + "/"); else if (isTextual(node)) scan(textOf(n, node), pre + n); }); })(h, p === "." ? "" : p.replace(/\/$/, "") + "/"); return; }
        scan(textOf(h.key, h.node), multi ? p : null);
      });
      return st || (hits ? 0 : 1);
    }
    function bashFind(c) {
      const io = c.io; const a = c.a.slice(); const starts = [];
      while (a.length && !a[0].startsWith("-")) starts.push(a.shift());
      if (!starts.length) starts.push(".");
      let name = null, iname = null, type = null, maxd = Infinity;
      for (let i = 0; i < a.length; i++) { if (a[i] === "-name") name = rx(a[++i]); else if (a[i] === "-iname") iname = rx(a[++i]); else if (a[i] === "-type") type = a[++i]; else if (a[i] === "-maxdepth") maxd = parseInt(a[++i], 10); else return bErr(io, `find: unknown predicate '${a[i]}'`); }
      let st = 0;
      starts.forEach((s) => {
        const segs = posixSegs(s, cwd()); const h = segs && walk(segs);
        if (!h) { io.err(`find: '${s}': No such file or directory`); st = 1; return; }
        const ok = (n, node) => (!name || name.test(n)) && (!iname || iname.test(n)) && (!type || (type === "d" ? isDir(node) : !isDir(node)));
        if (ok(h.canon[h.canon.length - 1] || "/", h.node)) io.out(s);
        (function g(hh, pre, d) { if (d >= maxd) return; io.check(); entries(hh).forEach(([n, node]) => { const pth = pre + "/" + n; if (ok(n, node)) io.out(pth); if (isDir(node)) g(childH(hh, n, node), pth, d + 1); }); })(h, s.replace(/\/$/, "") || "", 0);
      });
      return st;
    }
    function bashTree(c) {
      const io = c.io; const { f, rest } = bashFlags(c.a); const p = rest[0] || ".";
      const segs = posixSegs(p, cwd()); const h = segs && walk(segs);
      if (!h || !isDir(h.node)) { io.out(`${p}  [error opening dir]\n\n0 directories, 0 files`); return 2; }
      io.seg([[p, COL.arch]]);
      const t = treeLines(h, !f.has("d"), false, true); t.lines.forEach((l) => io.out(l));
      io.out(`\n${t.nd} director${t.nd === 1 ? "y" : "ies"}${f.has("d") ? "" : `, ${t.nf} file${t.nf === 1 ? "" : "s"}`}`); return 0;
    }
    function neofetch(c) {
      if (isUbuntu()) return neofetchUbuntu(c);
      const io = c.io; const A = COL.arch, W = COL.input;
      const art = ["                  -`", "                 .o+`", "                `ooo/", "               `+oooo:", "              `+oooooo:", "              -+oooooo+:", "            `/:-:++oooo+:", "           `/++++/+++++++:", "          `/++++++++++++++:", "         `/+++ooooooooooooo/`", "        ./ooosssso++osssssso+`", "       .oossssso-````/ossssss+`", "      -osssssso.      :ssssssso.", "     :osssssss/        osssso+++.", "    /ossssssss/        +ssssooo/-", "  `/ossssso+/:-        -:/+osssso+-", " `+sso+:-`                 `.-/+oso:", "`++:.                          `-/+/", ".`                                 `/"];
      const mem = navigator.deviceMemory ? navigator.deviceMemory * 1024 : 4096;
      const info = [[`${archUser()}@arch`, null], ["-".repeat(archUser().length + 5), null], ["OS", "Arch Linux (WSL on Windows 12)"], ["Kernel", "6.9.1-arch1-1"], ["Uptime", Math.max(1, Math.round(performance.now() / 60000)) + " mins"], ["Packages", "148 (pacman)"], ["Shell", "bash 5.2"], ["Resolution", screen.width + "x" + screen.height], ["Terminal", "Windows Terminal"], ["CPU", `Cameron Virtual CPU (${navigator.hardwareConcurrency || 4})`], ["Memory", `${Math.round(mem / 8)}MiB / ${mem}MiB`], ["Disk (/)", `${Math.round((DISK.total - DISK.free) / 1073741824)}G / ${Math.round(DISK.total / 1073741824)}G`]];
      art.forEach((l, i) => { const inf = info[i]; const parts = [[l.padEnd(38), A]]; if (inf) { if (inf[1] == null) parts.push([inf[0], i === 0 ? W : null]); else parts.push([inf[0], A], [": " + inf[1], null]); } io.seg(parts); });
      return 0;
    }
    function neofetchUbuntu(c) {
      const io = c.io, O = V("orange", "#e95420"), W = COL.input; const mem = navigator.deviceMemory ? navigator.deviceMemory * 1024 : 4096;
      const art = ["            .-/+oossssoo+/-.", "        `:+ssssssssssssssssss+:`", "      -+ssssssssssssssssssyyssss+-", "    .ossssssssssssssssssdMMMNysssso.", "   /ssssssssssshdmmNNmmyNMMMMhssssss/", "  +ssssssssshmydMMMMMMMNddddyssssssss+", " /sssssssshNMMMyhhyyyyhmNMMMNhssssssss/", ".ssssssssdMMMNhsssssssssshNMMMdssssssss.", "+sssshhhyNMMNyssssssssssssyNMMMysssssss+", "ossyNMMMNyMMhsssssssssssssshmmmhssssssso", "+sssshhhyNMMNyssssssssssssyNMMMysssssss+", ".ssssssssdMMMNhsssssssssshNMMMdssssssss.", " /sssssssshNMMMyhhyyyyhdNMMMNhssssssss/", "  +sssssssssdmydMMMMMMMMddddyssssssss+", "   /ssssssssssshdmNNNNmyNMMMMhssssss/", "    .ossssssssssssssssssdMMMNysssso.", "      -+sssssssssssssssssyyyssss+-"];
      const info = [[`${archUser()}@${HOSTNAME}`, null], ["-".repeat(archUser().length + HOSTNAME.length + 1), null], ["OS", "Ubuntu 24.04.1 LTS on Windows 12 x86_64"], ["Kernel", "5.15.167.4-microsoft-standard-WSL2"], ["Uptime", Math.max(1, Math.round(performance.now() / 60000)) + " mins"], ["Packages", "602 (dpkg)"], ["Shell", "bash 5.2.21"], ["Terminal", "Windows Terminal"], ["CPU", `Cameron Virtual CPU (${navigator.hardwareConcurrency || 4})`], ["Memory", `${Math.round(mem / 8)}MiB / ${mem}MiB`]];
      art.forEach((l, i) => { const inf = info[i]; const parts = [[l.padEnd(42), O]]; if (inf) { if (inf[1] == null) parts.push([inf[0], i === 0 ? W : null]); else parts.push([inf[0], O], [": " + inf[1], null]); } io.seg(parts); });
      return 0;
    }
    async function aptCmd(c, sudo) {
      const io = c.io, a = c.a, sub = a[0] || "";
      if (sub === "list" && a.includes("--installed")) { ["bash/noble 5.2.21-2ubuntu4 amd64 [installed]", "coreutils/noble 9.4-3ubuntu6 amd64 [installed]", "git/noble 1:2.43.0-1ubuntu7 amd64 [installed]", "python3/noble 3.12.3-0ubuntu2 amd64 [installed]"].forEach((x) => io.out(x)); return 0; }
      if (!sudo && /^(install|update|upgrade|remove)$/.test(sub)) { io.err("E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock, are you root?"); return 100; }
      if (sub === "update") { for (const l of ["Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease", "Hit:2 http://security.ubuntu.com/ubuntu noble-security InRelease", "Reading package lists... Done", "Building dependency tree... Done", "All packages are up to date."]) { await io.sleep(180); io.out(l); } return 0; }
      if (sub === "upgrade") { io.out("Reading package lists... Done\nBuilding dependency tree... Done\nCalculating upgrade... Done\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded."); return 0; }
      if (sub === "install" && a[1]) { io.out("Reading package lists... Done\nBuilding dependency tree... Done"); await io.sleep(300); io.out(`The following NEW packages will be installed:\n  ${a.slice(1).filter((x) => !x.startsWith("-")).join(" ")}\nSetting up ${a[a.length - 1]} ...`); io.out("(simulated: packages are not really downloaded)", COL.gray); return 0; }
      if (sub === "remove" && a[1]) { io.out(`Removing ${a[1]} ...`); return 0; }
      io.out("apt 2.7.14 (amd64)\nUsage: apt [options] command\n\nMost used commands:\n  list - list packages\n  update - update list of available packages\n  upgrade - upgrade the system\n  install - install packages\n  remove - remove packages"); return 0;
    }
    function pacman(c) {
      const io = c.io; const a = c.a;
      if (a[0] === "-S" && a[1]) return (async () => { io.out("resolving dependencies..."); io.out("looking for conflicting packages..."); await io.sleep(300); io.out(`\nPackages (1) ${a[1]}-latest\n\n:: Proceed with installation? [Y/n] y`); io.out(":: Retrieving packages..."); await io.sleep(400); io.out(`installing ${a[1]}...`); io.out(`${a[1]} installed successfully.`, COL.green); return 0; })();
      if (a[0] === "-Syu" || a[0] === "-Sy") { io.out(":: Synchronizing package databases...\n core is up to date\n extra is up to date"); io.out(":: Starting full system upgrade... there is nothing to do", COL.green); return 0; }
      if (a[0] === "-Q") { ["bash 5.2.026-2", "coreutils 9.5-1", "glibc 2.39-4", "linux 6.9.1.arch1-1", "pacman 6.1.0-3"].forEach((x) => io.out(x)); return 0; }
      if (a[0] === "-R" && a[1]) { io.out(`removing ${a[1]}...`); return 0; }
      io.err("usage: pacman -S <pkg> | pacman -Syu | pacman -Q | pacman -R <pkg>"); return 1;
    }
    const BASH_HELP = [["ls [-la] [path]", "list files (-l long, -a all, -R recursive, -h sizes)"], ["cd [dir|..|~|-]", "change directory"], ["pwd", "print working directory"], ["mkdir [-p] dir", "make directories"], ["rm [-rf] path / rmdir", "remove (system files need sudo)"], ["cp [-r] src dst / mv src dst", "copy / move or rename"], ["touch file", "create a file or update its time"], ["cat / head / tail [-n N] / wc [-lwc]", "read files"], ["echo text > file / >> file", "write / append"], ["grep [-inrvc] pattern [files]", "search text (works in pipes)"], ["find [path] -name '*.txt' -type f", "find files"], ["tree [-d]", "folder tree"], ["sort, uniq, less, more", "text tools"], ["nano / vim file", "open a file in Notepad"], ["uname [-a], whoami, hostname, id, date", "system info"], ["df -h, free -h, ps, neofetch", "real disk / memory / processes"], ["pacman -S pkg / -Syu / -Q", "packages"], ["curl / wget / ping host", "real network"], ["explorer.exe . , cmd.exe, powershell.exe", "Windows interop"], ["clear, history, exit", ""]];
    async function runBash(c) {
      const io = c.io; let name = c.name; let sudo = false;
      if (name === "sudo") { if (!c.args.length) return bErr(io, "usage: sudo command"); sudo = true; c = Object.assign({}, c, { name: c.args[0].v, words: c.args, args: c.args.slice(1), a: c.a.slice(1) }); name = c.name; }
      switch (name) {
        case "help": io.out("GNU bash, version 5.2 (" + (isUbuntu() ? "Ubuntu 24.04 LTS" : "Arch Linux") + " on WSL). Works on this PC's real files: / = C:\\, ~ = C:\\Users\\" + userName() + "\n"); BASH_HELP.forEach(([k, d]) => io.out("  " + k.padEnd(42) + d)); io.out("\n  Tab completes, Up/Down = history, Ctrl+C cancels, Ctrl+L clears, | pipes, && chains, > >> redirect."); return 0;
        case "ls": case "dir": return bashLs(c);
        case "ll": return bashLs(Object.assign({}, c, { a: ["-la"].concat(c.a) }));
        case "cd": return bashCd(c);
        case "pwd": io.out(posixPath(cwd())); return 0;
        case "mkdir": return bashMkdir(c, sudo);
        case "rm": return bashRm(c, sudo, false);
        case "rmdir": return bashRm(c, sudo, true);
        case "cp": return bashCpMv(c, false, sudo);
        case "mv": return bashCpMv(c, true, sudo);
        case "touch": return bashTouch(c, sudo);
        case "cat": return bashCat(c);
        case "less": case "more": return bashCat(c);
        case "head": return bashHeadTail(c, false);
        case "tail": return bashHeadTail(c, true);
        case "wc": return bashWc(c);
        case "grep": case "egrep": return bashGrep(c);
        case "find": return bashFind(c);
        case "tree": return bashTree(c);
        case "sort": { const { f, rest } = bashFlags(c.a); return sortCmd(c, f.has("r"), rest[0]); }
        case "uniq": { const t = c.a[0] ? bashRead(io, c.a[0], "uniq") : io.stdin; if (t == null) return 1; let prev = null; textLines(t).forEach((l) => { if (l !== prev) io.out(l); prev = l; }); return 0; }
        case "echo": { let a = c.a.slice(); let nl = true; while (a[0] === "-n" || a[0] === "-e") { if (a[0] === "-n") nl = false; a.shift(); } const ee = c.a.includes("-e"); io.out(a.join(" ").replace(/\\n/g, ee ? "\n" : "\\n").replace(/\\a/g, ee ? "\u0007" : "\\a")); return 0; }
        case "printf": io.out((c.a[0] || "").replace(/\\n$/, "").replace(/\\n/g, "\n").replace(/\\a/g, "\u0007").replace(/%s/g, () => c.a[1] || "")); return 0;
        case "uname": io.out(isUbuntu() ? (c.a.includes("-a") ? `Linux ${HOSTNAME} 5.15.167.4-microsoft-standard-WSL2 #1 SMP x86_64 x86_64 x86_64 GNU/Linux` : c.a.includes("-r") ? "5.15.167.4-microsoft-standard-WSL2" : "Linux") : c.a.includes("-a") ? "Linux arch 6.9.1-arch1-1 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux" : c.a.includes("-r") ? "6.9.1-arch1-1" : "Linux"); return 0;
        case "lsb_release": if (!isUbuntu()) { io.err("bash: lsb_release: command not found"); return 127; } io.out("Distributor ID:\tUbuntu\nDescription:\tUbuntu 24.04.1 LTS\nRelease:\t24.04\nCodename:\tnoble"); return 0;
        case "apt": case "apt-get": if (!isUbuntu()) { io.err(`bash: ${name}: command not found`); return 127; } return aptCmd(c, sudo);
        case "whoami": io.out(sudo ? "root" : archUser()); return 0;
        case "id": io.out(sudo ? "uid=0(root) gid=0(root) groups=0(root)" : `uid=1000(${archUser()}) gid=1000(${archUser()}) groups=1000(${archUser()}),${isUbuntu() ? "27(sudo)" : "998(wheel)"}`); return 0;
        case "hostname": io.out(isUbuntu() ? HOSTNAME : "arch"); return 0;
        case "date": { const d = nowD(); let tz = ""; try { tz = (d.toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop()) || ""; } catch (_) {} let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; io.out(`${DAYS[d.getDay()].slice(0, 3)} ${MON[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${p2(h)}:${p2(d.getMinutes())}:${p2(d.getSeconds())} ${ap} ${tz} ${d.getFullYear()}`); return 0; }
        case "clear": clearScreen(); return 0;
        case "exit": case "logout": return exitShell(io);
        case "history": return historyCmd(c);
        case "neofetch": case "fastfetch": return neofetch(c);
        case "pacman": if (isUbuntu()) { io.err("Command 'pacman' not found, but can be installed with:\nsudo apt install pacman-package-manager"); return 127; } return sudo || /^-Q/.test(c.a[0] || "") ? pacman(c) : bErr(io, "error: you cannot perform this operation unless you are root.");
        case "which": { let st = 0; c.a.forEach((x) => { const known = ["ls", "cat", "grep", "find", "bash", "pacman", "tree", "curl", "wget", "ping", "nano", "vim"]; if (known.includes(x)) io.out("/usr/bin/" + x); else { io.err(`which: no ${x} in (/usr/local/sbin:/usr/local/bin:/usr/bin)`); st = 1; } }); return st; }
        case "env": case "printenv": ["HOME", "USER", "SHELL", "PATH", "LANG", "TERM", "HOSTNAME", "PWD", "WSL_DISTRO_NAME"].forEach((k) => io.out(k + "=" + bashVar(k))); Object.keys(bashEnv).forEach((k) => io.out(k + "=" + bashEnv[k])); return 0;
        case "export": return 0;
        case "man": io.out(c.a[0] ? `No manual entry for ${c.a[0]}` : "What manual page do you want?\nFor example, try 'man man'."); return c.a[0] ? 16 : 1;
        case "df": { const g = (b) => (c.a.includes("-h") ? (b / 1073741824).toFixed(0) + "G" : String(Math.round(b / 1024))); io.out("Filesystem      Size  Used Avail Use% Mounted on"); io.out(`C:\\             ${g(DISK.total).padStart(5)} ${g(DISK.total - DISK.free).padStart(5)} ${g(DISK.free).padStart(5)} ${String(Math.round((DISK.total - DISK.free) / DISK.total * 100)).padStart(3)}% /`); return 0; }
        case "free": { const mem = (navigator.deviceMemory || 4) * 1024; const used = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : Math.round(mem / 8); io.out("               total        used        free      shared  buff/cache   available"); io.out(`Mem:     ${String(mem + "Mi").padStart(11)} ${String(used + "Mi").padStart(11)} ${String(mem - used + "Mi").padStart(11)}         0Mi       128Mi ${String(mem - used + "Mi").padStart(11)}`); return 0; }
        case "ps": io.out("    PID TTY          TIME CMD"); io.out("      1 ?        00:00:01 init"); io.out("    412 pts/0    00:00:00 bash"); windowsList().forEach((w) => io.out(`${String(w.pid).padStart(7)} ?        00:00:00 ${w.image}`)); io.out(`${String(9000 + Math.floor(Math.random() * 900)).padStart(7)} pts/0    00:00:00 ps`); return 0;
        case "kill": { const pid = parseInt(c.a.filter((x) => !x.startsWith("-"))[0], 10); const w = windowsList().find((x) => x.pid === pid); if (!w) return bErr(io, `bash: kill: (${c.a[0] || ""}) - No such process`); if (w.el.contains(termEl)) { setTimeout(() => winRef.close(), 200); return 0; } return closeWin(w) ? 0 : bErr(io, `bash: kill: (${pid}) - Operation not permitted`); }
        case "nano": case "vim": case "vi": case "code": case "xdg-open": {
          const p = c.a[0]; if (!p) { launchApp(name === "code" ? "vscode" : "notepad"); return 0; }
          const segs = posixSegs(p, cwd()); let h = walk(segs);
          if (!h && name !== "xdg-open") { const w = writeAt(segs, "", false); if (w) return bErr(io, `${name}: ${p}: ${w === "denied" ? "Permission denied" : "No such file or directory"}`); h = walk(segs); }
          if (!h) return bErr(io, `xdg-open: file '${p}' does not exist`);
          if (isDir(h.node)) { openExplorerAt(h.canon); return 0; }
          if (window.VFS && window.VFS.openNode) window.VFS.openNode(h.key, h.node); io.out(`Opened ${p} in ${name === "code" ? "the editor" : "Notepad"}.`, COL.gray); return 0;
        }
        case "chmod": { const mode_ = c.a[0] || ""; const segs = c.a[1] && posixSegs(c.a[1], cwd()); const h = segs && walk(segs); if (!h) return bErr(io, `chmod: cannot access '${c.a[1] || ""}': No such file or directory`); if (/-w|a-w|^[0-5][0-5][0-5]$/.test(mode_)) h.node.attr = (h.node.attr || "").replace("R", "") + "R"; else if (/\+w|^[67]/.test(mode_)) { h.node.attr = (h.node.attr || "").replace("R", ""); if (!h.node.attr) delete h.node.attr; } save(); return 0; }
        case "ping": return doPing(c, true);
        case "curl": return doCurl(c);
        case "wget": return doCurl(c, "");
        case "last": return doLast(c);
        case "who": case "w": return doWho(c);
        case "nslookup": case "host": case "dig": return doNslookup(c);
        case "ip": case "ifconfig": io.out(`2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n    link/ether ${TS().mac.toLowerCase().replace(/-/g, ":")}\n    inet ${TS().ip}/24 brd 192.168.1.255 scope global eth0`); return 0;
        case "true": return 0;
        case "false": return 1;
        case "sleep": { const n = parseFloat(c.a[0]) || 0; await io.sleep(n * 1000); return 0; }
        case "explorer.exe": case "explorer": { if (!c.a[0]) { launchApp("fileexplorer"); return 0; } const segs = posixSegs(c.a[0], cwd()); const h = walk(segs); if (!h) return bErr(io, "explorer.exe: path not found"); if (isDir(h.node)) openExplorerAt(h.canon); else if (window.VFS) window.VFS.openNode(h.key, h.node); return 0; }
        case "cmd.exe": return enterCmd(io);
        case "powershell.exe": return enterPS(io, "5.1");
        case "pwsh.exe": case "pwsh": return enterPS(io, "7");
        case "wsl": case "wsl.exe": io.out(`You're already inside ${isUbuntu() ? "Ubuntu" : "Arch Linux"} (WSL). Type 'exit' to go back to Windows.`); return 0;
      }
      if (/\.exe$/i.test(name)) { const id = findApp(name); if (id) { launchApp(id); return 0; } }
      if (/^\.?\//.test(name)) { const segs = posixSegs(name, cwd()); const h = walk(segs); if (!h) return bErr(io, `bash: ${name}: No such file or directory`); if (isDir(h.node)) return bErr(io, `bash: ${name}: Is a directory`); return bErr(io, `bash: ${name}: Permission denied`); }
      io.err(`bash: ${name}: command not found`); return 127;
    }

    // ================================================================ keyboard: history, Tab, Ctrl+C, Ctrl+L
    const BASH_CMDS = ["ls", "ll", "cd", "pwd", "mkdir", "rm", "rmdir", "cp", "mv", "touch", "cat", "less", "more", "head", "tail", "wc", "grep", "find", "tree", "sort", "uniq", "echo", "printf", "uname", "whoami", "id", "hostname", "date", "clear", "exit", "history", "neofetch", "pacman", "sudo", "which", "env", "export", "man", "df", "free", "ps", "kill", "nano", "vim", "code", "xdg-open", "chmod", "ping", "curl", "wget", "last", "who", "nslookup", "ip", "sleep", "explorer.exe", "cmd.exe", "powershell.exe", "help", "apt", "lsb_release"];
    function commandNames() {
      const m = mode();
      if (m === "bash") return BASH_CMDS;
      if (m === "ps") return PS_NAMES.concat(Object.keys(PS_ALIAS), PS_PASS, ["exit", "mkdir", "md"]);
      return Object.keys(CMD).filter((k) => k !== "/?").concat(["notepad", "mspaint", "taskmgr", "control"]);
    }
    function tokenStart(before) { let inQ = false, start = 0; for (let i = 0; i < before.length; i++) { const ch = before[i]; if (ch === '"') inQ = !inQ; else if (!inQ && (/\s/.test(ch) || "|&;<>".includes(ch))) start = i + 1; else if (!inQ && mode() === "bash" && ch === "\\") i++; } return start; }
    function completions(before) {
      const start = tokenStart(before); const m = mode();
      let word = before.slice(start); word = m === "bash" ? word.replace(/\\(.)/g, "$1").replace(/^['"]/, "") : word.replace(/"/g, "");
      const lead = before.slice(0, start);
      const first = !lead.trim() || /(\||&&|;|&|\bsudo)\s*$/.test(lead);
      const cmdWord = (lead.trim().split(/\s+/).pop() || "").toLowerCase();
      const dirsOnly = !first && /^(cd|chdir|rd|rmdir|pushd|set-location|sl)$/i.test(lead.trim().split(/\s+/)[0] || "") && cmdWord !== "";
      let cands = [];
      if (first && !/[\\/]/.test(word)) {
        const lw = lc(word);
        cands = Array.from(new Set(commandNames())).filter((x) => lc(x).startsWith(lw)).sort().map((x) => ({ text: x, dir: false, cmd: true }));
        if (m === "bash") return { start, word, cands };
      }
      const sepIdx = Math.max(word.lastIndexOf("\\"), word.lastIndexOf("/"));
      const dirPart = sepIdx >= 0 ? word.slice(0, sepIdx + 1) : "";
      const base = word.slice(sepIdx + 1);
      const dsegs = dirPart ? segsFor(dirPart === "/" || dirPart === "\\" ? dirPart : dirPart) : cwd();
      const dh = dsegs && walk(dsegs);
      if (dh && isDir(dh.node)) {
        const lb = lc(base);
        entries(dh).filter(([n, node]) => lc(n).startsWith(lb) && (!dirsOnly || isDir(node)) && (!n.startsWith(".") || base.startsWith("."))).forEach(([n, node]) => cands.push({ text: dirPart + n, dir: isDir(node) }));
      }
      return { start, word, cands };
    }
    function quoteFor(text, dir) {
      const m = mode();
      if (m === "bash") return text.replace(/([\s'"$`\\()&;|<>*?])/g, "\\$1") + (dir ? "/" : "");
      const q = /[\s&()^,;=]/.test(text) ? '"' + text + '"' : text;
      return m === "ps" && dir ? q : q;
    }
    function applyCompletion(before, after, start, txt) { cmd.value = before.slice(0, start) + txt + after; const pos = start + txt.length; cmd.setSelectionRange(pos, pos); }
    function onTab(back) {
      const v = cmd.value, pos = cmd.selectionStart || v.length;
      if (tabState && tabState.value === v && tabState.pos === pos && mode() !== "bash") {
        const s = tabState; s.idx = (s.idx + (back ? -1 : 1) + s.cands.length) % s.cands.length;
        const c = s.cands[s.idx]; applyCompletion(s.before, s.after, s.start, c.cmd ? c.text : quoteFor(c.text, c.dir));
        tabState.value = cmd.value; tabState.pos = cmd.selectionStart; return;
      }
      const before = v.slice(0, pos), after = v.slice(pos);
      const { start, word, cands } = completions(before);
      if (!cands.length) { tabState = null; if (mode() === "bash" && o.onBell) try { o.onBell(); } catch (_) {} return; }
      if (mode() === "bash") {
        if (cands.length === 1) { const c = cands[0]; applyCompletion(before, after, start, c.cmd ? c.text + " " : quoteFor(c.text, c.dir)); tabState = null; return; }
        let common = cands[0].text; cands.forEach((c) => { while (!c.text.startsWith(common)) common = common.slice(0, -1); });
        if (common.length > word.length) { applyCompletion(before, after, start, cands[0].cmd ? common : quoteFor(common, false)); lastTabAt = 0; return; }
        const now = Date.now();
        if (now - lastTabAt < 1200) { emit(promptParts().concat([[v, COL.input]])); const names = cands.map((c) => (c.cmd ? c.text : c.text.split("/").pop() + (c.dir ? "/" : ""))); emit(names.join("  ")); }
        lastTabAt = now; return;
      }
      tabState = { before, after, start, cands, idx: back ? cands.length - 1 : 0 };
      const c = cands[tabState.idx]; applyCompletion(before, after, start, c.cmd ? c.text : quoteFor(c.text, c.dir));
      tabState.value = cmd.value; tabState.pos = cmd.selectionStart;
    }
    cmd.addEventListener("keydown", (e) => {
      const k = e.key;
      if (exited) {   // "[process exited ...]": Enter restarts the profile, Ctrl+D closes the pane
        if (k === "Enter") { e.preventDefault(); start(); }
        else if (e.ctrlKey && lc(k) === "d") { e.preventDefault(); if (o.close) o.close(); }
        return;
      }
      if (e.ctrlKey && !e.shiftKey && !e.altKey && lc(k) === "d" && !busy && !pendingAsk && !cmd.value && (mode() === "bash" || mode() === "azure")) { e.preventDefault(); emit(promptParts()); exitShell(mkIO({ dead: false }, null, null)); return; }
      if (k !== "Tab" && k !== "Shift") tabState = null;
      if ((e.ctrlKey || e.metaKey) && lc(k) === "c" && !e.shiftKey) {
        const selOut = window.getSelection && String(window.getSelection()) || "";
        if (selOut && cmd.selectionStart === cmd.selectionEnd) return;   // let the browser copy selected output
        if (cmd.selectionStart !== cmd.selectionEnd) return;
        e.preventDefault();
        if (busy && curJob) { curJob.cancel(); emit("^C", fg); return; }
        emit(promptParts().concat([[cmd.value + "^C", COL.input]])); cmd.value = ""; histIdx = hist.length; return;
      }
      if (e.ctrlKey && lc(k) === "l") { e.preventDefault(); clearScreen(); return; }
      if (k === "Tab") { e.preventDefault(); if (!busy) onTab(e.shiftKey); return; }
      if (k === "Escape" && mode() !== "bash") { cmd.value = ""; return; }
      if (k === "ArrowUp") { e.preventDefault(); if (busy && !pendingAsk) return; if (histIdx > 0) histIdx--; cmd.value = hist[histIdx] || ""; setTimeout(() => cmd.setSelectionRange(cmd.value.length, cmd.value.length), 0); return; }
      if (k === "ArrowDown") { e.preventDefault(); if (busy && !pendingAsk) return; histIdx = Math.min(hist.length, histIdx + 1); cmd.value = hist[histIdx] || ""; return; }
      if (k !== "Enter") return;
      e.preventDefault();
      const line = cmd.value;
      if (pendingAsk) { const pa = pendingAsk; pendingAsk = null; cmd.value = ""; emit([[pa.q, fg], [line, COL.input]]); renderPrompt(); pa.res(line); return; }
      if (busy) return;
      cmd.value = "";
      submit(line);
    });
    termEl.addEventListener("mouseup", () => { const s = window.getSelection && String(window.getSelection()); if (!s) try { cmd.focus({ preventScroll: true }); } catch (_) {} });

    // ================================================================ Azure Cloud Shell (simulated, never connects)
    const AZ_CODE = Array.from({ length: 9 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    function azSignIn(io) {
      io.out("To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code " + AZ_CODE + " to authenticate.");
      io.out("(Simulated: this code is not registered with Microsoft, so signing in can't succeed. Nothing is sent to Azure.)", COL.gray);
    }
    function runAzure(line, io) {
      const t = line.trim(), n = lc(t.split(/\s+/)[0] || "");
      if (n === "exit" || n === "logout") return exitShell(io);
      if (n === "cls" || n === "clear" || n === "clear-host") { clearScreen(); return 0; }
      if (n === "help" || n === "get-help") { io.out("Azure Cloud Shell - SIMULATED, NOT CONNECTED\n\n  az login / Connect-AzAccount   show the (simulated) device sign-in prompt\n  clear                          clear the screen\n  exit                           close this tab\n\nAll other az / Az PowerShell commands report 'not connected': this tab never talks to Azure."); return 0; }
      if (/^(az\s+login|connect-azaccount|login-azaccount)\b/i.test(t)) { azSignIn(io); io.err("Authentication failed: not connected (simulated Azure Cloud Shell)."); return 1; }
      if (n === "whoami") { io.out("(not signed in)"); return 1; }
      io.err(`${t.split(/\s+/)[0]}: Not connected to Azure. This Azure Cloud Shell is a simulation; the command was not sent anywhere. Type 'help'.`); return 1;
    }

    // ================================================================ profile start / restart
    function wslOff() {
      const g = COL.gray;
      emit("The Windows Subsystem for Linux optional component is not enabled. Please enable it and try again.");
      emit("See https://aka.ms/wslinstall for details.");
      emit("Error code: Wsl/WSL_E_WSL_OPTIONAL_COMPONENT_REQUIRED", COL.red);
      emit("");
      emit("Turn it on like on Windows:", COL.yellow);
      emit("  1. Control Panel > Programs > Turn Windows features on or off", g);
      emit("  2. Check \"Windows Subsystem for Linux\" and select OK", g);
      emit("  or run  wsl --install  in a Command Prompt or PowerShell tab, then press Enter here.", g);
      const row = document.createElement("div"); row.className = "tl";
      const b = document.createElement("button"); b.type = "button"; b.className = "tx-inline-btn"; b.textContent = "Turn Windows features on or off";
      b.style.cssText = "font:inherit;font-size:.85em;margin:6px 0;padding:3px 10px;border-radius:4px;border:1px solid currentColor;background:transparent;color:var(--tx-cyan,#61d6d6);cursor:pointer";
      b.onclick = (e) => { e.stopPropagation(); try { if (window.SysRun) window.SysRun("appwiz.cpl"); else window.WM.open("controlpanel"); } catch (_) {} };
      row.appendChild(b); out.appendChild(row);
      emit("");
      emit("[process exited with code 4294967295 (0xffffffff)]");
      emit("You can now close this terminal with Ctrl+D, or press Enter to restart.");
      exited = { code: 4294967295 }; renderPrompt();
    }
    let started = false;
    function start() {
      const restart = started; started = true; exited = null;
      if (restart) emit("");
      stack.length = 0; stack.push(firstFrame());
      const sh = prof.shell;
      if (prof.banner === "profile") {
        if (sh === "cmd") emit(`Microsoft Windows 12 [Version ${VERSION}]\n(c) Microsoft Corporation. All rights reserved.`);
        else if (sh === "ps" && prof.ps === "5.1") emit("Windows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved.\n\nInstall the latest PowerShell for new features and improvements! https://aka.ms/PSWindows");
        else if (sh === "ps") emit("PowerShell 7.4.6");
        else if (sh === "azure") {
          emit("Azure Cloud Shell  -  SIMULATED, NOT CONNECTED", COL.yellow);
          emit("This tab imitates Windows Terminal's Azure connector. It never contacts Azure or Microsoft.", COL.gray);
          emit("");
          emit("Welcome to Azure Cloud Shell"); emit("Requesting a Cloud Shell..."); azSignIn(mkIO({ dead: false }, null, null));
          emit("Not connected. Type 'help' for what works here.", COL.red);
        }
      }
      if (sh === "bash" && !TS().archInstalled) { if (o.onMode) chromeForMode(); wslOff(); return; }
      if (sh === "bash" && prof.banner === "profile") {
        if (prof.distro === "ubuntu") emit(`Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 5.15.167.4-microsoft-standard-WSL2 x86_64)\n\n * Documentation:  https://help.ubuntu.com\n * Management:     https://landscape.canonical.com\n * Support:        https://ubuntu.com/pro\n\nThis WSL distro works on this PC's real files: / is C:\\, ~ is C:\\Users\\${userName()}.\nType 'help' for commands.`);
        else emit("Welcome to Arch Linux on WSL. / is C:\\, ~ is your user folder. Type 'help' or 'neofetch'.", COL.arch);
      }
      if (prof.banner !== "none") emit("");
      if (prof.startDir && !startSegs() && !(o.cwd && walk(o.cwd))) emit(`[warning] The starting directory "${prof.startDir}" could not be found. Starting in ${show(HOME())} instead.`, COL.yellow);
      if (o.onMode) chromeForMode();
      renderPrompt();
    }
    if (prof.banner === "legacy") { started = true; renderPrompt(); } else start();

    const api = {
      el: termEl, input: cmd, profile: prof,
      focus() { try { cmd.focus({ preventScroll: true }); } catch (_) {} },
      dispose() { closed = true; if (curJob && curJob.cancel) curJob.cancel(); if (pendingAsk && pendingAsk.job) pendingAsk.job.dead = true; },
      cwd: () => cwd().slice(), mode, shellName, cwdText: () => show(cwd()),
      isBusy: () => busy, isExited: () => !!exited,
      clear: clearScreen, restart: start,
      // Run lines as if typed (used for multi-line paste and tests).
      async run(lines) { for (const l of [].concat(lines)) { if (closed || exited) return; if (pendingAsk) { const pa = pendingAsk; pendingAsk = null; emit([[pa.q, fg], [l, COL.input]]); renderPrompt(); pa.res(l); continue; } await submit(l); } },
      insert(text) { const a = cmd.selectionStart == null ? cmd.value.length : cmd.selectionStart, b = cmd.selectionEnd == null ? a : cmd.selectionEnd; cmd.value = cmd.value.slice(0, a) + text + cmd.value.slice(b); const p = a + text.length; try { cmd.setSelectionRange(p, p); } catch (_) {} cmd.dispatchEvent(new Event("input")); },
      text: () => termEl.innerText,
    };
    return api;
  }

  window.TerminalCore = { open, createSession, version: 2, VERSION, _walk: (p) => walk(winSegs(p, HOME())), _resolveDir: (p) => { const segs = winSegs(String(p || ""), HOME()); const h = segs && walk(segs); return h && isDir(h.node) ? winPath(h.canon) : null; } };
})();
