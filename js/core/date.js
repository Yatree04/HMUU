/* Date helpers — ISO yyyy-mm-dd strings, local time, no timezone math. */
window.HMS = window.HMS || {};

HMS.date = {
  add(iso, days) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return HMS.date.iso(d); },
  iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); },
  max(a, b) { return a > b ? a : b; },
  days(from, to) { return Math.round((new Date(to + "T00:00:00") - new Date(from + "T00:00:00")) / 864e5); },
  fmt(iso) { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; },
  range(from, to) { return HMS.date.fmt(from) + " – " + HMS.date.fmt(to); },
  fmtShort(iso) { if (!iso) return "—"; const d = new Date(iso + "T00:00:00"); return d.getDate() + " " + d.toLocaleString("en-GB", { month: "short" }) + " " + d.getFullYear(); },
  /** Do [a1,a2] and [b1,b2] share at least one day? */
  rangesOverlap(a1, a2, b1, b2) { return a1 <= (b2 || "9999") && b1 <= (a2 || "9999"); },
  overlaps(from, to, day) { return from <= day && (to == null || to >= day); },
};

