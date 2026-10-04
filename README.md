# HMU — Hostel Management System, IIT Bombay

One system for every hostel stay at IIT Bombay. Students, departments, IRCC,
the Associate Dean SA, HCU and Hall Managers work on the same live data, so a
request moves from one desk to the next without webmail threads, paper
registers and four copies of the same Excel sheet.

**Run it:** open `index.html` in a browser. No build step, no server.
Pick a role on the sign-in screen. Switch roles any time from the avatar menu
(top right). The ⓘ button explains how a request moves.

Sources (group Figma team):
- Hall Manager UI and design tokens — Figma "HM Intern Work" (`W8pJfHJeop1TZinVuB2IP1`), section "Hostel Manager" (238:3312)
- IA / sitemap for all six portals — FigJam `WTbfKcPH3Gop5Xp4xFDHBy`
- Research, interviews, current workflows and pain points — Figma `W8pJfHJeop1TZinVuB2IP1`, page "Workflow"

## How a request moves

```
Student ───────────────────────────────────────────────┐
Department / IRCC / Event Council ─► Associate Dean SA ─► HCU ─► Hall Manager ─► Requester
(interview candidates skip the Dean)   approve · partial    pick     accept and     sees hostel
                                        · reject            hostel   allot on map   and room numbers
```

Every step is written to the request's timeline and notifies the next person
(bell icon). Each pain point from the interviews has a matching feature:

| Pain point (interviews) | What the system does |
|---|---|
| Approval chain is too long | Dean SA queue shows how long each request has waited; HCU dashboard shows average days per step |
| No live status for HCU | HCU sees every request at every stage, and every hostel's live capacity |
| Allotment done by hand in lists | Hall Manager allots on the floor map; HCU batches can be auto-allotted |
| Extensions agreed at the desk, HCU unaware | Extensions are asked and approved in the portal; HCU's "Extensions and overstay" report |
| Same data entered four times | One record per person, per request, per room |
| Students can't see availability, no notifications | Free-room count shown while filling the request; notification at every step |
| Mixed groups need two hostels | HCU splits a mixed group by gender into two requests, one per hostel |

## Portals

| Portal | Route | Screens |
|---|---|---|
| Hall Manager (Hostel 17) | `#/hm` | Dashboard + Updates, Residents (tabs, filters, saved tabs, profile), Requests (Guest stays: To do / Allotted / Past, and Student forms), Hostel Map (allot, extend, check out, repair), Actions (rooms, residents, batch, notices, reports), Settings |
| HCU Office | `#/hcu` | Dashboard (all hostels, capacity strips, queue, turnaround), Hostels (list → detail, read-only map and residents), All Residents, Requests (route, split, reject), Batches (upload, per person, hostel preferences), Reports, Settings |
| Associate Dean SA | `#/dean` | Requests (Waiting for you / Decided; filter by type or requester), approve with note / partial approval / reject with reason |
| Student | `#/student` | My Hostel (room, roommate, notices, quick actions), My Requests (list → timeline, cancel, extension; "New guest request" button), My Forms (retention, vacation, preference, mess, room change) |
| Department Office | `#/dept` | My Requests (list → detail; "Submit visitor request" button: type, guest list upload, documents) |
| IRCC & Event Council | `#/ircc` | My Batches (list → per-person allocation, extensions; "Submit batch request" button) |

## Try the whole flow (5 minutes)

1. **IDC Office** → New Request → *Workshop and seminar*, paste a list with women and men, attach a file, submit.
2. **Associate Dean SA** → open it → approve with a note (or try *Partial approval*).
3. **HCU Office** → Requests → open it → pick Hostel 17 for the women and a men's hostel → Send.
4. **Hall Manager** → Requests → *Accept* on the row → *Allot now* → click an unoccupied room → Allot.
5. **IDC Office** → the request shows the rooms, and the bell has every step.

Also try: Student → *Keep my room over a break*, then Hall Manager approves it
from Updates; HCU → Batches → *Upload new batch* → Hall Manager → Actions →
Batch operations → *Auto-allot*.

## Lists

Every request list (Hall Manager, Dean SA, HCU, Student, Department, IRCC) is
the same component, `js/core/list.js`: the toolbar from Figma 238:4052 (Filter
"Where:" builder, tabs, Rows per page, Search) over the table from Figma
293:10039 (grey header band, striped rows, numbered pages). Click a row to
open the request; the next action (Accept, Allot, Review, Pick hostel) sits at
the end of the row. Tabs are by status, so each role's first tab is its to-do list.

## Code layout

```
index.html                  entry, loads everything in order (plain scripts, global HMS)
css/tokens.css              design tokens from Figma — change here and in Figma together
css/app.css                 shell, primitives, Hall Manager screens
css/portals.css             components added for the other portals
js/core/date.js             ISO date helpers
js/core/floorplan.js        Hostel 17 floor geometry (from Figma 238:5420)
js/core/campus.js           hostels, demo users, request types
js/core/seed.js             deterministic sample data
js/core/store.js            the only data layer: selectors + mutations, every portal
js/core/ui.js               icons, overlays, toasts, CSV
js/core/shared.js           status labels, stepper, timeline, form types, charts
js/app.js                   sign-in, router, shell, dialogs, event delegation
js/core/list.js             the shared list view (filter, tabs, search, sort, pages)
js/portals/hm/*.js          Hall Manager screens + portal.js (routes, handlers)
js/portals/requester.js     request form / list / detail shared by requesters
js/portals/{student,dept,ircc,dean,hcu}.js
```

To work on one portal, you mostly touch its file in `js/portals/`. Elements
declare intent with `data-act` / `data-on-input` / `data-on-change`, and the
portal's `handlers` object responds.

## Data model (store contract)

- `requests[]` — `{ id, type, kind, source, owner, requestedBy, title, count, gender, from, to, hostel, status, guestIds, documents, deanNote, extension, timeline[] }`
  - `status`: `dean → hcu → pending → accepted → allotted → completed`, or `rejected` / `cancelled`
  - `timeline[]`: `{ at, who, role, act, note }`, appended by every mutation
- `guests[]`, `residents[]`, `stays[]` (who is in which room, when), `maintenance[]`
- `forms[]` — student forms, decided by the Hall Manager (or HCU for hostel preference)
- `updates[]` — the Hall Manager's inbox; `notifications[]` — per user (`hm:H17`, `hcu`, `dean`, `student:<id>`, `org:<name>`)
- `batches[]` — HCU new-student uploads; `notices[]` — hostel or campus-wide

`HMS.store` keeps these signatures; swap the bodies for API calls to move to a backend.

## What's prototype only

- Data lives in the browser's localStorage (Reset demo data on the sign-in page or in Actions).
  Two tabs in the same browser stay in sync, so you can open two portals side by side.
- SSO is not wired; roles are picked on the sign-in screen.
- Only Hostel 17 is modelled room by room. Other hostels have headline numbers
  (placeholder values; replace with HCU's register) and a *Simulate allotment* button on HCU's request page.
- Actions, Settings and the non-Hall-Manager portals aren't designed in Figma yet. They follow the FigJam IA and reuse the Figma tokens and components.
- Uploaded files keep only their names.
