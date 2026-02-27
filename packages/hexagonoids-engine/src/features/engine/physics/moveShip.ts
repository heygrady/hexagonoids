import { RADIUS } from '../constants.js'
import type { ShipState } from '../types.js'

import { quaternionToLatLng, quaternionToLatLngFastInPlace } from './latLng.js'
import {
  integrateAngularVelocity,
  integrateAngularVelocityFastInPlace,
} from './quaternionPhysics.js'

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
  radius: number = RADIUS,
  useFastMath: boolean = true
): void => {
  const omega = ship.angularVelocity
  if (omega.lengthSquared() < 1e-10) {
    return
  }

  const dtSeconds = dtMs / 1000
  if (useFastMath) {
    integrateAngularVelocityFastInPlace(ship.orientation, omega, dtSeconds)
    quaternionToLatLngFastInPlace(ship.orientation, ship, radius)
  } else {
    ship.orientation = integrateAngularVelocity(
      ship.orientation,
      omega,
      dtSeconds
    )
    const [lat, lng] = quaternionToLatLng(ship.orientation, radius)
    ship.lat = lat
    ship.lng = lng
  }
}
