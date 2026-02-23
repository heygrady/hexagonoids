import type { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import type { RockState } from '../types.js'
import { rockValueForSize } from './rockHelpers.js'

export function setLat(rock: RockState, lat: number): boolean {
  if (rock.lat === lat) return false
  rock.lat = lat
  return true
}

export function setLng(rock: RockState, lng: number): boolean {
  if (rock.lng === lng) return false
  rock.lng = lng
  return true
}

export function setLocation(
  rock: RockState,
  lat: number,
  lng: number
): boolean {
  const latChanged = setLat(rock, lat)
  const lngChanged = setLng(rock, lng)
  return latChanged || lngChanged
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
