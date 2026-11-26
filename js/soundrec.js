/* Sound Recorder (Windows 11 style).
   REAL: records from a real microphone (getUserMedia + MediaRecorder, or a built-in WAV encoder),
   lets you pick the input device, shows a live level meter / waveform (Web Audio AnalyserNode),
   pause / resume, markers, and saves real audio files to Documents › Sound recordings
   (bytes in IndexedDB via VFS.putBlob). Recordings play back with a waveform you can scrub,
   can be renamed, deleted (to the Recycle Bin when File Explorer is loaded), shared or downloaded.
   Formats are whatever this browser can really encode (MediaRecorder.isTypeSupported):
   MPEG-4/AAC on iPad Safari, WebM/Opus or MP4 on Chrome/Edge, Ogg/Opus on Firefox, plus WAV.
   Also exports window.WebmFix: writes the missing Duration into MediaRecorder WebM files so
   players know the length and can seek (used by the Snipping Tool's screen recordings too). */
(function () {
  "use strict";
  if (window.SoundRecorder) return;
  const S = () => State.data;
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const K = () => window.CrKit || null;
  const DIR = ["Documents", "Sound recordings"];
  const pad = (n) => String(n).padStart(2, "0");
  const fmtClock = (s) => { s = Math.max(0, s || 0); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = Math.floor(s % 60); return pad(h) + ":" + pad(m) + ":" + pad(x); };
  const fmtShort = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ":" + pad(m) : m) + ":" + pad(x); };
  const fmtSize = (b) => b < 1024 ? b + " B" : b < 1048576 ? Math.ceil(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB";

  // =====================================================================
  //  WebmFix — add <Duration> to the Segment Info of a MediaRecorder WebM
  // =====================================================================
  const WebmFix = (function () {
    function vint(b, p) {
      const f = b[p]; if (f == null) return null;
      let len = 1, mask = 0x80; while (len <= 8 && !(f & mask)) { len++; mask >>= 1; }
      if (len > 8 || p + len > b.length) return null;
      let v = f & (mask - 1), ones = v === mask - 1;
      for (let i = 1; i < len; i++) { v = v * 256 + b[p + i]; if (b[p + i] !== 0xff) ones = false; }
      return { len, value: v, unknown: ones };
    }
    function eid(b, p) { const f = b[p]; const len = f & 0x80 ? 1 : f & 0x40 ? 2 : f & 0x20 ? 3 : f & 0x10 ? 4 : 0; if (!len || p + len > b.length) return null; let id = 0; for (let i = 0; i < len; i++) id = id * 256 + b[p + i]; return { len, id }; }
    async function fix(blob, durationMs) {
      try {
        if (!blob || !/webm/i.test(blob.type || "") || !(durationMs > 0)) return blob;
        const b = new Uint8Array(await blob.slice(0, Math.min(blob.size, 65536)).arrayBuffer());
        let p = 0;
        const h = eid(b, 0); if (!h || h.id !== 0x1A45DFA3) return blob;
        const hs = vint(b, h.len); p = h.len + hs.len + hs.value;
        const seg = eid(b, p); if (!seg || seg.id !== 0x18538067) return blob;
        const ss = vint(b, p + seg.len); if (!ss || !ss.unknown) return blob; // a sized Segment would need rewriting too
        let q = p + seg.len + ss.len;
        while (q < b.length - 12) {
          const id = eid(b, q); if (!id) return blob; const s = vint(b, q + id.len); if (!s) return blob;
          if (id.id === 0x114D9B74) return blob; // SeekHead: offsets would move
          if (id.id === 0x1549A966) {
            const c0 = q + id.len + s.len, c1 = c0 + s.value; if (c1 > b.length) return blob;
            let r = c0, scale = 1e6;
            while (r < c1) { const ci = eid(b, r); if (!ci) return blob; const cs = vint(b, r + ci.len); if (!cs) return blob; if (ci.id === 0x4489) return blob; if (ci.id === 0x2AD7B1) { let v = 0; for (let i = 0; i < cs.value; i++) v = v * 256 + b[r + ci.len + cs.len + i]; scale = v || 1e6; } r += ci.len + cs.len + cs.value; }
            const dur = new Uint8Array(11); dur[0] = 0x44; dur[1] = 0x89; dur[2] = 0x88; new DataView(dur.buffer).setFloat64(3, durationMs * 1e6 / scale);
            const hdr = new Uint8Array(id.len + 8); hdr.set(b.subarray(q, q + id.len)); hdr[id.len] = 0x01;
            let n = s.value + 11; for (let i = 7; i >= 1; i--) { hdr[id.len + i] = n % 256; n = Math.floor(n / 256); }
            return new Blob([blob.slice(0, q), hdr, blob.slice(c0, c1), dur, blob.slice(c1)], { type: blob.type });
          }
          if (s.unknown) return blob;
          q += id.len + s.len + s.value;
        }
      } catch (e) {}
      return blob;
    }
    return { fix };
  })();
  window.WebmFix = WebmFix;

  // =====================================================================
  //  Formats / settings
  // =====================================================================
  const sup = (t) => { try { return !!(window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)); } catch (e) { return false; } };
  const HAS_AC = !!(window.AudioContext || window.webkitAudioContext);
  const FORMATS = [
    { id: "aac", label: "MPEG-4 audio, AAC (.m4a)", mime: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" },
    { id: "mp4", label: "MPEG-4 audio (.m4a)", mime: "audio/mp4", ext: "m4a" },
    { id: "webm", label: "WebM, Opus (.webm)", mime: "audio/webm;codecs=opus", ext: "webm" },
    { id: "ogg", label: "Ogg, Opus (.ogg)", mime: "audio/ogg;codecs=opus", ext: "ogg" },
    { id: "wav", label: "WAV, lossless (.wav)", wav: true, ext: "wav" },
  ].filter((f) => (f.wav ? HAS_AC : sup(f.mime)));
  // Chrome's "audio/mp4" carries Opus — hide it when the AAC entry exists, say so otherwise.
  (function () { const aac = FORMATS.find((f) => f.id === "aac"), mp4 = FORMATS.find((f) => f.id === "mp4"); if (aac && mp4) FORMATS.splice(FORMATS.indexOf(mp4), 1); else if (mp4 && sup("audio/mp4;codecs=opus")) mp4.label = "MPEG-4 audio, Opus (.m4a)"; })();
  const QUALITY = [["auto", "Auto", 0], ["best", "Best (256 kbps)", 256000], ["high", "High (192 kbps)", 192000], ["medium", "Medium (128 kbps)", 128000], ["low", "Low (64 kbps)", 64000]];
  function defaultFormat() { const pref = ["aac", "webm", "mp4", "ogg", "wav"]; for (const id of pref) if (FORMATS.find((f) => f.id === id)) return id; return ""; }
  function cfg() {
    const d = S(); d.appData = d.appData || {};
    let c = d.appData.soundrec; if (!c || typeof c !== "object") c = d.appData.soundrec = {};
    if (!FORMATS.find((f) => f.id === c.format)) c.format = defaultFormat();
    if (!QUALITY.find((q) => q[0] === c.quality)) c.quality = "auto";
    if (typeof c.device !== "string") c.device = "";
    return c;
  }
  function save() { const k = K(); if (k && k.trySave) return k.trySave(); try { State.save(); return true; } catch (e) { return false; } }
  function vfsChanged() { try { window.dispatchEvent(new CustomEvent("vfs-change", { detail: { source: "soundrec" } })); } catch (e) {} }
  function folder(create) {
    const k = K(); if (k && k.folder) return k.folder(DIR, create);
    let ch = window.VFS ? VFS.ensure() : null; if (!ch) return null;
    for (const seg of DIR) { if (!ch[seg]) { if (!create) return null; ch[seg] = { type: "folder", children: {} }; } ch = ch[seg].children || (ch[seg].children = {}); }
    return ch;
  }
  function uniqueName(kids, name) {
    if (!kids[name]) return name;
    const m = name.match(/^(.*?)(\.[^.]+)?$/); let i = 2;
    while (kids[m[1] + " (" + i + ")" + (m[2] || "")]) i++;
    return m[1] + " (" + i + ")" + (m[2] || "");
  }
  function recordings() {
    const kids = folder(false) || {};
    return Object.keys(kids).filter((n) => kids[n] && kids[n].type === "file" && (kids[n].kind === "audio" || /^audio\//.test(kids[n].mime || "") || /\.(m4a|webm|ogg|wav|mp3|weba|opus|aac)$/i.test(n)))
      .map((name) => ({ name, node: kids[name] })).sort((a, b) => (b.node.ts || 0) - (a.node.ts || 0));
  }
  async function blobOf(node) {
    if (node.blob && window.VFS && VFS.getBlob) { try { const b = await VFS.getBlob(node.blob); if (b) return b; } catch (e) {} }
    if (node.src) { try { return await (await fetch(node.src)).blob(); } catch (e) {} }
    return null;
  }
  function download(blob, name) {
    const k = K(); if (k && k.download) return k.download(blob, name);
    const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  }
  function notify(title, body) { try { if (window.Notify) Notify.show({ icon: Icon.mini("soundrec", "Sound Recorder"), title: esc(title), body }); } catch (e) {} }
  function encodeWav(chunks, rate) {
    const len = chunks.reduce((a, c) => a + c.length, 0);
    const buf = new ArrayBuffer(44 + len * 2), v = new DataView(buf);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); ws(8, "WAVE"); ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, len * 2, true);
    let o = 44; for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) { const s = clamp(c[i], -1, 1); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return new Blob([buf], { type: "audio/wav" });
  }
  function downsample(arr, n) {
    if (arr.length <= n) return arr.map((x) => Math.round(clamp(x, 0, 1) * 100));
    const out = [], k = arr.length / n;
    for (let i = 0; i < n; i++) { let m = 0; for (let j = Math.floor(i * k); j < Math.floor((i + 1) * k); j++) m = Math.max(m, arr[j] || 0); out.push(Math.round(clamp(m, 0, 1) * 100)); }
    return out;
  }
  async function decodePeaks(blob) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC || !blob) return null;
    const ac = new AC();
    try {
      const ab = await blob.arrayBuffer();
      const buf = await new Promise((res, rej) => { const p = ac.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
      const d = buf.getChannelData(0), n = 400, step = Math.max(1, Math.floor(d.length / n)), out = [];
      for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j++) { const a = Math.abs(d[j]); if (a > m) m = a; } out.push(m); }
      const mx = Math.max(0.05, ...out);
      return { peaks: out.map((x) => Math.round(x / mx * 100)), duration: buf.duration };
    } catch (e) { return null; } finally { try { ac.close(); } catch (e) {} }
  }

  const IC = {
    rec: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
    flag: '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>',
    back: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><text x="12" y="15" font-size="6.5" text-anchor="middle" stroke="none" fill="currentColor" font-family="system-ui">10</text>',
    fwd: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/><text x="12" y="15" font-size="6.5" text-anchor="middle" stroke="none" fill="currentColor" font-family="system-ui">10</text>',
    share: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  };
  const ic = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;

  // =====================================================================
  //  The app
  // =====================================================================
  const open = [];
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.soundrec = function () {
    const ref = WM.createWindow({ title: "Sound Recorder", icon: Icon.mini("soundrec", "Sound Recorder"), width: Math.min(820, innerWidth - 20), height: Math.min(540, innerHeight - 100), appId: "soundrec" });
    const body = ref.body, win = body.closest(".win");
    body.innerHTML = `<div class="sr" tabindex="-1">
      <aside class="sr-side"><div class="sr-side-h"><b>Recordings</b><span class="sr-count"></span></div><div class="sr-list" role="listbox" aria-label="Recordings"></div></aside>
      <main class="sr-main">
        <div class="sr-head"><button class="sr-ib sr-listbtn" data-a="list" title="Recordings" aria-label="Show recordings">${ic("list")}</button><div class="sr-name"></div></div>
        <div class="sr-stage"><canvas class="sr-wave"></canvas><div class="sr-msg" hidden></div></div>
        <div class="sr-time" aria-live="off">00:00:00</div>
        <div class="sr-marks"></div>
        <div class="sr-ctl"></div>
        <div class="sr-foot">
          <label class="sr-dev" title="Recording device">${ic("mic", 16)}<select class="sr-sel sr-dev-sel" aria-label="Recording device"></select></label>
          <span class="sr-meter" title="Input level" aria-hidden="true"><i></i></span>
          <span class="sr-grow"></span>
          <label class="sr-opt">Format <select class="sr-sel sr-fmt" aria-label="Recording format"></select></label>
          <label class="sr-opt">Quality <select class="sr-sel sr-q" aria-label="Audio quality"></select></label>
        </div>
      </main>
      <audio class="sr-audio" preload="auto" hidden></audio>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const root = $(".sr"), listEl = $(".sr-list"), canvas = $(".sr-wave"), msgEl = $(".sr-msg"), timeEl = $(".sr-time"), ctl = $(".sr-ctl"), marksEl = $(".sr-marks"), audio = $(".sr-audio"), meter = $(".sr-meter i");
    const st = { mode: "idle", sel: null, rec: null, raf: 0, speed: 1, dur: 0, url: null, playMarks: [] };

    // ---------- footer: device / format / quality ----------
    const devSel = $(".sr-dev-sel"), fmtSel = $(".sr-fmt"), qSel = $(".sr-q");
    function paintFormats() {
      const c = cfg();
      fmtSel.innerHTML = FORMATS.map((f) => `<option value="${f.id}" ${f.id === c.format ? "selected" : ""}>${esc(f.label)}</option>`).join("") || `<option>Not available</option>`;
      qSel.innerHTML = QUALITY.map((q) => `<option value="${q[0]}" ${q[0] === c.quality ? "selected" : ""}>${esc(q[1])}</option>`).join("");
      const f = FORMATS.find((x) => x.id === c.format); qSel.disabled = !f || !!f.wav; if (f && f.wav) qSel.title = "WAV is uncompressed 16-bit PCM";
    }
    fmtSel.onchange = () => { cfg().format = fmtSel.value; save(); paintFormats(); };
    qSel.onchange = () => { cfg().quality = qSel.value; save(); };
    async function paintDevices() {
      let devs = [];
      try { devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput"); } catch (e) {}
      const c = cfg(); let n = 0;
      devSel.innerHTML = `<option value="">Default microphone</option>` + devs.filter((d) => d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications").map((d) => `<option value="${esc(d.deviceId)}" ${d.deviceId === c.device ? "selected" : ""}>${esc(d.label || "Microphone " + (++n))}</option>`).join("");
      if (c.device && !devs.some((d) => d.deviceId === c.device)) devSel.value = "";
    }
    devSel.onchange = () => { cfg().device = devSel.value; save(); };
    const onDevChange = () => paintDevices();
    try { navigator.mediaDevices.addEventListener("devicechange", onDevChange); } catch (e) {}

    // ---------- list ----------
    function paintList() {
      const recs = recordings();
      $(".sr-count").textContent = recs.length ? String(recs.length) : "";
      listEl.innerHTML = "";
      if (!recs.length) listEl.appendChild(el(`<div class="sr-empty">Your recordings will show up here.</div>`));
      recs.forEach((r) => {
        const d = new Date(r.node.ts || Date.now());
        const it = el(`<button class="sr-it${st.sel && st.sel.name === r.name ? " on" : ""}" role="option" aria-selected="${!!(st.sel && st.sel.name === r.name)}"><span class="sr-it-n"></span><span class="sr-it-m"><span>${esc(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }))} ${esc(d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }))}</span><span>${r.node.duration ? fmtShort(r.node.duration) : ""}</span></span></button>`);
        it.querySelector(".sr-it-n").textContent = r.name.replace(/\.[^.]+$/, "");
        it.title = r.name;
        it.onclick = () => { if (st.mode === "recording" || st.mode === "paused") return; select(r.name); root.classList.remove("sr-show-list"); };
        listEl.appendChild(it);
      });
    }
    const onVfs = (e) => { if (e && e.detail && e.detail.source === "soundrec") return; if (st.sel && !(folder(false) || {})[st.sel.name]) { st.sel = null; stopPlayback(); setMode("idle"); } paintList(); };
    window.addEventListener("vfs-change", onVfs);

    // ---------- canvas ----------
    const dark = () => document.body.classList.contains("dark");
    function sizeCanvas() { const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; const w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } return { w, h, dpr }; }
    function accent() { const a = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(); return a || (dark() ? "#4cc2ff" : "#0067c0"); }
    function drawLive(peaks) {
      const { w, h, dpr } = sizeCanvas(), g = canvas.getContext("2d"); g.clearRect(0, 0, w, h);
      const bw = 3 * dpr, gap = 2 * dpr, n = Math.floor(w / 2 / (bw + gap)), mid = h / 2, cx = w / 2;
      g.fillStyle = dark() ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"; g.fillRect(0, mid - 0.5 * dpr, w, dpr);
      g.fillStyle = "#e0393e";
      for (let i = 0; i < n && i < peaks.length; i++) { const v = peaks[peaks.length - 1 - i]; const bh = Math.max(2 * dpr, v * (h * 0.86)); g.fillRect(cx - (i + 1) * (bw + gap), mid - bh / 2, bw, bh); }
      g.fillStyle = dark() ? "#fff" : "#1b1b1b"; g.fillRect(cx - dpr, 6 * dpr, 2 * dpr, h - 12 * dpr);
    }
    function drawPlayback() {
      const { w, h, dpr } = sizeCanvas(), g = canvas.getContext("2d"); g.clearRect(0, 0, w, h);
      const n = st.sel && st.sel.node; if (!n) return;
      const peaks = n.peaks && n.peaks.length ? n.peaks : null, dur = st.dur || n.duration || 0;
      const pos = dur ? clamp(audio.currentTime / dur, 0, 1) : 0, mid = h / 2;
      const bw = 2 * dpr, gap = 1.5 * dpr, bars = Math.max(1, Math.floor(w / (bw + gap)));
      const ac = accent(), dim = dark() ? "rgba(255,255,255,.28)" : "rgba(0,0,0,.22)";
      for (let i = 0; i < bars; i++) {
        const v = peaks ? (peaks[Math.floor(i / bars * peaks.length)] || 0) / 100 : 0.08;
        const bh = Math.max(2 * dpr, v * h * 0.84);
        g.fillStyle = i / bars <= pos ? ac : dim;
        g.fillRect(i * (bw + gap), mid - bh / 2, bw, bh);
      }
      (n.markers || []).forEach((t) => { if (!dur) return; const x = t / dur * w; g.fillStyle = "#f2a900"; g.fillRect(x - dpr / 2, 0, dpr, h); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8 * dpr, 4 * dpr); g.lineTo(x, 8 * dpr); g.fill(); });
      g.fillStyle = dark() ? "#fff" : "#1b1b1b"; g.fillRect(pos * w - dpr, 0, 2 * dpr, h);
    }
    function paintTime() {
      if (st.mode === "recording" || st.mode === "paused") timeEl.textContent = fmtClock(elapsed() / 1000);
      else if (st.mode === "playback") { timeEl.innerHTML = `${fmtClock(audio.currentTime)} <span>/ ${fmtClock(st.dur || (st.sel && st.sel.node.duration) || 0)}</span>`; }
      else timeEl.textContent = "00:00:00";
    }
    function paintMarks() {
      marksEl.innerHTML = "";
      const list = st.mode === "recording" || st.mode === "paused" ? (st.rec ? st.rec.markers : []) : st.sel ? st.sel.node.markers || [] : [];
      list.forEach((t, i) => {
        const m = el(`<span class="sr-mark"><button class="sr-mark-go" title="Jump to marker">${ic("flag", 13)} Marker ${i + 1} · ${fmtShort(t)}</button>${st.mode === "playback" ? `<button class="sr-mark-x" title="Remove marker" aria-label="Remove marker ${i + 1}">${ic("x", 12)}</button>` : ""}</span>`);
        m.querySelector(".sr-mark-go").onclick = () => { if (st.mode === "playback") { audio.currentTime = t; drawPlayback(); paintTime(); } };
        const x = m.querySelector(".sr-mark-x"); if (x) x.onclick = () => { st.sel.node.markers.splice(i, 1); save(); paintMarks(); drawPlayback(); };
        marksEl.appendChild(m);
      });
    }
    function showMsg(html) { msgEl.hidden = !html; msgEl.innerHTML = html || ""; }

    // ---------- modes / controls ----------
    function setMode(m) {
      st.mode = m; root.dataset.mode = m;
      ctl.innerHTML = "";
      const add = (cls, icon, label, fn, extra) => { const b = el(`<button class="sr-b ${cls}" title="${esc(label)}" aria-label="${esc(label)}">${ic(icon, extra && extra.size)}${extra && extra.text ? `<span>${esc(extra.text)}</span>` : ""}</button>`); b.onclick = fn; ctl.appendChild(b); return b; };
      if (m === "idle") {
        add("sr-recbig", "rec", "Start recording (Ctrl+R)", startRec, { size: 28 });
        $(".sr-name").textContent = "";
        drawLive([]);
      } else if (m === "recording" || m === "paused") {
        add("sr-b-mark", "flag", "Add marker (Ctrl+M)", addMarker);
        add("sr-recbig sr-stopbig", "stop", "Stop recording (Esc)", stopRec, { size: 24 });
        add("sr-b-pause", m === "paused" ? "rec" : "pause", m === "paused" ? "Resume recording" : "Pause recording", togglePause);
        $(".sr-name").textContent = m === "paused" ? "Paused" : "Recording…";
      } else if (m === "playback") {
        add("sr-recsmall", "rec", "Start a new recording (Ctrl+R)", startRec, { size: 18 });
        const mid = el(`<span class="sr-ctl-mid"></span>`); ctl.appendChild(mid);
        const mk = (cls, icon, label, fn) => { const b = el(`<button class="sr-b ${cls}" title="${esc(label)}" aria-label="${esc(label)}">${ic(icon)}</button>`); b.onclick = fn; mid.appendChild(b); return b; };
        mk("sr-b-mark", "flag", "Add marker (Ctrl+M)", addMarker);
        mk("sr-b-back", "back", "Back 10 seconds", () => { audio.currentTime = Math.max(0, audio.currentTime - 10); drawPlayback(); paintTime(); });
        const pb = mk("sr-play", audio.paused ? "play" : "pause", "Play / pause (Space)", playPause);
        pb.classList.add("sr-playbig");
        mk("sr-b-fwd", "fwd", "Forward 10 seconds", () => { audio.currentTime = Math.min(st.dur || 1e9, audio.currentTime + 10); drawPlayback(); paintTime(); });
        const sp = el(`<button class="sr-b sr-speed" title="Playback speed">${st.speed}×</button>`); sp.onclick = () => { const L = [0.5, 1, 1.5, 2]; st.speed = L[(L.indexOf(st.speed) + 1) % L.length]; audio.playbackRate = st.speed; sp.textContent = st.speed + "×"; }; mid.appendChild(sp);
        const right = el(`<span class="sr-ctl-r"></span>`); ctl.appendChild(right);
        const sh = el(`<button class="sr-b" title="Share" aria-label="Share">${ic("share")}</button>`); sh.onclick = () => share(); right.appendChild(sh);
        const mo = el(`<button class="sr-b sr-more" title="More options" aria-label="More options">${ic("more")}</button>`); mo.onclick = () => moreMenu(mo); right.appendChild(mo);
        $(".sr-name").textContent = st.sel ? st.sel.name.replace(/\.[^.]+$/, "") : "";
      }
      [devSel, fmtSel, qSel].forEach((s) => { s.disabled = m === "recording" || m === "paused" ? true : s === qSel ? qSel.disabled : false; });
      if (!(m === "recording" || m === "paused")) paintFormats();
      paintTime(); paintMarks();
    }

    // ---------- recording ----------
    function elapsed() { const r = st.rec; if (!r) return 0; return r.acc + (r.running ? performance.now() - r.t0 : 0); }
    async function startRec() {
      if (st.mode === "recording" || st.mode === "paused" || st.starting) return;
      stopPlayback();
      const pf = S().appData && S().appData.settings12;
      if (pf && pf.mic === false) { setMode(st.sel ? "playback" : "idle"); showMsg(`<b>Microphone access is turned off</b><br>Turn on “Microphone” in Settings › Privacy &amp; security to record.<br><button class="sr-link" data-a="priv">Open privacy settings</button>`); const b = msgEl.querySelector("[data-a=priv]"); if (b) b.onclick = () => { window.SettingsStartPage = "privacy"; WM.open("settings"); }; return; }
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { showMsg("<b>This browser can't record audio.</b><br>Microphone access needs HTTPS and a browser with getUserMedia."); return; }
      const c = cfg(), fmt = FORMATS.find((f) => f.id === c.format);
      if (!fmt) { showMsg("<b>Recording isn't available</b><br>This browser has no audio encoder (no MediaRecorder or Web Audio)."); return; }
      st.starting = true; showMsg("");
      const AC = window.AudioContext || window.webkitAudioContext;
      let ac = null; try { ac = AC ? new AC() : null; if (ac && ac.resume) ac.resume().catch(() => {}); } catch (e) { ac = null; } // created inside the tap (iOS)
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: c.device ? { deviceId: { exact: c.device } } : true });
      } catch (e) {
        if (c.device && e && e.name === "OverconstrainedError") { try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e2) { e = e2; } }
        if (!stream) {
          st.starting = false; try { if (ac) ac.close(); } catch (er) {}
          const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
          showMsg(denied ? "<b>Microphone access was blocked</b><br>Allow the microphone for this site in your browser (on iPad: Settings › Safari › Microphone), then try again." : e && e.name === "NotFoundError" ? "<b>No microphone found</b><br>Connect a microphone and try again." : "<b>Couldn't start recording</b><br>" + esc((e && e.message) || "The microphone couldn't be opened."));
          return;
        }
      }
      const r = { stream, ac, fmt, chunks: [], pcm: [], peaks: [], live: [], markers: [], acc: 0, t0: performance.now(), running: true, bucket: 0, bucketT: performance.now(), rate: ac ? ac.sampleRate : 48000 };
      try {
        if (ac) {
          const src = ac.createMediaStreamSource(stream); r.src = src;
          const an = ac.createAnalyser(); an.fftSize = 2048; src.connect(an); r.an = an; r.buf = new Float32Array(an.fftSize);
          if (fmt.wav) {
            const sp = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain(); mute.gain.value = 0;
            sp.onaudioprocess = (ev) => { if (r.running) r.pcm.push(new Float32Array(ev.inputBuffer.getChannelData(0))); };
            src.connect(sp); sp.connect(mute); mute.connect(ac.destination); r.sp = sp;
          }
        }
        if (!fmt.wav) {
          const q = QUALITY.find((x) => x[0] === c.quality), opts = { mimeType: fmt.mime };
          if (q && q[2]) opts.audioBitsPerSecond = q[2];
          let mr; try { mr = new MediaRecorder(stream, opts); } catch (e) { mr = new MediaRecorder(stream); }
          mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) r.chunks.push(ev.data); };
          r.mr = mr; mr.start(1000);
        } else if (!ac) throw new Error("no audio");
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop()); try { if (ac) ac.close(); } catch (er) {}
        st.starting = false; showMsg("<b>Couldn't start recording</b><br>" + esc(e.message || "Encoder error")); return;
      }
      st.rec = r; st.starting = false;
      stream.getAudioTracks().forEach((t) => t.addEventListener("ended", () => { if (st.rec === r) stopRec(); }));
      setMode("recording"); paintDevices();
      loop();
    }
    function loop() {
      cancelAnimationFrame(st.raf);
      const r = st.rec; if (!r) return;
      const tick = () => {
        if (st.rec !== r) return;
        let lvl = 0;
        if (r.an) { r.an.getFloatTimeDomainData(r.buf); let pk = 0, sum = 0; for (let i = 0; i < r.buf.length; i++) { const a = Math.abs(r.buf[i]); if (a > pk) pk = a; sum += r.buf[i] * r.buf[i]; } lvl = Math.sqrt(sum / r.buf.length); r.bucket = Math.max(r.bucket, pk); }
        const now = performance.now();
        if (now - r.bucketT >= 50) { r.bucketT = now; if (r.running) { const v = Math.min(1, r.bucket * 1.6); r.peaks.push(v); r.live.push(v); if (r.live.length > 400) r.live.shift(); } r.bucket = 0; }
        meter.style.width = (r.running ? Math.min(100, Math.round(Math.sqrt(lvl) * 160)) : 0) + "%";
        drawLive(r.live); paintTime();
        st.raf = requestAnimationFrame(tick);
      };
      st.raf = requestAnimationFrame(tick);
    }
    function togglePause() {
      const r = st.rec; if (!r) return;
      if (r.running) { r.acc += performance.now() - r.t0; r.running = false; try { if (r.mr && r.mr.state === "recording") r.mr.pause(); } catch (e) {} setMode("paused"); }
      else { r.t0 = performance.now(); r.running = true; try { if (r.mr && r.mr.state === "paused") r.mr.resume(); } catch (e) {} setMode("recording"); }
    }
    function addMarker() {
      if (st.rec) { st.rec.markers.push(Math.round(elapsed() / 100) / 10); paintMarks(); return; }
      if (st.mode === "playback" && st.sel) { const n = st.sel.node; n.markers = (n.markers || []).concat(Math.round(audio.currentTime * 10) / 10).sort((a, b) => a - b); save(); paintMarks(); drawPlayback(); }
    }
    async function stopRec() {
      const r = st.rec; if (!r || r.stopping) return; r.stopping = true;
      if (r.running) { r.acc += performance.now() - r.t0; r.running = false; }
      cancelAnimationFrame(st.raf); meter.style.width = "0%";
      $(".sr-name").textContent = "Saving…";
      let blob = null;
      try {
        if (r.mr) {
          await new Promise((res) => { r.mr.onstop = res; try { if (r.mr.state === "paused") r.mr.resume(); } catch (e) {} try { r.mr.requestData(); } catch (e) {} try { r.mr.stop(); } catch (e) { res(); } setTimeout(res, 4000); });
          const type = ((r.mr.mimeType || r.fmt.mime || "audio/webm").split(";")[0]) || "audio/webm";
          blob = new Blob(r.chunks, { type });
        } else blob = encodeWav(r.pcm, r.rate);
      } catch (e) { blob = null; }
      r.stream.getTracks().forEach((t) => t.stop());
      try { if (r.sp) r.sp.disconnect(); if (r.src) r.src.disconnect(); } catch (e) {}
      try { if (r.ac) r.ac.close(); } catch (e) {}
      st.rec = null;
      const dur = r.acc / 1000;
      if (!blob || !blob.size) { showMsg("<b>Nothing was recorded</b><br>The microphone didn't send any audio."); setMode(st.sel ? "playback" : "idle"); return; }
      if (/webm/.test(blob.type)) blob = await WebmFix.fix(blob, r.acc);
      const ext = r.fmt.wav ? "wav" : /mp4|m4a|aac/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : "webm";
      const res = await saveRecording(blob, "Recording." + ext, { duration: Math.round(dur * 100) / 100, markers: r.markers.slice(), peaks: downsample(r.peaks, 400) });
      if (!win.isConnected) return;
      if (!res) { setMode(st.sel ? "playback" : "idle"); return; }
      paintList(); select(res.name);
    }
    async function saveRecording(blob, name, extra) {
      const node = Object.assign({ type: "file", kind: "audio", mime: blob.type, size: blob.size, ts: Date.now(), app: "soundrec" }, extra || {});
      let id = null;
      if (window.VFS && VFS.putBlob && window.indexedDB) { try { id = await VFS.putBlob(blob); } catch (e) { id = null; } }
      if (!id) { download(blob, name); notify("Recording downloaded", "There's no room to keep it in Documents › Sound recordings, so it was downloaded instead."); return null; }
      node.blob = id;
      const kids = folder(true), finalName = uniqueName(kids, name);
      kids[finalName] = node;
      if (!save()) { delete kids[finalName]; save(); download(blob, finalName); notify("Recording downloaded", "Storage is full, so the recording was downloaded instead."); return null; }
      vfsChanged();
      try { if (window.EventLog && EventLog.add) EventLog.add("Application", "Information", "SoundRecorder", 100, "Recording saved: Documents\\Sound recordings\\" + finalName + " (" + fmtSize(blob.size) + ")."); } catch (e) {}
      return { name: finalName, node };
    }

    // ---------- playback ----------
    function stopPlayback() { try { audio.pause(); } catch (e) {} cancelAnimationFrame(st.raf); }
    async function select(name) {
      const kids = folder(false) || {}, node = kids[name]; if (!node) return;
      stopPlayback(); showMsg("");
      st.sel = { name, node }; st.dur = node.duration || 0;
      if (st.url) { URL.revokeObjectURL(st.url); st.url = null; }
      setMode("playback"); paintList(); drawPlayback();
      const blob = await blobOf(node);
      if (!st.sel || st.sel.node !== node) return;
      if (!blob) { showMsg("<b>This recording's audio isn't on this device.</b>"); return; }
      st.url = URL.createObjectURL(blob); audio.src = st.url; audio.playbackRate = st.speed;
      if (!node.peaks || !node.peaks.length || !node.duration) {
        const p = await decodePeaks(blob);
        if (p && st.sel && st.sel.node === node) { node.peaks = p.peaks; if (!node.duration) node.duration = Math.round(p.duration * 100) / 100; st.dur = node.duration; save(); drawPlayback(); paintTime(); paintList(); }
      }
    }
    audio.addEventListener("loadedmetadata", () => { if (isFinite(audio.duration) && audio.duration > 0 && !st.dur) { st.dur = audio.duration; paintTime(); } });
    audio.addEventListener("play", () => { const b = ctl.querySelector(".sr-play"); if (b) b.innerHTML = ic("pause"); playLoop(); });
    audio.addEventListener("pause", () => { const b = ctl.querySelector(".sr-play"); if (b) b.innerHTML = ic("play"); drawPlayback(); paintTime(); });
    audio.addEventListener("ended", () => { const b = ctl.querySelector(".sr-play"); if (b) b.innerHTML = ic("play"); drawPlayback(); paintTime(); });
    function playLoop() { cancelAnimationFrame(st.raf); const t = () => { if (audio.paused || st.mode !== "playback") return; drawPlayback(); paintTime(); st.raf = requestAnimationFrame(t); }; st.raf = requestAnimationFrame(t); }
    function playPause() { if (!audio.src) return; if (audio.paused) { if (audio.ended || (st.dur && audio.currentTime >= st.dur - 0.05)) audio.currentTime = 0; audio.play().catch(() => {}); } else audio.pause(); }
    // scrub on the waveform
    canvas.addEventListener("pointerdown", (e) => {
      if (st.mode !== "playback" || !(st.dur || audio.duration)) return;
      e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      const seek = (ev) => { const r = canvas.getBoundingClientRect(); const d = st.dur || audio.duration; audio.currentTime = clamp((ev.clientX - r.left) / r.width, 0, 1) * d; drawPlayback(); paintTime(); };
      seek(e);
      const mv = (ev) => seek(ev), up = () => { canvas.removeEventListener("pointermove", mv); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); };
      canvas.addEventListener("pointermove", mv); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    });

    // ---------- file actions ----------
    async function share() {
      if (!st.sel) return;
      const b = await blobOf(st.sel.node); if (!b) return;
      const f = new File([b], st.sel.name, { type: b.type || st.sel.node.mime || "audio/mp4" });
      if (navigator.canShare && navigator.share) { try { if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: st.sel.name }); return; } } catch (e) { if (e && e.name === "AbortError") return; } }
      download(b, st.sel.name); notify("Sound Recorder", "Sharing files isn't supported here, so " + esc(st.sel.name) + " was downloaded.");
    }
    async function rename() {
      if (!st.sel) return;
      const old = st.sel.name, ext = (old.match(/\.[^.]+$/) || [""])[0], base = old.slice(0, old.length - ext.length);
      const k = K();
      let v = k && k.promptText ? await k.promptText(root, "Rename", "Name", base, "Rename") : prompt("Rename", base);
      v = (v || "").replace(/[\\/:*?"<>|]+/g, " ").trim(); if (!v || v === base) return;
      const kids = folder(true), nn = uniqueName(kids, v + ext);
      kids[nn] = kids[old]; delete kids[old]; save(); vfsChanged();
      st.sel.name = nn; paintList(); $(".sr-name").textContent = nn.replace(/\.[^.]+$/, "");
    }
    async function del() {
      if (!st.sel) return;
      const name = st.sel.name, k = K();
      const ok = k && k.confirmBox ? await k.confirmBox(root, "Delete recording?", "“" + name + "” will be moved to the Recycle Bin.", "Delete", true) : confirm("Delete " + name + "?");
      if (!ok) return;
      stopPlayback(); audio.removeAttribute("src"); try { audio.load(); } catch (e) {}
      if (window.FilesHelper && FilesHelper.recycle) { try { FilesHelper.recycle(DIR.concat(name)); } catch (e) {} }
      const kids = folder(false); if (kids && kids[name]) { delete kids[name]; }
      save(); vfsChanged();
      st.sel = null; setMode("idle"); paintList();
    }
    function moreMenu(anchor) {
      const items = [
        { label: "Rename", fn: rename }, { label: "Show in folder", fn: () => { if (window.FilesHelper) FilesHelper.open(DIR.slice()); else { window.FilesStartPath = DIR.slice(); WM.open("fileexplorer"); } } },
        { label: "Open in Media Player", fn: () => { const n = st.sel && st.sel.node; if (n && window.CrMedia && CrMedia.openNode) CrMedia.openNode(st.sel.name, n); else if (n && window.VFS) VFS.openNode(st.sel.name, n); } },
        { label: "Download", fn: async () => { const b = await blobOf(st.sel.node); if (b) download(b, st.sel.name); } },
        { sep: true }, { label: "Delete", fn: del, danger: true },
      ];
      const k = K();
      if (k && k.menu) { k.menu(anchor, items.map((i) => (i.sep ? { sep: true } : { label: i.label, onClick: i.fn }))); return; }
      const m = el(`<div class="sr-menu"></div>`);
      items.forEach((i) => { if (i.sep) return; const b = el(`<button>${esc(i.label)}</button>`); b.onclick = () => { m.remove(); i.fn(); }; m.appendChild(b); });
      root.appendChild(m); setTimeout(() => document.addEventListener("pointerdown", function h(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", h, true); } }, true), 0);
    }

    // ---------- keyboard ----------
    const isTop = () => { const k = K(); return k && k.isTop ? k.isTop(win) : true; };
    const onKey = (e) => {
      if (!isTop() || !win.isConnected) return;
      const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (root.querySelector(".cr-dlg-mask")) return;
      const mod = e.ctrlKey || e.metaKey, k = (e.key || "").toLowerCase();
      if (mod && k === "r") { e.preventDefault(); if (st.rec) stopRec(); else startRec(); }
      else if (mod && k === "m") { e.preventDefault(); addMarker(); }
      else if (k === "escape" && st.rec) { e.preventDefault(); stopRec(); }
      else if (k === " " && st.rec) { e.preventDefault(); togglePause(); }
      else if (k === " " && st.mode === "playback") { e.preventDefault(); playPause(); }
      else if (k === "delete" && st.mode === "playback") { e.preventDefault(); del(); }
    };
    window.addEventListener("keydown", onKey);
    $('[data-a="list"]').onclick = () => root.classList.toggle("sr-show-list");
    const ro = new ResizeObserver(() => { root.classList.toggle("sr-narrow", root.clientWidth < 600); if (st.mode === "playback") drawPlayback(); else if (!st.rec) drawLive([]); });
    ro.observe(root);
    win.addEventListener("wm-cleanup", () => {
      window.removeEventListener("keydown", onKey); window.removeEventListener("vfs-change", onVfs); ro.disconnect();
      try { navigator.mediaDevices.removeEventListener("devicechange", onDevChange); } catch (e) {}
      if (st.rec) stopRec(); stopPlayback();
      const i = open.indexOf(api); if (i >= 0) open.splice(i, 1);
      setTimeout(() => { if (st.url) URL.revokeObjectURL(st.url); }, 1000);
    });

    paintFormats(); paintDevices(); paintList(); setMode("idle");
    const api = { win, state: st, startRec, stopRec, togglePause, addMarker, select, rename, del, audio, playPause };
    win.__sr = api; open.push(api);
    return api;
  };

  // icon + Start entry
  try {
    if (window.Icon && Icon.register) Icon.register("soundrec", `<img src="assets/soundrec.svg" alt="" draggable="false" style="width:100%;height:100%;object-fit:contain">`);
    if (window.Catalog && !Catalog.storeApps.find((a) => a.id === "soundrec")) Catalog.storeApps.push({ id: "soundrec", name: "Sound Recorder", cat: "Utilities", price: 0, builtin: "soundrec", desc: "Record sound from your microphone, add markers, and play, trim, share or rename your recordings (Documents › Sound recordings)." });
    const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (ex.indexOf("soundrec") < 0) ex.push("soundrec");
    if (window.SvPhrases && SvPhrases.phrases) Object.assign(SvPhrases.phrases, { "Sound Recorder": "Ljudinspelaren", "Recordings": "Inspelningar", "Your recordings will show up here.": "Dina inspelningar visas här." });
  } catch (e) {}

  window.SoundRecorder = {
    open: () => AppRegistry.soundrec(), recordings, folder: DIR.slice(), formats: () => FORMATS.map((f) => ({ id: f.id, label: f.label, mime: f.mime || "audio/wav", ext: f.ext })),
    windows: () => open.slice(), encodeWav,
  };
})();
