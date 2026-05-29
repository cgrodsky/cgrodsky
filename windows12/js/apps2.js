/* Additional working built-in apps mapped from the Store catalog. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);
  function store(key, def) { if (S().appData[key] == null) S().appData[key] = def; return S().appData[key]; }
  function pad(n) { return n.toString().padStart(2, "0"); }

  // ---------- To Do ----------
  AppRegistry.todo = function () {
    const { body } = cw({ title: "To Do", icon: Icon.mini("todo", "To Do"), width: 420, height: 520 });
    const data = store("todo", []);
    body.innerHTML = `<div style="padding:16px;height:100%;display:flex;flex-direction:column;gap:12px">
      <h2 style="margin:0">My Tasks</h2>
      <div class="row"><input id="t" class="grow" style="padding:10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-elev);color:var(--text)" placeholder="Add a task"><button class="pill-btn" id="add">Add</button></div>
      <div id="list" style="flex:1;overflow:auto"></div></div>`;
    const list = body.querySelector("#list"), input = body.querySelector("#t");
    function render() {
      list.innerHTML = "";
      data.forEach((task, i) => {
        const r = el(`<div class="row" style="padding:8px;border-bottom:1px solid var(--border)">
          <input type="checkbox" ${task.done ? "checked" : ""} style="width:auto">
          <span class="grow" style="${task.done ? "text-decoration:line-through;opacity:.6" : ""}">${escapeHtml(task.text)}</span>
          <button class="btn-text del">Delete</button></div>`);
        r.querySelector("input").onchange = () => { task.done = !task.done; State.save(); render(); };
        r.querySelector(".del").onclick = () => { data.splice(i, 1); State.save(); render(); };
        list.appendChild(r);
      });
      if (!data.length) list.innerHTML = `<p class="muted">No tasks yet.</p>`;
    }
    const add = () => { const v = input.value.trim(); if (!v) return; data.push({ text: v, done: false }); input.value = ""; State.save(); render(); };
    body.querySelector("#add").onclick = add;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    render();
  };

  // ---------- Sticky Notes ----------
  AppRegistry.stickynotes = function () {
    const { body } = cw({ title: "Sticky Notes", icon: Icon.mini("stickynotes", "Notes"), width: 360, height: 420 });
    const data = store("sticky", { text: "" });
    body.innerHTML = `<textarea style="width:100%;height:100%;border:none;outline:none;resize:none;padding:16px;background:#fff8b0;color:#222;font-size:1.05rem;font-family:Segoe UI,sans-serif">${escapeHtml(data.text)}</textarea>`;
    const ta = body.querySelector("textarea");
    ta.oninput = () => { data.text = ta.value; State.save(); };
  };

  // ---------- Weather ----------
  AppRegistry.weather = function () {
    const { body } = cw({ title: "Weather", icon: Icon.mini("weather", "Weather"), width: 480, height: 460 });
    const region = S().region || "Your area";
    const seed = [...region].reduce((a, c) => a + c.charCodeAt(0), 0);
    const conditions = ["Sunny", "Partly cloudy", "Cloudy", "Light rain", "Showers", "Clear"];
    const base = 12 + (seed % 18);
    const days = ["Today", "Tomorrow", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const rows = days.map((d, i) => {
      const c = conditions[(seed + i) % conditions.length];
      const hi = base + ((seed + i * 7) % 8), lo = hi - 5 - ((seed + i) % 4);
      return `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--border)"><span class="grow">${d}</span><span class="muted" style="width:120px">${c}</span><span>${hi}° / ${lo}°</span></div>`;
    }).join("");
    body.innerHTML = `<div style="padding:20px">
      <div class="muted">${region}</div>
      <div style="font-size:3.4rem;font-weight:300">${base + (seed % 8)}°</div>
      <div class="muted">${conditions[seed % conditions.length]}</div>
      <h3>7-day forecast</h3>${rows}</div>`;
  };

  // ---------- Calendar ----------
  AppRegistry.calendar = function () {
    const { body } = cw({ title: "Calendar", icon: Icon.mini("calendar", "Calendar"), width: 460, height: 460 });
    let view = State.now();
    function render() {
      const y = view.getFullYear(), m = view.getMonth();
      const first = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      const today = State.now();
      const monthName = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      let cells = "";
      ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach((d) => cells += `<div class="muted" style="text-align:center;font-size:.75rem">${d}</div>`);
      for (let i = 0; i < first; i++) cells += "<div></div>";
      for (let d = 1; d <= days; d++) {
        const isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
        cells += `<div style="text-align:center;padding:8px 0;border-radius:8px;${isToday ? "background:var(--accent);color:#fff" : ""}">${d}</div>`;
      }
      body.innerHTML = `<div style="padding:16px">
        <div class="row"><button class="btn-text" id="prev">&#8249;</button><h2 class="grow" style="text-align:center;margin:0">${monthName}</h2><button class="btn-text" id="next">&#8250;</button></div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:12px">${cells}</div></div>`;
      body.querySelector("#prev").onclick = () => { view = new Date(y, m - 1, 1); render(); };
      body.querySelector("#next").onclick = () => { view = new Date(y, m + 1, 1); render(); };
    }
    render();
  };

  // ---------- News ----------
  AppRegistry.news = function () {
    const { body } = cw({ title: "News", icon: Icon.mini("news", "News"), width: 560, height: 540 });
    const items = [
      ["Tech", "Windows 12 simulation wins imaginary award", "Reviewers praise its fake-but-functional charm."],
      ["World", "Scientists confirm the sky is, in fact, blue", "Due to Rayleigh scattering, they note."],
      ["Finance", "Forge Bank reports record simulated deposits", "Customers spent it all on Amazon anyway."],
      ["Gaming", "Tic-Tac-Toe esports league announced", "Prize pool: bragging rights."],
      ["Science", "New study: clicking 'Skip' saves 25 seconds", "Researchers stunned."],
      ["Local", "On-screen keyboard befriends real keyboard", "Heartwarming story inside."],
    ];
    body.innerHTML = `<div class="site"><h1>Today's headlines</h1>${items.map((it) =>
      `<div style="padding:14px 0;border-bottom:1px solid var(--border)"><div class="muted" style="font-size:.75rem;text-transform:uppercase">${it[0]}</div><h3 style="margin:4px 0">${it[1]}</h3><div class="muted">${it[2]}</div></div>`).join("")}</div>`;
  };

  // ---------- Terminal ----------
  AppRegistry.terminal = function () {
    const winRef = cw({ title: "Terminal", icon: Icon.mini("terminal", "Terminal"), width: 680, height: 440 });
    const body = winRef.body;
    body.innerHTML = `<div style="height:100%;background:#0c0c0c;color:#cccccc;font-family:Consolas,monospace;font-size:.9rem;padding:12px;overflow:auto" id="term">
      <div style="color:#16c60c">Windows 12 Terminal [Version 12.0.2026]</div>
      <div>(c) Cameron Systems. All rights reserved (not really).</div>
      <div style="color:#888">Type 'help' for the list of commands.</div>
      <div id="out"></div>
      <div class="row"><span class="prompt" style="color:#16c60c"></span>&nbsp;<input id="cmd" style="flex:1;background:none;border:none;color:#fff;outline:none;font-family:inherit;font-size:.9rem"></div></div>`;
    const out = body.querySelector("#out"), cmd = body.querySelector("#cmd"), promptEl = body.querySelector(".prompt");
    const print = (s, color) => { const d = document.createElement("div"); d.textContent = s; if (color) d.style.color = color; out.appendChild(d); };
    const printHTML = (h) => { const d = document.createElement("div"); d.innerHTML = h; out.appendChild(d); };

    // tiny in-memory filesystem
    const fs = {
      "C:\\": { type: "dir", children: { "Users": null, "Windows": null, "Program Files": null } },
      "C:\\Users": { type: "dir", children: { "User": null } },
      "C:\\Users\\User": { type: "dir", children: { "Documents": null, "Downloads": null, "Pictures": null, "Music": null, "Videos": null, "Desktop": null } },
      "C:\\Users\\User\\Documents": { type: "dir", children: { "readme.txt": "f", "todo.txt": "f" } },
      "C:\\Users\\User\\Desktop": { type: "dir", children: {} },
      "C:\\Users\\User\\Downloads": { type: "dir", children: {} },
      "C:\\Users\\User\\Pictures": { type: "dir", children: {} },
      "C:\\Users\\User\\Music": { type: "dir", children: {} },
      "C:\\Users\\User\\Videos": { type: "dir", children: {} },
      "C:\\Windows": { type: "dir", children: { "System32": null } },
      "C:\\Windows\\System32": { type: "dir", children: {} },
      "C:\\Program Files": { type: "dir", children: {} },
    };
    const fileContents = {
      "readme.txt": "Welcome to the Windows 12 simulation!\nThis is a fake filesystem inside the Terminal.\nTry: dir, cd, cat, calc, ping, ipconfig, color green",
      "todo.txt": "- finish Windows 12 simulation\n- ship it\n- celebrate",
    };

    let cwd = "C:\\Users\\User";
    const history = [];
    let histIdx = -1;
    const setPrompt = () => { promptEl.textContent = cwd + ">"; };
    setPrompt();

    function resolvePath(p) {
      if (!p) return cwd;
      if (p === "..") {
        const parts = cwd.split("\\").filter(Boolean);
        if (parts.length > 1) parts.pop();
        return parts.join("\\") + (parts.length === 1 ? "\\" : "");
      }
      if (p === "." || p === "~") return cwd;
      if (/^[A-Za-z]:\\/.test(p)) return p;
      return cwd.replace(/\\$/, "") + "\\" + p;
    }

    const cmds = {
      help: () => printHTML(`<pre style="margin:0;color:#cccccc">Commands:
  help, cls/clear, exit, echo &lt;text&gt;, ver, whoami, hostname
  date, time, calendar
  dir/ls, cd &lt;path&gt;, pwd, cat/type &lt;file&gt;, mkdir &lt;name&gt;, touch &lt;name&gt;
  calc &lt;expression&gt;            e.g. calc (2+3)*4
  color &lt;name&gt;                 green, red, blue, yellow, white, cyan
  weather, ping &lt;host&gt;, ipconfig
  open &lt;app&gt;                   browser, settings, calculator, copilot...
  history</pre>`),
      cls: () => { out.innerHTML = ""; },
      clear: () => { out.innerHTML = ""; },
      exit: () => { winRef.close(); },
      echo: (a) => print(a.join(" ")),
      ver: () => print("Windows 12 [Version 12.0.2026]", "#16c60c"),
      whoami: () => print(S().profile.username),
      hostname: () => print("WIN12-PC"),
      date: () => print(State.formatDate()),
      time: () => print(State.formatClock()),
      calendar: () => print(new Date().toDateString()),
      pwd: () => print(cwd),
      dir: () => listDir(),
      ls: () => listDir(),
      cd: (a) => {
        const target = resolvePath(a[0]);
        if (fs[target]) { cwd = target; setPrompt(); }
        else print(`The system cannot find the path: ${target}`, "#ff4b4b");
      },
      cat: (a) => readFile(a[0]),
      type: (a) => readFile(a[0]),
      mkdir: (a) => {
        if (!a[0]) return print("Usage: mkdir <name>", "#ff4b4b");
        const node = fs[cwd]; if (!node) return;
        node.children[a[0]] = null;
        fs[cwd + "\\" + a[0]] = { type: "dir", children: {} };
        print(`Created '${a[0]}'`, "#16c60c");
      },
      touch: (a) => {
        if (!a[0]) return print("Usage: touch <name>", "#ff4b4b");
        const node = fs[cwd]; if (!node) return;
        node.children[a[0]] = "f"; fileContents[a[0]] = ""; print(`Created '${a[0]}'`, "#16c60c");
      },
      calc: (a) => {
        const expr = a.join(" ").replace(/[^0-9+\-*/().% ]/g, "");
        if (!expr) return print("Usage: calc <expression>", "#ff4b4b");
        try { print(String(Function('"use strict";return (' + expr + ')')())); } catch (e) { print("Error: " + e.message, "#ff4b4b"); }
      },
      color: (a) => {
        const map = { green: "#16c60c", red: "#ff4b4b", blue: "#3a96ff", yellow: "#ffe000", white: "#ffffff", cyan: "#00ffff" };
        const c = map[(a[0] || "").toLowerCase()];
        if (!c) return print("Unknown color. Try: green, red, blue, yellow, white, cyan", "#ff4b4b");
        body.querySelector("#term").style.color = c; cmd.style.color = c;
        promptEl.style.color = c; print("Color set.", c);
      },
      weather: () => {
        const cs = ["Sunny", "Partly cloudy", "Cloudy", "Light rain", "Clear"];
        const t = 12 + Math.floor(Math.random() * 20);
        print(`${S().region}: ${cs[Math.floor(Math.random() * cs.length)]}, ${t}°`);
      },
      ping: (a) => {
        const host = a[0] || "windows12.local";
        print(`Pinging ${host} ...`);
        let i = 0; const iv = setInterval(() => {
          print(`Reply from ${host}: bytes=32 time=${(20 + Math.random() * 40).toFixed(0)}ms TTL=64`);
          if (++i >= 4) { clearInterval(iv); print(`Ping statistics: 4 packets sent, 4 received, 0% loss.`, "#16c60c"); body.querySelector("#term").scrollTop = 1e9; }
        }, 300);
      },
      ipconfig: () => {
        printHTML(`<pre style="margin:0;color:#cccccc">Windows 12 IP Configuration

Ethernet adapter Local Area Connection:
   IPv4 Address. . . . . . . . . . . : 192.168.1.${Math.floor(Math.random() * 200 + 50)}
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1</pre>`);
      },
      open: (a) => {
        const id = a[0]; if (!id) return print("Usage: open <app>", "#ff4b4b");
        try { window.WM.open(id); print("Opened " + id, "#16c60c"); } catch (e) { print("Unknown app: " + id, "#ff4b4b"); }
      },
      history: () => history.forEach((h, i) => print(`  ${i + 1}  ${h}`)),
    };

    function listDir() {
      const node = fs[cwd];
      if (!node) return print("(empty)");
      const names = Object.keys(node.children);
      if (!names.length) return print("(empty)");
      names.forEach((n) => {
        const isFile = node.children[n] === "f";
        print((isFile ? "       " : "<DIR>  ") + n, isFile ? "#cccccc" : "#3a96ff");
      });
    }
    function readFile(name) {
      if (!name) return print("Usage: cat <file>", "#ff4b4b");
      const node = fs[cwd];
      if (node && node.children[name] === "f" && fileContents[name] != null) print(fileContents[name]);
      else print("File not found: " + name, "#ff4b4b");
    }

    cmd.focus();
    cmd.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp") { if (histIdx > 0) histIdx--; else histIdx = Math.max(0, history.length - 1); cmd.value = history[histIdx] || ""; e.preventDefault(); return; }
      if (e.key === "ArrowDown") { histIdx++; if (histIdx >= history.length) { histIdx = history.length; cmd.value = ""; } else cmd.value = history[histIdx] || ""; e.preventDefault(); return; }
      if (e.key !== "Enter") return;
      const line = cmd.value; print(cwd + "> " + line); cmd.value = "";
      if (line.trim()) { history.push(line); histIdx = history.length; }
      const [c, ...args] = line.trim().split(/\s+/);
      if (!c) return;
      (cmds[c.toLowerCase()] || (() => print(`'${c}' is not recognized as a command. Try 'help'.`, "#ff4b4b")))(args);
      body.querySelector("#term").scrollTop = 1e9;
    });
  };

  // ---------- Mail ----------
  AppRegistry.mail = function () {
    const { body } = cw({ title: "Mail", icon: Icon.mini("mail", "Mail"), width: 560, height: 480 });
    const sent = store("mailSent", []);
    function render() {
      body.innerHTML = `<div class="site">
        <h2>New message</h2>
        <div class="field"><label>To</label><input id="to" type="email" placeholder="someone@example.com"></div>
        <div class="field"><label>Subject</label><input id="subj" type="text"></div>
        <div class="field"><label>Message</label><textarea id="msg" rows="6" style="width:100%;padding:10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-elev);color:var(--text)"></textarea></div>
        <button class="pill-btn" id="send">Send</button>
        <h3>Sent (${sent.length})</h3><div id="sent"></div></div>`;
      body.querySelector("#send").onclick = () => {
        const to = body.querySelector("#to").value.trim();
        const subj = body.querySelector("#subj").value.trim();
        if (!to) { alert("Add a recipient."); return; }
        sent.unshift({ to, subj, ts: Date.now() }); State.save();
        Notify.show({ icon: "", title: "Mail sent", body: `To ${to}` });
        render();
      };
      const s = body.querySelector("#sent");
      sent.forEach((m) => s.appendChild(el(`<div class="tx" style="background:rgba(127,127,127,.12);color:var(--text)"><b>${escapeHtml(m.subj || "(no subject)")}</b> — ${escapeHtml(m.to)}</div>`)));
    }
    render();
  };

  // ---------- File Explorer (actually opens device files) ----------
  AppRegistry.fileexplorer = function () {
    const { body } = cw({ title: "File Explorer", icon: Icon.mini("fileexplorer", "Files"), width: 760, height: 520 });
    const cats = [
      { key: "Pictures", accept: "image/*" },
      { key: "Music", accept: "audio/*" },
      { key: "Videos", accept: "video/*" },
      { key: "Documents", accept: ".txt,.md,.csv,.json,.pdf,.html,.xml,.log,text/*" },
      { key: "Any file", accept: "*/*" },
    ];
    if (S().appData.fileExplorer == null) S().appData.fileExplorer = { recent: [] };
    const data = S().appData.fileExplorer;
    let currentCat = "Pictures";

    function render() {
      body.innerHTML = `<div style="display:flex;height:100%">
        <div style="width:200px;background:var(--bg-elev);padding:12px;border-right:1px solid var(--border)">
          <div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px">This PC</div>
          ${cats.map((c) => `<div class="nav fe-nav ${c.key === currentCat ? "active" : ""}" data-c="${c.key}" style="padding:8px 10px;border-radius:6px;cursor:pointer">${c.key}</div>`).join("")}
          <hr style="border-color:var(--border);margin:14px 0">
          <div class="muted" style="font-size:.75rem;text-transform:uppercase;margin-bottom:6px">Recent</div>
          <div id="recent"></div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column">
          <div class="row" style="padding:10px 16px;border-bottom:1px solid var(--border)">
            <h3 style="margin:0">${currentCat}</h3><span class="grow"></span>
            <button class="pill-btn" id="open">Open file</button>
          </div>
          <div id="stage" style="flex:1;overflow:auto;padding:18px"></div>
        </div></div>`;
      const stage = body.querySelector("#stage");
      stage.innerHTML = `<div class="muted center-col" style="justify-content:center;height:100%;text-align:center">
        <p>Click <b>Open file</b> to pick a ${currentCat.toLowerCase().replace("any file", "file")} from your device.</p></div>`;
      body.querySelectorAll(".fe-nav").forEach((n) => n.onclick = () => { currentCat = n.dataset.c; render(); });
      body.querySelector("#open").onclick = openPicker;
      const recentEl = body.querySelector("#recent");
      if (!data.recent.length) recentEl.innerHTML = `<div class="muted" style="font-size:.75rem">No recent files</div>`;
      else data.recent.slice(0, 8).forEach((r) => {
        const row = el(`<div class="row" style="padding:6px 8px;font-size:.8rem;cursor:default" title="${escapeHtml(r.name)}"><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.name)}</span></div>`);
        recentEl.appendChild(row);
      });
    }

    function openPicker() {
      const inp = document.getElementById("globalFileInput");
      inp.accept = cats.find((c) => c.key === currentCat).accept; inp.value = ""; inp.multiple = false;
      inp.onchange = () => { const f = inp.files[0]; if (f) openFile(f); };
      inp.click();
    }

    function openFile(file) {
      data.recent.unshift({ name: file.name, type: file.type, size: file.size, ts: Date.now() });
      data.recent = data.recent.slice(0, 20); State.save();
      const url = URL.createObjectURL(file);
      const stage = body.querySelector("#stage");
      stage.innerHTML = "";
      const header = el(`<div class="row" style="margin-bottom:10px"><b style="flex:1">${escapeHtml(file.name)}</b><span class="muted">${(file.size / 1024).toFixed(1)} KB</span></div>`);
      stage.appendChild(header);
      let viewer;
      if (file.type.startsWith("image/")) viewer = el(`<img src="${url}" style="max-width:100%;max-height:60vh;border-radius:8px;display:block;margin:auto">`);
      else if (file.type.startsWith("video/")) viewer = el(`<video src="${url}" controls autoplay style="max-width:100%;max-height:60vh;border-radius:8px;display:block;margin:auto"></video>`);
      else if (file.type.startsWith("audio/")) viewer = el(`<audio src="${url}" controls autoplay style="width:100%"></audio>`);
      else if (file.type === "application/pdf") viewer = el(`<iframe src="${url}" style="width:100%;height:60vh;border:none;border-radius:8px"></iframe>`);
      else {
        viewer = el(`<pre style="white-space:pre-wrap;background:var(--bg-elev);padding:14px;border-radius:8px;max-height:60vh;overflow:auto;font-family:Consolas,monospace;font-size:.85rem"></pre>`);
        file.text().then((t) => { viewer.textContent = t.length > 200000 ? t.slice(0, 200000) + "\n…(truncated)" : t; }).catch(() => { viewer.textContent = "(can't display this file type)"; });
      }
      stage.appendChild(viewer);
      const recentEl = body.querySelector("#recent");
      if (recentEl) {
        recentEl.innerHTML = "";
        data.recent.slice(0, 8).forEach((r) => recentEl.appendChild(el(`<div class="row" style="padding:6px 8px;font-size:.8rem" title="${escapeHtml(r.name)}"><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(r.name)}</span></div>`)));
      }
    }

    render();
  };

  // ---------- Maps ----------
  AppRegistry.maps = function () {
    const { body } = cw({ title: "Maps", icon: Icon.mini("maps", "Maps"), width: 600, height: 480 });
    body.innerHTML = `<div style="height:100%;display:flex;flex-direction:column">
      <div class="row" style="padding:10px;background:var(--bg-elev)"><input id="q" class="grow" style="padding:8px;border-radius:18px;border:1px solid var(--border);background:var(--bg);color:var(--text)" placeholder="Search a place"><button class="pill-btn" id="go">Search</button></div>
      <canvas id="map" style="flex:1;width:100%"></canvas></div>`;
    const cv = body.querySelector("#map");
    function draw(label) {
      const r = cv.getBoundingClientRect(); cv.width = r.width; cv.height = r.height;
      const x = cv.getContext("2d");
      x.fillStyle = "#aadaff"; x.fillRect(0, 0, cv.width, cv.height);
      x.strokeStyle = "#bcd0a0"; for (let i = 0; i < 40; i++) { x.beginPath(); x.moveTo((i * 53) % cv.width, 0); x.lineTo((i * 53) % cv.width, cv.height); x.stroke(); }
      x.strokeStyle = "#fff"; x.lineWidth = 6;
      x.beginPath(); x.moveTo(0, cv.height * .4); x.lineTo(cv.width, cv.height * .55); x.stroke();
      x.beginPath(); x.moveTo(cv.width * .5, 0); x.lineTo(cv.width * .45, cv.height); x.stroke();
      x.fillStyle = "#e53935"; x.beginPath(); x.arc(cv.width / 2, cv.height / 2, 10, 0, 7); x.fill();
      x.fillStyle = "#000"; x.font = "16px Segoe UI"; x.textAlign = "center";
      x.fillText(label || S().region, cv.width / 2, cv.height / 2 - 18);
    }
    body.querySelector("#go").onclick = () => draw(body.querySelector("#q").value.trim());
    setTimeout(() => draw(), 50);
  };

  // ---------- Photos (image viewer) ----------
  AppRegistry.photos = function () {
    const { body } = cw({ title: "Photos", icon: Icon.mini("photos", "Photos"), width: 640, height: 500 });
    body.innerHTML = `<div class="mp"><button class="pill-btn" id="pick">Open images from your device</button><div id="stage" class="grow center-col" style="justify-content:center"><p class="muted">No photos open.</p></div></div>`;
    const stage = body.querySelector("#stage");
    body.querySelector("#pick").onclick = () => {
      const inp = document.getElementById("globalFileInput"); inp.accept = "image/*"; inp.multiple = true; inp.value = "";
      inp.onchange = () => {
        stage.innerHTML = ""; [...inp.files].forEach((f) => { const img = document.createElement("img"); img.src = URL.createObjectURL(f); img.style.cssText = "max-width:100%;max-height:60vh;border-radius:8px;margin:8px"; stage.appendChild(img); });
        inp.multiple = false;
      };
      inp.click();
    };
  };

  // ---------- Camera ----------
  AppRegistry.camera = function () {
    const { body } = cw({ title: "Camera", icon: Icon.mini("camera", "Camera"), width: 560, height: 460 });
    body.innerHTML = `<div class="mp"><video autoplay playsinline style="max-height:50vh;background:#000;border-radius:8px"></video>
      <div class="row"><button class="pill-btn" id="snap">Take photo</button></div><div id="shot"></div></div>`;
    const video = body.querySelector("video");
    navigator.mediaDevices?.getUserMedia({ video: true }).then((s) => { video.srcObject = s; })
      .catch(() => { body.querySelector(".mp").innerHTML = `<p class="muted" style="padding:20px">Camera unavailable or permission denied.</p>`; });
    body.querySelector("#snap").onclick = () => {
      const c = document.createElement("canvas"); c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext("2d").drawImage(video, 0, 0); const img = new Image(); img.src = c.toDataURL(); img.style.cssText = "max-width:100%;border-radius:8px;margin-top:8px";
      body.querySelector("#shot").innerHTML = ""; body.querySelector("#shot").appendChild(img);
    };
    body.closest && null;
  };

  // ---------- Voice Recorder ----------
  AppRegistry.recorder = function () {
    const { body } = cw({ title: "Voice Recorder", icon: Icon.mini("recorder", "Recorder"), width: 420, height: 320 });
    body.innerHTML = `<div class="center-col" style="justify-content:center;height:100%;gap:14px"><div id="status" class="muted">Ready</div><button class="pill-btn" id="rec">Record</button><div id="clips"></div></div>`;
    let mr, chunks = [], recording = false;
    const btn = body.querySelector("#rec"), status = body.querySelector("#status");
    btn.onclick = async () => {
      if (recording) { mr.stop(); recording = false; btn.textContent = "Record"; status.textContent = "Saved"; return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mr = new MediaRecorder(stream); chunks = [];
        mr.ondataavailable = (e) => chunks.push(e.data);
        mr.onstop = () => { const a = document.createElement("audio"); a.controls = true; a.src = URL.createObjectURL(new Blob(chunks)); body.querySelector("#clips").appendChild(a); };
        mr.start(); recording = true; btn.textContent = "Stop"; status.textContent = "Recording...";
      } catch (e) { status.textContent = "Microphone unavailable."; }
    };
  };

  // ---------- Translator (uses Copilot AI) ----------
  AppRegistry.translator = function () {
    const { body } = cw({ title: "Translator", icon: Icon.mini("translator", "Translator"), width: 480, height: 420 });
    body.innerHTML = `<div class="site">
      <div class="field"><label>Text</label><textarea id="src" rows="3" style="width:100%;padding:10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-elev);color:var(--text)"></textarea></div>
      <div class="field"><label>Translate to</label><select id="lang">${I18n.languages.map((l) => `<option value="${l.name}">${l.name}</option>`).join("")}</select></div>
      <button class="pill-btn" id="go">Translate</button>
      <div class="field" style="margin-top:14px"><label>Result</label><div id="out" class="muted" style="min-height:40px"></div></div></div>`;
    body.querySelector("#go").onclick = async () => {
      const out = body.querySelector("#out");
      const text = body.querySelector("#src").value.trim();
      if (!text) return;
      out.textContent = "Translating...";
      try {
        const r = await fetch("https://api.aimlapi.com/v1/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (S().copilot.apiKey || window.AIML_KEY) },
          body: JSON.stringify({ model: "baidu/ernie-4-5-0-3b", messages: [{ role: "user", content: `Translate the following into ${body.querySelector("#lang").value}. Reply with only the translation:\n\n${text}` }] }),
        });
        const j = await r.json();
        out.textContent = j.choices?.[0]?.message?.content || "(no result)";
      } catch (e) { out.textContent = "Translation failed (network/CORS)."; }
    };
  };

  // ---------- Money -> open bank ----------
  AppRegistry.bank = function () { window.Browser.openTo("bank.local"); };

  // ---------- Sudoku ----------
  AppRegistry.sudoku = function () {
    const { body } = cw({ title: "Sudoku", icon: Icon.mini("sudoku", "Sudoku"), width: 420, height: 520 });
    const puzzle = "53__7____6__195____98____6_8___6___34__8_3__17___2___6_6____28____419__5____8__79";
    const solution = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
    const cells = [];
    const grid = el(`<div style="display:grid;grid-template-columns:repeat(9,1fr);gap:1px;background:#888;max-width:380px;margin:0 auto"></div>`);
    [...puzzle].forEach((ch, i) => {
      const given = ch !== "_";
      const inp = el(`<input maxlength="1" value="${given ? ch : ""}" ${given ? "readonly" : ""} style="aspect-ratio:1;text-align:center;border:none;font-size:1.1rem;background:${given ? "var(--bg-elev)" : "var(--window-bg)"};color:var(--text);${(i % 9) % 3 === 2 ? "margin-right:2px;" : ""}${(Math.floor(i / 9)) % 3 === 2 ? "margin-bottom:2px;" : ""}">`);
      inp.oninput = () => { inp.value = inp.value.replace(/[^1-9]/g, ""); };
      cells.push(inp); grid.appendChild(inp);
    });
    body.innerHTML = `<div style="padding:14px"><h2 style="margin:0 0 10px">Sudoku</h2></div>`;
    body.firstElementChild.appendChild(grid);
    const actions = el(`<div class="row" style="justify-content:center;margin-top:14px;gap:10px"><button class="pill-btn" id="check">Check</button><span id="msg" class="muted"></span></div>`);
    body.firstElementChild.appendChild(actions);
    actions.querySelector("#check").onclick = () => {
      const ok = cells.every((c, i) => c.value === solution[i]);
      actions.querySelector("#msg").textContent = ok ? "Solved! Nice." : "Not solved yet.";
    };
  };

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
})();
