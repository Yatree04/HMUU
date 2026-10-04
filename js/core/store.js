/* ==========================================================================
   Store — the only place that reads or writes data, for every portal.
   Views call selectors (read) and mutations (write), never touch `state`.
   To move to a backend, keep these function signatures and swap the bodies
   for API calls.

   Request status, in order:
     dean      waiting for Associate Dean SA (department, IRCC, events)
     hcu       waiting for HCU to pick a hostel
     pending   with that hostel's Hall Manager
     accepted  Hall Manager accepted, rooms not yet allotted
     allotted  rooms allotted
     completed stay is over
     rejected / cancelled
   Every change appends to `request.timeline` and notifies the next person.
   ========================================================================== */
window.HMS = window.HMS || {};

HMS.store = (function () {
  const KEY = "iitb-hms-v2";
  const C = HMS.campus;
  let state = load();
  const listeners = new Set();

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { /* storage blocked */ }
    return HMS.seed();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
  function commit() { save(); listeners.forEach((fn) => fn()); }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function reset() { state = HMS.seed(); commit(); }

  // Another tab (another "portal" open side by side) changed the data
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = JSON.parse(e.newValue); listeners.forEach((fn) => fn()); } catch (err) { /* ignore */ }
  });

  const byId = (list, id) => list.find((x) => x.id === id);
  const D = HMS.date;
  const TODAY = () => HMS.TODAY;
  let uid = Date.now() % 100000;
  const nid = (p) => p + "-" + (uid++).toString(36).toUpperCase();
  const hostelName = (id) => (C.hostel(id) || { name: id || "—" }).name;

  /* ------------------------------ Selectors ------------------------------ */
  const sel = {
    raw: () => state,
    resident: (id) => byId(state.residents, id),
    residentByRoom: (room) => state.residents.find((r) => r.room === room),
    guest: (id) => byId(state.guests, id),
    request: (id) => byId(state.requests, id),
    requests: () => state.requests,
    updates: (hostel = "H17") => state.updates.filter((u) => !u.hostel || u.hostel === hostel),
    form: (id) => byId(state.forms, id),
    forms: () => state.forms,
    notices: (hostel) => state.notices.filter((n) => !hostel || n.hostel === "all" || n.hostel === hostel).sort((a, b) => b.date.localeCompare(a.date)),
    batches: () => state.batches,
    customTabs: () => state.customTabs,
    settings: () => state.settings,
    recentAllotments: () => state.recentAllotments || [],
    recentAllottedResidentIds: () => {
      const ids = new Set();
      for (const b of (state.recentAllotments || [])) for (const r of (b.residents || [])) ids.add(r.id);
      return ids;
    },
    recentAllottedRooms: () => {
      const rms = new Set();
      for (const b of (state.recentAllotments || [])) for (const r of (b.residents || [])) if (r.room) rms.add(r.room);
      return rms;
    },
    isRecentResident: (id) => (sel.recentAllottedResidentIds()).has(id),
    isRecentRoom: (room) => (sel.recentAllottedRooms()).has(room),
    notifications: (target) => state.notifications.filter((n) => n.to === target).sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)),
    unread: (target) => state.notifications.filter((n) => n.to === target && !n.read).length,

    /** Requests visible to one requester (student / department / IRCC org) */
    requestsOf: (owner) => state.requests.filter((r) => r.owner === owner).sort((a, b) => b.requestedOn.localeCompare(a.requestedOn)),
    /** Requests a hostel's Hall Manager deals with */
    hostelRequests: (hostel = "H17") => state.requests.filter((r) => r.hostel === hostel && !["dean", "hcu"].includes(r.status)),

    /** Stays active on `day` in `room` */
    staysIn(room, day) { return state.stays.filter((s) => s.room === room && D.overlaps(s.from, s.to, day)); },
    maintenanceIn(room, day) { return state.maintenance.find((m) => m.room === room && D.overlaps(m.from, m.to, day)); },

    /** One of: "allotted" | "guest" | "maintenance" | "empty" */
    roomState(room, day) {
      if (sel.maintenanceIn(room, day)) return "maintenance";
      const st = sel.staysIn(room, day);
      if (!st.length) return "empty";
      return st.some((s) => s.kind === "resident") ? "allotted" : "guest";
    },
    /** Free for the whole range (no stay, no repair on any day) */
    roomFreeBetween(room, from, to) {
      return !state.stays.some((s) => s.room === room && D.rangesOverlap(s.from, s.to, from, to))
        && !state.maintenance.some((m) => m.room === room && D.rangesOverlap(m.from, m.to, from, to));
    },
    freeRoomsBetween(from, to) { return HMS.floorplan.allRooms().filter((r) => sel.roomFreeBetween(r, from, to)); },

    occupants(room, day) {
      return sel.staysIn(room, day).map((s) => ({ stay: s, person: s.kind === "resident" ? sel.resident(s.personId) : sel.guest(s.personId) }));
    },

    stats(day) {
      const rooms = HMS.floorplan.allRooms();
      let empty = 0, allotted = 0, guestRooms = 0, maint = 0;
      for (const r of rooms) {
        const st = sel.roomState(r, day);
        if (st === "empty") empty++; else if (st === "allotted") allotted++; else if (st === "guest") guestRooms++; else maint++;
      }
      const guestStays = state.stays.filter((s) => s.kind === "guest");
      return {
        total: rooms.length, empty, occupied: allotted + guestRooms, allotted, guestRooms, maint,
        guests: guestStays.filter((s) => D.overlaps(s.from, s.to, day)).length,
        checkIns: new Set(guestStays.filter((s) => s.from === day).map((s) => s.room)).size,
        checkOuts: new Set(guestStays.filter((s) => s.to === day).map((s) => s.room)).size,
      };
    },

    /** Headline numbers for any hostel. H17 is computed; others use the register + routed requests. */
    hostelStats(id, day = TODAY()) {
      const h = C.hostel(id);
      if (h.modelled) {
        const st = sel.stats(day);
        const irStays = state.requests.filter((r) => r.type === "ir" && r.status === "allotted" && D.overlaps(r.from, r.to, day)).reduce((n, r) => n + r.count, 0);
        return { ...h, capacity: st.total, occupied: st.allotted, guests: st.guests, maint: st.maint, vacant: st.empty, ir: irStays, pending: sel.hostelRequests(id).filter((r) => r.status === "pending" || r.status === "accepted").length };
      }
      const routed = state.requests.filter((r) => r.hostel === id && ["pending", "accepted", "allotted"].includes(r.status) && D.overlaps(r.from, r.to, day)).reduce((n, r) => n + r.count, 0);
      const guests = h.guests + routed;
      return { ...h, guests, ir: Math.round(h.guests / 3), vacant: Math.max(0, h.capacity - h.occupied - h.maint - guests), pending: state.requests.filter((r) => r.hostel === id && r.status === "pending").length };
    },
    /** Beds free in a hostel on every day of [from, to] */
    hostelFreeBetween(id, from, to) {
      const h = C.hostel(id);
      if (h.modelled) return sel.freeRoomsBetween(from, to).length;
      const booked = state.requests.filter((r) => r.hostel === id && ["pending", "accepted", "allotted"].includes(r.status) && D.rangesOverlap(r.from, r.to, from, to)).reduce((n, r) => n + r.count, 0);
      return Math.max(0, h.capacity - h.occupied - h.maint - h.guests - booked);
    },
    /** Hostels HCU could send this request to, best first */
    routeOptions(req, gender) {
      const g = gender || req.gender;
      return C.HOSTELS
        .filter((h) => g === "Mixed" ? h.gender === "Mixed" : h.gender === g || h.gender === "Mixed")
        .map((h) => ({ hostel: h, free: sel.hostelFreeBetween(h.id, req.from, req.to), preferred: req.preferredHostel === h.id }))
        .sort((a, b) => (b.preferred - a.preferred) || (b.free - a.free));
    },

    /** Guest requests with at least one guest in-house on `day` */
    inHouseRequests(day, hostel = "H17") {
      return state.requests.filter((r) => r.hostel === hostel && r.status === "allotted" && sel.requestStays(r.id).some((s) => D.overlaps(s.from, s.to, day)));
    },
    requestStays(requestId) {
      const r = sel.request(requestId); if (!r) return [];
      return state.stays.filter((s) => s.kind === "guest" && r.guestIds.includes(s.personId));
    },
    requestRooms(requestId) { return [...new Set(sel.requestStays(requestId).map((s) => s.room))].sort(); },
    /** Where each guest of a request sleeps: { guestId: "H17 · 3007" } */
    guestPlacement(requestId) {
      const r = sel.request(requestId); const out = {};
      if (!r) return out;
      for (const s of sel.requestStays(requestId)) out[s.personId] = (r.hostel ? r.hostel + " · " : "") + s.room;
      for (const [g, room] of Object.entries(r.externalRooms || {})) out[g] = r.hostel + " · " + room;
      return out;
    },

    /** Guests still waiting for a room — accepted requests, guest not yet allotted */
    unhousedGuests(hostel = "H17") {
      const housed = new Set(state.stays.filter((s) => s.kind === "guest").map((s) => s.personId));
      const out = [];
      for (const r of state.requests) if (r.hostel === hostel && r.status === "accepted") for (const gid of r.guestIds) if (!housed.has(gid)) out.push({ guest: sel.guest(gid), request: r });
      return out;
    },
    /** Residents assigned to the hostel (e.g. by an HCU batch) who have no room yet */
    unhousedResidents(hostel = "H17") { return state.residents.filter((r) => r.hostel === hostel && !r.room && !r.left); },

    /** Rows for the Residents table; tab = Bachelors | Masters | PhD | Guests */
    residentRows(tab, day) {
      if (tab === "Guests") {
        return state.stays.filter((s) => s.kind === "guest" && D.overlaps(s.from, s.to, day)).map((s) => {
          const g = sel.guest(s.personId); const r = sel.request(g.requestId);
          return { kind: "guest", id: g.id, room: s.room, name: g.name, arrival: s.from, departure: s.to, contact: g.contact, requestedBy: r ? r.requestedBy : "", request: r ? r.id : "" };
        });
      }
      return state.residents.filter((r) => r.room && (!tab || r.programGroup === tab)).map((r) => ({
        kind: "resident", id: r.id, hostel: "H17", room: r.room, roll: r.roll, name: r.name, dept: r.dept, program: r.degree, contact: r.phone, semester: r.semester, programGroup: r.programGroup, gender: r.gender,
      }));
    },

    search(q) {
      q = q.trim().toLowerCase(); if (!q) return [];
      const out = [];
      for (const r of state.residents) if (r.room && (r.name.toLowerCase().includes(q) || r.roll.toLowerCase().includes(q) || r.room.includes(q))) out.push({ type: "resident", id: r.id, label: r.name, sub: r.roll + " · Room " + r.room });
      for (const g of state.guests) if (g.name.toLowerCase().includes(q)) { const st = state.stays.find((s) => s.personId === g.id); const rq = sel.request(g.requestId); if (rq && rq.hostel === "H17") out.push({ type: "guest", id: g.id, label: g.name, sub: "Guest" + (st ? " · Room " + st.room : " · Not allotted") }); }
      if (/^\d{4}$/.test(q)) out.unshift({ type: "room", id: q, label: "Room " + q, sub: "Open on Hostel map" });
      return out.slice(0, 12);
    },

    /** Average days each stage took, from timelines — the "approvals take too long" metric */
    turnaround() {
      const acc = { dean: [], hcu: [], hm: [], total: [] };
      for (const r of state.requests) {
        const t = r.timeline || [];
        const at = (act, role) => (t.find((e) => e.act === act && (!role || e.role === role)) || {}).at;
        const sub = at("submitted"), dean = at("approved", "dean") || at("partial", "dean"), routed = at("routed"), allot = at("allotted");
        if (sub && dean) acc.dean.push(D.days(sub, dean));
        if ((dean || sub) && routed && r.type !== "guest") acc.hcu.push(D.days(dean || sub, routed));
        if (routed && allot) acc.hm.push(D.days(routed, allot));
        if (sub && allot) acc.total.push(D.days(sub, allot));
      }
      const avg = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);
      return { dean: avg(acc.dean), hcu: avg(acc.hcu), hm: avg(acc.hm), total: avg(acc.total), n: acc.total.length };
    },
  };

  /* ------------------------------ Helpers ------------------------------ */
  function log(r, who, role, act, note) { r.timeline = r.timeline || []; r.timeline.push({ at: TODAY(), who, role, act, note: note || "" }); }
  function notify(to, text, href) { if (!to) return; state.notifications.push({ id: nid("NF"), to, text, href: href || "", at: TODAY(), read: false }); }
  const ownerHref = (owner) => owner && owner.startsWith("student:") ? "#/student/requests" : owner && owner.startsWith("org:") ? (["org:IRCC", "org:Event Council"].includes(owner) ? "#/ircc/batches" : "#/dept/requests") : "";
  function tellOwner(r, text) { notify(r.owner, text, ownerHref(r.owner) + (r.id ? "/" + r.id : "")); }
  function hmTarget(r) { return r.hostel ? "hm:" + r.hostel : null; }
  function hmName(r) { return "Hall Manager, " + hostelName(r.hostel); }
  /** Mark a request allotted once every guest has a bed */
  function syncAllotted() {
    for (const r of state.requests) {
      if (r.status !== "accepted" || !r.guestIds.length) continue;
      if (r.guestIds.every((gid) => state.stays.some((s) => s.personId === gid))) {
        r.status = "allotted";
        const rooms = sel.requestRooms(r.id);
        log(r, hmName(r), "hm", "allotted", "Rooms " + rooms.join(", ") + ".");
        tellOwner(r, `${hostelName(r.hostel)} allotted room${rooms.length > 1 ? "s" : ""} ${rooms.join(", ")} for “${r.title}”.`);
      }
    }
  }

  /* ------------------------------ Mutations ------------------------------ */
  const act = {
    /* ----- Requesters (student, department, IRCC) ----- */
    submitRequest(data) {
      const t = C.TYPES[data.type];
      const id = nid("RQ");
      const r = {
        id, type: data.type, kind: data.guests.length > 1 ? "group" : "individual", source: t.source, owner: data.owner, requestedBy: data.requestedBy, requesterRoll: data.requesterRoll,
        title: data.title || (data.guests.length > 1 ? data.guests.length + " guests" : data.guests[0].name), count: data.guests.length,
        gender: [...new Set(data.guests.map((g) => g.gender))].length > 1 ? "Mixed" : data.guests[0].gender,
        from: data.from, to: data.to, requestedOn: TODAY(), contact: data.contact || "", comments: data.comments || "", documents: data.documents || [],
        preferredHostel: data.preferredHostel || "", hostel: data.hostel || null, status: data.type === "guest" ? "pending" : t.dean ? "dean" : "hcu", guestIds: [], timeline: [],
      };
      for (const g of data.guests) { const gg = { id: nid("GS"), name: g.name, contact: g.contact || "", requestId: id, relation: g.relation || "", gender: g.gender || "Female" }; state.guests.push(gg); r.guestIds.push(gg.id); }
      log(r, r.requestedBy, t.source, "submitted", `${r.count} guest${r.count > 1 ? "s" : ""}, ${D.fmt(r.from)} – ${D.fmt(r.to)}`);
      if (r.status === "pending") {
        log(r, "Portal", "system", "routed", "Sent to the Hall Manager of " + hostelName(r.hostel) + ".");
        state.updates.unshift({ id: nid("UP"), hostel: r.hostel, type: "request", requestId: id, title: "Guest request · " + r.requestedBy, body: `${r.count} guest${r.count > 1 ? "s" : ""} · ${r.comments}`, from: r.from, to: r.to, state: "open" });
        notify(hmTarget(r), `New guest request from ${r.requestedBy} (${D.fmt(r.from)} – ${D.fmt(r.to)}).`, "#/hm/requests");
      } else if (r.status === "dean") notify("dean", `New ${t.label.toLowerCase()} request from ${r.requestedBy}: “${r.title}”.`, "#/dean/approvals/" + id);
      else notify("hcu", `${r.requestedBy} sent “${r.title}”. It needs a hostel.`, "#/hcu/requests/" + id);
      state.requests.unshift(r);
      commit();
      return r;
    },
    cancelRequest(id, who) {
      const r = sel.request(id); if (!r) return;
      const was = r.status;
      r.status = "cancelled";
      state.stays = state.stays.filter((s) => !(s.kind === "guest" && r.guestIds.includes(s.personId) && s.from > TODAY()));
      log(r, who || r.requestedBy, r.source, "cancelled", "Cancelled by the requester.");
      for (const u of state.updates) if (u.requestId === id && u.state === "open") u.state = "rejected";
      if (["pending", "accepted", "allotted"].includes(was)) notify(hmTarget(r), `${r.requestedBy} cancelled “${r.title}”.`, "#/hm/requests");
      commit();
    },
    requestExtension(id, to, reason, who) {
      const r = sel.request(id); if (!r) return;
      r.extension = { to, reason, state: "open", on: TODAY() };
      log(r, who || r.requestedBy, r.source, "extension", `Asked to extend to ${D.fmt(to)}. ${reason || ""}`);
      state.updates.unshift({ id: nid("UP"), hostel: r.hostel, type: "extension", requestId: id, title: "Extension request · " + r.title, body: `Requested by ${r.requestedBy}. Stay until ${D.fmt(to)} instead of ${D.fmt(r.to)}.${reason ? " " + reason : ""}`, from: r.from, to, state: "open" });
      notify(hmTarget(r), `${r.requestedBy} asked to extend “${r.title}” to ${D.fmt(to)}.`, "#/hm/dashboard");
      notify("hcu", `Extension asked on “${r.title}” (${hostelName(r.hostel)}) to ${D.fmt(to)}.`, "#/hcu/requests/" + id);
      commit();
    },

    /* ----- Associate Dean SA ----- */
    deanApprove(id, note, keepGuestIds, dates) {
      const r = sel.request(id); if (!r) return;
      const partial = keepGuestIds && keepGuestIds.length < r.guestIds.length || (dates && (dates.from !== r.from || dates.to !== r.to));
      if (keepGuestIds && keepGuestIds.length < r.guestIds.length) {
        const dropped = r.guestIds.filter((g) => !keepGuestIds.includes(g));
        r.droppedGuestIds = dropped;
        r.guestIds = keepGuestIds;
        r.count = keepGuestIds.length;
        const gs = [...new Set(r.guestIds.map((g) => sel.guest(g).gender))];
        r.gender = gs.length > 1 ? "Mixed" : gs[0];
      }
      if (dates) { r.from = dates.from; r.to = dates.to; }
      r.deanNote = note || "";
      r.status = "hcu";
      log(r, "Associate Dean SA", "dean", partial ? "partial" : "approved", (partial ? `Approved ${r.count} guest${r.count > 1 ? "s" : ""}, ${D.fmt(r.from)} – ${D.fmt(r.to)}. ` : "") + (note || ""));
      tellOwner(r, `Associate Dean SA ${partial ? "partly approved" : "approved"} “${r.title}”. HCU will pick a hostel next.`);
      notify("hcu", `Associate Dean SA approved “${r.title}” (${r.count} guests). Pick a hostel.`, "#/hcu/requests/" + id);
      commit();
    },
    deanReject(id, reason) {
      const r = sel.request(id); if (!r) return;
      r.status = "rejected"; r.rejectReason = reason; r.rejectedBy = "Associate Dean SA"; r.rejectedAt = "dean";
      log(r, "Associate Dean SA", "dean", "rejected", reason);
      tellOwner(r, `Associate Dean SA rejected “${r.title}”: ${reason}`);
      commit();
    },

    /* ----- HCU ----- */
    /** assignments: { Female: "H17", Male: "H4" } — a mixed group is split into one request per hostel */
    routeRequest(id, assignments, note) {
      const r = sel.request(id); if (!r) return [];
      const genders = Object.keys(assignments);
      const out = [];
      const send = (req, hostel) => {
        req.hostel = hostel; req.status = "pending"; req.kind = req.count > 1 ? "group" : "individual";
        log(req, "HCU Office", "hcu", "routed", `Sent to ${hostelName(hostel)}.${note ? " " + note : ""}`);
        state.updates.unshift({ id: nid("UP"), hostel, type: "request", requestId: req.id, title: req.title + " · " + req.requestedBy, body: `HCU | ${req.count} ${req.count > 1 ? "guests" : "guest"}${req.deanNote ? " · Dean SA: " + req.deanNote : ""}`, from: req.from, to: req.to, state: "open" });
        notify("hm:" + hostel, `HCU sent “${req.title}” (${req.count} guests, ${D.fmt(req.from)} – ${D.fmt(req.to)}).`, "#/hm/requests");
        tellOwner(req, `HCU sent ${req.count > 1 ? req.count + " of your guests" : "your guest"} in “${req.title}” to ${hostelName(hostel)}.`);
        out.push(req);
      };
      const distinct = [...new Set(Object.values(assignments))];
      if (distinct.length === 1) send(r, distinct[0]);
      else {
        // split by gender: the original keeps the first group, a sibling takes each other group
        const allIds = [...r.guestIds], baseTitle = r.title;
        const snapshot = JSON.parse(JSON.stringify(r));
        let first = true;
        for (const g of genders) {
          const ids = allIds.filter((x) => sel.guest(x).gender === g);
          if (!ids.length) continue;
          if (first) { first = false; r.guestIds = ids; r.count = ids.length; r.gender = g; r.title = baseTitle + " · " + (g === "Female" ? "women" : "men"); send(r, assignments[g]); continue; }
          const copy = { ...JSON.parse(JSON.stringify(snapshot)), id: r.id + "-" + g[0], guestIds: ids, count: ids.length, gender: g, title: baseTitle + " · " + (g === "Female" ? "women" : "men"), splitFrom: r.id };
          for (const gid of ids) sel.guest(gid).requestId = copy.id;
          state.requests.unshift(copy);
          send(copy, assignments[g]);
        }
      }
      commit();
      return out;
    },
    hcuReject(id, reason) {
      const r = sel.request(id); if (!r) return;
      r.status = "rejected"; r.rejectReason = reason; r.rejectedBy = "HCU Office"; r.rejectedAt = "hcu";
      log(r, "HCU Office", "hcu", "rejected", reason);
      tellOwner(r, `HCU couldn't place “${r.title}”: ${reason}`);
      commit();
    },
    /** Prototype only: stand in for a hostel whose Hall Manager isn't modelled */
    simulateExternalAllot(id) {
      const r = sel.request(id); if (!r || C.hostel(r.hostel).modelled) return;
      r.externalRooms = {};
      let n = 2001 + Math.floor(Math.random() * 60);
      r.guestIds.forEach((g, i) => { r.externalRooms[g] = String(n + Math.floor(i / 2)); });
      if (r.status === "pending") log(r, hmName(r), "hm", "accepted", "Accepted.");
      r.status = "allotted";
      const rooms = [...new Set(Object.values(r.externalRooms))];
      log(r, hmName(r), "hm", "allotted", "Rooms " + rooms.join(", ") + ". (Simulated in the prototype.)");
      tellOwner(r, `${hostelName(r.hostel)} allotted rooms for “${r.title}”.`);
      commit();
    },
    postNotice(hostel, title, body, by) { state.notices.unshift({ id: nid("NT"), hostel, title, body, date: TODAY(), by }); if (hostel !== "all") notify("hm:" + hostel, "Notice posted: " + title, "#/hm/actions"); commit(); },
    uploadBatch(name, people) {
      const b = { id: nid("BT"), name, uploadedOn: TODAY(), people: [] };
      for (const p of people) {
        const row = { ...p };
        if (p.hostel === "H17") {
          const res = { id: nid("RS"), hostel: "H17", roll: p.roll, name: p.name, programGroup: p.programGroup || "Masters", degree: p.programme || "M.Tech.", dept: p.dept || "—", semester: 1, phone: p.phone || "", email: (p.roll || "").toLowerCase() + "@iitb.ac.in", dob: "", gender: p.gender || "Female", nationality: "Indian", blood: "—", homeAddress: "—", joined: TODAY(), expectedExit: D.add(TODAY(), 730), advisor: { name: "—", phone: "" }, guardian: { name: "—", relation: "", phone: "" }, mentor: { name: "—", phone: "" }, emergency: ["", ""], remarks: [], room: null, history: [], mess: "Hostel 17 mess" };
          state.residents.push(res); row.residentId = res.id;
        }
        b.people.push(row);
      }
      state.batches.unshift(b);
      const byHostel = {};
      for (const p of b.people) byHostel[p.hostel] = (byHostel[p.hostel] || 0) + 1;
      for (const [h, n] of Object.entries(byHostel)) notify("hm:" + h, `HCU uploaded ${n} new resident${n > 1 ? "s" : ""} for ${hostelName(h)} (${name}). Allot rooms.`, "#/hm/actions");
      commit();
      return b;
    },

    /* ----- Hall Manager ----- */
    acceptRequest(id) {
      const r = sel.request(id); if (!r) return;
      r.status = "accepted";
      log(r, hmName(r), "hm", "accepted", "Accepted. Rooms being allotted.");
      tellOwner(r, `${hostelName(r.hostel)} accepted “${r.title}”. Rooms will be allotted shortly.`);
      closeUpdatesFor(id, "accepted");
      commit();
    },
    rejectRequest(id, reason) {
      const r = sel.request(id); if (!r) return;
      r.status = "rejected"; r.rejectReason = reason || ""; r.rejectedBy = hmName(r); r.rejectedAt = "pending";
      log(r, hmName(r), "hm", "rejected", reason);
      tellOwner(r, `${hostelName(r.hostel)} rejected “${r.title}”: ${reason}`);
      if (r.source !== "student") notify("hcu", `${hostelName(r.hostel)} rejected “${r.title}”: ${reason}. It may need another hostel.`, "#/hcu/requests/" + id);
      closeUpdatesFor(id, "rejected");
      commit();
    },

    /** Put the given guests into `room` for their request's dates */
    allotGuests(room, guestIds) {
      for (const gid of guestIds) {
        const g = sel.guest(gid); const r = sel.request(g.requestId);
        state.stays.push({ id: nid("ST"), room, kind: "guest", personId: gid, from: r.from, to: r.to });
      }
      syncAllotted();
      commit();
    },

    /** Give an unhoused resident a room (from "Add resident" in the allot dialog) */
    allotResident(room, residentId, from) {
      const r = sel.resident(residentId);
      if (r.room) act.vacateResident(r.id, from, true);
      r.room = room;
      state.stays.push({ id: nid("ST"), room, kind: "resident", personId: r.id, from, to: r.expectedExit });
      r.history.unshift({ type: "allotted", room, date: from });
      notify("student:" + r.id, `You've been allotted room ${room} in Hostel 17 from ${D.fmt(from)}.`, "#/student/home");
      commit();
    },
    /** Move a resident to another room from `day`, keeping history */
    moveResident(residentId, room, day) {
      const r = sel.resident(residentId); if (!r) return;
      const old = r.room;
      if (old) act.vacateResident(r.id, day, true);
      r.room = room;
      state.stays.push({ id: nid("ST"), room, kind: "resident", personId: r.id, from: day, to: r.expectedExit });
      r.history.unshift({ type: "allotted", room, date: day });
      notify("student:" + r.id, `Your room changes from ${old || "—"} to ${room} on ${D.fmt(day)}.`, "#/student/home");
      commit();
    },
    swapResidents(aId, bId, day) {
      const a = sel.resident(aId), b = sel.resident(bId); if (!a || !b || !a.room || !b.room) return;
      const ra = a.room, rb = b.room;
      act.vacateResident(a.id, day, true); act.vacateResident(b.id, day, true);
      for (const [p, room] of [[a, rb], [b, ra]]) {
        p.room = room;
        state.stays.push({ id: nid("ST"), room, kind: "resident", personId: p.id, from: day, to: p.expectedExit });
        p.history.unshift({ type: "allotted", room, date: day });
        notify("student:" + p.id, `Your room changes to ${room} on ${D.fmt(day)} (swap).`, "#/student/home");
      }
      commit();
    },
    /** Resident arriving from another hostel */
    shiftIn(data) {
      const res = { id: nid("RS"), hostel: "H17", roll: data.roll, name: data.name, programGroup: data.programGroup, degree: data.degree, dept: data.dept, semester: Number(data.semester) || 1, phone: data.phone || "", email: data.roll.toLowerCase() + "@iitb.ac.in", dob: "", gender: "Female", nationality: "Indian", blood: "—", homeAddress: "—", joined: TODAY(), expectedExit: D.add(TODAY(), 700), advisor: { name: "—", phone: "" }, guardian: { name: "—", relation: "", phone: "" }, mentor: { name: "—", phone: "" }, emergency: ["", ""], remarks: [], room: null, history: [{ type: "shift", date: TODAY(), note: "Hostel shift from " + hostelName(data.from) + " to 17" }], mess: "Hostel 17 mess" };
      state.residents.push(res);
      if (data.room) act.allotResident(data.room, res.id, TODAY()); else commit();
      return res;
    },

    /** Walk-in / new person typed into "Add resident" — creates a single-person request */
    addWalkInGuest(room, name, from, to, comments) {
      const id = nid("RQ");
      const g = { id: nid("GS"), name, contact: "", requestId: id, relation: "Walk-in", gender: "Female" };
      state.guests.push(g);
      const r = { id, type: "direct", kind: "individual", source: "hall-manager", owner: "", requestedBy: "Hall Manager", title: name, count: 1, gender: "Female", from, to, requestedOn: TODAY(), contact: "", comments: comments || "Added directly by Hall Manager.", documents: [], hostel: "H17", status: "allotted", guestIds: [g.id], timeline: [] };
      log(r, "Hall Manager, Hostel 17", "hm", "allotted", "Walk-in, room " + room + ".");
      state.requests.push(r);
      state.stays.push({ id: nid("ST"), room, kind: "guest", personId: g.id, from, to });
      notify("hcu", `Hostel 17 took in a walk-in guest (${name}) in room ${room}.`, "#/hcu/requests/" + id);
      commit();
    },

    extendStay(stayId, to) {
      const s = state.stays.find((x) => x.id === stayId); if (!s) return;
      s.to = to;
      if (s.kind === "guest") { const g = sel.guest(s.personId); const r = sel.request(g.requestId); if (r && to > r.to) { r.to = to; log(r, hmName(r), "hm", "extension", "Stay extended to " + D.fmt(to) + "."); tellOwner(r, `Stay for “${r.title}” extended to ${D.fmt(to)}.`); notify("hcu", `${hostelName(r.hostel)} extended “${r.title}” to ${D.fmt(to)}.`, "#/hcu/reports"); } }
      commit();
    },

    updateRequestDates(id, from, to) {
      const r = sel.request(id); if (!r) return;
      for (const s of sel.requestStays(id)) { if (s.from === r.from) s.from = from; if (s.to === r.to) s.to = to; }
      r.from = from; r.to = to;
      log(r, hmName(r), "hm", "note", "Dates changed to " + D.fmt(from) + " – " + D.fmt(to) + ".");
      tellOwner(r, `Dates for “${r.title}” are now ${D.fmt(from)} – ${D.fmt(to)}.`);
      commit();
    },

    checkOutStay(stayId, day) {
      const s = state.stays.find((x) => x.id === stayId); if (!s) return;
      s.to = D.add(day, -1) < s.from ? s.from : D.add(day, -1);
      if (s.kind === "guest") state.stays = state.stays.filter((x) => !(x.id === stayId && x.from > x.to));
      commit();
    },

    vacateResident(id, day, silent) {
      const r = sel.resident(id); if (!r || !r.room) return;
      const st = state.stays.find((s) => s.personId === id && s.kind === "resident" && D.overlaps(s.from, s.to, day));
      if (st) st.to = D.add(day, -1) < st.from ? st.from : D.add(day, -1);
      // future stays in the same room are dropped
      state.stays = state.stays.filter((s) => !(s.personId === id && s.kind === "resident" && s.from >= day && s !== st));
      r.history.unshift({ type: "vacated", room: r.room, date: day });
      r.room = null;
      if (!silent) { notify("student:" + id, `Room vacated on ${D.fmt(day)}.`, "#/student/home"); commit(); }
    },
    /** Semester-end: vacate every resident matching the filter */
    bulkVacate(filter, day) {
      const list = state.residents.filter((r) => r.room && filter(r));
      for (const r of list) act.vacateResident(r.id, day, true);
      commit();
      return list.length;
    },
    /** Fill free rooms with unhoused residents, floor by floor */
    autoAllotResidents(ids, day, floor) {
      const free = HMS.floorplan.allRooms().filter((r) => sel.roomFreeBetween(r, day, "9999-12-31")).sort((a, b) => (floor ? (HMS.floorplan.parseRoom(b).floor === floor) - (HMS.floorplan.parseRoom(a).floor === floor) : 0) || a.localeCompare(b));
      const done = [];
      for (const id of ids) { const room = free.shift(); if (!room) break; act.allotResident(room, id, day); done.push([id, room]); }
      if (done.length) {
        state.recentAllotments = state.recentAllotments || [];
        const batchRecord = {
          id: nid("AL"),
          at: TODAY(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          floor: floor || "Any floor",
          count: done.length,
          residents: done.map(([id, room]) => {
            const r = sel.resident(id);
            return { id, name: r ? r.name : "Resident", roll: r ? r.roll : "—", dept: r ? r.dept : "—", degree: r ? r.degree : "—", room };
          }),
        };
        state.recentAllotments.unshift(batchRecord);
        if (state.recentAllotments.length > 10) state.recentAllotments.pop();

        state.updates.unshift({
          id: nid("UP"),
          hostel: "H17",
          type: "batch-allot",
          title: `Auto-allotted ${done.length} resident${done.length > 1 ? "s" : ""}`,
          body: `Allotted to rooms: ${done.map(([_, rm]) => rm).join(", ")}${floor ? " (Floor " + floor + ")" : ""}. Highlighted on the map and resident list.`,
          from: day,
          to: null,
          state: "accepted",
        });
        notify("hm:H17", `Auto-allotment finished: ${done.length} residents placed in rooms.`, "#/hm/actions?tab=batch");
        notify("hcu", `Hostel 17 auto-allotted ${done.length} residents (${done.map(([_, rm]) => rm).join(", ")}).`, "#/hcu/dashboard");
      }
      return done;
    },
    clearRecentAllotments() {
      state.recentAllotments = [];
      commit();
    },

    setMaintenance(room, note, from, to) { state.maintenance.push({ id: nid("MT"), room, from, to: to || null, note, reportedBy: "Hall Manager" }); commit(); },
    clearMaintenance(room, day) { for (const m of state.maintenance) if (m.room === room && D.overlaps(m.from, m.to, day)) m.to = D.add(day, -1) < m.from ? m.from : D.add(day, -1); commit(); },

    updateResident(id, patch) { Object.assign(sel.resident(id), patch); commit(); },
    addRemark(id, text, by) { sel.resident(id).remarks.unshift({ text, date: TODAY(), by: by || "Hall Manager" }); commit(); },

    /** Hall Manager books guests on someone's behalf (Book dialog · 306:2388) */
    createRequest(data) {
      const id = nid("RQ");
      const isMultiple = (data.guests || []).length > 1;
      const firstGuest = (data.guests || [])[0] || { name: "Guest", contact: "", gender: "Female", relation: "" };
      const r = {
        id, type: "direct", kind: isMultiple ? "group" : "individual", source: "hall-manager", owner: "",
        requestedBy: data.requestedBy || "Hall Manager (Direct)", title: data.title || (isMultiple ? `${data.guests.length} guests` : firstGuest.name),
        count: (data.guests || []).length, gender: firstGuest.gender || "Female",
        from: data.from, to: data.to, requestedOn: TODAY(), contact: data.contact || firstGuest.contact || "",
        comments: data.comments || "Direct booking entered by Hall Manager.", documents: [], hostel: "H17",
        status: data.room ? "allotted" : "pending", guestIds: [], timeline: [],
        recentlyAdded: true, isRecent: true,
      };
      for (const g of (data.guests || [])) {
        const gg = { id: nid("GS"), name: g.name, contact: g.contact || data.contact || "", requestId: id, relation: g.relation || "Guest", gender: g.gender || "Female" };
        state.guests.push(gg);
        r.guestIds.push(gg.id);
      }
      log(r, "Hall Manager, Hostel 17", "hm", "submitted", `Direct guest booking (${r.count} guest${r.count > 1 ? "s" : ""}, ${D.fmt(r.from)} – ${D.fmt(r.to)}).`);
      if (data.room) {
        log(r, "Hall Manager, Hostel 17", "hm", "allotted", `Room ${data.room} allotted directly on booking.`);
        for (const gid of r.guestIds) {
          state.stays.push({ id: nid("ST"), room: data.room, kind: "guest", personId: gid, from: data.from, to: data.to });
        }
        state.recentAllotments = state.recentAllotments || [];
        state.recentAllotments.unshift({
          id: nid("AL"),
          at: TODAY(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          floor: HMS.floorplan.parseRoom(data.room).floor,
          count: r.guestIds.length,
          residents: r.guestIds.map((gid) => ({ id: gid, name: sel.guest(gid).name, roll: "Guest", dept: "Direct Booking", degree: "Guest Stay", room: data.room })),
        });
      }
      state.requests.unshift(r);
      state.updates.unshift({
        id: nid("UP"),
        hostel: "H17",
        type: "request",
        requestId: id,
        title: `Guest booking · ${r.title}`,
        body: `${r.count} guest${r.count > 1 ? "s" : ""} · Hosted by ${r.requestedBy}${data.room ? " · Allotted room " + data.room : ""}`,
        from: r.from,
        to: r.to,
        state: "accepted",
      });
      notify("hm:H17", `Guest booking recorded: ${r.title} (${r.count} guest${r.count > 1 ? "s" : ""})${data.room ? " in Room " + data.room : ""}.`, "#/hm/requests");
      notify("hcu", `Hostel 17: Guest booking added for ${r.title} (${r.requestedBy}).`, "#/hcu/requests/" + id);
      commit();
      return r;
    },

    /** Record student request/stay that was handled offline at the hostel office */
    createOfflineStudentRequest(data) {
      let res = data.roll ? state.residents.find((x) => x.roll.toLowerCase() === data.roll.trim().toLowerCase()) : null;
      if (!res && data.name) {
        res = {
          id: nid("RS"),
          hostel: "H17",
          roll: (data.roll || "TEMP-" + Math.floor(Math.random() * 8999 + 1000)).toUpperCase(),
          name: data.name.trim(),
          programGroup: data.programGroup || "Masters",
          degree: data.degree || "M.Tech.",
          dept: data.dept || "IDC",
          semester: Number(data.semester) || 1,
          phone: data.phone || "",
          email: (data.roll ? data.roll.toLowerCase() : "student") + "@iitb.ac.in",
          dob: "",
          gender: "Female",
          nationality: "Indian",
          blood: "—",
          homeAddress: "—",
          joined: data.from || TODAY(),
          expectedExit: data.to ? D.add(data.to, 365) : D.add(TODAY(), 730),
          advisor: { name: "—", phone: "" },
          guardian: { name: "—", relation: "", phone: "" },
          mentor: { name: "—", phone: "" },
          emergency: ["", ""],
          remarks: [{ text: `Offline request entry: ${data.purpose || data.comments || "Direct student allotment at office"}`, date: TODAY(), by: "Hall Manager" }],
          room: null,
          history: [{ type: "offline-entry", date: TODAY(), note: "Recorded offline request at office" }],
          mess: "Hostel 17 mess",
        };
        state.residents.push(res);
      } else if (res && data.comments) {
        res.remarks.unshift({ text: `Offline request: ${data.purpose || data.comments}`, date: TODAY(), by: "Hall Manager" });
      }

      const id = nid("RQ");
      const r = {
        id,
        type: "direct",
        kind: "individual",
        source: "hall-manager",
        owner: res ? "student:" + res.id : "",
        requestedBy: (res ? res.name : data.name) + " (Offline Entry)",
        requesterRoll: res ? res.roll : data.roll,
        title: `Offline request · ${res ? res.name : data.name}`,
        count: 1,
        gender: "Female",
        from: data.from || TODAY(),
        to: data.to || D.add(TODAY(), 3),
        requestedOn: TODAY(),
        contact: data.phone || (res ? res.phone : ""),
        comments: `[Offline in-person request] ${data.purpose ? data.purpose + " — " : ""}${data.comments || "Handled at hostel office"}`,
        documents: data.documents || [],
        hostel: "H17",
        status: data.room ? "allotted" : "accepted",
        guestIds: [],
        timeline: [],
      };
      log(r, "Hall Manager, Hostel 17", "hm", "submitted", `Offline student request recorded by Hall Manager (${res ? res.name : data.name}).`);

      if (data.room && res) {
        act.allotResident(data.room, res.id, data.from || TODAY());
        log(r, "Hall Manager, Hostel 17", "hm", "allotted", `Allotted to Room ${data.room}.`);
        state.recentAllotments = state.recentAllotments || [];
        state.recentAllotments.unshift({
          id: nid("AL"),
          at: TODAY(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          floor: HMS.floorplan.parseRoom(data.room).floor,
          count: 1,
          residents: [{ id: res.id, name: res.name, roll: res.roll, dept: res.dept, degree: res.degree, room: data.room }],
        });
      }

      state.requests.unshift(r);
      state.updates.unshift({
        id: nid("UP"),
        hostel: "H17",
        type: "request",
        requestId: id,
        title: `Offline student request · ${res ? res.name : data.name}`,
        body: `${data.purpose || "Accommodation request"} · ${D.fmt(r.from)} – ${D.fmt(r.to)}${data.room ? " · Allotted room " + data.room : ""}`,
        from: r.from,
        to: r.to,
        state: "accepted",
      });
      notify("hcu", `Hostel 17 recorded an offline student accommodation for ${res ? res.name : data.name}${data.room ? ` in room ${data.room}` : ""}.`, "#/hcu/requests/" + id);
      commit();
      return { request: r, resident: res };
    },

    resolveUpdate(id, accepted) {
      const u = byId(state.updates, id); if (!u) return;
      u.state = accepted ? "accepted" : "rejected";
      const r = u.requestId ? sel.request(u.requestId) : null;
      if (u.type === "request" && r) {
        if (accepted) { r.status = "accepted"; log(r, hmName(r), "hm", "accepted", "Accepted. Rooms being allotted."); tellOwner(r, `${hostelName(r.hostel)} accepted “${r.title}”. Rooms will be allotted shortly.`); }
        else { r.status = "rejected"; r.rejectReason = "Declined from the Updates panel."; r.rejectedBy = hmName(r); r.rejectedAt = "pending"; log(r, hmName(r), "hm", "rejected", r.rejectReason); tellOwner(r, `${hostelName(r.hostel)} declined “${r.title}”.`); }
      }
      if (u.type === "extension" && r) {
        if (accepted) { for (const s of sel.requestStays(r.id)) s.to = u.to; r.to = u.to; }
        if (r.extension) r.extension.state = accepted ? "approved" : "declined";
        log(r, hmName(r), "hm", "extension", accepted ? "Extension approved to " + D.fmt(u.to) + "." : "Extension declined.");
        tellOwner(r, accepted ? `Extension for “${r.title}” approved to ${D.fmt(u.to)}.` : `Extension for “${r.title}” was declined.`);
        notify("hcu", `${hostelName(r.hostel)} ${accepted ? "approved" : "declined"} an extension on “${r.title}”.`, "#/hcu/reports");
      }
      if (u.type === "maintenance" && accepted) state.maintenance.push({ id: nid("MT"), room: u.room, from: TODAY(), to: null, note: u.body, reportedBy: "Resident" });
      if (u.type === "maintenance" && u.residentId) notify("student:" + u.residentId, accepted ? `Room ${u.room} is marked for repair. The maintenance cell will visit.` : `Your repair report for ${u.room} was closed.`, "#/student/home");
      if (u.type === "leave") { const res = sel.resident(u.residentId); if (res) { res.remarks.unshift({ text: `On leave ${D.fmt(u.from)} – ${D.fmt(u.to)}. Room retained.`, date: TODAY(), by: "Hall Manager" }); notify("student:" + res.id, "Hall Manager noted your leave. Your room stays yours.", "#/student/home"); } }
      if (u.type === "form") act.decideForm(u.formId, accepted, "", true);
      commit();
    },

    /* ----- Student forms ----- */
    submitForm(residentId, type, data) {
      const res = sel.resident(residentId);
      const f = { id: nid("FM"), type, residentId, hostel: res.hostel, data, status: "submitted", submittedOn: TODAY(), note: "" };
      state.forms.unshift(f);
      const L = HMS.formTypes[type];
      if (L.to === "hcu") notify("hcu", `${res.name} submitted a ${L.label.toLowerCase()}.`, "#/hcu/batches");
      else {
        state.updates.unshift({ id: nid("UP"), hostel: res.hostel, type: "form", formId: f.id, title: L.label.replace(/ form$/, "") + " · " + res.name, body: L.summary(data, res), from: TODAY(), to: null, state: "open" });
        notify("hm:" + res.hostel, `${res.name} submitted a ${L.label.toLowerCase()}.`, "#/hm/requests");
      }
      commit();
      return f;
    },
    decideForm(id, approved, note, silent) {
      const f = sel.form(id); if (!f) return;
      f.status = approved ? "approved" : "rejected"; f.decidedOn = TODAY(); f.note = note || "";
      for (const u of state.updates) if (u.formId === id && u.state === "open") u.state = approved ? "accepted" : "rejected";
      const res = sel.resident(f.residentId);
      const L = HMS.formTypes[f.type];
      if (approved && f.type === "vacation" && res.room) act.vacateResident(res.id, f.data.date, true);
      if (approved && f.type === "retention") res.remarks.unshift({ text: `Room retained ${D.fmt(f.data.from)} – ${D.fmt(f.data.to)}.`, date: TODAY(), by: "Hall Manager" });
      if (approved && f.type === "mess-dereg") res.mess = "Not registered";
      if (approved && f.type === "mess-reg") res.mess = f.data.mess;
      notify("student:" + res.id, `Your ${L.label.toLowerCase()} was ${approved ? "approved" : "not approved"}${note ? ": " + note : "."}`, "#/student/forms");
      if (!silent) commit();
    },
    reportRepair(residentId, note) {
      const res = sel.resident(residentId);
      state.updates.unshift({ id: nid("UP"), hostel: res.hostel, type: "maintenance", room: res.room, residentId, title: "Repair reported · Room " + res.room, body: note, from: TODAY(), to: null, state: "open" });
      notify("hm:" + res.hostel, `${res.name} reported a repair in room ${res.room}.`, "#/hm/dashboard");
      commit();
    },
    leaveNotice(residentId, from, to, note) {
      const res = sel.resident(residentId);
      state.updates.unshift({ id: nid("UP"), hostel: res.hostel, type: "leave", residentId, title: "Leave notice · " + res.name, body: `${note || "Going home."} Room ${res.room} stays retained.`, from, to, state: "open" });
      notify("hm:" + res.hostel, `${res.name} will be away ${D.fmt(from)} – ${D.fmt(to)}.`, "#/hm/dashboard");
      commit();
    },

    /* ----- Misc ----- */
    readNotif(id) { const n = state.notifications.find((x) => x.id === id); if (n) n.read = true; commit(); },
    markRead(target) { for (const n of state.notifications) if (n.to === target) n.read = true; commit(); },
    sendMessage(to, message, context, from) { state.updates.push({ id: nid("UP"), hostel: "H17", type: "sent", title: "Sent to " + to, body: message, context, from: TODAY(), to: null, state: "sent" }); if (to === "HCU Office") notify("hcu", `${from || "Hall Manager, Hostel 17"}: ${message}`, "#/hcu/dashboard"); commit(); },
    saveCustomTab(tab) { state.customTabs.push({ id: nid("TAB"), ...tab }); commit(); return state.customTabs[state.customTabs.length - 1]; },
    removeCustomTab(id) { state.customTabs = state.customTabs.filter((t) => t.id !== id); commit(); },
    setSetting(k, v) { state.settings[k] = v; commit(); },
    addStaff(p) { state.settings.staff.push(p); commit(); },
    removeStaff(i) { state.settings.staff.splice(i, 1); commit(); },
  };

  function closeUpdatesFor(requestId, to) { for (const u of state.updates) if (u.requestId === requestId && u.type === "request" && u.state === "open") u.state = to; }

  return { sel, act, subscribe, reset };
})();
