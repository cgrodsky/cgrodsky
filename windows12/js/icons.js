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

  // Hand-drawn SVG icons used as the fallback for specific keys (until/unless
  // an assets/<key>.png is provided, which always takes precedence).
  const custom = {};
  function register(key, svg) { custom[String(key).toLowerCase().replace(/[^a-z0-9_-]/g, "")] = svg; }

  function box(key, label, size) {
    size = size || 28;
    const safeKey = String(key || label || "icon").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    let fallbackInner, fallbackStyle, cls = "ico-fallback";
    if (custom[safeKey]) {
      fallbackInner = custom[safeKey];
      fallbackStyle = `display:none;background:transparent;box-shadow:none;width:${size}px;height:${size}px`;
      cls += " ico-custom";
    } else {
      fallbackInner = initials(label, key);
      const grad = gradientFor(String(label || key || "x"));
      fallbackStyle = `display:none;background:${grad};font-size:${Math.round(size * 0.38)}px;width:${size}px;height:${size}px`;
    }
    return `<span class="ico-wrap" style="width:${size}px;height:${size}px${custom[safeKey] ? ";box-shadow:none" : ""}">` +
      `<img class="ico-img" src="assets/${safeKey}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` +
      `<span class="${cls}" style="${fallbackStyle}">${fallbackInner}</span>` +
      `</span>`;
  }

  // Neon-red YouTube play button (matches the uploaded logo).
  register("youtubeapp", `<svg viewBox="0 0 128 96" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ytbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff1f1f"/><stop offset="1" stop-color="#8a0000"/></linearGradient>
      <filter id="ytglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect x="6" y="6" width="116" height="84" rx="22" fill="url(#ytbg)" stroke="#ff5a5a" stroke-width="4" filter="url(#ytglow)"/>
    <rect x="6" y="6" width="116" height="84" rx="22" fill="none" stroke="#ff2a2a" stroke-width="2"/>
    <path d="M52 32 L86 48 L52 64 Z" fill="#fff" stroke="#ff6a6a" stroke-width="3" stroke-linejoin="round" filter="url(#ytglow)"/>
  </svg>`);

  window.Icon = {
    mini: (key, label) => box(key, label, 26),
    md: (key, label) => box(key, label, 40),
    big: (key, label) => box(key, label, 64),
    box,
    register,
    colorFor,
    gradientFor,
  };
})();
