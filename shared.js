// Small helpers used by the public menu, the client panel and the agency panel.

// ---------- plans and the payment lock
export const PLANS = {
  monthly: { label: "Monthly", price: 179, months: 1, per: "month" },
  yearly: { label: "Yearly", price: 2000, months: 12, per: "year" }
};
export const GRACE_DAYS = 3;
export const UPI_ID = "8019314110@fam";
export const PAY_WHATSAPP = "918019314110";
var DAY = 86400000;

export function rupees(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
export function fmtDate(ms) {
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
export function endOfDay(ms) { var d = new Date(ms); d.setHours(23, 59, 59, 999); return d.getTime(); }

// Adds whole months and keeps the day when it can (31 Jan + 1 month = 28 Feb). Result is the end of that day.
export function addMonths(ms, n) {
  var d = new Date(ms), day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return endOfDay(d.getTime());
}

// none: no plan set, never locks. active: paid. grace: overdue but still live. locked: switched off.
export function subStatus(sub, now) {
  now = now == null ? Date.now() : now;
  if (!sub || !isFinite(Number(sub.paidUntil))) return { state: "none" };
  var due = Number(sub.paidUntil), lockAt = due + GRACE_DAYS * DAY;
  if (now <= due) return { state: "active", due: due, lockAt: lockAt, daysLeft: Math.ceil((due - now) / DAY) };
  if (now <= lockAt) return { state: "grace", due: due, lockAt: lockAt, daysLeft: Math.ceil((lockAt - now) / DAY) };
  return { state: "locked", due: due, lockAt: lockAt };
}

// The next due date when a payment is marked. Paid or in grace: continue from the old due date. Locked or new: start today.
export function nextDue(sub, planKey, now) {
  now = now == null ? Date.now() : now;
  var st = subStatus(sub, now);
  var base = st.state === "active" || st.state === "grace" ? st.due : now;
  return addMonths(base, PLANS[planKey].months);
}

// ---------- cafe colours
export var DEFAULT_THEME = { bar: "#8E1409", accent: "#F4A300", bg: "#FFF1DC" };
export var PRESETS = [
  { name: "Chili red", bar: "#8E1409", accent: "#F4A300", bg: "#FFF1DC" },
  { name: "Forest", bar: "#1F4D36", accent: "#E9B44C", bg: "#F5F1E6" },
  { name: "Ocean", bar: "#12395B", accent: "#F28F3B", bg: "#EEF4F8" },
  { name: "Plum", bar: "#4B1D4F", accent: "#F2A65A", bg: "#FBF3F4" },
  { name: "Charcoal", bar: "#1E1E1E", accent: "#E0B04B", bg: "#F4F1EC" },
  { name: "Night", bar: "#0A0A0D", accent: "#F4A300", bg: "#1B1B21" }
];

var HEX = /^#[0-9a-f]{6}$/i;
export function validTheme(t) {
  if (!t || !HEX.test(t.bar) || !HEX.test(t.accent) || !HEX.test(t.bg)) return null;
  return { bar: t.bar.toUpperCase(), accent: t.accent.toUpperCase(), bg: t.bg.toUpperCase() };
}

function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
function toHex(c) { return "#" + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? "0" : "") + v.toString(16); }).join("").toUpperCase(); }
function mix(a, b, t) { var x = rgb(a), y = rgb(b); return toHex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
function lum(h) {
  var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  var x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
// The better of two text colours on this background. If neither is readable enough, falls back to pure white or black.
function readable(bg, light, dark) {
  var pick = contrast(bg, dark) >= contrast(bg, light) ? dark : light;
  if (contrast(bg, pick) >= 4.5) return pick;
  return contrast(bg, "#000000") >= contrast(bg, "#FFFFFF") ? "#000000" : "#FFFFFF";
}

// Turns three chosen colours into every colour the page uses, so text always stays readable.
export function themeVars(t) {
  t = validTheme(t) || DEFAULT_THEME;
  var dark = lum(t.bg) < 0.18;
  var ink = readable(t.bg, mix(t.bg, "#FFFFFF", 0.92), mix(t.bg, "#000000", 0.9));
  var muted = ink;
  for (var k = 0.4; k >= 0; k -= 0.05) {
    muted = mix(ink, t.bg, k);
    if (contrast(muted, t.bg) >= 4.6) break;
  }
  var onBar = readable(t.bar, "#FFF8EF", "#1F130C");
  var price = contrast(t.bar, t.bg) >= 4.5 ? t.bar : (contrast(t.accent, t.bg) >= 4.5 ? t.accent : ink);
  return {
    dark: dark,
    vars: {
      "--bg": t.bg,
      "--surface": dark ? mix(t.bg, "#FFFFFF", 0.06) : mix(t.bg, "#FFFFFF", 0.55),
      "--ink": ink,
      "--muted": muted,
      "--line": mix(t.bg, ink, dark ? 0.2 : 0.14),
      "--bar": t.bar,
      "--on-bar": onBar,
      "--chip-line": mix(t.bar, onBar, 0.35),
      "--price": price,
      "--saffron": t.accent,
      "--on-saffron": readable(t.accent, "#FFFFFF", "#2A160E")
    }
  };
}

// Applies a cafe's colours to a page (or to a preview box). With no valid colours it clears them, so the default look returns.
export function applyTheme(el, theme, root) {
  var names = ["--bg", "--surface", "--ink", "--muted", "--line", "--bar", "--on-bar", "--chip-line", "--price", "--saffron", "--on-saffron"];
  var t = validTheme(theme);
  if (!t) {
    names.forEach(function (n) { el.style.removeProperty(n); });
    if (root) { root.removeAttribute("data-theme"); el.style.colorScheme = ""; }
    return;
  }
  var v = themeVars(t);
  names.forEach(function (n) { el.style.setProperty(n, v.vars[n]); });
  if (root) { root.setAttribute("data-theme", "light"); el.style.colorScheme = v.dark ? "dark" : "light"; }
}
