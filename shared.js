// Small helpers used by the public menu, the client panel and the agency panel.

// ---------- plans and the payment lock
// Two tiers, each billed monthly or yearly. The tier is stored on the cafe ("tier"); the paid period on "sub".
export const TIERS = {
  standard: { label: "Standard", monthly: 179, yearly: 1999 },
  premium: { label: "Premium", monthly: 269, yearly: 3049 }
};
export const PERIODS = {
  monthly: { label: "Monthly", months: 1, per: "month" },
  yearly: { label: "Yearly", months: 12, per: "year" }
};
export function priceOf(tier, period) { return (TIERS[tier] || TIERS.standard)[period === "yearly" ? "yearly" : "monthly"]; }
export function tierOf(rest) { return rest && rest.tier === "premium" ? "premium" : "standard"; }
export function isPremium(rest) { return tierOf(rest) === "premium"; }
export const STANDARD_FEATURES = [
  "Clean digital menu on any phone, opened by QR code",
  "Edit dishes, prices, photos and sold-out items yourself",
  "Your own colors and logo",
  "Instagram, WhatsApp and Google review buttons"
];
export const PREMIUM_FEATURES = [
  "Everything in Standard",
  "Customers order from their table: a separate QR code per table",
  "Live orders panel with a sound alert for new orders",
  "Reception ordering panel (POS) with printable receipts",
  "Loyalty stamp card that brings customers back",
  "App-style menu with a photo slider, like the delivery apps",
  "Your logo on the menu and on every table QR"
];
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

// The next due date when a payment is marked (periodKey is "monthly" or "yearly"). Paid or in grace: continue from the old due date. Locked or new: start today.
export function nextDue(sub, periodKey, now) {
  now = now == null ? Date.now() : now;
  var st = subStatus(sub, now);
  var base = st.state === "active" || st.state === "grace" ? st.due : now;
  return addMonths(base, PERIODS[periodKey].months);
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
function readable(bg, light, dark) { return contrast(bg, dark) >= contrast(bg, light) ? dark : light; }

// Turns three chosen colours into every colour the page uses, so text always stays readable.
export function themeVars(t) {
  t = validTheme(t) || DEFAULT_THEME;
  var dark = lum(t.bg) < 0.3;
  var ink = dark ? mix(t.bg, "#FFFFFF", 0.92) : mix(t.bg, "#000000", 0.9);
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

// ---------- orders, phones, pictures
export function normPhone(v) {
  var d = String(v || "").replace(/\D/g, "");
  if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
  if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : "";
}
export function orderCode(id) { return String(id || "").slice(-4).toUpperCase(); }
export function fmtTime(ms) { return new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }); }
export function lineTotal(lines) { return (lines || []).reduce(function (t, l) { return t + Number(l.v) * Number(l.q); }, 0); }
export function cleanTable(t) { t = String(t || "").trim(); return /^[A-Za-z0-9 -]{1,12}$/.test(t) ? t : ""; }
export function safeImg(u) { u = String(u || "").trim(); return /^(https:\/\/|data:image\/)/i.test(u) ? u : ""; }

// Reads a photo file, crops it to w x h and shrinks it until the text of the picture is at most maxChars long.
// opts.contain keeps the whole picture (for logos) instead of cropping.
export async function shrinkPhoto(file, w, h, maxChars, opts) {
  opts = opts || {};
  var bmp;
  try { bmp = await createImageBitmap(file); }
  catch (e) {
    bmp = await new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }
  var sw = bmp.width, sh = bmp.height;
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  var g = c.getContext("2d");
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h);
  if (opts.contain) {
    var k = Math.min(w / sw, h / sh);
    g.drawImage(bmp, 0, 0, sw, sh, (w - sw * k) / 2, (h - sh * k) / 2, sw * k, sh * k);
    if (opts.png) { var png = c.toDataURL("image/png"); if (png.length <= maxChars) return png; }
  } else {
    var r = Math.max(w / sw, h / sh), cw = w / r, ch = h / r;
    g.drawImage(bmp, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, w, h);
  }
  var q = 0.8, out = c.toDataURL("image/jpeg", q);
  while (out.length > maxChars && q > 0.35) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
  return out;
}

// Loyalty expiry. `days` is the cafe's setting (0 or empty = stamps never expire).
// Stamps lapse when no stamp has been added for `days` days; the last stamp time is the doc's updatedAt.
export function stampState(d, days) {
  var n = Math.max(0, Number(d && d.stamps) || 0);
  days = Number(days) || 0;
  var at = d && d.updatedAt && d.updatedAt.toMillis ? d.updatedAt.toMillis() : 0;
  if (!days || !at || !n) return { n: n, expired: false, lost: 0, until: null };
  var until = at + days * 86400000;
  if (Date.now() > until) return { n: 0, expired: true, lost: n, until: until };
  return { n: n, expired: false, lost: 0, until: until };
}
