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
            <button type="button" title="Apple Pay (fake)"><svg viewBox="0 0 24 24" width="34" height="18"><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#111">Pay</text></svg></button>
            <button type="button" title="Google Pay (fake)"><svg viewBox="0 0 24 24" width="34" height="18"><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#111">G Pay</text></svg></button>
            <button type="button" title="PayPal (fake)"><svg viewBox="0 0 24 24" width="34" height="18"><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#003087">PayPal</text></svg></button>
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
