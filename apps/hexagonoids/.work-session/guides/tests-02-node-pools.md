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

## RockNodes Location

`RockNodes` is defined inline in `engine/nodeTypes.ts` alongside `ShipNodes`
and `BulletNodes`. Import from there — do NOT import from
`rock/createRockNodes.ts` (which only exports the creation function):

```typescript
import type { RockNodes } from '../engine/nodeTypes'
import { createRockNodes } from '../rock/createRockNodes'
```
