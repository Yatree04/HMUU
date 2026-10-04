/* ==========================================================================
   UI helpers — icons, escaping, overlays (modal / drawer / popover), toasts.
   Icons are hand-drawn to match Phosphor "light" (the set used in Figma:
   MagnifyingGlass 90:2742, PencilSimple 90:2175, CaretRight 90:2431,
   GearSix 90:3238). Swap for @phosphor-icons/web when you add a bundler.
   ========================================================================== */
window.HMS = window.HMS || {};

HMS.ui = (function () {
  const P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
    bell: '<path d="M6 10a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 16 6 10Z"/><path d="M9.5 20.5a2.6 2.6 0 0 0 5 0"/><path d="M4 4.5 2.8 6M20 4.5 21.2 6"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/><circle cx="12" cy="12" r="7"/>',
    pencil: '<path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4Z"/><path d="M13 7l4 4"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3.2"/>',
    caretRight: '<path d="m9 5 7 7-7 7"/>',
    caretDown: '<path d="m5 9 7 7 7-7"/>',
    caretUp: '<path d="m5 15 7-7 7 7"/>',
    caretLeft: '<path d="m15 5-7 7 7 7"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    funnel: '<path d="M3.5 5h17l-6.5 8v6l-4-2v-4Z"/>',
    sort: '<path d="M4 6h9M4 12h7M4 18h5"/><path d="M17 5v14M14 16l3 3 3-3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    building: '<rect x="4" y="3.5" width="11" height="17" rx="1"/><path d="M15 9.5h4.5a.5.5 0 0 1 .5.5v10.5M2.5 20.5h19M7.5 7.5h1M11 7.5h1M7.5 11h1M11 11h1M7.5 14.5h1M11 14.5h1M9 20.5v-3h1v3"/>',
    list: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11"/><path d="M4 18h2.5"/>',
    arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4.5 19.5h15"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2Z"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4Z"/>',
    door: '<path d="M5 20.5V4a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v16.5M3 20.5h18"/><circle cx="15" cy="12.5" r=".8" fill="currentColor"/>',
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5v10h13v-10M10 19.5v-5h4v5"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3"/>',
    users: '<circle cx="9" cy="9" r="3.3"/><path d="M3 19.5c.9-3 3.2-4.6 6-4.6s5.1 1.6 6 4.6"/><path d="M15.5 5.9a3.3 3.3 0 0 1 0 6.3M17.5 14.9c1.7.6 2.9 2.1 3.5 4.6"/>',
    file: '<path d="M6 3.5h8l4 4v13H6Z"/><path d="M14 3.5v4h4M9 12.5h6M9 16h6"/>',
    upload: '<path d="M12 16V4.5M7 9.5l5-5 5 5M4.5 19.5h15"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    logout: '<path d="M14 4.5H5.5v15H14M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5"/>',
    swap: '<path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5M20 16H6M9.5 12.5 6 16l3.5 3.5"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    inbox: '<path d="M3.5 13.5 6 5h12l2.5 8.5v6h-17Z"/><path d="M3.5 13.5H9a3 3 0 0 0 6 0h5.5"/>',
    shield: '<path d="M12 3.5 19.5 6v6c0 4.5-3.3 7.5-7.5 8.5-4.2-1-7.5-4-7.5-8.5V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/>',
    layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5Z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
    megaphone: '<path d="M4 10v4h3l7 4.5v-13L7 10Z"/><path d="M17.5 9a4 4 0 0 1 0 6M7 14l1.5 5h2L9.5 14"/>',
    form: '<rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
    play: '<path d="M7 4.5v15l12-7.5Z"/>',
  };
  function icon(name, cls) {
    return `<svg class="ic ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
  }

  // IIT Bombay emblem stand-in (the real logo is an image mask in Figma 238:3457)
  const logo = `<svg class="brand-mark" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="20" cy="20" r="17"/><circle cx="20" cy="20" r="11"/>${Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return `<line x1="${20 + Math.cos(a) * 17}" y1="${20 + Math.sin(a) * 17}" x2="${20 + Math.cos(a) * 19.5}" y2="${20 + Math.sin(a) * 19.5}"/>`; }).join("")}<path d="M14 25h12M15 25v-7M20 25v-9M25 25v-7M13 18h14l-7-4Z"/></svg>`;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kv = (label, value, cls) => `<dl class="kv ${cls || ""}"><dt>${esc(label)}</dt><dd>${value ?? "—"}</dd></dl>`;
  const phoneMask = (p) => (p ? String(p).slice(0, 2) + "XXX XXXXX" : "—");   // mirrors "81XXX XXXXX" in Figma

  /* ---------- Overlays: one layer at a time keeps focus handling simple ---------- */
  let layer = null;
  let lastFocus = null;

  function open(html, { kind = "modal", onClose } = {}) {
    close(true);
    lastFocus = document.activeElement;
    const wrap = document.createElement("div");
    wrap.className = "layer";
    if (kind === "drawer") wrap.innerHTML = `<div class="drawer-scrim" data-act="closeLayer"></div><aside class="drawer" role="dialog" aria-modal="true">${html}</aside>`;
    else wrap.innerHTML = `<div class="scrim" data-act="closeLayer" data-self-only="1"><div class="modal ${kind === "wide" ? "modal-wide" : ""}" role="dialog" aria-modal="true">${html}</div></div>`;
    document.body.appendChild(wrap);
    layer = { el: wrap, onClose };
    const f = wrap.querySelector("[autofocus], input, select, textarea, button:not([data-act=closeLayer])");
    if (f) f.focus();
    return wrap;
  }
  function replace(html) { if (!layer) return; const box = layer.el.querySelector(".modal, .drawer"); box.innerHTML = html; }
  function close(silent) {
    if (!layer) return;
    const { el, onClose } = layer; layer = null; el.remove();
    if (onClose && !silent) onClose();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  const isOpen = () => !!layer;

  function toast(msg, action) {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; wrap.setAttribute("role", "status"); document.body.appendChild(wrap); }
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button class="link" data-act="${action.act}" ${action.data || ""}>${esc(action.label)}</button>` : "");
    wrap.appendChild(t);
    while (wrap.children.length > 3) wrap.firstChild.remove();
    setTimeout(() => t.remove(), action ? 6000 : 3200);
  }

  function csv(rows, cols) {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [cols.map((c) => q(c.label)).join(","), ...rows.map((r) => cols.map((c) => q(r[c.key])).join(","))].join("\n");
  }
  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }

  return { icon, logo, esc, kv, phoneMask, open, replace, close, isOpen, toast, csv, download };
})();

