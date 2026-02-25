---
name: app-structure
description: Key structural decisions for the hexagonoids app — inline wiring components, existing context hooks, and input bridge design.
tags: [hexagonoids-app, solidjs, babylonjs, work-session]
---

# App Structure Guide

## EngineGameLoop Is Intentionally Inline

`EngineGameLoop` lives inside `HexagonoidsCanvas.tsx` rather than a separate
file. It is a small wiring component (start player + connect input bridge +
register game loop) with no reuse outside the canvas. Keeping it inline avoids
file proliferation for a one-off setup concern.

Do not extract it into its own file unless it gains independent reuse.

## useScene() — Existing SceneContext Hook

The app already provides a `useScene()` hook via `SceneContext` that returns the
Babylon `Scene` object. Use this directly in `useGameLoop` and any other hook
that needs the scene — do not accept `scene` as a parameter when the context
already supplies it.

```typescript
import { useScene } from '../SceneContext'

function useGameLoop() {
  const scene = useScene()
  // ...
}
```

## Node Pools Live in Container Components

Node pools (`shipNodePool`, `rockNodePool`, `bulletNodePool`) are created
**inside the container component** (Ships, Rocks, Bullets) — not at module
level and not via context. Each container creates its pool once on component
initialization and passes it down as a prop to each entity renderer.

This avoids HMR-triggered remounts referencing disposed Babylon meshes (a
module-level singleton persists across hot reloads and holds stale mesh refs).
It also avoids the complexity of a pool context layer.

Additionally, all module-level singletons inside pool factory files
(`bulletMaster`, `poolCounter`, etc.) must be moved into the factory function
closure. Each `createXxxNodePool()` call gets fresh state.

## Culling.tsx Is Stubbed to a No-Op

`Culling.tsx` was stubbed to return `null` rather than adapted. The original
implementation iterated nanostores to toggle visibility; with nodes now managed
inside individual entity component lifecycles there is no shared registry.
Babylon's built-in frustum culling is acceptable for now. Re-add custom
culling only when a node registry is available.

## EndScreen Restart Pattern

EndScreen clears all engine state then re-initializes inside a **single
`engine.mutate()` call**:

```typescript
engine.mutate((state) => {
  state.ships.clear()
  state.rocks.clear()
  state.bullets.clear()
  state.players.clear()
  startPlayer(state, playerId, engine.rng)
})
```

This mirrors initial setup in EngineGameLoop. A dedicated `restartGame()`
engine action was intentionally skipped to avoid modifying the engine package.

## StartScreen Is a UI Gate, Not an Initializer

StartScreen no longer calls `start()` (old nanostore action). It only:
1. Calls `engine.mutate()` to set `game.startedAt`
2. Moves the camera using the engine's ship position

The player and ship already exist when StartScreen renders because
`EngineGameLoop` calls `startPlayer()` at mount time. StartScreen is purely
a UI gate.

## DEFAULT_PLAYER_ID Constant

`PLAYER_ID='player-1'` is extracted to `DEFAULT_PLAYER_ID` in `constants.ts`.
Consumers keep a local `const PLAYER_ID = DEFAULT_PLAYER_ID` rather than
importing `DEFAULT_PLAYER_ID` at every call site — preserves readability and
eliminates string literal drift risk.

## SceneStore Must Not Be Deleted

`store/scene/` (`SceneStore.ts`, `SceneSetters.ts`) is **rendering infrastructure**, not game logic. It holds the Babylon `Scene`, globe mesh, camera context, and running flag. It is consumed by `solid-babylon/SceneCanvas.tsx` and `SceneContext.ts`.

When deleting nanostore game-state directories, do **not** delete `store/scene/`. It was accidentally removed alongside the game stores in a mass cleanup and had to be restored from git.

## Cell System Was Removed (Intentionally Inert)

The cell pool system (`store/cell/`, `store/cellPool/`, `hooks/useCellPool`, `Cells.tsx`, `Cell.tsx`, `cell/generateCell.ts`) was deleted entirely. The rationale: `PoolInitializer` was never rendered, `Collision.tsx` was never rendered, so no cells were ever created or visited. Keeping a broken dependency chain through `GameStore` was worse than deleting. Do not try to restore this system unless a collision/cell feature is being actively built.

## EngineGameLoop: startPlayer Belongs in onMount()

Calling side-effectful engine mutations (`startPlayer`, `engine.mutate()`) **during component render** is incorrect in SolidJS — it runs synchronously during the reactive graph build. Wrap any engine init calls in `onMount()`:

```typescript
onMount(() => {
  engine.mutate((state) => { startPlayer(state, PLAYER_ID, engine.rng) })
})
```

`startPlayer` is idempotent (no-ops if player already exists), so the practical risk of calling it in render was low — but it violates SolidJS conventions. The `onMount` form is correct.

## ShipCamera Default Position

`ShipCamera.tsx` was simplified to always use the default starting position `latLngToVector3(0, 0, RADIUS)`. The old code read `$player.$ship.positionNode` from the nanostore but fell back to the same default anyway. No behavioral change.

## bullet/createBulletNodes.ts — initializeBulletMaster Only

After cleanup, `bullet/createBulletNodes.ts` retains only:
- `initializeBulletMaster()` — used by `engine/bulletNodePool.ts`
- `getBulletMaster()` — accessor added for completeness

The old `createBulletNodes` function and `BulletStore` type import were removed. Do not re-add `BulletStore` imports to this file.

## SphereArenaCamera: Vector3[] Not Tuple

The `CameraPoints` 5-tuple was replaced with `Vector3[]` on the `SphereArenaCamera` interface. The ray-pick loop only rejects 0-length results, so a 1–4-length pick would under-fill a 5-tuple at runtime. `Vector3[]` matches runtime behavior without requiring a length guard.

## useInputBridge — Plain Object, Not Signal

`useInputBridge` stores the current key state in a plain mutable object rather
than a SolidJS signal. This is a deliberate performance choice: inputs are read
synchronously in `beforeRender` (outside a reactive context), so signal overhead
adds no value.

```typescript
const inputs: PlayerInputState = { left: false, right: false, thrust: false, fire: false }

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') inputs.left = true
  // ...
})
```

The plain object approach is already documented in the devlog at
`.devlogs/neat-hexagonoids/phase-04a/guide/work-02-input-and-gameloop.md`.
Do not refactor to signals.
