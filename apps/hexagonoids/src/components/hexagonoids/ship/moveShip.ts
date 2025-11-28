import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import { vector3ToLatLng } from '@heygrady/h3-babylon'

import { setLocation } from '../store/ship/ShipSetters'
import type { ShipStore } from '../store/ship/ShipStore'

import { moveCamera } from './moveCamera'
import { integrateAngularVelocity } from './quaternionPhysics'

/**
 * Changes the location of the ship
 * @param {ShipStore} $ship - The ship store
 * @param {number} delta - Milliseconds since the last frame
 * @param {number} duration - Milliseconds of continuously turning
 */
export const moveShip = ($ship: ShipStore, delta: number, duration: number) => {
  const shipState = $ship.get()

  // Check if ship is moving using angular velocity magnitude
  if (shipState.angularVelocity.length() === 0) {
    return
  }

  const { originNode, positionNode } = shipState
  if (originNode == null || positionNode == null) {
    throw new Error('ship nodes are missing')
  }

  // Ensure rotationQuaternion is initialized
  if (originNode.rotationQuaternion == null) {
    originNode.rotationQuaternion = Quaternion.Identity()
  }

  // Integrate angular velocity over deltaTime
  // This updates the position quaternion based on angular velocity
  const updatedRotation = integrateAngularVelocity(
    originNode.rotationQuaternion,
    shipState.angularVelocity,
    delta / 1000 // Convert milliseconds to seconds
  )

  // Update origin node position quaternion
  originNode.rotationQuaternion = updatedRotation

  // Force world matrix recalculation
  originNode.computeWorldMatrix(true)

  // Get new location from the mesh's position in the scene
  const newLocation = vector3ToLatLng(positionNode.absolutePosition)

  // Update location in state
  setLocation($ship, newLocation)

  // Move camera if this is the player ship
  if (shipState.type === 'ship') {
    moveCamera(positionNode, delta, duration)
  }
}
