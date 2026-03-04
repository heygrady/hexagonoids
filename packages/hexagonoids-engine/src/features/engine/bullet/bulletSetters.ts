import type { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import type { BulletState } from '../types.js'

export function setLocation(
  bullet: BulletState,
  x: number,
  y: number,
  z: number
): boolean {
  if (bullet.x === x && bullet.y === y && bullet.z === z) return false
  bullet.x = x
  bullet.y = y
  bullet.z = z
  return true
}

export function setAngularVelocity(
  bullet: BulletState,
  velocity: Vector3
): boolean {
  if (bullet.angularVelocity.equals(velocity)) return false
  bullet.angularVelocity = velocity.clone()
  return true
}
