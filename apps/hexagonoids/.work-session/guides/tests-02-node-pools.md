---
name: node-pool-testing
description: Testing patterns for Babylon.js node pool factories — InstancedMesh side-effect import, stub construction, and testing resetFn via release().
tags: [hexagonoids-app, babylonjs, vitest, work-session]
---

# Node Pool Testing Guide

## InstancedMesh Side-Effect Import

Before calling `mesh.createInstance()` in any test, import the side-effect
module first:

```typescript
import '@babylonjs/core/Meshes/instancedMesh'
```

Without this, Vitest will throw:
> "InstancedMesh needs to be imported before as it contains a side-effect
> required by your code."

This only affects tree-shaken imports (tests, SSR). The full `babylonjs` bundle
includes this side-effect automatically.

## Use CreateBox for InstancedMesh Stubs

Pool factory tests that involve `InstancedMesh` should use `CreateBox` as the
master mesh rather than real mesh builders (`PolygonMeshBuilder`, `CreateDisc`).
This avoids GPU-dependent mesh construction while still exercising the
`resetFn`/`disposeFn` logic through a realistic node graph:

```typescript
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import '@babylonjs/core/Meshes/instancedMesh'

const master = CreateBox('master', {}, scene)
const instance = master.createInstance('stub-bullet')
// Inject instance into pool for testing resetFn/disposeFn
```

## Testing resetFn via release()

The pool's `resetFn` is called by `pool.release()` regardless of whether the
item was previously tracked as active. This makes it safe to inject stub nodes
without going through `createFn`:

```typescript
// Build stub node bundle manually
const stub: BulletNodes = {
  originNode: new TransformNode('origin', scene),
  bulletNode: master.createInstance('bullet'),
}

// release() calls resetFn — safe even without prior acquire()
pool.release(stub)

// Assert nodes are hidden/reset
expect(stub.bulletNode.isVisible).toBe(false)
```

This pattern avoids complex mocking of the full `createFn` path while still
covering the reset/cleanup behavior.

## getCommonMaterial Triggers solid-js Hydration Error in Tests

`getCommonMaterial` calls `solid-js createUniqueId()` **at the module level** to generate stable material cache keys. Any test that transitively imports a module depending on `getCommonMaterial` will fail:

> `getNextContextId cannot be used under non-hydrating context`

**Fix**: Mock `getCommonMaterial` at the top of the test file:

```typescript
vi.mock('../../src/components/hexagonoids/engine/commonMaterial', () => ({
  getCommonMaterial: vi.fn().mockReturnValue(null),
}))
```

The mock returns `null` because material assignment is not what's under test — only mesh creation and idempotency matter. Apply this mock to any test file that imports a module transitively touching `getCommonMaterial` (e.g., `initializeBulletMaster`, ship/rock node factories).

## Singleton Tests: Combine Creation and Idempotency

Module-level singletons (e.g., `bulletMaster` in `createBulletNodes.ts`) do not reset between Vitest test cases — there is no exported reset function. Splitting creation and idempotency into separate tests would require test ordering guarantees.

**Pattern**: Cover both in a single test case:

```typescript
it('creates bullet master and is idempotent', () => {
  const first = initializeBulletMaster(scene)
  expect(first).toBeDefined()
  const second = initializeBulletMaster(scene)
  expect(second).toBe(first)  // same reference — no double-init
})
```

If a reset is needed across test suites, export a `resetForTesting()` or restructure the singleton into a factory function.

## RockNodes Location

`RockNodes` is defined inline in `engine/nodeTypes.ts` alongside `ShipNodes`
and `BulletNodes`. Import from there — do NOT import from
`rock/createRockNodes.ts` (which only exports the creation function):

```typescript
import type { RockNodes } from '../engine/nodeTypes'
import { createRockNodes } from '../rock/createRockNodes'
```
