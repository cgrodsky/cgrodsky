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

    body.innerHTML = `<div class="wd">
      <div class="wd-top">
        <span class="wd-ic">${Icon.mini("word", "Word")}</span>
        <input class="wd-name" title="Document name">
        <div class="wd-filemenu">
          <button data-f="new">New</button>
          <button data-f="open">Open</button>
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

    loadDoc(fileRef || null);
    setTimeout(() => page.focus(), 60);
  }

  AppRegistry.word = function () { openWord(null); };

  window.Office = { openWord: openWord };
})();
