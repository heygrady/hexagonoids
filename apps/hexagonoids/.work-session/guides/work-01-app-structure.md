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

## Culling.tsx Uses NodeRegistry

`Culling.tsx` uses the `NodeRegistryProvider` context to toggle node visibility
based on camera frustum distance. The `NodeRegistry` tracks all entity nodes
(ships, rocks, bullets) and `Culling` iterates them each frame to show/hide
nodes outside the camera's view.

## EndScreen Restart Pattern

EndScreen clears all engine state then re-initializes inside a **single
`engine.mutate()` call**:

```typescript
engine.mutate((state) => {
  state.endedAt = null
  state.players.delete(PLAYER_ID)
  state.ships.clear()
  state.rocks.clear()
  state.bullets.clear()
  startPlayer(state, PLAYER_ID, engine.rng)
  state.startedAt = state.now
})
```

This mirrors the StartScreen initialization pattern. A dedicated `restartGame()`
engine action was intentionally skipped to avoid modifying the engine package.

## StartScreen Is the Game Initializer

StartScreen creates the player when the user presses a key. In its
`engine.mutate()` call it:
1. Clears attract-mode rocks (`state.rocks.clear()`)
2. Resets the wave counter (`state.wave = 0`)
3. Creates the player and ship (`startPlayer(state, PLAYER_ID, engine.rng)`)
4. Sets `state.startedAt = state.now`

Then it moves the camera to the new ship's position. No player or ship exists
before the user presses a key — `EngineGameLoop` only spawns attract-mode rocks.

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

## EngineGameLoop: Attract-Mode Rocks in onMount()

`EngineGameLoop.onMount()` spawns attract-mode rocks via `spawnWave(state, 0, 0, engine.rng)`.
It does **not** call `startPlayer` — the player is created later by `StartScreen` when the
user presses a key. This ensures the title screen shows rocks flying without a ship.

Engine mutations must be wrapped in `onMount()` (not called during render) to respect
SolidJS reactive graph build timing.

## ShipCamera Default Position

`ShipCamera.tsx` was simplified to always use the default starting position `latLngToVector3(0, 0, RADIUS)`. The old code read `$player.$ship.positionNode` from the nanostore but fell back to the same default anyway. No behavioral change.

## bullet/createBulletNodes.ts — initializeBulletMaster Only

After cleanup, `bullet/createBulletNodes.ts` retains only:
- `initializeBulletMaster()` — used by `engine/bulletNodePool.ts`
- `getBulletMaster()` — accessor added for completeness

The old `createBulletNodes` function and `BulletStore` type import were removed. Do not re-add `BulletStore` imports to this file.

## SphereArenaCamera: Vector3[] Not Tuple

The `CameraPoints` 5-tuple was replaced with `Vector3[]` on the `SphereArenaCamera` interface. The ray-pick loop only rejects 0-length results, so a 1–4-length pick would under-fill a 5-tuple at runtime. `Vector3[]` matches runtime behavior without requiring a length guard.

## EngineGameLoop: Named Inner Functions Over Module Extraction

When `EngineGameLoop` grows to include distinct concerns (collision hooks,
explosion effects, etc.), refactor to **named inner functions with section-comment
headers** — do not extract to separate module files:

```typescript
// --- Collision hooks ---
function setupCollisionHooks(collisionType: CollisionType, ref: EntityRef) {
  // ...
}

// --- Explosion effects ---
function setupExplosionEffects(ref: EntityRef) {
  // ...
}
```

This preserves the deliberate inline wiring pattern (single-file, no reuse
outside the canvas) while addressing single-responsibility at the function level.
Import `CollisionType` and `EntityRef` from `@heygrady/hexagonoids-engine` for
clean explicit parameter types in the named functions.

Do not create `collision/setupCollisionHooks.ts` or `effects/setupExplosionEffects.ts`
files — external extraction would break the inline wiring intent documented above.

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
