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

## SolidJS JSX in Vitest — React is not defined

SolidJS components that return JSX (e.g., `<PlaybackOverlay />`) compile to
`React.createElement()` calls by default in vitest/esbuild because
`tsconfig` has `jsx: 'preserve'` and `vite-plugin-solid` is not present in
the vitest config. The test fails at runtime with `React is not defined`.

Fix: stub `React` as a global no-op at the top of the test file:

```typescript
vi.stubGlobal('React', { createElement: () => null })
```

This lets the component body execute and return value is safely ignored. The
stub must appear before any imports that trigger the JSX transform, so place
it before `vi.mock` factories or use inside `beforeAll`.

## Testing SolidJS Components as Plain Functions

For mode controllers (RecordController, PlaybackController), call the
component function directly as a plain function — do not mount it with a
renderer. Mock all SolidJS hooks (`createSignal`, `onCleanup`) and external
dependencies (Babylon, tRPC, AppMode) via `vi.mock`.

Capture the `beforeRender` callback from the observable mock and invoke it
directly to exercise accumulator logic:

```typescript
const callback = mockObservableAdd.mock.calls[0][0]
callback() // simulate one frame tick
```

This follows the established `useGameLoop.test.ts` pattern.

## Minimal createSignal Stub

When mocking `solid-js` for a component test, use the minimal `createSignal`
stub unless a test exercises a path where the getter must reflect an updated
value:

```typescript
vi.mock('solid-js', () => ({
  createSignal: (init: unknown) => [() => init, vi.fn()],
  onCleanup: vi.fn(),
}))
```

Do **not** build a full stateful reimplementation (closure over a mutable
variable) unless a specific test requires getter updates — it couples tests
to SolidJS signal semantics unnecessarily.

## What Needs Tests: Behavioral Logic Only

Only the file(s) with behavioral logic need tests among a batch of changes.
Files classified as wiring or trivial presentation can be skipped:

- **Pure JSX presentation** (`PlaybackOverlay.tsx`) — no logic, skip
- **One-liner wiring additions** (adding one `<Match>` case to a `<Switch>`) — skip
- **Identical conditional added to existing handler** — skip
- **Import path swap** (no logic change) — skip
- **Pure config** (`trpc.ts` with `createTRPCClient`) — skip

Focus test effort on the file that owns the accumulator / state machine logic.

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
