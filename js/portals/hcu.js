/* ==========================================================================
   HCU Office portal — all hostels, all students, all data (IA 56:1050).
   Dashboard (all-hostel stats, capacity strips, global queue), Hostels
   (list → detail → read-only map and residents), All Residents, Requests
   (all sources, routing), Batch Management (active, upload, per person),
   Reports (occupancy, vacant, guests, extensions and overstay, history).
   ========================================================================== */
(function () {
  const S = HMS.store.sel, A = HMS.store.act, D = HMS.date, UI = HMS.ui, C = HMS.campus, SH = HMS.shared, FP = HMS.floorplan;
  const { icon, esc, kv } = UI;
  const app = HMS.app;
  const ui = app.ui;
  const render = () => app.render();
  const T = () => HMS.TODAY;
  const hostels = () => C.HOSTELS.map((h) => S.hostelStats(h.id, ui.hcu.day));

  function totals() {
    const hs = hostels();
    const sum = (k) => hs.reduce((n, h) => n + (h[k] || 0), 0);
    return { capacity: sum("capacity"), occupied: sum("occupied"), guests: sum("guests"), maint: sum("maint"), vacant: sum("vacant"), ir: sum("ir"), renovating: hs.filter((h) => h.renovating).length };
  }
  const stat = (label, value, unit, href, small) => `<div class="stat ${small ? "stat-sm" : ""}"><div class="stat-label">${label}</div><div class="stat-value"><b>${value}</b>${unit ? `<small>${unit}</small>` : ""}</div>${href ? `<button class="stat-link" data-act="go" data-href="${href}">Details ${icon("caretRight")}</button>` : ""}</div>`;

  /* ------------------------------ Dashboard ------------------------------ */
  function dashboard() {
    const t = totals();
    const q = S.requests();
    const needs = q.filter((r) => r.status === "hcu");
    const atDean = q.filter((r) => r.status === "dean").length;
    const atHm = q.filter((r) => r.status === "pending" || r.status === "accepted").length;
    const ta = S.turnaround();
    const ext = q.filter((r) => r.extension && r.extension.state === "open").length;
    return `<div class="dash">
      <section>
        <div class="dash-head"><h1>All hostels,</h1>${datePill()}</div>
        <div class="stats">
          ${stat("Total beds", t.capacity.toLocaleString("en-IN"), "Beds", "#/hcu/hostels")}
          ${stat("Residents on campus", t.occupied.toLocaleString("en-IN"), "Students", "#/hcu/residents")}
          ${stat("Free beds", t.vacant.toLocaleString("en-IN"), "Beds", "#/hcu/reports?tab=vacant")}
          ${stat("Visitors staying", t.guests, "", "#/hcu/reports?tab=guests", true)}
          ${stat("IR students", t.ir, "", "#/hcu/residents", true)}
          ${stat(t.renovating ? `Rooms in repair · ${t.renovating} wings renovating` : "Rooms in repair", t.maint, "", "#/hcu/reports?tab=occupancy", true)}
        </div>
        <div class="panel">
          <div class="panel-head"><span class="panel-icon">${icon("layers")}</span><h2>Hostel capacity</h2><span class="cap-legend"><i class="c-occ"></i>Residents<i class="c-guest"></i>Visitors<i class="c-maint"></i>Repair<i class="c-free"></i>Free</span></div>
          <div class="cap-list">${hostels().map((h) => `<button class="cap-row" data-act="go" data-href="#/hcu/hostels/${h.id}"><span class="cap-name">${esc(h.name)}<small>${esc(h.gender)}${h.renovating ? " · " + esc(h.renovating) + " renovating" : ""}</small></span>${SH.capStrip(h)}<span class="cap-free num">${h.vacant}<small> free</small></span></button>`).join("")}</div>
        </div>
      </section>
      <aside class="updates">
        <div class="panel" style="padding-top:18px">
          <div class="panel-head"><span class="panel-icon">${icon("route")}</span><h2 style="font-weight:500;font-size:16px;color:var(--body)">Needs a hostel</h2><span class="badge badge-warn">${needs.length}</span></div>
          <div class="updates-list">${needs.length ? needs.map((r) => `<article class="update"><h3>${esc(r.title)}</h3><p>${esc(r.requestedBy)} | ${r.count} ${esc(r.gender.toLowerCase())} · ${esc(SH.typeLabel(r))}</p><div class="when num">${D.fmt(r.from)} — ${D.fmt(r.to)}</div><div class="row"><button class="btn btn-primary" data-act="go" data-href="#/hcu/requests/${r.id}">${icon("route")} Pick hostel</button></div></article>`).join("") : `<div class="empty"><strong>All routed</strong>Approved requests land here.</div>`}</div>
        </div>
        <div class="pcard" style="margin-top:16px"><h2>Pipeline</h2>
          <div class="pgrid">${kv("With Dean SA", atDean)}${kv("With HCU (you)", needs.length)}${kv("With Hall Managers", atHm)}${kv("Extensions asked", ext)}</div>
          <h3 class="side-h">Average days per step</h3>
          ${SH.bars([{ label: "Dean SA", value: ta.dean, sub: ta.dean + " d" }, { label: "HCU", value: ta.hcu, sub: ta.hcu + " d" }, { label: "Hall Manager", value: ta.hm, sub: ta.hm + " d" }, { label: "End to end", value: ta.total, sub: ta.total + " d" }])}
        </div>
      </aside>
    </div>`;
  }
  function datePill() {
    return `<label class="pill-select"><span class="sr-only">Date</span><input type="date" class="pill-date" value="${ui.hcu.day}" data-on-change="hcuDay"></label>`;
  }

  /* ------------------------------ Hostels ------------------------------ */
  function hostelList() {
    return `<section><div class="page-head"><h1 class="page-title">Hostels</h1>${datePill()}</div>
      <div class="table-wrap"><table class="data"><thead><tr><th>Hostel</th><th>For</th><th>Beds</th><th>Residents</th><th>Visitors</th><th>Repair</th><th>Free</th><th>Occupancy</th><th>Pending at hostel</th></tr></thead><tbody>
      ${hostels().map((h) => `<tr class="click-row" data-act="go" data-href="#/hcu/hostels/${h.id}"><td>${esc(h.name)}${h.modelled ? ` <span class="badge badge-teal">Live</span>` : ""}${h.renovating ? ` <span class="badge badge-warn">${esc(h.renovating)}</span>` : ""}</td><td style="font-weight:400">${esc(h.gender)}</td><td>${h.capacity}</td><td>${h.occupied}</td><td>${h.guests}</td><td>${h.maint}</td><td>${h.vacant}</td><td style="min-width:160px">${SH.capStrip(h)}</td><td>${h.pending || "—"}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="muted" style="font-size:11px">Hostel 17 is fully modelled room by room. The others show headline numbers from the hostel register plus requests routed through this portal.</p></section>`;
  }

  function roMap(floor) {
    const day = ui.hcu.day;
    const col = { allotted: ["var(--room-allotted-bg)", "var(--room-allotted-stroke)"], empty: ["var(--room-empty-bg)", "var(--room-empty-stroke)"], guest: ["var(--room-guest-bg)", "var(--room-guest-stroke)"], maintenance: ["var(--room-maint-bg)", "var(--room-maint-stroke)"] };
    const c = FP.courtyard;
    const rooms = FP.SLOTS.map((s) => { const no = FP.roomNo(floor, s.idx); const st = S.roomState(no, day); return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="4.8" fill="${col[st][0]}" stroke="${col[st][1]}" ${st === "guest" ? 'stroke-dasharray="3 2"' : ""}><title>Room ${no} · ${HMS.views.map.STATES[st].label}</title></rect>`; }).join("");
    return `<svg viewBox="${FP.viewBox}" class="ro-map" role="img" aria-label="Hostel 17 floor ${floor}, read-only"><path d="${FP.outline}" fill="var(--primary-bg)" stroke="var(--primary-cta-bg)" stroke-width="2"/><rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="10" fill="#fff" stroke="var(--primary-cta-bg)" stroke-width="2"/>${FP.blocks.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4.8" fill="${b.kind === "service" ? "var(--room-service-bg)" : "var(--room-common-bg)"}"/>`).join("")}${rooms}</svg>`;
  }

  function hostelDetail(id) {
    const h = S.hostelStats(id, ui.hcu.day);
    if (!h) return `<div class="empty"><strong>Hostel not found</strong></div>`;
    const tab = ui.hcu.hTab;
    const reqs = S.requests().filter((r) => r.hostel === id).sort((a, b) => b.from.localeCompare(a.from));
    const res = id === "H17" ? S.residentRows(null, ui.hcu.day) : C.residentsOf(id);
    let body = "";
    if (tab === "map") {
      body = id === "H17" ? `<div class="ro-wrap"><div>${roMap(ui.hcu.floor)}</div><div class="floor-col">${FP.FLOORS.slice().reverse().map((f) => `<button class="floor-btn" aria-current="${f === ui.hcu.floor}" data-act="hcuFloor" data-f="${f}">${f}</button>`).join("")}</div></div>
        <div class="map-legend" style="padding-left:0;justify-content:center">${Object.entries(HMS.views.map.STATES).map(([k, s]) => `<span class="legend-item"><span class="sw" style="background:${s.bg};border-color:${s.stroke};${s.dash ? "border-style:dashed" : ""}"></span>${s.label}</span>`).join("")}</div>
        <p class="muted" style="font-size:11px;text-align:center">Read-only. Only the Hall Manager allots rooms.</p>` : `<div class="empty"><strong>No floor plan yet</strong>${esc(h.name)}'s floor plan hasn't been drawn. Hostel 17 shows how it will look.</div>`;
    } else if (tab === "residents") {
      const q = ui.hcu.hq.toLowerCase();
      const rows = res.filter((r) => !q || (r.name + r.roll + r.room).toLowerCase().includes(q));
      body = `<div class="toolbar"><span class="search">${icon("search")}<input class="input" type="search" placeholder="Search" value="${esc(ui.hcu.hq)}" data-on-input="hcuHq"></span><span class="muted" style="font-size:12px">${rows.length} residents · read-only</span></div>
        <div class="table-wrap"><table class="data"><thead><tr><th>Room</th><th>Roll</th><th>Name</th><th>Department</th><th>Programme</th></tr></thead><tbody>${rows.slice(0, 100).map((r) => `<tr><td>${esc(r.room)}</td><td>${esc(r.roll)}</td><td>${esc(r.name)}</td><td>${esc(r.dept)}</td><td>${esc(r.program)}</td></tr>`).join("")}</tbody></table></div>${rows.length > 100 ? `<p class="muted" style="font-size:12px">Showing 100 of ${rows.length}. Search to narrow down.</p>` : ""}`;
    } else {
      body = reqs.length ? requestTable(reqs) : `<div class="empty"><strong>No requests for this hostel</strong></div>`;
    }
    return `<section>
      <button class="back" data-act="go" data-href="#/hcu/hostels">${icon("caretLeft")} Hostels</button>
      <div class="page-head"><h1 class="page-title">${esc(h.name)}<span class="sep">|</span>${esc(h.gender)}</h1>${datePill()}</div>
      <div class="stats stats-6">
        ${stat("Beds", h.capacity, "", "", true)}${stat("Residents", h.occupied, "", "", true)}${stat("Visitors", h.guests, "", "", true)}${stat("Repair", h.maint, "", "", true)}${stat("Free", h.vacant, "", "", true)}${stat("Pending", h.pending || 0, "", "", true)}
      </div>
      <div class="tabs" role="tablist">${[["map", "Hostel map"], ["residents", "Residents"], ["requests", "Requests"]].map(([k, l]) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-act="hcuHTab" data-tab="${k}">${l}</button>`).join("")}</div>
      ${body}
    </section>`;
  }

  /* ------------------------------ All residents ------------------------------ */
  function residents() {
    const f = ui.hcu.res;
    let rows = f.hostel === "all" ? [...S.residentRows(null, ui.hcu.day), ...C.HOSTELS.filter((h) => !h.modelled).flatMap((h) => C.residentsOf(h.id))] : f.hostel === "H17" ? S.residentRows(null, ui.hcu.day) : C.residentsOf(f.hostel);
    if (f.prog) rows = rows.filter((r) => r.programGroup === f.prog);
    if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter((r) => (r.name + " " + r.roll + " " + r.dept).toLowerCase().includes(q)); }
    const per = 50, pages = Math.max(1, Math.ceil(rows.length / per)), page = Math.min(f.page, pages);
    const slice = rows.slice((page - 1) * per, page * per);
    return `<section>
      <div class="page-head"><h1 class="page-title">All Residents</h1><button class="btn btn-secondary" data-act="hcuExportResidents">${icon("download")} Download CSV</button></div>
      <div class="toolbar"><div class="toolbar-left">
        <span class="mini-select"><select data-on-change="hcuRes" data-k="hostel" aria-label="Hostel"><option value="all">All hostels</option>${C.HOSTELS.map((h) => `<option value="${h.id}" ${f.hostel === h.id ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</select>${icon("caretDown")}</span>
        <span class="mini-select"><select data-on-change="hcuRes" data-k="prog" aria-label="Programme"><option value="">All programmes</option>${["Bachelors", "Masters", "PhD"].map((p) => `<option ${f.prog === p ? "selected" : ""}>${p}</option>`).join("")}</select>${icon("caretDown")}</span>
      </div><span class="search">${icon("search")}<input class="input" type="search" placeholder="Name, roll or department" value="${esc(f.q)}" data-on-input="hcuRes" data-k="q"></span></div>
      <div class="table-card"><div class="table-wrap"><table class="data"><thead><tr><th>Hostel</th><th>Room</th><th>Roll</th><th>Name</th><th>Department</th><th>Programme</th></tr></thead><tbody>
        ${slice.map((r) => `<tr ${r.hostel === "H17" ? `class="click-row" data-act="hcuResident" data-id="${r.id}"` : ""}><td>${esc((C.hostel(r.hostel) || {}).name || "Hostel 17")}</td><td>${esc(r.room)}</td><td>${esc(r.roll)}</td><td>${esc(r.name)}</td><td>${esc(r.dept)}</td><td>${esc(r.program)}</td></tr>`).join("")}
      </tbody></table></div>
      ${HMS.list.pager(page, pages, rows.length, per, "hcuPageTo")}</div>
    </section>`;
  }

  /* ------------------------------ Requests ------------------------------ */
  function requestTable(list) {
    return `<div class="table-card"><div class="table-wrap"><table class="data"><thead><tr><th>ID</th><th>Request</th><th>Type</th><th>From</th><th>People</th><th>Stay</th><th>Hostel</th><th>Status</th></tr></thead><tbody>
      ${list.map((r) => `<tr class="click-row" data-act="go" data-href="#/hcu/requests/${r.id}"><td class="muted">${esc(r.id)}</td><td>${esc(r.title)}${r.extension && r.extension.state === "open" ? ` <span class="badge badge-warn">Extension</span>` : ""}</td><td style="font-weight:400">${esc(SH.typeLabel(r))}</td><td style="font-weight:400">${esc(r.requestedBy)}</td><td>${r.count} · ${esc((r.gender || "")[0] || "")}</td><td>${D.fmt(r.from)} – ${D.fmt(r.to)}</td><td>${esc(SH.hostelName(r.hostel))}</td><td>${SH.badge(r.status)}</td></tr>`).join("")}
    </tbody></table></div></div>`;
  }
  function requests() {
    const rows = S.requests().map((r) => ({ ...SH.requestRow(r), people: r.count + " · " + (r.gender || "") }));
    return `<section>
      <div class="page-head"><h1 class="page-title">Requests · all sources</h1></div>
      ${HMS.list.render({
        key: "hcuRequests", rows, defaults: { sort: { key: "from", dir: 1 } },
        tabs: [
          { id: "incoming", label: "Needs a hostel", test: (row) => row.r.status === "hcu" },
          { id: "dean", label: "With Dean SA", test: (row) => row.r.status === "dean" },
          { id: "hm", label: "With Hall Manager", test: (row) => row.r.status === "pending" || row.r.status === "accepted" },
          { id: "allotted", label: "Allotted", test: (row) => row.r.status === "allotted" },
          { id: "done", label: "Closed", test: (row) => ["completed", "rejected", "cancelled"].includes(row.r.status) },
        ],
        cols: [
          { key: "guests", label: "Request", fmt: SH.col.guests },
          { key: "requestedBy", label: "Requested by", cls: "wrap-sm" },
          { key: "type", label: "Type", cls: "wrap-sm", fmt: SH.col.muted },
          { key: "people", label: "People" },
          { key: "from", label: "Arrival", fmt: SH.col.date },
          { key: "to", label: "Departure", fmt: SH.col.date },
          { key: "hostel", label: "Hostel" },
          { key: "status", label: "Status", fmt: SH.col.reqStatus },
        ],
        rowAttrs: (row) => `data-act="go" data-href="#/hcu/requests/${row.id}"`,
        actions: (row) => row.r.status === "hcu" ? `<button class="btn btn-primary" data-act="go" data-href="#/hcu/requests/${row.id}">${icon("route")} Pick hostel</button>` : `<div class="actions"><button data-act="go" data-href="#/hcu/requests/${row.id}" aria-label="View">${icon("eye")}</button></div>`,
        empty: { title: "Nothing here" },
      })}
    </section>`;
  }

  function routePanel(r) {
    const genders = r.gender === "Mixed" ? ["Female", "Male"] : [r.gender];
    const counts = Object.fromEntries(genders.map((g) => [g, r.guestIds.filter((x) => S.guest(x).gender === g).length]));
    const choice = ui.hcu.route;
    return `<div class="pcard decision"><h2>Pick a hostel</h2>
      <p class="muted" style="font-size:12px;margin:0 0 12px">Free beds are for every night of ${D.fmt(r.from)} – ${D.fmt(r.to)}.${r.gender === "Mixed" ? " This group is mixed, so women and men go to separate hostels. The request is split in two." : ""}</p>
      ${genders.map((g) => {
        const opts = S.routeOptions(r, g);
        const cur = choice[g] || (opts.find((o) => o.free >= counts[g]) || opts[0] || {}).hostel?.id;
        choice[g] = cur;
        return `<div class="route-block"><div class="route-head"><b>${counts[g]} ${g === "Female" ? "women" : "men"}</b></div>
          <div class="route-opts">${opts.slice(0, 6).map((o) => `<button class="route-opt" aria-pressed="${cur === o.hostel.id}" data-act="hcuPick" data-g="${g}" data-h="${o.hostel.id}"><b>${esc(o.hostel.name)}</b><small>${o.free} free${o.preferred ? " · requested" : ""}${o.hostel.modelled ? " · live" : ""}</small>${o.free < counts[g] ? `<span class="badge badge-danger">Too few</span>` : ""}</button>`).join("")}</div></div>`;
      }).join("")}
      <label class="field" style="margin-top:12px"><span>Note to the Hall Manager (optional)</span><input class="input" id="hcu-note" data-on-input="hcuNote" value="${esc(ui.hcu.note)}" placeholder="e.g. Keep the group on one floor"></label>
      <div class="row-end" style="margin-top:14px"><button class="btn btn-danger btn-lg" data-act="hcuReject" data-id="${r.id}">${icon("x")} Can't place</button><button class="btn btn-primary btn-lg" data-act="hcuRoute" data-id="${r.id}">${icon("send")} Send to ${genders.map((g) => esc(C.hostel(choice[g]).name)).join(" and ")}</button></div>
    </div>`;
  }
  function requestDetail(id) {
    const r = S.request(id);
    if (!r) return `<div class="empty"><strong>Request not found</strong></div>`;
    if (ui.hcu.routeFor !== id) { ui.hcu.routeFor = id; ui.hcu.route = {}; ui.hcu.note = ""; }
    let extra = "";
    if (r.status === "hcu") extra = routePanel(r);
    else if (r.status === "pending" && r.hostel && !C.hostel(r.hostel).modelled) extra = `<div class="pcard proto"><h2>${icon("info")} Prototype note</h2><p class="muted" style="font-size:12px;margin:0 0 12px">${esc(C.hostel(r.hostel).name)}'s Hall Manager isn't part of this prototype (only Hostel 17 is). Simulate their allotment to see the rest of the flow.</p><button class="btn btn-secondary" data-act="hcuSimulate" data-id="${r.id}">${icon("play")} Simulate ${esc(C.hostel(r.hostel).name)} allotting rooms</button></div>`;
    else if (r.status === "dean") extra = `<div class="pcard"><h2>Waiting for Associate Dean SA</h2><p class="muted" style="font-size:12px;margin:0">It comes to you once approved. You can already check which hostels have room for these dates.</p></div>`;
    return `<section>
      <button class="back" data-act="go" data-href="#/hcu/requests">${icon("caretLeft")} Requests</button>
      <div class="page-head"><h1 class="page-title">Request<span class="sep">|</span>${esc(r.id)}</h1></div>
      ${SH.requestDetail(r, { extra })}
    </section>`;
  }

  /* ------------------------------ Batches ------------------------------ */
  function batches() {
    const tab = ui.hcu.bTab;
    const list = S.batches();
    const prefs = S.forms().filter((f) => f.type === "preference");
    let body;
    if (tab === "upload") body = uploadBatch();
    else if (tab === "prefs") body = prefs.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Submitted</th><th>Student</th><th>Choices</th><th>Status</th><th></th></tr></thead><tbody>${prefs.map((f) => { const r = S.resident(f.residentId); return `<tr><td>${D.fmt(f.submittedOn)}</td><td>${esc(r.name)} · ${esc(r.roll)}</td><td style="font-weight:400">${esc(HMS.formTypes.preference.summary(f.data))}</td><td>${SH.formBadge(f.status)}</td><td>${f.status === "submitted" ? `<button class="btn btn-primary" data-act="hcuPref" data-id="${f.id}">Noted</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty"><strong>No hostel preference forms</strong>First-year students fill these at the start of their programme.</div>`;
    else body = list.map((b) => {
      const housed = b.people.filter((p) => p.residentId ? S.resident(p.residentId)?.room : p.hostel !== "H17").length;
      return `<article class="batch" ${b.people.length ? `data-act="hcuBatch" data-id="${b.id}" role="button" tabindex="0"` : ""}>
        <div><div class="req-kind">Uploaded ${D.fmt(b.uploadedOn)}</div><h3>${esc(b.name)}</h3><p class="muted">${b.closed ? esc(b.summary) : `${b.people.length} students · ${[...new Set(b.people.map((p) => p.hostel))].map((h) => C.hostel(h).name).join(", ")}`}</p></div>
        ${b.closed ? `<span class="badge badge-grey">Closed</span>` : `<span class="badge ${housed === b.people.length ? "badge-teal" : "badge-warn"}">${housed}/${b.people.length} allotted</span>`}
      </article>`;
    }).join("");
    return `<section>
      <div class="page-head"><h1 class="page-title">Batch Management</h1><button class="btn btn-primary btn-lg" data-act="hcuBTab" data-tab="upload">${icon("upload")} Upload new batch</button></div>
      <div class="tabs" role="tablist">${[["active", "Active Batches"], ["upload", "Upload New Batch"], ["prefs", "Hostel preferences"]].map(([k, l]) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-act="hcuBTab" data-tab="${k}">${l}</button>`).join("")}</div>
      ${body}
    </section>`;
  }
  function uploadBatch() {
    const b = ui.hcu.batch;
    return `<div class="form-layout"><div class="form-main">
      <section class="fsec"><div class="fsec-head"><span class="fsec-no">1</span><div><h2>Batch name</h2></div></div><input class="input" style="width:100%" value="${esc(b.name)}" data-on-input="hcuBatchName" placeholder="e.g. Autumn 2026 · PhD round 2"></section>
      <section class="fsec"><div class="fsec-head"><span class="fsec-no">2</span><div><h2>Student list</h2><p>One student per line: name, roll, gender, programme, department. Or upload the admission office's CSV.</p></div></div>
        <textarea class="input" rows="6" style="width:100%" data-on-input="hcuBatchText" placeholder="Meher Kaur, 26M2401, F, M.Des., IDC&#10;Arnav Shah, 26M2402, M, M.Tech., CSE">${esc(b.text)}</textarea>
        <div class="editor-actions"><label class="btn btn-secondary file-btn">${icon("upload")} Upload CSV<input type="file" accept=".csv,.txt" data-on-change="hcuBatchFile" hidden></label><button class="btn btn-secondary" data-act="hcuBatchSample">Fill sample list</button></div></section>
      <section class="fsec"><div class="fsec-head"><span class="fsec-no">3</span><div><h2>Hostel assignment</h2><p>Suggested by gender and free beds. Change any row before sending.</p></div></div>
        ${b.rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Roll</th><th>Gender</th><th>Programme</th><th>Department</th><th>Hostel</th></tr></thead><tbody>${b.rows.map((p, i) => `<tr><td>${esc(p.name)}</td><td>${esc(p.roll)}</td><td>${esc(p.gender)}</td><td>${esc(p.programme)}</td><td>${esc(p.dept)}</td><td><select class="select-input" data-on-change="hcuBatchHostel" data-i="${i}">${C.HOSTELS.filter((h) => h.gender === p.gender || h.gender === "Mixed").map((h) => `<option value="${h.id}" ${p.hostel === h.id ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty" style="padding:18px">Add students above to see suggestions.</div>`}
      </section></div>
      <aside class="form-side"><div class="pcard sticky"><h2>Summary</h2>
        ${b.rows.length ? SH.bars(Object.entries(b.rows.reduce((m, p) => ((m[p.hostel] = (m[p.hostel] || 0) + 1), m), {})).map(([h, n]) => ({ label: C.hostel(h).name, value: n }))) : `<p class="muted" style="font-size:12px">No students yet.</p>`}
        <p class="muted" style="font-size:11px">Each Hall Manager gets a notification and sees the students under Actions → Batch operations.</p>
        <button class="btn btn-primary btn-lg block" data-act="hcuBatchSend" ${b.rows.length && b.name.trim() ? "" : "disabled"}>${icon("send")} Send to hostels</button></div></aside></div>`;
  }
  function suggestHostels(rows) {
    const load = {};
    return rows.map((p) => {
      const opts = C.HOSTELS.filter((h) => h.gender === p.gender).map((h) => ({ id: h.id, free: S.hostelFreeBetween(h.id, T(), D.add(T(), 30)) - (load[h.id] || 0) })).sort((a, b) => b.free - a.free);
      const pick = p.programme && /Des/.test(p.programme) && p.gender === "Female" ? "H17" : opts[0]?.id;
      load[pick] = (load[pick] || 0) + 1;
      return { ...p, hostel: pick };
    });
  }
  function parseBatch(text) {
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).filter((l) => !/^name\s*,/i.test(l)).map((l) => {
      const [name, roll, g, programme, dept] = l.split(/[,\t;]/).map((x) => (x || "").trim());
      const prog = programme || "M.Tech.";
      return { name, roll: roll || "—", gender: /^m/i.test(g) ? "Male" : "Female", programme: prog, programGroup: /Ph\.?D/i.test(prog) ? "PhD" : /^B/.test(prog) ? "Bachelors" : "Masters", dept: dept || "—" };
    }).filter((p) => p.name);
  }

  /* ------------------------------ Reports ------------------------------ */
  function reports() {
    const tab = ui.hcu.repTab;
    const day = ui.hcu.day;
    const hs = hostels();
    const reqs = S.requests();
    const TABS = [["occupancy", "Occupancy"], ["vacant", "Vacant rooms"], ["guests", "Guest accommodation"], ["extensions", "Extensions and overstay"], ["history", "Request history"]];
    let body = "";
    if (tab === "occupancy") body = `<div class="pcard"><h2>Occupancy by hostel · ${D.fmt(day)}</h2>${SH.bars(hs.map((h) => ({ label: h.name, value: h.occupied + h.guests, max: h.capacity, sub: Math.round(((h.occupied + h.guests) / h.capacity) * 100) + "%", href: "#/hcu/hostels/" + h.id })))}</div>`;
    else if (tab === "vacant") body = `<div class="table-wrap"><table class="data"><thead><tr><th>Hostel</th><th>For</th><th>Free today</th><th>Free next 7 nights</th><th>Free next 30 nights</th></tr></thead><tbody>${hs.map((h) => `<tr><td>${esc(h.name)}</td><td style="font-weight:400">${esc(h.gender)}</td><td>${h.vacant}</td><td>${S.hostelFreeBetween(h.id, day, D.add(day, 6))}</td><td>${S.hostelFreeBetween(h.id, day, D.add(day, 29))}</td></tr>`).join("")}</tbody></table></div>`;
    else if (tab === "guests") { const list = reqs.filter((r) => r.status === "allotted" && D.overlaps(r.from, r.to, day)); body = list.length ? requestTable(list) : `<div class="empty"><strong>No visitors on ${D.fmt(day)}</strong></div>`; }
    else if (tab === "extensions") {
      const ext = reqs.filter((r) => r.extension || (r.timeline || []).some((e) => e.act === "extension"));
      const over = reqs.filter((r) => r.status === "allotted" && r.to < day);
      body = `<h2 class="sec-title">Extensions <span class="muted">${ext.length}</span></h2>${ext.length ? requestTable(ext) : `<div class="empty">No extensions asked.</div>`}
        <h2 class="sec-title">Overstaying <span class="muted">${over.length}</span></h2>${over.length ? requestTable(over) : `<div class="empty">No one past their departure date.</div>`}
        <p class="muted" style="font-size:11px">Before, extensions were agreed at the hostel desk and HCU never heard. Now every extension is asked and approved in the portal.</p>`;
    } else {
      const done = reqs.filter((r) => r.status !== "dean" && r.status !== "hcu");
      body = `<div class="table-wrap"><table class="data"><thead><tr><th>Request</th><th>From</th><th>Submitted</th><th>Dean SA</th><th>HCU</th><th>Hall Manager</th><th>Total days</th><th>Status</th></tr></thead><tbody>${done.map((r) => {
        const at = (a, role) => ((r.timeline || []).find((e) => e.act === a && (!role || e.role === role)) || {}).at;
        const sub = at("submitted"), dn = at("approved", "dean") || at("partial", "dean"), ro = at("routed"), al = at("allotted");
        const d = (a, b) => (a && b ? D.days(a, b) + " d" : "—");
        return `<tr class="click-row" data-act="go" data-href="#/hcu/requests/${r.id}"><td>${esc(r.title)}</td><td style="font-weight:400">${esc(r.requestedBy)}</td><td>${D.fmt(sub)}</td><td>${d(sub, dn)}</td><td>${d(dn || sub, ro)}</td><td>${d(ro, al)}</td><td>${d(sub, al)}</td><td>${SH.badge(r.status)}</td></tr>`;
      }).join("")}</tbody></table></div>`;
    }
    return `<section>
      <div class="page-head"><h1 class="page-title">Reports</h1><div class="toolbar-right">${datePill()}<button class="btn btn-secondary" data-act="hcuExportReport">${icon("download")} Download CSV</button></div></div>
      <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-act="hcuRepTab" data-tab="${k}">${l}</button>`).join("")}</div>
      ${body}
    </section>`;
  }

  function settings() {
    return `<section><div class="page-head"><h1 class="page-title">Settings</h1></div>
      <div class="report-grid">
        <div class="pcard"><h2>Campus-wide notice</h2><p class="muted" style="font-size:12px;margin:0 0 12px">Shows on every student's home page in every hostel.</p><button class="btn btn-primary" data-act="hcuNotice">${icon("megaphone")} Post a notice</button></div>
        <div class="pcard"><h2>Approval rules</h2><ul class="mini-list">${Object.values(C.TYPES).filter((t) => t.source !== "hall-manager").map((t) => `<li><span>${esc(t.label)}</span><span class="badge ${t.dean ? "badge-warn" : "badge-teal"}">${t.dean ? "Dean SA first" : "Straight to HCU"}</span></li>`).join("")}</ul></div>
        <div class="pcard"><h2>Demo data</h2><p class="muted" style="font-size:12px;margin:0 0 12px">Put every portal back to the starting sample data.</p><button class="btn btn-secondary" data-act="resetDemo">Reset demo data</button></div>
      </div></section>`;
  }

  /* ------------------------------ Handlers ------------------------------ */
  const csv = (rows, cols, name) => { UI.download(name + ".csv", UI.csv(rows, cols)); UI.toast("Downloaded " + name + ".csv"); };
  const handlers = {
    hcuDay: (el) => { if (el.value) ui.hcu.day = el.value; render(); },
    hcuFloor: (el) => { ui.hcu.floor = Number(el.dataset.f); render(); },
    hcuHTab: (el) => { ui.hcu.hTab = el.dataset.tab; render(); },
    hcuHq: (el) => { ui.hcu.hq = el.value; render(); },
    hcuRes: (el) => { ui.hcu.res[el.dataset.k] = el.value; ui.hcu.res.page = 1; render(); },
    hcuPageTo: (el) => { ui.hcu.res.page = Number(el.dataset.p); render(); },
    hcuPage: (el) => { ui.hcu.res.page = Math.max(1, ui.hcu.res.page + Number(el.dataset.d)); render(); },
    hcuResident: (el) => {
      const r = S.resident(el.dataset.id);
      app.openDialog({ kind: "drawer", view: () => `<div class="drawer-head"><div><div class="req-kind">Hostel 17 · ${esc(r.room || "no room")}</div><h2 class="modal-title" style="padding:0">${esc(r.name)}</h2></div><button class="icon-btn" data-act="closeLayer" aria-label="Close">${icon("x")}</button></div>
        <div class="drawer-body"><div class="pgrid">${kv("Roll", esc(r.roll))}${kv("Programme", esc(r.degree))}${kv("Department", esc(r.dept))}${kv("Semester", r.semester)}${kv("Joined", D.fmt(r.joined))}${kv("Expected exit", D.fmt(r.expectedExit))}</div>
        <h3 class="drawer-h">Occupancy history</h3><ul class="mini-list">${r.history.map((h) => `<li><span>${h.type === "shift" ? esc(h.note) : (h.type === "allotted" ? "Allotted " : "Vacated ") + esc(h.room)}</span><small class="muted">${D.fmt(h.date)}</small></li>`).join("")}</ul>
        <p class="muted" style="font-size:11px;margin-top:14px">Read-only. The Hall Manager edits resident records.</p></div>` });
    },
    hcuExportResidents: () => {
      const f = ui.hcu.res;
      const rows = f.hostel === "all" ? [...S.residentRows(null, ui.hcu.day), ...C.HOSTELS.filter((h) => !h.modelled).flatMap((h) => C.residentsOf(h.id))] : f.hostel === "H17" ? S.residentRows(null, ui.hcu.day) : C.residentsOf(f.hostel);
      csv(rows.map((r) => ({ ...r, hostel: r.hostel || "H17" })), [{ key: "hostel", label: "Hostel" }, { key: "room", label: "Room" }, { key: "roll", label: "Roll" }, { key: "name", label: "Name" }, { key: "dept", label: "Department" }, { key: "program", label: "Programme" }], "residents");
    },
    hcuPick: (el) => { ui.hcu.route[el.dataset.g] = el.dataset.h; render(); },
    hcuNote: (el) => { ui.hcu.note = el.value; },
    hcuRoute: (el) => {
      const r = S.request(el.dataset.id);
      const assign = { ...ui.hcu.route };
      const genders = r.gender === "Mixed" ? ["Female", "Male"] : [r.gender];
      for (const g of genders) if (!assign[g]) return UI.toast("Pick a hostel for every group.");
      for (const k of Object.keys(assign)) if (!genders.includes(k)) delete assign[k];
      const sent = A.routeRequest(r.id, assign, ui.hcu.note.trim());
      ui.hcu.routeFor = null;
      app.go("#/hcu/requests");
      UI.toast(`Sent to ${sent.map((x) => C.hostel(x.hostel).name).join(" and ")}. The Hall Manager${sent.length > 1 ? "s were" : " was"} notified.`);
    },
    hcuReject: (el) => {
      const r = S.request(el.dataset.id);
      app.form("Can't place “" + r.title + "”?", `<label class="field"><span>Reason (sent to ${esc(r.requestedBy)})</span><textarea class="input" name="reason" rows="3" placeholder="e.g. All women's hostels full for these dates. Try after 20 Oct."></textarea></label>`, "Send",
        (v) => { if (!v.reason.trim()) return "Add a reason."; A.hcuReject(r.id, v.reason.trim()); setTimeout(() => app.go("#/hcu/requests"), 0); UI.toast("Requester told"); }, { danger: true });
    },
    hcuSimulate: (el) => { A.simulateExternalAllot(el.dataset.id); render(); UI.toast("Simulated. The requester now sees room numbers."); },
    hcuBTab: (el) => { ui.hcu.bTab = el.dataset.tab; render(); },
    hcuBatch: (el) => {
      const b = S.batches().find((x) => x.id === el.dataset.id);
      app.openDialog({ kind: "wide", view: () => `<div class="modal-head"><h2 class="modal-title">${esc(b.name)}</h2></div><div class="modal-body"><div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Roll</th><th>Programme</th><th>Hostel</th><th>Status</th></tr></thead><tbody>
        ${b.people.map((p) => { const r = p.residentId && S.resident(p.residentId); const st = r ? (r.room ? `<span class="badge badge-teal">Room ${r.room}</span>` : `<span class="badge badge-warn">Waiting for room</span>`) : `<span class="badge badge-grey">Sent to hostel</span>`; return `<tr><td>${esc(p.name)}</td><td>${esc(p.roll)}</td><td>${esc(p.programme)}</td><td>${esc(C.hostel(p.hostel).name)}</td><td>${st}</td></tr>`; }).join("")}
        </tbody></table></div></div><div class="modal-foot"><button class="btn btn-secondary" data-act="closeLayer">Close</button></div>` });
    },
    hcuBatchName: (el) => { ui.hcu.batch.name = el.value; render(); },
    hcuBatchText: (el) => { ui.hcu.batch.text = el.value; ui.hcu.batch.rows = suggestHostels(parseBatch(el.value)); render(); },
    hcuBatchFile: (el) => { const f = el.files && el.files[0]; if (!f) return; f.text().then((t) => { ui.hcu.batch.text = t; ui.hcu.batch.rows = suggestHostels(parseBatch(t)); if (!ui.hcu.batch.name) ui.hcu.batch.name = f.name.replace(/\.\w+$/, ""); render(); }); },
    hcuBatchSample: () => { const t = "Meher Kaur, 26M2401, F, M.Des., IDC\nAnvita Rao, 26M2405, F, M.Des., IDC\nArnav Shah, 26M2402, M, M.Tech., CSE\nIshaan Gupta, 26D0510, M, Ph.D., Physics\nSara Thomas, 26D0514, F, Ph.D., Chemistry"; ui.hcu.batch.text = t; ui.hcu.batch.rows = suggestHostels(parseBatch(t)); if (!ui.hcu.batch.name) ui.hcu.batch.name = "Autumn 2026 · late admissions (round 4)"; render(); },
    hcuBatchHostel: (el) => { ui.hcu.batch.rows[Number(el.dataset.i)].hostel = el.value; render(); },
    hcuBatchSend: () => {
      const b = ui.hcu.batch;
      const sent = A.uploadBatch(b.name.trim(), b.rows);
      const h17 = sent.people.filter((p) => p.hostel === "H17").length;
      ui.hcu.batch = { name: "", text: "", rows: [] }; ui.hcu.bTab = "active";
      render();
      UI.toast(`Sent ${sent.people.length} students to their hostels.${h17 ? ` ${h17} for Hostel 17 now show on its Hall Manager's Actions page.` : ""}`);
    },
    hcuPref: (el) => { A.decideForm(el.dataset.id, true, "Noted for allotment."); UI.toast("Noted. The student has been told."); },
    hcuRepTab: (el) => { ui.hcu.repTab = el.dataset.tab; render(); },
    hcuExportReport: () => {
      const tab = ui.hcu.repTab; const hs = hostels();
      if (tab === "occupancy" || tab === "vacant") csv(hs, [{ key: "name", label: "Hostel" }, { key: "gender", label: "For" }, { key: "capacity", label: "Beds" }, { key: "occupied", label: "Residents" }, { key: "guests", label: "Visitors" }, { key: "maint", label: "Repair" }, { key: "vacant", label: "Free" }], "hostel-" + tab);
      else csv(S.requests().map((r) => ({ ...r, type: SH.typeLabel(r), hostel: SH.hostelName(r.hostel) })), [{ key: "id", label: "ID" }, { key: "title", label: "Request" }, { key: "type", label: "Type" }, { key: "requestedBy", label: "From" }, { key: "count", label: "People" }, { key: "from", label: "Arrival" }, { key: "to", label: "Departure" }, { key: "hostel", label: "Hostel" }, { key: "status", label: "Status" }], "requests");
    },
    hcuNotice: () => app.form("Campus-wide notice", `<label class="field"><span>Title</span><input class="input" name="title" autofocus></label><label class="field"><span>Notice</span><textarea class="input" name="body" rows="4"></textarea></label>`, "Post to all hostels",
      (v) => { if (!v.title.trim() || !v.body.trim()) return "Add a title and the notice."; A.postNotice("all", v.title.trim(), v.body.trim(), "HCU Office"); UI.toast("Posted to every hostel"); }),
  };

  const TITLES = { dashboard: "Dashboard", hostels: "Hostels", residents: "All Residents", requests: "Requests", batches: "Batches", reports: "Reports", settings: "Settings" };
  app.portal({
    id: "hcu",
    defaultPath: "dashboard",
    nav: [["dashboard", "Dashboard"], ["hostels", "Hostels"], ["residents", "Residents"], ["requests", "Requests"], ["batches", "Batches"], ["reports", "Reports"]],
    settings: true,
    title: (r) => TITLES[r.path] || "HCU",
    init(u) {
      u.hcu = { day: HMS.TODAY, floor: 3, hTab: "map", hq: "", res: { hostel: "all", prog: "", q: "", page: 1 }, rTab: "incoming", rq: "", route: {}, routeFor: null, note: "", bTab: "active", batch: { name: "", text: "", rows: [] }, repTab: "occupancy" };
    },
    onRoute(route, prev, u) {
      if (route.query.tab && route.path === "reports") u.hcu.repTab = route.query.tab;
      if (route.path === "hostels" && route.id && prev.id !== route.id) u.hcu.hTab = "map";
    },
    render(route) {
      switch (route.path) {
        case "hostels": return route.id ? hostelDetail(route.id) : hostelList();
        case "residents": return residents();
        case "requests": return route.id ? requestDetail(route.id) : requests();
        case "batches": return batches();
        case "reports": return reports();
        case "settings": return settings();
        default: return dashboard();
      }
    },
    handlers,
  });
})();
