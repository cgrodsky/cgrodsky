/* Google-style Calendar — month grid, events, add/view, today highlight. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  const cw = (opts) => window.WM.createWindow(opts);
  const S = () => State.data;
  const mini = (k, n) => (window.Icon ? Icon.mini(k, n) : "");
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const COLORS = ["#1a73e8", "#0f9d58", "#d93025", "#f4b400", "#a142f4", "#00897b", "#e8710a"];
  const key = (y, m, d) => y + "-" + (m + 1) + "-" + d;

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.calendar = function () {
    const ref = cw({ title: "Calendar", icon: mini("calendar", "Calendar"), width: 960, height: 660, appId: "calendar" });
    const body = ref.body; body.classList.add("cal-host");
    if (!S().appData) S().appData = {};
    const store = S().appData.calendar || (S().appData.calendar = { events: null });
    const today = new Date(State.now ? State.now() : Date.now());
    if (!store.events) {
      const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
      store.events = {};
      store.events[key(y, m, d)] = [{ t: "Team standup", time: "9:30 AM", c: 0 }];
      store.events[key(y, m, Math.min(28, d + 2))] = [{ t: "Biology quiz", time: "10:00 AM", c: 2 }];
      store.events[key(y, m, Math.min(28, d + 5))] = [{ t: "Ship Windows 12", time: "All day", c: 1 }];
      store.events[key(y, m, Math.max(1, d - 3))] = [{ t: "Dentist", time: "2:00 PM", c: 4 }];
      State.save();
    }
    let view = new Date(today.getFullYear(), today.getMonth(), 1);

    body.innerHTML = `<div class="cal">
      <div class="cal-top">
        <span class="cal-brand"><img src="assets/gapp_calendar.png?v=1" alt="">Calendar</span>
        <button class="cal-today">Today</button>
        <button class="cal-nav cal-prev" title="Previous">&#8249;</button>
        <button class="cal-nav cal-next" title="Next">&#8250;</button>
        <span class="cal-title"></span>
      </div>
      <div class="cal-dow">${DOW.map((d) => `<div>${d}</div>`).join("")}</div>
      <div class="cal-grid"></div>
    </div>`;
    const titleEl = body.querySelector(".cal-title"), grid = body.querySelector(".cal-grid");

    function render() {
      titleEl.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
      grid.innerHTML = "";
      const y = view.getFullYear(), m = view.getMonth();
      const first = new Date(y, m, 1).getDay();
      const start = new Date(y, m, 1 - first);
      for (let i = 0; i < 42; i++) {
        const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const other = dt.getMonth() !== m;
        const isToday = dt.toDateString() === today.toDateString();
        const evs = store.events[key(dt.getFullYear(), dt.getMonth(), dt.getDate())] || [];
        const cell = el(`<div class="cal-cell${other ? " other" : ""}">
          <div class="cal-num${isToday ? " today" : ""}">${dt.getDate()}</div>
          <div class="cal-evs">${evs.map((e) => `<div class="cal-ev" style="background:${COLORS[e.c % COLORS.length]}"><b>${esc(e.time)}</b> ${esc(e.t)}</div>`).join("")}</div>
        </div>`);
        cell.onclick = () => dayPopup(dt, cell);
        grid.appendChild(cell);
      }
    }
    function dayPopup(dt, anchor) {
      body.querySelectorAll(".cal-pop").forEach((x) => x.remove());
      const k = key(dt.getFullYear(), dt.getMonth(), dt.getDate());
      const evs = store.events[k] || [];
      const pop = el(`<div class="cal-pop">
        <div class="cal-pop-h"><b>${DOW[dt.getDay()]}, ${MONTHS[dt.getMonth()].slice(0, 3)} ${dt.getDate()}</b><button class="cal-pop-x">&times;</button></div>
        <div class="cal-pop-list">${evs.length ? evs.map((e) => `<div class="cal-pop-ev"><span class="cal-dot" style="background:${COLORS[e.c % COLORS.length]}"></span><span><b>${esc(e.t)}</b><br><span class="muted">${esc(e.time)}</span></span></div>`).join("") : `<div class="muted">No events.</div>`}</div>
        <div class="cal-pop-add"><input class="cal-add-t" placeholder="Add event title"><input class="cal-add-time" placeholder="Time" value="12:00 PM"><button class="cal-add-btn">Add</button></div>
      </div>`);
      const r = anchor.getBoundingClientRect(), br = body.getBoundingClientRect();
      pop.style.left = Math.min(r.left - br.left, br.width - 280) + "px";
      pop.style.top = Math.min(r.top - br.top + 30, br.height - 200) + "px";
      body.appendChild(pop);
      pop.querySelector(".cal-pop-x").onclick = () => pop.remove();
      pop.querySelector(".cal-add-btn").onclick = () => {
        const t = pop.querySelector(".cal-add-t").value.trim(); if (!t) return;
        const time = pop.querySelector(".cal-add-time").value.trim() || "All day";
        (store.events[k] = store.events[k] || []).push({ t, time, c: Math.floor(Math.random() * COLORS.length) });
        State.save(); pop.remove(); render();
      };
      setTimeout(() => pop.querySelector(".cal-add-t").focus(), 40);
    }
    body.querySelector(".cal-today").onclick = () => { view = new Date(today.getFullYear(), today.getMonth(), 1); render(); };
    body.querySelector(".cal-prev").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); };
    body.querySelector(".cal-next").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); };
    render();
  };
})();
