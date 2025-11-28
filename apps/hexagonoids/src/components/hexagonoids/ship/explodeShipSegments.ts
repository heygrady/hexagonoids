import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import type { Scene } from '@babylonjs/core/scene'
import { vector3ToLatLng } from '@heygrady/h3-babylon'

import { EXPLOSION_LARGE_SPEED } from '../constants'
import { headingToAngularVelocity } from '../ship/quaternionPhysics'
import {
  setGeneratedAt,
  setLocation,
  setYaw,
  setAngularVelocity,
} from '../store/ship/ShipSetters'
import type { ShipStore } from '../store/ship/ShipStore'

import { type SegmentStores, createSegmentNodes } from './createSergmentNodes'
import { getOrientation } from './orientation'

const angleDifference = (angle1: number, angle2: number): number => {
  // Step 1: Subtract the two angles
  let difference = angle1 - angle2

  // Step 2: Normalize the result to the range -π to π using modulo
  difference = ((difference + Math.PI) % (2 * Math.PI)) - Math.PI

  return difference
}

export const explodeShipSegment = (
  scene: Scene,
  $ship: ShipStore,
  $segment: ShipStore
) => {
  const {
    id: shipId,
    originNode: shipOriginNode,
    orientationNode: shipOrientationNode,
    // shipNode,
  } = $ship.get()
  const {
    id: segmentId,
    originNode: segmentOriginNode,
    orientationNode: segmentOrientationNode,
    // shipNode: segmentNode,
  } = $segment.get()

  if (shipOriginNode == null || shipOrientationNode == null) {
    throw new Error(
      'Ship originNode, orientationNode and shipNode must be set before exploding'
    )
  }
  if (segmentOriginNode == null || segmentOrientationNode == null) {
    throw new Error(
      'Segment originNode and orientationNode must be set before exploding'
    )
  }
  if (shipId === undefined) {
    throw new Error('Ship id must be set')
  }
  if (segmentId === undefined) {
    throw new Error('Segment id must be set')
  }

  /**
   * Initial heading and speed of the segment
   * 1. orient the segment origin to match the ship's origin
   * 2. rotate it to match the ship's orientation
   * 3. Randomize speed and heading
   * 4. Randomize the right/left, accelerate of the controls
   * 5. Update from scene
   */

  // 1. orient the segment origin to match the ship's origin
  if (shipOriginNode.rotationQuaternion == null) {
    shipOriginNode.rotationQuaternion = Quaternion.Identity()
  }
  segmentOriginNode.rotationQuaternion =
    shipOriginNode.rotationQuaternion.clone()

  // 2. rotate it to match the ship's orientation
  if (shipOrientationNode.rotationQuaternion == null) {
    shipOrientationNode.rotationQuaternion = Quaternion.Identity()
  }
  segmentOrientationNode.rotationQuaternion =
    shipOrientationNode.rotationQuaternion.clone() ?? Quaternion.Identity()

  // 3. Randomize speed and heading
  const speed =
    EXPLOSION_LARGE_SPEED + Math.random() * EXPLOSION_LARGE_SPEED * 2
  const heading = (Math.random() * Math.PI * 2 - Math.PI) / 2
  if (heading !== 0) {
    // randomly change the heading
    const [segmentHeading] = getOrientation(segmentOriginNode)
    segmentOriginNode.rotationQuaternion =
      segmentOriginNode.rotationQuaternion.multiply(
        Quaternion.RotationYawPitchRoll(heading - segmentHeading, 0, 0)
      )
    // offset the yaw
    const [segmentHeading2] = getOrientation(segmentOriginNode)
    const [segmentYaw] = getOrientation(segmentOrientationNode)
    segmentOrientationNode.rotationQuaternion =
      segmentOrientationNode.rotationQuaternion.multiply(
        Quaternion.RotationYawPitchRoll(
          -angleDifference(segmentHeading, segmentHeading2) - segmentYaw,
          0,
          0
        )
      )
  }

  // 4. Randomize the right/left, accelerate of the controls
  const $control = $segment.get().$control
  if ($control != null) {
    const right = Math.random() < 0.5
    if (right) {
      $control.setKey('rightPressed', true)
      $control.setKey('rightPressedAt', Date.now())
      $control.setKey('rightAcked', false)
    } else {
      $control.setKey('leftPressed', true)
      $control.setKey('leftPressedAt', Date.now())
      $control.setKey('leftAcked', false)
    }
    // $control.setKey('acceleratePressed', true)
    // $control.setKey('acceleratePressedAt', Date.now())
    // $control.setKey('accelerateAcked', false)
  }

  // 5. Update from scene and set angular velocity
  const [segmentYaw] = getOrientation(segmentOrientationNode)
  const location = vector3ToLatLng(segmentOrientationNode.absolutePosition)

  // Convert speed and heading to angular velocity (heading is already in segmentOriginNode.rotationQuaternion)
  const angularVelocity = headingToAngularVelocity(
    segmentOriginNode.rotationQuaternion,
    0, // heading offset: 0 since we already rotated the segment to the desired heading
    speed
  )
  setAngularVelocity($segment, angularVelocity)
  setYaw($segment, segmentYaw)
  setLocation($segment, location)
  setGeneratedAt($segment)
}

/**
 * Explodes ship segments from the given ship
 * @param {Scene} scene - The scene
 * @param {ShipStore} $ship - the ship to generate
 * @param {SegmentStores} segments - The segment stores
 */
export const explodeShipSegments = (
  scene: Scene,
  $ship: ShipStore,
  segments: SegmentStores
) => {
  createSegmentNodes(scene, $ship.get().id ?? 'unknown', segments)
  for (const $segment of segments) {
    explodeShipSegment(scene, $ship, $segment)
  }
}
