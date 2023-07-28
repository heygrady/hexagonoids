import type { Scene } from '@babylonjs/core'

import { RADIUS } from '../constants'
import { geoToVector3, vector3ToGeo } from '../geoCoords/geoToVector3'
import {
  setGeneratedAt,
  setHeading,
  setLocation,
} from '../store/ship/ShipSetters'
import type { ShipStore } from '../store/ship/ShipStore'

import { createShipNodes } from './createShipNodes'
import { getYawPitch } from './getYawPitch'
import { getOrientation, moveNodeBy, turnNodeBy } from './orientation'

/**
 * INTERNAL USE ONLY. see generateShip in store/shipPool
 *
 * Updates ship state and ship nodes.
 * @param scene
 * @param $ship the ship to generate
 */
export const generateShip = (scene: Scene, $ship: ShipStore) => {
  let { id, originNode, positionNode, orientationNode, shipNode } = $ship.get()

  // Create Nodes when missing
  if (
    originNode == null ||
    positionNode == null ||
    orientationNode == null ||
    shipNode == null
  ) {
    if (id === undefined) {
      console.warn('Ship id should be set')
    }
    createShipNodes(scene, $ship)
    ;({ originNode, orientationNode, shipNode } = $ship.get())
  }

  // Never happens
  if (originNode == null || orientationNode == null || shipNode == null) {
    console.warn('Ship originNode, orientationNode and shipNode must be set')
    return
  }

  // Make it visible
  shipNode.isVisible = true
  originNode.setEnabled(true)

  const shipState = $ship.get()

  // Orient the ship on the sphere
  const initialPosition = geoToVector3(
    shipState.lat,
    shipState.lng,
    RADIUS
  ).normalize()
  const [yaw, pitch] = getYawPitch(initialPosition)

  // Position the ship at the correction initial location
  moveNodeBy(originNode, yaw, pitch)

  if (shipState.yaw !== 0) {
    // FIXME: we need to initialize shipState.yaw on the orientationNode as well
  }

  // Rotate the ship to the correct initial heading
  if (shipState.heading !== 0) {
    turnNodeBy(originNode, shipState.heading - yaw)
  }
  // Extract the heading from the scene
  const [shipHeading] = getOrientation(originNode)

  // Update heading (from scene)
  setHeading($ship, shipHeading)

  const location = vector3ToGeo(shipNode.absolutePosition)

  // Update location (from scene)
  setLocation($ship, location)
  setGeneratedAt($ship)
}
