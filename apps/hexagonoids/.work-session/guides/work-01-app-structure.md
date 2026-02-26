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

## SceneStore Is Rendering Infrastructure

`store/scene/` holds the Babylon `Scene`, globe mesh, camera context, and
running flag. It is consumed by `solid-babylon/SceneCanvas.tsx` and
`SceneContext.ts`. This is rendering infrastructure, not game logic.

## Cell System Is Vital to Game Visuals

The cell visualization system renders H3 hexagonal cells on the globe surface
as entities move through them — it is a core visual feature of the game.

The cell system uses the engine's reactive state pattern (not nanostores):

- `Cells.tsx` — imperative component, reads engine state per-frame, visits
  cells under ships/rocks/bullets, manages fade via `CellManager`
- `cell/CellManager.ts` — class-based manager with `ObjectPool` for node reuse,
  `NodeRegistry` for frustum culling, `StandardMaterial` with inline creation,
  fade-out via `easeCubicIn`
- `cell/entityToCells.ts` — `entityToCell()` returns a single H3 cell at
  resolution 1
- `cell/createCellPolygon.ts` — creates 3D polyhedron meshes from H3 cell
  vertices
- `CellNodes` interface in `engine/nodeTypes.ts` and cell constants in
  `constants.ts` are active production code

Do NOT delete cell system files. Do NOT treat the cell system as dead code.

## EngineGameLoop: Attract-Mode Rocks in onMount()

`EngineGameLoop.onMount()` spawns attract-mode rocks via `spawnWave(state, 0, 0, engine.rng)`.
It does **not** call `startPlayer` — the player is created later by `StartScreen` when the
user presses a key. This ensures the title screen shows rocks flying without a ship.

Engine mutations must be wrapped in `onMount()` (not called during render) to respect
SolidJS reactive graph build timing.

## ShipCamera Default Position

`ShipCamera.tsx` uses the default starting position `latLngToVector3(0, 0, RADIUS)`.

## bullet/createBulletNodes.ts — initializeBulletMaster Only

`bullet/createBulletNodes.ts` exports only `initializeBulletMaster()`.
`getBulletMaster()` is a local closure function inside `engine/bulletNodePool.ts`
(not in `createBulletNodes.ts`). Note: `bulletMaster` is still a module-level
singleton in `createBulletNodes.ts` — it has not been moved into a factory
closure as the Node Pools section above prescribes.

## SphereArenaCamera: Vector3[] Not Tuple

The `CameraPoints` 5-tuple was replaced with `Vector3[]` on the `SphereArenaCamera` interface. The ray-pick loop only rejects 0-length results, so a 1–4-length pick would under-fill a 5-tuple at runtime. `Vector3[]` matches runtime behavior without requiring a length guard.

## EngineGameLoop: Named Inner Functions

`EngineGameLoop` uses named inner functions with section-comment headers for
distinct concerns (collision hooks, explosion effects, attract-mode spawning).
This keeps the wiring inline in `HexagonoidsCanvas.tsx`.

If `EngineGameLoop` grows significantly or functions need independent testing,
extracting them to separate module files is acceptable.

## ModeGameLoop: One Tick Source at a Time

`ModeGameLoop` uses a SolidJS `<Switch>`/`<Match>` to mount exactly one tick
source based on the current app mode:

```tsx
<Switch>
  <Match when={mode() === 'play'}><PlayModeGameLoop /></Match>
  <Match when={mode() === 'record'}><RecordController /></Match>
  <Match when={mode() === 'playback'}><PlaybackController /></Match>
</Switch>
```

`EngineGameLoop` was split into two parts: hook setup (always active,
e.g., input bridge, collision) and `PlayModeGameLoop` (the Babylon
`beforeRender` loop, play-mode only).

Each controller owns its own `beforeRender` tick loop — do **not** share
`useGameLoop`. This matches the architecture guide's Option 2 (controller
owns tick timing) and leaves play mode completely unaffected.

Controllers may use a plain mutable boolean flag (not a signal) to gate
the `beforeRender` observer while async setup is pending. The flag is only
read inside the callback, not in JSX, so a signal adds no value:

```typescript
let loading = true
// async init...
loading = false
scene.onBeforeRenderObservable.add(() => {
  if (loading) return
  // tick logic
})
```

## modes/constants.ts — Server Can Import Plain Primitive Constants

`BENCHMARK_SEEDS` and `SESSION_DURATION` live in
`modes/constants.ts` (a client-components path). The server router
(`server/routers/sessions.ts`) imports from this file directly.

This crosses the conceptual server/client boundary but is safe: the file
contains only plain primitive values with no browser APIs. The alternative
(fetching seeds via tRPC at runtime) adds async complexity for no benefit.

Rule: server files **may** import from client component paths if and only
if the imported file is pure primitives with zero browser API usage.

## modes/trpc.ts — Shared tRPC Client

Both `RecordController` and `PlaybackController` use an identical
`createTRPCClient<AppRouter>` with an HTTP batch link. Extract it once to
`modes/trpc.ts` and import it in both controllers. This ensures consistent
configuration and lets HTTP batching coalesce requests across both controllers.

## Controller Escape Key — Self-Contained window.addEventListener

Mode controllers (RecordController, PlaybackController) wire the Escape key
directly via `window.addEventListener` inside the component body, mirroring
`StartScreen`'s pattern. Do **not** route playback/record exit logic through
`useInputBridge`. Keeping exit handling self-contained avoids polluting the
shared input bridge with mode-specific key logic.

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

## AppModeProvider — playerId with Wrapped Setter and SSR Guard

`playerId` is stored via `createSignal` backed by `localStorage`. The exported
`setPlayerId` is a wrapper (not the raw `Setter<string>`) so every write goes
through a `slugify` helper (lowercase, replace non-alphanumeric runs with `-`)
and `localStorage.setItem` atomically. Exposing the raw setter was rejected
because callers would bypass sanitization.

Guard all `localStorage` access with `typeof window !== 'undefined'`. On the
server the initial value returns `''`; `PlayerIdentity` will prompt on first
client render. Recording/playback are client-only features.

## PlaybackController — browse/playing Phase Signal

PlaybackController uses a `'browse' | 'playing'` phase signal:
- `'browse'` phase: shows `SessionBrowser`
- `'playing'` phase: shows `PlaybackOverlay`

The `beforeRender` observer gates on `loading && phase`, so no replay ticks fire
while browsing. All playback state stays co-located in one component.

## SessionBrowser — Single Round-Trip via exportBenchmarks

`SessionBrowser` fetches stats via the `exportBenchmarks` endpoint only (not
`sessions.list` + `sessions.get` per seed). `exportBenchmarks` reads all JSONL
lines server-side and aggregates (best/avg score, wave). Returning raw lines for
client aggregation was rejected — each line includes the full frames array,
transferring unnecessary data just to compute summary statistics.

## sessionRecordingSchema — Optional score and wave Fields

Extended with optional `score` and `wave` fields. Existing JSONL recordings
lacking these fields still parse (zod treats missing optionals as `undefined`,
defaulting to `0` in `exportBenchmarks`). `RecordController` passes both in the
save mutation so future recordings carry the data.

## SeedBenchmarkStats — Named Interface in sessions.ts

Extract aggregation result types as named interfaces (e.g., `SeedBenchmarkStats`)
rather than inline types. This eliminates duplication between the return type
annotation and local variable declarations, and makes the type reusable across
future procedures.
