# Hexagonoids Reward Function: Current State and Recommendations

## Current Reward Configuration

```typescript
// DEFAULT_REWARD_CONFIG in simulateGame.ts
{
  survivalReward: 0,    // nothing per tick alive
  scoreScale: 0,        // engine score ignored
  shotPenalty: 0,       // no penalty for shooting
  deathPenalty: -1,     // -1 per death
  waveBonus: 0,         // no bonus for clearing waves
  rockReward: 1,        // +1 per rock destroyed
}
```

### The Problem: 97.9% Zero Signal

From `yarn demo inspect rewards`:

```
=== Reward Distribution (11805 ticks) ===
  reward=0:   11553 (97.9%)
  reward>0:   224 (1.9%)   mean=1.01
  reward<0:   28 (0.2%)    mean=-1.00
  above threshold: 252 (2.1%)
```

The RL agent sees **zero reward on 97.9% of ticks**. It only learns anything on the 2.1% of ticks where a kill or death occurs. This makes credit assignment nearly impossible -- the agent can't connect the 50-tick maneuver-aim-fire sequence to the eventual +1 kill reward.

### Why This Matters for AC/QL-Lamarckian

The rollout segment system triggers training on:
1. `|reward| > threshold (0.1)` -- reward events
2. `isInteresting === true` -- rock destroyed or death
3. Episode termination

With 97.9% zero-reward ticks, most rollout segments contain long runs of zero reward with a single +1 or -1 at the boundary. The n-step return computation collapses to approximately `gamma^n * reward_at_boundary`, giving the agent almost no learning signal for the actions in the middle of the segment.

## What's Wrong: Diagnosis

### 1. Scale is not the primary problem

Increasing `rockReward` from 1 to 200 would make kill events 200x larger. But:
- The advantage estimate also scales 200x
- Policy gradients scale 200x
- This is exactly what causes the "mass extinction" at higher learning rates
- The underlying sparsity problem (97.9% zeros) remains unchanged

### 2. Density is the problem

The agent needs **frequent, small signals** that indicate progress toward goals. Currently the only signals are binary: killed-something (+1) or died (-1). Everything in between -- maneuvering, aiming, approaching, dodging -- is invisible.

### 3. Kill/death ratio is asymmetric

224 kills vs 28 deaths means the positive signal is 8x more frequent than the negative signal. This is actually reasonable, but the death penalty being equal magnitude to the kill reward (-1 vs +1) means the agent doesn't sufficiently value survival.

## Recommended Changes

### Tier 1: Quick Wins (Configuration Changes Only)

These changes modify `DEFAULT_REWARD_CONFIG` values. No code changes needed.

#### A. Add survival reward (dense signal)

```typescript
survivalReward: 0.01   // +0.01 per tick alive
```

Over a 60-tick scenario, this adds +0.6 total. Over 2000 ticks, +20. This gives the agent a small but continuous signal that being alive is good. The magnitude is intentionally small relative to kills (+1) so it doesn't dominate.

**Literature support**: Small per-step survival bonuses are standard in Atari RL. They convert the sparse problem into a dense one. The agent learns "stay alive" as a baseline, then "kill rocks" as the high-value strategy.

**Risk**: Agent could learn to hide/dodge without engaging. Mitigated by the NEAT fitness function (which gates on engagement and action diversity) providing the selection signal.

#### B. Asymmetric death penalty

```typescript
deathPenalty: -0.5     // -0.5 per death (down from -1)
```

Deaths should hurt, but not as much as a kill helps. Reasoning:
- A kill is something the agent actively caused (causal attribution is clear)
- A death is often the result of a long chain of positioning failures (attribution is diffuse)
- Overly harsh death penalties teach the agent to be timid, not skilled
- The NEAT fitness function already has a strong survival gate that handles selection for survival

#### C. Small shot penalty (anti-spam)

```typescript
shotPenalty: 0.001     // -0.001 per bullet fired
```

Prevents continuous fire spam. Over 2000 ticks of max fire rate (~1 bullet/3 ticks = ~667 bullets), this costs -0.67 total. Small enough to not suppress shooting, large enough to break the "always fire" degenerate strategy.

**Proposed Tier 1 config**:
```typescript
{
  survivalReward: 0.01,
  scoreScale: 0,
  shotPenalty: 0.001,
  deathPenalty: -0.5,
  waveBonus: 0,
  rockReward: 1,
}
```

Expected reward distribution change:
- `reward=0` drops from 97.9% to ~0% (every alive tick now has signal)
- `reward>0` becomes dominant (small survival + occasional kills)
- Signal-to-noise ratio for kill events: 1.0 vs 0.01 = 100:1 (easily distinguishable)

### Tier 2: Moderate Changes (Small Code Additions)

#### D. Engagement proximity reward

Add a small reward based on distance to nearest asteroid. This is a form of **potential-based reward shaping** which is provably policy-invariant.

```typescript
// In onAfterTick, after existing reward computation:
if (deltas.shipAlive && deltas.nearestAsteroidDistance != null) {
  // Closer = higher reward, max at contact distance
  const proximityNorm = 1 - Math.min(deltas.nearestAsteroidDistance / maxRange, 1)
  reward += 0.005 * proximityNorm
}
```

This gives ~0.005 per tick when near asteroids, ~0 when far away. Encourages engagement without being large enough to dominate.

**Requires**: Exposing `nearestAsteroidDistance` in `TickDeltas`. The spatial query infrastructure already exists in the environment.

#### E. Accuracy bonus on kill

```typescript
// When a rock is destroyed, bonus for not having wasted shots
if (deltas.rocksDestroyed > 0 && deltas.accuracy > 0) {
  reward += 0.2 * Math.min(deltas.accuracy / 0.3, 1)  // max +0.2 at 30%+ accuracy
}
```

This rewards efficient killing, not just volume. Aligned with the fitness function's accuracy component.

#### F. Wave completion bonus

```typescript
waveBonus: 0.5    // +0.5 when wave changes
```

Signals that clearing all asteroids is a milestone. Less than a single kill reward, but notable.

### Tier 3: Architectural (Future Work)

#### G. Potential-based reward shaping (proper PBRS)

Implement a full potential function:

```typescript
function potential(state: GameState): number {
  const asteroidCount = state.rocks.size
  const nearestDist = computeNearestAsteroidDistance(state)
  const clearance = computeLocalClearance(state)

  return (
    -0.1 * asteroidCount +     // fewer asteroids = higher potential
    -0.01 * nearestDist +       // closer to targets = higher potential
    +0.005 * clearance           // more escape room = higher potential
  )
}

// In onAfterTick:
const shapingReward = gamma * potential(nextState) - potential(currentState)
reward += shapingReward
```

This is guaranteed not to change the optimal policy (Ng et al., 1999).

#### H. Advantage normalization in AC/QL

The actor-critic and q-learning implementations should normalize advantages before computing gradients:

```typescript
// In trainOnSegment:
const advantages = computeAdvantages(segment)
const mean = advantages.reduce((a, b) => a + b, 0) / advantages.length
const std = Math.sqrt(advantages.reduce((a, b) => a + (b - mean) ** 2, 0) / advantages.length)
const normalizedAdvantages = advantages.map(a => (a - mean) / (std + 1e-8))
```

This prevents large rewards from creating catastrophic gradient updates, which is the direct cause of the mass extinction problem at higher learning rates.

#### I. Gradient clipping

Clip the gradient magnitude in the backward pass:

```typescript
// Cap parameter updates to prevent wild swings
const maxGradNorm = 0.5
const gradNorm = computeGradientNorm(gradients)
if (gradNorm > maxGradNorm) {
  scale(gradients, maxGradNorm / gradNorm)
}
```

## Answering the Original Questions

### 1. "Is the scale wrong? What about a huge reward, like 200?"

**No, don't increase the scale.** Larger rewards cause larger advantage estimates, which cause larger gradient updates, which cause mass extinction. The scale of +1/-1 is fine. The problem is **density**, not magnitude.

If you must increase scale, you MUST also add advantage normalization (Tier 3H above) to prevent the gradients from blowing up. With normalization, the absolute scale doesn't matter -- only the relative magnitudes between events matter.

### 2. "What about a much smaller penalty for dying? Like 10% of kill?"

**Yes, this is a good idea.** `deathPenalty: -0.1` (if kill is 1.0) or `deathPenalty: -0.5` (a moderate compromise). Deaths are the result of diffuse positioning failures; harsh penalties create timidity rather than skill. The NEAT fitness function's survival gate already handles selection for survival.

A common ratio from the Atari literature: death penalty at 10-50% of the primary positive reward.

### 3. "Is it good practice to give small basic bonuses?"

**Yes, absolutely.** This is the single most impactful change you can make.

From the literature:
- **Survival bonus**: Standard practice. `+0.01` per alive tick converts 97.9% zero-signal into 100% signal. The agent first learns "stay alive," then differentiates "stay alive AND kill."
- **Button-press bonuses**: Can work but risk reward hacking (agent learns to press buttons for reward, not to achieve goals). Keep very small if used.
- **Bullet expiry penalty**: Not recommended. The causal chain is too long (fired bullet -> traveled -> missed -> expired). The agent can't attribute this. Use a small per-shot penalty instead.
- **Proximity rewards**: Excellent. Rewards approaching threats, which is the prerequisite for killing them. Use PBRS formulation for theoretical safety.

## Summary: Recommended Priority Order

| Priority | Change | Effort | Expected Impact |
|----------|--------|--------|-----------------|
| 1 | `survivalReward: 0.01` | Config only | Massive: 0% -> 100% signal density |
| 2 | `deathPenalty: -0.5` | Config only | Moderate: reduces timidity |
| 3 | `shotPenalty: 0.001` | Config only | Small: prevents fire spam |
| 4 | Advantage normalization | Code in AC/QL | High: prevents mass extinction, enables larger LR |
| 5 | Proximity reward | Code in env | Moderate: engagement signal |
| 6 | Gradient clipping | Code in AC/QL | Moderate: stability safety net |
| 7 | Full PBRS | Code in env | High but complex: theoretically optimal shaping |

Start with priorities 1-3 (config-only changes) and re-run `yarn demo episodic --iterations 20`. The survival reward alone should dramatically change the reward distribution. Then add advantage normalization (priority 4) to safely increase learning rate.
