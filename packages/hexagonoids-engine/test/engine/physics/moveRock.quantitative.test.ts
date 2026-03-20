/**
 * Quantitative tests for moveRock -- verify arc distance magnitudes.
 *
 * Key constants:
 *   ROCK_LARGE_SPEED, ROCK_MEDIUM_SPEED, ROCK_SMALL_SPEED -- radians per second
 *   RADIUS = 5
 */
import { describe, expect, it } from 'vitest'
import { vec3Zero } from '../../../src/features/engine/math/create.js'
import type { Vec3 } from '../../../src/features/engine/math/types.js'
import { latLngToQuaternion } from '../../../src/features/engine/physics/latLng.js'
import {
  headingToAngularVelocity,
  moveRock,
  RADIUS,
  ROCK_LARGE_SPEED,
  ROCK_MEDIUM_SPEED,
  ROCK_SMALL_SPEED,
} from '../../../src/index.js'
import { makeRock } from '../../helpers/entities.js'
import { pointFromLatLng } from '../../helpers/points.js'

function arcDistanceFromPoints(a: Vec3, b: Vec3): number {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  return Math.acos(dot) * RADIUS
}

describe('moveRock -- quantitative distance per frame', () => {
  it('large rock travels the correct arc distance in one 16ms frame', () => {
    const dtMs = 16
    const expectedAngle = ROCK_LARGE_SPEED * (dtMs / 1000)
    const expectedArcDistance = expectedAngle * RADIUS

    const orientation = latLngToQuaternion(0, 0)
    const start = pointFromLatLng(0, 0)
    const angularVelocity = vec3Zero()
    headingToAngularVelocity(angularVelocity, orientation, 0, ROCK_LARGE_SPEED)
    const rock = makeRock({
      orientation,
      position: start,
      angularVelocity,
      size: 2,
    })

    moveRock(rock, dtMs)

    const actualArcDistance = arcDistanceFromPoints(start, rock.position)
    expect(actualArcDistance).toBeCloseTo(expectedArcDistance, 4)
  })

  it('medium rock travels the correct arc distance in one 16ms frame', () => {
    const dtMs = 16
    const expectedAngle = ROCK_MEDIUM_SPEED * (dtMs / 1000)
    const expectedArcDistance = expectedAngle * RADIUS

    const orientation = latLngToQuaternion(0, 0)
    const start = pointFromLatLng(0, 0)
    const angularVelocity = vec3Zero()
    headingToAngularVelocity(angularVelocity, orientation, 0, ROCK_MEDIUM_SPEED)
    const rock = makeRock({
      orientation,
      position: start,
      angularVelocity,
      size: 1,
    })

    moveRock(rock, dtMs)

    const actualArcDistance = arcDistanceFromPoints(start, rock.position)
    expect(actualArcDistance).toBeCloseTo(expectedArcDistance, 4)
  })

  it('small rock travels the correct arc distance in one 16ms frame', () => {
    const dtMs = 16
    const expectedAngle = ROCK_SMALL_SPEED * (dtMs / 1000)
    const expectedArcDistance = expectedAngle * RADIUS

    const orientation = latLngToQuaternion(0, 0)
    const start = pointFromLatLng(0, 0)
    const angularVelocity = vec3Zero()
    headingToAngularVelocity(angularVelocity, orientation, 0, ROCK_SMALL_SPEED)
    const rock = makeRock({
      orientation,
      position: start,
      angularVelocity,
      size: 0,
    })

    moveRock(rock, dtMs)

    const actualArcDistance = arcDistanceFromPoints(start, rock.position)
    expect(actualArcDistance).toBeCloseTo(expectedArcDistance, 4)
  })

  it('small rock travels faster than large rock per frame', () => {
    const dtMs = 16

    const orientationLarge = latLngToQuaternion(0, 0)
    const start = pointFromLatLng(0, 0)
    const avLarge = vec3Zero()
    headingToAngularVelocity(avLarge, orientationLarge, 0, ROCK_LARGE_SPEED)
    const rockLarge = makeRock({
      orientation: orientationLarge,
      position: start,
      angularVelocity: avLarge,
      size: 2,
    })
    moveRock(rockLarge, dtMs)
    const distLarge = arcDistanceFromPoints(start, rockLarge.position)

    const orientationSmall = latLngToQuaternion(0, 0)
    const avSmall = vec3Zero()
    headingToAngularVelocity(avSmall, orientationSmall, 0, ROCK_SMALL_SPEED)
    const rockSmall = makeRock({
      orientation: orientationSmall,
      position: start,
      angularVelocity: avSmall,
      size: 0,
    })
    moveRock(rockSmall, dtMs)
    const distSmall = arcDistanceFromPoints(start, rockSmall.position)

    expect(distSmall).toBeGreaterThan(distLarge)
  })
})
