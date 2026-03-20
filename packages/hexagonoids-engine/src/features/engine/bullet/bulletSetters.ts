import type { Vec3 } from '../math/types.js'
import { vec3Copy, vec3Equals } from '../math/vec3.js'
import type { BulletState } from '../types.js'

export function setLocation(
  bullet: BulletState,
  x: number,
  y: number,
  z: number
): boolean {
  const p = bullet.position
  if (p[0] === x && p[1] === y && p[2] === z) return false
  p[0] = x
  p[1] = y
  p[2] = z
  return true
}

export function setAngularVelocity(
  bullet: BulletState,
  velocity: Vec3
): boolean {
  if (vec3Equals(bullet.angularVelocity, velocity)) return false
  vec3Copy(bullet.angularVelocity, velocity)
  return true
}
