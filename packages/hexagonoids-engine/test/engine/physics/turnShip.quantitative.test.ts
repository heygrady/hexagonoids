/**
 * Quantitative tests for turnShip — verify yaw change magnitudes.
 *
 * Key constants:
 *   TURN_RATE = 2.2 * Math.PI  — radians per second
 *   MAX_DURATION = 1000        — milliseconds for full easing
 */
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import { latLngToQuaternion } from '../../../src/features/engine/physics/latLng.js'
import type { ShipState } from '../../../src/index.js'
import { MAX_DURATION, TURN_RATE, turnShip } from '../../../src/index.js'
import { pointFromLatLng } from '../../helpers/points.js'

function makeShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    id: 'test-ship',
    playerId: 'p1',
    orientation: Quaternion.Identity(),
    ...pointFromLatLng(0, 0),
    angularVelocity: Vector3.Zero(),
    yaw: 0,
    alive: true,
    firedAt: null,
    ...overrides,
  }
}

function makeShipAt(lat: number, lng: number): ShipState {
  return makeShip({
    orientation: latLngToQuaternion(lat, lng),
    ...pointFromLatLng(lat, lng),
  })
}

describe('turnShip — quantitative yaw change per frame', () => {
  it('yaw changes by the correct amount at full easing (duration=MAX_DURATION)', () => {
    // At duration=MAX_DURATION, t=1, easeCircleOut(1) = sqrt(1-(1-1)^2) = 1
    const dtMs = 16
    const t = 1
    const et = Math.sqrt(1 - (t - 1) ** 2)
    const expectedYawChange = ((et * TURN_RATE) / 1000) * dtMs

    const ship = makeShip()
    turnShip(ship, 1, dtMs, MAX_DURATION)

    expect(ship.yaw).toBeCloseTo(expectedYawChange, 5)
  })

  it('yaw does not change at zero easing (duration=0)', () => {
    // At duration=0, t=0, easeCircleOut(0) = 0
    const ship = makeShip()
    turnShip(ship, 1, 16, 0)

    expect(ship.yaw).toBeCloseTo(0, 10)
  })

  it('left turn produces negative yaw change at full easing', () => {
    const dtMs = 16
    const t = 1
    const et = Math.sqrt(1 - (t - 1) ** 2)
    const expectedYawChange = -((et * TURN_RATE) / 1000) * dtMs

    const ship = makeShip()
    turnShip(ship, -1, dtMs, MAX_DURATION)

    expect(ship.yaw).toBeCloseTo(expectedYawChange, 5)
  })

  it('turn rate is proportional to dtMs (frame-rate independent)', () => {
    const ship1 = makeShip()
    turnShip(ship1, 1, 16, MAX_DURATION)

    const ship2 = makeShip()
    turnShip(ship2, 1, 32, MAX_DURATION)

    expect(ship2.yaw).toBeCloseTo(ship1.yaw * 2, 5)
  })

  it('yaw change at partial easing (duration=MAX_DURATION/2) is in expected range', () => {
    // At t=0.5, easeCircleOut(0.5) = sqrt(1-(0.5-1)^2) = sqrt(0.75) ≈ 0.866
    const dtMs = 16
    const t = 0.5
    const et = Math.sqrt(1 - (t - 1) ** 2)
    const expectedYawChange = ((et * TURN_RATE) / 1000) * dtMs

    const ship = makeShip()
    turnShip(ship, 1, dtMs, MAX_DURATION / 2)

    expect(ship.yaw).toBeCloseTo(expectedYawChange, 5)
  })
})

describe('turnShip — yaw accumulates correctly across multiple frames', () => {
  it('yaw accumulates linearly across 10 frames at full easing', () => {
    const dtMs = 16
    const t = 1
    const et = Math.sqrt(1 - (t - 1) ** 2)
    const yawPerFrame = ((et * TURN_RATE) / 1000) * dtMs

    const ship = makeShipAt(0, 0)
    for (let i = 0; i < 10; i++) {
      turnShip(ship, 1, dtMs, MAX_DURATION)
    }

    expect(ship.yaw).toBeCloseTo(yawPerFrame * 10, 4)
  })
})
