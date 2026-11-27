/* Creative apps, part 3: Photos (Windows 11 style) and the Clipchamp-style video editor.
   Photos shows the REAL pictures in Pictures / Desktop / Downloads (plus Image Studio images,
   Snipping Tool snips and the sample wallpapers), with a zoom/pan viewer, slideshow,
   favourites and an editor (crop, rotate/flip, adjustments, filters, markup) that saves a
   copy into Pictures. The video editor trims a clip and exports it with MediaRecorder. */
(function () {
  "use strict";
  const K = window.CrKit; if (!K) return;
  const { el, esc, ico, clamp } = K;

  const SAMPLES = [["wall1", "Bloom", "2026-08-04"], ["wall4", "Sunset Ridge", "2026-08-02"], ["wall2", "Waves", "2026-07-28"], ["wall5", "Aurora", "2026-07-21"], ["wall3", "Windows 12", "2026-07-14"], ["wall6", "Dunes", "2026-06-30"]]
    .map(([f, n, d]) => ({ id: "sample:" + f, name: n, thumb: "assets/" + f + ".jpg", full: "assets/" + f + ".jpg", ts: Date.parse(d + "T12:00:00"), folder: "Samples" }));
  const FOLDERS = [["Pictures", "image"], ["Desktop", "home"], ["Downloads", "download"], ["Image Studio", "sparkle"], ["Screenshots", "crop"], ["Samples", "star"]];

  function pdata() {
    const S = State.data; S.appData = S.appData || {};
    let d = S.appData.photos; if (!d || typeof d !== "object") d = S.appData.photos = {};
    if (!Array.isArray(d.favorites)) d.favorites = [];
    return d;
  }
  function collect() {
    const out = [];
    ["Pictures", "Desktop", "Downloads"].forEach((f) => K.walk([f], (n, name, path) => {
      if (!K.isImage(name, n)) return;
      out.push({ id: "vfs:" + path.join("/"), name: name.replace(/\.[^.]+$/, ""), file: name, thumb: n.src || null, node: n, path, ts: n.ts || 0, folder: f, vfs: true });
    }));
    const S = State.data.appData || {};
    (Array.isArray(S.imageGen) ? S.imageGen : []).forEach((g, i) => { if (g && g.url) out.push({ id: "gen:" + (g.ts || i), name: (g.prompt || "Generated image").slice(0, 48), thumb: g.url, full: g.url, ts: g.ts || 0, folder: "Image Studio" }); });
    (Array.isArray(S.snips) ? S.snips : []).forEach((u, i) => { if (typeof u === "string") out.push({ id: "snip:" + i, name: "Snip " + (i + 1), thumb: u, full: u, ts: 0, folder: "Screenshots" }); });
    return out.concat(SAMPLES);
  }
  const fullURL = (it) => (it.node ? K.nodeURL(it.node).then((u) => u || it.thumb) : Promise.resolve(it.full || it.thumb));
  function dateGroup(ts) {
    if (!ts) return "Earlier";
    const d = new Date(ts), now = new Date(), day = 86400000;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ts >= start) return "Today"; if (ts >= start - day) return "Yesterday"; if (ts >= start - 6 * day) return "This week";
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  let inst = null;
  window.CrPhotos = {
    openNode(name, node) { const api = openApp(); const it = collect().find((x) => x.node === node); if (it) api.view(it); else api.viewTemp({ id: "tmp", name, node, thumb: node.src, vfs: false }); },
  };
  function openApp() { if (inst && inst.winEl.isConnected) { inst.focus(); return inst.api; } build(); return inst.api; }
  AppRegistry.photos = function () { openApp(); };

  function build() {
    const pd = pdata();
    const wref = WM.createWindow({ title: "Photos", icon: Icon.mini("photos", "Photos"), width: Math.min(1000, innerWidth - 24), height: Math.min(680, innerHeight - 110), appId: "photos" });
    const body = wref.body, winEl = body.closest(".win");
    body.innerHTML = `<div class="cr-app cr-ph">
      <aside class="cr-ph-nav">
        <button class="cr-ph-nv" data-v="all">${ico("image")}<span>All photos</span></button>
        <button class="cr-ph-nv" data-v="fav">${ico("heart")}<span>Favorites</span></button>
        <div class="cr-ph-navh">Folders</div>
        ${FOLDERS.map(([f, i]) => `<button class="cr-ph-nv" data-v="f:${f}">${ico(i)}<span>${f}</span></button>`).join("")}
        <div class="cr-ph-navh">Create</div>
        <button class="cr-ph-nv" data-v="video">${ico("film")}<span>Video editor</span></button>
      </aside>
      <main class="cr-ph-main">
        <div class="cr-ph-top"><h1 class="cr-ph-title">All photos</h1><span class="cr-dim cr-ph-count"></span><span class="cr-grow"></span>
          <label class="cr-ph-search">${ico("search", 16)}<input placeholder="Search photos" aria-label="Search photos"></label>
          <button class="cr-btn" data-a="import">${ico("upload", 16)}<span>Import</span></button>
          <button class="cr-btn cr-primary" data-a="show">${ico("slideshow", 16)}<span>Slideshow</span></button></div>
        <div class="cr-ph-scroll"></div>
      </main>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const root = $(".cr-ph"), scroll = $(".cr-ph-scroll");
    let view = "all", query = "", current = [];
    function setNav() { body.querySelectorAll(".cr-ph-nv").forEach((n) => n.classList.toggle("on", n.dataset.v === view)); }
    function items() {
      let all = collect();
      if (view === "fav") all = all.filter((i) => pd.favorites.includes(i.id));
      else if (view.startsWith("f:")) all = all.filter((i) => i.folder === view.slice(2));
      if (query) all = all.filter((i) => (i.name + " " + (i.folder || "")).toLowerCase().includes(query));
      return all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }
    function render() {
      setNav(); current = items();
      $(".cr-ph-title").textContent = view === "all" ? "All photos" : view === "fav" ? "Favorites" : view.slice(2);
      $(".cr-ph-count").textContent = current.length + " item" + (current.length === 1 ? "" : "s");
      scroll.innerHTML = "";
      if (!current.length) {
        scroll.appendChild(el(`<div class="cr-ph-empty">${ico(view === "fav" ? "heart" : "image", 48)}<h2>${view === "fav" ? "No favorites yet" : "No photos here yet"}</h2><p class="cr-dim">${view === "fav" ? "Open a photo and tap the heart to add it here." : "Import photos from this device, save a drawing from Paint, or take a snip."}</p></div>`));
        return;
      }
      let group = null, grid = null;
      current.forEach((it, i) => {
        const g = dateGroup(it.ts);
        if (g !== group) { group = g; scroll.appendChild(el(`<h3 class="cr-ph-gh">${esc(g)}</h3>`)); grid = el(`<div class="cr-ph-grid"></div>`); scroll.appendChild(grid); }
        const t = el(`<button class="cr-ph-tile" title="${esc(it.name)}">${it.thumb ? `<img src="${esc(it.thumb)}" alt="" loading="lazy">` : `<span class="cr-ph-noth">${ico("image", 28)}</span>`}${pd.favorites.includes(it.id) ? `<i class="cr-ph-favb">${ico("heartfill", 14)}</i>` : ""}<span class="cr-ph-tn">${esc(it.name)}</span></button>`);
        const im = t.querySelector("img"); if (im) im.onerror = () => { im.replaceWith(el(`<span class="cr-ph-noth">${ico("image", 28)}</span>`)); };
        t.onclick = () => viewer(current, i);
        grid.appendChild(t);
      });
    }
    body.querySelectorAll(".cr-ph-nv").forEach((n) => (n.onclick = () => { if (n.dataset.v === "video") { AppRegistry.clipchamp(); return; } view = n.dataset.v; render(); }));
    $(".cr-ph-search input").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); render(); });
    $('[data-a="import"]').onclick = importPhotos;
    $('[data-a="show"]').onclick = () => { if (current.length) slideshow(current, 0); };
    async function importPhotos() {
      const files = await K.pickDevice("image/*", true); if (!files.length) return;
      let ok = 0, fail = 0;
      for (const f of files) {
        try {
          let node;
          if (window.VFS && VFS.nodeFromFile) node = await VFS.nodeFromFile(f);
          if (node && node.kind === "image") {
            const kids = K.folder(["Pictures"], true), name = K.uniqueName(kids, f.name); kids[name] = node;
            if (!K.trySave()) { delete kids[name]; K.trySave(); throw Object.assign(new Error(K.quotaMsg()), { quota: true }); }
          } else {
            const u = URL.createObjectURL(f); const img = await K.loadImage(u); URL.revokeObjectURL(u);
            await K.saveImage(["Pictures"], f.name.replace(/\.[^.]+$/, "") + ".jpg", K.fitCanvas(img, 2048, "#fff"), { jpeg: true });
          }
          ok++;
        } catch (e) { fail++; if (e.quota) { K.alertBox(root, "Storage is full", e.message); break; } }
      }
      K.vfsChanged("photos");
      K.notify("Photos", `Imported ${ok} photo${ok === 1 ? "" : "s"} into Pictures${fail ? " (" + fail + " couldn't be imported)" : ""}.`, "photos");
      view = "f:Pictures"; render();
    }
    const onVfs = () => { if (!body.isConnected) return; render(); };
    window.addEventListener("vfs-change", onVfs);
    winEl.addEventListener("wm-cleanup", () => { window.removeEventListener("vfs-change", onVfs); K.closePop(); if (inst && inst.winEl === winEl) inst = null; });

    // ---------- viewer ----------
    function viewer(list, idx) {
      const ov = el(`<div class="cr-ph-viewer" tabindex="-1">
        <div class="cr-ph-vbar">
          <button class="cr-ib" data-v="back" title="Back (Esc)">${ico("chevL")}</button><span class="cr-ph-vname"></span><span class="cr-grow"></span>
          <button class="cr-ib" data-v="zout" title="Zoom out (−)">${ico("zoomout")}</button><span class="cr-ph-zv">100%</span><button class="cr-ib" data-v="zin" title="Zoom in (+)">${ico("zoom")}</button><button class="cr-ib" data-v="fit" title="Fit (0)">${ico("fit")}</button>
          <span class="cr-vsep"></span>
          <button class="cr-ib" data-v="fav" title="Favorite">${ico("heart")}</button>
          <button class="cr-btn cr-small" data-v="edit">${ico("edit", 16)} Edit</button>
          <button class="cr-ib" data-v="show" title="Slideshow">${ico("slideshow")}</button>
          <button class="cr-ib" data-v="more" title="More">${ico("more")}</button>
        </div>
        <div class="cr-ph-vstage"><img class="cr-ph-vimg" alt="" draggable="false"><button class="cr-ph-arrow l" title="Previous">${ico("chevL", 26)}</button><button class="cr-ph-arrow r" title="Next">${ico("chevR", 26)}</button></div>
        <div class="cr-ph-film"></div>
      </div>`);
      root.appendChild(ov);
      const stage = ov.querySelector(".cr-ph-vstage"), img = ov.querySelector(".cr-ph-vimg"), film = ov.querySelector(".cr-ph-film");
      let z = { s: 1, x: 0, y: 0, fit: 1 }, iw = 1, ih = 1, token = 0;
      const apply = () => { img.style.transform = `translate(${z.x}px,${z.y}px) scale(${z.s})`; ov.querySelector(".cr-ph-zv").textContent = Math.round(z.s * 100) + "%"; };
      function fit() { const r = stage.getBoundingClientRect(); z.fit = Math.min((r.width - 24) / iw, (r.height - 24) / ih, 1) || 1; z.s = z.fit; z.x = (r.width - iw * z.s) / 2; z.y = (r.height - ih * z.s) / 2; apply(); }
      function zoomAt(f, cx, cy) { const r = stage.getBoundingClientRect(); if (cx == null) { cx = r.width / 2; cy = r.height / 2; } const ns = clamp(z.s * f, z.fit * 0.5, 8); const k = ns / z.s; z.x = cx - (cx - z.x) * k; z.y = cy - (cy - z.y) * k; z.s = ns; apply(); }
      function show(i) {
        idx = (i + list.length) % list.length; const it = list[idx]; const my = ++token;
        ov.querySelector(".cr-ph-vname").textContent = it.name + (it.folder ? "  ·  " + it.folder : "");
        const fav = pd.favorites.includes(it.id); const fb = ov.querySelector('[data-v="fav"]'); fb.innerHTML = ico(fav ? "heartfill" : "heart"); fb.classList.toggle("cr-fav-on", fav); fb.title = fav ? "Remove from favorites" : "Add to favorites";
        const setSrc = (u) => { if (!u || my !== token) return; img.onload = () => { if (my !== token) return; iw = img.naturalWidth || 1; ih = img.naturalHeight || 1; fit(); }; img.src = u; };
        if (it.thumb) setSrc(it.thumb);
        fullURL(it).then((u) => { if (u && u !== it.thumb) setSrc(u); });
        film.querySelectorAll("button").forEach((b, j) => b.classList.toggle("on", j === idx));
        const cur = film.children[idx]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "center" });
        ov.querySelectorAll(".cr-ph-arrow").forEach((a) => (a.hidden = list.length < 2));
      }
      list.slice(0, 400).forEach((it, j) => { const b = el(`<button>${it.thumb ? `<img src="${esc(it.thumb)}" alt="">` : ico("image", 18)}</button>`); b.onclick = () => show(j); film.appendChild(b); });
      const close = () => { ov.remove(); window.removeEventListener("keydown", onKey); ro.disconnect(); };
      ov.querySelector('[data-v="back"]').onclick = close;
      ov.querySelector('[data-v="zin"]').onclick = () => zoomAt(1.25);
      ov.querySelector('[data-v="zout"]').onclick = () => zoomAt(0.8);
      ov.querySelector('[data-v="fit"]').onclick = fit;
      ov.querySelector(".cr-ph-arrow.l").onclick = () => show(idx - 1);
      ov.querySelector(".cr-ph-arrow.r").onclick = () => show(idx + 1);
      ov.querySelector('[data-v="fav"]').onclick = () => { const id = list[idx].id; const i = pd.favorites.indexOf(id); if (i >= 0) pd.favorites.splice(i, 1); else pd.favorites.push(id); try { State.save(); } catch (e) {} show(idx); render(); };
      ov.querySelector('[data-v="edit"]').onclick = () => editor(list[idx]);
      ov.querySelector('[data-v="show"]').onclick = () => slideshow(list, idx);
      ov.querySelector('[data-v="more"]').onclick = (e) => {
        const it = list[idx];
        K.menu(e.currentTarget, [
          { label: "Open in Paint", icon: "brush", onClick: () => fullURL(it).then((u) => AppRegistry.paint({ open: { url: u, name: (it.file || it.name + ".png"), path: it.path || null } })) },
          { label: "Download", icon: "download", onClick: () => fullURL(it).then((u) => K.download(u, it.file || it.name + ".jpg")) },
          { label: "Set as desktop background", icon: "image", onClick: () => setWallpaper(it) },
          it.vfs ? { sep: true } : null,
          it.vfs ? { label: "Delete", icon: "trash", onClick: () => del(it) } : null,
        ]);
      };
      async function del(it) {
        if (!(await K.confirmBox(root, "Delete this photo?", "“" + (it.file || it.name) + "” will be removed from " + it.path.slice(0, -1).join(" › ") + ".", "Delete"))) return;
        const kids = K.folder(it.path.slice(0, -1)); if (kids) delete kids[it.path[it.path.length - 1]];
        K.trySave() || State.save(); K.vfsChanged("photos");
        list.splice(idx, 1); film.children[idx] && film.children[idx].remove();
        if (!list.length) close(); else show(idx);
      }
      // pointer: pan / pinch / swipe / double-tap
      const ptrs = new Map(); let g = null, lastTap = 0;
      stage.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".cr-ph-arrow")) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { stage.setPointerCapture(e.pointerId); } catch (_) {}
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; g = { kind: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), s: z.s, x: z.x, y: z.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; return; }
        g = { kind: "pan", sx: e.clientX, sy: e.clientY, x: z.x, y: z.y, moved: false };
        const now = Date.now(); if (now - lastTap < 300) { const r = stage.getBoundingClientRect(); if (z.s > z.fit * 1.05) fit(); else zoomAt(2.2, e.clientX - r.left, e.clientY - r.top); g = null; lastTap = 0; return; } lastTap = now;
      });
      stage.addEventListener("pointermove", (e) => {
        if (!ptrs.has(e.pointerId) || !g) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (g.kind === "pinch" && ptrs.size >= 2) { const [a, b] = [...ptrs.values()], r = stage.getBoundingClientRect(); const ns = clamp(g.s * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(10, g.d), z.fit * 0.5, 8), k = ns / g.s; const cx = g.mx - r.left, cy = g.my - r.top; z.s = ns; z.x = cx - (cx - g.x) * k + ((a.x + b.x) / 2 - g.mx); z.y = cy - (cy - g.y) * k + ((a.y + b.y) / 2 - g.my); apply(); return; }
        if (g.kind === "pan") { const dx = e.clientX - g.sx, dy = e.clientY - g.sy; if (Math.abs(dx) + Math.abs(dy) > 4) g.moved = true; if (z.s > z.fit * 1.02) { z.x = g.x + dx; z.y = g.y + dy; apply(); } else { img.style.transform = `translate(${z.x + dx}px,${z.y}px) scale(${z.s})`; } }
      });
      const end = (e) => {
        ptrs.delete(e.pointerId);
        if (g && g.kind === "pan" && z.s <= z.fit * 1.02) { const dx = e.clientX - g.sx; if (dx < -60) show(idx + 1); else if (dx > 60) show(idx - 1); else apply(); }
        if (!ptrs.size) g = null;
      };
      stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
      stage.addEventListener("wheel", (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
      const onKey = (e) => {
        if (!K.isTop(winEl) || K.typingTarget(e.target) || !ov.isConnected || root.querySelector(".cr-ph-editor,.cr-ph-show,.cr-dlg-mask")) return;
        if (e.key === "ArrowRight") show(idx + 1); else if (e.key === "ArrowLeft") show(idx - 1);
        else if (e.key === "Escape") close(); else if (e.key === "+" || e.key === "=") zoomAt(1.25); else if (e.key === "-") zoomAt(0.8); else if (e.key === "0") fit();
        else return; e.preventDefault();
      };
      window.addEventListener("keydown", onKey);
      const ro = new ResizeObserver(() => fit()); ro.observe(stage);
      show(idx); ov.focus();
      return { show, close };
    }
    function setWallpaper(it) {
      fullURL(it).then((u) => K.loadImage(u)).then((im) => {
        const url = K.fitCanvas(im, 1920, "#000").toDataURL("image/jpeg", 0.82);
        const prev = State.data.desktop.wallpaper; State.data.desktop.wallpaper = url;
        if (!K.trySave()) { State.data.desktop.wallpaper = prev; K.trySave(); K.alertBox(root, "Storage is full", K.quotaMsg()); return; }
        if (window.applyWallpaper) applyWallpaper(); K.notify("Photos", "Desktop background updated.", "photos");
      }).catch(() => K.alertBox(root, "Photos", "This picture can't be used as a background."));
    }

    // ---------- slideshow ----------
    function slideshow(list, start) {
      const ov = el(`<div class="cr-ph-show"><img class="a" alt=""><img class="b" alt=""><div class="cr-ph-showbar"><button class="cr-ib" data-s="prev">${ico("prev")}</button><button class="cr-ib" data-s="pp">${ico("pause")}</button><button class="cr-ib" data-s="next">${ico("next")}</button><span class="cr-ph-showc"></span><button class="cr-ib" data-s="x" title="Exit (Esc)">${ico("close")}</button></div></div>`);
      root.appendChild(ov);
      const imgs = [ov.querySelector("img.a"), ov.querySelector("img.b")]; let front = 0, i = start - 1, paused = false, t = 0;
      function step(d) {
        i = (i + d + list.length) % list.length; const it = list[i];
        fullURL(it).then((u) => { const back = imgs[1 - front]; back.onload = () => { back.classList.add("on"); imgs[front].classList.remove("on"); front = 1 - front; }; back.src = u || it.thumb; });
        ov.querySelector(".cr-ph-showc").textContent = (i + 1) + " / " + list.length;
        clearTimeout(t); if (!paused) t = setTimeout(() => step(1), 3500);
      }
      const exit = () => { clearTimeout(t); ov.remove(); window.removeEventListener("keydown", onKey); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} };
      ov.querySelector('[data-s="x"]').onclick = exit;
      ov.querySelector('[data-s="prev"]').onclick = () => step(-1);
      ov.querySelector('[data-s="next"]').onclick = () => step(1);
      ov.querySelector('[data-s="pp"]').onclick = (e) => { paused = !paused; e.currentTarget.innerHTML = ico(paused ? "play" : "pause"); clearTimeout(t); if (!paused) t = setTimeout(() => step(1), 2000); };
      ov.addEventListener("click", (e) => { if (!e.target.closest(".cr-ph-showbar")) ov.classList.toggle("cr-bar-on"); });
      const onKey = (e) => { if (!K.isTop(winEl)) return; if (e.key === "Escape") exit(); else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); else if (e.key === " ") ov.querySelector('[data-s="pp"]').click(); else return; e.preventDefault(); };
      window.addEventListener("keydown", onKey);
      try { if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {}); } catch (e) {}
      step(1);
    }

    // ---------- editor ----------
    function editor(it) {
      const ov = el(`<div class="cr-ph-editor">
        <div class="cr-ph-ebar"><button class="cr-ib" data-e="x" title="Close without saving">${ico("close")}</button><b class="cr-ph-ename"></b><span class="cr-grow"></span>
          <button class="cr-btn cr-small" data-e="undo" title="Undo last markup stroke">${ico("undo", 16)} Undo</button><button class="cr-btn cr-small" data-e="reset">${ico("refresh", 16)} Reset</button><button class="cr-btn cr-small cr-primary" data-e="save">${ico("save", 16)} Save a copy</button></div>
        <div class="cr-ph-ebody">
          <div class="cr-ph-estage"><canvas class="cr-ph-ecv"></canvas><div class="cr-ph-crop" hidden><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i><i data-h="n"></i><i data-h="s"></i><i data-h="e"></i><i data-h="w"></i></div><div class="cr-ph-eload"><div class="cr-spin"></div></div></div>
          <aside class="cr-ph-epanel">
            <div class="cr-ph-etabs"><button data-t="crop">${ico("crop", 16)}<span>Crop</span></button><button data-t="adjust">${ico("adjust", 16)}<span>Adjust</span></button><button data-t="filter">${ico("filter", 16)}<span>Filter</span></button><button data-t="markup">${ico("edit", 16)}<span>Markup</span></button></div>
            <div class="cr-ph-epane"></div>
          </aside>
        </div></div>`);
      root.appendChild(ov);
      ov.querySelector(".cr-ph-ename").textContent = it.name;
      const stage = ov.querySelector(".cr-ph-estage"), cv = ov.querySelector(".cr-ph-ecv"), cg = cv.getContext("2d"), cropEl = ov.querySelector(".cr-ph-crop"), pane = ov.querySelector(".cr-ph-epane");
      let base = null, geoC = null, mk = null, tab = "adjust";
      let rot = 0, fh = false, fv = false, crop = null, aspect = "free";
      const ADJ = { brightness: 0, exposure: 0, contrast: 0, saturation: 0, warmth: 0, vignette: 0 };
      let adj = Object.assign({}, ADJ), filter = "orig", amount = 100;
      let pen = { tool: "pen", color: "#ff3b30", size: 8 }; const mkUndo = [];
      let view = { p: 1, ox: 0, oy: 0 }, raf = 0, tainted = false, geoVer = 0, pcache = { key: "", c: null };
      const close = () => { ov.remove(); };
      ov.querySelector('[data-e="x"]').onclick = close;

      fullURL(it).then((u) => K.loadImage(u)).catch(() => K.loadImage(it.thumb)).then((im) => {
        base = K.fitCanvas(im, 2048);
        try { base.getContext("2d").getImageData(0, 0, 1, 1); } catch (e) { tainted = true; }
        rebuildGeo(true); ov.querySelector(".cr-ph-eload").remove(); setTab("adjust");
      }).catch(() => { ov.querySelector(".cr-ph-eload").innerHTML = `<p>This picture couldn't be opened for editing.</p>`; });

      function rebuildGeo(resetCrop) {
        const sw = rot % 180 ? base.height : base.width, sh = rot % 180 ? base.width : base.height;
        geoC = K.mkCanvas(sw, sh); geoVer++; const g = geoC.getContext("2d");
        g.translate(sw / 2, sh / 2); g.rotate(rot * Math.PI / 180); g.scale(fh ? -1 : 1, fv ? -1 : 1); g.drawImage(base, -base.width / 2, -base.height / 2);
        if (!mk || mk.width !== sw || mk.height !== sh) { if (!mk) mk = K.mkCanvas(sw, sh); }
        if (resetCrop || !crop) crop = { x: 0, y: 0, w: sw, h: sh };
        draw();
      }
      function geoTransform(kind) {
        // rotate/flip the markup layer along with the photo
        const old = mk; let nm;
        if (kind === "l" || kind === "r") { nm = K.mkCanvas(old.height, old.width); const g = nm.getContext("2d"); g.translate(nm.width / 2, nm.height / 2); g.rotate(kind === "r" ? Math.PI / 2 : -Math.PI / 2); g.drawImage(old, -old.width / 2, -old.height / 2); }
        else { nm = K.mkCanvas(old.width, old.height); const g = nm.getContext("2d"); g.translate(nm.width / 2, nm.height / 2); g.scale(kind === "h" ? -1 : 1, kind === "v" ? -1 : 1); g.drawImage(old, -old.width / 2, -old.height / 2); }
        nm.getContext("2d").setTransform(1, 0, 0, 1, 0, 0); // further markup must not inherit the rotation
        mk = nm; mkUndo.length = 0;
        if (kind === "l") rot = (rot + 270) % 360; else if (kind === "r") rot = (rot + 90) % 360;
        else { // flipping in screen space = flip of the oriented image
          if ((kind === "h") === (rot % 180 === 0)) fh = !fh; else fv = !fv;
        }
        rebuildGeo(true); if (aspect !== "free") applyAspect(aspect);
      }

      // --- pixel pipeline ---
      const F = {
        orig: null,
        punch: (r, g, b, o) => { const l = .3 * r + .59 * g + .11 * b; o[0] = (l + (r - l) * 1.35 - 128) * 1.12 + 128; o[1] = (l + (g - l) * 1.35 - 128) * 1.12 + 128; o[2] = (l + (b - l) * 1.35 - 128) * 1.12 + 128; },
        golden: (r, g, b, o) => { o[0] = r * 1.08 + 12; o[1] = g * 1.02 + 6; o[2] = b * 0.85; },
        radiate: (r, g, b, o) => { o[0] = 255 - (255 - r) * 0.82; o[1] = 255 - (255 - g) * 0.85; o[2] = 255 - (255 - b) * 0.88; },
        warmcon: (r, g, b, o) => { o[0] = (r * 1.06 + 10 - 128) * 1.2 + 128; o[1] = (g - 128) * 1.2 + 128; o[2] = (b * 0.9 - 128) * 1.2 + 128; },
        calm: (r, g, b, o) => { const l = .3 * r + .59 * g + .11 * b; o[0] = (l + (r - l) * 0.7) * 0.9 + 22; o[1] = (l + (g - l) * 0.7) * 0.9 + 24; o[2] = (l + (b - l) * 0.7) * 0.9 + 28; },
        coollight: (r, g, b, o) => { o[0] = r * 0.92 + 14; o[1] = g * 0.98 + 16; o[2] = b * 1.05 + 24; },
        vividcool: (r, g, b, o) => { const l = .3 * r + .59 * g + .11 * b; o[0] = (l + (r - l) * 1.3) * 0.94; o[1] = l + (g - l) * 1.3; o[2] = (l + (b - l) * 1.3) * 1.1 + 6; },
        dramacool: (r, g, b, o) => { const l = .3 * r + .59 * g + .11 * b; o[0] = ((l + (r - l) * 0.6) - 128) * 1.35 + 120; o[1] = ((l + (g - l) * 0.6) - 128) * 1.35 + 124; o[2] = ((l + (b - l) * 0.6) - 128) * 1.35 + 138; },
        bw: (r, g, b, o) => { const l = .3 * r + .59 * g + .11 * b; o[0] = o[1] = o[2] = (l - 128) * 1.1 + 128; },
        bwcool: (r, g, b, o) => { const l = .3 * r + .59 * g + .11 * b; o[0] = l * 0.95; o[1] = l * 0.99; o[2] = l * 1.06 + 8; },
        sepia: (r, g, b, o) => { o[0] = r * .393 + g * .769 + b * .189; o[1] = r * .349 + g * .686 + b * .168; o[2] = r * .272 + g * .534 + b * .131; },
        film: (r, g, b, o) => { const l = .3 * r + .59 * g + .11 * b; o[0] = (l + (r - l) * 0.8) * 0.86 + 24; o[1] = (l + (g - l) * 0.8) * 0.88 + 26; o[2] = (l + (b - l) * 0.8) * 0.8 + 22; },
        fade: (r, g, b, o) => { const l = .3 * r + .59 * g + .11 * b; o[0] = (l + (r - l) * 0.75) * 0.8 + 40; o[1] = (l + (g - l) * 0.75) * 0.8 + 40; o[2] = (l + (b - l) * 0.75) * 0.8 + 44; },
      };
      const FNAMES = [["orig", "Original"], ["punch", "Punch"], ["golden", "Golden"], ["radiate", "Radiate"], ["warmcon", "Warm contrast"], ["calm", "Calm"], ["coollight", "Cool light"], ["vividcool", "Vivid cool"], ["dramacool", "Dramatic cool"], ["bw", "B&W"], ["bwcool", "B&W cool"], ["sepia", "Sepia"], ["film", "Film"], ["fade", "Fade"]];
      function process(c, a, fname, amt) {
        if (tainted) return;
        const g = c.getContext("2d"); const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
        const ex = Math.pow(2, a.exposure / 100 * 1.5), br = a.brightness / 100 * 70, ct = a.contrast >= 0 ? 1 + a.contrast / 100 * 1.2 : 1 + a.contrast / 100 * 0.8;
        const sat = 1 + a.saturation / 100, wm = a.warmth / 100 * 28, fn = F[fname], k = amt / 100, o = [0, 0, 0];
        const ident = !fn && !a.exposure && !a.brightness && !a.contrast && !a.saturation && !a.warmth; if (ident) return;
        for (let i = 0; i < d.length; i += 4) {
          let r = d[i] * ex + br, gg = d[i + 1] * ex + br, b = d[i + 2] * ex + br;
          if (ct !== 1) { r = (r - 128) * ct + 128; gg = (gg - 128) * ct + 128; b = (b - 128) * ct + 128; }
          if (sat !== 1) { const l = .299 * r + .587 * gg + .114 * b; r = l + (r - l) * sat; gg = l + (gg - l) * sat; b = l + (b - l) * sat; }
          if (wm) { r += wm; gg += wm * 0.25; b -= wm; }
          if (fn) { fn(r, gg, b, o); r += (o[0] - r) * k; gg += (o[1] - gg) * k; b += (o[2] - b) * k; }
          d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = gg < 0 ? 0 : gg > 255 ? 255 : gg; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        }
        g.putImageData(id, 0, 0);
      }
      function vignette(c, v) {
        if (!v) return; const g = c.getContext("2d"), w = c.width, h = c.height, R = Math.hypot(w, h) / 2;
        const gr = g.createRadialGradient(w / 2, h / 2, R * 0.35, w / 2, h / 2, R); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, `rgba(0,0,0,${(v / 100) * 0.85})`);
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
      // render (region of geo) -> canvas of size (w,h)
      function renderTo(w, h, region, withMarkup) {
        const c = K.mkCanvas(w, h), g = c.getContext("2d"); g.imageSmoothingQuality = "high";
        g.drawImage(geoC, region.x, region.y, region.w, region.h, 0, 0, w, h);
        process(c, adj, filter, amount); vignette(c, adj.vignette);
        if (withMarkup) g.drawImage(mk, region.x, region.y, region.w, region.h, 0, 0, w, h);
        return c;
      }
      function draw() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawNow(); }); }
      function drawNow() {
        if (!geoC || !ov.isConnected) return;
        const r = stage.getBoundingClientRect(), pad = 28, sw = Math.max(50, r.width - pad * 2), sh = Math.max(50, r.height - pad * 2);
        const region = tab === "crop" ? { x: 0, y: 0, w: geoC.width, h: geoC.height } : crop;
        const p = Math.min(sw / region.w, sh / region.h, 4);
        const dw = Math.max(1, Math.round(region.w * p)), dh = Math.max(1, Math.round(region.h * p));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const pw = Math.min(Math.round(dw * dpr), region.w > dw * dpr ? Math.round(dw * dpr) : region.w * Math.ceil(dpr)), ph = Math.round(pw * dh / dw);
        const key = [region.x, region.y, region.w, region.h, pw, ph, JSON.stringify(adj), filter, amount, geoVer].join("|");
        if (pcache.key !== key) { pcache = { key, c: renderTo(pw, ph, region, false) }; }
        if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
        cv.style.width = dw + "px"; cv.style.height = dh + "px";
        cg.clearRect(0, 0, pw, ph); cg.drawImage(pcache.c, 0, 0);
        cg.drawImage(mk, region.x, region.y, region.w, region.h, 0, 0, pw, ph);
        if (strokeC) { cg.globalAlpha = 0.4; cg.drawImage(strokeC, region.x, region.y, region.w, region.h, 0, 0, pw, ph); cg.globalAlpha = 1; }
        view = { p, ox: (r.width - dw) / 2, oy: (r.height - dh) / 2, region };
        cv.style.left = view.ox + "px"; cv.style.top = view.oy + "px";
        cropEl.hidden = tab !== "crop";
        if (tab === "crop") placeCrop();
      }
      function placeCrop() { Object.assign(cropEl.style, { left: view.ox + crop.x * view.p + "px", top: view.oy + crop.y * view.p + "px", width: crop.w * view.p + "px", height: crop.h * view.p + "px" }); }
      const ro = new ResizeObserver(draw); ro.observe(stage);
      const mo = new MutationObserver(() => { if (!ov.isConnected) { ro.disconnect(); mo.disconnect(); } }); mo.observe(root, { childList: true });

      // --- crop interaction ---
      const ASPECTS = [["free", "Free"], ["orig", "Original"], ["1", "Square"], ["4:3", "4:3"], ["3:2", "3:2"], ["16:9", "16:9"], ["9:16", "9:16"], ["3:4", "3:4"]];
      const ratioOf = (a) => (a === "free" ? null : a === "orig" ? geoC.width / geoC.height : a === "1" ? 1 : (([x, y]) => x / y)(a.split(":").map(Number)));
      function applyAspect(a) {
        aspect = a; const R = a === "orig" ? geoC.width / geoC.height : ratioOf(a);
        if (R) { let w = geoC.width, h = w / R; if (h > geoC.height) { h = geoC.height; w = h * R; } crop = { x: (geoC.width - w) / 2, y: (geoC.height - h) / 2, w, h }; }
        draw();
      }
      cropEl.addEventListener("pointerdown", (e) => {
        e.preventDefault(); try { cropEl.setPointerCapture(e.pointerId); } catch (_) {}
        const h = e.target.dataset.h || "move", s = { x: e.clientX, y: e.clientY, c: Object.assign({}, crop) };
        const R = aspect === "free" ? null : aspect === "orig" ? geoC.width / geoC.height : ratioOf(aspect);
        const mv = (ev) => {
          const dx = (ev.clientX - s.x) / view.p, dy = (ev.clientY - s.y) / view.p, c0 = s.c, W = geoC.width, H = geoC.height;
          let { x, y, w, h: hh } = c0;
          if (h === "move") { x = clamp(c0.x + dx, 0, W - c0.w); y = clamp(c0.y + dy, 0, H - c0.h); }
          else {
            if (h.includes("w")) { x = clamp(c0.x + dx, 0, c0.x + c0.w - 16); w = c0.x + c0.w - x; }
            if (h.includes("e")) w = clamp(c0.w + dx, 16, W - c0.x);
            if (h.includes("n")) { y = clamp(c0.y + dy, 0, c0.y + c0.h - 16); hh = c0.y + c0.h - y; }
            if (h.includes("s")) hh = clamp(c0.h + dy, 16, H - c0.y);
            if (R) {
              if (h === "n" || h === "s") w = hh * R; else hh = w / R;
              if (h.includes("n")) y = c0.y + c0.h - hh; if (h.includes("w")) x = c0.x + c0.w - w;
              if (x < 0 || y < 0 || x + w > W + 0.5 || y + hh > H + 0.5) return;
            }
          }
          crop = { x, y, w, h: hh }; placeCrop();
        };
        const up = () => { cropEl.removeEventListener("pointermove", mv); cropEl.removeEventListener("pointerup", up); cropEl.removeEventListener("pointercancel", up); };
        cropEl.addEventListener("pointermove", mv); cropEl.addEventListener("pointerup", up); cropEl.addEventListener("pointercancel", up);
      });

      // --- markup drawing ---
      let strokeC = null, last = null, drawing = false;
      cv.addEventListener("pointerdown", (e) => {
        if (tab !== "markup") return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
        drawing = true; mkUndo.push(mk.getContext("2d").getImageData(0, 0, mk.width, mk.height)); if (mkUndo.length > 12) mkUndo.shift();
        strokeC = pen.tool === "highlighter" ? K.mkCanvas(mk.width, mk.height) : null;
        last = toGeo(e); dot(e, last, last);
      });
      cv.addEventListener("pointermove", (e) => { if (!drawing) return; const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; (evs.length ? evs : [e]).forEach((ev) => { const p = toGeo(ev); dot(ev, last, p); last = p; }); drawNow(); });
      const endDraw = () => { if (!drawing) return; drawing = false; if (strokeC) { const g = mk.getContext("2d"); g.globalAlpha = 0.4; g.drawImage(strokeC, 0, 0); g.globalAlpha = 1; strokeC = null; } draw(); };
      cv.addEventListener("pointerup", endDraw); cv.addEventListener("pointercancel", endDraw);
      function toGeo(e) { const r = cv.getBoundingClientRect(); return { x: view.region.x + (e.clientX - r.left) / view.p, y: view.region.y + (e.clientY - r.top) / view.p }; }
      function dot(e, a, b) {
        const target = strokeC || mk, g = target.getContext("2d");
        const pr = e.pointerType === "pen" ? clamp(e.pressure || 0.5, 0.1, 1) * 1.4 : 1;
        g.lineCap = pen.tool === "highlighter" ? "square" : "round"; g.lineJoin = "round";
        g.lineWidth = (pen.tool === "highlighter" ? pen.size * 3 : pen.size) * pr / view.p;
        g.globalCompositeOperation = pen.tool === "eraser" ? "destination-out" : "source-over";
        g.strokeStyle = pen.color; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x + (a.x === b.x && a.y === b.y ? 0.01 : 0), b.y); g.stroke();
        g.globalCompositeOperation = "source-over";
      }
      ov.querySelector('[data-e="undo"]').onclick = () => { const s = mkUndo.pop(); if (s && s.width === mk.width && s.height === mk.height) { mk.getContext("2d").putImageData(s, 0, 0); draw(); } };

      // --- panels ---
      function setTab(t) {
        tab = t; ov.querySelectorAll("[data-t]").forEach((b) => b.classList.toggle("on", b.dataset.t === t)); cv.style.cursor = t === "markup" ? "crosshair" : "default";
        pane.innerHTML = "";
        if (t === "crop") {
          pane.appendChild(el(`<h4>Aspect ratio</h4>`));
          const ar = el(`<div class="cr-chips"></div>`); ASPECTS.forEach(([k, n]) => { const b = el(`<button class="cr-chip${aspect === k ? " on" : ""}">${n}</button>`); b.onclick = () => { applyAspect(k); ar.querySelectorAll(".cr-chip").forEach((x) => x.classList.toggle("on", x === b)); }; ar.appendChild(b); }); pane.appendChild(ar);
          pane.appendChild(el(`<h4>Rotate and flip</h4>`));
          const rr = el(`<div class="cr-row cr-wrap"><button class="cr-btn cr-small" data-g="l">${ico("rotL", 16)} Left</button><button class="cr-btn cr-small" data-g="r">${ico("rotate", 16)} Right</button><button class="cr-btn cr-small" data-g="h">${ico("flipH", 16)} Flip H</button><button class="cr-btn cr-small" data-g="v">${ico("flipV", 16)} Flip V</button></div>`);
          rr.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => geoTransform(b.dataset.g))); pane.appendChild(rr);
          pane.appendChild(el(`<p class="cr-dim">Drag the corners or edges of the frame, or drag inside it to move it.</p>`));
          const rb = el(`<button class="cr-btn cr-small">Reset crop</button>`); rb.onclick = () => { aspect = "free"; crop = { x: 0, y: 0, w: geoC.width, h: geoC.height }; setTab("crop"); }; pane.appendChild(rb);
        } else if (t === "adjust") {
          if (tainted) pane.appendChild(el(`<p class="cr-warn">This picture comes from another website, so colour changes can't be applied. Crop, rotate and markup still work.</p>`));
          [["brightness", "Brightness", -100, 100], ["exposure", "Exposure", -100, 100], ["contrast", "Contrast", -100, 100], ["saturation", "Saturation", -100, 100], ["warmth", "Warmth", -100, 100], ["vignette", "Vignette", 0, 100]].forEach(([k, n, mn, mx]) => {
            const r = el(`<label class="cr-field cr-ph-adj"><span>${n}<output>${adj[k]}</output></span><input type="range" min="${mn}" max="${mx}" value="${adj[k]}" data-k="${k}"></label>`);
            const inp = r.querySelector("input"); inp.oninput = () => { adj[k] = +inp.value; r.querySelector("output").textContent = inp.value; draw(); };
            inp.ondblclick = () => { adj[k] = 0; inp.value = 0; r.querySelector("output").textContent = 0; draw(); };
            pane.appendChild(r);
          });
        } else if (t === "filter") {
          const thumb = K.fitCanvas(renderSmall(), 96);
          const grid = el(`<div class="cr-ph-fgrid"></div>`);
          FNAMES.forEach(([k, n]) => {
            const c = K.mkCanvas(thumb.width, thumb.height); c.getContext("2d").drawImage(thumb, 0, 0);
            if (F[k] && !tainted) process(c, ADJ, k, 100);
            const b = el(`<button class="cr-ph-f${filter === k ? " on" : ""}"><span></span><b>${n}</b></button>`); b.querySelector("span").appendChild(c);
            b.onclick = () => { filter = k; grid.querySelectorAll(".cr-ph-f").forEach((x) => x.classList.toggle("on", x === b)); draw(); };
            grid.appendChild(b);
          });
          pane.appendChild(grid);
          const r = el(`<label class="cr-field cr-ph-adj"><span>Filter intensity<output>${amount}</output></span><input type="range" min="0" max="100" value="${amount}"></label>`);
          r.querySelector("input").oninput = (e) => { amount = +e.target.value; r.querySelector("output").textContent = amount; draw(); };
          pane.appendChild(r);
        } else if (t === "markup") {
          const tools = el(`<div class="cr-row"><button class="cr-btn cr-small" data-m="pen">${ico("edit", 16)} Pen</button><button class="cr-btn cr-small" data-m="highlighter">${ico("highlighter", 16)} Highlighter</button><button class="cr-btn cr-small" data-m="eraser">${ico("eraser", 16)} Eraser</button></div>`);
          const sync = () => tools.querySelectorAll("[data-m]").forEach((b) => b.classList.toggle("cr-primary", b.dataset.m === pen.tool));
          tools.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { pen.tool = b.dataset.m; if (pen.tool === "highlighter" && pen.color === "#ff3b30") pen.color = "#ffe600"; sync(); syncCols(); })); sync();
          pane.appendChild(tools);
          const cols = el(`<div class="cr-ph-cols"></div>`);
          const syncCols = () => cols.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.c === pen.color));
          ["#000000", "#ffffff", "#ff3b30", "#ff9500", "#ffe600", "#34c759", "#00c7be", "#007aff", "#af52de", "#ff2d92"].forEach((c) => { const b = el(`<button data-c="${c}" style="background:${c}" title="${c}"></button>`); b.onclick = () => { pen.color = c; syncCols(); }; cols.appendChild(b); });
          pane.appendChild(cols); syncCols();
          const sz = el(`<label class="cr-field cr-ph-adj"><span>Size<output>${pen.size}</output></span><input type="range" min="1" max="48" value="${pen.size}"></label>`);
          sz.querySelector("input").oninput = (e) => { pen.size = +e.target.value; sz.querySelector("output").textContent = pen.size; };
          pane.appendChild(sz);
          const clr = el(`<button class="cr-btn cr-small">${ico("trash", 16)} Clear all markup</button>`); clr.onclick = () => { mkUndo.push(mk.getContext("2d").getImageData(0, 0, mk.width, mk.height)); mk.getContext("2d").clearRect(0, 0, mk.width, mk.height); draw(); };
          pane.appendChild(clr);
          pane.appendChild(el(`<p class="cr-dim">Draw on the photo with your finger, mouse or Apple Pencil (pressure works).</p>`));
        }
        draw();
      }
      function renderSmall() { const k = Math.min(1, 240 / Math.max(crop.w, crop.h)); const c = K.mkCanvas(crop.w * k, crop.h * k); c.getContext("2d").drawImage(geoC, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height); return c; }
      ov.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { if (geoC) setTab(b.dataset.t); }));
      ov.querySelector('[data-e="reset"]').onclick = () => { if (!geoC) return; rot = 0; fh = fv = false; aspect = "free"; adj = Object.assign({}, ADJ); filter = "orig"; amount = 100; mk = null; mkUndo.length = 0; rebuildGeo(true); setTab(tab); };
      ov.querySelector('[data-e="save"]').onclick = async (e) => {
        if (!geoC) return; const btn = e.currentTarget; btn.disabled = true;
        try {
          const cw = Math.round(crop.w), ch = Math.round(crop.h);
          const out = renderTo(cw, ch, { x: Math.round(crop.x), y: Math.round(crop.y), w: cw, h: ch }, true);
          const r = await K.saveImage(["Pictures"], (it.name || "Photo").replace(/[\\/:*?"<>|]/g, "_") + " (edited).jpg", out, { jpeg: true });
          K.notify("Photos", "Saved a copy: Pictures › " + r.name, "photos");
          close(); render();
        } catch (err) { btn.disabled = false; K.alertBox(root, "Couldn't save", err.quota ? err.message : (/tainted|insecure|security/i.test(String(err.message || err)) ? "This picture comes from another website and can't be saved from here. Download it first, then import it." : String(err.message || err))); }
      };
      ov.__ed = { setTab, get adj() { return adj; }, set: (k, v) => { adj[k] = v; draw(); }, setFilter: (f) => { filter = f; draw(); }, aspect: applyAspect, rotate: geoTransform, get crop() { return crop; } };
    }

    render();
    const api = { view: (it) => { const l = items(); let i = l.findIndex((x) => x.id === it.id); if (i < 0) { view = "all"; render(); i = Math.max(0, current.findIndex((x) => x.id === it.id)); return viewer(current, i); } return viewer(l, i); }, viewTemp: (it) => viewer([it], 0), render, editor, items: () => current, go: (v) => { view = v; render(); } };
    inst = { winEl, focus: wref.focus, api };
    winEl.__photos = api;
  }

  // ======================================================================
  // Video editor (Clipchamp-style): trim with handles, preview, export
  // ======================================================================
  K.registerApp({ id: "clipchamp", name: "Clipchamp", cat: "Multimedia", price: 0, builtin: "clipchamp", desc: "Video editor — trim a clip with handles on a thumbnail timeline, preview it and export a video file." });
  const CAN_EXPORT = typeof window.MediaRecorder !== "undefined" && !!(window.HTMLCanvasElement && HTMLCanvasElement.prototype.captureStream);
  function pickMime() {
    if (!CAN_EXPORT) return null;
    const list = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    for (const m of list) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
    return "";
  }
  const fmtT = (s) => { if (!isFinite(s) || s < 0) s = 0; const m = Math.floor(s / 60), x = s - m * 60; return m + ":" + (x < 10 ? "0" : "") + x.toFixed(1); };
  // MediaRecorder WebM files often report duration = Infinity until scanned.
  function realDuration(v) {
    return new Promise((res) => {
      if (isFinite(v.duration) && v.duration > 0) return res(v.duration);
      const done = () => { v.removeEventListener("durationchange", chk); const d = v.duration; try { v.currentTime = 0; } catch (e) {} res(isFinite(d) ? d : 0); };
      const chk = () => { if (isFinite(v.duration) && v.duration > 0) done(); };
      v.addEventListener("durationchange", chk);
      try { v.currentTime = 1e7; } catch (e) { res(0); }
      setTimeout(done, 4000);
    });
  }
  const once = (t, ev, ms) => new Promise((res) => { let to; const f = () => { clearTimeout(to); t.removeEventListener(ev, f); res(true); }; t.addEventListener(ev, f); to = setTimeout(() => { t.removeEventListener(ev, f); res(false); }, ms || 3000); });

  AppRegistry.clipchamp = function (opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const wref = WM.createWindow({ title: "Clipchamp — Video editor", icon: Icon.mini("clipchamp", "Clipchamp"), width: Math.min(1000, innerWidth - 24), height: Math.min(680, innerHeight - 110), appId: "clipchamp" });
    const body = wref.body, winEl = body.closest(".win");
    const mime = pickMime();
    body.innerHTML = `<div class="cr-app cr-cc">
      <div class="cr-cc-top"><span class="cr-cc-logo">${ico("film", 18)}</span><input class="cr-cc-name" value="My video" aria-label="Video name"><span class="cr-grow"></span>
        <button class="cr-btn" data-a="dev">${ico("upload", 16)}<span>Import from device</span></button><button class="cr-btn" data-a="vfs">${ico("folder", 16)}<span>Open from Videos</span></button>
        <button class="cr-btn cr-primary" data-a="export" disabled>${ico("download", 16)}<span>Export</span></button></div>
      ${CAN_EXPORT ? "" : `<div class="cr-cc-warn">${ico("info", 16)} This browser can't record video (no MediaRecorder / canvas capture — common on older iPadOS). You can still trim and preview; export needs Chrome, Edge, Firefox or Safari 14.1+.</div>`}
      <div class="cr-cc-main">
        <div class="cr-cc-prev"><video class="cr-cc-video" playsinline preload="auto"></video>
          <div class="cr-cc-empty">${ico("film", 48)}<h2>Start a new video</h2><p class="cr-dim">Import a clip from this device or open one from your Videos folder. Then drag the handles on the timeline to trim it.</p></div></div>
      </div>
      <div class="cr-cc-ctl"><button class="cr-ib" data-a="play" title="Play / pause (Space)">${ico("play")}</button><span class="cr-cc-time">0:00.0 / 0:00.0</span><span class="cr-grow"></span>
        <button class="cr-btn cr-small" data-a="in" title="Set start at playhead (I)">[ Set start</button><button class="cr-btn cr-small" data-a="out" title="Set end at playhead (O)">Set end ]</button>
        <button class="cr-btn cr-small" data-a="psel">${ico("play", 14)} Play selection</button><label class="cr-check"><input type="checkbox" class="cr-cc-loop"> Loop</label><button class="cr-btn cr-small" data-a="reset">Reset trim</button></div>
      <div class="cr-cc-tl"><div class="cr-cc-info"><b>Selection</b> <span class="cr-cc-sel">—</span></div>
        <div class="cr-cc-track"><div class="cr-cc-strip"></div><div class="cr-cc-shade l"></div><div class="cr-cc-shade r"></div><div class="cr-cc-win"><i class="cr-cc-h l" title="Drag to set the start"></i><i class="cr-cc-h r" title="Drag to set the end"></i></div><div class="cr-cc-ph"></div></div>
        <div class="cr-cc-ruler"></div></div>
      <div class="cr-cc-exp" hidden><div class="cr-cc-expbox"><h3>Exporting…</h3><div class="cr-cc-bar"><i></i></div><p class="cr-dim cr-cc-expmsg">Recording your trimmed clip in real time.</p><button class="cr-btn cr-small" data-a="cancel">Cancel</button></div></div>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const root = $(".cr-cc"), video = $(".cr-cc-video"), track = $(".cr-cc-track"), strip = $(".cr-cc-strip"), winBox = $(".cr-cc-win"), ph = $(".cr-cc-ph");
    let src = null, dur = 0, tin = 0, tout = 0, name = "My video", thumbJob = 0, playingSel = false, cancelExport = null;
    const MIN = 0.2;
    function layout() {
      if (!dur) { winBox.style.left = "0"; winBox.style.width = "100%"; return; }
      const W = track.clientWidth, x0 = tin / dur * W, x1 = tout / dur * W;
      winBox.style.left = x0 + "px"; winBox.style.width = Math.max(2, x1 - x0) + "px";
      $(".cr-cc-shade.l").style.width = x0 + "px"; $(".cr-cc-shade.r").style.left = x1 + "px";
      ph.style.left = (video.currentTime / dur * W) + "px";
      $(".cr-cc-sel").textContent = fmtT(tin) + " → " + fmtT(tout) + "  (" + fmtT(tout - tin) + " of " + fmtT(dur) + ")";
      $(".cr-cc-time").textContent = fmtT(video.currentTime) + " / " + fmtT(dur);
    }
    function ruler() {
      const r = $(".cr-cc-ruler"); r.innerHTML = ""; if (!dur) return;
      const steps = Math.min(10, Math.max(2, Math.floor(track.clientWidth / 90)));
      for (let i = 0; i <= steps; i++) r.appendChild(el(`<span style="left:${i / steps * 100}%">${fmtT(dur * i / steps)}</span>`));
    }
    async function thumbs() {
      const job = ++thumbJob; strip.innerHTML = ""; if (!src || !dur) return;
      const n = clamp(Math.floor(track.clientWidth / 72), 4, 16), h = track.clientHeight || 56;
      const tv = document.createElement("video"); tv.muted = true; tv.playsInline = true; tv.preload = "auto"; tv.src = src;
      await once(tv, "loadeddata", 4000);
      for (let i = 0; i < n; i++) {
        if (job !== thumbJob || !body.isConnected) break;
        const c = K.mkCanvas(Math.round(h * 16 / 9), h); strip.appendChild(c);
        try { tv.currentTime = Math.min(dur - 0.05, (i + 0.5) / n * dur); await once(tv, "seeked", 2500); const g = c.getContext("2d"); const k = Math.max(c.width / tv.videoWidth, c.height / tv.videoHeight); g.drawImage(tv, (c.width - tv.videoWidth * k) / 2, (c.height - tv.videoHeight * k) / 2, tv.videoWidth * k, tv.videoHeight * k); } catch (e) {}
      }
      tv.removeAttribute("src"); try { tv.load(); } catch (e) {}
    }
    async function load(url, nm) {
      src = url; name = (nm || "My video").replace(/\.[^.]+$/, ""); $(".cr-cc-name").value = name + " (trimmed)";
      $(".cr-cc-empty").hidden = true; video.hidden = false; video.src = url;
      await once(video, "loadedmetadata", 6000);
      dur = await realDuration(video); if (!dur) { K.alertBox(root, "Clipchamp", "This video can't be read in this browser."); return; }
      tin = 0; tout = dur; video.currentTime = 0;
      $('[data-a="export"]').disabled = !CAN_EXPORT;
      layout(); ruler(); thumbs();
    }
    // handles + scrubbing
    function timeAt(clientX) { const r = track.getBoundingClientRect(); return clamp((clientX - r.left) / r.width, 0, 1) * dur; }
    track.addEventListener("pointerdown", (e) => {
      if (!dur) return; e.preventDefault(); try { track.setPointerCapture(e.pointerId); } catch (_) {}
      const h = e.target.classList.contains("cr-cc-h") ? (e.target.classList.contains("l") ? "in" : "out") : "seek";
      const mv = (ev) => {
        const t = timeAt(ev.clientX);
        if (h === "in") { tin = clamp(t, 0, tout - MIN); video.currentTime = tin; }
        else if (h === "out") { tout = clamp(t, tin + MIN, dur); video.currentTime = tout; }
        else video.currentTime = t;
        layout();
      };
      const up = () => { track.removeEventListener("pointermove", mv); track.removeEventListener("pointerup", up); track.removeEventListener("pointercancel", up); };
      track.addEventListener("pointermove", mv); track.addEventListener("pointerup", up); track.addEventListener("pointercancel", up); mv(e);
    });
    function checkSel() { if (playingSel && video.currentTime >= tout - 0.03) { if ($(".cr-cc-loop").checked) video.currentTime = tin; else { video.pause(); playingSel = false; video.currentTime = tout; } } }
    video.addEventListener("timeupdate", () => { checkSel(); layout(); });
    let rafT = 0; const loop = () => { if (!video.paused) { checkSel(); layout(); rafT = requestAnimationFrame(loop); } };
    video.addEventListener("play", () => { $('[data-a="play"]').innerHTML = ico("pause"); cancelAnimationFrame(rafT); loop(); });
    video.addEventListener("pause", () => { $('[data-a="play"]').innerHTML = ico("play"); });
    video.addEventListener("click", () => playPause());
    function playPause() { if (!dur) return; if (video.paused) { if (video.currentTime < tin || video.currentTime >= tout - 0.05) video.currentTime = tin; playingSel = true; video.play().catch(() => {}); } else video.pause(); }
    $('[data-a="play"]').onclick = playPause;
    $('[data-a="psel"]').onclick = () => { if (!dur) return; video.currentTime = tin; playingSel = true; video.play().catch(() => {}); };
    $('[data-a="in"]').onclick = () => { if (!dur) return; tin = clamp(video.currentTime, 0, tout - MIN); layout(); };
    $('[data-a="out"]').onclick = () => { if (!dur) return; tout = clamp(video.currentTime, tin + MIN, dur); layout(); };
    $('[data-a="reset"]').onclick = () => { if (!dur) return; tin = 0; tout = dur; layout(); };
    $('[data-a="dev"]').onclick = async () => { const [f] = await K.pickDevice("video/*,.mp4,.webm,.mov,.m4v", false); if (f) load(URL.createObjectURL(f), f.name); };
    $('[data-a="vfs"]').onclick = () => {
      const vids = []; ["Videos", "Downloads", "Desktop", "Music"].forEach((d) => K.walk([d], (n, nm, p) => { if (K.mediaKind(nm, n) === "video") vids.push({ n, nm, p }); }));
      const box = el(`<div class="cr-cc-pick"></div>`);
      if (!vids.length) box.appendChild(el(`<p class="cr-dim">No videos in Videos, Downloads or Desktop yet. Use <b>Import from device</b>, or add videos in Media Player.</p>`));
      let choice = null;
      const pr = K.dialog(root, { title: "Open a video", body: box, buttons: [{ label: "Cancel", value: null }] });
      vids.forEach((v) => { const b = el(`<button class="cr-cc-pickrow">${ico("video", 18)}<span>${esc(v.nm)}</span><span class="cr-dim">${esc(v.p.slice(0, -1).join(" › "))}${v.n.size ? " · " + K.fmtSize(v.n.size) : ""}</span></button>`); b.onclick = () => { choice = v; box.closest(".cr-dlg-mask").querySelector(".cr-dlg-btns .cr-btn").click(); }; box.appendChild(b); });
      pr.then(async () => { if (!choice) return; const u = await K.nodeURL(choice.n); if (u) load(u, choice.nm); else K.alertBox(root, "Clipchamp", "This video's contents aren't on this device."); });
    };
    $('[data-a="export"]').onclick = () => exportClip();
    $('[data-a="cancel"]').onclick = () => { if (cancelExport) cancelExport(); };
    async function exportClip() {
      if (!CAN_EXPORT || !src || !dur) return;
      video.pause();
      const ex = $(".cr-cc-exp"), bar = $(".cr-cc-bar i"), msg = $(".cr-cc-expmsg"); ex.hidden = false; bar.style.width = "0%"; msg.textContent = "Recording your trimmed clip in real time (" + fmtT(tout - tin) + ").";
      const ev = document.createElement("video"); ev.playsInline = true; ev.preload = "auto"; ev.src = src;
      ev.style.cssText = "position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0;pointer-events:none"; document.body.appendChild(ev);
      let actx = null, stopped = false, rec = null, chunks = [];
      const cleanup = () => { try { ev.pause(); ev.removeAttribute("src"); ev.load(); ev.remove(); } catch (e) {} try { if (actx) actx.close(); } catch (e) {} cancelExport = null; };
      try {
        await once(ev, "loadeddata", 6000);
        const vw = ev.videoWidth || 640, vh = ev.videoHeight || 360, k = Math.min(1, 1280 / Math.max(vw, vh));
        const c = K.mkCanvas(Math.round(vw * k / 2) * 2, Math.round(vh * k / 2) * 2), g = c.getContext("2d");
        g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
        const stream = c.captureStream(30);
        try { const AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); const node = actx.createMediaElementSource(ev); const dest = actx.createMediaStreamDestination(); node.connect(dest); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch (e) { actx = null; ev.muted = true; }
        rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 }) : new MediaRecorder(stream);
        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        const stoppedP = new Promise((res) => (rec.onstop = res));
        ev.currentTime = tin; await once(ev, "seeked", 3000);
        g.drawImage(ev, 0, 0, c.width, c.height);
        rec.start(250);
        cancelExport = () => { stopped = "cancel"; };
        try { await ev.play(); } catch (e) { ev.muted = true; await ev.play(); }
        await new Promise((res) => {
          const frame = () => {
            if (stopped) return res();
            g.drawImage(ev, 0, 0, c.width, c.height);
            const p = clamp((ev.currentTime - tin) / (tout - tin), 0, 1); bar.style.width = (p * 100).toFixed(1) + "%";
            if (ev.currentTime >= tout || ev.ended) { stopped = stopped || "done"; return res(); }
            requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        });
        ev.pause(); rec.stop(); await stoppedP;
        if (stopped === "cancel") { cleanup(); ex.hidden = true; return; }
        const type = (rec.mimeType || mime || "video/webm").split(";")[0];
        const blob = new Blob(chunks, { type }); const ext = /mp4/.test(type) ? ".mp4" : ".webm";
        const fname = ($(".cr-cc-name").value.trim() || name).replace(/[\\/:*?"<>|]/g, "_") + ext;
        cleanup();
        let savedMsg = "";
        try { const r = await K.saveMedia(["Videos"], fname, blob, "video"); savedMsg = "Saved to Videos › " + r.name + "."; }
        catch (e) { savedMsg = e.quota ? "Not saved to Videos: storage is full." : "Not saved to Videos (bigger than " + K.fmtSize(K.MEDIA_IDB_CAP) + ") — use the download."; }
        K.download(blob, fname);
        ex.hidden = true;
        const url = URL.createObjectURL(blob);
        const box = el(`<div class="cr-cc-done"><video src="${url}" controls playsinline></video><p>${esc(fname)} · ${K.fmtSize(blob.size)}</p><p class="cr-dim">${esc(savedMsg)} The file was also downloaded.</p></div>`);
        K.dialog(root, { title: "Your video is ready", body: box, buttons: [{ label: "Download again", value: "dl" }, { label: "Done", primary: true, value: "ok" }] }).then((v) => { if (v === "dl") K.download(blob, fname); setTimeout(() => URL.revokeObjectURL(url), 30000); });
        K.notify("Clipchamp", "Exported " + fname + ". " + savedMsg, "clipchamp");
        winEl.__lastExport = { size: blob.size, type, name: fname, saved: savedMsg };
      } catch (e) {
        cleanup(); ex.hidden = true;
        K.alertBox(root, "Export failed", "The video couldn't be exported: " + (e.message || e) + ". You can still trim and preview it.");
        winEl.__lastExport = { error: String(e.message || e) };
      }
    }
    const onKey = (e) => {
      if (!K.isTop(winEl) || K.typingTarget(e.target) || root.querySelector(".cr-dlg-mask")) return;
      if (e.key === " ") { e.preventDefault(); playPause(); } else if (e.key === "i") $('[data-a="in"]').click(); else if (e.key === "o") $('[data-a="out"]').click();
      else if (e.key === "ArrowLeft" && dur) { video.currentTime = Math.max(0, video.currentTime - 1 / 30 * (e.shiftKey ? 30 : 1)); } else if (e.key === "ArrowRight" && dur) { video.currentTime = Math.min(dur, video.currentTime + 1 / 30 * (e.shiftKey ? 30 : 1)); }
    };
    window.addEventListener("keydown", onKey);
    const ro = new ResizeObserver(() => { layout(); ruler(); clearTimeout(ro.t); ro.t = setTimeout(thumbs, 300); }); ro.observe(track);
    winEl.addEventListener("wm-cleanup", () => { window.removeEventListener("keydown", onKey); ro.disconnect(); thumbJob++; if (cancelExport) cancelExport(); try { video.pause(); } catch (e) {} });
    video.hidden = true;
    if (o.url) load(o.url, o.name);
    else if (o.node) K.nodeURL(o.node).then((u) => u && load(u, o.name));
    winEl.__cc = { load, get state() { return { dur, tin, tout, src }; }, setTrim: (a, b) => { tin = a; tout = b; layout(); }, exportClip, CAN_EXPORT, mime };
  };
})();
