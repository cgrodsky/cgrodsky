/* Creative apps, part 2: Media Player (Windows 11 style). Music + video libraries built from the
   real filesystem (Music / Videos / Downloads / Desktop), "Add files" from the device, the
   built-in sample sounds in assets/raw, playlists (persisted in appData.mediaplayer), play
   queue, shuffle / repeat, mini player, keyboard and Media Session (lock screen) controls. */
(function () {
  "use strict";
  const K = window.CrKit; if (!K) return;
  const { el, esc, ico, clamp } = K;

  // The real sound files that ship in assets/raw.
  const SAMPLE_FILES = ["SFX_001.mp3", "SFX_003.mp3", "SFX_005.mp3", "SFX_006.mp3", "SFX_008.mp3", "SFX_009.mp3", "SFX_013.mp3", "SFX_014.mp3", "SFX_015.mp3", "SFX_016.mp3", "SFX_017.mp3", "SFX_018.mp3", "SFX_022.mp3", "SFX_023.mp3", "SFX_024.mp3", "chicken_hit.wav", "chicken_death.wav", "creeper_hit.wav", "creeper_death.wav"];
  const prettyName = (f) => { const b = f.replace(/\.[^.]+$/, ""); const m = b.match(/^SFX_(\d+)$/); if (m) return "Sound effect " + (+m[1]); return b.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); };
  const SAMPLES = SAMPLE_FILES.map((f) => ({ id: "sample:" + f, title: prettyName(f), artist: "Windows 12", album: "Sample sounds", kind: "audio", origin: "sample", url: "assets/raw/" + f, name: f }));
  const VID_EXT = /\.(mp4|webm|mov|m4v|ogv|mkv)$/i;
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

  function data() {
    const S = State.data; S.appData = S.appData || {};
    let d = S.appData.mediaplayer; if (!d || typeof d !== "object") d = S.appData.mediaplayer = {};
    if (!Array.isArray(d.playlists)) d.playlists = [];
    if (!Array.isArray(d.recent)) d.recent = [];
    if (typeof d.volume !== "number") d.volume = 0.8;
    if (!["off", "all", "one"].includes(d.repeat)) d.repeat = "off";
    d.shuffle = !!d.shuffle;
    return d;
  }
  function save() { try { State.save(); } catch (e) {} }

  const session = []; let sid = 0;           // device files kept for this session only
  const durations = new Map();               // id -> seconds
  const thumbs = new Map();                  // id -> data URL (video frames)
  function library() {
    const out = [], seen = new Set();
    [["Music"], ["Videos"], ["Downloads"], ["Desktop"]].forEach((dir) => K.walk(dir, (n, name, path) => {
      const mk = K.mediaKind(name, n); if (!mk) return;
      const id = "vfs:" + path.join("/"); if (seen.has(id)) return; seen.add(id);
      out.push({ id, title: name.replace(/\.[^.]+$/, ""), artist: n.artist || "Unknown artist", album: n.album || path.slice(0, -1).join(" › "), kind: mk, origin: "vfs", node: n, path, name, size: n.size || 0, ts: n.ts || 0 });
    }));
    return out.concat(session, SAMPLES);
  }
  function byId(id, lib) { return (lib || library()).find((t) => t.id === id) || null; }
  function trackURL(t) { return t.url ? Promise.resolve(t.url) : K.nodeURL(t.node); }
  const art = (t, size) => thumbs.get(t.id) || K.artFor(t.album + "|" + (t.origin === "sample" ? "s" : t.title), t.kind, size || 128);

  // probe durations lazily (one at a time)
  const probeQ = []; let probing = false;
  function probe(t, cb) {
    if (durations.has(t.id)) return cb && cb();
    probeQ.push([t, cb]); if (!probing) runProbe();
  }
  function runProbe() {
    const job = probeQ.shift(); if (!job) { probing = false; return; } probing = true;
    const [t, cb] = job;
    if (durations.has(t.id)) { cb && cb(); return runProbe(); }
    trackURL(t).then((u) => {
      if (!u) { runProbe(); return; }
      const m = document.createElement(t.kind === "video" ? "video" : "audio"); m.preload = "metadata"; m.muted = true;
      let done = false; const fin = () => { if (done) return; done = true; if (isFinite(m.duration)) durations.set(t.id, m.duration); m.removeAttribute("src"); try { m.load(); } catch (e) {} cb && cb(); setTimeout(runProbe, 0); };
      m.onloadedmetadata = () => {
        if (t.kind === "video" && !thumbs.has(t.id)) {
          m.onseeked = () => { try { const c = K.mkCanvas(240, 135), g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 240, 135); const k = Math.min(240 / m.videoWidth, 135 / m.videoHeight); g.drawImage(m, (240 - m.videoWidth * k) / 2, (135 - m.videoHeight * k) / 2, m.videoWidth * k, m.videoHeight * k); thumbs.set(t.id, c.toDataURL("image/jpeg", 0.7)); } catch (e) {} fin(); };
          try { m.currentTime = Math.min(1, (m.duration || 2) / 3); } catch (e) { fin(); }
          setTimeout(fin, 2500);
        } else fin();
      };
      m.onerror = fin; setTimeout(fin, 6000);
      m.src = u;
    }).catch(() => runProbe());
  }

  let inst = null;
  window.CrMedia = {
    openNode(name, node) {
      const path = findPath(node);
      const t = path ? { id: "vfs:" + path.join("/"), title: name.replace(/\.[^.]+$/, ""), artist: "Unknown artist", album: path.slice(0, -1).join(" › "), kind: K.mediaKind(name, node), origin: "vfs", node, path, name }
        : { id: "tmp:" + name, title: name.replace(/\.[^.]+$/, ""), artist: "", album: "", kind: K.mediaKind(name, node), origin: "vfs", node, name };
      const api = open(); api.playList([t], 0);
    },
    get api() { return inst && inst.api; },
  };
  function findPath(node) { let found = null; ["Music", "Videos", "Downloads", "Desktop", "Documents", "Pictures"].some((d) => { K.walk([d], (n, name, p) => { if (n === node) found = p; }); return found; }); return found; }

  function open() {
    if (inst && inst.winEl.isConnected) { inst.focus(); return inst.api; }
    build(); return inst.api;
  }
  AppRegistry.mediaplayer = function () { open(); };

  function build() {
    const d = data();
    const wref = WM.createWindow({ title: "Media Player", icon: Icon.mini("mediaplayer", "Media Player"), width: Math.min(980, innerWidth - 24), height: Math.min(660, innerHeight - 110), appId: "mediaplayer" });
    const body = wref.body, winEl = body.closest(".win");
    body.innerHTML = `<div class="cr-app cr-mp">
      <aside class="cr-mp-nav">
        <label class="cr-mp-search">${ico("search", 16)}<input placeholder="Search" aria-label="Search your library"></label>
        <button class="cr-mp-nv" data-v="home">${ico("home")}<span>Home</span></button>
        <button class="cr-mp-nv" data-v="music">${ico("music")}<span>Music library</span></button>
        <button class="cr-mp-nv" data-v="video">${ico("video")}<span>Video library</span></button>
        <button class="cr-mp-nv" data-v="queue">${ico("queue")}<span>Play queue</span></button>
        <div class="cr-mp-navh"><span>Playlists</span><button class="cr-ib cr-mp-newpl" title="New playlist">${ico("plus", 16)}</button></div>
        <div class="cr-mp-pls"></div>
      </aside>
      <main class="cr-mp-main"><div class="cr-mp-view"></div>
        <div class="cr-mp-vstage" hidden><video class="cr-mp-video" playsinline preload="metadata"></video><div class="cr-mp-vtitle"></div></div>
      </main>
      <footer class="cr-mp-bar">
        <button class="cr-mp-now" title="Now playing"><img class="cr-mp-art" alt=""><span class="cr-mp-meta"><b class="cr-mp-t">Nothing playing</b><span class="cr-mp-a">Pick something from your library</span></span></button>
        <div class="cr-mp-ctl">
          <div class="cr-mp-btns">
            <button class="cr-ib" data-c="shuffle" title="Shuffle">${ico("shuffle")}</button>
            <button class="cr-ib" data-c="prev" title="Previous">${ico("prev")}</button>
            <button class="cr-mp-play" data-c="play" title="Play (Space)">${ico("play", 20)}</button>
            <button class="cr-ib" data-c="next" title="Next">${ico("next")}</button>
            <button class="cr-ib" data-c="repeat" title="Repeat">${ico("repeat")}</button>
          </div>
          <div class="cr-mp-seek"><span class="cr-mp-cur">0:00</span><input type="range" class="cr-mp-pos" min="0" max="1000" value="0" aria-label="Seek"><span class="cr-mp-dur">0:00</span></div>
        </div>
        <div class="cr-mp-right">
          <button class="cr-ib" data-c="mute" title="Mute">${ico("volume")}</button><input type="range" class="cr-mp-vol" min="0" max="100" aria-label="Volume">
          <button class="cr-ib" data-c="mini" title="Mini player">${ico("mini")}</button>
          <button class="cr-ib" data-c="full" title="Full screen">${ico("fullscreen")}</button>
        </div>
      </footer>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const root = $(".cr-mp"), viewEl = $(".cr-mp-view"), vstage = $(".cr-mp-vstage");
    const audio = new Audio(); audio.preload = "auto";
    const video = $(".cr-mp-video");
    [audio, video].forEach((m) => { m.volume = d.volume; });

    // ---------- player state ----------
    let queue = [], order = [], pos = -1, cur = null, view = "home", viewArg = null, seeking = false, miniPrev = null, query = "";
    const media = () => (cur && cur.kind === "video" ? video : audio);
    function buildOrder(keepCurrent) {
      const idx = queue.map((_, i) => i), curIdx = pos >= 0 ? order[pos] : -1;
      if (d.shuffle) {
        for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
        if (keepCurrent && curIdx >= 0) { idx.splice(idx.indexOf(curIdx), 1); idx.unshift(curIdx); pos = 0; }
      } else if (keepCurrent && curIdx >= 0) pos = curIdx;
      order = idx;
    }
    function playList(list, start, shuffle) {
      if (!list.length) return;
      queue = list.slice(); if (shuffle != null) { d.shuffle = !!shuffle; save(); }
      pos = -1; buildOrder(false);
      if (d.shuffle) { const si = start || 0; if (shuffle) pos = 0; else { order.splice(order.indexOf(si), 1); order.unshift(si); pos = 0; } }
      else pos = start || 0;
      playCur();
    }
    async function playCur() {
      const t = queue[order[pos]]; if (!t) return;
      const other = t.kind === "video" ? audio : video; try { other.pause(); } catch (e) {}
      cur = t;
      const url = await trackURL(t);
      if (cur !== t) return;
      if (!url) { K.notify("Media Player", "“" + t.title + "” isn't available on this device."); return; }
      const m = media();
      if (m.src !== url && m.getAttribute("src") !== url) m.src = url;
      try { m.currentTime = 0; } catch (e) {}
      m.volume = d.volume; m.muted = !!d.muted;
      const p = m.play(); if (p && p.catch) p.catch(() => {});
      d.recent = [t.id].concat(d.recent.filter((x) => x !== t.id)).slice(0, 12); save();
      if (t.kind === "video") showVideo(true); else if (!vstage.hidden) showVideo(false);
      updateBar(); session_(); if (view === "queue" || view === "pl" || view === "music") renderView();
    }
    function next(auto) {
      if (!queue.length) return;
      if (auto && d.repeat === "one") { const m = media(); m.currentTime = 0; m.play().catch(() => {}); return; }
      if (pos < order.length - 1) { pos++; playCur(); return; }
      if (d.repeat === "all") { if (d.shuffle) buildOrder(false); pos = 0; playCur(); return; }
      if (auto) { media().pause(); updateBar(); return; }   // reached the end of the queue
      pos = 0; playCur();                                     // "Next" on the last item wraps around
    }
    function prev() {
      const m = media(); if (m.currentTime > 3 || pos <= 0) { m.currentTime = 0; return; }
      pos--; playCur();
    }
    function toggle() {
      if (!cur) { const lib = library().filter((t) => t.kind === "audio"); playList(lib, 0); return; }
      const m = media(); if (m.paused) m.play().catch(() => {}); else m.pause();
    }
    function enqueue(t, nextUp) {
      if (!queue.length) { playList([t], 0); return; }
      queue.push(t); const qi = queue.length - 1;
      if (nextUp) order.splice(pos + 1, 0, qi); else order.push(qi);
      K.notify("Media Player", (nextUp ? "Playing next: " : "Added to queue: ") + t.title);
      if (view === "queue") renderView();
    }

    // ---------- now-playing bar ----------
    function updateBar() {
      const m = media(), t = cur;
      $(".cr-mp-t").textContent = t ? t.title : "Nothing playing";
      $(".cr-mp-a").textContent = t ? (t.artist || "") + (t.album ? " — " + t.album : "") : "Pick something from your library";
      $(".cr-mp-art").src = t ? art(t, 96) : K.artFor("idle", "audio", 96);
      const playing = t && !m.paused;
      $('[data-c="play"]').innerHTML = ico(playing ? "pause" : "play", 20); $('[data-c="play"]').title = playing ? "Pause (Space)" : "Play (Space)";
      $('[data-c="shuffle"]').classList.toggle("on", d.shuffle);
      const rb = $('[data-c="repeat"]'); rb.classList.toggle("on", d.repeat !== "off"); rb.innerHTML = ico(d.repeat === "one" ? "repeat1" : "repeat"); rb.title = { off: "Repeat: off", all: "Repeat: all", one: "Repeat: one" }[d.repeat];
      $('[data-c="mute"]').innerHTML = ico(d.muted || d.volume === 0 ? "mute" : "volume");
      $(".cr-mp-vol").value = Math.round(d.volume * 100);
      $('[data-c="full"]').hidden = !(t && t.kind === "video");
      root.classList.toggle("cr-playing", !!playing);
      tick();
      if ("mediaSession" in navigator) try { navigator.mediaSession.playbackState = t ? (playing ? "playing" : "paused") : "none"; } catch (e) {}
      if (root.classList.contains("cr-mp-mini")) renderMini();
    }
    let lastPS = 0;
    function tick() {
      const m = media(), dur = isFinite(m.duration) ? m.duration : (cur && durations.get(cur.id)) || 0;
      $(".cr-mp-cur").textContent = K.fmtTime(m.currentTime); $(".cr-mp-dur").textContent = K.fmtTime(dur);
      if (!seeking) $(".cr-mp-pos").value = dur ? Math.round(m.currentTime / dur * 1000) : 0;
      $(".cr-mp-pos").style.setProperty("--p", (dur ? m.currentTime / dur * 100 : 0) + "%");
      if (cur && dur && "mediaSession" in navigator && navigator.mediaSession.setPositionState && Date.now() - lastPS > 1000) {
        lastPS = Date.now(); try { navigator.mediaSession.setPositionState({ duration: dur, playbackRate: m.playbackRate || 1, position: Math.min(m.currentTime, dur) }); } catch (e) {}
      }
    }
    [audio, video].forEach((m) => {
      m.addEventListener("timeupdate", () => { if (m === media()) tick(); });
      m.addEventListener("play", () => { if (m === media()) updateBar(); });
      m.addEventListener("pause", () => { if (m === media()) updateBar(); });
      m.addEventListener("loadedmetadata", () => { if (cur && m === media() && isFinite(m.duration)) durations.set(cur.id, m.duration); tick(); });
      m.addEventListener("ended", () => { if (m === media()) next(true); });
      m.addEventListener("error", () => { if (m === media() && cur && m.getAttribute("src")) K.notify("Media Player", "Can't play “" + cur.title + "”. The file may be damaged or in a format this browser doesn't support."); });
    });
    const posIn = $(".cr-mp-pos");
    posIn.addEventListener("input", () => { seeking = true; const m = media(), dur = m.duration || 0; $(".cr-mp-cur").textContent = K.fmtTime(posIn.value / 1000 * dur); posIn.style.setProperty("--p", posIn.value / 10 + "%"); });
    posIn.addEventListener("change", () => { const m = media(); if (isFinite(m.duration)) m.currentTime = posIn.value / 1000 * m.duration; seeking = false; });
    $(".cr-mp-vol").addEventListener("input", (e) => { d.volume = +e.target.value / 100; d.muted = false; audio.volume = video.volume = d.volume; audio.muted = video.muted = false; updateBar(); });
    $(".cr-mp-vol").addEventListener("change", save);
    body.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => ctl(b.dataset.c)));
    function ctl(c) {
      if (c === "play") toggle();
      else if (c === "next") next(false);
      else if (c === "prev") prev();
      else if (c === "shuffle") { d.shuffle = !d.shuffle; save(); if (queue.length) buildOrder(true); updateBar(); if (view === "queue") renderView(); }
      else if (c === "repeat") { d.repeat = { off: "all", all: "one", one: "off" }[d.repeat]; save(); updateBar(); }
      else if (c === "mute") { d.muted = !d.muted; audio.muted = video.muted = d.muted; save(); updateBar(); }
      else if (c === "mini") toggleMini();
      else if (c === "full") fullscreen();
    }
    $(".cr-mp-now").onclick = () => { if (!cur) return; if (root.classList.contains("cr-mp-mini")) toggleMini(); if (cur.kind === "video") showVideo(true); else go("now"); };

    // ---------- video stage ----------
    function showVideo(on) {
      vstage.hidden = !on; viewEl.hidden = !!on;
      if (on && cur) $(".cr-mp-vtitle").textContent = cur.title;
      body.querySelectorAll(".cr-mp-nv").forEach((n) => n.classList.toggle("on", !on && n.dataset.v === view));
    }
    video.addEventListener("click", () => toggle());
    video.addEventListener("dblclick", fullscreen);
    function fullscreen() {
      const elx = vstage;
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
        if (cur && cur.kind === "video") showVideo(true);
        if (elx.requestFullscreen) elx.requestFullscreen().catch(() => { if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); });
        else if (elx.webkitRequestFullscreen) elx.webkitRequestFullscreen();
        else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      } catch (e) {}
    }

    // ---------- mini player ----------
    function toggleMini() {
      const on = !root.classList.contains("cr-mp-mini");
      root.classList.toggle("cr-mp-mini", on);
      if (on) { miniPrev = { w: winEl.style.width, h: winEl.style.height }; winEl.style.width = "360px"; winEl.style.height = "250px"; renderMini(); }
      else if (miniPrev) { winEl.style.width = miniPrev.w; winEl.style.height = miniPrev.h; }
      $('[data-c="mini"]').innerHTML = ico(on ? "expand" : "mini"); $('[data-c="mini"]').title = on ? "Back to full player" : "Mini player";
    }
    function renderMini() { root.style.setProperty("--cr-mp-bgart", cur ? `url("${art(cur, 256)}")` : "none"); }

    // ---------- Media Session (iPad lock screen, headphones, keyboard media keys) ----------
    function session_() {
      if (!("mediaSession" in navigator) || !cur) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: cur.title, artist: cur.artist || "", album: cur.album || "Media Player", artwork: [{ src: K.artFor(cur.album + "|" + (cur.origin === "sample" ? "s" : cur.title), cur.kind, 512), sizes: "512x512", type: "image/png" }] });
      } catch (e) {}
    }
    const MS_ACTIONS = {
      play: () => { if (cur) media().play().catch(() => {}); else toggle(); }, pause: () => media().pause(), stop: () => { media().pause(); try { media().currentTime = 0; } catch (e) {} },
      previoustrack: prev, nexttrack: () => next(false),
      seekbackward: (a) => { media().currentTime = Math.max(0, media().currentTime - ((a && a.seekOffset) || 10)); },
      seekforward: (a) => { media().currentTime = Math.min(media().duration || 0, media().currentTime + ((a && a.seekOffset) || 10)); },
      seekto: (a) => { if (a && a.seekTime != null) media().currentTime = a.seekTime; },
    };
    function setMS(on) { if (!("mediaSession" in navigator)) return; Object.keys(MS_ACTIONS).forEach((k) => { try { navigator.mediaSession.setActionHandler(k, on ? MS_ACTIONS[k] : null); } catch (e) {} }); }
    setMS(true);

    // ---------- keyboard ----------
    const onKey = (e) => {
      if (!K.isTop(winEl) || K.typingTarget(e.target) || e.target.closest && e.target.closest(".cr-dlg-mask")) return;
      const m = media();
      if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (e.ctrlKey || e.metaKey) next(false); else if (cur) m.currentTime = Math.min(m.duration || 0, m.currentTime + 5); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (e.ctrlKey || e.metaKey) prev(); else if (cur) m.currentTime = Math.max(0, m.currentTime - 5); }
      else if (e.key === "ArrowUp") { e.preventDefault(); d.volume = clamp(d.volume + 0.1, 0, 1); audio.volume = video.volume = d.volume; updateBar(); save(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); d.volume = clamp(d.volume - 0.1, 0, 1); audio.volume = video.volume = d.volume; updateBar(); save(); }
      else if (e.key === "m") ctl("mute");
      else if (e.key === "f" && cur && cur.kind === "video") fullscreen();
    };
    window.addEventListener("keydown", onKey);
    const onVfs = () => { if (["music", "video", "home"].includes(view)) renderView(); renderPls(); };
    window.addEventListener("vfs-change", onVfs);
    winEl.addEventListener("wm-cleanup", () => {
      window.removeEventListener("keydown", onKey); window.removeEventListener("vfs-change", onVfs);
      [audio, video].forEach((m) => { try { m.pause(); m.removeAttribute("src"); m.load(); } catch (e) {} });
      setMS(false); try { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = "none"; } catch (e) {}
      K.closePop(); if (inst && inst.winEl === winEl) inst = null;
    });

    // ---------- navigation + views ----------
    function go(v, arg) { view = v; viewArg = arg || null; showVideo(false); renderView(); renderPls(); }
    body.querySelectorAll(".cr-mp-nv").forEach((b) => (b.onclick = () => go(b.dataset.v)));
    $(".cr-mp-search input").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); if (query) go("search"); else go("music"); });
    $(".cr-mp-newpl").onclick = () => newPlaylist();
    function renderPls() {
      const box = $(".cr-mp-pls"); box.innerHTML = "";
      const sb = el(`<button class="cr-mp-nv${view === "samples" ? " on" : ""}"><img class="cr-mp-plart" src="${K.artFor("Sample sounds|s", "audio", 64)}" alt=""><span>Sample sounds</span></button>`);
      sb.onclick = () => go("samples"); box.appendChild(sb);
      d.playlists.forEach((p) => {
        const b = el(`<button class="cr-mp-nv${view === "pl" && viewArg === p.id ? " on" : ""}"><img class="cr-mp-plart" src="${K.artFor("pl" + p.id, "audio", 64)}" alt=""><span>${esc(p.name)}</span></button>`);
        b.onclick = () => go("pl", p.id); box.appendChild(b);
      });
    }
    function header(title, sub, buttons) {
      const h = el(`<div class="cr-mp-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="cr-dim">${esc(sub)}</p>` : ""}</div><div class="cr-row cr-mp-hbtns"></div></div>`);
      buttons.forEach((b) => { if (!b) return; const x = el(`<button class="cr-btn${b.primary ? " cr-primary" : ""}">${b.icon ? ico(b.icon, 16) : ""}<span>${esc(b.label)}</span></button>`); x.onclick = b.onClick; h.querySelector(".cr-mp-hbtns").appendChild(x); });
      return h;
    }
    function trackRow(t, list, i, opts) {
      opts = opts || {};
      const playing = cur && cur.id === t.id;
      const r = el(`<div class="cr-mp-row${playing ? " on" : ""}${t.missing ? " cr-missing" : ""}" data-id="${esc(t.id)}">
        ${opts.drag ? `<span class="cr-mp-grip" title="Drag to reorder">${ico("grip", 16)}</span>` : ""}
        <img class="cr-mp-rart" src="${art(t, 64)}" alt="">
        <button class="cr-mp-rplay" title="Play">${ico(playing && !media().paused ? "pause" : "play", 14)}</button>
        <span class="cr-mp-rt">${esc(t.title)}${t.origin === "session" ? ' <em class="cr-tag">this session</em>' : ""}</span>
        <span class="cr-mp-ra">${esc(t.artist || "")}</span><span class="cr-mp-ral">${esc(t.album || "")}</span>
        <span class="cr-mp-rk">${t.kind === "video" ? ico("video", 14) : ""}</span>
        <span class="cr-mp-rd">${durations.has(t.id) ? K.fmtTime(durations.get(t.id)) : ""}</span>
        <button class="cr-ib cr-mp-rmore" title="More options">${ico("more", 16)}</button></div>`);
      const play = () => { if (t.missing) return; if (playing) toggle(); else playList(list.filter((x) => !x.missing), list.filter((x) => !x.missing).indexOf(t)); };
      r.querySelector(".cr-mp-rplay").onclick = (e) => { e.stopPropagation(); play(); };
      r.ondblclick = play;
      r.addEventListener("click", (e) => { if (e.target.closest("button,.cr-mp-grip")) return; if (e.pointerType === "touch" || matchMedia("(pointer: coarse)").matches) play(); else { r.parentNode.querySelectorAll(".cr-mp-row.sel").forEach((x) => x.classList.remove("sel")); r.classList.add("sel"); } });
      r.querySelector(".cr-mp-rmore").onclick = (e) => { e.stopPropagation(); rowMenu(e.currentTarget, t, list, i, opts); };
      r.addEventListener("contextmenu", (e) => { e.preventDefault(); rowMenu(r.querySelector(".cr-mp-rmore"), t, list, i, opts); });
      if (!durations.has(t.id) && !t.missing) probe(t, () => { const dd = r.querySelector(".cr-mp-rd"); if (dd && durations.has(t.id)) dd.textContent = K.fmtTime(durations.get(t.id)); });
      return r;
    }
    function rowMenu(anchor, t, list, i, opts) {
      const items = [
        { label: "Play", icon: "play", onClick: () => playList([t], 0) },
        { label: "Play next", icon: "queue", onClick: () => enqueue(t, true) },
        { label: "Add to play queue", icon: "plus", onClick: () => enqueue(t, false) },
        { sep: true },
      ];
      d.playlists.forEach((p) => { if (!(opts.pl && opts.pl.id === p.id)) items.push({ label: "Add to “" + p.name + "”", icon: "list", onClick: () => addToPl(p, [t]) }); });
      items.push({ label: "New playlist with this…", icon: "plus", onClick: () => newPlaylist([t]) });
      if (opts.pl) {
        items.push({ sep: true });
        items.push({ label: "Move up", icon: "up", disabled: i === 0, onClick: () => movePl(opts.pl, i, i - 1) });
        items.push({ label: "Move down", icon: "down", disabled: i >= opts.pl.tracks.length - 1, onClick: () => movePl(opts.pl, i, i + 1) });
        items.push({ label: "Remove from playlist", icon: "trash", onClick: () => { opts.pl.tracks.splice(i, 1); save(); renderView(); } });
      }
      if (opts.queue && i !== pos) items.push({ label: "Remove from queue", icon: "trash", onClick: () => { order.splice(i, 1); if (i < pos) pos--; renderView(); } });
      K.menu(anchor, items);
    }
    function addToPl(p, ts) { ts.forEach((t) => p.tracks.push(t.id)); save(); K.notify("Media Player", "Added " + (ts.length === 1 ? "“" + ts[0].title + "”" : ts.length + " items") + " to " + p.name + "."); if (view === "pl" && viewArg === p.id) renderView(); }
    function movePl(p, from, to) { if (to < 0 || to >= p.tracks.length) return; const [x] = p.tracks.splice(from, 1); p.tracks.splice(to, 0, x); save(); renderView(); }
    async function newPlaylist(ts) {
      const name = await K.promptText(root, "New playlist", "Playlist name", "Playlist " + (d.playlists.length + 1), "Create"); if (!name) return;
      const p = { id: "pl" + Date.now().toString(36), name, tracks: (ts || []).map((t) => t.id), created: Date.now() };
      d.playlists.push(p); save(); go("pl", p.id);
    }
    function list(items, opts) {
      const box = el(`<div class="cr-mp-list"></div>`);
      if (!items.length) box.appendChild(el(`<div class="cr-mp-empty">${opts && opts.empty || "Nothing here yet."}</div>`));
      items.forEach((t, i) => box.appendChild(trackRow(t, items, i, opts)));
      if (opts && opts.drag) enableDrag(box, opts.pl);
      return box;
    }
    // drag-to-reorder with a grip (pointer events: mouse, touch, pen)
    function enableDrag(box, p) {
      box.querySelectorAll(".cr-mp-grip").forEach((g, from) => {
        g.style.touchAction = "none";
        g.addEventListener("pointerdown", (e) => {
          e.preventDefault(); try { g.setPointerCapture(e.pointerId); } catch (_) {}
          const rows = [...box.querySelectorAll(".cr-mp-row")], row = rows[from]; row.classList.add("cr-dragging");
          let to = from;
          const mv = (ev) => {
            to = rows.length; for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { to = i; break; } }
            rows.forEach((r) => r.classList.remove("cr-drop-before", "cr-drop-after"));
            if (to < rows.length) rows[to].classList.add("cr-drop-before"); else rows[rows.length - 1].classList.add("cr-drop-after");
          };
          const up = () => {
            g.removeEventListener("pointermove", mv); g.removeEventListener("pointerup", up); g.removeEventListener("pointercancel", up);
            rows.forEach((r) => r.classList.remove("cr-drop-before", "cr-drop-after", "cr-dragging"));
            const dest = to > from ? to - 1 : to; if (dest !== from) movePl(p, from, dest);
          };
          g.addEventListener("pointermove", mv); g.addEventListener("pointerup", up); g.addEventListener("pointercancel", up);
        });
      });
    }
    async function addFiles() {
      const files = await K.pickDevice("audio/*,video/*,.mp3,.m4a,.wav,.ogg,.aac,.flac,.mp4,.webm,.mov,.m4v", true);
      if (!files.length) return;
      let saved = 0, kept = 0, quota = false; const added = [];
      for (const f of files) {
        const kind = /^video\//.test(f.type) || VID_EXT.test(f.name) ? "video" : "audio";
        try { const r = await K.saveMedia([kind === "video" ? "Videos" : "Music"], f.name, f, kind); saved++; added.push("vfs:" + r.path.join("/")); }
        catch (e) {
          if (e.quota) quota = true;
          const t = { id: "session:" + (++sid), title: f.name.replace(/\.[^.]+$/, ""), artist: "Added from device", album: "This session", kind, origin: "session", url: URL.createObjectURL(f), name: f.name, size: f.size };
          session.push(t); kept++; added.push(t.id);
        }
      }
      const msg = [saved ? `${saved} saved to your ${saved === 1 ? "library" : "libraries"} (Music / Videos)` : "", kept ? `${kept} playable this session only (${quota ? "storage is full" : "bigger than " + K.fmtSize(K.MEDIA_IDB_CAP)})` : ""].filter(Boolean).join("; ");
      K.notify("Media Player", "Added " + files.length + " file" + (files.length === 1 ? "" : "s") + ": " + msg + ".", "mediaplayer");
      go(added.length && added.every((id) => (byId(id) || {}).kind === "video") ? "video" : "music");
    }
    function filterQ(items) { if (!query) return items; return items.filter((t) => (t.title + " " + t.artist + " " + t.album).toLowerCase().includes(query)); }
    function videoGrid(items) {
      const g = el(`<div class="cr-mp-vgrid"></div>`);
      if (!items.length) g.appendChild(el(`<div class="cr-mp-empty">No videos yet. Use <b>Add files</b> to pick videos from this device, or save some into the Videos folder.</div>`));
      items.forEach((t, i) => {
        const c = el(`<button class="cr-mp-vtile"><span class="cr-mp-vth"><img src="${art(t, 240)}" alt=""><i>${ico("play", 22)}</i><em>${durations.has(t.id) ? K.fmtTime(durations.get(t.id)) : ""}</em></span><span class="cr-mp-vnm">${esc(t.title)}</span><span class="cr-dim">${t.size ? K.fmtSize(t.size) : esc(t.album)}</span></button>`);
        c.onclick = () => playList(items, i);
        c.oncontextmenu = (e) => { e.preventDefault(); rowMenu(c, t, items, i, {}); };
        g.appendChild(c);
        if (!durations.has(t.id)) probe(t, () => { const im = c.querySelector("img"); if (im && thumbs.has(t.id)) im.src = thumbs.get(t.id); const em = c.querySelector("em"); if (em && durations.has(t.id)) em.textContent = K.fmtTime(durations.get(t.id)); });
      });
      return g;
    }
    function renderView() {
      const lib = library(); viewEl.innerHTML = ""; viewEl.scrollTop = 0;
      body.querySelectorAll(".cr-mp-nv[data-v]").forEach((n) => n.classList.toggle("on", n.dataset.v === view));
      const music = lib.filter((t) => t.kind === "audio"), vids = lib.filter((t) => t.kind === "video");
      if (view === "home") {
        viewEl.appendChild(header("Home", "", [{ label: "Add files", icon: "plus", primary: true, onClick: addFiles }]));
        const rec = d.recent.map((id) => byId(id, lib)).filter(Boolean);
        const cards = el(`<div class="cr-mp-cards"></div>`);
        [["Music library", plural(music.length, "song"), "music", () => go("music")], ["Video library", plural(vids.length, "video"), "video", () => go("video")], ["Sample sounds", plural(SAMPLES.length, "sound"), "audio", () => go("samples")]].forEach(([n, s, k, fn]) => {
          const c = el(`<button class="cr-mp-card"><img src="${K.artFor(n + (n === "Sample sounds" ? "|s" : ""), k === "video" ? "video" : "audio", 160)}" alt=""><b>${n}</b><span class="cr-dim">${s}</span></button>`); c.onclick = fn; cards.appendChild(c);
        });
        viewEl.appendChild(cards);
        viewEl.appendChild(el(`<h2 class="cr-mp-h2">Recent media</h2>`));
        viewEl.appendChild(list(rec, { empty: "Things you play show up here. Try the <b>Sample sounds</b> playlist, or add your own music and videos." }));
      } else if (view === "music") {
        viewEl.appendChild(header("Music", plural(music.length, "song"), [{ label: "Add files", icon: "plus", onClick: addFiles }, music.length && { label: "Shuffle and play", icon: "shuffle", primary: true, onClick: () => playList(music, 0, true) }]));
        viewEl.appendChild(list(music, { empty: "No music yet." }));
      } else if (view === "video") {
        viewEl.appendChild(header("Videos", plural(vids.length, "video"), [{ label: "Add files", icon: "plus", primary: true, onClick: addFiles }]));
        viewEl.appendChild(videoGrid(vids));
      } else if (view === "queue") {
        const items = order.map((i) => queue[i]).filter(Boolean);
        viewEl.appendChild(header("Play queue", items.length ? items.length + " items" : "", [items.length && { label: "Clear", icon: "trash", onClick: () => { queue = []; order = []; pos = -1; renderView(); } }, items.length && { label: "Save as playlist", icon: "list", onClick: () => newPlaylist(items) }]));
        const box = list(items, { queue: true, empty: "The queue is empty. Play a song or choose “Add to play queue”." });
        box.querySelectorAll(".cr-mp-row").forEach((r, i) => { r.classList.toggle("on", i === pos); r.querySelector(".cr-mp-rplay").onclick = (e) => { e.stopPropagation(); pos = i; playCur(); }; r.ondblclick = () => { pos = i; playCur(); }; });
        viewEl.appendChild(box);
      } else if (view === "samples") {
        viewEl.appendChild(header("Sample sounds", SAMPLES.length + " sounds · built in", [{ label: "Play all", icon: "play", primary: true, onClick: () => playList(SAMPLES, 0, false) }, { label: "Shuffle", icon: "shuffle", onClick: () => playList(SAMPLES, 0, true) }]));
        viewEl.appendChild(list(SAMPLES, {}));
      } else if (view === "pl") {
        const p = d.playlists.find((x) => x.id === viewArg); if (!p) return go("home");
        const items = p.tracks.map((id) => byId(id, lib) || { id, title: "Missing file", artist: "", album: id.replace(/^vfs:/, ""), kind: "audio", missing: true });
        const live = items.filter((t) => !t.missing);
        const h = header(p.name, items.length + " item" + (items.length === 1 ? "" : "s"), [live.length && { label: "Play all", icon: "play", primary: true, onClick: () => playList(live, 0, false) }, live.length && { label: "Shuffle", icon: "shuffle", onClick: () => playList(live, 0, true) },
          { label: "Add songs", icon: "plus", onClick: () => pickForPl(p) }, { label: "Rename", icon: "edit", onClick: async () => { const n = await K.promptText(root, "Rename playlist", "Playlist name", p.name, "Rename"); if (n) { p.name = n; save(); renderView(); renderPls(); } } },
          { label: "Delete", icon: "trash", onClick: async () => { if (await K.confirmBox(root, "Delete playlist?", "“" + p.name + "” will be deleted. The songs stay in your library.", "Delete")) { d.playlists = d.playlists.filter((x) => x !== p); save(); go("home"); } } }]);
        h.insertBefore(el(`<img class="cr-mp-plbig" src="${K.artFor("pl" + p.id, "audio", 160)}" alt="">`), h.firstChild);
        viewEl.appendChild(h);
        viewEl.appendChild(list(items, { drag: true, pl: p, empty: "This playlist is empty. Use <b>Add songs</b>, or “Add to playlist” from any song's ⋯ menu." }));
      } else if (view === "search") {
        const res = filterQ(lib);
        viewEl.appendChild(header("Results for “" + query + "”", res.length + " found", []));
        viewEl.appendChild(list(res, { empty: "No matches." }));
      } else if (view === "now") {
        const t = cur; if (!t) return go("home");
        const n = el(`<div class="cr-mp-nowv" style="--cr-mp-bgart:url('${art(t, 256)}')"><img src="${art(t, 256)}" alt=""><h1>${esc(t.title)}</h1><p class="cr-dim">${esc((t.artist || "") + (t.album ? " — " + t.album : ""))}</p></div>`);
        viewEl.appendChild(n);
        const items = order.map((i) => queue[i]).filter(Boolean);
        if (items.length > 1) { viewEl.appendChild(el(`<h2 class="cr-mp-h2">Up next</h2>`)); viewEl.appendChild(list(items.slice(pos + 1, pos + 6), {})); }
      }
    }
    function pickForPl(p) {
      const lib = library(); const box = el(`<div class="cr-mp-pick"></div>`); const chosen = new Set();
      lib.forEach((t) => { const r = el(`<label class="cr-check cr-mp-pickrow"><input type="checkbox"><img src="${art(t, 48)}" alt=""><span>${esc(t.title)}</span><span class="cr-dim">${esc(t.album || "")}</span></label>`); r.querySelector("input").onchange = (e) => (e.target.checked ? chosen.add(t) : chosen.delete(t)); box.appendChild(r); });
      K.dialog(root, { title: "Add to " + p.name, body: box, buttons: [{ label: "Cancel", value: false }, { label: "Add", primary: true, value: true }] }).then((ok) => { if (ok && chosen.size) addToPl(p, [...chosen]); });
    }

    // ---------- go ----------
    renderPls(); go("home"); updateBar();
    const api = { playList, playCur, next, prev, toggle, go, addFiles, newPlaylist, get audio() { return audio; }, get video() { return video; }, get cur() { return cur; }, library, data: () => d, toggleMini };
    inst = { winEl, focus: wref.focus, api };
    winEl.__mp = api;
  }
})();
