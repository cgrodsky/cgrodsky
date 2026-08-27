/* Icon system. Renders assets/<key>.png if present, else a clean letter-avatar (no emoji).
   Drop an image named after the key into windows12/assets/ and it appears automatically. */
(function () {
  "use strict";
  let n = 0;
  // Bump when an assets/<key>.png icon changes — image URLs aren't covered by index.html's ?v=
  const ICONV = "10";

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

  // Alias one icon key to another (e.g. the store's "app_3" -> its builtin "maps").
  const aliases = {};
  function alias(from, to) { aliases[String(from).toLowerCase().replace(/[^a-z0-9_-]/g, "")] = String(to).toLowerCase().replace(/[^a-z0-9_-]/g, ""); }
  // Icons that have a classic variant when the Windows XP theme is enabled.
  const XP_ICONS = { paint: "paint_xp", outlook: "outlook_xp" };
  function xpOn() { try { return !!(window.State && State.data.desktop && State.data.desktop.xpTheme); } catch (e) { return false; } }
  function resolveKey(k) { let key = k; if (aliases[key]) key = aliases[key]; if (xpOn() && XP_ICONS[key]) key = XP_ICONS[key]; return key; }

  function getCustomSrc(key) {
    try { return (window.State && State.data.appData && State.data.appData.customIcons && State.data.appData.customIcons[key]) || null; }
    catch (e) { return null; }
  }

  function box(key, label, size) {
    size = size || 28;
    const safeKey = resolveKey(String(key || label || "icon").toLowerCase().replace(/[^a-z0-9_-]/g, ""));
    const customSrc = getCustomSrc(safeKey);
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
    return `<span class="ico-wrap" style="width:${size}px;height:${size}px${custom[safeKey] || customSrc ? ";box-shadow:none" : ""}">` +
      `<img class="ico-img" src="${customSrc || "assets/" + safeKey + ".png?v=" + ICONV}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` +
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

  // Dark glossy bank building with blue neon edges (matches the uploaded icon).
  register("bank", `<svg viewBox="0 0 128 116" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3550"/><stop offset="1" stop-color="#0a0f1e"/></linearGradient>
      <filter id="bkglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g stroke="#7aa7ff" stroke-width="2.4" filter="url(#bkglow)" stroke-linejoin="round">
      <polygon points="10,56 64,12 118,56" fill="url(#bkg)"/>
      <rect x="26" y="60" width="14" height="30" fill="url(#bkg)"/>
      <rect x="57" y="60" width="14" height="30" fill="url(#bkg)"/>
      <rect x="88" y="60" width="14" height="30" fill="url(#bkg)"/>
      <rect x="16" y="90" width="96" height="9" rx="2" fill="url(#bkg)"/>
      <rect x="10" y="100" width="108" height="10" rx="2" fill="url(#bkg)"/>
    </g>
    <g stroke="#cfe0ff" stroke-width="2" fill="none" opacity="0.9">
      <rect x="52" y="30" width="24" height="14" rx="1"/><line x1="56" y1="34" x2="56" y2="42"/><line x1="64" y1="34" x2="64" y2="42"/><line x1="72" y1="34" x2="72" y2="42"/>
    </g>
  </svg>`);

  // Neon-blue Discord mark (stylized to match the uploaded icon).
  register("discord", `<svg viewBox="0 0 128 104" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="dcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3fae"/><stop offset="1" stop-color="#10112e"/></linearGradient>
      <filter id="dcglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <path d="M30 18 Q64 8 98 18 Q120 44 112 82 L96 94 L88 82 Q64 90 40 82 L32 94 L16 82 Q8 44 30 18 Z"
      fill="url(#dcg)" stroke="#6f7bff" stroke-width="3" stroke-linejoin="round" filter="url(#dcglow)"/>
    <circle cx="48" cy="56" r="11" fill="#0c0d24"/><circle cx="48" cy="56" r="6.5" fill="#aab4ff" filter="url(#dcglow)"/>
    <circle cx="80" cy="56" r="11" fill="#0c0d24"/><circle cx="80" cy="56" r="6.5" fill="#aab4ff" filter="url(#dcglow)"/>
  </svg>`);

  // Copilot — gradient orb with a glowing core.
  register("copilot", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cpg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#19c2ff"/><stop offset=".5" stop-color="#7b5cff"/><stop offset="1" stop-color="#19e3a5"/></linearGradient>
      <radialGradient id="cpc" cx="50%" cy="50%"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#aedfff"/><stop offset="1" stop-color="#2f7bff"/></radialGradient>
      <filter id="cpglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="64" cy="64" r="56" fill="none" stroke="url(#cpg)" stroke-width="10" filter="url(#cpglow)"/>
    <circle cx="64" cy="64" r="28" fill="url(#cpc)" filter="url(#cpglow)"/>
  </svg>`);

  // Duolingo — floating Duo owl (taskbar / general).
  register("duolingo", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="24" cy="96" rx="8" ry="3.2" fill="#ffc800" transform="rotate(-25 24 96)"/>
    <ellipse cx="100" cy="112" rx="7" ry="2.8" fill="#ffc800" transform="rotate(25 100 112)"/>
    <path d="M70 18 Q44 16 32 40 Q24 52 28 66 Q22 78 32 86 Q40 94 54 92 Q68 100 84 94 Q96 96 102 86 Q108 72 100 64 Q108 50 100 40 Q100 22 70 18 Z" fill="#58cc02"/>
    <path d="M30 60 Q22 58 22 50 Q24 44 32 46 Z" fill="#58cc02"/>
    <circle cx="50" cy="52" r="14" fill="#fff"/>
    <circle cx="80" cy="52" r="14" fill="#fff"/>
    <circle cx="52" cy="56" r="5" fill="#1b1a1a"/>
    <circle cx="80" cy="56" r="5" fill="#1b1a1a"/>
    <path d="M58 70 Q64 66 70 70 L66 82 Q64 84 62 82 Z" fill="#ffc800" stroke="#e68a00" stroke-width=".8"/>
    <path d="M52 84 Q64 92 76 84" stroke="#1b1a1a" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".35"/>
  </svg>`);

  // Duolingo (app icon) — framed head, used on home screen + start search.
  register("duolingo_app", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" fill="#58cc02"/>
    <path d="M14 30 Q46 18 64 22 Q82 18 114 30" fill="#7dd54a"/>
    <circle cx="44" cy="58" r="22" fill="#fff"/>
    <circle cx="84" cy="58" r="22" fill="#fff"/>
    <ellipse cx="38" cy="58" rx="7" ry="11" fill="#1b1a1a"/>
    <ellipse cx="78" cy="58" rx="7" ry="11" fill="#1b1a1a"/>
    <circle cx="35" cy="54" r="2.5" fill="#fff"/>
    <circle cx="75" cy="54" r="2.5" fill="#fff"/>
    <path d="M52 80 Q64 74 76 80 L70 98 Q64 102 58 98 Z" fill="#ffc800" stroke="#e68a00" stroke-width="1.2"/>
  </svg>`);

  // Swedish course flag for Duolingo.
  register("duo_sv", `<svg viewBox="0 0 128 96" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="96" fill="#006aa7"/>
    <rect x="40" y="0" width="16" height="96" fill="#fecc00"/>
    <rect x="0" y="40" width="128" height="16" fill="#fecc00"/>
  </svg>`);

  // Japanese course flag for Duolingo.
  register("duo_ja", `<svg viewBox="0 0 128 96" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="96" fill="#f4f4f4"/>
    <circle cx="64" cy="48" r="28" fill="#fc4c4c"/>
  </svg>`);

  // Sad Duo — shown in the "don't quit your lesson" modal.
  register("duo_sad", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="64" cy="120" rx="36" ry="3.5" fill="#000" opacity=".1"/>
    <path d="M30 32 Q30 14 50 14 L78 14 Q98 14 98 32 L98 96 Q98 114 78 114 L50 114 Q30 114 30 96 Z" fill="#58cc02"/>
    <path d="M30 30 Q32 12 46 22" fill="#58cc02"/>
    <path d="M98 30 Q96 12 82 22" fill="#58cc02"/>
    <ellipse cx="46" cy="113" rx="10" ry="4.5" fill="#ffc800"/>
    <ellipse cx="82" cy="113" rx="10" ry="4.5" fill="#ffc800"/>
    <circle cx="50" cy="52" r="14" fill="#fff"/>
    <circle cx="78" cy="52" r="14" fill="#fff"/>
    <circle cx="50" cy="50" r="6" fill="#1b1a1a"/>
    <circle cx="78" cy="50" r="6" fill="#1b1a1a"/>
    <circle cx="52" cy="48" r="2" fill="#fff"/>
    <circle cx="80" cy="48" r="2" fill="#fff"/>
    <path d="M38 60 Q50 68 62 60 L62 66 Q50 72 38 66 Z" fill="#4cc6f5"/>
    <path d="M66 60 Q78 68 90 60 L90 66 Q78 72 66 66 Z" fill="#4cc6f5"/>
    <path d="M58 62 Q64 58 70 62 L66 74 Q64 76 62 74 Z" fill="#ffc800" stroke="#e68a00" stroke-width=".8"/>
    <path d="M52 92 Q64 88 76 92" stroke="#1b1a1a" stroke-width="2" fill="none" stroke-linecap="round" opacity=".35"/>
  </svg>`);

  // Super Duolingo — holographic gradient Duo (taskbar/home when tier=super).
  register("duolingo_super", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="dsg" x1=".1" y1="0" x2=".9" y2="1">
        <stop offset="0" stop-color="#3ce0a3"/>
        <stop offset=".35" stop-color="#1cb0f6"/>
        <stop offset=".7" stop-color="#a06cff"/>
        <stop offset="1" stop-color="#ff5cb1"/>
      </linearGradient>
    </defs>
    <ellipse cx="74" cy="112" rx="7" ry="3" fill="#ff5cb1"/>
    <path d="M70 18 Q44 16 32 40 Q24 52 28 66 Q22 78 32 86 Q40 94 54 92 Q68 100 84 94 Q96 96 102 86 Q108 72 100 64 Q108 50 100 40 Q100 22 70 18 Z" fill="url(#dsg)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="52" r="12" fill="rgba(255,255,255,.92)"/>
    <circle cx="80" cy="52" r="12" fill="rgba(255,255,255,.92)"/>
    <circle cx="50" cy="55" r="3.4" fill="#1b1a1a"/>
    <circle cx="80" cy="55" r="3.4" fill="#1b1a1a"/>
    <path d="M52 78 Q64 88 76 78" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".9"/>
  </svg>`);

  // Duolingo Max — pink/purple gradient Duo (taskbar/home when tier=max).
  register("duolingo_max", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="dmg" x1=".1" y1="0" x2=".9" y2="1">
        <stop offset="0" stop-color="#a06cff"/>
        <stop offset=".55" stop-color="#c061ff"/>
        <stop offset="1" stop-color="#ff5cb1"/>
      </linearGradient>
    </defs>
    <ellipse cx="74" cy="112" rx="7" ry="3" fill="#c061ff"/>
    <path d="M70 18 Q44 16 32 40 Q24 52 28 66 Q22 78 32 86 Q40 94 54 92 Q68 100 84 94 Q96 96 102 86 Q108 72 100 64 Q108 50 100 40 Q100 22 70 18 Z" fill="url(#dmg)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="50" cy="52" r="12" fill="rgba(255,255,255,.92)"/>
    <circle cx="80" cy="52" r="12" fill="rgba(255,255,255,.92)"/>
    <circle cx="50" cy="55" r="3.4" fill="#1b1a1a"/>
    <circle cx="80" cy="55" r="3.4" fill="#1b1a1a"/>
    <path d="M52 78 Q64 88 76 78" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".9"/>
  </svg>`);

  // English course flag (US, emoji style) for Duolingo.
  register("duo_en", `<svg viewBox="0 0 128 96" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="96" fill="#f5f5f5"/>
    <g fill="#ff5757">
      <rect y="0"  width="128" height="8"/>
      <rect y="16" width="128" height="8"/>
      <rect y="32" width="128" height="8"/>
      <rect y="48" width="128" height="8"/>
      <rect y="64" width="128" height="8"/>
      <rect y="80" width="128" height="8"/>
    </g>
    <rect width="56" height="40" fill="#1ea7f0"/>
    <g fill="#fff">
      <circle cx="12" cy="12" r="3.4"/><circle cx="28" cy="12" r="3.4"/><circle cx="44" cy="12" r="3.4"/>
      <circle cx="12" cy="28" r="3.4"/><circle cx="28" cy="28" r="3.4"/><circle cx="44" cy="28" r="3.4"/>
    </g>
  </svg>`);

  // Microsoft 365 — folded ribbon in Office orange/red.
  register("ms365", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="m3a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb56b"/><stop offset="1" stop-color="#d83b01"/></linearGradient>
      <linearGradient id="m3b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a3a"/><stop offset="1" stop-color="#9c1a01"/></linearGradient>
    </defs>
    <path d="M18 36 L64 16 L110 36 L110 96 L64 116 L18 96 Z" fill="url(#m3a)"/>
    <path d="M64 16 L64 116 L18 96 L18 36 Z" fill="url(#m3b)" opacity=".85"/>
    <text x="68" y="80" text-anchor="middle" fill="#fff" font-family="Segoe UI, sans-serif" font-weight="800" font-size="26" letter-spacing="-1">365</text>
  </svg>`);

  register("netflix", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="22" fill="#000"/>
    <path fill="#e50914" d="M44 22 L44 106 C49.5 105.3 55 104.7 60.5 104.3 L60.5 62 L78 106 C84 106 90 106.4 96 107 L96 22 L80 22 L80 60 L64.5 22 Z"/>
  </svg>`);

  // Calculator uses an animated gif; box() tries assets/calculator.png first,
  // fails (none), then falls back to this registered markup.
  register("calculator", `<img src="assets/calculator.gif" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:6px">`);

  register("word", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="20" width="112" height="88" rx="10" fill="#fff"/>
    <path d="M8 30 A10 10 0 0 1 18 20 H70 V108 H18 A10 10 0 0 1 8 98 Z" fill="#2b579a"/>
    <path d="M24 48 L33 80 L42 56 L51 80 L60 48" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M80 44 H108 M80 60 H108 M80 76 H108 M80 92 H100" stroke="#2b579a" stroke-width="4" stroke-linecap="round"/>
  </svg>`);

  register("winflag", `<svg viewBox="0 0 44 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="wfg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b82f6"/><stop offset=".5" stop-color="#a855f7"/><stop offset="1" stop-color="#e879f9"/>
    </linearGradient></defs>
    <rect x="1" y="1" width="19" height="19" rx="5" fill="url(#wfg)"/>
    <rect x="24" y="1" width="19" height="19" rx="5" fill="url(#wfg)"/>
    <rect x="1" y="24" width="19" height="19" rx="5" fill="url(#wfg)"/>
    <rect x="24" y="24" width="19" height="19" rx="5" fill="url(#wfg)"/>
  </svg>`);

  register("searchglass", `<svg viewBox="0 0 44 44" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sgl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b6f0ff"/><stop offset="1" stop-color="#7fd9ff"/></linearGradient></defs>
    <circle cx="18" cy="17" r="14" fill="url(#sgl)"/>
    <line x1="28" y1="27" x2="39" y2="38" stroke="#1e9fe0" stroke-width="7" stroke-linecap="round"/>
  </svg>`);

  register("mclauncher", `<svg viewBox="0 0 32 32" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="28" height="10" fill="#6aa84f"/><rect x="2" y="2" width="28" height="4" fill="#7cbd5c"/>
    <rect x="2" y="12" width="28" height="18" fill="#8a6d4b"/>
    <rect x="6" y="16" width="5" height="5" fill="#7a5d3f"/><rect x="15" y="21" width="5" height="5" fill="#7a5d3f"/><rect x="22" y="15" width="5" height="5" fill="#7a5d3f"/><rect x="9" y="24" width="4" height="4" fill="#7a5d3f"/>
  </svg>`);

  register("outlook", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="46" y="20" width="66" height="88" rx="6" fill="#fff"/>
    <path d="M62 40 H104 M62 56 H104 M62 72 H104 M62 88 H92" stroke="#0f6cbd" stroke-width="5" stroke-linecap="round"/>
    <rect x="8" y="34" width="60" height="60" rx="12" fill="#0f6cbd"/>
    <ellipse cx="38" cy="64" rx="17" ry="20" fill="none" stroke="#fff" stroke-width="8"/>
  </svg>`);

  register("onenote", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="14" width="80" height="100" rx="8" fill="#fff"/>
    <path d="M40 40 V88 M40 40 L64 88 M64 40 V88" stroke="#7719aa" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="86" y="14" width="26" height="100" rx="8" fill="#7719aa"/>
    <path d="M99 34 V54 M99 66 V86" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
  </svg>`);

  register("clock", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="26" fill="#1f2430"/>
    <circle cx="64" cy="64" r="42" fill="none" stroke="#3a4152" stroke-width="7"/>
    <circle cx="64" cy="64" r="42" fill="none" stroke="#4c8dff" stroke-width="7" stroke-linecap="round" stroke-dasharray="180 300" transform="rotate(-90 64 64)"/>
    <path d="M64 40 V64 L80 74" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`);

  register("forms", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="22" y="14" width="66" height="100" rx="9" fill="#f6f4f8"/>
    <rect x="22" y="14" width="66" height="100" rx="9" fill="none" stroke="#e0dbe6" stroke-width="2"/>
    <path d="M35 42 H76 M35 58 H76 M35 74 H62" stroke="#7719aa" stroke-width="4" stroke-linecap="round"/>
    <circle cx="90" cy="90" r="26" fill="#c31a6c"/>
    <path d="M79 90 l7 8 l15 -16" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`);

  register("excel", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="20" width="112" height="88" rx="10" fill="#fff"/>
    <path d="M8 30 A10 10 0 0 1 18 20 H70 V108 H18 A10 10 0 0 1 8 98 Z" fill="#217346"/>
    <path d="M24 44 L40 84 M40 44 L24 84" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
    <path d="M80 44 H108 M80 60 H108 M80 76 H108 M80 92 H108 M94 40 V96 M80 40 V96" stroke="#217346" stroke-width="3" stroke-linecap="round" opacity=".6"/>
  </svg>`);

  register("auth0", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="24" fill="#000"/>
    <path d="M64 22 L82 22 L88 40 Q92 62 64 82 Q36 62 40 40 L46 22 L64 22 Z" fill="#eb5424"/>
    <path d="M64 30 L64 74 Q46 60 50 42 L54 30 Z" fill="#fff" opacity=".18"/>
  </svg>`);

  register("messenger", `<svg viewBox="0 0 128 128" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="msgr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f9bff"/><stop offset="1" stop-color="#0067c0"/></linearGradient></defs>
    <rect width="128" height="128" rx="26" fill="url(#msgr)"/>
    <path d="M32 34h64a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H58l-18 16v-16h-8a8 8 0 0 1-8-8V42a8 8 0 0 1 8-8Z" fill="#fff"/>
    <circle cx="50" cy="59" r="5" fill="#0067c0"/><circle cx="68" cy="59" r="5" fill="#0067c0"/><circle cx="86" cy="59" r="5" fill="#0067c0"/>
  </svg>`);

  register("taskmanager", `<svg viewBox="0 0 24 24" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3" width="20" height="18" rx="2.5" fill="#1f6feb"/><rect x="5" y="13" width="3" height="5" rx="1" fill="#fff"/><rect x="10" y="9" width="3" height="9" rx="1" fill="#fff"/><rect x="15" y="6" width="3" height="12" rx="1" fill="#fff"/></svg>`);
  register("recyclebin", `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7h16" stroke="#c7d0e6" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="#c7d0e6" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M6 7l1 12a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8L18 7Z" fill="#6c7a92" stroke="#c7d0e6" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M10 10.5v6M14 10.5v6" stroke="#e9edf6" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`);

  register("files", `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="5" fill="#0b6bcb"/>
    <path stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 9V4a1 1 0 0 0-1-1H8.914a1 1 0 0 0-.707.293L4.293 7.207A1 1 0 0 0 4 7.914V20a1 1 0 0 0 1 1h6M9 3v4a1 1 0 0 1-1 1H4m11 13a11.426 11.426 0 0 1-3.637-3.99A11.139 11.139 0 0 1 10 11.833L15 10l5 1.833a11.137 11.137 0 0 1-1.363 5.176A11.425 11.425 0 0 1 15.001 21Z"/>
  </svg>`);

  function cleanDomain(d) { return String(d || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim(); }
  function googleLogoUrl(domain, size) { const d = cleanDomain(domain); return d ? "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(d) + "&sz=" + (size >= 128 ? 128 : 64) : null; }
  // Default logo URL used for inline spots (store rows etc.) — keyless & instant.
  function brandLogoUrl(domain, size) { return googleLogoUrl(domain, size); }

  // Full Brandfetch brand fetch (works from the browser; CORS is open). Returns
  // the raw logo variants so the picker can show icon/wordmark/light/dark, etc.
  const brandCache = {};
  async function fetchBrand(domain) {
    const d = cleanDomain(domain); if (!d) return null;
    if (brandCache[d]) return brandCache[d];
    const key = window.BRANDFETCH_API_KEY, base = window.BRANDFETCH_BASE || "https://api.brandfetch.io/v2";
    if (!key) return null;
    try {
      const r = await fetch(base + "/brands/" + encodeURIComponent(d), { headers: { Authorization: "Bearer " + key } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      const out = { name: j.name || d, domain: d, logos: [] };
      (j.logos || []).forEach((lg) => {
        (lg.formats || []).forEach((f) => {
          if (f.src && /^https?:/.test(f.src)) out.logos.push({ src: f.src, label: (lg.type || "logo") + (lg.theme ? " · " + lg.theme : "") + " · " + (f.format || ""), format: f.format });
        });
      });
      brandCache[d] = out;
      return out;
    } catch (_) { return null; }
  }
  function setCustomIcon(key, url) {
    try {
      if (!State.data.appData) State.data.appData = {};
      if (!State.data.appData.customIcons) State.data.appData.customIcons = {};
      const k = String(key || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (url) State.data.appData.customIcons[k] = url; else delete State.data.appData.customIcons[k];
      State.save();
    } catch (_) {}
  }

  // Icon picker: search any brand via Brandfetch and apply its logo.
  function pickIcon(key, label, onDone) {
    document.querySelectorAll(".icp-ov").forEach((m) => m.remove());
    const ov = el(`<div class="icp-ov"><div class="icp">
      <div class="icp-head"><b>Change icon${label ? " · " + label : ""}</b><button class="icp-x" aria-label="Close">&times;</button></div>
      <div class="icp-search"><span>🔎</span><input class="icp-in" placeholder="Search a brand or domain (e.g. apple.com)" autofocus></div>
      <div class="icp-hint">Powered by Brandfetch · results appear as you type</div>
      <div class="icp-grid"></div>
      <div class="icp-foot"><button class="icp-reset">Reset to default</button></div>
    </div></div>`);
    const input = ov.querySelector(".icp-in"), grid = ov.querySelector(".icp-grid");
    const close = () => ov.remove();
    ov.querySelector(".icp-x").onclick = close;
    ov.onclick = (e) => { if (e.target === ov) close(); };
    ov.querySelector(".icp-reset").onclick = () => { setCustomIcon(key, null); close(); onDone && onDone(); };

    const apply = (url) => { setCustomIcon(key, url); close(); onDone && onDone(); };
    function logoTile(src, label) {
      const t = el(`<button class="icp-tile" title="${label || ""}"><img src="${src}" alt="" onerror="this.closest('.icp-tile').remove()"><span>${label || ""}</span></button>`);
      t.onclick = () => apply(src);
      return t;
    }
    // Fallback tile (keyless favicon) used when the Brand API has nothing.
    function faviconTile(domain, name) {
      const t = el(`<button class="icp-tile" title="${name || domain}"><img alt=""><span>${name || domain}</span></button>`);
      const img = t.querySelector("img");
      const chain = [googleLogoUrl(domain, 128), "https://icons.duckduckgo.com/ip3/" + cleanDomain(domain) + ".ico"];
      let ci = 0; img.onerror = () => { ci++; if (ci < chain.length) img.src = chain[ci]; else t.remove(); }; img.src = chain[0];
      t.onclick = () => apply(chain[ci] || googleLogoUrl(domain, 128));
      return t;
    }
    const SUGG = [["apple.com", "Apple"], ["google.com", "Google"], ["microsoft.com", "Microsoft"], ["spotify.com", "Spotify"], ["netflix.com", "Netflix"], ["youtube.com", "YouTube"], ["nvidia.com", "NVIDIA"], ["amazon.com", "Amazon"], ["discord.com", "Discord"], ["figma.com", "Figma"], ["minecraft.net", "Minecraft"], ["doordash.com", "DoorDash"]];
    function showSuggestions() { grid.innerHTML = ""; SUGG.forEach((d) => grid.appendChild(faviconTile(d[0], d[1]))); }

    let reqId = 0;
    async function search(query) {
      const my = ++reqId;
      const base = query.replace(/\s+/g, "").toLowerCase();
      const domain = /\./.test(base) ? base : base + ".com";
      grid.innerHTML = `<div class="icp-loading">Searching “${cleanDomain(domain)}”…</div>`;
      const brand = await fetchBrand(domain);
      if (my !== reqId) return;
      grid.innerHTML = "";
      if (brand && brand.logos.length) { brand.logos.forEach((l) => grid.appendChild(logoTile(l.src, l.label))); }
      else { grid.appendChild(faviconTile(domain, cleanDomain(domain))); if (!/\./.test(base)) [base + ".net", base + ".io", base + ".org"].forEach((d) => grid.appendChild(faviconTile(d, d))); }
    }
    let dt = null;
    input.oninput = () => { clearTimeout(dt); const v = input.value.trim(); if (!v) { reqId++; showSuggestions(); return; } dt = setTimeout(() => search(v), 350); };
    input.onkeydown = (e) => { if (e.key === "Enter") { clearTimeout(dt); const v = input.value.trim(); if (v) search(v); } };
    showSuggestions();
    (document.getElementById("screen") || document.body).appendChild(ov);
    setTimeout(() => input.focus(), 30);
  }

  window.Icon = {
    mini: (key, label) => box(key, label, 26),
    md: (key, label) => box(key, label, 40),
    big: (key, label) => box(key, label, 64),
    box,
    register,
    alias,
    colorFor,
    gradientFor,
    brandLogoUrl,
    setCustomIcon,
    pickIcon,
  };
})();
