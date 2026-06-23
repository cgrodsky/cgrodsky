/* Achievements: 5 milestones tracked across the OS. Bumped from setup,
   Bank, Duolingo, Minecraft, and YouTube. Persists per user. */
(function () {
  "use strict";
  const S = () => State.data;
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  const LIST = [
    { id: "welcome",     name: "Welcome to Windows 12", desc: "Finish first-run setup.",           goal: 1   },
    { id: "big_spender", name: "Big Spender",           desc: "Spend $100 total in Forge Bank.",   goal: 100 },
    { id: "lesson1",     name: "First Steps",           desc: "Earn 10 XP in Duolingo.",           goal: 10  },
    { id: "miner",       name: "Pick & Shovel",         desc: "Mine 25 blocks in Mincraft.",       goal: 25  },
    { id: "subscriber",  name: "Notification Bell",     desc: "Subscribe to a YouTube channel.",   goal: 1   },
  ];

  function init() {
    if (!S().appData) S().appData = {};
    if (!S().appData.achievements) S().appData.achievements = { progress: {}, unlocked: {} };
  }

  function bump(id, amount) {
    init();
    const a = LIST.find((x) => x.id === id); if (!a) return;
    const ach = S().appData.achievements;
    if (ach.unlocked[id]) return;
    ach.progress[id] = Math.min(a.goal, (ach.progress[id] || 0) + (amount || 1));
    if (ach.progress[id] >= a.goal) {
      ach.unlocked[id] = Date.now();
      State.save();
      toast(a);
    } else {
      State.save();
    }
  }
  function unlock(id) { const a = LIST.find((x) => x.id === id); if (a) bump(id, a.goal); }

  function toast(a) {
    if (!window.Notify) return;
    Notify.show({
      icon: '<span class="ach-toast-star">★</span>',
      title: "Achievement Unlocked!",
      body: a.name,
      onClick: () => window.WM.open("achievements"),
    });
  }

  AppRegistry.achievements = function () {
    const { body } = window.WM.createWindow({
      title: "Achievements", icon: Icon.mini("achievements", "Trophy"),
      width: 540, height: 500, appId: "achievements",
    });
    init();
    const ach = S().appData.achievements;
    const unlockedCount = LIST.filter((a) => ach.unlocked[a.id]).length;
    body.innerHTML = `<div class="ach">
      <div class="ach-head">
        <h2 style="margin:0">Achievements</h2>
        <div class="muted">${unlockedCount} / ${LIST.length} unlocked</div>
      </div>
      <div class="ach-list"></div>
    </div>`;
    const list = body.querySelector(".ach-list");
    LIST.forEach((a) => {
      const u = !!ach.unlocked[a.id];
      const p = ach.progress[a.id] || 0;
      const pct = Math.min(100, p / a.goal * 100);
      list.appendChild(el(`<div class="ach-row ${u ? "done" : ""}">
        <div class="ach-medal">${u ? "★" : "○"}</div>
        <div class="ach-info">
          <div class="ach-name">${a.name}</div>
          <div class="ach-desc">${a.desc}</div>
          <div class="ach-bar"><div class="ach-fill" style="width:${pct}%"></div></div>
          <div class="ach-prog">${u ? "Unlocked!" : (p + " / " + a.goal)}</div>
        </div>
      </div>`));
    });
  };

  window.Achievements = { bump, unlock, LIST };
})();
