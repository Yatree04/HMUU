/* ==========================================================================
   App — sign-in, shell, hash router, dialogs and event delegation.

   Routes:  #/login
            #/<portal>/<page>[/<id>][?query]     e.g. #/hm/map?floor=3&room=3005

   Each portal registers itself with HMS.app.portal({ id, nav, render,
   handlers, ... }) from its own file. Handlers from every portal share one
   table, so give them distinct names.

   Pattern: elements declare intent with data attributes, one delegated
   listener routes them here.
     data-act="name"        click / Enter / Space
     data-on-input="name"   input events
     data-on-change="name"  change events
     data-on-enter="name"   Enter key in an input
   Handlers receive (el, event). Re-render is full-page but focus + caret
   are restored, so typing in search boxes feels normal.
   ========================================================================== */
window.HMS = window.HMS || {};

HMS.app = (function () {
  const S = HMS.store.sel, A = HMS.store.act, UI = HMS.ui, C = HMS.campus;
  const { icon, esc } = UI;

  /* ------------------------------ UI state ------------------------------ */
  const ui = { pop: null, searchQ: "" };     // portals add their own keys via init()
  let dlg = null;                              // current dialog state
  let route = { portal: "login", path: "", id: null, query: {} };
  const portals = {};
  const hooks = [];                            // shared components that react to outside clicks / Escape
  const H = {};                                // every handler, all portals

  /* ------------------------------ Session ------------------------------ */
  const SKEY = "iitb-hms-session";
  let session = (() => { try { return JSON.parse(localStorage.getItem(SKEY)) || null; } catch (e) { return null; } })();
  const user = () => (session ? C.USERS[session.user] : null);
  function signIn(key) { session = { user: key }; try { localStorage.setItem(SKEY, JSON.stringify(session)); } catch (e) { /* ignore */ } }
  function signOut() { session = null; try { localStorage.removeItem(SKEY); } catch (e) { /* ignore */ } }

  function portal(def) {
    portals[def.id] = def;
    Object.assign(H, def.handlers || {});
    if (def.init) def.init(ui);
  }

  /* ------------------------------- Router ------------------------------- */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "") || "";
    const [p, qs] = h.split("?");
    const [portalId, path, id] = p.split("/");
    return { portal: portalId || "", path: path || "", id: id || null, query: Object.fromEntries(new URLSearchParams(qs || "")) };
  }
  function onRoute() {
    const prev = route;
    route = parseHash();
    const u = user();
    if (!portals[route.portal] || route.portal === "login") {
      if (u && route.portal !== "login") return go(C.ROLES.find((r) => r.id === u.role).home);
      route = { portal: "login", path: "", id: null, query: route.query };
    } else if (!u || u.role !== route.portal) {
      // Demo convenience: opening another portal's link signs you in as that role
      signIn(route.portal);
    }
    const P = portals[route.portal];
    if (P && !route.path) route.path = P.defaultPath;
    ui.pop = null;
    UI.close(true); dlg = null;
    if (P && P.onRoute) P.onRoute(route, prev, ui);
    render();
    window.scrollTo(0, 0);
    if (P && P.afterRoute) P.afterRoute(route, ui);
  }
  const go = (href) => { if (location.hash === href) onRoute(); else location.hash = href; };

  /* ------------------------------- Render ------------------------------- */
  function shell(inner, P) {
    const u = user();
    const unread = S.unread(u.target);
    const role = C.ROLES.find((r) => r.id === u.role);
    const active = P.active ? P.active(route) : route.path;
    return `<div class="shell">
      <header class="topbar">
        <a class="brand" href="${role.home}">${UI.logo}<span><div class="brand-name">Hostel Management</div><div class="brand-sub">Indian Institute of Technology Bombay</div></span></a>
        <div class="topbar-actions">
          <span class="role-chip" title="${esc(u.title)}">${esc(role.label)}</span>
          <button class="icon-btn" data-act="toggleGuide" aria-label="How this works" aria-expanded="${ui.pop === "guide"}">${icon("info")}</button>
          ${P.search ? `<button class="icon-btn" data-act="toggleSearch" aria-label="Search" aria-expanded="${ui.pop === "search"}">${icon("search")}</button>` : ""}
          <button class="icon-btn" data-act="toggleBell" aria-label="Notifications, ${unread} unread" aria-expanded="${ui.pop === "bell"}">${icon("bell")}${unread ? `<span class="dot"></span>` : ""}</button>
          <button class="avatar" data-act="toggleMe" aria-label="Account: ${esc(u.name)}" aria-expanded="${ui.pop === "me"}">${esc(u.initial)}</button>
          ${ui.pop === "search" && P.search ? P.search(ui) : ""}
          ${ui.pop === "bell" ? bellPop(u) : ""}
          ${ui.pop === "me" ? mePop(u) : ""}
          ${ui.pop === "guide" ? guidePop(u) : ""}
        </div>
      </header>
      <aside class="sidebar">
        <nav class="nav" aria-label="Main">${P.nav.map(([p, l]) => `<a href="#/${P.id}/${p}" ${active === p ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
        ${P.settings ? `<a class="nav-settings" href="#/${P.id}/settings" ${active === "settings" ? 'aria-current="page"' : ""}>${icon("gear")} Settings</a>` : `<span></span>`}
      </aside>
      <main class="main" id="main">${inner}</main>
    </div>`;
  }

  function bellPop(u) {
    const list = S.notifications(u.target).slice(0, 30);
    return `<div class="popover bell-pop" role="dialog" aria-label="Notifications">
      <div class="pop-head"><b>Notifications</b>${list.some((n) => !n.read) ? `<button class="link" data-act="markAllRead">Mark all read</button>` : ""}</div>
      ${list.length ? list.map((n) => `<button class="notif ${n.read ? "" : "unread"}" data-act="openNotif" data-id="${n.id}" data-href="${esc(n.href)}"><span>${esc(n.text)}</span><small class="num">${HMS.date.fmt(n.at)}</small></button>`).join("") : `<div class="empty" style="padding:18px">Nothing yet.</div>`}
    </div>`;
  }
  function mePop(u) {
    const others = Object.entries(C.USERS).filter(([k]) => k !== session.user);
    return `<div class="popover me-pop" role="dialog" aria-label="Account">
      <div class="me-head"><span class="avatar">${esc(u.initial)}</span><div><b>${esc(u.name)}</b><small>${esc(u.title)}</small></div></div>
      <div class="me-label">Switch role (demo)</div>
      ${others.map(([k, o]) => `<button class="me-item" data-act="switchRole" data-user="${k}"><span class="avatar sm">${esc(o.initial)}</span><span>${esc(o.name)}<small>${esc(C.ROLES.find((r) => r.id === o.role).label)}</small></span></button>`).join("")}
      <button class="me-item out" data-act="signOut">${icon("logout")} Sign out</button>
    </div>`;
  }
  function guidePop(u) {
    const steps = [
      ["student", "Student / Department / IRCC", "Submits a request with guests, dates, purpose and documents."],
      ["dean", "Associate Dean SA", "Approves, partly approves or rejects. Skipped for student guests and interview candidates."],
      ["hcu", "HCU Office", "Picks a hostel with free rooms for the dates. Splits mixed groups by gender."],
      ["hm", "Hall Manager", "Accepts and allots rooms on the live hostel map."],
      ["done", "Requester", "Sees the hostel and room numbers, and can ask for an extension."],
    ];
    const mine = { student: "student", dept: "student", ircc: "student", dean: "dean", hcu: "hcu", hm: "hm" }[u.role];
    return `<div class="popover guide-pop" role="dialog" aria-label="How this works">
      <b>How a request moves</b>
      <ol class="flow">${steps.map(([k, t, d]) => `<li class="${k === mine ? "me" : ""}"><span>${esc(t)}${k === mine ? ` <em>you</em>` : ""}</span><small>${esc(d)}</small></li>`).join("")}</ol>
      <p class="muted" style="font-size:11px;margin:10px 0 0">Every step is logged on the request, and the next person is notified. Switch roles from your avatar to follow one request end to end.</p>
    </div>`;
  }

  function login() {
    const R = C.ROLES;
    const card = (r) => {
      const u = Object.entries(C.USERS).filter(([, x]) => x.role === r.id);
      return `<article class="role-card">
        <div class="role-top"><span class="role-ic">${icon({ hm: "building", hcu: "layers", dean: "shield", student: "user", dept: "users", ircc: "route" }[r.id])}</span><h2>${esc(r.label)}</h2></div>
        <p>${esc(r.blurb)}</p>
        <div class="role-users">${u.map(([k, x]) => `<button class="btn btn-primary" data-act="signInAs" data-user="${k}">Continue as ${esc(x.name)}</button>`).join("")}</div>
      </article>`;
    };
    return `<div class="login">
      <header class="login-top"><span class="brand">${UI.logo}<span><div class="brand-name">Hostel Management</div><div class="brand-sub">Indian Institute of Technology Bombay</div></span></span></header>
      <section class="login-hero">
        <div>
          <h1>One place for every hostel stay at IIT Bombay.</h1>
          <p>Students, departments, IRCC, the Dean's office, HCU and Hall Managers work on the same live data. No more webmail threads, paper registers and four copies of the same Excel sheet.</p>
          <ol class="flow flow-h">
            <li><span>Request</span><small>Student, department or IRCC</small></li>
            <li><span>Approve</span><small>Associate Dean SA</small></li>
            <li><span>Route</span><small>HCU picks a hostel</small></li>
            <li><span>Allot</span><small>Hall Manager, on the map</small></li>
            <li><span>Confirm</span><small>Room numbers to the requester</small></li>
          </ol>
        </div>
        <div class="sso">
          <h2>Sign in</h2>
          <label class="field"><span>LDAP ID</span><input class="input" placeholder="e.g. 24b3625" disabled></label>
          <label class="field"><span>Password</span><input class="input" type="password" placeholder="••••••••" disabled></label>
          <button class="btn btn-primary btn-lg" disabled>Sign in with IITB SSO</button>
          <p class="muted">SSO is off in this prototype. Pick a role below to explore it.</p>
        </div>
      </section>
      <h2 class="login-sub">Choose a role to explore</h2>
      <div class="role-grid">${R.map(card).join("")}</div>
      <footer class="login-foot"><span class="muted">Prototype. Data is sample data kept in this browser.</span><button class="link" data-act="resetDemoLogin">Reset demo data</button></footer>
    </div>`;
  }

  function focusKey(el) {
    if (!el || !el.dataset) return null;
    const k = el.dataset.onInput || el.dataset.onChange || el.dataset.onEnter || el.id;
    return k ? { k, i: el.dataset.i, kk: el.dataset.k, s: el.selectionStart, e: el.selectionEnd, inLayer: !!el.closest(".layer") } : null;
  }
  function restoreFocus(f, root) {
    if (!f) return;
    const el = [...root.querySelectorAll("input, textarea, select")].find((x) => (x.dataset.onInput || x.dataset.onChange || x.dataset.onEnter || x.id) === f.k && x.dataset.i === f.i && x.dataset.k === f.kk);
    if (el) { el.focus(); try { if (f.s != null) el.setSelectionRange(f.s, f.e); } catch (e) { /* not text */ } }
  }

  function ctx() { return { ui, query: route.query, route, user: user(), session }; }
  function render() {
    const f = focusKey(document.activeElement);
    const root = document.getElementById("app");
    const P = portals[route.portal];
    document.body.dataset.portal = route.portal;
    root.innerHTML = route.portal === "login" || !P ? login() : shell(P.render(route, ctx()), P);
    document.title = (P ? P.title(route) + " · " : "") + "Hostel Management · IIT Bombay";
    if (f && !f.inLayer) restoreFocus(f, root);
  }

  /* ------------------------------ Dialogs ------------------------------ */
  // dlg = { view(ctx, dlg) → html, kind: "modal" | "wide" | "drawer", ...state }
  function renderDialog() {
    if (!dlg) return;
    const f = focusKey(document.activeElement);
    const html = dlg.view(ctx(), dlg);
    if (UI.isOpen() && dlg.rendered) UI.replace(html);
    else { UI.open(html, { kind: dlg.kind || "modal", onClose: () => { const d = dlg; dlg = null; if (d && d.onClose) d.onClose(); render(); } }); dlg.rendered = true; }
    const layer = document.querySelector(".layer");
    if (f && f.inLayer && layer) restoreFocus(f, layer);
  }
  function openDialog(state) { UI.close(true); dlg = state; renderDialog(); }
  function closeDialog() { const d = dlg; UI.close(true); dlg = null; if (d && d.onClose) d.onClose(); render(); }
  /** Simple form dialog; onSubmit(values) may return an error string */
  function form(title, fields, submitLabel, onSubmit, opts = {}) {
    openDialog({ kind: opts.wide ? "wide" : "modal", onSubmit, view: () => `
      <div class="modal-head"><h2 class="modal-title">${esc(title)}</h2></div>
      <div class="modal-body">${opts.intro ? `<p class="muted" style="font-size:12px;margin:0 0 14px">${opts.intro}</p>` : ""}<div class="stack">${fields}</div></div>
      <div class="modal-foot"><button class="btn btn-secondary" data-act="closeLayer">Cancel</button><button class="btn ${opts.danger ? "btn-danger" : "btn-primary"}" data-act="submitForm">${esc(submitLabel)}</button></div>` });
  }
  const formValues = () => Object.fromEntries([...document.querySelectorAll(".layer [name]")].map((i) => [i.name, i.type === "checkbox" ? i.checked : i.value]));

  /* ------------------------------ Shared handlers ------------------------------ */
  Object.assign(H, {
    go: (el) => go(el.dataset.href),
    back: (el) => (history.length > 1 ? history.back() : go(el.dataset.href || "#/")),
    closeLayer: () => closeDialog(),
    submitForm: () => {
      const err = dlg.onSubmit(formValues());
      if (typeof err === "string") { UI.toast(err); return; }
      if (dlg && !dlg.keepOpen) closeDialog();
    },
    toggleBell: () => { ui.pop = ui.pop === "bell" ? null : "bell"; render(); },
    toggleMe: () => { ui.pop = ui.pop === "me" ? null : "me"; render(); },
    toggleGuide: () => { ui.pop = ui.pop === "guide" ? null : "guide"; render(); },
    markAllRead: () => { A.markRead(user().target); render(); },
    openNotif: (el) => { A.readNotif(el.dataset.id); ui.pop = null; if (el.dataset.href) go(el.dataset.href); else render(); },
    signInAs: (el) => { signIn(el.dataset.user); go(C.ROLES.find((r) => r.id === C.USERS[el.dataset.user].role).home); },
    switchRole: (el) => { signIn(el.dataset.user); ui.pop = null; go(C.ROLES.find((r) => r.id === C.USERS[el.dataset.user].role).home); UI.toast("Now viewing as " + C.USERS[el.dataset.user].name); },
    signOut: () => { signOut(); go("#/login"); },
    resetDemoLogin: () => { HMS.store.reset(); UI.toast("Demo data reset"); render(); },
  });

  /* ------------------------------ Delegation ------------------------------ */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) {
      let changed = false;
      if (ui.pop && !e.target.closest(".popover")) { ui.pop = null; changed = true; }
      for (const P of [...Object.values(portals), ...hooks]) if (P.outsideClick && P.outsideClick(e, ui)) changed = true;
      if (changed) render();
      return;
    }
    if (el.dataset.selfOnly && e.target !== el) return;
    if (el.disabled) return;
    const fn = H[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener("input", (e) => { const n = e.target.dataset && e.target.dataset.onInput; if (n && H[n]) H[n](e.target, e); });
  document.addEventListener("change", (e) => { const n = e.target.dataset && e.target.dataset.onChange; if (n && H[n]) H[n](e.target, e); });
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key === "Escape") {
      if (UI.isOpen()) closeDialog();
      else { let changed = !!ui.pop; ui.pop = null; for (const P of [...Object.values(portals), ...hooks]) if (P.escape && P.escape(ui)) changed = true; if (changed) render(); }
      return;
    }
    if (e.key === "Enter" && t.dataset && t.dataset.onEnter) { e.preventDefault(); H[t.dataset.onEnter](t, e); return; }
    if ((e.key === "Enter" || e.key === " ") && t.getAttribute && t.getAttribute("role") === "button" && t.dataset.act) { e.preventDefault(); H[t.dataset.act](t, e); }
  });
  window.addEventListener("hashchange", onRoute);
  // Data changed in another tab: redraw what's on screen
  window.addEventListener("storage", () => { render(); if (dlg) renderDialog(); });

  function start() { onRoute(); }

  return {
    ui, H, go, render, renderDialog, openDialog, closeDialog, form, formValues, portal, start, user, hook: (h) => hooks.push(h),
    get dlg() { return dlg; }, set dlg(v) { dlg = v; }, get route() { return route; },
  };
})();
