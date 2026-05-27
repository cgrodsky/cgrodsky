/* Icon system. Renders assets/<key>.png if present, else a clean letter-avatar (no emoji).
   Drop an image named after the key into windows12/assets/ and it appears automatically. */
(function () {
  "use strict";
  let n = 0;

  const palette = ["#0067c0", "#7b5cff", "#e53935", "#43a047", "#fb8c00", "#00897b", "#8e24aa", "#3949ab", "#d81b60", "#00acc1"];
  function colorFor(s) {
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }
  function initials(label, key) {
    const s = String(label || key || "?");
    const words = s.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return s.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  }

  function box(key, label, size) {
    size = size || 28;
    const safeKey = String(key || label || "icon").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const ini = initials(label, key);
    const color = colorFor(String(label || key || "x"));
    return `<span class="ico-wrap" style="width:${size}px;height:${size}px">` +
      `<img class="ico-img" src="assets/${safeKey}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` +
      `<span class="ico-fallback" style="display:none;background:${color};font-size:${Math.round(size * 0.4)}px;width:${size}px;height:${size}px">${ini}</span>` +
      `</span>`;
  }

  window.Icon = {
    mini: (key, label) => box(key, label, 26),
    md: (key, label) => box(key, label, 40),
    big: (key, label) => box(key, label, 64),
    box,
    colorFor,
  };
})();
