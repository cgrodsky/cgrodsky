/* Block Finder: browse and search uploaded raw assets. Two tabs — Textures
   (IMG_* PNGs) and Sounds (SFX_* MP3s). Tap a texture to view it big and copy
   a labeled mapping line; tap a sound to play it, or open it big to loop/copy.
   The copy line lets you paste "SFX_003 = " into chat and tell Claude what
   the sound is for. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const cw = (opts) => window.WM.createWindow(opts);

  // One shared player so only a single sound plays at a time.
  const player = new Audio();
  let playingId = null;
  function stopSound() { try { player.pause(); } catch (_) {} playingId = null; }

  AppRegistry.blockfinder = function () {
    const ref = cw({ title: "Block Finder", icon: Icon.mini("blockfinder", "Blocks"), width: 760, height: 560, appId: "blockfinder" });
    const body = ref.body;
    body.innerHTML = `<div class="bf">
      <div class="bf-tabs">
        <button class="bf-tab active" data-tab="tex">Textures</button>
        <button class="bf-tab" data-tab="sfx">Sounds</button>
      </div>
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
    const tabs = body.querySelectorAll(".bf-tab");
    let tab = "tex";
    let items = [];   // textures
    let sfx = [];     // sounds

    function load() {
      grid.innerHTML = `<div class="muted" style="padding:20px">Loading…</div>`;
      const bust = "?t=" + Date.now();
      Promise.all([
        fetch("assets/raw/manifest.json" + bust).then((r) => r.json()).catch(() => []),
        fetch("assets/raw/sfx_manifest.json" + bust).then((r) => r.json()).catch(() => []),
      ]).then(([tex, sounds]) => {
        items = Array.isArray(tex) ? tex : [];
        sfx = Array.isArray(sounds) ? sounds : [];
        render(search.value.trim());
      });
    }
    load();
    body.querySelector("#reload").onclick = load;

    tabs.forEach((t) => t.onclick = () => {
      tab = t.dataset.tab;
      tabs.forEach((x) => x.classList.toggle("active", x === t));
      search.placeholder = tab === "sfx" ? "Search sounds (e.g. 003)" : "Search by number (e.g. 0451)";
      render(search.value.trim());
    });

    search.addEventListener("input", () => render(search.value.trim()));

    function render(q) {
      grid.innerHTML = "";
      grid.classList.toggle("bf-grid-sfx", tab === "sfx");
      const norm = q.replace(/\D/g, "");
      if (tab === "sfx") return renderSounds(norm);
      const filtered = items.filter((id) => !norm || id.toLowerCase().includes("img_" + norm) || id.includes(norm));
      count.textContent = filtered.length + " of " + items.length;
      if (!filtered.length) { grid.appendChild(el(`<div class="muted" style="padding:20px;grid-column:1/-1">No matches.</div>`)); return; }
      filtered.forEach((id) => {
        const card = el(`<button class="bf-card" title="${id}"><img src="assets/raw/${id}.png" alt=""><span class="bf-lbl">${id.replace("IMG_", "")}</span></button>`);
        card.onclick = () => openBigTexture(id);
        grid.appendChild(card);
      });
    }

    function renderSounds(norm) {
      const filtered = sfx.filter((id) => !norm || id.includes(norm));
      count.textContent = filtered.length + " of " + sfx.length;
      if (!filtered.length) {
        grid.appendChild(el(`<div class="muted" style="padding:20px;grid-column:1/-1">${sfx.length ? "No matches." : "No sounds found (assets/raw/sfx_manifest.json missing)."}</div>`));
        return;
      }
      filtered.forEach((id) => {
        const card = el(`<button class="bf-sfx-card" title="${id}">
          <span class="bf-sfx-play">&#9654;</span>
          <span class="bf-sfx-lbl">${id.replace("SFX_", "SFX ")}</span>
        </button>`);
        const icon = card.querySelector(".bf-sfx-play");
        card.onclick = (e) => {
          if (e.detail === 2) { openBigSound(id); return; }
          toggleSound(id, icon);
        };
        card.ondblclick = () => openBigSound(id);
        grid.appendChild(card);
      });
    }

    function toggleSound(id, iconEl) {
      // reset any previously-shown play icons
      grid.querySelectorAll(".bf-sfx-play").forEach((s) => s.innerHTML = "&#9654;");
      if (playingId === id && !player.paused) { stopSound(); return; }
      stopSound();
      player.src = "assets/raw/" + id + ".mp3?t=" + Date.now();
      playingId = id;
      if (iconEl) iconEl.innerHTML = "&#10073;&#10073;";
      player.onended = () => { if (iconEl) iconEl.innerHTML = "&#9654;"; playingId = null; };
      player.play().catch(() => { if (iconEl) iconEl.innerHTML = "&#9654;"; });
    }

    function copyLine(id, btn, overlay) {
      const txt = id + " = ";
      const done = () => { btn.textContent = "Copied!"; setTimeout(() => overlay.remove(), 500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(done).catch(showManual);
      } else showManual();
      function showManual() {
        btn.textContent = "Copy manually:";
        const ta = document.createElement("textarea");
        ta.value = txt; ta.style.cssText = "width:100%;margin-top:8px;padding:6px"; ta.readOnly = true;
        btn.parentNode.parentNode.appendChild(ta); ta.focus(); ta.select();
      }
    }

    function openBigTexture(id) {
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
      overlay.querySelector("#cp").onclick = (e) => copyLine(id, e.target, overlay);
      document.getElementById("screen").appendChild(overlay);
    }

    function openBigSound(id) {
      stopSound();
      const overlay = el(`<div class="bf-mask">
        <div class="bf-big">
          <div class="bf-big-sfx"><button class="bf-sfx-bigplay">&#9654;</button></div>
          <div class="bf-big-name">${id}</div>
          <p class="muted" style="margin:0 0 12px;font-size:.85rem">Tap to preview. Tell Claude what this sound is for — Copy, paste into chat, and add the purpose.</p>
          <div class="row" style="gap:8px;justify-content:center">
            <button class="pill-btn" id="cp">Copy "${id} = "</button>
            <button class="btn-text" id="cl">Close</button>
          </div>
        </div></div>`);
      const big = overlay.querySelector(".bf-sfx-bigplay");
      big.onclick = () => toggleSound(id, big);
      overlay.querySelector("#cl").onclick = () => { stopSound(); overlay.remove(); };
      overlay.onclick = (e) => { if (e.target === overlay) { stopSound(); overlay.remove(); } };
      overlay.querySelector("#cp").onclick = (e) => copyLine(id, e.target, overlay);
      document.getElementById("screen").appendChild(overlay);
    }

    // Stop audio when the window closes.
    body.closest(".win").addEventListener("DOMNodeRemoved", stopSound);
  };
})();
