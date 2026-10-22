// Shared Firebase connection for the public menu (index.html) and the admin panel (admin.html).
// RID is this restaurant's id in the database. It comes from the link (?r=blue-door-cafe); with no ?r= it falls back to the demo cafe.
export const RID = (function () {
  try {
    var r = new URLSearchParams(location.search).get("r") || "";
    r = r.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
    return r || "mandi-co";
  } catch (e) { return "mandi-co"; }
})();

// True when the link names a cafe (?r=...). Without it, a staff login finds the cafe from the email instead.
export const HAS_R = (function () {
  try { return !!new URLSearchParams(location.search).get("r"); } catch (e) { return false; }
})();

export const firebaseConfig = {
  apiKey: "AIzaSyC_SBTNo_MxJr6bd2tyGCkDi27KNgSHvms",
  authDomain: "brandbooststudio-110.firebaseapp.com",
  projectId: "brandbooststudio-110",
  storageBucket: "brandbooststudio-110.firebasestorage.app",
  messagingSenderId: "483990883704",
  appId: "1:483990883704:web:3324f77b85c6d2aca04c8d",
  measurementId: "G-EKY44STRCM"
};

const V = "13.0.0";
const CDN = "https://www.gstatic.com/firebasejs/" + V + "/";

// Loads Firebase only when a page needs it. Pass { auth: true } on pages that log in. Safe to call more than once.
export async function start(opts) {
  const appMod = await import(CDN + "firebase-app.js");
  const fs = await import(CDN + "firebase-firestore.js");
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
  const out = { app: app, fs: fs, db: fs.getFirestore(app), auth: null, authMod: null };
  if (opts && opts.auth) {
    out.authMod = await import(CDN + "firebase-auth.js");
    out.auth = out.authMod.getAuth(app);
  }
  return out;
}

// Staff opened a page with no ?r=. Find the cafe(s) that list their email as owner and open the right one.
export async function routeByEmail(F, email, page) {
  var boot = document.getElementById("boot");
  function say(h) { if (boot) { boot.hidden = false; boot.innerHTML = h; } }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  var out = '<p><button id="rtOut" type="button" style="font:inherit;padding:10px 16px;border-radius:10px;cursor:pointer">Sign out</button></p>';
  function wire() { var b = document.getElementById("rtOut"); if (b) b.onclick = function () { F.authMod.signOut(F.auth).then(function () { location.reload(); }); }; }
  say("Finding your cafe...");
  try {
    var fs = F.fs;
    var snap = await fs.getDocs(fs.query(fs.collection(F.db, "owners"), fs.where("emails", "array-contains", String(email || "").toLowerCase())));
    var ids = snap.docs.map(function (d) { return d.id; });
    if (ids.length === 1) { location.replace(page + "?r=" + encodeURIComponent(ids[0])); return; }
    if (!ids.length) {
      say("<p>This email is not linked to a cafe yet. Ask Brand Boost Studio to add it.</p><p><a href=\"agency.html\">Agency panel</a></p>" + out); wire(); return;
    }
    var names = await Promise.all(ids.map(function (id) {
      return fs.getDoc(fs.doc(F.db, "restaurants", id)).then(function (s) { return s.exists() && s.data().name ? s.data().name : id; }, function () { return id; });
    }));
    say("<p><b>Choose your cafe</b></p>" + ids.map(function (id, i) {
      return '<p><a href="' + page + "?r=" + encodeURIComponent(id) + '" style="font-size:1.1rem">' + esc(names[i]) + "</a></p>";
    }).join("") + out);
    wire();
  } catch (e) { say("<p>Could not find your cafe. Check your internet and refresh.</p>" + out); wire(); }
}
