/* Code Editor: edit HTML / CSS / JS, run live in a sandboxed iframe, and
   capture console output via postMessage. State persists per user. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const DEFAULT_HTML = '<h1>Hello, world!</h1>\n<p>Edit me, then tap <b>Run</b>.</p>\n<button id="b">Click me</button>';
  const DEFAULT_CSS  = 'body { font-family: system-ui, sans-serif; padding: 20px; color: #222; }\nh1 { color: #0067c0; }\nbutton { padding: 8px 16px; border: 0; border-radius: 8px; background: #0067c0; color: #fff; cursor: pointer; }';
  const DEFAULT_JS   = 'document.getElementById("b").onclick = () => {\n  console.log("Hello from script.js!");\n  alert("Clicked!");\n};';

  AppRegistry.codeeditor = function () {
    const ref = cw({ title: "Code Editor", icon: Icon.mini("codeeditor", "Code"), width: 920, height: 600, appId: "codeeditor" });
    const body = ref.body;
    if (!S().appData.codeEditor) S().appData.codeEditor = { html: DEFAULT_HTML, css: DEFAULT_CSS, js: DEFAULT_JS };
    const data = S().appData.codeEditor;
    for (const k of ["html", "css", "js"]) if (data[k] == null) data[k] = ({ html: DEFAULT_HTML, css: DEFAULT_CSS, js: DEFAULT_JS })[k];

    body.innerHTML = `<div class="ce">
      <div class="ce-tabs">
        <button class="ce-tab" data-t="html">index.html</button>
        <button class="ce-tab" data-t="css">style.css</button>
        <button class="ce-tab" data-t="js">script.js</button>
        <button class="ce-tab" data-t="preview">Preview</button>
        <button class="ce-tab" data-t="console">Console <span class="ce-bage" id="ceBadge"></span></button>
        <span class="grow"></span>
        <button class="ce-btn" id="ceClear" title="Clear console">Clear</button>
        <button class="ce-run" id="ceRun" title="Run">&#9654; Run</button>
      </div>
      <div class="ce-stage">
        <textarea class="ce-ed" data-t="html" spellcheck="false">${escapeHtml(data.html)}</textarea>
        <textarea class="ce-ed" data-t="css" spellcheck="false">${escapeHtml(data.css)}</textarea>
        <textarea class="ce-ed" data-t="js" spellcheck="false">${escapeHtml(data.js)}</textarea>
        <iframe class="ce-preview" data-t="preview" sandbox="allow-scripts allow-modals allow-forms" srcdoc=""></iframe>
        <div class="ce-console" data-t="console"><div class="ce-empty">Console output appears here when you Run.</div></div>
      </div>
    </div>`;

    const tabs = body.querySelectorAll(".ce-tab");
    const stages = body.querySelectorAll(".ce-stage > [data-t]");
    const consoleEl = body.querySelector(".ce-console");
    const iframe = body.querySelector(".ce-preview");
    const badge = body.querySelector("#ceBadge");
    let unread = 0;

    function setTab(t) {
      tabs.forEach((b) => b.classList.toggle("active", b.dataset.t === t));
      stages.forEach((s) => { s.style.display = s.dataset.t === t ? "" : "none"; });
      if (t === "console") { unread = 0; badge.textContent = ""; badge.style.display = "none"; }
    }
    tabs.forEach((b) => b.onclick = () => setTab(b.dataset.t));
    setTab("html");

    body.querySelectorAll(".ce-ed").forEach((ed) => {
      ed.addEventListener("input", () => { data[ed.dataset.t] = ed.value; State.save(); });
      // simple tab key inserts 2 spaces
      ed.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = ed.selectionStart, end = ed.selectionEnd;
          ed.value = ed.value.slice(0, start) + "  " + ed.value.slice(end);
          ed.selectionStart = ed.selectionEnd = start + 2;
          ed.dispatchEvent(new Event("input"));
        }
      });
    });

    function run() {
      consoleEl.innerHTML = "";
      unread = 0; badge.textContent = ""; badge.style.display = "none";
      // Console bridge: forward log/warn/error/info from the iframe to the parent.
      const bridge = "(()=>{const p=(l,a)=>parent.postMessage({_ce:1,l,a:a.map(x=>{try{return typeof x==='object'?JSON.stringify(x):String(x)}catch(_){return String(x)}})},'*');['log','info','warn','error'].forEach(l=>{const o=console[l];console[l]=function(){p(l,[].slice.call(arguments));o.apply(console,arguments)}});window.addEventListener('error',e=>p('error',[e.message+' (line '+e.lineno+')']));window.addEventListener('unhandledrejection',e=>p('error',['Unhandled: '+(e.reason&&e.reason.message||e.reason)]));})();";
      const srcdoc = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>" + data.css + "</style></head><body>" + data.html + "<script>" + bridge + "</script><script>try{\n" + data.js + "\n}catch(e){console.error(e.message)}</script></body></html>";
      iframe.srcdoc = srcdoc;
      setTab("preview");
    }
    body.querySelector("#ceRun").onclick = () => { run(); if (window.Achievements) window.Achievements.bump("code_slinger", 1); };
    body.querySelector("#ceClear").onclick = () => { consoleEl.innerHTML = '<div class="ce-empty">Console cleared.</div>'; unread = 0; badge.textContent = ""; badge.style.display = "none"; };

    function onMsg(e) {
      if (!e.data || e.data._ce !== 1) return;
      const empty = consoleEl.querySelector(".ce-empty"); if (empty) empty.remove();
      const line = document.createElement("div");
      line.className = "ce-line ce-" + e.data.l;
      line.textContent = "› " + e.data.a.join(" ");
      consoleEl.appendChild(line);
      consoleEl.scrollTop = consoleEl.scrollHeight;
      const consoleTabActive = body.querySelector('.ce-tab[data-t="console"]').classList.contains("active");
      if (!consoleTabActive) { unread++; badge.textContent = unread; badge.style.display = ""; }
    }
    window.addEventListener("message", onMsg);
    body.closest(".win").addEventListener("DOMNodeRemoved", () => window.removeEventListener("message", onMsg));
  };
})();
