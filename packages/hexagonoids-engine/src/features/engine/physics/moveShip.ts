import { RADIUS } from '../constants.js'
import type { ShipState } from '../types.js'

import { quaternionToLatLng } from './latLng.js'
import { integrateAngularVelocity } from './quaternionPhysics.js'

/**
 * Integrate ship angular velocity into orientation and update lat/lng.
 * Mutates `ship.orientation`, `ship.lat`, `ship.lng`.
 *
 * @param ship - The ship state to mutate
 * @param dtMs - Time delta in milliseconds
 * @param radius - Sphere radius
 */
export const moveShip = (
  ship: ShipState,
  dtMs: number,
  radius: number = RADIUS
): void => {
  if (ship.angularVelocity.length() < 0.00001) {
    return
  }

  const dtSeconds = dtMs / 1000
  ship.orientation = integrateAngularVelocity(
    ship.orientation,
    ship.angularVelocity,
    dtSeconds
  )

  const [lat, lng] = quaternionToLatLng(ship.orientation, radius)
  ship.lat = lat
  ship.lng = lng
}
