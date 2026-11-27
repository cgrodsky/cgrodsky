/* Creative apps, part 4: Sticky Notes that live ON the desktop (Windows 11 style).
   Notes are small coloured cards inside the window manager's .desktop element (re-attached
   whenever WM.buildDesktop() rebuilds it), draggable / resizable with mouse, touch and pen,
   with bold / italic / underline / strikethrough / bullet lists and seven colours. Stored in
   appData.stickynotes; the older appData.stickyNotesV2 notes are migrated (and mirrored back
   as plain text so the old shape keeps working). The app window is the notes list. */
(function () {
  "use strict";
  const K = window.CrKit; if (!K) return;
  const { el, esc, ico, clamp } = K;

  const COLORS = {
    yellow: { name: "Yellow", bg: "#fff7d1", head: "#fff2ab", text: "#2b2600" },
    green: { name: "Green", bg: "#e4f9e0", head: "#cbf1c4", text: "#0d2a0a" },
    pink: { name: "Pink", bg: "#ffe4f1", head: "#ffcce5", text: "#3a0a22" },
    purple: { name: "Purple", bg: "#f2e6ff", head: "#e7cfff", text: "#25103a" },
    blue: { name: "Blue", bg: "#e2f1ff", head: "#cde9ff", text: "#062540" },
    grey: { name: "Grey", bg: "#f3f2f1", head: "#e0e0e0", text: "#201f1e" },
    charcoal: { name: "Charcoal", bg: "#4a4a4a", head: "#3b3b3b", text: "#f3f3f3" },
  };
  const ORDER = ["yellow", "green", "pink", "purple", "blue", "grey", "charcoal"];
  const OLD_COLORS = ["yellow", "pink", "green", "blue", "purple", "grey"]; // stickyNotesV2 colour indexes
  const textToHtml = (t) => esc(String(t || "")).replace(/\n/g, "<br>");
  function htmlToText(h) { const d = document.createElement("div"); d.innerHTML = String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<li>/gi, "\n• ").replace(/<\/?(div|p|ul|ol|li)>/gi, "\n"); return (d.textContent || "").replace(/[ \t]*\n\s*\n+/g, "\n").trim(); }
  const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "UL", "OL", "LI", "BR", "DIV", "P"]);
  function sanitize(html) {
    const t = document.createElement("template"); t.innerHTML = String(html || "").slice(0, 40000);
    (function clean(node) {
      [...node.childNodes].forEach((c) => {
        if (c.nodeType === 3) return;
        if (c.nodeType !== 1) { c.remove(); return; }
        clean(c);
        if (!ALLOWED.has(c.tagName)) { if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|IMG|SVG|VIDEO|AUDIO)$/.test(c.tagName)) c.remove(); else c.replaceWith(...c.childNodes); return; }
        [...c.attributes].forEach((a) => c.removeAttribute(a.name));
      });
    })(t.content);
    return t.innerHTML;
  }

  function sdata() {
    const S = State.data; S.appData = S.appData || {};
    const A = S.appData; let d = A.stickynotes;
    if (!d || typeof d !== "object" || !Array.isArray(d.notes)) {
      d = A.stickynotes = { notes: [], v: 3 };
      const v2 = A.stickyNotesV2 && Array.isArray(A.stickyNotesV2.notes) ? A.stickyNotesV2.notes : null;
      if (v2) v2.forEach((n, i) => { if (n && String(n.text || "").trim()) d.notes.push(mk({ id: String(n.id || Date.now() + i), html: textToHtml(n.text), color: OLD_COLORS[n.color] || "yellow" }, d.notes.length)); });
      else if (A.sticky && String(A.sticky.text || "").trim()) d.notes.push(mk({ html: textToHtml(A.sticky.text) }, 0));
      d.migratedFrom = v2 ? "stickyNotesV2" : A.sticky ? "sticky" : null;
      try { State.save(); } catch (e) {}
    }
    d.notes.forEach((n) => { if (!COLORS[n.color]) n.color = "yellow"; if (n.html == null) n.html = textToHtml(n.text || ""); });
    return d;
  }
  function mk(o, k) {
    const sw = (document.getElementById("screen") || document.body).clientWidth || innerWidth;
    return Object.assign({ id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), html: "", color: "yellow", x: Math.max(16, Math.round(sw * 0.36) + (k % 6) * 28), y: 32 + (k % 6) * 28, w: 250, h: 230, desk: true, ts: Date.now(), z: 1 }, o);
  }
  let saveT = 0;
  function save(now) {
    clearTimeout(saveT);
    const doIt = () => {
      const d = sdata(), A = State.data.appData;
      // mirror to the old shape so anything still reading stickyNotesV2 sees the same notes
      try { A.stickyNotesV2 = { notes: d.notes.map((n) => ({ id: n.id, text: htmlToText(n.html), color: Math.max(0, OLD_COLORS.indexOf(n.color === "charcoal" ? "grey" : n.color)) })) }; } catch (e) {}
      try { State.save(); } catch (e) {}
    };
    if (now) doIt(); else saveT = setTimeout(doIt, 350);
  }
  function changed(srcEl, n) {
    // keep every other view of this note in sync, then notify list windows
    document.querySelectorAll(`.cr-sn-body[data-id="${n.id}"]`).forEach((b) => { if (b !== srcEl && document.activeElement !== b) b.innerHTML = n.html; });
    window.dispatchEvent(new CustomEvent("cr-sticky-change", { detail: { id: n.id } }));
  }
  const fmtDate = (ts) => { const d = new Date(ts || Date.now()), now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
  const colorVars = (n) => { const c = COLORS[n.color] || COLORS.yellow; return `--sn-bg:${c.bg};--sn-head:${c.head};--sn-text:${c.text}`; };

  // ---------- an editable note body + format bar (shared by desktop cards and the app editor) ----------
  function editorParts(n) {
    const bodyEl = el(`<div class="cr-sn-body" contenteditable="true" spellcheck="true" data-id="${esc(n.id)}" data-placeholder="Take a note…" role="textbox" aria-multiline="true"></div>`);
    bodyEl.innerHTML = n.html || "";
    bodyEl.addEventListener("input", () => { n.html = sanitize(bodyEl.innerHTML); n.ts = Date.now(); save(); changed(bodyEl, n); });
    bodyEl.addEventListener("blur", () => save(true));
    bodyEl.addEventListener("paste", (e) => { // paste as plain text (keeps notes clean and small)
      const t = e.clipboardData && e.clipboardData.getData("text/plain"); if (t == null) return; e.preventDefault();
      document.execCommand("insertText", false, t);
    });
    const bar = el(`<div class="cr-sn-fmt">
      <button data-cmd="bold" title="Bold (Ctrl+B)">${ico("bold", 16)}</button><button data-cmd="italic" title="Italic (Ctrl+I)">${ico("italic", 16)}</button>
      <button data-cmd="underline" title="Underline (Ctrl+U)">${ico("underline", 16)}</button><button data-cmd="strikeThrough" title="Strikethrough">${ico("strike", 16)}</button>
      <button data-cmd="insertUnorderedList" title="Bullets">${ico("list", 16)}</button></div>`);
    bar.querySelectorAll("[data-cmd]").forEach((b) => {
      b.addEventListener("pointerdown", (e) => e.preventDefault()); // keep the caret in the note
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.onclick = () => { if (document.activeElement !== bodyEl) bodyEl.focus(); try { document.execCommand(b.dataset.cmd, false, null); } catch (e) {} bodyEl.dispatchEvent(new Event("input")); syncFmt(); };
    });
    function syncFmt() { bar.querySelectorAll("[data-cmd]").forEach((b) => { let on = false; try { on = document.queryCommandState(b.dataset.cmd); } catch (e) {} b.classList.toggle("on", !!on && document.activeElement === bodyEl); }); }
    bodyEl.addEventListener("keyup", syncFmt); bodyEl.addEventListener("pointerup", syncFmt); bodyEl.addEventListener("focus", syncFmt);
    return { bodyEl, bar };
  }
  function colorMenu(anchor, n, onPick, extra) {
    const box = el(`<div class="cr-sn-menu"><div class="cr-sn-colors"></div></div>`);
    ORDER.forEach((c) => { const b = el(`<button class="cr-sn-cdot${n.color === c ? " on" : ""}" title="${COLORS[c].name}" style="background:${COLORS[c].head}"></button>`); b.onclick = () => { n.color = c; save(true); K.closePop(); onPick(); window.dispatchEvent(new CustomEvent("cr-sticky-change", { detail: { id: n.id } })); }; box.querySelector(".cr-sn-colors").appendChild(b); });
    (extra || []).forEach((it) => { const b = el(`<button class="cr-menu-item"><span class="cr-menu-ic">${ico(it.icon, 16)}</span><span class="cr-menu-l">${esc(it.label)}</span></button>`); b.onclick = () => { K.closePop(); it.onClick(); }; box.appendChild(b); });
    K.popover(anchor, box);
  }
  function newNote(near) {
    const d = sdata(); const n = mk({}, d.notes.length);
    if (near) { n.x = near.x + 28; n.y = near.y + 28; }
    n.z = topZ() + 1; d.notes.push(n); save(true); refreshDesk(); window.dispatchEvent(new CustomEvent("cr-sticky-change", { detail: { id: n.id } }));
    setTimeout(() => { const b = document.querySelector(`.cr-sn-layer .cr-sn-body[data-id="${n.id}"]`); if (b) b.focus(); }, 30);
    return n;
  }
  function deleteNote(n) { const d = sdata(); d.notes = d.notes.filter((x) => x.id !== n.id); save(true); refreshDesk(); window.dispatchEvent(new CustomEvent("cr-sticky-change", { detail: { id: n.id, deleted: true } })); }
  const topZ = () => Math.max(1, ...sdata().notes.map((n) => n.z || 1));

  // ---------- desktop layer ----------
  function currentDesktop() { const all = document.querySelectorAll("#screen > .desktop"); return all.length ? all[all.length - 1] : null; }
  function mount() {
    const desk = currentDesktop(); if (!desk) return null;
    document.querySelectorAll(".cr-sn-layer").forEach((l) => { if (l.parentNode !== desk) l.remove(); });
    let layer = desk.querySelector(":scope > .cr-sn-layer");
    if (!layer) { layer = el(`<div class="cr-sn-layer" aria-label="Sticky notes"></div>`); desk.appendChild(layer); }
    renderLayer(layer); return layer;
  }
  function refreshDesk() { const layer = document.querySelector("#screen > .desktop > .cr-sn-layer") || mount(); if (layer) renderLayer(layer); }
  function renderLayer(layer) {
    const d = sdata(), want = d.notes.filter((n) => n.desk !== false), ids = new Set(want.map((n) => n.id));
    layer.querySelectorAll(":scope > .cr-sn").forEach((c) => { if (!ids.has(c.dataset.id)) c.remove(); });
    const W = layer.clientWidth || innerWidth, H = layer.clientHeight || innerHeight;
    want.forEach((n) => {
      let card = layer.querySelector(`:scope > .cr-sn[data-id="${n.id}"]`);
      if (!card) { card = deskCard(n); layer.appendChild(card); }
      n.w = clamp(n.w || 250, 180, 640); n.h = clamp(n.h || 230, 130, 640);
      const x = clamp(n.x == null ? W - n.w - 24 : n.x, 0, Math.max(0, W - 60)), y = clamp(n.y == null ? 24 : n.y, 0, Math.max(0, H - 100));
      Object.assign(card.style, { left: x + "px", top: y + "px", width: n.w + "px", height: n.h + "px", zIndex: n.z || 1 });
      card.setAttribute("style", card.getAttribute("style").replace(/--sn-[a-z]+:[^;]+;?/g, "") + ";" + colorVars(n));
      card.classList.toggle("cr-sn-dark", n.color === "charcoal");
      const b = card.querySelector(".cr-sn-body"); if (b && document.activeElement !== b && b.innerHTML !== n.html) b.innerHTML = n.html;
    });
  }
  function deskCard(n) {
    const card = el(`<div class="cr-sn" data-id="${esc(n.id)}">
      <div class="cr-sn-head"><button class="cr-sn-hb" data-h="new" title="New note">${ico("plus", 16)}</button><span class="cr-sn-grab"></span><button class="cr-sn-hb" data-h="menu" title="Menu">${ico("more", 16)}</button><button class="cr-sn-hb" data-h="close" title="Close note (it stays in the Sticky Notes list)">${ico("close", 16)}</button></div>
      <i class="cr-sn-rs" title="Resize"></i></div>`);
    const { bodyEl, bar } = editorParts(n);
    card.insertBefore(bodyEl, card.querySelector(".cr-sn-rs")); card.insertBefore(bar, card.querySelector(".cr-sn-rs"));
    const head = card.querySelector(".cr-sn-head");
    const front = () => { const z = topZ(); if ((n.z || 1) < z) { n.z = z + 1; card.style.zIndex = n.z; save(); } };
    card.addEventListener("pointerdown", front, true);
    head.querySelector('[data-h="new"]').onclick = () => newNote(n);
    head.querySelector('[data-h="close"]').onclick = () => { n.desk = false; save(true); refreshDesk(); window.dispatchEvent(new CustomEvent("cr-sticky-change", { detail: { id: n.id } })); };
    head.querySelector('[data-h="menu"]').onclick = (e) => colorMenu(e.currentTarget, n, () => refreshDesk(), [
      { label: "Notes list", icon: "list", onClick: () => WM.open("stickynotes") },
      { label: "Delete note", icon: "trash", onClick: () => askDelete(card, n) },
    ]);
    // drag by the header (pointer events: mouse, finger, pencil)
    head.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return; e.preventDefault();
      try { head.setPointerCapture(e.pointerId); } catch (_) {}
      const layer = card.parentNode, sx = e.clientX, sy = e.clientY, ox = card.offsetLeft, oy = card.offsetTop;
      card.classList.add("cr-sn-drag");
      const mv = (ev) => { n.x = clamp(ox + ev.clientX - sx, 0, layer.clientWidth - 60); n.y = clamp(oy + ev.clientY - sy, 0, layer.clientHeight - 40); card.style.left = n.x + "px"; card.style.top = n.y + "px"; };
      const up = () => { head.removeEventListener("pointermove", mv); head.removeEventListener("pointerup", up); head.removeEventListener("pointercancel", up); card.classList.remove("cr-sn-drag"); n.x = card.offsetLeft; n.y = card.offsetTop; save(true); };
      head.addEventListener("pointermove", mv); head.addEventListener("pointerup", up); head.addEventListener("pointercancel", up);
    });
    const rs = card.querySelector(".cr-sn-rs");
    rs.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation(); try { rs.setPointerCapture(e.pointerId); } catch (_) {}
      const sx = e.clientX, sy = e.clientY, w0 = card.offsetWidth, h0 = card.offsetHeight;
      const mv = (ev) => { n.w = clamp(w0 + ev.clientX - sx, 180, 640); n.h = clamp(h0 + ev.clientY - sy, 130, 640); card.style.width = n.w + "px"; card.style.height = n.h + "px"; };
      const up = () => { rs.removeEventListener("pointermove", mv); rs.removeEventListener("pointerup", up); rs.removeEventListener("pointercancel", up); save(true); };
      rs.addEventListener("pointermove", mv); rs.addEventListener("pointerup", up); rs.addEventListener("pointercancel", up);
    });
    // keep desktop shortcuts (Delete key on selected icons etc.) from reacting while typing
    card.addEventListener("keydown", (e) => e.stopPropagation());
    card.addEventListener("contextmenu", (e) => e.stopPropagation());
    return card;
  }
  function askDelete(card, n) {
    if (card.querySelector(".cr-sn-ask")) return;
    const ask = el(`<div class="cr-sn-ask"><p>Delete this note?</p><div class="cr-row"><button class="cr-btn cr-small cr-primary">Delete</button><button class="cr-btn cr-small">Keep</button></div></div>`);
    const [yes, no] = ask.querySelectorAll("button"); yes.onclick = () => deleteNote(n); no.onclick = () => ask.remove();
    card.appendChild(ask);
  }

  // attach now, and again whenever the desktop is rebuilt (WM.buildDesktop) or the screen changes
  function watch() {
    const scr = document.getElementById("screen"); if (!scr) return;
    let t = 0;
    new MutationObserver((muts) => {
      let need = false;
      for (const m of muts) { m.addedNodes.forEach((x) => { if (x.classList && x.classList.contains("desktop")) need = true; }); m.removedNodes.forEach((x) => { if (x.classList && x.classList.contains("desktop")) need = true; }); }
      const desk = currentDesktop(); if (desk && !desk.querySelector(":scope > .cr-sn-layer")) need = true;
      if (need) { clearTimeout(t); t = setTimeout(mount, 0); }
    }).observe(scr, { childList: true });
    mount();
    let rt = 0; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(refreshDesk, 150); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();

  // ---------- the Sticky Notes app: list of all notes + in-app editor ----------
  let appInst = null;
  AppRegistry.stickynotes = function () {
    if (appInst && appInst.isConnected) { appInst.__focus(); return; }
    const wref = WM.createWindow({ title: "Sticky Notes", icon: Icon.mini("stickynotes", "Sticky Notes"), width: Math.min(420, innerWidth - 24), height: Math.min(600, innerHeight - 110), appId: "stickynotes" });
    const body = wref.body, winEl = body.closest(".win"); appInst = winEl; winEl.__focus = wref.focus;
    body.innerHTML = `<div class="cr-app cr-snapp">
      <div class="cr-snapp-top"><h2>Sticky Notes</h2><span class="cr-grow"></span><button class="cr-ib" data-a="new" title="New note">${ico("plus")}</button></div>
      <label class="cr-snapp-search">${ico("search", 16)}<input placeholder="Search…" aria-label="Search notes"></label>
      <div class="cr-snapp-list"></div>
      <div class="cr-snapp-ed" hidden></div>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const list = $(".cr-snapp-list"), ed = $(".cr-snapp-ed");
    let q = "", editing = null;
    function renderList() {
      const d = sdata(); list.innerHTML = "";
      const notes = d.notes.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).filter((n) => !q || htmlToText(n.html).toLowerCase().includes(q));
      if (!notes.length) { list.appendChild(el(`<div class="cr-snapp-empty">${ico("note", 40)}<p>${q ? "No notes match your search." : "Tap <b>+</b> to create a note. It appears on your desktop, where you can drag it anywhere."}</p></div>`)); return; }
      notes.forEach((n) => {
        const txt = htmlToText(n.html);
        const c = el(`<div class="cr-snapp-card" style="${colorVars(n)}" data-id="${esc(n.id)}"><div class="cr-snapp-meta"><span>${fmtDate(n.ts)}</span><span class="cr-grow"></span>
          <button class="cr-ib" data-c="desk" title="${n.desk === false ? "Show on desktop" : "Hide from desktop"}">${ico(n.desk === false ? "pin" : "eye", 16)}</button>
          <button class="cr-ib" data-c="more" title="More">${ico("more", 16)}</button></div>
          <div class="cr-snapp-prev">${txt ? n.html : '<span class="cr-dim">Empty note</span>'}</div>${n.desk === false ? '<div class="cr-snapp-tag">Not on desktop</div>' : ""}</div>`);
        c.onclick = (e) => { if (e.target.closest("button")) return; openEditor(n); };
        c.querySelector('[data-c="desk"]').onclick = () => { n.desk = n.desk === false; if (n.desk) { n.z = topZ() + 1; flash(n); } save(true); refreshDesk(); renderList(); };
        c.querySelector('[data-c="more"]').onclick = (e) => colorMenu(e.currentTarget, n, () => { refreshDesk(); renderList(); }, [
          { label: "Open note", icon: "edit", onClick: () => openEditor(n) },
          { label: n.desk === false ? "Show on desktop" : "Hide from desktop", icon: "pin", onClick: () => { n.desk = n.desk === false; save(true); refreshDesk(); renderList(); } },
          { label: "Delete note", icon: "trash", onClick: async () => { if (await K.confirmBox(body.querySelector(".cr-snapp"), "Delete note?", "This note will be permanently deleted.", "Delete")) deleteNote(n); } },
        ]);
        list.appendChild(c);
      });
    }
    function flash(n) { setTimeout(() => { const c = document.querySelector(`.cr-sn-layer .cr-sn[data-id="${n.id}"]`); if (c) { c.classList.remove("cr-sn-flash"); void c.offsetWidth; c.classList.add("cr-sn-flash"); } }, 50); }
    function openEditor(n) {
      editing = n; ed.hidden = false; list.hidden = true; $(".cr-snapp-search").hidden = true;
      ed.setAttribute("style", colorVars(n)); ed.innerHTML = `<div class="cr-snapp-edtop"><button class="cr-ib" data-e="back" title="Back to the list">${ico("chevL")}</button><span class="cr-grow"></span><button class="cr-ib" data-e="color" title="Colour">${ico("more")}</button><button class="cr-btn cr-small" data-e="desk">${ico("pin", 14)} ${n.desk === false ? "Show on desktop" : "On desktop"}</button></div>`;
      const { bodyEl, bar } = editorParts(n); ed.appendChild(bodyEl); ed.appendChild(bar);
      ed.querySelector('[data-e="back"]').onclick = closeEditor;
      ed.querySelector('[data-e="color"]').onclick = (e) => colorMenu(e.currentTarget, n, () => { ed.setAttribute("style", colorVars(n)); refreshDesk(); });
      ed.querySelector('[data-e="desk"]').onclick = (e) => { n.desk = true; n.z = topZ() + 1; save(true); refreshDesk(); flash(n); e.currentTarget.innerHTML = ico("pin", 14) + " On desktop"; };
      setTimeout(() => bodyEl.focus(), 30);
    }
    function closeEditor() { editing = null; ed.hidden = true; ed.innerHTML = ""; list.hidden = false; $(".cr-snapp-search").hidden = false; renderList(); }
    $('[data-a="new"]').onclick = () => { const n = newNote(); openEditor(n); };
    $(".cr-snapp-search input").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); renderList(); });
    const onChange = (e) => { if (!body.isConnected) return; if (editing && e.detail && e.detail.deleted && e.detail.id === editing.id) closeEditor(); else if (!editing) renderList(); };
    window.addEventListener("cr-sticky-change", onChange);
    winEl.addEventListener("wm-cleanup", () => { window.removeEventListener("cr-sticky-change", onChange); K.closePop(); save(true); if (appInst === winEl) appInst = null; });
    renderList();
  };
  window.CrSticky = { data: sdata, mount, refresh: refreshDesk, newNote, sanitize };
})();
