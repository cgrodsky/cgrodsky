/* Copilot's built-in brain: answers from the question/answer packs in js/ai-qa/*.js
   (window.AIQA = [[ "question | other phrasing", "answer" ], ...]) with no internet or API key.
   It also works out time, date, simple math and a few personal things itself. */
(function () {
  "use strict";

  const STOP = new Set(("a an the is are was were be been am do does did i me my you your yours it its of to in on at for and or " +
    "can could would should will shall please tell about what whats how hows why who whom which where when that this these those " +
    "with by from as so some any just really very give show let lets explain describe define meaning mean means know " +
    "hey hi ok okay um uh like").split(" "));
  // keep a few question words when they are the whole point ("who are you" vs "what are you")
  const KEEP_SHORT = new Set(["you", "who", "why", "how", "what", "when", "where"]);

  const CONTRACTIONS = [
    [/\bwhat's\b/g, "what is"], [/\bwhats\b/g, "what is"], [/\bwho's\b/g, "who is"], [/\bwhere's\b/g, "where is"],
    [/\bhow's\b/g, "how is"], [/\bit's\b/g, "it is"], [/\bthat's\b/g, "that is"], [/\bthere's\b/g, "there is"],
    [/\bi'm\b/g, "i am"], [/\bim\b/g, "i am"], [/\byou're\b/g, "you are"], [/\bur\b/g, "your"], [/\bu\b/g, "you"], [/\br\b/g, "are"],
    [/\bcan't\b/g, "cannot"], [/\bcant\b/g, "cannot"], [/\bdon't\b/g, "do not"], [/\bdont\b/g, "do not"], [/\bdoesn't\b/g, "does not"],
    [/\bwon't\b/g, "will not"], [/\bisn't\b/g, "is not"], [/\bi've\b/g, "i have"], [/\bi'll\b/g, "i will"], [/\bi'd\b/g, "i would"],
    [/\bwanna\b/g, "want to"], [/\bgonna\b/g, "going to"], [/\bgotta\b/g, "got to"], [/\bpls\b|\bplz\b/g, "please"], [/\bthx\b|\bty\b/g, "thanks"],
    [/\bpc\b/g, "computer"], [/\bcomp\b/g, "computer"],
    [/\bnite\b/g, "night"], [/\btonite\b/g, "tonight"], [/^gn$/g, "good night"], [/^gm$/g, "good morning"],
    [/\b(wassup|wazzup|whassup|sup)\b/g, "what is up"], [/\bluv\b/g, "love"], [/\bbday\b/g, "birthday"],
    [/\bcuz\b|\bcos\b/g, "because"], [/\bya\b|\byah\b/g, "you"], [/\bwat\b|\bwut\b/g, "what"], [/\bhw\b/g, "homework"],
  ];

  function norm(s) {
    s = String(s || "").toLowerCase().replace(/[’‘`]/g, "'");
    CONTRACTIONS.forEach(([re, to]) => { s = s.replace(re, to); });
    return s.replace(/[^a-z0-9'+\-*/^%.=\s]/g, " ").replace(/'/g, "").replace(/\s+/g, " ").trim();
  }
  function stem(w) {
    if (w.length <= 3) return w;
    if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
    if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
    if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
    if (w.endsWith("es") && w.length > 4 && /(sh|ch|x|s|z)es$/.test(w)) return w.slice(0, -2);
    if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
    return w;
  }
  function tokens(s) {
    const words = norm(s).replace(/[+\-*/^%.=]/g, " ").split(" ").filter(Boolean);
    const content = words.filter((w) => !STOP.has(w));
    const use = content.length ? content : words.filter((w) => KEEP_SHORT.has(w) || !STOP.has(w));
    return (use.length ? use : words).map(stem);
  }

  // ---------- index ----------
  let built = 0, entries = [], phr = [], df = new Map(), N = 1;
  function build() {
    const src = window.AIQA || [];
    if (built === src.length) return;
    built = src.length; entries = src; phr = []; df = new Map();
    src.forEach((e, i) => {
      String(e[0]).split("|").forEach((q) => {
        q = q.trim(); if (!q) return;
        const toks = tokens(q); const set = new Set(toks);
        phr.push({ i, n: norm(q), toks, set });
        set.forEach((t) => df.set(t, (df.get(t) || 0) + 1));
      });
    });
    N = Math.max(1, phr.length);
  }
  const idf = (t) => Math.log(1 + N / (1 + (df.get(t) || 0)));

  function lev1(a, b) {           // true when a and b are at most one edit apart (typos)
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, e = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++e > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return e + (a.length - i) + (b.length - j) <= 1;
  }

  function score(qToks, p) {
    if (!qToks.length || !p.toks.length) return 0;
    let hit = 0, qW = 0, pW = 0;
    const qSet = new Set(qToks);
    qSet.forEach((t) => {
      const w = idf(t); qW += w * w;
      if (p.set.has(t)) hit += w * w;
      else if (t.length >= 5) { for (const pt of p.set) { if (pt.length >= 5 && lev1(t, pt)) { hit += 0.7 * w * w; break; } } }
    });
    p.set.forEach((t) => { const w = idf(t); pW += w * w; });
    return hit / Math.sqrt(qW * pW);
  }

  function search(text) {
    build();
    const n = norm(text).replace(/[?!.]+$/g, "").trim();
    const q = tokens(text);
    let best = [];
    for (const p of phr) {
      const s = p.n === n ? 1.5 : score(q, p);
      if (s > 0) best.push({ s, i: p.i, q: p.n });
    }
    best.sort((a, b) => b.s - a.s);
    // de-duplicate by entry
    const seen = new Set(); best = best.filter((b) => (seen.has(b.i) ? false : (seen.add(b.i), true)));
    return best.slice(0, 8);
  }

  // ---------- things the brain works out itself ----------
  const S = () => (window.State && State.data) || {};
  function userName() { const p = S().profile; return (p && p.username && p.username !== "User") ? p.username : ""; }
  function now() { return (window.State && State.now) ? State.now() : new Date(); }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const NUMW = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1000000 };
  function mathOf(text) {
    let s = " " + text.toLowerCase().replace(/,(?=\d{3})/g, "") + " ";
    s = s.replace(/\b(what is|whats|what's|calculate|compute|solve|how much is|equals|=|\?)\b/g, " ").replace(/[?=]/g, " ");
    Object.keys(NUMW).forEach((w) => { s = s.replace(new RegExp("\\b" + w + "\\b", "g"), String(NUMW[w])); });
    s = s.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/g, "($1/100*$2)")
      .replace(/(?:square root of|sqrt(?: of)?)\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?/g, "Math.sqrt($1)")
      .replace(/(\d+(?:\.\d+)?)\s*(?:squared)/g, "($1**2)").replace(/(\d+(?:\.\d+)?)\s*(?:cubed)/g, "($1**3)")
      .replace(/\b(plus|and|add)\b/g, "+").replace(/\b(minus|less|take away|subtract)\b/g, "-")
      .replace(/\b(times|multiplied by|x)\b/g, "*").replace(/×/g, "*").replace(/÷/g, "/")
      .replace(/\b(divided by|over)\b/g, "/").replace(/\b(to the power of|power)\b/g, "**").replace(/\^/g, "**")
      .replace(/\bmod\b/g, "%");
    s = s.replace(/\s+/g, " ").trim();
    if (!/\d/.test(s) || !/[-+*/%]|Math\.sqrt|\*\*/.test(s)) return null;
    if (!/^[\d\s.+\-*/%()Mathsqrt]+$/.test(s)) return null;
    try {
      const v = Function('"use strict";return (' + s + ")")();
      if (typeof v !== "number" || !isFinite(v)) return null;
      const r = Math.round(v * 1e10) / 1e10;
      return r.toLocaleString(undefined, { maximumFractionDigits: 10 });
    } catch (_) { return null; }
  }

  function dynamic(raw) {
    const t = norm(raw);
    const name = userName();
    if (/^(what time is it|whats the time|what is the time|time please|the time|current time|tell me the time|what time)\b/.test(t))
      return "It's **" + now().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + "** right now.";
    if (/^(what is (todays|the) date|whats the date|what is the date today|todays date|what day is it|what day is today|what is today|date today|the date)\b/.test(t))
      return "Today is **" + now().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + "**.";
    if (/^(what year is it|what is the year|current year)/.test(t)) return "It's **" + now().getFullYear() + "**.";
    if (/^(what month is it|current month)/.test(t)) return "It's **" + now().toLocaleDateString(undefined, { month: "long" }) + "**.";
    if (/^(what is my name|whats my name|do you know my name|who am i)\b/.test(t))
      return name ? "You're **" + name + "**! That's the name on this PC's account." : "I don't know your name yet. You can set it in **Settings → Accounts → Your info**.";
    const nm = raw.match(/\b(?:my name is|call me|i am called)\s+([A-Za-z][\w'-]{0,24})/i);
    if (nm) return "Nice to meet you, **" + nm[1][0].toUpperCase() + nm[1].slice(1) + "**! What can I help you with?";
    if (/\b(flip a coin|coin flip|heads or tails|toss a coin)\b/.test(t)) return "🪙 I flipped it… **" + pick(["Heads", "Tails"]) + "!**";
    if (/\b(roll a die|roll a dice|roll the dice|roll dice|dice roll)\b/.test(t)) return "🎲 You rolled a **" + (1 + Math.floor(Math.random() * 6)) + "**!";
    const rn = t.match(/\b(?:pick|choose|give me) a (?:random )?number (?:between|from) (-?\d+) (?:and|to) (-?\d+)/);
    if (rn) { const a = +rn[1], b = +rn[2], lo = Math.min(a, b), hi = Math.max(a, b); return "How about **" + (lo + Math.floor(Math.random() * (hi - lo + 1))) + "**?"; }
    if (/\b(how many days (until|till|til) christmas)\b/.test(t)) {
      const d = now(); let x = new Date(d.getFullYear(), 11, 25); if (d > x) x = new Date(d.getFullYear() + 1, 11, 25);
      const days = Math.ceil((x - d) / 86400000); return days === 0 ? "It's Christmas today! 🎄" : "There are **" + days + " days** until Christmas. 🎄";
    }
    const m = mathOf(raw);
    if (m != null) return "**" + m + "**";
    return null;
  }

  const FALLBACKS = [
    "Hmm, I'm not sure about that one yet. Could you ask it a different way? I know a lot about science, history, geography, words, cooking, computers, animals, sports and this PC.",
    "I don't have an answer for that yet. Try rephrasing it, or ask me something like *\"why is the sky blue\"*, *\"capital of Japan\"* or *\"how do I change my wallpaper\"*.",
    "That one's outside what I know right now. Ask me another way, or try a different question!",
  ];

  const q2 = (raw) => tokens(raw).length <= 2;   // short messages need a closer match before guessing

  /* answer(text) -> { text, confident, score, source } */
  function answer(text) {
    const raw = String(text || "").trim();
    if (!raw) return { text: "Ask me anything!", confident: true, score: 1, source: "empty" };
    const d = dynamic(raw);
    if (d) return { text: d, confident: true, score: 1, source: "dynamic" };
    const res = search(raw);
    const top = res[0];
    if (top && top.s >= 0.55) {
      // several equally good answers (e.g. "tell me a joke") -> pick one at random for variety
      let ties = res.filter((r) => r.s >= top.s - 0.04);
      // "tell me a joke" / "another riddle": rotate through every entry of that kind
      const kind = (norm(raw).match(/\b(joke|riddle|pun|fun fact|knock knock)\b/) || [])[1];
      if (kind) { const pool = []; phr.forEach((p) => { if (p.n.includes(kind) && !pool.some((x) => x.i === p.i)) pool.push({ s: top.s, i: p.i, q: p.n }); }); if (pool.length > 1) ties = pool; }
      const r = pick(ties);
      let a = entries[r.i][1];
      const name = userName();
      if (name) a = a.replace(/\{name\}/g, name); else a = a.replace(/,?\s*\{name\}/g, "");
      return { text: a, confident: top.s >= 0.7, score: top.s, source: "qa", question: r.q };
    }
    if (top && top.s >= (q2(raw) ? 0.6 : 0.38)) {
      return { text: "I think you're asking: *\"" + top.q + "\"*\n\n" + entries[top.i][1], confident: false, score: top.s, source: "qa-guess", question: top.q };
    }
    return { text: pick(FALLBACKS), confident: false, score: top ? top.s : 0, source: "fallback" };
  }

  window.Brain = { answer, search, get size() { build(); return entries.length; } };
})();
