/* Shared virtual filesystem + Windows-style Open/Save dialogs. Backs the Files
   app and lets Word/PowerPoint save & open documents. Data lives in
   appData.files.root (same store the Files app uses). File node kinds:
   "text" (.txt), "word" (.docx, html), "pptx" (slides json), "image". */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const screen = () => document.getElementById("screen");

  function seed() {
    return {
      Desktop: { type: "folder", children: {} },
      Documents: { type: "folder", children: {} },
      Downloads: { type: "folder", children: {} },
      Pictures: { type: "folder", children: {} },
      Music: { type: "folder", children: {} },
    };
  }
  function ensure() {
    if (!S().appData) S().appData = {};
    if (!S().appData.files || !S().appData.files.root) S().appData.files = { root: seed() };
    return S().appData.files.root;
  }
  function childrenAt(path) {
    let ch = ensure();
    for (const seg of (path || [])) { const n = ch[seg]; if (!n || n.type !== "folder") return null; ch = n.children; }
    return ch;
  }
  function uniqueName(children, base, ext) {
    ext = ext || ""; let name = base + ext, i = 1;
    while (children[name]) name = base + " (" + (i++) + ")" + ext;
    return name;
  }

  const svg = (inner) => `<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px">${inner}</svg>`;
  const doc = (color) => svg(`<path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" fill="${color}"/><path d="M14 3v4h4" fill="#fff" opacity=".55"/>`);
  const KIND_ICON = {
    folder: svg(`<path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" fill="#f6c945"/>`),
    text: doc("#8a94a6"), word: doc("#2b579a"), pptx: doc("#c43e1c"), xlsx: doc("#217346"),
    image: svg(`<rect x="4" y="4" width="16" height="16" rx="2" fill="#5a8def"/><circle cx="9" cy="9" r="2" fill="#fff"/><path d="M5 18l4-4 3 3 3-4 4 5Z" fill="#fff"/>`),
    other: doc("#8a94a6"),
  };
  const KIND_EXT = { text: ".txt", word: ".docx", pptx: ".pptx", xlsx: ".xlsx", image: ".png" };

  // Windows-style Open / Save dialog.
  // mode: "open"|"save"; opts: { title, accept:[kinds], defaultName, kind }
  function fileDialog(mode, opts, cb) {
    opts = opts || {};
    const accept = opts.accept || null; // array of kinds to show for open
    let path = ["Documents"];
    let selected = null;
    const overlay = el(`<div class="fdlg-mask">
      <div class="fdlg">
        <div class="fdlg-head">${esc(opts.title || (mode === "save" ? "Save As" : "Open"))}</div>
        <div class="fdlg-body">
          <div class="fdlg-side"></div>
          <div class="fdlg-main">
            <div class="fdlg-crumbs"></div>
            <div class="fdlg-list"></div>
          </div>
        </div>
        <div class="fdlg-foot">
          ${mode === "save" ? `<label class="fdlg-fn">File name: <input class="fdlg-name" value="${esc(opts.defaultName || "Untitled")}"></label>` : `<span class="fdlg-fn muted" id="fdlgSel">No file selected</span>`}
          <span class="grow"></span>
          <button class="btn-text fdlg-cancel">Cancel</button>
          <button class="pill-btn fdlg-ok">${mode === "save" ? "Save" : "Open"}</button>
        </div>
      </div></div>`);
    const side = overlay.querySelector(".fdlg-side");
    const crumbs = overlay.querySelector(".fdlg-crumbs");
    const list = overlay.querySelector(".fdlg-list");
    const nameInput = overlay.querySelector(".fdlg-name");
    const selLabel = overlay.querySelector("#fdlgSel");
    const okBtn = overlay.querySelector(".fdlg-ok");

    ["Desktop", "Documents", "Downloads", "Pictures", "Music"].concat(ensure().Homework ? ["Homework"] : []).forEach((q) => {
      const b = el(`<button class="fdlg-quick">${KIND_ICON.folder} ${q}</button>`);
      b.onclick = () => { path = [q]; render(); };
      side.appendChild(b);
    });

    function accepts(node) { return !accept || (node.kind && accept.indexOf(node.kind) >= 0); }

    function render() {
      // breadcrumbs
      crumbs.innerHTML = "";
      const mk = (label, p) => { const c = el(`<button class="fdlg-crumb">${esc(label)}</button>`); c.onclick = () => { path = p; selected = null; render(); }; crumbs.appendChild(c); };
      mk("This PC", []);
      path.forEach((seg, i) => { crumbs.appendChild(el(`<span class="fdlg-sep">›</span>`)); mk(seg, path.slice(0, i + 1)); });
      // list
      list.innerHTML = "";
      const ch = childrenAt(path) || {};
      const entries = Object.entries(ch).sort((a, b) => {
        const fa = a[1].type === "folder", fb = b[1].type === "folder";
        if (fa !== fb) return fa ? -1 : 1; return a[0].localeCompare(b[0]);
      });
      let shown = 0;
      entries.forEach(([nm, node]) => {
        const isFolder = node.type === "folder";
        if (!isFolder && !accepts(node)) return;
        shown++;
        const kind = isFolder ? "folder" : (node.kind || "other");
        const row = el(`<button class="fdlg-row ${selected === nm ? "sel" : ""}"><span class="fdlg-row-ic">${KIND_ICON[kind] || KIND_ICON.other}</span><span class="fdlg-row-nm">${esc(nm)}</span></button>`);
        row.onclick = () => {
          if (isFolder) { path = path.concat(nm); selected = null; render(); return; }
          selected = nm;
          if (mode === "save" && nameInput) nameInput.value = nm.replace(/\.[a-z0-9]+$/i, "");
          if (selLabel) selLabel.textContent = nm;
          list.querySelectorAll(".fdlg-row").forEach((r) => r.classList.remove("sel"));
          row.classList.add("sel");
        };
        row.ondblclick = () => { if (!isFolder && mode === "open") { finishOpen(nm, node); } };
        list.appendChild(row);
      });
      if (!shown) list.appendChild(el(`<div class="muted" style="padding:20px;text-align:center">This folder is empty${accept ? " (of this file type)" : ""}.</div>`));
    }

    function finishOpen(nm, node) { close(); cb({ path: path.slice(), name: nm, node: node }); }
    function close() { overlay.remove(); }

    overlay.querySelector(".fdlg-cancel").onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    okBtn.onclick = () => {
      if (mode === "open") {
        if (!selected) return;
        finishOpen(selected, childrenAt(path)[selected]);
      } else {
        let base = (nameInput.value || "Untitled").trim().replace(/\.[a-z0-9]+$/i, "") || "Untitled";
        const ext = KIND_EXT[opts.kind] || "";
        const ch = childrenAt(path);
        const finalName = base + ext;
        close();
        cb({ path: path.slice(), name: finalName, children: ch });
      }
    };
    render();
    screen().appendChild(overlay);
  }

  // ---- Big file contents live in IndexedDB (localStorage is only ~5 MB on iPad Safari).
  // A file node keeps just { blob: "<id>" }; the bytes are stored here once and shared by copies.
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try { const r = indexedDB.open("win12-files", 1); r.onupgradeneeded = () => r.result.createObjectStore("blobs"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); }
    });
    return dbp;
  }
  function putBlob(blob) {
    const id = "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    return db().then((d) => new Promise((res, rej) => { const t = d.transaction("blobs", "readwrite"); t.objectStore("blobs").put(blob, id); t.oncomplete = () => res(id); t.onerror = () => rej(t.error); }));
  }
  function getBlob(id) {
    return db().then((d) => new Promise((res, rej) => { const q = d.transaction("blobs").objectStore("blobs").get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }));
  }
  // Shrink a photo: returns { blob (max 1600 px JPEG), thumb (small data URL for icons) }.
  function shrinkImage(file) {
    return new Promise((res) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const fit = (max) => { const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k)); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); return c; };
        const thumb = fit(240).toDataURL("image/jpeg", 0.7);
        fit(1600).toBlob((b) => { URL.revokeObjectURL(url); res({ blob: b || file, thumb }); }, "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); res({ blob: file, thumb: null }); };
      img.src = url;
    });
  }
  // Turn a real File into a file node (text stays inline; everything else goes to IndexedDB).
  function nodeFromFile(file) {
    const isImg = /^image\//.test(file.type) || /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(file.name);
    const isText = !isImg && (/^text\/|json|javascript|xml/.test(file.type) || /\.(txt|md|csv|js|py|html|css|json)$/i.test(file.name));
    if (isText && file.size < 400000) return file.text().then((t) => ({ type: "file", kind: "text", content: t, size: file.size, ts: Date.now() }));
    if (isImg) return shrinkImage(file).then(({ blob, thumb }) => putBlob(blob).then((id) => ({ type: "file", kind: "image", blob: id, src: thumb || undefined, size: blob.size, mime: "image/jpeg", ts: Date.now() })));
    return putBlob(file).then((id) => ({ type: "file", kind: "other", blob: id, size: file.size, mime: file.type, ts: Date.now() }));
  }

  window.VFS = {
    ensure, childrenAt, uniqueName, seed, putBlob, getBlob, nodeFromFile,
    pickFile: (opts, cb) => fileDialog("open", opts, cb),
    pickSave: (opts, cb) => fileDialog("save", opts, cb),
    // Open a file node in the right app.
    openNode(name, node) {
      if (!node || node.type !== "file") return;
      if (node.blob && !node._loading) {
        getBlob(node.blob).then((b) => {
          if (!b) { if (window.Notify) Notify.show({ icon: "", title: name, body: "This file's contents aren't on this device." }); return; }
          const url = URL.createObjectURL(b);
          if (node.kind === "image") window.VFS.openNode(name, { type: "file", kind: "image", src: url, _loading: true });
          else { const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        });
        return;
      }
      if (node.kind === "word" || node.kind === "text") { if (window.Office) window.Office.openWord({ name, node }); }
      else if (node.kind === "pptx") { if (window.Office) window.Office.openPowerPoint({ name, node }); }
      else if (node.kind === "xlsx") { if (window.Office) window.Office.openExcel({ name, node }); }
      else if (node.kind === "image" && node.src) {
        const ov = el(`<div class="bf-mask"><div class="bf-big"><div class="bf-big-img"><img src="${node.src}" alt=""></div><div class="bf-big-name">${esc(name)}</div><div class="row" style="justify-content:center"><button class="btn-text" id="cl">Close</button></div></div></div>`);
        ov.querySelector("#cl").onclick = () => ov.remove(); ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
        screen().appendChild(ov);
      }
      else if (node.src) { const a = document.createElement("a"); a.href = node.src; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
    },
  };
})();
