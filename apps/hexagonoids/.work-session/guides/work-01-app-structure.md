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
