import { MAX_DURATION, MAX_SPEED } from '../constants'
import { vector3ToGeo } from '../geoCoords/geoToVector3'
import { setLocation } from '../store/ship/ShipSetters'
import type { ShipStore } from '../store/ship/ShipStore'

import { getNextPosition } from './getNextPosition'
import { moveCamera } from './moveCamera'
import { pitchNodeBy } from './orientation'

/**
 * Changes the location of the ship
 * @param $ship
 * @param delta Milliseconds since the last frame
 * @param duration Milliseconds of continuously turning
 */
export const moveShip = (
  $ship: ShipStore,
  delta: number,
  duration: number = MAX_DURATION
) => {
  const shipState = $ship.get()

  if (shipState.speed === 0) {
    return
  }

  const { originNode, positionNode } = shipState
  if (originNode == null || positionNode == null) {
    throw new Error('ship nodes are missing')
  }

  // Apply Velocity
  const speed = Math.min(shipState.speed, MAX_SPEED)

  /** how far to travel in radians between -Math.PI and Math.PI */
  const distance = (speed / 1000) * delta

  if (distance === 0) {
    return
  }

  // FIXME: these calculations are inaccurate by a small amount
  const nextPosition = getNextPosition(originNode, shipState.heading, distance)
  const nextLocation = vector3ToGeo(nextPosition)

  if (
    shipState.lat !== nextLocation.lat ||
    shipState.lng !== nextLocation.lng
  ) {
    // Pitch the ship forward by distance radians
    pitchNodeBy(originNode, distance)

    // Update location (from scene)
    setLocation($ship, vector3ToGeo(positionNode.absolutePosition))

    // FIXME: only move camera for the one in GameState
    if (shipState.type === 'ship') {
      moveCamera(positionNode, delta, duration)
    }
  }
}
