import {
  ACCELERATION_RATE,
  FRICTION_COEFFICIENT,
  MAX_DURATION,
  MAX_SPEED,
} from '../constants.js'
import type { Vec3 } from '../math/types.js'
import { vec3Length, vec3ScaleInPlace } from '../math/vec3.js'
import type { ShipState } from '../types.js'

import { clampAngularVelocity } from './quaternionPhysics.js'

/**
 * Easing function: quad out — t * (2 - t)
 */
const easeQuadOut = (t: number): number => t * (2 - t)

// Module-scoped scratch for thrust axis computation
const _thrustAxis = new Float64Array(3) as Vec3

/**
 * Compute thrust axis for a ship. Pure scalar — zero allocations.
 * Result written into module-scoped scratch, valid until next call.
 */
function computeThrustAxis(ship: ShipState): Vec3 {
  const q = ship.orientation
  const x = q[0],
    y = q[1],
    z = q[2],
    w = q[3]
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2

  // Rotated local up (0,1,0)
  const upX = xy - wz
  const upY = 1 - xx - zz
  const upZ = yz + wx

  // Rotated local forward (0,0,1) is yaw=0 heading
  const forwardX = xz + wy
  const forwardY = yz - wx
  const forwardZ = 1 - xx - yy

  const sinYaw = Math.sin(ship.yaw)
  const cosYaw = Math.cos(ship.yaw)

  // Rotate heading in tangent plane around surface normal
  const crossX = upY * forwardZ - upZ * forwardY
  const crossY = upZ * forwardX - upX * forwardZ
  const crossZ = upX * forwardY - upY * forwardX
  const dot = upX * forwardX + upY * forwardY + upZ * forwardZ
  const oneMinusCos = 1 - cosYaw

  const headingX = forwardX * cosYaw + crossX * sinYaw + upX * dot * oneMinusCos
  const headingY = forwardY * cosYaw + crossY * sinYaw + upY * dot * oneMinusCos
  const headingZ = forwardZ * cosYaw + crossZ * sinYaw + upZ * dot * oneMinusCos

  // Acceleration axis: up × heading
  _thrustAxis[0] = upY * headingZ - upZ * headingY
  _thrustAxis[1] = upZ * headingX - upX * headingZ
  _thrustAxis[2] = upX * headingY - upY * headingX
  return _thrustAxis
}

function applyThrustAcceleration(
  ship: ShipState,
  accelMagnitude: number
): void {
  const axis = computeThrustAxis(ship)
  const axisLen = vec3Length(axis)
  if (axisLen < 0.00001) return
  const scale = accelMagnitude / axisLen
  ship.angularVelocity[0] += axis[0] * scale
  ship.angularVelocity[1] += axis[1] * scale
  ship.angularVelocity[2] += axis[2] * scale
}

/**
 * Accelerate the ship by applying thrust in the direction it's facing.
 * Mutates `ship.angularVelocity`.
 *
 * @param ship - The ship state to mutate
 * @param thrusting - Whether the ship is currently thrusting
 * @param dtMs - Time delta in milliseconds
 * @param duration - Milliseconds of continuous acceleration (for easing)
 */
export const accelerateShip = (
  ship: ShipState,
  thrusting: boolean,
  dtMs: number,
  duration: number
): void => {
  if (thrusting) {
    const t = Math.min(Math.max(duration / MAX_DURATION, 0), 1)
    const et = easeQuadOut(t)
    const halfRate = ACCELERATION_RATE / 1000 / 2
    const accelMagnitude = (et * halfRate + halfRate) * dtMs

    if (accelMagnitude > 0) {
      applyThrustAcceleration(ship, accelMagnitude)
    }
  }

  // Apply friction when not thrusting
  if (!thrusting && vec3Length(ship.angularVelocity) > 0) {
    const dragFactor = Math.exp(-FRICTION_COEFFICIENT * (dtMs / 1000))
    vec3ScaleInPlace(ship.angularVelocity, dragFactor)
  }

  // Clamp to max speed
  clampAngularVelocity(ship.angularVelocity, MAX_SPEED)
}
