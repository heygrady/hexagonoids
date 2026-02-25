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

## Cohesive Domain Exception to File Size Rule

The 300-line split threshold has an explicit exception: **do not split a file
whose tests form one cohesive domain**, even if it exceeds the threshold.

Two confirmed examples in this package:

- **`step.test.ts` (372 lines)** — 10 sub-domains, all share one `beforeEach`
  factory, all test the single `step()` function. Splitting would fragment what
  reads as one coherent validation story.

- **`test/engine/physics/getYawPitch.test.ts` (332 lines)** — two `describe`
  blocks (pure unit tests + Babylon rotate-child integration tests) both test
  the same function from complementary angles. The complementary coverage makes
  them a single cohesive story.

The guiding principle: "a file with 40 tests across one cohesive domain is
better than four files with 10 tests each that share the same setup." Apply
the split when domains are genuinely independent — not when they share setup
and test the same function.

## Hook Wiring Gap

`onEntitySpawned`, `onEntityDestroyed`, and `onWaveSpawned` are defined in
`EngineHooks` but are **not called anywhere in `step()`**. Do not write tests
that assert on these hooks — they will never fire.

To test wave spawning, read `state.wave` directly after `step()`.
To test entity counts, compare `state.bullets.size` or `state.rocks.size`
before and after the step.
