import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { describe, expect, it } from 'vitest'
import type { ShipState } from '../../../src/index.js'
import { defaultShipState, setShipYaw } from '../../../src/index.js'

function createShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    ...defaultShipState,
    id: 's1',
    playerId: 'p1',
    orientation: Quaternion.Identity(),
    angularVelocity: Vector3.Zero(),
    ...overrides,
  }
}

describe('shipSetters', () => {
  describe('setShipYaw', () => {
    it('wraps angles beyond PI to [-PI, PI] range', () => {
      const ship = createShip()

      setShipYaw(ship, Math.PI + 0.5)
      expect(ship.yaw).toBeCloseTo(-Math.PI + 0.5)
    })

    it('wraps angles below -PI to [-PI, PI] range', () => {
      const ship = createShip()

      setShipYaw(ship, -Math.PI - 0.5)
      expect(ship.yaw).toBeCloseTo(Math.PI - 0.5)
    })

    it('returns false when wrapped value is unchanged', () => {
      const ship = createShip({ yaw: 1.0 })
      const changed = setShipYaw(ship, 1.0)

      expect(changed).toBe(false)
      expect(ship.yaw).toBe(1.0)
    })
  })
})
