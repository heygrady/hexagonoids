# Scenario Replay: Stratified Sampling & Ship Jitter

Design notes for two complementary improvements to scenario-based training:
1. **Multi-dimensional stratified sampling** — ensure each organism's scenario
   subset covers the full input space
2. **Ship jitter** — perturb the ship's yaw and speed so each replay looks
   slightly different to the agent while rock physics stay unchanged

## Problem: Sampling

The current `stratifiedSample` groups scenarios by `failureSignature` only
(a binary string like `"0110011100110"` indicating which panel agents failed).
This ensures the organism faces diverse failure patterns but ignores two
critical structural dimensions:

- **Necklace class** (36 values) — the rotational equivalence class of the
  8-cone occupancy pattern. This determines which network pathways activate.
- **Rock count** (8 buckets) — proxy for wave progression and game density.

When selecting 64 scenarios from a 1024-scenario bank, pure failure-signature
stratification can over-represent popular necklace classes (e.g., 3-4 cones
filled) and under-represent rare ones (0, 7, 8 cones filled). The agent gets
uneven training signal across the input space.

**Goal:** Each organism's 64-scenario sample covers all 36 necklace classes,
both capture types, diverse rock counts, and diverse failure signatures —
with minimal hot-loop overhead.

## Problem: Deterministic Replay

Scenarios replay identically every time: same snapshot → same 58-float input
vector at tick 0. With 1024 fixed scenarios evaluated across generations, an
agent can memorize specific input→output mappings instead of learning general
responses to structural situations.

**Goal:** Each replay should look slightly different to the agent while
preserving the scenario's structural character (same rocks, same positions,
same physics). The agent must learn the *class* of situation, not the
specific instance.

## Ship Jitter (Recommended)

Perturb the **ship's yaw** and **ship's speed** after restoring the snapshot,
before the agent loop begins. The rocks stay exactly where they are — only
the ship's perception changes.

### Why Ship Jitter

The encoding is **ship-relative**: cone bearings are measured from the ship's
heading, proximity is distance from the ship. Shifting the ship's yaw by a
few degrees changes:
- Which cone each rock falls into (for rocks near boundaries)
- The exact bearing value within each cone
- The velocity decomposition (vX/vY relative to new heading)

Meanwhile rock positions, trajectories, and collision geometry are unchanged.
The scenario's difficulty is preserved — the agent just sees it from a
slightly different angle, like turning your head 3° before assessing the
situation.

### Magnitude

**Yaw jitter:** ±1–5° (±0.017–0.087 radians). Each cone spans 45°, so
±5° shifts boundary rocks ~11% of a cone width. Most rocks stay in the same
cone; rocks near boundaries may flip.

**Speed jitter:** ±1–3% of current angular velocity magnitude. Changes the
ship velocity inputs (inputs[0], inputs[1]) and relative closing speeds.
The ship's trajectory diverges slightly over the scenario's 32-tick horizon
but not enough to change the fundamental encounter.

### Implementation

In `simulateScenario`, after `restoreSnapshot` and before the agent loop:

```typescript
// Derive per-scenario jitter from seed
const jitterRng = createRNG(`${seed}:jitter:${scenario.id}`)

// Yaw jitter: uniform ±maxYawJitter
const yawJitter = (jitterRng.gen() * 2 - 1) * maxYawJitter
ship.yaw += yawJitter

// Speed jitter: uniform ±maxSpeedJitter fraction
const speedFactor = 1 + (jitterRng.gen() * 2 - 1) * maxSpeedJitter
ship.angularVelocity.scaleInPlace(speedFactor)
```

The jitter RNG is seeded with `${seed}:jitter:${scenario.id}`, so:
- Different organisms (different `seed`) get different jitter per scenario
- Same organism + same seed = deterministic (reproducible fitness)
- Different scenarios get independent jitter values

### Configuration

```typescript
// In SimulationConfig
scenarioJitterYaw?: number    // max yaw offset in radians (default: 0)
scenarioJitterSpeed?: number  // max speed scale fraction (default: 0)
```

Recommended defaults for training: `scenarioJitterYaw: 0.05` (~3°),
`scenarioJitterSpeed: 0.02` (±2%).

### Why Not Other Jitter Approaches

**Temporal pre-roll** (run N ticks before agent starts): Problematic for short
scenarios. With `scenarioMaxTicks: 32`, even 4 pre-roll ticks consume 12.5%
of the evaluation budget. The ship drifts during pre-roll, which can put it in
a position it would never naturally reach. Ship jitter achieves the same
perceptual variation without consuming ticks.

**Rock velocity perturbation**: Changes difficulty unpredictably. Faster rocks
are harder to dodge. Ship jitter only changes the ship's perspective, not
the physical challenge.

**Input encoding noise**: Doesn't change trajectories. The agent still faces
the same sequence of states, just blurred. Ship jitter produces genuinely
different gameplay because the agent starts with a different heading and
makes different decisions.

**Precision recovery**: ±0.00005 jitter — too subtle to matter.

## Multi-Dimensional Stratified Sampling

### Stratification Dimensions

Three dimensions, in priority order:

1. **Necklace class** (36 values) — primary structural coverage
2. **Failure signature** (~10–20 unique strings) — panel disagreement coverage
3. **Rock count bucket** (8 values) + **capture type** (kill/death) — secondary
   diversity within each stratum

### Metadata on ScenarioSnapshot

Add optional fields computed at scenario generation time:

```typescript
// In ScenarioSnapshot (environment package)
necklace?: number     // canonical necklace class (0-255)
rockCount?: number    // total rocks in snapshot
```

These are computed by the scenario pipeline (`attachConeMetadata` already
computes `necklace`; `rockCount` is just `snapshot.rocks.length`) and
persisted through the codec. At training load time, the metadata is already
on the snapshot — no recomputation needed.

### Algorithm: Interleaved Round-Robin

Selecting `count` scenarios from `bank` (e.g., 64 from 1024):

**Phase 1 — Build strata (once at load time):**

```typescript
interface StratifiedIndex {
  // Primary: necklace class → scenarios
  byNecklace: Map<number, ScenarioSnapshot[]>
  // Secondary: failure signature → scenarios
  bySignature: Map<string, ScenarioSnapshot[]>
  // Composite: (necklace, signature) → scenarios
  byComposite: Map<string, ScenarioSnapshot[]>
}
```

Build the index once when the scenario bank is loaded. This is O(N) and
happens once per training run.

**Phase 2 — Sample (per organism):**

```
1. Compute per-necklace quotas:
   base = floor(count / filledNecklaceCount)    // e.g., 64/35 ≈ 1
   remainder = count - base * filledNecklaceCount  // e.g., 64 - 35 = 29

2. For each necklace class with scenarios:
   - Shuffle its scenarios (Fisher-Yates with organism's RNG)
   - Take `base` scenarios (guaranteed)
   - Mark as eligible for remainder

3. Distribute remainder:
   - Sort necklace classes by size (largest first)
   - Round-robin: take 1 more from each until remainder exhausted
   - Within each class, prefer alternating captureType and varying
     failure signatures (pick from least-represented signature so far)

4. Result: `count` scenarios covering all populated necklace classes
```

This is O(count + classes) per organism — fast enough for the hot loop.

### Why Not Just Composite Keys?

With 36 necklaces × 20 signatures × 8 rock buckets = 5,760 potential cells.
Most are empty. A single composite key produces too many tiny groups for
meaningful round-robin with only 64 samples.

The interleaved approach uses necklace as primary (guaranteed coverage) and
failure signature as secondary (diversity within each necklace allocation).
Rock count and capture type are tertiary tiebreakers when choosing among
candidates within a necklace class.

### Pre-Built Index

The `StratifiedIndex` is built once and stored alongside the scenario bank
in the `HexagonoidsEnvironment` instance:

```typescript
// In HexagonoidsEnvironment constructor
if (this.config.scenarioBank != null) {
  this.scenarioIndex = buildStratifiedIndex(this.config.scenarioBank)
}
```

The `stratifiedSample` function receives the pre-built index instead of
doing per-call grouping.

## Codec Changes

### ScenarioSnapshot additions

```typescript
export interface ScenarioSnapshot {
  // ... existing fields ...
  necklace?: number     // canonical cone occupancy necklace class
  rockCount?: number    // total rocks in snapshot
}
```

### Compact codec v5

Add `necklace` and `rockCount` to the compact tuple after `captureType`:

```
[id, difficulty, gameTime, wave, ship, player, rocks, bullets,
 failureSignature?, captureType?, necklace?, rockCount?]
```

Decode: if `record.length > 10`, read necklace and rockCount from positions
10 and 11. Backward compatible — v4 records lack these fields and decode
with `necklace: undefined`.

Encode: always emit v5 when necklace/rockCount are present.

## Implementation Plan

### Changes Required

| Package | File | Change |
|---------|------|--------|
| environment | `scenarios/types.ts` | Add `necklace?`, `rockCount?` to `ScenarioSnapshot` |
| environment | `scenarios/codec.ts` | v5 encode/decode with necklace + rockCount |
| environment | `scenarios/stratifiedSample.ts` | New multi-dimensional algorithm + `StratifiedIndex` |
| environment | `HexagonoidsEnvironmentConfig.ts` | Add `scenarioJitterYaw`, `scenarioJitterSpeed` to `SimulationConfig` |
| environment | `HexagonoidsEnvironment.ts` | Build index at construction; pass jitter config |
| environment | `scenarios/simulateScenario.ts` | Apply ship jitter after restore |
| demo | `scenarios/stratification.ts` | Persist `rockCount` alongside cone metadata |
| demo | `scenarios/output.ts` | Include rockCount in report |

### Ship Jitter Detail

In `simulateScenario.ts`, after line 43 (`restoreSnapshot`):

```typescript
// Apply ship jitter if configured
const jitterYaw = config.scenarioJitterYaw ?? 0
const jitterSpeed = config.scenarioJitterSpeed ?? 0

if (jitterYaw > 0 || jitterSpeed > 0) {
  const jitterRng = createRNG(`${seed}:jitter:${scenario.id}`)
  const ship = state.ships.values().next().value
  if (ship != null) {
    if (jitterYaw > 0) {
      ship.yaw += (jitterRng.gen() * 2 - 1) * jitterYaw
    }
    if (jitterSpeed > 0) {
      const factor = 1 + (jitterRng.gen() * 2 - 1) * jitterSpeed
      ship.angularVelocity.scaleInPlace(factor)
    }
  }
}
```

### Stratified Index Detail

```typescript
export interface StratifiedIndex {
  byNecklace: Map<number, ScenarioSnapshot[]>
  necklaceOrder: number[]  // sorted necklace classes with scenarios
}

export function buildStratifiedIndex(
  bank: ScenarioSnapshot[]
): StratifiedIndex {
  const byNecklace = new Map<number, ScenarioSnapshot[]>()
  for (const s of bank) {
    const key = s.necklace ?? -1
    let group = byNecklace.get(key)
    if (group == null) {
      group = []
      byNecklace.set(key, group)
    }
    group.push(s)
  }
  const necklaceOrder = [...byNecklace.keys()].sort((a, b) => a - b)
  return { byNecklace, necklaceOrder }
}

export function stratifiedSample(
  index: StratifiedIndex,
  count: number,
  rng: RNG
): ScenarioSnapshot[] {
  const { byNecklace, necklaceOrder } = index
  const classes = necklaceOrder.length
  if (classes === 0) return []

  const base = Math.floor(count / classes)
  let remainder = count - base * classes

  const result: ScenarioSnapshot[] = []
  const signatureCounts = new Map<string, number>()

  for (const necklace of necklaceOrder) {
    const group = byNecklace.get(necklace)!
    const shuffled = fisherYatesSample(group, group.length, rng)

    // Sort by least-represented failure signature for diversity
    const sorted = sortBySignatureDiversity(shuffled, signatureCounts)

    const take = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder--

    for (let i = 0; i < Math.min(take, sorted.length); i++) {
      const s = sorted[i]!
      result.push(s)
      const sig = s.failureSignature ?? 'none'
      signatureCounts.set(sig, (signatureCounts.get(sig) ?? 0) + 1)
    }
  }

  // Backfill if some classes had fewer than quota
  if (result.length < count) {
    const used = new Set(result)
    const remaining = []
    for (const group of byNecklace.values()) {
      for (const s of group) {
        if (!used.has(s)) remaining.push(s)
      }
    }
    const backfill = fisherYatesSample(remaining, count - result.length, rng)
    result.push(...backfill)
  }

  return result
}
```

### Within-Class Diversity Heuristic

`sortBySignatureDiversity` picks scenarios that maximize failure signature
coverage globally. For each candidate, score = `1 / (1 + signatureCounts[sig])`
(prefer under-represented signatures). Among equal-signature candidates,
alternate capture type (kill/death) and vary rock count.

This is a lightweight greedy heuristic — no optimization loop, just a stable
sort with diversity weights. O(N log N) per necklace class, but each class
has ~28 scenarios on average, so sorting is trivial.

## Expected Impact

### Sampling

With 64 scenarios from 1024 across 35 populated necklace classes:
- **~2 scenarios per necklace class** (vs. current: random, possibly 0-5)
- All populated classes guaranteed at least 1 representative
- Failure signatures spread across selections (no signature dominates)
- Each organism sees a different random subset but with the same structural
  coverage guarantees

### Ship Jitter

With ±3° yaw and ±2% speed:
- Bearing values shift by ~0.05 radians (meaningful in the encoding)
- ~5% of boundary rocks flip between adjacent cones
- Velocity inputs shift by ±2% — different relative closing speeds
- The agent must learn "rocks approaching from general front-left" rather than
  "rocks at bearing exactly 0.3456 in cone 3"
- Necklace class preserved ~95% of the time (most rocks well inside cones)
- Zero tick cost — jitter is applied to initial state, no extra simulation

### Combined Effect

Stratified sampling ensures the organism's scenario subset covers the full
input space. Ship jitter ensures each scenario within that subset presents a
slightly different version of the same structural challenge. Together, they
force the network to learn *general* cone-pattern responses rather than
memorizing specific input vectors.
