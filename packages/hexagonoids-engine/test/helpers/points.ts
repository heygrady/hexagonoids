import { vec3 } from '../../src/features/engine/math/create.js'
import type { Vec3 } from '../../src/features/engine/math/types.js'
import type {
  BulletState,
  RockState,
  ShipState,
} from '../../src/features/engine/types.js'

export function pointFromLatLng(lat: number, lng: number): Vec3 {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  const cosLat = Math.cos(latRad)
  return vec3(
    cosLat * Math.cos(lngRad),
    Math.sin(latRad),
    cosLat * Math.sin(lngRad)
  )
}

export function dotPoints(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function pointDistanceSquared(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return dx * dx + dy * dy + dz * dz
}

export function entityPoint(entity: ShipState | RockState | BulletState): Vec3 {
  return vec3(entity.position[0], entity.position[1], entity.position[2])
}
