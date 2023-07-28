import { Vector3 } from '@babylonjs/core'

import { geoToVector3, vector3ToGeo } from './geoToVector3'

export const wrapPI = (radians: number) => {
  if (-Math.PI <= radians && radians <= Math.PI) return radians
  const x = radians
  const a = Math.PI
  const p = 2 * Math.PI
  return (((((2 * a * x) / p - p / 2) % p) + p) % p) - a
}

export type CameraAngles = [alpha: number, beta: number, radius: number]

export const geoToCamera = (lat: number, lng: number, radius: number) =>
  vector3ToCamera(geoToVector3(lat, lng, radius))

export const cameraToGeo = (alpha: number, beta: number, radius: number) =>
  vector3ToGeo(cameraToVector3(alpha, beta, radius))

export const cameraToVector3 = (
  alpha: number,
  beta: number,
  radius: number
): Vector3 => {
  const x = radius * Math.cos(beta) * Math.sin(alpha)
  const y = radius * Math.sin(beta)
  const z = radius * Math.cos(beta) * Math.cos(alpha)

  return new Vector3(x, y, z)
}

export const vector3ToCamera = (vector: Vector3): [number, number, number] => {
  const radius = Math.sqrt(
    vector.x * vector.x + vector.y * vector.y + vector.z * vector.z
  )
  const alpha = Math.atan2(vector.x, vector.z)
  const beta = Math.asin(vector.y / radius)

  return [wrapPI(alpha), Math.abs(beta % Math.PI), radius]
}
