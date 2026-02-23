import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import {
  ACCELERATION_RATE,
  FRICTION_COEFFICIENT,
  MAX_DURATION,
  MAX_SPEED,
} from '../constants.js'
import type { ShipState } from '../types.js'

import { clampAngularVelocity } from './quaternionPhysics.js'

/**
 * Easing function: quad out — t * (2 - t)
 * Equivalent to d3-ease easeQuadOut.
 */
const easeQuadOut = (t: number): number => t * (2 - t)

/**
 * Accelerate the ship by applying thrust in the direction it's facing.
 * Mutates `ship.angularVelocity`.
 *
 * @param ship - The ship state to mutate
 * @param thrusting - Whether the ship is currently thrusting
 * @param dt - Time delta in milliseconds
 * @param duration - Milliseconds of continuous acceleration (for easing). Pass 0 on first frame.
 */
export const accelerateShip = (
  ship: ShipState,
  thrusting: boolean,
  dt: number,
  duration: number
): void => {
  if (thrusting) {
    // Ease acceleration from 50% to 100% over MAX_DURATION
    const t = Math.min(Math.max(duration / MAX_DURATION, 0), 1)
    const et = easeQuadOut(t)
    const halfRate = ACCELERATION_RATE / 1000 / 2
    const accelMagnitude = (et * halfRate + halfRate) * dt

    if (accelMagnitude > 0) {
      // Get world up (position on sphere) from orientation quaternion
      const worldUp = Vector3.Up().applyRotationQuaternion(ship.orientation)

      // Calculate facing direction: local yaw rotated to world space
      const localHeadingRotation = Quaternion.RotationAxis(
        Vector3.Up(),
        ship.yaw
      )
      const localHeading3D =
        Vector3.Forward().applyRotationQuaternion(localHeadingRotation)
      const worldHeading = localHeading3D.applyRotationQuaternion(
        ship.orientation
      )

      // Rotation axis for acceleration: worldUp × worldHeading
      const rotationAxis = Vector3.Cross(worldUp, worldHeading)
      const axisLen = rotationAxis.length()

      if (axisLen > 0.00001) {
        rotationAxis.scaleInPlace(1 / axisLen)
        const accelerationVector = rotationAxis.scale(accelMagnitude)
        ship.angularVelocity.addInPlace(accelerationVector)
      }
    }
  }

  // Apply friction when not thrusting
  if (!thrusting && ship.angularVelocity.length() > 0) {
    const dragFactor = Math.exp(-FRICTION_COEFFICIENT * (dt / 1000))
    ship.angularVelocity.scaleInPlace(dragFactor)
  }

  // Clamp to max speed
  ship.angularVelocity = clampAngularVelocity(ship.angularVelocity, MAX_SPEED)
}
