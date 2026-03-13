---
name: collision-system
description: Collision detection and handling design decisions — grace period via regeneratedAt, dedup via Sets, full GameState requirement, and subfolder barrel conventions.
tags: [hexagonoids-engine, collision, game-loop, step-function]
---

# Collision System

## File Layout

```
features/engine/collision/
  detectCollisions.ts   # returns collision pairs (bullet-rock, ship-rock)
  handleCollisions.ts   # applies game state mutations for each pair
  index.ts              # barrel — re-exports both for use by step.ts and index.ts
```

The barrel exists even though there are only two files. A barrel is warranted
whenever a subfolder is imported from multiple places (`step.ts` and the public
`index.ts` both import from `collision/`).

## Grace Period — No Extra State Field

Ship-rock collision applies a post-respawn grace period. The implementation
reads `player.regeneratedAt` from `GameState` rather than adding an
`invulnerable` flag to `ShipState`. This avoids new state and reuses the
existing timestamp pattern (`diedAt`, `regeneratedAt`):

```typescript
// in detectCollisions — ship needs full GameState, not just entity maps
if (!ship.alive) continue

const player = state.players.get(ship.playerId)
if (player != null && player.regeneratedAt != null) {
  if (elapsed(state, player.regeneratedAt) < SHIP_REGENERATION_GRACE_PERIOD)
    continue
}

// CollisionPair uses EntityRef (id + type), not raw IDs
pairs.push({
  a: { id: ship.id, type: 'ship' },
  b: { id: rock.id, type: 'rock' },
  type: 'ship-rock',
  distance: dist,
})
```

`detectCollisions` therefore requires the full `GameState`, not just entity
maps — the ship entity has no direct reference to `regeneratedAt`.

## Dedup via Local Sets

`handleCollisions` tracks processed bullet and rock IDs in local Sets to
prevent double-processing when one entity appears in multiple pairs:

```typescript
const processedBullets = new Set<string>()
const processedRocks = new Set<string>()
const processedShips = new Set<string>()

for (const pair of collisions) {
  if (pair.type === 'bullet-rock') {
    if (processedBullets.has(pair.a.id) || processedRocks.has(pair.b.id)) continue
    processedBullets.add(pair.a.id)
    processedRocks.add(pair.b.id)
    // apply bullet-rock mutation
  } else if (pair.type === 'ship-rock') {
    if (processedShips.has(pair.a.id) || processedRocks.has(pair.b.id)) continue
    processedShips.add(pair.a.id)
    processedRocks.add(pair.b.id)
    // apply ship-rock mutation
  }
}
```

First match wins. Subsequent pairs involving an already-processed entity
(e.g., one bullet hitting two rocks, or two bullets hitting the same rock)
are skipped. This mirrors the app's behavior where entity removal from the
pool breaks further collision checks naturally.

## Collision Ordering in step()

`step()` calls collisions after expiry and before regeneration:

```
time → inputs → move → expire → collisions → regenerate → waves
```

Game-over is handled inline by `handleCollisions` (sets `endedAt`, fires
`onGameOver` hook), not as a separate step. Expiry runs first so that bullets
at max lifetime are removed before collision checks — avoids spurious scores
from already-expired bullets.
