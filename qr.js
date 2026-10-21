// QR code maker (no outside libraries). Byte mode, versions 1 to 20, error correction L, M, Q or H.
// makeQR(text, "H") gives { size, dark(x, y) }. drawQR paints it on a canvas, with an optional logo in the middle.

var ECC_CW = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28]
};
var NUM_BLK = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25]
};
var FMT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
var MAX_VER = 20;

function rawModules(ver) {
  var r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    var na = Math.floor(ver / 7) + 2;
    r -= (25 * na - 10) * na - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
function dataCodewords(ver, ecl) { return Math.floor(rawModules(ver) / 8) - ECC_CW[ecl][ver] * NUM_BLK[ecl][ver]; }

function gfMul(x, y) {
  var z = 0;
  for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
  return z;
}
function rsDivisor(degree) {
  var res = []; for (var i = 0; i < degree; i++) res.push(0);
  res[degree - 1] = 1;
  var root = 1;
  for (var k = 0; k < degree; k++) {
    for (var j = 0; j < degree; j++) { res[j] = gfMul(res[j], root); if (j + 1 < degree) res[j] ^= res[j + 1]; }
    root = gfMul(root, 2);
  }
  return res;
}
function rsRemainder(data, div) {
  var res = div.map(function () { return 0; });
  data.forEach(function (b) {
    var f = b ^ res.shift();
    res.push(0);
    div.forEach(function (c, i) { res[i] ^= gfMul(c, f); });
  });
  return res;
}

function utf8(text) {
  var s = unescape(encodeURIComponent(text)), out = [];
  for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  return out;
}

export function makeQR(text, ecl) {
  ecl = ecl || "M";
  var bytes = utf8(text), ver, bitsNeeded;
  for (ver = 1; ver <= MAX_VER; ver++) {
    bitsNeeded = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
    if (bitsNeeded <= dataCodewords(ver, ecl) * 8) break;
  }
  if (ver > MAX_VER) throw new Error("Text is too long for a QR code");

  // bits
  var bits = [];
  function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach(function (b) { put(b, 8); });
  var cap = dataCodewords(ver, ecl) * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
  var data = [];
  for (var i = 0; i < bits.length; i += 8) {
    var v = 0; for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    data.push(v);
  }

  // error correction and interleave
  var nb = NUM_BLK[ecl][ver], eccLen = ECC_CW[ecl][ver], raw = Math.floor(rawModules(ver) / 8);
  var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
  var blocks = [], div = rsDivisor(eccLen);
  for (var b = 0, k = 0; b < nb; b++) {
    var dl = shortLen - eccLen + (b < nShort ? 0 : 1);
    var dat = data.slice(k, k + dl); k += dl;
    var ecc = rsRemainder(dat, div);
    if (b < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  var all = [];
  for (var x = 0; x < blocks[0].length; x++) {
    blocks.forEach(function (blk, bi) { if (x !== shortLen - eccLen || bi >= nShort) all.push(blk[x]); });
  }

  // grid
  var size = ver * 4 + 17, mod = [], fn = [];
  for (var r = 0; r < size; r++) { mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
  function setFn(px, py, dark) { mod[py][px] = dark; fn[py][px] = true; }
  function bit(n, i) { return ((n >>> i) & 1) !== 0; }
  for (var t = 0; t < size; t++) { setFn(6, t, t % 2 === 0); setFn(t, 6, t % 2 === 0); }
  function finder(cx, cy) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
      if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, dist !== 2 && dist !== 4);
    }
  }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  var pos = [];
  if (ver > 1) {
    var na = Math.floor(ver / 7) + 2;
    var step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    pos = [6];
    for (var p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
  }
  pos.forEach(function (ay, i) {
    pos.forEach(function (ax, j) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    });
  });
  function formatBits(mask) {
    var d = FMT_BITS[ecl] << 3 | mask, rem = d;
    for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var f = (d << 10 | rem) ^ 0x5412;
    for (var a = 0; a <= 5; a++) setFn(8, a, bit(f, a));
    setFn(8, 7, bit(f, 6)); setFn(8, 8, bit(f, 7)); setFn(7, 8, bit(f, 8));
    for (var c = 9; c < 15; c++) setFn(14 - c, 8, bit(f, c));
    for (var e = 0; e < 8; e++) setFn(size - 1 - e, 8, bit(f, e));
    for (var g = 8; g < 15; g++) setFn(8, size - 15 + g, bit(f, g));
    setFn(8, size - 8, true);
  }
  formatBits(0);
  if (ver >= 7) {
    var rem = ver;
    for (var q2 = 0; q2 < 12; q2++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var vb = ver << 12 | rem;
    for (var vi = 0; vi < 18; vi++) { var a2 = size - 11 + vi % 3, b2 = Math.floor(vi / 3); setFn(a2, b2, bit(vb, vi)); setFn(b2, a2, bit(vb, vi)); }
  }
  // place codewords
  var n = 0;
  for (var right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (var vert = 0; vert < size; vert++) for (var jj = 0; jj < 2; jj++) {
      var px = right - jj, up = ((right + 1) & 2) === 0, py = up ? size - 1 - vert : vert;
      if (!fn[py][px] && n < all.length * 8) { mod[py][px] = bit(all[n >>> 3], 7 - (n & 7)); n++; }
    }
  }
  function applyMask(m) {
    for (var y = 0; y < size; y++) for (var xx = 0; xx < size; xx++) {
      var inv;
      switch (m) {
        case 0: inv = (xx + y) % 2 === 0; break;
        case 1: inv = y % 2 === 0; break;
        case 2: inv = xx % 3 === 0; break;
        case 3: inv = (xx + y) % 3 === 0; break;
        case 4: inv = (Math.floor(xx / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: inv = xx * y % 2 + xx * y % 3 === 0; break;
        case 6: inv = (xx * y % 2 + xx * y % 3) % 2 === 0; break;
        default: inv = ((xx + y) % 2 + xx * y % 3) % 2 === 0;
      }
      if (!fn[y][xx] && inv) mod[y][xx] = !mod[y][xx];
    }
  }
  function penalty() {
    var score = 0, y, xx, i, run, line;
    function lineScore(get) {
      var s = 0, r = 1, str = "";
      for (var i2 = 0; i2 < size; i2++) {
        str += get(i2) ? "1" : "0";
        if (i2 > 0 && get(i2) === get(i2 - 1)) { r++; if (r === 5) s += 3; else if (r > 5) s++; } else r = 1;
      }
      var k2 = 0, idx;
      var pats = ["000010111010", "010111010000"];
      pats.forEach(function (pt) { idx = -1; while ((idx = str.indexOf(pt, idx + 1)) >= 0) s += 40; });
      return s;
    }
    for (y = 0; y < size; y++) score += lineScore(function (i3) { return mod[y][i3]; });
    for (xx = 0; xx < size; xx++) score += lineScore(function (i4) { return mod[i4][xx]; });
    for (y = 0; y < size - 1; y++) for (xx = 0; xx < size - 1; xx++) {
      var c0 = mod[y][xx];
      if (c0 === mod[y][xx + 1] && c0 === mod[y + 1][xx] && c0 === mod[y + 1][xx + 1]) score += 3;
    }
    var dark = 0;
    mod.forEach(function (row) { row.forEach(function (v) { if (v) dark++; }); });
    var total = size * size;
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return score;
  }
  var best = 0, bestScore = Infinity;
  for (var m = 0; m < 8; m++) {
    applyMask(m); formatBits(m);
    var sc = penalty();
    if (sc < bestScore) { bestScore = sc; best = m; }
    applyMask(m);
  }
  applyMask(best); formatBits(best);
  return { size: size, version: ver, dark: function (px2, py2) { return mod[py2][px2]; } };
}

// Paints the code on a canvas. opts: size (pixels), quiet (white border in modules), logo (an loaded image), dark, light.
export function drawQR(canvas, text, opts) {
  opts = opts || {};
  var q = makeQR(text, opts.logo ? "H" : (opts.ecl || "M"));
  var quiet = opts.quiet == null ? 4 : opts.quiet;
  var cell = Math.max(2, Math.floor((opts.size || 480) / (q.size + 2 * quiet)));
  var side = cell * (q.size + 2 * quiet);
  canvas.width = canvas.height = side;
  var g = canvas.getContext("2d");
  g.fillStyle = opts.light || "#FFFFFF"; g.fillRect(0, 0, side, side);
  g.fillStyle = opts.dark || "#111111";
  for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) {
    if (q.dark(x, y)) g.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
  }
  if (opts.logo && opts.logo.width) {
    var plate = Math.round(side * 0.2), ring = Math.round(plate * 0.08), at = Math.round((side - plate) / 2);
    g.fillStyle = "#FFFFFF";
    roundRect(g, at, at, plate, plate, plate * 0.2); g.fill();
    var inner = plate - ring * 2, k = Math.min(inner / opts.logo.width, inner / opts.logo.height);
    var lw = opts.logo.width * k, lh = opts.logo.height * k;
    g.drawImage(opts.logo, at + ring + (inner - lw) / 2, at + ring + (inner - lh) / 2, lw, lh);
  }
  return q;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
