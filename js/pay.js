/* Payment gate. On the FIRST purchase ever, show a (fake) card entry modal.
   Safety: a loud warning not to enter real details, a one-tap fake-card filler,
   and we NEVER store the full card number — only the last 4 digits. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;

  // Run `cb` once a card is on file. Shows the modal only the first time.
  function ensureCard(cb) {
    if (S().appData.cardOnFile) { cb(); return; }
    openModal(cb);
  }

  function openModal(cb) {
    const overlay = el(`<div class="pay-mask">
      <div class="modal pay-modal">
        <form class="form" onsubmit="return false">
          <div class="pay-warning">
            <b>This is a pretend computer.</b> Do <u>NOT</u> type a real card number, name, or CVC.
            Tap “Use fake test card” below.
          </div>
          <div class="payment--options">
            <button type="button" class="pay-apple" title="Apple Pay — opens Apple's official demo"><svg viewBox="0 0 44 18" width="44" height="18" aria-label="Apple Pay"><path fill="#111" d="M8.6 4.1c-.5.6-1.3 1-2 1-.1-.8.3-1.6.7-2.1.5-.6 1.3-1 2-1 .1.8-.2 1.6-.7 2.1zm.7 1.1c-1.1-.1-2.1.6-2.6.6s-1.4-.6-2.3-.6C3.2 5.3 2.1 6 1.5 7.1.3 9.2 1.2 12.3 2.4 14c.6.8 1.2 1.7 2.1 1.7.8 0 1.2-.5 2.2-.5s1.3.5 2.2.5 1.5-.8 2.1-1.7c.6-.9.9-1.8.9-1.9 0 0-1.8-.7-1.8-2.7 0-1.7 1.4-2.5 1.4-2.6-.8-1.2-2-1.3-2.4-1.3z"/><text x="13.5" y="14.2" font-size="12.5" font-weight="600" fill="#111" font-family="-apple-system,system-ui,sans-serif">Pay</text></svg></button>
            <button type="button" title="Google Pay (fake)"><svg viewBox="0 0 24 24" width="34" height="18"><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#111">G Pay</text></svg></button>
            <button type="button" title="PayPal (fake)"><svg viewBox="0 0 24 24" width="34" height="18"><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#003087">PayPal</text></svg></button>
            <button type="button" title="Amazon Pay (fake)"><img src="assets/amazon_pay.png" alt="Amazon Pay" style="height:16px;width:auto;display:block"></button>
          </div>
          <div class="separator"><hr class="line"><p>OR PAY WITH CARD</p><hr class="line"></div>
          <div class="credit-card-info--form">
            <div class="input_container">
              <label class="input_label">Card holder full name</label>
              <input id="pcName" class="input_field" type="text" placeholder="Test User" autocomplete="off">
            </div>
            <div class="input_container">
              <label class="input_label">Card Number</label>
              <input id="pcNum" class="input_field" type="text" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000" autocomplete="off">
            </div>
            <div class="split">
              <div class="input_container">
                <label class="input_label">Expiry Date</label>
                <input id="pcExp" class="input_field" type="text" maxlength="5" placeholder="MM / YY" autocomplete="off">
              </div>
              <div class="input_container">
                <label class="input_label">CVC</label>
                <input id="pcCvc" class="input_field" type="text" inputmode="numeric" maxlength="3" placeholder="000" autocomplete="off">
              </div>
            </div>
          </div>
          <button type="button" class="pay-fake-btn" id="pcFake">Use fake test card</button>
          <button type="button" class="purchase--btn" id="pcPay">Save card &amp; continue</button>
          <button type="button" class="pay-cancel" id="pcCancel">Cancel</button>
        </form>
      </div>
    </div>`);

    const num = overlay.querySelector("#pcNum");
    const exp = overlay.querySelector("#pcExp");
    const cvc = overlay.querySelector("#pcCvc");
    const name = overlay.querySelector("#pcName");

    // format card number with spaces
    num.addEventListener("input", () => {
      num.value = num.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
    });
    exp.addEventListener("input", () => {
      let v = exp.value.replace(/\D/g, "").slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + " / " + v.slice(2);
      exp.value = v;
    });
    cvc.addEventListener("input", () => { cvc.value = cvc.value.replace(/\D/g, "").slice(0, 3); });

    overlay.querySelector("#pcFake").onclick = () => {
      name.value = "Test User";
      num.value = "4242 4242 4242 4242";
      exp.value = "12 / 34";
      cvc.value = "123";
    };

    overlay.querySelector("#pcCancel").onclick = () => overlay.remove();

    // Apple Pay: Apple's official demo opens in a real tab (it won't load inside a page).
    // When you come back, finish the pretend purchase with "Apple Pay".
    overlay.querySelector(".pay-apple").onclick = () => {
      try { window.open("https://applepaydemo.apple.com/", "_blank", "noopener"); } catch (_) {}
      const form = overlay.querySelector(".form");
      overlay.querySelectorAll(".apay-step").forEach((x) => x.remove());
      const step = el(`<div class="apay-step">
        <div class="apay-logo"><svg viewBox="0 0 44 18" width="66" height="27"><path fill="currentColor" d="M8.6 4.1c-.5.6-1.3 1-2 1-.1-.8.3-1.6.7-2.1.5-.6 1.3-1 2-1 .1.8-.2 1.6-.7 2.1zm.7 1.1c-1.1-.1-2.1.6-2.6.6s-1.4-.6-2.3-.6C3.2 5.3 2.1 6 1.5 7.1.3 9.2 1.2 12.3 2.4 14c.6.8 1.2 1.7 2.1 1.7.8 0 1.2-.5 2.2-.5s1.3.5 2.2.5 1.5-.8 2.1-1.7c.6-.9.9-1.8.9-1.9 0 0-1.8-.7-1.8-2.7 0-1.7 1.4-2.5 1.4-2.6-.8-1.2-2-1.3-2.4-1.3z"/><text x="13.5" y="14.2" font-size="12.5" font-weight="600" fill="currentColor" font-family="-apple-system,system-ui,sans-serif">Pay</text></svg></div>
        <p>Apple's <b>Apple Pay demo</b> opened in a new tab. It's Apple's official test page — nothing is charged.</p>
        <p class="apay-small">Didn't open? <a href="https://applepaydemo.apple.com/" target="_blank" rel="noopener">Open the Apple Pay demo</a></p>
        <button type="button" class="apay-done">Finish with Apple Pay</button>
        <button type="button" class="pay-cancel apay-back">Back</button>
      </div>`);
      step.querySelector(".apay-done").onclick = () => {
        S().appData.cardOnFile = { last4: "Pay", name: "Apple Pay", wallet: "applepay" };
        State.save(); overlay.remove(); cb();
      };
      step.querySelector(".apay-back").onclick = () => { step.remove(); form.style.display = ""; };
      form.style.display = "none";
      form.after(step);
    };

    overlay.querySelector("#pcPay").onclick = () => {
      const digits = num.value.replace(/\D/g, "");
      if (!name.value.trim() || digits.length < 13 || !exp.value || cvc.value.length < 3) {
        alert("Fill in all fields (or tap “Use fake test card”).");
        return;
      }
      // Store ONLY the last 4 digits — never the full number.
      S().appData.cardOnFile = { last4: digits.slice(-4), name: name.value.trim().slice(0, 40) };
      State.save();
      overlay.remove();
      cb();
    };

    document.getElementById("screen").appendChild(overlay);
    setTimeout(() => name.focus(), 50);
  }

  window.Pay = { ensureCard };
})();
