/* Microsoft 365 apps. Word (rich text) with real file save/open via the VFS
   (word .docx = html, or plain .txt). PowerPoint added alongside. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const FONTS = ["Calibri", "Arial", "Times New Roman", "Georgia", "Verdana", "Courier New", "Comic Sans MS"];
  const SIZES = [["1", "10"], ["2", "13"], ["3", "16"], ["4", "18"], ["5", "24"], ["6", "32"], ["7", "48"]];

  function toast(msg) { if (window.Notify) Notify.show({ icon: "", title: msg, body: "" }); }

  // ===================== WORD =====================
  function openWord(fileRef) {
    const ref = cw({ title: "Word", icon: Icon.mini("word", "Word"), width: 900, height: 640, appId: "word" });
    const body = ref.body, win = ref.win;
    if (!S().appData) S().appData = {};

    // 3-second Office-style splash (with Microsoft logo), then the start menu.
    body.innerHTML = `<div class="wd-splash">
      <img class="wd-splash-ic" src="assets/word.png" alt="">
      <div class="wd-splash-name">Word</div>
      <div class="wd-splash-bar"><span></span></div>
      <div class="wd-splash-ms"><span class="w12-flag"><i></i><i></i><i></i><i></i></span> Microsoft</div>
    </div>`;
    setTimeout(() => { if (fileRef && fileRef.node) buildWord(fileRef); else buildStart(); }, 3000);

    // Scan the virtual filesystem for recent Word/text documents.
    function listDocs() {
      const out = [];
      (function walk(children, path) {
        Object.entries(children || {}).forEach(([nm, node]) => {
          if (node.type === "folder") walk(node.children, path.concat(nm));
          else if (node.kind === "word" || node.kind === "text") out.push({ name: nm, node, path, ts: node.ts || 0 });
        });
      })(window.VFS.ensure(), []);
      return out.sort((a, b) => b.ts - a.ts).slice(0, 12);
    }
    function openFromDevice() {
      const inp = document.getElementById("globalFileInput");
      inp.accept = ".txt,.md,.csv,.html,.log,.json,text/*"; inp.value = "";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => buildWord({ name: f.name, node: { type: "file", kind: "text", content: String(r.result || ""), ts: Date.now() } });
        r.readAsText(f);
      };
      inp.click();
    }

    // Opening menu (Office-style start screen)
    function buildStart() {
      const uname = (S().profile && S().profile.username) || "there";
      const docs = listDocs();
      body.innerHTML = `<div class="wd-start">
        <div class="wd-start-side">
          <div class="wd-start-brand"><img src="assets/word.png" class="wd-start-logo" alt="">Word</div>
          <button class="wd-start-btn primary" id="sNew">New blank document</button>
          <button class="wd-start-btn" id="sOpen">Open from Files…</button>
          <button class="wd-start-btn" id="sDevice">Open from this device…</button>
        </div>
        <div class="wd-start-main">
          <h2 class="wd-start-hi">Welcome back, ${escapeHtml(uname)}</h2>
          <div class="wd-start-cards">
            <button class="wd-newcard" id="cNew"><div class="wd-newcard-thumb">+</div><span>Blank document</span></button>
          </div>
          <h3 style="margin-top:10px">Recent</h3>
          <div class="wd-start-recent"></div>
        </div>
      </div>`;
      const rec = body.querySelector(".wd-start-recent");
      if (!docs.length) rec.innerHTML = `<div class="muted" style="padding:14px">No recent documents yet. Create a new one to get started.</div>`;
      docs.forEach((d) => { const row = el(`<button class="wd-recent-row"><img src="assets/word.png" class="wd-recent-ic" alt=""><span class="wd-recent-nm">${escapeHtml(d.name)}</span><span class="wd-recent-loc muted">${d.path.join(" › ") || "This PC"}</span></button>`); row.onclick = () => buildWord(d); rec.appendChild(row); });
      body.querySelector("#sNew").onclick = () => buildWord(null);
      body.querySelector("#cNew").onclick = () => buildWord(null);
      body.querySelector("#sOpen").onclick = () => window.VFS.pickFile({ title: "Open document", accept: ["word", "text"] }, (res) => buildWord(res));
      body.querySelector("#sDevice").onclick = openFromDevice;
    }

    function buildWord(fr) {
    body.innerHTML = `<div class="wd">
      <div class="wd-top">
        <span class="wd-ic">${Icon.mini("word", "Word")}</span>
        <input class="wd-name" title="Document name">
        <div class="wd-filemenu">
          <button data-f="home" title="Start screen">&#9776;</button>
          <button data-f="new">New</button>
          <button data-f="open">Open</button>
          <button data-f="import">Open from device</button>
          <button data-f="save">Save</button>
          <button data-f="saveas">Save As</button>
        </div>
        <span class="grow"></span>
        <span class="wd-count muted"></span>
      </div>
      <div class="wd-ribbon">
        <div class="wd-grp">
          <select class="wd-font" title="Font">${FONTS.map((f) => `<option value="${f}" style="font-family:${f}">${f}</option>`).join("")}</select>
          <select class="wd-size" title="Size">${SIZES.map((s) => `<option value="${s[0]}" ${s[0] === "3" ? "selected" : ""}>${s[1]}</option>`).join("")}</select>
        </div>
        <div class="wd-grp">
          <button data-cmd="bold" title="Bold" style="font-weight:800">B</button>
          <button data-cmd="italic" title="Italic" style="font-style:italic">I</button>
          <button data-cmd="underline" title="Underline" style="text-decoration:underline">U</button>
          <button data-cmd="strikeThrough" title="Strikethrough" style="text-decoration:line-through">S</button>
          <label class="wd-color" title="Text color">A<input type="color" class="wd-fore" value="#111111"><span class="wd-color-bar" style="background:#111"></span></label>
          <label class="wd-color" title="Highlight">H<input type="color" class="wd-back" value="#ffe600"><span class="wd-color-bar" style="background:#ffe600"></span></label>
        </div>
        <div class="wd-grp">
          <button data-cmd="insertUnorderedList" title="Bullets">•</button>
          <button data-cmd="insertOrderedList" title="Numbered">1.</button>
          <button data-cmd="justifyLeft" title="Align left">⯇</button>
          <button data-cmd="justifyCenter" title="Center">≡</button>
          <button data-cmd="justifyRight" title="Align right">⯈</button>
          <button data-cmd="justifyFull" title="Justify">☰</button>
        </div>
        <div class="wd-grp">
          <button data-cmd="undo" title="Undo">↺</button>
          <button data-cmd="redo" title="Redo">↻</button>
          <button class="wd-clear" title="Clear formatting">⌫</button>
        </div>
      </div>
      <div class="wd-canvas"><div class="wd-page" contenteditable="true" spellcheck="true"></div></div>
    </div>`;

    const page = body.querySelector(".wd-page");
    const nameInput = body.querySelector(".wd-name");
    const count = body.querySelector(".wd-count");
    const titleText = () => win.querySelector(".win-titlebar .t-text");

    // current doc: { name, node } bound to a VFS file, or null (unsaved scratch)
    let current = null, isText = false;

    function loadDoc(fr) {
      if (fr && fr.node) {
        current = { name: fr.name, node: fr.node };
        isText = fr.node.kind === "text";
        if (isText) page.textContent = fr.node.content || "";
        else page.innerHTML = fr.node.content || "";
        nameInput.value = fr.name;
      } else {
        current = null; isText = false;
        page.innerHTML = "";
        nameInput.value = "Document1";
      }
      if (titleText()) titleText().textContent = (current ? current.name : "Document1") + " — Word";
      updateCount();
    }

    let savedRange = null;
    const saveSel = () => { const s = window.getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); };
    const restoreSel = () => { page.focus(); if (savedRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); } };
    const exec = (cmd, val) => { restoreSel(); try { document.execCommand("styleWithCSS", false, true); } catch (_) {} document.execCommand(cmd, false, val); autosave(); };

    function updateCount() { const t = (page.innerText || "").trim(); const w = t ? t.split(/\s+/).length : 0; count.textContent = w + (w === 1 ? " word" : " words"); }
    function contentOut() { return isText ? page.innerText : page.innerHTML; }
    function autosave() { if (current) { current.node.content = contentOut(); current.node.ts = Date.now(); State.save(); } updateCount(); }

    function doSave() {
      if (!current) return doSaveAs();
      current.node.content = contentOut(); current.node.ts = Date.now(); State.save();
      toast("Saved " + current.name);
    }
    function doSaveAs() {
      window.VFS.pickSave({ title: "Save document", defaultName: (current ? current.name.replace(/\.[a-z0-9]+$/i, "") : nameInput.value) || "Document1", kind: "word" }, (res) => {
        const node = { type: "file", kind: "word", content: page.innerHTML, ts: Date.now() };
        res.children[res.name] = node;
        State.save();
        current = { name: res.name, node }; isText = false;
        nameInput.value = res.name;
        if (titleText()) titleText().textContent = res.name + " — Word";
        toast("Saved " + res.name);
        if (window.WM.refreshDesktopIcons) { /* files app refresh happens on next open */ }
      });
    }
    function doOpen() {
      window.VFS.pickFile({ title: "Open document", accept: ["word", "text"] }, (res) => loadDoc(res));
    }

    body.querySelectorAll(".wd-filemenu [data-f]").forEach((b) => b.onclick = () => {
      const f = b.dataset.f;
      if (f === "new") loadDoc(null);
      else if (f === "open") doOpen();
      else if (f === "import") openFromDevice();
      else if (f === "home") buildStart();
      else if (f === "save") doSave();
      else if (f === "saveas") doSaveAs();
    });

    body.querySelectorAll(".wd-ribbon [data-cmd]").forEach((b) => b.addEventListener("mousedown", (e) => { e.preventDefault(); document.execCommand(b.dataset.cmd, false, null); autosave(); }));
    body.querySelector(".wd-clear").addEventListener("mousedown", (e) => { e.preventDefault(); document.execCommand("removeFormat", false, null); autosave(); });

    page.addEventListener("keyup", saveSel);
    page.addEventListener("mouseup", saveSel);
    const fontSel = body.querySelector(".wd-font"), sizeSel = body.querySelector(".wd-size");
    fontSel.addEventListener("mousedown", saveSel); sizeSel.addEventListener("mousedown", saveSel);
    fontSel.onchange = () => exec("fontName", fontSel.value);
    sizeSel.onchange = () => exec("fontSize", sizeSel.value);
    const fore = body.querySelector(".wd-fore"), back = body.querySelector(".wd-back");
    fore.parentElement.addEventListener("mousedown", saveSel); back.parentElement.addEventListener("mousedown", saveSel);
    fore.oninput = () => { fore.nextElementSibling.style.background = fore.value; exec("foreColor", fore.value); };
    back.oninput = () => { back.nextElementSibling.style.background = back.value; exec("hiliteColor", back.value); };
    page.addEventListener("input", autosave);
    nameInput.oninput = () => { if (current) return; };
    // Ctrl+S to save
    body.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); doSave(); } });

    loadDoc(fr || null);
    setTimeout(() => page.focus(), 60);
    } // end buildWord
  }

  AppRegistry.word = function () { openWord(null); };

  // ===================== EXCEL =====================
  const XCOLS = 12, XROWS = 26;
  function colName(i) { let s = ""; i++; while (i) { i--; s = String.fromCharCode(65 + i % 26) + s; i = Math.floor(i / 26); } return s; }
  function colToIdx(c) { let n = 0; for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
  function parseRef(ref) { const m = /^([A-Z]+)(\d+)$/.exec((ref || "").toUpperCase()); return m ? { c: colToIdx(m[1]), r: +m[2] } : null; }

  function openExcel(fileRef) {
    const ref = cw({ title: "Excel", icon: Icon.mini("excel", "Excel"), width: 980, height: 640, appId: "excel" });
    const body = ref.body, win = ref.win;
    if (!S().appData) S().appData = {};
    let cells = {}, styles = {}, current = null;
    if (fileRef && fileRef.node) { try { const j = JSON.parse(fileRef.node.content || "{}"); cells = j.cells || {}; styles = j.styles || {}; } catch (_) {} current = { name: fileRef.name, node: fileRef.node }; }
    else if (S().appData.excel) { cells = S().appData.excel.cells || {}; styles = S().appData.excel.styles || {}; }

    body.innerHTML = `<div class="wd-splash xl-splash">
      <img class="wd-splash-ic" src="assets/excel.png" onerror="this.style.display='none'" alt="">
      <div class="wd-splash-name" style="color:#217346">Excel</div>
      <div class="wd-splash-bar"><span style="background:#217346"></span></div>
      <div class="wd-splash-ms"><span class="w12-flag"><i></i><i></i><i></i><i></i></span> Microsoft</div>
    </div>`;
    setTimeout(build, 3000);

    const titleText = () => win.querySelector(".win-titlebar .t-text");
    function persist() { const data = { cells, styles }; if (current) { current.node.content = JSON.stringify(data); current.node.ts = Date.now(); } else S().appData.excel = data; State.save(); }

    // ---- formula engine ----
    function rawOf(r) { return cells[r] != null ? String(cells[r]) : ""; }
    function expandRange(a, b) { const A = parseRef(a), B = parseRef(b), out = []; if (!A || !B) return out; for (let r = Math.min(A.r, B.r); r <= Math.max(A.r, B.r); r++) for (let c = Math.min(A.c, B.c); c <= Math.max(A.c, B.c); c++) out.push(colName(c) + r); return out; }
    function valOf(r, seen) { r = r.toUpperCase(); if (seen.has(r)) return 0; const raw = rawOf(r); if (raw === "") return 0; if (raw[0] === "=") { seen.add(r); const v = evalF(raw.slice(1), seen); seen.delete(r); return v; } const n = parseFloat(raw); return isNaN(n) ? raw : n; }
    function evalF(expr, seen) {
      expr = expr.replace(/([A-Za-z]+)\s*\(([^()]*)\)/g, (m, fn, args) => {
        fn = fn.toUpperCase();
        const vals = args.split(",").flatMap((tok) => {
          tok = tok.trim(); if (!tok) return [];
          const rng = /^([A-Z]+\d+):([A-Z]+\d+)$/i.exec(tok);
          if (rng) return expandRange(rng[1], rng[2]).map((r) => Number(valOf(r, seen)) || 0);
          if (/^[A-Z]+\d+$/i.test(tok)) return [Number(valOf(tok, seen)) || 0];
          const n = parseFloat(tok); return isNaN(n) ? [] : [n];
        });
        if (fn === "SUM") return vals.reduce((a, b) => a + b, 0);
        if (fn === "AVERAGE" || fn === "AVG") return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        if (fn === "MIN") return vals.length ? Math.min.apply(null, vals) : 0;
        if (fn === "MAX") return vals.length ? Math.max.apply(null, vals) : 0;
        if (fn === "COUNT") return vals.length;
        if (fn === "ROUND") return vals.length ? Math.round((vals[0]) * Math.pow(10, vals[1] || 0)) / Math.pow(10, vals[1] || 0) : 0;
        if (fn === "PRODUCT") return vals.reduce((a, b) => a * b, 1);
        return 0;
      });
      expr = expr.replace(/[A-Z]+\d+/gi, (r) => { const v = valOf(r, seen); return typeof v === "number" ? v : JSON.stringify(v); });
      try { const r = Function('"use strict";return (' + expr + ")")(); return (r == null) ? "" : r; } catch (e) { return "#ERR"; }
    }
    // Numeric value of a cell (for stats / formats).
    function numOf(r) { const raw = rawOf(r); if (raw === "") return null; const v = raw[0] === "=" ? evalF(raw.slice(1), new Set([r])) : parseFloat(raw); return typeof v === "number" && !isNaN(v) ? v : null; }
    function fmtNum(v, fmt) {
      if (fmt === "cur") return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (fmt === "pct") return (v * 100).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "%";
      if (fmt === "comma") return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
      return String(v);
    }
    function display(r) {
      const raw = rawOf(r); if (raw === "") return "";
      const st = styles[r] || {};
      if (raw[0] === "=") { const v = evalF(raw.slice(1), new Set([r])); return (typeof v === "number" && st.fmt) ? fmtNum(v, st.fmt) : String(v); }
      if (st.fmt) { const n = parseFloat(raw); if (!isNaN(n) && String(n) === raw.trim()) return fmtNum(n, st.fmt); }
      return raw;
    }
    function isNumericCell(r) { const raw = rawOf(r); if (raw === "") return false; return raw[0] === "=" || !isNaN(parseFloat(raw)); }

    const FILLS = ["", "#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fecaca", "#e9d5ff", "#217346", "#1f2937"];
    const COLORS = ["#1f2937", "#217346", "#2563eb", "#dc2626", "#7c3aed", "#d97706", "#0891b2", "#ffffff"];
    const ALIGN_SVG = {
      left: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h10M4 18h13"/></svg>`,
      center: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M7 12h10M6 18h12"/></svg>`,
      right: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M10 12h10M7 18h13"/></svg>`,
    };

    let active = "A1";
    function build() {
      body.innerHTML = `<div class="xl">
        <div class="xl-top">
          <span class="xl-ic">${Icon.mini("excel", "Excel")}</span>
          <input class="xl-name" value="${escapeHtml(current ? current.name : "Book1")}">
          <div class="xl-filemenu">
            <button data-f="new">New</button><button data-f="open">Open</button><button data-f="import">Open from device</button><button data-f="save">Save</button><button data-f="saveas">Save As</button>
          </div>
        </div>
        <div class="xl-ribbon">
          <button class="xl-tb" data-c="bold" title="Bold"><b>B</b></button>
          <button class="xl-tb" data-c="italic" title="Italic"><i>I</i></button>
          <span class="xl-div"></span>
          <button class="xl-tb" data-c="left" title="Align left">${ALIGN_SVG.left}</button>
          <button class="xl-tb" data-c="center" title="Align center">${ALIGN_SVG.center}</button>
          <button class="xl-tb" data-c="right" title="Align right">${ALIGN_SVG.right}</button>
          <span class="xl-div"></span>
          <button class="xl-tb xl-palbtn" data-c="fill" title="Fill color">Fill<span class="xl-swatch" data-sw="fill"></span></button>
          <button class="xl-tb xl-palbtn" data-c="color" title="Font color"><b style="text-decoration:underline">A</b><span class="xl-swatch" data-sw="color"></span></button>
          <span class="xl-div"></span>
          <button class="xl-tb" data-c="cur" title="Currency">$</button>
          <button class="xl-tb" data-c="pct" title="Percent">%</button>
          <button class="xl-tb" data-c="comma" title="Thousands separator">,</button>
          <span class="xl-div"></span>
          <button class="xl-tb" data-c="clear" title="Clear formatting">Clear</button>
        </div>
        <div class="xl-formula"><span class="xl-namebox">A1</span><span class="xl-fx">fx</span><input class="xl-fbar" spellcheck="false"></div>
        <div class="xl-grid"></div>
        <div class="xl-status"><span class="xl-stat-ready">Ready</span><span class="grow"></span><span class="xl-stats"></span></div>
      </div>`;
      const gridWrap = body.querySelector(".xl-grid");
      const nameBox = body.querySelector(".xl-namebox");
      const fbar = body.querySelector(".xl-fbar");
      const statsEl = body.querySelector(".xl-stats");

      let html = `<table class="xl-table"><thead><tr><th class="xl-corner"></th>`;
      for (let c = 0; c < XCOLS; c++) html += `<th data-col="${c}">${colName(c)}</th>`;
      html += `</tr></thead><tbody>`;
      for (let r = 1; r <= XROWS; r++) {
        html += `<tr><th class="xl-rownum">${r}</th>`;
        for (let c = 0; c < XCOLS; c++) { const cr = colName(c) + r; html += `<td class="xl-cell" data-ref="${cr}" contenteditable="true"></td>`; }
        html += `</tr>`;
      }
      html += `</tbody></table>`;
      gridWrap.innerHTML = html;

      function styleCell(td, cr) {
        const st = styles[cr] || {};
        td.style.fontWeight = st.b ? "700" : "";
        td.style.fontStyle = st.i ? "italic" : "";
        td.style.background = st.fill || "";
        td.style.color = st.color || "";
        td.style.textAlign = st.align || (isNumericCell(cr) ? "right" : "left");
      }
      function paint(cr) { const td = gridWrap.querySelector(`[data-ref="${cr}"]`); if (!td) return; if (document.activeElement !== td) td.textContent = display(cr); styleCell(td, cr); }
      function renderValues() { gridWrap.querySelectorAll(".xl-cell").forEach((td) => paint(td.dataset.ref)); }

      function updateToolbar() {
        const st = styles[active] || {};
        const set = (c, on) => { const b = body.querySelector(`.xl-tb[data-c="${c}"]`); if (b) b.classList.toggle("on", !!on); };
        set("bold", st.b); set("italic", st.i);
        set("left", st.align === "left"); set("center", st.align === "center"); set("right", st.align === "right");
        set("cur", st.fmt === "cur"); set("pct", st.fmt === "pct"); set("comma", st.fmt === "comma");
      }
      function updateStats() {
        // Sum / Average / Count over the active cell's column.
        const p = parseRef(active); if (!p) { statsEl.textContent = ""; return; }
        const nums = [];
        for (let r = 1; r <= XROWS; r++) { const v = numOf(colName(p.c) + r); if (v != null) nums.push(v); }
        if (!nums.length) { statsEl.innerHTML = ""; return; }
        const sum = nums.reduce((a, b) => a + b, 0);
        statsEl.innerHTML = `<span class="xl-stat">Sum ${sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span><span class="xl-stat">Average ${(sum / nums.length).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span><span class="xl-stat">Count ${nums.length}</span>`;
      }
      function setActive(cr) {
        active = cr;
        body.querySelectorAll(".xl-cell.active").forEach((c) => c.classList.remove("active"));
        gridWrap.querySelectorAll(".xl-colhi,.xl-rowhi").forEach((c) => c.classList.remove("xl-colhi", "xl-rowhi"));
        const td = gridWrap.querySelector(`[data-ref="${cr}"]`); if (td) td.classList.add("active");
        const p = parseRef(cr);
        if (p) { const ch = gridWrap.querySelector(`thead th[data-col="${p.c}"]`); if (ch) ch.classList.add("xl-colhi"); const rows = gridWrap.querySelectorAll("tbody tr")[p.r - 1]; if (rows) rows.querySelector(".xl-rownum").classList.add("xl-rowhi"); }
        nameBox.textContent = cr; fbar.value = rawOf(cr);
        updateToolbar(); updateStats();
      }
      function commit(cr, v) { v = (v || "").trim(); if (v === "") delete cells[cr]; else cells[cr] = v; persist(); renderValues(); updateStats(); }

      function applyFmt(cmd) {
        const st = styles[active] || (styles[active] = {});
        if (cmd === "bold") st.b = !st.b;
        else if (cmd === "italic") st.i = !st.i;
        else if (cmd === "left" || cmd === "center" || cmd === "right") st.align = (st.align === cmd ? "" : cmd);
        else if (cmd === "cur" || cmd === "pct" || cmd === "comma") st.fmt = (st.fmt === cmd ? "" : cmd);
        else if (cmd === "clear") delete styles[active];
        if (styles[active] && !Object.keys(styles[active]).some((k) => styles[active][k])) delete styles[active];
        persist(); paint(active); updateToolbar(); updateStats();
      }
      function openPalette(kind, anchor) {
        body.querySelectorAll(".xl-pal").forEach((m) => m.remove());
        const list = kind === "fill" ? FILLS : COLORS;
        const pal = document.createElement("div"); pal.className = "xl-pal";
        list.forEach((c) => {
          const sw = document.createElement("button"); sw.className = "xl-pal-sw" + (c === "" ? " none" : "");
          sw.style.background = c || "#fff"; sw.title = c || "None";
          sw.onclick = () => { const st = styles[active] || (styles[active] = {}); st[kind] = c; if (!c) delete st[kind]; if (!Object.keys(st).some((k) => st[k])) delete styles[active]; persist(); paint(active); refreshSwatches(); pal.remove(); };
          pal.appendChild(sw);
        });
        body.appendChild(pal);
        const r = anchor.getBoundingClientRect(), br = body.getBoundingClientRect();
        pal.style.left = (r.left - br.left) + "px"; pal.style.top = (r.bottom - br.top + 3) + "px";
        setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!pal.contains(ev.target)) { pal.remove(); document.removeEventListener("mousedown", h); } }), 0);
      }
      function refreshSwatches() {
        const fb = body.querySelector('.xl-swatch[data-sw="fill"]'); const cb = body.querySelector('.xl-swatch[data-sw="color"]');
        const st = styles[active] || {};
        if (fb) fb.style.background = st.fill || "#ffffff";
        if (cb) cb.style.background = st.color || "#1f2937";
      }

      gridWrap.querySelectorAll(".xl-cell").forEach((td) => {
        const cr = td.dataset.ref;
        paint(cr);
        td.addEventListener("focus", () => { td.textContent = rawOf(cr); td.style.textAlign = "left"; setActive(cr); });
        td.addEventListener("input", () => { fbar.value = td.textContent; });
        td.addEventListener("blur", () => { commit(cr, td.textContent); paint(cr); });
        td.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); const p = parseRef(cr); td.blur(); const nx = gridWrap.querySelector(`[data-ref="${colName(p.c) + (p.r + 1)}"]`); if (nx) nx.focus(); }
          else if (e.key === "Tab") { e.preventDefault(); const p = parseRef(cr); td.blur(); const nx = gridWrap.querySelector(`[data-ref="${colName(p.c + 1) + p.r}"]`); if (nx) nx.focus(); }
          else if (e.key === "Escape") { td.textContent = display(cr); td.blur(); }
        });
        td.addEventListener("click", () => { if (document.activeElement !== td) setActive(cr); });
      });
      fbar.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commit(active, fbar.value); paint(active); updateStats(); } });

      body.querySelectorAll(".xl-tb").forEach((b) => b.onclick = () => {
        const c = b.dataset.c;
        if (c === "fill" || c === "color") openPalette(c, b);
        else applyFmt(c);
      });

      body.querySelectorAll(".xl-filemenu [data-f]").forEach((b) => b.onclick = () => {
        const f = b.dataset.f;
        if (f === "new") { cells = {}; styles = {}; current = null; if (titleText()) titleText().textContent = "Book1 — Excel"; persist(); build(); }
        else if (f === "open") window.VFS.pickFile({ title: "Open workbook", accept: ["xlsx"] }, (res) => { if (res) { ref.close(); openExcel(res); } });
        else if (f === "import") importCsv();
        else if (f === "save") { if (!current) return saveAs(); persist(); toast("Saved " + current.name); }
        else if (f === "saveas") saveAs();
      });
      refreshSwatches();
      setActive("A1");
    }
    function saveAs() {
      window.VFS.pickSave({ title: "Save workbook", defaultName: current ? current.name.replace(/\.[a-z0-9]+$/i, "") : "Book1", kind: "xlsx" }, (res) => {
        const node = { type: "file", kind: "xlsx", content: JSON.stringify({ cells, styles }), ts: Date.now() };
        res.children[res.name] = node; State.save();
        current = { name: res.name, node }; if (titleText()) titleText().textContent = res.name + " — Excel"; toast("Saved " + res.name);
      });
    }
    function importCsv() {
      const inp = document.getElementById("globalFileInput");
      inp.accept = ".csv,text/csv,text/plain"; inp.value = "";
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const rows = String(rd.result || "").split(/\r?\n/); rows.forEach((line, ri) => { line.split(",").forEach((v, ci) => { if (v !== "") cells[colName(ci) + (ri + 1)] = v; }); }); persist(); build(); }; rd.readAsText(f); };
      inp.click();
    }
  }
  AppRegistry.excel = function () { openExcel(null); };

  // ===================== MICROSOFT FORMS =====================
  function newForm() { return { title: "Untitled form", desc: "", questions: [], responses: [] }; }
  function newQuestion(type) {
    if (type === "choice") return { type: "choice", q: "Question", options: ["Option 1", "Option 2"], required: false };
    if (type === "rating") return { type: "rating", q: "How would you rate this?", required: false };
    return { type: "text", q: "Question", required: false };
  }
  function openForms(fileRef) {
    const ref = cw({ title: "Forms", icon: Icon.mini("forms", "Forms"), width: 860, height: 660, appId: "forms" });
    const body = ref.body, win = ref.win;
    if (!S().appData) S().appData = {};
    let form, current = null;
    if (fileRef && fileRef.node) { try { form = JSON.parse(fileRef.node.content || ""); } catch (_) { form = newForm(); } current = { name: fileRef.name, node: fileRef.node }; }
    else form = (S().appData.forms && S().appData.forms.form) || newForm();
    if (!form.questions) form.questions = [];
    if (!form.responses) form.responses = [];
    let mode = "edit";

    body.innerHTML = `<div class="wd-splash fm-splash">
      <img class="wd-splash-ic" src="assets/forms.png" onerror="this.style.display='none'" alt="">
      <div class="wd-splash-name" style="color:#1a8a8f">Forms</div>
      <div class="wd-splash-bar"><span style="background:#1a8a8f"></span></div>
      <div class="wd-splash-ms"><span class="w12-flag"><i></i><i></i><i></i><i></i></span> Microsoft</div>
    </div>`;
    setTimeout(build, 2200);

    function persist() { if (current) { current.node.content = JSON.stringify(form); current.node.ts = Date.now(); } else S().appData.forms = { form }; State.save(); }

    function build() {
      body.innerHTML = `<div class="fm">
        <div class="fm-top">
          <span class="fm-ic">${Icon.mini("forms", "Forms")}</span>
          <b class="fm-brand">Forms</b>
          <span class="grow"></span>
          <button class="fm-tab ${mode === "edit" ? "on" : ""}" data-m="edit">Questions</button>
          <button class="fm-tab ${mode === "preview" ? "on" : ""}" data-m="preview">Preview</button>
          <button class="fm-tab" data-m="responses">Responses ${form.responses.length ? "(" + form.responses.length + ")" : ""}</button>
        </div>
        <div class="fm-scroll"></div>
      </div>`;
      body.querySelectorAll(".fm-tab").forEach((b) => b.onclick = () => {
        if (b.dataset.m === "responses") { renderResponses(); return; }
        mode = b.dataset.m; build();
      });
      const scroll = body.querySelector(".fm-scroll");
      if (mode === "edit") renderEdit(scroll); else renderPreview(scroll);
    }

    function renderEdit(scroll) {
      const head = el(`<div class="fm-card fm-headcard">
        <input class="fm-title" value="${escapeHtml(form.title)}" placeholder="Form title">
        <input class="fm-desc" value="${escapeHtml(form.desc)}" placeholder="Form description">
      </div>`);
      head.querySelector(".fm-title").oninput = (e) => { form.title = e.target.value; persist(); };
      head.querySelector(".fm-desc").oninput = (e) => { form.desc = e.target.value; persist(); };
      scroll.appendChild(head);

      form.questions.forEach((q, qi) => {
        const card = el(`<div class="fm-card fm-q">
          <div class="fm-q-top">
            <input class="fm-q-title" value="${escapeHtml(q.q)}" placeholder="Question">
            <select class="fm-q-type">
              <option value="text" ${q.type === "text" ? "selected" : ""}>Text</option>
              <option value="choice" ${q.type === "choice" ? "selected" : ""}>Multiple choice</option>
              <option value="rating" ${q.type === "rating" ? "selected" : ""}>Rating</option>
            </select>
          </div>
          <div class="fm-q-opts"></div>
          <div class="fm-q-foot">
            <label class="fm-req"><input type="checkbox" ${q.required ? "checked" : ""}> Required</label>
            <span class="grow"></span>
            <button class="fm-del">Delete</button>
          </div>
        </div>`);
        card.querySelector(".fm-q-title").oninput = (e) => { q.q = e.target.value; persist(); };
        card.querySelector(".fm-q-type").onchange = (e) => { const nq = newQuestion(e.target.value); nq.q = q.q; nq.required = q.required; form.questions[qi] = nq; persist(); build(); };
        card.querySelector(".fm-req input").onchange = (e) => { q.required = e.target.checked; persist(); };
        card.querySelector(".fm-del").onclick = () => { form.questions.splice(qi, 1); persist(); build(); };
        const opts = card.querySelector(".fm-q-opts");
        if (q.type === "choice") {
          q.options.forEach((opt, oi) => {
            const row = el(`<div class="fm-opt"><span class="fm-opt-dot"></span><input value="${escapeHtml(opt)}"><button class="fm-opt-x" title="Remove">&times;</button></div>`);
            row.querySelector("input").oninput = (e) => { q.options[oi] = e.target.value; persist(); };
            row.querySelector(".fm-opt-x").onclick = () => { q.options.splice(oi, 1); persist(); build(); };
            opts.appendChild(row);
          });
          const addOpt = el(`<button class="fm-addopt">+ Add option</button>`);
          addOpt.onclick = () => { q.options.push("Option " + (q.options.length + 1)); persist(); build(); };
          opts.appendChild(addOpt);
        } else if (q.type === "rating") {
          opts.innerHTML = `<div class="fm-stars">${"<span>&#9733;</span>".repeat(5)}</div>`;
        } else {
          opts.innerHTML = `<input class="fm-text-ph" disabled placeholder="Short answer text">`;
        }
        scroll.appendChild(card);
      });

      const addWrap = el(`<div class="fm-add">
        <button data-t="text">+ Text</button>
        <button data-t="choice">+ Multiple choice</button>
        <button data-t="rating">+ Rating</button>
      </div>`);
      addWrap.querySelectorAll("button").forEach((b) => b.onclick = () => { form.questions.push(newQuestion(b.dataset.t)); persist(); build(); });
      scroll.appendChild(addWrap);
    }

    function renderPreview(scroll) {
      const wrap = el(`<div class="fm-preview">
        <div class="fm-card fm-headcard fm-p-head"><h2>${escapeHtml(form.title)}</h2>${form.desc ? `<p>${escapeHtml(form.desc)}</p>` : ""}</div>
      </div>`);
      const answers = {};
      form.questions.forEach((q, qi) => {
        const card = el(`<div class="fm-card"><div class="fm-p-q">${escapeHtml(q.q)}${q.required ? ' <span class="fm-star">*</span>' : ""}</div><div class="fm-p-in"></div></div>`);
        const inp = card.querySelector(".fm-p-in");
        if (q.type === "text") { const i = el(`<input class="fm-p-text" placeholder="Your answer">`); i.oninput = () => answers[qi] = i.value; inp.appendChild(i); }
        else if (q.type === "choice") {
          q.options.forEach((opt) => { const r = el(`<label class="fm-p-opt"><input type="radio" name="q${qi}"> <span>${escapeHtml(opt)}</span></label>`); r.querySelector("input").onchange = () => answers[qi] = opt; inp.appendChild(r); });
        } else if (q.type === "rating") {
          const stars = el(`<div class="fm-p-stars">${[1, 2, 3, 4, 5].map((n) => `<span data-n="${n}">&#9733;</span>`).join("")}</div>`);
          stars.querySelectorAll("span").forEach((sp) => sp.onclick = () => { answers[qi] = +sp.dataset.n; stars.querySelectorAll("span").forEach((s2) => s2.classList.toggle("on", +s2.dataset.n <= answers[qi])); });
          inp.appendChild(stars);
        }
        wrap.appendChild(card);
      });
      const submit = el(`<button class="fm-submit">Submit</button>`);
      submit.onclick = () => {
        for (let i = 0; i < form.questions.length; i++) { if (form.questions[i].required && (answers[i] == null || answers[i] === "")) { toast("Please answer required questions"); return; } }
        form.responses.push({ at: Date.now(), answers }); persist();
        wrap.replaceWith(el(`<div class="fm-thanks"><div class="fm-thanks-ic">${Icon.mini("forms", "Forms")}</div><h2>Thanks!</h2><p>Your response was recorded.</p></div>`));
      };
      wrap.appendChild(submit);
      scroll.appendChild(wrap);
    }
    function renderResponses() {
      mode = "responses"; build();
      const scroll = body.querySelector(".fm-scroll"); scroll.innerHTML = "";
      const head = el(`<div class="fm-card fm-headcard"><h2>${form.responses.length} response${form.responses.length === 1 ? "" : "s"}</h2></div>`);
      scroll.appendChild(head);
      if (!form.responses.length) { scroll.appendChild(el(`<div class="muted" style="padding:20px;text-align:center">No responses yet. Switch to Preview to submit one.</div>`)); return; }
      form.questions.forEach((q, qi) => {
        const card = el(`<div class="fm-card"><div class="fm-p-q">${escapeHtml(q.q)}</div><div class="fm-resp-list"></div></div>`);
        const list = card.querySelector(".fm-resp-list");
        form.responses.forEach((r) => { const v = r.answers[qi]; if (v != null && v !== "") list.appendChild(el(`<div class="fm-resp">${q.type === "rating" ? "&#9733; " + v : escapeHtml(String(v))}</div>`)); });
        if (!list.children.length) list.innerHTML = `<div class="muted">No answers</div>`;
        scroll.appendChild(card);
      });
    }

    build();
  }
  AppRegistry.forms = function () { openForms(null); };

  // ===================== POWERPOINT =====================
  const screen = () => document.getElementById("screen");
  function newSlide(title, sub) { return { bg: "#ffffff", title: title || "", body: sub || "", titleColor: "#17181c", bodyColor: "#5a5f6b" }; }
  function defaultDeck() { return { slides: [newSlide("Presentation title", "Add your subtitle")] }; }

  function openPowerPoint(fileRef) {
    const ref = cw({ title: "PowerPoint", icon: Icon.mini("powerpoint", "PowerPoint"), width: 980, height: 680, appId: "powerpoint" });
    const body = ref.body, win = ref.win;
    if (!S().appData) S().appData = {};
    let current = null, deck;
    if (fileRef && fileRef.node) { try { deck = JSON.parse(fileRef.node.content || ""); } catch (_) { deck = defaultDeck(); } current = { name: fileRef.name, node: fileRef.node }; }
    else { deck = (S().appData.powerpoint && S().appData.powerpoint.deck) || defaultDeck(); }
    if (!deck.slides || !deck.slides.length) deck = defaultDeck();
    let idx = 0;
    const titleText = () => win.querySelector(".win-titlebar .t-text");

    body.innerHTML = `<div class="pp">
      <div class="pp-top">
        <span class="pp-ic">${Icon.mini("powerpoint", "PowerPoint")}</span>
        <div class="pp-filemenu">
          <button data-f="new">New</button><button data-f="open">Open</button><button data-f="save">Save</button><button data-f="saveas">Save As</button>
        </div>
        <span class="grow"></span>
        <label class="pp-bg" title="Slide background">Background<input type="color" class="pp-bgc" value="#ffffff"></label>
        <button class="pp-present">▶ Present</button>
      </div>
      <div class="pp-main">
        <div class="pp-rail"></div>
        <div class="pp-stage"><div class="pp-slide" id="slide"></div></div>
      </div>
      <div class="pp-tools">
        <button data-a="add">+ New slide</button>
        <button data-a="dup">Duplicate</button>
        <button data-a="del">Delete</button>
        <button data-a="img">Insert image</button>
        <span class="grow"></span>
        <span class="pp-pos muted"></span>
      </div>
    </div>`;

    const rail = body.querySelector(".pp-rail");
    const stage = body.querySelector(".pp-slide");
    const pos = body.querySelector(".pp-pos");
    const bgc = body.querySelector(".pp-bgc");

    function persist() {
      if (current) { current.node.content = JSON.stringify(deck); current.node.ts = Date.now(); }
      else S().appData.powerpoint = { deck };
      State.save();
    }
    function setTitleBar() { if (titleText()) titleText().textContent = (current ? current.name : "Presentation") + " — PowerPoint"; }

    function renderRail() {
      rail.innerHTML = "";
      deck.slides.forEach((s, i) => {
        const thumbImgs = (s.images || []).map((im) => `<div class="pp-thumb-img" style="left:${im.x}%;top:${im.y}%;width:${im.w}%;height:${im.h}%"><img src="${im.src}" alt=""></div>`).join("");
        const th = el(`<button class="pp-thumb ${i === idx ? "active" : ""}"><span class="pp-thumb-n">${i + 1}</span><div class="pp-thumb-slide" style="background:${s.bg}"><div class="pp-thumb-title" style="color:${s.titleColor}">${escapeHtml((s.title || "").replace(/<[^>]+>/g, "")).slice(0, 40)}</div>${thumbImgs}</div></button>`);
        th.onclick = () => { idx = i; renderAll(); };
        rail.appendChild(th);
      });
    }
    function renderSlide() {
      const s = deck.slides[idx];
      stage.style.background = s.bg;
      bgc.value = /^#/.test(s.bg) ? s.bg : "#ffffff";
      stage.innerHTML = `
        <div class="pp-title" contenteditable="true" data-ph="Click to add title" style="color:${s.titleColor}">${s.title || ""}</div>
        <div class="pp-body" contenteditable="true" data-ph="Click to add text" style="color:${s.bodyColor}">${s.body || ""}</div>`;
      const t = stage.querySelector(".pp-title"), bd = stage.querySelector(".pp-body");
      t.addEventListener("input", () => { s.title = t.innerHTML; persist(); renderRailTitle(); });
      bd.addEventListener("input", () => { s.body = bd.innerHTML; persist(); });
      (s.images || []).forEach((im) => mountImage(s, im));
      // Click empty slide area to deselect images.
      stage.addEventListener("mousedown", (e) => { if (e.target === stage) stage.querySelectorAll(".pp-img.sel").forEach((x) => x.classList.remove("sel")); });
      pos.textContent = "Slide " + (idx + 1) + " of " + deck.slides.length;
    }

    // Add a movable / resizable image box to the current slide's stage.
    function mountImage(s, im) {
      const box = el(`<div class="pp-img" style="left:${im.x}%;top:${im.y}%;width:${im.w}%;height:${im.h}%">
        <img src="${im.src}" alt="" draggable="false">
        <span class="pp-img-del" title="Delete">&times;</span>
        <span class="pp-img-rz" title="Resize"></span>
      </div>`);
      stage.appendChild(box);
      const select = () => { stage.querySelectorAll(".pp-img.sel").forEach((x) => x.classList.remove("sel")); box.classList.add("sel"); };
      box.addEventListener("mousedown", (e) => { if (e.target.classList.contains("pp-img-rz") || e.target.classList.contains("pp-img-del")) return; startDrag(e, "move"); });
      box.addEventListener("touchstart", (e) => { if (e.target.classList.contains("pp-img-rz") || e.target.classList.contains("pp-img-del")) return; startDrag(e, "move"); }, { passive: false });
      box.querySelector(".pp-img-rz").addEventListener("mousedown", (e) => startDrag(e, "resize"));
      box.querySelector(".pp-img-rz").addEventListener("touchstart", (e) => startDrag(e, "resize"), { passive: false });
      box.querySelector(".pp-img-del").onclick = () => { const i = s.images.indexOf(im); if (i >= 0) s.images.splice(i, 1); persist(); box.remove(); };

      function startDrag(e, mode) {
        e.preventDefault(); e.stopPropagation(); select();
        const pt0 = e.touches ? e.touches[0] : e;
        const rect = stage.getBoundingClientRect();
        const sx = pt0.clientX, sy = pt0.clientY;
        const ox = im.x, oy = im.y, ow = im.w, oh = im.h;
        const move = (ev) => {
          const p = ev.touches ? ev.touches[0] : ev; if (ev.cancelable) ev.preventDefault();
          const dxp = ((p.clientX - sx) / rect.width) * 100, dyp = ((p.clientY - sy) / rect.height) * 100;
          if (mode === "move") {
            im.x = Math.max(0, Math.min(100 - im.w, ox + dxp));
            im.y = Math.max(0, Math.min(100 - im.h, oy + dyp));
            box.style.left = im.x + "%"; box.style.top = im.y + "%";
          } else {
            im.w = Math.max(6, Math.min(100 - im.x, ow + dxp));
            im.h = Math.max(6, Math.min(100 - im.y, oh + dyp));
            box.style.width = im.w + "%"; box.style.height = im.h + "%";
          }
        };
        const up = () => {
          window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
          window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up);
          persist();
        };
        window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
        window.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up);
      }
    }
    function insertImage() {
      const inp = document.getElementById("globalFileInput");
      inp.accept = "image/*"; inp.value = "";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          const s = deck.slides[idx];
          if (!s.images) s.images = [];
          s.images.push({ src: rd.result, x: 22, y: 24, w: 44, h: 40 });
          persist(); renderSlide();
        };
        rd.readAsDataURL(f);
      };
      inp.click();
    }
    function renderRailTitle() { const th = rail.children[idx]; if (th) { const el2 = th.querySelector(".pp-thumb-title"); if (el2) el2.textContent = (deck.slides[idx].title || "").replace(/<[^>]+>/g, "").slice(0, 40); } }
    function renderAll() { renderRail(); renderSlide(); }

    body.querySelector('[data-a="add"]').onclick = () => { deck.slides.splice(idx + 1, 0, newSlide("", "")); idx++; persist(); renderAll(); };
    body.querySelector('[data-a="dup"]').onclick = () => { deck.slides.splice(idx + 1, 0, JSON.parse(JSON.stringify(deck.slides[idx]))); idx++; persist(); renderAll(); };
    body.querySelector('[data-a="del"]').onclick = () => { if (deck.slides.length <= 1) return; deck.slides.splice(idx, 1); idx = Math.max(0, idx - 1); persist(); renderAll(); };
    body.querySelector('[data-a="img"]').onclick = insertImage;
    bgc.oninput = () => { deck.slides[idx].bg = bgc.value; persist(); renderSlide(); renderRail(); };

    // File menu
    body.querySelectorAll(".pp-filemenu [data-f]").forEach((b) => b.onclick = () => {
      const f = b.dataset.f;
      if (f === "new") { deck = defaultDeck(); idx = 0; current = null; setTitleBar(); persist(); renderAll(); }
      else if (f === "open") window.VFS.pickFile({ title: "Open presentation", accept: ["pptx"] }, (res) => { if (res) { ref.close(); openPowerPoint(res); } });
      else if (f === "save") { if (!current) return saveAs(); persist(); toast("Saved " + current.name); }
      else if (f === "saveas") saveAs();
    });
    function saveAs() {
      window.VFS.pickSave({ title: "Save presentation", defaultName: current ? current.name.replace(/\.[a-z0-9]+$/i, "") : "Presentation", kind: "pptx" }, (res) => {
        const node = { type: "file", kind: "pptx", content: JSON.stringify(deck), ts: Date.now() };
        res.children[res.name] = node; State.save();
        current = { name: res.name, node }; setTitleBar(); toast("Saved " + res.name);
      });
    }

    // Present mode
    body.querySelector(".pp-present").onclick = () => {
      let i = idx;
      const ov = el(`<div class="pp-present-ov">
        <div class="pp-present-slide" id="ps"></div>
        <div class="pp-present-bar"><button id="prev">‹</button><span id="pc" class="muted"></span><button id="next">›</button><button id="exit">Exit</button></div>
      </div>`);
      function show() { const s = deck.slides[i]; const el2 = ov.querySelector("#ps"); el2.style.background = s.bg; const imgs = (s.images || []).map((im) => `<div class="pp-p-img" style="left:${im.x}%;top:${im.y}%;width:${im.w}%;height:${im.h}%"><img src="${im.src}" alt=""></div>`).join(""); el2.innerHTML = `<div class="pp-p-title" style="color:${s.titleColor}">${s.title || ""}</div><div class="pp-p-body" style="color:${s.bodyColor}">${s.body || ""}</div>${imgs}`; ov.querySelector("#pc").textContent = (i + 1) + " / " + deck.slides.length; }
      const next = () => { if (i < deck.slides.length - 1) { i++; show(); } };
      const prev = () => { if (i > 0) { i--; show(); } };
      function close() { ov.remove(); document.removeEventListener("keydown", key); }
      function key(e) { if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); } else if (e.key === "ArrowLeft") prev(); else if (e.key === "Escape") close(); }
      ov.querySelector("#next").onclick = next; ov.querySelector("#prev").onclick = prev; ov.querySelector("#exit").onclick = close;
      ov.querySelector("#ps").onclick = next;
      document.addEventListener("keydown", key);
      screen().appendChild(ov); show();
    };

    setTitleBar();
    renderAll();
  }

  AppRegistry.powerpoint = function () { openPowerPoint(null); };

  window.Office = { openWord: openWord, openPowerPoint: openPowerPoint, openExcel: openExcel, openForms: openForms };
})();
