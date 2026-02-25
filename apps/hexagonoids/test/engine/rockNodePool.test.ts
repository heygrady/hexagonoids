import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { RockNodes } from '../../src/components/hexagonoids/engine/nodeTypes'
import { createRockNodePool } from '../../src/components/hexagonoids/engine/rockNodePool'

describe('createRockNodePool', () => {
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

  function createStubRockNodes(): RockNodes {
    const rockNode = CreateBox('rock_stub', { size: 1 }, scene)
    const originNode = new TransformNode('rockOrigin_stub', scene)
    const orientationNode = new TransformNode('rockOrientation_stub', scene)
    originNode.rotationQuaternion = Quaternion.Identity()
    rockNode.isVisible = true
    originNode.setEnabled(true)
    return { originNode, orientationNode, rockNode }
  }

  test('release hides rock node and resets origin quaternion', () => {
    const pool = createRockNodePool(scene)
    const nodes = createStubRockNodes()

    // Rotate origin away from identity
    nodes.originNode.rotationQuaternion!.copyFromFloats(0.7, 0, 0.7, 0)

    pool.release(nodes)

    expect(nodes.rockNode.isVisible).toBe(false)
    expect(nodes.originNode.isEnabled()).toBe(false)
    expect(nodes.originNode.rotationQuaternion!.x).toBe(0)
    expect(nodes.originNode.rotationQuaternion!.y).toBe(0)
    expect(nodes.originNode.rotationQuaternion!.z).toBe(0)
    expect(nodes.originNode.rotationQuaternion!.w).toBe(1)
  })

  test('each factory call produces an independent pool', () => {
    const pool1 = createRockNodePool(scene)
    const pool2 = createRockNodePool(scene)

    const nodes = createStubRockNodes()
    pool1.release(nodes)

    expect(pool1.size()).toBe(1)
    expect(pool2.size()).toBe(0)
  })
})
