/* ==========================================================================
   Hostel Map — Figma 238:5393 (map), 238:5576 (Allot, one person),
   238:5796 (Allot, two people), 262:6633 (Add Resident search open).
   Occupied-room detail content comes from the older Version 1 frame 266:4130.
   The map is date-aware: room colours reflect who is there on the chosen day.
   ========================================================================== */
window.HMS = window.HMS || {};
HMS.views = HMS.views || {};

HMS.views.map = (function () {
  const { icon, esc, kv, phoneMask } = HMS.ui;
  const D = HMS.date;
  const S = HMS.store.sel;
  const FP = HMS.floorplan;

  const STATES = {
    allotted: { label: "Allotted", bg: "var(--room-allotted-bg)", stroke: "var(--room-allotted-stroke)" },
    empty: { label: "Unoccupied", bg: "var(--room-empty-bg)", stroke: "var(--room-empty-stroke)" },
    guest: { label: "Guests", bg: "var(--room-guest-bg)", stroke: "var(--room-guest-stroke)", dash: "3 2" },
    maintenance: { label: "Maintenance", bg: "var(--room-maint-bg)", stroke: "var(--room-maint-stroke)" },
  };

  function svg(ctx) {
    const m = ctx.ui.map;
    const day = ctx.ui.day;
    const counts = { allotted: 0, empty: 0, guest: 0, maintenance: 0 };
    const rooms = FP.SLOTS.map((s) => {
      const no = FP.roomNo(m.floor, s.idx);
      const st = S.roomState(no, day);
      counts[st]++;
      const def = STATES[st];
      const dim = (m.wing !== "all" && s.wing !== m.wing) ? "dim" : !m.show[st] ? "hidden-state" : "";
      const sel = m.room === no ? "selected" : "";
      const isRecent = S.isRecentRoom(no);
      const rec = isRecent ? "recent-allot" : "";
      const occ = st === "allotted" || st === "guest" ? S.occupants(no, day) : [];
      const over = occ.length > 2 ? `<circle class="flag" cx="${s.x + s.w - 4}" cy="${s.y + 4}" r="3"/>` : "";
      const recDot = isRecent ? `<circle class="recent-dot" cx="${s.x + 6}" cy="${s.y + 6}" r="3.5" fill="var(--primary-cta-bg)" stroke="#fff" stroke-width="1.2"><title>Recently Allotted</title></circle>` : "";
      const title = `Room ${no}${isRecent ? " (Recently Allotted)" : ""} · ${def.label}${occ.length ? " · " + occ.map((o) => o.person.name).join(", ") : ""}`;
      const label = m.labels ? `<text x="${s.x + s.w / 2}" y="${s.y + s.h / 2 + 3}" text-anchor="middle">${s.idx}</text>` : "";
      return `<g class="room ${dim} ${sel} ${rec}" tabindex="0" role="button" aria-label="${esc(title)}" data-act="openRoom" data-room="${no}">
        <title>${esc(title)}</title>
        <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="4.8" fill="${def.bg}" stroke="${def.stroke}" stroke-width="1" ${def.dash ? `stroke-dasharray="${def.dash}"` : ""}/>
        ${label}${over}${recDot}</g>`;
    }).join("");
    const blocks = FP.blocks.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4.8" fill="${b.kind === "service" ? "var(--room-service-bg)" : "var(--room-common-bg)"}"><title>${b.label}</title></rect>`).join("");
    const c = FP.courtyard;
    return {
      counts,
      html: `<svg viewBox="${FP.viewBox}" role="group" aria-label="Floor ${m.floor} plan">
        <path d="${FP.outline}" fill="var(--primary-bg)" stroke="var(--primary-cta-bg)" stroke-width="2"/>
        <rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="10" fill="#fff" stroke="var(--primary-cta-bg)" stroke-width="2"/>
        ${blocks}${rooms}
      </svg>`,
    };
  }

  function legend(ctx, counts) {
    const m = ctx.ui.map;
    const item = (k) => `<button class="legend-item" aria-pressed="${m.show[k]}" data-act="toggleLegend" data-k="${k}">
      <span class="sw" style="background:${STATES[k].bg};border-color:${STATES[k].stroke};${STATES[k].dash ? "border-style:dashed" : ""}"></span>${STATES[k].label} <span class="n num">${counts[k]}</span></button>`;
    const recentCount = S.recentAllottedRooms().size;
    return `<div class="map-legend">${item("allotted")}${item("empty")}${item("guest")}${item("maintenance")}
      <span class="legend-item"><span class="sw" style="background:var(--room-service-bg);border-color:var(--room-service-bg)"></span>Service</span>
      <span class="legend-item"><span class="sw" style="background:var(--room-common-bg);border-color:var(--room-common-bg)"></span>Stairs &amp; common</span>
      ${recentCount ? `<span class="legend-item" style="color:var(--primary-cta-bg);font-weight:600"><span class="sw" style="background:var(--primary-cta-bg);border-color:#fff;border-radius:50%"></span>Recent (${recentCount})</span>` : ""}</div>`;
  }

  function dateSelects(day) {
    const [y, mo, d] = day.split("-").map(Number);
    const days = new Date(y, mo, 0).getDate();
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const box = (part, opts, label) => `<label class="box-select"><span class="sr-only">${label}</span><select data-on-change="setDatePart" data-part="${part}">${opts}</select>${icon("caretDown")}</label>`;
    return `<div class="map-top">
      ${box("d", Array.from({ length: days }, (_, i) => `<option value="${i + 1}" ${i + 1 === d ? "selected" : ""}>${String(i + 1).padStart(2, "0")}</option>`).join(""), "Day")}
      ${box("m", months.map((n, i) => `<option value="${i + 1}" ${i + 1 === mo ? "selected" : ""}>${n}</option>`).join(""), "Month")}
      ${box("y", [2025, 2026, 2027].map((v) => `<option ${v === y ? "selected" : ""}>${v}</option>`).join(""), "Year")}
    </div>`;
  }

  function render(ctx) {
    const m = ctx.ui.map;
    const { html, counts } = svg(ctx);
    const floors = FP.FLOORS;
    const i = floors.indexOf(m.floor);
    const visible = floors.slice(Math.max(0, Math.min(i - 1, floors.length - 3)), Math.max(0, Math.min(i - 1, floors.length - 3)) + 3).reverse();
    const pendingGuests = S.unhousedGuests().length;
    const newResidents = S.unhousedResidents().length;
    return `<section class="map-page" data-figma-node="238:5393">
      <div>
        ${dateSelects(ctx.ui.day)}
        ${pendingGuests || newResidents ? `<p class="note" style="margin:0 auto 14px">${[pendingGuests ? `${pendingGuests} guest${pendingGuests > 1 ? "s" : ""} from accepted requests` : "", newResidents ? `${newResidents} new resident${newResidents > 1 ? "s" : ""} from HCU` : ""].filter(Boolean).join(" and ")} still need a room. Click an unoccupied room to allot.</p>` : ""}
        <div class="map-canvas" id="map-canvas">${html}</div>
        ${legend(ctx, counts)}
      </div>
      <aside class="map-side">
        <label class="box-select"><span class="sr-only">Wing</span><select data-on-change="setWing">
          <option value="all" ${m.wing === "all" ? "selected" : ""}>All wings</option>
          ${FP.WINGS.map((w) => `<option value="${w}" ${m.wing === w ? "selected" : ""}>Wing ${w}</option>`).join("")}
        </select>${icon("caretDown")}</label>
        <div class="map-options"><input type="checkbox" class="checkbox" id="lbl" ${m.labels ? "checked" : ""} data-on-change="toggleLabels"><label for="lbl">Room numbers</label></div>
        <nav class="floor-stepper" aria-label="Floor">
          <button class="step" data-act="floorStep" data-d="1" aria-label="Floor up" ${i >= floors.length - 1 ? "disabled" : ""}>${icon("caretUp")}</button>
          ${visible.map((f) => `<button class="floor-btn" aria-current="${f === m.floor}" data-act="setFloor" data-f="${f}">${f}</button>`).join("")}
          <button class="step" data-act="floorStep" data-d="-1" aria-label="Floor down" ${i <= 0 ? "disabled" : ""}>${icon("caretDown")}</button>
        </nav>
      </aside>
    </section>`;
  }

  /* --------------------------- Room dialogs --------------------------- */
  function head(room, tab, tabs) {
    return `<div class="modal-head"><div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button class="tab" role="tab" aria-selected="${tab === id}" data-act="roomTab" data-tab="${id}">${l}</button>`).join("")}</div><div class="modal-room num">${room}</div></div>`;
  }

  function candRow(guest, booking, checked) {
    return `<div class="cand">
      ${booking.kind === "group" ? `<div class="cand-group">${esc(booking.title)} · ${esc(booking.requestedBy)}</div>` : ""}
      ${kv("Name", esc(guest.name))}${kv("Days", D.days(booking.from, booking.to) + 1)}<span></span>
      <input type="checkbox" class="checkbox check" ${checked ? "checked" : ""} data-on-change="toggleCand" data-id="${guest.id}" aria-label="Allot ${esc(guest.name)}">
      ${kv("From", D.fmt(booking.from))}${kv("To", D.fmt(booking.to))}${kv("Comments", esc(booking.comments || "—"), "comments")}
      ${kv("Contact Number", esc(phoneMask(guest.contact || booking.contact)))}${kv("Requested on", D.fmt(booking.requestedOn))}
    </div>`;
  }

  /** Allot / Notify dialog for an unoccupied room (238:5576 / 238:5796) */
  function allotDialog(ctx, d) {
    const room = d.room;
    let body;
    if (d.tab === "allot") {
      const pool = S.unhousedGuests();
      const shown = pool.filter((p) => d.showAll || d.picked.includes(p.guest.id) || d.focusRequest === p.request.id);
      const rest = pool.filter((p) => !shown.includes(p));
      const q = (d.q || "").toLowerCase();
      const suggestions = q ? [
        ...rest.filter((p) => p.guest.name.toLowerCase().includes(q)).map((p) => ({ act: "pickGuest", id: p.guest.id, label: p.guest.name, sub: p.request.title + " · from " + D.fmt(p.request.from) })),
        ...S.unhousedResidents().filter((r) => r.name.toLowerCase().includes(q)).map((r) => ({ act: "pickResident", id: r.id, label: r.name, sub: r.roll + " · no room" })),
        { act: "pickWalkIn", id: d.q, label: `Add “${d.q}” as a new guest`, sub: "Creates a booking for today" },
      ].slice(0, 8) : [];
      const n = d.picked.length + (d.resident ? 1 : 0) + (d.walkIn ? 1 : 0);
      body = `
        <div class="add-resident">${icon("plus")}<input placeholder="Add Resident" value="${esc(d.q || "")}" data-on-input="allotQ" aria-label="Search people waiting for a room" autocomplete="off" autofocus>
          ${suggestions.length ? `<div class="suggest" role="listbox">${suggestions.map((s) => `<button role="option" data-act="${s.act}" data-id="${esc(s.id)}"><span>${esc(s.label)}</span><small>${esc(s.sub)}</small></button>`).join("")}</div>` : ""}
        </div>
        ${!q && rest.length && !d.showAll ? `<p class="muted" style="font-size:11px;margin:10px 4px 0">${rest.length} more waiting · type a name, or <button class="link" data-act="showAllWaiting">show all</button></p>` : ""}
        <div class="cand-list">
          ${d.resident ? (() => { const r = S.resident(d.resident); return `<div class="cand">${kv("Name", esc(r.name))}${kv("Roll Number", esc(r.roll))}<span></span><input type="checkbox" class="checkbox check" checked data-act="unpickResident" aria-label="Remove">${kv("Allot from", D.fmt(ctx.ui.day))}${kv("Programme", esc(r.degree))}${kv("Department", esc(r.dept))}</div>`; })() : ""}
          ${d.walkIn ? `<div class="cand">${kv("Name", esc(d.walkIn))}${kv("Days", `<input class="input" type="number" min="1" value="${d.walkInDays}" data-on-input="walkInDays" style="width:64px;height:24px">`)}<span></span><input type="checkbox" class="checkbox check" checked data-act="unpickWalkIn" aria-label="Remove">${kv("From", D.fmt(ctx.ui.day))}${kv("To", D.fmt(D.add(ctx.ui.day, d.walkInDays - 1)))}</div>` : ""}
          ${shown.map((p) => candRow(p.guest, p.request, d.picked.includes(p.guest.id))).join("")}
          ${!shown.length && !d.resident && !d.walkIn ? `<div class="empty" style="padding:22px 10px"><strong>No one picked yet</strong>Search above for a guest from an accepted request, a resident without a room, or type a new name.</div>` : ""}
        </div>
        ${n > 2 ? `<div class="warn-line">That's ${n} people for one room. H17 rooms are singles; guests can share two to a room.</div>` : ""}`;
      return `${head(room, "allot", [["allot", "Allot"], ["notify", "Notify"]])}<div class="modal-body">${body}</div>
        <div class="modal-foot">
          <button class="btn btn-secondary" data-act="setMaintenancePrompt" style="margin-right:auto">${icon("wrench")} Mark for repair</button>
          <button class="btn btn-secondary" data-act="closeLayer">${icon("x")} Cancel</button>
          <button class="btn btn-primary" data-act="confirmAllot" ${n ? "" : "disabled"}>${icon("check")} Allot Room ${room}</button>
        </div>`;
    }
    return `${head(room, "notify", [["allot", "Allot"], ["notify", "Notify"]])}${notifyBody(room)}`;
  }

  function notifyBody(room) {
    return `<div class="modal-body">
        <label class="field"><span>Send to</span><select class="select-input" id="notify-to"><option>HCU Office</option><option>Warden</option><option>Requester</option><option>Resident</option><option>Maintenance cell</option></select></label>
        <label class="field" style="margin-top:12px"><span>Message</span><textarea class="input" id="notify-msg" rows="4">Room ${room}: </textarea></label>
      </div>
      <div class="modal-foot"><button class="btn btn-secondary" data-act="closeLayer">${icon("x")} Cancel</button><button class="btn btn-primary" data-act="sendNotify" data-room="${room}">${icon("send")} Send</button></div>`;
  }

  /** Occupied room (resident or guest) — content from Version 1 panel 266:4130 */
  function occupiedDialog(ctx, d) {
    const room = d.room;
    if (d.tab === "notify") return `${head(room, "notify", [["details", "Details"], ["notify", "Notify"]])}${notifyBody(room)}`;
    const occ = S.occupants(room, ctx.ui.day);
    const cards = occ.map(({ stay, person }) => {
      if (stay.kind === "resident") {
        return `<div class="occupant"><div class="req-kind">Resident · ${esc(person.roll)}</div><h3>${esc(person.name)}</h3>
          <div class="pgrid pgrid-3">${kv("Allocation Date", D.fmt(stay.from))}${kv("Programme", esc(person.degree))}${kv("Department", esc(person.dept))}
          ${kv("Contact Number", esc(phoneMask(person.phone)))}${kv("Faculty advisor", esc(person.advisor.name))}${kv("Local Guardian", esc(person.guardian.name))}</div>
          ${person.remarks[0] ? `<div class="status-box">${esc(person.remarks[0].text)}</div>` : ""}
          <div class="row" style="display:flex;gap:10px;margin-top:12px"><button class="btn btn-secondary" data-act="go" data-href="#/hm/residents/${person.id}">${icon("eye")} Open profile</button><button class="btn btn-danger" data-act="vacateResident" data-id="${person.id}">Mark vacated</button></div></div>`;
      }
      const b = S.request(person.requestId);
      const extending = d.extend === stay.id;
      return `<div class="occupant"><div class="req-kind">Guest${b ? " · " + esc(b.title) : ""}</div><h3>${esc(person.name)}</h3>
        <div class="pgrid pgrid-3">${kv("Allocation Date", D.fmt(stay.from))}${kv("Vacation Date", D.fmt(stay.to))}${kv("Days", D.days(stay.from, stay.to) + 1)}
        ${kv("Contact Number", esc(phoneMask(person.contact || (b && b.contact))))}${kv("Requested by", esc(b ? b.requestedBy : "—"))}${kv("Comments", esc(b ? b.comments : "—"), "comments")}</div>
        <div class="status-box">Accommodation<br>${D.fmt(stay.from)}  -  ${D.fmt(stay.to)}${stay.to < ctx.ui.day ? " · overstaying" : stay.to === ctx.ui.day ? " · leaves today" : ""}</div>
        ${extending ? `<div style="display:flex;gap:8px;align-items:end;margin-bottom:10px"><label class="field" style="flex:1"><span>New departure date</span><input class="input" type="date" id="extend-to" value="${D.add(stay.to, 2)}" min="${stay.to}"></label><button class="btn btn-primary" data-act="confirmExtend" data-id="${stay.id}">Save</button></div>` : ""}
        <div class="stack">
          <button class="btn-outline-pill" data-act="extendStay" data-id="${stay.id}">Increase Accommodation</button>
          <button class="btn-outline-pill" data-act="checkOut" data-id="${stay.id}">Check out today</button>
        </div></div>`;
    }).join("");
    return `${head(room, "details", [["details", "Details"], ["notify", "Notify"]])}
      <div class="modal-body">${cards}
        ${occ.length === 1 && occ[0].stay.kind === "guest" ? `<button class="link" data-act="roomAddMore" style="font-size:12px">+ Add another guest to this room</button>` : ""}
      </div>
      <div class="modal-foot"><button class="btn btn-secondary" data-act="closeLayer">Close</button></div>`;
  }

  function maintenanceDialog(ctx, room) {
    const m = S.maintenanceIn(room, ctx.ui.day);
    return `<div class="modal-head"><h2 class="modal-title">Under repair</h2><div class="modal-room num">${room}</div></div>
      <div class="modal-body"><div class="pgrid">${kv("Issue", esc(m.note))}${kv("Since", D.fmt(m.from))}${kv("Expected back", m.to ? D.fmt(m.to) : "Not set")}${kv("Reported by", esc(m.reportedBy))}</div></div>
      <div class="modal-foot"><button class="btn btn-secondary" data-act="closeLayer">Close</button><button class="btn btn-primary" data-act="clearMaintenance" data-room="${room}">${icon("check")} Mark repaired</button></div>`;
  }

  return { render, allotDialog, occupiedDialog, maintenanceDialog, STATES };
})();

