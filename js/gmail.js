/* Gmail — inbox with tabs, reading pane, star, compose, and labels. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  const cw = (opts) => window.WM.createWindow(opts);
  const S = () => State.data;
  const mini = (k, n) => (window.Icon ? Icon.mini(k, n) : "");

  const AV = ["#db4437", "#4285f4", "#0f9d58", "#f4b400", "#a142f4", "#00897b", "#e91e63", "#ff7043"];
  function seed() {
    const you = (S().profile && S().profile.username) || "You";
    return [
      { id: 1, from: "Google", email: "no-reply@accounts.google.com", subj: "Security alert", snip: "A new sign-in on Windows. If this was you, you don't need to do anything.", body: "A new sign-in on Windows\n\nWe noticed a new sign-in to your Google Account on a Windows device. If this was you, you don't need to do anything. If not, we'll help you secure your account.", tab: "primary", time: "9:41 AM", read: false, star: false },
      { id: 2, from: "GitHub", email: "noreply@github.com", subj: "[cgrodsky/cgrodsky] Your build passed", snip: "The workflow run for claude/windows-12-setup completed successfully.", body: "Your build passed ✅\n\nThe latest push to claude/windows-12-setup-experience-FsKgd built and deployed successfully to GitHub Pages.", tab: "updates", time: "8:12 AM", read: false, star: true },
      { id: 3, from: "Canva", email: "hello@canva.com", subj: "Your design is ready to share", snip: "Nice work! Your latest design has been saved. Invite your team to collaborate.", body: "Your design is ready to share\n\nNice work on your latest design! Share it with your team or export it in one click.", tab: "promotions", time: "Yesterday", read: true, star: false },
      { id: 4, from: "Xbox", email: "xbox@microsoft.com", subj: "New this week on Game Pass", snip: "GTA V, Forza Horizon 6, and more just landed on Game Pass.", body: "New this week on Game Pass 🎮\n\nGTA V, Forza Horizon 6, Hades, and more just landed. Jump in and play now.", tab: "promotions", time: "Yesterday", read: true, star: false },
      { id: 5, from: "Mrs. Rodriguez", email: "rodriguez@school.edu", subj: "Reminder: Biology quiz Friday", snip: "Hi class — a reminder that Friday's quiz covers chapters 4–5. Review sheets are posted.", body: "Hi class,\n\nJust a reminder that Friday's quiz covers chapters 4 and 5. Review sheets are posted in the Classwork tab. Good luck!\n\n— Mrs. Rodriguez", tab: "primary", time: "Mon", read: true, star: false },
      { id: 6, from: "LinkedIn", email: "notifications@linkedin.com", subj: "You appeared in 9 searches this week", snip: "See who's been looking at your profile and grow your network.", body: "You appeared in 9 searches this week\n\nRecruiters and connections have been finding you. See who viewed your profile.", tab: "social", time: "Sun", read: true, star: false },
      { id: 7, from: "Forge Bank", email: "alerts@forgebank.com", subj: "Your statement is ready", snip: "Your monthly statement is now available to view in online banking.", body: "Your statement is ready\n\nYour monthly Forge Bank statement is now available. Log in to review your transactions.", tab: "updates", time: "Sun", read: true, star: false },
    ];
    void you;
  }

  const TABS = [["primary", "Primary", "inbox"], ["promotions", "Promotions", "tag"], ["social", "Social", "people"], ["updates", "Updates", "info"]];

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.gmail = function () {
    const ref = cw({ title: "Gmail", icon: mini("gapp_gmail", "Gmail"), width: 1040, height: 660, appId: "gmail" });
    const body = ref.body; body.classList.add("gm-host");
    if (!S().appData) S().appData = {};
    const store = S().appData.gmail || (S().appData.gmail = { mail: seed() });
    let mail = store.mail;
    let folder = "inbox", tab = "primary", openId = null;
    const uname = (S().profile && S().profile.username) || "You";

    body.innerHTML = `<div class="gm">
      <div class="gm-top">
        <button class="gm-burger">&#9776;</button>
        <span class="gm-logo"><img src="assets/gapp_gmail.png?v=1" alt="">Gmail</span>
        <div class="gm-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#5f6368" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input placeholder="Search mail"></div>
        <span class="grow"></span>
        <button class="gm-ic" title="Google apps"><svg viewBox="0 0 24 24" width="20" height="20" fill="#5f6368"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg></button>
        <span class="gm-avatar" style="background:${AV[1]}">${esc(uname[0].toUpperCase())}</span>
      </div>
      <div class="gm-body">
        <div class="gm-side">
          <button class="gm-compose"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Compose</button>
          <div class="gm-folders"></div>
        </div>
        <div class="gm-main">
          <div class="gm-tabs"></div>
          <div class="gm-list"></div>
        </div>
      </div>
    </div>`;

    const FOLDERS = [["inbox", "Inbox"], ["starred", "Starred"], ["snoozed", "Snoozed"], ["sent", "Sent"], ["drafts", "Drafts"], ["important", "Important"], ["spam", "Spam"], ["trash", "Trash"]];
    const foldersEl = body.querySelector(".gm-folders");
    function unread() { return mail.filter((m) => m.tab === "primary" && !m.read && folderMatch(m, "inbox")).length; }
    function folderMatch(m, f) { if (f === "inbox") return true; if (f === "starred") return m.star; return false; }
    function renderFolders() {
      foldersEl.innerHTML = "";
      FOLDERS.forEach(([id, name]) => {
        const n = id === "inbox" ? mail.filter((m) => !m.read).length : (id === "starred" ? mail.filter((m) => m.star).length : 0);
        const r = el(`<button class="gm-folder ${id === folder ? "on" : ""}">${gmFolderIcon(id)}<span>${name}</span>${n ? `<b>${n}</b>` : ""}</button>`);
        r.onclick = () => { folder = id; openId = null; render(); };
        foldersEl.appendChild(r);
      });
    }
    function gmFolderIcon(id) {
      if (id === "sent") return `<img class="gm-fic" src="assets/gmail_sent.png?v=1" alt="" style="width:18px;height:18px;object-fit:contain">`;
      const P = { inbox: "M4 4h16v16H4z M4 13h4l2 3h4l2-3h4", starred: "M12 3l2.9 6 6.1.9-4.5 4.3 1.1 6.1L12 17l-5.6 3.3 1.1-6.1L3 9.9 9.1 9z", drafts: "M6 3h8l4 4v14H6z", snoozed: "M12 3a9 9 0 1 0 9 9M12 8v4l3 2", important: "M4 5l7 7-7 7M13 5h6v14", spam: "M12 3l9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V8z", trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" };
      return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${P[id] || P.inbox}"/></svg>`;
    }

    const tabsEl = body.querySelector(".gm-tabs");
    function renderTabs() {
      tabsEl.innerHTML = "";
      if (folder !== "inbox") { tabsEl.style.display = "none"; return; }
      tabsEl.style.display = "flex";
      TABS.forEach(([id, name]) => {
        const n = mail.filter((m) => m.tab === id && !m.read).length;
        const t = el(`<button class="gm-tab ${id === tab ? "on" : ""}"><span>${name}</span>${n ? `<em>${n} new</em>` : ""}</button>`);
        t.onclick = () => { tab = id; openId = null; render(); };
        tabsEl.appendChild(t);
      });
    }

    const listEl = body.querySelector(".gm-list");
    function visibleMail() {
      if (folder === "starred") return mail.filter((m) => m.star);
      if (folder === "inbox") return mail.filter((m) => m.tab === tab);
      return [];
    }
    function renderList() {
      if (openId != null) return renderReading();
      const items = visibleMail();
      listEl.className = "gm-list";
      listEl.innerHTML = items.length ? "" : `<div class="gm-empty">Nothing in ${folder}.</div>`;
      items.forEach((m) => {
        const row = el(`<div class="gm-row ${m.read ? "" : "unread"}" data-id="${m.id}">
          <button class="gm-star ${m.star ? "on" : ""}" title="Star">${m.star ? "★" : "☆"}</button>
          <span class="gm-av" style="background:${AV[m.id % AV.length]}">${esc(m.from[0])}</span>
          <span class="gm-from">${esc(m.from)}</span>
          <span class="gm-subj"><b>${esc(m.subj)}</b> <span class="gm-snip">— ${esc(m.snip)}</span></span>
          <span class="gm-time">${esc(m.time)}</span>
        </div>`);
        row.querySelector(".gm-star").onclick = (e) => { e.stopPropagation(); m.star = !m.star; State.save(); render(); };
        row.onclick = () => { m.read = true; openId = m.id; State.save(); render(); };
        listEl.appendChild(row);
      });
    }
    function renderReading() {
      const m = mail.find((x) => x.id === openId); if (!m) { openId = null; return renderList(); }
      listEl.className = "gm-list gm-reading";
      listEl.innerHTML = `<div class="gm-read-bar"><button class="gm-back" title="Back">&#8592;</button><button class="gm-star ${m.star ? "on" : ""}" title="Star">${m.star ? "★" : "☆"}</button></div>
        <div class="gm-read"><h1>${esc(m.subj)}</h1>
          <div class="gm-read-from"><span class="gm-av lg" style="background:${AV[m.id % AV.length]}">${esc(m.from[0])}</span><div><b>${esc(m.from)}</b> <span class="muted">&lt;${esc(m.email)}&gt;</span><div class="muted">to me · ${esc(m.time)}</div></div></div>
          <div class="gm-read-body">${esc(m.body).replace(/\n/g, "<br>")}</div>
          <div class="gm-read-actions"><button class="gm-reply">↩ Reply</button><button class="gm-reply">↪ Forward</button></div>
        </div>`;
      listEl.querySelector(".gm-back").onclick = () => { openId = null; render(); };
      listEl.querySelector(".gm-star").onclick = () => { m.star = !m.star; State.save(); render(); };
      listEl.querySelectorAll(".gm-reply").forEach((b) => b.onclick = () => compose({ to: m.email, subject: "Re: " + m.subj }));
    }

    function compose(pre) {
      pre = pre || {};
      const modal = el(`<div class="gm-compose-modal"><div class="gm-cm-head"><span>New Message</span><button class="gm-cm-x">&times;</button></div>
        <input class="gm-cm-to" placeholder="To" value="${esc(pre.to || "")}">
        <input class="gm-cm-subj" placeholder="Subject" value="${esc(pre.subject || "")}">
        <textarea class="gm-cm-body" placeholder="Compose your message…"></textarea>
        <div class="gm-cm-foot"><button class="gm-cm-send">Send</button><button class="gm-cm-trash" title="Discard">🗑</button></div></div>`);
      body.appendChild(modal);
      modal.querySelector(".gm-cm-x").onclick = modal.querySelector(".gm-cm-trash").onclick = () => modal.remove();
      modal.querySelector(".gm-cm-send").onclick = () => { modal.remove(); if (window.Notify) Notify.show({ icon: mini("gapp_gmail", "Gmail"), title: "Gmail", body: "Message sent." }); };
      setTimeout(() => modal.querySelector(".gm-cm-to").focus(), 40);
    }
    body.querySelector(".gm-compose").onclick = () => compose();

    function render() { renderFolders(); renderTabs(); renderList(); }
    render();
  };
})();
