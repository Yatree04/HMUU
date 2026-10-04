/* ==========================================================================
   List kit — the one list view every portal uses for requests.
   Toolbar from Figma 238:4052 (Filter "Where:" builder, tabs, Rows per page,
   Search). Table from Figma 293:10039 (grey header band, striped rows,
   "1–12 of 24" footer with numbered pages).

   HMS.list.render({
     key,                       state slot in ui.lists[key]
     tabs: [{ id, label, test(row) }],
     rows: [{ ...plain values used for search, filter and sort }],
     cols: [{ key, label, fmt?(value, row) → html }],
     rowAttrs(row) → 'data-act="…" …'   what clicking the row does
     actions(row) → html                inline buttons in the last cell
     tools → html                       extra buttons right of the search
     empty: { title, body }
   })
   ========================================================================== */
window.HMS = window.HMS || {};

HMS.list = (function () {
  const { icon, esc } = HMS.ui;
  const app = HMS.app;
  const ui = app.ui;
  ui.lists = ui.lists || {};
  const OPS = { contains: "Contains", is: "Is", not: "Is not", starts: "Starts with" };

  function state(key, defaults) {
    if (!ui.lists[key]) ui.lists[key] = { tab: null, q: "", per: "25", page: 1, filters: [], filterOpen: false, sort: null, ...defaults };
    return ui.lists[key];
  }
  const plain = (v) => String(v ?? "").toLowerCase();
  function applyFilters(rows, filters) {
    return rows.filter((r) => filters.every((f) => {
      if (!f.col || f.val === "") return true;
      const v = plain(r[f.col]), q = plain(f.val);
      return f.op === "is" ? v === q : f.op === "not" ? v !== q : f.op === "starts" ? v.startsWith(q) : v.includes(q);
    }));
  }

  /** Numbered pager: ‹ Previous 1 2 … 9 Next › */
  function pager(page, pages, total, per, act, extra = "") {
    const from = total ? (page - 1) * per + 1 : 0, to = Math.min(page * per, total);
    let nums = [];
    for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== "…") nums.push("…");
    return `<div class="tfoot"><span class="num">${from}–${to} of ${total.toLocaleString("en-IN")}</span>
      ${pages > 1 ? `<nav class="pages" aria-label="Pages">
        <button class="pg-step" data-act="${act}" data-p="${page - 1}" ${extra} ${page <= 1 ? "disabled" : ""}>${icon("caretLeft")} Previous</button>
        ${nums.map((n) => n === "…" ? `<span class="pg-gap">…</span>` : `<button class="pg" data-act="${act}" data-p="${n}" ${extra} aria-current="${n === page}">${n}</button>`).join("")}
        <button class="pg-step" data-act="${act}" data-p="${page + 1}" ${extra} ${page >= pages ? "disabled" : ""}>Next ${icon("caretRight")}</button>
      </nav>` : ""}</div>`;
  }

  function filterPop(key, st, cols) {
    const f = st.filters.length ? st.filters : [{ col: "", op: "contains", val: "" }];
    return `<div class="popover filter-pop" role="dialog" aria-label="Filter">
      <header><span>Where:</span><button class="link" data-act="lstFilterClear" data-list="${key}" style="font-size:10px">clear filters</button></header>
      <div class="filter-rows">${f.map((r, i) => `<div class="filter-row">
        <select aria-label="Column" data-on-change="lstFilterEdit" data-list="${key}" data-i="${i}" data-k="col"><option value="">Select Column</option>${cols.map((c) => `<option value="${c.key}" ${c.key === r.col ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
        <select aria-label="Condition" data-on-change="lstFilterEdit" data-list="${key}" data-i="${i}" data-k="op">${Object.entries(OPS).map(([k, l]) => `<option value="${k}" ${k === r.op ? "selected" : ""}>${l}</option>`).join("")}</select>
        <input aria-label="Value" placeholder="Value" value="${esc(r.val)}" data-on-input="lstFilterEdit" data-list="${key}" data-i="${i}" data-k="val">
        <button data-act="lstFilterRemove" data-list="${key}" data-i="${i}" aria-label="Remove filter">${icon("x")}</button>
      </div>`).join("")}</div>
      <button class="filter-add" data-act="lstFilterAdd" data-list="${key}">Add filter +</button>
      <div class="filter-foot"><button class="btn btn-primary" data-act="lstFilterToggle" data-list="${key}">Done</button></div>
    </div>`;
  }

  function render(o) {
    const st = state(o.key, o.defaults);
    const tabs = o.tabs || [];
    const tab = tabs.find((t) => t.id === st.tab) || tabs[0];
    if (tab) st.tab = tab.id;
    let rows = tab ? o.rows.filter(tab.test) : o.rows.slice();
    rows = applyFilters(rows, st.filters);
    if (st.q) { const q = plain(st.q); rows = rows.filter((r) => o.cols.some((c) => plain(r[c.key]).includes(q)) || plain(r.search).includes(q)); }
    if (st.sort) { const { key, dir } = st.sort; rows.sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { numeric: true }) * dir); }
    const per = st.per === "All" ? Math.max(rows.length, 1) : Number(st.per);
    const pages = Math.max(1, Math.ceil(rows.length / per));
    st.page = Math.min(Math.max(1, st.page), pages);
    const slice = rows.slice((st.page - 1) * per, st.page * per);
    const nF = st.filters.filter((f) => f.col && f.val !== "").length;
    const K = `data-list="${o.key}"`;

    const table = rows.length ? `<div class="table-card"><div class="table-wrap"><table class="data">
        <thead><tr>${o.cols.map((c) => `<th scope="col"><button class="sort-th" data-act="lstSort" ${K} data-key="${c.key}">${esc(c.label)}${st.sort && st.sort.key === c.key ? icon(st.sort.dir > 0 ? "caretDown" : "caretUp") : ""}</button></th>`).join("")}${o.actions ? `<th><span class="sr-only">Actions</span></th>` : ""}</tr></thead>
        <tbody>${slice.map((r) => `<tr ${o.rowAttrs ? `class="click-row" ${o.rowAttrs(r)}` : ""}>${o.cols.map((c) => `<td class="${c.cls || ""}">${c.fmt ? c.fmt(r[c.key], r) : esc(r[c.key] ?? "—")}</td>`).join("")}${o.actions ? `<td class="row-actions">${o.actions(r)}</td>` : ""}</tr>`).join("")}</tbody>
      </table></div>${pager(st.page, pages, rows.length, per, "lstPageTo", K)}</div>`
      : `<div class="empty"><strong>${esc((o.empty || {}).title || "Nothing here")}</strong>${(o.empty || {}).body || ""}</div>`;

    return `<div class="list-view">
      <div class="toolbar">
        <div class="toolbar-left" style="position:relative">
          <button class="filter-btn" data-act="lstFilterToggle" ${K} aria-expanded="${st.filterOpen}">Filter ${nF ? `<span class="count">${nF}</span>` : ""}${icon("funnel")}</button>
          ${st.filterOpen ? filterPop(o.key, st, o.cols.filter((c) => !c.noFilter)) : ""}
          ${o.note || ""}
        </div>
        <div class="toolbar-right">
          <label class="rows-label" for="per-${o.key}">Rows per page</label>
          <span class="mini-select"><select id="per-${o.key}" data-on-change="lstPer" ${K}>${["10", "25", "50", "All"].map((v) => `<option ${v === st.per ? "selected" : ""}>${v}</option>`).join("")}</select>${icon("caretDown")}</span>
          <span class="search">${icon("search")}<input class="input" type="search" placeholder="Search" value="${esc(st.q)}" data-on-input="lstQ" ${K} aria-label="Search"></span>
          ${o.tools || ""}
        </div>
      </div>
      ${tabs.length ? `<div class="tabs" role="tablist">${tabs.map((t) => `<button class="tab" role="tab" aria-selected="${t.id === tab.id}" data-act="lstTab" ${K} data-tab="${t.id}">${esc(t.label)} <span class="muted">${o.rows.filter(t.test).length}</span></button>`).join("")}</div>` : ""}
      ${o.above || ""}
      ${table}
    </div>`;
  }

  const S = (el) => ui.lists[el.dataset.list];
  const render_ = () => app.render();
  Object.assign(app.H, {
    lstTab: (el) => { const s = S(el); s.tab = el.dataset.tab; s.page = 1; render_(); },
    lstQ: (el) => { const s = S(el); s.q = el.value; s.page = 1; render_(); },
    lstPer: (el) => { const s = S(el); s.per = el.value; s.page = 1; render_(); },
    lstPageTo: (el) => { S(el).page = Number(el.dataset.p); render_(); },
    lstSort: (el) => { const s = S(el); const k = el.dataset.key; s.sort = { key: k, dir: s.sort && s.sort.key === k ? -s.sort.dir : 1 }; render_(); },
    lstFilterToggle: (el) => { const s = S(el); s.filterOpen = !s.filterOpen; render_(); },
    lstFilterClear: (el) => { const s = S(el); s.filters = []; s.page = 1; render_(); },
    lstFilterAdd: (el) => { const s = S(el); if (!s.filters.length) s.filters.push({ col: "", op: "contains", val: "" }); s.filters.push({ col: "", op: "contains", val: "" }); render_(); },
    lstFilterRemove: (el) => { S(el).filters.splice(Number(el.dataset.i), 1); render_(); },
    lstFilterEdit: (el) => { const s = S(el); const i = Number(el.dataset.i); if (!s.filters[i]) s.filters[i] = { col: "", op: "contains", val: "" }; s.filters[i][el.dataset.k] = el.value; s.page = 1; render_(); },
  });
  // Close any open filter popover on outside click / Escape
  app.hook({
    outsideClick(e) { let ch = false; if (!e.target.closest(".filter-pop")) for (const s of Object.values(ui.lists)) if (s.filterOpen) { s.filterOpen = false; ch = true; } return ch; },
    escape() { let ch = false; for (const s of Object.values(ui.lists)) if (s.filterOpen) { s.filterOpen = false; ch = true; } return ch; },
  });

  return { render, state, pager };
})();
