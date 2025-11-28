import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { vector3ToLatLng } from '@heygrady/h3-babylon'

import { BULLET_SPEED, GUN_DISTANCE } from '../constants'
import { getOrientation } from '../ship/orientation'
import { headingToAngularVelocity } from '../ship/quaternionPhysics'
import { setAngularVelocity, setLocation } from '../store/bullet/BulletSetters'
import type { BulletStore } from '../store/bullet/BulletStore'

/**
 * Updates bullet state and bullet nodes.
 * Fires the bullet in the direction the ship is facing.
 * Bullet inherits ship's velocity and adds firing speed.
 * @param {BulletStore} $bullet - The bullet store
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

  if (shipOriginNode.rotationQuaternion == null) {
    shipOriginNode.rotationQuaternion = Quaternion.Identity()
  }
  if (originNode.rotationQuaternion == null) {
    originNode.rotationQuaternion = Quaternion.Identity()
  }

  const [shipOrientationYaw] = getOrientation(shipOrientationNode)

  /**
   * Fire the bullet in the direction the ship is facing
   * 1. Position the bullet at the ship's origin
   * 2. Rotate it to match the ship's gun orientation
   * 3. Pitch it forward by the GUN_DISTANCE
   * 4. Set velocity: inherit ship's velocity + firing speed in ship's facing direction
   */

  // 1. Position bullet at ship's location
  originNode.rotationQuaternion = shipOriginNode.rotationQuaternion.clone()

  // 2. Rotate to match ship's gun orientation
  if (shipOrientationYaw !== 0) {
    originNode.rotationQuaternion = originNode.rotationQuaternion.multiply(
      Quaternion.RotationYawPitchRoll(shipOrientationYaw, 0, 0)
    )
  }

  // 3. Pitch forward by GUN_DISTANCE
  originNode.rotationQuaternion = originNode.rotationQuaternion.multiply(
    Quaternion.RotationYawPitchRoll(0, GUN_DISTANCE, 0)
  )

  // 4. Set velocity: inherit ship's velocity + firing speed straight forward
  // Start with ship's current velocity (inherit momentum)
  const bulletVelocity = shipState.angularVelocity.clone()

  // Add bullet speed in the direction the bullet is currently facing (local heading = 0)
  // The bullet's orientation already includes the ship's facing direction and pitch,
  // so we fire straight forward from the bullet's current orientation
  const firingVelocity = headingToAngularVelocity(
    originNode.rotationQuaternion,
    0, // localHeading: 0 = straight forward in bullet's local frame
    BULLET_SPEED
  )
  bulletVelocity.addInPlace(firingVelocity)

  setAngularVelocity($bullet, bulletVelocity)
  setLocation($bullet, vector3ToLatLng(bulletNode.absolutePosition))
}
