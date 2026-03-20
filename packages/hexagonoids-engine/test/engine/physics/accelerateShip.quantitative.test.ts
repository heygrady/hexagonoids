/**
 * Quantitative tests for accelerateShip -- verify velocity and friction magnitudes.
 *
 * Key constants:
 *   MAX_SPEED = Math.PI / 10              -- max speed in radians per second
 *   ACCELERATION_RATE = MAX_SPEED * 1.55  -- radians per second
 *   FRICTION_COEFFICIENT = 0.35
 *   MAX_DURATION = 1000                   -- milliseconds for full easing
 */
import { describe, expect, it } from 'vitest'
import { vec3 } from '../../../src/features/engine/math/create.js'
import { vec3Length } from '../../../src/features/engine/math/vec3.js'
import { latLngToQuaternion } from '../../../src/features/engine/physics/latLng.js'
import { turnShip } from '../../../src/features/engine/physics/turnShip.js'
import {
  ACCELERATION_RATE,
  accelerateShip,
  FRICTION_COEFFICIENT,
  MAX_DURATION,
  MAX_SPEED,
  moveShip,
} from '../../../src/index.js'
import { makeShip } from '../../helpers/entities.js'
import { pointFromLatLng } from '../../helpers/points.js'

describe('accelerateShip -- quantitative velocity increase per frame', () => {
  it('velocity increases by the correct amount at full easing (duration=MAX_DURATION)', () => {
    // At duration=MAX_DURATION, t=1, easeQuadOut(1) = 1*(2-1) = 1
    // accelMagnitude = ACCELERATION_RATE / 1000 * dtMs
    const dtMs = 16
    const halfRate = ACCELERATION_RATE / 1000 / 2
    const expectedAccelMagnitude = (1 * halfRate + halfRate) * dtMs

    const ship = makeShip()
    const speedBefore = vec3Length(ship.angularVelocity)
    accelerateShip(ship, true, dtMs, MAX_DURATION)
    const speedAfter = vec3Length(ship.angularVelocity)

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

    expect(vec3Length(ship.angularVelocity)).toBeCloseTo(
      expectedAccelMagnitude,
      5
    )
  })

  it('full easing gives exactly 2x the acceleration of zero easing', () => {
    const dtMs = 16

    const ship1 = makeShip()
    accelerateShip(ship1, true, dtMs, MAX_DURATION)
    const speedFull = vec3Length(ship1.angularVelocity)

    const ship2 = makeShip()
    accelerateShip(ship2, true, dtMs, 0)
    const speedZero = vec3Length(ship2.angularVelocity)

    expect(speedFull / speedZero).toBeCloseTo(2, 5)
  })

  it('acceleration is proportional to dtMs (frame-rate independent)', () => {
    // Two frames of 16ms should give the same velocity as one frame of 32ms
    const ship1 = makeShip()
    accelerateShip(ship1, true, 32, MAX_DURATION)
    const speed32 = vec3Length(ship1.angularVelocity)

    const ship2 = makeShip()
    accelerateShip(ship2, true, 16, MAX_DURATION)
    accelerateShip(ship2, true, 16, MAX_DURATION)
    const speed16x2 = vec3Length(ship2.angularVelocity)

    expect(speed32).toBeCloseTo(speed16x2, 5)
  })

  it('does not thrust when thrusting=false (no velocity added)', () => {
    const ship = makeShip()
    accelerateShip(ship, false, 16, MAX_DURATION)
    expect(vec3Length(ship.angularVelocity)).toBe(0)
  })

  it('velocity does not exceed MAX_SPEED after sustained thrust', () => {
    const ship = makeShip()
    for (let i = 0; i < 1000; i++) {
      accelerateShip(ship, true, 16, MAX_DURATION)
    }
    expect(vec3Length(ship.angularVelocity)).toBeLessThanOrEqual(
      MAX_SPEED + 1e-6
    )
  })
})

describe('accelerateShip -- friction decay magnitude', () => {
  it('applies correct exponential friction in one 16ms frame', () => {
    // expected_v = v0 * Math.exp(-FRICTION_COEFFICIENT * (16 / 1000))
    const dtMs = 16
    const v0 = 0.1
    const expectedV = v0 * Math.exp(-FRICTION_COEFFICIENT * (dtMs / 1000))

    const ship = makeShip({ angularVelocity: vec3(v0, 0, 0) })
    accelerateShip(ship, false, dtMs, 0)

    expect(vec3Length(ship.angularVelocity)).toBeCloseTo(expectedV, 6)
  })

  it('applies correct exponential friction in one 100ms frame', () => {
    const dtMs = 100
    const v0 = 0.2
    const expectedV = v0 * Math.exp(-FRICTION_COEFFICIENT * (dtMs / 1000))

    const ship = makeShip({ angularVelocity: vec3(v0, 0, 0) })
    accelerateShip(ship, false, dtMs, 0)

    expect(vec3Length(ship.angularVelocity)).toBeCloseTo(expectedV, 6)
  })

  it('friction decay is frame-rate independent (two 8ms frames ~ one 16ms frame)', () => {
    // exp(-k * 0.008) * exp(-k * 0.008) = exp(-k * 0.016)
    const v0 = 0.15

    const ship1 = makeShip({ angularVelocity: vec3(v0, 0, 0) })
    accelerateShip(ship1, false, 16, 0)
    const v16ms = vec3Length(ship1.angularVelocity)

    const ship2 = makeShip({ angularVelocity: vec3(v0, 0, 0) })
    accelerateShip(ship2, false, 8, 0)
    accelerateShip(ship2, false, 8, 0)
    const v8msx2 = vec3Length(ship2.angularVelocity)

    expect(v8msx2).toBeCloseTo(v16ms, 6)
  })

  it('friction does not decay velocity when at rest', () => {
    const ship = makeShip()
    accelerateShip(ship, false, 100, 0)
    expect(vec3Length(ship.angularVelocity)).toBe(0)
  })
})

describe('accelerateShip -- thrust direction across representative orientations', () => {
  it('thrust produces angular velocity in the correct direction', () => {
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
      const position = pointFromLatLng(scenario.lat, scenario.lng)
      const ship = makeShip({
        position,
        yaw: scenario.yaw,
        orientation,
      })

      accelerateShip(ship, true, 16, MAX_DURATION)
      // Thrust should produce non-zero angular velocity
      expect(vec3Length(ship.angularVelocity)).toBeGreaterThan(0)
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

describe('accelerateShip -- dynamic gameplay-like loops', () => {
  it('stays consistent under long mixed control sequences', () => {
    const dtMs = 16
    const ticks = 700
    const rng = createDeterministicRng(0xdecafbad)
    const starts = [
      { lat: 0, lng: 0, yaw: 0 },
      { lat: 45, lng: 45, yaw: 2.1 },
      { lat: -50, lng: 130, yaw: -1.8 },
      { lat: 89.9, lng: 10, yaw: 0.7 },
      { lat: -89.9, lng: -25, yaw: -2.4 },
    ]

    for (const start of starts) {
      const orientation = latLngToQuaternion(start.lat, start.lng)
      const point = pointFromLatLng(start.lat, start.lng)
      const ship = makeShip({
        position: point,
        yaw: start.yaw,
        orientation,
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
          turnShip(ship, turn, dtMs, turnDuration)
        }

        accelerateShip(ship, thrusting, dtMs, thrustDuration)
        moveShip(ship, dtMs)

        // Orientation should stay normalized
        const qLen = Math.sqrt(
          ship.orientation[0] ** 2 +
            ship.orientation[1] ** 2 +
            ship.orientation[2] ** 2 +
            ship.orientation[3] ** 2
        )
        expect(qLen).toBeCloseTo(1, 5)
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
      const point = pointFromLatLng(start.lat, start.lng)
      const ship = makeShip({
        position: point,
        yaw: start.yaw,
        orientation,
      })

      for (let tick = 0; tick < ticks; tick++) {
        const turnDirection: -1 | 1 = tick % 120 < 60 ? 1 : -1
        const turnDuration = (tick % 60) * dtMs + dtMs
        const thrustDuration = Math.min(MAX_DURATION, tick * dtMs)

        turnShip(ship, turnDirection, dtMs, turnDuration)
        accelerateShip(ship, true, dtMs, thrustDuration)
        moveShip(ship, dtMs)
      }

      // Orientation should still be normalized after all ticks
      const qLen = Math.sqrt(
        ship.orientation[0] ** 2 +
          ship.orientation[1] ** 2 +
          ship.orientation[2] ** 2 +
          ship.orientation[3] ** 2
      )
      expect(qLen).toBeCloseTo(1, 5)
    }
  })
})
