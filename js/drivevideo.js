/* Video — a small player whose UI is the shadcn/ui Input + Button.
   Paste a Google Drive share link (or file ID) and it plays through Google Drive's own
   /preview embed, so the video streams from Google under Google's permissions — it is NOT
   downloaded and NOTHING about it is stored in this public site's source. You can also open
   a local video file from your device (the shadcn file input) or paste a direct video URL.
   The last few links you use are remembered only in this browser (State.appData.drivevideo). */
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

  // Accepts: a Drive share link, a bare Drive file ID, or a direct http(s) video URL.
  function parseSrc(raw) {
    raw = (raw || "").trim();
    if (!raw) return null;
    let m = raw.match(/\/d\/([a-zA-Z0-9_-]{16,})/) || raw.match(/[?&]id=([a-zA-Z0-9_-]{16,})/);
    if (m) return { type: "drive", id: m[1] };
    if (/drive\.google\.com|docs\.google\.com/.test(raw)) {
      const m2 = raw.match(/([a-zA-Z0-9_-]{25,})/);
      if (m2) return { type: "drive", id: m2[1] };
    }
    if (/^[a-zA-Z0-9_-]{25,}$/.test(raw)) return { type: "drive", id: raw };
    if (/^https?:\/\//i.test(raw)) return { type: "url", url: raw };
    return null;
  }
  const driveEmbed = (id) => "https://drive.google.com/file/d/" + encodeURIComponent(id) + "/preview";

  function open() {
    const ref = WM.createWindow({ title: "Video", icon: Icon.mini("drivevideo", "Video"), width: Math.min(920, innerWidth - 26), height: Math.min(640, innerHeight - 90), appId: "drivevideo" });
    const body = ref.body || ref.content || ref.el.querySelector(".win-body");
    render(body);
    const st = store();
    if (st.last) { const inp = body.querySelector(".dv-input"); if (inp) inp.value = st.last; }
    return ref;
  }

  function render(body) {
    body.innerHTML = "";
    const root = el(`
      <div class="dv-root">
        <div class="dv-bar">
          <div class="dv-field">
            <label class="dv-label" for="dv-link">Google Drive link or video URL</label>
            <div class="dv-inrow">
              <input class="dv-input" id="dv-link" type="text" inputmode="url" autocomplete="off" spellcheck="false"
                placeholder="https://drive.google.com/file/d/…/view" />
              <button class="dv-btn dv-play" type="button">Play</button>
            </div>
          </div>
          <div class="dv-or">or</div>
          <label class="dv-filebtn">
            Open a video from this device
            <input class="dv-file" type="file" accept="video/*" />
          </label>
        </div>
        <div class="dv-stage"><div class="dv-empty">
          <div class="dv-empty-ic">${Icon.md("drivevideo", "Video")}</div>
          <div class="dv-empty-t">Paste a Google Drive link and press Play</div>
          <div class="dv-empty-s">Drive videos stream from Google with your Google permissions — they aren't downloaded or stored here. You can also open a local file.</div>
        </div></div>
        <div class="dv-recent"></div>
      </div>`);
    body.appendChild(root);
    const input = root.querySelector(".dv-input");
    const stage = root.querySelector(".dv-stage");
    const fileInput = root.querySelector(".dv-file");

    const playRaw = (raw) => {
      const src = parseSrc(raw);
      if (!src) { flash(input, "Enter a Google Drive link, file ID, or a direct video URL."); return; }
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
    stage.innerHTML = "";
    if (src.type === "drive") {
      const wrap = el(`<div class="dv-frame-wrap"><iframe class="dv-frame" src="${esc(driveEmbed(src.id))}" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="no-referrer"></iframe></div>`);
      stage.appendChild(wrap);
      const note = el(`<div class="dv-note">If this shows a Google sign-in or "no access," open the video in a Google account that can view that Drive file.</div>`);
      stage.appendChild(note);
    } else {
      const v = el(`<video class="dv-video" controls playsinline autoplay src="${esc(src.url)}"></video>`);
      stage.appendChild(v);
      if (src.name) stage.appendChild(el(`<div class="dv-note">Playing local file: ${esc(src.name)}</div>`));
      v.addEventListener("error", () => { stage.appendChild(el(`<div class="dv-note dv-err">This video URL couldn't be played directly (the server may block cross-origin playback).</div>`)); });
    }
  }

  function renderRecent(root) {
    const box = root.querySelector(".dv-recent");
    const st = store();
    const list = (st.recent || []);
    if (!list.length) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="dv-recent-t">Recent</div>`;
    list.forEach((raw) => {
      const src = parseSrc(raw);
      const label = src && src.type === "drive" ? "Drive · " + src.id.slice(0, 10) + "…" : raw.replace(/^https?:\/\//, "").slice(0, 44);
      const chip = el(`<button class="dv-chip" type="button" title="${esc(raw)}">${esc(label)}</button>`);
      chip.onclick = () => { const inp = root.querySelector(".dv-input"); inp.value = raw; mount(root.querySelector(".dv-stage"), src); };
      box.appendChild(chip);
    });
  }

  function flash(input, msg) {
    input.classList.add("dv-bad");
    let n = input.parentElement.parentElement.querySelector(".dv-fieldmsg");
    if (!n) { n = el(`<div class="dv-fieldmsg"></div>`); input.parentElement.parentElement.appendChild(n); }
    n.textContent = msg;
    setTimeout(() => { input.classList.remove("dv-bad"); }, 1600);
  }

  if (window.AppRegistry) AppRegistry.drivevideo = function () { return open(); };
  try {
    if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === "drivevideo"))
      Catalog.storeApps.push({ id: "drivevideo", name: "Video", cat: "Media", price: 0, builtin: "drivevideo", desc: "Play a Google Drive video by pasting its share link (it streams from Google under your permissions — nothing is downloaded), or open a video file from this device." });
    const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []);
    if (ex.indexOf("drivevideo") < 0) ex.push("drivevideo");
  } catch (e) {}

  window.DriveVideo = { open, parseSrc, play: (raw) => { const r = open(); const inp = r.body && r.body.querySelector(".dv-input"); if (inp) { inp.value = raw; } const src = parseSrc(raw); if (src) mount(r.body.querySelector(".dv-stage"), src); return r; } };
})();
