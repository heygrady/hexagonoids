import { type Scene, TransformNode, Quaternion } from '@babylonjs/core'

import { getCommonMaterial } from '../common/commonMaterial'
import { RADIUS, SHIP_SCALE } from '../constants'
import type { ShipStore } from '../store/ship/ShipStore'

import { createShipPolygon } from './createShipPolygon'
import { createShipTailPolygon } from './createShipTailPolygon'
import { turnNodeBy } from './orientation'

export const createShipNodes = (scene: Scene, $ship: ShipStore) => {
  const id = $ship.get().id ?? 'unknown'
  const shipNode = createShipPolygon(scene, id)
  const shipTailNode = createShipTailPolygon(scene, id)

  const shipMaterial = getCommonMaterial(scene).clone(`shipMaterial_${id}`)
  shipNode.material = shipMaterial
  shipNode.scaling.setAll(SHIP_SCALE)

  shipTailNode.material = shipMaterial
  shipTailNode.parent = shipNode
  shipTailNode.isVisible = false

  // Point the ship (so the front of the ship faces forward)
  turnNodeBy(shipNode, -Math.PI / 2)

  /** Center of rotation; used to rotate the ship into the correct position; rotate to update ship location and heading */
  const originNode = new TransformNode(`originNode_${id}`)
  originNode.rotationQuaternion = Quaternion.Identity()

  /** Position of the ship relative to the originNode; never update directly */
  const positionNode = new TransformNode(`positionNode_${id}`)
  positionNode.position.y = RADIUS // Initialize to up on the sphere

  /** Rotation of the ship relative to the positionNode; rotate to update ship orientation */
  const orientationNode = new TransformNode(`orientationNode_${id}`)
  orientationNode.rotationQuaternion = Quaternion.Identity()

  const globe = scene.getMeshByName('globe')
  if (globe != null) {
    originNode.parent = globe
  }

  positionNode.parent = originNode
  orientationNode.parent = positionNode
  shipNode.parent = orientationNode

  // Tell the $ship about the ship
  $ship.setKey('originNode', originNode)
  $ship.setKey('positionNode', positionNode)
  $ship.setKey('orientationNode', orientationNode)
  $ship.setKey('shipNode', shipNode)
  $ship.setKey('shipTailNode', shipTailNode)
}
