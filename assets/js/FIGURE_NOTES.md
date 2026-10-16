# Cupboard figure: notes

Live isometric figure of the IKEA Expedit 2×4 invertebrate cupboard.

| File | What it holds |
|---|---|
| `assets/js/cupboard-figure.js` | Drawing and behaviour. Knows how to draw each part **kind** and animate each **effect**. No animals, positions or field numbers in here. |
| `assets/data/cupboard.json` | Everything that changes: camera, cupboard size, cubes, residents, parts, the ThingSpeak mapping, the OLED screens, the LED timer, labels. |
| `assets/js/cupboard-rules.js` | The controller's rules (firmware v2.4) and the humidity model for the simulation. |
| `pages/cupboard.html` | The cupboard page. |

## Embedding

```html
<div data-cupboard-figure data-src="/assets/data/cupboard.json"></div>
<script src="/assets/js/cupboard-figure.js" defer></script>
```

The script injects its own CSS (scoped under `.cf-root`). It uses the page tokens (`--bg`, `--panel`, `--accent`,
`--accent2`, `--amber`, `--green`, `--red`, `--text`, `--text-dim`, …) when they exist and falls back to the same
values otherwise. Fonts: Playfair Display, Lora and DM Mono, loaded by the page.

`fetch()` doesn't work from `file://`, so open it through a server:
`python3 -m http.server 8000` from the repo root, then <http://localhost:8000/pages/cupboard.html>.

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

## Zoom (stage 2)

A cube with `"zoom": true` (the four animal cubes) zooms in on click (or Enter): the same drawing, with the viewBox animated to the cube's box
(the card keeps its size, so the aspect is kept). The other cubes fade, the cube's glass door fades, and
"← Whole cupboard" or Esc goes back. `zoomCaption` replaces the caption while zoomed.

Start zoomed (for `pages/arachnid.html` later): `<div data-cupboard-figure data-start="climate" …>`, where
`climate` is the cube's `zoomKey` (or its id).

## Fog (stage 2)

`fog` in the JSON names the cube, the fogger, fan and shelf parts, and the outputs that drive it. If WebGL is
available, the cube gets three layers:

```
svg.cf-svg      the whole drawing (back)
canvas.cf-fog   the fog, ray-marched in the cube's own coordinates (cm), so it lines up with the drawing
svg.cf-front    a copy of what stands in front of the fog in that cube: terras, shelf, insert edges, door
```

The kinds copied to the front are listed in `FOG_FRONT_KINDS` in the JS. The shader also treats each terra's
substrate as solid. The fog has a plume from the fogger up through the shelf's broken corner, a layer along the
floor that the fan pushes left to right, haze in both levels, and a little fog seeping into the terras.

Every level eases toward its target (`attackSeconds` to build, `lingerSeconds` to clear), so nothing pops. The
render loop runs only while the fog is changing or present and the figure is on screen. Under reduced motion it
draws one still frame. Without WebGL (or with `data-no-webgl`), the stage 1 SVG puffs show instead.

## Sound

A "Sound on / off" switch in the live box. Everything is generated with Web Audio, with no audio files: a fan hum, the
fogger's soft shhh, and the bubbler's pump buzz and bubbles. Each follows its output's `effect` (`spin`, `mist`,
`bubbles`), whether the value is live or simulated.

`sound.default` in the JSON (default `true`): the switch starts at "Sound on", and the sound starts with the visitor's
first click, tap or key press on the page, because browsers don't allow sound before that. Set it to `false` to start
silent. It fades in and out and pauses while the tab is hidden.

## Simulation box: try it yourself

The "Simulation" box in the side panel has "Simulate a day" (below) and a row of switches, one per ThingSpeak output
(Fogger, Fan, Bubbler). A switch turns that output on in the drawing only: fog, fan, bubbles and sound. The badge then
says "Simulation", and "Back to live" returns to the real data. Starting a simulated day clears the switches.

## 24 h simulation (stage 3)

`assets/js/cupboard-rules.js` holds the controller's rules and is the **only** place to edit when the firmware
changes (v2.5+). It has two separate parts:

1. **`FIRMWARE`**: mirrors v2.4 as documented on `pages/arachnid.html`, in priority order. One assumption: the fan's
   4 min per night hour are taken as the first 4 minutes.
2. **`MODEL`**: an illustrative humidity and temperature model, so the rules have something to react to. Its numbers
   are invented: with them the night climbs until the fogger is BLOCKED at 90 % from about 02:00, and the day dries
   it back down.

`simulateDay({ ledTimer, interventions })` runs a whole day in 10 s steps, starting from the state a normal day ends
in, so midnight joins up. It returns the timeline and a list of events. A button press (override, bubbler, pulling
the sensor) adds an intervention at the current time and recomputes the day, so the past doesn't change.

The figure loads the rules file next to itself on demand (`simulation.rulesSrc` in the JSON overrides the path), so
the embed is still one element. In the panel, "Simulate a day" starts it. Smart speed races through quiet stretches
(`fast`, ≈ 1 h every 3 s) and eases down to `slow` (≈ 2 min per second) shortly before every event and for a while
after it, longer after the bubbler starts (`bubblerHoldSeconds`). The fog, sounds, OLED (with BLOCKED / OVERRIDE /
countdowns / ERR), LED panels and readings all follow the simulated day. With reduced motion it starts paused.

## Where it's embedded (stage 4)

- `pages/cupboard.html`: the whole cupboard (figure, residents list, simulation section, links).
- `pages/arachnid.html`, section `#live-figure`: the same module, started zoomed into the climate zone with
  `data-start="climate"`.
- `pages/animals.html`: a link "The cupboard, live →" next to "How it works →".

The residents list is `<div data-cupboard-residents data-src="…/cupboard.json">`. When a figure is ready, the module
fires a `cupboard:ready` event (with `detail` set to the figure's controls, e.g. `startSim()`) that bubbles from the
embed element. `cupboard.html` uses it for its "Play the simulated day" button.

