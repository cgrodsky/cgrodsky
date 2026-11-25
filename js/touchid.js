/* Real sign-in methods, all done in the browser:

   • Touch ID / Face ID / Windows Hello — a WebAuthn "platform authenticator".
     The device's own biometric prompt appears; nothing is simulated.
   • Security key — a WebAuthn "cross-platform authenticator" (USB / NFC /
     Bluetooth key such as a YubiKey or Titan).
   • Password — stored only as a salted PBKDF2-SHA-256 hash.

   WebAuthn normally needs a server to check the signed answer. There isn't one
   here (GitHub Pages), so this file does the server's job with Web Crypto: it
   keeps each credential's public key, sends a fresh random challenge every time,
   and verifies the authenticator's signature, the challenge, the origin, the
   relying-party hash, the user-present / user-verified flags and the signature
   counter. Without the real finger / face / key, sign-in fails.

   Data lives in State.data.profile:
     webauthn: { platform: [cred], key: [cred] }   cred = { id, jwk, alg, count, at, name }
     pwHash:   { s, h, i }                            (salt, hash, iterations; base64)

   Window.TouchID keeps its old API (available / enrolled / enroll / verify /
   forget / sensorName / driverInfo / installDriverOnce) so the lock screen,
   Settings, Pay, Device Manager and Windows Security keep working. */
(function () {
  "use strict";
  const S = () => (window.State && State.data) || {};
  const profile = () => S().profile || (S().profile = {});
  const save = () => { if (window.State) State.save(); };
  const te = new TextEncoder();

  // ---------- encoding helpers ----------
  const b64u = (buf) => { const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64u = (s) => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const sha256 = async (data) => new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const eq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
  const concat = (a, b) => { const u = new Uint8Array(a.length + b.length); u.set(a, 0); u.set(b, a.length); return u; };

  // ---------- tiny CBOR decoder (enough for attestationObject + COSE keys) ----------
  function cbor(bytes) {
    let p = 0;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    function len(ai) {
      if (ai < 24) return ai;
      if (ai === 24) return bytes[p++];
      if (ai === 25) { const v = dv.getUint16(p); p += 2; return v; }
      if (ai === 26) { const v = dv.getUint32(p); p += 4; return v; }
      if (ai === 27) { const v = dv.getUint32(p) * 4294967296 + dv.getUint32(p + 4); p += 8; return v; }
      throw new Error("cbor: indefinite length not supported");
    }
    function item() {
      const ib = bytes[p++], mt = ib >> 5, ai = ib & 31;
      switch (mt) {
        case 0: return len(ai);
        case 1: return -1 - len(ai);
        case 2: { const n = len(ai); const v = bytes.slice(p, p + n); p += n; return v; }
        case 3: { const n = len(ai); const v = new TextDecoder().decode(bytes.slice(p, p + n)); p += n; return v; }
        case 4: { const n = len(ai), a = []; for (let i = 0; i < n; i++) a.push(item()); return a; }
        case 5: { const n = len(ai), m = new Map(); for (let i = 0; i < n; i++) { const k = item(); m.set(k, item()); } return m; }
        case 6: len(ai); return item(); // tag: ignore
        case 7: if (ai === 20) return false; if (ai === 21) return true; if (ai === 22 || ai === 23) return null; throw new Error("cbor: float not supported");
      }
      throw new Error("cbor: bad major type");
    }
    const v = item();
    return { value: v, used: p };
  }
  // COSE public key → JWK (ES256 or RS256)
  function coseToJwk(m) {
    const kty = m.get(1), alg = m.get(3);
    if (kty === 2 && alg === -7) return { alg: -7, jwk: { kty: "EC", crv: "P-256", x: b64u(m.get(-2)), y: b64u(m.get(-3)), ext: true } };
    if (kty === 3 && alg === -257) return { alg: -257, jwk: { kty: "RSA", n: b64u(m.get(-1)), e: b64u(m.get(-2)), alg: "RS256", ext: true } };
    throw new Error("Unsupported key type from the authenticator (kty " + kty + ", alg " + alg + ").");
  }
  function parseAuthData(ad) {
    const flags = ad[32];
    const count = new DataView(ad.buffer, ad.byteOffset + 33, 4).getUint32(0);
    const out = { rpIdHash: ad.slice(0, 32), flags, up: !!(flags & 1), uv: !!(flags & 4), count };
    if (flags & 64) { // attested credential data
      const idLen = (ad[53] << 8) | ad[54];
      out.credId = ad.slice(55, 55 + idLen);
      out.cose = cbor(ad.slice(55 + idLen)).value;
    }
    return out;
  }
  // ECDSA signatures from authenticators are DER; Web Crypto wants raw r||s.
  function derToRaw(der) {
    let p = 2; if (der[1] & 0x80) p = 2 + (der[1] & 0x7f);
    const read = () => { if (der[p++] !== 0x02) throw new Error("bad sig"); let n = der[p++]; let v = der.slice(p, p + n); p += n; while (v.length > 32 && v[0] === 0) v = v.slice(1); const o = new Uint8Array(32); o.set(v, 32 - v.length); return o; };
    return concat(read(), read());
  }

  // ---------- WebAuthn ----------
  const KINDS = { platform: "platform", key: "cross-platform" };
  const rpId = () => location.hostname;
  function supported() { return !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext); }
  function platformAvailable() {
    if (!supported() || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
  }
  function store() { const p = profile(); const w = p.webauthn || (p.webauthn = { platform: [], key: [] }); w.platform = w.platform || []; w.key = w.key || []; return w; }
  const list = (kind) => (S().profile && S().profile.webauthn && S().profile.webauthn[kind]) || [];

  function friendly(e, kind) {
    const n = e && e.name, what = kind === "key" ? "security key" : sensorName();
    if (n === "NotAllowedError" || n === "AbortError") return Object.assign(new Error("cancelled"), { friendly: "That was cancelled or timed out." });
    if (n === "InvalidStateError") return Object.assign(new Error("exists"), { friendly: "This " + what + " is already set up." });
    if (n === "SecurityError") return Object.assign(new Error("security"), { friendly: "This page's address can't use " + what + " (it needs https or localhost)." });
    if (n === "NotSupportedError") return Object.assign(new Error("unsupported"), { friendly: "This browser doesn't support " + what + "." });
    return Object.assign(new Error((e && e.message) || "failed"), { friendly: (e && e.friendly) || ("Couldn't use your " + what + ": " + ((e && e.message) || "unknown error")) });
  }

  // Must be called straight from a tap/click (Safari needs the user gesture).
  function register(kind, opts) {
    opts = opts || {};
    if (!supported()) return Promise.reject(friendly({ name: "NotSupportedError" }, kind));
    const p = profile(), w = store();
    if (!p.webauthnUser) { p.webauthnUser = b64u(rand(16)); }
    const challenge = rand(32);
    const all = w.platform.concat(w.key);
    const pk = {
      rp: { name: "Windows 12", id: rpId() },
      user: { id: unb64u(p.webauthnUser), name: (p.username || "user") + (kind === "key" ? "" : ""), displayName: p.username || "User" },
      challenge,
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: KINDS[kind], userVerification: kind === "platform" ? "required" : "discouraged", residentKey: "discouraged", requireResidentKey: false },
      excludeCredentials: all.map((c) => ({ type: "public-key", id: unb64u(c.id) })),
      timeout: 90000,
      attestation: "none",
    };
    return navigator.credentials.create({ publicKey: pk }).then(async (cred) => {
      if (!cred) throw new Error("No credential was created.");
      const r = cred.response;
      const cd = JSON.parse(new TextDecoder().decode(r.clientDataJSON));
      if (cd.type !== "webauthn.create" || cd.challenge !== b64u(challenge) || cd.origin !== location.origin) throw new Error("The response didn't match this request.");
      const att = cbor(new Uint8Array(r.attestationObject)).value;
      const ad = parseAuthData(att.get("authData"));
      if (!eq(ad.rpIdHash, await sha256(te.encode(rpId())))) throw new Error("Wrong site in the response.");
      if (!ad.up) throw new Error("The authenticator didn't confirm you were present.");
      if (kind === "platform" && !ad.uv) throw new Error(sensorName() + " didn't verify you.");
      const { alg, jwk } = coseToJwk(ad.cose);
      // make sure Web Crypto can use it before saving
      await importKey(jwk, alg);
      const id = b64u(new Uint8Array(cred.rawId));
      const n = store()[kind].length + 1;
      const entry = { id, jwk, alg, count: ad.count, at: Date.now(), name: opts.name || (kind === "key" ? "Security key " + n : sensorName() + (n > 1 ? " " + n : "")), transports: (r.getTransports && r.getTransports()) || [] };
      store()[kind].push(entry);
      if (kind === "platform") p.fingerprint = true;
      delete p.touchId; // old simulated enrolment
      save();
      return entry;
    }).catch((e) => { throw friendly(e, kind); });
  }

  function importKey(jwk, alg) {
    const algo = alg === -7 ? { name: "ECDSA", namedCurve: "P-256" } : { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    return crypto.subtle.importKey("jwk", jwk, algo, false, ["verify"]);
  }

  // Must be called straight from a tap/click. Resolves with the credential used.
  function verify(kind) {
    const creds = kind ? list(kind) : list("platform").concat(list("key"));
    if (!creds.length) return Promise.reject(Object.assign(new Error("not enrolled"), { friendly: "Nothing is set up yet." }));
    if (!supported()) return Promise.reject(friendly({ name: "NotSupportedError" }, kind));
    const challenge = rand(32);
    const uv = kind === "platform" ? "required" : "discouraged";
    return navigator.credentials.get({ publicKey: {
      challenge, rpId: rpId(), timeout: 90000, userVerification: uv,
      allowCredentials: creds.map((c) => ({ type: "public-key", id: unb64u(c.id), transports: c.transports && c.transports.length ? c.transports : undefined })),
    } }).then(async (a) => {
      if (!a) throw new Error("No answer from the authenticator.");
      const id = b64u(new Uint8Array(a.rawId));
      const c = creds.find((x) => x.id === id);
      if (!c) throw new Error("That credential isn't registered for this account.");
      const r = a.response;
      const cdBytes = new Uint8Array(r.clientDataJSON);
      const cd = JSON.parse(new TextDecoder().decode(cdBytes));
      if (cd.type !== "webauthn.get") throw new Error("Wrong response type.");
      if (cd.challenge !== b64u(challenge)) throw new Error("Challenge mismatch.");
      if (cd.origin !== location.origin) throw new Error("Origin mismatch.");
      const adBytes = new Uint8Array(r.authenticatorData);
      const ad = parseAuthData(adBytes);
      if (!eq(ad.rpIdHash, await sha256(te.encode(rpId())))) throw new Error("Wrong site in the response.");
      if (!ad.up) throw new Error("You weren't confirmed as present.");
      if (uv === "required" && !ad.uv) throw new Error(sensorName() + " didn't verify you.");
      const key = await importKey(c.jwk, c.alg);
      const signed = concat(adBytes, await sha256(cdBytes));
      let sig = new Uint8Array(r.signature);
      const algo = c.alg === -7 ? { name: "ECDSA", hash: "SHA-256" } : { name: "RSASSA-PKCS1-v1_5" };
      if (c.alg === -7) sig = derToRaw(sig);
      const ok = await crypto.subtle.verify(algo, key, sig, signed);
      if (!ok) throw new Error("The signature didn't check out.");
      if ((ad.count || c.count) && ad.count <= c.count) throw new Error("This key's counter went backwards — it may have been cloned.");
      c.count = ad.count; c.last = Date.now(); save();
      return c;
    }).catch((e) => { throw friendly(e, kind); });
  }
  function remove(kind, id) {
    const w = store(); w[kind] = w[kind].filter((c) => c.id !== id);
    if (kind === "platform" && !w.platform.length) profile().fingerprint = false;
    save();
  }

  // ---------- password (salted PBKDF2-SHA-256) ----------
  const PW_ITER = 150000;
  async function pwDerive(pw, salt, iter) {
    const k = await crypto.subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, k, 256));
  }
  const Password = {
    has: () => !!(S().profile && S().profile.pwHash),
    async set(pw) {
      if (!pw || pw.length < 4) throw new Error("Use at least 4 characters.");
      const salt = rand(16);
      profile().pwHash = { s: b64u(salt), h: b64u(await pwDerive(pw, salt, PW_ITER)), i: PW_ITER };
      save();
    },
    async check(pw) {
      const h = S().profile && S().profile.pwHash; if (!h) return false;
      return eq(await pwDerive(pw || "", unb64u(h.s), h.i), unb64u(h.h));
    },
    clear() { delete profile().pwHash; save(); },
  };

  // ---------- names ----------
  function sensorName() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|Macintosh/.test(ua)) return "Touch ID";
    if (/Windows/.test(ua)) return "Windows Hello";
    if (/Android/.test(ua)) return "Fingerprint";
    return "Device unlock";
  }
  function driverInfo() {
    return { name: sensorName() + " (WebAuthn platform authenticator)", driver: "Browser WebAuthn", version: "Web Authentication Level 2", provider: "Your browser / operating system", date: "—" };
  }

  // ---------- old TouchID API, now real ----------
  window.TouchID = {
    available: platformAvailable,
    enrolled: () => list("platform").length > 0,
    enroll: () => register("platform"),
    verify: () => verify("platform"),
    forget: () => { store().platform = []; profile().fingerprint = false; delete profile().touchId; save(); },
    sensorName, driverInfo,
    installDriverOnce: () => Promise.resolve(false), // no more pretend driver install
  };
  window.SecurityKey = {
    supported,
    enrolled: () => list("key").length > 0,
    list: () => list("key"),
    add: (name) => register("key", { name }),
    verify: () => verify("key"),
    remove: (id) => remove("key", id),
    rename: (id, name) => { const c = list("key").find((x) => x.id === id); if (c && name) { c.name = name; save(); } },
  };
  window.WebAuthnAuth = { supported, platformAvailable, register, verify, remove, list, _cbor: cbor };
  window.PasswordAuth = Password;

  // Drop the old simulated enrolment so nobody thinks a fake fingerprint is set up.
  try { const p = S().profile; if (p && p.touchId && p.touchId.sim) { delete p.touchId; if (!list("platform").length) p.fingerprint = false; save(); } } catch (_) {}
})();
