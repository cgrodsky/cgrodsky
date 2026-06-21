/* The five custom sites rendered inside the browser. ctx = {page, navigate, win}. */
(function () {
  "use strict";

  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
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
        <h3>Transactions</h3>
        <div class="tx-list"></div>
      </div>
    </div>`);
    const list = view.querySelector(".tx-list");
    if (!b.transactions.length) list.innerHTML = `<p style="opacity:.7">No transactions yet. Go buy something!</p>`;
    b.transactions.forEach((tx) => {
      const row = el(`<div class="tx ${tx.refunded ? "refunded" : ""}">
        <div class="vlogo">${Icon.mini(vendorKey[tx.vendor] || "card", tx.vendor)}</div>
        <div><div><b>${tx.item}</b></div><div style="opacity:.75;font-size:.85rem">${tx.vendor}</div></div>
        <div style="text-align:right"><div>-$${tx.amount.toFixed(2)}</div></div>
        <div class="q" title="Details">?</div>
      </div>`);
      row.querySelector(".q").onclick = () => {
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
        items.forEach((it) => State.addTransaction({ vendor: "Amazon", item: it.name, amount: it.price, refundable: false }));
        S().amazon.cart = []; State.save();
        Notify.show({ icon: "", title: "Order placed", body: `${items.length} item(s) — $${total.toFixed(2)}`, onClick: () => Browser.openTo("bank.local") });
        thanksPage(ctx, items, total);
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
      { name: "Microsoft 365 Personal", price: 69.99, apps: ["Word", "Excel", "PowerPoint", "Outlook", "OneNote"] },
      { name: "Microsoft 365 Family", price: 99.99, apps: ["Word", "Excel", "PowerPoint", "Outlook", "OneNote", "Access", "Publisher"] },
      { name: "Office Home & Student", price: 149.99, apps: ["Word", "Excel", "PowerPoint"] },
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
      State.addTransaction({ vendor: "Microsoft", item: bd.name, amount: bd.price, refundable: true });
      const freshKey = State.VALID_KEYS.find((k) => !S().redeemedKeys.includes(k));
      Notify.show({ icon: Icon.mini("microsoft", "Microsoft"), title: "Purchase complete", body: `${bd.name} — key: ${freshKey || "n/a"}`, onClick: () => Browser.openTo("bank.local") });
      alert(`Thanks! Your Windows 12 product key:\n\n${freshKey || "All keys used"}\n\nApps: ${bd.apps.join(", ")}`);
      microsoft(ctx);
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
        yt.premium = true;
        State.addTransaction({ vendor: "YouTube", item: "YouTube Premium", amount: 3.99, refundable: true, kind: "premium" });
        State.save();
        Notify.show({ icon: Icon.mini("youtubeApp", "YouTube"), title: "Welcome to Premium", body: "Ads are now removed.", onClick: () => Browser.openTo("bank.local") });
        ytHome(ctx);
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
      if (i >= 0) yt.likes.splice(i, 1); else yt.likes.push(v.id);
      State.save(); ytWatch(ctx, v);
    };
    player.querySelector(".sub").onclick = () => {
      const i = yt.subscriptions.indexOf(v.channel.id);
      if (i >= 0) yt.subscriptions.splice(i, 1);
      else { yt.subscriptions.push(v.channel.id); Notify.show({ icon: Icon.mini(v.channel.id, v.channel.name), title: "Subscribed", body: `You subscribed to ${v.channel.name}`, onClick: () => Browser.openTo("youtube.local") }); }
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
      <span class="vp-time">0:00</span>
      <div class="vp-track"><div class="vp-fill"></div></div>
      <span class="vp-dur">${v.length}</span>
    </div>`);
    videoEl.appendChild(bar);
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
      const joined = d.joinedServers.includes(srv.id);
      const view = el(`<div>
        <div style="height:120px;border-radius:10px;background:${srv.color};display:flex;align-items:flex-end;padding:14px;font-size:2rem;font-weight:700;color:#fff">${srv.name}</div>
        <h1>${srv.name}</h1>
        <p style="white-space:pre-line">${srv.desc}</p>
        <p class="muted">${srv.members || ""} members</p>
        <button class="pill-btn join">${joined ? "Leave server" : "Join server"}</button>
      </div>`);
      view.querySelector(".join").onclick = () => {
        const i = d.joinedServers.indexOf(srv.id);
        if (i >= 0) d.joinedServers.splice(i, 1); else d.joinedServers.push(srv.id);
        State.save(); selectServer(srv);
      };
      content.appendChild(view);
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
    State.addTransaction({ vendor: "Duolingo", item: name + " (1 month)", amount: price, refundable: true });
    S().appData.duolingo.tier = tier;
    S().appData.duolingo.hearts = 5;
    State.save();
    if (window.WM.refreshDesktopIcons) window.WM.refreshDesktopIcons();
    if (window.WM.refreshTaskbar) window.WM.refreshTaskbar();
    Notify.show({ icon: "", title: `${name} active`, body: "Unlimited hearts unlocked.", onClick: () => Browser.openTo("duolingo.local") });
    duolingo(ctx);
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
      if (isRight) { correct++; target.xp += 10; lessonXp += 10; }
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

  window.Sites = { bank, amazon, microsoft, youtube, discord, duolingo };
})();
