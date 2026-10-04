/* ==========================================================================
   Hall Manager portal — routes, UI state and every Hall Manager action.
   Screens live in dashboard.js, residents.js, requests.js, map.js, actions.js.
   ========================================================================== */
(function () {
  const S = HMS.store.sel, A = HMS.store.act, D = HMS.date, UI = HMS.ui, FP = HMS.floorplan;
  const { icon, esc } = UI;
  const app = HMS.app;
  const ui = app.ui;
  const V = HMS.views;
  const render = () => app.render();
  const go = (h) => app.go(h);
  const form = (...a) => app.form(...a);
  const dlg = () => app.dlg;
  const renderDialog = () => app.renderDialog();
  const closeDialog = () => app.closeDialog();
  const openDialog = (s) => app.openDialog(s);

  const DIALOGS = {
    allot: { kind: "wide", view: (ctx, d) => V.map.allotDialog(ctx, d) },
    occupied: { kind: "wide", view: (ctx, d) => V.map.occupiedDialog(ctx, d) },
    maint: { kind: "modal", view: (ctx, d) => V.map.maintenanceDialog(ctx, d.room) },
    request: { kind: "drawer", view: (ctx, d) => V.requests.drawer(d.id) },
    book: { kind: "modal", view: (ctx, d) => V.requests.bookDialog(ctx, d) },
  };
  const open = (type, state) => openDialog({ ...DIALOGS[type], type, onClose: () => { ui.map.room = null; }, ...state });

  function openRoom(room) {
    const { floor } = FP.parseRoom(room);
    if (ui.map.floor !== floor) ui.map.floor = floor;
    ui.map.room = room;
    render();
    const st = S.roomState(room, ui.day);
    if (st === "empty") {
      const picked = [];
      if (ui.map.focusRequest) for (const p of S.unhousedGuests()) if (p.request.id === ui.map.focusRequest && picked.length < 2) picked.push(p.guest.id);
      open("allot", { room, tab: "allot", picked, focusRequest: ui.map.focusRequest, q: "", resident: null, walkIn: null, walkInDays: 2, showAll: false });
    } else if (st === "maintenance") open("maint", { room });
    else open("occupied", { room, tab: "details", extend: null });
  }
  function setDay(part, v) {
    let [y, m, d] = ui.day.split("-").map(Number);
    if (part === "y") y = Number(v); if (part === "m") m = Number(v); if (part === "d") d = Number(v);
    d = Math.min(d, new Date(y, m, 0).getDate());
    ui.day = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  function copyCsv(rows, cols, what) {
    const text = UI.csv(rows, cols);
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
      () => UI.toast(`Copied ${what} as CSV. Paste into Sheets or Excel.`),
      () => { UI.download(what.replace(/\W+/g, "-") + ".csv", text); UI.toast("Clipboard blocked, so the CSV was downloaded instead."); });
  }
  function saveDraftFields() {
    const f = (id) => document.getElementById(id);
    const d = dlg();
    if (!d) return;
    if (f("draft-from")) d.from = f("draft-from").value;
    if (f("draft-to")) d.to = f("draft-to").value;
    if (f("draft-room")) d.room = f("draft-room").value;
    if (f("draft-comments")) d.comments = f("draft-comments").value;
    if (f("draft-custom-host")) d.customHostName = f("draft-custom-host").value;
    if (f("draft-host-select")) d.hostId = f("draft-host-select").value;
    if (d.guests && d.guests.length) {
      d.guests.forEach((g, idx) => {
        const nameEl = document.querySelector(`input[data-on-input="draftGuestField"][data-i="${idx}"][data-k="name"]`);
        const contactEl = document.querySelector(`input[data-on-input="draftGuestField"][data-i="${idx}"][data-k="contact"]`);
        const genderEl = document.querySelector(`select[data-on-change="draftGuestField"][data-i="${idx}"][data-k="gender"]`);
        const relEl = document.querySelector(`input[data-on-input="draftGuestField"][data-i="${idx}"][data-k="relation"]`);
        if (nameEl) g.name = nameEl.value;
        if (contactEl) g.contact = contactEl.value;
        if (genderEl) g.gender = genderEl.value;
        if (relEl) g.relation = relEl.value;
      });
    }
    if (f("offline-from")) d.from = f("offline-from").value;
    if (f("offline-to")) d.to = f("offline-to").value;
    if (f("offline-room")) d.room = f("offline-room").value;
    if (f("offline-comments")) d.comments = f("offline-comments").value;
  }
  const residentOptions = (filter) => S.raw().residents.filter((r) => r.room && (!filter || filter(r))).sort((a, b) => a.name.localeCompare(b.name)).map((r) => `<option value="${r.id}">${esc(r.name)} · ${r.room}</option>`).join("");
  const freeRoomOptions = (day) => S.freeRoomsBetween(day, D.add(day, 30)).map((r) => `<option>${r}</option>`).join("");

  const handlers = {
    // header search
    toggleSearch: () => { ui.pop = ui.pop === "search" ? null : "search"; render(); },
    globalSearchQ: (el) => { ui.searchQ = el.value; render(); },
    openSearchResult: (el) => {
      const { type, id } = el.dataset; ui.pop = null; ui.searchQ = "";
      if (type === "resident") go("#/hm/residents/" + id);
      else if (type === "room") go(`#/hm/map?floor=${FP.parseRoom(id).floor}&room=${id}`);
      else { const st = S.raw().stays.find((s) => s.personId === id); if (st) go(`#/hm/map?floor=${FP.parseRoom(st.room).floor}&room=${st.room}`); else open("request", { id: S.guest(id).requestId }); }
    },

    // dashboard
    setDatePart: (el) => { setDay(el.dataset.part, el.value); render(); },
    toggleGuestSearch: () => { ui.guestSearchOpen = !ui.guestSearchOpen; if (!ui.guestSearchOpen) ui.guestQ = ""; render(); },
    toggleGuestSort: () => { ui.guestSortAsc = !ui.guestSortAsc; render(); UI.toast(ui.guestSortAsc ? "Earliest arrival first" : "Latest arrival first"); },
    guestQ: (el) => { ui.guestQ = el.value; render(); },
    updatesQ: (el) => { ui.updatesQ = el.value; render(); },
    resolveUpdate: (el) => {
      const u = S.raw().updates.find((x) => x.id === el.dataset.id); const ok = el.dataset.ok === "1";
      A.resolveUpdate(u.id, ok);
      if (u.type === "request" && ok) UI.toast("Request accepted. Allot rooms from the map.", { act: "allotFromRequest", label: "Allot now", data: `data-id="${u.requestId}"` });
      else if (u.type === "extension" && ok) UI.toast("Stay extended to " + D.fmt(u.to));
      else if (u.type === "maintenance" && ok) UI.toast("Room " + u.room + " marked under repair");
      else if (u.type === "form") UI.toast(ok ? "Form approved. The resident has been told." : "Form not approved. The resident has been told.");
      else UI.toast(ok ? "Done" : "Dismissed");
      if (ui.pop === "bell") ui.pop = null;
      render();
    },
    editRequestDates: (el) => {
      const r = S.request(el.dataset.id);
      form("Change dates · " + r.title, `
        <label class="field"><span>Arrival</span><input class="input" type="date" name="from" value="${r.from}"></label>
        <label class="field"><span>Departure</span><input class="input" type="date" name="to" value="${r.to}"></label>`, "Save dates",
        (v) => { if (v.to < v.from) return "Departure can't be before arrival."; A.updateRequestDates(r.id, v.from, v.to); UI.toast("Dates updated for " + r.title); },
        { intro: `Rooms ${S.requestRooms(r.id).join(", ") || "not allotted yet"}. Changing dates updates every guest in this request and tells the requester.` });
    },

    // residents
    resTab: (el, e) => { if (e.target.closest("[data-act=removeTab]")) return; ui.res.tab = el.dataset.tab; ui.res.page = 1; ui.res.filters = []; if (app.route.query.tab || app.route.query.arriving || app.route.query.leaving) go("#/hm/residents"); else render(); },
    removeTab: (el) => { A.removeCustomTab(el.dataset.id); if (ui.res.tab === el.dataset.id) ui.res.tab = "Bachelors"; render(); },
    toggleFilter: () => { ui.res.filterOpen = !ui.res.filterOpen; render(); },
    closeFilter: () => { ui.res.filterOpen = false; render(); },
    clearFilters: () => { ui.res.filters = []; ui.res.page = 1; render(); },
    filterAdd: () => { if (!ui.res.filters.length) ui.res.filters.push({ col: "", op: "contains", val: "" }); ui.res.filters.push({ col: "", op: "contains", val: "" }); render(); },
    filterRemove: (el) => { ui.res.filters.splice(Number(el.dataset.i), 1); render(); },
    filterEdit: (el) => { const i = Number(el.dataset.i); if (!ui.res.filters[i]) ui.res.filters[i] = { col: "", op: "contains", val: "" }; ui.res.filters[i][el.dataset.k] = el.value; ui.res.page = 1; render(); },
    saveTabPrompt: () => {
      const custom = S.customTabs().find((t) => t.id === ui.res.tab);
      const base = custom ? custom.base : ui.res.tab;
      form("Save as a tab", `<label class="field"><span>Tab name</span><input class="input" name="name" placeholder="e.g. PhD · thesis submitted" autofocus></label>`, "Save tab",
        (v) => { if (!v.name.trim()) return "Give the tab a name."; const t = A.saveCustomTab({ name: v.name.trim(), base, filters: ui.res.filters.filter((f) => f.col && f.val !== "") }); ui.res.tab = t.id; ui.res.filters = []; ui.res.filterOpen = false; UI.toast("Saved tab “" + t.name + "”"); },
        { intro: `Keeps the current ${esc(base)} view${ui.res.filters.length ? " and its filters" : ""} one click away.` });
    },
    perPage: (el) => { ui.res.perPage = el.value; ui.res.page = 1; render(); },
    resQ: (el) => { ui.res.q = el.value; ui.res.page = 1; render(); },
    sortBy: (el) => { const k = el.dataset.key; ui.res.sort = { key: k, dir: ui.res.sort.key === k ? -ui.res.sort.dir : 1 }; render(); },
    page: (el) => { ui.res.page = Math.max(1, ui.res.page + Number(el.dataset.d)); render(); },
    resPageTo: (el) => { ui.res.page = Number(el.dataset.p); render(); },
    exportResidents: () => { const { rows, cols } = V.residents.rowsFor({ ui, query: app.route.query }); copyCsv(rows, cols, rows.length + " rows"); },
    exportAll: () => { copyCsv(S.residentRows(null, ui.day), V.residents.COLS.resident, "all residents"); },
    editResident: (el) => {
      const r = S.resident(el.dataset.id);
      form("Edit · " + r.name, `
        <label class="field"><span>Mobile</span><input class="input" name="phone" value="${esc(r.phone)}" inputmode="tel"></label>
        <label class="field"><span>Department</span><input class="input" name="dept" value="${esc(r.dept)}"></label>
        <label class="field"><span>Current semester</span><input class="input" name="semester" type="number" min="1" max="12" value="${r.semester}"></label>
        <label class="field"><span>Permanent address</span><textarea class="input" name="homeAddress" rows="2">${esc(r.homeAddress)}</textarea></label>`, "Save changes",
        (v) => { A.updateResident(r.id, { ...v, semester: Number(v.semester) }); UI.toast("Saved " + r.name); });
    },
    editGuestStay: (el) => { const st = S.raw().stays.find((s) => s.personId === el.dataset.id); if (st) go(`#/hm/map?floor=${FP.parseRoom(st.room).floor}&room=${st.room}`); },
    vacateResident: (el) => {
      const r = S.resident(el.dataset.id);
      form("Mark " + r.name + " as vacated?", `<label class="field"><span>Vacate date</span><input class="input" type="date" name="day" value="${ui.day}"></label>`, "Mark vacated",
        (v) => { const room = r.room; A.vacateResident(r.id, v.day); UI.toast(`Room ${room} is now free from ${D.fmt(v.day)}`); },
        { intro: `Room ${r.room} becomes unoccupied from this date and the move is added to their occupancy history.`, danger: true });
    },
    addRemark: (el) => { const inp = document.getElementById("remark-input"); if (!inp.value.trim()) return inp.focus(); A.addRemark(el.dataset.id, inp.value.trim()); render(); UI.toast("Remark added"); },

    // requests
    bookView: (el) => { ui.book.view = el.dataset.v; render(); },
    viewRequest: (el) => open("request", { id: el.dataset.id }),
    acceptRequest: (el) => {
      A.acceptRequest(el.dataset.id); closeDialog();
      UI.toast("Request accepted. Rooms still need allotting.", { act: "allotFromRequest", label: "Allot now", data: `data-id="${el.dataset.id}"` });
    },
    rejectRequest: (el) => {
      const r = S.request(el.dataset.id);
      form("Reject request from " + r.requestedBy + "?", `<label class="field"><span>Reason (sent to the requester${r.source !== "student" ? " and HCU" : ""})</span><textarea class="input" name="reason" rows="3" placeholder="e.g. No rooms free on these dates"></textarea></label>`, "Reject request",
        (v) => { if (!v.reason.trim()) return "Add a reason so the requester knows what to change."; A.rejectRequest(r.id, v.reason.trim()); UI.toast("Request rejected"); }, { danger: true });
    },
    allotFromRequest: (el) => {
      const r = S.request(el.dataset.id);
      ui.map.focusRequest = r.id;
      let best = 1, bestN = -1;
      for (const f of FP.FLOORS) { const n = FP.SLOTS.filter((s) => S.roomState(FP.roomNo(f, s.idx), r.from) === "empty").length; if (n > bestN) { best = f; bestN = n; } }
      ui.day = r.from; ui.map.show = { allotted: true, empty: true, guest: true, maintenance: true };
      closeDialog(); go("#/hm/map?floor=" + best);
      UI.toast(`Showing ${D.fmt(r.from)}. Click an unoccupied room to allot ${r.title}.`);
    },
    decideFormHm: (el) => {
      const f = S.form(el.dataset.id); const ok = el.dataset.ok === "1"; const L = HMS.formTypes[f.type];
      form(`${ok ? "Approve" : "Reject"} ${L.label.toLowerCase()}?`, `<label class="field"><span>Note to the resident (optional)</span><textarea class="input" name="note" rows="2"></textarea></label>`, ok ? "Approve" : "Reject",
        (v) => { A.decideForm(f.id, ok, v.note.trim()); UI.toast(ok ? "Approved" : "Rejected"); },
        { intro: esc(L.summary(f.data, S.resident(f.residentId))) + (ok && f.type === "vacation" ? " The room frees up on that date." : ok && f.type === "room-change" ? " Next, move her from Actions → Resident management." : ""), danger: !ok });
    },
    newGuestBooking: () => {
      const residents = (S.raw().residents || []).filter((r) => r.room);
      open("book", {
        hostId: residents[0] ? `student:${residents[0].id}` : "group:office",
        isCustomHost: false,
        customHostName: "",
        guests: [{ name: "", contact: "", gender: "Female", relation: "Guest" }],
        from: ui.day,
        to: D.add(ui.day, 2),
        room: "",
        comments: "",
      });
    },
    draftHostSelect: (el) => {
      saveDraftFields();
      const d = dlg();
      d.hostId = el.value;
      d.isCustomHost = el.value === "custom";
      renderDialog();
    },
    draftCustomHostInput: (el) => {
      const d = dlg();
      if (d) d.customHostName = el.value;
    },
    draftAddGuestRow: () => {
      saveDraftFields();
      const d = dlg();
      d.guests = d.guests || [];
      d.guests.push({ name: "", contact: "", gender: "Female", relation: "Guest" });
      renderDialog();
    },
    draftRemoveGuestRow: (el) => {
      saveDraftFields();
      const d = dlg();
      const i = Number(el.dataset.i);
      if (d.guests && d.guests.length > 1) {
        d.guests.splice(i, 1);
        renderDialog();
      }
    },
    draftGuestField: (el) => {
      const d = dlg();
      if (!d || !d.guests) return;
      const i = Number(el.dataset.i);
      const k = el.dataset.k;
      if (d.guests[i]) {
        d.guests[i][k] = el.value;
      }
    },
    draftAutoFillStudent: (el) => {
      saveDraftFields();
      const d = dlg();
      if (!d) return;
      const i = Number(el.dataset.i);
      if (!d.guests || !d.guests[i]) return;
      const studentId = el.value;
      if (!studentId) {
        d.guests[i].studentId = "";
        renderDialog();
        return;
      }
      const res = S.resident(studentId);
      if (res) {
        d.guests[i].studentId = res.id;
        d.guests[i].name = res.name;
        d.guests[i].contact = res.phone || "";
        d.guests[i].gender = res.gender || "Female";
        d.guests[i].relation = `Student (${res.dept || "IITB"} · Roll ${res.roll || ""})`;
        renderDialog();
        UI.toast(`Auto-filled details for ${res.name}`);
      }
    },
    draftSubmit: () => {
      saveDraftFields();
      const d = dlg();
      const guests = (d.guests || []).filter((g) => g.name && g.name.trim());
      if (!guests.length) return UI.toast("Please enter the guest's name.");
      if (d.to < d.from) return UI.toast("Departure date cannot be before arrival.");

      let requestedBy = "Hostel 17 Office / Hall Manager";
      if (d.hostId && d.hostId.startsWith("student:")) {
        const sid = d.hostId.replace("student:", "");
        const res = S.resident(sid);
        if (res) requestedBy = `${res.name} (${res.roll} · Room ${res.room || "—"})`;
      } else if (d.hostId === "group:idc") requestedBy = "Department of IDC School of Design";
      else if (d.hostId === "group:cse") requestedBy = "Department of Computer Science & Engg.";
      else if (d.hostId === "group:deansa") requestedBy = "Dean of Student Affairs Office";
      else if (d.hostId === "group:ircc") requestedBy = "IRCC Research Visitor";
      else if (d.hostId === "group:council") requestedBy = "Hostel Student Council / Techfest";
      else if (d.customHostName && d.customHostName.trim()) requestedBy = d.customHostName.trim();

      const title = guests.length === 1 ? guests[0].name : `${guests[0].name} + ${guests.length - 1} others`;
      const r = A.createRequest({
        guests,
        title,
        requestedBy,
        from: d.from,
        to: d.to,
        room: d.room || null,
        comments: d.comments || `Guest stay hosted by ${requestedBy}`,
      });

      closeDialog();
      if (d.room) {
        UI.toast(`Added ${guests.length} guest${guests.length > 1 ? "s" : ""} & allotted Room ${d.room}.`, { act: "go", label: "View map", data: `data-href="#/hm/map?floor=${FP.parseRoom(d.room).floor}&room=${d.room}"` });
      } else {
        UI.toast(`Added ${guests.length} guest${guests.length > 1 ? "s" : ""}. Allot a room from the map or requests.`, { act: "allotFromRequest", label: "Allot now", data: `data-id="${r.id}"` });
      }
    },
    draftNotify: () => { const to = document.getElementById("draft-notify-to").value, msg = document.getElementById("draft-notify-msg").value.trim(); if (!msg) return UI.toast("Write a message first."); A.sendMessage(to, msg); closeDialog(); UI.toast("Sent to " + to); },
    clearRecentAllots: () => { A.clearRecentAllotments(); render(); UI.toast("Cleared recent allotment highlights."); },

    // map
    openRoom: (el) => openRoom(el.dataset.room),
    setWing: (el) => { ui.map.wing = el.value; render(); },
    toggleLabels: (el) => { ui.map.labels = el.checked; render(); },
    floorStep: (el) => { const F = FP.FLOORS; const i = F.indexOf(ui.map.floor) + Number(el.dataset.d); if (F[i]) { ui.map.floor = F[i]; render(); } },
    setFloor: (el) => { ui.map.floor = Number(el.dataset.f); render(); },
    toggleLegend: (el) => { const k = el.dataset.k; ui.map.show[k] = !ui.map.show[k]; render(); },
    roomTab: (el) => { dlg().tab = el.dataset.tab; renderDialog(); },
    allotQ: (el) => { dlg().q = el.value; renderDialog(); },
    pickGuest: (el) => { dlg().picked.push(el.dataset.id); dlg().q = ""; renderDialog(); },
    pickResident: (el) => { dlg().resident = el.dataset.id; dlg().q = ""; renderDialog(); },
    pickWalkIn: (el) => { dlg().walkIn = el.dataset.id; dlg().q = ""; renderDialog(); },
    unpickResident: () => { dlg().resident = null; renderDialog(); },
    unpickWalkIn: () => { dlg().walkIn = null; renderDialog(); },
    walkInDays: (el) => { dlg().walkInDays = Math.max(1, Number(el.value) || 1); renderDialog(); },
    showAllWaiting: () => { dlg().showAll = true; renderDialog(); },
    toggleCand: (el) => { const d = dlg(); const id = el.dataset.id; d.picked = el.checked ? [...new Set([...d.picked, id])] : d.picked.filter((x) => x !== id); renderDialog(); },
    confirmAllot: () => {
      const d = dlg(); const { room } = d; const names = [];
      if (d.picked.length) { A.allotGuests(room, d.picked); names.push(...d.picked.map((id) => S.guest(id).name)); }
      if (d.resident) { A.allotResident(room, d.resident, ui.day); names.push(S.resident(d.resident).name); }
      if (d.walkIn) { A.addWalkInGuest(room, d.walkIn, ui.day, D.add(ui.day, d.walkInDays - 1)); names.push(d.walkIn); }
      const fr = ui.map.focusRequest;
      const left = fr ? S.unhousedGuests().filter((p) => p.request.id === fr).length : 0;
      if (fr && !left) ui.map.focusRequest = null;
      closeDialog();
      UI.toast(`Room ${room} allotted to ${names.join(", ")}.${left ? ` ${left} more from this request to go.` : fr ? " Request complete; the requester has been told." : ""}`);
    },
    setMaintenancePrompt: () => {
      const room = dlg().room;
      form("Mark room " + room + " for repair", `<label class="field"><span>What needs fixing?</span><textarea class="input" name="note" rows="3" placeholder="e.g. Ceiling fan not working"></textarea></label>`, "Mark for repair",
        (v) => { if (!v.note.trim()) return "Describe the repair so the maintenance cell knows."; A.setMaintenance(room, v.note.trim(), ui.day); UI.toast("Room " + room + " marked under repair"); });
    },
    clearMaintenance: (el) => { A.clearMaintenance(el.dataset.room, ui.day); if (app.dlg) closeDialog(); else render(); UI.toast("Room " + el.dataset.room + " is back in use"); },
    sendNotify: (el) => { const to = document.getElementById("notify-to").value, msg = document.getElementById("notify-msg").value.trim(); A.sendMessage(to, msg, el.dataset.room); closeDialog(); UI.toast("Sent to " + to); },
    extendStay: (el) => { const d = dlg(); d.extend = d.extend === el.dataset.id ? null : el.dataset.id; renderDialog(); },
    confirmExtend: (el) => { const to = document.getElementById("extend-to").value; A.extendStay(el.dataset.id, to); dlg().extend = null; renderDialog(); render(); UI.toast("Stay extended to " + D.fmt(to)); },
    checkOut: (el) => { A.checkOutStay(el.dataset.id, D.add(ui.day, 1)); closeDialog(); UI.toast("Checked out. Room frees up tomorrow."); },
    roomAddMore: () => { const room = dlg().room; UI.close(true); app.dlg = null; open("allot", { room, tab: "allot", picked: [], focusRequest: null, q: "", resident: null, walkIn: null, walkInDays: 2, showAll: true }); },

    // actions
    actTab: (el) => { ui.act.tab = el.dataset.tab; render(); },
    hmBlockRooms: () => form("Block rooms for repair", `
      <label class="field"><span>Room numbers (comma separated)</span><input class="input" name="rooms" placeholder="e.g. 3012, 3013, 4020" autofocus></label>
      <div class="pgrid"><label class="field"><span>From</span><input class="input" type="date" name="from" value="${ui.day}"></label><label class="field"><span>Until (optional)</span><input class="input" type="date" name="to"></label></div>
      <label class="field"><span>What needs fixing?</span><textarea class="input" name="note" rows="2"></textarea></label>`, "Block rooms",
      (v) => {
        const rooms = v.rooms.split(/[\s,]+/).filter(Boolean);
        const all = new Set(FP.allRooms());
        const bad = rooms.filter((r) => !all.has(r));
        if (!rooms.length) return "Add at least one room number.";
        if (bad.length) return "Not a Hostel 17 room: " + bad.join(", ");
        if (!v.note.trim()) return "Describe the repair.";
        const busy = rooms.filter((r) => S.staysIn(r, v.from).length);
        rooms.forEach((r) => A.setMaintenance(r, v.note.trim(), v.from, v.to || null));
        UI.toast(`Blocked ${rooms.length} room${rooms.length > 1 ? "s" : ""}.${busy.length ? " Occupied now: " + busy.join(", ") + ". Move them first." : ""}`);
      }),
    hmBlockWing: () => form("Block a wing", `
      <div class="pgrid"><label class="field"><span>Floor</span><select class="select-input" name="floor">${FP.FLOORS.map((f) => `<option>${f}</option>`).join("")}</select></label>
      <label class="field"><span>Wing</span><select class="select-input" name="wing">${FP.WINGS.map((w) => `<option>${w}</option>`).join("")}</select></label>
      <label class="field"><span>From</span><input class="input" type="date" name="from" value="${ui.day}"></label><label class="field"><span>Until</span><input class="input" type="date" name="to" value="${D.add(ui.day, 14)}"></label></div>
      <label class="field"><span>Work</span><input class="input" name="note" value="Wing renovation"></label>`, "Block wing",
      (v) => {
        const rooms = FP.SLOTS.filter((s) => s.wing === v.wing).map((s) => FP.roomNo(Number(v.floor), s.idx));
        const free = rooms.filter((r) => S.roomFreeBetween(r, v.from, v.to));
        free.forEach((r) => A.setMaintenance(r, v.note, v.from, v.to));
        UI.toast(`Blocked ${free.length} free rooms in wing ${v.wing}, floor ${v.floor}.${rooms.length - free.length ? ` ${rooms.length - free.length} are occupied and were skipped.` : ""}`);
      }, { intro: "Only rooms free for the whole period are blocked. Occupied rooms are listed so you can move people first." }),
    hmMove: () => form("Move a resident", `
      <label class="field"><span>Resident</span><select class="select-input" name="who">${residentOptions()}</select></label>
      <label class="field"><span>From date</span><input class="input" type="date" name="day" value="${ui.day}"></label>
      <label class="field"><span>New room (free for the next 30 days)</span><select class="select-input" name="room">${freeRoomOptions(ui.day)}</select></label>`, "Move",
      (v) => { const r = S.resident(v.who); const old = r.room; A.moveResident(v.who, v.room, v.day); UI.toast(`${r.name}: ${old} → ${v.room} from ${D.fmt(v.day)}`); }),
    hmSwap: () => form("Swap two residents", `
      <label class="field"><span>First resident</span><select class="select-input" name="a">${residentOptions()}</select></label>
      <label class="field"><span>Second resident</span><select class="select-input" name="b">${residentOptions()}</select></label>
      <label class="field"><span>Swap on</span><input class="input" type="date" name="day" value="${ui.day}"></label>`, "Swap rooms",
      (v) => { if (v.a === v.b) return "Pick two different residents."; const a = S.resident(v.a), b = S.resident(v.b); A.swapResidents(v.a, v.b, v.day); UI.toast(`${a.name} and ${b.name} swapped rooms`); }),
    hmShiftIn: () => form("Hostel shift in", `
      <div class="pgrid"><label class="field"><span>Name</span><input class="input" name="name" autofocus></label><label class="field"><span>Roll number</span><input class="input" name="roll"></label>
      <label class="field"><span>Coming from</span><select class="select-input" name="from">${HMS.campus.HOSTELS.filter((h) => h.id !== "H17").map((h) => `<option value="${h.id}">${h.name}</option>`).join("")}</select></label>
      <label class="field"><span>Programme</span><select class="select-input" name="programGroup"><option>Bachelors</option><option>Masters</option><option>PhD</option></select></label>
      <label class="field"><span>Degree</span><input class="input" name="degree" value="M.Tech."></label><label class="field"><span>Department</span><input class="input" name="dept"></label>
      <label class="field"><span>Semester</span><input class="input" type="number" name="semester" value="3"></label>
      <label class="field"><span>Room</span><select class="select-input" name="room"><option value="">Allot later</option>${freeRoomOptions(ui.day)}</select></label></div>`, "Add resident",
      (v) => { if (!v.name.trim() || !v.roll.trim()) return "Name and roll number are needed."; A.shiftIn(v); UI.toast(v.name + " added" + (v.room ? " to room " + v.room : ". Allot a room from the map.")); }, { wide: true }),
    hmBatchPick: (el) => { const id = el.dataset.id; ui.act.pick = el.checked ? [...new Set([...ui.act.pick, id])] : ui.act.pick.filter((x) => x !== id); render(); },
    hmBatchAll: (el) => { ui.act.pick = el.checked ? S.unhousedResidents().map((r) => r.id) : []; render(); },
    hmAutoAllot: () => {
      const floor = Number(document.getElementById("batch-floor").value) || null;
      const done = A.autoAllotResidents(ui.act.pick, ui.day, floor);
      ui.act.pick = [];
      render();
      UI.toast(done.length ? `Allotted ${done.map(([id, room]) => S.resident(id).name.split(" ")[0] + " → " + room).join(", ")}` : "No free rooms left.");
    },
    hmBulkVacate: () => form("Semester-end vacate", `
      <label class="field"><span>Who</span><select class="select-input" name="who">
        <option value="exit">Everyone whose programme ends by the date</option>
        <option value="Bachelors">All Bachelors in their final semester</option><option value="Masters">All Masters in their final semester</option></select></label>
      <label class="field"><span>Vacate on</span><input class="input" type="date" name="day" value="2027-05-31"></label>`, "Preview",
      (v) => {
        const filter = v.who === "exit" ? (r) => r.expectedExit <= v.day : (r) => r.programGroup === v.who && r.semester >= (v.who === "Bachelors" ? 7 : 3);
        const list = S.raw().residents.filter((r) => r.room && filter(r));
        setTimeout(() => form(`Vacate ${list.length} residents on ${D.fmt(v.day)}?`, `<div class="scroll-list">${list.slice(0, 80).map((r) => `<div>${esc(r.room)} · ${esc(r.name)} <span class="muted">${esc(r.degree)}, sem ${r.semester}</span></div>`).join("") || "No one matches."}</div>`, "Vacate all",
          () => { const n = A.bulkVacate(filter, v.day); UI.toast(`${n} rooms free from ${D.fmt(v.day)}`); }, { danger: true, intro: "Rooms free up on that date. Each move is recorded in the resident's occupancy history." }), 0);
      }),
    hmPostNotice: () => form("Post a notice", `
      <label class="field"><span>Title</span><input class="input" name="title" autofocus></label>
      <label class="field"><span>Notice</span><textarea class="input" name="body" rows="4"></textarea></label>`, "Post",
      (v) => { if (!v.title.trim() || !v.body.trim()) return "Add a title and the notice."; A.postNotice("H17", v.title.trim(), v.body.trim(), "Hall Manager, Hostel 17"); UI.toast("Posted to Hostel 17 residents"); }),
    hmExport: (el) => {
      const day = ui.day;
      const w = el.dataset.what;
      if (w === "vacant") copyCsv(FP.allRooms().filter((r) => S.roomState(r, day) === "empty").map((r) => ({ room: r, floor: FP.parseRoom(r).floor, wing: FP.wingOf(r) })), [{ key: "room", label: "Room" }, { key: "floor", label: "Floor" }, { key: "wing", label: "Wing" }], "vacant rooms");
      if (w === "guests") copyCsv(S.residentRows("Guests", day), V.residents.COLS.guest, "guests");
      if (w === "repairs") copyCsv(S.raw().maintenance.filter((m) => D.overlaps(m.from, m.to, day)), [{ key: "room", label: "Room" }, { key: "note", label: "Issue" }, { key: "from", label: "From" }, { key: "to", label: "Until" }], "repairs");
      if (w === "requests") copyCsv(S.hostelRequests("H17").map((r) => ({ ...r, type: HMS.shared.typeLabel(r) })), [{ key: "id", label: "ID" }, { key: "type", label: "Type" }, { key: "requestedBy", label: "Requested by" }, { key: "count", label: "Guests" }, { key: "from", label: "From" }, { key: "to", label: "To" }, { key: "status", label: "Status" }], "requests");
    },

    // settings, demo
    setLang: (el) => { A.setSetting("lang", el.dataset.v); render(); UI.toast(el.dataset.v === "hi" ? "Saved. Hindi screens aren't translated in the prototype yet." : "Saved"); },
    setNotify: (el) => { const n = { ...S.settings().notify }; n[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; A.setSetting("notify", n); UI.toast("Saved"); },
    addStaff: () => form("Add staff", `<label class="field"><span>Name</span><input class="input" name="name" autofocus></label><label class="field"><span>Role</span><input class="input" name="role" value="Office assistant"></label>
      <label class="field"><span>Access</span><select class="select-input" name="access"><option>View only</option><option>Allot rooms, no resident edits</option><option>Full</option></select></label>`, "Add",
      (v) => { if (!v.name.trim()) return "Add a name."; A.addStaff({ name: v.name.trim(), role: v.role, access: v.access }); UI.toast("Added " + v.name); }),
    removeStaff: (el) => { A.removeStaff(Number(el.dataset.i)); render(); },
    resetDemo: () => form("Reset demo data?", "", "Reset everything", () => { HMS.store.reset(); ui.map.focusRequest = null; UI.toast("Demo data reset"); }, { intro: "Every room, request, resident edit and saved tab in every portal goes back to the starting state.", danger: true }),
  };

  function searchPop(u) {
    const res = S.search(u.searchQ);
    return `<div class="popover search-pop" role="dialog" aria-label="Search">
      <input class="input" type="search" placeholder="Name, roll number or room" value="${esc(u.searchQ)}" data-on-input="globalSearchQ" autofocus>
      <div class="search-results">${u.searchQ && !res.length ? `<div class="empty" style="padding:16px">No match for “${esc(u.searchQ)}”.</div>` : res.map((r) => `<button data-act="openSearchResult" data-type="${r.type}" data-id="${esc(r.id)}"><span>${esc(r.label)}</span><small>${esc(r.sub)}</small></button>`).join("")}</div>
    </div>`;
  }

  const TITLES = { dashboard: "Dashboard", residents: "Residents", requests: "Bookings & Requests", map: "Hostel Map", actions: "Actions", settings: "Settings" };

  app.portal({
    id: "hm",
    defaultPath: "dashboard",
    nav: [["dashboard", "Dashboard"], ["residents", "Residents"], ["requests", "Bookings & Requests"], ["map", "Hostel Map"], ["actions", "Actions"]],
    settings: true,
    search: searchPop,
    title: (r) => TITLES[r.path] || "Hall Manager",
    init(u) {
      Object.assign(u, {
        day: HMS.TODAY,
        guestQ: "", guestSearchOpen: false, guestSortAsc: true, updatesQ: "",
        res: { tab: "Bachelors", filters: [], filterOpen: false, perPage: "50", page: 1, q: "", sort: { key: "room", dir: 1 } },
        book: { view: "requests" },
        map: { floor: 3, wing: "all", show: { allotted: true, empty: true, guest: true, maintenance: true }, room: null, labels: false, focusRequest: null },
        act: { tab: "rooms", pick: [] },
      });
    },
    onRoute(route, prev, u) {
      const q = route.query;
      if (route.path === "residents" && !route.id) {
        if (q.tab) u.res.tab = q.tab;
        if (prev.path !== "residents" || q.tab) u.res.page = 1;
      }
      if (route.path === "requests" && q.tab) u.book.view = q.tab === "forms" ? "forms" : "requests";
      if (route.path === "actions" && q.tab) u.act.tab = q.tab;
      if (route.path === "map") {
        if (q.floor) u.map.floor = Number(q.floor);
        if (q.show === "empty") u.map.show = { allotted: false, empty: true, guest: false, maintenance: false };
        u.map.room = q.room || null;
      }
    },
    afterRoute(route) { if (route.path === "map" && route.query.room) openRoom(route.query.room); if (route.path === "requests" && route.id) open("request", { id: route.id }); },
    outsideClick(e, u) { if (u.res.filterOpen && !e.target.closest(".filter-pop")) { u.res.filterOpen = false; return true; } return false; },
    escape(u) { if (u.res.filterOpen) { u.res.filterOpen = false; return true; } return false; },
    render(route, ctx) {
      switch (route.path) {
        case "residents": return route.id ? V.residents.profile(ctx, route.id) : V.residents.render(ctx);
        case "requests": return V.requests.render(ctx);
        case "map": return V.map.render(ctx);
        case "actions": return V.actions.render(ctx);
        case "settings": return V.settings.render(ctx);
        default: return V.dashboard.render(ctx);
      }
    },
    handlers,
  });
})();
