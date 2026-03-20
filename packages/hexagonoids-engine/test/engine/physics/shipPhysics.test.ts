import { describe, expect, it } from 'vitest'
import { vec3 } from '../../../src/features/engine/math/create.js'
import { vec3Length } from '../../../src/features/engine/math/vec3.js'
import {
  accelerateShip,
  MAX_DURATION,
  MAX_SPEED,
  moveShip,
  turnShip,
} from '../../../src/index.js'
import { makeShip } from '../../helpers/entities.js'

describe('accelerateShip', () => {
  it('increases angular velocity when thrusting', () => {
    const ship = makeShip()
    accelerateShip(ship, true, 16, MAX_DURATION)
    expect(vec3Length(ship.angularVelocity)).toBeGreaterThan(0)
  })

  it('applies friction when not thrusting', () => {
    const ship = makeShip({ angularVelocity: vec3(0.5, 0, 0) })
    const initialSpeed = vec3Length(ship.angularVelocity)
    accelerateShip(ship, false, 100, 0)
    expect(vec3Length(ship.angularVelocity)).toBeLessThan(initialSpeed)
  })

  it('does not exceed max speed', () => {
    const ship = makeShip()
    // Apply many frames of thrust
    for (let i = 0; i < 500; i++) {
      accelerateShip(ship, true, 16, MAX_DURATION)
    }
    expect(vec3Length(ship.angularVelocity)).toBeLessThanOrEqual(
      MAX_SPEED + 0.001
    )
  })

  it('friction reduces speed toward zero over time', () => {
    const ship = makeShip({ angularVelocity: vec3(0.1, 0, 0.1) })
    // Use larger time steps to ensure friction converges
    for (let i = 0; i < 300; i++) {
      accelerateShip(ship, false, 100, 0)
    }
    expect(vec3Length(ship.angularVelocity)).toBeLessThan(0.001)
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
    const x0 = ship.position[0]
    const y0 = ship.position[1]
    const z0 = ship.position[2]
    moveShip(ship, 16)
    // Zero velocity -> no movement, position unchanged
    expect(ship.position[0]).toBe(x0)
    expect(ship.position[1]).toBe(y0)
    expect(ship.position[2]).toBe(z0)
  })

  it('updates position when ship has velocity', () => {
    const ship = makeShip({ angularVelocity: vec3(0.5, 0, 0) })
    const x0 = ship.position[0]
    const y0 = ship.position[1]
    const z0 = ship.position[2]
    moveShip(ship, 100)
    // At least one position component should change
    const moved =
      Math.abs(ship.position[0] - x0) > 0.001 ||
      Math.abs(ship.position[1] - y0) > 0.001 ||
      Math.abs(ship.position[2] - z0) > 0.001
    expect(moved).toBe(true)
  })

  it('ship with constant thrust moves consistently', () => {
    const ship = makeShip()
    const x0 = ship.position[0]
    const y0 = ship.position[1]
    const z0 = ship.position[2]
    // Apply thrust for several frames then check movement
    for (let i = 0; i < 10; i++) {
      accelerateShip(ship, true, 16, MAX_DURATION)
      moveShip(ship, 16)
    }
    const dx = ship.position[0] - x0
    const dy = ship.position[1] - y0
    const dz = ship.position[2] - z0
    // Should have moved from the initial position
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    expect(distance).toBeGreaterThan(0)
  })
})
