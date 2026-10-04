/* ==========================================================================
   Associate Dean SA portal (IA 56:1114).
   Approvals Queue — IRCC, Department, IR Student and Individual requests;
   Approval detail and documents; Approve with note, Partial approval,
   Reject with reason. History — search by date and type.
   ========================================================================== */
(function () {
  const S = HMS.store.sel, A = HMS.store.act, D = HMS.date, UI = HMS.ui, C = HMS.campus, SH = HMS.shared;
  const { icon, esc, kv } = UI;
  const app = HMS.app;
  const ui = app.ui;
  const render = () => app.render();

  const waiting = () => S.requests().filter((r) => r.status === "dean");
  const decidedBy = (r) => (r.timeline || []).filter((e) => e.role === "dean").slice(-1)[0];

  /** One list: Waiting for you / Decided / All. Type and requester are filterable columns. */
  function queue() {
    const all = waiting();
    const t = S.turnaround();
    const oldest = all.length ? Math.max(...all.map((r) => D.days(r.requestedOn, HMS.TODAY))) : 0;
    const rows = S.requests().filter((r) => r.status === "dean" || decidedBy(r)).map((r) => {
      const dec = decidedBy(r);
      const clash = r.status === "dean" ? S.requests().filter((o) => o.id !== r.id && ["dean", "hcu", "pending", "accepted", "allotted"].includes(o.status) && o.count >= 10 && D.rangesOverlap(o.from, o.to, r.from, r.to)) : [];
      return { ...SH.requestRow(r), waited: D.days(r.requestedOn, dec ? dec.at : HMS.TODAY), people: r.count + " · " + r.gender, docs: (r.documents || []).length,
        decision: r.status === "dean" ? "Waiting" : dec.act === "rejected" ? "Rejected" : dec.act === "partial" ? "Partly approved" : "Approved", decidedOn: dec ? dec.at : "", clash: clash[0] ? clash[0].title + (clash.length > 1 ? ` +${clash.length - 1}` : "") : "" };
    });
    return `<section>
      <div class="page-head"><h1 class="page-title">Requests</h1></div>
      <div class="stats stats-4">
        <div class="stat stat-sm"><div class="stat-label">Waiting for you</div><div class="stat-value"><b>${all.length}</b><small>requests</small></div></div>
        <div class="stat stat-sm"><div class="stat-label">People in them</div><div class="stat-value"><b>${all.reduce((n, r) => n + r.count, 0)}</b></div></div>
        <div class="stat stat-sm"><div class="stat-label">Oldest waiting</div><div class="stat-value"><b>${oldest}</b><small>days</small></div></div>
        <div class="stat stat-sm"><div class="stat-label">Your average decision time</div><div class="stat-value"><b>${t.dean}</b><small>days</small></div></div>
      </div>
      ${HMS.list.render({
        key: "dean", rows, defaults: { sort: { key: "requestedOn", dir: 1 } },
        tabs: [
          { id: "waiting", label: "Waiting for you", test: (row) => row.r.status === "dean" },
          { id: "decided", label: "Decided", test: (row) => row.r.status !== "dean" },
          { id: "all", label: "All", test: () => true },
        ],
        cols: [
          { key: "guests", label: "Request", fmt: (v, row) => SH.col.guests(v, row) + (row.clash ? `<span class="cell-sub">${icon("info")} Overlaps ${esc(row.clash)}</span>` : "") },
          { key: "requestedBy", label: "Requested by", cls: "wrap-sm" },
          { key: "type", label: "Type", cls: "wrap-sm", fmt: SH.col.muted },
          { key: "people", label: "People" },
          { key: "from", label: "Arrival", fmt: SH.col.date },
          { key: "to", label: "Departure", fmt: SH.col.date },
          { key: "docs", label: "Docs" },
          { key: "waited", label: "Waited", fmt: (v, row) => row.r.status === "dean" ? `<span class="badge ${v > 3 ? "badge-danger" : "badge-grey"}">${v === 0 ? "Today" : v + " d"}</span>` : v + " d" },
          { key: "decision", label: "Decision", fmt: (v, row) => row.r.status === "dean" ? `<span class="badge badge-warn">Waiting</span>` : `<span class="badge ${v === "Rejected" ? "badge-danger" : "badge-teal"}">${v}</span>` },
        ],
        rowAttrs: (row) => `data-act="go" data-href="#/dean/approvals/${row.id}"`,
        actions: (row) => row.r.status === "dean" ? `<button class="btn btn-primary" data-act="go" data-href="#/dean/approvals/${row.id}">Review ${icon("caretRight")}</button>` : `<div class="actions"><button data-act="go" data-href="#/dean/approvals/${row.id}" aria-label="View">${icon("eye")}</button></div>`,
        empty: { title: "Nothing here", body: "New department, IRCC and event requests appear here first." },
      })}
    </section>`;
  }

  function review(ctx, id) {
    const r = S.request(id);
    if (!r) return `<div class="empty"><strong>Request not found</strong></div>`;
    const d = ctx.ui.dean;
    if (d.reviewId !== id) { d.reviewId = id; d.keep = [...r.guestIds]; d.from = r.from; d.to = r.to; d.mode = "full"; d.note = ""; }
    const guests = r.guestIds.map((g) => S.guest(g));
    const decision = r.status === "dean" ? `<div class="pcard decision">
        <h2>Your decision</h2>
        <div class="seg" role="group" aria-label="Decision type"><button aria-pressed="${d.mode === "full"}" data-act="deanMode" data-mode="full">Approve all</button><button aria-pressed="${d.mode === "partial"}" data-act="deanMode" data-mode="partial">Partial approval</button></div>
        ${d.mode === "partial" ? `<p class="muted" style="font-size:12px;margin:12px 0 6px">Untick people you don't approve, or shorten the dates.</p>
          <div class="pgrid" style="margin-bottom:10px"><label class="field"><span>From</span><input class="input" type="date" value="${d.from}" data-on-change="deanDate" data-k="from"></label><label class="field"><span>To</span><input class="input" type="date" value="${d.to}" data-on-change="deanDate" data-k="to"></label></div>
          <div class="check-list">${guests.map((g) => `<label><input type="checkbox" class="checkbox" data-on-change="deanKeep" data-id="${g.id}" ${d.keep.includes(g.id) ? "checked" : ""}> ${esc(g.name)} <small class="muted">${esc(g.gender)} · ${esc(g.relation)}</small></label>`).join("")}</div>
          <p class="muted" style="font-size:12px">${d.keep.length} of ${guests.length} approved.</p>` : ""}
        <label class="field" style="margin-top:12px"><span>Note to HCU and the requester</span><textarea class="input" id="dean-note" rows="3" data-on-input="deanNote" placeholder="e.g. Approved. Keep them close to IDC if possible.">${esc(d.note || "")}</textarea></label>
        <div class="row-end" style="margin-top:14px">
          <button class="btn btn-danger btn-lg" data-act="deanReject" data-id="${r.id}">${icon("x")} Reject with reason</button>
          <button class="btn btn-primary btn-lg" data-act="deanApprove" data-id="${r.id}" ${d.mode === "partial" && !d.keep.length ? "disabled" : ""}>${icon("check")} ${d.mode === "partial" ? "Approve " + d.keep.length : "Approve with note"}</button>
        </div>
      </div>` : "";
    return `<section>
      <button class="back" data-act="go" data-href="#/dean/approvals">${icon("caretLeft")} Requests</button>
      <div class="page-head"><h1 class="page-title">Approval<span class="sep">|</span>${esc(r.id)}</h1></div>
      ${SH.requestDetail(r, { extra: decision })}
    </section>`;
  }

  const handlers = {
    deanMode: (el) => { ui.dean.mode = el.dataset.mode; render(); },
    deanKeep: (el) => { const id = el.dataset.id; ui.dean.keep = el.checked ? [...new Set([...ui.dean.keep, id])] : ui.dean.keep.filter((x) => x !== id); render(); },
    deanDate: (el) => { ui.dean[el.dataset.k] = el.value; render(); },
    deanApprove: (el) => {
      const r = S.request(el.dataset.id); const note = (ui.dean.note || "").trim();
      const d = ui.dean;
      if (d.mode === "partial") {
        if (d.to < d.from) return UI.toast("End date must be after the start.");
        A.deanApprove(r.id, note, d.keep, { from: d.from, to: d.to });
      } else A.deanApprove(r.id, note);
      d.reviewId = null;
      app.go("#/dean/approvals");
      UI.toast(`Approved “${r.title}”. HCU will pick a hostel; ${r.requestedBy} has been told.`);
    },
    deanReject: (el) => {
      const r = S.request(el.dataset.id);
      app.form("Reject “" + r.title + "”?", `<label class="field"><span>Reason (sent to ${esc(r.requestedBy)})</span><textarea class="input" name="reason" rows="3" placeholder="e.g. Minors can't stay in student hostels. Please use the guest house."></textarea></label>`, "Reject",
        (v) => { if (!v.reason.trim()) return "Add a reason so they know what to change."; A.deanReject(r.id, v.reason.trim()); ui.dean.reviewId = null; setTimeout(() => app.go("#/dean/approvals"), 0); UI.toast("Rejected. " + r.requestedBy + " has been told."); }, { danger: true });
    },
    deanNote: (el) => { ui.dean.note = el.value; },
  };

  app.portal({
    id: "dean",
    defaultPath: "approvals",
    nav: [["approvals", "Requests"]],
    active: () => "approvals",
    title: () => "Requests",
    init(u) { u.dean = { reviewId: null, keep: [], mode: "full", from: "", to: "" }; },
    onRoute(route) { if (route.path === "history") { HMS.list.state("dean").tab = "decided"; route.path = "approvals"; } },
    render(route, ctx) { return route.id ? review(ctx, route.id) : queue(ctx); },
    handlers,
  });
})();
