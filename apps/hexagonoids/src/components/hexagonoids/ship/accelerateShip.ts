import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { easeQuadOut } from 'd3-ease'

import {
  ACCELERATION_RATE,
  FRICTION_COEFFICIENT,
  MAX_DURATION,
  MAX_SPEED,
} from '../constants'
import { bindShipSetters } from '../store/ship/ShipSetters'
import type { ShipStore } from '../store/ship/ShipStore'

import { getOrientation } from './orientation'
import { clampAngularVelocity } from './quaternionPhysics'

/**
 * Accelerate the ship by applying thrust in the direction it's facing.
 * Velocity and orientation are independent:
 * - Ship can move in one direction while facing another
 * - Acceleration adds to existing velocity
 * - Ship maintains momentum
 * @param {ShipStore} $ship - The ship store
 * @param {number} delta - Milliseconds since the last frame
 * @param {number} [duration] - Milliseconds of continuous acceleration
 */
export const accelerateShip = (
  $ship: ShipStore,
  delta: number,
  duration: number = MAX_DURATION
) => {
  const shipState = $ship.get()
  const { $control, originNode, orientationNode } = shipState

  if ($control == null) {
    throw new Error('ship control store is missing')
  }
  if (originNode == null || orientationNode == null) {
    throw new Error('ship nodes are missing')
  }
  if (originNode.rotationQuaternion == null) {
    throw new Error('Ship origin node quaternion is null')
  }

  const controlState = $control.get()
  const { setAngularVelocity } = bindShipSetters($ship)

  // Get ship's facing direction
  const [shipYaw] = getOrientation(orientationNode)
  let currentAngularVelocity = shipState.angularVelocity.clone()

  if (controlState.acceleratePressed) {
    // Apply Acceleration
    // Ease the magnitude from 50% up to 100% over MAX_DURATION
    const t = Math.min(Math.max(duration / MAX_DURATION, 0), 1)
    const et = easeQuadOut(t)
    const halfRate = ACCELERATION_RATE / 1000 / 2
    const accelMagnitude = (et * halfRate + halfRate) * delta

    if (accelMagnitude > 0) {
      // Calculate the direction the ship is facing in world space
      // 1. Get world up (position on sphere)
      const worldUp = Vector3.Up().applyRotationQuaternion(
        originNode.rotationQuaternion
      )

      // 2. Calculate the direction the ship is facing (local yaw rotated to world)
      const localHeadingRotation = Quaternion.RotationAxis(
        Vector3.Up(),
        shipYaw
      )
      const localHeading3D =
        Vector3.Forward().applyRotationQuaternion(localHeadingRotation)
      const worldHeading = localHeading3D.applyRotationQuaternion(
        originNode.rotationQuaternion
      )

      // 3. Calculate rotation axis for acceleration
      const rotationAxis = Vector3.Cross(worldUp, worldHeading)
      const axisLen = rotationAxis.length()

      if (axisLen > 0.00001) {
        // Normalize and scale by acceleration
        rotationAxis.scaleInPlace(1 / axisLen)
        const accelerationVector = rotationAxis.scale(accelMagnitude)

        // 4. Add acceleration to existing velocity
        currentAngularVelocity.addInPlace(accelerationVector)
      }
    }
  }

  // Apply friction/drag when not accelerating
  if (!controlState.acceleratePressed && currentAngularVelocity.length() > 0) {
    // Exponential drag for frame-rate independence
    const dragFactor = Math.exp(-FRICTION_COEFFICIENT * (delta / 1000))
    currentAngularVelocity.scaleInPlace(dragFactor)
  }

  // Clamp velocity to maximum speed
  currentAngularVelocity = clampAngularVelocity(
    currentAngularVelocity,
    MAX_SPEED
  )

  // Update ship state with new angular velocity
  setAngularVelocity(currentAngularVelocity)
}
