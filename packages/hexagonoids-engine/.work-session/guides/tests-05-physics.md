---
name: physics-test-organization
description: Conventions for organizing physics tests in hexagonoids-engine — qualitative vs quantitative separation, .quantitative.test.ts naming, and avoiding unused mock hooks.
tags: [hexagonoids-engine, work-session, testing]
---

# Physics Test Organization

## Qualitative vs Quantitative Split

Physics test files are split into two layers per function:

| Layer | File Pattern | Contents |
|-------|-------------|----------|
| Qualitative | `test/engine/physics/*.test.ts` | Behavioral correctness — direction, sign, limit checks |
| Quantitative | `test/engine/physics/*.quantitative.test.ts` | Numerical precision — specific input/output value pairs |

Keep each file in the 50–150 line ideal range. When adding quantitative cases
for an existing qualitative file, create a separate `.quantitative.test.ts`
rather than growing the existing file past 300 lines.

Example:
```
test/engine/physics/
  accelerateShip.test.ts            # qualitative: applies thrust, respects MAX_SPEED
  accelerateShip.quantitative.test.ts  # quantitative: exact rad/s values per dt
  turnShip.test.ts
  turnShip.quantitative.test.ts
```

The quantitative files were split out rather than merged into existing files
when a single combined file (`quantitativePhysics.test.ts`) grew to 608 lines
across 5 physics domains. This is the preferred pattern going forward.

## Unused Mock Hooks in Test Setup

When writing tests that use `EngineHooks` (e.g., `onCollision`, `onScoreChanged`),
always assert on every mock you set up. Mocks that are created but never asserted
are invisible from test counts and may mask missing functionality.

```typescript
// BAD — mock created, never asserted:
const onCollision = vi.fn()
const onScoreChanged = vi.fn()
step(state, inputs, dt, rng, { onCollision, onScoreChanged })
expect(state.rocks.size).toBe(0)  // only state assertion

// GOOD — assert on every mock:
const onCollision = vi.fn()
const onScoreChanged = vi.fn()
step(state, inputs, dt, rng, { onCollision, onScoreChanged })
expect(onCollision).toHaveBeenCalledOnce()
expect(onScoreChanged).toHaveBeenCalledWith(playerId, expect.any(Number), expect.any(Number))
```

If you do not need to verify the hook was called, remove it from the test setup
rather than leaving it as dead setup.

## Hook Wiring Gap

`onEntitySpawned`, `onEntityDestroyed`, and `onWaveSpawned` are defined in
`EngineHooks` but are **not called anywhere in `step()`**. Do not write tests
that assert on these hooks — they will never fire.

To test wave spawning, read `state.wave` directly after `step()`.
To test entity counts, compare `state.bullets.size` or `state.rocks.size`
before and after the step.
