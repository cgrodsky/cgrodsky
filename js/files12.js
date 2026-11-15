/* File Explorer — Windows 12 style: tabs, back/forward/up, address bar, search, a toolbar
   (New, Cut, Copy, Paste, Rename, Delete, Sort by, Layout), Pinned / Folders / Label cards,
   "This PC" with drive cards. Uses the same folder data as before (State.appData.files). */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FP = () => window.FilesParts;
  const QUICK = ["Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music"];
  const LABELS = [["red", "Red", "#e5362c"], ["blue", "Blue", "#3f7be0"], ["yellow", "Yellow", "#f5df1b"], ["green", "Green", "#2b8a2b"], ["orange", "Orange", "#f29a2e"], ["purple", "Purple", "#7a1f86"], ["pink", "Pink", "#f6c9d3"]];
  let clip = null;   // { op: "cut" | "copy", items: [{ path, name }] } — shared by every Explorer window

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
  function kidsAt(p) { const n = nodeAt(p); return n && n.type === "folder" ? n.children : null; }
  function uniqueName(children, name) {
    if (!children[name]) return name;
    const m = name.match(/^(.*?)(\.[^.]+)?$/); const base = m[1], ext = m[2] || ""; let i = 2;
    while (children[base + " (" + i + ")" + ext]) i++;
    return base + " (" + i + ")" + ext;
  }
  function walk(cb, p, kids) {   // every node, depth-first
    kids = kids || root(); p = p || [];
    Object.keys(kids).forEach((name) => { const n = kids[name]; cb(n, name, p); if (n.type === "folder" && n.children && name !== "Local Disk (C:)") walk(cb, p.concat(name), n.children); });
  }
  function recentFiles(limit) {
    const out = []; walk((n, name, p) => { if (n.type === "file" && n.ts) out.push({ name, node: n, path: p }); });
    return out.sort((a, b) => b.node.ts - a.node.ts).slice(0, limit || 8);
  }
  function ago(ts) {
    const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
    if (m < 60) return m + " minute" + (m === 1 ? "" : "s") + " ago";
    const h = Math.round(m / 60); if (h < 24) return h + " hour" + (h === 1 ? "" : "s") + " ago";
    const d = Math.round(h / 24); return d + " day" + (d === 1 ? "" : "s") + " ago";
  }
  function sizeOf(n) {
    if (n.type === "folder") return "";
    const b = n.size || (n.content ? n.content.length : 0) || (n.src ? Math.round(n.src.length * 0.75) : 0);
    return b < 1024 ? (b || 1) + " bytes" : b < 1048576 ? Math.ceil(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB";
  }
  function typeOf(name, n) {
    if (n.type === "folder") return "File folder";
    const ext = (name.match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
    return ({ word: "Word Document", pptx: "PowerPoint Presentation", xlsx: "Excel Worksheet", image: "Picture", text: "Text Document", system: "System file", pdf: "PDF Document" })[n.kind] || (ext ? ext.toUpperCase() + " File" : "File");
  }

  // ---------- icons ----------
  function glyph(name, node, size) {
    const s = size || 34;
    if (node.type === "folder") {
      const f = FP(); const src = (f.FOLDER_ICON[name] || "assets/folder.png") + "?v=" + f.FICONV;
      return `<img class="fx12-img" src="${src}" alt="" style="width:${s}px;height:${s}px">`;
    }
    const ext = (String(name).match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
    const img = (src) => `<img class="fx12-img" src="${src}" alt="" style="width:${s}px;height:${s}px">`;
    if (node.kind === "image" || ["png", "jpg", "jpeg", "svg", "gif", "webp", "bmp", "heic", "ico", "tiff"].includes(ext)) return node.src ? `<img class="fx12-img fx12-thumb" src="${node.src}" alt="" style="width:${s}px;height:${s}px">` : img("assets/file_image.png?v=1");
    if (["rar", "zip", "7z", "tar", "gz", "bz2", "xz", "cab"].includes(ext)) return img("assets/file_rar.png?v=1");
    if (["js", "mjs", "ts", "css", "html", "htm", "json", "py", "java", "c", "h", "cpp", "cs", "go", "rb", "php", "rs", "swift", "kt", "sh", "bat", "xml", "yml", "yaml", "md", "sql", "lua"].includes(ext)) return img("assets/file_code.png?v=1");
    if (["mp4", "mov", "avi", "mkv", "webm", "m4v", "wmv"].includes(ext)) return img("assets/file_video.png?v=1");
    if (node.kind === "word") return `<span class="fx12-appic" style="width:${s}px;height:${s}px">${Icon.mini("word", "Word")}</span>`;
    if (node.kind === "pptx") return `<span class="fx12-appic" style="width:${s}px;height:${s}px">${Icon.mini("powerpoint", "PowerPoint")}</span>`;
    if (node.kind === "xlsx") return `<span class="fx12-appic" style="width:${s}px;height:${s}px">${Icon.mini("excel", "Excel")}</span>`;
    if (node.kind === "pdf" || ext === "pdf") return img("assets/pdf.png?v=1");
    if (node.kind === "system") return `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><rect x="3" y="4" width="18" height="16" rx="2" fill="#c7cdd6"/><rect x="3" y="4" width="18" height="4.5" rx="2" fill="#8a94a6"/><circle cx="12" cy="14" r="3.4" fill="none" stroke="#5a6472" stroke-width="1.6"/></svg>`;
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" fill="#fff" stroke="#9aa3b2"/><path d="M14 3v4h4" fill="#e6e9ef" stroke="#9aa3b2"/><path d="M8 11h8M8 14h8M8 17h5" stroke="#9aa3b2"/></svg>`;
  }
  const SV = (d, w) => `<svg viewBox="0 0 24 24" width="${w || 18}" height="${w || 18}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const I = {
    back: SV('<path d="M19 12H5M11 6l-6 6 6 6"/>'), fwd: SV('<path d="M5 12h14M13 6l6 6-6 6"/>'), up: SV('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    search: SV('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', 16), plus: SV('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', 20),
    cut: SV('<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16L18 4M16 16L6 4"/>', 20), copy: SV('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2"/>', 20),
    paste: SV('<rect x="5" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h4v2M13 11h7v10h-7z"/>', 20), rename: SV('<rect x="3" y="7" width="14" height="10" rx="2"/><path d="M20 4v16M18 4h4M18 20h4M7 12h6"/>', 20),
    del: SV('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 20), sort: SV('<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>', 20),
    layout: SV('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>', 20),
    list: SV('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', 20), upload: SV('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', 20),
    pc: `<img src="assets/thispc.png?v=7" alt="" style="width:18px;height:18px;object-fit:contain">`,
    star: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#f7c400"/></svg>`,
    cloud: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 19a5 5 0 0 1-.6-10A6.5 6.5 0 0 1 19 9.5 4.8 4.8 0 0 1 18.5 19z" fill="#1a73e8"/></svg>`,
    bin: `<img src="assets/recyclebin.png?v=14" alt="" onerror="this.replaceWith(document.createTextNode('🗑'))" style="width:18px;height:18px;object-fit:contain">`,
    pin: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M14 3l7 7-3 1-4 4 1 5-2 1-4-5-5 5-1-1 5-5-5-4 1-2 5 1 4-4z" fill="#e5362c"/></svg>`,
    tag: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z" fill="#f6c27a"/><circle cx="8" cy="8" r="1.6" fill="#fff"/></svg>`,
    folder: `<img src="assets/folder.png?v=7" alt="" style="width:18px;height:18px;object-fit:contain">`,
    drive: `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="13" width="18" height="6" rx="1.5" fill="#6b7280"/><path d="M5 13l2-6h10l2 6" fill="#9ca3af"/><circle cx="7" cy="16" r="1" fill="#4ade80"/></svg>`,
  };
  const DRIVE_SVG = (win) => `<svg viewBox="0 0 64 48" width="64" height="48">${win ? '<rect x="4" y="2" width="11" height="11" rx="1.5" fill="#8a63e8"/><rect x="17" y="2" width="11" height="11" rx="1.5" fill="#5a7bea"/><rect x="4" y="15" width="11" height="11" rx="1.5" fill="#5f8ff0"/><rect x="17" y="15" width="11" height="11" rx="1.5" fill="#4aa0f0"/>' : ""}<path d="M8 30l6-10h36l6 10" fill="#d4d7dd"/><rect x="6" y="30" width="52" height="14" rx="3" fill="#3f4450"/><circle cx="13" cy="37" r="2" fill="#4ade80"/></svg>`;

  // ---------- the app ----------
  AppRegistry.files = function () {
    const { body } = WM.createWindow({ title: "File Explorer", icon: Icon.mini("fileexplorer", "File Explorer"), width: 980, height: 620, appId: "fileexplorer" });
    root();
    const startPath = window.FilesStartPath; window.FilesStartPath = null;
    // A "place" is { kind: "pc" | "quick" | "folder" | "label" | "search", path?, label?, q? }
    const startPlace = startPath === "quick" ? { kind: "quick" } : Array.isArray(startPath) ? { kind: "folder", path: startPath.slice() } : { kind: "pc" };
    if (startPlace.kind === "folder" && !nodeAt(startPlace.path)) startPlace.kind = "pc";
    const tabs = [{ place: startPlace, back: [], fwd: [] }];
    let ti = 0, sel = new Set(), sortBy = (S().appData.filesView || {}).sort || "name", layout = (S().appData.filesView || {}).layout || "grid";

    body.innerHTML = `<div class="fx12">
      <div class="fx12-tabs"></div>
      <div class="fx12-nav">
        <button class="fx12-ib" data-a="back" title="Back">${I.back}</button><button class="fx12-ib" data-a="fwd" title="Forward">${I.fwd}</button><button class="fx12-ib" data-a="up" title="Up">${I.up}</button>
        <div class="fx12-addr"></div>
        <label class="fx12-search">${I.search}<input placeholder="Search" spellcheck="false"></label>
      </div>
      <div class="fx12-main">
        <aside class="fx12-side"></aside>
        <section class="fx12-pane">
          <div class="fx12-tools">
            <button class="fx12-tb fx12-new" data-a="new">${I.plus}<span>New</span></button><span class="fx12-div"></span>
            <button class="fx12-tb" data-a="cut" title="Cut">${I.cut}</button><button class="fx12-tb" data-a="copy" title="Copy">${I.copy}</button><button class="fx12-tb" data-a="paste" title="Paste">${I.paste}</button><button class="fx12-tb" data-a="rename" title="Rename">${I.rename}</button><button class="fx12-tb" data-a="delete" title="Delete">${I.del}</button><span class="fx12-div"></span>
            <button class="fx12-tb" data-a="sort">${I.sort}<span>Sort by</span></button><button class="fx12-tb" data-a="layout">${I.layout}<span>Layout</span></button>
          </div>
          <div class="fx12-body"></div>
          <div class="fx12-status"></div>
        </section>
      </div>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const tabsEl = $(".fx12-tabs"), side = $(".fx12-side"), view = $(".fx12-body"), addr = $(".fx12-addr"), search = $(".fx12-search input"), status = $(".fx12-status");
    const tab = () => tabs[ti];
    const place = () => tab().place;
    const placeName = (pl) => pl.kind === "pc" ? "This PC" : pl.kind === "quick" ? "Quick Access" : pl.kind === "label" ? (LABELS.find((l) => l[0] === pl.label) || [, "Label"])[1] : pl.kind === "search" ? "Search" : (pl.path[pl.path.length - 1] || "This PC");
    const placeIcon = (pl) => pl.kind === "pc" ? I.pc : pl.kind === "quick" ? I.star : pl.kind === "label" ? I.tag : pl.kind === "search" ? I.search : (pl.path.length ? glyph(pl.path[pl.path.length - 1], { type: "folder" }, 18) : I.pc);
    const saveView = () => { S().appData.filesView = { sort: sortBy, layout }; State.save(); };

    function go(pl, noHistory) {
      if (!noHistory) { tab().back.push(place()); tab().fwd = []; }
      tab().place = pl; sel.clear(); if (pl.kind !== "search") search.value = ""; render();
    }
    function openFolder(path) { go({ kind: "folder", path }); }

    // ---- tabs ----
    function paintTabs() {
      tabsEl.innerHTML = "";
      tabs.forEach((t, i) => {
        const b = el(`<div class="fx12-tab ${i === ti ? "on" : ""}"><span class="fx12-tab-ic">${placeIcon(t.place)}</span><span class="fx12-tab-t">${esc(placeName(t.place))}</span><button class="fx12-tab-x" title="Close tab">×</button></div>`);
        b.onclick = () => { ti = i; sel.clear(); render(); };
        b.querySelector(".fx12-tab-x").onclick = (e) => { e.stopPropagation(); if (tabs.length === 1) { const w = body.closest(".win"); const c = w && w.querySelector(".close, [data-act=close]"); if (c) c.click(); return; } tabs.splice(i, 1); if (ti >= tabs.length) ti = tabs.length - 1; render(); };
        tabsEl.appendChild(b);
      });
      const add = el(`<button class="fx12-tab-add" title="New tab">+</button>`);
      add.onclick = () => { tabs.push({ place: { kind: "pc" }, back: [], fwd: [] }); ti = tabs.length - 1; sel.clear(); render(); };
      tabsEl.appendChild(add);
    }

    // ---- address bar ----
    function paintAddr() {
      const pl = place(); addr.innerHTML = "";
      const crumb = (label, onClick) => { const c = el(`<button class="fx12-crumb">${esc(label)}</button>`); c.onclick = onClick; addr.appendChild(c); };
      addr.appendChild(el(`<span class="fx12-addr-ic">${placeIcon(pl)}</span>`));
      if (pl.kind === "folder") {
        crumb("This PC", () => go({ kind: "pc" }));
        pl.path.forEach((seg, i) => { addr.appendChild(el(`<span class="fx12-sep">›</span>`)); crumb(seg, () => openFolder(pl.path.slice(0, i + 1))); });
      } else crumb(placeName(pl), () => {});
      addr.appendChild(el(`<span class="fx12-sep">›</span>`));
      $('[data-a="back"]').disabled = !tab().back.length; $('[data-a="fwd"]').disabled = !tab().fwd.length;
      $('[data-a="up"]').disabled = !(pl.kind === "folder");
    }

    // ---- sidebar ----
    function paintSide() {
      const pl = place(); side.innerHTML = "";
      const on = (k, p) => (pl.kind === k && (!p || (pl.path && pl.path.join("/") === p)));
      const item = (ic, label, active, onClick, extra) => { const a = el(`<a class="fx12-si ${active ? "on" : ""}">${ic}<span>${esc(label)}</span>${extra || ""}</a>`); a.onclick = onClick; return a; };
      const c1 = el(`<div class="fx12-card"><div class="fx12-card-h">${I.pin}<b>Pinned</b></div></div>`);
      c1.appendChild(item(I.star, "Quick Access", on("quick"), () => go({ kind: "quick" })));
      c1.appendChild(item(I.cloud, "OneDrive", on("folder", "OneDrive"), () => openFolder(["OneDrive"])));
      c1.appendChild(item(I.pc, "This PC", on("pc"), () => go({ kind: "pc" })));
      c1.appendChild(item(I.bin, "Recycle Bin", false, () => WM.open("recyclebin")));
      side.appendChild(c1);
      const c2 = el(`<div class="fx12-card"><div class="fx12-card-h">${I.folder}<b>Folders</b></div></div>`);
      QUICK.concat(root()["Homework"] ? ["Homework"] : []).forEach((q) => c2.appendChild(item(glyph(q, { type: "folder" }, 18), q, on("folder", q), () => openFolder([q]))));
      side.appendChild(c2);
      const c3 = el(`<div class="fx12-card"><div class="fx12-card-h">${I.tag}<b>Label</b></div></div>`);
      LABELS.forEach(([k, name, col]) => c3.appendChild(item(`<i class="fx12-dot" style="background:${col}"></i>`, name, pl.kind === "label" && pl.label === k, () => go({ kind: "label", label: k }))));
      side.appendChild(c3);
    }

    // ---- items in the current place ----
    function entries() {
      const pl = place();
      if (pl.kind === "folder") { const k = kidsAt(pl.path); return k ? Object.keys(k).map((name) => ({ name, node: k[name], path: pl.path })) : []; }
      if (pl.kind === "label") { const out = []; walk((n, name, p) => { if (n.label === pl.label) out.push({ name, node: n, path: p }); }); return out; }
      if (pl.kind === "search") { const q = pl.q.toLowerCase(), base = pl.path || []; const out = []; const start = kidsAt(base) || root(); walk((n, name, p) => { if (name.toLowerCase().includes(q)) out.push({ name, node: n, path: p }); }, base, start); return out.slice(0, 300); }
      return [];
    }
    function sorted(list) {
      const fold = (e) => (e.node.type === "folder" ? 0 : 1);
      return list.sort((a, b) => fold(a) - fold(b) || (sortBy === "date" ? (b.node.ts || 0) - (a.node.ts || 0) : sortBy === "type" ? typeOf(a.name, a.node).localeCompare(typeOf(b.name, b.node)) || a.name.localeCompare(b.name) : sortBy === "size" ? (parseFloat(sizeOf(b.node)) || 0) - (parseFloat(sizeOf(a.node)) || 0) : a.name.localeCompare(b.name, undefined, { numeric: true })));
    }
    const key = (e) => e.path.concat(e.name).join("/");

    function itemEl(e) {
      const isList = layout === "list";
      const it = el(isList
        ? `<div class="fx12-row" tabindex="0"><span class="fx12-row-ic">${glyph(e.name, e.node, 22)}</span><span class="fx12-row-n">${esc(e.name)}</span><span class="fx12-row-d">${e.node.ts ? new Date(e.node.ts).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : ""}</span><span class="fx12-row-t">${esc(typeOf(e.name, e.node))}</span><span class="fx12-row-s">${sizeOf(e.node)}</span></div>`
        : `<div class="fx12-item" tabindex="0" title="${esc(e.name)}"><div class="fx12-item-ic">${glyph(e.name, e.node, 48)}</div><div class="fx12-item-n">${esc(e.name)}</div></div>`);
      const lab = e.node.label && LABELS.find((l) => l[0] === e.node.label); if (lab) it.appendChild(el(`<i class="fx12-dot fx12-item-dot" style="background:${lab[2]}"></i>`));
      if (clip && clip.op === "cut" && clip.items.some((c) => c.path.concat(c.name).join("/") === key(e))) it.classList.add("cutting");
      const k = key(e); if (sel.has(k)) it.classList.add("sel");
      const openIt = () => { if (e.node.type === "folder") openFolder(e.path.concat(e.name)); else if (window.VFS) VFS.openNode(e.name, e.node); };
      it.onclick = (ev) => {
        ev.stopPropagation();
        if (ev.ctrlKey || ev.metaKey) { sel.has(k) ? sel.delete(k) : sel.add(k); }
        else { const was = sel.has(k) && sel.size === 1; sel.clear(); sel.add(k); if (was && ev.detail === 1 && it._tapOpen) { openIt(); return; } }
        it._tapOpen = true; paintSel();
      };
      it.ondblclick = (ev) => { ev.stopPropagation(); openIt(); };
      it.onkeydown = (ev) => { if (ev.key === "Enter") openIt(); };
      it.oncontextmenu = (ev) => { ev.preventDefault(); ev.stopPropagation(); if (!sel.has(k)) { sel.clear(); sel.add(k); paintSel(); } ctxMenu(ev, e); };
      it.dataset.k = k;
      return it;
    }
    function paintSel() { view.querySelectorAll("[data-k]").forEach((n) => n.classList.toggle("sel", sel.has(n.dataset.k))); paintStatus(); paintTools(); }
    function selected() { const all = currentList; return all.filter((e) => sel.has(key(e))); }
    let currentList = [];

    function section(title, ic) { return el(`<div class="fx12-sec"><div class="fx12-sec-h">${ic || ""}<span>${esc(title)}</span></div></div>`); }
    function grid(list) {
      const g = el(`<div class="${layout === "list" ? "fx12-list" : "fx12-grid"}"></div>`);
      if (layout === "list") g.appendChild(el(`<div class="fx12-row fx12-row-h"><span class="fx12-row-ic"></span><span class="fx12-row-n">Name</span><span class="fx12-row-d">Date modified</span><span class="fx12-row-t">Type</span><span class="fx12-row-s">Size</span></div>`));
      list.forEach((e) => g.appendChild(itemEl(e)));
      return g;
    }

    function paintView() {
      const pl = place(); view.innerHTML = ""; currentList = [];
      if (pl.kind === "pc") {
        const r = root();
        const fold = QUICK.concat(Object.keys(r).filter((n) => r[n].type === "folder" && !QUICK.includes(n) && !/^Local Disk/.test(n) && n !== "OneDrive")).filter((n) => r[n]);
        const s1 = section("Folders", I.folder);
        currentList = fold.map((name) => ({ name, node: r[name], path: [] }));
        s1.appendChild(grid(currentList)); view.appendChild(s1);
        const s2 = section("Devices and drivers", I.drive);
        const drives = el(`<div class="fx12-drives"></div>`);
        let used = 0; try { used = JSON.stringify(S()).length; } catch (_) {}
        const cFree = Math.max(1, 32.6 - used / 1e6).toFixed(1);
        [["Local Disk (C:)", true, cFree, 143], ["Local Disk (D:)", false, "185.3", 216]].forEach(([name, win, free, total]) => {
          const pct = Math.round((1 - free / total) * 100);
          const d = el(`<div class="fx12-drive" tabindex="0"><span class="fx12-drive-ic">${DRIVE_SVG(win)}</span><div class="fx12-drive-tx"><div class="fx12-drive-n">${name}</div><div class="fx12-drive-bar"><i style="width:${pct}%"></i></div><div class="fx12-drive-s">${free} GB free of ${total} GB</div></div></div>`);
          d.ondblclick = d.onclick = () => { if (!r[name]) { r[name] = { type: "folder", children: {} }; State.save(); } openFolder([name]); };
          drives.appendChild(d);
        });
        s2.appendChild(drives); view.appendChild(s2);
        const loose = Object.keys(r).filter((n) => r[n].type === "file").map((name) => ({ name, node: r[name], path: [] }));
        if (loose.length) { const s3 = section("Files"); s3.appendChild(grid(sorted(loose))); view.appendChild(s3); currentList = currentList.concat(loose); }
      } else if (pl.kind === "quick") {
        const r = root();
        const s1 = section("Quick access", I.star); const q = QUICK.filter((n) => r[n]).map((name) => ({ name, node: r[name], path: [] }));
        s1.appendChild(grid(q)); view.appendChild(s1);
        const rec = recentFiles(12);
        const s2 = section("Recent files"); currentList = q.concat(rec);
        if (rec.length) { const keep = layout; layout = "list"; s2.appendChild(grid(rec)); layout = keep; } else s2.appendChild(el(`<div class="fx12-empty">Files you open or save will show up here.</div>`));
        view.appendChild(s2);
      } else {
        const list = sorted(entries()); currentList = list;
        if (pl.kind === "label") { const l = LABELS.find((x) => x[0] === pl.label); view.appendChild(el(`<div class="fx12-sec-h" style="margin:4px 4px 10px"><i class="fx12-dot" style="background:${l[2]}"></i><span>Labeled ${esc(l[1])}</span></div>`)); }
        if (pl.kind === "search") view.appendChild(el(`<div class="fx12-sec-h" style="margin:4px 4px 10px">${I.search}<span>Results for “${esc(pl.q)}”</span></div>`));
        if (!list.length) view.appendChild(el(`<div class="fx12-empty">${pl.kind === "label" ? "No files have this label yet. Right-click a file → Label." : pl.kind === "search" ? "No items match your search." : "This folder is empty."}</div>`));
        else view.appendChild(grid(list));
      }
    }
    function paintStatus() { status.textContent = currentList.length + " item" + (currentList.length === 1 ? "" : "s") + (sel.size ? "  |  " + sel.size + " selected" : ""); }
    function paintTools() {
      const canEdit = place().kind === "folder" || place().kind === "label" || place().kind === "search" || place().kind === "quick";
      const has = sel.size > 0;
      $('[data-a="cut"]').disabled = !has || !canEdit; $('[data-a="copy"]').disabled = !has; $('[data-a="rename"]').disabled = sel.size !== 1 || !canEdit; $('[data-a="delete"]').disabled = !has || !canEdit;
      $('[data-a="paste"]').disabled = !(clip && place().kind === "folder"); $('[data-a="new"]').disabled = place().kind !== "folder";
      $('[data-a="layout"]').innerHTML = (layout === "grid" ? I.list : I.layout) + `<span>${layout === "grid" ? "Details" : "Icons"}</span>`;
    }
    function render() { paintTabs(); paintAddr(); paintSide(); paintView(); paintStatus(); paintTools(); }

    // ---- actions ----
    function parentOf(e) { return kidsAt(e.path); }
    // Deleting Windows system files needs admin and breaks Windows (blue screen).
    const isSystemCritical = (e) => { const full = e.path.concat(e.name).join("/"); return full === "Local Disk (C:)" || full === "Local Disk (C:)/Windows" || full === "Local Disk (C:)/Windows/System32"; };
    function doDelete(list) {
      if (!list.length) return;
      const crit = list.find(isSystemCritical);
      if (crit && window.UAC) {
        window.UAC.prompt({ name: "Delete " + crit.name, publisher: "Microsoft Windows", iconKey: "fileexplorer", danger: true,
          detail: "Deleting <b>" + esc(crit.name) + "</b> removes files Windows needs to run. Your PC may stop working. Do this only if you know what you're doing." }, () => {
          list.forEach((e) => { const p = parentOf(e); if (p) delete p[e.name]; });
          sel.clear(); State.save(); render();
          if (window.BSOD) setTimeout(() => BSOD.show(), 350);
        });
        return;
      }
      if (!confirm(list.length === 1 ? `Delete "${list[0].name}"?` : `Delete these ${list.length} items?`)) return;
      list.forEach((e) => { const p = parentOf(e); if (p) delete p[e.name]; });
      sel.clear(); State.save(); render();
    }
    function doRename(e) {
      const nn = prompt("Rename to:", e.name); if (!nn || nn === e.name) return;
      if (/[\\/:*?"<>|]/.test(nn)) { alert('A file name can\'t contain any of these characters: \\ / : * ? " < > |'); return; }
      const p = parentOf(e); if (p[nn]) { alert("There is already a file with that name."); return; }
      p[nn] = e.node; delete p[e.name]; sel.clear(); sel.add(e.path.concat(nn).join("/")); State.save(); render();
    }
    function doPaste() {
      const pl = place(); if (!clip || pl.kind !== "folder") return;
      const dest = kidsAt(pl.path); if (!dest) return;
      for (const c of clip.items) {
        const src = kidsAt(c.path); const node = src && src[c.name]; if (!node) continue;
        if (clip.op === "cut" && pl.path.join("/").startsWith(c.path.concat(c.name).join("/"))) { alert("You can't move a folder into itself."); return; }
        const name = uniqueName(dest, c.name);
        if (clip.op === "copy") { const copy = JSON.parse(JSON.stringify(node)); copy.ts = Date.now(); dest[name] = copy; }
        else { if (src === dest && name !== c.name) continue; delete src[c.name]; dest[c.name === name ? name : uniqueName(dest, c.name)] = node; }
      }
      if (clip.op === "cut") clip = null;
      State.save(); render();
    }
    function setLabel(list, label) { list.forEach((e) => { if (label) e.node.label = label; else delete e.node.label; }); State.save(); render(); }

    function popMenu(anchor, items) {
      document.querySelectorAll(".fx12-pop").forEach((m) => m.remove());
      const m = el(`<div class="fx12-pop"></div>`);
      items.forEach((it) => {
        if (it === "-") { m.appendChild(el(`<div class="fx12-pop-sep"></div>`)); return; }
        const b = el(`<button ${it.disabled ? "disabled" : ""}>${it.ic || ""}<span>${esc(it.t)}</span>${it.check ? '<b class="fx12-check">✓</b>' : ""}</button>`);
        b.onclick = (ev) => { ev.stopPropagation(); m.remove(); it.fn(); };
        m.appendChild(b);
      });
      document.getElementById("screen").appendChild(m);
      const x = anchor.clientX != null ? anchor.clientX : anchor.getBoundingClientRect().left;
      const y = anchor.clientY != null ? anchor.clientY : anchor.getBoundingClientRect().bottom + 4;
      m.style.left = Math.max(4, Math.min(x, window.innerWidth - m.offsetWidth - 8)) + "px";
      m.style.top = Math.max(4, Math.min(y, window.innerHeight - m.offsetHeight - 8)) + "px";
      setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener("mousedown", h); } }), 0);
    }
    function ctxMenu(ev, e) {
      const list = selected().length ? selected() : [e]; const editable = place().kind !== "pc" || e.node.type === "file";
      popMenu(ev, [
        { t: "Open", fn: () => { if (e.node.type === "folder") openFolder(e.path.concat(e.name)); else if (window.VFS) VFS.openNode(e.name, e.node); } },
        ...(e.node.type === "folder" ? [{ t: "Open in new tab", fn: () => { tabs.push({ place: { kind: "folder", path: e.path.concat(e.name) }, back: [], fwd: [] }); ti = tabs.length - 1; sel.clear(); render(); } }] : []),
        ...(e.path.length || e.node.type === "file" ? [{ t: "Open file location", fn: () => openFolder(e.path.slice()) }] : []),
        "-",
        { t: "Cut", ic: I.cut, disabled: !editable, fn: () => { clip = { op: "cut", items: list.map((x) => ({ path: x.path.slice(), name: x.name })) }; render(); } },
        { t: "Copy", ic: I.copy, fn: () => { clip = { op: "copy", items: list.map((x) => ({ path: x.path.slice(), name: x.name })) }; paintTools(); } },
        { t: "Rename", ic: I.rename, disabled: list.length !== 1 || !editable, fn: () => doRename(e) },
        { t: "Delete", ic: I.del, disabled: !editable, fn: () => doDelete(list) },
        "-",
        ...LABELS.map(([k, name, col]) => ({ t: name, ic: `<i class="fx12-dot" style="background:${col}"></i>`, check: e.node.label === k, fn: () => setLabel(list, e.node.label === k ? null : k) })),
        ...(e.node.label ? [{ t: "Remove label", fn: () => setLabel(list, null) }] : []),
      ]);
    }
    function newMenu(anchor) {
      const pl = place(); if (pl.kind !== "folder") return;
      const dest = kidsAt(pl.path);
      const make = (name, node) => { const n = uniqueName(dest, name); dest[n] = node; State.save(); sel.clear(); sel.add(pl.path.concat(n).join("/")); render(); return n; };
      popMenu(anchor, [
        { t: "Folder", ic: glyph("x", { type: "folder" }, 18), fn: () => make("New folder", { type: "folder", children: {} }) },
        { t: "Text document", ic: glyph("a.txt", { type: "file", kind: "text" }, 18), fn: () => { const n = make("New Text Document.txt", { type: "file", kind: "text", content: "", ts: Date.now() }); if (window.VFS) VFS.openNode(n, dest[n]); } },
        { t: "Word document", ic: glyph("a", { type: "file", kind: "word" }, 18), fn: () => { const n = make("Document.docx", { type: "file", kind: "word", content: "", ts: Date.now() }); if (window.VFS) VFS.openNode(n, dest[n]); } },
        { t: "PowerPoint presentation", ic: glyph("a", { type: "file", kind: "pptx" }, 18), fn: () => make("Presentation.pptx", { type: "file", kind: "pptx", content: "", ts: Date.now() }) },
        { t: "Excel worksheet", ic: glyph("a", { type: "file", kind: "xlsx" }, 18), fn: () => make("Book.xlsx", { type: "file", kind: "xlsx", content: "", ts: Date.now() }) },
        "-",
        { t: "Upload from this device…", ic: I.upload, fn: () => {
          const inp = document.getElementById("globalFileInput"); inp.accept = ""; inp.value = ""; inp.multiple = true;
          inp.onchange = () => { const fl = [...inp.files]; inp.multiple = false; if (!fl.length || !window.VFS || !VFS.nodeFromFile) return; Promise.all(fl.map((f) => VFS.nodeFromFile(f).then((node) => make(f.name, node)))).catch(() => {}); };
          inp.click();
        } },
      ]);
    }

    // ---- wiring ----
    body.querySelector(".fx12-tools").addEventListener("click", (ev) => {
      const b = ev.target.closest("button"); if (!b || b.disabled) return; const a = b.dataset.a; const list = selected();
      if (a === "new") newMenu(b);
      else if (a === "cut") { clip = { op: "cut", items: list.map((x) => ({ path: x.path.slice(), name: x.name })) }; render(); }
      else if (a === "copy") { clip = { op: "copy", items: list.map((x) => ({ path: x.path.slice(), name: x.name })) }; paintTools(); }
      else if (a === "paste") doPaste();
      else if (a === "rename" && list[0]) doRename(list[0]);
      else if (a === "delete") doDelete(list);
      else if (a === "sort") popMenu(b, [["name", "Name"], ["date", "Date modified"], ["type", "Type"], ["size", "Size"]].map(([k, t]) => ({ t, check: sortBy === k, fn: () => { sortBy = k; saveView(); render(); } })));
      else if (a === "layout") { layout = layout === "grid" ? "list" : "grid"; saveView(); render(); }
    });
    $('[data-a="back"]').onclick = () => { const t = tab(); if (!t.back.length) return; t.fwd.push(t.place); t.place = t.back.pop(); sel.clear(); render(); };
    $('[data-a="fwd"]').onclick = () => { const t = tab(); if (!t.fwd.length) return; t.back.push(t.place); t.place = t.fwd.pop(); sel.clear(); render(); };
    $('[data-a="up"]').onclick = () => { const pl = place(); if (pl.kind !== "folder") return; if (pl.path.length > 1) openFolder(pl.path.slice(0, -1)); else go({ kind: "pc" }); };
    let sTimer = 0;
    search.oninput = () => {
      clearTimeout(sTimer);
      sTimer = setTimeout(() => {
        const q = search.value.trim(); const pl = place();
        if (!q) { if (pl.kind === "search") { const t = tab(); t.place = t.back.pop() || { kind: "pc" }; sel.clear(); render(); } return; }
        const base = pl.kind === "folder" ? pl.path : pl.kind === "search" ? pl.path : [];
        if (pl.kind === "search") { pl.q = q; sel.clear(); render(); } else go({ kind: "search", q, path: base });
        search.focus();
      }, 180);
    };
    view.addEventListener("click", (ev) => { if (ev.target === view || ev.target.classList.contains("fx12-grid") || ev.target.classList.contains("fx12-sec")) { sel.clear(); paintSel(); } });
    view.addEventListener("contextmenu", (ev) => {
      if (ev.target.closest("[data-k]")) return; ev.preventDefault(); const pl = place();
      popMenu(ev, [
        { t: "New", ic: I.plus, disabled: pl.kind !== "folder", fn: () => newMenu(ev) },
        { t: "Paste", ic: I.paste, disabled: !(clip && pl.kind === "folder"), fn: doPaste },
        "-",
        { t: layout === "grid" ? "Details view" : "Icons view", ic: layout === "grid" ? I.list : I.layout, fn: () => { layout = layout === "grid" ? "list" : "grid"; saveView(); render(); } },
        { t: "Refresh", fn: render },
      ]);
    });
    body.querySelector(".fx12").addEventListener("keydown", (ev) => {
      if (ev.target.tagName === "INPUT") return;
      const list = selected(); const mod = ev.ctrlKey || ev.metaKey;
      if (ev.key === "Delete" && list.length) { ev.preventDefault(); doDelete(list); }
      else if (ev.key === "F2" && list.length === 1) { ev.preventDefault(); doRename(list[0]); }
      else if (mod && ev.key.toLowerCase() === "c" && list.length) { clip = { op: "copy", items: list.map((x) => ({ path: x.path.slice(), name: x.name })) }; paintTools(); }
      else if (mod && ev.key.toLowerCase() === "x" && list.length) { clip = { op: "cut", items: list.map((x) => ({ path: x.path.slice(), name: x.name })) }; render(); }
      else if (mod && ev.key.toLowerCase() === "v") { ev.preventDefault(); doPaste(); }
      else if (mod && ev.key.toLowerCase() === "a") { ev.preventDefault(); currentList.forEach((e) => sel.add(key(e))); paintSel(); }
      else if (ev.key === "Backspace") { ev.preventDefault(); $('[data-a="back"]').click(); }
    });
    render();
  };
  AppRegistry.fileexplorer = AppRegistry.files;

  // Used by the Start menu ("Suggested files", folder shortcuts)
  window.FilesHelper = {
    recent: (n) => { try { return recentFiles(n); } catch (_) { return []; } },
    open: (path) => { window.FilesStartPath = path; WM.open("fileexplorer"); },
    ago,
    glyph,
  };
})();
