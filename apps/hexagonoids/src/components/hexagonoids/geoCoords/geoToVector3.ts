import { Vector3 } from '@babylonjs/core'

import { degToRad, radToDeg } from './degToRad'

export interface GeoCoord {
  lat: number
  lng: number
}

export const wrap90 = (degrees: number) => {
  if (degrees >= -90 && degrees <= 90) return degrees
  const x = degrees
  const a = 90
  const p = 360
  return ((4 * a) / p) * Math.abs(((((x - p / 4) % p) + p) % p) - p / 2) - a
}

export const wrap180 = (degrees: number) => {
  if (degrees >= -180 && degrees <= 180) return degrees
  const x = degrees
  const a = 180
  const p = 360
  return (((((2 * a * x) / p - p / 2) % p) + p) % p) - a
}

export const geoToVector3 = (
  lat: number,
  lng: number,
  radius: number
): Vector3 => {
  const latitude = degToRad(wrap90(lat))
  const longitude = degToRad(wrap180(lng))

  const x = radius * Math.cos(latitude) * Math.cos(longitude)
  const z = radius * Math.cos(latitude) * Math.sin(longitude)
  const y = radius * Math.sin(latitude)

  return new Vector3(x, y, z)
}

export const vector3ToGeo = (vector: Vector3): GeoCoord => {
  const normal = vector.clone().normalize()
  const x = normal.x
  const y = normal.y
  const z = normal.z

  const latitude = Math.asin(y)
  const longitude = Math.atan2(z, x)
  const lat = radToDeg(latitude)
  const lng = radToDeg(longitude)

  return { lat, lng }
}
