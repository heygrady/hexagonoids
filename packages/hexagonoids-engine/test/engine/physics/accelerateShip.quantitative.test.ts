/**
 * Quantitative tests for accelerateShip — verify velocity and friction magnitudes.
 *
 * Key constants:
 *   MAX_SPEED = Math.PI / 10              — max speed in radians per second
 *   ACCELERATION_RATE = MAX_SPEED * 1.55  — radians per second
 *   FRICTION_COEFFICIENT = 0.35
 *   MAX_DURATION = 1000                   — milliseconds for full easing
 */
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { ShipState } from '../../../src/index.js'
import {
  ACCELERATION_RATE,
  accelerateShip,
  FRICTION_COEFFICIENT,
  MAX_DURATION,
  MAX_SPEED,
} from '../../../src/index.js'

function makeShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    id: 'test-ship',
    playerId: 'p1',
    orientation: Quaternion.Identity(),
    lat: 0,
    lng: 0,
    angularVelocity: Vector3.Zero(),
    yaw: 0,
    alive: true,
    firedAt: null,
    ...overrides,
  }
}

describe('accelerateShip — quantitative velocity increase per frame', () => {
  it('velocity increases by the correct amount at full easing (duration=MAX_DURATION)', () => {
    // At duration=MAX_DURATION, t=1, easeQuadOut(1) = 1*(2-1) = 1
    // accelMagnitude = ACCELERATION_RATE / 1000 * dtMs
    const dtMs = 16
    const halfRate = ACCELERATION_RATE / 1000 / 2
    const expectedAccelMagnitude = (1 * halfRate + halfRate) * dtMs

    const ship = makeShip()
    const speedBefore = ship.angularVelocity.length()
    accelerateShip(ship, true, dtMs, MAX_DURATION)
    const speedAfter = ship.angularVelocity.length()

    expect(speedAfter - speedBefore).toBeCloseTo(expectedAccelMagnitude, 5)
  })

  it('velocity increases by 50% of full rate at zero easing (duration=0)', () => {
    // At duration=0, t=0, easeQuadOut(0) = 0
    // accelMagnitude = halfRate * dtMs  (50% of full-easing)
    const dtMs = 16
    const halfRate = ACCELERATION_RATE / 1000 / 2
    const expectedAccelMagnitude = halfRate * dtMs

    const ship = makeShip()
    accelerateShip(ship, true, dtMs, 0)

    expect(ship.angularVelocity.length()).toBeCloseTo(expectedAccelMagnitude, 5)
  })

  it('full easing gives exactly 2x the acceleration of zero easing', () => {
    const dtMs = 16

    const ship1 = makeShip()
    accelerateShip(ship1, true, dtMs, MAX_DURATION)
    const speedFull = ship1.angularVelocity.length()

    const ship2 = makeShip()
    accelerateShip(ship2, true, dtMs, 0)
    const speedZero = ship2.angularVelocity.length()

    expect(speedFull / speedZero).toBeCloseTo(2, 5)
  })

  it('acceleration is proportional to dtMs (frame-rate independent)', () => {
    // Two frames of 16ms should give the same velocity as one frame of 32ms
    const ship1 = makeShip()
    accelerateShip(ship1, true, 32, MAX_DURATION)
    const speed32 = ship1.angularVelocity.length()

    const ship2 = makeShip()
    accelerateShip(ship2, true, 16, MAX_DURATION)
    accelerateShip(ship2, true, 16, MAX_DURATION)
    const speed16x2 = ship2.angularVelocity.length()

    expect(speed32).toBeCloseTo(speed16x2, 5)
  })

  it('does not thrust when thrusting=false (no velocity added)', () => {
    const ship = makeShip()
    accelerateShip(ship, false, 16, MAX_DURATION)
    expect(ship.angularVelocity.length()).toBe(0)
  })

  it('velocity does not exceed MAX_SPEED after sustained thrust', () => {
    const ship = makeShip()
    for (let i = 0; i < 1000; i++) {
      accelerateShip(ship, true, 16, MAX_DURATION)
    }
    expect(ship.angularVelocity.length()).toBeLessThanOrEqual(MAX_SPEED + 1e-6)
  })
})

describe('accelerateShip — friction decay magnitude', () => {
  it('applies correct exponential friction in one 16ms frame', () => {
    // expected_v = v0 * Math.exp(-FRICTION_COEFFICIENT * (16 / 1000))
    const dtMs = 16
    const v0 = 0.1
    const expectedV = v0 * Math.exp(-FRICTION_COEFFICIENT * (dtMs / 1000))

    const ship = makeShip({ angularVelocity: new Vector3(v0, 0, 0) })
    accelerateShip(ship, false, dtMs, 0)

    expect(ship.angularVelocity.length()).toBeCloseTo(expectedV, 6)
  })

  it('applies correct exponential friction in one 100ms frame', () => {
    const dtMs = 100
    const v0 = 0.2
    const expectedV = v0 * Math.exp(-FRICTION_COEFFICIENT * (dtMs / 1000))

    const ship = makeShip({ angularVelocity: new Vector3(v0, 0, 0) })
    accelerateShip(ship, false, dtMs, 0)

    expect(ship.angularVelocity.length()).toBeCloseTo(expectedV, 6)
  })

  it('friction decay is frame-rate independent (two 8ms frames ≈ one 16ms frame)', () => {
    // exp(-k * 0.008) * exp(-k * 0.008) = exp(-k * 0.016)
    const v0 = 0.15

    const ship1 = makeShip({ angularVelocity: new Vector3(v0, 0, 0) })
    accelerateShip(ship1, false, 16, 0)
    const v16ms = ship1.angularVelocity.length()

    const ship2 = makeShip({ angularVelocity: new Vector3(v0, 0, 0) })
    accelerateShip(ship2, false, 8, 0)
    accelerateShip(ship2, false, 8, 0)
    const v8msx2 = ship2.angularVelocity.length()

    expect(v8msx2).toBeCloseTo(v16ms, 6)
  })

  it('friction does not decay velocity when at rest', () => {
    const ship = makeShip()
    accelerateShip(ship, false, 100, 0)
    expect(ship.angularVelocity.length()).toBe(0)
  })
})
