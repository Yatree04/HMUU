/* ==========================================================================
   Seed data — deterministic (seeded PRNG) so every reload and every
   screenshot looks the same. Replace with API calls later; the shapes here
   are the contract (see README → Data model).

   Hostel 17 is a women's hostel. Names in the Figma (Sakshi Tawde,
   Kamika Chauhan, Yatri Amit Patel in 3005) are kept on purpose.
   "Today" is pinned so the demo always has check-ins/outs today.

   Every request carries a `timeline`, so each portal can show where it is:
   requester → (Associate Dean SA) → HCU → Hall Manager → allotted.
   ========================================================================== */
window.HMS = window.HMS || {};

HMS.TODAY = "2026-09-23";

HMS.seed = function seed() {
  const fp = HMS.floorplan;
  const D = HMS.date;
  const C = HMS.campus;

  // mulberry32 — tiny deterministic PRNG
  let s = 17_2026;
  const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const phone = () => String(7 + Math.floor(rnd() * 3)) + String(Math.floor(rnd() * 1e9)).padStart(9, "0");

  const FIRST = ["Aanya","Aditi","Ananya","Anushka","Bhavya","Charvi","Diya","Eesha","Gauri","Hritika","Ishita","Janhvi","Kavya","Khushi","Lavanya","Mahika","Meera","Mitali","Naina","Neha","Nidhi","Pooja","Prachi","Pranjal","Riya","Ruchi","Saanvi","Sakshi","Samiksha","Shreya","Sneha","Srishti","Tanvi","Trisha","Urvi","Vaishnavi","Vidhi","Yashika","Zoya","Aarohi","Anvi","Deepika","Harini","Keerthana","Lakshmi","Madhura","Nandini","Pallavi","Radhika","Swathi"];
  const MALE = ["Aarav","Vivaan","Aditya","Arjun","Sai","Reyansh","Ishaan","Rohan","Kabir","Aniket","Pranav","Siddharth","Harsh","Yash","Nikhil","Rahul","Varun","Kunal","Manish","Tejas"];
  const LAST = ["Sharma","Iyer","Patel","Rao","Deshpande","Kulkarni","Nair","Reddy","Gupta","Joshi","Mehta","Chauhan","Tawde","Menon","Banerjee","Das","Singh","Verma","Pillai","Shetty","Kapoor","Bose","Mishra","Agarwal","Khan","Fernandes","Naik","Pandey","Sinha","Bhatt"];
  const DEPTS = ["IDC","CSE","EE","ME","CE","Chemistry","Physics","HSS","Aerospace","Chemical","Metallurgy","Earth Sciences","Energy Science","Biosciences"];
  const CITIES = ["Pune, Maharashtra","Nagpur, Maharashtra","Indore, Madhya Pradesh","Jaipur, Rajasthan","Kochi, Kerala","Hyderabad, Telangana","Lucknow, Uttar Pradesh","Bhubaneswar, Odisha","Guwahati, Assam","Ahmedabad, Gujarat","Chennai, Tamil Nadu","Bengaluru, Karnataka"];
  const BLOOD = ["A +ve","A -ve","B +ve","B -ve","O +ve","O -ve","AB +ve"];
  const FACULTY = ["Prof. Anirudh Joshi","Prof. Ravi Poovaiah","Prof. Girish Dalvi","Prof. Supradip Das","Prof. Varsha Apte","Prof. Kavi Arya","Prof. Madhu Belur","Prof. Shireesh Kedare"];
  const FOREIGN_F = ["Lena Fischer","Emma de Vries","Sofia Rossi","Mei Tanaka","Chloé Martin","Hannah Berg","Aiko Sato","Laura Jansen"];
  const FOREIGN_M = ["Lukas Weber","Matteo Bianchi","Kenji Ito","Noah Visser","Elias Koch","Jonas Meyer"];

  const PROGRAMS = [
    { group: "Bachelors", degrees: ["B.Tech.","B.Des.","B.S.","Dual Degree"], code: "B", years: 4, weight: .5 },
    { group: "Masters", degrees: ["M.Tech.","M.Des.","M.Sc.","M.B.A."], code: "M", years: 2, weight: .28 },
    { group: "PhD", degrees: ["Ph.D."], code: "D", years: 5, weight: .22 },
  ];

  const residents = [];
  const guests = [];
  const stays = [];
  const maintenance = [];
  const requests = [];
  const updates = [];
  const forms = [];
  const notices = [];
  const notifications = [];
  const batches = [];
  let rid = 1, gid = 1, sid = 1, fid = 1, nid = 1;

  const rooms = fp.allRooms();
  const taken = new Set();

  function makeResident(overrides = {}) {
    const r = rnd();
    const prog = r < PROGRAMS[0].weight ? PROGRAMS[0] : r < PROGRAMS[0].weight + PROGRAMS[1].weight ? PROGRAMS[1] : PROGRAMS[2];
    const joinYear = 2026 - Math.floor(rnd() * Math.min(prog.years, 4));
    const yy = String(joinYear).slice(2);
    const first = pick(FIRST), last = pick(LAST);
    const city = pick(CITIES);
    const semester = Math.min((2026 - joinYear) * 2 + 1, prog.years * 2);
    const res = {
      id: "RS-" + String(rid++).padStart(4, "0"),
      hostel: "H17",
      roll: yy + prog.code + String(1000 + Math.floor(rnd() * 8999)),
      name: first + " " + last,
      programGroup: prog.group,
      degree: pick(prog.degrees),
      dept: pick(DEPTS),
      semester,
      phone: phone(),
      email: "",
      dob: `${2008 - (2026 - joinYear) - Math.floor(rnd() * 3) - (prog.code === "B" ? 0 : prog.code === "M" ? 4 : 6)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`,
      gender: "Female",
      nationality: rnd() < .96 ? "Indian" : pick(["Nepali","Sri Lankan","Bangladeshi"]),
      blood: pick(BLOOD),
      homeAddress: `${10 + Math.floor(rnd() * 180)}, ${pick(["Shreeram Pride","Gokul Heights","Anand Nagar","Lake View Apts","Sai Residency","Green Park"])}, ${city}`,
      joined: `${joinYear}-07-${String(20 + Math.floor(rnd() * 8)).padStart(2, "0")}`,
      expectedExit: `${joinYear + prog.years}-05-31`,
      advisor: { name: pick(FACULTY), phone: phone() },
      guardian: { name: pick(FIRST.slice(0, 20)).replace(/a$/, "") + " " + last, relation: pick(["Father","Mother"]), phone: phone() },
      mentor: { name: pick(FIRST) + " " + pick(LAST), phone: phone() },
      emergency: [phone(), phone()],
      remarks: [],
      room: null,
      history: [],
      mess: "Hostel 17 mess",
      ...overrides,
    };
    res.email = res.roll.toLowerCase() + "@iitb.ac.in";
    return res;
  }

  function place(res, room, from) {
    res.room = room;
    taken.add(room);
    stays.push({ id: "ST-" + sid++, room, kind: "resident", personId: res.id, from, to: res.expectedExit });
    res.history.unshift({ type: "allotted", room, date: from });
  }

  // 1. Yatri Amit Patel in 3005 — the resident shown in the Figma profile, and the Student portal's user
  const yatri = makeResident({ name: "Yatri Amit Patel", roll: "24B3625", programGroup: "Bachelors", degree: "B.Des.", dept: "IDC", semester: 5, joined: "2024-07-22", expectedExit: "2028-05-31", nationality: "Indian", blood: "A -ve" });
  yatri.email = "24b3625@iitb.ac.in";
  yatri.history = [
    { type: "shift", date: "2025-07-18", note: "Hostel shift to 17" },
    { type: "vacated", room: "4012", date: "2025-05-10", hostel: "H4" },
    { type: "allotted", room: "4012", date: "2024-07-22", hostel: "H4" },
  ];
  residents.push(yatri);
  place(yatri, "3005", "2025-07-18");

  // 2. Fill ~50% of rooms with residents
  for (const room of rooms) {
    if (taken.has(room)) continue;
    const { idx } = fp.parseRoom(room);
    if (idx === 19) continue;          // L4 corner room — kept for maintenance
    if (rnd() < 0.49) {
      const res = makeResident();
      residents.push(res);
      const from = D.max(res.joined, "2025-07-15");
      if (res.joined < "2025-07-15" && rnd() < .5) {
        const oldRoom = fp.roomNo(1 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 101));
        res.history.push({ type: "vacated", room: oldRoom, date: "2025-05-12" }, { type: "allotted", room: oldRoom, date: res.joined });
      }
      place(res, room, from);
    }
  }

  // 3. Maintenance — corner room on every floor + a few random
  for (const f of fp.FLOORS) {
    const room = fp.roomNo(f, 19);
    maintenance.push({ id: "MT-" + f, room, from: "2026-09-10", to: null, note: pick(["Seepage on west wall","Window latch broken","Ceiling fan replacement","Bathroom tap leaking"]), reportedBy: "Hall Manager" });
    taken.add(room);
  }
  for (const room of ["2044", "5071", "3088"]) {
    if (taken.has(room)) continue;
    maintenance.push({ id: "MT-" + room, room, from: "2026-09-18", to: "2026-09-28", note: "Repainting after vacate", reportedBy: "Hall Manager" });
    taken.add(room);
  }

  const freeRooms = () => rooms.filter((r) => !taken.has(r));
  const freeOnFloor = (f) => freeRooms().filter((r) => fp.parseRoom(r).floor === f);

  function mkGuest(name, contact, requestId, relation, gender) {
    const g = { id: "GS-" + String(gid++).padStart(4, "0"), name, contact: contact || phone(), requestId, relation: relation || "", gender: gender || "Female" };
    guests.push(g);
    return g;
  }
  function guestStay(g, room, from, to) {
    taken.add(room);
    stays.push({ id: "ST-" + sid++, room, kind: "guest", personId: g.id, from, to });
  }

  /* ---------------------------- Requests ---------------------------- */
  let bn = 2101;
  const rqid = () => "RQ-" + bn++;
  const studentFor = () => pick(residents.slice(1));

  /** Build the timeline a request of this type and status would have. */
  function trail(r) {
    const t = C.TYPES[r.type] || {};
    const who = r.requestedBy;
    const hostelName = r.hostel ? C.hostel(r.hostel).name : "";
    const out = [{ at: r.requestedOn, who, role: t.source || "student", act: "submitted", note: r.count > 1 ? `${r.count} guests, ${D.fmt(r.from)} – ${D.fmt(r.to)}` : `${D.fmt(r.from)} – ${D.fmt(r.to)}` }];
    let day = r.requestedOn;
    const next = (n) => (day = D.add(day, n) > HMS.TODAY ? HMS.TODAY : D.add(day, n));
    const order = ["dean", "hcu", "pending", "accepted", "allotted", "completed"];
    const reached = (st) => r.status === "rejected" ? order.indexOf(st) < order.indexOf(r.rejectedAt || "pending") : order.indexOf(r.status) > order.indexOf(st);
    if (t.dean && reached("dean")) out.push({ at: next(2), who: "Associate Dean SA", role: "dean", act: "approved", note: r.deanNote || "Approved." });
    if (r.type !== "guest" && r.type !== "direct" && reached("hcu")) out.push({ at: next(1), who: "HCU Office", role: "hcu", act: "routed", note: "Sent to " + hostelName + "." });
    if (r.type === "guest" && reached("hcu")) out.push({ at: next(0), who: "Portal", role: "system", act: "routed", note: "Sent to the Hall Manager of " + hostelName + "." });
    if (reached("pending")) out.push({ at: next(1), who: "Hall Manager, " + hostelName, role: "hm", act: "accepted", note: "Accepted." });
    if (reached("accepted")) out.push({ at: day, who: "Hall Manager, " + hostelName, role: "hm", act: "allotted", note: "Rooms allotted." });
    if (r.status === "rejected") out.push({ at: next(1), who: r.rejectedBy || "Hall Manager, " + hostelName, role: r.rejectedAt === "dean" ? "dean" : r.rejectedAt === "hcu" ? "hcu" : "hm", act: "rejected", note: r.rejectReason });
    return out;
  }

  function addRequest(p, guestList) {
    const t = C.TYPES[p.type];
    const r = {
      id: rqid(), kind: (p.count || 1) > 1 ? "group" : "individual", source: t.source, documents: [], preferredHostel: "", hostel: "H17",
      contact: phone(), gender: "Female", guestIds: [], ...p,
    };
    if (guestList) for (const g of guestList) r.guestIds.push(mkGuest(g.name, g.contact || r.contact, r.id, g.relation, g.gender).id);
    r.timeline = trail(r);
    requests.push(r);
    return r;
  }
  const people = (n, gender, relation, pool) => Array.from({ length: n }, (_, i) => {
    const g = gender === "Mixed" ? (i % 2 ? "Male" : "Female") : gender;
    return { name: pool ? pool[i % pool.length] + (i >= pool.length ? " " + (i + 1) : "") : (g === "Male" ? pick(MALE) : pick(FIRST)) + " " + pick(LAST), gender: g, relation };
  });

  // --- In-house now (Hall Manager dashboard "Guests" list) ---
  {
    const host = residents[3];
    const r = addRequest({ type: "guest", owner: "student:" + host.id, requestedBy: host.name, requesterRoll: host.roll, title: "Sakshi Tawde", count: 1, from: "2026-09-20", to: "2026-09-25", requestedOn: "2026-09-12", comments: "Cousin visiting for campus placement interviews.", status: "allotted" }, [{ name: "Sakshi Tawde", relation: "Cousin" }]);
    guestStay(guests[guests.length - 1], taken.has("3007") ? freeOnFloor(3)[0] : "3007", r.from, r.to);
  }
  {
    const r = addRequest({ type: "outreach", owner: "org:IDC Office", requestedBy: "IDC Office", title: "Student guests : 7", count: 7, from: "2026-09-18", to: "2026-09-30", requestedOn: "2026-09-05", comments: "Exchange students from TU Delft for the Design Studio workshop.", status: "allotted", documents: ["TU-Delft-MoU.pdf", "Guest-list.csv"] },
      people(7, "Female", "Exchange student", ["Emma de Vries","Sanne Jansen","Lotte Bakker","Fleur Visser","Anouk Smit","Iris Meijer","Julia Mulder"]));
    const floor2 = freeOnFloor(2).slice(0, 7);
    r.guestIds.forEach((g, i) => guestStay(guests.find((x) => x.id === g), floor2[i], r.from, r.to));
  }
  {
    const host = residents.find((x) => x.name.startsWith("Kamika")) || residents[8];
    host.name = "Kamika Chauhan";
    const r = addRequest({ type: "guest", owner: "student:" + host.id, requestedBy: host.name, requesterRoll: host.roll, title: "Kamika Chauhan Parents", count: 2, from: "2026-09-21", to: "2026-09-24", requestedOn: "2026-09-10", comments: "Parents visiting for convocation.", status: "allotted" },
      [{ name: "Rajesh Chauhan", relation: "Parent", gender: "Male" }, { name: "Sunita Chauhan", relation: "Parent" }]);
    const room = freeOnFloor(3).find((x) => x > "3008") || freeOnFloor(3)[0];
    for (const g of r.guestIds) guestStay(guests.find((x) => x.id === g), room, r.from, r.to);
  }
  // Checking out today
  for (let i = 0; i < 4; i++) {
    const host = studentFor();
    const rel = pick(["Sister", "Mother", "Friend"]);
    const r = addRequest({ type: "guest", owner: "student:" + host.id, requestedBy: host.name, requesterRoll: host.roll, title: host.name, count: 1, from: "2026-09-19", to: HMS.TODAY, requestedOn: "2026-09-08", comments: pick(["Sister visiting.", "Mother visiting for medical appointment.", "Friend attending Techfest planning meet."]), status: "allotted" }, [{ name: pick(FIRST) + " " + host.name.split(" ")[1], relation: rel }]);
    guestStay(guests[guests.length - 1], freeOnFloor(4 + (i % 2))[i], r.from, r.to);
  }
  // Checking in today — interview candidates routed by HCU
  {
    const r = addRequest({ type: "interview", owner: "org:Physics Office", requestedBy: "Physics Office", title: "Interview candidates", count: 5, from: HMS.TODAY, to: "2026-09-26", requestedOn: "2026-09-15", comments: "M.Sc. admission interview candidates. Routed by HCU.", status: "allotted", documents: ["Shortlist-MSc-Physics.pdf"] }, people(5, "Female", "Candidate"));
    const fl = freeOnFloor(5);
    r.guestIds.forEach((g, i) => guestStay(guests.find((x) => x.id === g), fl[i], r.from, r.to));
  }
  // IR exchange students living in H17 all semester (IRCC portal "active batch")
  {
    const r = addRequest({ type: "ir", owner: "org:IRCC", requestedBy: "IRCC", title: "IR exchange students · Autumn 2026", count: 5, from: "2026-07-28", to: "2026-12-10", requestedOn: "2026-06-20", comments: "Semester exchange, partner universities. Visa copies with IR office.", status: "allotted", documents: ["Exchange-nominations.pdf", "Visa-copies.zip"] },
      people(5, "Female", "Exchange student", ["Lena Fischer", "Sofia Rossi", "Mei Tanaka", "Chloé Martin", "Hannah Berg"]));
    const fl = freeOnFloor(1);
    r.guestIds.forEach((g, i) => guestStay(guests.find((x) => x.id === g), fl[i + 3], r.from, r.to));
  }
  // Other in-house guests
  for (let i = 0; i < 9; i++) {
    const host = studentFor();
    const from = D.add(HMS.TODAY, -Math.floor(rnd() * 5) - 1); const to = D.add(HMS.TODAY, Math.floor(rnd() * 6) + 1);
    const n = rnd() < .35 ? 2 : 1;
    const r = addRequest({ type: "guest", owner: "student:" + host.id, requestedBy: host.name, requesterRoll: host.roll, title: n === 2 ? host.name + " Parents" : host.name, count: n, from, to, requestedOn: D.add(from, -8), comments: pick(["Parents visiting.", "Parents visiting for convocation.", "Sister visiting over the weekend."]), status: "allotted" },
      Array.from({ length: n }, (_, k) => ({ name: (k === 0 && n === 2 ? pick(MALE) : pick(FIRST)) + " " + host.name.split(" ")[1], relation: n === 2 ? "Parent" : "Sister", gender: k === 0 && n === 2 ? "Male" : "Female" })));
    const room = freeOnFloor(1 + (i % 6))[2];
    for (const g of r.guestIds) guestStay(guests.find((x) => x.id === g), room, from, to);
  }

  // --- Waiting for the Hall Manager (Requests page + Updates) ---
  addRequest({ type: "workshop", owner: "org:IDC Office", requestedBy: "IDC Office", title: "20 females", count: 20, from: "2026-10-12", to: "2026-10-16", requestedOn: "2026-09-17", comments: "IDC Design Symposium speakers and student volunteers from partner institutes.", status: "pending", deanNote: "Approved. Symposium is an institute event.", documents: ["Symposium-brochure.pdf", "Participants.csv"] }, people(20, "Female", "Delegate"));
  const hcuInterview = addRequest({ type: "interview", owner: "org:Chemistry Office", requestedBy: "Chemistry Office", title: "Interview students accommodation", count: 15, from: "2026-10-05", to: "2026-10-08", requestedOn: "2026-09-20", comments: "PhD interview candidates (Chemistry). Female candidates only.", status: "pending", documents: ["PhD-shortlist.pdf"] }, people(15, "Female", "Candidate"));
  addRequest({ type: "ircc-intern", owner: "org:IRCC", requestedBy: "IRCC", title: "Winter research interns", count: 6, from: "2026-12-01", to: "2026-12-31", requestedOn: "2026-09-12", comments: "IRCC internship programme. List attached by IRCC.", status: "pending", deanNote: "Approved for December.", documents: ["Intern-list.csv", "Offer-letters.pdf"] }, people(6, "Female", "Intern"));
  for (let i = 0; i < 9; i++) {
    const host = studentFor();
    const from = D.add(HMS.TODAY, 3 + Math.floor(rnd() * 20)); const days = 2 + Math.floor(rnd() * 4);
    const n = rnd() < .3 ? 2 : 1;
    addRequest({ type: "guest", owner: "student:" + host.id, requestedBy: host.name, requesterRoll: host.roll, title: host.name, count: n, from, to: D.add(from, days), requestedOn: D.add(HMS.TODAY, -Math.floor(rnd() * 4)), contact: host.phone, comments: pick(["Parents visiting for Diwali break.", "Mother visiting for a medical check-up in Powai.", "Sister coming for Mood Indigo.", "Parents attending Institute Day."]), status: i < 2 ? "accepted" : "pending" },
      Array.from({ length: n }, () => ({ name: pick(FIRST) + " " + host.name.split(" ")[1], relation: n === 2 ? "Parent" : "Mother" })));
  }
  // Yatri's own requests (Student portal)
  addRequest({ type: "guest", owner: "student:RS-0001", requestedBy: yatri.name, requesterRoll: yatri.roll, title: "Yatri Amit Patel", count: 1, from: "2026-10-02", to: "2026-10-05", requestedOn: "2026-09-21", contact: yatri.phone, comments: "Mother visiting for Gandhi Jayanti long weekend.", status: "pending" }, [{ name: "Priti Patel", relation: "Mother" }]);
  addRequest({ type: "guest", owner: "student:RS-0001", requestedBy: yatri.name, requesterRoll: yatri.roll, title: "Yatri Amit Patel Parents", count: 2, from: "2026-08-14", to: "2026-08-16", requestedOn: "2026-08-04", contact: yatri.phone, comments: "Parents visiting for Independence Day weekend.", status: "completed" }, [{ name: "Amit Patel", relation: "Father", gender: "Male" }, { name: "Priti Patel", relation: "Mother" }]);

  // --- Waiting for HCU to pick a hostel ---
  addRequest({ type: "workshop", owner: "org:IDC Office", requestedBy: "IDC Office", title: "Interaction Design workshop", count: 12, gender: "Mixed", hostel: null, from: "2026-10-28", to: "2026-10-31", requestedOn: "2026-09-18", comments: "Faculty and students from NID and Srishti for the Interaction Design workshop.", status: "hcu", deanNote: "Approved. Keep them close to IDC if possible.", preferredHostel: "H17", documents: ["Workshop-note.pdf", "Participants.csv"] }, people(12, "Mixed", "Participant"));
  addRequest({ type: "interview", owner: "org:EE Office", requestedBy: "EE Office", title: "M.Tech admission interviewees", count: 14, gender: "Male", hostel: null, from: "2026-10-09", to: "2026-10-11", requestedOn: "2026-09-21", comments: "M.Tech (Microelectronics) interview candidates travelling from outside Mumbai.", status: "hcu", documents: ["EE-MTech-shortlist.pdf"] }, people(14, "Male", "Candidate"));
  addRequest({ type: "exam", owner: "org:IRCC", requestedBy: "IRCC", title: "JAM interview candidates", count: 8, gender: "Female", hostel: null, from: "2026-10-14", to: "2026-10-16", requestedOn: "2026-09-22", comments: "JAM 2027 interview round, female candidates.", status: "hcu", documents: ["JAM-list.csv"] }, people(8, "Female", "Candidate"));

  // --- Waiting for Associate Dean SA ---
  addRequest({ type: "researcher", owner: "org:IDC Office", requestedBy: "IDC Office", title: "Visiting researchers from Aalto", count: 2, gender: "Mixed", hostel: null, from: "2026-10-20", to: "2026-11-20", requestedOn: "2026-09-22", comments: "Two researchers joining the Design for Health lab for one month.", status: "dean", preferredHostel: "TANSA", documents: ["Invitation-letter.pdf", "Passport-copies.pdf"] },
    [{ name: "Aino Virtanen", gender: "Female", relation: "Researcher" }, { name: "Eero Laine", gender: "Male", relation: "Researcher" }]);
  addRequest({ type: "ircc-intern", owner: "org:IRCC", requestedBy: "IRCC", title: "Winter interns · batch 2", count: 24, gender: "Mixed", hostel: null, from: "2026-12-01", to: "2027-05-31", requestedOn: "2026-09-19", comments: "Second batch of six-month research interns. List and offer letters attached.", status: "dean", documents: ["Batch2-interns.csv", "Offer-letters.zip"] }, people(24, "Mixed", "Intern"));
  addRequest({ type: "event", owner: "org:Event Council", requestedBy: "Student Event Council", title: "Mood Indigo 2026 participants", count: 40, gender: "Mixed", hostel: null, from: "2026-12-17", to: "2026-12-21", requestedOn: "2026-09-20", comments: "Competition participants from other colleges. Clashes with winter intern arrivals, please check.", status: "dean", documents: ["MI-2026-participants.csv", "Council-authorisation.pdf"] }, people(40, "Mixed", "Participant"));
  addRequest({ type: "ir", owner: "org:IRCC", requestedBy: "IRCC", title: "Laura Jansen", count: 1, gender: "Female", hostel: null, from: "2026-12-28", to: "2027-05-10", requestedOn: "2026-09-21", comments: "Spring semester exchange student from TU Munich. Visa in process.", status: "dean", documents: ["Nomination.pdf"] }, [{ name: "Laura Jansen", gender: "Female", relation: "Exchange student" }]);

  // --- Sent to another hostel (HCU sees it waiting on that Hall Manager) ---
  addRequest({ type: "intern", owner: "org:IDC Office", requestedBy: "IDC Office", title: "Summer project interns", count: 3, gender: "Male", hostel: "H4", from: "2026-10-05", to: "2026-11-30", requestedOn: "2026-09-10", comments: "Project interns for the Assistive Tech lab.", status: "pending", deanNote: "Approved.", documents: ["Intern-offers.pdf"] }, people(3, "Male", "Intern"));

  // --- Past ---
  for (let i = 0; i < 6; i++) {
    const host = studentFor();
    const from = D.add(HMS.TODAY, -40 + i * 5); const to = D.add(from, 3);
    if (i === 0) addRequest({ type: "workshop", owner: "org:EE Office", requestedBy: "EE Office", title: "VLSI workshop speakers", count: 4, from, to, requestedOn: D.add(from, -10), comments: "Completed.", status: "completed" }, people(4, "Female", "Speaker"));
    else addRequest({ type: "guest", owner: "student:" + host.id, requestedBy: host.name, requesterRoll: host.roll, title: host.name, count: 1, from, to, requestedOn: D.add(from, -10), comments: i === 5 ? "Sister visiting." : "Completed.", status: i === 5 ? "rejected" : "completed", rejectReason: i === 5 ? "Dates clash with room repainting." : undefined, rejectedAt: "pending" }, [{ name: pick(FIRST) + " " + host.name.split(" ")[1], relation: "Sister" }]);
  }
  addRequest({ type: "ircc-intern", owner: "org:IRCC", requestedBy: "IRCC", title: "Summer interns 2026", count: 18, gender: "Mixed", hostel: "H12", from: "2026-05-15", to: "2026-07-15", requestedOn: "2026-04-02", comments: "Summer research interns.", status: "completed", documents: ["Summer-interns.csv"] }, people(18, "Mixed", "Intern"));
  addRequest({ type: "event", owner: "org:Event Council", requestedBy: "Student Event Council", title: "Techfest 2025 volunteers", count: 22, gender: "Mixed", hostel: "H9", from: "2025-12-26", to: "2025-12-30", requestedOn: "2025-11-20", comments: "Outstation volunteers.", status: "completed" }, people(22, "Mixed", "Volunteer"));
  addRequest({ type: "outreach", owner: "org:IDC Office", requestedBy: "IDC Office", title: "Design school outreach camp", count: 30, gender: "Mixed", hostel: null, from: "2026-08-20", to: "2026-08-24", requestedOn: "2026-07-25", comments: "School students for the design outreach camp.", status: "rejected", rejectedAt: "dean", rejectedBy: "Associate Dean SA", rejectReason: "Minors can't stay in student hostels. Please use the guest house." }, people(30, "Mixed", "Student"));

  /* ---------------------- Forms (Student → Hall Manager) ---------------------- */
  const form = (p) => { const f = { id: "FM-" + fid++, hostel: "H17", status: "submitted", note: "", ...p }; forms.push(f); return f; };
  form({ type: "mess-reg", residentId: "RS-0001", submittedOn: "2026-07-20", status: "approved", decidedOn: "2026-07-21", data: { mess: "Hostel 17 mess", from: "2026-07-22" } });
  form({ type: "retention", residentId: "RS-0001", submittedOn: "2026-04-20", status: "approved", decidedOn: "2026-04-22", data: { from: "2026-05-01", to: "2026-07-20", reason: "Summer internship in Powai." } });
  const r1 = residents[21], r2 = residents[34], r3 = residents[57];
  const f1 = form({ type: "room-change", residentId: r1.id, submittedOn: "2026-09-21", data: { reason: "Room is next to the pantry and too noisy for late study.", prefer: "Any quiet room on floor 4 or 5" } });
  const f2 = form({ type: "vacation", residentId: r2.id, submittedOn: "2026-09-22", data: { date: "2026-09-30", reason: "Moving to off-campus housing for thesis fieldwork." } });
  const f3 = form({ type: "retention", residentId: r3.id, submittedOn: "2026-09-22", data: { from: "2026-12-01", to: "2026-12-31", reason: "Staying on campus for a winter project." } });

  /* ---------------------------- Updates (HM inbox) ---------------------------- */
  const pendingHcu = hcuInterview;
  const sakshi = requests[0];
  updates.push(
    { id: "UP-1", hostel: "H17", type: "request", requestId: pendingHcu.id, title: "Interview students accommodation request", body: "HCU | " + pendingHcu.count + " students", from: pendingHcu.from, to: pendingHcu.to, state: "open" },
    { id: "UP-2", hostel: "H17", type: "extension", requestId: sakshi.id, title: "Extension request · Sakshi Tawde", body: "Requested by " + sakshi.requestedBy + ". Stay until 27/09 instead of 25/09.", from: sakshi.from, to: "2026-09-27", state: "open" },
    { id: "UP-3", hostel: "H17", type: "leave", residentId: residents[12].id, title: "Leave notice · " + residents[12].name, body: "Going home for Navratri. Room " + residents[12].room + " stays retained.", from: "2026-09-26", to: "2026-10-04", state: "open" },
    { id: "UP-4", hostel: "H17", type: "maintenance", room: "4031", residentId: residents.find((r) => r.room === "4031")?.id, title: "Repair reported · Room 4031", body: "Resident reports a broken window latch. Mark the room under maintenance?", from: HMS.TODAY, to: null, state: "open" },
    { id: "UP-5", hostel: "H17", type: "form", formId: f1.id, title: "Room change · " + r1.name, body: `Room ${r1.room}. ${f1.data.reason}`, from: f1.submittedOn, to: null, state: "open" },
    { id: "UP-6", hostel: "H17", type: "form", formId: f2.id, title: "Room vacation · " + r2.name, body: `Vacating ${r2.room} on ${D.fmt(f2.data.date)}. ${f2.data.reason}`, from: f2.submittedOn, to: null, state: "open" },
    { id: "UP-7", hostel: "H17", type: "form", formId: f3.id, title: "Room retention · " + r3.name, body: `Keep ${r3.room} over ${D.fmt(f3.data.from)} – ${D.fmt(f3.data.to)}. ${f3.data.reason}`, from: f3.submittedOn, to: null, state: "open" },
  );

  /* -------------------------------- Notices -------------------------------- */
  notices.push(
    { id: "NT-1", hostel: "H17", title: "Water supply off on Saturday", body: "No water in wings B and C on Sat 26 Sep, 10 am to 2 pm, for tank cleaning. Store water the night before.", date: "2026-09-22", by: "Hall Manager, Hostel 17" },
    { id: "NT-2", hostel: "all", title: "Winter break room retention", body: "Fill the room retention form by 20 Nov if you are staying on campus over the winter break. Rooms not retained may be given to winter interns.", date: "2026-09-18", by: "HCU Office" },
    { id: "NT-3", hostel: "H17", title: "Hostel council elections", body: "Nominations for the Hostel 17 council close on 30 Sep. Voting on 3 Oct in the common room.", date: "2026-09-15", by: "Hostel 17 Council" },
  );

  /* ---------------------------- New-batch upload (HCU) ---------------------------- */
  const lateAdmits = [
    { name: "Ira Deshmukh", roll: "26M2311", programGroup: "Masters", degree: "M.Des.", dept: "IDC" },
    { name: "Nitya Raman", roll: "26M2318", programGroup: "Masters", degree: "M.Des.", dept: "IDC" },
    { name: "Farah Siddiqui", roll: "26D0412", programGroup: "PhD", degree: "Ph.D.", dept: "Chemistry" },
    { name: "Kritika Bansal", roll: "26M1044", programGroup: "Masters", degree: "M.Tech.", dept: "CSE" },
  ];
  const batch = { id: "BT-1", name: "Autumn 2026 · late admissions (round 3)", uploadedOn: "2026-09-19", people: [] };
  for (const p of lateAdmits) {
    const res = makeResident({ ...p, semester: 1, joined: "2026-09-21", expectedExit: p.programGroup === "PhD" ? "2031-07-31" : "2028-05-31" });
    res.email = p.roll.toLowerCase() + "@iitb.ac.in";
    res.history = [];
    residents.push(res);
    batch.people.push({ name: p.name, roll: p.roll, gender: "Female", programme: p.degree, dept: p.dept, hostel: "H17", residentId: res.id });
  }
  const other = [["Aarav Kulkarni", "H12"], ["Rohan Iyer", "H12"], ["Kabir Joshi", "H14"], ["Diya Nair", "H10"], ["Saanvi Rao", "H15"], ["Tejas Menon", "H18"]];
  for (const [n, h] of other) batch.people.push({ name: n, roll: "26M" + (2000 + Math.floor(rnd() * 900)), gender: C.hostel(h).gender, programme: "M.Tech.", dept: pick(DEPTS), hostel: h });
  batches.push(batch);
  batches.push({ id: "BT-0", name: "Autumn 2026 · first-year B.Tech", uploadedOn: "2026-07-10", people: [], closed: true, summary: "1,284 students across 14 hostels. All allotted." });

  /* ------------------------------ Notifications ------------------------------ */
  const note = (to, text, href, at, read) => notifications.push({ id: "NF-" + nid++, to, text, href, at: at || HMS.TODAY, read: !!read });
  note("student:RS-0001", "Your request for Priti Patel (2–5 Oct) is with the Hall Manager.", "#/student/requests", "2026-09-21");
  note("student:RS-0001", "New notice: Water supply off on Saturday.", "#/student/home", "2026-09-22");
  note("org:IDC Office", "Associate Dean SA approved “Interaction Design workshop”. HCU will pick a hostel next.", "#/dept/requests", "2026-09-20");
  note("org:IDC Office", "Hostel 17 allotted rooms to “Student guests : 7”.", "#/dept/requests", "2026-09-07", true);
  note("org:IRCC", "“Winter research interns” is with the Hall Manager of Hostel 17.", "#/ircc/batches", "2026-09-16");
  note("org:Event Council", "“Mood Indigo 2026 participants” is waiting for Associate Dean SA.", "#/ircc/batches", "2026-09-20");
  note("dean", "4 requests are waiting for your approval.", "#/dean/approvals", "2026-09-22");
  note("hcu", "3 approved requests need a hostel.", "#/hcu/requests", "2026-09-22");
  note("hm:H17", "HCU uploaded 4 late admissions for Hostel 17. Allot rooms from the map.", "#/hm/actions", "2026-09-19");

  return {
    residents, guests, stays, maintenance, requests, updates, forms, notices, notifications, batches,
    customTabs: [],
    settings: { lang: "en", hostel: "Hostel 17", notify: { email: true, sms: false, digest: "08:00" }, staff: [{ name: "Diksha Rathod", role: "Hall Manager", access: "Full" }, { name: "Ramesh Pawar", role: "Office assistant", access: "Allot rooms, no resident edits" }] },
    extensions: [],
  };
};
