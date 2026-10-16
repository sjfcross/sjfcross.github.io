# Arachnid Cabinet — live isometric figure (plan)

Written 2026-10-14. Not started. Target page: `pages/arachnid.html`.

An interactive isometric figure of the real cabinet, built with the **Anatomy** Claude Code skill. It mirrors the
cabinet's live state from ThingSpeak and can act out the firmware's rules.

---

## 0. Before you start (fresh session!)

- **2026-10-16: the build runs in a CLOUD session** paid by the user's $100 cloud-session credit, which expires
  5 Nov 2026.
  - Work on the branch `cupboard-figure`: `git checkout cupboard-figure`. Read this file (repo root) and
    `_figure_ref/`.
  - Commit and push only to `cupboard-figure`. **Never push to `main`.**
  - Follow "Page structure + build order" below. Its stages replace the older stage list in section 2 where they
    differ: the cupboard overview comes first, and the bubbles belong to the Sea Monkey tank.
- Local fallback: start a NEW local session, not a continuation of the long planning one.
- **Usage guard (Pro plan, extra usage OFF):** check the 5-hour and weekly usage before starting and between stages
  (`get_usage`). **Stop at ~60% of the 5-hour window** and resume after the reset. Never start a stage above 60%.

### Install the skill

Repo: https://github.com/wheresryan22/anatomy (MIT, no API keys, Node built-ins only). It was 6 days old when this was
written, so pin a commit.

Use the git route, not `npx skills add`, so there's no npm package to vet:

```bash
git clone https://github.com/wheresryan22/anatomy.git ~/.claude/skills/anatomy
cd ~/.claude/skills/anatomy && git checkout e6600ffc4e8e6620eeb45bf49bcdbd5e4b84163f
```

- The pinned commit `e6600ff` is main as of 2026-10-13 (merge of PR #60).
- Requirements are already met on this PC: Node v24.15 (needs ≥ 20.10) and Chrome at
  `C:\Program Files\Google\Chrome\Application\chrome.exe` (used for the skill's self-checks).
- If `/anatomy` doesn't show up, run `/reload-skills` or restart the session.
- Before the first build, skim `scripts/capture.mjs` and `scripts/drive.mjs`. They launch headless Chrome, so check what
  they do. The README and SKILL.md were reviewed on 2026-10-14; the scripts were not.
- It runs fine on the AMD RX 6800 (browser WebGL only, no CUDA).

---

## 1. Ground truth (from `pages/arachnid.html` and `assets/img/enclosure2.jpg`)

**Physical layout (photo):**
- A glass display cabinet with 2 glass shelves.
- 4 clear acrylic enclosures, 2 per shelf, each with hinged front doors, perforated vent strips and top latches.
- Each enclosure has cork bark or a cork tube, coco/moss substrate, plants and a water dish.
- A web is visible in the top-right enclosure.
- An LED grow panel is mounted on the cabinet ceiling, between the top two enclosures.
- Round chrome door handles are on the right.
- ~~Open question: where the fogger, fan, air pump and NodeMCU sit~~ → answered 2026-10-16, see "Cupboard map" and
  "Climate zone interior" below. Still open: the OLED's location.

**Electronics:**
- NodeMCU HW-364A (ESP8266).
- AHT10 sensor and SSD1306 OLED on a shared I²C bus.
- 3× IRLZ44N MOSFET outputs:
  - Fogger on D1/GPIO5, with a BC548B button-bypass on the mist maker.
  - Fan on D3/GPIO0.
  - "Light" on D2/GPIO4, which actually drives a **Sea Monkey air pump**.
- Power: 12 V SMPS → 5 V 10 A buck → protoboard rail.
- Wiring detail is in `assets/img/arachnid_cabinet_wiring_v5.svg`.

**OLED (6 screens, 10 s each):** clock HH:MM:SS → humidity % (`ERR` on sensor fail) → temperature °C →
fogger `ON/OFF/BLOCKED/OVERRIDE` + countdown → light status → fan status.

**Firmware rules (v2.4)**, highest priority first:

| Output | Rules |
|---|---|
| Fogger | 1. 3 bad sensor reads → forced OFF.<br>2. Humidity ≥ 90% → forced OFF (BLOCKED), re-enabled only below 85%.<br>3. 3-min manual override → ON.<br>4. Schedule: night 23:00–07:00 ON for the first 3 min of each hour; day OFF. |
| Fan | 1. 3-min override → ON.<br>2. Schedule: night ON 4 min/hr; day ON 3 min at 07, 10, 13, 16, 19 and 22:00. |
| Light (air pump) | Manual only: 10- or 30-min override. |

Target humidity is 60–85% at night, drying down during the day. Timezone is UK (GMT/BST).

**Live data source:** `https://api.thingspeak.com/channels/3372054/feeds/last.json` (public, HTTPS, no auth).
`pages/animals.html` around line 724 already uses it, so reuse that parsing:

| Field | Meaning |
|---|---|
| `field1` | temperature °C |
| `field2` | humidity % |
| `field3` | fogger (`'1'` = on) |
| `field4` | fan |
| `field5` | light/air pump |
| `created_at` | timestamp |

- Values are **strings**.
- The device pushes every 20 s, so poll every 20–30 s and handle the fetch failing ("unreachable, will retry").

**Hard rule: read-only.**
- Never call the device (`sjfcross.ddns.net` / the LAN IP) or any `/toggle*` or `/override*` endpoint from the figure.
- Never put the control key anywhere.
- The browser would block those calls anyway: the page is served over HTTPS and the device only speaks plain HTTP.

---

## 2. Stages (each one is shippable on its own)

### Stage 1: static cabinet + live state (no WebGL)

- Isometric SVG of the cabinet, matching the photo.
- Readout card: live humidity and temperature, fogger/fan/pump chips, "updated hh:mm:ss", and a stale or offline state.
- Live mapping:
  - Fogger on → an SVG mist puff above the fogger.
  - Fan on → blades rotate.
  - Pump on → bubbles.
  - The OLED cycles its 6 screens with the real values.
- Calm idle motion, a pointer hover that highlights a part and shows its name and GPIO, and support for reduced motion.
- **Dark theme only**, matching the page tokens:
  - Colours `--bg #080812`, `--panel #1a1a2e`, `--accent #6366f1`, `--accent2 #c4b5fd`, `--amber #f59e0b`,
    `--green #34d399`, `--red #ef4444`.
  - Fonts: Playfair Display, Lora, DM Mono, already loaded by the page.
- Output: a standalone HTML preview first, embedded in the page only after the user approves it.

### Stage 2: WebGL mist

- Replace the SVG puff with Anatomy's SVG+WebGL layer: fog rolling out of the fogger and drifting through the
  enclosures.
- The SVG must still read when WebGL is off.

### Stage 3: 24 h simulation mode

- A Live ↔ Simulate toggle and a 24 h time scrubber.
- Simulate runs the firmware rules above on a simple humidity model, showing the 90% BLOCKED, the release below 85%,
  and the night schedule.
- A "pull sensor" button drives ERR, then the fogger forced OFF.
- Keep the rule logic in **one small JS module**. If the firmware changes (v2.5+), this is the one place to update.

---

## 3. Delivery

- New section on `pages/arachnid.html`, probably `<section id="live-figure">` between the hero and `#hardware`.
  Alternatively it goes in the hero next to the photo; ask the user.
- Keep `enclosure2.jpg`. The figure adds to the photo, it doesn't replace it.
- Preview locally against live ThingSpeak and check the browser console and mobile width (16 px gutter, no horizontal
  scroll).
- Show the user before committing. **Don't commit or push without asking.**

## Scope revision: whole cupboard + zoom (proposed 2026-10-16, awaiting the user's photos)

The 4-terrarium climate zone is only **one section** of a bigger cupboard. Other sections hold:
- **Sea Monkeys**, whose bubbler is the NodeMCU "Light" output (GPIO4 / field5). So the bubbles belong in the Sea Monkey
  tank, NOT in the climate zone.
- **Unclimatised zones** with scorpions, beetles etc.

Proposed shape: **one drawing, two zoom levels** (same coordinates, camera zoom via the viewBox, not two separate
figures):
1. **Overview:** the whole cupboard, low detail. Each zone is hoverable/clickable with its residents. Live chips only
   where data exists: the climate zone (humidity, temperature, fogger, fan) and the Sea Monkey tank (bubbler).
2. **Zoom into the climate zone:** the detailed live figure from stage 1–3 (fog, fan, OLED, firmware rules).

Unclimatised zones stay simple boxes with labels and residents, cheap to change when animals come and go.

**Open:** a full front photo of the whole cupboard; the list of zones and residents; which page it belongs on
(`arachnid.html` covers only the climate build, so maybe `animals.html` for the overview).

### Reference photos (branch `cupboard-figure`, folder `_figure_ref/`)

| File | Shows |
|---|---|
| `cupboard_overview_doors_open.jpg` | the whole Expedit with both glass doors open |
| `cupboard_overview_closed.jpg` | the whole Expedit with doors closed (front view, proportions) |
| `cube_top_left_seamonkeys.jpg` | the top-left cube: Sea Monkeys, mantis cup, B. hamorii, L. parahybana |
| `cube_row2_right_stickinsects_electronics_box.jpg` | the stick insect cube + the wooden electronics box (NodeMCU + OLED) |
| `cube_climate_zone_interior.jpg` | the climate zone, emptied: fogger, fan, sensor, broken shelf corner, mood LED |
| `assets/img/enclosure2.jpg` (already on main) | the climate zone, front, with all 4 terras in place |

Draw from these photos: proportions, the colours of the dark Expedit finish, white inserts, glass, acrylic. No brand
labels on the bottles, and no room background (wallpaper, fireplace, door).

### Cupboard map (from the user's photos, 2026-10-16)

**IKEA Expedit, 2 columns × 4 rows of cubes.** Dark brown/black-brown finish. Roughly 79 × 149 × 39 cm, with each cube
about 33 × 33 cm inside (approx, from Expedit specs, not measured). It stands between a gas fireplace (left) and a
door (right).

| Row (bottom → top) | Left cube | Right cube |
|---|---|---|
| 1 (bottom) | closed door: animal equipment / food / tools | closed door: sweets |
| 2 | 4-compartment insert: gimmicks + drinking glasses (Glencairns, hip flask, plush sheep) | (close-up 2026-10-16) tall Zoo Med glass terrarium with a black base and lid: 2× *Medauroidea extradentata* "Blue" (stick insects) on bramble-type leaves in a water cup, sitting slightly right of centre. LED strip panel on the cube ceiling, set at an angle. **ELECTRONICS BOX:** a small light-wood box mounted high on the cube's LEFT inner wall, with a USB cable. It holds the NodeMCU + protoboard; power/signal cables run from here UP into the climate zone (row 3 right, directly above) and to the bubbler. **The air pump and all cable runs are BEHIND the cupboard** (Expedit has an open back). |
| 3 | glass shelf. Top: acrylic box with *Prionotheca coronata* (Radiant Sun Beetle, left) and a round tub with *Smeringurus mesaensis* (scorpion, right). Bottom: glass terrarium with many orange *Porcellio laevis* + 1 unidentified millipede | **CLIMATE ZONE** behind a glass door, hinged on the right, round chrome knobs, white insert. Glass shelf, 2×2 acrylic terras: top-left *C. versicolor*, top-right *A. purpurea*, bottom-left *A. minatrix*, bottom-right *C. laeta* |
| 4 (top) | (close-up photo 2026-10-16) glass door **hinged on the LEFT**, white back and side panels, LED strip panel centred on the ceiling, glass shelf at about half height. Top, left → right: [white object, removed], polka-dot plant in a grey pot, yellow-mesh-lidded mantis cup, tall Sea Monkey cylinder (green algae, orange ornament, plant décor) with clear air tubing arcing in from the back/top. Bottom: B. hamorii (red cork bark, plant, pale substrate) and L. parahybana (dark substrate, burrow, wood). ··· glass door, white insert, LED panel on the ceiling, glass shelf. Top: **Sea Monkey tank** (tall cylinder, orange, with an air tube = the NodeMCU bubbler), polka-dot plant, 2 small round cups for the babies: the visible yellow-lidded one is the *Hierodula membranacea* (mantis), and the other one, hidden behind, holds a tiny *Heterometrus silenus* (scorpion). The white upright object is being removed, so don't draw it. **Not climatised**: it has an LED panel, and the Sea Monkeys get the NodeMCU bubbler line. Bottom: 2 acrylic terras, left *Brachypelma hamorii*, right *Lasiodora parahybana* | whisky bottles: draw as **generic bottles, no brand labels** (user confirmed) |

### Lighting + OLED (2026-10-16)

- **The OLED sits in the electronics box with the NodeMCU** (row 2 right, the light-wood box on the left wall), NOT in
  the climate zone. In the figure the OLED cycles its 6 screens on the box, and the climate zoom doesn't include it.
  Consider a small OLED readout pinned in the zoom view.
- **4 LED strip panels, one in each animal cube:** top-left, climate zone, stick insects, and row 3 left (beetle /
  scorpion / isopods).
  - They're **12 V panels on their own timer**, fed straight from the 12 V AC-DC SMPS. **Not NodeMCU-controlled and not
    in ThingSpeak.**
  - Draw them following the timer: **ON 12:00–22:30, OFF otherwise** (UK local time, user-confirmed 2026-10-16). Put
    the times in the config object, so a timer change is a one-line edit.
  - Exactly where the timer sits in the 12 V line is unconfirmed.

### Climate zone interior (row 3 right, door-open photo with terras removed, 2026-10-16)

- **Shell:** white insert on the left, back and right walls. Expedit black floor and ceiling. A white trim strip along
  the front edge. Glass door hinged on the RIGHT.
- **Glass shelf** at about mid-height on pins. **Its right-back corner is broken out on purpose,** so fog rises from the
  lower level into the upper one.
- **Terras:** the 4 acrylic terras sit at the front (2 per level), leaving a gap behind them for the equipment.
- **Fogger:** a white cylindrical USB mist maker wrapped in yellow tape (the BC548B button mod), **on the floor at the
  back right** of the lower level. Mist rises straight up through the broken shelf corner.
- **Fan:** small black fan (~40 mm, size not measured) on the **back wall of the lower level, left of centre, at about
  mid-height**, blowing across towards the fogger.
- **AHT10 sensor:** small blue board at the **left-back, just above the glass shelf** (upper level).
- **Mood LED:** a round RGB LED board at the **top-left of the back wall** (upper level). It's currently **NOT
  connected**: it was the original "Light" output, which now drives the Sea Monkey bubbler. Draw it unlit. If it's ever
  reconnected, that's a config change (see Built for change).
- **LED strip panel** on the ceiling, angled towards the back.
- **Cable entry:** a hole in the bottom-left back corner. Cables come up from the electronics box in the cube below.

**Fog animation:** the source is the fogger at the back-right floor. The plume rises through the broken shelf corner
into the upper level, the fan pushes air across the lower level from left to right, and fog seeps into the terras
through their perforated vent strips.

## Page structure + build order (proposed 2026-10-16)

**New page** `pages/cupboard.html` (name TBD), linked from `animals.html`:
1. **Hero:** the whole-cupboard figure, live. LEDs follow the 12:00–22:30 timer, plus the Sea Monkey bubbler and the
   climate chips. Click a cube to zoom in.
2. **Residents, right now:** a list generated from the **same data file as the figure**. Change an animal in one place
   and both the figure and the list update.
3. **24 h simulation** of the whole cupboard: lights, fog, fan, bubbler, firmware rules.
4. **Links:** the spider climate cabinet build (`arachnid.html`), climate data (`environment.html`) and the keeper's
   log (`animals.html`).

**Build the figure once as a reusable module, so there's no second build for the docs page:**
- `assets/js/cupboard-figure.js` (drawing + behaviour) and `assets/data/cupboard.json` (parts, residents, ThingSpeak
  mapping, LED timer, rules config).
- `cupboard.html` embeds it at the overview level. `arachnid.html` later embeds the SAME module started zoomed into the
  climate zone (e.g. `data-start="climate"`). That puts the simulation in the docs for free.

**Build stages (each one comes back as a preview on a branch for review):**
1. Overview figure + residents from the JSON + live data (ThingSpeak, LED timer).
2. Climate zoom + the WebGL fog path (fogger → broken shelf corner → upper level, fan airflow).
3. The 24 h simulation.
4. Wire into the site: the new page, a link from `animals.html`, and the embed in `arachnid.html`. Only after approval.

**Later option, not now:** residents in Supabase (like `spider_log`), so they could be edited from the phone. Start
with the JSON.

## Built for change (decided 2026-10-16)

The cabinet will change: the S9 Warden phone goes in, the Sea Monkey pump may go, and a light schedule may come.
Later edits must be small sessions, never a full Anatomy rebuild. So:

- **Every physical part is its own named SVG group** (`#part-fogger`, `#part-fan`, `#part-pump`, …). Adding one
  means drawing one part, and removing one means deleting one group.
- **One config object** maps ThingSpeak fields to parts, labels, GPIO and hover text. If field5 changes from the air
  pump to lights, edit this object only.
- **Firmware rules stay in one small JS module** (see stage 3).
- Add a short `FIGURE_NOTES.md` (or a header comment) next to the figure listing the parts, the config and how to add a
  part, so a future session doesn't have to reverse-engineer it.

## Delivery decision (2026-10-16)

- The cloud session builds the **standalone preview file on a branch** and leaves `pages/arachnid.html` untouched.
- The user reviews the figure alone. It's embedded in the real page only after approval.
- Nothing is pushed to `main` without the user.
- Before starting: the user answers the open placement questions with photos (fog path, fogger/fan/pump/electronics
  placement, sensor height, which spider lives in which enclosure, cabinet model/size).

## Not in scope

- Light theme, React/Next export, and the beta 3D mode.
- Any change to the firmware or the device.

---

**Note (2026-10-16):** this plan and `_figure_ref/` live ONLY on the branch `cupboard-figure`, not on `main`. **Before
merging anything into `main`, delete `ARACHNID_FIGURE_PLAN.md` and `_figure_ref/`.** Otherwise they'd be served on
the live site.

**Original note:** this file lives in the public GitHub Pages repo. If committed, it gets served like every other file (the repo
has `.nojekyll` and no `.gitignore`). It holds nothing secret, but delete it or move it out of the repo when the figure
is done.
