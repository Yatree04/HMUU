/* ==========================================================================
   Dashboard — Figma 238:3313 (+ Updates panel 301:1609 placed to its right)
   ========================================================================== */
window.HMS = window.HMS || {};
HMS.views = HMS.views || {};

HMS.views.dashboard = (function () {
  const { icon, esc } = HMS.ui;
  const D = HMS.date;
  const S = HMS.store.sel;

  function datePills(day) {
    const [y, m, d] = day.split("-").map(Number);
    const days = new Date(y, m, 0).getDate();
    const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? "selected" : ""}>${label}</option>`;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `<div class="pills" role="group" aria-label="Date shown">
      <label class="pill-select"><span class="sr-only">Day</span><select data-on-change="setDatePart" data-part="d">${Array.from({ length: days }, (_, i) => opt(i + 1, d, "Day " + (i + 1))).join("")}</select>${icon("caretDown")}</label>
      <label class="pill-select"><span class="sr-only">Month</span><select data-on-change="setDatePart" data-part="m">${months.map((n, i) => opt(i + 1, m, n)).join("")}</select>${icon("caretDown")}</label>
      <label class="pill-select"><span class="sr-only">Year</span><select data-on-change="setDatePart" data-part="y">${[2025, 2026, 2027].map((v) => opt(v, y, v)).join("")}</select>${icon("caretDown")}</label>
    </div>`;
  }

  function stat(label, value, unit, go, small) {
    return `<div class="stat ${small ? "stat-sm" : ""}">
      <div class="stat-label">${label}</div>
      <div class="stat-value"><b>${value}</b>${unit ? `<small>${unit}</small>` : ""}</div>
      <button class="stat-link" data-act="go" data-href="${go}" aria-label="${label} details">Details ${icon("caretRight")}</button>
    </div>`;
  }

  function guestRows(day, q, sortAsc) {
    let list = S.inHouseRequests(day);
    if (q) list = list.filter((b) => (b.title + " " + b.requestedBy + " " + S.requestRooms(b.id).join(" ")).toLowerCase().includes(q.toLowerCase()));
    list.sort((a, b) => (sortAsc ? a.from.localeCompare(b.from) : b.from.localeCompare(a.from)));
    if (!list.length) return `<div class="empty"><strong>No guests on ${D.fmt(day)}</strong>Accepted requests appear here once rooms are allotted.</div>`;
    return list.map((b) => {
      const rooms = S.requestRooms(b.id);
      const roomLabel = rooms.length > 1 ? `${rooms[0]}- ${rooms[rooms.length - 1]}` : rooms[0] || "—";
      const tag = b.to === day ? `<span class="badge badge-warn tag">Leaves today</span>` : b.from === day ? `<span class="badge badge-teal tag">Arrives today</span>` : "";
      return `<div class="guest-row">
        <div class="who"><div class="name">${esc(b.title)}</div><div class="meta">${roomLabel}     |     ${D.fmt(b.from)} - ${D.fmt(b.to)}</div></div>
        ${tag}
        <button class="icon-btn" data-act="editRequestDates" data-id="${b.id}" aria-label="Edit ${esc(b.title)}">${icon("pencil")}</button>
      </div>`;
    }).join("");
  }

  function updateCard(u) {
    const done = u.state !== "open";
    const dates = u.to ? `${D.fmtShort(u.from).replace(/ \d{4}$/, "")} — ${D.fmtShort(u.to)}` : D.fmtShort(u.from);
    const [yes, no] = { request: ["Accept", "Reject"], extension: ["Approve", "Decline"], leave: ["Acknowledge", "Dismiss"], maintenance: ["Mark under repair", "Dismiss"], form: ["Approve", "Reject"] }[u.type] || ["Accept", "Reject"];
    return `<article class="update ${done ? "done" : ""}">
      <h3>${esc(u.title)}</h3>
      <p>${esc(u.body)}</p>
      <div class="when num">${dates}</div>
      ${done
        ? `<span class="resolved">${icon("check")} ${u.state === "accepted" ? "Done" : u.state === "sent" ? "Sent" : "Dismissed"}</span>`
        : `<div class="row">
            <button class="btn btn-secondary" data-act="resolveUpdate" data-id="${u.id}" data-ok="0">${icon("x")} ${no}</button>
            <button class="btn btn-primary" data-act="resolveUpdate" data-id="${u.id}" data-ok="1">${icon("check")} ${yes}</button>
            ${u.requestId ? `<button class="link" data-act="viewRequest" data-id="${u.requestId}" style="font-size:12px;margin-left:auto">Details</button>` : ""}
          </div>`}
    </article>`;
  }

  function updatesPanel(q) {
    let list = S.updates().filter((u) => u.type !== "sent");
    if (q) list = list.filter((u) => (u.title + u.body).toLowerCase().includes(q.toLowerCase()));
    list = [...list.filter((u) => u.state === "open"), ...list.filter((u) => u.state !== "open")];
    return list.length ? list.map(updateCard).join("") : `<div class="empty"><strong>Nothing needs you</strong>New requests from students, departments and HCU land here.</div>`;
  }

  function render(ctx) {
    const day = ctx.ui.day;
    const st = S.stats(day);
    const hostel = S.settings().hostel;
    return `<div class="dash" data-figma-node="238:3313">
      <section aria-labelledby="dash-title">
        <div class="dash-head"><h1 id="dash-title">${esc(hostel)},</h1>${datePills(day)}</div>
        ${S.unhousedResidents().length ? `<p class="note note-action">${icon("users")} ${S.unhousedResidents().length} new resident${S.unhousedResidents().length > 1 ? "s" : ""} from HCU need${S.unhousedResidents().length > 1 ? "" : "s"} a room. <button class="link" data-act="go" data-href="#/hm/actions?tab=batch">Allot now</button></p>` : ""}
        <div class="stats">
          ${stat("Total Rooms", st.total, "Rooms", "#/hm/map")}
          ${stat("Empty Rooms", st.empty, "Rooms", "#/hm/map?show=empty")}
          ${stat("Occupied Rooms", st.occupied, "Rooms", "#/hm/residents")}
          ${stat("Guests", st.guests, "", "#/hm/residents?tab=Guests", true)}
          ${stat("Today Check In", st.checkIns, "Rooms", "#/hm/residents?tab=Guests&arriving=1", true)}
          ${stat("Today Check Out", st.checkOuts, "Rooms", "#/hm/residents?tab=Guests&leaving=1", true)}
        </div>
        <div class="panel">
          <div class="panel-head">
            <span class="panel-icon">${icon("building")}</span><h2>Guests</h2>
            <div class="panel-tools">
              <button class="icon-btn" data-act="toggleGuestSearch" aria-label="Search guests">${icon("search")}</button>
              <button class="icon-btn" data-act="toggleGuestSort" aria-label="Sort by arrival">${icon("sort")}</button>
            </div>
          </div>
          ${ctx.ui.guestSearchOpen ? `<div class="panel-search search">${icon("search")}<input class="input" type="search" placeholder="Search guests or rooms" value="${esc(ctx.ui.guestQ)}" data-on-input="guestQ" autofocus></div>` : ""}
          <div class="guest-list" id="guest-list">${guestRows(day, ctx.ui.guestQ, ctx.ui.guestSortAsc)}</div>
        </div>
      </section>
      <aside class="updates" aria-label="Updates" data-figma-node="301:1609">
        <div class="updates-search search">${icon("search")}<input class="input" type="search" placeholder="Search" value="${esc(ctx.ui.updatesQ)}" data-on-input="updatesQ" aria-label="Search updates"></div>
        <div class="panel">
          <div class="panel-head"><span class="panel-icon">${icon("list")}</span><h2 style="font-weight:500;font-size:16px;color:var(--body)">Updates</h2></div>
          <div class="updates-list" id="updates-list">${updatesPanel(ctx.ui.updatesQ)}</div>
        </div>
      </aside>
    </div>`;
  }

  return { render, updateCard, updatesPanel, guestRows };
})();

