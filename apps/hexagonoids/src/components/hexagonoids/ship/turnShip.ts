import { easeCircleOut } from 'd3-ease'

import { MAX_DURATION, TURN_RATE } from '../constants'
import { setYaw } from '../store/ship/ShipSetters'
import type { ShipStore } from '../store/ship/ShipStore'

import { getOrientation, turnNodeBy } from './orientation'

/**
 * Changes the yaw of the ship
 * @param orientationNode The node to rotate around the up axis
 * @param $ship
 * @param delta Milliseconds since the last frame
 * @param duration Milliseconds of continuous turning
 */
export const turnShip = (
  $ship: ShipStore,
  delta: number,
  duration: number = MAX_DURATION
) => {
  const shipState = $ship.get()
  const { $control, orientationNode } = shipState

  if ($control == null) {
    throw new Error('ship control store is missing')
  }
  if (orientationNode == null) {
    throw new Error('ship nodes are missing')
  }

  const controlState = $control.get()

  const left = controlState.leftPressed || !controlState.leftAcked ? -1 : 0
  const right = controlState.rightPressed || !controlState.rightAcked ? 1 : 0
  const scale = left + right

  if (scale === 0) {
    return
  }

  // ease the magnitude from 25% up to 100% over MAX_DURATION
  const t = Math.max(0, Math.min(1, duration / MAX_DURATION))
  const et = easeCircleOut(t)

  const magnitude = ((et * TURN_RATE) / 1000) * delta

  // Degrees to rotate
  const diff = scale * magnitude

  if (diff === 0) {
    return
  }

  // Update yaw on the mesh
  turnNodeBy(orientationNode, diff)

  // Extract the yaw from the scene
  const [shipYaw] = getOrientation(orientationNode)

  // Update yaw in the store
  setYaw($ship, shipYaw)
}
