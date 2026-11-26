/* File Explorer — Windows 11/12 style, on the app's real virtual file system (State.appData.files).
   Tabs (own history each, drag to reorder, restored on reopen), back/forward/up, editable address bar,
   search, command bar, Preview / Details pane, Gallery, real ZIP compress / extract / browse
   (js/zipkit.js, loaded on demand), right-click menus with New ▸ / Open with ▸ / Send to ▸,
   Properties dialogs (files, folders, drives), Recycle Bin for files, read-only / hidden attributes,
   inline rename, undo, drag & drop (mouse, touch long-press-and-drag, and files from the device).
   Previous Versions / Version history come from File History (js/filehistory.js, loaded from here if
   index.html doesn't list it).
   Styles: css/style.css (.fx12-*) + css/files12x.css (.fx-*), the latter injected on first open. */
(function () {
  "use strict";
  const SCRIPT_V = (() => { try { const s = document.currentScript && document.currentScript.src; const m = s && s.match(/[?&]v=([^&#]+)/); return m ? m[1] : ""; } catch (e) { return ""; } })();
  const VQ = SCRIPT_V ? "?v=" + SCRIPT_V : "";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const AD = () => { const d = S(); if (!d.appData) d.appData = {}; return d.appData; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const FP = () => window.FilesParts || { FILE_SEED: () => ({}), WIN_FS: () => ({}), FOLDER_ICON: {}, FICONV: "1" };
  const QUICK = ["Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music"];
  const LABELS = [["red", "Red", "#e5362c"], ["blue", "Blue", "#3f7be0"], ["yellow", "Yellow", "#f5df1b"], ["green", "Green", "#2b8a2b"], ["orange", "Orange", "#f29a2e"], ["purple", "Purple", "#7a1f86"], ["pink", "Pink", "#f6c9d3"]];
  let clip = null;          // { op: "cut" | "copy", items: [{ path, name } | { zip: { path, inner }, name }] } — shared by every Explorer window
  const undoStack = [];     // [{ label, run }]
  const INST = new Set();   // open Explorer windows

  // ---------- on-demand assets ----------
  function ensureCSS() {
    if (document.getElementById("fx-css") || document.querySelector('link[href*="files12x.css"]')) return;
    const l = document.createElement("link"); l.id = "fx-css"; l.rel = "stylesheet"; l.href = "css/files12x.css" + VQ; document.head.appendChild(l);
  }
  let zkP = null;
  function loadZipKit() {
    if (window.ZipKit) return Promise.resolve(window.ZipKit);
    if (zkP) return zkP;
    zkP = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "js/zipkit.js" + VQ;
      s.onload = () => (window.ZipKit ? res(window.ZipKit) : rej(new Error("ZIP support didn't load.")));
      s.onerror = () => { zkP = null; rej(new Error("ZIP support couldn't be loaded. Check your connection and try again.")); };
      document.head.appendChild(s);
    });
    return zkP;
  }

  // ---------- the folder tree ----------
  function root() {
    if (S().appData.files == null) S().appData.files = { root: FP().FILE_SEED() };
    const r = S().appData.files.root; let ch = false;
    if (!r["Local Disk (C:)"]) { Object.assign(r, FP().WIN_FS()); ch = true; }
    ["Videos", "OneDrive"].forEach((k) => { if (!r[k]) { r[k] = { type: "folder", children: {} }; ch = true; } });
    const wants3D = (S().installedApps || []).some((id) => id === "blender" || id === "blockbench") || (S().appData && S().appData.creativity);
    if (wants3D && !r["3D Models"]) { r["3D Models"] = { type: "folder", children: {} }; ch = true; }
    if (S().appData && S().appData.schoolFolders) ["Education", "Math"].forEach((k) => { if (!r[k]) { r[k] = { type: "folder", children: {} }; ch = true; } });
    if (S().appData && (S().appData.usage === "school" || S().appData.schoolFolders) && !r["Homework"]) { r["Homework"] = { type: "folder", children: {} }; ch = true; }
    if (ch) State.save();
    return r;
  }
  function nodeAt(p) { let n = { type: "folder", children: root() }; for (const seg of p) { n = n && n.children && n.children[seg]; if (!n) return null; } return n; }
  function kidsAt(p) { const n = nodeAt(p); return n && n.type === "folder" ? (n.children || (n.children = {})) : null; }
  function ensureFolder(p) {
    let kids = root();
    for (const seg of p) { if (!kids[seg] || kids[seg].type !== "folder") kids[seg] = { type: "folder", children: {}, created: Date.now() }; kids = kids[seg].children || (kids[seg].children = {}); }
    return kids;
  }
  function uniqueName(children, name) {
    if (!children[name]) return name;
    const m = name.match(/^(.*?)(\.[^.]+)?$/); const base = m[1], ext = m[2] || ""; let i = 2;
    while (children[base + " (" + i + ")" + ext]) i++;
    return base + " (" + i + ")" + ext;
  }
  function copyName(children, name) {  // "name - Copy.ext", "name - Copy (2).ext" — like Windows
    const m = name.match(/^(.*?)(\.[^.]+)?$/); const base = m[1] + " - Copy", ext = m[2] || "";
    if (!children[base + ext]) return base + ext;
    let i = 2; while (children[base + " (" + i + ")" + ext]) i++;
    return base + " (" + i + ")" + ext;
  }
  function walk(cb, p, kids) {   // every node, depth-first (doesn't descend into the C: system drive)
    kids = kids || root(); p = p || [];
    Object.keys(kids).forEach((name) => { const n = kids[name]; if (!n) return; cb(n, name, p); if (n.type === "folder" && n.children && name !== "Local Disk (C:)") walk(cb, p.concat(name), n.children); });
  }
  function findPathOf(node) {
    let found = null;
    (function rec(kids, p) { for (const k of Object.keys(kids)) { if (found) return; const n = kids[k]; if (n === node) { found = p.concat(k); return; } if (n && n.type === "folder" && n.children) rec(n.children, p.concat(k)); } })(root(), []);
    return found;
  }
  function recentFiles(limit) {
    const out = []; walk((n, name, p) => { if (n.type === "file" && n.ts && !n.hidden && n.kind !== "shortcut") out.push({ name, node: n, path: p }); });
    return out.sort((a, b) => b.node.ts - a.node.ts).slice(0, limit || 8);
  }
  function ago(ts) {
    const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
    if (m < 60) return m + " minute" + (m === 1 ? "" : "s") + " ago";
    const h = Math.round(m / 60); if (h < 24) return h + " hour" + (h === 1 ? "" : "s") + " ago";
    const d = Math.round(h / 24); return d + " day" + (d === 1 ? "" : "s") + " ago";
  }
  function changed() { try { State.save(); } catch (e) {} try { window.dispatchEvent(new Event("vfs-change")); } catch (e) {} }
  const deepClone = (n) => JSON.parse(JSON.stringify(n));
  function isRO(path) { let n = { children: root() }; for (const seg of path) { n = n && n.children && n.children[seg]; if (!n) return false; if (n.readOnly) return true; } return false; }

  // ---------- types & sizes ----------
  const extOf = (name) => (String(name).match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
  const IMG = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "avif", "ico", "tif", "tiff"];
  const AUD = ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus", "weba"];
  const VID = ["mp4", "webm", "mov", "m4v", "ogv", "mkv", "avi", "wmv"];
  const CODE = ["js", "mjs", "cjs", "ts", "tsx", "jsx", "css", "scss", "html", "htm", "json", "py", "java", "c", "h", "cpp", "hpp", "cs", "go", "rb", "php", "rs", "swift", "kt", "sh", "bat", "ps1", "xml", "yml", "yaml", "md", "sql", "lua", "ini", "cfg", "toml", "vue", "svelte"];
  const TEXT = ["txt", "log", "csv", "tsv", "nfo", "srt", "vtt"];
  const ARCH = ["rar", "7z", "tar", "gz", "bz2", "xz", "cab"];
  const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif", heic: "image/heic", tif: "image/tiff", tiff: "image/tiff",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", opus: "audio/ogg", weba: "audio/webm",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/mp4", ogv: "video/ogg", mkv: "video/x-matroska",
    pdf: "application/pdf", zip: "application/zip", json: "application/json", html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", txt: "text/plain", csv: "text/csv", md: "text/markdown", xml: "application/xml" };
  function info(name, n) {
    const ext = extOf(name); n = n || {};
    const folder = n.type === "folder";
    const mime = n.mime || "";
    const img = !folder && (n.kind === "image" || /^image\//.test(mime) || IMG.includes(ext));
    const media = folder ? null : (n.kind === "audio" || /^audio\//.test(mime) || AUD.includes(ext)) ? "audio" : (n.kind === "video" || /^video\//.test(mime) || VID.includes(ext)) ? "video" : null;
    const text = !folder && !img && !media && (n.kind === "text" || TEXT.includes(ext) || CODE.includes(ext) || /^text\//.test(mime));
    return { ext, folder, img, media, text, code: CODE.includes(ext), zip: !folder && ext === "zip", pdf: !folder && (ext === "pdf" || n.kind === "pdf" || mime === "application/pdf"), shortcut: n.kind === "shortcut", kind: n.kind };
  }
  const mimeOf = (name, n) => (n && n.mime) || MIME[extOf(name)] || (n && n.kind === "text" ? "text/plain" : "application/octet-stream");
  function utf8Len(s) { if (s.length > 300000) return s.length; try { return new TextEncoder().encode(s).length; } catch (e) { return s.length; } }
  function byteLen(n) {
    if (!n || n.type === "folder") return 0;
    if (n.blob && typeof n.size === "number") return n.size;
    if (typeof n.content === "string" && n.content.length) return utf8Len(n.content);
    if (n.src && /^data:/.test(n.src)) { if (typeof n.size === "number" && n.size) return n.size; const i = n.src.indexOf(","); return Math.round((n.src.length - i - 1) * 0.75); }
    return typeof n.size === "number" ? n.size : 0;
  }
  const num = (b) => Math.round(b).toLocaleString("en-US");
  function listSize(b) { return b >= 1073741824 ? (b / 1073741824).toFixed(1) + " GB" : b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : num(Math.ceil(b / 1024)) + " KB"; }
  function human(b) {
    if (b < 1024) return num(b) + " bytes";
    const u = ["KB", "MB", "GB", "TB"]; let v = b / 1024, i = 0; while (v >= 1024 && i < 3) { v /= 1024; i++; }
    const s = v >= 100 ? String(Math.floor(v)) : v >= 10 ? (Math.floor(v * 10) / 10).toFixed(1) : (Math.floor(v * 100) / 100).toFixed(2);
    return s + " " + u[i];
  }
  const exact = (b) => human(b) + " (" + num(b) + " bytes)";
  const onDisk = (b) => (b ? Math.ceil(b / 4096) * 4096 : 0);
  function stats(node) {
    let files = 0, folders = 0, bytes = 0, disk = 0;
    (function rec(x) { Object.keys(x.children || {}).forEach((k) => { const c = x.children[k]; if (!c) return; if (c.type === "folder") { folders++; rec(c); } else { files++; const b = byteLen(c); bytes += b; disk += onDisk(b); } }); })(node);
    return { files, folders, bytes, disk };
  }
  function typeOf(name, n) {
    if (n.type === "folder") return n._zdir ? "File folder (compressed)" : "File folder";
    const ext = extOf(name);
    if (n.kind === "shortcut") return "Shortcut";
    if (ext === "zip") return "Compressed (zipped) Folder";
    const k = ({ word: "Microsoft Word Document", pptx: "Microsoft PowerPoint Presentation", xlsx: "Microsoft Excel Worksheet", system: "System file", pdf: "PDF Document" })[n.kind];
    if (k) return k;
    const byExt = { txt: "Text Document", pdf: "PDF Document", bmp: "Bitmap image", jpg: "JPG File", jpeg: "JPEG File", png: "PNG File", gif: "GIF File", svg: "SVG Document", mp3: "MP3 File", mp4: "MP4 File", wav: "WAV File", html: "HTML Document", htm: "HTML Document", js: "JavaScript File", css: "CSS Document", json: "JSON File", md: "Markdown File", csv: "CSV File", py: "Python File", docx: "Microsoft Word Document", xlsx: "Microsoft Excel Worksheet", pptx: "Microsoft PowerPoint Presentation" };
    if (byExt[ext]) return byExt[ext];
    if (n.kind === "text") return "Text Document";
    if (n.kind === "image") return "Picture";
    return ext ? ext.toUpperCase() + " File" : "File";
  }
  const fmtDate = (ts) => (ts ? new Date(ts).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "");
  const longDate = (ts) => (ts ? new Date(ts).toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—");
  function fmtDur(s) { if (!isFinite(s) || s < 0) return ""; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return [h, m, x].map((v) => String(v).padStart(2, "0")).join(":"); }

  // ---------- Windows-style paths ----------
  function userName() { const p = S().profile || {}; return String(p.username || p.name || "User").replace(/[\\/:*?"<>|]/g, "").trim() || "User"; }
  function winPath(path) {
    if (!path || !path.length) return "This PC";
    const m = /^Local Disk \(([A-Z]):\)$/.exec(path[0]);
    if (m) return m[1] + ":\\" + path.slice(1).join("\\");
    return "C:\\Users\\" + userName() + "\\" + path.join("\\");
  }
  function parseWinPath(str) {
    let s = String(str || "").trim().replace(/^"+|"+$/g, "").replace(/\//g, "\\").replace(/\\+$/, "");
    if (!s) return null;
    if (/^(this pc|computer|thispc)$/i.test(s)) return [];
    s = s.replace(/^%userprofile%/i, "C:\\Users\\" + userName()).replace(/^~(?=\\|$)/, "C:\\Users\\" + userName());
    let segs;
    const dm = /^([a-z]):(\\(.*))?$/i.exec(s);
    if (dm) {
      const L = dm[1].toUpperCase(), rest = (dm[3] || "").split("\\").filter(Boolean);
      if (L === "C" && rest[0] && rest[0].toLowerCase() === "users" && rest.length >= 2) segs = rest.slice(2);
      else segs = ["Local Disk (" + L + ":)"].concat(rest);
    } else { segs = s.split("\\").filter(Boolean); if (segs[0] && /^this pc$/i.test(segs[0])) segs.shift(); }
    const out = []; let kids = root();
    for (const seg of segs) {
      if (!kids) return null;
      const k = kids[seg] !== undefined ? seg : Object.keys(kids).find((x) => x.toLowerCase() === seg.toLowerCase());
      if (k == null) return null;
      out.push(k); const n = kids[k]; kids = n.type === "folder" ? n.children || {} : null;
    }
    return out;
  }

  // ---------- prefs ----------
  function prefs() {
    const a = AD(); let v = a.filesView; if (!v || typeof v !== "object") v = a.filesView = {};
    if (!["grid", "large", "list"].includes(v.layout)) v.layout = "grid";
    if (!["name", "date", "type", "size"].includes(v.sort)) v.sort = "name";
    if (!["none", "preview", "details"].includes(v.pane)) v.pane = "none";
    if (typeof v.showExt !== "boolean") v.showExt = true;
    if (typeof v.checks !== "boolean") { let coarse = false; try { coarse = matchMedia("(pointer: coarse)").matches; } catch (e) {} v.checks = coarse; }
    v.showHidden = !!v.showHidden; v.desc = !!v.desc;
    if (!(v.paneW >= 220 && v.paneW <= 560)) v.paneW = 300;
    if (!(v.galleryZoom >= 90 && v.galleryZoom <= 300)) v.galleryZoom = 150;
    if (!v.gallerySrc) v.gallerySrc = "all";
    return v;
  }
  const pins = () => { const a = AD(); if (!Array.isArray(a.filesPinned)) a.filesPinned = []; return a.filesPinned; };
  const isPinned = (p) => pins().some((x) => x.join("/") === p.join("/"));
  const assoc = () => { const a = AD(); if (!a.fileAssoc || typeof a.fileAssoc !== "object") a.fileAssoc = {}; return a.fileAssoc; };
  const binList = () => { const a = AD(); if (!Array.isArray(a.fileBin)) a.fileBin = []; return a.fileBin; };

  // Path rewrite after a rename / move: pins and every Explorer window's tabs follow the folder.
  function rewritePaths(oldP, newP) {
    const o = oldP.join("/");
    const fix = (p) => { if (!Array.isArray(p)) return p; const j = p.join("/"); if (j === o) return newP.slice(); if (j.startsWith(o + "/")) return newP.concat(p.slice(oldP.length)); return p; };
    const ps = pins(); for (let i = 0; i < ps.length; i++) ps[i] = fix(ps[i]);
    INST.forEach((x) => x.rewrite(fix));
  }

  // ---------- Recycle Bin (files) ----------
  function recycle(list) {
    const ids = [];
    list.forEach((e) => {
      const p = kidsAt(e.path); if (!p || !p[e.name]) return;
      const id = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      binList().push({ id, name: e.name, node: p[e.name], from: e.path.slice(), ts: Date.now() });
      delete p[e.name]; ids.push(id);
    });
    if (ids.length) changed();
    return ids;
  }
  function restoreFromBin(ids) {
    const bin = binList(); let n = 0;
    ids.forEach((id) => {
      const i = bin.findIndex((b) => b.id === id); if (i < 0) return;
      const b = bin[i]; const kids = ensureFolder(b.from || []);
      kids[uniqueName(kids, b.name)] = b.node; bin.splice(i, 1); n++;
    });
    if (n) changed();
    return n;
  }
  function purgeFromBin(ids) { const a = AD(); a.fileBin = binList().filter((b) => !ids.includes(b.id)); changed(); }

  // ---------- bytes ----------
  function dataU8(u) {
    const i = u.indexOf(","); const meta = u.slice(5, i), d = u.slice(i + 1);
    if (/;base64/i.test(meta)) { const bin = atob(d); const a = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k); return a; }
    return new TextEncoder().encode(decodeURIComponent(d));
  }
  async function nodeU8(n) {
    if (!n) return new Uint8Array(0);
    if (n._ze) return n._ze.read();
    if (n.blob && window.VFS && VFS.getBlob) { try { const b = await VFS.getBlob(n.blob); if (b) return new Uint8Array(await b.arrayBuffer()); } catch (e) {} }
    const s = n.src || (typeof n.content === "string" && /^data:[^,]*,/.test(n.content) ? n.content : null);
    if (s && /^data:/.test(s)) return dataU8(s);
    if (s && /^blob:/.test(s)) { const r = await fetch(s); return new Uint8Array(await r.arrayBuffer()); }
    if (typeof n.content === "string") return new TextEncoder().encode(n.content);
    return new Uint8Array(0);
  }
  async function nodeBlob(name, n) {
    if (n.blob && window.VFS && VFS.getBlob) { try { const b = await VFS.getBlob(n.blob); if (b) return b.type ? b : new Blob([b], { type: mimeOf(name, n) }); } catch (e) {} }
    return new Blob([await nodeU8(n)], { type: mimeOf(name, n) });
  }
  const urlCache = new Map();
  async function nodeURL(name, n) {
    if (!n) return null;
    if (n._ze) { const k = n._ze; if (urlCache.has(k)) return urlCache.get(k); const u = URL.createObjectURL(new Blob([await n._ze.read()], { type: mimeOf(name, n) })); urlCache.set(k, u); return u; }
    if (n.blob) {
      if (urlCache.has(n.blob)) return urlCache.get(n.blob);
      try { const b = await VFS.getBlob(n.blob); if (b) { const u = URL.createObjectURL(b.type ? b : new Blob([b], { type: mimeOf(name, n) })); urlCache.set(n.blob, u); return u; } } catch (e) {}
    }
    if (n.src) return n.src;
    if (n.url) return n.url;
    if (typeof n.content === "string") { if (/^data:/.test(n.content)) return n.content; return URL.createObjectURL(new Blob([n.content], { type: mimeOf(name, n) })); }
    return null;
  }
  async function nodeText(name, n, limit) {
    if (typeof n.content === "string" && !/^data:/.test(n.content)) return n.kind === "word" ? htmlToText(n.content) : n.content;
    if (n.blob && byteLen(n) > (limit || 4e6)) throw new Error("This file is too big to preview.");
    const u8 = await nodeU8(n); return new TextDecoder("utf-8").decode(u8);
  }
  function htmlToText(h) { const d = document.createElement("div"); d.innerHTML = String(h || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<\/(p|div|h\d|li|tr)>/gi, "$&\n").replace(/<br\s*\/?>/gi, "\n"); return (d.textContent || "").replace(/\n{3,}/g, "\n\n").trim(); }
  const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
  function imageThumb(blob) {
    return new Promise((res) => {
      let url; try { url = URL.createObjectURL(blob); } catch (e) { res(null); return; }
      const im = new Image(); const done = (v) => { try { URL.revokeObjectURL(url); } catch (e) {} res(v); };
      im.onload = () => { try { const w = im.naturalWidth || 1, h = im.naturalHeight || 1, k = Math.min(1, 240 / Math.max(w, h)); const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k)); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); done({ thumb: c.toDataURL("image/jpeg", 0.72), w, h }); } catch (e) { done(null); } };
      im.onerror = () => done(null); im.src = url; setTimeout(() => done(null), 8000);
    });
  }
  async function storeBlob(blob) { if (window.VFS && VFS.putBlob && window.indexedDB) { try { return await VFS.putBlob(blob); } catch (e) {} } return null; }
  const INLINE_CAP = 1.5 * 1024 * 1024;
  // A real file node from bytes (ZIP extraction): text stays inline, everything else goes to IndexedDB.
  async function nodeFromBytes(name, u8, date) {
    const ext = extOf(name), ts = date ? +date || Date.now() : Date.now();
    const base = { type: "file", ts, created: Date.now(), size: u8.length };
    const asText = () => { if (u8.length > 400000) return null; try { return new TextDecoder("utf-8", { fatal: true }).decode(u8); } catch (e) { return null; } };
    if (TEXT.includes(ext) || CODE.includes(ext) || (!ext && u8.length < 100000)) { const t = asText(); if (t != null) return Object.assign(base, { kind: "text", content: t }); }
    if (["docx", "xlsx", "pptx"].includes(ext) && !(u8[0] === 0x50 && u8[1] === 0x4b)) { const t = asText(); if (t != null) return Object.assign(base, { kind: ext === "docx" ? "word" : ext, content: t }); }
    const mime = MIME[ext] || "application/octet-stream";
    const blob = new Blob([u8], { type: mime });
    const id = await storeBlob(blob);
    const n = Object.assign(base, { kind: IMG.includes(ext) ? "image" : AUD.includes(ext) ? "audio" : VID.includes(ext) ? "video" : "other", mime });
    if (n.kind === "image") { const t = await imageThumb(blob); if (t) { n.w = t.w; n.h = t.h; if (id) n.src = t.thumb; } }
    if (id) n.blob = id;
    else if (u8.length <= INLINE_CAP) n.src = await blobToDataURL(blob);
    else throw new Error("“" + name + "” is too big to store on this device.");
    return n;
  }
  async function blobNode(blob, extra) {
    const id = await storeBlob(blob);
    const n = Object.assign({ type: "file", kind: "other", size: blob.size, mime: blob.type || "application/octet-stream", ts: Date.now(), created: Date.now() }, extra || {});
    if (id) n.blob = id; else if (blob.size <= INLINE_CAP) n.src = await blobToDataURL(blob); else throw new Error("This file is too big to store on this device.");
    return n;
  }
  function download(blob, name) {
    const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  }

  // ---------- ZIP ----------
  const zipCache = new WeakMap();   // node -> { ts, p: Promise<{ entries, tree }> }
  function buildZipTree(entries) {
    const top = { dirs: {}, files: {}, entry: null };
    entries.forEach((en) => {
      const parts = en.name.split("/").filter((p) => p && p !== "." && p !== "..");
      if (!parts.length || parts[0] === "__MACOSX") return;
      const last = en.dir ? parts.length : parts.length - 1; let t = top;
      for (let i = 0; i < last; i++) { const p = parts[i]; t = t.dirs[p] || (t.dirs[p] = { dirs: {}, files: {}, entry: null }); if (en.dir && i === last - 1) t.entry = en; }
      if (!en.dir) t.files[parts[parts.length - 1]] = en;
    });
    return top;
  }
  function zipOpen(node) {
    const c = zipCache.get(node);
    if (c && c.ts === (node.ts || 0) && c.blob === node.blob) return c.p;
    const p = loadZipKit().then((ZK) => nodeU8(node).then((u8) => ZK.unzip(u8))).then((r) => ({ entries: r.entries, tree: buildZipTree(r.entries) }));
    zipCache.set(node, { ts: node.ts || 0, blob: node.blob, p });
    p.catch(() => zipCache.delete(node));
    return p;
  }
  function zipSub(tree, inner) { let t = tree; for (const s of inner) { t = t && t.dirs[s]; if (!t) return null; } return t; }
  function zipCount(t) { let files = 0, folders = 0, bytes = 0; (function rec(x) { Object.keys(x.dirs).forEach((k) => { folders++; rec(x.dirs[k]); }); Object.keys(x.files).forEach((k) => { files++; bytes += x.files[k].size || 0; }); })(t); return { files, folders, bytes }; }
  function zipVirtual(t, inner, zipPath) {
    const out = [];
    Object.keys(t.dirs).forEach((name) => { const d = t.dirs[name]; out.push({ name, node: { type: "folder", children: {}, ts: d.entry ? +d.entry.date : 0, _zdir: d }, zipPath, inner: inner.concat(name) }); });
    Object.keys(t.files).forEach((name) => { const en = t.files[name]; const ext = extOf(name); out.push({ name, node: { type: "file", size: en.size, csize: en.csize, ts: +en.date, _ze: en, kind: IMG.includes(ext) ? "image" : AUD.includes(ext) ? "audio" : VID.includes(ext) ? "video" : (TEXT.includes(ext) || CODE.includes(ext)) ? "text" : ext === "docx" ? "word" : ["xlsx", "pptx"].includes(ext) ? ext : "other" }, zipPath, inner: inner.concat(name) }); });
    return out;
  }
  // Extract a ZIP subtree (or one entry) into a folder's children.
  async function extractInto(src, destKids, prog, errors) {
    if (src.entry !== undefined && src.dirs) {
      for (const name of Object.keys(src.dirs)) {
        let k = destKids[name]; if (!k || k.type !== "folder") { const nm = k ? uniqueName(destKids, name) : name; k = destKids[nm] = { type: "folder", children: {}, ts: src.dirs[name].entry ? +src.dirs[name].entry.date : Date.now(), created: Date.now() }; }
        await extractInto(src.dirs[name], k.children || (k.children = {}), prog, errors);
      }
      for (const name of Object.keys(src.files)) await extractFile(name, src.files[name], destKids, prog, errors);
    }
  }
  async function extractFile(name, en, destKids, prog, errors) {
    try { const u8 = await en.read(); const node = await nodeFromBytes(name, u8, en.date); destKids[uniqueName(destKids, name)] = node; }
    catch (e) { errors.push(e.message || String(e)); }
    if (prog) prog();
  }
  async function zipEntriesFor(list) {   // [{ name, node }] -> ZipKit entries (recursive)
    const out = [];
    async function add(prefix, name, n) {
      if (!n) return;
      if (n.type === "folder") { out.push({ name: prefix + name + "/", dir: true, date: n.ts || n.created || Date.now() }); for (const k of Object.keys(n.children || {})) await add(prefix + name + "/", k, n.children[k]); }
      else if (n.kind !== "shortcut") out.push({ name: prefix + name, data: await nodeU8(n), date: n.ts || Date.now() });
    }
    for (const e of list) await add("", e.name, e.node);
    return out;
  }

  // ---------- icons ----------
  const SHORTCUT_BADGE = `<svg class="fx-lnk" viewBox="0 0 12 12" width="12" height="12"><rect x=".5" y=".5" width="11" height="11" rx="2" fill="#fff" stroke="#8a94a6"/><path d="M3.5 8.5c0-3 2-4.5 5-4.5M6.5 2.5L8.5 4 6.5 5.5" fill="none" stroke="#1a73e8" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  function glyph(name, node, size) {
    const s = size || 34;
    if (node.kind === "shortcut") {
      const t = node.target && nodeAt(node.target);
      const inner = t ? glyph(node.target[node.target.length - 1], t, s) : glyph("x.txt", { type: "file" }, s);
      return `<span class="fx-lnkwrap" style="width:${s}px;height:${s}px">${inner}${SHORTCUT_BADGE}</span>`;
    }
    if (node.type === "folder") {
      const f = FP(); const src = (f.FOLDER_ICON[name] || "assets/folder.png") + "?v=" + f.FICONV;
      return `<img class="fx12-img" src="${src}" alt="" style="width:${s}px;height:${s}px">`;
    }
    const ext = extOf(name);
    const img = (src) => `<img class="fx12-img" src="${src}" alt="" style="width:${s}px;height:${s}px">`;
    if (node.kind === "image" || IMG.includes(ext)) return node.src ? `<img class="fx12-img fx12-thumb" src="${esc(node.src)}" alt="" style="width:${s}px;height:${s}px">` : img("assets/file_image.png?v=1");
    if (ext === "zip") return `<span class="fx-zipic" style="width:${s}px;height:${s}px">${img("assets/folder.png?v=" + FP().FICONV)}<i></i></span>`;
    if (ARCH.includes(ext)) return img("assets/file_rar.png?v=1");
    if (CODE.includes(ext)) return img("assets/file_code.png?v=1");
    if (VID.includes(ext) || node.kind === "video") return img("assets/file_video.png?v=1");
    if (node.kind === "word") return `<span class="fx12-appic" style="width:${s}px;height:${s}px">${Icon.mini("word", "Word")}</span>`;
    if (node.kind === "pptx") return `<span class="fx12-appic" style="width:${s}px;height:${s}px">${Icon.mini("powerpoint", "PowerPoint")}</span>`;
    if (node.kind === "xlsx") return `<span class="fx12-appic" style="width:${s}px;height:${s}px">${Icon.mini("excel", "Excel")}</span>`;
    if (node.kind === "pdf" || ext === "pdf") return img("assets/pdf.png?v=1");
    if (AUD.includes(ext) || node.kind === "audio") return `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" fill="#fff" stroke="#9aa3b2"/><path d="M14 3v4h4" fill="#e6e9ef" stroke="#9aa3b2"/><path d="M10.5 16.5V10l4-1v6" fill="none" stroke="#e2632a" stroke-width="1.3"/><circle cx="9.3" cy="16.6" r="1.4" fill="#e2632a"/><circle cx="13.3" cy="15.2" r="1.4" fill="#e2632a"/></svg>`;
    if (node.kind === "system") return `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><rect x="3" y="4" width="18" height="16" rx="2" fill="#c7cdd6"/><rect x="3" y="4" width="18" height="4.5" rx="2" fill="#8a94a6"/><circle cx="12" cy="14" r="3.4" fill="none" stroke="#5a6472" stroke-width="1.6"/></svg>`;
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" fill="#fff" stroke="#9aa3b2"/><path d="M14 3v4h4" fill="#e6e9ef" stroke="#9aa3b2"/><path d="M8 11h8M8 14h8M8 17h5" stroke="#9aa3b2"/></svg>`;
  }
  const SV = (d, w) => `<svg viewBox="0 0 24 24" width="${w || 18}" height="${w || 18}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    back: SV('<path d="M19 12H5M11 6l-6 6 6 6"/>'), fwd: SV('<path d="M5 12h14M13 6l6 6-6 6"/>'), up: SV('<path d="M12 19V5M6 11l6-6 6 6"/>'), refresh: SV('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
    search: SV('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', 16), plus: SV('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', 20),
    cut: SV('<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16L18 4M16 16L6 4"/>', 20), copy: SV('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2"/>', 20),
    paste: SV('<rect x="5" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h4v2M13 11h7v10h-7z"/>', 20), rename: SV('<rect x="3" y="7" width="14" height="10" rx="2"/><path d="M20 4v16M18 4h4M18 20h4M7 12h6"/>', 20),
    del: SV('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 20), sort: SV('<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>', 20),
    layout: SV('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>', 20),
    large: SV('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>', 20),
    list: SV('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', 20), upload: SV('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', 20),
    share: SV('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M7 8l5-5 5 5"/>', 20), info: SV('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', 20),
    more: SV('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>', 20), view: SV('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>', 20),
    zip: SV('<path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M10 3v2h2v2h-2v2h2v2h-2v2"/><rect x="9.5" y="14.5" width="3" height="3" rx=".6"/>', 20),
    extract: SV('<path d="M4 8h16v12H4zM4 8l2-4h12l2 4M12 11v6M9 14l3 3 3-3"/>', 20), pinO: SV('<path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>', 20),
    open: SV('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 20), tabnew: SV('<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h7V5M15 13h4M17 11v4"/>', 20),
    pv: SV('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>', 20), dp: SV('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16M16.5 8.5h2M16.5 11.5h2M16.5 14.5h2"/>', 20),
    restore: SV('<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/>', 20), history: SV('<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>', 20), gallery: SV('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>', 18),
    download: SV('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>', 20), mail: SV('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', 20),
    desktop: SV('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>', 20), path: SV('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2M11 13h6M11 16h4"/>', 20),
    undo: SV('<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>', 20), selall: SV('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l3 3 5-6"/>', 20),
    openwith: SV('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/>', 20),
    sendto: SV('<path d="M4 12l16-8-6 16-2-6z"/>', 20), newfolder: SV('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13h6"/>', 20),
    link: SV('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', 20),
    chev: SV('<path d="M9 6l6 6-6 6"/>', 14), home: SV('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>', 18),
    pc: `<img src="assets/thispc.png?v=7" alt="" style="width:18px;height:18px;object-fit:contain">`,
    star: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#f7c400"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 19a5 5 0 0 1-.6-10A6.5 6.5 0 0 1 19 9.5 4.8 4.8 0 0 1 18.5 19z" fill="#1a73e8"/></svg>`,
    bin: `<img src="assets/recyclebin.png?v=14" alt="" onerror="this.replaceWith(document.createTextNode('🗑'))" style="width:18px;height:18px;object-fit:contain">`,
    pin: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M14 3l7 7-3 1-4 4 1 5-2 1-4-5-5 5-1-1 5-5-5-4 1-2 5 1 4-4z" fill="#e5362c"/></svg>`,
    tag: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z" fill="#f6c27a"/><circle cx="8" cy="8" r="1.6" fill="#fff"/></svg>`,
    folder: `<img src="assets/folder.png?v=7" alt="" style="width:18px;height:18px;object-fit:contain">`,
    galleryC: `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="#4aa3ef"/><circle cx="8.5" cy="10" r="1.8" fill="#fff"/><path d="M3.5 17l5-5 4 4 3-3 5 5" fill="#2b7bd0"/></svg>`,
    drive: `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="13" width="18" height="6" rx="1.5" fill="#6b7280"/><path d="M5 13l2-6h10l2 6" fill="#9ca3af"/><circle cx="7" cy="16" r="1" fill="#4ade80"/></svg>`,
  };
  const DRIVE_SVG = (win) => `<svg viewBox="0 0 64 48" width="64" height="48">${win ? '<rect x="4" y="2" width="11" height="11" rx="1.5" fill="#8a63e8"/><rect x="17" y="2" width="11" height="11" rx="1.5" fill="#5a7bea"/><rect x="4" y="15" width="11" height="11" rx="1.5" fill="#5f8ff0"/><rect x="17" y="15" width="11" height="11" rx="1.5" fill="#4aa0f0"/>' : ""}<path d="M8 30l6-10h36l6 10" fill="#d4d7dd"/><rect x="6" y="30" width="52" height="14" rx="3" fill="#3f4450"/><circle cx="13" cy="37" r="2" fill="#4ade80"/></svg>`;

  // ---------- small in-app dialogs, toasts and menus ----------
  const screenEl = () => document.getElementById("screen") || document.body;
  function fxDialog(o) {
    ensureCSS();
    return new Promise((resolve) => {
      const m = el(`<div class="fx-dlg-mask"><div class="fx-dlg" role="dialog" aria-modal="true" style="${o.width ? "width:min(" + o.width + "px,calc(100vw - 32px))" : ""}"><div class="fx-dlg-h">${esc(o.title || "")}</div><div class="fx-dlg-b"></div><div class="fx-dlg-f"></div></div></div>`);
      const b = m.querySelector(".fx-dlg-b"), f = m.querySelector(".fx-dlg-f");
      if (typeof o.body === "string") b.innerHTML = o.body; else if (o.body) b.appendChild(o.body);
      let done = false;
      const close = (v) => { if (done) return; done = true; m.remove(); document.removeEventListener("keydown", onKey, true); resolve(v); };
      (o.buttons || [{ t: "OK", v: true, primary: true }]).forEach((bt) => {
        const x = el(`<button class="fx-btn ${bt.primary ? "fx-primary" : ""} ${bt.danger ? "fx-danger" : ""}">${esc(bt.t)}</button>`);
        x.onclick = () => { if (bt.check && bt.check(b) === false) return; close(typeof bt.v === "function" ? bt.v(b) : bt.v); };
        f.appendChild(x);
      });
      const onKey = (e) => {
        if (!m.isConnected) return;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(o.cancelValue == null ? null : o.cancelValue); }
        else if (e.key === "Enter" && !(e.target && e.target.tagName === "TEXTAREA")) { const p = f.querySelector(".fx-primary"); if (p) { e.preventDefault(); e.stopPropagation(); p.click(); } }
      };
      document.addEventListener("keydown", onKey, true);
      m.addEventListener("pointerdown", (e) => { if (e.target === m) { const d = m.querySelector(".fx-dlg"); d.classList.remove("fx-shake"); void d.offsetWidth; d.classList.add("fx-shake"); } });
      screenEl().appendChild(m);
      if (o.onMount) o.onMount(b, close);
      const inp = b.querySelector("input[type=text],input:not([type]),textarea"); if (inp) { inp.focus(); if (o.selectBase && inp.value) { const dot = inp.value.lastIndexOf("."); inp.setSelectionRange(0, dot > 0 ? dot : inp.value.length); } else inp.select && inp.select(); }
      else { const p = f.querySelector(".fx-primary"); if (p) p.focus(); }
    });
  }
  const fxAlert = (title, msg) => fxDialog({ title, body: `<p>${msg}</p>`, buttons: [{ t: "OK", v: true, primary: true }] });
  const fxConfirm = (title, msg, ok, danger) => fxDialog({ title, body: `<p>${msg}</p>`, buttons: [{ t: ok || "Yes", v: true, primary: true, danger }, { t: "No", v: false }], cancelValue: false });
  const fxPrompt = (title, label, value, selectBase) => fxDialog({ title, selectBase, body: `<label class="fx-field"><span>${esc(label)}</span><input type="text" value="${esc(value || "")}" spellcheck="false"></label>`, buttons: [{ t: "OK", primary: true, v: (b) => b.querySelector("input").value }, { t: "Cancel", v: null }] });

  function globalToast(msg) { try { if (window.Notify) Notify.show({ icon: Icon.mini("fileexplorer", "File Explorer"), title: "File Explorer", body: msg }); } catch (e) {} }

  let menuBorn = 0;
  function closeMenus() { document.querySelectorAll(".fx12-pop").forEach((m) => m.remove()); }
  document.addEventListener("pointerdown", (ev) => { if (!ev.target.closest || !ev.target.closest(".fx12-pop")) closeMenus(); }, true);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && document.querySelector(".fx12-pop")) { closeMenus(); ev.stopPropagation(); } }, true);
  // items: { t, ic, fn, disabled, check, kbd, sub: [...], danger } | "-" | { strip: [{ ic, t, fn, disabled }] }
  function popMenu(anchor, items, level, parentRow) {
    ensureCSS();
    if (!level) { closeMenus(); menuBorn = anchor && anchor.lp ? Date.now() : 0; }
    const m = el(`<div class="fx12-pop fx-pop" role="menu"></div>`); m.dataset.level = level || 0;
    items.filter(Boolean).forEach((it) => {
      if (it === "-") { if (m.lastElementChild && !m.lastElementChild.classList.contains("fx12-pop-sep")) m.appendChild(el(`<div class="fx12-pop-sep"></div>`)); return; }
      if (it.strip) {
        const row = el(`<div class="fx-pop-strip"></div>`);
        it.strip.forEach((s) => { const b = el(`<button title="${esc(s.t)}" aria-label="${esc(s.t)}" ${s.disabled ? "disabled" : ""}>${s.ic}</button>`); b.onclick = (ev) => { ev.stopPropagation(); if (Date.now() - menuBorn < 250) return; closeMenus(); s.fn(); }; row.appendChild(b); });
        m.appendChild(row); return;
      }
      const b = el(`<button role="menuitem" class="${it.sub ? "fx-has-sub" : ""} ${it.danger ? "fx-danger" : ""}" ${it.disabled ? "disabled" : ""}><span class="fx-pop-ic">${it.ic || ""}</span><span class="fx-pop-t">${it.b ? "<b>" + esc(it.t) + "</b>" : esc(it.t)}</span>${it.check ? '<b class="fx12-check">✓</b>' : ""}${it.kbd ? `<span class="fx-kbd">${esc(it.kbd)}</span>` : ""}${it.sub ? `<span class="fx-pop-chev">${I.chev}</span>` : ""}</button>`);
      if (it.sub) {
        const openSub = () => { if (b.disabled) return; m.querySelectorAll(".fx-has-sub.open").forEach((x) => x !== b && x.classList.remove("open")); document.querySelectorAll(".fx12-pop").forEach((x) => { if (+x.dataset.level > (level || 0)) x.remove(); }); b.classList.add("open"); popMenu(b, typeof it.sub === "function" ? it.sub() : it.sub, (level || 0) + 1, b); };
        b.addEventListener("pointerenter", (ev) => { if (ev.pointerType === "mouse") { clearTimeout(b._t); b._t = setTimeout(openSub, 140); } });
        b.addEventListener("pointerleave", () => clearTimeout(b._t));
        b.onclick = (ev) => { ev.stopPropagation(); openSub(); };
      } else {
        b.addEventListener("pointerenter", (ev) => { if (ev.pointerType !== "mouse") return; m.querySelectorAll(".fx-has-sub.open").forEach((x) => x.classList.remove("open")); document.querySelectorAll(".fx12-pop").forEach((x) => { if (+x.dataset.level > (level || 0)) x.remove(); }); });
        b.onclick = (ev) => { ev.stopPropagation(); if (Date.now() - menuBorn < 250) return; closeMenus(); try { it.fn(); } catch (e) { console.error(e); } };
      }
      m.appendChild(b);
    });
    if (m.lastElementChild && m.lastElementChild.classList.contains("fx12-pop-sep")) m.lastElementChild.remove();
    screenEl().appendChild(m);
    const W = window.innerWidth, H = window.innerHeight;
    let x, y;
    if (parentRow) { const r = parentRow.getBoundingClientRect(); x = r.right - 2; y = r.top - 5; if (x + m.offsetWidth > W - 6) x = Math.max(4, r.left - m.offsetWidth + 2); }
    else if (anchor && anchor.clientX != null) { x = anchor.clientX + 2; y = anchor.clientY + 2; }
    else { const r = anchor.getBoundingClientRect(); x = r.left; y = r.bottom + 4; }
    m.style.left = Math.max(4, Math.min(x, W - m.offsetWidth - 6)) + "px";
    m.style.top = Math.max(4, Math.min(y, H - m.offsetHeight - 6)) + "px";
    const first = m.querySelector("button:not(:disabled)"); if (first && !(anchor && anchor.clientX != null)) first.focus({ preventScroll: true });
    m.addEventListener("keydown", (ev) => {
      const bs = [...m.querySelectorAll(":scope > button:not(:disabled)")]; const i = bs.indexOf(document.activeElement);
      if (ev.key === "ArrowDown") { ev.preventDefault(); (bs[i + 1] || bs[0]).focus(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); (bs[i - 1] || bs[bs.length - 1]).focus(); }
      else if (ev.key === "ArrowRight" && document.activeElement.classList.contains("fx-has-sub")) { ev.preventDefault(); document.activeElement.click(); }
      else if (ev.key === "ArrowLeft" && level) { ev.preventDefault(); m.remove(); if (parentRow) parentRow.focus(); }
    });
    return m;
  }

  // ---------- apps that can open files ("Open with") ----------
  function winsOf(appId) { try { return WM.windows().filter((e) => e.appId === appId); } catch (e) { return []; } }
  function newWinOf(appId, before) { const w = winsOf(appId).filter((e) => !before.has(e.win)); return w.length ? w[w.length - 1].win : null; }
  function waitFor(fn, ms) { return new Promise((res, rej) => { const t0 = Date.now(); (function tick() { let v = null; try { v = fn(); } catch (e) {} if (v) return res(v); if (Date.now() - t0 > (ms || 6000)) return rej(new Error("timeout")); setTimeout(tick, 120); })(); }); }
  function openInNotepad(name, node) {
    const before = new Set(WM.windows().map((e) => e.win));
    WM.open("notepad");
    const win = newWinOf("notepad", before); const ta = win && win.querySelector("textarea");
    if (!ta) return;
    const t = win.querySelector(".t-text"); if (t) t.textContent = name + " - Notepad";
    ta.value = "Opening…"; ta.disabled = true;
    nodeText(name, node).then((txt) => { ta.value = txt; ta.disabled = false; ta.focus(); }).catch((e) => { ta.value = ""; ta.disabled = false; fxAlert("Notepad", esc(e.message)); });
    let tmr = 0;
    ta.addEventListener("input", () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => { if (node.readOnly || node.__fxClone) return; node.content = node.kind === "word" ? esc(ta.value).replace(/\n/g, "<br>") : ta.value; delete node.blob; node.size = utf8Len(ta.value); node.ts = Date.now(); if (!node.kind || node.kind === "other") node.kind = "text"; changed(); if (t) t.textContent = name + " - Notepad"; }, 500);
      if (t && !/^\*/.test(t.textContent)) t.textContent = "*" + t.textContent;
    });
  }
  function openInVSCode(name, node) {
    nodeText(name, node).then((txt) => {
      const a = AD(); if (!a.vscode || !a.vscode.tree) a.vscode = Object.assign(a.vscode || {}, { name: (a.vscode && a.vscode.name) || "workspace", tree: (a.vscode && a.vscode.tree) || {} });
      const tree = a.vscode.tree; const nm = tree[name] && tree[name].content !== txt && !tree[name].__fx ? uniqueName(tree, name) : name;
      tree[nm] = { type: "file", content: txt, __fx: true }; State.save();
      const before = new Set(WM.windows().map((e) => e.win));
      WM.open("vscode");
      const win = newWinOf("vscode", before);
      if (win) setTimeout(() => { const it = [...win.querySelectorAll(".uvt-file-item, [data-file], .vs-file")].find((x) => (x.textContent || "").trim().endsWith(nm)); if (it) it.click(); }, 150);
      // Keep the File Explorer copy in sync with what's typed in VS Code.
      let last = txt;
      const iv = setInterval(() => {
        const cur = a.vscode && a.vscode.tree && a.vscode.tree[nm];
        if (cur && cur.content !== last && !node.readOnly && !node.__fxClone && !node._ze) { last = cur.content; node.content = last; delete node.blob; node.size = utf8Len(last); node.ts = Date.now(); if (!node.kind || node.kind === "other") node.kind = "text"; changed(); }
        if (!win || !win.isConnected) clearInterval(iv);
      }, 1500);
    }).catch((e) => fxAlert("Visual Studio Code", esc(e.message)));
  }
  function openViewer(name, node) {
    if (info(name, node).pdf && window.Browser && Browser.openFileNode) return void Browser.openFileNode(name, node);   // Edge is the PDF handler (js/browser.js)
    nodeURL(name, node).then((u) => {
      if (!u) { fxAlert(name, "This file's contents aren't on this device."); return; }
      const ref = WM.createWindow({ title: name + " - Microsoft Edge", icon: Icon.mini("edge", "Microsoft Edge"), width: Math.min(900, innerWidth - 30), height: Math.min(680, innerHeight - 100), appId: "edge" });
      ensureCSS();
      ref.body.innerHTML = `<div class="fx-viewer"><div class="fx-viewer-bar"><b>${esc(name)}</b><span class="fx-grow"></span><button class="fx-btn" data-a="tab">${I.open}<span>Open in new tab</span></button><button class="fx-btn" data-a="dl">${I.download}<span>Download</span></button></div><iframe class="fx-viewer-frame" title="${esc(name)}"></iframe></div>`;
      const fr = ref.body.querySelector("iframe");
      if (/\.(html?|svg)$/i.test(name)) fr.setAttribute("sandbox", "");
      fr.src = u;
      ref.body.querySelector('[data-a="tab"]').onclick = () => window.open(u, "_blank", "noopener");
      ref.body.querySelector('[data-a="dl"]').onclick = () => nodeBlob(name, node).then((b) => download(b, name));
    });
  }
  const has = (id) => !!(window.AppRegistry && AppRegistry[id]);
  const APPS = [
    { id: "notepad", name: "Notepad", ok: (x) => x.text || x.kind === "word" || x.ext === "" , open: openInNotepad, avail: () => has("notepad") },
    { id: "word", name: "Word", ok: (x) => x.kind === "word" || x.kind === "text" || ["txt", "md", "rtf", "docx", "doc"].includes(x.ext), open: (n, node) => Office.openWord({ name: n, node }), avail: () => !!(window.Office && Office.openWord) },
    { id: "excel", name: "Excel", ok: (x) => x.kind === "xlsx" || x.ext === "xlsx", open: (n, node) => Office.openExcel({ name: n, node }), avail: () => !!(window.Office && Office.openExcel) },
    { id: "powerpoint", name: "PowerPoint", ok: (x) => x.kind === "pptx" || x.ext === "pptx", open: (n, node) => Office.openPowerPoint({ name: n, node }), avail: () => !!(window.Office && Office.openPowerPoint) },
    { id: "drivevideo", name: "Video", ok: (x) => x.media === "video", open: (n, node) => { if (window.DriveVideo && DriveVideo.openNode) DriveVideo.openNode(n, node); else rawOpen(n, node); }, avail: () => has("drivevideo") },
    { id: "photos", name: "Photos", ok: (x) => x.img || x.media === "video", open: (n, node) => { if (window.CrPhotos && info(n, node).img) CrPhotos.openNode(n, node); else rawOpen(n, node); }, avail: () => !!window.CrPhotos },
    { id: "paint", name: "Paint", ok: (x) => x.img && x.ext !== "svg", open: (n, node, path) => nodeURL(n, node).then((u) => { if (u) AppRegistry.paint({ open: { url: u, name: n, path: node.readOnly || node.__fxClone ? null : path } }); }), avail: () => has("paint") },
    { id: "mediaplayer", name: "Media Player", ok: (x) => !!x.media, open: (n, node) => { if (window.CrMedia) CrMedia.openNode(n, node); else rawOpen(n, node); }, avail: () => !!window.CrMedia },
    { id: "vscode", name: "Visual Studio Code", ok: (x) => x.text || x.code, open: openInVSCode, avail: () => has("vscode") },
    { id: "edge", name: "Microsoft Edge", ok: (x) => x.pdf || x.img || ["html", "htm", "svg", "txt", "json", "xml"].includes(x.ext), open: openViewer, avail: () => true },
    { id: "fileexplorer", name: "File Explorer", ok: (x) => x.zip, open: (n, node, path) => { window.FilesStartPath = path; WM.open("fileexplorer"); }, avail: () => true },
  ];
  const appById = (id) => APPS.find((a) => a.id === id);
  function appsFor(name, node) { const x = info(name, node); return APPS.filter((a) => a.avail() && a.ok(x)); }
  function rawOpen(name, node) { if (window.VFS && VFS.openNode) VFS.openNode(name, node); }
  function guardRO(name, node) {
    if (!node.readOnly) return node;
    const c = deepClone(node); c.__fxClone = true; delete c.readOnly;
    globalToast("“" + name + "” is read-only. It opened as a copy — use Save As to keep your changes.");
    return c;
  }
  function launch(appId, name, node, path) {
    const a = appById(appId); if (!a) return;
    const n = node._ze ? node : guardRO(name, node);
    if (!node._ze && !node.__fxClone) node.atime = Date.now();
    try { a.open(name, n, path); } catch (e) { fxAlert(a.name, esc(e.message || String(e))); }
  }
  // Default "Open" for a real file (double-click / Enter).
  function openFile(name, node, path) {
    const x = info(name, node);
    if (x.shortcut) return followShortcut(name, node);
    const pick = assoc()[x.ext || "(none)"];
    if (pick && appById(pick) && appById(pick).avail()) return launch(pick, name, node, path);
    if (x.zip && path) { window.FilesStartPath = path.slice(); WM.open("fileexplorer"); return; }
    if (x.pdf) return launch("edge", name, node, path);
    if (x.media === "video" && window.DriveVideo && DriveVideo.openNode) { node.atime = Date.now(); DriveVideo.openNode(name, node, path); return; }   // Video app is the player for all non-YouTube videos (js/drivevideo.js)
    node.atime = Date.now();
    rawOpen(name, guardRO(name, node));
  }
  function followShortcut(name, node) {
    const t = node.target && nodeAt(node.target);
    if (!t) { fxAlert("Problem with Shortcut", `The item “${esc(node.target ? winPath(node.target) : name)}” that this shortcut refers to has been changed or moved, so this shortcut will no longer work properly.`); return; }
    if (t.type === "folder") { window.FilesStartPath = node.target.slice(); WM.open("fileexplorer"); return; }
    openFile(node.target[node.target.length - 1], t, node.target);
  }
  function chooseApp(name, node, path) {
    const x = info(name, node); const sug = appsFor(name, node); const rest = APPS.filter((a) => a.avail() && !sug.includes(a));
    const row = (a, i, on) => `<label class="fx-app-row"><input type="radio" name="fxapp" value="${a.id}" ${on ? "checked" : ""}><span class="fx-app-ic">${Icon.mini(a.id, a.name)}</span><span>${esc(a.name)}</span></label>`;
    const cur = assoc()[x.ext || "(none)"];
    const body = el(`<div class="fx-choose"><p class="fx-sub">How do you want to open ${esc(x.ext ? "." + x.ext + " files" : "this file")}?</p>
      ${sug.length ? `<div class="fx-app-h">Suggested apps</div>${sug.map((a, i) => row(a, i, cur ? cur === a.id : i === 0)).join("")}` : ""}
      ${rest.length ? `<div class="fx-app-h">More options</div>${rest.map((a, i) => row(a, i, !sug.length && i === 0)).join("")}` : ""}
      <label class="fx-check"><input type="checkbox" class="fx-always" ${cur ? "checked" : ""}> Always use this app to open ${esc(x.ext ? "." + x.ext : "these")} files</label></div>`);
    return fxDialog({ title: "Choose an app to open “" + name + "”", body, width: 420, buttons: [{ t: "OK", primary: true, v: (b) => ({ id: (b.querySelector("input[name=fxapp]:checked") || {}).value, always: b.querySelector(".fx-always").checked }) }, { t: "Cancel", v: null }] }).then((r) => {
      if (!r || !r.id) return;
      if (r.always) { assoc()[x.ext || "(none)"] = r.id; State.save(); } else if (cur && cur === r.id) { /* unchanged */ }
      launch(r.id, name, node, path);
    });
  }

  // ---------- mail ----------
  function mailFiles(list) {
    const files = list.filter((e) => e.node.type === "file");
    if (!files.length) return;
    const names = files.map((e) => e.name).join(", ");
    if (has("outlook")) {
      WM.open("outlook");
      waitFor(() => { const b = [...document.querySelectorAll(".ol-compose")]; return b[b.length - 1]; }, 9000).then((btn) => {
        btn.click();
        return waitFor(() => { const o = [...document.querySelectorAll(".ol-compose-ov")]; return o[o.length - 1]; }, 3000);
      }).then(async (ov) => {
        const subj = ov.querySelector(".ol-subj"); if (subj) subj.value = "Emailing: " + names;
        const bodyEl = ov.querySelector(".ol-compose-body"); if (bodyEl) bodyEl.innerHTML = "Your message is ready to be sent with the following file attachments:<br>" + esc(names) + "<br><br>";
        const inp = document.getElementById("globalFileInput"); const attach = ov.querySelector(".ol-attach");
        if (inp && attach && typeof DataTransfer !== "undefined") {
          for (const e of files) {
            try {
              const blob = await nodeBlob(e.name, e.node);
              inp.click = () => {}; attach.click(); delete inp.click;
              const dt = new DataTransfer(); dt.items.add(new File([blob], e.name, { type: blob.type }));
              inp.files = dt.files; if (inp.onchange) inp.onchange();
            } catch (err) { delete inp.click; }
          }
        }
      }).catch(() => globalToast("Outlook is open — start a new message and attach " + names + "."));
    } else if (has("gmail")) { WM.open("gmail"); globalToast("Gmail is open — compose a message and attach " + names + "."); }
    else { location.href = "mailto:?subject=" + encodeURIComponent("Emailing: " + names); }
  }

  // ---------- Properties ----------
  const ATTR_NOTE = "Read-only files open as a copy and ask before they're deleted. Hidden items only show when View ▸ Show ▸ Hidden items is on.";
  function propsWindow(title, iconHtml, h) {
    ensureCSS();
    const ref = WM.createWindow({ title, icon: iconHtml || Icon.mini("fileexplorer", "Properties"), width: Math.min(420, innerWidth - 20), height: Math.min(h || 580, innerHeight - 70), appId: "fileexplorer", noMax: true });
    ref.win.classList.add("fx-props-win");
    return ref;
  }
  function tabsUI(host, tabs, start) {
    host.innerHTML = `<div class="fx-props"><div class="fx-ptabs" role="tablist">${tabs.map((t, i) => `<button role="tab" class="fx-ptab ${i ? "" : "on"}" data-i="${i}">${esc(t[0])}</button>`).join("")}</div><div class="fx-pbody"></div><div class="fx-pfoot"><button class="fx-btn fx-primary" data-a="ok">OK</button><button class="fx-btn" data-a="cancel">Cancel</button><button class="fx-btn" data-a="apply" disabled>Apply</button></div></div>`;
    const pb = host.querySelector(".fx-pbody");
    const show = (i) => { host.querySelectorAll(".fx-ptab").forEach((b) => b.classList.toggle("on", +b.dataset.i === i)); pb.innerHTML = ""; const c = tabs[i][1](); if (typeof c === "string") pb.innerHTML = c; else if (c) pb.appendChild(c); };
    host.querySelectorAll(".fx-ptab").forEach((b) => (b.onclick = () => show(+b.dataset.i)));
    const si = typeof start === "string" ? tabs.findIndex((t) => t[0] === start) : 0;
    show(si > 0 ? si : 0);
    return host.querySelector(".fx-props");
  }
  const kv = (k, v, cls, rawKey) => `<div class="fx-kv ${cls || ""}"><span>${rawKey ? k : esc(k)}</span><div>${v}</div></div>`;
  async function probe(e) {   // { w, h } for images, { dur } for media; cached on the node
    const n = e.node, x = info(e.name, n), out = {};
    if (x.img) {
      if (n.w && n.h) return { w: n.w, h: n.h };
      const u = await nodeURL(e.name, n); if (!u) return out;
      await new Promise((res) => { const im = new Image(); im.onload = () => { out.w = im.naturalWidth; out.h = im.naturalHeight; res(); }; im.onerror = res; im.src = u; setTimeout(res, 6000); });
      if (out.w && !n._ze) { n.w = out.w; n.h = out.h; try { State.save(); } catch (err) {} }
    } else if (x.media) {
      if (n.dur) return { dur: n.dur };
      const u = await nodeURL(e.name, n); if (!u) return out;
      await new Promise((res) => { const m = document.createElement(x.media === "video" ? "video" : "audio"); m.preload = "metadata"; m.muted = true; m.onloadedmetadata = () => { if (isFinite(m.duration)) out.dur = m.duration; if (m.videoWidth) { out.w = m.videoWidth; out.h = m.videoHeight; } res(); }; m.onerror = res; m.src = u; setTimeout(res, 6000); });
      if (out.dur && !n._ze) { n.dur = out.dur; try { State.save(); } catch (err) {} }
    }
    return out;
  }
  function textStats(t) { return { lines: t ? t.split(/\r\n|\r|\n/).length : 0, words: (t.match(/\S+/g) || []).length, chars: t.length }; }
  function permsHTML(objName, ro) {
    const who = [["SYSTEM", "SYSTEM"], ["Administrators", "Administrators (" + esc(userName()) + "-PC\\Administrators)"], [userName(), esc(userName()) + " (" + esc(userName()) + "-PC\\" + esc(userName()) + ")"], ["Users", "Users (" + esc(userName()) + "-PC\\Users)"]];
    const perm = (full) => ["Full control", "Modify", "Read & execute", "Read", "Write"].map((p, i) => `<div class="fx-perm"><span>${p}</span><span>${full || i === 2 || i === 3 ? "✓" : ""}</span><span></span></div>`).join("");
    const d = el(`<div><div class="fx-kv"><span>Object name:</span><div class="fx-sel-text">${esc(objName)}</div></div>
      <div class="fx-sub" style="margin:10px 0 4px">Group or user names:</div>
      <div class="fx-who">${who.map((w, i) => `<button class="fx-who-r ${i === 2 ? "on" : ""}" data-i="${i}">${w[1]}</button>`).join("")}</div>
      <p class="fx-sub">To change permissions, click Edit. <button class="fx-btn" disabled>Edit…</button></p>
      <div class="fx-perms"><div class="fx-perm fx-perm-h"><span class="fx-perm-who">Permissions for ${esc(userName())}</span><span>Allow</span><span>Deny</span></div><div class="fx-perm-rows">${perm(true)}</div></div>
      ${ro ? `<p class="fx-sub">The Read-only attribute is set, so apps get a copy instead of changing this item.</p>` : ""}</div>`);
    d.querySelectorAll(".fx-who-r").forEach((b) => (b.onclick = () => { d.querySelectorAll(".fx-who-r").forEach((x) => x.classList.toggle("on", x === b)); d.querySelector(".fx-perm-who").textContent = "Permissions for " + who[+b.dataset.i][0]; d.querySelector(".fx-perm-rows").innerHTML = perm(+b.dataset.i !== 3); }));
    return d;
  }
  // Previous Versions tab: real versions from File History (js/filehistory.js) when it's loaded.
  function versionsTab(e) {
    if (window.FileHistory && FileHistory.propertiesPanel && e && e.node && !e.node._ze) { try { return FileHistory.propertiesPanel(e); } catch (er) { console.error(er); } }
    return versionsHTML(e && e.node);
  }
  function versionsHTML(n) {
    const vs = Array.isArray(n && n.versions) ? n.versions : [];
    if (!vs.length) return `<p class="fx-sub">Previous versions come from File History or from restore points.</p><div class="fx-versions"><div class="fx-empty-box">There are no previous versions available.</div></div>`;
    return `<p class="fx-sub">Previous versions of this item:</p><div class="fx-versions">${vs.slice().reverse().map((v) => `<div class="fx-ver"><span>${esc(longDate(v.ts))}</span><span>${v.size ? human(v.size) : ""}</span></div>`).join("")}</div>`;
  }
  function showProperties(list, startTab) {
    list = (list || []).filter((e) => e && e.node && !e.binId && !e.zipPath);
    if (!list.length) return;
    if (list.length === 1 && !list[0].path.length && /^Local Disk \([A-Z]:\)$/.test(list[0].name)) return showDriveProperties(list[0].name);
    const single = list.length === 1 ? list[0] : null;
    const ref = propsWindow(single ? single.name + " Properties" : list.map((e) => e.name).slice(0, 2).join(", ") + (list.length > 2 ? ", …" : "") + " Properties", Icon.mini("fileexplorer", "Properties"));
    let pending = false;
    const markDirty = () => { pending = true; ref.body.querySelector('[data-a="apply"]').disabled = false; };
    const state = { name: single ? single.name : "", ro: list.every((e) => e.node.readOnly) ? true : list.some((e) => e.node.readOnly) ? null : false, hid: list.every((e) => e.node.hidden) ? true : list.some((e) => e.node.hidden) ? null : false };
    const general = () => {
      const n = single && single.node, x = single ? info(single.name, n) : null;
      let size = 0, disk = 0, files = 0, folders = 0;
      list.forEach((e) => { if (e.node.type === "folder") { folders++; const s = stats(e.node); size += s.bytes; disk += s.disk; files += s.files; folders += s.folders; } else { files++; const b = byteLen(e.node); size += b; disk += onDisk(b); } });
      const parent = single ? single.path : list[0].path;
      const sameParent = list.every((e) => e.path.join("/") === parent.join("/"));
      const opens = single && !x.folder ? (assoc()[x.ext || "(none)"] && appById(assoc()[x.ext || "(none)"])) || (x.zip ? appById("fileexplorer") : x.pdf ? appById("edge") : appsFor(single.name, n)[0]) : null;
      const d = el(`<div>
        <div class="fx-p-top"><span class="fx-p-ic">${single ? glyph(single.name, n, 36) : glyph("x", { type: "file" }, 36)}</span>${single ? `<input class="fx-p-name" value="${esc(state.name)}" spellcheck="false" aria-label="Name">` : `<b>${files} file${files === 1 ? "" : "s"}${folders ? ", " + folders + " folder" + (folders === 1 ? "" : "s") : ""}</b>`}</div>
        <hr>
        ${single ? kv(x.folder ? "Type:" : "Type of file:", esc(typeOf(single.name, n)) + (x.ext && !x.folder ? " (." + esc(x.ext) + ")" : "")) : kv("Type:", list.every((e) => typeOf(e.name, e.node) === typeOf(list[0].name, list[0].node)) ? "All of type " + esc(typeOf(list[0].name, list[0].node)) : "Multiple types")}
        ${opens ? kv("Opens with:", `<span class="fx-opens"><span class="fx-app-ic">${Icon.mini(opens.id, opens.name)}</span>${esc(opens.name)}</span><button class="fx-btn fx-change">Change…</button>`) : ""}
        ${single && x.shortcut ? kv("Target:", `<span class="fx-sel-text">${esc(n.target ? winPath(n.target) : "")}</span>`) : ""}
        <hr>
        ${kv("Location:", sameParent ? `<span class="fx-sel-text">${esc(winPath(parent))}</span>` : "Various folders")}
        ${kv("Size:", exact(size))}
        ${kv("Size on disk:", exact(disk))}
        ${folders || (single && x.folder) ? kv("Contains:", `${num(single && x.folder ? stats(n).files : files)} Files, ${num(single && x.folder ? stats(n).folders : folders)} Folders`) : ""}
        <hr>
        ${single ? kv("Created:", esc(longDate(n.created || n.ts))) + (x.folder ? "" : kv("Modified:", esc(longDate(n.ts || n.created))) + kv("Accessed:", esc(longDate(n.atime || n.ts || n.created)))) : ""}
        ${single ? "<hr>" : ""}
        <div class="fx-kv"><span>Attributes:</span><div class="fx-attrs"><label class="fx-check"><input type="checkbox" class="fx-ro"> Read-only${x && x.folder ? " (applies to the folder and its contents)" : ""}</label><label class="fx-check"><input type="checkbox" class="fx-hid"> Hidden</label></div></div>
        <p class="fx-note">${esc(ATTR_NOTE)}</p></div>`);
      const ro = d.querySelector(".fx-ro"), hid = d.querySelector(".fx-hid");
      ro.checked = state.ro === true; ro.indeterminate = state.ro == null; hid.checked = state.hid === true; hid.indeterminate = state.hid == null;
      ro.onchange = () => { state.ro = ro.checked; markDirty(); }; hid.onchange = () => { state.hid = hid.checked; markDirty(); };
      const nm = d.querySelector(".fx-p-name"); if (nm) nm.oninput = () => { state.name = nm.value; markDirty(); };
      const ch = d.querySelector(".fx-change"); if (ch) ch.onclick = () => chooseApp(single.name, single.node, single.path.concat(single.name)).then(() => { const pb = ref.body.querySelector(".fx-ptab.on"); if (pb) pb.click(); });
      return d;
    };
    const details = () => {
      const e = single; const n = e.node, x = info(e.name, n);
      const d = el(`<div><div class="fx-dt"><div class="fx-dt-h"><span>Property</span><span>Value</span></div><div class="fx-dt-rows"></div></div></div>`);
      const rows = d.querySelector(".fx-dt-rows");
      const add = (k, v, sec) => rows.insertAdjacentHTML("beforeend", sec ? `<div class="fx-dt-sec">${esc(sec)}</div>` : `<div class="fx-dt-r"><span>${esc(k)}</span><span>${esc(v == null ? "" : v)}</span></div>`);
      add(0, 0, "Description"); add("Title", e.name.replace(/\.[^.]+$/, "")); if (n.label) add("Tags", (LABELS.find((l) => l[0] === n.label) || [, n.label])[1]);
      add(0, 0, "File"); add("Name", e.name); add("Item type", typeOf(e.name, n)); add("Folder path", winPath(e.path));
      add("Date created", fmtDate(n.created || n.ts)); add("Date modified", fmtDate(n.ts || n.created)); add("Size", x.folder ? human(stats(n).bytes) : human(byteLen(n)));
      add("Attributes", (n.readOnly ? "R" : "") + (n.hidden ? "H" : "") + (x.folder ? "D" : "A"));
      if (x.folder) { const s = stats(n); add("Files", num(s.files)); add("Folders", num(s.folders)); }
      const extra = el(`<div class="fx-dt-async"></div>`); d.appendChild(extra);
      if (x.img || x.media) {
        add(0, 0, x.img ? "Image" : x.media === "video" ? "Video" : "Audio"); const wait = el(`<div class="fx-dt-r"><span>…</span><span>Reading</span></div>`); rows.appendChild(wait);
        probe(e).then((p) => { wait.remove(); if (p.w) { add("Dimensions", p.w + " x " + p.h); add("Width", p.w + " pixels"); add("Height", p.h + " pixels"); } if (p.dur) add("Length", fmtDur(p.dur)); if (!p.w && !p.dur) add("Dimensions", "Unavailable"); });
      }
      if (x.text || n.kind === "word") {
        add(0, 0, "Content"); nodeText(e.name, n).then((t) => { const s = textStats(t); add("Lines", num(s.lines)); add("Words", num(s.words)); add("Characters", num(s.chars)); }).catch(() => {});
      }
      if (n.kind === "pptx") { try { const j = JSON.parse(n.content || "{}"); add(0, 0, "Content"); add("Slides", (j.slides || []).length); } catch (er) {} }
      if (n.kind === "xlsx") { try { const j = JSON.parse(n.content || "{}"); add(0, 0, "Content"); add("Filled cells", Object.keys(j.cells || {}).length); } catch (er) {} }
      if (x.zip) { add(0, 0, "Archive"); zipOpen(n).then((z) => { const c = zipCount(z.tree); add("Files", num(c.files)); add("Folders", num(c.folders)); add("Uncompressed size", human(c.bytes)); add("Compression ratio", c.bytes ? Math.max(0, Math.round((1 - byteLen(n) / c.bytes) * 100)) + "%" : "0%"); }).catch((er) => add("Archive", er.message)); }
      return d;
    };
    const tabs = [["General", general]];
    if (single) tabs.push(["Details", details], ["Previous Versions", () => versionsTab(single)], ["Security", () => permsHTML(winPath(single.path.concat(single.name)), single.node.readOnly)]);
    tabsUI(ref.body, tabs, startTab);
    async function apply() {
      if (!pending) return true;
      if (single && state.name.trim() !== single.name) {
        const r = await tryRename(single.path, single.name, state.name.trim());
        if (r !== true) return false;
        single.name = state.name.trim();
        const t = ref.win.querySelector(".t-text"); if (t) t.textContent = single.name + " Properties";
      }
      list.forEach((e) => { const n = nodeAt(e.path.concat(e.name)) || e.node; if (state.ro != null) { if (state.ro) n.readOnly = true; else delete n.readOnly; } if (state.hid != null) { if (state.hid) n.hidden = true; else delete n.hidden; } });
      pending = false; ref.body.querySelector('[data-a="apply"]').disabled = true; changed();
      return true;
    }
    ref.body.querySelector('[data-a="apply"]').onclick = () => apply();
    ref.body.querySelector('[data-a="ok"]').onclick = () => apply().then((ok) => { if (ok) ref.close(); });
    ref.body.querySelector('[data-a="cancel"]').onclick = () => ref.close();
    return ref;
  }

  // Real storage numbers: everything in the VFS (localStorage + IndexedDB blobs) and the browser's quota.
  async function storageInfo() {
    const all = stats({ children: root() });
    const binBytes = binList().reduce((s, b) => s + (b.node.type === "folder" ? stats(b.node).bytes : byteLen(b.node)), 0);
    let ls = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls += (k.length + (localStorage.getItem(k) || "").length) * 2; } } catch (e) {}
    let est = null; try { if (navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate(); } catch (e) {}
    let used, cap, real = false;
    if (est && est.quota) { used = (est.usage || 0) + ls; cap = Math.max(est.quota, used); real = true; }
    else { used = ls; cap = 5 * 1024 * 1024; }
    const files = Math.min(used, all.bytes + binBytes);
    return { used, cap, free: Math.max(0, cap - used), files, other: Math.max(0, used - files), fileCount: all.files, folderCount: all.folders, real, bin: binBytes };
  }
  function pieSVG(parts, size) {
    const r = 15.915, total = parts.reduce((s, p) => s + p.v, 0) || 1; let off = 25;
    return `<svg viewBox="0 0 42 42" width="${size}" height="${size}" class="fx-pie" role="img" aria-label="Drive usage">${parts.map((p) => { const pct = (p.v / total) * 100; const s = `<circle cx="21" cy="21" r="${r}" fill="none" stroke="${p.c}" stroke-width="10" stroke-dasharray="${p.v ? Math.max(pct, 1.5) : 0} ${100 - (p.v ? Math.max(pct, 1.5) : 0)}" stroke-dashoffset="${off}"/>`; off -= pct; return s; }).join("")}</svg>`;
  }
  // Real disk usage for the C: drive — this origin's actual storage quota/usage from the browser.
  let _diskP = null;
  function realDisk() {
    if (_diskP) return _diskP;
    const GB = 1073741824;
    _diskP = ((navigator.storage && navigator.storage.estimate) ? navigator.storage.estimate() : Promise.resolve(null))
      .then((est) => {
        if (!est || !est.quota) return null;
        const totalGB = est.quota / GB, usedGB = (est.usage || 0) / GB;
        return { totalGB, usedGB, freeGB: Math.max(0, totalGB - usedGB), bytesTotal: est.quota, bytesUsed: est.usage || 0, pct: Math.min(100, Math.max(1, Math.round(usedGB / totalGB * 100))) };
      }).catch(() => null);
    return _diskP;
  }
  function showDriveProperties(driveName) {
    const L = (/\(([A-Z]):\)/.exec(driveName) || [, "C"])[1];
    const labels = AD().driveLabels || (AD().driveLabels = {});
    const ref = propsWindow((labels[L] || "Local Disk") + " (" + L + ":) Properties", I.drive, 600);
    let pending = false, label = labels[L] || "";
    const general = () => {
      const d = el(`<div><div class="fx-p-top"><span class="fx-p-ic">${DRIVE_SVG(L === "C")}</span><input class="fx-p-name" value="${esc(label)}" placeholder="Local Disk" aria-label="Drive label"></div><hr>
        ${kv("Type:", "Local Disk")}${kv("File system:", "NTFS")}<hr><div class="fx-drive-use">Measuring…</div></div>`);
      d.querySelector(".fx-p-name").oninput = (e) => { label = e.target.value; pending = true; ref.body.querySelector('[data-a="apply"]').disabled = false; };
      const use = d.querySelector(".fx-drive-use");
      if (L === "C") storageInfo().then((s) => {
        const C = ["#2f7ae5", "#9b6fd8", "#d9dce3"];
        use.innerHTML = `${kv('<i class="fx-sw" style="background:' + C[0] + '"></i>Your files:', exact(s.files), "", true)}${kv('<i class="fx-sw" style="background:' + C[1] + '"></i>Apps &amp; system data:', exact(s.other), "", true)}
          ${kv("Used space:", exact(s.used), "fx-kv-b")}${kv('<i class="fx-sw" style="background:' + C[2] + '"></i>Free space:', exact(s.free), "", true)}<hr>${kv("Capacity:", exact(s.cap), "fx-kv-b")}
          <div class="fx-pie-row">${pieSVG([{ v: s.files, c: C[0] }, { v: s.other, c: C[1] }, { v: s.free, c: C[2] }], 130)}<div><b>Drive C:</b><div class="fx-sub">${num(s.fileCount)} files in ${num(s.folderCount)} folders${s.bin ? " · " + human(s.bin) + " in the Recycle Bin" : ""}</div><div class="fx-sub">${s.real ? "Measured from this browser's real storage (navigator.storage.estimate)." : "Estimated from local storage (this browser doesn't report its quota)."}</div><button class="fx-btn fx-cleanup">Disk Cleanup</button></div></div>`;
        const cb = use.querySelector(".fx-cleanup"); cb.onclick = () => WM.open("cleanmgr");
      });
      else {
        const n = root()[driveName]; const s = n ? stats(n) : { bytes: 0, files: 0, folders: 0 }; const cap = 216 * 1073741824;
        use.innerHTML = `${kv("Used space:", exact(s.bytes))}${kv("Free space:", exact(cap - s.bytes))}<hr>${kv("Capacity:", exact(cap), "fx-kv-b")}<div class="fx-pie-row">${pieSVG([{ v: s.bytes, c: "#2f7ae5" }, { v: cap - s.bytes, c: "#d9dce3" }], 130)}<div><b>Drive ${L}:</b><div class="fx-sub">${num(s.files)} files in ${num(s.folders)} folders</div></div></div>`;
      }
      return d;
    };
    const tools = () => {
      const d = el(`<div><div class="fx-tool"><b>Error checking</b><p class="fx-sub">This option will check the drive for file system errors.</p><button class="fx-btn" data-t="check">Check</button><div class="fx-tool-out" data-o="check"></div></div>
        <div class="fx-tool"><b>Optimize and defragment drive</b><p class="fx-sub">Optimizing your computer's drives can help it run more efficiently.</p><button class="fx-btn" data-t="opt">Optimize</button><div class="fx-tool-out" data-o="opt"></div></div></div>`);
      d.querySelector('[data-t="check"]').onclick = async (ev) => {
        const out = d.querySelector('[data-o="check"]'); ev.target.disabled = true; out.textContent = "Scanning the drive…";
        let files = 0, folders = 0, missing = 0; const ids = [];
        (function rec(k) { Object.keys(k).forEach((nm) => { const n = k[nm]; if (!n) return; if (n.type === "folder") { folders++; rec(n.children || {}); } else { files++; if (n.blob) ids.push(n.blob); } }); })(L === "C" ? root() : ((root()[driveName] || {}).children || {}));
        for (const id of ids.slice(0, 400)) { try { if (!(await VFS.getBlob(id))) missing++; } catch (e) { missing++; } }
        out.innerHTML = missing ? `Windows scanned ${num(files)} files in ${num(folders)} folders. <b>${missing} file${missing === 1 ? "" : "s"}</b> point${missing === 1 ? "s" : ""} to contents that aren't on this device (they were stored on another device or the browser cleared them).` : `Windows successfully scanned ${num(files)} files in ${num(folders)} folders. No errors were found.`;
        ev.target.disabled = false;
      };
      d.querySelector('[data-t="opt"]').onclick = (ev) => { const out = d.querySelector('[data-o="opt"]'); out.textContent = "Optimizing…"; setTimeout(() => { out.textContent = "OK (0% fragmented) — " + new Date().toLocaleString(); }, 700); };
      return d;
    };
    tabsUI(ref.body, [["General", general], ["Tools", tools], ["Security", () => permsHTML(L + ":\\", false)], ["Previous Versions", () => versionsHTML(null)]]);
    const apply = () => { if (pending) { if (label.trim()) labels[L] = label.trim(); else delete labels[L]; State.save(); pending = false; ref.body.querySelector('[data-a="apply"]').disabled = true; changed(); } };
    ref.body.querySelector('[data-a="apply"]').onclick = apply;
    ref.body.querySelector('[data-a="ok"]').onclick = () => { apply(); ref.close(); };
    ref.body.querySelector('[data-a="cancel"]').onclick = () => ref.close();
  }

  // ---------- rename (shared by inline rename and Properties) ----------
  async function tryRename(path, oldName, newName) {
    if (newName === oldName) return true;
    if (!newName) { await fxAlert("Rename", "You must type a file name."); return "empty"; }
    if (/[\\/:*?"<>|]/.test(newName)) { await fxAlert("Rename", 'A file name can\'t contain any of the following characters:<br><b>\\ / : * ? " &lt; &gt; |</b>'); return "bad"; }
    if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(newName) || /^\.+$/.test(newName)) { await fxAlert("Rename", "The specified device name is invalid."); return "bad"; }
    const p = kidsAt(path); if (!p || !p[oldName]) return "gone";
    if (p[newName] && newName.toLowerCase() !== oldName.toLowerCase()) { await fxAlert("Rename", "There is already a file with the same name in this location."); return "exists"; }
    const node = p[oldName];
    if (node.type === "file" && node.kind !== "shortcut" && extOf(oldName) !== extOf(newName)) {
      if (!(await fxConfirm("Rename", "If you change a file name extension, the file might become unusable.<br><br>Are you sure you want to change it?", "Yes"))) return "cancel";
    }
    const order = Object.keys(p); const rebuilt = {}; order.forEach((k) => { if (k === oldName) rebuilt[newName] = node; else rebuilt[k] = p[k]; });
    Object.keys(p).forEach((k) => delete p[k]); Object.assign(p, rebuilt);
    if (node.type === "folder") rewritePaths(path.concat(oldName), path.concat(newName));
    undoStack.push({ label: "Rename", run: () => { const q = kidsAt(path); if (q && q[newName] && !q[oldName]) { q[oldName] = q[newName]; delete q[newName]; if (node.type === "folder") rewritePaths(path.concat(newName), path.concat(oldName)); changed(); } } });
    changed();
    return true;
  }

  // ---------- transfer (paste / drag & drop) ----------
  async function transfer(items, destPath, op) {
    const dest = kidsAt(destPath); if (!dest) return [];
    const done = []; const errors = [];
    const dp = destPath.join("/");
    for (const it of items) {
      if (it.zip) {   // copying out of a ZIP = extracting
        try {
          const zn = nodeAt(it.zip.path); if (!zn) continue; const z = await zipOpen(zn);
          const parentT = zipSub(z.tree, it.zip.inner.slice(0, -1)); if (!parentT) continue;
          const nm = it.zip.inner[it.zip.inner.length - 1];
          if (parentT.dirs[nm]) { const fn = uniqueName(dest, nm); dest[fn] = { type: "folder", children: {}, ts: Date.now(), created: Date.now() }; await extractInto(parentT.dirs[nm], dest[fn].children, null, errors); done.push({ name: fn }); }
          else if (parentT.files[nm]) { const before = new Set(Object.keys(dest)); await extractFile(nm, parentT.files[nm], dest, null, errors); const added = Object.keys(dest).find((k) => !before.has(k)); if (added) done.push({ name: added }); }
        } catch (e) { errors.push(e.message); }
        continue;
      }
      const src = kidsAt(it.path); const node = src && src[it.name]; if (!node) continue;
      const full = it.path.concat(it.name).join("/");
      if (node.type === "folder" && (dp === full || dp.startsWith(full + "/"))) { errors.push("The destination folder is a subfolder of the source folder."); continue; }
      if (op === "copy") {
        const nm = src === dest ? copyName(dest, it.name) : uniqueName(dest, it.name);
        const c = deepClone(node); c.created = Date.now(); delete c.readOnly; dest[nm] = c; done.push({ name: nm, copy: true });
      } else {
        if (src === dest) continue;
        const nm = uniqueName(dest, it.name); delete src[it.name]; dest[nm] = node;
        if (node.type === "folder") rewritePaths(it.path.concat(it.name), destPath.concat(nm));
        done.push({ name: nm, from: it.path.slice(), fromName: it.name });
      }
    }
    if (done.length) {
      undoStack.push({ label: op === "copy" ? "Copy" : "Move", run: () => {
        const d = kidsAt(destPath); if (!d) return;
        done.forEach((x) => { if (!d[x.name]) return; if (x.from) { const s = ensureFolder(x.from); const back = uniqueName(s, x.fromName); s[back] = d[x.name]; delete d[x.name]; if (s[back].type === "folder") rewritePaths(destPath.concat(x.name), x.from.concat(back)); } else delete d[x.name]; });
        changed();
      } });
      changed();
    }
    if (errors.length) fxAlert(op === "copy" ? "Copy" : "Move", esc(errors[0]) + (errors.length > 1 ? `<br><span class="fx-sub">(${errors.length - 1} more problem${errors.length > 2 ? "s" : ""})</span>` : ""));
    return done;
  }

  // ---------- drag & drop between Explorer windows (mouse, pen, touch) ----------
  const DRAG = { on: null };
  function dragBegin(items, label, ev) {
    ensureCSS();
    const g = el(`<div class="fx-ghost"><span class="fx-ghost-ic">${label.ic}</span><span class="fx-ghost-n">${items.length > 1 ? items.length + " items" : esc(label.name)}</span><span class="fx-ghost-a"></span></div>`);
    screenEl().appendChild(g);
    DRAG.on = { items, g, target: null, copy: false, hoverT: 0, hoverEl: null };
    dragMove(ev);
  }
  function dragTarget(x, y) {
    const t = document.elementFromPoint(x, y); if (!t || !t.closest) return null;
    return t.closest("[data-drop]");
  }
  function dragMove(ev) {
    const d = DRAG.on; if (!d) return;
    d.g.style.left = ev.clientX + 14 + "px"; d.g.style.top = ev.clientY + 14 + "px";
    const tEl = dragTarget(ev.clientX, ev.clientY);
    if (d.target !== tEl) {
      if (d.target) d.target.classList.remove("fx-drop-on");
      d.target = tEl; clearTimeout(d.hoverT);
      if (tEl) { tEl.classList.add("fx-drop-on"); if (tEl.dataset.tabi != null) d.hoverT = setTimeout(() => tEl.click(), 650); }
    }
    let ok = false, nm = "";
    const fromZip = d.items.some((i) => i.zip);
    d.copy = fromZip || ev.ctrlKey || ev.altKey || ev.metaKey;
    if (tEl) {
      try { const dest = JSON.parse(tEl.dataset.drop); nm = dest.length ? dest[dest.length - 1] : "This PC"; const dj = dest.join("/"); ok = !!kidsAt(dest) && !d.items.some((i) => { if (!i.path) return false; const full = i.path.concat(i.name).join("/"); return (i.path.join("/") === dj && !d.copy) || dj === full || dj.startsWith(full + "/"); }); } catch (e) {}
    }
    d.ok = ok;
    d.g.querySelector(".fx-ghost-a").textContent = tEl ? (ok ? (d.copy ? "Copy to " : "Move to ") + nm : "Can't drop here") : "";
    d.g.classList.toggle("fx-ghost-bad", !!tEl && !ok);
  }
  function dragEnd(ev, cancelled) {
    const d = DRAG.on; DRAG.on = null; if (!d) return;
    d.g.remove(); clearTimeout(d.hoverT); if (d.target) d.target.classList.remove("fx-drop-on");
    if (cancelled || !d.target || !d.ok) return;
    let dest; try { dest = JSON.parse(d.target.dataset.drop); } catch (e) { return; }
    transfer(d.items, dest, d.copy ? "copy" : "move");
  }

  // ---------- the app ----------
  AppRegistry.files = function () {
    ensureCSS(); wrapVFS();
    const ref = WM.createWindow({ title: "File Explorer", icon: Icon.mini("fileexplorer", "File Explorer"), width: Math.min(1000, window.innerWidth - 16), height: Math.min(640, window.innerHeight - 70), appId: "fileexplorer" });
    const body = ref.body, winEl = ref.win || body.closest(".win");
    root();
    const V = prefs();
    const startPath = window.FilesStartPath; window.FilesStartPath = null;

    // ---- places & tabs ----
    // A place: { kind: "pc"|"quick"|"gallery"|"folder"|"label"|"search"|"zip"|"bin", path?, label?, q?, inner? }
    const clonePlace = (pl) => JSON.parse(JSON.stringify(pl));
    function placeValid(pl) {
      if (!pl || !pl.kind) return false;
      if (pl.kind === "folder") return Array.isArray(pl.path) && !!kidsAt(pl.path);
      if (pl.kind === "zip") { const n = Array.isArray(pl.path) && nodeAt(pl.path); return !!(n && n.type === "file"); }
      if (pl.kind === "search") return typeof pl.q === "string" && !!pl.q;
      if (pl.kind === "label") return LABELS.some((l) => l[0] === pl.label);
      return ["pc", "quick", "gallery", "bin"].includes(pl.kind);
    }
    function placeFromStart(sp) {
      if (sp === "quick" || sp === "home") return { kind: "quick" };
      if (sp === "gallery" || sp === "bin" || sp === "pc") return { kind: sp };
      if (Array.isArray(sp)) {
        const n = nodeAt(sp);
        if (n && n.type === "folder") return { kind: "folder", path: sp.slice() };
        if (n && n.type === "file" && /\.zip$/i.test(sp[sp.length - 1])) return { kind: "zip", path: sp.slice(), inner: [] };
        if (n && n.type === "file") return { kind: "folder", path: sp.slice(0, -1), select: sp[sp.length - 1] };
      }
      return null;
    }
    let tabs, ti = 0;
    {
      const sp = placeFromStart(startPath);
      if (sp) { const sel0 = sp.select; delete sp.select; tabs = [{ place: sp, back: [], fwd: [], select: sel0 }]; }
      else {
        const saved = AD().filesTabs && Array.isArray(AD().filesTabs.list) ? AD().filesTabs.list : [];
        tabs = saved.filter(placeValid).slice(0, 12).map((pl) => ({ place: clonePlace(pl), back: [], fwd: [] }));
        ti = Math.max(0, Math.min((AD().filesTabs && AD().filesTabs.i) || 0, tabs.length - 1));
        if (!tabs.length) tabs = [{ place: { kind: "pc" }, back: [], fwd: [] }];
      }
    }
    let sel = new Set(), anchorK = null, kmap = new Map(), currentList = [], renaming = null, pendingRender = false, paneKey = "", paneToken = 0, lastPT = "mouse", lpAt = 0, swallowUntil = 0;
    const zipState = new Map();   // zip node -> { status, data, err }

    body.innerHTML = `<div class="fx12 fx-root">
      <div class="fx12-tabs" role="tablist"></div>
      <div class="fx12-nav">
        <button class="fx12-ib" data-a="back" title="Back (Alt+Left)">${I.back}</button><button class="fx12-ib" data-a="fwd" title="Forward (Alt+Right)">${I.fwd}</button><button class="fx12-ib" data-a="up" title="Up (Alt+Up)">${I.up}</button><button class="fx12-ib" data-a="refresh" title="Refresh (F5)">${I.refresh}</button>
        <div class="fx12-addr" title="Click to type a path"></div>
        <label class="fx12-search">${I.search}<input placeholder="Search" spellcheck="false" aria-label="Search"></label>
      </div>
      <div class="fx12-main">
        <aside class="fx12-side"></aside>
        <section class="fx12-pane">
          <div class="fx12-tools"></div>
          <div class="fx-content"><div class="fx12-body" tabindex="-1"></div><div class="fx-split" hidden title="Drag to resize"></div><aside class="fx-pv" hidden></aside></div>
          <div class="fx12-status"><span class="fx-st-l"></span><span class="fx-st-r"><button class="fx-st-b" data-lay="list" title="Details">${I.list}</button><button class="fx-st-b" data-lay="grid" title="Medium icons">${I.layout}</button></span></div>
          <div class="fx-toast" hidden></div>
        </section>
      </div>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const rootEl = $(".fx12"); rootEl.addEventListener("dragstart", (e) => { if (!e.target.closest || !e.target.closest("input, textarea")) e.preventDefault(); });
    const tabsEl = $(".fx12-tabs"), side = $(".fx12-side"), view = $(".fx12-body"), addr = $(".fx12-addr"), search = $(".fx12-search input"), toolsEl = $(".fx12-tools"), pv = $(".fx-pv"), split = $(".fx-split"), toastEl = $(".fx-toast");
    const tab = () => tabs[ti];
    const place = () => tab().place;
    const lastSeg = (p) => p[p.length - 1];
    const placeName = (pl) => pl.kind === "pc" ? "This PC" : pl.kind === "quick" ? "Quick Access" : pl.kind === "gallery" ? "Gallery" : pl.kind === "bin" ? "Recycle Bin" : pl.kind === "label" ? (LABELS.find((l) => l[0] === pl.label) || [, "Label"])[1] : pl.kind === "search" ? "Search Results in " + (pl.path && pl.path.length ? lastSeg(pl.path) : "This PC") : pl.kind === "zip" ? (pl.inner && pl.inner.length ? lastSeg(pl.inner) : lastSeg(pl.path)) : (lastSeg(pl.path) || "This PC");
    const placeIcon = (pl) => pl.kind === "pc" ? I.pc : pl.kind === "quick" ? I.star : pl.kind === "gallery" ? I.galleryC : pl.kind === "bin" ? I.bin : pl.kind === "label" ? I.tag : pl.kind === "search" ? I.search : pl.kind === "zip" ? glyph("a.zip", { type: "file" }, 18) : (pl.path.length ? glyph(lastSeg(pl.path), { type: "folder" }, 18) : I.pc);
    const samePlace = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    let saveT = 0;
    const saveView = () => { clearTimeout(saveT); saveT = setTimeout(() => State.save(), 250); };
    function saveTabs() { AD().filesTabs = { list: tabs.map((t) => clonePlace(t.place)), i: ti }; saveView(); }
    function setTitle() { const t = winEl && winEl.querySelector(".t-text"); if (t) t.textContent = placeName(place()) + " - File Explorer"; }

    const inst = {
      win: winEl,
      rewrite(fix) { tabs.forEach((t) => [t.place].concat(t.back, t.fwd).forEach((pl) => { if (pl && pl.path) pl.path = fix(pl.path); })); if (clip) clip.items.forEach((c) => { if (c.path) { const f = fix(c.path.concat(c.name)); c.path = f.slice(0, -1); c.name = f[f.length - 1]; } }); },
    };
    INST.add(inst);

    function go(pl, noHistory) {
      if (!noHistory && !samePlace(pl, place())) { tab().back.push(place()); tab().fwd = []; }
      tab().place = pl; sel.clear(); anchorK = null;
      if (pl.kind !== "search") search.value = "";
      saveTabs(); render(); view.scrollTop = 0;
    }
    const openFolder = (path) => go({ kind: "folder", path: path.slice() });
    function newTab(pl, background) { tabs.push({ place: pl || { kind: "pc" }, back: [], fwd: [] }); if (!background) { ti = tabs.length - 1; sel.clear(); } saveTabs(); render(); }
    function closeTab(i) {
      if (tabs.length === 1) { saveTabs(); ref.close ? ref.close() : (winEl.querySelector(".ctl-close") || {}).click && winEl.querySelector(".ctl-close").click(); return; }
      tabs.splice(i, 1); if (ti > i || ti >= tabs.length) ti = Math.max(0, ti - 1); sel.clear(); saveTabs(); render();
    }
    function switchTab(i) { if (i === ti || !tabs[i]) return; ti = i; sel.clear(); anchorK = null; search.value = place().kind === "search" ? place().q : ""; saveTabs(); render(); }

    // ---- tabs strip ----
    function paintTabs() {
      tabsEl.innerHTML = "";
      tabs.forEach((t, i) => {
        const b = el(`<div class="fx12-tab ${i === ti ? "on" : ""}" role="tab" aria-selected="${i === ti}" tabindex="0" data-tabi="${i}" title="${esc(placeName(t.place))}"><span class="fx12-tab-ic">${placeIcon(t.place)}</span><span class="fx12-tab-t">${esc(placeName(t.place))}</span><button class="fx12-tab-x" title="Close tab (Ctrl+W)" aria-label="Close tab">×</button></div>`);
        if (t.place.kind === "folder") b.dataset.drop = JSON.stringify(t.place.path);
        b.addEventListener("click", (ev) => { if (Date.now() < (tabsEl._noClick || 0)) return; if (ev.target.closest(".fx12-tab-x")) { ev.stopPropagation(); closeTab(i); return; } switchTab(i); });
        b.addEventListener("mousedown", (ev) => { if (ev.button === 1) ev.preventDefault(); });
        b.addEventListener("auxclick", (ev) => { if (ev.button === 1) { ev.preventDefault(); closeTab(i); } });
        b.addEventListener("contextmenu", (ev) => { ev.preventDefault(); if (Date.now() - lpAt < 800) return; tabMenu(i, ev); });
        b.addEventListener("pointerdown", (ev) => {
          if (ev.button !== 0 || ev.target.closest(".fx12-tab-x")) return;
          const sx = ev.clientX, sy = ev.clientY; let dragging = false; let lp = ev.pointerType !== "mouse" ? setTimeout(() => { lp = 0; lpAt = Date.now(); tabsEl._noClick = Date.now() + 500; tabMenu(i, { clientX: sx, clientY: sy, lp: true }); }, 520) : 0;
          const mv = (e) => {
            if (lp && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { clearTimeout(lp); lp = 0; }
            if (!dragging && Math.abs(e.clientX - sx) > 6 && tabs.length > 1) { dragging = true; b.classList.add("fx-tab-drag"); }
            if (dragging) { e.preventDefault(); b.style.transform = `translateX(${e.clientX - sx}px)`; }
          };
          const up = (e) => {
            window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); clearTimeout(lp);
            if (!dragging) return;
            if (e.type === "pointercancel") { b.style.transform = ""; b.classList.remove("fx-tab-drag"); return; }
            const others = [...tabsEl.querySelectorAll(".fx12-tab")].filter((x) => x !== b);
            let ni = others.filter((x) => { const r = x.getBoundingClientRect(); return r.left + r.width / 2 < e.clientX; }).length;
            const active = tabs[ti]; const [moved] = tabs.splice(i, 1); tabs.splice(ni, 0, moved);
            ti = Math.max(0, tabs.indexOf(active));
            tabsEl._noClick = Date.now() + 300; saveTabs(); paintTabs();
          };
          window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
        });
        tabsEl.appendChild(b);
      });
      const add = el(`<button class="fx12-tab-add" title="New tab (Ctrl+T)" aria-label="New tab">+</button>`);
      add.onclick = () => newTab({ kind: "pc" });
      tabsEl.appendChild(add);
      const on = tabsEl.querySelector(".fx12-tab.on"); if (on && on.scrollIntoView) try { on.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) {}
    }
    function tabMenu(i, at) {
      const t = tabs[i];
      popMenu(at, [
        { t: "New tab", ic: I.tabnew, kbd: "Ctrl+T", fn: () => newTab({ kind: "pc" }) },
        { t: "Duplicate tab", fn: () => { tabs.splice(i + 1, 0, { place: clonePlace(t.place), back: t.back.slice(), fwd: t.fwd.slice() }); ti = i + 1; saveTabs(); render(); } },
        { t: "Open in new window", ic: I.open, fn: () => { window.FilesStartPath = t.place.kind === "folder" ? t.place.path.slice() : t.place.kind === "zip" ? t.place.path.slice() : t.place.kind; WM.open("fileexplorer"); } },
        "-",
        { t: "Close tab", kbd: "Ctrl+W", fn: () => closeTab(i) },
        { t: "Close other tabs", disabled: tabs.length < 2, fn: () => { tabs = [t]; ti = 0; saveTabs(); render(); } },
        { t: "Close tabs to the right", disabled: i >= tabs.length - 1, fn: () => { tabs.splice(i + 1); if (ti > i) ti = i; saveTabs(); render(); } },
      ]);
    }

    // ---- address bar ----
    function paintAddr() {
      const pl = place(); addr.innerHTML = "";
      const crumb = (label, onClick, dropPath) => { const c = el(`<button class="fx12-crumb">${esc(label)}</button>`); c.onclick = (e) => { e.stopPropagation(); onClick(); }; if (dropPath) c.dataset.drop = JSON.stringify(dropPath); addr.appendChild(c); };
      const sep = () => addr.appendChild(el(`<span class="fx12-sep">›</span>`));
      addr.appendChild(el(`<span class="fx12-addr-ic">${placeIcon(pl)}</span>`));
      if (pl.kind === "folder" || pl.kind === "zip") {
        crumb("This PC", () => go({ kind: "pc" }));
        pl.path.forEach((seg, i) => { sep(); const p = pl.path.slice(0, i + 1); if (pl.kind === "zip" && i === pl.path.length - 1) crumb(seg, () => go({ kind: "zip", path: pl.path.slice(), inner: [] })); else crumb(seg, () => openFolder(p), p); });
        if (pl.kind === "zip") (pl.inner || []).forEach((seg, i) => { sep(); crumb(seg, () => go({ kind: "zip", path: pl.path.slice(), inner: pl.inner.slice(0, i + 1) })); });
      } else crumb(placeName(pl), () => {});
      sep();
      addr.appendChild(el(`<span class="fx-addr-fill"></span>`));
      $('[data-a="back"]').disabled = !tab().back.length; $('[data-a="fwd"]').disabled = !tab().fwd.length;
      $('[data-a="up"]').disabled = !(pl.kind === "folder" || pl.kind === "zip");
    }
    addr.addEventListener("click", (ev) => {
      if (ev.target.closest(".fx12-crumb") || addr.querySelector("input")) return;
      const pl = place();
      const cur = pl.kind === "folder" ? winPath(pl.path) : pl.kind === "zip" ? winPath(pl.path.concat(pl.inner || [])) : placeName(pl);
      addr.innerHTML = ""; const inp = el(`<input class="fx-addr-in" spellcheck="false" aria-label="Address">`); inp.value = cur; addr.appendChild(inp); inp.focus(); inp.select();
      let done = false;
      const finish = (goTo) => {
        if (done) return; done = true;
        if (goTo) {
          const v = inp.value.trim();
          const named = { "this pc": { kind: "pc" }, "quick access": { kind: "quick" }, home: { kind: "quick" }, gallery: { kind: "gallery" }, "recycle bin": { kind: "bin" } }[v.toLowerCase()];
          if (named) { go(named); return; }
          const p = parseWinPath(v);
          if (p) { const n = nodeAt(p); if (!p.length) go({ kind: "pc" }); else if (n.type === "folder") openFolder(p); else if (/\.zip$/i.test(lastSeg(p))) go({ kind: "zip", path: p, inner: [] }); else { openFolder(p.slice(0, -1)); defaultOpen({ name: lastSeg(p), node: n, path: p.slice(0, -1) }); } return; }
          paintAddr(); fxAlert("File Explorer", `Windows can't find '${esc(v)}'. Check the spelling and try again.`); return;
        }
        paintAddr();
      };
      inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); finish(true); } else if (e.key === "Escape") { e.preventDefault(); finish(false); } };
      inp.onblur = () => setTimeout(() => finish(false), 120);
    });

    // ---- sidebar ----
    function paintSide() {
      const pl = place(); side.innerHTML = "";
      const on = (k, p) => (pl.kind === k && (!p || (pl.path && pl.path.join("/") === p)));
      const item = (ic, label, active, onClick, dropPath, menu) => {
        const a = el(`<a class="fx12-si ${active ? "on" : ""}" tabindex="0" role="button">${ic}<span>${esc(label)}</span></a>`);
        a.onclick = (e) => { if (Date.now() < swallowUntil) return; onClick(e); }; a.onkeydown = (e) => { if (e.key === "Enter") onClick(e); };
        if (dropPath) a.dataset.drop = JSON.stringify(dropPath);
        if (menu) { a.addEventListener("contextmenu", (e) => { e.preventDefault(); if (Date.now() - lpAt < 800) return; popMenu(e, menu()); }); longPress(a, (pt) => popMenu(pt, menu())); }
        return a;
      };
      const folderMenu = (p) => () => [
        { t: "Open in new tab", ic: I.tabnew, fn: () => newTab({ kind: "folder", path: p.slice() }) },
        { t: "Open in new window", ic: I.open, fn: () => { window.FilesStartPath = p.slice(); WM.open("fileexplorer"); } },
        "-",
        isPinned(p) ? { t: "Unpin from Quick access", ic: I.pinO, fn: () => { AD().filesPinned = pins().filter((x) => x.join("/") !== p.join("/")); changed(); } } : QUICK.includes(p.join("/")) ? null : { t: "Pin to Quick access", ic: I.pinO, fn: () => { pins().push(p.slice()); changed(); } },
        { t: "Copy as path", ic: I.path, fn: () => copyText('"' + winPath(p) + '"') },
        { t: "Properties", ic: I.info, kbd: "Alt+Enter", fn: () => showProperties([{ name: lastSeg(p), node: nodeAt(p), path: p.slice(0, -1) }]) },
      ];
      const c1 = el(`<div class="fx12-card"><div class="fx12-card-h">${I.pin}<b>Pinned</b></div></div>`);
      c1.appendChild(item(I.star, "Quick Access", on("quick"), () => go({ kind: "quick" })));
      c1.appendChild(item(I.galleryC, "Gallery", on("gallery"), () => go({ kind: "gallery" })));
      c1.appendChild(item(I.cloud, "OneDrive", on("folder", "OneDrive"), () => openFolder(["OneDrive"]), ["OneDrive"], folderMenu(["OneDrive"])));
      c1.appendChild(item(I.pc, "This PC", on("pc"), () => go({ kind: "pc" })));
      const nb = binList().length;
      c1.appendChild(item(I.bin, "Recycle Bin" + (nb ? " (" + nb + ")" : ""), on("bin"), () => go({ kind: "bin" }), null, () => [{ t: "Open", fn: () => go({ kind: "bin" }) }, { t: "Empty Recycle Bin", ic: I.del, disabled: !nb, fn: emptyBin }]));
      side.appendChild(c1);
      const c2 = el(`<div class="fx12-card"><div class="fx12-card-h">${I.folder}<b>Folders</b></div></div>`);
      QUICK.concat(root()["Homework"] ? ["Homework"] : []).forEach((q) => c2.appendChild(item(glyph(q, { type: "folder" }, 18), q, on("folder", q), () => openFolder([q]), [q], folderMenu([q]))));
      pins().filter((p) => kidsAt(p)).forEach((p) => c2.appendChild(item(glyph(lastSeg(p), { type: "folder" }, 18), lastSeg(p), on("folder", p.join("/")), () => openFolder(p), p, folderMenu(p))));
      side.appendChild(c2);
      const c3 = el(`<div class="fx12-card"><div class="fx12-card-h">${I.tag}<b>Label</b></div></div>`);
      LABELS.forEach(([k, name, col]) => c3.appendChild(item(`<i class="fx12-dot" style="background:${col}"></i>`, name, pl.kind === "label" && pl.label === k, () => go({ kind: "label", label: k }))));
      side.appendChild(c3);
    }

    // ---- items in the current place ----
    const showH = () => V.showHidden;
    function entries() {
      const pl = place();
      if (pl.kind === "folder") { const k = kidsAt(pl.path); return k ? Object.keys(k).filter((n) => k[n] && (showH() || !k[n].hidden)).map((name) => ({ name, node: k[name], path: pl.path })) : []; }
      if (pl.kind === "label") { const out = []; walk((n, name, p) => { if (n.label === pl.label && (showH() || !n.hidden)) out.push({ name, node: n, path: p }); }); return out; }
      if (pl.kind === "search") { const q = pl.q.toLowerCase(), base = pl.path || []; const out = []; const start = kidsAt(base) || root(); walk((n, name, p) => { if (name.toLowerCase().includes(q) && (showH() || !n.hidden)) out.push({ name, node: n, path: p }); }, base, start); return out.slice(0, 300); }
      if (pl.kind === "zip") {
        const zn = nodeAt(pl.path); if (!zn) return [];
        const st = zipState.get(zn);
        if (!st || st.ts !== (zn.ts || 0)) {
          const s = { status: "loading", ts: zn.ts || 0 }; zipState.set(zn, s);
          zipOpen(zn).then((z) => { s.status = "ok"; s.data = z; }).catch((e) => { s.status = "err"; s.err = e.message || String(e); }).then(() => { if (body.isConnected && place().kind === "zip") render(); });
          return [];
        }
        if (st.status !== "ok") return [];
        const t = zipSub(st.data.tree, pl.inner || []); return t ? zipVirtual(t, pl.inner || [], pl.path) : [];
      }
      if (pl.kind === "bin") return binList().map((b) => ({ name: b.name, node: b.node, path: b.from || [], binId: b.id, binTs: b.ts }));
      return [];
    }
    function sorted(list) {
      const fold = (e) => (e.node.type === "folder" ? 0 : 1); const dir = V.desc ? -1 : 1;
      const by = (a, b) => V.sort === "date" ? ((a.binTs || a.node.ts || 0) - (b.binTs || b.node.ts || 0)) : V.sort === "type" ? (typeOf(a.name, a.node).localeCompare(typeOf(b.name, b.node)) || a.name.localeCompare(b.name)) : V.sort === "size" ? (byteLen(a.node) - byteLen(b.node)) : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      return list.sort((a, b) => fold(a) - fold(b) || dir * (V.sort === "date" || V.sort === "size" ? -by(a, b) : by(a, b)));
    }
    const key = (e) => e.binId ? "bin:" + e.binId : e.zipPath ? "zip:" + e.zipPath.join("/") + "::" + e.inner.join("/") : e.path.concat(e.name).join("/");
    const dispName = (e) => { if (e.node.kind === "shortcut") return e.name.replace(/\.lnk$/i, ""); if (!V.showExt && e.node.type === "file" && /.\.[^.]+$/.test(e.name)) return e.name.replace(/\.[^.]+$/, ""); return e.name; };

    function itemEl(e, lay) {
      const k = key(e), isF = e.node.type === "folder";
      const lab = e.node.label && LABELS.find((l) => l[0] === e.node.label);
      const chk = V.checks ? `<span class="fx-chk" role="checkbox" aria-label="Select"></span>` : "";
      let it;
      if (lay === "list") {
        const c3 = e.binId ? esc(winPath(e.path)) : fmtDate(e.node.ts);
        const c4 = e.binId ? fmtDate(e.binTs) : esc(typeOf(e.name, e.node));
        it = el(`<div class="fx12-row fx-it" tabindex="-1" role="row"><span class="fx12-row-ic">${chk}${glyph(e.name, e.node, 22)}</span><span class="fx12-row-n">${esc(dispName(e))}</span><span class="fx12-row-d">${c3}</span><span class="fx12-row-t">${c4}</span><span class="fx12-row-s">${isF ? "" : listSize(byteLen(e.node))}</span></div>`);
      } else {
        const sz = lay === "large" ? 88 : 48;
        it = el(`<div class="fx12-item fx-it" tabindex="-1" title="${esc(e.name)}${e.node.type === "file" ? "\nType: " + esc(typeOf(e.name, e.node)) + "\nSize: " + human(byteLen(e.node)) + (e.node.ts ? "\nDate modified: " + fmtDate(e.node.ts) : "") : ""}">${chk}<div class="fx12-item-ic" style="height:${sz + 4}px">${glyph(e.name, e.node, sz)}</div><div class="fx12-item-n">${esc(dispName(e))}</div></div>`);
      }
      if (lab) it.appendChild(el(`<i class="fx12-dot fx12-item-dot" style="background:${lab[2]}"></i>`));
      if (e.node.hidden) it.classList.add("fx-hidden");
      if (clip && clip.op === "cut" && clip.items.some((c) => c.path && c.path.concat(c.name).join("/") === k)) it.classList.add("cutting");
      if (sel.has(k)) it.classList.add("sel");
      if (isF && !e.zipPath && !e.binId) it.dataset.drop = JSON.stringify(e.path.concat(e.name));
      it.dataset.k = k; kmap.set(k, e);
      return it;
    }
    function section(title, ic) { return el(`<div class="fx12-sec"><div class="fx12-sec-h">${ic || ""}<span>${esc(title)}</span></div></div>`); }
    function grid(list, lay) {
      lay = lay || V.layout;
      const g = el(`<div class="${lay === "list" ? "fx12-list" : "fx12-grid"} ${lay === "large" ? "fx-large" : ""} ${V.checks ? "fx-checks" : ""}"></div>`);
      if (lay === "list") {
        const bin = place().kind === "bin";
        const h = el(`<div class="fx12-row fx12-row-h"><span class="fx12-row-ic"></span><span class="fx12-row-n" data-sort="name">Name</span><span class="fx12-row-d" data-sort="${bin ? "" : "date"}">${bin ? "Original location" : "Date modified"}</span><span class="fx12-row-t" data-sort="${bin ? "date" : "type"}">${bin ? "Date deleted" : "Type"}</span><span class="fx12-row-s" data-sort="size">Size</span></div>`);
        h.querySelectorAll("[data-sort]").forEach((s) => { const k = s.dataset.sort; if (!k) return; if (k === V.sort) s.insertAdjacentHTML("beforeend", V.desc ? " ▾" : " ▴"); s.onclick = () => { if (V.sort === k) V.desc = !V.desc; else { V.sort = k; V.desc = false; } saveView(); render(); }; });
        g.appendChild(h);
      }
      list.forEach((e) => g.appendChild(itemEl(e, lay)));
      return g;
    }

    function paintView() {
      const pl = place(); view.innerHTML = ""; currentList = []; kmap = new Map();
      view.dataset.drop = pl.kind === "folder" ? JSON.stringify(pl.path) : "";
      if (pl.kind !== "folder") delete view.dataset.drop;
      view.classList.toggle("fx-gallery-on", pl.kind === "gallery");
      if (pl.kind === "pc") {
        const r = root();
        const fold = QUICK.concat(Object.keys(r).filter((n) => r[n] && r[n].type === "folder" && !QUICK.includes(n) && !/^Local Disk/.test(n) && n !== "OneDrive" && (showH() || !r[n].hidden))).filter((n) => r[n]);
        const s1 = section("Folders", I.folder);
        currentList = fold.map((name) => ({ name, node: r[name], path: [] }));
        s1.appendChild(grid(currentList)); view.appendChild(s1);
        const s2 = section("Devices and drives", I.drive);
        const drives = el(`<div class="fx12-drives"></div>`);
        const labels = AD().driveLabels || {};
        [["Local Disk (C:)", true, "32.6", 143], ["Local Disk (D:)", false, "185.3", 216]].forEach(([name, win, free, total]) => {
          const pct = Math.round((1 - free / total) * 100); const L = name.match(/\(([A-Z]):\)/)[1];
          const d = el(`<div class="fx12-drive" tabindex="0" data-drive="${name}" data-drop='${esc(JSON.stringify([name]))}'><span class="fx12-drive-ic">${DRIVE_SVG(win)}</span><div class="fx12-drive-tx"><div class="fx12-drive-n">${esc(labels[L] || "Local Disk")} (${L}:)</div><div class="fx12-drive-bar"><i style="width:${pct}%"></i></div><div class="fx12-drive-s">${free} GB free of ${total} GB</div></div></div>`);
          // C: shows the real browser storage estimate (this origin's actual quota/usage).
          if (win) realDisk().then((st) => { if (!st || !d.isConnected) return; const s = d.querySelector(".fx12-drive-s"), bar = d.querySelector(".fx12-drive-bar i"); if (s) s.textContent = st.freeGB.toFixed(1) + " GB free of " + st.totalGB.toFixed(st.totalGB < 10 ? 1 : 0) + " GB"; if (bar) bar.style.width = st.pct + "%"; });
          const openD = () => { if (!r[name]) { r[name] = { type: "folder", children: {} }; State.save(); } openFolder([name]); };
          d.onclick = (e) => { if (Date.now() < swallowUntil) return; openD(); }; d.onkeydown = (e) => { if (e.key === "Enter") openD(); };
          const menu = () => [{ t: "Open", b: true, fn: openD }, { t: "Open in new tab", ic: I.tabnew, fn: () => newTab({ kind: "folder", path: [name] }) }, "-", { t: "Copy as path", ic: I.path, fn: () => copyText(L + ":\\") }, { t: "Properties", ic: I.info, kbd: "Alt+Enter", fn: () => showDriveProperties(name) }];
          d.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); if (Date.now() - lpAt < 800) return; popMenu(e, menu()); });
          longPress(d, (pt) => popMenu(pt, menu()));
          drives.appendChild(d);
        });
        s2.appendChild(drives); view.appendChild(s2);
        const loose = Object.keys(r).filter((n) => r[n] && r[n].type === "file" && (showH() || !r[n].hidden)).map((name) => ({ name, node: r[name], path: [] }));
        if (loose.length) { const s3 = section("Files"); s3.appendChild(grid(sorted(loose))); view.appendChild(s3); currentList = currentList.concat(loose); }
      } else if (pl.kind === "quick") {
        const r = root();
        const s1 = section("Quick access", I.star);
        const q = QUICK.filter((n) => r[n]).map((name) => ({ name, node: r[name], path: [] })).concat(pins().filter((p) => kidsAt(p)).map((p) => ({ name: lastSeg(p), node: nodeAt(p), path: p.slice(0, -1) })));
        s1.appendChild(grid(q, V.layout === "list" ? "grid" : V.layout)); view.appendChild(s1);
        const rec = recentFiles(12).filter((x) => showH() || !x.node.hidden);
        const s2 = section("Recent files"); currentList = q.concat(rec);
        if (rec.length) s2.appendChild(grid(rec, "list")); else s2.appendChild(el(`<div class="fx12-empty">Files you open or save will show up here.</div>`));
        view.appendChild(s2);
      } else if (pl.kind === "gallery") {
        paintGallery();
      } else {
        const list = sorted(entries()); currentList = list;
        if (pl.kind === "label") { const l = LABELS.find((x) => x[0] === pl.label); view.appendChild(el(`<div class="fx12-sec-h" style="margin:4px 4px 10px"><i class="fx12-dot" style="background:${l[2]}"></i><span>Labeled ${esc(l[1])}</span></div>`)); }
        if (pl.kind === "search") view.appendChild(el(`<div class="fx12-sec-h" style="margin:4px 4px 10px">${I.search}<span>Results for “${esc(pl.q)}”</span></div>`));
        if (pl.kind === "bin") {
          const deskBin = (S().desktop && S().desktop.bin) || [];
          if (deskBin.length) { const bn = el(`<div class="fx-banner">${I.info}<span>${deskBin.length} desktop shortcut${deskBin.length === 1 ? " is" : "s are"} in the Recycle Bin too.</span><button class="fx-btn">Show shortcuts</button></div>`); bn.querySelector("button").onclick = () => WM.open("recyclebin"); view.appendChild(bn); }
        }
        if (pl.kind === "zip") {
          const zn = nodeAt(pl.path); const st = zn && zipState.get(zn);
          const bar = el(`<div class="fx-banner fx-zipbar">${glyph("a.zip", { type: "file" }, 20)}<span>${!st || st.status === "loading" ? "Opening compressed folder…" : st.status === "err" ? "Windows can't open this folder. " + esc(st.err) : "Compressed (zipped) folder — " + num(zipCount(st.data.tree).files) + " files. Items open as read-only copies."}</span>${st && st.status === "ok" ? `<button class="fx-btn fx-primary">${I.extract}<span>Extract all</span></button>` : ""}</div>`);
          const xb = bar.querySelector("button"); if (xb) xb.onclick = () => extractAll(pl.path);
          view.appendChild(bar);
          if (!st || st.status !== "ok") return;
        }
        if (!list.length) view.appendChild(el(`<div class="fx12-empty">${pl.kind === "label" ? "No files have this label yet. Right-click a file → Label." : pl.kind === "search" ? "No items match your search." : pl.kind === "bin" ? "The Recycle Bin is empty." : "This folder is empty."}</div>`));
        else view.appendChild(grid(list, pl.kind === "bin" ? "list" : V.layout));
      }
    }

    // ---- Gallery ----
    const GAL_SRC = ["Pictures", "Desktop", "Downloads", "OneDrive", "Videos"];
    const vthumbs = new Map();
    function galleryItems() {
      const out = []; const r = root();
      GAL_SRC.forEach((top) => {
        if (V.gallerySrc !== "all" && V.gallerySrc !== top) return;
        const n = r[top]; if (!n || n.type !== "folder") return;
        (function rec(kids, p, depth) { Object.keys(kids).forEach((name) => { const c = kids[name]; if (!c || (c.hidden && !showH())) return; if (c.type === "folder") { if (depth < 8) rec(c.children || {}, p.concat(name), depth + 1); } else { const x = info(name, c); if (x.img || x.media === "video") out.push({ name, node: c, path: p, video: !x.img }); } }); })(n.children || {}, [top], 0);
      });
      return out.sort((a, b) => (b.node.ts || 0) - (a.node.ts || 0));
    }
    let galObs = null;
    function paintGallery() {
      const items = galleryItems(); currentList = items;
      const head = el(`<div class="fx-gal-tools"><b class="fx-gal-title">${I.galleryC} Gallery</b><div class="fx-gal-src" role="group" aria-label="Collection">${["all"].concat(GAL_SRC).map((s) => `<button class="fx-chip ${V.gallerySrc === s ? "on" : ""}" data-src="${s}">${s === "all" ? "All" : s}</button>`).join("")}</div><span class="fx-grow"></span><label class="fx-gal-zoom" title="Thumbnail size">${I.gallery}<input type="range" min="90" max="300" step="10" value="${V.galleryZoom}" aria-label="Thumbnail size"></label><button class="fx-btn" data-a="galadd">${I.upload}<span>Add photos</span></button></div>`);
      head.querySelectorAll("[data-src]").forEach((b) => (b.onclick = () => { V.gallerySrc = b.dataset.src; saveView(); sel.clear(); render(); }));
      const zr = head.querySelector("input[type=range]");
      zr.oninput = () => { V.galleryZoom = +zr.value; view.style.setProperty("--fx-gz", V.galleryZoom + "px"); saveView(); };
      head.querySelector('[data-a="galadd"]').onclick = () => uploadInto(["Pictures"], "image/*,video/*");
      view.appendChild(head);
      view.style.setProperty("--fx-gz", V.galleryZoom + "px");
      if (!items.length) { view.appendChild(el(`<div class="fx12-empty fx-gal-empty">${I.gallery}<p>Photos and videos in Pictures, Desktop, Downloads, OneDrive and Videos show up here.</p></div>`)); return; }
      const groups = new Map();
      items.forEach((it) => { const d = it.node.ts ? new Date(it.node.ts) : null; const g = d ? d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Unknown date"; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
      if (galObs) galObs.disconnect();
      galObs = "IntersectionObserver" in window ? new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { galObs.unobserve(en.target); fillThumb(en.target); } }), { root: view, rootMargin: "300px" }) : null;
      groups.forEach((list, g) => {
        const sec = el(`<div class="fx-gal-group"><div class="fx-gal-h">${esc(g)}<span class="fx-sub"> · ${list.length} item${list.length === 1 ? "" : "s"}</span></div><div class="fx-gal-grid"></div></div>`);
        const gg = sec.querySelector(".fx-gal-grid");
        list.forEach((it) => {
          const k = key(it); kmap.set(k, it);
          const t = el(`<div class="fx-gal-item fx-it ${sel.has(k) ? "sel" : ""}" tabindex="-1" data-k="${esc(k)}" title="${esc(it.name)}">${V.checks ? '<span class="fx-chk" role="checkbox" aria-label="Select"></span>' : ""}<img alt="${esc(it.name)}" draggable="false">${it.video ? `<span class="fx-gal-vid">▶ <i>${it.node.dur ? fmtDur(it.node.dur).replace(/^00:/, "") : ""}</i></span>` : ""}</div>`);
          const img = t.querySelector("img");
          if (!it.video && it.node.src) img.src = it.node.src;
          else if (it.video && vthumbs.has(it.node.blob || k)) img.src = vthumbs.get(it.node.blob || k);
          else { t.classList.add("fx-gal-pending"); if (galObs) galObs.observe(t); else fillThumb(t); }
          gg.appendChild(t);
        });
        view.appendChild(sec);
      });
    }
    function fillThumb(t) {
      const it = kmap.get(t.dataset.k); if (!it) return; const img = t.querySelector("img");
      nodeURL(it.name, it.node).then((u) => {
        if (!u) return;
        if (!it.video) { img.src = u; t.classList.remove("fx-gal-pending"); return; }
        const v = document.createElement("video"); v.muted = true; v.preload = "metadata"; v.playsInline = true;
        v.onloadedmetadata = () => { if (isFinite(v.duration)) { it.node.dur = it.node.dur || v.duration; const i2 = t.querySelector(".fx-gal-vid i"); if (i2) i2.textContent = fmtDur(v.duration).replace(/^00:/, ""); } try { v.currentTime = Math.min(1, (v.duration || 2) / 3); } catch (e) {} };
        v.onseeked = () => { try { const c = document.createElement("canvas"); c.width = 320; c.height = Math.max(1, Math.round(320 * (v.videoHeight || 180) / (v.videoWidth || 320))); c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); const d = c.toDataURL("image/jpeg", 0.7); vthumbs.set(it.node.blob || t.dataset.k, d); img.src = d; t.classList.remove("fx-gal-pending"); } catch (e) {} v.removeAttribute("src"); };
        v.src = u;
      });
    }

    // ---- status bar / toolbar ----
    function selectedSize() { return selected().reduce((s, e) => s + (e.node.type === "folder" ? 0 : byteLen(e.node)), 0); }
    function paintStatus() {
      const n = currentList.length, s = sel.size ? selected().length : 0;
      $(".fx-st-l").textContent = n + " item" + (n === 1 ? "" : "s") + (s ? "  |  " + s + " item" + (s === 1 ? "" : "s") + " selected" + (selectedSize() ? "  " + human(selectedSize()) : "") : "") + (place().kind === "bin" && n ? "  |  " + human(binList().reduce((a, b) => a + (b.node.type === "folder" ? stats(b.node).bytes : byteLen(b.node)), 0)) : "");
      body.querySelectorAll(".fx-st-b").forEach((b) => b.classList.toggle("on", b.dataset.lay === V.layout || (b.dataset.lay === "grid" && V.layout === "large")));
    }
    function selected() { return [...sel].map((k) => kmap.get(k)).filter(Boolean); }
    const realSel = () => selected().filter((e) => !e.zipPath && !e.binId);
    const canWrite = () => place().kind === "folder";
    function paintTools() {
      const pl = place(), ents = selected(), has = ents.length > 0, real = has && ents.every((e) => !e.zipPath && !e.binId);
      const files = ents.filter((e) => e.node.type === "file");
      const B = (a, ic, t, opts) => `<button class="fx12-tb" data-a="${a}" title="${esc(t)}" aria-label="${esc(t)}" ${opts && opts.dis ? "disabled" : ""}>${ic}${opts && opts.label ? `<span>${esc(opts.label === true ? t : opts.label)}</span>` : ""}${opts && opts.caret ? '<span class="fx-caret">▾</span>' : ""}</button>`;
      const D = `<span class="fx12-div"></span>`;
      const tail = `${B("sort", I.sort, "Sort", { label: "Sort", caret: true })}${B("view", I.view, "View", { label: "View", caret: true })}${B("more", I.more, "See more")}<span class="fx-grow"></span>${B("pane", V.pane === "preview" ? I.pv : I.dp, "Details pane (Alt+Shift+P)", { label: "Details" })}`;
      let h;
      if (pl.kind === "bin") h = `${B("emptybin", I.del, "Empty Recycle Bin", { label: true, dis: !binList().length })}${B("restore", I.restore, has ? "Restore the selected items" : "Restore all items", { label: true, dis: !binList().length })}${D}${B("delete", I.del, "Delete permanently", { dis: !has })}${B("props", I.info, "Properties", { dis: !has })}${D}${tail}`;
      else if (pl.kind === "zip") h = `${B("extract", I.extract, "Extract all", { label: true })}${D}${B("copy", I.copy, "Copy (Ctrl+C)", { dis: !has })}${D}${tail}`;
      else {
        const oneZip = ents.length === 1 && info(ents[0].name, ents[0].node).zip && real;
        h = `${B("new", I.plus, "New", { label: true, caret: true, dis: !canWrite() })}${D}${B("cut", I.cut, "Cut (Ctrl+X)", { dis: !real || pl.kind === "pc" && !files.length })}${B("copy", I.copy, "Copy (Ctrl+C)", { dis: !has })}${B("paste", I.paste, "Paste (Ctrl+V)", { dis: !(clip && canWrite()) })}${B("rename", I.rename, "Rename (F2)", { dis: !(real && ents.length === 1) })}${B("share", I.share, "Share", { dis: !(real && files.length && files.length === ents.length && navigator.share) })}${B("delete", I.del, "Delete (Delete)", { dis: !real })}${oneZip ? D + B("extract", I.extract, "Extract all", { label: true }) : ""}${D}${tail}`;
      }
      toolsEl.innerHTML = h;
      const pb = toolsEl.querySelector('[data-a="pane"]'); if (pb) pb.classList.toggle("on", V.pane !== "none");
    }
    toolsEl.addEventListener("click", (ev) => {
      const b = ev.target.closest("button"); if (!b || b.disabled) return; const a = b.dataset.a; const list = selected();
      if (a === "new") popMenu(b, newItems(place().path));
      else if (a === "cut") setClip("cut", realSel());
      else if (a === "copy") setClip("copy", list);
      else if (a === "paste") doPaste();
      else if (a === "rename" && list[0]) startRename(list[0]);
      else if (a === "delete") doDelete(list, place().kind === "bin");
      else if (a === "share") shareFiles(list);
      else if (a === "sort") popMenu(b, sortItems());
      else if (a === "view") popMenu(b, viewItems());
      else if (a === "more") popMenu(b, moreItems());
      else if (a === "pane") setPane(V.pane === "none" ? "details" : "none");
      else if (a === "extract") extractAll(place().kind === "zip" ? place().path : list[0].path.concat(list[0].name));
      else if (a === "emptybin") emptyBin();
      else if (a === "restore") restoreSel();
      else if (a === "props") showProperties(list);
    });
    body.querySelector(".fx-st-r").addEventListener("click", (ev) => { const b = ev.target.closest("[data-lay]"); if (b) setLayout(b.dataset.lay); });
    function setLayout(l) { V.layout = l; saveView(); render(); }
    function setPane(p) { V.pane = p; saveView(); paneKey = ""; paintPane(); paintTools(); }
    function sortItems() {
      return [["name", "Name"], ["date", place().kind === "bin" ? "Date deleted" : "Date modified"], ["type", "Type"], ["size", "Size"]].map(([k, t]) => ({ t, check: V.sort === k, fn: () => { V.sort = k; saveView(); render(); } }))
        .concat(["-", { t: "Ascending", check: !V.desc, fn: () => { V.desc = false; saveView(); render(); } }, { t: "Descending", check: V.desc, fn: () => { V.desc = true; saveView(); render(); } }]);
    }
    function showItems() {
      return [
        { t: "Preview pane", ic: I.pv, kbd: "Alt+P", check: V.pane === "preview", fn: () => setPane(V.pane === "preview" ? "none" : "preview") },
        { t: "Details pane", ic: I.dp, kbd: "Alt+Shift+P", check: V.pane === "details", fn: () => setPane(V.pane === "details" ? "none" : "details") },
        "-",
        { t: "Item check boxes", check: V.checks, fn: () => { V.checks = !V.checks; saveView(); render(); } },
        { t: "File name extensions", check: V.showExt, fn: () => { V.showExt = !V.showExt; saveView(); render(); } },
        { t: "Hidden items", check: V.showHidden, fn: () => { V.showHidden = !V.showHidden; saveView(); render(); } },
      ];
    }
    function viewItems() {
      return [
        { t: "Large icons", ic: I.large, check: V.layout === "large", fn: () => setLayout("large") },
        { t: "Medium icons", ic: I.layout, check: V.layout === "grid", fn: () => setLayout("grid") },
        { t: "Details", ic: I.list, check: V.layout === "list", fn: () => setLayout("list") },
        "-",
        { t: "Show", sub: showItems },
      ];
    }
    function moreItems() {
      const u = undoStack[undoStack.length - 1];
      const ents = realSel();
      return [
        { t: u ? "Undo " + u.label : "Undo", ic: I.undo, kbd: "Ctrl+Z", disabled: !u, fn: undo },
        "-",
        { t: "Select all", ic: I.selall, kbd: "Ctrl+A", fn: selectAll },
        { t: "Select none", fn: () => { sel.clear(); paintSel(); } },
        { t: "Invert selection", fn: () => { currentList.forEach((e) => { const k = key(e); sel.has(k) ? sel.delete(k) : sel.add(k); }); paintSel(); } },
        "-",
        { t: "Compress to ZIP file", ic: I.zip, disabled: !ents.length, fn: () => compress(ents) },
        { t: "Copy as path", ic: I.path, kbd: "Ctrl+Shift+C", disabled: !ents.length, fn: () => copyPaths(ents) },
        { t: "Properties", ic: I.info, kbd: "Alt+Enter", fn: () => propsForSelectionOrPlace() },
      ];
    }
    function propsForSelectionOrPlace() {
      const ents = realSel(); if (ents.length) return showProperties(ents);
      const pl = place(); if (pl.kind === "folder") { if (pl.path.length === 1 && /^Local Disk/.test(pl.path[0])) return showDriveProperties(pl.path[0]); showProperties([{ name: lastSeg(pl.path), node: nodeAt(pl.path), path: pl.path.slice(0, -1) }]); }
      else if (pl.kind === "pc") showDriveProperties("Local Disk (C:)");
    }
    function selectAll() { currentList.forEach((e) => sel.add(key(e))); paintSel(); }

    // ---- preview / details pane ----
    function paintPane() {
      const mode = V.pane;
      if (mode !== "preview" && mode !== "details") { pv.hidden = split.hidden = true; pv.innerHTML = ""; paneKey = ""; return; }
      pv.hidden = split.hidden = false; pv.style.width = V.paneW + "px";
      const ents = selected();
      const e = ents.length === 1 ? ents[0] : null;
      const k = mode + "|" + (e ? key(e) + "|" + (e.node.ts || 0) + "|" + byteLen(e.node) + "|" + e.name + "|" + !!e.node.readOnly + !!e.node.hidden : ents.length ? "multi" + ents.map(key).join(",") : "none" + JSON.stringify(place()) + currentList.length);
      if (k === paneKey) return; paneKey = k;
      const token = ++paneToken;
      pv.querySelectorAll("audio,video").forEach((m) => { try { m.pause(); } catch (er) {} });
      pv.innerHTML = "";
      if (mode === "preview") buildPreview(ents, token); else buildDetails(ents, token);
    }
    const live = (t) => t === paneToken && body.isConnected;
    function buildPreview(ents, token) {
      if (!ents.length) { pv.innerHTML = `<div class="fx-pv-empty">${I.pv}<p>Select a file to preview.</p></div>`; return; }
      if (ents.length > 1) { pv.innerHTML = `<div class="fx-pv-empty">${glyph("x", { type: "file" }, 64)}<p>${ents.length} items selected</p></div>`; return; }
      const e = ents[0], n = e.node, x = info(e.name, n);
      const cap = `<div class="fx-pv-cap" title="${esc(e.name)}">${esc(dispName(e))}</div>`;
      const fallback = (msg) => { if (live(token)) pv.innerHTML = `<div class="fx-pv-empty">${glyph(e.name, n, 72)}<p>${msg || "No preview available."}</p></div>${cap}`; };
      if (x.folder) { const c = e.zipPath ? (n._zdir ? Object.keys(n._zdir.dirs).length + Object.keys(n._zdir.files).length : 0) : Object.keys(n.children || {}).length; pv.innerHTML = `<div class="fx-pv-empty">${glyph(e.name, n, 96)}<p>${c} item${c === 1 ? "" : "s"}</p></div>${cap}`; return; }
      if (x.shortcut) { fallback("Shortcut to " + esc(n.target ? winPath(n.target) : "?")); return; }
      if (x.img) {
        pv.innerHTML = `<div class="fx-pv-img"><img alt="${esc(e.name)}" ${n.src ? `src="${esc(n.src)}"` : ""}></div>${cap}`;
        nodeURL(e.name, n).then((u) => { if (u && live(token)) pv.querySelector("img").src = u; else if (!u && !n.src) fallback("This picture's contents aren't on this device."); });
        return;
      }
      if (x.media) {
        pv.innerHTML = `<div class="fx-pv-media">${x.media === "audio" ? `<div class="fx-pv-art">${glyph(e.name, n, 96)}</div>` : ""}<p class="fx-sub">Loading…</p></div>${cap}`;
        nodeURL(e.name, n).then((u) => { if (!live(token)) return; if (!u) return fallback("This file's contents aren't on this device."); const m = document.createElement(x.media); m.controls = true; m.preload = "metadata"; m.playsInline = true; m.src = u; m.className = "fx-pv-player"; const box = pv.querySelector(".fx-pv-media"); box.querySelector("p").remove(); box.appendChild(m); });
        return;
      }
      if (x.pdf) {
        pv.innerHTML = `<div class="fx-pv-doc"><p class="fx-sub">Loading…</p></div>${cap}`;
        nodeBlob(e.name, n).then((b) => { if (!live(token)) return; const u = URL.createObjectURL(b.type === "application/pdf" ? b : new Blob([b], { type: "application/pdf" })); pv.querySelector(".fx-pv-doc").innerHTML = `<iframe class="fx-pv-frame" title="${esc(e.name)}" src="${u}"></iframe>`; }).catch(() => fallback());
        return;
      }
      if (n.kind === "word" && typeof n.content === "string") {
        const f = document.createElement("iframe"); f.className = "fx-pv-frame fx-pv-paper"; f.setAttribute("sandbox", ""); f.title = e.name;
        f.srcdoc = `<!doctype html><meta charset="utf-8"><style>body{font:14px/1.5 Calibri,'Segoe UI',sans-serif;margin:18px;color:#222;background:#fff;word-wrap:break-word}img{max-width:100%}</style>` + (n.content || "<p style='color:#888'>(Empty document)</p>");
        const w = el(`<div class="fx-pv-doc"></div>`); w.appendChild(f); pv.appendChild(w); pv.insertAdjacentHTML("beforeend", cap); return;
      }
      if (n.kind === "xlsx") {
        let cells = {}; try { cells = JSON.parse(n.content || "{}").cells || {}; } catch (er) {}
        const ks = Object.keys(cells); if (!ks.length) return fallback("Empty workbook");
        let maxR = 1, maxC = 1; ks.forEach((k) => { const m = /^([A-Z]+)(\d+)$/.exec(k); if (!m) return; const c = m[1].split("").reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0); maxC = Math.max(maxC, c); maxR = Math.max(maxR, +m[2]); });
        maxR = Math.min(maxR, 40); maxC = Math.min(maxC, 8);
        const col = (i) => String.fromCharCode(64 + i);
        let t = `<table class="fx-pv-sheet"><tr><th></th>${Array.from({ length: maxC }, (_, i) => `<th>${col(i + 1)}</th>`).join("")}</tr>`;
        for (let r = 1; r <= maxR; r++) t += `<tr><th>${r}</th>${Array.from({ length: maxC }, (_, i) => `<td>${esc(cells[col(i + 1) + r] || "")}</td>`).join("")}</tr>`;
        pv.innerHTML = `<div class="fx-pv-doc fx-pv-scroll">${t}</table></div>${cap}`; return;
      }
      if (n.kind === "pptx") {
        let deck = {}; try { deck = JSON.parse(n.content || "{}"); } catch (er) {}
        const sl = Array.isArray(deck.slides) ? deck.slides : []; if (!sl.length) return fallback("Empty presentation");
        pv.innerHTML = `<div class="fx-pv-doc fx-pv-scroll">${sl.slice(0, 12).map((s, i) => `<div class="fx-pv-slide" style="background:${esc(s.bg || "#fff")}"><b style="color:${esc(s.titleColor || "#17181c")}">${esc(s.title || "Slide " + (i + 1))}</b><span style="color:${esc(s.bodyColor || "#5a5f6b")}">${esc(String(s.body || "").slice(0, 140))}</span></div>`).join("")}<p class="fx-sub">${sl.length} slide${sl.length === 1 ? "" : "s"}</p></div>${cap}`; return;
      }
      if (x.zip) {
        pv.innerHTML = `<div class="fx-pv-doc fx-pv-scroll"><p class="fx-sub">Reading archive…</p></div>${cap}`;
        zipOpen(n).then((z) => { if (!live(token)) return; const c = zipCount(z.tree); const top = zipVirtual(z.tree, [], []).slice(0, 60); pv.querySelector(".fx-pv-doc").innerHTML = `<p class="fx-sub">${num(c.files)} files, ${num(c.folders)} folders · ${human(c.bytes)} uncompressed</p>${top.map((t) => `<div class="fx-pv-zr">${glyph(t.name, t.node, 18)}<span>${esc(t.name)}</span><span class="fx-sub">${t.node.type === "file" ? human(t.node.size || 0) : ""}</span></div>`).join("")}`; }).catch((er) => fallback(esc(er.message)));
        return;
      }
      if (x.text || n.kind === "text" || (!x.ext && typeof n.content === "string")) {
        pv.innerHTML = `<div class="fx-pv-doc"><p class="fx-sub">Loading…</p></div>${cap}`;
        nodeText(e.name, n, 2e6).then((t) => {
          if (!live(token)) return;
          const lines = t.split(/\r\n|\r|\n/); const shown = lines.slice(0, 200);
          const pre = document.createElement("pre"); pre.className = "fx-pv-text"; pre.textContent = shown.join("\n") + (lines.length > 200 ? "\n\n… " + (lines.length - 200) + " more lines" : "");
          const box = pv.querySelector(".fx-pv-doc"); box.innerHTML = ""; box.appendChild(pre);
        }).catch((er) => fallback(esc(er.message)));
        return;
      }
      fallback();
    }
    function buildDetails(ents, token) {
      const rowsHTML = (pairs) => pairs.filter((p) => p && p[1] !== "" && p[1] != null).map(([k, v]) => `<div class="fx-dp-r"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("");
      if (!ents.length) {
        const pl = place(); const c = currentList.length;
        const n = pl.kind === "folder" ? nodeAt(pl.path) : null;
        pv.innerHTML = `<div class="fx-dp"><div class="fx-dp-ic">${pl.kind === "folder" ? glyph(lastSeg(pl.path), { type: "folder" }, 72) : `<span class="fx-dp-big">${placeIcon(pl)}</span>`}</div><div class="fx-dp-name">${esc(placeName(pl))}</div><div class="fx-sub">${c} item${c === 1 ? "" : "s"}</div>
          <div class="fx-dp-sec">Details</div>${rowsHTML([n ? ["Type", "File folder"] : null, n ? ["Location", winPath(pl.path.slice(0, -1))] : null, n ? ["Size", human(stats(n).bytes)] : null, n && (n.created || n.ts) ? ["Date created", fmtDate(n.created || n.ts)] : null].filter(Boolean))}</div>`;
        return;
      }
      if (ents.length > 1) {
        const bytes = ents.reduce((s, e) => s + (e.node.type === "folder" ? stats(e.node).bytes : byteLen(e.node)), 0);
        pv.innerHTML = `<div class="fx-dp"><div class="fx-dp-ic">${glyph("x", { type: "file" }, 64)}</div><div class="fx-dp-name">${ents.length} items selected</div><div class="fx-dp-sec">Details</div>${rowsHTML([["Total size", human(bytes)], ["Files", String(ents.filter((e) => e.node.type === "file").length)], ["Folders", String(ents.filter((e) => e.node.type === "folder").length)]])}</div>`;
        return;
      }
      const e = ents[0], n = e.node, x = info(e.name, n);
      const big = x.img && n.src ? `<img class="fx-dp-thumb" src="${esc(n.src)}" alt="">` : glyph(e.name, n, 72);
      const s = x.folder && !e.zipPath ? stats(n) : null;
      const pairs = [
        ["Type", typeOf(e.name, n)],
        ["Size", x.folder ? (s ? human(s.bytes) : "") : human(e.zipPath ? n.size || 0 : byteLen(n))],
        e.zipPath && n.csize != null ? ["Compressed size", human(n.csize)] : null,
        s ? ["Contains", s.files + " files, " + s.folders + " folders"] : null,
        ["Date modified", fmtDate(n.ts)],
        !e.zipPath ? ["Date created", fmtDate(n.created || n.ts)] : null,
        !e.zipPath && !x.folder ? ["Date accessed", fmtDate(n.atime || n.ts)] : null,
        e.binId ? ["Date deleted", fmtDate(e.binTs)] : null,
        e.binId ? ["Original location", winPath(e.path)] : null,
        !e.binId ? ["Location", e.zipPath ? winPath(e.zipPath) + "\\" + e.inner.slice(0, -1).join("\\") : winPath(e.path)] : null,
        n.kind === "shortcut" && n.target ? ["Target", winPath(n.target)] : null,
        ["Attributes", [n.readOnly ? "Read-only" : "", n.hidden ? "Hidden" : ""].filter(Boolean).join(", ") || (e.zipPath ? "Compressed" : "Normal")],
      ].filter(Boolean);
      pv.innerHTML = `<div class="fx-dp"><div class="fx-dp-ic">${big}</div><div class="fx-dp-name" title="${esc(e.name)}">${esc(e.name)}</div><div class="fx-sub">${esc(typeOf(e.name, n))}</div>
        ${!e.binId && !e.zipPath ? `<div class="fx-dp-acts"><button class="fx-btn" data-x="open">${I.open}<span>Open</span></button><button class="fx-btn" data-x="props">${I.info}<span>Properties</span></button></div>` : ""}
        <div class="fx-dp-sec">Details</div><div class="fx-dp-rows">${rowsHTML(pairs)}</div><div class="fx-dp-more"></div></div>`;
      const ob = pv.querySelector('[data-x="open"]'); if (ob) ob.onclick = () => defaultOpen(e);
      const pb = pv.querySelector('[data-x="props"]'); if (pb) pb.onclick = () => showProperties([e]);
      const more = pv.querySelector(".fx-dp-more");
      if (x.img || x.media) probe(e).then((p) => { if (!live(token)) return; more.innerHTML = rowsHTML([p.w ? ["Dimensions", p.w + " x " + p.h] : null, p.dur ? ["Length", fmtDur(p.dur)] : null].filter(Boolean)); });
      if ((x.text || n.kind === "word") && !e.zipPath) nodeText(e.name, n, 2e6).then((t) => { if (!live(token)) return; const st = textStats(t); more.innerHTML = rowsHTML([["Lines", num(st.lines)], ["Words", num(st.words)], ["Characters", num(st.chars)]]); }).catch(() => {});
      if (x.zip && !e.zipPath) zipOpen(n).then((z) => { if (!live(token)) return; const c = zipCount(z.tree); more.innerHTML = rowsHTML([["Files inside", num(c.files)], ["Folders inside", num(c.folders)], ["Uncompressed", human(c.bytes)]]); }).catch(() => {});
    }
    split.addEventListener("pointerdown", (ev) => {
      ev.preventDefault(); const sx = ev.clientX, w0 = V.paneW; split.setPointerCapture(ev.pointerId);
      const mv = (e) => { V.paneW = Math.max(220, Math.min(560, w0 - (e.clientX - sx))); pv.style.width = V.paneW + "px"; };
      const up = () => { split.removeEventListener("pointermove", mv); split.removeEventListener("pointerup", up); split.removeEventListener("pointercancel", up); saveView(); };
      split.addEventListener("pointermove", mv); split.addEventListener("pointerup", up); split.addEventListener("pointercancel", up);
    });

    function paintSel() {
      view.querySelectorAll("[data-k]").forEach((n) => { const on = sel.has(n.dataset.k); n.classList.toggle("sel", on); n.setAttribute("aria-selected", on); });
      paintStatus(); paintTools(); paintPane();
    }
    function render() {
      if (!body.isConnected) return;
      if (renaming) { pendingRender = true; return; }
      const pl = place();
      if (!placeValid(pl)) {   // the folder was deleted / renamed elsewhere: fall back to the nearest parent
        if (pl.path) { let p = pl.path.slice(); while (p.length && !kidsAt(p)) p.pop(); tab().place = p.length ? { kind: "folder", path: p } : { kind: "pc" }; } else tab().place = { kind: "pc" };
      }
      const keepScroll = view.scrollTop;
      paintTabs(); paintAddr(); paintSide(); paintView();
      [...sel].forEach((k) => { if (!kmap.has(k)) sel.delete(k); });
      if (tab().select) { const k = place().path.concat(tab().select).join("/"); tab().select = null; if (kmap.has(k)) { sel.add(k); anchorK = k; setTimeout(() => { const it = view.querySelector(`[data-k="${CSS.escape(k)}"]`); if (it) it.scrollIntoView({ block: "nearest" }); }, 0); } }
      paintSel(); setTitle();
      view.scrollTop = keepScroll;
    }

    // ---- open ----
    let lastOpen = { k: "", t: 0 };
    function defaultOpen(e) {
      const k = key(e); if (lastOpen.k === k && Date.now() - lastOpen.t < 600) return; lastOpen = { k, t: Date.now() };
      if (e.binId) return showProperties([{ name: e.name, node: e.node, path: e.path }]);
      if (e.zipPath) {
        if (e.node.type === "folder") return go({ kind: "zip", path: e.zipPath.slice(), inner: e.inner.slice() });
        return openZipEntry(e);
      }
      if (e.node.type === "folder") return openFolder(e.path.concat(e.name));
      const x = info(e.name, e.node);
      if (x.zip) { e.node.atime = Date.now(); return go({ kind: "zip", path: e.path.concat(e.name), inner: [] }); }
      if (place().kind === "gallery" && x.img && window.CrPhotos) { e.node.atime = Date.now(); return CrPhotos.openNode(e.name, guardRO(e.name, e.node)); }
      openFile(e.name, e.node, e.path.concat(e.name));
      try { State.save(); } catch (er) {}
    }
    async function openZipEntry(e) {
      try {
        const u8 = await e.node._ze.read(); const x = info(e.name, e.node);
        const mime = MIME[x.ext] || "application/octet-stream";
        let tmp;
        if (x.img || x.media || x.pdf) tmp = { type: "file", kind: x.img ? "image" : x.media || "other", mime, src: URL.createObjectURL(new Blob([u8], { type: mime })), size: u8.length, ts: +e.node.ts, __fxClone: true };
        else { let t = null; try { t = new TextDecoder("utf-8", { fatal: true }).decode(u8); } catch (er) {} if (t != null && u8.length < 4e6) tmp = { type: "file", kind: x.ext === "docx" ? "word" : ["xlsx", "pptx"].includes(x.ext) ? x.ext : "text", content: t, ts: +e.node.ts, __fxClone: true }; }
        if (!tmp) { download(new Blob([u8], { type: mime }), e.name); return; }
        if (x.pdf) return openViewer(e.name, tmp);
        if (x.ext === "zip") { toast("Extract this ZIP first to open the ZIP inside it."); return; }
        toast("Opened a read-only copy from the compressed folder.");
        rawOpen(e.name, tmp);
      } catch (er) { fxAlert("Compressed (zipped) Folders", esc(er.message)); }
    }

    // ---- actions ----
    function setClip(op, list) {
      if (!list.length) return;
      clip = { op, items: list.map((x) => x.zipPath ? { zip: { path: x.zipPath.slice(), inner: x.inner.slice() }, name: x.name } : { path: x.path.slice(), name: x.name }) };
      if (op === "copy" && list.length === 1 && !list[0].zipPath) toast("Copied “" + list[0].name + "”");
      INST.forEach((i) => i.repaint && i.repaint());
    }
    inst.repaint = () => { try { render(); } catch (e) {} };
    async function doPaste(intoPath) {
      const pl = place(); const dest = intoPath || (pl.kind === "folder" ? pl.path : null);
      if (!clip || !dest) return;
      if (clip.op === "cut") { const ro = clip.items.filter((c) => c.path && isRO(c.path.concat(c.name))); if (ro.length && !(await fxConfirm("Move read-only item", `“${esc(ro[0].name)}” is read-only. Do you want to move it anyway?`, "Move"))) return; }
      const items = clip.items, op = clip.op;
      if (clip.op === "cut") clip = null;
      const done = await transfer(items, dest, items.some((i) => i.zip) ? "copy" : op);
      if (done.length && pl.kind === "folder" && pl.path.join("/") === dest.join("/")) { sel.clear(); done.forEach((d) => sel.add(dest.concat(d.name).join("/"))); render(); }
    }
    // Deleting Windows system files needs admin and breaks Windows (blue screen).
    const isSystemCritical = (e) => { const full = e.path.concat(e.name).join("/"); return full === "Local Disk (C:)" || full === "Local Disk (C:)/Windows" || full === "Local Disk (C:)/Windows/System32"; };
    async function doDelete(list, permanent) {
      list = list.filter(Boolean); if (!list.length) return;
      if (list.some((e) => e.zipPath)) { fxAlert("Compressed (zipped) Folders", "Items in a compressed folder can't be deleted here. Extract the folder first."); return; }
      if (list[0].binId) {
        const ok = await fxConfirm(list.length === 1 ? "Delete File" : "Delete Multiple Items", list.length === 1 ? `Are you sure you want to permanently delete “${esc(list[0].name)}”?` : `Are you sure you want to permanently delete these ${list.length} items?`, "Yes", true);
        if (ok) { purgeFromBin(list.map((e) => e.binId)); sel.clear(); }
        return;
      }
      const crit = list.find(isSystemCritical);
      if (crit && window.UAC) {
        window.UAC.prompt({ name: "Delete " + crit.name, publisher: "Microsoft Windows", iconKey: "fileexplorer", danger: true,
          detail: "Deleting <b>" + esc(crit.name) + "</b> removes files Windows needs to run. Your PC may stop working. Do this only if you know what you're doing." }, () => {
          list.forEach((e) => { const p = kidsAt(e.path); if (p) delete p[e.name]; });
          sel.clear(); changed();
          if (window.BSOD) setTimeout(() => BSOD.show(), 350);
        });
        return;
      }
      const ro = list.filter((e) => isRO(e.path.concat(e.name)));
      if (ro.length) {
        const ok = await fxConfirm("Delete read-only " + (ro[0].node.type === "folder" ? "folder" : "file"), `“${esc(ro[0].name)}”${ro.length > 1 ? " and " + (ro.length - 1) + " other item" + (ro.length > 2 ? "s are" : " is") : " is"} read-only.<br><br>Are you sure you want to ${permanent ? "permanently delete" : "move"} ${ro.length > 1 ? "them" : "it"}${permanent ? "" : " to the Recycle Bin"}?`, "Yes", true);
        if (!ok) return;
      }
      if (permanent) {
        const ok = await fxConfirm(list.length === 1 ? "Delete File" : "Delete Multiple Items", list.length === 1 ? `Are you sure you want to permanently delete “${esc(list[0].name)}”?` : `Are you sure you want to permanently delete these ${list.length} items?`, "Yes", true);
        if (!ok) return;
        list.forEach((e) => { const p = kidsAt(e.path); if (p) delete p[e.name]; }); sel.clear(); changed(); return;
      }
      const ids = recycle(list); sel.clear();
      if (ids.length) {
        const undoIt = () => { restoreFromBin(ids); };
        undoStack.push({ label: "Delete", run: undoIt });
        toast(ids.length === 1 ? "Moved “" + list[0].name + "” to the Recycle Bin" : ids.length + " items moved to the Recycle Bin", "Undo", undoIt);
      }
    }
    function restoreSel() {
      const ents = selected().filter((e) => e.binId);
      const ids = ents.length ? ents.map((e) => e.binId) : binList().map((b) => b.id);
      const n = restoreFromBin(ids); sel.clear(); if (n) toast("Restored " + n + " item" + (n === 1 ? "" : "s"));
    }
    async function emptyBin() {
      const n = binList().length; if (!n) return;
      if (await fxConfirm("Delete Multiple Items", `Are you sure you want to permanently delete ${n === 1 ? "this item" : "these " + n + " items"}?`, "Yes", true)) { AD().fileBin = []; sel.clear(); changed(); }
    }
    function startRename(e) {
      if (!e || e.zipPath || e.binId) return;
      const k = key(e); const it = view.querySelector(`[data-k="${CSS.escape(k)}"]`);
      const label = it && it.querySelector(".fx12-item-n, .fx12-row-n");
      if (!label) { fxPrompt("Rename", "New name:", e.name, true).then((v) => { if (v != null) tryRename(e.path, e.name, v.trim()).then((r) => { if (r === true) { sel.clear(); sel.add(e.path.concat(v.trim()).join("/")); render(); } }); }); return; }
      renaming = k;
      const inp = el(`<textarea class="fx-rename" rows="1" spellcheck="false" aria-label="New name"></textarea>`); inp.value = e.name;
      label.replaceWith(inp); inp.focus();
      const dot = e.node.type === "file" ? e.name.lastIndexOf(".") : -1; inp.setSelectionRange(0, dot > 0 ? dot : e.name.length);
      let finished = false;
      const finish = async (commit) => {
        if (finished) return; finished = true;
        const v = inp.value.replace(/[\r\n]+/g, "").trim();
        if (commit && v && v !== e.name) {
          const r = await tryRename(e.path, e.name, v);
          renaming = null;
          if (r === true) { sel.clear(); sel.add(e.path.concat(v).join("/")); anchorK = e.path.concat(v).join("/"); }
        } else renaming = null;
        pendingRender = false; render(); view.focus({ preventScroll: true });
      };
      inp.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Enter") { ev.preventDefault(); finish(true); } else if (ev.key === "Escape") { ev.preventDefault(); finish(false); } });
      inp.addEventListener("blur", () => finish(true));
      inp.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      inp.addEventListener("click", (ev) => ev.stopPropagation());
      inp.addEventListener("dblclick", (ev) => ev.stopPropagation());
    }
    function copyText(t) {
      const fallback = () => { const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;left:-9999px;top:0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); };
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(fallback); else fallback(); } catch (e) { fallback(); }
      AD().filesLastCopiedPath = t; toast("Copied path to the clipboard");
    }
    const copyPaths = (list) => copyText(list.map((e) => '"' + winPath(e.path.concat(e.name)) + '"').join("\r\n"));
    async function compress(list, destPath) {
      list = list.filter((e) => !e.zipPath && !e.binId); if (!list.length) return;
      const dp = destPath || (place().kind === "folder" ? place().path : list[0].path);
      const kids = kidsAt(dp); if (!kids) return;
      const first = list[0]; const base = first.node.type === "folder" ? first.name : first.name.replace(/\.[^.]+$/, "") || first.name;
      toast("Compressing " + (list.length === 1 ? "“" + first.name + "”" : list.length + " items") + "…");
      try {
        const ZK = await loadZipKit();
        const ents = await zipEntriesFor(list);
        const blob = await ZK.zip(ents);
        const node = await blobNode(blob, { mime: "application/zip" });
        const nm = uniqueName(kids, base + ".zip"); kids[nm] = node;
        undoStack.push({ label: "New", run: () => { const k2 = kidsAt(dp); if (k2 && k2[nm] === node) { delete k2[nm]; changed(); } } });
        changed();
        toast("Created “" + nm + "” (" + human(blob.size) + ")");
        if (place().kind === "folder" && place().path.join("/") === dp.join("/")) { sel.clear(); sel.add(dp.concat(nm).join("/")); render(); startRename({ name: nm, node, path: dp }); }
        return nm;
      } catch (er) { fxAlert("Compressed (zipped) Folders", esc(er.message || String(er))); }
    }
    async function extractAll(zipPath) {
      const zn = nodeAt(zipPath); if (!zn) return;
      const base = lastSeg(zipPath).replace(/\.zip$/i, "") || "Extracted";
      const parent = zipPath.slice(0, -1);
      const body2 = el(`<div><p class="fx-sub">Select a destination and extract files</p><label class="fx-field"><span>Files will be extracted to this folder:</span><input type="text" class="fx-dest" spellcheck="false"></label><label class="fx-check"><input type="checkbox" class="fx-show" checked> Show extracted files when complete</label><div class="fx-prog" hidden><div class="fx-prog-t"></div><div class="fx-prog-bar"><i></i></div></div></div>`);
      const pk = kidsAt(parent) || {};
      body2.querySelector(".fx-dest").value = winPath(parent.concat(pk[base] ? uniqueName(pk, base) : base));
      const res = await fxDialog({ title: "Extract Compressed (Zipped) Folders", body: body2, width: 480, buttons: [{ t: "Extract", primary: true, v: (b) => ({ dest: b.querySelector(".fx-dest").value, show: b.querySelector(".fx-show").checked }) }, { t: "Cancel", v: null }] });
      if (!res) return;
      // destination: an existing folder, or a new folder inside an existing parent
      let dest = parseWinPath(res.dest);
      if (!dest) { const raw = res.dest.replace(/[\\/]+$/, ""); const cut = Math.max(raw.lastIndexOf("\\"), raw.lastIndexOf("/")); const par = cut > 0 ? parseWinPath(raw.slice(0, cut)) : parent; const nm = (cut > 0 ? raw.slice(cut + 1) : raw).trim(); if (!par || !kidsAt(par) || !nm || /[\\/:*?"<>|]/.test(nm)) { fxAlert("Extract", "Windows can't find that destination. Check the path and try again."); return; } dest = par.concat(nm); }
      const n0 = nodeAt(dest); if (n0 && n0.type !== "folder") { fxAlert("Extract", "The destination is a file, not a folder."); return; }
      toast("Extracting “" + lastSeg(zipPath) + "”…");
      try {
        const z = await zipOpen(zn); const total = zipCount(z.tree).files; let doneN = 0; const errors = [];
        const kids = ensureFolder(dest);
        await extractInto(z.tree, kids, () => { doneN++; if (doneN % 5 === 0 || doneN === total) toast("Extracting… " + doneN + " of " + total); }, errors);
        changed();
        toast("Extracted " + (total - errors.length) + " file" + (total - errors.length === 1 ? "" : "s") + " to " + lastSeg(dest));
        if (errors.length) fxAlert("Extract", `${errors.length} file${errors.length === 1 ? "" : "s"} couldn't be extracted:<br>${esc(errors.slice(0, 4).join(" · "))}`);
        if (res.show) openFolder(dest);
      } catch (er) { fxAlert("Compressed (zipped) Folders", "Windows cannot complete the extraction.<br><br>" + esc(er.message || String(er))); }
    }
    async function shareFiles(list) {
      const files = list.filter((e) => e.node.type === "file" && !e.binId);
      try {
        const fs = await Promise.all(files.map(async (e) => new File([await nodeBlob(e.name, e.node)], e.name, { type: mimeOf(e.name, e.node) })));
        if (navigator.canShare && navigator.canShare({ files: fs })) await navigator.share({ files: fs, title: fs.length === 1 ? fs[0].name : fs.length + " files" });
        else if (navigator.share) await navigator.share({ title: files.map((e) => e.name).join(", "), text: files.map((e) => e.name).join(", ") });
        else downloadSel(files);
      } catch (er) { if (er && er.name !== "AbortError") toast("Couldn't share: " + (er.message || er)); }
    }
    async function downloadSel(list) {
      for (const e of list) {
        try {
          if (e.node.type === "folder") { const ZK = await loadZipKit(); download(await ZK.zip(await zipEntriesFor([e])), e.name + ".zip"); }
          else if (e.zipPath) download(new Blob([await e.node._ze.read()], { type: mimeOf(e.name, e.node) }), e.name);
          else download(await nodeBlob(e.name, e.node), e.name);
        } catch (er) { fxAlert("Download", esc(er.message || String(er))); }
      }
    }
    function makeShortcut(targetPath, intoPath) {
      const kids = ensureFolder(intoPath); const t = nodeAt(targetPath); if (!t) return null;
      const nm = uniqueName(kids, lastSeg(targetPath).replace(/\.lnk$/i, "") + " - Shortcut.lnk");
      kids[nm] = { type: "file", kind: "shortcut", target: targetPath.slice(), ts: Date.now(), created: Date.now(), size: 1024 };
      changed(); return nm;
    }
    function uploadInto(destPath, accept) {
      const inp = document.getElementById("globalFileInput"); if (!inp) return; inp.accept = accept || ""; inp.value = ""; inp.multiple = true;
      inp.onchange = () => { const fl = [...inp.files]; inp.multiple = false; importFiles(fl, destPath); };
      inp.click();
    }
    function importFiles(fl, destPath) {
      if (!fl.length || !window.VFS || !VFS.nodeFromFile) return;
      const dest = ensureFolder(destPath);
      toast("Copying " + fl.length + " item" + (fl.length === 1 ? "" : "s") + "…");
      Promise.all(fl.map((f) => VFS.nodeFromFile(f).then((node) => { node.created = Date.now(); if (f.lastModified) node.ts = f.lastModified; const nm = uniqueName(dest, f.name); dest[nm] = node; return nm; }).catch((er) => { console.warn(er); return null; })))
        .then((names) => { changed(); const ok = names.filter(Boolean); toast("Added " + ok.length + " item" + (ok.length === 1 ? "" : "s") + " to " + (lastSeg(destPath) || "This PC")); if (place().kind === "folder" && place().path.join("/") === destPath.join("/")) { sel.clear(); ok.forEach((n) => sel.add(destPath.concat(n).join("/"))); render(); } });
    }
    // 1-bit 800×600 white BMP: a real bitmap file that Paint and Photos open.
    function blankBMP() {
      const w = 800, h = 600, row = Math.ceil(w / 32) * 4, data = row * h, off = 62, size = off + data;
      const b = new Uint8Array(size), dv = new DataView(b.buffer);
      b[0] = 0x42; b[1] = 0x4d; dv.setUint32(2, size, true); dv.setUint32(10, off, true);
      dv.setUint32(14, 40, true); dv.setInt32(18, w, true); dv.setInt32(22, h, true); dv.setUint16(26, 1, true); dv.setUint16(28, 1, true); dv.setUint32(34, data, true); dv.setInt32(38, 2835, true); dv.setInt32(42, 2835, true); dv.setUint32(46, 2, true);
      b.set([0, 0, 0, 0, 255, 255, 255, 0], 54); b.fill(255, off);
      return new Blob([b], { type: "image/bmp" });
    }
    function newItems(destPath) {
      const dest = destPath && kidsAt(destPath);
      const dis = !dest || (destPath[0] === "Local Disk (C:)" && false);
      const make = (name, node, open) => { const n = uniqueName(dest, name); node.created = node.created || Date.now(); dest[n] = node; undoStack.push({ label: "New", run: () => { const k2 = kidsAt(destPath); if (k2 && k2[n] === node) { delete k2[n]; changed(); } } }); changed(); if (place().kind === "folder" && place().path.join("/") === destPath.join("/")) { sel.clear(); sel.add(destPath.concat(n).join("/")); render(); startRename({ name: n, node, path: destPath }); } return n; };
      const ts = () => Date.now();
      return [
        { t: "Folder", ic: I.newfolder, kbd: "Ctrl+Shift+N", disabled: dis, fn: () => make("New folder", { type: "folder", children: {}, ts: ts() }) },
        { t: "Shortcut", ic: I.link, disabled: dis, fn: () => shortcutWizard(destPath) },
        "-",
        { t: "Bitmap image", ic: glyph("a.bmp", { type: "file", kind: "image" }, 18), disabled: dis, fn: async () => { const blob = blankBMP(); let node; try { node = await blobNode(blob, { kind: "image", mime: "image/bmp", w: 800, h: 600 }); const t = await imageThumb(blob); if (t && node.blob) node.src = t.thumb; } catch (er) { return fxAlert("New", esc(er.message)); } make("New Bitmap image.bmp", node); } },
        { t: "Microsoft Word Document", ic: glyph("a.docx", { type: "file", kind: "word" }, 18), disabled: dis, fn: () => make("New Microsoft Word Document.docx", { type: "file", kind: "word", content: "", ts: ts() }) },
        { t: "Microsoft PowerPoint Presentation", ic: glyph("a.pptx", { type: "file", kind: "pptx" }, 18), disabled: dis, fn: () => make("New Microsoft PowerPoint Presentation.pptx", { type: "file", kind: "pptx", content: "", ts: ts() }) },
        { t: "Text Document", ic: glyph("a.txt", { type: "file", kind: "text" }, 18), disabled: dis, fn: () => make("New Text Document.txt", { type: "file", kind: "text", content: "", ts: ts() }) },
        { t: "Microsoft Excel Worksheet", ic: glyph("a.xlsx", { type: "file", kind: "xlsx" }, 18), disabled: dis, fn: () => make("New Microsoft Excel Worksheet.xlsx", { type: "file", kind: "xlsx", content: "", ts: ts() }) },
        { t: "Compressed (zipped) Folder", ic: I.zip, disabled: dis, fn: async () => { try { const ZK = await loadZipKit(); make("New Compressed (zipped) Folder.zip", await blobNode(await ZK.zip([]), { mime: "application/zip" })); } catch (er) { fxAlert("New", esc(er.message)); } } },
        "-",
        { t: "Upload from this device…", ic: I.upload, disabled: dis, fn: () => uploadInto(destPath) },
      ];
    }
    async function shortcutWizard(destPath) {
      const b = el(`<div><p class="fx-sub">This wizard helps you to create shortcuts to local files and folders.</p><label class="fx-field"><span>Type the location of the item:</span><input type="text" class="fx-loc" placeholder="C:\\Users\\${esc(userName())}\\Documents" spellcheck="false"></label><button class="fx-btn fx-browse">Browse…</button><label class="fx-field"><span>Type a name for this shortcut:</span><input type="text" class="fx-nm" spellcheck="false"></label><div class="fx-err" hidden></div></div>`);
      const loc = b.querySelector(".fx-loc"), nm = b.querySelector(".fx-nm"), err = b.querySelector(".fx-err");
      loc.oninput = () => { const p = parseWinPath(loc.value); if (p && p.length) nm.value = lastSeg(p).replace(/\.[^.]+$/, ""); };
      b.querySelector(".fx-browse").onclick = () => { if (window.VFS && VFS.pickFile) VFS.pickFile({ title: "Browse for Files or Folders" }, (r) => { loc.value = winPath(r.path.concat(r.name)); loc.oninput(); }); };
      const r = await fxDialog({ title: "Create Shortcut", body: b, width: 460, buttons: [{ t: "Finish", primary: true, check: () => { const p = parseWinPath(loc.value); if (!p || !p.length) { err.hidden = false; err.textContent = "Windows can't find '" + loc.value + "'. Check the spelling and try again."; return false; } return true; }, v: () => ({ p: parseWinPath(loc.value), name: nm.value.trim() }) }, { t: "Cancel", v: null }] });
      if (!r) return;
      const kids = kidsAt(destPath); const name = uniqueName(kids, (r.name || lastSeg(r.p)).replace(/[\\/:*?"<>|]/g, "") + ".lnk");
      kids[name] = { type: "file", kind: "shortcut", target: r.p, ts: Date.now(), created: Date.now(), size: 1024 };
      changed(); sel.clear(); sel.add(destPath.concat(name).join("/")); render();
    }

    // ---- context menus ----
    function openWithItems(e) {
      const apps = appsFor(e.name, e.node);
      return apps.map((a) => ({ t: a.name, ic: `<span class="fx-app-ic">${Icon.mini(a.id, a.name)}</span>`, fn: () => launch(a.id, e.name, e.node, e.path.concat(e.name)) }))
        .concat(apps.length ? ["-"] : [], [{ t: "Choose another app", fn: () => chooseApp(e.name, e.node, e.path.concat(e.name)) }]);
    }
    function sendToItems(list) {
      return [
        { t: "Compressed (zipped) folder", ic: I.zip, fn: () => compress(list) },
        { t: "Desktop (create shortcut)", ic: I.desktop, fn: () => { const made = list.map((e) => makeShortcut(e.path.concat(e.name), ["Desktop"])).filter(Boolean); if (made.length) toast("Created " + made.length + " shortcut" + (made.length === 1 ? "" : "s") + " in Desktop"); } },
        { t: "Documents", ic: glyph("Documents", { type: "folder" }, 18), fn: () => transfer(list.map((e) => ({ path: e.path.slice(), name: e.name })), ["Documents"], "copy").then((d) => d.length && toast("Copied " + d.length + " item" + (d.length === 1 ? "" : "s") + " to Documents")) },
        { t: "Mail recipient", ic: I.mail, disabled: !list.some((e) => e.node.type === "file"), fn: () => mailFiles(list) },
      ];
    }
    function itemMenu(e, at) {
      const list = selected().length && sel.has(key(e)) ? [e].concat(selected().filter((x) => key(x) !== key(e))) : [e];
      const single = list.length === 1;
      if (e.binId) return popMenu(at, [
        { t: "Restore", ic: I.restore, b: true, fn: restoreSel },
        "-",
        { t: "Delete", ic: I.del, danger: true, fn: () => doDelete(list, true) },
        "-",
        { t: "Properties", ic: I.info, fn: () => showProperties(list.map((x) => ({ name: x.name, node: x.node, path: x.path }))) },
      ]);
      if (e.zipPath) return popMenu(at, [
        { t: "Open", b: true, fn: () => defaultOpen(e) },
        e.node.type === "folder" ? { t: "Open in new tab", ic: I.tabnew, fn: () => newTab({ kind: "zip", path: e.zipPath.slice(), inner: e.inner.slice() }) } : null,
        "-",
        { t: "Copy", ic: I.copy, kbd: "Ctrl+C", fn: () => setClip("copy", list) },
        { t: "Extract all…", ic: I.extract, fn: () => extractAll(e.zipPath) },
        { t: "Download to this device", ic: I.download, fn: () => downloadSel(list) },
      ]);
      const n = e.node, isF = n.type === "folder", x = info(e.name, n), full = e.path.concat(e.name);
      const showLoc = place().kind !== "folder" || place().path.join("/") !== e.path.join("/");
      const items = [
        { strip: [
          { ic: I.cut, t: "Cut", disabled: !e.path.length && isF, fn: () => setClip("cut", list) },
          { ic: I.copy, t: "Copy", fn: () => setClip("copy", list) },
          { ic: I.rename, t: "Rename", disabled: !single, fn: () => startRename(e) },
          { ic: I.share, t: "Share", disabled: !(navigator.share && list.every((y) => y.node.type === "file")), fn: () => shareFiles(list) },
          { ic: I.del, t: "Delete", fn: () => doDelete(list) },
        ] },
        { t: "Open", b: true, kbd: "Enter", fn: () => defaultOpen(e) },
        isF ? { t: "Open in new tab", ic: I.tabnew, fn: () => newTab({ kind: "folder", path: full }) } : null,
        isF ? { t: "Open in new window", ic: I.open, fn: () => { window.FilesStartPath = full; WM.open("fileexplorer"); } } : null,
        !isF && single && !x.shortcut ? { t: "Open with", ic: I.openwith, sub: () => openWithItems(e) } : null,
        x.zip && single ? { t: "Extract all…", ic: I.extract, fn: () => extractAll(full) } : null,
        showLoc ? { t: "Open file location", ic: I.folder, fn: () => { go({ kind: "folder", path: e.path.slice() }); sel.add(key(e)); paintSel(); } } : null,
        x.shortcut ? { t: "Open target location", ic: I.folder, disabled: !(n.target && nodeAt(n.target)), fn: () => { tab().select = lastSeg(n.target); go({ kind: "folder", path: n.target.slice(0, -1) }); } } : null,
        "-",
        isF && clip ? { t: "Paste into folder", ic: I.paste, fn: () => doPaste(full) } : null,
        { t: "Compress to ZIP file", ic: I.zip, fn: () => compress(list) },
        { t: "Copy as path", ic: I.path, kbd: "Ctrl+Shift+C", fn: () => copyPaths(list) },
        isF && single ? (isPinned(full) ? { t: "Unpin from Quick access", ic: I.pinO, fn: () => { AD().filesPinned = pins().filter((p) => p.join("/") !== full.join("/")); changed(); } } : QUICK.includes(full.join("/")) ? null : { t: "Pin to Quick access", ic: I.pinO, fn: () => { pins().push(full.slice()); changed(); toast("Pinned “" + e.name + "” to Quick access"); } }) : null,
        { t: "Send to", ic: I.sendto, sub: () => sendToItems(list) },
        { t: "Label", ic: I.tag, sub: () => LABELS.map(([k, name, col]) => ({ t: name, ic: `<i class="fx12-dot" style="background:${col}"></i>`, check: n.label === k, fn: () => setLabel(list, n.label === k ? null : k) })).concat(n.label ? ["-", { t: "Remove label", fn: () => setLabel(list, null) }] : []) },
        { t: "Download to this device", ic: I.download, fn: () => downloadSel(list) },
        "-",
        single && !isF && !x.shortcut && window.FileHistory ? { t: "Version history", ic: I.history, fn: () => FileHistory.openVersions(full) } : null,
        single && !x.shortcut && !(isF && !e.path.length && /^Local Disk/.test(e.name)) ? { t: "Restore previous versions", ic: I.restore, fn: () => showProperties([e], "Previous Versions") } : null,
        { t: "Properties", ic: I.info, kbd: "Alt+Enter", fn: () => showProperties(list) },
      ];
      popMenu(at, items);
    }
    function setLabel(list, label) { list.forEach((e) => { if (label) e.node.label = label; else delete e.node.label; }); changed(); }
    function emptyMenu(at) {
      const pl = place(); const u = undoStack[undoStack.length - 1];
      popMenu(at, [
        { t: "View", ic: I.view, sub: () => viewItems() },
        { t: "Sort by", ic: I.sort, sub: sortItems },
        { t: "Refresh", ic: I.refresh, kbd: "F5", fn: () => { zipState.clear(); render(); } },
        "-",
        { t: "Paste", ic: I.paste, kbd: "Ctrl+V", disabled: !(clip && pl.kind === "folder"), fn: () => doPaste() },
        { t: u ? "Undo " + u.label : "Undo", ic: I.undo, kbd: "Ctrl+Z", disabled: !u, fn: undo },
        pl.kind === "zip" ? { t: "Extract all…", ic: I.extract, fn: () => extractAll(pl.path) } : null,
        pl.kind === "bin" ? { t: "Empty Recycle Bin", ic: I.del, disabled: !binList().length, fn: emptyBin } : null,
        pl.kind === "gallery" ? { t: "Add photos…", ic: I.upload, fn: () => uploadInto(["Pictures"], "image/*,video/*") } : null,
        "-",
        { t: "New", ic: I.plus, disabled: pl.kind !== "folder", sub: () => newItems(pl.path) },
        "-",
        pl.kind === "folder" ? { t: "Pin to Quick access", ic: I.pinO, disabled: isPinned(pl.path) || QUICK.includes(pl.path.join("/")), fn: () => { pins().push(pl.path.slice()); changed(); } } : null,
        { t: "Select all", ic: I.selall, kbd: "Ctrl+A", fn: selectAll },
        { t: "Properties", ic: I.info, kbd: "Alt+Enter", disabled: !(pl.kind === "folder" || pl.kind === "pc"), fn: propsForSelectionOrPlace },
      ]);
    }
    function undo() { const u = undoStack.pop(); if (u) { try { u.run(); } catch (e) { console.error(e); } toast("Undid " + u.label.toLowerCase()); } }

    // ---- toast ----
    let toastT = 0;
    function toast(msg, act, fn) {
      toastEl.hidden = false; toastEl.innerHTML = `<span>${esc(msg)}</span>${act ? `<button class="fx-btn">${esc(act)}</button>` : ""}`;
      const b = toastEl.querySelector("button"); if (b) b.onclick = () => { toastEl.hidden = true; fn(); };
      clearTimeout(toastT); toastT = setTimeout(() => { toastEl.hidden = true; }, act ? 7000 : 3500);
    }

    // ---- long press helper (touch / pen) ----
    function longPress(elm, cb) {
      let t = 0, sx = 0, sy = 0;
      elm.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") return; sx = e.clientX; sy = e.clientY; clearTimeout(t); t = setTimeout(() => { t = 0; lpAt = Date.now(); swallowUntil = Date.now() + 600; cb({ clientX: sx, clientY: sy, lp: true }); }, 520); });
      elm.addEventListener("pointermove", (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) { clearTimeout(t); t = 0; } });
      ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => elm.addEventListener(ev, () => { clearTimeout(t); t = 0; }));
    }

    // ---- item interaction (delegated): click, double-click, long-press, drag, marquee ----
    view.addEventListener("click", (ev) => {
      if (Date.now() < swallowUntil) { ev.stopPropagation(); return; }
      const it = ev.target.closest("[data-k]");
      if (!it) { if (ev.target.closest("button, input, a, .fx-banner, .fx-gal-tools, .fx12-row-h")) return; if (!ev.ctrlKey && !ev.metaKey && !ev.shiftKey) { sel.clear(); paintSel(); } return; }
      const k = it.dataset.k;
      if (ev.target.closest(".fx-chk")) { sel.has(k) ? sel.delete(k) : sel.add(k); anchorK = k; paintSel(); return; }
      if (ev.shiftKey && anchorK && kmap.has(anchorK)) {
        const order = [...view.querySelectorAll("[data-k]")].map((x) => x.dataset.k); const a = order.indexOf(anchorK), b = order.indexOf(k);
        if (!ev.ctrlKey && !ev.metaKey) sel.clear(); order.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((x) => sel.add(x));
      } else if (ev.ctrlKey || ev.metaKey) { sel.has(k) ? sel.delete(k) : sel.add(k); anchorK = k; }
      else {
        const was = sel.has(k) && sel.size === 1;
        sel.clear(); sel.add(k); anchorK = k;
        if (was && lastPT !== "mouse" && it._tapOpen) { paintSel(); defaultOpen(kmap.get(k)); return; }
      }
      it._tapOpen = true; paintSel();
      try { it.focus({ preventScroll: true }); } catch (e) {}
    });
    view.addEventListener("dblclick", (ev) => { const it = ev.target.closest("[data-k]"); if (!it || ev.target.closest(".fx-chk, .fx-rename")) return; const e = kmap.get(it.dataset.k); if (e) defaultOpen(e); });
    view.addEventListener("contextmenu", (ev) => {
      ev.preventDefault(); if (ev.target.closest(".fx-rename")) return;
      if (Date.now() - lpAt < 800) return;
      const it = ev.target.closest("[data-k]");
      if (it) { const k = it.dataset.k; if (!sel.has(k)) { sel.clear(); sel.add(k); anchorK = k; paintSel(); } itemMenu(kmap.get(k), ev); }
      else if (!ev.target.closest(".fx12-drive")) emptyMenu(ev);
    });
    let armed = false;
    view.addEventListener("touchmove", (e) => { if (armed || DRAG.on) e.preventDefault(); }, { passive: false });
    view.addEventListener("pointerdown", (ev) => {
      lastPT = ev.pointerType || "mouse";
      if (ev.button !== 0 || ev.target.closest("input, textarea, button:not(.fx-chk), .fx-gal-tools, .fx12-drive")) return;
      const it = ev.target.closest("[data-k]");
      const sx = ev.clientX, sy = ev.clientY, touch = ev.pointerType !== "mouse";
      let lp = 0, dragging = false, marquee = null, base = null;
      armed = false;
      if (touch) lp = setTimeout(() => {
        lp = 0; armed = true; lpAt = Date.now(); swallowUntil = Date.now() + 700;
        if (it) { const k = it.dataset.k; if (!sel.has(k)) { sel.clear(); sel.add(k); anchorK = k; paintSel(); } itemMenu(kmap.get(k), { clientX: sx, clientY: sy, lp: true }); }
        else emptyMenu({ clientX: sx, clientY: sy, lp: true });
      }, 500);
      const canDrag = () => { if (!it) return false; const e = kmap.get(it.dataset.k); return e && !e.binId && !(place().kind === "pc" && !e.path.length && e.node.type === "folder" && QUICK.includes(e.name) && false); };
      const mv = (e) => {
        const d = Math.hypot(e.clientX - sx, e.clientY - sy);
        if (lp && d > 10) { clearTimeout(lp); lp = 0; }
        if (!dragging && !marquee && d > 8) {
          if (it && canDrag() && (!touch || armed)) {
            dragging = true; closeMenus(); swallowUntil = Date.now() + 400;
            const k = it.dataset.k; if (!sel.has(k)) { sel.clear(); sel.add(k); paintSel(); }
            const ents = selected(); const e0 = kmap.get(k);
            dragBegin(ents.map((x) => x.zipPath ? { zip: { path: x.zipPath.slice(), inner: x.inner.slice() }, name: x.name } : { path: x.path.slice(), name: x.name }), { name: e0.name, ic: glyph(e0.name, e0.node, 28) }, e);
          } else if (!it && !touch && place().kind !== "gallery") {
            marquee = el(`<div class="fx-marquee"></div>`); view.appendChild(marquee);
            base = ev.ctrlKey || ev.metaKey ? new Set(sel) : new Set();
          }
        }
        if (dragging) { e.preventDefault(); dragMove(e); }
        if (marquee) {
          const vr = view.getBoundingClientRect();
          const x1 = Math.min(sx, e.clientX), y1 = Math.min(sy, e.clientY), x2 = Math.max(sx, e.clientX), y2 = Math.max(sy, e.clientY);
          marquee.style.left = x1 - vr.left + view.scrollLeft + "px"; marquee.style.top = y1 - vr.top + view.scrollTop + "px"; marquee.style.width = x2 - x1 + "px"; marquee.style.height = y2 - y1 + "px";
          sel = new Set(base);
          view.querySelectorAll("[data-k]").forEach((n) => { const r = n.getBoundingClientRect(); if (r.right > x1 && r.left < x2 && r.bottom > y1 && r.top < y2) sel.add(n.dataset.k); });
          view.querySelectorAll("[data-k]").forEach((n) => n.classList.toggle("sel", sel.has(n.dataset.k)));
        }
      };
      const up = (e) => {
        window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
        clearTimeout(lp); armed = false;
        if (dragging) dragEnd(e, e.type === "pointercancel");
        if (marquee) { marquee.remove(); swallowUntil = Date.now() + 200; paintSel(); }
      };
      window.addEventListener("pointermove", mv, { passive: false }); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    });
    // Files dragged in from the device (Finder / Files app / desktop) are copied into the folder.
    const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
    rootEl.addEventListener("dragover", (e) => { if (!hasFiles(e)) return; const t = e.target.closest && e.target.closest("[data-drop]"); if (!t) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; rootEl.querySelectorAll(".fx-drop-on").forEach((x) => x !== t && x.classList.remove("fx-drop-on")); t.classList.add("fx-drop-on"); });
    rootEl.addEventListener("dragleave", (e) => { if (e.target.classList) e.target.classList.remove("fx-drop-on"); });
    rootEl.addEventListener("drop", (e) => {
      if (!hasFiles(e)) return; const t = e.target.closest && e.target.closest("[data-drop]"); if (!t) return; e.preventDefault();
      rootEl.querySelectorAll(".fx-drop-on").forEach((x) => x.classList.remove("fx-drop-on"));
      let dest; try { dest = JSON.parse(t.dataset.drop); } catch (er) { return; }
      importFiles([...e.dataTransfer.files], dest);
    });
    view.addEventListener("keydown", (ev) => {
      if (ev.target.closest(".fx-rename")) return;
      const arrows = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: "d", ArrowUp: "u" };
      if (!(ev.key in arrows) || ev.altKey) return;
      const items = [...view.querySelectorAll("[data-k]")]; if (!items.length) return;
      ev.preventDefault();
      let i = items.findIndex((x) => x.dataset.k === anchorK); if (i < 0) i = -1;
      let step = arrows[ev.key];
      if (step === "d" || step === "u") { const top0 = items[Math.max(0, i)].offsetTop; const cols = V.layout === "list" || place().kind === "bin" ? 1 : Math.max(1, items.filter((x) => x.offsetTop === items[0].offsetTop).length); step = step === "d" ? cols : -cols; void top0; }
      const j = Math.max(0, Math.min(items.length - 1, i + step)); const k = items[j].dataset.k;
      if (!ev.shiftKey) sel.clear(); sel.add(k); anchorK = k; paintSel(); items[j].focus({ preventScroll: true }); items[j].scrollIntoView({ block: "nearest" });
    });

    // ---- nav buttons, search ----
    $('[data-a="back"]').onclick = () => { const t = tab(); if (!t.back.length) return; t.fwd.push(t.place); t.place = t.back.pop(); sel.clear(); saveTabs(); render(); };
    $('[data-a="fwd"]').onclick = () => { const t = tab(); if (!t.fwd.length) return; t.back.push(t.place); t.place = t.fwd.pop(); sel.clear(); saveTabs(); render(); };
    $('[data-a="up"]').onclick = () => { const pl = place(); if (pl.kind === "zip") { if (pl.inner && pl.inner.length) go({ kind: "zip", path: pl.path, inner: pl.inner.slice(0, -1) }); else { tab().select = lastSeg(pl.path); go({ kind: "folder", path: pl.path.slice(0, -1) }); } return; } if (pl.kind !== "folder") return; tab().select = lastSeg(pl.path); if (pl.path.length > 1) openFolder(pl.path.slice(0, -1)); else go({ kind: "pc" }); };
    $('[data-a="refresh"]').onclick = () => { zipState.clear(); paneKey = ""; render(); };
    let sTimer = 0;
    search.oninput = () => {
      clearTimeout(sTimer);
      sTimer = setTimeout(() => {
        const q = search.value.trim(); const pl = place();
        if (!q) { if (pl.kind === "search") { const t = tab(); t.place = t.back.pop() || { kind: "pc" }; sel.clear(); saveTabs(); render(); } return; }
        const base = pl.kind === "folder" ? pl.path : pl.kind === "search" ? pl.path : [];
        if (pl.kind === "search") { pl.q = q; sel.clear(); render(); } else go({ kind: "search", q, path: base });
        search.focus();
      }, 180);
    };
    search.onkeydown = (e) => { if (e.key === "Escape") { search.value = ""; search.oninput(); } };

    // ---- keyboard shortcuts (only for the top-most Explorer window) ----
    function isTop() {
      if (!winEl || !winEl.isConnected || winEl.style.display === "none") return false;
      let max = -Infinity, top = null;
      document.querySelectorAll("#screen > .win").forEach((w) => { if (w.style.display === "none") return; const z = +w.style.zIndex || 0; if (z >= max) { max = z; top = w; } });
      return top === winEl || (!top && true);
    }
    const onKey = (ev) => {
      if (!body.isConnected) { document.removeEventListener("keydown", onKey); return; }
      if (!isTop() || document.querySelector(".fx-dlg-mask") || renaming) return;
      const tgt = ev.target; const typing = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      const mod = ev.ctrlKey || ev.metaKey, k = (ev.key || "").toLowerCase(), code = ev.code;
      const list = selected(); const real = list.filter((e) => !e.zipPath && !e.binId);
      const stop = () => { ev.preventDefault(); ev.stopPropagation(); };
      if (ev.altKey && code === "KeyP") { stop(); setPane(ev.shiftKey ? (V.pane === "details" ? "none" : "details") : (V.pane === "preview" ? "none" : "preview")); return; }
      if (ev.altKey && (k === "enter")) { stop(); propsForSelectionOrPlace(); return; }
      if (ev.altKey && k === "arrowleft") { stop(); $('[data-a="back"]').click(); return; }
      if (ev.altKey && k === "arrowright") { stop(); $('[data-a="fwd"]').click(); return; }
      if (ev.altKey && k === "arrowup") { stop(); $('[data-a="up"]').click(); return; }
      if (mod && k === "t") { stop(); newTab({ kind: "pc" }); return; }
      if (mod && k === "w") { stop(); closeTab(ti); return; }
      if (mod && k === "tab") { stop(); switchTab((ti + (ev.shiftKey ? tabs.length - 1 : 1)) % tabs.length); return; }
      if (mod && /^[1-9]$/.test(k)) { stop(); switchTab(k === "9" ? tabs.length - 1 : +k - 1); return; }
      if (mod && (k === "e" || k === "f")) { stop(); search.focus(); search.select(); return; }
      if ((mod && k === "l") || (ev.altKey && k === "d")) { stop(); addr.click(); return; }
      if (mod && k === "n" && !ev.shiftKey) { stop(); const pl = place(); window.FilesStartPath = pl.kind === "folder" ? pl.path.slice() : pl.kind; WM.open("fileexplorer"); return; }
      if (mod && ev.shiftKey && k === "n") { stop(); if (canWrite()) newItems(place().path)[0].fn(); return; }
      if (k === "f5" || (mod && k === "r")) { stop(); zipState.clear(); paneKey = ""; render(); return; }
      if (typing) return;
      if (k === "delete" && list.length) { stop(); doDelete(list, ev.shiftKey || place().kind === "bin"); }
      else if (k === "f2" && real.length === 1) { stop(); startRename(real[0]); }
      else if (k === "enter" && list.length) { stop(); list.slice(0, 5).forEach(defaultOpen); }
      else if (mod && ev.shiftKey && k === "c" && real.length) { stop(); copyPaths(real); }
      else if (mod && k === "c" && list.length) { stop(); setClip("copy", list); }
      else if (mod && k === "x" && real.length) { stop(); setClip("cut", real); }
      else if (mod && k === "v") { stop(); doPaste(); }
      else if (mod && k === "z") { stop(); undo(); }
      else if (mod && k === "a") { stop(); selectAll(); }
      else if (k === "backspace") { stop(); $('[data-a="back"]').click(); }
      else if (k === "escape" && sel.size) { sel.clear(); paintSel(); }
    };
    document.addEventListener("keydown", onKey);
    // Live refresh when another app (or another Explorer window) changes the files.
    const onVfs = () => { if (!body.isConnected) { window.removeEventListener("vfs-change", onVfs); INST.delete(inst); return; } try { render(); } catch (e) { console.error(e); } };
    window.addEventListener("vfs-change", onVfs);
    render();
    return ref;
  };
  AppRegistry.fileexplorer = AppRegistry.files;

  // ---------- integration with the rest of the system ----------
  // VFS.openNode is used by the Start menu, Terminal, Classroom…: shortcuts follow their target,
  // ZIPs open as folders in File Explorer, PDFs open in the viewer and read-only files open as copies.
  function wrapVFS() {
    if (!window.VFS || !VFS.openNode || VFS.__fxWrapped) return;
    const orig = VFS.openNode.bind(VFS);
    VFS.openNode = function (name, node) {
      try {
        if (node && node.type === "file" && !node._loading && !node.__fxClone && !node._ze) {
          if (node.kind === "shortcut") return followShortcut(name, node);
          if (/\.zip$/i.test(name)) { const p = findPathOf(node); if (p) { window.FilesStartPath = p; WM.open("fileexplorer"); return; } }
          if (info(name, node).pdf && (node.blob || node.src)) return openViewer(name, node);
          if (node.readOnly) return orig(name, guardRO(name, node));
        }
      } catch (e) {}
      return orig(name, node);
    };
    VFS.__fxWrapped = true;
  }
  window.addEventListener("load", wrapVFS);
  // The desktop Recycle Bin window also lists deleted files.
  function decorateBin(body) {
    if (!body) return;
    ensureCSS();
    const paint = () => {
      if (!body.isConnected) { mo.disconnect(); window.removeEventListener("vfs-change", onV); return; }
      const old = body.querySelector(".fx-rb-files"); if (old) old.remove();
      const items = binList();
      const host = body.querySelector(".rbin") || body;
      const sec = el(`<div class="fx-rb-files"><div class="fx-rb-h"><b>Deleted files (${items.length})</b><span class="fx-grow"></span><button class="fx-btn" data-a="open">Open in File Explorer</button></div><div class="fx-rb-list"></div></div>`);
      const lst = sec.querySelector(".fx-rb-list");
      if (!items.length) lst.innerHTML = `<div class="fx-sub" style="padding:8px 12px">No deleted files.</div>`;
      items.slice(-60).reverse().forEach((b) => { const r = el(`<div class="fx-rb-row"><span class="fx-rb-ic">${glyph(b.name, b.node, 20)}</span><span class="fx-grow" title="${esc(winPath(b.from || []))}">${esc(b.name)}</span><button class="fx-btn" data-id="${esc(b.id)}">Restore</button></div>`); r.querySelector("button").onclick = () => restoreFromBin([b.id]); lst.appendChild(r); });
      sec.querySelector('[data-a="open"]').onclick = () => { window.FilesStartPath = "bin"; WM.open("fileexplorer"); };
      mo.disconnect(); host.appendChild(sec); mo.observe(body, { childList: true, subtree: false });
    };
    const mo = new MutationObserver(() => { if (!body.querySelector(".fx-rb-files")) paint(); });
    const onV = () => paint();
    window.addEventListener("vfs-change", onV);
    paint();
  }
  (function wrapRecycleBin() {
    const orig = AppRegistry.recyclebin; if (!orig || orig.__fx) return;
    const w = function () {
      const r = orig.apply(this, arguments);
      try { const ws = WM.windows().filter((e) => e.appId === "recyclebin"); const ent = ws[ws.length - 1]; if (ent) decorateBin(ent.win.querySelector(".win-body")); } catch (e) {}
      return r;
    };
    w.__fx = true; AppRegistry.recyclebin = w;
  })();

  // Used by the Start menu ("Suggested files", folder shortcuts) and other apps.
  window.FilesHelper = {
    recent: (n) => { try { return recentFiles(n); } catch (_) { return []; } },
    open: (path) => { window.FilesStartPath = path; WM.open("fileexplorer"); },
    ago,
    glyph,
    winPath,
    parseWinPath,
    properties: (path) => { const n = nodeAt(path); if (n) showProperties([{ name: path[path.length - 1], node: n, path: path.slice(0, -1) }]); },
    driveProperties: (letter) => showDriveProperties("Local Disk (" + (letter || "C") + ":)"),
    openWith: (path) => { const n = nodeAt(path); if (n) chooseApp(path[path.length - 1], n, path); },
    restoreFromBin, recycle: (path) => recycle([{ name: path[path.length - 1], path: path.slice(0, -1) }]),
    loadZipKit,
    // used by File History (js/filehistory.js)
    nodeAt, ensureFolder, uniqueName, imageThumb, showProperties,
    openFile: (name, node, path) => openFile(name, node, path),
    launch: (appId, name, node, path) => launch(appId, name, node, path),
  };
  // File History hooks every save, so it loads with the desktop (not only when Explorer opens).
  // index.html may list js/filehistory.js itself; otherwise it's added here once.
  function loadFileHistory() {
    if (window.FileHistory || document.querySelector('script[src*="js/filehistory.js"]')) return;
    const s = document.createElement("script"); s.src = "js/filehistory.js" + VQ; s.async = false; document.head.appendChild(s);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadFileHistory); else setTimeout(loadFileHistory, 0);
})();
