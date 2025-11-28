import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import {
  cellToLatLng,
  degsToRads,
  type CoordPair,
  radsToDegs,
  latLngToCell,
} from 'h3-js'

/**
 * Wrap latitude degrees to -90 to 90
 * @param {number} degrees number in degrees
 * @returns {number} number in radians, wrapped from -90 to 90
 */
export const wrap90 = (degrees: number) => {
  if (degrees >= -90 && degrees <= 90) return degrees
  const x = degrees
  const a = 90
  const p = 360
  return ((4 * a) / p) * Math.abs(((((x - p / 4) % p) + p) % p) - p / 2) - a
}

/**
 * Wrap longitude degrees to -180 to 180
 * @param {number} degrees number in degrees
 * @returns {number} number in radians, wrapped from -180 to 180
 */
export const wrap180 = (degrees: number) => {
  if (degrees >= -180 && degrees <= 180) return degrees
  const x = degrees
  const a = 180
  const p = 360
  return (((((2 * a * x) / p - p / 2) % p) + p) % p) - a
}

export const latLngToVector3 = (
  lat: number,
  lng: number,
  radius: number
): Vector3 => {
  const latitude = degsToRads(wrap90(lat))
  const longitude = degsToRads(wrap180(lng))

  const x = radius * Math.cos(latitude) * Math.cos(longitude)
  const z = radius * Math.cos(latitude) * Math.sin(longitude)
  const y = radius * Math.sin(latitude)

  return new Vector3(x, y, z)
}

export const vector3ToLatLng = (vector: Vector3): CoordPair => {
  const { x, y, z } = vector.normalizeToNew()

  const latitude = Math.asin(y)
  const longitude = Math.atan2(z, x)
  const lat = radsToDegs(latitude)
  const lng = radsToDegs(longitude)

  return [lat, lng]
}

export const vector3ToCell = (vector: Vector3, resolution: number): string => {
  const [lat, lng] = vector3ToLatLng(vector)
  const h = latLngToCell(lat, lng, resolution)
  return h
}

export const cellToVector3 = (h: string, radius: number): Vector3 => {
  const [lat, lng] = cellToLatLng(h)
  const vector = latLngToVector3(lat, lng, radius)
  return vector
}
