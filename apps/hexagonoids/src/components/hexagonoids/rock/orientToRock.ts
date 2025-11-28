import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { vector3ToLatLng } from '@heygrady/h3-babylon'

import { SPLIT_HEADING_OFFSET, SPLIT_ROLL_DISTANCE } from '../constants'
import { setAngularVelocity, setLocation } from '../store/rock/RockSetters'
import type { RockStore } from '../store/rock/RockStore'

/**
 * Positions and initializes a child rock relative to a parent rock.
 * Sets both position (with roll offset) and velocity (with heading offset).
 * @param {RockStore} $rock - The child rock to initialize
 * @param {RockStore} $target - The parent rock to base position/velocity on
 * @param {Vector3} parentAngularVelocity - The parent's current angular velocity
 * @param {number} side - Which side to split towards (-1 or 1)
 */
export const orientToRock = (
  $rock: RockStore,
  $target: RockStore,
  parentAngularVelocity: Vector3,
  side: number = -1 | 1
) => {
  const targetState = $target.get()
  const {
    originNode: targetOriginNode,
    orientationNode: targetOrientationNode,
  } = targetState

  if (targetOriginNode == null) {
    throw new Error('Cannot orient a rock without a RockState.originNode')
  }
  if (targetOrientationNode == null) {
    throw new Error('Cannot orient a rock without a RockState.orientationNode')
  }

  const rockState = $rock.get()
  const { originNode, orientationNode } = rockState

  if (originNode == null) {
    throw new Error('Cannot orient a rock without a RockState.originNode')
  }
  if (orientationNode == null) {
    throw new Error('Cannot orient a rock without a RockState.orientationNode')
  }

  /**
   * Initial position and heading of the rock
   * 1. orient the rock origin to match the target's origin
   * 2. rotate it to match the target's orientation
   * 3. roll it to the side by SPLIT_ROLL_DISTANCE
   * 4. offset heading between -SPLIT_HEADING_OFFSET and SPLIT_HEADING_OFFSET
   */

  // 1. orient the rock origin to match the target's origin
  // rock position
  if (targetOriginNode.rotationQuaternion == null) {
    targetOriginNode.rotationQuaternion = Quaternion.Identity()
  }
  originNode.rotationQuaternion = targetOriginNode.rotationQuaternion.clone()

  // 2. rotate it to match the target's orientation
  // rock rotation (not important)
  if (targetOrientationNode.rotationQuaternion == null) {
    targetOrientationNode.rotationQuaternion = Quaternion.Identity()
  }
  orientationNode.rotationQuaternion =
    targetOrientationNode.rotationQuaternion.clone()

  // 3. roll it to the side by SPLIT_ROLL_DISTANCE
  // FIXME: this distance should be relative to the parent rock's size
  const roll = SPLIT_ROLL_DISTANCE * side * Math.random()
  originNode.rotationQuaternion = originNode.rotationQuaternion.multiply(
    Quaternion.RotationYawPitchRoll(0, 0, roll)
  )

  // 4. Set velocity: offset heading between -SPLIT_HEADING_OFFSET and SPLIT_HEADING_OFFSET degrees
  // Get parent's world up to use as rotation axis
  const parentWorldUp = Vector3.Up().applyRotationQuaternion(
    targetOriginNode.rotationQuaternion
  )

  // Random heading offset for the child rock's direction of travel
  const headingOffset =
    Math.random() * SPLIT_HEADING_OFFSET * (Math.random() > 0.5 ? 1 : -1)

  // Create rotation around parent's world up axis
  const offsetRotation = Quaternion.RotationAxis(parentWorldUp, headingOffset)

  // Rotate parent's velocity to get child's velocity with the heading offset
  const childAngularVelocity =
    parentAngularVelocity.applyRotationQuaternion(offsetRotation)
  setAngularVelocity($rock, childAngularVelocity)

  // Set the final location
  setLocation($rock, vector3ToLatLng(originNode.absolutePosition))
}
