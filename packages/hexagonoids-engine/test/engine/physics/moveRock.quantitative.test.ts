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
  greatCircleDistance,
  headingToAngularVelocity,
  latLngToQuaternion,
  moveRock,
  RADIUS,
  ROCK_LARGE_SPEED,
  ROCK_MEDIUM_SPEED,
  ROCK_SMALL_SPEED,
} from '../../../src/index.js'

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
    const latBefore = rock.lat
    const lngBefore = rock.lng

    moveRock(rock, dtMs, RADIUS)

    const actualArcDistance = greatCircleDistance(
      latBefore,
      lngBefore,
      rock.lat,
      rock.lng,
      RADIUS
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
    const latBefore = rock.lat
    const lngBefore = rock.lng

    moveRock(rock, dtMs, RADIUS)

    const actualArcDistance = greatCircleDistance(
      latBefore,
      lngBefore,
      rock.lat,
      rock.lng,
      RADIUS
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
    const latBefore = rock.lat
    const lngBefore = rock.lng

    moveRock(rock, dtMs, RADIUS)

    const actualArcDistance = greatCircleDistance(
      latBefore,
      lngBefore,
      rock.lat,
      rock.lng,
      RADIUS
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
    const distLarge = greatCircleDistance(
      0,
      0,
      rockLarge.lat,
      rockLarge.lng,
      RADIUS
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
    const distSmall = greatCircleDistance(
      0,
      0,
      rockSmall.lat,
      rockSmall.lng,
      RADIUS
    )

    expect(distSmall).toBeGreaterThan(distLarge)
  })
})
