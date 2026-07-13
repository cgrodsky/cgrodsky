/* Microsoft Outlook — folders, message list, reading pane, compose, search.
   Data persists in appData.outlook. Styled to feel like real Outlook. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const FOLDERS = [
    { id: "inbox", name: "Inbox", icon: "inbox" },
    { id: "sent", name: "Sent Items", icon: "sent" },
    { id: "drafts", name: "Drafts", icon: "draft" },
    { id: "archive", name: "Archive", icon: "archive" },
    { id: "deleted", name: "Deleted Items", icon: "trash" },
    { id: "junk", name: "Junk Email", icon: "junk" },
  ];
  const FICON = {
    inbox: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 13l2-8h12l2 8M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5M4 13h5l1 2h4l1-2h5"/></svg>`,
    sent: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
    draft: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
    archive: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>`,
    junk: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10.3 4.3 3 12l7.3 7.7a2 2 0 0 0 1.4.6h6.6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-6.6a2 2 0 0 0-1.4.6zM15 9l-4 4M11 9l4 4"/></svg>`,
  };

  function seedOutlook() {
    const now = Date.now();
    const hr = 3600000, day = 86400000;
    const mk = (from, email, subj, body, ago, opts) => Object.assign({ id: "m" + Math.abs((from + subj + ago).split("").reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)), from, email, subject: subj, body, ts: now - ago, read: false, star: false, folder: "inbox" }, opts || {});
    return {
      messages: [
        mk("Microsoft account team", "account@microsoft.com", "Welcome to Windows 12", "<p>Hi there,</p><p>Welcome to Windows 12! Your account is all set up. Explore the new Start menu, App Groups on your Home Screen, and the redesigned Widgets board.</p><p>— The Windows Team</p>", hr * 2, { read: false }),
        mk("Outlook", "no-reply@outlook.com", "Your inbox is ready", "<p>You're all set. Add accounts, organize folders, and try the new reading pane.</p><p>Tip: swipe or right-click a message for quick actions.</p>", hr * 5),
        mk("LinkedIn", "notifications@linkedin.com", "You appeared in 9 searches this week", "<p>Your profile is getting noticed. See who's been searching for you and grow your network.</p>", day, { star: true }),
        mk("GitHub", "noreply@github.com", "[cgrodsky/cgrodsky] Deploy succeeded", "<p>Your GitHub Pages site was deployed successfully.</p><p><b>Live at:</b> https://cgrodsky.github.io/cgrodsky/</p>", day + hr * 3, { read: true }),
        mk("Xbox", "xbox@microsoft.com", "New games added to Game Pass", "<p>This month's lineup just dropped. Jump back in and play something new.</p>", day * 2),
        mk("Forge Bank", "alerts@forgebank.com", "Your statement is ready", "<p>Your monthly statement is available. No action needed.</p>", day * 3, { read: true }),
      ],
      draftsList: [],
      signature: "Sent from Windows 12 Mail",
    };
  }
  function store() { if (!S().appData) S().appData = {}; if (!S().appData.outlook) S().appData.outlook = seedOutlook(); if (!S().appData.outlook.messages) S().appData.outlook.messages = []; return S().appData.outlook; }

  function timeAgo(ts) {
    const d = new Date(ts);
    const diff = (State.now ? State.now().getTime() : Date.now()) - ts;
    if (diff < 3600000) return Math.max(1, Math.round(diff / 60000)) + "m";
    if (diff < 86400000) return Math.round(diff / 3600000) + "h";
    const days = Math.round(diff / 86400000);
    if (days < 7) return days + "d";
    return (d.getMonth() + 1) + "/" + d.getDate();
  }
  const AV_COLORS = ["#0f6cbd", "#c239b3", "#d83b01", "#107c10", "#5c2e91", "#008272", "#ca5010", "#8764b8"];
  function avatar(name) {
    const initials = (name || "?").split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
    const color = AV_COLORS[Math.abs((name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AV_COLORS.length];
    return `<span class="ol-av" style="background:${color}">${esc(initials)}</span>`;
  }

  function openOutlook() {
    const ref = cw({ title: "Outlook", icon: window.Icon ? Icon.mini("outlook", "Outlook") : "", width: 1080, height: 720, appId: "outlook" });
    const body = ref.body;
    const data = store();
    let folder = "inbox", selectedId = null, query = "";

    body.innerHTML = `<div class="ol">
      <div class="ol-ribbon">
        <button class="ol-new"><span class="ol-new-ic">${plusIc()}</span> New mail</button>
        <div class="ol-ribbon-tools">
          <button class="ol-rtool" data-a="reply" title="Reply">${replyIc()}<span>Reply</span></button>
          <button class="ol-rtool" data-a="replyall" title="Reply all">${replyAllIc()}<span>Reply all</span></button>
          <button class="ol-rtool" data-a="forward" title="Forward">${fwdIc()}<span>Forward</span></button>
          <span class="ol-rsep"></span>
          <button class="ol-rtool" data-a="archive" title="Archive">${FICON.archive}<span>Archive</span></button>
          <button class="ol-rtool" data-a="delete" title="Delete">${FICON.trash}<span>Delete</span></button>
          <button class="ol-rtool" data-a="star" title="Flag">${flagIc()}<span>Flag</span></button>
          <button class="ol-rtool" data-a="read" title="Mark read/unread">${readIc()}<span>Read</span></button>
        </div>
        <span class="grow"></span>
        <div class="ol-search"><span>${searchIc()}</span><input placeholder="Search mail" class="ol-search-in"></div>
      </div>
      <div class="ol-main">
        <div class="ol-side">
          <div class="ol-account">
            ${avatar((S().profile && S().profile.username) || "You")}
            <div class="ol-acct-txt"><b>${esc((S().profile && S().profile.username) || "You")}</b><span>${esc((S().account && S().account.email) || "you@outlook.com")}</span></div>
          </div>
          <button class="ol-compose"><span>${plusIc()}</span> New mail</button>
          <div class="ol-folders"></div>
          <div class="ol-side-foot">Windows 12 Mail</div>
        </div>
        <div class="ol-list"></div>
        <div class="ol-read"></div>
      </div>
    </div>`;

    const foldersEl = body.querySelector(".ol-folders");
    const listEl = body.querySelector(".ol-list");
    const readEl = body.querySelector(".ol-read");

    function count(fid) { return data.messages.filter((m) => m.folder === fid && !m.read).length; }
    function renderFolders() {
      foldersEl.innerHTML = "";
      FOLDERS.forEach((f) => {
        const c = count(f.id);
        const b = el(`<button class="ol-folder ${folder === f.id ? "on" : ""}"><span class="ol-fic">${FICON[f.icon]}</span><span class="ol-fname">${f.name}</span>${c ? `<span class="ol-fcount">${c}</span>` : ""}</button>`);
        b.onclick = () => { folder = f.id; selectedId = null; renderFolders(); renderList(); renderRead(); };
        foldersEl.appendChild(b);
      });
    }
    function visibleMessages() {
      let ms = data.messages.filter((m) => m.folder === folder);
      if (query) { const q = query.toLowerCase(); ms = ms.filter((m) => (m.from + m.subject + m.body).toLowerCase().includes(q)); }
      return ms.sort((a, b) => b.ts - a.ts);
    }
    function renderList() {
      const ms = visibleMessages();
      const fname = (FOLDERS.find((f) => f.id === folder) || {}).name || "";
      listEl.innerHTML = `<div class="ol-list-head"><b>${fname}</b><span class="muted">${ms.length} item${ms.length === 1 ? "" : "s"}</span></div><div class="ol-list-scroll"></div>`;
      const scroll = listEl.querySelector(".ol-list-scroll");
      if (!ms.length) { scroll.innerHTML = `<div class="ol-empty">${inboxZeroIc()}<p>Nothing here</p></div>`; return; }
      ms.forEach((m) => {
        const row = el(`<button class="ol-item ${m.read ? "" : "unread"} ${selectedId === m.id ? "sel" : ""}">
          ${m.read ? "" : `<span class="ol-unread-dot"></span>`}
          ${avatar(m.from)}
          <div class="ol-item-txt">
            <div class="ol-item-top"><span class="ol-item-from">${esc(m.from)}</span><span class="ol-item-time">${timeAgo(m.ts)}</span></div>
            <div class="ol-item-subj">${esc(m.subject)}</div>
            <div class="ol-item-prev">${esc(m.body.replace(/<[^>]+>/g, " ").trim()).slice(0, 90)}</div>
          </div>
          <span class="ol-item-star ${m.star ? "on" : ""}" title="Flag">${flagIc()}</span>
        </button>`);
        row.onclick = (e) => {
          if (e.target.closest(".ol-item-star")) { m.star = !m.star; State.save(); renderList(); return; }
          selectedId = m.id; if (!m.read) { m.read = true; State.save(); renderFolders(); }
          renderList(); renderRead();
        };
        scroll.appendChild(row);
      });
    }
    function renderRead() {
      const m = data.messages.find((x) => x.id === selectedId);
      if (!m) { readEl.innerHTML = `<div class="ol-read-empty">${mailIc()}<p>Select an item to read</p></div>`; return; }
      readEl.innerHTML = `<div class="ol-read-inner">
        <div class="ol-read-head">
          <h2>${esc(m.subject)}</h2>
          <div class="ol-read-actions">
            <button data-a="reply" title="Reply">${replyIc()}</button>
            <button data-a="replyall" title="Reply all">${replyAllIc()}</button>
            <button data-a="forward" title="Forward">${fwdIc()}</button>
            <button data-a="delete" title="Delete">${FICON.trash}</button>
          </div>
        </div>
        <div class="ol-read-meta">
          ${avatar(m.from)}
          <div class="ol-read-meta-txt"><b>${esc(m.from)}</b> <span class="ol-read-email">&lt;${esc(m.email)}&gt;</span><div class="muted">To: you &middot; ${new Date(m.ts).toLocaleString()}</div></div>
          <button class="ol-read-star ${m.star ? "on" : ""}" title="Flag">${flagIc()}</button>
        </div>
        <div class="ol-read-body">${m.body}</div>
        <div class="ol-read-foot">
          <button class="ol-rbtn" data-a="reply">${replyIc()} Reply</button>
          <button class="ol-rbtn" data-a="forward">${fwdIc()} Forward</button>
        </div>
      </div>`;
      readEl.querySelectorAll("[data-a]").forEach((b) => b.onclick = () => act(b.dataset.a, m));
      readEl.querySelector(".ol-read-star").onclick = () => { m.star = !m.star; State.save(); renderRead(); renderList(); };
    }

    function act(a, m) {
      m = m || data.messages.find((x) => x.id === selectedId);
      if (a === "reply" && m) return compose({ to: m.email, subject: "RE: " + m.subject, body: quoteBody(m) });
      if (a === "replyall" && m) return compose({ to: m.email, subject: "RE: " + m.subject, body: quoteBody(m) });
      if (a === "forward" && m) return compose({ to: "", subject: "FW: " + m.subject, body: quoteBody(m) });
      if (!m) return;
      if (a === "delete") { m.folder = m.folder === "deleted" ? m.folder : "deleted"; selectedId = null; State.save(); refresh(); }
      if (a === "archive") { m.folder = "archive"; selectedId = null; State.save(); refresh(); }
      if (a === "star") { m.star = !m.star; State.save(); refresh(); }
      if (a === "read") { m.read = !m.read; State.save(); refresh(); }
    }
    function quoteBody(m) { return `<br><br><hr><div style="color:#666"><b>From:</b> ${esc(m.from)}<br><b>Subject:</b> ${esc(m.subject)}<br><br>${m.body}</div>`; }

    function compose(pre) {
      pre = pre || {};
      const ov = el(`<div class="ol-compose-ov"><div class="ol-compose-win">
        <div class="ol-compose-bar"><b>New message</b><span class="grow"></span><button class="ol-cw-min" title="Minimize">&#8211;</button><button class="ol-cw-close" title="Close">&times;</button></div>
        <div class="ol-compose-fields">
          <label class="ol-cf"><span>To</span><input class="ol-to" value="${esc(pre.to || "")}"></label>
          <label class="ol-cf"><span>Cc</span><input class="ol-cc"></label>
          <label class="ol-cf"><span>Subject</span><input class="ol-subj" value="${esc(pre.subject || "")}"></label>
        </div>
        <div class="ol-compose-body" contenteditable="true">${pre.body || ""}</div>
        <div class="ol-compose-foot">
          <button class="ol-send">${sendIc()} Send</button>
          <button class="ol-cw-discard" title="Discard">${FICON.trash}</button>
          <span class="grow"></span>
          <span class="ol-sig muted">${esc(data.signature || "")}</span>
        </div>
      </div></div>`);
      const close = () => ov.remove();
      ov.querySelector(".ol-cw-close").onclick = close;
      ov.querySelector(".ol-cw-min").onclick = close;
      ov.querySelector(".ol-cw-discard").onclick = close;
      ov.onclick = (e) => { if (e.target === ov) close(); };
      ov.querySelector(".ol-send").onclick = () => {
        const to = ov.querySelector(".ol-to").value.trim();
        const subj = ov.querySelector(".ol-subj").value.trim() || "(no subject)";
        const bodyHtml = ov.querySelector(".ol-compose-body").innerHTML;
        const sent = { id: "m" + Date.now(), from: (S().profile && S().profile.username) || "You", email: (S().account && S().account.email) || "you@outlook.com", subject: subj, body: bodyHtml, ts: (State.now ? State.now().getTime() : Date.now()), read: true, star: false, folder: "sent", to: to };
        data.messages.push(sent);
        State.save();
        if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("outlook", "Outlook") : "", title: "Message sent", body: "to " + (to || "recipient") });
        close();
        // Friendly auto-reply after a moment.
        if (to) setTimeout(() => {
          const name = to.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          data.messages.push({ id: "m" + (Date.now() + 1), from: name || "Auto Reply", email: to, subject: "RE: " + subj, body: "<p>Thanks for your message — I'll get back to you soon.</p><p>" + esc(name) + "</p>", ts: (State.now ? State.now().getTime() : Date.now()), read: false, star: false, folder: "inbox" });
          State.save();
          if (folder === "inbox") { renderFolders(); renderList(); }
          if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("outlook", "Outlook") : "", title: name || "New mail", body: "RE: " + subj });
        }, 4000);
        folder = "sent"; selectedId = sent.id; refresh(); renderRead();
      };
      body.appendChild(ov);
      setTimeout(() => ov.querySelector(pre.to ? ".ol-compose-body" : ".ol-to").focus(), 30);
    }

    function refresh() { renderFolders(); renderList(); renderRead(); }

    body.querySelector(".ol-new").onclick = () => compose();
    body.querySelector(".ol-compose").onclick = () => compose();
    body.querySelectorAll(".ol-ribbon-tools .ol-rtool").forEach((b) => b.onclick = () => act(b.dataset.a));
    body.querySelector(".ol-search-in").oninput = (e) => { query = e.target.value; renderList(); };

    refresh();

    function plusIc() { return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`; }
    function replyIc() { return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M9 17l-6-5 6-5v3c6 0 9 3 10 8-3-3-6-4-10-4z"/></svg>`; }
    function replyAllIc() { return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7 17l-5-5 5-5M13 17l-5-5 5-5M13 12c5 0 8 3 9 8-3-4-6-4-9-4z"/></svg>`; }
    function fwdIc() { return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M15 17l6-5-6-5v3C9 10 6 13 5 18c3-3 6-4 10-4z"/></svg>`; }
    function flagIc() { return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M5 21V4h11l-1.5 3L16 10H5"/></svg>`; }
    function readIc() { return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`; }
    function searchIc() { return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`; }
    function sendIc() { return `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>`; }
    function mailIc() { return `<svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`; }
    function inboxZeroIc() { return `<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M4 13l2-8h12l2 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 13h5l1 2h4l1-2h5"/></svg>`; }
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.outlook = openOutlook;
})();
