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

## vi.hoisted() for Mock Functions Inside vi.mock() Factories

Vitest hoists `vi.mock()` factory calls to the top of the file before any
top-level `const` declarations. If you declare a mock function at the top level
and reference it inside a `vi.mock()` factory, you get
`Cannot access '<name>' before initialization`:

```typescript
// WRONG — mockFn is not initialized when the factory runs:
const mockFn = vi.fn()
vi.mock('../myModule', () => ({ doThing: mockFn }))
```

Use `vi.hoisted()` to declare functions that need to be referenced inside a
`vi.mock()` factory:

```typescript
// CORRECT — vi.hoisted() runs at hoist time alongside the factory:
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }))
vi.mock('../myModule', () => ({ doThing: mockFn }))
```

The hoisted function and the factory are both moved to the top, so `mockFn`
is available when the factory executes.

## Mocking node:fs/promises — Include a Default Export

When mocking `node:fs/promises` with a `vi.mock()` factory, omitting a
`default` export causes a Vitest error: `No default export is defined on the mock`.
The module uses both named exports and a default export, so the factory must
include both:

```typescript
vi.mock('node:fs/promises', () => {
  const { readFile, writeFile } = vi.hoisted(() => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
  }))
  return {
    readFile,
    writeFile,
    default: { readFile, writeFile },
  }
})
```

`importOriginal` cannot be used here when mock functions come from `vi.hoisted()`.
Mirror the named exports as the `default` key to satisfy both import styles.

## BabylonJS Collision Tests — Skip When NullEngine Is Required

Tests for functions that require a live Babylon world matrix
(e.g., `verifyShipRockCollision`) need a `NullEngine` + `Scene` setup plus
mesh creation and positioning. The test complexity vs. coverage tradeoff
typically does not justify the effort when:
- Internal pure helpers (`isPointInsidePolygon`, `isPolygonInsidePolygon`) are unexported
- The public function surface is thin (one exported function)

Use `it.skip` with a comment explaining the NullEngine requirement, and cover
edge cases through integration-level tests instead.

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
