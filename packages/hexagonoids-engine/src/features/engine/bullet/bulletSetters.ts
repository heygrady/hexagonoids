import type { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import type { BulletState } from '../types.js'

export function setLat(bullet: BulletState, lat: number): boolean {
  if (bullet.lat === lat) return false
  bullet.lat = lat
  return true
}

export function setLng(bullet: BulletState, lng: number): boolean {
  if (bullet.lng === lng) return false
  bullet.lng = lng
  return true
}

export function setLocation(
  bullet: BulletState,
  lat: number,
  lng: number
): boolean {
  const latChanged = setLat(bullet, lat)
  const lngChanged = setLng(bullet, lng)
  return latChanged || lngChanged
}

export function setAngularVelocity(
  bullet: BulletState,
  velocity: Vector3
): boolean {
  if (bullet.angularVelocity.equals(velocity)) return false
  bullet.angularVelocity = velocity.clone()
  return true
}
