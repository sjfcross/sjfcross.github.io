# Cupboard figure: notes

Live isometric figure of the IKEA Expedit 2×4 invertebrate cupboard.

| File | What it holds |
|---|---|
| `assets/js/cupboard-figure.js` | Drawing and behaviour. Knows how to draw each part **kind** and animate each **effect**. No animals, positions or field numbers in here. |
| `assets/data/cupboard.json` | Everything that changes: camera, cupboard size, cubes, residents, parts, the ThingSpeak mapping, the OLED screens, the LED timer, labels. |
| `_preview/cupboard_preview.html` | Standalone preview (stage 1). Not linked from the site. |

## Embedding

```html
<div data-cupboard-figure data-src="/assets/data/cupboard.json"></div>
<script src="/assets/js/cupboard-figure.js" defer></script>
```

The script injects its own CSS (scoped under `.cf-root`). It uses the page tokens (`--bg`, `--panel`, `--accent`,
`--accent2`, `--amber`, `--green`, `--red`, `--text`, `--text-dim`, …) when they exist and falls back to the same
values otherwise. Fonts: Playfair Display, Lora and DM Mono, loaded by the page.

`fetch()` doesn't work from `file://`, so open it through a server:
`python3 -m http.server 8000` from the repo root, then <http://localhost:8000/_preview/cupboard_preview.html>.

## Coordinates

Units are centimetres. Every part sits in **cube-local** coordinates:

- `x` runs from the cube's left inner wall (0) to the right (33.75).
- `y` runs from the front opening (0) to the back (39; the inserts' back panels are at 37.5).
- `z` runs from the cube floor (0) up (33.1).

Box-like parts take `at: [x, y, z]` (min corner) plus `size: [w, d, h]`. Round parts take `at: [cx, cy, z]` plus `r` and
`h`. Wall items take `at` = their centre on the wall.

Cubes are addressed by `row` (1 = bottom … 4 = top) and `col` (0 = left, 1 = right). Ids: `cube-r<row>-<l|r>`.

## SVG structure

```
svg.cf-svg
  g.cf-cube#cube-r3-r [data-cube]          one per cube, clipped to its front opening
    (shell: back, side wall, floor)
    g.cf-part#part-insert-climate--back     a part's "under" piece (walls behind everything)
    g.cf-part#part-fogger [data-part]       one group per physical part
    …
    g.cf-part#part-insert-climate--front    a part's "over" piece (front edges)
    path.cf-dim                             darkens LED cubes while the panels are off
  g.cf-part#part-cupboard                   carcass: board fronts, side, top
  g.cf-part#part-door-climate               doors, outside the clip
  g.cf-hls                                  hover/selection outlines
```

Every physical part is its own `<g class="cf-part" id="<part id>" data-part="<part id>">`. A few parts wrap others
(inserts, the 4-compartment insert), so they also have a `--back` or `--front` piece with the same `data-part`. If
the module is mounted twice on one page, the second copy's ids get a `cf2-` prefix.

Paint order inside a cube: the shell, then level 0 (below a shelf), the shelf, then level 2 (on the shelf), then LED
panels. Within a level, wall-mounted items and cables come first, then everything else from back to front.

## Live data (read-only)

`thingspeak` in the JSON:

- `readings`: numeric fields shown as metrics (`field1` temperature, `field2` humidity).
- `outputs`: on/off fields. Each one names the `part` it drives and the `effect` to show:

| effect | what it does | drawn by |
|---|---|---|
| `mist` | puffs rising from the nozzle | `fogger` |
| `spin` | rotor turns, ring turns green | `fan` |
| `bubbles` | bubbles rise from the airstone | `seaMonkeyTank` |
| `glow` | a soft glow around the board | `moodLed` |

The driven part gets `data-active="on" | "off" | "unknown"`. `unknown` is used while the data is stale (older than
`staleAfterSeconds`) or ThingSpeak can't be reached, so the figure never claims something is running when it doesn't
know. Polling every `pollSeconds` (25) is paused while the tab is hidden.

**Remap field5** (for example, if the bubbler goes and field5 drives a light): edit the `bubbler` entry in
`thingspeak.outputs`, e.g. `"label": "Mood LED", "part": "part-mood-led", "effect": "glow"`, and the OLED screen's
`key` if you rename it. No JS change.

The only network calls are the JSON file and `thingspeak.url`. Never add the device (`sjfcross.ddns.net`, LAN IPs),
`/toggle*`, `/override*` or a control key.

## LED panels

Not in ThingSpeak. `ledTimer` (`on` / `off`, UK local time via `Europe/London`) sets `data-leds` on the root. Every part
with `"timer": "ledTimer"` lights up, and every cube with `"lit": "ledTimer"` gets the dim overlay while they're off.
A timer change is a one-line JSON edit.

## OLED

`oled.screens`: 6 screens, `secondsPerScreen` each, cycling in step with the clock. `show` is `clock`, `reading`
(humidity shows `ERR` when the field is empty) or `output` (`ON` / `OFF`). The card's bottom-right corner mirrors the
current screen, because the real OLED is tiny in the overview.

## How to …

**Add an animal** in an existing enclosure: add an entry to that cube's `residents`
(`scientific`, `common`, `where`, `in` = part id, `visible`, `nameSource`).

**Add an animal in a new enclosure:** also add a part, e.g.

```json
{ "id": "part-terra-newspider", "cube": "cube-r4-l", "kind": "acrylicTerra", "label": "Acrylic terra (…)",
  "at": [1.5, 2, 0], "size": [15, 16, 14.5], "substrate": "coco", "decor": ["wood", "plant"],
  "critter": { "type": "spider", "body": "#222", "accent": "#c66", "span": 5, "u": 0.5, "b": 0.1 } }
```

**Remove an animal or part:** delete its resident entry and/or its part entry. Nothing else refers to it, except
`thingspeak.outputs[].part` and `oled.part`. The console warns if one of those points at a missing part.

**Move a part:** change its `at`. Mind the camera: it looks from the front-left and a little above, so the back-left
strip of each cube and the tops of tall items at the back are hidden by the boards.

**A new kind of part:** add `PAINTERS.<kind> = function (G, p, X) { return '<svg markup>'; }` to the JS. `G` is the
cube's frame: `G.P(x, y, z)` projects, and `G.rectX / rectY / rectZ / d` build face paths. `box()` and `lathe()` build
solids. `G.side(x0, x1)` is the side face that faces the camera. Optional flags: `.layer = 0` (wall items),
`.level = 3` (ceiling items), `.split = p => z` (a shelf), `.front = true` (doors, drawn outside the cube clip). Return
`{ under, main, over }` if the part has to wrap others.

Kinds available now: `whiteInsert`, `glassShelf`, `ledPanel`, `acrylicTerra`, `glassTerra`, `zooMedTerra`,
`roundTub`, `cup`, `plantPot`, `seaMonkeyTank`, `electronicsBox`, `oled`, `fogger`, `fan`, `sensor`, `moodLed`,
`cableHole`, `cable`, `compartmentInsert`, `glencairn`, `flask`, `plush`, `bottle`, `door`, `glassDoor`.

`nameSource` on residents records where a common name came from: `site` (pages/animals.html), `plan`
(ARACHNID_FIGURE_PLAN.md) or `unverified` (not checked against a source yet).

## Not in stage 1

Climate-zone zoom, WebGL fog, 24 h simulation, the real page (`pages/cupboard.html`) and any embed in existing pages.
