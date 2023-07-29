import { Quaternion } from '@babylonjs/core'
import { vector3ToLatLng } from '@heygrady/h3-babylon'

import type { TargetStore } from '../colission/typeCheck'
import { getOrientation } from '../ship/orientation'
import { setLocation } from '../store/bullet/BulletSetters'
import type { BulletStore } from '../store/bullet/BulletStore'

/**
 * Updates bullet state and bullet nodes.
 * @param $bullet
 * @param $target
 * @param side
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
   * Initial position and heading of the bullet
   * 1. orient the bullet origin to match the target's origin
   * 2. use the bullet's heading
   */

  // 1. orient the bullet origin to match the target's origin
  // bullet position
  if (targetOriginNode.rotationQuaternion == null) {
    targetOriginNode.rotationQuaternion = Quaternion.Identity()
  }
  originNode.rotationQuaternion = targetOriginNode.rotationQuaternion.clone()

  // 2. use the bullet's heading
  if (bulletState.heading !== 0) {
    const [bulletHeading] = getOrientation(originNode)
    originNode.rotationQuaternion = originNode.rotationQuaternion.multiply(
      Quaternion.RotationYawPitchRoll(bulletState.heading - bulletHeading, 0, 0)
    )
  }

  // set the final state (from the scene)
  const [bulletHeading] = getOrientation(originNode)
  $bullet.setKey('heading', bulletHeading)
  setLocation($bullet, vector3ToLatLng(bulletNode.absolutePosition))
}
