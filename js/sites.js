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

  window.Sites = { bank, amazon, microsoft, youtube, discord, duolingo, netflix };
})();
