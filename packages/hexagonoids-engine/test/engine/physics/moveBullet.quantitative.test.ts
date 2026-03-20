/**
 * Quantitative tests for moveBullet -- verify arc distance magnitudes.
 *
 * Key constants:
 *   BULLET_SPEED = MAX_SPEED = Math.PI / 10  -- radians per second
 *   RADIUS = 5
 */
import { describe, expect, it } from 'vitest'
import { vec3Zero } from '../../../src/features/engine/math/create.js'
import type { Vec3 } from '../../../src/features/engine/math/types.js'
import { latLngToQuaternion } from '../../../src/features/engine/physics/latLng.js'
import {
  BULLET_SPEED,
  headingToAngularVelocity,
  moveBullet,
  RADIUS,
} from '../../../src/index.js'
import { makeBullet } from '../../helpers/entities.js'
import { pointFromLatLng } from '../../helpers/points.js'

function arcDistanceFromPoints(a: Vec3, b: Vec3): number {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  return Math.acos(dot) * RADIUS
}

describe('moveBullet -- quantitative distance per frame', () => {
  it('travels the correct arc distance in one 16ms frame at BULLET_SPEED', () => {
    const dtMs = 16
    const expectedAngle = BULLET_SPEED * (dtMs / 1000)
    const expectedArcDistance = expectedAngle * RADIUS

    const orientation = latLngToQuaternion(0, 0)
    const angularVelocity = vec3Zero()
    headingToAngularVelocity(angularVelocity, orientation, 0, BULLET_SPEED)
    const start = pointFromLatLng(0, 0)
    const bullet = makeBullet({
      orientation,
      position: start,
      angularVelocity,
    })

    moveBullet(bullet, dtMs)

    const actualArcDistance = arcDistanceFromPoints(start, bullet.position)
    expect(actualArcDistance).toBeCloseTo(expectedArcDistance, 4)
  })

  it('travels 1000x less distance with dtMs=1 than dtMs=1000 (catches dt scaling bugs)', () => {
    const orientation1 = latLngToQuaternion(0, 0)
    const start = pointFromLatLng(0, 0)
    const av1 = vec3Zero()
    headingToAngularVelocity(av1, orientation1, 0, BULLET_SPEED)
    const bulletSmall = makeBullet({
      orientation: orientation1,
      position: start,
      angularVelocity: av1,
    })
    moveBullet(bulletSmall, 1)
    const refPoint = pointFromLatLng(0, 0)
    const distSmall = arcDistanceFromPoints(refPoint, bulletSmall.position)

    const orientation2 = latLngToQuaternion(0, 0)
    const av2 = vec3Zero()
    headingToAngularVelocity(av2, orientation2, 0, BULLET_SPEED)
    const bulletBig = makeBullet({
      orientation: orientation2,
      position: pointFromLatLng(0, 0),
      angularVelocity: av2,
    })
    moveBullet(bulletBig, 1000)
    const distBig = arcDistanceFromPoints(refPoint, bulletBig.position)

    expect(distBig / distSmall).toBeCloseTo(1000, 2)
  })
})

describe('moveBullet -- distance scales correctly with dtMs', () => {
  it('distance is proportional to dtMs for small angles', () => {
    const orientation = latLngToQuaternion(0, 0)
    const start = pointFromLatLng(0, 0)

    const av16 = vec3Zero()
    headingToAngularVelocity(av16, orientation, 0, BULLET_SPEED)
    const bullet16 = makeBullet({
      orientation,
      position: start,
      angularVelocity: av16,
    })
    moveBullet(bullet16, 16)
    const refPoint = pointFromLatLng(0, 0)
    const dist16 = arcDistanceFromPoints(refPoint, bullet16.position)

    const orientation32 = latLngToQuaternion(0, 0)
    const av32 = vec3Zero()
    headingToAngularVelocity(av32, orientation32, 0, BULLET_SPEED)
    const bullet32 = makeBullet({
      orientation: orientation32,
      position: pointFromLatLng(0, 0),
      angularVelocity: av32,
    })
    moveBullet(bullet32, 32)
    const dist32 = arcDistanceFromPoints(refPoint, bullet32.position)

    expect(dist32 / dist16).toBeCloseTo(2, 4)
  })

  it('bullet arc distance matches expected value across a different starting position', () => {
    const dtMs = 16
    const lat = 30
    const lng = 45
    const expectedAngle = BULLET_SPEED * (dtMs / 1000)
    const expectedArcDistance = expectedAngle * RADIUS

    const orientation = latLngToQuaternion(lat, lng)
    const start = pointFromLatLng(lat, lng)
    const angularVelocity = vec3Zero()
    headingToAngularVelocity(angularVelocity, orientation, 0, BULLET_SPEED)
    const bullet = makeBullet({
      orientation,
      position: start,
      angularVelocity,
    })

    moveBullet(bullet, dtMs)

    const actualArcDistance = arcDistanceFromPoints(start, bullet.position)
    expect(actualArcDistance).toBeCloseTo(expectedArcDistance, 4)
  })
})
