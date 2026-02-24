import { RADIUS } from '../constants.js'
import type { BulletState } from '../types.js'

import { quaternionToLatLng } from './latLng.js'
import { integrateAngularVelocity } from './quaternionPhysics.js'

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
  radius: number = RADIUS
): void => {
  if (bullet.angularVelocity.length() < 0.00001) {
    return
  }

  const dtSeconds = dtMs / 1000
  bullet.orientation = integrateAngularVelocity(
    bullet.orientation,
    bullet.angularVelocity,
    dtSeconds
  )

  const [lat, lng] = quaternionToLatLng(bullet.orientation, radius)
  bullet.lat = lat
  bullet.lng = lng
}
