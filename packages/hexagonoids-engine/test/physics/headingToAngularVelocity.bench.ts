import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { bench, describe, expect, it } from 'vitest'

import { headingToAngularVelocity } from '../../src/features/engine/physics/quaternionPhysics.js'

/**
 * Reference BabylonJS implementation — the original code before scalar optimization.
 * Used as the control for correctness tests.
 */
function headingToAngularVelocityBabylon(
  positionQuaternion: Quaternion,
  localHeading: number,
  speed: number
): Vector3 {
  if (speed < 0.00001) {
    return Vector3.Zero()
  }

  const worldUp = Vector3.Up().applyRotationQuaternion(positionQuaternion)

  const localHeadingRotation = Quaternion.RotationAxis(
    Vector3.Up(),
    localHeading
  )
  const localHeading3D =
    Vector3.Forward().applyRotationQuaternion(localHeadingRotation)
  const worldHeading =
    localHeading3D.applyRotationQuaternion(positionQuaternion)

  const rotationAxis = Vector3.Cross(worldUp, worldHeading)
  const axisLen = rotationAxis.length()
  if (axisLen < 0.00001) {
    return Vector3.Zero()
  }

  rotationAxis.scaleInPlace(1 / axisLen)
  return rotationAxis.scale(speed)
}

// Test quaternions representing various orientations on the sphere
const testCases = [
  {
    name: 'identity',
    q: new Quaternion(0, 0, 0, 1),
    heading: 0,
    speed: 1,
  },
  {
    name: 'rotated 90° around Y',
    q: Quaternion.RotationYawPitchRoll(Math.PI / 2, 0, 0),
    heading: 0,
    speed: 2,
  },
  {
    name: 'tilted with heading',
    q: Quaternion.RotationYawPitchRoll(0.3, 0.5, 0.1),
    heading: Math.PI / 4,
    speed: 1.5,
  },
  {
    name: 'arbitrary orientation + heading',
    q: Quaternion.RotationYawPitchRoll(1.2, -0.7, 0.4),
    heading: -Math.PI / 3,
    speed: 0.8,
  },
  {
    name: 'near-pole orientation',
    q: Quaternion.RotationYawPitchRoll(0, Math.PI / 2 - 0.01, 0),
    heading: Math.PI,
    speed: 3,
  },
]

describe('headingToAngularVelocity correctness', () => {
  for (const tc of testCases) {
    it(`matches BabylonJS reference: ${tc.name}`, () => {
      const scalar = headingToAngularVelocity(tc.q, tc.heading, tc.speed)
      const babylon = headingToAngularVelocityBabylon(tc.q, tc.heading, tc.speed)

      expect(scalar.x).toBeCloseTo(babylon.x, 10)
      expect(scalar.y).toBeCloseTo(babylon.y, 10)
      expect(scalar.z).toBeCloseTo(babylon.z, 10)
    })
  }

  it('returns zero for zero speed', () => {
    const q = Quaternion.RotationYawPitchRoll(0.5, 0.3, 0.1)
    const result = headingToAngularVelocity(q, Math.PI / 4, 0)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })
})

describe('headingToAngularVelocity benchmark', () => {
  const q = Quaternion.RotationYawPitchRoll(1.2, -0.7, 0.4)

  bench('scalar (current)', () => {
    headingToAngularVelocity(q, -Math.PI / 3, 0.8)
  })

  bench('BabylonJS (reference)', () => {
    headingToAngularVelocityBabylon(q, -Math.PI / 3, 0.8)
  })
})
