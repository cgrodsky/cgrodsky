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
  function scan(root) { (root.querySelectorAll ? root : document).querySelectorAll(".yt-thumb:not(.uvy-card)").forEach(upgrade); }

  function start() {
    scan(document);
    new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.classList && n.classList.contains("yt-thumb")) upgrade(n); else if (n.querySelector && n.querySelector(".yt-thumb")) scan(n);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  window.YTCard = { list: (name) => store()[name] || [] };
})();
