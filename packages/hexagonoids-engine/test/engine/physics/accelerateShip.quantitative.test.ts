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
import { RADIUS } from '../../../src/features/engine/constants.js'
import {
  getThrustAccelerationFast,
  getThrustAccelerationQuaternion,
} from '../../../src/features/engine/physics/accelerateShip.js'
import { turnShip } from '../../../src/features/engine/physics/turnShip.js'
import type { ShipState } from '../../../src/index.js'
import {
  ACCELERATION_RATE,
  accelerateShip,
  FRICTION_COEFFICIENT,
  latLngToQuaternion,
  MAX_DURATION,
  MAX_SPEED,
  moveShip,
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

describe('accelerateShip — fast thrust parity', () => {
  it('fast thrust direction closely matches quaternion thrust across representative orientations', () => {
    const accelMagnitude = 0.25
    const scenarios: Array<{ lat: number; lng: number; yaw: number }> = [
      { lat: 0, lng: 0, yaw: 0 },
      { lat: 0, lng: 0, yaw: Math.PI / 2 },
      { lat: 0, lng: 90, yaw: -Math.PI / 3 },
      { lat: 30, lng: 45, yaw: Math.PI / 4 },
      { lat: -42, lng: 123, yaw: -Math.PI / 2 },
      { lat: 70, lng: -120, yaw: Math.PI },
      { lat: -75, lng: 30, yaw: -2.2 },
      { lat: 85, lng: 10, yaw: 1.1 },
      { lat: -85, lng: -150, yaw: -0.7 },
    ]

    for (const scenario of scenarios) {
      const orientation = latLngToQuaternion(scenario.lat, scenario.lng)
      const ship = makeShip({
        lat: scenario.lat,
        lng: scenario.lng,
        yaw: scenario.yaw,
        orientation,
      })

      const quaternionAccel = getThrustAccelerationQuaternion(
        ship,
        accelMagnitude
      )
      const fastAccel = getThrustAccelerationFast(ship, accelMagnitude)

      expect(quaternionAccel.length()).toBeCloseTo(accelMagnitude, 6)
      expect(fastAccel.length()).toBeCloseTo(accelMagnitude, 6)
      expect(fastAccel.x).toBeCloseTo(quaternionAccel.x, 6)
      expect(fastAccel.y).toBeCloseTo(quaternionAccel.y, 6)
      expect(fastAccel.z).toBeCloseTo(quaternionAccel.z, 6)
    }
  })
})

function createDeterministicRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function orientationAlignment(a: Quaternion, b: Quaternion): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w
  return Math.abs(dot)
}

describe('accelerateShip — dynamic fast/parity across gameplay-like loops', () => {
  it('fast math stays aligned with quaternion math under long mixed control sequences', () => {
    const dtMs = 16
    const ticks = 700
    const rng = createDeterministicRng(0xdecafbad)
    const starts = [
      { lat: 0, lng: 0, yaw: 0 },
      { lat: 0, lng: 179.9, yaw: -Math.PI / 2 },
      { lat: 0, lng: -179.9, yaw: Math.PI / 2 },
      { lat: 45, lng: 45, yaw: 2.1 },
      { lat: -50, lng: 130, yaw: -1.8 },
      { lat: 89.9, lng: 10, yaw: 0.7 },
      { lat: -89.9, lng: -25, yaw: -2.4 },
    ]

    for (const start of starts) {
      const orientation = latLngToQuaternion(start.lat, start.lng)
      const fast = makeShip({
        lat: start.lat,
        lng: start.lng,
        yaw: start.yaw,
        orientation,
      })
      const slow = makeShip({
        lat: start.lat,
        lng: start.lng,
        yaw: start.yaw,
        orientation: orientation.clone(),
      })

      let thrustDuration = 0
      let turnDuration = 0
      let lastTurn: -1 | 1 | 0 = 0

      for (let tick = 0; tick < ticks; tick++) {
        const thrusting = rng() < 0.68
        const turnRoll = rng()
        const turn: -1 | 1 | 0 = turnRoll < 0.2 ? -1 : turnRoll < 0.4 ? 1 : 0

        thrustDuration = thrusting
          ? Math.min(MAX_DURATION, thrustDuration + dtMs)
          : 0
        if (turn !== 0 && turn === lastTurn) {
          turnDuration = Math.min(MAX_DURATION, turnDuration + dtMs)
        } else if (turn !== 0) {
          turnDuration = dtMs
        } else {
          turnDuration = 0
        }
        lastTurn = turn

        if (turn !== 0) {
          turnShip(fast, turn, dtMs, turnDuration)
          turnShip(slow, turn, dtMs, turnDuration)
        }

        accelerateShip(fast, thrusting, dtMs, thrustDuration, true)
        accelerateShip(slow, thrusting, dtMs, thrustDuration, false)
        moveShip(fast, dtMs, RADIUS, true)
        moveShip(slow, dtMs, RADIUS, false)

        expect(fast.yaw).toBeCloseTo(slow.yaw, 10)
        expect(fast.angularVelocity.x).toBeCloseTo(slow.angularVelocity.x, 5)
        expect(fast.angularVelocity.y).toBeCloseTo(slow.angularVelocity.y, 5)
        expect(fast.angularVelocity.z).toBeCloseTo(slow.angularVelocity.z, 5)
        expect(
          orientationAlignment(fast.orientation, slow.orientation)
        ).toBeGreaterThan(1 - 1e-6)
      }
    }
  })

  it('remains stable in pole-adjacent loops with sustained turning + thrust', () => {
    const dtMs = 16
    const ticks = 900
    const starts = [
      { lat: 89.95, lng: 0, yaw: 0 },
      { lat: 89.95, lng: 120, yaw: 1.7 },
      { lat: -89.95, lng: -45, yaw: -2.2 },
      { lat: -89.95, lng: 170, yaw: 0.5 },
    ]

    for (const start of starts) {
      const orientation = latLngToQuaternion(start.lat, start.lng)
      const fast = makeShip({
        lat: start.lat,
        lng: start.lng,
        yaw: start.yaw,
        orientation,
      })
      const slow = makeShip({
        lat: start.lat,
        lng: start.lng,
        yaw: start.yaw,
        orientation: orientation.clone(),
      })

      for (let tick = 0; tick < ticks; tick++) {
        const turnDirection: -1 | 1 = tick % 120 < 60 ? 1 : -1
        const turnDuration = (tick % 60) * dtMs + dtMs
        const thrustDuration = Math.min(MAX_DURATION, tick * dtMs)

        turnShip(fast, turnDirection, dtMs, turnDuration)
        turnShip(slow, turnDirection, dtMs, turnDuration)
        accelerateShip(fast, true, dtMs, thrustDuration, true)
        accelerateShip(slow, true, dtMs, thrustDuration, false)
        moveShip(fast, dtMs, RADIUS, true)
        moveShip(slow, dtMs, RADIUS, false)
      }

      expect(
        orientationAlignment(fast.orientation, slow.orientation)
      ).toBeGreaterThan(1 - 1e-6)
      expect(fast.angularVelocity.x).toBeCloseTo(slow.angularVelocity.x, 5)
      expect(fast.angularVelocity.y).toBeCloseTo(slow.angularVelocity.y, 5)
      expect(fast.angularVelocity.z).toBeCloseTo(slow.angularVelocity.z, 5)
    }
  })
})
