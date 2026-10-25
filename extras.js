// Menu extras that run only on the customer's phone: a free menu chatbot and three small games.
// Nothing here talks to the database, so it costs 0 Firebase reads and 0 writes. It only uses the menu already saved on the phone.

function esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
}
function rupees(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
function minP(it) { var v = (it.p || []).map(function (x) { return Number(x.v); }).filter(function (x) { return x > 0; }); return v.length ? Math.min.apply(null, v) : 0; }
function priceText(it) { return (it.p || []).map(function (x) { return (x.l ? x.l + " " : "") + rupees(x.v); }).join(" / "); }
function toks(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9ऀ-ॿ\s]/g, " ").split(/\s+/).filter(Boolean); }
function waLink(links) {
  var d = String((links && links.whatsapp) || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  return d.length >= 11 ? "https://wa.me/" + d : "";
}
var STOP = { the: 1, a: 1, an: 1, is: 1, are: 1, do: 1, you: 1, have: 1, has: 1, any: 1, me: 1, show: 1, tell: 1, what: 1, whats: 1, which: 1, of: 1, for: 1, and: 1, or: 1, with: 1, in: 1, on: 1, to: 1, i: 1, we: 1, your: 1, our: 1, can: 1, get: 1, want: 1, like: 1, please: 1, about: 1, there: 1, it: 1, price: 1, cost: 1, much: 1, how: 1, menu: 1, dish: 1, dishes: 1, item: 1, items: 1, food: 1, something: 1, got: 1, some: 1 };

// ---------- the chatbot: plain matching on the saved menu (no AI, no network)
export function answer(D, raw) {
  var text = String(raw || "").toLowerCase().trim();
  var T = toks(text), has = function (w) { return T.indexOf(w) >= 0; };
  var items = D.items || [], cats = D.categories || [], wa = waLink(D.links);
  function list(arr, head, max) {
    max = max || 8;
    var shown = arr.slice(0, max);
    return { text: head + (arr.length > max ? " (showing " + max + " of " + arr.length + ")" : ""), items: shown.map(function (it) { return { n: it.n, price: priceText(it), d: it.d || "", sold: !!it.sold }; }) };
  }
  var live = items.filter(function (i) { return !i.sold; });
  var m;

  if (!T.length) return { text: "Type a question, like \"what is your bestseller?\" or \"anything under 200?\"." };

  // budget
  m = /(?:under|below|less than|within|upto|up to|max|maximum|budget(?: of)?|cheaper than|around)\s*(?:rs\.?|₹|inr)?\s*(\d{2,5})/.exec(text) || /(\d{2,5})\s*(?:rs|rupees|₹)?\s*(?:or less|and below|or below|only|budget)/.exec(text);
  if (m) {
    var cap = Number(m[1]);
    var cheap = live.filter(function (i) { return minP(i) > 0 && minP(i) <= cap; }).sort(function (a, b) { return minP(a) - minP(b); });
    if (cheap.length) return list(cheap, "Dishes from " + rupees(cap) + " and below:", 8);
    var lowest = live.filter(function (i) { return minP(i) > 0; }).sort(function (a, b) { return minP(a) - minP(b); })[0];
    return { text: "Nothing at " + rupees(cap) + " or below." + (lowest ? " Our lowest price is " + lowest.n + " at " + priceText(lowest) + "." : "") };
  }
  if (has("cheap") || has("cheapest") || has("affordable") || has("budget")) {
    var c5 = live.filter(function (i) { return minP(i) > 0; }).sort(function (a, b) { return minP(a) - minP(b); });
    if (c5.length) return list(c5, "Our most affordable dishes:", 6);
  }

  // a category by name
  var catHit = cats.filter(function (c) {
    var ct = toks(c.name).filter(function (w) { return w.length > 1 && !STOP[w]; });
    return ct.length && ct.every(function (w) { return T.some(function (x) { return x === w || (w.length > 3 && x.length > 3 && (x.indexOf(w) === 0 || w.indexOf(x) === 0)); }); });
  })[0];
  if (catHit) {
    var inCat = items.filter(function (i) { return i.cat === catHit.id; });
    if (inCat.length) return list(inCat, catHit.name + ":", 10);
  }

  // a dish by name
  var best = [], top = 0;
  items.forEach(function (it) {
    var nt = toks(it.n).filter(function (w) { return w.length > 1; });
    if (!nt.length) return;
    var hit = nt.filter(function (w) { return T.some(function (x) { return x === w || (w.length > 3 && x.length > 3 && (x.indexOf(w) === 0 || w.indexOf(x) === 0)); }); }).length;
    var score = hit / nt.length;
    if (text.indexOf(String(it.n).toLowerCase()) >= 0) score = 2;
    if (score >= 0.99 || (score >= 0.6 && hit >= 2) || (hit >= 2 && nt.length >= 3)) { best.push({ it: it, score: score + hit / 100 }); if (score + hit / 100 > top) top = score + hit / 100; }
  });
  if (best.length) {
    best.sort(function (a, b) { return b.score - a.score; });
    var pick = best.filter(function (b) { return b.score >= top - 0.3; }).slice(0, 4).map(function (b) { return b.it; });
    return list(pick, pick.length === 1 ? "Here it is:" : "These match:", 4);
  }

  // popular, spicy, sharing, new
  if (has("bestseller") || has("bestsellers") || has("popular") || has("recommend") || has("recommended") || has("famous") || has("best") || has("suggest") || has("special") || has("favourite") || has("favorite") || has("top")) {
    var bs = live.filter(function (i) { return i.t === "Bestseller"; });
    if (bs.length) return list(bs, "Our bestsellers:", 8);
    return { text: "I do not have bestsellers marked yet. Ask our staff what they recommend today." };
  }
  if (has("spicy") || has("hot") || has("chilli") || has("chili") || has("masala")) {
    var sp = live.filter(function (i) { return i.t === "Spicy" || /spic|chill?i|peri|hot/i.test(String(i.n) + " " + String(i.d || "")); });
    if (sp.length) return list(sp, "Spicy picks:", 8);
    return { text: "Nothing is marked spicy on the menu. Ask our staff to make a dish spicier." };
  }
  if (has("sharing") || has("share") || has("family") || has("group") || has("party")) {
    var sh = live.filter(function (i) { return i.t === "Sharing"; });
    if (sh.length) return list(sh, "Good for sharing:", 8);
  }
  if (has("new") || has("latest")) {
    var nw = live.filter(function (i) { return i.t === "New"; });
    if (nw.length) return list(nw, "New on the menu:", 8);
  }
  if (has("soldout") || (has("sold") && has("out")) || has("unavailable") || has("available")) {
    var so = items.filter(function (i) { return i.sold; });
    return so.length ? list(so, "Sold out right now:", 8) : { text: "Everything on the menu is available right now." };
  }

  // contact
  if (has("contact") || has("whatsapp") || has("call") || has("phone") || has("location") || has("address") || has("timing") || has("timings") || has("open") || has("hours") || has("book") || has("reserve") || has("reservation") || has("delivery")) {
    return wa ? { text: "For that, please message us on WhatsApp.", link: { href: wa, label: "Chat on WhatsApp" } } : { text: "Please ask our staff, they will be happy to help." };
  }
  if (has("thanks") || has("thank") || has("thankyou")) return { text: "You are welcome! Enjoy your meal." };
  if (has("hi") || has("hello") || has("hey") || has("hii") || has("namaste")) return { text: "Hello! Ask me about dishes, prices or what is popular." };

  // veg
  if (has("veg") || has("vegetarian") || has("vegan")) {
    var vg = live.filter(function (i) { var s = (String(i.n) + " " + String(i.d || "")).toLowerCase(); return /\bveg\b|vegetarian|paneer|vegetable|mushroom/.test(s) && !/non[\s-]?veg/.test(s); });
    if (vg.length) return list(vg, "Vegetarian dishes (from their names and descriptions):", 8);
  }

  // anything else: look for any word in a dish name or description
  var words = T.filter(function (w) { return w.length >= 3 && !STOP[w]; });
  var found = items.filter(function (it) {
    var s = (String(it.n) + " " + String(it.d || "")).toLowerCase();
    return words.some(function (w) { return s.indexOf(w) >= 0; });
  });
  if (found.length) return list(found, "I found these:", 6);
  var out = { text: "Sorry, I could not find that on the menu. Try a dish or category name, or ask for bestsellers." };
  if (wa) out.link = { href: wa, label: "Ask us on WhatsApp" };
  return out;
}

function chipsFor(D) {
  var out = ["What is your bestseller?", "Anything spicy?", "Under ₹200"];
  (D.categories || []).slice(0, 3).forEach(function (c) { out.push("Show " + c.name); });
  return out;
}

export function openChat(ctx) {
  var D = ctx.D, h = ctx.host;
  h.innerHTML = '<div class="hd"><h2 id="dlgT">Ask our menu</h2><button class="x" type="button" data-close aria-label="Close">×</button></div>' +
    '<p class="muted">I answer from this menu. I am not a person, so for anything else please ask our staff.</p>' +
    '<div class="cmsgs" id="cmsgs" role="log" aria-live="polite"></div>' +
    '<div class="chips" id="cchips">' + chipsFor(D).map(function (c) { return '<button type="button" class="chip" data-q="' + esc(c) + '">' + esc(c) + "</button>"; }).join("") + "</div>" +
    '<form id="cform" class="cform" novalidate><input id="cin" maxlength="80" placeholder="Type a question" aria-label="Your question" autocomplete="off"><button class="btn primary" type="submit">Ask</button></form>';
  var box = h.querySelector("#cmsgs");
  function bubble(kind, html) { var d = document.createElement("div"); d.className = "cb " + kind; d.innerHTML = html; box.appendChild(d); box.scrollTop = box.scrollHeight; }
  function reply(q) {
    bubble("me", esc(q));
    var r = answer(D, q), html = esc(r.text);
    if (r.items && r.items.length) {
      html += '<ul class="cl">' + r.items.map(function (i) {
        return "<li><b>" + esc(i.n) + "</b> " + (i.sold ? '<span class="so">sold out</span> ' : "") + '<span class="pp">' + esc(i.price) + "</span>" + (i.d ? "<br><small>" + esc(i.d) + "</small>" : "") + "</li>";
      }).join("") + "</ul>";
    }
    if (r.link) html += '<p><a class="btn small primary" href="' + esc(r.link.href) + '" target="_blank" rel="noopener">' + esc(r.link.label) + "</a></p>";
    bubble("bot", html);
  }
  bubble("bot", "Hi! Ask me about dishes, prices, what is spicy or popular.");
  h.querySelector("#cform").addEventListener("submit", function (e) {
    e.preventDefault();
    var i = h.querySelector("#cin"), q = i.value.trim();
    if (!q) return;
    i.value = ""; reply(q);
  });
  h.querySelector("#cchips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-q]"); if (b) reply(b.dataset.q);
  });
}

// ---------- games
function dayKey() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function code() { var s = "", a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; for (var i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
function bestKey(ctx, kind) { return "gbest:" + ctx.rid + ":" + kind; }
var CLOSE = '<button class="x" type="button" data-close aria-label="Close">×</button>';
var BACK = '<button class="btn small ghost" type="button" data-gback>Back to games</button>';

// A win shows a screen for the staff to see. One reward per phone per day.
function claimHTML(ctx, what) {
  var reward = what || (ctx.games && ctx.games.reward) || "";
  if (!reward) return "";
  var k = "gclaim:" + ctx.rid, today = dayKey(), prev = lsGet(k), c;
  if (prev && prev.split("|")[0] === today && !what) {
    return '<div class="claim"><p><b>You already claimed today\'s reward.</b> Come back tomorrow to play again for a reward.</p></div>';
  }
  c = code();
  lsSet(k, today + "|" + c);
  var t = new Date();
  return '<div class="claim"><p class="cl1">You won</p><p class="cl2">' + esc(reward) + '</p><p class="cl3">Show this screen to our staff</p><p class="cl4">Code ' + c + " · " + t.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " " + t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) + "</p></div>";
}

export function openGames(ctx) {
  var g = ctx.games || {}, h = ctx.host;
  var list = [];
  if (g.catch) list.push(["catch", "Catch game", "Catch the falling beans and dishes in 30 seconds."]);
  if (g.memory) list.push(["memory", "Memory match", "Find all the matching pairs in as few moves as you can."]);
  if (g.spin && (g.prizes || []).length >= 2) list.push(["spin", "Spin and win", "One spin a day. See what you win."]);
  h.innerHTML = '<div class="hd"><h2 id="dlgT">Play and win</h2>' + CLOSE + "</div>" +
    (g.reward ? '<p class="muted">Play well and win: <b>' + esc(g.reward) + "</b>. One reward per day.</p>" : '<p class="muted">Play while you wait. Just for fun.</p>') +
    '<div class="glist">' + list.map(function (x) { return '<button type="button" class="gcard" data-game="' + x[0] + '"><b>' + x[1] + "</b><span>" + x[2] + "</span></button>"; }).join("") + "</div>";
  h.onclick = function (e) {
    var b = e.target.closest("[data-game]");
    if (b) { var k = b.dataset.game; (k === "catch" ? catchGame : k === "memory" ? memoryGame : spinGame)(ctx); }
    if (e.target.closest("[data-gback]")) openGames(ctx);
  };
}

function alive(ctx, el) { return ctx.dlg.open && el.isConnected; }

function catchGame(ctx) {
  var h = ctx.host, W = 320, H = 400, WIN = 15, TIME = 30;
  var css = getComputedStyle(document.documentElement);
  function col(v, fb) { return (css.getPropertyValue(v) || "").trim() || fb; }
  var cBar = col("--bar", "#8E1409"), cAcc = col("--saffron", "#F4A300"), cBg = col("--surface", "#FFF8EC"), cInk = col("--ink", "#2A160E");
  var best = Number(lsGet(bestKey(ctx, "catch")) || 0);
  var chev = function (d) { return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>'; };
  h.innerHTML = '<div class="hd"><h2 id="dlgT">Catch game</h2>' + CLOSE + "</div>" +
    '<p class="muted">Move the basket by dragging, or use the arrow buttons. Catch the beans, avoid the chillies. ' + (ctx.games.reward ? "Score " + WIN + " or more to win " + esc(ctx.games.reward) + "." : "") + "</p>" +
    '<div class="gstat"><span>Score <b id="gsc">0</b></span><span>Time <b id="gtm">' + TIME + '</b></span><span>Best <b id="gbs">' + best + "</b></span></div>" +
    '<canvas id="gcv" width="' + W + '" height="' + H + '" tabindex="0" aria-label="Catch game. Use the left and right arrow keys to move the basket."></canvas>' +
    '<div class="gbtns"><button type="button" class="btn" id="gl" aria-label="Move left">' + chev("M15 5l-7 7 7 7") + '</button><button type="button" class="btn primary" id="gstart">Start</button><button type="button" class="btn" id="gr" aria-label="Move right">' + chev("M9 5l7 7-7 7") + "</button></div>" +
    '<div id="gres"></div>' + BACK;
  var cv = h.querySelector("#gcv"), cx = cv.getContext("2d"), st = null, raf = 0;
  function drawFrame(s) {
    cx.fillStyle = cBg; cx.fillRect(0, 0, W, H);
    s.things.forEach(function (t) {
      if (t.bad) {
        cx.fillStyle = "#D43A22"; cx.beginPath(); cx.moveTo(t.x - 9, t.y + 9); cx.quadraticCurveTo(t.x, t.y - 12, t.x + 11, t.y - 6); cx.quadraticCurveTo(t.x + 2, t.y + 14, t.x - 9, t.y + 9); cx.fill();
        cx.strokeStyle = "#2E7D45"; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(t.x + 11, t.y - 6); cx.lineTo(t.x + 14, t.y - 11); cx.stroke();
      } else {
        cx.fillStyle = t.dish ? cAcc : "#6B3E26"; cx.beginPath(); cx.ellipse(t.x, t.y, t.dish ? 12 : 8, t.dish ? 12 : 11, 0, 0, 6.2832); cx.fill();
        cx.strokeStyle = t.dish ? cBar : "#C98B4B"; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(t.x - 3, t.y - 8); cx.quadraticCurveTo(t.x + 4, t.y, t.x - 3, t.y + 8); cx.stroke();
      }
    });
    cx.fillStyle = cBar; cx.beginPath(); cx.moveTo(s.x - 38, H - 34); cx.lineTo(s.x + 38, H - 34); cx.lineTo(s.x + 30, H - 6); cx.lineTo(s.x - 30, H - 6); cx.closePath(); cx.fill();
    cx.fillStyle = cAcc; cx.fillRect(s.x - 38, H - 36, 76, 5);
  }
  function setX(s, x) { s.x = Math.max(38, Math.min(W - 38, x)); }
  function start() {
    cancelAnimationFrame(raf);
    st = { x: W / 2, things: [], score: 0, left: TIME, spawn: 0, last: 0, over: false };
    h.querySelector("#gres").innerHTML = ""; h.querySelector("#gstart").disabled = true; cv.focus();
    function frame(now) {
      if (!alive(ctx, cv) || st.over) return;
      if (!st.last) st.last = now;
      var dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
      st.left -= dt; st.spawn -= dt;
      if (st.spawn <= 0) { st.spawn = 0.45 + Math.random() * 0.35; st.things.push({ x: 20 + Math.random() * (W - 40), y: -14, v: 110 + Math.random() * 90 + (TIME - st.left) * 3, bad: Math.random() < 0.26, dish: Math.random() < 0.3 }); }
      st.things.forEach(function (t) { t.y += t.v * dt; });
      st.things = st.things.filter(function (t) {
        if (t.y > H - 40 && t.y < H - 6 && Math.abs(t.x - st.x) < 40) { if (t.bad) st.score = Math.max(0, st.score - 2); else st.score += t.dish ? 2 : 1; return false; }
        return t.y < H + 20;
      });
      h.querySelector("#gsc").textContent = st.score;
      h.querySelector("#gtm").textContent = Math.max(0, Math.ceil(st.left));
      drawFrame(st);
      if (st.left <= 0) return finish();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }
  function finish() {
    st.over = true;
    var sc = st.score, isBest = sc > best;
    if (isBest) { best = sc; lsSet(bestKey(ctx, "catch"), String(sc)); h.querySelector("#gbs").textContent = sc; }
    var html = '<p class="gend"><b>Time up! Score ' + sc + "</b>" + (isBest && sc > 0 ? " (new best)" : "") + "</p>";
    if (ctx.games.reward) html += sc >= WIN ? claimHTML(ctx) : '<p class="muted">Score ' + WIN + " or more to win " + esc(ctx.games.reward) + ". Try again!</p>";
    h.querySelector("#gres").innerHTML = html;
    h.querySelector("#gstart").disabled = false; h.querySelector("#gstart").textContent = "Play again";
  }
  h.querySelector("#gstart").addEventListener("click", start);
  var held = 0;
  function nudge(dx) { if (st && !st.over) setX(st, st.x + dx); }
  h.querySelector("#gl").addEventListener("click", function () { nudge(-34); });
  h.querySelector("#gr").addEventListener("click", function () { nudge(34); });
  cv.addEventListener("pointermove", function (e) { if (!st || st.over) return; var r = cv.getBoundingClientRect(); setX(st, (e.clientX - r.left) * (W / r.width)); });
  cv.addEventListener("pointerdown", function (e) { if (!st || st.over) return; var r = cv.getBoundingClientRect(); setX(st, (e.clientX - r.left) * (W / r.width)); });
  cv.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") { nudge(-30); e.preventDefault(); } if (e.key === "ArrowRight") { nudge(30); e.preventDefault(); } });
  cv.style.touchAction = "none";
  drawFrame({ x: W / 2, things: [] });
}

var SHAPES = [
  ["circle", '<circle cx="20" cy="20" r="13" fill="#D43A22"/>'],
  ["square", '<rect x="8" y="8" width="24" height="24" rx="3" fill="#2E7D45"/>'],
  ["triangle", '<path d="M20 6 L35 33 H5 Z" fill="#E3A21A"/>'],
  ["star", '<path d="M20 4 L24.5 15 L36 16 L27.5 24 L30 35.5 L20 29.5 L10 35.5 L12.5 24 L4 16 L15.5 15 Z" fill="#8E3FB5"/>'],
  ["diamond", '<path d="M20 4 L35 20 L20 36 L5 20 Z" fill="#1F7AC4"/>'],
  ["plus", '<path d="M15 5 H25 V15 H35 V25 H25 V35 H15 V25 H5 V15 H15 Z" fill="#C2185B"/>']
];
function memoryGame(ctx) {
  var h = ctx.host, WINMOVES = 14;
  var best = Number(lsGet(bestKey(ctx, "memory")) || 0);
  var deck = [];
  SHAPES.forEach(function (s, i) { deck.push(i, i); });
  for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
  h.innerHTML = '<div class="hd"><h2 id="dlgT">Memory match</h2>' + CLOSE + "</div>" +
    '<p class="muted">Flip two cards to find a pair. ' + (ctx.games.reward ? "Finish in " + WINMOVES + " moves or fewer to win " + esc(ctx.games.reward) + "." : "") + "</p>" +
    '<div class="gstat"><span>Moves <b id="mv">0</b></span><span>Pairs <b id="pr">0</b> of ' + SHAPES.length + '</span><span>Best <b>' + (best || "-") + "</b></span></div>" +
    '<div class="mgrid" id="mg">' + deck.map(function (d, i) { return '<button type="button" class="mcard" data-i="' + i + '" aria-label="Card ' + (i + 1) + ', face down"></button>'; }).join("") + "</div>" +
    '<div id="gres"></div><div class="gbtns"><button type="button" class="btn" id="mnew">New game</button></div>' + BACK;
  var open = [], moves = 0, pairs = 0, lock = false;
  var grid = h.querySelector("#mg");
  h.querySelector("#mnew").addEventListener("click", function () { memoryGame(ctx); });
  grid.addEventListener("click", function (e) {
    var b = e.target.closest(".mcard");
    if (!b || lock || b.classList.contains("up") || b.classList.contains("done")) return;
    var i = +b.dataset.i, s = SHAPES[deck[i]];
    b.classList.add("up"); b.innerHTML = '<svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">' + s[1] + "</svg>";
    b.setAttribute("aria-label", "Card " + (i + 1) + ", " + s[0]);
    open.push(b);
    if (open.length < 2) return;
    moves++; h.querySelector("#mv").textContent = moves;
    var a = open[0], c = open[1];
    if (deck[+a.dataset.i] === deck[+c.dataset.i]) {
      a.classList.add("done"); c.classList.add("done"); pairs++; open = [];
      h.querySelector("#pr").textContent = pairs;
      if (pairs === SHAPES.length) {
        var isBest = !best || moves < best;
        if (isBest) lsSet(bestKey(ctx, "memory"), String(moves));
        var html = '<p class="gend"><b>All pairs found in ' + moves + " moves!</b>" + (isBest ? " (new best)" : "") + "</p>";
        if (ctx.games.reward) html += moves <= WINMOVES ? claimHTML(ctx) : '<p class="muted">Finish in ' + WINMOVES + " moves or fewer to win " + esc(ctx.games.reward) + ". Try again!</p>";
        h.querySelector("#gres").innerHTML = html;
      }
    } else {
      lock = true;
      setTimeout(function () {
        [a, c].forEach(function (x) { x.classList.remove("up"); x.innerHTML = ""; x.setAttribute("aria-label", "Card " + (+x.dataset.i + 1) + ", face down"); });
        open = []; lock = false;
      }, 750);
    }
  });
}

function spinGame(ctx) {
  var h = ctx.host, prizes = (ctx.games.prizes || []).slice(0, 8), n = prizes.length, seg = 360 / n;
  var used = null;
  try { used = JSON.parse(lsGet("gspin:" + ctx.rid) || "null"); } catch (e) { used = null; }
  if (used && used.day !== dayKey()) used = null;
  var colors = ["#D43A22", "#E3A21A", "#2E7D45", "#1F7AC4", "#8E3FB5", "#C2185B", "#E0701B", "#12807A"];
  function pt(a, r) { var rad = a * Math.PI / 180; return (r * Math.sin(rad)).toFixed(2) + " " + (-r * Math.cos(rad)).toFixed(2); }
  var svg = prizes.map(function (p, i) {
    var a0 = i * seg, a1 = (i + 1) * seg, mid = (a0 + a1) / 2;
    var label = p.length > 13 ? p.slice(0, 12) + "…" : p;
    return '<path d="M0 0 L' + pt(a0, 98) + " A98 98 0 0 1 " + pt(a1, 98) + ' Z" fill="' + colors[i % colors.length] + '" stroke="#fff" stroke-width="1.5"/>' +
      (mid < 180
        ? '<text transform="rotate(' + (mid - 90) + ') translate(88 3)" text-anchor="end"'
        : '<text transform="rotate(' + (mid + 90) + ') translate(-88 3)" text-anchor="start"') +
      ' font-size="9" font-weight="700" fill="#fff" font-family="inherit">' + esc(label) + "</text>";
  }).join("");
  h.innerHTML = '<div class="hd"><h2 id="dlgT">Spin and win</h2>' + CLOSE + "</div>" +
    '<p class="muted">One spin a day on this phone.</p>' +
    '<div class="wheelbox"><div class="ptr" aria-hidden="true"></div><div class="wheel" id="wh"><svg viewBox="-100 -100 200 200" role="img" aria-label="Prize wheel with ' + n + ' prizes: ' + esc(prizes.join(", ")) + '">' + svg + '<circle r="9" fill="#fff"/></svg></div></div>' +
    '<div class="gbtns"><button type="button" class="btn primary" id="sp">Spin</button></div><div id="gres" role="status" aria-live="polite"></div>' + BACK;
  var wh = h.querySelector("#wh"), btn = h.querySelector("#sp");
  function lose(p) { return /try again|better luck|no prize|nothing|sorry|next time/i.test(p); }
  function show(idx, codeText) {
    var p = prizes[idx];
    h.querySelector("#gres").innerHTML = lose(p) ? '<p class="gend"><b>' + esc(p) + "</b></p><p class=\"muted\">Come back tomorrow for another spin.</p>" : codeText;
  }
  if (used) {
    var rot0 = -((used.idx + 0.5) * seg);
    wh.style.transition = "none"; wh.style.transform = "rotate(" + rot0 + "deg)";
    btn.disabled = true;
    h.querySelector("#gres").innerHTML = '<p class="muted">You already spun today.</p>' + (lose(prizes[used.idx]) ? '<p class="gend"><b>' + esc(prizes[used.idx]) + "</b></p>" : used.claim || "");
  }
  btn.addEventListener("click", function () {
    btn.disabled = true;
    var idx = Math.floor(Math.random() * n), rot = 360 * 5 + (360 - (idx + 0.5) * seg);
    wh.style.transition = "transform 4s cubic-bezier(.17,.67,.12,1)";
    wh.style.transform = "rotate(" + rot + "deg)";
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(function () {
      if (!alive(ctx, wh)) { lsSet("gspin:" + ctx.rid, JSON.stringify({ day: dayKey(), idx: idx })); return; }
      var claim = lose(prizes[idx]) ? "" : claimHTML(ctx, prizes[idx]);
      lsSet("gspin:" + ctx.rid, JSON.stringify({ day: dayKey(), idx: idx, claim: claim }));
      show(idx, claim);
    }, reduce ? 300 : 4200);
  });
}
