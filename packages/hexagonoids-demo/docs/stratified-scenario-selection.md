# Stratified Scenario Selection

Design notes for improving scenario bank coverage using multi-dimensional
stratified sampling over the input encoding space.

## Motivation

The current pipeline is strong at finding **bandpass scenarios** — situations
where roughly half the panel agents fail. This drives the ~50% scenario fitness
scores we observe during training. However, the selection is organic: whatever
emerges from real agent gameplay, filtered by panel disagreement.

The problem: there's no guarantee we cover the full **input space** the neural
network actually sees. Two scenarios might have very different game states but
produce nearly identical 58-dimensional input vectors (same cone occupancy, same
proximity pattern). Conversely, important cone configurations may be
underrepresented simply because no agent happened to die/kill in that situation.

**Goal:** Ensure the scenario bank covers all meaningful regions of the input
encoding space, so training signal reaches every part of the network.

## The Input Encoding Space

The neural network sees 58 inputs:

```
[0-1]    ship velocity (vX, vY)
[2-33]   8 cones × 4 features (proximity, bearing, velocityX, velocityY)
[34-57]  6 bullet slots × 4 features
```

The **8 cones** are the primary spatial perception. Each cone is either
**occupied** (nearest rock projected into that angular wedge) or **empty** (no
rock in that 45° slice within SOI). This binary pattern is the single most
important structural feature of any scenario — it determines which network
pathways activate.

### Cone Layout

Cones are numbered counterclockwise relative to the ship's facing direction.
`atan2(localX, localY)` maps to cone index via
`floor(((angle + π) / 2π) × 8) % 8`:

```
Cone 0: behind      (-180° ± 22.5°)
Cone 1: back-left   (-135° ± 22.5°)
Cone 2: left        ( -90° ± 22.5°)
Cone 3: front-left  ( -45° ± 22.5°)
Cone 4: ahead       (   0° ± 22.5°)
Cone 5: front-right (  45° ± 22.5°)
Cone 6: right       (  90° ± 22.5°)
Cone 7: back-right  ( 135° ± 22.5°)
```

Left-right mirror maps cones `1↔7, 2↔6, 3↔5` with `0, 4` as symmetry axes.

## Cone Occupancy Patterns → Necklace Classes

8 cones, each filled or empty = **256 raw bit patterns**. But the ship can be
facing any direction on the sphere; what matters is the **shape** of the
occupied-cone pattern, not which absolute cone index corresponds to "ahead."

**Rotational symmetry** (rotating the pattern by N cones) reduces 256 raw
patterns to **36 necklace equivalence classes**.

> Reflection (left-right mirror) would further reduce to 30 bracelet classes,
> but the agent has distinct left/right turn actions, so left-right mirrored
> scenarios are not functionally equivalent. **Use rotation only → 36 classes.**

Distribution by popcount (number of filled cones):

| Cones filled | Necklace classes | Notes |
|--------------|-----------------|-------|
| 0            | 1               | No rocks in SOI (degenerate) |
| 1            | 1               | Single rock, any direction |
| 2            | 4               | Two rocks, varying separation |
| 3            | 7               | Three rocks |
| 4            | 10              | Four rocks |
| 5            | 7               | Five rocks |
| 6            | 4               | Six rocks |
| 7            | 1               | Seven rocks |
| 8            | 1               | All cones filled (surrounded) |
| **Total**    | **36**          | |

### Computing the Canonical Necklace

```typescript
function canonicalNecklace(mask: number): number {
  let min = mask
  let rotated = mask
  for (let r = 1; r < 8; r++) {
    rotated = ((rotated << 1) | (rotated >> 7)) & 0xFF
    if (rotated < min) min = rotated
  }
  return min
}
```

### Necklace is a Bucketing Key, Not a Transform

The canonical necklace is used only for **selection bucketing**. The scenario
snapshot is never rotated or modified — it plays back with the original ship
orientation and rock positions. The encoding pipeline produces the exact same
raw 8-cone pattern it had at capture time (e.g., cones 3+4 filled, not "the
canonical 2-adjacent form").

This means: we organize by symmetry class to ensure structural coverage, but
every scenario retains full fidelity. The agent sees real cone indices, real
bearings, real proximities.

### Computing Cone Pattern from a Snapshot

Run the encoding pipeline on the restored snapshot and read cone occupancy:

```typescript
function coneOccupancyMask(inputs: number[]): number {
  let mask = 0
  for (let cone = 0; cone < 8; cone++) {
    const proximityIndex = 2 + cone * 4  // offset past ship velocity
    if (inputs[proximityIndex] !== 0) {   // 0 = empty (default from resetLidar)
      mask |= (1 << cone)
    }
  }
  return mask  // 0-255
}
```

Proximity scale: `+1` (on top of ship) → `0` (at bullet range) → `-1` (hemisphere
edge). Empty cones use the default value of `0` from `resetLidar`. Note that `0`
is also the bullet-range boundary, but a real rock landing exactly there is
vanishingly unlikely. Changing the empty sentinel to `-1` would be worse — it
would conflate "no rock" with "rock at hemisphere edge."

The cone pattern includes memory-filled cones. Memory rocks are part of the
encoded agent input and are part of the scenario's observable state. The pattern
reflects what the network actually sees.

## Rewind Depth for Kill Scenarios

The rewind moment is **the tick the scenario starts at** — this is the moment
the cone pattern is computed from. It's the situation that led the agent to
either die or get a kill.

**Crash scenarios:** 16 frames back works well for high-risk death situations.
The current `--rewind 32` ring buffer is sufficient.

**Kill scenarios:** The winning bullet must **not yet have been fired** at the
rewind point. Otherwise the scenario replays with the bullet already in flight,
which doesn't test whether the agent can find and execute the shot.

Bullet lifetime:
- `FIRE_COOLDOWN = 150ms`
- `BULLET_LIFETIME = FIRE_COOLDOWN × 6 = 900ms`
- At 33ms/tick: **~27 ticks** maximum bullet age

The ring buffer must look back **at least 28 ticks** past the kill event to
guarantee the bullet hasn't been fired. Current `--rewind 32` is sufficient for
quick kills but marginal for max-range shots. Consider `--rewind 36` to add
margin (1.3× bullet lifetime in ticks).

For the actual rewind selection: pick a frame where `snapshot.gameTime` is at
least `bulletFiredAt - 33` ms before the bullet's `firedAt` timestamp. This
ensures the scenario starts before the winning shot.

## Stratification Dimensions

### Primary: Necklace class (36 values)

The cone occupancy pattern compressed to its rotational equivalence class.

### Secondary: Rock count on screen (8 buckets)

Rock count is a natural proxy for wave progression:

| Wave | Rocks spawned | Typical rocks alive (with splits) |
|------|---------------|-----------------------------------|
| 0    | 4 large       | 4-12                              |
| 1    | 6 large       | 6-18                              |
| 2    | 8 large       | 8-24                              |
| 3    | 10 large      | 10-30                             |
| 4+   | 11 large      | 11-33                             |

Bucket into 8 levels by total rocks alive:
`[1-3, 4-6, 7-9, 10-12, 13-16, 17-20, 21-25, 26+]`

High rock counts naturally produce denser cone patterns. This dimension
captures game progression without explicitly tracking wave number.

### Tertiary: Capture type (kill vs crash)

Even split. Kill scenarios test offensive capability. Crash scenarios test
survival.

## Target Bank Composition

With `--final-count 1024` and 36 necklace classes:

```
1024 / 36 ≈ 28 scenarios per necklace class

Per class:
  14 crash scenarios
  14 kill scenarios
  Spread across rock-count buckets where possible
```

~28 scenarios per necklace class is a healthy sample size — enough to cover
variation in rock count, proximity distances, and approach angles within each
structural pattern.

### Allocation Strategy

1. **Even split by capture type**: half kill, half crash within each class
2. **Rock-count diversity**: within each (class, captureType) half, spread
   across rock-count buckets. With 14 slots and 8 buckets, aim for ~2 per
   bucket, backfill from populated buckets if gaps exist.
3. **Within-bucket ranking**: use interestingness score (panel disagreement)
4. **Redistribution**: if a necklace class has fewer candidates than its quota,
   redistribute slots proportionally to classes with surplus, preferring
   Hamming-distance-1 neighbors (one cone flipped).

### Bullet slot occupancy

Not stratified. The 6 bullet slots add another dimension but are less important
for structural coverage than cone patterns. Could be revisited later by
separating on bullet count (0, 1-2, 3+) if bullet-heavy scenarios prove
underrepresented.

## Relationship to Current Pipeline

The current pipeline stays mostly intact. Stratification replaces the final
trimming step (`trimFinalBank` in `dedupe.ts`):

```
Current:  generate → instant-death filter → panel → annotate → dedupe → trim by interestingness
Proposed: generate → instant-death filter → panel → annotate → dedupe → STRATIFIED SELECT
```

### What Changes

1. **Annotation gains cone metadata** — compute cone occupancy mask and
   necklace class from the snapshot (run `encodeGameState`, read cone
   proximities). Added to `ScenarioCandidate`.

2. **Final selection uses stratified sampling** — instead of top-N by
   interestingness, fill 36 necklace strata × 2 capture types, picking most
   interesting candidates per slot with rock-count diversity as a tiebreaker.

3. **Kill scenario rewind validation** — verify the winning bullet's `firedAt`
   is after the scenario start time. If not, select an earlier ring buffer
   frame.

### What Stays the Same

- Source genome discovery
- Candidate generation via gameplay (death/kill rewind capture)
- Instant-death filtering
- Panel selection and diversity scoring
- Failure signature annotation
- Deduplication by behavior cluster
- Interestingness scoring (still used as within-stratum ranking)

## Implementation Sketch

```typescript
interface StratifiedSelection {
  strata: Map<number, NecklaceStratum>  // canonical necklace → stratum
  selected: ScenarioCandidate[]
  coverage: {
    necklacesFilled: number       // out of 36
    totalSlotsFilled: number      // out of 1024
    perClassCounts: Map<number, number>
  }
}

interface NecklaceStratum {
  necklace: number                // canonical pattern (0-255)
  popcount: number                // number of filled cones
  orbitSize: number               // rotations in this class (1-8)
  kills: ScenarioCandidate[]      // selected kill scenarios
  crashes: ScenarioCandidate[]    // selected crash scenarios
  quota: number                   // target per capture type
}

function stratifiedSelect(
  candidates: ScenarioCandidate[],
  finalCount: number
): StratifiedSelection {
  const perClass = Math.floor(finalCount / 36)  // ~28
  const perType = Math.floor(perClass / 2)      // ~14

  // 1. Compute cone pattern + necklace class for each candidate
  // 2. Bucket into 36 necklace classes × 2 capture types
  // 3. Within each bucket, sub-sort by rock-count bucket for diversity
  // 4. Greedy fill: pick top-interestingness from each rock-count sub-bucket
  // 5. Redistribute surplus slots from underpopulated classes
  // 6. Return with coverage metrics
}
```

## Expected Outcomes

- **Better input space coverage**: every structural cone configuration the
  network might encounter has training scenarios (~28 each)
- **Maintained bandpass quality**: interestingness scoring still selects
  challenging scenarios within each stratum
- **Diagnostic value**: coverage metrics reveal which necklace classes lack
  candidates, guiding generation parameters
- **Stable 1024 bank size**: same final count, dramatically better distribution
- **7× sample depth per structural class**: ~28 per necklace vs ~4 per raw pattern
