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

function getThrustAxisQuaternion(ship: ShipState): Vector3 {
  const worldUp = Vector3.Up().applyRotationQuaternion(ship.orientation)
  const localHeadingRotation = Quaternion.RotationAxis(Vector3.Up(), ship.yaw)
  const localHeading =
    Vector3.Forward().applyRotationQuaternion(localHeadingRotation)
  const worldHeading = localHeading.applyRotationQuaternion(ship.orientation)
  return Vector3.Cross(worldUp, worldHeading)
}

function getThrustAxisFast(ship: ShipState): Vector3 {
  // Derive world basis from orientation (not lat/lng) to avoid pole singularities.
  const { x, y, z, w } = ship.orientation
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

  // Rotated local up (0,1,0).
  const upX = xy - wz
  const upY = 1 - xx - zz
  const upZ = yz + wx

  // Rotated local forward (0,0,1) is yaw=0 heading.
  const forwardX = xz + wy
  const forwardY = yz - wx
  const forwardZ = 1 - xx - yy

  const sinYaw = Math.sin(ship.yaw)
  const cosYaw = Math.cos(ship.yaw)

  // Rotate heading in tangent plane around surface normal.
  const crossX = upY * forwardZ - upZ * forwardY
  const crossY = upZ * forwardX - upX * forwardZ
  const crossZ = upX * forwardY - upY * forwardX
  const dot = upX * forwardX + upY * forwardY + upZ * forwardZ
  const oneMinusCos = 1 - cosYaw

  const headingX = forwardX * cosYaw + crossX * sinYaw + upX * dot * oneMinusCos
  const headingY = forwardY * cosYaw + crossY * sinYaw + upY * dot * oneMinusCos
  const headingZ = forwardZ * cosYaw + crossZ * sinYaw + upZ * dot * oneMinusCos

  // Acceleration axis: up × heading.
  const axisX = upY * headingZ - upZ * headingY
  const axisY = upZ * headingX - upX * headingZ
  const axisZ = upX * headingY - upY * headingX
  return new Vector3(axisX, axisY, axisZ)
}

export function getThrustAccelerationQuaternion(
  ship: ShipState,
  accelMagnitude: number
): Vector3 {
  const axis = getThrustAxisQuaternion(ship)
  const axisLen = axis.length()
  if (axisLen < 0.00001) {
    return Vector3.Zero()
  }
  return axis.scale(accelMagnitude / axisLen)
}

export function getThrustAccelerationFast(
  ship: ShipState,
  accelMagnitude: number
): Vector3 {
  const axis = getThrustAxisFast(ship)
  const axisLen = axis.length()
  if (axisLen < 0.00001) {
    return Vector3.Zero()
  }
  return axis.scale(accelMagnitude / axisLen)
}

function applyThrustAcceleration(
  ship: ShipState,
  accelMagnitude: number,
  useFastThrust: boolean
): void {
  const acceleration = useFastThrust
    ? getThrustAccelerationFast(ship, accelMagnitude)
    : getThrustAccelerationQuaternion(ship, accelMagnitude)
  ship.angularVelocity.addInPlace(acceleration)
}

/**
 * Accelerate the ship by applying thrust in the direction it's facing.
 * Mutates `ship.angularVelocity`.
 *
 * @param ship - The ship state to mutate
 * @param thrusting - Whether the ship is currently thrusting
 * @param dtMs - Time delta in milliseconds
 * @param duration - Milliseconds of continuous acceleration (for easing). Pass 0 on first frame.
 */
export const accelerateShip = (
  ship: ShipState,
  thrusting: boolean,
  dtMs: number,
  duration: number,
  useFastThrust: boolean = true
): void => {
  if (thrusting) {
    // Ease acceleration from 50% to 100% over MAX_DURATION
    const t = Math.min(Math.max(duration / MAX_DURATION, 0), 1)
    const et = easeQuadOut(t)
    const halfRate = ACCELERATION_RATE / 1000 / 2
    const accelMagnitude = (et * halfRate + halfRate) * dtMs

    if (accelMagnitude > 0) {
      applyThrustAcceleration(ship, accelMagnitude, useFastThrust)
    }
  }

  // Apply friction when not thrusting
  if (!thrusting && ship.angularVelocity.length() > 0) {
    const dragFactor = Math.exp(-FRICTION_COEFFICIENT * (dtMs / 1000))
    ship.angularVelocity.scaleInPlace(dragFactor)
  }

  // Clamp to max speed
  ship.angularVelocity = clampAngularVelocity(ship.angularVelocity, MAX_SPEED)
}
