/* File History + OneDrive-style version history for the virtual file system (State.appData.files.root).
   Engine: one central hook on State.onSave. After saves settle (debounced), the included folders are
   walked and every file's content reference (inline text / data-URL src / IndexedDB blob id) is compared
   with the previous walk — by reference, so unchanged files cost a pointer compare. The OLD content of a
   file that changed (or disappeared) is copied into this account's own IndexedDB database
   ("win12-filehistory:" + WIN12_STATE_KEY), content-addressed and de-duplicated, never in localStorage.
   Renames / moves are detected (same content left one path and appeared at another) and the history follows.
   Settings (on/off, frequency, retention, cap, folders) live in appData.fileHistory (per account).
   UI: File History app (AppRegistry.filehistory), the restore browser with a time slider, the version
   history panel, the Properties ▸ Previous Versions tab (used by js/files12.js), a Settings card and a
   Control Panel item (injected at runtime). Styles: css/filehistory.css (.fh-*), loaded on demand. */
(function () {
  "use strict";
  if (window.FileHistory) return;
  const SCRIPT_V = (() => { try { const s = document.currentScript && document.currentScript.src; const m = s && s.match(/[?&]v=([^&#]+)/); return m ? m[1] : ""; } catch (e) { return ""; } })();
  const VQ = SCRIPT_V ? "?v=" + SCRIPT_V : "";
  const S = () => State.data;
  const AD = () => { const d = S(); if (!d.appData) d.appData = {}; return d.appData; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const FH = () => window.FilesHelper || {};
  const MB = 1048576, DAY = 86400000;
  const SYS_DRIVE = /^Local Disk \([A-Z]:\)$/;

  // ---------------------------------------------------------------- settings
  const DEFAULT_INCLUDE = ["Desktop", "Documents", "Pictures", "Music", "Videos", "OneDrive"];
  const FREQ = {
    change: { label: "Every time a file is saved", gap: 5000, run: 3600000 },
    "10m": { label: "Every 10 minutes", gap: 600000, run: 600000 },
    "1h": { label: "Every hour (default)", gap: 3600000, run: 3600000 },
  };
  const KEEP = { forever: "Forever (default)", "1m": "1 month", "3m": "3 months", space: "Until space is needed" };
  const CAPS = [25, 50, 100, 250, 500, 1024];
  function settings() {
    const a = AD(); let s = a.fileHistory;
    if (!s || typeof s !== "object") s = a.fileHistory = {};
    if (typeof s.on !== "boolean") s.on = true;
    if (!FREQ[s.freq]) s.freq = "change";
    if (!KEEP[s.keep]) s.keep = "forever";
    if (!(s.maxMB > 0)) s.maxMB = 100;
    if (!Array.isArray(s.include)) s.include = DEFAULT_INCLUDE.map((n) => [n]);
    if (!Array.isArray(s.exclude)) s.exclude = [];
    return s;
  }
  function saveSettings() { try { State.save(); } catch (e) {} emit(); }

  // ---------------------------------------------------------------- tiny helpers
  function cyrb53(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  const strKey = (p, s) => p + cyrb53(s).toString(36) + "_" + s.length.toString(36);
  function utf8Len(s) { if (s.length > 300000) return s.length; try { return new TextEncoder().encode(s).length; } catch (e) { return s.length; } }
  function human(b) {
    b = +b || 0; if (b < 1024) return b + " bytes";
    const u = ["KB", "MB", "GB"]; let v = b / 1024, i = 0; while (v >= 1024 && i < 2) { v /= 1024; i++; }
    return (v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + " " + u[i];
  }
  const fmtDate = (ts) => (ts ? new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
  const shortDate = (ts) => (ts ? new Date(ts).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—");
  const longDate = (ts) => (ts ? new Date(ts).toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
  function ago(ts) {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return "just now";
    const m = Math.round(s / 60); if (m < 60) return m + " minute" + (m === 1 ? "" : "s") + " ago";
    const h = Math.round(m / 60); if (h < 24) return h + " hour" + (h === 1 ? "" : "s") + " ago";
    const d = Math.round(h / 24); return d + " day" + (d === 1 ? "" : "s") + " ago";
  }
  const keyOf = (path) => path.join("/");
  const extOf = (name) => (String(name).match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
  function fsRoot() { const a = AD(); return a.files && a.files.root ? a.files.root : null; }
  function nodeAt(path) { let n = { type: "folder", children: fsRoot() || {} }; for (const seg of path) { n = n && n.children && n.children[seg]; if (!n) return null; } return n; }
  function ensureFolder(path) {
    if (FH().ensureFolder) return FH().ensureFolder(path);
    let kids = fsRoot(); for (const seg of path) { if (!kids[seg] || kids[seg].type !== "folder") kids[seg] = { type: "folder", children: {}, created: Date.now() }; kids = kids[seg].children || (kids[seg].children = {}); } return kids;
  }
  function uniqueName(kids, name) {
    if (!kids[name]) return name;
    const m = name.match(/^(.*?)(\.[^.]+)?$/); const base = m[1], ext = m[2] || ""; let i = 2;
    while (kids[base + " (" + i + ")" + ext]) i++;
    return base + " (" + i + ")" + ext;
  }
  function winPath(path) { if (FH().winPath) return FH().winPath(path); return "C:\\Users\\User\\" + path.join("\\"); }
  function log(level, id, msg) { try { if (window.EventLog && EventLog.add) EventLog.add("Application", level, "FileHistory", id, msg); } catch (e) {} }
  function notifyVfs() { try { State.save(); } catch (e) {} try { window.dispatchEvent(new Event("vfs-change")); } catch (e) {} }
  const listeners = new Set();
  let emitT = 0;
  function emit() { clearTimeout(emitT); emitT = setTimeout(() => { listeners.forEach((f) => { try { f(); } catch (e) {} }); try { window.dispatchEvent(new Event("filehistory-change")); } catch (e) {} }, 30); }

  // ---------------------------------------------------------------- IndexedDB (per account / per VM)
  const DB_NAME = "win12-filehistory:" + (window.WIN12_STATE_KEY || "win12_state_v1");
  let dbp = null, dead = false;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => { const d = r.result; ["meta", "data", "kv"].forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); }); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error("blocked"));
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  function idb(store, mode, fn) {
    return db().then((d) => new Promise((res, rej) => {
      const t = d.transaction(store, mode); let out;
      try { out = fn(t.objectStore(store)); } catch (e) { rej(e); return; }
      t.oncomplete = () => res(out && "result" in out ? out.result : out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("aborted"));
    }));
  }
  const put = (store, key, val) => idb(store, "readwrite", (s) => { s.put(val, key); });
  const del = (store, key) => idb(store, "readwrite", (s) => { s.delete(key); });
  const get = (store, key) => idb(store, "readonly", (s) => s.get(key));
  function getAllWithKeys(store) {
    return db().then((d) => new Promise((res, rej) => {
      const out = []; const t = d.transaction(store, "readonly"); const c = t.objectStore(store).openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
    }));
  }
  // every IndexedDB write goes through one queue so records never race each other
  let chain = Promise.resolve();
  function enqueue(fn) { const p = chain.then(fn); chain = p.catch((e) => { console.warn("FileHistory:", e); }); return p; }

  // ---------------------------------------------------------------- in-memory index
  const idx = new Map();    // pathKey -> { key, path, name, kind, born, deletedAt, curApp, versions: [...] }
  const refs = new Map();   // data hash -> number of versions using it
  const sizes = new Map();  // data hash -> bytes
  let alias = {};           // VFS blob id -> data hash (restored blobs map back to the bytes we already keep)
  let runs = [];            // [{ at, n, bytes, manual }]
  const addRef = (v) => { refs.set(v.h, (refs.get(v.h) || 0) + 1); if (!sizes.has(v.h)) sizes.set(v.h, v.size || 0); };
  function dropRef(v) { const n = (refs.get(v.h) || 0) - 1; if (n > 0) { refs.set(v.h, n); return false; } refs.delete(v.h); sizes.delete(v.h); return true; }
  function totalBytes() { let t = 0; refs.forEach((_, h) => { t += sizes.get(h) || 0; }); return t; }
  function persistRec(rec) { const copy = JSON.parse(JSON.stringify(rec)); return enqueue(() => put("meta", rec.key, copy)); }
  function persistKV() { const a = Object.assign({}, alias), r = runs.slice(-60); return enqueue(() => Promise.all([put("kv", "alias", a), put("kv", "runs", r)])); }

  let ready = db().then(() => Promise.all([getAllWithKeys("meta"), get("kv", "alias"), get("kv", "runs")])).then(([metas, al, rn]) => {
    metas.forEach(([k, rec]) => { if (!rec || !Array.isArray(rec.versions)) return; rec.key = k; idx.set(k, rec); rec.versions.forEach(addRef); });
    alias = al || {}; runs = Array.isArray(rn) ? rn : [];
  }).catch((e) => { dead = true; console.warn("File History is unavailable:", e); });

  // ---------------------------------------------------------------- which app saved it
  const APP_NAMES = { notepad: "Notepad", word: "Word", excel: "Excel", powerpoint: "PowerPoint", paint: "Paint", photos: "Photos", vscode: "Visual Studio Code", codeeditor: "Code Editor", fileexplorer: "File Explorer", files: "File Explorer", terminal: "Terminal", powershell: "Terminal", cmd: "Command Prompt", snip: "Snipping Tool", mediaplayer: "Media Player", onenote: "OneNote", forms: "Forms", filehistory: "File History", outlook: "Outlook", edge: "Microsoft Edge", gamebar: "Game Bar", clipchamp: "Clipchamp", sticky: "Sticky Notes" };
  function appName(id, win) {
    if (!id) return null;
    if (APP_NAMES[id]) return APP_NAMES[id];
    try { const a = window.Catalog && Catalog.storeApps.find((x) => x.id === id || x.builtin === id); if (a) return a.name; } catch (e) {}
    const t = win && win.querySelector(".t-text"); if (t && t.textContent) return t.textContent.split(" - ").pop().trim().slice(0, 40);
    return id;
  }
  function activeApp() {
    try {
      let best = null, z = -1;
      WM.windows().forEach((e) => { const w = e.win; if (!w || !w.isConnected || w.style.display === "none") return; const zz = +w.style.zIndex || 0; if (zz > z) { z = zz; best = e; } });
      return best ? appName(best.appId, best.win) : null;
    } catch (e) { return null; }
  }
  const KIND_APP = { text: "Notepad", word: "Word", xlsx: "Excel", pptx: "PowerPoint" };
  const guessApp = (kind) => KIND_APP[kind] || null;
  let hintApp = null;

  // ---------------------------------------------------------------- scanning (the save hook)
  function included(path) {
    const s = settings(); const k = keyOf(path);
    if (s.exclude.some((p) => { const e = keyOf(p); return k === e || k.startsWith(e + "/"); })) return false;
    return s.include.some((p) => { const i = keyOf(p); return k === i || k.startsWith(i + "/"); });
  }
  function entryOf(path, name, n) {
    let t, v;
    if (n.blob) { t = "b"; v = n.blob; }
    else if (typeof n.content === "string") { t = "c"; v = n.content; }
    else if (typeof n.src === "string" && /^data:/.test(n.src)) { t = "s"; v = n.src; }
    else { t = "c"; v = ""; }
    return { key: keyOf(path), path, name, t, v, kind: n.kind || "other", mime: n.mime || null, ts: n.ts || n.created || null, created: n.created || null, size: n.size, app: null, h: null };
  }
  let lastScanMs = 0, scans = 0;
  function scanTree() {
    const t0 = performance.now();
    const out = new Map(), s = settings(), root = fsRoot();
    if (!root) return out;
    const excl = new Set(s.exclude.map(keyOf));
    function rec(kids, path, pkey) {
      for (const name in kids) {
        const n = kids[name]; if (!n) continue;
        const key = pkey + "/" + name;
        if (excl.has(key)) continue;
        if (n.type === "folder") { if (n.children) rec(n.children, path.concat(name), key); }
        else if (n.type === "file" && n.kind !== "shortcut" && !n._ze && !out.has(key)) out.set(key, entryOf(path.concat(name), name, n));
      }
    }
    s.include.forEach((p) => { if (!p.length || SYS_DRIVE.test(p[0])) return; const k = keyOf(p); if (excl.has(k)) return; const n = nodeAt(p); if (n && n.type === "folder" && n.children) rec(n.children, p.slice(), k); });
    lastScanMs = performance.now() - t0; scans++;
    return out;
  }
  let base = null;            // last walk: Map pathKey -> entry
  let pendingApp = null, diffT = 0, firstPending = 0;
  function onSave() {
    if (dead || !settings().on) { base = null; return; }
    if (!firstPending) { firstPending = Date.now(); pendingApp = hintApp || activeApp(); }
    clearTimeout(diffT);
    const wait = Date.now() - firstPending > 4000 ? 0 : 700;
    diffT = setTimeout(runDiff, wait);
  }
  function runDiff() {
    clearTimeout(diffT); diffT = 0;
    const app = hintApp || pendingApp || null; pendingApp = null; firstPending = 0; hintApp = null;
    if (dead || !settings().on) { base = null; return; }
    const now = Date.now();
    const nb = scanTree();
    if (!base) { base = nb; nb.forEach((e) => { const r = idx.get(e.key); e.app = r && r.curApp || null; if (r && r.deletedAt) { delete r.deletedAt; persistRec(r); } }); return; }
    const added = [], removed = [];
    nb.forEach((e, k) => {
      const o = base.get(k);
      if (!o) { added.push(e); return; }
      if (o.t === e.t && o.v === e.v) { e.app = o.app; e.h = o.h; return; }
      e.app = app || guessApp(e.kind);
      capture(o, "change", now, { newApp: e.app });
    });
    base.forEach((o, k) => { if (!nb.has(k)) removed.push(o); });
    if (removed.length && added.length) {   // renames / moves: same content left one path, appeared at another
      const bySig = new Map();
      added.forEach((a) => { if (a.v === "") return; const m = bySig.get(a.t) || bySig.set(a.t, new Map()).get(a.t); if (!m.has(a.v)) m.set(a.v, a); });
      for (let i = removed.length - 1; i >= 0; i--) {
        const o = removed[i], m = bySig.get(o.t), a = m && m.get(o.v);
        if (!a || a._moved) continue;
        a._moved = true; a.app = o.app; a.h = o.h; m.delete(o.v);
        removed.splice(i, 1); added.splice(added.indexOf(a), 1);
        migrate(o, a);
      }
    }
    added.forEach((a) => {
      a.app = app || guessApp(a.kind);
      const r = idx.get(a.key);
      if (r) { if (r.deletedAt) delete r.deletedAt; r.curApp = a.app; persistRec(r); }
    });
    removed.forEach((o) => { const n = nodeAt(o.path); if (!n || n.type !== "file") capture(o, "delete", now); });   // still there = just excluded now
    base = nb;
  }
  function migrate(o, a) {
    const r = idx.get(o.key); if (!r) return;
    if (idx.has(a.key)) { capture(o, "delete", Date.now()); return; }
    idx.delete(o.key); r.key = a.key; r.path = a.path.slice(); r.name = a.name; idx.set(a.key, r);
    const copy = JSON.parse(JSON.stringify(r));
    enqueue(() => Promise.all([del("meta", o.key), put("meta", a.key, copy)]));
    emit();
  }

  // ---------------------------------------------------------------- capturing a version
  function hashOf(e) {
    if (e.h) return e.h;
    if (e.t === "b") return (e.h = alias[e.v] || "b" + e.v);
    return (e.h = strKey(e.t === "s" ? "u" : "t", e.v));
  }
  function sizeOf(e) { if (e.t === "b") return typeof e.size === "number" ? e.size : 0; if (e.t === "s") { const i = e.v.indexOf(","); return Math.round((e.v.length - i - 1) * 0.75); } return utf8Len(e.v); }
  function newRec(e) { return { key: e.key, path: e.path.slice(), name: e.name, kind: e.kind, born: e.created || null, curApp: null, versions: [] }; }
  let capWarned = false;
  // reason: change | delete | backup | replaced. Returns a promise for the new (or reused) version.
  function capture(e, reason, at, opts) {
    opts = opts || {};
    return enqueue(async () => {
      await ready; if (dead) return null;
      const s = settings();
      const h = hashOf(e), size = sizeOf(e);
      let rec = idx.get(e.key);
      const fresh = !rec;
      if (!rec) rec = newRec(e);
      rec.name = e.name; rec.kind = e.kind; rec.path = e.path.slice();
      if (opts.newApp !== undefined) rec.curApp = opts.newApp;
      const vs = rec.versions, last = vs[vs.length - 1];
      const finish = (v) => { if (reason === "delete") rec.deletedAt = at; if (fresh && !vs.length && reason !== "delete") { if (rec.curApp) { idx.set(rec.key, rec); persistRec(rec); } return v; } idx.set(rec.key, rec); persistRec(rec); emit(); scheduleEnforce(); return v; };
      // the content is already kept: an open backup copy of it just gets its end time
      const open = vs.find((v) => v.h === h && v.until == null);
      if (reason !== "backup" && open) { open.until = at; return finish(open); }
      if (reason === "backup" && open) return finish(open);
      if (last && last.h === h && last.until != null && reason !== "backup") { if (reason === "delete" || reason === "replaced") last.until = Math.max(last.until, at); return finish(last); }
      if (reason === "change" && !opts.force && last) { const lt = Math.max(last.at, last.until || 0); if (at - lt < FREQ[s.freq].gap) return finish(null); }
      const cap = s.maxMB * MB;
      if (!refs.has(h) && (size > cap * 0.5 || (reason === "backup" && totalBytes() + size > cap))) {
        if (!capWarned && reason !== "backup") { capWarned = true; log("Warning", 2002, "A version of " + e.name + " (" + human(size) + ") wasn't kept because it's larger than half of File History's storage limit (" + s.maxMB + " MB)."); }
        return finish(null);
      }
      if (!refs.has(h)) {
        let val;
        if (e.t === "b") {
          let b = null; try { b = await VFS.getBlob(e.v); } catch (er) {}
          if (!b) return finish(null);
          val = { b, mime: b.type || e.mime || "" };
        } else val = { s: e.v };
        await put("data", h, val);
      }
      const v = { id: "v" + at.toString(36) + Math.random().toString(36).slice(2, 6), h, t: e.t, size, kind: e.kind, mime: e.mime, from: e.ts || null, at, until: reason === "backup" ? null : at, app: e.app || (reason === "backup" ? null : guessApp(e.kind)), reason };
      addRef(v); vs.push(v);
      if (!rec.born) rec.born = e.created || e.ts || at;
      return finish(v);
    });
  }

  // ---------------------------------------------------------------- reading versions
  function sortedVersions(rec) { return rec.versions.slice().sort((a, b) => (b.from || b.at) - (a.from || a.at) || b.at - a.at); }
  function currentHash(path) { const n = nodeAt(path); if (!n || n.type !== "file") return null; return hashOf(entryOf(path, path[path.length - 1], n)); }
  // previous versions (newest first): everything kept except a copy identical to what the file holds now
  function versions(path) {
    return ready.then(() => {
      const rec = idx.get(keyOf(path)); if (!rec) return [];
      const cur = currentHash(path); const seen = new Set(); const out = [];
      sortedVersions(rec).forEach((v) => { if (v.h === cur || seen.has(v.h)) return; seen.add(v.h); out.push(Object.assign({}, v, { path: rec.path.slice(), name: rec.name })); });
      return out;
    });
  }
  function findVersion(path, vid) { const rec = idx.get(keyOf(path)); const v = rec && rec.versions.find((x) => x.id === vid); return v ? { rec, v } : null; }
  function readData(h) { return enqueue(() => get("data", h)); }
  async function versionText(v) {
    const d = await readData(v.h); if (!d) throw new Error("This version's contents are missing.");
    if (d.s != null) return d.s;
    if (d.b) { if (d.b.size > 4e6) throw new Error("This version is too big to preview."); return await d.b.text(); }
    return "";
  }
  async function versionURL(v) {
    const d = await readData(v.h); if (!d) return null;
    if (d.s != null) return v.t === "s" || /^data:/.test(d.s) ? d.s : URL.createObjectURL(new Blob([d.s], { type: v.mime || "text/plain" }));
    return URL.createObjectURL(d.b.type ? d.b : new Blob([d.b], { type: v.mime || "application/octet-stream" }));
  }
  function thumbOf(blob) {
    if (FH().imageThumb) return FH().imageThumb(blob);
    return Promise.resolve(null);
  }
  // Fields to write into a file node so it holds version v (async work happens here, before anything changes).
  async function nodeFields(v) {
    const d = await readData(v.h); if (!d) throw new Error("This version's contents are missing from this device.");
    const f = { kind: v.kind, mime: v.mime || undefined, size: v.size, content: undefined, blob: undefined, src: undefined };
    if (d.s != null) { if (v.t === "s") f.src = d.s; else f.content = d.s; f.size = v.t === "c" ? utf8Len(d.s) : v.size; }
    else if (d.b) {
      const id = await VFS.putBlob(d.b); alias[id] = v.h; persistKV();
      f.blob = id; f.size = d.b.size; f.mime = d.b.type || v.mime || undefined;
      if (v.kind === "image" || /^image\//.test(f.mime || "")) { const t = await thumbOf(d.b); if (t) { f.src = t.thumb; f.w = t.w; f.h = t.h; } }
    }
    return f;
  }
  function applyFields(node, f) {
    ["content", "blob", "src", "w", "h", "dur"].forEach((k) => delete node[k]);
    Object.keys(f).forEach((k) => { if (f[k] !== undefined) node[k] = f[k]; else if (k === "mime") delete node.mime; });
    node.ts = Date.now();
  }
  function syncBase(path, node, app) {   // tell the save hook about a change we made ourselves
    if (!base) return;
    const e = entryOf(path, path[path.length - 1], node); e.app = app || "File History"; base.set(e.key, e);
    const r = idx.get(e.key); if (r) { r.curApp = e.app; if (r.deletedAt) delete r.deletedAt; persistRec(r); }
  }
  function flushDiff() { if (diffT || firstPending) runDiff(); else if (!base && settings().on) runDiff(); }

  // Restore: replace the current file (it is kept as a version first). Works for deleted files too.
  async function restore(path, vid) {
    await ready; flushDiff();
    const f = findVersion(path, vid); if (!f) throw new Error("That version no longer exists.");
    const fields = await nodeFields(f.v);
    const cur = nodeAt(path);
    if (cur && cur.type === "file") {
      if (cur.readOnly) throw new Error("“" + path[path.length - 1] + "” is read-only. Turn off Read-only in its Properties first.");
      const e = (base && base.get(keyOf(path))) || entryOf(path, path[path.length - 1], cur);
      if (hashOf(e) !== f.v.h) await capture(e, "replaced", Date.now(), { force: true });
    }
    let node = nodeAt(path);
    if (!node || node.type !== "file") { const kids = ensureFolder(path.slice(0, -1)); node = kids[path[path.length - 1]] = { type: "file", created: Date.now() }; }
    applyFields(node, fields);
    syncBase(path, node, "File History");
    notifyVfs(); emit();
    log("Information", 2010, "Restored a previous version of " + winPath(path) + " from " + fmtDate(f.v.from || f.v.at) + ".");
    return node;
  }
  function stampName(name, ts) {
    const d = new Date(ts); const p = (x) => String(x).padStart(2, "0");
    const stamp = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + "." + p(d.getMinutes());
    const m = name.match(/^(.*?)(\.[^.]+)?$/); return m[1] + " (" + stamp + ")" + (m[2] || "");
  }
  // Copy restore: keep the current file, save the version next to it as "name (date).ext".
  async function restoreCopy(path, vid, destFolder) {
    await ready; flushDiff();
    const f = findVersion(path, vid); if (!f) throw new Error("That version no longer exists.");
    const fields = await nodeFields(f.v);
    const folder = destFolder || path.slice(0, -1);
    const kids = ensureFolder(folder);
    const nm = uniqueName(kids, stampName(path[path.length - 1], f.v.from || f.v.at));
    const node = { type: "file", created: Date.now() }; applyFields(node, fields);
    kids[nm] = node;
    syncBase(folder.concat(nm), node, "File History");
    notifyVfs(); emit();
    log("Information", 2011, "Restored a copy of " + winPath(path) + " (" + fmtDate(f.v.from || f.v.at) + ") as " + nm + ".");
    return folder.concat(nm);
  }
  async function deleteVersion(path, vid) {
    await ready;
    const f = findVersion(path, vid); if (!f) return false;
    const { rec, v } = f;
    rec.versions = rec.versions.filter((x) => x.id !== vid);
    const drop = dropRef(v);
    const copy = JSON.parse(JSON.stringify(rec));
    await enqueue(() => Promise.all([rec.versions.length || nodeAt(rec.path) ? put("meta", rec.key, copy) : del("meta", rec.key), drop ? del("data", v.h) : null]));
    if (!rec.versions.length && !nodeAt(rec.path)) idx.delete(rec.key);
    emit(); return true;
  }
  // Open a version as a read-only copy in the file's usual app.
  async function openVersion(path, vid) {
    const f = findVersion(path, vid); if (!f) throw new Error("That version no longer exists.");
    const v = f.v; const name = path[path.length - 1];
    const label = stampName(name, v.from || v.at);
    const node = { type: "file", kind: v.kind, mime: v.mime || undefined, size: v.size, ts: v.from || v.at, __fxClone: true };
    const d = await readData(v.h); if (!d) throw new Error("This version's contents are missing.");
    if (d.s != null) { if (v.t === "s") node.src = d.s; else node.content = d.s; }
    else { const u = URL.createObjectURL(d.b); node.src = u; node._loading = true; setTimeout(() => URL.revokeObjectURL(u), 10 * 60000); }
    const textish = v.t !== "b" && (v.kind === "text" || (v.kind === "other" && typeof node.content === "string"));
    if (textish && FH().launch) FH().launch("notepad", label, node, null);
    else if (FH().openFile) FH().openFile(label, node, null);
    else if (window.VFS) VFS.openNode(label, node);
    return label;
  }

  // ---------------------------------------------------------------- backups ("Back up now" + scheduled runs)
  let running = null;
  function backupNow(manual) {
    if (running) return running;
    running = (async () => {
      await ready; if (dead) return { n: 0 };
      if (!settings().on && !manual) return { n: 0 };
      if (!base) base = scanTree(); else flushDiff();
      const at = Date.now(); let n = 0, bytes = 0, i = 0;
      for (const e of Array.from(base.values())) {
        const h = hashOf(e); const rec = idx.get(e.key);
        if (rec && rec.versions.some((v) => v.h === h && v.until == null)) continue;
        const had = refs.has(h);
        const v = await capture(e, "backup", at, { force: true });
        if (v && v.at === at) { n++; if (!had) bytes += v.size || 0; }
        if (++i % 8 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      runs.push({ at, n, bytes, manual: !!manual }); persistKV();
      const s = settings(); s.lastRun = at; saveSettings();
      log("Information", 2001, "File History " + (manual ? "backup (Back up now)" : "scheduled backup") + " finished: " + n + " file" + (n === 1 ? "" : "s") + " copied (" + human(bytes) + ").");
      scheduleEnforce(); emit();
      return { n, bytes, at };
    })().finally(() => { running = null; });
    return running;
  }
  setInterval(() => {
    if (dead || !window.State || !S().setupCompleted) return;
    const s = settings(); if (!s.on || document.hidden) return;
    const last = s.lastRun || 0;
    if (!last) { if (!s.firstSeen) { s.firstSeen = Date.now(); return; } if (Date.now() - s.firstSeen > 180000) backupNow(false); return; }
    if (Date.now() - last >= FREQ[s.freq].run) backupNow(false);
  }, 60000);

  // ---------------------------------------------------------------- retention / storage cap
  let enfT = 0;
  function scheduleEnforce() { clearTimeout(enfT); enfT = setTimeout(() => enforce(), 1500); }
  async function removeVersions(list) {   // list: [{ rec, v }]
    if (!list.length) return 0;
    const touched = new Set(), dropped = [];
    list.forEach(({ rec, v }) => { const i = rec.versions.indexOf(v); if (i < 0) return; rec.versions.splice(i, 1); touched.add(rec); if (dropRef(v)) dropped.push(v.h); });
    const ops = [];
    touched.forEach((rec) => { if (!rec.versions.length && !nodeAt(rec.path)) { idx.delete(rec.key); ops.push(["d", rec.key]); } else ops.push(["p", rec.key, JSON.parse(JSON.stringify(rec))]); });
    await enqueue(() => Promise.all(ops.map((o) => (o[0] === "d" ? del("meta", o[1]) : put("meta", o[1], o[2]))).concat(dropped.map((h) => del("data", h)))));
    emit(); return list.length;
  }
  function allVersions() { const out = []; idx.forEach((rec) => rec.versions.forEach((v) => out.push({ rec, v }))); return out; }
  async function enforce() {
    await ready; if (dead) return;
    const s = settings(), now = Date.now();
    let removed = 0;
    const age = { "1m": 30 * DAY, "3m": 91 * DAY }[s.keep];
    if (age) removed += await removeVersions(allVersions().filter(({ v }) => v.until != null && v.until < now - age));
    const cap = s.maxMB * MB;
    let over = totalBytes() - cap;
    let est = null;
    if (s.keep === "space") { try { est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch (e) {} if (est && est.quota && est.usage / est.quota > 0.9) over = Math.max(over, est.usage - est.quota * 0.8); }
    if (over > 0) {
      // oldest first; copies of what files hold right now go last (they are the backup of the current file)
      const cand = allVersions().sort((a, b) => ((a.v.until == null && !a.rec.deletedAt) - (b.v.until == null && !b.rec.deletedAt)) || a.v.at - b.v.at);
      const pick = []; const left = new Map(refs);
      for (const c of cand) {
        if (over <= 0) break;
        if (c.v.until == null && !c.rec.deletedAt && nodeAt(c.rec.path)) break;
        pick.push(c); const n = left.get(c.v.h) - 1; left.set(c.v.h, n); if (n <= 0) over -= sizes.get(c.v.h) || 0;
      }
      removed += await removeVersions(pick);
      if (pick.length) log("Information", 2003, "File History removed " + pick.length + " old version" + (pick.length === 1 ? "" : "s") + " to stay under its " + s.maxMB + " MB limit.");
    }
    return removed;
  }
  // Control Panel's "Clean up versions": keep = "latest" | days
  async function cleanup(keep) {
    await ready; const now = Date.now(); let list;
    if (keep === "latest") { list = []; idx.forEach((rec) => { const vs = sortedVersions(rec); vs.slice(1).forEach((v) => list.push({ rec, v })); }); }
    else list = allVersions().filter(({ v }) => (v.until || now) < now - keep * DAY);
    const n = await removeVersions(list);
    log("Information", 2004, "File History cleanup removed " + n + " version" + (n === 1 ? "" : "s") + ".");
    return n;
  }
  async function wipe() {
    await ready;
    idx.clear(); refs.clear(); sizes.clear(); alias = {}; runs = [];
    await enqueue(() => Promise.all(["meta", "data", "kv"].map((st) => idb(st, "readwrite", (o) => { o.clear(); }))));
    base = null; emit();
  }

  // ---------------------------------------------------------------- time travel (restore browser)
  function points() {
    const ats = []; idx.forEach((rec) => rec.versions.forEach((v) => ats.push(v.at)));
    ats.sort((a, b) => a - b);
    const out = []; let start = null;
    ats.forEach((t) => { if (start == null || t - start > 2000) { start = t; out.push(t); } });   // one point per save / backup run
    return out;
  }
  // What a file looked like at time T: a stored version, "current" (unchanged since), or null (didn't exist).
  function stateAt(rec, T) {
    if (rec.born && T < rec.born - 1000) return null;
    const vs = rec.versions.slice().sort((a, b) => (a.until == null ? Infinity : a.until) - (b.until == null ? Infinity : b.until) || a.at - b.at);
    for (const v of vs) if ((v.until == null ? Infinity : v.until) >= T) return v;
    if (rec.deletedAt && T >= rec.deletedAt) return null;
    const n = nodeAt(rec.path); return n && n.type === "file" ? "current" : null;
  }
  // Children of folder P as they were at time T: { folders: Map name -> count, files: [{ name, path, rec, v|"current" }] }
  function listAt(P, T) {
    const pk = keyOf(P), folders = new Map(), files = [];
    idx.forEach((rec) => {
      const k = rec.key;
      if (P.length && !(k.startsWith(pk + "/"))) return;
      if (!P.length && !included(rec.path)) return;
      const st = stateAt(rec, T); if (!st) return;
      const rest = rec.path.slice(P.length);
      if (rest.length === 1) files.push({ name: rest[0], path: rec.path.slice(), rec, v: st });
      else folders.set(rest[0], (folders.get(rest[0]) || 0) + 1);
    });
    return { folders, files };
  }
  function filesUnder(P, T) {   // every file under P (recursive) at time T
    const pk = keyOf(P), out = [];
    idx.forEach((rec) => { if (rec.key === pk || rec.key.startsWith(pk + "/")) { const st = stateAt(rec, T); if (st) out.push({ path: rec.path.slice(), rec, v: st }); } });
    return out;
  }
  // items: [{ path, v }], mode: "replace" | "skip" | "both"; dest/base (optional): restore to another folder keeping paths relative to base
  async function restoreItems(items, opts) {
    opts = opts || {}; await ready; flushDiff();
    let restored = 0, skipped = 0, same = 0; const errors = [];
    for (const it of items) {
      try {
        const target = opts.dest ? opts.dest.concat(it.path.slice((opts.base || it.path.slice(0, -1)).length)) : it.path.slice();
        const existing = nodeAt(target);
        if (it.v === "current") {
          if (!opts.dest || keyOf(target) === keyOf(it.path)) { same++; continue; }
          const src = nodeAt(it.path); if (!src) continue;
          const kids = ensureFolder(target.slice(0, -1)); let nm = target[target.length - 1];
          if (existing) { if (opts.mode === "skip") { skipped++; continue; } if (opts.mode === "both") nm = uniqueName(kids, nm); }
          const c = JSON.parse(JSON.stringify(src)); delete c.readOnly; kids[nm] = c; syncBase(target.slice(0, -1).concat(nm), c); restored++; continue;
        }
        const h = existing && existing.type === "file" ? hashOf(entryOf(target, target[target.length - 1], existing)) : null;
        if (h && h === it.v.h) { same++; continue; }
        if (existing && existing.type === "file") {
          if (opts.mode === "skip") { skipped++; continue; }
          if (opts.mode === "both") {
            const fields = await nodeFields(it.v); const kids = ensureFolder(target.slice(0, -1)); const nm = uniqueName(kids, target[target.length - 1]);
            const node = { type: "file", created: Date.now() }; applyFields(node, fields); kids[nm] = node; syncBase(target.slice(0, -1).concat(nm), node); restored++; continue;
          }
          if (existing.readOnly) { errors.push(target[target.length - 1] + " is read-only."); continue; }
          const e = (base && base.get(keyOf(target))) || entryOf(target, target[target.length - 1], existing);
          await capture(e, "replaced", Date.now(), { force: true });
        } else if (existing && existing.type === "folder") { errors.push("A folder named " + target[target.length - 1] + " is in the way."); continue; }
        const fields = await nodeFields(it.v);
        const kids = ensureFolder(target.slice(0, -1));
        let node = kids[target[target.length - 1]];
        if (!node || node.type !== "file") node = kids[target[target.length - 1]] = { type: "file", created: Date.now() };
        applyFields(node, fields); if (it.v.from) node.ts = it.v.from;
        syncBase(target, node); restored++;
      } catch (e) { errors.push((it.path[it.path.length - 1] || "") + ": " + (e.message || e)); }
    }
    if (restored) notifyVfs();
    emit();
    if (restored) log("Information", 2012, "File History restored " + restored + " item" + (restored === 1 ? "" : "s") + (opts.dest ? " to " + winPath(opts.dest) : " to their original location") + ".");
    return { restored, skipped, same, errors };
  }
  function conflictsFor(items, opts) {
    opts = opts || {}; let n = 0;
    items.forEach((it) => {
      const target = opts.dest ? opts.dest.concat(it.path.slice((opts.base || it.path.slice(0, -1)).length)) : it.path;
      const ex = nodeAt(target); if (!ex || ex.type !== "file") return;
      if (it.v === "current") { if (opts.dest && keyOf(target) !== keyOf(it.path)) n++; return; }
      if (hashOf(entryOf(target, target[target.length - 1], ex)) !== it.v.h) n++;
    });
    return n;
  }

  function usage() {
    let files = 0, vers = 0, deleted = 0; idx.forEach((r) => { if (r.versions.length) { files++; vers += r.versions.length; if (r.deletedAt) deleted++; } });
    return { bytes: totalBytes(), files, versions: vers, deleted, cap: settings().maxMB * MB, lastRun: settings().lastRun || (runs.length ? runs[runs.length - 1].at : 0), runs: runs.slice() };
  }
  function setOn(on) {
    const s = settings(); if (s.on === !!on) return;
    s.on = !!on; base = null; saveSettings();
    if (on) { runDiff(); log("Information", 2005, "File History was turned on."); }
    else log("Information", 2006, "File History was turned off.");
  }

  // ================================================================= UI
  function ensureCSS() {
    if (document.getElementById("fh-css") || document.querySelector('link[href*="filehistory.css"]')) return;
    const l = document.createElement("link"); l.id = "fh-css"; l.rel = "stylesheet"; l.href = "css/filehistory.css" + VQ; document.head.appendChild(l);
  }
  const SV = (d, w) => `<svg viewBox="0 0 24 24" width="${w || 18}" height="${w || 18}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    app: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" fill="#f6c945"/><circle cx="15.5" cy="14.5" r="5" fill="#2e8540"/><path d="M15.5 11.8v2.9l1.9 1.2" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    big: `<svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true"><path d="M5 12a2 2 0 0 1 2-2h11l4 4h19a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" fill="#f6c945"/><circle cx="32" cy="30" r="11" fill="#2e8540"/><path d="M32 24v6.5l4.2 2.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    restore: SV('<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/>'), prev: SV('<path d="M15 5l-7 7 7 7"/>', 22), next: SV('<path d="M9 5l7 7-7 7"/>', 22),
    up: SV('<path d="M12 19V5M6 11l6-6 6 6"/>'), back: SV('<path d="M19 12H5M11 6l-6 6 6 6"/>'), gear: SV('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    open: SV('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'), copy: SV('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2"/>'),
    del: SV('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'), eye: SV('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    history: SV('<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>'), backup: SV('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'), check: SV('<path d="M5 12l5 5 9-10"/>', 14),
    folder: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" fill="#f6c945"/></svg>`,
  };
  function glyph(name, node, size) {
    try { if (FH().glyph) return FH().glyph(name, node, size); } catch (e) {}
    return node.type === "folder" ? IC.folder : `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" fill="#fff" stroke="#9aa3b2"/></svg>`;
  }
  const verNode = (v) => ({ type: "file", kind: v.kind, mime: v.mime, size: v.size });
  function win(title, w, h, appId) {
    ensureCSS();
    const ref = WM.createWindow({ title, icon: IC.app, width: Math.min(w, innerWidth - 16), height: Math.min(h, innerHeight - 70), appId: appId || "filehistory" });
    ref.body.classList.add("fh-host");
    return ref;
  }
  // in-app dialog: { title, body (html|node), buttons: [{ t, v, primary, danger }] } -> Promise<value>
  function dialog(o) {
    ensureCSS();
    return new Promise((resolve) => {
      const m = el(`<div class="fh-mask"><div class="fh-dlg fh-root" role="dialog" aria-modal="true" style="${o.width ? "width:min(" + o.width + "px,calc(100vw - 24px))" : ""}"><div class="fh-dlg-h">${esc(o.title || "")}</div><div class="fh-dlg-b"></div><div class="fh-dlg-f"></div></div></div>`);
      const b = m.querySelector(".fh-dlg-b"), f = m.querySelector(".fh-dlg-f");
      if (typeof o.body === "string") b.innerHTML = o.body; else if (o.body) b.appendChild(o.body);
      let done = false;
      const close = (v) => { if (done) return; done = true; m.remove(); document.removeEventListener("keydown", onKey, true); resolve(v); };
      (o.buttons || [{ t: "OK", v: true, primary: true }]).forEach((bt) => {
        const x = el(`<button class="fh-btn ${bt.primary ? "fh-primary" : ""} ${bt.danger ? "fh-danger" : ""}">${esc(bt.t)}</button>`);
        x.onclick = () => close(typeof bt.v === "function" ? bt.v(b) : bt.v); f.appendChild(x);
      });
      const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(o.cancel == null ? null : o.cancel); } };
      document.addEventListener("keydown", onKey, true);
      (document.getElementById("screen") || document.body).appendChild(m);
      if (o.onMount) o.onMount(b, close);
      const p = f.querySelector(".fh-primary"); if (p) p.focus();
    });
  }
  const alertBox = (title, msg) => dialog({ title, body: `<p>${msg}</p>` });
  const confirmBox = (title, msg, ok, danger) => dialog({ title, body: `<p>${msg}</p>`, buttons: [{ t: ok || "Yes", v: true, primary: true, danger }, { t: "Cancel", v: false }], cancel: false });
  function toast(msg) { try { if (window.Notify) Notify.show({ icon: IC.app, title: "File History", body: msg }); } catch (e) {} }

  // Folder picker (for "Restore to…" and exclusions)
  function pickFolder(title, start) {
    let path = (start || ["Documents"]).slice();
    const body = el(`<div class="fh-pick"><div class="fh-pick-crumbs"></div><div class="fh-pick-list" role="listbox"></div><button class="fh-btn fh-pick-new">New folder</button></div>`);
    const crumbs = body.querySelector(".fh-pick-crumbs"), list = body.querySelector(".fh-pick-list");
    function render() {
      crumbs.innerHTML = ""; const mk = (t, p) => { const c = el(`<button class="fh-crumb">${esc(t)}</button>`); c.onclick = () => { path = p; render(); }; crumbs.appendChild(c); };
      mk("This PC", []); path.forEach((s, i) => { crumbs.appendChild(el(`<span class="fh-sep">›</span>`)); mk(s, path.slice(0, i + 1)); });
      list.innerHTML = "";
      const n = nodeAt(path); const kids = n && n.children ? n.children : {};
      const names = Object.keys(kids).filter((k) => kids[k] && kids[k].type === "folder" && !(path.length === 0 && SYS_DRIVE.test(k))).sort((a, b) => a.localeCompare(b));
      if (!names.length) list.appendChild(el(`<div class="fh-muted fh-pad">No folders here.</div>`));
      names.forEach((k) => { const r = el(`<button class="fh-pick-row">${IC.folder}<span>${esc(k)}</span></button>`); r.onclick = () => { path = path.concat(k); render(); }; list.appendChild(r); });
    }
    body.querySelector(".fh-pick-new").onclick = () => { if (!path.length) return; const kids = ensureFolder(path); const nm = uniqueName(kids, "New folder"); kids[nm] = { type: "folder", children: {}, created: Date.now() }; notifyVfs(); path = path.concat(nm); render(); };
    render();
    return dialog({ title: title || "Select a folder", width: 460, body, buttons: [{ t: "Select Folder", primary: true, v: () => (path.length ? path.slice() : null) }, { t: "Cancel", v: null }] });
  }
  function askConflict(n) {
    return dialog({ title: "Replace or Skip Files", width: 440, body: `<p>The destination already has ${n} file${n === 1 ? "" : "s"} with the same name${n === 1 ? "" : "s"} but different contents.</p>`,
      buttons: [{ t: "Replace the files in the destination", v: "replace", primary: true }, { t: "Keep both", v: "both" }, { t: "Skip these files", v: "skip" }, { t: "Cancel", v: null }], cancel: null });
  }

  // ---- preview of one version (element) ----
  async function previewEl(name, v) {
    const box = el(`<div class="fh-prev"><div class="fh-muted fh-pad">Loading preview…</div></div>`);
    try {
      const kind = v.kind, ext = extOf(name);
      const isImg = kind === "image" || /^image\//.test(v.mime || "");
      const isMedia = kind === "audio" || kind === "video" || /^(audio|video)\//.test(v.mime || "");
      if (isImg || isMedia) {
        const u = await versionURL(v); box.innerHTML = "";
        if (!u) throw new Error("This version's contents are missing.");
        const m = isImg ? el(`<img alt="">`) : el(kind === "video" || /^video/.test(v.mime || "") ? `<video controls playsinline></video>` : `<audio controls></audio>`);
        m.src = u; box.appendChild(m); box.classList.add("fh-prev-media"); return box;
      }
      if (kind === "word" || ext === "docx" || ext === "html" || ext === "htm") {
        const t = await versionText(v); box.innerHTML = "";
        const fr = el(`<iframe class="fh-prev-doc" sandbox="" title="Preview"></iframe>`);
        fr.srcdoc = `<!doctype html><meta charset="utf-8"><style>body{font:14px/1.5 Calibri,Segoe UI,system-ui,sans-serif;margin:14px;color:#222;background:#fff}img{max-width:100%}</style>` + (kind === "word" && !/[<>]/.test(t) ? esc(t).replace(/\n/g, "<br>") : String(t).replace(/<script[\s\S]*?<\/script>/gi, ""));
        box.appendChild(fr); return box;
      }
      if (kind === "pptx" || kind === "xlsx" || kind === "forms") {
        const t = await versionText(v); let j = {}; try { j = JSON.parse(t || "{}"); } catch (e) {}
        box.innerHTML = "";
        if (kind === "pptx") { const sl = j.slides || []; box.appendChild(el(`<div class="fh-pad"><b>${sl.length} slide${sl.length === 1 ? "" : "s"}</b><ol class="fh-prev-ol">${sl.slice(0, 20).map((s) => `<li>${esc(((s && (s.title || s.t || (s.els && s.els[0] && (s.els[0].text || s.els[0].html)))) || "Slide").toString().replace(/<[^>]+>/g, "").slice(0, 80))}</li>`).join("")}</ol></div>`)); }
        else { const cells = j.cells || {}; const keys = Object.keys(cells).sort().slice(0, 60); box.appendChild(el(`<div class="fh-pad"><b>${Object.keys(cells).length} filled cell${Object.keys(cells).length === 1 ? "" : "s"}</b><table class="fh-prev-tbl">${keys.map((k) => `<tr><th>${esc(k)}</th><td>${esc(String(cells[k] && cells[k].v != null ? cells[k].v : cells[k]).slice(0, 60))}</td></tr>`).join("")}</table></div>`)); }
        return box;
      }
      if (v.t !== "b" || kind === "text" || /^text\//.test(v.mime || "") || v.size < 200000) {
        const t = await versionText(v); box.innerHTML = "";
        if (v.t === "b" && /[\u0000-\u0008\u000e-\u001f]/.test(t.slice(0, 2000))) throw new Error("No preview available for this type of file.");
        const pre = el(`<pre class="fh-prev-text"></pre>`); pre.textContent = t.length > 60000 ? t.slice(0, 60000) + "\n…" : t || "(empty)"; box.appendChild(pre); return box;
      }
      throw new Error("No preview available for this type of file.");
    } catch (e) { box.innerHTML = `<div class="fh-muted fh-pad">${esc(e.message || e)}</div>`; }
    return box;
  }
  function previewDialog(name, v) {
    const holder = el(`<div class="fh-prev-dlg"></div>`);
    previewEl(name, v).then((p) => holder.appendChild(p));
    return dialog({ title: name + " — " + fmtDate(v.from || v.at), width: 720, body: holder, buttons: [{ t: "Close", v: null, primary: true }] });
  }
  const reasonText = (v) => v.reason === "delete" ? "Last copy before it was deleted" : v.reason === "backup" ? "Backup copy" + (v.app ? " · saved by " + v.app : "") : v.reason === "replaced" ? (v.app ? "Saved by " + v.app + " · " : "") + "kept when a version was restored" : v.app ? "Saved by " + v.app : "Earlier version";

  // ---- Version history panel (OneDrive style) ----
  const VH = new Map();
  function openVersions(path) {
    path = path.slice(); const k = keyOf(path);
    if (VH.has(k) && VH.get(k).win.isConnected) { VH.get(k).focus(); return VH.get(k); }
    const name = path[path.length - 1];
    const ref = win("Version history — " + name, 760, 560);
    VH.set(k, ref);
    const root = el(`<div class="fh-root fh-vh">
      <div class="fh-vh-head"><span class="fh-vh-ic"></span><div class="fh-vh-ht"><b>Version history</b><span class="fh-muted fh-vh-name"></span></div><span class="fh-grow"></span><button class="fh-btn" data-a="fh">${IC.history}<span>File History</span></button></div>
      <div class="fh-vh-main"><div class="fh-vh-list" role="listbox" aria-label="Versions"></div>
        <div class="fh-vh-side"><div class="fh-vh-acts"></div><div class="fh-vh-prev"></div></div></div></div>`);
    ref.body.appendChild(root);
    root.querySelector(".fh-vh-name").textContent = winPath(path);
    root.querySelector('[data-a="fh"]').onclick = () => openApp();
    const list = root.querySelector(".fh-vh-list"), acts = root.querySelector(".fh-vh-acts"), prev = root.querySelector(".fh-vh-prev");
    let sel = null, vs = [];
    async function render() {
      if (!root.isConnected) { listeners.delete(render); return; }
      const node = nodeAt(path);
      root.querySelector(".fh-vh-ic").innerHTML = glyph(name, node || { type: "file" }, 32);
      vs = await versions(path);
      list.innerHTML = "";
      if (node && node.type === "file") {
        const r = el(`<div class="fh-vh-row fh-vh-cur ${sel === "current" ? "on" : ""}" role="option" tabindex="0"><div class="fh-vh-t"><b>Current version</b><span class="fh-chip">Current</span></div><div class="fh-muted">${esc(fmtDate(node.ts))} · ${esc(human(node.size != null && node.blob ? node.size : typeof node.content === "string" ? utf8Len(node.content) : node.size || 0))}</div></div>`);
        r.onclick = () => select("current"); list.appendChild(r);
      } else list.appendChild(el(`<div class="fh-vh-row fh-vh-gone"><b>This file was deleted</b><div class="fh-muted">Restore a version to bring it back.</div></div>`));
      if (!vs.length) list.appendChild(el(`<div class="fh-empty">${settings().on ? "No previous versions yet. Versions appear here after the file is changed and saved." : "File History is off, so no previous versions are being kept."}</div>`));
      vs.forEach((v) => {
        const r = el(`<div class="fh-vh-row ${sel && sel.id === v.id ? "on" : ""}" role="option" tabindex="0" data-v="${esc(v.id)}"><div class="fh-vh-t"><b>${esc(fmtDate(v.from || v.at))}</b></div><div class="fh-muted">${esc(reasonText(v))} · ${esc(human(v.size))}</div></div>`);
        r.onclick = () => select(v); r.onkeydown = (e) => { if (e.key === "Enter") select(v); };
        list.appendChild(r);
      });
      if (sel && sel !== "current" && !vs.some((v) => v.id === sel.id)) sel = null;
      if (!sel) select(vs[0] || (node ? "current" : null), true); else paintSide();
    }
    function select(v, quiet) { sel = v; list.querySelectorAll(".fh-vh-row").forEach((r) => r.classList.toggle("on", v && v !== "current" ? r.dataset.v === v.id : v === "current" && r.classList.contains("fh-vh-cur"))); paintSide(); void quiet; }
    let paintTok = 0;
    function paintSide() {
      const tok = ++paintTok;
      acts.innerHTML = ""; prev.innerHTML = "";
      if (!sel) { prev.appendChild(el(`<div class="fh-empty">Select a version to preview it.</div>`)); return; }
      if (sel === "current") {
        const node = nodeAt(path); if (!node) return;
        acts.appendChild(btn(IC.open, "Open", () => FH().openFile ? FH().openFile(name, node, path) : VFS.openNode(name, node)));
        // the current content isn't necessarily in our store: preview straight from the node
        prev.appendChild(currentPreview(name, node));
        return;
      }
      const v = sel;
      acts.appendChild(btn(IC.restore, "Restore", async () => {
        if (!(await confirmBox("Restore this version?", `“${esc(name)}” will be replaced with the version from <b>${esc(fmtDate(v.from || v.at))}</b>. The current version is kept in the version history.`, "Restore"))) return;
        try { await restore(path, v.id); toast("Restored “" + name + "” to the version from " + fmtDate(v.from || v.at) + "."); sel = null; render(); } catch (er) { alertBox("Restore", esc(er.message)); }
      }, true));
      acts.appendChild(btn(IC.copy, "Restore a copy", async () => { try { const p = await restoreCopy(path, v.id); toast("Saved “" + p[p.length - 1] + "”."); } catch (er) { alertBox("Restore a copy", esc(er.message)); } }));
      acts.appendChild(btn(IC.open, "Open", () => openVersion(path, v.id).catch((er) => alertBox("Open", esc(er.message)))));
      acts.appendChild(btn(IC.del, "Delete", async () => { if (await confirmBox("Delete this version?", "The version from " + esc(fmtDate(v.from || v.at)) + " will be permanently deleted.", "Delete", true)) { await deleteVersion(path, v.id); sel = null; render(); } }));
      previewEl(name, v).then((p) => { if (tok === paintTok) { prev.innerHTML = ""; prev.appendChild(p); } });
    }
    listeners.add(render);
    const onVfs = () => { if (!root.isConnected) { window.removeEventListener("vfs-change", onVfs); return; } render(); };
    window.addEventListener("vfs-change", onVfs);
    render();
    return ref;
  }
  function currentPreview(name, node) {
    const box = el(`<div class="fh-prev"></div>`);
    const k = node.kind, img = k === "image" || /^image\//.test(node.mime || "");
    if (img) {
      const show = (u) => { box.innerHTML = ""; box.classList.add("fh-prev-media"); const i = el(`<img alt="">`); i.src = u; box.appendChild(i); };
      if (node.blob) VFS.getBlob(node.blob).then((b) => { if (b) show(URL.createObjectURL(b)); else if (node.src) show(node.src); }); else if (node.src) show(node.src);
      return box;
    }
    if (typeof node.content === "string") {
      if (k === "word") { const fr = el(`<iframe class="fh-prev-doc" sandbox="" title="Preview"></iframe>`); fr.srcdoc = `<!doctype html><meta charset="utf-8"><style>body{font:14px/1.5 Calibri,Segoe UI,system-ui,sans-serif;margin:14px;color:#222;background:#fff}</style>` + node.content.replace(/<script[\s\S]*?<\/script>/gi, ""); box.appendChild(fr); }
      else { const pre = el(`<pre class="fh-prev-text"></pre>`); pre.textContent = node.content.slice(0, 60000) || "(empty)"; box.appendChild(pre); }
      return box;
    }
    box.innerHTML = `<div class="fh-muted fh-pad">No preview available.</div>`; return box;
  }
  function btn(ic, t, fn, primary) { const b = el(`<button class="fh-btn ${primary ? "fh-primary" : ""}">${ic}<span>${esc(t)}</span></button>`); b.onclick = fn; return b; }

  // ---- Properties ▸ Previous Versions (element for js/files12.js) ----
  function propertiesPanel(entry) {
    ensureCSS();
    const path = entry.path.concat(entry.name), isFolder = entry.node && entry.node.type === "folder";
    const d = el(`<div class="fh-root fh-pv"><p class="fh-muted fh-pv-intro"></p><div class="fh-pv-tbl" role="listbox"><div class="fh-pv-h"><span>Name</span><span>Date modified</span><span>${isFolder ? "Items" : "Saved by"}</span></div><div class="fh-pv-rows"><div class="fh-muted fh-pad">Loading…</div></div></div><div class="fh-pv-btns"></div><div class="fh-pv-foot"></div></div>`);
    const rows = d.querySelector(".fh-pv-rows"), btns = d.querySelector(".fh-pv-btns"), foot = d.querySelector(".fh-pv-foot");
    const s = settings();
    d.querySelector(".fh-pv-intro").textContent = isFolder ? "Previous versions of this folder come from File History. Open one to browse it as it was, or restore it." : "Previous versions come from File History and OneDrive-style version history. They're saved each time the file changes.";
    let sel = null;
    function paintFoot() {
      foot.innerHTML = "";
      const st = el(`<div class="fh-pv-status">${IC.app}<span>${s.on ? (included(path) ? "File History is on for this location." : "This location isn't included in File History.") : "File History is off."}</span></div>`);
      const more = el(`<button class="fh-link">${s.on && included(path) ? "File History settings" : s.on ? "Include this folder…" : "Turn on File History"}</button>`);
      more.onclick = () => { if (!s.on) { setOn(true); render(); } else if (!included(path)) { s.include.push(isFolder ? path.slice() : entry.path.slice()); s.exclude = s.exclude.filter((p) => !(keyOf(path).startsWith(keyOf(p)))); saveSettings(); runDiff(); render(); } else openApp(); };
      st.appendChild(more); foot.appendChild(st);
    }
    async function render() {
      if (!d.isConnected && sel !== undefined && d.__mounted) { listeners.delete(render); return; }
      d.__mounted = true;
      await ready; rows.innerHTML = ""; btns.innerHTML = ""; paintFoot();
      if (isFolder) {
        const usable = points().slice().reverse().map((T) => ({ T, n: filesUnder(path, T).length })).filter((x) => x.n);
        if (!usable.length) { rows.appendChild(el(`<div class="fh-empty">There are no previous versions available.</div>`)); }
        usable.slice(0, 80).forEach((p) => {
          const r = el(`<button class="fh-pv-row" role="option"><span>${glyph(entry.name, entry.node, 18)}<span>${esc(entry.name)}</span></span><span title="${esc(longDate(p.T))}">${esc(shortDate(p.T))}</span><span>${p.n} file${p.n === 1 ? "" : "s"}</span></button>`);
          r.onclick = () => { sel = p; rows.querySelectorAll(".fh-pv-row").forEach((x) => x.classList.toggle("on", x === r)); paintBtns(); };
          r.ondblclick = () => openRestore({ path, at: p.T });
          rows.appendChild(r);
        });
        paintBtns(); return;
      }
      const vs = await versions(path);
      if (!vs.length) rows.appendChild(el(`<div class="fh-empty">There are no previous versions available.</div>`));
      vs.forEach((v) => {
        const r = el(`<button class="fh-pv-row" role="option" data-v="${esc(v.id)}"><span>${glyph(entry.name, verNode(v), 18)}<span>${esc(entry.name)}</span></span><span title="${esc(longDate(v.from || v.at))}">${esc(shortDate(v.from || v.at))}</span><span>${esc(v.reason === "delete" ? "Deleted" : v.reason === "backup" ? "Backup" : v.app || "—")}</span></button>`);
        r.onclick = () => { sel = v; rows.querySelectorAll(".fh-pv-row").forEach((x) => x.classList.toggle("on", x === r)); paintBtns(); };
        r.ondblclick = () => openVersion(path, v.id).catch((er) => alertBox("Open", esc(er.message)));
        rows.appendChild(r);
      });
      if (sel && !vs.some((v) => v.id === sel.id)) sel = null;
      paintBtns();
    }
    function paintBtns() {
      btns.innerHTML = "";
      if (isFolder) {
        btns.appendChild(btn(IC.open, "Open", () => sel && openRestore({ path, at: sel.T }))).disabled = !sel;
        btns.appendChild(btn(IC.restore, "Restore", async () => {
          if (!sel) return; const items = filesUnder(path, sel.T);
          const c = conflictsFor(items); let mode = "replace"; if (c) { mode = await askConflict(c); if (!mode) return; }
          const r = await restoreItems(items, { mode }); toast(summary(r)); render();
        })).disabled = !sel;
        return;
      }
      const has = !!sel;
      btns.appendChild(btn(IC.open, "Open", () => sel && openVersion(path, sel.id).catch((er) => alertBox("Open", esc(er.message))))).disabled = !has;
      btns.appendChild(btn(IC.eye, "Preview", () => sel && previewDialog(entry.name, sel))).disabled = !has;
      btns.appendChild(btn(IC.restore, "Restore", async () => {
        if (!sel) return;
        if (!(await confirmBox("Restore previous version", `Replace “${esc(entry.name)}” with the version from <b>${esc(fmtDate(sel.from || sel.at))}</b>? The current file is kept as a version.`, "Restore"))) return;
        try { await restore(path, sel.id); toast("Restored “" + entry.name + "”."); sel = null; render(); } catch (er) { alertBox("Restore", esc(er.message)); }
      })).disabled = !has;
      btns.appendChild(btn(IC.copy, "Copy restore", async () => { if (!sel) return; try { const p = await restoreCopy(path, sel.id); toast("Saved “" + p[p.length - 1] + "”."); } catch (er) { alertBox("Copy restore", esc(er.message)); } })).disabled = !has;
      btns.appendChild(btn(IC.del, "Delete", async () => { if (!sel) return; if (await confirmBox("Delete version", "Permanently delete the version from " + esc(fmtDate(sel.from || sel.at)) + "?", "Delete", true)) { await deleteVersion(path, sel.id); sel = null; render(); } })).disabled = !has;
      const vh = el(`<button class="fh-link fh-pv-vh">Version history…</button>`); vh.onclick = () => openVersions(path); btns.appendChild(vh);
    }
    listeners.add(render);
    render();
    return d;
  }
  function summary(r) {
    const parts = []; if (r.restored) parts.push("Restored " + r.restored + " item" + (r.restored === 1 ? "" : "s") + ".");
    if (r.same) parts.push(r.same + " already up to date."); if (r.skipped) parts.push(r.skipped + " skipped.");
    if (r.errors && r.errors.length) parts.push(r.errors.length + " couldn't be restored.");
    return parts.join(" ") || "Nothing to restore.";
  }

  // ---- Restore personal files (time slider) ----
  let RS = null;
  function openRestore(opts) {
    opts = opts || {};
    if (RS && RS.ref.win.isConnected) { RS.ref.focus(); if (opts.path) RS.go(opts.path, opts.at); return RS.ref; }
    const ref = win("Home - File History", 940, 640, "filehistory");
    const root = el(`<div class="fh-root fh-rs">
      <div class="fh-rs-top"><button class="fh-ib" data-a="back" title="Back" aria-label="Back">${IC.back}</button><button class="fh-ib" data-a="up" title="Up" aria-label="Up">${IC.up}</button><div class="fh-rs-addr"></div><button class="fh-ib" data-a="gear" title="Options" aria-label="Options">${IC.gear}</button></div>
      <div class="fh-rs-when"><b class="fh-rs-date"></b><span class="fh-muted fh-rs-count"></span></div>
      <div class="fh-rs-items" role="listbox" aria-multiselectable="true"></div>
      <div class="fh-rs-time"><span class="fh-muted fh-rs-old">Oldest</span><input type="range" class="fh-rs-slider" min="0" max="0" step="1" aria-label="Backup time"><span class="fh-muted">Newest</span></div>
      <div class="fh-rs-bar"><span class="fh-rs-sel fh-muted"></span><button class="fh-rs-nav" data-a="prev" title="Previous version" aria-label="Previous version">${IC.prev}</button><button class="fh-rs-go" data-a="restore" title="Restore to original location" aria-label="Restore to original location">${SV('<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/>', 30)}</button><button class="fh-rs-nav" data-a="next" title="Next version" aria-label="Next version">${IC.next}</button><span class="fh-rs-right"><button class="fh-btn" data-a="to">Restore to…</button></span></div></div>`);
    ref.body.appendChild(root);
    const $ = (s) => root.querySelector(s);
    const itemsEl = $(".fh-rs-items"), slider = $(".fh-rs-slider");
    let pts = points(), pi = pts.length - 1, P = [], hist = [], selected = new Set();
    if (opts.at != null) { const i = pts.findIndex((t) => t >= opts.at); pi = i < 0 ? pts.length - 1 : i; }
    if (opts.path) P = opts.path.slice();
    const T = () => pts[pi];
    function go(path, at) { if (path) { hist.push(P); P = path.slice(); } if (at != null) { pts = points(); const i = pts.findIndex((t) => t >= at); pi = i < 0 ? pts.length - 1 : i; } selected.clear(); paint(); }
    function current() {
      if (!pts.length) return [];
      const { folders, files } = listAt(P, T());
      const out = [];
      [...folders.keys()].sort((a, b) => a.localeCompare(b)).forEach((nm) => out.push({ folder: true, name: nm, path: P.concat(nm), n: folders.get(nm) }));
      files.sort((a, b) => a.name.localeCompare(b.name)).forEach((f) => out.push(f));
      return out;
    }
    function paint() {
      pts = points(); if (pi >= pts.length) pi = pts.length - 1; if (pi < 0 && pts.length) pi = pts.length - 1;
      const addr = $(".fh-rs-addr"); addr.innerHTML = "";
      const crumb = (t, p) => { const b = el(`<button class="fh-crumb">${esc(t)}</button>`); b.onclick = () => go(p); addr.appendChild(b); };
      crumb("Home", []); P.forEach((s, i) => { addr.appendChild(el(`<span class="fh-sep">›</span>`)); crumb(s, P.slice(0, i + 1)); });
      $('[data-a="back"]').disabled = !hist.length; $('[data-a="up"]').disabled = !P.length;
      slider.max = Math.max(0, pts.length - 1); slider.value = Math.max(0, pi); slider.disabled = pts.length < 2;
      $('[data-a="prev"]').disabled = pi <= 0; $('[data-a="next"]').disabled = pi >= pts.length - 1;
      itemsEl.innerHTML = "";
      if (!pts.length) {
        $(".fh-rs-date").textContent = "No backups yet"; $(".fh-rs-count").textContent = "";
        itemsEl.appendChild(el(`<div class="fh-empty fh-rs-empty">${IC.big}<p>File History hasn't saved any copies of your files yet.</p><p class="fh-muted">Copies are saved when files change, and when you select <b>Back up now</b> in File History.</p></div>`));
        const b = btn(IC.backup, "Back up now", async () => { b.disabled = true; await backupNow(true); paint(); }, true); itemsEl.querySelector(".fh-rs-empty").appendChild(b);
        $('[data-a="restore"]').disabled = true; $('[data-a="to"]').disabled = true; $(".fh-rs-sel").textContent = ""; return;
      }
      $(".fh-rs-date").textContent = longDate(T()); $(".fh-rs-count").textContent = "  |  " + (pi + 1) + " of " + pts.length;
      const list = current();
      if (!list.length) itemsEl.appendChild(el(`<div class="fh-empty">This folder was empty at this time.</div>`));
      list.forEach((it) => {
        const k = keyOf(it.path);
        const now = it.folder ? null : nodeAt(it.path);
        let badge = "";
        if (!it.folder) { if (!now) badge = `<span class="fh-chip fh-chip-del">Deleted</span>`; else if (it.v !== "current" && hashOf(entryOf(it.path, it.name, now)) !== it.v.h) badge = `<span class="fh-chip">Changed since</span>`; }
        else if (!nodeAt(it.path)) badge = `<span class="fh-chip fh-chip-del">Deleted</span>`;
        const node = it.folder ? { type: "folder" } : it.v === "current" ? now || { type: "file" } : verNode(it.v);
        const sub = it.folder ? it.n + " item" + (it.n === 1 ? "" : "s") : it.v === "current" ? fmtDate(now && now.ts) : fmtDate(it.v.from || it.v.at) + " · " + human(it.v.size);
        const t = el(`<div class="fh-rs-it ${selected.has(k) ? "on" : ""}" role="option" tabindex="0" aria-selected="${selected.has(k)}" data-k="${esc(k)}"><span class="fh-rs-chk">${IC.check}</span><span class="fh-rs-ic">${glyph(it.name, node, 44)}</span><span class="fh-rs-nm"></span><span class="fh-muted fh-rs-sub">${esc(sub)}</span>${badge}</div>`);
        t.querySelector(".fh-rs-nm").textContent = it.name;
        let lastTap = 0;
        t.addEventListener("click", (e) => {
          const touch = e.pointerType === "touch" || (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) || matchMedia("(pointer: coarse)").matches;
          if (e.target.closest(".fh-rs-chk")) { toggle(k); return; }
          if (touch) { if (it.folder) { go(it.path); return; } const n2 = Date.now(); if (n2 - lastTap < 350) { openItem(it); return; } lastTap = n2; toggle(k); return; }
          if (e.ctrlKey || e.metaKey) toggle(k); else { selected.clear(); selected.add(k); paintSel(); }
        });
        t.addEventListener("dblclick", () => openItem(it));
        t.addEventListener("keydown", (e) => { if (e.key === "Enter") openItem(it); else if (e.key === " ") { e.preventDefault(); toggle(k); } });
        itemsEl.appendChild(t);
      });
      paintSel();
    }
    function toggle(k) { selected.has(k) ? selected.delete(k) : selected.add(k); paintSel(); }
    function paintSel() {
      itemsEl.querySelectorAll(".fh-rs-it").forEach((t) => { const on = selected.has(t.dataset.k); t.classList.toggle("on", on); t.setAttribute("aria-selected", String(on)); });
      const n = selected.size;
      $(".fh-rs-sel").textContent = n ? n + " item" + (n === 1 ? "" : "s") + " selected" : "";
      $('[data-a="restore"]').disabled = false; $('[data-a="to"]').disabled = false;
      $('[data-a="restore"]').title = n ? "Restore the selected items to their original location" : "Restore everything in this folder to its original location";
    }
    function openItem(it) { if (it.folder) return go(it.path); if (it.v === "current") { const n = nodeAt(it.path); if (n && FH().openFile) FH().openFile(it.name, n, it.path); return; } previewDialog(it.name, it.v); }
    function chosen() {
      const list = current(); const pick = selected.size ? list.filter((it) => selected.has(keyOf(it.path))) : list;
      const out = []; pick.forEach((it) => { if (it.folder) filesUnder(it.path, T()).forEach((f) => out.push(f)); else out.push({ path: it.path, v: it.v }); });
      return out;
    }
    async function doRestore(dest) {
      const items = chosen(); if (!items.length) return;
      const o = dest ? { dest, base: P } : {};
      const c = conflictsFor(items, o); o.mode = "replace";
      if (c) { o.mode = await askConflict(c); if (!o.mode) return; }
      const r = await restoreItems(items, o);
      toast(summary(r)); if (r.errors.length) alertBox("Some items weren't restored", esc(r.errors.slice(0, 8).join("\n")).replace(/\n/g, "<br>"));
      paint();
      if (r.restored && FH().open) { const at = dest || (P.length ? P : items[0].path.slice(0, -1)); if (at && at.length && confirmOpen) FH().open(at.slice()); }
    }
    const confirmOpen = true;
    $('[data-a="restore"]').onclick = () => doRestore(null);
    $('[data-a="to"]').onclick = async () => { const d = await pickFolder("Restore to", P.length ? P : ["Documents"]); if (d) doRestore(d); };
    $('[data-a="prev"]').onclick = () => { if (pi > 0) { pi--; paint(); } };
    $('[data-a="next"]').onclick = () => { if (pi < pts.length - 1) { pi++; paint(); } };
    $('[data-a="back"]').onclick = () => { if (hist.length) { P = hist.pop(); selected.clear(); paint(); } };
    $('[data-a="up"]').onclick = () => { if (P.length) { hist.push(P); P = P.slice(0, -1); selected.clear(); paint(); } };
    slider.oninput = () => { pi = +slider.value; paint(); };
    $('[data-a="gear"]').onclick = async () => {
      const r = await dialog({ title: "Options", width: 360, body: `<div class="fh-optlist"><button class="fh-opt" data-v="all">Select all</button><button class="fh-opt" data-v="to">Restore to…</button><button class="fh-opt" data-v="settings">File History settings</button><button class="fh-opt" data-v="backup">Back up now</button></div>`, buttons: [{ t: "Close", v: null }], onMount: (b, close) => b.querySelectorAll(".fh-opt").forEach((x) => (x.onclick = () => close(x.dataset.v))) });
      if (r === "all") { current().forEach((it) => selected.add(keyOf(it.path))); paintSel(); }
      else if (r === "to") $('[data-a="to"]').click();
      else if (r === "settings") openApp();
      else if (r === "backup") { await backupNow(true); paint(); }
    };
    const onKey = (e) => { if (!root.isConnected) { document.removeEventListener("keydown", onKey); return; } const top = ref.win.style.zIndex && [...document.querySelectorAll("#screen > .win")].every((w) => w === ref.win || (+w.style.zIndex || 0) <= +ref.win.style.zIndex); if (!top || /input|textarea/i.test((e.target && e.target.tagName) || "")) return; if (e.key === "ArrowLeft" && e.ctrlKey) $('[data-a="prev"]').click(); if (e.key === "ArrowRight" && e.ctrlKey) $('[data-a="next"]').click(); };
    document.addEventListener("keydown", onKey);
    const re = () => { if (!root.isConnected) { listeners.delete(re); return; } paint(); };
    listeners.add(re);
    paint();
    RS = { ref, go };
    return ref;
  }

  // ---- File History app (Control Panel style) ----
  function openApp(page) {
    const ref = win("File History", 880, 600, "filehistory");
    const root = el(`<div class="fh-root fh-app"><nav class="fh-side"></nav><main class="fh-main"></main></div>`);
    ref.body.appendChild(root);
    const side = root.querySelector(".fh-side"), main = root.querySelector(".fh-main");
    let cur = page || "home";
    const LINKS = [["home", "File History"], ["restore", "Restore personal files"], ["folders", "Select folders"], ["exclude", "Exclude folders"], ["advanced", "Advanced settings"]];
    function nav() {
      side.innerHTML = "";
      LINKS.forEach(([id, t]) => { const b = el(`<button class="fh-sidelink ${cur === id ? "on" : ""}">${esc(t)}</button>`); b.onclick = () => { if (id === "restore") openRestore(); else { cur = id; paint(); } }; side.appendChild(b); });
      side.appendChild(el(`<div class="fh-side-sep"></div>`));
      const sr = el(`<button class="fh-sidelink">System Restore</button>`); sr.onclick = () => { try { WM.open("recovery"); } catch (e) {} if (!window.AppRegistry || !AppRegistry.recovery) { try { window.SettingsStartPage = "recovery"; WM.open("settings"); } catch (e) {} } }; side.appendChild(sr);
      const rb = el(`<button class="fh-sidelink">Recycle Bin</button>`); rb.onclick = () => { window.FilesStartPath = "bin"; WM.open("fileexplorer"); }; side.appendChild(rb);
    }
    function paint() {
      if (!root.isConnected) { listeners.delete(paint); return; }
      nav(); main.innerHTML = ""; main.scrollTop = 0;
      ({ home, folders, exclude, advanced }[cur] || home)();
    }
    function home() {
      const s = settings(), u = usage();
      const pct = Math.min(100, (u.bytes / u.cap) * 100);
      const w = el(`<div><h1 class="fh-h1">Keep a history of your files</h1><p class="fh-muted">File History saves copies of your files so you can get them back if they're lost, damaged or changed by mistake. Copies are kept on this device (in this browser's storage) for <b>${esc(accountName())}</b>.</p>
        <div class="fh-card fh-status ${s.on ? "on" : "off"}"><div class="fh-status-ic">${IC.big}</div><div class="fh-status-t"><b>File History is ${s.on ? "on" : "off"}</b>
          <div class="fh-muted">${s.on ? "Copy files from: " + esc(s.include.map((p) => p.join("\\")).join(", ") || "nothing yet") : "Turn on File History to keep previous versions of your files."}</div>
          <div class="fh-meter" aria-label="Storage used"><i style="width:${Math.max(1, pct).toFixed(1)}%"></i></div>
          <div class="fh-muted">${esc(human(u.bytes))} used of ${esc(human(u.cap))} · ${u.versions} version${u.versions === 1 ? "" : "s"} of ${u.files} file${u.files === 1 ? "" : "s"}${u.deleted ? " · " + u.deleted + " deleted file" + (u.deleted === 1 ? "" : "s") + " restorable" : ""}</div>
          <div class="fh-muted fh-last">${u.lastRun ? "Files last copied on " + esc(longDate(u.lastRun)) + "." : "Files haven't been backed up yet."}</div></div></div>
        <div class="fh-row fh-acts"></div>
        <div class="fh-card fh-tiles"></div></div>`);
      const acts = w.querySelector(".fh-acts");
      acts.appendChild(btn(s.on ? IC.del : IC.history, s.on ? "Turn off" : "Turn on", () => { setOn(!s.on); paint(); }, !s.on));
      const run = btn(IC.backup, running ? "Backing up…" : "Back up now", async () => { run.disabled = true; run.querySelector("span").textContent = "Backing up…"; const r = await backupNow(true); toast(r.n ? "Copied " + r.n + " file" + (r.n === 1 ? "" : "s") + " (" + human(r.bytes) + ")." : "Everything is already backed up."); paint(); }, s.on);
      run.disabled = !s.on || !!running; acts.appendChild(run);
      acts.appendChild(btn(IC.restore, "Restore personal files", () => openRestore()));
      const tiles = w.querySelector(".fh-tiles");
      [["Save copies of files", FREQ[s.freq].label, "advanced"], ["Keep saved versions", KEEP[s.keep], "advanced"], ["Storage limit", s.maxMB >= 1024 ? s.maxMB / 1024 + " GB" : s.maxMB + " MB", "advanced"], ["Excluded folders", s.exclude.length ? s.exclude.map((p) => p.join("\\")).join(", ") : "None", "exclude"]].forEach(([k, v, pg]) => {
        const r = el(`<button class="fh-tile"><span>${esc(k)}</span><b></b></button>`); r.querySelector("b").textContent = v; r.onclick = () => { cur = pg; paint(); }; tiles.appendChild(r);
      });
      // recent activity
      const recent = [];
      idx.forEach((rec) => rec.versions.forEach((v) => { if (v.reason !== "backup") recent.push({ rec, v }); }));
      recent.sort((a, b) => b.v.at - a.v.at);
      if (recent.length) {
        const c = el(`<div class="fh-card"><div class="fh-card-h">Recent versions</div><div class="fh-recent"></div></div>`);
        const lst = c.querySelector(".fh-recent");
        recent.slice(0, 8).forEach(({ rec, v }) => {
          const r = el(`<button class="fh-recent-row"><span class="fh-rs-ic">${glyph(rec.name, verNode(v), 24)}</span><span class="fh-recent-t"><b></b><span class="fh-muted"></span></span><span class="fh-muted">${esc(ago(v.at))}</span></button>`);
          r.querySelector("b").textContent = rec.name; r.querySelector(".fh-recent-t .fh-muted").textContent = rec.path.slice(0, -1).join("\\") + " · " + reasonText(v);
          r.onclick = () => openVersions(rec.path); lst.appendChild(r);
        });
        w.appendChild(c);
      }
      main.appendChild(w);
    }
    function folders() {
      const s = settings(), r = fsRoot() || {};
      const w = el(`<div><h1 class="fh-h1">Select folders</h1><p class="fh-muted">File History keeps versions of files in these folders (and everything inside them).</p><div class="fh-card fh-checks"></div><div class="fh-row"><button class="fh-btn" data-a="add">Add a folder…</button><button class="fh-btn" data-a="reset">Restore defaults</button></div></div>`);
      const box = w.querySelector(".fh-checks");
      const tops = Object.keys(r).filter((k) => r[k] && r[k].type === "folder" && !SYS_DRIVE.test(k)).sort((a, b) => a.localeCompare(b));
      const extra = s.include.filter((p) => p.length > 1 || !tops.includes(p[0]));
      tops.map((k) => [k]).concat(extra).forEach((p) => {
        const on = s.include.some((x) => keyOf(x) === keyOf(p));
        const row = el(`<label class="fh-check"><input type="checkbox" ${on ? "checked" : ""}><span>${IC.folder}<span></span></span></label>`);
        row.querySelector("span > span").textContent = p.join("\\");
        row.querySelector("input").onchange = (e) => { if (e.target.checked) s.include.push(p.slice()); else s.include = s.include.filter((x) => keyOf(x) !== keyOf(p)); base = null; saveSettings(); runDiff(); };
        box.appendChild(row);
      });
      w.querySelector('[data-a="add"]').onclick = async () => { const p = await pickFolder("Add a folder to File History", ["Documents"]); if (p && !s.include.some((x) => keyOf(x) === keyOf(p))) { s.include.push(p); base = null; saveSettings(); runDiff(); paint(); } };
      w.querySelector('[data-a="reset"]').onclick = () => { s.include = DEFAULT_INCLUDE.map((n) => [n]); base = null; saveSettings(); runDiff(); paint(); };
      main.appendChild(w);
    }
    function exclude() {
      const s = settings();
      const w = el(`<div><h1 class="fh-h1">Exclude folders</h1><p class="fh-muted">Files in these folders won't get previous versions, even if their parent folder is included.</p><div class="fh-card fh-excl"></div><div class="fh-row"><button class="fh-btn fh-primary" data-a="add">Add…</button><button class="fh-btn" data-a="rm" disabled>Remove</button></div></div>`);
      const box = w.querySelector(".fh-excl"); let pick = null;
      if (!s.exclude.length) box.appendChild(el(`<div class="fh-muted fh-pad">No folders are excluded.</div>`));
      s.exclude.forEach((p, i) => { const r = el(`<button class="fh-excl-row">${IC.folder}<span></span></button>`); r.querySelector("span").textContent = winPath(p); r.onclick = () => { pick = i; box.querySelectorAll(".fh-excl-row").forEach((x) => x.classList.toggle("on", x === r)); w.querySelector('[data-a="rm"]').disabled = false; }; box.appendChild(r); });
      w.querySelector('[data-a="add"]').onclick = async () => { const p = await pickFolder("Exclude a folder", ["Documents"]); if (p && !s.exclude.some((x) => keyOf(x) === keyOf(p))) { s.exclude.push(p); base = null; saveSettings(); runDiff(); paint(); } };
      w.querySelector('[data-a="rm"]').onclick = () => { if (pick == null) return; s.exclude.splice(pick, 1); base = null; saveSettings(); runDiff(); paint(); };
      main.appendChild(w);
    }
    function advanced() {
      const s = settings();
      const sel = (opts, val) => `<select class="fh-select">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
      const w = el(`<div><h1 class="fh-h1">Advanced settings</h1><p class="fh-muted">Choose how often to save copies of your files, and how long to keep saved versions.</p>
        <div class="fh-card fh-form">
          <label class="fh-field"><span>Save copies of files:</span>${sel(Object.keys(FREQ).map((k) => [k, FREQ[k].label]), s.freq)}</label>
          <label class="fh-field"><span>Keep saved versions:</span>${sel(Object.keys(KEEP).map((k) => [k, KEEP[k]]), s.keep)}</label>
          <label class="fh-field"><span>Use up to:</span>${sel(CAPS.map((m) => [m, m >= 1024 ? m / 1024 + " GB" : m + " MB"]), s.maxMB)}</label>
        </div>
        <div class="fh-card"><div class="fh-card-h">Version cleanup</div><p class="fh-muted">Delete older versions of files and folders. The most recent version of every file is kept unless you delete it yourself.</p>
          <div class="fh-row"><label class="fh-field fh-inline"><span>Delete files:</span>${sel([["latest", "All but the latest one"], [30, "Older than 1 month"], [91, "Older than 3 months"], [182, "Older than 6 months"], [365, "Older than 1 year"]], "latest")}</label><button class="fh-btn" data-a="clean">Clean up versions</button></div></div>
        <div class="fh-card"><div class="fh-card-h">Event logs</div><p class="fh-muted">File History records backups, restores and cleanups in Event Viewer ▸ Windows Logs ▸ Application (source: FileHistory).</p><div class="fh-row"><button class="fh-btn" data-a="ev">Open Event Viewer</button><button class="fh-btn fh-danger" data-a="wipe">Delete all versions…</button></div></div></div>`);
      const sels = w.querySelectorAll(".fh-form .fh-select");
      sels[0].onchange = (e) => { s.freq = e.target.value; saveSettings(); };
      sels[1].onchange = (e) => { s.keep = e.target.value; saveSettings(); scheduleEnforce(); };
      sels[2].onchange = (e) => { s.maxMB = +e.target.value; saveSettings(); scheduleEnforce(); };
      w.querySelector('[data-a="clean"]').onclick = async () => {
        const v = w.querySelectorAll(".fh-select")[3].value;
        if (!(await confirmBox("File History Cleanup", "Delete " + (v === "latest" ? "all but the latest version of each file" : "versions older than " + ({ 30: "1 month", 91: "3 months", 182: "6 months", 365: "1 year" })[v]) + "?", "Clean up", true))) return;
        const n = await cleanup(v === "latest" ? "latest" : +v); toast("Removed " + n + " version" + (n === 1 ? "" : "s") + ".");
      };
      w.querySelector('[data-a="ev"]').onclick = () => WM.open("eventviewer");
      w.querySelector('[data-a="wipe"]').onclick = async () => { if (await confirmBox("Delete all versions", "Permanently delete every saved version and backup copy? Your current files aren't affected.", "Delete all", true)) { await wipe(); toast("All versions were deleted."); paint(); } };
      main.appendChild(w);
    }
    listeners.add(paint);
    paint();
    return ref;
  }
  function accountName() { try { if (window.Accounts && Accounts.current) return Accounts.current().name; } catch (e) {} const p = S().profile || {}; return p.username || "you"; }

  // ---- Settings card (Settings ▸ Accounts ▸ Windows Backup, Settings ▸ System ▸ Storage) ----
  function settingsCard(compact) {
    ensureCSS();
    const s = settings(), u = usage();
    const c = el(`<div class="w12s-card fh-root fh-scard"><div class="fh-scard-top">${IC.app}<div class="fh-grow"><div class="w12s-row-t">File History</div><div class="w12s-row-s">${s.on ? "On" : "Off"} · ${esc(human(u.bytes))} of ${esc(human(u.cap))} · ${u.versions} version${u.versions === 1 ? "" : "s"}${u.lastRun ? " · last backup " + esc(ago(u.lastRun)) : ""}</div></div><label class="fh-switch"><input type="checkbox" ${s.on ? "checked" : ""} aria-label="File History"><i></i></label></div>
      <div class="fh-row"></div></div>`);
    c.querySelector(".fh-switch input").onchange = (e) => { setOn(e.target.checked); const n = settingsCard(compact); c.replaceWith(n); };
    const row = c.querySelector(".fh-row");
    if (!compact) row.appendChild(btn(IC.backup, "Back up now", async (e) => { const b = e.currentTarget; b.disabled = true; const r = await backupNow(true); toast(r.n ? "Copied " + r.n + " file" + (r.n === 1 ? "" : "s") + "." : "Everything is already backed up."); const n = settingsCard(compact); c.replaceWith(n); }));
    row.appendChild(btn(IC.restore, "Restore files", () => openRestore()));
    row.appendChild(btn(IC.gear, compact ? "Backup options" : "More options", () => openApp()));
    return c;
  }
  window.SettingsSubs = window.SettingsSubs || {};
  if (!Object.prototype.hasOwnProperty.call(window.SettingsSubs, "filehistory")) window.SettingsSubs.filehistory = { title: "File History", parent: "accounts", build(h) {
    h.appendChild(settingsCard(false));
    const b = el(`<div class="w12s-card"><div class="w12s-row-t">Previous versions</div><div class="w12s-row-s">Right-click a file in File Explorer and choose Version history, or open its Properties ▸ Previous Versions.</div></div>`); h.appendChild(b);
  } };

  // ---------------------------------------------------------------- runtime hooks into other apps
  function wrapApps() {
    const AR = window.AppRegistry; if (!AR) return;
    if (!AR.filehistory) AR.filehistory = function () { return openApp(); };
    // Control Panel: add a "File History" item (All items, System and Security, search) at runtime
    if (AR.controlpanel && !AR.controlpanel.__fh) {
      const o = AR.controlpanel;
      const w = function () { const r = o.apply(this, arguments); try { const ents = WM.windows().filter((e) => e.appId === "controlpanel"); const en = ents[ents.length - 1]; if (en) decorateCP(en.win); } catch (e) {} return r; };
      w.__fh = true; AR.controlpanel = w;
    }
    if (AR.settings && !AR.settings.__fh) {
      const o = AR.settings;
      const w = function () { const r = o.apply(this, arguments); try { const ents = WM.windows().filter((e) => e.appId === "settings"); const en = ents[ents.length - 1]; if (en) decorateSettings(en.win); } catch (e) {} return r; };
      w.__fh = true; AR.settings = w;
    }
    // removing an account also removes its File History database
    if (window.Accounts && Accounts.remove && !Accounts.remove.__fh) {
      const o = Accounts.remove;
      const w = function (id) { const r = o.apply(this, arguments); try { if (r && State.keyFor) indexedDB.deleteDatabase("win12-filehistory:" + State.keyFor(id)); } catch (e) {} return r; };
      w.__fh = true; Accounts.remove = w;
    }
  }
  const CP_IC = `<svg class="st-gi" viewBox="0 0 24 24" width="SZ" height="SZ"><path d="M2 6a1.5 1.5 0 0 1 1.5-1.5h6l2 2h9A1.5 1.5 0 0 1 22 8v11a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 19Z" fill="#f6c945"/><circle cx="16" cy="15" r="5.5" fill="#2e8540"/><path d="M16 12v3.2l2.1 1.3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  function decorateCP(winEl) {
    const body = winEl.querySelector(".st-cp-body"); if (!body) return;
    const DESC = "Save backup copies of your files with File History";
    const apply = () => {
      if (body.querySelector(".fh-cp")) return;
      const items = body.querySelector(".st-cp-items");
      const searchQ = ((winEl.querySelector(".st-search input") || {}).value || "").trim().toLowerCase();
      if (items) {
        const isSearch = !!body.querySelector(".st-cp-home h1") && /Search results/.test(body.querySelector(".st-cp-home h1").textContent);
        if (isSearch && !("file history backup versions restore previous".includes(searchQ) || /file|histor|backup|version|restore/.test(searchQ))) return;
        const small = items.classList.contains("small");
        const t = el(`<button class="st-cp-item ${small ? "small" : ""} fh-cp" title="${DESC}"><span>${CP_IC.replace(/SZ/g, small ? 20 : 32)}</span><span class="st-cp-itemname">File History</span></button>`);
        t.onclick = () => openApp();
        const empty = items.querySelector(".st-empty"); if (empty) empty.remove();
        const after = [...items.querySelectorAll(".st-cp-item .st-cp-itemname")].find((n) => n.textContent.localeCompare("File History") > 0);
        if (after) items.insertBefore(t, after.closest(".st-cp-item")); else items.appendChild(t);
        return;
      }
      const onSys = [...body.querySelectorAll(".st-cp-side .st-sidelink.on")].some((b) => /System and Security/.test(b.textContent));
      if (onSys) {
        const main = body.querySelector(".st-cp-main"); if (!main) return;
        const r = el(`<div class="st-cp-catrow fh-cp"><span>${CP_IC.replace(/SZ/g, 40)}</span><div><button class="st-cp-cattitle">File History</button><div class="st-dim">${DESC}</div><button class="st-cp-sublink">Restore your files with File History</button></div></div>`);
        r.querySelector(".st-cp-cattitle").onclick = () => openApp(); r.querySelector(".st-cp-sublink").onclick = () => openRestore();
        const rows = [...main.querySelectorAll(".st-cp-catrow")]; const bk = rows.find((x) => /Backup and Restore/.test(x.textContent));
        if (bk) bk.after(r); else main.appendChild(r);
        return;
      }
      const cat = [...body.querySelectorAll(".st-cp-cat")].find((c) => /System and Security/.test((c.querySelector(".st-cp-cattitle") || {}).textContent || ""));
      if (cat) { const b = el(`<button class="st-cp-sublink fh-cp">${DESC}</button>`); b.onclick = () => openApp(); const host = cat.querySelector(".st-cp-cattitle").parentElement; const links = host.querySelectorAll(".st-cp-sublink"); if (links[1]) host.insertBefore(b, links[1].nextSibling); else host.appendChild(b); }
    };
    const mo = new MutationObserver(() => { if (!winEl.isConnected) { mo.disconnect(); return; } apply(); });
    mo.observe(body, { childList: true, subtree: true });
    apply();
  }
  function decorateSettings(winEl) {
    const page = winEl.querySelector(".w12s-page"); if (!page) return;
    const apply = () => {
      if (page.querySelector(".fh-scard,.fh-sline")) return;
      const h1 = page.querySelector(".w12s-title"); if (!h1) return;
      const t = h1.textContent || "";
      const list = page.querySelector(".w12s-list"); if (!list) return;
      if (/Windows Backup$/.test(t)) list.insertBefore(settingsCard(false), list.firstChild);
      else if (/Storage$/.test(t) && /System/.test(t)) {
        const c = el(`<div class="w12s-card fh-root fh-sline"><div class="w12s-row-t">Advanced storage settings</div><div class="w12s-row-s">Backup options — keep previous versions of your files with File History.</div><div class="fh-row"></div></div>`);
        c.querySelector(".fh-row").appendChild(btn(IC.history, "Backup options", () => openApp()));
        c.querySelector(".fh-row").appendChild(btn(IC.restore, "Restore files", () => openRestore()));
        list.appendChild(c);
      }
      else if (/^Accounts$/.test(t.trim())) {
        const row = [...list.querySelectorAll(".w12s-row")].find((r) => /Windows Backup/.test(r.textContent));
        if (row && !list.querySelector(".fh-srow")) {
          const r = row.cloneNode(true); r.classList.add("fh-srow"); r.querySelector(".w12s-row-t").textContent = "File History"; r.querySelector(".w12s-row-s").textContent = "Keep previous versions of your files and restore deleted ones";
          const ic = r.querySelector(".w12s-row-ic"); if (ic) ic.innerHTML = IC.app;
          r.onclick = () => openApp(); r.onkeydown = (e) => { if (e.key === "Enter") openApp(); };
          row.after(r);
        }
      }
    };
    const mo = new MutationObserver(() => { if (!winEl.isConnected) { mo.disconnect(); return; } apply(); });
    mo.observe(page, { childList: true, subtree: false });
    apply();
  }

  // ---------------------------------------------------------------- boot
  function boot() {
    wrapApps();
    if (window.State && State.onSave) State.onSave(onSave);
    ready.then(() => { if (window.State && S().setupCompleted !== undefined && settings().on) runDiff(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.addEventListener("load", wrapApps);

  window.FileHistory = {
    get ready() { return ready; },
    settings, setOn, isIncluded: included,
    versions, restore, restoreCopy, deleteVersion, openVersion, readData, versionText,
    backupNow: () => backupNow(true), cleanup, enforce, wipe, usage,
    points, listAt, filesUnder, restoreItems,
    hint(app) { hintApp = app; },
    openApp, openRestore, openVersions, propertiesPanel, settingsCard, previewDialog,
    // test / diagnostics
    async _flush() { flushDiff(); let c; do { c = chain; await c; await new Promise((r) => setTimeout(r, 0)); } while (c !== chain); },
    _stats: () => ({ lastScanMs, scans, tracked: base ? base.size : 0, records: idx.size, db: DB_NAME }),
    _rescan() { base = null; runDiff(); },
    _rec: (p) => { const r = idx.get(keyOf(p)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  };
})();
