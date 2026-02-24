/**
 * Quantitative tests for moveBullet — verify arc distance magnitudes.
 *
 * Key constants:
 *   BULLET_SPEED = MAX_SPEED = Math.PI / 10  — radians per second
 *   RADIUS = 5
 */
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { BulletState } from '../../../src/index.js'
import {
  BULLET_SPEED,
  greatCircleDistance,
  headingToAngularVelocity,
  latLngToQuaternion,
  moveBullet,
  RADIUS,
} from '../../../src/index.js'

function makeBullet(overrides: Partial<BulletState> = {}): BulletState {
  return {
    id: 'test-bullet',
    orientation: Quaternion.Identity(),
    lat: 0,
    lng: 0,
    angularVelocity: Vector3.Zero(),
    firedAt: null,
    ownerId: 'test-ship',
    ...overrides,
  }
}

describe('moveBullet — quantitative distance per frame', () => {
  it('travels the correct arc distance in one 16ms frame at BULLET_SPEED', () => {
    // A bullet at BULLET_SPEED rad/s for one 60fps frame (16ms) should travel:
    //   angle = BULLET_SPEED * (16 / 1000) radians
    //   arc   = angle * RADIUS meters
    const dtMs = 16
    const expectedAngle = BULLET_SPEED * (dtMs / 1000)
    const expectedArcDistance = expectedAngle * RADIUS

    const orientation = latLngToQuaternion(0, 0)
    const angularVelocity = headingToAngularVelocity(
      orientation,
      0,
      BULLET_SPEED
    )
    const bullet = makeBullet({ orientation, lat: 0, lng: 0, angularVelocity })
    const latBefore = bullet.lat
    const lngBefore = bullet.lng

    moveBullet(bullet, dtMs, RADIUS)

    const actualArcDistance = greatCircleDistance(
      latBefore,
      lngBefore,
      bullet.lat,
      bullet.lng,
      RADIUS
    )

    expect(actualArcDistance).toBeCloseTo(expectedArcDistance, 4)
  })

  it('travels 1000x less distance with dtMs=1 than dtMs=1000 (catches dt scaling bugs)', () => {
    // If the engine accidentally passed milliseconds where seconds are needed, the
    // bullet would move 1000x too far per frame. This test catches that class of bug.
    const orientation1 = latLngToQuaternion(0, 0)
    const bulletSmall = makeBullet({
      orientation: orientation1,
      lat: 0,
      lng: 0,
      angularVelocity: headingToAngularVelocity(orientation1, 0, BULLET_SPEED),
    })
    moveBullet(bulletSmall, 1, RADIUS)
    const distSmall = greatCircleDistance(
      0,
      0,
      bulletSmall.lat,
      bulletSmall.lng,
      RADIUS
    )

    const orientation2 = latLngToQuaternion(0, 0)
    const bulletBig = makeBullet({
      orientation: orientation2,
      lat: 0,
      lng: 0,
      angularVelocity: headingToAngularVelocity(orientation2, 0, BULLET_SPEED),
    })
    moveBullet(bulletBig, 1000, RADIUS)
    const distBig = greatCircleDistance(
      0,
      0,
      bulletBig.lat,
      bulletBig.lng,
      RADIUS
    )

    expect(distBig / distSmall).toBeCloseTo(1000, 2)
  })
})

describe('moveBullet — distance scales correctly with dtMs', () => {
  it('distance is proportional to dtMs for small angles', () => {
    const orientation = latLngToQuaternion(0, 0)

    const bullet16 = makeBullet({
      orientation,
      lat: 0,
      lng: 0,
      angularVelocity: headingToAngularVelocity(orientation, 0, BULLET_SPEED),
    })
    moveBullet(bullet16, 16, RADIUS)
    const dist16 = greatCircleDistance(0, 0, bullet16.lat, bullet16.lng, RADIUS)

    const bullet32 = makeBullet({
      orientation: latLngToQuaternion(0, 0),
      lat: 0,
      lng: 0,
      angularVelocity: headingToAngularVelocity(
        latLngToQuaternion(0, 0),
        0,
        BULLET_SPEED
      ),
    })
    moveBullet(bullet32, 32, RADIUS)
    const dist32 = greatCircleDistance(0, 0, bullet32.lat, bullet32.lng, RADIUS)

    expect(dist32 / dist16).toBeCloseTo(2, 4)
  })

  it('bullet arc distance matches expected value across a different starting position', () => {
    const dtMs = 16
    const lat = 30
    const lng = 45
    const expectedAngle = BULLET_SPEED * (dtMs / 1000)
    const expectedArcDistance = expectedAngle * RADIUS

    const orientation = latLngToQuaternion(lat, lng)
    const angularVelocity = headingToAngularVelocity(
      orientation,
      0,
      BULLET_SPEED
    )
    const bullet = makeBullet({ orientation, lat, lng, angularVelocity })
    const latBefore = bullet.lat
    const lngBefore = bullet.lng

    moveBullet(bullet, dtMs, RADIUS)

    const actualArcDistance = greatCircleDistance(
      latBefore,
      lngBefore,
      bullet.lat,
      bullet.lng,
      RADIUS
    )

    expect(actualArcDistance).toBeCloseTo(expectedArcDistance, 4)
  })
})
