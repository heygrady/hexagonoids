# Encoding System Audit Report

Automated audit of `@heygrady/hexagonoids-environment` encoding pipeline after the v2 encoding redesign (orthographic projection, stateless velocities, 34-input layout).

## Critical Findings

### C1. Angular Velocity Not Remapped (y-up vs z-up)

**File:** `collectObservations.ts` — lines 258–268, 320–324, 344–346, 449–453
**Severity:** HIGH

All position vectors and tangent-plane basis vectors undergo a y↔z coordinate swap (engine y-up → projection z-up):

```ts
const shipY = shipCenter.z  // swap
const shipZ = shipCenter.y  // swap
const northY = basis.northZ // swap
const northZ = basis.northY // swap
```

But `angularVelocity` vectors are stored and consumed **without** the same remap:

```ts
rocks[index] = { avx: av.x, avy: av.y, avz: av.z }  // NO swap
```

Then velocity is dotted against the z-up basis:

```ts
const relVelRight = dvx * rightX + dvy * rightY + dvz * rightZ
```

This silently swaps the Y and Z contributions of the velocity vector in every projection — ship velocity encoding, relative rock velocity, and memory rock velocity.

**Fix:** Either remap AV to match (`avy = av.z, avz = av.y`) or eliminate the coordinate swap entirely.

### C2. `MAX_CLOSING_SPEED` Uses Slowest Rock, Not Fastest

**File:** `utils/constants.ts` — line 25
**Severity:** MEDIUM

```ts
export const MAX_CLOSING_SPEED = MAX_SPEED + ROCK_LARGE_SPEED
```

`ROCK_LARGE_SPEED` (0.0739 rad/s) is the **slowest** rock speed. `ROCK_SMALL_SPEED` (0.1201 rad/s) is the fastest. The true maximum closing speed is `MAX_SPEED + ROCK_SMALL_SPEED = 0.4343 rad/s`, not 0.3881. Fast small rocks approaching a max-speed ship produce `relVel / MAX_CLOSING_SPEED > 1`, which is silently clamped — losing gradient information in the NN input.

**Fix:** `MAX_CLOSING_SPEED = MAX_SPEED + ROCK_SMALL_SPEED`

### C3. Memory Rocks Use Different Proximity Scale

**File:** `collectObservations.ts` — lines 362, 460
**Severity:** MEDIUM

SOI rocks: `proximity = 1 - effectiveDist / sin(0.5027)` (denominator ≈ 0.479)
Memory rocks: `proximity = 1 - effectiveDist / sin(π/2)` (denominator = 1.0)

A memory rock at the same position as an SOI rock produces ~2x lower proximity. This creates an undocumented discontinuity in the NN input when a rock transitions from SOI-visible to memory-only. It may be intentional (fade memory contributions) but is not documented.

**Fix:** Either document the design intent or unify the denominator to `MAX_ORTHO_DISTANCE`.

---

## Unit Confusion

### U1. `UNIT_*_RADIUS` Are Angular Radians, `orthoDist` Is Sinusoidal

**File:** `collectObservations.ts` — lines 32–35, 163, 459
**Severity:** LOW (negligible at these angles)

```ts
const UNIT_SHIP_RADIUS = SHIP_RADIUS / RADIUS  // 0.022 radians
// subtracted from:
const orthoDist = sqrt(localX² + localY²)       // ≈ sin(θ)
```

`orthoDist` is a tangent-plane orthographic distance (= `sin(θ)` for angular distance θ). The radii are in angular radians (θ), not sin(θ). At these small angles (0.02–0.05 rad), the error is < 0.05%, so this is numerically negligible but conceptually inconsistent.

### U2. Engine Radii Have No Documented Unit

**File:** `hexagonoids-engine/constants.ts` — lines 87–91
**Severity:** LOW (informational)

`SHIP_RADIUS = 0.11` and `ROCK_*_RADIUS` have no unit annotation. The environment's `collectObservations.ts` retroactively interprets them as "world-unit arc length" by dividing by `RADIUS` to get "angular radians." This interpretation is undocumented at the source.

### U3. `SOI_ARC_DISTANCE` Derivation Has Unnecessary Degree Round-Trip

**File:** `utils/constants.ts` — lines 15–19
**Severity:** LOW (informational)

```ts
SOI_ARC_DISTANCE = ROCK_SPAWN_BORDER_HALF_WIDTH * DEG_TO_RAD * RADIUS
SOI_ANGULAR_RADIUS = SOI_ARC_DISTANCE / RADIUS  // = HALF_WIDTH * DEG_TO_RAD
```

The `* RADIUS / RADIUS` round-trip is a mathematical no-op. `SOI_ANGULAR_RADIUS` could be derived directly as `ROCK_SPAWN_BORDER_HALF_WIDTH * DEG_TO_RAD`.

### U4. `generateScenarios.ts` Multiplies Both Sides by RADIUS

**File:** `scenarios/generateScenarios.ts` — lines 65–66
**Severity:** LOW

```ts
const dist = Math.acos(dot) * RADIUS
if (dist <= SOI_ANGULAR_RADIUS * RADIUS) {
```

Both sides are multiplied by RADIUS unnecessarily. Equivalent to `Math.acos(dot) <= SOI_ANGULAR_RADIUS`. Could use `SOI_ARC_DISTANCE` on the right side directly, or drop `* RADIUS` from both sides.

### U5. `distanceTraveled` Uses Chord Distance, Not Arc Length

**Files:** All three simulation runners
**Severity:** LOW (documented approximation)

```ts
distanceTraveled += Math.sqrt(dx*dx + dy*dy + dz*dz) * RADIUS
```

Accumulates chord distances scaled by RADIUS, not true geodesic arc lengths. At 0.01 rad/tick the error is < 0.004%. The comment acknowledges this, but the metric name implies true path length.

### U6. `ROCK_SPAWN_RELEASE_PADDING` in Engine Has Unit Bug

**File:** `hexagonoids-engine/constants.ts` — line 175
**Severity:** MEDIUM (engine-side)

```ts
export const ROCK_SPAWN_RELEASE_PADDING = (ROCK_LARGE_RADIUS * 180) / Math.PI
```

Applies a radians-to-degrees conversion to `ROCK_LARGE_RADIUS`, but `ROCK_LARGE_RADIUS` (0.264) is in world units, not radians. Should be `(ROCK_LARGE_RADIUS / RADIUS) * 180 / Math.PI` to get degrees. Currently produces ~15° instead of ~3°.

---

## Dead Code

### D1. `SECTOR_COUNT` — Dead Internal Export

**File:** `utils/constants.ts` — line 22
**Exported:** `index.ts:82`

`SECTOR_COUNT = 8` has zero internal consumers. The identical concept is `CONE_COUNT = 8` in `encodingPresets.ts` (used throughout encoding). Additionally, `curriculumSnapshot.ts:13` and `runCurriculum.ts:20` each define local `const CONE_COUNT = 8` instead of importing from either source. The value 8 is defined in 4 independent places.

### D2. `sphericalBearing` — Dead Internal Export

**File:** `utils/sphericalBearing.ts` — line 8
**Exported:** `index.ts:86`

Takes lat/lng in degrees. Zero internal imports. The package now uses XYZ-based projection via `buildRockPerceptionPrecompute`. Relic of the lat/lng-based encoding.

### D3. `relativeBearing` — Dead Internal Export

**File:** `utils/sphericalBearing.ts` — line 39
**Exported:** `index.ts:86`

Zero internal imports. `sectorUtils.ts` uses `relativeBearing` as a parameter name, not an import.

### D4. `bearingToSector` — Dead Internal Export

**File:** `encoding/sectorUtils.ts` — line 8
**Exported:** `index.ts:28`

Zero internal imports. The encoding uses `findConeIndex()` (private function in `collectObservations.ts`). `bearingToSector` exists only as a public API surface for potential external consumers.

### D5. `consumeFrameEvents` — Dead Method on MetricsCollector

**File:** `evaluation/RawMetrics.ts` — lines 45, 136–144

Defined on `MetricsCollector`, accumulates `frameRocksDestroyed` and `frameDeaths` per tick, but **never called** by any simulation runner. The per-frame accumulators grow indefinitely and are never read.

### D6. `episodeReward` — Always Zero

**Files:** All three simulation runners + `aggregateMetrics.ts`

All runners pass `episodeReward: 0` to `getMetrics()`. `aggregateMetrics` sums these zeros. The field carries no information.

### D7. `refX` Dead Ternary

**File:** `collectObservations.ts` — line 63

```ts
const refX = Math.abs(center.y) > 0.99 ? 0 : 0  // BOTH branches are 0
```

Dead conditional — both branches return 0. Should be `const refX = 0` or the ternary should have a non-zero branch.

---

## Redundant / Unnecessary Parameters

### R1. `scanRocks` Takes 6 Basis Scalars That Are Already in `rockPerception`

**File:** `collectObservations.ts` — lines 327–357

```ts
function scanRocks(
  rockPerception: RockPerceptionPrecompute,
  shipAV: ...,
  forwardX, forwardY, forwardZ,  // already in rockPerception.forwardX/Y/Z
  rightX, rightY, rightZ,         // already in rockPerception.rightX/Y/Z
  lidar: ConeHit[]
)
```

The caller destructures these from `rockPerception` and passes them back in. `scanRocks` could read them from `rockPerception` directly, eliminating 6 redundant parameters.

### R2. `neatAgent` Memory Keys Inconsistent

**File:** `agents/neatAgent.ts` + `agents/types.ts`

- `MEMORY_ROCK_PERCEPTION` and `MEMORY_SEEN_ROCKS` have named constants in `types.ts`
- `observationBuffer` and `inputBuffer` are bare string keys — no named constants
- `memory.seenRocks = memory[MEMORY_SEEN_ROCKS]` is a self-assignment since `MEMORY_SEEN_ROCKS = 'seenRocks'`

### R3. `rockPerception` Buffer Never Written Back in `neatAgent`

**File:** `agents/neatAgent.ts` — lines 27–29, 58

When the simulation loop doesn't pre-populate `memory[MEMORY_ROCK_PERCEPTION]`, `collectObservations` rebuilds the precompute from scratch every tick. The result is never stored back, making the buffer hint useless in standalone agent usage.

---

## Maintenance Concerns

### M1. Coordinate Swap Not Documented in `buildRockPerceptionPrecompute`

**File:** `collectObservations.ts` — lines 215–223

The y↔z swap is applied to positions and basis vectors but has no comment in `buildRockPerceptionPrecompute`. The only comment explaining the swap is in `scanMemoryRocks` (line 417). The implicit coupling to `buildLocalBasisFromCenter` (which operates in y-up space) makes the coordinate convention invisible.

### M2. `yawToBearing` Inlined in 3 Simulation Runners

**Files:** `simulateGame.ts:122`, `simulateScenario.ts:129`, `simulateCurriculumScenario.ts:110`

All three runners compute `Math.PI / 2 + ship.yaw` directly instead of calling `yawToBearing(ship.yaw)`. If the bearing conversion ever changes, these sites won't benefit.

### M3. `INPUT_COUNT` Re-Export Creates Two Import Paths

**File:** `encodeGameState.ts` — line 15

`INPUT_COUNT` is imported from `encodingPresets.ts` for internal use AND re-exported. `HexagonoidsEnvironment.ts` imports directly from `encodingPresets.ts`. The barrel routes `INPUT_COUNT` through `encodeGameState.ts` but routes `CONE_COUNT`/`FEATURES_PER_CONE`/`GLOBAL_FEATURES` directly from `encodingPresets.ts`.

### M4. `const player = trackedPlayer` Pointless Alias

**File:** `curriculum/simulateCurriculumScenario.ts` — line 155

Direct alias with no transformation. Could use `trackedPlayer` directly.

---

## Priority Summary

| Priority | Finding | Impact |
|----------|---------|--------|
| HIGH | C1. AV not remapped y↔z | Velocity projections have swapped Y/Z — affects ship velocity encoding and all relative velocity features |
| MEDIUM | C2. MAX_CLOSING_SPEED uses slowest rock | Fast small rocks clip at 1.0, losing gradient information |
| MEDIUM | C3. Memory proximity scale mismatch | 2x discontinuity when rocks transition SOI→memory |
| MEDIUM | U6. ROCK_SPAWN_RELEASE_PADDING unit bug | Engine constant is 5x too large (engine-side fix) |
| LOW | D1–D7. Dead code | Public API surface bloat, dead computations |
| LOW | R1–R3. Redundant params | Code hygiene, unnecessary allocations |
| LOW | U1–U5. Minor unit issues | Negligible numerical impact, documentation gaps |
| LOW | M1–M4. Maintenance | Code clarity, duplication risk |
