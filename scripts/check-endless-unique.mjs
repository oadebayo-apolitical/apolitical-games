// Direct reproduction of the reported bug: hit the endless endpoint N times and
// assert no group (its four words) is ever served twice. Start the app first:
//   npm run dev        # in another terminal
//   npm run check:endless 20
const N = Number(process.argv[2] ?? 15);
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const sig = (members) =>
  members.map((m) => m.trim().toUpperCase()).sort().join("|");

const seen = new Map(); // sig -> first name seen
let repeats = 0;

for (let i = 0; i < N; i++) {
  const res = await fetch(`${BASE}/api/puzzle?mode=endless`, { cache: "no-store" });
  if (!res.ok) {
    console.error(`request ${i + 1} failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const { puzzle, source } = await res.json();
  for (const g of puzzle) {
    const s = sig(g.members);
    if (seen.has(s)) {
      repeats++;
      console.log(`  REPEAT on play ${i + 1}: "${g.name}" == earlier "${seen.get(s)}"`);
    } else {
      seen.set(s, g.name);
    }
  }
  console.log(`play ${i + 1}/${N} source=${source} uniqueGroups=${seen.size}`);
}

if (repeats === 0) {
  console.log(`\nPASS: ${seen.size} unique groups across ${N} plays, zero repeats.`);
  process.exit(0);
}
console.log(`\nFAIL: ${repeats} repeated group(s).`);
process.exit(1);
