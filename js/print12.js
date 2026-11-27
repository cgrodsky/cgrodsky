/* Print12 — Windows 11 style printing for Windows 12.

   window.Print12.print({ title, html | text | imageBlob | canvas | imageUrl, mono })
     opens the print dialog: printer, copies, pages (all / range), orientation, paper size, margins,
     headers & footers, live preview.
   Printers:
     "Microsoft Print to PDF" — REAL: writes a PDF file (our own minimal PDF writer: standard
        Helvetica / Courier fonts with WinAnsi encoding, word wrapping, pages, images embedded as
        JPEG XObjects) into Documents.
     "OneNote (Desktop)"      — SIMULATED (labelled so): makes the same PDF in Documents\OneNote.
     "Your device's printers" — REAL: the pages are rendered to images and printed with window.print()
        from a print-only iframe (iPad Safari: a print-only layer in this page, because Safari prints
        the top page).
   Settings › Bluetooth & devices › Printers & scanners: printers, default printer, print queue,
   test page. Ctrl+P / File › Print hooks for Notepad, Word, Paint, Photos and Edge are added at run
   time (their files are not edited). Load after js/settings12.js, before js/main.js.
   window.Print12 = { print, makePdf, layout, printers, openSettings } */
(function () {
  "use strict";
  if (window.Print12) return;
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const scr = () => document.getElementById("screen") || document.body;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && "ontouchend" in document);
  function cfg() {
    const a = S().appData || (S().appData = {});
    const p = a.print12 || (a.print12 = {});
    if (!p.default) p.default = "pdf";
    if (!Array.isArray(p.jobs)) p.jobs = [];
    if (p.manageDefault == null) p.manageDefault = false;
    return p;
  }
  const save = () => { try { State.save(); } catch (_) {} };
  const log = (level, id, msg) => { try { if (window.EventLog) EventLog.add("System", level, "PrintService", id, msg); } catch (_) {} };
  const userName = () => (S().profile && S().profile.username) || "User";

  const PRINTERS = [
    { id: "pdf", name: "Microsoft Print to PDF", sub: "Saves a PDF file to Documents", real: true },
    { id: "onenote", name: "OneNote (Desktop)", sub: "Simulated — saves a PDF to Documents\\OneNote", sim: true },
    { id: "system", name: "Your device's printers", sub: "Opens your browser's print dialog (AirPrint, network and USB printers)", real: true },
  ];
  const PAPER = { letter: ["Letter", 612, 792], a4: ["A4", 595.28, 841.89], legal: ["Legal", 612, 1008], a5: ["A5", 419.53, 595.28] };
  const MARGINS = { normal: ["Normal", 72, 72], narrow: ["Narrow", 36, 36], wide: ["Wide", 72, 144], none: ["None", 18, 18] }; // [name, top/bottom, left/right] in pt

  // ================================================================ fonts (standard 14 metrics, 1/1000 em)
  const HV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  const HVB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  // Unicode → WinAnsi (the 0x80–0x9F block) + widths for those glyphs
  const WIN = { 0x20ac: [0x80, 556], 0x201a: [0x82, 222], 0x0192: [0x83, 556], 0x201e: [0x84, 333], 0x2026: [0x85, 1000], 0x2020: [0x86, 556], 0x2021: [0x87, 556], 0x02c6: [0x88, 333], 0x2030: [0x89, 1000], 0x0160: [0x8a, 667], 0x2039: [0x8b, 333], 0x0152: [0x8c, 1000], 0x017d: [0x8e, 611], 0x2018: [0x91, 222], 0x2019: [0x92, 222], 0x201c: [0x93, 333], 0x201d: [0x94, 333], 0x2022: [0x95, 350], 0x2013: [0x96, 556], 0x2014: [0x97, 1000], 0x02dc: [0x98, 333], 0x2122: [0x99, 1000], 0x0161: [0x9b, 500], 0x203a: [0x9c, 333], 0x0153: [0x9d, 944], 0x017e: [0x9e, 500], 0x0178: [0x9f, 667] };
  // char → WinAnsi byte (or "?" for anything the standard fonts can't show, like emoji / CJK)
  function code(ch) {
    const c = ch.codePointAt(0);
    if (c === 9) return 32;
    if (c >= 32 && c <= 126) return c;
    if (c >= 160 && c <= 255) return c;
    if (WIN[c]) return WIN[c][0];
    if (c === 0x2212) return 45; if (c === 0x2192) return 0x3e; if (c === 0x00a0) return 32;
    return 63;
  }
  function width(ch, font, size) {
    const b = code(ch);
    if (font === "mono") return 0.6 * size;
    const T = /bold/.test(font) ? HVB : HV;
    let w;
    if (b >= 32 && b <= 126) w = T[b - 32];
    else if (b >= 0x80 && b <= 0x9f) { const e = Object.values(WIN).find((x) => x[0] === b); w = e ? e[1] : 556; }
    else if (b >= 0xc0) { // accented letters: width of the base letter
      const base = String.fromCharCode(b).normalize("NFD")[0]; const bb = base.charCodeAt(0); w = bb >= 32 && bb <= 126 ? T[bb - 32] : 556;
    } else w = 556;
    return (w * size) / 1000;
  }
  const textW = (s, font, size) => { let w = 0; for (const ch of s) w += width(ch, font, size); return w; };

  // ================================================================ content → blocks
  // block: { kind: "p", runs: [{ text, bold, italic }], size, before, after, indent, bullet, mono } | { kind: "img", img }
  function htmlBlocks(html) {
    const doc = new DOMParser().parseFromString("<div>" + String(html || "") + "</div>", "text/html");
    const out = []; let cur = null;
    const BLOCK = /^(P|DIV|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE|TR|TABLE|SECTION|ARTICLE|HEADER|FOOTER|NAV|ASIDE|MAIN|FIGURE|FIGCAPTION|DL|DT|DD|FORM|HR)$/;
    const SIZE = { H1: 20, H2: 16, H3: 13.5, H4: 12, H5: 11, H6: 10 };
    function flush() { if (cur && cur.runs.some((r) => r.text.trim())) { cur.runs[0].text = cur.runs[0].text.replace(/^\s+/, ""); out.push(cur); } cur = null; }
    function start(o) { flush(); cur = Object.assign({ kind: "p", runs: [], size: 11, before: 0, after: 6, indent: 0 }, o || {}); }
    function walk(n, st) {
      if (n.nodeType === 3) {
        let t = n.nodeValue; if (!st.pre) t = t.replace(/\s+/g, " ");
        if (!t) return;
        if (!cur) start({ size: st.size, before: 0, mono: st.pre });
        if (st.pre && t.includes("\n")) { t.split("\n").forEach((line, i) => { if (i) start({ size: st.size, after: 0, mono: true }); cur.runs.push({ text: line, bold: st.bold, italic: st.italic }); }); return; }
        cur.runs.push({ text: t, bold: st.bold, italic: st.italic });
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|BUTTON|INPUT|SELECT|TEXTAREA|SVG|IFRAME|VIDEO|AUDIO|CANVAS)$/.test(tag)) return;
      if (n.hidden || n.getAttribute("aria-hidden") === "true" || n.hasAttribute("data-pr-hide")) return;
      if (tag === "BR") { if (cur) start({ size: st.size, after: cur.after, mono: st.pre, indent: cur.indent }); else start({ size: st.size }); return; }
      if (tag === "IMG") { const src = n.getAttribute("src"); if (src && !/^javascript:/i.test(src)) { flush(); out.push({ kind: "img", src, alt: n.getAttribute("alt") || "", cssW: parseFloat(n.getAttribute("data-pr-w") || n.getAttribute("width")) || 0 }); } return; }
      if (tag === "HR") { flush(); out.push({ kind: "hr" }); return; }
      const s2 = Object.assign({}, st);
      if (/^(B|STRONG|TH|H[1-6])$/.test(tag)) s2.bold = true;
      if (/^(I|EM|CITE)$/.test(tag)) s2.italic = true;
      if (tag === "PRE" || tag === "CODE") s2.pre = tag === "PRE" ? true : st.pre;
      if (SIZE[tag]) s2.size = SIZE[tag];
      if (tag === "UL" || tag === "OL") s2.indent = (st.indent || 0) + 18;
      const isBlock = BLOCK.test(tag);
      if (isBlock) {
        let bullet = null;
        if (tag === "LI") { const par = n.parentElement; bullet = par && par.tagName === "OL" ? ([...par.children].indexOf(n) + 1) + "." : "•"; }
        start({ size: s2.size, before: SIZE[tag] ? 8 : 0, after: SIZE[tag] ? 4 : tag === "LI" ? 2 : 6, indent: s2.indent || 0, bullet, mono: !!s2.pre });
      }
      n.childNodes.forEach((c) => walk(c, s2));
      if (isBlock) flush();
    }
    walk(doc.body.firstChild, { size: 11, bold: false, italic: false, indent: 0 });
    flush();
    return out;
  }
  function textBlocks(text, mono) {
    return String(text || "").replace(/\r\n?/g, "\n").split("\n").map((line) => ({ kind: "p", runs: [{ text: line.replace(/\t/g, "    ") }], size: mono ? 10 : 11, before: 0, after: mono ? 0 : 2, indent: 0, mono: !!mono, keepEmpty: true }));
  }

  // ================================================================ images → JPEG bytes
  async function loadJpeg(src) {
    try {
      let blob = src instanceof Blob ? src : null;
      if (!blob) { const r = await fetch(src); blob = await r.blob(); }
      const bmp = await createImageBitmap(blob);
      const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      const jb = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.88));
      return { w: c.width, h: c.height, bytes: new Uint8Array(await jb.arrayBuffer()), canvas: c };
    } catch (_) { return null; }
  }
  async function prepare(job) {
    let blocks = [];
    if (job.imageBlob || job.canvas || job.imageUrl) {
      let src = job.imageBlob || job.imageUrl;
      if (job.canvas) { const c = document.createElement("canvas"); c.width = job.canvas.width; c.height = job.canvas.height; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(job.canvas, 0, 0); src = await new Promise((r) => c.toBlob(r, "image/png")); }
      const img = await loadJpeg(src);
      blocks = img ? [{ kind: "img", img, fit: true }] : textBlocks("(This picture couldn't be read.)");
    } else if (job.html != null) blocks = htmlBlocks(job.html);
    else blocks = textBlocks(job.text, job.mono);
    for (const b of blocks) if (b.kind === "img" && !b.img) b.img = await loadJpeg(new URL(b.src, document.baseURI).href);
    return blocks.filter((b) => b.kind !== "img" || b.img);
  }

  // ================================================================ layout
  // opts: { paper, landscape, margin, headers, title } → { W, H, pages: [[items]] }
  function layout(blocks, o) {
    const P = PAPER[o.paper] || PAPER.letter, M = MARGINS[o.margin] || MARGINS.normal;
    const W = o.landscape ? P[2] : P[1], H = o.landscape ? P[1] : P[2];
    const L = M[2], R = W - M[2], T = M[1], B = H - M[1], cw = R - L;
    const pages = []; let page = [], y = T;
    const newPage = () => { pages.push(page); page = []; y = T; };
    for (const b of blocks) {
      if (b.kind === "hr") { if (y + 10 > B) newPage(); page.push({ t: "line", x1: L, x2: R, y: y + 5 }); y += 12; continue; }
      if (b.kind === "img") {
        let w = (b.cssW || b.img.w) * 0.75, h = w * b.img.h / b.img.w; // CSS px → pt (on-screen size when known)
        if (b.fit) { const k = Math.min(cw / w, (B - T) / h); w *= k; h *= k; }
        else { if (w > cw) { h *= cw / w; w = cw; } if (h > B - T) { w *= (B - T) / h; h = B - T; } }
        if (y + h > B && page.length) newPage();
        page.push({ t: "img", x: b.fit ? L + (cw - w) / 2 : L, y, w, h, img: b.img });
        y += h + 8; continue;
      }
      const size = b.size || 11, lh = size * (b.mono ? 1.25 : 1.32);
      const fontOf = (r) => (b.mono ? "mono" : (r.bold ? "bold" : "reg") + (r.italic ? "-it" : ""));
      y += b.before || 0;
      const ind = b.indent + (b.bullet ? 14 : 0), maxW = cw - ind;
      // words with styles
      const words = [];
      b.runs.forEach((r) => { const f = fontOf(r); r.text.split(/(\s+)/).forEach((w) => { if (w) words.push({ s: w, f }); }); });
      const lines = []; let line = [], lw = 0;
      const pushLine = () => { lines.push(line); line = []; lw = 0; };
      for (const w of words) {
        const sp = /^\s+$/.test(w.s);
        if (sp && !line.length && (!b.mono || lines.length)) continue; // keep a text file's indentation, not wrap spaces
        let ww = textW(w.s, w.f, size);
        if (lw + ww > maxW && line.length && !sp) { while (line.length && /^\s+$/.test(line[line.length - 1].s)) line.pop(); pushLine(); }
        if (sp && lw + ww > maxW) continue;
        if (ww > maxW) { // a word longer than the line: break it
          let part = "";
          for (const ch of w.s) { const cw2 = width(ch, w.f, size); if (lw + textW(part, w.f, size) + cw2 > maxW && (part || line.length)) { if (part) line.push({ s: part, f: w.f }); pushLine(); part = ""; } part += ch; }
          if (part) { line.push({ s: part, f: w.f }); lw += textW(part, w.f, size); }
          continue;
        }
        line.push(w); lw += ww;
      }
      if (line.length || (b.keepEmpty && !lines.length)) pushLine();
      lines.forEach((ln, i) => {
        if (y + lh > B) newPage();
        let x = L + ind;
        if (i === 0 && b.bullet) page.push({ t: "text", x: L + b.indent, y: y + size, f: "reg", size, s: b.bullet });
        // merge adjacent runs with the same font into one text item
        let acc = null;
        ln.forEach((w) => { if (acc && acc.f === w.f) acc.s += w.s; else { if (acc) { page.push(acc); x += textW(acc.s, acc.f, size); } acc = { t: "text", x, y: y + size, f: w.f, size, s: w.s }; } });
        if (acc && acc.s.trim()) page.push(acc);
        y += lh;
      });
      y += b.after || 0;
    }
    if (page.length || !pages.length) pages.push(page);
    // headers / footers
    if (o.headers) {
      const n = pages.length, date = new Date().toLocaleDateString();
      pages.forEach((pg, i) => {
        const hy = Math.max(14, T / 2) + 3, fy = H - Math.max(10, M[1] / 2) + 3;
        const t = String(o.title || "").slice(0, 90);
        pg.push({ t: "text", x: L, y: hy, f: "reg", size: 8, s: t, gray: true });
        pg.push({ t: "text", x: R - textW(date, "reg", 8), y: hy, f: "reg", size: 8, s: date, gray: true });
        const pn = (i + 1) + "/" + n; pg.push({ t: "text", x: R - textW(pn, "reg", 8), y: fy, f: "reg", size: 8, s: pn, gray: true });
      });
    }
    return { W, H, pages };
  }
  function parseRange(str, n) {
    const set = new Set();
    String(str || "").split(/[,;]/).forEach((part) => {
      const m = part.trim().match(/^(\d+)\s*(?:-\s*(\d+))?$/); if (!m) return;
      let a = +m[1], b = m[2] ? +m[2] : a; if (a > b) [a, b] = [b, a];
      for (let i = Math.max(1, a); i <= Math.min(n, b); i++) set.add(i - 1);
    });
    return [...set].sort((a, b) => a - b);
  }

  // ================================================================ PDF writer
  function pdfStr(s) {
    let out = "";
    for (const ch of s) { const b = code(ch); if (b === 40 || b === 41 || b === 92) out += "\\" + String.fromCharCode(b); else if (b < 32 || b > 126) out += "\\" + b.toString(8).padStart(3, "0"); else out += String.fromCharCode(b); }
    return "(" + out + ")";
  }
  const FONTRES = { reg: ["F1", "Helvetica"], bold: ["F2", "Helvetica-Bold"], "reg-it": ["F3", "Helvetica-Oblique"], "bold-it": ["F4", "Helvetica-BoldOblique"], mono: ["F5", "Courier"] };
  const n2 = (v) => (Math.round(v * 100) / 100).toString();
  function makePdf(lay, meta) {
    meta = meta || {};
    const enc = new TextEncoder(), chunks = [], offs = []; let len = 0;
    const put = (x) => { const u = typeof x === "string" ? latin1(x) : x; chunks.push(u); len += u.length; };
    function latin1(s) { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; }
    const objs = []; // index = obj number - 1; each: { dict?, stream? (Uint8Array), raw? }
    const add = (o) => { objs.push(o); return objs.length; };
    const catalog = add(null), pagesObj = add(null);
    const fontIds = {}; Object.keys(FONTRES).forEach((k) => { fontIds[k] = add({ raw: `<< /Type /Font /Subtype /Type1 /BaseFont /${FONTRES[k][1]} /Encoding /WinAnsiEncoding >>` }); });
    const imgIds = new Map();
    const pageIds = [];
    lay.pages.forEach((items) => {
      let cs = "";
      const xo = [];
      items.forEach((it) => {
        if (it.t === "text") {
          const F = FONTRES[it.f] || FONTRES.reg;
          cs += `BT ${it.gray ? "0.4 g" : "0 g"} /${F[0]} ${n2(it.size)} Tf ${n2(it.x)} ${n2(lay.H - it.y)} Td ${pdfStr(it.s)} Tj ET\n`;
        } else if (it.t === "line") cs += `0.6 G 0.75 w ${n2(it.x1)} ${n2(lay.H - it.y)} m ${n2(it.x2)} ${n2(lay.H - it.y)} l S\n`;
        else if (it.t === "img") {
          let id = imgIds.get(it.img);
          if (!id) { id = add({ dict: `/Type /XObject /Subtype /Image /Width ${it.img.w} /Height ${it.img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, stream: it.img.bytes }); imgIds.set(it.img, id); }
          const name = "Im" + id; if (!xo.includes(name)) xo.push(name);
          cs += `q ${n2(it.w)} 0 0 ${n2(it.h)} ${n2(it.x)} ${n2(lay.H - it.y - it.h)} cm /${name} Do Q\n`;
        }
      });
      const content = add({ dict: "", stream: latin1(cs) });
      const res = `<< /Font << ${Object.keys(FONTRES).map((k) => `/${FONTRES[k][0]} ${fontIds[k]} 0 R`).join(" ")} >>${xo.length ? ` /XObject << ${xo.map((x) => `/${x} ${x.slice(2)} 0 R`).join(" ")} >>` : ""} >>`;
      pageIds.push(add({ raw: `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${n2(lay.W)} ${n2(lay.H)}] /Resources ${res} /Contents ${content} 0 R >>` }));
    });
    objs[catalog - 1] = { raw: `<< /Type /Catalog /Pages ${pagesObj} 0 R >>` };
    objs[pagesObj - 1] = { raw: `<< /Type /Pages /Kids [${pageIds.map((i) => i + " 0 R").join(" ")}] /Count ${pageIds.length} >>` };
    const d = new Date(), pad = (x) => String(x).padStart(2, "0");
    const info = add({ raw: `<< /Title ${pdfStr(String(meta.title || "Document").slice(0, 200))} /Producer (Windows 12 Microsoft Print to PDF) /Creator ${pdfStr(meta.app || "Windows 12")} /CreationDate (D:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}) >>` });
    put("%PDF-1.4\n"); put(new Uint8Array([37, 226, 227, 207, 211, 10])); // binary comment
    objs.forEach((o, i) => {
      offs[i] = len;
      put(`${i + 1} 0 obj\n`);
      if (o.stream) { put(`<< ${o.dict ? o.dict + " " : ""}/Length ${o.stream.length} >>\nstream\n`); put(o.stream); put("\nendstream"); }
      else put(o.raw);
      put("\nendobj\n");
    });
    const xref = len;
    put(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`);
    offs.forEach((o) => put(String(o).padStart(10, "0") + " 00000 n \n"));
    put(`trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const out = new Uint8Array(len); let k = 0; chunks.forEach((c) => { out.set(c, k); k += c.length; });
    return out;
  }

  // ================================================================ preview / raster
  function cssFont(f, size, s) {
    const mono = f === "mono";
    return `${/it/.test(f) ? "italic " : ""}${/bold/.test(f) ? "bold " : ""}${size * s}px ${mono ? '"Courier New", Courier, monospace' : 'Helvetica, Arial, "Liberation Sans", sans-serif'}`;
  }
  function drawPage(cv, lay, idx, s) {
    cv.width = Math.round(lay.W * s); cv.height = Math.round(lay.H * s);
    const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
    (lay.pages[idx] || []).forEach((it) => {
      if (it.t === "text") { g.fillStyle = it.gray ? "#666" : "#000"; g.font = cssFont(it.f, it.size, s); g.textBaseline = "alphabetic"; g.fillText(it.s, it.x * s, it.y * s); }
      else if (it.t === "line") { g.strokeStyle = "#999"; g.lineWidth = Math.max(1, 0.75 * s); g.beginPath(); g.moveTo(it.x1 * s, it.y * s); g.lineTo(it.x2 * s, it.y * s); g.stroke(); }
      else if (it.t === "img") g.drawImage(it.img.canvas, it.x * s, it.y * s, it.w * s, it.h * s);
    });
  }

  // ================================================================ VFS save
  function kidsAt(path) {
    if (window.FilesHelper && FilesHelper.ensureFolder) { try { return FilesHelper.ensureFolder(path); } catch (_) {} }
    let k = VFS.ensure();
    for (const seg of path) { if (!k[seg] || k[seg].type !== "folder") k[seg] = { type: "folder", children: {}, created: Date.now() }; k = k[seg].children; }
    return k;
  }
  function uniqueName(kids, name) { if (!kids[name]) return name; const m = name.match(/^(.*?)(\.[^.]+)?$/); let i = 2; while (kids[m[1] + " (" + i + ")" + (m[2] || "")]) i++; return m[1] + " (" + i + ")" + (m[2] || ""); }
  async function savePdf(bytes, folder, name) {
    const id = await VFS.putBlob(new Blob([bytes], { type: "application/pdf" }));
    const kids = kidsAt(folder);
    const nm = uniqueName(kids, name);
    kids[nm] = { type: "file", kind: "other", blob: id, mime: "application/pdf", size: bytes.length, ts: Date.now() };
    save(); window.dispatchEvent(new Event("vfs-change"));
    return nm;
  }
  const safeName = (t) => (String(t || "Document").replace(/[\\/:*?"<>|]+/g, " ").replace(/\.(txt|docx|png|jpe?g|html?)$/i, "").trim().slice(0, 80) || "Document");

  // ================================================================ system printer
  function systemPrint(lay, idxs, title) {
    return new Promise((resolve) => {
      const s = 150 / 72; // ~150 dpi
      const urls = idxs.map((i) => { const c = document.createElement("canvas"); drawPage(c, lay, i, s); return c.toDataURL("image/jpeg", 0.92); });
      const css = `@page{size:${lay.W}pt ${lay.H}pt;margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block;width:${lay.W}pt;height:${lay.H}pt;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}`;
      const imgs = urls.map((u) => `<img src="${u}" alt="">`).join("");
      if (isIOS) {
        // Safari on iPad prints the top-level page: show only a print layer while printing.
        const root = el(`<div class="pr-printroot" aria-hidden="true">${imgs}</div>`);
        const st = el(`<style media="print">body>*:not(.pr-printroot){display:none!important}html,body{height:auto!important;overflow:visible!important}.pr-printroot{display:block!important}${css}</style>`);
        document.body.append(root, st);
        const done = () => { root.remove(); st.remove(); window.removeEventListener("afterprint", done); resolve(); };
        window.addEventListener("afterprint", done);
        setTimeout(() => { try { window.print(); } catch (_) {} setTimeout(done, 1500); }, 60);
        return;
      }
      const f = document.createElement("iframe");
      f.className = "pr-frame"; f.setAttribute("aria-hidden", "true"); f.title = "Print";
      f.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
      document.body.appendChild(f);
      const d = f.contentDocument; d.open(); d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${imgs}</body></html>`); d.close();
      const go = () => {
        const w = f.contentWindow; let ended = false;
        const end = () => { if (ended) return; ended = true; setTimeout(() => f.remove(), 500); resolve(); };
        w.addEventListener("afterprint", end);
        try { w.focus(); w.print(); } catch (_) { try { window.print(); } catch (__) {} }
        setTimeout(end, 60000);
      };
      const imgsEls = [...d.images]; let n = imgsEls.filter((i) => !i.complete).length;
      if (!n) setTimeout(go, 50); else imgsEls.forEach((i) => { if (!i.complete) i.onload = i.onerror = () => { if (--n === 0) go(); }; });
    });
  }

  // ================================================================ dialog
  let openDlg = null;
  async function print(job) {
    job = Object.assign({ title: "Document" }, job || {});
    if (openDlg) openDlg.remove();
    const c = cfg();
    const st = { printer: c.default || "pdf", copies: 1, pages: "all", range: "", landscape: !!job.landscape, paper: c.paper || (/^en-US/.test(navigator.language || "en-US") ? "letter" : "a4"), margin: "normal", headers: job.headers != null ? !!job.headers : !!job.html && !job.app, idx: 0 };
    if (job.imageBlob || job.canvas || job.imageUrl) st.margin = "narrow";
    const m = el(`<div class="pr-mask" role="presentation"><div class="pr-dlg" role="dialog" aria-modal="true" aria-label="Print">
      <div class="pr-side">
        <h2>Print</h2>
        <label class="pr-f">Printer<select class="pr-printer">${PRINTERS.map((p) => `<option value="${p.id}">${esc(p.name)}${p.sim ? " (simulated)" : ""}</option>`).join("")}</select></label>
        <div class="pr-psub"></div>
        <label class="pr-f">Copies<input class="pr-copies" type="number" min="1" max="99" value="1" inputmode="numeric"></label>
        <fieldset class="pr-f"><legend>Orientation</legend><div class="pr-seg"><label><input type="radio" name="pr-or" value="p"> Portrait</label><label><input type="radio" name="pr-or" value="l"> Landscape</label></div></fieldset>
        <fieldset class="pr-f"><legend>Pages</legend><label class="pr-r"><input type="radio" name="pr-pg" value="all" checked> All</label><label class="pr-r"><input type="radio" name="pr-pg" value="range"> <input class="pr-range" placeholder="e.g. 1-3, 5" aria-label="Page range"></label></fieldset>
        <label class="pr-f">Paper size<select class="pr-paper">${Object.keys(PAPER).map((k) => `<option value="${k}">${PAPER[k][0]}</option>`).join("")}</select></label>
        <label class="pr-f">Margins<select class="pr-margin">${Object.keys(MARGINS).map((k) => `<option value="${k}">${MARGINS[k][0]}</option>`).join("")}</select></label>
        <label class="pr-chk"><input type="checkbox" class="pr-headers"> Headers and footers</label>
        <label class="pr-f pr-fnrow">File name<input class="pr-fname" maxlength="120"></label>
        <div class="pr-err" role="alert"></div>
        <div class="pr-btns"><button class="pr-btn pr-primary pr-go">Print</button><button class="pr-btn pr-cancel">Cancel</button></div>
      </div>
      <div class="pr-main"><div class="pr-stage"><canvas class="pr-canvas" aria-label="Print preview"></canvas><div class="pr-busy">Preparing preview…</div></div><div class="pr-pager"><button class="pr-btn pr-prev" aria-label="Previous page">‹</button><span class="pr-pn"></span><button class="pr-btn pr-next" aria-label="Next page">›</button></div></div>
    </div></div>`);
    openDlg = m;
    if (document.body.classList.contains("dark")) m.classList.add("pr-dark");
    scr().appendChild(m);
    const $ = (s) => m.querySelector(s);
    $(".pr-printer").value = st.printer; $(".pr-paper").value = st.paper; $(".pr-margin").value = st.margin; $(".pr-headers").checked = st.headers;
    m.querySelector(`input[name="pr-or"][value="${st.landscape ? "l" : "p"}"]`).checked = true;
    $(".pr-fname").value = safeName(job.title) + ".pdf";
    let blocks = null, lay = null;
    const close = () => { m.remove(); if (openDlg === m) openDlg = null; };
    const relayout = () => {
      if (!blocks) return;
      lay = layout(blocks, { paper: st.paper, landscape: st.landscape, margin: st.margin, headers: st.headers, title: job.title });
      st.idx = Math.min(st.idx, lay.pages.length - 1); paintPreview();
    };
    function selected() { return st.pages === "all" ? lay.pages.map((_, i) => i) : parseRange(st.range, lay.pages.length); }
    function paintPreview() {
      const cv = $(".pr-canvas"), stage = $(".pr-stage");
      const r = stage.getBoundingClientRect(); const s = Math.max(0.2, Math.min((r.width - 24) / lay.W, (r.height - 24) / lay.H)) * Math.min(2, window.devicePixelRatio || 1);
      drawPage(cv, lay, st.idx, s);
      cv.style.width = (cv.width / Math.min(2, window.devicePixelRatio || 1)) + "px"; cv.style.height = (cv.height / Math.min(2, window.devicePixelRatio || 1)) + "px";
      const sel = selected();
      $(".pr-pn").textContent = (st.idx + 1) + " of " + lay.pages.length + (st.pages === "range" ? " · printing " + sel.length : "");
      $(".pr-prev").disabled = st.idx <= 0; $(".pr-next").disabled = st.idx >= lay.pages.length - 1;
      cv.classList.toggle("pr-skip", !sel.includes(st.idx));
      const p = PRINTERS.find((x) => x.id === st.printer);
      $(".pr-psub").textContent = p.sub; $(".pr-psub").classList.toggle("pr-sim", !!p.sim);
      $(".pr-fnrow").hidden = st.printer === "system";
      $(".pr-go").textContent = st.printer === "pdf" || st.printer === "onenote" ? "Save" : "Print";
      m.dataset.pages = lay.pages.length;
    }
    $(".pr-printer").onchange = (e) => { st.printer = e.target.value; paintPreview(); };
    $(".pr-copies").oninput = (e) => { st.copies = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)); };
    m.querySelectorAll('input[name="pr-or"]').forEach((r) => (r.onchange = () => { st.landscape = r.value === "l"; relayout(); }));
    m.querySelectorAll('input[name="pr-pg"]').forEach((r) => (r.onchange = () => { st.pages = r.value; paintPreview(); }));
    $(".pr-range").addEventListener("focus", () => { m.querySelector('input[name="pr-pg"][value="range"]').checked = true; st.pages = "range"; });
    $(".pr-range").oninput = (e) => { st.range = e.target.value; st.pages = "range"; m.querySelector('input[name="pr-pg"][value="range"]').checked = true; if (lay) paintPreview(); };
    $(".pr-paper").onchange = (e) => { st.paper = e.target.value; relayout(); };
    $(".pr-margin").onchange = (e) => { st.margin = e.target.value; relayout(); };
    $(".pr-headers").onchange = (e) => { st.headers = e.target.checked; relayout(); };
    $(".pr-prev").onclick = () => { st.idx = Math.max(0, st.idx - 1); paintPreview(); };
    $(".pr-next").onclick = () => { st.idx = Math.min(lay.pages.length - 1, st.idx + 1); paintPreview(); };
    $(".pr-cancel").onclick = close;
    m.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    m.addEventListener("click", (e) => { if (e.target === m) close(); });
    $(".pr-go").onclick = async () => {
      if (!lay) return;
      const err = $(".pr-err"); err.textContent = "";
      let idxs = selected();
      if (!idxs.length) { err.textContent = "Type pages that exist, like 1-" + lay.pages.length + "."; return; }
      const all = []; for (let k = 0; k < st.copies; k++) all.push(...idxs);
      const sub = { W: lay.W, H: lay.H, pages: all.map((i) => lay.pages[i]) };
      const go = $(".pr-go"); go.disabled = true;
      const pname = PRINTERS.find((x) => x.id === st.printer).name;
      try {
        if (st.printer === "system") {
          close();
          await systemPrint(lay, all, job.title);
          addJob(job.title, pname, all.length, "Sent to the browser's print dialog");
          return;
        }
        let fname = ($(".pr-fname").value || "").trim() || safeName(job.title) + ".pdf";
        if (!/\.pdf$/i.test(fname)) fname += ".pdf";
        fname = fname.replace(/[\\/:*?"<>|]+/g, "_");
        const bytes = makePdf(sub, { title: job.title, app: job.app });
        const folder = st.printer === "onenote" ? ["Documents", "OneNote"] : ["Documents"];
        const saved = await savePdf(bytes, folder, fname);
        close();
        addJob(job.title, pname, all.length, "Saved " + saved);
        Print12.lastPdf = { name: saved, folder, bytes };
        if (window.Notify) Notify.show({ icon: Icon.mini("printers", "Print"), title: st.printer === "onenote" ? "Sent to OneNote (Desktop) — simulated" : "Printed to PDF", body: esc(saved + " was saved to " + folder.join(" › ") + " (" + all.length + " page" + (all.length === 1 ? "" : "s") + ")."), onClick: () => { if (window.FilesHelper) FilesHelper.open(folder); } });
        log("Information", 307, "Document " + (cfg().jobs.length) + ", " + job.title + " owned by " + userName() + " was printed on " + pname + ". Pages printed: " + all.length + ".");
      } catch (e) { err.textContent = "Couldn't print: " + (e.message || e); go.disabled = false; }
    };
    // build
    try { blocks = await prepare(job); } catch (e) { blocks = textBlocks("This document couldn't be prepared for printing."); }
    if (!m.isConnected) return;
    $(".pr-busy").hidden = true;
    relayout();
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (!m.isConnected) { ro.disconnect(); return; } if (lay) paintPreview(); }); ro.observe($(".pr-stage")); }
    setTimeout(() => { try { $(".pr-go").focus(); } catch (_) {} }, 30);
    return m;
  }
  function addJob(doc, printer, pages, status) {
    const c = cfg(); c.jobs.unshift({ doc: String(doc).slice(0, 120), printer, pages, status, at: Date.now() }); c.jobs.length = Math.min(c.jobs.length, 30); save();
  }

  // ================================================================ Settings › Bluetooth & devices › Printers & scanners
  const svgP = `<svg class="w12s-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="url(#w12s-g)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/></svg>`;
  function sRow(t, s, ctl, onClick) {
    const r = el(`<div class="w12s-row ${onClick ? "w12s-click" : "w12s-row-static"} pr-srow" tabindex="${onClick ? 0 : -1}"><span class="w12s-row-ic">${svgP}</span><div class="w12s-row-txt"><div class="w12s-row-t"></div><div class="w12s-row-s"></div></div><div class="w12s-row-ctl"></div></div>`);
    r.querySelector(".w12s-row-t").textContent = t; r.querySelector(".w12s-row-s").textContent = s || "";
    if (ctl) [].concat(ctl).forEach((x) => r.querySelector(".w12s-row-ctl").appendChild(x));
    if (onClick) { r.onclick = onClick; r.addEventListener("keydown", (e) => { if (e.key === "Enter") onClick(); }); }
    return r;
  }
  const btn = (t, fn) => { const b = el(`<button class="w12s-btn"></button>`); b.textContent = t; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
  function buildSettings(h, redraw) {
    const c = cfg();
    h.appendChild(sRow("Add a printer or scanner", "Browsers can't install printer drivers", btn("Add device", () => {
      if (window.Connect12) Connect12.dialog({ title: "Add a printer or scanner", html: "<p>Web browsers can't install printers or scanners. Use <b>Your device's printers</b> — it opens your device's own print dialog, which lists every printer the device knows (AirPrint on iPad, network and USB printers on a PC).</p><p>Or print to <b>Microsoft Print to PDF</b> to save a real PDF file in Documents.</p>" });
      else alert("Web browsers can't install printers. Use “Your device's printers” or Microsoft Print to PDF.");
    })));
    h.appendChild(el(`<div class="pr-s-h">Printers & scanners</div>`));
    PRINTERS.forEach((p) => {
      const isDef = c.default === p.id;
      const r = sRow(p.name + (p.sim ? " (simulated)" : ""), (isDef ? "Default · " : "") + p.sub, null, () => {
        const nx = r.nextElementSibling; if (nx && nx.classList.contains("pr-spanel")) { nx.remove(); return; }
        const panel = el(`<div class="w12s-panel pr-spanel"></div>`);
        const acts = el(`<div class="pr-sacts"></div>`);
        acts.append(btn("Print test page", () => testPage(p.id)), btn("Open print queue", () => queue(p)));
        if (!isDef) acts.append(btn("Set as default", () => { c.default = p.id; save(); redraw(); }));
        panel.appendChild(acts);
        if (p.sim) panel.appendChild(el(`<div class="pr-s-note">This printer is simulated: there's no OneNote app here. Printing to it saves the pages as a PDF in Documents › OneNote.</div>`));
        if (p.id === "system") panel.appendChild(el(`<div class="pr-s-note">Pages are rendered by Windows 12 and handed to your browser's print dialog, where you pick a real printer${isIOS ? " (AirPrint)" : ""} or save as PDF.</div>`));
        r.after(panel);
      });
      if (isDef) r.querySelector(".w12s-row-t").insertAdjacentHTML("beforeend", ` <span class="pr-badge">Default</span>`);
      if (p.sim) r.querySelector(".w12s-row-t").insertAdjacentHTML("beforeend", ` <span class="pr-badge pr-badge-sim">Simulated</span>`);
      h.appendChild(r);
    });
    h.appendChild(el(`<div class="pr-s-h">Printer preferences</div>`));
    const sw = el(`<label class="w12s-sw"><input type="checkbox" ${c.manageDefault ? "checked" : ""} aria-label="Let Windows manage my default printer"><span></span></label>`);
    sw.addEventListener("click", (e) => e.stopPropagation()); sw.querySelector("input").onchange = (e) => { c.manageDefault = e.target.checked; save(); };
    h.appendChild(sRow("Let Windows manage my default printer", "When on, the default printer is the one you used most recently", sw));
    h.appendChild(sRow("Print queue", c.jobs.length ? c.jobs.length + " recent job" + (c.jobs.length === 1 ? "" : "s") : "No documents printed yet", btn("Open", () => queue(null))));
  }
  function queue(p) {
    const jobs = cfg().jobs.filter((j) => !p || j.printer === p.name);
    const html = jobs.length ? `<table class="pr-q"><thead><tr><th>Document</th><th>Printer</th><th>Pages</th><th>Status</th><th>Submitted</th></tr></thead><tbody>${jobs.map((j) => `<tr><td>${esc(j.doc)}</td><td>${esc(j.printer)}</td><td>${j.pages}</td><td>${esc(j.status)}</td><td>${new Date(j.at).toLocaleString()}</td></tr>`).join("")}</tbody></table>` : "<p>No documents are waiting, and nothing has been printed yet.</p>";
    if (window.Connect12) Connect12.dialog({ title: (p ? p.name : "Print queue") + (p ? " — print queue" : ""), html });
  }
  function testPage(pid) {
    const html = `<h1>Windows 12 — Printer Test Page</h1><p>Congratulations! If you can read this, printing from Windows 12 works.</p><h3>Printer</h3><p>${esc((PRINTERS.find((x) => x.id === pid) || PRINTERS[0]).name)}</p><h3>Details</h3><ul><li>Computer name: ${esc(S().deviceName || "WIN12-PC")}</li><li>User: ${esc(userName())}</li><li>Submitted: ${esc(new Date().toLocaleString())}</li><li>Browser: ${esc(navigator.userAgent.replace(/\s*\(.*?\)\s*/g, " ").slice(0, 90))}</li></ul><p>Fonts: Helvetica, <b>Helvetica Bold</b>, <i>Helvetica Oblique</i>. Characters: “quotes” — dashes – • bullets … € ÅÄÖ åäö é ñ ü.</p>`;
    const prev = cfg().default; cfg().default = pid;
    print({ title: "Test Page", html, headers: true, app: "Windows 12" }).then(() => { cfg().default = prev; });
  }
  window.SettingsSubs = window.SettingsSubs || {};
  if (!Object.prototype.hasOwnProperty.call(window.SettingsSubs, "pr-printers")) window.SettingsSubs["pr-printers"] = { title: "Printers & scanners", parent: "devices", build: buildSettings };
  function renderSub(page) {
    const root = page.closest(".w12s"); if (!root) return;
    const navA = root.querySelector('.w12s-nav-it[data-p="devices"]');
    root.querySelectorAll(".w12s-nav-it").forEach((a) => a.classList.toggle("on", a === navA));
    page.innerHTML = ""; page.scrollTop = 0;
    const head = el(`<h1 class="w12s-title"><a class="w12s-crumb" tabindex="0"></a><span class="w12s-crumb-sep">›</span><span>Printers &amp; scanners</span></h1>`);
    head.querySelector(".w12s-crumb").textContent = navA ? (navA.lastElementChild || navA).textContent.trim() : "Bluetooth & devices";
    head.querySelector(".w12s-crumb").onclick = () => navA && navA.click();
    page.appendChild(head);
    const box = el(`<div class="w12s-list" data-pr-page="1"></div>`); page.appendChild(box);
    buildSettings(box, () => renderSub(page));
  }
  function openSettings() {
    const page = document.querySelector(".win .w12s-page");
    if (page) { const w = page.closest(".win"); w.style.display = ""; if (WM.focusWindow) WM.focusWindow(w); renderSub(page); return; }
    window.SettingsStartPage = "pr-printers"; WM.open("settings");
  }
  function hookSettings() {
    const s = document.getElementById("screen"); if (!s) { setTimeout(hookSettings, 800); return; }
    const enhance = (pg) => {
      const list = pg.querySelector(":scope > .w12s-list"); if (!list || list.dataset.prDone || list.dataset.prPage) return;
      const row = [...list.querySelectorAll(":scope > .w12s-row")].find((r) => { const t = r.querySelector(".w12s-row-t"); return t && t.textContent.trim() === "Printers & scanners"; });
      if (!row) return; list.dataset.prDone = "1";
      row.classList.remove("w12s-row-static"); row.classList.add("w12s-click"); row.tabIndex = 0;
      row.onclick = () => renderSub(pg); row.addEventListener("keydown", (e) => { if (e.key === "Enter") renderSub(pg); });
      if (!row.querySelector(".w12s-chev")) row.insertAdjacentHTML("beforeend", `<span class="w12s-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span>`);
    };
    const hook = (win) => { const pg = win.querySelector && win.querySelector(".w12s-page"); if (!pg || pg.__pr) return; pg.__pr = true; new MutationObserver(() => enhance(pg)).observe(pg, { childList: true }); enhance(pg); };
    new MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains("win")) setTimeout(() => hook(n), 0); }))).observe(s, { childList: true });
    s.querySelectorAll(".win").forEach(hook);
  }

  // ================================================================ app hooks: Ctrl+P and File › Print
  const PRINT_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/></svg>`;
  const entryOf = (win) => (window.WM && WM.entryFor ? WM.entryFor(win) : null);
  const titleOf = (win) => { const t = win.querySelector(".win-titlebar .t-text"); return (t && t.textContent.trim()) || "Document"; };
  async function jobFor(win) {
    const e = entryOf(win); if (!e) return null;
    const id = e.appId;
    if (id === "notepad") { const ta = win.querySelector("textarea"); return ta ? { title: titleOf(win).replace(/ - Notepad$/, "") || "Untitled", text: ta.value, mono: true, app: "Notepad" } : null; }
    if (id === "word") { const pg = win.querySelector(".wd-page"); if (!pg) return null; const nm = win.querySelector(".wd-name"); return { title: (nm && nm.value) || "Document", html: snapshotHtml(pg), app: "Word" }; }
    if (id === "paint") { const cv = win.querySelector("canvas.cr-pt-view"); return cv ? { title: titleOf(win).replace(/ - Paint$/, ""), canvas: cv, app: "Paint" } : null; }
    if (id === "photos") {
      const v = win.querySelector(".cr-ph-viewer"); if (!v) return null; const img = v.querySelector(".cr-ph-vimg"); if (!img || !img.src) return null;
      const nm = v.querySelector(".cr-ph-vname"); let blob = null; try { blob = await (await fetch(img.currentSrc || img.src)).blob(); } catch (_) {}
      return blob ? { title: ((nm && nm.textContent) || "Photo").split("  ·  ")[0], imageBlob: blob, app: "Photos" } : null;
    }
    if (id === "edge" || id === "browser" || id === "chrome") {
      const pg = win.querySelector(".browser-page"); if (!pg) return null;
      const url = (win.querySelector(".url") || {}).value || "";
      const frame = pg.querySelector("iframe");
      const html = frame ? `<h2>${esc(url || "Web page")}</h2><p>This page comes from another website, which doesn't let Windows 12 read its contents, so only its address can be printed. Use your device's printers to print what's on screen.</p>` : snapshotHtml(pg);
      return { title: url || titleOf(win), html, app: "Microsoft Edge", headers: true };
    }
    return null;
  }
  function isPdfTab(win) { const pg = win.querySelector(".browser-page"); return !!(pg && pg.querySelector('[class*="pdf"]')); }
  // The HTML of an on-screen element for printing: hidden parts are dropped and pictures keep their on-screen size.
  function snapshotHtml(root) {
    const clone = root.cloneNode(true);
    const a = [root, ...root.querySelectorAll("*")], b = [clone, ...clone.querySelectorAll("*")];
    for (let i = 1; i < a.length && i < b.length; i++) {
      const n = a[i]; if (!(n instanceof HTMLElement)) continue;
      const r = n.getClientRects().length ? n.getBoundingClientRect() : null;
      if (!r || (!r.width && !r.height)) { b[i].setAttribute("data-pr-hide", ""); continue; }
      if (n.tagName === "IMG") b[i].setAttribute("data-pr-w", String(Math.round(r.width)));
    }
    return clone.innerHTML;
  }
  async function printWin(win) { const j = await jobFor(win); if (j) print(j); return !!j; }
  function topWin() {
    const a = document.activeElement && document.activeElement.closest && document.activeElement.closest(".win");
    if (a && a.style.display !== "none") return a;
    const ws = (WM.windows ? WM.windows() : []).filter((e) => e.win.isConnected && e.win.style.display !== "none").sort((x, y) => (+y.win.style.zIndex || 0) - (+x.win.style.zIndex || 0));
    return ws[0] ? ws[0].win : null;
  }
  const PRINTABLE = ["notepad", "word", "paint", "photos", "edge", "browser", "chrome"];
  window.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || (e.key !== "p" && e.key !== "P")) return;
    if (document.querySelector(".pr-mask")) { e.preventDefault(); return; }
    const w = topWin(); const en = w && entryOf(w); if (!en || !PRINTABLE.includes(en.appId)) return;
    if (en.appId === "photos" && !w.querySelector(".cr-ph-viewer")) return;
    if (/^(edge|browser|chrome)$/.test(en.appId) && isPdfTab(w)) return; // Edge prints its own PDF tabs
    e.preventDefault(); e.stopPropagation();
    printWin(w);
  }, true);
  function hookApps() {
    const s = document.getElementById("screen"); if (!s) { setTimeout(hookApps, 800); return; }
    const decorate = (win) => {
      const en = entryOf(win); if (!en) return;
      if (en.appId === "word") {
        const fm = win.querySelector(".wd-filemenu"); if (fm && !fm.querySelector(".pr-wd")) { const b = el(`<button class="pr-wd" title="Print (Ctrl+P)">Print</button>`); b.onclick = () => printWin(win); const sv = fm.querySelector('[data-f="saveas"]'); if (sv) sv.after(b); else fm.appendChild(b); }
      } else if (en.appId === "photos") {
        const bar = win.querySelector(".cr-ph-vbar"); if (bar && !bar.querySelector(".pr-ph")) { const b = el(`<button class="cr-ib pr-ph" title="Print (Ctrl+P)" aria-label="Print">${PRINT_ICON}</button>`); b.onclick = () => printWin(win); const more = bar.querySelector('[data-v="more"]'); if (more) more.before(b); else bar.appendChild(b); }
      } else if (en.appId === "edge" || en.appId === "browser" || en.appId === "chrome") {
        const pop = win.querySelector(".bb-menu-pop"); if (pop && !pop.querySelector(".pr-bb")) { const b = el(`<button class="pr-bb">Print… <span style="opacity:.6">Ctrl+P</span></button>`); b.onclick = () => { pop.remove(); printWin(win); }; const st = pop.querySelector('[data-a="settings"]'); if (st) st.before(b); else pop.appendChild(b); }
      }
    };
    const watched = new WeakSet();
    const watch = (win) => {
      if (watched.has(win)) return; const en = entryOf(win); if (!en || !["word", "photos", "edge", "browser", "chrome"].includes(en.appId)) return;
      watched.add(win);
      let t = 0; new MutationObserver(() => { if (!t) t = requestAnimationFrame(() => { t = 0; decorate(win); }); }).observe(win, { childList: true, subtree: true });
      decorate(win);
    };
    new MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.classList.contains("win")) setTimeout(() => watch(n), 0);
      // Paint's File menu is a popover on #screen: add "Print…" under "Export / download PNG".
      // (Edge's "Settings and more" menu is on <body>: see hookEdgeMenu.)
      if (n.classList.contains("cr-pop")) {
        const exp = [...n.querySelectorAll(".cr-menu-item")].find((b) => /Export \/ download PNG/.test(b.textContent)); if (!exp || n.querySelector(".pr-pt")) return;
        const win = n.__anchor && n.__anchor.closest && n.__anchor.closest(".win"); if (!win) return;
        const b = el(`<button class="cr-menu-item pr-pt" role="menuitem"><span class="cr-menu-ic">${PRINT_ICON}</span><span class="cr-menu-l">Print…</span><span class="cr-menu-k">Ctrl+P</span></button>`);
        b.onclick = () => { n.remove(); printWin(win); };
        exp.after(b);
      }
    }))).observe(s, { childList: true });
    s.querySelectorAll(".win").forEach(watch);
    // Edge / Chrome "Settings and more" menu (js/browser.js builds it on <body> as .eg-menu)
    new MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach((m) => {
      if (m.nodeType !== 1 || !m.classList.contains("eg-menu")) return;
      const read = m.querySelector('[data-a="read"]'); if (!read || m.querySelector('[data-a="print"], .pr-eg')) return; // PDF tabs already have Edge's own Print
      const win = topWin(); const en = win && entryOf(win); if (!en || !/^(edge|browser|chrome)$/.test(en.appId)) return;
      const b = el(`<button class="eg-mi pr-eg" role="menuitem" data-a="print12"><span class="eg-mi-ic">${PRINT_ICON}</span><span class="eg-mi-t">Print</span><span class="eg-mi-k">Ctrl+P</span></button>`);
      b.onclick = (e) => { e.stopPropagation(); m.remove(); printWin(win); };
      read.after(b);
    }))).observe(document.body, { childList: true });
  }

  // Start / search entry
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.printers = () => openSettings();
  try {
    if (window.Catalog && !Catalog.storeApps.find((a) => a.id === "printers")) Catalog.storeApps.push({ id: "printers", name: "Printers & scanners", cat: "System", price: 0, builtin: "printers", desc: "Microsoft Print to PDF, your device's printers, print queue and test page." });
  } catch (e) {}
  function boot() { hookSettings(); hookApps(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);

  window.Print12 = { print, makePdf, layout, htmlBlocks, textBlocks, prepare, parseRange, printers: PRINTERS, openSettings, printWin, lastPdf: null };
})();
