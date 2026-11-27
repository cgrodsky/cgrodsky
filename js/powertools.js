/* Power tools — Clipboard history (Win+V / Ctrl+Alt+V) and the Emoji panel (Win+. / Win+; / Ctrl+Alt+.)
   One Windows 11-style flyout with five tabs: Emoji, Kaomoji, Symbols, Stickers, Clipboard.

   What is real:
   - Every copy / cut anywhere in the page is captured (selection text, or what an app put on the
     clipboard with clipboardData.setData), plus copies made through navigator.clipboard.writeText /
     write (wrapped here), so the app's own "Copy" buttons land in the history too.
   - History lives in State.data.appData.clipboard (last 25 + pinned items), survives reloads.
   - Clicking an item / emoji inserts it at the caret of the field you were typing in (input,
     textarea or contenteditable) and also writes it to the real system clipboard.
   - Picker buttons cancel pointerdown/mousedown so the field never loses focus or its caret (iPad).
   Data: js/pt-emojidata.js (Unicode emoji-test 15.1 + CLDR keywords, ~1,900 emoji). */
(function () {
  "use strict";
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const save = () => { try { State.save(); } catch (_) {} };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function ad() { const d = S(); if (!d.appData) d.appData = {}; return d.appData; }
  function cbStore() {
    const a = ad(); const c = a.clipboard || (a.clipboard = { enabled: true, items: [] });
    if (!Array.isArray(c.items)) c.items = [];
    if (c.enabled == null) c.enabled = true;
    return c;
  }
  function epStore() {
    const a = ad(); const e = a.emojiPanel || (a.emojiPanel = { recent: [], tone: 0, tab: "emoji" });
    if (!Array.isArray(e.recent)) e.recent = [];
    return e;
  }
  const MAX_ITEMS = 25;
  const MAX_TEXT = 20000;
  const MAX_IMG = 400000;   // data-URL characters (~300 KB image)

  // =====================================================================
  //  CAPTURE
  // =====================================================================
  let suppress = 0;   // >0 while we write to the real clipboard ourselves
  function record(text) {
    if (suppress || typeof text !== "string") return;
    if (!(window.State && State.data)) return;
    const c = cbStore(); if (!c.enabled) return;
    if (!text.trim()) return;
    if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
    const i = c.items.findIndex((x) => x.type === "text" && x.text === text);
    let item;
    if (i >= 0) { item = c.items.splice(i, 1)[0]; item.ts = Date.now(); }
    else item = { id: uid(), type: "text", text, ts: Date.now(), pinned: false };
    c.items.unshift(item); trimItems(c); save(); refreshOpen("clipboard");
  }
  function recordImage(dataUrl, w, h) {
    if (suppress || !dataUrl || dataUrl.length > MAX_IMG) return;
    const c = cbStore(); if (!c.enabled) return;
    const i = c.items.findIndex((x) => x.type === "image" && x.src === dataUrl);
    if (i >= 0) c.items.splice(i, 1);
    c.items.unshift({ id: uid(), type: "image", src: dataUrl, w: w || 0, h: h || 0, ts: Date.now(), pinned: false });
    trimItems(c); save(); refreshOpen("clipboard");
  }
  function trimItems(c) { let n = 0; c.items = c.items.filter((x) => x.pinned || ++n <= MAX_ITEMS); }

  function textLike(n) { return n && (n.tagName === "TEXTAREA" || (n.tagName === "INPUT" && /^(text|search|url|tel|email|)$/i.test(n.type || ""))); }
  function selectionText() {
    const a = document.activeElement;
    if (textLike(a)) { try { const s = a.selectionStart, e = a.selectionEnd; if (s != null && e > s) return a.value.slice(s, e); } catch (_) {} }
    try { const s = document.getSelection(); return s ? s.toString() : ""; } catch (_) { return ""; }
  }
  // Capture phase grabs the selection before a "cut" deletes it; the bubble phase (after the
  // app's own handlers) reads clipboardData, which holds whatever an app setData()'d.
  let pend = null;
  function onCapture(e) {
    if (suppress) return;
    const p = (pend = { sel: selectionText(), done: false });
    setTimeout(() => { if (!p.done) { p.done = true; record(p.sel); } }, 0);
  }
  function onBubble(e) {
    const p = pend; if (!p || p.done) return;
    let t = ""; try { t = e.clipboardData ? e.clipboardData.getData("text/plain") : ""; } catch (_) {}
    p.done = true; record(t || p.sel);
  }
  ["copy", "cut"].forEach((t) => { window.addEventListener(t, onCapture, true); window.addEventListener(t, onBubble, false); });

  // Wrap the async Clipboard API so the app's own copy buttons are recorded.
  let origWriteText = null, origWrite = null;
  function hookClipboardApi() {
    const c = navigator.clipboard;
    if (!c || c.__ptHooked) return;
    try {
      if (typeof c.writeText === "function") {
        origWriteText = c.writeText.bind(c);
        c.writeText = function (t) { try { record(String(t)); } catch (_) {} return origWriteText(t); };
      }
      if (typeof c.write === "function") {
        origWrite = c.write.bind(c);
        c.write = function (items) { try { captureItems(items); } catch (_) {} return origWrite(items); };
      }
      c.__ptHooked = true;
    } catch (_) {}
  }
  function captureItems(items) {
    if (suppress) return;
    [].concat(items || []).forEach((it) => {
      if (!it || !it.types) return;
      const types = Array.from(it.types);
      const img = types.find((t) => /^image\//.test(t));
      if (img) {
        it.getType(img).then((blob) => {
          if (!blob || blob.size > MAX_IMG * 0.74) return;
          const r = new FileReader();
          r.onload = () => { const im = new Image(); im.onload = () => recordImage(r.result, im.naturalWidth, im.naturalHeight); im.onerror = () => recordImage(r.result); im.src = r.result; };
          r.readAsDataURL(blob);
        }).catch(() => {});
      } else if (types.indexOf("text/plain") >= 0) {
        it.getType("text/plain").then((b) => b.text()).then(record).catch(() => {});
      }
    });
  }
  hookClipboardApi();

  // Write to the REAL clipboard without re-recording it.
  function writeReal(text) {
    if (origWriteText) { return origWriteText(text).catch(() => legacyCopy(text)); }
    if (navigator.clipboard && navigator.clipboard.writeText && !navigator.clipboard.__ptHooked) return navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    legacyCopy(text); return Promise.resolve();
  }
  function legacyCopy(text) {
    const keep = document.activeElement;
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0"; document.body.appendChild(ta);
    suppress++;
    try { ta.select(); document.execCommand("copy"); } catch (_) {}
    suppress--; ta.remove();
    try { if (keep && keep.focus) keep.focus({ preventScroll: true }); } catch (_) {}
  }
  function writeRealImage(src) {
    try {
      if (!origWrite || !window.ClipboardItem) return;
      fetch(src).then((r) => r.blob()).then((b) => origWrite([new ClipboardItem({ [b.type || "image/png"]: b })])).catch(() => {});
    } catch (_) {}
  }

  // =====================================================================
  //  WHERE TO INSERT — the last focused editable field, with its caret
  // =====================================================================
  let target = null, savedRange = null;
  const SHELL = ".pt-fly, .start-menu, .search-panel, .taskbar";
  function editableHost(n) {
    if (!n || n.nodeType !== 1) return null;
    if (n.closest && n.closest(SHELL)) return null;
    if (textLike(n)) return n.readOnly || n.disabled ? null : n;
    if (n.isContentEditable) { let h = n; while (h.parentElement && h.parentElement.isContentEditable) h = h.parentElement; return h; }
    return null;
  }
  document.addEventListener("focusin", (e) => { const h = editableHost(e.target); if (h) { target = h; snapRange(); } }, true);
  function snapRange() {
    if (!target || textLike(target)) return;
    try { const s = document.getSelection(); if (s && s.rangeCount && target.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); } catch (_) {}
  }
  document.addEventListener("selectionchange", () => { if (target && !textLike(target)) snapRange(); });
  function liveTarget() { return target && target.isConnected && target.getClientRects().length ? target : null; }

  function insertText(text, html) {
    const t = liveTarget();
    if (!t) return false;
    try { t.focus({ preventScroll: true }); } catch (_) { t.focus(); }
    if (textLike(t)) {
      let s = t.selectionStart, e = t.selectionEnd;
      if (s == null) { s = e = t.value.length; }
      try { t.setSelectionRange(s, e); } catch (_) {}
      const before = t.value;
      let ok = false; try { ok = document.execCommand("insertText", false, text); } catch (_) {}
      if (!ok || t.value === before) {
        t.setRangeText(text, s, e, "end");
        t.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      }
      return true;
    }
    // contenteditable
    const sel = document.getSelection();
    if (savedRange && t.contains(savedRange.startContainer)) { sel.removeAllRanges(); sel.addRange(savedRange); }
    else if (!sel.rangeCount || !t.contains(sel.anchorNode)) { const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
    const before = t.innerHTML;
    let ok = false; try { ok = html ? document.execCommand("insertHTML", false, html) : document.execCommand("insertText", false, text); } catch (_) {}
    if (!ok || t.innerHTML === before) {
      const r = sel.getRangeAt(0); r.deleteContents();
      let node; if (html) { const tmp = document.createElement("span"); tmp.innerHTML = html; node = tmp.firstChild || document.createTextNode(text); } else node = document.createTextNode(text);
      r.insertNode(node); r.setStartAfter(node); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
      t.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }
    snapRange();
    return true;
  }
  function deliver(text, opts) {
    opts = opts || {};
    const ok = insertText(text, opts.html);
    if (opts.clipboard !== false) writeReal(text);
    if (!ok) status(opts.what === "emoji" ? "Copied " + text + " — paste it anywhere" : "Copied to the clipboard — paste it with Ctrl+V");
    return ok;
  }

  // Caret position (for placing the flyout next to it).
  function caretRect(t) {
    try {
      if (!textLike(t)) {
        const s = document.getSelection();
        if (s && s.rangeCount && t.contains(s.anchorNode)) { const r = s.getRangeAt(0).getClientRects()[0] || s.getRangeAt(0).getBoundingClientRect(); if (r && (r.width || r.height)) return r; }
        return t.getBoundingClientRect();
      }
      const box = t.getBoundingClientRect();
      if (t.tagName === "INPUT") return { left: box.left + 8, top: box.top, bottom: box.bottom, right: box.left + 8 };
      const cs = getComputedStyle(t);
      const m = document.createElement("div");
      ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "paddingTop", "paddingLeft", "paddingRight", "paddingBottom", "borderTopWidth", "borderLeftWidth", "boxSizing", "whiteSpace", "wordWrap", "tabSize"].forEach((k) => { m.style[k] = cs[k]; });
      m.style.cssText += ";position:fixed;visibility:hidden;left:0;top:0;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;width:" + box.width + "px";
      m.textContent = t.value.slice(0, t.selectionStart == null ? t.value.length : t.selectionStart);
      const mk = document.createElement("span"); mk.textContent = "​"; m.appendChild(mk); document.body.appendChild(m);
      const top = mk.offsetTop - t.scrollTop, left = mk.offsetLeft - t.scrollLeft, lh = mk.offsetHeight || 18; m.remove();
      const y = Math.min(box.bottom - 4, Math.max(box.top, box.top + top));
      return { left: Math.min(box.right - 4, box.left + left), top: y, bottom: y + lh, right: box.left + left };
    } catch (_) { return null; }
  }

  // =====================================================================
  //  DATA — kaomoji, symbols, stickers, emoji
  // =====================================================================
  const KAOMOJI = {
    "Classic": ["(◕‿◕)", "(｡◕‿◕｡)", "ヽ(•‿•)ノ", "(¬‿¬)", "(•_•)", "( ͡° ͜ʖ ͡°)", "¯\\_(ツ)_/¯", "(ಠ_ಠ)", "(⌐■_■)", "ʕ•ᴥ•ʔ", "(°ー°〃)", "(-_-;)", "(・_・;)", "(；一_一)", "(￣ー￣)", "(*^_^*)"],
    "Greeting": ["(＾▽＾)/", "ヾ(＾∇＾)", "(°▽°)/", "( ´ ▽ ` )ﾉ", "(o´▽`o)ﾉ", "ヾ(・ω・*)", "(｡･∀･)ﾉﾞ", "(*・ω・)ﾉ", "( ﾟ▽ﾟ)/", "(￣▽￣)ノ", "ヾ(☆▽☆)", "(^-^*)/"],
    "Happy": ["(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧", "٩(◕‿◕｡)۶", "(✯◡✯)", "(☆▽☆)", "＼(＾▽＾)／", "(o^▽^o)", "(⌒‿⌒)", "(≧◡≦)", "o(≧▽≦)o", "(*≧ω≦*)", "ヽ(>∀<☆)ノ", "(๑˃ᴗ˂)ﻭ", "(ᵔᴥᵔ)", "(^▽^)"],
    "Love": ["(♡μ_μ)", "(*♡∀♡)", "(´ ε ` )♡", "(◕‿◕)♡", "(｡♥‿♥｡)", "(♥ω♥*)", "♡( ◡‿◡ )", "(⺣◡⺣)♡*", "(ღ˘⌣˘ღ)", "(˘∀˘)/(μ‿μ) ❤", "(っ˘з(˘⌣˘ ) ♡", "♡(｡- ω -)"],
    "Sad": ["(╥﹏╥)", "(ಥ﹏ಥ)", "(´；ω；`)", "(T_T)", "(;ω;)", "(｡•́︿•̀｡)", "(っ˘̩╭╮˘̩)っ", "(-_-)", "( ╥ω╥ )", "(｡╯︵╰｡)", "(︶︹︺)", "o(TヘTo)"],
    "Angry": ["(╬ Ò﹏Ó)", "(＃`Д´)", "(╯°□°）╯︵ ┻━┻", "┬─┬ノ( º _ ºノ)", "ヽ(`⌒´メ)ノ", "(҂ `з´ )", "(ノಠ益ಠ)ノ彡┻━┻", "(⋋▂⋌)", "(¬_¬\")", "(눈_눈)", "(｀ε´)", "ψ( ` ∇ ´ )ψ"],
    "Surprised": ["(⊙_⊙)", "(°ロ°) !", "w(°ｏ°)w", "(O_O;)", "Σ(°△°|||)", "(⊙ˍ⊙)", "(゜゜)", "(o_O)", "(◎_◎;)", "щ(゜ロ゜щ)", "(・□・;)", "!!(⊙_⊙)"],
    "Animals": ["ฅ^•ﻌ•^ฅ", "(=^･ω･^=)", "ʕ•ᴥ•ʔ", "(U・x・U)", "∪･ω･∪", "(•ㅅ•)", "(・⊝・)", "/(•ㅅ•)\\", "(=ↀωↀ=)", "<コ:彡", "~>°)～～～", "( •ө• )"],
    "Hugs & more": ["(づ｡◕‿‿◕｡)づ", "(っ´▽`)っ", "⊂(・ω・*⊂)", "(つ≧▽≦)つ", "(ﾉ´ з `)ノ", "(*´∀`)~♥", "(•̀ᴗ•́)و ̑̑", "(ง’̀-’́)ง", "(￣^￣)ゞ", "( ˘▽˘)っ♨", "(っ˘ڡ˘ς)", "( ˘ ³˘)♥"],
  };
  const rng = (a, b, skip) => { let s = ""; for (let c = a; c <= b; c++) if (!skip || skip.indexOf(c) < 0) s += String.fromCodePoint(c); return s; };
  const SYMBOLS = {
    "Punctuation": "‐–—―‖‘’‚‛“”„‟†‡•‣…‰‱′″‴‹›※‼‽⁂⁇⁈⁉§¶©®™℠°±·¡¿«»⁰¦¨¬",
    "Currency": "$¢£¤¥₠₡₢₣₤₥₦₧₨₩₪₫€₭₮₯₰₱₲₳₴₵₶₷₸₹₺₻₼₽₾₿",
    "Latin": rng(0xC0, 0xFF, [0xD7, 0xF7]) + rng(0x100, 0x17F),
    "Geometric": rng(0x25A0, 0x25FF),
    "Math": "+−×÷=≠≈≡≤≥≪≫±∓∞∑∏∐√∛∜∫∬∭∮∂∆∇∈∉∋∌∩∪⊂⊃⊆⊇⊄⊅∧∨⊕⊗⊙¬∀∃∄∅∝∠∡∟⊥∥∦∴∵∶∷≅≃∼≜≝⌈⌉⌊⌋⟨⟩ℵℏℕℤℚℝℂℙπ°′″",
    "Super & subscript": "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₔₕₖₗₘₙₚₛₜ",
    "Arrows": rng(0x2190, 0x21FF),
    "Greek": rng(0x391, 0x3A9, [0x3A2]) + rng(0x3B1, 0x3C9),
    "Numbers": "½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒↉ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹ" + rng(0x2460, 0x2473),
    "Misc": "★☆✓✔✗✘☐☑☒♠♣♥♦♤♧♡♢♩♪♫♬☀☁☂☃☄☎☏☮☯☢☣⚠⚡✈✉✎✏✂✆✇⌘⌥⇧⌫⏎⎋⌨⏻⏼",
  };
  const STICKERS = {
    "Party": ["🎉", "🥳", "🎊", "🎂", "🍾", "🎈", "🪅", "🎁", "🪩", "🥂", "🎆", "🧁"],
    "Reactions": ["👍", "👏", "🙌", "💯", "🔥", "😂", "😍", "🤯", "😭", "🤔", "🙏", "✨", "👀", "🫡", "💀", "🫶"],
    "Love": ["❤️", "💖", "💕", "😘", "🥰", "💌", "🌹", "💝", "💞", "😻", "💐", "🫰"],
    "Animals": ["🐶", "🐱", "🦊", "🐼", "🐨", "🦄", "🐸", "🐧", "🐙", "🦖", "🐝", "🦥"],
    "Food": ["🍕", "🍩", "🍦", "🍔", "🌮", "🍣", "🧋", "☕", "🍓", "🥐", "🍿", "🍪"],
    "Weather": ["☀️", "🌈", "⛄", "🌧️", "⚡", "🌙", "⭐", "❄️", "🌪️", "🌤️", "🌊", "🍂"],
  };

  let EMO = null;
  function emoji() {
    if (EMO) return EMO;
    EMO = (window.PT_EMOJI_DATA || []).map(([g, s]) => ({ g, list: s.split("|").map((x) => { const p = x.split("~"); return { e: p[0], n: p[1] || "", k: p[2] || "", t: p[3] === "t" }; }) }));
    return EMO;
  }
  const CAT_ICON = { "Recent": "🕘", "Smileys & Emotion": "😀", "People & Body": "👋", "Animals & Nature": "🐻", "Food & Drink": "🍔", "Travel & Places": "🚗", "Activities": "⚽", "Objects": "💡", "Symbols": "💕", "Flags": "🏁" };
  const TONES = ["", "\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}"];
  const TONE_SWATCH = ["#ffcc22", "#f7dece", "#f3d2a2", "#d5ab88", "#af7e57", "#7c533e"];
  function toned(it) {
    const tone = epStore().tone | 0;
    if (!tone || !it.t) return it.e;
    const cps = Array.from(it.e); let rest = cps.slice(1); if (rest[0] === "️") rest = rest.slice(1);
    return cps[0] + TONES[tone] + rest.join("");
  }
  function searchEmoji(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return [];
    const out = [];
    emoji().forEach((c) => c.list.forEach((it) => {
      const hay = (it.n + " " + it.k).toLowerCase(), hw = hay.split(/[\s:,-]+/);
      if (!words.every((w) => hw.some((h) => h.startsWith(w)))) return;
      let score = 0;
      if (it.n.toLowerCase() === q.toLowerCase()) score += 100;
      if (it.n.toLowerCase().startsWith(words[0])) score += 20;
      if (it.n.toLowerCase().split(/\s+/).some((h) => h.startsWith(words[0]))) score += 10;
      out.push({ it, score });
    }));
    return out.sort((a, b) => b.score - a.score).slice(0, 240).map((x) => x.it);
  }
  function addRecent(e) {
    const r = epStore().recent; const i = r.indexOf(e); if (i >= 0) r.splice(i, 1); r.unshift(e); if (r.length > 36) r.length = 36; save();
  }

  // =====================================================================
  //  FLYOUT
  // =====================================================================
  let fly = null, openedAt = 0, curTab = "emoji";
  const TABS = [
    { id: "emoji", label: "Emoji", ic: "😊" },
    { id: "kaomoji", label: "Kaomoji", ic: "<span class='pt-kao-ic'>;-)</span>" },
    { id: "symbols", label: "Symbols", ic: "<span class='pt-sym-ic'>Ω</span>" },
    { id: "stickers", label: "Stickers", ic: "🎉" },
    { id: "clipboard", label: "Clipboard history", ic: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" stroke-linecap="round"/></svg>` },
  ];
  const ICO = {
    pin: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M14.5 3.5l6 6-3 1.5-3.5 3.5-.5 4-2-2-4.5 4.5M8 10l-.5.5 6 6M7.5 10.5l3.5-3.5 1.5-3z"/></svg>`,
    pinned: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M14.5 3.5l6 6-3 1.5-3.5 3.5-.5 4-8-8 4-.5 3.5-3.5z"/><path d="M8.5 15.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    del: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>`,
  };

  function open(tab) {
    if (!document.body) return;
    curTab = tab || epStore().tab || "emoji";
    if (!fly) build();
    epStore().tab = curTab;
    renderTabs(); renderBody(); place();
    fly.classList.add("open"); openedAt = Date.now();
  }
  function close() { if (fly) { fly.remove(); fly = null; } }
  function toggle(tab) { if (fly && curTab === tab) close(); else open(tab); }
  function isOpen() { return !!fly; }

  function build() {
    fly = el(`<div class="pt-fly" role="dialog" aria-label="Emoji and clipboard">
      <div class="pt-fly-head"><div class="pt-fly-tabs" role="tablist"></div><button class="pt-fly-x" title="Close (Esc)">${ICO.close}</button></div>
      <div class="pt-fly-body"></div>
      <div class="pt-fly-status" aria-live="polite"></div>
    </div>`);
    document.body.appendChild(fly);
    // Keep the field's focus + caret: buttons in the picker never take focus.
    const keep = (e) => { if (!e.target.closest("input,select,textarea,[contenteditable='true']")) e.preventDefault(); };
    fly.addEventListener("pointerdown", keep); fly.addEventListener("mousedown", keep);
    fly.querySelector(".pt-fly-x").onclick = close;
  }
  function renderTabs() {
    const host = fly.querySelector(".pt-fly-tabs");
    host.innerHTML = TABS.map((t) => `<button class="pt-fly-tab${t.id === curTab ? " on" : ""}" data-t="${t.id}" role="tab" aria-selected="${t.id === curTab}" title="${t.label}">${t.ic}</button>`).join("");
    host.querySelectorAll(".pt-fly-tab").forEach((b) => b.onclick = () => { curTab = b.dataset.t; epStore().tab = curTab; save(); renderTabs(); renderBody(); });
  }
  function refreshOpen(tab) { if (fly && curTab === tab) renderBody(); }
  let statusTimer = 0;
  function status(msg) {
    if (!fly) { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("clipboard", "Clipboard") : "", title: "Clipboard", body: esc(msg) }); return; }
    const s = fly.querySelector(".pt-fly-status"); s.textContent = msg; s.classList.add("show");
    clearTimeout(statusTimer); statusTimer = setTimeout(() => s.classList.remove("show"), 2200);
  }
  function place() {
    const W = Math.min(372, innerWidth - 16), H = Math.min(470, innerHeight - 70);
    fly.style.width = W + "px"; fly.style.height = H + "px";
    const t = liveTarget(); const r = t ? caretRect(t) : null;
    let x, y;
    if (r) {
      x = r.left - 20; y = r.bottom + 8;
      if (y + H > innerHeight - 56) y = r.top - H - 8;
      if (y < 8) y = Math.max(8, innerHeight - H - 60);
    } else { x = (innerWidth - W) / 2; y = innerHeight - H - 64; }
    x = Math.max(8, Math.min(innerWidth - W - 8, x)); y = Math.max(8, Math.min(innerHeight - H - 8, y));
    fly.style.left = x + "px"; fly.style.top = y + "px";
  }

  function renderBody() {
    const b = fly.querySelector(".pt-fly-body"); b.innerHTML = ""; b.className = "pt-fly-body pt-tab-" + curTab;
    ({ emoji: renderEmoji, kaomoji: renderKaomoji, symbols: renderSymbols, stickers: renderStickers, clipboard: renderClipboard })[curTab](b);
  }

  // ---------- Emoji ----------
  let emoCat = null, emoQuery = "";
  function renderEmoji(b) {
    const ep = epStore();
    if (!emoCat) emoCat = ep.recent.length ? "Recent" : "Smileys & Emotion";
    b.innerHTML = `<div class="pt-emo-top">
        <label class="pt-search">${ICO.search}<input class="pt-emo-q" placeholder="Search emoji" value="${esc(emoQuery)}" autocomplete="off" spellcheck="false"></label>
        <div class="pt-tone"><button class="pt-tone-btn" title="Skin tone"><i style="background:${TONE_SWATCH[ep.tone | 0]}"></i></button></div>
      </div>
      <div class="pt-emo-title"></div>
      <div class="pt-grid pt-emo-grid"></div>
      <div class="pt-emo-name"></div>
      <div class="pt-cats"></div>`;
    const grid = b.querySelector(".pt-emo-grid"), title = b.querySelector(".pt-emo-title"), nameEl = b.querySelector(".pt-emo-name");
    const cats = b.querySelector(".pt-cats");
    const all = ["Recent"].concat(emoji().map((c) => c.g));
    cats.innerHTML = all.map((g) => `<button class="pt-cat${g === emoCat && !emoQuery ? " on" : ""}" data-g="${esc(g)}" title="${esc(g === "Recent" ? "Most recently used" : g)}">${CAT_ICON[g] || "•"}</button>`).join("");
    cats.querySelectorAll(".pt-cat").forEach((c) => c.onclick = () => { emoCat = c.dataset.g; emoQuery = ""; renderBody(); });
    function fill(list, label) {
      title.textContent = label;
      grid.innerHTML = list.length ? list.map((it, i) => `<button class="pt-cell" data-i="${i}" title="${esc(it.n)}">${it.toned || toned(it)}</button>`).join("") : `<div class="pt-empty">${emoQuery ? "No emoji match “" + esc(emoQuery) + "”" : "Emoji you use will show up here."}</div>`;
      grid.querySelectorAll(".pt-cell").forEach((c) => {
        const it = list[+c.dataset.i];
        c.onclick = () => { const e = it.toned || toned(it); addRecent(e); deliver(e, { what: "emoji" }); if (emoCat === "Recent" && !emoQuery) {/* keep order stable while picking */} };
        c.onpointerenter = () => { nameEl.textContent = it.n; };
      });
    }
    function show() {
      if (emoQuery.trim()) { fill(searchEmoji(emoQuery.trim()), "Results for “" + emoQuery.trim() + "”"); cats.querySelectorAll(".pt-cat").forEach((c) => c.classList.remove("on")); return; }
      if (emoCat === "Recent") {
        const idx = {}; emoji().forEach((c) => c.list.forEach((it) => { idx[it.e] = it; }));
        fill(ep.recent.map((e) => ({ e, n: (idx[e] || findToned(e) || { n: "" }).n, toned: e })), "Most recently used");
      } else { const c = emoji().find((x) => x.g === emoCat) || emoji()[0]; if (c) fill(c.list, c.g); }
    }
    const q = b.querySelector(".pt-emo-q");
    q.oninput = () => { emoQuery = q.value; show(); };
    q.onkeydown = (e) => {
      if (e.key === "Enter") { const first = grid.querySelector(".pt-cell"); if (first) { e.preventDefault(); first.click(); } }
      if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    b.querySelector(".pt-tone-btn").onclick = () => {
      const host = b.querySelector(".pt-tone");
      const ex = host.querySelector(".pt-tone-pop"); if (ex) { ex.remove(); return; }
      const pop = el(`<div class="pt-tone-pop">${TONE_SWATCH.map((c, i) => `<button data-t="${i}" class="${i === (ep.tone | 0) ? "on" : ""}" title="${["Default", "Light", "Medium-light", "Medium", "Medium-dark", "Dark"][i]} skin tone"><i style="background:${c}"></i></button>`).join("")}</div>`);
      host.appendChild(pop);
      pop.querySelectorAll("button").forEach((x) => x.onclick = () => { ep.tone = +x.dataset.t; save(); renderBody(); });
    };
    show();
  }
  function findToned(e) {
    let hit = null; emoji().some((c) => c.list.some((it) => { if (it.t && TONES.some((t, i) => i && toneOf(it, i) === e)) { hit = it; return true; } return false; }));
    return hit;
  }
  function toneOf(it, i) { const cps = Array.from(it.e); let rest = cps.slice(1); if (rest[0] === "️") rest = rest.slice(1); return cps[0] + TONES[i] + rest.join(""); }

  // ---------- Kaomoji / Symbols / Stickers ----------
  let kaoCat = "Classic", symCat = "Punctuation", stkCat = "Reactions";
  function chipBar(host, keys, cur, onPick) {
    host.innerHTML = keys.map((k) => `<button class="pt-chip${k === cur ? " on" : ""}" data-k="${esc(k)}">${esc(k)}</button>`).join("");
    host.querySelectorAll(".pt-chip").forEach((c) => c.onclick = () => onPick(c.dataset.k));
  }
  function renderKaomoji(b) {
    b.innerHTML = `<div class="pt-chips"></div><div class="pt-grid pt-kao-grid"></div>`;
    chipBar(b.querySelector(".pt-chips"), Object.keys(KAOMOJI), kaoCat, (k) => { kaoCat = k; renderBody(); });
    const g = b.querySelector(".pt-kao-grid");
    g.innerHTML = KAOMOJI[kaoCat].map((k, i) => `<button class="pt-kao" data-i="${i}">${esc(k)}</button>`).join("");
    g.querySelectorAll(".pt-kao").forEach((x) => x.onclick = () => deliver(KAOMOJI[kaoCat][+x.dataset.i], { what: "emoji" }));
  }
  function renderSymbols(b) {
    b.innerHTML = `<div class="pt-chips"></div><div class="pt-grid pt-sym-grid"></div>`;
    chipBar(b.querySelector(".pt-chips"), Object.keys(SYMBOLS), symCat, (k) => { symCat = k; renderBody(); });
    const chars = Array.from(SYMBOLS[symCat]);
    const g = b.querySelector(".pt-sym-grid");
    g.innerHTML = chars.map((c, i) => `<button class="pt-cell pt-sym" data-i="${i}" title="U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}">${esc(c)}</button>`).join("");
    g.querySelectorAll(".pt-sym").forEach((x) => x.onclick = () => deliver(chars[+x.dataset.i], { what: "emoji" }));
  }
  function renderStickers(b) {
    b.innerHTML = `<div class="pt-chips"></div><div class="pt-grid pt-stk-grid"></div><div class="pt-note">Stickers insert as big emoji in rich text (Word, Mail…) and as emoji in plain text.</div>`;
    chipBar(b.querySelector(".pt-chips"), Object.keys(STICKERS), stkCat, (k) => { stkCat = k; renderBody(); });
    const g = b.querySelector(".pt-stk-grid");
    g.innerHTML = STICKERS[stkCat].map((s, i) => `<button class="pt-stk" data-i="${i}" style="animation-delay:${(i % 6) * 60}ms">${s}</button>`).join("");
    g.querySelectorAll(".pt-stk").forEach((x) => x.onclick = () => {
      const s = STICKERS[stkCat][+x.dataset.i]; addRecent(s);
      deliver(s, { what: "emoji", html: `<span class="pt-sticker" style="font-size:3em;line-height:1.1;display:inline-block;vertical-align:middle">${s}</span>&nbsp;` });
    });
  }

  // ---------- Clipboard ----------
  function renderClipboard(b) {
    const c = cbStore();
    if (!c.enabled) {
      b.innerHTML = `<div class="pt-cb-off">
        <div class="pt-cb-off-ic">${TABS[4].ic}</div>
        <h3>Clipboard history is off</h3>
        <p>Turn it on to keep the last ${MAX_ITEMS} things you copy and paste them again later.</p>
        <button class="pt-btn pt-primary pt-cb-on">Turn on</button>
      </div>`;
      b.querySelector(".pt-cb-on").onclick = () => { c.enabled = true; save(); renderBody(); };
      return;
    }
    b.innerHTML = `<div class="pt-cb-head"><b>Clipboard history</b><span class="pt-grow"></span><button class="pt-btn pt-cb-clear" ${c.items.some((x) => !x.pinned) ? "" : "disabled"}>Clear all</button></div>
      <div class="pt-cb-list"></div>
      <div class="pt-cb-foot"><span>Clipboard history</span><span class="pt-grow"></span><button class="pt-switch on pt-cb-toggle" role="switch" aria-checked="true" title="Turn clipboard history off"><i></i></button></div>`;
    const list = b.querySelector(".pt-cb-list");
    if (!c.items.length) list.innerHTML = `<div class="pt-empty pt-cb-empty"><b>You've copied nothing yet</b><span>Copy text anywhere (Ctrl+C or a Copy button) and it shows up here. Press Ctrl+Alt+V to open this any time.</span></div>`;
    c.items.forEach((it) => {
      const row = el(`<div class="pt-cb-item${it.pinned ? " pinned" : ""}" role="button" tabindex="-1" title="Click to paste">
        <div class="pt-cb-content"></div>
        <div class="pt-cb-acts"><button class="pt-ib pt-cb-pin" title="${it.pinned ? "Unpin" : "Pin"}">${it.pinned ? ICO.pinned : ICO.pin}</button><button class="pt-ib pt-cb-del" title="Delete">${ICO.del}</button></div>
      </div>`);
      const content = row.querySelector(".pt-cb-content");
      if (it.type === "image") content.innerHTML = `<img src="${esc(it.src)}" alt="Copied image">`;
      else content.textContent = it.text.length > 400 ? it.text.slice(0, 400) + "…" : it.text;
      row.onclick = (e) => {
        if (e.target.closest(".pt-cb-acts")) return;
        if (it.type === "image") {
          const t = liveTarget();
          if (t && !textLike(t)) insertText("", `<img src="${esc(it.src)}" alt="" style="max-width:100%">`);
          writeRealImage(it.src); status(t && !textLike(t) ? "Image pasted" : "Image copied — paste it in a picture-friendly app");
        } else {
          const ok = deliver(it.text, { what: "text" });
          if (ok) status("Pasted");
        }
        // Windows moves the pasted item to the top.
        if (!it.pinned) { const i = c.items.indexOf(it); if (i > 0) { c.items.splice(i, 1); c.items.unshift(it); save(); renderBody(); } }
      };
      row.querySelector(".pt-cb-pin").onclick = () => { it.pinned = !it.pinned; save(); renderBody(); };
      row.querySelector(".pt-cb-del").onclick = () => { c.items = c.items.filter((x) => x !== it); save(); renderBody(); };
      list.appendChild(row);
    });
    b.querySelector(".pt-cb-clear").onclick = () => { c.items = c.items.filter((x) => x.pinned); save(); renderBody(); status("Cleared (pinned items kept)"); };
    b.querySelector(".pt-cb-toggle").onclick = () => { c.enabled = false; save(); renderBody(); };
  }

  // =====================================================================
  //  KEYBOARD + CLOSE
  // =====================================================================
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || (/Macintosh/.test(navigator.userAgent) && "ontouchend" in document);
  window.addEventListener("keydown", (e) => {
    const code = e.code || "";
    const ctrlAlt = e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey;
    const winKey = e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !isApple;   // Cmd+V / Cmd+. are reserved on Apple devices
    if (ctrlAlt || winKey) {
      if (code === "KeyV" || (winKey && (e.key === "v" || e.key === "V"))) { e.preventDefault(); e.stopPropagation(); toggle("clipboard"); return; }
      if (code === "Period" || code === "Semicolon" || (winKey && (e.key === "." || e.key === ";"))) { e.preventDefault(); e.stopPropagation(); toggle("emoji"); return; }
    }
    if (fly && e.key === "Escape") { e.preventDefault(); close(); }
  }, true);
  document.addEventListener("pointerdown", (e) => {
    if (!fly || fly.contains(e.target) || Date.now() - openedAt < 300) return;
    close();
  }, true);
  window.addEventListener("resize", () => { if (fly) place(); });

  // =====================================================================
  //  APPS, CATALOG, ICONS
  // =====================================================================
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.clipboard = function () { open("clipboard"); };
  AppRegistry.emoji = function () { open("emoji"); };
  function addCatalog(entry) {
    try {
      if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === entry.id)) Catalog.storeApps.push(entry);
      (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (EXTRA_DEFAULT_APPS.indexOf(entry.id) < 0) EXTRA_DEFAULT_APPS.push(entry.id);
    } catch (_) {}
  }
  addCatalog({ id: "clipboard", name: "Clipboard history", cat: "System", price: 0, builtin: "clipboard", desc: "Clipboard history (Win+V or Ctrl+Alt+V) — the last 25 things you copied. Pin, delete, or click to paste." });
  addCatalog({ id: "emoji", name: "Emoji & symbols", cat: "System", price: 0, builtin: "emoji", desc: "The emoji panel (Win+. or Ctrl+Alt+.) — 1,900 emoji with search and skin tones, kaomoji, symbols and stickers." });

  window.PowerTools = { open, close, toggle, isOpen, insertText, record, recordImage, writeReal, emojiCount: () => emoji().reduce((n, c) => n + c.list.length, 0), target: () => liveTarget() };
  window.PTShared = { esc, el, ad, save, uid };
})();
