/* ==========================================================================
   Hall Manager · Bookings & Requests — Figma 238:4593 (All), 238:4993 (Student)
   Clean guest booking dialog with host selection from students/groups,
   clean stacked fields without side-scrolling, and auto-notification.
   ========================================================================== */
window.HMS = window.HMS || {};
HMS.views = HMS.views || {};

HMS.views.requests = (function () {
  const { icon, esc, kv, phoneMask } = HMS.ui;
  const D = HMS.date;
  const S = HMS.store.sel;
  const SH = HMS.shared;

  const open = (r) => r.status === "pending" || r.status === "accepted";
  const TABS = [
    { id: "todo", label: "To do", test: (row) => open(row.r) },
    { id: "allotted", label: "Allotted", test: (row) => row.r.status === "allotted" },
    { id: "past", label: "Past", test: (row) => ["completed", "rejected", "cancelled"].includes(row.r.status) },
    { id: "all", label: "All", test: () => true },
  ];
  const FORM_TABS = [
    { id: "waiting", label: "Waiting", test: (row) => row.f.status === "submitted" },
    { id: "decided", label: "Decided", test: (row) => row.f.status !== "submitted" },
  ];

  function nextAction(r) {
    if (r.status === "pending") return `<button class="btn btn-primary" data-act="acceptRequest" data-id="${r.id}">${icon("check")} Accept</button>`;
    if (r.status === "accepted") return `<button class="btn btn-primary" data-act="allotFromRequest" data-id="${r.id}">${icon("door")} Allot</button>`;
    return "";
  }

  function requestsList() {
    const rows = S.hostelRequests("H17").map((r) => ({
      ...SH.requestRow(r, true),
      source: r.source === "student" ? "Student (Online)" : r.type === "direct" ? "Direct Booking" : "Via HCU",
    }));
    return HMS.list.render({
      key: "hmRequests", tabs: TABS, rows, defaults: { sort: { key: "from", dir: 1 } },
      cols: [
        { key: "guests", label: "Guests", fmt: SH.col.guests },
        { key: "requestedBy", label: "Host / Requested by", cls: "wrap-sm" },
        { key: "type", label: "Type", cls: "wrap-sm", fmt: (v, row) => row.r.type === "direct" ? `<span class="badge badge-teal" style="font-size:9px">Direct Booking</span>` : SH.col.muted(v) },
        { key: "from", label: "Arrival", fmt: SH.col.date },
        { key: "to", label: "Departure", fmt: SH.col.date },
        { key: "days", label: "Days" },
        ...(HMS.list.state("hmRequests").tab === "todo" ? [] : [{ key: "rooms", label: "Room", fmt: (v) => esc(v || "—") }]),
        {
          key: "status",
          label: "Status",
          fmt: (v, row) => {
            const isRecent = row.r.isRecent || row.r.recentlyAdded;
            const isPending = row.r.status === "pending";
            let html = "";
            if (isRecent) html += `<span class="badge badge-teal" style="font-weight:700;font-size:9.5px;margin-right:4px">Recently Added</span>`;
            if (isPending) html += `<span class="badge badge-warn" style="font-weight:700;font-size:9.5px">Pending</span>`;
            else if (!isRecent) html += SH.col.staffStatus(v, row);
            return html || SH.col.staffStatus(v, row);
          },
        },
      ],
      rowAttrs: (row) => `data-act="viewRequest" data-id="${row.id}"`,
      actions: (row) => `<div class="actions"><button data-act="viewRequest" data-id="${row.id}" aria-label="View">${icon("eye")}</button>${nextAction(row.r)}</div>`,
      empty: { title: "Nothing to do", body: "New guest bookings and student requests appear here." },
    });
  }

  function formsList() {
    const rows = S.forms().filter((f) => f.hostel === "H17" && HMS.formTypes[f.type].to === "hm").map((f) => {
      const r = S.resident(f.residentId); const L = HMS.formTypes[f.type];
      return { id: f.id, f, submittedOn: f.submittedOn, form: L.label, name: r ? r.name : "Resident", room: (r && r.room) || "—", details: L.summary(f.data, r), status: f.status === "submitted" ? "Waiting" : f.status === "approved" ? "Approved" : "Not approved", residentId: r ? r.id : "" };
    });
    return HMS.list.render({
      key: "hmForms", tabs: FORM_TABS, rows, defaults: { sort: { key: "submittedOn", dir: -1 } },
      cols: [
        { key: "submittedOn", label: "Submitted", fmt: SH.col.date },
        { key: "form", label: "Form" },
        { key: "name", label: "Resident" },
        { key: "room", label: "Room" },
        { key: "details", label: "Details", cls: "wrap", fmt: SH.col.muted },
        { key: "status", label: "Status", fmt: (v, row) => SH.formBadge(row.f.status) },
      ],
      rowAttrs: (row) => `data-act="go" data-href="#/hm/residents/${row.residentId}"`,
      actions: (row) => row.f.status === "submitted" ? `<div class="actions"><button class="btn btn-secondary" data-act="decideFormHm" data-id="${row.id}" data-ok="0">Reject</button><button class="btn btn-primary" data-act="decideFormHm" data-id="${row.id}" data-ok="1">Approve</button></div>` : "",
      empty: { title: "No forms", body: "Room retention, vacation, room change and mess forms from residents land here." },
    });
  }

  function render(ctx) {
    const view = ctx.ui.book.view;
    const nForms = S.forms().filter((f) => f.hostel === "H17" && f.status === "submitted" && HMS.formTypes[f.type].to === "hm").length;
    const nTodo = S.hostelRequests("H17").filter(open).length;
    return `<section data-figma-node="238:4052 / 293:10039">
      <div class="page-head">
        <div>
          <h1 class="page-title">Bookings &amp; Requests</h1>
          <p class="muted" style="font-size:12px;margin:2px 0 0">Guest bookings, student requests, and resident forms.</p>
        </div>
        <div class="toolbar-right">
          <div class="seg" role="tablist" aria-label="What to show">
            <button role="tab" aria-pressed="${view !== "forms"}" data-act="bookView" data-v="requests">Guest stays${nTodo ? ` <span class="count-dot">${nTodo}</span>` : ""}</button>
            <button role="tab" aria-pressed="${view === "forms"}" data-act="bookView" data-v="forms">Student forms${nForms ? ` <span class="count-dot">${nForms}</span>` : ""}</button>
          </div>
          <button class="btn btn-primary btn-lg" data-act="newGuestBooking">${icon("plus")} Add guest</button>
        </div>
      </div>
      ${view === "forms" ? formsList() : requestsList()}
    </section>`;
  }

  function drawer(id) {
    const r = S.request(id);
    const guests = r.guestIds.map((gid) => S.guest(gid));
    const stays = S.requestStays(r.id);
    const roomOf = (gid) => (stays.find((s) => s.personId === gid) || {}).room;
    return `<div class="drawer-head">
        <div><div class="req-kind">${esc(SH.typeLabel(r))} · ${esc(r.id)}</div><h2 class="modal-title" style="padding:0">${esc(r.title)}</h2></div>
        <button class="icon-btn" data-act="closeLayer" aria-label="Close">${icon("x")}</button>
      </div>
      <div class="drawer-body">
        <p>${SH.badge(r.status, true)}</p>
        ${SH.stepper(r)}
        <div class="pgrid" style="margin:14px 0 18px">
          ${kv("Requested by", esc(r.requestedBy) + (r.requesterRoll ? " · " + esc(r.requesterRoll) : ""))}${kv("Requested on", D.fmt(r.requestedOn))}
          ${kv("From", D.fmt(r.from))}${kv("To", D.fmt(r.to))}
          ${kv("Days", D.days(r.from, r.to) + 1)}${kv("Contact Number", esc(phoneMask(r.contact)))}
        </div>
        ${kv("Comments", esc(r.comments || "—"), "comments")}
        ${r.deanNote ? `<div style="margin-top:12px">${kv("Associate Dean SA", esc(r.deanNote), "comments")}</div>` : ""}
        ${r.rejectReason ? `<div class="warn-line">Rejected: ${esc(r.rejectReason)}</div>` : ""}
        ${r.documents && r.documents.length ? `<h3 class="drawer-h">Documents</h3><ul class="docs">${r.documents.map((d) => `<li>${icon("file")} <span>${esc(d)}</span></li>`).join("")}</ul>` : ""}
        <h3 class="drawer-h">Guests (${guests.length})</h3>
        ${guests.length ? `<table class="data"><thead><tr><th>Name</th><th>Relation</th><th>Room</th></tr></thead><tbody>
          ${guests.map((g) => `<tr><td>${esc(g.name)}</td><td style="font-weight:400">${esc(g.relation || "—")}</td><td>${roomOf(g.id) ? `<button class="link" data-act="go" data-href="#/hm/map?floor=${HMS.floorplan.parseRoom(roomOf(g.id)).floor}&room=${roomOf(g.id)}">${roomOf(g.id)}</button>` : `<span class="muted">Not allotted</span>`}</td></tr>`).join("")}
        </tbody></table>` : `<p class="muted" style="font-size:12px">No guest list attached.</p>`}
        <h3 class="drawer-h">History</h3>
        ${SH.timeline(r)}
      </div>
      <div class="drawer-foot">
        ${r.status === "pending" ? `<button class="btn btn-danger btn-lg" data-act="rejectRequest" data-id="${r.id}">${icon("x")} Reject</button><button class="btn btn-primary btn-lg" data-act="acceptRequest" data-id="${r.id}">${icon("check")} Accept</button>` : ""}
        ${r.status === "accepted" ? `<button class="btn btn-primary btn-lg" data-act="allotFromRequest" data-id="${r.id}">${icon("door")} Allot rooms on map</button>` : ""}
        ${r.status === "allotted" ? `<button class="btn btn-secondary btn-lg" data-act="editRequestDates" data-id="${r.id}">${icon("pencil")} Change dates</button>` : ""}
      </div>`;
  }

  /** Clean, vertical Add Guest Dialog — No tabs, No side scrolling, Autonotified */
  function bookDialog(ctx, draft) {
    const freeRooms = S.freeRoomsBetween(draft.from || ctx.ui.day, draft.to || D.add(draft.from || ctx.ui.day, 2));
    const residents = (S.raw().residents || []).filter((r) => r.room).sort((a, b) => a.name.localeCompare(b.name));
    const guests = draft.guests && draft.guests.length ? draft.guests : [{ name: "", contact: "", gender: "Female", relation: "Guest" }];

    const GROUPS = [
      { id: "group:office", label: "Hostel 17 Office / Hall Manager (Direct)" },
      { id: "group:idc", label: "Department of IDC School of Design" },
      { id: "group:cse", label: "Department of Computer Science & Engg." },
      { id: "group:deansa", label: "Dean of Student Affairs (SA) Office" },
      { id: "group:ircc", label: "IRCC Research Visitor" },
      { id: "group:council", label: "Hostel Student Council / Techfest" },
      { id: "custom", label: "— Other / Custom Host Name —" },
    ];

    const hostVal = draft.hostId || (residents[0] ? `student:${residents[0].id}` : "group:office");
    const isCustomHost = hostVal === "custom" || draft.isCustomHost;

    return `<div class="modal-head" style="border-bottom:1px solid var(--light-stroke);padding:18px 24px">
        <div>
          <h2 class="modal-title" style="padding:0;font-size:18px">Add Guest</h2>
          <p class="muted" style="font-size:12px;margin:2px 0 0">Book a guest stay under an existing resident student or campus group.</p>
        </div>
        <button class="icon-btn" data-act="closeLayer" aria-label="Close">${icon("x")}</button>
      </div>
      <div class="modal-body" style="padding:20px 24px;max-height:calc(85vh - 130px);overflow-y:auto;overflow-x:hidden">
        
        <!-- Section 1: Host Student or Group -->
        <div style="margin-bottom:18px">
          <label class="field" style="margin-bottom:8px">
            <span style="font-weight:600;color:var(--body)">Host Student / Inviting Group</span>
            <select class="select-input" id="draft-host-select" data-on-change="draftHostSelect" style="height:36px;font-size:13px">
              <optgroup label="Hostel 17 Resident Students">
                ${residents.map((r) => `<option value="student:${r.id}" ${hostVal === "student:" + r.id ? "selected" : ""}>${esc(r.name)} (${esc(r.roll)} · Room ${esc(r.room)})</option>`).join("")}
              </optgroup>
              <optgroup label="Departments &amp; Campus Groups">
                ${GROUPS.map((g) => `<option value="${g.id}" ${hostVal === g.id ? "selected" : ""}>${esc(g.label)}</option>`).join("")}
              </optgroup>
            </select>
          </label>
          ${isCustomHost ? `
            <label class="field" style="margin-top:8px">
              <span>Custom Host Name / Designation</span>
              <input class="input" id="draft-custom-host" placeholder="e.g. Prof. Arvind Kumar / Physics Dept" value="${esc(draft.customHostName || "")}" data-on-input="draftCustomHostInput">
            </label>` : ""}
        </div>

        <!-- Section 2: Guest Details (Stacked vertically with no horizontal scrolling) -->
        <div style="margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <span style="font-size:13px;font-weight:600;color:var(--body)">Guest Details (${guests.length})</span>
            <button class="link" data-act="draftAddGuestRow" style="font-size:12px;display:inline-flex;align-items:center;gap:4px">
              ${icon("plus")} Add another guest
            </button>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px">
            ${guests.map((g, i) => `
              <div style="background:var(--primary-bg);border:1px solid var(--light-stroke);border-radius:10px;padding:14px 16px;position:relative">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                  <strong style="font-size:12px;color:var(--primary-cta-bg)">Guest ${i + 1}</strong>
                  ${guests.length > 1 ? `<button class="link link-danger" data-act="draftRemoveGuestRow" data-i="${i}" style="font-size:11px">${icon("x")} Remove</button>` : ""}
                </div>

                <div style="margin-bottom:10px;background:#fff;border:1px dashed var(--light-stroke);border-radius:8px;padding:8px 12px">
                  <label class="field" style="margin:0">
                    <span style="font-size:11px;font-weight:600;color:var(--text-muted);display:flex;align-items:center;gap:4px">
                      ${icon("user")} Select student to auto-fill details (optional)
                    </span>
                    <select class="select-input" data-on-change="draftAutoFillStudent" data-i="${i}" style="height:30px;background:var(--primary-bg);font-size:12px;margin-top:4px">
                      <option value="">— Choose an existing student to auto-fill fields —</option>
                      ${residents.map((r) => `<option value="${r.id}" ${g.studentId === r.id ? "selected" : ""}>${esc(r.name)} (${esc(r.roll)} · Room ${esc(r.room || "—")})</option>`).join("")}
                    </select>
                  </label>
                </div>

                <div class="pgrid" style="gap:10px 16px">
                  <label class="field">
                    <span>Full Name *</span>
                    <input class="input" style="height:32px;background:#fff" placeholder="Guest name" value="${esc(g.name || "")}" data-on-input="draftGuestField" data-i="${i}" data-k="name" ${i === 0 ? "autofocus" : ""}>
                  </label>
                  <label class="field">
                    <span>Mobile Number</span>
                    <input class="input" style="height:32px;background:#fff" placeholder="Mobile / Contact" value="${esc(g.contact || "")}" data-on-input="draftGuestField" data-i="${i}" data-k="contact">
                  </label>
                  <label class="field">
                    <span>Gender</span>
                    <select class="select-input" style="height:32px;background:#fff" data-on-change="draftGuestField" data-i="${i}" data-k="gender">
                      <option value="Female" ${g.gender === "Female" ? "selected" : ""}>Female</option>
                      <option value="Male" ${g.gender === "Male" ? "selected" : ""}>Male</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Relation / Role</span>
                    <input class="input" style="height:32px;background:#fff" placeholder="e.g. Parent, Academic Guest, Friend" value="${esc(g.relation || "Guest")}" data-on-input="draftGuestField" data-i="${i}" data-k="relation">
                  </label>
                </div>
              </div>`).join("")}
          </div>
        </div>

        <!-- Section 3: Stay Dates, Room & Remarks -->
        <div style="background:#fff;border:1px solid var(--light-stroke);border-radius:10px;padding:16px">
          <div class="pgrid" style="gap:12px 16px">
            <label class="field">
              <span>Arrival Date</span>
              <input class="input" type="date" id="draft-from" value="${draft.from}">
            </label>
            <label class="field">
              <span>Departure Date</span>
              <input class="input" type="date" id="draft-to" value="${draft.to}">
            </label>
            <label class="field" style="grid-column:1/-1">
              <span>Allot Room (Optional)</span>
              <select class="select-input" id="draft-room" style="height:34px">
                <option value="">Leave for map allotment later</option>
                ${freeRooms.map((r) => `<option value="${r}" ${draft.room === r ? "selected" : ""}>Room ${r} (Free now)</option>`).join("")}
              </select>
            </label>
            <label class="field" style="grid-column:1/-1">
              <span>Purpose / Notes</span>
              <textarea class="input" id="draft-comments" rows="2" placeholder="e.g. Family visit, convocation, project meeting">${esc(draft.comments || "")}</textarea>
            </label>
          </div>
        </div>

      </div>
      <div class="modal-foot" style="border-top:1px solid var(--light-stroke);padding:14px 24px;display:flex;justify-content:flex-end;gap:12px">
        <button class="btn btn-secondary" data-act="closeLayer">${icon("x")} Cancel</button>
        <button class="btn btn-primary btn-lg" data-act="draftSubmit">${icon("check")} Add guest</button>
      </div>`;
  }

  return { render, drawer, bookDialog };
})();
