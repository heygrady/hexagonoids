import type {
  BulletState,
  RockState,
  ShipState,
} from '../../src/features/engine/types.js'

export function pointFromLatLng(
  lat: number,
  lng: number
): { x: number; y: number; z: number } {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  const cosLat = Math.cos(latRad)
  return {
    x: cosLat * Math.cos(lngRad),
    y: Math.sin(latRad),
    z: cosLat * Math.sin(lngRad),
  }
}

export function dotPoints(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function pointDistanceSquared(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

export function entityPoint(entity: ShipState | RockState | BulletState): {
  x: number
  y: number
  z: number
} {
  return {
    x: entity.x,
    y: entity.y,
    z: entity.z,
  }
}
