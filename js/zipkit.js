/* ZipKit — a small, dependency-free ZIP reader/writer for File Explorer.
   Writer: STORE always; DEFLATE through CompressionStream("deflate-raw") when the browser has it
   (Safari 16.4+, Chrome 103+) and it actually makes the entry smaller. CRC-32, UTF-8 names
   (general-purpose flag bit 11), folder entries ("name/"), MS-DOS dates, a correct central
   directory and end-of-central-directory record.
   Reader: finds the EOCD (and ZIP64 EOCD when present), walks the central directory, honours the
   UTF-8 flag (else CP437), the Info-ZIP Unicode Path extra field and ZIP64 extra fields, and
   inflates with DecompressionStream("deflate-raw") — or a built-in JavaScript inflater on older
   browsers — then checks the CRC-32 of every file it reads.
   API: ZipKit.zip(entries, opts) -> Promise<Blob>; ZipKit.unzip(blob|ArrayBuffer|Uint8Array) ->
   Promise<{ entries, comment }>; ZipKit.crc32(u8); ZipKit.inflateRaw(u8); ZipKit.canDeflate(). */
(function () {
  "use strict";

  // ---------- CRC-32 ----------
  const CRC_T = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8, prev) {
    let c = prev == null ? 0xffffffff : (prev ^ 0xffffffff) >>> 0;
    for (let i = 0, n = u8.length; i < n; i++) c = CRC_T[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // ---------- helpers ----------
  const enc = new TextEncoder();
  const utf8 = (s) => enc.encode(String(s));
  function toU8(x) {
    if (x == null) return Promise.resolve(new Uint8Array(0));
    if (x instanceof Uint8Array) return Promise.resolve(x);
    if (x instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(x));
    if (ArrayBuffer.isView(x)) return Promise.resolve(new Uint8Array(x.buffer, x.byteOffset, x.byteLength));
    if (typeof Blob !== "undefined" && x instanceof Blob) return x.arrayBuffer().then((b) => new Uint8Array(b));
    return Promise.resolve(utf8(x));
  }
  function dosDateTime(d) {
    d = d instanceof Date ? d : new Date(d || Date.now());
    if (isNaN(d.getTime())) d = new Date();
    let y = d.getFullYear(); if (y < 1980) return { time: 0, date: (0 << 9) | (1 << 5) | 1 }; if (y > 2107) y = 2107;
    return {
      time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31),
      date: (((y - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
    };
  }
  function fromDos(date, time) {
    const y = ((date >> 9) & 127) + 1980, mo = ((date >> 5) & 15) - 1, dd = date & 31;
    const h = (time >> 11) & 31, mi = (time >> 5) & 63, s = (time & 31) * 2;
    const d = new Date(y, Math.max(0, mo), Math.max(1, dd), h, mi, s);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }

  let deflateOK = null;
  function canDeflate() {
    if (deflateOK != null) return deflateOK;
    try { new CompressionStream("deflate-raw"); deflateOK = true; } catch (e) { deflateOK = false; }
    return deflateOK;
  }
  let inflateNative = null;
  function canInflateNative() {
    if (inflateNative != null) return inflateNative;
    try { new DecompressionStream("deflate-raw"); inflateNative = true; } catch (e) { inflateNative = false; }
    return inflateNative;
  }
  async function pump(u8, stream) {
    const s = new Blob([u8]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  // Formats that are already compressed — DEFLATE would only waste time on them.
  const PACKED = /\.(zip|7z|rar|gz|bz2|xz|jpe?g|png|gif|webp|heic|avif|mp[34]|m4[av]|mov|webm|mkv|ogg|oga|opus|aac|flac|docx|xlsx|pptx|pdf)$/i;

  // ---------- writer ----------
  // entries: [{ name: "folder/file.txt", data: Uint8Array|Blob|string, dir: bool, date: Date|ms }]
  // opts: { method: "auto" | "store", onProgress(done, total) }
  async function zip(entries, opts) {
    opts = opts || {};
    const parts = [], central = [];
    let offset = 0, count = 0;
    const seen = new Set();
    const list = (entries || []).filter((e) => e && e.name != null);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      let name = String(e.name).replace(/\\/g, "/").replace(/^\/+/, "");
      const isDir = !!e.dir || /\/$/.test(name);
      if (isDir && !/\/$/.test(name)) name += "/";
      if (!name || seen.has(name)) continue; seen.add(name);
      const nameU8 = utf8(name);
      const raw = isDir ? new Uint8Array(0) : await toU8(e.data);
      const crc = isDir ? 0 : crc32(raw);
      let method = 0, body = raw;
      if (!isDir && raw.length > 64 && opts.method !== "store" && canDeflate() && !PACKED.test(name)) {
        try { const d = await pump(raw, new CompressionStream("deflate-raw")); if (d.length < raw.length) { method = 8; body = d; } } catch (err) { /* keep STORE */ }
      }
      if (body.length > 0xfffffffe || raw.length > 0xfffffffe || offset > 0xfffffffe) throw new Error("This ZIP would be bigger than 4 GB, which isn't supported.");
      const { time, date } = dosDateTime(e.date);
      const ver = method === 8 ? 20 : (isDir ? 20 : 10);
      const flags = 0x0800; // bit 11: names are UTF-8
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, ver, true); lh.setUint16(6, flags, true); lh.setUint16(8, method, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, body.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, nameU8.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nameU8, body);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); /* made by: MS-DOS / v2.0 */ ch.setUint16(6, ver, true);
      ch.setUint16(8, flags, true); ch.setUint16(10, method, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true); ch.setUint32(24, raw.length, true);
      ch.setUint16(28, nameU8.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
      ch.setUint32(38, isDir ? 0x10 : 0x20, true); /* DOS attributes: directory / archive */ ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameU8);
      offset += 30 + nameU8.length + body.length; count++;
      if (opts.onProgress) try { opts.onProgress(i + 1, list.length); } catch (err) {}
    }
    if (count > 0xfffe) throw new Error("Too many files for one ZIP (65,534 max).");
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true); eo.setUint16(4, 0, true); eo.setUint16(6, 0, true);
    eo.setUint16(8, count, true); eo.setUint16(10, count, true); eo.setUint32(12, cdSize, true); eo.setUint32(16, offset, true); eo.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [new Uint8Array(eo.buffer)]), { type: "application/zip" });
  }

  // ---------- reader ----------
  const CP437 = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
  const utf8Strict = (() => { try { return new TextDecoder("utf-8", { fatal: true }); } catch (e) { return null; } })();
  const utf8Loose = new TextDecoder("utf-8");
  function decodeName(u8, isUtf8) {
    if (isUtf8) return utf8Loose.decode(u8);
    let ascii = true; for (let i = 0; i < u8.length; i++) if (u8[i] > 127) { ascii = false; break; }
    if (ascii) return utf8Loose.decode(u8);
    if (utf8Strict) { try { return utf8Strict.decode(u8); } catch (e) { /* not UTF-8: CP437 */ } }
    let s = ""; for (let i = 0; i < u8.length; i++) s += u8[i] < 128 ? String.fromCharCode(u8[i]) : CP437[u8[i] - 128];
    return s;
  }
  const u64 = (dv, o) => dv.getUint32(o, true) + dv.getUint32(o + 4, true) * 4294967296;

  async function unzip(src) {
    const u8 = await toU8(src);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const n = u8.length;
    if (n < 22) throw new Error("This isn't a ZIP file (it's too small).");
    let eocd = -1;
    for (let i = n - 22, stop = Math.max(0, n - 22 - 65535); i >= stop; i--) {
      if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 5 && u8[i + 3] === 6) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("This isn't a ZIP file, or it's damaged (no central directory).");
    let total = dv.getUint16(eocd + 10, true), cdSize = dv.getUint32(eocd + 12, true), cdOff = dv.getUint32(eocd + 16, true);
    const cLen = dv.getUint16(eocd + 20, true);
    const comment = decodeName(u8.subarray(eocd + 22, Math.min(n, eocd + 22 + cLen)), true);
    if ((total === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) && eocd >= 20 && dv.getUint32(eocd - 20, true) === 0x07064b50) {
      const z64 = u64(dv, eocd - 12);
      if (z64 + 56 <= n && dv.getUint32(z64, true) === 0x06064b50) { total = u64(dv, z64 + 32); cdSize = u64(dv, z64 + 40); cdOff = u64(dv, z64 + 48); }
    }
    // Some writers prepend data (self-extractors): shift offsets if the CD isn't where it says.
    let shift = 0;
    if (cdOff + 4 > n || dv.getUint32(cdOff, true) !== 0x02014b50) {
      const guess = eocd - cdSize;
      if (guess >= 0 && dv.getUint32(guess, true) === 0x02014b50) shift = guess - cdOff; else throw new Error("This ZIP file is damaged (bad central directory).");
    }
    const entries = [];
    let p = cdOff + shift;
    for (let k = 0; k < total; k++) {
      if (p + 46 > n || dv.getUint32(p, true) !== 0x02014b50) break;
      const madeBy = dv.getUint16(p + 4, true), flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
      const time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true), crc = dv.getUint32(p + 16, true);
      let csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const ext = dv.getUint32(p + 38, true); let lho = dv.getUint32(p + 42, true);
      const nameU8 = u8.subarray(p + 46, p + 46 + nl);
      let name = decodeName(nameU8, !!(flags & 0x800));
      let x = p + 46 + nl; const xEnd = x + xl;
      while (x + 4 <= xEnd) {
        const id = dv.getUint16(x, true), sz = dv.getUint16(x + 2, true); let q = x + 4;
        if (id === 0x0001) {
          if (size === 0xffffffff && q + 8 <= x + 4 + sz) { size = u64(dv, q); q += 8; }
          if (csize === 0xffffffff && q + 8 <= x + 4 + sz) { csize = u64(dv, q); q += 8; }
          if (lho === 0xffffffff && q + 8 <= x + 4 + sz) { lho = u64(dv, q); q += 8; }
        } else if (id === 0x7075 && sz > 5 && u8[q] === 1 && dv.getUint32(q + 1, true) === crc32(nameU8)) {
          name = utf8Loose.decode(u8.subarray(q + 5, x + 4 + sz));
        }
        x += 4 + sz;
      }
      name = name.replace(/\\/g, "/");
      const host = madeBy >> 8;
      const dir = /\/$/.test(name) || (size === 0 && (host === 0 || host === 11 || host === 14) && (ext & 0x10) !== 0);
      const off = lho + shift;
      entries.push({
        name: dir && !/\/$/.test(name) ? name + "/" : name, dir, size, csize, method, crc, flags,
        encrypted: !!(flags & 1), date: fromDos(date, time),
        read: () => readEntry(u8, dv, off, csize, size, method, crc, flags, name),
      });
      p = xEnd + cl;
    }
    return { entries, comment };
  }
  async function readEntry(u8, dv, off, csize, size, method, crc, flags, name) {
    if (flags & 1) throw new Error("“" + name + "” is password-protected. Password-protected ZIPs aren't supported.");
    if (off + 30 > u8.length || dv.getUint32(off, true) !== 0x04034b50) throw new Error("“" + name + "” is damaged (bad local header).");
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const comp = u8.subarray(start, start + csize);
    let out;
    if (method === 0) out = comp.slice();
    else if (method === 8) {
      if (canInflateNative()) { try { out = await pump(comp, new DecompressionStream("deflate-raw")); } catch (e) { out = inflateRaw(comp, size); } }
      else out = inflateRaw(comp, size);
    } else throw new Error("“" + name + "” uses a compression method (" + method + ") that isn't supported.");
    if (out.length !== size) out = out.subarray(0, size);
    if (crc32(out) !== crc) throw new Error("“" + name + "” is damaged (CRC check failed).");
    return out;
  }

  // ---------- pure-JS raw DEFLATE decoder (fallback for browsers without DecompressionStream) ----------
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function huff(lengths, n) {
    const counts = new Uint16Array(16), offs = new Uint16Array(16), symbols = new Uint16Array(n);
    for (let i = 0; i < n; i++) counts[lengths[i]]++;
    counts[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
    for (let i = 0; i < n; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
    return { counts, symbols };
  }
  let FIXED = null;
  function fixed() {
    if (FIXED) return FIXED;
    const l = new Uint8Array(288); l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
    const d = new Uint8Array(30).fill(5);
    return (FIXED = { lit: huff(l, 288), dist: huff(d, 30) });
  }
  function inflateRaw(src, sizeHint) {
    let pos = 0, bitbuf = 0, bitcnt = 0, op = 0;
    let out = new Uint8Array(Math.max(1024, sizeHint || src.length * 4));
    const need = (k) => { if (op + k > out.length) { let nl = out.length * 2; while (nl < op + k) nl *= 2; const o = new Uint8Array(nl); o.set(out.subarray(0, op)); out = o; } };
    const bits = (k) => {
      while (bitcnt < k) { if (pos >= src.length) throw new Error("ZIP data ended too soon."); bitbuf |= src[pos++] << bitcnt; bitcnt += 8; }
      const v = bitbuf & ((1 << k) - 1); bitbuf >>>= k; bitcnt -= k; return v;
    };
    const decode = (h) => {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= bits(1); const count = h.counts[len];
        if (code - count < first) return h.symbols[index + (code - first)];
        index += count; first += count; first <<= 1; code <<= 1;
      }
      throw new Error("ZIP data is damaged (bad Huffman code).");
    };
    let last = 0;
    do {
      last = bits(1); const type = bits(2);
      if (type === 0) {
        bitbuf = 0; bitcnt = 0;
        if (pos + 4 > src.length) throw new Error("ZIP data ended too soon.");
        const len = src[pos] | (src[pos + 1] << 8), nlen = src[pos + 2] | (src[pos + 3] << 8); pos += 4;
        if ((len ^ 0xffff) !== nlen) throw new Error("ZIP data is damaged (stored block).");
        if (pos + len > src.length) throw new Error("ZIP data ended too soon.");
        need(len); out.set(src.subarray(pos, pos + len), op); op += len; pos += len;
      } else if (type === 1 || type === 2) {
        let lit, dist;
        if (type === 1) { const f = fixed(); lit = f.lit; dist = f.dist; }
        else {
          const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
          const cl = new Uint8Array(19); for (let i = 0; i < hclen; i++) cl[ORDER[i]] = bits(3);
          const clh = huff(cl, 19);
          const lens = new Uint8Array(hlit + hdist);
          for (let i = 0; i < hlit + hdist;) {
            const sym = decode(clh);
            if (sym < 16) lens[i++] = sym;
            else {
              let rep = 0, val = 0;
              if (sym === 16) { if (!i) throw new Error("ZIP data is damaged."); val = lens[i - 1]; rep = 3 + bits(2); }
              else if (sym === 17) rep = 3 + bits(3); else rep = 11 + bits(7);
              if (i + rep > hlit + hdist) throw new Error("ZIP data is damaged.");
              while (rep--) lens[i++] = val;
            }
          }
          lit = huff(lens.subarray(0, hlit), hlit); dist = huff(lens.subarray(hlit), hdist);
        }
        for (;;) {
          const sym = decode(lit);
          if (sym < 256) { need(1); out[op++] = sym; }
          else if (sym === 256) break;
          else {
            const li = sym - 257; if (li >= 29) throw new Error("ZIP data is damaged.");
            const len = LBASE[li] + bits(LEXT[li]);
            const ds = decode(dist); if (ds >= 30) throw new Error("ZIP data is damaged.");
            const d = DBASE[ds] + bits(DEXT[ds]);
            if (d > op) throw new Error("ZIP data is damaged (distance too far).");
            need(len);
            for (let i = 0; i < len; i++, op++) out[op] = out[op - d];
          }
        }
      } else throw new Error("ZIP data is damaged (bad block type).");
    } while (!last);
    return out.subarray(0, op);
  }

  window.ZipKit = { zip, unzip, crc32, inflateRaw, canDeflate, canInflateNative, dosDateTime, fromDos };
})();
