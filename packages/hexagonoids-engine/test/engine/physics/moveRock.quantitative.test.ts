/**
 * Quantitative tests for moveRock — verify arc distance magnitudes.
 *
 * Key constants:
 *   ROCK_LARGE_SPEED, ROCK_MEDIUM_SPEED, ROCK_SMALL_SPEED — radians per second
 *   RADIUS = 5
 */
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { RockState } from '../../../src/index.js'
import {
  headingToAngularVelocity,
  latLngToQuaternion,
  latLngToSpatialPoint,
  moveRock,
  RADIUS,
  ROCK_LARGE_SPEED,
  ROCK_MEDIUM_SPEED,
  ROCK_SMALL_SPEED,
} from '../../../src/index.js'

function arcDistanceFromPoints(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  const dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))
  return Math.acos(dot) * RADIUS
}

function makeRock(overrides: Partial<RockState> = {}): RockState {
  return {
    id: 'test-rock',
    orientation: Quaternion.Identity(),
    lat: 0,
    lng: 0,
    angularVelocity: Vector3.Zero(),
    size: 2,
    value: 50,
    ...overrides,
  }
}

describe('moveRock — quantitative distance per frame', () => {
  it('large rock travels the correct arc distance in one 16ms frame', () => {
    const dtMs = 16
    const expectedAngle = ROCK_LARGE_SPEED * (dtMs / 1000)
    const expectedArcDistance = expectedAngle * RADIUS

    const orientation = latLngToQuaternion(0, 0)
    const rock = makeRock({
      orientation,
      lat: 0,
      lng: 0,
      angularVelocity: headingToAngularVelocity(
        orientation,
        0,
        ROCK_LARGE_SPEED
      ),
      size: 2,
    })
    const start = latLngToSpatialPoint(0, 0)

    moveRock(rock, dtMs, RADIUS)

    const actualArcDistance = arcDistanceFromPoints(
      start.x,
      start.y,
      start.z,
      rock.x ?? 0,
      rock.y ?? 1,
      rock.z ?? 0
    )

    expect(actualArcDistance).toBeCloseTo(expectedArcDistance, 4)
  })

  it('medium rock travels the correct arc distance in one 16ms frame', () => {
    const dtMs = 16
    const expectedAngle = ROCK_MEDIUM_SPEED * (dtMs / 1000)
    const expectedArcDistance = expectedAngle * RADIUS

    const orientation = latLngToQuaternion(0, 0)
    const rock = makeRock({
      orientation,
      lat: 0,
      lng: 0,
      angularVelocity: headingToAngularVelocity(
        orientation,
        0,
        ROCK_MEDIUM_SPEED
      ),
      size: 1,
    })
    const start = latLngToSpatialPoint(0, 0)

    moveRock(rock, dtMs, RADIUS)

    const actualArcDistance = arcDistanceFromPoints(
      start.x,
      start.y,
      start.z,
      rock.x ?? 0,
      rock.y ?? 1,
      rock.z ?? 0
    )

    expect(actualArcDistance).toBeCloseTo(expectedArcDistance, 4)
  })

  it('small rock travels the correct arc distance in one 16ms frame', () => {
    const dtMs = 16
    const expectedAngle = ROCK_SMALL_SPEED * (dtMs / 1000)
    const expectedArcDistance = expectedAngle * RADIUS

    const orientation = latLngToQuaternion(0, 0)
    const rock = makeRock({
      orientation,
      lat: 0,
      lng: 0,
      angularVelocity: headingToAngularVelocity(
        orientation,
        0,
        ROCK_SMALL_SPEED
      ),
      size: 0,
    })
    const start = latLngToSpatialPoint(0, 0)

    moveRock(rock, dtMs, RADIUS)

    const actualArcDistance = arcDistanceFromPoints(
      start.x,
      start.y,
      start.z,
      rock.x ?? 0,
      rock.y ?? 1,
      rock.z ?? 0
    )

    expect(actualArcDistance).toBeCloseTo(expectedArcDistance, 4)
  })

  it('small rock travels faster than large rock per frame', () => {
    const dtMs = 16

    const orientationLarge = latLngToQuaternion(0, 0)
    const rockLarge = makeRock({
      orientation: orientationLarge,
      lat: 0,
      lng: 0,
      angularVelocity: headingToAngularVelocity(
        orientationLarge,
        0,
        ROCK_LARGE_SPEED
      ),
      size: 2,
    })
    moveRock(rockLarge, dtMs, RADIUS)
    const start = latLngToSpatialPoint(0, 0)
    const distLarge = arcDistanceFromPoints(
      start.x,
      start.y,
      start.z,
      rockLarge.x ?? 0,
      rockLarge.y ?? 1,
      rockLarge.z ?? 0
    )

    const orientationSmall = latLngToQuaternion(0, 0)
    const rockSmall = makeRock({
      orientation: orientationSmall,
      lat: 0,
      lng: 0,
      angularVelocity: headingToAngularVelocity(
        orientationSmall,
        0,
        ROCK_SMALL_SPEED
      ),
      size: 0,
    })
    moveRock(rockSmall, dtMs, RADIUS)
    const distSmall = arcDistanceFromPoints(
      start.x,
      start.y,
      start.z,
      rockSmall.x ?? 0,
      rockSmall.y ?? 1,
      rockSmall.z ?? 0
    )

    expect(distSmall).toBeGreaterThan(distLarge)
  })
})
