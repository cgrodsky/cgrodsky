/* Creative apps, part 1: the shared CrKit helpers (used by mediax/photosx/stickyx too),
   Paint (Windows 11 style, layers, pressure) and Paint 3D (three.js, online only).
   Loaded after apps.js / apps2.js, so AppRegistry.paint here replaces the old one. */
(function () {
  "use strict";

  // ======================================================================
  // CrKit — shared helpers for the creative apps
  // ======================================================================
  const STATE_KEY = window.WIN12_STATE_KEY || "win12_state_v1"; // this account's key (per-user / per-VM)
  const el = (html) => { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const PATHS = {
    save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    open: '<path d="M3 19V6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v2"/><path d="M3 19l2.6-7.6A2 2 0 0 1 7.5 10H22l-3 9z"/>',
    newdoc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    select: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 2.5"/>',
    freeform: '<path d="M6 9c1-5 12-6 13 0s-7 4-8 8-7 1-5-4" stroke-dasharray="3 2.5"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
    resize: '<rect x="3" y="10" width="11" height="11" rx="1"/><path d="M14 3h7v7M21 3l-8 8"/>',
    rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    rotL: '<path d="M4 11a8 8 0 1 1 2.3 5.7"/><path d="M4 4v7h7"/>',
    pencil: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
    fill: '<path d="m19 11-8-8-8.5 8.5a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0z"/><path d="m5 2 5 5M2 13h15M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4z"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    eraser: '<path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L11 21z"/><path d="M22 21H7M5 11l9 9"/>',
    picker: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3z"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
    zoomout: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/>',
    brush: '<path d="M18.4 2.6a2 2 0 0 1 3 3L14 13l-3-3z"/><path d="M7 14a3 3 0 0 0-3 3c0 1.5-1 2.5-2 3 1 .5 3 1 4.5 1A4.5 4.5 0 0 0 11 16.5 3 3 0 0 0 7 14z"/>',
    size: '<path d="M4 6h16" stroke-width="1"/><path d="M4 11h16" stroke-width="2.4"/><path d="M4 17.5h16" stroke-width="4.2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    merge: '<path d="M8 3v5l4 4 4-4V3M12 12v9M8 17l4 4 4-4"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2"/>',
    cut: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16 18 4M16 16 6 4"/>',
    paste: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6"/>',
    play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
    next: '<path d="M5 5v14l10-7z" fill="currentColor"/><path d="M19 5v14"/>',
    prev: '<path d="M19 5v14L9 12z" fill="currentColor"/><path d="M5 5v14"/>',
    shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    repeat1: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1.2v5"/>',
    volume: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>',
    mini: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="12" y="12" width="6" height="5" rx="1" fill="currentColor"/>',
    expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    fullscreen: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    queue: '<path d="M3 6h13M3 12h13M3 18h9M17 15v6l5-3z"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4z"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
    heartfill: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z" fill="currentColor"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>', chevD: '<path d="m6 9 6 6 6-6"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    slideshow: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 8 5 2.5-5 2.5zM8 21h8M12 17v4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    adjust: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    filter: '<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/>',
    highlighter: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    flipH: '<path d="M12 3v18"/><path d="M8 7 3 12l5 5zM16 7l5 5-5 5z"/>',
    flipV: '<path d="M3 12h18"/><path d="M7 8l5-5 5 5zM7 16l5 5 5-5z"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    note: '<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5"/>',
    bold: '<path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z" stroke-width="2.3"/>',
    italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
    underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4M4 21h16"/>',
    strike: '<path d="M16 4H9a3 3 0 0 0-2.8 4M14 12a4 4 0 0 1 0 8H6M4 12h16"/>',
    grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5"/>',
    cube: '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
    move: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
    scale: '<path d="M21 3 11 13M21 3h-6M21 3v6"/><rect x="3" y="13" width="8" height="8" rx="1"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    pin: '<path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>',
    wifi: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01"/>',
    star: '<path d="m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  };
  const ico = (n, s) => `<svg class="cr-i" viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[n] || ""}</svg>`;

  function filesRoot() {
    try { if (window.VFS && VFS.ensure) return VFS.ensure(); } catch (e) {}
    const d = State.data; d.appData = d.appData || {};
    if (!d.appData.files || !d.appData.files.root) d.appData.files = { root: {} };
    return d.appData.files.root;
  }
  // children object of a folder path (["Pictures"]); creates missing folders when asked
  function folder(path, create) {
    let ch = filesRoot();
    for (const seg of path || []) {
      if (!ch[seg]) { if (!create) return null; ch[seg] = { type: "folder", children: {} }; }
      if (ch[seg].type !== "folder") return null;
      if (!ch[seg].children) ch[seg].children = {};
      ch = ch[seg].children;
    }
    return ch;
  }
  function nodeAt(path) { if (!path || !path.length) return null; const ch = folder(path.slice(0, -1)); return ch ? ch[path[path.length - 1]] || null : null; }
  function uniqueName(children, name) {
    if (!children[name]) return name;
    const m = name.match(/^(.*?)(\.[^.]+)?$/); const base = m[1], ext = m[2] || ""; let i = 2;
    while (children[base + " (" + i + ")" + ext]) i++;
    return base + " (" + i + ")" + ext;
  }
  // State.save() swallows quota errors; this reports them so callers can roll back.
  function trySave() {
    if (State.frozen) return true; // a restore / account switch is reloading: never overwrite it
    try { localStorage.setItem(STATE_KEY, JSON.stringify(State.data)); return true; }
    catch (e) { return false; }
  }
  function vfsChanged(source) { try { window.dispatchEvent(new CustomEvent("vfs-change", { detail: { source: source || "creative" } })); } catch (e) {} }
  function notify(title, body, iconId) { try { if (window.Notify) Notify.show({ icon: iconId ? Icon.mini(iconId, title) : "", title, body }); } catch (e) {} }
  function walk(path, cb, depth) {
    const ch = folder(path); if (!ch || (depth || 0) > 6) return;
    Object.keys(ch).forEach((name) => { const n = ch[name]; if (!n) return; if (n.type === "folder") walk(path.concat(name), cb, (depth || 0) + 1); else cb(n, name, path.concat(name)); });
  }
  const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|heic|avif)$/i;
  const AUD_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i;
  const VID_EXT = /\.(mp4|webm|mov|m4v|ogv|mkv)$/i;
  function isImage(name, n) { return n && n.type === "file" && (n.kind === "image" || /^image\//.test(n.mime || "") || IMG_EXT.test(name)); }
  function mediaKind(name, n) {
    if (!n || n.type !== "file") return null;
    if (n.kind === "audio" || /^audio\//.test(n.mime || "")) return "audio";
    if (n.kind === "video" || /^video\//.test(n.mime || "")) return "video";
    if (AUD_EXT.test(name)) return "audio";
    if (VID_EXT.test(name)) return "video";
    return null;
  }
  const urlCache = new Map();
  // A playable / displayable URL for a file node (full-size bytes from IndexedDB when present).
  function nodeURL(n) {
    if (!n) return Promise.resolve(null);
    if (n.blob && window.VFS && VFS.getBlob) {
      if (urlCache.has(n.blob)) return Promise.resolve(urlCache.get(n.blob));
      return VFS.getBlob(n.blob).then((b) => { if (!b) return n.src || n.url || null; const u = URL.createObjectURL(b); urlCache.set(n.blob, u); return u; }).catch(() => n.src || n.url || null);
    }
    return Promise.resolve(n.src || n.url || n.content && /^data:/.test(n.content) && n.content || null);
  }
  const toBlob = (c, type, q) => new Promise((res) => { try { c.toBlob((b) => res(b), type, q); } catch (e) { res(null); } });
  const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function fitCanvas(src, max, bg) {
    const w = src.width || src.naturalWidth || src.videoWidth, h = src.height || src.naturalHeight || src.videoHeight;
    const k = Math.min(1, max / Math.max(w, h));
    const c = mkCanvas(w * k, h * k), g = c.getContext("2d");
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(src, 0, 0, c.width, c.height); return c;
  }
  function loadImage(url) {
    return new Promise((res, rej) => { const im = new Image(); if (!/^(data|blob):/.test(url)) im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => rej(new Error("Couldn't load image")); im.src = url; });
  }
  function quotaMsg() { return "Storage is full. Delete some big photos or videos in File Explorer, or use Download instead."; }

  // Save a canvas as an image file in the real filesystem (dir = ["Pictures"]).
  // Full-size bytes go to IndexedDB (VFS.putBlob) with a small thumbnail inline (same shape as
  // File Explorer uploads). Without IndexedDB it falls back to a compressed data URL.
  async function saveImage(dir, name, canvas, opts) {
    opts = opts || {};
    const c = (canvas.width > 2048 || canvas.height > 2048) ? fitCanvas(canvas, 2048) : canvas;
    let mime = opts.jpeg ? "image/jpeg" : "image/png";
    let blob = await toBlob(c, mime, 0.9);
    if (blob && mime === "image/png" && blob.size > 4e6) { mime = "image/jpeg"; blob = await toBlob(c, mime, 0.9); name = name.replace(/\.png$/i, ".jpg"); }
    const node = { type: "file", kind: "image", mime, w: c.width, h: c.height, ts: Date.now() };
    let id = null;
    if (blob && window.VFS && VFS.putBlob && window.indexedDB) { try { id = await VFS.putBlob(blob); } catch (e) { id = null; } }
    if (id) { node.blob = id; node.size = blob.size; node.src = fitCanvas(c, 320, "#fff").toDataURL("image/jpeg", 0.75); }
    else {
      let url = c.toDataURL(mime, 0.9);
      if (url.length > 1.5e6) url = fitCanvas(c, 1600, "#fff").toDataURL("image/jpeg", 0.82);
      if (url.length > 1.5e6) url = fitCanvas(c, 1024, "#fff").toDataURL("image/jpeg", 0.75);
      node.src = url; node.size = Math.round(url.length * 0.75);
      if (/^data:image\/jpeg/.test(url)) { node.mime = "image/jpeg"; name = name.replace(/\.png$/i, ".jpg"); }
    }
    const kids = folder(dir, true);
    const finalName = opts.overwrite ? name : uniqueName(kids, name);
    const prev = kids[finalName];
    kids[finalName] = node;
    if (!trySave()) { if (prev) kids[finalName] = prev; else delete kids[finalName]; trySave(); const e = new Error(quotaMsg()); e.quota = true; throw e; }
    vfsChanged();
    return { name: finalName, node, path: dir.concat(finalName) };
  }
  // Save a media File/Blob into the filesystem. IndexedDB when available (cap 20 MB);
  // otherwise an inline data URL capped at 1.5 MB so localStorage (5 MB on Safari) survives.
  const MEDIA_IDB_CAP = 20 * 1024 * 1024, MEDIA_INLINE_CAP = 1.5 * 1024 * 1024;
  async function saveMedia(dir, name, blob, kind) {
    const node = { type: "file", kind, mime: blob.type || (kind === "audio" ? "audio/mpeg" : "video/mp4"), size: blob.size, ts: Date.now() };
    let id = null;
    if (blob.size <= MEDIA_IDB_CAP && window.VFS && VFS.putBlob && window.indexedDB) { try { id = await VFS.putBlob(blob); } catch (e) { id = null; } }
    if (id) node.blob = id;
    else if (blob.size <= MEDIA_INLINE_CAP) node.src = await blobToDataURL(blob);
    else { const e = new Error("too big"); e.tooBig = true; throw e; }
    const kids = folder(dir, true);
    const finalName = uniqueName(kids, name);
    kids[finalName] = node;
    if (!trySave()) { delete kids[finalName]; trySave(); const e = new Error(quotaMsg()); e.quota = true; throw e; }
    vfsChanged();
    return { name: finalName, node, path: dir.concat(finalName) };
  }
  function download(blobOrUrl, filename) {
    const url = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    if (typeof blobOrUrl !== "string") setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function pickDevice(accept, multiple) {
    return new Promise((res) => {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = accept || ""; inp.multiple = !!multiple;
      inp.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(inp);
      inp.onchange = () => { const f = [...(inp.files || [])]; inp.remove(); res(f); };
      inp.click();
    });
  }
  function isTop(win) {
    if (!win || !win.isConnected || win.style.display === "none") return false;
    let max = -Infinity, top = null;
    document.querySelectorAll("#screen > .win").forEach((w) => { if (w.style.display === "none") return; const z = +w.style.zIndex || 0; if (z >= max) { max = z; top = w; } });
    return top === win;
  }
  function typingTarget(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }

  // ---- popover menus (fixed, above every window) ----
  let openPop = null;
  function closePop() { if (openPop) { const p = openPop; openPop = null; p.remove(); document.removeEventListener("pointerdown", outsidePop, true); } }
  function outsidePop(e) { if (openPop && !openPop.contains(e.target) && !(openPop.__anchor && openPop.__anchor.contains(e.target))) closePop(); }
  function popover(anchor, content, opts) {
    const same = openPop && openPop.__anchor === anchor; closePop(); if (same && !(opts && opts.force)) return null;
    const p = el(`<div class="cr-pop"></div>`); p.__anchor = anchor;
    if (document.body.classList.contains("dark")) p.classList.add("cr-dark");
    if (typeof content === "string") p.innerHTML = content; else p.appendChild(content);
    (document.getElementById("screen") || document.body).appendChild(p);
    const r = anchor.getBoundingClientRect(), pr = p.getBoundingClientRect();
    let left = r.left, top = r.bottom + 4;
    if (left + pr.width > innerWidth - 6) left = Math.max(6, innerWidth - pr.width - 6);
    if (top + pr.height > innerHeight - 6) top = Math.max(6, r.top - pr.height - 4);
    p.style.left = left + "px"; p.style.top = top + "px";
    openPop = p; setTimeout(() => document.addEventListener("pointerdown", outsidePop, true), 0);
    return p;
  }
  function menu(anchor, items) {
    const box = el(`<div class="cr-menu" role="menu"></div>`);
    items.forEach((it) => {
      if (!it) return;
      if (it.sep) { box.appendChild(el(`<div class="cr-menu-sep"></div>`)); return; }
      const b = el(`<button class="cr-menu-item${it.checked ? " on" : ""}" role="menuitem" ${it.disabled ? "disabled" : ""}><span class="cr-menu-ic">${it.icon ? ico(it.icon, 16) : it.checked ? ico("check", 16) : ""}</span><span class="cr-menu-l">${esc(it.label)}</span><span class="cr-menu-k">${esc(it.kbd || "")}</span></button>`);
      b.onclick = () => { closePop(); if (it.onClick) it.onClick(); };
      box.appendChild(b);
    });
    return popover(anchor, box);
  }
  // ---- small in-window dialogs ----
  function dialog(host, opts) {
    return new Promise((res) => {
      const ov = el(`<div class="cr-dlg-mask"><div class="cr-dlg" role="dialog"><h3>${esc(opts.title || "")}</h3><div class="cr-dlg-body"></div><div class="cr-dlg-btns"></div></div></div>`);
      const bodyEl = ov.querySelector(".cr-dlg-body"), btns = ov.querySelector(".cr-dlg-btns");
      if (typeof opts.body === "string") bodyEl.innerHTML = opts.body; else if (opts.body) bodyEl.appendChild(opts.body);
      const done = (v) => { ov.remove(); res(v); };
      (opts.buttons || [{ label: "OK", value: true, primary: true }]).forEach((b) => {
        const bt = el(`<button class="cr-btn${b.primary ? " cr-primary" : ""}">${esc(b.label)}</button>`);
        bt.onclick = () => done(typeof b.value === "function" ? b.value(ov) : b.value);
        btns.appendChild(bt);
      });
      ov.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done(opts.cancelValue != null ? opts.cancelValue : null); } if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); const p = btns.querySelector(".cr-primary"); if (p) p.click(); } });
      host.appendChild(ov);
      const f = ov.querySelector("input,select,textarea") || btns.querySelector(".cr-primary"); if (f) setTimeout(() => { f.focus(); if (f.select) f.select(); }, 30);
    });
  }
  function promptText(host, title, label, value, okLabel) {
    return dialog(host, { title, body: `<label class="cr-field"><span>${esc(label)}</span><input class="cr-input" value="${esc(value || "")}" maxlength="120"></label>`,
      buttons: [{ label: "Cancel", value: null }, { label: okLabel || "OK", primary: true, value: (ov) => ov.querySelector("input").value.trim() || null }] });
  }
  function confirmBox(host, title, msg, okLabel, danger) {
    return dialog(host, { title, body: `<p class="cr-dlg-msg">${esc(msg)}</p>`, buttons: [{ label: "Cancel", value: false }, { label: okLabel || "OK", primary: true, value: true }], cancelValue: false })
      .then((v) => !!v);
  }
  function alertBox(host, title, msg) { return dialog(host, { title, body: `<p class="cr-dlg-msg">${esc(msg)}</p>` }); }
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const ART_PAIRS = [["#ff6a88", "#ff99ac"], ["#5b8cff", "#a06bff"], ["#00b894", "#55efc4"], ["#fd7e14", "#ffc048"], ["#6c5ce7", "#00cec9"], ["#e84393", "#fd79a8"], ["#0984e3", "#74b9ff"], ["#2d3436", "#636e72"], ["#d63031", "#e17055"], ["#00a8ff", "#9c88ff"]];
  // Generated cover art: gradient + glyph, as a data URL (cached).
  const artCache = new Map();
  function artFor(seed, kind, size) {
    size = size || 256; const key = seed + "|" + kind + "|" + size;
    if (artCache.has(key)) return artCache.get(key);
    const pr = ART_PAIRS[hash(seed) % ART_PAIRS.length], c = mkCanvas(size, size), g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, size, size); gr.addColorStop(0, pr[0]); gr.addColorStop(1, pr[1]);
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    g.globalAlpha = 0.18; g.fillStyle = "#fff";
    const h = hash(seed + "x"); for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(((h >> (i * 4)) & 255) / 255 * size, ((h >> (i * 5 + 3)) & 255) / 255 * size, size * (0.18 + i * 0.08), 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 0.92; g.strokeStyle = "#fff"; g.fillStyle = "#fff"; g.lineWidth = size * 0.045; g.lineCap = "round"; g.lineJoin = "round";
    const s = size / 24; g.save(); g.translate(size * 0.25, size * 0.25); g.scale(s * 0.5, s * 0.5);
    if (kind === "video") { g.strokeRect(2, 5, 14, 14); g.beginPath(); g.moveTo(22, 8); g.lineTo(16, 12); g.lineTo(22, 16); g.closePath(); g.stroke(); }
    else { g.lineWidth = 1.8; g.beginPath(); g.moveTo(9, 18); g.lineTo(9, 5); g.lineTo(21, 3); g.lineTo(21, 16); g.stroke(); g.beginPath(); g.arc(6, 18, 3, 0, 7); g.fill(); g.beginPath(); g.arc(18, 16, 3, 0, 7); g.fill(); }
    g.restore();
    const url = c.toDataURL("image/png"); artCache.set(key, url); return url;
  }
  function fmtTime(s) { if (!isFinite(s) || s < 0) s = 0; s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); }
  function fmtSize(b) { return b < 1024 ? b + " B" : b < 1048576 ? Math.ceil(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB"; }
  function registerApp(entry, svg) {
    try {
      if (window.Catalog && !Catalog.storeApps.find((a) => a.id === entry.id)) Catalog.storeApps.push(entry);
      const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (!ex.includes(entry.id)) ex.push(entry.id);
      if (svg && window.Icon && Icon.register) Icon.register(entry.id, svg);
    } catch (e) {}
  }

  const CrKit = window.CrKit = {
    el, esc, clamp, ico, PATHS, filesRoot, folder, nodeAt, uniqueName, trySave, vfsChanged, notify, walk,
    isImage, mediaKind, nodeURL, toBlob, blobToDataURL, mkCanvas, fitCanvas, loadImage, saveImage, saveMedia,
    download, pickDevice, isTop, typingTarget, popover, closePop, menu, dialog, promptText, confirmBox, alertBox,
    hash, artFor, fmtTime, fmtSize, registerApp, MEDIA_IDB_CAP, MEDIA_INLINE_CAP, quotaMsg,
  };

  // Images / media opened from File Explorer go to Photos / Media Player (when those apps exist).
  try {
    if (window.VFS && VFS.openNode && !VFS.__crWrapped) {
      const orig = VFS.openNode.bind(VFS);
      VFS.openNode = function (name, node) {
        try {
          if (node && node.type === "file" && !node._loading) {
            const mk = mediaKind(name, node);
            if (mk && window.CrMedia && CrMedia.openNode) { CrMedia.openNode(name, node); return; }
            if (isImage(name, node) && window.CrPhotos && CrPhotos.openNode) { CrPhotos.openNode(name, node); return; }
          }
        } catch (e) {}
        return orig(name, node);
      };
      VFS.__crWrapped = true;
    }
  } catch (e) {}

  // ======================================================================
  // Paint
  // ======================================================================
  const PALETTE = ["#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27", "#fff200", "#22b14c", "#00a2e8", "#3f48cc", "#a349a4",
    "#ffffff", "#c3c3c3", "#b97a57", "#ffaec9", "#ffc90e", "#efe4b0", "#b5e61d", "#99d9ea", "#7092be", "#c8bfe7"];
  const BRUSHES = [["brush", "Brush"], ["calligraphy", "Calligraphy brush"], ["calligraphy2", "Calligraphy pen"], ["airbrush", "Airbrush"], ["oil", "Oil brush"], ["crayon", "Crayon"], ["marker", "Marker"], ["natural", "Natural pencil"], ["watercolor", "Watercolor brush"]];
  const SHAPES = ["line", "curve", "ellipse", "rect", "roundrect", "polygon", "triangle", "rtriangle", "diamond", "pentagon", "hexagon", "arrow", "arrowL", "arrowU", "arrowD", "star4", "star", "star6", "callout", "heart", "lightning"];
  const SHAPE_NAMES = { line: "Line", curve: "Curve", ellipse: "Oval", rect: "Rectangle", roundrect: "Rounded rectangle", polygon: "Polygon", triangle: "Triangle", rtriangle: "Right triangle", diamond: "Diamond", pentagon: "Pentagon", hexagon: "Hexagon", arrow: "Right arrow", arrowL: "Left arrow", arrowU: "Up arrow", arrowD: "Down arrow", star4: "Four-point star", star: "Five-point star", star6: "Six-point star", callout: "Speech bubble", heart: "Heart", lightning: "Lightning" };
  const FONTS = ["Segoe UI", "Arial", "Calibri", "Georgia", "Times New Roman", "Courier New", "Comic Sans MS", "Impact", "Verdana", "Trebuchet MS"];

  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function poly(g, pts) { pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); }
  function starPts(cx, cy, rx, ry, n, inner) { const pts = []; for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, k = i % 2 ? inner : 1; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); } return pts; }
  function ngon(cx, cy, rx, ry, n) { const pts = []; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return pts; }
  function shapePath(g, type, x0, y0, x1, y1, extra) {
    const x = Math.min(x0, x1), y = Math.min(y0, y1), w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), cx = x + w / 2, cy = y + h / 2;
    const U = (pts) => pts.map((p) => [x + p[0] * w, y + p[1] * h]);
    g.beginPath();
    switch (type) {
      case "line": g.moveTo(x0, y0); g.lineTo(x1, y1); break;
      case "curve": { const c = extra || { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }; g.moveTo(x0, y0); g.quadraticCurveTo(c.x, c.y, x1, y1); break; }
      case "rect": g.rect(x, y, w, h); break;
      case "roundrect": rr(g, x, y, w, h, Math.min(w, h) * 0.18); break;
      case "ellipse": g.ellipse(cx, cy, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2); break;
      case "polygon": poly(g, ngon(cx, cy, w / 2, h / 2, 7)); break;
      case "triangle": poly(g, U([[0.5, 0], [1, 1], [0, 1]])); break;
      case "rtriangle": poly(g, U([[0, 0], [1, 1], [0, 1]])); break;
      case "diamond": poly(g, U([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]])); break;
      case "pentagon": poly(g, ngon(cx, cy, w / 2, h / 2, 5)); break;
      case "hexagon": poly(g, U([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]])); break;
      case "arrow": poly(g, U([[0, 0.3], [0.6, 0.3], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.7], [0, 0.7]])); break;
      case "arrowL": poly(g, U([[1, 0.3], [0.4, 0.3], [0.4, 0], [0, 0.5], [0.4, 1], [0.4, 0.7], [1, 0.7]])); break;
      case "arrowU": poly(g, U([[0.3, 1], [0.3, 0.4], [0, 0.4], [0.5, 0], [1, 0.4], [0.7, 0.4], [0.7, 1]])); break;
      case "arrowD": poly(g, U([[0.3, 0], [0.3, 0.6], [0, 0.6], [0.5, 1], [1, 0.6], [0.7, 0.6], [0.7, 0]])); break;
      case "star4": poly(g, starPts(cx, cy, w / 2, h / 2, 4, 0.38)); break;
      case "star": poly(g, starPts(cx, cy + h * 0.05, w / 2, h / 1.9, 5, 0.42)); break;
      case "star6": poly(g, starPts(cx, cy, w / 2, h / 2, 6, 0.55)); break;
      case "callout": rr(g, x, y, w, h * 0.75, Math.min(w, h) * 0.12); g.moveTo(x + w * 0.22, y + h * 0.74); g.lineTo(x + w * 0.12, y + h); g.lineTo(x + w * 0.42, y + h * 0.74); break;
      case "heart":
        g.moveTo(cx, y + h * 0.28);
        g.bezierCurveTo(cx, y + h * 0.02, x, y - h * 0.02, x, y + h * 0.32);
        g.bezierCurveTo(x, y + h * 0.62, cx - w * 0.1, y + h * 0.78, cx, y + h);
        g.bezierCurveTo(cx + w * 0.1, y + h * 0.78, x + w, y + h * 0.62, x + w, y + h * 0.32);
        g.bezierCurveTo(x + w, y - h * 0.02, cx, y + h * 0.02, cx, y + h * 0.28); g.closePath(); break;
      case "lightning": poly(g, U([[0.38, 0], [0.62, 0.36], [0.5, 0.4], [0.8, 0.7], [0.68, 0.73], [1, 1], [0.45, 0.78], [0.57, 0.74], [0.2, 0.48], [0.33, 0.44], [0, 0.12]])); break;
      default: g.rect(x, y, w, h);
    }
  }
  function shapeSvg(type) {
    // tiny SVG previews for the shapes gallery
    const P = {
      line: "M4 20 20 4", curve: "M4 20Q4 4 20 4", ellipse: "M12 5a8 7 0 1 0 .01 0z", rect: "M4 6h16v12H4z", roundrect: "M7 6h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z",
      polygon: "M12 4l7 4 1 7-5 5H9l-5-5 1-7z", triangle: "M12 4l8 16H4z", rtriangle: "M4 4v16h16z", diamond: "M12 3l8 9-8 9-8-9z", pentagon: "M12 3l9 7-3 10H6L3 10z",
      hexagon: "M7 4h10l5 8-5 8H7l-5-8z", arrow: "M3 9h10V5l8 7-8 7v-4H3z", arrowL: "M21 9H11V5l-8 7 8 7v-4h10z", arrowU: "M9 21V11H5l7-8 7 8h-4v10z", arrowD: "M9 3v10H5l7 8 7-8h-4V3z",
      star4: "M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z", star: "M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z",
      star6: "M12 2l2.6 5.5H21l-3.6 4.5 3.6 4.5h-6.4L12 22l-2.6-5.5H3l3.6-4.5L3 7.5h6.4z", callout: "M6 4h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
      heart: PATHS.heart.match(/d="([^"]+)"/)[1], lightning: "M10 2l4 7-3 1 6 7-2 .5 3 4.5-9-6 3-.5L5 9l3-1z",
    };
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="${P[type] || P.rect}"/></svg>`;
  }
  const hexRgb = (h) => { h = String(h).replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0]; };
  const rgbHex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");

  AppRegistry.paint = function (opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const S = State.data; S.appData = S.appData || {};
    const prefs = S.appData.paint && typeof S.appData.paint === "object" ? S.appData.paint : (S.appData.paint = {});
    prefs.custom = Array.isArray(prefs.custom) ? prefs.custom : [];
    const ww = Math.min(1080, innerWidth - 24), wh = Math.min(740, innerHeight - 110);
    const wref = WM.createWindow({ title: "Untitled - Paint", icon: Icon.mini("paint", "Paint"), width: ww, height: wh, appId: "paint" });
    const body = wref.body, winEl = body.closest(".win");
    const setTitle = () => { const t = winEl.querySelector(".t-text"); if (t) t.textContent = (dirty ? "*" : "") + (fileName || "Untitled") + " - Paint"; };

    // ---------- document ----------
    let W = 1000, H = 640, layers = [], ai = 0, lid = 1;
    let zoom = 1, dirty = false, fileName = null, filePath = null;
    let tool = "brush", brush = prefs.brush || "brush", shape = "rect", outline = "solid", fillMode = "none";
    let size = clamp(+prefs.size || 4, 1, 100), c1 = prefs.c1 || "#000000", c2 = prefs.c2 || "#ffffff";
    let prevTool = "brush", selMode = "rect", font = { family: "Segoe UI", size: 28, bold: false, italic: false, underline: false, bg: false };
    const undoS = [], redoS = [];
    const newLayer = (name, bg) => { const c = mkCanvas(W, H); if (bg) { const g = c.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, W, H); } return { id: lid++, name, c, visible: true, opacity: 1 }; };
    const actx = () => layers[ai].c.getContext("2d");

    body.innerHTML = `<div class="cr-app cr-paint">
      <div class="cr-pt-menubar">
        <button class="cr-mb" data-menu="file">File</button><button class="cr-mb" data-menu="edit">Edit</button><button class="cr-mb" data-menu="view">View</button>
        <span class="cr-vsep"></span>
        <button class="cr-ib" data-act="save" title="Save (Ctrl+S)">${ico("save")}</button>
        <button class="cr-ib" data-act="undo" title="Undo (Ctrl+Z)">${ico("undo")}</button>
        <button class="cr-ib" data-act="redo" title="Redo (Ctrl+Y)">${ico("redo")}</button>
        <span class="cr-grow"></span>
        <button class="cr-ib cr-pt-layersbtn" data-act="layers" title="Layers">${ico("layers")}<span>Layers</span></button>
      </div>
      <div class="cr-pt-ribbon">
        <div class="cr-pt-grp"><div class="cr-pt-row">
            <button class="cr-pt-big" data-tool="select" title="Select">${ico("select", 22)}</button>
            <button class="cr-pt-caret" data-dd="select" title="Selection options">${ico("chevD", 14)}</button>
            <div class="cr-pt-col"><button class="cr-ib" data-act="crop" title="Crop to selection">${ico("crop")}</button><button class="cr-ib" data-act="resize" title="Resize and skew (Ctrl+W)">${ico("resize")}</button><button class="cr-ib" data-dd="rotate" title="Rotate / flip">${ico("rotate")}</button></div>
          </div><div class="cr-pt-lbl">Image</div></div>
        <div class="cr-pt-grp"><div class="cr-pt-tools">
            <button class="cr-ib" data-tool="pencil" title="Pencil">${ico("pencil")}</button>
            <button class="cr-ib" data-tool="fill" title="Fill with color">${ico("fill")}</button>
            <button class="cr-ib" data-tool="text" title="Text">${ico("text")}</button>
            <button class="cr-ib" data-tool="eraser" title="Eraser">${ico("eraser")}</button>
            <button class="cr-ib" data-tool="picker" title="Color picker">${ico("picker")}</button>
            <button class="cr-ib" data-tool="zoom" title="Magnifier">${ico("zoom")}</button>
          </div><div class="cr-pt-lbl">Tools</div></div>
        <div class="cr-pt-grp"><div class="cr-pt-row"><button class="cr-pt-big" data-tool="brush" title="Brushes">${ico("brush", 22)}</button><button class="cr-pt-caret" data-dd="brush" title="Brush type">${ico("chevD", 14)}</button></div><div class="cr-pt-lbl">Brushes</div></div>
        <div class="cr-pt-grp"><div class="cr-pt-row"><div class="cr-pt-shapes"></div>
            <div class="cr-pt-col"><button class="cr-ib cr-pt-wide" data-dd="outline" title="Shape outline">${ico("edit", 16)}<span>Outline</span></button><button class="cr-ib cr-pt-wide" data-dd="fill" title="Shape fill">${ico("fill", 16)}<span>Fill</span></button></div>
          </div><div class="cr-pt-lbl">Shapes</div></div>
        <div class="cr-pt-grp"><div class="cr-pt-row"><button class="cr-pt-big" data-dd="size" title="Size">${ico("size", 22)}</button></div><div class="cr-pt-lbl">Size</div></div>
        <div class="cr-pt-grp cr-pt-colors"><div class="cr-pt-row">
            <div class="cr-pt-cur"><button class="cr-pt-c1 on" title="Color 1 (left click / pen)"><i></i></button><button class="cr-pt-c2" title="Color 2 (right click, shape fill)"><i></i></button></div>
            <div class="cr-pt-pal"></div>
            <label class="cr-pt-edit" title="Edit colors"><span class="cr-pt-rainbow"></span><input type="color" class="cr-pt-colorin" value="#000000"></label>
          </div><div class="cr-pt-lbl">Colors</div></div>
      </div>
      <div class="cr-pt-main">
      <div class="cr-pt-textbar" hidden>
        <select class="cr-input cr-pt-font">${FONTS.map((f) => `<option${f === "Segoe UI" ? " selected" : ""}>${f}</option>`).join("")}</select>
        <select class="cr-input cr-pt-fsize">${[10, 12, 14, 18, 24, 28, 36, 48, 64, 72, 96].map((n) => `<option${n === 28 ? " selected" : ""}>${n}</option>`).join("")}</select>
        <button class="cr-ib" data-f="bold" title="Bold">${ico("bold")}</button><button class="cr-ib" data-f="italic" title="Italic">${ico("italic")}</button><button class="cr-ib" data-f="underline" title="Underline">${ico("underline")}</button>
        <label class="cr-check"><input type="checkbox" class="cr-pt-tbg"> Fill background (color 2)</label>
        <span class="cr-dim cr-pt-thint">Click outside the box to place text</span>
      </div>
        <div class="cr-pt-scroll"><div class="cr-pt-pad"><div class="cr-pt-stage">
          <canvas class="cr-pt-view"></canvas><canvas class="cr-pt-over"></canvas>
          <div class="cr-pt-h" data-h="r"></div><div class="cr-pt-h" data-h="b"></div><div class="cr-pt-h" data-h="br"></div>
        </div></div></div>
        <aside class="cr-pt-layers" hidden>
          <div class="cr-pt-lhead"><b>Layers</b><span class="cr-grow"></span><button class="cr-ib" data-l="add" title="Add layer">${ico("plus")}</button><button class="cr-ib" data-l="dup" title="Duplicate layer">${ico("copy")}</button><button class="cr-ib" data-l="del" title="Delete layer">${ico("trash")}</button></div>
          <div class="cr-pt-llist"></div>
          <div class="cr-pt-lfoot">
            <label class="cr-field cr-row"><span>Opacity</span><input type="range" class="cr-pt-lop" min="0" max="100" value="100"><output class="cr-pt-lopv">100%</output></label>
            <div class="cr-row"><button class="cr-ib" data-l="up" title="Move layer up">${ico("up")}</button><button class="cr-ib" data-l="down" title="Move layer down">${ico("down")}</button><button class="cr-btn cr-small" data-l="merge" title="Merge down">${ico("merge", 16)} Merge down</button></div>
          </div>
        </aside>
      </div>
      <div class="cr-pt-status">
        <span class="cr-pt-pos">${ico("move", 14)} <span>—</span></span><span class="cr-pt-sel">${ico("select", 14)} <span>—</span></span><span class="cr-pt-dim">${ico("image", 14)} <span></span></span>
        <span class="cr-grow"></span>
        <button class="cr-ib" data-act="zout" title="Zoom out">${ico("zoomout", 16)}</button><input type="range" class="cr-pt-zr" min="0" max="100" value="50"><button class="cr-ib" data-act="zin" title="Zoom in">${ico("zoom", 16)}</button>
        <button class="cr-pt-zv" data-act="zfit" title="Fit to window">100%</button>
      </div>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const scroll = $(".cr-pt-scroll"), stage = $(".cr-pt-stage"), view = $(".cr-pt-view"), over = $(".cr-pt-over");
    const vctx = view.getContext("2d"), octx = over.getContext("2d");
    const root = $(".cr-paint");

    // ---------- rendering ----------
    let raf = 0;
    function requestDraw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; composite(); }); }
    let strokeBuf = null, strokeAlpha = 1, strokeErase = false;
    function composite() {
      vctx.globalAlpha = 1; vctx.globalCompositeOperation = "source-over"; vctx.clearRect(0, 0, W, H);
      layers.forEach((L, i) => {
        if (!L.visible) return;
        if (i === ai && strokeBuf) {
          const t = mkTmp(); const tg = t.getContext("2d"); tg.clearRect(0, 0, W, H); tg.globalCompositeOperation = "source-over"; tg.globalAlpha = 1; tg.drawImage(L.c, 0, 0);
          tg.globalAlpha = strokeAlpha; tg.globalCompositeOperation = strokeErase ? "destination-out" : "source-over"; tg.drawImage(strokeBuf, 0, 0); tg.globalAlpha = 1; tg.globalCompositeOperation = "source-over";
          vctx.globalAlpha = L.opacity; vctx.drawImage(t, 0, 0);
        } else { vctx.globalAlpha = L.opacity; vctx.drawImage(L.c, 0, 0); }
      });
      vctx.globalAlpha = 1;
      drawOverlay();
    }
    let tmpC = null; function mkTmp() { if (!tmpC || tmpC.width !== W || tmpC.height !== H) tmpC = mkCanvas(W, H); return tmpC; }
    let antsOff = 0;
    function drawOverlay() {
      octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, W, H);
      const lw = Math.max(1, 1 / zoom);
      if (preview) preview(octx);
      if (sel) {
        if (sel.float) octx.drawImage(sel.float, sel.x, sel.y, sel.w, sel.h);
        octx.lineWidth = lw; octx.setLineDash([4 * lw, 4 * lw]);
        const trace = () => { octx.beginPath(); if (sel.path && !sel.float) { sel.path.forEach((p, i) => (i ? octx.lineTo(p[0], p[1]) : octx.moveTo(p[0], p[1]))); octx.closePath(); } else octx.rect(sel.x + lw / 2, sel.y + lw / 2, sel.w - lw, sel.h - lw); };
        octx.strokeStyle = "#fff"; octx.lineDashOffset = 0; trace(); octx.stroke();
        octx.strokeStyle = "#0067c0"; octx.lineDashOffset = 4 * lw; trace(); octx.stroke();
        octx.setLineDash([]);
      }
      if (lasso && lasso.length > 1) { octx.lineWidth = lw; octx.strokeStyle = "#0067c0"; octx.setLineDash([4 * lw, 3 * lw]); octx.beginPath(); lasso.forEach((p, i) => (i ? octx.lineTo(p[0], p[1]) : octx.moveTo(p[0], p[1]))); octx.stroke(); octx.setLineDash([]); }
    }
    let preview = null, sel = null, lasso = null;
    function applyZoom(z, keepCenter) {
      const old = zoom; zoom = clamp(z, 0.125, 8);
      const cx = scroll.scrollLeft + scroll.clientWidth / 2, cy = scroll.scrollTop + scroll.clientHeight / 2;
      stage.style.width = Math.round(W * zoom) + "px"; stage.style.height = Math.round(H * zoom) + "px";
      view.style.imageRendering = over.style.imageRendering = zoom >= 2 ? "pixelated" : "auto";
      if (keepCenter !== false) { scroll.scrollLeft = cx * zoom / old - scroll.clientWidth / 2; scroll.scrollTop = cy * zoom / old - scroll.clientHeight / 2; }
      $(".cr-pt-zv").textContent = Math.round(zoom * 100) + "%";
      $(".cr-pt-zr").value = Math.round((Math.log2(zoom) + 3) / 6 * 100);
      if (textBox) positionTextBox();
      requestDraw();
    }
    function fitZoom() { const z = Math.min((scroll.clientWidth - 48) / W, (scroll.clientHeight - 48) / H, 1); applyZoom(z > 0 ? z : 1, false); }
    function setDocSize(w, h) {
      W = Math.max(1, Math.round(w)); H = Math.max(1, Math.round(h));
      view.width = over.width = W; view.height = over.height = H;
      $(".cr-pt-dim span").textContent = W + " × " + H + "px";
      applyZoom(zoom, false);
    }

    // ---------- undo / redo (ImageData, not canvases: iPad caps canvas memory) ----------
    function snap(full, layerId) {
      const s = { W, H, ai, meta: layers.map((L) => ({ id: L.id, name: L.name, visible: L.visible, opacity: L.opacity })) };
      if (full) s.data = layers.map((L) => L.c.getContext("2d").getImageData(0, 0, W, H));
      else { const L = layers.find((l) => l.id === layerId) || layers[ai]; s.one = { id: L.id, data: L.c.getContext("2d").getImageData(0, 0, W, H) }; }
      return s;
    }
    function applySnap(s) {
      if (s.data) {
        W = s.W; H = s.H;
        layers = s.meta.map((m, i) => { const c = mkCanvas(W, H); c.getContext("2d").putImageData(s.data[i], 0, 0); return Object.assign({}, m, { c }); });
        setDocSize(W, H);
      } else {
        const L = layers.find((l) => l.id === s.one.id); if (L) L.c.getContext("2d").putImageData(s.one.data, 0, 0);
        s.meta.forEach((m) => { const L2 = layers.find((l) => l.id === m.id); if (L2) Object.assign(L2, { name: m.name, visible: m.visible, opacity: m.opacity }); });
      }
      ai = clamp(s.ai, 0, layers.length - 1);
      renderLayers(); requestDraw();
    }
    function pushUndo(full) {
      undoS.push(snap(!!full)); trimUndo(undoS);
      redoS.length = 0; markDirty(); updUndo();
    }
    // keep undo history inside a memory budget (iPad Safari kills tabs that use too much)
    const snapBytes = (x) => (x.data ? x.data.reduce((t, d) => t + d.data.length, 0) : x.one.data.data.length);
    function trimUndo(stack) { let tot = stack.reduce((t, x) => t + snapBytes(x), 0); while (stack.length > 1 && (stack.length > 30 || tot > 120e6)) tot -= snapBytes(stack.shift()); }
    function markDirty() { if (!dirty) { dirty = true; setTitle(); } }
    function undo() { commitText(); commitFloat(); const s = undoS.pop(); if (!s) return; redoS.push(snap(!!s.data, s.one && s.one.id)); applySnap(s); updUndo(); }
    function redo() { commitText(); commitFloat(); const s = redoS.pop(); if (!s) return; undoS.push(snap(!!s.data, s.one && s.one.id)); applySnap(s); updUndo(); }
    function updUndo() { $('[data-act="undo"]').disabled = !undoS.length; $('[data-act="redo"]').disabled = !redoS.length; }

    // ---------- layers panel ----------
    const llist = $(".cr-pt-llist");
    function renderLayers() {
      llist.innerHTML = "";
      for (let i = layers.length - 1; i >= 0; i--) {
        const L = layers[i];
        const row = el(`<div class="cr-pt-lrow${i === ai ? " on" : ""}" data-i="${i}"><button class="cr-ib cr-pt-leye" title="${L.visible ? "Hide" : "Show"} layer">${ico(L.visible ? "eye" : "eyeoff", 16)}</button><canvas class="cr-pt-lthumb" width="56" height="38"></canvas><span class="cr-pt-lname" title="Double-click to rename">${esc(L.name)}</span></div>`);
        const tg = row.querySelector("canvas").getContext("2d"); const k = Math.min(56 / W, 38 / H);
        tg.drawImage(L.c, (56 - W * k) / 2, (38 - H * k) / 2, W * k, H * k);
        row.onclick = (e) => { if (e.target.closest(".cr-pt-leye")) return; commitFloat(); ai = i; renderLayers(); };
        row.querySelector(".cr-pt-leye").onclick = () => { L.visible = !L.visible; renderLayers(); requestDraw(); markDirty(); };
        row.querySelector(".cr-pt-lname").ondblclick = async () => { const n = await promptText(root, "Rename layer", "Layer name", L.name, "Rename"); if (n) { L.name = n; renderLayers(); } };
        llist.appendChild(row);
      }
      const op = Math.round((layers[ai] ? layers[ai].opacity : 1) * 100);
      $(".cr-pt-lop").value = op; $(".cr-pt-lopv").textContent = op + "%";
      body.querySelector('[data-l="del"]').disabled = layers.length < 2;
      body.querySelector('[data-l="merge"]').disabled = ai === 0;
      body.querySelector('[data-l="up"]').disabled = ai >= layers.length - 1;
      body.querySelector('[data-l="down"]').disabled = ai === 0;
    }
    let thumbT = 0; function refreshThumbs() { clearTimeout(thumbT); thumbT = setTimeout(() => { if (!$(".cr-pt-layers").hidden) renderLayers(); }, 250); }
    function layerAct(a) {
      commitText(); commitFloat();
      if (a === "add") { pushUndo(true); layers.splice(ai + 1, 0, newLayer("Layer " + (layers.length + 1))); ai++; }
      else if (a === "dup") { pushUndo(true); const L = layers[ai], n = newLayer(L.name + " copy"); n.c.getContext("2d").drawImage(L.c, 0, 0); n.opacity = L.opacity; layers.splice(ai + 1, 0, n); ai++; }
      else if (a === "del") { if (layers.length < 2) return; pushUndo(true); layers.splice(ai, 1); ai = Math.max(0, ai - 1); }
      else if (a === "up") { if (ai >= layers.length - 1) return; pushUndo(true); [layers[ai], layers[ai + 1]] = [layers[ai + 1], layers[ai]]; ai++; }
      else if (a === "down") { if (ai === 0) return; pushUndo(true); [layers[ai], layers[ai - 1]] = [layers[ai - 1], layers[ai]]; ai--; }
      else if (a === "merge") {
        if (ai === 0) return; pushUndo(true);
        const top = layers[ai], below = layers[ai - 1], g = below.c.getContext("2d");
        if (top.visible) { g.globalAlpha = top.opacity; g.drawImage(top.c, 0, 0); g.globalAlpha = 1; }
        layers.splice(ai, 1); ai--;
      }
      renderLayers(); requestDraw();
    }
    body.querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => layerAct(b.dataset.l)));
    let opUndo = false;
    $(".cr-pt-lop").addEventListener("pointerdown", () => { opUndo = false; });
    $(".cr-pt-lop").oninput = (e) => { if (!opUndo) { pushUndo(true); opUndo = true; } layers[ai].opacity = +e.target.value / 100; $(".cr-pt-lopv").textContent = e.target.value + "%"; requestDraw(); };
    $(".cr-pt-lop").onchange = () => { opUndo = false; renderLayers(); };

    // ---------- colors ----------
    let activeSlot = 1;
    function paintColors() {
      $(".cr-pt-c1 i").style.background = c1; $(".cr-pt-c2 i").style.background = c2;
      $(".cr-pt-c1").classList.toggle("on", activeSlot === 1); $(".cr-pt-c2").classList.toggle("on", activeSlot === 2);
      const pal = $(".cr-pt-pal"); pal.innerHTML = "";
      PALETTE.concat(prefs.custom.slice(0, 10)).forEach((col) => {
        const b = el(`<button class="cr-pt-sw" style="background:${col}" title="${col}"></button>`);
        b.onclick = () => setColor(col); b.oncontextmenu = (e) => { e.preventDefault(); c2 = col; savePrefs(); paintColors(); };
        pal.appendChild(b);
      });
      for (let i = prefs.custom.length; i < 10; i++) pal.appendChild(el(`<span class="cr-pt-sw cr-empty"></span>`));
      $(".cr-pt-colorin").value = activeSlot === 1 ? c1 : c2;
      if (textBox) textBox.style.color = c1;
    }
    function setColor(col) { if (activeSlot === 1) c1 = col; else c2 = col; savePrefs(); paintColors(); }
    function savePrefs() { prefs.c1 = c1; prefs.c2 = c2; prefs.size = size; prefs.brush = brush; try { State.save(); } catch (e) {} }
    $(".cr-pt-c1").onclick = () => { activeSlot = 1; paintColors(); };
    $(".cr-pt-c2").onclick = () => { activeSlot = 2; paintColors(); };
    $(".cr-pt-colorin").addEventListener("change", (e) => {
      const v = e.target.value; setColor(v);
      if (!PALETTE.includes(v) && !prefs.custom.includes(v)) { prefs.custom.unshift(v); prefs.custom = prefs.custom.slice(0, 10); savePrefs(); paintColors(); }
    });
    $(".cr-pt-colorin").addEventListener("input", (e) => { if (activeSlot === 1) c1 = e.target.value; else c2 = e.target.value; $(".cr-pt-c1 i").style.background = c1; $(".cr-pt-c2 i").style.background = c2; });

    // ---------- shapes gallery ----------
    const shapesBox = $(".cr-pt-shapes");
    SHAPES.forEach((s) => { const b = el(`<button class="cr-pt-shape" data-shape="${s}" title="${SHAPE_NAMES[s]}">${shapeSvg(s)}</button>`); b.onclick = () => { shape = s; setTool("shape"); }; shapesBox.appendChild(b); });

    // ---------- tools ----------
    function setTool(t) {
      if (t !== tool && tool !== "picker" && tool !== "zoom") prevTool = tool;
      if (t !== "text") commitText();
      if (t !== "select") commitFloat();
      if (t === "shape") commitCurve();
      tool = t; preview = null; lasso = null;
      body.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
      body.querySelectorAll(".cr-pt-shape").forEach((b) => b.classList.toggle("on", t === "shape" && b.dataset.shape === shape));
      $(".cr-pt-textbar").hidden = t !== "text";
      stage.dataset.tool = t;
      requestDraw();
    }
    body.querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));

    // dropdowns
    function ddSelect(a) {
      menu(a, [
        { label: "Rectangle selection", icon: "select", checked: selMode === "rect", onClick: () => { selMode = "rect"; setTool("select"); } },
        { label: "Free-form selection", icon: "freeform", checked: selMode === "free", onClick: () => { selMode = "free"; setTool("select"); } },
        { sep: true },
        { label: "Select all", kbd: "Ctrl+A", onClick: selectAll },
        { label: "Copy", icon: "copy", kbd: "Ctrl+C", disabled: !sel, onClick: copySel },
        { label: "Cut", icon: "cut", kbd: "Ctrl+X", disabled: !sel, onClick: cutSel },
        { label: "Paste", icon: "paste", kbd: "Ctrl+V", disabled: !clip, onClick: pasteClip },
        { label: "Delete selection", icon: "trash", kbd: "Del", disabled: !sel, onClick: deleteSel },
        { label: "Crop to selection", icon: "crop", disabled: !sel, onClick: cropSel },
      ]);
    }
    function ddRotate(a) {
      menu(a, [
        { label: "Rotate right 90°", icon: "rotate", onClick: () => transformImage("r90") },
        { label: "Rotate left 90°", icon: "rotL", onClick: () => transformImage("l90") },
        { label: "Rotate 180°", onClick: () => transformImage("r180") },
        { sep: true },
        { label: "Flip vertical", icon: "flipV", onClick: () => transformImage("fv") },
        { label: "Flip horizontal", icon: "flipH", onClick: () => transformImage("fh") },
      ]);
    }
    function ddBrush(a) { menu(a, BRUSHES.map(([k, n]) => ({ label: n, checked: brush === k, onClick: () => { brush = k; savePrefs(); setTool("brush"); } }))); }
    function ddOutline(a) { menu(a, [{ label: "No outline", checked: outline === "none", onClick: () => (outline = "none") }, { label: "Solid color (color 1)", checked: outline === "solid", onClick: () => (outline = "solid") }, { label: "Dashed", checked: outline === "dash", onClick: () => (outline = "dash") }]); }
    function ddFill(a) { menu(a, [{ label: "No fill", checked: fillMode === "none", onClick: () => (fillMode = "none") }, { label: "Solid color (color 2)", checked: fillMode === "solid", onClick: () => (fillMode = "solid") }]); }
    function ddSize(a) {
      const box = el(`<div class="cr-pt-sizepop"><div class="cr-row"><input type="range" min="1" max="100" value="${size}" class="cr-grow"><output>${size}px</output></div><div class="cr-pt-sizelist"></div></div>`);
      const r = box.querySelector("input"), out = box.querySelector("output");
      r.oninput = () => { size = +r.value; out.textContent = size + "px"; savePrefs(); };
      [1, 3, 5, 8, 12, 20, 32, 48].forEach((n) => { const b = el(`<button class="cr-pt-sizeopt${n === size ? " on" : ""}"><i style="height:${Math.min(n, 24)}px"></i><span>${n}px</span></button>`); b.onclick = () => { size = n; savePrefs(); closePop(); }; box.querySelector(".cr-pt-sizelist").appendChild(b); });
      popover(a, box);
    }
    body.querySelectorAll("[data-dd]").forEach((b) => (b.onclick = () => ({ select: ddSelect, rotate: ddRotate, brush: ddBrush, outline: ddOutline, fill: ddFill, size: ddSize })[b.dataset.dd](b)));

    // ---------- menus ----------
    body.querySelectorAll("[data-menu]").forEach((b) => (b.onclick = () => {
      const m = b.dataset.menu;
      if (m === "file") menu(b, [
        { label: "New", icon: "newdoc", kbd: "Ctrl+N", onClick: newDoc },
        { label: "Open…", icon: "open", kbd: "Ctrl+O", onClick: openDialog },
        { sep: true },
        { label: "Save", icon: "save", kbd: "Ctrl+S", onClick: () => saveDoc(false) },
        { label: "Save as… (PNG in Pictures)", kbd: "Ctrl+Shift+S", onClick: () => saveDoc(true) },
        { label: "Export / download PNG", icon: "download", onClick: exportPNG },
        { sep: true },
        { label: "Image properties…", icon: "info", kbd: "Ctrl+E", onClick: propsDialog },
        { label: "Exit", onClick: () => wref.close() },
      ]);
      else if (m === "edit") menu(b, [
        { label: "Undo", icon: "undo", kbd: "Ctrl+Z", disabled: !undoS.length, onClick: undo },
        { label: "Redo", icon: "redo", kbd: "Ctrl+Y", disabled: !redoS.length, onClick: redo },
        { sep: true },
        { label: "Cut", icon: "cut", kbd: "Ctrl+X", disabled: !sel, onClick: cutSel },
        { label: "Copy", icon: "copy", kbd: "Ctrl+C", disabled: !sel, onClick: copySel },
        { label: "Paste", icon: "paste", kbd: "Ctrl+V", disabled: !clip, onClick: pasteClip },
        { label: "Select all", kbd: "Ctrl+A", onClick: selectAll },
        { label: "Delete", icon: "trash", kbd: "Del", disabled: !sel, onClick: deleteSel },
        { sep: true },
        { label: "Resize and skew…", icon: "resize", kbd: "Ctrl+W", onClick: resizeDialog },
        { label: "Clear layer", onClick: () => { commitFloat(); pushUndo(); clearRegion(actx(), (g) => g.rect(0, 0, W, H)); requestDraw(); refreshThumbs(); } },
      ]);
      else menu(b, [
        { label: "Zoom in", icon: "zoom", kbd: "Ctrl+Plus", onClick: () => applyZoom(zoom * 1.25) },
        { label: "Zoom out", icon: "zoomout", kbd: "Ctrl+Minus", onClick: () => applyZoom(zoom / 1.25) },
        { label: "100%", kbd: "Ctrl+0", onClick: () => applyZoom(1) },
        { label: "Fit to window", icon: "fit", onClick: fitZoom },
        { sep: true },
        { label: "Layers panel", icon: "layers", checked: !$(".cr-pt-layers").hidden, onClick: toggleLayers },
      ]);
    }));
    function toggleLayers() { const p = $(".cr-pt-layers"); p.hidden = !p.hidden; $(".cr-pt-layersbtn").classList.toggle("on", !p.hidden); if (!p.hidden) renderLayers(); }
    $('[data-act="layers"]').onclick = toggleLayers;
    $('[data-act="save"]').onclick = () => saveDoc(false);
    $('[data-act="undo"]').onclick = undo; $('[data-act="redo"]').onclick = redo;
    $('[data-act="crop"]').onclick = cropSel; $('[data-act="resize"]').onclick = resizeDialog;
    $('[data-act="zin"]').onclick = () => applyZoom(zoom * 1.25); $('[data-act="zout"]').onclick = () => applyZoom(zoom / 1.25);
    $('[data-act="zfit"]').onclick = () => (Math.abs(zoom - 1) < 0.01 ? fitZoom() : applyZoom(1));
    $(".cr-pt-zr").oninput = (e) => applyZoom(Math.pow(2, +e.target.value / 100 * 6 - 3));

    // ---------- pointer → document coords ----------
    function pt(e) { const r = view.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
    const pressureOf = (e) => (e.pointerType === "pen" ? clamp(e.pressure || 0.5, 0.05, 1) : 1);
    const widthFor = (e) => (e.pointerType === "pen" ? Math.max(0.6, size * (0.25 + pressureOf(e) * 1.1)) : size);

    // ---------- brush engine ----------
    let stroke = null, sprayT = 0;
    function beginStroke(e, p, color) {
      const g = actx(), erase = tool === "eraser";
      stroke = { last: p, color, g, erase, kind: tool === "pencil" ? "pencil" : erase ? "eraser" : brush, w: widthFor(e), seed: Math.random() * 1000 };
      strokeBuf = null; strokeAlpha = 1; strokeErase = false;
      if (stroke.kind === "marker" || stroke.kind === "watercolor") { strokeBuf = mkCanvas(W, H); strokeAlpha = stroke.kind === "marker" ? 0.45 : 0.75; stroke.g = strokeBuf.getContext("2d"); }
      if (erase && ai > 0) stroke.g.globalCompositeOperation = "destination-out";
      if (stroke.kind === "oil") { stroke.bristles = []; for (let i = 0; i < 9; i++) stroke.bristles.push([(Math.random() - 0.5), (Math.random() - 0.5), 0.35 + Math.random() * 0.5]); }
      dab(p, p, e);
      if (stroke.kind === "airbrush") { clearInterval(sprayT); sprayT = setInterval(() => { if (stroke) { spray(stroke.last, stroke.w); requestDraw(); } }, 40); }
    }
    function spray(p, w) { const g = stroke.g; g.fillStyle = stroke.color; const r = w * 1.6, n = Math.ceil(w * 1.4); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r; g.fillRect(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1, 1); } }
    function dab(a, b, e) {
      const s = stroke, g = s.g, w = e ? widthFor(e) : s.w; s.w = w;
      const col = s.erase ? (ai > 0 ? "#000" : c2) : s.color;
      g.strokeStyle = col; g.fillStyle = col; g.lineCap = "round"; g.lineJoin = "round";
      const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
      switch (s.kind) {
        case "pencil": g.lineCap = "square"; g.lineWidth = Math.max(1, w / 2); line(g, a, b); break;
        case "eraser": g.lineCap = "square"; g.lineWidth = Math.max(2, w * 2); line(g, a, b); break;
        case "brush": g.lineWidth = w; line(g, a, b); break;
        case "calligraphy": case "calligraphy2": {
          const ang = s.kind === "calligraphy" ? -Math.PI / 4 : Math.PI / 4, nx = Math.cos(ang) * w * 0.9, ny = Math.sin(ang) * w * 0.9;
          g.beginPath(); g.moveTo(a.x - nx, a.y - ny); g.lineTo(a.x + nx, a.y + ny); g.lineTo(b.x + nx, b.y + ny); g.lineTo(b.x - nx, b.y - ny); g.closePath(); g.fill();
          g.lineWidth = 1; g.beginPath(); g.moveTo(b.x - nx, b.y - ny); g.lineTo(b.x + nx, b.y + ny); g.stroke(); break;
        }
        case "airbrush": { const steps = Math.max(1, Math.ceil(dist / Math.max(2, w / 2))); for (let i = 1; i <= steps; i++) spray({ x: a.x + dx * i / steps, y: a.y + dy * i / steps }, w); break; }
        case "oil": { const nx = -dy / (dist || 1), ny = dx / (dist || 1); g.lineWidth = Math.max(1, w / 4); s.bristles.forEach((br) => { g.globalAlpha = br[2]; const ox = (br[0] * nx + br[1] * ny * 0.3) * w * 1.2, oy = (br[0] * ny - br[1] * nx * 0.3) * w * 1.2; g.beginPath(); g.moveTo(a.x + ox, a.y + oy); g.lineTo(b.x + ox, b.y + oy); g.stroke(); }); g.globalAlpha = 1; break; }
        case "crayon": { const steps = Math.max(1, Math.ceil(dist)); g.globalAlpha = 0.55; for (let i = 0; i <= steps; i++) { const px = a.x + dx * i / steps, py = a.y + dy * i / steps; for (let k = 0; k < Math.max(3, w * 0.9); k++) { if (Math.random() < 0.45) continue; const ang = Math.random() * 6.283, d = Math.random() * w / 2; g.fillRect(px + Math.cos(ang) * d, py + Math.sin(ang) * d, 1.2, 1.2); } } g.globalAlpha = 1; break; }
        case "marker": g.lineCap = "square"; g.lineWidth = w * 1.6; line(g, a, b); break;
        case "natural": { g.globalAlpha = 0.7; g.lineWidth = Math.max(1, w * 0.45); line(g, a, b); g.globalAlpha = 0.35; const steps = Math.ceil(dist / 2); for (let i = 0; i <= steps; i++) g.fillRect(a.x + dx * i / (steps || 1) + (Math.random() - 0.5) * w * 0.6, a.y + dy * i / (steps || 1) + (Math.random() - 0.5) * w * 0.6, 1, 1); g.globalAlpha = 1; break; }
        case "watercolor": { const step = Math.max(1, w / 4), steps = Math.max(1, Math.ceil(dist / step)); const [r, gg, bb] = hexRgb(col); for (let i = 0; i <= steps; i++) { const px = a.x + dx * i / steps, py = a.y + dy * i / steps, rad = w * (0.9 + Math.random() * 0.3); const gr = g.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, `rgba(${r},${gg},${bb},0.16)`); gr.addColorStop(1, `rgba(${r},${gg},${bb},0)`); g.fillStyle = gr; g.beginPath(); g.arc(px, py, rad, 0, 6.283); g.fill(); } break; }
        default: g.lineWidth = w; line(g, a, b);
      }
    }
    function line(g, a, b) { g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x + (a.x === b.x && a.y === b.y ? 0.01 : 0), b.y); g.stroke(); }
    function moveStroke(e) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      (evs && evs.length ? evs : [e]).forEach((ev) => { const p = pt(ev); dab(stroke.last, p, ev); stroke.last = p; });
      requestDraw();
    }
    function endStroke() {
      clearInterval(sprayT);
      if (!stroke) return;
      if (strokeBuf) { const g = actx(); g.globalAlpha = strokeAlpha; g.drawImage(strokeBuf, 0, 0); g.globalAlpha = 1; strokeBuf = null; }
      actx().globalCompositeOperation = "source-over";
      stroke = null; requestDraw(); refreshThumbs();
    }
    function clearRegion(g, pathFn) {
      g.save(); g.beginPath(); pathFn(g);
      if (ai === 0) { g.fillStyle = c2; g.fill(); } else { g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000"; g.fill(); }
      g.restore();
    }

    // ---------- fill ----------
    function floodFill(x, y, hex) {
      x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
      const g = actx(), img = g.getImageData(0, 0, W, H), d = img.data;
      const [fr, fg, fb] = hexRgb(hex), i0 = (y * W + x) * 4, tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], ta = d[i0 + 3];
      if (tr === fr && tg === fg && tb === fb && ta === 255) return;
      const tol = 48, seen = new Uint8Array(W * H);
      const match = (p) => { const q = p * 4; return !seen[p] && Math.abs(d[q] - tr) <= tol && Math.abs(d[q + 1] - tg) <= tol && Math.abs(d[q + 2] - tb) <= tol && Math.abs(d[q + 3] - ta) <= tol; };
      pushUndo();
      const stack = [x, y];
      while (stack.length) {
        const cy = stack.pop(), cx = stack.pop(); if (!match(cy * W + cx)) continue;
        let lx = cx, rx = cx;
        while (lx > 0 && match(cy * W + lx - 1)) lx--;
        while (rx < W - 1 && match(cy * W + rx + 1)) rx++;
        for (let i = lx; i <= rx; i++) { const p = cy * W + i, q = p * 4; seen[p] = 1; d[q] = fr; d[q + 1] = fg; d[q + 2] = fb; d[q + 3] = 255; }
        for (const ny of [cy - 1, cy + 1]) {
          if (ny < 0 || ny >= H) continue; let inSpan = false;
          for (let i = lx; i <= rx; i++) { const ok = match(ny * W + i); if (ok && !inSpan) { stack.push(i, ny); inSpan = true; } else if (!ok) inSpan = false; }
        }
      }
      g.putImageData(img, 0, 0); requestDraw(); refreshThumbs();
    }

    // ---------- shapes ----------
    let curve = null; // { a, b, ctrl, stage }
    function strokeShape(g, type, a, b, extra) {
      g.save(); g.lineJoin = "round"; g.lineCap = "round";
      shapePath(g, type, a.x, a.y, b.x, b.y, extra);
      if (fillMode === "solid" && type !== "line" && type !== "curve") { g.fillStyle = c2; g.fill(); }
      if (outline !== "none" || type === "line" || type === "curve") { g.strokeStyle = c1; g.lineWidth = size; if (outline === "dash") g.setLineDash([size * 3, size * 2]); g.stroke(); }
      g.restore();
    }
    function commitCurve() { if (curve) { pushUndo(); strokeShape(actx(), "curve", curve.a, curve.b, curve.ctrl); curve = null; preview = null; requestDraw(); refreshThumbs(); } }
    function constrain(a, b, e) {
      if (!e.shiftKey) return b;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (shape === "line") { const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), d = Math.hypot(dx, dy); return { x: a.x + Math.cos(ang) * d, y: a.y + Math.sin(ang) * d }; }
      const m = Math.max(Math.abs(dx), Math.abs(dy)); return { x: a.x + Math.sign(dx || 1) * m, y: a.y + Math.sign(dy || 1) * m };
    }

    // ---------- selection ----------
    let clip = null, drag = null;
    function selBounds(path) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; path.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
    function extract(s) {
      const c = mkCanvas(s.w, s.h), g = c.getContext("2d");
      g.drawImage(layers[ai].c, -s.x, -s.y);
      if (s.path) { g.globalCompositeOperation = "destination-in"; g.beginPath(); s.path.forEach((p, i) => (i ? g.lineTo(p[0] - s.x, p[1] - s.y) : g.moveTo(p[0] - s.x, p[1] - s.y))); g.closePath(); g.fill(); }
      return c;
    }
    function selPathFn(s) { return (g) => { if (s.path) { s.path.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); } else g.rect(s.x, s.y, s.w, s.h); }; }
    function lift(copyOnly) { if (!sel || sel.float) return; pushUndo(); sel.float = extract(sel); if (!copyOnly) clearRegion(actx(), selPathFn(sel)); requestDraw(); }
    function commitFloat() {
      if (!sel) return;
      if (sel.float) { const g = actx(); g.drawImage(sel.float, sel.x, sel.y, sel.w, sel.h); refreshThumbs(); }
      sel = null; requestDraw(); updSel();
    }
    function selectAll() { commitText(); commitFloat(); setTool("select"); sel = { x: 0, y: 0, w: W, h: H, path: null }; updSel(); requestDraw(); }
    function copySel() {
      if (!sel) return; clip = sel.float ? (() => { const c = mkCanvas(sel.w, sel.h); c.getContext("2d").drawImage(sel.float, 0, 0, sel.w, sel.h); return c; })() : extract(sel);
      try { if (navigator.clipboard && window.ClipboardItem) clip.toBlob((b) => { try { navigator.clipboard.write([new ClipboardItem({ "image/png": b })]).catch(() => {}); } catch (e) {} }); } catch (e) {}
    }
    function deleteSel() { if (!sel) return; if (!sel.float) { pushUndo(); clearRegion(actx(), selPathFn(sel)); } sel = null; updSel(); requestDraw(); refreshThumbs(); }
    function cutSel() { copySel(); deleteSel(); }
    function pasteClip(src) {
      const c = src || clip; if (!c) return;
      commitText(); commitFloat(); setTool("select"); pushUndo();
      if (c.width > W || c.height > H) { // grow the canvas like Paint does
        const nw = Math.max(W, c.width), nh = Math.max(H, c.height); resizeCanvasRaw(nw, nh);
      }
      const x = clamp(Math.round(scroll.scrollLeft / zoom), 0, Math.max(0, W - c.width)), y = clamp(Math.round(scroll.scrollTop / zoom), 0, Math.max(0, H - c.height));
      const f = mkCanvas(c.width, c.height); f.getContext("2d").drawImage(c, 0, 0);
      sel = { x, y, w: c.width, h: c.height, path: null, float: f }; updSel(); requestDraw();
    }
    function cropSel() {
      if (!sel) { notify("Paint", "Select an area first, then choose Crop."); return; }
      const s = { x: Math.round(sel.x), y: Math.round(sel.y), w: Math.round(sel.w), h: Math.round(sel.h) };
      if (sel.float) commitFloat(); else sel = null;
      pushUndo(true);
      layers.forEach((L) => { const c = mkCanvas(s.w, s.h); c.getContext("2d").drawImage(L.c, -s.x, -s.y); L.c = c; });
      setDocSize(s.w, s.h); updSel(); renderLayers(); requestDraw();
    }
    function updSel() { $(".cr-pt-sel span").textContent = sel ? Math.round(sel.w) + " × " + Math.round(sel.h) + "px" : "—"; }
    function inSel(p) { return sel && p.x >= sel.x && p.y >= sel.y && p.x <= sel.x + sel.w && p.y <= sel.y + sel.h; }

    // ---------- whole-image / selection transforms ----------
    function xform(c, kind, sx, sy, kx, ky) {
      let nc;
      if (kind === "r90" || kind === "l90") { nc = mkCanvas(c.height, c.width); const g = nc.getContext("2d"); g.translate(nc.width / 2, nc.height / 2); g.rotate(kind === "r90" ? Math.PI / 2 : -Math.PI / 2); g.drawImage(c, -c.width / 2, -c.height / 2); }
      else if (kind === "r180" || kind === "fh" || kind === "fv") { nc = mkCanvas(c.width, c.height); const g = nc.getContext("2d"); g.translate(nc.width / 2, nc.height / 2); if (kind === "r180") g.rotate(Math.PI); else g.scale(kind === "fh" ? -1 : 1, kind === "fv" ? -1 : 1); g.drawImage(c, -c.width / 2, -c.height / 2); }
      else { // resize + skew
        const a = sx, b = sx * Math.tan(ky * Math.PI / 180), cc = sy * Math.tan(kx * Math.PI / 180), d = sy;
        const pts = [[0, 0], [c.width, 0], [0, c.height], [c.width, c.height]].map(([x, y]) => [a * x + cc * y, b * x + d * y]);
        const minX = Math.min(...pts.map((p) => p[0])), minY = Math.min(...pts.map((p) => p[1])), maxX = Math.max(...pts.map((p) => p[0])), maxY = Math.max(...pts.map((p) => p[1]));
        nc = mkCanvas(Math.min(4096, maxX - minX), Math.min(4096, maxY - minY)); const g = nc.getContext("2d"); g.imageSmoothingQuality = "high";
        g.setTransform(a, b, cc, d, -minX, -minY); g.drawImage(c, 0, 0);
      }
      nc.getContext("2d").setTransform(1, 0, 0, 1, 0, 0); // later strokes must not inherit the rotation
      return nc;
    }
    function transformImage(kind, sx, sy, kx, ky) {
      commitText();
      if (sel) {
        if (!sel.float) lift(false); else pushUndo();
        const f = xform(sel.float, kind, sx, sy, kx, ky); const cx = sel.x + sel.w / 2, cy = sel.y + sel.h / 2;
        sel.float = f; sel.w = f.width; sel.h = f.height; sel.x = Math.round(cx - f.width / 2); sel.y = Math.round(cy - f.height / 2); sel.path = null;
        updSel(); requestDraw(); return;
      }
      pushUndo(true);
      layers.forEach((L, i) => { let c = xform(L.c, kind, sx, sy, kx, ky); if (i === 0 && kind === "rs") { const b = mkCanvas(c.width, c.height), g = b.getContext("2d"); g.fillStyle = c2; g.fillRect(0, 0, b.width, b.height); g.drawImage(c, 0, 0); c = b; } L.c = c; });
      setDocSize(layers[0].c.width, layers[0].c.height); renderLayers(); requestDraw();
    }
    function resizeDialog() {
      commitText();
      const b = el(`<div class="cr-form">
        <div class="cr-row"><label class="cr-check"><input type="radio" name="u" value="pct" checked> Percentage</label><label class="cr-check"><input type="radio" name="u" value="px"> Pixels</label></div>
        <label class="cr-field"><span>Horizontal</span><input class="cr-input" data-k="h" type="number" value="100" min="1"></label>
        <label class="cr-field"><span>Vertical</span><input class="cr-input" data-k="v" type="number" value="100" min="1"></label>
        <label class="cr-check"><input type="checkbox" data-k="keep" checked> Maintain aspect ratio</label>
        <h4>Skew (degrees)</h4>
        <label class="cr-field"><span>Horizontal</span><input class="cr-input" data-k="kx" type="number" value="0" min="-89" max="89"></label>
        <label class="cr-field"><span>Vertical</span><input class="cr-input" data-k="ky" type="number" value="0" min="-89" max="89"></label>
        <p class="cr-dim">${sel ? "Applies to the selection." : "Applies to the whole image (all layers)."}</p></div>`);
      const bw = sel ? sel.w : W, bh = sel ? sel.h : H;
      const q = (k) => b.querySelector(`[data-k="${k}"]`); const unit = () => b.querySelector('input[name="u"]:checked').value;
      b.querySelectorAll('input[name="u"]').forEach((r) => (r.onchange = () => { const px = unit() === "px"; q("h").value = px ? Math.round(bw) : 100; q("v").value = px ? Math.round(bh) : 100; }));
      q("h").oninput = () => { if (q("keep").checked) q("v").value = unit() === "px" ? Math.round(+q("h").value * bh / bw) : q("h").value; };
      q("v").oninput = () => { if (q("keep").checked) q("h").value = unit() === "px" ? Math.round(+q("v").value * bw / bh) : q("v").value; };
      dialog(root, { title: "Resize and Skew", body: b, buttons: [{ label: "Cancel", value: null }, { label: "OK", primary: true, value: () => ({ u: unit(), h: +q("h").value, v: +q("v").value, kx: +q("kx").value, ky: +q("ky").value }) }] }).then((r) => {
        if (!r || !(r.h > 0) || !(r.v > 0)) return;
        const sx = r.u === "px" ? r.h / bw : r.h / 100, sy = r.u === "px" ? r.v / bh : r.v / 100;
        transformImage("rs", clamp(sx, 0.01, 20), clamp(sy, 0.01, 20), clamp(r.kx || 0, -89, 89), clamp(r.ky || 0, -89, 89));
      });
    }
    function resizeCanvasRaw(nw, nh) {
      nw = clamp(Math.round(nw), 1, 4096); nh = clamp(Math.round(nh), 1, 4096);
      layers.forEach((L, i) => { const c = mkCanvas(nw, nh), g = c.getContext("2d"); if (i === 0) { g.fillStyle = c2; g.fillRect(0, 0, nw, nh); g.clearRect(0, 0, Math.min(nw, W), Math.min(nh, H)); } g.drawImage(L.c, 0, 0); L.c = c; });
      setDocSize(nw, nh); renderLayers(); requestDraw();
    }
    function resizeCanvas(nw, nh) { commitText(); commitFloat(); pushUndo(true); resizeCanvasRaw(nw, nh); }
    function propsDialog() {
      const b = el(`<div class="cr-form"><label class="cr-field"><span>Width (px)</span><input class="cr-input" data-k="w" type="number" min="1" max="4096" value="${W}"></label><label class="cr-field"><span>Height (px)</span><input class="cr-input" data-k="h" type="number" min="1" max="4096" value="${H}"></label><p class="cr-dim">Changes the canvas size without stretching the picture (like dragging the canvas handles).</p></div>`);
      dialog(root, { title: "Image properties", body: b, buttons: [{ label: "Cancel", value: null }, { label: "OK", primary: true, value: () => [+b.querySelector('[data-k="w"]').value, +b.querySelector('[data-k="h"]').value] }] })
        .then((r) => { if (r && r[0] > 0 && r[1] > 0 && (r[0] !== W || r[1] !== H)) resizeCanvas(r[0], r[1]); });
    }

    // ---------- text tool ----------
    let textBox = null, textAt = null;
    function fontCss(px) { return `${font.italic ? "italic " : ""}${font.bold ? "bold " : ""}${px}px "${font.family}", sans-serif`; }
    function positionTextBox() {
      if (!textBox) return; const lh = font.size * 1.25;
      Object.assign(textBox.style, { left: textAt.x * zoom + "px", top: textAt.y * zoom + "px", font: fontCss(font.size * zoom), lineHeight: lh * zoom + "px", color: c1, textDecoration: font.underline ? "underline" : "none", background: font.bg ? c2 : "transparent" });
      const g = vctx; g.save(); g.font = fontCss(font.size); const lines = textBox.value.split("\n"); const mw = Math.max(40, ...lines.map((l) => g.measureText(l).width)); g.restore();
      textBox.style.width = Math.ceil(mw * zoom + font.size * zoom) + "px"; textBox.style.height = Math.ceil(lines.length * lh * zoom + 4) + "px";
    }
    function startText(p) {
      commitText(); textAt = { x: Math.round(p.x), y: Math.round(p.y) };
      textBox = el(`<textarea class="cr-pt-textbox" spellcheck="false" wrap="off"></textarea>`);
      stage.appendChild(textBox); positionTextBox();
      textBox.addEventListener("input", positionTextBox);
      textBox.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); cancelText(); } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitText(); } e.stopPropagation(); });
      try { textBox.focus({ preventScroll: true }); } catch (e) {}
      setTimeout(() => textBox && document.activeElement !== textBox && textBox.focus(), 0);
    }
    function cancelText() { if (textBox) { textBox.remove(); textBox = null; } }
    function commitText() {
      if (!textBox) return; const txt = textBox.value; cancelText();
      if (!txt.trim()) return;
      pushUndo(); const g = actx(), lh = font.size * 1.25, lines = txt.split("\n");
      g.save(); g.font = fontCss(font.size); g.textBaseline = "top";
      const off = (lh - font.size) / 2 + 1;
      lines.forEach((ln, i) => {
        const y = textAt.y + i * lh, w = g.measureText(ln).width;
        if (font.bg) { g.fillStyle = c2; g.fillRect(textAt.x, y, w + 2, lh); }
        g.fillStyle = c1; g.fillText(ln, textAt.x + 1, y + off);
        if (font.underline) g.fillRect(textAt.x + 1, y + off + font.size * 1.02, w, Math.max(1, font.size / 15));
      });
      g.restore(); requestDraw(); refreshThumbs();
    }
    $(".cr-pt-font").onchange = (e) => { font.family = e.target.value; positionTextBox(); };
    $(".cr-pt-fsize").onchange = (e) => { font.size = +e.target.value; positionTextBox(); };
    $(".cr-pt-tbg").onchange = (e) => { font.bg = e.target.checked; positionTextBox(); };
    body.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { font[b.dataset.f] = !font[b.dataset.f]; b.classList.toggle("on", font[b.dataset.f]); positionTextBox(); if (textBox) textBox.focus(); }));

    // ---------- pointer handling (mouse, touch, Apple Pencil) ----------
    const touches = new Map(); let gesture = null, downAt = 0;
    stage.addEventListener("contextmenu", (e) => e.preventDefault());
    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".cr-pt-textbox") || e.target.closest(".cr-pt-h")) return;
      closePop();
      if (e.pointerType === "touch") {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) { // second finger: pinch-zoom / pan instead of drawing
          if (action) { if (Date.now() - downAt < 350) cancelAction(); else endAction(e); }
          const [a, b] = [...touches.values()];
          gesture = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, sl: scroll.scrollLeft, st: scroll.scrollTop };
          return;
        }
        if (touches.size > 2) return;
      }
      if (e.button === 1) return;
      e.preventDefault();
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      downAt = Date.now();
      startAction(e);
      if (action) action.pid = e.pointerId;
    });
    stage.addEventListener("pointermove", (e) => {
      const p = pt(e);
      $(".cr-pt-pos span").textContent = (p.x >= 0 && p.y >= 0 && p.x < W && p.y < H) ? Math.floor(p.x) + ", " + Math.floor(p.y) + "px" : "—";
      if (e.pointerType === "touch" && touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (gesture && touches.size >= 2) {
          const [a, b] = [...touches.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
          applyZoom(gesture.z * d / Math.max(10, gesture.d));
          scroll.scrollLeft = gesture.sl - ((a.x + b.x) / 2 - gesture.mx); scroll.scrollTop = gesture.st - ((a.y + b.y) / 2 - gesture.my);
          return;
        }
      }
      if (action) { if (action.pid == null || action.pid === e.pointerId) moveAction(e); }
      else if (tool === "select") stage.style.cursor = inSel(p) ? "move" : "crosshair";
    });
    const endPtr = (e) => {
      if (e.pointerType === "touch") { touches.delete(e.pointerId); if (touches.size < 2) gesture = null; }
      if (action && (action.pid == null || action.pid === e.pointerId)) endAction(e);
    };
    stage.addEventListener("pointerup", endPtr);
    stage.addEventListener("pointercancel", (e) => { if (e.pointerType === "touch") touches.delete(e.pointerId); if (action) endAction(e); });
    scroll.addEventListener("wheel", (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); applyZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); } }, { passive: false });
    scroll.addEventListener("pointerdown", (e) => { if (e.target === scroll || e.target.classList.contains("cr-pt-pad")) { commitText(); commitFloat(); commitCurve(); } });

    let action = null;
    function cancelAction() {
      clearInterval(sprayT);
      if (action && action.undoLen != null && undoS.length > action.undoLen) { const s = undoS.pop(); applySnap(s); updUndo(); }
      stroke = null; strokeBuf = null; action = null; preview = null; lasso = null; requestDraw();
    }
    function startAction(e) {
      const p = pt(e), right = e.button === 2;
      const color = right ? c2 : c1;
      if (tool !== "text" && textBox) { commitText(); return; }
      if (tool === "pencil" || tool === "brush" || tool === "eraser") {
        if (!layers[ai].visible) { notify("Paint", "This layer is hidden. Show it in the Layers panel to draw on it."); return; }
        action = { kind: "stroke", undoLen: undoS.length }; pushUndo(); beginStroke(e, p, color); requestDraw();
      } else if (tool === "fill") floodFill(p.x, p.y, color);
      else if (tool === "picker") {
        const px = vctx.getImageData(clamp(Math.floor(p.x), 0, W - 1), clamp(Math.floor(p.y), 0, H - 1), 1, 1).data;
        const hx = px[3] ? rgbHex(px[0], px[1], px[2]) : "#ffffff";
        if (right) c2 = hx; else c1 = hx; savePrefs(); paintColors(); setTool(prevTool || "brush");
      } else if (tool === "zoom") { applyZoom(zoom * (right ? 1 / 1.6 : 1.6)); }
      else if (tool === "text") { if (textBox) { commitText(); return; } startText(p); }
      else if (tool === "shape") {
        if (curve && curve.stage === 1) { action = { kind: "curvebend" }; curve.ctrl = p; preview = (g) => strokeShape(g, "curve", curve.a, curve.b, curve.ctrl); requestDraw(); return; }
        action = { kind: "shape", a: p, b: p };
      } else if (tool === "select") {
        if (sel && inSel(p)) { if (!sel.float) lift(e.ctrlKey || e.altKey); else if (e.ctrlKey || e.altKey) { const g = actx(); g.drawImage(sel.float, sel.x, sel.y, sel.w, sel.h); } action = { kind: "move", ox: p.x - sel.x, oy: p.y - sel.y }; return; }
        commitFloat();
        action = selMode === "free" ? { kind: "lasso" } : { kind: "rsel", a: p };
        if (selMode === "free") lasso = [[p.x, p.y]];
      }
    }
    function moveAction(e) {
      const p = pt(e);
      if (action.kind === "stroke") moveStroke(e);
      else if (action.kind === "shape") { action.b = constrain(action.a, p, e); const a = action.a, b = action.b; preview = (g) => strokeShape(g, shape, a, b); requestDraw(); }
      else if (action.kind === "curvebend") { curve.ctrl = p; requestDraw(); }
      else if (action.kind === "rsel") { const a = action.a; const x = clamp(Math.min(a.x, p.x), 0, W), y = clamp(Math.min(a.y, p.y), 0, H); sel = { x: Math.round(x), y: Math.round(y), w: Math.round(clamp(Math.max(a.x, p.x), 0, W) - x), h: Math.round(clamp(Math.max(a.y, p.y), 0, H) - y), path: null }; updSel(); requestDraw(); }
      else if (action.kind === "lasso") { lasso.push([clamp(p.x, 0, W), clamp(p.y, 0, H)]); requestDraw(); }
      else if (action.kind === "move") { sel.x = Math.round(p.x - action.ox); sel.y = Math.round(p.y - action.oy); requestDraw(); }
    }
    function endAction(e) {
      const a = action; action = null;
      if (a.kind === "stroke") endStroke();
      else if (a.kind === "shape") {
        preview = null;
        if (Math.hypot(a.b.x - a.a.x, a.b.y - a.a.y) < 2) { requestDraw(); return; }
        if (shape === "curve") { curve = { a: a.a, b: a.b, ctrl: null, stage: 1 }; preview = (g) => strokeShape(g, "curve", curve.a, curve.b, curve.ctrl || undefined); requestDraw(); return; }
        pushUndo(); strokeShape(actx(), shape, a.a, a.b); requestDraw(); refreshThumbs();
      } else if (a.kind === "curvebend") commitCurve();
      else if (a.kind === "rsel") { if (sel && (sel.w < 2 || sel.h < 2)) sel = null; updSel(); requestDraw(); }
      else if (a.kind === "lasso") { const path = lasso; lasso = null; if (path.length > 3) { const b = selBounds(path); if (b.w > 2 && b.h > 2) sel = Object.assign(b, { path }); } updSel(); requestDraw(); }
    }

    // ---------- canvas resize handles ----------
    stage.querySelectorAll(".cr-pt-h").forEach((h) => {
      h.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation(); commitText(); commitFloat();
        try { h.setPointerCapture(e.pointerId); } catch (_) {}
        const mode = h.dataset.h, sx = e.clientX, sy = e.clientY;
        const ghost = el(`<div class="cr-pt-ghost"></div>`); stage.appendChild(ghost);
        let nw = W, nh = H;
        const mv = (ev) => {
          if (mode !== "b") nw = Math.max(1, Math.round(W + (ev.clientX - sx) / zoom));
          if (mode !== "r") nh = Math.max(1, Math.round(H + (ev.clientY - sy) / zoom));
          ghost.style.width = nw * zoom + "px"; ghost.style.height = nh * zoom + "px";
          $(".cr-pt-dim span").textContent = nw + " × " + nh + "px";
        };
        const up = () => { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); ghost.remove(); if (nw !== W || nh !== H) resizeCanvas(nw, nh); else $(".cr-pt-dim span").textContent = W + " × " + H + "px"; };
        h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
        mv(e);
      });
    });

    // ---------- file operations ----------
    function flatten(bg) {
      const c = mkCanvas(W, H), g = c.getContext("2d");
      if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
      layers.forEach((L) => { if (!L.visible) return; g.globalAlpha = L.opacity; g.drawImage(L.c, 0, 0); });
      g.globalAlpha = 1; if (sel && sel.float) g.drawImage(sel.float, sel.x, sel.y, sel.w, sel.h);
      return c;
    }
    function resetDoc(w, h, img) {
      commitText(); sel = null; curve = null; preview = null; undoS.length = 0; redoS.length = 0;
      W = w; H = h; lid = 1; layers = [newLayer("Background", "#ffffff")]; ai = 0;
      if (img) layers[0].c.getContext("2d").drawImage(img, 0, 0, w, h);
      setDocSize(W, H); fitZoom(); renderLayers(); updUndo(); updSel(); requestDraw();
      dirty = false; setTitle();
    }
    async function askSaveChanges() {
      if (!dirty) return true;
      const r = await dialog(root, { title: "Paint", body: `<p class="cr-dlg-msg">Do you want to save your work${fileName ? " to " + esc(fileName) : ""}?</p>`, buttons: [{ label: "Cancel", value: "cancel" }, { label: "Don't save", value: "no" }, { label: "Save", value: "yes", primary: true }], cancelValue: "cancel" });
      if (r === "cancel" || r == null) return false;
      if (r === "yes") return await saveDoc(false);
      return true;
    }
    async function newDoc() { if (!(await askSaveChanges())) return; fileName = null; filePath = null; resetDoc(1000, 640); }
    async function openImage(url, name, path) {
      try {
        const img = await loadImage(url);
        let w = img.naturalWidth, h = img.naturalHeight; const k = Math.min(1, 2048 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
        resetDoc(w, h, img); fileName = name || "Untitled"; filePath = path || null; dirty = false; setTitle();
      } catch (e) { alertBox(root, "Paint", "This picture couldn't be opened."); }
    }
    async function openDialog() {
      if (!(await askSaveChanges())) return;
      const items = []; ["Pictures", "Desktop", "Downloads"].forEach((f) => walk([f], (n, name, path) => { if (isImage(name, n)) items.push({ n, name, path }); }));
      items.sort((a, b) => (b.n.ts || 0) - (a.n.ts || 0));
      const box = el(`<div class="cr-opendlg"><div class="cr-row"><button class="cr-btn cr-primary cr-od-dev">${ico("upload", 16)} Browse this device…</button><span class="cr-dim">or pick a picture from Pictures, Desktop or Downloads:</span></div><div class="cr-od-grid"></div></div>`);
      const grid = box.querySelector(".cr-od-grid");
      if (!items.length) grid.appendChild(el(`<p class="cr-dim">No pictures yet. Save a drawing or import photos in Photos.</p>`));
      let pick = null;
      const pr = dialog(root, { title: "Open", body: box, buttons: [{ label: "Cancel", value: null }] });
      items.slice(0, 120).forEach((it) => {
        const b = el(`<button class="cr-od-item" title="${esc(it.path.join(" › "))}"><span class="cr-od-th">${it.n.src ? `<img src="${esc(it.n.src)}" alt="">` : ico("image", 28)}</span><span class="cr-od-nm">${esc(it.name)}</span></button>`);
        b.onclick = () => { pick = it; box.closest(".cr-dlg-mask").querySelector(".cr-dlg-btns .cr-btn").click(); };
        grid.appendChild(b);
      });
      box.querySelector(".cr-od-dev").onclick = async () => {
        box.closest(".cr-dlg-mask").querySelector(".cr-dlg-btns .cr-btn").click();
        const [f] = await pickDevice("image/*"); if (!f) return;
        const u = URL.createObjectURL(f); await openImage(u, f.name.replace(/\.[^.]+$/, "") + ".png", null); setTimeout(() => URL.revokeObjectURL(u), 5000);
      };
      await pr;
      if (pick) { const u = await nodeURL(pick.n); if (u) openImage(u, pick.name, pick.path); }
    }
    async function saveDoc(as) {
      commitText();
      let dir = ["Pictures"], name = fileName;
      const overwrite = !as && filePath && /\.png$/i.test(fileName || "") && nodeAt(filePath);
      if (overwrite) dir = filePath.slice(0, -1);
      else {
        const def = (fileName || "Untitled").replace(/\.[^.]+$/, "");
        const n = await promptText(root, "Save as", "File name (saved as PNG in Pictures)", def, "Save"); if (!n) return false;
        name = n.replace(/[\\/:*?"<>|]/g, "_").replace(/\.(png|jpe?g|bmp|gif)$/i, "") + ".png";
      }
      try {
        const r = await saveImage(dir, name, flatten("#ffffff"), { overwrite: !!overwrite });
        fileName = r.name; filePath = r.path; dirty = false; setTitle();
        notify("Paint", "Saved " + r.name + " to " + r.path.slice(0, -1).join(" › ") + ".", "paint");
        return true;
      } catch (e) { await alertBox(root, "Couldn't save", e.quota ? e.message : "Saving failed: " + (e.message || e)); return false; }
    }
    function exportPNG() { flatten("#ffffff").toBlob((b) => { if (b) download(b, (fileName || "Untitled").replace(/\.[^.]+$/, "") + ".png"); }, "image/png"); }

    // ---------- keyboard + clipboard ----------
    const onKey = (e) => {
      if (!isTop(winEl)) return;
      if (typingTarget(e.target) && !e.target.closest(".cr-paint")) return;
      if (typingTarget(e.target)) return; // text box / dialog inputs handle themselves
      const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      if (mod && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (mod && k === "s") { e.preventDefault(); saveDoc(e.shiftKey); }
      else if (mod && k === "o") { e.preventDefault(); openDialog(); }
      else if (mod && k === "n") { e.preventDefault(); newDoc(); }
      else if (mod && k === "a") { e.preventDefault(); selectAll(); }
      else if (mod && k === "c") { if (sel) { e.preventDefault(); copySel(); } }
      else if (mod && k === "x") { if (sel) { e.preventDefault(); cutSel(); } }
      else if (mod && k === "e") { e.preventDefault(); propsDialog(); }
      else if (mod && k === "w") { e.preventDefault(); resizeDialog(); }
      else if (mod && (k === "=" || k === "+")) { e.preventDefault(); applyZoom(zoom * 1.25); }
      else if (mod && k === "-") { e.preventDefault(); applyZoom(zoom / 1.25); }
      else if (mod && k === "0") { e.preventDefault(); applyZoom(1); }
      else if (k === "delete" || k === "backspace") { if (sel) { e.preventDefault(); deleteSel(); } }
      else if (k === "escape") { if (curve) { curve = null; preview = null; requestDraw(); } else commitFloat(); }
      else if (k === "enter") { commitFloat(); commitCurve(); }
    };
    const onPaste = (e) => {
      if (!isTop(winEl) || typingTarget(e.target)) return;
      const items = [...((e.clipboardData && e.clipboardData.items) || [])].filter((i) => /^image\//.test(i.type));
      if (!items.length) { if (clip) { e.preventDefault(); pasteClip(); } return; }
      e.preventDefault(); const f = items[0].getAsFile(); const u = URL.createObjectURL(f);
      loadImage(u).then((img) => { const c = mkCanvas(img.naturalWidth, img.naturalHeight); c.getContext("2d").drawImage(img, 0, 0); clip = c; pasteClip(); URL.revokeObjectURL(u); }).catch(() => {});
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    const antsT = setInterval(() => { if (sel && !action) { antsOff = (antsOff + 1) % 8; } }, 300);
    winEl.addEventListener("wm-cleanup", () => { window.removeEventListener("keydown", onKey); window.removeEventListener("paste", onPaste); clearInterval(antsT); clearInterval(sprayT); closePop(); });

    // ---------- start ----------
    paintColors(); updUndo(); updSel();
    resetDoc(1000, 640);
    setTool("brush");
    requestAnimationFrame(fitZoom);
    if (o.open && o.open.url) openImage(o.open.url, o.open.name, o.open.path);

    // test / automation hook
    winEl.__paint = { get W() { return W; }, get H() { return H; }, get layers() { return layers; }, setTool: (t) => setTool(t), setColor: (c) => { c1 = c; paintColors(); }, setSize: (s) => { size = s; }, setBrush: (b) => { brush = b; }, setShape: (s) => { shape = s; }, saveDoc, flatten, undo, redo, layerAct, selectAll };
  };

  // ======================================================================
  // Paint 3D (three.js from the CDN — needs internet)
  // ======================================================================
  registerApp({ id: "paint3d", name: "Paint 3D", cat: "Multimedia", price: 0, builtin: "paint3d", desc: "Make simple 3D scenes — add shapes, colour them, move, rotate and scale, then save a picture to Pictures." });

  AppRegistry.paint3d = function () {
    const wref = WM.createWindow({ title: "Paint 3D", icon: Icon.mini("paint3d", "Paint 3D"), width: Math.min(1040, innerWidth - 24), height: Math.min(700, innerHeight - 110), appId: "paint3d" });
    const body = wref.body, winEl = body.closest(".win");
    body.innerHTML = `<div class="cr-app cr-p3"><div class="cr-p3-wait"><div class="cr-spin"></div><p>Loading the 3D engine…</p></div></div>`;
    const host = body.querySelector(".cr-p3");
    let built = false, timer = 0, cleanup = null;
    const onReady = () => { if (window.THREE) start(); };
    window.addEventListener("three-ready", onReady);
    winEl.addEventListener("wm-cleanup", () => { window.removeEventListener("three-ready", onReady); clearTimeout(timer); if (cleanup) cleanup(); });
    function start() { if (built || !body.isConnected) return; built = true; clearTimeout(timer); try { cleanup = build3D(window.THREE, host, winEl); } catch (e) { built = false; offline("The 3D view couldn't start on this device (" + (e.message || e) + ")."); } }
    function offline(msg) {
      if (built) return;
      host.innerHTML = `<div class="cr-p3-off"><div class="cr-p3-offic">${ico("cube", 56)}</div><h2>Paint 3D needs the internet</h2>
        <p>${esc(msg || "The 3D engine (three.js) loads from the web, and this device looks offline. Everything else — including 2D Paint — works without a connection.")}</p>
        <div class="cr-row cr-center"><button class="cr-btn cr-primary cr-p3-retry">${ico("refresh", 16)} Try again</button><button class="cr-btn cr-p3-2d">${ico("brush", 16)} Open Paint</button></div></div>`;
      host.querySelector(".cr-p3-retry").onclick = retry;
      host.querySelector(".cr-p3-2d").onclick = () => WM.open("paint");
    }
    function retry() {
      if (window.THREE) return start();
      host.innerHTML = `<div class="cr-p3-wait"><div class="cr-spin"></div><p>Connecting…</p></div>`;
      try {
        import("https://unpkg.com/three@0.160.0/build/three.module.js").then((m) => {
          if (!window.THREE) { window.THREE = m; window.__threeReady = true; try { window.dispatchEvent(new Event("three-ready")); } catch (e) {} }
          start();
        }).catch(() => offline());
      } catch (e) { offline(); }
    }
    if (window.THREE) start();
    else { retry(); timer = setTimeout(() => offline(), 15000); } // same URL as the page's import map, so one shared instance
  };

  function build3D(THREE, host, winEl) {
    const S = State.data; S.appData = S.appData || {};
    const saved = S.appData.paint3d && Array.isArray(S.appData.paint3d.objects) ? S.appData.paint3d : (S.appData.paint3d = { objects: [], bg: "#dfe7f2" });
    host.innerHTML = `<div class="cr-p3-top">
        <span class="cr-p3-title">${ico("cube", 18)} 3D shapes</span>
        ${["cube", "sphere", "cylinder", "cone", "torus"].map((s) => `<button class="cr-btn cr-small" data-add="${s}">${ico("plus", 14)} ${s[0].toUpperCase() + s.slice(1)}</button>`).join("")}
        <span class="cr-grow"></span>
        <button class="cr-btn cr-small" data-a="view">${ico("refresh", 14)} Reset view</button>
        <button class="cr-btn cr-small cr-primary" data-a="snap">${ico("camera", 14)} Save picture</button>
      </div>
      <div class="cr-p3-main"><div class="cr-p3-view"><div class="cr-p3-hint">Drag empty space to orbit · scroll or pinch to zoom · drag a shape (or its arrows) to move it</div></div>
        <aside class="cr-p3-side">
          <div class="cr-p3-none cr-dim">Add a shape, or tap one in the scene to edit it.</div>
          <div class="cr-p3-props" hidden>
            <h4>Selected <span class="cr-p3-selname"></span></h4>
            <div class="cr-p3-modes"><button class="cr-ib on" data-mode="move" title="Move">${ico("move")}</button><button class="cr-ib" data-mode="rotate" title="Rotate">${ico("rotate")}</button><button class="cr-ib" data-mode="scale" title="Scale">${ico("scale")}</button></div>
            <label class="cr-field"><span>Colour</span><span class="cr-row"><input type="color" class="cr-p3-col"><span class="cr-p3-sw"></span></span></label>
            <label class="cr-field"><span>Material</span><select class="cr-input cr-p3-mat"><option value="matte">Matte</option><option value="gloss">Gloss</option><option value="metal">Metal</option><option value="glass">Glass</option><option value="glow">Glow</option></select></label>
            <div class="cr-p3-sliders"></div>
            <div class="cr-row"><button class="cr-btn cr-small" data-a="dup">${ico("copy", 14)} Duplicate</button><button class="cr-btn cr-small" data-a="del">${ico("trash", 14)} Delete</button></div>
          </div>
          <hr>
          <label class="cr-field"><span>Background</span><input type="color" class="cr-p3-bg" value="${esc(saved.bg || "#dfe7f2")}"></label>
          <label class="cr-check"><input type="checkbox" class="cr-p3-grid" checked> Show grid</label>
        </aside></div>`;
    const viewEl = host.querySelector(".cr-p3-view");
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    viewEl.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene(); scene.background = new THREE.Color(saved.bg || "#dfe7f2");
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(5, 9, 6); scene.add(sun);
    const grid = new THREE.GridHelper(20, 20, 0x8899aa, 0xb8c2d0); scene.add(grid);
    const orbit = { theta: 0.8, phi: 1.05, r: 11, target: new THREE.Vector3(0, 0.6, 0) };
    function placeCam() { const o = orbit; camera.position.set(o.target.x + o.r * Math.sin(o.phi) * Math.sin(o.theta), o.target.y + o.r * Math.cos(o.phi), o.target.z + o.r * Math.sin(o.phi) * Math.cos(o.theta)); camera.lookAt(o.target); need = true; }
    let need = true, raf = 0, alive = true;
    const GEOS = {
      cube: () => new THREE.BoxGeometry(1.4, 1.4, 1.4), sphere: () => new THREE.SphereGeometry(0.85, 40, 24), cylinder: () => new THREE.CylinderGeometry(0.7, 0.7, 1.6, 40),
      cone: () => new THREE.ConeGeometry(0.85, 1.7, 40), torus: () => new THREE.TorusGeometry(0.75, 0.28, 24, 64),
    };
    function material(kind, color) {
      const c = new THREE.Color(color);
      if (kind === "gloss") return new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0.05 });
      if (kind === "metal") return new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.65 });
      if (kind === "glass") return new THREE.MeshStandardMaterial({ color: c, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 });
      if (kind === "glow") return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.8, roughness: 0.5 });
      return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 });
    }
    const objects = [];
    function addShape(d) {
      const m = new THREE.Mesh(GEOS[d.type](), material(d.mat || "matte", d.color));
      m.userData = { type: d.type, color: d.color, mat: d.mat || "matte" };
      m.position.fromArray(d.pos || [((objects.length % 5) - 2) * 1.9 + (Math.random() - 0.5) * 0.4, d.type === "torus" ? 0.75 : 0.85, (Math.random() - 0.5) * 2.4]);
      m.rotation.set(...(d.rot || [0, 0, 0])); m.scale.fromArray(d.scale || [1, 1, 1]);
      scene.add(m); objects.push(m); return m;
    }
    const COLORS = ["#ff5a5f", "#3d8bfd", "#2ecc71", "#ffb400", "#9b59b6", "#00bcd4", "#ff7aa8"];
    saved.objects.forEach((d) => { if (GEOS[d.type]) addShape(d); });
    let saveT = 0;
    function persist() { clearTimeout(saveT); saveT = setTimeout(() => { saved.objects = objects.map((m) => ({ type: m.userData.type, color: m.userData.color, mat: m.userData.mat, pos: m.position.toArray().map((v) => +v.toFixed(3)), rot: [m.rotation.x, m.rotation.y, m.rotation.z].map((v) => +v.toFixed(3)), scale: m.scale.toArray().map((v) => +v.toFixed(3)) })); try { State.save(); } catch (e) {} }, 400); }

    // selection + gizmo (axis arrows you can drag)
    let selObj = null, mode = "move";
    const box = new THREE.BoxHelper(undefined, 0x0067c0); box.visible = false; scene.add(box);
    const gizmo = new THREE.Group(); scene.add(gizmo); gizmo.visible = false;
    const axes = [["x", new THREE.Vector3(1, 0, 0), 0xe53935], ["y", new THREE.Vector3(0, 1, 0), 0x43a047], ["z", new THREE.Vector3(0, 0, 1), 0x1e88e5]].map(([n, dir, col]) => {
      const a = new THREE.ArrowHelper(dir, new THREE.Vector3(), 1.8, col, 0.45, 0.28);
      [a.line, a.cone].forEach((p) => { p.material.depthTest = false; p.renderOrder = 999; p.userData.axis = n; });
      a.cone.scale.multiplyScalar(1.4); gizmo.add(a); return { n, dir, a };
    });
    function select(m) {
      selObj = m; box.visible = !!m; gizmo.visible = !!m && mode === "move";
      if (m) { box.setFromObject(m); gizmo.position.copy(m.position); }
      host.querySelector(".cr-p3-props").hidden = !m; host.querySelector(".cr-p3-none").hidden = !!m;
      if (m) { host.querySelector(".cr-p3-selname").textContent = m.userData.type; host.querySelector(".cr-p3-col").value = m.userData.color; host.querySelector(".cr-p3-mat").value = m.userData.mat; buildSliders(); }
      need = true;
    }
    const SL = [["px", "Position X", -8, 8, 0.05], ["py", "Position Y", -2, 8, 0.05], ["pz", "Position Z", -8, 8, 0.05], ["rx", "Rotate X", -180, 180, 1], ["ry", "Rotate Y", -180, 180, 1], ["rz", "Rotate Z", -180, 180, 1], ["s", "Size", 0.2, 4, 0.05], ["sx", "Stretch X", 0.2, 4, 0.05], ["sy", "Stretch Y", 0.2, 4, 0.05], ["sz", "Stretch Z", 0.2, 4, 0.05]];
    const getV = (k) => { const m = selObj; return { px: m.position.x, py: m.position.y, pz: m.position.z, rx: m.rotation.x * 57.2958, ry: m.rotation.y * 57.2958, rz: m.rotation.z * 57.2958, s: (m.scale.x + m.scale.y + m.scale.z) / 3, sx: m.scale.x, sy: m.scale.y, sz: m.scale.z }[k]; };
    function setV(k, v) {
      const m = selObj; if (!m) return;
      if (k[0] === "p") m.position[k[1]] = v; else if (k[0] === "r") m.rotation[k[1]] = v / 57.2958;
      else if (k === "s") { const cur = getV("s") || 1; m.scale.multiplyScalar(v / cur); } else m.scale[k[1]] = v;
      box.setFromObject(m); gizmo.position.copy(m.position); need = true; persist();
    }
    function buildSliders() {
      const wrap = host.querySelector(".cr-p3-sliders"); wrap.innerHTML = "";
      SL.forEach(([k, label, mn, mx, st]) => {
        const r = el(`<label class="cr-field cr-p3-sl"><span>${label}</span><input type="range" min="${mn}" max="${mx}" step="${st}" data-k="${k}"><output></output></label>`);
        const inp = r.querySelector("input"), out = r.querySelector("output");
        inp.value = getV(k); out.textContent = (+inp.value).toFixed(st < 1 ? 1 : 0);
        inp.oninput = () => { setV(k, +inp.value); out.textContent = (+inp.value).toFixed(st < 1 ? 1 : 0); };
        wrap.appendChild(r);
      });
    }
    function syncSliders() { host.querySelectorAll(".cr-p3-sliders input").forEach((i) => { i.value = getV(i.dataset.k); i.nextElementSibling.textContent = (+i.value).toFixed(+i.step < 1 ? 1 : 0); }); }

    host.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => { const m = addShape({ type: b.dataset.add, color: COLORS[objects.length % COLORS.length] }); select(m); persist(); }));
    host.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { mode = b.dataset.mode; host.querySelectorAll("[data-mode]").forEach((x) => x.classList.toggle("on", x === b)); gizmo.visible = !!selObj && mode === "move"; need = true; }));
    host.querySelector(".cr-p3-col").oninput = (e) => { if (!selObj) return; selObj.userData.color = e.target.value; selObj.material.color.set(e.target.value); if (selObj.userData.mat === "glow") selObj.material.emissive.set(e.target.value); need = true; persist(); };
    host.querySelector(".cr-p3-mat").onchange = (e) => { if (!selObj) return; selObj.userData.mat = e.target.value; selObj.material.dispose(); selObj.material = material(e.target.value, selObj.userData.color); need = true; persist(); };
    host.querySelector(".cr-p3-bg").oninput = (e) => { scene.background.set(e.target.value); saved.bg = e.target.value; need = true; persist(); };
    host.querySelector(".cr-p3-grid").onchange = (e) => { grid.visible = e.target.checked; need = true; };
    host.querySelector('[data-a="del"]').onclick = () => { if (!selObj) return; scene.remove(selObj); selObj.geometry.dispose(); selObj.material.dispose(); objects.splice(objects.indexOf(selObj), 1); select(null); persist(); };
    host.querySelector('[data-a="dup"]').onclick = () => { if (!selObj) return; const d = selObj.userData; const m = addShape({ type: d.type, color: d.color, mat: d.mat, pos: selObj.position.toArray().map((v, i) => (i === 0 ? v + 1.2 : v)), rot: [selObj.rotation.x, selObj.rotation.y, selObj.rotation.z], scale: selObj.scale.toArray() }); select(m); persist(); };
    host.querySelector('[data-a="view"]').onclick = () => { Object.assign(orbit, { theta: 0.8, phi: 1.05, r: 11 }); orbit.target.set(0, 0.6, 0); placeCam(); };
    host.querySelector('[data-a="snap"]').onclick = async () => {
      const showGrid = grid.visible, sb = box.visible, sg = gizmo.visible; grid.visible = box.visible = gizmo.visible = false; renderer.render(scene, camera);
      const c = mkCanvas(renderer.domElement.width, renderer.domElement.height); c.getContext("2d").drawImage(renderer.domElement, 0, 0);
      grid.visible = showGrid; box.visible = sb; gizmo.visible = sg; need = true;
      const d = new Date(), stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + String(d.getSeconds()).padStart(2, "0");
      try { const r = await saveImage(["Pictures"], "Paint 3D " + stamp + ".png", c); notify("Paint 3D", "Saved " + r.name + " to Pictures.", "paint3d"); }
      catch (e) { alertBox(host, "Couldn't save", e.quota ? e.message : String(e.message || e)); }
    };

    // pointer: orbit / pinch / object drag / axis drag
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ptrs = new Map();
    let drag = null;
    function setNdc(e) { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return r; }
    function screenOf(v) { const p = v.clone().project(camera), r = renderer.domElement.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width, y: (1 - p.y) / 2 * r.height }; }
    const cv = renderer.domElement;
    cv.addEventListener("pointerdown", (e) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { kind: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), r: orbit.r }; return; }
      setNdc(e);
      if (selObj && gizmo.visible) {
        const hit = ray.intersectObjects(axes.map((x) => x.a.cone), false)[0];
        if (hit) { const ax = axes.find((x) => x.a.cone === hit.object); const s0 = screenOf(selObj.position), s1 = screenOf(selObj.position.clone().add(ax.dir)); const sv = { x: s1.x - s0.x, y: s1.y - s0.y }; const len = Math.hypot(sv.x, sv.y) || 1; drag = { kind: "axis", ax, sv: { x: sv.x / len, y: sv.y / len }, len, x: e.clientX, y: e.clientY, start: selObj.position.clone() }; return; }
      }
      const hit = ray.intersectObjects(objects, false)[0];
      if (hit) {
        select(hit.object);
        if (mode === "move") { const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -selObj.position.y); const p = new THREE.Vector3(); ray.ray.intersectPlane(plane, p); drag = { kind: "move", plane, off: selObj.position.clone().sub(p || selObj.position) }; }
        else drag = { kind: mode, x: e.clientX, y: e.clientY };
      } else { drag = { kind: "orbit", x: e.clientX, y: e.clientY, moved: false }; }
    });
    cv.addEventListener("pointermove", (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!drag) return;
      if (drag.kind === "pinch" && ptrs.size >= 2) { const [a, b] = [...ptrs.values()]; orbit.r = clamp(drag.r * drag.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), 3, 40); placeCam(); return; }
      if (drag.kind === "orbit") { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true; orbit.theta -= dx * 0.008; orbit.phi = clamp(orbit.phi - dy * 0.008, 0.15, 1.5); placeCam(); return; }
      if (!selObj) return;
      if (drag.kind === "axis") { const d = ((e.clientX - drag.x) * drag.sv.x + (e.clientY - drag.y) * drag.sv.y) / drag.len; selObj.position.copy(drag.start).addScaledVector(drag.ax.dir, d); }
      else if (drag.kind === "move") { setNdc(e); const p = new THREE.Vector3(); if (ray.ray.intersectPlane(drag.plane, p)) { selObj.position.x = clamp(p.x + drag.off.x, -10, 10); selObj.position.z = clamp(p.z + drag.off.z, -10, 10); } }
      else if (drag.kind === "rotate") { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; selObj.rotation.y += dx * 0.012; selObj.rotation.x += dy * 0.012; }
      else if (drag.kind === "scale") { const dy = e.clientY - drag.y; drag.y = e.clientY; selObj.scale.multiplyScalar(clamp(1 - dy * 0.006, 0.9, 1.1)); }
      box.setFromObject(selObj); gizmo.position.copy(selObj.position); syncSliders(); need = true;
    });
    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (drag && drag.kind === "orbit" && !drag.moved) select(null);
      if (drag && drag.kind !== "orbit" && drag.kind !== "pinch") persist();
      drag = null;
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", (e) => { e.preventDefault(); orbit.r = clamp(orbit.r * (e.deltaY > 0 ? 1.1 : 0.9), 3, 40); placeCam(); }, { passive: false });
    const onKey = (e) => { if (!isTop(winEl) || typingTarget(e.target)) return; if ((e.key === "Delete" || e.key === "Backspace") && selObj) { e.preventDefault(); host.querySelector('[data-a="del"]').click(); } };
    window.addEventListener("keydown", onKey);

    function resize() { const w = viewEl.clientWidth || 600, h = viewEl.clientHeight || 400; renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px"; camera.aspect = w / h; camera.updateProjectionMatrix(); need = true; }
    const ro = new ResizeObserver(resize); ro.observe(viewEl); resize(); placeCam();
    (function loop() {
      if (!alive) return; raf = requestAnimationFrame(loop);
      if (gizmo.visible) { const k = camera.position.distanceTo(gizmo.position) / 11; gizmo.scale.setScalar(Math.max(0.5, k)); }
      if (need) { need = false; renderer.render(scene, camera); }
    })();
    winEl.__p3 = { scene, objects, select, addShape: (t) => host.querySelector(`[data-add="${t}"]`).click() };
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("keydown", onKey); try { objects.forEach((m) => { m.geometry.dispose(); m.material.dispose(); }); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); } catch (e) {} };
  }
})();
