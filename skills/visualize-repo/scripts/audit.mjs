#!/usr/bin/env node
/**
 * Audit a rendered architecture map for the defects that are invisible until someone
 * opens it on a real device: text spilling out of cards, edges cutting
 * through boxes, labels landing on top of cards, and runtime errors.
 *
 * These are exactly the failures that survive a "looks fine to me" glance at
 * a screenshot, which is why this exists as a script rather than a checklist.
 *
 *   node audit.mjs <architecture.html> [--viewport 1440x900] [--shots <dir>]
 *
 * Exits non-zero if anything fails, so it can gate a publish.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

// Playwright is often only installed globally, and ESM imports ignore
// NODE_PATH — so resolve it explicitly rather than failing at import time.
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  try {
    const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    ({ chromium } = require(join(globalRoot, "playwright")));
  } catch {
    console.error("playwright not found. Install it with:  npm i -g playwright");
    process.exit(2);
  }
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: node audit.mjs <architecture.html> [--viewport WxH] [--shots <dir>]");
  process.exit(2);
}
const vpArg = (args.includes("--viewport")
  ? args[args.indexOf("--viewport") + 1]
  : "1440x900").split("x");
const VP = { width: parseInt(vpArg[0], 10), height: parseInt(vpArg[1], 10) };
if (!VP.width || !VP.height) {
  console.error(`bad --viewport value; expected WxH like 1440x900`);
  process.exit(2);
}
const shotsDir = args.includes("--shots") ? args[args.indexOf("--shots") + 1] : null;
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

// Artifacts are published as a body fragment; the host wraps them in a real
// document. Wrap it the same way here or every measurement is taken against
// a page with no viewport meta and the numbers mean nothing.
const raw = readFileSync(resolve(file), "utf8");
const wrapped = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head><body>\n${raw}\n</body></html>`;
const tmp = join(tmpdir(), `arch-audit-${Date.now()}.html`);
writeFileSync(tmp, wrapped);

const MEASURE = () => {
  const cards = [...document.querySelectorAll("#content .node-card")].map((g) => {
    const s = g.querySelector("rect.card");
    const b = s.getBBox();
    return { id: g.getAttribute("data-node-id"), x: b.x, y: b.y, w: b.width, h: b.height };
  });
  const ov = (x0, y0, x1, y1, c) => x1 > c.x && x0 < c.x + c.w && y1 > c.y && y0 < c.y + c.h;

  const textOverflow = [];
  document.querySelectorAll("#content .node-card").forEach((g) => {
    const id = g.getAttribute("data-node-id");
    const s = g.querySelector("rect.card");
    const sb = s.getBBox();
    g.querySelectorAll("text.card-text").forEach((t) => {
      const tb = t.getBBox();
      const overBottom = tb.y + tb.height - (sb.y + sb.height);
      const overRight = tb.x + tb.width - (sb.x + sb.width);
      if (overBottom > -2 || overRight > -2) {
        textOverflow.push({
          node: id, text: t.textContent.slice(0, 40),
          overBottom: Math.round(overBottom), overRight: Math.round(overRight)
        });
      }
    });
  });

  const edgeThroughCard = [], labelOnCard = [], nonOrthogonal = [];
  document.querySelectorAll("#content .edge").forEach((g) => {
    const from = g.getAttribute("data-from"), to = g.getAttribute("data-to");
    const line = g.querySelector("polyline");
    if (!line) return;
    const pts = line.getAttribute("points").trim().split(/\s+/).map((p) => {
      const [x, y] = p.split(","); return { x: +x, y: +y };
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      if (Math.abs(p.x - q.x) > 0.01 && Math.abs(p.y - q.y) > 0.01) {
        nonOrthogonal.push({ from, to, seg: i });
      }
      const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x);
      const y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
      cards.forEach((c) => {
        if (c.id !== from && c.id !== to && ov(x0, y0, x1, y1, c)) {
          edgeThroughCard.push({ from, to, through: c.id });
        }
      });
    }
    const tag = g.querySelector("rect.edge-tag-bg");
    if (tag) {
      const b = tag.getBBox();
      cards.forEach((c) => {
        if (ov(b.x, b.y, b.x + b.width, b.y + b.height, c)) {
          labelOnCard.push({ from, to, over: c.id });
        }
      });
    }
  });

  // A route re-entering the very cards it connects. The check above cannot see
  // this: it skips the edge's own endpoints, so a route that leaves a card and
  // doubles straight back through it was being certified as clean.
  const reentersOwnCard = [];
  document.querySelectorAll("#content .edge").forEach((g) => {
    const line = g.querySelector("polyline");
    if (!line) return;
    const from = g.getAttribute("data-from"), to = g.getAttribute("data-to");
    const pts = line.getAttribute("points").trim().split(/\s+/).map((p) => {
      const [x, y] = p.split(","); return { x: +x, y: +y };
    });
    [from, to].forEach((id) => {
      const c = cards.find((k) => k.id === id);
      if (!c) return;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x);
        const y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
        if (x1 > c.x + 1 && x0 < c.x + c.w - 1 && y1 > c.y + 1 && y0 < c.y + c.h - 1) {
          reentersOwnCard.push({ edge: `${from}->${to}`, through: id, seg: i });
          return;
        }
      }
    });
  });

  const orphanEdges = [];
  document.querySelectorAll("#content .edge").forEach((g) => {
    const ids = cards.map((c) => c.id);
    ["data-from", "data-to"].forEach((a) => {
      const v = g.getAttribute(a);
      if (v && !ids.includes(v)) orphanEdges.push({ attr: a, id: v });
    });
  });

  // Lines are allowed to pass *behind* a tag — the tag is opaque, so it stays
  // readable. What is not allowed is a line painted *over* a tag, which reads
  // as struck-through text. SVG has no z-index, so the invariant is document
  // order: every tag must come after every line.
  const all = [...document.querySelectorAll("#content polyline.edge-line, #content rect.edge-tag-bg")];
  const lastLine = all.map((e) => e.tagName).lastIndexOf("polyline");
  const firstTag = all.findIndex((e) => e.classList.contains("edge-tag-bg"));
  const labelsPaintedOver = (firstTag !== -1 && lastLine > firstTag)
    ? [{ note: "an edge line is painted after an edge label" }] : [];

  // Whether a card sits inside a system boundary is pure coordinate
  // coincidence, but it changes what the diagram asserts — a config store
  // that drifts inside the package frame claims it ships with the package.
  // When the level declares `boundary.contains`, hold the drawing to it.
  const boundaryMismatch = [];
  const braw = document.getElementById("content").getAttribute("data-boundary");
  if (braw) {
    const bnd = JSON.parse(braw);
    if (bnd.contains) {
      const declared = new Set(bnd.contains);
      cards.forEach((c) => {
        const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
        const inside = cx > bnd.x && cx < bnd.x + bnd.w && cy > bnd.y && cy < bnd.y + bnd.h;
        if (inside && !declared.has(c.id)) {
          boundaryMismatch.push({ node: c.id, problem: "drawn inside the boundary but not declared in contains" });
        } else if (!inside && declared.has(c.id)) {
          boundaryMismatch.push({ node: c.id, problem: "declared in contains but drawn outside the boundary" });
        }
      });
    }
  }

  return {
    cardCount: cards.length,
    edgeCount: document.querySelectorAll("#content polyline.edge-line").length,
    textOverflow, edgeThroughCard, labelOnCard, nonOrthogonal, orphanEdges,
    labelsPaintedOver, boundaryMismatch, reentersOwnCard
  };
};

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined
});
const page = await browser.newPage({ viewport: VP, deviceScaleFactor: 1 });
const runtimeErrors = [];
page.on("pageerror", (e) => runtimeErrors.push(String(e.message)));
page.on("console", (m) => { if (m.type() === "error") runtimeErrors.push(m.text()); });

await page.goto("file://" + tmp);
await page.waitForTimeout(500);

// Walk every reachable level by following drill affordances.
const levels = [];
const visited = new Set();
async function snapshot(name) {
  const m = await page.evaluate(MEASURE);
  levels.push({ level: name, ...m });
  if (shotsDir) {
    await page.screenshot({ path: join(shotsDir, `${name.replace(/[^\w-]/g, "_")}.png`) });
  }
}
async function crumbs() {
  return page.$$eval(".crumb", (els) => els.map((e) => e.textContent));
}

await snapshot((await crumbs()).slice(-1)[0] || "root");
visited.add((await crumbs()).slice(-1)[0]);

// Depth-first: open each drillable card, measure, come back up.
let guard = 0;
while (guard++ < 24) {
  const drillable = await page.$$eval("[data-node-id]", (gs) =>
    gs.filter((g) => [...g.querySelectorAll("text")].some((t) => t.textContent === "›"))
      .map((g) => g.getAttribute("data-node-id"))
  );
  const next = [];
  for (const id of drillable) if (!visited.has("drill:" + id)) next.push(id);
  if (!next.length) {
    const cr = await crumbs();
    if (cr.length <= 1) break;
    await (await page.$$(".crumb"))[cr.length - 2].click();
    await page.waitForTimeout(900);
    continue;
  }
  const id = next[0];
  visited.add("drill:" + id);
  await page.click(`[data-node-id="${id}"]`);
  await page.waitForTimeout(1000);
  const name = (await crumbs()).slice(-1)[0] || id;
  if (!visited.has(name)) { visited.add(name); await snapshot(name); }
}

await page.close();

// ---- interaction pass: real touch ----
// Geometry checks cannot see this class of bug. A touch tap fires a synthetic
// click afterwards that is hit-tested fresh, so a panel opened by the tap can
// receive that click and dismiss itself instantly — while mouse input, whose
// click target comes from the pointerdown/up elements, works perfectly. Any
// audit that only drives a mouse will certify a page that is broken on phones.
const touchFailures = [];
try {
  const tp = await browser.newPage({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2
  });
  tp.on("pageerror", (e) => runtimeErrors.push("touch: " + e.message));
  await tp.goto("file://" + tmp);
  await tp.waitForTimeout(500);

  const onScreen = async (sel) => {
    for (const h of await tp.$$("#content " + sel)) {
      const b = await h.boundingBox();
      if (!b) continue;
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      if (cx > 8 && cx < 382 && cy > 8 && cy < 836) return { cx, cy };
    }
    return null;
  };

  const dot = await onScreen("[data-info-id]");
  if (!dot) {
    touchFailures.push("no info affordance reachable on a 390x844 screen at the default view");
  } else {
    await tp.touchscreen.tap(dot.cx, dot.cy);
    await tp.waitForTimeout(800); // long enough for a ghost click to land
    const open = await tp.evaluate(() => {
      const s = document.querySelector("#detailSheet, .sheet");
      return !!(s && s.classList.contains("open"));
    });
    if (!open) {
      touchFailures.push("tapping the info affordance did not leave a panel open (ghost-click dismissal?)");
    } else {
      await tp.touchscreen.tap(195, 70);
      await tp.waitForTimeout(600);
      const stillOpen = await tp.evaluate(() => {
        const s = document.querySelector("#detailSheet, .sheet");
        return !!(s && s.classList.contains("open"));
      });
      if (stillOpen) touchFailures.push("tapping outside the panel did not dismiss it");
    }
  }
  await tp.close();
} catch (e) {
  touchFailures.push("touch pass errored: " + e.message);
}

await browser.close();

// ---- report ----
let failures = 0;
const bad = (n) => { failures += n; return n ? "FAIL" : "ok  "; };
console.log(`\narchitecture audit — ${file} @ ${VP.width}x${VP.height}\n`);
for (const L of levels) {
  console.log(`  ${L.level}  (${L.cardCount} cards, ${L.edgeCount} edges)`);
  console.log(`    ${bad(L.textOverflow.length)} text inside cards        ${L.textOverflow.length || ""}`);
  console.log(`    ${bad(L.edgeThroughCard.length)} edges clear of cards     ${L.edgeThroughCard.length || ""}`);
  console.log(`    ${bad(L.labelOnCard.length)} labels clear of cards    ${L.labelOnCard.length || ""}`);
  console.log(`    ${bad(L.nonOrthogonal.length)} edges orthogonal         ${L.nonOrthogonal.length || ""}`);
  console.log(`    ${bad(L.orphanEdges.length)} edges reference real ids ${L.orphanEdges.length || ""}`);
  console.log(`    ${bad(L.labelsPaintedOver.length)} labels above the lines   ${L.labelsPaintedOver.length || ""}`);
  console.log(`    ${bad(L.boundaryMismatch.length)} boundary membership     ${L.boundaryMismatch.length || ""}`);
  console.log(`    ${bad(L.reentersOwnCard.length)} routes clear of own cards ${L.reentersOwnCard.length || ""}`);
  for (const t of L.textOverflow) console.log(`        overflow: ${t.node} "${t.text}" (+${t.overBottom}px)`);
  for (const e of L.edgeThroughCard) console.log(`        route ${e.from}->${e.to} cuts ${e.through}`);
  for (const e of L.labelOnCard) console.log(`        label ${e.from}->${e.to} sits on ${e.over}`);
  for (const e of L.boundaryMismatch) console.log(`        ${e.node}: ${e.problem}`);
  for (const e of L.reentersOwnCard) console.log(`        route ${e.edge} re-enters ${e.through}`);
}
console.log(`\n  ${bad(touchFailures.length)} touch interaction (real touch events)`);
for (const t of touchFailures) console.log(`        ${t}`);
console.log(`  ${bad(runtimeErrors.length)} no runtime errors`);
for (const e of runtimeErrors.slice(0, 8)) console.log(`        ${e}`);

// Self-containment: a published artifact cannot reach any external host.
const external = [...raw.matchAll(/(?:src|href)\s*=\s*["'](https?:)?\/\/[^"']+/gi)].map((m) => m[0]);
console.log(`  ${bad(external.length)} self-contained (no external refs)`);
for (const u of external.slice(0, 5)) console.log(`        ${u.slice(0, 90)}`);

console.log(failures ? `\n${failures} problem(s) found.\n` : "\nAll checks passed.\n");
process.exit(failures ? 1 : 0);
