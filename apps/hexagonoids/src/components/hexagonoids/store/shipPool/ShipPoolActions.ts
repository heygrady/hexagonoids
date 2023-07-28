import type { Scene } from '@babylonjs/core'
import { action } from 'nanostores'
import type { OmitFirstArg } from 'nanostores/action'

import type { ProjectileStore, TargetStore } from '../../colission/typeCheck'
import type { SegmentStores } from '../../ship/createSergmentNodes'
import { explodeShipSegments } from '../../ship/explodeShipSegments'
import { generateShip as _generateShip } from '../../ship/generateShip'
import type { CameraContextValue } from '../../ShipCamera'
import { die } from '../player/PlayerActions'
import { createShipStore, type ShipStore } from '../ship/ShipStore'

import { getShipStore } from './ShipPool'
import { addShip, removeShip } from './ShipPoolSetters'
import type { ShipPoolStore } from './ShipPoolStore'

export interface ShipPoolActions {
  generateShip: OmitFirstArg<typeof generateShip>
  collideWithTarget: OmitFirstArg<typeof collideWithTarget>
}

export const bindShipPoolActions = (
  $ships: ShipPoolStore
): ShipPoolActions => ({
  generateShip: action($ships, 'generateShip', generateShip),
  collideWithTarget: action($ships, 'collideWithTarget', collideWithTarget),
})

/**
 * Generates a new ship
 *
 * IMPORTANT: The correct way to generate a new ship
 *
 * This is bound as an action to the $ships when it is created (see createShipStore).
 * Manages the ship pool, ship store and the ship nodes.
 * @param $ships set of active ships
 * @param scene the scene to generate the ship in
 * @param splitting whether or not the ship is being split
 * @returns the ship that was generated
 */
export const generateShip = ($ships: ShipPoolStore, scene: Scene) => {
  // Get a clean ship from the pool
  const $ship = getShipStore()

  // Initialize the ship
  _generateShip(scene, $ship)

  // Add the ship to the active ships
  addShip($ships, $ship)

  return $ship
}

export const explodeShip = ($ships: ShipPoolStore, $ship: ShipStore) => {
  const { originNode, shipNode } = $ship.get()
  if (originNode == null) {
    return
  }
  if (shipNode != null) {
    // make it invisible
    shipNode.isVisible = false
  }

  const scene = originNode.getScene()

  const segments: ShipStore[] = []

  for (let i = 0; i < 3; i++) {
    const $segment = createShipStore()
    $segment.setKey('type', 'segment')
    segments.push($segment)
  }

  // Initialize the segments
  explodeShipSegments(scene, $ship, segments as SegmentStores)

  for (const $segment of segments) {
    // Add the segment to the active ships
    addShip($ships, $segment)
  }

  // Remove the previous ship
  removeShip($ships, $ship)
  return segments
}

export const collideWithTarget = (
  $ships: ShipPoolStore,
  $ship: ShipStore,
  $target: TargetStore | ProjectileStore,
  cameraContext?: CameraContextValue
) => {
  const { $player, originNode } = $ship.get()
  if ($player == null) {
    throw new Error('Ship has no player')
  }
  if ($player != null && originNode != null) {
    const scene = originNode.getScene()
    die($player, $ships, scene, cameraContext)
  }
  explodeShip($ships, $ship)
  // removeShip($ships, $ship)
}
