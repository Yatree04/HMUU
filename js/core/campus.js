/* ==========================================================================
   Campus — every hostel, every demo user, and the request types.

   Only Hostel 17 is modelled room by room (floor plan, residents, stays).
   The other hostels carry headline numbers so HCU can compare and route;
   their resident lists are generated on the fly (read-only, not stored).

   Hostel genders and capacities are placeholder values for the prototype.
   Replace them with HCU's real hostel register before any pilot.
   ========================================================================== */
window.HMS = window.HMS || {};

HMS.campus = (function () {
  // capacity = beds, occupied = residents on TODAY, maint = rooms out of use
  const HOSTELS = [
    { id: "H1", name: "Hostel 1", gender: "Male", capacity: 420, occupied: 391, guests: 6, maint: 4 },
    { id: "H2", name: "Hostel 2", gender: "Male", capacity: 380, occupied: 362, guests: 3, maint: 2 },
    { id: "H3", name: "Hostel 3", gender: "Male", capacity: 360, occupied: 344, guests: 2, maint: 5 },
    { id: "H4", name: "Hostel 4", gender: "Male", capacity: 400, occupied: 351, guests: 9, maint: 3 },
    { id: "H5", name: "Hostel 5", gender: "Male", capacity: 390, occupied: 377, guests: 1, maint: 2 },
    { id: "H6", name: "Hostel 6", gender: "Male", capacity: 410, occupied: 398, guests: 0, maint: 6 },
    { id: "H7", name: "Hostel 7", gender: "Male", capacity: 350, occupied: 322, guests: 4, maint: 1 },
    { id: "H8", name: "Hostel 8", gender: "Male", capacity: 340, occupied: 331, guests: 2, maint: 2 },
    { id: "H9", name: "Hostel 9", gender: "Male", capacity: 520, occupied: 471, guests: 12, maint: 7 },
    { id: "H10", name: "Hostel 10", gender: "Female", capacity: 460, occupied: 402, guests: 8, maint: 3 },
    { id: "H11", name: "Hostel 11", gender: "Male", capacity: 380, occupied: 366, guests: 2, maint: 4 },
    { id: "H12", name: "Hostel 12", gender: "Male", capacity: 620, occupied: 540, guests: 14, maint: 9, renovating: "Wing C" },
    { id: "H13", name: "Hostel 13", gender: "Male", capacity: 610, occupied: 566, guests: 5, maint: 6 },
    { id: "H14", name: "Hostel 14", gender: "Male", capacity: 640, occupied: 590, guests: 7, maint: 4 },
    { id: "H15", name: "Hostel 15", gender: "Female", capacity: 580, occupied: 511, guests: 10, maint: 5 },
    { id: "H16", name: "Hostel 16", gender: "Male", capacity: 560, occupied: 548, guests: 2, maint: 3 },
    { id: "H17", name: "Hostel 17", gender: "Female", modelled: true },
    { id: "H18", name: "Hostel 18", gender: "Male", capacity: 600, occupied: 527, guests: 11, maint: 8 },
    { id: "H19", name: "Hostel 19", gender: "Male", capacity: 520, occupied: 489, guests: 6, maint: 2 },
    { id: "H21", name: "Hostel 21", gender: "Male", capacity: 700, occupied: 612, guests: 16, maint: 10, renovating: "Wing A" },
    { id: "TANSA", name: "Tansa House", gender: "Mixed", capacity: 160, occupied: 118, guests: 21, maint: 2 },
  ];

  /* ------------------------------- Users ------------------------------- */
  // One demo account per role. `target` is the notification address.
  const USERS = {
    hm: { role: "hm", name: "Diksha Rathod", initial: "D", title: "Hall Manager · Hostel 17", hostel: "H17", target: "hm:H17" },
    hcu: { role: "hcu", name: "HCU Office", initial: "H", title: "Hostel Coordinating Unit", target: "hcu" },
    dean: { role: "dean", name: "Associate Dean SA", initial: "A", title: "Associate Dean, Student Affairs", target: "dean" },
    student: { role: "student", name: "Yatri Amit Patel", initial: "Y", title: "Student · 24B3625 · Hostel 17", residentId: "RS-0001", target: "student:RS-0001" },
    dept: { role: "dept", name: "IDC Office", initial: "I", title: "Department Office · IDC School of Design", org: "IDC Office", target: "org:IDC Office" },
    ircc: { role: "ircc", name: "IRCC Office", initial: "I", title: "IRCC & Event Council", org: "IRCC", target: "org:IRCC" },
  };

  const ROLES = [
    { id: "hm", label: "Hall Manager", blurb: "Run one hostel: rooms, residents, guests and the live hostel map.", home: "#/hm/dashboard" },
    { id: "hcu", label: "HCU Office", blurb: "See every hostel, route approved requests, upload new batches.", home: "#/hcu/dashboard" },
    { id: "dean", label: "Associate Dean SA", blurb: "Approve or reject accommodation requests with a note.", home: "#/dean/approvals" },
    { id: "student", label: "Student", blurb: "Your room, guest requests, and hostel forms in one place.", home: "#/student/home" },
    { id: "dept", label: "Department Office", blurb: "Book stays for interviewees, interns, speakers and researchers.", home: "#/dept/requests" },
    { id: "ircc", label: "IRCC & Event Council", blurb: "Book rooms in bulk for interns, exchange students and events.", home: "#/ircc/batches" },
  ];

  /* ---------------------------- Request types ---------------------------- */
  // dean: needs Associate Dean SA approval before HCU routes it
  const TYPES = {
    guest: { label: "Student guest", source: "student", dean: false },
    outreach: { label: "Educational outreach", source: "department", dean: true },
    workshop: { label: "Workshop and seminar", source: "department", dean: true },
    interview: { label: "Admission interviewees", source: "department", dean: false },
    intern: { label: "Project interns", source: "department", dean: true },
    researcher: { label: "Visiting researchers", source: "department", dean: true },
    "ircc-intern": { label: "IRCC summer and winter interns", source: "ircc", dean: true },
    event: { label: "Student event participants", source: "ircc", dean: true },
    exam: { label: "Exam interview candidates", source: "ircc", dean: false },
    ir: { label: "IR and exchange students", source: "ircc", dean: true },
    direct: { label: "Booked by Hall Manager", source: "hall-manager", dean: false },
  };
  const DEPT_TYPES = ["outreach", "workshop", "interview", "intern", "researcher"];
  const IRCC_TYPES = ["ircc-intern", "event", "exam", "ir"];

  /* ------------------- Other hostels' residents (read-only) ------------------- */
  const cache = {};
  function residentsOf(hostelId) {
    if (cache[hostelId]) return cache[hostelId];
    const h = HOSTELS.find((x) => x.id === hostelId);
    if (!h || h.modelled) return [];
    let s = hostelId.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7) | 0;
    const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const F = ["Aarav","Vivaan","Aditya","Arjun","Sai","Reyansh","Krishna","Ishaan","Rohan","Kabir","Aniket","Pranav","Siddharth","Harsh","Yash","Om","Nikhil","Rahul","Varun","Kunal"];
    const FF = ["Aanya","Diya","Ishita","Kavya","Meera","Naina","Riya","Saanvi","Tanvi","Zoya","Aditi","Gauri","Neha","Pooja","Shreya"];
    const L = ["Sharma","Iyer","Patel","Rao","Kulkarni","Nair","Reddy","Gupta","Joshi","Mehta","Singh","Verma","Pillai","Shetty","Das","Bose","Mishra","Agarwal","Naik","Pandey"];
    const DEPTS = ["CSE","EE","ME","CE","Chemistry","Physics","HSS","Aerospace","Chemical","Metallurgy","IDC","Earth Sciences","Energy Science","Biosciences","Mathematics"];
    const PROG = [["Bachelors","B.Tech.","B"],["Masters","M.Tech.","M"],["PhD","Ph.D.","D"]];
    const out = [];
    for (let i = 0; i < h.occupied; i++) {
      const p = PROG[rnd() < .55 ? 0 : rnd() < .6 ? 1 : 2];
      const female = h.gender === "Female" || (h.gender === "Mixed" && rnd() < .5);
      const y = 22 + Math.floor(rnd() * 5);
      const floor = 1 + Math.floor(rnd() * 5);
      out.push({ kind: "resident", id: hostelId + "-" + i, hostel: hostelId, room: String(floor) + String(1 + Math.floor(rnd() * 90)).padStart(3, "0"), roll: y + p[2] + String(1000 + Math.floor(rnd() * 8999)), name: pick(female ? FF : F) + " " + pick(L), dept: pick(DEPTS), programGroup: p[0], program: p[1], gender: female ? "Female" : "Male" });
    }
    return (cache[hostelId] = out);
  }

  return { HOSTELS, USERS, ROLES, TYPES, DEPT_TYPES, IRCC_TYPES, residentsOf, hostel: (id) => HOSTELS.find((h) => h.id === id) };
})();
