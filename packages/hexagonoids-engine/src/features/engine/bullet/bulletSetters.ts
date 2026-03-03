import type { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import { latLngToUnitPoint } from '../physics/latLng.js'
import type { BulletState } from '../types.js'

export function setLat(bullet: BulletState, lat: number): boolean {
  if (bullet.lat === lat) return false
  bullet.lat = lat
  ;[bullet.x, bullet.y, bullet.z] = latLngToUnitPoint(bullet.lat, bullet.lng)
  return true
}

export function setLng(bullet: BulletState, lng: number): boolean {
  if (bullet.lng === lng) return false
  bullet.lng = lng
  ;[bullet.x, bullet.y, bullet.z] = latLngToUnitPoint(bullet.lat, bullet.lng)
  return true
}

export function setLocation(
  bullet: BulletState,
  lat: number,
  lng: number
): boolean {
  if (bullet.lat === lat && bullet.lng === lng) return false
  bullet.lat = lat
  bullet.lng = lng
  ;[bullet.x, bullet.y, bullet.z] = latLngToUnitPoint(lat, lng)
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
