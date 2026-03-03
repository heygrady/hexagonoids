import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import { RADIUS } from '../constants.js'

import { getPositionFromQuaternion } from './quaternionPhysics.js'

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

/**
 * Convert Vector3 position to [lat, lng] in degrees.
 * lat = asin(y), lng = atan2(z, x) on a normalized vector.
 */
export const vector3ToLatLng = (
  position: Vector3
): [lat: number, lng: number] => {
  const { x, y, z } = position.normalizeToNew()
  const lat = Math.asin(y) * RAD_TO_DEG
  const lng = Math.atan2(z, x) * RAD_TO_DEG
  return [lat, lng]
}

/**
 * Convert [lat, lng] in degrees to a Vector3 on a sphere of given radius.
 */
export const latLngToVector3 = (
  lat: number,
  lng: number,
  radius: number = RADIUS
): Vector3 => {
  const latRad = lat * DEG_TO_RAD
  const lngRad = lng * DEG_TO_RAD

  const x = radius * Math.cos(latRad) * Math.cos(lngRad)
  const z = radius * Math.cos(latRad) * Math.sin(lngRad)
  const y = radius * Math.sin(latRad)

  return new Vector3(x, y, z)
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
 * Uses getPositionFromQuaternion then vector3ToLatLng.
 */
export const quaternionToLatLng = (
  orientation: Quaternion,
  radius: number = RADIUS
): [lat: number, lng: number] => {
  const position = getPositionFromQuaternion(orientation, radius)
  return vector3ToLatLng(position)
}

/**
 * Fast scalar conversion from quaternion to [lat, lng] in degrees.
 * Equivalent to quaternionToLatLng but avoids Vector3 allocations.
 */
export const quaternionToLatLngFast = (
  orientation: Quaternion,
  _radius: number = RADIUS
): [lat: number, lng: number] => {
  const { x, y, z, w } = orientation

  // Rotate local up (0,1,0) by quaternion.
  const px = 2 * (x * y - z * w)
  const py = 1 - 2 * (x * x + z * z)
  const pz = 2 * (y * z + x * w)

  const lat = Math.asin(Math.max(-1, Math.min(1, py))) * RAD_TO_DEG
  const lng = Math.atan2(pz, px) * RAD_TO_DEG
  return [lat, lng]
}

/**
 * Fast scalar conversion that writes lat/lng into an existing target object.
 * Avoids allocating a tuple in hot movement loops.
 */
export const quaternionToLatLngFastInPlace = (
  orientation: Quaternion,
  target: { lat: number; lng: number; x?: number; y?: number; z?: number },
  _radius: number = RADIUS
): void => {
  const { x, y, z, w } = orientation
  const px = 2 * (x * y - z * w)
  const py = 1 - 2 * (x * x + z * z)
  const pz = 2 * (y * z + x * w)

  target.lat = Math.asin(Math.max(-1, Math.min(1, py))) * RAD_TO_DEG
  target.lng = Math.atan2(pz, px) * RAD_TO_DEG
  if ('x' in target) target.x = px
  if ('y' in target) target.y = py
  if ('z' in target) target.z = pz
}

/**
 * Fast scalar conversion that writes only the unit-sphere position into an
 * existing target object. Use this in hot simulation loops where lat/lng is
 * not needed.
 */
export const quaternionToUnitPointFastInPlace = (
  orientation: Quaternion,
  target: { x?: number; y?: number; z?: number },
  _radius: number = RADIUS
): void => {
  const { x, y, z, w } = orientation
  target.x = 2 * (x * y - z * w)
  target.y = 1 - 2 * (x * x + z * z)
  target.z = 2 * (y * z + x * w)
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
 * Aligns local +Y with the surface normal and local +Z (forward) with
 * geographic east so yaw=0 is always east, regardless of longitude.
 */
export const latLngToQuaternion = (lat: number, lng: number): Quaternion => {
  const position = latLngToVector3(lat, lng, 1).normalize()
  const lngRad = lng * DEG_TO_RAD
  const east = new Vector3(-Math.sin(lngRad), 0, Math.cos(lngRad)).normalize()

  const up = Vector3.Up()
  const axis = Vector3.Cross(up, position)
  const axisLen = axis.length()
  let upAligned: Quaternion
  if (axisLen < 0.00001) {
    upAligned =
      position.y > 0
        ? Quaternion.Identity()
        : Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI)
  } else {
    axis.scaleInPlace(1 / axisLen)
    const dot = Vector3.Dot(up, position)
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
    upAligned = Quaternion.RotationAxis(axis, angle)
  }

  // Resolve the twist around the normal so forward matches geographic east.
  const forwardAfterUpAlign = Vector3.Forward()
    .applyRotationQuaternion(upAligned)
    .normalize()
  const cross = Vector3.Cross(forwardAfterUpAlign, east)
  const signedSin = Vector3.Dot(position, cross)
  const signedCos = Vector3.Dot(forwardAfterUpAlign, east)
  const twist = Math.atan2(signedSin, signedCos)

  const twistQuaternion = Quaternion.RotationAxis(position, twist)
  const result = twistQuaternion.multiply(upAligned)
  result.normalize()
  return result
}
