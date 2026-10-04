/* ==========================================================================
   Requester kit — the new-request form, "my requests" list and request
   detail shared by the Student, Department Office and IRCC & Event Council
   portals. Each portal passes its own config (types, owner, wording).
   ========================================================================== */
window.HMS = window.HMS || {};

HMS.requester = (function () {
  const S = HMS.store.sel, A = HMS.store.act, D = HMS.date, UI = HMS.ui, C = HMS.campus, SH = HMS.shared;
  const { icon, esc, kv } = UI;
  const app = HMS.app;
  const ui = app.ui;
  const render = () => app.render();

  function newDraft(cfg) {
    return { portal: cfg.portal, type: cfg.types[0], guests: cfg.startGuests ? cfg.startGuests() : [], from: D.add(HMS.TODAY, 7), to: D.add(HMS.TODAY, 9), comments: "", documents: [], preferredHostel: cfg.defaultHostel || "", title: "", contact: cfg.contact || "" };
  }
  function draftFor(cfg) {
    if (!ui.draft || ui.draft.portal !== cfg.portal || !cfg.types.includes(ui.draft.type)) ui.draft = newDraft(cfg);
    return ui.draft;
  }

  /** The full new-request page */
  function form(cfg) {
    const d = draftFor(cfg);
    const t = C.TYPES[d.type];
    const n = d.guests.length;
    const stages = SH.stagesFor({ type: d.type });
    const sec = (no, title, body, hint) => `<section class="fsec"><div class="fsec-head"><span class="fsec-no">${no}</span><div><h2>${esc(title)}</h2>${hint ? `<p>${hint}</p>` : ""}</div></div>${body}</section>`;
    let i = 1;
    const parts = [];
    if (cfg.requester) parts.push(sec(i++, "Requester details", `<div class="pgrid pgrid-3">${cfg.requester.map(([l, v]) => kv(l, esc(v))).join("")}</div>`, "Filled from your IITB profile."));
    if (cfg.types.length > 1) parts.push(sec(i++, cfg.typeTitle || "Request type", `<div class="type-grid">${cfg.types.map((k) => `<button class="type-card" aria-pressed="${d.type === k}" data-act="draftType" data-type="${k}"><b>${esc(C.TYPES[k].label)}</b><small>${esc(cfg.typeHints[k] || "")}</small><span class="type-route">${C.TYPES[k].dean ? "Needs Dean SA approval" : "Goes straight to HCU"}</span></button>`).join("")}</div>`));
    if (cfg.titleField) parts.push(sec(i++, cfg.titleField, `<label class="field"><span>${esc(cfg.titleLabel || "Name")}</span><input class="input" value="${esc(d.title)}" data-on-input="draftField" data-k="title" placeholder="${esc(cfg.titlePlaceholder || "")}"></label>`));
    parts.push(sec(i++, cfg.guestTitle || "Guest details", SH.guestEditor(d, { relation: true, relationHint: cfg.relationHint, upload: cfg.upload }), cfg.guestHint));
    parts.push(sec(i++, cfg.datesTitle || "Stay duration", `<div class="pgrid pgrid-3">
        <label class="field"><span>Arrival</span><input class="input" type="date" value="${d.from}" min="${HMS.TODAY}" data-on-change="draftField" data-k="from"></label>
        <label class="field"><span>Departure</span><input class="input" type="date" value="${d.to}" min="${d.from}" data-on-change="draftField" data-k="to"></label>
        ${cfg.hostelPref ? `<label class="field"><span>Hostel preference</span><select class="select-input" data-on-change="draftField" data-k="preferredHostel"><option value="">No preference</option>${C.HOSTELS.map((h) => `<option value="${h.id}" ${d.preferredHostel === h.id ? "selected" : ""}>${h.name} · ${h.gender}</option>`).join("")}</select></label>` : kv("Nights", d.to >= d.from ? D.days(d.from, d.to) : "—")}
      </div>
      ${cfg.availabilityHostel ? SH.availability(cfg.availabilityHostel, d.from, d.to, Math.max(1, Math.ceil(n / 2))) : d.preferredHostel ? SH.availability(d.preferredHostel, d.from, d.to, n || 1) : ""}`, cfg.datesHint));
    parts.push(sec(i++, "Purpose", `<label class="field"><span>${esc(cfg.purposeLabel || "Why are they staying?")}</span><textarea class="input" rows="3" data-on-input="draftField" data-k="comments" placeholder="${esc(cfg.purposeHint || "")}">${esc(d.comments)}</textarea></label>`));
    parts.push(sec(i++, cfg.docsTitle || "Documents", SH.docsEditor(d, cfg.docsLabel), cfg.docsHint));
    const problems = validate(d, cfg);
    return `<section>
      <button class="back" data-act="go" data-href="${cfg.listHref}">${icon("caretLeft")} ${esc(cfg.listHeading)}</button>
      <div class="page-head"><h1 class="page-title">${esc(cfg.heading)}</h1></div>
      <div class="form-layout">
        <div class="form-main">${parts.join("")}</div>
        <aside class="form-side">
          <div class="pcard sticky">
            <h2>Summary</h2>
            <div class="pgrid">${kv("Type", esc(t.label))}${kv("People", n || "—")}${kv("From", D.fmt(d.from))}${kv("To", D.fmt(d.to))}</div>
            <h3 class="side-h">What happens next</h3>
            <ol class="route-preview">${stages.map((s, k) => `<li><span>${k + 1}</span>${esc(s.label)}</li>`).join("")}</ol>
            ${problems.length ? `<ul class="problems">${problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
            <button class="btn btn-primary btn-lg block" data-act="draftSubmit" data-portal="${cfg.portal}" ${problems.length ? "disabled" : ""}>${icon("send")} Submit request</button>
            <button class="link" data-act="draftReset" data-portal="${cfg.portal}" style="font-size:12px;margin-top:10px">Clear form</button>
          </div>
        </aside>
      </div>
    </section>`;
  }

  function validate(d, cfg) {
    const out = [];
    if (!d.guests.length) out.push("Add at least one person.");
    if (d.guests.some((g) => !g.name.trim())) out.push("Every person needs a name.");
    if (!d.from || !d.to || d.to < d.from) out.push("Departure must be on or after arrival.");
    if (d.from < HMS.TODAY) out.push("Arrival can't be in the past.");
    if (!d.comments.trim()) out.push("Say why they are staying.");
    if (cfg.titleField && !d.title.trim() && d.guests.length > 1) out.push(`Give the ${cfg.titleField.toLowerCase()} a name.`);
    if (cfg.needDocs && !d.documents.length) out.push("Attach at least one document.");
    if (cfg.maxGuests && d.guests.length > cfg.maxGuests) out.push(`Students can host up to ${cfg.maxGuests} guests per request.`);
    return out;
  }

  /** "My requests" — one list, Active / Past tabs (Figma 238:4052 + 293:10039) */
  function list(cfg) {
    const all = S.requestsOf(cfg.owner);
    const stats = cfg.stats ? `<div class="stats stats-4">${cfg.stats(all).map(([l, v, sub]) => `<div class="stat stat-sm"><div class="stat-label">${esc(l)}</div><div class="stat-value"><b>${v}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div></div>`).join("")}</div>` : "";
    const rows = all.map((r) => SH.requestRow(r));
    return `<section>
      <div class="page-head"><h1 class="page-title">${esc(cfg.listHeading)}</h1><button class="btn btn-primary btn-lg" data-act="go" data-href="${cfg.newHref}">${icon("plus")} ${esc(cfg.newLabel)}</button></div>
      ${stats}
      ${HMS.list.render({
        key: "rq-" + cfg.portal, rows, defaults: { sort: { key: "requestedOn", dir: -1 } },
        tabs: [
          { id: "active", label: "Active", test: (row) => SH.isActive(row.r) },
          { id: "past", label: "Past", test: (row) => !SH.isActive(row.r) },
          { id: "all", label: "All", test: () => true },
        ],
        cols: [
          { key: "guests", label: cfg.portal === "student" ? "Guests" : "Request", fmt: SH.col.guests },
          ...(cfg.types.length > 1 ? [{ key: "type", label: "Type", cls: "wrap-sm", fmt: SH.col.muted }] : []),
          { key: "from", label: "Arrival", fmt: SH.col.date },
          { key: "to", label: "Departure", fmt: SH.col.date },
          { key: "where", label: "Hostel / room", cls: "wrap-sm" },
          { key: "status", label: "Status", fmt: SH.col.reqStatus },
        ],
        rowAttrs: (row) => `data-act="go" data-href="${cfg.detailHref(row.id)}"`,
        actions: (row) => `<div class="actions"><button data-act="go" data-href="${cfg.detailHref(row.id)}" aria-label="Track">${icon("eye")}</button></div>`,
        empty: { title: "No requests here", body: `<button class="link" data-act="go" data-href="${cfg.newHref}">${esc(cfg.newLabel)}</button>` },
      })}
    </section>`;
  }

  /** Detail page for the requester: progress, allocation, cancel, extension */
  function detail(cfg, id) {
    const r = S.request(id);
    if (!r || r.owner !== cfg.owner) return `<div class="empty"><strong>Request not found</strong><button class="link" data-act="go" data-href="${cfg.listHref}">Back</button></div>`;
    const canCancel = ["dean", "hcu", "pending", "accepted"].includes(r.status) || (r.status === "allotted" && r.from > HMS.TODAY);
    const canExtend = r.status === "allotted" && r.to >= HMS.TODAY && !(r.extension && r.extension.state === "open") && r.hostel;
    return `<section>
      <button class="back" data-act="go" data-href="${cfg.listHref}">${icon("caretLeft")} ${esc(cfg.listHeading)}</button>
      <div class="page-head"><h1 class="page-title">Request<span class="sep">|</span>${esc(r.id)}</h1>
        <div class="profile-actions">
          ${canExtend ? `<button class="btn btn-secondary" data-act="rqExtend" data-id="${r.id}">${icon("calendar")} Ask for an extension</button>` : ""}
          ${canCancel ? `<button class="btn btn-danger" data-act="rqCancel" data-id="${r.id}">Cancel request</button>` : ""}
        </div>
      </div>
      ${SH.requestDetail(r)}
    </section>`;
  }

  /* ------------------------------ Handlers ------------------------------ */
  const cfgs = {};
  const d = () => ui.draft;
  const handlers = {
    draftType: (el) => { d().type = el.dataset.type; render(); },
    draftField: (el) => { d()[el.dataset.k] = el.value; if (el.dataset.k === "from" && d().to < el.value) d().to = el.value; render(); },
    draftGuestField: (el) => { d().guests[Number(el.dataset.i)][el.dataset.k] = el.value; if (el.tagName === "SELECT") render(); else app.render(); },
    draftGuestAdd: () => { const c = cfgs[d().portal]; d().guests.push({ name: "", gender: c.defaultGender || "Female", contact: "", relation: c.defaultRelation || "" }); render(); setTimeout(() => { const ins = document.querySelectorAll('.guest-editor input[data-k="name"]'); ins[ins.length - 1]?.focus(); }, 0); },
    draftGuestRemove: (el) => { d().guests.splice(Number(el.dataset.i), 1); render(); },
    draftUploadList: (el) => {
      const f = el.files && el.files[0]; if (!f) return;
      f.text().then((txt) => { const list = SH.parseList(txt, cfgs[d().portal].defaultGender); list.forEach((g) => (g.relation = cfgs[d().portal].defaultRelation || "")); d().guests.push(...list); if (!d().documents.includes(f.name)) d().documents.push(f.name); render(); UI.toast(`Added ${list.length} people from ${f.name}`); });
    },
    draftPasteList: () => app.form("Paste a list", `<label class="field"><span>One person per line: name, gender, mobile</span><textarea class="input" name="list" rows="8" placeholder="Ananya Rao, F, 9876543210&#10;Rohan Mehta, M, 9123456780"></textarea></label>`, "Add people",
      (v) => { const list = SH.parseList(v.list, cfgs[d().portal].defaultGender); if (!list.length) return "Nothing to add. Put one person per line."; list.forEach((g) => (g.relation = cfgs[d().portal].defaultRelation || "")); d().guests.push(...list); UI.toast(`Added ${list.length} people`); }),
    draftSampleCsv: () => UI.download("participants-sample.csv", "name,gender,mobile\nAnanya Rao,Female,9876543210\nRohan Mehta,Male,9123456780\n"),
    draftDocs: (el) => { for (const f of el.files || []) if (!d().documents.includes(f.name)) d().documents.push(f.name); render(); },
    draftDocRemove: (el) => { d().documents.splice(Number(el.dataset.i), 1); render(); },
    draftReset: (el) => { ui.draft = newDraft(cfgs[el.dataset.portal]); render(); },
    draftSubmit: (el) => {
      const c = cfgs[el.dataset.portal]; const dr = d();
      const probs = validate(dr, c); if (probs.length) return UI.toast(probs[0]);
      const r = A.submitRequest({ type: dr.type, owner: c.owner, requestedBy: c.requestedBy, requesterRoll: c.requesterRoll, guests: dr.guests.map((g) => ({ ...g, name: g.name.trim() })), from: dr.from, to: dr.to, comments: dr.comments.trim(), documents: dr.documents, preferredHostel: dr.preferredHostel, hostel: c.fixedHostel || null, title: dr.title.trim() || (c.titleFromRequester ? c.requestedBy : ""), contact: c.contact });
      ui.draft = null;
      app.go(c.detailHref(r.id));
      const next = { dean: "Associate Dean SA", hcu: "HCU", pending: "the Hall Manager" }[r.status];
      UI.toast(`Submitted. It's with ${next} now; you'll be notified at each step.`);
    },
    rqCancel: (el) => {
      const r = S.request(el.dataset.id);
      app.form("Cancel this request?", "", "Cancel request", () => { A.cancelRequest(r.id); UI.toast("Request cancelled"); }, { danger: true, intro: `“${esc(r.title)}”, ${D.fmt(r.from)} – ${D.fmt(r.to)}. ${r.status === "allotted" ? "The rooms are released for others." : "Nobody will act on it after this."}` });
    },
    rqExtend: (el) => {
      const r = S.request(el.dataset.id);
      app.form("Ask for an extension", `
        <label class="field"><span>Stay until</span><input class="input" type="date" name="to" value="${D.add(r.to, 2)}" min="${D.add(r.to, 1)}"></label>
        <label class="field"><span>Reason</span><textarea class="input" name="reason" rows="2" placeholder="e.g. Project deadline moved"></textarea></label>`, "Send to Hall Manager",
        (v) => { if (!v.to || v.to <= r.to) return "Pick a date after " + D.fmt(r.to) + "."; A.requestExtension(r.id, v.to, v.reason.trim(), r.requestedBy); UI.toast("Sent. The Hall Manager and HCU both see it."); },
        { intro: `Currently until ${D.fmt(r.to)} in ${esc(SH.hostelName(r.hostel))}. Extensions go through the portal so HCU knows, instead of being agreed at the desk.` });
    },
  };

  function register(cfg) { cfgs[cfg.portal] = cfg; }
  Object.assign(app.H, handlers);
  ui.draft = null;

  return { form, list, detail, register, draftFor, newDraft };
})();
