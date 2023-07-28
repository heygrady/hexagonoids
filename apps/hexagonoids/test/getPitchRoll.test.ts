import { Vector3, Vector2, Quaternion } from '@babylonjs/core'
import { describe, expect, test } from 'vitest'

import { degToRad } from '../src/components/hexagonoids/geoCoords/degToRad'
import { getNextPoint } from '../src/components/hexagonoids/ship/getNextPoint'
import {
  arcDistanceTo,
  getPitchRoll,
} from '../src/components/hexagonoids/ship/getPitchRoll'

describe('arcDistanceTo', () => {
  test('up', () => {
    const point = new Vector2(0, 1)
    const distance = arcDistanceTo(point)
    expect(distance).toBeCloseTo(0)
  })
  test('forward', () => {
    const point = new Vector2(1, 0)
    const distance = arcDistanceTo(point)
    expect(distance).toBeCloseTo(Math.PI / 2)
  })
  test('down', () => {
    const point = new Vector2(0, -1)
    const distance = arcDistanceTo(point)
    expect(distance).toBeCloseTo(Math.PI)
  })
  test('backward', () => {
    const point = new Vector2(-1, 0)
    const distance = arcDistanceTo(point)
    expect(distance).toBeCloseTo(-Math.PI / 2)
  })
})

describe('getPitchRoll', () => {
  describe('pitch', () => {
    test('up', () => {
      const [pitch] = getPitchRoll(Vector3.Up())
      expect(pitch).toBeCloseTo(0)
    })

    test('down', () => {
      const [pitch] = getPitchRoll(Vector3.Down())
      expect(pitch).toBeCloseTo(Math.PI)
    })

    test('forward', () => {
      const [pitch] = getPitchRoll(Vector3.Forward())
      expect(pitch).toBeCloseTo(Math.PI / 2)
    })

    test('right', () => {
      const [pitch] = getPitchRoll(Vector3.Right())
      expect(pitch).toBeCloseTo(0)
    })

    test('backward', () => {
      const [pitch] = getPitchRoll(Vector3.Backward())
      expect(pitch).toBeCloseTo(-Math.PI / 2)
    })

    test('left', () => {
      const [pitch] = getPitchRoll(Vector3.Left())
      expect(pitch).toBeCloseTo(0)
    })
  })

  describe('roll', () => {
    test('up', () => {
      const [, roll] = getPitchRoll(Vector3.Up())
      expect(roll).toBeCloseTo(0)
    })

    test('down', () => {
      const [, roll] = getPitchRoll(Vector3.Down())
      expect(roll).toBeCloseTo(0)
    })

    test('forward', () => {
      const [, roll] = getPitchRoll(Vector3.Forward())
      expect(roll).toBeCloseTo(0)
    })

    test('right', () => {
      const [, roll] = getPitchRoll(Vector3.Right())
      expect(roll).toBeCloseTo(-Math.PI / 2)
    })

    test('backward', () => {
      const [, roll] = getPitchRoll(Vector3.Backward())
      expect(roll).toBeCloseTo(0)
    })

    test('left', () => {
      const [, roll] = getPitchRoll(Vector3.Left())
      expect(roll).toBeCloseTo(Math.PI / 2)
    })
  })

  describe('directions', () => {
    test('up', () => {
      const point = Vector3.Up()
      const [pitch, roll] = getPitchRoll(point)
      const rotationQuaternion = Quaternion.RotationYawPitchRoll(0, pitch, roll)

      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )
      expect(result).equalsWithEpsilon(point)
    })
    test('down', () => {
      const point = Vector3.Down()
      const [pitch, roll] = getPitchRoll(point)
      const rotationQuaternion = Quaternion.RotationYawPitchRoll(0, pitch, roll)

      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )
      expect(result).equalsWithEpsilon(point)
    })
    test('forward', () => {
      const point = Vector3.Forward()
      const [pitch, roll] = getPitchRoll(point)
      const rotationQuaternion = Quaternion.RotationYawPitchRoll(0, pitch, roll)

      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )
      expect(result).equalsWithEpsilon(point)
    })
    test('right', () => {
      const point = Vector3.Right()
      const [pitch, roll] = getPitchRoll(point)
      const rotationQuaternion = Quaternion.RotationYawPitchRoll(0, pitch, roll)

      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )
      expect(result).equalsWithEpsilon(point)
    })
    test('back', () => {
      const point = Vector3.Backward()
      const [pitch, roll] = getPitchRoll(point)
      const rotationQuaternion = Quaternion.RotationYawPitchRoll(0, pitch, roll)

      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )
      expect(result).equalsWithEpsilon(point)
    })
    test('left', () => {
      const point = Vector3.Left()
      const [pitch, roll] = getPitchRoll(point)
      const rotationQuaternion = Quaternion.RotationYawPitchRoll(0, pitch, roll)

      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )
      expect(result).equalsWithEpsilon(point)
    })
  })

  describe('diagonals', () => {
    test('yaw 1, pitch 1', () => {
      const point = getNextPoint(degToRad(1), degToRad(1))
      const [pitch, roll] = getPitchRoll(point)
      const rotationQuaternion = Quaternion.RotationYawPitchRoll(0, pitch, roll)
      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )
      expect(result).equalsWithEpsilon(point)
    })
    test('yaw 10, pitch 10', () => {
      const point = getNextPoint(degToRad(10), degToRad(10))
      const [pitch, roll] = getPitchRoll(point)
      const rotationQuaternion = Quaternion.RotationYawPitchRoll(0, pitch, roll)
      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )
      expect(result).equalsWithEpsilon(point)
    })
    test.skip('yaw 20, pitch 20', () => {
      const point = getNextPoint(degToRad(20), degToRad(20))
      const [pitch, roll] = getPitchRoll(point)
      const rotationQuaternion = Quaternion.RotationYawPitchRoll(0, pitch, roll)
      const result = new Vector3()
      Vector3.UpReadOnly.rotateByQuaternionAroundPointToRef(
        rotationQuaternion,
        Vector3.Zero(),
        result
      )
      expect(result).equalsWithEpsilon(point)
    })
  })
})
