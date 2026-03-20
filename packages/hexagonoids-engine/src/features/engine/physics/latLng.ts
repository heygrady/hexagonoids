import { RADIUS } from '../constants.js'
import { vec3 } from '../math/create.js'
import { quatFromUnitPoint } from '../math/quat.js'
import type { Quat, Vec3 } from '../math/types.js'

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

/**
 * Convert a Vec3 position to [lat, lng] in degrees.
 * lat = asin(y), lng = atan2(z, x) on a normalized vector.
 */
export const vec3ToLatLng = (position: Vec3): [lat: number, lng: number] => {
  // Normalize without allocating
  let px = position[0],
    py = position[1],
    pz = position[2]
  const lenSq = px * px + py * py + pz * pz
  if (lenSq > 0 && Math.abs(lenSq - 1) > 1e-7) {
    const inv = 1 / Math.sqrt(lenSq)
    px *= inv
    py *= inv
    pz *= inv
  }
  const lat = Math.asin(py) * RAD_TO_DEG
  const lng = Math.atan2(pz, px) * RAD_TO_DEG
  return [lat, lng]
}

/**
 * Convert [lat, lng] in degrees to a Vec3 on a sphere of given radius.
 */
export const latLngToVec3 = (
  lat: number,
  lng: number,
  radius: number = RADIUS
): Vec3 => {
  const latRad = lat * DEG_TO_RAD
  const lngRad = lng * DEG_TO_RAD

  const x = radius * Math.cos(latRad) * Math.cos(lngRad)
  const z = radius * Math.cos(latRad) * Math.sin(lngRad)
  const y = radius * Math.sin(latRad)

  return vec3(x, y, z)
}

export const latLngToUnitPoint = (
  lat: number,
  lng: number
): [x: number, y: number, z: number] => {
  const latRad = lat * DEG_TO_RAD
  const lngRad = lng * DEG_TO_RAD
  const cosLat = Math.cos(latRad)
  return [
    cosLat * Math.cos(lngRad),
    Math.sin(latRad),
    cosLat * Math.sin(lngRad),
  ]
}

/**
 * Convert a quaternion orientation to [lat, lng] in degrees.
 * Scalar — extracts unit point from quaternion then converts to lat/lng.
 */
export const quaternionToLatLng = (
  orientation: Quat,
  _radius: number = RADIUS
): [lat: number, lng: number] => {
  const qx = orientation[0],
    qy = orientation[1],
    qz = orientation[2],
    qw = orientation[3]
  const py = 1 - 2 * (qx * qx + qz * qz)
  const pz = 2 * (qy * qz + qx * qw)
  const px = 2 * (qx * qy - qz * qw)
  const lat = Math.asin(Math.max(-1, Math.min(1, py))) * RAD_TO_DEG
  const lng = Math.atan2(pz, px) * RAD_TO_DEG
  return [lat, lng]
}

/**
 * Fast scalar conversion from quaternion to [lat, lng] in degrees.
 */
export const quaternionToLatLngFast = (
  orientation: Quat,
  _radius: number = RADIUS
): [lat: number, lng: number] => {
  const qx = orientation[0],
    qy = orientation[1],
    qz = orientation[2],
    qw = orientation[3]
  const px = 2 * (qx * qy - qz * qw)
  const py = 1 - 2 * (qx * qx + qz * qz)
  const pz = 2 * (qy * qz + qx * qw)
  const lat = Math.asin(Math.max(-1, Math.min(1, py))) * RAD_TO_DEG
  const lng = Math.atan2(pz, px) * RAD_TO_DEG
  return [lat, lng]
}

/**
 * Fast scalar conversion that writes lat/lng into an existing target object.
 */
export const quaternionToLatLngFastInPlace = (
  orientation: Quat,
  target: { lat: number; lng: number; x?: number; y?: number; z?: number },
  _radius: number = RADIUS
): void => {
  const qx = orientation[0],
    qy = orientation[1],
    qz = orientation[2],
    qw = orientation[3]
  const px = 2 * (qx * qy - qz * qw)
  const py = 1 - 2 * (qx * qx + qz * qz)
  const pz = 2 * (qy * qz + qx * qw)

  target.lat = Math.asin(Math.max(-1, Math.min(1, py))) * RAD_TO_DEG
  target.lng = Math.atan2(pz, px) * RAD_TO_DEG
  if ('x' in target) target.x = px
  if ('y' in target) target.y = py
  if ('z' in target) target.z = pz
}

export const unitPointToLatLng = (
  x: number,
  y: number,
  z: number
): [lat: number, lng: number] => {
  const lat = Math.asin(Math.max(-1, Math.min(1, y))) * RAD_TO_DEG
  const lng = Math.atan2(z, x) * RAD_TO_DEG
  return [lat, lng]
}

export const unitPointToLatLngInPlace = (
  x: number,
  y: number,
  z: number,
  target: { lat: number; lng: number }
): void => {
  target.lat = Math.asin(Math.max(-1, Math.min(1, y))) * RAD_TO_DEG
  target.lng = Math.atan2(z, x) * RAD_TO_DEG
}

/**
 * Convert [lat, lng] in degrees to an orientation quaternion.
 * Writes into a new Quat.
 */
export const latLngToQuaternion = (lat: number, lng: number): Quat => {
  const [x, y, z] = latLngToUnitPoint(lat, lng)
  const q = new Float64Array(4) as Quat
  quatFromUnitPoint(q, x, y, z)
  return q
}

/**
 * Convert a unit-sphere point to an orientation quaternion.
 * Delegates to quatFromUnitPoint from the math library.
 */
export const unitPointToQuaternion = (
  x: number,
  y: number,
  z: number
): Quat => {
  const q = new Float64Array(4) as Quat
  quatFromUnitPoint(q, x, y, z)
  return q
}
