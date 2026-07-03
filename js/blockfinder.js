/* Assets: manage every uploaded asset in one place. Textures (IMG_* PNGs) and
   Sounds (SFX_* MP3s) are merged into a single numbered catalog (#1, #2, …) so
   each thing has one number you can point Claude at. Tabs filter by type; tap a
   texture to view it big, tap a sound to play it; the Copy button yields a
   "#5 · SFX_005 = " line to paste into chat and describe what it's for. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const cw = (opts) => window.WM.createWindow(opts);

  // One shared player so only a single sound plays at a time.
  const player = new Audio();
  let playingId = null;
  function stopSound() { try { player.pause(); } catch (_) {} playingId = null; }

  AppRegistry.blockfinder = function () {
    const ref = cw({ title: "Assets", icon: Icon.mini("blockfinder", "Assets"), width: 780, height: 570, appId: "blockfinder" });
    const body = ref.body;
    body.innerHTML = `<div class="bf">
      <div class="bf-tabs">
        <button class="bf-tab active" data-tab="all">All</button>
        <button class="bf-tab" data-tab="tex">Textures</button>
        <button class="bf-tab" data-tab="sfx">Sounds</button>
      </div>
      <div class="bf-bar">
        <input id="q" placeholder="Search by number or name (e.g. 5, 0451, SFX)" autofocus>
        <button id="reload" title="Reload assets" style="background:var(--bg-elev);border:1px solid var(--border);border-radius:6px;padding:8px 12px;cursor:pointer;color:var(--text)">↻ Refresh</button>
        <span id="count" class="muted"></span>
      </div>
      <div id="grid" class="bf-grid"><div class="muted" style="padding:20px">Loading…</div></div>
    </div>`;
    const grid = body.querySelector("#grid");
    const search = body.querySelector("#q");
    const count = body.querySelector("#count");
    const tabs = body.querySelectorAll(".bf-tab");
    let tab = "all";
    let all = [];   // unified, numbered: { num, id, type }

    function load() {
      grid.innerHTML = `<div class="muted" style="padding:20px">Loading…</div>`;
      const bust = "?t=" + Date.now();
      Promise.all([
        fetch("assets/raw/manifest.json" + bust).then((r) => r.json()).catch(() => []),
        fetch("assets/raw/sfx_manifest.json" + bust).then((r) => r.json()).catch(() => []),
      ]).then(([tex, sounds]) => {
        const t = Array.isArray(tex) ? tex : [];
        const s = Array.isArray(sounds) ? sounds : [];
        // One global sequence across every asset: textures first, then sounds.
        all = t.map((id) => ({ id, type: "tex" }))
          .concat(s.map((id) => ({ id, type: "sfx" })))
          .map((a, i) => ({ ...a, num: i + 1 }));
        render(search.value.trim());
      });
    }
    load();
    body.querySelector("#reload").onclick = load;

    tabs.forEach((t) => t.onclick = () => {
      tab = t.dataset.tab;
      tabs.forEach((x) => x.classList.toggle("active", x === t));
      render(search.value.trim());
    });
    search.addEventListener("input", () => render(search.value.trim()));

    function matches(a, q) {
      if (!q) return true;
      const ql = q.toLowerCase();
      if (a.id.toLowerCase().includes(ql)) return true;
      const digits = q.replace(/\D/g, "");
      if (!digits) return false;
      return String(a.num) === digits || a.id.replace(/\D/g, "").includes(digits);
    }

    function render(q) {
      grid.innerHTML = "";
      const scope = all.filter((a) => tab === "all" || a.type === tab);
      grid.classList.toggle("bf-grid-sfx", tab === "sfx");
      const filtered = scope.filter((a) => matches(a, q));
      count.textContent = filtered.length + " of " + scope.length;
      if (!filtered.length) {
        grid.appendChild(el(`<div class="muted" style="padding:20px;grid-column:1/-1">${all.length ? "No matches." : "No assets found (manifests missing)."}</div>`));
        return;
      }
      filtered.forEach((a) => grid.appendChild(a.type === "tex" ? texCard(a) : sfxCard(a)));
    }

    function texCard(a) {
      const card = el(`<button class="bf-card" title="#${a.num} · ${a.id}">
        <img src="assets/raw/${a.id}.png" alt="">
        <span class="bf-num">#${a.num}</span>
        <span class="bf-lbl">${a.id.replace("IMG_", "")}</span>
      </button>`);
      card.onclick = () => openBigTexture(a);
      return card;
    }

    function sfxCard(a) {
      const card = el(`<button class="bf-sfx-card" title="#${a.num} · ${a.id}">
        <span class="bf-sfx-play">&#9654;</span>
        <span class="bf-sfx-info"><span class="bf-num">#${a.num}</span><span class="bf-sfx-lbl">${a.id.replace("SFX_", "SFX ")}</span></span>
      </button>`);
      const icon = card.querySelector(".bf-sfx-play");
      card.onclick = (e) => { if (e.detail === 2) { openBigSound(a); return; } toggleSound(a.id, icon); };
      card.ondblclick = () => openBigSound(a);
      return card;
    }

    function toggleSound(id, iconEl) {
      grid.querySelectorAll(".bf-sfx-play").forEach((s) => s.innerHTML = "&#9654;");
      if (playingId === id && !player.paused) { stopSound(); return; }
      stopSound();
      player.src = "assets/raw/" + id + ".mp3?t=" + Date.now();
      playingId = id;
      if (iconEl) iconEl.innerHTML = "&#10073;&#10073;";
      player.onended = () => { if (iconEl) iconEl.innerHTML = "&#9654;"; playingId = null; };
      player.play().catch(() => { if (iconEl) iconEl.innerHTML = "&#9654;"; });
    }

    function copyLine(a, btn, overlay) {
      const txt = "#" + a.num + " · " + a.id + " = ";
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

    function openBigTexture(a) {
      const overlay = el(`<div class="bf-mask">
        <div class="bf-big">
          <div class="bf-big-img"><img src="assets/raw/${a.id}.png" alt=""></div>
          <div class="bf-big-name">#${a.num} · ${a.id}</div>
          <p class="muted" style="margin:0 0 12px;font-size:.85rem">Tell Claude what this is. Tap Copy, paste into chat, and add the name/purpose.</p>
          <div class="row" style="gap:8px;justify-content:center">
            <button class="pill-btn" id="cp">Copy "#${a.num} · ${a.id} = "</button>
            <button class="btn-text" id="cl">Close</button>
          </div>
        </div></div>`);
      overlay.querySelector("#cl").onclick = () => overlay.remove();
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      overlay.querySelector("#cp").onclick = (e) => copyLine(a, e.target, overlay);
      document.getElementById("screen").appendChild(overlay);
    }

    function openBigSound(a) {
      stopSound();
      const overlay = el(`<div class="bf-mask">
        <div class="bf-big">
          <div class="bf-big-sfx"><button class="bf-sfx-bigplay">&#9654;</button></div>
          <div class="bf-big-name">#${a.num} · ${a.id}</div>
          <p class="muted" style="margin:0 0 12px;font-size:.85rem">Tap to preview. Tell Claude what it's for — Copy, paste into chat, and add the purpose.</p>
          <div class="row" style="gap:8px;justify-content:center">
            <button class="pill-btn" id="cp">Copy "#${a.num} · ${a.id} = "</button>
            <button class="btn-text" id="cl">Close</button>
          </div>
        </div></div>`);
      const big = overlay.querySelector(".bf-sfx-bigplay");
      big.onclick = () => toggleSound(a.id, big);
      overlay.querySelector("#cl").onclick = () => { stopSound(); overlay.remove(); };
      overlay.onclick = (e) => { if (e.target === overlay) { stopSound(); overlay.remove(); } };
      overlay.querySelector("#cp").onclick = (e) => copyLine(a, e.target, overlay);
      document.getElementById("screen").appendChild(overlay);
    }

    // Stop audio when the window closes.
    body.closest(".win").addEventListener("DOMNodeRemoved", stopSound);
  };
})();
