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
