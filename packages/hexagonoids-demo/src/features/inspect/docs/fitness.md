# inspect fitness

Runs the full fitness evaluation pipeline with baseline agents and optionally with saved genomes. Shows the per-component breakdown of fitness scoring so you can see exactly where fitness comes from and what's suppressing it.

## Usage

```sh
cd .worktrees/hexagonoids-lamarkian

# Basic run (doNothing + random baselines)
node ./bin/run.js inspect fitness

# Quick run with fewer scenarios
node ./bin/run.js inspect fitness --scenariosPerOrganism 20 --fullGameSeeds 2

# Evaluate a specific genome
node ./bin/run.js inspect fitness --genome .artifacts/lab/latest/best-NEAT.json --method NEAT

# Use a specific lab directory
node ./bin/run.js inspect fitness --lab .artifacts/lab/2026-03-14_experiment
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--scenariosPerOrganism <n>` | from profile (128) | Scenarios per evaluation |
| `--scenarioMaxTicks <n>` | from profile (64) | Max ticks per scenario |
| `--seed <seed>` | `inspect-fitness-001` | RNG seed |
| `--dtMs <n>` | 33 | Tick duration in ms |
| `--curriculum` | from profile | Enable curriculum scoring |
| `--curriculumCount <n>` | 32 | Number of curriculum micro-scenarios |
| `--maxTicks <n>` | from profile (2048) | Max ticks for full games |
| `--fullGameSeeds <n>` | from profile (2) | Number of full-game seeds |
| `--genome <path>` | none | Path to a saved genome JSON |
| `--lab <path>` | auto-discover | Lab directory to load genomes from |
| `--method <name>` | from profile (NEAT) | Algorithm for genome reconstruction |
| `--scenarioWeight <f>` | from profile (0.3) | Blend weight for scenarios |
| `--fullGameWeight <f>` | from profile (0.6) | Blend weight for full games |
| `--curriculumWeight <f>` | from profile (0.1) | Blend weight for curriculum |
| `--actionGateFloor <f>` | from profile | Override action gate floor |
| `--turnGateFloor <f>` | from profile | Override turn gate floor |
| `--turnBiasGateFloor <f>` | from profile | Override turn bias gate floor |

When no `--genome` or `--lab` is given, the script auto-discovers the most recent lab in `.artifacts/lab/` and loads the best genome plus ~5 sampled generations.

## What it reports

For each agent (doNothing, random, and any loaded genomes), the script prints:

### Scenario Fitness

The mean fitness across all scenario evaluations.

```
scenarioFitness:  0.2864

── Performance Components ──
perfScore (weighted sum):   0.5343
  rocksNorm:    0.5500  (w=0.9 → 0.4950)
  accuracyNorm: 0.3925  (w=0.1 → 0.0393)  raw=0.2036 target=0.4
```

- **perfScore**: `w_rocks × rocksNorm + w_accuracy × accuracyNorm` — the raw performance before gates.
- **rocksNorm**: `min(rocksDestroyed / possibleKills, 1)` — fraction of the physics-based kill budget used.
- **accuracyNorm**: `min(accuracy / targetAccuracy, 1)` — shooting accuracy relative to target.

### Gates (per-episode averages)

```
── Gates (multiplicative) ──
actionGate:     1.0000
turnGate:       0.9955
turnBiasGate:   1.0000
survivalGate:   0.6000
```

These are the average per-episode gate values. The survival gate is applied per-episode (it multiplies perfScore in `weightedFitnessSum`). The behavioral gates (action, turn, turnBias, throttle) are applied at the aggregated level after all episodes.

### Full Game Fitness

Same breakdown but for full-game evaluations (longer runs, no scenario snapshots).

### Curriculum Fitness

If enabled, shows kills-vs-total and average fitness across curriculum micro-scenarios.

### Blended Fitness

The final fitness calculation:

```
rawBlended = scenario × sw + fullGame × fw + curriculum × cw
gatedFitness = rawBlended × actionGate(agg) × turnGate(agg) × throttleGate(agg) × turnBiasGate(agg)
```

The `(agg)` suffix means these gates are computed on aggregated frame counts across all episodes (scenarios + full games + curriculum), not averaged per-episode.

### Comparison Table

When multiple agents are evaluated, a side-by-side table shows all metrics.

## How fitness is calculated

The full pipeline is in [`calculateFitness.ts`](../../../../hexagonoids-environment/src/evaluation/calculateFitness.ts).

### Step 1: Raw metrics collection

Each episode (scenario or full game) produces [`RawMetrics`](../../../../hexagonoids-environment/src/evaluation/RawMetrics.ts):

```ts
interface RawMetrics {
  rocksDestroyed: number    // rocks killed by this agent's bullets
  shotsFired: number        // total bullets fired
  shotsHit: number          // bullets that hit rocks
  accuracy: number          // shotsHit / shotsFired (0 if no shots)
  deaths: number            // times the ship died
  aliveFrames: number       // ticks where ship was alive
  thrustFrames: number      // alive ticks where thrust was pressed
  fireFrames: number        // alive ticks where fire was pressed
  leftFrames: number        // alive ticks where left was pressed
  rightFrames: number       // alive ticks where right was pressed
  uniqueRocksSeen: number   // distinct rock IDs observed in SOI
  elapsedTicks: number      // total ticks elapsed
  // ... plus score, livesRemaining, distanceTraveled, etc.
}
```

### Step 2: Per-episode scoring (`weightedFitnessSum`)

```
possibleKills = min(floor(elapsedTicks / killCycleTicks), uniqueRocksSeen)
rocksNorm     = clamp(rocksDestroyed / possibleKills, 0, 1)
accuracyNorm  = clamp(accuracy / targetAccuracy, 0, 1)
survivalGate  = max(clamp(1 - deaths / possibleDeaths, 0, 1), survivalGateFloor)
perfScore     = w_rocks × rocksNorm + w_accuracy × accuracyNorm
episodeFitness = clamp(perfScore × survivalGate, 0, 1)
```

**Kill cycle** (`computeKillCycleTicks`): the minimum time to complete one kill — fire cooldown + 180° turn + accelerate to SOI edge. At dtMs=33 this is ~48 ticks (~1.6s). This caps the rock denominator so short scenarios don't penalize agents for not killing rocks they couldn't physically reach.

**Possible deaths** (`computePossibleDeaths`): maximum deaths possible given elapsed ticks and the death cycle (1000ms wait + 2000ms grace = ~91 ticks per death). First death is immediate, subsequent deaths require a full cycle.

### Step 3: Blending

The default profile blends three evaluation modes:

| Mode | Weight | Description |
|------|--------|-------------|
| Scenario | 0.30 | Short focused encounters from the scenario bank |
| Full game | 0.60 | Long games from scratch with wave spawning |
| Curriculum | 0.10 | Micro-scenarios with 1 rock each (on/off) |

```
rawBlended = scenarioWeight × meanScenarioFitness
           + fullGameWeight × meanFullGameFitness
           + curriculumWeight × meanCurriculumFitness
```

### Step 4: Behavioral gates (`applyBehavioralGates`)

Applied to the blended fitness using **aggregated** frame counts from all episodes:

```
gatedFitness = rawBlended × actionGate × turnGate × throttleGate × turnBiasGate
```

Each gate is computed from the ratio of action frames to alive frames:

**Action diversity gate** — geometric mean of 4 saturation scores (thrust, fire, left, right). Each score uses an easing curve: ramps up from floor when usage is below `actionLow`, ramps down when above `actionHigh`. A single permanently-pressed button drives the geometric mean toward 0.

**Turn gate** — saturation score on combined turn frames `(left + right) / alive`. Agents that never turn get gated to `turnGateFloor` (0.01).

**Throttle gate** — saturation score on thrust frames. Agents that never thrust get gated to `throttleGateFloor` (0.01).

**Turn bias gate** — penalizes agents that only turn one direction. `bias = max(left, right) / (left + right)`. If bias exceeds `turnBiasMax`, eases toward `turnBiasGateFloor`.

### Default profile gate config

From [`default.ts`](../../profiles/default.ts):

```ts
gateConfig: {
  actionGateFloor: 0.6,     // even zero-action agents get 60% of action gate
  actionLow: 0.1,           // below 10% usage: ramp up
  actionHigh: 0.9,          // above 90% usage: ramp down
  actionEasing: 'exp',
  turnGateFloor: 0.01,      // no turning = 1% fitness
  turnLow: 0.1,
  turnHigh: 0.75,
  turnEasing: 'exp',
  throttleGateFloor: 0.2,   // no thrust = 20% fitness
  throttleLow: 0.1,
  throttleHigh: 0.9,
  throttleEasing: 'exp',
  turnBiasGateFloor: 0.01,
  turnBiasMax: 0.85,
  turnBiasEasing: 'exp',
  survivalGateFloor: 0,     // death fully penalized
}
```

## How to interpret the output

### Reading the baselines

The **doNothing** agent establishes the minimum. It should score near zero after gating because it never turns or thrusts. Key values to check:
- `turnGate` should be at its floor (0.01) — no turning at all
- `throttleGate` should be at its floor (0.20) — no thrusting
- `actionGate` should be at its floor (0.60) — no actions
- `gatedFitness` should be very low (0.0000 or near it)

The **random** agent establishes the "accidental success" ceiling. It presses buttons randomly so all gates should be near 1.0. Its performance score comes from lucky shots. Typical values:
- `gatedFitness` in the range 0.3–0.6
- `rocksNorm` around 0.3–0.7 (random firing hits some rocks)
- `accuracy` around 0.15–0.25 (random shooting, ~1 in 5 hits)

### Diagnosing low fitness

Work through the multiplication chain from right to left:

1. **gatedFitness ≈ 0?** Check which gate is crushing it. `turnGate=0.01` means the agent never turns. `actionGate=0.60` means no actions at all (doNothing behavior).

2. **rawBlended low but gates are fine?** The performance score itself is low. Check `rocksNorm` and `accuracyNorm` — if both are near zero, the agent isn't killing rocks or hitting shots.

3. **perfScore decent but fitness low?** The `survivalGate` is killing it. The agent dies too much, reducing the per-episode survival multiplier.

4. **Scenario fitness fine but fullGame fitness zero?** Short scenarios may be easier. Full games have wave spawning, more rocks, and longer time horizons. The agent may not generalize.

### Comparing a trained genome to baselines

A genome that scores _below_ random is broken. Check:
- Is the genome being loaded with the correct method? (`--method NEAT` vs `HyperNEAT`)
- Are the outputs reasonable? (Would need separate executor inspection)
- Is the genome from an early generation? (gen-0 genomes are near-random)

A genome scoring between doNothing and random suggests the network has learned to do _something_ but is stuck in a local minimum (e.g., always thrusting but never shooting).

## Known concerns

**Behavioral gates multiply, creating steep cliffs.** Four multiplicative gates mean that failing any single gate can destroy fitness. An agent with perfect rock destruction but 0% turning gets: `perfScore × 1.0 × 0.01 × 0.20 × 1.0 = 0.002 × perfScore`. The gates are intentional — they prevent degenerate strategies — but the multiplicative interaction creates a narrow "viable corridor" that initial random networks must discover before evolution can optimize performance. See [evaluation-pipeline.md](./evaluation-pipeline.md) for a deeper analysis.

**Per-episode survival gate vs aggregated behavioral gates.** The survival gate is applied per-episode in `weightedFitnessSum`, while behavioral gates are applied once on aggregated frames in `applyBehavioralGates`. This asymmetry means a single catastrophic episode (many deaths) can tank scenario fitness even if behavioral gates are fine. Whether this is desirable depends on the scenario design.

**Kill cycle denominator floors at 1.** `computePossibleKills` returns `max(1, ...)`. For very short scenarios (< 48 ticks), possibleKills = 1. If the agent kills 0 rocks, rocksNorm = 0. If it kills 1, rocksNorm = 1.0. There's no gradient between 0 and 1 for short scenarios — it's binary.
