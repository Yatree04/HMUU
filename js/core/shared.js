/* ==========================================================================
   Shared pieces every portal uses: request status labels, the request
   timeline (where is my request?), student form definitions, small charts,
   CSV list parsing, and the guest-list editor used by all requesters.
   ========================================================================== */
window.HMS = window.HMS || {};

HMS.shared = (function () {
  const { icon, esc, kv } = HMS.ui;
  const D = HMS.date;
  const C = HMS.campus;

  /* Status as the requester sees it, and as staff see it */
  const STATUS = {
    dean: { cls: "badge-warn", label: "With Dean SA", staff: "Awaiting Dean SA" },
    hcu: { cls: "badge-warn", label: "With HCU", staff: "Needs a hostel" },
    pending: { cls: "badge-warn", label: "With Hall Manager", staff: "Waiting for you" },
    accepted: { cls: "badge-teal", label: "Accepted · room soon", staff: "Needs room" },
    allotted: { cls: "badge-teal", label: "Room allotted", staff: "Allotted" },
    completed: { cls: "badge-grey", label: "Completed", staff: "Completed" },
    rejected: { cls: "badge-danger", label: "Rejected", staff: "Rejected" },
    cancelled: { cls: "badge-grey", label: "Cancelled", staff: "Cancelled" },
  };
  const badge = (status, staff) => { const s = STATUS[status] || STATUS.pending; return `<span class="badge ${s.cls}">${staff ? s.staff : s.label}</span>`; };
  const isActive = (r) => ["dean", "hcu", "pending", "accepted", "allotted"].includes(r.status) && !(r.status === "allotted" && r.to < HMS.TODAY);
  const typeLabel = (r) => (C.TYPES[r.type] || { label: r.type }).label;
  const hostelName = (id) => (id ? (C.hostel(id) || { name: id }).name : "Not assigned");

  /** The stages this request goes through, in order */
  function stagesFor(r) {
    const t = C.TYPES[r.type] || {};
    const s = [{ key: "submitted", label: "Submitted" }];
    if (t.dean) s.push({ key: "dean", label: "Dean SA approval" });
    if (r.type !== "guest" && r.type !== "direct") s.push({ key: "hcu", label: "HCU picks hostel" });
    s.push({ key: "pending", label: "Hall Manager accepts" }, { key: "allotted", label: "Room allotted" });
    return s;
  }
  /** Horizontal stepper: done / current / todo / fail */
  function stepper(r) {
    const stages = stagesFor(r);
    const keys = stages.map((s) => s.key);
    const at = { dean: "dean", hcu: "hcu", pending: "pending", accepted: "allotted" }[r.status];
    const failKey = r.status === "rejected" ? (keys.includes(r.rejectedAt) ? r.rejectedAt : "pending") : null;
    const allDone = r.status === "allotted" || r.status === "completed";
    const curIdx = allDone ? keys.length : r.status === "cancelled" ? -1 : failKey ? keys.indexOf(failKey) : Math.max(1, keys.indexOf(at));
    return `<ol class="stepper" aria-label="Request progress">${stages.map((st, i) => {
      const cls = r.status === "cancelled" ? (i === 0 ? "done" : "todo") : i < curIdx ? "done" : i === curIdx ? (failKey ? "fail" : "current") : "todo";
      return `<li class="${cls}"><span class="dot">${cls === "done" ? icon("check") : cls === "fail" ? icon("x") : ""}</span><span>${st.label}</span></li>`;
    }).join("")}</ol>`;
  }
  const ACT = { submitted: "Submitted", approved: "Approved", partial: "Partly approved", routed: "Sent to hostel", accepted: "Accepted", allotted: "Rooms allotted", rejected: "Rejected", cancelled: "Cancelled", extension: "Extension", note: "Updated" };
  /** Vertical audit trail — who did what, when */
  function timeline(r) {
    const t = (r.timeline || []).slice().reverse();
    if (!t.length) return `<p class="muted" style="font-size:12px">No history yet.</p>`;
    return `<ol class="trail">${t.map((e) => `<li class="t-${e.act}"><div class="t-head"><b>${ACT[e.act] || esc(e.act)}</b><span class="muted num">${D.fmt(e.at)}</span></div><div class="t-who">${esc(e.who)}</div>${e.note ? `<div class="t-note">${esc(e.note)}</div>` : ""}</li>`).join("")}</ol>`;
  }
  /** "Who has it now" line under the status */
  function nextStep(r) {
    return {
      dean: "Associate Dean SA reviews the reason and documents.",
      hcu: "HCU picks a hostel with free rooms for these dates.",
      pending: `The Hall Manager of ${hostelName(r.hostel)} accepts and allots rooms.`,
      accepted: `The Hall Manager of ${hostelName(r.hostel)} is picking rooms.`,
      allotted: r.to < HMS.TODAY ? "Stay finished." : "All set. Show this page at the hostel office on arrival.",
      completed: "Stay finished.",
      rejected: r.rejectReason ? "Reason: " + r.rejectReason : "Rejected.",
      cancelled: "You cancelled this request.",
    }[r.status] || "";
  }

  /** Flat row for the list kit (search, filter and sort work on these values) */
  function requestRow(r, staff) {
    const S = HMS.store.sel;
    const names = r.guestIds.map((g) => (S.guest(g) || {}).name).filter(Boolean);
    const rooms = S.requestRooms(r.id);
    return {
      id: r.id, r,
      requestedOn: r.requestedOn, requestedBy: r.requestedBy,
      guests: r.kind === "group" ? r.title : names.join(", ") || r.title,
      count: r.count, type: typeLabel(r), from: r.from, to: r.to, days: D.days(r.from, r.to) + 1,
      hostel: hostelName(r.hostel), rooms: rooms.length > 2 ? rooms.length + " rooms" : rooms.join(", "),
      where: r.hostel ? hostelName(r.hostel) + (rooms.length ? " · " + (rooms.length > 2 ? rooms.length + " rooms" : rooms.join(", ")) : "") : "Not assigned yet",
      status: (STATUS[r.status] || STATUS.pending)[staff ? "staff" : "label"],
      search: names.join(" ") + " " + r.comments,
    };
  }
  /** Column formatters shared by request tables */
  const col = {
    date: (v) => D.fmt(v),
    guests: (v, row) => `<span class="cell-main">${esc(v)}</span>${row.r.kind === "group" ? `<span class="group-tag">Group · ${row.count}</span>` : ""}`,
    status: (v, row, staff) => badge(row.r.status, staff),
    staffStatus: (v, row) => badge(row.r.status, true) + (row.r.extension && row.r.extension.state === "open" ? ` <span class="badge badge-warn">Extension</span>` : ""),
    reqStatus: (v, row) => badge(row.r.status) + (row.r.extension && row.r.extension.state === "open" ? ` <span class="badge badge-warn">Extension</span>` : ""),
    muted: (v) => `<span class="cell-muted">${esc(v)}</span>`,
  };

  /** Full request detail for requesters and reviewers */
  function requestDetail(r, opts = {}) {
    const S = HMS.store.sel;
    const place = S.guestPlacement(r.id);
    const guests = r.guestIds.map((g) => S.guest(g)).filter(Boolean);
    const dropped = (r.droppedGuestIds || []).map((g) => S.guest(g)).filter(Boolean);
    return `<div class="detail">
      <div class="detail-main">
        <div class="pcard">
          <div class="detail-top"><div><div class="req-kind">${esc(typeLabel(r))} · ${esc(r.id)}</div><h2 class="detail-title">${esc(r.title)}</h2></div>${badge(r.status, opts.staff)}</div>
          ${stepper(r)}
          <p class="next-step">${icon("clock")} ${esc(nextStep(r))}</p>
        </div>
        <div class="pcard"><h2>Stay</h2><div class="pgrid pgrid-3">
          ${kv("Requested by", esc(r.requestedBy) + (r.requesterRoll ? " · " + esc(r.requesterRoll) : ""))}${kv("Requested on", D.fmt(r.requestedOn))}${kv("Hostel", esc(hostelName(r.hostel)))}
          ${kv("From", D.fmt(r.from))}${kv("To", D.fmt(r.to))}${kv("Nights", D.days(r.from, r.to))}
          ${kv("Guests", r.count + (r.gender ? " · " + esc(r.gender) : ""))}${kv("Preferred hostel", esc(r.preferredHostel ? hostelName(r.preferredHostel) : "No preference"))}${kv("Contact", esc(r.contact || "—"))}
          <div style="grid-column:1/-1">${kv("Purpose", esc(r.comments || "—"), "comments")}</div>
          ${r.deanNote ? `<div style="grid-column:1/-1">${kv("Note from Associate Dean SA", esc(r.deanNote), "comments")}</div>` : ""}
          ${r.extension ? `<div style="grid-column:1/-1">${kv("Extension", `To ${D.fmt(r.extension.to)} · <span class="badge ${r.extension.state === "approved" ? "badge-teal" : r.extension.state === "declined" ? "badge-danger" : "badge-warn"}">${r.extension.state === "open" ? "Waiting for Hall Manager" : r.extension.state}</span>`)}</div>` : ""}
        </div></div>
        <div class="pcard"><h2>Documents</h2>${r.documents && r.documents.length ? `<ul class="docs">${r.documents.map((d) => `<li>${icon("file")} <span>${esc(d)}</span></li>`).join("")}</ul>` : `<p class="muted" style="font-size:12px;margin:0">No documents attached.</p>`}</div>
        <div class="pcard"><h2>Guests (${guests.length})</h2>
          <div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Gender</th><th>Relation / role</th><th>Room</th></tr></thead><tbody>
          ${guests.map((g) => `<tr><td>${esc(g.name)}</td><td style="font-weight:400">${esc(g.gender || "—")}</td><td style="font-weight:400">${esc(g.relation || "—")}</td><td>${place[g.id] ? esc(place[g.id]) : `<span class="muted" style="font-weight:400">${r.status === "completed" ? "Stayed" : ["rejected", "cancelled"].includes(r.status) ? "—" : "Not yet"}</span>`}</td></tr>`).join("")}
          ${dropped.map((g) => `<tr class="struck"><td>${esc(g.name)}</td><td style="font-weight:400">${esc(g.gender || "—")}</td><td style="font-weight:400">${esc(g.relation || "—")}</td><td><span class="badge badge-grey">Not approved</span></td></tr>`).join("")}
          </tbody></table></div>
        </div>
        ${opts.extra || ""}
      </div>
      <aside class="history" aria-label="Request history"><h2>History</h2>${timeline(r)}</aside>
    </div>`;
  }

  /* ------------------------------ Forms ------------------------------ */
  // `to`: who decides. `fields`: [name, label, type, options]
  HMS.formTypes = {
    retention: { label: "Room retention form", to: "hm", blurb: "Keep your room over a semester break.", fields: [["from", "From", "date"], ["to", "To", "date"], ["reason", "Why you're staying", "textarea"]], summary: (d, r) => `Keep ${r.room} over ${D.fmt(d.from)} – ${D.fmt(d.to)}. ${d.reason || ""}` },
    vacation: { label: "Room vacation form", to: "hm", blurb: "Leaving the hostel for good. Frees your room on the date.", fields: [["date", "Vacate on", "date"], ["reason", "Reason", "textarea"]], summary: (d, r) => `Vacating ${r.room} on ${D.fmt(d.date)}. ${d.reason || ""}` },
    preference: { label: "Hostel preference form", to: "hcu", blurb: "At the start of your programme: which hostels you'd like.", fields: [["first", "First choice", "hostel"], ["second", "Second choice", "hostel"], ["reason", "Anything HCU should know", "textarea"]], summary: (d) => `1st ${d.first}, 2nd ${d.second}. ${d.reason || ""}` },
    "mess-reg": { label: "Mess registration", to: "hm", blurb: "Register for a hostel mess from a date.", fields: [["mess", "Mess", "select", ["Hostel 17 mess", "Hostel 10 mess", "Hostel 15 mess"]], ["from", "From", "date"]], summary: (d) => `${d.mess} from ${D.fmt(d.from)}.` },
    "mess-dereg": { label: "Mess de-registration", to: "hm", blurb: "Stop mess charges, e.g. during an internship away.", fields: [["from", "From", "date"], ["to", "To", "date"], ["reason", "Reason", "textarea"]], summary: (d) => `No mess ${D.fmt(d.from)} – ${D.fmt(d.to)}. ${d.reason || ""}` },
    "room-change": { label: "Room change request", to: "hm", blurb: "Shift to another room in this hostel.", fields: [["prefer", "Room or area you'd prefer", "text"], ["reason", "Reason", "textarea"]], summary: (d, r) => `Room ${r.room}. ${d.reason || ""} Prefers: ${d.prefer || "any"}.` },
  };
  const FORM_STATUS = { submitted: ["badge-warn", "Waiting"], approved: ["badge-teal", "Approved"], rejected: ["badge-danger", "Not approved"] };
  const formBadge = (s) => `<span class="badge ${FORM_STATUS[s][0]}">${FORM_STATUS[s][1]}</span>`;

  /* ------------------------------ Charts ------------------------------ */
  /** Horizontal bars: rows = [{label, value, max, sub}] */
  function bars(rows, opts = {}) {
    const max = opts.max || Math.max(1, ...rows.map((r) => r.max || r.value));
    return `<div class="bars">${rows.map((r) => {
      const pct = Math.round(((r.value || 0) / (r.max || max)) * 100);
      return `<div class="bar-row" ${r.href ? `data-act="go" data-href="${r.href}" role="button" tabindex="0"` : ""}><span class="bar-label">${esc(r.label)}</span><span class="bar-track"><span class="bar-fill ${r.max && pct > 92 ? "hot" : ""}" style="width:${Math.min(100, pct)}%"></span></span><span class="bar-val num">${r.sub != null ? r.sub : r.value}</span></div>`;
    }).join("")}</div>`;
  }
  /** Stacked capacity strip for a hostel: occupied | guests | repair | free */
  function capStrip(h) {
    const c = h.capacity || 1;
    const p = (n) => (n / c) * 100;
    return `<span class="cap" title="${h.occupied} residents · ${h.guests} guests · ${h.maint} under repair · ${h.vacant} free">
      <span style="width:${p(h.occupied)}%" class="c-occ"></span><span style="width:${p(h.guests)}%" class="c-guest"></span><span style="width:${p(h.maint)}%" class="c-maint"></span></span>`;
  }

  /* ------------------------- Guest list editor ------------------------- */
  /** Parse "name, gender, contact" lines or CSV text into guests */
  function parseList(text, defGender) {
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).filter((l) => !/^name\s*,/i.test(l)).map((l) => {
      const [name, gender, contact] = l.split(/[,\t;]/).map((x) => (x || "").trim());
      const g = /^f/i.test(gender) ? "Female" : /^m/i.test(gender) ? "Male" : defGender || "Female";
      return { name, gender: g, contact: contact || "", relation: "" };
    }).filter((g) => g.name);
  }
  function guestEditor(draft, opts = {}) {
    const rows = draft.guests.map((g, i) => `<tr>
      <td><input class="input" value="${esc(g.name)}" data-on-input="draftGuestField" data-i="${i}" data-k="name" aria-label="Name"></td>
      <td><select class="select-input" data-on-change="draftGuestField" data-i="${i}" data-k="gender" aria-label="Gender">${["Female", "Male"].map((x) => `<option ${g.gender === x ? "selected" : ""}>${x}</option>`).join("")}</select></td>
      ${opts.relation ? `<td><input class="input" value="${esc(g.relation)}" placeholder="${esc(opts.relationHint || "Relation")}" data-on-input="draftGuestField" data-i="${i}" data-k="relation" aria-label="Relation"></td>` : ""}
      <td><input class="input" value="${esc(g.contact)}" placeholder="Mobile" data-on-input="draftGuestField" data-i="${i}" data-k="contact" aria-label="Contact"></td>
      <td><button class="icon-btn" data-act="draftGuestRemove" data-i="${i}" aria-label="Remove ${esc(g.name)}">${icon("x")}</button></td></tr>`).join("");
    return `<div class="guest-editor">
      <div class="table-wrap"><table class="data form-table"><thead><tr><th>Name</th><th>Gender</th>${opts.relation ? `<th>${esc(opts.relationHint || "Relation")}</th>` : ""}<th>Contact</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5"><div class="empty" style="padding:18px">No one added yet.</div></td></tr>`}</tbody></table></div>
      <div class="editor-actions">
        <button class="btn btn-secondary" data-act="draftGuestAdd">${icon("plus")} Add a person</button>
        ${opts.upload ? `<label class="btn btn-secondary file-btn">${icon("upload")} Upload list (CSV)<input type="file" accept=".csv,.txt" data-on-change="draftUploadList" hidden></label>
        <button class="btn btn-secondary" data-act="draftPasteList">${icon("list")} Paste a list</button>
        <button class="link" data-act="draftSampleCsv" style="font-size:11px">Download sample CSV</button>` : ""}
      </div>
    </div>`;
  }
  function docsEditor(draft, label) {
    return `<div class="docs-edit">
      ${draft.documents.length ? `<ul class="docs">${draft.documents.map((d, i) => `<li>${icon("file")} <span>${esc(d)}</span><button class="icon-btn" data-act="draftDocRemove" data-i="${i}" aria-label="Remove ${esc(d)}">${icon("x")}</button></li>`).join("")}</ul>` : ""}
      <label class="dropzone">${icon("upload")}<span><b>${esc(label || "Attach documents")}</b><small>PDF, images or CSV. Only file names are kept in this prototype.</small></span><input type="file" multiple data-on-change="draftDocs" hidden></label>
    </div>`;
  }

  /** Availability hint for requesters: rooms free in a hostel for their dates */
  function availability(hostelId, from, to, n) {
    if (!from || !to || to < from) return "";
    const free = HMS.store.sel.hostelFreeBetween(hostelId, from, to);
    const ok = free >= n;
    return `<div class="avail ${ok ? "ok" : "low"}">${icon(ok ? "check" : "clock")} <span><b>${free}</b> room${free === 1 ? "" : "s"} free in ${esc(hostelName(hostelId))} for ${D.fmt(from)} – ${D.fmt(to)}${ok ? "" : ". The Hall Manager may suggest other dates."}</span></div>`;
  }

  return { STATUS, badge, isActive, typeLabel, hostelName, stagesFor, stepper, timeline, nextStep, requestRow, col, requestDetail, formBadge, bars, capStrip, parseList, guestEditor, docsEditor, availability };
})();
