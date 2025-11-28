import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { vector3ToLatLng } from '@heygrady/h3-babylon'

import type { TargetStore } from '../colission/typeCheck'
import { setLocation } from '../store/bullet/BulletSetters'
import type { BulletStore } from '../store/bullet/BulletStore'

/**
 * Positions a bullet at the target's location.
 * @param {BulletStore} $bullet - The bullet to position
 * @param {TargetStore} $target - The target (rock or ship) to position at
 */
export const orientToTarget = ($bullet: BulletStore, $target: TargetStore) => {
  const targetState = $target.get()
  const { originNode: targetOriginNode } = targetState

  if (targetOriginNode == null) {
    throw new Error('Cannot orient a bullet without a BulletState.originNode')
  }

  const bulletState = $bullet.get()
  const { originNode, bulletNode } = bulletState

  if (originNode == null) {
    throw new Error('Cannot orient a bullet without a BulletState.originNode')
  }
  if (bulletNode == null) {
    throw new Error('Cannot orient a bullet without a BulletState.bulletNode')
  }

  /**
   * Position the bullet at the target's location
   */

  // Position the bullet origin to match the target's origin
  if (targetOriginNode.rotationQuaternion == null) {
    targetOriginNode.rotationQuaternion = Quaternion.Identity()
  }
  originNode.rotationQuaternion = targetOriginNode.rotationQuaternion.clone()

  // Set the final location
  setLocation($bullet, vector3ToLatLng(bulletNode.absolutePosition))
}
