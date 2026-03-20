import type { Vec3 } from '../math/types.js'
import { vec3Copy, vec3Equals } from '../math/vec3.js'
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

export function setAngularVelocity(ship: ShipState, velocity: Vec3): boolean {
  if (vec3Equals(ship.angularVelocity, velocity)) return false
  vec3Copy(ship.angularVelocity, velocity)
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
  const p = ship.position
  if (p[0] === x && p[1] === y && p[2] === z) return false
  p[0] = x
  p[1] = y
  p[2] = z
  return true
}
