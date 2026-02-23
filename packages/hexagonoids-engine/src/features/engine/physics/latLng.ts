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
 * Convert [lat, lng] in degrees to an orientation quaternion.
 * Computes the rotation that moves the "up" vector to the surface point.
 */
export const latLngToQuaternion = (lat: number, lng: number): Quaternion => {
  const position = latLngToVector3(lat, lng, 1)
  const up = Vector3.Up()
  const axis = Vector3.Cross(up, position)
  const axisLen = axis.length()
  if (axisLen < 0.00001) {
    if (position.y > 0) return Quaternion.Identity()
    return Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI)
  }
  axis.scaleInPlace(1 / axisLen)
  const dot = Vector3.Dot(up, position)
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
  return Quaternion.RotationAxis(axis, angle)
}
