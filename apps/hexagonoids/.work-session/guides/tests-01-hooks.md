---
name: hooks-testing
description: Testing patterns for SolidJS/Babylon hooks in hexagonoids-app — mocking window events, scene observables, and avoiding implementation inspector tests.
tags: [hexagonoids-app, solidjs, babylonjs, testing, work-session]
---

# Hooks Testing Guide

## useInputBridge — Mock window.addEventListener

The app's vitest config has no DOM environment, so tests cannot rely on jsdom.
Use `vi.stubGlobal` to mock `window.addEventListener` at the module level and
capture handlers in a `Map`:

```typescript
const handlers = new Map<string, EventListener>()
vi.stubGlobal('window', {
  addEventListener: (type: string, handler: EventListener) => {
    handlers.set(type, handler)
  },
  removeEventListener: vi.fn(),
})
```

Then replay captured handlers to simulate key events:

```typescript
handlers.get('keydown')?.({ key: 'ArrowLeft' } as KeyboardEvent)
expect(result.left).toBe(true)
```

This exercises the pure key-mapping logic without a browser environment.

## useGameLoop — Mock Solid-js Lifecycle and Context

Mock `solid-js` (`onCleanup`), `useScene`, and `useGameState` via `vi.mock` so
the Babylon observer registration and MAX_DELTA clamping can be verified without
a real scene or engine:

```typescript
vi.mock('solid-js', () => ({ onCleanup: vi.fn() }))
vi.mock('../SceneContext', () => ({ useScene: () => mockScene }))
vi.mock('../useGameState', () => ({ useGameState: () => mockEngine }))
```

Capture the registered `beforeRender` callback from the observable mock and
invoke it directly to simulate a frame tick:

```typescript
const callback = mockScene.onBeforeRenderObservable.add.mock.calls[0][0]
callback()  // simulate one frame
```

## vi.stubGlobal for globalThis Side-Effects

When a module modifies `globalThis` (e.g., `globalThis.devicePixelRatio`) as a side-effect inside a factory or constructor, use `vi.stubGlobal` to install a clean stub **inside the test body** (not at describe scope). Always restore with `afterEach(() => vi.unstubAllGlobals())`:

```typescript
afterEach(() => {
  vi.unstubAllGlobals()
})

it('reads devicePixelRatio', () => {
  vi.stubGlobal('devicePixelRatio', 2)
  // ... test body
})
```

Placing the stub inside the test body rather than `beforeEach` prevents the stub value leaking into other test files. Using `vi.unstubAllGlobals()` is more reliable than manually restoring the original value.

This pattern was applied in `test/utils/screenDimensions.test.ts` to isolate the `Object.defineProperty(globalThis, 'devicePixelRatio', ...)` side-effect inside `getScreenDimensions`.

## Avoid Implementation Inspector Tests

Do not write tests that assert internal wiring details with no behavioral value.
Example of a deleted implementation inspector:

```typescript
// DELETED — asserts .add was called once, not what the frame tick does
it('registers a beforeRender observer on the scene', () => {
  expect(mockScene.onBeforeRenderObservable.add).toHaveBeenCalledOnce()
})
```

Instead, verify observable outcomes: what arguments arrive at `engine.tick()`,
whether MAX_DELTA clamping caps large deltas, etc. Implementation inspector
tests break on refactors while providing no safety net.
