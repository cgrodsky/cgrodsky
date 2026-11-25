/* Combobox — a filterable select (Halaska UI kit look), ported from a React/TypeScript
   component to this project's plain JavaScript so it runs without a build step.

   Same look and behaviour as the original:
   - trigger button (38px, pill-ish 16px radius, input background, border on hover/open,
     chevron that turns up when open)
   - frosted pop-up with a "Filter…" box (autofocused), a listbox, "No results",
     a ✓ on the chosen option, and the halaska-scale-in animation
   - keyboard: ArrowDown on the trigger opens; in the filter box ArrowUp/ArrowDown move,
     Enter picks, Escape closes and puts focus back on the trigger; clicking outside closes
   - ARIA: role=combobox / listbox / option, aria-expanded, aria-activedescendant
   One small fix: the highlighted row is reset when the filter text changes, so Enter
   always picks a visible option.

   Usage:
     const cb = Combobox.create({
       options: [{ value: "acme", label: "Acme" }, …],
       value: "", placeholder: "Select…", label: "Customer",   // label optional
       theme: "light" | "dark" (default: follows body.dark),
       accent: "#8b5cf6",                                       // optional
       onChange(value) { … },
     });
     parent.appendChild(cb.el);   cb.setValue(v);   cb.getValue();
   Styles: css/style.css, classes prefixed "hk-cb-". */
(function () {
  "use strict";
  let uidCount = 0;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CHEVRON = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="hk-cb-chev"><polyline points="6,3 11,8 6,13"/></svg>`;

  // Accent overrides, like the original usePal(): hover = 30 darker per channel, soft bg.
  function accentVars(hex, dark) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return "";
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `--hk-accent:${hex};--hk-accent-bg:rgba(${r},${g},${b},${dark ? 0.12 : 0.08})`;
  }

  function create(opts) {
    opts = opts || {};
    const options = (opts.options || []).map((o) => ({ value: String(o.value), label: String(o.label) }));
    let value = opts.value == null ? "" : String(opts.value);
    const dark = opts.theme ? opts.theme === "dark" : document.body.classList.contains("dark");
    const uid = "combo-" + (++uidCount);
    let open = false, query = "", idx = 0, filtered = options;

    const root = document.createElement("div");
    root.className = "hk-cb" + (dark ? " hk-cb-dark" : "");
    const av = accentVars(opts.accent, dark); if (av) root.setAttribute("style", av);
    root.innerHTML = `${opts.label ? `<label class="hk-cb-label" for="${uid}-trigger">${esc(opts.label)}${opts.required ? '<span aria-hidden="true" class="hk-cb-req">*</span>' : ""}</label>` : ""}
      <button type="button" id="${uid}-trigger" class="hk-cb-trigger" data-combobox-trigger role="combobox" aria-haspopup="listbox" aria-expanded="false"${typeof opts.label === "string" ? ` aria-label="${esc(opts.label)}"` : ""}>
        <span class="hk-cb-value"></span><span class="hk-cb-chevwrap">${CHEVRON}</span>
      </button>`;
    const trigger = root.querySelector(".hk-cb-trigger"), valueEl = root.querySelector(".hk-cb-value");
    let pop = null, input = null, list = null;

    function paintTrigger() {
      const sel = options.find((o) => o.value === value);
      valueEl.textContent = sel ? sel.label : (opts.placeholder || "Select…");
      trigger.classList.toggle("hk-cb-empty", !sel);
      trigger.classList.toggle("hk-cb-open", open);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }
    function paintList() {
      if (!list) return;
      filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
      if (idx > filtered.length - 1) idx = Math.max(0, filtered.length - 1);
      if (!filtered.length) { list.innerHTML = `<div class="hk-cb-none">No results</div>`; input.removeAttribute("aria-activedescendant"); return; }
      list.innerHTML = filtered.map((o, i) => `<button type="button" id="${uid}-opt-${i}" class="hk-cb-opt${i === idx ? " hk-cb-active" : ""}" role="option" aria-selected="${o.value === value}" tabindex="-1" data-i="${i}"><span></span>${o.value === value ? '<span class="hk-cb-check">✓</span>' : ""}</button>`).join("");
      list.querySelectorAll(".hk-cb-opt").forEach((b, i) => { b.firstChild.textContent = filtered[i].label; });
      input.setAttribute("aria-activedescendant", `${uid}-opt-${idx}`);
      const act = list.querySelector(".hk-cb-active"); if (act && act.scrollIntoView) act.scrollIntoView({ block: "nearest" });
    }
    function setIdx(i) {
      idx = i;
      list.querySelectorAll(".hk-cb-opt").forEach((b) => b.classList.toggle("hk-cb-active", +b.dataset.i === idx));
      if (filtered[idx]) input.setAttribute("aria-activedescendant", `${uid}-opt-${idx}`);
      const act = list.querySelector(".hk-cb-active"); if (act && act.scrollIntoView) act.scrollIntoView({ block: "nearest" });
    }
    function choose(v) { value = v; paintTrigger(); if (typeof opts.onChange === "function") opts.onChange(v); }
    function openPop() {
      if (open) return;
      open = true; query = ""; idx = 0;
      pop = document.createElement("div");
      pop.className = "hk-cb-pop";
      pop.innerHTML = `<input class="hk-cb-filter" placeholder="Filter…" aria-label="Filter options" aria-controls="${uid}-list" autocomplete="off"><div id="${uid}-list" class="hk-cb-list" role="listbox"></div>`;
      root.appendChild(pop);
      input = pop.querySelector("input"); list = pop.querySelector(".hk-cb-list");
      input.oninput = () => { query = input.value; idx = 0; paintList(); };
      input.onkeydown = (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setIdx(Math.min(idx + 1, filtered.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(Math.max(idx - 1, 0)); }
        else if (e.key === "Enter") { e.preventDefault(); if (filtered[idx]) { choose(filtered[idx].value); closeAndReturn(); } }
        else if (e.key === "Escape") { e.stopPropagation(); closeAndReturn(); }
      };
      list.addEventListener("click", (e) => { const b = e.target.closest(".hk-cb-opt"); if (!b) return; const o = filtered[+b.dataset.i]; if (o) { choose(o.value); closeAndReturn(); } });
      list.addEventListener("mouseover", (e) => { const b = e.target.closest(".hk-cb-opt"); if (b && +b.dataset.i !== idx) setIdx(+b.dataset.i); });
      paintList(); paintTrigger();
      try { input.focus(); } catch (_) {}
    }
    function closePop() { if (!open) return; open = false; if (pop) pop.remove(); pop = input = list = null; paintTrigger(); }
    function closeAndReturn() { closePop(); try { trigger.focus(); } catch (_) {} }

    trigger.onclick = () => (open ? closePop() : openPop());
    trigger.onkeydown = (e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); openPop(); } };
    const outside = (e) => {
      if (!root.isConnected) { document.removeEventListener("mousedown", outside); document.removeEventListener("touchstart", outside); return; }
      if (open && !root.contains(e.target)) closePop();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside, { passive: true });
    paintTrigger();

    return {
      el: root,
      getValue: () => value,
      setValue: (v) => { value = v == null ? "" : String(v); paintTrigger(); if (open) paintList(); },
      close: closePop,
    };
  }

  window.Combobox = { create };
})();
