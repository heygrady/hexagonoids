import { Quaternion } from '@babylonjs/core'
import { vector3ToLatLng } from '@heygrady/h3-babylon'

import { GUN_DISTANCE } from '../constants'
import { getOrientation } from '../ship/orientation'
import { accelerateHeadingSpeed } from '../ship/velocity'
import { setLocation } from '../store/bullet/BulletSetters'
import type { BulletStore } from '../store/bullet/BulletStore'

/**
 * Updates bullet state and bullet nodes.
 * @param $bullet
 */
export const orientToShip = ($bullet: BulletStore) => {
  const { $ship } = $bullet.get()

  if ($ship == null) {
    throw new Error('Cannot orient a bullet without a ship')
  }

  const shipState = $ship.get()
  const { originNode: shipOriginNode, orientationNode: shipOrientationNode } =
    shipState

  if (shipOriginNode == null) {
    throw new Error('Cannot orient a bullet without a ShipState.originNode')
  }
  if (shipOrientationNode == null) {
    throw new Error(
      'Cannot orient a bullet without a ShipState.shipOrientationNode'
    )
  }

  const bulletState = $bullet.get()
  const { originNode, bulletNode } = bulletState

  if (originNode == null) {
    throw new Error('Cannot orient a bullet without a BulletState.originNode')
  }
  if (bulletNode == null) {
    throw new Error('Cannot orient a bullet without a BulletState.bulletNode')
  }

  const [shipOriginYaw] = getOrientation(shipOriginNode)
  const [shipOrientationYaw] = getOrientation(shipOrientationNode)

  /**
   * Initial heading and speed of the bullet
   * 1. orient the bullet origin to match the ship's origin
   * 2. rotate it to match the ship's gun orientation
   * 3. pitch it forward by the GUN_DISTANCE
   * 4. accelerate it by the ships velocity
   */

  if (shipOriginNode.rotationQuaternion == null) {
    shipOriginNode.rotationQuaternion = Quaternion.Identity()
  }

  // 1. orient the bullet origin to match the ship's origin
  originNode.rotationQuaternion = shipOriginNode.rotationQuaternion.clone()

  // 2. rotate it to match the ship's gun orientation
  if (shipOrientationYaw !== 0) {
    originNode.rotationQuaternion = originNode.rotationQuaternion.multiply(
      Quaternion.RotationYawPitchRoll(shipOrientationYaw, 0, 0)
    )
  }

  // 3. pitch it forward by the GUN_DISTANCE
  originNode.rotationQuaternion = originNode.rotationQuaternion.multiply(
    Quaternion.RotationYawPitchRoll(0, GUN_DISTANCE, 0)
  )

  // 4. accelerate it by the ships velocity
  // FIXME: this seems to be weird sometimes (dead bullets)
  const [bulletYaw] = getOrientation(originNode)
  const [heading, speed] = accelerateHeadingSpeed(
    bulletYaw,
    bulletState.speed,
    shipOriginYaw,
    shipState.speed
  )

  if (heading !== bulletYaw) {
    originNode.rotationQuaternion = originNode.rotationQuaternion.multiply(
      Quaternion.RotationYawPitchRoll(heading - bulletYaw, 0, 0)
    )
  }

  // set the final state
  const [bulletHeading] = getOrientation(originNode)
  $bullet.setKey('heading', bulletHeading)
  $bullet.setKey('speed', speed)

  setLocation($bullet, vector3ToLatLng(bulletNode.absolutePosition))
}
