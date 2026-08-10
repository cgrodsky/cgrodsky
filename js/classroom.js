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

    function classView(cl) {
      body.innerHTML = header() + `<div class="gc-class">
        <div class="gc-hero" style="background:${cl.c}"><button class="gc-back">&#8592;</button><div class="gc-hero-name">${esc(cl.name)}</div><div class="gc-hero-sec">${esc(cl.section)} · ${esc(cl.teacher)}</div></div>
        <div class="gc-stream">
          <div class="gc-side"><div class="gc-side-card"><b>Upcoming</b><p>${esc(cl.due)}</p><button class="gc-viewall">View all</button></div></div>
          <div class="gc-feed">
            <button class="gc-announce">Announce something to your class</button>
            ${[["Reminder: quiz this Friday covers chapters 4–5. Study the review sheet in the Classwork tab.", cl.teacher, "2 days ago"], ["Great work on the last assignment, everyone! Grades are posted.", cl.teacher, "4 days ago"], ["New assignment posted: " + cl.due + ". Submit before the deadline.", cl.teacher, "6 days ago"]].map(([txt, who, when]) => `<div class="gc-post"><div class="gc-post-av" style="background:${cl.c}">${esc(who.split(" ").pop()[0])}</div><div class="gc-post-body"><div class="gc-post-who">${esc(who)}<span>${esc(when)}</span></div><p>${esc(txt)}</p></div></div>`).join("")}
          </div>
        </div>
      </div>`;
      body.querySelector(".gc-back").onclick = home;
      body.querySelector(".gc-viewall").onclick = () => { if (window.Notify) Notify.show({ icon: mini("classroom", "Classroom"), title: cl.name, body: cl.due }); };
    }

    home();
  };
})();
