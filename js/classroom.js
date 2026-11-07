/* Google Classroom — class cards + a class stream with announcements and work. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  const cw = (opts) => window.WM.createWindow(opts);
  const mini = (k, n) => (window.Icon ? Icon.mini(k, n) : "");

  const CLASSES = [
    { name: "AP Biology", section: "Period 2", teacher: "Mrs. Rodriguez", c: "#1e8e3e", due: "Cell Division Lab — due Fri" },
    { name: "World History", section: "Period 3", teacher: "Mr. Chen", c: "#4285f4", due: "WWI Essay — due Mon" },
    { name: "Algebra II", section: "Period 4", teacher: "Ms. Patel", c: "#a142f4", due: "Quadratics p.142 — due Thu" },
    { name: "English Literature", section: "Period 1", teacher: "Mr. Thompson", c: "#e37400", due: "Gatsby Ch. 5 reading" },
    { name: "Chemistry", section: "Period 5", teacher: "Dr. Kim", c: "#d93025", due: "Stoichiometry set 3" },
    { name: "Computer Science", section: "Period 6", teacher: "Ms. Anderson", c: "#00897b", due: "Project: To-do app" },
  ];

  // Classwork: a few assignments per class (the first one is the card's "due" item).
  const WORK = {
    "AP Biology": [["Cell Division Lab", "Due Fri", 50, "Complete the mitosis lab worksheet and upload your data table and a photo of your microscope drawings."], ["Photosynthesis Diagram", "Due next Tue", 20, "Label the light-dependent and light-independent reactions. Upload as an image or document."], ["Genetics Problem Set", "Due next Fri", 30, "Answer questions 1–15 on Punnett squares. Show your work."]],
    "World History": [["WWI Essay", "Due Mon", 100, "Write a 5-paragraph essay on the main causes of World War I (MAIN: militarism, alliances, imperialism, nationalism)."], ["Primary Source Analysis", "Due Wed", 25, "Read the Zimmermann Telegram and answer the analysis questions."], ["Timeline Project", "Due next Mon", 50, "Make a timeline of 10 key events from 1914–1918."]],
    "Algebra II": [["Quadratics p.142", "Due Thu", 20, "Complete problems 1–31 odd on page 142. Upload a photo or document of your work."], ["Graphing Parabolas", "Due next Mon", 25, "Graph each function, label the vertex, axis of symmetry and intercepts."], ["Unit 3 Review", "Due next Thu", 40, "Finish the review packet before the unit test."]],
    "English Literature": [["Gatsby Ch. 5 Reading", "Due Tue", 10, "Read chapter 5 and write a one-paragraph response about the reunion of Gatsby and Daisy."], ["Symbolism Journal", "Due Fri", 25, "Track the green light, the valley of ashes and the eyes of T. J. Eckleburg."], ["Literary Analysis Essay", "Due in 2 weeks", 100, "Argue how Fitzgerald portrays the American Dream. 4–6 pages, MLA format."]],
    "Chemistry": [["Stoichiometry Set 3", "Due Wed", 30, "Solve the 12 stoichiometry problems. Include units and significant figures."], ["Lab Report: Reaction Rates", "Due next Mon", 50, "Write up the reaction rates lab: purpose, procedure, data, analysis, conclusion."], ["Periodic Trends Worksheet", "Due next Wed", 20, "Explain trends in atomic radius, ionization energy and electronegativity."]],
    "Computer Science": [["Project: To-do App", "Due Fri", 100, "Build a to-do list app with add, complete and delete. Upload your code files or a link to your project."], ["Loops Practice", "Due Tue", 20, "Write 5 small programs that use for and while loops."], ["Algorithm Flowchart", "Due next Thu", 25, "Draw a flowchart for binary search and upload it."]],
  };
  const S = () => window.State && State.data;
  const save = () => { if (window.State) State.save(); };
  const store = () => { const d = S(); if (!d) return { work: {} }; if (!d.appData) d.appData = {}; if (!d.appData.classroom) d.appData.classroom = { work: {} }; if (!d.appData.classroom.work) d.appData.classroom.work = {}; return d.appData.classroom; };
  const isSchool = () => { const d = S(); return !!(d && d.appData && (d.appData.usage === "school" || d.appData.schoolFolders)); };
  // Homework/<Class> folder in File Explorer (only in School mode).
  function homeworkFolder(className) {
    if (!window.VFS) return null;
    const root = VFS.ensure();
    if (!root.Homework || root.Homework.type !== "folder") root.Homework = { type: "folder", children: {} };
    const ch = root.Homework.children;
    if (!ch[className] || ch[className].type !== "folder") ch[className] = { type: "folder", children: {} };
    return ch[className].children;
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fmtSize = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  const MAX_UPLOAD = 2 * 1048576; // keep the saved state small

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.classroom = function () {
    const ref = cw({ title: "Classroom", icon: mini("classroom", "Classroom"), width: 940, height: 620, appId: "classroom" });
    const body = ref.body; body.classList.add("gc-host");

    function header(title) {
      return `<div class="gc-top"><button class="gc-menu">&#9776;</button><span class="gc-brand"><img src="assets/classroom.png?v=9" alt="">Classroom</span><span class="grow"></span><button class="gc-plus" title="Join or create">+</button><span class="gc-av">${esc((window.State && State.data.profile && State.data.profile.username || "S")[0].toUpperCase())}</span></div>`;
    }

    function home() {
      body.innerHTML = header() + `<div class="gc-body"><div class="gc-cards"></div></div>`;
      const cards = body.querySelector(".gc-cards");
      CLASSES.forEach((cl) => {
        const card = el(`<button class="gc-card">
          <div class="gc-card-head" style="background:${cl.c}"><div class="gc-card-name">${esc(cl.name)}</div><div class="gc-card-sec">${esc(cl.section)} · ${esc(cl.teacher)}</div><div class="gc-card-badge">${esc(cl.teacher.split(" ").pop()[0])}</div></div>
          <div class="gc-card-body"><div class="gc-card-due">📌 ${esc(cl.due)}</div></div>
          <div class="gc-card-foot"><span title="Assignments">📝</span><span title="Folder">📁</span></div>
        </button>`);
        card.onclick = () => classView(cl);
        cards.appendChild(card);
      });
      body.querySelector(".gc-plus").onclick = () => { if (window.Notify) Notify.show({ icon: mini("classroom", "Classroom"), title: "Classroom", body: "Enter a class code to join a class." }); };
    }

    function classView(cl, tab) {
      tab = tab || "stream";
      const work = WORK[cl.name] || [];
      body.innerHTML = header() + `<div class="gc-class">
        <div class="gc-tabs"><button class="gc-tab ${tab === "stream" ? "on" : ""}" data-t="stream">Stream</button><button class="gc-tab ${tab === "work" ? "on" : ""}" data-t="work">Classwork</button></div>
        <div class="gc-hero" style="background:${cl.c}"><button class="gc-back">&#8592;</button><div class="gc-hero-name">${esc(cl.name)}</div><div class="gc-hero-sec">${esc(cl.section)} · ${esc(cl.teacher)}</div></div>
        ${tab === "stream" ? `<div class="gc-stream">
          <div class="gc-side"><div class="gc-side-card"><b>Upcoming</b><p>${esc(cl.due)}</p><button class="gc-viewall">View all</button></div></div>
          <div class="gc-feed">
            <button class="gc-announce">Announce something to your class</button>
            ${[["Reminder: quiz this Friday covers chapters 4–5. Study the review sheet in the Classwork tab.", cl.teacher, "2 days ago"], ["Great work on the last assignment, everyone! Grades are posted.", cl.teacher, "4 days ago"], ["New assignment posted: " + cl.due + ". Submit before the deadline.", cl.teacher, "6 days ago"]].map(([txt, who, when]) => `<div class="gc-post"><div class="gc-post-av" style="background:${cl.c}">${esc(who.split(" ").pop()[0])}</div><div class="gc-post-body"><div class="gc-post-who">${esc(who)}<span>${esc(when)}</span></div><p>${esc(txt)}</p></div></div>`).join("")}
          </div>
        </div>` : `<div class="gc-worklist">${work.map((w, i) => { const st = store().work[cl.name + "::" + w[0]]; const done = st && st.turnedIn; return `<button class="gc-witem" data-i="${i}"><span class="gc-wic" style="background:${done ? "#1e8e3e" : cl.c}">${done ? "✓" : "📝"}</span><span class="gc-wt"><b>${esc(w[0])}</b><span>${esc(w[1])} · ${w[2]} points</span></span><span class="gc-wst ${done ? "done" : ""}">${done ? "Turned in" : st && (st.files || []).length ? "Draft" : "Assigned"}</span></button>`; }).join("")}</div>`}
      </div>`;
      body.querySelector(".gc-back").onclick = home;
      body.querySelectorAll(".gc-tab").forEach((b) => b.onclick = () => classView(cl, b.dataset.t));
      const va = body.querySelector(".gc-viewall"); if (va) va.onclick = () => classView(cl, "work");
      body.querySelectorAll(".gc-witem").forEach((b) => b.onclick = () => assignment(cl, work[+b.dataset.i]));
    }

    // Assignment page: instructions + "Your work" card (add files, links, turn in).
    function assignment(cl, w) {
      const key = cl.name + "::" + w[0];
      const st = store().work[key] || (store().work[key] = { files: [], turnedIn: false });
      if (!st.files) st.files = [];
      body.innerHTML = header() + `<div class="gc-class"><div class="gc-assign">
        <div class="gc-a-main">
          <button class="gc-a-back">&#8592; ${esc(cl.name)}</button>
          <div class="gc-a-head"><span class="gc-wic big" style="background:${cl.c}">📝</span><div><h2>${esc(w[0])}</h2><div class="gc-a-meta">${esc(cl.teacher)} · ${w[2]} points · ${esc(w[1])}</div></div></div>
          <p class="gc-a-ins">${esc(w[3])}</p>
        </div>
        <div class="gc-a-side"><div class="gc-yw">
          <div class="gc-yw-h"><b>Your work</b><span class="gc-yw-st"></span></div>
          <div class="gc-yw-files"></div>
          <div class="gc-yw-add"><button class="gc-addbtn">+ Add or create</button><div class="gc-addmenu" hidden>
            <button data-a="pc">📁 File from this PC</button><button data-a="upload">⬆️ Upload from device</button><button data-a="link">🔗 Link</button><button data-a="doc">📄 New Word document</button></div></div>
          <button class="gc-turnin"></button>
          <div class="gc-yw-note"></div>
        </div></div>
      </div></div>`;
      body.querySelector(".gc-a-back").onclick = () => classView(cl, "work");
      const filesEl = body.querySelector(".gc-yw-files"), menu = body.querySelector(".gc-addmenu"), addBtn = body.querySelector(".gc-addbtn"), tBtn = body.querySelector(".gc-turnin"), note = body.querySelector(".gc-yw-note");

      function render() {
        body.querySelector(".gc-yw-st").textContent = st.turnedIn ? "Turned in" : "Assigned";
        body.querySelector(".gc-yw-st").className = "gc-yw-st" + (st.turnedIn ? " done" : "");
        filesEl.innerHTML = st.files.length ? "" : `<div class="gc-yw-empty">No files attached yet</div>`;
        st.files.forEach((f, i) => {
          const row = el(`<div class="gc-att"><span class="gc-att-ic">${f.link ? "🔗" : f.node && f.node.kind === "image" ? "🖼️" : f.node && f.node.kind === "word" ? "📄" : "📎"}</span><button class="gc-att-name" title="Open">${esc(f.name)}</button>${st.turnedIn ? "" : `<button class="gc-att-x" title="Remove">✕</button>`}</div>`);
          row.querySelector(".gc-att-name").onclick = () => {
            if (f.link) { if (window.Browser && Browser.openTo) Browser.openTo(f.link); }
            else if (window.VFS) VFS.openNode(f.name, f.node);
          };
          const x = row.querySelector(".gc-att-x"); if (x) x.onclick = () => { st.files.splice(i, 1); save(); render(); };
          filesEl.appendChild(row);
        });
        addBtn.parentElement.hidden = st.turnedIn;
        tBtn.textContent = st.turnedIn ? "Unsubmit" : st.files.length ? "Turn in" : "Mark as done";
        tBtn.className = "gc-turnin" + (st.turnedIn ? " un" : "");
        note.textContent = st.turnedIn ? (st.savedTo ? "Turned in " + new Date(st.turnedInAt).toLocaleString() + " · copies saved to " + st.savedTo : "Turned in " + new Date(st.turnedInAt).toLocaleString()) : isSchool() ? "When you turn in, your files are also saved to the Homework folder." : "";
      }
      function attach(name, node) { st.files.push({ name, node: clone(node) }); save(); render(); }

      addBtn.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
      body.onclick = () => { const m = body.querySelector(".gc-addmenu"); if (m) m.hidden = true; };
      menu.querySelectorAll("button").forEach((b) => b.onclick = (e) => {
        e.stopPropagation(); menu.hidden = true; const a = b.dataset.a;
        if (a === "pc" && window.VFS) VFS.pickFile({ title: "Add a file" }, (r) => { if (r && r.node && r.node.type === "file") attach(r.name, r.node); });
        if (a === "upload") {
          const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true; inp.style.display = "none"; document.body.appendChild(inp);
          inp.onchange = () => {
            [...inp.files].forEach((file) => {
              const isImg = /^image\//.test(file.type), isText = /^text\/|json|javascript|xml/.test(file.type) || /\.(txt|md|csv|js|py|html|css|json)$/i.test(file.name);
              if (!isText && file.size > MAX_UPLOAD) { attach(file.name, { type: "file", kind: "other", content: "", size: file.size, mime: file.type, note: "Too big to keep a copy (" + fmtSize(file.size) + ")", ts: Date.now() }); return; }
              const r = new FileReader();
              r.onload = () => attach(file.name, isImg ? { type: "file", kind: "image", src: r.result, size: file.size, ts: Date.now() } : isText ? { type: "file", kind: "text", content: String(r.result || ""), size: file.size, ts: Date.now() } : { type: "file", kind: "other", src: r.result, size: file.size, mime: file.type, ts: Date.now() });
              if (isText) r.readAsText(file); else r.readAsDataURL(file);
            });
            inp.remove();
          };
          inp.click();
        }
        if (a === "link") {
          const u = prompt("Paste a link"); if (!u) return;
          st.files.push({ name: u.replace(/^https?:\/\//, "").slice(0, 60), link: u }); save(); render();
        }
        if (a === "doc" && window.VFS) {
          const docs = VFS.childrenAt(["Documents"]) || VFS.ensure().Documents.children;
          const nm = VFS.uniqueName(docs, w[0], ".docx"); const node = { type: "file", kind: "word", content: "<h1>" + esc(w[0]) + "</h1><p></p>", ts: Date.now() };
          docs[nm] = node; save(); attach(nm, node); VFS.openNode(nm, node);
        }
      });

      tBtn.onclick = () => {
        if (st.turnedIn) { st.turnedIn = false; save(); render(); return; }
        st.turnedIn = true; st.turnedInAt = Date.now(); st.savedTo = "";
        if (isSchool()) {
          const dest = homeworkFolder(cl.name); let n = 0;
          if (dest) st.files.forEach((f) => {
            if (f.copied) return;
            if (f.link) { const nm = VFS.uniqueName(dest, (w[0] + " link").replace(/[\\/:*?"<>|]/g, ""), ".url"); dest[nm] = { type: "file", kind: "text", content: f.link, ts: Date.now() }; }
            else { const m = f.name.match(/^(.*?)(\.[^.]+)?$/); const nm = VFS.uniqueName(dest, m[1], m[2] || ""); dest[nm] = Object.assign(clone(f.node), { ts: Date.now(), assignment: w[0] }); }
            f.copied = true; n++;
          });
          st.savedTo = "Homework › " + cl.name;
          if (window.Notify) Notify.show({ icon: mini("classroom", "Classroom"), title: "Turned in: " + w[0], body: n ? n + " file" + (n === 1 ? "" : "s") + " saved to Homework › " + cl.name : "Your work was turned in." });
        } else if (window.Notify) Notify.show({ icon: mini("classroom", "Classroom"), title: "Turned in", body: w[0] });
        save(); render();
      };
      render();
    }

    home();
  };
  window.Classroom = { WORK, homeworkFolder, isSchool };
})();
