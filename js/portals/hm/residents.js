/* ==========================================================================
   Residents — Figma 238:6730 (tabs), 238:4052 (filter builder + custom tab)
   Resident profile — Figma 238:7204, refined in 293:10380
   ========================================================================== */
window.HMS = window.HMS || {};
HMS.views = HMS.views || {};

HMS.views.residents = (function () {
  const { icon, esc, kv, phoneMask } = HMS.ui;
  const D = HMS.date;
  const S = HMS.store.sel;

  const BASE_TABS = ["Bachelors", "Masters", "PhD", "Guests"];
  const COLS = {
    resident: [
      { key: "room", label: "Room No." }, { key: "roll", label: "Roll Number" }, { key: "name", label: "Name" },
      { key: "dept", label: "Department" }, { key: "program", label: "Program" }, { key: "contact", label: "Contact", fmt: phoneMask },
    ],
    guest: [
      { key: "room", label: "Room Alloted" }, { key: "name", label: "Name" }, { key: "arrival", label: "Arrival Date", fmt: D.fmt },
      { key: "departure", label: "Departure Date", fmt: D.fmt }, { key: "requestedBy", label: "Requested by" }, { key: "contact", label: "Contact", fmt: phoneMask },
    ],
  };
  const OPS = { contains: "Contains", is: "Is", not: "Is not", starts: "Starts with" };

  function applyFilters(rows, filters) {
    return rows.filter((r) => filters.every((f) => {
      if (!f.col || f.val === "") return true;
      const v = String(r[f.col] ?? "").toLowerCase(), q = String(f.val).toLowerCase();
      return f.op === "is" ? v === q : f.op === "not" ? v !== q : f.op === "starts" ? v.startsWith(q) : v.includes(q);
    }));
  }

  function rowsFor(ctx) {
    const u = ctx.ui.res;
    const custom = S.customTabs().find((t) => t.id === u.tab);
    const base = custom ? custom.base : u.tab;
    let rows = S.residentRows(base, ctx.ui.day);
    if (base === "Guests" && ctx.query.arriving) rows = rows.filter((r) => r.arrival === ctx.ui.day);
    if (base === "Guests" && ctx.query.leaving) rows = rows.filter((r) => r.departure === ctx.ui.day);
    rows = applyFilters(rows, [...(custom ? custom.filters : []), ...u.filters]);
    if (u.q) { const q = u.q.toLowerCase(); rows = rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q))); }
    const k = u.sort.key, dir = u.sort.dir;
    rows.sort((a, b) => String(a[k]).localeCompare(String(b[k]), undefined, { numeric: true }) * dir);
    return { rows, base, cols: base === "Guests" ? COLS.guest : COLS.resident };
  }

  function filterPop(ctx, cols) {
    const f = ctx.ui.res.filters.length ? ctx.ui.res.filters : [{ col: "", op: "contains", val: "" }];
    return `<div class="popover filter-pop" role="dialog" aria-label="Filter residents">
      <header><span>Where:</span><button class="link" data-act="clearFilters" style="font-size:10px">clear filters</button></header>
      <div class="filter-rows">
        ${f.map((r, i) => `<div class="filter-row">
          <select aria-label="Column" data-on-change="filterEdit" data-i="${i}" data-k="col"><option value="">Select Column</option>${cols.map((c) => `<option value="${c.key}" ${c.key === r.col ? "selected" : ""}>${c.label}</option>`).join("")}</select>
          <select aria-label="Condition" data-on-change="filterEdit" data-i="${i}" data-k="op">${Object.entries(OPS).map(([k, l]) => `<option value="${k}" ${k === r.op ? "selected" : ""}>${l}</option>`).join("")}</select>
          <input aria-label="Value" placeholder="Value" value="${esc(r.val)}" data-on-input="filterEdit" data-i="${i}" data-k="val">
          <button data-act="filterRemove" data-i="${i}" aria-label="Remove filter">${icon("x")}</button>
        </div>`).join("")}
      </div>
      <button class="filter-add" data-act="filterAdd">Add filter +</button>
      <div class="filter-foot"><button class="btn btn-secondary" data-act="saveTabPrompt">Save as tab</button><button class="btn btn-primary" data-act="closeFilter">Done</button></div>
    </div>`;
  }

  function table(ctx) {
    const u = ctx.ui.res;
    const { rows, cols } = rowsFor(ctx);
    const per = u.perPage === "All" ? rows.length || 1 : Number(u.perPage);
    const pages = Math.max(1, Math.ceil(rows.length / per));
    const page = Math.min(u.page, pages);
    const slice = rows.slice((page - 1) * per, page * per);
    if (!rows.length) return `<div class="empty"><strong>No one matches</strong>Clear the search or filters to see everyone.</div>`;
    let lastFloor = null;
    const body = slice.map((r) => {
      const fl = HMS.floorplan.parseRoom(r.room).floor;
      const brk = u.sort.key === "room" && lastFloor !== null && fl !== lastFloor ? `<tr class="floor-break" aria-hidden="true"><td colspan="${cols.length + 1}"></td></tr>` : "";
      lastFloor = fl;
      const isRecent = S.isRecentResident(r.id) || S.isRecentRoom(r.room);
      const target = r.kind === "resident" ? `#/hm/residents/${r.id}` : `#/hm/map?floor=${fl}&room=${r.room}`;
      return `${brk}<tr>
        ${cols.map((c) => {
          let val = c.fmt ? c.fmt(r[c.key]) : r[c.key];
          if (c.key === "name" && isRecent) {
            val = `${esc(val)} <span class="badge badge-teal" style="font-size:8.5px;padding:0 5px;margin-left:4px">Recent</span>`;
            return `<td>${val}</td>`;
          }
          return `<td>${esc(val)}</td>`;
        }).join("")}
        <td><div class="actions">
          <button data-act="go" data-href="${target}" aria-label="View ${esc(r.name)}">${icon("eye")}</button>
          <button data-act="${r.kind === "resident" ? "editResident" : "editGuestStay"}" data-id="${r.id}" aria-label="Edit ${esc(r.name)}">${icon("pencil")}</button>
        </div></td></tr>`;
    }).join("");
    return `<div class="table-card"><div class="table-wrap"><table class="data">
      <thead><tr>${cols.map((c) => `<th scope="col"><button class="sort-th" data-act="sortBy" data-key="${c.key}">${c.label}${u.sort.key === c.key ? icon(u.sort.dir > 0 ? "caretDown" : "caretUp") : ""}</button></th>`).join("")}<th><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${body}</tbody></table></div>
      ${HMS.list.pager(page, pages, rows.length, per, "resPageTo")}</div>`;
  }

  function render(ctx) {
    const u = ctx.ui.res;
    const { cols } = rowsFor(ctx);
    const custom = S.customTabs();
    const nFilters = u.filters.filter((f) => f.col && f.val !== "").length;
    const note = ctx.query.arriving ? "Showing guests arriving on " + D.fmt(ctx.ui.day) : ctx.query.leaving ? "Showing guests leaving on " + D.fmt(ctx.ui.day) : "";
    return `<section data-figma-node="238:6730">
      <div class="page-head"><h1 class="page-title">Residents</h1>
        <button class="btn btn-secondary" data-act="exportResidents">${icon("download")} Copy as CSV</button></div>
      <div class="toolbar">
        <div class="toolbar-left" style="position:relative">
          <button class="filter-btn" data-act="toggleFilter" aria-expanded="${u.filterOpen}">Filter ${nFilters ? `<span class="count">${nFilters}</span>` : ""}${icon("funnel")}</button>
          ${u.filterOpen ? filterPop(ctx, cols) : ""}
          ${note ? `<span class="badge badge-teal">${note}</span> <button class="link" data-act="go" data-href="#/hm/residents?tab=Guests" style="font-size:12px">Show all guests</button>` : ""}
        </div>
        <div class="toolbar-right">
          <label class="rows-label" for="perpage">Rows per page</label>
          <span class="mini-select"><select id="perpage" data-on-change="perPage">${["25", "50", "100", "All"].map((v) => `<option ${v === u.perPage ? "selected" : ""}>${v}</option>`).join("")}</select>${icon("caretDown")}</span>
          <span class="search">${icon("search")}<input class="input" type="search" placeholder="Search" value="${esc(u.q)}" data-on-input="resQ" aria-label="Search residents"></span>
        </div>
      </div>
      <div class="tabs" role="tablist">
        ${BASE_TABS.map((t) => `<button class="tab" role="tab" aria-selected="${u.tab === t}" data-act="resTab" data-tab="${t}">${t}</button>`).join("")}
        ${custom.map((t) => `<button class="tab" role="tab" aria-selected="${u.tab === t.id}" data-act="resTab" data-tab="${t.id}">${esc(t.name)}<span class="tab-x" data-act="removeTab" data-id="${t.id}" aria-label="Remove tab">${icon("x")}</span></button>`).join("")}
        <button class="tab tab-add" data-act="saveTabPrompt" aria-label="Save current view as a tab">+</button>
      </div>
      <div id="res-table">${table(ctx)}</div>
    </section>`;
  }

  /* ------------------------------ Profile ------------------------------ */
  function profile(ctx, id) {
    const r = S.resident(id);
    if (!r) return `<div class="empty"><strong>Resident not found</strong><button class="link" data-act="go" data-href="#/hm/residents">Back to residents</button></div>`;
    const status = r.room ? `<span class="badge badge-info">Occupied</span>` : `<span class="badge badge-grey">Vacated</span>`;
    const roommates = r.room ? S.occupants(r.room, ctx.ui.day).filter((o) => o.person && o.person.id !== r.id) : [];
    const hist = r.history.map((h, i) => h.type === "shift"
      ? `<li class="marker">${esc(h.note)}</li>`
      : `<li class="${i === 0 && h.type === "allotted" && r.room ? "current" : ""}">${h.type === "allotted" ? "Allotted" : "Vacated"} ${h.hostel ? esc(h.hostel) + " – " : ""}${esc(h.room)}<small>${D.fmt(h.date)} onwards</small></li>`).join("");
    return `<section data-figma-node="293:10380">
      <button class="back" data-act="back">${icon("caretLeft")} Residents</button>
      <div class="page-head">
        <h1 class="page-title">Resident<span class="sep">|</span>${r.room ? esc(r.room) : "No room"}</h1>
        <div class="profile-actions">
          <span style="font-size:12px;align-self:center">Room Status:</span> ${status}
          <button class="btn btn-secondary" data-act="editResident" data-id="${r.id}">${icon("pencil")} Edit</button>
          ${r.room ? `<button class="btn btn-secondary" data-act="go" data-href="#/hm/map?floor=${HMS.floorplan.parseRoom(r.room).floor}&room=${r.room}">${icon("door")} Show on map</button>
          <button class="btn btn-danger" data-act="vacateResident" data-id="${r.id}">Mark vacated</button>` : ""}
        </div>
      </div>
      <div class="profile">
        <div class="profile-cards">
          <div class="pcard"><h2>Personal Details</h2><div class="pgrid pgrid-3">
            ${kv("Name", esc(r.name))}${kv("Roll Number", esc(r.roll))}${kv("Email", esc(r.email))}
            ${kv("Mobile", esc(phoneMask(r.phone)))}${kv("Date of Birth", D.fmt(r.dob))}${kv("Gender", esc(r.gender))}
            ${kv("Nationality", esc(r.nationality))}${kv("Joining Date", D.fmt(r.joined))}${kv("Hostel / Room No.", "H17 – " + esc(r.room || "—"))}${kv("Mess", esc(r.mess || "—"))}
            <div style="grid-column:1/-1">${kv("Permanent Address", esc(r.homeAddress))}</div>
          </div></div>
          <div class="pcard"><h2>Academic Details</h2><div class="pgrid pgrid-3">
            ${kv("Programme", esc(r.degree) + " · " + esc(r.programGroup))}${kv("Department", esc(r.dept))}${kv("Current Semester", r.semester + (r.semester === 1 ? "st" : r.semester === 2 ? "nd" : r.semester === 3 ? "rd" : "th") + " semester")}
            ${kv("Faculty Advisor", esc(r.advisor.name))}${kv("Mentor", esc(r.mentor.name))}${kv("Expected exit", D.fmt(r.expectedExit))}
          </div></div>
          <div class="pcard"><h2>People to contact</h2><div class="pgrid">
            ${kv("Local Guardian · " + esc(r.guardian.relation), esc(r.guardian.name))}${kv("Contact Number", esc(phoneMask(r.guardian.phone)))}
            ${kv("Roommate", roommates.length ? roommates.map((o) => esc(o.person.name)).join(", ") : "Single occupancy")}${kv("Contact Number", roommates[0] ? esc(phoneMask(roommates[0].person.phone || roommates[0].person.contact)) : "—")}
            ${kv("Emergency Contact No. 1", esc(phoneMask(r.emergency[0])))}${kv("Emergency Contact No. 2", esc(phoneMask(r.emergency[1])))}
          </div></div>
          <div class="pcard"><h2>Medical Details</h2><div class="pgrid">${kv("Blood Group", esc(r.blood))}</div></div>
          <div class="pcard"><h2>Forms and guest requests</h2>${(() => {
            const fs = S.forms().filter((f) => f.residentId === r.id);
            const rq = S.requestsOf("student:" + r.id);
            if (!fs.length && !rq.length) return `<p class="muted" style="font-size:12px;margin:0">Nothing submitted yet.</p>`;
            return `<ul class="mini-list">${fs.map((f) => `<li><span>${esc(HMS.formTypes[f.type].label)} <small class="muted">· ${D.fmt(f.submittedOn)}</small></span>${HMS.shared.formBadge(f.status)}</li>`).join("")}${rq.map((q) => `<li><button class="link" data-act="viewRequest" data-id="${q.id}">Guest stay · ${esc(q.guestIds.map((g) => S.guest(g).name).join(", "))}</button> <small class="muted">${D.fmt(q.from)} – ${D.fmt(q.to)}</small>${HMS.shared.badge(q.status, true)}</li>`).join("")}</ul>`;
          })()}</div>
          <div class="pcard"><h2>Remarks</h2>
            ${r.remarks.length ? `<ul style="margin:0 0 12px;padding-left:18px;font-size:13px;line-height:1.5">${r.remarks.map((m) => `<li>${esc(m.text)} <span class="muted" style="font-size:11px">· ${D.fmt(m.date)}, ${esc(m.by)}</span></li>`).join("")}</ul>` : `<p class="muted" style="font-size:12px;margin:0 0 12px">No remarks yet. Notes you add here replace the side Excel sheets.</p>`}
            <div style="display:flex;gap:8px"><input class="input" style="flex:1" placeholder="Add a remark" id="remark-input"><button class="btn btn-primary" data-act="addRemark" data-id="${r.id}">Add remark</button></div>
          </div>
        </div>
        <aside class="history" aria-label="Occupancy history"><h2>Occupancy History</h2><ol>${hist || `<li>No history yet</li>`}</ol></aside>
      </div>
    </section>`;
  }

  return { render, profile, table, rowsFor, COLS };
})();

