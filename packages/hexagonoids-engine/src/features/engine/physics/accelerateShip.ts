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
const DEG_TO_RAD = Math.PI / 180

function applyThrustAcceleration(
  ship: ShipState,
  accelMagnitude: number
): void {
  const latRad = ship.lat * DEG_TO_RAD
  const lngRad = ship.lng * DEG_TO_RAD
  const cosLat = Math.cos(latRad)
  const sinLat = Math.sin(latRad)
  const cosLng = Math.cos(lngRad)
  const sinLng = Math.sin(lngRad)

  // Surface tangent basis from lat/lng.
  const upX = cosLat * cosLng
  const upY = sinLat
  const upZ = cosLat * sinLng

  const eastX = -sinLng
  const eastY = 0
  const eastZ = cosLng

  const northX = -sinLat * cosLng
  const northY = cosLat
  const northZ = -sinLat * sinLng

  // yaw=0 points east.
  const sinYaw = Math.sin(ship.yaw)
  const cosYaw = Math.cos(ship.yaw)
  const headingX = eastX * cosYaw - northX * sinYaw
  const headingY = eastY * cosYaw - northY * sinYaw
  const headingZ = eastZ * cosYaw - northZ * sinYaw

  // Acceleration axis: up × heading.
  const axisX = upY * headingZ - upZ * headingY
  const axisY = upZ * headingX - upX * headingZ
  const axisZ = upX * headingY - upY * headingX
  const axisLen = Math.sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ)
  if (axisLen < 0.00001) return

  const scale = accelMagnitude / axisLen
  ship.angularVelocity.x += axisX * scale
  ship.angularVelocity.y += axisY * scale
  ship.angularVelocity.z += axisZ * scale
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
  duration: number
): void => {
  if (thrusting) {
    // Ease acceleration from 50% to 100% over MAX_DURATION
    const t = Math.min(Math.max(duration / MAX_DURATION, 0), 1)
    const et = easeQuadOut(t)
    const halfRate = ACCELERATION_RATE / 1000 / 2
    const accelMagnitude = (et * halfRate + halfRate) * dtMs

    if (accelMagnitude > 0) {
      applyThrustAcceleration(ship, accelMagnitude)
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
