import type { Vec3 } from '../math/types.js'
import { vec3Copy, vec3Equals } from '../math/vec3.js'
import type { RockState } from '../types.js'
import { rockValueForSize } from './rockHelpers.js'

export function setLocation(
  rock: RockState,
  x: number,
  y: number,
  z: number
): boolean {
  const p = rock.position
  if (p[0] === x && p[1] === y && p[2] === z) return false
  p[0] = x
  p[1] = y
  p[2] = z
  return true
}

export function setAngularVelocity(rock: RockState, velocity: Vec3): boolean {
  if (vec3Equals(rock.angularVelocity, velocity)) return false
  vec3Copy(rock.angularVelocity, velocity)
  return true
}

export function setSize(rock: RockState, size: 0 | 1 | 2): boolean {
  if (rock.size === size) return false
  rock.size = size
  rock.value = rockValueForSize(size)
  return true
}
