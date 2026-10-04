/* ==========================================================================
   Department Office portal — "for booking only" (IA 56:1186).
   Submit Visitor Request (type → guest list → documents), My Department
   Requests (active / past), Request detail and confirmation.
   ========================================================================== */
(function () {
  const S = HMS.store.sel, D = HMS.date, C = HMS.campus, SH = HMS.shared, R = HMS.requester;
  const app = HMS.app;
  const u = () => app.user() && app.user().role === "dept" ? app.user() : C.USERS.dept;

  function cfg() {
    const user = u();
    return {
      portal: "dept", owner: user.target, requestedBy: user.org, contact: "022 2576 7801",
      types: C.DEPT_TYPES,
      typeTitle: "Request type",
      typeHints: { outreach: "School or college visitors for an outreach programme", workshop: "Speakers and participants of a workshop or seminar", interview: "Candidates called for admission interviews", intern: "Project interns working in a lab", researcher: "Visiting faculty and researchers" },
      titleField: "Event or group name", titleLabel: "Name HCU and the hostel will see", titlePlaceholder: "e.g. Interaction Design workshop",
      heading: "Submit visitor request", guestTitle: "Guest details and list upload", relationHint: "Role", defaultRelation: "Participant", upload: true, defaultGender: "Female",
      guestHint: "Add people one by one or upload the participant list you already have (name, gender, mobile).",
      hostelPref: true, datesTitle: "Dates and hostel preference", datesHint: "HCU makes the final call based on free rooms.",
      purposeLabel: "Purpose", purposeHint: "What the visit is for. The Associate Dean SA reads this.",
      docsTitle: "Supporting documents", docsLabel: "Attach approval letter, event note or shortlist", needDocs: true,
      listHeading: "My Department Requests", newHref: "#/dept/new", newLabel: "Submit visitor request", listHref: "#/dept/requests", detailHref: (id) => "#/dept/requests/" + id,
      stats: (all) => [
        ["Waiting on Dean SA or HCU", all.filter((r) => r.status === "dean" || r.status === "hcu").length],
        ["With a Hall Manager", all.filter((r) => r.status === "pending" || r.status === "accepted").length],
        ["Guests on campus today", all.filter((r) => r.status === "allotted" && D.overlaps(r.from, r.to, HMS.TODAY)).reduce((n, r) => n + r.count, 0)],
        ["Requests this year", all.filter((r) => r.requestedOn >= "2026-01-01").length],
      ],
    };
  }

  app.portal({
    id: "dept",
    defaultPath: "requests",
    nav: [["requests", "My Requests"]],
    title: (r) => (r.path === "new" ? "New Request" : "My Requests"),
    active: (r) => (r.path === "new" ? "requests" : r.path),
    render(route, ctx) {
      const c = cfg(); R.register(c);
      if (route.path === "new") return R.form(c);
      return route.id ? R.detail(c, route.id) : R.list(c, ctx);
    },
    handlers: {},
  });
})();
