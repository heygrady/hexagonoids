import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { describe, expect, test } from 'vitest'

import {
  accelerateHeadingSpeed,
  applyFrictionHeadingSpeed,
  headingSpeedToVector3,
  vector3ToHeadingSpeed,
} from '../src/components/hexagonoids/ship/velocity'

describe('headingSpeedToVector3', () => {
  test('to forward', () => {
    const velocity = headingSpeedToVector3(0, Math.PI / 2)
    expect(velocity).equalsWithEpsilon(new Vector3(0, 1, 1))
  })
  test('to right', () => {
    const velocity = headingSpeedToVector3(Math.PI / 2, Math.PI / 2)
    expect(velocity).equalsWithEpsilon(new Vector3(1, 1, 0))
  })
  test('to backward', () => {
    const velocity = headingSpeedToVector3(0, -Math.PI / 2)
    expect(velocity).equalsWithEpsilon(new Vector3(0, 1, -1))
  })
  test('to left', () => {
    const velocity = headingSpeedToVector3(-Math.PI / 2, Math.PI / 2)
    expect(velocity).equalsWithEpsilon(new Vector3(-1, 1, 0))
  })
})

describe('vector3ToHeadingSpeed', () => {
  test('from forward', () => {
    const velocity = headingSpeedToVector3(0, Math.PI / 2)
    expect(velocity).equalsWithEpsilon(new Vector3(0, 1, 1))
    const [heading, speed] = vector3ToHeadingSpeed(velocity)
    expect(heading).toBeCloseTo(0)
    expect(speed).toBeCloseTo(Math.PI / 2)
  })
})

describe('accelerateHeadingSpeed', () => {
  test('from forward to right', () => {
    const [heading, speed] = accelerateHeadingSpeed(
      0,
      Math.PI / 2,
      Math.PI / 2,
      Math.PI / 2
    )
    expect(heading).toBeCloseTo(Math.PI / 4)
    expect(speed).toBeCloseTo(Math.PI * 0.697) // why?
  })
})

describe('applyFrictionHeadingSpeed', () => {
  const frictionCoefficient = 0.1

  test('from forward', () => {
    const [heading, speed] = applyFrictionHeadingSpeed(
      0,
      Math.PI / 2,
      frictionCoefficient
    )
    expect(heading).toBeCloseTo(0)
    expect(speed).toBeCloseTo((Math.PI / 2) * 0.9) // why?
  })
})
