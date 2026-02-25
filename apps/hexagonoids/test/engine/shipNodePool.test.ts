import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import '@babylonjs/core/Meshes/instancedMesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { ShipNodes } from '../../src/components/hexagonoids/engine/nodeTypes'
import { createShipNodePool } from '../../src/components/hexagonoids/engine/shipNodePool'

describe('createShipNodePool', () => {
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

  function createStubShipNodes(): ShipNodes {
    const master = CreateBox('stubShipMaster', { size: 1 }, scene)
    const shipNode = master.createInstance('ship_stub')
    const shipTailNode = master.createInstance('shipTail_stub')
    const originNode = new TransformNode('originNode_stub', scene)
    const positionNode = new TransformNode('positionNode_stub', scene)
    const orientationNode = new TransformNode('orientationNode_stub', scene)

    originNode.rotationQuaternion = Quaternion.Identity()
    orientationNode.rotationQuaternion = Quaternion.Identity()
    shipNode.isVisible = true
    shipTailNode.isVisible = true
    originNode.setEnabled(true)

    return { originNode, positionNode, orientationNode, shipNode, shipTailNode }
  }

  test('release hides both ship nodes and resets both quaternions', () => {
    const pool = createShipNodePool(scene)
    const nodes = createStubShipNodes()

    // Rotate both quaternions away from identity
    nodes.originNode.rotationQuaternion!.copyFromFloats(0.5, 0.5, 0.5, 0.5)
    nodes.orientationNode.rotationQuaternion!.copyFromFloats(0, 0.7, 0, 0.7)

    pool.release(nodes)

    expect(nodes.shipNode.isVisible).toBe(false)
    expect(nodes.shipTailNode.isVisible).toBe(false)
    expect(nodes.originNode.isEnabled()).toBe(false)

    // Origin quaternion reset to identity
    expect(nodes.originNode.rotationQuaternion!.x).toBe(0)
    expect(nodes.originNode.rotationQuaternion!.y).toBe(0)
    expect(nodes.originNode.rotationQuaternion!.z).toBe(0)
    expect(nodes.originNode.rotationQuaternion!.w).toBe(1)

    // Orientation quaternion reset to identity
    expect(nodes.orientationNode.rotationQuaternion!.x).toBe(0)
    expect(nodes.orientationNode.rotationQuaternion!.y).toBe(0)
    expect(nodes.orientationNode.rotationQuaternion!.z).toBe(0)
    expect(nodes.orientationNode.rotationQuaternion!.w).toBe(1)
  })

  test('each factory call produces an independent pool', () => {
    const pool1 = createShipNodePool(scene)
    const pool2 = createShipNodePool(scene)

    const nodes = createStubShipNodes()
    pool1.release(nodes)

    expect(pool1.size()).toBe(1)
    expect(pool2.size()).toBe(0)
  })
})
