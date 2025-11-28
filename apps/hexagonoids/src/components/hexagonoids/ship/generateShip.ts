import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Scene } from '@babylonjs/core/scene'
import { latLngToVector3, vector3ToLatLng } from '@heygrady/h3-babylon'

import { RADIUS } from '../constants'
import { setGeneratedAt, setLocation } from '../store/ship/ShipSetters'
import type { ShipStore } from '../store/ship/ShipStore'

import { createShipNodes } from './createShipNodes'
import { getYawPitch } from './getYawPitch'
import { moveNodeBy } from './orientation'

/**
 * INTERNAL USE ONLY. see generateShip in store/shipPool
 *
 * Updates ship state and ship nodes.
 * @param {Scene} scene - The scene
 * @param {ShipStore} $ship - the ship to generate
 */
export const generateShip = (scene: Scene, $ship: ShipStore) => {
  let {
    id,
    originNode,
    positionNode,
    orientationNode,
    shipNode,
    shipTailNode,
  } = $ship.get()

  // Create Nodes when missing
  if (
    originNode == null ||
    positionNode == null ||
    orientationNode == null ||
    shipNode == null ||
    shipTailNode == null
  ) {
    if (id === undefined) {
      console.warn('Ship id should be set')
    }
    createShipNodes(scene, $ship)
    ;({ originNode, orientationNode, shipNode, shipTailNode } = $ship.get())
  }

  // Never happens
  if (
    originNode == null ||
    orientationNode == null ||
    shipNode == null ||
    shipTailNode == null
  ) {
    console.warn(
      'Ship originNode, orientationNode, shipNode and shipTailNode must be set'
    )
    return
  }

  // Make it visible
  shipNode.isVisible = true
  originNode.setEnabled(true)

  const shipState = $ship.get()

  // Orient the ship on the sphere
  const initialPosition = latLngToVector3(
    shipState.lat,
    shipState.lng,
    RADIUS
  ).normalize()
  const [yaw, pitch] = getYawPitch(initialPosition)

  // Position the ship at the correct initial location
  moveNodeBy(originNode, yaw, pitch)

  // Apply initial yaw rotation to orientation node if ship has non-zero yaw
  if (shipState.yaw !== 0) {
    const yawQuaternion = Quaternion.RotationAxis(Vector3.Up(), shipState.yaw)
    orientationNode.rotationQuaternion =
      orientationNode.rotationQuaternion?.multiply(yawQuaternion) ??
      yawQuaternion
  }

  // Note: Angular velocity-based positioning replaces the old heading system.
  // The position is now determined entirely by the rotation quaternion.

  const location = vector3ToLatLng(shipNode.absolutePosition)

  // Update location (from scene)
  setLocation($ship, location)
  setGeneratedAt($ship)
}
