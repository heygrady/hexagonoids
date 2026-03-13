import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import '@babylonjs/core/Meshes/instancedMesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { createBulletNodePool } from '../../src/components/hexagonoids/engine/bulletNodePool'

import type { BulletNodes } from '../../src/components/hexagonoids/engine/nodeTypes'

describe('createBulletNodePool', () => {
  let scene: Scene
  let engine: NullEngine

  beforeEach(() => {
    engine = new NullEngine({
      renderHeight: 256,
      renderWidth: 256,
      textureSize: 256,
      deterministicLockstep: false,
      lockstepMaxSteps: 1,
    })
    scene = new Scene(engine)
  })

  afterEach(() => {
    scene.dispose()
    engine.dispose()
  })

  function createStubBulletNodes(): BulletNodes {
    const master = CreateBox('stubMaster', { size: 1 }, scene)
    const bulletNode = master.createInstance('bullet_stub')
    const originNode = new TransformNode('bulletOrigin_stub', scene)
    originNode.rotationQuaternion = Quaternion.Identity()
    bulletNode.parent = originNode
    bulletNode.isVisible = true
    originNode.setEnabled(true)
    return { originNode, bulletNode }
  }

  test('release hides bullet node and resets origin quaternion', () => {
    const pool = createBulletNodePool(scene)
    const nodes = createStubBulletNodes()

    // Rotate origin away from identity
    nodes.originNode.rotationQuaternion!.copyFromFloats(0.5, 0.5, 0.5, 0.5)

    pool.release(nodes)

    expect(nodes.bulletNode.isVisible).toBe(false)
    expect(nodes.originNode.isEnabled()).toBe(false)
    expect(nodes.originNode.rotationQuaternion!.x).toBe(0)
    expect(nodes.originNode.rotationQuaternion!.y).toBe(0)
    expect(nodes.originNode.rotationQuaternion!.z).toBe(0)
    expect(nodes.originNode.rotationQuaternion!.w).toBe(1)
  })

  test('each factory call produces an independent pool', () => {
    const pool1 = createBulletNodePool(scene)
    const pool2 = createBulletNodePool(scene)

    const nodes1 = createStubBulletNodes()
    nodes1.originNode.name = 'bulletOrigin_pool_bullet_0'
    pool1.release(nodes1)

    expect(pool1.size()).toBe(1)
    expect(pool2.size()).toBe(0)
  })
})
