/* Visual Studio Code — activity bar, explorer, tabbed editor with syntax
   highlighting, command palette, status bar, and an HTML live preview.
   Project files persist in appData.vscode. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  // ---------- sample project ----------
  function seedProject() {
    return {
      name: "windows12-site",
      tree: {
        "index.html": { type: "file", content: "<!DOCTYPE html>\n<html>\n<head>\n  <meta charset=\"UTF-8\">\n  <title>My Page</title>\n  <link rel=\"stylesheet\" href=\"style.css\">\n</head>\n<body>\n  <h1>Hello, Windows 12 👋</h1>\n  <p>Edit this file and hit <b>Run</b> to preview.</p>\n  <button id=\"btn\">Click me</button>\n  <script src=\"script.js\"></script>\n</body>\n</html>\n" },
        "style.css": { type: "file", content: "body {\n  font-family: 'Segoe UI', system-ui, sans-serif;\n  background: linear-gradient(135deg, #4c8dff, #a855f7);\n  color: #fff;\n  text-align: center;\n  padding: 60px 20px;\n}\nbutton {\n  background: #fff;\n  color: #4c8dff;\n  border: 0;\n  padding: 12px 26px;\n  border-radius: 8px;\n  font-size: 1rem;\n  cursor: pointer;\n}\n" },
        "script.js": { type: "file", content: "// A tiny script\nconst btn = document.getElementById('btn');\nlet count = 0;\nbtn.addEventListener('click', () => {\n  count++;\n  btn.textContent = `Clicked ${count} time${count === 1 ? '' : 's'}`;\n});\n" },
        "README.md": { type: "file", content: "# Windows 12 Site\n\nA sample project inside **VS Code** for Windows 12.\n\n- Edit files in the Explorer\n- Press **Run** on index.html to preview\n- Open the Command Palette with Ctrl+Shift+P\n" },
        "data.json": { type: "file", content: "{\n  \"name\": \"windows12\",\n  \"version\": \"1.0.0\",\n  \"cool\": true,\n  \"apps\": [\"Word\", \"Excel\", \"Copilot\"]\n}\n" },
      },
    };
  }
  function proj() { if (!S().appData) S().appData = {}; if (!S().appData.vscode) S().appData.vscode = seedProject(); return S().appData.vscode; }

  const LANG = { html: "HTML", css: "CSS", js: "JavaScript", json: "JSON", md: "Markdown", py: "Python", txt: "Plain Text" };
  function langOf(name) { const e = (name.split(".").pop() || "").toLowerCase(); if (e === "htm") return "html"; if (LANG[e]) return e; return "txt"; }
  const FILE_ICON = {
    html: `<span class="vs-fic" style="color:#e44d26">&#60;&#62;</span>`,
    css: `<span class="vs-fic" style="color:#42a5f5">#</span>`,
    js: `<span class="vs-fic" style="color:#f7df1e">JS</span>`,
    json: `<span class="vs-fic" style="color:#cbcb41">{}</span>`,
    md: `<span class="vs-fic" style="color:#42a5f5">M&#8595;</span>`,
    py: `<span class="vs-fic" style="color:#4b8bbe">Py</span>`,
    txt: `<span class="vs-fic" style="color:#9aa0a6">&#9776;</span>`,
  };

  // ---------- syntax highlighting ----------
  const KW = { js: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "new", "class", "extends", "import", "export", "from", "async", "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "this", "true", "false", "null", "undefined", "of", "in", "do", "switch", "case", "break", "continue", "default"], py: ["def", "return", "if", "elif", "else", "for", "while", "import", "from", "class", "try", "except", "finally", "with", "as", "lambda", "None", "True", "False", "and", "or", "not", "in", "is", "pass", "break", "continue", "print"] };
  function highlight(code, lang) {
    // tokenizer that protects strings/comments, then keywords/numbers.
    const out = [];
    if (lang === "html") return hlHtml(code);
    if (lang === "css") return hlCss(code);
    if (lang === "json") return hlJson(code);
    if (lang === "md") return esc(code).replace(/^(#{1,6} .*)$/gm, '<span class="t-key">$1</span>').replace(/(\*\*[^*]+\*\*)/g, '<span class="t-str">$1</span>').replace(/`([^`]+)`/g, '<span class="t-num">`$1`</span>');
    const kws = KW[lang] || KW.js;
    let i = 0; const s = code;
    function push(cls, txt) { out.push(cls ? `<span class="${cls}">${esc(txt)}</span>` : esc(txt)); }
    while (i < s.length) {
      const c = s[i];
      if ((c === "/" && s[i + 1] === "/") || (lang === "py" && c === "#")) { let j = i; while (j < s.length && s[j] !== "\n") j++; push("t-com", s.slice(i, j)); i = j; continue; }
      if (c === "/" && s[i + 1] === "*") { let j = i + 2; while (j < s.length && !(s[j] === "*" && s[j + 1] === "/")) j++; j += 2; push("t-com", s.slice(i, Math.min(j, s.length))); i = j; continue; }
      if (c === '"' || c === "'" || c === "`") { let j = i + 1; while (j < s.length && s[j] !== c) { if (s[j] === "\\") j++; j++; } j++; push("t-str", s.slice(i, Math.min(j, s.length))); i = j; continue; }
      if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < s.length && /[A-Za-z0-9_$]/.test(s[j])) j++; const w = s.slice(i, j); if (kws.indexOf(w) >= 0) push("t-key", w); else if (s[j] === "(") push("t-fn", w); else push(null, w); i = j; continue; }
      if (/[0-9]/.test(c)) { let j = i; while (j < s.length && /[0-9.xXa-fA-F]/.test(s[j])) j++; push("t-num", s.slice(i, j)); i = j; continue; }
      push(null, c); i++;
    }
    return out.join("");
  }
  function hlHtml(code) {
    // A small tokenizer (no chained regex) so inserted markup is never re-scanned.
    const out = []; let i = 0;
    while (i < code.length) {
      if (code.startsWith("<!--", i)) { let j = code.indexOf("-->", i); j = j < 0 ? code.length : j + 3; out.push('<span class="t-com">' + esc(code.slice(i, j)) + "</span>"); i = j; continue; }
      if (code[i] === "<") {
        let j = i + 1; if (code[j] === "/") j++;
        const ns = j; while (j < code.length && /[\w-]/.test(code[j])) j++;
        out.push(esc(code.slice(i, ns)) + '<span class="t-tag">' + esc(code.slice(ns, j)) + "</span>");
        while (j < code.length && code[j] !== ">") {
          const ch = code[j];
          if (ch === '"' || ch === "'") { let k = j + 1; while (k < code.length && code[k] !== ch) k++; k++; out.push('<span class="t-str">' + esc(code.slice(j, k)) + "</span>"); j = k; }
          else if (/[a-zA-Z-]/.test(ch)) { let k = j; while (k < code.length && /[\w-]/.test(code[k])) k++; out.push('<span class="t-attr">' + esc(code.slice(j, k)) + "</span>"); j = k; }
          else { out.push(esc(ch)); j++; }
        }
        if (code[j] === ">") { out.push(esc(">")); j++; }
        i = j; continue;
      }
      let j = i; while (j < code.length && code[j] !== "<") j++;
      out.push(esc(code.slice(i, j))); i = j;
    }
    return out.join("");
  }
  function hlCss(code) {
    return esc(code)
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="t-com">$1</span>')
      .replace(/([.#]?[a-zA-Z0-9_-]+)(\s*\{)/g, '<span class="t-tag">$1</span>$2')
      .replace(/([a-z-]+)(\s*:)/g, '<span class="t-attr">$1</span>$2')
      .replace(/(:[^;\n{]+)(;)/g, '<span class="t-str">$1</span>$2');
  }
  function hlJson(code) {
    return esc(code)
      .replace(/("(\\.|[^"])*")(\s*:)/g, '<span class="t-attr">$1</span>$3')
      .replace(/:\s*("(\\.|[^"])*")/g, ': <span class="t-str">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="t-key">$1</span>')
      .replace(/(-?\d+\.?\d*)/g, '<span class="t-num">$1</span>');
  }

  const AB = {
    files: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9z"/><path d="M13 3v6h6"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
    git: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="9" r="2.5"/><path d="M6 8.5v7M18 11.5c0 3-4 3-6 3.5"/></svg>`,
    run: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 5v14l11-7z"/><circle cx="17" cy="17" r="4" fill="var(--vs-bg)"/><path d="M17 15v4M15 17h4"/></svg>`,
    ext: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><path d="M17 13v4m0 0v4m0-4h4m-4 0h-4"/></svg>`,
  };

  function openVSCode() {
    const ref = cw({ title: "Visual Studio Code", icon: window.Icon ? Icon.mini("vscode", "VS Code") : "", width: 1040, height: 700, appId: "vscode" });
    const body = ref.body;
    body.classList.add("vs-host");
    const p = proj();
    let openTabs = [];   // [name]
    let active = null;   // name
    let view = "files";  // activity bar view

    body.innerHTML = `<div class="vs">
      <div class="vs-activity">
        <button class="vs-ab on" data-v="files" title="Explorer">${AB.files}</button>
        <button class="vs-ab" data-v="search" title="Search">${AB.search}</button>
        <button class="vs-ab" data-v="git" title="Source Control">${AB.git}</button>
        <button class="vs-ab" data-v="run" title="Run and Debug">${AB.run}</button>
        <button class="vs-ab" data-v="ext" title="Extensions">${AB.ext}</button>
      </div>
      <div class="vs-side"></div>
      <div class="vs-main">
        <div class="vs-tabs"></div>
        <div class="vs-stage"></div>
      </div>
    </div>`;
    const sideEl = body.querySelector(".vs-side");
    const tabsEl = body.querySelector(".vs-tabs");
    const stageEl = body.querySelector(".vs-stage");

    body.querySelectorAll(".vs-ab").forEach((b) => b.onclick = () => { view = b.dataset.v; body.querySelectorAll(".vs-ab").forEach((x) => x.classList.toggle("on", x === b)); renderSide(); });

    function fileNames() { return Object.keys(p.tree).sort(); }
    function renderSide() {
      if (view === "files") {
        sideEl.innerHTML = `<div class="vs-side-h"><span>Explorer</span><button class="vs-newfile" title="New File">+</button></div><div class="vs-title">${esc(p.name).toUpperCase()}</div><div class="vs-tree"></div>`;
        const tree = sideEl.querySelector(".vs-tree");
        fileNames().forEach((nm) => {
          const lang = langOf(nm);
          const row = el(`<button class="vs-file ${nm === active ? "on" : ""}">${FILE_ICON[lang] || FILE_ICON.txt}<span class="vs-file-nm">${esc(nm)}</span><span class="vs-file-x" title="Delete">&times;</span></button>`);
          row.querySelector(".vs-file-nm").onclick = () => openFile(nm);
          row.querySelector(".vs-file-x").onclick = (e) => { e.stopPropagation(); dlgConfirm("Delete " + nm + "?").then((y) => { if (y) { delete p.tree[nm]; closeTab(nm); State.save(); renderSide(); } }); };
          tree.appendChild(row);
        });
        sideEl.querySelector(".vs-newfile").onclick = () => dlgInput("New file name", "untitled.js").then((nm) => { if (!nm) return; if (!p.tree[nm]) p.tree[nm] = { type: "file", content: "" }; State.save(); renderSide(); openFile(nm); });
      } else if (view === "search") {
        sideEl.innerHTML = `<div class="vs-side-h"><span>Search</span></div><div class="vs-search"><input placeholder="Search"></div><div class="vs-search-res"></div>`;
        const inp = sideEl.querySelector("input"); const res = sideEl.querySelector(".vs-search-res");
        inp.oninput = () => { const q = inp.value.toLowerCase(); res.innerHTML = ""; if (!q) return; fileNames().forEach((nm) => { const hits = (p.tree[nm].content.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length; if (hits) { const r = el(`<button class="vs-sr">${FILE_ICON[langOf(nm)] || ""}<span>${esc(nm)}</span><b>${hits}</b></button>`); r.onclick = () => openFile(nm); res.appendChild(r); } }); };
        setTimeout(() => inp.focus(), 30);
      } else if (view === "git") {
        sideEl.innerHTML = `<div class="vs-side-h"><span>Source Control</span></div><div class="vs-git"><div class="vs-git-msg">No changes staged</div><div class="vs-git-list"></div></div>`;
        const list = sideEl.querySelector(".vs-git-list");
        fileNames().forEach((nm) => list.appendChild(el(`<div class="vs-git-row"><span class="vs-git-m">M</span>${esc(nm)}</div>`)));
      } else if (view === "run") {
        sideEl.innerHTML = `<div class="vs-side-h"><span>Run and Debug</span></div><div class="vs-run"><button class="vs-run-btn">▶ Run index.html</button><p class="vs-run-note">Runs the HTML preview.</p></div>`;
        sideEl.querySelector(".vs-run-btn").onclick = () => runPreview();
      } else {
        sideEl.innerHTML = `<div class="vs-side-h"><span>Extensions</span></div><div class="vs-ext">
          ${["Prettier", "GitLens", "Live Server", "Python", "ESLint", "Copilot"].map((n) => `<div class="vs-ext-row"><div class="vs-ext-ic">${n[0]}</div><div><b>${n}</b><span>Installed</span></div></div>`).join("")}
        </div>`;
      }
    }

    function openFile(nm) { if (!p.tree[nm]) return; if (openTabs.indexOf(nm) < 0) openTabs.push(nm); active = nm; renderTabs(); renderEditor(); renderSide(); }
    function closeTab(nm) { const i = openTabs.indexOf(nm); if (i >= 0) openTabs.splice(i, 1); if (active === nm) active = openTabs[openTabs.length - 1] || null; renderTabs(); renderEditor(); }
    function renderTabs() {
      tabsEl.innerHTML = "";
      openTabs.forEach((nm) => {
        const t = el(`<div class="vs-tab ${nm === active ? "on" : ""}">${FILE_ICON[langOf(nm)] || ""}<span>${esc(nm)}</span><span class="vs-tab-x" title="Close">&times;</span></div>`);
        t.onclick = (e) => { if (e.target.closest(".vs-tab-x")) { closeTab(nm); return; } active = nm; renderTabs(); renderEditor(); renderSide(); };
        tabsEl.appendChild(t);
      });
    }

    let statusEl;
    function renderEditor() {
      if (!active) { stageEl.innerHTML = `<div class="vs-welcome"><div class="vs-welcome-logo">${window.Icon ? Icon.big("vscode", "VS Code") : ""}</div><h1>Visual Studio Code</h1><p>Editing evolved</p><div class="vs-welcome-tips"><div>Open a file from the Explorer</div><div>Ctrl+Shift+P — Command Palette</div><div>Run index.html to preview</div></div></div>`; return; }
      const f = p.tree[active], lang = langOf(active);
      stageEl.innerHTML = `<div class="vs-editor">
        <div class="vs-gutter"></div>
        <div class="vs-code-wrap"><pre class="vs-hl"></pre><textarea class="vs-ta" spellcheck="false" wrap="off"></textarea></div>
      </div>
      <div class="vs-status"><span class="vs-st-left"><span class="vs-st-branch">&#9095; main</span></span><span class="grow"></span><span class="vs-st-pos">Ln 1, Col 1</span><span>${LANG[lang]}</span><span>UTF-8</span></div>`;
      const gutter = stageEl.querySelector(".vs-gutter");
      const hl = stageEl.querySelector(".vs-hl");
      const ta = stageEl.querySelector(".vs-ta");
      const pos = stageEl.querySelector(".vs-st-pos");
      ta.value = f.content;
      function paint() {
        hl.innerHTML = highlight(ta.value, lang) + "\n";
        const lines = ta.value.split("\n").length;
        gutter.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join("");
      }
      function updatePos() {
        const upto = ta.value.slice(0, ta.selectionStart).split("\n");
        pos.textContent = "Ln " + upto.length + ", Col " + (upto[upto.length - 1].length + 1);
      }
      ta.addEventListener("input", () => { f.content = ta.value; State.save(); paint(); updatePos(); });
      ta.addEventListener("scroll", () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; });
      ta.addEventListener("keyup", updatePos);
      ta.addEventListener("click", updatePos);
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 2; f.content = ta.value; paint(); }
      });
      paint(); updatePos();
      setTimeout(() => ta.focus(), 20);
    }

    function runPreview() {
      const html = p.tree["index.html"] ? p.tree["index.html"].content : null;
      if (!html) { dlgAlertV("No index.html to run."); return; }
      const css = p.tree["style.css"] ? p.tree["style.css"].content : "";
      const js = p.tree["script.js"] ? p.tree["script.js"].content : "";
      let doc = html.replace(/<link[^>]*href=["']style\.css["'][^>]*>/i, `<style>${css}</style>`).replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>/i, `<script>${js}<\/script>`);
      const ov = el(`<div class="vs-preview-ov"><div class="vs-preview"><div class="vs-preview-bar"><span class="vs-pv-dot" style="background:#ff5f56"></span><span class="vs-pv-dot" style="background:#ffbd2e"></span><span class="vs-pv-dot" style="background:#27c93f"></span><span class="vs-pv-url">index.html — Live Preview</span><button class="vs-pv-close">&times;</button></div><iframe class="vs-pv-frame"></iframe></div></div>`);
      ref.body.appendChild(ov);
      const iframe = ov.querySelector("iframe");
      iframe.srcdoc = doc;
      ov.querySelector(".vs-pv-close").onclick = () => ov.remove();
      ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    }

    // Command palette
    function palette() {
      const cmds = [
        { name: "Run: Live Preview (index.html)", act: runPreview },
        { name: "File: New File", act: () => dlgInput("New file name", "untitled.js").then((nm) => { if (nm) { if (!p.tree[nm]) p.tree[nm] = { type: "file", content: "" }; State.save(); renderSide(); openFile(nm); } }) },
        { name: "View: Explorer", act: () => { view = "files"; renderSide(); } },
        { name: "View: Search", act: () => { view = "search"; renderSide(); } },
        { name: "View: Source Control", act: () => { view = "git"; renderSide(); } },
        { name: "View: Extensions", act: () => { view = "ext"; renderSide(); } },
      ].concat(fileNames().map((nm) => ({ name: "Go to File: " + nm, act: () => openFile(nm) })));
      const ov = el(`<div class="vs-pal-ov"><div class="vs-pal"><input class="vs-pal-in" placeholder="Type a command or file name…"><div class="vs-pal-list"></div></div></div>`);
      ref.body.appendChild(ov);
      const inp = ov.querySelector(".vs-pal-in"); const list = ov.querySelector(".vs-pal-list");
      function draw(q) { list.innerHTML = ""; cmds.filter((c) => c.name.toLowerCase().includes((q || "").toLowerCase())).slice(0, 9).forEach((c) => { const r = el(`<button class="vs-pal-item">${esc(c.name)}</button>`); r.onclick = () => { ov.remove(); c.act(); }; list.appendChild(r); }); }
      inp.oninput = () => draw(inp.value);
      inp.onkeydown = (e) => { if (e.key === "Escape") ov.remove(); if (e.key === "Enter") { const first = list.querySelector(".vs-pal-item"); if (first) first.click(); } };
      ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
      draw(""); setTimeout(() => inp.focus(), 20);
    }
    body.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "P" || e.key === "p")) { e.preventDefault(); palette(); } });

    // lightweight dialogs reused (fallback to native if none present)
    function dlgConfirm(msg) { return window.Office && false ? null : new Promise((res) => { const ov = el(`<div class="wdlg-ov"><div class="wdlg"><div class="wdlg-title">${esc(msg)}</div><div class="wdlg-btns"><button class="wdlg-cancel">Cancel</button><button class="wdlg-ok danger">Delete</button></div></div></div>`); document.getElementById("screen").appendChild(ov); const d = (v) => { ov.remove(); res(v); }; ov.querySelector(".wdlg-cancel").onclick = () => d(false); ov.querySelector(".wdlg-ok").onclick = () => d(true); ov.onclick = (e) => { if (e.target === ov) d(false); }; }); }
    function dlgInput(title, initial) { return new Promise((res) => { const ov = el(`<div class="wdlg-ov"><div class="wdlg"><div class="wdlg-title">${esc(title)}</div><input class="wdlg-in" value="${esc(initial || "")}"><div class="wdlg-btns"><button class="wdlg-cancel">Cancel</button><button class="wdlg-ok">Create</button></div></div></div>`); document.getElementById("screen").appendChild(ov); const i = ov.querySelector("input"); const d = (v) => { ov.remove(); res(v); }; ov.querySelector(".wdlg-cancel").onclick = () => d(null); ov.querySelector(".wdlg-ok").onclick = () => d(i.value.trim()); i.onkeydown = (e) => { if (e.key === "Enter") d(i.value.trim()); if (e.key === "Escape") d(null); }; ov.onclick = (e) => { if (e.target === ov) d(null); }; setTimeout(() => { i.focus(); i.select(); }, 20); }); }
    function dlgAlertV(msg) { const ov = el(`<div class="wdlg-ov"><div class="wdlg"><div class="wdlg-title">${esc(msg)}</div><div class="wdlg-btns"><button class="wdlg-ok">OK</button></div></div></div>`); document.getElementById("screen").appendChild(ov); ov.querySelector(".wdlg-ok").onclick = () => ov.remove(); ov.onclick = (e) => { if (e.target === ov) ov.remove(); }; }

    renderSide(); renderTabs(); renderEditor();
    openFile("index.html");
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.vscode = openVSCode;
})();
