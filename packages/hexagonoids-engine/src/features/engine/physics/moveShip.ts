import { quatToUnitPoint } from '../math/quat.js'
import { vec3LengthSq } from '../math/vec3.js'
import type { ShipState } from '../types.js'

import { integrateAngularVelocity } from './quaternionPhysics.js'

/**
 * Integrate ship angular velocity into orientation and update position.
 * Mutates `ship.orientation` and `ship.position`.
 */
export const moveShip = (ship: ShipState, dtMs: number): void => {
  if (vec3LengthSq(ship.angularVelocity) < 1e-10) {
    return
  }
  integrateAngularVelocity(ship.orientation, ship.angularVelocity, dtMs / 1000)
  quatToUnitPoint(ship.position, ship.orientation)
}
