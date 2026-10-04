/* ==========================================================================
   IRCC & Event Council portal — mass booking (IA 56:1214).
   Submit Batch Request (batch type, participant list, dates and hostel
   preference, authorisation documents), My Batches (active / past), Batch
   detail with per-person allocation, Extension request.
   Two demo accounts share this portal: IRCC Office and Student Event Council.
   ========================================================================== */
(function () {
  const D = HMS.date, C = HMS.campus, R = HMS.requester;
  const app = HMS.app;

  // Second account for the same portal
  C.USERS.event = { role: "ircc", name: "Student Event Council", initial: "E", title: "IRCC & Event Council · Mood Indigo, Techfest", org: "Event Council", target: "org:Event Council" };

  function cfg() {
    const user = app.user() && app.user().role === "ircc" ? app.user() : C.USERS.ircc;
    const isEvent = user.org === "Event Council";
    return {
      portal: "ircc", owner: user.target, requestedBy: isEvent ? "Student Event Council" : "IRCC", contact: isEvent ? "Council office" : "022 2576 7010",
      types: isEvent ? ["event"] : ["ircc-intern", "ir", "exam"],
      typeTitle: "Batch type",
      typeHints: { "ircc-intern": "Summer and winter research interns, usually 2–6 months", event: "Outstation participants for a student event", exam: "Candidates for an exam or interview round", ir: "Inbound IR and exchange students for a semester" },
      titleField: "Batch name", titleLabel: "Batch name", titlePlaceholder: isEvent ? "e.g. Mood Indigo 2026 participants" : "e.g. Winter interns 2026 · batch 2",
      heading: "Submit batch request", guestTitle: "Upload participant list", relationHint: "Role", defaultRelation: isEvent ? "Participant" : "Intern", upload: true, defaultGender: "Female",
      guestHint: "Upload the CSV you already maintain. HCU splits mixed batches between men's and women's hostels.",
      hostelPref: true, datesTitle: "Dates and hostel preference", datesHint: "Long stays (up to 6 months) are fine. Ask for extensions from the batch page later.",
      purposeLabel: "About this batch", purposeHint: "Programme, who is responsible on the ground, any constraints",
      docsTitle: "Authorisation documents", docsLabel: "Attach authorisation letter and offer letters", needDocs: true,
      listHeading: "My Batches", newHref: "#/ircc/new", newLabel: "Submit batch request", listHref: "#/ircc/batches", detailHref: (id) => "#/ircc/batches/" + id,
      stats: (all) => [
        ["Batches in progress", all.filter((r) => ["dean", "hcu", "pending", "accepted"].includes(r.status)).length],
        ["People on campus today", all.filter((r) => r.status === "allotted" && D.overlaps(r.from, r.to, HMS.TODAY)).reduce((n, r) => n + r.count, 0)],
        ["Extensions waiting", all.filter((r) => r.extension && r.extension.state === "open").length],
        ["Batches this year", all.filter((r) => r.requestedOn >= "2026-01-01").length],
      ],
    };
  }

  app.portal({
    id: "ircc",
    defaultPath: "batches",
    nav: [["batches", "My Batches"]],
    title: (r) => (r.path === "new" ? "New Batch Request" : "My Batches"),
    active: (r) => (r.path === "new" ? "batches" : r.path),
    render(route, ctx) {
      const c = cfg(); R.register(c);
      if (route.path === "new") return R.form(c);
      return route.id ? R.detail(c, route.id) : R.list(c, ctx);
    },
    handlers: {},
  });
})();
