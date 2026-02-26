---
name: rng-seeding
description: RNG getter pattern on ReactiveEngine, deterministic entity IDs via resetIdCounter in reseedGame, and test conventions for reseed/createReactiveEngine.
tags: [hexagonoids-engine, solidjs, work-session]
---

# RNG and Seeding

## ReactiveEngine.rng — Getter, Not Direct Property

`ReactiveEngine.rng` is implemented as a getter over a `let` variable so
that `reseed()` can replace the RNG and all callers reading `engine.rng`
immediately get the new value without a signal:

```typescript
let _rng: RNG = createRNG(seed)
get rng() { return _rng }

reseed(seed: number) {
  _rng = createRNG(seed)
  // mutate game state...
}
```

The public interface is unchanged — `rng` still appears as a plain
property to consumers. Do not convert `rng` to a SolidJS signal; it is
read synchronously in `beforeRender` and signal overhead adds no value.

## reseedGame — resetIdCounter for Deterministic IDs

`reseedGame()` calls `resetIdCounter()` **before** `startPlayer()` to
reset entity ID generation to 0 on each seed. This ensures deterministic
entity IDs across benchmark sessions, which is required for frame-perfect
replay.

```typescript
export function reseedGame(state: GameState, playerId: string, rng: RNG) {
  // clear entities...
  resetIdCounter()          // ← must precede startPlayer
  startPlayer(state, playerId, rng)
}
```

`restartGame()` does **not** call `resetIdCounter()` because mid-game
restarts don't require deterministic IDs.

## Test Conventions — createReactiveEngine

Tests for `createReactiveEngine` use the existing `createRoot()` +
`dispose()` pattern from the file. Do not introduce a different setup
approach — keep the test style consistent with the prior tests in that file:

```typescript
let dispose: () => void
beforeEach(() => {
  createRoot((d) => {
    dispose = d
    // setup...
  })
})
afterEach(() => dispose())
```

## Test: Verifying Deterministic IDs After reseed

To confirm `reseedGame` resets the ID counter, call `reseed()` twice and
assert that the same ship ID is produced both times. This avoids inspecting
counter internals:

```typescript
engine.reseed(42)
const id1 = [...engine.state.ships.keys()][0]
engine.reseed(42)
const id2 = [...engine.state.ships.keys()][0]
expect(id1).toBe(id2)
```
