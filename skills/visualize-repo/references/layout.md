# Laying out an architecture level

Read this before placing boxes. Everything here is derived from the renderer, so
using it means getting the layout right by construction instead of by repeated
audit runs.

## 1. Work on a grid

Pick a column pitch and a row pitch for the level, then snap every box to it.
A grid isn't a style preference — the edge router can only turn corners in empty
strips, so **the gutters between your columns and rows are its entire routing
budget.** A scatter of boxes leaves it nowhere to run, and you get routes cutting
through cards no matter how much total space is on the canvas.

A layout that works for most levels:

```
col:    0            1              2              3
     ┌────────┐   ┌────────┐    ┌────────┐    ┌────────┐
row0 │ actors │   │ entry  │    │ entry  │    │ entry  │
     └────────┘   └────────┘    └────────┘    └────────┘
          ← 160px gutters between columns →
                  ┌──────────────────────┐
row1              │   the shared core    │       ← 120px gutters between rows
                  └──────────────────────┘
     ┌────────┐   ┌────────┐    ┌────────┐    ┌────────┐
row2 │ store  │   │ store  │    │ store  │    │ store  │
     └────────┘   └────────┘    └────────┘    └────────┘
```

Rules that matter more than they look:

- **Gutters ≥ 160px between columns, ≥ 120px between rows.** An edge crossing the
  diagram needs a gutter that runs the whole way, not just near its endpoints.
- **The canvas is free.** `W`/`H` are fitted to the viewport, so growing the canvas
  to open a gutter costs nothing on screen. Grow it rather than squeezing boxes.
  Oversize `W`/`H` by a comfortable margin and centre the content in it.
- **Give actors their own column, outside any boundary.** They aren't part of the
  system, and putting them in the boundary asserts that they are.
- **Give stores their own row.** They're the layer everything reads from; a
  dedicated row means every `reads/writes` edge is a short vertical hop.

## 2. Card height arithmetic

Every card is a rectangle with the same anatomy: an accent bar down the leading
edge, a kind icon and stereotype label on the top row, then title / tech / short
text below it. Text is laid out top-down from a running cursor, so anything that
wraps pushes everything below it down. The budget, in SVG units:

| Element | Cost |
|---|---|
| Top of card to the first text line (icon + stereotype row) | **60** |
| Each title line | **23** |
| `tech` line, when present | **23** (3 gap + 20) |
| Gap before the `short` line | **6** |
| Each `short` line | **18** |
| Bottom breathing room | **~14** |

So a typical card — one-line title, a `tech` line, two-line `short`:

```
60 + 23 + 23 + 6 + (2 × 18) + 14  =  162   → h: 175
```

Quick reference:

| Shape | Minimum `h` |
|---|---|
| 1-line title, no tech, 1-line short | 130 |
| 1-line title, no tech, 2-line short | 150 |
| 1-line title, tech, 1-line short | 150 |
| 1-line title, tech, 2-line short | 175 |
| 2-line title, tech, 2-line short | 195 |

These are the same for every kind — the icon row is a fixed height, so a person
card costs exactly what a container card costs. **Cards should be at least 200
wide**, or the icon and stereotype row crowds the title. When in doubt, round up:
a slightly tall card looks deliberate, a clipped one looks broken.

## 3. Where the text wraps

Wrap widths depend on card width. Title and `short` both indent 20 from the left
edge and stop 20 from the right, so the usable width is `w - 40`:

- **title** wraps at `floor((w - 40) / 11.4)` characters per line
- **`short`** wraps at `floor((w - 40) / 8.6)` characters per line

Both cap at **2 lines** and add an ellipsis if there's more text than fits — so a
`short` that gets truncated is silently losing information. Check the rendered
result, or keep `short` comfortably inside two lines.

Worked example at `w: 280`: usable 240 → title ~21 chars/line, `short` ~27
chars/line. At `w: 340`: title ~26, `short` ~34.

**Widen a card before you shrink its text.** The type scale is calibrated for
legibility on a phone at 1:1; making text smaller to fit defeats the whole point.

## 4. Edge labels

- **≤ 13 characters keeps a label on one line.** At 14+ it wraps to two lines and
  roughly doubles in height, which makes it much harder to place in a gutter.
- A label needs a clear span on its own route to sit in. Two cards separated by a
  60px gutter cannot host a 120px label, no matter how the router tries.
- The router already prefers routes that leave room for their label, and places
  each tag in the clearest spot on its route — so if a label still lands badly,
  the layout is too tight, not the router.

**Align cards to the row grid, including actors.** A card that straddles a gutter
(say, an actor placed between two rows) leaves the router no clean corridor on
either side, and the routes into it get long and strange. Actors sit in their own
column, but they still belong on a row.

## 5. Boundaries

`boundary` draws a dashed frame, typically around the containers that belong to
the system in focus. Two things to know:

- Its label is masked out of the dashes by measuring the rendered text, so any
  label length is safe.
- **Declare `boundary.contains: ["id", ...]`.** Membership is otherwise pure
  coordinate coincidence, and it changes what the diagram asserts — a config
  store that drifts inside a package frame claims it ships inside that package.
  With `contains` declared, the audit fails when the drawing and your intent
  disagree, which turns a silent accuracy bug into a caught one.

## 6. Colour and icons

Each kind carries an accent colour, an icon, and a border treatment. Colour is
never the only cue — every card also shows an ink stereotype label — which is what
keeps the diagram readable in greyscale, in print, and for colour-blind readers.

| Kind | Accent | Shape cue |
|---|---|---|
| person | blue | rounded corners |
| container | aqua | plain rectangle |
| component | violet | plain rectangle |
| store | orange | drum icon |
| external | grey | dashed border |
| system | ink | heavy border, tinted fill |

Only three of these ever share a screen — person, container and store — and that
trio was validated all-pairs for colour-blind separation and contrast against both
the light and dark surfaces. Components appear only on their own levels; externals
and the focus system are deliberately neutral. **If you re-colour the palette,
re-validate it**; swapping in two hues that happen to look nice can quietly put an
indistinguishable pair on the same screen.

**Do not give data stores a cylinder.** It was tried and removed: the curved top
and bottom crowd the text, and the curve does not coincide with the rectangle the
edge router aims at, so edges visibly missed the shape. The drum lives in the icon.

## 7. Writing `short`

`short` is the one line under each card title, and the fastest way to make a
diagram feel sloppy is to let it drift between registers — one card saying what a
thing *does*, the next naming an example, the next listing file types.

Pick one rule and hold every card to it. What works: **`short` answers "what job
does this box do?" as a lowercase third-person verb phrase, no trailing period** —
"scores a panel against a Reference", "maps gene aliases to symbols". People and
external systems keep the same grammar from their own side of the boundary: a
person's line is what they do *with* the system, an external's is what it
*supplies to* it. That keeps every card scanning identically.

Then check the length against the card, because `short` silently truncates at two
lines: budget is `floor((w - 40) / 8.6)` characters per line. A 220-wide card gets
about 40 characters total. If the rule and the budget collide, move the detail into
`desc` rather than shipping a truncated line — `desc` is what the reader opens next
anyway.
