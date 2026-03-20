import { quatToUnitPoint } from '../math/quat.js'
import { vec3LengthSq } from '../math/vec3.js'
import type { BulletState } from '../types.js'

import { integrateAngularVelocity } from './quaternionPhysics.js'

/**
 * Move a bullet by integrating its constant angular velocity.
 * Mutates `bullet.orientation` and `bullet.position`.
 */
export const moveBullet = (bullet: BulletState, dtMs: number): void => {
  if (vec3LengthSq(bullet.angularVelocity) < 1e-10) {
    return
  }
  integrateAngularVelocity(
    bullet.orientation,
    bullet.angularVelocity,
    dtMs / 1000
  )
  quatToUnitPoint(bullet.position, bullet.orientation)
}
