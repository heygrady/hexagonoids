# Proposal: behavioral gate redesign

## Problem

The current behavioral gate system grew organically. The action diversity gate was added first as a single check on all 4 buttons. When it proved too blunt, standalone gates (turn, throttle, turnBias) were layered on top. The result is a system where:

1. **Actions are double-penalized.** Thrust appears in both the action diversity gate (as 1 of 4 geometric mean factors) and the standalone throttle gate. Turning appears in both the action diversity gate (left and right are 2 of 4 factors) and the standalone turn gate.

2. **The multiplicative interaction is opaque.** Four gates multiplied together create combined effects that don't match any single gate's floor. An agent that thrusts and fires but never turns gets: `actionGate(0.6) × turnGate(0.01) × throttleGate(1.0) × turnBiasGate(1.0) = 0.006×`. The 0.6 action floor suggests "mostly fine" but the product says "99.4% penalty."

3. **The action diversity gate conflates different concerns.** It uses a geometric mean of 4 saturation scores, which means any single zero-action nukes the whole gate. But the per-action saturation thresholds (low=0.1, high=0.9) are shared across all 4 actions, even though healthy thrust rates (~50%) are very different from healthy fire rates (~20-40%).

4. **Tuning is fragile.** Changing one gate's floor changes the effective floor of the product. There's no way to reason about the combined gate effect without multiplying all floors together manually.

## What the gates are actually policing

Each gate exists to catch a specific degenerate behavior observed during development:

| Degenerate behavior | What catches it today | What should catch it |
|---|---|---|
| **Never thrusts** — sits in place, maybe fires | actionGate (via geometric mean) + throttleGate | A thrust-specific check |
| **Always thrusts** — runs in a straight line | actionGate (high saturation penalty) + throttleGate | A thrust-specific check |
| **Never fires** — dodges but never shoots | actionGate (via geometric mean) | A fire-specific check |
| **Always fires** — fires every frame, wastes ammo | actionGate (high saturation penalty) | A fire-specific check |
| **Never turns** — flies straight, maybe fires | actionGate (left=0, right=0 → geomean=0) + turnGate | A turn-specific check |
| **Only turns one direction** — circles | turnBiasGate | Keep as-is |
| **Spins in place** — turns every frame, never moves | turnGate (high saturation) + actionGate | Turn-specific high check |

The real purpose: ensure the agent **pilots the ship in a way that looks intentional**. Not stuck, not spinning, not button-mashing, not locked into one pattern.

## Proposed redesign

Replace the 4 overlapping gates with 4 non-overlapping per-action gates, plus a pattern detector:

```ts
function calculateBehavioralGate(
  metrics: ActionFrames,
  config: BehavioralGateConfig
): number {
  // Per-action saturation gates — each polices one action independently
  const thrust = saturationGate(metrics.thrustFrames, metrics.aliveFrames, config.thrust)
  const fire   = saturationGate(metrics.fireFrames,   metrics.aliveFrames, config.fire)
  const turn   = saturationGate(turnFrames(metrics),   metrics.aliveFrames, config.turn)
  const bias   = turnBiasGate(metrics, config.turnBias)

  // Combine: geometric mean preserves the "all must be reasonable" intent
  // but each action is counted exactly once
  return Math.max((thrust * fire * turn * bias) ** 0.25, config.floor)
}
```

### Per-action gate config

Each action gets its own low/high/easing thresholds:

```ts
interface ActionGateConfig {
  low: number       // below this fraction → penalty (not enough)
  high: number      // above this fraction → penalty (too much)
  easing: GateEasing
  floor: number     // per-action minimum (softens the cliff)
}

interface BehavioralGateConfig {
  thrust: ActionGateConfig    // e.g. { low: 0.15, high: 0.85, easing: 'exp', floor: 0.3 }
  fire: ActionGateConfig      // e.g. { low: 0.05, high: 0.60, easing: 'exp', floor: 0.3 }
  turn: ActionGateConfig      // e.g. { low: 0.15, high: 0.90, easing: 'exp', floor: 0.1 }
  turnBias: TurnBiasConfig    // e.g. { max: 0.85, easing: 'exp', floor: 0.1 }
  floor: number               // combined gate floor (e.g. 0.05)
}
```

### What changes

| Current | Proposed | Why |
|---|---|---|
| `actionDiversityGate` (4-factor geomean) | Removed — absorbed into per-action gates | Eliminates double-counting |
| `turnGate` (standalone) | `turn` in per-action config | Now has its own low/high, not shared with thrust/fire |
| `throttleGate` (standalone) | `thrust` in per-action config | Same — own thresholds |
| `turnBiasGate` (standalone) | `turnBias` in per-action config | Structurally unchanged |
| 4 separate gate calls × `applyBehavioralGates` | 1 `calculateBehavioralGate` call | Single multiplication, one combined floor |

### Key design choices

**One geometric mean, not a product of 4 gates.** The geometric mean `(a × b × c × d)^0.25` is less punishing than a raw product `a × b × c × d` when one factor is low. With per-action floors of 0.3, the worst-case geometric mean is `(0.3)^1 = 0.3` (single floor), not `(0.3)^4 = 0.0081` (product of floors).

**Per-action thresholds.** Healthy thrust rate (~40-60%) is different from healthy fire rate (~15-40%). The current shared `actionLow=0.1, actionHigh=0.9` doesn't reflect this. Per-action thresholds let us tune each behavior independently.

**Per-action floors soften individual cliffs.** If the fire gate has floor=0.3 and the agent never fires, the fire contribution is 0.3 — low but not catastrophic. The geometric mean with the other actions (which may be healthy) keeps the combined gate above the "dead zone."

**One combined floor prevents total wipeout.** Even if all per-action gates hit their individual floors: `(0.3 × 0.3 × 0.1 × 0.1)^0.25 ≈ 0.19`. With a combined floor of 0.05, the minimum behavioral gate is 0.05× — low but still orders of magnitude above the current worst case of 0.6 × 0.01 × 0.20 × 1.0 = 0.0012×.

## Migration

This is a hexagonoids-environment change, not a neat-js core change. The gate config lives in `HexagonoidsEnvironmentConfig.gateConfig` and is applied in `calculateFitness.ts`.

Steps:
1. Add new `BehavioralGateConfig` type alongside existing `GateConfig`
2. Implement `calculateBehavioralGate` in `calculateFitness.ts`
3. Update `applyBehavioralGates` to use the new function
4. Update default config and default profile with tuned per-action thresholds
5. Update `inspect fitness` to display per-action gate values
6. Run `inspect fitness` with old and new configs, compare baselines

The old gate fields can be kept temporarily for backwards compatibility, but the new config should be the primary path.

## Tuning strategy

Use `inspect fitness` to establish baseline gate values for doNothing, random, and trained genomes:

1. **doNothing**: all per-action gates should hit their floors. Combined gate should be low (0.05–0.10).
2. **random**: all per-action gates should be near 1.0. Combined gate should be ~1.0.
3. **Trained genome (early)**: some gates near floor, others improving. Combined gate provides gradient.
4. **Trained genome (good)**: all gates above 0.8. Combined gate near 1.0.

The key metric: **is there a smooth gradient between "doing nothing" and "doing everything right"?** The current system has a cliff; the goal is a ramp.

## What this doesn't address

- **The 0.75 activation threshold** creating a dead zone at generation 0 (see [evaluation-pipeline.md](./evaluation-pipeline.md)). That's a separate issue in `decodeOutputs.ts`.
- **Per-episode vs aggregated gating.** The survival gate is still per-episode. This proposal only changes behavioral gates.
- **Engagement/exploration rewards.** Adding positive signal for seeking rocks, visiting new cells, etc. That's an additive reward component, not a multiplicative gate.
