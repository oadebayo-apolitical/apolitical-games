// End-to-end check for Who's Who: hit /api/personality N times and assert
// (1) every round has a working photo, and (2) no person repeats.
// Start the app first:  npm run dev   (in another terminal)
//   npm run check:whoswho 20
const N = Number(process.argv[2] ?? 15);
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const UA = "british-connections/1.0 (whos-who check)";

const norm = (s) => s.trim().toLowerCase();
const seen = new Set();
let repeats = 0;
let noImage = 0;
let imgBroken = 0;

async function imageLoads(url) {
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow", headers: { "User-Agent": UA } });
    return r.ok && (r.headers.get("content-type") || "").startsWith("image/");
  } catch {
    return false;
  }
}

for (let i = 0; i < N; i++) {
  const res = await fetch(`${BASE}/api/personality`, { cache: "no-store" });
  if (!res.ok) {
    console.error(`request ${i + 1} failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const round = await res.json();
  const key = norm(round.name);
  if (seen.has(key)) {
    repeats++;
    console.log(`  REPEAT on play ${i + 1}: ${round.name}`);
  } else {
    seen.add(key);
  }

  let imgStatus = "none";
  if (round.image?.url) {
    const ok = await imageLoads(round.image.url);
    imgStatus = ok ? "ok" : "BROKEN";
    if (!ok) imgBroken++;
  } else if (round.source !== "fallback") {
    noImage++;
  }
  console.log(
    `play ${i + 1}/${N} source=${round.source} img=${imgStatus} :: ${round.name}`
  );
}

const ok = repeats === 0 && imgBroken === 0;
console.log(
  `\n${ok ? "PASS" : "FAIL"}: ${seen.size} unique people, ${repeats} repeats, ${imgBroken} broken images, ${noImage} missing (non-fallback).`
);
process.exit(ok ? 0 : 1);
