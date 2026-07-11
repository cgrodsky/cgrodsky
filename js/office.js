/* Microsoft 365 apps. Word first — a real rich-text editor with a ribbon,
   an editable page, and autosave. (Excel, PowerPoint, etc. to follow.) */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const FONTS = ["Calibri", "Arial", "Times New Roman", "Georgia", "Verdana", "Courier New", "Comic Sans MS"];
  const SIZES = [["1", "10"], ["2", "13"], ["3", "16"], ["4", "18"], ["5", "24"], ["6", "32"], ["7", "48"]]; // execCommand fontSize -> label

  AppRegistry.word = function () {
    const { body } = cw({ title: "Word", icon: Icon.mini("word", "Word"), width: 860, height: 620, appId: "word" });
    if (!S().appData) S().appData = {};
    const data = S().appData.word || (S().appData.word = { name: "Document1", content: "" });

    body.innerHTML = `<div class="wd">
      <div class="wd-top">
        <span class="wd-ic">${Icon.mini("word", "Word")}</span>
        <input class="wd-name" value="${escapeHtml(data.name)}">
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
    page.innerHTML = data.content || "";
    try { document.execCommand("styleWithCSS", false, true); } catch (_) {}

    let savedRange = null;
    const saveSel = () => { const s = window.getSelection(); if (s.rangeCount && page.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); };
    const restoreSel = () => { page.focus(); if (savedRange) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(savedRange); } };
    const exec = (cmd, val) => { restoreSel(); try { document.execCommand("styleWithCSS", false, true); } catch (_) {} document.execCommand(cmd, false, val); save(); };

    function updateCount() {
      const text = (page.innerText || "").trim();
      const words = text ? text.split(/\s+/).length : 0;
      count.textContent = words + (words === 1 ? " word" : " words");
    }
    function save() { data.content = page.innerHTML; State.save(); updateCount(); }

    // toolbar buttons — mousedown+preventDefault keeps the selection
    body.querySelectorAll(".wd-ribbon [data-cmd]").forEach((b) => {
      b.addEventListener("mousedown", (e) => { e.preventDefault(); document.execCommand(b.dataset.cmd, false, null); save(); });
    });
    body.querySelector(".wd-clear").addEventListener("mousedown", (e) => { e.preventDefault(); document.execCommand("removeFormat", false, null); save(); });

    // selects + color pickers — save selection, then apply
    page.addEventListener("keyup", saveSel);
    page.addEventListener("mouseup", saveSel);
    const fontSel = body.querySelector(".wd-font"), sizeSel = body.querySelector(".wd-size");
    fontSel.addEventListener("mousedown", saveSel);
    sizeSel.addEventListener("mousedown", saveSel);
    fontSel.onchange = () => exec("fontName", fontSel.value);
    sizeSel.onchange = () => exec("fontSize", sizeSel.value);
    const fore = body.querySelector(".wd-fore"), back = body.querySelector(".wd-back");
    fore.parentElement.addEventListener("mousedown", saveSel);
    back.parentElement.addEventListener("mousedown", saveSel);
    fore.oninput = () => { fore.nextElementSibling.style.background = fore.value; exec("foreColor", fore.value); };
    back.oninput = () => { back.nextElementSibling.style.background = back.value; exec("hiliteColor", back.value); };

    page.addEventListener("input", save);
    nameInput.oninput = () => { data.name = nameInput.value || "Document1"; State.save(); };
    updateCount();
    setTimeout(() => page.focus(), 60);
  };
})();
