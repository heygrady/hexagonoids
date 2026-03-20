/**
 * Movement parity tests -- verify that moveShip, moveRock, moveBullet produce
 * correct results over many frames.
 *
 * The old "fast vs slow" parity tests are no longer needed since there is only
 * one code path now. These tests verify that movement over many steps stays
 * numerically stable and on the unit sphere.
 */
import { describe, expect, it } from 'vitest'
import { vec3Zero } from '../../../src/features/engine/math/create.js'
import { vec3Length } from '../../../src/features/engine/math/vec3.js'
import { latLngToQuaternion } from '../../../src/features/engine/physics/latLng.js'
import {
  headingToAngularVelocity,
  moveBullet,
  moveRock,
  moveShip,
} from '../../../src/index.js'
import { makeBullet, makeRock, makeShip } from '../../helpers/entities.js'
import { pointFromLatLng } from '../../helpers/points.js'

describe('movement stability over many steps', () => {
  it('moveShip stays on unit sphere over 120 frames', () => {
    const orientation = latLngToQuaternion(27, 61)
    const angularVelocity = vec3Zero()
    headingToAngularVelocity(angularVelocity, orientation, 0.85, 0.23)
    const startPoint = pointFromLatLng(27, 61)
    const ship = makeShip({
      orientation,
      position: startPoint,
      angularVelocity,
    })

    for (let i = 0; i < 120; i++) {
      moveShip(ship, 16)
    }

    expect(vec3Length(ship.position)).toBeCloseTo(1, 5)
    // Orientation should still be normalized
    const qLen = Math.sqrt(
      ship.orientation[0] ** 2 +
        ship.orientation[1] ** 2 +
        ship.orientation[2] ** 2 +
        ship.orientation[3] ** 2
    )
    expect(qLen).toBeCloseTo(1, 5)
  })

  it('moveRock stays on unit sphere over 160 frames', () => {
    const orientation = latLngToQuaternion(-34, 112)
    const angularVelocity = vec3Zero()
    headingToAngularVelocity(angularVelocity, orientation, -0.4, 0.19)
    const startPoint = pointFromLatLng(-34, 112)
    const rock = makeRock({
      orientation,
      position: startPoint,
      angularVelocity,
    })

    for (let i = 0; i < 160; i++) {
      moveRock(rock, 16)
    }

    expect(vec3Length(rock.position)).toBeCloseTo(1, 5)
    const qLen = Math.sqrt(
      rock.orientation[0] ** 2 +
        rock.orientation[1] ** 2 +
        rock.orientation[2] ** 2 +
        rock.orientation[3] ** 2
    )
    expect(qLen).toBeCloseTo(1, 5)
  })

  it('moveBullet stays on unit sphere over 90 frames', () => {
    const orientation = latLngToQuaternion(6, -145)
    const angularVelocity = vec3Zero()
    headingToAngularVelocity(angularVelocity, orientation, 1.3, 0.3)
    const startPoint = pointFromLatLng(6, -145)
    const bullet = makeBullet({
      orientation,
      position: startPoint,
      angularVelocity,
    })

    for (let i = 0; i < 90; i++) {
      moveBullet(bullet, 16)
    }

    expect(vec3Length(bullet.position)).toBeCloseTo(1, 5)
    const qLen = Math.sqrt(
      bullet.orientation[0] ** 2 +
        bullet.orientation[1] ** 2 +
        bullet.orientation[2] ** 2 +
        bullet.orientation[3] ** 2
    )
    expect(qLen).toBeCloseTo(1, 5)
  })
})
