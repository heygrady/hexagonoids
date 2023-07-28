import { Vector3 } from '@babylonjs/core'

import { RADIUS } from '../constants'

import { vector3ToGeo, type GeoCoord, geoToVector3 } from './geoToVector3'

export const findVector3At = (
  vector1: Vector3,
  vector2: Vector3,
  t: number
): Vector3 => {
  const x = vector1.x + (vector2.x - vector1.x) * t
  const y = vector1.y + (vector2.y - vector1.y) * t
  const z = vector1.z + (vector2.z - vector1.z) * t

  return new Vector3(x, y, z)
}

export const findVector3AtDistance = (
  vector1: Vector3,
  vector2: Vector3,
  distance: number
): Vector3 => {
  const length = Vector3.Distance(vector1, vector2)
  return findVector3At(vector1, vector2, distance / length)
}

export const findGeoAt = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  t: number
): GeoCoord => {
  return vector3ToGeo(
    findVector3At(
      geoToVector3(lat1, lng1, RADIUS),
      geoToVector3(lat2, lng2, RADIUS),
      t
    )
  )
}
