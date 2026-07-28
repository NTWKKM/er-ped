const fs = require("fs");
const html = fs.readFileSync("design-mockup-v2.html", "utf8");

const checks = [
  ["doctype", html.startsWith("<!doctype html>")],
  ["theme tokens dark and mono", /data-theme=.dark/.test(html) && /data-theme=.mono/.test(html)],
  ["mono strips hue", /--accent:#EAEAE6/.test(html)],
  ["mono danger pure white", /--danger:#FFFFFF/.test(html)],
  ["focus-visible", /:focus-visible/.test(html)],
  ["reduced-motion", /prefers-reduced-motion/.test(html)],
  ["sync ring keyframe", /@keyframes syncRing/.test(html)],
  ["mono sync ring", /@keyframes syncRingMono/.test(html)],
  ["slashed-zero", /slashed-zero/.test(html)],
  ["2-tap confirm", /class=.confirm./.test(html) && /armed/.test(html)],
  ["verify line", /VERIFY:/.test(html)],
  ["sticky result", /sticky-result/.test(html)],
  ["quick-grid 6 drugs", (html.match(/class=.quick./g) || []).length >= 6],
  ["theme cycle JS", /THEMES\s*=\s*\[\s*['"]light/.test(html)],
  ["sync on weight input", /triggerSync/.test(html) && /addEventListener\(.input./.test(html)],
  ["44px touch floor", /min-height:44px/.test(html)],
  ["phase rail", /phase-rail/.test(html)],
  ["ATB table", /table class=.atb./.test(html)],
  ["no Tailwind/Bootstrap", !/tailwind|bootstrap|fontawesome/.test(html)],
  ["no external script src", !/<script src=.https/.test(html)],
];

let p = 0, f = 0;
for (const [n, ok] of checks) {
  console.log((ok ? "PASS  " : "FAIL  ") + n);
  ok ? p++ : f++;
}
console.log("---");
console.log("PASS=" + p + " FAIL=" + f);
process.exit(f > 0 ? 1 : 0);