import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { beforeEach, afterEach, describe, expect, test } from 'vitest'

import { getNextPosition } from '../src/components/hexagonoids/ship/getNextPosition'
import { moveNodeBy } from '../src/components/hexagonoids/ship/orientation'

describe('getNextPosition', () => {
  let scene: Scene
  let child: TransformNode
  let parent: TransformNode

  const computeWorldMatrix = () => {
    // refresh the scene
    scene.updateTransformMatrix()
    parent.computeWorldMatrix(true)
    child.computeWorldMatrix(true)
  }

  beforeEach(() => {
    const engine = new NullEngine({
      renderHeight: 256,
      renderWidth: 256,
      textureSize: 256,
      deterministicLockstep: false,
      lockstepMaxSteps: 1,
    })
    scene = new Scene(engine)

    child = new TransformNode('child', scene)
    parent = new TransformNode('parent', scene)
    child.parent = parent

    parent.rotationQuaternion = Quaternion.Identity()
    parent.position = Vector3.Zero()
    child.position = Vector3.Up()

    computeWorldMatrix()
  })

  afterEach(() => {
    scene.dispose()
    child.dispose()
    parent.dispose()
  })

  describe('from child in up', () => {
    test('child is initially up', () => {
      expect(child.absolutePosition).toEqual(Vector3.Up())
    })

    test('to forward', () => {
      const nextPosition = getNextPosition(child, 0, Math.PI / 2, 1)
      expect(nextPosition).equalsWithEpsilon(Vector3.Forward())
    })

    test('to right', () => {
      const nextPosition = getNextPosition(child, Math.PI / 2, Math.PI / 2, 1)
      expect(nextPosition).equalsWithEpsilon(Vector3.Right(), 1)
    })

    test('to backward', () => {
      const nextPosition = getNextPosition(child, 0, -Math.PI / 2, 1)
      expect(nextPosition).equalsWithEpsilon(Vector3.Backward(), 1)
    })

    test('to left', () => {
      const nextPosition = getNextPosition(child, -Math.PI / 2, Math.PI / 2, 1)
      expect(nextPosition).equalsWithEpsilon(Vector3.Left())
    })
  })

  describe('from child in right', () => {
    beforeEach(() => {
      moveNodeBy(parent, Math.PI / 2, Math.PI / 2)
      computeWorldMatrix()
    })
    test('child is initially right', () => {
      expect(child.absolutePosition).equalsWithEpsilon(Vector3.Right())
    })

    test('to forward', () => {
      const nextPosition = getNextPosition(child, 0, Math.PI / 2, 1)
      expect(nextPosition).equalsWithEpsilon(Vector3.Down())
    })

    test('to right', () => {
      const nextPosition = getNextPosition(child, Math.PI / 2, Math.PI / 2, 1)
      expect(nextPosition).equalsWithEpsilon(Vector3.Backward(), 1)
    })

    test('to backward', () => {
      const nextPosition = getNextPosition(child, 0, -Math.PI / 2, 1)
      expect(nextPosition).equalsWithEpsilon(Vector3.Up(), 1)
    })

    test('to left', () => {
      const nextPosition = getNextPosition(child, -Math.PI / 2, Math.PI / 2, 1)
      expect(nextPosition).equalsWithEpsilon(Vector3.Forward())
    })
  })
})
