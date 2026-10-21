// Shared Firebase connection for the public menu (index.html) and the admin panel (admin.html).
// RID is this restaurant's id in the database. It comes from the link (?r=blue-door-cafe); with no ?r= it falls back to the demo cafe.
export const RID = (function () {
  try {
    var r = new URLSearchParams(location.search).get("r") || "";
    r = r.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
    return r || "mandi-co";
  } catch (e) { return "mandi-co"; }
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
