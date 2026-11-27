/* Calculator — a Windows 11-style Calculator for the Windows 12 simulation.
   Modes: Standard · Scientific · Graphing · Programmer · Date calculation, plus 13 converters
   (Currency, Volume, Length, Weight and mass, Temperature, Energy, Area, Speed, Time, Power,
   Data, Pressure, Angle).
   - Exact arithmetic: rationals on BigInt (0.1 + 0.2 = 0.3, 1 ÷ 3 × 3 = 1).
   - Transcendental functions (sin, ln, xʸ …) in 60-digit BigInt fixed point, rounded to 34
     significant digits, so sin(30°) = 0.5 and log(1000) = 3 exactly.
   - Programmer mode on BigInt with two's-complement wraparound per word size.
   - Graphing uses its own small expression parser (no eval / new Function).
   - Currency rates: live from open.er-api.com (ExchangeRate-API, no key) with a clearly
     labelled cached / offline fallback.
   Overrides AppRegistry.calculator from js/apps.js. Styles: css/calcx.css (cx- prefix). */
(function () {
  "use strict";
  window.AppRegistry = window.AppRegistry || {};

  /* ======================================================================
     1. Exact rational arithmetic (BigInt numerator / denominator)
     ====================================================================== */
  class CalcError extends Error { constructor(m) { super(m); this.calc = true; } }
  const ERR = { div0: "Cannot divide by zero", undef: "Result is undefined", inv: "Invalid input", over: "Overflow" };
  const fail = (k) => { throw new CalcError(ERR[k] || k); };
  const MAX_EXP = 10000; // |x| ≥ 1e10000 → Overflow (like Windows' limit)

  const p10cache = new Map();
  const p10 = (k) => { let v = p10cache.get(k); if (v === undefined) { v = 10n ** BigInt(k); if (k < 4096) p10cache.set(k, v); } return v; };
  const babs = (a) => (a < 0n ? -a : a);
  const blen = (a) => (a === 0n ? 0 : babs(a).toString().length);
  function bgcd(a, b) { a = babs(a); b = babs(b); while (b) { const t = a % b; a = b; b = t; } return a; }
  function isqrt(n) {
    if (n < 0n) fail("inv");
    if (n < 2n) return n;
    let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
    for (;;) { const y = (x + n / x) >> 1n; if (y >= x) return x; x = y; }
  }

  const ZERO = Object.freeze({ n: 0n, d: 1n }), ONE = Object.freeze({ n: 1n, d: 1n });
  function mkRaw(n, d) {
    if (d < 0n) { n = -n; d = -d; }
    if (n === 0n) return ZERO;
    const g = bgcd(n, d); if (g !== 1n) { n /= g; d /= g; }
    return { n, d };
  }
  function mk(n, d) {
    if (d === 0n) fail(n === 0n ? "undef" : "div0");
    const r = mkRaw(n, d);
    if (r.n === 0n) return ZERO;
    const ln = blen(r.n), ld = blen(r.d);
    if (ln - ld >= MAX_EXP && babs(r.n) >= r.d * p10(MAX_EXP)) fail("over");
    if (ld - ln >= MAX_EXP && babs(r.n) * p10(MAX_EXP) < r.d) return ZERO;
    if (ld > 120) return approx(r, 60); // keep denominators small: 60 significant digits is plenty
    return r;
  }
  const R = (v) => (typeof v === "object" ? v : parseR(String(v)));
  const ri = (k) => mkRaw(BigInt(k), 1n);

  // Round to `sig` significant digits → { neg, digits (no trailing zeros), E } with value = d.ddd × 10^E
  function toDigits(r, sig) {
    if (r.n === 0n) return { neg: false, digits: "0", E: 0 };
    const neg = r.n < 0n, n = babs(r.n), d = r.d;
    let E = blen(n) - blen(d);
    const ge = (e) => (e >= 0 ? n >= d * p10(e) : n * p10(-e) >= d);
    if (!ge(E)) E--;
    const sc = sig - 1 - E;
    let num = n, den = d;
    if (sc >= 0) num = n * p10(sc); else den = d * p10(-sc);
    let q = num / den; const rem = num % den;
    if (rem * 2n >= den) q += 1n;
    if (q >= p10(sig)) { q /= 10n; E++; }
    const digits = q.toString().replace(/0+$/, "") || "0";
    return { neg, digits, E };
  }
  function fromDigits(t) {
    const k = t.E - (t.digits.length - 1); let n = BigInt(t.digits); if (t.neg) n = -n;
    return k >= 0 ? mkRaw(n * p10(k), 1n) : mkRaw(n, p10(-k));
  }
  function approx(r, sig) { return r.n === 0n ? ZERO : fromDigits(toDigits(r, sig)); }

  function parseR(str) {
    const m = /^\s*([+-])?(\d*)(?:\.(\d*))?(?:e([+-]?\d*))?\s*$/i.exec(String(str));
    if (!m || (!m[2] && m[3] === undefined)) return null;
    const ip = m[2] || "", fp = m[3] || "", ex = parseInt(m[4] || "0", 10) || 0;
    if (!(ip + fp)) return ZERO;
    if (ex > MAX_EXP + 60) fail("over");
    if (ex < -MAX_EXP - 60) return ZERO;
    let n = BigInt(ip + fp); if (m[1] === "-") n = -n;
    const k = ex - fp.length;
    return k >= 0 ? mk(n * p10(k), 1n) : mk(n, p10(-k));
  }
  function fromNum(x, sig) {
    if (Number.isNaN(x)) fail("inv");
    if (!isFinite(x)) fail("over");
    if (x === 0) return ZERO;
    return parseR(x.toPrecision(sig || 15));
  }
  function toNum(r) {
    if (r.n === 0n) return 0;
    const t = toDigits(r, 17);
    return parseFloat((t.neg ? "-" : "") + t.digits[0] + "." + (t.digits.slice(1) || "0") + "e" + t.E);
  }
  function log10D(r) { // double log10 of a positive rational of any size
    const t = toDigits(r, 17);
    return Math.log10(parseFloat(t.digits[0] + "." + (t.digits.slice(1) || "0"))) + t.E;
  }

  const add = (a, b) => (a.d === b.d ? mk(a.n + b.n, a.d) : mk(a.n * b.d + b.n * a.d, a.d * b.d));
  const sub = (a, b) => (a.d === b.d ? mk(a.n - b.n, a.d) : mk(a.n * b.d - b.n * a.d, a.d * b.d));
  const mul = (a, b) => mk(a.n * b.n, a.d * b.d);
  const div = (a, b) => { if (b.n === 0n) fail(a.n === 0n ? "undef" : "div0"); return mk(a.n * b.d, a.d * b.n); };
  const neg = (a) => (a.n === 0n ? ZERO : { n: -a.n, d: a.d });
  const absR = (a) => (a.n < 0n ? { n: -a.n, d: a.d } : a);
  const cmp = (a, b) => { const x = a.n * b.d - b.n * a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; };
  const isInt = (a) => a.d === 1n;
  const floorR = (a) => { let q = a.n / a.d; if (a.n < 0n && a.n % a.d !== 0n) q -= 1n; return mkRaw(q, 1n); };
  const ceilR = (a) => { let q = a.n / a.d; if (a.n > 0n && a.n % a.d !== 0n) q += 1n; return mkRaw(q, 1n); };
  const truncR = (a) => mkRaw(a.n / a.d, 1n);
  const modFloor = (a, b) => { if (b.n === 0n) fail("div0"); return sub(a, mul(b, floorR(div(a, b)))); };
  const ser = (r) => r.n.toString() + "/" + r.d.toString();
  const deser = (s) => { try { const [n, d] = String(s).split("/"); return mk(BigInt(n), BigInt(d || "1")); } catch (e) { return ZERO; } };

  function sqrtR(a) {
    if (a.n < 0n) fail("inv");
    if (a.n === 0n) return ZERO;
    const N = a.n * a.d; let s = isqrt(N);
    if (s * s === N) return mk(s, a.d);
    const k = Math.max(0, 44 - (blen(N) >> 1));
    s = isqrt(N * p10(2 * k));
    return approx(mk(s, a.d * p10(k)), 40);
  }
  function powInt(a, k) { // k: BigInt
    if (k === 0n) return ONE;
    if (a.n === 0n) { if (k < 0n) fail("div0"); return ZERO; }
    if (babs(a.n) === a.d) return a.n < 0n && (k & 1n) ? neg(ONE) : ONE;
    const est = log10D(absR(a)) * Number(k);
    if (est > MAX_EXP + 1) fail("over");
    if (est < -MAX_EXP - 1) return ZERO;
    const e = babs(k);
    if ((blen(a.n) + blen(a.d)) * Number(e) > 30000) { // exact result would be huge: use 60-digit exp/ln
      const r = approx(expRaw(mul(mkRaw(k, 1n), fromF(lnF(absR(a))))), SIG);
      return a.n < 0n && (k & 1n) ? neg(r) : r;
    }
    return k < 0n ? mk(a.d ** e, a.n ** e) : mk(a.n ** e, a.d ** e);
  }

  /* ======================================================================
     2. High-precision transcendental functions (60-digit BigInt fixed point)
     ====================================================================== */
  const FP = 60, FS = 10n ** 60n;
  const toF = (r) => (r.n * FS) / r.d;
  const fromF = (f) => mk(f, FS);
  function atanhInvF(k) { const K = BigInt(k), K2 = K * K; let term = FS / K, sum = term, n = 1n; while (term) { term /= K2; n += 2n; sum += term / n; } return sum; }
  function atanInvF(k) { const K = BigInt(k), K2 = K * K; let term = FS / K, sum = term, n = 1n, sg = -1n; while (term) { term /= K2; n += 2n; sum += sg * (term / n); sg = -sg; } return sum; }
  const LN2F = 2n * atanhInvF(3);
  const LN10F = 3n * LN2F + 2n * atanhInvF(9);
  const PIF = 16n * atanInvF(5) - 4n * atanInvF(239);
  const SIG = 34; // significant digits kept for transcendental results

  function expRaw(r) { // e^r as a rational with ~60 correct digits
    const xd = toNum(r);
    if (xd > 23026) fail("over");
    if (xd < -23100) return ZERO;
    const x = toF(r);
    let k = x / LN2F, rem = x - k * LN2F;
    if (rem > LN2F / 2n) { k += 1n; rem -= LN2F; } else if (rem < -LN2F / 2n) { k -= 1n; rem += LN2F; }
    let term = FS, sum = FS, i = 1n;
    while (term !== 0n) { term = (term * rem) / (FS * i); sum += term; i += 1n; }
    return k >= 0n ? mk(sum * (1n << k), FS) : mk(sum, FS * (1n << -k));
  }
  function lnF(r) { // ln(r) as fixed point BigInt
    if (r.n <= 0n) fail("inv");
    const t = toDigits(r, FP + 6);
    let m = BigInt(t.digits.padEnd(FP + 1, "0").slice(0, FP + 1)) ; // d.ddd… × 10^60
    let k = 0n; const lim = (3n * FS) / 2n;
    while (m > lim) { m /= 2n; k += 1n; }
    const z = ((m - FS) * FS) / (m + FS), z2 = (z * z) / FS;
    let term = z, sum = z, n = 1n;
    while (term !== 0n) { term = (term * z2) / FS; n += 2n; sum += term / n; }
    return 2n * sum + k * LN2F + BigInt(t.E) * LN10F;
  }
  function sincosF(x) {
    const half = PIF / 2n;
    let k = x / half, r = x - k * half;
    if (r > half / 2n) { k += 1n; r -= half; } else if (r < -half / 2n) { k -= 1n; r += half; }
    const r2 = (r * r) / FS;
    let s = r, term = r, i = 1n;
    while (term !== 0n) { term = -(term * r2) / (FS * (i + 1n) * (i + 2n)); s += term; i += 2n; }
    let c = FS; term = FS; i = 0n;
    while (term !== 0n) { term = -(term * r2) / (FS * (i + 1n) * (i + 2n)); c += term; i += 2n; }
    const q = Number(((k % 4n) + 4n) % 4n);
    return q === 0 ? { s, c } : q === 1 ? { s: c, c: -s } : q === 2 ? { s: -s, c: -c } : { s: -c, c: s };
  }
  function atanF(x) {
    if (x < 0n) return -atanF(-x);
    if (x > FS) return PIF / 2n - atanF((FS * FS) / x);
    let mult = 1n;
    for (let j = 0; j < 2; j++) { const sq = isqrt(FS * FS + x * x); x = (x * FS) / (FS + sq); mult *= 2n; }
    const x2 = (x * x) / FS; let term = x, sum = x, n = 1n;
    while (term !== 0n) { term = -(term * x2) / FS; n += 2n; sum += term / n; }
    return sum * mult;
  }
  function asinF(x) {
    if (x > FS || x < -FS) fail("inv");
    if (x === FS) return PIF / 2n; if (x === -FS) return -PIF / 2n;
    return atanF((x * FS) / isqrt(FS * FS - x * x));
  }
  const PI_R = approx(fromF(PIF), 40);
  const E_R = approx(expRaw(ONE), 40);
  const R100 = ri(100);

  function lnR(a) { if (a.n <= 0n) fail("inv"); if (a.n === a.d) return ZERO; return approx(fromF(lnF(a)), SIG); }
  function log10R(a) {
    if (a.n <= 0n) fail("inv");
    const sn = a.n.toString(), sd = a.d.toString();
    if (a.d === 1n && /^10*$/.test(sn)) return ri(sn.length - 1);
    if (a.n === 1n && /^10*$/.test(sd)) return ri(-(sd.length - 1));
    return approx(mk(lnF(a), LN10F), SIG);
  }
  function logBase(x, y) { // log base y of x
    if (x.n <= 0n || y.n <= 0n || (y.n === y.d)) fail("inv");
    return approx(mk(lnF(x), lnF(y)), SIG);
  }
  function expR(a) { return a.n === 0n ? ONE : approx(expRaw(a), SIG); }
  function pow10R(a) { if (isInt(a)) { if (babs(a.n) > BigInt(MAX_EXP)) { if (a.n > 0n) fail("over"); return ZERO; } return powInt(ri(10), a.n); } return approx(expRaw(fromF(toF(a) * LN10F / FS)), SIG); }
  function pow2R(a) { if (isInt(a) && babs(a.n) < 40000n) return powInt(ri(2), a.n); return approx(expRaw(fromF(toF(a) * LN2F / FS)), SIG); }
  function powR(a, b) {
    if (isInt(b)) {
      if (babs(b.n) > 10000000n) { if (babs(a.n) === a.d) return a.n < 0n && (b.n & 1n) ? neg(ONE) : ONE; if (a.n === 0n) { if (b.n < 0n) fail("div0"); return ZERO; } const big = (babs(a.n) > a.d) === (b.n > 0n); if (big) fail("over"); return ZERO; }
      return powInt(a, b.n);
    }
    if (a.n === 0n) { if (b.n < 0n) fail("div0"); return ZERO; }
    let sgn = false;
    if (a.n < 0n) { if (b.d % 2n === 0n) fail("inv"); sgn = b.n % 2n !== 0n; a = neg(a); }
    let r;
    if (b.n === 1n && b.d === 2n) r = sqrtR(a);
    else if (b.n === -1n && b.d === 2n) r = div(ONE, sqrtR(a));
    else {
      const est = log10D(a) * toNum(b);
      if (est > MAX_EXP + 1) fail("over");
      if (est < -MAX_EXP - 1) return ZERO;
      r = approx(expRaw(mul(b, fromF(lnF(a)))), SIG);
    }
    return sgn ? neg(r) : r;
  }
  function rootR(a, y) { if (y.n === 0n) fail("inv"); return powR(a, div(ONE, y)); }
  function cbrtR(a) { return a.n < 0n ? neg(powR(neg(a), mk(1n, 3n))) : powR(a, mk(1n, 3n)); }

  // factorial: exact for integers (≤ 3248, beyond that the result exceeds 1e10000), gamma(x+1) otherwise
  const factCache = [1n];
  function lgammaD(z) {
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgammaD(1 - z);
    z -= 1; let x = c[0]; for (let i = 1; i < 9; i++) x += c[i] / (z + i);
    const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function factR(a) {
    if (isInt(a)) {
      if (a.n < 0n) fail("inv");
      if (a.n > 3248n) fail("over");
      const n = Number(a.n);
      while (factCache.length <= n) factCache.push(factCache[factCache.length - 1] * BigInt(factCache.length));
      return mkRaw(factCache[n], 1n);
    }
    const z = toNum(a) + 1;
    if (z > 3300) fail("over");
    const lg = lgammaD(z) / Math.LN10; // log10 |Γ(z)|
    const sign = z > 0 || Math.floor(z) % 2 === 0 ? 1 : -1;
    if (lg > MAX_EXP) fail("over");
    const E = Math.floor(lg), m = Math.pow(10, lg - E);
    const r = parseR(m.toPrecision(13) + "e" + E);
    return sign < 0 ? neg(r) : r;
  }

  // Trigonometry. unit: "deg" | "rad" | "grad"
  const UNIT_HALF = { deg: 180n, grad: 200n };
  function trigR(name, a, unit) {
    let rad;
    if (unit !== "rad") {
      const half = UNIT_HALF[unit], full = mkRaw(half * 2n, 1n);
      const r = modFloor(a, full);
      const q = div(r, mkRaw(half / 2n, 1n));
      if (isInt(q)) {
        const qi = Number(q.n), T = { sin: [0, 1, 0, -1], cos: [1, 0, -1, 0], tan: [0, null, 0, null], sec: [1, null, -1, null], csc: [null, 1, null, -1], cot: [null, 0, null, 0] }[name][qi];
        if (T === null) fail("inv");
        return ri(T);
      }
      rad = (toF(r) * PIF) / (half * FS);
    } else {
      if (Math.abs(toNum(a)) > 1e40) fail("inv");
      rad = toF(a);
    }
    const { s, c } = sincosF(rad);
    let v;
    if (name === "sin") v = fromF(s); else if (name === "cos") v = fromF(c);
    else if (name === "tan") { if (c === 0n) fail("inv"); v = mk(s, c); }
    else if (name === "sec") { if (c === 0n) fail("inv"); v = mk(FS, c); }
    else if (name === "csc") { if (s === 0n) fail("inv"); v = mk(FS, s); }
    else { if (s === 0n) fail("inv"); v = mk(c, s); }
    v = approx(v, SIG);
    if (unit === "rad" && v.n !== 0n && Math.abs(toNum(v)) < 1e-32 * Math.max(1, Math.abs(toNum(a)))) v = ZERO;
    return v;
  }
  function radToUnit(f, unit) { return unit === "rad" ? approx(fromF(f), SIG) : approx(mk(f * UNIT_HALF[unit], PIF), SIG); }
  function atrigR(name, a, unit) { // inverse trig: asin acos atan asec acsc acot
    let x = a, f;
    if (name === "asec" || name === "acsc") { if (a.n === 0n) fail("inv"); x = div(ONE, a); }
    if (name === "asin" || name === "acsc") { if (cmp(absR(x), ONE) > 0) fail("inv"); f = asinF(toF(x)); }
    else if (name === "acos" || name === "asec") { if (cmp(absR(x), ONE) > 0) fail("inv"); f = PIF / 2n - asinF(toF(x)); }
    else if (name === "atan") f = atanF(toF(a));
    else { f = a.n === 0n ? PIF / 2n : atanF(toF(div(ONE, a))); if (a.n < 0n) f += PIF; } // acot ∈ (0, π)
    return radToUnit(f, unit);
  }
  function hypR(name, a) {
    const two = ri(2);
    const ex = () => expRaw(a), enx = () => expRaw(neg(a));
    const sinh = () => div(sub(ex(), enx()), two), cosh = () => div(add(ex(), enx()), two);
    const tanh = () => { if (toNum(absR(a)) > 80) return a.n < 0n ? neg(ONE) : ONE; const e2 = expRaw(mul(a, two)); return div(sub(e2, ONE), add(e2, ONE)); };
    let v;
    switch (name) {
      case "sinh": v = sinh(); break;
      case "cosh": v = cosh(); break;
      case "tanh": v = tanh(); break;
      case "sech": v = div(ONE, cosh()); break;
      case "csch": if (a.n === 0n) fail("inv"); v = div(ONE, sinh()); break;
      case "coth": if (a.n === 0n) fail("inv"); v = div(ONE, tanh()); break;
      case "asinh": { const x = absR(a); const r = fromF(lnF(add(x, sqrtR(add(mul(x, x), ONE))))); v = a.n < 0n ? neg(r) : r; break; }
      case "acosh": if (cmp(a, ONE) < 0) fail("inv"); v = fromF(lnF(add(a, sqrtR(sub(mul(a, a), ONE))))); break;
      case "atanh": if (cmp(absR(a), ONE) >= 0) fail("inv"); v = div(fromF(lnF(div(add(ONE, a), sub(ONE, a)))), two); break;
      case "asech": if (a.n <= 0n || cmp(a, ONE) > 0) fail("inv"); return hypR("acosh", div(ONE, a));
      case "acsch": if (a.n === 0n) fail("inv"); return hypR("asinh", div(ONE, a));
      case "acoth": if (cmp(absR(a), ONE) <= 0) fail("inv"); return hypR("atanh", div(ONE, a));
      default: fail("inv");
    }
    return a.n === 0n && /^(sinh|tanh|asinh|atanh)$/.test(name) ? ZERO : approx(v, SIG);
  }
  function toDms(a) { // decimal degrees → D.MMSSsss
    const ng = a.n < 0n, x = absR(a), D = truncR(x), m = mul(sub(x, D), ri(60)), M = truncR(m), s = mul(sub(m, M), ri(60));
    const r = add(add(D, div(M, R100)), div(s, ri(10000)));
    return ng ? neg(r) : r;
  }
  function fromDms(a) { // D.MMSSsss → decimal degrees
    const ng = a.n < 0n, x = absR(a), D = truncR(x), rest = mul(sub(x, D), R100), M = truncR(rest), s = mul(sub(rest, M), R100);
    const r = add(add(D, div(M, ri(60))), div(s, ri(3600)));
    return ng ? neg(r) : r;
  }
  function randR() {
    let s = ""; const a = new Uint8Array(32);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 32; i++) a[i] = Math.random() * 256; }
    for (let i = 0; i < 32; i++) s += a[i] % 10;
    return parseR("0." + s);
  }

  /* ======================================================================
     3. Display formatting (Windows-like)
     ====================================================================== */
  const groupInt = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  function fixedStr(t, group) {
    let ip, fp;
    if (t.E >= 0) { ip = t.digits.slice(0, t.E + 1).padEnd(t.E + 1, "0"); fp = t.digits.slice(t.E + 1); }
    else { ip = "0"; fp = "0".repeat(-t.E - 1) + t.digits; }
    return (t.neg ? "-" : "") + (group ? groupInt(ip) : ip) + (fp ? "." + fp : "");
  }
  const sciStr = (t) => (t.neg ? "-" : "") + t.digits[0] + "." + t.digits.slice(1) + "e" + (t.E >= 0 ? "+" : "-") + Math.abs(t.E);
  function fmtR(r, o) {
    o = o || {}; const sig = o.sig || 16;
    if (r.n === 0n) return "0";
    let t = toDigits(r, sig);
    if (o.fe || t.E >= sig) return sciStr(t);
    if (t.E >= 0 || ((-t.E - 1) + t.digits.length <= sig && t.E >= -9)) return fixedStr(t, o.group);
    if (t.E >= -3) { t = toDigits(r, sig + t.E + 1); if (t.E >= 0 || (-t.E - 1) + t.digits.length <= sig) return fixedStr(t, o.group); }
    return sciStr(toDigits(r, sig));
  }
  function fmtEntry(e) {
    let ng = false; if (e[0] === "-") { ng = true; e = e.slice(1); }
    const ei = e.indexOf("e"), mant = ei >= 0 ? e.slice(0, ei) : e, ex = ei >= 0 ? e.slice(ei + 1) : null;
    const dot = mant.indexOf(".");
    let s = dot >= 0 ? groupInt(mant.slice(0, dot)) + mant.slice(dot) : groupInt(mant);
    if (ex !== null) { if (dot < 0) s += "."; s += "e" + (ex[0] || "+") + (ex.slice(1) || "0"); }
    return (ng ? "-" : "") + s;
  }
  function entryDigits(e) {
    const mant = e.replace(/^-/, "").split("e")[0]; const [ip, fp] = mant.split(".");
    return (ip === "0" ? 0 : ip.length) + (fp ? fp.length : 0);
  }
  const parseEntryR = (e) => parseR(e.replace(/e[+-]?$/i, "").replace(/\.$/, "") || "0") || ZERO;

  /* ======================================================================
     4. Calculator engine (precedence + parentheses, Windows key semantics)
     ====================================================================== */
  function Engine(cfg) {
    const s = {};
    const reset = () => Object.assign(s, { vals: [], ops: [], parts: [], pidx: [], cur: cfg.zero, label: null, entry: null, afterOp: false, done: false, doneExpr: "", last: null, err: null, errExpr: null });
    reset();
    const top = () => s.ops[s.ops.length - 1];
    const newExpr = () => { s.vals = []; s.ops = []; s.parts = []; s.pidx = []; s.done = false; s.doneExpr = ""; s.afterOp = false; };
    const commitOperand = () => { s.vals.push(s.cur); s.parts.push(s.label != null ? s.label : cfg.fmtExpr(s.cur)); };
    const applyTop = () => { const op = s.ops.pop(), b = s.vals.pop(), a = s.vals.pop(); s.vals.push(cfg.bin(op, a, b)); };
    const reduceFor = (op) => {
      const p = cfg.prec(op), ra = !!(cfg.right && cfg.right(op));
      while (s.ops.length && top() !== "(") { const pt = cfg.prec(top()); if (pt > p || (pt === p && !ra)) applyTop(); else break; }
    };
    const hasOperand = () => s.entry !== null || s.label !== null;
    const api = { s, cfg };
    api.exprText = () => {
      if (s.err) return s.errExpr || "";
      if (s.done) return s.doneExpr;
      return s.parts.concat(s.label != null ? [s.label] : []).join(" ");
    };
    const act = (name, fn) => {
      api[name] = function () {
        if (!s.err) s.errExpr = null;
        try { fn.apply(null, arguments); }
        catch (e) {
          if (e && e.calc) { if (s.errExpr == null) s.errExpr = s.parts.concat(s.label != null ? [s.label] : []).join(" "); s.err = e.message; s.entry = null; }
          else throw e;
        }
      };
    };
    function unaryImpl(fn, name) {
      if (s.err) return;
      if (s.done) { const c = s.cur; newExpr(); s.cur = c; s.label = null; }
      const inner = s.label != null ? s.label : cfg.fmtExpr(s.cur);
      s.entry = null; s.afterOp = false;
      s.label = typeof name === "function" ? name(inner) : name + "(" + inner + ")";
      s.cur = fn(s.cur);
    }
    act("digit", (d) => {
      if (s.err) reset();
      if (s.done) newExpr();
      let e = s.entry === null || s.label !== null ? null : s.entry;
      if (e === null) e = d;
      else {
        const ei = e.indexOf("e");
        if (ei >= 0) { const ex = e.slice(ei + 2); if (ex.length >= 4) return; e = e.slice(0, ei + 2) + (ex === "0" ? "" : ex) + d; }
        else { if (cfg.countDigits(e) >= cfg.maxDigits) return; e = e === "0" ? d : e === "-0" ? "-" + d : e + d; }
      }
      if (cfg.entryOK && !cfg.entryOK(e)) return;
      s.entry = e; s.label = null; s.cur = cfg.fromEntry(e); s.afterOp = false;
    });
    act("dot", () => {
      if (s.err) reset();
      if (s.done) newExpr();
      if (s.entry === null || s.label !== null) s.entry = "0.";
      else if (/[.e]/.test(s.entry)) return;
      else s.entry += ".";
      s.label = null; s.cur = cfg.fromEntry(s.entry); s.afterOp = false;
    });
    act("exp", () => {
      if (s.err) return;
      if (s.done) { const c = s.cur; newExpr(); s.cur = c; s.label = null; }
      const e = s.entry !== null && s.label === null ? s.entry : cfg.plain(s.cur);
      if (!e || /e/i.test(e)) return;
      s.entry = e + "e+"; s.label = null; s.cur = cfg.fromEntry(s.entry); s.afterOp = false;
    });
    act("negate", () => {
      if (s.err) return;
      if (cfg.entryNegate && !s.done && s.entry !== null && s.label === null) {
        let e = s.entry; const ei = e.indexOf("e");
        if (ei >= 0) e = e.slice(0, ei + 1) + (e[ei + 1] === "-" ? "+" : "-") + e.slice(ei + 2);
        else if (e === "0") return;
        else e = e[0] === "-" ? e.slice(1) : "-" + e;
        s.entry = e; s.cur = cfg.fromEntry(e); return;
      }
      unaryImpl(cfg.neg, "negate");
    });
    act("unary", unaryImpl);
    act("binary", (op) => {
      if (s.err) return;
      if (s.done) { const c = s.cur; newExpr(); s.cur = c; s.label = null; }
      if (s.afterOp && s.ops.length && top() !== "(") {
        s.ops.pop(); s.parts.pop(); reduceFor(op); s.ops.push(op); s.parts.push(cfg.sym(op));
        s.cur = s.vals[s.vals.length - 1]; return;
      }
      commitOperand(); reduceFor(op); s.ops.push(op); s.parts.push(cfg.sym(op));
      s.cur = s.vals[s.vals.length - 1]; s.label = null; s.entry = null; s.afterOp = true;
    });
    act("lparen", () => {
      if (s.err) reset();
      if (s.done) newExpr();
      else if (!s.afterOp && hasOperand()) { commitOperand(); reduceFor(cfg.mulOp); s.ops.push(cfg.mulOp); s.parts.push(cfg.sym(cfg.mulOp)); }
      s.ops.push("("); s.pidx.push(s.parts.length); s.parts.push("(");
      s.entry = null; s.label = null; s.cur = cfg.zero; s.afterOp = false;
    });
    act("rparen", () => {
      if (s.err || s.done || !s.pidx.length) return;
      commitOperand();
      while (top() !== "(") applyTop();
      s.ops.pop();
      const v = s.vals.pop(), i = s.pidx.pop();
      s.label = "(" + s.parts.slice(i + 1).join(" ") + ")"; s.parts.length = i;
      s.cur = v; s.entry = null; s.afterOp = false;
    });
    act("equals", () => {
      if (s.err) { reset(); return; }
      if (s.done) {
        if (!s.last) return;
        const a = s.cur;
        s.errExpr = cfg.fmtExpr(a) + " " + cfg.sym(s.last.op) + " " + cfg.fmtExpr(s.last.b) + " =";
        const r = cfg.bin(s.last.op, a, s.last.b);
        s.doneExpr = s.errExpr; s.errExpr = null; s.cur = r;
        if (cfg.onResult) cfg.onResult(s.doneExpr, r);
        return;
      }
      let lastOp = null; for (let i = s.ops.length - 1; i >= 0; i--) if (s.ops[i] !== "(") { lastOp = s.ops[i]; break; }
      const b = s.cur;
      commitOperand();
      for (let i = 0; i < s.pidx.length; i++) s.parts.push(")");
      s.errExpr = s.parts.join(" ") + " =";
      while (s.ops.length) { if (top() === "(") s.ops.pop(); else applyTop(); }
      const r = s.vals.pop();
      s.doneExpr = s.errExpr; s.errExpr = null;
      s.last = lastOp ? { op: lastOp, b } : null;
      s.vals = []; s.ops = []; s.parts = []; s.pidx = [];
      s.cur = r; s.label = null; s.entry = null; s.afterOp = false; s.done = true;
      if (cfg.onResult && (lastOp || s.doneExpr !== cfg.fmtExpr(r) + " =")) cfg.onResult(s.doneExpr, r);
    });
    act("percent", () => {
      if (s.err) return;
      const t = !s.done && s.ops.length ? top() : null;
      let v;
      if (t === "+" || t === "−") v = div(mul(s.vals[s.vals.length - 1], s.cur), R100);
      else if (t === "×" || t === "÷") v = div(s.cur, R100);
      else v = cfg.zero;
      if (s.done) newExpr();
      s.cur = v; s.label = cfg.fmtExpr(v); s.entry = null; s.afterOp = false;
    });
    act("back", () => {
      if (s.err) { reset(); return; }
      if (s.done) { s.doneExpr = ""; return; }
      if (s.entry === null || s.label !== null) return;
      const e = /e[+-]$/.test(s.entry) ? s.entry.slice(0, -2) : s.entry.slice(0, -1);
      if (e === "" || e === "-") { s.entry = null; s.cur = cfg.zero; return; }
      s.entry = e; s.cur = cfg.fromEntry(e);
    });
    act("ce", () => { if (s.err || s.done) { reset(); return; } s.entry = null; s.label = null; s.cur = cfg.zero; s.afterOp = false; });
    act("clear", () => reset());
    act("setValue", (v, label, asEntry) => {
      if (s.err) reset();
      if (s.done) newExpr();
      s.cur = v; s.label = label || null; s.entry = asEntry && cfg.toEntry ? cfg.toEntry(v) : null; s.afterOp = false;
    });
    api.commit = () => { if (s.entry !== null && s.label === null) s.entry = null; };
    api.restore = (v, expr) => { reset(); s.cur = v; s.done = true; s.doneExpr = expr || ""; };
    api.mapValues = (fn) => { s.cur = fn(s.cur); s.vals = s.vals.map(fn); if (s.last) s.last.b = fn(s.last.b); s.entry = null; };
    api.display = () => (s.err ? s.err : s.entry !== null && s.label === null ? cfg.fmtEntry(s.entry) : cfg.fmtVal(s.cur));
    api.value = () => s.cur;
    api.openParens = () => s.pidx.length;
    api.showCE = () => !s.err && !s.done && (s.entry !== null || s.label !== null);
    return api;
  }

  // Standard / scientific engine configs
  const SCI_PREC = { "+": 1, "−": 1, "×": 2, "÷": 2, mod: 2, "^": 3, yroot: 3, logy: 3 };
  const SCI_SYM = { "+": "+", "−": "−", "×": "×", "÷": "÷", mod: "Mod", "^": "^", yroot: "yroot", logy: "log base" };
  function sciBin(op, a, b) {
    switch (op) {
      case "+": return add(a, b);
      case "−": return sub(a, b);
      case "×": return mul(a, b);
      case "÷": return div(a, b);
      case "mod": return modFloor(a, b);
      case "^": return powR(a, b);
      case "yroot": return rootR(a, b);
      case "logy": return logBase(a, b);
    }
    fail("inv");
  }
  function makeRatEngine(kind, opts) {
    opts = opts || {};
    const sci = kind === "scientific", sig = sci ? 32 : 16;
    return Engine({
      zero: ZERO, mulOp: "×", entryNegate: true, maxDigits: sci ? 32 : 16,
      prec: sci ? (op) => SCI_PREC[op] || 1 : () => 1,
      right: (op) => op === "^" || op === "yroot",
      bin: sciBin, sym: (op) => SCI_SYM[op] || op, neg,
      fromEntry: parseEntryR, countDigits: entryDigits, fmtEntry,
      fmtExpr: (r) => fmtR(r, { sig, group: false }),
      fmtVal: (r) => fmtR(r, { sig, group: true, fe: sci && opts.fe && opts.fe() }),
      plain: (r) => fmtR(r, { sig, group: false }),
      onResult: opts.onResult,
    });
  }

  /* ======================================================================
     5. Programmer arithmetic (BigInt, two's complement)
     ====================================================================== */
  const maskB = (bits) => (1n << BigInt(bits)) - 1n;
  function wrap(v, bits) { const B = BigInt(bits); v &= (1n << B) - 1n; return v >= 1n << (B - 1n) ? v - (1n << B) : v; }
  const uns = (v, bits) => v & maskB(bits);
  const PROG_PREC = { "×": 6, "÷": 6, mod: 6, "+": 5, "−": 5, lsh: 4, rsh: 4, AND: 3, NAND: 3, XOR: 2, OR: 1, NOR: 1 };
  const PROG_SYM = { "+": "+", "−": "−", "×": "×", "÷": "÷", mod: "%", AND: "AND", OR: "OR", XOR: "XOR", NAND: "NAND", NOR: "NOR", lsh: "<<", rsh: ">>" };
  function progBin(op, a, b, bits, shift) {
    const sh = () => { if (b < 0n) fail("inv"); return b > BigInt(bits) ? BigInt(bits) + 1n : b; };
    switch (op) {
      case "+": return wrap(a + b, bits);
      case "−": return wrap(a - b, bits);
      case "×": return wrap(a * b, bits);
      case "÷": if (b === 0n) fail("div0"); return wrap(a / b, bits);
      case "mod": if (b === 0n) fail("div0"); return wrap(a % b, bits);
      case "AND": return wrap(a & b, bits);
      case "OR": return wrap(a | b, bits);
      case "XOR": return wrap(a ^ b, bits);
      case "NAND": return wrap(~(a & b), bits);
      case "NOR": return wrap(~(a | b), bits);
      case "lsh": return wrap(a << sh(), bits);
      case "rsh": return shift === "logic" ? wrap(uns(a, bits) >> sh(), bits) : wrap(a >> sh(), bits);
    }
    fail("inv");
  }
  function rotate(v, bits, left, carry) { // returns { v, carry }
    const B = BigInt(bits), u = uns(v, bits), top = (u >> (B - 1n)) & 1n, low = u & 1n;
    if (carry == null) return { v: wrap(left ? ((u << 1n) | top) : ((u >> 1n) | (low << (B - 1n))), bits), carry: null };
    return left ? { v: wrap((u << 1n) | carry, bits), carry: top } : { v: wrap((u >> 1n) | (carry << (B - 1n)), bits), carry: low };
  }
  const RADIX_PREFIX = { 16: "0x", 8: "0o", 2: "0b", 10: "" };
  function toRadix(v, radix, bits, group) {
    if (radix === 10) { const t = v.toString(); return group ? (t[0] === "-" ? "-" + groupInt(t.slice(1)) : groupInt(t)) : t; }
    const s = uns(v, bits).toString(radix).toUpperCase();
    if (!group) return s;
    const g = radix === 8 ? 3 : 4;
    return s.replace(new RegExp("\\B(?=(.{" + g + "})+(?!.))", "g"), " ");
  }
  function parseRadix(str, radix) { // → BigInt (unwrapped) or null
    const t = String(str).trim().replace(/[\s_,]/g, "");
    const re = { 16: /^-?(0x)?[0-9a-f]+$/i, 10: /^-?\d+$/, 8: /^-?(0o)?[0-7]+$/i, 2: /^-?(0b)?[01]+$/i }[radix];
    if (!re.test(t)) return null;
    const ng = t[0] === "-", body = t.replace(/^-/, "").replace(/^0[xob]/i, "");
    const v = radix === 10 ? BigInt(body) : BigInt(RADIX_PREFIX[radix] + body);
    return ng ? -v : v;
  }
  function makeProgEngine(get) { // get(): { bits, radix, shift }
    return Engine({
      zero: 0n, mulOp: "×", entryNegate: false, maxDigits: 64,
      prec: (op) => PROG_PREC[op] || 1, right: () => false,
      bin: (op, a, b) => { const g = get(); return progBin(op, a, b, g.bits, g.shift); },
      sym: (op) => PROG_SYM[op] || op,
      neg: (v) => wrap(-v, get().bits),
      fromEntry: (e) => { const g = get(); return wrap(parseRadix(e, g.radix) || 0n, g.bits); },
      entryOK: (e) => {
        const g = get(), v = parseRadix(e, g.radix); if (v === null) return false;
        if (g.radix === 10) return v <= maskB(g.bits - 1) && v >= -(1n << BigInt(g.bits - 1));
        return v >= 0n && v <= maskB(g.bits);
      },
      countDigits: (e) => e.replace(/^-/, "").length,
      fmtExpr: (v) => toRadix(v, get().radix, get().bits, false),
      fmtVal: (v) => toRadix(v, get().radix, get().bits, true),
      fmtEntry: (e) => { const g = get(); if (g.radix === 10) return e[0] === "-" ? "-" + groupInt(e.slice(1)) : groupInt(e); return toRadix(BigInt(RADIX_PREFIX[g.radix] + (e || "0")), g.radix, 64, true).replace(/^0$/, e.toUpperCase()); },
      toEntry: (v) => toRadix(v, get().radix, get().bits, false),
      plain: () => null,
    });
  }

  /* ======================================================================
     6. Converters
     ====================================================================== */
  const FT_LBF = "1.3558179483314004"; // 1 ft·lbf in J (exact: 0.3048 m × 4.4482216152605 N)
  const BTU = "1055.05585262";        // International Table BTU in J
  function dataUnits() {
    const out = [["Bits", "1"], ["Nibble", "4"], ["Bytes", "8"]];
    const P = [["Kilo", "Kibi"], ["Mega", "Mebi"], ["Giga", "Gibi"], ["Tera", "Tebi"], ["Peta", "Pebi"], ["Exa", "Exbi"], ["Zetta", "Zebi"], ["Yotta", "Yobi"]];
    P.forEach(([dp, bp], i) => {
      const d = 1000n ** BigInt(i + 1), b = 1024n ** BigInt(i + 1);
      out.push([dp + "bits", d.toString()], [bp + "bits", b.toString()], [dp + "bytes", (d * 8n).toString()], [bp + "bytes", (b * 8n).toString()]);
    });
    return out;
  }
  // Each unit: [name, factor-in-base-unit] where factor is a decimal string or [numerator, denominator]
  const CONV = {
    volume: { name: "Volume", def: ["Liters", "Gallons (US)"], about: ["Cups (US)", "Fluid ounces (US)", "Cubic inches"], units: [
      ["Milliliters", "1"], ["Cubic centimeters", "1"], ["Liters", "1000"], ["Cubic meters", "1000000"],
      ["Teaspoons (US)", "4.92892159375"], ["Tablespoons (US)", "14.78676478125"], ["Fluid ounces (US)", "29.5735295625"], ["Cups (US)", "236.5882365"],
      ["Pints (US)", "473.176473"], ["Quarts (US)", "946.352946"], ["Gallons (US)", "3785.411784"],
      ["Cubic inches", "16.387064"], ["Cubic feet", "28316.846592"], ["Cubic yards", "764554.857984"],
      ["Teaspoons (UK)", ["28.4130625", "4.8"]], ["Tablespoons (UK)", "17.7581640625"], ["Fluid ounces (UK)", "28.4130625"],
      ["Pints (UK)", "568.26125"], ["Quarts (UK)", "1136.5225"], ["Gallons (UK)", "4546.09"]] },
    length: { name: "Length", def: ["Centimeters", "Inches"], about: ["Feet", "Meters", "Millimeters"], units: [
      ["Nanometers", "1e-9"], ["Microns", "1e-6"], ["Millimeters", "0.001"], ["Centimeters", "0.01"], ["Meters", "1"], ["Kilometers", "1000"],
      ["Inches", "0.0254"], ["Feet", "0.3048"], ["Yards", "0.9144"], ["Miles", "1609.344"], ["Nautical miles", "1852"]] },
    weight: { name: "Weight and mass", def: ["Kilograms", "Pounds"], about: ["Ounces", "Grams", "Stone"], units: [
      ["Carats", "0.2"], ["Milligrams", "0.001"], ["Centigrams", "0.01"], ["Decigrams", "0.1"], ["Grams", "1"], ["Dekagrams", "10"], ["Hectograms", "100"],
      ["Kilograms", "1000"], ["Metric tonnes", "1000000"], ["Ounces", "28.349523125"], ["Pounds", "453.59237"], ["Stone", "6350.29318"],
      ["Short tons (US)", "907184.74"], ["Long tons (UK)", "1016046.9088"]] },
    temperature: { name: "Temperature", def: ["Celsius", "Fahrenheit"], about: ["Kelvin", "Celsius", "Fahrenheit"], temp: true, units: [["Celsius"], ["Fahrenheit"], ["Kelvin"]] },
    energy: { name: "Energy", def: ["Joules", "Food calories"], about: ["Kilojoules", "Thermal calories", "Kilowatt-hours"], units: [
      ["Electron volts", "1.602176634e-19"], ["Joules", "1"], ["Kilojoules", "1000"], ["Thermal calories", "4.184"], ["Food calories", "4184"],
      ["Foot-pounds", FT_LBF], ["British thermal units", BTU], ["Kilowatt-hours", "3600000"]] },
    area: { name: "Area", def: ["Square meters", "Square feet"], about: ["Square yards", "Acres", "Square inches"], units: [
      ["Square millimeters", "0.000001"], ["Square centimeters", "0.0001"], ["Square meters", "1"], ["Hectares", "10000"], ["Square kilometers", "1000000"],
      ["Square inches", "0.00064516"], ["Square feet", "0.09290304"], ["Square yards", "0.83612736"], ["Acres", "4046.8564224"], ["Square miles", "2589988.110336"]] },
    speed: { name: "Speed", def: ["Kilometers per hour", "Miles per hour"], about: ["Meters per second", "Knots", "Feet per second"], units: [
      ["Centimeters per second", "0.01"], ["Meters per second", "1"], ["Kilometers per hour", ["1000", "3600"]], ["Feet per second", "0.3048"],
      ["Miles per hour", "0.44704"], ["Knots", ["1852", "3600"]], ["Mach", "340.3"]] },
    time: { name: "Time", def: ["Hours", "Minutes"], about: ["Seconds", "Days", "Weeks"], units: [
      ["Microseconds", "0.000001"], ["Milliseconds", "0.001"], ["Seconds", "1"], ["Minutes", "60"], ["Hours", "3600"], ["Days", "86400"], ["Weeks", "604800"], ["Years", "31536000"]] },
    power: { name: "Power", def: ["Watts", "Horsepower (US)"], about: ["Kilowatts", "BTUs per minute", "Foot-pounds per minute"], units: [
      ["Watts", "1"], ["Kilowatts", "1000"], ["Horsepower (US)", "745.69987158227022"], ["Foot-pounds per minute", [FT_LBF, "60"]], ["BTUs per minute", [BTU, "60"]]] },
    data: { name: "Data", def: ["Gigabytes", "Megabytes"], about: ["Gibibytes", "Megabits", "Kilobytes"], units: dataUnits() },
    pressure: { name: "Pressure", def: ["Atmospheres", "Pounds per square inch"], about: ["Kilopascals", "Bars", "Millimeters of mercury"], units: [
      ["Atmospheres", "101325"], ["Bars", "100000"], ["Kilopascals", "1000"], ["Millimeters of mercury", "133.322387415"], ["Pascals", "1"],
      ["Pounds per square inch", ["4.4482216152605", "0.00064516"]]] },
    angle: { name: "Angle", def: ["Degrees", "Radians"], about: ["Gradians", "Degrees", "Radians"], units: [["Degrees", "1"], ["Radians", ["180", "PI"]], ["Gradians", "0.9"]] },
    currency: { name: "Currency", def: ["USD", "EUR"], currency: true, units: [] },
  };
  const CONV_ORDER = ["currency", "volume", "length", "weight", "temperature", "energy", "area", "speed", "time", "power", "data", "pressure", "angle"];
  const factorR = (f) => (Array.isArray(f) ? div(f[0] === "PI" ? PI_R : parseR(f[0]), f[1] === "PI" ? PI_R : parseR(f[1])) : parseR(f));
  Object.values(CONV).forEach((c) => c.units.forEach((u) => { if (u[1] != null) u.f = factorR(u[1]); }));
  const unitOf = (cat, name) => cat.units.find((u) => u[0] === name);

  const C273 = parseR("273.15"), N32 = ri(32), F59 = mk(5n, 9n), F95 = mk(9n, 5n);
  function tempToK(v, u) { return u === "Kelvin" ? v : u === "Celsius" ? add(v, C273) : add(mul(sub(v, N32), F59), C273); }
  function tempFromK(k, u) { return u === "Kelvin" ? k : u === "Celsius" ? sub(k, C273) : add(mul(sub(k, C273), F95), N32); }
  function convert(catId, v, from, to, fx) {
    const cat = CONV[catId];
    if (cat.temp) return tempFromK(tempToK(v, from), to);
    if (cat.currency) { const rf = fx && fx.rates[from], rt = fx && fx.rates[to]; if (!rf || !rt) return null; return div(mul(v, parseR(String(rt))), parseR(String(rf))); }
    const a = unitOf(cat, from), b = unitOf(cat, to);
    return div(mul(v, a.f), b.f);
  }

  // Currency: names, symbols, and an offline reference snapshot (NOT live — clearly labelled in the UI)
  const CURRENCIES = [
    ["USD", "US Dollar", "$"], ["EUR", "Euro", "€"], ["GBP", "British Pound", "£"], ["JPY", "Japanese Yen", "¥"], ["CNY", "Chinese Yuan", "¥"],
    ["INR", "Indian Rupee", "₹"], ["CAD", "Canadian Dollar", "$"], ["AUD", "Australian Dollar", "$"], ["CHF", "Swiss Franc", "CHF "], ["MXN", "Mexican Peso", "$"],
    ["BRL", "Brazilian Real", "R$"], ["KRW", "South Korean Won", "₩"], ["SEK", "Swedish Krona", "kr "], ["NOK", "Norwegian Krone", "kr "], ["DKK", "Danish Krone", "kr "],
    ["NZD", "New Zealand Dollar", "$"], ["SGD", "Singapore Dollar", "$"], ["HKD", "Hong Kong Dollar", "$"], ["ZAR", "South African Rand", "R "], ["TRY", "Turkish Lira", "₺"],
    ["PLN", "Polish Zloty", "zł "], ["RUB", "Russian Ruble", "₽"], ["THB", "Thai Baht", "฿"], ["ILS", "Israeli New Shekel", "₪"], ["AED", "UAE Dirham", "AED "],
    ["SAR", "Saudi Riyal", "SAR "], ["CZK", "Czech Koruna", "Kč "], ["HUF", "Hungarian Forint", "Ft "], ["IDR", "Indonesian Rupiah", "Rp "], ["PHP", "Philippine Peso", "₱"], ["MYR", "Malaysian Ringgit", "RM "],
  ];
  const FX_OFFLINE = { date: "25 Nov 2026", rates: { USD: 1, EUR: 0.91245, GBP: 0.763269, JPY: 159.238818, CNY: 6.678179, INR: 92.925233, CAD: 1.429121, AUD: 1.507265, CHF: 0.836724, MXN: 19.375508, BRL: 5.894422, KRW: 1343.042517, SEK: 10.240617, NOK: 9.801644, DKK: 6.821344, NZD: 1.826291, SGD: 1.28993, HKD: 7.841855, ZAR: 17.532655, TRY: 50.669245, PLN: 4.06987, RUB: 81.96636, THB: 33.940118, ILS: 3.339784, AED: 3.6725, SAR: 3.75, CZK: 22.279019, HUF: 337.292163, IDR: 18227.123111, PHP: 63.769743, MYR: 4.115504 } };
  const FX_URL = "https://open.er-api.com/v6/latest/USD";
  const FX_SOURCE = "ExchangeRate-API (open.er-api.com)";
  let fxSession = null, fxPending = null;
  function fetchFx(st, force) {
    if (!force && fxSession && Date.now() - fxSession.fetchedAt < 3600e3) return Promise.resolve(fxSession);
    if (fxPending) return fxPending;
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const to = setTimeout(() => ctl && ctl.abort(), 9000);
    fxPending = fetch(FX_URL, { signal: ctl ? ctl.signal : undefined, cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((j) => {
        if (!j || j.result !== "success" || !j.rates || !j.rates.EUR) throw new Error("Bad response");
        const rates = {}; CURRENCIES.forEach(([c]) => { if (typeof j.rates[c] === "number" && j.rates[c] > 0) rates[c] = j.rates[c]; });
        fxSession = { rates, updatedUnix: j.time_last_update_unix || 0, fetchedAt: Date.now(), source: FX_SOURCE };
        st.fx = fxSession;
        return fxSession;
      })
      .finally(() => { clearTimeout(to); fxPending = null; });
    return fxPending;
  }

  /* ======================================================================
     7. Date calculation
     ====================================================================== */
  const DateCalc = {
    parse(s) { const m = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; },
    leap: (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0,
    dim(y, m) { return [31, DateCalc.leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; },
    dayNum(a) { const t = new Date(0); t.setUTCFullYear(a.y, a.m - 1, a.d); t.setUTCHours(0, 0, 0, 0); return Math.round(t.getTime() / 864e5); },
    fromDayNum(n) { const t = new Date(n * 864e5); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; },
    addMonths(a, n) { const t = a.y * 12 + (a.m - 1) + n, y = Math.floor(t / 12), m = t - y * 12 + 1; return { y, m, d: Math.min(a.d, DateCalc.dim(y, m)) }; },
    diff(a, b) {
      if (DateCalc.dayNum(a) > DateCalc.dayNum(b)) { const t = a; a = b; b = t; }
      let months = (b.y - a.y) * 12 + (b.m - a.m);
      while (months > 0 && DateCalc.dayNum(DateCalc.addMonths(a, months)) > DateCalc.dayNum(b)) months--;
      const rest = DateCalc.dayNum(b) - DateCalc.dayNum(DateCalc.addMonths(a, months));
      return { years: Math.floor(months / 12), months: months % 12, weeks: Math.floor(rest / 7), days: rest % 7, total: DateCalc.dayNum(b) - DateCalc.dayNum(a) };
    },
    add(a, y, m, d, sign) { const r = DateCalc.addMonths(a, sign * (y * 12 + m)); return DateCalc.fromDayNum(DateCalc.dayNum(r) + sign * d); },
    iso(a) { return String(a.y).padStart(4, "0") + "-" + String(a.m).padStart(2, "0") + "-" + String(a.d).padStart(2, "0"); },
    long(a) { const t = new Date(0); t.setUTCFullYear(a.y, a.m - 1, a.d); return t.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }); },
    diffText(r) {
      if (!r.total) return "Same dates";
      const p = [], u = (n, w) => n && p.push(n + " " + w + (n === 1 ? "" : "s"));
      u(r.years, "year"); u(r.months, "month"); u(r.weeks, "week"); u(r.days, "day");
      return p.join(", ");
    },
  };

  /* ======================================================================
     8. Safe expression parser for graphing (no eval / new Function)
     ====================================================================== */
  const GNAMES = ["arcsin", "arccos", "arctan", "asinh", "acosh", "atanh", "floor", "round", "sinh", "cosh", "tanh", "asin", "acos", "atan", "sqrt", "cbrt", "ceil", "sign", "root", "sin", "cos", "tan", "sec", "csc", "cot", "log", "exp", "abs", "sgn", "min", "max", "mod", "tau", "ln", "pi", "x", "e"];
  function gpow(a, b) {
    if (a < 0 && !Number.isInteger(b)) {
      for (let q = 3; q < 100; q += 2) { const p = b * q, rp = Math.round(p); if (Math.abs(p - rp) < 1e-9) { const v = Math.pow(-a, b); return rp % 2 ? -v : v; } }
      return NaN;
    }
    return Math.pow(a, b);
  }
  function gfact(x) { if (x < 0 && Number.isInteger(x)) return NaN; if (Number.isInteger(x) && x <= 170) { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; } const z = x + 1; const lg = lgammaD(z); const sgn = z > 0 || Math.floor(z) % 2 === 0 ? 1 : -1; return sgn * Math.exp(lg); }
  function gtokenize(src) {
    let s = String(src).replace(/[−–]/g, "-").replace(/[×·∙]/g, "*").replace(/÷/g, "/").replace(/π/g, "pi").replace(/τ/g, "tau").replace(/²/g, "^2").replace(/³/g, "^3").replace(/√/g, " sqrt ").replace(/\*\*/g, "^");
    const out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
        if (!m) throw new Error("Invalid number");
        out.push({ t: "num", v: parseFloat(m[0]) }); i += m[0].length; continue;
      }
      if (/[a-z]/i.test(c)) {
        let j = i; while (j < s.length && /[a-z]/i.test(s[j])) j++;
        const word = s.slice(i, j).toLowerCase(); let k = 0;
        while (k < word.length) {
          const nm = GNAMES.find((n) => word.startsWith(n, k));
          if (!nm) throw new Error("Unknown name “" + word.slice(k) + "”");
          out.push({ t: "id", v: nm }); k += nm.length;
        }
        i = j; continue;
      }
      if ("+-*/^".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
      if ("(),|!".includes(c)) { out.push({ t: c }); i++; continue; }
      if (c === "[" || c === "{") { out.push({ t: "(" }); i++; continue; }
      if (c === "]" || c === "}") { out.push({ t: ")" }); i++; continue; }
      throw new Error("Unexpected “" + c + "”");
    }
    return out;
  }
  function compileExpr(src, opt) {
    opt = opt || {};
    let text = String(src || "").trim().replace(/^(y|f\s*\(\s*x\s*\))\s*=/i, "");
    if (!text.trim()) throw new Error("Enter an expression");
    const toks = gtokenize(text); let i = 0, absDepth = 0;
    const deg = () => !!(opt.deg && opt.deg());
    const ang = (v) => (deg() ? (v * Math.PI) / 180 : v), iang = (v) => (deg() ? (v * 180) / Math.PI : v);
    const FN = {
      sin: (a) => Math.sin(ang(a)), cos: (a) => Math.cos(ang(a)), tan: (a) => Math.tan(ang(a)),
      sec: (a) => 1 / Math.cos(ang(a)), csc: (a) => 1 / Math.sin(ang(a)), cot: (a) => 1 / Math.tan(ang(a)),
      asin: (a) => iang(Math.asin(a)), acos: (a) => iang(Math.acos(a)), atan: (a) => iang(Math.atan(a)),
      arcsin: (a) => iang(Math.asin(a)), arccos: (a) => iang(Math.acos(a)), arctan: (a) => iang(Math.atan(a)),
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
      sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, ln: Math.log, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
      sign: Math.sign, sgn: Math.sign,
      log: (a, b) => (b === undefined ? Math.log10(a) : Math.log(a) / Math.log(b)),
      min: Math.min, max: Math.max, mod: (a, b) => a - b * Math.floor(a / b), root: (a, n) => gpow(a, 1 / n),
    };
    const ARITY = { log: [1, 2], min: [1, 9], max: [1, 9], mod: [2, 2], root: [2, 2] };
    const peek = () => toks[i];
    const expect = (t) => { const k = toks[i++]; if (!k || k.t !== t) throw new Error(k ? "Expected “" + t + "”" : "Missing “" + t + "”"); };
    const startsFactor = (k) => k && (k.t === "num" || k.t === "id" || k.t === "(" || (k.t === "|" && absDepth === 0));
    function pExpr() {
      let a = pTerm();
      while (peek() && peek().t === "op" && (peek().v === "+" || peek().v === "-")) { const o = toks[i++].v, l = a, b = pTerm(); a = o === "+" ? (x) => l(x) + b(x) : (x) => l(x) - b(x); }
      return a;
    }
    function pTerm() {
      let a = pUnary();
      for (;;) {
        const k = peek();
        if (k && k.t === "op" && (k.v === "*" || k.v === "/")) { i++; const l = a, b = pUnary(); a = k.v === "*" ? (x) => l(x) * b(x) : (x) => l(x) / b(x); }
        else if (startsFactor(k)) { const l = a, b = pPow(); a = (x) => l(x) * b(x); }
        else return a;
      }
    }
    function pUnary() { const k = peek(); if (k && k.t === "op" && (k.v === "-" || k.v === "+")) { i++; const a = pUnary(); return k.v === "-" ? (x) => -a(x) : a; } return pPow(); }
    function pPow() { const b = pPost(); const k = peek(); if (k && k.t === "op" && k.v === "^") { i++; const e = pUnary(); return (x) => gpow(b(x), e(x)); } return b; }
    function pPost() { let a = pPrim(); while (peek() && peek().t === "!") { i++; const l = a; a = (x) => gfact(l(x)); } return a; }
    function pPrim() {
      const k = toks[i++];
      if (!k) throw new Error("Incomplete expression");
      if (k.t === "num") { const v = k.v; return () => v; }
      if (k.t === "(") { const a = pExpr(); expect(")"); return a; }
      if (k.t === "|") { absDepth++; const a = pExpr(); absDepth--; expect("|"); return (x) => Math.abs(a(x)); }
      if (k.t === "id") {
        const n = k.v;
        if (n === "x") { if (opt.noX) throw new Error("x isn't allowed here"); return (x) => x; }
        if (n === "pi") return () => Math.PI;
        if (n === "e") return () => Math.E;
        if (n === "tau") return () => 2 * Math.PI;
        const f = FN[n]; let args;
        if (peek() && peek().t === "(") {
          i++; args = [pExpr()];
          while (peek() && peek().t === ",") { i++; args.push(pExpr()); }
          expect(")");
        } else args = [pPow()];
        const ar = ARITY[n] || [1, 1];
        if (args.length < ar[0] || args.length > ar[1]) throw new Error(n + "() takes " + (ar[0] === ar[1] ? ar[0] : ar[0] + "–" + ar[1]) + " argument" + (ar[1] > 1 ? "s" : ""));
        if (args.length === 1) { const a0 = args[0]; return (x) => f(a0(x)); }
        if (args.length === 2) { const a0 = args[0], a1 = args[1]; return (x) => f(a0(x), a1(x)); }
        return (x) => f.apply(null, args.map((a) => a(x)));
      }
      throw new Error("Unexpected “" + (k.v || k.t) + "”");
    }
    const f = pExpr();
    if (i < toks.length) throw new Error("Unexpected “" + (toks[i].v || toks[i].t) + "”");
    return f;
  }
  function analyzeFn(f, a, b, N) {
    N = N || 800;
    const xs = [], ys = [], span = b - a;
    for (let k = 0; k <= N; k++) { const x = a + (span * k) / N; xs.push(x); ys.push(f(x)); }
    const roots = [], mins = [], maxs = [], near = (arr, x) => arr.some((p) => Math.abs(p.x - x) < span * 1e-6);
    for (let k = 0; k < N; k++) {
      const y0 = ys[k], y1 = ys[k + 1];
      if (!isFinite(y0) || !isFinite(y1)) continue;
      if (y0 === 0) { if (!near(roots, xs[k])) roots.push({ x: xs[k], y: 0 }); continue; }
      if (y0 * y1 < 0) {
        let lo = xs[k], hi = xs[k + 1], flo = y0;
        for (let it = 0; it < 80; it++) { const mid = (lo + hi) / 2, fm = f(mid); if (!isFinite(fm)) break; if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid; }
        const r = (lo + hi) / 2, fr = f(r);
        if (isFinite(fr) && Math.abs(fr) <= 1e-6 * (1 + Math.min(Math.abs(y0), Math.abs(y1))) && !near(roots, r)) roots.push({ x: r, y: 0 });
      }
    }
    if (isFinite(ys[N]) && ys[N] === 0 && !near(roots, xs[N])) roots.push({ x: xs[N], y: 0 });
    for (let k = 1; k < N; k++) {
      const y0 = ys[k - 1], y1 = ys[k], y2 = ys[k + 1];
      if (!isFinite(y0) || !isFinite(y1) || !isFinite(y2)) continue;
      const isMax = y1 >= y0 && y1 >= y2 && (y1 > y0 || y1 > y2), isMin = y1 <= y0 && y1 <= y2 && (y1 < y0 || y1 < y2);
      if (!isMax && !isMin) continue;
      let lo = xs[k - 1], hi = xs[k + 1]; const g = isMax ? (x) => -f(x) : f, gr = (Math.sqrt(5) - 1) / 2;
      let c = hi - gr * (hi - lo), d = lo + gr * (hi - lo);
      for (let it = 0; it < 80; it++) { if (g(c) < g(d)) hi = d; else lo = c; c = hi - gr * (hi - lo); d = lo + gr * (hi - lo); }
      const q = span * 1e-7, x = Math.round((lo + hi) / 2 / q) * q || 0, y = f(x);
      if (!isFinite(y)) continue;
      // discard spikes at discontinuities (e.g. tan, 1/x)
      if (Math.abs(y) > 1e6 * (1 + Math.abs(y0) + Math.abs(y2))) continue;
      const list = isMax ? maxs : mins;
      if (!near(list, x)) list.push({ x, y });
    }
    let yint = null;
    if (a <= 0 && b >= 0) { const y = f(0); if (isFinite(y)) yint = { x: 0, y }; }
    return { roots: roots.slice(0, 20), mins: mins.slice(0, 20), maxs: maxs.slice(0, 20), yint };
  }
  const fmtG = (v) => {
    if (!isFinite(v)) return "undefined";
    if (Math.abs(v) < 1e-10) return "0";
    const a = Math.abs(v);
    if (a >= 1e7 || a < 1e-4) return v.toExponential(4).replace(/\.?0+e/, "e").replace("e+", "e");
    return String(Number(v.toPrecision(6)));
  };

  /* ======================================================================
     9. UI
     ====================================================================== */
  const ICONS = {
    menu: "M3.5 6h17M3.5 12h17M3.5 18h17",
    history: "M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5v4h4M12 7.5V12l3 2",
    standard: "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 7h7M8.5 12h.5M12 12h.5M15.5 12h.5M8.5 16h.5M12 16h.5M15.5 16h.5",
    scientific: "M9 3h6M10 3v6l-5.4 9.3A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.6-2.7L14 9V3M7.3 15h9.4",
    graphing: "M3.5 3.5v17h17M7 15.5l3.5-4.5 3 3L19 7",
    programmer: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
    date: "M4.5 5.5h15v14h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4",
    currency: "M12 3v18M16 7h-5.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H8",
    volume: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
    length: "M3 16.5L16.5 3l4.5 4.5L7.5 21zM7 12.5l2 2M10 9.5l2 2M13 6.5l2 2",
    weight: "M6 8.5h12l2 11.5H4zM9 8.5a3 3 0 0 1 6 0",
    temperature: "M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0z",
    energy: "M13 2.5L4.5 13.5h6.5l-1 8 8.5-11h-6.5z",
    area: "M4 4h16v16H4zM4 4l16 16M12 4l8 8M4 12l8 8",
    speed: "M12 14.5l4-4.5M3.5 17.5a8.5 8.5 0 1 1 17 0",
    time: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 3",
    power: "M12 3v8.5M6.3 6.8a8 8 0 1 0 11.4 0",
    data: "M4.5 6c0-1.7 3.4-3 7.5-3s7.5 1.3 7.5 3-3.4 3-7.5 3-7.5-1.3-7.5-3zM4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3",
    pressure: "M3.5 18a8.5 8.5 0 1 1 17 0M12 18l3.5-6.5",
    angle: "M4 20h16M4 20L16 5M9.5 20a5.5 5.5 0 0 0-2-4.2",
    chev: "M6 9l6 6 6-6",
    trash: "M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5",
    swap: "M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4",
    keypad: "M5 5h3v3H5zM10.5 5h3v3h-3zM16 5h3v3h-3zM5 10.5h3v3H5zM10.5 10.5h3v3h-3zM16 10.5h3v3h-3zM5 16h3v3H5zM10.5 16h3v3h-3zM16 16h3v3h-3z",
    bits: "M4 7h3M9 7h3M14 7h1.5M18 7h2M4 12h1.5M8 12h3M13 12h3M18.5 12h1.5M4 17h3M9.5 17h1.5M13 17h3M18 17h2",
    zin: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.8-4.8M7.5 10.5h6M10.5 7.5v6",
    zout: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.8-4.8M7.5 10.5h6",
    fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 12h6M12 9v6",
    trace: "M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    kp: "M3.5 20.5c3-9 6-14 8.5-14s5.5 5 8.5 14M12 4.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5.5 15.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
    x: "M6 6l12 12M18 6L6 18",
    enter: "M19 5v7a3 3 0 0 1-3 3H5M9 11l-4 4 4 4",
    copy: "M9 9h11v11H9zM5 15H4V4h11v1",
    paste: "M9 4h6v3H9zM7 5.5H5v15h14v-15h-2",
  };
  const ic = (n, c) => `<svg class="cx-svg${c ? " " + c : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hEl = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  function isTop(win) {
    if (!win || !win.isConnected || win.style.display === "none") return false;
    let max = -Infinity, top = null;
    document.querySelectorAll("#screen > .win").forEach((w) => { if (w.style.display === "none") return; const z = +w.style.zIndex || 0; if (z >= max) { max = z; top = w; } });
    return top === null ? true : top === win;
  }
  const typingTarget = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

  const NAV = [
    { h: "Calculator" },
    { id: "standard", name: "Standard", ic: "standard" }, { id: "scientific", name: "Scientific", ic: "scientific" },
    { id: "graphing", name: "Graphing", ic: "graphing" }, { id: "programmer", name: "Programmer", ic: "programmer" },
    { id: "date", name: "Date calculation", ic: "date" },
    { h: "Converter" },
  ].concat(CONV_ORDER.map((c) => ({ id: "conv:" + c, name: CONV[c].name, ic: c === "weight" ? "weight" : c })));
  const modeName = (m) => (NAV.find((n) => n.id === m) || { name: "Standard" }).name;
  const DARK_LINE = { "#0063B1": "#4BA8F0", "#6B6B6B": "#A8A8A8", "#8764B8": "#A98BDB" };
  const GCOLORS = ["#0063B1", "#E81123", "#107C10", "#8764B8", "#CA5010", "#00B7C3", "#C239B3", "#6B6B6B"];

  function getState() {
    const S = window.State && State.data ? State.data : { appData: {} };
    S.appData = S.appData || {};
    let st = S.appData.calculator;
    if (!st || typeof st !== "object" || Array.isArray(st)) st = S.appData.calculator = {};
    if (!NAV.some((n) => n.id && n.id === st.mode)) st.mode = "standard";
    if (!Array.isArray(st.history)) st.history = [];
    if (!Array.isArray(st.memory)) st.memory = [];
    if (!/^(deg|rad|grad)$/.test(st.angle)) st.angle = "deg";
    st.fe = !!st.fe;
    if (!st.prog || typeof st.prog !== "object") st.prog = {};
    const P = st.prog;
    if (![2, 8, 10, 16].includes(P.radix)) P.radix = 10;
    if (![8, 16, 32, 64].includes(P.word)) P.word = 64;
    if (!/^(arith|logic|rot|rotc)$/.test(P.shift)) P.shift = "arith";
    if (!Array.isArray(P.memory)) P.memory = [];
    if (!st.conv || typeof st.conv !== "object") st.conv = {};
    if (!st.graph || typeof st.graph !== "object") st.graph = {};
    if (!Array.isArray(st.graph.fns)) st.graph.fns = [];
    if (!st.date || typeof st.date !== "object") st.date = {};
    return st;
  }

  function openCalculator() {
    const st = getState();
    let saveT = 0;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { window.State && State.save && State.save(); } catch (e) {} }, 200); };
    const graphSize = () => ({ w: Math.min(980, innerWidth - 24), h: Math.min(660, innerHeight - 110) });
    const big = st.mode === "graphing";
    const ref = WM.createWindow({ title: "Calculator", icon: Icon.mini("calculator", "Calculator"), width: big ? graphSize().w : Math.min(400, innerWidth - 24), height: big ? graphSize().h : Math.min(640, innerHeight - 110), appId: "calculator" });
    const body = ref.body, winEl = body.closest(".win") || body.parentElement;
    body.classList.add("cx-host");
    body.innerHTML = `<div class="cx-app">
      <header class="cx-head">
        <button class="cx-ib cx-burger" type="button" title="Open Navigation" aria-label="Open Navigation" aria-expanded="false">${ic("menu")}</button>
        <h1 class="cx-title">Standard</h1>
        <span class="cx-grow"></span>
        <button class="cx-ib cx-histbtn" type="button" title="History (Ctrl+H)" aria-label="Open history and memory">${ic("history")}</button>
      </header>
      <div class="cx-body">
        <main class="cx-main"></main>
        <aside class="cx-side" hidden>
          <div class="cx-side-tabs" role="tablist"></div>
          <div class="cx-side-list"></div>
          <div class="cx-side-foot"><button class="cx-ib cx-side-clear" type="button" title="Clear all" aria-label="Clear all">${ic("trash")}</button></div>
        </aside>
      </div>
      <div class="cx-scrim" hidden></div>
      <nav class="cx-nav" aria-label="Calculator modes" aria-hidden="true">
        <div class="cx-nav-head"><button class="cx-ib cx-nav-close" type="button" title="Close Navigation" aria-label="Close Navigation">${ic("menu")}</button></div>
        <div class="cx-nav-list">${NAV.map((n) => (n.h ? `<div class="cx-nav-h">${n.h}</div>` : `<button class="cx-nav-i" type="button" data-mode="${n.id}">${ic(n.ic)}<span>${esc(n.name)}</span></button>`)).join("")}</div>
      </nav>
      <div class="cx-toast" role="status" aria-live="polite" hidden></div>
    </div>`;
    const root = body.querySelector(".cx-app"), main = root.querySelector(".cx-main"), side = root.querySelector(".cx-side");
    const nav = root.querySelector(".cx-nav"), scrim = root.querySelector(".cx-scrim"), titleEl = root.querySelector(".cx-title");
    const histBtn = root.querySelector(".cx-histbtn"), burger = root.querySelector(".cx-burger");
    let view = null, mode = null, sideTab = "history", sideOpen = false, navOpen = false, pop = null;

    // ---------- shared bits ----------
    let toastT = 0;
    function toast(msg) { const t = root.querySelector(".cx-toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 1600); }
    function copyText(text) {
      if (text == null) return;
      const fallback = () => { try { const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;left:-9999px;top:0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); } catch (e) {} };
      try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(fallback); else fallback(); } catch (e) { fallback(); }
      toast("Copied " + text);
    }
    function closePop() { if (pop) { pop.remove(); pop = null; document.removeEventListener("pointerdown", popOutside, true); } }
    function popOutside(e) { if (pop && !pop.contains(e.target) && !(pop._anchor && pop._anchor.contains(e.target))) closePop(); }
    function openPop(anchor, html, onClick, cls) {
      const same = pop && pop._anchor === anchor; closePop(); if (same) return null;
      const p = hEl(`<div class="cx-pop ${cls || ""}">${html}</div>`); p._anchor = anchor; root.appendChild(p);
      const ra = anchor.getBoundingClientRect(), rr = root.getBoundingClientRect();
      const left = Math.max(6, Math.min(ra.left - rr.left, rr.width - p.offsetWidth - 6));
      let top = ra.bottom - rr.top + 4; if (top + p.offsetHeight > rr.height - 6) top = Math.max(6, ra.top - rr.top - p.offsetHeight - 4);
      p.style.left = left + "px"; p.style.top = top + "px";
      p.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && !b.disabled) onClick(b, e); });
      pop = p; setTimeout(() => document.addEventListener("pointerdown", popOutside, true), 0);
      return p;
    }
    function fitText(elm) {
      const max = parseFloat(getComputedStyle(elm).getPropertyValue("--cx-fs")) || 46;
      let s = max; elm.style.fontSize = s + "px";
      for (let g = 0; g < 40 && elm.scrollWidth > elm.clientWidth + 1 && s > 15; g++) { s -= 2; elm.style.fontSize = s + "px"; }
      elm.scrollLeft = elm.scrollWidth;
    }
    function flashKey(container, k) { const b = container.querySelector(`[data-k="${CSS.escape(k)}"]`); if (b) { b.classList.add("cx-press"); setTimeout(() => b.classList.remove("cx-press"), 130); } }
    // keypad buttons must not steal focus (so Enter never re-clicks a focused key)
    root.addEventListener("pointerdown", (e) => { const b = e.target.closest(".cx-key,.cx-tb,.cx-mk,.cx-bit"); if (b && e.pointerType !== "touch") e.preventDefault(); });
    function attachDisplayMenu(disp) {
      const show = (x, y) => {
        const p = openPop(disp, `<button type="button" data-a="copy">${ic("copy")} Copy</button><button type="button" data-a="paste">${ic("paste")} Paste</button>`, (b) => {
          closePop();
          if (b.dataset.a === "copy") copyText(view && view.copyText && view.copyText());
          else {
            try { navigator.clipboard.readText().then((t) => { if (view && view.paste) { view.paste(t); refreshAll(); } }).catch(() => toast("Allow clipboard access, or press Ctrl+V")); }
            catch (e) { toast("Press Ctrl+V to paste"); }
          }
        }, "cx-pop-menu");
        if (p && x != null) { const rr = root.getBoundingClientRect(); p.style.left = Math.max(6, Math.min(x - rr.left, rr.width - p.offsetWidth - 6)) + "px"; p.style.top = Math.max(6, Math.min(y - rr.top, rr.height - p.offsetHeight - 6)) + "px"; }
      };
      disp.addEventListener("contextmenu", (e) => { e.preventDefault(); show(e.clientX, e.clientY); });
      let lp = 0, sx = 0, sy = 0;
      disp.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") return; sx = e.clientX; sy = e.clientY; clearTimeout(lp); lp = setTimeout(() => show(sx, sy), 550); });
      disp.addEventListener("pointermove", (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clearTimeout(lp); });
      ["pointerup", "pointercancel", "pointerleave"].forEach((t) => disp.addEventListener(t, () => clearTimeout(lp)));
    }
    function parsePastedR(text) {
      const t = String(text || "").trim().replace(/[,\s]/g, "").replace(/[−–]/g, "-");
      if (!t) return null;
      if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return parseR(t);
      try { const v = compileExpr(t, { noX: true })(0); if (isFinite(v)) return fromNum(v, 15); } catch (e) {}
      return null;
    }

    // ---------- history / memory side panel ----------
    function renderSide() {
      const sd = view && view.side;
      if (!sd) { side.hidden = true; return; }
      side.hidden = false;
      if (!sd.tabs.includes(sideTab)) sideTab = sd.tabs[0];
      const tabs = side.querySelector(".cx-side-tabs"), list = side.querySelector(".cx-side-list"), clr = side.querySelector(".cx-side-clear");
      tabs.innerHTML = sd.tabs.map((t) => `<button type="button" role="tab" class="cx-side-tab${t === sideTab ? " on" : ""}" data-tab="${t}" aria-selected="${t === sideTab}">${t === "history" ? "History" : "Memory"}</button>`).join("");
      const items = sideTab === "history" ? sd.history() : sd.memory();
      clr.hidden = !items.length;
      clr.title = sideTab === "history" ? "Clear all history" : "Clear all memory";
      list.innerHTML = items.length ? "" : `<div class="cx-side-empty">${sideTab === "history" ? "There's no history yet" : "There's nothing saved in memory"}</div>`;
      items.forEach((it, i) => {
        const row = hEl(`<div class="cx-side-item" role="button" tabindex="0" data-i="${i}">
          ${it.expr != null ? `<div class="cx-side-expr">${esc(it.expr)}</div>` : ""}
          <div class="cx-side-val">${esc(it.val)}</div>
          ${it.mem ? `<div class="cx-side-acts"><button type="button" class="cx-mk" data-m="MC">MC</button><button type="button" class="cx-mk" data-m="M+">M+</button><button type="button" class="cx-mk" data-m="M−">M−</button></div>` : ""}
        </div>`);
        row.addEventListener("click", (e) => {
          const mb = e.target.closest("[data-m]");
          if (mb) { e.stopPropagation(); sd.memAction(i, mb.dataset.m); }
          else { it.pick(); if (!root.classList.contains("cx-wide")) setSide(false); }
          refreshAll();
        });
        list.appendChild(row);
      });
    }
    side.addEventListener("click", (e) => {
      const t = e.target.closest(".cx-side-tab");
      if (t) { sideTab = t.dataset.tab; renderSide(); return; }
      if (e.target.closest(".cx-side-clear") && view && view.side) { view.side.clear(sideTab); refreshAll(); }
    });
    function setSide(open, tab) {
      if (tab) sideTab = tab;
      sideOpen = !!open && !root.classList.contains("cx-wide");
      root.classList.toggle("cx-side-open", sideOpen);
      scrim.hidden = !(sideOpen || navOpen);
      renderSide();
    }
    histBtn.addEventListener("click", () => setSide(!sideOpen, "history"));

    // ---------- navigation ----------
    function setNav(open) {
      navOpen = open; nav.classList.toggle("open", open); nav.setAttribute("aria-hidden", String(!open)); burger.setAttribute("aria-expanded", String(open));
      scrim.hidden = !(sideOpen || navOpen);
      if (open) { const cur = nav.querySelector(".cx-nav-i.on"); if (cur) cur.scrollIntoView({ block: "nearest" }); }
    }
    burger.addEventListener("click", () => setNav(!navOpen));
    nav.querySelector(".cx-nav-close").addEventListener("click", () => setNav(false));
    scrim.addEventListener("click", () => { setNav(false); setSide(false); });
    nav.addEventListener("click", (e) => { const b = e.target.closest(".cx-nav-i"); if (!b) return; setNav(false); if (b.dataset.mode !== mode) setMode(b.dataset.mode); });

    function layout() {
      const w = root.clientWidth, hgt = root.clientHeight;
      const wide = w >= 640 && !!(view && view.side);
      root.classList.toggle("cx-wide", wide);
      root.classList.toggle("cx-narrow", w < 360);
      root.classList.toggle("cx-compact", w < 680);
      root.classList.toggle("cx-short", hgt < 520);
      root.classList.toggle("cx-tiny", hgt < 420);
      histBtn.hidden = !(view && view.side && view.side.tabs.includes("history")) || wide;
      if (wide && sideOpen) { sideOpen = false; root.classList.remove("cx-side-open"); scrim.hidden = !navOpen; }
      if (view && view.resize) view.resize();
    }
    function refreshAll() { if (view && view.refresh) view.refresh(); renderSide(); }

    function ensureGraphSize() {
      if (!winEl || winEl.classList.contains("maximized")) return;
      const r = winEl.getBoundingClientRect(); if (r.width >= 700) return;
      const g = graphSize();
      winEl.style.width = g.w + "px"; winEl.style.height = g.h + "px";
      const nr = winEl.getBoundingClientRect();
      if (nr.right > innerWidth - 4) winEl.style.left = Math.max(4, (parseFloat(winEl.style.left) || nr.left) - (nr.right - innerWidth + 8)) + "px";
      if (nr.bottom > innerHeight - 50) winEl.style.top = Math.max(4, (parseFloat(winEl.style.top) || nr.top) - (nr.bottom - innerHeight + 56)) + "px";
    }

    let carry = null;
    function setMode(m) {
      closePop();
      if (view && view.carry) carry = view.carry();
      if (view && view.destroy) view.destroy();
      mode = m; st.mode = m; save();
      main.innerHTML = "";
      root.dataset.mode = m.split(":")[0];
      titleEl.textContent = modeName(m);
      nav.querySelectorAll(".cx-nav-i").forEach((b) => { b.classList.toggle("on", b.dataset.mode === m); b.setAttribute("aria-current", b.dataset.mode === m ? "page" : "false"); });
      if (m === "standard" || m === "scientific") view = CalcView(m, carry);
      else if (m === "programmer") view = ProgView();
      else if (m === "graphing") { ensureGraphSize(); view = GraphView(); }
      else if (m === "date") view = DateView();
      else view = ConvView(m.slice(5));
      main.appendChild(view.el);
      setSide(false);
      layout();
      refreshAll();
    }

    // ---------- Standard & Scientific ----------
    function addHistory(expr, r) { st.history.unshift({ e: expr, r: ser(r) }); if (st.history.length > 100) st.history.length = 100; save(); renderSide(); }
    function CalcView(kind, carryVal) {
      const sci = kind === "scientific", sig = sci ? 32 : 16;
      let second = false, hyp = false, trigInv = false;
      const eng = makeRatEngine(kind, { fe: () => st.fe, onResult: addHistory });
      if (carryVal && carryVal.r) eng.setValue(carryVal.r);
      const fmtV = (r) => fmtR(r, { sig, group: true, fe: sci && st.fe });
      const K = (label, k, type, label2, k2) => ({ label, k: k || label, type: type || "num", label2, k2 });
      const STD = [K("%", "pct", "fn"), K("CE", "ce", "fn"), K("C", "clear", "fn"), K("⌫", "back", "fn"),
        K("<sup>1</sup>&frasl;<sub>x</sub>", "inv", "fn"), K("x<sup>2</sup>", "sqr", "fn"), K("<sup>2</sup>√x", "sqrt", "fn"), K("÷", "÷", "op"),
        K("7"), K("8"), K("9"), K("×", "×", "op"), K("4"), K("5"), K("6"), K("−", "−", "op"), K("1"), K("2"), K("3"), K("+", "+", "op"),
        K("+/−", "neg"), K("0"), K("."), K("=", "=", "eq")];
      const SCI = [K("2<sup>nd</sup>", "2nd", "fn"), K("π", "pi", "fn"), K("e", "e", "fn"), K("C", "clr", "fn"), K("⌫", "back", "fn"),
        K("x<sup>2</sup>", "sqr", "fn", "x<sup>3</sup>", "cube"), K("<sup>1</sup>&frasl;<sub>x</sub>", "inv", "fn"), K("|x|", "abs", "fn"), K("exp", "exp", "fn"), K("mod", "mod", "fn"),
        K("<sup>2</sup>√x", "sqrt", "fn", "<sup>3</sup>√x", "cbrt"), K("(", "(", "fn"), K(")", ")", "fn"), K("n!", "fact", "fn"), K("÷", "÷", "op"),
        K("x<sup>y</sup>", "^", "fn", "<sup>y</sup>√x", "yroot"), K("7"), K("8"), K("9"), K("×", "×", "op"),
        K("10<sup>x</sup>", "pow10", "fn", "2<sup>x</sup>", "pow2"), K("4"), K("5"), K("6"), K("−", "−", "op"),
        K("log", "log", "fn", "log<sub>y</sub>x", "logy"), K("1"), K("2"), K("3"), K("+", "+", "op"),
        K("ln", "ln", "fn", "e<sup>x</sup>", "expe"), K("+/−", "neg"), K("0"), K("."), K("=", "=", "eq")];
      const keys = sci ? SCI : STD;
      const ARIA = { pct: "Percent", ce: "Clear entry", clear: "Clear", clr: "Clear", back: "Backspace", inv: "Reciprocal", sqr: "Square", cube: "Cube", sqrt: "Square root", cbrt: "Cube root", "÷": "Divide by", "×": "Multiply by", "−": "Minus", "+": "Plus", neg: "Positive negative", ".": "Decimal separator", "=": "Equals", "2nd": "Second function", pi: "Pi", e: "Euler's number", abs: "Absolute value", exp: "Scientific notation", mod: "Modulo", "(": "Left parenthesis", ")": "Right parenthesis", fact: "Factorial", "^": "X to the exponent", yroot: "Y root of x", pow10: "Ten to the exponent", pow2: "Two to the exponent", log: "Log", logy: "Log base y", ln: "Natural log", expe: "E to the exponent" };
      const el = hEl(`<div class="cx-calc ${sci ? "cx-sci" : "cx-std"}">
        <div class="cx-disp" aria-live="polite"><div class="cx-expr"></div><div class="cx-val">0</div></div>
        ${sci ? `<div class="cx-sbar"><button type="button" class="cx-tb" data-k="angle" title="Angle unit (Ctrl+…)">DEG</button><button type="button" class="cx-tb" data-k="fe" title="Scientific notation (F-E)">F-E</button></div>` : ""}
        <div class="cx-mrow">${["MC", "MR", "M+", "M−", "MS", "M▾"].map((m) => `<button type="button" class="cx-tb cx-mb" data-k="${m}" title="${{ MC: "Clear all memory (Ctrl+L)", MR: "Memory recall (Ctrl+R)", "M+": "Memory add (Ctrl+P)", "M−": "Memory subtract (Ctrl+Q)", MS: "Memory store (Ctrl+M)", "M▾": "Memory" }[m]}">${m === "M▾" ? `M${ic("chev", "cx-svg-s")}` : m}</button>`).join("")}</div>
        ${sci ? `<div class="cx-frow"><button type="button" class="cx-tb cx-dd" data-dd="trig">${ic("angle")}<span>Trigonometry</span>${ic("chev", "cx-svg-s")}</button><button type="button" class="cx-tb cx-dd" data-dd="func"><i class="cx-fx">f</i><span>Function</span>${ic("chev", "cx-svg-s")}</button></div>` : ""}
        <div class="cx-pad ${sci ? "cx-pad-sci" : "cx-pad-std"}">${keys.map((k) => `<button type="button" class="cx-key cx-${k.type}" data-k="${esc(k.k)}"${k.k2 ? ` data-k1="${esc(k.k)}" data-k2="${esc(k.k2)}"` : ""} aria-label="${ARIA[k.k] || k.k}">${k.label}</button>`).join("")}</div>
      </div>`);
      const valEl = el.querySelector(".cx-val"), exprEl = el.querySelector(".cx-expr"), pad = el.querySelector(".cx-pad");
      attachDisplayMenu(el.querySelector(".cx-disp"));
      const ANG_SUB = { deg: "₀", rad: "ᵣ", grad: "₉" };
      function trigKey(base) {
        const nm = hyp ? base + "h" : base;
        if (trigInv) {
          const inm = "a" + nm;
          return () => eng.unary(hyp ? (r) => hypR(inm, r) : (r) => atrigR(inm, r, st.angle), (x) => nm + (hyp ? "" : ANG_SUB[st.angle]) + "⁻¹(" + x + ")");
        }
        return () => eng.unary(hyp ? (r) => hypR(nm, r) : (r) => trigR(nm, r, st.angle), (x) => nm + (hyp ? "" : ANG_SUB[st.angle]) + "(" + x + ")");
      }
      const UN = {
        inv: [(r) => div(ONE, r), (x) => "1/(" + x + ")"], sqr: [(r) => mul(r, r), "sqr"], cube: [(r) => mul(mul(r, r), r), "cube"],
        sqrt: [sqrtR, "√"], cbrt: [cbrtR, "cuberoot"], abs: [absR, "abs"], floor: [floorR, "floor"], ceil: [ceilR, "ceil"], fact: [factR, "fact"],
        pow10: [pow10R, "10^"], pow2: [pow2R, "2^"], expe: [expR, "e^"], log: [log10R, "log"], ln: [lnR, "ln"], dms: [toDms, "dms"], deg: [fromDms, "degrees"],
      };
      const ERR_OK = /^(\d|\.|clear|ce|clr|back|=|pi|e|MC|M▾|2nd|angle|fe)$/;
      function memVal() { eng.commit(); return eng.value(); }
      function memAction(i, m) {
        const v = eng.value(), cur = deser(st.memory[i]);
        try {
          if (m === "MC") st.memory.splice(i, 1);
          else if (m === "M+") st.memory[i] = ser(add(cur, v));
          else if (m === "M−") st.memory[i] = ser(sub(cur, v));
        } catch (e) { if (!e.calc) throw e; toast(e.message); }
        save();
      }
      function press(k) {
        if (eng.s.err && !ERR_OK.test(k)) return;
        if (/^\d$/.test(k)) eng.digit(k);
        else if (k === ".") eng.dot();
        else if (["+", "−", "×", "÷", "mod", "^", "yroot", "logy"].includes(k)) eng.binary(k);
        else if (k === "=") eng.equals();
        else if (k === "neg") eng.negate();
        else if (k === "ce") eng.ce();
        else if (k === "clear") eng.clear();
        else if (k === "clr") { if (eng.showCE()) eng.ce(); else eng.clear(); }
        else if (k === "back") eng.back();
        else if (k === "pct") eng.percent();
        else if (k === "(") eng.lparen();
        else if (k === ")") eng.rparen();
        else if (k === "exp") eng.exp();
        else if (k === "pi") eng.setValue(PI_R, "π");
        else if (k === "e") eng.setValue(E_R, "e");
        else if (k === "rand") eng.setValue(randR());
        else if (UN[k]) eng.unary(UN[k][0], UN[k][1]);
        else if (/^(sin|cos|tan|sec|csc|cot)$/.test(k)) trigKey(k)();
        else if (k === "2nd") second = !second;
        else if (k === "angle") { st.angle = { deg: "rad", rad: "grad", grad: "deg" }[st.angle]; save(); }
        else if (k === "fe") { st.fe = !st.fe; save(); }
        else if (k === "MS") { st.memory.unshift(ser(memVal())); save(); }
        else if (k === "M+") { const v = memVal(); if (!st.memory.length) st.memory.unshift(ser(v)); else memAction(0, "M+"); save(); }
        else if (k === "M−") { const v = memVal(); if (!st.memory.length) st.memory.unshift(ser(neg(v))); else memAction(0, "M−"); save(); }
        else if (k === "MR") { if (st.memory.length) eng.setValue(deser(st.memory[0])); }
        else if (k === "MC") { st.memory = []; save(); }
        else if (k === "M▾") { if (root.classList.contains("cx-wide")) { sideTab = "memory"; } else setSide(!sideOpen || sideTab !== "memory", "memory"); }
        else return false;
        return true;
      }
      function onClickKey(b) { const k = b.dataset.k; if (b.disabled) return; if (k === "angle" || k === "fe" || k === "2nd") { press(k); refresh(); return; } press(k); refreshAll(); }
      el.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-k]"); if (b) { onClickKey(b); return; }
        const dd = e.target.closest("[data-dd]"); if (!dd) return;
        if (dd.dataset.dd === "trig") {
          const draw = () => `<div class="cx-pop-row"><button type="button" class="cx-tb${trigInv ? " on" : ""}" data-t="inv">2<sup>nd</sup></button><button type="button" class="cx-tb${hyp ? " on" : ""}" data-t="hyp">hyp</button></div>
            <div class="cx-pop-grid">${["sin", "cos", "tan", "sec", "csc", "cot"].map((t) => `<button type="button" class="cx-key cx-fn" data-t="${t}">${t}${hyp ? "h" : ""}${trigInv ? "<sup>-1</sup>" : ""}</button>`).join("")}</div>`;
          const p = openPop(dd, draw(), (b) => {
            const t = b.dataset.t;
            if (t === "inv") trigInv = !trigInv; else if (t === "hyp") hyp = !hyp;
            else { press(t); closePop(); refreshAll(); return; }
            if (pop) pop.innerHTML = draw();
          }, "cx-pop-trig");
          if (p) p.setAttribute("aria-label", "Trigonometry");
        } else {
          openPop(dd, `<div class="cx-pop-grid">${[["|x|", "abs"], ["⌊x⌋", "floor"], ["⌈x⌉", "ceil"], ["rand", "rand"], ["→dms", "dms"], ["→deg", "deg"]].map(([l, t]) => `<button type="button" class="cx-key cx-fn" data-t="${t}">${l}</button>`).join("")}</div>`, (b) => { press(b.dataset.t); closePop(); refreshAll(); }, "cx-pop-func");
        }
      });
      function refresh() {
        valEl.textContent = eng.display();
        exprEl.textContent = eng.exprText();
        el.classList.toggle("cx-err", !!eng.s.err);
        pad.querySelectorAll("[data-k1]").forEach((b) => {
          const k = second ? b.dataset.k2 : b.dataset.k1; b.dataset.k = k; const def = keys.find((x) => x.k === b.dataset.k1);
          b.innerHTML = second ? def.label2 : def.label; b.setAttribute("aria-label", ARIA[k] || k);
        });
        const sb = pad.querySelector('[data-k="2nd"]'); if (sb) sb.classList.toggle("on", second);
        const clr = pad.querySelector('[data-k="clr"]'); if (clr) { clr.textContent = eng.showCE() ? "CE" : "C"; clr.setAttribute("aria-label", eng.showCE() ? "Clear entry" : "Clear"); }
        const lp = pad.querySelector('[data-k="("]'); if (lp) lp.innerHTML = eng.openParens() ? `(<sub>${eng.openParens()}</sub>` : "(";
        const ab = el.querySelector('[data-k="angle"]'); if (ab) ab.textContent = st.angle.toUpperCase();
        const fb = el.querySelector('[data-k="fe"]'); if (fb) fb.classList.toggle("on", st.fe);
        const err = !!eng.s.err;
        el.querySelectorAll(".cx-key,.cx-mb,.cx-dd").forEach((b) => { b.disabled = err && !ERR_OK.test(b.dataset.k || ""); });
        ["MC", "MR", "M▾"].forEach((m) => { const b = el.querySelector(`[data-k="${m}"]`); if (b) b.disabled = (err && m !== "MC" && m !== "M▾") || !st.memory.length; });
        fitText(valEl);
      }
      const KEYMAP = { "*": "×", x: "×", X: "×", "/": "÷", "-": "−", "+": "+", "=": "=", Enter: "=", ".": ".", ",": ".", Backspace: "back", Escape: "clear", Delete: "ce", "%": sci ? "mod" : "pct", F9: "neg", r: "inv", R: "inv", "@": "sqrt", q: "sqr", Q: "sqr" };
      const SCI_KEYMAP = { "^": "^", y: "^", "(": "(", ")": ")", "!": "fact", s: "sin", S: "sin", o: "cos", O: "cos", t: "tan", T: "tan", l: "log", L: "log", n: "ln", N: "ln", p: "pi", P: "pi", e: "e", "#": "cube", "|": "abs", E: "exp", m: "mod", M: "mod" };
      function onKey(e) {
        const mod = e.ctrlKey || e.metaKey;
        if (mod) {
          const k = e.key.toLowerCase();
          const map = { m: "MS", r: "MR", p: "M+", q: "M−", l: "MC" };
          if (map[k]) { press(map[k]); refreshAll(); return true; }
          return false;
        }
        if (e.altKey) return false;
        let k = /^\d$/.test(e.key) ? e.key : KEYMAP[e.key];
        if (!k && sci) k = SCI_KEYMAP[e.key];
        if (e.key === "x" && sci) k = "×";
        if (!k) return false;
        if (k === "e" && e.shiftKey) k = "exp";
        if (second && (k === "sqr" || k === "sqrt")) k = k === "sqr" ? "cube" : "cbrt";
        if (press(k) === false) return false;
        flashKey(el, k); refreshAll(); return true;
      }
      return {
        el, refresh, onKey, carry: () => ({ r: eng.value() }),
        resize: () => fitText(valEl),
        copyText: () => (eng.s.err ? null : fmtR(eng.value(), { sig, group: false, fe: sci && st.fe })),
        paste: (t) => { const v = parsePastedR(t); if (v) { eng.setValue(v); } else toast("Invalid input — couldn't paste that"); },
        side: {
          tabs: ["history", "memory"],
          history: () => st.history.map((h) => ({ expr: h.e, val: fmtV(deser(h.r)), pick: () => eng.restore(deser(h.r), h.e) })),
          memory: () => st.memory.map((m) => ({ val: fmtV(deser(m)), mem: true, pick: () => eng.setValue(deser(m)) })),
          memAction: (i, m) => { memAction(i, m); },
          clear: (tab) => { if (tab === "history") st.history = []; else st.memory = []; save(); },
        },
        eng,
      };
    }

    // ---------- Programmer ----------
    function ProgView() {
      const P = st.prog; let carryBit = 0n, panel = "keys";
      const g = () => ({ bits: P.word, radix: P.radix, shift: P.shift });
      const eng = makeProgEngine(g);
      const WN = { 64: "QWORD", 32: "DWORD", 16: "WORD", 8: "BYTE" }, RN = { 16: "HEX", 10: "DEC", 8: "OCT", 2: "BIN" };
      const K = (label, k, type) => ({ label, k: k || label, type: type || "num" });
      const keys = [K("A"), K("<<", "lsh", "fn"), K(">>", "rsh", "fn"), K("C", "clr", "fn"), K("⌫", "back", "fn"),
        K("B"), K("(", "(", "fn"), K(")", ")", "fn"), K("%", "mod", "fn"), K("÷", "÷", "op"),
        K("C"), K("7"), K("8"), K("9"), K("×", "×", "op"), K("D"), K("4"), K("5"), K("6"), K("−", "−", "op"),
        K("E"), K("1"), K("2"), K("3"), K("+", "+", "op"), K("F"), K("+/−", "neg"), K("0"), K(".", ".", "num"), K("=", "=", "eq")];
      const el = hEl(`<div class="cx-calc cx-prog">
        <div class="cx-disp" aria-live="polite"><div class="cx-expr"></div><div class="cx-val">0</div></div>
        <div class="cx-radix" role="radiogroup" aria-label="Number base">${[16, 10, 8, 2].map((r) => `<button type="button" class="cx-rx" role="radio" data-r="${r}"><b>${RN[r]}</b><span></span></button>`).join("")}</div>
        <div class="cx-pbar">
          <button type="button" class="cx-tb cx-pv" data-v="keys" title="Full keypad" aria-label="Full keypad">${ic("keypad")}</button>
          <button type="button" class="cx-tb cx-pv" data-v="bits" title="Bit toggling keypad" aria-label="Bit toggling keypad">${ic("bits")}</button>
          <button type="button" class="cx-tb cx-word" data-k="word" title="Word size">QWORD</button>
          <span class="cx-carry" title="Carry flag (rotate through carry)"></span>
          <span class="cx-grow"></span>
          <button type="button" class="cx-tb cx-mb" data-k="MS" title="Memory store">MS</button>
          <button type="button" class="cx-tb cx-mb" data-k="M▾" title="Memory">M${ic("chev", "cx-svg-s")}</button>
        </div>
        <div class="cx-frow"><button type="button" class="cx-tb cx-dd" data-dd="bitwise"><span class="cx-gl">∧</span><span>Bitwise</span>${ic("chev", "cx-svg-s")}</button><button type="button" class="cx-tb cx-dd" data-dd="shift"><span class="cx-gl">≪</span><span>Bit shift</span>${ic("chev", "cx-svg-s")}</button></div>
        <div class="cx-pad cx-pad-prog">${keys.map((k) => `<button type="button" class="cx-key cx-${k.type}${/^[A-F]$/.test(k.k) ? " cx-hex" : ""}" data-k="${esc(k.k)}">${k.label}</button>`).join("")}</div>
        <div class="cx-bits" hidden></div>
      </div>`);
      const valEl = el.querySelector(".cx-val"), exprEl = el.querySelector(".cx-expr"), pad = el.querySelector(".cx-pad"), bitsEl = el.querySelector(".cx-bits");
      attachDisplayMenu(el.querySelector(".cx-disp"));
      // bit panel: 64 bits, 4 rows × 16
      let bh = "";
      for (let row = 0; row < 4; row++) {
        bh += `<div class="cx-bitrow">`;
        for (let grp = 0; grp < 4; grp++) {
          const hi = 63 - row * 16 - grp * 4;
          bh += `<div class="cx-bitgrp"><div class="cx-bitbtns">${[0, 1, 2, 3].map((j) => `<button type="button" class="cx-bit" data-bit="${hi - j}" aria-label="Bit ${hi - j}">0</button>`).join("")}</div><span>${hi - 3}</span></div>`;
        }
        bh += `</div>`;
      }
      bitsEl.innerHTML = bh;
      const validDigit = (d) => parseInt(d, 16) < P.radix;
      function memAction(i, m) {
        const cur = BigInt(P.memory[i]), v = eng.value();
        if (m === "MC") P.memory.splice(i, 1);
        else if (m === "M+") P.memory[i] = wrap(cur + v, P.word).toString();
        else if (m === "M−") P.memory[i] = wrap(cur - v, P.word).toString();
        save();
      }
      function unaryRot(left) {
        const rc = P.shift === "rotc";
        eng.unary((v) => { const r = rotate(v, P.word, left, rc ? carryBit : null); if (rc) carryBit = r.carry; return r.v; }, (rc ? (left ? "RoLC" : "RoRC") : left ? "RoL" : "RoR"));
      }
      function press(k) {
        if (eng.s.err && !/^([0-9A-F]|clr|back|=)$/.test(k)) return;
        if (/^[0-9A-F]$/.test(k)) { if (validDigit(k)) eng.digit(k); }
        else if (["+", "−", "×", "÷", "mod", "AND", "OR", "XOR", "NAND", "NOR"].includes(k)) eng.binary(k);
        else if (k === "lsh" || k === "rsh") { if (P.shift === "rot" || P.shift === "rotc") unaryRot(k === "lsh"); else eng.binary(k); }
        else if (k === "NOT") eng.unary((v) => wrap(~v, P.word), "NOT");
        else if (k === "=") eng.equals();
        else if (k === "neg") eng.negate();
        else if (k === "clr") { if (eng.showCE()) eng.ce(); else eng.clear(); }
        else if (k === "clear") eng.clear();
        else if (k === "ce") eng.ce();
        else if (k === "back") eng.back();
        else if (k === "(") eng.lparen();
        else if (k === ")") eng.rparen();
        else if (k === "word") { P.word = { 64: 32, 32: 16, 16: 8, 8: 64 }[P.word]; eng.mapValues((v) => wrap(v, P.word)); save(); }
        else if (k === "MS") { eng.commit(); P.memory.unshift(eng.value().toString()); save(); }
        else if (k === "M▾") setSide(!sideOpen, "memory");
        else return false;
        return true;
      }
      function setRadix(r) { eng.commit(); P.radix = r; save(); }
      el.addEventListener("click", (e) => {
        const rx = e.target.closest(".cx-rx"); if (rx) { setRadix(+rx.dataset.r); refreshAll(); return; }
        const pv = e.target.closest(".cx-pv"); if (pv) { panel = pv.dataset.v; refresh(); return; }
        const bit = e.target.closest(".cx-bit"); if (bit && !bit.disabled) {
          const i = BigInt(bit.dataset.bit); const v = wrap(uns(eng.value(), P.word) ^ (1n << i), P.word);
          eng.setValue(v, null, true); refreshAll(); return;
        }
        const b = e.target.closest("button[data-k]"); if (b && !b.disabled) { press(b.dataset.k); refreshAll(); return; }
        const dd = e.target.closest("[data-dd]"); if (!dd) return;
        if (dd.dataset.dd === "bitwise") {
          openPop(dd, `<div class="cx-pop-grid cx-pop-g3">${["AND", "OR", "NOT", "NAND", "NOR", "XOR"].map((t) => `<button type="button" class="cx-key cx-fn" data-t="${t}">${t}</button>`).join("")}</div>`, (bb) => { press(bb.dataset.t); closePop(); refreshAll(); }, "cx-pop-bitwise");
        } else {
          const opts = [["arith", "Arithmetic shift"], ["logic", "Logical shift"], ["rot", "Rotate circular shift"], ["rotc", "Rotate through carry circular shift"]];
          openPop(dd, opts.map(([v, l]) => `<button type="button" class="cx-radio${P.shift === v ? " on" : ""}" data-s="${v}" role="menuitemradio" aria-checked="${P.shift === v}"><i></i>${l}</button>`).join(""), (bb) => { P.shift = bb.dataset.s; carryBit = 0n; save(); closePop(); refresh(); }, "cx-pop-shift");
        }
      });
      function refresh() {
        const v = eng.value();
        valEl.textContent = eng.display();
        exprEl.textContent = eng.exprText();
        el.classList.toggle("cx-err", !!eng.s.err);
        el.querySelectorAll(".cx-rx").forEach((b) => {
          const r = +b.dataset.r; b.classList.toggle("on", r === P.radix); b.setAttribute("aria-checked", String(r === P.radix));
          b.querySelector("span").textContent = eng.s.err ? "" : toRadix(v, r, P.word, true);
        });
        el.querySelector(".cx-word").textContent = WN[P.word];
        const rot = P.shift === "rot" || P.shift === "rotc";
        const lsh = pad.querySelector('[data-k="lsh"]'), rsh = pad.querySelector('[data-k="rsh"]');
        lsh.textContent = rot ? "RoL" : "<<"; rsh.textContent = rot ? "RoR" : ">>";
        lsh.title = rot ? (P.shift === "rotc" ? "Rotate left through carry" : "Rotate left") : "Left shift"; rsh.title = rot ? (P.shift === "rotc" ? "Rotate right through carry" : "Rotate right") : (P.shift === "logic" ? "Logical right shift" : "Arithmetic right shift");
        el.querySelector(".cx-carry").textContent = P.shift === "rotc" ? "Carry " + carryBit : "";
        const err = !!eng.s.err;
        pad.querySelectorAll(".cx-key").forEach((b) => {
          const k = b.dataset.k;
          b.disabled = (/^[0-9A-F]$/.test(k) && !validDigit(k)) || k === "." || (err && !/^([0-9A-F]|clr|back|=)$/.test(k));
        });
        const clr = pad.querySelector('[data-k="clr"]'); clr.textContent = eng.showCE() ? "CE" : "C";
        const lp = pad.querySelector('[data-k="("]'); lp.innerHTML = eng.openParens() ? `(<sub>${eng.openParens()}</sub>` : "(";
        el.querySelectorAll(".cx-pv").forEach((b) => b.classList.toggle("on", b.dataset.v === panel));
        pad.hidden = panel !== "keys"; bitsEl.hidden = panel !== "bits";
        if (panel === "bits") { const u = uns(v, P.word); bitsEl.querySelectorAll(".cx-bit").forEach((b) => { const i = +b.dataset.bit, on = i < P.word && ((u >> BigInt(i)) & 1n) === 1n; b.textContent = on ? "1" : "0"; b.classList.toggle("on", on); b.disabled = i >= P.word; }); }
        const mb = el.querySelector('[data-k="M▾"]'); if (mb) mb.disabled = !P.memory.length;
        fitText(valEl);
      }
      const KEYMAP = { "*": "×", "/": "÷", "-": "−", "+": "+", "=": "=", Enter: "=", Backspace: "back", Escape: "clear", Delete: "ce", "%": "mod", F9: "neg", "(": "(", ")": ")", "&": "AND", "|": "OR", "^": "XOR", "~": "NOT", "<": "lsh", ">": "rsh" };
      function onKey(e) {
        if (e.ctrlKey || e.metaKey) { if (e.key.toLowerCase() === "m") { press("MS"); refreshAll(); return true; } return false; }
        if (e.altKey) return false;
        let k = /^[0-9a-f]$/i.test(e.key) ? e.key.toUpperCase() : KEYMAP[e.key];
        if (e.key === "F5") { setRadix(16); refreshAll(); return true; } if (e.key === "F6") { setRadix(10); refreshAll(); return true; }
        if (e.key === "F7") { setRadix(8); refreshAll(); return true; } if (e.key === "F8") { setRadix(2); refreshAll(); return true; }
        if (!k) return false;
        if (press(k) === false) return false;
        flashKey(el, k); refreshAll(); return true;
      }
      return {
        el, refresh, onKey, resize: () => fitText(valEl),
        copyText: () => (eng.s.err ? null : toRadix(eng.value(), P.radix, P.word, false)),
        paste: (t) => {
          let v = parseRadix(t, P.radix);
          if (v === null && P.radix === 10) { const r = parsePastedR(t); if (r) v = truncR(r).n; }
          if (v === null) { toast("Invalid input — couldn't paste that"); return; }
          eng.setValue(wrap(v, P.word));
        },
        side: {
          tabs: ["memory"],
          memory: () => P.memory.map((m) => ({ val: toRadix(BigInt(m), P.radix, P.word, true), mem: true, pick: () => eng.setValue(wrap(BigInt(m), P.word)) })),
          memAction, clear: () => { P.memory = []; save(); },
        },
        eng, setRadix,
      };
    }

    // ---------- Graphing ----------
    function GraphView() {
      const G = st.graph;
      const vw = G.view && isFinite(G.view.ppu) ? Object.assign({}, G.view) : { cx: 0, cy: 0, ppu: 0 };
      let trace = null, traceMode = false, kpOn = !!G.kp, lastIn = null, kpCache = null, kpT = 0, raf = 0;
      const comp = [];
      const opt = { deg: () => !!G.deg };
      const QUICK = [["x", "x"], ["x²", "^2"], ["xʸ", "^"], ["√", "sqrt("], ["π", "π"], ["e", "e"], ["sin", "sin("], ["cos", "cos("], ["tan", "tan("], ["ln", "ln("], ["log", "log("], ["|x|", "abs("], ["(", "("], [")", ")"]];
      const el = hEl(`<div class="cx-graph">
        <div class="cx-g-side">
          <div class="cx-g-list"></div>
          <div class="cx-g-quick" aria-label="Insert">${QUICK.map(([l, t]) => `<button type="button" class="cx-qk" data-ins="${esc(t)}">${esc(l)}</button>`).join("")}</div>
          <p class="cx-g-hint">Examples: <code>x^2-4</code>, <code>sin(x)</code>, <code>2x+1</code>, <code>|x|</code>, <code>sqrt(x)</code>, <code>ln(x)</code></p>
        </div>
        <div class="cx-g-plot">
          <canvas class="cx-g-cv" role="img" aria-label="Graph"></canvas>
          <div class="cx-g-tools">
            <button type="button" class="cx-gt" data-g="zin" title="Zoom in" aria-label="Zoom in">${ic("zin")}</button>
            <button type="button" class="cx-gt" data-g="zout" title="Zoom out" aria-label="Zoom out">${ic("zout")}</button>
            <button type="button" class="cx-gt" data-g="fit" title="Reset view" aria-label="Reset view">${ic("fit")}</button>
            <button type="button" class="cx-gt" data-g="trace" title="Trace: drag along a curve" aria-label="Trace">${ic("trace")}</button>
            <button type="button" class="cx-gt" data-g="kp" title="Show key points (roots, extrema, intercepts)" aria-label="Key points">${ic("kp")}</button>
            <button type="button" class="cx-gt cx-gt-txt" data-g="unit" title="Angle unit for trig functions">RAD</button>
          </div>
          <div class="cx-g-tip" hidden></div>
        </div>
      </div>`);
      const list = el.querySelector(".cx-g-list"), plot = el.querySelector(".cx-g-plot"), cv = el.querySelector(".cx-g-cv"), tip = el.querySelector(".cx-g-tip");
      const nextColor = () => GCOLORS.find((c) => !G.fns.some((f) => f.color === c)) || GCOLORS[G.fns.length % GCOLORS.length];
      function compile(i) { const f = G.fns[i]; try { comp[i] = { f: compileExpr(f.expr, opt), err: null }; } catch (e) { comp[i] = { f: null, err: e.message }; } }
      function compileAll() { comp.length = 0; G.fns.forEach((_, i) => compile(i)); }
      function renderList() {
        const ae = document.activeElement, focusIdx = ae && ae.classList && ae.classList.contains("cx-g-in") && list.contains(ae) ? ae.closest(".cx-g-fn").dataset.i : null;
        list.innerHTML = "";
        G.fns.forEach((f, i) => {
          const c = comp[i] || {};
          const row = hEl(`<div class="cx-g-fn${f.hidden ? " off" : ""}" data-i="${i}">
            <button type="button" class="cx-g-sw" style="--c:${f.color}" data-a="vis" title="${f.hidden ? "Show" : "Hide"} f${i + 1}" aria-pressed="${!f.hidden}">f<sub>${i + 1}</sub></button>
            <input class="cx-g-in" data-a="edit" value="${esc(f.expr)}" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Function ${i + 1}">
            <button type="button" class="cx-ib" data-a="an" title="Analyze function" aria-label="Analyze function" aria-expanded="${!!f.open}">${ic("kp")}</button>
            <button type="button" class="cx-ib" data-a="del" title="Remove function" aria-label="Remove function">${ic("x")}</button>
            <div class="cx-g-err" ${c.err ? "" : "hidden"}>${esc(c.err || "")}</div>
            <div class="cx-g-anl" ${f.open && !c.err ? "" : "hidden"}></div>
          </div>`);
          list.appendChild(row);
        });
        const n = G.fns.length;
        list.appendChild(hEl(`<div class="cx-g-fn cx-g-new" data-i="new">
          <span class="cx-g-sw" style="--c:${nextColor()}">f<sub>${n + 1}</sub></span>
          <input class="cx-g-in" data-a="new" placeholder="Enter an expression" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="New function">
          <button type="button" class="cx-ib" data-a="add" title="Add to graph" aria-label="Add to graph">${ic("enter")}</button>
          <div class="cx-g-err" hidden></div>
        </div>`));
        if (focusIdx != null) { const inp = list.querySelector(`[data-i="${focusIdx}"] .cx-g-in`); if (inp) inp.focus(); }
        renderAnalysis();
      }
      function addNew(inp) {
        const expr = inp.value.trim(); const errEl = inp.parentElement.querySelector(".cx-g-err");
        if (!expr) return;
        try { compileExpr(expr, opt); } catch (e) { errEl.hidden = false; errEl.textContent = e.message; return; }
        G.fns.push({ expr, color: nextColor(), hidden: false });
        compile(G.fns.length - 1); save(); renderList(); kpCache = null; draw();
        const ni = list.querySelector('[data-a="new"]'); if (ni) { ni.focus(); lastIn = ni; }
      }
      list.addEventListener("click", (e) => {
        const b = e.target.closest("[data-a]"); if (!b || b.tagName === "INPUT") return;
        const row = b.closest(".cx-g-fn"), i = +row.dataset.i, a = b.dataset.a;
        if (a === "add") { addNew(row.querySelector(".cx-g-in")); return; }
        if (a === "vis") G.fns[i].hidden = !G.fns[i].hidden;
        else if (a === "del") { G.fns.splice(i, 1); comp.splice(i, 1); if (trace && trace.fi === i) trace = null; else if (trace && trace.fi > i) trace.fi--; }
        else if (a === "an") G.fns[i].open = !G.fns[i].open;
        save(); kpCache = null; renderList(); draw();
      });
      list.addEventListener("focusin", (e) => { if (e.target.classList.contains("cx-g-in")) lastIn = e.target; });
      list.addEventListener("keydown", (e) => {
        if (!e.target.classList.contains("cx-g-in")) return;
        e.stopPropagation();
        if (e.key === "Enter") { e.preventDefault(); if (e.target.dataset.a === "new") addNew(e.target); else { e.target.blur(); } }
        if (e.key === "Escape") e.target.blur();
      });
      list.addEventListener("input", (e) => {
        const inp = e.target; if (!inp.classList.contains("cx-g-in")) return;
        const row = inp.closest(".cx-g-fn"), errEl = row.querySelector(".cx-g-err");
        if (inp.dataset.a === "new") { errEl.hidden = true; return; }
        const i = +row.dataset.i; G.fns[i].expr = inp.value; compile(i);
        errEl.hidden = !comp[i].err; errEl.textContent = comp[i].err || "";
        save(); kpCache = null; draw(); renderAnalysis();
      });
      el.querySelector(".cx-g-quick").addEventListener("click", (e) => {
        const b = e.target.closest("[data-ins]"); if (!b) return;
        let inp = lastIn && lastIn.isConnected ? lastIn : list.querySelector('[data-a="new"]');
        const t = b.dataset.ins, s0 = inp.selectionStart != null ? inp.selectionStart : inp.value.length, s1 = inp.selectionEnd != null ? inp.selectionEnd : s0;
        inp.value = inp.value.slice(0, s0) + t + inp.value.slice(s1); inp.focus();
        try { inp.setSelectionRange(s0 + t.length, s0 + t.length); } catch (er) {}
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      });
      el.querySelector(".cx-g-quick").addEventListener("pointerdown", (e) => { if (e.target.closest("[data-ins]")) e.preventDefault(); });

      // view transforms
      const size = () => ({ W: plot.clientWidth, H: plot.clientHeight });
      const toSX = (x, W) => (x - vw.cx) * vw.ppu + W / 2, toSY = (y, H) => H / 2 - (y - vw.cy) * vw.ppu;
      const toWX = (px, W) => vw.cx + (px - W / 2) / vw.ppu, toWY = (py, H) => vw.cy - (py - H / 2) / vw.ppu;
      function fitView() { const { W } = size(); vw.cx = 0; vw.cy = 0; vw.ppu = Math.max(8, (W || 600) / 20); }
      function saveView() { G.view = { cx: vw.cx, cy: vw.cy, ppu: vw.ppu }; save(); }
      function zoomAt(f, px, py) {
        const { W, H } = size(); const wx = toWX(px, W), wy = toWY(py, H);
        vw.ppu = Math.min(1e9, Math.max(1e-7, vw.ppu * f));
        vw.cx = wx - (px - W / 2) / vw.ppu; vw.cy = wy + (py - H / 2) / vw.ppu;
        kpCache = null; schedule(); saveView();
      }
      const niceStep = (raw) => { const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
      function tickLabel(v, step) {
        if (Math.abs(v) < step * 1e-6) return "0";
        if (step >= 1e6 || step < 1e-5) return v.toExponential(1).replace(".0e", "e").replace("e+", "e");
        const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
        return v.toFixed(d).replace("-", "−");
      }
      function computeKp() {
        const { W } = size(); const x0 = toWX(0, W), x1 = toWX(W, W);
        const out = [];
        G.fns.forEach((f, i) => {
          const c = comp[i]; if (f.hidden || !c || !c.f) return;
          const a = analyzeFn(c.f, x0, x1, 700);
          a.roots.forEach((p) => out.push({ fi: i, x: p.x, y: 0, kind: "x-intercept" }));
          a.mins.forEach((p) => out.push({ fi: i, x: p.x, y: p.y, kind: "Minimum" }));
          a.maxs.forEach((p) => out.push({ fi: i, x: p.x, y: p.y, kind: "Maximum" }));
          if (a.yint) out.push({ fi: i, x: 0, y: a.yint.y, kind: "y-intercept" });
        });
        const vis = G.fns.map((f, i) => i).filter((i) => !G.fns[i].hidden && comp[i] && comp[i].f);
        for (let p = 0; p < vis.length; p++) for (let q = p + 1; q < vis.length; q++) {
          const fa = comp[vis[p]].f, fb = comp[vis[q]].f;
          analyzeFn((x) => fa(x) - fb(x), x0, x1, 700).roots.forEach((r) => { const y = fa(r.x); if (isFinite(y)) out.push({ fi: vis[p], fj: vis[q], x: r.x, y, kind: "Intersection" }); });
        }
        kpCache = out; return out;
      }
      function renderAnalysis() {
        list.querySelectorAll(".cx-g-fn[data-i]").forEach((row) => {
          const i = +row.dataset.i, box = row.querySelector(".cx-g-anl"); if (!box || box.hidden || isNaN(i)) return;
          const c = comp[i]; if (!c || !c.f) return;
          const { W } = size(); if (!W || !vw.ppu) return; const a = analyzeFn(c.f, toWX(0, W), toWX(W, W), 700);
          const pts = (arr) => (arr.length ? arr.slice(0, 6).map((p) => `(${fmtG(p.x)}, ${fmtG(p.y)})`).join(", ") + (arr.length > 6 ? " …" : "") : "None in view");
          box.innerHTML = `<div class="cx-anl-h">Function analysis <small>(visible range)</small></div>
            <dl><dt>x-intercepts</dt><dd>${esc(pts(a.roots))}</dd><dt>y-intercept</dt><dd>${a.yint ? esc(fmtG(a.yint.y)) : "None in view"}</dd>
            <dt>Minimum</dt><dd>${esc(pts(a.mins))}</dd><dt>Maximum</dt><dd>${esc(pts(a.maxs))}</dd></dl>`;
        });
      }
      function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); clearTimeout(kpT); kpT = setTimeout(renderAnalysis, 200); }
      function draw() {
        const { W, H } = size(); if (!W || !H) return;
        if (!vw.ppu) fitView();
        const dpr = window.devicePixelRatio || 1;
        if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const dark = document.body.classList.contains("dark");
        const C = dark ? { bg: "#1f1f1f", minor: "rgba(255,255,255,.05)", major: "rgba(255,255,255,.13)", axis: "rgba(255,255,255,.75)", text: "rgba(255,255,255,.72)", halo: "#1f1f1f" }
          : { bg: "#ffffff", minor: "rgba(0,0,0,.045)", major: "rgba(0,0,0,.11)", axis: "rgba(0,0,0,.72)", text: "rgba(0,0,0,.68)", halo: "#ffffff" };
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const x0 = toWX(0, W), x1 = toWX(W, W), y0 = toWY(H, H), y1 = toWY(0, H);
        const step = niceStep(90 / vw.ppu), m = step / Math.pow(10, Math.floor(Math.log10(step) + 1e-9)), minor = step / (Math.round(m) === 2 ? 4 : 5);
        const lines = (st2, col) => {
          g.strokeStyle = col; g.lineWidth = 1; g.beginPath();
          for (let k = Math.ceil(x0 / st2); k * st2 <= x1; k++) { const X = Math.round(toSX(k * st2, W)) + 0.5; g.moveTo(X, 0); g.lineTo(X, H); }
          for (let k = Math.ceil(y0 / st2); k * st2 <= y1; k++) { const Y = Math.round(toSY(k * st2, H)) + 0.5; g.moveTo(0, Y); g.lineTo(W, Y); }
          g.stroke();
        };
        if ((x1 - x0) / minor < 600) lines(minor, C.minor);
        lines(step, C.major);
        const ax = toSX(0, W), ay = toSY(0, H);
        g.strokeStyle = C.axis; g.lineWidth = 1.25; g.beginPath();
        if (ax >= 0 && ax <= W) { g.moveTo(Math.round(ax) + 0.5, 0); g.lineTo(Math.round(ax) + 0.5, H); }
        if (ay >= 0 && ay <= H) { g.moveTo(0, Math.round(ay) + 0.5); g.lineTo(W, Math.round(ay) + 0.5); }
        g.stroke();
        g.font = "11px 'Segoe UI', system-ui, sans-serif"; g.fillStyle = C.text;
        const ly = Math.min(Math.max(ay + 4, 4), H - 16), lx = Math.min(Math.max(ax - 5, 30), W - 4);
        g.textBaseline = "top"; g.textAlign = "center";
        const halo = (t, X, Y) => { g.lineWidth = 3; g.strokeStyle = C.halo; g.strokeText(t, X, Y); g.fillText(t, X, Y); };
        for (let k = Math.ceil(x0 / step); k * step <= x1; k++) { if (k === 0) continue; const X = toSX(k * step, W); if (X < 14 || X > W - 14) continue; halo(tickLabel(k * step, step), X, ly); }
        g.textAlign = "right"; g.textBaseline = "middle";
        for (let k = Math.ceil(y0 / step); k * step <= y1; k++) { if (k === 0) continue; const Y = toSY(k * step, H); if (Y < 10 || Y > H - 10) continue; halo(tickLabel(k * step, step), lx, Y); }
        if (ax >= 0 && ax <= W && ay >= 0 && ay <= H) { g.textAlign = "right"; g.textBaseline = "top"; halo("0", ax - 5, ay + 4); }
        // curves
        G.fns.forEach((f, i) => {
          const c = comp[i]; if (f.hidden || !c || !c.f) return;
          g.strokeStyle = (dark && DARK_LINE[f.color]) || f.color; g.lineWidth = 2.25; g.lineJoin = "round"; g.beginPath();
          let pen = false, prevPy = 0, prevX = 0;
          for (let px = -1; px <= W + 1; px += 0.5) {
            const x = toWX(px, W); let y; try { y = c.f(x); } catch (e) { y = NaN; }
            if (!isFinite(y)) { pen = false; continue; }
            let py = toSY(y, H);
            if (pen && Math.abs(py - prevPy) > H * 0.5) {
              const ym = c.f((x + prevX) / 2), pym = isFinite(ym) ? toSY(ym, H) : NaN;
              if (!isFinite(pym) || (pym - prevPy) * (pym - py) > 0) pen = false;
            }
            py = Math.max(-1e5, Math.min(1e5, py));
            if (pen) g.lineTo(px, py); else g.moveTo(px, py);
            pen = true; prevPy = py; prevX = x;
          }
          g.stroke();
        });
        // key points
        if (kpOn) {
          const kps = kpCache || computeKp();
          kps.forEach((p) => {
            const X = toSX(p.x, W), Y = toSY(p.y, H); if (X < -5 || X > W + 5 || Y < -5 || Y > H + 5) return;
            g.beginPath(); g.arc(X, Y, 4.5, 0, Math.PI * 2); g.fillStyle = C.bg; g.fill(); g.lineWidth = 2; g.strokeStyle = G.fns[p.fi] ? G.fns[p.fi].color : C.axis; g.stroke();
          });
        }
        // trace marker
        tip.hidden = true;
        if (trace && G.fns[trace.fi] && comp[trace.fi] && comp[trace.fi].f && !G.fns[trace.fi].hidden) {
          const y = trace.y != null ? trace.y : comp[trace.fi].f(trace.x);
          if (isFinite(y)) {
            const X = toSX(trace.x, W), Y = toSY(y, H), col = G.fns[trace.fi].color;
            g.setLineDash([4, 4]); g.strokeStyle = col; g.globalAlpha = 0.55; g.lineWidth = 1; g.beginPath();
            g.moveTo(X, Math.max(0, Math.min(H, ay))); g.lineTo(X, Y); g.moveTo(Math.max(0, Math.min(W, ax)), Y); g.lineTo(X, Y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
            g.beginPath(); g.arc(X, Y, 5.5, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = C.bg; g.stroke();
            tip.hidden = false;
            tip.innerHTML = `<i style="background:${col}"></i><b>f<sub>${trace.fi + 1}</sub></b> ${trace.kind ? `<em>${esc(trace.kind)}</em> ` : ""}(${esc(fmtG(trace.x))}, ${esc(fmtG(y))})`;
            const tw = tip.offsetWidth, th = tip.offsetHeight;
            tip.style.left = Math.max(4, Math.min(W - tw - 4, X + 12)) + "px"; tip.style.top = Math.max(4, Math.min(H - th - 4, Y - th - 12)) + "px";
          }
        }
        el.querySelector('[data-g="trace"]').classList.toggle("on", traceMode);
        el.querySelector('[data-g="kp"]').classList.toggle("on", kpOn);
        el.querySelector('[data-g="unit"]').textContent = G.deg ? "DEG" : "RAD";
      }
      function traceAt(px, py, snap) {
        const { W, H } = size(); const x = toWX(px, W);
        if (snap !== false && kpOn) {
          const kps = kpCache || computeKp(); let best = null, bd = 14;
          kps.forEach((p) => { const d = Math.hypot(toSX(p.x, W) - px, toSY(p.y, H) - py); if (d < bd) { bd = d; best = p; } });
          if (best) { trace = { fi: best.fi, x: best.x, y: best.y, kind: best.kind }; return true; }
        }
        let bi = -1, bd = Infinity;
        G.fns.forEach((f, i) => { const c = comp[i]; if (f.hidden || !c || !c.f) return; const y = c.f(x); if (!isFinite(y)) return; const d = Math.abs(toSY(y, H) - py); if (d < bd) { bd = d; bi = i; } });
        if (bi < 0 || (!traceMode && bd > 40)) { trace = null; return false; }
        trace = { fi: bi, x, y: null, kind: null }; return true;
      }
      // pointer: drag to pan, pinch to zoom, tap/hover to trace
      const ptrs = new Map(); let drag = null, pinch = null, moved = false;
      const local = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      cv.addEventListener("pointerdown", (e) => {
        try { cv.setPointerCapture(e.pointerId); } catch (er) {}
        const p = local(e); ptrs.set(e.pointerId, p);
        if (ptrs.size === 1) { drag = { x: p.x, y: p.y, cx: vw.cx, cy: vw.cy }; moved = false; if (traceMode) { traceAt(p.x, p.y, false); draw(); } }
        else if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()]; const { W, H } = size();
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ppu: vw.ppu, wx: toWX((a.x + b.x) / 2, W), wy: toWY((a.y + b.y) / 2, H) };
          drag = null; moved = true;
        }
      });
      cv.addEventListener("pointermove", (e) => {
        const p = local(e);
        if (!ptrs.has(e.pointerId)) { if (e.pointerType === "mouse" && !traceMode) { const had = !!trace; if (traceAt(p.x, p.y) || had) draw(); } return; }
        ptrs.set(e.pointerId, p);
        const { W, H } = size();
        if (pinch && ptrs.size >= 2) {
          const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          vw.ppu = Math.min(1e9, Math.max(1e-7, pinch.ppu * (d / pinch.d)));
          vw.cx = pinch.wx - (mx - W / 2) / vw.ppu; vw.cy = pinch.wy + (my - H / 2) / vw.ppu;
          kpCache = null; schedule(); return;
        }
        if (drag) {
          if (Math.hypot(p.x - drag.x, p.y - drag.y) > 4) moved = true;
          if (traceMode) { traceAt(p.x, p.y, false); draw(); return; }
          if (moved) { vw.cx = drag.cx - (p.x - drag.x) / vw.ppu; vw.cy = drag.cy + (p.y - drag.y) / vw.ppu; kpCache = null; trace = null; schedule(); }
        }
      });
      const up = (e) => {
        const p = local(e);
        if (ptrs.has(e.pointerId) && ptrs.size === 1 && !moved && !traceMode) { traceAt(p.x, p.y); draw(); }
        ptrs.delete(e.pointerId);
        if (ptrs.size < 2) pinch = null;
        if (ptrs.size === 1) { const q = [...ptrs.values()][0]; drag = { x: q.x, y: q.y, cx: vw.cx, cy: vw.cy }; }
        if (!ptrs.size) { drag = null; saveView(); renderAnalysis(); }
      };
      cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
      cv.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !ptrs.size && !traceMode && trace && !trace.kind) { trace = null; draw(); } });
      cv.addEventListener("wheel", (e) => { e.preventDefault(); const p = local(e); const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; zoomAt(Math.exp(-dy * 0.0015), p.x, p.y); }, { passive: false });
      el.querySelector(".cx-g-tools").addEventListener("click", (e) => {
        const b = e.target.closest("[data-g]"); if (!b) return; const { W, H } = size();
        const a = b.dataset.g;
        if (a === "zin") zoomAt(1.5, W / 2, H / 2);
        else if (a === "zout") zoomAt(1 / 1.5, W / 2, H / 2);
        else if (a === "fit") { fitView(); kpCache = null; saveView(); draw(); renderAnalysis(); }
        else if (a === "trace") { traceMode = !traceMode; if (!traceMode) trace = null; draw(); }
        else if (a === "kp") { kpOn = !kpOn; G.kp = kpOn; kpCache = null; save(); draw(); }
        else if (a === "unit") { G.deg = !G.deg; save(); compileAll(); kpCache = null; draw(); renderAnalysis(); }
      });
      const ro = new ResizeObserver(() => { kpCache = null; draw(); });
      ro.observe(plot);
      compileAll(); renderList();
      return {
        el, refresh: () => { draw(); }, resize: draw,
        onKey: (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return false;
          const { W, H } = size();
          if (e.key === "+" || e.key === "=") { zoomAt(1.25, W / 2, H / 2); return true; }
          if (e.key === "-") { zoomAt(0.8, W / 2, H / 2); return true; }
          const pan = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
          if (pan) { vw.cx += (pan[0] * W) / 10 / vw.ppu; vw.cy += (pan[1] * H) / 10 / vw.ppu; kpCache = null; schedule(); saveView(); return true; }
          return false;
        },
        destroy: () => { ro.disconnect(); cancelAnimationFrame(raf); clearTimeout(kpT); },
        graph: { compileAll, view: vw, comp, computeKp, draw },
      };
    }

    // ---------- Date calculation ----------
    function DateView() {
      const D = st.date, today = (() => { const t = new Date(); return DateCalc.iso({ y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }); })();
      if (!DateCalc.parse(D.from)) D.from = today; if (!DateCalc.parse(D.to)) D.to = today; if (!DateCalc.parse(D.base)) D.base = today;
      D.mode = D.mode === "add" ? "add" : "diff"; D.op = D.op === "sub" ? "sub" : "add";
      ["y", "m", "d"].forEach((k) => { D[k] = Math.max(0, Math.min(999, parseInt(D[k], 10) || 0)); });
      const rn = "cxop" + Math.random().toString(36).slice(2, 8);
      const el = hEl(`<div class="cx-date">
        <label class="cx-fld"><span>Calculation mode</span><select class="cx-sel" data-d="mode"><option value="diff">Difference between dates</option><option value="add">Add or subtract days</option></select></label>
        <div class="cx-d-diff">
          <label class="cx-fld"><span>From</span><input type="date" class="cx-inp" data-d="from" min="1601-01-01" max="9999-12-31" required></label>
          <label class="cx-fld"><span>To</span><input type="date" class="cx-inp" data-d="to" min="1601-01-01" max="9999-12-31" required></label>
          <div class="cx-d-out"><span class="cx-d-lbl">Difference</span><div class="cx-d-big" data-o="diff"></div><div class="cx-d-small" data-o="days"></div></div>
        </div>
        <div class="cx-d-add">
          <label class="cx-fld"><span>From</span><input type="date" class="cx-inp" data-d="base" min="1601-01-01" max="9999-12-31" required></label>
          <div class="cx-d-radio" role="radiogroup"><label><input type="radio" name="${rn}" value="add" data-d="op"> Add</label><label><input type="radio" name="${rn}" value="sub" data-d="op"> Subtract</label></div>
          <div class="cx-d-nums">${[["y", "Years"], ["m", "Months"], ["d", "Days"]].map(([k, l]) => `<label class="cx-fld"><span>${l}</span><input type="number" inputmode="numeric" class="cx-inp" data-d="${k}" min="0" max="999" step="1"></label>`).join("")}</div>
          <div class="cx-d-out"><span class="cx-d-lbl">Date</span><div class="cx-d-big" data-o="date"></div></div>
        </div>
      </div>`);
      const q = (s) => el.querySelector(s);
      q('[data-d="mode"]').value = D.mode; q('[data-d="from"]').value = D.from; q('[data-d="to"]').value = D.to; q('[data-d="base"]').value = D.base;
      el.querySelectorAll('[data-d="op"]').forEach((r) => { r.checked = r.value === D.op; });
      ["y", "m", "d"].forEach((k) => { q(`[data-d="${k}"]`).value = D[k]; });
      function refresh() {
        q(".cx-d-diff").hidden = D.mode !== "diff"; q(".cx-d-add").hidden = D.mode !== "add";
        const a = DateCalc.parse(D.from), b = DateCalc.parse(D.to);
        if (a && b) { const r = DateCalc.diff(a, b); q('[data-o="diff"]').textContent = DateCalc.diffText(r); q('[data-o="days"]').textContent = r.total && (r.years || r.months || r.weeks) ? r.total.toLocaleString("en-US") + " day" + (r.total === 1 ? "" : "s") : ""; }
        else { q('[data-o="diff"]').textContent = "Pick two dates"; q('[data-o="days"]').textContent = ""; }
        const base = DateCalc.parse(D.base);
        if (base) { const r = DateCalc.add(base, D.y, D.m, D.d, D.op === "sub" ? -1 : 1); q('[data-o="date"]').textContent = r.y < 1 || r.y > 9999 ? "Out of range" : DateCalc.long(r); }
        else q('[data-o="date"]').textContent = "Pick a date";
      }
      el.addEventListener("input", (e) => {
        const k = e.target.dataset.d; if (!k) return;
        if (k === "op") D.op = e.target.value;
        else if (["y", "m", "d"].includes(k)) D[k] = Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0));
        else D[k] = e.target.value;
        save(); refresh();
      });
      el.addEventListener("change", (e) => { if (["y", "m", "d"].includes(e.target.dataset.d)) e.target.value = D[e.target.dataset.d]; if (e.target.dataset.d === "mode") { D.mode = e.target.value; save(); refresh(); } });
      return { el, refresh, onKey: () => false, copyText: () => (D.mode === "diff" ? q('[data-o="diff"]').textContent : q('[data-o="date"]').textContent) };
    }

    // ---------- Converters ----------
    function ConvView(catId) {
      const cat = CONV[catId];
      const cs = st.conv[catId] || (st.conv[catId] = {});
      let fx = null, fxState = "offline", fxErr = "";
      if (cat.currency) {
        if (fxSession) { fx = fxSession; fxState = "live"; }
        else if (st.fx && st.fx.rates && st.fx.rates.EUR) { fx = st.fx; fxState = "cached"; }
        else { fx = { rates: FX_OFFLINE.rates }; fxState = "offline"; }
      }
      const units = () => (cat.currency ? CURRENCIES.filter(([c]) => fx.rates[c]).map(([c, n]) => [c, n]) : cat.units);
      const uname = (u) => (cat.currency ? `${u[1]} (${u[0]})` : u[0]);
      const valid = (n) => units().some((u) => u[0] === n);
      if (!valid(cs.from)) cs.from = cat.def[0]; if (!valid(cs.to)) cs.to = cat.def[1];
      let active = "from", entry = typeof cs.val === "string" && parseR(cs.val) ? cs.val : "1";
      const opts = () => units().map((u) => `<option value="${esc(u[0])}">${esc(uname(u))}</option>`).join("");
      const keys = [["", ""], ["CE", "ce"], ["⌫", "back"], ["7"], ["8"], ["9"], ["4"], ["5"], ["6"], ["1"], ["2"], ["3"], ["+/−", "neg"], ["0"], ["."]];
      const el = hEl(`<div class="cx-conv">
        <div class="cx-cv-fields">
          <div class="cx-cv-field" data-f="from"><button type="button" class="cx-cv-val" data-f="from" aria-label="Input value"></button><select class="cx-sel cx-cv-unit" data-f="from" aria-label="Input unit">${opts()}</select></div>
          <button type="button" class="cx-ib cx-cv-swap" title="Swap units" aria-label="Swap units">${ic("swap")}</button>
          <div class="cx-cv-field" data-f="to"><button type="button" class="cx-cv-val" data-f="to" aria-label="Output value"></button><select class="cx-sel cx-cv-unit" data-f="to" aria-label="Output unit">${opts()}</select></div>
        </div>
        <div class="cx-cv-about"></div>
        ${cat.currency ? `<div class="cx-cv-fx"><span class="cx-cv-fxtxt"></span><button type="button" class="cx-link" data-a="fx">Update rates</button></div>` : ""}
        <div class="cx-pad cx-pad-conv">${keys.map(([l, k]) => (l ? `<button type="button" class="cx-key cx-${k && k !== "neg" ? "fn" : "num"}" data-k="${esc(k || l)}">${l}</button>` : `<span class="cx-key-gap"></span>`)).join("")}</div>
      </div>`);
      const sel = { from: el.querySelector('select[data-f="from"]'), to: el.querySelector('select[data-f="to"]') };
      const vEl = { from: el.querySelector('.cx-cv-val[data-f="from"]'), to: el.querySelector('.cx-cv-val[data-f="to"]') };
      sel.from.value = cs.from; sel.to.value = cs.to;
      const other = (f) => (f === "from" ? "to" : "from");
      const fmtOut = (r) => {
        if (r == null) return "—";
        if (!cat.currency) return fmtR(r, { sig: 16, group: true });
        const a = absR(r);
        if (cmp(a, mkRaw(1n, 100n)) >= 0) { const n = babs(r.n) * 100n; let q2 = n / r.d; if ((n % r.d) * 2n >= r.d) q2 += 1n; const fp = (q2 % 100n).toString().padStart(2, "0"); return (r.n < 0n ? "-" : "") + groupInt((q2 / 100n).toString()) + "." + fp; }
        return fmtR(r, { sig: 4, group: true });
      };
      const sym = (c) => { const x = CURRENCIES.find((z) => z[0] === c); return x ? x[2] : ""; };
      function result() { const v = parseEntryR(entry); try { return active === "from" ? convert(catId, v, cs.from, cs.to, fx) : convert(catId, v, cs.to, cs.from, fx); } catch (e) { if (e.calc) return null; throw e; } }
      function fxText() {
        if (!cat.currency) return;
        const t = el.querySelector(".cx-cv-fxtxt");
        const when = (u) => new Date(u * 1000).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
        let s;
        if (fxState === "loading") s = (fx && fx.updatedUnix ? "Saved rates from " + when(fx.updatedUnix) + " · " : fxSession ? "" : "Offline reference rates · ") + "Getting the latest rates…";
        else if (fxState === "live") s = "Updated " + when(fx.updatedUnix) + " from " + FX_SOURCE;
        else if (fxState === "cached") s = "Offline · showing saved rates from " + when(fx.updatedUnix) + " (" + FX_SOURCE + ")" + (fxErr ? ". Couldn't refresh: " + fxErr : "");
        else s = "Offline · built-in reference rates from " + FX_OFFLINE.date + " — not live" + (fxErr ? " (couldn't reach open.er-api.com)" : "");
        t.textContent = s;
        el.querySelector(".cx-cv-fx").dataset.state = fxState;
      }
      function refresh() {
        const r = result();
        const shown = { [active]: fmtEntry(entry), [other(active)]: fmtOut(r) };
        ["from", "to"].forEach((f) => {
          const u = cs[f];
          vEl[f].innerHTML = (cat.currency ? `<small>${esc(sym(u).trim() ? sym(u) : "")}</small>` : "") + esc(shown[f]);
          vEl[f].classList.toggle("on", f === active);
          vEl[f].setAttribute("aria-label", (f === "from" ? "Input" : "Output") + " value " + shown[f] + " " + uname(units().find((x) => x[0] === u) || [u, u]));
        });
        const ab = el.querySelector(".cx-cv-about");
        const srcV = parseEntryR(entry), srcU = cs[active];
        if (cat.currency) {
          const one = convert(catId, ONE, cs.from, cs.to, fx);
          ab.textContent = one ? "1 " + cs.from + " = " + fmtR(one, { sig: 6, group: true }) + " " + cs.to : "";
        } else {
          const cand = (cat.about || []).filter((u) => u !== cs.from && u !== cs.to).slice(0, 2);
          ab.innerHTML = cand.length ? `<span>About equal to</span> ` + cand.map((u) => { let v; try { v = convert(catId, srcV, srcU, u); } catch (e) { v = null; } return v ? `<b>${esc(fmtR(v, { sig: 4, group: true }))}</b> ${esc(u.toLowerCase())}` : ""; }).join(" · ") : "";
        }
        el.querySelector('[data-k="neg"]').disabled = !cat.temp;
        fxText();
        [vEl.from, vEl.to].forEach(fitText);
      }
      function setActive(f) {
        if (f === active) return;
        const r = result();
        active = f;
        entry = r ? fmtR(r, { sig: 16, group: false }) : "0";
        if (/e/.test(entry) || entryDigits(entry) > 16) entry = r ? fmtR(r, { sig: 12, group: false }) : "0";
        if (/e/.test(entry)) entry = "0";
      }
      function press(k) {
        if (/^\d$/.test(k)) { if (entry === "0") entry = k; else if (entry === "-0") entry = "-" + k; else if (entryDigits(entry) < 16) entry += k; }
        else if (k === ".") { if (!entry.includes(".")) entry += "."; }
        else if (k === "back") { entry = entry.slice(0, -1); if (entry === "" || entry === "-") entry = "0"; }
        else if (k === "ce") entry = "0";
        else if (k === "neg") { if (!cat.temp) return false; entry = entry[0] === "-" ? entry.slice(1) : entry === "0" ? "-0" : "-" + entry; }
        else return false;
        cs.val = active === "from" ? entry : undefined; save();
        return true;
      }
      el.addEventListener("click", (e) => {
        const v = e.target.closest(".cx-cv-val"); if (v) { setActive(v.dataset.f); refresh(); return; }
        if (e.target.closest(".cx-cv-swap")) { const t = cs.from; cs.from = cs.to; cs.to = t; sel.from.value = cs.from; sel.to.value = cs.to; save(); refresh(); return; }
        if (e.target.closest('[data-a="fx"]')) { loadRates(true); return; }
        const b = e.target.closest("button[data-k]"); if (b && !b.disabled) { press(b.dataset.k); refresh(); }
      });
      el.addEventListener("change", (e) => { const f = e.target.dataset.f; if (f && e.target.tagName === "SELECT") { cs[f] = e.target.value; save(); refresh(); } });
      let alive = true;
      function loadRates(force) {
        if (!cat.currency) return;
        const prev = fxState; fxState = "loading"; fxErr = ""; refresh();
        fetchFx(st, force).then((r) => { if (!alive) return; fx = r; fxState = "live"; save(); refresh(); })
          .catch((err) => {
            if (!alive) return;
            fxErr = err && err.name === "AbortError" ? "timed out" : "network unavailable";
            if (st.fx && st.fx.rates && st.fx.rates.EUR) { fx = st.fx; fxState = "cached"; } else { fx = { rates: FX_OFFLINE.rates }; fxState = "offline"; }
            if (prev === "live" && fxSession) { fx = fxSession; fxState = "live"; toast("Couldn't refresh rates"); }
            refresh();
          });
      }
      if (cat.currency) loadRates(false);
      const KEYMAP = { ".": ".", ",": ".", Backspace: "back", Escape: "ce", Delete: "ce", F9: "neg", "-": "neg" };
      return {
        el, refresh,
        onKey: (e) => { if (e.ctrlKey || e.metaKey || e.altKey) return false; const k = /^\d$/.test(e.key) ? e.key : KEYMAP[e.key]; if (!k) return false; if (press(k) === false) return false; flashKey(el, k); refresh(); return true; },
        copyText: () => { const r = result(); return active === "to" ? entry : r ? (cat.currency ? fmtOut(r).replace(/,/g, "") : fmtR(r, { sig: 16, group: false })) : null; },
        paste: (t) => { const v = parsePastedR(t); if (!v) { toast("Invalid input — couldn't paste that"); return; } entry = fmtR(v, { sig: 16, group: false }); if (/e/.test(entry)) entry = "0"; if (!cat.temp && entry[0] === "-") entry = entry.slice(1); },
        destroy: () => { alive = false; },
        conv: { get fxState() { return fxState; }, get fx() { return fx; } },
      };
    }

    // ---------- global keyboard / clipboard (only while this window is on top) ----------
    const mine = (t) => !t || !t.closest || !t.closest(".win") || t.closest(".win") === winEl;
    const onKey = (e) => {
      if (!isTop(winEl) || !mine(e.target)) return;
      if (typingTarget(e.target) && e.target.closest(".cx-app") !== root) return;
      if (typingTarget(e.target)) return;
      if (e.key === "Escape" && (navOpen || pop || sideOpen)) { e.preventDefault(); closePop(); setNav(false); setSide(false); return; }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "h" && view && view.side && view.side.tabs.includes("history")) { e.preventDefault(); if (root.classList.contains("cx-wide")) { sideTab = "history"; renderSide(); } else setSide(!sideOpen, "history"); return; }
      if (mod && e.key.toLowerCase() === "c") { const sel = window.getSelection && String(window.getSelection()); if (!sel && view && view.copyText) { const t = view.copyText(); if (t != null) copyText(t); } return; }
      if (view && view.onKey && view.onKey(e)) { e.preventDefault(); e.stopPropagation(); }
    };
    const onPaste = (e) => {
      if (!isTop(winEl) || typingTarget(document.activeElement) || !view || !view.paste) return;
      const t = e.clipboardData && e.clipboardData.getData("text/plain"); if (!t) return;
      e.preventDefault(); view.paste(t); refreshAll();
    };
    const onCopy = (e) => {
      if (!isTop(winEl) || typingTarget(document.activeElement) || !view || !view.copyText) return;
      if (window.getSelection && String(window.getSelection())) return;
      const t = view.copyText(); if (t == null) return;
      e.preventDefault(); if (e.clipboardData) e.clipboardData.setData("text/plain", t);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    window.addEventListener("copy", onCopy);
    const onTheme = new MutationObserver(() => { if (mode === "graphing" && view && view.refresh) view.refresh(); });
    onTheme.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const ro = new ResizeObserver(() => layout());
    ro.observe(root);
    const cleanup = () => { window.removeEventListener("keydown", onKey); window.removeEventListener("paste", onPaste); window.removeEventListener("copy", onCopy); ro.disconnect(); onTheme.disconnect(); closePop(); if (view && view.destroy) view.destroy(); clearTimeout(saveT); try { window.State && State.save && State.save(); } catch (e) {} };
    if (winEl) winEl.addEventListener("wm-cleanup", cleanup);

    setMode(st.mode);
    const api = { ref, root, setMode, get view() { return view; }, get mode() { return mode; }, st };
    window.CalcX._last = api;
    return api;
  }

  AppRegistry.calculator = function () { openCalculator(); };

  // Pure functions exposed for tests and other apps
  window.CalcX = {
    R: { parse: parseR, fromNum, toNum, add, sub, mul, div, neg, abs: absR, cmp, sqrt: sqrtR, pow: powR, root: rootR, cbrt: cbrtR, fact: factR, ln: lnR, log10: log10R, logBase, exp: expR, pow10: pow10R, pow2: pow2R, trig: trigR, atrig: atrigR, hyp: hypR, toDms, fromDms, mod: modFloor, floor: floorR, ceil: ceilR, ser, deser, PI: PI_R, E: E_R },
    fmt: fmtR, fmtEntry, Engine, makeRatEngine, makeProgEngine,
    prog: { wrap, uns, bin: progBin, rotate, toRadix, parseRadix },
    CONV, convert, DateCalc, compileExpr, analyzeFn, FX_OFFLINE, CURRENCIES,
    _last: null,
  };
})();
