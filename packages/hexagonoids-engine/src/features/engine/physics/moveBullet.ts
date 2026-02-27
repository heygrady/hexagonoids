import { RADIUS } from '../constants.js'
import type { BulletState } from '../types.js'

import { quaternionToLatLng, quaternionToLatLngFastInPlace } from './latLng.js'
import {
  integrateAngularVelocity,
  integrateAngularVelocityFastInPlace,
} from './quaternionPhysics.js'

/**
 * Move a bullet by integrating its constant angular velocity.
 * Bullets have no thrust, friction, or turning — just constant linear motion.
 * Mutates `bullet.orientation`, `bullet.lat`, `bullet.lng`.
 *
 * @param bullet - The bullet state to mutate
 * @param dtMs - Time delta in milliseconds
 * @param radius - Sphere radius
 */
export const moveBullet = (
  bullet: BulletState,
  dtMs: number,
  radius: number = RADIUS,
  useFastMath: boolean = true
): void => {
  const omega = bullet.angularVelocity
  if (omega.lengthSquared() < 1e-10) {
    return
  }

  const dtSeconds = dtMs / 1000
  if (useFastMath) {
    integrateAngularVelocityFastInPlace(bullet.orientation, omega, dtSeconds)
    quaternionToLatLngFastInPlace(bullet.orientation, bullet, radius)
  } else {
    bullet.orientation = integrateAngularVelocity(
      bullet.orientation,
      omega,
      dtSeconds
    )
    const [lat, lng] = quaternionToLatLng(bullet.orientation, radius)
    bullet.lat = lat
    bullet.lng = lng
  }
}
