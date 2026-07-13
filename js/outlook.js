/* Microsoft Outlook — Mail, Calendar, and People modules.
   Data persists in appData.outlook. Styled to feel like real Outlook. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);
  const nowMs = () => (State.now ? State.now().getTime() : Date.now());

  // ---- AI replies (AIML chat API) with an offline template fallback ----
  async function aiChat(messages) {
    const res = await fetch((window.AIML_BASE || "https://api.aimlapi.com/v1") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (window.AIML_KEY || "") },
      body: JSON.stringify({ model: "openai/gpt-4o-mini", messages, max_tokens: 260 }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const txt = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
    if (!txt) throw new Error("empty");
    return txt;
  }
  async function aiReply(toName, subject, bodyText) {
    return aiChat([
      { role: "system", content: "You are " + (toName || "a busy professional") + ", writing a brief, warm, natural email reply. 2-4 sentences, friendly and human. Do NOT include a subject line or the word 'Subject:'. Sign off with your first name only. Plain text, no markdown." },
      { role: "user", content: "Reply to this email.\nSubject: " + subject + "\n\n" + bodyText },
    ]);
  }
  function fallbackReply(name) { return "Thanks for your message — I'll take a look and get back to you soon.\n\n" + (name || ""); }
  function textToHtml(t) { return "<p>" + esc(t).replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>") + "</p>"; }
  function stripHtml(h) { return String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }

  // A reusable marketing hero banner (inline SVG so it renders offline too).
  function banner(title, sub, c1, c2) {
    return `<svg viewBox="0 0 600 180" width="100%" style="max-width:520px;border-radius:10px;display:block;margin:0 0 16px" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg${c1.replace('#','')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="600" height="180" rx="12" fill="url(#bg${c1.replace('#','')})"/><circle cx="510" cy="40" r="70" fill="rgba(255,255,255,.12)"/><circle cx="80" cy="150" r="50" fill="rgba(255,255,255,.1)"/><text x="36" y="86" fill="#fff" font-family="Segoe UI, sans-serif" font-size="34" font-weight="700">${esc(title)}</text><text x="36" y="120" fill="rgba(255,255,255,.9)" font-family="Segoe UI, sans-serif" font-size="18">${esc(sub)}</text></svg>`;
  }
  function cta(label, color) { return `<a href="#" class="ol-cta" style="background:${color || "#0f6cbd"}" onclick="return false">${esc(label)}</a>`; }
  // A game-store style hero promo: a photo with a badge pill + big title +
  // subtitle + arrow CTA overlaid on a bottom gradient. Modeled on the Store hero cards.
  function heroPromo(img, badge, title, sub, ctaLabel) {
    return `<div class="ol-hero"><img class="ol-hero-bg" src="${img}" alt=""><div class="ol-hero-shade"></div><div class="ol-hero-in"><span class="ol-hero-badge">${esc(badge)}</span><h1 class="ol-hero-title">${esc(title)}</h1><p class="ol-hero-sub">${esc(sub)}</p><a href="#" class="ol-hero-cta" onclick="return false">${esc(ctaLabel)} &rsaquo;</a></div></div>`;
  }

  // ---- shared icons ----
  const IC = {
    plus: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
    reply: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M9 17l-6-5 6-5v3c6 0 9 3 10 8-3-3-6-4-10-4z"/></svg>`,
    replyAll: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7 17l-5-5 5-5M13 17l-5-5 5-5M13 12c5 0 8 3 9 8-3-4-6-4-9-4z"/></svg>`,
    fwd: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M15 17l6-5-6-5v3C9 10 6 13 5 18c3-3 6-4 10-4z"/></svg>`,
    flag: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M5 21V4h11l-1.5 3L16 10H5"/></svg>`,
    read: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
    send: `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>`,
    mail: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`,
    cal: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>`,
    people: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 5.6M17 14.4a5.5 5.5 0 0 1 3.5 5.1"/></svg>`,
    gear: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 2h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 22h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12z"/></svg>`,
    attach: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/></svg>`,
    image: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>`,
    archive: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/></svg>`,
  };
  const FOLDERS = [
    { id: "inbox", name: "Inbox", icon: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 13l2-8h12l2 8M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5M4 13h5l1 2h4l1-2h5"/></svg>` },
    { id: "sent", name: "Sent Items", icon: IC.send },
    { id: "drafts", name: "Drafts", icon: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>` },
    { id: "archive", name: "Archive", icon: IC.archive },
    { id: "deleted", name: "Deleted Items", icon: IC.trash },
    { id: "junk", name: "Junk Email", icon: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10.3 4.3 3 12l7.3 7.7a2 2 0 0 0 1.4.6h6.6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-6.6a2 2 0 0 0-1.4.6z"/></svg>` },
  ];
  const CATS = [
    { id: "", name: "None", color: "" },
    { id: "red", name: "Important", color: "#d13438" },
    { id: "orange", name: "Personal", color: "#ca5010" },
    { id: "green", name: "Work", color: "#107c10" },
    { id: "blue", name: "Travel", color: "#0f6cbd" },
    { id: "purple", name: "Finance", color: "#8764b8" },
  ];
  const catColor = (id) => (CATS.find((c) => c.id === id) || {}).color || "";
  const AV_COLORS = ["#0f6cbd", "#c239b3", "#d83b01", "#107c10", "#5c2e91", "#008272", "#ca5010", "#8764b8"];
  // Known brand senders — logo avatar and/or a verified badge next to the name.
  const BRANDS = {
    "xbox": { img: "assets/xbox.png", verified: true },
    "xbox game pass": { img: "assets/xbox.png", verified: true },
    "microsoft account team": { verified: true },
    "microsoft store": { verified: true },
  };
  function brandOf(name) { return BRANDS[String(name || "").toLowerCase()] || {}; }
  function avatar(name, cls) {
    const b = brandOf(name);
    if (b.img) return `<span class="ol-av ol-av-img ${cls || ""}"><img src="${b.img}" alt=""></span>`;
    const initials = (name || "?").split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
    const color = AV_COLORS[Math.abs((name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AV_COLORS.length];
    return `<span class="ol-av ${cls || ""}" style="background:${color}">${esc(initials)}</span>`;
  }
  function nameWithBadge(name) { const b = brandOf(name); return esc(name) + (b.verified ? ` <img class="ol-verified" src="assets/verified.png" alt="Verified" title="Verified sender">` : ""); }

  function seedOutlook() {
    const hr = 3600000, day = 86400000, base = nowMs();
    const mk = (from, email, subj, body, ago, opts) => Object.assign({ id: "m" + Math.abs((from + subj + ago).split("").reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)), from, email, subject: subj, body, ts: base - ago, read: false, star: false, folder: "inbox", cat: "", focused: true, atts: [] }, opts || {});
    return {
      messages: [
        mk("Microsoft account team", "account@microsoft.com", "Welcome to Windows 12", "<p>Hi there,</p><p>Welcome to Windows 12! Your account is all set up. Explore the new Start menu, App Groups on your Home Screen, and the redesigned Widgets board.</p><p>— The Windows Team</p>", hr * 2, { cat: "blue" }),
        mk("Outlook", "no-reply@outlook.com", "Your inbox is ready", "<p>You're all set. Add accounts, organize folders, and try the new reading pane.</p><p>Tip: swipe or right-click a message for quick actions.</p>", hr * 5),
        mk("LinkedIn", "notifications@linkedin.com", "You appeared in 9 searches this week", "<p>Your profile is getting noticed. See who's been searching for you and grow your network.</p>", day, { star: true, focused: false }),
        mk("GitHub", "noreply@github.com", "[cgrodsky/cgrodsky] Deploy succeeded", "<p>Your GitHub Pages site was deployed successfully.</p><p><b>Live at:</b> https://cgrodsky.github.io/cgrodsky/</p>", day + hr * 3, { read: true, cat: "green", atts: [{ name: "build-log.txt", size: "4 KB" }] }),
        mk("Xbox", "xbox@microsoft.com", "New games added to Game Pass", "<p>This month's lineup just dropped. Jump back in and play something new.</p>", day * 2, { focused: false }),
        mk("Forge Bank", "alerts@forgebank.com", "Your statement is ready", "<p>Your monthly statement is available. No action needed.</p>", day * 3, { read: true, cat: "purple", atts: [{ name: "statement.pdf", size: "128 KB" }] }),
        mk("Microsoft Store", "store@microsoft.com", "Summer Sale — up to 60% off", banner("Summer Sale", "Up to 60% off top apps & games", "#0f6cbd", "#8764b8") + "<p>Hi there,</p><p>Our biggest sale of the season is here. Save on the apps and games you love — this week only.</p>" + cta("Shop the sale", "#0f6cbd") + "<p style='color:#888;font-size:.8rem;margin-top:16px'>Offer ends Sunday. Prices in the sim are fake.</p>", hr * 8, { from: "Microsoft Store", focused: false }),
        mk("Xbox Game Pass", "gamepass@xbox.com", "Now available: Assassin's Creed Black Flag", heroPromo("assets/promo_ac.jpg", "Now available", "Assassin's Creed Black Flag", "Rediscover the thrill of piracy as captain Edward Kenway", "Get it now") + "<p>It's here — set sail on the open seas and hunt legendary ships. Now included with Game Pass.</p>" + cta("Play with Game Pass", "#107c10"), day + hr * 6, { from: "Xbox Game Pass", focused: false, cat: "green" }),
        mk("Contoso Travel", "deals@contoso-travel.com", "Weekend getaways from $99", banner("Escape for less", "Weekend deals from $99", "#ca5010", "#d13438") + "<p>Pack your bags — handpicked weekend escapes are on sale now.</p>" + cta("Browse trips", "#ca5010") + "<p style='color:#888;font-size:.8rem;margin-top:14px'>You're receiving this because you're a valued (pretend) traveler.</p>", day * 2 + hr * 2, { from: "Contoso Travel", focused: false, cat: "orange" }),
      ],
      events: [
        { id: "e1", title: "Team sync", day: 0, start: "10:00", end: "10:30", color: "#0f6cbd" },
        { id: "e2", title: "Lunch with Sam", day: 0, start: "12:30", end: "13:30", color: "#107c10" },
        { id: "e3", title: "Design review", day: 2, start: "15:00", end: "16:00", color: "#8764b8" },
      ],
      contacts: [
        { id: "c1", name: "Bill Gates", email: "bill@microsoft.com", phone: "+1 (425) 555-0100", company: "Microsoft" },
        { id: "c2", name: "Satya Nadella", email: "satya@microsoft.com", phone: "+1 (425) 555-0111", company: "Microsoft" },
        { id: "c3", name: "Sam Rivera", email: "sam.rivera@contoso.com", phone: "+1 (206) 555-0175", company: "Contoso" },
        { id: "c4", name: "Ada Lovelace", email: "ada@analytical.io", phone: "+44 20 7946 0000", company: "Analytical Engines" },
      ],
      signature: "Sent from Windows 12 Mail",
    };
  }
  function store() {
    if (!S().appData) S().appData = {};
    if (!S().appData.outlook) S().appData.outlook = seedOutlook();
    const o = S().appData.outlook;
    if (!o.messages) o.messages = [];
    if (!o.events) o.events = seedOutlook().events;
    if (!o.contacts) o.contacts = seedOutlook().contacts;
    o.messages.forEach((m) => { if (m.atts == null) m.atts = []; if (m.focused == null) m.focused = true; if (m.cat == null) m.cat = ""; });
    return o;
  }
  function timeAgo(ts) {
    const d = new Date(ts), diff = nowMs() - ts;
    if (diff < 3600000) return Math.max(1, Math.round(diff / 60000)) + "m";
    if (diff < 86400000) return Math.round(diff / 3600000) + "h";
    const days = Math.round(diff / 86400000);
    if (days < 7) return days + "d";
    return (d.getMonth() + 1) + "/" + d.getDate();
  }

  function openOutlook() {
    const ref = cw({ title: "Outlook", icon: window.Icon ? Icon.mini("outlook", "Outlook") : "", width: 1120, height: 740, appId: "outlook" });
    const body = ref.body;
    const data = store();
    let module = "mail";
    let folder = "inbox", selectedId = null, query = "", tab = "focused";
    let calRef = new Date(nowMs()); calRef.setDate(1);
    let selContact = null;

    function build() {
      body.innerHTML = `<div class="ol-shell">
        <div class="ol-rail">
          <button class="ol-rail-btn ${module === "mail" ? "on" : ""}" data-m="mail" title="Mail">${IC.mail}</button>
          <button class="ol-rail-btn ${module === "calendar" ? "on" : ""}" data-m="calendar" title="Calendar">${IC.cal}</button>
          <button class="ol-rail-btn ${module === "people" ? "on" : ""}" data-m="people" title="People">${IC.people}</button>
          <span class="grow"></span>
          <button class="ol-rail-btn" data-m="settings" title="Settings">${IC.gear}</button>
        </div>
        <div class="ol-module"></div>
      </div>`;
      body.querySelectorAll(".ol-rail-btn[data-m]").forEach((b) => b.onclick = () => {
        if (b.dataset.m === "settings") { open("settings"); return; }
        module = b.dataset.m; build();
      });
      const mount = body.querySelector(".ol-module");
      if (module === "mail") renderMail(mount);
      else if (module === "calendar") renderCalendar(mount);
      else renderPeople(mount);
    }

    // ============================ MAIL ============================
    function count(fid) { return data.messages.filter((m) => m.folder === fid && !m.read).length; }
    function renderMail(mount) {
      mount.innerHTML = `<div class="ol">
        <div class="ol-ribbon">
          <button class="ol-new"><span class="ol-new-ic">${IC.plus}</span> New mail</button>
          <div class="ol-ribbon-tools">
            <button class="ol-rtool" data-a="reply" title="Reply">${IC.reply}<span>Reply</span></button>
            <button class="ol-rtool" data-a="replyall" title="Reply all">${IC.replyAll}<span>Reply all</span></button>
            <button class="ol-rtool" data-a="forward" title="Forward">${IC.fwd}<span>Forward</span></button>
            <span class="ol-rsep"></span>
            <button class="ol-rtool" data-a="archive" title="Archive">${IC.archive}<span>Archive</span></button>
            <button class="ol-rtool" data-a="delete" title="Delete">${IC.trash}<span>Delete</span></button>
            <button class="ol-rtool" data-a="star" title="Flag">${IC.flag}<span>Flag</span></button>
            <button class="ol-rtool" data-a="read" title="Read/unread">${IC.read}<span>Read</span></button>
          </div>
          <span class="grow"></span>
          <div class="ol-search"><span>${IC.search}</span><input placeholder="Search mail" class="ol-search-in" value="${esc(query)}"></div>
        </div>
        <div class="ol-main">
          <div class="ol-side">
            <div class="ol-account">
              ${avatar((S().profile && S().profile.username) || "You")}
              <div class="ol-acct-txt"><b>${esc((S().profile && S().profile.username) || "You")}</b><span>${esc((S().account && S().account.email) || "you@outlook.com")}</span></div>
            </div>
            <button class="ol-compose"><span>${IC.plus}</span> New mail</button>
            <div class="ol-folders"></div>
            <div class="ol-side-foot">Windows 12 Mail</div>
          </div>
          <div class="ol-list"></div>
          <div class="ol-read"></div>
        </div>
      </div>`;
      const foldersEl = mount.querySelector(".ol-folders");
      FOLDERS.forEach((f) => {
        const c = count(f.id);
        const b = el(`<button class="ol-folder ${folder === f.id ? "on" : ""}"><span class="ol-fic">${f.icon}</span><span class="ol-fname">${f.name}</span>${c ? `<span class="ol-fcount">${c}</span>` : ""}</button>`);
        b.onclick = () => { folder = f.id; selectedId = null; renderMail(mount); };
        foldersEl.appendChild(b);
      });
      mount.querySelector(".ol-new").onclick = () => compose();
      mount.querySelector(".ol-compose").onclick = () => compose();
      mount.querySelectorAll(".ol-ribbon-tools .ol-rtool").forEach((b) => b.onclick = () => act(b.dataset.a));
      const si = mount.querySelector(".ol-search-in");
      si.oninput = (e) => { query = e.target.value; renderList(); };
      renderList(); renderRead();

      function visible() {
        let ms = data.messages.filter((m) => m.folder === folder);
        if (folder === "inbox") ms = ms.filter((m) => (tab === "focused" ? m.focused : !m.focused));
        if (query) { const q = query.toLowerCase(); ms = data.messages.filter((m) => m.folder === folder && (m.from + m.subject + m.body).toLowerCase().includes(q)); }
        return ms.sort((a, b) => b.ts - a.ts);
      }
      function renderList() {
        const listEl = mount.querySelector(".ol-list");
        const ms = visible();
        const fname = (FOLDERS.find((f) => f.id === folder) || {}).name || "";
        const tabs = folder === "inbox" && !query ? `<div class="ol-tabs"><button class="ol-tab ${tab === "focused" ? "on" : ""}" data-t="focused">Focused</button><button class="ol-tab ${tab === "other" ? "on" : ""}" data-t="other">Other</button></div>` : "";
        listEl.innerHTML = `<div class="ol-list-head"><b>${fname}</b><span class="muted">${ms.length} item${ms.length === 1 ? "" : "s"}</span></div>${tabs}<div class="ol-list-scroll"></div>`;
        listEl.querySelectorAll(".ol-tab").forEach((b) => b.onclick = () => { tab = b.dataset.t; renderList(); });
        const scroll = listEl.querySelector(".ol-list-scroll");
        if (!ms.length) { scroll.innerHTML = `<div class="ol-empty">${IC.mail}<p>Nothing here</p></div>`; return; }
        ms.forEach((m) => {
          const cc = catColor(m.cat);
          const row = el(`<button class="ol-item ${m.read ? "" : "unread"} ${selectedId === m.id ? "sel" : ""}">
            ${m.read ? "" : `<span class="ol-unread-dot"></span>`}
            ${avatar(m.from)}
            <div class="ol-item-txt">
              <div class="ol-item-top"><span class="ol-item-from">${nameWithBadge(m.from)}</span><span class="ol-item-time">${timeAgo(m.ts)}</span></div>
              <div class="ol-item-subj">${esc(m.subject)}</div>
              <div class="ol-item-prev">${esc(m.body.replace(/<[^>]+>/g, " ").trim()).slice(0, 92)}</div>
              <div class="ol-item-tags">${cc ? `<span class="ol-cat-pill" style="background:${cc}"></span>` : ""}${(m.atts && m.atts.length) ? `<span class="ol-att-badge">${IC.attach}${m.atts.length}</span>` : ""}</div>
            </div>
            <span class="ol-item-star ${m.star ? "on" : ""}" title="Flag">${IC.flag}</span>
          </button>`);
          row.onclick = (e) => {
            if (e.target.closest(".ol-item-star")) { m.star = !m.star; State.save(); renderList(); return; }
            selectedId = m.id; if (!m.read) { m.read = true; State.save(); }
            renderMail(mount);
          };
          row.oncontextmenu = (e) => { e.preventDefault(); catMenu(m, e); };
          scroll.appendChild(row);
        });
      }
      function renderRead() {
        const readEl = mount.querySelector(".ol-read");
        const m = data.messages.find((x) => x.id === selectedId);
        if (!m) { readEl.innerHTML = `<div class="ol-read-empty">${IC.mail}<p>Select an item to read</p></div>`; return; }
        const attHtml = (m.atts && m.atts.length) ? `<div class="ol-atts">${m.atts.map((a) => `<div class="ol-att"><span class="ol-att-ic">${IC.attach}</span><div class="ol-att-meta"><b>${esc(a.name)}</b><span>${esc(a.size || "")}</span></div></div>`).join("")}</div>` : "";
        readEl.innerHTML = `<div class="ol-read-inner">
          <div class="ol-read-head"><h2>${esc(m.subject)}</h2>
            <div class="ol-read-actions">
              <button data-a="reply" title="Reply">${IC.reply}</button>
              <button data-a="forward" title="Forward">${IC.fwd}</button>
              <button data-a="delete" title="Delete">${IC.trash}</button>
            </div>
          </div>
          <div class="ol-read-meta">${avatar(m.from, "lg")}
            <div class="ol-read-meta-txt"><b>${nameWithBadge(m.from)}</b> <span class="ol-read-email">&lt;${esc(m.email)}&gt;</span><div class="muted">To: you &middot; ${new Date(m.ts).toLocaleString()}</div></div>
            <button class="ol-read-star ${m.star ? "on" : ""}" title="Flag">${IC.flag}</button>
          </div>
          <div class="ol-read-body">${m.body}</div>
          ${attHtml}
          <div class="ol-read-foot"><button class="ol-rbtn" data-a="reply">${IC.reply} Reply</button><button class="ol-rbtn" data-a="replyall">${IC.replyAll} Reply all</button><button class="ol-rbtn" data-a="forward">${IC.fwd} Forward</button></div>
        </div>`;
        readEl.querySelectorAll("[data-a]").forEach((b) => b.onclick = () => act(b.dataset.a, m));
        readEl.querySelector(".ol-read-star").onclick = () => { m.star = !m.star; State.save(); renderMail(mount); };
      }
      // expose for row handlers
      renderMail._renderList = renderList;
    }

    function catMenu(m, e) {
      document.querySelectorAll(".ol-cat-menu").forEach((x) => x.remove());
      const menu = el(`<div class="ol-cat-menu"></div>`);
      CATS.forEach((c) => { const b = el(`<button><span class="ol-cat-sw" style="background:${c.color || "transparent"};border:${c.color ? "0" : "1px solid #bbb"}"></span>${c.name}</button>`); b.onclick = () => { m.cat = c.id; State.save(); menu.remove(); build(); }; menu.appendChild(b); });
      document.getElementById("screen").appendChild(menu);
      menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + "px"; menu.style.top = Math.min(e.clientY, window.innerHeight - 260) + "px";
      setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", h); } }), 0);
    }

    function act(a, m) {
      m = m || data.messages.find((x) => x.id === selectedId);
      if (a === "reply" && m) return compose({ to: m.email, subject: "RE: " + m.subject, body: quote(m) });
      if (a === "replyall" && m) return compose({ to: m.email, subject: "RE: " + m.subject, body: quote(m) });
      if (a === "forward" && m) return compose({ to: "", subject: "FW: " + m.subject, body: quote(m) });
      if (!m) return;
      if (a === "delete") { m.folder = "deleted"; selectedId = null; State.save(); build(); }
      if (a === "archive") { m.folder = "archive"; selectedId = null; State.save(); build(); }
      if (a === "star") { m.star = !m.star; State.save(); build(); }
      if (a === "read") { m.read = !m.read; State.save(); build(); }
    }
    function quote(m) { return `<br><br><hr><div style="color:#666"><b>From:</b> ${esc(m.from)}<br><b>Subject:</b> ${esc(m.subject)}<br><br>${m.body}</div>`; }

    function compose(pre) {
      pre = pre || {};
      let atts = [];
      const ov = el(`<div class="ol-compose-ov"><div class="ol-compose-win">
        <div class="ol-compose-bar"><b>New message</b><span class="grow"></span><button class="ol-cw-close" title="Close">&times;</button></div>
        <div class="ol-compose-fields">
          <label class="ol-cf"><span>To</span><input class="ol-to" value="${esc(pre.to || "")}"></label>
          <label class="ol-cf"><span>Cc</span><input class="ol-cc"></label>
          <label class="ol-cf"><span>Subject</span><input class="ol-subj" value="${esc(pre.subject || "")}"></label>
        </div>
        <div class="ol-format">
          <button data-f="bold" title="Bold"><b>B</b></button>
          <button data-f="italic" title="Italic"><i>I</i></button>
          <button data-f="underline" title="Underline"><u>U</u></button>
          <span class="ol-fsep"></span>
          <button data-f="insertUnorderedList" title="Bullets">&#8226;</button>
          <button data-f="insertOrderedList" title="Numbered">1.</button>
          <button data-f="createLink" title="Link">&#128279;</button>
          <span class="ol-fsep"></span>
          <button class="ol-insert-img" title="Insert image">${IC.image}</button>
          <span class="grow"></span>
          <button class="ol-attach" title="Attach file">${IC.attach}</button>
        </div>
        <div class="ol-compose-body" contenteditable="true">${pre.body || ""}</div>
        <div class="ol-att-row"></div>
        <div class="ol-compose-foot"><button class="ol-send">${IC.send} Send</button><button class="ol-cw-discard" title="Discard">${IC.trash}</button><span class="grow"></span><span class="ol-sig muted">${esc(data.signature || "")}</span></div>
      </div></div>`);
      const close = () => ov.remove();
      ov.querySelector(".ol-cw-close").onclick = close;
      ov.querySelector(".ol-cw-discard").onclick = close;
      ov.onclick = (e) => { if (e.target === ov) close(); };
      const bodyEl = ov.querySelector(".ol-compose-body");
      ov.querySelectorAll(".ol-format [data-f]").forEach((b) => b.onmousedown = (e) => {
        e.preventDefault();
        const f = b.dataset.f;
        if (f === "createLink") { const url = prompt("Link URL", "https://"); if (url) document.execCommand("createLink", false, url); }
        else document.execCommand(f, false, null);
        bodyEl.focus();
      });
      const attRow = ov.querySelector(".ol-att-row");
      function renderAtts() { attRow.innerHTML = atts.map((a, i) => `<span class="ol-att-chip">${IC.attach}${esc(a.name)}<button data-i="${i}">&times;</button></span>`).join(""); attRow.querySelectorAll("button").forEach((b) => b.onclick = () => { atts.splice(+b.dataset.i, 1); renderAtts(); }); }
      ov.querySelector(".ol-attach").onclick = () => {
        const inp = document.getElementById("globalFileInput"); inp.accept = "*/*"; inp.value = "";
        inp.onchange = () => { const f = inp.files[0]; if (!f) return; atts.push({ name: f.name, size: (f.size < 1024 ? f.size + " B" : Math.round(f.size / 1024) + " KB") }); renderAtts(); };
        inp.click();
      };
      // Insert an image inline into the email body.
      ov.querySelector(".ol-insert-img").onclick = () => {
        const inp = document.getElementById("globalFileInput"); inp.accept = "image/*"; inp.value = "";
        inp.onchange = () => {
          const f = inp.files[0]; if (!f) return;
          const rd = new FileReader();
          rd.onload = () => { bodyEl.focus(); document.execCommand("insertHTML", false, `<img src="${rd.result}" alt="" style="max-width:100%;border-radius:6px;margin:6px 0">`); };
          rd.readAsDataURL(f);
        };
        inp.click();
      };
      ov.querySelector(".ol-send").onclick = () => {
        const to = ov.querySelector(".ol-to").value.trim();
        const subj = ov.querySelector(".ol-subj").value.trim() || "(no subject)";
        const sent = { id: "m" + Date.now(), from: (S().profile && S().profile.username) || "You", email: (S().account && S().account.email) || "you@outlook.com", subject: subj, body: bodyEl.innerHTML, ts: nowMs(), read: true, star: false, folder: "sent", cat: "", focused: true, atts: atts.slice(), to: to };
        data.messages.push(sent); State.save();
        if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("outlook", "Outlook") : "", title: "Message sent", body: "to " + (to || "recipient") });
        close();
        if (to) {
          const name = to.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const bodyText = stripHtml(sent.body);
          // Realistic reply delay: 20–90 seconds. Reply is AI-generated, with an offline template fallback.
          const delay = 20000 + Math.floor(Math.random() * 70000);
          setTimeout(async () => {
            let replyText;
            try { replyText = await aiReply(name, subj, bodyText); }
            catch (_) { replyText = fallbackReply(name); }
            data.messages.push({ id: "m" + (nowMs() + 1), from: name || "Auto Reply", email: to, subject: "RE: " + subj, body: textToHtml(replyText), ts: nowMs(), read: false, star: false, folder: "inbox", cat: "", focused: true, atts: [] });
            State.save();
            if (module === "mail" && folder === "inbox") build();
            if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("outlook", "Outlook") : "", title: name || "New mail", body: "RE: " + subj, onClick: () => { module = "mail"; folder = "inbox"; build(); } });
          }, delay);
        }
        folder = "sent"; selectedId = sent.id; build();
      };
      body.appendChild(ov);
      setTimeout(() => ov.querySelector(pre.to ? ".ol-compose-body" : ".ol-to").focus(), 30);
    }

    // ============================ CALENDAR ============================
    function renderCalendar(mount) {
      const y = calRef.getFullYear(), m = calRef.getMonth();
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      const today = new Date(nowMs());
      mount.innerHTML = `<div class="ol ol-cal">
        <div class="ol-ribbon"><button class="ol-new" id="newEvt"><span>${IC.plus}</span> New event</button>
          <div class="ol-cal-nav"><button id="prev">&lsaquo;</button><button id="today">Today</button><button id="next">&rsaquo;</button></div>
          <h2 class="ol-cal-title">${months[m]} ${y}</h2><span class="grow"></span></div>
        <div class="ol-cal-grid">
          <div class="ol-cal-dow">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<span>${d}</span>`).join("")}</div>
          <div class="ol-cal-days"></div>
        </div>
      </div>`;
      const grid = mount.querySelector(".ol-cal-days");
      const totalCells = Math.ceil((first + days) / 7) * 7;
      for (let i = 0; i < totalCells; i++) {
        const dnum = i - first + 1;
        const inMonth = dnum >= 1 && dnum <= days;
        const isToday = inMonth && dnum === today.getDate() && m === today.getMonth() && y === today.getFullYear();
        const cell = el(`<div class="ol-cal-cell ${inMonth ? "" : "out"} ${isToday ? "today" : ""}"><span class="ol-cal-num">${inMonth ? dnum : ""}</span><div class="ol-cal-evs"></div></div>`);
        if (inMonth) {
          const dow = new Date(y, m, dnum).getDay();
          const evs = data.events.filter((e) => e.day === dow && sameWeekish(y, m, dnum));
          const evWrap = cell.querySelector(".ol-cal-evs");
          data.events.filter((e) => matchEvent(e, y, m, dnum)).forEach((e) => {
            const chip = el(`<div class="ol-ev" style="--ec:${e.color}"><span class="ol-ev-t">${esc(e.start)}</span> ${esc(e.title)}</div>`);
            chip.onclick = (ev) => { ev.stopPropagation(); editEvent(e); };
            evWrap.appendChild(chip);
          });
          cell.onclick = () => addEvent(dnum);
        }
        grid.appendChild(cell);
      }
      mount.querySelector("#prev").onclick = () => { calRef.setMonth(calRef.getMonth() - 1); renderCalendar(mount); };
      mount.querySelector("#next").onclick = () => { calRef.setMonth(calRef.getMonth() + 1); renderCalendar(mount); };
      mount.querySelector("#today").onclick = () => { calRef = new Date(nowMs()); calRef.setDate(1); renderCalendar(mount); };
      mount.querySelector("#newEvt").onclick = () => addEvent(today.getDate());
      function sameWeekish() { return true; }
    }
    // Events are stored by day-of-week for the seed; user events store an absolute date key.
    function matchEvent(e, y, m, dnum) {
      if (e.date) return e.date === y + "-" + m + "-" + dnum;
      const dow = new Date(y, m, dnum).getDay();
      return e.day === dow;
    }
    function addEvent(dnum) {
      const y = calRef.getFullYear(), m = calRef.getMonth();
      const title = prompt("Event title"); if (!title) return;
      const start = prompt("Start time (e.g. 14:00)", "09:00") || "09:00";
      data.events.push({ id: "e" + Date.now(), title, date: y + "-" + m + "-" + dnum, start, end: start, color: AV_COLORS[data.events.length % AV_COLORS.length] });
      State.save(); build();
    }
    function editEvent(e) {
      const t = prompt("Event title (empty to delete)", e.title);
      if (t === null) return;
      if (t === "") { data.events = data.events.filter((x) => x.id !== e.id); } else { e.title = t; }
      State.save(); build();
    }

    // ============================ PEOPLE ============================
    function renderPeople(mount) {
      mount.innerHTML = `<div class="ol ol-people">
        <div class="ol-ribbon"><button class="ol-new" id="newC"><span>${IC.plus}</span> New contact</button><span class="grow"></span>
          <div class="ol-search"><span>${IC.search}</span><input class="ol-people-search" placeholder="Search people"></div></div>
        <div class="ol-people-main"><div class="ol-people-list"></div><div class="ol-people-detail"></div></div>
      </div>`;
      const listEl = mount.querySelector(".ol-people-list");
      function renderList(filter) {
        listEl.innerHTML = "";
        const cs = data.contacts.filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
        cs.forEach((c) => {
          const row = el(`<button class="ol-person ${selContact === c.id ? "sel" : ""}">${avatar(c.name)}<div class="ol-person-txt"><b>${esc(c.name)}</b><span>${esc(c.email)}</span></div></button>`);
          row.onclick = () => { selContact = c.id; renderPeople(mount); };
          listEl.appendChild(row);
        });
        if (!cs.length) listEl.innerHTML = `<div class="ol-empty">${IC.people}<p>No contacts</p></div>`;
      }
      renderList("");
      mount.querySelector(".ol-people-search").oninput = (e) => renderList(e.target.value);
      mount.querySelector("#newC").onclick = () => { const name = prompt("Contact name"); if (!name) return; const email = prompt("Email", "") || ""; data.contacts.push({ id: "c" + Date.now(), name, email, phone: "", company: "" }); State.save(); build(); };
      const det = mount.querySelector(".ol-people-detail");
      const c = data.contacts.find((x) => x.id === selContact);
      if (!c) { det.innerHTML = `<div class="ol-read-empty">${IC.people}<p>Select a contact</p></div>`; return; }
      det.innerHTML = `<div class="ol-person-card">
        ${avatar(c.name, "xl")}
        <h2>${esc(c.name)}</h2>
        <div class="ol-person-co">${esc(c.company || "")}</div>
        <div class="ol-person-actions"><button data-a="email">${IC.mail}<span>Email</span></button></div>
        <div class="ol-person-fields">
          <div class="ol-pf"><span>Email</span><b>${esc(c.email || "—")}</b></div>
          <div class="ol-pf"><span>Phone</span><b>${esc(c.phone || "—")}</b></div>
          <div class="ol-pf"><span>Company</span><b>${esc(c.company || "—")}</b></div>
        </div>
        <div class="ol-person-foot"><button class="ol-del-c">Delete contact</button></div>
      </div>`;
      det.querySelector('[data-a="email"]').onclick = () => { module = "mail"; build(); compose({ to: c.email, subject: "", body: "" }); };
      det.querySelector(".ol-del-c").onclick = () => { data.contacts = data.contacts.filter((x) => x.id !== c.id); selContact = null; State.save(); build(); };
    }

    build();
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.outlook = openOutlook;
})();
