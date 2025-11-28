import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { getYawPitch } from '../src/components/hexagonoids/ship/getYawPitch'

describe('getYawPitch', () => {
  test('up', () => {
    const [yaw, pitch] = getYawPitch(Vector3.Up())
    expect(yaw).toBeCloseTo(0)
    expect(pitch).toBeCloseTo(0)
  })

  test('forward', () => {
    const [yaw, pitch] = getYawPitch(Vector3.Forward())
    expect(yaw).toBeCloseTo(0)
    expect(pitch).toBeCloseTo(Math.PI / 2)
  })

  test('left', () => {
    const [yaw, pitch] = getYawPitch(Vector3.Left())
    expect(yaw).toBeCloseTo(-Math.PI / 2)
    expect(pitch).toBeCloseTo(Math.PI / 2)
  })

  test('down', () => {
    const [yaw, pitch] = getYawPitch(Vector3.Down())
    expect(yaw).toBeCloseTo(0)
    expect(pitch).toBeCloseTo(Math.PI)
  })

  test('backward', () => {
    const [yaw, pitch] = getYawPitch(Vector3.Backward())
    expect(yaw).toBeCloseTo(Math.PI)
    expect(pitch).toBeCloseTo(Math.PI / 2)
  })

  describe('with large radius', () => {
    test('up', () => {
      const [yaw, pitch] = getYawPitch(Vector3.Up().scaleInPlace(5))
      expect(yaw).toBeCloseTo(0)
      expect(pitch).toBeCloseTo(0)
    })

    test('forward', () => {
      const [yaw, pitch] = getYawPitch(Vector3.Forward().scaleInPlace(5))
      expect(yaw).toBeCloseTo(0)
      expect(pitch).toBeCloseTo(Math.PI / 2)
    })

    test('left', () => {
      const [yaw, pitch] = getYawPitch(Vector3.Left().scaleInPlace(5))
      expect(yaw).toBeCloseTo(-Math.PI / 2)
      expect(pitch).toBeCloseTo(Math.PI / 2)
    })

    test('down', () => {
      const [yaw, pitch] = getYawPitch(Vector3.Down().scaleInPlace(5))
      expect(yaw).toBeCloseTo(0)
      expect(pitch).toBeCloseTo(Math.PI)
    })

    test('backward', () => {
      const [yaw, pitch] = getYawPitch(Vector3.Backward().scaleInPlace(5))
      expect(yaw).toBeCloseTo(Math.PI)
      expect(pitch).toBeCloseTo(Math.PI / 2)
    })
  })

  describe('quaternion rotation', () => {
    test('from up to forward', () => {
      const to = Vector3.Forward()

      const [yaw, pitch] = getYawPitch(to)

      expect(yaw).toBeCloseTo(0)
      expect(pitch).toBeCloseTo(Math.PI / 2)

      const rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, pitch, 0)

      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )

      expect(result.x).toBeCloseTo(to.x)
      expect(result.y).toBeCloseTo(to.y)
      expect(result.z).toBeCloseTo(to.z)
    })

    test('from up to right', () => {
      const to = Vector3.Right()

      const [yaw, pitch] = getYawPitch(to)

      expect(yaw).toBeCloseTo(Math.PI / 2)
      expect(pitch).toBeCloseTo(Math.PI / 2)

      const rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, pitch, 0)

      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )

      expect(result.x).toBeCloseTo(to.x)
      expect(result.y).toBeCloseTo(to.y)
      expect(result.z).toBeCloseTo(to.z)
    })

    test('from up to down', () => {
      const to = Vector3.Down()

      const [yaw, pitch] = getYawPitch(to)
      expect(pitch).toBeCloseTo(Math.PI)

      const rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, pitch, 0)

      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )

      expect(result.x).toBeCloseTo(to.x)
      expect(result.y).toBeCloseTo(to.y)
      expect(result.z).toBeCloseTo(to.z)
    })
  })

  describe('rotate child', () => {
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

    test('child is initially up', () => {
      expect(child.absolutePosition).toEqual(Vector3.Up())
    })

    test('move to forward', () => {
      const [yaw, pitch] = getYawPitch(Vector3.Forward())

      const rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, pitch, 0)
      parent.rotationQuaternion =
        parent.rotationQuaternion.multiply(rotationQuaternion)

      computeWorldMatrix()

      expect(child.absolutePosition).equalsWithEpsilon(Vector3.Forward())
      expect(child.forward).equalsWithEpsilon(Vector3.Down())
    })

    test('move to down', () => {
      const [yaw, pitch] = getYawPitch(Vector3.Down())

      const rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, pitch, 0)
      parent.rotationQuaternion =
        parent.rotationQuaternion.multiply(rotationQuaternion)

      computeWorldMatrix()

      expect(child.absolutePosition).equalsWithEpsilon(Vector3.Down())
      expect(child.forward).equalsWithEpsilon(Vector3.Backward())
    })

    test('move to backward', () => {
      const [yaw, pitch] = getYawPitch(Vector3.Backward())

      const rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, pitch, 0)
      parent.rotationQuaternion =
        parent.rotationQuaternion.multiply(rotationQuaternion)

      computeWorldMatrix()

      expect(child.absolutePosition).equalsWithEpsilon(Vector3.Backward())
      expect(child.forward).equalsWithEpsilon(Vector3.Down())
    })

    test('move to left', () => {
      const [yaw, pitch] = getYawPitch(Vector3.Left())

      const rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, pitch, 0)
      parent.rotationQuaternion =
        parent.rotationQuaternion.multiply(rotationQuaternion)

      computeWorldMatrix()

      expect(child.absolutePosition).equalsWithEpsilon(Vector3.Left())
      expect(child.forward).equalsWithEpsilon(Vector3.Down())
    })

    test('move to right', () => {
      const [yaw, pitch] = getYawPitch(Vector3.Right())

      const rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, pitch, 0)
      parent.rotationQuaternion =
        parent.rotationQuaternion.multiply(rotationQuaternion)

      computeWorldMatrix()

      expect(child.absolutePosition).equalsWithEpsilon(Vector3.Right())
      expect(child.forward).equalsWithEpsilon(Vector3.Down())
    })

    describe('multiple twists and turns', () => {
      test('forward, forward, forward', () => {
        const moves: Vector3[] = [
          Vector3.Forward(),
          Vector3.Forward(),
          Vector3.Forward(),
        ]
        const target: Array<[position: Vector3, forward: Vector3]> = [
          [Vector3.Forward(), Vector3.Down()],
          [Vector3.Down(), Vector3.Backward()],
          [Vector3.Backward(), Vector3.Up()],
        ]
        for (const [i, move] of moves.entries()) {
          const [yaw, pitch] = getYawPitch(move)

          const rotationQuaternion = Quaternion.RotationYawPitchRoll(
            yaw,
            pitch,
            0
          )
          parent.rotationQuaternion =
            parent.rotationQuaternion.multiply(rotationQuaternion)

          computeWorldMatrix()
          expect(child.absolutePosition).equalsWithEpsilon(target[i][0])
          expect(child.forward).equalsWithEpsilon(target[i][1])
        }
      })

      test('right, right, right', () => {
        const moves: Vector3[] = [
          Vector3.Right(),
          Vector3.Right(),
          Vector3.Right(),
        ]
        const target: Array<[position: Vector3, forward: Vector3]> = [
          [Vector3.Right(), Vector3.Down()],
          [Vector3.Backward(), Vector3.Left()],
          [Vector3.Up(), Vector3.Forward()],
        ]
        for (const [i, move] of moves.entries()) {
          const [yaw, pitch] = getYawPitch(move)

          const rotationQuaternion = Quaternion.RotationYawPitchRoll(
            yaw,
            pitch,
            0
          )
          parent.rotationQuaternion =
            parent.rotationQuaternion.multiply(rotationQuaternion)

          computeWorldMatrix()
          expect(child.absolutePosition).equalsWithEpsilon(target[i][0])
          expect(child.forward).equalsWithEpsilon(target[i][1])
        }
      })

      test('down, down, down', () => {
        const moves: Vector3[] = [
          Vector3.Down(),
          Vector3.Down(),
          Vector3.Down(),
        ]
        const target: Array<[position: Vector3, forward: Vector3]> = [
          [Vector3.Down(), Vector3.Backward()],
          [Vector3.Up(), Vector3.Forward()],
          [Vector3.Down(), Vector3.Backward()],
        ]
        for (const [i, move] of moves.entries()) {
          const [yaw, pitch] = getYawPitch(move)

          const rotationQuaternion = Quaternion.RotationYawPitchRoll(
            yaw,
            pitch,
            0
          )
          parent.rotationQuaternion =
            parent.rotationQuaternion.multiply(rotationQuaternion)

          computeWorldMatrix()
          expect(child.absolutePosition).equalsWithEpsilon(target[i][0])
          expect(child.forward).equalsWithEpsilon(target[i][1])
        }
      })
    })
  })
})
