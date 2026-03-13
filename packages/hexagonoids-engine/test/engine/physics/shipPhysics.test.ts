import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { ShipState } from '../../../src/index.js'
import {
  accelerateShip,
  MAX_DURATION,
  MAX_SPEED,
  moveShip,
  RADIUS,
  turnShip,
} from '../../../src/index.js'
import { pointFromLatLng } from '../../helpers/points.js'

/** Create a fresh ship state for testing. */
const makeShip = (overrides: Partial<ShipState> = {}): ShipState => ({
  id: 'test-ship',
  playerId: 'test-player',
  orientation: Quaternion.Identity(),
  ...pointFromLatLng(0, 0),
  angularVelocity: Vector3.Zero(),
  yaw: 0,
  alive: true,
  firedAt: null,
  ...overrides,
})

describe('accelerateShip', () => {
  it('increases angular velocity when thrusting', () => {
    const ship = makeShip()
    accelerateShip(ship, true, 16, MAX_DURATION)
    expect(ship.angularVelocity.length()).toBeGreaterThan(0)
  })

  it('applies friction when not thrusting', () => {
    const ship = makeShip({ angularVelocity: new Vector3(0.5, 0, 0) })
    const initialSpeed = ship.angularVelocity.length()
    accelerateShip(ship, false, 100, 0)
    expect(ship.angularVelocity.length()).toBeLessThan(initialSpeed)
  })

  it('does not exceed max speed', () => {
    const ship = makeShip()
    // Apply many frames of thrust
    for (let i = 0; i < 500; i++) {
      accelerateShip(ship, true, 16, MAX_DURATION)
    }
    expect(ship.angularVelocity.length()).toBeLessThanOrEqual(MAX_SPEED + 0.001)
  })

  it('friction reduces speed toward zero over time', () => {
    const ship = makeShip({ angularVelocity: new Vector3(0.1, 0, 0.1) })
    // Use larger time steps to ensure friction converges
    for (let i = 0; i < 300; i++) {
      accelerateShip(ship, false, 100, 0)
    }
    expect(ship.angularVelocity.length()).toBeLessThan(0.001)
  })
})

describe('turnShip', () => {
  it('changes yaw when turning right', () => {
    const ship = makeShip()
    turnShip(ship, 1, 16, MAX_DURATION)
    expect(ship.yaw).toBeGreaterThan(0)
  })

  it('changes yaw when turning left', () => {
    const ship = makeShip()
    turnShip(ship, -1, 16, MAX_DURATION)
    expect(ship.yaw).toBeLessThan(0)
  })
})

describe('moveShip', () => {
  it('does not move a ship at rest', () => {
    const ship = makeShip()
    const xBefore = ship.x
    const yBefore = ship.y
    const zBefore = ship.z
    moveShip(ship, 16, RADIUS)
    // Zero velocity -> no movement, xyz unchanged
    expect(ship.x).toBe(xBefore)
    expect(ship.y).toBe(yBefore)
    expect(ship.z).toBe(zBefore)
  })

  it('updates xyz when ship has velocity', () => {
    const ship = makeShip({ angularVelocity: new Vector3(0.5, 0, 0) })
    const xBefore = ship.x ?? 0
    const yBefore = ship.y ?? 1
    const zBefore = ship.z ?? 0
    moveShip(ship, 100, RADIUS)
    // At least one xyz component should change
    const moved =
      Math.abs((ship.x ?? 0) - xBefore) > 0.001 ||
      Math.abs((ship.y ?? 1) - yBefore) > 0.001 ||
      Math.abs((ship.z ?? 0) - zBefore) > 0.001
    expect(moved).toBe(true)
  })

  it('ship with constant thrust moves consistently', () => {
    const ship = makeShip()
    // Apply thrust for several frames then check movement
    for (let i = 0; i < 10; i++) {
      accelerateShip(ship, true, 16, MAX_DURATION)
      moveShip(ship, 16, RADIUS)
    }
    const dx = (ship.x ?? 1) - 1
    const dy = ship.y ?? 0
    const dz = ship.z ?? 0
    // Should have moved from the initial unit point at (1,0,0)
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    expect(distance).toBeGreaterThan(0)
  })
})
