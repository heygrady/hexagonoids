# inspect inputs

Analyzes the input encoding that feeds neural networks during evaluation. Runs scenarios with a baseline agent (random or doNothing) and collects statistics on every input channel across every frame.

## Usage

```sh
cd .worktrees/hexagonoids-lamarkian

# Quick check (20 scenarios, 30 ticks each)
node ./bin/run.js inspect inputs --scenariosPerRun 20 --scenarioMaxTicks 30

# Full run with verbose per-cone breakdown
node ./bin/run.js inspect inputs --verbose

# Use doNothing agent (zero-action baseline)
node ./bin/run.js inspect inputs --agent doNothing
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--scenariosPerRun <n>` | 100 | How many scenarios to sample from the bank |
| `--scenarioMaxTicks <n>` | 60 | Max ticks per scenario |
| `--seed <seed>` | `inspect-inputs-002` | RNG seed for scenario selection |
| `--agent <random\|doNothing>` | `random` | Which baseline agent drives the ship |
| `--dtMs <n>` | 33 | Tick duration in milliseconds |
| `--verbose` | false | Show per-cone stats, sample frames |

## What it reports

### Input vector layout (90 floats)

The encoding is defined in [`encodingPresets.ts`](../../../../hexagonoids-environment/src/encoding/encodingPresets.ts):

```
[0]      ship.velocityX          — tangent-plane right / MAX_SPEED           [-1, 1]
[1]      ship.velocityY          — tangent-plane forward / MAX_SPEED         [-1, 1]
[2..65]  8 cones × 2 rocks × 4 features:
           [base+0] proximity    — collision-adjusted, 1=touching, 0=bullet range, <0=far  [-1, 1]
           [base+1] bearing      — half-turns from nose, 0=ahead, ±1=behind               [-1, 1]
           [base+2] velocityX    — relative velocity right / MAX_CLOSING_SPEED             [-1, 1]
           [base+3] velocityY    — relative velocity forward / MAX_CLOSING_SPEED           [-1, 1]
[66..89] 6 bullet slots × 4 features (same layout as rocks)
```

The encoding logic is in [`encodeGameState.ts`](../../../../hexagonoids-environment/src/encoding/encodeGameState.ts), which calls [`collectObservations.ts`](../../../../hexagonoids-environment/src/encoding/collectObservations.ts).

### Report sections

**Ship Features** — per-channel min/max/mean/stddev/nonzero% for the 2 global ship velocity inputs.

**Rock LIDAR Aggregate** — same stats aggregated across all 16 rock slots (8 cones × 2 rocks). Grouped by feature type (proximity, bearing, velocityX, velocityY).

**Bullet Aggregate** — same stats across all 6 bullet slots.

**LIDAR Coverage** — how often the LIDAR system detects anything:
- `Zero-LIDAR frames`: frames where no cone had a detection (all proximity = 0)
- `Mean active cones`: average number of cones with at least one detection per frame
- `Max zero streak`: longest run of consecutive frames with no detections

**Proximity Distribution** — histogram of non-zero proximity values across [-1, 1]. Shows where rocks cluster relative to the ship.

**Bearing Distribution** — histogram of bearing values for detected rocks. Shows angular coverage around the ship.

### Verbose sections (`--verbose`)

**Per-Cone Activation** — bar chart showing what percentage of frames each cone detects something. Useful for spotting dead cones.

**Per-Cone Feature Stats** — full min/max/mean/std/nonzero% broken out per cone per rock slot per feature.

**Sample Frames** — first 5 frames with LIDAR activity, showing exact input values. Useful for sanity-checking individual frames.

## How the encoding works

The observation pipeline (in [`collectObservations.ts`](../../../../hexagonoids-environment/src/encoding/collectObservations.ts)) follows these steps:

1. **Ship velocity**: project the ship's angular velocity onto its local tangent plane (forward/right basis), normalize by `MAX_SPEED`.

2. **Rock LIDAR**: query rocks within the sphere of influence (SOI), project each onto the ship's tangent plane using orthographic projection, compute:
   - **proximity**: collision-adjusted distance. 1.0 = touching (accounting for ship + rock radii), 0.0 = bullet range, negative = beyond bullet range but within hemisphere.
   - **bearing**: `atan2(localX, localY) / π` — half-turns from the ship's nose. 0 = dead ahead, ±1 = directly behind.
   - **relative velocity**: `(rock_AV - ship_AV)` projected onto tangent plane, normalized by `MAX_CLOSING_SPEED`.

3. **Cone sorting**: the hemisphere is divided into 8 angular cones (45° each). Each cone holds the 2 closest rocks (by proximity, descending — closest first). The insertion sort in `insertConeHit` pushes farther rocks down.

4. **Memory rocks**: rocks previously seen but now outside the SOI are re-projected into empty cone slots. Destroyed or behind-hemisphere rocks are pruned from memory.

5. **Bullet slots**: the ship's own bullets (up to 6, oldest first) are projected similarly to rocks.

## What to look for

### Healthy encoding

- Ship velocities span [-1, 1] with nonzero% near 100% (the random agent is almost always moving).
- Rock proximity is non-negative (values ≤ 0 mean rocks are beyond bullet range — still valid signal but less useful).
- Bearing is spread across [-1, 1] — rocks approach from all directions.
- LIDAR saturation > 80% — most frames have at least one detection.
- All 8 cones show some activation (no dead cones).

### Problems to watch for

- **All zeros**: if rock proximity is always 0, the encoding isn't seeing any rocks — broken spatial queries or SOI radius.
- **Constant values**: if a feature has stddev ≈ 0 across all frames, it carries no discriminating signal. The network can't learn from it.
- **Negative proximity only**: rocks only appear beyond bullet range. The agent never gets close enough to shoot.
- **One-sided bearing**: rocks only appear on one side. Possible cone assignment bug.
- **Bullet slots always empty**: the agent never fires (expected for doNothing, suspicious for random).

### Known concerns

**90 inputs for 4 outputs.** The network takes 90 inputs and produces 4 boolean outputs (thrust, fire, left, right). With NEAT's minimal initial topology (no hidden nodes), the network starts as 90×4 = 360 direct connections. This is a large fan-in for initial evolution. The encoding was designed for richer networks (HyperNEAT, ES-HyperNEAT) where substrate geometry handles the mapping. Vanilla NEAT may struggle with this dimensionality early on.

**Proximity zero-crossing at bullet range.** The proximity function crosses zero at `BULLET_TRAVEL_DISTANCE × BULLET_RANGE_MULTIPLIER`. Rocks beyond this range get negative proximity. A sigmoid output won't distinguish between "far away" (-0.8) and "no rock" (0.0) without hidden layer processing, because sigmoid is monotonic and maps both near 0.5.

**Fixed threshold decoding.** Outputs are thresholded at 0.75 in [`decodeOutputs.ts`](../../../../hexagonoids-environment/src/encoding/decodeOutputs.ts). With Sigmoid activation and random initial weights centered around 0.5, most initial networks produce outputs below 0.75 — meaning they effectively do nothing. This is intentional (avoids hard-pegged buttons) but means evolution must first discover weight configurations that push outputs above 0.75 before any behavior emerges. This creates a fitness plateau at the start of evolution where most organisms score like doNothing.
