/* Block Finder: browse and search uploaded raw textures by IMG number,
   tap one to view it big, and copy a labeled mapping line to clipboard. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const cw = (opts) => window.WM.createWindow(opts);

  AppRegistry.blockfinder = function () {
    const ref = cw({ title: "Block Finder", icon: Icon.mini("blockfinder", "Blocks"), width: 760, height: 560, appId: "blockfinder" });
    const body = ref.body;
    body.innerHTML = `<div class="bf">
      <div class="bf-bar">
        <input id="q" placeholder="Search by number (e.g. 0451)" autofocus>
        <button id="reload" title="Reload manifest" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:6px;padding:8px 12px;cursor:pointer;color:var(--text)">↻ Refresh</button>
        <span id="count" class="muted"></span>
      </div>
      <div id="grid" class="bf-grid"><div class="muted" style="padding:20px">Loading…</div></div>
    </div>`;
    const grid = body.querySelector("#grid");
    const search = body.querySelector("#q");
    const count = body.querySelector("#count");
    let items = [];

    function loadManifest() {
      grid.innerHTML = `<div class="muted" style="padding:20px">Loading…</div>`;
      // bust cache by appending a timestamp
      fetch("assets/raw/manifest.json?t=" + Date.now())
        .then((r) => r.json())
        .then((list) => { items = list; render(search.value.trim()); })
        .catch(() => { grid.innerHTML = `<div class="muted" style="padding:20px">No raw textures found (assets/raw/manifest.json missing).</div>`; });
    }
    loadManifest();
    body.querySelector("#reload").onclick = loadManifest;

    search.addEventListener("input", () => render(search.value.trim()));

    function render(q) {
      grid.innerHTML = "";
      const norm = q.replace(/\D/g, "");
      const filtered = items.filter((id) => !norm || id.toLowerCase().includes("img_" + norm) || id.includes(norm));
      count.textContent = filtered.length + " of " + items.length;
      if (!filtered.length) {
        grid.appendChild(el(`<div class="muted" style="padding:20px;grid-column:1/-1">No matches.</div>`));
        return;
      }
      filtered.forEach((id) => {
        const card = el(`<button class="bf-card" title="${id}"><img src="assets/raw/${id}.png" alt=""><span class="bf-lbl">${id.replace("IMG_", "")}</span></button>`);
        card.onclick = () => openBig(id);
        grid.appendChild(card);
      });
    }

    function openBig(id) {
      const overlay = el(`<div class="bf-mask">
        <div class="bf-big">
          <div class="bf-big-img"><img src="assets/raw/${id}.png" alt=""></div>
          <div class="bf-big-name">${id}</div>
          <p class="muted" style="margin:0 0 12px;font-size:.85rem">Tell Claude what block this is. Tap Copy, then paste into chat and add the block name.</p>
          <div class="row" style="gap:8px;justify-content:center">
            <button class="pill-btn" id="cp">Copy "${id} = "</button>
            <button class="btn-text" id="cl">Close</button>
          </div>
        </div></div>`);
      overlay.querySelector("#cl").onclick = () => overlay.remove();
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      overlay.querySelector("#cp").onclick = (e) => {
        const txt = id + " = ";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(() => { e.target.textContent = "Copied!"; setTimeout(() => overlay.remove(), 500); }).catch(showManual);
        } else showManual();
        function showManual() {
          e.target.textContent = "Copy manually:";
          const ta = document.createElement("textarea");
          ta.value = txt; ta.style.cssText = "width:100%;margin-top:8px;padding:6px"; ta.readOnly = true;
          e.target.parentNode.parentNode.appendChild(ta); ta.focus(); ta.select();
        }
      };
      document.getElementById("screen").appendChild(overlay);
    }
  };
})();
