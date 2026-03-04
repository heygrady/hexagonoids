import type { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import type { ShipState } from '../types.js'

/**
 * Wrap an angle to the range [-PI, PI].
 */
function wrapAngle(angle: number): number {
  let result = angle % (2 * Math.PI)
  if (result > Math.PI) result -= 2 * Math.PI
  if (result < -Math.PI) result += 2 * Math.PI
  return result
}

export function setYaw(ship: ShipState, yaw: number): boolean {
  const wrapped = wrapAngle(yaw)
  if (ship.yaw === wrapped) return false
  ship.yaw = wrapped
  return true
}

export function setAngularVelocity(
  ship: ShipState,
  velocity: Vector3
): boolean {
  if (ship.angularVelocity.equals(velocity)) return false
  ship.angularVelocity = velocity.clone()
  return true
}

export function setFiredAt(ship: ShipState, firedAt: number | null): boolean {
  if (ship.firedAt === firedAt) return false
  ship.firedAt = firedAt
  return true
}

export function setLocation(
  ship: ShipState,
  x: number,
  y: number,
  z: number
): boolean {
  if (ship.x === x && ship.y === y && ship.z === z) return false
  ship.x = x
  ship.y = y
  ship.z = z
  return true
}
