import { Quaternion } from '@babylonjs/core'

import { SPLIT_HEADING_OFFSET, SPLIT_ROLL_DISTANCE } from '../constants'
import { vector3ToGeo } from '../geoCoords/geoToVector3'
import { getOrientation } from '../ship/orientation'
import { setLocation } from '../store/rock/RockSetters'
import type { RockStore } from '../store/rock/RockStore'

/**
 * Updates rock state and rock nodes.
 * @param $rock
 * @param $target
 * @param side
 */
export const orientToRock = (
  $rock: RockStore,
  $target: RockStore,
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

  // 4. offset heading between -SPLIT_HEADING_OFFSET and SPLIT_HEADING_OFFSET degrees
  const headingOffset =
    Math.random() * SPLIT_HEADING_OFFSET * (Math.random() > 0.5 ? 1 : -1)
  originNode.rotationQuaternion = originNode.rotationQuaternion.multiply(
    Quaternion.RotationYawPitchRoll(headingOffset, 0, 0)
  )

  // set the final state (from the scene)
  const [rockHeading] = getOrientation(originNode)
  $rock.setKey('heading', rockHeading)
  setLocation($rock, vector3ToGeo(originNode.absolutePosition))
}
