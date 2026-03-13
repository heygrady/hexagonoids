---
name: hooks-testing
description: Testing patterns for SolidJS/Babylon hooks in hexagonoids-app — mocking window events, scene observables, and avoiding implementation inspector tests.
tags: [hexagonoids-app, solidjs, babylonjs, testing, work-session]
---

# Hooks Testing Guide

## Solid Testing Rig (Vitest + Solid)

Use Solid's official test stack in app-level Vitest:

- `vite-plugin-solid` in `vitest.config.ts`
- `test.environment = 'jsdom'`
- `setupFiles` including:
  - `@solidjs/testing-library` (auto-cleanup)
  - `@testing-library/jest-dom/vitest` (DOM matchers)

This enables JSX compilation, DOM rendering, and `jest-dom` assertions without
test-local runtime shims.

## useInputBridge — Prefer Real Keyboard Events

Vitest runs with `jsdom`, so keyboard behavior can be tested by dispatching real
`KeyboardEvent`s on `window`:

```typescript
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
expect(result.left).toBe(true)

window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft' }))
expect(result.left).toBe(false)
```

Use `vi.spyOn(window, 'addEventListener')` or targeted stubs only when the test
needs to assert listener wiring directly.

This keeps tests aligned with runtime behavior while still avoiding a real browser.

## useGameLoop — Use createRoot + Context Mocks

Run the hook inside a real Solid root (`createRoot`) so `onCleanup` wiring is
real. Mock only context dependencies (`useScene`, `useGameState`) so Babylon
observer registration and MAX_DELTA clamping can be verified without a real
scene or engine:

```typescript
vi.mock('../SceneContext', () => ({ useScene: () => mockScene }))
vi.mock('../useGameState', () => ({ useGameState: () => mockEngine }))

createRoot((dispose) => {
  useGameLoop(inputs, 'player-1')
  // ... assertions
  dispose()
})
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

SolidJS components that return JSX (e.g., `<PlaybackOverlay />`) can fail under
plain Vitest/esbuild transforms (`React is not defined` or `jsxDEV is not a function`)
when Solid's compiler plugin is missing.

Fix: configure Vitest to use `vite-plugin-solid` in
`apps/hexagonoids/vitest.config.ts`:

```typescript
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solid({ dev: false, hot: false })],
  test: {
    environment: 'jsdom',
    setupFiles: [
      './test/helpers/setupTests.ts',
      './test/helpers/equalsWithEpsilon.ts',
    ],
  },
})
```

Do not stub `React` globals in tests. Fix the transform once in Vitest config
so JSX behaves like the app runtime.

## Testing SolidJS Components

Default to rendering components with `@solidjs/testing-library` and asserting
observable UI behavior. This keeps tests aligned with Solid ownership/lifecycle
semantics and avoids root/disposal warnings.

For mode controllers where direct invocation is still useful, keep the scope
focused on behavioral logic and prefer `createRoot`/render harnesses if tests
touch ownership, cleanup, or effects.

Capture the `beforeRender` callback from the observable mock and invoke it
directly to exercise accumulator logic:

```typescript
const callback = mockObservableAdd.mock.calls[0][0]
callback() // simulate one frame tick
```

This follows the established `useGameLoop.test.ts` pattern.

## Avoid Mocking solid-js in Component Tests

With the Solid testing rig configured, prefer `render(...)` and real Solid
primitives. Mocking `solid-js` (`createSignal`, `Switch`, `Match`) should be a
last resort for narrowly isolated logic.

If mocking is unavoidable, keep stubs minimal and scoped to the specific test:

```typescript
vi.mock('solid-js', () => ({
  createSignal: (init: unknown) => [() => init, vi.fn()],
  onCleanup: vi.fn(),
}))
```

Do **not** build full stateful reimplementations unless a specific assertion
requires it.

## What Needs Tests: Behavioral Logic Only

Only the file(s) with behavioral logic need tests among a batch of changes.
Files classified as wiring or trivial presentation are lower priority:

- **Pure static JSX presentation** — often skippable
- **UI with derived/critical display behavior** (formatting, conditional sections) — add a lightweight render test
- **One-liner wiring additions** (adding one `<Match>` case to a `<Switch>`) — skip
- **Identical conditional added to existing handler** — skip
- **Import path swap** (no logic change) — skip
- **Pure config** (`trpc.ts` with `createTRPCClient`) — skip

Focus test effort on the file that owns the accumulator / state machine logic.

## AppModeProvider — Test Through Provider Boundary

Do not skip this by default. If behavior changes around `playerId` sanitization
or persistence, test it through a provider/render harness and assert observable
results (`setPlayerId` output, localStorage interactions).

## PlaybackController Tests — Prefer Explicit Progression

Auto-triggering `onSelectAll` inside a `SessionBrowser` mock is a valid shortcut
but should be used deliberately. Prefer explicit progression (`render`, then
`waitFor`/event trigger) when clarity matters more than setup brevity.

## exportBenchmarks — mockRejectedValue for ENOENT (All Seeds)

Use `mockReadFile.mockRejectedValue(...)` (not `mockRejectedValueOnce`) to test
the ENOENT/skip behavior so **all** benchmark seed reads fail, producing an empty
seeds map. This verifies skip-on-missing without enumerating each seed individually.

## exportBenchmarks Tests — Extend Existing sessions.test.ts

Add `exportBenchmarks` tests to the existing `sessions.test.ts` rather than a new
file. The procedure has pure aggregation logic (best/avg score, wave across JSONL
lines) fully exercisable through the existing tRPC caller fixture and `mockReadFile`.

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
