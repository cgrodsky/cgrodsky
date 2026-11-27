/* Windows 12 inside Windows 12 — a Hyper-V style "Virtual Machine Connection"
   window that runs a complete, separate copy of the OS in an iframe
   (index.html?vm=N). Each VM level keeps its own storage key (see js/state.js),
   so a VM can be freshly installed, broken, or reset without touching the host.
   Launch from Terminal: `win12` / `vmconnect` (cmd) or `Start-VM` (PowerShell),
   or from Start: "Windows 12 VM". */
(function () {
  "use strict";
  const MAX_DEPTH = 3;
  const depth = () => window.WIN12_VM_DEPTH || 0;
  const keyFor = (d) => "win12_state_v1__vm" + d;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function canNest() { return depth() < MAX_DEPTH; }

  // opts: { fresh: bool }  → returns { ok, message }
  function launch(opts) {
    opts = opts || {};
    if (!canNest()) return { ok: false, message: "Nested virtualization limit reached (" + MAX_DEPTH + " levels). Close a VM first." };
    const d = depth() + 1;
    if (opts.fresh) { try { localStorage.removeItem(keyFor(d)); } catch (e) {} }
    const hasState = (() => { try { return !!localStorage.getItem(keyFor(d)); } catch (e) { return false; } })();
    const name = "Windows 12" + (d > 1 ? " (nested ×" + d + ")" : "");
    const src = new URL("index.html?vm=" + d, document.baseURI).href;
    const ref = WM.createWindow({ title: name + " on WIN12-PC - Virtual Machine Connection", icon: Icon.mini("hyperv", "Hyper-V"), width: 1040, height: 700, appId: "hyperv" });
    const body = ref.body;
    body.classList.add("vm12-host");
    body.innerHTML = `
      <div class="vm12-bar">
        <span class="vm12-state"><i class="vm12-led"></i> Running</span>
        <span class="vm12-name">${esc(name)}</span>
        <span class="vm12-grow"></span>
        <button data-a="cad" title="Send Ctrl+Alt+Del (lock the VM)">Ctrl+Alt+Del</button>
        <button data-a="reset" title="Reset (restart) the VM">Reset</button>
        <button data-a="fresh" title="Erase the VM and install Windows 12 from scratch">Fresh install</button>
        <button data-a="full" title="Full screen">Full screen</button>
        <button data-a="off" class="vm12-off" title="Turn off the VM">Turn off</button>
      </div>
      <div class="vm12-screen"><iframe class="vm12-frame" title="${esc(name)}" src="${src}" allow="fullscreen; clipboard-read; clipboard-write; autoplay; publickey-credentials-get; publickey-credentials-create"></iframe>
        <div class="vm12-boot">Starting the virtual machine…<small>${hasState ? "Resuming its saved state" : "New VM — Windows Setup will run"}</small></div></div>
      <div class="vm12-status">Generation 2 · ${navigator.hardwareConcurrency || 4} virtual processors · storage key <code>${keyFor(d)}</code> · level ${d} of ${MAX_DEPTH}</div>`;
    const frame = body.querySelector(".vm12-frame"), boot = body.querySelector(".vm12-boot"), stateEl = body.querySelector(".vm12-state");
    frame.addEventListener("load", () => { boot.hidden = true; });
    const setState = (t, on) => { stateEl.innerHTML = `<i class="vm12-led${on ? "" : " off"}"></i> ${t}`; };
    body.querySelector(".vm12-bar").addEventListener("click", (e) => {
      const a = e.target.closest("button") && e.target.closest("button").dataset.a; if (!a) return;
      if (a === "reset") { boot.hidden = false; setState("Restarting", true); frame.src = src; setTimeout(() => setState("Running", true), 800); }
      else if (a === "fresh") {
        if (!confirm("Erase this VM and install Windows 12 from scratch? (Your real desktop is not affected.)")) return;
        try { localStorage.removeItem(keyFor(d)); } catch (_) {}
        boot.hidden = false; frame.src = src; setState("Installing", true);
      }
      else if (a === "full") { try { const r = (frame.requestFullscreen || frame.webkitRequestFullscreen || function () {}).call(frame); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
      else if (a === "cad") { boot.hidden = false; frame.src = src; } // back to the VM's lock screen
      else if (a === "off") { setState("Off", false); frame.src = "about:blank"; boot.hidden = false; boot.firstChild.textContent = "The virtual machine is turned off."; setTimeout(() => { if (ref.close) ref.close(); }, 600); }
    });
    if (window.EventLog && EventLog.add) { try { EventLog.add("System", "Information", "Hyper-V-Worker", 18500, "'" + name + "' started successfully."); } catch (_) {} }
    return { ok: true, message: "'" + name + "' started" + (hasState ? "" : " (new VM — Windows Setup will run)") + "." };
  }

  window.VM12 = { launch, canNest, depth, MAX_DEPTH };

  // Start menu / search entry: "Windows 12 VM"
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.hyperv = function () { const r = launch({}); if (!r.ok) alert(r.message); };
  try {
    if (window.Catalog && !Catalog.storeApps.find((a) => a.id === "hyperv")) {
      Catalog.storeApps.push({ id: "hyperv", name: "Windows 12 VM", cat: "System", price: 0, builtin: "hyperv", desc: "Run a complete, separate Windows 12 inside Windows 12 (Hyper-V). Also: type win12 in Terminal." });
    }
    (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []).push("hyperv");
  } catch (e) {}
})();
