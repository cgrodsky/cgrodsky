/* Video — the player for every video in this simulation that isn't a YouTube video.
   Files and the (fake) Google Drive both open videos here. Its UI is the shadcn/ui
   Input + Button: open a file from this device, or paste a direct video URL.
   Everything is local to the sim — nothing is uploaded, downloaded or sent anywhere,
   and there is no real Google Drive involved. VFS videos stream from IndexedDB in-browser. */
(function () {
  "use strict";
  if (window.DriveVideo) return;

  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  try {
    if (window.Icon && Icon.register) {
      Icon.register("drivevideo", `<svg viewBox="0 0 48 48" width="100%" height="100%"><defs><linearGradient id="dvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#2b6be4"/></linearGradient></defs><rect x="5" y="9" width="38" height="30" rx="6" fill="url(#dvg)"/><path d="M20 18l12 6-12 6z" fill="#fff"/></svg>`);
    }
  } catch (e) {}

  const store = () => {
    State.data.appData = State.data.appData || {};
    return (State.data.appData.drivevideo = State.data.appData.drivevideo || { recent: [], last: "" });
  };

  // A direct http(s) video URL (not YouTube, not a web page). Local files/VFS come through openNode.
  function parseSrc(raw) {
    raw = (raw || "").trim();
    if (!raw) return null;
    if (/youtube\.com|youtu\.be/i.test(raw)) return { type: "youtube" };
    if (/^https?:\/\//i.test(raw)) return { type: "url", url: raw };
    return null;
  }

  function winFor(title) {
    const ref = WM.createWindow({ title: title || "Video", icon: Icon.mini("drivevideo", "Video"), width: Math.min(920, innerWidth - 26), height: Math.min(640, innerHeight - 90), appId: "drivevideo" });
    const body = ref.body || ref.content || (ref.el && ref.el.querySelector(".win-body"));
    render(body);
    return { ref, body };
  }

  function open() {
    const { ref, body } = winFor("Video");
    const st = store();
    if (st.last) { const inp = body.querySelector(".dv-input"); if (inp) inp.value = st.last; }
    return ref;
  }

  // Play a file that lives in the sim's virtual file system (Files / fake Google Drive).
  function openNode(name, node, path) {
    const { ref, body } = winFor(name || "Video");
    resolveURL(node).then((u) => {
      const stage = body.querySelector(".dv-stage");
      if (!u) { stage.innerHTML = ""; stage.appendChild(el(`<div class="dv-empty"><div class="dv-empty-t">Can't play this video</div><div class="dv-empty-s">“${esc(name || "")}” isn't stored on this device.</div></div>`)); return; }
      mount(stage, { type: "file", url: u, name: name });
    });
    return ref;
  }

  function resolveURL(node) {
    try {
      if (node && node.blob && window.VFS && VFS.getBlob) return VFS.getBlob(node.blob).then((b) => (b ? URL.createObjectURL(b) : (node.src || null))).catch(() => node && node.src || null);
      if (node && node.url) return Promise.resolve(node.url);
      return Promise.resolve(node && node.src ? node.src : null);
    } catch (e) { return Promise.resolve(null); }
  }

  function render(body) {
    body.innerHTML = "";
    const root = el(`
      <div class="dv-root">
        <div class="dv-bar">
          <label class="dv-filebtn">
            Open a video from this device
            <input class="dv-file" type="file" accept="video/*" />
          </label>
          <div class="dv-or">or</div>
          <div class="dv-field">
            <label class="dv-label" for="dv-link">Direct video URL</label>
            <div class="dv-inrow">
              <input class="dv-input" id="dv-link" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://example.com/clip.mp4" />
              <button class="dv-btn dv-play" type="button">Play</button>
            </div>
          </div>
        </div>
        <div class="dv-stage"><div class="dv-empty">
          <div class="dv-empty-ic">${Icon.md("drivevideo", "Video")}</div>
          <div class="dv-empty-t">Open a video to play it here</div>
          <div class="dv-empty-s">This is the player for every video in Files and Google Drive (except YouTube). Open a file from this device, double-click a video in File Explorer, or paste a direct video URL. Nothing leaves this device.</div>
        </div></div>
        <div class="dv-recent"></div>
      </div>`);
    body.appendChild(root);
    const input = root.querySelector(".dv-input");
    const stage = root.querySelector(".dv-stage");
    const fileInput = root.querySelector(".dv-file");

    const playRaw = (raw) => {
      const src = parseSrc(raw);
      if (!src) { flash(input, "Enter a direct video URL (http/https). YouTube links open in the YouTube app."); return; }
      if (src.type === "youtube") { flash(input, "YouTube videos play in the YouTube app, not here."); return; }
      const st = store(); st.last = raw.trim();
      st.recent = [raw.trim()].concat((st.recent || []).filter((x) => x !== raw.trim())).slice(0, 6);
      State.save();
      mount(stage, src);
      renderRecent(root);
    };
    root.querySelector(".dv-play").onclick = () => playRaw(input.value);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); playRaw(input.value); } });
    fileInput.addEventListener("change", () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      mount(stage, { type: "file", url: URL.createObjectURL(f), name: f.name });
    });
    renderRecent(root);
  }

  function mount(stage, src) {
    const old = stage.querySelector("video");
    if (old && old.src && old.src.startsWith("blob:")) { try { URL.revokeObjectURL(old.src); } catch (e) {} }
    stage.innerHTML = "";
    const v = el(`<video class="dv-video" controls playsinline autoplay src="${esc(src.url)}"></video>`);
    stage.appendChild(v);
    if (src.name) stage.appendChild(el(`<div class="dv-note">${esc(src.name)}</div>`));
    v.addEventListener("error", () => { if (!stage.querySelector(".dv-err")) stage.appendChild(el(`<div class="dv-note dv-err">This video couldn't be played (the format may be unsupported, or a URL's server blocks cross-origin playback).</div>`)); });
    const pl = v.play && v.play(); if (pl && pl.catch) pl.catch(() => {});
  }

  function renderRecent(root) {
    const box = root.querySelector(".dv-recent");
    const list = store().recent || [];
    if (!list.length) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="dv-recent-t">Recent URLs</div>`;
    list.forEach((raw) => {
      const chip = el(`<button class="dv-chip" type="button" title="${esc(raw)}">${esc(raw.replace(/^https?:\/\//, "").slice(0, 46))}</button>`);
      chip.onclick = () => { root.querySelector(".dv-input").value = raw; const s = parseSrc(raw); if (s && s.type === "url") mount(root.querySelector(".dv-stage"), s); };
      box.appendChild(chip);
    });
  }

  function flash(input, msg) {
    input.classList.add("dv-bad");
    let n = input.closest(".dv-field").querySelector(".dv-fieldmsg");
    if (!n) { n = el(`<div class="dv-fieldmsg"></div>`); input.closest(".dv-field").appendChild(n); }
    n.textContent = msg;
    setTimeout(() => { input.classList.remove("dv-bad"); }, 2000);
  }

  if (window.AppRegistry) AppRegistry.drivevideo = function () { return open(); };
  try {
    if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === "drivevideo"))
      Catalog.storeApps.push({ id: "drivevideo", name: "Video", cat: "Media", price: 0, builtin: "drivevideo", desc: "Plays every video in Files and Google Drive that isn't a YouTube video. Open a file from this device, double-click a video in File Explorer, or paste a direct video URL. Everything stays on this device." });
    const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []);
    if (ex.indexOf("drivevideo") < 0) ex.push("drivevideo");
  } catch (e) {}

  window.DriveVideo = { open, openNode, parseSrc };
})();
