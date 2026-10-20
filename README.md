# Kalsada-Cat

Kalsada-Cat is a pixel-art browser arcade game about a black cat crossing an endless Filipino street. Jeepneys, tricycles, and buses run through the lanes. Sari-sari stores, fishball carts, monobloc chairs, and sagging power lines crowd the sidewalks. One hit ends the run.

The game runs entirely on the client. It has no backend, no accounts, and no build-time assets beyond local font files.

## Run it

```bash
npm install
npm run dev
```

Vite prints a local URL. Use `npm run build` for the production bundle in `dist/`, and `npm run preview` to serve that bundle locally.

Requires Node 22.12 or newer. `.nvmrc` pins Node 24.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move one tile up, down, left, right | Arrow keys or WASD | Swipe in that direction |
| Hop forward | Up arrow or W | Tap the play field |
| Start / retry | Space or Enter | Button |
| Pause / resume | P or Escape | Pause button |
| Mute / unmute | M | Sound button |

The game buffers one movement input while a hop finishes. Static props block the target tile; roads do not. Moving backward is allowed and costs no points.

## Core gameplay loop

1. Read the next lane. Vehicle speed, direction, and length vary by lane.
2. Hop one grid tile. Each hop lasts 115 ms; a tap always moves forward.
3. Cross 2 to 5 lanes, then use the next sidewalk island to reset.
4. Route around the props on the island. Every island keeps one column fully clear, but that column moves from island to island.
5. Collect fishballs (+5), kikiam (+10), or an anting-anting charm (+1 shield). Shields stack without a cap; each hit consumes one.
6. Score one point for every new farthest row and keep moving. A jeepney, tricycle, or bus hit consumes one shield; a hit with no shields ends the run. The run is endless.

## Scoring and difficulty

| Event | Score or effect |
| --- | --- |
| Reach a new farthest row | +1 |
| Fishball | +5 |
| Kikiam | +10 |
| Anting-anting | Adds one shield charge; charges stack without a cap |
| Revisit an earlier row | No score |

Traffic starts with two-lane roads. The generator raises lane count to three, four, and finally five. It also raises speed, tightens gaps, and introduces tricycles after roughly 16 rows and buses after roughly 55 rows. Early roads are the tutorial.

Each road uses the same vehicle type in a lane so speeds stay coherent. A lane's vehicles move in one direction and wrap behind the rear-most vehicle, which preserves spacing. Re-entering vehicles always start fully outside the stage, and every generated row advances, so vehicles cannot appear in the middle of a road when the camera reaches them. The camera eases toward the cat, while rows generate ahead of the view.

## Game state logic

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> Playing: start
    Playing --> Paused: P / Esc / hidden tab
    Paused --> Playing: resume
    Paused --> Ready: quit
    Playing --> Dying: vehicle contact
    Dying --> Over: 0.85 s hit-stop
    Over --> Playing: retry
    Over --> Ready: start screen
```

| State | Behavior |
| --- | --- |
| Ready | Start screen. The street runs in attract mode behind the card; best score is visible. |
| Playing | Input, traffic, collisions, pickups, scoring, and camera follow run. |
| Paused | All simulation stops. The overlay offers resume, restart, and quit. Hiding the tab pauses automatically. |
| Dying | Traffic freezes for impact, the screen shakes, and the cat shows hit marks. Input is ignored. |
| Over | Final score card, record badge, retry, and start-screen actions. Traffic keeps moving behind the overlay. |

A new run creates a fresh world, places the cat at the starting sidewalk, resets score and shields, and starts input immediately. The best score survives runs.

High scores live in `localStorage` under `kalsada-cat.best.v1`. The engine loads the value before the first frame, updates the live best as points land, and the UI persists a new record immediately. `NEW RECORD!` compares the final score against the best score at the start of that run, not against the live value the run already raised.

The game pauses when the document becomes hidden. The pause overlay stays up when the player returns, so a run never resumes behind the player's back.

## Filipino street dressing

All sprites are drawn at runtime on a 260x420 canvas and scaled with nearest-neighbor rendering.

- The street rotates through four districts. Each has its own road tone, curb, lane paint, ground marks, and prop mix:

| District | Surface | Street furniture |
| --- | --- | --- |
| Barangay | Cool gray concrete with expansion joints, weeds, and drain grates | Sari-sari stores, monobloc chairs, plants, trash bags, no-crossing signs |
| Palengke | Terracotta tile with produce specks, stains, and patched asphalt | Fruit crates, fishball carts, stores, chairs, signs |
| City | Blue-gray pavers with utility covers and crisp lane paint | Signs, planters, stores, chairs, trash bags |
| Baywalk | Weathered boardwalk planks with salt marks and green-gray curbs | Painted benches, plants, carts, trash bags |

- Three sari-sari store variants share the sidewalk: **SARI-SARI**, **TINDAHAN**, and **KARINDERYA**, with different awnings, signs, and walls.
- Fishball carts come in three umbrella palettes. Glass cabinets hold fishball skewers; a vendor stands behind the cart.
- Street furniture includes blue and pink monobloc chairs, tied trash bags, potted plants, no-crossing signs, wooden produce crates, and painted benches.
- Wooden utility poles carry transformers and three sagging wires across the road. Wires draw behind the cat so play stays readable.
- Jeepneys use twelve color schemes and three decoration styles. Roof cargo, chrome trim, side checks, and accent stripes change per vehicle.
- Tricycles and buses use the same twelve palettes plus their own variants. Tricycles add roof cargo or a pennant and side stripe; buses add roof luggage or a lower livery band.
- Road surfaces use theme-specific asphalt tones, dashed lane lines, direction-change paint, curbs, sidewalk pavers, drains, and manhole covers.
- The 16x16 cat has two tail frames, a hop arc, dust particles, impact shakes, a golden shield aura, and a small death overlay.

## Additional obstacle and power-up ideas

These are designed extensions, not features in the current build.

### Obstacles

| Idea | Behavior |
| --- | --- |
| Aso (stray dog) | Patrols two tiles on a sidewalk. Contact ends the run. A fishball can distract it for one cycle. |
| Lubak / baha | Pothole or flooded tile. The next hop is delayed by 150 ms; it never deals damage. |
| Parked tricycle | Blocks two sidewalk tiles and forces a detour into the next lane. |
| Taho vendor | Crosses one sidewalk row on a timed loop. The cart is a moving wall. |
| Barricade and cones | Block one tile for a few seconds, then clear. Adds route changes without permanent dead ends. |
| Sparking wire | A sidewalk tile under a pole sparks on a one-second cycle. Contact while active ends the run. |

### Power-ups

| Idea | Behavior |
| --- | --- |
| Traffic enforcer whistle | Freezes every vehicle for four seconds. Rare; spawns after 40 rows. |
| Payong (umbrella) | Adds two shield charges and a visible canopy. Rare; spawns after 40 rows. |
| Tsinelas (slipper) | Doubles hop speed for six seconds. The input buffer still applies. |
| Halo-halo | Doubles all points for ten seconds. Pickups and distance both count. |
| Balut | Revives once at the crash tile with two seconds of invulnerability. Single use per run. |
| Turon | Attracts fishballs within two tiles for eight seconds. |
| Sampaguita garland | Calms stray dogs and clears one random sidewalk prop. |

Balance rules for any of these: do not spawn in the first 20 rows, cap one power-up effect at a time, and keep the effect shorter than the average time to the next sidewalk.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/game/engine.ts` | State machine, movement, scoring, collisions, camera, particles, run records |
| `src/game/world.ts` | Endless row generation, lanes, vehicles, props, pickups, safe-column routing |
| `src/render/renderer.ts` | Scene composition, row rendering, traffic, cat, wires, effects |
| `src/render/sprites.ts` | Procedural pixel art for the cat, vehicles, props, and pickups |
| `src/render/tiny-font.ts` | 3x5 bitmap font for shop signs and score popups |
| `src/ui/audio.ts` | Web Audio chiptune effects |
| `src/ui/storage.ts` | Local best score and sound preference |
| `src/main.ts` | Canvas bootstrap, HUD, screens, keyboard, swipe, pause, and animation loop |
| `src/styles.css` | Responsive frame, pixel panels, overlays, and controls |
| `tests/game.test.ts` | World invariants, district coverage, traffic spacing and wraps, scoring, pickups, collisions, shield stacks |

## Test and verify

```bash
npm test
npm run check
npm run build
```

The test suite covers:

- Sidewalk blocks always expose at least one fully clear column.
- All four districts appear as the world grows.
- Lanes contain spaced vehicles before and after repeated wrap cycles.
- Wrapped vehicles re-enter only from outside the stage.
- Traffic in rows ahead of the camera keeps moving.
- Pickups never overlap blocking props.
- Distance scoring, live best updates, and pause freezing.
- Fishball collection and bonus scoring.
- Game over, record reporting, and the transition after hit-stop.
- A shield stack absorbs one hit per charge; a hit at zero ends the run.

## Deploy to Vercel

The repository is a static Vite site. `vercel.json` pins the Vite framework, the build command, the `dist` output, and immutable font caching. No environment variables or server functions are required.

Dashboard flow:

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. Import the repository in Vercel.
3. Keep the detected Vite settings. Build runs `npm run build`; output is `dist`.
4. Deploy.

CLI flow:

```bash
npm install
npm test
npm run build
npx vercel --prod
```

High scores are local to each browser. Vercel serves only static files, so a new deployment does not migrate or merge player records.
