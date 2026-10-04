/* ==========================================================================
   Hostel 17 typical floor — geometry lifted from Figma node 238:5420
   ("Frame 2491" inside "Bookings 1", 238:5393). Units are Figma px inside
   the 806 × 780 frame, so the SVG viewBox can use them directly.

   Each group is a straight run of rooms. `dir: "v"` stacks downward,
   `dir: "h"` runs rightward. `reverse: true` numbers the run from the far
   end so numbering goes clockwise around the building.

   Wings are a proposal: the Figma "Wing A" dropdown exists but wings are not
   drawn yet. A = west, B = north + north-east, C = east + south, D = inner
   ring around the courtyard. Confirm with the Hall Manager before relying on it.
   ========================================================================== */
window.HMS = window.HMS || {};

HMS.floorplan = (function () {
  const GAP = 2.9;
  const V = { w: 44.46, h: 29 };   // room in a vertical run
  const H = { w: 29, h: 44.46 };   // room in a horizontal run

  const groups = [
    // Wing A — west
    { id: "T1", wing: "A", dir: "v", x: 132.42, y: 19.33, n: 2 },
    { id: "L1", wing: "A", dir: "v", x: 19.33, y: 19.33, n: 8 },
    { id: "L2", wing: "A", dir: "v", x: 19.33, y: 344.1, n: 4 },
    { id: "L3", wing: "A", dir: "v", x: 19.33, y: 521.96, n: 4 },
    { id: "L4", wing: "A", dir: "v", x: 20.3, y: 653.41, n: 1 },
    // Wing B — north
    { id: "T2", wing: "B", dir: "h", x: 265.81, y: 19.33, n: 13 },
    { id: "R1", wing: "B", dir: "v", x: 748.14, y: 19.33, n: 9 },
    // Wing C — east + south
    { id: "R2", wing: "C", dir: "v", x: 748.14, y: 435.93, n: 4 },
    { id: "R3", wing: "C", dir: "h", x: 699.81, y: 624.41, n: 3, hh: 45.43 },
    { id: "B1", wing: "C", dir: "h", x: 196.22, y: 629.25, n: 13, reverse: true },
    // Wing D — inner ring
    { id: "IT", wing: "D", dir: "h", x: 255.18, y: 148.85, n: 11 },
    { id: "IR", wing: "D", dir: "v", x: 614.75, y: 201.05, n: 9 },
    { id: "IB", wing: "D", dir: "h", x: 255.18, y: 504.56, n: 11, reverse: true },
    { id: "IL", wing: "D", dir: "v", x: 199.12, y: 193.32, n: 9, reverse: true },
  ];

  // Non-bookable blocks drawn on the plan (labels are a guess — confirm on site)
  const blocks = [
    { x: 20.3, y: 275.48, w: 44.46, h: 63.8, kind: "common", label: "Pantry" },
    { x: 749.1, y: 367.3, w: 44.46, h: 63.8, kind: "common", label: "Washroom" },
    { x: 187.52, y: 19.33, w: 67.66, h: 55.1, kind: "common", label: "Stairs" },
    { x: 194.28, y: 486.19, w: 54.13, h: 55.1, kind: "common", label: "Stairs" },
    { x: 609.92, y: 493.92, w: 54.13, h: 55.1, kind: "common", label: "Stairs" },
    { x: 24.16, y: 699.81, w: 172.05, h: 63.8, kind: "service", label: "Service" },
  ];

  const courtyard = { x: 248.32, y: 204.92, w: 354.74, h: 289.01 };

  // Outline = union of (0,0,805,687) and (0,527,208,252), rounded
  const outline =
    "M12 0 H793 Q805 0 805 12 V675 Q805 687 793 687 H222 Q208 687 208 701 V767 Q208 779 196 779 H12 Q0 779 0 767 V12 Q0 0 12 0 Z";

  /** Build the list of room slots for one floor. Index is 1-based and
      clockwise, so floor 3 slot 5 → room "3005". */
  function slots() {
    const out = [];
    let idx = 1;
    for (const g of groups) {
      const size = g.dir === "v" ? V : { w: H.w, h: g.hh || H.h };
      const cells = [];
      for (let i = 0; i < g.n; i++) {
        const x = g.dir === "h" ? g.x + i * (size.w + GAP) : g.x;
        const y = g.dir === "v" ? g.y + i * (size.h + GAP) : g.y;
        cells.push({ x, y, w: size.w, h: size.h });
      }
      if (g.reverse) cells.reverse();
      for (const c of cells) out.push({ ...c, idx: idx++, group: g.id, wing: g.wing });
    }
    return out;
  }

  const SLOTS = slots();
  const FLOORS = [1, 2, 3, 4, 5, 6];
  const WINGS = ["A", "B", "C", "D"];

  function roomNo(floor, idx) {
    return String(floor) + String(idx).padStart(3, "0");
  }
  function parseRoom(no) {
    const s = String(no);
    return { floor: Number(s.slice(0, -3)), idx: Number(s.slice(-3)) };
  }
  function wingOf(no) {
    const { idx } = parseRoom(no);
    const slot = SLOTS[idx - 1];
    return slot ? slot.wing : null;
  }
  function allRooms() {
    const out = [];
    for (const f of FLOORS) for (const s of SLOTS) out.push(roomNo(f, s.idx));
    return out;
  }

  return { SLOTS, FLOORS, WINGS, blocks, courtyard, outline, roomNo, parseRoom, wingOf, allRooms, viewBox: "0 0 806 780" };
})();

