/* The five custom sites rendered inside the browser. ctx = {page, navigate, win}. */
(function () {
  "use strict";

  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;

  const session = { bank: false, discord: false };
  const vendorKey = { Amazon: "amazon", Microsoft: "microsoft", YouTube: "youtubeApp", "App Store": "store__" };

  // =================== BANK ===================
  function bank(ctx) {
    if (!session.bank) return bankLogin(ctx);
    const b = S().bank;
    const view = el(`<div class="bank-site">
      <div class="bank-header">
        <div class="row"><span style="width:40px;height:40px">${Icon.md("bank", "Bank")}</span><div><div style="font-size:1.3rem;font-weight:700">Forge Bank</div><div style="opacity:.8">Checking •••• 4242</div></div></div>
        <div style="text-align:right"><div style="opacity:.8">Available balance</div><div class="bank-balance">$${b.balance.toFixed(2)}</div></div>
      </div>
      <div class="bank-content">
        <div class="bank-earn">
          <h3 style="margin-top:0">Get money</h3>
          <div class="bank-earn-row">
            <button class="bank-earn-btn" id="claimDaily">Claim daily bonus<span>+$500</span></button>
            <button class="bank-earn-btn alt" id="topUp">Instant top-up<span>+$100</span></button>
          </div>
          <p class="bank-earn-note" id="claimNote"></p>
        </div>
        <h3>Transactions</h3>
        <div class="tx-list"></div>
      </div>
    </div>`);
    const dk = () => { const d = State.now ? State.now() : new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
    function credit(amount, item) {
      S().bank.balance = Math.round((S().bank.balance + amount) * 100) / 100;
      S().bank.transactions.unshift({ id: "cr_" + Date.now() + "_" + Math.floor(Math.random() * 1000), vendor: "Forge Bank", item, amount: -amount, refundable: false, refunded: false, ts: Date.now(), credit: true });
      State.save();
    }
    const claimBtn = view.querySelector("#claimDaily");
    const claimNote = view.querySelector("#claimNote");
    const claimedToday = S().bank.lastClaim === dk();
    if (claimedToday) { claimBtn.disabled = true; claimNote.textContent = "Daily bonus claimed — come back tomorrow."; }
    claimBtn.onclick = () => { if (S().bank.lastClaim === dk()) return; S().bank.lastClaim = dk(); credit(500, "Daily bonus"); if (window.Notify) Notify.show({ icon: "", title: "Forge Bank", body: "+$500 daily bonus added" }); bank(ctx); };
    view.querySelector("#topUp").onclick = () => { credit(100, "Instant top-up"); if (window.Notify) Notify.show({ icon: "", title: "Forge Bank", body: "+$100 added" }); bank(ctx); };
    const list = view.querySelector(".tx-list");
    if (!b.transactions.length) list.innerHTML = `<p style="opacity:.7">No transactions yet. Go buy something!</p>`;
    b.transactions.forEach((tx) => {
      const row = el(`<div class="tx ${tx.refunded ? "refunded" : ""}">
        <div class="vlogo">${Icon.mini(vendorKey[tx.vendor] || "card", tx.vendor)}</div>
        <div><div><b>${tx.item}</b></div><div style="opacity:.75;font-size:.85rem">${tx.vendor}</div></div>
        <div style="text-align:right"><div class="${tx.credit ? "tx-credit" : ""}">${tx.credit ? "+$" + (-tx.amount).toFixed(2) : "-$" + tx.amount.toFixed(2)}</div></div>
        <div class="q" title="Details">${tx.credit ? "" : "?"}</div>
      </div>`);
      if (tx.credit) row.querySelector(".q").style.visibility = "hidden";
      row.querySelector(".q").onclick = () => {
        if (tx.credit) return;
        if (tx.refunded) { alert(`Already refunded: $${tx.amount.toFixed(2)} for ${tx.item}.`); return; }
        if (!tx.refundable) {
          alert(`Non-refundable item.\n\n${tx.item}\nCost: $${tx.amount.toFixed(2)}\nFrom: ${tx.vendor}`);
          return;
        }
        if (confirm(`Refund $${tx.amount.toFixed(2)} for "${tx.item}"?\nThis will remove the item/access you bought.`)) {
          State.refundTransaction(tx.id);
          revokePurchase(tx);
          bank(ctx);
        }
      };
      list.appendChild(row);
    });
    ctx.page.appendChild(view);
  }

  function bankLogin(ctx) {
    const v = el(`<div class="bank-site" style="display:flex;align-items:center;justify-content:center">
      <form class="dc-card" style="background:#0a5c43">
        <div class="center-col" style="margin-bottom:10px"><span style="width:64px;height:64px">${Icon.big("bank", "Bank")}</span></div>
        <h2 style="margin-top:0;text-align:center">Forge Bank</h2>
        <input type="text" placeholder="Username" name="u">
        <input type="password" placeholder="Password" name="p">
        <button type="submit">Sign in</button>
        <p style="opacity:.7;font-size:.8rem;margin-bottom:0">Any username and password works.</p>
      </form></div>`);
    v.querySelector("form").onsubmit = (e) => { e.preventDefault(); session.bank = true; bank(ctx); };
    ctx.page.appendChild(v);
  }

  function revokePurchase(tx) {
    // remove downloaded app / access tied to a refundable purchase
    if (tx.kind === "app" && tx.refId) {
      const i = S().installedApps.indexOf(tx.refId);
      if (i >= 0) S().installedApps.splice(i, 1);
    }
    if (tx.kind === "premium") S().youtube.premium = false;
    State.save();
  }

  // =================== AMAZON ===================
  function amazon(ctx) {
    renderAmazonGrid(ctx);
  }

  function amazonHeader(ctx, title) {
    const cartCount = S().amazon.cart.length;
    const h = el(`<div class="amz-header">
      <span class="logo">amazon</span>
      <span style="opacity:.8">${title || "All products"}</span>
      <span class="amz-cart-btn">Cart (${cartCount})</span>
    </div>`);
    h.querySelector(".amz-cart-btn").onclick = () => renderCart(ctx);
    h.querySelector(".logo").onclick = () => renderAmazonGrid(ctx);
    return h;
  }

  function renderAmazonGrid(ctx) {
    ctx.page.innerHTML = "";
    const wrap = el(`<div class="amz"></div>`);
    wrap.appendChild(amazonHeader(ctx));
    const grid = el(`<div class="amz-grid"></div>`);
    Catalog.amazonItems.forEach((it) => {
      const card = el(`<div class="amz-card">
        <div class="ic" style="display:flex;justify-content:center">${Icon.big(it.id, it.name)}</div>
        <div>${it.name}</div>
        <div style="color:#007185;font-size:.8rem">Rated ${it.rating} (${it.reviews})</div>
        <div class="price">$${it.price.toFixed(2)}</div>
        <button class="addcart">Add to Cart</button>
        <button class="buynow">Buy Now</button>
      </div>`);
      card.querySelector(".addcart").onclick = () => { S().amazon.cart.push(it.id); State.save(); renderAmazonGrid(ctx); };
      card.querySelector(".buynow").onclick = () => checkout(ctx, [it.id]);
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    ctx.page.appendChild(wrap);
  }

  function renderCart(ctx) {
    ctx.page.innerHTML = "";
    const wrap = el(`<div class="amz"></div>`);
    wrap.appendChild(amazonHeader(ctx, "Cart"));
    const items = S().amazon.cart.map((id) => Catalog.amazonItems.find((x) => x.id === id)).filter(Boolean);
    const total = items.reduce((s, x) => s + x.price, 0);
    const list = el(`<div class="site"></div>`);
    if (!items.length) list.innerHTML = "<p>Your cart is empty.</p>";
    items.forEach((it, idx) => {
      const r = el(`<div class="row" style="border-bottom:1px solid #eee;padding:10px 0">
        <span>${Icon.md(it.id, it.name)}</span><span class="grow">${it.name}</span>
        <span>$${it.price.toFixed(2)}</span> <button class="pill-btn secondary rm">Remove</button></div>`);
      r.querySelector(".rm").onclick = () => { S().amazon.cart.splice(idx, 1); State.save(); renderCart(ctx); };
      list.appendChild(r);
    });
    if (items.length) {
      const foot = el(`<div style="margin-top:16px"><h3>Total: $${total.toFixed(2)}</h3>
        <button class="pill-btn" id="co">Buy Now</button></div>`);
      foot.querySelector("#co").onclick = () => checkout(ctx, S().amazon.cart.slice());
      list.appendChild(foot);
    }
    wrap.appendChild(list);
    ctx.page.appendChild(wrap);
  }

  function checkout(ctx, ids) {
    const items = ids.map((id) => Catalog.amazonItems.find((x) => x.id === id)).filter(Boolean);
    const total = items.reduce((s, x) => s + x.price, 0);
    ctx.page.innerHTML = "";
    const wrap = el(`<div class="amz"></div>`);
    wrap.appendChild(amazonHeader(ctx, "Checkout"));
    const inner = el(`<div class="site">
      <h2>Place your order — $${total.toFixed(2)}</h2>
      <p class="muted">${items.map((i) => i.name).join(", ")}</p>
      <p>Swipe to pay:</p>
      <div class="swipe-track"><div class="swipe-thumb">›</div><div class="swipe-label">Slide to pay $${total.toFixed(2)}</div></div>
      <p class="muted">Items are physical and will be delivered — purchases are non-refundable.</p>
    </div>`);
    wrap.appendChild(inner);
    ctx.page.appendChild(wrap);

    const track = inner.querySelector(".swipe-track");
    const thumb = inner.querySelector(".swipe-thumb");
    let dragging = false, startX = 0, x = 0;
    const maxX = () => track.clientWidth - thumb.clientWidth - 6;
    thumb.onmousedown = (e) => { dragging = true; startX = e.clientX - x; };
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      x = Math.min(maxX(), Math.max(0, e.clientX - startX));
      thumb.style.left = 3 + x + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      if (x >= maxX() - 4) {
        if (S().bank.balance < total) { alert("Insufficient funds in Forge Bank."); thumb.style.left = "3px"; x = 0; return; }
        Pay.ensureCard(() => {
          items.forEach((it) => State.addTransaction({ vendor: "Amazon", item: it.name, amount: it.price, refundable: false }));
          S().amazon.cart = []; State.save();
          Notify.show({ icon: "", title: "Order placed", body: `${items.length} item(s) — $${total.toFixed(2)}`, onClick: () => Browser.openTo("bank.local") });
          thanksPage(ctx, items, total);
        });
      } else { thumb.style.left = "3px"; x = 0; }
    });
  }

  function thanksPage(ctx, items, total) {
    ctx.page.innerHTML = "";
    const wrap = el(`<div class="amz"></div>`);
    wrap.appendChild(amazonHeader(ctx, "Order confirmed"));
    const inner = el(`<div class="site center-col" style="padding:40px">
      <div style="width:72px;height:72px;border-radius:50%;background:#43a047;display:flex;align-items:center;justify-content:center">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h1>Thanks for your order!</h1>
      <p>You paid <b>$${total.toFixed(2)}</b>. Your items are on the way.</p>
      <button class="pill-btn">Continue shopping</button></div>`);
    inner.querySelector("button").onclick = () => renderAmazonGrid(ctx);
    wrap.appendChild(inner);
    ctx.page.appendChild(wrap);
  }

  // =================== MICROSOFT ===================
  function microsoft(ctx) {
    ctx.page.innerHTML = "";
    const wrap = el(`<div class="site" style="min-height:100%">
      <div style="background:#0067c0;color:#fff;padding:20px;margin:-20px -20px 20px;display:flex;align-items:center;gap:12px">${Icon.md("microsoft", "Microsoft")}<h1 style="margin:0">Microsoft</h1></div>
      <h2>Microsoft 365 bundles</h2>
      <p class="muted">Purchasing requires your account password each time. Charges go to Forge Bank. Each bundle includes a Windows 12 product key.</p>
      <div class="amz-grid"></div>
    </div>`);
    const grid = wrap.querySelector(".amz-grid");
    const bundles = [
      { name: "Microsoft 365 Personal", price: 69.99, apps: ["Word", "Excel", "PowerPoint", "Forms", "Outlook", "OneNote", "Copilot"] },
      { name: "Microsoft 365 Family", price: 99.99, apps: ["Word", "Excel", "PowerPoint", "Forms", "Outlook", "OneNote", "Copilot", "Access", "Publisher"] },
      { name: "Office Home & Student", price: 149.99, apps: ["Word", "Excel", "PowerPoint", "Forms"] },
    ];
    bundles.forEach((bd) => {
      const c = el(`<div class="amz-card"><div class="ic" style="display:flex;justify-content:center">${Icon.big("microsoft", "Microsoft 365")}</div><div><b>${bd.name}</b></div>
        <div style="font-size:.8rem;color:#555">${bd.apps.join(", ")}</div>
        <div class="price">$${bd.price.toFixed(2)}</div><button class="buynow">Buy bundle</button></div>`);
      c.querySelector("button").onclick = () => msPurchase(ctx, bd);
      grid.appendChild(c);
    });
    ctx.page.appendChild(wrap);
  }

  function msPurchase(ctx, bd) {
    const acct = S().account;
    const email = (acct && acct.email) || "you@outlook.com";
    ctx.page.innerHTML = "";
    const view = el(`<div class="ms-login-bg">
      <div class="form ms-login">
        <div class="ms-brand">${Icon.md("microsoft", "Microsoft")}<span>Microsoft</span></div>
        <div class="ms-account">${email}</div>
        <div class="title">Enter password</div>
        <div class="text">Confirm your password to buy <b>${bd.name}</b> for <b>$${bd.price.toFixed(2)}</b>.</div>
        <input type="password" class="email" placeholder="Password" autofocus>
        <div class="error-msg" id="msErr"></div>
        <div class="text"><a href="#" id="msForgot">Forgot password?</a></div>
        <div class="button_row">
          <button class="button secondary_button" id="msCancel">Cancel</button>
          <button class="button primary_button" id="msSignin">Sign in</button>
        </div>
      </div>
    </div>`);
    ctx.page.appendChild(view);
    const pwInput = view.querySelector("input");
    const err = view.querySelector("#msErr");
    pwInput.focus();
    view.querySelector("#msForgot").onclick = (e) => { e.preventDefault(); err.textContent = "This is a simulation — any password works if you set one."; };
    view.querySelector("#msCancel").onclick = () => microsoft(ctx);
    const submit = () => {
      const pw = pwInput.value;
      if (acct && acct.password && pw !== acct.password) { err.textContent = "Your account or password is incorrect."; return; }
      if (!pw) { err.textContent = "Please enter your password."; return; }
      if (S().bank.balance < bd.price) { alert("Insufficient funds in Forge Bank."); microsoft(ctx); return; }
      Pay.ensureCard(() => {
        State.addTransaction({ vendor: "Microsoft", item: bd.name, amount: bd.price, refundable: true });
        const freshKey = State.VALID_KEYS.find((k) => !S().redeemedKeys.includes(k));
        Notify.show({ icon: Icon.mini("microsoft", "Microsoft"), title: "Purchase complete", body: `${bd.name} — key: ${freshKey || "n/a"}`, onClick: () => Browser.openTo("bank.local") });
        alert(`Thanks! Your Windows 12 product key:\n\n${freshKey || "All keys used"}\n\nApps: ${bd.apps.join(", ")}`);
        microsoft(ctx);
      });
    };
    view.querySelector("#msSignin").onclick = submit;
    pwInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }

  // =================== YOUTUBE ===================
  function youtube(ctx) { ytHome(ctx); }

  function ytHeader(ctx, extra) {
    const yt = S().youtube;
    const h = el(`<div class="yt-header">
      <span class="yt-logo" style="display:flex;align-items:center;gap:8px">${Icon.mini("youtubeApp", "YouTube")} YouTube</span>
      <span class="grow"></span>
      <button class="pill-btn" id="ytUpload" style="padding:6px 12px">Post</button>
      <button class="pill-btn" id="ytPlaylists" style="padding:6px 12px">Playlists</button>
      <button class="pill-btn" id="ytPremium" style="padding:6px 12px;background:${yt.premium ? "#888" : "#ff0000"}">${yt.premium ? "Premium active" : "Get Premium $3.99"}</button>
    </div>`);
    h.querySelector(".yt-logo").onclick = () => ytHome(ctx);
    h.querySelector("#ytUpload").onclick = () => ytUpload(ctx);
    h.querySelector("#ytPlaylists").onclick = () => ytPlaylists(ctx);
    h.querySelector("#ytPremium").onclick = () => {
      if (yt.premium) { alert("You already have Premium — no ads!"); return; }
      if (S().bank.balance < 3.99) { alert("Insufficient funds."); return; }
      if (confirm("Buy YouTube Premium for $3.99/mo? Removes all ads.")) {
        Pay.ensureCard(() => {
          yt.premium = true;
          State.addTransaction({ vendor: "YouTube", item: "YouTube Premium", amount: 3.99, refundable: true, kind: "premium" });
          State.save();
          Notify.show({ icon: Icon.mini("youtubeApp", "YouTube"), title: "Welcome to Premium", body: "Ads are now removed.", onClick: () => Browser.openTo("bank.local") });
          ytHome(ctx);
        });
      }
    };
    return h;
  }

  function allVideos() {
    const vids = [];
    Catalog.channels.forEach((ch) => ch.videos.forEach((v) => vids.push({ ...v, channel: ch })));
    S().youtube.uploads.forEach((u) => {
      const ch = Catalog.channels.find((c) => c.id === u.channelId) || { id: u.channelId, name: u.channelName, color: "#666" };
      vids.unshift({ id: u.id, title: u.title, views: "New", length: "0:30", channel: ch, uploaded: true });
    });
    return vids;
  }

  function ytHome(ctx) {
    ctx.page.innerHTML = "";
    const wrap = el(`<div class="yt"></div>`);
    wrap.appendChild(ytHeader(ctx));
    const grid = el(`<div class="yt-grid"></div>`);
    allVideos().forEach((v) => {
      const card = el(`<div class="yt-card">
        <div class="yt-thumb" style="background:${v.channel.color}"><span style="font-size:2rem;font-weight:700">${v.channel.name[0]}</span>${v.uploaded ? '<span class="len" style="left:6px;right:auto;background:#cc0000">NEW</span>' : ""}<span class="len">${v.length}</span></div>
        <div class="yt-meta"><div class="yt-avatar">${Icon.box(v.channel.id, v.channel.name, 36)}</div>
        <div><div style="font-weight:600;font-size:.9rem">${v.title}</div><div class="muted" style="font-size:.8rem">${v.channel.name} • ${v.views}</div></div></div>
      </div>`);
      card.onclick = () => ytWatch(ctx, v);
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    ctx.page.appendChild(wrap);
  }

  function ytWatch(ctx, v) {
    ctx.page.innerHTML = "";
    const wrap = el(`<div class="yt"></div>`);
    wrap.appendChild(ytHeader(ctx));
    const yt = S().youtube;
    const liked = yt.likes.includes(v.id);
    const subbed = yt.subscriptions.includes(v.channel.id);
    const player = el(`<div class="yt-player">
      <div class="yt-video"></div>
      <h2 style="margin:12px 0 4px">${v.title}</h2>
      <div class="row">
        <div class="yt-avatar">${Icon.box(v.channel.id, v.channel.name, 36)}</div>
        <div class="grow"><b>${v.channel.name}</b><div class="muted">${v.channel.subs || ""} subscribers</div></div>
        <button class="pill-btn like" style="background:${liked ? "#065fd4" : "#888"}">${liked ? "Liked" : "Like"}</button>
        <button class="pill-btn sub" style="background:${subbed ? "#888" : "#ff0000"}">${subbed ? "Subscribed" : "Subscribe"}</button>
      </div>
    </div>`);
    wrap.appendChild(player);
    ctx.page.appendChild(wrap);

    player.querySelector(".like").onclick = (e) => {
      const i = yt.likes.indexOf(v.id);
      if (i >= 0) yt.likes.splice(i, 1);
      else { yt.likes.push(v.id); if (window.Achievements) window.Achievements.bump("cinephile", 1); }
      State.save(); ytWatch(ctx, v);
    };
    player.querySelector(".sub").onclick = () => {
      const i = yt.subscriptions.indexOf(v.channel.id);
      if (i >= 0) yt.subscriptions.splice(i, 1);
      else { yt.subscriptions.push(v.channel.id); Notify.show({ icon: Icon.mini(v.channel.id, v.channel.name), title: "Subscribed", body: `You subscribed to ${v.channel.name}`, onClick: () => Browser.openTo("youtube.local") }); if (window.Achievements) window.Achievements.unlock("subscriber"); }
      State.save(); ytWatch(ctx, v);
    };

    const videoEl = player.querySelector(".yt-video");
    const vp = makeVideoPlayer(videoEl, v);
    if (!yt.premium) playAd(videoEl, () => vp.play());
    else vp.play();
  }

  // Self-contained animated "video" with play/pause and a progress bar.
  // (YouTube content is allowed to use emoji as placeholder art until images are added.)
  function makeVideoPlayer(videoEl, v) {
    videoEl.innerHTML = "";
    const SIM_SECONDS = 24;
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360;
    canvas.style.cssText = "width:100%;height:100%;display:block";
    videoEl.appendChild(canvas);
    const cx = canvas.getContext("2d");

    const bar = el(`<div class="vp-bar">
      <button class="vp-play" title="Play/Pause">&#9654;</button>
      <button class="vp-sound" title="Mute/Unmute" aria-pressed="false">
        <svg class="vp-vol-on" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        <svg class="vp-vol-off" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display:none"><path d="M3 9v6h4l5 5V4L7 9 3 9z"/><line x1="16" y1="8" x2="22" y2="16" stroke="currentColor" stroke-width="2"/><line x1="22" y1="8" x2="16" y2="16" stroke="currentColor" stroke-width="2"/></svg>
      </button>
      <span class="vp-time">0:00</span>
      <div class="vp-track"><div class="vp-fill"></div></div>
      <span class="vp-dur">${v.length}</span>
      <label class="container vp-fs" title="Fullscreen">
        <input type="checkbox">
        <svg class="expand" xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
        <svg class="compress" xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18" fill="currentColor" style="display:none"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
      </label>
    </div>`);
    videoEl.appendChild(bar);

    // Sound: simulated. There is no audio track; the button toggles a muted state
    // and shows a "Sound on" pulse so it feels real.
    let muted = false;
    const sound = bar.querySelector(".vp-sound");
    const volOn = sound.querySelector(".vp-vol-on"), volOff = sound.querySelector(".vp-vol-off");
    sound.onclick = (e) => {
      e.stopPropagation();
      muted = !muted;
      volOn.style.display = muted ? "none" : "block";
      volOff.style.display = muted ? "block" : "none";
      sound.setAttribute("aria-pressed", String(muted));
      videoEl.classList.toggle("vp-muted", muted);
    };

    // Fullscreen toggle (real) on the player container.
    const fsInput = bar.querySelector(".vp-fs input");
    const fsExpand = bar.querySelector(".vp-fs .expand"), fsCompress = bar.querySelector(".vp-fs .compress");
    bar.querySelector(".vp-fs").addEventListener("click", (e) => e.stopPropagation());
    fsInput.onchange = () => {
      if (fsInput.checked) { if (videoEl.requestFullscreen) videoEl.requestFullscreen().catch(() => {}); }
      else { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
    };
    document.addEventListener("fullscreenchange", () => {
      const on = document.fullscreenElement === videoEl;
      fsInput.checked = on;
      fsExpand.style.display = on ? "none" : "block";
      fsCompress.style.display = on ? "block" : "none";
    });
    const bigPlay = el(`<button class="vp-big">&#9654;</button>`);
    videoEl.appendChild(bigPlay);

    const emojis = ["🎮", "🔥", "⭐", "🚀", "🎉", "💎", "⚡", "🏆"];
    const sprites = Array.from({ length: 8 }, (_, i) => ({
      e: emojis[i % emojis.length],
      x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .002, vy: (Math.random() - .5) * .002, s: 24 + Math.random() * 26,
    }));

    let playing = false, t = 0, raf = null, last = 0;
    const fill = bar.querySelector(".vp-fill"), timeEl = bar.querySelector(".vp-time");
    const playBtns = [bar.querySelector(".vp-play"), bigPlay];

    function fmt(sec) { const m = Math.floor(sec / 60); const s = Math.floor(sec % 60); return m + ":" + s.toString().padStart(2, "0"); }

    function draw() {
      const w = canvas.width, h = canvas.height;
      const g = cx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, v.channel.color); g.addColorStop(1, "#101014");
      cx.fillStyle = g; cx.fillRect(0, 0, w, h);
      // moving sprites
      sprites.forEach((sp) => {
        if (playing) { sp.x += sp.vx; sp.y += sp.vy; if (sp.x < 0 || sp.x > 1) sp.vx *= -1; if (sp.y < 0 || sp.y > 1) sp.vy *= -1; }
        cx.font = sp.s + "px serif"; cx.textAlign = "center"; cx.textBaseline = "middle";
        cx.fillText(sp.e, sp.x * w, sp.y * h);
      });
      // title + channel
      cx.fillStyle = "rgba(0,0,0,.35)"; cx.fillRect(0, h - 90, w, 90);
      cx.fillStyle = "#fff"; cx.textAlign = "center";
      cx.font = "bold 30px Segoe UI, sans-serif"; cx.fillText(v.title, w / 2, h - 52);
      cx.font = "18px Segoe UI, sans-serif"; cx.fillStyle = "#ddd"; cx.fillText(v.channel.name, w / 2, h - 22);
    }

    function loop(ts) {
      if (!last) last = ts;
      const dt = (ts - last) / 1000; last = ts;
      if (playing) {
        t += dt;
        if (t >= SIM_SECONDS) { t = SIM_SECONDS; pause(); showReplay(); }
        fill.style.width = (t / SIM_SECONDS * 100) + "%";
        timeEl.textContent = fmt(t);
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function play() { if (t >= SIM_SECONDS) t = 0; playing = true; bigPlay.style.display = "none"; playBtns.forEach((b) => b.innerHTML = "&#10074;&#10074;"); }
    function pause() { playing = false; bigPlay.style.display = ""; playBtns.forEach((b) => b.innerHTML = "&#9654;"); }
    function showReplay() { bigPlay.innerHTML = "&#8635;"; bigPlay.style.display = ""; }
    function toggle() { playing ? pause() : play(); }

    playBtns.forEach((b) => b.onclick = toggle);
    bar.querySelector(".vp-track").onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * SIM_SECONDS;
      fill.style.width = (t / SIM_SECONDS * 100) + "%"; timeEl.textContent = fmt(t);
    };
    raf = requestAnimationFrame(loop);
    videoEl.closest(".win").addEventListener("DOMNodeRemoved", () => cancelAnimationFrame(raf));
    return { play, pause };
  }

  function playAd(videoEl, onDone) {
    let remaining = 90, skipIn = 10;
    const ad = el(`<div class="yt-ad">
      <div style="font-size:3rem">🛍️🔥💸</div>
      <div style="font-size:2.5rem;font-weight:800;color:#ffd814">MEGA SALE!</div>
      <div>Buy 1 get 1 imaginary thing free! Only at Forge Store.</div>
      <div class="muted" id="adTimer">Ad • 90s</div>
      <button class="yt-skip" disabled>Skip in ${skipIn}</button>
    </div>`);
    videoEl.appendChild(ad);
    const timer = ad.querySelector("#adTimer");
    const skip = ad.querySelector(".yt-skip");
    const finish = () => { clearInterval(iv); ad.remove(); if (onDone) onDone(); };
    const iv = setInterval(() => {
      remaining--; skipIn--;
      timer.textContent = `Ad • ${remaining}s`;
      if (skipIn > 0) skip.textContent = `Skip in ${skipIn}`;
      else { skip.disabled = false; skip.textContent = "Skip Ad"; }
      if (remaining <= 0) finish();
    }, 1000);
    skip.onclick = () => { if (!skip.disabled) finish(); };
  }

  function ytUpload(ctx) {
    ctx.page.innerHTML = "";
    const wrap = el(`<div class="yt"></div>`);
    wrap.appendChild(ytHeader(ctx));
    const f = el(`<div class="site">
      <h2>Post a video</h2>
      <div class="field"><label>Video title</label><input type="text" id="vtitle" placeholder="My awesome video"></div>
      <div class="field"><label>Channel</label><input type="text" id="vchan" placeholder="Your channel name" value="${S().profile.username}"></div>
      <button class="pill-btn" id="post">Upload</button>
    </div>`);
    wrap.appendChild(f);
    ctx.page.appendChild(wrap);
    f.querySelector("#post").onclick = () => {
      const title = f.querySelector("#vtitle").value.trim() || "Untitled";
      const chan = f.querySelector("#vchan").value.trim() || S().profile.username;
      const id = "up_" + Date.now();
      const channelId = "mychan_" + chan.toLowerCase().replace(/\s/g, "");
      S().youtube.uploads.unshift({ id, title, channelId, channelName: chan, ts: Date.now() });
      State.save();
      // notify subscribers (simulated: notify the user)
      Notify.show({ icon: "", title: `${chan} posted`, body: title, onClick: () => Browser.openTo("youtube.local") });
      ytHome(ctx);
    };
  }

  function ytPlaylists(ctx) {
    ctx.page.innerHTML = "";
    const wrap = el(`<div class="yt"></div>`);
    wrap.appendChild(ytHeader(ctx));
    const yt = S().youtube;
    const inner = el(`<div class="site"><h2>Playlists</h2>
      <button class="pill-btn" id="newpl">＋ New playlist</button><div id="plist" style="margin-top:14px"></div></div>`);
    wrap.appendChild(inner);
    ctx.page.appendChild(wrap);
    inner.querySelector("#newpl").onclick = () => {
      const name = prompt("Playlist name:");
      if (name) { yt.playlists.push({ id: "pl_" + Date.now(), name, videos: [] }); State.save(); ytPlaylists(ctx); }
    };
    const plist = inner.querySelector("#plist");
    if (!yt.playlists.length) plist.innerHTML = "<p class='muted'>No playlists yet.</p>";
    yt.playlists.forEach((p) => plist.appendChild(el(`<div class="tx" style="background:rgba(127,127,127,.12);color:var(--text)"><b>${p.name}</b> — ${p.videos.length} videos</div>`)));
  }

  // =================== DISCORD ===================
  const DC_MEMBERS = [{ name: "Nova", color: "#5865f2" }, { name: "Pixel", color: "#3ba55d" }, { name: "Waffle", color: "#faa61a" }, { name: "Echo", color: "#eb459e" }];
  const DC_REPLIES = ["lol", "nice", "for real 😂", "agreed", "welcome!", "gg", "🔥", "who's on tonight?", "same", "let's goo", "based", "real"];
  const DC_TEXT_CHANNELS = ["general", "off-topic", "memes"];
  function playDcSfx(name) { try { const a = new Audio("assets/raw/" + name + ".mp3"); a.volume = 0.5; a.play().catch(() => {}); } catch (_) {} }

  // AI-generated Discord replies so members sound human (uses the AIML key).
  async function dcAiReply(srvName, channel, msgs, member) {
    const key = (S().copilot && S().copilot.apiKey) || window.AIML_KEY;
    const recent = msgs.slice(-8).map((m) => ({ role: m.self ? "user" : "assistant", content: m.text }));
    const sys = `You are ${member.name}, a real person hanging out in the "${srvName}" Discord server, in the #${channel} channel. Reply like a casual Discord user: very short (usually under 12 words), lowercase, relaxed, the occasional emoji, no formal punctuation. Never say you are an AI or a bot. Just react naturally to the latest message.`;
    const res = await fetch(window.AIML_BASE + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "system", content: sys }].concat(recent), max_tokens: 60, temperature: 0.9 }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    return ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").trim();
  }

  function discord(ctx) {
    // Always re-verify on every visit so reCAPTCHA fires each time you open Discord.
    session.discord = false;
    if (!S().discord.loggedIn) return discordLogin(ctx);
    captchaGate(ctx);
  }

  function discordLogin(ctx) {
    ctx.page.innerHTML = "";
    const v = el(`<div class="dc-login"><form class="dc-card">
      <div class="center-col" style="margin-bottom:12px"><span style="width:72px;height:64px">${Icon.big("discord", "Discord")}</span></div>
      <h2 style="margin-top:0;color:#fff;text-align:center">Welcome back!</h2>
      <label style="color:#b5bac1;font-size:.75rem">EMAIL OR PHONE</label>
      <input type="text" name="u">
      <label style="color:#b5bac1;font-size:.75rem">PASSWORD</label>
      <input type="password" name="p">
      <button type="submit">Log In</button>
      <p style="color:#949ba4;font-size:.8rem">You can leave these blank — no info required.</p>
    </form></div>`);
    v.querySelector("form").onsubmit = (e) => { e.preventDefault(); captchaGate(ctx); };
    ctx.page.appendChild(v);
  }

  const RECAPTCHA_SITEKEY = "6LcXTAMtAAAAAM7DlFj7VvoHHIUYqK-ekwoXhDqe";

  function captchaGate(ctx) {
    ctx.page.innerHTML = "";
    const host = el(`<div class="dc-login">
      <div class="captcha" style="background:#fff;color:#111;width:340px">
        <div style="font-weight:600;margin-bottom:12px">reCaptcha</div>
        <div id="recap-host" style="min-height:78px"></div>
        <p class="muted" style="font-size:.72rem;margin-top:10px">reCAPTCHA verifies the challenge; no backend verification.</p>
      </div></div>`);
    ctx.page.appendChild(host);
    const onSolved = () => { session.discord = true; S().discord.loggedIn = true; State.save(); discordApp(ctx); };
    const target = host.querySelector("#recap-host");

    function tryRender() {
      if (!window.grecaptcha || !grecaptcha.render) return false;
      try {
        grecaptcha.render(target, { sitekey: RECAPTCHA_SITEKEY, callback: onSolved });
        return true;
      } catch (e) { return false; }
    }

    if (tryRender()) return;
    // Wait for grecaptcha to load, then fall back to the custom captcha.
    let tries = 0;
    const iv = setInterval(() => {
      if (tryRender()) { clearInterval(iv); return; }
      if (++tries > 12) {
        clearInterval(iv);
        host.querySelector(".captcha").remove();
        renderCaptcha(host, onSolved);
      }
    }, 400);
  }

  function discordApp(ctx) {
    ctx.page.innerHTML = "";
    const wrap = el(`<div class="dc"><div class="dc-rail"></div><div class="dc-main"><div class="dc-content"></div></div></div>`);
    ctx.page.appendChild(wrap);
    const rail = wrap.querySelector(".dc-rail");
    const content = wrap.querySelector(".dc-content");
    const d = S().discord;

    function selectServer(srv) {
      content.innerHTML = "";
      // Not a member yet: show the join card.
      if (!d.joinedServers.includes(srv.id)) {
        const view = el(`<div>
          <div style="height:120px;border-radius:10px;background:${srv.color};display:flex;align-items:flex-end;padding:14px;font-size:2rem;font-weight:700;color:#fff">${srv.name}</div>
          <h1>${srv.name}</h1>
          <p style="white-space:pre-line">${srv.desc || ""}</p>
          <p class="muted">${srv.members || ""} members</p>
          <button class="pill-btn join">Join server</button>
        </div>`);
        view.querySelector(".join").onclick = () => { d.joinedServers.push(srv.id); State.save(); selectServer(srv); };
        content.appendChild(view);
        return;
      }
      // Joined: a usable server with text channels, chat, and a voice channel.
      if (!d.messages) d.messages = {};
      if (!d.messages[srv.id]) {
        d.messages[srv.id] = {};
        DC_TEXT_CHANNELS.forEach((c) => d.messages[srv.id][c] = []);
        d.messages[srv.id].general.push({ author: "Nova", color: "#5865f2", text: `Welcome to ${srv.name}! 👋` });
        d.messages[srv.id].memes.push({ author: "Waffle", color: "#faa61a", text: "posted a fresh meme 😎" });
        State.save();
      }
      let active = DC_TEXT_CHANNELS[0];
      const view = el(`<div class="dc-srv">
        <div class="dc-chans">
          <div class="dc-srv-name">${srv.name}</div>
          <div class="dc-chan-cat">Text</div>
          <div class="dc-chan-list"></div>
          <div class="dc-chan-cat">Voice</div>
          <div class="dc-chan dc-voice">&#128266; General Voice</div>
          <button class="pill-btn dc-leave">Leave server</button>
        </div>
        <div class="dc-chat">
          <div class="dc-chan-head"># <span class="dc-chan-title">general</span></div>
          <div class="dc-msgs"></div>
          <div class="dc-compose"><input placeholder="Message #general"><button class="dc-send">Send</button></div>
        </div>
      </div>`);
      content.appendChild(view);
      const chanList = view.querySelector(".dc-chan-list");
      const msgsEl = view.querySelector(".dc-msgs");
      const title = view.querySelector(".dc-chan-title");
      const input = view.querySelector(".dc-compose input");
      const compose = view.querySelector(".dc-compose");
      const voiceEl = view.querySelector(".dc-voice");

      function renderMsgs() {
        msgsEl.innerHTML = "";
        (d.messages[srv.id][active] || []).forEach((m) => {
          msgsEl.appendChild(el(`<div class="dc-msg"><span class="dc-msg-ava" style="background:${m.color || "#5865f2"}">${(m.author || "?")[0].toUpperCase()}</span><div><div class="dc-msg-head"><b style="color:${m.color || "#fff"}">${escapeHtml(m.author)}</b>${m.self ? `<img class="dc-nitro" src="assets/nitro.png" alt="Nitro" title="Discord Nitro">` : ""}</div><div class="dc-msg-text">${escapeHtml(m.text)}</div></div></div>`));
        });
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
      function selectChan(c) {
        active = c;
        chanList.querySelectorAll(".dc-chan").forEach((x) => x.classList.toggle("active", x.dataset.c === c));
        voiceEl.classList.remove("active");
        title.textContent = c; input.placeholder = "Message #" + c; compose.style.display = "flex";
        renderMsgs();
      }
      DC_TEXT_CHANNELS.forEach((c) => {
        const ch = el(`<div class="dc-chan ${c === active ? "active" : ""}" data-c="${c}"># ${c}</div>`);
        ch.onclick = () => selectChan(c);
        chanList.appendChild(ch);
      });
      renderMsgs();

      function showTyping(member) {
        const t = el(`<div class="dc-typing"><span class="dc-msg-ava" style="background:${member.color}">${member.name[0]}</span><span class="dc-typing-name">${escapeHtml(member.name)}</span><span class="dc-typing-dots"><span></span><span></span><span></span></span></div>`);
        msgsEl.appendChild(t); msgsEl.scrollTop = msgsEl.scrollHeight;
        return t;
      }
      function send() {
        const text = input.value.trim(); if (!text) return;
        const me = (S().profile && S().profile.username) || "You";
        d.messages[srv.id][active].push({ author: me, color: "#00a8fc", text, self: true });
        State.save(); input.value = ""; renderMsgs();
        const chan = active;
        const member = DC_MEMBERS[Math.floor(Math.random() * DC_MEMBERS.length)];
        const typing = (active === chan) ? showTyping(member) : null;
        const deliver = (replyText) => {
          if (typing) typing.remove();
          d.messages[srv.id][chan].push({ author: member.name, color: member.color, text: replyText });
          State.save(); if (active === chan) renderMsgs();
        };
        const started = Date.now();
        dcAiReply(srv.name, chan, d.messages[srv.id][chan], member)
          .then((reply) => {
            const txt = reply || DC_REPLIES[Math.floor(Math.random() * DC_REPLIES.length)];
            const wait = Math.max(0, 700 - (Date.now() - started)); // keep the typing indicator visible a beat
            setTimeout(() => deliver(txt), wait);
          })
          .catch(() => setTimeout(() => deliver(DC_REPLIES[Math.floor(Math.random() * DC_REPLIES.length)]), 500));
      }
      view.querySelector(".dc-send").onclick = send;
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); send(); } });

      voiceEl.onclick = () => {
        chanList.querySelectorAll(".dc-chan").forEach((x) => x.classList.remove("active"));
        voiceEl.classList.add("active");
        title.textContent = "General Voice"; compose.style.display = "none";
        playDcSfx("SFX_014"); // Discord calling noise
        msgsEl.innerHTML = "";
        const vc = el(`<div class="dc-voice-panel"><div class="dc-voice-ring">&#128266;</div><h2>General Voice</h2><p class="muted">You're connected.</p><button class="pill-btn dc-disc">Disconnect</button></div>`);
        msgsEl.appendChild(vc);
        vc.querySelector(".dc-disc").onclick = () => { playDcSfx("SFX_015"); selectChan("general"); };
      };

      view.querySelector(".dc-leave").onclick = () => { const i = d.joinedServers.indexOf(srv.id); if (i >= 0) d.joinedServers.splice(i, 1); State.save(); selectServer(srv); };
    }

    function rebuildRail() {
      rail.innerHTML = "";
      const home = el(`<div class="dc-server" style="background:#1e1f22;overflow:visible">${Icon.mini("discord", "Discord")}</div>`);
      home.onclick = () => showHome();
      rail.appendChild(home);
      const sep = el(`<div style="width:32px;height:2px;background:#35363c"></div>`);
      rail.appendChild(sep);
      const servers = Catalog.discordServers.concat(d.myServers || []);
      servers.forEach((srv) => {
        const s = el(`<div class="dc-server" title="${srv.name}" style="overflow:hidden;background:${srv.color || "#5865f2"}">${Icon.mini(srv.id, srv.name)}</div>`);
        s.onclick = () => selectServer(srv);
        rail.appendChild(s);
      });
      const add = el(`<div class="dc-server" style="background:#3ba55d;color:#fff" title="Add a server">＋</div>`);
      add.onclick = () => addServer();
      rail.appendChild(add);
    }

    function showHome() {
      content.innerHTML = "";
      const home = el(`<div>
        <h1>Direct Messages</h1>
        <p class="muted">Pick a server from the left, or add your own. You can also create bots.</p>
        <h3>Your bots (${(d.bots || []).length})</h3>
        <div id="bots"></div>
        <button class="pill-btn" id="makebot">＋ Create a bot</button>
      </div>`);
      content.appendChild(home);
      const bots = home.querySelector("#bots");
      (d.bots || []).forEach((b) => bots.appendChild(el(`<div class="tx" style="background:#2b2d31">${Icon.mini(b.id, b.name)} <b>${b.name}</b> <span class="muted" style="margin-left:auto">BOT</span></div>`)));
      home.querySelector("#makebot").onclick = () => {
        const name = prompt("Bot name:");
        if (name) { d.bots.push({ id: "bot_" + Date.now(), name }); State.save(); showHome(); }
      };
    }

    function addServer() {
      content.innerHTML = "";
      const view = el(`<div>
        <h1>Add a server</h1>
        <h3>Search & join</h3>
        <input type="text" class="field" id="search" placeholder="Search servers" style="width:100%;padding:10px;border-radius:6px;border:none;background:#1e1f22;color:#fff">
        <div id="results" style="margin:12px 0"></div>
        <hr style="border-color:#35363c">
        <h3>Create your own</h3>
        <input type="text" id="newname" placeholder="Server name" style="width:100%;padding:10px;border-radius:6px;border:none;background:#1e1f22;color:#fff;margin-bottom:8px">
        <button class="pill-btn" id="create">Create server</button>
      </div>`);
      content.appendChild(view);
      const results = view.querySelector("#results");
      const renderResults = (q) => {
        results.innerHTML = "";
        Catalog.discordServers.filter((s) => s.name.toLowerCase().includes((q || "").toLowerCase())).forEach((s) => {
          const r = el(`<div class="tx" style="background:#2b2d31"><span>${Icon.md(s.id, s.name)}</span> <b>${s.name}</b> <span class="grow"></span><button class="pill-btn join">${d.joinedServers.includes(s.id) ? "Joined" : "Join"}</button></div>`);
          r.querySelector(".join").onclick = () => { if (!d.joinedServers.includes(s.id)) d.joinedServers.push(s.id); State.save(); selectServer(s); };
          results.appendChild(r);
        });
      };
      renderResults("");
      view.querySelector("#search").oninput = (e) => renderResults(e.target.value);
      view.querySelector("#create").onclick = () => {
        const name = view.querySelector("#newname").value.trim();
        if (!name) return;
        const srv = { id: "my_" + Date.now(), name, icon: name[0].toUpperCase(), color: "#5865f2", desc: "Your server.", members: "1" };
        d.myServers.push(srv); State.save(); rebuildRail(); selectServer(srv);
      };
    }

    rebuildRail();
    showHome();
  }

  // ---------- Captcha (custom color-grid human check) ----------
  function renderCaptcha(host, onSuccess) {
    const palette = { red: "#e53935", green: "#43a047", purple: "#8e24aa", orange: "#fb8c00" };
    let target, tiles;

    function build() {
      host.innerHTML = "";
      target = Math.random() < 0.5 ? "red" : "green";
      const wrongColor = Math.random() < 0.5 ? "purple" : "orange";
      // 9 tiles: 2-4 target tiles, rest split between the "wrong" color and the other base
      const colors = [];
      const targetCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < targetCount; i++) colors.push(target);
      while (colors.length < 9) colors.push(Math.random() < 0.6 ? wrongColor : (target === "red" ? "green" : "red"));
      shuffle(colors);
      tiles = colors;

      const card = el(`<div class="captcha">
        <div style="font-weight:600">Select all the <span style="color:${palette[target]}">${target.toUpperCase()}</span> squares</div>
        <div class="captcha-grid"></div>
        <div class="row"><button class="pill-btn secondary" id="refresh">Refresh</button><span class="grow"></span><button class="pill-btn" id="verify">Verify</button></div>
        <div class="muted" id="hint">Wrong color today: ${wrongColor}</div>
      </div>`);
      const grid = card.querySelector(".captcha-grid");
      const selected = new Set();
      tiles.forEach((c, i) => {
        const t = el(`<div class="captcha-tile" style="background:${palette[c]}"></div>`);
        t.onclick = () => {
          if (selected.has(i)) { selected.delete(i); t.classList.remove("sel"); }
          else { selected.add(i); t.classList.add("sel"); }
        };
        grid.appendChild(t);
      });
      card.querySelector("#refresh").onclick = build;
      card.querySelector("#verify").onclick = () => {
        const correctSet = tiles.map((c, i) => c === target ? i : -1).filter((i) => i >= 0);
        const ok = correctSet.length === selected.size && correctSet.every((i) => selected.has(i));
        if (ok) {
          grid.innerHTML = "";
          const check = el(`<div class="checkmark-anim"><svg width="64" height="64" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#43b581" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`);
          card.querySelector(".captcha-grid").appendChild(check);
          setTimeout(onSuccess, 700);
        } else {
          [...grid.children].forEach((t) => { t.classList.add("shake"); setTimeout(() => t.classList.remove("shake"), 320); });
        }
      };
      host.appendChild(card);
    }
    build();
  }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

  // =================== DUOLINGO ===================
  function duolingo(ctx) {
    if (S().appData.duolingo == null) S().appData.duolingo = { xp: 0, streak: 0, hearts: 5, completed: [], tier: "free" };
    const d = S().appData.duolingo;
    if (!d.tier) d.tier = "free";
    const tier = d.tier;
    const tierCls = tier === "max" ? "duo-max" : tier === "super" ? "duo-super" : "";
    const heartLabel = (tier === "free") ? d.hearts : "∞";
    ctx.page.innerHTML = "";
    const courses = [
      { id: "duo_en", name: "English" }, { id: "duo_es", name: "Spanish" },
      { id: "duo_ja", name: "Japanese" }, { id: "duo_zh", name: "Mandarin" },
      { id: "duo_sv", name: "Swedish" },
    ];
    const lessons = [
      "Basics 1", "Basics 2", "Greetings", "Food", "Animals", "Family",
      "Numbers", "Travel", "Past Tense", "Hobbies",
    ];

    const heartSvg = `<svg class="duo-heart-svg" width="14" height="14" viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9.5C1 7 4 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 23 7 21.5 11.5 19 16.5 12 21 12 21z" fill="currentColor"/></svg>`;
    const wrap = el(`<div class="duo-site ${tierCls}">
      <div class="duo-header">
        <div class="row" style="gap:10px;align-items:center">
          <span style="width:36px;height:36px">${Icon.md("duolingo", "Duolingo")}</span>
          <span class="duo-brand">duolingo${tier === "super" ? '<span class="duo-badge">SUPER</span>' : tier === "max" ? '<span class="duo-badge duo-badge-max">MAX</span>' : ""}</span>
        </div>
        <span class="grow"></span>
        ${tier === "free" ? `<button class="duo-buy" data-tier="super">Get Super</button>` : ""}
        ${tier !== "max" ? `<button class="duo-buy" data-tier="max">Get Max</button>` : ""}
        <span class="duo-stat" title="Streak">Streak ${d.streak}</span>
        <span class="duo-stat" title="XP"><span class="duo-icn" style="color:#ffc800">★</span>${d.xp}</span>
        <span class="duo-stat duo-hearts" title="Hearts"><span class="duo-icn">${heartSvg}</span>${heartLabel}</span>
      </div>
      <div class="duo-courses"></div>
      <div class="duo-path"></div>
    </div>`);
    wrap.querySelectorAll(".duo-buy").forEach((b) => b.onclick = () => buyDuoTier(ctx, b.dataset.tier));
    const courseRow = wrap.querySelector(".duo-courses");
    courses.forEach((c) => {
      const t = el(`<button class="duo-course"><span style="width:48px;height:48px">${Icon.box(c.id, c.name, 48)}</span><span>${c.name}</span></button>`);
      courseRow.appendChild(t);
    });
    const path = wrap.querySelector(".duo-path");
    lessons.forEach((name, i) => {
      const done = d.completed.includes(i);
      const locked = !done && i > (d.completed.length);
      const node = el(`<div class="duo-node ${done ? "done" : locked ? "locked" : "open"}" style="margin-left:${(i % 2 === 0 ? 0 : 80)}px">
        <button class="duo-circle" ${locked ? "disabled" : ""}>${done ? "✓" : (locked ? "🔒" : i + 1)}</button>
        <div class="duo-label">${name}</div>
      </div>`);
      node.querySelector("button").onclick = () => {
        if (locked) return;
        if (d.hearts <= 0) { alert("Out of hearts! Try again later."); return; }
        startLesson(ctx, i, () => { if (!d.completed.includes(i)) d.completed.push(i); State.save(); duolingo(ctx); });
      };
      path.appendChild(node);
    });
    ctx.page.appendChild(wrap);
  }

  // ------- Duolingo vocabulary + lesson engine -------
  // Spanish course is the default for now; other courses fall back to it.
  const duoVocab = {
    es: [["hello", "hola"], ["goodbye", "adiós"], ["water", "agua"], ["bread", "pan"], ["cat", "gato"],
         ["dog", "perro"], ["yes", "sí"], ["no", "no"], ["thanks", "gracias"], ["please", "por favor"],
         ["man", "hombre"], ["woman", "mujer"], ["apple", "manzana"], ["milk", "leche"], ["sun", "sol"]],
    ja: [["hello", "konnichiwa"], ["goodbye", "sayonara"], ["water", "mizu"], ["cat", "neko"], ["dog", "inu"],
         ["yes", "hai"], ["no", "iie"], ["thanks", "arigatou"], ["sun", "taiyou"], ["book", "hon"]],
    zh: [["hello", "nǐ hǎo"], ["goodbye", "zài jiàn"], ["water", "shuǐ"], ["cat", "māo"], ["dog", "gǒu"],
         ["yes", "shì"], ["no", "bù"], ["thanks", "xiè xie"], ["sun", "tài yáng"], ["bread", "miàn bāo"]],
    sv: [["hello", "hej"], ["goodbye", "hejdå"], ["water", "vatten"], ["cat", "katt"], ["dog", "hund"],
         ["yes", "ja"], ["no", "nej"], ["thanks", "tack"], ["sun", "sol"], ["bread", "bröd"]],
    en: [["hola", "hello"], ["agua", "water"], ["gato", "cat"], ["perro", "dog"], ["gracias", "thanks"],
         ["sí", "yes"], ["no", "no"], ["pan", "bread"], ["sol", "sun"], ["mujer", "woman"]],
  };
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function buyDuoTier(ctx, tier) {
    const prices = { super: 9.99, max: 29.99 };
    const price = prices[tier];
    if (!price) return;
    const name = tier === "super" ? "Super Duolingo" : "Duolingo Max";
    if (S().bank.balance < price) { alert("Insufficient funds in Forge Bank."); return; }
    if (!confirm(`Subscribe to ${name} for $${price.toFixed(2)}?\n\nUnlimited hearts${tier === "max" ? " + Max features" : ""}.`)) return;
    Pay.ensureCard(() => {
      State.addTransaction({ vendor: "Duolingo", item: name + " (1 month)", amount: price, refundable: true });
      S().appData.duolingo.tier = tier;
      S().appData.duolingo.hearts = 5;
      State.save();
      if (window.WM.refreshDesktopIcons) window.WM.refreshDesktopIcons();
      if (window.WM.refreshTaskbar) window.WM.refreshTaskbar();
      Notify.show({ icon: "", title: `${name} active`, body: "Unlimited hearts unlocked.", onClick: () => Browser.openTo("duolingo.local") });
      duolingo(ctx);
    });
  }

  function startLesson(ctx, idx, onDone) {
    const courseId = (S().appData.duolingoCourse || "es");
    const pairs = duoVocab[courseId] || duoVocab.es;
    const target = (S().appData.duolingo);
    const questions = [];
    const types = ["type", "mc", "pairs", "type", "mc"];
    types.forEach((t) => {
      if (t === "pairs") {
        const pool = shuffle(pairs.slice()).slice(0, 4);
        questions.push({ type: "pairs", pool });
      } else {
        const w = pairs[Math.floor(Math.random() * pairs.length)];
        questions.push({ type: t, prompt: w[0], answer: w[1] });
      }
    });

    let qi = 0, correct = 0, lessonXp = 0;

    function render() {
      ctx.page.innerHTML = "";
      if (qi >= questions.length) return finish();
      const q = questions[qi];
      const pct = (qi / questions.length) * 100;
      const heartSvg = `<svg class="duo-heart-svg" width="14" height="14" viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9.5C1 7 4 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 23 7 21.5 11.5 19 16.5 12 21 12 21z" fill="currentColor"/></svg>`;
      const heartLbl = target.tier === "free" ? target.hearts : "∞";
      const tcls = target.tier === "max" ? "duo-max" : target.tier === "super" ? "duo-super" : "";
      const wrap = el(`<div class="duo-lesson ${tcls}">
        <div class="duo-lesson-head">
          <button class="duo-x" title="Quit">&#215;</button>
          <div class="duo-progress"><div class="duo-progress-fill" style="width:${pct}%"></div></div>
          <span class="duo-heart">${heartSvg} ${heartLbl}</span>
        </div>
        <div class="duo-q"></div>
        <div class="duo-foot"><button class="duo-check" disabled>Check</button></div>
      </div>`);
      const body = wrap.querySelector(".duo-q");
      const check = wrap.querySelector(".duo-check");
      wrap.querySelector(".duo-x").onclick = () => showQuitModal(wrap);

      function showQuitModal(host) {
        const overlay = el(`<div class="duo-modal-mask">
          <div class="duo-modal">
            <div class="duo-modal-img" style="width:140px;height:140px;margin:0 auto">${Icon.box("duo_sad", "Sad Duo", 140)}</div>
            <h2>Don't go!</h2>
            <p>You'll lose all <b>${lessonXp} XP</b> from this lesson if you leave.</p>
            <button class="duo-check" id="stay">KEEP LEARNING</button>
            <button class="btn-text" id="leave" style="color:#777;margin-top:10px;width:100%">End lesson</button>
          </div></div>`);
        overlay.querySelector("#stay").onclick = () => overlay.remove();
        overlay.querySelector("#leave").onclick = () => {
          target.xp = Math.max(0, target.xp - lessonXp);
          State.save();
          overlay.remove();
          duolingo(ctx);
        };
        host.appendChild(overlay);
      }

      if (q.type === "type") renderType(q, body, check, onCheck);
      else if (q.type === "mc") renderMC(q, body, pairs, check, onCheck);
      else renderPairs(q, body, check, onCheck);

      ctx.page.appendChild(wrap);
    }

    function onCheck(isRight) {
      if (isRight) { correct++; target.xp += 10; lessonXp += 10; if (window.Achievements) window.Achievements.bump("lesson1", 10); }
      else if (target.tier === "free") { target.hearts = Math.max(0, target.hearts - 1); }
      State.save();
      const banner = el(`<div class="duo-banner ${isRight ? "ok" : "bad"}">${isRight ? "Nice!" : "Not quite"}<button class="pill-btn">Continue</button></div>`);
      ctx.page.querySelector(".duo-lesson").appendChild(banner);
      banner.querySelector("button").onclick = () => { qi++; if (target.hearts <= 0) return finish(); render(); };
    }

    function renderType(q, body, check, done) {
      body.innerHTML = `<h2>Translate this word</h2>
        <div class="duo-word">${q.prompt}</div>
        <input type="text" class="duo-input" placeholder="Type the translation" autocomplete="off">`;
      const inp = body.querySelector("input");
      inp.oninput = () => { check.disabled = !inp.value.trim(); };
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !check.disabled) check.click(); });
      check.onclick = () => done(inp.value.trim().toLowerCase() === q.answer.toLowerCase());
      inp.focus();
    }

    function renderMC(q, body, pool, check, done) {
      const options = [q.answer, ...shuffle(pool.filter((p) => p[1] !== q.answer)).slice(0, 3).map((p) => p[1])];
      shuffle(options);
      body.innerHTML = `<h2>Pick the right translation</h2><div class="duo-word">${q.prompt}</div><div class="duo-mc"></div>`;
      const grid = body.querySelector(".duo-mc");
      let picked = null;
      options.forEach((o) => {
        const b = el(`<button class="duo-mc-opt">${o}</button>`);
        b.onclick = () => { grid.querySelectorAll("button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); picked = o; check.disabled = false; };
        grid.appendChild(b);
      });
      check.onclick = () => done(picked === q.answer);
    }

    function renderPairs(q, body, check, done) {
      const left = q.pool.map((p) => p[0]);
      const right = shuffle(q.pool.map((p) => p[1]).slice());
      body.innerHTML = `<h2>Match the pairs</h2>
        <div class="duo-pairs"><div class="duo-col" id="L"></div><div class="duo-col" id="R"></div></div>`;
      const L = body.querySelector("#L"), R = body.querySelector("#R");
      left.forEach((w) => { const b = el(`<button class="duo-pair-btn" data-w="${w}">${w}</button>`); b.onclick = () => pick("L", b); L.appendChild(b); });
      right.forEach((w) => { const b = el(`<button class="duo-pair-btn" data-w="${w}">${w}</button>`); b.onclick = () => pick("R", b); R.appendChild(b); });
      let selL = null, selR = null, matched = 0;
      function pick(side, btn) {
        if (btn.disabled) return;
        if (side === "L") { L.querySelectorAll("button").forEach((b) => b.classList.remove("sel")); btn.classList.add("sel"); selL = btn; }
        else { R.querySelectorAll("button").forEach((b) => b.classList.remove("sel")); btn.classList.add("sel"); selR = btn; }
        if (selL && selR) {
          const lw = selL.dataset.w, rw = selR.dataset.w;
          const pair = q.pool.find((p) => p[0] === lw);
          if (pair && pair[1] === rw) {
            selL.classList.add("done"); selR.classList.add("done"); selL.disabled = true; selR.disabled = true; matched++;
            selL = null; selR = null;
            if (matched === q.pool.length) { check.disabled = false; }
          } else {
            const a = selL, b = selR;
            a.classList.add("shake"); b.classList.add("shake");
            setTimeout(() => { a.classList.remove("shake", "sel"); b.classList.remove("shake", "sel"); }, 400);
            selL = null; selR = null;
          }
        }
      }
      check.disabled = true;
      check.onclick = () => done(matched === q.pool.length);
    }

    function finish() {
      const failed = target.tier === "free" && target.hearts <= 0;
      if (!failed && window.Achievements) window.Achievements.bump("speedrunner", 1);
      ctx.page.innerHTML = "";
      const wrap = el(`<div class="duo-lesson"><div class="duo-q center-col" style="justify-content:center;height:100%">
        <h1>${failed ? "Out of hearts" : "Lesson complete!"}</h1>
        <p class="muted">${correct} / ${questions.length} correct • +${correct * 10} XP</p>
        <button class="pill-btn" id="back">Back to learning</button></div></div>`);
      wrap.querySelector("#back").onclick = () => { if (!failed) onDone(); else duolingo(ctx); };
      ctx.page.appendChild(wrap);
    }

    render();
  }

  // =================== NETFLIX ===================
  // Native rebuild of the user's Base44 "Netflix Clone" design: profile gate,
  // billboard hero, horizontal rows (Continue Watching, Top 10, Trending, genres),
  // a title detail sheet, and a faux player. Posters are the same free Unsplash
  // stills from the original design. State persists in appData.netflix.
  const NF_HERO = ["1506905925346-21bda4d32df4", "1536440136628-849c177e76a1", "1478760329108-5c3ed9d495a0"];
  const NF_POS = [
    "1500534314209-a25ddb2bd429", "1504593811423-6dd665756598", "1509347528160-9a9e33742cdb",
    "1533106497176-45ae19e68ba2", "1462332420958-a05d1e002413", "1440404653325-ab127d49abc1",
    "1534809027769-b00d750a6bac", "1604975701397-6365ccbd028a", "1520250497591-112f2f40a3f4",
    "1497366216548-37526070297c", "1531297484001-80022131f5a1", "1559583109-3e7968136c99",
    "1470229722913-7c0e2dbbafd3", "1446776811953-b23d57bd21aa", "1518709268805-4e9042af9f23",
  ];
  const nfPoster = (i) => `https://images.unsplash.com/photo-${NF_POS[i % NF_POS.length]}?w=400&h=600&fit=crop`;
  const nfHero = (i) => `https://images.unsplash.com/photo-${NF_HERO[i % NF_HERO.length]}?w=1600&h=900&fit=crop`;

  // id, title, year, rating, kind(film/series), runtime, match%, genres[], desc
  const NF_LIB = [
    ["inception", "Inception", 2010, "PG-13", "film", "2h 28m", 97, ["Sci-Fi", "Thriller", "Action"], "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O."],
    ["breaking-bad", "Breaking Bad", 2008, "TV-MA", "series", "5 Seasons", 98, ["Drama", "Thriller"], "A high-school chemistry teacher diagnosed with cancer turns to a life of crime, producing and selling methamphetamine to secure his family's future."],
    ["dark-knight", "The Dark Knight", 2008, "PG-13", "film", "2h 32m", 96, ["Action", "Thriller", "Drama"], "When the menace known as the Joker wreaks havoc on Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice."],
    ["stranger-things", "Stranger Things", 2016, "TV-14", "series", "4 Seasons", 95, ["Sci-Fi", "Horror", "Drama"], "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl."],
    ["the-matrix", "The Matrix", 1999, "R", "film", "2h 16m", 94, ["Sci-Fi", "Action"], "A computer hacker learns the true nature of his reality and his role in the war against its controllers."],
    ["the-witcher", "The Witcher", 2019, "TV-MA", "series", "3 Seasons", 88, ["Fantasy", "Action", "Drama"], "Geralt of Rivia, a solitary monster hunter, struggles to find his place in a world where people often prove more wicked than beasts."],
    ["interstellar", "Interstellar", 2014, "PG-13", "film", "2h 49m", 93, ["Sci-Fi", "Drama"], "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival."],
    ["the-crown", "The Crown", 2016, "TV-MA", "series", "6 Seasons", 87, ["Drama"], "Follows the political rivalries and romance of Queen Elizabeth II's reign and the events that shaped the second half of the twentieth century."],
    ["pulp-fiction", "Pulp Fiction", 1994, "R", "film", "2h 34m", 92, ["Thriller", "Drama"], "The lives of two mob hitmen, a boxer, a gangster and his wife intertwine in four tales of violence and redemption."],
    ["dark", "Dark", 2017, "TV-MA", "series", "3 Seasons", 90, ["Sci-Fi", "Thriller", "Drama"], "A missing child sets four families on a frantic hunt for answers as they unearth a mind-bending mystery that spans three generations."],
    ["gladiator", "Gladiator", 2000, "R", "film", "2h 35m", 89, ["Action", "Drama"], "A former Roman general sets out to exact vengeance against the corrupt emperor who murdered his family and sent him into slavery."],
    ["the-office", "The Office", 2005, "TV-14", "series", "9 Seasons", 91, ["Comedy"], "A mockumentary on a group of typical office workers, where the workday consists of ego clashes, inappropriate behavior and tedium."],
    ["blade-runner", "Blade Runner 2049", 2017, "R", "film", "2h 44m", 90, ["Sci-Fi", "Thriller"], "A young blade runner's discovery of a long-buried secret leads him to track down former blade runner Rick Deckard, missing for thirty years."],
    ["wednesday", "Wednesday", 2022, "TV-14", "series", "1 Season", 86, ["Comedy", "Horror", "Fantasy"], "Wednesday Addams investigates a monstrous mystery at Nevermore Academy while making new friends — and enemies."],
    ["whiplash", "Whiplash", 2014, "R", "film", "1h 46m", 92, ["Drama"], "A promising young drummer enrolls at a cut-throat music conservatory where his dreams are mentored by an instructor who will stop at nothing."],
    ["money-heist", "Money Heist", 2017, "TV-MA", "series", "5 Seasons", 88, ["Thriller", "Action", "Drama"], "Eight thieves take hostages and lock themselves in the Royal Mint of Spain as a criminal mastermind manipulates the police to carry out his plan."],
    ["parasite", "Parasite", 2019, "R", "film", "2h 12m", 95, ["Thriller", "Drama", "Comedy"], "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan."],
    ["the-mandalorian", "The Mandalorian", 2019, "TV-14", "series", "3 Seasons", 89, ["Sci-Fi", "Action", "Fantasy"], "A lone bounty hunter makes his way through the outer reaches of the galaxy, far from the authority of the New Republic."],
    ["mad-max", "Mad Max: Fury Road", 2015, "R", "film", "2h 0m", 90, ["Action", "Sci-Fi"], "In a post-apocalyptic wasteland, a woman rebels against a tyrannical ruler in search for her homeland with the aid of a group of female prisoners."],
    ["arcane", "Arcane", 2021, "TV-14", "series", "2 Seasons", 94, ["Animation", "Action", "Fantasy"], "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and clashing convictions."],
    ["it", "It", 2017, "R", "film", "2h 15m", 85, ["Horror", "Thriller"], "In the summer of 1989, a group of bullied kids band together to destroy a shape-shifting monster which disguises itself as a clown."],
    ["the-bear", "The Bear", 2022, "TV-MA", "series", "3 Seasons", 92, ["Comedy", "Drama"], "A young chef from the fine-dining world returns to Chicago to run his family's chaotic sandwich shop after a heartbreaking death."],
    ["dune", "Dune", 2021, "PG-13", "film", "2h 35m", 91, ["Sci-Fi", "Action"], "A noble family becomes embroiled in a war for control over the galaxy's most valuable asset while its heir confronts his destiny."],
    ["black-mirror", "Black Mirror", 2011, "TV-MA", "series", "6 Seasons", 89, ["Sci-Fi", "Thriller", "Drama"], "An anthology series exploring a twisted, high-tech near-future where humanity's greatest innovations and darkest instincts collide."],
  ].map((r, i) => ({
    id: r[0], title: r[1], year: r[2], rating: r[3], kind: r[4], runtime: r[5],
    match: r[6], genres: r[7], desc: r[8], poster: nfPoster(i), hero: nfHero(i % NF_HERO.length),
  }));
  const NF_BY_ID = Object.fromEntries(NF_LIB.map((t) => [t.id, t]));

  function nfState() {
    if (!S().appData) S().appData = {};
    const d = S().appData.netflix || (S().appData.netflix = {
      profile: null, myList: [], progress: { "breaking-bad": 30, "dark-knight": 60, "inception": 15, "stranger-things": 75 },
    });
    if (!d.myList) d.myList = [];
    if (!d.progress) d.progress = {};
    return d;
  }

  const NF_PROFILES = [
    { name: "Cameron", color: "#e50914" }, { name: "Guest", color: "#1e88e5" },
    { name: "Family", color: "#43a047" }, { name: "Kids", color: "#fbc02d" },
  ];

  function nfLogo(cls) {
    return `<svg class="${cls || ""}" viewBox="0 0 111 30" xmlns="http://www.w3.org/2000/svg" aria-label="Netflix"><path fill="#e50914" d="M105.06 14.28L111 30c-1.75-.25-3.5-.57-5.28-.84l-3.35-8.69-3.42 7.99c-1.7-.29-3.36-.39-5.06-.62l6.03-13.75L94.45 0h5.03l3.06 7.86L105.85 0H111l-5.94 14.28zM90.6 0h-4.6v25.79c1.5.09 3.07.16 4.6.31V0zM82.83 25.39c-4.2-.28-8.4-.53-12.68-.62V0h4.7v20.36c2.67.06 5.34.27 7.98.43v4.6zM64.3 10.6v4.7h-6.42v10.04h-4.65V0H66.2v4.7h-8.32v5.9h6.42zM45.66 4.7v20.97c-1.57 0-3.16 0-4.7.06V4.7h-4.86V0h14.4v4.7h-4.84zM30.97 15.13c-2.08 0-4.52 0-6.28.08v6.97c2.77-.18 5.54-.39 8.33-.48v4.5l-13.03 1.03V0h13.03v4.7h-8.33v5.78c1.82 0 4.6-.08 6.28-.08v4.73zM4.86 12.94v17.34c-1.69.19-3.19.4-4.86.66V0h4.55l6.19 17.31V0h4.7v28.71c-1.65.29-3.32.39-5.12.69L4.86 12.94z"/></svg>`;
  }

  function netflix(ctx) {
    const d = nfState();
    const root = el(`<div class="nf"></div>`);
    ctx.page.appendChild(root);
    if (!d.signedIn) return nfSignIn(root, ctx);
    if (!d.profile) return nfProfiles(root, ctx);
    nfBrowse(root, ctx);
  }

  function nfSignIn(root, ctx) {
    const d = nfState();
    root.className = "nf nf-gate";
    root.innerHTML = `<div class="nf-signin">
      <div class="nf-gate-top">${nfLogo("nf-wm")}</div>
      <div class="nf-signin-card">
        <h1>Sign In</h1>
        <p class="nf-2fa-sub">Sign in to continue to Netflix.</p>
        <button class="nf-signin-btn" id="nfAuth">Sign In</button>
        <button class="nf-signin-btn" id="nfSignup" style="background:#333;margin-top:8px">Sign up</button>
        <div class="nf-2fa-err" id="nfErr"></div>
        <p class="nf-signin-sub"><span class="link" id="nfGuest" style="cursor:pointer;text-decoration:underline">Continue without signing in</span></p>
      </div>
    </div>`;
    const err = root.querySelector("#nfErr");
    function done(user) {
      d.signedIn = true;
      d.authUser = user ? { name: user.name || user.nickname, email: user.email, picture: user.picture } : null;
      State.save();
      root.innerHTML = ""; root.className = "nf"; nfProfiles(root, ctx);
    }
    function go(opts) {
      if (!window.Auth0) { err.textContent = "Auth0 unavailable — check your connection."; return; }
      err.textContent = "Opening Auth0…";
      // Force the Auth0 login page to show every time (prompt:login).
      const params = Object.assign({ prompt: "login" }, (opts && opts.authorizationParams) || {});
      window.Auth0.verify(done, (msg) => { err.textContent = msg || "Sign in failed."; }, { authorizationParams: params });
    }
    root.querySelector("#nfAuth").onclick = () => go();
    root.querySelector("#nfSignup").onclick = () => go({ authorizationParams: { screen_hint: "signup" } });
    root.querySelector("#nfGuest").onclick = () => done(null);
  }

  function nf2FA(root, ctx) {
    const d = nfState();
    root.className = "nf nf-gate";
    root.innerHTML = `<div class="nf-signin">
      <div class="nf-gate-top">${nfLogo("nf-wm")}</div>
      <form class="nf-signin-card">
        <h1>Verify it's you</h1>
        <p class="nf-2fa-sub">We sent a 6-digit code to <b>${escapeHtml(d._pendingEmail || "your device")}</b> as a notification. Enter it below.</p>
        <input type="text" id="nfCode" class="nf-2fa-input" placeholder="XXX-XXX" maxlength="7" inputmode="numeric">
        <button type="submit" class="nf-signin-btn">Verify</button>
        <button type="button" class="nf-2fa-resend" id="nfResend">Resend code</button>
        <div class="nf-2fa-err" id="nfErr"></div>
      </form>
    </div>`;
    const codeInput = root.querySelector("#nfCode");
    codeInput.addEventListener("input", () => {
      const v = codeInput.value.replace(/\D/g, "").slice(0, 6);
      codeInput.value = v.length > 3 ? v.slice(0, 3) + "-" + v.slice(3) : v;
    });
    let expected = null;
    function sendCode() {
      expected = null;
      // ~1s after arriving, generate a code and deliver it as a notification.
      setTimeout(() => {
        const n = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
        expected = n.slice(0, 3) + "-" + n.slice(3);
        if (window.Notify) Notify.show({ icon: Icon.mini("netflix", "Netflix"), title: "Netflix", body: "Your sign-in code is " + expected });
      }, 1000);
    }
    sendCode();
    root.querySelector("#nfResend").onclick = () => { root.querySelector("#nfErr").textContent = ""; sendCode(); };
    root.querySelector(".nf-signin-card").onsubmit = (e) => {
      e.preventDefault();
      const err = root.querySelector("#nfErr");
      if (!expected) { err.textContent = "Code not sent yet — wait a second for the notification."; return; }
      if (codeInput.value === expected) { d.signedIn = true; State.save(); root.innerHTML = ""; root.className = "nf"; nfProfiles(root, ctx); }
      else err.textContent = "That code isn't right. Check your notification.";
    };
  }

  function nfProfiles(root, ctx) {
    const d = nfState();
    root.className = "nf nf-gate";
    root.innerHTML = `<div class="nf-gate-inner">
      <div class="nf-gate-top">${nfLogo("nf-wm")}</div>
      <h1>Who's watching?</h1>
      <div class="nf-profiles"></div>
    </div>`;
    const wrap = root.querySelector(".nf-profiles");
    NF_PROFILES.forEach((p) => {
      const card = el(`<button class="nf-profile">
        <span class="nf-avatar" style="background:${p.color}">${p.name[0]}</span>
        <span class="nf-pname">${p.name}</span>
      </button>`);
      card.onclick = () => { d.profile = p.name; State.save(); root.innerHTML = ""; root.className = "nf"; nfBrowse(root, ctx); };
      wrap.appendChild(card);
    });
  }

  function nfBrowse(root, ctx, opts) {
    const d = nfState();
    opts = opts || { tab: "Home", q: "" };
    const featured = NF_BY_ID["inception"];
    root.innerHTML = `
      <div class="nf-nav">
        <div class="nf-nav-l">
          ${nfLogo("nf-wm")}
          <nav class="nf-links"></nav>
        </div>
        <div class="nf-nav-r">
          <div class="nf-search"><span>&#128269;</span><input placeholder="Titles, genres" value="${(opts.q || "").replace(/"/g, "&quot;")}"></div>
          <div class="nf-account">
            <span class="nf-avatar nf-avatar-sm" style="background:${(NF_PROFILES.find((p) => p.name === d.profile) || {}).color || "#e50914"}">${(d.profile || "?")[0]}</span>
            <div class="nf-account-menu">
              <button class="nf-am" data-a="switch">Switch profiles</button>
              <button class="nf-am" data-a="account">Account</button>
              <button class="nf-am" data-a="signout">Sign out of Netflix</button>
            </div>
          </div>
        </div>
      </div>
      <div class="nf-scroll"></div>`;

    const links = root.querySelector(".nf-links");
    ["Home", "TV Shows", "Movies", "New & Popular", "My List"].forEach((t) => {
      const a = el(`<button class="nf-link ${t === opts.tab ? "active" : ""}">${t}</button>`);
      a.onclick = () => nfBrowse(root, ctx, { tab: t, q: "" });
      links.appendChild(a);
    });

    const search = root.querySelector(".nf-search input");
    let tmr;
    search.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => nfBrowse(root, ctx, { tab: opts.tab, q: search.value }), 250); };

    // Account menu: switch profiles / account / sign out
    const acct = root.querySelector(".nf-account");
    acct.querySelector(".nf-avatar-sm").onclick = (e) => { e.stopPropagation(); acct.classList.toggle("open"); };
    acct.querySelector('[data-a="switch"]').onclick = () => { d.profile = null; State.save(); root.innerHTML = ""; root.className = "nf"; nfProfiles(root, ctx); };
    acct.querySelector('[data-a="account"]').onclick = () => {
      const u = d.authUser || {};
      alert("Netflix account\n\n" + (u.email ? "Signed in as: " + u.email : "Signed in") + "\nProfile: " + (d.profile || "—"));
    };
    acct.querySelector('[data-a="signout"]').onclick = () => {
      // Sign out of Netflix (back to the sign-in screen). The next sign-in
      // still shows the Auth0 page because of prompt:login.
      d.signedIn = false; d.profile = null; d.authUser = null; State.save();
      root.innerHTML = ""; root.className = "nf"; nfSignIn(root, ctx);
    };
    document.addEventListener("click", function h(ev) { if (!acct.contains(ev.target)) { acct.classList.remove("open"); if (!root.isConnected) document.removeEventListener("click", h); } });

    const scroll = root.querySelector(".nf-scroll");
    const q = (opts.q || "").trim().toLowerCase();

    if (q) {
      const hits = NF_LIB.filter((t) => t.title.toLowerCase().includes(q) || t.genres.some((g) => g.toLowerCase().includes(q)));
      const grid = el(`<div class="nf-results"><h2>${hits.length ? "Results for “" + q + "”" : "No titles found for “" + q + "”"}</h2><div class="nf-grid"></div></div>`);
      const g = grid.querySelector(".nf-grid");
      hits.forEach((t) => g.appendChild(nfCard(t, root, ctx)));
      scroll.appendChild(grid);
      return;
    }

    // Hero billboard
    const myInList = d.myList.includes(featured.id);
    const hero = el(`<div class="nf-hero" style="background-image:linear-gradient(90deg,rgba(0,0,0,.8) 0%,rgba(0,0,0,.3) 50%,transparent 70%),linear-gradient(0deg,#141414 2%,transparent 30%),url('${featured.hero}')">
      <div class="nf-hero-body">
        <div class="nf-hero-badge">${nfLogo("nf-wm-sm")} <span>FILM</span></div>
        <h1 class="nf-hero-title">${featured.title}</h1>
        <div class="nf-hero-meta"><span class="nf-match">${featured.match}% Match</span><span>${featured.year}</span><span class="nf-rate">${featured.rating}</span><span>${featured.runtime}</span></div>
        <p class="nf-hero-desc">${featured.desc}</p>
        <div class="nf-hero-btns">
          <button class="nf-play">&#9654; Play</button>
          <button class="nf-info">&#9432; More Info</button>
        </div>
      </div>
    </div>`);
    hero.querySelector(".nf-play").onclick = () => nfPlayer(featured, root, ctx);
    hero.querySelector(".nf-info").onclick = () => nfDetail(featured, root, ctx);
    scroll.appendChild(hero);

    // Build rows depending on tab
    const rows = [];
    if (opts.tab === "My List") {
      rows.push(["My List", d.myList.map((id) => NF_BY_ID[id]).filter(Boolean)]);
    } else if (opts.tab === "TV Shows") {
      rows.push(["Trending Series", NF_LIB.filter((t) => t.kind === "series")]);
      ["Drama", "Sci-Fi", "Comedy", "Fantasy"].forEach((g) => rows.push([g + " Series", NF_LIB.filter((t) => t.kind === "series" && t.genres.includes(g))]));
    } else if (opts.tab === "Movies") {
      rows.push(["Trending Films", NF_LIB.filter((t) => t.kind === "film")]);
      ["Action", "Sci-Fi", "Thriller", "Drama"].forEach((g) => rows.push([g + " Movies", NF_LIB.filter((t) => t.kind === "film" && t.genres.includes(g))]));
    } else if (opts.tab === "New & Popular") {
      rows.push(["New Releases", NF_LIB.slice().sort((a, b) => b.year - a.year)]);
      rows.push(["Top 10 Today", NF_LIB.slice().sort((a, b) => b.match - a.match).slice(0, 10), "rank"]);
    } else {
      const cont = Object.keys(d.progress).map((id) => NF_BY_ID[id]).filter(Boolean);
      if (cont.length) rows.push(["Continue Watching for " + d.profile, cont, "progress"]);
      rows.push(["Top 10 Today", NF_LIB.slice().sort((a, b) => b.match - a.match).slice(0, 10), "rank"]);
      rows.push(["Trending Now", NF_LIB.slice(4, 16)]);
      if (d.myList.length) rows.push(["My List", d.myList.map((id) => NF_BY_ID[id]).filter(Boolean)]);
      ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Thriller"].forEach((g) => rows.push([g, NF_LIB.filter((t) => t.genres.includes(g))]));
    }

    rows.forEach(([label, items, mode]) => {
      if (!items || !items.length) return;
      const row = el(`<div class="nf-row"><h2>${label}</h2><div class="nf-strip ${mode === "rank" ? "nf-rank-strip" : ""}"></div></div>`);
      const strip = row.querySelector(".nf-strip");
      items.forEach((t, i) => {
        if (mode === "rank") {
          const r = el(`<div class="nf-rank-item"><span class="nf-rank-num">${i + 1}</span></div>`);
          r.appendChild(nfCard(t, root, ctx));
          strip.appendChild(r);
        } else {
          const card = nfCard(t, root, ctx, mode === "progress" ? (d.progress[t.id] || 0) : null);
          strip.appendChild(card);
        }
      });
      scroll.appendChild(row);
    });

    if (opts.tab === "My List" && !d.myList.length) {
      scroll.appendChild(el(`<div class="nf-empty">Your list is empty. Tap <b>+ My List</b> on any title to add it here.</div>`));
    }

    // Footer
    scroll.appendChild(el(`<div class="nf-footer">
      <div class="nf-foot-links">${["Audio Description", "Help Center", "Gift Cards", "Media Center", "Investor Relations", "Jobs", "Terms of Use", "Privacy", "Legal Notices", "Cookie Preferences", "Corporate Information", "Contact Us"].map((l) => `<span>${l}</span>`).join("")}</div>
      <div class="nf-foot-copy">&copy; 2026 Netflix Clone &middot; built into Windows 12</div>
    </div>`));
  }

  function nfCard(t, root, ctx, progress) {
    const card = el(`<button class="nf-card">
      <img loading="lazy" src="${t.poster}" alt="${t.title}">
      <span class="nf-card-title">${t.title}</span>
      ${progress != null ? `<span class="nf-card-prog"><span style="width:${progress}%"></span></span>` : ""}
    </button>`);
    card.onclick = () => nfDetail(t, root, ctx);
    return card;
  }

  function nfOverlay(root) {
    const old = root.querySelector(".nf-overlay");
    if (old) old.remove();
    const ov = el(`<div class="nf-overlay"></div>`);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    root.appendChild(ov);
    return ov;
  }

  function nfDetail(t, root, ctx) {
    const d = nfState();
    const ov = nfOverlay(root);
    const inList = d.myList.includes(t.id);
    const sheet = el(`<div class="nf-sheet">
      <button class="nf-close" title="Close">&times;</button>
      <div class="nf-sheet-hero" style="background-image:linear-gradient(0deg,#181818 5%,transparent 50%),url('${t.hero}')">
        <div class="nf-sheet-hero-body">
          <h1>${t.title}</h1>
          <div class="nf-sheet-btns">
            <button class="nf-play">&#9654; Play</button>
            <button class="nf-add ${inList ? "on" : ""}" title="${inList ? "Remove from My List" : "Add to My List"}">${inList ? "&#10003;" : "+"}</button>
          </div>
        </div>
      </div>
      <div class="nf-sheet-body">
        <div class="nf-sheet-main">
          <div class="nf-sheet-meta"><span class="nf-match">${t.match}% Match</span><span>${t.year}</span><span class="nf-rate">${t.rating}</span><span>${t.runtime}</span><span class="nf-hd">HD</span></div>
          <p>${t.desc}</p>
        </div>
        <div class="nf-sheet-side">
          <div><span class="nf-dim">Genres:</span> ${t.genres.join(", ")}</div>
          <div><span class="nf-dim">Type:</span> ${t.kind === "series" ? "Series" : "Film"}</div>
        </div>
      </div>
    </div>`);
    sheet.querySelector(".nf-close").onclick = () => ov.remove();
    sheet.querySelector(".nf-play").onclick = () => { ov.remove(); nfPlayer(t, root, ctx); };
    sheet.querySelector(".nf-add").onclick = (e) => {
      const i = d.myList.indexOf(t.id);
      if (i >= 0) d.myList.splice(i, 1); else d.myList.push(t.id);
      State.save();
      const on = d.myList.includes(t.id);
      e.currentTarget.classList.toggle("on", on);
      e.currentTarget.innerHTML = on ? "&#10003;" : "+";
      e.currentTarget.title = on ? "Remove from My List" : "Add to My List";
    };
    ov.appendChild(sheet);
  }

  function nfPlayer(t, root, ctx) {
    const d = nfState();
    const start = d.progress[t.id] || 0;
    const ov = nfOverlay(root);
    ov.classList.add("nf-player-ov");
    const player = el(`<div class="nf-player" style="background-image:linear-gradient(0deg,rgba(0,0,0,.9),rgba(0,0,0,.4)),url('${t.hero}')">
      <button class="nf-player-back" title="Back">&#8592;</button>
      <div class="nf-player-center"><div class="nf-player-logo">${nfLogo("nf-wm")}</div><div class="nf-player-name">${t.title}</div></div>
      <div class="nf-player-ctrl">
        <div class="nf-scrub"><span class="nf-scrub-fill" style="width:${start}%"></span></div>
        <div class="nf-player-row">
          <button class="nf-pp" title="Pause">&#10074;&#10074;</button>
          <span class="nf-time">${t.title} &middot; ${t.runtime}</span>
          <button class="nf-skip">Skip Intro</button>
        </div>
      </div>
    </div>`);
    let pct = start, playing = true, timer = null;
    const fill = player.querySelector(".nf-scrub-fill");
    const pp = player.querySelector(".nf-pp");
    function tick() { if (!playing) return; pct = Math.min(100, pct + 0.4); fill.style.width = pct + "%"; if (pct >= 100) stop(); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } d.progress[t.id] = Math.round(pct); State.save(); }
    timer = setInterval(tick, 200);
    pp.onclick = () => { playing = !playing; pp.innerHTML = playing ? "&#10074;&#10074;" : "&#9654;"; pp.title = playing ? "Pause" : "Play"; };
    player.querySelector(".nf-skip").onclick = () => { pct = Math.min(100, pct + 12); fill.style.width = pct + "%"; };
    player.querySelector(".nf-player-back").onclick = () => { stop(); ov.remove(); nfBrowse(root, ctx); };
    ov.onclick = (e) => { if (e.target === ov) { stop(); ov.remove(); nfBrowse(root, ctx); } };
    ov.appendChild(player);
  }

  // ============================ FlightStats ============================
  // Flight tracker + airport departures board. Uses a real API when one is
  // configured on window.FLIGHT_API ({base, key} — e.g. AviationStack); until
  // then it serves realistic, deterministic placeholder data so it works now.
  const AIRLINES = {
    UA: "United", AA: "American", DL: "Delta", WN: "Southwest", B6: "JetBlue",
    AS: "Alaska", NK: "Spirit", F9: "Frontier", BA: "British Airways", LH: "Lufthansa",
    AF: "Air France", EK: "Emirates", QF: "Qantas", AC: "Air Canada", EY: "Etihad",
  };
  // Airline logos we have art for (IATA code -> file).
  const AIRLINE_LOGO = { UA: "airline_ua.png", DL: "airline_dl.png", AC: "airline_ac.png", AA: "airline_aa.png", EY: "airline_ey.png", WN: "airline_wn.png", B6: "airline_b6.png" };
  function airlineLogo(code, cls) { const f = AIRLINE_LOGO[code]; return f ? `<img class="${cls || "fs-logo-img"}" src="assets/${f}" alt="">` : ""; }
  const AIRPORTS = {
    JFK: ["New York", "John F. Kennedy Intl"], LAX: ["Los Angeles", "Los Angeles Intl"],
    ORD: ["Chicago", "O'Hare Intl"], ATL: ["Atlanta", "Hartsfield-Jackson"],
    SFO: ["San Francisco", "San Francisco Intl"], DFW: ["Dallas", "Dallas/Fort Worth"],
    DEN: ["Denver", "Denver Intl"], SEA: ["Seattle", "Seattle-Tacoma"],
    MIA: ["Miami", "Miami Intl"], BOS: ["Boston", "Logan Intl"],
    LHR: ["London", "Heathrow"], LAS: ["Las Vegas", "Harry Reid Intl"],
    PHX: ["Phoenix", "Sky Harbor"], EWR: ["Newark", "Liberty Intl"],
  };
  const AIRPORT_CODES = Object.keys(AIRPORTS);
  // Lat/lon for the map (major airports; unknown codes simply skip the map).
  const AIRPORT_COORDS = {
    JFK: [-73.7781, 40.6413], LAX: [-118.4085, 33.9416], ORD: [-87.9073, 41.9742], ATL: [-84.4277, 33.6407],
    SFO: [-122.3790, 37.6213], DFW: [-97.0403, 32.8998], DEN: [-104.6737, 39.8561], SEA: [-122.3088, 47.4502],
    MIA: [-80.2870, 25.7959], BOS: [-71.0096, 42.3656], LHR: [-0.4543, 51.4700], LAS: [-115.1537, 36.0840],
    PHX: [-112.0116, 33.4342], EWR: [-74.1745, 40.6895], LGA: [-73.8740, 40.7769], CDG: [2.5479, 49.0097],
    MCO: [-81.3081, 28.4312], IAH: [-95.3368, 29.9902], CLT: [-80.9431, 35.2140], PHL: [-75.2424, 39.8744],
    MSP: [-93.2223, 44.8848], DTW: [-83.3554, 42.2162], FLL: [-80.1506, 26.0742], DCA: [-77.0402, 38.8512],
    SLC: [-111.9791, 40.7899], BWI: [-76.6684, 39.1774], SAN: [-117.1933, 32.7338], TPA: [-82.5332, 27.9755],
    PDX: [-122.5951, 45.5898], HNL: [-157.9251, 21.3245], AMS: [4.7683, 52.3105], FRA: [8.5622, 50.0379],
    MAD: [-3.5676, 40.4983], BCN: [2.0833, 41.2974], FCO: [12.2389, 41.8003], DXB: [55.3657, 25.2532],
    AUH: [54.6511, 24.4330], NRT: [140.3929, 35.7720], HND: [139.7798, 35.5494], SYD: [151.1753, -33.9399],
    YYZ: [-79.6248, 43.6777], YVR: [-123.1815, 49.1967], MEX: [-99.0721, 19.4363], GRU: [-46.4731, -23.4356],
    MDE: [-75.4231, 6.1645], LGG: [5.4432, 50.6374], MUC: [11.7861, 48.3538], SVO: [37.4146, 55.9726],
  };
  // Great-circle interpolation for a nicely arced route line.
  function toRad(d) { return d * Math.PI / 180; } function toDeg(r) { return r * 180 / Math.PI; }
  function greatCircle(a, b, n) {
    const lon1 = toRad(a[0]), lat1 = toRad(a[1]), lon2 = toRad(b[0]), lat2 = toRad(b[1]);
    const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2));
    if (!d) return [a, b];
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
      const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
      const z = A * Math.sin(lat1) + B * Math.sin(lat2);
      pts.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
    }
    return pts;
  }
  function bearing(a, b) {
    const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
    const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  const STATUSES = [
    { k: "ontime", label: "On Time", c: "#16a34a" },
    { k: "boarding", label: "Boarding", c: "#2563eb" },
    { k: "delayed", label: "Delayed", c: "#d97706" },
    { k: "departed", label: "Departed", c: "#0891b2" },
    { k: "landed", label: "Landed", c: "#64748b" },
    { k: "cancelled", label: "Cancelled", c: "#dc2626" },
  ];
  function fsHash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function fsPick(arr, seed) { return arr[Math.abs(seed) % arr.length]; }
  function hhmm(ts) { try { return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch (_) { return ""; } }
  // Real-time progress (0-100) from departure/arrival timestamps.
  function progressFrom(depTs, arrTs) {
    if (!depTs || !arrTs || arrTs <= depTs) return null;
    const now = Date.now();
    if (now <= depTs) return 0;
    if (now >= arrTs) return 100;
    return (now - depTs) / (arrTs - depTs) * 100;
  }
  function statusFromTimes(depTs, arrTs) {
    const now = Date.now();
    if (now < depTs - 20 * 60000) return STATUSES.find((s) => s.k === "ontime");
    if (now < depTs) return STATUSES.find((s) => s.k === "boarding");
    if (now < arrTs) return STATUSES.find((s) => s.k === "departed");
    return STATUSES.find((s) => s.k === "landed");
  }

  function mockFlight(no) {
    const iata = no.replace(/\s+/g, "").toUpperCase();
    const seed = fsHash(iata);
    const carrier = iata.slice(0, 2), num = iata.slice(2) || (seed % 900 + 100);
    let o = seed % AIRPORT_CODES.length, d = (seed >>> 4) % AIRPORT_CODES.length; if (d === o) d = (d + 1) % AIRPORT_CODES.length;
    const origin = AIRPORT_CODES[o], dest = AIRPORT_CODES[d];
    // Anchor departure to a fixed time today so progress advances with the clock.
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const durMs = (90 + (seed % 6) * 45) * 60000;
    const delay = (seed % 5 === 0) ? (20 + (seed % 4) * 15) : 0;
    const depTs = midnight.getTime() + (5 + seed % 15) * 3600000 + (seed % 60) * 60000;
    const arrTs = depTs + durMs + delay * 60000;
    const st = statusFromTimes(depTs, arrTs);
    return {
      airline: AIRLINES[carrier] || (carrier + " Airlines"), carrier, flight: carrier + num,
      status: st, origin, dest,
      originName: (AIRPORTS[origin] || [origin])[0], destName: (AIRPORTS[dest] || [dest])[0],
      dep: hhmm(depTs), arr: hhmm(arrTs), depTs, arrTs,
      gate: String.fromCharCode(65 + (seed % 6)) + (seed % 30 + 1), termina: (seed % 4) + 1,
      aircraft: fsPick(["Boeing 737-800", "Airbus A320", "Boeing 787-9", "Airbus A321neo", "Embraer E175"], seed >> 6),
      progress: progressFrom(depTs, arrTs) || 0,
      delay,
    };
  }
  function mockDepartures(code) {
    const ac = code.replace(/\s+/g, "").toUpperCase() || "JFK";
    const base = fsHash(ac);
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const seed = fsHash(ac + i);
      const carrier = fsPick(Object.keys(AIRLINES), seed);
      let d = seed % AIRPORT_CODES.length; if (AIRPORT_CODES[d] === ac) d = (d + 1) % AIRPORT_CODES.length;
      rows.push({
        flight: carrier + (seed % 900 + 100), airline: AIRLINES[carrier], carrier,
        dest: AIRPORT_CODES[d], destName: (AIRPORTS[AIRPORT_CODES[d]] || [""])[0],
        time: fsTime(6 * 60 + i * 42 + (seed % 15)),
        gate: String.fromCharCode(65 + (seed % 6)) + (seed % 30 + 1),
        status: fsPick(STATUSES, seed >> 2),
      });
    }
    return { airport: ac, name: (AIRPORTS[ac] || [ac, "Airport"])[1], rows };
  }
  // Build an AviationStack request, routed through the HTTPS proxy so an HTTPS
  // page can reach the HTTP-only free tier.
  function aviationURL(params) {
    const cfg = window.FLIGHT_API;
    const qs = Object.keys(params).map((k) => k + "=" + encodeURIComponent(params[k])).join("&");
    const target = cfg.http + "/flights?access_key=" + cfg.key + "&" + qs;
    return cfg.proxy ? cfg.proxy + encodeURIComponent(target) : target;
  }
  function fetchTimeout(url, ms) { return Promise.race([fetch(url), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]); }
  const AV_STATUS = { scheduled: "ontime", active: "departed", landed: "landed", cancelled: "cancelled", incident: "delayed", diverted: "delayed" };
  function avTime(iso) { try { return iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""; } catch (_) { return ""; } }
  function tsOf(seg) { if (!seg) return null; const s = seg.actual || seg.estimated || seg.scheduled; return s ? new Date(s).getTime() : null; }
  function parseFlight(f, fallbackNo) {
    const carrier = ((f.flight && f.flight.iata) || "").slice(0, 2);
    const st = STATUSES.find((s) => s.k === AV_STATUS[f.flight_status]) || STATUSES[0];
    const depTs = tsOf(f.departure), arrTs = tsOf(f.arrival);
    const timeProg = progressFrom(depTs, arrTs);
    const live = f.live && f.live.latitude != null ? { lat: f.live.latitude, lon: f.live.longitude, dir: f.live.direction } : null;
    return {
      airline: (f.airline && f.airline.name) || AIRLINES[carrier] || carrier, carrier, flight: (f.flight && f.flight.iata) || fallbackNo,
      status: st, origin: (f.departure && f.departure.iata) || "", dest: (f.arrival && f.arrival.iata) || "",
      originName: (f.departure && f.departure.airport) || "", destName: (f.arrival && f.arrival.airport) || "",
      dep: avTime(f.departure && f.departure.scheduled), arr: avTime(f.arrival && f.arrival.scheduled), depTs, arrTs,
      gate: (f.departure && f.departure.gate) || "—", termina: (f.departure && f.departure.terminal) || "—",
      aircraft: (f.aircraft && (f.aircraft.iata || f.aircraft.icao)) || "—",
      progress: timeProg != null ? timeProg : (f.flight_status === "landed" ? 100 : f.flight_status === "active" ? 50 : 0),
      delay: (f.departure && f.departure.delay) || 0, live,
    };
  }
  async function fetchFlight(no) {
    const cfg = window.FLIGHT_API, iata = no.replace(/\s+/g, "").toUpperCase();
    if (cfg && cfg.key) {
      try {
        const r = await fetchTimeout(aviationURL({ flight_iata: iata }), 8000);
        const j = await r.json(); const f = j && j.data && j.data[0];
        if (f) return parseFlight(f, iata);
      } catch (_) { /* fall through */ }
    }
    return mockFlight(iata);
  }
  async function fetchDepartures(code) {
    const cfg = window.FLIGHT_API, ac = (code || "JFK").replace(/\s+/g, "").toUpperCase();
    if (cfg && cfg.key) {
      try {
        const r = await fetchTimeout(aviationURL({ dep_iata: ac, limit: 20 }), 8000);
        const j = await r.json(); const arr = j && j.data;
        if (arr && arr.length) return {
          airport: ac, name: (arr[0].departure && arr[0].departure.airport) || ac,
          rows: arr.slice(0, 14).map((f) => { const p = parseFlight(f, ""); return { flight: p.flight, airline: p.airline, carrier: p.carrier, dest: p.dest, destName: p.destName, time: p.dep, gate: p.gate, status: p.status }; }),
        };
      } catch (_) { /* fall through */ }
    }
    return mockDepartures(ac);
  }

  function flightStats(ctx) {
    const esc = escapeHtml;
    const page = ctx.page;
    page.innerHTML = `<div class="fs">
      <aside class="fs-side">
        <div class="fs-brand"><span class="fs-logo">✈</span> FlightStats</div>
        <button class="fs-nav on" data-t="track"><span>✈</span> Flight Tracker</button>
        <button class="fs-nav" data-t="board"><span>🛫</span> Departures</button>
        <div class="fs-api" id="fsApi"></div>
      </aside>
      <main class="fs-main"></main>
    </div>`;
    const main = page.querySelector(".fs-main");
    const apiEl = page.querySelector("#fsApi");
    const live = !!(window.FLIGHT_API && window.FLIGHT_API.key);
    apiEl.textContent = live ? "● Live flight data" : "● Demo data";
    apiEl.className = "fs-api " + (live ? "live" : "");
    let tab = "track", liveTimer = null, curMapApi = null;
    page.querySelectorAll(".fs-nav").forEach((b) => b.onclick = () => { tab = b.dataset.t; page.querySelectorAll(".fs-nav").forEach((x) => x.classList.toggle("on", x === b)); render(); });

    function badge(st) { return `<span class="fs-badge" style="background:${st.c}">${st.label}</span>`; }
    function stopLive() { clearInterval(liveTimer); liveTimer = null; if (curMapApi && curMapApi.destroy) { curMapApi.destroy(); curMapApi = null; } }
    function render() { stopLive(); tab === "track" ? renderTrack() : renderBoard(); }

    function renderTrack(no) {
      main.innerHTML = `<div class="fs-track">
        <h1>Track a flight</h1>
        <div class="fs-search"><input class="fs-in" placeholder="Flight number (e.g. UA1234)" value="${no ? esc(no) : ""}"><button class="fs-go">Search</button></div>
        <div class="fs-result"></div>
      </div>`;
      const input = main.querySelector(".fs-in"), go = main.querySelector(".fs-go"), out = main.querySelector(".fs-result");
      const run = async () => {
        const v = input.value.trim(); if (!v) return;
        stopLive();
        out.innerHTML = `<div class="fs-loading">Looking up ${esc(v.toUpperCase())}…</div>`;
        const f = await fetchFlight(v);
        const prog0 = f.progress || 0;
        out.innerHTML = `<div class="fs-card">
          <div class="fs-card-top"><div class="fs-card-id">${airlineLogo(f.carrier, "fs-card-logo")}<div><div class="fs-fl">${esc(f.flight)}</div><div class="fs-al">${esc(f.airline)}</div></div></div>${badge(f.status)}</div>
          <div class="fs-route">
            <div class="fs-ep"><div class="fs-code">${esc(f.origin)}</div><div class="fs-city">${esc(f.originName)}</div><div class="fs-t">${esc(f.dep)}</div></div>
            <div class="fs-line"><div class="fs-line-fill" style="width:${prog0}%"></div><span class="fs-plane" style="left:${prog0}%">✈</span></div>
            <div class="fs-ep"><div class="fs-code">${esc(f.dest)}</div><div class="fs-city">${esc(f.destName)}</div><div class="fs-t">${esc(f.arr)}</div></div>
          </div>
          <div class="fs-meta">
            <div><span>Gate</span><b>${esc(f.gate)}</b></div>
            <div><span>Terminal</span><b>${esc(f.termina)}</b></div>
            <div><span>Aircraft</span><b>${esc(f.aircraft)}</b></div>
            <div><span>${f.delay ? "Delay" : "Scheduled"}</span><b>${f.delay ? f.delay + " min" : "On schedule"}</b></div>
          </div>
          <div class="fs-map" id="fsMap"></div>
        </div>`;
        curMapApi = drawMap(out.querySelector("#fsMap"), f);
        const fillEl = out.querySelector(".fs-line-fill"), planeEl = out.querySelector(".fs-plane");
        // Advance the plane in real time; CSS transitions make each step slide.
        function tick() {
          const p = progressFrom(f.depTs, f.arrTs);
          const prog = p != null ? p : f.progress || 0;
          if (fillEl) fillEl.style.width = prog + "%";
          if (planeEl) planeEl.style.left = prog + "%";
          if (curMapApi && curMapApi.setPlane) curMapApi.setPlane(prog / 100);
        }
        tick();
        if (f.depTs && f.arrTs) liveTimer = setInterval(tick, 1000);
      };
      go.onclick = run; input.onkeydown = (e) => { if (e.key === "Enter") run(); };
      if (no) run();
    }

    function drawMap(elMap, f) {
      const o = AIRPORT_COORDS[f.origin], d = AIRPORT_COORDS[f.dest];
      const api = { setPlane: null };
      if (!window.maplibregl || !o || !d) { elMap.style.display = "none"; return api; }
      try {
        const map = new maplibregl.Map({
          container: elMap, attributionControl: false, interactive: true,
          style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png", "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
          center: [(o[0] + d[0]) / 2, (o[1] + d[1]) / 2], zoom: 2,
        });
        let planeMarker = null, linePts = null, pendingT = null;
        let curT = null, tgtT = null, raf = null, alive = true;
        function place(t) {
          if (!alive || !linePts) return;
          if (t <= 0 || t >= 1) { if (planeMarker) { planeMarker.remove(); planeMarker = null; } return; }
          const idx = Math.max(0, Math.min(linePts.length - 1, Math.round(t * (linePts.length - 1))));
          const pp = linePts[idx], nb = linePts[Math.min(linePts.length - 1, idx + 1)];
          try {
            if (!planeMarker) { const pe = document.createElement("div"); pe.className = "fs-map-plane"; pe.innerHTML = "<i>✈</i>"; planeMarker = new maplibregl.Marker({ element: pe }).setLngLat(pp).addTo(map); }
            else planeMarker.setLngLat(pp);
            planeMarker.getElement().querySelector("i").style.transform = "rotate(" + (bearing(pp, nb) - 45) + "deg)";
          } catch (_) { alive = false; }
        }
        function animate() {
          if (!alive) { raf = null; return; }
          if (curT == null) curT = tgtT;
          const diff = tgtT - curT;
          if (Math.abs(diff) < 0.0004) { curT = tgtT; place(curT); raf = null; return; }
          curT += diff * 0.12; place(curT);
          raf = requestAnimationFrame(animate);
        }
        api.setPlane = (t) => {
          if (!linePts) { pendingT = t; return; }
          tgtT = t;
          if (curT == null) { curT = t; place(t); return; }   // first placement: no slide from 0
          if (!raf) raf = requestAnimationFrame(animate);
        };
        api.destroy = () => { alive = false; if (raf) cancelAnimationFrame(raf); try { map.remove(); } catch (_) {} };
        map.on("load", () => {
          linePts = greatCircle(o, d, 96);
          map.addSource("route", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: linePts } } });
          map.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#38bdf8", "line-width": 2.5, "line-dasharray": [2, 1.6] } });
          new maplibregl.Marker({ color: "#22c55e" }).setLngLat(o).addTo(map);
          new maplibregl.Marker({ color: "#ef4444" }).setLngLat(d).addTo(map);
          const bounds = new maplibregl.LngLatBounds(o, o); bounds.extend(d);
          map.fitBounds(bounds, { padding: 46, maxZoom: 6, duration: 0 });
          if (pendingT != null) api.setPlane(pendingT);
        });
      } catch (_) { elMap.style.display = "none"; }
      return api;
    }

    function renderBoard(code) {
      main.innerHTML = `<div class="fs-board">
        <h1>Departures</h1>
        <div class="fs-search"><input class="fs-in" placeholder="Airport code (e.g. JFK)" value="${code ? esc(code) : "JFK"}"><button class="fs-go">Show board</button></div>
        <div class="fs-result"></div>
      </div>`;
      const input = main.querySelector(".fs-in"), go = main.querySelector(".fs-go"), out = main.querySelector(".fs-result");
      const run = async () => {
        const v = input.value.trim() || "JFK";
        out.innerHTML = `<div class="fs-loading">Loading ${esc(v.toUpperCase())} board…</div>`;
        const b = await fetchDepartures(v);
        out.innerHTML = `<div class="fs-board-h">${esc(b.airport)} — ${esc(b.name)}</div>
          <table class="fs-table"><thead><tr><th>Time</th><th>Flight</th><th>Destination</th><th>Gate</th><th>Status</th></tr></thead>
          <tbody>${b.rows.map((r) => `<tr><td>${esc(r.time)}</td><td class="fs-flcell">${airlineLogo(r.carrier, "fs-row-logo")}<span><b>${esc(r.flight)}</b><span class="fs-al2">${esc(r.airline)}</span></span></td><td>${esc(r.destName)} (${esc(r.dest)})</td><td>${esc(r.gate)}</td><td>${badge(r.status)}</td></tr>`).join("")}</tbody></table>`;
      };
      go.onclick = run; input.onkeydown = (e) => { if (e.key === "Enter") run(); };
      run();
    }
    render();
  }

  // ============================ DoorDash ============================
  const DD_RESTOS = [
    { id: "burger", name: "Burger Barn", cuisine: "American · Burgers", rating: 4.7, eta: "20–30 min", fee: 0, c1: "#f59e0b", c2: "#b45309", emoji: "🍔",
      menu: [{ n: "Classic Cheeseburger", p: 9.49, d: "Beef patty, cheddar, lettuce, tomato" }, { n: "Bacon Double", p: 12.99, d: "Two patties, bacon, special sauce" }, { n: "Crispy Fries", p: 3.99, d: "Golden and salted" }, { n: "Chocolate Shake", p: 4.99, d: "Thick and creamy" }] },
    { id: "pizza", name: "Tony's Pizzeria", cuisine: "Italian · Pizza", rating: 4.6, eta: "25–35 min", fee: 1.99, c1: "#ef4444", c2: "#7f1d1d", emoji: "🍕", img: "assets/dd_pizza.jpg",
      featured: [
        { n: "Pepperoni Supreme - Large", p: 23.00, img: "assets/dd_item_supreme.jpg", badge: "#1 most liked", like: "100% (20)" },
        { n: "Classic Pepperoni - Large", p: 19.00, img: "assets/dd_item_pepperoni.jpg", badge: "#2 most liked", like: "95% (24)" },
        { n: "Garlic Breadsticks", p: 7.50, img: "assets/dd_item_sticks.jpg", badge: "#3 most liked", like: "90% (20)" },
        { n: "Buffalo Wings (10)", p: 12.00, img: "assets/dd_item_wings.jpg", like: "100% (12)" },
        { n: "Greek Salad", p: 9.50, img: "assets/dd_item_salad.jpg" },
      ],
      menu: [{ n: "Margherita Pizza", p: 13.99, d: "Fresh mozzarella, basil, tomato" }, { n: "Pepperoni Pizza", p: 15.49, d: "Loaded with pepperoni" }, { n: "Garlic Knots", p: 5.99, d: "Six knots with marinara" }, { n: "Caesar Salad", p: 7.49, d: "Romaine, parmesan, croutons" }] },
    { id: "sushi", name: "Sakura Sushi", cuisine: "Japanese · Sushi", rating: 4.8, eta: "30–40 min", fee: 2.49, c1: "#10b981", c2: "#065f46", emoji: "🍣",
      menu: [{ n: "California Roll", p: 8.99, d: "Crab, avocado, cucumber" }, { n: "Spicy Tuna Roll", p: 10.49, d: "Tuna, spicy mayo, scallion" }, { n: "Salmon Nigiri (2pc)", p: 6.99, d: "Fresh salmon over rice" }, { n: "Miso Soup", p: 3.49, d: "Tofu, seaweed, scallion" }] },
    { id: "taco", name: "El Taco Loco", cuisine: "Mexican · Tacos", rating: 4.5, eta: "15–25 min", fee: 0, c1: "#84cc16", c2: "#3f6212", emoji: "🌮",
      menu: [{ n: "Street Tacos (3)", p: 9.99, d: "Carne asada, onion, cilantro" }, { n: "Burrito Supreme", p: 11.49, d: "Rice, beans, cheese, guac" }, { n: "Chips & Guac", p: 5.49, d: "Fresh guacamole" }, { n: "Horchata", p: 3.29, d: "Sweet cinnamon rice drink" }] },
    { id: "cafe", name: "Bloom Café", cuisine: "Coffee · Breakfast", rating: 4.9, eta: "10–20 min", fee: 1.49, c1: "#a855f7", c2: "#581c87", emoji: "☕",
      menu: [{ n: "Iced Caramel Latte", p: 5.49, d: "Espresso, milk, caramel" }, { n: "Avocado Toast", p: 8.99, d: "Sourdough, avocado, chili flakes" }, { n: "Blueberry Muffin", p: 3.99, d: "Baked fresh daily" }, { n: "Breakfast Burrito", p: 9.49, d: "Egg, cheese, potato, salsa" }] },
    { id: "wings", name: "Wing Kingdom", cuisine: "American · Wings", rating: 4.4, eta: "25–35 min", fee: 0.99, c1: "#f97316", c2: "#7c2d12", emoji: "🍗",
      menu: [{ n: "10 Buffalo Wings", p: 12.99, d: "Classic buffalo, ranch dip" }, { n: "BBQ Wings (10)", p: 12.99, d: "Sweet & smoky" }, { n: "Loaded Fries", p: 7.49, d: "Cheese, bacon, jalapeño" }, { n: "Mozzarella Sticks", p: 6.49, d: "Six with marinara" }] },
  ];
  function ddStore() { if (!S().appData) S().appData = {}; if (!S().appData.doordash) S().appData.doordash = { cart: [], orders: [] }; const d = S().appData.doordash; if (!d.cart) d.cart = []; if (!d.orders) d.orders = []; return d; }
  function ddAddrs() {
    const d = ddStore();
    if (!d.addresses || !d.addresses.length) { d.addresses = [{ id: "a1", line: "123 Main St", sub: "Thousand Oaks, CA, USA", label: "Home" }]; d.addrSel = "a1"; }
    if (!d.addrSel) d.addrSel = d.addresses[0].id;
    return d;
  }
  function ddCurAddr() { const d = ddAddrs(); return d.addresses.find((a) => a.id === d.addrSel) || d.addresses[0]; }
  function ddCartTotal() { return ddStore().cart.reduce((s, it) => s + it.p * it.qty, 0); }
  function ddCartCount() { return ddStore().cart.reduce((s, it) => s + it.qty, 0); }

  function doordash(ctx) {
    const esc = escapeHtml, page = ctx.page;
    let view = "list", resto = null, query = "", mode = "Delivery";
    function money(n) { return "$" + n.toFixed(2); }

    // Branded loading screen shown while the app "boots".
    // DashPass members get the animated DashPass logo + purple spinner.
    function boot() {
      const dp = !!ddStore().dashpass;
      page.innerHTML = `<div class="dd-load">
        ${dp ? `<img class="dd-load-dp" src="assets/dashpass.gif?v=1" alt="DashPass">` : `<img class="dd-load-logo" src="assets/doordash.png?v=1" alt="DoorDash">`}
        <div class="dd-spinner"${dp ? ` style="--dd-red:#6331DF"` : ""} role="status" aria-label="Loading">
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
      </div>`;
      setTimeout(render, dp ? 1500 : 1050);
    }

    const SIDE_NAV = [
      ["home", "🏠", "Home"], ["grocery", "🍌", "Grocery"], ["retail", "🛍️", "Retail"], ["deals", "🏷️", "Deals"],
      ["reservations", "📅", "Reservations"], ["alcohol", "🍸", "Alcohol"], ["convenience", "🥤", "Convenience"],
      ["apparel", "👕", "Apparel"], ["beauty", "💄", "Beauty"], ["flowers", "🌷", "Flowers"],
      ["pets", "🐾", "Pets"], ["party", "🎈", "Party"], ["gifts", "🎁", "Gifts"],
    ];
    const SIDE_FOOT = [["orders", "🧾", "Orders"], ["account", "👤", "Account"], ["switch", "⇄", "Switch Account"]];
    let sideNav = "home";

    function render() {
      page.innerHTML = `<div class="dd">
        <aside class="dd-sidebar">
          <img class="dd-logo" src="assets/doordash_wordmark.png?v=1" alt="DoorDash">
          <nav class="dd-nav">${SIDE_NAV.map((n) => `<button class="dd-nav-it ${sideNav === n[0] ? "on" : ""}" data-n="${n[0]}"><span>${n[1]}</span>${n[2]}</button>`).join("")}</nav>
          <div class="dd-nav-div"></div>
          <nav class="dd-nav">${SIDE_FOOT.map((n) => `<button class="dd-nav-it ${sideNav === n[0] ? "on" : ""}" data-n="${n[0]}"><span>${n[1]}</span>${n[2]}</button>`).join("")}</nav>
        </aside>
        <div class="dd-right">
        <div class="dd-top">
          <div class="dd-search"><span class="dd-search-ic">🔍</span><input class="dd-search-in" placeholder="Search &quot;7-Eleven&quot;" value="${esc(query)}"></div>
          <button class="dd-addr-pill">📍 <b>${esc(ddCurAddr().line)}</b></button>
          <div class="dd-toggle"><button data-m="Delivery" class="${mode === "Delivery" ? "on" : ""}">Delivery</button><button data-m="Pickup" class="${mode === "Pickup" ? "on" : ""}">Pickup</button></div>
          <button class="dd-bell" title="Notifications">🔔<span class="dd-bell-dot"></span></button>
          <button class="dd-cart-btn">🛒 <span class="dd-cart-n">${ddCartCount()}</span></button>
          <button class="dd-signin"></button>
        </div>
        <div class="dd-body"></div>
        </div>
      </div>`;
      page.querySelectorAll(".dd-nav-it").forEach((b) => b.onclick = () => {
        const n = b.dataset.n;
        if (n === "switch") { if (window.FE) { FE.logout(); } signBtn.click(); return; }
        sideNav = n; query = "";
        view = n === "home" ? "list" : n === "orders" ? "orders" : n === "account" ? "account" : n === "deals" ? "deals" : n === "retail" ? "retail" : "cat";
        render();
      });
      const signBtn = page.querySelector(".dd-signin");
      function paintSign() {
        const u = window.FE && FE.user();
        signBtn.textContent = u ? (u.name || u.email || "Account") : "Sign in";
        signBtn.classList.toggle("dd-signed", !!u);
        signBtn.title = u ? "Sign out" : "Sign in with your account";
      }
      paintSign();
      signBtn.onclick = async () => {
        const u = window.FE && FE.user();
        if (u) { FE.logout(); paintSign(); render(); return; }
        if (!window.FE || !FE.configured()) { if (window.Notify) Notify.show({ icon: Icon.mini("doordash", "DoorDash"), title: "DoorDash", body: "Sign-in isn't configured yet (waiting on the Frontegg client ID)." }); return; }
        try { await FE.login(); render(); }
        catch (e) { if (window.Notify) Notify.show({ icon: Icon.mini("doordash", "DoorDash"), title: "Sign in", body: e.message || "Sign-in failed." }); }
      };
      page.querySelector(".dd-cart-btn").onclick = () => { view = "cart"; paint(); };
      page.querySelector(".dd-logo").onclick = () => { query = ""; view = "list"; render(); };
      const search = page.querySelector(".dd-search-in");
      search.oninput = () => { query = search.value; view = "list"; paint(); };
      page.querySelectorAll(".dd-toggle button").forEach((b) => b.onclick = () => { mode = b.dataset.m; page.querySelectorAll(".dd-toggle button").forEach((x) => x.classList.toggle("on", x === b)); });
      page.querySelector(".dd-bell").onclick = () => { if (window.Notify) Notify.show({ icon: Icon.mini("doordash", "DoorDash"), title: "DoorDash", body: "No new notifications." }); };
      page.querySelector(".dd-addr-pill").onclick = addrModal;
      paint();
    }

    // Addresses settings modal (reference: real DoorDash Addresses sheet).
    function addrModal() {
      const host = page.querySelector(".dd");
      const ov = el(`<div class="dd-addr-ov"><div class="dd-addr-modal">
        <button class="dd-addr-x" aria-label="Close">&times;</button>
        <h2>Addresses</h2>
        <div class="dd-addr-search">🔍 <input class="dd-addr-in" placeholder="Enter Your Address"></div>
        <button class="dd-addr-label-btn">+ Add label</button>
        <input class="dd-addr-label-in" placeholder="Label (e.g. Home, Work)" style="display:none">
        <div class="dd-addr-list"></div>
      </div></div>`);
      const input = ov.querySelector(".dd-addr-in"), labelBtn = ov.querySelector(".dd-addr-label-btn"), labelIn = ov.querySelector(".dd-addr-label-in");
      const listEl = ov.querySelector(".dd-addr-list");
      function refreshPill() { const b = page.querySelector(".dd-addr-pill b"); if (b) b.textContent = ddCurAddr().line; }
      function drawList() {
        const d = ddAddrs();
        listEl.innerHTML = "";
        d.addresses.forEach((a) => {
          const row = el(`<div class="dd-addr-row">
            <span class="dd-radio ${a.id === d.addrSel ? "on" : ""}"></span>
            <div class="dd-addr-txt"><b>${esc(a.line)}${a.label ? ` <i class="dd-addr-chip">${esc(a.label)}</i>` : ""}</b>${a.sub ? `<span>${esc(a.sub)}</span>` : ""}</div>
            <button class="dd-addr-edit" title="Edit">✏️</button>
          </div>`);
          row.onclick = (e) => { if (e.target.closest(".dd-addr-edit")) return; d.addrSel = a.id; State.save(); drawList(); refreshPill(); };
          row.querySelector(".dd-addr-edit").onclick = () => {
            const txt = row.querySelector(".dd-addr-txt");
            txt.innerHTML = "";
            const ed = document.createElement("input"); ed.className = "dd-addr-editin"; ed.value = a.line + (a.sub ? ", " + a.sub : "");
            txt.appendChild(ed); ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length);
            ed.onkeydown = (ev) => {
              if (ev.key === "Enter") { const v = ed.value.trim(); if (v) { const ix = v.indexOf(","); a.line = ix > 0 ? v.slice(0, ix).trim() : v; a.sub = ix > 0 ? v.slice(ix + 1).trim() : a.sub; State.save(); } drawList(); refreshPill(); }
              if (ev.key === "Escape") drawList();
            };
          };
          listEl.appendChild(row);
        });
      }
      labelBtn.onclick = () => { labelIn.style.display = labelIn.style.display === "none" ? "block" : "none"; if (labelIn.style.display === "block") labelIn.focus(); };
      input.onkeydown = (e) => {
        if (e.key !== "Enter") return;
        const v = input.value.trim(); if (!v) return;
        const d = ddAddrs(), ix = v.indexOf(",");
        const a = { id: "a" + (d.addresses.length + 1) + "_" + v.length, line: ix > 0 ? v.slice(0, ix).trim() : v, sub: ix > 0 ? v.slice(ix + 1).trim() : "", label: labelIn.value.trim() || "" };
        d.addresses.unshift(a); d.addrSel = a.id; State.save();
        input.value = ""; labelIn.value = ""; labelIn.style.display = "none";
        drawList(); refreshPill();
      };
      const close = () => ov.remove();
      ov.querySelector(".dd-addr-x").onclick = close;
      ov.onclick = (e) => { if (e.target === ov) close(); };
      drawList();
      host.appendChild(ov);
    }
    function paint() {
      const bodyEl = page.querySelector(".dd-body");
      if (view === "list") return listView(bodyEl);
      if (view === "resto") return restoView(bodyEl);
      if (view === "cart") return cartView(bodyEl);
      if (view === "track") return trackView(bodyEl);
      if (view === "orders") return ordersView(bodyEl);
      if (view === "account") return accountView(bodyEl);
      if (view === "deals") return dealsView(bodyEl);
      if (view === "retail") return retailView(bodyEl);
      if (view === "cat") return catView(bodyEl);
    }
    const DD_STORES = [
      { n: "CVS", domain: "cvs.com", min: 15, c: "#cc0000", t: "CVS", rating: 4.6, dashpass: true, hsa: true, price: 2, tag: `<span class="dd-store-deal">35% off $25+, up to $10</span> with <b class="dd-dp-word">DashPass</b>` },
      { n: "Carter's", domain: "carters.com", min: 44, c: "#29abe2", t: "carter's", rating: 4.4, dashpass: true, hsa: false, price: 2, note: "Accepts orders until 7:00 PM", tag: `<span class="dd-store-chip">Farther away</span>` },
      { n: "Dollar Tree", domain: "dollartree.com", min: 20, c: "#2e7d32", t: "DT", rating: 4.3, dashpass: true, hsa: false, price: 1, tag: `<span class="dd-store-chip">SNAP</span>` },
      { n: "Target", domain: "target.com", min: 30, c: "#cc0000", t: "T", rating: 4.8, dashpass: true, hsa: false, price: 2 },
      { n: "Walgreens", domain: "walgreens.com", min: 25, c: "#e31837", t: "W", rating: 4.5, dashpass: true, hsa: true, price: 2, tag: `<span class="dd-store-chip">SNAP</span>` },
      { n: "Ralphs", domain: "ralphs.com", min: 15, c: "#d81e2c", t: "R", rating: 4.7, dashpass: true, hsa: false, price: 2, tag: `<span class="dd-store-chip">SNAP</span>` },
      { n: "The Home Depot", domain: "homedepot.com", min: 34, c: "#f96302", t: "HD", rating: 4.6, dashpass: false, hsa: false, price: 3 },
      { n: "Best Buy", domain: "bestbuy.com", min: 16, c: "#0a4abf", t: "BB", rating: 4.9, dashpass: true, hsa: false, price: 3 },
      { n: "Five Below", domain: "fivebelow.com", min: 23, c: "#0053a0", t: "f5", rating: 4.2, dashpass: true, hsa: false, price: 1 },
      { n: "Ace Hardware", domain: "acehardware.com", min: 21, c: "#d40029", t: "ACE", rating: 4.7, dashpass: false, hsa: false, price: 2 },
    ];
    // Real brand logo via Brandfetch Logo Link when a public client id is set.
    function brandLogo(domain) { return (window.Icon && Icon.brandLogoUrl) ? Icon.brandLogoUrl(domain, 128) : null; }
    const ddFilters = { dash: false, hsa: false, rating: 0, under30: false, price: 0 };
    function retailView(el2) {
      el2.innerHTML = `<h2 class="dd-retail-h">Retail</h2>
        <div class="dd-pills">
          <button class="dd-pill ${ddFilters.dash ? "on" : ""}" data-f="dash"><b class="dd-dp-word">Ⓓ</b> DashPass</button>
          <button class="dd-pill ${ddFilters.hsa ? "on" : ""}" data-f="hsa">💳 HSA/FSA</button>
          <button class="dd-pill ${ddFilters.rating ? "on" : ""}" data-f="rating">${ddFilters.rating ? "Over " + ddFilters.rating.toFixed(1) + " ★" : "Over 4.5 ★"} ▾</button>
          <button class="dd-pill ${ddFilters.under30 ? "on" : ""}" data-f="under30">Under 30 min</button>
          <button class="dd-pill ${ddFilters.price ? "on" : ""}" data-f="price">${ddFilters.price ? "$".repeat(ddFilters.price) : "Price"} ▾</button>
        </div>
        <div class="dd-promo">
          <div class="dd-promo-l">
            <h3>Coming soon: $40 off Sephora</h3>
            <p>Save on a $100+ order with DashPass on 7/22 only, at 9am EDT.</p>
            <button class="dd-promo-btn">Learn more</button>
          </div>
          <div class="dd-promo-r"><span class="dd-promo-tag">Ⓓ SUMMER of DASHPASS</span><span class="dd-promo-drop">DEAL<br>DROP<br>7/22</span><span class="dd-promo-sephora">SEPHORA</span></div>
        </div>
        <h3 class="dd-stores-h">Top Stores</h3>
        <div class="dd-stores"></div>
        <div class="dd-seeall"><div><b>See All Stores Nearby</b><p>Lowe's, Dick's Sporting Goods, Michaels, Grocery Outlet, Sprouts Farmers Market, Smart &amp; Final, Vons, Pet Food…</p></div><span>›</span></div>
        <div class="dd-swim">
          <img src="assets/dd_swim.jpg?v=1" alt="">
          <div class="dd-swim-txt"><h3>Swimwear for the fam</h3><p>Delivered to your door in minutes</p><button class="dd-promo-btn dark">Order now</button></div>
        </div>`;
      const wrap = el2.querySelector(".dd-stores");
      function drawStores() {
        const f = ddFilters;
        const list = DD_STORES.filter((s) =>
          (!f.dash || s.dashpass) && (!f.hsa || s.hsa) && (!f.rating || s.rating >= f.rating) &&
          (!f.under30 || s.min < 30) && (!f.price || s.price <= f.price));
        wrap.innerHTML = "";
        if (!list.length) { wrap.innerHTML = `<div class="dd-empty" style="grid-column:1/-1">No stores match those filters.</div>`; return; }
        list.forEach((s) => {
          const row = el(`<div class="dd-store">
            <span class="dd-store-logo" style="color:${s.c}">${brandLogo(s.domain) ? `<img src="${brandLogo(s.domain)}" alt="" onerror="this.remove()">` : ""}<i>${esc(s.t)}</i></span>
            <div class="dd-store-b">
              ${s.note ? `<div class="dd-store-note">${esc(s.note)}</div>` : ""}
              <div class="dd-store-n">${s.dashpass ? `<b class="dd-dp-word">Ⓓ</b> ` : ""}${esc(s.n)}</div>
              <div class="dd-store-min">⭐ ${s.rating.toFixed(1)} · ${s.min} min · ${"$".repeat(s.price)}</div>
              ${s.tag ? `<div class="dd-store-tags">${s.tag}</div>` : ""}
            </div>
            <button class="dd-store-fav">♡</button>
          </div>`);
          row.onclick = (e) => { if (e.target.closest(".dd-store-fav")) { e.target.textContent = e.target.textContent === "♡" ? "❤️" : "♡"; return; } if (window.Notify) Notify.show({ icon: Icon.mini("doordash", "DoorDash"), title: s.n, body: "This store doesn't deliver to the simulation yet." }); };
          wrap.appendChild(row);
        });
      }
      drawStores();
      // pill behaviour: toggles flip; chevron pills open a small dropdown
      function dropdown(anchor, options, onPick) {
        el2.querySelectorAll(".dd-drop").forEach((d) => d.remove());
        const menu = el(`<div class="dd-drop">${options.map((o, i) => `<button data-i="${i}">${o.label}</button>`).join("")}</div>`);
        anchor.parentElement.style.position = "relative";
        const r = anchor.getBoundingClientRect(), pr = anchor.parentElement.getBoundingClientRect();
        menu.style.left = (r.left - pr.left) + "px";
        menu.querySelectorAll("button").forEach((b) => b.onclick = (e) => { e.stopPropagation(); onPick(options[+b.dataset.i]); menu.remove(); });
        anchor.parentElement.appendChild(menu);
        setTimeout(() => document.addEventListener("click", function h() { menu.remove(); document.removeEventListener("click", h); }, { once: false }), 0);
      }
      function repaint() { retailView(el2); }
      el2.querySelectorAll(".dd-pill").forEach((pill) => pill.onclick = (e) => {
        e.stopPropagation();
        const f = pill.dataset.f;
        if (f === "dash") { ddFilters.dash = !ddFilters.dash; repaint(); }
        else if (f === "hsa") { ddFilters.hsa = !ddFilters.hsa; repaint(); }
        else if (f === "under30") { ddFilters.under30 = !ddFilters.under30; repaint(); }
        else if (f === "rating") dropdown(pill, [
          { label: "Any rating", v: 0 }, { label: "Over 4.0 ★", v: 4.0 }, { label: "Over 4.5 ★", v: 4.5 }, { label: "Over 4.8 ★", v: 4.8 },
        ], (o) => { ddFilters.rating = o.v; repaint(); });
        else if (f === "price") dropdown(pill, [
          { label: "Any price", v: 0 }, { label: "$", v: 1 }, { label: "$$", v: 2 }, { label: "$$$", v: 3 },
        ], (o) => { ddFilters.price = o.v; repaint(); });
      });
      el2.querySelector(".dd-promo-btn").onclick = () => { if (window.Notify) Notify.show({ icon: Icon.mini("doordash", "DoorDash"), title: "DashPass", body: "Deal drops 7/22 at 9am EDT. Set a reminder!" }); };
    }
    function ordersView(el2) {
      const orders = ddStore().orders;
      if (!orders.length) { el2.innerHTML = `<h2 class="dd-cart-h">Orders</h2><div class="dd-empty">🧾 No orders yet.<br><span>Your past orders will show up here.</span></div>`; return; }
      el2.innerHTML = `<h2 class="dd-cart-h">Orders</h2><div class="dd-orders">${orders.map((o) => `
        <div class="dd-order"><div class="dd-order-top"><b>${esc(o.items[0] ? o.items[0].resto : "Order")}</b><span>${money(o.total)}</span></div>
        <div class="dd-order-items">${o.items.map((it) => esc(it.qty + "× " + it.n)).join(" · ")}</div>
        <span class="dd-order-badge">Delivered</span></div>`).join("")}</div>`;
    }
    function accountView(el2) {
      const u = window.FE && FE.user();
      el2.innerHTML = `<h2 class="dd-cart-h">Account</h2>` + (u
        ? `<div class="dd-acct"><div class="dd-acct-av">${esc((u.name || u.email || "?")[0].toUpperCase())}</div>
           <div><div class="dd-acct-n">${esc(u.name || "DoorDash user")}</div><div class="dd-acct-e">${esc(u.email || "")}</div></div></div>
           <button class="dd-checkout" style="max-width:240px" id="ddOut">Sign out</button>`
        : `<div class="dd-empty">👤 You're not signed in.<br><span>Sign in to sync your account.</span></div>
           <button class="dd-checkout" style="max-width:240px;margin:0 auto" id="ddIn">Sign in</button>`);
      const outB = el2.querySelector("#ddOut"), inB = el2.querySelector("#ddIn");
      if (outB) outB.onclick = () => { FE.logout(); render(); };
      if (inB) inB.onclick = () => page.querySelector(".dd-signin").click();
    }
    function dealsView(el2) {
      const deals = DD_RESTOS.filter((r) => r.fee === 0);
      el2.innerHTML = `<h2 class="dd-cart-h">🏷️ Deals — free delivery</h2><div class="dd-grid"></div>`;
      const grid = el2.querySelector(".dd-grid");
      deals.forEach((r) => {
        const card = el(`<div class="dd-card"><div class="dd-card-img" style="background:linear-gradient(135deg,${r.c1},${r.c2})">${r.img ? `<img class="dd-card-photo" src="${r.img}?v=1" alt="">` : `<span>${r.emoji}</span>`}<span class="dd-free">Free delivery</span></div>
          <div class="dd-card-b"><div class="dd-card-name">${esc(r.name)}</div><div class="dd-card-meta">⭐ ${r.rating} · ${esc(r.eta)}</div></div></div>`);
        card.onclick = () => { resto = r; view = "resto"; paint(); };
        grid.appendChild(card);
      });
    }
    function catView(el2) {
      const item = SIDE_NAV.find((n) => n[0] === sideNav) || ["", "🛒", "This category"];
      el2.innerHTML = `<h2 class="dd-cart-h">${item[1]} ${esc(item[2])}</h2>
        <div class="dd-empty">${item[1]} No ${esc(item[2].toLowerCase())} stores near you yet.<br><span>Check back soon — new stores are added all the time.</span></div>`;
    }
    function listView(el2) {
      const q = query.trim().toLowerCase();
      const list = q ? DD_RESTOS.filter((r) => (r.name + " " + r.cuisine + " " + r.menu.map((m) => m.n).join(" ")).toLowerCase().includes(q)) : DD_RESTOS;
      const feUser = window.FE && FE.user();
      const uname = (feUser && (feUser.name || feUser.email)) || (S().profile && S().profile.username) || (S().account && S().account.name) || "there";
      const CATS = [["🥗", "Healthy"], ["🥪", "Sandwiches"], ["🏷️", "Deals"], ["🍣", "Sushi"], ["🍟", "Fast Food"], ["🍕", "Pizza"], ["🌮", "Mexican"], ["🍔", "Burgers"], ["🍳", "Breakfast"], ["☕", "Coffee"]];
      const dp = !!ddStore().dashpass;
      el2.innerHTML = `<div class="dd-hero"><h1>${q ? "Results for “" + esc(query) + "”" : "Welcome back, " + esc(uname)}</h1><p>${list.length} restaurant${list.length === 1 ? "" : "s"} near you</p></div>
        <div class="dd-cats">${CATS.map((c) => `<button class="dd-cat" data-q="${esc(c[1])}">${c[0]} ${c[1]}</button>`).join("")}</div>
        <div class="dd-grid"></div>
        <div class="dd-dp-banner ${dp ? "member" : ""}">
          <div class="dd-dp-txt"><b>DashPass</b><span>${dp ? "You're a member — $0 delivery fees on every order." : "$0 delivery fees and reduced service fees on eligible orders."}</span></div>
          <button class="dd-dp-btn">${dp ? "✓ Member" : "Get DashPass · $9.99/mo"}</button>
        </div>`;
      const dpBtn = el2.querySelector(".dd-dp-btn");
      dpBtn.onclick = () => {
        if (ddStore().dashpass) { if (window.Notify) Notify.show({ icon: Icon.mini("doordash", "DoorDash"), title: "DashPass", body: "You're already a member. Enjoy!" }); return; }
        const bank = S().bank;
        if (bank && typeof bank.balance === "number") {
          if (bank.balance < 9.99) { if (window.Notify) Notify.show({ icon: "", title: "DashPass", body: "Not enough balance in Forge Bank." }); return; }
          bank.balance -= 9.99;
          if (bank.transactions) bank.transactions.unshift({ label: "DashPass subscription", amount: -9.99, ts: 0 });
        }
        ddStore().dashpass = true; State.save();
        if (window.Notify) Notify.show({ icon: Icon.mini("doordash", "DoorDash"), title: "DashPass", body: "Welcome to DashPass! $0 delivery fees from now on." });
        paint();
      };
      el2.querySelectorAll(".dd-cat").forEach((b) => b.onclick = () => { query = b.dataset.q; const s = page.querySelector(".dd-search-in"); if (s) s.value = query; paint(); });
      const grid = el2.querySelector(".dd-grid");
      if (!list.length) { grid.innerHTML = `<div class="dd-empty" style="grid-column:1/-1">No restaurants match your search.</div>`; return; }
      list.forEach((r) => {
        const card = el(`<div class="dd-card">
          <div class="dd-card-img" style="background:linear-gradient(135deg,${r.c1},${r.c2})">${r.img ? `<img class="dd-card-photo" src="${r.img}?v=1" alt="">` : `<span>${r.emoji}</span>`}${r.fee === 0 ? '<span class="dd-free">Free delivery</span>' : ""}</div>
          <div class="dd-card-b"><div class="dd-card-name">${esc(r.name)}</div><div class="dd-card-meta">⭐ ${r.rating} · ${esc(r.eta)} · ${r.fee === 0 ? "Free" : money(r.fee) + " fee"}</div><div class="dd-card-cui">${esc(r.cuisine)}</div></div>
        </div>`);
        card.onclick = () => { resto = r; view = "resto"; paint(); };
        grid.appendChild(card);
      });
    }
    function restoView(el2) {
      const r = resto;
      el2.innerHTML = `<button class="dd-back">‹ All restaurants</button>
        <div class="dd-rhero" style="background:linear-gradient(135deg,${r.c1},${r.c2})">${r.img ? `<img class="dd-rhero-photo" src="${r.img}?v=1" alt="">` : `<span>${r.emoji}</span>`}</div>
        <div class="dd-rhead"><h2>${esc(r.name)}</h2><div class="dd-card-meta">⭐ ${r.rating} · ${esc(r.eta)} · ${r.fee === 0 ? "Free delivery" : money(r.fee) + " delivery"}</div><div class="dd-card-cui">${esc(r.cuisine)}</div></div>
        ${r.featured ? `<h3 class="dd-menu-h">Featured items</h3><div class="dd-feat"></div>` : ""}
        <h3 class="dd-menu-h">Menu</h3><div class="dd-menu"></div>`;
      el2.querySelector(".dd-back").onclick = () => { view = "list"; paint(); };
      if (r.featured) {
        const feat = el2.querySelector(".dd-feat");
        r.featured.forEach((m) => {
          const card = el(`<div class="dd-feat-card">
            <div class="dd-feat-img"><img src="${m.img}?v=1" alt="">${m.badge ? `<span class="dd-feat-badge">${esc(m.badge)}</span>` : ""}<button class="dd-feat-add">+</button></div>
            <div class="dd-feat-n">${esc(m.n)}</div>
            <div class="dd-feat-meta">${money(m.p)}${m.like ? ` · 👍 ${esc(m.like)}` : ""}</div>
          </div>`);
          card.querySelector(".dd-feat-add").onclick = () => {
            const cart = ddStore().cart, ex = cart.find((c) => c.id === r.id + ":" + m.n);
            if (ex) ex.qty++; else cart.push({ id: r.id + ":" + m.n, n: m.n, p: m.p, qty: 1, resto: r.name });
            State.save(); render();
            if (window.Notify) Notify.show({ icon: Icon.mini("doordash", "DoorDash"), title: "Added to cart", body: m.n });
          };
          feat.appendChild(card);
        });
      }
      const menu = el2.querySelector(".dd-menu");
      r.menu.forEach((m) => {
        const row = el(`<div class="dd-item"><div class="dd-item-b"><div class="dd-item-n">${esc(m.n)}</div><div class="dd-item-d">${esc(m.d)}</div><div class="dd-item-p">${money(m.p)}</div></div><button class="dd-add">+ Add</button></div>`);
        row.querySelector(".dd-add").onclick = () => {
          const cart = ddStore().cart, ex = cart.find((c) => c.id === r.id + ":" + m.n);
          if (ex) ex.qty++; else cart.push({ id: r.id + ":" + m.n, n: m.n, p: m.p, qty: 1, resto: r.name });
          State.save(); render();
          if (window.Notify) Notify.show({ icon: Icon.mini("doordash", "DoorDash"), title: "Added to cart", body: m.n });
        };
        menu.appendChild(row);
      });
    }
    function cartView(el2) {
      const cart = ddStore().cart;
      if (!cart.length) { el2.innerHTML = `<button class="dd-back">‹ Back</button><div class="dd-empty">🛒 Your cart is empty.<br><span>Add items from a restaurant to get started.</span></div>`; el2.querySelector(".dd-back").onclick = () => { view = "list"; paint(); }; return; }
      const sub = ddCartTotal(), fee = ddStore().dashpass ? 0 : 1.99, tax = sub * 0.08, total = sub + fee + tax;
      el2.innerHTML = `<button class="dd-back">‹ Back</button><h2 class="dd-cart-h">Your order</h2>
        <div class="dd-cart-list"></div>
        <div class="dd-summary">
          <div class="dd-sum-row"><span>Subtotal</span><span>${money(sub)}</span></div>
          <div class="dd-sum-row"><span>Delivery fee${ddStore().dashpass ? ` <b class="dd-dp-tag">DashPass</b>` : ""}</span><span>${money(fee)}</span></div>
          <div class="dd-sum-row"><span>Taxes & fees</span><span>${money(tax)}</span></div>
          <div class="dd-sum-row dd-sum-total"><span>Total</span><span>${money(total)}</span></div>
        </div>
        <button class="dd-checkout">Place order · ${money(total)}</button>`;
      el2.querySelector(".dd-back").onclick = () => { view = "list"; paint(); };
      const list = el2.querySelector(".dd-cart-list");
      cart.forEach((it) => {
        const row = el(`<div class="dd-crow"><span class="dd-crow-n">${esc(it.n)}<small>${esc(it.resto)}</small></span><div class="dd-qty"><button class="dd-minus">−</button><span>${it.qty}</span><button class="dd-plus">+</button></div><span class="dd-crow-p">${money(it.p * it.qty)}</span></div>`);
        row.querySelector(".dd-plus").onclick = () => { it.qty++; State.save(); render(); view = "cart"; paint(); };
        row.querySelector(".dd-minus").onclick = () => { it.qty--; if (it.qty <= 0) ddStore().cart = ddStore().cart.filter((x) => x !== it); State.save(); render(); view = "cart"; paint(); };
        list.appendChild(row);
      });
      el2.querySelector(".dd-checkout").onclick = () => {
        const bank = S().bank; if (bank && typeof bank.balance === "number") { if (bank.balance < total) { if (window.Notify) Notify.show({ icon: "", title: "DoorDash", body: "Not enough balance in Forge Bank." }); return; } bank.balance -= total; if (bank.transactions) bank.transactions.unshift({ label: "DoorDash order", amount: -total, ts: Date.now ? Date.now() : 0 }); }
        ddStore().orders.unshift({ items: ddStore().cart.slice(), total, ts: 0 }); ddStore().cart = []; State.save();
        view = "track"; paint();
      };
    }
    function trackView(el2) {
      el2.innerHTML = `<div class="dd-track">
        <div class="dd-track-emoji">🛵</div>
        <h2>Order placed!</h2>
        <p>Your food is on the way.</p>
        <div class="dd-track-bar"><div class="dd-track-fill"></div></div>
        <div class="dd-track-steps"><span class="on">Confirmed</span><span class="s2">Preparing</span><span class="s3">On the way</span><span class="s4">Delivered</span></div>
        <div class="dd-eta">Estimated arrival: <b>25 min</b></div>
        <button class="dd-checkout" style="max-width:240px;margin:20px auto 0">Back to restaurants</button>
      </div>`;
      el2.querySelector(".dd-checkout").onclick = () => { view = "list"; paint(); };
      const fill = el2.querySelector(".dd-track-fill"); let p = 8;
      const steps = ["s2", "s3", "s4"]; let si = 0;
      const iv = setInterval(() => {
        if (!document.body.contains(el2)) { clearInterval(iv); return; }
        p = Math.min(100, p + 6); fill.style.width = p + "%";
        if (p > 30 && si === 0) { el2.querySelector(".s2").classList.add("on"); si = 1; }
        if (p > 62 && si === 1) { el2.querySelector(".s3").classList.add("on"); si = 2; }
        if (p >= 100) { const s4 = el2.querySelector(".s4"); if (s4) s4.classList.add("on"); clearInterval(iv); }
      }, 900);
    }
    boot();
  }

  window.Sites = { bank, amazon, microsoft, youtube, discord, duolingo, netflix, flightstats: flightStats, doordash };
})();
