/* FL Studio (Image-Line) — a working FL Studio 21-style DAW for the Windows 12 simulation.
   Everything you hear is synthesised live with the Web Audio API:
   - Channel Rack: step sequencer (16 / 32 steps), mute / solo, volume & pan knobs, swing.
   - Instruments: synthesised drums (kick = pitch-swept sine, snare = noise + tone, clap = filtered
     noise bursts, hats = high-passed metallic noise, toms, percussion) and a "3x Osc"-style synth
     (three oscillators, unison, FM, ADSR, resonant lowpass with its own envelope) for leads, pads,
     keys and basses.
   - Piano Roll, Playlist (pattern clips arranged into a song), Mixer (master + inserts, faders,
     pan, mute, reverb / delay sends, a limiter on the master, live AnalyserNode peak meters).
   - Lookahead scheduler (25 ms timer scheduling ~100 ms ahead on AudioContext time), swing,
     metronome, record (keyboard / pads into the pattern while playing).
   - Export WAV: OfflineAudioContext render -> 16-bit PCM WAV saved to Documents › FL Studio ›
     Exports (VFS) and offered as a download / share.
   - Projects: JSON ".flp" files in Documents › FL Studio › Projects; autosave in appData.flstudio.
   Touch-first (iPad): pointer events, >= 32 px targets, the AudioContext is created / resumed
   inside the first user gesture, every timer and the audio graph are torn down on close.
   Styles: css/flstudio.css (every class prefixed fl-). Icon: assets/flstudio.svg. */
(function () {
  "use strict";
  if (window.FLStudio) return;

  // =====================================================================
  //  Utilities
  // =====================================================================
  const S = () => State.data;
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d, a, b) => { v = +v; return isFinite(v) ? clamp(v, a, b) : d; };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteName = (m) => NOTE_NAMES[((m % 12) + 12) % 12] + Math.floor(m / 12); // FL naming: MIDI 60 = C5
  const isBlack = (m) => [1, 3, 6, 8, 10].indexOf(((m % 12) + 12) % 12) >= 0;
  const ACtor = () => window.AudioContext || window.webkitAudioContext;
  const OACtor = () => window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const pad2 = (n) => String(n).padStart(2, "0");
  const fmtSize = (b) => (b < 1024 ? b + " B" : b < 1048576 ? Math.ceil(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB");
  const fmtDur = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + pad2(s % 60); };

  // Gain laws (FL-like: knob / fader positions map to dB, 0 dB a little below the top).
  const chanGain = (v) => Math.pow(clamp(v, 0, 1) / 0.78, 2);           // channel volume: 78 % = 0 dB
  const faderGain = (v) => (v <= 0.001 ? 0 : Math.pow(clamp(v, 0, 1) / 0.8, 2.2)); // mixer fader: 80 % = 0 dB
  const mainGain = (v) => Math.pow(clamp(v, 0, 1) / 0.8, 2);            // toolbar master volume
  const toDb = (g) => (g <= 0.00001 ? "-inf" : (20 * Math.log10(g) >= 0 ? "+" : "") + (20 * Math.log10(g)).toFixed(1)) + " dB";
  function sysVolume() {
    try { const q = S().appData && S().appData.quickSettings; const v = q && typeof q.volume === "number" ? q.volume : 55; return clamp(v, 0, 100) / 100; } catch (e) { return 0.55; }
  }

  // =====================================================================
  //  Icons (SVG only — never emoji)
  // =====================================================================
  const IC = {
    play: '<path d="M7 4.6v14.8L19.4 12z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="5" width="4.3" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.7" y="5" width="4.3" height="14" rx="1" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.6" fill="currentColor" stroke="none"/>',
    rec: '<circle cx="12" cy="12" r="6.6" fill="currentColor" stroke="none"/>',
    metro: '<path d="M9 3.5h6l3.6 17H5.4z"/><path d="M12 15.5l5.2-9.5"/><path d="M7.2 16.5h9.6"/>',
    playlist: '<rect x="3" y="4" width="18" height="16" rx="1.6"/><g fill="currentColor" stroke="none"><rect x="5.5" y="7" width="6.5" height="2.8" rx=".6"/><rect x="12.2" y="10.6" width="6.4" height="2.8" rx=".6"/><rect x="7.2" y="14.2" width="6.4" height="2.8" rx=".6"/></g>',
    rack: '<rect x="3" y="4" width="18" height="16" rx="1.6"/><path d="M3 9.3h18M3 14.7h18"/><g fill="currentColor" stroke="none"><rect x="9.4" y="5.5" width="2.6" height="2.6" rx=".4"/><rect x="15.2" y="5.5" width="2.6" height="2.6" rx=".4"/><rect x="12.3" y="10.7" width="2.6" height="2.6" rx=".4"/><rect x="17.2" y="16" width="2.6" height="2.6" rx=".4"/><rect x="5.3" y="16" width="2.6" height="2.6" rx=".4"/></g>',
    piano: '<rect x="3" y="4" width="18" height="16" rx="1.6"/><path d="M8.6 13v7M15.4 13v7"/><g fill="currentColor" stroke="none"><rect x="7" y="4" width="3.2" height="9" rx=".4"/><rect x="13.8" y="4" width="3.2" height="9" rx=".4"/></g>',
    mixer: '<path d="M6 4v16M12 4v16M18 4v16"/><g fill="currentColor" stroke="none"><rect x="3.6" y="13" width="4.8" height="3.2" rx=".8"/><rect x="9.6" y="6.6" width="4.8" height="3.2" rx=".8"/><rect x="15.6" y="10.6" width="4.8" height="3.2" rx=".8"/></g>',
    browser: '<path d="M3 6.6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M7 12.4h10M7 15.6h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    more: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    chev: '<path d="M7 10l5 5 5-5"/>',
    chevR: '<path d="M10 7l5 5-5 5"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>',
    folder: '<path d="M3 6.6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    save: '<path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    share: '<path d="M12 15V4M8 7.5L12 3.6l4 3.9"/><path d="M6.5 11H5.6a.9.9 0 0 0-.9.9v7.6c0 .5.4.9.9.9h12.8c.5 0 .9-.4.9-.9v-7.6a.9.9 0 0 0-.9-.9h-.9"/>',
    undo: '<path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11"/>',
    redo: '<path d="M15 7l4.5 4.5L15 16"/><path d="M19 11.5H9.5a5 5 0 0 0 0 10H13"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.6h5V7M6.5 7l1 13h9l1-13"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1.6"/><path d="M16 8V5.6A1.6 1.6 0 0 0 14.4 4H5.6A1.6 1.6 0 0 0 4 5.6v8.8A1.6 1.6 0 0 0 5.6 16H8"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="1.6"/><path d="M6 9.5h.01M9 9.5h.01M12 9.5h.01M15 9.5h.01M18 9.5h.01M7.5 14.5h9"/>',
    zin: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5"/>',
    zout: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5"/>',
    sine: '<path d="M2.5 12c2.4-7.4 5.1-7.4 7.5 0s5.1 7.4 7.5 0 2.6-3.6 4-3.6"/>',
    sawtooth: '<path d="M2.5 17.5L11 6.5v11l8.5-11v11"/>',
    square: '<path d="M2.5 17h4.5V7h7v10h7V9"/>',
    triangle: '<path d="M2.5 15l4.8-8 9.4 13 4.8-8"/>',
    note: '<path d="M9.5 17.5V5.5l10-2v12"/><circle cx="7" cy="17.5" r="2.5"/><circle cx="17" cy="15.5" r="2.5"/>',
    drum: '<ellipse cx="12" cy="8.5" rx="8" ry="3.2"/><path d="M4 8.5v7c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2v-7"/><path d="M4.8 11.6l4 6.2M19.2 11.6l-4 6.2"/>',
    wave: '<path d="M2.5 12h2.6l2-6 3.4 13 3.2-10 2.2 6 1.6-3h4"/>',
    project: '<path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M9 16.5v-5l4.5-1v4.5"/><circle cx="8.2" cy="16.6" r="1.1" fill="currentColor"/><circle cx="12.7" cy="15.2" r="1.1" fill="currentColor"/>',
    audio: '<path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M8 14h1.4l1-3 1.8 6 1.4-4.4.9 1.4H16"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    snap: '<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 8h4M14 8h4"/>',
    pencil: '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M14 7l3.5 3.5"/>',
    solo: '<path d="M16.2 7.4c-.7-1.4-2.3-2.4-4.3-2.4-2.4 0-4.1 1.3-4.1 3.2 0 4.2 8.6 2.6 8.6 7.1 0 2-1.9 3.6-4.5 3.6-2.2 0-4-1-4.7-2.7"/>',
  };
  const ic = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${IC[n] || ""}</svg>`;
  // Small fruit mark used in the toolbar (original artwork, matches assets/flstudio.svg).
  const FRUIT = `<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" focusable="false"><defs><radialGradient id="flFrG" cx=".38" cy=".36" r=".72"><stop offset="0" stop-color="#ffd884"/><stop offset=".5" stop-color="#ff9a30"/><stop offset="1" stop-color="#d9520c"/></radialGradient></defs><path d="M16 8.6c4.6-3.2 9.3-1.6 9.3-1.6s-1.9 4.5-6.9 4.6" fill="#7cc644"/><path d="M15.4 9.2c-2.1-4.2-6.4-5-6.4-5s-.6 4.7 4.2 6.5" fill="#5fae36"/><circle cx="16" cy="19" r="10" fill="url(#flFrG)"/><path d="M11.6 15h5.2M11.6 15v9M11.6 19.2h4M18.8 15v9h4.4" fill="none" stroke="#3a1e06" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" opacity=".82"/></svg>`;

  // =====================================================================
  //  Instruments
  // =====================================================================
  function noiseBuf(ctx) {
    if (ctx.__flNoise) return ctx.__flNoise;
    const len = Math.floor(ctx.sampleRate * 1.5), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
    ctx.__flNoise = b; return b;
  }
  function impulse(ctx, secs, decay) {
    const sr = ctx.sampleRate, len = Math.floor(sr * secs), b = ctx.createBuffer(2, len, sr);
    let seed = 4242;
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let y = 0;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const n = seed / 2147483648 - 1, t = i / len;
        const a = 0.92 - 0.75 * t;                        // one-pole lowpass that darkens the tail
        y += a * (n - y);
        const pre = i < sr * 0.012 ? 0 : 1;               // ~12 ms pre-delay
        d[i] = y * Math.pow(1 - t, decay) * pre * 0.9;
      }
    }
    return b;
  }
  const curves = {};
  function shaper(ctx, amt) {
    const k = Math.round(clamp(amt, 0, 1) * 20) / 20;
    if (!curves[k]) {
      const n = 1024, c = new Float32Array(n), d = 1 + k * 8;
      for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * d) / Math.tanh(d); }
      curves[k] = c;
    }
    const ws = ctx.createWaveShaper(); ws.curve = curves[k]; ws.oversample = "2x"; return ws;
  }
  const gainN = (ctx, v) => { const g = ctx.createGain(); g.gain.value = v == null ? 1 : v; return g; };
  const biq = (ctx, type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q == null ? 0.7 : q; return b; };
  const oscN = (ctx, type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  function noiseSrc(ctx, t) { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.loop = true; s.__off = (t * 0.6180339) % 1.2; return s; }
  function oneShot(t, vg, srcs, len) {
    srcs.forEach((s) => { s.start(t, s.__off || 0); s.stop(t + len); });
    return { srcs, g: vg, start: t, end: t + len, release() {} };
  }
  const st2 = (semi) => Math.pow(2, semi / 12);
  function metallic(ctx, t, f, dest, srcs) {
    [2, 3, 4.16, 5.43, 6.79, 8.21].forEach((r) => { const o = oscN(ctx, "square", f * r); o.connect(dest); srcs.push(o); });
  }

  const DRUM = {
    kick(ctx, out, t, semi, vel, p) {
      const vg = gainN(ctx, 0); let dst = out;
      if (p.drive > 0.02) { const ws = shaper(ctx, p.drive); ws.connect(out); dst = ws; }
      vg.connect(dst);
      const base = 49 * st2((p.tune || 0) + semi), dec = Math.max(0.06, p.decay);
      const o = oscN(ctx, "sine", base);
      o.frequency.setValueAtTime(base * (1.6 + 4.2 * p.punch), t);
      o.frequency.exponentialRampToValueAtTime(base * 1.12, t + 0.035 + 0.04 * (1 - p.punch));
      o.frequency.exponentialRampToValueAtTime(base, t + 0.16);
      const og = gainN(ctx, 1); o.connect(og); og.connect(vg);
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(vel * 0.95, t + 0.002);
      vg.gain.exponentialRampToValueAtTime(vel * 0.62, t + dec * 0.3);
      vg.gain.exponentialRampToValueAtTime(0.0004, t + dec);
      const srcs = [o];
      if (p.click > 0.01) {
        const n = noiseSrc(ctx, t), hp = biq(ctx, "highpass", 1900, 0.8), cg = gainN(ctx, 0);
        cg.gain.setValueAtTime(p.click * 0.9, t); cg.gain.exponentialRampToValueAtTime(0.0005, t + 0.014);
        n.connect(hp); hp.connect(cg); cg.connect(vg); srcs.push(n);
      }
      return oneShot(t, vg, srcs, dec + 0.04);
    },
    snare(ctx, out, t, semi, vel, p) {
      const vg = gainN(ctx, vel); vg.connect(out);
      const f = 186 * st2((p.tune || 0) + semi), dec = Math.max(0.04, p.decay);
      const o = oscN(ctx, "triangle", f * 1.55); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      const og = gainN(ctx, 0); og.gain.setValueAtTime(p.tone * 1.1, t); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.09 + dec * 0.25);
      o.connect(og); og.connect(vg);
      const n = noiseSrc(ctx, t), hp = biq(ctx, "highpass", 900 + p.snappy * 2400, 0.7), pk = biq(ctx, "peaking", 5200, 1); pk.gain.value = 4;
      const ng = gainN(ctx, 0); ng.gain.setValueAtTime(0.85 * (1 - p.tone * 0.35), t); ng.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      n.connect(hp); hp.connect(pk); pk.connect(ng); ng.connect(vg);
      return oneShot(t, vg, [o, n], dec + 0.08);
    },
    clap(ctx, out, t, semi, vel, p) {
      const vg = gainN(ctx, vel * 2.2); vg.connect(out);
      const n = noiseSrc(ctx, t), bp = biq(ctx, "bandpass", (p.tone || 1150) * st2(semi), 1.3), hp = biq(ctx, "highpass", 650, 0.7), eg = gainN(ctx, 0);
      const sp = p.spread || 0.0105, dec = Math.max(0.04, p.decay);
      eg.gain.setValueAtTime(0, t);
      for (let i = 0; i < 3; i++) { const tt = t + i * sp; eg.gain.setValueAtTime(1, tt); eg.gain.exponentialRampToValueAtTime(0.06, tt + sp * 0.95); }
      const tt = t + 3 * sp; eg.gain.setValueAtTime(0.95, tt); eg.gain.exponentialRampToValueAtTime(0.0005, tt + dec);
      n.connect(bp); bp.connect(hp); hp.connect(eg); eg.connect(vg);
      return oneShot(t, vg, [n], 3 * sp + dec + 0.03);
    },
    hat(ctx, out, t, semi, vel, p) {
      const vg = gainN(ctx, vel * 1.6); vg.connect(out);
      const mix = gainN(ctx, 0.5), bp = biq(ctx, "bandpass", 10000, 0.8), hp = biq(ctx, "highpass", p.tone || 7200, 0.7), eg = gainN(ctx, 0), dec = Math.max(0.015, p.decay);
      const srcs = []; metallic(ctx, t, 40 * st2((p.tune || 0) + semi), mix, srcs);
      if (p.noise > 0.01) { const n = noiseSrc(ctx, t), ng = gainN(ctx, p.noise * 1.4); n.connect(ng); ng.connect(bp); srcs.push(n); }
      mix.connect(bp); bp.connect(hp); hp.connect(eg); eg.connect(vg);
      eg.gain.setValueAtTime(0, t); eg.gain.linearRampToValueAtTime(1, t + 0.001); eg.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      return oneShot(t, vg, srcs, dec + 0.02);
    },
    tom(ctx, out, t, semi, vel, p) {
      const vg = gainN(ctx, 0); vg.connect(out);
      const f = (p.base || 140) * st2((p.tune || 0) + semi), dec = Math.max(0.05, p.decay);
      const o = oscN(ctx, "sine", f * 1.5); o.frequency.exponentialRampToValueAtTime(f, t + 0.04); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + dec);
      o.connect(vg);
      const n = noiseSrc(ctx, t), nb = biq(ctx, "bandpass", f * 4, 1), ng = gainN(ctx, 0);
      ng.gain.setValueAtTime(0.25, t); ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.03);
      n.connect(nb); nb.connect(ng); ng.connect(vg);
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(vel * 1.25, t + 0.002); vg.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      return oneShot(t, vg, [o, n], dec + 0.03);
    },
    cowbell(ctx, out, t, semi, vel, p) {
      const vg = gainN(ctx, vel * 0.95); vg.connect(out);
      const k = st2((p.tune || 0) + semi), mix = gainN(ctx, 0.5), bp = biq(ctx, "bandpass", 900 * k, 1.1), eg = gainN(ctx, 0), dec = Math.max(0.05, p.decay);
      const a = oscN(ctx, "square", 540 * k), b = oscN(ctx, "square", 800 * k); a.connect(mix); b.connect(mix); mix.connect(bp); bp.connect(eg); eg.connect(vg);
      eg.gain.setValueAtTime(0, t); eg.gain.linearRampToValueAtTime(1, t + 0.002); eg.gain.exponentialRampToValueAtTime(0.32, t + 0.03); eg.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      return oneShot(t, vg, [a, b], dec + 0.02);
    },
    rim(ctx, out, t, semi, vel, p) {
      const vg = gainN(ctx, vel * 0.8); vg.connect(out);
      const k = st2((p.tune || 0) + semi), dec = Math.max(0.01, p.decay);
      const o = oscN(ctx, "triangle", 1700 * k), hp = biq(ctx, "highpass", 500, 0.7), eg = gainN(ctx, 0);
      const n = noiseSrc(ctx, t), nb = biq(ctx, "bandpass", 3500 * k, 2), ng = gainN(ctx, 0.6);
      o.connect(hp); n.connect(nb); nb.connect(ng); ng.connect(hp); hp.connect(eg); eg.connect(vg);
      eg.gain.setValueAtTime(1, t); eg.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      return oneShot(t, vg, [o, n], dec + 0.02);
    },
    shaker(ctx, out, t, semi, vel, p) {
      const vg = gainN(ctx, vel * 1.0); vg.connect(out);
      const n = noiseSrc(ctx, t), bp = biq(ctx, "bandpass", (p.tone || 6500) * st2(semi), 1.4), eg = gainN(ctx, 0), dec = Math.max(0.02, p.decay);
      n.connect(bp); bp.connect(eg); eg.connect(vg);
      eg.gain.setValueAtTime(0, t); eg.gain.linearRampToValueAtTime(1, t + 0.012); eg.gain.exponentialRampToValueAtTime(0.0005, t + 0.012 + dec);
      return oneShot(t, vg, [n], dec + 0.03);
    },
    crash(ctx, out, t, semi, vel, p) {
      const vg = gainN(ctx, vel * 0.42); vg.connect(out);
      const mix = gainN(ctx, 0.35), hp = biq(ctx, "highpass", p.tone || 4500, 0.7), eg = gainN(ctx, 0), dec = Math.max(0.3, p.decay);
      const srcs = []; metallic(ctx, t, 62 * st2((p.tune || 0) + semi), mix, srcs);
      const n = noiseSrc(ctx, t), ng = gainN(ctx, 0.9); n.connect(ng); ng.connect(hp); srcs.push(n);
      mix.connect(hp); hp.connect(eg); eg.connect(vg);
      eg.gain.setValueAtTime(0, t); eg.gain.linearRampToValueAtTime(1, t + 0.003); eg.gain.exponentialRampToValueAtTime(0.25, t + 0.12); eg.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      return oneShot(t, vg, srcs, dec + 0.03);
    },
    snap(ctx, out, t, semi, vel, p) {
      const vg = gainN(ctx, vel * 3.4); vg.connect(out);
      const n = noiseSrc(ctx, t), bp = biq(ctx, "bandpass", (p.tone || 2300) * st2(semi), 2.4), eg = gainN(ctx, 0), dec = Math.max(0.02, p.decay);
      n.connect(bp); bp.connect(eg); eg.connect(vg);
      eg.gain.setValueAtTime(1, t); eg.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      return oneShot(t, vg, [n], dec + 0.02);
    },
  };

  // Subtractive / FM "3x Osc" style voice. dur == null -> held until voice.release(at).
  function synthPlay(ctx, out, t, midi, vel, dur, p) {
    const f0 = mtof(midi + (p.transpose || 0));
    const vg = gainN(ctx, 0), filt = biq(ctx, "lowpass", 1000, p.res || 0.7);
    filt.connect(vg); vg.connect(out);
    const srcs = [];
    let fm = null;
    if (p.fm && p.fm.index > 0) {
      const m = oscN(ctx, "sine", f0 * (p.fm.ratio || 1)), mg = gainN(ctx, 0);
      mg.gain.setValueAtTime(p.fm.index * f0, t); mg.gain.exponentialRampToValueAtTime(Math.max(0.5, p.fm.index * f0 * 0.06), t + Math.max(0.05, p.fm.decay || 0.5));
      m.connect(mg); srcs.push(m); fm = mg;
    }
    (p.osc || []).forEach((o) => {
      if (!o || !(o.vol > 0)) return;
      const n = clamp(Math.round(o.uni || 1), 1, 7);
      for (let u = 0; u < n; u++) {
        const osc = oscN(ctx, o.wave || "sawtooth", f0 * st2(o.semi || 0));
        osc.detune.value = (o.det || 0) + (n > 1 ? (u / (n - 1) - 0.5) * 2 * (o.spread || 15) : 0);
        const g = gainN(ctx, o.vol / Math.sqrt(n));
        if (fm) fm.connect(osc.frequency);
        osc.connect(g); g.connect(filt); srcs.push(osc);
      }
    });
    const track = Math.pow(f0 / 261.6, 0.35);
    const cut = clamp((p.cutoff || 2000) * track, 40, 19000), peakF = clamp(cut * Math.pow(2, p.fenv || 0), 40, 19000);
    filt.frequency.setValueAtTime(peakF, t);
    filt.frequency.setTargetAtTime(cut, t + 0.003, Math.max(0.004, (p.fdec || 0.3) / 3));
    const A = Math.max(0.002, p.a || 0), D = Math.max(0.01, p.d || 0.2), Sus = clamp(p.s == null ? 0.7 : p.s, 0, 1), R = Math.max(0.015, p.r || 0.1);
    const peak = vel * (p.gain || 0.25);
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(peak, t + A); vg.gain.setTargetAtTime(peak * Sus, t + A, D / 3);
    srcs.forEach((s) => s.start(t));
    const voice = {
      srcs, g: vg, start: t, end: t + 600, released: false,
      release(at) {
        if (this.released) return; this.released = true;
        at = Math.max(at, t + 0.004);
        const e = at - t;
        if (e < A) {
          const v = (peak * e) / A;
          vg.gain.cancelScheduledValues(t); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(v, at);
        } else {
          const v = peak * Sus + (peak - peak * Sus) * Math.exp(-(e - A) / (D / 3));
          vg.gain.cancelScheduledValues(at); vg.gain.setValueAtTime(v, at);
        }
        vg.gain.setTargetAtTime(0, at, R / 4);
        const stopAt = at + R * 1.4 + 0.05;
        srcs.forEach((s) => { try { s.stop(stopAt); } catch (er) {} });
        this.end = stopAt;
      },
    };
    if (dur != null) voice.release(t + Math.max(0.01, dur));
    return voice;
  }

  const P = (k, label, min, max, def, unit) => ({ k, label, min, max, def, unit: unit || "" });
  const INSTR = {
    kick: { name: "Kick", kind: "drum", play: DRUM.kick, params: [P("tune", "Tune", -12, 12, 0, "st"), P("decay", "Decay", 0.08, 1.6, 0.42, "s"), P("punch", "Punch", 0, 1, 0.62), P("click", "Click", 0, 1, 0.35), P("drive", "Drive", 0, 1, 0.05)] },
    snare: { name: "Snare", kind: "drum", play: DRUM.snare, params: [P("tune", "Tune", -12, 12, 0, "st"), P("decay", "Decay", 0.05, 0.7, 0.2, "s"), P("tone", "Tone", 0, 1, 0.45), P("snappy", "Snappy", 0, 1, 0.55)] },
    clap: { name: "Clap", kind: "drum", play: DRUM.clap, params: [P("tone", "Tone", 500, 3000, 1150, "Hz"), P("decay", "Decay", 0.05, 0.9, 0.22, "s"), P("spread", "Spread", 0.005, 0.022, 0.0105, "s")] },
    hat: { name: "Hat", kind: "drum", play: DRUM.hat, params: [P("tune", "Tune", -12, 12, 0, "st"), P("decay", "Decay", 0.015, 0.6, 0.055, "s"), P("tone", "Tone", 2500, 12000, 7200, "Hz"), P("noise", "Noise", 0, 1, 0.35)] },
    ohat: { name: "Open Hat", kind: "drum", play: DRUM.hat, params: [P("tune", "Tune", -12, 12, 0, "st"), P("decay", "Decay", 0.05, 1.2, 0.34, "s"), P("tone", "Tone", 2500, 12000, 6800, "Hz"), P("noise", "Noise", 0, 1, 0.4)] },
    tom: { name: "Tom", kind: "drum", play: DRUM.tom, params: [P("tune", "Tune", -12, 12, 0, "st"), P("decay", "Decay", 0.08, 1.2, 0.36, "s"), P("base", "Pitch", 60, 400, 140, "Hz")] },
    cowbell: { name: "Cowbell", kind: "drum", play: DRUM.cowbell, params: [P("tune", "Tune", -12, 12, 0, "st"), P("decay", "Decay", 0.05, 1, 0.3, "s")] },
    rim: { name: "Rim", kind: "drum", play: DRUM.rim, params: [P("tune", "Tune", -12, 12, 0, "st"), P("decay", "Decay", 0.01, 0.2, 0.04, "s")] },
    shaker: { name: "Shaker", kind: "drum", play: DRUM.shaker, params: [P("tone", "Tone", 2500, 11000, 6500, "Hz"), P("decay", "Decay", 0.02, 0.4, 0.08, "s")] },
    crash: { name: "Crash", kind: "drum", play: DRUM.crash, params: [P("tune", "Tune", -12, 12, 0, "st"), P("decay", "Decay", 0.4, 3, 1.7, "s"), P("tone", "Tone", 2000, 9000, 4500, "Hz")] },
    snap: { name: "Snap", kind: "drum", play: DRUM.snap, params: [P("tone", "Tone", 900, 5000, 2300, "Hz"), P("decay", "Decay", 0.02, 0.3, 0.06, "s")] },
    synth: { name: "3x Osc", kind: "synth" },
  };
  const DRUM_TYPES = Object.keys(INSTR).filter((k) => INSTR[k].kind === "drum");

  const O = (wave, vol, semi, det, extra) => Object.assign({ wave, vol, semi: semi || 0, det: det || 0 }, extra || {});
  const SYNTHS = {
    "3x Osc": { osc: [O("sawtooth", 0.5), O("sawtooth", 0.45, 0, 9), O("square", 0.3, -12)], a: 0.004, d: 0.32, s: 0.35, r: 0.22, cutoff: 1500, res: 2.2, fenv: 2.2, fdec: 0.28, gain: 0.3 },
    "Pluck": { osc: [O("sawtooth", 0.55), O("square", 0.35, 0, -8), O("triangle", 0.25, 12)], a: 0.002, d: 0.3, s: 0, r: 0.2, cutoff: 900, res: 3, fenv: 3.2, fdec: 0.18, gain: 0.4 },
    "Supersaw Lead": { osc: [O("sawtooth", 0.62, 0, 0, { uni: 5, spread: 16 }), O("square", 0.12, 12), O("sine", 0.25, -12)], a: 0.008, d: 0.4, s: 0.75, r: 0.28, cutoff: 3400, res: 1.2, fenv: 1.2, fdec: 0.35, gain: 0.34 },
    "Square Lead": { osc: [O("square", 0.55), O("square", 0.4, 0, 12), O("triangle", 0.3, 12)], a: 0.004, d: 0.25, s: 0.7, r: 0.16, cutoff: 2600, res: 2.5, fenv: 1.5, fdec: 0.2, gain: 0.3 },
    "Soft Pad": { osc: [O("sawtooth", 0.4, 0, -9), O("sawtooth", 0.4, 0, 9), O("triangle", 0.35, 12)], a: 0.45, d: 0.8, s: 0.8, r: 1.1, cutoff: 1300, res: 0.8, fenv: 1, fdec: 1.2, gain: 0.28 },
    "Electric Keys": { osc: [O("sine", 0.8), O("triangle", 0.15, 12), O("sine", 0)], fm: { ratio: 1, index: 1.4, decay: 0.9 }, a: 0.003, d: 1.2, s: 0.3, r: 0.35, cutoff: 6000, res: 0.5, fenv: 0, fdec: 0.2, gain: 0.4 },
    "FM Bell": { osc: [O("sine", 0.8), O("sine", 0), O("sine", 0)], fm: { ratio: 3.5, index: 2.6, decay: 1.6 }, a: 0.002, d: 1.8, s: 0, r: 1.2, cutoff: 9000, res: 0.3, fenv: 0, fdec: 0.2, gain: 0.36 },
    "Bass Synth": { osc: [O("sawtooth", 0.55), O("square", 0.3, 0, -6), O("sine", 0.55, -12)], a: 0.003, d: 0.25, s: 0.45, r: 0.08, cutoff: 520, res: 4, fenv: 2.4, fdec: 0.16, gain: 0.46 },
    "Sub Bass": { osc: [O("sine", 0.9), O("triangle", 0.25), O("sine", 0)], a: 0.005, d: 0.3, s: 0.9, r: 0.1, cutoff: 900, res: 0.5, fenv: 0, fdec: 0.1, gain: 0.5 },
    "Acid Bass": { osc: [O("sawtooth", 0.8), O("sine", 0), O("sine", 0)], a: 0.002, d: 0.2, s: 0.3, r: 0.06, cutoff: 340, res: 14, fenv: 3.8, fdec: 0.15, gain: 0.42 },
    "Reese Bass": { osc: [O("sawtooth", 0.5, 0, -14), O("sawtooth", 0.5, 0, 14), O("sine", 0.4, -12)], a: 0.01, d: 0.4, s: 0.85, r: 0.15, cutoff: 700, res: 1.5, fenv: 0.8, fdec: 0.3, gain: 0.36 },
  };
  const WAVES = ["sine", "triangle", "square", "sawtooth"];
  function normPatch(p) {
    p = p && typeof p === "object" ? p : clone(SYNTHS["3x Osc"]);
    const d = SYNTHS["3x Osc"], out = {};
    out.osc = [0, 1, 2].map((i) => {
      const o = (p.osc && p.osc[i]) || {};
      return { wave: WAVES.indexOf(o.wave) >= 0 ? o.wave : "sawtooth", vol: num(o.vol, 0, 0, 1), semi: Math.round(num(o.semi, 0, -24, 24)), det: num(o.det, 0, -100, 100), uni: Math.round(num(o.uni, 1, 1, 7)), spread: num(o.spread, 15, 0, 60) };
    });
    out.a = num(p.a, d.a, 0, 3); out.d = num(p.d, d.d, 0.01, 4); out.s = num(p.s, d.s, 0, 1); out.r = num(p.r, d.r, 0.01, 4);
    out.cutoff = num(p.cutoff, d.cutoff, 40, 18000); out.res = num(p.res, d.res, 0.1, 20); out.fenv = num(p.fenv, d.fenv, 0, 5); out.fdec = num(p.fdec, d.fdec, 0.01, 3);
    out.gain = num(p.gain, d.gain, 0, 1); out.transpose = Math.round(num(p.transpose, 0, -24, 24));
    if (p.fm && typeof p.fm === "object") out.fm = { ratio: num(p.fm.ratio, 1, 0.25, 12), index: num(p.fm.index, 0, 0, 10), decay: num(p.fm.decay, 0.5, 0.02, 5) };
    if (typeof p.preset === "string") out.preset = p.preset.slice(0, 40);
    return out;
  }
  function defaultsFor(type, params) {
    if (type === "synth") return normPatch(params);
    const o = {}; INSTR[type].params.forEach((q) => { o[q.k] = q.def; });
    if (params && typeof params === "object") INSTR[type].params.forEach((q) => { if (params[q.k] != null) o[q.k] = num(params[q.k], q.def, q.min, q.max); });
    return o;
  }
  const synthPreset = (name) => Object.assign(clone(SYNTHS[name] || SYNTHS["3x Osc"]), { preset: name });

  // Browser contents: instruments and drum sounds (all synthesised).
  const BROWSER = [
    { id: "inst", name: "Instruments", icon: "wave", items: ["3x Osc", "Pluck", "Supersaw Lead", "Square Lead", "Soft Pad", "Electric Keys", "FM Bell"].map((n) => ({ name: n, type: "synth", preset: n })) },
    { id: "bass", name: "Bass", icon: "wave", items: ["Bass Synth", "Sub Bass", "Acid Bass", "Reese Bass"].map((n) => ({ name: n, type: "synth", preset: n, root: 48 })) },
    { id: "kicks", name: "Drums › Kicks", icon: "drum", items: [
      { name: "Kick", type: "kick" }, { name: "Punchy Kick", type: "kick", params: { punch: 0.92, decay: 0.3, click: 0.7 } },
      { name: "808 Kick", type: "kick", params: { decay: 1.25, punch: 0.35, drive: 0.55, tune: -3, click: 0.1 } }, { name: "Deep Kick", type: "kick", params: { tune: -4, decay: 0.62, punch: 0.5, click: 0.15 } }] },
    { id: "snares", name: "Drums › Snares & Claps", icon: "drum", items: [
      { name: "Snare", type: "snare" }, { name: "Tight Snare", type: "snare", params: { decay: 0.12, tone: 0.3, snappy: 0.85, tune: 3 } },
      { name: "Clap", type: "clap" }, { name: "Big Clap", type: "clap", params: { decay: 0.45, tone: 1000, spread: 0.014 } }, { name: "Snap", type: "snap" }, { name: "Rim", type: "rim" }] },
    { id: "hats", name: "Drums › Hats & Cymbals", icon: "drum", items: [
      { name: "Hat", type: "hat" }, { name: "Open Hat", type: "ohat" }, { name: "Shaker", type: "shaker" }, { name: "Crash", type: "crash" }] },
    { id: "perc", name: "Drums › Percussion", icon: "drum", items: [
      { name: "Tom", type: "tom" }, { name: "Low Tom", type: "tom", params: { base: 95, decay: 0.5 } }, { name: "Conga", type: "tom", params: { base: 330, decay: 0.2 } }, { name: "Cowbell", type: "cowbell" }] },
  ];

  // =====================================================================
  //  Audio engine — one per AudioContext (live or offline render)
  // =====================================================================
  function mkPanner(ctx) { return ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); }
  function setP(param, v, ctx, live) { if (!param) return; if (live) { try { param.setTargetAtTime(v, ctx.currentTime, 0.012); return; } catch (e) {} } param.value = v; }
  function mkMeter(ctx, src) {
    const sp = ctx.createChannelSplitter(2), a = ctx.createAnalyser(), b = ctx.createAnalyser();
    a.fftSize = b.fftSize = 1024; a.smoothingTimeConstant = b.smoothingTimeConstant = 0;
    src.connect(sp); sp.connect(a, 0); sp.connect(b, 1);
    const fl = !!a.getFloatTimeDomainData, bufA = fl ? new Float32Array(a.fftSize) : new Uint8Array(a.fftSize), bufB = fl ? new Float32Array(b.fftSize) : new Uint8Array(b.fftSize);
    const pk = (an, buf) => { let m = 0; if (fl) { an.getFloatTimeDomainData(buf); for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > m) m = v; } } else { an.getByteTimeDomainData(buf); for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i] - 128) / 128; if (v > m) m = v; } } return m; };
    return { read: () => [pk(a, bufA), pk(b, bufB)], lvl: [0, 0], hold: [0, 0] };
  }

  function Engine(ctx, proj, offline) {
    const E = this;
    E.ctx = ctx; E.proj = proj; E.offline = !!offline; E.live = !offline;
    E.voices = []; E.stats = { scheduled: 0 }; E.chans = {}; E.inserts = [];
    E.masterIn = gainN(ctx, 1); E.masterFader = gainN(ctx, 1); E.masterPan = mkPanner(ctx); E.appMaster = gainN(ctx, 1);
    E.limiter = ctx.createDynamicsCompressor();
    E.limiter.threshold.value = -4; E.limiter.knee.value = 4; E.limiter.ratio.value = 12; E.limiter.attack.value = 0.002; E.limiter.release.value = 0.16;
    E.trim = gainN(ctx, 0.85); // ~-1.4 dB of headroom after the limiter so renders never clip
    E.masterIn.connect(E.masterFader); E.masterFader.connect(E.masterPan); E.masterPan.connect(E.appMaster); E.appMaster.connect(E.limiter); E.limiter.connect(E.trim);
    if (E.offline) E.trim.connect(ctx.destination);
    else {
      E.sys = gainN(ctx, sysVolume()); E.trim.connect(E.sys); E.sys.connect(ctx.destination);
      E.meter = mkMeter(ctx, E.trim);
      E.metro = gainN(ctx, 0.45); E.metro.connect(E.sys);
    }
    // Shared FX buses: a convolution reverb and a tempo-synced dotted-8th delay.
    E.revIn = gainN(ctx, 1); E.conv = ctx.createConvolver(); E.conv.buffer = impulse(ctx, 2.4, 2.6); E.revOut = gainN(ctx, 0.8);
    E.revIn.connect(E.conv); E.conv.connect(E.revOut); E.revOut.connect(E.masterIn);
    E.dlyIn = gainN(ctx, 1); E.delay = ctx.createDelay(2); E.dlyFb = gainN(ctx, 0.36); E.dlyLp = biq(ctx, "lowpass", 3200, 0.5); E.dlyOut = gainN(ctx, 0.7);
    E.dlyIn.connect(E.delay); E.delay.connect(E.dlyLp); E.dlyLp.connect(E.dlyFb); E.dlyFb.connect(E.delay); E.dlyLp.connect(E.dlyOut); E.dlyOut.connect(E.masterIn);
    E.sync();
  }
  Engine.prototype.sync = function () {
    const E = this, ctx = E.ctx, p = E.proj, live = E.live;
    // inserts (index 0 = master)
    while (E.inserts.length < p.mixer.length) {
      const i = E.inserts.length;
      if (i === 0) { E.inserts.push(null); continue; }
      const s = { input: gainN(ctx, 1), fader: gainN(ctx, 1), pan: mkPanner(ctx), mute: gainN(ctx, 1), rev: gainN(ctx, 0), dly: gainN(ctx, 0) };
      s.input.connect(s.fader); s.fader.connect(s.pan); s.pan.connect(s.mute); s.mute.connect(E.masterIn);
      s.mute.connect(s.rev); s.rev.connect(E.revIn); s.mute.connect(s.dly); s.dly.connect(E.dlyIn);
      if (live) s.meter = mkMeter(ctx, s.mute);
      E.inserts.push(s);
    }
    while (E.inserts.length > p.mixer.length) { const s = E.inserts.pop(); if (s) try { s.mute.disconnect(); s.input.disconnect(); } catch (e) {} }
    p.mixer.forEach((m, i) => {
      if (i === 0) {
        setP(E.masterFader.gain, m.mute ? 0 : faderGain(m.vol), ctx, live);
        if (E.masterPan.pan) setP(E.masterPan.pan, m.pan, ctx, live);
        return;
      }
      const s = E.inserts[i];
      setP(s.fader.gain, faderGain(m.vol), ctx, live); if (s.pan.pan) setP(s.pan.pan, m.pan, ctx, live);
      setP(s.mute.gain, m.mute ? 0 : 1, ctx, live); setP(s.rev.gain, m.rev || 0, ctx, live); setP(s.dly.gain, m.dly || 0, ctx, live);
    });
    setP(E.appMaster.gain, mainGain(p.masterVol), ctx, live);
    setP(E.delay.delayTime, clamp((60 / p.bpm / 4) * 3, 0.05, 1.9), ctx, live);
    // channel strips
    const solo = p.channels.some((c) => c.solo), seen = {};
    p.channels.forEach((ch) => {
      seen[ch.id] = 1;
      let c = E.chans[ch.id];
      if (!c) { c = E.chans[ch.id] = { vol: gainN(ctx, 1), pan: mkPanner(ctx), ins: -1 }; c.vol.connect(c.pan); }
      const ins = ch.insert > 0 && E.inserts[ch.insert] ? ch.insert : 0;
      if (c.ins !== ins) { try { c.pan.disconnect(); } catch (e) {} c.pan.connect(ins ? E.inserts[ins].input : E.masterIn); c.ins = ins; }
      setP(c.vol.gain, ch.mute || (solo && !ch.solo) ? 0 : chanGain(ch.vol), ctx, live);
      if (c.pan.pan) setP(c.pan.pan, ch.pan, ctx, live);
    });
    Object.keys(E.chans).forEach((id) => { if (!seen[id]) { try { E.chans[id].pan.disconnect(); } catch (e) {} delete E.chans[id]; } });
  };
  Engine.prototype.setProject = function (p) { this.panic(); this.proj = p; this.sync(); };
  Engine.prototype.setSystemVolume = function (v) { if (this.sys) setP(this.sys.gain, v, this.ctx, true); };
  Engine.prototype.trigger = function (ch, t, midi, vel, dur) {
    const E = this, def = INSTR[ch.type]; if (!def) return null;
    if (!E.chans[ch.id]) E.sync();
    const c = E.chans[ch.id]; if (!c) return null;
    let v;
    try {
      v = def.kind === "synth" ? synthPlay(E.ctx, c.vol, t, midi, vel, dur, ch.params || {}) : def.play(E.ctx, c.vol, t, midi - 60, vel, ch.params || {});
    } catch (e) { return null; }
    if (v) { E.stats.scheduled++; if (E.live) E.voices.push(v); }
    return v;
  };
  Engine.prototype.click = function (t, accent) {
    if (!this.metro) return;
    const ctx = this.ctx, o = oscN(ctx, "sine", accent ? 1760 : 1320), g = gainN(ctx, 0);
    o.connect(g); g.connect(this.metro);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(accent ? 0.9 : 0.55, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.045);
    o.start(t); o.stop(t + 0.06);
  };
  Engine.prototype.panic = function () {
    const now = this.ctx.currentTime;
    this.voices.forEach((v) => {
      if (v.end < now) return;
      try { const cur = v.start > now ? 0 : v.g.gain.value; v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(cur, now); v.g.gain.linearRampToValueAtTime(0, now + 0.02); } catch (e) {}
      v.srcs.forEach((s) => { try { s.stop(now + 0.03); } catch (e) {} });
      v.released = true; v.end = now + 0.03;
    });
  };
  Engine.prototype.prune = function () {
    const now = this.ctx.currentTime;
    if (this.voices.length) this.voices = this.voices.filter((v) => { if (v.end > now - 0.25) return true; try { v.g.disconnect(); } catch (e) {} return false; });
    let n = 0; this.voices.forEach((v) => { if (v.start <= now && v.end > now) n++; });
    return n;
  };

  // =====================================================================
  //  Project model
  // =====================================================================
  const PAT_COLORS = ["#8f9ce0", "#e08f8f", "#8fd18f", "#e0c27a", "#c08fe0", "#7fcfd2", "#e09cc4", "#b4c46a"];
  const steps32 = (idx, vel) => { const a = new Array(32).fill(0); (idx || []).forEach((i) => { if (Array.isArray(i)) a[i[0]] = i[1]; else a[i] = vel == null ? 0.8 : vel; }); return a; };
  function mkChannel(name, type, params, extra) {
    return Object.assign({ id: uid(), name, type, params: defaultsFor(type, params), vol: 0.78, pan: 0, mute: false, solo: false, insert: 0, root: 60 }, extra || {});
  }
  const mkPattern = (name, len) => ({ id: uid(), name, len: len || 16, steps: {}, notes: {} });
  const mkInsert = (name) => ({ name, vol: 0.8, pan: 0, mute: false, rev: 0, dly: 0 });

  function demoProject() {
    const C = {
      kick: mkChannel("Kick", "kick", null, { insert: 1, vol: 0.7 }),
      clap: mkChannel("Clap", "clap", null, { insert: 2, vol: 0.72 }),
      hat: mkChannel("Hat", "hat", null, { insert: 3, vol: 0.62, pan: 0.18 }),
      snare: mkChannel("Snare", "snare", null, { insert: 4, vol: 0.66 }),
      ohat: mkChannel("Open Hat", "ohat", null, { insert: 5, vol: 0.5, pan: -0.15 }),
      bass: mkChannel("Bass", "synth", synthPreset("Bass Synth"), { insert: 6, root: 45, vol: 0.74 }),
      osc: mkChannel("3x Osc", "synth", synthPreset("3x Osc"), { insert: 7, vol: 0.66 }),
      lead: mkChannel("Lead", "synth", synthPreset("Supersaw Lead"), { insert: 8, vol: 0.7 }),
    };
    const ids = Object.keys(C).reduce((o, k) => { o[k] = C[k].id; return o; }, {});
    const notes = (arr) => arr.map((n) => ({ s: n[0], l: n[1], k: n[2], v: n[3] == null ? 0.8 : n[3] }));
    const chord = (steps, keys) => { const out = []; steps.forEach((st) => keys.forEach((k) => out.push([st[0], st[1], k, 0.72]))); return out; };
    const kick = steps32([0, 4, 8, 12, 16, 20, 24, 28], 0.9), clap = steps32([4, 12, 20, 28], 0.8);
    const hatIdx = []; for (let i = 0; i < 32; i++) if (i % 4 !== 2) hatIdx.push([i, i % 2 ? 0.32 : 0.55]);
    const hats = steps32(hatIdx), ohats = steps32([2, 6, 10, 14, 18, 22, 26, 30], 0.62);
    const rhythmA = [[0, 3], [3, 3], [6, 2], [10, 2], [12, 3]], rhythmB = rhythmA.map((r) => [r[0] + 16, r[1]]);

    const A = mkPattern("Groove A", 32);
    A.steps[ids.kick] = kick.slice(); A.steps[ids.clap] = clap.slice(); A.steps[ids.hat] = hats.slice(); A.steps[ids.ohat] = ohats.slice();
    A.steps[ids.snare] = steps32([[27, 0.3], [30, 0.45], [31, 0.6]]);
    A.notes[ids.bass] = notes([[2, 2, 45], [6, 2, 45], [10, 2, 45], [14, 2, 52], [18, 2, 41], [22, 2, 41], [26, 2, 41], [30, 2, 43]]);
    A.notes[ids.osc] = notes(chord(rhythmA, [57, 60, 64]).concat(chord(rhythmB, [57, 60, 65])));
    A.notes[ids.lead] = notes([[0, 3, 69], [3, 3, 72], [6, 2, 76], [8, 2, 74], [10, 2, 72], [12, 2, 71], [14, 2, 72], [16, 4, 69], [20, 2, 67], [22, 2, 69], [24, 6, 72]]);

    const B = mkPattern("Groove B", 32);
    B.steps[ids.kick] = kick.slice(); B.steps[ids.clap] = clap.slice(); B.steps[ids.hat] = hats.slice(); B.steps[ids.ohat] = ohats.slice();
    B.steps[ids.snare] = steps32([[14, 0.3], [28, 0.35], [29, 0.45], [30, 0.6], [31, 0.75]]);
    B.notes[ids.bass] = notes([[2, 2, 48], [6, 2, 48], [10, 2, 48], [14, 2, 52], [18, 2, 43], [22, 2, 43], [26, 2, 43], [30, 2, 47]]);
    B.notes[ids.osc] = notes(chord(rhythmA, [55, 60, 64]).concat(chord(rhythmB, [55, 59, 62])));
    B.notes[ids.lead] = notes([[0, 3, 67], [3, 3, 72], [6, 2, 76], [8, 2, 79], [10, 2, 76], [12, 4, 74], [16, 3, 74], [19, 3, 71], [22, 2, 67], [24, 4, 71], [28, 4, 69]]);

    const I = mkPattern("Intro", 32);
    I.steps[ids.hat] = hats.slice(); I.steps[ids.ohat] = steps32([18, 22, 26, 30], 0.5);
    I.steps[ids.snare] = steps32([[24, 0.25], [26, 0.3], [28, 0.4], [29, 0.45], [30, 0.55], [31, 0.7]]);
    I.notes[ids.osc] = A.notes[ids.osc].map((n) => Object.assign({}, n, { v: 0.6 }));

    const D = mkPattern("Beat", 16);
    D.steps[ids.kick] = steps32([0, 4, 8, 12], 0.9); D.steps[ids.clap] = steps32([4, 12], 0.8);
    D.steps[ids.hat] = steps32(hatIdx.filter((h) => h[0] < 16)); D.steps[ids.ohat] = steps32([2, 6, 10, 14], 0.62);
    D.notes[ids.bass] = notes([[2, 2, 45], [6, 2, 45], [10, 2, 45], [14, 2, 43]]);

    const mixer = [mkInsert("Master")].concat(["Kick", "Clap", "Hat", "Snare", "Open Hat", "Bass", "3x Osc", "Lead"].map(mkInsert), [mkInsert("Insert 9"), mkInsert("Insert 10")]);
    mixer[2].rev = 0.22; mixer[4].rev = 0.24; mixer[3].rev = 0.06; mixer[5].rev = 0.1; mixer[7].rev = 0.3; mixer[7].dly = 0.14; mixer[8].rev = 0.26; mixer[8].dly = 0.28;
    return {
      v: 1, name: "Sunset Drive", bpm: 124, swing: 12, masterVol: 0.8, mode: "pat", cur: 0, metronome: false,
      channels: [C.kick, C.clap, C.hat, C.snare, C.ohat, C.bass, C.osc, C.lead],
      patterns: [A, B, I, D],
      playlist: { tracks: 8, muted: [], clips: [{ t: 0, b: 0, pid: I.id }, { t: 1, b: 2, pid: A.id }, { t: 2, b: 4, pid: B.id }, { t: 1, b: 6, pid: A.id }, { t: 2, b: 8, pid: B.id }, { t: 3, b: 10, pid: D.id }] },
      mixer,
    };
  }
  function emptyProject() {
    const chs = [mkChannel("Kick", "kick", null, { insert: 1 }), mkChannel("Clap", "clap", null, { insert: 2 }), mkChannel("Hat", "hat", null, { insert: 3 }), mkChannel("Snare", "snare", null, { insert: 4 }), mkChannel("3x Osc", "synth", synthPreset("3x Osc"), { insert: 5 }), mkChannel("Bass", "synth", synthPreset("Bass Synth"), { insert: 6, root: 45 })];
    return { v: 1, name: "Untitled", bpm: 130, swing: 0, masterVol: 0.8, mode: "pat", cur: 0, metronome: false, channels: chs, patterns: [mkPattern("Pattern 1", 16)], playlist: { tracks: 8, muted: [], clips: [] }, mixer: [mkInsert("Master")].concat(chs.map((c) => mkInsert(c.name)), [mkInsert("Insert 7"), mkInsert("Insert 8")]) };
  }
  function normalize(p) {
    if (p && p.format === "flstudio-web" && p.project) p = p.project;
    if (!p || typeof p !== "object" || !Array.isArray(p.channels) || !Array.isArray(p.patterns)) return null;
    const out = { v: 1, name: String(p.name || "Untitled").slice(0, 80), bpm: Math.round(num(p.bpm, 130, 60, 200) * 1000) / 1000, swing: num(p.swing, 0, 0, 100), masterVol: num(p.masterVol, 0.8, 0, 1), mode: p.mode === "song" ? "song" : "pat", metronome: !!p.metronome };
    const ids = {};
    out.channels = p.channels.filter((c) => c && INSTR[c.type]).slice(0, 64).map((c) => {
      let id = String(c.id || uid()).slice(0, 24); while (ids[id]) id = uid(); ids[id] = 1;
      return { id, name: String(c.name || INSTR[c.type].name).slice(0, 40), type: c.type, params: defaultsFor(c.type, c.params), vol: num(c.vol, 0.78, 0, 1), pan: num(c.pan, 0, -1, 1), mute: !!c.mute, solo: !!c.solo, insert: Math.round(num(c.insert, 0, 0, 64)), root: Math.round(num(c.root, 60, 24, 108)) };
    });
    const mx = Array.isArray(p.mixer) && p.mixer.length ? p.mixer.slice(0, 65) : [{ name: "Master" }];
    out.mixer = mx.map((m, i) => { m = m || {}; return { name: String(m.name || (i ? "Insert " + i : "Master")).slice(0, 24), vol: num(m.vol, 0.8, 0, 1), pan: num(m.pan, 0, -1, 1), mute: !!m.mute, rev: num(m.rev, 0, 0, 1), dly: num(m.dly, 0, 0, 1) }; });
    out.mixer[0].name = "Master";
    const maxIns = out.channels.reduce((a, c) => Math.max(a, c.insert), 0);
    while (out.mixer.length <= maxIns) out.mixer.push(mkInsert("Insert " + out.mixer.length));
    const pids = {};
    out.patterns = p.patterns.filter((x) => x && typeof x === "object").slice(0, 99).map((x, i) => {
      let id = String(x.id || uid()).slice(0, 24); while (pids[id]) id = uid(); pids[id] = 1;
      const pt = { id, name: String(x.name || "Pattern " + (i + 1)).slice(0, 40), len: +x.len === 32 ? 32 : 16, steps: {}, notes: {} };
      out.channels.forEach((c) => {
        const s = x.steps && x.steps[c.id];
        if (Array.isArray(s) && s.some((v) => +v > 0)) { const a = new Array(32).fill(0); for (let k = 0; k < 32; k++) a[k] = num(s[k], 0, 0, 1); pt.steps[c.id] = a; }
        const n = x.notes && x.notes[c.id];
        if (Array.isArray(n) && n.length) pt.notes[c.id] = n.filter((q) => q && isFinite(+q.s) && isFinite(+q.k)).slice(0, 512).map((q) => ({ s: Math.round(num(q.s, 0, 0, 31)), l: Math.round(num(q.l, 1, 1, 32)), k: Math.round(num(q.k, 60, 0, 127)), v: num(q.v, 0.8, 0.05, 1) }));
      });
      return pt;
    });
    if (!out.patterns.length) out.patterns.push(mkPattern("Pattern 1", 16));
    const pl = p.playlist && typeof p.playlist === "object" ? p.playlist : {};
    const tracks = Math.round(num(pl.tracks, 8, 4, 32));
    out.playlist = { tracks, muted: (Array.isArray(pl.muted) ? pl.muted : []).map((x) => !!x).slice(0, tracks), clips: (Array.isArray(pl.clips) ? pl.clips : []).filter((c) => c && pids[c.pid]).slice(0, 999).map((c) => ({ t: Math.round(num(c.t, 0, 0, tracks - 1)), b: Math.round(num(c.b, 0, 0, 511)), pid: c.pid })) };
    out.cur = Math.round(num(p.cur, 0, 0, out.patterns.length - 1));
    return out;
  }
  const patBars = (pat) => Math.ceil(pat.len / 16);
  function songLenSteps(p) {
    let end = 0;
    p.playlist.clips.forEach((c) => { const pat = p.patterns.find((x) => x.id === c.pid); if (pat) end = Math.max(end, c.b * 16 + pat.len); });
    return Math.max(16, end);
  }
  const stepDur = (p) => 60 / p.bpm / 4;
  const swingOff = (p, pos) => (pos % 2 === 1 ? (p.swing / 100) * stepDur(p) * 0.5 : 0);

  // Schedule everything that starts on one step of one pattern.
  function schedPatternStep(E, p, pat, local, t) {
    const solo = p.channels.some((c) => c.solo), sd = stepDur(p);
    for (const ch of p.channels) {
      if (ch.mute || (solo && !ch.solo)) continue;
      const notes = pat.notes[ch.id];
      if (notes && notes.length) { for (const n of notes) if (n.s === local) E.trigger(ch, t, n.k, n.v == null ? 0.8 : n.v, n.l * sd * 0.97); }
      else { const v = (pat.steps[ch.id] || [])[local]; if (v > 0) E.trigger(ch, t, ch.root || 60, v, sd * 0.97); }
    }
  }
  function schedGlobalStep(E, p, mode, patIdx, pos, t) {
    const tt = t + swingOff(p, pos);
    if (mode === "song") {
      for (const c of p.playlist.clips) {
        if (p.playlist.muted[c.t]) continue;
        const pat = p.patterns.find((x) => x.id === c.pid); if (!pat) continue;
        const st = c.b * 16; if (pos >= st && pos < st + pat.len) schedPatternStep(E, p, pat, pos - st, tt);
      }
    } else { const pat = p.patterns[patIdx] || p.patterns[0]; schedPatternStep(E, p, pat, pos % pat.len, tt); }
  }

  // =====================================================================
  //  Offline render + WAV encoding
  // =====================================================================
  async function renderOffline(p, mode, patIdx) {
    const C = OACtor(); if (!C) throw new Error("This browser can't render audio offline.");
    const sr = 44100, sd = stepDur(p), steps = mode === "song" ? songLenSteps(p) : (p.patterns[patIdx] || p.patterns[0]).len;
    const lead = 0.02, tail = 2.2, len = Math.ceil((lead + steps * sd + tail) * sr);
    const ctx = new C(2, len, sr);
    const E = new Engine(ctx, p, true);
    for (let s = 0; s < steps; s++) schedGlobalStep(E, p, mode, patIdx, s, lead + s * sd);
    const buf = await new Promise((res, rej) => {
      let done = false;
      ctx.oncomplete = (e) => { if (!done) { done = true; res(e.renderedBuffer); } };
      try { const pr = ctx.startRendering(); if (pr && pr.then) pr.then((b) => { if (!done) { done = true; res(b); } }, rej); } catch (e) { rej(e); }
    });
    // Trim the silent part of the tail (keep the musical length + any ringing reverb / delay).
    const minEnd = Math.floor((lead + steps * sd) * sr), chs = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
    let end = buf.length - 1;
    while (end > minEnd && chs.every((d) => Math.abs(d[end]) < 0.0004)) end--;
    return { buf, frames: Math.min(buf.length, end + Math.floor(sr * 0.05)), steps, voices: E.stats.scheduled };
  }
  function bufStats(buf, frames) {
    let sum = 0, peak = 0, n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < frames; i++) { const v = d[i]; sum += v * v; const a = Math.abs(v); if (a > peak) peak = a; } n += frames; }
    return { rms: Math.sqrt(sum / Math.max(1, n)), peak };
  }
  function encodeWav(buf, frames) {
    const ch = Math.min(2, buf.numberOfChannels), sr = buf.sampleRate, bytes = frames * ch * 2;
    const ab = new ArrayBuffer(44 + bytes), v = new DataView(ab);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, "RIFF"); v.setUint32(4, 36 + bytes, true); ws(8, "WAVE"); ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, bytes, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++, o += 2) { const s = clamp(data[c][i], -1, 1); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return new Blob([ab], { type: "audio/wav" });
  }

  // =====================================================================
  //  Virtual file system helpers
  // =====================================================================
  const DIR_PROJ = ["Documents", "FL Studio", "Projects"], DIR_EXP = ["Documents", "FL Studio", "Exports"];
  function ensureFolder(path) {
    if (window.FilesHelper && FilesHelper.ensureFolder) { try { return FilesHelper.ensureFolder(path); } catch (e) {} }
    let ch = window.VFS ? VFS.ensure() : null; if (!ch) return {};
    for (const seg of path) { if (!ch[seg] || ch[seg].type !== "folder") ch[seg] = { type: "folder", children: {}, created: Date.now() }; ch = ch[seg].children || (ch[seg].children = {}); }
    return ch;
  }
  function peekFolder(path) {
    try { let ch = window.VFS ? VFS.ensure() : null; for (const seg of path) { if (!ch || !ch[seg] || ch[seg].type !== "folder") return null; ch = ch[seg].children; } return ch; } catch (e) { return null; }
  }
  function uniqueName(kids, name) {
    if (!kids[name]) return name;
    const m = name.match(/^(.*?)(\.[^.]+)?$/); let i = 2;
    while (kids[m[1] + " (" + i + ")" + (m[2] || "")]) i++;
    return m[1] + " (" + i + ")" + (m[2] || "");
  }
  const safeFile = (s) => String(s || "Untitled").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Untitled";
  function vfsChanged() { try { State.save(); } catch (e) {} try { window.dispatchEvent(new CustomEvent("vfs-change", { detail: { source: "flstudio" } })); } catch (e) {} }
  function listFiles(path, re) {
    const kids = peekFolder(path) || {};
    return Object.keys(kids).filter((n) => kids[n] && kids[n].type === "file" && re.test(n)).map((n) => ({ name: n, node: kids[n] })).sort((a, b) => (b.node.ts || 0) - (a.node.ts || 0));
  }
  function downloadBlob(blob, name) {
    try { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); return true; } catch (e) { return false; }
  }
  function notify(title, body, onClick) { try { if (window.Notify) Notify.show({ icon: Icon.mini("flstudio", "FL Studio"), title: esc(title), body: esc(body), onClick }); } catch (e) {} }
  function openFolder(path) { try { if (window.FilesHelper && FilesHelper.open) FilesHelper.open(path.slice()); else { window.FilesStartPath = path.slice(); WM.open("fileexplorer"); } } catch (e) {} }

  // =====================================================================
  //  The app window (single instance, like the real FL Studio)
  // =====================================================================
  IC.check = '<path d="M5 12.5l4.2 4.2L19 7"/>';
  const KEYMAP = {
    KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
    KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28,
  };
  const VIEWS = ["playlist", "rack", "piano", "mixer"];
  const VIEW_NAMES = { playlist: "Playlist", rack: "Channel rack", piano: "Piano roll", mixer: "Mixer" };
  const SNAPS = [[1, "1/16 (step)"], [2, "1/8"], [4, "1/4 (beat)"], [16, "Bar"]];
  const NLENS = [[1, "1/16"], [2, "1/8"], [3, "3/16"], [4, "1/4"], [6, "3/8"], [8, "1/2"], [16, "1 bar"]];
  let inst = null, lastDebug = null;
  function store() { const d = S(); d.appData = d.appData || {}; let s = d.appData.flstudio; if (!s || typeof s !== "object") s = d.appData.flstudio = {}; return s; }
  function ensureCss() {
    if (document.querySelector('link[href*="css/flstudio.css"]')) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/flstudio.css"; document.head.appendChild(l);
  }
  function taskbarEl() { const t = document.querySelector(".taskbar"); return t && t.offsetHeight && getComputedStyle(t).display !== "none" ? t : null; }
  function taskbarHeight() { const t = taskbarEl(); if (!t) return 0; const r = t.getBoundingClientRect(); return r.top > innerHeight / 2 ? Math.min(120, Math.max(0, Math.round(innerHeight - r.top))) : 0; }
  function arcPath(a0, a1) {
    const r = 12.5, pt = (a) => { const rad = ((a - 90) * Math.PI) / 180; return [16 + r * Math.cos(rad), 16 + r * Math.sin(rad)]; };
    const p0 = pt(a0), p1 = pt(a1);
    return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
  }

  function open() {
    if (inst && inst.win.isConnected) { inst.focus(); return inst.api; }
    ensureCss();
    const coarse = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);
    // Size the window to fit between the top of the screen and the taskbar (floating: 70 px, docked: 48 px).
    const tbH = taskbarHeight(), availH = innerHeight - tbH;
    const W = Math.max(360, Math.min(1180, innerWidth - 16)), H = Math.max(420, Math.min(780, availH - 16));
    const left = Math.max(0, Math.round((innerWidth - W) / 2)), top = Math.max(0, Math.min(20, Math.round((availH - H) / 2)));
    // onClose runs synchronously on the close button; "wm-cleanup" (below) covers every other removal path.
    const ref = WM.createWindow({ title: "FL Studio", icon: Icon.mini("flstudio", "FL Studio"), width: W, height: H, left, top, appId: "flstudio", onClose: () => cleanup() });
    const body = ref.body, win = ref.win || body.closest(".win");
    win.classList.add("fl-win"); body.classList.add("fl-host");
    const maximize = () => { try { if (win.classList.contains("maximized")) return; const mx = win.querySelector(".win-controls .max"); if (mx && !mx.disabled) mx.click(); } catch (e) {} };
    // iPad (any orientation) / small screens: a DAW wants the whole screen.
    if (coarse || innerWidth < 900 || availH < 560) maximize();

    const sd0 = store();
    let proj = normalize(sd0.project) || demoProject();
    const MIN_ROW = coarse ? 32 : 16; // piano-roll row height: >= 32 px finger targets on touch screens
    const ui = { view: "rack", browser: true, brOverlay: false, selCh: null, snap: 1, nlen: 2, rowH: coarse ? 34 : 22, prZoom: 1, barW: coarse ? 60 : 52, typing: true, rec: false, mxSel: 1, q: "", open: { inst: true, bass: false, kicks: true, snares: false, hats: false, perc: false, projects: true, exports: false }, _step: null };
    (function restoreUi(u) {
      if (!u || typeof u !== "object") return;
      if (VIEWS.indexOf(u.view) >= 0) ui.view = u.view;
      if (typeof u.browser === "boolean") ui.browser = u.browser;
      if (typeof u.typing === "boolean") ui.typing = u.typing;
      if (SNAPS.some((s) => s[0] === u.snap)) ui.snap = u.snap;
      if (NLENS.some((s) => s[0] === u.nlen)) ui.nlen = u.nlen;
      if (u.rowH >= 16 && u.rowH <= 44) ui.rowH = u.rowH;
      if (u.prZoom >= 0.5 && u.prZoom <= 3) ui.prZoom = u.prZoom;
      if (u.barW >= 28 && u.barW <= 120) ui.barW = u.barW;
      if (typeof u.selCh === "string") ui.selCh = u.selCh;
      if (u.open && typeof u.open === "object") Object.keys(ui.open).forEach((k) => { if (typeof u.open[k] === "boolean") ui.open[k] = u.open[k]; });
    })(sd0.ui);
    ui.rowH = Math.max(MIN_ROW, ui.rowH);
    let fileName = typeof sd0.file === "string" ? sd0.file : null;
    let dirty = !!sd0.dirty, closed = false, E = null;
    const T = { playing: false, pos: 0, nextTime: 0, timer: 0, queue: [] };
    const perf = { work: 0, last: performance.now(), poly: 0, sys: -1 };
    const undoStack = [], redoStack = [];
    const chById = (id) => proj.channels.find((c) => c.id === id) || null;
    const curPat = () => proj.patterns[proj.cur] || proj.patterns[0];
    const patColor = (i) => PAT_COLORS[((i % PAT_COLORS.length) + PAT_COLORS.length) % PAT_COLORS.length];
    const kindOf = (ch) => (INSTR[ch.type] || {}).kind;

    body.innerHTML = `<div class="fl-app${coarse ? " fl-touch" : ""}" tabindex="-1">
      <div class="fl-top">
        <div class="fl-menus">
          <button class="fl-logo" data-menu="file" aria-label="Main menu" title="FL Studio">${FRUIT}</button>
          <button class="fl-mbtn" data-menu="file">FILE</button><button class="fl-mbtn" data-menu="edit">EDIT</button><button class="fl-mbtn" data-menu="options">OPTIONS</button><button class="fl-mbtn" data-menu="help">HELP</button>
        </div>
        <div class="fl-hint" aria-live="polite"><b class="fl-hint-t"></b><span class="fl-hint-s"></span></div>
        <div class="fl-tp">
          <div class="fl-mode" role="radiogroup" aria-label="Playback mode"><button data-mode="pat" role="radio" title="Pattern mode — play the selected pattern">PAT</button><button data-mode="song" role="radio" title="Song mode — play the playlist arrangement">SONG</button></div>
          <button class="fl-tb fl-play" aria-label="Play" title="Play / pause (Space)">${ic("play", 20)}</button>
          <button class="fl-tb fl-stop" aria-label="Stop" title="Stop">${ic("stop", 18)}</button>
          <button class="fl-tb fl-rec" aria-label="Record" aria-pressed="false" title="Record — play the piano keys or channel buttons while playing">${ic("rec", 16)}</button>
          <div class="fl-lcd fl-tempo" role="spinbutton" tabindex="0" aria-label="Tempo in BPM" aria-valuemin="60" aria-valuemax="200" title="Tempo — drag up/down, or tap to type"><span class="fl-tempo-v"></span><small>BPM</small></div>
          <div class="fl-lcd fl-pos" title="Song position (bar : beat : step)"><span class="fl-time">1:1:1</span><small>BAR:BEAT:STEP</small></div>
        </div>
        <div class="fl-tp2">
          <button class="fl-tb fl-metro" aria-label="Metronome" aria-pressed="false" title="Metronome">${ic("metro", 18)}</button>
          <div class="fl-kwrap fl-mvol"><small>MAIN</small></div>
          <div class="fl-mini-meter" aria-hidden="true"><i><b></b></i><i><b></b></i></div>
          <div class="fl-patsel"><button class="fl-pat-btn" aria-label="Choose pattern" aria-haspopup="menu"><i class="fl-sw"></i><span class="fl-pat-name"></span>${ic("chev", 14)}</button><button class="fl-tb fl-pat-add" aria-label="New pattern" title="New pattern">${ic("plus", 18)}</button></div>
          <div class="fl-cpu" title="Estimated CPU load and active voices (polyphony)"><div class="fl-cpu-r"><small>CPU</small><span class="fl-cpu-bar"><i></i></span><b class="fl-cpu-v">0%</b></div><div class="fl-cpu-r"><small>POLY</small><b class="fl-poly-v">0</b></div></div>
        </div>
        <div class="fl-views" role="tablist" aria-label="Windows">
          ${VIEWS.map((v) => `<button data-view="${v}" role="tab" title="${VIEW_NAMES[v]} (${{ playlist: "F5", rack: "F6", piano: "F7", mixer: "F9" }[v]})">${ic(v, 18)}<span>${VIEW_NAMES[v]}</span></button>`).join("")}
          <button class="fl-br-toggle" aria-pressed="false" title="Browser (F8)">${ic("browser", 18)}<span>Browser</span></button>
        </div>
      </div>
      <div class="fl-main">
        <aside class="fl-browser" aria-label="Browser"></aside>
        <section class="fl-work">${VIEWS.map((v) => `<div class="fl-view" data-v="${v}" role="tabpanel" aria-label="${VIEW_NAMES[v]}"></div>`).join("")}</section>
      </div>
      <div class="fl-layer"></div>
    </div>`;
    const $ = (s, r) => (r || body).querySelector(s);
    const root = $(".fl-app"), layer = $(".fl-layer"), browserEl = $(".fl-browser");
    const views = {}; VIEWS.forEach((v) => { views[v] = $(`.fl-view[data-v="${v}"]`); });
    const stale = { playlist: 1, rack: 1, piano: 1, mixer: 1 };

    // ---------- hint bar ----------
    let hintTimer = 0;
    function hint(t, s) {
      $(".fl-hint-t").textContent = t || ""; $(".fl-hint-s").textContent = s || "";
      clearTimeout(hintTimer); hintTimer = setTimeout(idleHint, 4000);
    }
    function idleHint() { $(".fl-hint-t").textContent = proj.name + (dirty ? " *" : ""); $(".fl-hint-s").textContent = T.playing ? (proj.mode === "song" ? "Playing song" : "Playing " + curPat().name) : "FL Studio 21"; }
    function updateTitle() {
      try { const t = win.querySelector(".win-titlebar .t-text"); if (t) t.textContent = "FL Studio - " + proj.name + (dirty ? " *" : ""); } catch (e) {}
      if (!hintTimer || $(".fl-hint-t").textContent.indexOf(proj.name) === 0) idleHint();
    }

    // ---------- undo / autosave ----------
    let pendingSnap = null, saveTimer = 0, wheelTimer = 0;
    function beginEdit() { if (pendingSnap == null) pendingSnap = JSON.stringify(proj); }
    function endEdit() {
      if (pendingSnap == null) return;
      const before = pendingSnap; pendingSnap = null;
      if (JSON.stringify(proj) === before) return;
      undoStack.push(before); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0;
      changed();
    }
    function edit(fn) { beginEdit(); fn(); endEdit(); }
    function wheelEdit() { beginEdit(); clearTimeout(wheelTimer); wheelTimer = setTimeout(endEdit, 450); }
    function changed() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(persist, 700); updateTitle(); }
    function persist() {
      clearTimeout(saveTimer); saveTimer = 0;
      try {
        const s = store(); s.project = clone(proj); s.file = fileName; s.dirty = dirty;
        s.ui = { view: ui.view, browser: ui.browser, typing: ui.typing, snap: ui.snap, nlen: ui.nlen, rowH: ui.rowH, prZoom: ui.prZoom, barW: ui.barW, selCh: ui.selCh, open: Object.assign({}, ui.open) };
        State.save();
      } catch (e) {}
    }
    function restoreSnapshot(json) {
      const p = normalize(JSON.parse(json)); if (!p) return;
      proj = p; if (E) { E.proj = proj; E.sync(); }
      changed(); renderAll();
    }
    function doUndo() { if (!undoStack.length) { hint("Undo", "Nothing to undo"); return; } redoStack.push(JSON.stringify(proj)); restoreSnapshot(undoStack.pop()); hint("Undo", "Last change undone"); }
    function doRedo() { if (!redoStack.length) { hint("Redo", "Nothing to redo"); return; } undoStack.push(JSON.stringify(proj)); restoreSnapshot(redoStack.pop()); hint("Redo", "Change redone"); }
    const syncAudio = () => { if (E) E.sync(); };

    // ---------- audio context (created inside the first user gesture — required on iPad) ----------
    function unlock(ctx) { // a silent one-sample buffer + resume(): iOS Safari's recipe for starting audio inside a user activation
      try { const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
      try { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
    }
    function ensureAudio() {
      if (closed) return null;
      if (E && E.ctx.state !== "closed") {
        if (E.ctx.state !== "running") unlock(E.ctx); // "suspended", or "interrupted" on iOS after a call / backgrounding
        return E;
      }
      const C = ACtor(); if (!C) { hint("No audio", "This browser has no Web Audio support."); return null; }
      let ctx = null;
      try { ctx = new C({ latencyHint: "interactive" }); } catch (e) { try { ctx = new C(); } catch (er) { hint("No audio", "Couldn't start the audio engine."); return null; } }
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {} // iOS: play even with the silent switch on
      E = new Engine(ctx, proj, false); perf.sys = sysVolume();
      unlock(ctx);
      return E;
    }
    // A touch pointerdown is not a user activation (pointerup / touchend / click / keydown are), so
    // create the context on the first touch and (re)unlock it on every activating event until it runs.
    const gesture = () => { if (!closed) ensureAudio(); };
    ["pointerdown", "pointerup", "touchend", "click", "keydown"].forEach((t) => root.addEventListener(t, gesture, true));
    const onVis = () => { if (!document.hidden && E && T.playing && E.ctx.state !== "running") unlock(E.ctx); };
    document.addEventListener("visibilitychange", onVis);

    // ---------- transport + lookahead scheduler ----------
    const LOOKAHEAD = 0.1, TICK_MS = 25;
    function tick() {
      if (!E || !T.playing) return;
      const t0 = performance.now(), ctx = E.ctx;
      if (ctx.state !== "running") { T.nextTime = ctx.currentTime + 0.05; return; }
      if (T.nextTime < ctx.currentTime - 0.15) { // main thread stalled: drop the missed steps (no burst) but stay on the beat grid
        const sd = stepDur(proj), n = Math.ceil((ctx.currentTime + 0.02 - T.nextTime) / sd);
        T.nextTime += n * sd; T.pos += n;
        if (proj.mode === "song") { const L = songLenSteps(proj); if (T.pos >= L) T.pos %= L; }
      }
      let guard = 0;
      while (T.nextTime < ctx.currentTime + LOOKAHEAD && guard++ < 64) {
        if (proj.mode === "song" && T.pos >= songLenSteps(proj)) T.pos = 0;
        schedGlobalStep(E, proj, proj.mode, proj.cur, T.pos, T.nextTime);
        if (proj.metronome && T.pos % 4 === 0) E.click(T.nextTime, T.pos % 16 === 0);
        T.queue.push({ pos: T.pos, time: T.nextTime });
        T.nextTime += stepDur(proj); T.pos++;
      }
      if (T.queue.length > 48) T.queue.splice(0, T.queue.length - 48);
      perf.work += performance.now() - t0;
    }
    function curPos() {
      if (!T.playing || !E || !T.queue.length) return null;
      const now = E.ctx.currentTime;
      for (let i = T.queue.length - 1; i >= 0; i--) { const q = T.queue[i]; if (q.time <= now) return q.pos + clamp((now - q.time) / stepDur(proj), 0, 0.999); }
      return null;
    }
    function patLocal(p) {
      if (p == null) return -1;
      const pat = curPat();
      if (proj.mode === "pat") return p % pat.len;
      const fp = Math.floor(p);
      for (const c of proj.playlist.clips) if (c.pid === pat.id && fp >= c.b * 16 && fp < c.b * 16 + pat.len) return p - c.b * 16;
      return -1;
    }
    function play() {
      const en = ensureAudio(); if (!en) return false;
      if (T.playing) return true;
      T.playing = true; T.queue = [];
      if (proj.mode === "song" && T.pos >= songLenSteps(proj)) T.pos = 0;
      T.nextTime = en.ctx.currentTime + 0.06;
      clearInterval(T.timer); T.timer = setInterval(tick, TICK_MS); tick();
      renderTransport(); idleHint();
      return true;
    }
    function halt() { T.playing = false; clearInterval(T.timer); T.timer = 0; if (E) E.panic(); T.queue = []; }
    function pause() { if (!T.playing) return; const p = curPos(); halt(); if (p != null) T.pos = Math.floor(p); renderTransport(); updatePlayheads(); idleHint(); }
    function stop() { halt(); T.pos = 0; renderTransport(); updatePlayheads(); idleHint(); }
    function togglePlay() { if (T.playing) pause(); else play(); }
    function setMode(m) {
      if (m !== "pat" && m !== "song") return;
      if (proj.mode === m) return;
      const was = T.playing; if (was) halt();
      proj.mode = m; T.pos = 0; changed(); renderTransport(); updatePlayheads();
      if (m === "song" && ui.view === "rack") hint("Song mode", "Plays the Playlist arrangement — press F5 to see it");
      if (was) play();
    }

    // ---------- knobs / faders (pointer events: mouse, pen, touch) ----------
    function knob(o) {
      const size = o.size || 30;
      const k = el(`<div class="fl-knob${o.cls ? " " + o.cls : ""}" role="slider" tabindex="0" aria-label="${esc(o.label)}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true"><circle class="fl-k-bg" cx="16" cy="16" r="10.2"/><path class="fl-k-track" d="${arcPath(-135, 135)}"/><path class="fl-k-val"/><line class="fl-k-ind" x1="16" y1="15" x2="16" y2="8"/></svg></div>`);
      const toF = (x) => (o.log ? Math.log(x / o.min) / Math.log(o.max / o.min) : (x - o.min) / (o.max - o.min));
      const fromF = (f) => (o.log ? o.min * Math.pow(o.max / o.min, f) : o.min + f * (o.max - o.min));
      let v = clamp(o.value, o.min, o.max);
      const fmt = (x) => (o.fmt ? o.fmt(x) : String(Math.round(x * 100) / 100));
      const valP = k.querySelector(".fl-k-val"), ind = k.querySelector(".fl-k-ind");
      function paint() {
        const f = clamp(toF(v), 0, 1), ang = -135 + 270 * f, from = o.bipolar ? 0 : -135;
        valP.setAttribute("d", Math.abs(ang - from) < 1 ? "" : arcPath(Math.min(from, ang), Math.max(from, ang)));
        ind.setAttribute("transform", `rotate(${ang.toFixed(1)} 16 16)`);
        k.setAttribute("aria-valuenow", String(Math.round(v * 1000) / 1000)); k.setAttribute("aria-valuetext", fmt(v));
        k.title = o.label + ": " + fmt(v);
      }
      function set(nv, fire) {
        nv = clamp(nv, o.min, o.max); if (o.step) nv = Math.round(nv / o.step) * o.step;
        if (nv === v) return; v = nv; paint();
        if (fire) { if (o.onInput) o.onInput(v); hint(o.label, fmt(v)); }
      }
      let drag = null, lastTap = 0;
      k.addEventListener("pointerdown", (e) => {
        if (e.button) return; e.preventDefault(); e.stopPropagation();
        try { k.setPointerCapture(e.pointerId); } catch (er) {}
        drag = { id: e.pointerId, y: e.clientY, x: e.clientX, f: toF(v), v0: v, moved: false, touch: e.pointerType === "touch" }; if (o.onStart) o.onStart();
        k.classList.add("fl-active"); hint(o.label, fmt(v));
      });
      k.addEventListener("pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        // Touch turns knobs by vertical drags only: in a scrolling strip a sideways swipe pans the view
        // (the knob is touch-action: pan-x there) instead of changing the value.
        const dy = drag.y - e.clientY, dx = e.clientX - drag.x, d = drag.touch ? dy : dy + dx * 0.35;
        if (!drag.moved && (drag.touch ? Math.abs(dy) < 5 || Math.abs(dx) > Math.abs(dy) : Math.abs(d) < 3)) return; drag.moved = true;
        set(fromF(clamp(drag.f + d / (e.shiftKey ? 700 : 170), 0, 1)), true);
      });
      const end = (e) => {
        if (!drag || (e && e.pointerId !== drag.id)) return; const d = drag; drag = null; k.classList.remove("fl-active");
        if (e && e.type === "pointercancel") { if (d.moved) set(d.v0, true); } // the browser took the gesture (a scroll)
        else if (!d.moved) { const now = Date.now(); if (now - lastTap < 330) { set(o.def != null ? o.def : o.min, true); lastTap = 0; } else lastTap = now; }
        if (o.onEnd) o.onEnd(v);
      };
      k.addEventListener("pointerup", end); k.addEventListener("pointercancel", end);
      k.addEventListener("wheel", (e) => { e.preventDefault(); if (o.onStart) o.onStart(); set(fromF(clamp(toF(v) - Math.sign(e.deltaY) * 0.02, 0, 1)), true); if (o.onWheelEnd) o.onWheelEnd(); }, { passive: false });
      k.addEventListener("keydown", (e) => {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]; if (!d) return;
        e.preventDefault(); e.stopPropagation(); if (o.onStart) o.onStart(); set(fromF(clamp(toF(v) + d * 0.02, 0, 1)), true); if (o.onEnd) o.onEnd(v);
      });
      k.set = (nv) => { v = clamp(nv, o.min, o.max); paint(); };
      k.get = () => v;
      paint(); return k;
    }
    // Knob bound to a property of the project (undoable).
    function pknob(obj, key, o) {
      return knob(Object.assign({ value: obj[key], onStart: beginEdit, onEnd: endEdit, onWheelEnd: wheelEdit, onInput: (v) => { obj[key] = v; if (o.after) o.after(v); } }, o));
    }
    function labeled(k, label) { const w = el(`<div class="fl-kl"><small>${esc(label)}</small></div>`); w.insertBefore(k, w.firstChild); return w; }
    function fader(o) {
      const f = el(`<div class="fl-fader" role="slider" tabindex="0" aria-label="${esc(o.label)}" aria-valuemin="0" aria-valuemax="100"><div class="fl-fd-track"></div><div class="fl-fd-cap"></div></div>`);
      const cap = f.querySelector(".fl-fd-cap"); let v = o.value;
      const paint = () => { cap.style.bottom = `calc(${(v * 100).toFixed(2)}% - ${(v * 22).toFixed(2)}px)`; f.setAttribute("aria-valuenow", String(Math.round(v * 100))); f.setAttribute("aria-valuetext", o.fmt(v)); f.title = o.label + ": " + o.fmt(v); };
      const set = (nv) => { nv = clamp(nv, 0, 1); if (nv === v) return; v = nv; paint(); o.onInput(v); hint(o.label, o.fmt(v)); };
      const fromY = (y) => { const r = f.getBoundingClientRect(); return clamp(1 - (y - r.top - 11) / Math.max(1, r.height - 22), 0, 1); };
      let drag = null, lastTap = 0;
      f.addEventListener("pointerdown", (e) => {
        if (e.button) return; e.preventDefault(); e.stopPropagation();
        try { f.setPointerCapture(e.pointerId); } catch (er) {}
        // Touch: the fader never jumps to the finger and moves only on a vertical drag (relative to the
        // cap), so swiping sideways across the mixer scrolls it (touch-action: pan-x) without touching levels.
        const touch = e.pointerType === "touch", onCap = e.target === cap;
        o.onStart();
        drag = { id: e.pointerId, y: e.clientY, x: e.clientX, v, v0: v, onCap, rel: onCap || touch, moved: false, touch };
        if (!drag.rel) set(fromY(e.clientY));
      });
      f.addEventListener("pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dy = drag.y - e.clientY, dx = e.clientX - drag.x;
        if (!drag.moved && (drag.touch ? Math.abs(dy) < 5 || Math.abs(dx) > Math.abs(dy) : Math.abs(dy) < 3)) return; drag.moved = true;
        const r = f.getBoundingClientRect(); set(drag.rel ? drag.v + dy / Math.max(1, r.height - 22) : fromY(e.clientY));
      });
      const end = (e) => {
        if (!drag || (e && e.pointerId !== drag.id)) return; const d = drag; drag = null;
        if (e && e.type === "pointercancel") { if (d.moved) set(d.v0); }
        else if (!d.moved && d.onCap) { const now = Date.now(); if (now - lastTap < 330) { set(o.def); lastTap = 0; } else lastTap = now; }
        o.onEnd();
      };
      f.addEventListener("pointerup", end); f.addEventListener("pointercancel", end);
      f.addEventListener("wheel", (e) => { e.preventDefault(); wheelEdit(); set(v - Math.sign(e.deltaY) * 0.02); }, { passive: false });
      f.addEventListener("keydown", (e) => { const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]; if (!d) return; e.preventDefault(); e.stopPropagation(); o.onStart(); set(v + d * 0.02); o.onEnd(); });
      f.set = (nv) => { v = nv; paint(); };
      paint(); return f;
    }

    // ---------- shared pointer-drag dispatcher (steps paint, notes, clips, keys, browser drag) ----------
    // One operation per pointer: with several fingers down (a chord on the piano keys, two channel
    // buttons) each finger's move / up / cancel reaches its own handler, so no note is left hanging.
    const ops = new Map();
    const setOp = (e, o) => { ops.set(e.pointerId, o); return o; };
    const onWinMove = (e) => { const o = ops.get(e.pointerId); if (o && o.move) o.move(e); };
    const onWinUp = (e) => { const o = ops.get(e.pointerId); if (!o) return; ops.delete(e.pointerId); if (o.up) o.up(e); };
    const onWinCancel = (e) => { const o = ops.get(e.pointerId); if (!o) return; ops.delete(e.pointerId); if (o.cancel) o.cancel(e); };
    function cancelOps() { const all = [...ops.values()]; ops.clear(); all.forEach((o) => { try { if (o.cancel) o.cancel(null); else if (o.up) o.up(null); } catch (er) {} }); }
    // Auto-follow (rack paging, piano roll / playlist playheads) pauses while the user scrolls by hand.
    let userScrollAt = 0;
    const userScrolling = () => performance.now() - userScrollAt < 2500;
    function watchUserScroll(sc) { const mark = () => { userScrollAt = performance.now(); }; ["touchstart", "wheel", "pointerdown"].forEach((t) => sc.addEventListener(t, mark, { passive: true })); }
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinCancel);

    // ---------- note input (previews, held keys, recording) ----------
    const held = {};
    function noteOn(ch, k, tag) {
      const en = ensureAudio(); if (!en || !ch) return;
      noteOff(tag, true);
      const synth = kindOf(ch) === "synth";
      const v = en.trigger(ch, en.ctx.currentTime + 0.004, k, 0.85, synth ? null : 0.3);
      const p = curPos(), loc = ui.rec && T.playing ? patLocal(p) : -1;
      held[tag] = { v, ch, k, start: loc, t0: performance.now() };
      keyLight(k, true);
      if (ui.rec && T.playing && loc >= 0 && !synth) recordHit(held[tag], loc); // drums record on the hit
    }
    function noteOff(tag, silent) {
      const h = held[tag]; if (!h) return; delete held[tag];
      if (h.v && h.v.release && E) h.v.release(E.ctx.currentTime);
      keyLight(h.k, false);
      if (!silent && h.start >= 0 && kindOf(h.ch) === "synth") recordHit(h, h.start);
    }
    function releaseAll() { Object.keys(held).forEach((t) => noteOff(t, true)); }
    // A channel plays its notes OR (when it has none) its steps. Before the first real note is added,
    // turn the steps into notes on the step note, so they keep playing (FL treats them as one sequence).
    function stepsToNotes(pat, ch) {
      const cur = pat.notes[ch.id]; if (cur && cur.length) return cur;
      const st = pat.steps[ch.id] || [], root = ch.root || 60, arr = [];
      for (let i = 0; i < pat.len; i++) if (st[i] > 0) arr.push({ s: i, l: 1, k: root, v: st[i] });
      pat.notes[ch.id] = arr; delete pat.steps[ch.id];
      return arr;
    }
    function recordHit(h, start) {
      const pat = curPat(), ch = h.ch;
      if (!chById(ch.id)) return;
      const s = Math.round(start) % pat.len;
      // a drum hit on its step note stays a step; anything pitched becomes a piano-roll note
      const asStep = kindOf(ch) === "drum" && !(pat.notes[ch.id] && pat.notes[ch.id].length) && h.k === (ch.root || 60);
      edit(() => {
        if (asStep) {
          const a = pat.steps[ch.id] || (pat.steps[ch.id] = new Array(32).fill(0)); a[s] = 0.8;
        } else {
          const p = curPos(), endLoc = p != null ? patLocal(p) : start + 1;
          let l = endLoc >= start ? endLoc - start : endLoc + pat.len - start;
          l = clamp(Math.max(1, Math.round(l)), 1, pat.len - s);
          const arr = stepsToNotes(pat, ch); // the channel's steps carry over, so nothing that already plays is dropped
          if (!arr.some((n) => n.s === s && n.k === h.k)) arr.push({ s, l, k: h.k, v: 0.8 });
        }
      });
      if (asStep) { // update the one cell in place (a full re-render would detach the button being held)
        const id = window.CSS && CSS.escape ? CSS.escape(ch.id) : ch.id;
        const cell = views.rack.querySelector(`.fl-rrow[data-ch="${id}"] .fl-step[data-i="${s}"]`);
        if (cell) setStep(pat, ch, s, 0.8, cell); else stale.rack = 1;
        stale.playlist = 1;
        if (ui.view === "piano" && prRenderNotes && prChannel() === ch) prRenderNotes(); else stale.piano = 1; // steps show in the piano roll too
      } else refresh("rack", "piano");
    }
    function previewItem(item) {
      const en = ensureAudio(); if (!en) return;
      const fake = { id: "__pv", type: item.type, params: item.type === "synth" ? normPatch(synthPreset(item.preset)) : defaultsFor(item.type, item.params), vol: 0.78, pan: 0, insert: 0 };
      if (!en.pv) { en.pv = gainN(en.ctx, 1); en.pv.connect(en.masterIn); }
      const t = en.ctx.currentTime + 0.005, def = INSTR[fake.type];
      try {
        let v;
        if (def.kind === "synth") { const root = item.root || 60; v = synthPlay(en.ctx, en.pv, t, root, 0.8, 0.22, fake.params); const v2 = synthPlay(en.ctx, en.pv, t + 0.25, root + 7, 0.7, 0.22, fake.params); const v3 = synthPlay(en.ctx, en.pv, t + 0.5, root + 12, 0.75, 0.45, fake.params); en.voices.push(v, v2, v3); }
        else { v = def.play(en.ctx, en.pv, t, 0, 0.85, fake.params); en.voices.push(v); }
      } catch (e) {}
      hint("Preview", item.name);
    }

    // =================================================================
    //  Top bar
    // =================================================================
    const mvol = knob({ label: "Main volume", value: proj.masterVol, min: 0, max: 1, def: 0.8, size: 30, fmt: (v) => Math.round(v * 100) + "% (" + toDb(mainGain(v)) + ")", onStart: beginEdit, onEnd: endEdit, onWheelEnd: wheelEdit, onInput: (v) => { proj.masterVol = v; syncAudio(); } });
    $(".fl-mvol").insertBefore(mvol, $(".fl-mvol").firstChild);
    function renderTransport() {
      root.querySelectorAll(".fl-mode button").forEach((b) => { const on = b.dataset.mode === proj.mode; b.classList.toggle("fl-lit", on); b.setAttribute("aria-checked", String(on)); });
      const pb = $(".fl-play"); pb.innerHTML = ic(T.playing ? "pause" : "play", 20); pb.classList.toggle("fl-lit", T.playing); pb.setAttribute("aria-label", T.playing ? "Pause" : "Play");
      const rb = $(".fl-rec"); rb.classList.toggle("fl-lit", ui.rec); rb.setAttribute("aria-pressed", String(ui.rec));
      const mb = $(".fl-metro"); mb.classList.toggle("fl-lit", !!proj.metronome); mb.setAttribute("aria-pressed", String(!!proj.metronome));
      root.classList.toggle("fl-playing", T.playing);
    }
    function renderTempo() { $(".fl-tempo-v").textContent = proj.bpm.toFixed(3); $(".fl-tempo").setAttribute("aria-valuenow", String(proj.bpm)); }
    function renderTop() {
      renderTransport(); renderTempo(); mvol.set(proj.masterVol);
      const pat = curPat(); $(".fl-pat-name").textContent = pat.name; $(".fl-patsel .fl-sw").style.background = patColor(proj.cur);
      root.querySelectorAll(".fl-views [data-view]").forEach((b) => { const on = b.dataset.view === ui.view; b.classList.toggle("fl-lit", on); b.setAttribute("aria-selected", String(on)); });
      const brOn = isNarrow() ? ui.brOverlay : ui.browser;
      $(".fl-br-toggle").classList.toggle("fl-lit", brOn); $(".fl-br-toggle").setAttribute("aria-pressed", String(brOn));
      updateTitle();
    }
    function setBpm(v) { v = Math.round(clamp(v, 60, 200) * 1000) / 1000; if (v === proj.bpm) return; proj.bpm = v; renderTempo(); syncAudio(); hint("Tempo", v.toFixed(3) + " BPM"); }
    (function tempoControl() {
      const t = $(".fl-tempo"); let d = null;
      t.addEventListener("pointerdown", (e) => {
        if (e.button || t.querySelector("input")) return; e.preventDefault();
        try { t.setPointerCapture(e.pointerId); } catch (er) {}
        d = { y: e.clientY, bpm: proj.bpm, moved: false }; beginEdit();
      });
      t.addEventListener("pointermove", (e) => {
        if (!d) return; const dy = d.y - e.clientY; if (!d.moved && Math.abs(dy) < 4) return; d.moved = true;
        setBpm(e.shiftKey ? d.bpm + dy / 40 : Math.round(d.bpm + dy / 3));
      });
      const end = (e) => { if (!d) return; const x = d; d = null; endEdit(); if (!x.moved && e.type === "pointerup") editTempo(); };
      t.addEventListener("pointerup", end); t.addEventListener("pointercancel", end);
      t.addEventListener("wheel", (e) => { e.preventDefault(); wheelEdit(); setBpm(Math.round(proj.bpm) - Math.sign(e.deltaY)); }, { passive: false });
      t.addEventListener("keydown", (e) => {
        if (e.target !== t) return;
        if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); edit(() => setBpm(Math.round(proj.bpm) + (e.key === "ArrowUp" ? 1 : -1))); }
        else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); editTempo(); }
      });
      function editTempo() {
        const span = $(".fl-tempo-v"); if (t.querySelector("input")) return;
        const inp = el(`<input class="fl-tempo-in" type="number" inputmode="decimal" min="60" max="200" step="1" aria-label="Tempo in BPM">`); inp.value = String(proj.bpm);
        span.style.display = "none"; t.insertBefore(inp, span); inp.focus(); inp.select();
        let done = false;
        const commit = (ok) => { if (done) return; done = true; if (ok && isFinite(+inp.value) && inp.value !== "") edit(() => setBpm(+inp.value)); inp.remove(); span.style.display = ""; renderTempo(); };
        inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") commit(true); else if (e.key === "Escape") commit(false); });
        inp.addEventListener("blur", () => commit(true));
      }
    })();
    function fmtPos(x) { if (x == null || x < 0) x = 0; x = Math.floor(x); return (Math.floor(x / 16) + 1) + ":" + (Math.floor((x % 16) / 4) + 1) + ":" + ((x % 4) + 1); }

    // =================================================================
    //  Playheads (rAF)
    // =================================================================
    let rackCols = [];
    function rackStep(step) {
      root.querySelectorAll(".fl-now").forEach((n) => n.classList.remove("fl-now"));
      if (step >= 0 && rackCols[step]) {
        rackCols[step].forEach((n) => n.classList.add("fl-now"));
        // page-follow: a 32-step pattern doesn't fit an iPad in portrait, so keep the playing step in view
        if (T.playing && !ops.size && !userScrolling() && ui.view === "rack") {
          const sc = views.rack.querySelector(".fl-rack-sc"), led = rackCols[step][0], left = views.rack.querySelector(".fl-ledrow .fl-rleft");
          if (sc && led && left && sc.scrollWidth > sc.clientWidth + 4) {
            const lr = led.getBoundingClientRect(), sr = sc.getBoundingClientRect(), edge = left.getBoundingClientRect().right + 6;
            if (lr.left < edge - 1 || lr.right > sr.right - 12) sc.scrollLeft += lr.left - edge;
          }
        }
      }
    }
    function follow(sc, x, fixedLeft) { // keep content x (px) visible in a scroller whose left fixedLeft px are sticky
      if (!sc || ops.size || !T.playing || userScrolling()) return;
      const vis = sc.clientWidth - fixedLeft;
      if (x < sc.scrollLeft || x > sc.scrollLeft + vis - 16) sc.scrollLeft = Math.max(0, x - 8);
    }
    let lastTime = "";
    function updatePlayheads() {
      const p = curPos(), loc = patLocal(p), step = loc >= 0 ? Math.floor(loc) : -1;
      if (step !== ui._step) { ui._step = step; rackStep(step); }
      const shown = T.playing ? (p == null ? null : proj.mode === "pat" ? loc : p) : (proj.mode === "song" ? T.pos : 0);
      const txt = fmtPos(shown == null ? (proj.mode === "song" ? T.pos : 0) : shown);
      if (txt !== lastTime) { lastTime = txt; $(".fl-time").textContent = txt; }
      if (ui.view === "piano" && prPh) {
        if (loc >= 0) { prPh.style.display = "block"; prPh.style.transform = `translateX(${(loc * prCW).toFixed(1)}px)`; follow(views.piano.querySelector(".fl-pr-sc"), loc * prCW, 58); }
        else prPh.style.display = "none";
      }
      if (ui.view === "playlist" && plPh) {
        if (proj.mode === "song") { const x = T.playing ? (p == null ? null : p) : T.pos; if (x != null) { plPh.style.display = "block"; plPh.style.transform = `translateX(${((x / 16) * ui.barW).toFixed(1)}px)`; follow(views.playlist.querySelector(".fl-pl-sc"), (x / 16) * ui.barW, 104); } }
        else plPh.style.display = "none";
      }
    }

    // =================================================================
    //  Channel rack
    // =================================================================
    function renderRack() {
      stale.rack = 0;
      const v = views.rack, pat = curPat(), len = pat.len;
      v.innerHTML = "";
      const head = el(`<div class="fl-vhead">
        <span class="fl-vtitle">${ic("rack", 16)}<span>Channel rack</span></span>
        <button class="fl-chip fl-rack-pat" title="Choose pattern" aria-haspopup="menu"><i class="fl-sw" style="background:${patColor(proj.cur)}"></i><span>${esc(pat.name)}</span>${ic("chev", 12)}</button>
        <span class="fl-grow"></span>
        <span class="fl-swing"></span>
        <div class="fl-seg" role="group" aria-label="Pattern length in steps"><button data-len="16" aria-pressed="${len === 16}" class="${len === 16 ? "fl-lit" : ""}">16</button><button data-len="32" aria-pressed="${len === 32}" class="${len === 32 ? "fl-lit" : ""}">32</button></div>
        <button class="fl-ibtn fl-rack-clear" title="Clear this pattern" aria-label="Clear pattern">${ic("trash", 16)}</button>
      </div>`);
      head.querySelector(".fl-swing").appendChild(labeled(pknob(proj, "swing", { label: "Swing", min: 0, max: 100, def: 0, size: 28, fmt: (x) => Math.round(x) + "%" }), "SWING"));
      head.querySelector(".fl-rack-pat").onclick = (e) => patternMenu(e.currentTarget);
      head.querySelectorAll("[data-len]").forEach((b) => { b.onclick = () => { const n = +b.dataset.len; if (pat.len === n) return; edit(() => { pat.len = n; trimPattern(pat); }); refresh("rack", "piano", "playlist"); hint("Pattern length", n + " steps"); }; });
      head.querySelector(".fl-rack-clear").onclick = () => confirmBox("Clear pattern", `Remove every step and note from “${pat.name}”?`, "Clear").then((ok) => { if (!ok) return; edit(() => { pat.steps = {}; pat.notes = {}; }); refresh("rack", "piano", "playlist"); });

      const sc = el(`<div class="fl-rack-sc"><div class="fl-rack-in" style="--n:${len}"></div></div>`), inner = sc.firstChild;
      const leds = el(`<div class="fl-rrow fl-ledrow"><div class="fl-rleft"><span class="fl-dim">${proj.channels.length} channel${proj.channels.length === 1 ? "" : "s"}</span></div><div class="fl-steps">${Array.from({ length: len }, (_, i) => `<i class="fl-led${i % 4 === 0 ? " fl-beat" : ""}" data-i="${i}"></i>`).join("")}</div><div class="fl-rsel"></div></div>`);
      inner.appendChild(leds);
      rackCols = Array.from({ length: len }, () => []);
      leds.querySelectorAll(".fl-led").forEach((n, i) => rackCols[i].push(n));
      const solo = proj.channels.some((c) => c.solo);
      proj.channels.forEach((ch) => inner.appendChild(rackRow(ch, pat, solo)));
      if (!proj.channels.length) inner.appendChild(el(`<div class="fl-empty">No channels yet — add one with the button below or from the Browser.</div>`));
      const foot = el(`<div class="fl-rack-foot"><button class="fl-btn fl-add-ch">${ic("plus", 16)}<span>Add channel</span></button><span class="fl-dim fl-foot-tip">Tap a channel name to hear it · hold it for options · tap the green bars to edit notes</span></div>`);
      foot.querySelector(".fl-add-ch").onclick = (e) => addChannelMenu(e.currentTarget);
      v.append(head, sc, foot);
      watchUserScroll(sc); checkRackScroll();

      // Step input. Mouse / pen: press toggles, drag along the row paints.
      // Touch: a tap toggles (on release). A sideways drag paints only while the whole pattern fits on
      // screen; when the rack scrolls sideways (32 steps on an iPad) the swipe scrolls it instead, and a
      // vertical swipe always scrolls. Steps carry touch-action pan-y / pan-x pan-y to match (see CSS).
      inner.addEventListener("pointerdown", (e) => {
        const s = e.target.closest(".fl-step"); if (!s || e.button) return;
        const row = s.closest(".fl-rrow"), ch = chById(row.dataset.ch); if (!ch) return;
        const i = +s.dataset.i, arr = pat.steps[ch.id] || (pat.steps[ch.id] = new Array(32).fill(0)), prev = arr[i], val = prev > 0 ? 0 : 0.8;
        const touch = e.pointerType === "touch", hscroll = sc.classList.contains("fl-hscroll");
        let painting = !touch, painted = false, scrolled = false;
        beginEdit(); if (painting) setStep(pat, ch, i, val, s);
        setOp(e, {
          move(ev) {
            if (scrolled) return;
            if (!painting) {
              const dx = ev.clientX - e.clientX, dy = ev.clientY - e.clientY;
              if (Math.hypot(dx, dy) < 10) return;
              if (hscroll || Math.abs(dx) < Math.abs(dy) * 1.3) { scrolled = true; return; } // a scroll gesture, not a stroke
              painting = true; setStep(pat, ch, i, val, s);
            }
            const t = document.elementFromPoint(ev.clientX, ev.clientY), c = t && t.closest ? t.closest(".fl-step") : null;
            if (!c || c.closest(".fl-rrow") !== row) return;
            const j = +c.dataset.i; if ((arr[j] > 0) !== (val > 0)) { setStep(pat, ch, j, val, c); painted = true; }
          },
          up() { if (!painting && !scrolled) setStep(pat, ch, i, val, s); endEdit(); },
          cancel() { if (painting && !painted) setStep(pat, ch, i, prev, s); endEdit(); },
        });
      });
    }
    // Does the step grid overflow sideways? (decides whether a sideways touch swipe paints or scrolls)
    function checkRackScroll() {
      const sc = views.rack.querySelector(".fl-rack-sc"); if (!sc || !sc.clientWidth) return;
      sc.classList.toggle("fl-hscroll", sc.scrollWidth > sc.clientWidth + 2);
    }
    function setStep(pat, ch, i, val, cell) {
      const arr = pat.steps[ch.id] || (pat.steps[ch.id] = new Array(32).fill(0)); arr[i] = val;
      if (cell) { cell.classList.toggle("fl-lit", val > 0); cell.setAttribute("aria-checked", String(val > 0)); cell.style.setProperty("--v", String(val > 0 ? val : 0)); }
      stale.playlist = 1; if (ui.view !== "piano") stale.piano = 1;
    }
    function trimPattern(pat) {
      Object.keys(pat.steps).forEach((id) => { const a = pat.steps[id]; for (let i = pat.len; i < 32; i++) a[i] = 0; });
      Object.keys(pat.notes).forEach((id) => { pat.notes[id] = pat.notes[id].filter((n) => n.s < pat.len).map((n) => Object.assign(n, { l: Math.min(n.l, pat.len - n.s) })); });
    }
    function rackRow(ch, pat, solo) {
      const len = pat.len, notes = pat.notes[ch.id], roll = !!(notes && notes.length), sel = ch.id === ui.selCh;
      const row = el(`<div class="fl-rrow${sel ? " fl-sel" : ""}${ch.mute || (solo && !ch.solo) ? " fl-muted" : ""}" data-ch="${esc(ch.id)}">
        <div class="fl-rleft">
          <button class="fl-mled${ch.mute ? "" : " fl-lit"}" aria-label="Mute ${esc(ch.name)}" aria-pressed="${ch.mute}" title="Mute"></button>
          <button class="fl-solo${ch.solo ? " fl-lit" : ""}" aria-label="Solo ${esc(ch.name)}" aria-pressed="${ch.solo}" title="Solo">S</button>
          <span class="fl-kslot fl-kpan"></span><span class="fl-kslot fl-kvol"></span>
          <button class="fl-cname" title="Tap: select & preview · Hold: options"><span class="fl-cins">${ch.insert || "-"}</span><span class="fl-cn">${esc(ch.name)}</span></button>
          <button class="fl-cmore" aria-label="${esc(ch.name)} options" aria-haspopup="menu">${ic("more", 16)}</button>
        </div>
        <div class="fl-steps${roll ? " fl-has-roll" : ""}"></div>
        <div class="fl-rsel" aria-hidden="true"></div>
      </div>`);
      row.querySelector(".fl-kpan").appendChild(pknob(ch, "pan", { label: ch.name + " panning", min: -1, max: 1, def: 0, bipolar: true, size: 26, fmt: (x) => (Math.abs(x) < 0.01 ? "Centered" : Math.round(Math.abs(x) * 100) + "% " + (x < 0 ? "left" : "right")), after: syncAudio }));
      row.querySelector(".fl-kvol").appendChild(pknob(ch, "vol", { label: ch.name + " volume", min: 0, max: 1, def: 0.78, size: 26, fmt: (x) => Math.round(x * 100) + "% (" + toDb(chanGain(x)) + ")", after: syncAudio }));
      const stepsEl = row.querySelector(".fl-steps");
      if (roll) {
        let lo = 127, hi = 0; notes.forEach((n) => { lo = Math.min(lo, n.k); hi = Math.max(hi, n.k); });
        const span = Math.max(6, hi - lo + 1);
        const mr = el(`<div class="fl-miniroll" role="button" tabindex="0" aria-label="Edit ${esc(ch.name)} in the piano roll" title="Open in the piano roll">${notes.map((n) => `<i style="left:${((n.s / len) * 100).toFixed(2)}%;width:${((n.l / len) * 100).toFixed(2)}%;top:${(((hi - n.k) / span) * 78 + 8).toFixed(1)}%"></i>`).join("")}${Array.from({ length: len / 4 }, (_, i) => `<b style="left:${((i * 4) / len) * 100}%"></b>`).join("")}</div>`);
        const openPr = () => { selectChannel(ch.id); setView("piano"); };
        mr.onclick = openPr; mr.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPr(); } };
        stepsEl.appendChild(mr);
      } else {
        const st = pat.steps[ch.id] || [];
        let h = "";
        for (let i = 0; i < len; i++) { const on = st[i] > 0; h += `<span class="fl-step fl-g${Math.floor(i / 4) % 2}${on ? " fl-lit" : ""}" data-i="${i}" role="checkbox" aria-checked="${on}" aria-label="${esc(ch.name)} step ${i + 1}" style="--v:${on ? st[i] : 0}"></span>`; }
        stepsEl.innerHTML = h;
        stepsEl.querySelectorAll(".fl-step").forEach((n, i) => { if (rackCols[i]) rackCols[i].push(n); });
      }
      row.querySelector(".fl-mled").onclick = () => { edit(() => { ch.mute = !ch.mute; }); syncAudio(); refresh("rack"); };
      row.querySelector(".fl-solo").onclick = () => { edit(() => { ch.solo = !ch.solo; }); syncAudio(); refresh("rack"); };
      row.querySelector(".fl-cmore").onclick = (e) => channelMenu(ch, e.currentTarget);
      const nameBtn = row.querySelector(".fl-cname");
      let longFired = false;
      nameBtn.addEventListener("pointerdown", (e) => {
        if (e.button) return; longFired = false;
        selectChannel(ch.id);
        const pid = e.pointerId, tag = "ch:" + pid, x0 = e.clientX, y0 = e.clientY;
        noteOn(ch, ch.root || 60, tag);
        // release is tracked on window, per pointer (the row may re-render while the finger is down);
        // each press owns its own long-press timer, so a second finger can't orphan the first one's
        const hold = {
          lp: setTimeout(() => {
            if (closed || !nameBtn.isConnected || ops.get(pid) !== hold) return;
            longFired = true; ops.delete(pid); noteOff(tag, true); channelMenu(ch, nameBtn);
          }, 550),
          move(ev) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 12) clearTimeout(hold.lp); },
          up() { clearTimeout(hold.lp); noteOff(tag); },
          cancel() { clearTimeout(hold.lp); noteOff(tag); },
        };
        setOp(e, hold);
      });
      nameBtn.addEventListener("dblclick", () => { if (!longFired) channelSettings(ch); });
      nameBtn.addEventListener("contextmenu", (e) => { e.preventDefault(); ops.forEach((o) => { if (o.lp) clearTimeout(o.lp); }); if (!longFired) channelMenu(ch, nameBtn); });
      nameBtn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); selectChannel(ch.id); noteOn(ch, ch.root || 60, "kb:" + ch.id); setTimeout(() => noteOff("kb:" + ch.id), 250); } });
      return row;
    }
    function selectChannel(id) {
      if (ui.selCh === id) return;
      ui.selCh = id;
      views.rack.querySelectorAll(".fl-rrow[data-ch]").forEach((r) => r.classList.toggle("fl-sel", r.dataset.ch === id));
      stale.piano = 1; stale.mixer = 1; persistUiSoon();
      if (ui.view === "mixer") renderMixer();
    }
    let uiTimer = 0; const persistUiSoon = () => { clearTimeout(uiTimer); uiTimer = setTimeout(persist, 900); };

    // =================================================================
    //  Piano roll
    // =================================================================
    let prPh = null, prCW = 24, prScrolledFor = null, prRenderNotes = null;
    function prChannel() {
      let ch = chById(ui.selCh);
      if (!ch) { ch = proj.channels.find((c) => kindOf(c) === "synth") || proj.channels[0] || null; if (ch) ui.selCh = ch.id; }
      return ch;
    }
    function renderPiano() {
      stale.piano = 0;
      const v = views.piano; v.innerHTML = ""; prPh = null;
      const ch = prChannel(), pat = curPat(), len = pat.len;
      if (!ch) { v.innerHTML = `<div class="fl-empty">Add a channel to the Channel rack to write notes.</div>`; return; }
      // Steps and notes are one sequence, as in FL: a step-sequenced channel (every drum, by default)
      // shows its steps here as notes on its step note. Editing converts them into real notes first, so
      // nothing that already plays is lost; while every note is still a plain step (step note, and one
      // step long for synths) the channel stays step-sequenced in the rack.
      let derived = null, converted = false;
      function shown() {
        const real = pat.notes[ch.id];
        if (real && real.length) { derived = null; return real; }
        const st = pat.steps[ch.id] || [], root = ch.root || 60; derived = [];
        for (let i = 0; i < len; i++) if (st[i] > 0) derived.push({ s: i, l: 1, k: root, v: st[i] });
        return derived;
      }
      function materialize() { // call inside an edit, before changing notes; keeps the objects the grid holds
        const real = pat.notes[ch.id]; if (real && real.length) return real;
        const arr = derived || (shown(), derived) || [];
        pat.notes[ch.id] = arr; delete pat.steps[ch.id]; derived = null; converted = true;
        return arr;
      }
      function settle() { // end of an edit: back to steps when nothing needs the piano roll
        const arr = pat.notes[ch.id], was = converted; converted = false;
        stale.rack = stale.playlist = 1;
        if (!arr || !arr.length) { delete pat.notes[ch.id]; return; }
        if (!was) return;
        const drum = kindOf(ch) === "drum", root = ch.root || 60, seen = {};
        const plain = arr.every((n) => { if (n.k !== root || (!drum && n.l !== 1) || n.s >= len || seen[n.s]) return false; seen[n.s] = 1; return true; });
        if (!plain) return;
        const a = new Array(32).fill(0); arr.forEach((n) => { a[n.s] = n.v; });
        pat.steps[ch.id] = a; delete pat.notes[ch.id];
      }
      const notes = shown();
      let lo = 36, hi = 95; notes.forEach((n) => { lo = Math.min(lo, n.k); hi = Math.max(hi, n.k); });
      lo = Math.floor(lo / 12) * 12; hi = Math.ceil((hi + 1) / 12) * 12 - 1;
      const head = el(`<div class="fl-vhead">
        <span class="fl-vtitle">${ic("piano", 16)}<span>Piano roll</span></span>
        <label class="fl-sel-wrap" title="Channel"><select class="fl-select fl-pr-ch" aria-label="Channel">${proj.channels.map((c) => `<option value="${esc(c.id)}"${c.id === ch.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
        <button class="fl-chip fl-pr-pat" title="Choose pattern" aria-haspopup="menu"><i class="fl-sw" style="background:${patColor(proj.cur)}"></i><span>${esc(pat.name)}</span>${ic("chev", 12)}</button>
        <span class="fl-grow"></span>
        <label class="fl-sel-wrap" title="Snap">${ic("snap", 14)}<select class="fl-select fl-pr-snap" aria-label="Snap to grid">${SNAPS.map((s) => `<option value="${s[0]}"${s[0] === ui.snap ? " selected" : ""}>${s[1]}</option>`).join("")}</select></label>
        <label class="fl-sel-wrap" title="Length of new notes">${ic("pencil", 14)}<select class="fl-select fl-pr-len" aria-label="New note length">${NLENS.map((s) => `<option value="${s[0]}"${s[0] === ui.nlen ? " selected" : ""}>${s[1]}</option>`).join("")}</select></label>
        <button class="fl-ibtn fl-pr-zout" aria-label="Zoom out">${ic("zout", 16)}</button><button class="fl-ibtn fl-pr-zin" aria-label="Zoom in">${ic("zin", 16)}</button>
        <button class="fl-ibtn fl-pr-clear" aria-label="Clear notes" title="Clear this channel's notes">${ic("trash", 16)}</button>
      </div>`);
      head.querySelector(".fl-pr-ch").onchange = (e) => { selectChannel(e.target.value); prScrolledFor = null; renderPiano(); };
      head.querySelector(".fl-pr-pat").onclick = (e) => patternMenu(e.currentTarget);
      head.querySelector(".fl-pr-snap").onchange = (e) => { ui.snap = +e.target.value; persistUiSoon(); };
      head.querySelector(".fl-pr-len").onchange = (e) => { ui.nlen = +e.target.value; persistUiSoon(); };
      const zoom = (d) => { ui.prZoom = clamp(ui.prZoom * (d > 0 ? 1.25 : 0.8), 0.5, 3); ui.rowH = clamp(Math.round(ui.rowH * (d > 0 ? 1.12 : 0.9)), MIN_ROW, 44); renderPiano(); persistUiSoon(); };
      head.querySelector(".fl-pr-zin").onclick = () => zoom(1); head.querySelector(".fl-pr-zout").onclick = () => zoom(-1);
      head.querySelector(".fl-pr-clear").onclick = () => { if (!shown().length) return; edit(() => { delete pat.notes[ch.id]; delete pat.steps[ch.id]; }); renderPiano(); stale.rack = stale.playlist = 1; hint("Piano roll", "Notes cleared"); };

      const KW = 58, RULER = 22, RH = ui.rowH, rows = hi - lo + 1;
      const avail = Math.max(200, (v.clientWidth || views.rack.clientWidth || 700) - KW - 14);
      const CW = (prCW = Math.max(coarse ? 32 : 14, Math.round((avail / len) * ui.prZoom))); // touch: one step >= 32 px wide
      const GW = len * CW, GH = rows * RH;
      const sc = el(`<div class="fl-pr-sc"><div class="fl-pr-in" style="grid-template-columns:${KW}px ${GW}px;grid-template-rows:${RULER}px ${GH}px"><div class="fl-pr-corner"></div><div class="fl-pr-ruler"></div><div class="fl-pr-keys"></div><div class="fl-pr-grid"><div class="fl-pr-notes"></div><div class="fl-pr-ph"></div></div></div></div>`);
      const ruler = sc.querySelector(".fl-pr-ruler"), keys = sc.querySelector(".fl-pr-keys"), grid = sc.querySelector(".fl-pr-grid"), layerN = sc.querySelector(".fl-pr-notes");
      prPh = sc.querySelector(".fl-pr-ph");
      let rh = ""; for (let b = 0; b < len; b += 4) rh += `<span class="${b % 16 === 0 ? "fl-bar" : ""}" style="left:${b * CW}px">${b % 16 === 0 ? b / 16 + 1 : (b / 16 + 1 | 0) + "." + ((b % 16) / 4 + 1)}</span>`;
      ruler.innerHTML = rh;
      let kh = ""; for (let m = hi; m >= lo; m--) kh += `<div class="fl-key ${isBlack(m) ? "fl-kb" : "fl-kw"}${m % 12 === 0 ? " fl-kc" : ""}" data-k="${m}" style="height:${RH}px">${m % 12 === 0 || RH >= 26 ? `<span>${noteName(m)}</span>` : ""}</div>`;
      keys.innerHTML = kh;
      // background: bar / beat / step lines, row lines, black-key rows (one octave tile; top row is a B)
      let stops = []; for (let r = 0; r < 12; r++) if (isBlack(hi - r)) stops.push(`transparent ${r * RH}px,var(--fl-pr-black) ${r * RH}px,var(--fl-pr-black) ${(r + 1) * RH}px,transparent ${(r + 1) * RH}px`);
      grid.style.backgroundImage = [
        "linear-gradient(90deg,var(--fl-pr-bar) 1px,transparent 1px)", "linear-gradient(90deg,var(--fl-pr-beat) 1px,transparent 1px)", "linear-gradient(90deg,var(--fl-pr-step) 1px,transparent 1px)",
        `linear-gradient(180deg,transparent ${12 * RH - 1}px,var(--fl-pr-oct) ${12 * RH - 1}px)`, "linear-gradient(180deg,var(--fl-pr-row) 1px,transparent 1px)", `linear-gradient(180deg,${stops.join(",")})`,
      ].join(",");
      grid.style.backgroundSize = `${16 * CW}px 100%,${4 * CW}px 100%,${CW}px 100%,100% ${12 * RH}px,100% ${RH}px,100% ${12 * RH}px`;
      const place = (n, d) => { d.style.left = n.s * CW + "px"; d.style.top = (hi - n.k) * RH + "px"; d.style.width = Math.max(4, n.l * CW - 1) + "px"; d.style.height = RH - 1 + "px"; const s = d.querySelector("span"); if (s) s.textContent = n.l * CW > 30 ? noteName(n.k) : ""; };
      function renderNotes() {
        const arr = shown();
        layerN.innerHTML = "";
        arr.forEach((n) => { const d = el(`<div class="fl-note" style="--v:${n.v}"><span></span><i class="fl-nh"></i></div>`); d.__n = n; place(n, d); layerN.appendChild(d); });
      }
      renderNotes(); prRenderNotes = renderNotes;
      grid.addEventListener("contextmenu", (e) => {
        e.preventDefault(); const d = e.target.closest(".fl-note"); if (!d) return;
        edit(() => { const arr = materialize(), i = arr.indexOf(d.__n); if (i >= 0) arr.splice(i, 1); settle(); }); renderNotes();
      });
      grid.addEventListener("pointerdown", (e) => {
        if (e.button) return;
        const d = e.target.closest(".fl-note");
        if (d) {
          e.preventDefault(); e.stopPropagation();
          const n = d.__n, r = d.getBoundingClientRect();
          // the resize grip never covers more than ~30 % of a note, so short notes can still be moved by finger
          const grip = Math.min(coarse ? 16 : 9, r.width * 0.3);
          const resize = e.target.classList.contains("fl-nh") || e.clientX > r.right - grip;
          const o0 = { s: n.s, k: n.k, l: n.l }; let moved = false;
          try { d.setPointerCapture(e.pointerId); } catch (er) {}
          beginEdit(); materialize(); d.classList.add("fl-drag");
          setOp(e, {
            move(ev) {
              const dx = ev.clientX - e.clientX, dy = ev.clientY - e.clientY;
              if (!moved && Math.hypot(dx, dy) < 6) return; moved = true;
              if (resize) n.l = clamp(Math.round((o0.l * CW + dx) / (CW * ui.snap)) * ui.snap || ui.snap, 1, len - n.s);
              else {
                n.s = clamp(o0.s + Math.round(dx / (CW * ui.snap)) * ui.snap, 0, len - 1);
                const nk = clamp(o0.k - Math.round(dy / RH), lo, hi);
                if (nk !== n.k) { n.k = nk; noteOn(ch, nk, "drag"); setTimeout(() => noteOff("drag", true), 140); }
                n.l = Math.min(o0.l, len - n.s);
              }
              place(n, d);
            },
            up() {
              d.classList.remove("fl-drag");
              if (!moved) { const arr = pat.notes[ch.id] || []; const i = arr.indexOf(n); if (i >= 0) arr.splice(i, 1); }
              settle(); endEdit(); renderNotes();
            },
            cancel() { Object.assign(n, o0); d.classList.remove("fl-drag"); settle(); endEdit(); renderNotes(); },
          });
          return;
        }
        let moved = false;
        setOp(e, {
          move(ev) { if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 8) moved = true; },
          up(ev) {
            if (moved || !ev) return;
            const r = grid.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
            const s = Math.floor(x / CW / ui.snap) * ui.snap, k = hi - Math.floor(y / RH);
            if (s < 0 || s >= len || k < lo || k > hi) return;
            edit(() => { const arr = materialize(); arr.push({ s, l: Math.max(1, Math.min(ui.nlen, len - s)), k, v: 0.8 }); settle(); });
            renderNotes(); noteOn(ch, k, "add"); setTimeout(() => noteOff("add", true), 180);
          },
        });
      });
      // piano keys preview (and record when armed); sliding across keys plays a glissando.
      // Every finger is its own pointer op, so chords work on a touch screen.
      keys.addEventListener("pointerdown", (e) => {
        const kEl = e.target.closest(".fl-key"); if (!kEl || e.button) return;
        e.preventDefault(); const tag = "pk:" + e.pointerId; noteOn(ch, +kEl.dataset.k, tag);
        let curK = +kEl.dataset.k;
        setOp(e, {
          move(ev) { const t = document.elementFromPoint(ev.clientX, ev.clientY), kk = t && t.closest ? t.closest(".fl-key") : null; if (kk && +kk.dataset.k !== curK) { curK = +kk.dataset.k; noteOn(ch, curK, tag); } },
          up() { noteOff(tag); }, cancel() { noteOff(tag); },
        });
      });
      v.append(head, sc);
      if (prScrolledFor !== ch.id + "|" + pat.id) {
        prScrolledFor = ch.id + "|" + pat.id;
        const mid = notes.length ? notes.reduce((a, n) => a + n.k, 0) / notes.length : (ch.root || 60);
        sc.scrollTop = Math.max(0, (hi - mid) * RH - sc.clientHeight / 2 + RULER);
      } else if (ui._prScroll) { sc.scrollTop = ui._prScroll[0]; sc.scrollLeft = ui._prScroll[1]; }
      sc.addEventListener("scroll", () => { ui._prScroll = [sc.scrollTop, sc.scrollLeft]; }, { passive: true });
      watchUserScroll(sc);
      updatePlayheads();
    }
    function keyLight(k, on) { const n = views.piano.querySelector(`.fl-key[data-k="${k}"]`); if (n) n.classList.toggle("fl-down", on); }

    // =================================================================
    //  Playlist
    // =================================================================
    let plPh = null;
    function clipPreview(pat) {
      const rows = proj.channels.filter((c) => (pat.notes[c.id] && pat.notes[c.id].length) || (pat.steps[c.id] || []).some((x, i) => x > 0 && i < pat.len));
      if (!rows.length) return "";
      let h = "";
      rows.forEach((c, r) => {
        const ns = pat.notes[c.id];
        if (ns && ns.length) {
          let lo = 127, hi = 0; ns.forEach((n) => { lo = Math.min(lo, n.k); hi = Math.max(hi, n.k); }); const sp = Math.max(1, hi - lo);
          ns.forEach((n) => { h += `<rect x="${n.s}" y="${(r + 0.15 + (1 - (n.k - lo) / sp) * 0.55).toFixed(2)}" width="${Math.max(0.6, n.l - 0.15)}" height="0.28"/>`; });
        } else (pat.steps[c.id] || []).forEach((x, i) => { if (x > 0 && i < pat.len) h += `<rect x="${i + 0.1}" y="${r + 0.2}" width="0.7" height="0.6" opacity="${(0.45 + x * 0.55).toFixed(2)}"/>`; });
      });
      return `<svg class="fl-clip-pv" viewBox="0 0 ${pat.len} ${rows.length}" preserveAspectRatio="none" aria-hidden="true">${h}</svg>`;
    }
    function renderPlaylist() {
      stale.playlist = 0; plPh = null;
      const v = views.playlist, pl = proj.playlist, BW = ui.barW, TH = coarse ? 46 : 40, HW = 104, RULER = coarse ? 32 : 24;
      const songSteps = songLenSteps(proj), songBars = Math.ceil(songSteps / 16), bars = Math.max(16, songBars + 8);
      v.innerHTML = "";
      const head = el(`<div class="fl-vhead">
        <span class="fl-vtitle">${ic("playlist", 16)}<span>Playlist - Arrangement</span></span>
        <button class="fl-chip fl-pl-pat" title="Pattern to paint" aria-haspopup="menu"><i class="fl-sw" style="background:${patColor(proj.cur)}"></i><span>${esc(curPat().name)}</span>${ic("chev", 12)}</button>
        <span class="fl-dim fl-pl-len">${songBars} bar${songBars === 1 ? "" : "s"} · ${fmtDur(songSteps * stepDur(proj))}</span>
        <span class="fl-grow"></span>
        <button class="fl-ibtn fl-pl-zout" aria-label="Zoom out">${ic("zout", 16)}</button><button class="fl-ibtn fl-pl-zin" aria-label="Zoom in">${ic("zin", 16)}</button>
        <button class="fl-ibtn fl-pl-clear" aria-label="Clear arrangement" title="Remove every clip">${ic("trash", 16)}</button>
      </div>`);
      head.querySelector(".fl-pl-pat").onclick = (e) => patternMenu(e.currentTarget);
      head.querySelector(".fl-pl-zin").onclick = () => { ui.barW = clamp(Math.round(ui.barW * 1.2), 28, 120); renderPlaylist(); persistUiSoon(); };
      head.querySelector(".fl-pl-zout").onclick = () => { ui.barW = clamp(Math.round(ui.barW / 1.2), 28, 120); renderPlaylist(); persistUiSoon(); };
      head.querySelector(".fl-pl-clear").onclick = () => { if (!pl.clips.length) return; confirmBox("Clear playlist", "Remove every pattern clip from the arrangement?", "Clear").then((ok) => { if (ok) { edit(() => { pl.clips = []; }); renderPlaylist(); } }); };
      const bodyEl = el(`<div class="fl-pl-body"><div class="fl-pl-picker" aria-label="Patterns"></div><div class="fl-pl-sc"><div class="fl-pl-in" style="grid-template-columns:${HW}px ${bars * BW}px;grid-template-rows:${RULER}px ${pl.tracks * TH}px"><div class="fl-pl-corner"></div><div class="fl-pl-ruler" title="Tap to move the song position"></div><div class="fl-pl-heads"></div><div class="fl-pl-lanes"><div class="fl-pl-loop"></div><div class="fl-pl-ph"></div></div></div></div></div>`);
      const picker = bodyEl.querySelector(".fl-pl-picker");
      proj.patterns.forEach((p, i) => {
        const b = el(`<button class="fl-pick${i === proj.cur ? " fl-lit" : ""}" title="Paint with ${esc(p.name)}"><i class="fl-sw" style="background:${patColor(i)}"></i><span>${esc(p.name)}</span></button>`);
        b.onclick = () => selectPattern(i); picker.appendChild(b);
      });
      const addP = el(`<button class="fl-pick fl-pick-add">${ic("plus", 14)}<span>New pattern</span></button>`); addP.onclick = () => addPattern(); picker.appendChild(addP);
      const ruler = bodyEl.querySelector(".fl-pl-ruler"), heads = bodyEl.querySelector(".fl-pl-heads"), lanes = bodyEl.querySelector(".fl-pl-lanes");
      let rh = ""; for (let b = 0; b < bars; b++) rh += `<span style="left:${b * BW}px"${b < songBars ? ' class="fl-in"' : ""}>${b + 1}</span>`;
      ruler.innerHTML = rh;
      bodyEl.querySelector(".fl-pl-loop").style.width = songBars * BW + "px";
      for (let t = 0; t < pl.tracks; t++) {
        const hd = el(`<div class="fl-trk" style="height:${TH}px"><button class="fl-mled${pl.muted[t] ? "" : " fl-lit"}" aria-label="Mute track ${t + 1}" aria-pressed="${!!pl.muted[t]}"></button><span>Track ${t + 1}</span></div>`);
        hd.querySelector("button").onclick = () => { edit(() => { pl.muted[t] = !pl.muted[t]; for (let i = 0; i < pl.tracks; i++) pl.muted[i] = !!pl.muted[i]; }); renderPlaylist(); };
        heads.appendChild(hd);
      }
      lanes.style.backgroundSize = `${BW}px 100%,${BW / 4}px 100%,100% ${TH * 2}px`;
      const pv = {}; proj.patterns.forEach((p) => { pv[p.id] = clipPreview(p); });
      pl.clips.forEach((c) => {
        const pi = proj.patterns.findIndex((p) => p.id === c.pid); if (pi < 0) return;
        const p = proj.patterns[pi];
        const d = el(`<div class="fl-clip${pl.muted[c.t] ? " fl-off" : ""}" style="left:${c.b * BW + 1}px;top:${c.t * TH + 1}px;width:${patBars(p) * BW - 2}px;height:${TH - 2}px;--c:${patColor(pi)}" title="${esc(p.name)} — tap to remove, drag to move"><b>${esc(p.name)}</b>${pv[p.id]}</div>`);
        d.__c = c; lanes.appendChild(d);
      });
      plPh = bodyEl.querySelector(".fl-pl-ph");
      lanes.addEventListener("contextmenu", (e) => { e.preventDefault(); const d = e.target.closest(".fl-clip"); if (d) { edit(() => { pl.clips.splice(pl.clips.indexOf(d.__c), 1); }); renderPlaylist(); } });
      lanes.addEventListener("pointerdown", (e) => {
        if (e.button) return;
        const d = e.target.closest(".fl-clip");
        if (d) {
          e.preventDefault(); e.stopPropagation();
          const c = d.__c, o0 = { t: c.t, b: c.b }; let moved = false;
          try { d.setPointerCapture(e.pointerId); } catch (er) {}
          beginEdit(); d.classList.add("fl-drag");
          setOp(e, {
            move(ev) {
              const dx = ev.clientX - e.clientX, dy = ev.clientY - e.clientY; if (!moved && Math.hypot(dx, dy) < 6) return; moved = true;
              c.b = clamp(o0.b + Math.round(dx / BW), 0, 511); c.t = clamp(o0.t + Math.round(dy / TH), 0, pl.tracks - 1);
              d.style.left = c.b * BW + 1 + "px"; d.style.top = c.t * TH + 1 + "px";
            },
            up() { if (!moved) { const i = pl.clips.indexOf(c); if (i >= 0) pl.clips.splice(i, 1); } endEdit(); renderPlaylist(); },
            cancel() { Object.assign(c, o0); endEdit(); renderPlaylist(); },
          });
          return;
        }
        let moved = false;
        setOp(e, {
          move(ev) { if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 8) moved = true; },
          up(ev) {
            if (moved || !ev) return;
            const r = lanes.getBoundingClientRect(), t = Math.floor((ev.clientY - r.top) / TH), b = Math.floor((ev.clientX - r.left) / BW);
            if (t < 0 || t >= pl.tracks || b < 0) return;
            edit(() => { pl.clips.push({ t, b, pid: curPat().id }); });
            renderPlaylist(); hint("Playlist", curPat().name + " placed at bar " + (b + 1));
          },
        });
      });
      ruler.addEventListener("click", (e) => {
        const r = ruler.getBoundingClientRect(), b = clamp(Math.floor((e.clientX - r.left) / BW), 0, bars - 1);
        if (proj.mode !== "song") setMode("song");
        T.pos = b * 16; if (T.playing) { T.queue = []; if (E) E.panic(); T.nextTime = E.ctx.currentTime + 0.03; }
        updatePlayheads(); hint("Song position", "Bar " + (b + 1));
      });
      v.append(head, bodyEl);
      watchUserScroll(bodyEl.querySelector(".fl-pl-sc"));
      updatePlayheads();
    }

    // =================================================================
    //  Mixer
    // =================================================================
    let mxMeters = [];
    function renderMixer() {
      stale.mixer = 0;
      const v = views.mixer; v.innerHTML = ""; mxMeters = [];
      if (ui.mxSel >= proj.mixer.length) ui.mxSel = 0;
      const routed = (i) => proj.channels.filter((c) => (c.insert || 0) === i).map((c) => c.name);
      const sel = proj.mixer[ui.mxSel], selCh = chById(ui.selCh);
      const head = el(`<div class="fl-vhead">
        <span class="fl-vtitle">${ic("mixer", 16)}<span>Mixer - ${esc(ui.mxSel ? sel.name : "Master")}</span></span>
        <span class="fl-dim fl-mx-routed">${routed(ui.mxSel).length ? "Channels: " + esc(routed(ui.mxSel).join(", ")) : ui.mxSel ? "No channels routed here" : "Master: Fruity Limiter · Reverb + Delay returns"}</span>
        <span class="fl-grow"></span>
        ${ui.mxSel && selCh ? `<button class="fl-btn fl-mx-route" title="Send the selected channel to this insert">Route ${esc(selCh.name)} here</button>` : ""}
        <button class="fl-btn fl-mx-add">${ic("plus", 14)}<span>Insert</span></button>
      </div>`);
      const rb = head.querySelector(".fl-mx-route");
      if (rb) rb.onclick = () => { edit(() => { selCh.insert = ui.mxSel; }); syncAudio(); stale.rack = 1; renderMixer(); hint("Routing", selCh.name + " → " + sel.name); };
      head.querySelector(".fl-mx-add").onclick = () => { if (proj.mixer.length >= 65) return; edit(() => { proj.mixer.push(mkInsert("Insert " + proj.mixer.length)); }); syncAudio(); ui.mxSel = proj.mixer.length - 1; renderMixer(); };
      const strips = el(`<div class="fl-mx-sc"><div class="fl-mx-in"></div></div>`), inner = strips.firstChild;
      proj.mixer.forEach((m, i) => {
        const s = el(`<div class="fl-strip${i === 0 ? " fl-master" : ""}${ui.mxSel === i ? " fl-lit" : ""}" data-i="${i}">
          <div class="fl-st-top"><span class="fl-st-num">${i === 0 ? "M" : i}</span><span class="fl-st-name" title="${esc(m.name)}">${esc(i === 0 ? "Master" : m.name)}</span></div>
          <div class="fl-st-mid"><div class="fl-st-meter" aria-hidden="true"><i><b></b></i><i><b></b></i></div><span class="fl-st-fd"></span></div>
          <div class="fl-st-db">${toDb(faderGain(m.vol))}</div>
          <div class="fl-st-knobs"></div>
          <button class="fl-mled${m.mute ? "" : " fl-lit"}" aria-label="Mute ${esc(i === 0 ? "Master" : m.name)}" aria-pressed="${m.mute}" title="Mute"></button>
        </div>`);
        const db = s.querySelector(".fl-st-db");
        s.querySelector(".fl-st-fd").appendChild(fader({ label: (i ? m.name : "Master") + " volume", value: m.vol, def: 0.8, fmt: (x) => toDb(faderGain(x)), onStart: beginEdit, onEnd: endEdit, onInput: (x) => { m.vol = x; db.textContent = toDb(faderGain(x)); syncAudio(); } }));
        const kn = s.querySelector(".fl-st-knobs");
        kn.appendChild(labeled(pknob(m, "pan", { label: (i ? m.name : "Master") + " panning", min: -1, max: 1, def: 0, bipolar: true, size: 26, fmt: (x) => (Math.abs(x) < 0.01 ? "Centered" : Math.round(Math.abs(x) * 100) + "% " + (x < 0 ? "left" : "right")), after: syncAudio }), "PAN"));
        if (i > 0) {
          kn.appendChild(labeled(pknob(m, "rev", { label: m.name + " reverb send", min: 0, max: 1, def: 0, size: 26, fmt: (x) => Math.round(x * 100) + "%", after: syncAudio }), "REV"));
          kn.appendChild(labeled(pknob(m, "dly", { label: m.name + " delay send", min: 0, max: 1, def: 0, size: 26, fmt: (x) => Math.round(x * 100) + "%", after: syncAudio }), "DLY"));
        }
        s.querySelector(".fl-mled").onclick = (e) => { e.stopPropagation(); edit(() => { m.mute = !m.mute; }); syncAudio(); e.currentTarget.classList.toggle("fl-lit", !m.mute); e.currentTarget.setAttribute("aria-pressed", String(m.mute)); };
        s.querySelector(".fl-st-top").onclick = () => { if (ui.mxSel === i) return; ui.mxSel = i; renderMixer(); };
        s.querySelector(".fl-st-name").ondblclick = () => { if (!i) return; promptBox("Rename insert", "Name", m.name).then((n) => { if (n) { edit(() => { m.name = n.slice(0, 24); }); renderMixer(); } }); };
        const bars = s.querySelectorAll(".fl-st-meter b"); mxMeters[i] = [bars[0], bars[1]];
        inner.appendChild(s);
      });
      v.append(head, strips);
    }
    const meterH = (x) => clamp((20 * Math.log10(Math.max(x, 1e-6)) + 54) / 60, 0, 1); // -54 dB .. +6 dB
    function readMeter(m) {
      const pk = m.read();
      for (let c = 0; c < 2; c++) { m.lvl[c] = Math.max(pk[c], m.lvl[c] * 0.86); }
      return m.lvl;
    }
    function drawMeters() {
      if (!E) return;
      const lv = readMeter(E.meter), mm = root.querySelectorAll(".fl-mini-meter b");
      mm[0].style.transform = `scaleX(${meterH(lv[0]).toFixed(3)})`; mm[1].style.transform = `scaleX(${meterH(lv[1]).toFixed(3)})`;
      root.classList.toggle("fl-clip-warn", lv[0] > 0.99 || lv[1] > 0.99);
      if (ui.view !== "mixer") return;
      for (let i = 0; i < mxMeters.length; i++) {
        const els = mxMeters[i]; if (!els) continue;
        const m = i === 0 ? E.meter : E.inserts[i] && E.inserts[i].meter; if (!m) continue;
        const l = i === 0 ? lv : readMeter(m);
        els[0].style.height = ((1 - meterH(l[0])) * 100).toFixed(1) + "%"; els[1].style.height = ((1 - meterH(l[1])) * 100).toFixed(1) + "%";
      }
    }

    // =================================================================
    //  Browser
    // =================================================================
    let auditionEl = null, auditionName = "";
    function renderBrowser() {
      // The header + search box are built once: re-creating the focused input on each keystroke
      // would dismiss the on-screen keyboard on iPad. Only the list below re-renders.
      let list = browserEl.querySelector(".fl-br-list");
      if (!list) {
        browserEl.innerHTML = `<div class="fl-br-head"><span class="fl-vtitle">${ic("browser", 16)}<span>Browser</span></span><span class="fl-grow"></span><button class="fl-ibtn fl-br-x" aria-label="Close browser">${ic("x", 16)}</button></div>
          <label class="fl-br-search">${ic("search", 14)}<input type="search" placeholder="Search sounds" aria-label="Search sounds" autocomplete="off"></label>
          <div class="fl-br-list" role="tree"></div>`;
        const inp = browserEl.querySelector("input"); inp.value = ui.q || "";
        inp.addEventListener("input", () => { ui.q = inp.value; renderBrowser(); });
        inp.addEventListener("keydown", (e) => e.stopPropagation());
        browserEl.querySelector(".fl-br-x").onclick = () => toggleBrowser(false);
        list = browserEl.querySelector(".fl-br-list");
      }
      const q = (ui.q || "").trim().toLowerCase(), keepScroll = list.scrollTop;
      list.innerHTML = "";
      const groups = BROWSER.map((g) => ({ id: g.id, name: g.name, icon: g.icon, items: g.items.map((it) => Object.assign({ kind: "sound" }, it)) }));
      groups.push({ id: "projects", name: "Projects", icon: "folder", items: [{ kind: "demo", name: "Sunset Drive (demo)" }, { kind: "empty", name: "Empty project" }].concat(listFiles(DIR_PROJ, /\.flp$/i).map((f) => ({ kind: "flp", name: f.name, node: f.node }))) });
      groups.push({ id: "exports", name: "Rendered audio", icon: "folder", items: listFiles(DIR_EXP, /\.wav$/i).map((f) => ({ kind: "wav", name: f.name, node: f.node })) });
      groups.forEach((g) => {
        const items = q ? g.items.filter((it) => it.name.toLowerCase().indexOf(q) >= 0) : g.items;
        if (q && !items.length) return;
        const open = q ? true : !!ui.open[g.id];
        const ge = el(`<div class="fl-br-g"><button class="fl-br-gh" aria-expanded="${open}">${ic(open ? "chev" : "chevR", 14)}${ic(g.icon, 15)}<span>${esc(g.name)}</span><small>${g.items.length}</small></button><div class="fl-br-items"${open ? "" : " hidden"}></div></div>`);
        ge.querySelector(".fl-br-gh").onclick = () => { ui.open[g.id] = !open; renderBrowser(); persistUiSoon(); };
        const box = ge.querySelector(".fl-br-items");
        if (!items.length) box.appendChild(el(`<div class="fl-br-empty">${g.id === "exports" ? "Exported WAV files appear here." : "Nothing here yet."}</div>`));
        items.forEach((it) => {
          const sound = it.kind === "sound";
          const row = el(`<div class="fl-br-it${sound ? " fl-snd" : ""}${it.kind === "wav" && auditionName === it.name ? " fl-lit" : ""}" role="treeitem" tabindex="0" title="${sound ? "Tap to preview · drag onto the Channel rack or tap + to add" : it.kind === "wav" ? "Tap to play / stop" : "Tap to open"}"><span class="fl-br-ic">${ic(sound ? (it.type === "synth" ? "wave" : "drum") : it.kind === "wav" ? "audio" : "project", 15)}</span><span class="fl-br-n">${esc(it.name)}</span>${sound ? `<button class="fl-br-add" aria-label="Add ${esc(it.name)} to the Channel rack">${ic("plus", 16)}</button>` : ""}</div>`);
          if (sound) {
            row.querySelector(".fl-br-add").onclick = (e) => { e.stopPropagation(); addChannelFromItem(it); };
            row.addEventListener("pointerdown", (e) => {
              if (e.button || e.target.closest(".fl-br-add")) return;
              let ghost = null, moved = false;
              setOp(e, {
                move(ev) {
                  const dx = ev.clientX - e.clientX, dy = ev.clientY - e.clientY;
                  if (!ghost) {
                    if (Math.hypot(dx, dy) < 10) return; moved = true;
                    if (e.pointerType !== "mouse" && Math.abs(dy) > Math.abs(dx)) return;
                    ghost = el(`<div class="fl-ghost">${ic(it.type === "synth" ? "wave" : "drum", 14)}<span>${esc(it.name)}</span></div>`); root.appendChild(ghost);
                    if (isNarrow()) toggleBrowser(false, true);
                    if (ui.view !== "rack") setView("rack");
                  }
                  const r = root.getBoundingClientRect(); ghost.style.transform = `translate(${ev.clientX - r.left + 10}px,${ev.clientY - r.top + 8}px)`;
                  const over = overRack(ev); ghost.classList.toggle("fl-ok", over); views.rack.classList.toggle("fl-drop", over);
                },
                up(ev) {
                  views.rack.classList.remove("fl-drop");
                  if (ghost) { ghost.remove(); if (ev && overRack(ev)) addChannelFromItem(it); return; }
                  if (!moved && ev) previewItem(it);
                },
                cancel() { if (ghost) ghost.remove(); views.rack.classList.remove("fl-drop"); },
              });
            });
            row.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); addChannelFromItem(it); } else if (e.key === " ") { e.preventDefault(); e.stopPropagation(); previewItem(it); } });
          } else {
            const act = () => {
              if (it.kind === "wav") return audition(it);
              const go = () => { if (it.kind === "demo") loadProject(demoProject(), null, "Demo loaded"); else if (it.kind === "empty") loadProject(emptyProject(), null, "New project"); else openProjectNode(it.name, it.node); };
              if (dirty) confirmBox("Open project", `Open “${it.name}”? Unsaved changes to “${proj.name}” will be lost.`, "Open").then((ok) => { if (ok) go(); }); else go();
            };
            row.onclick = act; row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); act(); } });
          }
          box.appendChild(row);
        });
        list.appendChild(ge);
      });
      list.scrollTop = keepScroll;
    }
    function overRack(ev) { const t = document.elementFromPoint(ev.clientX, ev.clientY); return !!(t && t.closest && t.closest('.fl-view[data-v="rack"]') && root.contains(t)); }
    async function audition(it) {
      if (auditionEl && auditionName === it.name) { stopAudition(); renderBrowser(); return; }
      stopAudition();
      let blob = null; try { if (it.node.blob && window.VFS) blob = await VFS.getBlob(it.node.blob); } catch (e) {}
      if (!blob) { hint("Rendered audio", "This file's audio isn't on this device."); return; }
      const a = new Audio(); a.src = URL.createObjectURL(blob); a.volume = clamp(sysVolume(), 0, 1); auditionEl = a; auditionName = it.name;
      a.onended = () => { stopAudition(); renderBrowser(); };
      try { await a.play(); } catch (e) { stopAudition(); }
      renderBrowser(); hint("Playing", it.name);
    }
    function stopAudition() { if (!auditionEl) return; try { auditionEl.pause(); URL.revokeObjectURL(auditionEl.src); } catch (e) {} auditionEl = null; auditionName = ""; }
    function addChannelFromItem(it) {
      if (proj.channels.length >= 64) { hint("Channel rack", "The rack is full (64 channels)."); return; }
      let ch;
      edit(() => {
        ch = mkChannel(it.name, it.type, it.type === "synth" ? synthPreset(it.preset) : it.params, { root: it.root || 60 });
        const used = {}; proj.channels.forEach((c) => { used[c.insert] = 1; });
        let ins = proj.mixer.findIndex((m, i) => i > 0 && !used[i]);
        if (ins < 0) { proj.mixer.push(mkInsert(it.name)); ins = proj.mixer.length - 1; }
        else if (/^Insert \d+$/.test(proj.mixer[ins].name)) proj.mixer[ins].name = it.name.slice(0, 24);
        ch.insert = ins; proj.channels.push(ch); ui.selCh = ch.id;
      });
      syncAudio(); stale.mixer = stale.piano = stale.playlist = 1;
      if (isNarrow() && ui.brOverlay) toggleBrowser(false, true);
      if (ui.view !== "rack") setView("rack"); else renderRack();
      const row = views.rack.querySelector(`.fl-rrow[data-ch="${ch.id}"]`); if (row) { row.scrollIntoView({ block: "nearest" }); row.classList.add("fl-flash"); setTimeout(() => row.classList.remove("fl-flash"), 900); }
      hint("Channel added", it.name + " → insert " + ch.insert);
    }

    // =================================================================
    //  Menus & dialogs (in-app, touch friendly)
    // =================================================================
    let menuEl = null, menuAnchor = null, skipAnchor = null, modalEl = null;
    function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } if (menuAnchor) menuAnchor.classList.remove("fl-open"); menuAnchor = null; }
    function menu(anchor, items) {
      if (skipAnchor === anchor) { skipAnchor = null; return; }
      closeMenu();
      const m = el(`<div class="fl-menu" role="menu"></div>`);
      items.forEach((it) => {
        if (!it) return;
        if (it.sep) { m.appendChild(el(`<div class="fl-menu-sep" role="separator"></div>`)); return; }
        if (it.head) { m.appendChild(el(`<div class="fl-menu-h">${esc(it.head)}</div>`)); return; }
        const b = el(`<button class="fl-menu-it" role="menuitem"${it.disabled ? " disabled" : ""}><span class="fl-menu-ic">${it.checked != null ? (it.checked ? ic("check", 15) : "") : it.sw ? `<i class="fl-sw" style="background:${it.sw}"></i>` : it.icon ? ic(it.icon, 15) : ""}</span><span class="fl-menu-l">${esc(it.label)}</span>${it.key ? `<small>${esc(it.key)}</small>` : ""}</button>`);
        b.onclick = (e) => { e.stopPropagation(); closeMenu(); if (it.act) it.act(); };
        m.appendChild(b);
      });
      layer.appendChild(m); menuEl = m; menuAnchor = anchor; anchor.classList.add("fl-open");
      const ar = anchor.getBoundingClientRect(), rr = layer.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
      let x = ar.left - rr.left, y = ar.bottom - rr.top + 2;
      if (x + mw > rr.width - 4) x = Math.max(4, rr.width - mw - 4);
      if (y + mh > rr.height - 4) { const up = ar.top - rr.top - mh - 2; y = up >= 4 ? up : Math.max(4, rr.height - mh - 4); }
      m.style.left = x + "px"; m.style.top = y + "px";
      m.addEventListener("keydown", (e) => {
        e.stopPropagation();
        const its = [...m.querySelectorAll(".fl-menu-it:not([disabled])")], i = its.indexOf(document.activeElement);
        if (e.key === "Escape") { e.preventDefault(); closeMenu(); try { anchor.focus(); } catch (er) {} }
        else if (e.key === "ArrowDown") { e.preventDefault(); (its[i + 1] || its[0]).focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); (its[i - 1] || its[its.length - 1]).focus(); }
      });
      if (!coarse) { const f = m.querySelector(".fl-menu-it:not([disabled])"); if (f) f.focus({ preventScroll: true }); }
    }
    const onDocDown = (e) => { if (menuEl && !menuEl.contains(e.target)) { const a = menuAnchor; closeMenu(); if (a && a.contains(e.target)) skipAnchor = a; } };
    document.addEventListener("pointerdown", onDocDown, true);

    function modal(title, content, buttons, opts) {
      opts = opts || {};
      return new Promise((resolve) => {
        closeMenu(); if (modalEl && modalEl.__finish) modalEl.__finish(null);
        const mask = el(`<div class="fl-mask"><div class="fl-dlg${opts.wide ? " fl-wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="fl-dlg-h"><b>${esc(title)}</b><button class="fl-ibtn fl-dlg-x" aria-label="Close">${ic("x", 16)}</button></div><div class="fl-dlg-b"></div><div class="fl-dlg-f"></div></div></div>`);
        const bd = mask.querySelector(".fl-dlg-b"), foot = mask.querySelector(".fl-dlg-f");
        if (typeof content === "string") bd.innerHTML = content; else if (content) bd.appendChild(content);
        let done = false;
        const finish = (v) => { if (done) return; done = true; mask.remove(); if (modalEl === mask) modalEl = null; if (opts.onClose) opts.onClose(v); resolve(v); };
        (buttons || []).forEach((b) => {
          const btn = el(`<button class="fl-btn${b.primary ? " fl-primary" : ""}${b.danger ? " fl-danger" : ""}">${b.icon ? ic(b.icon, 15) : ""}<span>${esc(b.t)}</span></button>`);
          btn.onclick = () => { const v = typeof b.v === "function" ? b.v(bd) : b.v; if (v === undefined && b.keep) return; finish(v); };
          foot.appendChild(btn);
        });
        if (!foot.childNodes.length) foot.remove();
        mask.querySelector(".fl-dlg-x").onclick = () => finish(null);
        mask.addEventListener("pointerdown", (e) => { if (e.target === mask && !opts.sticky) finish(null); });
        mask.addEventListener("keydown", (e) => {
          e.stopPropagation();
          if (e.key === "Escape") { e.preventDefault(); finish(null); }
          else if (e.key === "Enter" && opts.enter && e.target.tagName === "INPUT") { e.preventDefault(); const pb = foot.querySelector(".fl-primary"); if (pb) pb.click(); }
        });
        mask.__finish = finish; layer.appendChild(mask); modalEl = mask;
        // Focus synchronously (still inside the tap) so iPad Safari shows its keyboard for prompts;
        // dialogs that are mostly knobs (channel settings) don't grab focus / pop the keyboard.
        const f = opts.noFocus ? mask.querySelector(".fl-dlg-x") : mask.querySelector("input:not([type=radio]):not([type=checkbox]):not([type=file]),.fl-primary");
        if (f) { try { f.focus({ preventScroll: true }); if (f.tagName === "INPUT" && f.select) f.select(); } catch (e) {} }
      });
    }
    const closeModal = () => { if (modalEl && modalEl.__finish) modalEl.__finish(null); };
    function confirmBox(title, text, ok) { return modal(title, `<p class="fl-p">${esc(text)}</p>`, [{ t: "Cancel", v: false }, { t: ok || "OK", primary: true, v: true }]).then((v) => !!v); }
    function promptBox(title, label, value) {
      const b = el(`<label class="fl-field fl-field-full"><span>${esc(label)}</span><input class="fl-input" maxlength="60" autocomplete="off"></label>`);
      b.querySelector("input").value = value || "";
      return modal(title, b, [{ t: "Cancel", v: null }, { t: "OK", primary: true, v: (bd) => bd.querySelector("input").value.trim() || null }], { enter: true });
    }

    // ---------- patterns ----------
    function selectPattern(i) {
      if (i < 0 || i >= proj.patterns.length) return;
      proj.cur = i; prScrolledFor = null; stale.rack = stale.piano = stale.playlist = 1;
      renderTop(); refresh(ui.view); persistUiSoon(); hint("Pattern", proj.patterns[i].name);
    }
    function afterPatterns() { stale.rack = stale.piano = stale.playlist = 1; renderTop(); refresh(ui.view); }
    function addPattern() {
      if (proj.patterns.length >= 99) return;
      edit(() => { let n = proj.patterns.length + 1; while (proj.patterns.some((p) => p.name === "Pattern " + n)) n++; proj.patterns.push(mkPattern("Pattern " + n, 16)); proj.cur = proj.patterns.length - 1; });
      afterPatterns(); hint("New pattern", curPat().name);
    }
    function clonePattern() {
      if (proj.patterns.length >= 99) return;
      const src = curPat(); edit(() => { const c = clone(src); c.id = uid(); c.name = (src.name + " copy").slice(0, 40); proj.patterns.splice(proj.cur + 1, 0, c); proj.cur++; });
      afterPatterns(); hint("Pattern cloned", curPat().name);
    }
    function renamePattern() { const p = curPat(); promptBox("Rename pattern", "Pattern name", p.name).then((n) => { if (!n) return; edit(() => { p.name = n.slice(0, 40); }); afterPatterns(); }); }
    function deletePattern() {
      if (proj.patterns.length < 2) { hint("Delete pattern", "A project needs at least one pattern."); return; }
      const p = curPat();
      confirmBox("Delete pattern", `Delete “${p.name}” and remove its clips from the playlist?`, "Delete").then((ok) => {
        if (!ok) return;
        edit(() => { proj.patterns.splice(proj.patterns.indexOf(p), 1); proj.playlist.clips = proj.playlist.clips.filter((c) => c.pid !== p.id); proj.cur = Math.min(proj.cur, proj.patterns.length - 1); });
        afterPatterns();
      });
    }
    function patternMenu(anchor) {
      menu(anchor, proj.patterns.map((p, i) => ({ label: p.name, sw: patColor(i), key: i === proj.cur ? "current" : p.len + " steps", act: () => selectPattern(i) })).concat([
        { sep: 1 }, { label: "New pattern", icon: "plus", act: addPattern }, { label: "Clone pattern", icon: "copy", act: clonePattern },
        { label: "Rename pattern…", icon: "pencil", act: renamePattern }, { label: "Delete pattern", icon: "trash", disabled: proj.patterns.length < 2, act: deletePattern },
      ]));
    }

    // ---------- channels ----------
    IC.up = '<path d="M12 19V5M6 11l6-6 6 6"/>'; IC.down = '<path d="M12 5v14M6 13l6 6 6-6"/>';
    function addChannelMenu(anchor) {
      const items = [];
      BROWSER.forEach((g) => { items.push({ head: g.name }); g.items.forEach((it) => items.push({ label: it.name, icon: it.type === "synth" ? "wave" : "drum", act: () => addChannelFromItem(it) })); });
      menu(anchor, items);
    }
    function channelMenu(ch, anchor) {
      selectChannel(ch.id);
      const i = proj.channels.indexOf(ch);
      menu(anchor, [
        { head: ch.name }, { label: "Piano roll", icon: "piano", act: () => setView("piano") }, { label: "Channel settings…", icon: "gear", act: () => channelSettings(ch) },
        { label: "Rename…", icon: "pencil", act: () => renameChannel(ch) }, { label: "Clone", icon: "copy", act: () => cloneChannel(ch) }, { sep: 1 },
        { label: "Move up", icon: "up", disabled: i <= 0, act: () => moveChannel(ch, -1) }, { label: "Move down", icon: "down", disabled: i >= proj.channels.length - 1, act: () => moveChannel(ch, 1) },
        { sep: 1 }, { label: "Delete", icon: "trash", act: () => deleteChannel(ch) },
      ]);
    }
    function renameChannel(ch) {
      promptBox("Rename channel", "Channel name", ch.name).then((n) => {
        if (!n) return;
        edit(() => { const m = proj.mixer[ch.insert]; if (m && ch.insert && m.name === ch.name) m.name = n.slice(0, 24); ch.name = n.slice(0, 40); });
        refresh("rack", "piano", "mixer");
      });
    }
    function cloneChannel(ch) {
      if (proj.channels.length >= 64) return;
      let c;
      edit(() => {
        c = clone(ch); c.id = uid(); c.name = (ch.name + " #2").slice(0, 40); c.solo = false;
        proj.channels.splice(proj.channels.indexOf(ch) + 1, 0, c);
        proj.patterns.forEach((p) => { if (p.steps[ch.id]) p.steps[c.id] = p.steps[ch.id].slice(); if (p.notes[ch.id]) p.notes[c.id] = clone(p.notes[ch.id]); });
        ui.selCh = c.id;
      });
      syncAudio(); stale.mixer = stale.piano = stale.playlist = 1; refresh("rack"); hint("Channel cloned", c.name);
    }
    function moveChannel(ch, d) {
      const i = proj.channels.indexOf(ch), j = i + d; if (j < 0 || j >= proj.channels.length) return;
      edit(() => { proj.channels.splice(i, 1); proj.channels.splice(j, 0, ch); });
      stale.playlist = stale.piano = 1; refresh("rack");
    }
    function deleteChannel(ch) {
      confirmBox("Delete channel", `Delete “${ch.name}” and all of its steps and notes?`, "Delete").then((ok) => {
        if (!ok) return;
        releaseAll();
        edit(() => {
          const i = proj.channels.indexOf(ch); if (i < 0) return;
          proj.channels.splice(i, 1);
          proj.patterns.forEach((p) => { delete p.steps[ch.id]; delete p.notes[ch.id]; });
          if (ui.selCh === ch.id) ui.selCh = (proj.channels[i] || proj.channels[i - 1] || {}).id || null;
        });
        syncAudio(); stale.mixer = stale.piano = stale.playlist = 1; refresh("rack"); hint("Channel deleted", ch.name);
      });
    }
    const fmtUnit = (q) => (x) => q.unit === "st" ? (x > 0 ? "+" : "") + Math.round(x) + " st" : q.unit === "s" ? (x < 1 ? Math.round(x * 1000) + " ms" : x.toFixed(2) + " s") : q.unit === "Hz" ? Math.round(x) + " Hz" : Math.round(x * 100) + "%";
    function channelSettings(ch) {
      selectChannel(ch.id);
      const def = INSTR[ch.type], synth = def.kind === "synth";
      const b = el(`<div class="fl-cs">
        <div class="fl-cs-row">
          <label class="fl-field"><span>Name</span><input class="fl-input fl-cs-name" maxlength="40" autocomplete="off"></label>
          <label class="fl-field"><span>Mixer track</span><select class="fl-select fl-cs-ins">${proj.mixer.map((m, i) => `<option value="${i}"${(ch.insert || 0) === i ? " selected" : ""}>${i ? i + " · " + esc(m.name) : "Master"}</option>`).join("")}</select></label>
          ${synth ? `<label class="fl-field"><span>Preset</span><select class="fl-select fl-cs-preset"><option value="">Custom</option>${Object.keys(SYNTHS).map((n) => `<option${ch.params.preset === n ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>` : ""}
          <button class="fl-btn fl-cs-pv" title="Hold to play">${ic("play", 14)}<span>Preview</span></button>
        </div>
        <div class="fl-cs-sec"><b>Channel</b><div class="fl-cs-knobs fl-cs-main"></div></div>
        <div class="fl-cs-inst"></div>
      </div>`);
      const nameIn = b.querySelector(".fl-cs-name"); nameIn.value = ch.name;
      nameIn.addEventListener("focus", beginEdit); nameIn.addEventListener("input", () => { ch.name = nameIn.value.slice(0, 40) || ch.name; });
      nameIn.addEventListener("blur", () => { if (!nameIn.value.trim()) nameIn.value = ch.name; endEdit(); });
      b.querySelector(".fl-cs-ins").onchange = (e) => { edit(() => { ch.insert = +e.target.value; }); syncAudio(); stale.mixer = 1; };
      const pv = b.querySelector(".fl-cs-pv");
      pv.addEventListener("pointerdown", (e) => { if (e.button) return; noteOn(ch, ch.root || 60, "cs"); });
      ["pointerup", "pointercancel", "pointerleave"].forEach((t) => pv.addEventListener(t, () => noteOff("cs", true)));
      const main = b.querySelector(".fl-cs-main");
      main.appendChild(labeled(pknob(ch, "vol", { label: "Volume", min: 0, max: 1, def: 0.78, size: 34, fmt: (x) => Math.round(x * 100) + "% (" + toDb(chanGain(x)) + ")", after: syncAudio }), "VOLUME"));
      main.appendChild(labeled(pknob(ch, "pan", { label: "Panning", min: -1, max: 1, def: 0, bipolar: true, size: 34, fmt: (x) => (Math.abs(x) < 0.01 ? "Centered" : Math.round(Math.abs(x) * 100) + "% " + (x < 0 ? "left" : "right")), after: syncAudio }), "PAN"));
      main.appendChild(labeled(pknob(ch, "root", { label: "Step note", min: 24, max: 96, def: 60, step: 1, size: 34, fmt: (x) => noteName(Math.round(x)) }), "STEP NOTE"));
      const inst = b.querySelector(".fl-cs-inst");
      const kn = (obj, key, label, o) => labeled(pknob(obj, key, Object.assign({ label, size: 34 }, o)), label.toUpperCase());
      function drumPanel() {
        inst.innerHTML = `<div class="fl-cs-sec"><b>${esc(def.name)} synthesis</b><div class="fl-cs-knobs"></div></div>`;
        const box = inst.querySelector(".fl-cs-knobs");
        def.params.forEach((q) => box.appendChild(kn(ch.params, q.k, q.label, { min: q.min, max: q.max, def: q.def, step: q.unit === "st" ? 1 : 0, log: q.unit === "Hz", bipolar: q.min < 0, fmt: fmtUnit(q) })));
      }
      function synthPanel() {
        const p = ch.params; if (!p.fm) p.fm = { ratio: 1, index: 0, decay: 0.6 };
        const custom = () => { if (p.preset) { delete p.preset; const s = b.querySelector(".fl-cs-preset"); if (s) s.value = ""; } };
        inst.innerHTML = `<div class="fl-cs-sec fl-osc-sec"><b>3x Osc</b><div class="fl-oscs"></div></div><div class="fl-cs-grid"><div class="fl-cs-sec"><b>Envelope</b><div class="fl-cs-knobs fl-env"></div></div><div class="fl-cs-sec"><b>Filter</b><div class="fl-cs-knobs fl-flt"></div></div><div class="fl-cs-sec"><b>FM &amp; output</b><div class="fl-cs-knobs fl-out"></div></div></div>`;
        const oscs = inst.querySelector(".fl-oscs");
        p.osc.forEach((o, i) => {
          const r = el(`<div class="fl-osc"><span class="fl-osc-n">OSC ${i + 1}</span><div class="fl-wavesel" role="radiogroup" aria-label="Oscillator ${i + 1} waveform">${WAVES.map((w) => `<button data-w="${w}" role="radio" aria-checked="${o.wave === w}" class="${o.wave === w ? "fl-lit" : ""}" title="${w === "sawtooth" ? "Saw" : w[0].toUpperCase() + w.slice(1)}" aria-label="${w}">${ic(w, 18)}</button>`).join("")}</div><div class="fl-cs-knobs"></div></div>`);
          r.querySelectorAll("[data-w]").forEach((btn) => { btn.onclick = () => { edit(() => { o.wave = btn.dataset.w; custom(); }); r.querySelectorAll("[data-w]").forEach((x) => { const on = x === btn; x.classList.toggle("fl-lit", on); x.setAttribute("aria-checked", String(on)); }); }; });
          const k = r.querySelector(".fl-cs-knobs");
          k.appendChild(kn(o, "vol", "Level", { min: 0, max: 1, def: 0.5, size: 30, fmt: (x) => Math.round(x * 100) + "%", after: custom }));
          k.appendChild(kn(o, "semi", "Coarse", { min: -24, max: 24, def: 0, step: 1, bipolar: true, size: 30, fmt: (x) => (x > 0 ? "+" : "") + x + " st", after: custom }));
          k.appendChild(kn(o, "det", "Fine", { min: -100, max: 100, def: 0, bipolar: true, size: 30, fmt: (x) => (x > 0 ? "+" : "") + Math.round(x) + " ct", after: custom }));
          k.appendChild(kn(o, "uni", "Unison", { min: 1, max: 7, def: 1, step: 1, size: 30, fmt: (x) => x + (x > 1 ? " voices" : " voice"), after: custom }));
          oscs.appendChild(r);
        });
        const sec = (x) => (x < 1 ? Math.round(x * 1000) + " ms" : x.toFixed(2) + " s");
        const env = inst.querySelector(".fl-env"), flt = inst.querySelector(".fl-flt"), out = inst.querySelector(".fl-out");
        env.appendChild(kn(p, "a", "Attack", { min: 0, max: 2, def: 0.004, fmt: sec, after: custom }));
        env.appendChild(kn(p, "d", "Decay", { min: 0.01, max: 3, def: 0.3, fmt: sec, after: custom }));
        env.appendChild(kn(p, "s", "Sustain", { min: 0, max: 1, def: 0.5, fmt: (x) => Math.round(x * 100) + "%", after: custom }));
        env.appendChild(kn(p, "r", "Release", { min: 0.01, max: 3, def: 0.2, fmt: sec, after: custom }));
        flt.appendChild(kn(p, "cutoff", "Cutoff", { min: 40, max: 18000, def: 1500, log: true, fmt: (x) => (x >= 1000 ? (x / 1000).toFixed(1) + " kHz" : Math.round(x) + " Hz"), after: custom }));
        flt.appendChild(kn(p, "res", "Reso", { min: 0.1, max: 20, def: 1, fmt: (x) => x.toFixed(1), after: custom }));
        flt.appendChild(kn(p, "fenv", "Env amt", { min: 0, max: 5, def: 2, fmt: (x) => "+" + x.toFixed(1) + " oct", after: custom }));
        flt.appendChild(kn(p, "fdec", "Env dec", { min: 0.01, max: 2, def: 0.3, fmt: sec, after: custom }));
        out.appendChild(kn(p.fm, "index", "FM amt", { min: 0, max: 6, def: 0, fmt: (x) => x.toFixed(2), after: custom }));
        out.appendChild(kn(p.fm, "ratio", "FM ratio", { min: 0.5, max: 8, def: 1, step: 0.5, fmt: (x) => x.toFixed(1) + " : 1", after: custom }));
        out.appendChild(kn(p, "gain", "Gain", { min: 0, max: 0.6, def: 0.25, fmt: (x) => Math.round((x / 0.6) * 100) + "%", after: custom }));
        out.appendChild(kn(p, "transpose", "Transpose", { min: -24, max: 24, def: 0, step: 1, bipolar: true, fmt: (x) => (x > 0 ? "+" : "") + x + " st", after: custom }));
      }
      if (synth) {
        b.querySelector(".fl-cs-preset").onchange = (e) => { const n = e.target.value; if (!n) return; edit(() => { ch.params = normPatch(synthPreset(n)); }); synthPanel(); hint("Preset", n); };
        synthPanel();
      } else drumPanel();
      modal("Channel settings - " + ch.name, b, [{ t: "Delete channel", danger: true, v: "delete", icon: "trash" }, { t: "Done", primary: true, v: true }], { wide: true, noFocus: true, onClose: () => { refresh("rack", "piano", "mixer"); } })
        .then((v) => { if (v === "delete") deleteChannel(ch); });
    }

    // =================================================================
    //  Projects: new / open / save (VFS: Documents › FL Studio › Projects)
    // =================================================================
    function askDiscard() { return dirty ? confirmBox("Unsaved changes", `Discard the unsaved changes to “${proj.name}”?`, "Discard") : Promise.resolve(true); }
    function openNodeGuarded(name, node) {
      if (closed) return Promise.resolve(false);
      return askDiscard().then((ok) => (ok && !closed ? openProjectNode(name, node) : false));
    }
    function loadProject(p, name, msg) {
      if (!p) return false;
      halt(); releaseAll(); closeMenu(); T.pos = 0;
      proj = p; fileName = name || null; dirty = false; undoStack.length = 0; redoStack.length = 0;
      ui.selCh = null; ui.mxSel = 1; prScrolledFor = null; ui._prScroll = null;
      if (E) E.setProject(proj);
      renderAll(); persist(); hint(msg || "Project opened", proj.name);
      return true;
    }
    async function nodeText(node) {
      if (typeof node.content === "string") return node.content;
      if (node.blob && window.VFS && VFS.getBlob) { try { const b = await VFS.getBlob(node.blob); if (b) return await b.text(); } catch (e) {} }
      return "";
    }
    async function openProjectNode(name, node) {
      let p = null; try { p = normalize(JSON.parse(await nodeText(node))); } catch (e) {}
      if (!p) { hint("Open project", "“" + name + "” isn't an FL Studio project."); return false; }
      if (/\.flp$/i.test(name) && !p.name) p.name = name.replace(/\.flp$/i, "");
      return loadProject(p, peekFolder(DIR_PROJ) && peekFolder(DIR_PROJ)[name] === node ? name : null, "Opened “" + name + "”");
    }
    function writeProject(name) {
      const kids = ensureFolder(DIR_PROJ);
      proj.name = name.replace(/\.flp$/i, "").slice(0, 80) || proj.name; // like FL, the project is named after its file
      const content = JSON.stringify({ format: "flstudio-web", version: 1, app: "FL Studio", saved: new Date().toISOString(), project: proj });
      const prev = kids[name];
      let size = content.length; try { size = new Blob([content]).size; } catch (e) {}
      kids[name] = { type: "file", kind: "text", mime: "application/json", size, ts: Date.now(), created: (prev && prev.created) || Date.now(), content };
      fileName = name; dirty = false; vfsChanged(); persist(); updateTitle(); renderBrowser();
      hint("Saved", "Documents › FL Studio › Projects › " + name);
      return DIR_PROJ.concat(name);
    }
    function saveProject() { return fileName ? Promise.resolve(writeProject(fileName)) : saveAs(); }
    function saveAs() {
      return promptBox("Save project as", "File name", proj.name).then((n) => {
        if (!n) return null;
        const base = safeFile(n.replace(/\.flp$/i, "")), name = base + ".flp", kids = ensureFolder(DIR_PROJ);
        const go = () => { proj.name = base; return writeProject(name); };
        if (kids[name] && name !== fileName) return confirmBox("Replace file", `“${name}” already exists. Replace it?`, "Replace").then((ok) => (ok ? go() : null));
        return go();
      });
    }
    function openDialog() {
      const files = listFiles(DIR_PROJ, /\.flp$/i);
      const b = el(`<div class="fl-open"><div class="fl-open-list" role="list"></div><div class="fl-open-more"><button class="fl-btn fl-open-demo">${ic("note", 15)}<span>Demo project</span></button><button class="fl-btn fl-open-dev">${ic("folder", 15)}<span>From this device…</span></button><input type="file" accept=".flp,.json,application/json" hidden></div></div>`);
      const list = b.querySelector(".fl-open-list");
      if (!files.length) list.appendChild(el(`<div class="fl-br-empty">No saved projects yet. Use File › Save to keep one here.</div>`));
      files.forEach((f) => {
        const r = el(`<button class="fl-open-it" role="listitem">${ic("project", 20)}<span class="fl-open-n"></span><small>${esc(new Date(f.node.ts || Date.now()).toLocaleString())}</small></button>`);
        r.querySelector(".fl-open-n").textContent = f.name;
        r.onclick = () => { closeModal(); askDiscard().then((ok) => { if (ok) openProjectNode(f.name, f.node); }); };
        list.appendChild(r);
      });
      b.querySelector(".fl-open-demo").onclick = () => { closeModal(); askDiscard().then((ok) => { if (ok) loadProject(demoProject(), null, "Demo loaded"); }); };
      const fi = b.querySelector("input[type=file]");
      b.querySelector(".fl-open-dev").onclick = () => fi.click();
      fi.onchange = async () => {
        const f = fi.files && fi.files[0]; if (!f) return;
        let p = null; try { p = normalize(JSON.parse(await f.text())); } catch (e) {}
        closeModal();
        if (!p) { hint("Open project", "“" + f.name + "” isn't an FL Studio project."); return; }
        const ok = await askDiscard(); if (!ok) return;
        if (!p.name || p.name === "Untitled") p.name = f.name.replace(/\.(flp|json)$/i, "");
        loadProject(p, null, "Imported “" + f.name + "”");
      };
      return modal("Open project", b, [{ t: "Cancel", v: null }]);
    }

    // =================================================================
    //  Export WAV (OfflineAudioContext -> 16-bit PCM)
    // =================================================================
    let exporting = false;
    async function doExport(o) {
      o = o || {};
      if (exporting) throw new Error("An export is already running.");
      exporting = true;
      try {
        const mode = o.mode === "song" || o.mode === "pat" ? o.mode : proj.mode;
        const snap = normalize(clone(proj));
        if (mode === "song" && !snap.playlist.clips.length) throw new Error("The playlist is empty — place some patterns first, or export the pattern.");
        const r = await renderOffline(snap, mode, snap.cur);
        const st = bufStats(r.buf, r.frames), blob = encodeWav(r.buf, r.frames), dur = r.frames / r.buf.sampleRate;
        const base = safeFile(snap.name) + (mode === "song" ? "" : " - " + safeFile(snap.patterns[snap.cur].name));
        const kids = ensureFolder(DIR_EXP), name = uniqueName(kids, base + ".wav");
        let id = null; try { if (window.VFS && VFS.putBlob) id = await VFS.putBlob(blob); } catch (e) {}
        if (id) { kids[name] = { type: "file", kind: "audio", mime: "audio/wav", size: blob.size, ts: Date.now(), blob: id, duration: dur }; vfsChanged(); }
        if (o.download) downloadBlob(blob, name);
        if (!closed) { renderBrowser(); hint("Export complete", name); }
        if (o.notify !== false) notify("Export complete", name + (id ? " was saved to Documents › FL Studio › Exports." : " is ready."), () => openFolder(DIR_EXP));
        return { name, path: id ? DIR_EXP.concat(name) : null, saved: !!id, size: blob.size, rms: st.rms, peak: st.peak, duration: dur, mode, voices: r.voices, sampleRate: r.buf.sampleRate, blob };
      } finally { exporting = false; }
    }
    function exportDialog() {
      const pat = curPat(), sd = stepDur(proj), songSteps = songLenSteps(proj), bars = Math.ceil(songSteps / 16), hasSong = proj.playlist.clips.length > 0;
      const b = el(`<div class="fl-exp">
        <p class="fl-p">Render to a 16-bit, 44.1 kHz stereo WAV file in <b>Documents › FL Studio › Exports</b>.</p>
        <div class="fl-radio" role="radiogroup" aria-label="What to export">
          <label><input type="radio" name="flexp" value="pat"${proj.mode === "pat" || !hasSong ? " checked" : ""}><span><b>Pattern</b> — ${esc(pat.name)} · ${patBars(pat)} bar${patBars(pat) > 1 ? "s" : ""} · ${fmtDur(pat.len * sd)}</span></label>
          <label><input type="radio" name="flexp" value="song"${proj.mode === "song" && hasSong ? " checked" : ""}${hasSong ? "" : " disabled"}><span><b>Song</b> — playlist arrangement · ${bars} bar${bars > 1 ? "s" : ""} · ${fmtDur(songSteps * sd)}</span></label>
        </div>
        <label class="fl-check"><input type="checkbox" class="fl-exp-dl" checked><span>Also download the file to this device</span></label>
        <div class="fl-exp-st" hidden><div class="fl-prog"><i></i></div><span class="fl-exp-msg">Rendering…</span></div>
        <div class="fl-exp-done" hidden></div>
        <div class="fl-exp-actions"><button class="fl-btn fl-exp-cancel">Cancel</button><button class="fl-btn fl-primary fl-exp-go">${ic("download", 15)}<span>Start</span></button></div>
      </div>`);
      const go = b.querySelector(".fl-exp-go"), stEl = b.querySelector(".fl-exp-st"), doneEl = b.querySelector(".fl-exp-done"), acts = b.querySelector(".fl-exp-actions");
      let url = null;
      b.querySelector(".fl-exp-cancel").onclick = () => closeModal();
      go.onclick = async () => {
        const mode = (b.querySelector("input[name=flexp]:checked") || {}).value || "pat", dl = b.querySelector(".fl-exp-dl").checked;
        go.disabled = true; b.querySelectorAll("input").forEach((x) => { x.disabled = true; }); stEl.hidden = false;
        try {
          const r = await doExport({ mode, download: dl });
          stEl.hidden = true; acts.hidden = true; doneEl.hidden = false;
          url = URL.createObjectURL(r.blob);
          doneEl.innerHTML = `<div class="fl-exp-file">${ic("audio", 28)}<div><b></b><small>${fmtSize(r.size)} · ${fmtDur(r.duration)} · peak ${toDb(r.peak)}</small></div></div><audio controls preload="auto"></audio><div class="fl-exp-actions"><button class="fl-btn fl-exp-dl2">${ic("download", 15)}<span>Download</span></button>${navigator.share ? `<button class="fl-btn fl-exp-share">${ic("share", 15)}<span>Share</span></button>` : ""}<button class="fl-btn fl-exp-folder">${ic("folder", 15)}<span>Show in folder</span></button><button class="fl-btn fl-primary fl-exp-close">Done</button></div>`;
          doneEl.querySelector("b").textContent = r.name;
          const au = doneEl.querySelector("audio"); au.src = url; au.volume = clamp(sysVolume(), 0, 1);
          doneEl.querySelector(".fl-exp-dl2").onclick = () => downloadBlob(r.blob, r.name);
          const sh = doneEl.querySelector(".fl-exp-share");
          if (sh) sh.onclick = async () => { try { const file = new File([r.blob], r.name, { type: "audio/wav" }); if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: r.name }); else await navigator.share({ title: r.name, text: r.name }); } catch (e) {} };
          doneEl.querySelector(".fl-exp-folder").onclick = () => { closeModal(); openFolder(DIR_EXP); };
          doneEl.querySelector(".fl-exp-close").onclick = () => closeModal();
        } catch (e) {
          stEl.querySelector(".fl-exp-msg").textContent = "Export failed: " + (e && e.message ? e.message : e);
          stEl.querySelector(".fl-prog").hidden = true; go.disabled = false; b.querySelectorAll("input").forEach((x) => { x.disabled = false; });
        }
      };
      return modal("Export WAV", b, [], { sticky: true, onClose: () => { if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); } });
    }

    // =================================================================
    //  Top-bar menus
    // =================================================================
    function showMenu(which, anchor) {
      if (which === "file") menu(anchor, [
        { label: "New", icon: "project", act: () => askDiscard().then((ok) => { if (ok) loadProject(emptyProject(), null, "New project"); }) },
        { label: "Open demo project", icon: "note", act: () => askDiscard().then((ok) => { if (ok) loadProject(demoProject(), null, "Demo loaded"); }) },
        { label: "Open…", icon: "folder", key: "Ctrl+O", act: openDialog }, { sep: 1 },
        { label: "Save", icon: "save", key: "Ctrl+S", act: saveProject }, { label: "Save as…", icon: "save", key: "Ctrl+Shift+S", act: saveAs }, { sep: 1 },
        { label: "Export WAV file…", icon: "download", key: "Ctrl+R", act: exportDialog },
        { label: "Show projects folder", icon: "folder", act: () => { ensureFolder(DIR_PROJ); openFolder(DIR_PROJ); } }, { sep: 1 },
        { label: "Exit", icon: "x", act: () => ref.close() },
      ]);
      else if (which === "edit") menu(anchor, [
        { label: "Undo", icon: "undo", key: "Ctrl+Z", disabled: !undoStack.length, act: doUndo }, { label: "Redo", icon: "redo", key: "Ctrl+Y", disabled: !redoStack.length, act: doRedo }, { sep: 1 },
        { label: "New pattern", icon: "plus", act: addPattern }, { label: "Clone pattern", icon: "copy", act: clonePattern }, { label: "Rename pattern…", icon: "pencil", act: renamePattern },
        { label: "Clear pattern", icon: "trash", act: () => { const p = curPat(); confirmBox("Clear pattern", `Remove every step and note from “${p.name}”?`, "Clear").then((ok) => { if (ok) { edit(() => { p.steps = {}; p.notes = {}; }); afterPatterns(); } }); } },
        { sep: 1 }, { label: "Channel settings…", icon: "gear", disabled: !chById(ui.selCh), act: () => { const c = chById(ui.selCh); if (c) channelSettings(c); } },
      ]);
      else if (which === "options") menu(anchor, [
        { label: "Metronome", checked: !!proj.metronome, act: toggleMetro }, { label: "Record (arm)", checked: ui.rec, act: toggleRec },
        { label: "Typing keyboard to piano", checked: ui.typing, act: () => { ui.typing = !ui.typing; persistUiSoon(); hint("Typing keyboard", ui.typing ? "On — Z S X D C… play notes on the selected channel" : "Off"); } },
        { sep: 1 }, { label: "Pattern mode", checked: proj.mode === "pat", act: () => setMode("pat") }, { label: "Song mode", checked: proj.mode === "song", act: () => setMode("song") },
        { sep: 1 }, { label: "Tempo…", icon: "metro", act: () => promptBox("Tempo", "Beats per minute (60–200)", String(proj.bpm)).then((v) => { if (v && isFinite(+v)) edit(() => setBpm(+v)); }) },
      ]);
      else if (which === "help") menu(anchor, [
        { label: "Keyboard shortcuts", icon: "keyboard", act: showShortcuts }, { label: "About FL Studio", icon: "note", act: showAbout },
      ]);
    }
    function showShortcuts() {
      const rows = [["Space", "Play / stop"], ["F5", "Playlist"], ["F6", "Channel rack"], ["F7", "Piano roll"], ["F8", "Browser"], ["F9", "Mixer"], ["Ctrl+S", "Save project"], ["Ctrl+Shift+S", "Save as"], ["Ctrl+O", "Open project"], ["Ctrl+R", "Export WAV"], ["Ctrl+Z / Ctrl+Y", "Undo / redo"], ["Z S X D C V…", "Play notes (typing keyboard)"], ["Q 2 W 3 E…", "Play notes, one octave up"]];
      modal("Keyboard shortcuts", `<div class="fl-keys-list">${rows.map((r) => `<kbd>${esc(r[0])}</kbd><span>${esc(r[1])}</span>`).join("")}</div><p class="fl-p fl-dim">Every command is also on the toolbar and menus, so it all works by touch on an iPad.</p>`, [{ t: "Close", primary: true, v: true }]);
    }
    function showAbout() {
      modal("About FL Studio", `<div class="fl-about">${FRUIT.replace('width="22" height="22"', 'width="64" height="64"')}<div><b>FL Studio</b><p class="fl-p">Image-Line · Producer Edition 21 for Windows 12</p><p class="fl-p fl-dim">Every sound is synthesised live by your browser's Web Audio engine: drums, “3x Osc” synths, mixer effects and WAV export.</p></div></div>`, [{ t: "OK", primary: true, v: true }]);
    }
    function toggleMetro() { proj.metronome = !proj.metronome; changed(); renderTransport(); hint("Metronome", proj.metronome ? "On" : "Off"); }
    function toggleRec() { ui.rec = !ui.rec; renderTransport(); hint("Record", ui.rec ? "Armed — press Play, then tap piano keys / channel buttons or use the typing keyboard" : "Off"); }

    // ---------- toolbar wiring ----------
    root.querySelectorAll("[data-menu]").forEach((b) => { b.onclick = () => showMenu(b.dataset.menu, b); });
    root.querySelectorAll(".fl-mode button").forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
    $(".fl-play").onclick = () => togglePlay();
    $(".fl-stop").onclick = () => stop();
    $(".fl-rec").onclick = () => toggleRec();
    $(".fl-metro").onclick = () => toggleMetro();
    $(".fl-pat-btn").onclick = (e) => patternMenu(e.currentTarget);
    $(".fl-pat-add").onclick = () => addPattern();
    root.querySelectorAll(".fl-views [data-view]").forEach((b) => { b.onclick = () => setView(b.dataset.view); });
    $(".fl-br-toggle").onclick = () => toggleBrowser();
    // Tapping the workspace closes the Browser drawer on narrow screens (the tap only closes it).
    $(".fl-work").addEventListener("pointerdown", (e) => { if (ui.brOverlay && isNarrow()) { e.stopPropagation(); e.preventDefault(); toggleBrowser(false, true); } }, true);
    const cpuV = $(".fl-cpu-v"), cpuBar = $(".fl-cpu-bar i"), polyV = $(".fl-poly-v");

    // =================================================================
    //  Views, layout
    // =================================================================
    const renderers = { rack: renderRack, piano: renderPiano, playlist: renderPlaylist, mixer: renderMixer };
    function refresh() { for (const n of arguments) { if (n === "top") renderTop(); else if (n === "browser") renderBrowser(); else if (renderers[n]) { if (n === ui.view) renderers[n](); else stale[n] = 1; } } }
    function renderAll() { VIEWS.forEach((v) => { stale[v] = 1; }); VIEWS.forEach((v) => views[v].classList.toggle("fl-on", v === ui.view)); renderTop(); renderers[ui.view](); renderBrowser(); }
    function setView(v) {
      if (VIEWS.indexOf(v) < 0) return;
      const changedView = ui.view !== v; ui.view = v;
      VIEWS.forEach((x) => views[x].classList.toggle("fl-on", x === v));
      if (stale[v] || !views[v].firstChild) renderers[v](); else if (v === "rack") checkRackScroll();
      if (isNarrow() && ui.brOverlay) { ui.brOverlay = false; applyBrowser(); }
      renderTop(); updatePlayheads(); if (changedView) { persistUiSoon(); hint(VIEW_NAMES[v], ""); }
    }
    const isNarrow = () => root.clientWidth > 0 && root.clientWidth < 900;
    function applyBrowser() {
      const n = isNarrow();
      root.classList.toggle("fl-br-docked", !n && ui.browser); root.classList.toggle("fl-br-overlay", n && ui.brOverlay);
      const on = n ? ui.brOverlay : ui.browser; const t = $(".fl-br-toggle"); t.classList.toggle("fl-lit", on); t.setAttribute("aria-pressed", String(on));
    }
    function toggleBrowser(on, quiet) {
      if (isNarrow()) ui.brOverlay = on == null ? !ui.brOverlay : !!on; else ui.browser = on == null ? !ui.browser : !!on;
      applyBrowser(); if (!quiet) persistUiSoon();
      if (ui.view === "piano") { clearTimeout(rzTimer); rzTimer = setTimeout(() => { if (!closed && ui.view === "piano") renderPiano(); }, 60); }
    }
    let rzTimer = 0, lastW = 0;
    const ro = new ResizeObserver(() => {
      const w = root.clientWidth; if (!w) return;
      root.classList.toggle("fl-narrow", w < 900); root.classList.toggle("fl-xnarrow", w < 720);
      if (w >= 900) ui.brOverlay = false;
      applyBrowser();
      // the work area (minus a docked Browser) decides the compact touch rack layout
      const ww = workEl.clientWidth; if (ww) root.classList.toggle("fl-wnarrow", ww < 900);
      if (lastW && Math.abs(w - lastW) > 24 && ui.view === "piano") { clearTimeout(rzTimer); rzTimer = setTimeout(() => { if (!closed && ui.view === "piano") renderPiano(); }, 120); }
      lastW = w;
      checkRackScroll(); fitCheck();
    });
    const workEl = $(".fl-work");
    ro.observe(root); ro.observe(workEl);

    // Keep the window usable on a tablet: re-maximize when a rotation / resize leaves it bigger than the
    // screen (its controls would be off-screen), and keep FL's bottom row clear of a floating taskbar
    // that overlaps a maximized window (the WM leaves 48 px for it; the floating one is taller).
    let safeB = -1;
    const floating = () => !win.classList.contains("maximized") && !win.classList.contains("wx-snapped");
    function shrinkToScreen() { // a restored window that is bigger than the screen (e.g. restored after rotating to portrait)
      const r = win.getBoundingClientRect(), availH = innerHeight - taskbarHeight();
      if (r.width <= innerWidth && r.height <= availH) return false;
      const w = Math.max(320, Math.min(r.width, innerWidth - 16)), h = Math.max(300, Math.min(r.height, availH - 16));
      Object.assign(win.style, { width: w + "px", height: h + "px", left: Math.max(0, Math.round((innerWidth - w) / 2)) + "px", top: Math.max(0, Math.min(r.top, availH - h)) + "px" });
      return true;
    }
    function fitCheck() {
      if (closed || !win.isConnected || win.style.display === "none") return;
      if (floating()) shrinkToScreen();
      let b = 0;
      if (win.classList.contains("maximized")) {
        const t = taskbarEl();
        if (t) { const tr = t.getBoundingClientRect(), wr = root.getBoundingClientRect(); if (tr.top > wr.top + 100) b = clamp(Math.round(wr.bottom - tr.top), 0, 100); }
      }
      if (b !== safeB) { safeB = b; root.style.setProperty("--fl-safe-b", b + "px"); }
    }
    let fitTimer = 0;
    const onResize = () => { // rotation / split view: never leave the window (and its controls) off-screen
      clearTimeout(fitTimer);
      fitTimer = setTimeout(() => {
        if (closed || !win.isConnected || win.style.display === "none") return;
        if (floating()) {
          const r = win.getBoundingClientRect();
          if (r.width > innerWidth || r.height > innerHeight - taskbarHeight()) { if (coarse) maximize(); else shrinkToScreen(); }
          else if (r.right > innerWidth || r.bottom > innerHeight) win.style.left = Math.max(0, Math.min(r.left, innerWidth - r.width)) + "px", win.style.top = Math.max(0, Math.min(r.top, innerHeight - taskbarHeight() - r.height)) + "px";
        }
        fitCheck(); checkRackScroll();
      }, 120);
    };
    window.addEventListener("resize", onResize);

    // =================================================================
    //  Animation / housekeeping loop
    // =================================================================
    let raf = 0, lastSlow = 0, meterIdle = 0, idleSince = performance.now();
    function frame() {
      if (closed) return;
      raf = requestAnimationFrame(frame);
      const t0 = performance.now();
      if (T.playing) updatePlayheads(); else if (ui._step !== -1) { ui._step = -1; rackStep(-1); }
      if (E && E.meter && E.ctx.state === "running") { const busy = T.playing || E.voices.length > 0; if (busy) meterIdle = 0; if (busy || meterIdle++ < 90) drawMeters(); }
      if (t0 - lastSlow > 400) { lastSlow = t0; slowTick(); }
      perf.work += performance.now() - t0;
    }
    function slowTick() {
      const now = performance.now(), dt = Math.max(1, now - perf.last); perf.last = now;
      if (E) {
        const sv = sysVolume(); if (sv !== perf.sys) { perf.sys = sv; E.setSystemVolume(sv); }
        perf.poly = E.prune();
        // Let the audio hardware sleep when nothing has played for a while (battery on iPad); any tap resumes it.
        if (T.playing || perf.poly || Object.keys(held).length || auditionEl) idleSince = now;
        else if (E.ctx.state === "running" && now - idleSince > 45000) { try { E.ctx.suspend(); } catch (e) {} }
      } else perf.poly = 0;
      sampleAc(); fitCheck();
      const cpu = clamp(Math.round((perf.work / dt) * 100 + perf.poly * 0.4), 0, 99); perf.work = 0;
      cpuV.textContent = cpu + "%"; cpuBar.style.transform = `scaleX(${(cpu / 100).toFixed(2)})`; polyV.textContent = String(perf.poly);
    }

    // =================================================================
    //  Keyboard
    // =================================================================
    function isActive() {
      if (closed || !win.isConnected || win.style.display === "none") return false;
      let top = null, z = -Infinity;
      document.querySelectorAll(".win").forEach((w) => { if (w.style.display === "none" || !w.offsetWidth) return; const zz = +w.style.zIndex || 0; if (zz >= z) { z = zz; top = w; } });
      return top === win;
    }
    const onKeyDown = (e) => {
      if (!isActive()) return;
      if (e.key === "Escape" && menuEl) { e.preventDefault(); closeMenu(); return; }
      if (modalEl) return;
      const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (typing) return;
      const k = e.key, ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        const lk = (k || "").toLowerCase();
        if (lk === "s") { e.preventDefault(); if (e.shiftKey) saveAs(); else saveProject(); }
        else if (lk === "o") { e.preventDefault(); openDialog(); }
        else if (lk === "z") { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
        else if (lk === "y") { e.preventDefault(); doRedo(); }
        else if (lk === "r") { e.preventDefault(); exportDialog(); }
        return;
      }
      if (e.altKey) return;
      if (k === " " || e.code === "Space") {
        e.preventDefault();
        if (t && t.tagName === "BUTTON" && root.contains(t)) { t.blur(); try { root.focus({ preventScroll: true }); } catch (er) {} } // or key-up would "click" it
        if (e.repeat) return; if (T.playing) stop(); else play(); return;
      }
      if (e.code === "NumpadAdd" || e.code === "NumpadSubtract") { e.preventDefault(); selectPattern(clamp(proj.cur + (e.code === "NumpadAdd" ? 1 : -1), 0, proj.patterns.length - 1)); return; }
      if (ui.typing && KEYMAP[e.code] != null && !e.shiftKey) {
        if (t && t.closest && t.closest(".fl-knob,.fl-fader,.fl-tempo")) return;
        e.preventDefault(); if (e.repeat) return;
        const ch = chById(ui.selCh) || prChannel(); if (ch) noteOn(ch, 60 + KEYMAP[e.code], "key:" + e.code);
      }
    };
    // F5–F9 are FL's window keys. Handled in the capture phase so, while FL Studio is the active window,
    // the browser (F5 = reload) and OS-wide hotkeys (the Auto Clicker toggles on F6) don't also react.
    const FKEYS = { F5: "playlist", F6: "rack", F7: "piano", F8: "browser", F9: "mixer" };
    let acMarker = false; // was an Auto Clicker point marker showing before this key press?
    const sampleAc = () => { acMarker = !!document.querySelector(".ac-marker:not(.ac-hide)"); };
    const onKeyCapture = (e) => {
      if (!FKEYS[e.key] || e.ctrlKey || e.metaKey || e.altKey || modalEl || !isActive()) { if (e.key !== "F6") sampleAc(); return; }
      e.preventDefault(); e.stopImmediatePropagation();
      // The Auto Clicker's own window-capture F6 listener was registered first and has already toggled;
      // F6 means "Channel rack" while FL Studio is the active window, so undo an accidental start.
      if (e.key === "F6" && window.AutoClicker && typeof AutoClicker.running === "function") {
        try { if (AutoClicker.running()) { AutoClicker.stop(); if (!acMarker && AutoClicker.clearPoint) AutoClicker.clearPoint(); } } catch (er) {}
      }
      if (e.repeat) return;
      if (e.key === "F8") toggleBrowser(); else setView(FKEYS[e.key]);
    };
    const onKeyUp = (e) => {
      if (held["key:" + e.code]) noteOff("key:" + e.code);
      // Space is play/stop: don't also let it "click" a focused toolbar button on key-up.
      if ((e.key === " " || e.code === "Space") && !modalEl && isActive()) {
        const t = e.target; if (t && t.tagName === "BUTTON" && root.contains(t)) e.preventDefault();
      }
    };
    const onBlur = () => { cancelOps(); releaseAll(); };
    let vfsTimer = 0;
    const onVfs = () => { clearTimeout(vfsTimer); vfsTimer = setTimeout(() => { if (!closed) renderBrowser(); }, 250); };
    window.addEventListener("keydown", onKeyCapture, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("vfs-change", onVfs);

    // =================================================================
    //  Teardown: stop audio, timers and listeners when the window closes
    // =================================================================
    function cleanup() {
      if (closed) return;
      try { persist(); } catch (e) {}
      halt(); closed = true;
      Object.keys(held).forEach((t) => delete held[t]);
      cancelAnimationFrame(raf); raf = 0;
      [saveTimer, hintTimer, uiTimer, wheelTimer, vfsTimer, rzTimer, fitTimer].forEach((x) => clearTimeout(x));
      ops.forEach((o) => { if (o.lp) clearTimeout(o.lp); }); ops.clear();
      try { ro.disconnect(); } catch (e) {}
      window.removeEventListener("pointermove", onWinMove); window.removeEventListener("pointerup", onWinUp); window.removeEventListener("pointercancel", onWinCancel); window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyCapture, true); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur); window.removeEventListener("vfs-change", onVfs);
      document.removeEventListener("pointerdown", onDocDown, true); document.removeEventListener("visibilitychange", onVis);
      stopAudition();
      // keep only a small plain snapshot for FLStudio.debug(); drop the heavy references so the closed
      // window (detached DOM, project, undo history, audio graph) can be garbage-collected
      try { lastDebug = api.debug(); } catch (e) {}
      if (E) { const c = E.ctx; try { const r = c.close(); if (r && r.catch) r.catch(() => {}); } catch (e) {} if (lastDebug) lastDebug.ctx = "closed"; }
      E = null; undoStack.length = 0; redoStack.length = 0; pendingSnap = null; prRenderNotes = null; prPh = plPh = null; rackCols = []; mxMeters = [];
      if (inst === me) inst = null;
    }
    win.addEventListener("wm-cleanup", cleanup);

    // =================================================================
    //  Public handle
    // =================================================================
    const api = {
      win, play, stop, pause, togglePlay, setView, setMode, selectPattern, selectChannel, ensureAudio, exportDialog, openDialog, undo: doUndo, redo: doRedo,
      get project() { return proj; },
      exportWav: (o) => doExport(o),
      save: (name) => (name ? writeProject(safeFile(String(name).replace(/\.flp$/i, "")) + ".flp") : saveProject()),
      // Opening a project from outside (File Explorer, Start, Browser) asks before unsaved work is discarded,
      // exactly like File > Open.
      openFile: (name) => { const kids = peekFolder(DIR_PROJ) || {}; const n = kids[name] || kids[name + ".flp"]; return n ? openNodeGuarded(kids[name] ? name : name + ".flp", n) : Promise.resolve(false); },
      openNode: (name, node) => openNodeGuarded(name, node),
      load: (p, name) => loadProject(normalize(p), name || null),
      close: () => ref.close(),
      debug: () => ({ timer: T.timer, raf, playing: T.playing, pos: T.pos, step: ui._step, ctx: E ? E.ctx.state : "none", sysGain: E && E.sys ? E.sys.gain.value : null, mainGain: E ? E.appMaster.gain.value : null, voices: E ? E.voices.length : 0, scheduled: E ? E.stats.scheduled : 0, closed, view: ui.view, dirty, file: fileName, undo: undoStack.length }),
    };
    const me = { win, api, focus: () => { try { win.style.display = ""; ref.focus(); } catch (e) {} } };
    inst = me; lastDebug = null;
    renderAll(); applyBrowser(); idleHint();
    raf = requestAnimationFrame(frame);
    return api;
  }

  // =====================================================================
  //  Registration: app, icon, Store listing, default install, .flp files
  // =====================================================================
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.flstudio = function () { return open(); };
  function hookVfs() {
    if (!window.VFS || VFS.__flHook || typeof VFS.openNode !== "function") return;
    const orig = VFS.openNode; VFS.__flHook = true;
    VFS.openNode = function (name, node) {
      if (/\.flp$/i.test(name || "") && node && node.type === "file") { const a = open(); a.openNode(name, node); return; } // asks first if there are unsaved changes
      return orig.apply(this, arguments);
    };
  }
  function register() {
    try {
      if (window.Icon && Icon.register) Icon.register("flstudio", `<img src="assets/flstudio.svg" alt="" draggable="false" style="width:100%;height:100%;object-fit:contain">`);
      if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === "flstudio")) Catalog.storeApps.push({ id: "flstudio", name: "FL Studio", cat: "Multimedia", price: 0, builtin: "flstudio", desc: "Make music: a pattern-based DAW with a step-sequencing Channel rack, Piano roll, Playlist arrangement and Mixer. Synthesised drums and “3x Osc” synths, swing, metronome and recording, and WAV export to Documents › FL Studio." });
      const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (ex.indexOf("flstudio") < 0) ex.push("flstudio");
      hookVfs();
    } catch (e) {}
  }
  register();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", register);

  window.FLStudio = {
    open: () => open(),
    get state() { return inst ? inst.api.project : normalize(store().project); },
    get api() { return inst ? inst.api : null; },
    play: () => (inst ? inst.api : open()).play(),
    stop: () => { if (inst) inst.api.stop(); },
    exportWav: (o) => (inst ? inst.api : open()).exportWav(o),
    save: (name) => (inst ? inst.api : open()).save(name),
    debug: () => (inst ? inst.api.debug() : lastDebug),
    demoProject, normalize, encodeWav, folders: { projects: DIR_PROJ.slice(), exports: DIR_EXP.slice() },
    // Offline-render a project (pattern or song) and return level statistics, without saving anything.
    renderStats: async (p, mode) => { const n = normalize(clone(p)); if (!n) return null; const m = mode === "song" ? "song" : "pat"; const r = await renderOffline(n, m, n.cur); return Object.assign(bufStats(r.buf, r.frames), { duration: r.frames / r.buf.sampleRate, voices: r.voices }); },
    instruments: () => Object.keys(INSTR), presets: () => Object.keys(SYNTHS), preset: (n) => synthPreset(n),
  };
})();
