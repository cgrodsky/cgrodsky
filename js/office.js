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
    let cells = {}, current = null;
    if (fileRef && fileRef.node) { try { cells = (JSON.parse(fileRef.node.content || "{}").cells) || {}; } catch (_) {} current = { name: fileRef.name, node: fileRef.node }; }
    else if (S().appData.excel && S().appData.excel.cells) cells = S().appData.excel.cells;

    body.innerHTML = `<div class="wd-splash xl-splash">
      <img class="wd-splash-ic" src="assets/excel.png" onerror="this.style.display='none'" alt="">
      <div class="wd-splash-name" style="color:#217346">Excel</div>
      <div class="wd-splash-bar"><span style="background:#217346"></span></div>
      <div class="wd-splash-ms"><span class="w12-flag"><i></i><i></i><i></i><i></i></span> Microsoft</div>
    </div>`;
    setTimeout(build, 3000);

    const titleText = () => win.querySelector(".win-titlebar .t-text");
    function persist() { if (current) { current.node.content = JSON.stringify({ cells }); current.node.ts = Date.now(); } else S().appData.excel = { cells }; State.save(); }

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
        if (fn === "PRODUCT") return vals.reduce((a, b) => a * b, 1);
        return 0;
      });
      expr = expr.replace(/[A-Z]+\d+/gi, (r) => { const v = valOf(r, seen); return typeof v === "number" ? v : JSON.stringify(v); });
      try { const r = Function('"use strict";return (' + expr + ")")(); return (r == null) ? "" : r; } catch (e) { return "#ERR"; }
    }
    function display(r) { const raw = rawOf(r); if (raw === "") return ""; if (raw[0] === "=") return String(evalF(raw.slice(1), new Set([r]))); return raw; }

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
        <div class="xl-formula"><span class="xl-namebox">A1</span><span class="xl-fx">fx</span><input class="xl-fbar" spellcheck="false"></div>
        <div class="xl-grid"></div>
      </div>`;
      const gridWrap = body.querySelector(".xl-grid");
      const nameBox = body.querySelector(".xl-namebox");
      const fbar = body.querySelector(".xl-fbar");

      let html = `<table class="xl-table"><thead><tr><th class="xl-corner"></th>`;
      for (let c = 0; c < XCOLS; c++) html += `<th>${colName(c)}</th>`;
      html += `</tr></thead><tbody>`;
      for (let r = 1; r <= XROWS; r++) {
        html += `<tr><th class="xl-rownum">${r}</th>`;
        for (let c = 0; c < XCOLS; c++) { const cr = colName(c) + r; html += `<td class="xl-cell" data-ref="${cr}" contenteditable="true">${escapeHtml(display(cr))}</td>`; }
        html += `</tr>`;
      }
      html += `</tbody></table>`;
      gridWrap.innerHTML = html;

      function setActive(cr) { active = cr; body.querySelectorAll(".xl-cell.active").forEach((c) => c.classList.remove("active")); const td = gridWrap.querySelector(`[data-ref="${cr}"]`); if (td) td.classList.add("active"); nameBox.textContent = cr; fbar.value = rawOf(cr); }
      function renderValues() { gridWrap.querySelectorAll(".xl-cell").forEach((td) => { if (document.activeElement !== td) td.textContent = display(td.dataset.ref); }); }
      function commit(cr, v) { v = (v || "").trim(); if (v === "") delete cells[cr]; else cells[cr] = v; persist(); renderValues(); }

      gridWrap.querySelectorAll(".xl-cell").forEach((td) => {
        const cr = td.dataset.ref;
        td.addEventListener("focus", () => { td.textContent = rawOf(cr); setActive(cr); });
        td.addEventListener("input", () => { fbar.value = td.textContent; });
        td.addEventListener("blur", () => commit(cr, td.textContent));
        td.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); const p = parseRef(cr); td.blur(); const nx = gridWrap.querySelector(`[data-ref="${colName(p.c) + (p.r + 1)}"]`); if (nx) nx.focus(); }
          else if (e.key === "Escape") { td.textContent = display(cr); td.blur(); }
        });
        td.addEventListener("click", () => { if (document.activeElement !== td) setActive(cr); });
      });
      fbar.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commit(active, fbar.value); const td = gridWrap.querySelector(`[data-ref="${active}"]`); if (td) td.textContent = display(active); } });

      body.querySelectorAll(".xl-filemenu [data-f]").forEach((b) => b.onclick = () => {
        const f = b.dataset.f;
        if (f === "new") { cells = {}; current = null; if (titleText()) titleText().textContent = "Book1 — Excel"; persist(); build(); }
        else if (f === "open") window.VFS.pickFile({ title: "Open workbook", accept: ["xlsx"] }, (res) => { if (res) { ref.close(); openExcel(res); } });
        else if (f === "import") importCsv();
        else if (f === "save") { if (!current) return saveAs(); persist(); toast("Saved " + current.name); }
        else if (f === "saveas") saveAs();
      });
      setActive("A1");
    }
    function saveAs() {
      window.VFS.pickSave({ title: "Save workbook", defaultName: current ? current.name.replace(/\.[a-z0-9]+$/i, "") : "Book1", kind: "xlsx" }, (res) => {
        const node = { type: "file", kind: "xlsx", content: JSON.stringify({ cells }), ts: Date.now() };
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
        const th = el(`<button class="pp-thumb ${i === idx ? "active" : ""}"><span class="pp-thumb-n">${i + 1}</span><div class="pp-thumb-slide" style="background:${s.bg}"><div class="pp-thumb-title" style="color:${s.titleColor}">${escapeHtml((s.title || "").replace(/<[^>]+>/g, "")).slice(0, 40)}</div></div></button>`);
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
      pos.textContent = "Slide " + (idx + 1) + " of " + deck.slides.length;
    }
    function renderRailTitle() { const th = rail.children[idx]; if (th) { const el2 = th.querySelector(".pp-thumb-title"); if (el2) el2.textContent = (deck.slides[idx].title || "").replace(/<[^>]+>/g, "").slice(0, 40); } }
    function renderAll() { renderRail(); renderSlide(); }

    body.querySelector('[data-a="add"]').onclick = () => { deck.slides.splice(idx + 1, 0, newSlide("", "")); idx++; persist(); renderAll(); };
    body.querySelector('[data-a="dup"]').onclick = () => { deck.slides.splice(idx + 1, 0, JSON.parse(JSON.stringify(deck.slides[idx]))); idx++; persist(); renderAll(); };
    body.querySelector('[data-a="del"]').onclick = () => { if (deck.slides.length <= 1) return; deck.slides.splice(idx, 1); idx = Math.max(0, idx - 1); persist(); renderAll(); };
    bgc.oninput = () => { deck.slides[idx].bg = bgc.value; persist(); renderSlide(); renderRail(); };

    // File menu
    body.querySelectorAll(".pp-filemenu [data-f]").forEach((b) => b.onclick = () => {
      const f = b.dataset.f;
      if (f === "new") { deck = defaultDeck(); idx = 0; current = null; setTitleBar(); persist(); renderAll(); }
      else if (f === "open") window.VFS.pickFile({ title: "Open presentation", accept: ["pptx"] }, (res) => openPowerPoint(res) && ref.close());
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
      function show() { const s = deck.slides[i]; const el2 = ov.querySelector("#ps"); el2.style.background = s.bg; el2.innerHTML = `<div class="pp-p-title" style="color:${s.titleColor}">${s.title || ""}</div><div class="pp-p-body" style="color:${s.bodyColor}">${s.body || ""}</div>`; ov.querySelector("#pc").textContent = (i + 1) + " / " + deck.slides.length; }
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

  window.Office = { openWord: openWord, openPowerPoint: openPowerPoint, openExcel: openExcel };
})();
