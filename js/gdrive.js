/* Google Drive (fake) — a Drive-style front end to this simulation's own files.
   It is NOT the real Google Drive: nothing is uploaded, downloaded or sent anywhere.
   It browses the sim's virtual file system (the same files as File Explorer) and opens
   each file with the sim's normal handler — so videos open in the Video app (js/drivevideo.js),
   not here. Add files with + New ▸ File upload (stored in-browser via the VFS). */
(function () {
  "use strict";
  if (window.GDrive) return;

  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const FH = () => window.FilesHelper || null;
  const fmtSize = (b) => !b ? "—" : b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : b < 1073741824 ? (b / 1048576).toFixed(1) + " MB" : (b / 1073741824).toFixed(2) + " GB";
  const kindOf = (name, node) => {
    if (node.type === "folder") return "folder";
    if (node.kind) return node.kind;
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["mp4", "webm", "mov", "m4v", "ogv", "mkv", "avi"].includes(ext)) return "video";
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
    if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "audio";
    return "other";
  };

  try {
    if (window.Icon && Icon.register) {
      // Google Drive triangle mark
      Icon.register("googledrive", `<svg viewBox="0 0 48 48" width="100%" height="100%"><path d="M16.5 6h15l15 26h-15z" fill="#ffcf42"/><path d="M1.5 32L9 19l15 26H9z" fill="#11a861"/><path d="M31.5 6L16.5 6 1.5 32l7.5 13z" fill="#3777e3"/><path d="M46.5 32h-15l-7.5 13h15z" fill="#11a861" opacity="0"/><path d="M24 45l7.5-13h15z" fill="#ffcf42" opacity="0"/><path d="M31.5 32h15L39 45H24z" fill="#5aba66"/></svg>`);
    }
  } catch (e) {}

  const NAV = [
    { id: "mydrive", label: "My Drive", ic: "M3 6l2-2h5l2 2h8v12H3z" },
    { id: "recent", label: "Recent", ic: "M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V4zm1 4v5l4 2 .8-1.6L14 11.9V8z" },
    { id: "starred", label: "Starred", ic: "M12 3l2.9 6 6.1.9-4.5 4.3 1 6.1L12 17.8 6.5 20.3l1-6.1L3 9.9 9.1 9z" },
    { id: "shared", label: "Shared with me", ic: "M16 11a3 3 0 100-6 3 3 0 000 6zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.7 0-8 1.3-8 4v2h9m7-6c-.3 0-.7 0-1 .1 1.3.9 2 2.1 2 3.9v2h7v-2c0-2.7-5.3-4-8-4z" },
    { id: "trash", label: "Trash", ic: "M6 7h12l-1 13H7zM9 4h6l1 2H8z" },
  ];

  function open(startPath) {
    const ref = WM.createWindow({ title: "Google Drive", icon: Icon.mini("googledrive", "Google Drive"), width: Math.min(1020, innerWidth - 22), height: Math.min(700, innerHeight - 76), appId: "googledrive" });
    const body = ref.body || ref.content || (ref.el && ref.el.querySelector(".win-body"));
    const S = { view: "mydrive", path: startPath || [], q: "" };
    shell(body, S);
    const onCh = () => { if (body.isConnected) renderMain(body, S); };
    window.addEventListener("vfs-change", onCh);
    const mo = new MutationObserver(() => { if (!body.isConnected) { window.removeEventListener("vfs-change", onCh); mo.disconnect(); } });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    return ref;
  }

  function shell(body, S) {
    body.innerHTML = "";
    const root = el(`
      <div class="gd">
        <header class="gd-top">
          <div class="gd-brand"><span class="gd-logo">${Icon.mini("googledrive", "Drive")}</span><span class="gd-brandname">Drive</span></div>
          <div class="gd-search"><span class="gd-search-ic">🔍</span><input class="gd-q" type="text" placeholder="Search in Drive" aria-label="Search in Drive"></div>
          <div class="gd-top-right"><span class="gd-fake">fake · your files only</span><span class="gd-avatar">C</span></div>
        </header>
        <div class="gd-main-wrap">
          <aside class="gd-side">
            <button class="gd-new"><span class="gd-plus">+</span> New</button>
            <nav class="gd-nav"></nav>
            <div class="gd-storage"><div class="gd-storage-bar"><i></i></div><div class="gd-storage-t"></div></div>
          </aside>
          <section class="gd-body">
            <div class="gd-crumbs"></div>
            <div class="gd-grid"></div>
          </section>
        </div>
      </div>`);
    body.appendChild(root);
    const nav = root.querySelector(".gd-nav");
    NAV.forEach((n) => {
      const b = el(`<button class="gd-navbtn" data-v="${n.id}"><svg viewBox="0 0 24 24" width="20" height="20"><path d="${n.ic}" fill="currentColor"/></svg><span>${n.label}</span></button>`);
      b.onclick = () => { S.view = n.id; S.path = []; S.q = ""; root.querySelector(".gd-q").value = ""; renderMain(body, S); };
      nav.appendChild(b);
    });
    root.querySelector(".gd-new").onclick = (e) => newMenu(e.currentTarget, S, body);
    root.querySelector(".gd-q").addEventListener("input", (e) => { S.q = e.target.value.trim().toLowerCase(); renderMain(body, S); });
    renderStorage(root);
    renderMain(body, S);
  }

  function renderStorage(root) {
    let used = 0, count = 0;
    try {
      const walk = (ch) => { Object.keys(ch || {}).forEach((k) => { const n = ch[k]; if (!n) return; if (n.type === "folder") walk(n.children); else { used += n.size || n.csize || 0; count++; } }); };
      walk(window.VFS ? VFS.childrenAt([]) : {});
    } catch (e) {}
    const totalGB = 15, usedGB = Math.min(totalGB, used / 1073741824);
    const pct = Math.max(1.5, (usedGB / totalGB) * 100);
    root.querySelector(".gd-storage-bar i").style.width = pct + "%";
    root.querySelector(".gd-storage-t").textContent = (usedGB < 0.01 ? (used / 1048576).toFixed(0) + " MB" : usedGB.toFixed(2) + " GB") + " of " + totalGB + " GB used";
  }

  function listFor(S) {
    const out = [];
    if (S.view === "mydrive") {
      const ch = window.VFS ? VFS.childrenAt(S.path) : null;
      if (ch) Object.keys(ch).forEach((name) => { const n = ch[name]; if (n && !n.hidden && !/^Local Disk|Recycle Bin/i.test(name)) out.push({ name, node: n, path: S.path }); });
    } else if (S.view === "recent" || S.view === "starred") {
      const acc = [];
      const walk = (ch, p) => { Object.keys(ch || {}).forEach((name) => { const n = ch[name]; if (!n || n.hidden) return; if (n.type === "folder") { if (p.length < 6) walk(n.children, p.concat(name)); } else if (S.view === "recent" || n.starred) acc.push({ name, node: n, path: p }); }); };
      try { walk(window.VFS ? VFS.childrenAt([]) : {}, []); } catch (e) {}
      acc.sort((a, b) => (b.node.atime || b.node.ts || 0) - (a.node.atime || a.node.ts || 0));
      return acc.slice(0, 60);
    }
    // folders first, then files; both alpha
    out.sort((a, b) => (a.node.type === "folder" ? 0 : 1) - (b.node.type === "folder" ? 0 : 1) || a.name.localeCompare(b.name));
    return out;
  }

  function renderMain(body, S) {
    const root = body.querySelector(".gd"); if (!root) return;
    const crumbs = root.querySelector(".gd-crumbs"), grid = root.querySelector(".gd-grid");
    root.querySelectorAll(".gd-navbtn").forEach((b) => b.classList.toggle("on", b.dataset.v === S.view));
    // breadcrumb
    crumbs.innerHTML = "";
    const home = el(`<button class="gd-crumb">${NAV.find((n) => n.id === S.view).label}</button>`);
    home.onclick = () => { S.path = []; renderMain(body, S); };
    crumbs.appendChild(home);
    if (S.view === "mydrive") S.path.forEach((seg, i) => {
      crumbs.appendChild(el(`<span class="gd-crumb-sep">›</span>`));
      const c = el(`<button class="gd-crumb">${esc(seg)}</button>`);
      c.onclick = () => { S.path = S.path.slice(0, i + 1); renderMain(body, S); };
      crumbs.appendChild(c);
    });

    let items = listFor(S);
    if (S.q) items = items.filter((it) => it.name.toLowerCase().includes(S.q));
    grid.innerHTML = "";
    if (!items.length) {
      const msg = S.view === "shared" ? "Nothing is shared with you — this is a fake, local Drive." : S.view === "trash" ? "Trash is empty." : S.q ? "No matches." : "This folder is empty. Use + New ▸ File upload to add a video or file.";
      grid.appendChild(el(`<div class="gd-empty">${esc(msg)}</div>`));
      return;
    }
    items.forEach((it) => grid.appendChild(tile(it, S, body)));
  }

  function tile(it, S, body) {
    const k = kindOf(it.name, it.node);
    const t = el(`<button class="gd-tile" title="${esc(it.name)}">
      <div class="gd-thumb gd-k-${k}">${thumbInner(k, it)}</div>
      <div class="gd-name"><span class="gd-name-ic">${glyph(k)}</span><span class="gd-name-t">${esc(it.name)}</span></div>
    </button>`);
    // async image thumbnail
    if (k === "image" && FH() && FH().imageThumb) { try { FH().imageThumb(it.node).then((u) => { if (u) { const ph = t.querySelector(".gd-thumb"); ph.innerHTML = `<img alt="" src="${u}">`; } }).catch(() => {}); } catch (e) {} }
    t.ondblclick = () => openItem(it, S, body);
    t.onclick = (e) => { /* single select visual only */ body.querySelectorAll(".gd-tile.sel").forEach((x) => x.classList.remove("sel")); t.classList.add("sel"); };
    return t;
  }
  function thumbInner(k, it) {
    if (k === "video") return `<span class="gd-play">▶</span>`;
    if (k === "folder") return `<svg viewBox="0 0 24 24" width="40" height="40"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" fill="#8ab4f8"/></svg>`;
    return glyph(k, 40);
  }
  function glyph(k, size) {
    size = size || 18;
    const c = { video: "#ea4335", image: "#4285f4", audio: "#34a853", word: "#2b579a", pptx: "#c43e1c", xlsx: "#217346", folder: "#5f6368", text: "#5f6368", other: "#5f6368" }[k] || "#5f6368";
    if (k === "video") return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><rect x="3" y="5" width="18" height="14" rx="2" fill="${c}"/><path d="M10 9l5 3-5 3z" fill="#fff"/></svg>`;
    if (k === "folder") return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" fill="${c}"/></svg>`;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" fill="${c}"/></svg>`;
  }

  function openItem(it, S, body) {
    if (it.node.type === "folder") {
      if (S.view === "mydrive") { S.path = it.path.concat(it.name); renderMain(body, S); }
      else { S.view = "mydrive"; S.path = it.path.concat(it.name); renderMain(body, S); }
      return;
    }
    const full = (it.path || []).concat(it.name);
    if (FH() && FH().openFile) { it.node.atime = Date.now(); FH().openFile(it.name, it.node, full); return; }
    // fallback: videos to the player, else VFS default
    if (kindOf(it.name, it.node) === "video" && window.DriveVideo) DriveVideo.openNode(it.name, it.node, full);
    else if (window.VFS) VFS.openNode(it.name, it.node);
  }

  function newMenu(anchor, S, body) {
    document.querySelectorAll(".gd-menu").forEach((m) => m.remove());
    const r = anchor.getBoundingClientRect();
    const menu = el(`<div class="gd-menu" style="left:${Math.round(r.left)}px;top:${Math.round(r.bottom + 4)}px">
      <button data-a="folder">📁 New folder</button>
      <button data-a="upload">⬆️ File upload</button>
    </div>`);
    document.body.appendChild(menu);
    const close = () => menu.remove();
    setTimeout(() => document.addEventListener("pointerdown", function h(e) { if (!menu.contains(e.target)) { close(); document.removeEventListener("pointerdown", h); } }), 0);
    menu.querySelector('[data-a="folder"]').onclick = () => { close(); newFolder(S, body); };
    menu.querySelector('[data-a="upload"]').onclick = () => { close(); uploadInto(S.view === "mydrive" ? S.path : [], body, S); };
  }
  function newFolder(S, body) {
    const dest = window.VFS ? VFS.childrenAt(S.view === "mydrive" ? S.path : []) : null; if (!dest) return;
    const nm = VFS.uniqueName(dest, "New folder");
    dest[nm] = { type: "folder", children: {}, ts: Date.now(), created: Date.now() };
    State.save(); window.dispatchEvent(new Event("vfs-change"));
    if (S.view !== "mydrive") { S.view = "mydrive"; }
    renderMain(body, S);
  }
  function uploadInto(destPath, body, S) {
    if (!window.VFS || !VFS.nodeFromFile) return;
    const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true; inp.style.display = "none";
    document.body.appendChild(inp);
    inp.onchange = () => {
      const fl = [...inp.files]; inp.remove();
      if (!fl.length) return;
      const dest = VFS.childrenAt(destPath); if (!dest) return;
      Promise.all(fl.map((f) => VFS.nodeFromFile(f).then((node) => { node.created = Date.now(); if (f.lastModified) node.ts = f.lastModified; const nm = VFS.uniqueName(dest, f.name); dest[nm] = node; return nm; }).catch(() => null)))
        .then(() => { State.save(); window.dispatchEvent(new Event("vfs-change")); if (S.view !== "mydrive") { S.view = "mydrive"; S.path = destPath; } renderMain(body, S); });
    };
    inp.click();
  }

  if (window.AppRegistry) { AppRegistry.googledrive = function () { return open(); }; AppRegistry.gdrive = AppRegistry.googledrive; }
  try {
    if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === "googledrive"))
      Catalog.storeApps.push({ id: "googledrive", name: "Google Drive", cat: "Productivity", price: 0, builtin: "googledrive", desc: "A Drive-style view of this PC's files (a fake, local Drive — nothing is uploaded anywhere). Videos open in the Video app; upload files with + New." });
    const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []);
    if (ex.indexOf("googledrive") < 0) ex.push("googledrive");
  } catch (e) {}

  window.GDrive = { open };
})();
