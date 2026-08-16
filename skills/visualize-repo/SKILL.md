---
name: visualize-repo
description: Map a codebase as an interactive C4 architecture diagram — a single self-contained HTML page with zoomable context, container and component layers, touch-first with a desktop tier. Use this whenever someone wants to understand, document, onboard onto, or visualize the architecture of a repository — "map out this repo", "C4 diagram", "architecture diagram", "how does this codebase fit together", "diagram the services", "onboarding doc for the codebase", "what talks to what", "system context diagram", or when a new engineer needs to see the shape of a system before reading its code. Reach for this even when the person doesn't say "C4" — if they want a picture of how a repo is structured, this is the skill.
---

# Visualize a repo as an interactive C4 architecture map

You are turning a codebase into a diagram someone can actually navigate: three
zoom levels of the [C4 model](https://c4model.com) — system context, containers,
components — rendered as one self-contained HTML page with no build step and no
network dependencies.

The hard part is **not** the rendering. A finished renderer ships with this skill
(`assets/architecture-template.html`) and it already handles routing, gestures,
responsive layout, theming, and accessibility. Your work is the two things a
template can't do: **reading the repo accurately**, and **laying out the boxes so
the diagram is legible**.

## The pipeline

1. Survey the repo and decide what the layers actually are
2. Write the model into a copy of the template
3. Run the audit script, fix what it reports, repeat until clean
4. Publish and hand over the link

## 1. Survey the repo

Read before you draw. A diagram that is merely plausible is worse than no
diagram, because it gets believed. Ground every box in something you actually
read.

Go after these, in roughly this order:

- **Entry points** — `main`, CLI definitions, `bin`/`scripts` in package
  manifests, `__main__`, server bootstraps, `Dockerfile` `CMD`, serverless
  handlers. These become **containers**: the things you can independently run.
- **Manifests and config** — `package.json`, `pyproject.toml`, `go.mod`,
  `Cargo.toml`, `docker-compose.yml`, k8s manifests, CI workflows. Dependencies
  on hosted services (databases, queues, vendor SDKs) become **external systems**.
- **The README and any docs/ tree** — usually states the purpose and the intended
  audience better than you'd infer. Good source for the Context layer.
- **Directory structure inside each container** — top-level packages or modules
  become **components**.
- **Data on disk** — directories of `.parquet`/`.h5ad`/`.sqlite`, migration
  folders, manifest CSVs. These are **stores**, and they're the part people most
  often leave out and most often need.

Prefer running an agent or a few parallel searches for this rather than opening
files one at a time — you want breadth first, then depth on whatever looks load-bearing.

**Say what you couldn't verify.** If you inferred a relationship from a name
rather than from code, either confirm it or leave it out. Tell the user which
parts are inferred when you hand over.

## 2. Choose the layers

The single most common failure is drawing a folder tree and calling it C4. The
levels are about *audience and altitude*, not nesting depth:

| Level | Answers | Boxes are |
|---|---|---|
| **Context** | Who uses this and what does it depend on? | People, the system as one box, third-party systems |
| **Containers** | What would I have to run or deploy? | Apps, services, CLIs, libraries, databases, file stores |
| **Components** | What's inside this one container? | Packages / modules / directories |

Guidance that holds up in practice:

- **Context has exactly one box for your system.** If you're tempted to draw two,
  you have two systems, or you're already at the container level.
- **A container is something you can start, deploy, or import** — not every
  folder. A CLI, a web app, a background worker, a shared library, a database.
  If you can't say what it would mean to run it, it's a component.
- **Only give a component level to containers that earn one.** Two or three is
  usually right. A container with four files does not need its own layer; link it
  and move on.
- **6–12 boxes per level.** Past that, the level is doing two jobs — split it or
  raise the altitude. The floor is soft in the other direction: a three-box level
  is fine when the split *is* the point, and better than burying an important
  architectural seam in one box's description.
- **Label edges with the verb.** `reads / writes`, `invokes`, `polls every 30s`,
  `HTTP :9823/mcp`. An edge labelled `uses` carries no information.
- **Keep edge labels ≤ 13 characters.** At 14+ the label wraps to two lines,
  which doubles its height and makes it much harder to place in the gap between
  two cards — the commonest cause of a label ending up somewhere awkward. Shorten
  the label before you move the boxes.

**Record what you inferred, in the model.** If you deduced a relationship from a
name rather than from code, say so in that node's or edge's `desc` — "inferred
from the import graph; not confirmed against a running system." A caveat you only
say in chat is gone the moment someone shares the link, and the `desc` is what
travels with the diagram.

## 3. Write the model

Copy `assets/architecture-template.html` to the file you intend to deliver — `docs/
architecture.html` in the repo if it's going to live there, otherwise your
scratch directory. Then edit **only** the block marked `EDIT THIS BLOCK ONLY` at
the top of the `<script>`; everything below it is generic machinery. Replace the
`__PAGE_TITLE__` and `__PROJECT_NAME__` placeholders as well.

If you find yourself wanting to change the machinery, you almost certainly want a
different model instead. The one legitimate exception is restyling: the CSS custom
properties at the top of the file.

Each node carries a `desc` that shows in the detail panel. Write these for a
newcomer: what this is, why it exists, what surprises them. Two to four sentences.
The `files` array should list real paths, because the reader's next move after
reading about a box is opening it.

### Laying out coordinates

This is the real work, and it's the part that takes the most iterations if you
approach it as free-form placement. **Read `references/layout.md` before you place
the first box** — it has the grid recipe, the card-height arithmetic, and the text
wrap thresholds, which together let you get the layout right by construction
instead of by repeated audit runs.

The short version:

- **Put everything on a column/row grid.** Pick a column pitch and a row pitch,
  snap every box to it. Gutters between columns and rows are the router's entire
  budget — it can only turn corners in empty strips.
- **Gutters ≥ 160px between columns, ≥ 120px between rows.** An edge that has to
  cross the diagram needs a gutter that runs the whole way.
- **Canvas size is free.** `W`/`H` are fitted to the viewport, so growing the
  canvas to open a gutter costs nothing. Grow it rather than squeezing boxes.
- **Card height must fit the text**, and the arithmetic is in `references/layout.md`
  — use it rather than guessing and re-running the audit.

If a level declares a `boundary`, list the ids that belong inside it in
`boundary.contains`. Whether a card sits inside the dashed frame is otherwise pure
coordinate coincidence, and it changes what the diagram claims — a config store
that drifts inside a package frame asserts that it ships with the package. With
`contains` declared, the audit holds the drawing to your intent.

## 4. Audit, then fix, then re-audit

Run this from the skill directory (the path below is relative to it):

```bash
node scripts/audit.mjs path/to/architecture.html                  # desktop
node scripts/audit.mjs path/to/architecture.html --viewport 390x844   # phone
node scripts/audit.mjs path/to/architecture.html --shots ./shots       # + screenshots
```

**Audit at both viewports.** The two form factors use different view models, and
a layout can pass one and fail the other. `--shots` writes one PNG per level; look
at them too, because the audit checks geometry, not whether the diagram makes sense.

Requires Playwright (`npm i -g playwright`). Set `PLAYWRIGHT_CHROMIUM_PATH` if
Chromium lives somewhere non-standard. The script wraps your file in a full HTML
document before measuring, which is why the architecture map must stay a body fragment with
no `<html>`/`<body>` tags of its own.

It opens the page, walks every level by following the drill affordances, and
checks what a screenshot glance reliably misses: text overflowing its card, routes
cutting through cards they don't connect, labels sitting on cards, non-orthogonal
segments, edges referencing node ids that don't exist, labels painted over by
lines, cards that drift across a declared boundary, runtime errors, and external
refs that would break a published page. It then runs an **interaction pass with
real touch events** on a phone-sized viewport. It exits non-zero when anything fails.

That last pass matters more than it sounds. **Driving the page with a mouse does
not test touch.** A touch tap fires a synthetic `click` afterwards that is
hit-tested fresh against whatever is on screen by then — so a panel opened by the
tap sits under the finger and receives that click itself, dismissing instantly.
Mouse input never reproduces it, because its click target is derived from the
pointerdown/up elements rather than a new hit test. This shipped once here: every
mouse-driven check passed while the info button was dead on every real phone. If
you add any tap-driven UI of your own, drive it with `page.touchscreen.tap()`, not
`page.mouse`.

**Trust it over your eyes.** Every check exists because that defect shipped past a
visual review at least once. How to fix each failure:

| Failure | What it means | Fix |
|---|---|---|
| **text inside cards** | The text is taller than the card | Make the card taller or wider — see the arithmetic in `references/layout.md`. Don't trim a sentence that was doing work. |
| **edges clear of cards** | A third card sits in the route's path | This is *not* about the gap between the two endpoints. Either open a routing gutter (an empty column/row the route can use), move an endpoint so the edge stops crossing the grid diagonally, or **change the edge** — if a shorter, equally-true relationship exists, model that one instead. Retargeting a marginal edge is a legitimate fix, not a cop-out. |
| **labels clear of cards** | The tag is wider than the gap it must sit in | Shorten the label to ≤13 chars first; move the boxes apart only if that isn't enough. |
| **boundary membership** | A card drifted in or out of the dashed frame | Move the card, or correct `boundary.contains`. Decide which one is actually true. |
| **edges reference real ids** | Typo in `from`/`to` | Fix the id. |

## 5. Hand it over

The architecture map is a single self-contained HTML file, so it works three ways — pick by
what the user asked for, and don't assume:

- **Publish as an artifact** when they want a link to share or open on a phone.
  This is the usual default for "show me" requests.
- **Leave it as a file** when they asked for a file, said not to publish, or are
  working somewhere without publishing. Say where you put it and how to open it
  (any browser, no server needed).
- **Commit it to the repo** — `docs/` is the natural home — when it's meant to be
  living documentation. Offer this; don't commit unasked.

Either way, tell them:

- what each level contains
- anything you inferred rather than verified (and confirm it's written into the
  relevant `desc`, not just said here)
- anything you deliberately left out, and why

## What the template already does

Don't rebuild any of this, and don't remove it:

- **Touch-first navigation, single-finger throughout.** Drag pans; tap opens a box
  or drills a layer; double-tap zooms a step; double-tap-and-hold then drag zooms
  smoothly, **down to zoom in**, matching maps apps. Pinch works but is never required.
- **Continuous zoom between layers.** Opening a box does not cut to a new screen:
  the child layer is placed *inside* that box and the camera keeps zooming, so the
  next layer grows out of the thing you tapped and going back reverses it. Scale is
  interpolated in log space, and the camera is anchored on the tapped card's centre
  — the translation is derived from where that anchor should sit on screen rather
  than interpolated on its own. Interpolating translation independently is what
  makes a zoom feel sickening: the focal point drifts sideways and wanders back
  instead of converging. Opacity is driven in the same frame loop; handing it to a
  CSS transition puts the two on different clocks and it flickers as layers cross.
- **Colour, icon, and border per kind**, so a reader identifies a box three ways
  over and colour is never the only cue. The palette is validated for colour-blind
  separation and contrast in both themes — see `references/layout.md` before
  changing it.
- **Two view models.** Phones open at 1:1 — legible immediately, pan to explore,
  since no phone shows a whole architecture diagram legibly. Desktop (≥900px)
  opens with the layer fitted whole, because it has the room.
- **A detail panel that changes shape.** Bottom sheet on mobile; a persistent
  right rail on desktop so reading about a box doesn't cover the box. One set of
  content, re-homed on breakpoint change.
- **Desktop behaviors** — hover lights up a box's own connections and fades the
  rest, full keyboard navigation (arrows pan, `+`/`-` zoom, `0` reset, `Esc`
  clear-then-back, `Backspace` up, Tab/Enter), grab cursors.
- **Orthogonal edge routing** that scores candidate routes against every face and
  bus position and picks whichever cuts through the fewest cards, fans out ports
  shared by several edges, and places each label in the clearest spot on its route
  — keeping tags clear of arrowheads, of each other, and of card borders. Arrow tips
  land exactly on the target border: the marker anchors `refX` on the tip so the
  head never creeps inside the card as stroke width changes.
- **A resizable detail rail with hover preview.** Pointing at a card previews it
  in the rail without committing a selection; clicking pins it. A bar on the
  divider drags to resize, clicks to hide or show, and drags shut past a
  threshold; reopening returns the panel to the width it had before.
- **No zoom buttons.** Scroll zooms at the pointer, `0` resets, `+`/`-` are on the
  keyboard, and touch has double-tap-drag — on-screen zoom controls duplicated all
  of it, so the only chrome left is one reset pill on touch, where no keyboard is.
- **Accessibility** — cards and their `i` buttons are separate tab stops with
  ARIA labels, so details are reachable without a mouse.
- **Light and dark, with an explicit toggle.** The page follows the OS by
  default via `prefers-color-scheme`; a button in the topbar stamps
  `data-theme` on the root so a reader can override it, which wins in both
  directions because those rules are written after the media query.

If the user wants a different visual style, change the CSS custom properties at
the top — not the machinery below. If that includes new accent hues, re-validate
them (`references/layout.md` §6) rather than trusting how they look side by side.
