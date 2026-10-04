/* ==========================================================================
   Student portal — own data only (IA: "STUDENT PORTAL: own data only").
   My Hostel (room, roommate, notices, quick actions), My Requests with a
   status timeline, New Request (guest stay), My Forms.
   ========================================================================== */
(function () {
  const S = HMS.store.sel, A = HMS.store.act, D = HMS.date, UI = HMS.ui, C = HMS.campus, SH = HMS.shared, FP = HMS.floorplan, R = HMS.requester;
  const { icon, esc, kv, phoneMask } = UI;
  const app = HMS.app;
  const me = () => S.resident(C.USERS.student.residentId);
  const owner = () => "student:" + me().id;

  function cfg() {
    const r = me();
    return {
      portal: "student", owner: owner(), requestedBy: r.name, requesterRoll: r.roll, contact: r.phone, fixedHostel: r.hostel, titleFromRequester: true,
      types: ["guest"], typeHints: {}, heading: "New guest request", guestTitle: "Guest details", relationHint: "Relation", defaultRelation: "", maxGuests: 4,
      guestHint: "Up to 4 guests. Parents, siblings and relatives can share a room.",
      requester: [["Name", r.name], ["Roll number", r.roll], ["Hostel / Room", "Hostel 17 · " + (r.room || "—")], ["Programme", r.degree + " · " + r.dept], ["Email", r.email], ["Mobile", phoneMask(r.phone)]],
      availabilityHostel: r.hostel, datesHint: "You see free rooms before you ask, so there's no surprise on the day.",
      purposeLabel: "Purpose of visit", purposeHint: "e.g. Parents visiting for convocation",
      docsTitle: "Documents upload", docsLabel: "Attach guest ID proof", docsHint: "Aadhaar, passport or any government ID for each guest.",
      listHeading: "My Requests", newHref: "#/student/new", newLabel: "New guest request", listHref: "#/student/requests", detailHref: (id) => "#/student/requests/" + id,
      defaultGender: "Female", startGuests: () => [{ name: "", gender: "Female", contact: "", relation: "" }],
    };
  }

  function miniMap(room) {
    const { floor, idx } = FP.parseRoom(room);
    const cells = FP.SLOTS.map((s) => `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="4.8" fill="${s.idx === idx ? "var(--primary-cta-bg)" : "#fff"}" stroke="${s.idx === idx ? "var(--primary-cta-bg)" : "var(--light-stroke)"}"/>`).join("");
    const c = FP.courtyard;
    return `<svg viewBox="${FP.viewBox}" class="mini-map" role="img" aria-label="Floor ${floor}, your room highlighted"><path d="${FP.outline}" fill="var(--primary-bg)" stroke="var(--colored-subheading)" stroke-width="2"/><rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="10" fill="#fff" stroke="var(--light-stroke)" stroke-width="2"/>${FP.blocks.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4.8" fill="${b.kind === "service" ? "var(--room-service-bg)" : "var(--room-common-bg)"}"/>`).join("")}${cells}</svg>`;
  }

  function home(ctx) {
    const r = me();
    const room = r.room;
    const roommates = room ? S.occupants(room, HMS.TODAY).filter((o) => o.person && o.person.id !== r.id) : [];
    const active = S.requestsOf(owner()).filter(SH.isActive);
    const notices = S.notices(r.hostel).slice(0, 4);
    const openForms = S.forms().filter((f) => f.residentId === r.id && f.status === "submitted");
    const quick = [
      ["go", "#/student/new", "user", "Request a guest stay", "Parents or relatives staying a few nights"],
      ["stuForm", "retention", "calendar", "Keep my room over a break", "Room retention form"],
      ["stuRepair", "", "wrench", "Report a repair", "Goes straight to the Hall Manager"],
      ["stuLeave", "", "home", "I'm going home", "Leave notice, room stays yours"],
      ["stuForm", "room-change", "swap", "Change my room", "Room change request"],
      ["stuForm", "mess-dereg", "form", "Pause mess charges", "Mess de-registration"],
    ];
    return `<section>
      <div class="dash-head"><h1>Hi ${esc(r.name.split(" ")[0])},</h1><span class="muted" style="font-size:12px">${D.fmtShort(HMS.TODAY)}</span></div>
      <div class="stu-grid">
        <div class="pcard room-card">
          <div class="room-card-top"><div><div class="req-kind">My room</div><div class="room-no num">${room ? "H17 · " + room : "Not allotted yet"}</div>
            ${room ? `<div class="muted" style="font-size:12px">Floor ${FP.parseRoom(room).floor} · Wing ${FP.wingOf(room)} · since ${D.fmt((r.history.find((h) => h.type === "allotted") || {}).date)}</div>` : `<div class="muted" style="font-size:12px">HCU has assigned you to Hostel 17. The Hall Manager will allot a room.</div>`}</div>
            <span class="badge ${room ? "badge-info" : "badge-warn"}">${room ? "Occupied" : "Waiting"}</span></div>
          ${room ? miniMap(room) : ""}
          <div class="pgrid pgrid-3" style="margin-top:12px">
            ${kv("Roommate", roommates.length ? esc(roommates.map((o) => o.person.name).join(", ")) : "Single occupancy")}
            ${kv("Mess", esc(r.mess || "—"))}${kv("Stay until", D.fmt(r.expectedExit))}
          </div>
        </div>
        <div class="stu-side">
          <div class="pcard"><h2>Quick actions</h2><div class="quick-grid">${quick.map(([a, v, ic, t, s]) => `<button class="quick" data-act="${a}" ${a === "go" ? `data-href="${v}"` : `data-type="${v}"`}>${icon(ic)}<span><b>${t}</b><small>${s}</small></span></button>`).join("")}</div></div>
          <div class="pcard"><h2>My active requests</h2>
            ${active.length ? active.map((q) => `<div class="mini-req" data-act="go" data-href="#/student/requests/${q.id}" role="button" tabindex="0"><div class="mini-req-top"><b>${esc(q.guestIds.map((g) => S.guest(g).name).join(", "))}</b>${SH.badge(q.status)}</div><div class="muted num" style="font-size:11px;margin:4px 0 8px">${D.fmt(q.from)} – ${D.fmt(q.to)}${S.requestRooms(q.id).length ? " · Room " + S.requestRooms(q.id).join(", ") : ""}</div>${SH.stepper(q)}</div>`).join("") : `<div class="empty" style="padding:18px"><strong>Nothing in progress</strong><button class="link" data-act="go" data-href="#/student/new">Request a guest stay</button></div>`}
            ${openForms.length ? `<p class="muted" style="font-size:12px;margin:12px 0 0">${openForms.length} form${openForms.length > 1 ? "s" : ""} waiting for the Hall Manager. <button class="link" data-act="go" data-href="#/student/forms">See forms</button></p>` : ""}
          </div>
        </div>
      </div>
      <div class="pcard" style="margin-top:20px"><h2>Notices and announcements</h2>
        <div class="notice-grid">${notices.map((n) => `<article class="notice"><div class="notice-top"><h3>${esc(n.title)}</h3><span class="muted num">${D.fmt(n.date)}</span></div><p>${esc(n.body)}</p><small class="muted">${esc(n.by)}</small></article>`).join("")}</div>
      </div>
    </section>`;
  }

  function forms() {
    const r = me();
    const mine = S.forms().filter((f) => f.residentId === r.id);
    const types = Object.entries(HMS.formTypes);
    return `<section>
      <div class="page-head"><h1 class="page-title">My Forms</h1></div>
      <div class="form-cards">${types.map(([k, L]) => `<article class="tool"><h3>${icon("form")} ${esc(L.label)}</h3><p>${esc(L.blurb)}</p><div class="row-end" style="justify-content:space-between"><small class="muted">Goes to ${L.to === "hcu" ? "HCU" : "Hall Manager"}</small><button class="btn btn-primary" data-act="stuForm" data-type="${k}">Fill form</button></div></article>`).join("")}</div>
      <h2 class="sec-title">Submitted forms history</h2>
      ${mine.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Submitted</th><th>Form</th><th>Details</th><th>Status</th><th>Decided</th><th>Note</th></tr></thead><tbody>
        ${mine.map((f) => `<tr><td>${D.fmt(f.submittedOn)}</td><td>${esc(HMS.formTypes[f.type].label)}</td><td style="font-weight:400;white-space:normal;max-width:340px">${esc(HMS.formTypes[f.type].summary(f.data, r))}</td><td>${SH.formBadge(f.status)}</td><td>${f.decidedOn ? D.fmt(f.decidedOn) : "—"}</td><td style="font-weight:400">${esc(f.note || "—")}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty"><strong>No forms yet</strong></div>`}
    </section>`;
  }

  function fieldHtml([name, label, type, options]) {
    if (type === "textarea") return `<label class="field"><span>${esc(label)}</span><textarea class="input" name="${name}" rows="3"></textarea></label>`;
    if (type === "select") return `<label class="field"><span>${esc(label)}</span><select class="select-input" name="${name}">${options.map((o) => `<option>${esc(o)}</option>`).join("")}</select></label>`;
    if (type === "hostel") return `<label class="field"><span>${esc(label)}</span><select class="select-input" name="${name}">${C.HOSTELS.filter((h) => h.gender !== "Male").map((h) => `<option>${esc(h.name)}</option>`).join("")}</select></label>`;
    const val = type === "date" ? (name === "to" ? D.add(HMS.TODAY, 14) : name === "date" ? D.add(HMS.TODAY, 7) : D.add(HMS.TODAY, 1)) : "";
    return `<label class="field"><span>${esc(label)}</span><input class="input" type="${type}" name="${name}" value="${val}"></label>`;
  }

  const handlers = {
    stuForm: (el) => {
      const k = el.dataset.type; const L = HMS.formTypes[k];
      app.form(L.label, L.fields.map(fieldHtml).join(""), "Submit",
        (v) => {
          if (v.from && v.to && v.to < v.from) return "The end date must be after the start.";
          if (L.fields.some(([n, , t]) => t === "textarea" && n === "reason" && k !== "preference" && !v[n].trim())) return "Add a reason.";
          A.submitForm(me().id, k, v);
          UI.toast(`Submitted to ${L.to === "hcu" ? "HCU" : "the Hall Manager"}. You'll be notified when it's decided.`);
          if (app.route.path !== "forms") app.go("#/student/forms");
        }, { intro: esc(L.blurb) + (me().room ? ` Your room: ${me().room}.` : "") });
    },
    stuRepair: () => app.form("Report a repair · Room " + me().room, `<label class="field"><span>What's wrong?</span><textarea class="input" name="note" rows="3" placeholder="e.g. Tube light flickering, window latch broken"></textarea></label>`, "Report",
      (v) => { if (!v.note.trim()) return "Describe the problem."; A.reportRepair(me().id, v.note.trim()); UI.toast("Reported to the Hall Manager"); }),
    stuLeave: () => app.form("Leave notice", `<div class="pgrid"><label class="field"><span>Leaving on</span><input class="input" type="date" name="from" value="${D.add(HMS.TODAY, 2)}"></label><label class="field"><span>Back on</span><input class="input" type="date" name="to" value="${D.add(HMS.TODAY, 9)}"></label></div>
      <label class="field"><span>Note (optional)</span><input class="input" name="note" placeholder="e.g. Going home for Diwali"></label>`, "Send",
      (v) => { if (v.to < v.from) return "Back date must be after leaving."; A.leaveNotice(me().id, v.from, v.to, v.note.trim()); UI.toast("The Hall Manager knows you're away. Your room stays yours."); }),
  };

  const TITLES = { home: "My Hostel", requests: "My Requests", new: "New Request", forms: "My Forms" };
  app.portal({
    id: "student",
    defaultPath: "home",
    nav: [["home", "My Hostel"], ["requests", "My Requests"], ["forms", "My Forms"]],
    title: (r) => TITLES[r.path] || "Student",
    active: (r) => (r.path === "new" ? "requests" : r.path),
    render(route, ctx) {
      const c = cfg(); R.register(c);
      if (route.path === "requests") return route.id ? R.detail(c, route.id) : R.list(c, ctx);
      if (route.path === "new") return R.form(c);
      if (route.path === "forms") return forms();
      return home(ctx);
    },
    handlers,
  });
})();
