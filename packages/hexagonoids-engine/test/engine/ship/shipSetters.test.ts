import { describe, expect, it } from 'vitest'
import { setShipYaw } from '../../../src/index.js'
import { makeShip } from '../../helpers/entities.js'

describe('shipSetters', () => {
  describe('setShipYaw', () => {
    it('wraps angles beyond PI to [-PI, PI] range', () => {
      const ship = makeShip()

      setShipYaw(ship, Math.PI + 0.5)
      expect(ship.yaw).toBeCloseTo(-Math.PI + 0.5)
    })

    it('wraps angles below -PI to [-PI, PI] range', () => {
      const ship = makeShip()

      setShipYaw(ship, -Math.PI - 0.5)
      expect(ship.yaw).toBeCloseTo(Math.PI - 0.5)
    })

    it('returns false when wrapped value is unchanged', () => {
      const ship = makeShip({ yaw: 1.0 })
      const changed = setShipYaw(ship, 1.0)

      expect(changed).toBe(false)
      expect(ship.yaw).toBe(1.0)
    })
  })
})
