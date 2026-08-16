/* Microsoft Solitaire (Klondike). Tap a card to pick it up, tap a pile to drop it.
   Tap the stock to deal; tap a face-up top card twice to auto-send it home. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const cw = (opts) => window.WM.createWindow(opts);
  const SUITS = ["♠", "♥", "♦", "♣"]; // spade heart diamond club
  const isRed = (s) => s === 1 || s === 2;
  const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function openSolitaire() {
    const ref = cw({ title: "Solitaire", icon: window.Icon ? Icon.mini("solitaire", "Solitaire") : "", width: 860, height: 620, appId: "solitaire" });
    const body = ref.body; body.classList.add("sol-host");
    let stock, waste, foundations, tableau, sel, moves, won;

    // Deterministic-ish shuffle without Math.random dependence issues (uses time + counter).
    let seedN = 0;
    function shuffle(a) {
      let s = (Date.now() % 100000) + (seedN++ * 2654435761) >>> 0;
      const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
    function deal() {
      const deck = [];
      for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ r, s, up: false });
      shuffle(deck);
      tableau = [[], [], [], [], [], [], []];
      for (let c = 0; c < 7; c++) for (let k = 0; k <= c; k++) { const card = deck.pop(); card.up = (k === c); tableau[c].push(card); }
      stock = deck; waste = []; foundations = [[], [], [], []]; sel = null; moves = 0; won = false;
      render();
    }

    function cardHtml(card, extra) {
      if (!card.up) return `<div class="sol-card sol-back ${extra || ""}"></div>`;
      const col = isRed(card.s) ? "sol-red" : "sol-black";
      return `<div class="sol-card ${col} ${extra || ""}"><span class="sol-corner tl">${RANKS[card.r]}${SUITS[card.s]}</span><span class="sol-pip">${SUITS[card.s]}</span><span class="sol-corner br">${RANKS[card.r]}${SUITS[card.s]}</span></div>`;
    }
    // Is [cards] a valid descending, alternating-color run?
    function validRun(cards) {
      for (let i = 0; i < cards.length - 1; i++) { const a = cards[i], b = cards[i + 1]; if (a.r !== b.r + 1 || isRed(a.s) === isRed(b.s)) return false; }
      return true;
    }
    function canToTableau(card, col) {
      const dst = tableau[col]; if (!dst.length) return card.r === 13;
      const top = dst[dst.length - 1]; return top.up && top.r === card.r + 1 && isRed(top.s) !== isRed(card.s);
    }
    function canToFoundation(card, f) {
      const pile = foundations[f]; if (card.s !== f) return false; return pile.length ? pile[pile.length - 1].r === card.r - 1 : card.r === 1;
    }
    function autoFoundation(card) { for (let f = 0; f < 4; f++) if (canToFoundation(card, f)) return f; return -1; }

    function clearSel() { sel = null; }
    // move the currently selected group to a place; returns true on success
    function tryDrop(target) {
      if (!sel) return false;
      const group = sel.cards;
      if (target.type === "foundation") {
        if (group.length === 1 && canToFoundation(group[0], target.f)) { commit(); foundations[target.f].push(group[0]); after(); return true; }
        return false;
      }
      if (target.type === "tableau") {
        if (canToTableau(group[0], target.col)) { commit(); group.forEach((c) => tableau[target.col].push(c)); after(); return true; }
        return false;
      }
      return false;
    }
    function commit() { // remove selected group from its source
      if (sel.from === "waste") waste.pop();
      else if (sel.from === "foundation") foundations[sel.f].pop();
      else if (sel.from === "tableau") tableau[sel.col].splice(sel.idx);
    }
    function after() {
      moves++;
      // flip newly-exposed tableau cards
      tableau.forEach((col) => { const t = col[col.length - 1]; if (t && !t.up) t.up = true; });
      sel = null;
      if (foundations.every((f) => f.length === 13)) { won = true; }
      render();
      if (won) {
        celebrate();
        if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("solitaire", "Solitaire") : "", title: "Solitaire", body: "You win! 🎉 (" + moves + " moves)" });
      }
    }
    function celebrate() {
      const ov = el(`<div class="sol-win"><div class="sol-confetti"></div><div class="sol-win-card"><div class="sol-win-trophy">🏆</div><h2>You Win!</h2><p>Solved in ${moves} moves</p><button class="sol-win-again">Play again</button></div></div>`);
      const conf = ov.querySelector(".sol-confetti");
      const cols = ["#e11d48", "#f59e0b", "#10b981", "#3b82f6", "#a142f4", "#ec4899"];
      for (let i = 0; i < 80; i++) { const c = document.createElement("i"); c.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * 1.2}s;animation-duration:${1.6 + Math.random() * 1.6}s;transform:rotate(${Math.random() * 360}deg)`; conf.appendChild(c); }
      ov.querySelector(".sol-win-again").onclick = () => { ov.remove(); deal(); };
      body.appendChild(ov);
    }

    function selectFrom(from, col, idx, f) {
      let cards;
      if (from === "waste") { if (!waste.length) return; cards = [waste[waste.length - 1]]; }
      else if (from === "foundation") { if (!foundations[f].length) return; cards = [foundations[f][foundations[f].length - 1]]; }
      else { const c = tableau[col]; if (!c[idx] || !c[idx].up) return; cards = c.slice(idx); if (!validRun(cards)) return; }
      sel = { from, col, idx, f, cards };
      render();
    }

    function render() {
      body.innerHTML = `<div class="sol">
        <div class="sol-bar"><button class="sol-new">New game</button><span class="sol-moves">Moves: ${moves}</span><span class="grow"></span><span class="sol-msg">${won ? "You win! 🎉" : ""}</span></div>
        <div class="sol-top">
          <div class="sol-pile sol-stock" data-stock="1">${stock.length ? cardHtml({ up: false }) : `<div class="sol-slot">↻</div>`}</div>
          <div class="sol-pile sol-waste" data-waste="1">${waste.length ? cardHtml(waste[waste.length - 1], selMatch("waste") ? "sel" : "") : `<div class="sol-slot"></div>`}</div>
          <div class="sol-gap"></div>
          ${foundations.map((f, i) => `<div class="sol-pile sol-foundation" data-f="${i}">${f.length ? cardHtml(f[f.length - 1], selMatch("foundation", null, null, i) ? "sel" : "") : `<div class="sol-slot sol-fslot">${SUITS[i]}</div>`}</div>`).join("")}
        </div>
        <div class="sol-tableau">
          ${tableau.map((col, ci) => `<div class="sol-col" data-col="${ci}">${col.length ? col.map((c, k) => `<div class="sol-slot-wrap" data-col="${ci}" data-idx="${k}" style="top:${k * 26}px">${cardHtml(c, (sel && sel.from === "tableau" && sel.col === ci && k >= sel.idx) ? "sel" : "")}</div>`).join("") : `<div class="sol-slot sol-empty">K</div>`}</div>`).join("")}
        </div>
      </div>`;
      // wire
      body.querySelector(".sol-new").onclick = deal;
      body.querySelector(".sol-stock").onclick = () => {
        if (stock.length) { const c = stock.pop(); c.up = true; waste.push(c); sel = null; render(); }
        else { stock = waste.reverse().map((c) => (c.up = false, c)); waste = []; sel = null; render(); }
      };
      const wasteEl = body.querySelector(".sol-waste");
      if (wasteEl) wasteEl.onclick = () => {
        if (sel) { if (tryDrop({ type: "tableau", col: -1 })) return; } // waste isn't a drop target; fallthrough
        if (!waste.length) return;
        if (selMatch("waste")) { const f = autoFoundation(waste[waste.length - 1]); if (f >= 0) { selectFrom("waste"); tryDrop({ type: "foundation", f }); return; } clearSel(); render(); return; }
        selectFrom("waste");
      };
      body.querySelectorAll(".sol-foundation").forEach((fp) => fp.onclick = () => {
        const f = +fp.dataset.f;
        if (sel) { if (tryDrop({ type: "foundation", f })) return; clearSel(); render(); return; }
        selectFrom("foundation", null, null, f);
      });
      body.querySelectorAll(".sol-col").forEach((colEl) => colEl.onclick = (e) => {
        const col = +colEl.dataset.col;
        const wrap = e.target.closest(".sol-slot-wrap");
        if (sel) {
          if (tryDrop({ type: "tableau", col })) return;
          // tapping own selected card again -> try auto to foundation
          if (wrap && sel.from === "tableau" && sel.col === col && +wrap.dataset.idx === sel.idx && sel.cards.length === 1) {
            const f = autoFoundation(sel.cards[0]); if (f >= 0 && tryDrop({ type: "foundation", f })) return;
          }
          clearSel(); render(); return;
        }
        if (wrap) selectFrom("tableau", col, +wrap.dataset.idx);
      });
    }
    function selMatch(from, col, idx, f) { return sel && sel.from === from && (from !== "foundation" || sel.f === f); }

    deal();
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.solitaire = openSolitaire;
})();
