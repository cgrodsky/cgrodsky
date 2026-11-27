/* From Uiverse.io by Javierrocadev - https://uiverse.io/Javierrocadev/tough-mule-12
   MIT License, Copyright (c) Javierrocadev (Javier Roca)

   Video card for the YouTube app (youtube.local in js/sites.js). Every video thumbnail
   (.yt-thumb) is upgraded to this card as it appears: rounded card, hover fades it and
   reveals two icon buttons on the right, duration badge bottom-right.
     🕒  Watch later   ☰  Add to queue   (saved in State.data.appData.youtube)
   Classes are prefixed "uvy-" (styles in css/ytcard.css). The thumbnail keeps the
   video's own colour + channel letter as its picture. */
(function () {
  "use strict";
  const CLOCK = `<svg class="uvy-svg-icon" height="100" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 100" width="100" x="0" xmlns="http://www.w3.org/2000/svg" y="0"><path d="M50,35.7V50L60.7,60.7M82.1,50A32.1,32.1,0,1,1,50,17.9,32.1,32.1,0,0,1,82.1,50Z" stroke-width="8"></path></svg>`;
  const LIST = `<svg class="uvy-svg-icon" height="100" preserveAspectRatio="xMidYMid meet" viewBox="0 0 100 100" width="100" x="0" xmlns="http://www.w3.org/2000/svg" y="0"><path d="M17.7,28.5H82.3a5.4,5.4,0,0,0,5.4-5.4,5.4,5.4,0,0,0-5.4-5.4H17.7a5.4,5.4,0,0,0-5.4,5.4A5.4,5.4,0,0,0,17.7,28.5Z" fill-rule="evenodd"></path><path d="M82.3,44.6H17.7a5.4,5.4,0,0,0,0,10.8H82.3a5.4,5.4,0,1,0,0-10.8Z" fill-rule="evenodd"></path><path d="M50,71.5H17.7a5.4,5.4,0,0,0-5.4,5.4,5.4,5.4,0,0,0,5.4,5.4H50a5.4,5.4,0,0,0,5.4-5.4A5.4,5.4,0,0,0,50,71.5Z" fill-rule="evenodd"></path></svg>`;

  function store() {
    const d = State.data; if (!d.appData) d.appData = {};
    const y = d.appData.youtube || (d.appData.youtube = {});
    y.watchLater = y.watchLater || []; y.queue = y.queue || [];
    return y;
  }
  function videoOf(thumb) {
    const card = thumb.closest(".yt-card");
    const meta = card && card.querySelector(".yt-meta");
    const text = meta && meta.lastElementChild;               // [title, "channel • views"]
    const lines = text ? text.children : [];
    const title = (lines[0] && lines[0].textContent.trim()) || "Video";
    const channel = ((lines[1] && lines[1].textContent) || "").split("•")[0].trim();
    const len = thumb.dataset.uvyLen || (thumb.querySelector(".len:not([style])") || {}).textContent || "";
    return { title, channel, length: len.trim(), at: Date.now() };
  }
  function toast(title, body) {
    try { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("youtubeApp", "YouTube") : "", title, body, app: "YouTube" }); } catch (_) {}
  }
  function add(listName, label, v) {
    const y = store(), list = y[listName];
    if (list.some((x) => x.title === v.title && x.channel === v.channel)) { toast(label, "“" + v.title + "” is already there."); return; }
    list.unshift(v); if (list.length > 100) list.length = 100;
    State.save();
    toast(label, "Added “" + v.title + "”.");
  }

  function upgrade(thumb) {
    if (thumb.classList.contains("uvy-card")) return;
    thumb.classList.add("uvy-card");
    // Duration badge → the card's time badge (the red "NEW" badge stays as it is).
    const len = thumb.querySelector(".len:not([style])");
    if (len) { const t = len.textContent.trim(); thumb.dataset.uvyLen = t; len.classList.remove("len"); len.classList.add("uvy-card__time"); len.innerHTML = `<p></p>`; len.firstChild.textContent = t; }
    const icons = document.createElement("div");
    icons.className = "uvy-card__icons";
    icons.innerHTML = `<span role="button" tabindex="0" class="uvy-btn" data-a="later" title="Watch later" aria-label="Watch later">${CLOCK}</span><span role="button" tabindex="0" class="uvy-btn" data-a="queue" title="Add to queue" aria-label="Add to queue">${LIST}</span>`;
    const act = (e) => {
      const b = e.target.closest(".uvy-btn"); if (!b) return;
      e.preventDefault(); e.stopPropagation(); // don't open the video
      const v = videoOf(thumb);
      if (b.dataset.a === "later") add("watchLater", "Saved to Watch later", v); else add("queue", "Added to queue", v);
    };
    icons.addEventListener("click", act);
    icons.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") act(e); });
    thumb.appendChild(icons);
  }
  /* From Uiverse.io by Javierrocadev - https://uiverse.io/Javierrocadev/cowardly-starfish-70
     MIT License, Copyright (c) Javierrocadev (Javier Roca)

     Video player card over the YouTube watch-page player (.yt-video). Hover (or tap on
     touch) reveals: share · settings · close at the top, a progress bar, and
     pause · skip · volume + "time / length" at the bottom. Every button drives the
     real player underneath (its own bar is hidden). Classes prefixed "uvp-". */
  const P = {
    share: `<path d="M16.198,10.896c-0.252,0-0.455,0.203-0.455,0.455v2.396c0,0.626-0.511,1.137-1.138,1.137H5.117c-0.627,0-1.138-0.511-1.138-1.137V7.852c0-0.626,0.511-1.137,1.138-1.137h5.315c0.252,0,0.456-0.203,0.456-0.455c0-0.251-0.204-0.455-0.456-0.455H5.117c-1.129,0-2.049,0.918-2.049,2.047v5.894c0,1.129,0.92,2.048,2.049,2.048h9.488c1.129,0,2.048-0.919,2.048-2.048v-2.396C16.653,11.099,16.45,10.896,16.198,10.896z"></path><path d="M14.053,4.279c-0.207-0.135-0.492-0.079-0.63,0.133c-0.137,0.211-0.077,0.493,0.134,0.63l1.65,1.073c-4.115,0.62-5.705,4.891-5.774,5.082c-0.084,0.236,0.038,0.495,0.274,0.581c0.052,0.019,0.103,0.027,0.154,0.027c0.186,0,0.361-0.115,0.429-0.301c0.014-0.042,1.538-4.023,5.238-4.482l-1.172,1.799c-0.137,0.21-0.077,0.492,0.134,0.629c0.076,0.05,0.163,0.074,0.248,0.074c0.148,0,0.294-0.073,0.382-0.207l1.738-2.671c0.066-0.101,0.09-0.224,0.064-0.343c-0.025-0.118-0.096-0.221-0.197-0.287L14.053,4.279z"></path>`,
    gear: `<path d="M10.032,8.367c-1.112,0-2.016,0.905-2.016,2.018c0,1.111,0.904,2.014,2.016,2.014c1.111,0,2.014-0.902,2.014-2.014C12.046,9.271,11.143,8.367,10.032,8.367z M10.032,11.336c-0.525,0-0.953-0.427-0.953-0.951c0-0.526,0.427-0.955,0.953-0.955c0.524,0,0.951,0.429,0.951,0.955C10.982,10.909,10.556,11.336,10.032,11.336z"></path><path d="M17.279,8.257h-0.785c-0.107-0.322-0.237-0.635-0.391-0.938l0.555-0.556c0.208-0.208,0.208-0.544,0-0.751l-2.254-2.257c-0.199-0.2-0.552-0.2-0.752,0l-0.556,0.557c-0.304-0.153-0.617-0.284-0.939-0.392V3.135c0-0.294-0.236-0.532-0.531-0.532H8.435c-0.293,0-0.531,0.237-0.531,0.532v0.784C7.582,4.027,7.269,4.158,6.966,4.311L6.409,3.754c-0.1-0.1-0.234-0.155-0.376-0.155c-0.141,0-0.275,0.055-0.375,0.155L3.403,6.011c-0.208,0.207-0.208,0.543,0,0.751l0.556,0.556C3.804,7.622,3.673,7.935,3.567,8.257H2.782c-0.294,0-0.531,0.238-0.531,0.531v3.19c0,0.295,0.237,0.531,0.531,0.531h0.787c0.105,0.318,0.236,0.631,0.391,0.938l-0.556,0.559c-0.208,0.207-0.208,0.545,0,0.752l2.254,2.254c0.208,0.207,0.544,0.207,0.751,0l0.558-0.559c0.303,0.154,0.616,0.285,0.938,0.391v0.787c0,0.293,0.238,0.531,0.531,0.531h3.191c0.295,0,0.531-0.238,0.531-0.531v-0.787c0.322-0.105,0.636-0.236,0.938-0.391l0.56,0.559c0.208,0.205,0.546,0.207,0.752,0l2.252-2.254c0.208-0.207,0.208-0.545,0.002-0.752l-0.559-0.559c0.153-0.303,0.285-0.615,0.389-0.938h0.789c0.295,0,0.532-0.236,0.532-0.531v-3.19C17.812,8.495,17.574,8.257,17.279,8.257z M16.747,11.447h-0.653c-0.241,0-0.453,0.164-0.514,0.398c-0.129,0.496-0.329,0.977-0.594,1.426c-0.121,0.209-0.089,0.473,0.083,0.645l0.463,0.465l-1.502,1.504l-0.465-0.463c-0.174-0.174-0.438-0.207-0.646-0.082c-0.447,0.262-0.927,0.463-1.427,0.594c-0.234,0.061-0.397,0.271-0.397,0.514V17.1H8.967v-0.652c0-0.242-0.164-0.453-0.397-0.514c-0.5-0.131-0.98-0.332-1.428-0.594c-0.207-0.123-0.472-0.09-0.646,0.082l-0.463,0.463L4.53,14.381l0.461-0.463c0.169-0.172,0.204-0.434,0.083-0.643c-0.266-0.461-0.467-0.939-0.596-1.43c-0.06-0.234-0.272-0.398-0.514-0.398H3.313V9.319h0.652c0.241,0,0.454-0.162,0.514-0.397c0.131-0.498,0.33-0.979,0.595-1.43c0.122-0.208,0.088-0.473-0.083-0.645L4.53,6.386l1.503-1.504l0.46,0.462c0.173,0.172,0.437,0.204,0.646,0.083c0.45-0.265,0.931-0.464,1.433-0.597c0.233-0.062,0.396-0.274,0.396-0.514V3.667h2.128v0.649c0,0.24,0.161,0.452,0.396,0.514c0.502,0.133,0.982,0.333,1.433,0.597c0.211,0.12,0.475,0.089,0.646-0.083l0.459-0.462l1.504,1.504l-0.463,0.463c-0.17,0.171-0.202,0.438-0.081,0.646c0.263,0.448,0.463,0.928,0.594,1.427c0.061,0.235,0.272,0.397,0.514,0.397h0.651V11.447z"></path>`,
    close: `<path d="M15.898,4.045c-0.271-0.272-0.713-0.272-0.986,0l-4.71,4.711L5.493,4.045c-0.272-0.272-0.714-0.272-0.986,0s-0.272,0.714,0,0.986l4.709,4.711l-4.71,4.711c-0.272,0.271-0.272,0.713,0,0.986c0.136,0.136,0.314,0.203,0.492,0.203c0.179,0,0.357-0.067,0.493-0.203l4.711-4.711l4.71,4.711c0.137,0.136,0.314,0.203,0.494,0.203c0.178,0,0.355-0.067,0.492-0.203c0.273-0.273,0.273-0.715,0-0.986l-4.711-4.711l4.711-4.711C16.172,4.759,16.172,4.317,15.898,4.045z"></path>`,
    pause: `<path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5zm4 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z"></path>`,
    play: `<path d="M5.5 3.8v8.4c0 .4.45.65.8.43l6.6-4.2a.5.5 0 0 0 0-.86L6.3 3.37a.5.5 0 0 0-.8.43z"></path>`,
    skip: `<path d="M24.7,29.4a4.6,4.6,0,0,0-4.4-.2A4.5,4.5,0,0,0,18.1,33V67a4.5,4.5,0,0,0,2.2,3.8,4.6,4.6,0,0,0,4.4-.2L47.9,55.1V67a4.3,4.3,0,0,0,2.2,3.8,4.6,4.6,0,0,0,4.4-.2L80,53.5a4.2,4.2,0,0,0,0-7L54.5,29.4a4.6,4.6,0,0,0-4.4-.2A4.3,4.3,0,0,0,47.9,33V44.9Z"></path>`,
    vol: `<path d="M9.344,2.593c-0.253-0.104-0.547-0.045-0.743,0.15L4.486,6.887H1.313c-0.377,0-0.681,0.305-0.681,0.681v4.916c0,0.377,0.304,0.681,0.681,0.681h3.154l4.137,4.142c0.13,0.132,0.304,0.201,0.482,0.201c0.088,0,0.176-0.017,0.261-0.052c0.254-0.105,0.42-0.354,0.42-0.629L9.765,3.224C9.765,2.947,9.599,2.699,9.344,2.593z M5.233,12.003c-0.128-0.127-0.302-0.2-0.483-0.2H1.994V8.249h2.774c0.182,0,0.355-0.072,0.483-0.201l3.151-3.173l0.001,10.305L5.233,12.003z"></path><path class="uvp-wave" d="M16.434,10.007c0-2.553-1.518-4.853-3.869-5.858C12.223,4,11.821,4.16,11.672,4.506c-0.148,0.346,0.013,0.746,0.359,0.894c1.846,0.793,3.041,2.6,3.041,4.608c0,1.997-1.188,3.799-3.025,4.592c-0.346,0.149-0.505,0.551-0.356,0.895c0.112,0.258,0.362,0.411,0.625,0.411c0.091,0,0.181-0.017,0.269-0.056C14.922,14.843,16.434,12.548,16.434,10.007z"></path><path class="uvp-wave" d="M13.418,10.005c0-1.349-0.802-2.559-2.042-3.086c-0.346-0.144-0.745,0.015-0.894,0.362c-0.146,0.346,0.016,0.745,0.362,0.893c0.737,0.312,1.212,1.031,1.212,1.832c0,0.792-0.471,1.509-1.2,1.825c-0.345,0.149-0.504,0.551-0.352,0.895c0.112,0.257,0.362,0.41,0.625,0.41c0.091,0,0.181-0.017,0.27-0.057C12.625,12.545,13.418,11.339,13.418,10.005z"></path><path class="uvp-wave" d="M13.724,1.453c-0.345-0.15-0.746,0.012-0.895,0.358c-0.148,0.346,0.013,0.745,0.358,0.894c2.928,1.256,4.819,4.122,4.819,7.303c0,3.171-1.886,6.031-4.802,7.289c-0.346,0.149-0.505,0.55-0.356,0.894c0.112,0.258,0.362,0.412,0.626,0.412c0.09,0,0.181-0.019,0.269-0.056c3.419-1.474,5.626-4.826,5.626-8.54C19.368,6.282,17.152,2.923,13.724,1.453z"></path>`,
  };
  const ico = (a, box, inner, extra) => `<svg class="uvp-svg-icon${extra ? " " + extra : ""}" data-a="${a}" viewBox="${box}" role="button" tabindex="0" aria-label="${a}">${inner}</svg>`;

  function upgradePlayer(video) {
    if (video.classList.contains("uvp-host") || !video.querySelector(".vp-bar")) return;
    video.classList.add("uvp-host");
    const vbar = video.querySelector(".vp-bar");
    const vPlay = vbar.querySelector(".vp-play"), vSound = vbar.querySelector(".vp-sound"), vTrack = vbar.querySelector(".vp-track");
    const vFill = vbar.querySelector(".vp-fill"), vTime = vbar.querySelector(".vp-time"), vDur = vbar.querySelector(".vp-dur"), vFs = vbar.querySelector(".vp-fs input");
    const title = (video.closest(".yt-player") && video.closest(".yt-player").querySelector("h2") || {}).textContent || "Video";
    const card = document.createElement("div");
    card.className = "uvp-card";
    card.innerHTML = `
      <div class="uvp-up">
        ${ico("share", "0 0 20 20", P.share)}
        <div class="uvp-right">${ico("settings", "0 0 20 20", P.gear)}${ico("close", "0 0 20 20", P.close)}</div>
      </div>
      <div class="uvp-playbar"><div class="uvp-bar"><i class="uvp-fill"></i></div></div>
      <div class="uvp-down">
        <div class="uvp-down__icons">${ico("pause", "0 0 16 16", P.pause, "uvp-pause")}${ico("skip", "0 0 100 100", P.skip)}${ico("volume", "0 0 20 20", P.vol)}</div>
        <p class="uvp-time"></p>
      </div>
      <div class="uvp-menu" hidden><button data-m="fs">Full screen</button><button data-m="mute">Mute</button><button data-m="replay">Restart video</button></div>`;
    video.appendChild(card);
    const fill = card.querySelector(".uvp-fill"), timeEl = card.querySelector(".uvp-time"), pauseIc = card.querySelector('[data-a="pause"]'), volIc = card.querySelector('[data-a="volume"]'), menu = card.querySelector(".uvp-menu");

    const playing = () => /10074/.test(vPlay.innerHTML) || vPlay.textContent.indexOf("❚") >= 0;
    const muted = () => video.classList.contains("vp-muted");
    function sync() {
      fill.style.width = vFill.style.width || "0%";
      timeEl.textContent = (vTime.textContent || "0:00") + " / " + (vDur.textContent || "");
      const p = playing();
      pauseIc.innerHTML = p ? P.pause : P.play; pauseIc.setAttribute("aria-label", p ? "Pause" : "Play");
      volIc.classList.toggle("uvp-muted", muted()); volIc.setAttribute("aria-label", muted() ? "Unmute" : "Mute");
      menu.querySelector('[data-m="mute"]').textContent = muted() ? "Unmute" : "Mute";
    }
    const mo = new MutationObserver(sync);
    [vFill, vTime, vPlay].forEach((n) => mo.observe(n, { attributes: true, childList: true, characterData: true, subtree: true }));
    new MutationObserver(sync).observe(video, { attributes: true, attributeFilter: ["class"] });
    sync();

    // The player only seeks from a click on its own (now hidden) track: lay the bar out
    // invisibly for a moment so the click has a real position, then hide it again.
    function seekTo(frac) {
      vbar.style.display = "flex"; vbar.style.visibility = "hidden";
      const r = vTrack.getBoundingClientRect();
      vTrack.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.left + Math.max(0, Math.min(1, frac)) * r.width, clientY: r.top + r.height / 2 }));
      vbar.style.display = ""; vbar.style.visibility = "";
    }
    function act(a, e) {
      if (a === "pause") vPlay.click();
      else if (a === "skip") seekTo((parseFloat(vFill.style.width) || 0) / 100 + 0.1);
      else if (a === "volume") vSound.click();
      else if (a === "settings") { menu.hidden = !menu.hidden; }
      else if (a === "close") { const logo = video.closest(".yt") && video.closest(".yt").querySelector(".yt-logo"); if (logo) logo.click(); }
      else if (a === "share") {
        const text = "Watch “" + title + "” on YouTube (Windows 12)";
        if (navigator.share) navigator.share({ title, text }).catch(() => {});
        else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("Link copied", "“" + title + "” copied to the clipboard.")).catch(() => toast("Share", text));
        else toast("Share", text);
      }
    }
    card.addEventListener("click", (e) => {
      const m = e.target.closest(".uvp-menu button");
      if (m) { e.stopPropagation(); menu.hidden = true; if (m.dataset.m === "fs" && vFs) vFs.click(); else if (m.dataset.m === "mute") vSound.click(); else if (m.dataset.m === "replay") { seekTo(0); if (!playing()) vPlay.click(); } return; }
      const b = e.target.closest(".uvp-svg-icon"); if (!b) return;
      e.stopPropagation(); act(b.dataset.a, e);
    });
    card.addEventListener("keydown", (e) => { const b = e.target.closest(".uvp-svg-icon"); if (b && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); act(b.dataset.a, e); } });
    // Touch screens can't hover: a tap shows the controls for a few seconds.
    let hideT = null;
    video.addEventListener("touchstart", () => { video.classList.add("uvp-show"); clearTimeout(hideT); hideT = setTimeout(() => video.classList.remove("uvp-show"), 3500); }, { passive: true });
  }

  function scan(root) {
    const r = root.querySelectorAll ? root : document;
    r.querySelectorAll(".yt-thumb:not(.uvy-card)").forEach(upgrade);
    r.querySelectorAll(".yt-video:not(.uvp-host)").forEach(upgradePlayer);
  }

  function start() {
    scan(document);
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.classList && n.classList.contains("yt-thumb")) upgrade(n);
        else if (n.classList && n.classList.contains("vp-bar")) { const v = n.closest(".yt-video"); if (v) upgradePlayer(v); }
        else if (n.querySelector && (n.querySelector(".yt-thumb") || n.querySelector(".yt-video .vp-bar"))) scan(n);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  window.YTCard = { list: (name) => store()[name] || [] };
})();
