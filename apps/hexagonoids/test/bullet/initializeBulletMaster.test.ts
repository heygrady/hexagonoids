import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Scene } from '@babylonjs/core/scene'
import { afterAll, describe, expect, test, vi } from 'vitest'

// Mock getCommonMaterial to avoid solid-js createUniqueId dependency
vi.mock('../../src/components/hexagonoids/common/commonMaterial', () => ({
  getCommonMaterial: () => null,
}))

import { initializeBulletMaster } from '../../src/components/hexagonoids/bullet/createBulletNodes'

describe('initializeBulletMaster', () => {
  // Module-level singleton — cannot reset between tests.
  const engine = new NullEngine({
    renderHeight: 256,
    renderWidth: 256,
    textureSize: 256,
    deterministicLockstep: false,
    lockstepMaxSteps: 1,
  })
  const scene = new Scene(engine)

  afterAll(() => {
    scene.dispose()
    engine.dispose()
  })

  test('creates bulletMaster mesh on first call and is idempotent on second call', () => {
    const meshCountBefore = scene.meshes.length

    initializeBulletMaster(scene)
    const meshCountAfterFirst = scene.meshes.length
    expect(meshCountAfterFirst).toBe(meshCountBefore + 1)

    const master = scene.getMeshByName('bulletMaster')
    expect(master).not.toBeNull()
    expect(master!.isVisible).toBe(false)

    // Second call should not create another mesh
    initializeBulletMaster(scene)
    expect(scene.meshes.length).toBe(meshCountAfterFirst)
  })
})
