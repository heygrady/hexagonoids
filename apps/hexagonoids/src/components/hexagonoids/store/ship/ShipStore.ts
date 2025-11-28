import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { map, type MapStore } from 'nanostores'
import { createUniqueId } from 'solid-js'

import { createControlStore, resetControl } from '../control/ControlStore'

import { defaultShipState, type ShipState } from './ShipState'

export { defaultShipState }

export type ShipStore = MapStore<ShipState>

/**
 * This is used by the ShipPool to create ships.
 * @returns {ShipStore} The created ship store
 */
export const createShipStore = (): ShipStore => {
  const $ship = map<ShipState>({ ...defaultShipState })

  $ship.setKey('id', createUniqueId())

  const $control = createControlStore()
  $ship.setKey('$control', $control)

  return $ship
}

/**
 * This is used by the ShipPool to recycle ships.
 * @param {ShipStore} $ship - The ship store to reset
 * @returns {ShipStore} The reset ship store
 */
export const resetShip = ($ship: ShipStore) => {
  // preserve the ID, nodes and control store
  const {
    id,
    originNode,
    positionNode,
    orientationNode,
    shipNode,
    shipTailNode,
    $control,
  } = $ship.get()

  // make it invisible
  if (originNode != null && shipNode != null) {
    shipNode.isVisible = false
    originNode.setEnabled(false)
  }

  // reset the quaternions
  if (originNode != null) {
    originNode.rotationQuaternion = Quaternion.Identity()
  }
  if (orientationNode != null) {
    orientationNode.rotationQuaternion = Quaternion.Identity()
  }

  if ($control != null) {
    // reset the controls
    resetControl($control)
  }

  $ship.set({
    ...defaultShipState,
    id,
    originNode,
    positionNode,
    orientationNode,
    shipNode,
    shipTailNode,
    $control,
  })
  return $ship
}
