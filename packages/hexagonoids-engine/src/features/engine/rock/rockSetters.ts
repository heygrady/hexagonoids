import type { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import type { RockState } from '../types.js'
import { rockValueForSize } from './rockHelpers.js'

export function setLocation(
  rock: RockState,
  x: number,
  y: number,
  z: number
): boolean {
  if (rock.x === x && rock.y === y && rock.z === z) return false
  rock.x = x
  rock.y = y
  rock.z = z
  return true
}

export function setAngularVelocity(
  rock: RockState,
  velocity: Vector3
): boolean {
  if (rock.angularVelocity.equals(velocity)) return false
  rock.angularVelocity = velocity.clone()
  return true
}

export function setSize(rock: RockState, size: 0 | 1 | 2): boolean {
  if (rock.size === size) return false
  rock.size = size
  rock.value = rockValueForSize(size)
  return true
}
