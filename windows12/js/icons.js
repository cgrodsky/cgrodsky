/* Icon system. Renders assets/<key>.png if present, else a clean letter-avatar (no emoji).
   Drop an image named after the key into windows12/assets/ and it appears automatically. */
(function () {
  "use strict";
  let n = 0;

  // Each entry is a tasteful 2-stop gradient pair for richer fallback icons.
  const palette = [
    ["#2b8cff", "#0052cc"], ["#9b6bff", "#6a2cff"], ["#ff6a6a", "#d61f1f"],
    ["#42d392", "#1f9d57"], ["#ffb02e", "#f5820b"], ["#22c1c3", "#0a8a8c"],
    ["#c061ff", "#8a1fd0"], ["#5a7bff", "#2942d6"], ["#ff7eb3", "#e01f6b"],
    ["#34d0e6", "#0e8fb0"],
  ];
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function colorFor(s) { return palette[hash(s) % palette.length][0]; }
  function gradientFor(s) { const p = palette[hash(s) % palette.length]; return `linear-gradient(135deg, ${p[0]}, ${p[1]})`; }
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
    const grad = gradientFor(String(label || key || "x"));
    return `<span class="ico-wrap" style="width:${size}px;height:${size}px">` +
      `<img class="ico-img" src="assets/${safeKey}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` +
      `<span class="ico-fallback" style="display:none;background:${grad};font-size:${Math.round(size * 0.38)}px;width:${size}px;height:${size}px">${ini}</span>` +
      `</span>`;
  }

  window.Icon = {
    mini: (key, label) => box(key, label, 26),
    md: (key, label) => box(key, label, 40),
    big: (key, label) => box(key, label, 64),
    box,
    colorFor,
    gradientFor,
  };
})();
