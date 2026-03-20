/**
 * Quantitative tests for turnShip — verify yaw change magnitudes.
 *
 * Key constants:
 *   TURN_RATE = 2.2 * Math.PI  — radians per second
 *   MAX_DURATION = 1000        — milliseconds for full easing
 */
import { describe, expect, it } from 'vitest'
import type { ShipState } from '../../../src/index.js'
import { MAX_DURATION, TURN_RATE, turnShip } from '../../../src/index.js'
import { makeShip as makeShipHelper } from '../../helpers/entities.js'
import { pointFromLatLng } from '../../helpers/points.js'

function makeShipAt(lat: number, lng: number): ShipState {
  return makeShipHelper({ position: pointFromLatLng(lat, lng) })
}

describe('turnShip — quantitative yaw change per frame', () => {
  it('yaw changes by the correct amount at full easing (duration=MAX_DURATION)', () => {
    const dtMs = 16
    const t = 1
    const et = Math.sqrt(1 - (t - 1) ** 2)
    const expectedYawChange = ((et * TURN_RATE) / 1000) * dtMs

    const ship = makeShipHelper()
    turnShip(ship, 1, dtMs, MAX_DURATION)

    expect(ship.yaw).toBeCloseTo(expectedYawChange, 5)
  })

  it('yaw does not change at zero easing (duration=0)', () => {
    const ship = makeShipHelper()
    turnShip(ship, 1, 16, 0)

    expect(ship.yaw).toBeCloseTo(0, 10)
  })

  it('left turn produces negative yaw change at full easing', () => {
    const dtMs = 16
    const t = 1
    const et = Math.sqrt(1 - (t - 1) ** 2)
    const expectedYawChange = -((et * TURN_RATE) / 1000) * dtMs

    const ship = makeShipHelper()
    turnShip(ship, -1, dtMs, MAX_DURATION)

    expect(ship.yaw).toBeCloseTo(expectedYawChange, 5)
  })

  it('turn rate is proportional to dtMs (frame-rate independent)', () => {
    const ship1 = makeShipHelper()
    turnShip(ship1, 1, 16, MAX_DURATION)

    const ship2 = makeShipHelper()
    turnShip(ship2, 1, 32, MAX_DURATION)

    expect(ship2.yaw).toBeCloseTo(ship1.yaw * 2, 5)
  })

  it('yaw change at partial easing (duration=MAX_DURATION/2) is in expected range', () => {
    const dtMs = 16
    const t = 0.5
    const et = Math.sqrt(1 - (t - 1) ** 2)
    const expectedYawChange = ((et * TURN_RATE) / 1000) * dtMs

    const ship = makeShipHelper()
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
